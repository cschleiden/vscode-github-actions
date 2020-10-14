import { spawn } from "child_process";
import { EventEmitter } from "events";
import { parse } from "github-actions-parser";
import { WorkflowDocument } from "github-actions-parser/dist/lib/parser/parser";
import { Context } from "github-actions-parser/dist/types";
import { OutputEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { buildJobMessage, JobRequestMessage } from "./message";
import { buildPlan, LocalPlan } from "./plan";
import { RunnerDebugProtocolServer } from "./protocolServer";

export interface Runner {
  run(): Promise<void>;

  continue(): Promise<void>;

  stackTrace(): Promise<DebugProtocol.StackTraceResponse["body"]>;

  variables(
    args: DebugProtocol.VariablesArguments
  ): Promise<DebugProtocol.VariablesResponse["body"]>;

  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

class RunnerImpl extends EventEmitter implements Runner {
  private plan?: LocalPlan;
  private workflow?: WorkflowDocument;

  private _stopped = false;
  private _protocolServer?: RunnerDebugProtocolServer;

  constructor(private fileName: string, private input: string) {
    super();
  }

  async run(): Promise<void> {
    // Parse workflow
    this.workflow = await parse({} as Context, this.fileName, this.input);
    if (!this.workflow.workflow) {
      throw new Error("Could not parse workflow");
    }

    // Build plan
    this.buildPlan();

    // Run jobs
    for (const job of this.plan!.jobs) {
      const message = buildJobMessage(
        this.fileName,
        job.id,
        this.workflow!.workflow!.jobs[job.id]
      );

      await this.runJob(message);
    }

    // Done!
    this.sendEvent("end");
  }

  private buildPlan() {
    this.plan = buildPlan(this.workflow?.workflow!);
  }

  private runJob(message: JobRequestMessage): Promise<JobResult> {
    return new Promise<JobResult>((resolve, _) => {
      const protocolServer = new RunnerDebugProtocolServer();
      this._protocolServer = protocolServer;

      const p = spawn(
        "/Users/cschleiden/projects/runner/src/Runner.Worker/bin/Debug/netcoreapp3.1/Runner.Worker",
        ["local", "--debug", "--stop-on-entry", JSON.stringify(message)],
        {}
      );
      console.log(`Spawned runner with pid ${p.pid}`);
      // p.stdout.on("data", (data) => {
      //   console.log(`${data}`);
      // });
      // p.stderr.on("data", (data) => {
      //   console.error(`${data}`);
      // });
      p.on("exit", (code) => {
        console.log(`child process exited with code ${code}`);

        protocolServer.stop();
        protocolServer.dispose();

        resolve(JobResult.Succeeded);
      });

      protocolServer.on("output", (e: OutputEvent) => {
        // console.log(e.body.output);
        this.sendEvent("output", e.body.output);
      });

      protocolServer.on("terminated", () => {
        p.stdin.destroy();
        p.stdout.destroy();
      });

      protocolServer.on("initialized", () => {
        protocolServer.sendRequest(
          "setBreakpoints",
          {
            breakpoints: [
              {
                line: 1, // line is the index of the step we want to break on
              },
            ],
          } as DebugProtocol.SetBreakpointsArguments,
          0,
          () => {
            protocolServer.sendRequest("configurationDone", {}, 0, null as any);
          }
        );
      });

      protocolServer.on("stopped", (e: DebugProtocol.StoppedEvent) => {
        this.sendEvent("stopped", e.body.reason);

        this._stopped = true;
      });

      protocolServer.start(p.stdout, p.stdin);
      protocolServer.sendRequest("initialize", {}, 0, null as any);
    });
  }

  public async continue() {
    if (this._stopped && this._protocolServer) {
      this._protocolServer.sendRequest("continue", {}, 0, null as any);
      this._stopped = false;
    }
  }

  public async stackTrace(): Promise<DebugProtocol.StackTraceResponse["body"]> {
    return new Promise((resolve) => {
      if (this._stopped && this._protocolServer) {
        this._protocolServer.sendRequest("stackTrace", {}, 2000, (resp) => {
          resolve(resp.body);
        });
      }
    });
  }

  public async variables(
    args: DebugProtocol.VariablesArguments
  ): Promise<{ variables: DebugProtocol.Variable[] }> {
    return new Promise((resolve) => {
      if (this._stopped && this._protocolServer) {
        this._protocolServer.sendRequest("variables", args, 2000, (resp) => {
          resolve(resp.body);
        });
      }
    });
  }

  private sendEvent(event: string, ...args: any[]) {
    setImmediate((_) => {
      this.emit(event, ...args);
    });
  }
}

export function createRunner(fileName: string, workflow: string): Runner {
  return new RunnerImpl(fileName, workflow);
}

enum JobResult {
  Succeeded = 0,
}

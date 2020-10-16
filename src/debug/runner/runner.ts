import { spawn } from "child_process";
import { EventEmitter } from "events";
import { parse } from "github-actions-parser";
import { WorkflowDocument } from "github-actions-parser/dist/lib/parser/parser";
import { Context, YAMLSequence } from "github-actions-parser/dist/types";
import { OutputEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { findNode, Kind } from "../external/findNode";
import { JobRequestMessage } from "./message";
import { buildPlan, jobGenerator, LocalPlan } from "./plan";
import { RunnerDebugProtocolServer } from "./protocolServer";

export interface Runner {
  setBreakpoints(offsets: number[]): Promise<boolean[]>;

  init(): Promise<void>;

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

  private _running = false;
  private _jobId = "";
  private _stopped = false;
  private _protocolServer?: RunnerDebugProtocolServer;

  private _breakpointStepIndexesByJob: {
    [jobId: string]: { stepIdx: number; offset: number }[];
  } = {};

  constructor(private fileName: string, private input: string) {
    super();
  }

  async init() {
    // Parse workflow
    this.workflow = await parse({} as Context, this.fileName, this.input);
    if (!this.workflow.workflow) {
      throw new Error("Could not parse workflow");
    }
  }

  async setBreakpoints(offsets: number[]): Promise<boolean[]> {
    this._breakpointStepIndexesByJob = {};

    const ret: boolean[] = [];
    for (const offset of offsets) {
      // Try to figure out if this
      let node = findNode(this.workflow!.workflowST, offset);
      if (!node) {
        ret.push(false);
        continue;
      }

      // We need to find the element that has a SEQ parent, which has a Mapping parent with a `steps` key
      let success = false;
      while (!!node && !!node.parent) {
        if (
          node.parent?.kind === Kind.SEQ &&
          node.parent?.parent?.key?.value === "steps"
        ) {
          // Found our node
          success = true;
          break;
        }

        node = node.parent;
      }

      if (!success) {
        ret.push(false);
        continue;
      }

      // Get step index
      const step = node;
      const stepIdx = (node.parent as YAMLSequence).items.indexOf(step);
      if (stepIdx === -1) {
        ret.push(false);
        continue;
      }

      // Get job id
      const jobId: string = node.parent?.parent?.parent?.parent?.key?.value; // Sequence // Steps mapping // Map // Mapping
      if (!jobId) {
        ret.push(false);
        continue;
      }

      this._breakpointStepIndexesByJob[jobId] = [
        ...(this._breakpointStepIndexesByJob[jobId] || []),
        {
          stepIdx,
          offset,
        },
      ];

      ret.push(true);
    }

    if (this._running) {
      await this.updateBreakpoints();
    }

    return ret;
  }

  async run(): Promise<void> {
    // Build plan
    this.buildPlan();

    // Run jobs
    for (const jobDesc of this.plan!.jobs) {
      for (const { jobId, message } of jobGenerator(this.fileName, jobDesc)) {
        await this.runJob(jobId, message);
      }
    }

    // Done!
    this.sendEvent("end");
  }

  private buildPlan() {
    this.plan = buildPlan(this.workflow?.workflow!);
  }

  private runJob(
    jobId: string,
    message: JobRequestMessage
  ): Promise<JobResult> {
    return new Promise<JobResult>((resolve, _) => {
      const protocolServer = new RunnerDebugProtocolServer();
      this._protocolServer = protocolServer;

      const p = spawn(
        "/Users/cschleiden/playground/debug-hack/runner/src/Runner.Worker/bin/Debug/netcoreapp3.1/osx-x64/Runner.Worker",
        ["local", "--debug", "--stop-on-entry", JSON.stringify(message)],
        {}
      );
      console.log(`Spawned runner with pid ${p.pid}`);
      this._running = true;
      this._jobId = jobId;

      // p.stdout.on("data", (data) => {
      //   console.log(`${data}`);
      // });
      // p.stderr.on("data", (data) => {
      //   console.error(`${data}`);
      // });
      p.on("exit", (code) => {
        console.log(`child process exited with code ${code}`);

        this._running = false;

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

      protocolServer.on("initialized", async () => {
        await this.updateBreakpoints();
        protocolServer.sendRequest("configurationDone", {}, 0, null as any);
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
          resp = resp as DebugProtocol.StackTraceResponse;

          // Update
          if (resp.body?.stackFrames[0]) {
            const stepIdx = resp.body?.stackFrames[0].line;
            resp.body.stackFrames[0].line =
              this._breakpointStepIndexesByJob[this._jobId].find(
                (x) => x.stepIdx === stepIdx
              )?.offset || 0;
          }

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

  private async updateBreakpoints() {
    return new Promise((resolve) => {
      if (this._running && this._protocolServer) {
        this._protocolServer.sendRequest(
          "setBreakpoints",
          {
            breakpoints: (
              this._breakpointStepIndexesByJob[this._jobId] || []
            ).map(({ stepIdx }) => ({
              line: stepIdx, // We use line as step index
            })),
          } as DebugProtocol.SetBreakpointsArguments,
          2000,
          (resp) => {
            resolve(resp);
          }
        );
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

import { DebugProtocol } from "vscode-debugprotocol";
import { EventEmitter } from "events";
import { RunnerDebugProtocolServer } from "./protocolServer";
import { Socket } from "net";

/** Mapping of job ids to step indexes */
export type JobBreakpoints = {
  [jobId: string]: number[];
};

export interface RunnerConnection {
  /** Connect to a runner instance */
  connect(addr: string, port: number): Promise<void>;

  launch(): Promise<void>;

  setBreakpoints(breakpoints: JobBreakpoints): Promise<void>;

  continue(): Promise<void>;

  stackTrace(): Promise<DebugProtocol.StackTraceResponse["body"]>;

  variables(
    args: DebugProtocol.VariablesArguments
  ): Promise<DebugProtocol.VariablesResponse["body"]>;

  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

enum State {
  Default = 0,
  Connected,
  Stopped,
}

export function createRunnerConnection(): RunnerConnection {
  return new RunnerConnectionImpl();
}

class RunnerConnectionImpl extends EventEmitter implements RunnerConnection {
  private _state: State = State.Default;

  private _breakpoints: JobBreakpoints = {};

  private _protocolServer = new RunnerDebugProtocolServer();

  private _client = new Socket();

  async connect(addr: string, port: number) {
    return new Promise<void>((resolve, reject) => {
      this._client.connect({
        // TODO: Use real address
        // host: "127.0.0.1",
        port,
      });

      this._client.on("connect", async () => {
        this._state = State.Connected;

        this._protocolServer.start(this._client, this._client);

        // Set up event listeners
        this._protocolServer.on("output", (e: DebugProtocol.OutputEvent) => {
          console.log(e.body.output);
          this.sendEvent("output", e.body.output);
        });

        this._protocolServer.on("terminated", () => {
          this._client.end();
        });

        this._protocolServer.on("stopped", (e: DebugProtocol.StoppedEvent) => {
          this._state = State.Stopped;
          this.sendEvent("stopped", e.body.reason);
        });

        // Initialization flow
        this._protocolServer.on("initialized", async () => {
          // await this.updateBreakpoints();

          await this.sendRequest("configurationDone");

          resolve();
        });

        await this.sendRequest<DebugProtocol.InitializeResponse>("initialize");
      });
    });
  }

  async launch() {
    await this.sendRequest("launch");
  }

  async setBreakpoints(breakpoints: JobBreakpoints): Promise<void> {
    this._breakpoints = breakpoints;

    await this.updateBreakpoints();
  }

  // private runJob(
  //   jobId: string,
  //   message: JobRequestMessage
  // ): Promise<JobResult> {
  //   return new Promise<JobResult>((resolve, _) => {
  //     // p.stdout.on("data", (data) => {
  //     //   console.log(`${data}`);
  //     // });
  //     // p.stderr.on("data", (data) => {
  //     //   console.error(`${data}`);
  //     // });
  //     p.on("exit", (code) => {
  //       console.log(`child process exited with code ${code}`);

  //       this._running = false;

  //       protocolServer.stop();
  //       protocolServer.dispose();
  //     });

  //     protocolServer.on("output", (e: OutputEvent) => {
  //       // console.log(e.body.output);
  //       this.sendEvent("output", e.body.output);
  //     });

  //     protocolServer.on("terminated", () => {
  //       p.stdin.destroy();
  //       p.stdout.destroy();
  //     });

  //     protocolServer.on("initialized", async () => {
  //       await this.updateBreakpoints();
  //       protocolServer.sendRequest("configurationDone", {}, 0, null as any);
  //     });

  //     protocolServer.on("stopped", (e: DebugProtocol.StoppedEvent) => {
  //       this.sendEvent("stopped", e.body.reason);

  //       this._stopped = true;
  //     });

  //     protocolServer.start(p.stdout, p.stdin);
  //     protocolServer.sendRequest("initialize", {}, 0, null as any);
  //   });
  // }

  public async continue() {
    if (this._state === State.Stopped) {
      this.sendRequest("continue");
      this._state = State.Connected;
    }
  }

  public async stackTrace(): Promise<DebugProtocol.StackTraceResponse["body"]> {
    const resp = await this.sendRequest<DebugProtocol.StackTraceResponse>(
      "stacktrace"
    );

    // TODO: CS: Ensure this is happening in the caller
    // if (resp.body?.stackFrames[0]) {
    //   // Map back from step index to concrete line
    //   const stepIdx = resp.body?.stackFrames[0].line;
    //   resp.body.stackFrames[0].line =
    //     this._breakpoints[this._jobId].find((x) => x.stepIdx === stepIdx)
    //       ?.offset || 0;
    // }

    return resp.body;
  }

  public async variables(
    args: DebugProtocol.VariablesArguments
  ): Promise<{ variables: DebugProtocol.Variable[] }> {
    return (
      await this.sendRequest<DebugProtocol.VariablesResponse>("variables", args)
    ).body;
  }

  private async updateBreakpoints() {
    if (this._state === State.Connected && this._protocolServer) {
      // TODO: Only send breakpoints for the current job?
      // await this.sendRequest("setBreakpoints", {
      //   breakpoints: (this._breakpoints[this._jobId] || []).map(
      //     ({ stepIdx }) => ({
      //       line: stepIdx, // We use line as step index
      //     })
      //   ),
      // } as DebugProtocol.SetBreakpointsArguments);
    }
  }

  private async sendRequest<T extends DebugProtocol.Response>(
    command: string,
    args: any = {}
  ): Promise<T> {
    const timeout = 2000;

    return new Promise((resolve) => {
      this._protocolServer.sendRequest(command, args, timeout, (resp) =>
        resolve(resp as T)
      );
    });
  }

  private sendEvent(event: string, ...args: any[]) {
    setImmediate((_) => {
      this.emit(event, ...args);
    });
  }
}

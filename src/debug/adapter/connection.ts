import { EventEmitter } from "events";
import { Socket } from "net";
import { DebugProtocol } from "vscode-debugprotocol";
import { RunnerDebugProtocolServer } from "./protocolServer";

/**
 * Runner connection manages the connection to a single runner debuggger
 */
export interface RunnerConnection {
  /** Connect to a runner instance */
  connect(addr: string, port: number): Promise<void>;

  attach(): Promise<void>;

  setBreakpoints(stepIdxs: number[]): Promise<void>;

  continue(): Promise<void>;

  terminate(): Promise<void>;

  stackTrace(): Promise<DebugProtocol.StackTraceResponse["body"]>;

  variables(
    args: DebugProtocol.VariablesArguments
  ): Promise<DebugProtocol.VariablesResponse["body"]>;

  evaluate(
    args: DebugProtocol.EvaluateArguments
  ): Promise<DebugProtocol.EvaluateResponse["body"]>;

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

  private _breakpoints: number[] = [];

  private _protocolServer = new RunnerDebugProtocolServer();

  private _client = new Socket();

  async connect(addr: string, port: number) {
    return new Promise<void>((resolve, reject) => {
      this._client.connect({
        // TODO: Use real address
        // host: "127.0.0.1",
        host: "20.25.135.77",
        port,
      });

      this._client.on("close", async () => {
        this._state = State.Default;
        this.sendEvent("terminated");
      });

      this._client.on("connect", async () => {
        this._state = State.Connected;

        this._protocolServer.start(this._client, this._client);

        // Set up event listeners
        this._protocolServer.on("output", (e: DebugProtocol.OutputEvent) => {
          console.log(e.body.output);
          this.sendEvent("output", e.body.output);
        });

        this._protocolServer.on(
          "terminated",
          (e: DebugProtocol.TerminatedEvent) => {
            this._client.end();
            this.sendEvent("terminated", e);
          }
        );

        // this._protocolServer.on("exited", (e: DebugProtocol.ExitedEvent) => {
        //   this._client.end();
        //   this.sendEvent("exited", e);
        // });

        this._protocolServer.on("stopped", (e: DebugProtocol.StoppedEvent) => {
          this._state = State.Stopped;
          this.sendEvent("stopped", e.body.reason);
        });

        // Initialization flow
        this._protocolServer.on("initialized", async () => {
          await this.updateBreakpoints();

          await this.sendRequest("configurationDone");

          resolve();
        });

        await this.sendRequest<DebugProtocol.InitializeResponse>("initialize");
      });
    });
  }

  async attach() {
    await this.sendRequest("attach");
  }

  async terminate() {
    await this.sendRequest("terminate");
  }

  async setBreakpoints(stepIdxs: number[]): Promise<void> {
    this._breakpoints = stepIdxs;

    await this.updateBreakpoints();
  }

  public async continue() {
    if (this._state === State.Stopped) {
      this.sendRequest("continue");
      this._state = State.Connected;
    }
  }

  public async stackTrace(): Promise<DebugProtocol.StackTraceResponse["body"]> {
    const resp = await this.sendRequest<DebugProtocol.StackTraceResponse>(
      "stackTrace"
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

  public async evaluate(
    args: DebugProtocol.EvaluateArguments
  ): Promise<DebugProtocol.EvaluateResponse["body"]> {
    return (
      await this.sendRequest<DebugProtocol.EvaluateResponse>("evaluate", args)
    ).body;
  }

  private async updateBreakpoints() {
    if (this._state === State.Connected && this._protocolServer) {
      await this.sendRequest("setBreakpoints", {
        breakpoints: this._breakpoints.map((idx) => ({
          line: idx, // We use line as step index
        })),
      } as DebugProtocol.SetBreakpointsArguments);
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

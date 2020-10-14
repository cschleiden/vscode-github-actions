import { basename } from "path";
import * as vscode from "vscode";
import {
  InitializedEvent,
  LoggingDebugSession,
  OutputEvent,
  Scope,
  Source,
  StoppedEvent,
  TerminatedEvent,
  Thread,
} from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { createRunner, Runner } from "./runner";

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  workflow: string;
}

export class RunnerDebugSession extends LoggingDebugSession {
  private _configurationDone = new Promise((resolve) => {
    this._setConfigurationDone = resolve;
  });
  private _setConfigurationDone?: (value?: unknown) => void;
  private _runner?: Runner;
  private _uri?: vscode.Uri;

  public constructor() {
    super();
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    response.body = response.body || {};

    response.body.supportsEvaluateForHovers = false;

    response.body.supportsConfigurationDoneRequest = true;

    this.sendResponse(response);

    this.sendEvent(new InitializedEvent());
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments
  ): void {
    super.configurationDoneRequest(response, args);

    this._setConfigurationDone!();
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): void {
    this._runner!.continue();
    this.sendResponse(response);
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): Promise<void> {
    super.setBreakPointsRequest(response, args);

    // TODO: CS: Map lines to steps!
    // const path = args.source.path as string;
    // const clientLines = args.lines || [];

    // // clear all breakpoints for this file
    // this._runtime.clearBreakpoints(path);

    // // set and verify breakpoint locations
    // const actualBreakpoints0 = clientLines.map(async l => {
    // 	const { verified, line, id } = await this._runtime.setBreakPoint(path, this.convertClientLineToDebugger(l));
    // 	const bp = new Breakpoint(verified, this.convertDebuggerLineToClient(line)) as DebugProtocol.Breakpoint;
    // 	bp.id= id;
    // 	return bp;
    // });
    // const actualBreakpoints = await Promise.all<DebugProtocol.Breakpoint>(actualBreakpoints0);

    // // send back the actual breakpoint positions
    // response.body = {
    // 	breakpoints: actualBreakpoints
    // };
    // this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    // we support no threads so just return a default thread.
    response.body = {
      threads: [new Thread(1, "Workflow")],
    };
    this.sendResponse(response);
  }

  protected async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): Promise<void> {
    //this.awaitAndSendRequest(this._runner!.stackTrace(), response);
    const body = await this._runner!.stackTrace();
    for (const sf of body.stackFrames) {
      sf.line = 12;
      sf.source = new Source(
        basename(this._uri!.fsPath),
        this.convertClientPathToDebugger(this._uri!.fsPath)
      );
    }
    response.body = body;
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments
  ): void {
    response.body = {
      scopes: [new Scope("Step", 1, true)],
    };
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
    request?: DebugProtocol.Request
  ) {
    this.awaitAndSendRequest(this._runner!.variables(args), response);
  }

  // protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments) {
  //   args.
  // }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: ILaunchRequestArguments
  ) {
    // wait until configuration has finished (and configurationDoneRequest has been called)
    await this._configurationDone;

    const uri = vscode.Uri.parse(args.workflow);
    this._uri = uri;

    const bytes = await vscode.workspace.fs.readFile(uri);
    const contents = Buffer.from(bytes).toString("utf8");

    this._runner = createRunner(args.workflow, contents);

    this._runner.on("output", (line: string) => {
      this.sendEvent(new OutputEvent(`${line}\n`));
    });

    this._runner.on("end", () => {
      this.sendEvent(new TerminatedEvent());
    });

    this._runner.on("stopped", (reason: string) => {
      this.sendEvent(new StoppedEvent(reason, 1));
    });

    this.sendResponse(response);

    await this._runner.run();
  }

  private async awaitAndSendRequest<T extends DebugProtocol.Response>(
    p: Promise<T["body"]>,
    response: T
  ) {
    const body = await p;
    response.body = body;
    this.sendResponse(response);
  }
}

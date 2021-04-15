import { DebugConfiguration, Uri, workspace } from "vscode";
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
import { RunnerConnection, createRunnerConnection } from "./connection";

import { DebugProtocol } from "vscode-debugprotocol";
import { basename } from "path";

const DEFAULT_THREAD = 1;

export interface ActionsDebugConfiguration extends DebugConfiguration {
  workflow: string;

  address: string;

  port: number;
}

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  workflow: string;
}

export class ActionsDebugSession extends LoggingDebugSession {
  private _configurationDone = new Promise((resolve) => {
    this._setConfigurationDone = resolve;
  });

  private _setConfigurationDone!: (value?: unknown) => void;

  private _connection: RunnerConnection;
  private workflowPath: string;

  public constructor(private config: ActionsDebugConfiguration) {
    super();

    this.workflowPath = Uri.parse(this.config.workflow).fsPath;

    this._connection = createRunnerConnection();
  }

  protected async initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ) {
    // Connect to debugger
    await this._connection.connect(this.config.address, this.config.port);

    // Hard-code the capabilities for now
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

    this._setConfigurationDone();
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): void {
    this._connection.continue();
    this.sendResponse(response);
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): Promise<void> {
    const breakpointsPath = args.source.path!;

    // This is ugly, but we need to transform the line numbers for the breakpoints to offsets until the
    // parser supports that. We just assume that the user has the workflow open when debugging it (otherwise
    // the button doesn't show up)
    const textDocument = workspace.textDocuments.find(
      (t) => t.fileName === this.workflowPath
    );
    if (!textDocument || breakpointsPath != this.workflowPath) {
      // Ignore these breakpoints
      response.body = {
        breakpoints: (args.breakpoints || []).map((b) => ({
          ...b,
          verified: false,
        })),
      };
      return super.setBreakPointsRequest(response, args);
    }

    // TODO: Set breakpoints
    // const breakpointOffsets = (args.breakpoints || []).map((b) => {
    //   const line = textDocument.lineAt(b.line - 1);
    //   const offset = textDocument.offsetAt(line.range.end);
    //   return offset;
    // });

    // const breakpointValidationResult = await this._connection.setBreakpoints(
    //   breakpointOffsets
    // );

    // response.body = {
    //   breakpoints: (args.breakpoints || []).map((b, idx) => ({
    //     ...b,
    //     verified: breakpointValidationResult[idx],
    //   })),
    // };

    return super.setBreakPointsRequest(response, args);
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
    const body = await this._connection.stackTrace();
    for (const sf of body.stackFrames) {
      // Convert this from offset to line.. ugly! 🤯
      if (sf.line != 0) {
        const td = workspace.textDocuments.find(
          (t) => t.fileName === this.workflowPath
        );
        sf.line = (td?.positionAt(sf.line).line || -1) + 1;
      }
      sf.source = new Source(
        basename(this.workflowPath),
        this.convertClientPathToDebugger(this.workflowPath)
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
    this.awaitAndSendRequest(this._connection.variables(args), response);
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: ILaunchRequestArguments
  ) {
    // wait until configuration has finished (and configurationDoneRequest has been called)
    await this._configurationDone;

    this._connection.on("output", (line: string) => {
      this.sendEvent(new OutputEvent(`${line}\n`));
    });

    this._connection.on("end", () => {
      this.sendEvent(new TerminatedEvent());
    });

    this._connection.on("stopped", (reason: string) => {
      this.sendEvent(new StoppedEvent(reason, DEFAULT_THREAD));
    });

    this.sendResponse(response);

    await this._connection.launch();
  }

  private async awaitAndSendRequest<T extends DebugProtocol.Response>(
    p: Promise<T["body"]>,
    response: T
  ) {
    const body = await p;
    response.body = body;
    this.sendResponse(response);
  }

  private async readWorkflow(): Promise<string> {
    // Read workflow file
    const bytes = await workspace.fs.readFile(Uri.file(this.workflowPath));
    return Buffer.from(bytes).toString("utf8");
  }
}

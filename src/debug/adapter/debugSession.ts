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
import { getBreakpointStepOffsets } from "./breakpoints";

const DEFAULT_THREAD = 1;

export interface ActionsDebugConfiguration extends DebugConfiguration {
  workflow: string;

  jobId: string;

  address: string;

  port: number;
}

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  workflow: string;
}

/**
 * ActionsDebugSession interfaces with VS Code, it receives VS Code Debug Protocol
 * messages from VS Code, and maps them to requests to the RunnerConnection. It also
 * receives messages from the runner connection and maps them back to VS Code */
export class ActionsDebugSession extends LoggingDebugSession {
  private _configurationDone = new Promise((resolve) => {
    this._setConfigurationDone = resolve;
  });

  private _setConfigurationDone!: (value?: unknown) => void;

  private _connection: RunnerConnection;
  private workflowPath: string;
  private jobId: string;

  private _breakpointMapping: { [stepIdx: number]: number } = {};

  public constructor(private config: ActionsDebugConfiguration) {
    super();

    this.workflowPath = Uri.parse(this.config.workflow).fsPath;
    this.jobId = this.config.jobId;

    this._connection = createRunnerConnection();
  }

  protected async initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ) {
    // Connect to debugger server
    await this._connection.connect(this.config.address, this.config.port);

    // Hard-code the capabilities we return to VSCode for now
    response.body = response.body || {};
    response.body.supportsEvaluateForHovers = false;
    response.body.supportsConfigurationDoneRequest = true;

    // Return capabilities to VS Code
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  /** Received from VS Code after configuration (e.g., breakpoints are set, etc.) is done */
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

  protected async terminateRequest(
    response: DebugProtocol.TerminateResponse,
    args: DebugProtocol.TerminateArguments
  ) {
    await this._connection.terminate();

    return super.terminateRequest(response, args);
  }

  /**
   * Receive breakpoints from VS Code and send them to the runner
   */
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

    // Convert line numbers to offsets in the document
    const breakpointOffsets = (args.breakpoints || []).map((b) => {
      const line = textDocument.lineAt(b.line - 1);
      const offset = textDocument.offsetAt(line.range.end);
      return {
        offset,
        line: line.lineNumber,
      };
    });

    const { mapping, validationState } = await getBreakpointStepOffsets(
      this.workflowPath,
      textDocument.getText(),
      breakpointOffsets
    );

    // Only use breakpoints for the current job
    const currentJobBreakpoints = mapping[this.jobId];

    // Send breakpoints to runner
    await this._connection.setBreakpoints(
      currentJobBreakpoints.map((x) => x.stepIdx)
    );

    this._breakpointMapping = {};
    for (const x of mapping[this.jobId]) {
      this._breakpointMapping[x.stepIdx] = x.line + 1; // editor lines are 1-based
    }

    // Tell debugger which breakpoints are valid
    response.body = {
      breakpoints: (args.breakpoints || []).map((b, idx) => ({
        ...b,
        verified:
          validationState[idx].validStep &&
          validationState[idx].jobId === this.jobId,
      })),
    };

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
      // Map from step idx to line
      const stepIdx = sf.line;

      sf.line = this._breakpointMapping[stepIdx];

      // Make sure the workflow is highlighted as active file
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

  protected async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
    request?: DebugProtocol.Request
  ) {
    this.awaitAndSendRequest(this._connection.evaluate(args), response);
  }

  /** Received from VS Code after configurationDone handshake */
  protected async attachRequest(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments,
    request?: DebugProtocol.Request
  ) {
    // wait until configuration has finished (and configurationDoneRequest has been called)
    await this._configurationDone;

    // Setup connection handling
    this._connection.on("output", (line: string) => {
      this.sendEvent(new OutputEvent(`${line}\n`));
    });

    this._connection.on("terminated", () => {
      this.sendEvent(new TerminatedEvent());
    });

    this._connection.on("exited", () => {
      // TODO: Do we need the exited event?
      this.sendEvent(new TerminatedEvent());
    });

    this._connection.on("end", () => {
      this.sendEvent(new TerminatedEvent());
    });

    this._connection.on("stopped", (reason: string) => {
      this.sendEvent(new StoppedEvent(reason, DEFAULT_THREAD));
    });

    await this._connection.attach();

    response.success = true;

    this.sendResponse(response);
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

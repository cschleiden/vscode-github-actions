// Inspired by the VS Code Debug Adapter protocol implementation

import * as vscode from "vscode";

import { DebugProtocol } from "vscode-debugprotocol";
import { ProtocolServer } from "vscode-debugadapter/lib/protocol";

export class RunnerDebugProtocolServer extends ProtocolServer {
  private _channel: vscode.OutputChannel;

  constructor() {
    super();

    this._channel = vscode.window.createOutputChannel(
      "RunnerDebugProtocolServer"
    );
  }

  handleMessage(msg: DebugProtocol.ProtocolMessage): void {
    if (msg.type === "event") {
      const event: DebugProtocol.Event = msg as any;
      this.emit(event.event, event);
      this._channel.appendLine(`Received event ${event.event}`);
    } else {
      super.handleMessage(msg);
      this._channel.appendLine(`Received message ${msg.type}`);
    }
  }

  dispatchRequest(request: DebugProtocol.Request) {
    this.emit(request.command, request);
  }
}

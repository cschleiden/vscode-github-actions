// Inspired by the VS Code Debug Adapter protocol implementation

import { ProtocolServer } from "vscode-debugadapter/lib/protocol";
import { DebugProtocol } from "vscode-debugprotocol";

export class RunnerDebugProtocolServer extends ProtocolServer {
  handleMessage(msg: DebugProtocol.ProtocolMessage): void {
    if (msg.type === "event") {
      const event: DebugProtocol.Event = msg as any;
      this.emit(event.event, event);
    } else {
      super.handleMessage(msg);
    }
  }

  dispatchRequest(request: DebugProtocol.Request) {
    this.emit(request.command, request);
  }
}

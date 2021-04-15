import * as vscode from "vscode";

import {
  ActionsDebugConfiguration,
  ActionsDebugSession,
} from "./adapter/debugSession";

const factory: vscode.DebugAdapterDescriptorFactory = {
  createDebugAdapterDescriptor: (session) => {
    return new vscode.DebugAdapterInlineImplementation(
      new ActionsDebugSession(
        session.configuration as ActionsDebugConfiguration
      )
    );
  },
};

export function initDebugger(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.debug",
      (resource: vscode.Uri) => {
        vscode.debug.startDebugging(undefined, {
          type: "workflow",
          name: "Debug workflow",
          request: "launch",
          address: "127.0.0.1",
          port: 41085,
          workflow: resource.toString(),
          stopOnEntry: true,
        } as ActionsDebugConfiguration);
      }
    )
  );

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("workflow", factory)
  );
}

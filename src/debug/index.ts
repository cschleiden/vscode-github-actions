import * as vscode from "vscode";
import { RunnerDebugSession } from "./runner/debugSession";

const factory: vscode.DebugAdapterDescriptorFactory = {
  createDebugAdapterDescriptor: (_session) => {
    return new vscode.DebugAdapterInlineImplementation(
      new RunnerDebugSession()
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
          workflow: resource.toString(),
          stopOnEntry: true,
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("workflow", factory)
  );
}

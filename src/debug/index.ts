import * as vscode from "vscode";
import {
  RunnerDebugConfiguration,
  RunnerDebugSession,
} from "./runner/debugSession";

const factory: vscode.DebugAdapterDescriptorFactory = {
  createDebugAdapterDescriptor: (session) => {
    return new vscode.DebugAdapterInlineImplementation(
      new RunnerDebugSession(session.configuration as RunnerDebugConfiguration)
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

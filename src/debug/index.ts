import * as vscode from "vscode";

import {
  ActionsDebugConfiguration,
  ActionsDebugSession,
} from "./adapter/debugSession";

import { DebugCodeLensProvider } from "./codelensprovider";
import { WorkflowSelector } from "../workflow/diagnostics";

const factory: vscode.DebugAdapterDescriptorFactory = {
  createDebugAdapterDescriptor: (session) => {
    return new vscode.DebugAdapterInlineImplementation(
      new ActionsDebugSession(
        session.configuration as ActionsDebugConfiguration
      )
    );
  },
};

export interface DebugJobArguments {
  resource: vscode.Uri;

  jobId: string;
}

/** Register debugger with VS Code */
export function initDebugger(context: vscode.ExtensionContext) {
  // HACK: Add debug codelens
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      WorkflowSelector,
      new DebugCodeLensProvider()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.debug.job",
      ({ resource, jobId }: DebugJobArguments) => {
        // Start debug session
        vscode.debug.startDebugging(undefined, {
          type: "workflow",
          name: "Debug workflow job",
          request: "attach",
          address: "127.0.0.1",
          port: 41085,
          workflow: resource.toString(),
          jobId,
        } as ActionsDebugConfiguration);

        // Open terminal into work folder
        const terminal = vscode.window.createTerminal({
          cwd: "/Users/cschleiden/playground/debug-runner/_layout/_work",
          name: "Job workspace",
        });
        terminal.show(true);
      }
    )
  );

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("workflow", factory)
  );
}

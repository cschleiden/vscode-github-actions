import * as vscode from "vscode";

import {
  ActionsDebugConfiguration,
  ActionsDebugSession,
} from "./adapter/debugSession";

import { WorkflowSelector } from "../workflow/diagnostics";
import { DebugCodeLensProvider } from "./codelensprovider";

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
          address: "20.25.135.77",
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

  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
      const [ipQ, tokenQ] = uri.query.split("&");

      const [, ip] = ipQ.split("=");
      const [, token] = tokenQ.split("=");

      vscode.debug.startDebugging(undefined, {
        type: "workflow",
        name: "Debug workflow job",
        request: "attach",
        address: "20.25.135.77",
        port: 41085,
        workflow:
          "file:///Users/cschleiden/playground/debugger-test/.github/workflows/debug.yml",
        jobId: "build",
      } as ActionsDebugConfiguration);

      // Open terminal into work folder
      const terminal = vscode.window.createTerminal({
        name: "Runner Filesystem",
      });
      terminal.show(true);
      terminal.sendText("");
    },
  });
}

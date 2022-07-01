import * as vscode from "vscode";
import { GitHubRepoContext } from "../git/repository";
import { WorkflowRun } from "../model";

interface CancelWorkflowRunLogsCommandArgs {
  gitHubRepoContext: GitHubRepoContext;
  run: WorkflowRun;
}

export function registerCancelWorkflowRun(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.run.cancel",
      async (args: CancelWorkflowRunLogsCommandArgs) => {
        const gitHubContext = args.gitHubRepoContext;
        const run = args.run;

        try {
          await gitHubContext.client.actions.cancelWorkflowRun({
            owner: gitHubContext.owner,
            repo: gitHubContext.name,
            run_id: run.id,
          });
        } catch (e: any) {
          vscode.window.showErrorMessage(
            `Could not cancel workflow: '${e.message}'`
          );
        }

        vscode.commands.executeCommand("github-actions.explorer.refresh");
      }
    )
  );
}

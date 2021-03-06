import * as vscode from "vscode";

import { getWorkflowUri, parseWorkflow } from "../../workflow/workflow";

import { GitHubRepoContext } from "../../git/repository";
import { Workflow as ParsedWorkflow } from "github-actions-parser/dist/lib/workflow";
import { WorkflowNode } from "./workflowNode";

export class WorkflowsRepoNode extends vscode.TreeItem {
  constructor(public readonly gitHubRepoContext: GitHubRepoContext) {
    super(gitHubRepoContext.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = "wf-repo";
  }

  async getWorkflows(): Promise<WorkflowNode[]> {
    const result =
      await this.gitHubRepoContext.client.actions.listRepoWorkflows({
        owner: this.gitHubRepoContext.owner,
        repo: this.gitHubRepoContext.name,
      });

    const resp = result.data;
    const workflows = resp.workflows;

    workflows.sort((a, b) => a.name.localeCompare(b.name));

    return await Promise.all(
      workflows.map(async (wf) => {
        let parsedWorkflow: ParsedWorkflow | undefined;

        const workflowUri = getWorkflowUri(this.gitHubRepoContext, wf.path);
        if (workflowUri) {
          parsedWorkflow = await parseWorkflow(
            workflowUri,
            this.gitHubRepoContext
          );
        }

        return new WorkflowNode(this.gitHubRepoContext, wf, parsedWorkflow);
      })
    );
  }
}

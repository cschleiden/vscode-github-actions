import * as vscode from "vscode";

import { YAMLMapping } from "github-actions-parser/dist/types";
import { basename } from "path";
import { getGitHubContextForWorkspaceUri } from "../git/repository";
import { parse } from "github-actions-parser";

export class DebugCodeLensProvider implements vscode.CodeLensProvider {
  onDidChangeCodeLenses?: vscode.Event<void> | undefined;

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const text = document.getText();

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return [];
    }

    const gitHubRepoContext = await getGitHubContextForWorkspaceUri(
      workspaceFolder.uri
    );
    if (!gitHubRepoContext) {
      return [];
    }

    const workflowInput = Buffer.from(text).toString("utf-8");
    const doc = await parse(
      {
        ...gitHubRepoContext,
        repository: gitHubRepoContext.name,
      },
      basename(document.uri.fsPath),
      workflowInput
    );

    if (doc.workflowST.mappings) {
      const m = doc.workflowST.mappings as YAMLMapping[];

      const jobs = (
        m.find((x) => x.key && x.key.value === "jobs")?.value
          ?.mappings as YAMLMapping[]
      ).map((j) => ({
        id: j.key.value,
        pos: document.positionAt(j.startPosition),
      }));

      return jobs.map((j) => ({
        range: new vscode.Range(j.pos, j.pos),
        isResolved: true,
        command: {
          title: "Debug job",
          command: "github-actions.debug.job",
          arguments: [
            {
              resource: document.uri,
              jobId: j.id,
            },
          ],
        },
      }));
    }

    return [];
  }
}

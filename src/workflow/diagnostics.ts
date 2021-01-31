import * as vscode from "vscode";

import {
  complete,
  findNode,
  getPathFromNode,
  hover,
  parse,
  resolveCodeAction,
} from "github-actions-parser";

import { getGitHubContext } from "../git/repository";

const WorkflowSelector = {
  pattern: "**/.github/workflows/*.{yaml,yml}",
};

export function init(context: vscode.ExtensionContext) {
  // Register auto-complete
  vscode.languages.registerCompletionItemProvider(
    WorkflowSelector,
    new WorkflowCompletionItemProvider(),
    "."
  );

  // Register hover
  vscode.languages.registerHoverProvider(
    WorkflowSelector,
    new WorkflowHoverProvider()
  );

  // Code-Actions
  vscode.languages.registerCodeActionsProvider(
    WorkflowSelector,
    new WorkflowCodeActionProvider()
  );

  //
  // Provide diagnostics information
  //
  const collection = vscode.languages.createDiagnosticCollection(
    "github-actions"
  );
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document, collection);
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDiagnostics(editor.document, collection);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) =>
      updateDiagnostics(e.document, collection)
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri))
  );
}

async function updateDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): Promise<void> {
  if (
    document &&
    document.fileName.match("(.*)?.github/workflows/(.*).ya?ml")
  ) {
    collection.clear();

    const githubContext = await getGitHubContext();
    if (!githubContext) {
      return;
    }

    const result = await parse(
      {
        ...githubContext,
        repository: githubContext.name,
      },
      vscode.workspace.asRelativePath(document.uri),
      document.getText()
    );

    if (result.diagnostics.length > 0) {
      collection.set(
        document.uri,
        result.diagnostics.map((x) => ({
          severity: vscode.DiagnosticSeverity.Error,
          message: x.message,
          range: new vscode.Range(
            document.positionAt(x.pos[0]),
            document.positionAt(x.pos[1])
          ),
        }))
      );
    }
  } else {
    collection.clear();
  }
}

export class WorkflowHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<null | vscode.Hover> {
    try {
      const githubContext = await getGitHubContext();
      if (!githubContext) {
        return null;
      }

      const hoverResult = await hover(
        {
          ...githubContext,
          repository: githubContext.name,
        },
        vscode.workspace.asRelativePath(document.uri),
        document.getText(),
        document.offsetAt(position)
      );

      if (hoverResult?.description) {
        return {
          contents: [hoverResult?.description],
        };
      }
    } catch (e) {
      // TODO: CS: handle
    }

    return null;
  }
}

export class WorkflowCompletionItemProvider
  implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    cancellationToken: vscode.CancellationToken
  ): Promise<vscode.CompletionItem[]> {
    try {
      const githubContext = await getGitHubContext();
      if (!githubContext) {
        return [];
      }

      const completionResult = await complete(
        {
          ...githubContext,
          repository: githubContext.name,
        },
        vscode.workspace.asRelativePath(document.uri),
        document.getText(),
        document.offsetAt(position)
      );

      if (completionResult.length > 0) {
        return completionResult.map((x) => {
          const completionItem = new vscode.CompletionItem(
            x.value,
            vscode.CompletionItemKind.Constant
          );

          if (x.description) {
            completionItem.documentation = new vscode.MarkdownString(
              x.description
            );
          }

          return completionItem;
        });
      }
    } catch (e) {
      // Ignore error
      return [];
    }

    return [];
  }
}

export interface WorkflowCodeAction extends vscode.CodeAction {}

export class WorkflowCodeActionProvider
  implements vscode.CodeActionProvider<WorkflowCodeAction> {
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<WorkflowCodeAction[] | undefined> {
    const githubContext = await getGitHubContext();
    if (!githubContext) {
      return;
    }

    const result = await parse(
      {
        ...githubContext,
        repository: githubContext.name,
      },
      vscode.workspace.asRelativePath(document.uri),
      document.getText()
    );

    const currentNode = findNode(
      result.workflowST,
      document.offsetAt(range.start)
    );
    if (currentNode) {
      console.log(currentNode);

      const desc = result.nodeToDesc.get(currentNode);
      console.log(desc);
      if (desc?.codeActionsProvider) {
        return desc.codeActionsProvider.provideCodeActions(
          document.uri.toString(),
          range,
          desc,
          result.workflow,
          getPathFromNode(currentNode as any)
        ) as any;
      }
    }

    return [];
  }

  async resolveCodeAction(
    codeAction: WorkflowCodeAction,
    token: vscode.CancellationToken
  ): Promise<WorkflowCodeAction | null | undefined> {
    const githubContext = await getGitHubContext();
    if (!githubContext) {
      return;
    }

    const r = await resolveCodeAction(
      {
        ...githubContext,
        repository: githubContext.name,
      },
      codeAction as any
    );

    if (!r) {
      return null;
    }

    const e = new vscode.WorkspaceEdit();
    for (const x of Object.keys(r.edit!.changes!)) {
      e.replace(
        vscode.Uri.parse(x),
        r.edit!.changes![x][0].range as vscode.Range,
        r.edit!.changes![x][0].newText
      );
    }

    // e.replace(
    //   vscode.window.activeTextEditor!.document.uri,
    //   vscode.window.activeTextEditor!.selection,
    //   "test"
    // );

    r.edit = e as any;

    return r as any;
  }
}

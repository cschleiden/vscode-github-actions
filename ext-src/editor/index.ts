import * as vscode from "vscode";

export const WorkflowDocumentSelector: vscode.DocumentSelector = {
  pattern: ".github/workflows(-lab)?/*.{yml,yaml}",
  language: "yaml",
};

export function init(context: vscode.ExtensionContext) {
  vscode.languages.registerDocumentHighlightProvider(WorkflowDocumentSelector);
}

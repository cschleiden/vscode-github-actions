import * as vscode from "vscode";
import { BaseReactPanel } from "./baseReactPanel";

export class WorkflowPreview extends BaseReactPanel {
  constructor(
    extensionPath: string,
    column: vscode.ViewColumn,
    private workflowFilename: string
  ) {
    super(extensionPath);

    this.showPanel(column);
  }

  protected getTitle(): string {
    return `Preview ${this.workflowFilename}`;
  }

  public update(workflowFilePath: string, workflow: string) {
    this._panel.webview.postMessage({
      command: "update",
      workflow,
      workflowFilePath,
    });
  }
}

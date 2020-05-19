import { BaseReactPanel } from "./baseReactPanel";

export class WorkflowPreview extends BaseReactPanel {
  protected getTitle(): string {
    return "Preview";
  }

  protected getRoute(): string {
    return "preview";
  }

  public update(workflow: string) {
    this._panel.webview.postMessage({
      command: "update",
      workflow,
    });
  }
}

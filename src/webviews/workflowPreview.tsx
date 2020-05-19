import { BaseReactPanel } from "./baseReactPanel";

export class WorkflowPreview extends BaseReactPanel {
  protected getTitle(): string {
    return "Preview";
  }
  protected getRoute(): string {
    return "Route";
  }
}

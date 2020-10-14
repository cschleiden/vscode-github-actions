import { Workflow } from "github-actions-parser/dist/lib/workflow";

export interface JobDescription {
  id: string;
}

export interface LocalPlan {
  jobs: JobDescription[];
}

export function buildPlan(workflow: Workflow): LocalPlan {
  // TODO: We should order, for now just take the order in the map
  return {
    jobs: Object.keys(workflow.jobs).map((j) => ({
      id: j,
    })),
  };
}

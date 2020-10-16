import { Job, Workflow } from "github-actions-parser/dist/lib/workflow";
import { buildJobMessage, JobRequestMessage } from "./message";

export interface JobDescription {
  id: string;

  job: Job;
}

export interface LocalPlan {
  jobs: JobDescription[];
}

export function buildPlan(workflow: Workflow): LocalPlan {
  // TODO: We should order, for now just take the order in the map
  return {
    jobs: Object.keys(workflow.jobs).map((j) => ({
      id: j,
      job: workflow.jobs[j],
    })),
  };
}

export type JobExecution = {
  jobId: string;
  message: JobRequestMessage;
};

export function jobGenerator(
  fileName: string,
  jobDesc: JobDescription
): JobExecution[] {
  if (!jobDesc.job.strategy?.matrix) {
    return [
      {
        jobId: jobDesc.id,
        message: buildJobMessage(fileName, jobDesc.id, jobDesc.job, {}),
      },
    ];
  }

  const res: JobExecution[] = [];

  // Evaluate matrix
  let matrixJobs: { [key: string]: string | number | boolean }[] = [];
  const matrix = jobDesc.job.strategy.matrix;

  for (const matrixKey of Object.keys(matrix)) {
    let dim: any[] = matrix[matrixKey];
    if (!Array.isArray(dim)) {
      dim = [dim];
    }

    if (matrixJobs.length === 0) {
      // First iteration
      matrixJobs = dim.map((v) => ({
        [matrixKey]: v,
      }));
    } else {
      const temp: any[] = [];

      for (const matrixValue of dim) {
        for (const existing of matrixJobs) {
          temp.push({
            ...existing,
            [matrixKey]: matrixValue,
          });
        }
      }

      matrixJobs = temp;
    }
  }

  // Builds jobs
  for (const m of matrixJobs) {
    const jobName = `${jobDesc.job.name || jobDesc.id} (${Object.keys(m)
      .map((x) => m[x])
      .join(",")})`;

    res.push({
      jobId: jobDesc.id, // Need to keep the id here for breakpoints.. does that interfere with other feaures?
      message: buildJobMessage(
        fileName,
        jobDesc.id,
        {
          ...jobDesc.job,
          name: jobName,
        },
        {
          matrix: m,
        }
      ),
    });
  }

  return res;
}

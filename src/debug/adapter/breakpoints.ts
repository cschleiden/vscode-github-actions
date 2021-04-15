import { parse } from "github-actions-parser";
import { Context, YAMLSequence } from "github-actions-parser/dist/types";
import { findNode, Kind } from "../external/findNode";

export type BreakPointsByJob = {
  [jobId: string]: { stepIdx: number; offset: number }[];
};

export async function getBreakpointStepOffsets(
  workflowFileName: string,
  workflowContent: string,
  offsets: number[]
): Promise<{
  validationState: boolean[];
  mapping: BreakPointsByJob;
}> {
  // Parse workflow
  const workflow = await parse(
    {} as Context,
    workflowFileName,
    workflowContent
  );
  if (!workflow.workflow) {
    throw new Error("Could not parse workflow");
  }

  let breakpointStepIndexesByJob: BreakPointsByJob = {};

  const validationState: boolean[] = [];
  for (const offset of offsets) {
    // Try to figure out if this
    let node = findNode(workflow.workflowST, offset);
    if (!node) {
      validationState.push(false);
      continue;
    }

    // We need to find the element that has a SEQ parent, which has a Mapping parent with a `steps` key
    let success = false;
    while (!!node && !!node.parent) {
      if (
        node.parent?.kind === Kind.SEQ &&
        node.parent?.parent?.key?.value === "steps"
      ) {
        // Found our node
        success = true;
        break;
      }

      node = node.parent;
    }

    if (!success) {
      validationState.push(false);
      continue;
    }

    // Get step index
    const step = node;
    const stepIdx = (node.parent as YAMLSequence).items.indexOf(step);
    if (stepIdx === -1) {
      validationState.push(false);
      continue;
    }

    // Get job id
    const jobId: string = node.parent?.parent?.parent?.parent?.key?.value; // Sequence // Steps mapping // Map // Mapping
    if (!jobId) {
      validationState.push(false);
      continue;
    }

    breakpointStepIndexesByJob[jobId] = [
      ...(breakpointStepIndexesByJob[jobId] || []),
      {
        stepIdx,
        offset,
      },
    ];

    validationState.push(true);
  }

  return {
    mapping: breakpointStepIndexesByJob,
    validationState,
  };
}

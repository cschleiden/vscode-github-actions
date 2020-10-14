import { Job, Step } from "github-actions-parser/dist/lib/workflow";
import { v4 as uuidv4 } from "uuid";

// See: https://github.com/actions/runner/blob/c8afc848403652f31f84eb362fc0696ee23cffca/src/Sdk/DTObjectTemplating/ObjectTemplating/Tokens/TokenType.cs#L5
enum TokenType {
  String = 0,
  Sequence = 1,
  Mapping = 2,
  BasicExpression = 3,
  InsertExpression = 4,
  Boolean = 5,
  Number = 6,
  Null = 7,
}

type TokenLineInformation = {
  file: number;
  line: number;
  col: number;
};

type StringToken = {
  type: TokenType.String;

  lit: string;
};

type ExpressionToken = {
  type: TokenType.BasicExpression;

  expr: string;
};

export type Token = TokenLineInformation & (StringToken | ExpressionToken);

export interface StepReference {
  type: "script";
}

export interface JobRequestStep {
  type: "action";

  reference: StepReference;

  name: string;

  /** Guid */
  id: string;

  condition: "success()";

  inputs: {
    // Not sure what this is
    type: 2;

    map: {
      key: string;
      value: Token;
    }[];
  };
}

export function buildJobMessage(
  fileName: string,
  jobId: string,
  job: Job
): JobRequestMessage {
  return {
    fileTable: [fileName],

    mask: [],

    steps: job.steps.map((step) => buildStep(step)),

    variables: {},

    messageType: "PipelineAgentJobRequest",

    plan: {},

    timeline: {},

    // TODO: Generate...
    jobId: "ca395085-040a-526b-2ce8-bdc85f692774",

    jobDisplayName: job.name || jobId,

    // TODO: Use factory
    jobName: "__default",

    requestId: 42,

    lockedUntil: "0001-01-01T00:00:00",

    resources: {
      endpoints: [
        {
          data: {
            ServerId: "feafd86c-6014-4cc6-888e-bd11e207f0d7",
            ServerName: "does-not-exist",
            CacheServerUrl:
              "https://artifactcache.actions.githubusercontent.com/does-not-exist",
          },
          name: "SystemVssConnection",
          url: "https://pipelines.actions.githubusercontent.com/does-not-exist",
          authorization: {
            parameters: {
              AccessToken: "access-token",
            },
            scheme: "OAuth",
          },
          isShared: false,
          isReady: true,
        },
      ],
    },

    contextData: {
      github: {
        t: 2,
        d: buildContextDict({
          ref: "refs/heads/master",
          repository: "cschleiden/local-test",
          event: "workflow_dispatch",
        }),
      },
      env: {},
    },
  };
}

function buildContextDict(map: {
  [key: string]: string;
}): {
  k: string;
  v: string;
}[] {
  return Object.keys(map).map((k) => ({
    k,
    v: map[k],
  }));
}

function buildStep(step: Step): JobRequestStep {
  if ("run" in step) {
    return {
      type: "action",
      reference: {
        type: "script",
      },
      name: step.name || step.id || uuidv4(),
      id: uuidv4(),
      condition: "success()",
      inputs: {
        type: 2,
        map: [
          {
            key: "script",
            value: buildScriptToken(step.run),
          },
        ],
      },
    };
  }

  throw new Error("Not implemented");
}

function buildScriptToken(run: string): Token {
  const inf = {
    file: 1,
    line: 0,
    col: 0,
  };

  const exprMatches = run.match(/\${{(.*)}}/g);
  if (!exprMatches || exprMatches.length === 0) {
    return {
      ...inf,
      type: TokenType.String,
      lit: run,
    };
  }

  const args: string[] = [];
  const newRun = run.replace(/\${{(.*)}}/g, (_, token: string) => {
    const idx = args.length;
    args.push(token.trim());
    return `{${idx}}`;
  });

  return {
    ...inf,
    type: TokenType.BasicExpression,
    expr: `format('${newRun}', ${args.join(",")})`,
  };
}

export interface JobRequestMessage {
  fileTable: string[];

  mask: {
    type: string;
    value: string;
  }[];

  steps: JobRequestStep[];

  variables: { [key: string]: { value: string } };

  messageType: "PipelineAgentJobRequest";

  plan: JobRequestPlan;

  timeline: any;

  jobId: string;

  jobDisplayName: string;

  jobName: string;

  requestId: number;

  lockedUntil: string;

  resources: {
    endpoints: any[];
  };

  contextData: {
    [key in "github" | "needs" | "matrix" | "strategy"]?: {
      t: 2;
      d: { k: string; v: boolean | string | number }[];
    };
  };
}

export interface JobRequestPlan {}

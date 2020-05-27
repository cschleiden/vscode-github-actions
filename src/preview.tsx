import {
  Event,
  parse,
  run,
  RuntimeModel,
  WorkflowExecution,
} from "github-actions-interpreter";
import * as React from "react";
import "./styles.css";

export default () => {
  const [workflowFilePath, setWorkflowFilePath] = React.useState("");
  const [workflow, setWorkflow] = React.useState("");

  React.useEffect(() => {
    // Handle the message inside the webview
    window.addEventListener("message", (event) => {
      const message = event.data; // The JSON data our extension sent

      switch (message.command) {
        case "update":
          setWorkflow(message.workflow);
          setWorkflowFilePath(message.workflowFilePath);
          break;
      }
    });
  }, []);

  const e: Event = {
    event: "push",
  };
  let r: RuntimeModel | undefined;

  try {
    const parsedWorkflow = parse(workflow);
    r = run(e, workflowFilePath, parsedWorkflow);
  } catch (e) {
    console.log(e);
  }

  return (
    <div>
      {r && <WorkflowExecution id={42} events={[e]} executionModel={r} />}
    </div>
  );
};

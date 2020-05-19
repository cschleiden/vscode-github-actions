import * as React from "react";
import "./preview.css";

export default () => {
  const [foo, setFoo] = React.useState(1);
  const [workflow, setWorkflow] = React.useState("wf");

  React.useEffect(() => {
    // Handle the message inside the webview
    window.addEventListener("message", (event) => {
      const message = event.data; // The JSON data our extension sent

      switch (message.command) {
        case "update":
          setWorkflow(message.workflow);
          break;
      }
    });
  }, []);

  return (
    <div>
      Hello world!
      {foo}
      <button onClick={() => setFoo(foo + 1)}>Test</button>
      <code>{workflow}</code>
    </div>
  );
};

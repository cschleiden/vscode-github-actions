import * as React from "react";
import * as ReactDOM from "react-dom";
// import { Router } from "./webviews/router";
import "./webviews/preview/preview.css";

const route: string = (document.getElementById(
  "route"
) as HTMLMetaElement).getAttribute("value")!;

/** Render router component with a loading indicator as fallback */
ReactDOM.render(
  <React.Suspense fallback={"Loading..."}>
    {/* <Router route={route} /> */}
    <p>Hello world</p>
  </React.Suspense>,
  document.getElementById("root") as HTMLElement
);

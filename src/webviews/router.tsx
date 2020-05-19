import * as React from "react";

const Preview = React.lazy(() => import("./preview/preview"));

export const Router: React.FC<{ route: string }> = ({ route }) => {
  switch (route) {
    case "preview":
      return <Preview />;
    default:
      throw new Error("Unknown route");
  }
};

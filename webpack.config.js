"use strict";

const path = require("path");

const config = {
  target: "node",

  entry: "./ext-src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]"
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode"
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "universal-user-agent$": "universal-user-agent/dist-node/index.js"
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.extension.json"
            }
          }
        ]
      },
      {
        test: /\.node$/,
        use: "node-loader"
      }
    ]
  }
};
module.exports = config;

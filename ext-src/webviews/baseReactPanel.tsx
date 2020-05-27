import { readFileSync } from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Based on https://github.com/rebornix/vscode-webview-react/
 */
export abstract class BaseReactPanel {
  public static currentPanel: BaseReactPanel | undefined;

  private static readonly viewType = "github-actions.view";

  protected _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  protected abstract getTitle(): string;

  public static createOrShow<TPanel extends BaseReactPanel>(
    Panel: new (
      extensionPath: string,
      column: vscode.ViewColumn,
      ...args: any[]
    ) => TPanel,
    extensionPath: string,
    ...args: any[]
  ) {
    // If we already have a panel, show it.
    // Otherwise, create a new panel.
    if (BaseReactPanel.currentPanel) {
      BaseReactPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
    } else {
      BaseReactPanel.currentPanel = new Panel(
        extensionPath,
        vscode.ViewColumn.Beside,
        ...args
      );
    }
  }

  constructor(private extensionPath: string) {}

  protected showPanel(column: vscode.ViewColumn) {
    // Create and show a new webview panel
    this._panel = vscode.window.createWebviewPanel(
      BaseReactPanel.viewType,
      this.getTitle(),
      column,
      {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
          vscode.Uri.file(path.join(this.extensionPath, "build")),
        ],
      }
    );

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    BaseReactPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getHtmlForWebview() {
    const m = readFileSync(
      path.join(this.extensionPath, "build", "asset-manifest.json"),
      "utf-8"
    );
    const manifest = JSON.parse(m);
    const mainScript = manifest["files"]["main.js"];
    const mainStyle = manifest["files"]["main.css"];

    const scriptPathOnDisk = vscode.Uri.file(
      path.join(this.extensionPath, "build", mainScript)
    );
    const scriptUri = scriptPathOnDisk.with({ scheme: "vscode-resource" });
    const stylePathOnDisk = vscode.Uri.file(
      path.join(this.extensionPath, "build", mainStyle)
    );
    const styleUri = stylePathOnDisk.with({ scheme: "vscode-resource" });

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
        <meta name="theme-color" content="#000000">
				<title>GitHub Actions</title>

        <link rel="stylesheet" type="text/css" href="${styleUri}">
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src data: vscode-resource: https:; script-src 'nonce-${nonce}' 'unsafe-eval';style-src vscode-resource: 'unsafe-inline' http: https: data:;">
				<base href="${vscode.Uri.file(path.join(this.extensionPath, "build")).with({
          scheme: "vscode-resource",
        })}/">
			</head>

			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

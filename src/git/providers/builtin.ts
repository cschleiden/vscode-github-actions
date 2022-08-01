import * as vscode from "vscode";
import { Uri } from "vscode";
import { log, logDebug } from "../../log";
import { API, GitExtension } from "../../typings/git";
import { GitInformationProvider, Repository } from "../provider";

export class BuiltinGitInformationProvider implements GitInformationProvider {
  async getRepository(
    workspaceFolderUri: Uri
  ): Promise<Repository | undefined> {
    const git = await this.getExtension();
    if (!git) {
      logDebug("Could not get built-in git extension");
      return undefined;
    }

    const repo = git.getRepository(workspaceFolderUri);
    if (!repo) {
      log("Could not get repository for", workspaceFolderUri.toString());
      return undefined;
    }

    return {};
  }

  private async getExtension(): Promise<API | undefined> {
    logDebug(vscode.workspace.workspaceFolders![0].uri.toString());

    const gitExtension =
      vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (gitExtension) {
      if (!gitExtension.isActive) {
        logDebug("Activating git extension...");
        await gitExtension.activate();
        logDebug("done...");
      }

      logDebug("Getting git extension API...");
      const git = gitExtension.exports.getAPI(1);

      if (git.state !== "initialized") {
        // Wait for the plugin to be initialized
        await new Promise<void>((resolve) => {
          if (git.state === "initialized") {
            resolve();
          } else {
            const listener = git.onDidChangeState((state) => {
              if (state === "initialized") {
                resolve();
              }
              listener.dispose();
            });
          }
        });
      }

      return git;
    }

    logDebug("Git extension not found");
    return undefined;
  }
}

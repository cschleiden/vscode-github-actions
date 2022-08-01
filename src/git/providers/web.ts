import * as vscode from "vscode";
import { log, logDebug } from "../../log";
import { GitInformationProvider, Repository } from "../provider";

interface Provider {
  readonly id: "github" | "azdo";
  readonly name: string;
}

enum HeadType {
  Branch = 0,
  RemoteBranch = 1,
  Tag = 2,
  Commit = 3,
}

interface Metadata {
  readonly provider: Provider;
  readonly repo: { owner: string; name: string } & Record<string, unknown>;
  getRevision(): Promise<{ type: HeadType; name: string; revision: string }>;
}

interface RemoteApi {
  getMetadata(uri: vscode.Uri): Promise<Metadata | undefined>;

  loadWorkspaceContents?(workspaceUri: vscode.Uri): Promise<boolean>;
}

export class WebGitInformationProvider implements GitInformationProvider {
  private rre: RemoteApi | undefined;

  async init() {
    const rre: vscode.Extension<RemoteApi> | undefined =
      vscode.extensions.getExtension("ms-vscode.remote-repositories");
    if (!rre) {
      throw new Error("could not get remote repo extension");
    }

    // Ensure extension is activated
    if (!rre.isActive) {
      this.rre = await rre.activate();
    } else {
      this.rre = rre.exports;
    }
  }

  async getRepository(
    workspaceFolderUri: vscode.Uri
  ): Promise<Repository | undefined> {
    if (!this.rre) {
      throw new Error("remote repo extension not initialized");
    }

    const mt = await this.rre.getMetadata(workspaceFolderUri);

    if (!mt) {
      log(
        "Could not find repository metadata for",
        workspaceFolderUri.toString()
      );
      return undefined;
    }

    if (mt.provider.id != "github") {
      log(
        "Repository provider is not github",
        workspaceFolderUri.toString(),
        mt.provider.id
      );

      return undefined;
    }

    var currentBranch: string | undefined;

    const rev = await mt.getRevision();
    if (rev.type === HeadType.Branch) {
      currentBranch = rev.name;
    } else {
      logDebug(
        "Current rev is not a branch",
        workspaceFolderUri.toString(),
        rev.name,
        HeadType[rev.type]
      );
    }

    return {
      name: mt.repo.name,
      owner: mt.repo.owner,
      remotes: [
        {
          name: "origin", // Generate dummy remote here
          url: `https://github.com/${mt.repo.owner}/${mt.repo.name}`,
        },
      ],
      currentBranch,
    };
  }
}

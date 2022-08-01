import * as vscode from "vscode";
import { BuiltinGitInformationProvider } from "./providers/builtin";
import { WebGitInformationProvider } from "./providers/web";

export interface RemoteInfo {
  name: string;
  url: string;
}

export interface Repository {
  owner: string;
  name: string;
  remotes: RemoteInfo[];

  currentBranch?: string;
}

export interface GitInformationProvider {
  getRepository(
    workspaceFolderUri: vscode.Uri
  ): Promise<Repository | undefined>;
}

export async function getGitInformationProvider(): Promise<GitInformationProvider> {
  switch (vscode.env.uiKind) {
    case vscode.UIKind.Desktop:
      return new BuiltinGitInformationProvider();

    case vscode.UIKind.Web:
      return new WebGitInformationProvider();

    default:
      throw new Error("Unknown UI kind");
  }
}

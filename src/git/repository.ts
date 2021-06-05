import * as vscode from "vscode";

import { API, GitExtension, RefType } from "../typings/git";

import { Octokit } from "@octokit/rest";
import { Protocol } from "../external/protocol";
import { flatten } from "../utils/array";
import { getClient } from "../api/api";
import { getSession } from "../auth/auth";

import {
  getManagedRepository
} from "../configuration/configuration";
import { removeListener } from "node:process";

async function getGitExtension(): Promise<API | undefined> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>(
    "vscode.git"
  );
  if (gitExtension) {
    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }
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
}

export async function getGitHead(): Promise<string | undefined> {
  const git = await getGitExtension();
  if (git && git.repositories.length > 0) {
    
    const head = git.repositories[git.repositories.length-1].state.HEAD;
    if (head && head.name && head.type === RefType.Head) {
      return `refs/heads/${head.name}`;
    }
  }
}

export async function getGitHubUrl(): Promise<string | null> {
  const git = await getGitExtension();
  const managedRepository = getManagedRepository();

  if (git && git.repositories.length > 0) {
    // To keep it very simple for now, look for the first remote in the current workspace that is a
    // github.com remote. This will be the repository for the workflow explorer.
    
    let tmp;
    if (managedRepository.length != 0) {
      tmp = flatten(
        git.repositories.map((r) =>
          
        
        r.state.remotes.filter((remote) => (remote.name === "origin" && remote.fetchUrl?.endsWith(managedRepository)))
        )
      );
    } else {
      tmp = flatten(
        git.repositories.map((r) =>
          r.state.remotes.filter((remote) => (remote.name === "origin"))
        ))
    }
    const originRemotes = tmp;

    const githubRemotes = originRemotes.filter(
      (x) => x.pushUrl?.indexOf("github.com") !== -1
    );
    if (githubRemotes.length > 0) {
      return githubRemotes[0].pushUrl!;
    }
  }

  return null;
}

export async function getGitHubProtocol(): Promise<Protocol | null> {
  const url = await getGitHubUrl();

  if (url) {
    return new Protocol(url);
  }

  return null;
}

export interface GitHubContext {
  client: Octokit;

  owner: string;
  name: string;

  defaultBranch: string;

  ownerIsOrg: boolean;
  orgFeaturesEnabled?: boolean;
}

let gitHubContext: Promise<GitHubContext | undefined> | undefined;

export async function getGitHubContext(): Promise<GitHubContext | undefined> {
  if (!gitHubContext) {
    gitHubContext = (async (): Promise<GitHubContext | undefined> => {
      try {
        const session = await getSession();

        const protocolInfo = await getGitHubProtocol();
        if (!protocolInfo) {
          return undefined;
        }

        const client = getClient(session.accessToken);
        const repoInfo = await client.repos.get({
          repo: protocolInfo.repositoryName,
          owner: protocolInfo.owner,
        });

        return {
          client,
          name: protocolInfo.repositoryName,
          owner: protocolInfo.owner,
          defaultBranch: `refs/heads/${repoInfo.data.default_branch}`,
          ownerIsOrg: repoInfo.data.owner?.type === "Organization",
          orgFeaturesEnabled:
            session.scopes.find((x) => x.toLocaleLowerCase() === "admin:org") !=
            null,
        };
      } catch (e) {
        // Reset the context so the next attempt will try this flow again
        gitHubContext = undefined;

        // Rethrow original error
        throw e;
      }
    })();
  }

  return gitHubContext;
}

export async function resetGitHubContext() {
  gitHubContext = undefined;
  await getGitHubContext();
}

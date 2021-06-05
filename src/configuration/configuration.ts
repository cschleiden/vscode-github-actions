import * as vscode from "vscode";

const settingsKey = "github-actions";

export function initConfiguration(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(getSettingsKey("workflows.pinned"))) {
        pinnedWorkflowsChangeHandlers.forEach((h) => h());
      }
    })
  );
}

function getConfiguration() {
  return vscode.workspace.getConfiguration();
}

function getSettingsKey(settingsPath: string): string {
  return `${settingsKey}.${settingsPath}`;
}

const pinnedWorkflowsChangeHandlers: (() => void)[] = [];
export function onPinnedWorkflowsChange(handler: () => void) {
  pinnedWorkflowsChangeHandlers.push(handler);
}

export function getPinnedWorkflows(): string[] {
  return getConfiguration().get<string[]>(
    getSettingsKey("workflows.pinned.workflows"),
    []
  );
}

export function getManagedRepository(): string {
  return getConfiguration().get<string>(
    getSettingsKey("managed.repository"),
    ""
  );
}

export function isPinnedWorkflowsRefreshEnabled(): boolean {
  return getConfiguration().get<boolean>(
    getSettingsKey("workflows.pinned.refresh.enabled"),
    false
  );
}

export function pinnedWorkflowsRefreshInterval(): number {
  return getConfiguration().get<number>(
    getSettingsKey("workflows.pinned.refresh.interval"),
    60
  );
}

export function orgFeaturesEnabled(): boolean {
  return getConfiguration().get<boolean>(getSettingsKey("org-features"), false);
}

export async function updateOrgFeaturesEnabled(enabled: boolean) {
  await getConfiguration().update(
    getSettingsKey("org-features"),
    enabled,
    true
  );
}

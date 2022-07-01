import * as vscode from "vscode";

import { init as initLogger, log, logDebug } from "./log";

import { CurrentBranchTreeProvider } from "./treeViews/currentBranch";
import { LogScheme } from "./logs/constants";
import { SettingsTreeProvider } from "./treeViews/settings";
import { WorkflowStepLogFoldingProvider } from "./logs/foldingProvider";
import { WorkflowStepLogProvider } from "./logs/fileProvider";
import { WorkflowStepLogSymbolProvider } from "./logs/symbolProvider";
import { WorkflowsTreeProvider } from "./treeViews/workflows";
import { getGitHubContext } from "./git/repository";
import { init } from "./workflow/diagnostics";
import { initConfiguration } from "./configuration/configuration";
import { initPinnedWorkflows } from "./pinnedWorkflows/pinnedWorkflows";
import { initResources } from "./treeViews/icons";
import { initWorkflowDocumentTracking } from "./tracker/workflowDocumentTracker";
import { registerAddSecret } from "./commands/secrets/addSecret";
import { registerCancelWorkflowRun } from "./commands/cancelWorkflowRun";
import { registerCopySecret } from "./commands/secrets/copySecret";
import { registerDeleteSecret } from "./commands/secrets/deleteSecret";
import { registerManageOrgSecrets } from "./commands/secrets/manageOrgSecrets";
import { registerOpenWorkflowFile } from "./commands/openWorkflowFile";
import { registerOpenWorkflowRun } from "./commands/openWorkflowRun";
import { registerOpenWorkflowRunLogs } from "./commands/openWorkflowRunLogs";
import { registerOrgLogin } from "./commands/orgLogin";
import { registerPinWorkflow } from "./commands/pinWorkflow";
import { registerReRunWorkflowRun } from "./commands/rerunWorkflowRun";
import { registerTriggerWorkflowRun } from "./commands/triggerWorkflowRun";
import { registerUnPinWorkflow } from "./commands/unpinWorkflow";
import { registerUpdateSecret } from "./commands/secrets/updateSecret";

export function activate(context: vscode.ExtensionContext) {
  initLogger();
  log("Activating GitHub Actions extension...");

  // Prefetch git repository origin url
  getGitHubContext();

  initResources(context);

  initConfiguration(context);
  initPinnedWorkflows(context);

  // Track workflow
  initWorkflowDocumentTracking(context);

  //
  // Tree views
  //

  const workflowTreeProvider = new WorkflowsTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "github-actions.workflows",
      workflowTreeProvider
    )
  );

  const settingsTreeProvider = new SettingsTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "github-actions.settings",
      settingsTreeProvider
    )
  );

  const currentBranchTreeProvider = new CurrentBranchTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "github-actions.current-branch",
      currentBranchTreeProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("github-actions.explorer.refresh", () => {
      workflowTreeProvider.refresh();
      settingsTreeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.explorer.current-branch.refresh",
      () => {
        currentBranchTreeProvider.refresh();
      }
    )
  );

  (async () => {
    const context = await getGitHubContext();
    if (!context) {
      logDebug("Could not register branch change event handler");
      return;
    }

    for (const repo of context.repos) {
      let currentAhead = repo.repositoryState.HEAD?.ahead;
      let currentHeadName = repo.repositoryState.HEAD?.name;
      repo.repositoryState.onDidChange(() => {
        // When the current head/branch changes, or the number of commits ahead changes (which indicates
        // a push), refresh the current-branch view
        if (
          repo.repositoryState.HEAD?.name !== currentHeadName ||
          (repo.repositoryState.HEAD?.ahead || 0) < (currentAhead || 0)
        ) {
          currentHeadName = repo.repositoryState.HEAD?.name;
          currentAhead = repo.repositoryState.HEAD?.ahead;
          currentBranchTreeProvider.refresh();
        }
      });
    }
  })();

  //
  // Commands
  //

  registerOpenWorkflowRun(context);
  registerOpenWorkflowFile(context);
  registerOpenWorkflowRunLogs(context);
  registerTriggerWorkflowRun(context);
  registerReRunWorkflowRun(context);
  registerCancelWorkflowRun(context);

  registerManageOrgSecrets(context);
  registerAddSecret(context);
  registerDeleteSecret(context);
  registerCopySecret(context);
  registerUpdateSecret(context);

  registerOrgLogin(context);

  registerPinWorkflow(context);
  registerUnPinWorkflow(context);

  //
  // Log providers
  //
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      LogScheme,
      new WorkflowStepLogProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { scheme: LogScheme },
      new WorkflowStepLogFoldingProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      {
        scheme: LogScheme,
      },
      new WorkflowStepLogSymbolProvider()
    )
  );

  //
  // Editing features
  //
  init(context);

  log("...initialized");
}

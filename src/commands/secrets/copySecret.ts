import * as vscode from 'vscode'
import {GitHubRepoContext} from '../../git/repository'
import {EnvironmentSecret, OrgSecret, RepoSecret} from '../../model'

interface CopySecretCommandArgs {
  gitHubRepoContext: GitHubRepoContext
  secret: RepoSecret | OrgSecret | EnvironmentSecret
}

export function registerCopySecret(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('github-actions.settings.secret.copy', async (args: CopySecretCommandArgs) => {
      const {secret} = args

      vscode.env.clipboard.writeText(secret.name)

      vscode.window.setStatusBarMessage(`Copied ${secret.name}`, 2000)
    }),
  )
}

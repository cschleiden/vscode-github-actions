# Change Log

All notable changes to the "vscode-github-actions" extension will be documented in this file.

## [v0.24.3]

- Fix https://github.com/cschleiden/vscode-github-actions/issues/111

## [v0.24.0]

- New "Current Branch" view

## [v0.23.0]

- Various bug fixes and schema updates

## [v0.22.0]

- Fix changes in repositories API

## [v0.21.2]

- Remove duplicate trigger run button

## [v0.21.0]

- Support github.dev web editor

## [v0.20.6]

- Improve sign-in flow
- Prepare for web execution

## [v0.20.3]

- Revert `extensionKind` setting so extension works again in remote scenarios

## [v0.20.0]

- Support multi-folder workspaces
- Provide one-click commands for (un)pinning workflows
- Updates for recent Actions workflow additions (`concurrency` etc.)
- Basic support for environments and environment secrets

## [v0.17.0]

- Support error background for pinned workflows - https://github.com/cschleiden/vscode-github-actions/issues/69
  ![](https://user-images.githubusercontent.com/2201819/107904773-9592ac00-6f01-11eb-89c6-7322a5912853.png)
- Basic support for environment auto-completion

## [v0.15.0]

- Support `include`/`exclude` for matrix strategies

## [v0.14.0]

- Consume updated parser
- Fixes issues with `!` in expressions
- Fixes issues with using `step.<id>.outputs` in expressions

## [v0.13.0]

- Fixed: https://github.com/cschleiden/vscode-github-actions/issues/42

## [v0.12.0]

- Various bugfixes for expression validation
- Added missing `pull_request_target` event
- Improved error reporting for unknown keys
- Bugfix: show "Run workflow" in context menu when workflow has _only_ `workflow_dispatch`, do not require also `repository_dispatch`

## [v0.11.0]

- Basic support for `environment` in jobs

## [v0.10.0]

- Fixes error when trying to open expired logs (#19)
- Removed login command, authorization is now handled via the GitHub authentication provider (#50)
- Fixes error where extension can not be enabled/disabled per workspace (#50)
- Support for validating `workflow_dispatch` events
- Support for triggering `workflow_dispatch` workflows

## [v0.9.0]

- Updated `github-actions-parser` dependency to fix a number of auto-complete and validation bugs
- Removed edit preview features, they are now enabled by default
- Changed the scope of the org features setting, so that it can be set for remote workspaces, too

## [v0.8.1]

- Fixes expression auto-completion in YAML multi-line strings

## [v0.8.0] The one with the auto-completion

- Enable the `github-actions.preview-features` setting to start using smart auto-complete and validation.

## [v0.7.0]

- Support the VS Code authentication API with the VS Code July release (1.48). This replaces the previous, manual PAT-based authentication flow.

  Note: Organization features like displaying Organization-level Secrets require the `admin:org` scope. Since not everyone might want to give this scope to the VS Code token, by default this scope is not requested. There is a new setting to request the scope.

- Moved all commands into a `github-actions.` namespace and "GitHub Actions" category in the command palette

## [v0.6.0]

- Update success icon
- Support org secrets

## [v0.5.1]

- Roll back VS Code authentication API change for now. Wait until it becomes stable to remove need for manual enabling.

## [v0.5.0]

- Support the VS Code authentication API. This replaces the previous, manual PAT-based authentication flow.

## [v0.4.1]

- Add inline run button to workflow list

## [v0.4.0]

- Bugfixes for remote development
- Show run button for workflows using `repository_dispatch` in editor title bar

## [v0.3.0]

- Enable pinning workflows

## [v0.2.0]

- Bugfix for displaying self-hosted runners

## [v0.1.16]

- Bugfix: "Trigger workflow" shows up for workflows using the object notation to define the `on` events
- Feature: If `repository_dispatch` is filtered to specific types, the trigger workflow run will be pre-populated with those.

## [v0.1.15]

- Support colored logs

## [v0.1.14]

- Support displaying logs for workflows

## [v0.1.1]

- Initial prototype

# Agent Teams Organization Defaults

This public repository contains organization-wide community defaults and the
canonical Renovate preset for repositories under `agent-teams-ai`.

GitHub applies supported community files to organization repositories that do
not provide a repository-specific override. Product architecture, local
development commands, bounded-context policy, and release procedures remain in
the owning repository.

## Shared Files

- `CONTRIBUTING.md` - baseline contribution workflow.
- `SECURITY.md` - private vulnerability reporting policy.
- `GOVERNANCE.md` - ownership and decision boundaries.
- `SUPPORT.md` - support routing.
- `CODE_OF_CONDUCT.md` - community conduct policy.
- `.github/ISSUE_TEMPLATE/` - default issue forms.
- `.github/PULL_REQUEST_TEMPLATE.md` - default pull request evidence.
- `renovate-config.json` - organization Renovate preset.
- `.github/workflows/reviewrouter-reusable.yml` - the single executable
  ReviewRouter implementation for organization repositories.

Repositories consume the Renovate policy explicitly:

```json
{
  "extends": ["local>agent-teams-ai/.github:renovate-config"]
}
```

The repository-local file is intentionally tiny. It can add project-specific
package rules but must not copy the organization preset.

## Shared ReviewRouter

Product repositories keep a minimal caller workflow and invoke the reusable
workflow from this repository at an exact commit SHA. The shared workflow owns
the reviewed action versions, fork policy, size guard, Codex setup, and review
configuration. Repository variables may override only the documented timeout,
size limit, draft policy, and model.

The caller grants write permissions only to the reusable review job and passes
repository secrets explicitly with `secrets: inherit`. Renovate updates the
pinned reusable-workflow SHA through ordinary reviewed pull requests. Product
repositories must not copy the reusable job steps locally.
Organization-wide community health, repository policy, and dependency automation configuration.

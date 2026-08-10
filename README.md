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
- `governance/` - machine-readable qualification and security-policy records.
- `docs/organization-security-baseline.md` - live-default snapshot, transfer
  handling, and plan-tier exceptions.
- `SUPPORT.md` - support routing.
- `CODE_OF_CONDUCT.md` - community conduct policy.
- `.github/ISSUE_TEMPLATE/` - default issue forms.
- `.github/PULL_REQUEST_TEMPLATE.md` - default pull request evidence.
- `renovate-config.json` - organization Renovate preset.
- `.github/workflows/reviewrouter-*.yml` - pinned ReviewRouter review and
  interaction workflows.

Repositories consume the Renovate policy explicitly:

```json
{
  "extends": ["local>agent-teams-ai/.github:renovate-config"]
}
```

The repository-local file is intentionally tiny. It can add project-specific
package rules but must not copy the organization preset.

## ReviewRouter

This repository publishes the organization reusable ReviewRouter interaction
workflow and pins its external runtime and actions to immutable commit SHAs. Its
own event workflow is a thin, immutable caller. Product repositories keep their
current interaction workflows until an explicit consumer migration is reviewed;
publishing the reusable workflow does not silently migrate them.
Organization-wide community health, repository policy, and dependency automation configuration.

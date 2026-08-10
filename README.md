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

The executable-specification ledger scopes all ten observed organization
repositories: six active, non-archived records and four archived security
canaries named as explicit exclusions. Repository scope, maturity, and
qualification values live only in the JSON ledger; the
human governance document intentionally does not duplicate its matrix.

## ReviewRouter

This repository pins the externally owned ReviewRouter reusable workflow and
runtime to immutable commit SHAs. Product repositories own their reviewed caller
configuration. Interaction migration to the upstream reusable workflow remains
deferred until its actions and input contract are safely pinned; organization
governance does not copy ReviewRouter bounded-context runtime logic.
Organization-wide community health, repository policy, and dependency automation configuration.

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
- `governance/docs-protocol-policy.json` - strict documentation-protocol
  inventory, admission status, evidence, and exceptions.
- `docs/organization-security-baseline.md` - live-default snapshot, transfer
  handling, and plan-tier exceptions.
- `docs/repository-admission.md` - reviewed onboarding for new owned
  repositories.
- `SUPPORT.md` - support routing.
- `CODE_OF_CONDUCT.md` - community conduct policy.
- `.github/ISSUE_TEMPLATE/` - default issue forms.
- `.github/PULL_REQUEST_TEMPLATE.md` - default pull request evidence.
- `renovate-config.json` - organization Renovate preset.
- `.github/workflows/reviewrouter-*.yml` - pinned ReviewRouter review and
  interaction workflows.
- `.github/workflows/docs-protocol-check.yml` - fixed reusable documentation
  protocol gate with no inputs or secrets.

Repositories consume the Renovate policy explicitly:

```json
{
  "extends": ["local>agent-teams-ai/.github:renovate-config"]
}
```

The repository-local file is intentionally tiny. It can add project-specific
package rules but must not copy the organization preset.

The executable-specification ledger scopes observed organization repositories
as active, non-archived records or named archived exclusions. Repository scope,
maturity, and qualification values live only in the JSON ledger; the
human governance document intentionally does not duplicate its matrix.

## ReviewRouter

This repository pins the externally owned ReviewRouter reusable workflow and
runtime to immutable commit SHAs. Product repositories own their reviewed caller
configuration. `reviewrouter-interaction.yml` is a thin caller of the upstream
interaction workflow and pins both `uses` and `runtime_ref` to the same immutable
release commit. It preserves organization event filters, discussion variables,
and secret mappings without copying checkout, setup, or runtime steps.
Organization-wide community health, repository policy, and dependency automation configuration.

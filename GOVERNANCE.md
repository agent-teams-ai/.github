# Governance

Agent Teams repositories use explicit ownership and reviewed architectural
decisions.

- The organization baseline owns community defaults and generic dependency
  update hygiene.
- Engineering Foundation owns reusable development tooling and conformance
  engines.
- Each product repository owns its domain model, bounded contexts, contracts,
  security classification, operational policy, and accepted ADRs.
- A shared preset may provide defaults but cannot silently redefine product
  ownership.
- Dependabot Security Updates remain the fallback owner of vulnerability update
  pull requests until Renovate is installed and verified for the organization.
  A repository must not run both systems as competing security-update PR owners.

Architecture decisions begin as proposed. They become accepted only after the
repository's documented approval authority confirms them. Pull request merge is
not itself proof of product approval unless the repository explicitly says so.

## Executable Specification Ownership

Engineering Foundation owns the generic, development-only capability mechanism:
schema loading, deterministic validation adapters, fixture execution, property
test support, and machine-readable evidence. Product repositories remain the
only owners of their domain vocabulary, schemas, guards, transitions, runtime
binding, compatibility promises, and migrations. A foundation capability cannot
turn a proposed product model into an accepted one.

Adoption must bind a repository-owned specification or model to positive and
negative fixtures and an exact deterministic gate. Do not add Ajv, fast-check,
XState, another package dependency, or enable a capability merely to claim
compliance. Cross-repository dependencies require a named owner, artifact, and
gate. Use explicit `N/A` instead of an empty dependency or placeholder model.

AI tools may propose changes or review evidence, but they are never an approval
authority. Required executable-specification gates run deterministic local
tooling in CI; they must not require hosted AI inference, credentials, or
availability.

GitHub does not inherit the organization pull request template into a repository
that defines a local override. Every local override must mirror the
executable-specification evidence block: schema or contract and version,
positive and negative fixtures, and the exact deterministic gate or an explicit
`N/A` with ownership rationale.

## Applicability Matrix

This matrix is authoritative for the six organization repositories.

| Repository | Applicability | Owned boundary |
| --- | --- | --- |
| `engineering-foundation` | Capability owner | Generic mechanism and evidence contracts only; it is not a material cross-axis donor of product models. Its local pull request template must mirror the organization evidence block. |
| `agent-runtime` | Applicable | Repository-owned JSON Schema with Ajv validation, fast-check properties/fixtures, and XState guards/transitions with an explicit runtime binding. |
| `agent-teams-platform` | Applicable | Internal Project Management model only; adoption makes no public wire-contract claim. |
| `agent-teams-orchestrator` | Applicable | Accepted, repository-owned state projections only; external or proposed state is out of scope. |
| `.github` | Governance-only | Organization policy, contribution evidence, and marker checks; no product executable specification. |
| `craig-meeting-gateway` | N/A | Fork: N/A until an upstream-owned test/spec boundary exists and is adopted explicitly. |

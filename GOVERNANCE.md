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

## Executable Specification Ledger

The machine-readable
[`governance/executable-spec-qualification.json`](governance/executable-spec-qualification.json)
ledger is authoritative for the six active in-scope organization repositories.
It records specification maturity, implementation qualification, deployment qualification,
owners, immutable evidence revisions, and exact deterministic commands as
separate claims. JSON Schema validates the strict structure; generic cross-field
checks prevent unverified snapshots from implying qualification. Repository
values are owned by the ledger rather than mirrored in validator code.

Required-check entries are a dated GitHub rulesets API observation with ruleset
and integration IDs. They are not a claim of continuous live audit. Approval
metadata currently requires zero approvals because review approval is disabled
and a one-approval rule would deadlock a single-member organization.

The scope is the six active, non-archived governance and product repositories.
Four archived one-shot security canaries are explicit exclusions in the ledger;
they are not silently omitted. Do not copy repository applicability into another
human table: the JSON ledger is the sole value authority and its offline check
binds evidence paths to immutable Git blob manifests.

Each manifest hashes lexically sorted `path`, NUL, Git blob SHA, and LF records
with SHA-256, so validation is deterministic and offline.

## Organization Security Defaults

The live organization code-security defaults and their limitations are recorded
in [`governance/code-security-defaults.json`](governance/code-security-defaults.json)
and [the security baseline](docs/organization-security-baseline.md). Configuration
`266049` is enforced for new public repositories and configuration `266048` is
enforced for new private and internal repositories. Dependabot owns security
updates only; Renovate owns routine version updates.

Do not assume that a transferred repository received an organization default.
Audit and explicitly apply the visibility-appropriate configuration after a
transfer. The current private `agent-teams-platform` repository has a documented
GitHub Free exception: its CI gates cannot be configured as protected required
checks on the current plan, so policy must not describe them as remotely
enforced.

The dated Actions posture is recorded separately in
[`governance/actions-policy.json`](governance/actions-policy.json). Default
workflow permissions are read-only and workflow approval is disabled. Immutable
action-reference enforcement is not yet organization-wide: Gateway pull request
`#7` remains pending, and Platform retains its private GitHub Free required-check
exception. Do not describe Actions SHA pinning as fully enforced until the JSON
snapshot is updated with new evidence.

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
ledger is authoritative for the active in-scope organization repositories.
It records specification maturity, implementation qualification, deployment qualification,
owners, dated evidence coordinates, and exact deterministic commands as
separate claims. JSON Schema validates the strict structure; generic cross-field
checks prevent unverified snapshots from implying qualification. Repository
values are owned by the ledger rather than mirrored in validator code.

Checked-in scope consistency is anchored separately by the dated,
human-reviewed GitHub API snapshot in
[`governance/organization-repository-inventory.json`](governance/organization-repository-inventory.json).
Validation requires its exact repository names, IDs, archived split, and default
branches to reconcile with the ledger. Its structural checksum detects
inconsistent checked-in edits. A coordinated edit of the inventory and ledger,
or repository drift after the observation date, requires a fresh authenticated
API audit to detect. Neither the snapshot nor its checksum is remote attestation,
a CI-enforced live completeness gate, or continuous inventory monitoring.

Required-check entries are a dated GitHub rulesets API observation with ruleset
and integration IDs, repository-scoped evidence endpoints, HTTP status, and
observation date. An `observed_absent` record means a dated successful query
returned no repository rulesets; it is not an enforcement claim. They are not a
claim of continuous live audit. Approval
metadata currently requires zero approvals because review approval is disabled
and a one-approval rule would deadlock a single-member organization.

The scope is the active, non-archived governance and product repositories.
Archived one-shot security canaries are explicit exclusions in the ledger;
they are not silently omitted. Do not copy repository applicability into another
human table: the JSON ledger is the sole value authority. Evidence entries are
dated, human-reviewed Git revision/path/blob coordinates.

New repositories inherit the organization security and immutable Actions
defaults, but they begin architecturally unqualified. A repository must receive
an owned ledger record, scoped evidence, and deterministic gates before any
implementation or deployment qualification is claimed.

## Documentation Protocol Admission

The frozen stable3-compatible
[`governance/docs-protocol-policy.json`](governance/docs-protocol-policy.json)
is an immutable compatibility snapshot for already-pinned consumers. The current
[`governance/docs-protocol-policy-v2.json`](governance/docs-protocol-policy-v2.json)
is the sole evolving admission authority and must reconcile exactly with the dated active
repository inventory. Validation locks the stable3 bytes and proves that its repository
identities remain represented in v2, while lifecycle, admission, and Cohort fields evolve
only in v2. The compatibility copy therefore cannot become a second mutable source of truth
or block a v2 migration. A consumer pinned to the stable3 schemaVersion 1 projection still
uses v2 for every current lifecycle and admission decision: pending classification,
revocation, suspension, ineligibility, or any other non-admitted v2 state fails closed even
when the frozen compatibility snapshot still says admitted. Foundation
produces `@agent-teams/docs-protocol` but is not a protocol consumer. Product
consumers own their profiles and cannot claim admission without an exact package
version, pairwise-distinct profile/caller/qualification paths, the nonzero
consumer revision containing those artifacts, a separate nonzero immutable SHA
for the central reusable-workflow target, evidence paths, and the fixed
`pnpm docs:protocol:check` gate.

The reusable workflow accepts no command input and no secret. OIDC authorization,
non-OIDC structural verification, exact Cohort qualification on a fresh runner, and the
untrusted repository semantic gate are isolated jobs. The required semantic job fails
closed unless every trusted job succeeds. v2 qualification installs the centrally authorized
exact Cohort graph only into a fresh trusted temporary root, never consumer-provided
`node_modules`; lifecycle hooks and pnpmfiles remain disabled. The installed package tree is
bound before execution to the central expected package versions and SRI values, then the
receipt verifier rechecks the same isolated bytes after execution.
This repository does not claim that GitHub
automatically applies reusable workflows, packages, profiles, or required checks
to new repositories. Follow [repository admission](docs/repository-admission.md)
for the reviewed consumer change and governance update.

The external Craig fork remains explicitly exempt with review triggers. The
Platform GitHub Free required-check exception remains separately authoritative;
it does not waive the local or CI documentation gate. Continuous live inventory
drift audit runs every six hours with a dedicated read-only organization credential
and fails unless visible private repositories match the organization total. ReviewRouter,
Codex authentication, and interactive user credentials must not be repurposed for it.

The internal checksum hashes lexically sorted `path`, NUL, Git blob SHA, and LF
records with SHA-256. It detects inconsistent edits inside the ledger; it does
not prove that remote Git objects exist or that a revision contains those blobs.

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
GitHub Free exception, `platform-private-required-checks-github-free`, defined
once in the code-security snapshot and referenced by the other policy records.
Policy must not describe those CI gates as remotely enforced.

The dated Actions posture is recorded separately in
[`governance/actions-policy.json`](governance/actions-policy.json). Default
workflow permissions are read-only and workflow approval is disabled. Immutable
action-reference enforcement is enabled organization-wide. Platform retains the
separate required-check exception
`platform-private-required-checks-github-free`; that GitHub Free limitation does
not weaken immutable action-reference enforcement.

Workflow-generated release pull requests use the owner-bootstrap policy without
enabling organization-wide Actions pull-request creation or approval. The
repository owner creates the pull request only after verifying the exact
generated diff, head SHA, and base SHA. The owner may manually approve a
workflow run only after inspecting that same tuple and confirming the exact head
commit is authored by `github-actions[bot]`; automatic or broader workflow
approval is forbidden. Only a failed Release run may be rerun. The release pull
request may merge only after its required checks, ReviewRouter result, and
release attestation have all passed for the verified head.

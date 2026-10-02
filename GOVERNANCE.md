# Governance

Agent Teams repositories use explicit ownership and reviewed architectural
decisions.

- The organization baseline owns community defaults, immutable shared
  architecture standards, and generic dependency update hygiene.
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

## Shared Engineering Practices

The [Engineering Quality Standard](docs/engineering-quality-standard.md) is the
maintained common-practice baseline for planning, implementation and review.
Repository AGENTS.md and CLAUDE.md files link to it explicitly; GitHub does not
supply those instructions to every agent automatically. Product-specific rules,
commands and conformance evidence remain owned by each repository.

This baseline is not another version of the immutable Feature Module Standard.
It does not alter accepted ADRs, adopt a successor or change a consumer pin.
Changes to versioned architecture requirements follow their existing publication
and consumer-adoption processes. Linking a policy never certifies existing code.

## Feature Module Standard Ownership

The organization owns the immutable language-neutral Feature Module Standard
baseline and its append-only version registry. Adoption is never automatic.
Each adopting product repository owns one local adoption profile that declares
scope, topology mapping, extensions, deviations, and deterministic enforcement.

The organization baseline cannot define a product's domain model, bounded
contexts, package identities, technology choices, accepted decisions, or
conformance claim. A local profile may strengthen the standard or record an
explicit owned deviation, but it cannot silently reinterpret the central
version. A central successor does not affect a repository until that repository
explicitly adopts it.

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

Qualified Docs Cohort generations are explicit authority. Existing v1 records,
events, and digest domains are immutable. Cohort v2 binds exactly five named
coordinates with three direct roots, two exact transitives, and a closed
dependency graph; package count, schema shape, and installed modules are never
generation selectors. A v2 qualification receipt is supporting evidence only
when bound to an immutable execution envelope and never replaces hosted central
consumer CANARY evidence.

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

## Commit and pull request authorship

The maintained owner requirement is defined once in
[`governance/commit-author-identity.json`](governance/commit-author-identity.json).
Organization automation generates proposed changes with the exact local owner
Git name/email. The human owner opens owner release PRs after inspecting the
exact generated diff, head SHA and base SHA. An author-email merge flag cannot
transfer PR authorship. Bot PRs must be replaced by a human-opened PR; rewriting
an external human contribution as the owner is forbidden. Known Bot/GitHub
and known Codex/OpenAI source commit authors are rejected. Owner source commits
require both raw author and committer to be exactly `iliya <iliyazelenkog@gmail.com>`;
GitHub/web-flow is not an owner source committer exception. External human
contributions retain their original author and committer, including GitHub's
technical committer. The generated final squash after merge has the owner's
GitHub committer/display-name exception and is verified separately with `gh`.

The trusted reusable identity workflow reads GitHub metadata and inert caller
bytes, never PR code. It checks every commit (paginated, at most 250; split larger
PRs), preserves external human author metadata, and checks the exact owner
name/email on owner-associated commits. Unassociated commits bearing the owner
name also require that identity. This checks metadata, not cryptographic owner
identity. It rejects Bot PR authors even when every source commit is owner-authored.
During a checker run, a same-head Bot PR also blocks success on a human PR.
GitHub commit statuses belong to a SHA, not a PR number: a Bot PR can reuse a
previously green owner head, and GITHUB_TOKEN-created PR events are suppressed.
A per-SHA status alone therefore does not guarantee PR-specific UI merge safety.
Publishers serialize by repository without cancellation; same-head open PR
ownership is re-read as the final metadata operation before success, after the
complete live PR/head/base reread.
Pending and terminal `commit-author-identity` statuses bind the independently
observed head; transport errors and head/base movement fail the job without
publishing success. An unavailable status write cannot guarantee revocation of
an older green status; qualify that boundary before relying on merge prevention.

The reusable implementation is pinned by each consumer. Current policy and the
caller template are read together from an immutable observation of the trusted
central default branch, then rechecked before success. They are maintained
central guidance, not an architecture content-pin migration. The check rejects
removed or broken callers and changes beyond the allowed remote pin upgrade,
including changes to the central local reusable target.
Immutable Git tree mode/blob checks reject symlink or submodule replacements
even when the Contents API resolves identical bytes. Remote callers may upgrade
only their nonzero immutable 40-SHA pin when both base and head exactly match
the trusted canonical template. The new target must be a regular Git file with
the same blob as the independently observed reviewed current central-main
implementation; both are rechecked before success. This approves only the
workflow artifact bytes, not the whole pinned repository. Other caller changes
and central local reusable changes require a staged reviewed successor and
required-check cutover; a deleted caller cannot certify itself. First installation
is a reviewed bootstrap. The audit retains its implementation-byte verification.

Native commit-email restrictions failed the TEST rebase merge qualification;
they are supplementary unproven posture and are not shipped as enforcement.
The canonical payload requires the exact head status from GitHub Actions
integration `15368`, on `~DEFAULT_BRANCH`, active and without bypass actors.
Installation and actual merge qualification remain maintainer operations;
this policy does not claim live enforcement or automatic inheritance on Free.

Owner-generated agent changes must use the fresh actor guard in
[`scripts/merge-owner-pr.mjs`](scripts/merge-owner-pr.mjs) for squash merges.
Supply `--repository`, `--pr`, the reviewed exact `--expected-head`, an ordinary
Conventional Commit `--subject`, and `--body-file` containing the complete
reviewed commit body, including every issue reference. The guard freezes those
body bytes, requires authenticated User/777genius and a live open User/777genius
PR on that head, then invokes `gh pr merge` with explicit squash, canonical
author email and head matching. Bot staging PRs must never be reopened or merged.
External human PRs retain their existing PR and attribution through the
contributor-preserving flow; this owner guard refuses them.

After merge the guard independently reads the actual PR and final commit,
verifying merged state, owner author account, exact email and full supplied
message/refs. GitHub's technical final committer and owner display name are
allowed. A mismatch or transport failure is reported for inspection, never a
history rewrite or automatic retry. The guard neither grants checks nor bypasses
or changes protection; a queued or otherwise unconfirmed merge is not success.

The canonical `actions_workflow_permissions.can_approve_pull_request_reviews`
target is explicitly `false` at the organization default and every current
active repository. GitHub's Actions workflow-permission setting controls
GITHUB_TOKEN PR **creation and approval**. The read-only identity audit queries
both actual scopes and rejects true, missing, unknown or inaccessible values
while retaining caller, implementation-byte, immutable-file and ruleset checks.
This target is not evidence that the live settings have already been changed.

Foundation version generation must set `setupGitUser: false` after configuring
its local Git identity from the canonical owner policy. Before reusing an open
release PR, a read-only freshness guard must confirm the PR author is the owner
and the observed head/base/diff are the verified tuple. A Bot-owned existing PR
fails the guard even after its source commits are corrected. Keep existing
tokens and versions. Keep Actions PR creation/approval disabled at organization
and repository scopes; do not enable automatic or broader workflow approval.
Changesets action at `a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d`
pushes its generated version branch before attempting PR creation. Disabling
creation can therefore leave a generated branch without a staging PR. After
inspecting that exact diff/head/base, the owner opens the PR using `gh pr create`
before a failed Release rerun and current-input attestation; an existing owner
PR may be selected/updated by Changesets. Never reopen or merge a Bot staging PR.
Only failed Release runs may be rerun; manual workflow approval requires
inspection of the same owner-authored tuple. Required checks, ReviewRouter and
release attestation must pass for that exact head, followed by the fresh owner
merge guard.

The older owner-bootstrap Bot-author fields in
[`governance/actions-policy.json`](governance/actions-policy.json) are historical
snapshot evidence, not current release instructions. Its schema and bytes stay
unchanged; this maintained policy supersedes that obsolete author requirement.

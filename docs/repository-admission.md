# Repository documentation protocol admission

Every new organization-owned repository starts as `pending_classification`.
Its owner explicitly chooses consumer, producer/controller, or N/A before any
admission. GitHub community defaults can supply this guidance, but GitHub does
not automatically install packages, profiles, scripts, workflows, or required
checks in a new repository.

## Admission contract

The repository owner must:

1. select the current `RECOMMENDED` Qualified Cohort from
   `governance/docs-qualified-cohorts.json`, never an independent npm tag;
2. add the Cohort's exact Docs Protocol and Foundation versions and refresh the
   root pnpm lockfile with lifecycle scripts disabled;
3. add a repository-owned strict profile, schema, owners, templates, and
   reachability rules;
4. expose the fixed `pnpm docs:protocol:check` gate and the common authoring
   commands documented by the protocol;
5. run consumer integration check, Plan, reviewed digest-bound apply, and
   post-apply check;
6. call the reusable `agent-teams-ai/.github/.github/workflows/docs-protocol-check.yml`
   workflow from an explicit repository workflow. Pin the central reusable
   workflow target to its own reviewed, nonzero 40-hex revision. The caller is
   inputless; the trusted central gate reads and validates the committed managed
   Cohort projection itself;
7. prove positive and negative profile/adoption fixtures in a disposable test
   project;
8. update `governance/docs-protocol-policy-v2.json` with the centrally admitted
   exact package version, profile path, caller workflow path, qualification
   evidence path, the nonzero consumer revision at which those three artifacts
   were observed, and the separate nonzero central reusable-workflow revision.

Canary admission is narrower: only immutable repository ID/name pairs declared
by the Cohort may consume `QUALIFIED` or `CANARY`, and the `CANARY` event binds their merge
revision, record/event digests, exact observed check context, and hosted run.
The remaining fleet waits for `RECOMMENDED`. During phased rollout, each
repository has separate `desired_cohort_id` and `observed_cohort_id`; this
allows fleet N and canary N+1 without a global package-version switch. Cohort
IDs are opaque unique identifiers: immutable registry append position and
explicit migration edges define order, so `stable10` may follow `stable9.1`
without renaming either record.

Before lifecycle promotion, run
`pnpm governance:cohorts:verify -- --cohort <exact-id>`. It verifies live npm
integrity, publication time, signatures after a real exact install, SLSA source commit/workflow/run, and the
reusable workflow revision-to-blob binding. It also opens the published Docs
tarball to verify the exact Foundation dependency and managed asset digests. For
the reusable gate, the recorded revision must be an ancestor of the live
protected default branch and its workflow blob must exactly equal the workflow
blob currently present there. Workflow evolution therefore requires a reviewed
successor check and ruleset cutover before the canonical blob changes; merely
matching expected command substrings is never qualification. For
CANARY evidence it resolves the exact repository identity, default-branch
ancestry, head revision, context, GitHub App integration, successful conclusion,
check-run ID, workflow run/path, hosted URL, and committed caller bytes.
The base-owned `pull_request_target` workflow runs this live verifier for every
new record or event without checking out or executing PR-head code. Bootstrap remains one reviewed PR;
an old consumer CLI cannot install its own successor.

Admission is complete only when the consumer checks and governance validation
both pass for the same revision. A package install, merged pull request, or green
generic CI run alone is not qualification. Required-check enforcement remains a
separate dated GitHub observation.

Existing bindings are evaluated separately from new selection. A
`SUPERSEDED` Cohort remains supported only before its exact `support_until`;
`SUPPORT_ENDED`, `SUSPENDED`, and `WITHDRAWN` fail closed. Lifecycle state is
never copied into the consumer projection, so append-only central events take
effect without rewriting consumer bytes.

Emergency `SUSPENDED`, `WITHDRAWN`, and support-termination events use only
base-owned deterministic history, so npm or GitHub outages cannot block
revocation. Positive promotion still requires fresh live package, provenance,
workflow, and canary-check evidence.
The dependency-free emergency validator permits only the registry and newly
added inert Cohort evidence. Renames, deletes, dependency files, workflows,
schemas, policy, and executable scripts are rejected before validation.

Admission is two-phase. An `admission_candidate` in `bootstrap_pending` may name
one eligible desired Cohort while observed state remains null, allowing its first
PR to run the trusted gate. It becomes `admitted` and `bound` only after the exact
successful required check is observed on the default-branch revision.
Hosted admission verification independently resolves the current default-branch
HEAD, exact check and workflow runs, caller bytes, and committed managed Cohort
projection. API, credential, or rate-limit failure fails the admission job.
Ordinary `pull_request` CI is deliberately secretless because it checks out and
executes PR-head code. A separate base-owned `pull_request_target` admission
check fetches only the exact allowlisted policy/exception JSON from the head SHA,
then validates it with default-branch code and schemas. It rejects forks,
renames, deletes, mixed executable/schema/dependency/Cohort changes, and missing
credentials before any credentialed verification. Public consumers use the
base-owned workflow's short-lived, read-only `github.token`; public GitHub API
data does not require a durable organization credential. Private consumers
require `DOCS_GOVERNANCE_READ_TOKEN`: a dedicated GitHub App installation token
or fine-grained token with repository metadata, Contents read, Actions read,
and Checks read permissions only. Missing or inaccessible private-repository
scope fails closed; no secret value is committed.

Before recommendation, only one organization-owned canary may be
`rollout_pending`. After the target reaches `RECOMMENDED`, multiple consumers
may form one parallel rollout wave when every row has the same desired Cohort
and an explicit upgrade edge from its observed Cohort. Mixed-target waves fail
closed. A central suspension may temporarily coexist with fleet rows still
observing that Cohort; this is explicit remediation state, while consumer gates
fail closed.

`observed_default_branch_evidence` is the immutable admission snapshot, not a
copy of every later consumer HEAD. On each admission-policy change, trusted CI
re-verifies that snapshot, proves it is an ancestor of a stable current default
branch HEAD, and binds that HEAD to exactly one successful required check, the
same workflow identity, caller bytes, and managed Cohort projection. Unrelated
consumer commits therefore require no central JSON rewrite; force-pushes,
missing or ambiguous checks, and managed-state drift fail closed.

## Existing exceptions

`craig-meeting-gateway` is an upstream external fork and is not modified by this
protocol. Review the exemption if the fork is detached, ownership changes, or
organization-specific documentation is added.

The private Platform repository retains
`platform-private-required-checks-github-free`. Its local and CI documentation
gate is still mandatory, but the policy must not claim unavailable GitHub Free
required-check enforcement. Its owner, review boundary, expiry, and triggers are
machine-readable in `governance/docs-protocol-exceptions.json`.

## Inventory and drift

The checked-in inventory and policy must contain exactly the same active
repository identities. Source provenance, governance ownership, repository
lifecycle, docs role, and admission are separate fields. Archived, transferred,
and deleted repository IDs remain historical tombstones, including when a new
repository later reuses the same name. This catches omissions in a reviewed
snapshot. It is not a live organization-wide inheritance feature.

A scheduled live audit may be enabled only with a dedicated read-only
organization inventory credential. It must fail closed when the credential is
missing or the API is unavailable. ReviewRouter credentials, `CODEX_AUTH_JSON`,
and a maintainer's interactive `gh` token are forbidden for that automation.

Maintainers can perform a write-free stable two-pass observation with
`pnpm governance:inventory:observe`. Its JSON is review evidence, not an
automatic policy mutation.

## Bootstrap and enforcement still required

The first merge is a reviewed bootstrap because a newly introduced
`pull_request_target` workflow cannot protect the PR that introduces itself.
After that merge, maintainers must add both `trusted-validation` and
`trusted-admission-evidence` as required checks on the `.github` repository
ruleset, alongside the existing repository checks. Each trusted workflow runs on
every pull request and may return a successful no-op only outside its own exact
data mode: Cohort registry appends for the former, and admission policy/exception
updates for the latter. Requiring only `trusted-validation` would leave admission
updates checked only by its no-op path. Configure the ruleset to require branches to be
up to date before merge so a later concurrent append invalidates the earlier
result. Future validator/schema changes must
use a separately staged successor check and ruleset cutover; the v1 trusted
workflow intentionally rejects edits to its own authority files.

Renovate cannot propose Foundation or Docs Protocol independently. Their exact
pair changes only through a centrally qualified Cohort proposal with an explicit
upgrade or rollback edge.

Before any consumer rollout, publish and live-verify the first real Cohort,
append its lifecycle events, update each caller to the required exact inputs and
reviewed workflow revision, and record desired/observed admission evidence.
There is no organization write controller or continuous compliance claim in
this phase; lifecycle appends, consumer changes, and ruleset configuration
remain explicit maintainer operations.

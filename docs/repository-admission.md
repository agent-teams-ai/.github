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
copy of every later consumer HEAD. Trusted CI re-verifies that snapshot,
repository identity, ancestry and stable current default-branch HEAD for every
admitted consumer. For an exact policy-only PR, ADR-0008 also requires current
Docs success and execution proof for changed consumer rows; unchanged rows are
reported as `current_not_evaluated`. Other PR shapes and the daily/on-demand
fleet audit require current success for every consumer. Unrelated consumer
commits need no central JSON rewrite, and a failed current check is never
reported as success.

The bounded correction for .github#338 permits only Platform's desired stable21
→ stable31 selection (`bound` → `rollout_pending`) on exact source
`5d3551d02237281a2ae4a97e8e8d7a188c741559`. Protected base code reads the pinned
[inert failed-source receipt](../governance/evidence/docs-admission/platform-stable31-pending-source.json).
Target31 must have genuine Extension Foundation CANARY and RECOMMENDED authority
and explicit observed21→31 and source25→31 edges. Every observed21 fact and every
other policy row remain unchanged; run 37015324661 attempt 1 remains failed.
Admission reports only `recovery_pending`, with qualification and semantics
`unverified`. Direct fleet audits retain strict current-success requirements.

Before movement off that exact source, the inverse changes only desired31 back
to desired21 and `rollout_pending` back to `bound`; it still reports the known
failed source. It does not run an old dependency graph. Actual target31 success
and observed advancement use ordinary strict `verifyAdmissionRevision` proof.
Remove the bounded route through reviewed cleanup after normal binding. The
implementation cannot authorize its own protected delivery; the separately
reviewed exact delivery manifest and installation remain owner operations.

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

For the historical clock repair in PR #327, the separately staged
`trusted-admission-clock-repair-v1` check accepts only its reviewed two-file
forward tuple. Qualify it on TEST and the refreshed live PR before temporarily
replacing the three rejecting authority contexts. Keep strict, identity, CI and
other required checks; use the owner merge guard, restore exact original
protection immediately, and verify full main CI. This check cannot authorize
its own installation, modification or a rollback.

Renovate cannot propose Foundation or Docs Protocol independently. Their exact
pair changes only through a centrally qualified Cohort proposal with an explicit
upgrade or rollback edge.

Before any consumer rollout, publish and live-verify the first real Cohort,
append its lifecycle events, update each caller to the required exact inputs and
reviewed workflow revision, and record desired/observed admission evidence.
There is no organization write controller or continuous compliance claim in
this phase; lifecycle appends, consumer changes, and ruleset configuration
remain explicit maintainer operations.

## Commit identity onboarding

Future owned repositories and transfers use the supported central
[onboarding command](../scripts/onboard-commit-author-identity.mjs). Its only
sources of rules and caller bytes are the
[canonical identity policy](../governance/commit-author-identity.json),
[thin caller](../scripts/fixtures/commit-author-identity-caller.yml), and
[current trusted implementation](../.github/workflows/commit-author-identity-check.yml).
Central itself has a separately bootstrapped base-relative caller and is refused
by this route. No consumer copies policy or receives a second template.

1. Prepare the caller from a reviewed central checkout:

   ```sh
   node scripts/onboard-commit-author-identity.mjs render --revision 6d843f3a2c3f616aa2f4b902a866b1ff1a18f9c6
   ```

   Rendering only prints the exact fixture with its placeholder replaced. It
   makes no remote or local change and does not verify remote admission. If using
   shell redirection, redirect only to a reviewed **new** destination; the shell
   can otherwise overwrite an existing file. Review and bootstrap those bytes as
   `.github/workflows/commit-author-identity.yml` on the consumer's default branch
   before activating the required status. The command never commits, pushes,
   creates repositories, or opens/merges PRs. The first installation cannot
   protect its own bootstrap PR.

2. Inspect the write-free remote plan from this central checkout, using authorized
   `gh` access:

   ```sh
   node scripts/onboard-commit-author-identity.mjs --repo agent-teams-ai/NEW_REPOSITORY
   ```

   The JSON binds the repository ID, default branch, exact head, caller pin,
   existing ruleset IDs, and proposed changes. `--expected-head <reviewed-SHA>`
   also binds a dry-run to a previously reviewed head. Missing callers, moving or
   zero pins, symlinks/submodules, obsolete central authority, unknown permission
   values, or ambiguous/mismatched dedicated rules refuse administration.

3. The authenticated human owner `777genius` explicitly applies that reviewed plan:

   ```sh
   node scripts/onboard-commit-author-identity.mjs --repo agent-teams-ai/NEW_REPOSITORY --expected-head REVIEWED_DEFAULT_HEAD_SHA --apply
   ```

   `--expected-head` is mandatory for apply. Current remote central policy,
   template and workflow must byte-match unchanged regular Git files in this
   checkout. The installed default-head caller must exactly match the template
   and pin an accessible regular central workflow with the current trusted
   implementation bytes. Exact pins need a retained, accessible commit: the
   retained `6d843f3a2c3f616aa2f4b902a866b1ff1a18f9c6` source is already qualified;
   recheck its availability and byte compatibility rather than switching to `main`.

   Organization Actions PR creation/approval must already be explicitly false;
   the command never changes organization settings. It may send only repository
   `can_approve_pull_request_reviews=false`, preserving default workflow
   permissions and all unrelated fields, then create only the missing additive
   canonical dedicated rule. All visible rulesets, including parents, are
   paginated. A single exact inherited or repository rule is a no-op; competing or
   mismatched candidates are never overwritten, deleted, disabled or bypassed.
   Existing checks and protections remain intact. Repository identity, default
   head and configuration are rechecked before each write and afterward. Movement
   or uncertain transport stops with an explicit partial result when a write was
   attempted. Inspect actual state and a fresh dry-run before another explicit
   apply; there is no automatic retry or rollback of unknown effects.

4. Consumer security baseline adoption remains consumer-owned. Change it only if
   its existing gate rejects this exact `identity` job or pin. Keep caller defaults
   read-only and permit `statuses: write` only for that job. The shared reusable
   workflow declares its root permission for GitHub's nested permission contract.
   That caller/status contract was already live-qualified; new repositories need
   no replay of the entire shared suite merely to restate that proof.

5. Finish with the shared configuration audit:

   ```sh
   node scripts/audit-commit-author-identity.mjs
   ```

   Use authorized read-only `gh` access with visibility of the intended scope.
   The audit verifies callers, immutable implementation files, exact rules and
   explicit false Actions PR creation/approval at both scopes. Apply reports
   `configured_not_live_qualification`: configuration audit and actual GitHub
   TEST workflow/enforcement proof are separate evidence. Neither the workflow
   nor a green SHA status alone controls PR authorship or proves PR-specific
   merge eligibility. Preserve external human contributors and their metadata.

On GitHub Free, visible inherited organization rules and repository-specific
rules are distinct. An exact inherited rule may satisfy the configuration check,
but there is no promise of automatic organization inheritance. Where required
checks are unavailable (including the documented private Platform exception),
report the plan-tier limitation; neither caller installation nor this command
proves remote enforcement. The additive rule never removes other required checks.

For owner-generated agent changes, use the
[fresh owner squash guard](../scripts/merge-owner-pr.mjs) with the repository,
PR, exact reviewed head, Conventional Commit subject and complete body-file
bytes/issue references. SHA statuses are shared between PRs and alone cannot
guarantee PR-specific UI merge safety. Never reopen or merge Bot staging PRs;
external human PRs/authorship keep the contributor-preserving flow. Changesets
may push a generated version branch before disabled PR creation fails: the owner
opens its inspected PR with `gh` before a failed-run rerun/current-input attestation.
The final committer must be the exact ordinary owner identity or GitHub's
`web-flow` / `GitHub <noreply@github.com>` technical identity. Message verification
permits omitted terminal line endings as observed in GitHub squash responses;
interior text and all issue references must match the frozen body file.

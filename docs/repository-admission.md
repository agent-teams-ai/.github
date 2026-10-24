# Repository admission

Every new organization-owned repository starts as `pending_classification`.
Its owner explicitly chooses consumer, producer/controller, or N/A before any
admission. GitHub community defaults can supply this guidance, but GitHub does
not automatically install packages, profiles, scripts, workflows, or required
checks in a new repository.

## New repository bootstrap

New organization-owned production repositories created on or after
**2026-10-22 UTC** must explicitly adopt the full immutable
[Feature Module Standard v1.1](architecture/feature-module-standard/v1.1.md),
Engineering Foundation quality coverage and deterministic native gates in their
first reviewed bootstrap. SDKs, integrations and libraries need feature
ownership for their real capabilities just as services do. Choose the appropriate
module role; do not substitute an SDK exemption, empty scaffolding or a package
installation for adoption. Existing repositories enter this route by explicit
owner opt-in or a reviewed central registration requiring full FMS; this requirement does not initiate a fleet migration or rewrite
accepted decisions or immutable standards.

The organization owns this bootstrap policy and its
[standalone configuration checker](../scripts/check-repository-admission.ts).
Foundation owns portable validation mechanisms; the repository owns its domain,
topology, adoption decision and exact gates. This is organization onboarding
policy, not a second general-purpose quality engine or an installable package.

### Supported configuration contract

The first checker supports JavaScript/TypeScript projects with an exact
`pnpm@x.y.z` or `bun@x.y.z` package manager declaration, a committed native
lockfile and a default branch named `main`. Other stacks and branch layouts
remain **unsupported_stack_pending** until an owned, reviewed adapter is added.
The inventory audit conservatively includes new active owned repositories until
their classification is resolved; it cannot infer that a repository is
non-production from a missing package manifest. Archived repositories and
external forks remain outside this bootstrap route. They keep their existing
classification obligations.

1. Read the [engineering baseline](engineering-quality-standard.md),
   [tool catalog](development-tools.md) and immutable FMS before choosing tooling.
   Record owner-approved adoption in a repository-local architecture document
   and decision. Expose its one FMS profile from README and route AGENTS.md to
   this exact bootstrap anchor. CLAUDE.md routes through AGENTS.md or this guide.
   An older repository opting in also records `"repositoryAdmission": 1` in its
   root package.json. Retain that explicit intent so the independent audit still
   detects removal of its whole caller.

2. Declare consumer-owned `architecture.source-dependencies`,
   `quality.source-coverage` and `quality.suppression-governance` config paths in
   root `foundation.config.yaml`. Source coverage binds the same source and
   suppression policies, the type-aware lint configuration, the one
   `featureProfilePath`, real production `compilerProjects`, and the scope,
   typed and full native script names. Use the existing Foundation configuration
   contracts and the consumer's exact released development-only Foundation/FMS
   package pins. Source coverage includes the actual modules, SDKs and features.
   Production compiler projects inherit strict, noUncheckedIndexedAccess and
   exactOptionalPropertyTypes, through local configs or Foundation's named
   base/node/bun strict presets. Weakening overrides remain failures. Other
   external preset inheritance needs an explicitly supported adapter.

3. The profile identifies the immutable standard's ID, version, canonical path,
   content digest and nonzero source commit. Declare production, application and
   excluded roots; every real module's role and feature/layer mapping; extensions
   and deviations, including explicit empty arrays; architecture documentation;
   decision records; and exact deterministic enforcement commands. Follow the
   complete FMS conformance contract, including positive and negative topology
   fixtures. This configuration check does not inspect or certify the semantics
   of those fixtures or the feature implementation.

4. Keep `check` as the full native script route. It executes the real FMS gate,
   coverage scope and typed gates, strict compilation, native tests, complete
   Foundation check, assert-dev-only and assert-registry. Every declared FMS
   enforcement command must be reached by that route. Required pull-request CI
   executes the complete route, in one job or split across unconditional jobs
   with unconditional, acyclic and complete `needs` closures. Do not rely on
   path filters, conditions, continue-on-error, comments, command text inside
   echo, or exit-zero scripts. The static recognizer supports direct native
   commands joined by `&&` in package scripts. Workflow steps also permit
   newlines under an Ubuntu runner and GitHub's built-in bash/sh fail-fast
   shells. Custom shells, other runners, wrappers, arbitrary shell, changed
   working directories and reusable native gate jobs need a reviewed adapter.
   Package-manager shell overrides and execution-control environment overrides
   are rejected. Compiler help/version, dry-run/configuration probes and
   disabled checking never count as compilation.
   Repository-owned commands still require their native test and semantic review;
   recognizing a command does not establish what its implementation does.

5. From a reviewed central checkout, render the inputless canonical caller:

   ```sh
   node scripts/check-repository-admission.ts render REVIEWED_IMMUTABLE_CENTRAL_SHA
   ```

   Review its bytes and install them as
   `.github/workflows/repository-admission.yml`. The retained central revision
   must contain the reusable workflow and its literal immutable implementation
   checkout. Never use `main`, supply a command, pass secrets or add a condition.
   The checker renders to stdout only; it does not write, commit, install or
   administer GitHub. Use a reviewed new destination if redirecting stdout.
   Also install the exact central identity caller through
   [commit identity onboarding](#commit-identity-onboarding). This checker
   requires the accepted alias-aware implementation
   `77a0f46cbfc7688cbabbe12ee819e50ba6f64234`. Both source roles retain the
   exact owner email and the two exact accepted names `iliya` and `Илия`.
   The checker rejects the canonical-only predecessor and the broader proposed
   account-association implementation. Read the publication and adoption
   boundary below before installing the caller.

6. Check the inert consumer configuration from the central checkout:

   ```sh
   node scripts/check-repository-admission.ts --root /path/to/consumer
   ```

   Missing foundation configuration or an entirely absent caller exits nonzero
   and links this guide. The checker reads bounded regular UTF-8 files only:
   at most 256 files, 256 KiB per file and 4 MiB in total, with bounded compiler
   inheritance and workflow/script graphs. Symlinks, malformed/aliased YAML,
   invalid UTF-8 and unsafe paths fail closed. It never installs dependencies,
   executes consumer commands, reads credentials or needs a secret.

7. Run the consumer's complete native gates and appropriate disposable positive
   and negative fixtures, then observe the exact hosted workflow and separately
   configure and verify required-check enforcement. Bootstrap installation does
   not protect its own first PR. GitHub community files do not automatically
   install callers, packages, FMS profiles, rulesets or required checks.

Success is deliberately **configured_not_qualified**. It proves the supported
configuration is present and wired at the inspected bytes. It does not prove
full FMS semantic conformance, installed package integrity, real source coverage,
Docs Protocol admission, executable-specification registration, hosted workflow
availability/success or remote required-check enforcement. Follow the existing
Docs admission contract below and the owning qualification ledgers for those
separate claims; do not fabricate a qualified repository record.

### Accepted identity policy and runtime publication

The checker recognizes the exact alias-aware identity implementation accepted in
[central PR #386](https://github.com/agent-teams-ai/.github/pull/386), commit
`77a0f46cbfc7688cbabbe12ee819e50ba6f64234`. The shared caller template is
unchanged. The canonical owner name remains `iliya`, the sole added alias is
`Илия`, and both raw source roles require `iliyazelenkog@gmail.com`. Alternate
names, alternate emails and normalization are not admitted. This delivery does
not adopt the broader account-association proposal in PR #380 or its retained
source-bootstrap candidate in PR #383.

Existing immutable admission runtimes retain their earlier identity pin;
publishing this source does not upgrade their behavior or any consumer. A
rendered caller or `configured_not_qualified` result does not prove hosted
execution or required-check enforcement. Each consumer still needs an explicit
reviewed pin upgrade or first-installation bootstrap, its real hosted checks,
and an independently observed protection installation. Preserve active
requirements through their owning transition; do not substitute manual success
statuses, bypass or consumer policy overrides.

Admission runtime publication also has two stages: first publish the reviewed
checker source, then explicitly update the reusable wrapper's literal central
checkout to that published immutable revision and review the resulting wrapper.
The retained wrapper still checks out earlier source
`6d1fa7740d84cdf810b7c30f821c6e2ab1fd7b29`, tree
`c2a03943c9b8e3071e4cc4534614b4f8f4618d96`, whose checker requires the broader
PR #380 identity pin. That runtime is not the accepted alias-aware checker and
must not be activated for this delivery. After the reviewed checker source is
published, update and independently verify the wrapper's literal checkout and
its exact regression witness before any consumer adopts it. Consumers explicitly
adopt the final wrapper revision and accepted identity caller together, then
obtain their own hosted and required-check evidence. Missing callers remain
`incomplete` and fail closed; no pending-identity exception makes them pass.

### Independent inventory backstop

The existing six-hour, read-only organization inventory audit also reads
immutable default-branch Git trees and bounded blobs for new repositories and
explicit older opt-ins, including the canonical pending registration scope. A
centrally registered repository remains mandatory by immutable repository ID
when its caller and package opt-in marker both disappear. It finds a wholly missing caller without requiring that
caller to have run. It reports configuration failures alongside inventory drift,
including unsupported stacks pending an adapter. It never executes consumer
files or modifies consumer policy, inventory or qualification records. A
successful snapshot remains configuration observation, not continuous
enforcement or hosted qualification.

The audit retains its dedicated `ORG_INVENTORY_READ_TOKEN`, stable two-pass
pagination, complete-private-visibility assertion and fail-closed transport
behavior. Its existing workflow supplies only that dedicated credential; never
substitute interactive user, ReviewRouter or Codex credentials. Inaccessible
repositories, truncated trees, unsafe blob modes, content identity mismatches or
movement during a configuration observation fail the audit. A local fixture
cannot establish that a real credential sees the complete private inventory.

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

The temporary .github#338 Platform stable31 pending-source callback is retired
after Platform main `2c8cf54a1ed28d9ef299e999b4d0bab2cea5ba28` achieved
[Docs run 37121491053](https://github.com/agent-teams-ai/agent-teams-platform/actions/runs/37121491053)
with all four jobs successful. The
[inert failed-source receipt](../governance/evidence/docs-admission/platform-stable31-pending-source.json)
and pinned replay fixtures remain historical evidence. They grant no live
pending intent or inverse acceptance. Changed Platform rows and direct fleet
audits use ordinary strict current-source admission proof. Corresponding observed
policy binding was delivered separately in Central PR #354 before this cleanup.

## Existing exceptions

`craig-meeting-gateway` is an upstream external fork and is not modified by this
protocol. Review the exemption if the fork is detached, ownership changes, or
organization-specific documentation is added.

The active Docs exception `platform-private-required-checks-github-free` is retired:
Platform was observed public on 2026-10-19, so its private/GitHub Free rationale no
longer applies. The [dated evidence](../governance/evidence/docs-admission/platform-required-check-exception-retirement-20261019.md)
preserves the old authority coordinates and the remaining remote Docs enforcement
gap. The current v2 reference is null and the active Docs exception set is empty;
older security, Actions and executable-specification snapshot references remain
historical. Local and CI documentation checks remain mandatory. This retirement
neither installs a required-check rule nor certifies current consumer success.

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
result.

The permanent `trusted-cohort-authority-evolution-v8` context protects the
explicit current verifier inputs, including the required guard workflows,
reusable Docs workflow, imported recovery modules, both receipt verifiers,
schemas and the authority helper itself. Renames, modes, ancestor manifests,
installer controls and resolution shadows such as `scripts/node_modules/`
remain authority changes. Complete paginated metadata and Git trees, exact
same-repository revisions and a live current default-branch base are required
even for an ordinary no-op.

This verifier-authority guard permits root registry development dependencies to
evolve while all other manifest fields (including native CI commands and module
resolution), lock globals, Ajv/YAML manifest/importer bindings and the six complete
verifier package and snapshot records remain exact: `ajv@8.20.0`, `yaml@2.9.0`,
`fast-deep-equal@3.1.3`, `fast-uri@3.1.5`, `json-schema-traverse@1.0.0` and
`require-from-string@2.0.2`. Integrity and dependency edges are part of each
record. The base-owned helper executes using base dependencies; head manifest
and lock bytes are bounded, Git-identity-checked data in runner temporary
storage and are never installed or executed. This feature-local helper is
Central admission policy inside existing CI tooling, with no new module node,
manager or shared-library merge authority. Both helper and tests receive strict
compilation through `pnpm quality:typecheck` and the required `pnpm check`.
Package-edit acceptance does not grant source import admission. Governed tooling
still follows the allowed packages and dependency directions in
`docs/engineering-quality-source-policy.yaml`, enforced by `pnpm quality:boundaries`.

`trusted-validation` rejects mixed dependency/executable changes in Cohort data
mode. Its registry no-op runs before that allowlist; full append-only/live
verification and the dependency-free emergency route retain their existing
commands. Admission evidence verification retains its own data-mode allowlist.
Verifier, dependency-closure and installation-policy evolution still requires
owner-controlled delivery; unrelated dependencies can produce shared-resolution
churn that conservatively rejects. Ordinary CI changes outside protected paths
require technical review, including review of new credentials. The separate
`trusted-authority-evolution` check retains its global 32-file cap.

This S4 change requires one independently reviewed checkpoint and an
owner-controlled delivery exception bound to the exact reviewed head, because
the previous v8 and `trusted-validation` checks reject their own replacement.
Restore every required context after delivery. Keep strict/current-base
enforcement, separate owner identity rulesets, full native CI and independent
exact-head technical review. Agents receive no protection-administration
permissions; this patch alone makes no merge or deployment qualification claim.

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

1. Prepare the accepted alias-aware caller from the matching reviewed checkout,
   subject to the [publication and adoption boundary](#accepted-identity-policy-and-runtime-publication):

   ```sh
   node scripts/onboard-commit-author-identity.mjs render --revision 77a0f46cbfc7688cbabbe12ee819e50ba6f64234
   ```

   Rendering only prints the exact fixture with its placeholder replaced. It
   makes no remote or local change and does not verify remote admission. If using
   shell redirection, redirect only to a reviewed **new** destination; the shell
   can otherwise overwrite an existing file. Review and bootstrap those bytes as
   `.github/workflows/commit-author-identity.yml` on the consumer's default branch
   before activating the required status. The command never commits, pushes,
   creates repositories, or opens/merges PRs. The first installation cannot
   protect its own bootstrap PR.

2. After reviewing the selected immutable implementation, inspect the write-free
   remote plan from the matching central checkout, using authorized `gh` access:

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
   implementation bytes. Exact pins need a retained, accessible commit and the
   owning implementation's qualification. The earlier
   `6d843f3a2c3f616aa2f4b902a866b1ff1a18f9c6` qualification covers only its
   original canonical-name behavior; it does not qualify the alias-aware
   implementation. Recheck the selected revision's availability, byte compatibility and live admission
   evidence rather than switching to `main` or treating review as activation.

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
checks are unavailable because of a verified current plan-tier limitation,
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

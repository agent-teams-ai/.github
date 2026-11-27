# Governance JavaScript quality

Central's proposed migration uses exact registry Engineering Foundation 3.0.0
and the single exact stable Stack development pin in root `package.json`.
The initial qualification used `stack-toolchain@0.1.1`; retained receipts keep
that historical tuple. Stack owns the compiler,
linter, formatter and public Node preset. Adoption remains pending reviewed semantic remediation, formatting debt,
the protected-source successor and exact-head CI;
the availability catalog does not establish those results. Governance semantics remain in the
existing validators. The consumer profile admits JavaScript and TypeScript tooling and tests;
JSON, YAML and Markdown authority remain non-source. There are no production
roots, Core/Assembly adoption or SDK grants. The small strict compiler project
covers the input-proof and verifier-authority helpers, bounded quality-process
execution, the canonical test runner, and their typed tests. Legacy JavaScript remains
untyped; `typedCoverage: false` still describes the repository honestly.

`pnpm quality:doctor` reports installed tool pins. `pnpm quality:typecheck`
uses public `stack-toolchain typecheck` on the unchanged nine-entry strict
`tsconfig.tooling.json`; ordinary success stops after tsrs. Bun and the pinned
TypeScript checker selected by Stack's public toolchain manifest are sequential fallbacks only for unavailable engines
or recognized engine failures. Project diagnostics stop the command.
`tsconfig.json` extends only that same tooling program for Oxlint's normal
nearest-config discovery; it broadens neither the compiler scope nor strictness.

The existing consumer profile remains `consumer-quality-profile-v1` with
`typedCoverage: false`, not Foundation quality-v4 adoption. The public Node
preset is byte-equal to the previous released preset, but Stack's mandatory
`--type-aware` invocation enables additional semantic categories on the actual
scope. The initial census reported 139 errors (61 in frozen retained authority
sources, 78 in maintained sources). The exact four live authority sources retain
independent blob identities and their native authority/tests; the maintained
31-file lint census is checked separately. This classification proposal and the
maintained remediation require protected-source review; neither changes the
immutable source bytes nor establishes invocation equivalence. No rule override or dummy lint lane is
used to avoid them.

`pnpm format:check` uses Stack's pinned formatter on an independently derived
maintained census. The four exact frozen live verifier/source-successor files
listed in `retainedAuthoritySources` retain exact authority blobs under
ADR-0012 and the existing native historical checks. They are classified separately
from current maintained lint/format inputs; they remain in the independent source
census and the unchanged native test scopes. The nine-entry main strict project directly
includes the verifier pair; the separately retained `tsconfig.docs-source-successor.json`
lists all four, but is not claimed as a new command in `pnpm check`.
`scripts/verify-docs-admission-change.mjs` has a separate format-only retained
identity: Git blob `f3db341a5d9fc5ec74c9c3379153940db99177c0`, owned by the live
`trusted-admission-authority-evolution-v1` required workflow. That workflow admits
only one helper file at two exact historical forward/rollback blobs; formatting
it in this multi-file migration is not admitted. The helper retains its exact
main bytes and stays in the 31-file lint census, source boundaries and native
tests. Only the 97-file formatter roster classifies it separately; it is live
authority, not generated or unused code.
The gate rejects extra exclusions, dropped maintained files and hidden ignore
files. Formatting debt remains pending; the candidate does not weaken it.

`pnpm check` is the complete required route. Its prehook binds the dependency,
profile, installed source policy, critical identities and selected test files.
The census includes tracked and untracked source, so new unclassified source
cannot disappear before staging. Stack's manifest-owned Oxlint checks every tooling file
with exact debug-selection agreement and the same strict suppression options.
The selection retains every existing tooling file and typed test, and includes
the quality-process helper and its real-process tests. No exclusions or ignore
rules are added.

`pnpm quality:boundaries` invokes the installed public source-dependency CLI.
The v3 root-package profile retains the two existing owners: `scripts` and
`tools/feature-module-standard`. Both are development boundaries; scripts may
consume only the checker's explicit entrypoint. Declared roots, source inputs
and manifests must be readable regular paths. Disposable tests reject missing
roots/entrypoints, a symlinked policy and forbidden imports in explicitly
governed `dist` source. No generated directory becomes an implicit exemption.

`pnpm test:critical` invokes the existing public `agent-teams-node-test` CLI
with eight exact mandatory identities in two existing entry files. The local
adoption gate independently binds both selected files and the complete contract.
The installed runner requires registration, completion and results. Foundation
3.0.0 retains the shared correction for inherited NODE_TEST_CONTEXT from a real
Node parent test (Foundation #363/#365). The installed nested positive control
and all eight mandatory identities pass on the exact adoption candidate; Central
retains the regression and adds no environment scrubber or wrapper. Disposable
controls verify completion, omission/skip rejection and exact OS exceptions.
Central's critical inventory has no exceptions.
The complete `pnpm test` route invokes `node scripts/run-governance-tests.ts`.
Its filesystem census includes all `.test.mjs`, `.test.mts` and `.test.ts` files
under `scripts/`, plus the Feature Module Standard test. Every file belongs to
exactly one current or frozen partition; `pnpm test:input-proof` still selects
the public comparator tests directly. The installed boundary parser also receives a forbidden `.mts`
import in the existing disposable rejection test.

The repository default is official Node 26.11.1, selected through
`.node-version`, the consumer profile (`toolchain.node`) and the existing CI
file-based selection. The package engine is `>=24.18.0 <25 || >=26.10.0 <27`
(the same Node 24+26 form as the r322 tooling package) and `engine-strict`
stays on, so installs on both families are checked. Node 24 typings
(`@types/node` 24.19.1) are retained. Trusted historical governance lanes
(exact `24.21.0` allowlist in `scripts/check-community-files.mjs`), immutable
Docs Cohort runtimes/workflows, accepted ADRs and published standards retain
their original bytes and Node 24 runtimes; managed generation2 stays Node 24.
This change is a protected-path edit and is expected to be rejected by the
base-owned verifier authority check until its gate is satisfied by the
existing process.

Run `pnpm quality:scope && pnpm quality:doctor && pnpm quality:lint && pnpm quality:boundaries && pnpm quality:typecheck && pnpm format:check && pnpm test:input-proof && pnpm test:critical`
for the focused source-adoption, installed boundary, lint, strict tooling
typecheck, input-proof tests and critical execution gates. There are
no `check:changed` or `check:fast` scripts. Full qualification also requires
`pnpm check` and a successful frozen install including native prerequisites.
Historical SHA receipts are unchanged; current-input evidence is separate.

| Installed mechanism                                                            | Applicability and enforcement                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public Node preset and source boundaries                                       | Active on all declared tooling roots: `pnpm quality:lint`, `pnpm quality:boundaries`                                                                                                                                                                                                                                        |
| Source census and exact selection                                              | Active: `node scripts/check-quality-scope.mjs`, `pnpm quality:scope`; installed boundary fixtures reach the real parser                                                                                                                                                                                                     |
| Production source coverage, typed quality and default unknown-assertion bridge | N/A for production: no production roots; installed quality classification excludes development-owned tooling. No bridge admissions or weakened budgets                                                                                                                                                                      |
| Strict typed tooling                                                           | Active only for the nine explicit `.mts`/`.ts` entries in `tsconfig.tooling.json`: `pnpm quality:typecheck` invokes public Stack read-only checking with the manifest-owned TypeScript fallback with independently pinned Node 24 types 24.19.1, strict checking, no emit, no JS admission and no library-check suppression |
| Mandatory Node execution                                                       | Fail closed on proposed published Foundation 3.0.0: `pnpm test:critical`; eight exact identities, including the nested positive control, pass; exact contract and file selection also bound by the precheck                                                                                                                 |
| Registry and development-only admission                                        | `pnpm exec agent-teams-foundation assert-registry`, `pnpm exec agent-teams-foundation assert-dev-only`                                                                                                                                                                                                                      |
| SDK growth authority                                                           | N/A: no SDK owner or inventory; no grant activation or release eligibility claim                                                                                                                                                                                                                                            |
| Scaffolding, plugins and native production quality                             | N/A: no declared consumer owners/prerequisites. Renovate's existing RE2 dependency is an installation prerequisite, not a new native product boundary                                                                                                                                                                       |
| Executable specifications, contracts, governance and documentation             | Existing consumer-owned validators and complete tests remain required by `pnpm check`; the versioned pure input-proof contract has its own behavioral tests; no new documentation admission                                                                                                                                 |

The retained Consumer Module Standard has no accepting Central ADR or local
content pin to migrate. The reviewed source-packet delta is evidence only;
Foundation installation does not adopt Get Modular or change architecture.

## Bounded lint execution

`scripts/run-quality-lint.mjs` keeps the consumer's independent 31-file maintained census
and exact Oxlint debug-selection agreement, then calls Stack's public
`runCommand({ command: "lint", ... })`. The existing 120-second quality budget
is supplied explicitly. Stack owns executable resolution, installed native
bindings, strict UTF-8 capture and process cleanup through published node-or-bun;
the consumer preserves its zero-warning summary requirement and flushes captured
diagnostics before failing. An unsuccessful report never becomes success.

The direct Oxlint and compiler dependencies are removed; the one Stack package
owns their pins. `scripts/quality-process.ts` retains the bounded process helper
for independent selection and real-process regression tests. The CLI fixture
now carries the actual Stack configuration and registers its additional
disposable inputs in both censuses. Its complete positive/diagnostic-batch
qualification remains required after the adoption debt is resolved.

The nine strict compiler entries, exact mandatory identities, existing complete
test partitions and all immutable historical files remain. This proposal does
not establish process-tree supervision of arbitrary descendants, new production
ownership or Docs Cohort admission.

## Complete tests and frozen successor preservation

`pnpm test` uses the native `node:test.run` API and official TAP reporter. Output
streams directly with backpressure rather than waiting inside the lint helper's
120-second/4 MiB capture policy. The two partitions share a ten-minute deadline;
failures, cancellation, omitted files and duplicate file completion reject. The
runner does not scrub environment variables. Native recursive test-worker calls
reject explicitly rather than silently running no files.

The frozen `scripts/check-docs-source-successor-v1.test.mts` is restored verbatim
to Git blob `281032ebb0afecd5bb425f7f4018c99b20ee6635`. Its one execution uses
the original absolute file path and a disposable working directory containing
`package.json` and `pnpm-lock.yaml` from exact revision
`5abed741aff64506d0e9f87f76541a4e93af7e4a`, plus the two unchanged current
workflow YAML files that the test reads relative to cwd. Its imports and Git
queries still resolve against the real repository and history. No test source,
workflow, historical hash or verifier implementation is patched or skipped.
All remaining current tests run once with the real repository cwd.

`node --test scripts/run-governance-tests.test.ts` verifies the full-extension
census, exact partition coverage, duplicate/omission rejection, real native
execution across distinct cwd values, failure propagation and historical input
bytes. To run the original frozen test alone, create its cwd through the exported
`createHistoricalTestCwd` helper and pass its absolute repository path to
`runGovernanceTestBatch` from an ordinary Node process; always await cleanup.

PostgreSQL and pg-boss are N/A: this consumer runs finite local/CI commands and
has no durable job queue, database state or persistent worker owner. Adding them
would not improve this execution contract.

Functional validation is separate from protected-source admission. The current
base-owned source guard protects the lint launcher and adoption profile; this
change requires its reviewed successor/transition route before merge. Passing
the process tests does not waive that guard or renew governance exceptions.

## Shared qualification input proof checkpoint

`scripts/qualification-input-proof.mts` exports the version-1 readonly schema and
`compareQualificationInputs(expected, qualified, current)`. It retains Central's
identity/origin/fingerprint wrapper and delegates leaf relations to the public
`@agent-teams/ci-input-proof@0.1.0-rc.0` development dependency. This exact,
qualified RC pin is a fixed library dependency within the existing tooling owner;
it introduces no Core/Assembly boundary, new package release or merge authority.
Neither the future historical Runtime selector nor Central owner merge guard is
implemented or activated by this checkpoint.

The kernel compares independent expected F to each proof separately. Qualified F
permits no content changes; current H uses the existing structural permissions.
Structural rejection across either relation precedes content rejection. Raw own
data arrays and record fields are checked before copying: accessors, custom array
iterators, holes and extra keys reject without normalization. Executable Proxies
and modified JavaScript intrinsics are outside this inert-input contract.
The kernel additionally rejects drive-prefixed paths conservatively. Consumers
must use the exact dependency and lock integrity, never the registry `latest` tag.

Independent adapter context supplies repository, current candidate H, full-main
ancestor F, five canonical SHA256 fingerprints (suite, policy, implementation,
toolchain and installed graph), both exact Actions run/attempt/workflow revision/
source revision origins, a complete inventory count, an independently obtained
F leaf inventory and permitted content paths. Both proof inventories are checked
against those independent path/type/mode/membership/content coordinates.
The installed-graph fingerprint must bind actual executable bytes and their
resolved graph, not package versions alone. Each record includes every admitted
Git leaf with exact path, type, mode, closed/structural membership and SHA256
content. Qualified candidate/source equals F; current candidate/source equals H.
Input sets are nonempty, include closed inputs and have a 65,536-entry ceiling;
paths are bounded to 4,096 characters and compared exactly without normalization.
Counts come from an independently obtained complete inventory. Self-declared
counts or a closed flag cannot establish completeness. Directory tree OIDs are
excluded from unchanged-leaf proof because a permitted leaf changes parent trees.

Only a permitted structural leaf may change content; path/type/mode/membership
remain exact and every closed input stays exact. Duplicate, missing, malformed,
unsupported or changed evidence returns a deterministic conservative rejection.
The exported result `omitted-unchanged-inputs` records an omission basis, never
execution success or passed test identities. Evolution changes the contract
version; unknown versions reject without coercion or silent entry removal.

Adapters own Git objects, canonical hashing, complete closed-input selection and
Actions authentication. Receipt/schema agreement, including an `authenticated:
true` assertion, is never authenticated origin evidence. The pure helper cannot
establish live full-main success/ancestry, known-red current main, pending-main
common changes, accumulated F..H and PR B..H policy or all required current-H
checks. Those adapter trials and merge/routing protections, full main/nightly/
common-change behavior and measured eligible-small-PR timing remain unqualified.

`pnpm quality:typecheck` runs public `stack-toolchain typecheck` on the exact
strict tooling project, with sequential classified fallback. Node 26.11.1 type stripping executes `.mts` tests but does not
replace compilation. The focused `pnpm quality:typecheck` and `pnpm test:input-proof` run both gates; required
`pnpm check` runs strict compilation and all tests including the explicit `.mts`
glob. Public helper tests cover independent drift and malformed/replayed records;
actual Git and tampered Actions trials remain for the two real adapters.

### Documentation merge timing: native owner route (2026-11-25 UTC)

Owner direction was recorded on 2026-11-25. On 2026-11-26 the ten native
owner grants were installed and read back by the owner. The compatible policy,
immutable v4 source, installed Central caller and permanent v4 enforcement
remain in place. Installation and export validation are recorded in the
[dated owner-grant report](../governance/evidence/docs-source-successor/native-owner-grants-20261126.md).
A subsequent Central owner PR merge bypassed a still-unsatisfied required
check, as recorded by the GitHub rule suite. Both resulting-main CI runs passed.
The [dated owner-grant report](../governance/evidence/docs-source-successor/native-owner-grants-20261126.md)
distinguishes this proof from an earlier merge that did not establish bypass.
This is one practical Central qualification, not six repository E2E trials.
The [dated permanent-enforcement and deferred-delivery evidence](../governance/evidence/docs-source-successor/runtime-admission-source-successor-v4-permanent-owner-delivery-20261126.md)
records the completed work, rejecting canaries, required-check blocking
observations, subsequent hosted checks and the steps deferred at that observation.

Central requires `runtime-admission-source-successor-v4`. Its main caller pins
immutable source `72fa7a8af02e9ba7904c912f0bbb457254381002`. The compatible policy
and audit were merged in [PR #423](https://github.com/agent-teams-ai/.github/pull/423)
as `e35df6a3fcf4d5e33d0f79b5b27c3a3e454b5d56`; the three-file installation was
merged in [PR #428](https://github.com/agent-teams-ai/.github/pull/428) as
`7ad5abbf5a8dade79f91f3e6f06481070b966a9e`. The permanent transition retained
Central's other App `15368` contexts, strict and creation enforcement, PR
protections and immutable source locks. Runtime v2's source, caller and
historical records remain. Here v4 names the governance admission mechanism;
it does not establish Agent Runtime v3, live extension updates or product-scale
qualification.

The installed entry is exactly
`{"actor_id":13103045,"actor_type":"User","bypass_mode":"pull_request"}`.
It permits the authorized owner to merge an eligible reviewed PR while checks
are pending, subject to the applicable GitHub rules and the assigned scope. GitHub applies
this grant to matching PRs for that account; it does not enforce a documentation
content boundary. The configured mode is `pull_request`; the actual owner-reader
result was `pull_requests_only` for each of the ten rulesets.

| Repository                 | Installed target rulesets | Existing state outside the grant                                          |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `.github`                  | `19979783`, `24363205`    | Final v4-only source requirement; other main protections and source locks |
| `engineering-foundation`   | `19979782`, `24372286`    | Other fields and actors, including CodeQL App `57789`                     |
| `agent-runtime`            | `24363207`                | Existing User `13103045 / always` in `19979781`; history rule `26556591`  |
| `agent-teams-platform`     | `24363204`                | Other fields and actors                                                   |
| `agent-teams-orchestrator` | `19979784`, `24363212`    | Other fields and actors                                                   |
| `extension-foundation`     | `20807525`, `24363213`    | Other fields and actors                                                   |

Research receives no new grant. Other repositories require their own observed
proposal. The dated report records the seven-repository preservation comparison.
Before grant use, verify the current actor, exact PR head/base,
complete source commit identities and applicable live rules.

The native owner route remains limited to specifically assigned, reviewed
documentation and any wider delivery scope explicitly authorized by the owner. It does not
authorize agents to choose more work, bypass known substantive findings,
perform releases or push directly to protected main. Other actors retain the
existing required gates. Ongoing and postmerge verification still completes;
early merge must not report pending or omitted tests as successful.

The canonical identity policy retains `ruleset.bypass_actors: []` as its
installation default. The compatible audit also accepts only the exact optional
owner PR-only profile on the six named repositories. Policy acceptance does not
install that profile. Other actors, modes, repositories and rule drift still
reject. Onboarding creates the no-bypass default and preserves existing rules;
it does not install the grant. Immutable source locks retain no bypass.

At the dated identity-compatibility observation `2026-11-26T01:55:38Z`, all six
current identity callers resolved to the same reusable workflow bytes.
That implementation reads current central policy and the caller template from
one observed main revision, rechecks their blobs before success, and does not
execute a frozen CLI audit or read ruleset bypass actors. Those observed
consumer pins required no upgrade for the compatible policy. Settings readback
must use the current compatible audit; the older CLI audit at a historical
consumer pin is not the implementation executed by its reusable identity job.
The current identity export and exact v4 source export passed against the actual
owner-full after snapshots, as recorded in the dated report.

For each eligible assigned PR, follow the existing
[owner merge route](../GOVERNANCE.md#github-plugin-merge-route): freshly verify
User/777genius, the non-draft owner PR, reviewed head/base and complete commit
list; resolve blocking findings; preserve exact head matching, squash
attribution and the complete reviewed message. Use a supported authenticated
ordinary single-PR merge surface. The installed exception applies only within the assigned scope; do not infer practical early
merge qualification from installation alone.

The [official asynchronous merge API](https://docs.github.com/en/rest/pulls/pulls?apiVersion=2026-03-10#merge-a-pull-request-asynchronously)
is separately unqualified and deferred here; it is not a fallback for current
delivery. That API can merge every open downstack PR when its target belongs
to a stack. An exact target `sha` does not restrict the operation to that one PR.
A future stacked route would require explicit assignment and complete review
of the entire affected PR set, plus separate qualification of the merge
transport, its authorization, attribution and result verification. Whole-set
review alone does not qualify the transport. Do not substitute an asynchronous
or stacked route for the ordinary route, or claim a connector accepts
unsupported inputs.

Follow the actual operation to a merged result. An accepted request or queued
operation is not a merge. Verify main parent/tree, actual author and committer,
full message and issue references. Finish the existing ongoing and postmerge
checks on the resulting main commit and report their outcomes separately.

An early merge or a metadata edit on a closed PR can leave an open-PR snapshot
or admission job collecting evidence for a closed target or changed metadata.
Record its actual outcome and reason alongside the resulting main checks;
a closed-target rejection is not successful validation. Do not rerun a closed
target solely to seek a green open-PR guard. Investigate any unrelated failure
through the existing route.

**Historical preparation observation — 2026-11-25.** At that time Central's
protected no-wait route was unmet: the then-current audit and immutable source
required no bypass, and the session had no authenticated settings-write channel.
Research's authorized direct-main route already worked. The read-only
observation at Central `3d0a134e326f22ff867b418d64554167287638c8` found
[Protect main](https://github.com/agent-teams-ai/.github/rules/19979783) and
[commit identity](https://github.com/agent-teams-ai/.github/rules/24363205)
requiring six current-head contexts from integration `15368`, strict
current-base checks, empty bypass lists and actor result `never`. The owner had
repository admin permission; `allow_auto_merge` was false. Those values describe
that historical observation, not a new full settings audit or a grant readback.

The retained [v2 cutover record](../governance/evidence/docs-source-successor/runtime-admission-source-successor-v2-cutover.md)
records source `6863c4b6e9f17b3a668e0afb9ff33cb9046788d0` and the actual
rejecting policy canary #402. The [ADR-0018 installation snapshot](decisions/0018-bounded-runtime-admission-source-successor-v4.md)
and its [evidence](../governance/evidence/docs-source-successor/runtime-admission-source-successor-v4-installation.md)
remain unchanged; the earlier dated observation records subsequent installation,
permanent enforcement, hosted results and the then-deferred grants. Public responses
omitting private bypass fields are not owner-full observations. The original
[individual-user ruleset support](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/)
and [REST schema](https://docs.github.com/en/rest/repos/rules?apiVersion=2026-03-10#update-a-repository-ruleset)
references remain applicable to the native grant.

| Optional alternative                 | Timing and remaining work                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Native auto-merge                 | [Enable auto-merge](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository) and preserve exact-head review and attribution; it removes manual waiting but all required checks still precede merge |
| B. Qualified shorter inert-docs path | Scope and qualify existing source/input-proof adapters and the required aggregate; trusted classification, identity and admission checks still precede merge, with possible runner waiting                                                                                                                                     |

A and B have different timing and do not fulfill the literal request. They are
optional alternatives, not a new mandatory owner choice. B requires an explicit
inert-content scope; authority-bearing instructions, governance, contracts,
security/release policy and executable examples cannot use an inert-docs shortcut.
The checkpoint's complete inventory and authenticated head/base/source obligations
still govern any input-proof reuse; omission never means tests ran successfully.
The native grant and A's setting alone have production/test LOC P = T = 0;
the necessary policy/audit compatibility and source qualification add code and
tests. Their exact reviewed diff and evidence belong to the implementing change.
End-to-end qualification effort and engineer-days remain unknown; B's P, T and
days are unestimated pending scope. The existing source-successor mechanism owns
this integration; no new writer platform is proposed.

## npm publication contract tests

`scripts/npm-publish.test.mts` joins the exact strict compiler entries and the
existing full `.mts` test selection. It executes the production reusable workflow
shell against disposable archives and fake registry IO. It rejects origin drift,
manifest and archive identity/hash drift, traversal, duplicates, a missing second
archive and mismatched same-run promotion receipts before effects. It verifies
read-only reconciliation, one upload invocation after absence, delayed tarball
visibility, preservation after an uncertain upload and idempotent promotion.
It also verifies exact completed-workflow admission, current-main rejection,
rerun refusal, prior/expired/over-limit intent replay guards, successful intent
retirement, rejection of unrelated artifact cleanup, newer/unexpected latest
refusal, delayed alias readback without repeating the tag write, mandatory
per-package OIDC exchange (including anonymous-read false positives), second-package
exchange failure before any upload, embedded success-marker rejection, a real
whole-process timeout with a TERM-resistant child and removal of private auth
diagnostics. These local
contract tests do not claim GitHub OIDC or npm E2E qualification.

The formatter roster also includes the current Docs protocol workflow, generation 3
policy mapping and policy schema maintained by this adoption. Their omission is
a rejecting quality-scope test; retained Cohort records and accepted ADRs keep
their exact bytes.

## Single Stack dependency authority

The custom schema1 profile references `devDependencies.stack-toolchain` in root
`package.json` and the public `stack-toolchain/toolchain-manifest.json`; it does
not copy Stack or companion release numbers. The precheck binds the canonical
stable registry pin to consumer-local real package metadata and public doctor
observations. It rejects duplicate declarations, escaping resolution, unsupported
manifest/config/doctor schemas and inconsistent installed companion findings.
A compatible ordinary update changes the root Stack pin and generated lock only;
it still requires frozen installation, artifact review and actual required CI.
The matching-future-pin fixture proves only this binding relation, not future
package execution or qualification. Node, pnpm, Node types, strict entry scope,
retained authorities and the `typedCoverage: false` policy remain independently
owned. This remains `consumer-quality-profile-v1`, not quality-v4 adoption.

## Dependency build decisions

`pnpm-workspace.yaml` explicitly sets `allowBuilds.bun: false`. Bun's wrapper
postinstall stays denied; Stack resolves and version-checks its published optional
native Bun binary directly. Existing `core-js-pure: false`,
`dtrace-provider: false` and approved `re2: true` decisions remain unchanged.
The precheck rejects a missing Bun decision, build permission expansion, legacy
allowlists and global script/strict-build bypasses. CI retains ordinary
`pnpm install --frozen-lockfile`; it does not globally suppress lifecycle scripts.

The local nohooks installation and native-binary doctor are preparation evidence.
They do not qualify an ordinary full installation: existing approved re2 remains
pending locally, and its normal build plus the complete frozen installation must
pass actual required CI. No new build script is authorized by this change.

## Runtime and admission integration recovery

This integration retains Foundation 3.0.0 and Stack 0.1.1 ownership. Its strict
program includes 21 entries and its maintained type-aware lint census includes
43 files. Historical authority sources and the four process/test helpers remain
byte-identical to the installed main basis.

The metadata-only compiler preflight follows the real Stack and Foundation
compiler owners before Foundation execution. It does not restore a root compiler,
legacy extractor or an older Foundation toolchain. Renovate 44.24.2 is isolated
in `tools/renovate-validation`, with managed Node 24.21.0 and a mandatory real
native RE2 load. Root checks cannot silently install dependency drift.

The old PR390 activation tuple is historical, not applicable to installed v3.
New protected compiler/admission/toolchain inputs require a separately reviewed
finite successor, fresh positive/negative qualification and an add-before-retire
transition. This functional candidate does not activate its own authority.

## Bounded policy 3.1 runtime source support

The selected strict program now has 23 entries and the maintained lint census
has 45 files. `scripts/docs-managed-runtime-policy.ts` and its test join the
existing compiler project, lint and format census, and native test runner. They
own only the closed policy3.0.0/3.1.0 runtime mapping and trusted workflow Node
selection. Existing registry, receipt and workflow adapters retain their legacy
JavaScript format for these localized call-site changes; those adapters remain
outside the strict TypeScript program and are not newly claimed as typed.
Migrating their unrelated parsing and network responsibilities would expand this
bounded change. The new responsibility itself is strictly typechecked.

The helper has positive historical/patched cases and rejecting unknown-policy,
cross-paired tuple, missing authority and caller/environment selector tests.
Existing integration fixtures exercise both receipt policies and pending
upgrade/rollback source selection. The four-job capability split, immutable
archives, registry data and historical digest domains remain owned by their
existing gates. ADR-0019 records protected-source admission and actual package
qualification as separate delivery requirements; local success does not satisfy
them.

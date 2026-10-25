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

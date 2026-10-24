# Governance JavaScript quality

Central adopts the exact registry Engineering Foundation 1.10.0 development
package and its public Node lint preset. Governance semantics remain in the
existing validators. The consumer profile admits JavaScript and TypeScript tooling and tests;
JSON, YAML and Markdown authority remain non-source. There are no production
roots, Core/Assembly adoption or SDK grants. The small strict compiler project
covers the input-proof and verifier-authority helpers, bounded quality-process
execution, the canonical test runner, the compiler preflight, repository
admission and registration, the bounded remote bootstrap observer, the isolated
Renovate launcher, and their typed tests. New registration and observer
responsibilities live in ordinary
`.ts` modules; retained JavaScript entrypoints contain only their narrow import,
export and validator bindings. Legacy JavaScript remains
untyped; `typedCoverage: false` still describes the repository honestly.

New maintained code for JavaScript runtimes follows
[the organization TypeScript rule](engineering-quality-standard.md#typescript-for-javascript-runtimes).
The compiler preflight and its inert tests are included in the existing strict
tooling project as ordinary `.ts` files; the root `package.json` owns their ESM
contract through `"type": "module"`. The existing qualification-input-proof,
check-docs-verifier-authority and check-docs-source-successor-v1 `.mts` source/test
pairs predate this feature. They stay in their existing owners and commands;
renaming those unrelated contracts is outside this bounded change. Their legacy
extensions remain a documented gap; new ordinary maintained code uses `.ts`.
The bounded changes to the legacy adoption checker retain its
current JavaScript scope; migrating that full checker would expand this policy
change. Its untyped coverage remains explicit rather than being renamed away.

## Current compiler dependency preflight

`scripts/compiler-floor.ts` reads only JSON manifests through each dependency
owner's resolution path before any Foundation implementation loads. It runs
first in `precheck` and before the existing direct `quality:boundaries` and
`test:critical` commands; their complete obligations remain after the guard.
Installed-CLI test fixtures also check it before spawning either CLI. A blocked
preflight is a failure to run those gates, never a successful negative fixture.

The previous integrity-verified
[Foundation 1.7.2 registry archive](https://registry.npmjs.org/@agent-teams/engineering-foundation/-/engineering-foundation-1.7.2.tgz)
has an eager command-host import of its public-API audit adapter. That adapter imports
[API Extractor 7.58.12](https://registry.npmjs.org/@microsoft/api-extractor/-/api-extractor-7.58.12.tgz) and its pinned loader uses
the extractor-owned TypeScript 5.9.3 implementation. The Node test CLI also
imports that command host. The workspace compiler's 7.0.2 pin does not replace
that embedded copy; the preflight rejects it before either tool initializes.

The current [Foundation 1.10.0 registry archive](https://registry.npmjs.org/@agent-teams/engineering-foundation/-/engineering-foundation-1.10.0.tgz)
and [committed lock](../pnpm-lock.yaml) instead pin the native TypeScript 7.0.2
compiler directly, without the legacy API Extractor engine. The preflight binds
Foundation's exact compiler and platform package, resolves its async and AST
entrypoints, and rejects compiler-bearing API-model dependencies. Legacy refusal
fixtures remain unchanged. No old compiler execution, dependency override or
frozen-evidence rewrite is authorized by this current dependency update.

The metadata guard's inert fixture tests and the owning strict typecheck may
run independently. Node type stripping executes the guard; it does not prove
its types. No new aggregate, enforcement framework or required identity is
introduced, and existing immutable evidence remains unchanged.

## Existing quality route

`pnpm check` is the complete required route after the explicit root and isolated
Renovate [bootstrap](node-runtime-compatibility.md#explicit-installation-and-runtime-ownership).
Checks reject dependency drift instead of implicitly installing packages. Its
prehook binds the dependency, profile, installed source policy, critical identities and selected test files.
The census includes tracked and untracked source, so new unclassified source
cannot disappear before staging. Oxlint 1.85.0 still checks every tooling file
with exact debug-selection agreement and the same strict suppression options.
The derived selection retains every existing tooling file and typed test,
including the compiler preflight, repository admission and registration, and the
bounded bootstrap observer and isolated Renovate launcher. The adoption checker
binds its exact census. No exclusions or ignore rules are added.

`pnpm quality:boundaries` invokes the installed public source-dependency CLI.
The v3 root-package profile retains `scripts` and
`tools/feature-module-standard` and declares the isolated
`tools/renovate-validation` package. These are development boundaries; scripts may
consume only the checker's explicit entrypoint. Declared roots, source inputs
and manifests must be readable regular paths. Disposable tests reject missing
roots/entrypoints, a symlinked policy and forbidden imports in explicitly
governed `dist` source. No generated directory becomes an implicit exemption.

`pnpm test:critical` invokes the existing public `agent-teams-node-test` CLI
with eight exact mandatory identities in two existing entry files. The local
adoption gate independently binds both selected files and the complete contract.
The installed runner requires registration, completion and results. Foundation
1.7.2 includes the shared correction for inherited NODE_TEST_CONTEXT from a real
Node parent test (Foundation #363/#365). The installed nested positive control
and all eight mandatory identities pass on the exact adoption candidate; Central
retains the regression and adds no environment scrubber or wrapper. Disposable
controls verify completion, omission/skip rejection and exact OS exceptions.
Central's critical inventory has no exceptions. The retained 1.7.2 adoption results
describe their recorded candidate; current-input qualification runs the same
installed controls against the exact native dependency.
The complete `pnpm test` route invokes `node scripts/run-governance-tests.ts`.
Its filesystem census includes all `.test.mjs`, `.test.mts` and `.test.ts` files
under `scripts/`, plus the Feature Module Standard test. Every file belongs to
exactly one current or frozen partition; `pnpm test:input-proof` still selects
the public comparator tests directly. The installed boundary parser also receives a forbidden `.mts`
import in the existing disposable rejection test.

The repository default is official Node 26.11.1, selected through
`.node-version`, the consumer profile (`toolchain.node`) and the existing CI
file-based selection. The package engine is `>=24.18.0 <25 || >=26.10.0 <27`.
pnpm 11's effective workspace YAML enables strict engines, strict peers and exact
saved versions; `.npmrc` alone does not enforce those settings. Frozen root
installs on both families are checked. Renovate `44.24.2` is installed separately
and runs only through its exact managed Node `24.21.0` runtime and native RE2
preflight. Node 24 typings
(`@types/node` 24.19.1) are retained. Trusted historical governance lanes
(exact `24.21.0` allowlist in `scripts/check-community-files.mjs`), immutable
Docs Cohort runtimes/workflows, accepted ADRs and published standards retain
their original bytes and Node 24 runtimes; managed generation2 stays Node 24.
This change is a protected-path edit and is expected to be rejected by the
base-owned verifier authority check until its gate is satisfied by the
existing process.

Run `pnpm quality:scope && pnpm quality:lint && pnpm quality:boundaries && pnpm quality:typecheck && pnpm test:input-proof && pnpm test:critical`
for the focused source-adoption, installed boundary, lint, strict tooling
typecheck, input-proof tests and critical execution gates. There are
no `check:changed` or `check:fast` scripts. Full qualification also requires
`pnpm check` and a successful frozen install including native prerequisites.
Historical SHA receipts are unchanged; current-input evidence is separate.

| Installed mechanism | Applicability and enforcement |
| --- | --- |
| Public Node preset and source boundaries | `pnpm quality:lint` covers all selected tooling; `pnpm quality:boundaries` retains its declared roots and runs after the compiler preflight |
| Source census and exact selection | `node scripts/check-quality-scope.mjs` remains usable independently. `pnpm quality:scope` retains the installed boundary/runner fixtures against the exact current dependency |
| Production source coverage, typed quality and default unknown-assertion bridge | N/A for production: no production roots; installed quality classification excludes development-owned tooling. No bridge admissions or weakened budgets |
| Strict typed tooling | Active for the explicit `.mts`/`.ts` entries enumerated in `tsconfig.tooling.json` and the consumer profile: `pnpm quality:typecheck` invokes exact TypeScript 7.0.2 with Node 24 types 24.19.1, strict checking, no emit, no JS admission and no library-check suppression |
| Mandatory Node execution | `pnpm test:critical` retains the eight exact identities and original contract. Their prior adoption result, including the nested positive control, is historical; current qualification binds the exact native dependency |
| Registry and development-only admission | Both manual routes retain the same preflight: `node scripts/compiler-floor.ts && pnpm exec agent-teams-foundation assert-registry`; `node scripts/compiler-floor.ts && pnpm exec agent-teams-foundation assert-dev-only` |
| SDK growth authority | N/A: no SDK owner or inventory; no grant activation or release eligibility claim |
| Scaffolding, plugins and native production quality | N/A: no declared consumer owners/prerequisites. Renovate's existing RE2 dependency is an installation prerequisite, not a new native product boundary |
| Executable specifications, contracts, governance and documentation | Existing consumer-owned validators and complete tests remain required by `pnpm check`; the versioned pure input-proof contract has its own behavioral tests; no new documentation admission |

The retained Consumer Module Standard has no accepting Central ADR or local
content pin to migrate. The reviewed source-packet delta is evidence only;
Foundation installation does not adopt Get Modular or change architecture.

## Bounded lint execution

`scripts/run-quality-lint.mjs` uses the public Node adapter from
[`agent-teams-ai/process-runtime`](https://github.com/agent-teams-ai/process-runtime),
published as the exact development dependency `node-or-bun@0.2.1`. The small
typed `scripts/quality-process.ts` helper owns Central's quality-command policy;
the library owns process execution, output capture and cleanup. This is an
adoption within the existing governance-tooling boundary, with no production
dependency or new package owner.

Both actual Oxlint invocations retain argument arrays, the repository working
directory, inherited environment, strict suppression options and exact source
selection. They now have a 120-second deadline instead of an unbounded wait.
Capture is bounded at the library's 4 MiB per stream, replacing the previous
2 MiB `execFile` limit. UTF-8 decoding is strict: invalid output rejects rather
than producing replacement characters. Nonzero exit or signal termination also
rejects; the public executor deliberately reports those as results, so the
consumer must not mistake completion for a passed quality gate.

Captured diagnostics are non-enumerable on failures and are printed explicitly
by the lint CLI before it exits unsuccessfully. The CLI awaits stream write
completion before rethrowing, so piped CI diagnostics drain before Node exits.
Timeout, cancellation, output
overflow and decoding failure remain failures even if the child subsequently
exits. The shared executor owns bounded TERM/KILL cleanup and reports unresolved
custody; the consumer never converts cleanup uncertainty into success.

This guarantee covers the directly owned child. The pinned Oxlint 1.85.0 Node
entrypoint loads its native binding in that process. It does not establish a
process-tree supervision contract for arbitrary plugins or descendants.

`node --test scripts/quality-process.test.ts` exercises real child processes:
argument and working-directory fidelity, inherited and exact environments,
nonzero/signal failures, launch failure, deadline and cancellation, concurrent
bounded capture, and malformed UTF-8. It independently checks that owned child
PIDs disappear before fallback fixture cleanup. A disposable repository runs
the actual lint CLI with installed Oxlint for both a passing input and a real
rejecting lint diagnostic, including a large batch whose complete output must
survive the failing CLI exit. Synthetic sentinels are used in environment tests.

The strict compiler gate includes the helper, real-process tests and canonical
test runner with its focused tests. New source uses `.ts`; existing frozen `.mts`
files keep their original paths and bytes.

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

`pnpm quality:typecheck` runs `tsc --project tsconfig.tooling.json` from the exact
pinned public compiler. Node 26.11.1 type stripping executes typed tests but does not
replace compilation. The focused `pnpm quality:typecheck` and `pnpm test:input-proof` run both gates; required
`pnpm check` requires strict compilation and the complete discovered current and
frozen test partitions, including both `.mts` and `.ts` tests.
Public helper tests cover independent drift and malformed/replayed records;
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

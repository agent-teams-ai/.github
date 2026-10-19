# Governance JavaScript quality

Central adopts the exact registry Engineering Foundation 1.10.0 development
package and its public Node lint preset. Governance semantics remain in the
existing validators. The consumer profile admits JavaScript and TypeScript tooling and tests;
JSON, YAML and Markdown authority remain non-source. There are no production
roots, Core/Assembly adoption or SDK grants. The strict compiler project covers
its explicitly listed typed tooling entries and tests. Legacy JavaScript remains
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

`pnpm check` is the complete required route. Its prehook binds the dependency,
profile, installed source policy, critical identities and selected test files.
The census includes tracked and untracked source, so new unclassified source
cannot disappear before staging. Oxlint 1.85.0 still checks every tooling file
with exact debug-selection agreement and the same strict suppression options.
The derived selection contains 32 files: all 28 tooling files and four typed
test files. No exclusions or ignore rules are added.

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
1.7.2 includes the shared correction for inherited NODE_TEST_CONTEXT from a real
Node parent test (Foundation #363/#365). The installed nested positive control
and all eight mandatory identities pass on the exact adoption candidate; Central
retains the regression and adds no environment scrubber or wrapper. Disposable
controls verify completion, omission/skip rejection and exact OS exceptions.
Central's critical inventory has no exceptions. The retained 1.7.2 adoption results
describe their recorded candidate; current-input qualification runs the same
installed controls against the exact native dependency.
The complete `node --test` route retains existing files and explicitly includes
both `scripts/*.test.mts` and `scripts/*.test.ts`; `pnpm test:input-proof` selects
the new public comparator tests directly. The installed boundary parser also
receives a forbidden `.mts` import in the existing disposable rejection test.

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
| Strict typed tooling | Active for the explicit entries in `tsconfig.tooling.json`: `pnpm quality:typecheck` invokes exact TypeScript 7.0.2 with Node 24 types 24.19.1, strict checking, no emit, no JS admission and no library-check suppression |
| Mandatory Node execution | `pnpm test:critical` retains the eight exact identities and original contract. Their prior adoption result, including the nested positive control, is historical; current qualification binds the exact native dependency |
| Registry and development-only admission | Both manual routes retain the same preflight: `node scripts/compiler-floor.ts && pnpm exec agent-teams-foundation assert-registry`; `node scripts/compiler-floor.ts && pnpm exec agent-teams-foundation assert-dev-only` |
| SDK growth authority | N/A: no SDK owner or inventory; no grant activation or release eligibility claim |
| Scaffolding, plugins and native production quality | N/A: no declared consumer owners/prerequisites. Renovate's existing RE2 dependency is an installation prerequisite, not a new native product boundary |
| Executable specifications, contracts, governance and documentation | Existing consumer-owned validators and complete tests remain required by `pnpm check`; the versioned pure input-proof contract has its own behavioral tests; no new documentation admission |

The retained Consumer Module Standard has no accepting Central ADR or local
content pin to migrate. The reviewed source-packet delta is evidence only;
Foundation installation does not adopt Get Modular or change architecture.


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
`pnpm check` requires strict compilation and all tests, including the explicit
`.mts` and `.ts` globs, after its compiler dependency block is resolved.
Public helper tests cover independent drift and malformed/replayed records;
actual Git and tampered Actions trials remain for the two real adapters.

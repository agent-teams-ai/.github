# Native-ready architecture: scoped delivery and qualification plan

Status: owner-confirmed direction and staged implementation plan, 2026-11-24.
The owner accepted high-leverage, low-friction portability and authorized
bounded implementation of this plan, starting with existing mechanisms and
one actual Core experiment. This is not approval of a compiler, runtime,
public SPI, package release, new mandatory CI gate, or blanket migration.
The common practices live in the
[Engineering Quality Standard](../engineering-quality-standard.md#native-and-aot-readiness).
This document owns the rationale, candidate work and evidence, not a second
normative standard. Follow the existing
[ecosystem vision](ecosystem-vision.md), repository decisions and adoption gates.

## 1. Outcome and scope

Retain ergonomic TypeScript as the main application language. Make a selected
algorithm, capability or deployable component replaceable by a compiled TS,
Rust/Go or Wasm implementation when there is a measured or concrete benefit.
Preserve independently useful libraries and product authority. Minimize the
future cost of changing the execution target, not the number of TS features
used today. Native compilation of TS is not the same thing as translating to
Rust source, cross-language invocation, or safe hot unloading.

Keep application behavior, composition, execution, distribution, and
state/authority decisions separate. Compiling an application as one native
binary does not require every internal call to become a wire call. A binary
also does not make arbitrary modules replaceable after linking.

Non-goals: universal IDL, runtime, transport, ABI, plugin registry, dependency
injection framework, compiler abstraction or new policy engine; compulsory
Rust/Wasm/scriptc support; adding a package, interface, schema, mapper or
profile per feature; a blanket migration of existing code; alternate copies
of algorithms or lifecycle authority; changing FMS/ADR/evidence bytes,
TypeScript floor, package pins, product custody, or external consumer defaults.
No test-only implementation may be represented as production adoption.

## 2. Decide the boundary before choosing the representation

| Situation | Default design | Additional obligation |
| --- | --- | --- |
| Ordinary TS function, feature, UI, repository or SDK | Natural typed API and existing architecture | None from native readiness; do not add DTOs or serialization |
| Selected portable computation (e.g. graph, parser, policy) | Explicit inputs, deterministic semantics, ordinary TS implementation | Avoid unnecessary ambient/platform coupling; keep actual limits and dependencies visible |
| Same-language AOT target | Compile the actual reachable entrypoint with normal language semantics | Prove compatibility for the exact toolchain/target and reachable runtime dependencies |
| Real IPC, FFI, Wasm, or separately versioned state boundary | Owner-defined protocol, adapter and negotiated capabilities where needed | Specify and validate data, failure, ownership, compatibility, resource and lifecycle semantics |

These are decision contexts, not mutually exclusive maturity levels, runtime
tags, a new profile schema, or a requirement to classify every file. A
portable computation can still be stateful; an AOT target can deliberately use
platform APIs. Ordinary TS APIs may return Promise, AsyncIterable, Effect,
classes and AbortSignal. A same-process port may be synchronous. Do not
introduce async, serialization, fake remote errors, or DTO mapping on the
hypothesis that it might one day be remote. A remote implementation with
different latency/failure semantics requires a real compatible boundary or an
explicit contract evolution, not a weaker Liskov substitute.

Use the existing owner decision/plan for a consequential choice; no routine
PR checklist or additional approval ceremony. For two comparably clear,
correct and efficient designs, prefer the one with fewer unnecessary runtime
assumptions. If the portability option is materially worse, choose the simpler
current design and retain its intentional boundary.

## 3. Candidate rules and proportionality

Scores are design judgments: value / additional daily coding complexity
(10 is highest). They do not measure compiler coverage or reliability.

| Rule | Value / burden | Apply to | Enforcement candidate |
| --- | --- | --- | --- |
| Explicit semantic inputs/results and ownership | 10 / 1 | New or changed behavior at existing boundaries | Review; existing typecheck/FMS |
| Explicit time, entropy, config and effects where determinism matters | 10 / 2 | Selected computational core | Review; scoped existing AST checks if useful |
| Static composition by default | 9 / 1 | Known built-in modules | Existing source graph; no runtime loader prohibition |
| Restrict platform dependency closure | 9 / 2 | Explicitly selected portable scope | Existing source-dependency policy, not a name-based lint |
| Stable semantic data and error vocabulary | 10 / 2 | Relevant public/replacement/data boundaries | Owner fixtures; no generic type ban |
| Wire schema and ownership | 10 / 4 | Actual separately executed/versioned boundary | Existing schema and conformance suite |
| Explicit close, cancel, drain and custody | 10 / 2 | Real acquired resources and lifetimes | Owner lifecycle tests |
| Independent behavior vectors | 10 / 3 | Promised semantics of a qualified alternative | Same contract tests for each implementation |
| Exact-target compile/run evidence | 9 / 1 | Selected experimental or supported target only | Separate qualification lane |
| Global compiler-specific syntax restriction | 3 / 9 | None | Reject |
| Universal serialization, RPC or new IDL | 4 / 8 | None | Reject |

Prefer values, discriminated unions, explicit dependencies and stable IDs
when natural for the domain. No prohibition on generics, classes, closures,
Map/Set, object identity, decorators, Proxy, reflection, exceptions, BigInt,
Effect, native APIs or dynamic imports merely because of hypothetical native
targets. Restrict a construct only for a specific admitted scope and a real
correctness, dependency or target constraint. Keep stricter existing rules.
For actual wire contracts, do not export a JS-only object identity or handle as
if another process understood it. Keep rich ergonomic SDK wrappers above the
boundary.

### Examples and counterexamples

- Task expiry: pass the already-known current time into the rule; do not build
  a global Clock framework or change unrelated business APIs.
- Parser: accept owned/borrowed bytes with documented lifetime, size and
  encoding; do not wrap every string in PortableString.
- Local assignment planner: accept a typed request and return the decision;
  no schema generator or separate IPC DTO before an actual boundary.
- Provider streaming: keep AsyncIterable and AbortSignal in TS; if a real
  remote implementation is added, translate correlation, stream termination,
  cancellation and backpressure in its adapter. A cancelled request is not
  proof the remote work stopped.
- A TS state machine may use private mutable maps or opaque leases; only
  export stable handles through an actual cross-runtime protocol.
- Fastify, React, Electron, fs, SQL drivers, Effect-specific layers and OS
  custody are legitimate in their owning adapters/profiles. Do not move them
  just to silence a speculative portability check.
- Do not change a synchronous port to Promise just for hypothetical IPC;
  select a coarse asynchronous use-case boundary if a real need appears.

### Data at genuine boundaries

Use the owner contract that already exists (JSON Schema, Protobuf, WIT, C ABI
or another appropriate format); reuse its existing generators and validation
rather than introduce a second schema. Choose the format only with the real
consumer. One authority for normative semantics; generated types are a
projection, not another manually maintained truth. TS typechecks do not
validate untrusted runtime values. Validate at trust/data admission rather
than revalidating every internal invocation.

Specify the relevant numeric range/units/precision, finite/special values,
integer overflow, null versus absent, byte ownership, UTF-8/UTF-16 and
ordering, unknown/duplicate fields, canonicalization, resource limits and
structured errors. Do not invent a custom serializer. Preserve intentional
domain types and local APIs. For hash/equality, use exact canonical bytes and
domain separation as owned by the contract, not host object iteration order.
Handle exceptions/traps/panics as failures, not invented business results.
For external effects specify retries/idempotency, cancellation outcome,
unknown completion, and reconciliation as applicable. For native buffers
define allocator, ownership, lifetimes, lengths and thread/reentrancy rules.
Batch work only if measurements justify it; do not split an algorithm into
per-element FFI/IPC calls. A process or Wasm instance is not by itself a
security boundary; isolation claims need host-specific evidence.

## 4. What already exists and where changes belong

| Owner | Starting point | Next bounded owner delivery |
| --- | --- | --- |
| Organization .github | EQS language/runtime section and immutable language-neutral FMS | Accepted direction and this plan; route via existing AGENTS/CLAUDE links |
| Engineering Foundation | Source-dependency graph, public API check, AST patterns and neutral capability inputs | Reuse existing mechanisms; add only proven neutral gaps with explicit opt-in |
| Stack Toolchain (in Foundation repo) | Oxlint presets and pinned tools | Reuse built-in rules locally; optional reusable preset only for demonstrated shared demand |
| Get Modular | Core raw byte API, deterministic plan, schema, vectors; Assembly and Effect distinct | First bounded feasibility experiment; no rewrite or new public API |
| Extension Foundation | OD-003 and plugin delivery plan | Candidate artifact/semantic compatibility and execution profiles; no universal SPI |
| Live Module Updates | Existing foundation delivery plan; Host and generation custody | Explicit supported replacement modes, failure and restart semantics |

Existing FMS v1/v1.1 is language-neutral and immutable. Do not publish a new
version for an advisory readiness section or change existing pinned consumers.
EQS is current common practice; retained EQS/source authority bytes, digests,
qualification and exact consumer pins must follow their existing transition
procedure. Agent links provide discoverability, not adoption evidence.

### Concrete owner follow-ups (separate implementation deliveries)

- Get Modular: extend the existing Core qualification plan and fixtures under
  its architecture/qualification and packages/core test ownership. Exercise
  the public byte input and existing canonical vectors. If an actual blocker
  is proven, change only its responsible feature (e.g. plan-output), retain
  unchanged wire/diagnostic/digest semantics, and qualify the packed consumer.
  Do not move Assembly, Effect, Resources or Observation into a native core.
- Engineering Foundation / Stack Toolchain: review the consumer's existing
  architecture/foundation/source-dependencies.yaml and effective Oxlint config.
  Keep the rule implementation in the current owning tool; Stack owns lint
  presets, Foundation owns source dependency observation. Start with a local
  config delta, not changes to the published base presets or quality profile.
- Extension Foundation: add any unresolved native artifact/profile choices to
  docs/open-decisions/OD-003-module-runtime-and-public-spi-choices.md and the
  existing docs/architecture/plugin-delivery-plan.md only where needed. Keep
  signing, admission, authorization and product Host obligations with their
  accepted owners. No manifest change or stable SPI in this step.
- Live Module Updates: reconcile the existing
  docs/plans/foundation-delivery-plan.md and operation proposal with the
  distinction between native static linkage and independent replacement.
  Do not make new native profiles a prerequisite for the first useful update
  operation or add a second generation state machine.

Do not repeat the common rule text in those repositories. Reference the
reviewed central guidance through the existing agent routes and retain local
technical details in their already-owned plans. Each concrete change is a
separate scoped delivery with its own evidence and owner decision.

## 5. Tooling: choose the cheapest reliable enforcement

Read and verify the selected consumer's exact installed versions and existing
configuration before changing anything. The current source-dependency v3
schema already models roots, entrypoints, boundary/package/builtin allowlists
and runtimeReferences (commonjs, dynamic, type-query). Get Modular already
uses this to isolate Core internals with empty package/builtin lists. Foundation
is generic, development-only; repository policy decides the scope and allowed
edges. Do not infer that a source graph alone proves transitive npm runtime
closure or a particular compiler's import resolution.

| Concern | First mechanism | Limit / escalation trigger |
| --- | --- | --- |
| eval, implied eval, Function constructor | Stack base already has no-eval, no-implied-eval, no-new-func | Do not duplicate |
| Direct imports of specific platform modules | Oxlint no-restricted-imports in existing consumer file overrides, or current source graph | Literal imports only for lint; bare node names, aliases, reexports and computed paths need qualification |
| Ambient clock, environment, random, timers | Existing Foundation AST patterns where applicable; local scoped restrictions | Existing patterns are producer policy, not universal; shadowing/aliases/computed accesses need tests |
| Type-only import / accidental runtime import | Existing consistent-type-imports where already enabled | Preserve type/value distinction; type-only references can still leak into emitted public declarations |
| Transitive source boundary | Foundation architecture.source-dependencies and existing policy | Check reachable owned graph, unresolved edges and actual target closure; do not infer third-party support |
| Public API leakage | Existing packed declaration/API checks + review of selected wire surface | Do not ban Promise/Buffer across every TS SDK; evaluate aliases/reexports at actual boundary |
| AOT imports, library support, semantic differences | Actual compiler coverage/build/run and independent vectors | A syntactic lint cannot certify compilation, runtime or semantics |

Use Oxlint file overrides for a narrow known scope only when the existing graph
does not cover the same policy. No global no-restricted-imports, no global
no-restricted-types, no global ban on node: or fetch or crypto. Explicitly
include valid adapter/fixture cases and fail on unexpected source omission.
Do not call no-restricted-imports a transitive analyzer: it ignores computed
import expressions. Verify supported rule options against the pinned version;
do not add custom JS plugins (currently alpha in upstream docs) for the pilot.
Prefer existing deterministic mechanisms over new plugins, custom AST engine
or a parallel linter. A lint error needs a meaningful diagnostic, owner and
repair path; no auto-fix that changes semantics or mass suppression.

If two materially different consumers need the same missing mechanical check,
compare a small generic extension to the existing capability with an optional
preset before implementation. A neutral mechanism receives explicit consumer
roots, target-relevant allowlists or facts; it does not read organization
repo names, interpret FMS or apply native policy by default. Use the existing
input/qualification, suppression and API compatibility mechanisms. No new
profile version unless an observed contract gap cannot be represented safely.
An opt-out consumer with no new config must retain its old CLI/API/config,
findings, runtime dependencies, execution and release behavior. Qualify a
packed unrelated consumer, not only this organization. Installation of
Foundation, Stack or a preset is not consent to native-readiness enforcement.

### Test design and adoption decision

| Fixture | Required observation |
| --- | --- |
| Selected portable source imports a disallowed platform builtin | Actionable failure at the owned edge |
| Ordinary adapter imports the same builtin outside selected scope | Existing behavior unchanged |
| Allowed static import / legitimate TS type-only use | No false finding; enforce only the selected dependency or declaration policy |
| Reexport, alias, relative path through another owned module, unresolved or computed reference | Exercise actual source-graph/target behavior; distinguish known forbidden from unknown, never certify an unresolved closure |
| Local clock parameter and a shadowed identifier | Accept valid semantics; avoid a text-only global-name ban |
| Actual portable-boundary type alias exposing a host-specific handle | Reject only if the adopted contract prohibits it; use declaration-level evidence if needed |
| Packed unrelated consumer without any new option | Exact existing default findings/API/config behavior; no new required tool or runtime dependency |

Run the existing tools first on those cases. If a case is outside their
documented guarantee, describe the missing fact rather than writing a
duplicate rule. Do not implement all candidate checks simply because they
appear in this table. A new check needs a reproduced important violation,
a demonstrated gap in existing tools and a low-noise fix. Confirm the normal
feature path requires zero new per-feature declarations or configuration.
A consumer opting into a narrow scope must be able to remove only that
optional scope without weakening unrelated existing safety gates.

Track the change in authoring steps, duplicated representations, false
findings, maintenance LOC, execution cost and failure diagnostics in the
pilot. If the same benefit is available from an existing rule or manual
review, do not ship a new Foundation capability. Escalate complexity only
with a concrete owner-reviewed tradeoff; no blanket zero-warning target
that rewards suppressions.

## 6. First experiment: Get Modular Core, not Hello World

Start with one small non-production probe using actual Core sources or the
existing packed artifact with a build-time fixture entrypoint. Choose one
route after checking package resolution; preserve the accepted package
exports, generated stage and TS 7.0.2+ policy. Compare Node reference against
scriptc, not a second handwritten graph compiler. The documented raw byte
API compileCompositionJson is a good seam; object admission and rich TS
Assembly/Effect semantics do not have to become a cross-language API.
Include the existing fixture vectors; do not regenerate expected results
from the candidate. No code duplication, release or claimed production target.

Pin exact compiler artifact, version, resolved compiler frontend, fixture
revision, lock, target, linker/SDK, flags and reachable dependencies. Verify
which TS compiler path is actually used; if only a prohibited TS5 path works,
stop and record the gap, do not weaken the organization's compiler floor.
A diagnostic-only/coverage observation is permissible without claiming a
qualified build. Use scriptc coverage and build on the selected entrypoint;
read the pinned CLI help/docs for strict-native vs Node-island/hybrid options.
If hybrid is the only supported mode, report that explicitly, never label it
strict-native. Do not add a compile workaround to production before proving
the concrete issue. Candidate risk areas: direct WebCrypto digest in plan
output, JCS reflection/ECMAScript ordering, raw scanner numeric/Unicode
semantics, generated composition root and package resolution. These are
hypotheses from source inspection, not known compile failures.

Run the same known-success and known-failure fixtures through both paths.
Compare full structured diagnostics, selected binding/dependency order,
canonical output and plan digest, including malformed UTF-8, lone surrogates,
duplicate fields, integer/resource bounds, cycles, missing bindings and
unknown inputs; retain the owner's resource-envelope diagnostic rules.
Include repeat runs with permuted equivalent inputs where the contract
promises determinism. Confirm the built executable runs without an externally
installed Node runtime if claimed, and report embedded/linked runtime
components, fallback and unsupported paths. Exercise actual artifact from an
independent temp consumer. Test compilation alone is not semantic evidence.

If successful, record cold/warm startup, wall time, peak RSS, artifact size,
build cost and throughput on the same workload and host with repetitions.
Distinguish CPU gain from crossing/serialization cost, compare whole use case.
No performance threshold or memory savings asserted before the benchmark.
A single Linux/x64 (or available first target) experiment proves only that
target, not Windows/macOS, ARM64, musl or WASI. Broaden only if demand warrants.

Outcome states: unavailable, unsupported, coverage-only, build failed,
build passed, runtime passed, parity passed, measured performance. These are
separate evidence facts; queued, skipped, fallback and missing cases are not
PASS. Document negative results and stop after the bounded probe if no useful
decision changes. Do not create a permanent cross-compiler framework.

## 7. Extension and live-update guardrails

Retain separate semantic contract, implementation, artifact digest and actual
generation identities. Artifact compatibility (target OS/CPU, ABI, libc,
minimum OS, runtime/toolchain, Wasm imports/capabilities) is separate from
semantic compatibility. A signed artifact is not trusted to grant itself
permissions. Reuse OCI/signature and existing admission owners. Do not add
fields to a released manifest or promise ABI stability until a real admitted
artifact requires it. Use an extensible owner-defined capability vocabulary,
not a closed list of plugin kinds or a universal plugin base class.

Built-in static code can be linked into an executable. Separately distributed
JS, native executable, Wasm and trusted in-process FFI can have different
replacement properties: restart-only, replace after drain, qualified live
handover, or explicitly unsupported. Data/state migration is an orthogonal
obligation. The first complete update operation must remain useful without
native profiles. Select native executable, Wasm or C ABI only with a real
consumer; prefer a separate process for crash/isolation requirements and
consider trusted FFI only for measured crossing overhead. Do not claim
process isolation, sandboxing or physical unload from a language choice.

Preserve one canonical publication authority, generation admission and
custody, fencing, cancellation, in-flight stream/work and cleanup semantics.
A new generation needs readiness, compatible state and explicit routing;
old in-flight work must drain or be interrupted by an authorized policy.
Late writes are fenced at their authority owner; release evidence is not
physical-stop evidence. Rollback is a new compatible transition, not blindly
reloading old code against new state. Existing Get Modular Resources provides
cooperative cleanup; a private lifecycle-kernel is not a public dependency.
Do not copy that state machine or add another process supervisor.

## 8. Sequence, alternatives and cost envelope

| Stage | Deliverable / stop gate | New prod/tool LOC | Tests/fixtures LOC | Docs LOC |
| --- | --- | ---: | ---: | ---: |
| P0 | This owner-reviewed draft and concise EQS delta; no consumer pin changes | 0 | 0 | 350-500 |
| P1 | One Core probe, fixed vectors, honest target evidence; stop if unhelpful | 80-180 | 100-250 | 40-80 |
| P2 | Only confirmed gaps: consumer config and existing gates first | 0-120 | 40-150 | 30-60 |
| P3 | Optional shared neutral check only if reuse proven, exact packed E2E | 0-250 | 0-250 | 0-80 |

Conditional P0-P3 envelope: 80-550 tooling, 140-650 tests and 420-720 docs
= 640-1,920 LOC if the stages are useful.
A negative result can end after P0/P1. Counts exclude generated mechanical
artifacts, upstream code, runner and release work; estimates, not scope
targets. No LOC quota. Platform/ABI support, product migration and alternative
production implementations require separate evidence, cost and approval.
P0 records owner acceptance. P1 and the conditional P2/P3 work are authorized
within their stated scope and stop gates; each owning PR must retain its
existing review, qualification and adoption process.

| Alternative | Reliability / complexity / confidence (10 high) | Decision |
| --- | --- | --- |
| Ordinary TS only, no explicit readiness | 7 / 1 / 8 | Low friction, risks avoidable coupling |
| Scoped readiness + real optional qualification | 9 / 3 / 9 | Owner-selected direction; preserve ergonomic defaults |
| Mandatory AOT/wire subset across all repositories | 5 / 9 / 8 | Reject: high regression and maintenance cost |
| Immediate Rust/Wasm rewrite or universal ABI | 5 / 10 / 6 | Reject: unmeasured need and duplicated behavior |

Scores are judgments about the stated goal, not measured production
reliability. First update existing owning plans through their independent
review gates (GM experiment; Foundation/Stack tooling only after evidence;
Extension Foundation and Live Module Updates scope). Coordinate with active
foundation-first work; do not open parallel replacement architecture or
silently change their accepted decisions.

## 9. Review rounds and exit criteria

Self-review passes for this proposal; not independent reviewer approvals:

1. Architecture/authority: separate AOT, cross-language, distribution and
   updates; reuse EQS and FMS routes, no new standard or blanket adoption.
2. Ergonomics/DRY: eliminate mandatory DTOs, per-feature schemas, clock
   frameworks, blanket async and language bans; real boundary only.
3. Tooling/OSS: reuse Stack base rules and existing source graph; no custom
   plugin or required default. Require unrelated packed consumer regression
   before any shared opt-in release; distinguish lint from target evidence.
4. Correctness/security: preserve Unicode/numeric/canonical/diagnostic and
   ownership semantics, resource budgets, host authority, physical-stop
   evidence; avoid universal hot unload or isolation claims.
5. Evidence/maintenance: one bounded probe, independent fixtures, no TS5
   fallback, separate strict/hybrid and exact platform evidence; stop on
   negative evidence. No fleet rollout or release until owner admission.
6. Delivery/red team: recheck exact owner routes and add a fixture/decision
   matrix after comparing the proposed rules with the existing Stack preset
   and Foundation schema. Distinguish direct and transitive dependencies,
   computed imports, shadowed globals, declaration aliases, false green tests,
   hidden default activation and unavailable runners. Require valid negatives
   and independent review before widening scope.

Before P0 is ready: inspect the exact diff against main; preserve existing
EQS sections and immutable sources; resolve any central source-authority
constraints through existing routes; check local links and Markdown format;
run owning required pnpm check and applicable source/identity/CI gates.
Request independent architecture/maintainability and execution/security
review, record findings with fixes on the exact head, and repeat for material
changes. Owner direction is accepted; mark ready for ordinary review, and do not merge
until applicable gates and review findings are resolved.
For P1/P2/P3, add actual positive and rejecting fixtures, native execution
logs, evidence of no changed behavior outside selected scope, and real
independent consumer evidence as appropriate. Roll back the isolated
experimental config/check if its burden exceeds benefit; preserve historic
evidence and existing safety gates. A source review is not an executed E2E.

## 10. Source register

Observed source coordinates, not claims of installed/released artifacts:

- [Organization base and language/runtime guidance](https://github.com/agent-teams-ai/.github/blob/7a24d5a284e0d96e29693e247336158f18882317/docs/engineering-quality-standard.md#language-selection-and-runtime-boundaries).
- [Foundation source-dependency schema v3](https://github.com/agent-teams-ai/engineering-foundation/blob/c4b0576f4ca935446d44bf97db92aafc99d8fcd5/packages/engineering-foundation/schemas/architecture-source-dependencies/v3.schema.json),
  [Stack base preset](https://github.com/agent-teams-ai/engineering-foundation/blob/c4b0576f4ca935446d44bf97db92aafc99d8fcd5/packages/stack-toolchain/presets/oxlint/base.json),
  [neutral quality inputs ADR-0074](https://github.com/agent-teams-ai/engineering-foundation/blob/c4b0576f4ca935446d44bf97db92aafc99d8fcd5/docs/decisions/0074-neutral-quality-inputs.md).
- [GM Core public API](https://github.com/agent-teams-ai/get-modular/blob/850bac5fd02fa5697846cc8958ac447d5c2ee7bb/packages/core/src/index.ts),
  [plan emission](https://github.com/agent-teams-ai/get-modular/blob/850bac5fd02fa5697846cc8958ac447d5c2ee7bb/packages/core/src/features/plan-output/factory.ts),
  [source dependencies](https://github.com/agent-teams-ai/get-modular/blob/850bac5fd02fa5697846cc8958ac447d5c2ee7bb/architecture/foundation/source-dependencies.yaml),
  [canonical vectors](https://github.com/agent-teams-ai/get-modular/blob/850bac5fd02fa5697846cc8958ac447d5c2ee7bb/architecture/contracts/v1/canonical-vectors.json).
- [Extension Foundation OD-003](https://github.com/agent-teams-ai/extension-foundation/blob/5ee8a788935c885fac075a5860a0217cf420b4d7/docs/open-decisions/OD-003-module-runtime-and-public-spi-choices.md),
  [plugin delivery plan](https://github.com/agent-teams-ai/extension-foundation/blob/5ee8a788935c885fac075a5860a0217cf420b4d7/docs/architecture/plugin-delivery-plan.md).
- [Live Module Updates delivery plan](https://github.com/agent-teams-ai/live-module-updates/blob/3147f87ba07ebf8d58373ec5807871306c79116a/docs/plans/foundation-delivery-plan.md).
- [scriptc source README](https://github.com/vercel-labs/scriptc/blob/b3c43fa10b5656e7641ee500498ff1cced5980b3/README.md),
  [coverage](https://scriptc.dev/docs/coverage),
  [limitations](https://scriptc.dev/docs/limitations).
- Oxlint upstream: [configuration overrides](https://oxc.rs/docs/guide/usage/linter/config),
  [restricted imports](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-imports),
  [JS plugin status](https://oxc.rs/docs/guide/usage/linter/js-plugins).

# Evolution-ready architecture and selective capability adoption

Owner direction, 2026-11-27: preserve independent evolution from the first new
feature and reuse mechanisms across applications. This maintained guide extends
the [ecosystem vision](ecosystem-vision.md) and
[quality baseline](../engineering-quality-standard.md). It is not an immutable
FMS/CMS successor, package admission, product policy or qualification receipt.
Existing accepted owner contracts and exact pins retain authority. It assigns
no unrelated implementation or retrofit.

## Update-ready by default; live-update where qualified

Design broadly for independent replacement, even when the first deployment
uses static assembly and restart. Choose the narrowest cohesive capability
that owns its lifecycle, not a graph node per helper.

For applicable new or substantially changed feature and host boundaries:

- Follow FMS ownership and consumer-owned typed ports, explicit factory
  dependencies and one selected composition mechanism. Use Get Modular at
  real assembly seams in adopted CMS scopes; ordinary private helpers remain
  ordinary imports.
- Keep canonical business data, policy, drafts and effect receipts at their
  actual owners, independent of replaceable implementation instances.
  Instance-local state may be discarded only when the contract permits it.
- Keep declarations and discovery inert. Construct at an explicit owner seam;
  avoid import-time sockets, workers or effect registration. Pure functions
  do not require an asynchronous factory, resource scope or lifecycle object.
- Establish ownership before real resource acquisition, register release and
  preserve borrowed owners. Track actual work lifetime, not merely the
  Promise that returned a stream or scheduled background work.
- Keep stable transport/client entrypoints separate from selected behavior
  where independent replacement is useful. Static adapters can invoke their
  injected implementation directly without a per-call registry lookup.
- At actual cross-version boundaries distinguish semantic contract, artifact,
  configuration, durable schema, invocation and generation identities where
  applicable. Private helpers do not require version fields.

These low-cost seams are useful even when no dynamic updates are enabled.
The [LMU application foundation](https://github.com/agent-teams-ai/live-module-updates/blob/main/docs/architecture/application-foundation.md),
[GM CMS](https://github.com/agent-teams-ai/get-modular/blob/main/docs/architecture/common-assembly.md#consumer-module-standard)
and [extension model](https://github.com/agent-teams-ai/extension-foundation/blob/main/docs/architecture/extension-model.md)
own their detailed contracts; follow each consumer's adopted revision.

| Change boundary | Initial sufficient mode | Stronger mode when justified |
| --- | --- | --- |
| Pure helper | Static import and release | Replace its owning capability, not the helper |
| Feature with alternative implementations | Typed assembly and restart | Drain or compatible live selection |
| Configuration | Owner-validated versioned values | Coherent per-operation snapshot; no code reload |
| UI contribution | Stable shell/state owner, remount | Qualified live contribution with draft/focus/subscription continuity |
| Long-running agent/session/stream | Execution owner retains admitted work | Generation affinity, cutoff, receiver fencing and drain/handoff |
| Durable state or protocol | Explicit compatibility/migration or restart | Qualified mixed-version read/write and recovery |
| Untrusted executable | Qualified isolation boundary | Independent rollout within that isolation profile |
| Bootstrap or incompatible host substrate | Verified rolling/restart recovery anchor | Specialized handoff only with continuity evidence |

Live replacement is an opt-in profile, not a requirement on every feature.
A reusable module should be statically usable without LMU, a catalog, network,
product credentials or optional frameworks unless its own contract requires
them. At a live seam, reuse LMU's qualified operation, public GM
assembly/resources/observation and EF artifact/SPI mechanisms. The Host
supplies canonical authority, data and execution. Do not implement a second
generic updater per product. Signatures are not grants, cancellation is not
physical termination, rollback does not undo effects, and Node ESM retirement
is not unloading.

## Applicability before dependent implementation

The baseline above is intentionally lightweight. The following are conditional
design topics, not mandatory services, dependencies, manifests or tasks. In
the existing feature/ADR/plan record identify the actual seam, applicable
topics, chosen mode, owner, reuse source, unsupported guarantees and smallest
falsifying test. Explain inapplicability briefly when a review needs it; do
not make empty records for every function. Resolve expensive-to-change public
contracts, durable schemas, authority models and workflow formats before the
dependent implementation.

| Topic | Applies when | Preserve early | First useful mechanism; no speculative platform |
| --- | --- | --- | --- |
| Replaceable composition | Independent implementation or delivery seam | Explicit ports, state/resource owner, stable entrypoint | Static GM where adopted; LMU only for qualified live operation |
| Versioned behavior | Durable workflow, AI run or changing strategy | Owner-scoped revision references, provenance, resume semantics | Effective behavior at relevant admission/step; no global version object |
| Continuous evaluation | Output quality is empirical or model/strategy changes | Versioned criteria, cases, results and comparable cost/latency | Existing Task Verification/evaluation ports and offline fixtures; not mandatory for CRUD |
| Progressive delivery | Independent installations/cohorts or risk-bearing changes | Desired/observed revisions, stable eligibility, old/new compatibility, stop | Existing owner configuration/deployment policy; optional standard flag adapter |
| Local-first readiness | Editable user data across devices | Stable IDs, local vs canonical owner, revision/conflict/expiry | Local drafts/cache or logical transfer; CRDT only for specific mergeable data |
| Workload identity | Service, agent or extension crosses trust boundary | Actor, subject, audience, scope, issuer, expiry/revocation and receiver check | Existing IAM/security ports; evaluate federation/token exchange only where supported |
| Portable data/provenance | Durable user data, derived artifacts or transfer | Versioned owner export, source/effect refs, retention/deletion epochs | Existing owner export/import and receipts; no universal graph/warehouse |
| Reproducible failure testing | Durable transitions, distributed effects or concurrency | Relevant explicit time/randomness/scheduling, stable traces and independent expected outcomes | Existing executable specs, seeded cases and native faults; no universal simulator |
| Cross-language execution | Actual independent runtime or third-party contribution | Stable wire/semantic contracts, opaque handles, bounds, cancellation | Existing RPC/process adapter; Wasm/WIT separately qualified |

Versioned behavior must not freeze current authority. Requested model IDs
do not guarantee reproducible provider behavior: record observed identity
where available and acknowledge nondeterminism. Eval verdicts are observations,
not side-effect permission. Shadow evaluation uses read-only or disposable
bounded environments, not duplicate payments, messages or provider actions.

Offline collaboration never creates a second authoritative writer for grants,
money, execution or irreversible effects. Logical transfer, physical backup
and live sync differ. Conflicts, deletion and revocation remain explicit.
Rollout cannot delay emergency revocation; optional federation must not burden
local execution that does not need it.

## One implementation owner, not one mandatory runtime

| Owner | Mechanism and evidence | Outside its ownership |
| --- | --- | --- |
| Organization/FMS | Authoring, feature ownership and versioned conformance | Universal runtime schema; edits to frozen FMS |
| Get Modular | Typed assembly, resources, observation, applicable conformance | Product state/policy, artifact trust, unnecessary lifecycle |
| Extension Foundation | Immutable artifacts, admission, contribution SPI and trust | Product grants/state, second resolver |
| Live Module Updates | Complete qualified update operation and consumer laws | Rollout eligibility, eval verdict, authority store, provider lifecycle |
| Engineering Foundation | Development-only static checks, executable-spec connectivity, qualified shared test infrastructure | Product runtime or product policy |
| Agent Architecture Standard | Independently admitted neutral policy/evidence vocabulary | Organization-specific semantics or premature conformance claims |
| Products | Meaning, state, policy, receiver, profile and integration tests | Copies of shared runtime algorithms or test engines |

Follow the [library-first rule](../engineering-quality-standard.md#library-first-design-and-deliberate-evolution).
Inventory existing public packages and standards first. Name two credible
independent consumer seams or one bounded genuinely independent use case.
Representative fixtures can qualify the claimed foundation before products
are ready. Prefer extending the existing owner package or a narrow adapter.
Extract a library when shared semantics, dependency/release/trust boundary
or reuse justify it; prove parity and remove donor copies on adoption.
Technical reuse must not imply shared business aggregates or deployment.

## Deterministic evidence, not a new checker

Reuse selected FMS/CMS/Foundation gates. Separate static claims from actual
behavior; no universal readiness score or parallel checker.

| Claim | Existing route | Positive / rejecting discriminator |
| --- | --- | --- |
| Owned dependencies | FMS graph, Foundation source dependencies/coverage, CMS conformance | Valid selected bindings / forbidden deep import or missing binding |
| Portability | Strict compiler, public API/contract checks, packed consumer | Independent ordinary root / optional platform dependency leaks into runtime or declarations |
| Lifecycle | GM resources/conformance, LMU public testing surface | Retained work / late callback, failed preparation, premature borrowed-resource close |
| Compatibility/recovery | Executable specs, property/model/mutation scripts, native owner E2E | Compatible mixed versions / stale writer, lost ACK, incompatible rollback, erased-payload resurrection |
| Evaluation/rollout | Owner versioned scenario and evidence | Useful B result / failed criterion, wrong cohort or duplicate effect |
| Offline/portable data | Owner data/authority tests | Promised merge/transfer / conflict, stale grant or deletion resurrection |
| Workload authority | Actual receiver security integration | Scoped current credential / wrong issuer/audience/subject or expired/revoked grant |

Static checks cannot prove absence of dynamic I/O, semantic compatibility,
physical release, authorization or output quality. For claimed invariants,
use independent expected observations and deliberate defective controls.
The [executable specification capability](https://github.com/agent-teams-ai/engineering-foundation/blob/main/docs/reference/executable-specifications.md)
checks artifact connectivity, not test execution. CI executes actual selected
property/mutation/model scripts and native tests. Record exact inputs/versions,
seed, fault point, observations and limits when useful. Do not add time/PRNG
or scheduler abstractions to unrelated code. Common new checks extend their
owning package with positive/negative fixtures, packed qualification and
explicit consumer activation. This is a plan, not implemented new gates.

## Owner routing and delivery order

| Owner | Affected decision |
| --- | --- |
| Orchestrator | [Evolution attributes](https://github.com/agent-teams-ai/agent-teams-orchestrator/blob/main/docs/architecture/evolution-quality-attributes.md), OD-028/029/043 and Run/evaluation owners: behavior references, mergeable client state, evidence and plugin lifecycle |
| Agent Runtime v3 | [Greenfield plan](https://github.com/agent-teams-ai/agent-runtime/blob/main/docs/architecture/agent-runtime-greenfield-foundation-plan.md): effective harness/tool binding, workload identity, stream lifetime, reproducible faults; retain S1-S5 and C0-C3 |
| Platform | [Integration plan](https://github.com/agent-teams-ai/agent-teams-platform/blob/main/docs/architecture/shared-research-integration-plan.md): installation rollout, authority, logical transfer |
| Identity | [Identity plan PR](https://github.com/agent-teams-ai/identity/pull/1): authentication/account boundaries and future federation, not product/agent grants |
| Review Router and other consumers | Only applicable profiles, e.g. evaluation evidence, provider/credential seams and ordinary static composition |
| LMU / Extension Foundation / GM | Real update-ready authoring and stronger profiles at existing owners; no parallel lifecycle engine |
| Engineering Foundation | Existing conformance/extraction/specification route; common seeded/fault fixtures only for matching semantics |
| Engineering Research | Source-backed alternatives and owner links; no duplicate normative guidance |

First classify real seams in existing plans, then inventory mechanisms,
select the first useful profile and limits, qualify the smallest shared
mechanism/check with a rejecting case, and adopt through existing product
gates. Do not block ordinary static slices on unselected dynamic, federated,
offline or distributed profiles. Measure friction, dependencies, startup,
memory and operational costs alongside correctness. Stop where existing
mechanisms already prove the invariant. No new repository, package, runtime
code or mandatory CI gate is selected by this planning delivery.

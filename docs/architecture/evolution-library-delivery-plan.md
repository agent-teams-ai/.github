# Evolution-ready libraries: bounded foundation delivery plan

Status: proposed architecture and sizing, 2026-11-27. Owner requested an
up-front design of the reusable mechanisms, not a rushed implementation.
This plan refines [evolution readiness](evolution-readiness.md). It does not
authorize creating a repository, publishing a package, changing an accepted
product contract, or starting an unrelated implementation. Select each
candidate and its first guarantee through the existing owner/adoption route.

## 1. Placement decisions

Keep one semantic owner per mechanism and a directed dependency graph. A
repository is a source/maintenance boundary; a package is a consumption and
independently versioned contract boundary. Prefer existing owners first.
For small new runtime primitives with compatible maintenance and tooling,
prefer one multi-package workspace. Separate repositories require actual
ownership, release, trust, runtime or maintenance needs. No aggregate
universal "foundation runtime" or mandatory umbrella package.

| Candidate | Proposed home | Start now |
| --- | --- | --- |
| AI behavior evaluation | Owner-local experiment/qualification first; optional independent library only after shared semantics are established | Design a paired comparison; reuse established evaluation tooling and Task Verification only as an optional evidence adapter |
| Task Verification (separate existing scope) | Existing task-verification project and its own owner plan | No new implementation or scope expansion in this workstream |
| Behavior revision evidence | Proposed application-primitives workspace: behavior-revisions package | Materialize only if meaningful common mechanism remains |
| Reproducible failure tests | Engineering Foundation; optional development-only capability/test entry | Extend existing fixtures and executable-specification route |
| Progressive delivery | Product rollout owner; optional rollout-selection package in application-primitives | Design selection/receipt seam; compare OpenFeature |
| Workload identity | Existing security/IAM adapters; optional workload-identity package in application-primitives if shared semantics qualify | Specify trust boundary; split earlier if security/release ownership demands |
| Portable data | Product-owned transfer contracts; optional portable-data package in application-primitives | Coordinate one transfer profile with delegated sync; reuse existing artifact mechanisms |
| Offline-first and instance synchronization | Separate owner-delegated architecture workstream | Preserve current ownership constraints; do not choose or implement sync mechanisms here |
| Cross-language execution | Extension Foundation and actual Runtime executor/containment owner | Preserve SPI; separately qualify Wasm/WIT if selected |

Names are provisional design labels, not existing packages or a naming policy.
Task Verification is already an experimental project: [PR #2](https://github.com/agent-teams-ai/task-verification/pull/2)
reports model-free verification and explicitly does not promise a stable API,
production suitability or a package release. Review its exact latest source
and experimental results before choosing a production extraction. Existing
[research handoff](https://github.com/agent-teams-ai/engineering-research/blob/main/docs/studies/task-verification-handoff-2026-11-22.md)
remains research evidence. The owner clarified on 2026-11-27 that its purpose
is to verify whether an LLM agent completed an assigned task against its
acceptance criteria. It is not the general AI evaluation engine. Do not
change that repository's plan, scorer, evidence model, reviewer routing or
production scope through this workstream. A future behavior evaluation may
consume a task-completion verdict and its evidence through a narrow adapter;
there is no implied runtime dependency or authority to approve a rollout.

### 1.1. Proposed multi-package workspace (not an existing repository)

Working name: `agent-teams-ai/application-primitives`. A workspace of
independently consumable TypeScript packages, not a common business core,
runtime platform or required SDK. Materialize with the first useful slice;
do not create empty packages or reserve names by scaffolding.

| Placement | Tradeoff | Recommendation |
| --- | --- | --- |
| Repository per small library | Administrative isolation; repeated onboarding, CI and release setup | Only for an actual separate ownership/trust/release need |
| One aggregate runtime package | Easy installation; couples dependencies and unrelated compatibility | Reject |
| One workspace, independent package contracts | Shared engineering tooling and atomic related changes; separate consumption and versions | Preferred for these candidates |

The root is private and owns shared tooling only. Each real package has
its own manifest, version, explicit exports, source ownership, dependencies,
tests and usage limits. Provisional names: `@agent-teams/behavior-revisions`,
`@agent-teams/portable-data`, `@agent-teams/rollout-selection`,
`@agent-teams/workload-identity`. Use one pnpm workspace/lock and current
admitted Stack/Foundation tooling. Apply FMS and adopted CMS to real
module/composition boundaries; materialize only necessary layers.
No root runtime barrel, shared mutable registry, utils dumping ground,
shared product models or cross-package relative imports. Keep optional
native/security adapters and test entries outside ordinary pure dependency
closures, using separate packages when exports/peer isolation is insufficient.

Preserve package name, public contract and owner history when splitting a
package into a future repository. Use independent versions and the existing
MVP change/migration policy; do not synchronize versions merely because of
colocation. Split for actual independent ownership, release, trust, runtime
or maintenance boundaries, not size alone. Credential adapters may need
earlier separation; they must not burden unrelated pure packages.

### 1.2. Reuse discriminators from existing owners

- Orchestrator [ADR-0065](https://github.com/agent-teams-ai/agent-teams-orchestrator/blob/296173655e886896ebc24c472cf71e4c7f8faa66/docs/decisions/0065-immutable-run-plan-and-work-placement.md)
  and [ADR-0063](https://github.com/agent-teams-ai/agent-teams-orchestrator/blob/296173655e886896ebc24c472cf71e4c7f8faa66/docs/decisions/0063-typed-run-resilience-policy-snapshot.md)
  already own immutable plans and policy snapshots. Behavior Revisions may
  add reference-set validation/comparison, not a second RunPlan or policy
  store. If typed references suffice, no package.
- [Runtime v3 plan](https://github.com/agent-teams-ai/agent-runtime/blob/e7fa39a169277089fc10dbe6f679d49f537c9539/docs/architecture/agent-runtime-greenfield-foundation-plan.md)
  separates wire, capability, durable format, deployment and execution
  identities. A common reference must preserve those distinct semantics.
- [Platform installation control](https://github.com/agent-teams-ai/agent-teams-platform/blob/08ab481d123ec6c1f9355c1e02b1381764aff793/docs/architecture/managed-installation-control.md)
  owns desired/accepted/observed revisions and rollback. Rollout Selection
  can only supply a shared selection mechanism, not a second controller.
- [Extension Foundation artifact ADR](https://github.com/agent-teams-ai/extension-foundation/blob/90ae169e3ec4cdacac5042a6384a84fd12f3ac40/docs/decisions/0002-oci-oras-and-cosign-distribution-baseline.md)
  owns executable distribution, not all user data. Portable Data may
  reuse compatible standard mechanisms, without another registry.
- GM already owns composition and Engineering Foundation owns development
  checks. Do not move their source here. Identity's account boundary and
  Runtime security remain distinct; credential adapters require matching
  issuer/receiver semantics.

Do not pre-create generic clocks, UUID, logger, event-envelope, retry,
repository, receipt or authorization packages because products have
similarly named concepts. Use existing owners and maintained libraries.
Receiver idempotency, uncertainty and fencing differ by contract. If a
genuine common mechanical primitive remains, qualify it under its actual
owner before extraction. These are review topics, not a new backlog.

### 1.3. Source-first development without waiting for npm

Keep the same public package import in every mode. Inside the workspace
use explicit workspace dependencies; packing converts those references
to versions ([pnpm 11 workspace documentation](https://pnpm.io/11.x/workspaces)).
Do not import another checkout's private source or change application
imports to GitHub URLs.

| Mode | Use and required evidence |
| --- | --- |
| Same workspace | Explicit workspace dependencies and strict package build/typecheck |
| Cross-repository local iteration | Explicit local checkout/build or isolated packed candidate; no committed absolute paths, mutable branch pins or hidden source aliases |
| Cross-repository CI qualification | Frozen producer commit/toolchain/lock, build and pack, install exact artifact in clean consumer; retain digest and actual dependency closure |
| Accepted production dependency | Exact admitted released package, lock and integrity; any alternative source-production mode requires explicit owner acceptance and qualification |

Reuse [LMU's packed-consumer reference](https://github.com/agent-teams-ai/live-module-updates/blob/f38f2e634e7b9e28e4294f1ea8f7ead909e35ab9/tests/qualification/composed-document/README.md)
and Identity's TEST-candidate approach. Public npm publication is not a
prerequisite for development or independent TEST integration. Build a
reviewed immutable source revision or consume a retained verified tarball.
Record source, version, archive digest and exact dependency closure.
Reject mismatches and accidental resolution of an older registry version.
If an unpublished package depends on an unpublished sibling, stage and
verify the sibling artifact too: workspace conversion alone does not
resolve external consumers' unpublished dependencies. Do not claim
cross-platform byte reproducibility or durable evidence from an expiring
Actions artifact without qualification and a retention/reproduction path.

A Git-SHA dependency is an alternative only after proving that the selected
package manager installs the correct built public exports and locked
dependencies for the actual package/profile. Direct monorepo Git source
imports are not the default distribution mechanism. No custom registry,
installer or loader is required. Foundation's [local mode](https://github.com/agent-teams-ai/engineering-foundation/blob/main/docs/development/local-mode.md)
is specific to its released development tooling, not a generic runtime
package manager. Preserve its registry assertions and current consumer
admission/release gates. TEST consumption does not admit a production
dependency.

## 2. Proposed dependency direction

Ordinary reusable kernels consume explicit values and narrow ports; they
must not require product credentials, a central service, an organization
catalog, LMU, or Get Modular merely to be imported. FMS defines source
ownership. Engineering Foundation and Stack are development dependencies
only. GM is mandatory for real production composition within each accepted
CMS scope; it is not a hidden transitive runtime dependency of a pure
library. Static factories are sufficient for fixed internal helpers.

| Layer | Allowed direction |
| --- | --- |
| Pure kernels | Standard language/runtime and selected minimal public dependencies; no product/Host imports |
| Protocol adapters | Inward to own kernel/consumer port; selected third-party SDK only at the applicable adapter |
| Composition | Actual consumer/Host binds selected module and optional adapter through the adopted GM/FMS profile |
| Extension activation | Existing Extension Foundation artifact/SPI and LMU operation; consume only admitted public GM/EF/LMU surfaces |
| Product domain | Consumer-owned semantic ports and state; no dependency on another product domain |
| Development evidence | Engineering Foundation, GM/EF/LMU test kits and exact native fixture; never imported by production |

No proposed library is required to depend on another proposed library in
the first useful profile. Evaluation can consume an optional owner-scoped
behavior reference through an adapter; a rollout policy can consume a typed
evaluation result and request a qualified LMU activation through product
composition. Neither dependency creates a cycle or lets a result authorize
an effect. Data transfer may consume an admitted artifact/hash mechanism
where meanings coincide. Workload federation and document sync do not depend
on LMU, evaluation or rollout. Prefer no dependency until actual type,
behavior and compatibility needs justify the public edge.

## 3. Bounded candidates and falsification

### Applicability threshold: a seam, not a layer quota

Use the existing feature's contract, factory, adapter or owner record first.
An ordinary fixed helper or simple CRUD action is not a behavior-versioning,
rollout, federation or live-replacement unit. Do not introduce interfaces
around pure functions, universal version fields, flag lookups, separate
resource scopes, or duplicated DTOs solely to satisfy a future capability.
A pure dependency remains a static import. An independently replaceable
implementation with real selection belongs at the existing composition seam;
a resource-owning implementation has explicit acquisition/release; a durable
or cross-trust operation keeps the applicable owner contract. A stronger
profile adds only the mechanism and evidence needed for its stated guarantee.

Record the decision once at the existing boundary, not for every file. The
first fixtures must include an ordinary static consumer with no optional
profile activated, as well as the useful stronger case. Reject designs that
introduce an unused production package, per-call lookup, network dependency,
additional authority or duplicated representation into the ordinary path.
No architecture-readiness score, mandatory manifest, or central manager is
introduced. Exact FMS/CMS scope and existing quality gates remain authoritative.

### A. Behavior revision evidence (first design candidate)

Run Orchestration, Agent Runtime and Review Router need to correlate results
with actual admitted behavior. Do not put their domain models in one shared
schema. GM capability revision, OCI digest, provider binding, execution
generation and durable state revision retain their existing namespaces.

Proposed kernel: bounded, owner-scoped typed revision references; validation
and comparison of an explicit effective-input set; deterministic framing
and fingerprint only for formats whose canonicalization and privacy have
been selected. Preserve requested versus observed behavior identity, unknown
fields and incompatibility. A provider alias is not a reproducibility
guarantee; protected/low-entropy inputs must not leak via a public hash.
Avoid a universal revision registry, version database, prompt manager,
global snapshot, automatic migration or replay promise.

First fixtures: one Run plan references instructions, selected tool contracts
and strategy; another review/evaluation fixture binds criterion and reviewer
configuration. They retain distinct semantic models and use the same
technical operation without cast-based flattening. Wrong owner/schema,
missing required reference, ambiguous canonicalization, mutation after
capture and mismatch across a retained execution must reject. Fresh authority
is checked at the receiver, not frozen by behavior evidence. If both only
need plain typed references, use the existing local contracts and do not
create a library.

### B. AI behavior evaluation (distinct from Task Verification)

Task Verification answers whether a concrete assigned task was fulfilled.
Behavior evaluation answers whether a changed model, prompt, tool contract,
strategy or implementation performs better under declared test conditions.
Neither answer implies the other; the evaluated behavior can improve an
aggregate while failing a particular user's task. Do not expand Task
Verification into an experiment platform or create another general judge.

Start with a bounded, development/qualification-only paired comparison:
the same authorized scenario corpus, baseline and candidate behavior
references, explicitly declared criterion versions and evaluator identity,
attempt outcomes, and separate quality, latency and cost observations.
Retain unknown/incomplete results, sample counts and limitations; do not
silently discard refusals or average incomparable measurements. Nondeterminism
requires an explicit repeat/measurement policy rather than a guarantee that
the same inputs yield identical model outputs. No live inference, spending,
shadow traffic or automatic deployment is authorized by this planning change.

Reuse existing deterministic tests, recorded outputs and established eval
tooling before proposing a new library. Task Verification can be an optional
criterion adapter for the question of task completion; its own project
retains criterion/evidence/verdict semantics, implementation and delivery.
Other criteria (e.g. cost, latency or a tool regression) do not depend on it.
First demonstrate two distinct consumer seams: a Runtime harness/config
comparison and a Review Router strategy comparison using independently
defined cases. Keep the corpus, scoring policy, actual provider and budget
with the consumer. Use recorded or disposable read-only evidence, verify
baseline/candidate identity, missing observations, invalid criteria and
duplicate attempts. No model router, universal evaluator service, domain
authorization, release decision, or mandatory production telemetry.

Only if common mechanical evaluation contracts remain after using existing
tools should an independently useful library be sized and proposed; do not
preselect a repository. A future rollout owner may read an authorized
evaluation result as evidence, never as an effect grant.

### C. Reproducible failure tests (existing Engineering Foundation)

Use the [executable specification capability](https://github.com/agent-teams-ai/engineering-foundation/blob/main/docs/reference/executable-specifications.md)
and existing product/LMU/GM conformance cases first. A reusable development-only
fixture can carry bounded seeded case generation, explicit fault point and
schedule, independent expected observations, and replay instructions. Reuse
established property-based tools where applicable; no new global clock,
production scheduler, test-runner fork or universal distributed simulator.

First fixtures: LMU prepare/publish/retire with a lost receipt and stale callback;
Runtime operation acceptance/recovery with an independent real receiver.
Only the common mechanical fixture is shared, not the owner-specific
state machine. Reproducing the same failure needs the exact seed, inputs,
profile and schedule; native I/O or LLM output is not automatically
deterministic. Prove the same retained case fails a defective implementation
and passes the corrected implementation. Native integration still proves
physical cleanup and real stores.

### D. Rollout selection (conditional, not a second updater)

Begin with the actual Platform deployment and product feature-selection
owners. Compare native configuration and [OpenFeature](https://openfeature.dev/specification/sections/flag-evaluation/).
OpenFeature provides flag evaluation/provider interfaces; it is not a durable
upgrade workflow or permission engine. Check SDK version support and scoped
instance/lifetime behavior before adoption.

Candidate narrow library only if compatible independent product seams need
the same stable cohort selection and versioned decision evidence: deterministic
target bucketing, explicit eligible scope and selected revision, bounded
decision reason and invalid-policy refusal. Reuse a standard hash/flag
mechanism; product owns rollout thresholds, desired/observed state, stop,
rollback and current authority. Test boundary values, sticky selection,
cohort drift, two simultaneous changes, revoked target and failed evaluation.
LMU executes only the selected qualified replacement; no custom feature
flag server or universal rollout controller.

### E. Workload identity (conditional protocol adapter)

Compare [SPIFFE Workload API](https://spiffe.io/docs/latest/spiffe-specs/spiffe_workload_api/)
and [RFC 8693 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693.html).
Choose an actual supported issuer/receiver profile; do not assume interoperability
between all credential formats or that token exchange grants delegation.

Candidate independent adapter library only after Runtime Security/Provider
Access and another receiver demonstrate common protocol semantics. Scope:
explicit actor/subject/issuer/audience, credential acquisition or validation
port, bounded expiry/error behavior and redacted evidence. Use maintained
cryptographic/protocol libraries. No issuer, global token ledger, account
database, policy engine, tenant-role model, secret manager or raw credential
in evidence. Identity continues human account lifecycle; Platform/product
owns grants and receiver enforcement. Fully Local can use its accepted local
authority without SPIFFE, Keycloak or a network. Test real valid and wrong
issuer/audience/subject, expiry, key rotation and declared revocation behavior;
a signed token alone never establishes product authorization.

### F. Portable data and provenance (conditional mechanical library)

Use existing owner-local logical export/import, deletion and recovery plans.
Existing Extension Foundation owns executable artifacts; do not create a
second OCI registry. Candidate portable-data kernel is a mechanical, bounded
manifest/stream envelope with format revision, named payload digest/size,
validation and explicit unsupported-format errors. Use maintained archive
and digest implementations; adapters own storage/streaming and trust.

Project/Team transfer and another real export (e.g. review evidence) must
demonstrate the same envelope without sharing business state. Receivers own
authorization, source/target mapping, migration, import receipts, unknown
effects, deletion epochs and retention. Reject tampered bytes, path escape,
resource exhaustion, unknown required version, cross-tenant binding and
replay of deleted data. Preserve exactly what was transferred; a digest
does not authorize reading it. No universal schema, distributed transaction,
graph database, automatic restore or generic backup service.

### G. Offline-first and synchronization (delegated, out of scope)

The owner assigned the broader Local-First/Offline-First, local LLM and
cross-instance synchronization design to another agent. Retain the
applicability and single-authority constraints in the common guide and
existing product ADRs. No new synchronization package, merge policy, CRDT
selection, offline execution guarantee or source changes are planned here.

Coordinate the portable-data envelope (F) with that workstream before
selecting a public format: explicit logical transfer remains distinct from
live replication and backup. Do not delay independent A/C work on that
design, and do not duplicate the sync architecture or edit the other agent's
branch. Any proposed transfer mechanism that would also serve synchronization
must be reconciled with the owning contracts before implementation.

### H. Cross-language components (defer until a selected profile)

Reuse Extension Foundation's contribution contract, artifact verification
and Runtime's actual process/containment owner. Compare standard
[WIT](https://component-model.bytecodealliance.org/design/wit.html),
existing process/RPC and a maintained Wasm runtime for one concrete plugin.
Do not create another Wasm engine, scheduler, loader or supervisor. Keep
language/runtime-specific bindings outside the ordinary portable root.
Qualify input/output bounds, handle ownership, cancellation, error mapping,
egress and isolation at the real boundary; WIT compatibility alone does
not prove hostile containment or migration of handles. Native trust and
release obligations stay with their actual owner.

## 4. Preliminary incremental sizing

Ranges are engineering estimates of handwritten lines, not measured changes
or a delivery promise. P = new/changed production or integration source;
T = tests/fixtures; B = bootstrap/config/docs. Exclude generated clients,
vendored dependencies, already implemented donor code and product integration
outside the bounded profile. Re-estimate after an exact source/seam inventory.
Confidence, reliability (potential within stated profile, not achieved) and
complexity are scored 1–10. For test-only tooling P means tooling code.

| Candidate | P | T | B | Confidence / reliability / complexity |
| --- | ---: | ---: | ---: | --- |
| A Behavior references/validation | 400–900 | 700–1,400 | 250–500 | 6 / 8 / 4 |
| B Paired evaluation fixture (development tooling, not production library) | 0–400 | 300–800 | 150–350 | 5 / 7 / 5 |
| C Shared failure-test fixtures | 400–1,000 | 500–1,200 | 150–350 | 7 / 8 / 5 |
| D Rollout selection adapter/kernel | 400–900 | 600–1,300 | 250–500 | 6 / 8 / 5 |
| E Workload identity adapter | 700–1,500 | 1,000–2,200 | 300–700 | 5 / 7 / 7 |
| F Portable transfer envelope | 600–1,300 | 900–1,800 | 250–550 | 6 / 8 / 6 |
| G Offline-first/sync (delegated) | Not sized here | Not sized here | Not sized here | Not assessed |
| H One Wasm contribution/Host adapter | 700–1,600 | 1,000–2,500 | 300–800 | 4 / 7 / 8 |

A+C first qualification: P 800–1,900, T 1,200–2,600, B 400–850
(2,400–5,350 total). B's bounded fixture can proceed independently; no
Task Verification implementation estimate or general evaluation library
estimate belongs to this plan. All estimates are conditional and not an
approved backlog; reuse can eliminate a candidate entirely. A completed
generic shared component does not include production integration across all
applications, fleet qualification or every security/runtime profile.

## 5. Common delivery sequence and architecture

For an approved independently released library, follow the current
[repository admission](../repository-admission.md#new-repository-bootstrap),
[FMS adoption](feature-module-standard/README.md), exact accepted GM CMS
where applicable, and Stack/Engineering Foundation tooling. Do not copy
configuration from an outdated donor or add a runtime dependency on
engineering tooling. Ordinary portable code remains TypeScript under the
applicable current compiler/runtime profile. Only select additional languages
for a concrete native/interoperability seam. Start with one useful feature
and its real roles; split into sub-features when ownership, visibility and
independent change justify it, not a line-count quota.

1. Write the owner-local plan: contracts, supported profile, explicit
   exclusions, competing mechanisms, existing implementation inventory,
   dependency graph, first two independent fixtures and estimates.
2. Prove the smallest semantic contract with real positive and rejecting
   vectors before implementation. Reuse standards and existing packages.
3. Build the portable kernel, optional adapters and real composition
   boundaries. No import-time effects or hidden singleton; no unused layers.
4. Run selected strict compiler, FMS/CMS, public declaration, dependency,
   behavioral, mutation/property and native checks as relevant. Prove packed
   external consumers, including an ordinary consumer without optional
   dependencies. Product-specific acceptance remains local.
5. Review correctness, security, failure/recovery, compatibility, portability
   and code size independently; correct material findings and rerun on the
   exact head. Publish only after the repository's ordinary release gates.
6. Adopt each exact released and qualified profile explicitly through a
   product's existing gate. Remove donor copies once parity is demonstrated.
   Keep unrelated product delivery independent.

Early delivery order: inventory and design A/C, design B's paired comparison
without modifying Task Verification. If A's independent fixtures demonstrate
a useful shared mechanism, bootstrap application-primitives with A only and
prove local and exact packed TEST consumption. If no common mechanism remains,
do not bootstrap an empty repository. C stays in Engineering Foundation.
Then select D/E/F only at approaching dependent contracts; coordinate F
with separate G and retain H with its existing owners. No package is created
merely to complete the candidate list. Record exact evidence and limits;
no cross-product manager.

## 6. Review disposition and stop conditions

Three self-review lenses applied to this design: dependency cycles and
ownership; security/authority and durable effects; practical reuse,
qualification and costs. Not an independent review or E2E result.
The resulting boundaries explicitly keep task verification distinct from
behavior evaluation, eval from authorization, rollout from LMU, federation
from human account custody, transfer from physical backup, sync from
authority and test simulation from production runtime. The delegated G
workstream is not part of this implementation or sizing plan.
Cancel extraction if a standard adapter or existing owner is sufficient.
Do not promote a library merely because its folder, schema or test exists.

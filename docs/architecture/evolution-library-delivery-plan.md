# Evolution-ready libraries: bounded foundation delivery plan

Status: proposed architecture and sizing, 2026-11-27. Owner requested an
up-front design of the reusable mechanisms, not a rushed implementation.
This plan refines [evolution readiness](evolution-readiness.md). It does not
authorize creating a repository, publishing a package, changing an accepted
product contract, or starting an unrelated implementation. Select each
candidate and its first guarantee through the existing owner/adoption route.

## 1. Placement decisions

Keep one semantic owner per mechanism and a directed dependency graph. A
repository is an independent release and maintenance boundary, not a feature
directory. Prefer existing owners for tightly related mechanisms; a new
standalone repository is justified by an independently useful public
contract, a distinct release/trust/runtime boundary, and credible consumers.
No aggregate universal "foundation runtime" or mandatory umbrella package.

| Candidate | Proposed home | Start now |
| --- | --- | --- |
| Task verification and evaluation | Existing task-verification research repository; future production package only after explicit promotion | Finish experimental evidence and design public boundary |
| Behavior revision evidence | Provisional independent behavior-revisions library | Design and falsify shared semantics in disposable fixtures |
| Reproducible failure tests | Engineering Foundation; optional development-only capability/test entry | Extend existing fixtures and executable-specification route |
| Progressive delivery | Product rollout owner; optional rollout-selection library if two matching consumers justify it | Design selection/receipt seam; compare OpenFeature |
| Workload identity | Existing product security/IAM adapters; optional workload-identity library after shared protocol qualification | Specify trust boundary and supported token profile |
| Portable data | Product-owned transfer contracts; optional portable-data library for shared mechanical envelope | Design one transfer profile, reuse existing artifact mechanisms |
| Offline collaboration | Product-owned document adapter; optional collaboration-sync package later | Preserve IDs, conflict semantics and authority; compare established CRDTs |
| Cross-language execution | Extension Foundation and actual Runtime executor/containment owner | Preserve SPI; separately qualify Wasm/WIT if selected |

Names are provisional design labels, not existing packages or a naming policy.
Task Verification is already an experimental project: [PR #2](https://github.com/agent-teams-ai/task-verification/pull/2)
reports model-free verification and explicitly does not promise a stable API,
production suitability or a package release. Review its exact latest source
and experimental results before choosing a production extraction. Existing
[research handoff](https://github.com/agent-teams-ai/engineering-research/blob/main/docs/studies/task-verification-handoff-2026-11-22.md)
remains research evidence. Do not reimplement its scorer, evidence model,
Gateway integration or reviewer routing simply to create a cleaner package.

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

### B. Evaluation / Task Verification (reuse, do not fork)

First production candidate, subject to experimental promotion: immutable
scenario/criterion/evidence contracts, bounded evaluation operation, explicit
satisfied/violated/unverifiable results, independent deterministic checks,
typed scorer/evaluator ports and repeatable aggregate metrics. The caller
owns policy thresholds, dataset access, actual model selection, budget and
acceptance. Model/Gateway/OCR adapters remain separate. Opaque evidence refs
and behavior refs do not require another package in the ordinary kernel.

First consumers: Review Router review acceptance and Orchestrator task
verification. Use exact existing Task Verification experiments before
extracting. Verify evidence binding, unsupported result, malicious/incorrect
verdict, lost provider response, cancellation, budget cap and original attempt
identity. Model-free vectors establish mechanics only; any live model
evaluation requires its own approved profile and measured quality. Shadow
runs must use read-only or disposable effects. No autonomous merge permission,
billing authority, general AI framework, universal judge or duplicate model
router. Keep OpenTelemetry an optional observation adapter, not truth.

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

### G. Offline collaboration (defer implementation)

For a real mergeable document or draft, compare [Yjs](https://docs.yjs.dev/)
and [Automerge Repo](https://automerge.org/docs/reference/repositories/).
Do not implement a CRDT, network protocol or general database synchronization
engine. A first product owns document type, schema, edit authority and
retention. Only proven common document storage/sync adapter and lifecycle
can become a small collaboration-sync package. Test offline conflicting
edits, duplicate/reordered updates, reopen, revocation, removal and bounded
growth. Previously disclosed offline data cannot be remotely erased by
assertion; define the supported exposure/cleanup contract. Never merge
payment, grants or runtime dispatch authority by CRDT.

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
| B Task Verification production slice delta | 1,500–3,000 | 1,500–3,500 | 300–700 | 5 / 7 / 7 |
| C Shared failure-test fixtures | 400–1,000 | 500–1,200 | 150–350 | 7 / 8 / 5 |
| D Rollout selection adapter/kernel | 400–900 | 600–1,300 | 250–500 | 6 / 8 / 5 |
| E Workload identity adapter | 700–1,500 | 1,000–2,200 | 300–700 | 5 / 7 / 7 |
| F Portable transfer envelope | 600–1,300 | 900–1,800 | 250–550 | 6 / 8 / 6 |
| G One collaboration adapter | 700–1,600 | 1,000–2,200 | 250–550 | 4 / 7 / 7 |
| H One Wasm contribution/Host adapter | 700–1,600 | 1,000–2,500 | 300–800 | 4 / 7 / 8 |

A+C first qualification: P 800–1,900, T 1,200–2,600, B 400–850
(2,400–5,350 total). B can proceed as a separate owner-led track without
waiting for A, C or a product. All eight estimates are conditional and not
an approved backlog; reuse can eliminate a candidate entirely. A completed
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

Early delivery order: inventory and design A/C, continue the existing
Task Verification evidence track, then choose D/E/F only when their
dependent consumer contract is approaching. Preserve the G/H seams
without imposing their runtime costs. Record scope, exact artifacts and
unsupported claims at each step; no new cross-product manager.

## 6. Review disposition and stop conditions

Three self-review lenses applied to this design: dependency cycles and
ownership; security/authority and durable effects; practical reuse,
qualification and costs. Not an independent review or E2E result.
The resulting boundaries explicitly keep eval from authorization, rollout
from LMU, federation from human account custody, transfer from physical
backup, CRDT from authority and test simulation from production runtime.
Cancel extraction if a standard adapter or existing owner is sufficient.
Do not promote a library merely because its folder, schema or test exists.

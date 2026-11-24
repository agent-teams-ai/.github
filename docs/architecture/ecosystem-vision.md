# Foundation-first Architecture and ecosystem vision

Owner direction recorded on 2026-11-24. This is the maintained organization-wide
vision and coordination plan, not a new FMS edition, a package admission, a
production API, or a qualification receipt. The owner has selected the
foundation-first direction; detailed technical alternatives below remain
proposals until accepted by their respective owners.

## Purpose and non-goals

Build a family of independently useful applications and libraries, not a single
application with its infrastructure extracted afterwards. Plan for a codebase
that can grow to tens of millions of lines across products and for qualified
deployments with tens of thousands of concurrently executing agents. A convenient
one-agent Fully Local experience is also a first-class goal. These are design
targets, not measured capacity or a mandate to use the same physical topology.

The greenfield Runtime v3 is a new implementation: existing Runtime code and
experiments are evidence, behavior oracles and possible reusable mechanisms, not
an instruction to refactor that implementation into v3. The legacy desktop app
has the separate reference-only boundary in the [organization README](../../README.md#new-product-scope-and-legacy-references).

Modularity, Clean Architecture, SOLID, DDD where applicable, DRY, explicit
ownership and independent evolution are intentional investments at this scale.
Reduce accidental coupling, duplicate mechanisms and unnecessary layers; do not
remove useful boundaries merely to reduce file, package or interface counts.

## Foundation-first delivery

1. Establish the whole-system vision, product and context boundaries, authority
   and data ownership, deployment shapes, compatibility and failure invariants.
   Identify unresolved expensive decisions and compare their alternatives before
   committing dependent implementation contracts.
2. Design shared capabilities as reusable libraries from the beginning when
   concrete existing or planned consumers demonstrate the need. Record the
   intended consumers, contract, supported envelope, owner and evolution plan.
   Do not force each product to build a private copy before the foundation may
   be designed.
3. Implement the qualified foundation in bounded increments, including static
   composition, module authoring, reusable plugin mechanisms and lifecycle.
   Use representative disposable consumers and real consumer seams to falsify
   the contracts. Different intended products should exercise materially
   different cases, not copies of one toy. A planned consumer is not evidence
   of adoption.
4. Qualify exact artifacts, supported toolchains, contracts, integration and
   security/lifecycle behavior. Keep provisional 0.x implementation,
   stable/public SPI publication, production-host admission and actual
   consumer adoption separate. Preserve accepted safety and conformance gates.
5. Begin or expand main greenfield product implementation on the applicable
   qualified foundation and accepted owner contracts. Product architecture,
   independent research, and narrowly admitted qualification work can proceed
   in parallel. Do not rush product implementation, but do not make every
   future plugin kind, multi-region topology or research idea a prerequisite
   for the baseline.

The [Engineering Quality Standard](../engineering-quality-standard.md#library-first-design-and-deliberate-evolution)
already establishes library-first design. This direction clarifies sequencing;
it does not silently revoke repository-specific ADRs, approve code work, change
immutable bytes or waive publication/consumer gates. Where an older
product-first extraction gate conflicts with the owner direction, distinguish
early design/0.x foundation work from stable publication and resolve the
conflict through the owning successor procedure.

## Ecosystem ownership map

The rows describe semantic responsibility, not mandatory dependency edges or a
complete repository inventory. Existing repositories may be consumers or
producers of more than one independent library; future products must be free to
use only the relevant capabilities.

| Repository | Canonical responsibility | Consumer and boundary |
| --- | --- | --- |
| [.github](https://github.com/agent-teams-ai/.github) | Organization vision, governance, shared engineering standards, admission and reusable workflow policy | All owned projects; no product runtime or domain authority |
| [Engineering Research](https://github.com/agent-teams-ai/engineering-research) | Structured studies, source evidence, patterns, counterexamples and candidate decisions | All owners; research is not normative adoption |
| [Engineering Foundation](https://github.com/agent-teams-ai/engineering-foundation) | Reusable development tooling, documentation, architecture checks, release and evidence mechanisms | Owned and external repositories; development-only, never a product runtime dependency |
| [Agent Architecture Standard](https://github.com/agent-teams-ai/agent-architecture-standard) | Independent language-neutral specification and minimal conformance runner | Any implementation; Foundation integration is nonnormative and optional; neutral publication prerequisites remain |
| [Get Modular](https://github.com/agent-teams-ai/get-modular) | Neutral module/capability identities, declarations, bindings, deterministic static composition and qualified resource mechanisms | Independently usable by products and external libraries; no product policy, artifact trust or durable activation authority |
| [Extension Foundation](https://github.com/agent-teams-ai/extension-foundation) | Product-neutral extension artifact, trust, distribution, installation/admission and applicable extension contracts and primitives | Multiple product hosts and external applications; no consumer domain or canonical product state |
| [Live Module Updates](https://github.com/agent-teams-ai/live-module-updates) | Proposed independently reusable complete update operation and supported replacement profiles | Product hosts supply narrow authority/state/execution primitives; reuse existing resource mechanisms, no second canonical authority |
| [Agent Runtime](https://github.com/agent-teams-ai/agent-runtime) v3 | Provider-neutral technical execution, sessions, operations, effects, custody, capacity and provider access | Embeddable libraries and qualified runtime hosts; not Team/Task/Run business coordination |
| [Orchestrator](https://github.com/agent-teams-ai/agent-teams-orchestrator) | Headless collaboration, Teams, Tasks, Runs, business policy and coordination | Standalone, managed and other SDK/API consumers; no commercial Platform requirement in standalone |
| [Platform](https://github.com/agent-teams-ai/agent-teams-platform) | Managed tenancy, product authority, commercial access, placement and installation intent | Managed integration through owner contracts; not another Orchestrator or Runtime |
| Future web, desktop, mobile and CLI products | User experience, presentation, client-owned state and supported extension UI adapters | Public SDKs/ports; shell and rendering choices cannot own business state or force backend framework dependencies |

Other products, including ReviewRouter, agent tools, developer tooling and
independent external applications, are possible consumers of the shared
mechanisms where their contracts actually fit. Inventory actual planned
adoptions in the owning library's existing plan, rather than promising that
every repository will use every library. No legacy migration is implied.

## Shared module and extension architecture

Aim for one coherent developer experience and one implementation per shared
mechanism. A library boundary is not a reason to duplicate lifecycle logic.
A product host supplies policy, canonical state, permissions, actual execution
and custody; it should not reimplement a common update algorithm.

Preserve the current Get Modular and Extension Foundation authority separation.
The proposed standalone Live Module Updates operation already has a
[delivery plan](https://github.com/agent-teams-ai/live-module-updates/blob/main/docs/plans/foundation-delivery-plan.md)
and [headless/UI design](https://github.com/agent-teams-ai/live-module-updates/blob/main/docs/architecture/headless-plugins-and-ui.md).
Coordinate with that workstream; do not create another module loader, registry,
composition compiler, lifecycle kernel or update orchestrator in parallel.

Compare the following at the existing owner decisions, not by package count:

| Option | Reliability | Complexity | Confidence | Incremental implementation/test LOC |
| --- | ---: | ---: | ---: | ---: |
| Independently usable composition, extension and shared update mechanisms, with an optional coherent integration surface | 9 | 7 | 9 | 5,000–12,000 |
| One integrated runtime/package with distinct internal ownership boundaries | 7 | 9 | 7 | 12,000–30,000 |
| Independently authored host lifecycle in each product | 7 | 8 | 9 | 8,000–15,000 per product |

Estimates are provisional and overlap active delivery work. The preferred
hypothesis is the first option, including a thin integration recipe or facade
only if real authoring ergonomics require it. It is not an accepted new
package, SDK or final graph. The other agent's existing work owns the detailed
selection and estimates. If a shared mechanism already exists, reuse it;
separation is by semantic ownership and dependency/lifecycle guarantees, not
by a compulsory repository per abstraction.

Keep contribution vocabulary extensible. Tool, skill, UI, worker, private
state, workflow or integration are illustrative consumer capabilities, not an
exhaustive enum, mandatory plugin categories or a universal host API. A generic
versioned envelope can identify a namespaced contribution contract and its
compatibility requirements. Product owners define typed payloads, behavior,
grants and lifecycle obligations for their own extension points. Unknown
required capabilities fail closed; optional unsupported contributions follow
explicit policy. Do not allow arbitrary untyped payloads, a global service bag,
or runtime code evaluation during discovery. A headless core may be consumed
without UI, plugin packaging or a particular shell. Ordinary library usage
must not require the whole platform.

Define replacement guarantees as profile capabilities, not mandatory properties
of every module: restart-only, drain-and-replace, qualified live replacement
and separately qualified stateful migration. Preserve old-generation affinity,
admission cutoff, fencing, state custody, compatible readers and cleanup/recovery.
An update guarantee does not imply malicious-code isolation or physical unload.

## Global architecture constraints to settle before dependent product code

These are required design topics, not new accepted technical decisions or an
instruction to implement every mechanism immediately. Reuse existing owner
ADRs and open decisions; add only missing deltas and review alternatives.

| Topic | Preferred direction to evaluate | Primary owner routes |
| --- | --- | --- |
| Placement and failure domains | Cell-ready stable identities, scoped routing and fenced transfer; start with a bounded deployment | Platform Deployment Management; Orchestrator persistence and OD-033 |
| Resource and cost limits | Owner-specific bounded reservations; hierarchical delegation where measured shared bottlenecks require it | Runtime v3 C0–C3; Orchestrator OD-024 and OD-033 |
| Recovery | Owner-local durable effects and independent fencing; multi-store restore reconciliation | Runtime F01–F18 and S2; Orchestrator OD-003/OD-013/OD-032; Platform authority |
| Authority | Scoped delegation and receiver/last-mile enforcement, including agent and extension trust boundaries | Orchestrator OD-012/OD-031/OD-032; Platform and Runtime owners |
| Event/automation amplification | Bound causal depth, width, cumulative work, bytes, retries, fanout and reserved control progress | Orchestrator OD-033 and eventing contracts; Runtime capacity |
| Independent upgrades | Versioned semantic contracts, bounded compatibility/recovery horizon and generation-aware rollout | Each contract owner; Foundation evidence mechanisms |
| Persistence | Feature-owned mappings/schemas/migrations, shared technical infrastructure only; resolve S2 bundle ownership | Runtime #245/#246; FMS and consumer owners |
| Large codebase | Independent source, compilation, composition, deployment and execution graphs; scoped/incremental checks with sound invalidation | FMS, Engineering Foundation, Get Modular, AAS integrations |

Design for future placement and independent evolution without building
speculative distributed infrastructure now. Do not put physical shard IDs
into business identities, treat all events as durable occurrences, or force
all code through one global generic type/DI graph. Keep static composition
plans distinct from per-operation resources. Evaluate the current supported
Get Modular descriptor-union evidence before proposing compiler changes.

## Review, evidence and owner decisions

Engineering Research should organize evidence, useful patterns, antipatterns,
candidate alternatives and links to owner decisions. A competitor feature or
research result never changes a product contract by itself. Preserve
counterevidence and actual evidence scope, and reject ideas that conflict with
the vision without a demonstrated reason to change it. Reuse the existing
documentation and research workflow rather than adding a new research service.

Check accepted decisions critically, but do not edit their historical bytes.
Review Extension Foundation ADR-0015/OD-003 and issue #57 for the distinction
between early shared foundation work and public SPI publication; FMS v1.1
extraction gates for library-first compatibility; Runtime v3 storage and
local PostgreSQL handoff; Orchestrator ADR-0117 composition baseline and
ADR-0114/0116 local operational footprint; ADR-0100/0101 Agent occupancy;
Foundation cohort compatibility. An accepted ADR may be right; a review
candidate is not a supersession. Compare at least three plausible alternatives
where a material choice exists, with reliability, complexity, confidence and
handwritten production/test LOC. Review from architecture, security/recovery,
scale/operations and consumer/developer ergonomics perspectives; reconcile
findings against existing records. Run independent critiques for substantial
choices where available; never claim a reviewer or qualification ran if it did
not.

## Coordination and definition of readiness

Use one owner plan per workstream and link it from the relevant repository
navigation. Do not duplicate the complete roadmap or write to another agent's
active branch. Deliver narrow reviewed commits and push immediately; respect
protected branches, exact revision checks and existing authoring procedures.
Track design, accepted decision, implemented mechanism, qualified artifact and
adopted consumer separately.

The initial product foundation is ready for its named scope when global and
local ownership contracts agree, its required static composition and extension
boundaries are usable, representative independent consumers prove the claimed
behavior, failure and compatibility cases pass, and exact supported artifacts
are adopted through the respective owner gates. Stronger live-update or fleet
profiles have their own gates; their planned existence is not an admission or
a blanket reason to block the qualified initial scope. The owner reviews the
whole-system plan before main greenfield implementation expands.

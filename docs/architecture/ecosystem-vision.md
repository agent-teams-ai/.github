# Foundation-first Architecture and ecosystem vision

Owner direction recorded on 2026-11-24. This is the maintained organization-wide
vision and coordination plan, not a new FMS edition, a package admission, a
production API, or a qualification receipt. The owner has selected the
foundation-first direction; detailed technical alternatives below remain
proposals until accepted by their respective owners. Reading this plan does not
assign its workstreams to an agent; apply the [task-scope boundary](../engineering-quality-standard.md#task-scope-and-obvious-corrections).

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

## Reading order and decision status

Use the ownership map to find the responsible repository, then read its current
plan, accepted decisions and actual qualification evidence. The tables below
record owner direction and review topics; an entry is not an implementation
assignment, an accepted technical selection or a claim of shipped behavior.

Keep owner direction, proposed choice, accepted contract, implemented mechanism,
qualified artifact and consumer adoption distinct. Preserve the
existing owner record for each state instead of copying a second roadmap here.

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
   Qualify useful behavior through realistic disposable fixtures and named
   consumer seams before dependent product implementations are ready. Record
   independent expected outcomes, unsupported cases and the claimed profile.
   Different intended consumers should exercise materially different cases,
   not copies of one toy. A planned consumer is not evidence of adoption.
4. Qualify exact artifacts, supported toolchains, contracts, integration and
   security/lifecycle behavior. Keep provisional 0.x implementation,
   stable/public SPI publication, production-host admission and actual
   consumer adoption separate. Preserve accepted safety and conformance gates.
5. Begin or expand main greenfield product implementation on the applicable
   qualified foundation and accepted owner contracts. Product architecture,
   independently assigned research, and narrowly admitted qualification work
   can proceed in parallel within their explicit tasks. Do not rush product implementation, but do not make every
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

## Existing independent projects and observed consumers

The ecosystem is already larger than the three greenfield product repositories.
The following source observations identify concrete reuse and independent
delivery needs; they do not claim every listed repository adopts every
foundation library or has released its complete product.

| Project | Existing role and observed consumer boundary |
| --- | --- |
| [Payments SDK](https://github.com/agent-teams-ai/payments-sdk/blob/a6aa0c0859c6b2dc0205a4edbfc0fd275d1d52bc/README.md) | Reusable payment mechanisms; optional Get Modular composition package and independent core/provider/storage packages. Consumer owns commercial access and credit policy. |
| [Account Gateway](https://github.com/agent-teams-ai/account-gateway/blob/b6da5f410e60d2b855d7ba311ff170bba5fa3664/README.md) | Reusable account and inference gateway; documented server SDK and static Get Modular entry. Consumer owns product users, workflows and workspace authorization. |
| [Sub2API Standalone](https://github.com/agent-teams-ai/sub2api-standalone/blob/c0ba34e0c8a9dd54830e33a346df1a6b39a9b9f1/README.md) | Go inference engine and upstream-derived gateway work, independently owned. Do not force TypeScript or module framework migration into the fork. |
| [Node or Bun](https://github.com/agent-teams-ai/node-or-bun/blob/31080e937fbbb1bdb7f7eb16d3907a5f176218d3/README.md) | Portable process execution with explicit runtime adapter selection; a reusable mechanism rather than an application Host. |
| [Old provider implementations](https://github.com/agent-teams-ai/old-provider-implementations/blob/d58500bc983e897506e23d7b0bc8da1209864edd/README.md) | Independent historical provider adapter and session-contract workspace; a possible qualified donor/consumer seam, not the greenfield Runtime architecture baseline. |
| [Managed OpenCodeReview](https://github.com/agent-teams-ai/open-code-review/blob/8a70944f567beba9ffc12d1153e33ef5fd60967d/README.md) | Managed upstream-derived review CLI; its own build, release and provenance boundaries. |
| [Agent Teams Token](https://github.com/agent-teams-ai/agent-teams-token/blob/2a840af46aa092293c1479524bd0ca20f120a107/README.md) | Separate community-token, governance and transparency project; documented dev-only Engineering Foundation consumer, not part of the agent execution domain. |

The Payment SDK and Account Gateway provide especially valuable independent
consumer cases for modular-library ergonomics. Their documented integration
surfaces are not evidence of current public release, independent plugin SPI
conformance or a completed live-update operation. Inspect the actual pinned
consumer contract before selecting them for new qualification. Include additional
existing and planned products in the relevant library owner plan as needs become
concrete; do not start migrations or duplicate upstream capabilities.

## Reuse levels and dependency rules

Use the smallest appropriate level, independently of repository layout:

| Level | Contract | Reuse and dependency direction |
| --- | --- | --- |
| Mechanism library | Portable behavior and narrow typed ports | Ordinary import; no mandatory Host, registry, product or deployment |
| Feature or capability | Owned behavior, public surface and dependency policy | Consumer imports only declared public surfaces; no foreign internals |
| Composed module | Declaration, bindings, construction and applicable resource lifetime | Composition depends on features and Get Modular; feature domain/application does not depend on the composition engine |
| Installed extension | Artifact and one or more typed, versioned contributions | Product-owned adapters compose the extension, trust and update mechanisms; installation is not permission |
| Host or service | Product authority, execution profile, routing, operational lifetime | Composition root selects compatible implementations; external consumers use published contracts |
| Product or deployment | Business scope and independent release/failure domain | Integrate through owned API/SDK or published language, not shared private databases or domain aggregates |

A neutral mechanism cannot import a consuming product. Engineering Foundation
remains dev-only; AAS remains an independent specification, not a runtime
dependency. Get Modular and Extension Foundation are independent neutral cores.
The proposed shared update operation consumes qualified mechanisms and
owner-specific ports, not another product's private state. A product-specific
integration may compose several libraries; none should gain a mandatory
dependency on unrelated capabilities. Existing accepted product boundaries
and local adoption profiles decide exact package and source edges.

### Intended consumer coverage

Use actual owner seams rather than implementing an entire product to test a
library. The following are consumer candidates, not confirmed adoption or
authority to implement their domains. Reconcile these with the owners'
current plans and active work.

| Consumer | Representative qualification question |
| --- | --- |
| Runtime v3 | Can a headless runtime capability be constructed, replaced at an admitted boundary and cleaned up without product/UI dependencies or loss of execution authority? |
| Orchestrator | Can independent nested features compose in multiple profiles, and can a replaceable capability use its own durable state and preserve cancellation? |
| Platform | Can the same neutral mechanisms operate with managed, tenant-scoped policy and independent deployment authority? |
| Future frontend / desktop / web / mobile | Can reusable behavior run independently of a shell, with optional compatible presentation and separate trust/placement? |
| Other tools and external applications | Can a consumer install only a selected ordinary library or a supported module/plugin, without organization-specific credentials, internal APIs or the whole platform? |

Record the actual test-consumer repository, entry point, target/profile,
required capabilities, denied cases, exact artifact and proof in the owning
delivery plan. Reuse of one built artifact needs that same artifact in independently
wired test Hosts for its declared environments. Target-specific builds need
shared-contract evidence and qualification of each actual artifact; they do not
prove that one binary is interchangeable across targets. A bounded single-Host
proof retains its narrower scope. Two Hosts using one core are not two independently
authored implementations of a public SPI. The breadth of planned consumers
justifies early reusable design, while actual qualification establishes which
portability and compatibility claims are supported.

The [existing foundation delivery plan](https://github.com/agent-teams-ai/live-module-updates/blob/main/docs/plans/foundation-delivery-plan.md)
coordinates the F0-F5 fixture sequence; later application adoption remains with
each consuming product owner. Start with the smallest supported useful scenario
and its rejecting controls. Browser, desktop and untrusted third-party plugins
are confirmed architecture targets; each claimed execution or isolation profile
needs its own evidence. Live-update and state-migration guarantees also require
their applicable qualification. A passing plan or documentation CI proves none
of those runtime claims.

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

The independently usable neutral cores and product-owned operational authority
are accepted boundaries in
[Extension Foundation ADR-0015](https://github.com/agent-teams-ai/extension-foundation/blob/5ee8a788935c885fac075a5860a0217cf420b4d7/docs/decisions/0015-authorize-get-modular-semantic-extraction.md).
A coherent SDK, installation or distribution may delegate to those same
mechanisms without combining their authority or making every consumer install
unrelated runtime dependencies. Packaging alone does not decide that boundary.

A compulsory runtime coupling neutral composition, artifact trust and product
activation for every consumer, and separate copies of the same shared update
algorithm in each product, are rejected counterexamples under those boundaries
and the [library-first direction](../engineering-quality-standard.md#library-first-design-and-deliberate-evolution).
They are not open alternatives. Product-specific policy, custody and narrow
integration adapters still belong to their actual product owners.

The remaining ergonomics question is direct library composition versus an
optional coherent entry point or integration preset that delegates to the same
mechanisms. Route that choice through
[Extension OD-003](https://github.com/agent-teams-ai/extension-foundation/blob/5ee8a788935c885fac075a5860a0217cf420b4d7/docs/open-decisions/OD-003-module-runtime-and-public-spi-choices.md)
and the existing Live Module Updates delivery plan above. Compare both paths in
a representative authoring, install, invoke, update and remove scenario; verify
that the minimal external library retains its independent dependency closure.
Add a thin integration surface only if that evidence shows a concrete need.
Keep implementation selection and detailed estimates with the active owner
plan instead of maintaining a second cross-project estimate here. No new
package, SDK or final graph is accepted by this navigation note.

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

### Headless behavior, presentation and client targets

Useful behavior should remain independently consumable without its optional UI.
Distinguish UI-independent behavior, unstyled widgets, framework-neutral
declarations, runtime portability and security isolation; none proves the others.
Reuse established UI and accessibility primitives in the selected renderer.
This direction does not assign construction of a new UI toolkit or universal
renderer, choose a frontend framework, or make a library name an adoption.

Web and desktop may reuse compatible presentation code; portable behavior may
also serve mobile through target-owned adapters. A desktop shell must not own
shared business policy. Sharing behavior does not require identical UI, DOM,
storage, IPC or privilege APIs across those targets. Keep the core's public
runtime and declaration dependencies free of optional renderer/shell packages.

The [headless plugins and optional UI design](https://github.com/agent-teams-ai/live-module-updates/blob/main/docs/architecture/headless-plugins-and-ui.md)
owns the detailed behavior/UI contract questions and qualification criteria.
Each product owns presentation, state, permissions and supported targets.
Mobile is an intended consumer direction, not a newly admitted runtime profile.
Keep target-specific decisions and tests in their existing owner plans.

## Global architecture constraints to settle before dependent product code

These are required design topics, not new accepted technical decisions or an
instruction to implement every mechanism immediately. Reuse existing owner
ADRs and open decisions; add only missing deltas and review alternatives.

| Topic | Preferred direction to evaluate | Primary owner routes |
| --- | --- | --- |
| Placement and failure domains | Cell-ready stable identities, scoped routing and fenced transfer; start with a bounded deployment | [Platform Deployment Management](https://github.com/agent-teams-ai/agent-teams-platform/blob/main/docs/domain/contexts/deployment-management/README.md); Orchestrator persistence and OD-033 |
| Resource and cost limits | Owner-specific bounded reservations; hierarchical delegation where measured shared bottlenecks require it | [Runtime v3 plan](https://github.com/agent-teams-ai/agent-runtime/blob/main/docs/architecture/agent-runtime-greenfield-foundation-plan.md), C0–C3; Orchestrator OD-024 and OD-033 |
| Recovery | Owner-local durable effects and independent fencing; multi-store restore reconciliation | Runtime F01–F18 and S2 in the v3 plan; Orchestrator OD-003/OD-013/OD-032; Platform authority |
| Authority | Scoped delegation and receiver/last-mile enforcement, including agent and extension trust boundaries | [Research E5](https://github.com/agent-teams-ai/engineering-research/blob/main/docs/lessons/preimplementation-decisions.md#e5-authorization-freshness-at-a-cross-cell-effect-boundary) routes to Orchestrator OD-012/OD-031/OD-032 and Platform/Runtime owners; it accepts no authorization mechanism |
| Event/automation amplification | Bound causal depth, width, cumulative work, bytes, retries, fanout and reserved control progress | [Orchestrator OD-033](https://github.com/agent-teams-ai/agent-teams-orchestrator/blob/main/docs/open-decisions/OD-033-ooda-convergence-and-context-activation.md), eventing contracts and Runtime capacity |
| Independent upgrades | Versioned semantic contracts, bounded compatibility/recovery horizon and generation-aware rollout | [Research E6](https://github.com/agent-teams-ai/engineering-research/blob/main/docs/lessons/preimplementation-decisions.md#e6-independent-upgrades-with-retained-durable-work) routes options to each contract owner; Foundation owns evidence mechanisms |
| Persistence | Feature-owned mappings/schemas/migrations, shared technical infrastructure only; resolve S2 bundle ownership | [Runtime #245](https://github.com/agent-teams-ai/agent-runtime/issues/245) and [#246](https://github.com/agent-teams-ai/agent-runtime/issues/246); FMS and consumer owners |
| Large codebase | Independent source, compilation, composition, deployment and execution graphs; scoped/incremental checks with sound invalidation | [Foundation growth review](https://github.com/agent-teams-ai/engineering-foundation/blob/main/docs/development/quality-gates.md#foundation-first-growth-review-proposed), FMS, Get Modular and [AAS delivery focus](https://github.com/agent-teams-ai/agent-architecture-standard/blob/main/README.md#delivery-focus) |

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
candidate is not a supersession. Use the [owner-facing architecture decision comparison](../engineering-quality-standard.md#owner-facing-architecture-decisions-and-estimates)
for estimates, conditional recommendations, evidence and critique. Record
unresolved choices in their owning records. Continue only independently
authorized parts of the assigned task; reviewed documentation may land before
its proposed choices are accepted.

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

# ADR-0010: Feature Module Standard v1.1 adds sub-features

Status: Proposed

Date: pending acceptance

Decision owner: Organization maintainers

## Context

Feature Module Standard v1 places every feature directly in a module's
features root and defines no nested form. When a feature grows too large to
stay one unit, v1 offers only a sibling feature, which spreads tightly
related parts across the module and exposes each of them to every other
feature. On 2026-10-11 the owner decided that features may nest to any depth:
a package is a unit of reuse and distribution, a feature is a unit of meaning
and ownership, and a feature with its sub-features moves as one folder.
Composition also lacks a surface for the identifiers and descriptors that
connect a provider feature with its consumers, so such a dependency is a deep
import under v1. Version v1 is byte-immutable under ADR-0004.

## Decision

1. Publish Feature Module Standard v1.1. It adds sections Sub-features and
   Composition contracts and the matching adoption, layout, test,
   composition, guardrail and evidence rules: sub-features at
   `<parent root>/features/<name>/`, private to their parent, reachable
   outside it only through declared republication, assembled only by their
   parent, and connected only through public entrypoints, the internal API
   where the standard allows it, and, from composition, composition
   contracts, with an acyclic graph of downward and lateral use edges.
2. Version policy, decided by the owner as the documented approval
   authority: a minor successor `vN.M` of its predecessor, `vN.(M-1)` or
   `vN`, may add constructs that a profile must declare before using them,
   with requirements, including adaptations of predecessor requirements,
   that apply only to a module that declares them. It may also correct a
   published requirement, for example by clarifying or relaxing it, when the
   correction makes no repository that conforms to the predecessor
   non-conforming. Every other requirement of the predecessor stays
   unchanged, so a repository that conforms to the predecessor and declares
   none of the added constructs conforms to `vN.M` once its profile pins
   `vN.M`. Every other change publishes `vN+1`. Version v1.1 is the first
   minor successor.
3. Version v1 stays published. No repository moves to v1.1 implicitly. Each
   adopts it through its own profile, decision and deterministic gate.
4. The informative examples of section Sub-features are the shared cases that
   conformance implementations should include in their fixtures. An
   implementation may be repository-owned or shared tooling; either validates
   the policy a profile declares and never widens it.

## Rejected alternatives

- Keep v1 and split only into sibling features: tightly related parts spread
  across the module and stay visible to every other feature.
- Nest a sub-feature directly in its parent root (`<parent>/<child>/`): child
  names collide with role names, so a checker can no longer read the first
  segment below a feature root as a role.
- A second container name such as `sub-features/`: moving a feature between
  the top level and a parent would rename its container.
- Count upward use edges in the cycle graph, or forbid a parent to use its
  sub-features: either rejects a parent and a sub-feature that share the
  parent's contracts, the main reason to nest.
- Publish v2: no v1 requirement changes for a module that declares no
  sub-feature and no composition contract, so a major version would announce
  a break that does not exist.

## Consequences

- A repository may nest features and declare composition contracts after its
  profile adopts v1.1. Until then a v1 profile and its checker keep their
  current behavior.
- Agent Runtime needs a scoped checker and profile change, under its own
  decision, before its features nest.
- A repository without a profile may follow the v1.1 rules without claiming
  conformance.
- A later change that could make a repository that conforms to v1.1
  non-conforming, other than through a construct its profile must newly
  declare, publishes v2. Any other change, such as an added construct or a
  correction that clarifies or relaxes a requirement, may publish v1.2.

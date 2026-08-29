# ADR-0004: Versioned Feature Module Standard

Status: Accepted

Date: 2026-08-29

Decision owner: Organization maintainers

## Context

The Orchestrator feature module rules contain a reusable architecture core, but
they also contain product-owned topology, technology choices, decisions, and
enforcement details. Copying the document into other repositories would create
divergent authorities. Keeping the reusable rules inside one product would make
cross-repository adoption ambiguous.

## Decision

1. The organization owns a language-neutral Feature Module Standard as a
   versioned immutable artifact.
2. Version `v1` owns only universal feature ownership, layer responsibility,
   dependency, composition, testing, sharing, and extraction rules.
3. Adoption is explicit. Every consumer owns a local profile that maps the
   standard to repository topology and records extensions, deviations, and
   deterministic enforcement commands.
4. Product repositories continue to own their domain model, bounded contexts,
   accepted decisions, technology choices, and conformance implementation.
5. A published version is byte-immutable. Changed requirements produce a new
   version, while the central registry evolves append-only.

## Consequences

- Multiple repositories can adopt one stable architecture vocabulary without
  copying product-specific policy.
- Central changes cannot silently redefine an existing consumer profile.
- Product repositories retain local authority and can strengthen or explicitly
  deviate from the baseline.
- Conformance remains a repository-owned claim backed by deterministic local
  gates.

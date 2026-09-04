# ADR-0005: Explicit five-coordinate Qualified Docs Cohort v2

Status: Accepted authority substrate; no Cohort v2 release is registered

Date: 2026-09-04

Decision owner: Organization governance

## Context

The original Qualified Docs Cohort binds two packages produced by Engineering
Foundation. The producer has since separated portable Docs behavior, Agent Teams
policy, repository mutation, and document authoring. Treating the installed tree
or package count as a generation signal would let one Cohort identifier resolve
to different authority.

## Decision

1. Existing Cohort v1 records, events, ordering, and digest domains remain byte
   immutable. A v2 record is selected only by its explicit
   `cohort_generation: 2` discriminator.
2. Cohort v2 binds exactly five npm coordinates, in canonical order:
   `@agent-teams/repository-mutation`, `@agent-teams/document-authoring`,
   `@agent-teams/docs-protocol`, `@agent-teams/docs-protocol-agent-teams`, and
   `@agent-teams/engineering-foundation`. Docs Protocol MCP is excluded.
3. Docs Protocol, Docs Protocol Agent Teams, and Engineering Foundation are the
   three consumer roots. Repository Mutation and Document Authoring remain exact
   transitives. The seven permitted internal dependency edges are closed and
   every coordinate is bound by exact version and registry SRI.
4. V2 assets are owned by `@agent-teams/docs-protocol-agent-teams`. V1 asset
   ownership does not change. Consumer integration, managed state, and Docs
   Protocol schemas bind the explicit `3/2/1` tuple. Existing Foundation plan,
   journal, receipt, and envelope schemas remain separately bound.
5. Runtime closure v2 uses the
   `agent-teams.docs-runtime-closure/v2` domain and carries the exact five
   coordinates, three roots, closed managed edges, and complete pnpm closure.
6. Every upgrade and rollback identifier must name an earlier Cohort that has
   immutable QUALIFIED evidence. Consumer policy and gates bind the generation;
   package shape never selects it.
7. Qualification receipt v3 is supporting canary evidence only when paired with
   a digest-bound immutable execution envelope. It cannot satisfy or replace the
   central consumer CANARY check-run evidence required for lifecycle promotion.
8. This change publishes only the authority substrate. A concrete Cohort v2
   record requires exact released versions, SRIs, provenance, workflow revision,
   runtime closure, and canary identities in a later append.

## Consequences

V1 consumers continue unchanged. A v2 rollout is explicit, reversible through
declared edges, and closed over independently published runtime packages. Future
coordinate changes require a successor Cohort generation rather than inference
or a compatibility bridge.

## Rejected alternatives

- Infer v2 from five packages, profile shape, or installed modules.
- Make all five packages consumer roots.
- Include Docs Protocol MCP in the managed Cohort.
- Accept a local qualification receipt as central CANARY authority.

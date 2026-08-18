# ADR-0001: Qualified Docs Cohorts

Status: Accepted

Date: 2026-08-16

Decision owner: Organization maintainers

## Context

Docs Protocol consumers need Foundation, Docs Protocol, reusable workflow,
schemas, and managed assets that were tested together. Independent npm tags do
not prove that combination, and mutable fleet records mix release authority with
later CI observations.

## Decision

1. The upgrade unit is an immutable Qualified Cohort, not an npm version pair.
2. A Cohort binds exact package versions, real npm publication timestamps and
   SRI, cryptographically checked npm provenance, the reusable
   workflow commit and blob, schema versions, asset hashes, runtime bounds,
   compatibility timing metadata, migration edges, and evidence references.
3. Lifecycle is an append-only hash-chained event stream. A trusted
   `pull_request_target` check reads base and head through the GitHub API without
   executing pull-request code, validates the untrusted head with base-owned
   schema and lifecycle code, rejects stale-base concurrent appends, and rejects
   deletion or rewriting.
4. General fleet selection permits only the current `RECOMMENDED` Cohort.
   `QUALIFIED` and `CANARY` are selectable only by immutable declared canary
   repository identities; `QUALIFIED -> CANARY -> RECOMMENDED` cannot be
   skipped. Selection for a new rollout is distinct from support for an existing
   binding: a `SUPERSEDED` Cohort remains supported only until the exact
   `support_until` instant. `SUPPORT_ENDED`, `SUSPENDED`, and `WITHDRAWN` are
   blocked. `SUPERSEDED` may still transition to `SUSPENDED` or `WITHDRAWN`.
   A suspension has no implicit fallback; recovery uses an explicit qualified
   rollback edge.
5. Release facts live once in the Cohort registry. Fleet admission stores
   per-repository desired and observed Cohort IDs plus consumer-specific
   evidence. It does not store one global package version, so fleet N and canary
   N+1 can coexist.
6. Exceptions are separate, enumerable, owned, scoped, reviewed, and expiring.
   External forks remain explicit classifications rather than temporary
   exceptions.
7. Package discovery tags are advisory. Exact Cohort records are authority.
8. A manual read-only observer paginates and replays the entire GitHub inventory
   to reject truncation and mid-read drift. Continuous fleet observation remains
   out of scope until a dedicated read-only GitHub App exists.
9. Qualification is evidence-gated, not calendar-gated. During MVP development,
   passive waiting or ceremony without a measurable risk signal must not block
   delivery. `eligible_after` and `minimum_release_age_hours` remain legacy V1
   compatibility metadata only; they do not authorize or delay promotion.
   Strong architecture and deterministic validation remain mandatory. Prefer
   explicit live npm/provenance/workflow verification, isolated canaries,
   suspension, and rollback because each produces or acts on observable evidence.
10. The live verifier also reads the published Docs tarball, proves its exact
    Foundation dependency and asset bytes. Caller workflow authority records
    both the raw published template digest and the digest rendered from the
    exact repository/path/revision tuple; each fixed placeholder must occur
    exactly once and no caller or Cohort digest is embedded recursively. The
    verifier also resolves canary repository ID,
    default-branch ancestry, head SHA, check context, GitHub App integration,
    conclusion, check-run ID, and URL through GitHub APIs.
11. The reusable consumer gate resolves registry and admission policy from one
    immutable snapshot of the controller default branch before checkout. Caller
    inputs are assertions only. QUALIFIED and CANARY execute only in declared
   canaries; RECOMMENDED executes only in centrally admitted repositories.
12. Consumer projections contain immutable qualification facts only. Current
    lifecycle state remains central and is evaluated on every hosted check.
13. Repository source provenance, governance ownership, repository lifecycle,
    documentation role, and admission are independent axes. New owned
    repositories start `pending_classification`; archived, transferred, and
    deleted repository IDs remain tombstones. Historical canary evidence binds
    its immutable declared identity and does not depend on current active
    inventory membership.
14. Every append of a Cohort record or lifecycle event passes the base-owned
    `pull_request_target` verifier. It installs the exact packages before
    cryptographic signature audit and binds canary repository ID, default-branch
    merge SHA, GitHub Actions App, check run, workflow run/path, conclusion, and
    committed caller bytes. Pull-request code is never executed.
15. Negative emergency events (`SUSPENDED`, `WITHDRAWN`, and support termination)
    require deterministic append-only validation but no external service. Every
    positive promotion continues to require fresh live proof.
16. A new consumer first enters as a desired-only `admission_candidate`; central
    admission/binding requires exact default-branch green evidence. Renovate is
    disabled for both managed packages, so only a qualified Cohort proposal can
    change their pair.
17. Global append order is carried by sequence and the digest chain, not domain
    `effective_at`. Each Cohort retains its own publication/lifecycle time, so a
    delayed registration remains possible after an unrelated emergency event.
18. Admission evidence is live proof, not a self-consistent JSON claim. Hosted CI
    resolves exact default-branch HEAD, check/workflow runs, caller bytes, and the
    committed managed projection. Fleet remediation is serialized to one owned
    `rollout_pending` consumer, while suspension remains immediately appendable.
19. The reusable gate obtains a GitHub OIDC token with a dedicated audience and
    binds `job_workflow_ref` plus `job_workflow_sha` to the exact Cohort-pinned
    controller workflow before checking out validator code. The token is also
    bound to caller repository ID, repository name, event SHA, and ref. The job
    grants only Contents read and OIDC identity minting; it receives no secrets
    and no repository write permission.
20. A Cohort runtime closure is immutable producer qualification evidence and
    the lock for the gate's isolated trusted install. It is not a canonical
    consumer lockfile. Consumer lockfiles must bind the exact managed package
    versions, SRI, and Docs Protocol to Foundation edge, but package-manager-owned
    transitive versions and peer contexts may differ by an existing consumer
    graph. Hosted checks still execute the Cohort-qualified packages, while
    consumer CI and lockfile review cover the consumer's resolved graph.
21. A consumer may retain declarative security overrides and narrow peer-only
    package extensions in its root pnpm workspace policy. The trusted gate
    requires an identical lockfile projection, exact registry versions, bounded
    entries, no managed-package replacement, and no change to a package version
    already fixed by the Cohort runtime closure. Package patches, hooks, aliases,
    links, URLs, and package extensions targeting the qualified Docs runtime
    remain forbidden. Trusted Docs execution still uses the isolated Cohort
    closure, never the consumer dependency graph.

## Consequences

- A partial package pair cannot be called current.
- Elapsed wall-clock time alone cannot qualify or block a Cohort.
- Release, rollout, suspension, rollback, and fleet evidence remain distinct.
- Historical Cohort facts stay reviewable without granting cross-repository
  write authority.
- Consumer security remediation can coexist with the protocol without turning
  consumer package policy into executable trusted-gate input.
- Existing consumers can retain compatible package-manager-owned transitive and
  peer resolutions without failing an unrelated documentation admission gate.

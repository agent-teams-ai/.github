# ADR-0003: Reconciled Package Publication

Status: Accepted

Date: 2026-08-28

Decision owner: Organization maintainers

## Context

An npm package can be published successfully even when its originating GitHub
Actions release attempt ends in failure. The signed npm provenance still binds
the package to that immutable invocation, while a later rerun can provide the
missing successful release evidence.

## Decision

1. Signed npm provenance always binds the immutable originating workflow
   attempt and remains mandatory together with registry SRI and attestation
   verification.
2. Legacy publication evidence requires that exact originating attempt to have
   completed successfully.
3. Reconciliation is allowed only when the exact originating attempt and its
   single `release` job completed with failure.
4. Reconciliation must explicitly bind a strictly later successful attempt of
   the same workflow run, repository, source SHA, `main` push, and
   workflow path, plus the exact successful `release` job.
5. Mutable latest-run evidence and cancelled, skipped, incomplete, duplicated,
   or mismatched release evidence are never accepted.

## Consequences

- A real npm publication is recoverable without rewriting signed provenance.
- Failed or ambiguous releases remain fail-closed.
- Historical Cohorts without reconciliation metadata keep their exact-success
  semantics.

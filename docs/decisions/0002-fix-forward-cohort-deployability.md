# ADR-0002: Fix-Forward Cohort Deployability

Status: Accepted

Date: 2026-08-23

Decision owner: Organization maintainers

## Context

A published Docs transition catalog can match its recorded digest while omitting
the current fleet Cohort. Such a release is authentic but cannot execute the
governed upgrade. The V1 target-first package lifecycle also cannot honestly
embed its own future SRI as a rollback executor inside the same tarball.

## Decision

1. Every successor declares at least one `upgrade_from` origin. `rollback_to`
   may be empty and then explicitly means fix-forward.
2. Live qualification parses the exact published transition catalog using
   trusted controller code and verifies every bundled Cohort projection against
   central immutable authority.
3. Every declared upgrade origin must have one content-addressed direct target
   bundle whose skill and rendered caller bytes exist in the published tarball
   and match the authoritative digests.
4. V1 rejects new non-empty rollback declarations. A future rollback lifecycle
   requires its own reviewed ADR and executable evidence without self-reference.
   Historical records remain readable and re-verifiable, but their legacy
   `rollback_to` metadata does not authorize central rollback selection.

## Consequences

- A digest-valid but unreachable release cannot be promoted.
- The first stable rollout can adopt the qualified RC fleet without fabricating
  rollback evidence.
- Incidents use suspension and fix-forward until a real rollback lifecycle is
  qualified.

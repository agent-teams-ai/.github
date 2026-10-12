# ADR-0009: Bounded Docs source successor

Status: Proposed; staged bootstrap only

Date: 2026-10-12

Decision owner: Organization governance

## Context

The existing `trusted-authority-evolution` and
`trusted-cohort-authority-evolution-v8` required contexts bind source, verifier,
cohort, installer and historical admission routes. A successor cannot replace
them by adding a workflow: the old ordinary input guard and accepted historical
cohort routes must remain executable during review, and a source transition must
not create an unprotected interval.

## Decision

Stage one base-owned successor guard beside the existing contexts. It records
live PR identity, default-branch/base/head coordinates, complete paginated file
metadata, complete untruncated Git trees, and bound install blobs. The exact
PR363 seven-file source transition is a finite special route. Ordinary PRs,
including the bounded bootstrap addition and the three-file controller route,
retain the existing verifier authority route; the controller route additionally
binds regular `100644` before/after leaves and unchanged install/dependency
data. Any incomplete or unlisted change is rejected.

The worker writes only its ephemeral evidence file and performs no policy,
governance, fixture, package or lock writes. The old workflows, guards and
fixtures remain unchanged. The source successor is additive and does not claim
to be a replacement.

## Replacement prerequisite

Replacement of the two required contexts is a separately reviewed serialized
operation after the successor has run from a protected base, all negative and
historical-cohort routes are independently demonstrated, and the existing
ordinary input guard is proven lossless. There is no unprotected interval and no
worker-side policy write. Until that qualification exists, the concrete blocker
is the absent full historical-cohort qualification under both required contexts.
The focused successor tests execute the existing `check-docs-verifier-authority`
logic for ordinary acceptance and rejection, but they do not substitute for the
old trusted cohort workflow acceptance fixtures. Historical cohort qualification
therefore remains pending, no context replacement is claimed, and neither context
may be removed, bypassed or treated as passing.

## Rollback

Remove this additive guard and its ADR in one reviewed change. The unchanged
old contexts continue to own admission until a separately accepted successor
replaces exactly those two contexts, one serialized step at a time.

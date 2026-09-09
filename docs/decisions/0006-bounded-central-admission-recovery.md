# ADR-0006: Bounded central admission recovery

Status: Proposed; local implementation validated, live integration UNBOUND

Date: 2026-09-08

Decision owner: Organization governance

## Context

Legacy pinned runners reject both complete current authority documents. Their
historical successful observations remain evidence of historical behavior, but
cannot prove that their current default heads pass. One unchanged failing row
can block another repository's reviewed selection. Admission also compared a
successful selected-target caller to the historical observed caller digest.

## Proposed decision

Retain strict full current policy and registry validation and every consumer
qualification, semantic, lifecycle, provenance, package and installation gate.
Validate historical evidence against the observed record and current evidence
against its explicitly selected or observed record without rewriting observed
fields. Selection does not itself advance observation.

Introduce finite base-owned incident authority for one exact central repository
and PR, operation, before/after policy bytes, complete permitted diff and exact
target tuple. Bind each evaluation to fresh live base/head coordinates. Identical
rebases need fresh evaluation; earlier successful executions are not receipts
for new heads. An authorization cannot authorize its own addition.

Each covered source requires independently verified repository identity, stable
source head, historical caller/projection/check evidence, source runner and
qualification, exact current and source policy/registry Git coordinates, and
trusted parser failures against both complete documents. Bind failed run,
attempt and job, independently accepted owner decision and incident proof blob.
Closed records reject unknown fields, self-approved booleans, expiry,
revocation, finalization, proof drift and unrelated operations.

An exact TEST selection may explicitly cover an unchanged collateral row without
selecting TEST's target for that row. Every uncovered failure remains fatal.
Report historical_verified, current_verified and recovery_pending separately.
Pending is permission for a central operation, never successful consumer proof.
An independently failed qualification or semantic job cannot be excused; skipped
semantics remain unverified. Stable15 remains TEST-only while its lifecycle and
immutable canary eligibility require that scope.

Advance observed state only after genuine successful selected-target default
branch push evidence, matching caller/projection/generation/runner, ancestry,
current eligibility, successful qualification and semantics, and stable heads.
Retain historical incident evidence and retire consumed authorization. Local
receipts and envelopes cannot substitute for hosted qualification.

## Integration prerequisite

Required V5 rejects both implementation and guard staging. The append-only
required check also rejects admission verifier/workflow changes. A separately
retained exact guard proposal is review material, not an active admission route.
Root must establish independently trusted staging under the effective protections,
verify complete immutable trees and exact regular-file old/new blobs, and prove
bounded enforcement and full restoration. No required context is removed,
bypassed, spoofed or reinterpreted by this proposal. Actual protection operations
are outside this patch. Existing consumer pins and the separately owned PR209
and Runtime PR69/70/71 are outside this decision.

## Evidence and open work

The implementation separates admission results and validates closed, seven-day
base-owned authorization records. It binds independent admin-owner comment
identity/content, immutable proof and current input blobs, source runner schemas,
both parser replays, failed run/attempt/jobs and trusted diagnostic log coordinates.
Collateral failures remain pending, and target qualification/semantic execution
is checked separately from historical source success. Observed advancement
preserves and verifies the prior observation and requires the current target head.
A legitimate admission_candidate/bootstrap_pending first binding retains the
ordinary admission path with strictly null prior observation and the previously
selected target. Both first binding and observed advancement verify the full
qualified target projection, exact runner and run attempt, and successful
qualification and semantic jobs and steps. First binding has no prior history
to fabricate; it cannot skip new target evidence. Missing or partial history on an already-bound row is not
bootstrap. Current success requires exactly one matching head/context/App check
on initial evaluation and on the final fleet reread, including when the head
is the submitted observation. Historical evidence retains its recorded-ID lookup.

Focused suites execute the admission functions, bounded incident module and
workflow materializer, including imported orchestration with the complete real
policy, registry, schemas and lifecycle validation. Exact historical Git schemas
reject both complete current documents (two policy and 100 registry Ajv errors
for each legacy runner); modern stable14/15 schemas accept. Removing only the
two policy fields still leaves the independent registry failure. Synthetic API
fixtures establish rejection behavior, not real hosted success. Historical run
logs bind the original controller snapshot; final run/check snapshots reject
same-head reruns and drift. Current source profiles and projections must match
the historical source exactly.

Local validation results for the corrected implementation are retained in the
worker handoff; dependency versions and lockfile bytes remain unchanged. Feature
Module Standard and trusted-base append-only validation remain required. The
concrete guard transition proposal and exact implementation blob manifest are
retained separately in `worker-output/`; they are not staged guard code. Future
PR/head and effective protection integration remain UNBOUND. These local results
do not establish a usable protection transition.

Real incident authority, accepted owner decision, live source proof, central PR,
final execution head, hosted target success and protection integration are
UNBOUND. No real incident record is created by this decision. The deterministic
focused gate is `node --test scripts/docs-admission-recovery.test.mjs scripts/docs-legacy-admission-recovery.test.mjs scripts/docs-admission-workflow.test.mjs scripts/docs-admission-change.test.mjs`; full
central validation remains `pnpm check` plus both Feature Module Standard gates.

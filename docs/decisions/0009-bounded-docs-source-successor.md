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

`96cb95a89ca4a133fbb626133eb3ac6289938ff7` is a pinned SOURCE TARGET for
PR363, not proof of historical acceptance. PR363 remains draft and unmerged,
the two required authority checks still fail, and the current seven-file
before/after blob tuple remains pinned.

## Decision

Stage one base-owned successor guard beside the existing contexts. It records
live PR identity, default-branch/base/head coordinates, complete paginated file
metadata, complete untruncated Git trees, and bound install blobs. The exact
PR363 seven-file source transition is a finite special route and retains its
current seven-file before/after blob tuple. Ordinary PRs, including the bounded
bootstrap addition, retain the existing verifier authority route. There is no
qualified three-file controller route and no accepted controller body tuple:
names, modes and arbitrary hashes alone never admit gate or test weakening.
Unqualified controller edits must be rejected by protected legacy inputs or the
existing verifier authority. The live envelope and `sourceSHA == headSHA`, two
complete tree reads, hidden leaves, modes and install bytes remain bound. Any
incomplete or unlisted change is rejected.

The worker writes only its ephemeral evidence file and performs no policy,
governance, fixture, package or lock writes. The old workflows, guards and
fixtures remain unchanged. The source successor is additive and does not claim
to be a replacement.

## Replacement prerequisite

Replacement of the two required contexts is a separately reviewed serialized
operation after the successor has run from a protected base, all negative and
historical-cohort routes are independently demonstrated, and the existing
ordinary input guard is proven lossless. The old v8 Cohort-data predicate is
preserved only for its narrow data route: `governance/docs-qualified-cohorts.json`
may be modified, and matching evidence or runtime-closure files may be added,
with complete pagination, full untruncated trees, hidden-leaf checks, regular
blobs, protected inputs and unchanged install data. That route retains the old
1..3000 collection bound; every ordinary, source, installer and dependency route
remains 1..32. This is not a broad source allowance and does not redefine
losslessness around synthetic tests. The focused tests execute the real retained
historical v8 materializer, the current v8 materializer, the old authority guard
and the successor on identical finite tuple, Cohort-data and valid dependency
scenarios. No retained genuine accepted Cohort-data PR outside 32 is claimed; if
one is later required, preserve only cohort-only old finite path checks. Until
the full qualification is independently demonstrated, no context replacement is
claimed and neither context may be removed, bypassed or treated as passing.

All seven existing required contexts remain active. No context replacement is
claimed or allowed yet.

### Pre-adoption correction boundary

This ADR remains Proposed and staged. All old required checks and mandatory
guards remain active, `docs-source-successor-v1` is not required, no context
cutover has occurred, and the old contexts are not relabeled as passing. The
five successor inputs become byte-immutable after qualified adoption. The
currently installed additive successor base is not adopted or qualified, and
review found its ordinary routing deficient before adoption.

For proposed staging only, the smallest legitimate correction is one normal PR
from the protected current main changing only the successor implementation,
its existing focused test, and this clarification. It preserves every active
mandatory protection and leaves all five corrected inputs immutable after
qualified adoption. Those corrected bytes are not covered by old qualification:
the unchanged old mandatory guards remain authoritative during review, and the
correction requires fresh independent review, full CI, and a real successor run
from a protected base before adoption. Before any context replacement, the
separately reviewed serialized operation must read a durable actual
qualification manifest bound to raw source logs, live CI records, and the
complete before/after rulesets for each step. This job creates no attestation
service and claims no rollback or serialized-operation result.

The existing successor self-check may reject this proposed input change because
it enforces the final immutability rule. That expected refusal must not be
spoofed, bypassed, or used to force a policy change. No controller or broad
source exemption is created. Existing authority does not forbid this bounded
pre-adoption repair because no required context is removed and no final
immutable input changes after adoption. If repository policy nevertheless
rejects the repair, the smallest allowed path is to roll back the unadopted
additive five-file installation in one reviewed change and reinstall a newly
versioned successor after fresh qualification, rather than weaken a guard.

## Rollback

Remove this additive guard and its ADR in one reviewed change. The unchanged
old contexts continue to own admission until a separately accepted successor
replaces exactly those two contexts, one serialized step at a time.

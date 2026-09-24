# ADR-0007: Platform admission-cycle recovery candidate

Status: Proposed; G/E/I source candidates only, enforcement and owner acceptance UNBOUND

Date: 2026-09-24

Decision owner: Organization governance

## Incident and boundary

Platform repository ID 1319378484 has default head
`a3ce96e00df2f9958fbd614e7fa6cb965f83cab8`. Its managed Docs projection
selects stable25 while the central policy at
`a9521f1f54a9ea836da6ade82344a3c9baded356` records both desired and
observed stable21. Platform's current Docs check rejects. Central PR #314
(`9766914e28cfaec721356d9d748d072c9b5579ec`) proposes a separate Runtime
selection and admission requires current default-branch success for every
consumer. Stable25 is SUPERSEDED; stable26–28 have no stable21 migration edge.
ADR-0006 is Proposed/UNBOUND and recognizes only three legacy parser runners
with unchanged historical source projection. It cannot cover this drift.

## Proposed one-incident rule

The source candidate in `scripts/docs-platform-admission-recovery.mjs` binds the
single Platform repository and a3 source head, exact source profile/caller/
projection blobs, central PR/base/head, full current registry and exceptions
blobs, one policy before/after pair, and the complete one-file PR diff. Only one
non-Platform eligible and reachable Cohort selection may change. Platform's
policy row and stable21 observation must stay byte-identical.

A finite base-owned record would bind a proof Git object, exact failed push run,
attempt, authorization and semantic jobs, diagnostic digest, independently
accepted human owner decision and seven-day validity. It does not embed the SHA
of its own containing base commit. A separately accepted execution tuple must
bind the final central repository, PR ID/number, base/head, manifest digest,
guard bytes, direction, owner decision and installation deadline. The verifier checks live
repository identity, ancestry, check context/App, runner, full job steps and
log, and rereads head, checks, run, decision, owner permission and fresh expiry.
The trusted authorization log must also contain exactly one
`CONTROLLER_SNAPSHOT_SHA` environment coordinate equal to the historical
controller snapshot `a9521f1f54a9ea836da6ade82344a3c9baded356`. The verifier reads
policy, Cohort registry and exceptions from Git at that exact snapshot and
compares their complete bytes and Git blob IDs to the incident-bound inputs.
An absent, repeated, malformed, stale or mismatched snapshot rejects; the
workflow's pinned code revision alone cannot bind its separately fetched data.
The diagnostic reproduction binds the stable25 projection and stable21 policy
row to the qualified registry generation, then checks the pinned controller
blob at `757122cb08ed15aba6c9eef1b1f655b77d1ac54b` (authorization step,
lines 112–114) and runner script blob `48f326515fb47ce0b41e49596bc2467020e9655b`
(generation assertion, lines 792–800). The trusted log must carry one complete
`Central consumer policy does not explicitly match the Cohort generation.`
diagnostic and its exact SHA-256 digest. The existing legacy job-step
comparator owns the known trusted authorization dependency failure shape.
The isolated verifier requires a remaining-fleet adapter before final rereads;
the later installation must bind it to the ordinary full-fleet verifier.
An independently failing qualification or semantic step is fatal. All uncovered
consumer failures remain fatal. The isolated candidate evidence function returns
`candidate_evidence_only`, with qualification and semantics explicitly
unverified. The public admission entry rejects without a separately installed
guard, active base record, accepted execution tuple and full fleet verification.
No current result is admission or current success.

Retirement and observed advancement require the ordinary verifier's genuine
selected-target current default-head success, exact context/App, successful
qualification and semantic steps, current lifecycle eligibility, and stable
head/run/check rereads. Historical stable21 success cannot serve as that proof.
The qualified reachable successor from stable21 is a separate producer lane;
this proposal does not select SUPERSEDED stable25 or create migration edges.

## Staging and inverse

The G/E/I source candidates and unbound templates are inert. The admission
composition reads only a regular record from its exact base; the current base
has none. The draft record also lacks an accepted execution comment and proof.
The guarded entry validates the independent comment, installed guard blobs,
complete fleet and final rereads before returning only `recovery_pending`.
The fleet classifier accepts Platform recovery only as
`recovery_pending`, and `candidate_evidence_only` is rejected explicitly.
An authentic installation requires a separately reviewed exact old/new blob
and regular-file-mode transition tuple, a base-owned active record, independent
execution acceptance and a fleet-wide final reread. The installed guard must close its
own workflow/test/target changes, compare regular-file modes and complete old/
new blobs, reject stale PR/base/head and all unrelated files, and retain every
required context. Its inverse restores the exact old blobs/modes without
rewriting policy or evidence. A reviewer must inspect an exact-byte manifest
and inverse for that later transition.

The current required V8 guard rejects executable guard staging. Admission
evidence rejects recovery proof staging; V1 and trusted validation reject the I
composition. Source manifests and an executable successor guard are included for
review, but the E/I records remain unbound. No independent bootstrap enforcer
for G, accepted decision or authentic hosted proof exists. No existing accepted
ADR bytes change. The original six required contexts remain unchanged.

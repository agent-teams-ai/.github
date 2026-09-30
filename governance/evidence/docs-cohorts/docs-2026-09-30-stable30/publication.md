# stable30 publication proposal

This proposal appends one generation-2 `docs-2026-09-30-stable30` record and
event 180, `PUBLISHED_UNQUALIFIED`, against protected main
`3fe0f135ffc446b3bb174397c6b5783f72a008a2`. The event uses the latest actual
publication, `2026-09-29T17:54:07.257Z`, and the existing event-179 predecessor.
`publication.json` records the exact digests and inspected host observations.

The five coordinates are Repository Mutation 0.2.2, Document Authoring 0.3.2,
Docs Protocol 0.6.2, Docs Protocol Agent Teams 0.2.13, and Engineering Foundation
1.7.0. Token is the sole declared canary repository. Managed runtime remains
`>=24.18.0 <25`; published package engines do not authorize a Node26 process.
MCP is excluded. This proposal makes no VERIFIED, QUALIFIED, CANARY or consumer
adoption claim.

## Publication evidence

The supplied host result in `sources/npm-signatures-and-closure.json` is retained
byte-for-byte. Physical Node24.21 ran the unchanged
`verifyInstalledPackageSignatures` helper, whose return follows assertions that
the raw audit's invalid and missing arrays are empty. Its nine returned verified
entries include exactly one entry for each target coordinate, each with two
complete attestation bundles. Each target's bundles match the existing retained
raw npm bundles. Subject SHA512, source commit, workflow and invocation attempt
match the proposed record. These observations support the five
`signature_verified: true` fields; decoding alone is not a signature check.

The supplied current npm view/time responses match retained integrity, shasum,
tarball, publication time, engines and dependencies for all five packages.
The first three provenance statements retain run 36602046555 attempt 1, whose
single release job 109521591169 failed. Their explicit reconciliation binds
attempt 2 and successful release job 109533098433. Adapter and Foundation bind
attempt 2 directly. Both full run responses bind the producer repository ID,
main push, source SHA and workflow path; no historical receipt is rewritten.

Supplied protected-main branch and comparison responses establish producer
source ancestry and controller pin ancestry at the observation. Recomputed Git
blob identity and decoded workflow bytes match
`9bcbe54dfec6280045ac596e55c1f14ce5f176e1` at both the qualified controller pin
and observed main. The current ruleset requires V8. The exact trusted-pnpm11.20
closure rederives to the retained 83-package source, evidence and authority
SHA256 `3c4f174ddd0709a66055bc94fdc71907323407488db07fe95461cd624d8e47ca`.

All 19 published historical target projections and bundled asset digests match
immutable central authority. Both migration edges name qualified stable25
(QUALIFIED event 161). Adapter 0.2.13 does not bundle stable29.

## Historical checkpoint corrections

`checkpoint.md`, `checkpoint.json` and `record-draft.json` remain historical
staging evidence. Their missing-signature and toolchain observations describe
that earlier checkpoint. The registered proposal uses the later host proof.
The checkpoint's reference to
`scripts/docs-cohort-stable30-checkpoint.test.mjs` does not describe current V8
authority: that staging test was removed and is absent from this base. This
publication adds no test or executable authority and does not reinstate it.

`eligible_after: 2026-09-30T17:54:08Z` remains conservative compatibility
metadata. ADR-0001 item 9 makes qualification evidence-gated; neither that instant
nor the retained 24-hour field enforces a passive wait.

## Integration constraint

The unchanged trusted-validation materializer derives required new closure
paths from existing **registered Cohorts**, then requires matching create-only
closure additions in the PR. Stable30's exact projection already exists in this
base from the staging checkpoint, but no registered Cohort references it. Thus
this minimal append cannot present that existing projection as a new file and
the current materializer rejects it with:
`New runtime closure evidence must be create-only and referenced exactly by an appended Cohort record.`
This is a separate base-owned integration constraint; this proposal changes no
workflow or closure bytes to bypass it. The root operator must resolve the
constraint through the owning authority before this data PR can pass hosted
trusted-validation. A changed base requires fresh append and exact-head review.

Offline checks inspect supplied observations and validate structure, schema,
digests, append-only history and existing regression coverage. They do not
replace the root's authentic live verifier or hosted exact-head validation.
The separate producer author-identity incident remains with its owner; successful
signature and ancestry checks do not resolve it. No consumer or agent operation
was performed.

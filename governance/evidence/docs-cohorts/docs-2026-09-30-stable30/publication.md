# stable30 publication proposal

This proposal appends one generation-2 `docs-2026-09-30-stable30` record and
event 180, `PUBLISHED_UNQUALIFIED`, against merged main
`1d3bd96e3f92006d253eb0f4887b375e8d39a0de` after PR326. The retained publication
observation in publication.json still names its historical main base. The event uses the latest actual
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
and observed main at that historical observation. The prior pnpm11.20 closure
proof remains in the byte-identical npm artifact and applies only to SHA256
`3c4f174ddd0709a66055bc94fdc71907323407488db07fe95461cd624d8e47ca`.
The proposed registration now uses the actual fresh public 83-package capture
at `sources/runtime-closure-refresh-2026-10-03.json` and exact projection SHA256
`422aed0b43d9ba095320ae38c1f236354e6114063e9ac60eb238982d7196ce5c`.
That supplied capture used physical Node24.21.0 and pinned pnpm11.20.0 on
2026-10-03; its receipt retains machine, source revision and file-mtime metadata.
Only transitive Microsoft tsdoc-config 0.18.2 -> 0.18.3 and tsdoc 0.17.0 -> 0.17.1
changed. The five coordinate versions/SRIs and seven managed edges are identical.
The retained signature audit does not claim verification of this new closure.

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

The unchanged trusted-validation materializer requires each newly registered
closure path to be a matching added file in the exact PR delta against main.
PR326 removed the old unregistered projection from merged main. This incremental
correction removes that file only from the unmerged PR325 candidate and adds the
fresh 422aed0b projection as a NEW regular file. Historical checkpoints and the
npm proof retain their original bytes and old closure references. Their complete
old source remains embedded in the unchanged npm proof; no accepted file is deleted.

Required LIVE trusted-validation run 37084004233 failed with
`Published package runtime closure differs from the immutable Cohort authority.`
The retained complete log and capture provenance are in the fresh evidence file.
This is an observed runtime-closure equality failure, not a floor or permission
failure. Prior owning/check success cannot satisfy that failed required gate.

The existing V2 resolver uses a fresh lockfile-only pnpm11.20 resolution from
three exact direct roots. Non-managed dependency ranges can select newer patches
later, so this correction remains tied to the captured public resolution. Fresh
LIVE verification can drift again; the exact-source equality guard remains in force.
This data correction changes no resolver, validator, schema, launcher or pin.
PR339 remains the separate active floor workstream. The reusable workflow stays
at revision 757122cb08ed15aba6c9eef1b1f655b77d1ac54b and blob
9bcbe54dfec6280045ac596e55c1f14ce5f176e1; no re-pin is proposed.

This correction inspects supplied observations and exact data bytes only.
No validator or test is executed by this worker. Main must independently check
history, closure and digests, obtain fresh full LIVE validation, and run one final
owning gate for the corrected head. Existing check success does not validate these
new bytes or replace the failed required trusted-validation.
The separate producer author-identity incident remains with its owner; successful
signature and ancestry checks do not resolve it. No consumer or agent operation
was performed.

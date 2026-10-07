# stable30 staged checkpoint

`docs-2026-09-30-stable30` is an **unregistered, unqualified Node24 v2 draft**
for Token only. The worker cannot complete authentic live verification: npm is
missing, the pnpm wrapper cannot find Corepack, registry access is denied, and
the retained npm audit log has no per-package verified attestation bundles.
The draft deliberately sets all five `signature_verified` fields to `false`.
It fails the registry schema and must not be appended as it stands.

The five versions, in ADR-0005 order, are Repository Mutation 0.2.2, Document
Authoring 0.3.2, Docs Protocol 0.6.2, Docs Protocol Agent Teams 0.2.13, and
Engineering Foundation 1.7.0. MCP is excluded. The runtime is
`>=24.18.0 <25`; broader package engines do not authorize a Node26 process.

## Evidence now available

The host supplied `resolvePublishedRuntimeClosure` output from pnpm 11.20.0
against the live registry. Its supplied file SHA256 is
`f8e89b5843b6d55c3b8c989cd8531a10bf595dbd091a033b3f04a6e4ecf47210`.
The canonical 83-package projection is now retained at
`governance/docs-runtime-closures/sha256-3c4f174ddd0709a66055bc94fdc71907323407488db07fe95461cd624d8e47ca.json`.
Local rederivation with the existing v2 closure implementation reproduces the
exact source and authority, including five package SRIs, three roots, two
transitives and seven managed edges. This is verification of the supplied lock;
the worker did not independently resolve it from the registry.

`sources/` contains unchanged supplied metadata, five authentic raw npm bundles,
both release attempt receipts, both release job receipts, and the central
workflow tree observation. `source-excerpts.json` preserves exact published
archive manifest and adapter asset bytes in base64, including all historical
assets referenced by the transition catalog. Archive SHA256 and SHA512 values
were recomputed against the local supplied tarballs before extracting them.
Neither excerpt hashes nor decoded bundle payloads establish signature validity.
`checkpoint.json` states the scope, blockers and file hashes.

The first three provenance bundles bind run `36602046555` **attempt 1 failure**,
job `109521591169`. Their draft provenance declares reconciliation to successful
attempt 2, job `109533098433`. Adapter and Foundation bind attempt 2 directly.
No retained receipt has been embellished with missing repository or event fields.

All 19 published transition targets match their immutable central qualified
projections and bundled historical asset digests. Both migration directions
select `docs-2026-09-16-stable25`, whose QUALIFIED event is sequence 161.
The adapter does not bundle stable29, so stable29 cannot be an upgrade origin.
The current central workflow bytes match the historical qualified pin locally;
current remote protection, ancestry and blob identity still need a live check.

## Next host checks

1. Use physical Node24 and trusted, distinct absolute pnpm 11.18.0 and 11.20.0
   binaries. Run the existing npm signature verifier for the exact five versions
   and preserve its complete verified attestation bundles. The summary log with
   58 signatures and 9 attestations is insufficient.
2. After that succeeds, prepare an isolated proposed registry containing this
   draft with the five signature flags verified, a recomputed record digest,
   and the first PUBLISHED_UNQUALIFIED event at `2026-09-29T17:54:07.257Z`.
   Derive its sequence, predecessor and event digest from the then-current
   protected-main registry. Run the unchanged verifier:
   `node scripts/verify-docs-cohort-evidence.mjs --registry <proposed-registry> --cohort docs-2026-09-30-stable30`,
   with `DOCS_COHORT_PNPM_V1_BIN` and `DOCS_COHORT_PNPM_V2_BIN` configured.
   Check full protected-main identities and unsuccessful-origin reconciliation,
   not just the supplied receipt projections. Run `pnpm check` as well.
3. A publication PR must receive genuine base-owned trusted validation for its
   exact head before merge. Retain that result before appending VERIFIED and
   QUALIFIED states. This draft conservatively sets `eligible_after` to
   `2026-09-30T17:54:08Z`, the latest publication plus the existing 24-hour age
   policy rounded upward. No future lifecycle event is claimed.
4. Token CANARY requires separate hosted default-branch consumer check-run
   evidence; receipt v3 and its immutable execution envelope are supporting
   evidence only. This checkpoint performs no consumer installation or canary,
   and changes no consumer policy. Resolve the separately reported producer
   squash-author identity incident through its owner; successful provenance
   verification does not resolve that policy incident.

These are requests for orchestration checks, not actions performed by this
worker. The final registered record digest will differ from this draft digest
when the signature assertions become true.

## Regression coverage and transplant

`scripts/docs-cohort-stable30-checkpoint.test.mjs` catches four concrete risks:
accidental authority registration while signatures are pending; substituting an
older or mismatched runtime closure; misrepresenting failed attempt 1 as a
successful publication; and choosing an unbundled stable29 migration origin or
overlooking another invalid historical bundle. It uses the retained source
bytes and existing validators, with no mocked cryptographic verifier and no
qualification claim. The staging guard must be deliberately replaced when an
authentic registry append becomes authorized and evidenced.

All deliverable files are new relative to protected main
`18b7e22f7247a85181516a7bbb989c9d5fad7be3`. Apply only the deliverable patch onto
that base; never push or transplant the TEST evidence commits. The patch does
not depend on `.node26-evidence-TEST`, its old preparation files, or tarballs in
CI. The existing registry, events, receipts, central V8 authority, workflows,
rulesets and consumer policy remain byte unchanged. An evidence-only PR does
not trigger live cohort verification merely because its checks pass.

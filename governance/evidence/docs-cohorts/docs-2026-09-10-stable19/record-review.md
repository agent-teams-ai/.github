# Stable19 publication record

Generation 2 retains the accepted five coordinates, three exact roots, seven
managed edges, schema tuple and workflow authority. Only Engineering Foundation
1.2.0 and Docs Protocol Agent Teams 0.2.4 replace stable18 coordinates. The other
three package coordinates preserve their immutable publication identities.
Every historical record and event remains unchanged.

Publication metadata, downloaded tarball SRI, SLSA statement coordinates and
published asset digests were freshly observed. The exact pnpm 11.20.0 isolated
lockfile-only resolution contains 82 packages and binds closure digest
`sha256:7b42c061ef73e3dd4b1d4a5241b2f547cfc0a7f8b67c634a3116d2e58bd662eb`.
The trusted base-owned PR workflow must cryptographically audit all five packages
and live-check provenance, closure and workflow before qualification.
`publication.json` alone does not claim verified signatures or qualification.

Upgrade and rollback explicitly reference qualified stable18. This append begins
at PUBLISHED_UNQUALIFIED. It does not change admission, canary identity, existing
consumer bindings or the recommended cohort. QUALIFIED and central CANARY evidence
must precede recommendation and general rollout.

ADR-0005 and repository-admission.md were reviewed. The canonical Get Modular
Consumer Module Standard was read at current upstream commit
`f1ec0152c34715395685b349844a7d1c18a2f015`. This data-only release append adds no
composition boundary, capability contract or adoption profile; a consumer module
adoption pin is not applicable in this governance repository.

Focused validation: registry schema, record/event digests, historical append-only
comparison, and existing cohort policy/generation rejection tests. Full repository
checks and live signature/provenance verification run in hosted PR CI.

The publication attempt 1 ended in release-job failure after publishing. Exact
same-source attempt 2 completed successfully (release job 102785697392). Both
changed coordinates explicitly bind that reconciliation using the existing
schema-supported mechanism; their SLSA origin stays attempt 1. The initial PR
live verifier rejected missing reconciliation, proving that it fails closed.

## Qualification blocked

Trusted run 34453238490 passed the package checks before rejecting the published
transition catalog: policy 0.2.4 does not bundle stable18. The cohort therefore
remains PUBLISHED_UNQUALIFIED. The exact stable18 migration edge is preserved;
it cannot be removed to claim a fleet upgrade. A producer policy successor must
bundle stable18's exact qualified projection and historical assets before a
new package tuple can qualify. See qualification-blocker.json.

# stable15 qualification handoff

Baseline is staged commit `5a129e21fdb2409a121b7df8cba24c85aea7f363`.
The immutable record and publication event 120 are unchanged. Events 121 VERIFIED
and 122 QUALIFIED were appended at actual UTC time after the supplied operator
receipt. Their helper-generated digest bindings are in `qualification.json`.
`qualified-projection.json` is supporting evidence generated exclusively by
`qualifiedCohortProjection`; the registry remains authoritative.

The retained operator receipt and exact log bind successful execution of
`node scripts/verify-docs-cohort-evidence.mjs --cohort docs-2026-09-08-stable15`
on the staged source. Parent supplied live signatures, npm/provenance, assets,
rendered caller, workflow and closure verification with exact pnpm 11.18.0 and
11.20.0 paths recorded in the receipt. Worker recomputed record digest
`sha256:639812f41c99205f499aacd6557b14e5d48d5f47fde27448205cbc83f44a8dd2`
and verified log SHA-256
`2b1b6a7f47a2ec9ba9d227a9de89f3d03cc1f6cdb7b795504b01d3213e7f4db3`
before using that evidence. Supplied fresh closure source byte-equals the existing
82-package `13f40994f7320bba8202314fe3eba916ce2db3c5c2185f79889dd562904ffbb4`
closure, and its authority matches the record. No duplicate closure was added.

These are operator observations, not CI attestation or rollout evidence.
Parent must rerun live verification on the final reviewed head, full `pnpm check`,
trusted exact-head/base CI and independent review before merge. Use the distinct
absolute pinned pnpm binaries through `DOCS_COHORT_PNPM_V1_BIN` and
`DOCS_COHORT_PNPM_V2_BIN`. For append-only validation, extract the registry from
the staged baseline above to `DOCS_COHORT_BASE_PATH`, then run
`node scripts/check-cohort-append-only.mjs` against the final registry. If the
central tail advances, reconcile only the unmerged append against that tail.

Worker schema/lifecycle/digest/append-only validation passed against the staged
baseline. Focused cohort tests and Feature Module Standard checks were run; test
results are retained in the external handoff directory. Worker did not rerun
live verification or full CI. A local pnpm 11.20.0 version probe hit an unavailable
configured home directory; this does not invalidate the supplied parent receipt.
The single `.git` write probe failed with EROFS; deliverable is a patch, no commit.

TEST remains the sole declared canary. No CANARY, RECOMMENDED, policy selection,
consumer migration, GitHub write, package publication or workflow change is claimed.
Hosted TEST default-branch push evidence and later reviewed promotions remain
separate parent work. Existing policy, package facts and all earlier records and
events remain unchanged. `eligible_after` remains compatibility metadata; no
COOLDOWN or calendar wait is required for this qualification.

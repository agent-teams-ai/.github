# Extension Foundation compiler-safe managed cohort

## Purpose and scope

The assigned Extension Foundation E1 qualification requires the repository's full
ordinary checks before merge. Its current stable31 toolchain uses Foundation
1.7.2, whose eagerly imported API Extractor initializes TypeScript 5.9.3. The
organization compiler floor is 7.0.2, including tool-owned compiler entrypoints.
This record prepares the smallest supported managed transition that removes that
incompatible execution path while retaining the existing generation-2 contract.

Only `agent-teams-ai/extension-foundation` (repository ID `1333298097`) is the
canary. The proposed coordinates are repository-mutation 0.4.2,
document-authoring 0.3.6, docs-protocol 0.6.6,
docs-protocol-agent-teams 0.6.1 and engineering-foundation 3.1.0. Each coordinate,
integrity, publication time and provenance must come from fresh registry reads
and the existing cryptographic signature verifier. No package is published here.

## Delivery sequence

1. Collect exact registry metadata, verified attestations, the generation-2
   runtime closure and packed adapter assets through the official helpers at
   Central `6a33853123378ef8ea69868da8ecb550cd53c906`. Use exact pnpm 11.20.0 for
   closure resolution, disabled lifecycle hooks and an isolated temporary root.
2. Append the immutable stable32 record and its publication event. Bind the
   current protected reusable workflow at that same Central revision and blob
   `4097e816cf8725035c49c94e27308a6c66a0119b`. Preserve all prior records and
   lifecycle events. This PR contains only the registry, newly added inert
   evidence and its exact content-addressed closure.
3. Let the existing trusted base-owned cohort gate validate the candidate live.
   Retain the actual successful run, attempt, source and job proof before
   appending VERIFIED and QUALIFIED events. Recheck the final candidate and
   merge through the ordinary owner route. QUALIFIED makes the cohort selectable
   only for its declared canary; the separate policy authorizes rollout. The
   current recommended cohort remains unchanged.
4. In a separate policy-only PR, set only Extension Foundation's desired cohort
   to stable32 with generation 2 and rollout_pending. Retain its observed
   stable31 binding and historical evidence until the consumer is qualified.
5. Apply the published managed generation-2 upgrade in the consumer. Add the
   exact stack-toolchain 0.2.0 development dependency solely for the moved Node
   preset; update the narrow preset and exact dependency assertions. Preserve
   selected capabilities, strict compiler settings, required test identities,
   source boundaries, FMS profile and package catalog. Run all ordinary gates,
   review the exact diff, merge and verify the actual main revision.
6. Finalize only the consumer's policy row with its real successful merged
   revision, Docs check identity, record/event digests and workflow coordinates.
   Verify that final policy PR and its merged main result.

Pre-CANARY evidence verification uses the existing changed-record route:

```sh
node scripts/verify-docs-cohort-evidence.mjs \
  --registry governance/docs-qualified-cohorts.json \
  --schema governance/docs-qualified-cohorts.schema.json \
  --changed-from <exact-base-registry>
```

The direct `--cohort` mode also requires actual CANARY evidence and is not the
appropriate mode for this bounded registration and qualification sequence.

## Compatibility and rollback

The explicit upgrade source and rollback target are both
`docs-2026-10-03-stable31`; adapter 0.6.1 retains the required stable31 transition
assets. Generation-2 schema versions and the seven dependency edges stay exact.
The managed runtime remains Node 24; its exact Node and pnpm bounds must agree
with the actual candidate package engines and complete resolved closure. It
retains Linux/macOS apply and Linux/macOS/Windows check/plan platforms. Consumer
Node 26 qualification remains
the consumer's existing separate gate. A rollback would retain its historical
contract but would reintroduce the incompatible old compiler execution path;
it is a recovery capability, not permission to execute an obsolete compiler.

The new record does not alter global recommendation, other consumers, governance
validators, source protections, package release policy or generation-3 adoption.
The E1 provider observation remains research evidence and cannot satisfy a
package-admission receipt. All claims below must be tied to completed checks;
preparation, local validation and queued work are not merge or CI success.

## Qualification status

Two independent reviews approved this bounded delivery plan, including the
separate rollout authority, exact changed-record verifier route and engine
qualification requirements. Candidate evidence collection remains in progress.
No lifecycle promotion, consumer admission or complete qualification is claimed
by this plan.

# Extension Foundation compiler-safe managed cohort

Status: preparation only; source-admission decision pending. The registry is
unchanged. The reviewed package-data candidate below cannot yet be adopted by
the current Extension Foundation source. No lifecycle promotion or rollout is
authorized by this document.

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

This was the initial conditional delivery sequence. Two independent reviews
approved its data and scope, then implementation-path inspection found the
source-admission prerequisite described below. Do not begin registry registration
or desired-policy rollout until that prerequisite and actual target coordinates
are resolved. The collected 3.1.0-family tuple is evidence of published bytes,
not a reservation for a future controller release.

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
qualification requirements. Actual candidate collection passed in
[run 45707904564, attempt 1](https://github.com/agent-teams-ai/extension-foundation/actions/runs/45707904564/attempts/1),
on collector source `55f08198bb1917a1dc8bca1fa88ec32e57bf3164`.
The five published coordinates have verified cryptographic attestations; the
canonical pnpm 11.20.0 runtime closure contains 88 packages. Fresh registry
attestation arrays match the complete verified bundles. Both actual mint
attempts completed successfully and require no reconciliation.

The existing Central schema, append-only lifecycle and complete governance
validator passed locally. Central trusted live qualification, lifecycle
promotion, consumer admission and merged-source checks remain pending.

## Confirmed source-admission prerequisite

The current EF source keeps `.node-version` at `26.11.1`. The installed adapter
0.3.2, published 0.6.1 and latest 0.6.2 separately require both an actual Node 24
managed process and a committed Node 24 host pin for profile3/Cohort2. The reader
rejects this source before staging. An isolated Node 24 executable or a newer
target package does not change that source check.

Two independent reviewers traced the normal upgrade, target activation and
restored-source paths. The old controller itself does not initialize Foundation
1.7.2 or TypeScript 5.9; its refusal is the source topology rule. The current
producer main remains `fac03920e50ebde038ae415edeb7aa9e3d610ada`.

The accepted authorities retain that boundary:

- [ADR-0031, decision 8](https://github.com/agent-teams-ai/engineering-foundation/blob/fac03920e50ebde038ae415edeb7aa9e3d610ada/docs/decisions/0031-managed-docs-consumer-integration.md)
  defines the historical Node 24 topology.
- [ADR-0037, decisions 1 and 4](https://github.com/agent-teams-ai/engineering-foundation/blob/fac03920e50ebde038ae415edeb7aa9e3d610ada/docs/decisions/0037-one-command-qualified-cohort-upgrades.md)
  retains that topology and requires the current source to pass its check.
- [ADR-0070](https://github.com/agent-teams-ai/engineering-foundation/blob/fac03920e50ebde038ae415edeb7aa9e3d610ada/docs/decisions/0070-bounded-managed-generation3-execution.md)
  adds a retained external 2-to-3 controller but preserves historical source
  admission and physical source Node 24. Selecting generation3 does not avoid
  the source gap.
- The [current Node compatibility guide](https://github.com/agent-teams-ai/engineering-foundation/blob/fac03920e50ebde038ae415edeb7aa9e3d610ada/docs/development/node-26-compatibility.md)
  distinguishes the Node 26 default from retained generation2 qualification and
  lists EF's cohort/profile/fixture migration as pending.

No existing flag, supported controller or central qualification route found in
those sources admits this unchanged consumer. Temporary pin edits, an older
source checkout, custom input readers, a regex relaxation and hand-authored
managed receipts are outside the accepted route. Restoring the old package set
also restores adapter 0.3.2 and its refusal, so a successor must cover restoration
as well as the first source read.

## Proposed owner choices

These are proposals, not accepted decisions. The owner must select the intended
runtime policy before a successor or consumer default change is implemented.

| Option | Intended result | Additional owner decision |
| --- | --- | --- |
| A: bounded external controller, retain generation2 | Preserve EF's Node 26 default; execute the managed operation under qualified Node 24 | Accept an explicit source-admission and restoration contract that separates the preserved host pin from the actual managed runtime |
| B: full generation3 adoption | Adopt the qualified generation3 managed runtime and retained controller | Resolve the same source/restoration gap, then explicitly enroll, qualify and adopt generation3 |
| C: permanent EF default Node 24 | Bring the real committed source within the existing generation2 topology | Accept a permanent consumer tooling-policy change and retain Node 26 as a separate complete execution |

Option A most closely preserves the existing EF tooling policy. It should use
the current consumer-integration and Repository Mutation owners, with a separately
installed published controller selected by exact version and integrity. The old
installed adapter cannot bootstrap it. Acceptance must require:

1. A closed source observation binds clean current HEAD/tree, repository identity,
   the installed stable31 tuple, managed assets and the exact preserved host pin.
   Observe physical Node 24 and the exact package manager independently.
2. Guard the `.node-version` bytes and mode through staging, publication,
   activation and recovery; do not make the host pin a managed write target.
3. Retain disposable preparation, fresh protected authority, exact postimages,
   leases, CAS, journal recovery, receipts and the sole existing mutation writer.
4. Refuse wrong runtimes, changed pins, dirty or stale source, foreign or partial
   managed images, stale authority and unsupported tuples before effects.
5. Prove real published-package forward activation, interruption/resume and
   restoration. A new restoration observation must be identified honestly; it
   cannot be reported as a successful execution of the unchanged old CLI.
6. Preserve historical reader refusals, decisions and receipt meanings. This
   route would not qualify managed Node 26 or adopt generation3.

Option B additionally requires the actual retained controller/kernel identities,
qualified generation3 cohort and policy, exact physical target runtime/pnpm,
target profile/state projections and committed-target rollback. Source tests or
package metadata alone do not activate a consumer. It is appropriate only if
managed generation3 is itself selected as the objective.

Option C must update the consumer's runtime assertions, FMS profile, documentation
and CI coherently. The canonical complete check must run physically on Node 24.
The current `node-26-check` alias depends on that canonical job running Node 26;
it must become a real separate Node 26 complete execution. A temporary source pin
rewrite is not this option, and changing the pin never authorizes executing the
old TypeScript compiler.

### Planning estimates

These ranges are estimates from the inspected reader, upgrade and restoration
paths, not measured diffs or delivery commitments. They exclude generated locks,
immutable evidence, documentation and elapsed review/registry/runner waits.
Engineer-days include implementation, integration and initial E2E debugging.

| Option | Tool implementation LOC | Test LOC | CI/helper LOC | Engineer-days | Confidence |
| --- | ---: | ---: | ---: | ---: | --- |
| A | 300-800 | 700-1,800 | 60-180 | 5-10 | Low; bootstrap and restoration determine scope |
| B | 250-800 | 800-2,000 | 100-250 | 7-14 | Low; controller reuse still needs actual adoption |
| C | 0-40 | 0-120 | 30-100 | 2-4 | Medium; configuration and existing-route integration |

A new producer release must use its actual coherent published package family.
No future version, SRI, source revision or cohort digest is invented here. The
current 3.1.0-family data candidate and 9-file consumer patch are retained only
as reviewed preparation. The exact source-preserving route and final coordinates
must be settled before either is applied.

## Retained preparation

`prepared-candidate.json` retains the observed package data, proposed immutable
record/event, exact canonical closure source, verified signatures and both
manual consumer-patch variants. It is inert evidence, not the active registry,
an admission receipt or executable instructions. The registry and policy files
remain byte-identical to their protected base. No consumer package, lockfile,
managed state, runtime pin or main branch was changed by this preparation.

# Successor qualification staging input

Status: non-authoritative, incomplete qualification input. No successor Cohort
ID, published source coordinate, eligibility, approval or passed qualification
is assigned. This checkpoint is separate from Token delivery.

## Exact inputs

| Input | Binding |
| --- | --- |
| Reviewed delivery candidate / staging base | `194bf51cbc46d870bb90470aa197ba987d7f5b64` |
| Backport delivery parent | `b1188de97885b3b6a93e9ed40a614e021c0c0c84` |
| Inner patch application base | `07d49409cb51f6124ad17673860b812a9d7b5f5b` |
| Inner patch | [`../successor.patch`](../successor.patch) |
| Inner patch SHA-256 | `3ac68e73d77ab0c5ee67b72581b711082399480792cb544044f6e91423f3cc7d` |
| Inner patch Git blob | `6a3ed1d207b58376bfb1ad4111f671c24e1f568d` |
| Retained `.github/workflows/docs-protocol-check.yml` Git blob | `efb9327218d89b6959ee38fa09b0e68f1ce5fe22` |
| Existing Docs package | `@agent-teams/docs-protocol@0.4.1` |
| Existing Foundation package | `@agent-teams/engineering-foundation@0.21.0` |

The task reports the backport review ACCEPT, 195 tests PASS and PR207 maincheck
SUCCESS. The copied diagnosis repeats ACCEPT and maincheck SUCCESS as supplied
status; this checkpoint did not query hosted checks or independently rerun those
195 tests. Those results do not qualify a successor source revision.

## Retained capture and diagnosis

Evidence is retained outside the repository under
`/var/data/agtmai-goal-20260905-01a07193/`:

- `stable10-runtime-closure-comparison.json`, SHA-256
  `12241977138fe90b949f201cbf7f26f475773ffa0fc72dfc9fac1db16188db0b`.
- `docs-closure-diagnosis-job/agtmai-docs-closure-diagnosis.latest-result.json`,
  SHA-256 `f1746959ee25016e0f51ebc1e77268c52122dc9c3d4af344c1fac061db49f4e5`.

The comparison is the authoritative capture for this diagnosis, not new
central qualification authority. Canonical sorted JSON plus a trailing newline
independently reproduces both projection digests:

| Projection | SHA-256 digest |
| --- | --- |
| Immutable stable10 | `33d07e21e60a169b86895dab7a1693b7ccf9ccbda6dc2797c9ea0a377b074ab4` |
| Captured actual | `c7454c52e2310e90d94981a4e6bcb902ef0051ed91183d15a8bbc2ff5406edb7` |

Only `fast-uri@3.1.6` becomes `fast-uri@3.1.7`: the package locator and SRI,
empty snapshot locator, and dependency edges from `ajv@8.18.0` and `ajv@8.20.0`
change. All other entries match. Both roots, their SRI values, settings,
package count 153, lockfile version 9.0 and pnpm 11.18.0 match. The full capture
retains the exact graph and integrities rather than inferring identity from count.

The existing resolver creates a fresh manifest and resolves transitives without
an authoritative seed lock. Exact roots do not prevent this drift. The captured
actual digest is an available qualification input, not a promise that a future
fresh resolution will match. Preserve stable10's immutable projection. The
resolver has no supported historical-lock replay input; neither lock rewriting
nor substitution of stored evidence satisfies its live check. This legacy v1
closure path uses pnpm 11.18.0; v2's pnpm 11.20.0 is not interchangeable.

## Reproduce source without authority mutation

No source branch was created: this runtime declares the repository `.git`
read-only, and applying the inner patch in the shared checkout would exceed the
owned paths. An archive application in `/tmp` succeeded. A successor commit SHA
is therefore unavailable; the delivery candidate above is not that SHA.

The following local-only commands can materialize a branch in a disposable clone
when a maintainer is ready to review candidate source. They use local objects,
perform no install, and do not update the source repository or any remote. Run
from this repository root with Bash; the new branch remains uncommitted so no
identity or immutable commit coordinate is invented.

```sh
set -euo pipefail
source_repo=$PWD
candidate_dir=$(mktemp -d /tmp/docs-legacy-source.XXXXXX)
git clone --no-hardlinks --no-checkout "$source_repo" "$candidate_dir"
git -C "$candidate_dir" remote remove origin
git -C "$candidate_dir" switch -c docs/legacy-successor-staging \
  07d49409cb51f6124ad17673860b812a9d7b5f5b
git -C "$source_repo" show \
  194bf51cbc46d870bb90470aa197ba987d7f5b64:compat/docs-legacy/successor.patch \
  > "$candidate_dir/../$(basename "$candidate_dir").patch"
inner_patch="$candidate_dir/../$(basename "$candidate_dir").patch"
printf '%s  %s\n' \
  3ac68e73d77ab0c5ee67b72581b711082399480792cb544044f6e91423f3cc7d \
  "$inner_patch" | sha256sum --check -
git -C "$candidate_dir" apply --check "$inner_patch"
git -C "$candidate_dir" apply "$inner_patch"
git -C "$candidate_dir" diff --check
git -C "$candidate_dir" diff --stat
git -C "$candidate_dir" hash-object .github/workflows/docs-protocol-check.yml
```

Expected: only two governance schemas, `scripts/docs-cohort-policy.mjs` and
`scripts/verify-docs-consumer-gate.mjs` differ in the disposable candidate; the
workflow blob equals the table above. These are the existing inner patch's
changes, not permission to change central authority in this staging checkout.

## Required evidence still missing

- [ ] Engineering Foundation verifies published Docs 0.4.1 / Foundation 0.21.0
  tarball SRI and provenance, exact asset catalog and caller template bytes.
  Package reuse remains unproven until those assets support this successor.
- [ ] Verify the published transition catalog bundles the required stable8
  upgrade origin, with exact immutable Cohort projection, skill and caller
  digests, canonical agent route and Docs scripts digests. Historical skill and
  caller files must exist at their content-addressed paths and hash correctly.
  The existing verifier requires no current source executors. Retain evidence
  of an executable upgrade and an owned recovery path; do not invent a bundle.
- [ ] If required assets are absent, prepare and verify a concrete producer draft before seeking version-specific
  publication approval. This checklist neither chooses a version nor authorizes it.
- [ ] After source review, bind the actual new immutable workflow commit/blob,
  rendered caller digest, schemas, package graph/SRI/provenance and a freshly
  verified content-addressed closure. Reconcile any further fresh-resolution
  drift explicitly; do not relabel the captured graph as newly verified.
- [ ] Obtain the owner-declared non-Token canary and its eligibility decision;
  obtain hosted central consumer CI, fresh trusted install and bound receipt
  evidence using the existing verifier. No canary coordinate is available here.
- [ ] In the later authorized qualification environment, verify the real new
  record with `pnpm governance:cohorts:verify -- --cohort <new-id>` (placeholder,
  not an assigned ID). Existing authority evolution, append-only, lifecycle,
  cooldown and admission gates remain mandatory. Required repository checks,
  including `pnpm check`, must pass on the supported toolchain before merge.

Local source inspection and assembling missing evidence are supported next
operations. Merge, remote publication, package release, authority/lifecycle
append or promotion require separate owner authorization and exact review.
Token adoption remains a separate consumer-owned decision after qualification.
This checkpoint grants none of those permissions and extends no support window.

## Checkpoint validation

Verified copied input bytes, both canonical closure digests, the complete
projection delta and exact inner-patch application to an archived base.
No dependency installation or live resolution was performed. This workspace has
no installed dependencies and Node 24.16.0, below its required 24.18.0; the
existing dependency-based tests and `pnpm check` were not run here. Documentation
staging is not a replacement for those source qualification checks.

## Stable10 materialization checkpoint (2026-09-09)

Existing PR207 head is `f87eb6a46e73fca4e6836049a06d1fd23f0d88b8`.
The accepted inner patch is unchanged. The owned `materialization-output/`
review artifact materializes the complete declared-base tree plus that patch;
`sourcehashes.json` binds every candidate file and `candidate-vs-eef92.diff`
compares the complete trees. Historical authority files in that archive are
source history, never replacement controller data. ROOT owns subsequent commits.

The only script correction derives all three fixture clocks from the maximum
`effective_at` in the complete input registry. Exact b4b90 produces
`2026-09-09T07:46:42Z`; no real qualification clock is changed. Both PR207 and
b4b90 fixture snapshots retain their complete authority and pass 9 outer/93
nested tests. The sealed audit's original 5/9 result remains evidence.

Published Docs 0.4.1 and Foundation 0.21.0 were inspected from retained tarballs
whose SHA-512 matches stable10's recorded SRI. This verifies local byte identity,
not fresh provenance. Docs' ten historical bundles include stable8 but omit
stable10; `currentSourceExecutors` is empty. The published `trustedPriorCohort`
requires exact prior assets and an allowed transition. A same-target positive
check is not evidence of an upgrade to a new workflow coordinate. Foundation's
known-file transaction supports exact-preimage replacement and exact-build
recovery; it does not supply missing Docs historical assets or eligibility.

Run the artifact-only inspection from the delivery root:

```sh
node materialization-output/check-next-inputs.mjs
```

It verifies all ten historical asset pairs, all stable10 package asset digests,
and exact stable10 caller rendering, then emits `NEXT-INPUTS.json` with an
explicit HOLD. Its successful exit means inspection passed, never qualification.
The next qualification owner must execute these steps in order:

1. Supply a producer-owned stable10 historical projection and content-addressed
   caller/skill bundle. Verify exact managed-state, caller, route and script
   bytes against `NEXT-INPUTS.json`, with passing stable10 controls before each
   missing/forged-origin rejection. Use the published parser, not a copied one.
2. Bind the reviewed actual successor workflow commit and blob, exact target
   assets and package SRI/provenance. Declare `upgrade_from` stable10. No target
   ID or version is assigned here; stable10's own `upgrade_from` stable8 and
   empty `rollback_to` do not authorize a successor or recovery.
3. Qualify an explicit supported recovery target and edge, including exact
   assets, current-authority parsing and hosted gate. Bare rollback to eef92
   repeats the incident. If none exists, retain HOLD and own qualified
   fix-forward. Never replace a build with an active Foundation journal.
4. Reconcile the retained fast-uri 3.1.6 to 3.1.7 closure drift through fresh
   qualification. Preserve stable10's immutable closure and the original
   capture/diagnosis identities above; this run did not resolve dependencies.
5. In ROOT's later authorized environment, execute clean-source `consumer check`,
   declared `consumer plan --to "$SUCCESSOR_COHORT_ID" --json`, executable
   upgrade/recovery qualification, and hosted central CANARY with exact receipt
   and immutable envelope. All coordinates must already be reviewed and bound;
   do not substitute these offline fixtures for those executions.
6. Run `pnpm governance:cohorts:verify -- --cohort "$SUCCESSOR_COHORT_ID"` only
   in that later qualification. Before proposing the final exact PR merge, run
   the focused scripts, full-history append-only/authority-evolution gates,
   `node tools/feature-module-standard/check.mjs`,
   `node --test tools/feature-module-standard/check.test.mjs`, and `pnpm check`
   on the supported toolchain. Inspect any historical source-suite mismatch;
   this bounded clock correction does not silently port unrelated tests/code.

Consumer PR69/71 adoption, admission, release, provider operations and registry
writes remain outside this checkpoint. Stable16 and Foundation PR281 are untouched.

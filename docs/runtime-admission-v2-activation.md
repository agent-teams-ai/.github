# Runtime admission v2 activation

This is a review-only execution contract, not evidence of activation. Do not
merge the source PR397 into integration PR389 or main. The source is published
separately. Historical PR390 payloads are incompatible with the current basis.

## Fixed identities and prerequisites

Target PR389 must remain open and ready, with head
`680192aed6f7c377bb639c637e0f29f09a2e20ec`, tree
`07bc1fee012e0068701f0810611938b3b0591eae`, base
`c8f3e7ba220241f79292c84c72712653019aa1df`, tree
`c3c61b8fd179a1cd203e6c893002a3fc127085e1`. The source binds its actual 40
commit identities and 47 changed file pairs. Any movement requires renewed
review; old tests must not be relabeled for a changed target.

The installed quality-v3 source remains
`c364ab2b82ad6250500110345982c3f1fa82181f`, locked by `25832759`.
Main ruleset `19979783` initially requires quality-v3. Identity rule `24363205`
and all unrelated rules stay unchanged throughout. There is no bypass step.

Use an existing authenticated human-owner `gh` session with repository
Administration(write), Node 26.11.1 and pnpm 11.18.0. Verify authenticated
User/777genius, id 13103045, repository id 1316243981, default main, non-fork,
and actual administration permission. Do not discover or export other credentials.
The GitHub App connector's content-write permission is not administration.

Let S be the final reviewed PR397 source head after source implementation,
review and full hosted checks. S, target H, main B, later merge M and installer
head are distinct identities. Record S and its tree from Git and the API; do not
use the plan commit or a locally assumed future SHA.

## Source publication and finite transition

1. Re-read every paginated ruleset summary and every complete rule body,
   current main, target PR/head/base and installed v3 ref/commit. Owner-full
   bodies must explicitly contain `bypass_actors: []` and
   `current_user_can_bypass: "never"`; absent fields are not proof. Retain the
   snapshots outside the checkout. Verify the new defining ref is absent.
2. Create one dedicated repository-owned active branch lock, no bypass actors,
   include only `refs/heads/governance/runtime-admission-source-successor-v2`,
   exclude none, with exactly update (fetch/merge false), deletion and
   non-fast-forward restrictions. Read back its full body and all existing
   rules unchanged. Only then publish that previously absent ref at S. Never
   unlock or update an activated source. No source ref is created by PR397 CI.
3. Observe the actual source push run on S/ref. Require qualify, source and
   publish from the same run/attempt, real source-owned frozen installation,
   strict checks, full tests and exact target admission. Record job IDs and the
   new context's actual GitHub Actions status on H. A read-only bootstrap run
   or fixture pass is not this qualification.
4. Exercise source-owned positive and protected-negative canary definitions on
   the exact qualification refs. Obtain real owner-opened canary PRs and retain
   their heads, base, source/workflow/run/attempt and decisive statuses. Never
   merge the negative canary. Keep all native checks and identity enforcement.
5. Generate main-only proposals with `planProtectionTransition` from exact S:
   phase `add` adds runtime-v2 alongside quality-v3. Read back full protections
   and prove the same negative head is blocked with runtime-v2 required. Only
   after positive evidence and negative required blocking may phase `retire`
   remove quality-v3, retaining runtime-v2 and all unrelated checks. Do not
   reinterpret an expected predecessor failure as a success.
6. Read exact-head required checks and perform the normal owner-guarded squash
   merge of PR389. Independently verify actual merged PR, commit identity,
   message, resulting tree and main CI. A queued merge is not completion.

For each ruleset write, derive the body solely from the freshly validated
proposal's writable fields: name, target, enforcement, bypass_actors, conditions
and rules. Do not serialize IDs, timestamps, source ownership, links or
current_user_can_bypass. Compare every pre-existing rule before and after each
write; the API has no transaction or compare-and-swap. Stop on any drift.

## Permanent caller installation without a deadlock

The finite source push targeted PR389; it cannot certify another PR after that
merge. The permanent caller does not yet exist in main at this point.

Use `restore` to add quality-v3 alongside runtime-v2; read back. Then use
`install` to remove the temporary runtime-v2 requirement, retaining quality-v3.
This inverse bridge never leaves main without a source requirement. It allows
the unchanged quality-v3 ordinary route to admit the separate installer PR.

On actual merged M, add only the canonical runtime-v2 caller, ADR-0016 and dated
installation evidence, generated/checked by `callerWorkflowDefinition(S)` and
`assertCallerWorkflow(bytes, S)`. No source implementation, dependency graph or
review packet is copied into main. Require the actual v3 ordinary acceptance,
identity and all unrelated checks, then normal owner-guarded merge.

With the caller installed, repeat actual ordinary positive and protected-negative
PR canaries through the installed caller and immutable S. Use `add`, prove the
same negative head is blocked by the now-required runtime-v2 failure, and only
then use `retire` for permanent runtime-v2 enforcement. Record final main CI and
full owner readback; close canaries without merging the negative, and close
superseded PRs only after the final acceptance facts exist.

## Failure handling and evidence

Stop dependent writes on drift, transport ambiguity or failed verification.
Retain/re-add the previous requirement before removing a new one. Rollback of
installed files is a separate reviewed PR. Do not forge statuses, disable
checks, enable Actions PR approval, rewrite frozen sources or treat missing
private bypass information as an empty list.

Local fixture tests prove the proposal sequence and rejecting boundaries only.
Hosted bootstrap proves source setup/tests only. Source admission, required
blocking, guarded merge and installed-main proof each need their own real
coordinates. This document does not claim those later observations.

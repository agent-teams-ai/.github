# Owner identity source successor v1: operator activation

Status: prepared procedure; no hosted execution or protection installation is asserted.

This owner-admin handoff applies only to PR380 and the exact tuple in
[ADR-0013](decisions/0013-bounded-owner-identity-source-successor-v1.md).
Keep the installed predecessors required if any step cannot be proved.
PR381 and consumer pin upgrades require later independent review.

## Review and freeze the defining source

Review the entire source commit `S`, its complete tree `T`, and its diff from
`1989e195acddceb4af0dc2e167b51fb6771d9a65`. Record actual 40-character values
after review. The defining workflow is
`.github/workflows/owner-identity-source-successor-v1.yml`; its sole published
context is `owner-identity-source-successor-v1`. A moving branch pin or target
PR SHA cannot substitute for the separately reviewed source identity.

The workflow checks out `job.workflow_sha`, installs only that source's frozen
lock, then runs the dedicated strict compiler project, lint and regressions.
PR content is inert Git tree/blob data. There are no workflow inputs, inherited
secrets, configurable commands, PR checkouts or predecessor status writes.

Before first publication, an owner-admin must create a dedicated
repository-owned active branch ruleset matching exactly
`refs/heads/governance/owner-identity-source-successor-v1`, with no exclusions,
empty bypass actors, and exactly `update`, `deletion`, `non_fast_forward` rules.
The update rule must forbid fetch-and-merge updates; GitHub's bare `update`
rule and `update_allows_fetch_and_merge: false` are both checked. Preserve the
old v2 ref at `d2904ef5181b1a3f42da2b6fad7e5f7fccad1ecd` and its lock `25469495`.

Read complete objects with owner-admin visibility. Absent private bypass fields
are not evidence of empty bypass actors. Confirm explicit `bypass_actors: []`
and `current_user_can_bypass: never` separately from the hosted public reads.
Publish `S` once as the new source branch and retain the creation/readback,
source commit/tree, lock ID, full ruleset and time. Never unlock or move it to
repair a partial publication; review a new source version/ref/context instead.

Its genuine push run qualifies PR380 without installing a caller on main.
Before trusting that run, independently confirm the current tuple:

| Coordinate | Required value |
| --- | --- |
| Repository ID | `1316243981` |
| Pull number / ID | `380` / `4975429125` |
| Base | `86a85d6beda07e6e5ee7806646f700bc4e4db173` |
| Base tree | `bf99606849d7c894c4c8d49426599793fc36d407` |
| Published head | `1f8dc7a2ee33e3cc3810f0c4c2d5e9f3f20241d0` |
| Head tree | `3ff66e7c29253efd950e513e6e01fe148fc52632` |
| Commits / changed files | `1` / `8` |
| PR author; commit author and committer | actual `User/777genius`, ID `13103045` |

The exact eight-path before/after regular blobs are `TARGET_TUPLE`. The checker
reconstructs every directory tree and compares the complete diff. An advanced
base, new head, another PR, extra file or changed protected input is not this
exception. Preserve the actual Cyrillic author metadata.

## Genuine positive and negative canaries

Installing a main caller first would invalidate PR380's base. Bootstrap uses
two same-repository branches, both from unchanged actual main:

- `qualification/owner-identity-positive-v1`
- `qualification/owner-identity-negative-v1`

Generate the canonical inputless caller from the reviewed source checkout.
This prints a proposal and performs no remote operation:

```sh
SOURCE_SHA="the-reviewed-40-character-S" node --input-type=module <<'NODE'
import { stringify } from 'yaml';
import { canaryWorkflowDefinition } from './scripts/owner-identity-source-successor-v1.ts';
console.log(stringify(canaryWorkflowDefinition(process.env.SOURCE_SHA)));
NODE
```

Add its exact bytes at `.github/workflows/owner-identity-source-canary.yml` on
both branches. The positive adds an ordinary documentation change. The negative
adds a deliberate reviewed **unmerged** modification, such as whitespace, to
`governance/commit-author-identity.json`. Keep its caller canonical: changing
the caller would test a different rejection. Use actual owner author and
committer account associations. Open non-draft PRs against main. If a branch
push ran before its PR existed, that run must fail closed; push an empty
owner-associated commit after opening the PR to obtain a genuine current-head
push run.

The callee derives exactly one open same-repository PR from the genuine push
head/ref, verifies canonical caller bytes, immutable source reference, source
locks, complete Git trees, commit pages and same-head Bot conflicts. It never
executes qualification-branch code. A manually posted status, workflow dispatch
input, local fixture rejection or arbitrary branch is not hosted qualification.

Retain actual source/caller refs and SHAs, PR IDs, base/head/tree, workflow path,
run ID/attempt, decisive job IDs and step conclusions, status/check records,
Actions App ID, timestamps and full protection observations. Verify:

1. PR380's source-push run genuinely succeeds, including `qualify`, `source`
   and publisher. Its new status links to that exact run/attempt on its head.
2. The positive canary has independently observed current-head success with
   the same actual source provenance.
3. The negative has a successful qualification job, a genuinely failed
   **Verify actual protected source semantics** step, and a failed new status
   on its own actual head. A setup failure or skipped source step does not
   qualify. The publisher fails after observing the unsuccessful source job.

Hosted coordinates are unknown during preparation. Record real observations
separately; never fill examples with guessed successful runs.

Bootstrap is a run-bound observation, not continuous PR-event enforcement.
Rerun the genuine source workflow attempt immediately before the bounded merge
and independently reread all open same-head PR actors. Any drift stops the
transition. Permanent enforcement is claimed only after the installed-main
caller and its own hosted canaries have been observed.

## Add before removing either predecessor

Read full current main `19979783`, identity `24363205`, old source `25469495`
and new source rulesets with owner-admin visibility. Save snapshots outside the
immutable source tree. Reject unexpected drift. Main currently requires these
contexts, each from Actions integration `15368`:

- `check`
- `trusted-admission-authority-evolution-v1`
- `trusted-admission-evidence`
- `trusted-validation`
- `docs-quality-source-successor-v2`

Identity requires `commit-author-identity` from `15368`. Both are active,
strict, enforced on creation, scoped only to the default branch, without bypass
actors. Preserve main's exact PR rules, squash-only merge policy, linear
history, deletion and force-push restrictions.

The pure proposal generator accepts actual owner-full readbacks saved as
`main-ruleset.json` and `identity-ruleset.json`:

```sh
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
import { planProtectionTransition } from './scripts/owner-identity-source-successor-v1.ts';
const main = JSON.parse(await readFile('main-ruleset.json', 'utf8'));
const identity = JSON.parse(await readFile('identity-ruleset.json', 'utf8'));
console.log(JSON.stringify(planProtectionTransition(main, identity, 'add'), null, 2));
NODE
```

It preserves complete observed objects and adds only the successor context.
It does not submit requests or certify hosted canaries. An authorized owner
reviews and applies each additive update using the API's writable fields
(`name`, `target`, `enforcement`, `bypass_actors`, `conditions`, `rules`), retaining
their exact proposal values and omitting response-only IDs/URLs/source fields.
Save complete readbacks. Only after **both** include predecessor plus successor,
prove that the same failed negative head is required and blocked, and that the
exact PR380 head has genuine fresh source and native checks.

Then render `phase: 'retire'` from those newly read complete objects. The
generator refuses retirement without both existing bridge contexts. Remove
only `docs-quality-source-successor-v2` from main and `commit-author-identity`
from identity. Read back each object, retain successor in both, compare all
unrelated fields and reconfirm the same negative head remains blocked. Never
disable protection, change strictness/App/scope, add bypass actors, forge
predecessor success or use administrator merge bypass.

## Bounded merge and permanent caller

Merge exact PR380 through the fresh owner guard with reviewed head, full
message/body and explicit squash identity. Independently reconcile actual
final PR/commit account association, exact full message and main result.
Never rewrite source history or retry an uncertain merge.

The source push is a bootstrap. Until a main caller is installed, ordinary PRs
have no automatic successor status. First add **both predecessor contexts back
while retaining successor**, save full readbacks, then remove only the
temporary successor requirements. The restored native identity now supports
account associations. Frozen v2 accepts a normal three-additive-file caller
installation without modifying its protected inputs:

1. `.github/workflows/owner-identity-source-successor-v1-caller.yml`, generated
   by `callerWorkflowDefinition(S)` and pinned to `S`;
2. this source's exact ADR-0013;
3. `governance/evidence/commit-identity/owner-identity-source-successor-v1-installation.md`,
   containing truthful source qualification and bootstrap cutover coordinates.

Install through a normal PR with genuine current native checks. Do not add
source scripts or change the compiler/profile as an installation exception;
the runtime stays on its immutable branch. Qualify genuine positive and
protected-input negative PRs through the installed `pull_request_target`
caller. Verify its base-owned canonical bytes and referenced immutable source,
then repeat the additive-before-retirement transition above. Record permanent
enforcement separately. Retain negative evidence and close canaries unmerged.

## Pending capabilities and stop conditions

Local behavior, strict compilation, unchanged frozen inputs and exact Git
binding can be qualified during preparation. Hosted execution and required
check installation cannot. This session has no ruleset-write connector or
authenticated admin browser. Publication, hosted observations and owner-admin
operations remain pending. No sign-in workaround or weakened protection is
part of this procedure.

If main or PR380 moves before its bounded merge, stop with predecessors intact.
Review a new source version bound to the new exact tuple. After PR380,
independently rebase/review/requalify PR381; this source does not admit its
protected compiler/profile changes.

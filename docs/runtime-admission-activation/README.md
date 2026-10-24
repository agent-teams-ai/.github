# Runtime admission successor: owner activation companion

**Review material only. Do not merge this companion PR into the integration
branch or `main`.** The source publication and the later three-file caller
installation are separate changes. No owner-admin write, source-ref activation,
hosted successor qualification, ruleset cutover, integration merge, or permanent
installation is claimed by this document.

This companion is based on the actual [PR389](https://github.com/agent-teams-ai/.github/pull/389)
head H, `ec790f9e12c29c32c7dad1ad683a7d56476cacd3`, tree
`3d2e31d0c769f12d7132819192d4409143fe96f2`, and base
`e0f271740c13290b6bb729ffb79cb050253fc6b8`. It binds the separately
reviewed source S through [source-publication.json](evidence/source-publication.json).
The exact reviewed defining source is
[`d8f22cb27db9f348f30bbdfdea67d09faac8e3ab`](https://github.com/agent-teams-ai/.github/commit/d8f22cb27db9f348f30bbdfdea67d09faac8e3ab),
tree `18792ee5938138a430ce6f8bcc2d33f50471528a`, published only on
`review/runtime-admission-source-successor-v1` with parent S1
`fb87ba13102d2b7ab1db8c453c55d6eded6407ee`. S1 has parent H.
The defining governance ref has never been created. This unlocked review-branch
refresh does not move or repair an activated immutable source.
The admission runtime R is `a33b2c4a43b6ef0d1fb6457c534575a82e80493e`;
R, H, S, the companion documentation commit D, and a future squash merge are
separate identities. Any H/base/tree/target-file movement stops this finite route.

## Bounded source refresh before activation

S2 fixes a bootstrap configuration-path ambiguity found in S1: a relative
`XDG_CONFIG_HOME` could resolve the global pnpm configuration path differently
in root and child working directories. S2 requires that computed path to be
absolute before `lstat` or any package-manager process starts. The rejection is
`Bootstrap global pnpm configuration path must be absolute`. Focused negative
controls use `../.config` and `relative-config` through both preflight and
bootstrap, before the pnpm sentinel can execute; empty XDG keeps the HOME fallback.
S2's six focused tests, strict TypeScript and lint passed and independent review
approved the bounded correction. Actual hosted S2 bootstrap/full/source evidence
is pending. S1's separate local full run passed 5779 current + 9 frozen tests
with a clean checkout; that result is bound only to S1, not relabeled as an S2
full run. Its exact local commit/tree and log SHA256
`dfdf0e6bd54b11dbdde7f4252d039661148108e71100bbb183df94d1a40cc038`
are retained in [source-publication.json](evidence/source-publication.json).
No main/identity snapshot or finite H binding changed.

## What is already observed

The [dated baseline](evidence/observation.json) was independently read on
2026-10-24 at 16:21 UTC. Its paginated ruleset census contains seven repository
rulesets and an empty second page, including the unchanged main 19979783,
identity 24363205, predecessor-source 25469495 and owner-alias-source 25775630
rulesets. The new defining governance ref returned 404. These are observations,
not continuous protection evidence; the owner must read them again below.
The original supplied main/identity snapshot is retained alongside all seven
full ruleset bodies. Both snapshots agreed exactly when the plans were rendered.

| Evidence | Actual result and scope |
| --- | --- |
| [H: Node 26 hosted CI](https://github.com/agent-teams-ai/.github/actions/runs/40109802521/job/120918950134) | 5725 current + 9 frozen tests; zero failures, skips or cancellations; actual managed Node 24 RE2 loaded |
| [H: Node 24 hosted CI](https://github.com/agent-teams-ai/.github/actions/runs/40109802586/job/120918950310) | Same passing counts and actual RE2 load |
| Independent local full Node 26, equivalent tree at 457820e | Passed 5725 + 9; clean head/tree after |
| Independent local full Node 24, same 457820e/tree | Failed 2 of 5725 current tests; frozen 9 passed. Two owner-merge fixture children returned null status against expected 1 under unchanged 10-second deadlines. The original helper did not retain the spawn error/signal, so the exact cause is unconfirmed. |
| Isolated unchanged localNode 24 diagnostics | Both failing tests subsequently passed 2/2 with unchanged deadlines and source; this is not a successful complete local run. |

The [runtime evidence](evidence/runtime-results.json) records exact heads, counts,
links and local log hashes. Runtime CI success does not grant source admission.
Several frozen source-authority routes correctly reject H; do not manufacture a
legacy green status to admit its protected 49-file transition.

### Bootstrap-only hosted probe: separate pending observation

Reserve actual D/S, workflow/run/attempt/job IDs, environment, decisive step
conclusions and logs for the read-only Ubuntu bootstrap probe. At preparation,
no successful probe is claimed here. The probe may establish that the actual S
bootstrap, frozen root/child installs, managed Node 24 native rebuild and dedicated
controls execute under the selected Actions setup order. It has no status-write
or admin authority. Even a passing probe does not establish a locked source,
source/live-target qualification, required-check enforcement or installed-main
protection. Retain its observation separately from the later defining-ref run.

## Execution contract

Run the following commands only as the authorized human owner using an existing
GitHub CLI authentication. Required tools are Bash, `gh`, `jq`, Git and the pinned
Node 26.11.1. No credential discovery or login automation is part of this runbook.
API calls use the same 2022-11-28 contract as S. Repository Administration(write)
is needed for rulesets; ordinary repository write access is insufficient.

Use a checkout of the reviewed companion D. Make an exact detached S worktree
for the pure generator; do not qualify D as though it were S. Keep operator
readbacks outside the checkout and retain them for the eventual evidence record.

```bash
set -euo pipefail
export GH_PROMPT_DISABLED=1
export ACTIVATION_DIR="$PWD/docs/runtime-admission-activation"
export ACTIVATION_STATE="$(mktemp -d)"
export SOURCE_SHA="$(jq -er '.source.sha' "$ACTIVATION_DIR/evidence/source-publication.json")"
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
export ACTIVATION_SOURCE="$ACTIVATION_STATE/source"
git fetch --no-tags origin "$SOURCE_SHA"
git worktree add --detach "$ACTIVATION_SOURCE" "$SOURCE_SHA"
api() {
  gh api --hostname github.com \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' "$@"
}
api user > "$ACTIVATION_STATE/operator.json"
jq -e '.type == "User" and .login == "777genius" and .id == 13103045' \
  "$ACTIVATION_STATE/operator.json"
api repos/agent-teams-ai/.github > "$ACTIVATION_STATE/repository.json"
jq -e '.id == 1316243981 and .full_name == "agent-teams-ai/.github" and
  .default_branch == "main" and .fork == false and .permissions.admin == true' \
  "$ACTIVATION_STATE/repository.json"
api "repos/agent-teams-ai/.github/git/commits/$SOURCE_SHA" > "$ACTIVATION_STATE/source-commit.json"
jq -e --slurpfile expected "$ACTIVATION_DIR/evidence/source-publication.json" \
  '.sha == $expected[0].source.sha and .tree.sha == $expected[0].source.tree and
   [.parents[].sha] == [$expected[0].source.parent]' "$ACTIVATION_STATE/source-commit.json"
test "$(git -C "$ACTIVATION_SOURCE" rev-parse 'HEAD^{tree}')" = \
  "$(jq -er '.source.tree' "$ACTIVATION_DIR/evidence/source-publication.json")"
```

`current_user_can_bypass` is a read-only field about the identity making that
particular request. A connector's `never` observation does not establish the
fresh operator's result and does not mean an administrator cannot edit a ruleset.
Every fresh full owner readback must explicitly contain `bypass_actors: []` and
`current_user_can_bypass: "never"`; missing fields are not empty-list evidence.
Do not serialize that field, IDs, ownership, timestamps or links into write bodies.

### Reusable complete readback

This function reads every page and then every returned ruleset detail. It does
not replace detail bodies with list summaries. It also captures the actual main
head, H's PR and status objects. Reread immediately before and after each write;
there is no API transaction or compare-and-swap for these ruleset updates.

```bash
read_protections() {
  local phase="$1" id
  mkdir -p "$ACTIVATION_STATE/$phase/rulesets"
  api --paginate --slurp \
    'repos/agent-teams-ai/.github/rulesets?includes_parents=true&per_page=100' \
    > "$ACTIVATION_STATE/$phase/pages.json"
  jq -e '[.[][] | .id] | length == (unique | length)' \
    "$ACTIVATION_STATE/$phase/pages.json"
  while IFS= read -r id; do
    api "repos/agent-teams-ai/.github/rulesets/$id" \
      > "$ACTIVATION_STATE/$phase/rulesets/$id.json"
  done < <(jq -r '.[][] | .id' "$ACTIVATION_STATE/$phase/pages.json")
  jq -s 'map({key:(.id|tostring),value:.}) | from_entries' \
    "$ACTIVATION_STATE/$phase/rulesets/"*.json > "$ACTIVATION_STATE/$phase/all.json"
  api repos/agent-teams-ai/.github/git/ref/heads/main > "$ACTIVATION_STATE/$phase/main-ref.json"
  api repos/agent-teams-ai/.github/pulls/389 > "$ACTIVATION_STATE/$phase/pull389.json"
  api repos/agent-teams-ai/.github/commits/ec790f9e12c29c32c7dad1ad683a7d56476cacd3/status \
    > "$ACTIVATION_STATE/$phase/head-status.json"
}
```

For each named readback below, use this exact comparison with `PHASE` set to
`baseline`, `add` or `retire`, `READBACK` to that directory name, and `LOCKED` to
`no` before Admin A or `yes` after its full readback. It checks every preexisting
ruleset, all non-time metadata and policy fields, strict/App/PR parameters,
identity unchanged, complete census, and S's exact dedicated-source-lock contract.
The lock's explicit false update parameter may normalize to a bare update rule,
as S explicitly allows; no other normalization is permitted.

```bash
compare_protections() {
PHASE="$1" READBACK="$2" LOCKED="$3" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const dir = process.env.ACTIVATION_DIR, state = process.env.ACTIVATION_STATE;
const { assertMainProtection, assertPreviousSourceProtection, assertStagingProtection } =
  await import(pathToFileURL(resolve(process.env.ACTIVATION_SOURCE,
    'scripts/runtime-admission-source-successor-v1.ts')).href);
const baseline = await read(`${dir}/evidence/rulesets-full.json`);
const actual = await read(`${state}/${process.env.READBACK}/all.json`);
const phase = process.env.PHASE;
assert.ok(['baseline', 'add', 'retire'].includes(phase));
const proposal = phase === 'baseline' ? undefined :
  await read(`${dir}/evidence/b-${phase}-expected-full.json`);
const withoutTimes = ({ created_at, updated_at, ...value }) => value;
for (const [id, original] of Object.entries(baseline)) {
  const expected = id === '19979783' && proposal ? proposal.main : original;
  assert.deepEqual(withoutTimes(actual[id]), withoutTimes(expected), `Ruleset ${id} drift`);
}
assertMainProtection(actual['19979783'], actual['24363205'], 'owner_full');
assertPreviousSourceProtection(Object.values(actual), 'owner_full');
const extra = Object.keys(actual).filter(id => !Object.hasOwn(baseline, id));
if (process.env.LOCKED === 'yes') {
  assert.equal(extra.length, 1);
  assert.equal(String(assertStagingProtection(Object.values(actual), 'owner_full')), extra[0]);
  assert.equal(actual[extra[0]].name, 'Immutable runtime and admission source successor v1');
} else {
  assert.equal(process.env.LOCKED, 'no'); assert.deepEqual(extra, []);
}
console.log('Complete expected-state readback accepted; identity and other rulesets preserved.');
NODE
}
read_protections before
compare_protections baseline before no
```

The initial readback and comparison must pass before continuing. Also check
that H remains open, non-draft, unmerged, base e0f2717 and head ec790f9 with its
reviewed 39 commits / 49 changed files. S independently rechecks the finite tuple
before granting success. If the source ref is already present, do not force,
update or recreate it; stop and inspect its exact lock, SHA and run history.
Confirm a genuine 404, not an authentication/network failure:

```bash
if api --include repos/agent-teams-ai/.github/git/ref/heads/governance/runtime-admission-source-successor-v1 \
  > "$ACTIVATION_STATE/ref-before.http" 2> "$ACTIVATION_STATE/ref-before.stderr"; then
  echo 'Source ref already exists; stop and reconcile.' >&2; exit 1
fi
head -n 1 "$ACTIVATION_STATE/ref-before.http" | grep -Eq '^HTTP/[^ ]+ 404([[:space:]]|$)'
```

## Admin A: lock first, defining ref second

The exact [lock body](api/a-create-source-lock.json) permits creation but forbids
updates, deletion and non-fast-forward movement of only the defining ref, with
no bypass. It does not touch main, identity, frozen v2 or owner-alias protection.

```bash
api --method POST repos/agent-teams-ai/.github/rulesets \
  --input "$ACTIVATION_DIR/api/a-create-source-lock.json" > "$ACTIVATION_STATE/lock-created.json"
read_protections locked
compare_protections baseline locked yes
```

**Stop until that complete readback passes.** Then recheck the source ref still
returns 404, the review-published S object/tree/parent still match, and H/base are
unchanged. Only now create the defining governance ref once:

```bash
api --method POST repos/agent-teams-ai/.github/git/refs \
  --input "$ACTIVATION_DIR/api/a-create-source-ref.json" > "$ACTIVATION_STATE/source-ref-created.json"
api repos/agent-teams-ai/.github/git/ref/heads/governance/runtime-admission-source-successor-v1 \
  > "$ACTIVATION_STATE/source-ref-readback.json"
jq -e --arg sha "$SOURCE_SHA" \
  '.ref == "refs/heads/governance/runtime-admission-source-successor-v1" and
   .object.type == "commit" and .object.sha == $sha' "$ACTIVATION_STATE/source-ref-readback.json"
read_protections activated
compare_protections baseline activated yes
```

Require the genuine owner-originated source-push workflow at S, not a manually
posted status, workflow_dispatch substitute or the bootstrap-only probe. Read
its actual run/attempt and every decisive job/step. `qualify`, `source`, and
`publish` must succeed; retain the actual H status, creator, target URL, current
run provenance and required App 15368 binding. A failed setup/full test is not
successful protected-semantics qualification. Never move/unlock S to fix a
failure; retain the failure and review a new source identity.

## Hosted accepting and rejecting controls: stop before cutover

Create reviewed owner-authored, non-draft canary PRs from actual main on exactly
`qualification/runtime-admission-positive-v1` and
`qualification/runtime-admission-negative-v1`. Generate the inputless S-pinned
`.github/workflows/runtime-admission-source-canary.yml` with S's exported
`canaryWorkflowDefinition(S)`; [the rendered generator output](api/canary-workflow-definition.json)
is valid YAML as JSON. Preserve its content and owner commit associations.

The positive changes ordinary documentation while preserving installer controls.
For the rejecting control, append a harmless comment to the existing newly
critical bridge `scripts/observe-org-repository-inventory.mjs`; preserve its
runtime behavior so the new source's protected-input rejection is the decisive
failure. Do not add a missing compiler-floor file on the old baseline or substitute
an unrelated broken CI fixture. If branch creation/push precedes opening its PR,
make a new genuine owner push after the PR exists. The real live-PR resolver
fails closed when no PR exists. Do not use a rerun as a fabricated push event.

Retain both PR/head/base/tree snapshots, actual source SHA, run/attempt/job/step
IDs, decisive error, status state/creator/URL and complete ruleset readbacks.
Both controls need a successful actual `qualify` job. Positive semantics succeeds;
negative semantics rejects the protected input and its publisher reports failure.
A precondition, install or unrelated test failure does not satisfy the negative.
Do not say the new context is the sole reason a PR cannot merge when other
required checks also fail; record the actual required/failing context and
observed merge state separately.

### Exact S planner regeneration

The following function takes the phase (`add` or `retire`) and fresh pre-write
readback directory. It performs no network/admin write and compares the complete proposal
against the reviewed file. For retirement its input must be the actual additive
readback, not the original baseline.

```bash
plan_main() {
PLAN_PHASE="$1" READBACK="$2" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const { planProtectionTransition } = await import(pathToFileURL(resolve(
  process.env.ACTIVATION_SOURCE, 'scripts/runtime-admission-source-successor-v1.ts')).href);
const raw = await read(`${process.env.ACTIVATION_STATE}/${process.env.READBACK}/all.json`);
const phase = process.env.PLAN_PHASE;
assert.ok(['add', 'retire'].includes(phase));
const proposal = planProtectionTransition(raw['19979783'], raw['24363205'], phase);
assert.deepEqual(proposal.identity, raw['24363205']);
const writable = ({ name, target, enforcement, conditions, rules, bypass_actors }) =>
  ({ name, target, enforcement, conditions, rules, bypass_actors });
const expected = await read(`${process.env.ACTIVATION_DIR}/api/b-main-${phase}.json`);
assert.deepEqual(writable(proposal.main), expected);
await writeFile(`${process.env.ACTIVATION_STATE}/generated-${phase}.json`,
  JSON.stringify(writable(proposal.main), null, 2) + '\n');
console.log('Exact S-generated main-only payload matches the reviewed proposal.');
NODE
}
```


## Admin B: main-only additive cutover, then bounded merge

The [add](api/b-main-add.json) and [retire](api/b-main-retire.json) proposals were
rendered by S's `planProtectionTransition`, not by a new policy implementation.
[Full expected add](evidence/b-add-expected-full.json) and
[retire](evidence/b-retire-expected-full.json) objects retain the entire unchanged
identity object. Only main 19979783 is ever written; never PUT identity 24363205.
Top-level write fields are name, target, enforcement, conditions, rules and
bypass_actors. All nested live PR parameters are retained, including
`require_extra_approval_for_unattributed_changes: true`; the current public REST
parameter list omits that observed field. Endpoint acceptance remains unproven
until execution; any rejection or divergent readback stops the transition.

Immediately before each write, collect fresh full protections and compare the
expected predecessor phase. Regenerate the proposal from that fresh readback
using the detached S helper, then compare its writable fields to the reviewed
payload; the pure `plan_main` function above performs this comparison. No stale file is an
instruction to overwrite intervening policy changes.

```bash
# After actual hosted positive/negative qualification:
read_protections before-add
compare_protections baseline before-add yes
plan_main add before-add
api --method PUT repos/agent-teams-ai/.github/rulesets/19979783 \
  --input "$ACTIVATION_DIR/api/b-main-add.json" > "$ACTIVATION_STATE/main-add-response.json"
read_protections added
compare_protections add added yes
```

While both predecessor and successor remain required, read back that the same
negative head has the failing new context. Exact H must have genuine current
successes for every retained context (`check`,
`trusted-admission-authority-evolution-v1`, `trusted-admission-evidence`,
`trusted-validation`), separate `commit-author-identity`, and the new
`runtime-admission-source-successor-v1` context. The replaced
`docs-quality-source-successor-v2` is expected to reject H's reviewed
`quality-process.test.ts` change; its genuine failure does not prevent retiring
that replaced context after the bounded successor qualification. Preserve that
failure as evidence; never forge a predecessor success. Predecessor positive
proof belongs to its appropriate ordinary canary and the actual post-H
installation route. Record required-check/App binding and actual blocked/merge
state separately; new-source status success alone does not satisfy retained
checks. Only after that bridge proof and a fresh expected-add readback:

```bash
read_protections before-retire
compare_protections add before-retire yes
plan_main retire before-retire
api --method PUT repos/agent-teams-ai/.github/rulesets/19979783 \
  --input "$ACTIVATION_DIR/api/b-main-retire.json" > "$ACTIVATION_STATE/main-retire-response.json"
read_protections retired
compare_protections retire retired yes
```

Retire only `docs-quality-source-successor-v2`. Keep check, authority evolution,
evidence, trusted validation and separate identity continuously required, all
from App 15368, with strictness, creation enforcement, PR rules and bypass policy
unchanged. Merge only exact PR389/H through the repository's fresh owner squash
guard with a reviewed subject and UTF-8 body file. Do not use `--admin`, bypass,
force pushes or hand-written success statuses. Independently read the actual
merged PR, resulting commit/tree, owner associations, raw metadata and message;
an uncertain merge response requires reconciliation before any retry.

## Admin C: interruption, rollback and permanent installation

| Point reached | Safe continuation or recovery condition |
| --- | --- |
| Before defining-ref creation | Leave current main/identity untouched. A failed or interrupted lock request must be reconciled by complete readback before any retry. Do not create a second matching lock. |
| After defining-ref creation, before Admin B | Leave S and its lock immutable. Existing required checks remain in force. Failed qualification requires a separately reviewed source, not a moved ref or invented green. |
| Additive bridge installed | Both source contexts remain required until bridge evidence is complete. Return to predecessor-only with [the exact baseline body](api/c-main-restore-predecessor.json) only after the predecessor genuinely qualifies the actual intended baseline/PR; preserve identity and verify full readbacks. If it cannot qualify, keep the bridge and investigate. |
| Successor-only installed | [Return-to-bridge body](api/c-main-return-to-bridge.json) adds predecessor while retaining successor. Require the exact expected retired readback before this write and an exact add-state readback afterward. Prove the predecessor's actual current positive/negative behavior before ever removing successor. |
| H merged, caller absent | Source-push bootstrap success does not provide continuous PR-event enforcement. Add predecessor back before considering temporary bootstrap retirement. Prove its actual post-integration ordinary route and proposed installation are admissible. If that route fails, retain the current source requirement and review a new run-bound installation route; no unprotected interval. |
| Permanent caller installed | Retain predecessor callers/evidence unchanged. Prove actual installed-main positive and critical-negative runs, add successor while predecessor remains, prove required rejection, then retire only predecessor with complete fresh readbacks. |

The eventual installation PR contains exactly three additive regular files:

1. `.github/workflows/runtime-admission-source-successor-v1-caller.yml`, rendered
   by S's `callerWorkflowDefinition(S)`; [canonical JSON/YAML](api/caller-workflow-definition.json).
2. `docs/decisions/0015-bounded-runtime-admission-source-successor-v1.md`, with
   actual owner approval and scoped status.
3. `governance/evidence/docs-source-successor/runtime-admission-source-successor-v1-installation.md`,
   containing actual immutable installation observations.

Do not merge the source/companion branch as a substitute for that installation.
Frozen v1/v2 authorities, source refs, locks and old installation evidence stay
unchanged. After installation, exercise ordinary documentation and protected
bridge negative controls on actual protected main. A root-dependency canary must
use a separately reviewed actual candidate with the exact six-package verifier
closure and real frozen installation graph; do not invent a package/version to
claim a hosted dependency-route positive. Nested Renovate controls remain
protected transitions. Record root-dependency behavior and any pending hosted
qualification candidly. Keep subsequent live observations separate from the
immutable installation snapshot.

## References and payload limitations

The reviewed defining helper/workflow and its source activation guide own
semantics. The companion contains proposals and dated observations only.
GitHub's [repository rules REST API](https://docs.github.com/en/rest/repos/rules)
owns create/update fields, pagination and permission requirements;
[Git reference creation](https://docs.github.com/en/rest/git/refs#create-a-reference)
owns the once-only ref POST. API write bodies deliberately exclude read-only
ruleset metadata. The supplied JSON was parsed and locally checked against S's
planner/validators; no remote write acceptance or owner-admin action is inferred.

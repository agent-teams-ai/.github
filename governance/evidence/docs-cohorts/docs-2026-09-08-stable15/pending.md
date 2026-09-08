# stable15 registration candidate — PUBLISHED_UNQUALIFIED

Exact base: `822ab02e6be9c76218b4da33b9c1fdec97bef9ef`.
ID was absent from records, events, and evidence directories before preparation.
Only one record and publication event (sequence 120) are proposed. No performed
qualification, VERIFIED, QUALIFIED, CANARY, or RECOMMENDED claim is made.

Stable14's five package coordinates (including Managed 0.2.2), SRIs, historical
provenance, seven dependency edges, schemas, raw assets, runtime bounds, and
upgrade/rollback origins stable8, stable9.1, stable10 are retained exactly.
Historical `signature_verified` facts are inherited, not a fresh signature audit.
Only TEST repository 1336577313 is declared. PR18 and all policy remain untouched.
Workflow pin is the exact base above; YAML blob remains
`9bcbe54dfec6280045ac596e55c1f14ce5f176e1`.

Record digest: `sha256:639812f41c99205f499aacd6557b14e5d48d5f47fde27448205cbc83f44a8dd2`.
Publication event digest: `sha256:5adc77fc6a3b473b2caf913e830452584788e1b5b733878d3916d806984e03d2`.
Digests were generated using repository helper source and independently checked
with the actual imported cohortRecordDigest/cohortEventDigest helpers.

## Pending evidence and exact gates

The inherited closure `13f40994f7320bba8202314fe3eba916ce2db3c5c2185f79889dd562904ffbb4`
is a conditional candidate reference ONLY. Independent fresh resolution and exact
byte equality are mandatory before accepting reuse or merging this candidate.
No fresh reproduction was performed. A mismatch invalidates this candidate;
do not silently overwrite existing closure evidence or proceed under this digest.
The supplied rendered caller digest
`sha256:96722be4609daa262cc3cb8defe0cb8869713c0b77276886783b92720280ddf2`
also awaits reproduction from SRI-verified published 0.2.2 bytes. npm retrieval
was denied by the sandbox domain allowlist; no package install was performed.

`docs-cohort-append-only.yml` runs base-owned schema/append-only validation, then
`verifyChangedDocsCohortEvidence` live-verifies EVERY new record, including this
PUBLISHED_UNQUALIFIED record. Merely omitting positive events does not bypass
npm/provenance/assets/closure/workflow checks. It validates proposed data and does
not automatically append VERIFIED or QUALIFIED events. No inferred draft-to-CI
qualification transaction is used here. After actual successful verification,
parent may append VERIFIED then QUALIFIED, using real evidence references and
actual effective timestamps and cohortEventDigest at the current global tail.
Re-run all changed-record/event live gates on that exact final candidate.
`qualifiedCohortProjection` currently refuses stable15, as required: there is no
immutable QUALIFIED event. After qualification use that helper, never invent a
projection or a qualification event digest.

The first event is exactly latest publication `2026-09-08T11:05:14.301Z`.
`eligible_after: 2026-09-09T11:05:15Z` is informational compatibility metadata;
there is no wait or COOLDOWN event requirement. QUALIFIED/CANARY selection is
limited to TEST; general rollout requires hosted TEST default-branch push CANARY
proof followed by RECOMMENDED. Those later actions are outside this candidate.

## Parent commands (prepared full-history checkout, no worker dispatch)

Provide distinct absolute existing binaries PNPM_1118 (11.18.0) and PNPM_1120
(11.20.0), Node >=24.18.0 <25, exact locked dependencies ajv 8.20.0, yaml 2.9.0,
renovate 44.24.2, and authenticated read-only gh/npm access. Do not use unsafe
installs. Revalidate current central base/ID and TEST identity; preserve PR18.
If central registry has advanced, regenerate this unmerged append from that
reviewed tail; never rewrite already merged records/events.

```bash
set -euo pipefail
export SUCCESSOR=docs-2026-09-08-stable15
export EVIDENCE="$(mktemp -d /tmp/stable15-live.XXXXXX)"
export DOCS_COHORT_PNPM_V1_BIN="$PNPM_1118"
export DOCS_COHORT_PNPM_V2_BIN="$PNPM_1120"
test "$PNPM_1118" != "$PNPM_1120"
test "$("$PNPM_1118" --version)" = 11.18.0
test "$("$PNPM_1120" --version)" = 11.20.0
git show 822ab02e6be9c76218b4da33b9c1fdec97bef9ef:governance/docs-qualified-cohorts.json > "$EVIDENCE/base-registry.json"
gh api repos/agent-teams-ai/.github/branches/main > "$EVIDENCE/central-main.json"
gh api repos/agent-teams-ai/docs-protocol-canary-20260817 > "$EVIDENCE/test-repository.json"
gh pr view 18 -R agent-teams-ai/docs-protocol-canary-20260817 --json author,state,headRefOid,headRefName,baseRefName > "$EVIDENCE/pr18.json"
node --input-type=module <<'JS'
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolvePublishedRuntimeClosure,renderCallerWorkflowTemplate} from './scripts/verify-docs-cohort-evidence.mjs';
const registry=JSON.parse(await fs.readFile('governance/docs-qualified-cohorts.json'));
const record=registry.cohorts.find(r=>r.cohort_id===process.env.SUCCESSOR);
assert.equal(JSON.parse(await fs.readFile(`${process.env.EVIDENCE}/test-repository.json`)).id,1336577313);
const closure=await resolvePublishedRuntimeClosure(record.packages,{cohortGeneration:2,pnpmBinary:process.env.DOCS_COHORT_PNPM_V2_BIN});
assert.deepEqual(closure.authority,record.runtime_closure);
assert.equal(closure.source,await fs.readFile(record.runtime_closure.projection_path,'utf8'));
await fs.writeFile(`${process.env.EVIDENCE}/reproduced-closure.json`,closure.source);
const pkg=record.packages.find(p=>p.name==='@agent-teams/docs-protocol-agent-teams');
const response=await fetch('https://registry.npmjs.org/@agent-teams/docs-protocol-agent-teams/-/docs-protocol-agent-teams-0.2.2.tgz');
assert(response.ok);
const archive=Buffer.from(await response.arrayBuffer());
assert.equal('sha512-'+createHash('sha512').update(archive).digest('base64'),pkg.integrity);
const archivePath=`${process.env.EVIDENCE}/managed-0.2.2.tgz`;
await fs.writeFile(archivePath,archive);
const template=execFileSync('tar',['-xOf',archivePath,'package/'+record.assets.caller_workflow.path]);
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
assert.equal(sha(template),record.assets.caller_workflow.digest);
const rendered=renderCallerWorkflowTemplate(template,record.reusable_workflow);
assert.equal(sha(rendered),record.assets.caller_workflow.rendered_digest);
await fs.writeFile(`${process.env.EVIDENCE}/rendered-caller.yml`,rendered);
console.log('PASS independent closure and SRI-bound caller reproduction');
JS
DOCS_COHORT_BASE_PATH="$EVIDENCE/base-registry.json" \
DOCS_COHORT_CURRENT_PATH=governance/docs-qualified-cohorts.json \
  node scripts/check-cohort-append-only.mjs
"$PNPM_1118" governance:cohorts:verify -- --cohort "$SUCCESSOR" 2>&1 | tee "$EVIDENCE/live-verification.log"
node scripts/verify-docs-cohort-evidence.mjs \
  --registry governance/docs-qualified-cohorts.json \
  --schema governance/docs-qualified-cohorts.schema.json \
  --changed-from "$EVIDENCE/base-registry.json" 2>&1 | tee "$EVIDENCE/changed-evidence.log"
node tools/feature-module-standard/check.mjs
node --test tools/feature-module-standard/check.test.mjs
"$PNPM_1118" check
```

Only after real qualification events exist, generate the immutable projection:

```bash
node --input-type=module <<'JS'
import fs from 'node:fs/promises';
import {qualifiedCohortProjection} from './scripts/docs-cohort-policy.mjs';
const r=JSON.parse(await fs.readFile('governance/docs-qualified-cohorts.json'));
await fs.writeFile(`${process.env.EVIDENCE}/qualified-projection.json`,JSON.stringify(qualifiedCohortProjection(r,process.env.SUCCESSOR),null,2)+'\n');
JS
```

Before merge require fresh trusted CI for the exact reviewed head/base tuple and
independent review. Retain actual logs and their SHA-256 hashes; these commands
are pending instructions, not receipts. No GitHub mutation, publication, dispatch,
policy selection, consumer migration or PR18 change was performed by this worker.

## Worker verification actually performed

- Exact HEAD equals requested base; initial worktree was clean. Registry ID absent.
- Source helper record invariants, complete event digest chain, append-only comparison passed.
- Actual imported record/event helpers confirmed the generated hashes;
  qualifiedCohortProjection correctly rejected stable15 as unqualified.
- Exact-base `check-cohort-append-only.mjs` passed schema, lifecycle, digests and append-only checks.
- `node --test scripts/docs-cohort-policy.test.mjs scripts/docs-cohort-v2.test.mjs`: 95/95 passed.
- Standalone Feature Module Standard checker passed; its tests passed 3/3.
- `git diff --check` passed; local workflow Git blob matches the supplied blob.
- ajv/yaml initially were unavailable, then became available in shared node_modules
  without worker installation; the actual schema/test passes above occurred afterward.
- `pnpm check` did not execute its checks: Corepack failed creating its configured
  cache (ENOENT). Exact working pnpm 11.18.0 and 11.20.0 binaries remain parent
  prerequisites; full `pnpm check`, live npm/signature/provenance verification,
  independent closure resolution and published caller rendering remain PENDING.
- One `.git` write probe failed with read-only filesystem. No commit retries.
  Deliverable is an external patch with SHA-256; no Git metadata was changed.

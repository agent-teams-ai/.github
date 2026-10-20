# Quality source successor v2 installation snapshot

Observation date: 2026-10-20

Scope: proposed three-file installation on the actual merged PR369 tree.
The source qualification and PR369 merge below were observed. The permanent
main-caller route, live installed-main canaries and permanent cutover are
pending. This file records the installation snapshot and becomes immutable
with its caller and ADR after installation; later results must be recorded in
PR comments or separate ordinary evidence.

## Bound source, target and merge

| Coordinate | Observed value |
| --- | --- |
| Repository | `agent-teams-ai/.github`, repository ID `1316243981` |
| Defining source ref | `refs/heads/governance/quality-source-successor-v2` |
| Immutable source S | `d2904ef5181b1a3f42da2b6fad7e5f7fccad1ecd` |
| Source tree | `da1a6fec89215b661a12068f6a17c50c85e74a3a` |
| Source workflow | `.github/workflows/docs-quality-source-successor-v2.yml` at S |
| Source lock | Ruleset `25469495`, repository-owned, active |
| Finite source target | [PR369](https://github.com/agent-teams-ai/.github/pull/369), pull ID `4932929936`, three commits and fourteen changed files |
| Target base B | `ff94f77116923d7842a37a8004a5f4e31d65201e` |
| Target head H | `87c7f3b3eba8d56db70d351ac7f531c265ec8813` |
| Reviewed target tree | `12052b4713c71315dc3b351b0ff8ea527837e985` |
| Observed normal merge M / installation base | `5499550a2c8937303e1e0c7bc50570c72598ca8e` |
| Actual merge tree | `12052b4713c71315dc3b351b0ff8ea527837e985`, equal to the reviewed target tree |
| Owner authorization | [PR369 comment 6287220352](https://github.com/agent-teams-ai/.github/pull/369#issuecomment-6287220352), with the owner's explicit task authorization for the bounded installation |

The exact fourteen-path before/after tuple is owned by `TARGET_TUPLE` in the
[source implementation at S](https://github.com/agent-teams-ai/.github/blob/d2904ef5181b1a3f42da2b6fad7e5f7fccad1ecd/scripts/docs-quality-source-successor-v2.ts).
No new tuple or generic source exception is introduced by this installation.
The merge observation was independently read back through the normal owner
merge guard; the actual commit and tree are also present in the local full
Git history. This evidence does not relabel an earlier development source or
pre-rebase qualification as the final tuple.

## Genuine protected-source qualification

[Run 39410305372](https://github.com/agent-teams-ai/.github/actions/runs/39410305372),
attempt 1, is a completed successful `push` run on the exact source ref and S.
Its three observed jobs are:

| Job | Job ID | Observed conclusion |
| --- | --- | --- |
| `qualify` | `118586150562` | `success` |
| `source` | `118587014955` | `success` |
| `publish` | `118587293836` | `success` |

The source run binds its actual defining workflow, immutable checkout,
protected ref, exact PR369 B/H/tree tuple, current-attempt decisive jobs and
live protections. Its publisher writes only
`docs-quality-source-successor-v2` on the exact target H, after re-reading
authority; it cannot publish the legacy source context. Its source-job checks
execute the frozen v1 verifier for the retained ordinary and historical routes.
The workflow's historical target fetch verifies the exact H and target tree,
without changing the executing source checkout.

Hosted source reads are explicitly `public_read`: missing private bypass data
is not an empty-bypass attestation. The owner separately read full protection
objects before source publication and at the required-check transition.

## Observed owner protection transition for PR369

The owner-full observations of main ruleset `19979783` show the serialized
sequence below. Every listed check retains GitHub Actions integration `15368`.
The four unrelated main checks are `check`, `trusted-admission-evidence`,
`trusted-admission-authority-evolution-v1` and `trusted-validation`.

| Phase | Source requirements alongside those four checks |
| --- | --- |
| Before | `docs-source-successor-v1` |
| Add new first | `docs-source-successor-v1` and `docs-quality-source-successor-v2` |
| Remove only old | `docs-quality-source-successor-v2` |

The complete observations preserve all other main-rule fields, including
active enforcement on `~DEFAULT_BRANCH`, strict status policy,
`do_not_enforce_on_create:false`, deletion/non-fast-forward/linear-history
rules and all PR parameters. Owner reads report `bypass_actors:[]` and
`current_user_can_bypass:"never"`. Separate identity ruleset `24363205` is
unchanged and requires `commit-author-identity` from integration `15368`, with
strictness, active enforcement and no bypass. Source ruleset `25469495`
restricts exactly the source ref and blocks update, deletion and
non-fast-forward, with no bypass.

The operator retained the complete owner JSON observations. Their raw-file
SHA-256 values identify the dated snapshots; hashes alone are not remote
attestation or a claim of continuous monitoring.

| Retained observation | SHA-256 |
| --- | --- |
| `central369-before-mainRules.json` | `4f22117a7c35330b6d9b6c00c81f320afd4d293a1e3980ec4d6603e07b06d830` |
| `central369-additive-mainRules.json` | `348b2eea6758dd670a5aefbf42569ce764c4861bef520d5f74a51393ddca7e16` |
| `central369-new-mainRules.json` | `f350f63a7acfd7a832a84d8117916c02835a56911ef2a0c0faf9f68f22acba91` |
| `central369-new-identityRules.json` | `12f0db39937b9857f26db17cae8d058275158692198d83e916b4d015646556da` |
| `central369-new-sourceLock.json` | `805d5aac305f4178b35f23aa1a51d26db870fd2a3676336aeb73e3435f4f5620` |

These transition snapshots precede the normal PR369 merge. The merge result
is a separate subsequent observation at M, not a claim inferred from the
earlier open-PR snapshot.

## Exact installation and local proof

This proposal adds only these three regular `100644` files:

1. `.github/workflows/docs-quality-source-successor-v2-caller.yml`
2. `docs/decisions/0012-bounded-quality-source-successor-v2.md`
3. `governance/evidence/docs-source-successor/quality-source-successor-v2-installation.md`

The caller is generated by `callerWorkflowDefinition(S)` and verified by
`assertCallerWorkflow(bytes, S)` from the source implementation at S. The
definition has only the canonical `pull_request_target` event types,
permissions and one immutable reusable-workflow job. It accepts no inputs or
secrets and contains no local checkout or script execution. Its source
workflow always executes source-owned code, not installation PR code.

A read-only local proof executed the actual frozen v1 successor and its
verifier on a complete synthetic envelope with this three-path additive
shape and unchanged package/lock inputs. Both returned `noop` through the
ordinary unchanged-dependencies route. Negative controls rejected a
`node_modules` authority shadow, an installer-name `package.json` shadow,
a protected controller edit, a frozen v1 workflow edit and an undeclared
fourth leaf. The operator retained the diagnostic log
`central-v1-installer-readonly-proof.log`.

That proof used fixture ADR/evidence bytes and a synthetic PR envelope on
the reviewed target tree. The actual installation base M has that same tree,
but is a distinct commit from H. This is evidence about the frozen route's
shape, not a live installation PR, installed caller execution, required-check
success, approval or merge. The actual three files still require review and
the complete `pnpm check`; this snapshot does not claim those future results.
All existing source guards, tests, workflows, accepted decisions, packages,
lockfiles and quality inputs remain unchanged by the proposal.

## Pending installation and permanent qualification

The earlier source-push success is bound to PR369. An installation PR cannot
certify itself through a main caller that is absent from its base. The planned
temporary installation sequence is therefore: **add old v1 before removing
new v2**, read back all owner protections, observe genuine v1 and other native
checks for the actual installation head, then normally merge the reviewed
three-file PR. The qualified immutable source remains protected throughout.

After that merge, observe a genuine ordinary positive canary and a genuine
protected-input negative canary through the installed main caller. Record
their real PR/base/head, workflow/source/run/attempt, decisive jobs and status
coordinates in PR comments or separate ordinary evidence. No canary
coordinates are assigned here, and no negative canary is to be merged.

An optional failed v2 status demonstrates rejection, not merge prevention.
After both canaries complete and fresh owner-full protections are inspected,
**add new v2 while retaining old v1**. Read back the required-context bridge and
confirm that the same negative head has the required v2 failure and blocked
mergeability. Do not attempt a red merge or enable auto-merge. Only after that
blocking proof and the genuine positive result may old v1 be removed,
preserving all unrelated checks, identities, strictness, PR rules and no-bypass
restrictions. The permanent transition, required-context blocking proof and
installed-main positive/negative results are pending in this frozen snapshot.
If installation fails or a canary misses its expected outcome, retain the old
requirement and stop before the permanent transition; rollback or successor
changes require their own reviewed route rather than edits to immutable
installation bytes.

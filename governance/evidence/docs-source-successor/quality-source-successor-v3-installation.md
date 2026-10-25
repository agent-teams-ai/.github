# Quality source successor v3 installation snapshot

Observation date: 2026-10-25

Scope: proposed three-file installation on actual merged PR392 main. Source
qualification, the finite main-source transition, PR392 merge and main CI below
were observed. The permanent caller installation, its real PR checks,
installed-main canaries and final permanent cutover are pending. This snapshot
becomes immutable with its caller and ADR after installation; later facts must
be retained separately rather than appended here.

## Bound source, finite target and actual merge

| Coordinate                                | Observed value                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Repository                                | `agent-teams-ai/.github`, ID `1316243981`                                                                                      |
| Defining source ref                       | `refs/heads/governance/quality-source-successor-v3`                                                                            |
| Immutable S                               | `c364ab2b82ad6250500110345982c3f1fa82181f`                                                                                     |
| Source tree                               | `849d80918e298f3549901949e7d22d0cb0889221`                                                                                     |
| Source workflow at S                      | `.github/workflows/docs-quality-source-successor-v3.yml`                                                                       |
| Dedicated source lock                     | `25832759`, repository-owned, active, no bypass                                                                                |
| Finite target                             | [PR392](https://github.com/agent-teams-ai/.github/pull/392), pull ID `5006683224`, two owner commits, 96 regular changed paths |
| Target base B                             | `7ec79111e02c61014760d6427d2b55d821f35e61`                                                                                     |
| Target head H                             | `d64892594df5b5241267d1ad0326fab95c60aed6`                                                                                     |
| Target tree                               | `55cd02c64a17a15fe2814488c24044763eade07d`                                                                                     |
| Actual normal merge M / installation base | `867fa34138c9f99534587d2562317bc8a70035b9`                                                                                     |
| Actual merge tree                         | `55cd02c64a17a15fe2814488c24044763eade07d`, equal to the reviewed target tree                                                  |

The exact finite tuple lives only in the immutable source's typed target data.
Its final target content SHA256 is
`d3e2615e1ebb27cfd1f27c3b266449e7020586f21a9c34042ce08cd701a38f42`.
Source preparation, independent review, actual owner commit/push and remote
readbacks were retained separately; a content hash is not a source run or
continuous remote attestation.

## Genuine source qualification before the finite merge

[Run 40223861509](https://github.com/agent-teams-ai/.github/actions/runs/40223861509/attempts/1),
attempt 1, was a successful owner `push` on exact S/ref. It ran on Linux x64,
Node 26.11.1 and pnpm 11.18.0. The dedicated strict project, actual lint and
15 accepting/rejecting source tests passed. Target fixtures were inert Git
data; the job did not install or execute target fixture code.

| Job       | Job ID         | Conclusion                          |
| --------- | -------------- | ----------------------------------- |
| `qualify` | `121261017352` | `success`                           |
| `source`  | `121261179679` | `success`, actual `quality-runtime` |
| `publish` | `121261313941` | `success`                           |

The actual GitHub Actions status `57213215587` was `success` for
`docs-quality-source-successor-v3` on exact H, bound to that run/attempt URL.
The publisher owned only its v3 context and rechecked source, target, protections
and current-attempt decisive jobs. Hosted reads were `public_read`; missing
private bypass evidence was not treated as an empty bypass list. Separate
owner-full readbacks explicitly reported `bypass_actors:[]` and
`current_user_can_bypass:"never"`.

Main ruleset `19979783` was observed in the finite sequence v2 required, v2+v3
required, then v3 required. Separate identity ruleset `24363205` and all seven
other complete rulesets remained unchanged. App `15368`, strict and creation
status enforcement, the four unrelated contexts, PR parameters, linear history,
deletion/non-fast-forward restrictions and no bypass were preserved. The old
v2 failure remained visible in the blocked bridge; no new bridge run or green
was fabricated. All six final required checks passed, while optional historical
authority/ReviewRouter failures remained and GitHub reported `UNSTABLE`.

The normal owner merge guard then observed the actual PR392 merge M and verified
owner binding and the supplied commit message. This is a distinct merge
observation, not an inference from the earlier open-PR source snapshot.

## Actual main CI and bounded installation proposal

[Main run 40227024730](https://github.com/agent-teams-ai/.github/actions/runs/40227024730),
attempt 1, is an actual successful `push` run on M. Job `check` (`121270449675`)
passed ordinary frozen installation and complete `pnpm check`, with 5714 current
and 9 frozen tests. Two separate automatic dependency-update runs failed;
they are not relabeled native CI success. Main CI at M does not qualify the
future three-file installation head.

The installation adds only these regular `100644` files:

1. `.github/workflows/docs-quality-source-successor-v3-caller.yml`
2. `docs/decisions/0013-bounded-quality-source-successor-v3.md`
3. `governance/evidence/docs-source-successor/quality-source-successor-v3-installation.md`

The caller is generated and checked by the actual source-owned functions with
literal S. It has no inputs, inherited secrets, local checkout or commands.
Frozen v2/v1 source/caller/ADR/evidence and every tracked M adoption input remain
unchanged. The local pure proof uses actual M/package/lock and complete Git-tree
fixtures. Its inert head/PR envelope is test data, never an observed installer
PR, canary, installed caller or required status. It rejects protected input and
authority-shadow changes and an undeclared fourth leaf. The ordinary frozen
gate permits general unprotected edits; the reviewed installer packet's separate
exact three-path scope is not falsely attributed to that general route.

## Pending installation and permanent cutover

No installation PR/head, v2 installation acceptance, installed-main v3 result,
positive/negative canary or required blocking proof is assigned here. The
historical source run targeted PR392 before its merge and cannot self-certify
new installation files or be replayed as their evidence.

The existing ADR-0013 route is add old v2 before removing temporary v3, retain
complete owner readbacks, then obtain actual v2 ordinary acceptance and all
unrelated native checks for the real three-file PR. After normal merge, observe
both installed-main canaries through exact S. Add v3 while retaining v2 and
prove that the same negative head is blocked by required v3 failure before
removing v2 permanently. Optional failure is not merge-blocking proof. Never
merge the negative canary, forge a status or mutate either locked source.

If a phase fails, retain/re-add the old requirement before removing the new one.
Stop dependent effects on drift. Any rollback of installed files requires a
separately reviewed normal PR. Later observations belong in separate ordinary
evidence or PR comments; this dated installation snapshot stays immutable.

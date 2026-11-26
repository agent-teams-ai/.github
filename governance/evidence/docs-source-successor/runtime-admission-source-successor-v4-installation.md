# Runtime admission source successor v4 installation preparation

Preparation refresh: 2026-11-26 Europe/Kiev

Status: Proposed installation snapshot. All source, canary, finite-target and
temporary predecessor-restoration prerequisites for the ordinary three-file
installation are observed below. Actual caller installation, installed-main
canaries, permanent v4 enforcement and owner grants remain future observations.
This snapshot does not claim that the three files are already installed on main.

## Known reviewed coordinates

| Coordinate                    | Prepared value                                                   |
| ----------------------------- | ---------------------------------------------------------------- |
| Repository                    | `agent-teams-ai/.github`, ID `1316243981`                        |
| Reviewed source commit S      | `72fa7a8af02e9ba7904c912f0bbb457254381002`                       |
| Ordinary preparation ref      | `refs/heads/review/native-owner-admission-v4-20261125`           |
| Reviewed source tree          | `e762ed1328421970e92acc5d3639f7235bbbcd04`                       |
| Source parents                | `0b91687934938299c379a05f300e7fda915a5a9b`, `9dff206369649d9eb7a76edc1943461fde837739` |
| Canonical source ref          | `refs/heads/governance/runtime-admission-source-successor-v4`    |
| Dedicated source lock         | `28123607`, created 2026-11-26 00:34:21 UTC before publication |
| Source workflow               | `.github/workflows/runtime-admission-source-successor-v4.yml`    |
| Source context                | `runtime-admission-source-successor-v4`                          |
| Installed predecessor         | `6863c4b6e9f17b3a668e0afb9ff33cb9046788d0`, lock `26268325`      |
| Exact finite target           | PR423, pull ID `5483046730`, three commits, five changed file pairs |
| Target base                   | `755c8515a5d106402a7e9e2cff621fb1fdc855cf`                       |
| Target base tree              | `7a1576f050af70132329a7d241f1921fa12d855d`                       |
| Target head                   | `9dff206369649d9eb7a76edc1943461fde837739`                       |
| Target tree                   | `fd7d6388cabf8cb86284478213541e66b75bdda9`                       |
| Actual finite merge / installation base | `e35df6a3fcf4d5e33d0f79b5b27c3a3e454b5d56`, same reviewed policy tree |

The source-only artifact has 17 changed files relative to its real target-head
parent: ten owned source/configuration/test files and seven byte-identical frozen
closure files. It inherits the five policy files unchanged. The extra maintained
census assertion fixes the actual full-gate mismatch without changing historical
r322 descriptors or source bytes. These source-tree files are not added by this
three-file main installation.

## Current preparation verification

Main advanced through the separately owned evidence PR425. The policy PR
was refreshed by a normal merge, preserving all five reviewed policy blobs
and the new main evidence. The source now binds the full three-commit target:
`dcefabe92d308ac07528e999f1e6b3ee2daffed5`,
`2592d8e7a70224ca6df223f53465c3b30c55dacb` and
`9dff206369649d9eb7a76edc1943461fde837739`.
Its existing substitution regression checks every commit, preserving the
distinct current-head and earlier-commit rejection expectations. Ordinary
admission and workflow semantics are unchanged. Independent source review
confirmed the exact target/tree/commit list, all five policy blob pairs and
the seven byte-identical frozen closure files.

The first current local invocation on Node 24.22.3 passed 68/70 tests. Two tests
failed because the exact stack-toolchain installation was unavailable and the
invocation used pnpm 11.25.0 instead of the required pnpm 11.18.0. The changed
commit-substitution regression passed.

The final outcome of the subsequent pinned-toolchain invocation was not
recovered after the execution environment disconnected. No repeated local
full-suite pass is claimed.

All four ordinary hosted content runs below completed on attempt 1:

| Content | Runtime | Run and job | Result |
| --- | --- | --- | --- |
| Policy `9dff2063` | Node 26.11.1 | [45721641063](https://github.com/agent-teams-ai/.github/actions/runs/45721641063), job `139581171762` | 5807/5807 current + 9/9 frozen; zero failures/skips/cancellations/todo |
| Policy `9dff2063` | Node 24.21.0 | [45721641073](https://github.com/agent-teams-ai/.github/actions/runs/45721641073), job `139581171580` | 5807/5807 current + 9/9 frozen; zero failures/skips/cancellations/todo |
| Source `72fa7a8a` | Node 26.11.1 | [45722236365](https://github.com/agent-teams-ai/.github/actions/runs/45722236365), job `139583146898` | 5939/5939 current + 9/9 frozen; zero failures/skips/cancellations/todo |
| Source `72fa7a8a` | Node 24.21.0 | [45722236290](https://github.com/agent-teams-ai/.github/actions/runs/45722236290), job `139583146538` | 5939/5939 current + 9/9 frozen; zero failures/skips/cancellations/todo |

Every run passed the prescribed frozen root install, isolated Renovate install,
managed native prerequisite build and full `pnpm check`. For S, the actual
ordinary strict tooling typecheck included both v4 source and test files; compiler
metadata satisfied the 7.0.2 floor. The three-commit substitution regression
passed in both source runs. Dedicated canonical qualification is recorded
separately below; ordinary content checks were not used as a substitute.

The policy runs checked out synthetic commit
`0095ee86e1c7fae9eebc741e10b4aa6aec282344`, with parents
`755c8515a5d106402a7e9e2cff621fb1fdc855cf` and
`9dff206369649d9eb7a76edc1943461fde837739`, and tree
`fd7d6388cabf8cb86284478213541e66b75bdda9`, exactly the reviewed policy tree.
The source runs checked out synthetic commit
`3d0b835f0cfc635558ff32a8cf63bf724844c9fc`, with parents
`755c8515a5d106402a7e9e2cff621fb1fdc855cf` and
`72fa7a8af02e9ba7904c912f0bbb457254381002`, and tree
`e762ed1328421970e92acc5d3639f7235bbbcd04`, exactly S's tree.
Independent review verified these actual checkout objects and complete logs;
run head metadata alone is not the checkout proof.

Temporary validation [PR424](https://github.com/agent-teams-ai/.github/pull/424)
was closed without merge after its launched runs were terminal. Its two current
ordinary content runs succeeded as recorded above. Legacy protected-source
rejections remain failures and do not establish current source admission.

The earlier source-lock UI submission reached GitHub Confirm access and did not
complete. No new source lock or canonical ref was created in that earlier
attempt, and existing rules were unchanged. This remains historical evidence;
it is no longer the current authentication or lock-creation blocker.

## Actual source publication and qualification

Repository-owned lock `28123607` was created at 2026-11-26 00:34:21 UTC and
read back before canonical publication. It is active and covers exactly
`refs/heads/governance/runtime-admission-source-successor-v4`, with no exclusions
or bypass actors and with update, deletion and non-fast-forward restrictions.
There is no fetch-and-merge exception. The canonical ref was published at
reviewed S and read back unchanged, with the branch protected. No predecessor
source or lock was rewritten.

The genuine canonical source push
[45730526165](https://github.com/agent-teams-ai/.github/actions/runs/45730526165),
attempt 1, was created at 2026-11-26 00:41:31 UTC for S on the canonical source
branch. Its [qualify job 139611107577](https://github.com/agent-teams-ai/.github/actions/runs/45730526165/job/139611107577),
[source job 139612302756](https://github.com/agent-teams-ai/.github/actions/runs/45730526165/job/139612302756)
and [publish job 139612703099](https://github.com/agent-teams-ai/.github/actions/runs/45730526165/job/139612703099)
all completed successfully. The actual qualifier passed 70/70 dedicated,
5939/5939 current and 9/9 frozen tests, without failures, cancellations or skips.

At 00:46:35 UTC the publisher wrote status `59928307464`,
`runtime-admission-source-successor-v4: success`, on exact policy head
`9dff206369649d9eb7a76edc1943461fde837739`, bound to that run and attempt 1.
This source-owned status was inspected separately from the current required
source set. It did not by itself authorize retiring v2 or merging the policy.

## Actual source canaries and required blocking

The generated canary caller at
`.github/workflows/runtime-admission-source-v4-canary.yml` used immutable S.
Both source-canary runs were real push executions, attempt 1, with actor
`777genius`, and qualified against base
`755c8515a5d106402a7e9e2cff621fb1fdc855cf`.

| Canary | Actual target and run | Outcome |
| --- | --- | --- |
| Positive [#426](https://github.com/agent-teams-ai/.github/pull/426), pull ID `5501544058` | Head `5981b02a8e85222d18364395ce7abaddcef31dd0`; [45731268148](https://github.com/agent-teams-ai/.github/actions/runs/45731268148), completed 00:53:03 UTC | Qualify `139613571026`, source `139615183118` (ordinary noop), publish `139615434859`: SUCCESS. Status `59928628449`: v4 success |
| Negative [#427](https://github.com/agent-teams-ai/.github/pull/427), pull ID `5501550539` | Head `1daf0333bde7438a883b8656440c39a484ba8010`; [45731273621](https://github.com/agent-teams-ai/.github/actions/runs/45731273621), completed 00:57:12 UTC | Qualify `139613591777`: SUCCESS. Source `139616851104` and publisher `139617081919`: expected FAILURE. Status `59928839075`: v4 failure |

Each canary qualifier passed 70 dedicated, 5939 current and 9 frozen tests with
no failures or skips. The negative source log explicitly reports
`Protected input changed: governance/commit-author-identity.json`.
The current-attempt publisher retained failure; that red run is the measured
rejection and is not relabelled as a successful workflow.

After the additive bridge below, the unchanged negative head was observed in
GitHub with both v4 failure and v2 failure marked Required and the Squash merge
control disabled. API readback separately recorded an open, Ready, unmerged PR,
`mergeable: true` (no textual conflict) and `mergeable_state: blocked`.
The v4 context was therefore required during the blocking observation;
an optional negative result alone was not treated as this proof. Neither
source canary was merged. Positive #426 was closed without merge at
2026-11-26 01:05:45 UTC; negative #427 at 01:05:47 UTC. Their receipts retain
the original qualified base and heads.

## Finite protection transition and actual policy merge

The owner-full readbacks retained repository-owned active main rule
`19979783` and identity rule `24363205`, default-branch scope with no
exclusions, empty bypass lists, strict status checks and
`do_not_enforce_on_create: false`. All status contexts remained bound to
App `15368`. The non-source main contexts remained exactly `check`,
`trusted-admission-authority-evolution-v1`, `trusted-admission-evidence`
and `trusted-validation`; the identity context remained `commit-author-identity`.

Deletion, non-fast-forward and linear-history restrictions, squash-only PR
delivery, zero required approvals, stale-review dismissal, required thread
resolution, no code-owner or last-push approval, no additional required reviewers,
disabled dismissal restriction and the unattributed-change approval protection
remained unchanged.

| Phase | Actual UTC ruleset update | Required source contexts and observation |
| --- | --- | --- |
| First additive bridge | 2026-11-26 00:59:20.707 | v2 and v4 together; only v4/App15368 added, identity unchanged; same negative head blocked with v4 Required |
| Finite target | 2026-11-26 01:03:04.817 | v4 only; only v2 retired after the bridge proof, other fields unchanged |
| Temporary restore bridge | 2026-11-26 01:12:26.207 | v4 and v2 together; only v2/App15368 restored, all other fields retained |
| Restored ordinary predecessor | 2026-11-26 01:13:08.289 | v2 only; only temporary v4 removed, ordinary installation predecessor restored |

Complete owner-full finite, restore and installation readbacks were checked by
the actual source-owned `planProtectionTransition` implementation. Each phase
retained identity rule `24363205` unchanged and both empty bypass lists; the
actual reader response remained `current_user_can_bypass: never`. The source
lock also retained that response, active enforcement, exact ref and no bypass.
Canonical S remained protected and unchanged. During both restoration
observations, main remained at actual merge M.
No owner grant was installed during these temporary source transitions.

With all actual current required checks successful, PR423 merged through the
ordinary protected squash route, without bypass, at 2026-11-26 01:04:22 UTC:
[`e35df6a3fcf4d5e33d0f79b5b27c3a3e454b5d56`](https://github.com/agent-teams-ai/.github/commit/e35df6a3fcf4d5e33d0f79b5b27c3a3e454b5d56).
Its single parent is `755c8515a5d106402a7e9e2cff621fb1fdc855cf`;
its tree is exactly reviewed policy tree
`fd7d6388cabf8cb86284478213541e66b75bdda9`.
Main was read back at that commit. All five reviewed policy blobs, the complete
supplied merge message and owner attribution were independently verified.

Actual author: `Илия <iliyazelenkog@gmail.com>`, associated with `777genius`.
The permitted technical squash committer is
`GitHub <noreply@github.com>`, account `web-flow`.
No source, caller, canary or other policy file entered the finite merge.

| Actual merge validation | Run / job | Observed result |
| --- | --- | --- |
| Node 26.11.1 full CI | [45733204616](https://github.com/agent-teams-ai/.github/actions/runs/45733204616), job `139620049142`, attempt 1 | SUCCESS; 5807/5807 current + 9/9 frozen; zero failures/cancellations/skips/todo |
| Node 24.21.0 full compatibility | [45733204528](https://github.com/agent-teams-ai/.github/actions/runs/45733204528), job `139620048644`, attempt 1 | SUCCESS; 5807/5807 current + 9/9 frozen; zero failures/cancellations/skips/todo |

Both jobs completed the frozen install, isolated Renovate installation, managed
native prerequisite build and full `pnpm check`. Actual checkout logs name M,
not only run metadata. These are real postmerge observations and do not install
the three files or qualify their later PR.

## Historical preparation at source 0b916879

At the 2026-11-25 checkpoint, main had advanced through the separately owned
documentation PR418. The policy PR was updated by a normal merge commit, preserving its original commit and all
five reviewed policy blobs. That source's finite binding named that actual
main, policy head and two-commit list. Its negative test covered substitution
of either the original or final commit; the admission implementation is
otherwise unchanged.

The then-current builtin production `assertTargetBinding`, `parseCompleteTree` and
`assertSourceTuple` passed against the actual local Git objects for this target:
base `6a33853123378ef8ea69868da8ecb550cd53c906`, head
`2592d8e7a70224ca6df223f53465c3b30c55dacb`, the exact two commits and five
before/after file pairs. `git diff --check` passed. These are bounded preparation
checks, not full source qualification.

Local dependency installation at that checkpoint did not complete. An initial
environment fallback used pnpm11.25.0, then the corrected exact Corepack pnpm11.18.0 frozen
install also exited 137. Neither attempt qualifies the dependency graph.
The dedicated v4 suite then failed to load the missing `yaml` dependency;
the identity/onboarding invocation reported 41 passed tests and an onboarding
file-level failure. No successful local full-suite result was claimed for that
checkpoint.
The workspace subsequently reported exhausted disk space and the execution
environment disconnected; that observation does not establish the cause of
either earlier exit. Incomplete task-owned dependency files were removed.

Full ordinary hosted validation for that earlier rebound source passed on both supported
CI runtimes through the reopened existing validation draft
[PR424](https://github.com/agent-teams-ai/.github/pull/424):

| Runtime | Historical ordinary CI run | Result |
| --- | --- | --- |
| Node 26.11.1 | [45675425685](https://github.com/agent-teams-ai/.github/actions/runs/45675425685), job `139421562543` | 5939/5939 current and 9/9 frozen tests; zero failures/skips/cancellations |
| Node 24.21.0 | [45675425701](https://github.com/agent-teams-ai/.github/actions/runs/45675425701), job `139421563712` | 5939/5939 current and 9/9 frozen tests; zero failures/skips/cancellations |

Both runs completed the prescribed root frozen install, isolated Renovate
install, managed native prerequisite build and full `pnpm check`. The actual
synthetic merge checkout `cda0c2392739fc4a2707a9d060339c13373d095a` has parents
`6a33853123378ef8ea69868da8ecb550cd53c906` and
`0b91687934938299c379a05f300e7fda915a5a9b`, and tree
`50789b91c4749153c5619598a86eaa2de64eec65`, exactly the reviewed source tree.
These are full ordinary content checks. Canonical source publication, genuine
source push qualification, canaries and grant installation remain unobserved.

## Historical preparation at source fa14f67d

The previous source `fa14f67d97361bf9713d94afdc102d3828a8160c` had focused
70/70 success on Node24.22.3 and pnpm11.18.0, with compiler floor, quality scope,
dedicated strict compilation, lint and format. Its local full check did not pass:
a maintained census mismatch was corrected, after which an unchanged onboarding
worker received SIGKILL and the completion guard failed. Those failures remain
failures.

The ordinary validation [PR424](https://github.com/agent-teams-ai/.github/pull/424)
passed the complete normal root gate for that previous source on both supported
CI runtimes:

| Runtime | Actual earlier ordinary CI run | Result |
| --- | --- | --- |
| Node 26.11.1 | [45529736462](https://github.com/agent-teams-ai/.github/actions/runs/45529736462) | 5939/5939 current and 9/9 frozen tests; zero failures/skips |
| Node 24.21.0 | [45529736401](https://github.com/agent-teams-ai/.github/actions/runs/45529736401) | 5939/5939 current and 9/9 frozen tests; zero failures/skips |

Both runs completed the normal frozen dependency installations, isolated native
prerequisites and full check. Their actual PR merge checkout
`0eedc0f223e628ad82d8b4af0f7ed81190892d38` has parents
`a277e75589ab765272961a5e1eba6725d098bd89` and
`fa14f67d97361bf9713d94afdc102d3828a8160c`, with tree
`e6310cbadd69189247560b16878e77f01d927491`. These historical results are retained
without relabelling their source. They do not establish the canonical v4 source
lock, protected push qualification, current finite-target publication,
installation or any owner grant.

## Required live observations before installation

| Observation                                                                  | Actual evidence |
| ---------------------------------------------------------------------------- | --------------- |
| Dedicated new lock ID and owner-full readback before canonical publication | Lock `28123607`; active, exact canonical ref, no bypass; created and read back before source publication |
| First canonical source ref publication at reviewed S | Canonical ref read back at `72fa7a8af02e9ba7904c912f0bbb457254381002`, protected; source tree `e762ed1328421970e92acc5d3639f7235bbbcd04` |
| Genuine source push run, attempt and successful qualify/source/publish jobs | [45730526165](https://github.com/agent-teams-ai/.github/actions/runs/45730526165), attempt 1, exact S; jobs `139611107577`, `139612302756`, `139612703099` SUCCESS |
| Source-owned success status on exact PR423 head | Status `59928307464`, v4 success on exact `9dff2063...`, source push attempt 1 |
| Source-defined positive canary PR/head/base/run/attempt/result | #426 / `5981b02a...` / `755c8515...` / [45731268148](https://github.com/agent-teams-ai/.github/actions/runs/45731268148) / attempt 1 / SUCCESS; complete coordinates and jobs above |
| Source-defined rejecting canary PR/head/base/run/attempt/result | #427 / `1daf0333...` / `755c8515...` / [45731273621](https://github.com/agent-teams-ai/.github/actions/runs/45731273621) / attempt 1 / expected protected-input FAILURE |
| Required negative blocking proof during v2 plus v4 bridge | Same #427 head `1daf0333...`; v4 failure marked Required, Squash merge disabled, API state blocked after 00:59:20.707 UTC bridge |
| Complete main and identity ruleset readbacks for finite add/retire | Owner-full bridge and finite observations at 00:59:20.707 / 01:03:04.817 UTC; only source-context additions/removal, all other fields retained |
| Actual normal PR423 merge commit/tree/attribution and postmerge checks | Actual M `e35df6a3fcf4d5e33d0f79b5b27c3a3e454b5d56`, exact reviewed tree/parent/owner/message; both named postmerge full checks SUCCESS as detailed above |
| Complete restore/install readbacks returning to the installed v2 requirement | Owner-full restore at 01:12:26.207 UTC (v4+v2), then installation phase at 01:13:08.289 UTC (v2 only); actual source transition planner PASS; main/identity/source locks and reader authority retained |

Qualification canaries are never merged. An optional failed check proves rejection
only; the same negative head must be observed with the successor required and
mergeability blocked. Capture actual source/target/caller identities and the
current run attempt rather than assigning evidence from an earlier head.

## Three proposed regular files

1. `.github/workflows/runtime-admission-source-successor-v4-caller.yml`
2. `docs/decisions/0018-bounded-runtime-admission-source-successor-v4.md`
3. `governance/evidence/docs-source-successor/runtime-admission-source-successor-v4-installation.md`

The generated caller must be pinned to the actual immutable S. The two documents
must record that same source and the actual completed finite prerequisite before
installation, without claiming future installation or permanent enforcement results. Old source/caller/ADR/evidence
bytes remain unchanged.

## Later permanent qualification and owner grants

The installation PR's own result, installed-main positive and negative canaries,
required blocking proof, permanent v4 cutover and actual owner-grant applications
are pending. Retain those later facts separately once the three files are installed.
Before applying any scoped grant, obtain a fresh owner-full rule observation and
change only its bypass actor list. Preserve the final v4-only Central context set;
never replay the old full PUT containing runtime-v2. Confirm actual reader authority
and every unchanged protected field after each application.

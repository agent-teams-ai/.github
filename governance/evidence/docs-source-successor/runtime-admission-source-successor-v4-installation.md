# Runtime admission source successor v4 installation preparation

Preparation date: 2026-11-25 UTC

Status: Preparation draft only. No protected source publication, source lock, hosted
qualification, finite merge, caller installation or owner grant is claimed here.
This file may be retained on an ordinary review branch, but it is not an observed
installation snapshot and is not ready for publication as one. Replace pending observations with authenticated real receipts before the
three-file installation; do not fill them with synthetic identifiers.

## Known reviewed coordinates

| Coordinate                    | Prepared value                                                   |
| ----------------------------- | ---------------------------------------------------------------- |
| Repository                    | `agent-teams-ai/.github`, ID `1316243981`                        |
| Reviewed source commit S      | `0b91687934938299c379a05f300e7fda915a5a9b`                       |
| Ordinary preparation ref      | `refs/heads/review/native-owner-admission-v4-20261125`           |
| Reviewed source tree          | `50789b91c4749153c5619598a86eaa2de64eec65`                       |
| Source parents                | `fa14f67d97361bf9713d94afdc102d3828a8160c`, `2592d8e7a70224ca6df223f53465c3b30c55dacb` |
| Intended canonical source ref | `refs/heads/governance/runtime-admission-source-successor-v4`    |
| Source workflow               | `.github/workflows/runtime-admission-source-successor-v4.yml`    |
| Source context                | `runtime-admission-source-successor-v4`                          |
| Installed predecessor         | `6863c4b6e9f17b3a668e0afb9ff33cb9046788d0`, lock `26268325`      |
| Exact finite target           | PR423, pull ID `5483046730`, two commits, five changed file pairs |
| Target base                   | `6a33853123378ef8ea69868da8ecb550cd53c906`                       |
| Target base tree              | `ee728c21305a0165ac23293a159a7c569bc1f6f1`                       |
| Target head                   | `2592d8e7a70224ca6df223f53465c3b30c55dacb`                       |
| Target tree                   | `d03b59b675e17530179495cbb3287061546675f4`                       |

The source-only artifact has 17 changed files relative to its real target-head
parent: ten owned source/configuration/test files and seven byte-identical frozen
closure files. It inherits the five policy files unchanged. The extra maintained
census assertion fixes the actual full-gate mismatch without changing historical
r322 descriptors or source bytes. These source-tree files are not added by this
three-file main installation.

## Current preparation verification

Main advanced through the separately owned documentation PR418. The policy PR
was updated by a normal merge commit, preserving its original commit and all
five reviewed policy blobs. The source's finite binding now names that actual
main, policy head and two-commit list. Its negative test now covers substitution
of either the original or final commit; the admission implementation is
otherwise unchanged.

Builtin production `assertTargetBinding`, `parseCompleteTree` and
`assertSourceTuple` passed against the actual local Git objects for this target:
base `6a33853123378ef8ea69868da8ecb550cd53c906`, head
`2592d8e7a70224ca6df223f53465c3b30c55dacb`, the exact two commits and five
before/after file pairs. `git diff --check` passed. These are bounded preparation
checks, not full source qualification.

Current local dependency installation did not complete. An initial environment
fallback used pnpm11.25.0, then the corrected exact Corepack pnpm11.18.0 frozen
install also exited 137. Neither attempt qualifies the dependency graph.
The dedicated v4 suite then failed to load the missing `yaml` dependency;
the identity/onboarding invocation reported 41 passed tests and an onboarding
file-level failure. No successful current local full-suite result is claimed.
The workspace subsequently reported exhausted disk space and the execution
environment disconnected; that observation does not establish the cause of
either earlier exit. Incomplete task-owned dependency files were removed.

Full ordinary hosted validation for this rebound S passed on both supported
CI runtimes through the reopened existing validation draft
[PR424](https://github.com/agent-teams-ai/.github/pull/424):

| Runtime | Current ordinary CI run | Result |
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

## Retained earlier preparation evidence

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
| Dedicated new lock ID and owner-full readback before canonical publication   | Not observed    |
| First canonical source ref publication at reviewed S                         | Not observed    |
| Genuine source push run, attempt and successful qualify/source/publish jobs  | Not observed    |
| Source-owned success status on exact PR423 head                              | Not observed    |
| Source-defined positive canary PR/head/base/run/attempt/result               | Not observed    |
| Source-defined rejecting canary PR/head/base/run/attempt/result              | Not observed    |
| Required negative blocking proof during v2 plus v4 bridge                    | Not observed    |
| Complete main and identity ruleset readbacks for finite add/retire           | Not observed    |
| Actual normal PR423 merge commit/tree/attribution and postmerge checks       | Not observed    |
| Complete restore/install readbacks returning to the installed v2 requirement | Not observed    |

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

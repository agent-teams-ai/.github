# Runtime admission source successor v2 installation snapshot

Observation date: 2026-10-31

Scope: three-file installation on actual merged PR389 main. Source
qualification, the source-defined canaries, the finite main-source transition,
the PR389 merge and the temporary exchange back to the installed v3 requirement
were observed. The installation PR's own checks, installed-main canaries and the
final permanent cutover are pending. This snapshot becomes immutable with its
caller and ADR after installation; later facts must be retained separately
rather than appended here.

## Bound source, finite target and actual merge

| Coordinate                  | Observed value                                                       |
| --------------------------- | -------------------------------------------------------------------- |
| Repository                  | `agent-teams-ai/.github`, ID `1316243981`                            |
| Defining source ref         | `refs/heads/governance/runtime-admission-source-successor-v2`        |
| Immutable S                 | `6863c4b6e9f17b3a668e0afb9ff33cb9046788d0`                           |
| Source tree                 | `ad779e35071d5673f931d44e2e1f8daf0547dc95`                           |
| Source workflow at S        | `.github/workflows/runtime-admission-source-successor-v2.yml`        |
| Dedicated source lock       | `26268325`, repository-owned, active, no bypass                      |
| Finite target               | PR389, pull ID `4996927699`, 40 owner commits, 47 changed file pairs |
| Target base B               | `c8f3e7ba220241f79292c84c72712653019aa1df`                           |
| Target head H               | `680192aed6f7c377bb639c637e0f29f09a2e20ec`                           |
| Target tree                 | `07bc1fee012e0068701f0810611938b3b0591eae`                           |
| Actual normal merge M       | `92616e3fdcf3f917fad3a9a99cee29607307ad7f`                           |
| Actual merge tree           | `07bc1fee012e0068701f0810611938b3b0591eae`, equal to the target tree |

## Genuine source qualification before the finite merge

Run `41195806761`, attempt 1, was a successful owner `push` on exact S and the
source ref. Jobs `qualify` (`124521600188`), `source` (`124522503306`) and
`publish` (`124522620078`) all succeeded. The source published its own
`runtime-admission-source-successor-v2` status as `success` on exact H, bound to
that run and attempt.

## Source-defined canaries

Both canaries were owner-opened, non-draft PRs against main whose heads carry
the inputless canary caller pinned to S. They are qualification evidence only
and are never merged.

| Canary   | PR   | Head                                       | Run, attempt             | Result                                              |
| -------- | ---- | ------------------------------------------ | ------------------------ | --------------------------------------------------- |
| Positive | #398 | `b3cce37831915a98af008bb2d35c7e292dff6c85` | `41196334810`, attempt 2 | `success`; attempt 1 was cancelled by a shared slot |
| Negative | #399 | `1ff6e5dd4f0c9664bd9ce88b46a71f1779f1ba92` | `41196355143`, attempt 1 | `failure`: `Protected input changed`                |

The negative head edits `governance/commit-author-identity.json`. With
runtime-v2 required beside v3, the negative PR was blocked and the runtime-v2
status on its head was `failure`.

## Finite main transition and merge

Main ruleset `19979783` was observed as v3, v3 plus runtime-v2, runtime-v2
alone, then back through runtime-v2 plus v3 to v3 alone. Identity ruleset
`24363205` and all other complete rulesets stayed unchanged apart from the new
source lock. App `15368`, strict and creation status enforcement, the four
unrelated contexts, PR parameters, linear history, deletion and
non-fast-forward restrictions and no bypass were preserved at every step. PR389
was merged by the owner merge guard, which verified owner binding and the
supplied commit message.

## Bounded installation proposal

The installation adds only these regular `100644` files:

1. `.github/workflows/runtime-admission-source-successor-v2-caller.yml`
2. `docs/decisions/0016-bounded-runtime-admission-source-successor-v2.md`
3. `governance/evidence/docs-source-successor/runtime-admission-source-successor-v2-installation.md`

The caller is generated and checked by the source-owned functions with literal
S. It has no inputs, inherited secrets, local checkout or commands. The earlier
source run targeted PR389 before its merge and cannot certify these files.

## Pending permanent cutover

No installer PR result, installed-main runtime-v2 result, installed-main
canary or required blocking proof is assigned here. The planned route adds
runtime-v2 while retaining v3, proves on the same negative head that the
installed runtime-v2 context is required and blocks mergeability, and only then
removes v3. If a phase fails, retain or re-add the old requirement before
removing the new one and stop dependent effects on drift. Rollback of installed
files requires a separately reviewed normal PR.

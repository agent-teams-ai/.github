# Runtime admission source successor v2 permanent cutover

Observation date: 2026-10-31

Scope: facts observed after the three-file installation snapshot. That
[installation snapshot](runtime-admission-source-successor-v2-installation.md)
stays unchanged.

## Installation merge

PR400 (`chore: install runtime admission source successor v2`) was merged by
the owner merge guard as `fa7d4b45136e5f0d15d37db3857b622aaa52a7a8` (tree
`3c2fa5a2892c6a3f535f8ac4390e7a721a30f2e5`, parent
`92616e3fdcf3f917fad3a9a99cee29607307ad7f`). It changed exactly the three
installation paths. The installed v3 ordinary route accepted it and all
required checks passed. Main push run `41198004537` on that commit succeeded.

## Installed-main canaries

Both canaries were owner-opened PRs against main, run through the installed
caller and immutable S `6863c4b6e9f17b3a668e0afb9ff33cb9046788d0`. Neither was
merged; both were closed afterwards.

| Canary   | PR   | Head                                       | Runtime-v2 run, attempt  | Result    |
| -------- | ---- | ------------------------------------------ | ------------------------ | --------- |
| Positive | #401 | `48ef7d0fa6ed67cabc85752ca308371e2196c4f6` | `41198041680`, attempt 1 | `success` |
| Negative | #402 | `15bb4806891bbd6c2f1f74f1dc5ef0b07a815e7e` | `41198047245`, attempt 1 | `failure` |

The negative head edits `governance/commit-author-identity.json`. With
runtime-v2 required beside v3 it was blocked. After v3 was retired, the PR was
ready and mergeable, every other required check had succeeded, and its
mergeability state was still blocked solely by the runtime-v2 failure.

The v3 context failed on the positive canary because its recheck snapshot
includes the pull request `updated_at`, which changed during verification.
This is a frozen v3 behavior, not a runtime-v2 result.

## Permanent cutover

Main ruleset `19979783` was observed as v3, then v3 plus runtime-v2, then
runtime-v2 alone. Identity ruleset `24363205` and all other rulesets were
unchanged, with no bypass. The final required contexts are `check`,
`trusted-admission-authority-evolution-v1`, `trusted-admission-evidence`,
`trusted-validation` and `runtime-admission-source-successor-v2`, all with
App `15368`, strict and creation enforcement preserved.

Canaries #398, #399, #401 and #402 and the superseded PRs #397, #390, #368,
#381 and #322 were closed without merging.

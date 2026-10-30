# Quality source successor: installed state

Operational audit as of 2026-10-25 for the Central governance consumer.
The immutable source and accepted decisions define the validation contract.
ADR0013 and its installation snapshot preserve their original pre-installation observation; this note records later operational evidence.

- Installation main: `3951acd4206761ca0c1575ef4a99dc70cd997246`, tree `6060ee7648fa70e67047c91fd4dc729e5d78a3d9` ([PR393](https://github.com/agent-teams-ai/.github/pull/393)).
- The installed caller pins source `c364ab2b82ad6250500110345982c3f1fa82181f` ([source workflow](https://github.com/agent-teams-ai/.github/blob/c364ab2b82ad6250500110345982c3f1fa82181f/.github/workflows/docs-quality-source-successor-v3.yml)).
- Main requires `docs-quality-source-successor-v3` from GitHub Actions App15368, the four existing main contexts, and the separate commit-author identity context. Strict checks and the existing creation, PR, linear-history, deletion and non-fast-forward rules remain enforced without bypass.
- Both immutable source branches remain protected by their existing locks. The v2 caller, source and historical evidence remain retained; its context is now optional.

On GitHub Free, App15368 alone does not authenticate the workflow source. The retained qualification binds the pinned source SHA, installed caller, actual run, and protected source refs.

## Observed qualification

[Installed-main CI40233055393](https://github.com/agent-teams-ai/.github/actions/runs/40233055393) passed the normal frozen install and full check: 5714 current tests and 9 frozen tests.

The two installed canaries used separate owner commits from the exact installation main:

- [Positive PR394](https://github.com/agent-teams-ai/.github/pull/394) changed only the reviewed README comment. [V3 run40233922757](https://github.com/agent-teams-ai/.github/actions/runs/40233922757/attempts/1) reported `noop` and published genuine success status57217193764.
- [Negative PR395](https://github.com/agent-teams-ai/.github/pull/395) changed only the reviewed ADR0013 comment. [V3 run40233932645](https://github.com/agent-teams-ai/.github/actions/runs/40233932645/attempts/1) rejected that protected path and published genuine failure status57217171973. Frozen v2 and all other required checks passed.

Adding only the v3 required context changed the unchanged negative PR from MERGEABLE/UNSTABLE to MERGEABLE/BLOCKED, with no draft, base, review-thread or other required-check confound. After removing only the old v2 required context, the positive PR had all six final required checks successful; the negative remained blocked solely by required v3 failure.

Both canaries were closed without merging; their branches and evidence were retained. No status was written manually and no source workflow was replayed. Eight unrelated optional historical-authority or ReviewRouter failures per canary remain classified separately from the decisive required checks.

This qualification closes the Central consumer source-successor installation lane. Other consumers retain their own adoption and qualification work.

# Runtime and admission source successor v1: operator activation

Status: unpublished candidate. No source-ref lock, defining source publication,
hosted successor run, new required check, bounded merge or permanent installation
is asserted. Existing requirements remain authoritative until each observed
transition below is completed. This procedure changes only the quality-source
requirement; `commit-author-identity` remains continuously required and unchanged.

## Exact reviewed target and separate source identities

The sole finite integration candidate is
[PR389](https://github.com/agent-teams-ai/.github/pull/389), combining the reviewed
PR368, PR381 and PR322 source histories. Its exact runtime binding is `TARGET`
and its complete regular before/after Git blobs are `TARGET_TUPLE` in
[`scripts/runtime-admission-source-successor-v1.ts`](../scripts/runtime-admission-source-successor-v1.ts).

| Coordinate | Bound candidate |
| --- | --- |
| Repository / ID | `agent-teams-ai/.github` / `1316243981` |
| Pull number / ID | `389` / `4996927699` |
| Base / tree | `e0f271740c13290b6bb729ffb79cb050253fc6b8` / `18731af97b2d4ac56952cae9e0a167e379a73344` |
| Head / tree | `ec790f9e12c29c32c7dad1ad683a7d56476cacd3` / `3d2e31d0c769f12d7132819192d4409143fe96f2` |
| Commits / complete changed files | `39` / `49` |
| Owner account | actual `User/777genius`, ID `13103045`, in both commit roles |
| Published admission runtime R | `a33b2c4a43b6ef0d1fb6457c534575a82e80493e` |

R is the separately published runtime pinned by the admission wrapper in H.
The separately reviewed defining successor commit S is not R or H. Publish and
read back the reviewed commit on `review/runtime-admission-source-successor-v1`
first; this does not activate its defining workflow. Only creation of the separate
governance source ref requires its lock to exist first. Never replace S with a
branch, an example SHA or the target head. Any target/base/blob
movement invalidates this finite exception and requires fresh source review.

The exact finite tuple permits its reviewed `scripts/quality-process.test.ts`
blob change. Every other `QUALITY_INPUTS` member remains unchanged. Ordinary,
reusable and permanent paths preserve all four quality helper inputs. Frozen v1,
v2 and previous installation records remain preserved. The ordinary route uses
the successor's reviewed relative verifier helper, including the new critical
runtime/schema/workflow census; editing candidate main alone does not install it.

## Review and qualify the complete source

Use the existing one-runtime/test/workflow/strict-project pattern from immutable
source `0a578f16502c82e6f488f8a5716bbb32d5abe63d`. The new defining workflow is
`.github/workflows/runtime-admission-source-successor-v1.yml`; its only published
context is `runtime-admission-source-successor-v1`. Automatic pnpm caching is
disabled: setup-node would otherwise invoke pnpm before the hook-free proof.
The workflow checks out `job.workflow_sha`,
never PR code, and has no command inputs or inherited secrets.

The qualification bootstrap changes the earlier hook-disabling mechanism
explicitly. Pinned pnpm11.18.0 with `verifyDepsBeforeRun: error` rejects valid
run/exec commands after an ignored-pnpmfile installation: plain commands see
pnpmfile-list drift; matching ignore configuration reaches a non-iterable
`currentPnpmfiles`. This is not a successful dependency-drift control.
The exact installed public pnpm distribution is the source for this observation:
[11.18.0 archive](https://registry.npmjs.org/pnpm/-/pnpm-11.18.0.tgz).

Before package-manager setup on **each** qualification and semantics runner,
the builtin-only `preflight` command:

1. Rejects ambient `PNPM_CONFIG_*` and `NPM_CONFIG_*` overrides, existing Linux
   global pnpm YAML configuration, and root/child default hook files or symlinks.
   The pinned Linux config-directory resolver uses `XDG_CONFIG_HOME/pnpm` or
   `~/.config/pnpm`; npmrc sources in pnpm11 supply registry/auth settings rather
   than executable YAML settings. No credential/config file contents are collected.
2. Binds the complete clean regular checkout to the actual source workflow SHA,
   then binds root package, lock, workspace and `.npmrc`, plus the three child
   installer controls, to their exact fetched reviewed-H Git blobs. Those reviewed
   controls contain no configuration dependencies. Unreviewed controls reject
   before a package-manager process can resolve configuration dependencies.
After that proof, pinned package-manager setup may perform its own self-update.
The pinned action bootstraps pnpm11.7.0 before selecting11.18.0; its
[self-update implementation](https://github.com/pnpm/action-setup/blob/008330803749db0355799c700092d9a85fd074e9/src/install-pnpm/run.ts)
can load global/configuration hooks. Both pinned pnpm resolvers use the same
truthy XDG fallback, including an empty-XDG fallback to the home directory.
The action's repository install and cache behaviors remain explicitly disabled. The complete
`bootstrap` command repeats the proof and then reads only scoped effective
pnpm hook/dependency/strictness metadata, with
hooks and lifecycle scripts ignored and frozen/offline configuration. It
requires no pnpmfile, global pnpmfile or configuration dependencies, strict
engines and peers, and `verifyDepsBeforeRun: error`. It rechecks source custody.

Only then does qualification perform the supported normal frozen root install,
the isolated child frozen no-script install and managed Node24 RE2 build.
It compiles the dedicated strict TS7 project, lints the exact source/test census,
exercises positive and rejecting controls, runs complete `pnpm check`, and binds
live source/run/target authority. Source-specific typed/census additions remain
checked, with every existing current and frozen test partition retained.
The separate semantics job keeps `--ignore-scripts --ignore-pnpmfile` and direct
Node execution; it never invokes broken run/exec verification. Only the publisher
has status-write permission and it rereads current decisive jobs and authority.

## Lock and qualify before changing required checks

An authorized owner-admin must first create and fully read back a dedicated
active repository branch ruleset matching exactly
`refs/heads/governance/runtime-admission-source-successor-v1`, no exclusions or
bypass actors, with update/deletion/non-fast-forward restrictions. Preserve the
old frozen v2 ref at `d2904ef5181b1a3f42da2b6fad7e5f7fccad1ecd`, its lock25469495,
and the owner-alias source lock25775630. Only after that full lock readback, create
the defining governance source ref once at the independently verified S already
published on the review branch. Never move or unlock the defining source to repair it.

Use the exported inputless canary generator to create exact S-pinned callers at
`.github/workflows/runtime-admission-source-canary.yml` on the sole allowed refs:
`qualification/runtime-admission-positive-v1` and
`qualification/runtime-admission-negative-v1`. Open owner-authored non-draft PRs.
The positive is ordinary documentation with stable installer controls; the
negative deliberately changes a newly critical protected input. Preserve exact
caller bytes and actual owner associations. If a push preceded its PR, obtain a
new genuine current-head push; missing PRs fail closed.

Retain actual source/caller refs, commits/trees, lock readbacks, run IDs/attempts,
qualify/source/publisher job and decisive-step conclusions, statuses/App binding,
timestamps and complete protections. A setup failure, local fixture, guessed
coordinate or manually posted green status is not hosted qualification. The
negative must fail the actual protected semantics after successful qualification.

## Main-only additive cutover and bounded merge

Read full main ruleset19979783 and identity ruleset24363205 with owner-admin
visibility. Main retains `check`, `trusted-admission-authority-evolution-v1`,
`trusted-admission-evidence`, `trusted-validation` and the old
`docs-quality-source-successor-v2`, all bound to App15368. Identity retains only
`commit-author-identity` from App15368. Preserve strictness, enforcement on
creation, default-branch scope, empty bypass actors and all existing PR rules.

`planProtectionTransition(main, identity, 'add')` is a pure proposal, not a remote
write or proof. It changes main only and preserves the complete identity object.
Apply only API-writable fields after review, then fully read back both rulesets.
While predecessor and successor are required, prove the same negative head is
required and blocked and the exact integration head has genuine current checks.
Only then render/apply `'retire'` and remove the replaced quality-source context.
Never remove or replace `commit-author-identity`, forge a predecessor success,
change App/scope/strictness or use merge bypass. Normally merge exact PR389 through
the owner guard and independently verify the actual resulting tree and metadata.

## Permanent caller installation and actual installed-main proof

Source-push qualification is run-bound bootstrap evidence. It does not provide
continuous PR-event enforcement or activate the new critical-input protection.
After bounded integration, separately prepare the existing three-additive-file
installation: the canonical S-pinned caller, the owned decision at
`docs/decisions/0015-bounded-runtime-admission-source-successor-v1.md`, and distinct
evidence at
`governance/evidence/docs-source-successor/runtime-admission-source-successor-v1-installation.md`.
Retain all predecessor callers and evidence bytes.

First prove the retained predecessor can admit ordinary operation and this
installation on the actual post-integration baseline. Add it back before removing
the temporary bootstrap requirement, with complete readbacks, then use the normal
installation PR. If that route fails, keep the current source requirement intact
and review a run-bound installation route; never create an unenforced interval.

After installation, run genuine ordinary-positive and critical-negative canaries
through the actual protected-main caller, including new-baseline root dependency
behavior and unchanged nested installer controls. Add the new requirement while
the predecessor remains, prove the required negative blocks, then retire only the
predecessor. Identity remains unchanged. Record subsequent observations separately
from immutable installation snapshots. Permanent enforcement is claimed only when
these actual installed-main runs and complete cutover readbacks exist.

Future nested Renovate upgrades remain protected installer-control transitions;
they do not enter the root-only registry dependency route. Current source tests
also retain the ordinary32-file limit and the existing bounded historical/Cohort
routes. The finite49-file integration does not enlarge those general permissions.

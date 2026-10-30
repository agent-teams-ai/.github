# Runtime/admission successor v2 — reviewed delivery plan

Status: implementation and qualification pending. Review-only source branch; do not merge into #389 or main.

## Fixed scope

Complete admission of PR389 without changing its green functional head `680192aed6f7c377bb639c637e0f29f09a2e20ec` (tree `07bc1fee012e0068701f0810611938b3b0591eae`) or base `c8f3e7ba220241f79292c84c72712653019aa1df` (tree `c3c61b8fd179a1cd203e6c893002a3fc127085e1`). Bind all 40 commit identities and all 47 changed regular-file pairs from real Git objects. Stop and re-review on drift.

The old #390 packet remains historical. Its v2-based activation payloads must never be applied to installed quality-source v3.

## Implementation

1. Reuse the prior runtime-admission source's checked bootstrap, provenance, complete-tree, commit identity and publication mechanisms. Publish a distinct runtime-admission v2 source; do not mutate any locked or historical implementation.
2. Retain byte-exact quality v3/v2 implementations from `c364ab2b82ad6250500110345982c3f1fa82181f`. Delegate ordinary, dependency and historical semantics to those actual implementations, with tests proving their byte identities. The new finite route admits only PR389's exact reviewed tuple.
3. Preserve v3 toolchain/tsconfig and four process/test helper protections on ordinary routes. Add the newly transitive compiler, admission, registration, remote-observation, identity-template and isolated-installer inputs. Preserve all legacy authority bytes. The finite route does not grant a general exception for those inputs.
4. Retain inert metadata preflight before pnpm setup or any cache command. Install the source-owned frozen graph, never target code. Use current Stack-owned tools; do not restore root tool pins or weaken strict checks.
5. Keep source, target, run/attempt, PR ownership, source locks and current protection observations separate. Only the new context may be published. Verify decisive jobs and re-read live identities before success.

## Verification and review

Run focused accepting/rejecting cases, strict compilation, current lint, full source `pnpm check` and fresh hosted bootstrap. Include wrong PR/head/base/tree/commit set, omitted files, protected input add/change/remove/symlink, stale v2 protections, missing bypass evidence, source/target drift, skipped decisive jobs and canonical caller rejection. Record real results and exact source identity; fixtures are not hosted qualification. Review the implementation and transition separately, fix findings, and retain the actual review result.

## Activation and final acceptance

With owner Administration(write) and full fresh ruleset readback: create the dedicated no-bypass source lock before publishing its defining ref; obtain genuine source qualification; run positive and protected-negative canaries; add the successor requirement before retiring only quality v3, with identity and all unrelated protections unchanged. Require a real positive result and required negative blocking proof. Merge #389 through its owner guard only after exact-head checks. Install only the canonical caller, decision and evidence in a separate PR, then verify installed-main behavior. Close historical integration/source PRs only after actual completion.

The available connector currently exposes ruleset reads, not administration writes; browser control is not exposed in this chat. This is an execution limitation, not permission to weaken enforcement or claim activation. No source lock, cutover, canary or merge is claimed by this plan.

# ADR-0013: Bounded owner identity source successor v1

Status: Prepared source; hosted qualification and activation pending

Date: 2026-10-23

Decision owner: Organization governance

## Purpose and authority

The owner-approved account-association change in PR380 replaces two protected
inputs. The current `commit-author-identity` implementation and immutable
`docs-quality-source-successor-v2` cannot certify their own replacement.
This source is a separately reviewed, bounded successor for both authorities.
It publishes only its new context. It never publishes predecessor success,
changes rulesets, executes a PR checkout, or treats local tests as hosted proof.
The existing frozen v1/v2 sources, installed callers, ADRs and evidence remain
unchanged. Ordinary and dependency source semantics continue through the real
frozen v1 verifier, with v2's additional immutable inputs preserved.

## Exact admission and execution

The sole protected-input exception is PR380, pull ID `4975429125`, based on
`86a85d6beda07e6e5ee7806646f700bc4e4db173`, head
`1f8dc7a2ee33e3cc3810f0c4c2d5e9f3f20241d0`, tree
`3ff66e7c29253efd950e513e6e01fe148fc52632`. The complete eight-path before/after
blob tuple, regular-file modes and complete rehashed Git trees are source-owned.
The local reviewed commit `1989e195acddceb4af0dc2e167b51fb6771d9a65` has that
same target tree but is not substituted for the published head identity.
Other protected source edits fail closed. PR381 requires a new reviewed tuple
after any base/head change; this source grants no blanket profile exemption.

Source execution must be checked out from the actual defining workflow SHA on
a separately locked source ref. Genuine event/run/attempt, workflow references,
complete current jobs, target repository/actor/base/head and visible protections
are independently read and reread before its own status may succeed.
GitHub account associations govern owner source admission in every route;
malformed, Bot, Codex/OpenAI and technical owner source metadata remain rejected.
External human attribution remains with its existing flow. A same-head Bot PR
blocks success. No raw owner string supplies account authority.

## Bootstrap and genuine canaries

Installing a default-branch caller first would move main and invalidate the
reviewed PR380 base. Therefore the initial protected source push qualifies that
exact existing target. A separate canonical inputless push caller on a dedicated
same-repository qualification branch can exercise a real protected-input
negative PR without executing its head code. Its actual push SHA, canonical
caller bytes, defining immutable source and unique live PR are verified.
The negative case must produce a real failed source job and failed new context.
A local synthetic rejection or a manually written status is not that canary.

An owner with ruleset administration must retain full source/main/identity
observations, lock the reviewed source, and qualify the genuine positive and
negative heads. Add the new Actions context (integration `15368`) to both main
and identity requirements before removing either predecessor. Read back the
complete objects after each write and prove the same negative head is blocked.
Preserve all unrelated contexts, strictness, default-branch scope, PR rules and
no-bypass restrictions. There is no administrator merge bypass.

After the bounded merge, normally merge the canonical main caller, this ADR
and a separate truthful installation snapshot through the restored ordinary
predecessor route if the permanent caller is not yet installed. Add predecessors
before removing a temporary successor requirement. Observe installed-main
positive and negative canaries, then perform the same additive permanent cutover.
Any base drift requires fresh target review and a new protected source revision.

The source-owned operator procedure at
`docs/owner-identity-source-successor-v1-activation.md` records the review, canary and add-before-remove sequence without inventing
hosted coordinates. Its proposal generator performs no protection writes.

## Current limits

This prepared source is not installed and has no assigned hosted run, job,
canary, source-lock or installation coordinates. The current GitHub connector
has no ruleset-administration operation. Publication, hosted qualification,
owner-full protection observations and the actual add-before-remove transition
remain operator work. Stop with predecessors intact if any proof is unavailable.

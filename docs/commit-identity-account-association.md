# Owner commit identity account-association migration

Status: proposed implementation; protected-source and required-check cutover pending.

The owner-approved rule uses GitHub REST commit account associations for both
source roles. The maintained policy records
`owner.source_identity: github-user-association` and keeps `schema_version: 1`.
Its `name` and `email` remain the preferred local identity for generated commits
and the explicit squash email. They are no longer owner source admission keys
in the successor implementation. Existing immutable workflow pins ignore the
additive field and retain their original exact raw-identity behavior.

## Admission contract

| Case | Successor result |
| --- | --- |
| Both author and committer are REST `User/777genius`; valid Cyrillic display name or alternate email | Admit |
| Raw `777genius`, canonical owner email, or unassociated canonical owner name without both owner accounts | Reject |
| Owner author plus foreign/null/technical committer, or foreign/null author plus owner committer | Reject |
| Owner-associated raw Bot/GitHub or known Codex/OpenAI identity in either role | Reject |
| External human contribution with original attribution, including its GitHub technical committer | Preserve through the external contributor flow; owner squash refuses it |
| Final squash author associated with owner and valid human metadata | Admit after independently verifying actual merge and exact full message |
| Final committer `User/web-flow` with exactly `GitHub <noreply@github.com>` | Admit only for the final squash |

Association is provider metadata, not a cryptographic signature or proof of
human authorship. No contributor source history is rewritten to manufacture it.
The reusable workflow still reads only trusted metadata and inert caller bytes.
Pagination, the 250-commit bound, live head/base/actor rereads, same-head Bot-PR
rejection, immutable caller/implementation checks and policy drift checks remain
required. The merge guard keeps the reviewed message/body bytes, explicit head
match, post-merge reconciliation and no-retry-on-uncertainty behavior.

## Concrete cutover limitation

Changing `.github/workflows/commit-author-identity-check.yml` is deliberately
rejected by the current identity check's central local reusable-workflow
self-protection. The installed
`.github/workflows/docs-quality-source-successor-v2-caller.yml` also delegates to
immutable source `d2904ef5181b1a3f42da2b6fad7e5f7fccad1ecd`, whose protected-input
policy covers the identity workflow and policy. Neither check can certify its
own replacement by executing the replacement from this PR. Keeping canonical
local Git metadata can satisfy the old author rule; it does not solve either
protected-source rejection.

The frozen installation ADR, installation evidence, old verifier and old workflow
pins stay unchanged. The current connector can read repository protections but
cannot administer rulesets. This proposal therefore supplies a reviewable
implementation and regression evidence, not an assertion that the old checks
will pass or that enforcement has changed.

## Required reviewed transition

1. Review the exact implementation diff and target base/head/tree tuple. Prepare
   a separate immutable successor source that binds that tuple, executes trusted
   source-owned code and preserves all unchanged enforcement boundaries. Its
   scope must address both affected authorities; a generic bypass is not a
   successor. Review and protect its immutable source ref before trusting it.
2. Qualify the real successor source run and its exact workflow/source/run/attempt,
   decisive jobs and target head. Observe a genuine positive case and a genuine
   protected-input negative case. Record subsequent evidence separately from
   frozen installation records. A local fixture pass or manual status write is
   not hosted qualification.
3. With owner-admin capability, read full current main, identity and successor
   source rulesets. Add the reviewed successor required context from GitHub
   Actions integration `15368` while retaining each predecessor. Read back the
   complete objects, preserving unrelated checks, active default-branch scope,
   strictness, PR rules and no bypass actors.
4. Prove the negative head is blocked by the required successor and the positive
   head has genuine current checks. Only then remove the replaced predecessor
   contexts through the reviewed bounded transition. Never forge a predecessor
   success, disable protection or use an administrator merge bypass.
5. Merge through the fresh owner guard with the reviewed head and full message.
   Independently verify the actual final PR/commit identity and message. Observe
   installed-main positive and negative canaries before claiming permanent
   successor enforcement. Consumer repositories then review explicit immutable
   workflow pin upgrades; central publication never silently changes their rule.

If source qualification, owner-admin access, readback or a canary is unavailable,
retain the prior required checks and report the pending step. A green local
suite is functional evidence only. It neither grants merge authority nor proves
live required-check enforcement.

## Local verification

Focused regression command:

```sh
node --test scripts/commit-author-identity.test.mjs scripts/merge-owner-pr.test.mjs scripts/onboard-commit-author-identity.test.mjs
```

The full repository route remains `pnpm check` on the repository's pinned Node
and pnpm toolchain. Tests use disposable fake transports for effectful merge
cases and do not publish statuses, alter rulesets or contact GitHub.

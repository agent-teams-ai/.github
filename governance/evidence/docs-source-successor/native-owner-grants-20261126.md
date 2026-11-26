# Native owner PR-only grants — 2026-11-26 UTC

At 15:12–15:13 UTC the authenticated GitHub user `777genius`, ID `13103045`,
installed the exact actor `{ "actor_id": 13103045, "actor_type": "User",
"bypass_mode": "pull_request" }` in these ten repository rulesets:

| Repository | Ruleset IDs |
| --- | --- |
| `.github` | `19979783`, `24363205` |
| `engineering-foundation` | `19979782`, `24372286` |
| `agent-runtime` | `24363207` |
| `agent-teams-platform` | `24363204` |
| `agent-teams-orchestrator` | `19979784`, `24363212` |
| `extension-foundation` | `20807525`, `24363213` |

Each write followed a fresh ruleset and repository inventory comparison, then an
independent owner-session GET. Every target returned the exact actor and
`current_user_can_bypass: pull_requests_only`. The owner held administrator
permission in all six repositories. The PUT sequence was not an atomic
transaction; its read/write windows do not prove the absence of transient drift.

The final comparison completed at 15:13:46 UTC. It compared the full payloads
of all 21 rulesets across the six repositories and `engineering-research`:
the ten targets differed only in the requested actor and corresponding
owner-reader result, plus update time; all eleven excluded rulesets were
unchanged. The seven repository ruleset ID/source inventories and organization
and repository Actions workflow permissions were unchanged. Actions PR review
approval remained false. Engineering Foundation retained CodeQL App `57789`;
Runtime's pre-existing owner `always` grant and history rule were unchanged.
Research received no grant. Classic main protection returned 404 in all seven
repositories before installation; the observed repository rulesets enforce the
applicable protection.

The protected v4 source ref still pointed to
`72fa7a8af02e9ba7904c912f0bbb457254381002`; lock `28123607` was unchanged.
The current `assertIdentityRuleset` passed for all six actual owner-full
identity readbacks, using the canonical policy and owner profile. The exact v4
source's `assertMainProtection` passed on Central's actual main and identity
readbacks with `owner_full`. These validators also accept the no-grant state;
the separate exact actor and owner-reader assertions above establish installation.
The canonical onboarding default remains no bypass.

This is a dated settings and validation observation, not proof of a practical
early merge or postmerge CI. The prior
[permanent-enforcement and deferred-delivery snapshot](runtime-admission-source-successor-v4-permanent-owner-delivery-20261126.md)
retains its historical observations. The native grant is not restricted to
Markdown by GitHub; use is limited to explicitly assigned, reviewed
documentation or a broader scope separately authorized by the owner.

## First practical merge observation

[PR #435](https://github.com/agent-teams-ai/.github/pull/435) merged at
`2026-11-26T15:21:10Z` by `777genius`, with reviewed head
`d317c3f7cd55ccb7575bd85c9fa4d6776e33562c`, base and resulting sole parent
`5d8bc6ab30d401d5282d830a700673a463bf4f88`, resulting commit
`8abe1f803939d93372a150f3a68fb1c2097b1242`, and tree
`d34bf34fd1cb1dd21e913a2a9cbe1ff3f73924a6` matching the reviewed head. Its
GitHub-linked owner author used `iliyazelenkog@gmail.com`; GitHub was the
committer. The full squash message was:

```text
docs: record native owner grant readbacks

Record the ten installed native owner PR-only grants, owner readbacks, preservation comparison and existing validator results. Update maintained guidance while retaining the earlier historical evidence.
```

Genuine v4 [run 45847358642/1](https://github.com/agent-teams-ai/.github/actions/runs/45847358642/attempts/1),
job `140004380489`, on that head was still executing at merge. Its qualifier
subsequently failed `Live protected main moved` at `15:23:30Z`, and its
publisher failed `Invalid live source PR metadata` at `15:23:46Z`. These are
actual failures on the closed target; they were not retried. An earlier v4
[run 45847301244/1](https://github.com/agent-teams-ai/.github/actions/runs/45847301244/attempts/1)
had already published success at `15:20:39Z`. The latest identity pending
status at `15:20:41Z` became success at `15:20:45Z`, before merge.

GitHub rule suite `5390755376` recorded `pass`, including both required-check
rules, rather than a bypass. This observation establishes that one genuine
applicable v4 execution remained running, but does not establish that the
owner exception bypassed a blocking required check. Practical bypass
qualification remained outstanding at this cutoff.

The resulting main passed [Node 26 CI 45848232698/1](https://github.com/agent-teams-ai/.github/actions/runs/45848232698/attempts/1)
and [Node 24 compatibility 45848232407/1](https://github.com/agent-teams-ai/.github/actions/runs/45848232407/attempts/1),
both on exact resulting SHA `8abe1f803939d93372a150f3a68fb1c2097b1242`.
This is a Central observation, not separate E2E qualification of the other five
repositories.

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

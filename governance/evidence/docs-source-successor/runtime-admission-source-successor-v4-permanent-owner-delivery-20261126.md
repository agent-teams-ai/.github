# Governance admission v4: permanent enforcement and deferred owner delivery

Observation cutoff: `2026-11-26T13:20:50Z`. All timestamps below are UTC on
2026-11-26 unless a different date is stated. Earlier observations retain their
stated cutoff; later successful attempts do not erase earlier failures.

Scope: completed Central governance-admission v4 source, compatible policy,
installation and permanent enforcement, with the ten native owner grants and
actual early-merge qualification explicitly deferred by the owner. This v4
mechanism is not Agent Runtime v3, live extension updates or product-scale
qualification. The current documentation checkpoint uses ordinary protected
merge; this record does not claim that native no-wait merge is installed.

This dated snapshot records facts observed before the documentation PR's own
merge. Its later merge and postmerge results belong to that PR's receipt.
The [installation snapshot](runtime-admission-source-successor-v4-installation.md),
[ADR-0018](../../../docs/decisions/0018-bounded-runtime-admission-source-successor-v4.md)
and earlier source/cutover evidence retain their original bytes and claims.

## Source, finite transition and installation

The immutable source S is
`72fa7a8af02e9ba7904c912f0bbb457254381002`, tree
`e762ed1328421970e92acc5d3639f7235bbbcd04`, on
`refs/heads/governance/runtime-admission-source-successor-v4`.
The dedicated repository-owned [source lock 28123607](https://github.com/agent-teams-ai/.github/rules/28123607)
was created at 00:34:21, before publication. Its exact branch scope has no
exclusions and its update, deletion and non-fast-forward restrictions have no
bypass actors. Owner-full observation was `current_user_can_bypass: never`;
the canonical source ref was protected and unchanged.

The genuine source push [run 45730526165, attempt 1](https://github.com/agent-teams-ai/.github/actions/runs/45730526165/attempts/1)
began at 00:41:31 and completed SUCCESS at 00:46:41. Actual checkout was S.
Qualifier job `139611107577` passed 70 dedicated tests, 5,939 current tests and
9 frozen tests with zero failures, cancellations, skips or TODOs; source job
`139612302756` and publisher `139612703099` succeeded. Status `59928307464`
published v4 SUCCESS on the policy head
`9dff206369649d9eb7a76edc1943461fde837739` at 00:46:35.

The original source canaries used base B
`755c8515a5d106402a7e9e2cff621fb1fdc855cf`:

| Observation | Actual coordinates and outcome |
| --- | --- |
| Source positive [#426](https://github.com/agent-teams-ai/.github/pull/426) | Head `5981b02a8e85222d18364395ce7abaddcef31dd0`; [run 45731268148/1](https://github.com/agent-teams-ai/.github/actions/runs/45731268148/attempts/1) completed SUCCESS at 00:53:03; jobs `139613571026` qualifier, `139615183118` source no-op, `139615434859` publisher; status `59928628449` SUCCESS |
| Source negative [#427](https://github.com/agent-teams-ai/.github/pull/427) | Head `1daf0333bde7438a883b8656440c39a484ba8010`; [run 45731273621/1](https://github.com/agent-teams-ai/.github/actions/runs/45731273621/attempts/1) completed FAILURE at 00:57:12; qualifier `139613591777` SUCCESS; source `139616851104` rejected `Protected input changed: governance/commit-author-identity.json`; publisher `139617081919` rejected current-attempt source failure; status `59928839075` FAILURE |
| First v2+v4 bridge | Full owner readback at 00:59:20.707: add only required v4/App `15368` to main rule `19979783`, retaining v2, the other four main contexts, identity rule `24363205` and all other fields; both bypass lists remained empty |
| Required negative observation | Same Ready/open/unmerged #427 head above: v4 FAILURE and v2 FAILURE both displayed Required; squash merge disabled; API `mergeable: true` with `mergeable_state: blocked` |
| Finite v4-only stage | At 01:03:04.817 remove only v2 from the already installed v2+v4 bridge; preserve v4, the other four main contexts, identity and all non-context fields |
| Policy [#423](https://github.com/agent-teams-ai/.github/pull/423) | Ordinary protected squash at 01:04:22; actual M `e35df6a3fcf4d5e33d0f79b5b27c3a3e454b5d56`, sole parent B, tree `fd7d6388cabf8cb86284478213541e66b75bdda9`; exactly the five reviewed compatibility blobs; no bypass used |
| M postmerge checks | [Node 26 run 45733204616/1](https://github.com/agent-teams-ai/.github/actions/runs/45733204616/attempts/1), job `139620049142`, and [Node 24 run 45733204528/1](https://github.com/agent-teams-ai/.github/actions/runs/45733204528/attempts/1), job `139620048644`: actual M checkout and full `pnpm check` SUCCESS; each 5,807 current + 9 frozen tests, zero failure/cancellation/skip/TODO |
| Restore predecessor | At 01:12:26.207 add v2 beside temporary v4 before retirement; at 01:13:08.289 remove only temporary v4, restoring the ordinary v2 requirement for installation |
| Source canary disposition | #426 closed unmerged at 01:05:45; #427 closed unmerged at 01:05:47 |
| Three-file installation [#428](https://github.com/agent-teams-ai/.github/pull/428) | Ordinary protected squash at 01:49:19; actual N `7ad5abbf5a8dade79f91f3e6f06481070b966a9e`, sole parent M, tree `9f0217f6978b615ef02dba05edf01e0c957635c4`; all 411 prior leaves retained and exactly three regular files added |
| N postmerge checks | [Node 26 run 45738318876/1](https://github.com/agent-teams-ai/.github/actions/runs/45738318876/attempts/1) and [Node 24 run 45738318958/1](https://github.com/agent-teams-ai/.github/actions/runs/45738318958/attempts/1): actual N checkout and full `pnpm check` SUCCESS; each 5,807 current + 9 frozen tests, zero failure/cancellation/skip/TODO |

Both original canary qualifiers passed 70 dedicated + 5,939 current + 9 frozen
tests with zero failures, cancellations, skips or TODOs. The negative source and
publisher remain actual failures; their exact rejecting outcome is the evidence
for protection. Neither canary was merged.

During both restoration observations, main remained actual M. The central
identity rule, all bypass lists and all non-context fields were unchanged.
Source S and lock `28123607` remained protected and unchanged. The production
`planProtectionTransition` helper checked the ordered owner-full observations.

Both final squash commits M and N have raw author `Илия`
`<iliyazelenkog@gmail.com>`, associated account `777genius`, and GitHub's
technical final committer `GitHub <noreply@github.com>` / `web-flow`.
Their complete supplied messages and issue references were read back from the
actual commits. This final squash exception does not apply to source commits.

The installation's reviewed head was
`c94159089a1f911676530c274c49e18604039c12`. Its exact installed blobs are:

| Path | Git blob |
| --- | --- |
| `.github/workflows/runtime-admission-source-successor-v4-caller.yml` | `344db84f573c2ac850ee1d4ac963441c8625dace` |
| `docs/decisions/0018-bounded-runtime-admission-source-successor-v4.md` | `85f818ae285d132ae58eaf775ce552c582ed7789` |
| `governance/evidence/docs-source-successor/runtime-admission-source-successor-v4-installation.md` | `ec88ad471820d3fcce2ace83c8bcde68b29e0049` |

All six required premerge contexts succeeded. The latest v2 run
[45736925633/1](https://github.com/agent-teams-ai/.github/actions/runs/45736925633/attempts/1)
and status `59931155732` succeeded. The installation head had 102 terminal
workflow runs: 23 SUCCESS and 79 historical optional FAILURE. Required success is
not a claim that every retained workflow passed.

## Installed-main qualification and permanent enforcement

These two new canaries start from actual installed N. Each has one changed file
and no temporary push-canary workflow. Their actual
[main caller](https://github.com/agent-teams-ai/.github/blob/7ad5abbf5a8dade79f91f3e6f06481070b966a9e/.github/workflows/runtime-admission-source-successor-v4-caller.yml)
pins the literal immutable S above.

| Observation | Actual coordinates and outcome |
| --- | --- |
| Installed-main positive [#429](https://github.com/agent-teams-ai/.github/pull/429) | Head `1e3f86aa03d02fc52ca9b9a3b00037ece87d0b8f`, sole parent/base N, Ready; opened at 01:54:31; genuine edited [run 45738909134/1](https://github.com/agent-teams-ai/.github/actions/runs/45738909134/attempts/1), created 01:54:49, completed SUCCESS 02:04:35; jobs `139638791529` qualifier, `139641884087` source and `139642108537` publisher all SUCCESS; source no-op at 02:04:01.9359391; status `59931966162` SUCCESS at 02:04:29 |
| Installed-main negative [#430](https://github.com/agent-teams-ai/.github/pull/430) | Head `37b81fc178381460edbf04a5374d5bff059b31c1`, sole parent/base N, Ready; opened at 01:54:38; genuine edited [run 45738922765/1](https://github.com/agent-teams-ai/.github/actions/runs/45738922765/attempts/1), created 01:54:57, completed FAILURE 02:04:14; qualifier `139638840243` SUCCESS; source `139641774338` FAILURE `Protected input changed: governance/commit-author-identity.json` at 02:03:42.9405834; publisher `139641985092` FAILURE `Current-attempt source did not succeed`; status `59931951077` FAILURE at 02:04:09 |
| Earlier natural-event observations | Positive opened run [45738883673/1](https://github.com/agent-teams-ai/.github/actions/runs/45738883673/attempts/1): qualifier 70 + 5,939 + 9 PASS, source FAILURE `Target or main protections changed during verification`; fingerprints differed only in PR `updated_at` 01:55:58 → 01:58:06, with the same head/base/draft/protections/commit identities. App `15368` status `59931698580` FAILURE at 01:58:37. This metadata race is not semantic PASS. All four observed v4 event runs were terminal by 02:05:11; no manual rerun |
| Earlier negative opened event | [opened run 45738894768/1](https://github.com/agent-teams-ai/.github/actions/runs/45738894768/attempts/1): qualifier `139638744573` PASS 70 + 5,939 + 9 with strict v4 compilation and normal typecheck; actual reusable-mode source S/tree e762, caller/base N and this head; source `139640395985` FAILURE `Protected input changed: governance/commit-author-identity.json` at 01:59:51; publisher `139640540333` FAILURE `Current-attempt source did not succeed`; App `15368` status `59931769158` FAILURE at 02:00:16 |
| Second v2+v4 bridge | Saved 02:06:47.356; independent fresh read 02:07:23 and exact production S helper PASS. Add only required v4/App `15368` beside v2; all other full main fields, identity and source lock unchanged; no bypass; actual main N and source S retained. |
| Required installed-main negative observation | At 02:09:00, Ready/open/unmerged #430 on exact head `37b81fc178381460edbf04a5374d5bff059b31c1`: UI v4 row FAILURE marked Required and linked to `45738922765/attempts/1`; Squash and merge disabled; actual commit link matched the full head. API `mergeable: true`, `mergeable_state: blocked`. |
| Permanent v4 requirement | Saved 02:10:28.002; root owner-full readback at 02:10:51 and independent fresh main read 02:10:55 followed by identity/source-lock/ref reads. Exact production S `assertMainProtection` and `planProtectionTransition(..., "retire")` checks PASS: remove only required v2 from the verified bridge; every other full main field, identity and source lock retained; bypass lists empty and owner readers `never`; actual main N/source S unchanged. Grants were not yet installed. |
| Installed-main canary disposition | Negative #430 closed unmerged at 02:11:22; positive #429 closed unmerged at 02:11:26; both exact heads unchanged. |

Both final runs executed in reusable mode with source S/tree
`e762ed1328421970e92acc5d3639f7235bbbcd04`, caller workflow SHA/base N and their
exact current heads. The positive bind at 02:03:17.1606518 followed its Ready
observation window 01:54:32–35; the negative bind at 02:03:01.9609603 followed
01:54:39–41. Each qualifier passed 70 dedicated + 5,939 current + 9 frozen tests
with zero failures, cancellations, skips or TODOs, the dedicated strict v4
compilation and normal typecheck. All three job check-runs in each final run
were issued by GitHub Actions App `15368`; each final status targets its exact
run attempt.

The later runs arose from genuine PR events; no manual rerun or manufactured
pending check is evidence. Qualification binds the exact run attempt, source
checkout, installed main caller and unchanged head/base. A failure remains a
failure even when its rejecting reason is expected. Required v4 failure and
blocked merge state belong to the same negative head; Draft state and optional
failures are not blocking proof.

The ordinary content checks were independently inspected through complete job
logs and actual synthetic Git checkout objects:

| Canary | Node 26 | Node 24 | Actual checkout and tree |
| --- | --- | --- | --- |
| Positive #429 | [45738883427/1](https://github.com/agent-teams-ai/.github/actions/runs/45738883427/attempts/1), job `139638703289`, SUCCESS | [45738883423/1](https://github.com/agent-teams-ai/.github/actions/runs/45738883423/attempts/1), job `139638703075`, SUCCESS | `42b99e2fabbf60fbccbbdd8089c954c49c3f04fe`; tree `00cb17ff5c1cce464b15f9f88d4b66e6d53cad85`; parents N and positive head |
| Negative #430 | [45738894431/1](https://github.com/agent-teams-ai/.github/actions/runs/45738894431/attempts/1), job `139638739550`, SUCCESS | [45738894401/1](https://github.com/agent-teams-ai/.github/actions/runs/45738894401/attempts/1), job `139638739516`, SUCCESS | `c62f3bdbe35d54d677ce7b92e25991d35911d8a7`; tree `3db76d5a91a774b90d7b12456485a42e71f0c814`; parents N and negative head |

Each of these four runs completed normal frozen installation, the isolated
Renovate installation, its managed native prerequisite, strict typecheck and
full `pnpm check`: 5,807 current + 9 frozen tests passed with zero failures,
cancellations, skips or TODOs. These content results do not replace v4's
protected-input admission result.

At 02:05:43, the complete paginated Actions workflow-run inventory was terminal
for both heads: positive #429 had 104 runs (71 SUCCESS, 31 FAILURE,
2 CANCELLED); negative #430 had 104 (65 SUCCESS, 37 FAILURE, 2 CANCELLED).
These are workflow runs, not check-run counts. Both inventories reconciled the
two pages of 100 + 4 unique IDs to the API total. The failures and cancellations
retain their actual outcomes; successful content checks and the exact canary
receipts above do not imply every retained workflow succeeded.

The final central main contexts are the four retained contexts
`check`, `trusted-admission-authority-evolution-v1`,
`trusted-admission-evidence`, `trusted-validation`, plus
`runtime-admission-source-successor-v4`, each App `15368`.
The separate identity rule still requires `commit-author-identity` from the
same App. Strict current-base and creation enforcement, the PR rule, linear
history, deletion and non-fast-forward protections retain their observed
values. The v2 source, caller and records remain retained.

The following full API objects retain their original fields. The bridge main
object is reconstructed from `v2_before_main` by applying its `replace` map
and deleting its `remove` keys; the permanent main object uses the same
operation on the reconstructed bridge. The common identity and source-lock
objects are unchanged at all three stages. Both reconstructions were compared
with the complete actual readbacks. These are recorded observations, not update
payloads.

```json
{
  "bridge_observed_at_utc": "2026-11-26 02:09:00 UTC",
  "permanent_observed_at_utc": "2026-11-26 02:10:51 UTC",
  "v2_before_main": {
    "id": 19979783,
    "name": "Protect main",
    "target": "branch",
    "source_type": "Repository",
    "source": "agent-teams-ai/.github",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "required_linear_history"
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": true,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "check",
              "integration_id": 15368
            },
            {
              "context": "trusted-admission-authority-evolution-v1",
              "integration_id": 15368
            },
            {
              "context": "trusted-admission-evidence",
              "integration_id": 15368
            },
            {
              "context": "trusted-validation",
              "integration_id": 15368
            },
            {
              "context": "runtime-admission-source-successor-v2",
              "integration_id": 15368
            }
          ]
        }
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": true,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": true,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "squash"
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec5OdEoNzgEw3gc",
    "created_at": "2026-07-29T18:09:16.022+03:00",
    "updated_at": "2026-11-26T03:13:08.289+02:00",
    "bypass_actors": [],
    "current_user_can_bypass": "never",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/agent-teams-ai/.github/rulesets/19979783"
      },
      "html": {
        "href": "https://github.com/agent-teams-ai/.github/rules/19979783"
      }
    }
  },
  "identity_at_all_three_states": {
    "id": 24363205,
    "name": "Commit author identity",
    "target": "branch",
    "source_type": "Repository",
    "source": "agent-teams-ai/.github",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": true,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "commit-author-identity",
              "integration_id": 15368
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec5OdEoNzgFzwMU",
    "created_at": "2026-10-02T15:23:08.317+03:00",
    "updated_at": "2026-10-24T11:54:20.747+03:00",
    "bypass_actors": [],
    "current_user_can_bypass": "never",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/agent-teams-ai/.github/rulesets/24363205"
      },
      "html": {
        "href": "https://github.com/agent-teams-ai/.github/rules/24363205"
      }
    }
  },
  "bridge_main_delta_from_v2_before": {
    "replace": {
      "rules": [
        {
          "type": "deletion"
        },
        {
          "type": "non_fast_forward"
        },
        {
          "type": "required_linear_history"
        },
        {
          "type": "required_status_checks",
          "parameters": {
            "strict_required_status_checks_policy": true,
            "do_not_enforce_on_create": false,
            "required_status_checks": [
              {
                "context": "check",
                "integration_id": 15368
              },
              {
                "context": "trusted-admission-authority-evolution-v1",
                "integration_id": 15368
              },
              {
                "context": "trusted-admission-evidence",
                "integration_id": 15368
              },
              {
                "context": "trusted-validation",
                "integration_id": 15368
              },
              {
                "context": "runtime-admission-source-successor-v2",
                "integration_id": 15368
              },
              {
                "context": "runtime-admission-source-successor-v4",
                "integration_id": 15368
              }
            ]
          }
        },
        {
          "type": "pull_request",
          "parameters": {
            "required_approving_review_count": 0,
            "dismiss_stale_reviews_on_push": true,
            "required_reviewers": [],
            "require_code_owner_review": false,
            "dismissal_restriction": {
              "enabled": false,
              "allowed_actors": []
            },
            "require_last_push_approval": false,
            "required_review_thread_resolution": true,
            "require_extra_approval_for_unattributed_changes": true,
            "allowed_merge_methods": [
              "squash"
            ]
          }
        }
      ],
      "updated_at": "2026-11-26T04:06:47.356+02:00"
    },
    "remove": []
  },
  "permanent_main_delta_from_bridge": {
    "replace": {
      "rules": [
        {
          "type": "deletion"
        },
        {
          "type": "non_fast_forward"
        },
        {
          "type": "required_linear_history"
        },
        {
          "type": "required_status_checks",
          "parameters": {
            "strict_required_status_checks_policy": true,
            "do_not_enforce_on_create": false,
            "required_status_checks": [
              {
                "context": "check",
                "integration_id": 15368
              },
              {
                "context": "trusted-admission-authority-evolution-v1",
                "integration_id": 15368
              },
              {
                "context": "trusted-admission-evidence",
                "integration_id": 15368
              },
              {
                "context": "trusted-validation",
                "integration_id": 15368
              },
              {
                "context": "runtime-admission-source-successor-v4",
                "integration_id": 15368
              }
            ]
          }
        },
        {
          "type": "pull_request",
          "parameters": {
            "required_approving_review_count": 0,
            "dismiss_stale_reviews_on_push": true,
            "required_reviewers": [],
            "require_code_owner_review": false,
            "dismissal_restriction": {
              "enabled": false,
              "allowed_actors": []
            },
            "require_last_push_approval": false,
            "required_review_thread_resolution": true,
            "require_extra_approval_for_unattributed_changes": true,
            "allowed_merge_methods": [
              "squash"
            ]
          }
        }
      ],
      "updated_at": "2026-11-26T04:10:28.002+02:00"
    },
    "remove": []
  },
  "source_lock_unchanged": {
    "id": 28123607,
    "name": "Immutable runtime admission source successor v4",
    "target": "branch",
    "source_type": "Repository",
    "source": "agent-teams-ai/.github",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "refs/heads/governance/runtime-admission-source-successor-v4"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "update"
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec5OdEoNzgGtIdc",
    "created_at": "2026-11-26T02:34:21.412+02:00",
    "updated_at": "2026-11-26T02:34:21.436+02:00",
    "bypass_actors": [],
    "current_user_can_bypass": "never",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/agent-teams-ai/.github/rulesets/28123607"
      },
      "html": {
        "href": "https://github.com/agent-teams-ai/.github/rules/28123607"
      }
    }
  },
  "main_ref": {
    "ref": "refs/heads/main",
    "node_id": "REF_kwDOTnRKDa9yZWZzL2hlYWRzL21haW4",
    "url": "https://api.github.com/repos/agent-teams-ai/.github/git/refs/heads/main",
    "object": {
      "sha": "7ad5abbf5a8dade79f91f3e6f06481070b966a9e",
      "type": "commit",
      "url": "https://api.github.com/repos/agent-teams-ai/.github/git/commits/7ad5abbf5a8dade79f91f3e6f06481070b966a9e"
    }
  },
  "source_ref": {
    "ref": "refs/heads/governance/runtime-admission-source-successor-v4",
    "node_id": "REF_kwDOTnRKDdoAO3JlZnMvaGVhZHMvZ292ZXJuYW5jZS9ydW50aW1lLWFkbWlzc2lvbi1zb3VyY2Utc3VjY2Vzc29yLXY0",
    "url": "https://api.github.com/repos/agent-teams-ai/.github/git/refs/heads/governance/runtime-admission-source-successor-v4",
    "object": {
      "sha": "72fa7a8af02e9ba7904c912f0bbb457254381002",
      "type": "commit",
      "url": "https://api.github.com/repos/agent-teams-ai/.github/git/commits/72fa7a8af02e9ba7904c912f0bbb457254381002"
    }
  },
  "same_negative_head_ui": {
    "url": "https://github.com/agent-teams-ai/.github/pull/430",
    "v4Row": "runtime-admission-source-successor-v4 — Protected runtime/admission successor v4: failure\nRequired",
    "mergeEnabled": false,
    "headHref": "/agent-teams-ai/.github/pull/430/changes/37b81fc178381460edbf04a5374d5bff059b31c1"
  },
  "reconstruction_verified": true,
  "owner_grants_installed_at_this_stage": false
}
```

## Deferred owner grants and observed no-grant state

At `2026-11-26T13:20:50Z`, the authenticated connector read all ten target
rulesets with active enforcement, explicit `bypass_actors: []` and
`current_user_can_bypass: never` for that connector reader. These are observed
no-grant snapshots, not before/after grant receipts or separate owner-session
readbacks. A public or Actions response omitting private actors does not
establish an empty list.

| Repository | Ruleset | Observed enforcement / bypass actors / connector-reader result |
| --- | --- | --- |
| `agent-teams-ai/.github` | `19979783` Protect main | `active / [] / never` |
| `agent-teams-ai/.github` | `24363205` identity | `active / [] / never` |
| `agent-teams-ai/engineering-foundation` | `19979782` Protect main | `active / [] / never` |
| `agent-teams-ai/engineering-foundation` | `24372286` identity | `active / [] / never` |
| `agent-teams-ai/agent-runtime` | `24363207` identity | `active / [] / never` |
| `agent-teams-ai/agent-teams-platform` | `24363204` identity | `active / [] / never` |
| `agent-teams-ai/agent-teams-orchestrator` | `19979784` Protect main | `active / [] / never` |
| `agent-teams-ai/agent-teams-orchestrator` | `24363212` identity | `active / [] / never` |
| `agent-teams-ai/extension-foundation` | `20807525` Protect main | `active / [] / never` |
| `agent-teams-ai/extension-foundation` | `24363213` identity | `active / [] / never` |

The still-uninstalled proposal adds exactly
`{"actor_id":13103045,"actor_type":"User","bypass_mode":"pull_request"}`.
The configured `bypass_mode: pull_request` would be distinct from an actual
owner-session response `current_user_can_bypass: pull_requests_only`.
Neither an expected value nor acceptance by the compatible policy establishes
that a grant was installed. The source's Actions observer remains `never`.

At the earlier complete preservation comparison at 02:42:36, all ten target
ruleset payloads matched their no-grant before snapshots. That comparison
included repository ownership, ID, active enforcement, exact
`~DEFAULT_BRANCH` scope with no exclusions, and all protected fields.
The three non-central main rules retained their own required contexts and
issuers; specifically, Engineering Foundation's CodeQL remained App `57789`.
The same comparison retained all eleven excluded ruleset payloads and the
ruleset-ID collections for all seven inspected repositories.

Runtime's pre-existing User `13103045 / always` in main rule `19979781`,
its observed owner-reader result `always`, and history rule `26556591`
were unchanged at that preservation cutoff. Source and tag locks receive no
grant, including v4 lock `28123607`; Research receives no new grant.
No repository outside the six named repositories inherits the optional profile.
The later ten-target observation above is not a new full audit of unrelated
settings or proof of continuous preservation between observations.

| Deferred operation | Actual state at this cutoff |
| --- | --- |
| Install the ten proposed owner entries | NOT INSTALLED; DEFERRED by the owner |
| Fresh owner-full before/after grant readbacks | NOT RUN; no grants were applied |
| Production-export validation against applied-grant inputs | NOT RUN; no applied-grant inputs exist |
| Actual early documentation merge and its resulting-main verification | NOT RUN; current publication uses ordinary protected merge |

Resuming the grant work requires fresh reads, preservation of all other
protected fields, an authorized settings writer, actual after-readbacks and
qualification of the resulting route. This documentation checkpoint grants
no settings permission and does not substitute expected values for those steps.

## Identity compatibility and scope of validation

At the read-only observation 01:55:38, the current callers were:

| Repository | Observed main | Caller implementation selection |
| --- | --- | --- |
| `.github` | `7ad5abbf5a8dade79f91f3e6f06481070b966a9e` | Local reusable target |
| `engineering-foundation` | `fac03920e50ebde038ae415edeb7aa9e3d610ada` | `c8f3e7ba220241f79292c84c72712653019aa1df` |
| `agent-runtime` | `cae4d350c947cd9f74bc04130531527c9a36baeb` | `77a0f46cbfc7688cbabbe12ee819e50ba6f64234` |
| `agent-teams-platform` | `76fc9734f6128b78c7a8b1bc858859fb1cbe835a` | `c8f3e7ba220241f79292c84c72712653019aa1df` |
| `agent-teams-orchestrator` | `b622026a082a0cccc5ec44eebf12d3f88eef6359` | `c8f3e7ba220241f79292c84c72712653019aa1df` |
| `extension-foundation` | `312782a7a74515682a324dc0d89f43394ea1618d` | `77a0f46cbfc7688cbabbe12ee819e50ba6f64234` |

Every caller exactly matched current template blob
`1598f9344a787c6667bd2e5923422c2abc528061` after the verifier's exact substitution
for its observed immutable pin or Central's local reusable call.
Both immutable pins and the local target contain the same regular workflow blob
`dd807a4d94d236009d09a6de2e22921c93bc2332`; their complete bytes match.
The [reusable implementation](https://github.com/agent-teams-ai/.github/blob/7ad5abbf5a8dade79f91f3e6f06481070b966a9e/.github/workflows/commit-author-identity-check.yml)
reads policy and template at a fresh central main SHA and rechecks both blobs
before success. It does not check out the old pinned repository, execute its
CLI audit or inspect ruleset bypass actors. Current grant-aware policy blob
`c7aaacfa24521a9f3e2ecb024d852fefb2b91115` therefore applies without consumer
pin changes. The identity names, aliases and email remain unchanged.

The deferred post-grant validation procedure would use production audit blob
`ee394c2bf38ba35eac094aeb68f1bbddd4b27831`:

```javascript
assertIdentityRuleset(actualIdentityOwnerFull, policy.ruleset, {
  repository: "agent-teams-ai/<observed-repository>",
  ownerPrBypass: policy.owner_pr_bypass,
});
assertMainProtection(actualCentralMainOwnerFull, actualCentralIdentityOwnerFull, "owner_full");
```

The first export checks the six dedicated identity rules. The second comes
from S and applies only to central rules `19979783` and `24363205`; foreign
main rules retain their own exact before/after field comparison.

This applied-grant validation is NOT RUN. No actual after-grant input bindings
or export results are claimed. The completed source qualification and
permanent-enforcement checks above used their actual observed no-grant inputs.

The completed observations are bounded no-grant settings and source
compatibility checks, not an execution of the global `auditIdentity()` wrapper
or a claim that any repository's identity job has run after a new grant. The wrapper also
inventories all active repositories and queries organization/repository Actions
review permissions. No permission, credential or audit guard was changed to
make this bounded check pass. Historical pre-423 CLI audit checkouts still
require no bypass and must not be substituted for the compatible current audit.

## Earlier Draft #431 checks and API recovery

The following receipts qualify the named earlier preparation heads, ending
with corrected head `179e8228e73dbde4d5d64efedecb021508973646`.
They do not qualify a later documentation revision or establish installed
owner grants. Their distinct failures, cancellations, retries and observation
cutoffs remain part of this record.

### Real formatting failure, bounded correction, and ordinary CI

Draft [#431](https://github.com/agent-teams-ai/.github/pull/431) first published
head `2065ddd7eec60d21cae85bfde8750d95b7137639` on installation N.
[Node 26 run 45741941519](https://github.com/agent-teams-ai/.github/actions/runs/45741941519)
and [Node 24 run 45741941537](https://github.com/agent-teams-ai/.github/actions/runs/45741941537)
both actually failed `format:check` on `docs/engineering-quality.md`, before
their test suites ran. They remain failures.

The existing pinned `stack-toolchain@0.1.1` route uses `oxfmt@0.74.0`, its fixed
format preset and `--disable-nested-config`; Markdown is a native supported
language. Running that installed formatter on a copy changed only padding and
separator widths in eight source lines of the grant table. Independent review verified every
cell's content and all text outside that table remained identical. No package
installation or test framework was added.

The normal push produced head
`179e8228e73dbde4d5d64efedecb021508973646`, sole parent `2065ddd7…`, tree
`dd378c7cfbe1f03d84189d598c9241ce023f275e`. Only the quality-document blob
changed, to `2dc70458d61c4d010c616a681547150daf2932b2`; the other 414 leaves
were retained. The PR remained Draft.

| Actual ordinary run on corrected head | Result | Executed evidence |
| --- | --- | --- |
| [Node 26 — 45742914282/1](https://github.com/agent-teams-ai/.github/actions/runs/45742914282/attempts/1), job 139652016468 | SUCCESS | Formatter passed on 109 selected files; typecheck and 5,807 current + 9 frozen tests passed |
| [Node 24 — 45742914194/1](https://github.com/agent-teams-ai/.github/actions/runs/45742914194/attempts/1), job 139652016204 | SUCCESS | Formatter passed on 109 selected files; typecheck and 5,807 current + 9 frozen tests passed |

Each run recorded zero failures, cancellations, skips and TODOs. The actual
synthetic checkout was `11cfcdf670a9a045e421b32eff8607cc135d6b7e`, with parents
N and `179e8228…` and the exact corrected tree. These are PR content checks;
at that cutoff there had been no merge of #431 or resulting-main check.

### Later admission and quota observations on the same draft head

First corrected-head v4
[run 45742911218/1](https://github.com/agent-teams-ai/.github/actions/runs/45742911218/attempts/1)
passed 70 dedicated + 5,939 current + 9 frozen tests, but its qualifier then
failed GET `pulls/431` with HTTP 403 at 02:34:29.646. Its source job was skipped;
publisher job 139653359653 failed POST `statuses/179e8228…` with HTTP 403 at
02:34:50.768. The workflow failed; its v4 commit-status context was absent at
02:37:21. A failed workflow does not prove that a failure status was published.

Subsequent genuine edited
[run 45742982591/1](https://github.com/agent-teams-ai/.github/actions/runs/45742982591/attempts/1)
completed successfully: the same full qualifier passed, source job 139654598099
returned `noop` at 02:38:32.639, and publisher 139654810239 succeeded. Actual
status `59933511592` was SUCCESS at 02:39:02 for head `179e8228…`, base/caller
N and protected source S. This proves that this later attempt could read and
publish; it does not change the first attempt's failure.

The final edited event also produced explicit quota failures in three required
workflows:

| Workflow | Actual failed run/job | Failure time |
| --- | --- | --- |
| Authority evolution | [45743500534](https://github.com/agent-teams-ai/.github/actions/runs/45743500534), job 139653908640 | 02:36:11.7186048 |
| Commit author identity | [45743501182](https://github.com/agent-teams-ai/.github/actions/runs/45743501182), job 139653913517 | 02:36:17.3766254 |
| Trusted validation | [45743500853](https://github.com/agent-teams-ai/.github/actions/runs/45743500853), job 139653911029 | 02:36:23.1189821 |

These logs explicitly report `API rate limit exceeded for installation`.
Authority/validation response headers recorded core limit/used `5000/5000`,
remaining `0`, reset `1795660597` (02:36:37). Identity also warned at
02:36:17.3741190 that it could not publish failure and the status state was
unknown. Its earlier status `59933192572` remained SUCCESS from 02:31:45; that
retained status is not success of the later job. The separately executed
evidence gate 45743500178/job 139653907741 succeeded. Generic HTTP 403 lines
alone do not establish that every failed request had the same quota cause.

At the complete 02:39:46 inventory cutoff, current head had 182 unique workflow
runs across pages of 100 and 82: 108 SUCCESS, 68 FAILURE, 4 CANCELLED, and two
still running (final genuine edited v2 45743501022 and v4 45743500710). Any
later outcome or retry requires its own actual receipt; no all-checks-green
claim is made at that cutoff.

### Completion-body edits on already merged PRs

Publishing the reviewed completion bodies on closed #423 at 02:34:12 and #428
at 02:34:15 genuinely triggered 45 new `pull_request_target` workflow runs on
each old PR head. All were attempt 1 and all were terminal by the 02:39:15
inventory observation:

| Closed PR / unchanged old head | New workflow results | Runtime-v4 outcome |
| --- | --- | --- |
| #423 / `9dff2063…` | 45 total: 4 SUCCESS, 41 FAILURE | [45743301112/1](https://github.com/agent-teams-ai/.github/actions/runs/45743301112/attempts/1) FAILURE |
| #428 / `c9415908…` | 45 total: 3 SUCCESS, 42 FAILURE | [45743303041/1](https://github.com/agent-teams-ai/.github/actions/runs/45743303041/attempts/1) FAILURE |

Both v4 content suites passed 70 + 5,939 + 9, then live binding and publishing
failed `Invalid live source PR metadata`; source jobs were skipped. The exact
[S implementation](https://github.com/agent-teams-ai/.github/blob/72fa7a8af02e9ba7904c912f0bbb457254381002/scripts/runtime-admission-source-successor-v4.ts)
requires the target PR to be open and unmerged. Both v1 runs also failed this
live-state guard. These failures are separate from the previously recorded
premerge and actual M/N postmerge successes.

#423's new identity run 45743299615/job 139653270104 failed the live-PR
precondition at 02:34:25.9911746. #428's new identity run
45743302919/job 139653279577 instead recorded an actual installation quota
failure at 02:34:39.1394753; its log supplied no reset header.

The 02:41:39 combined-status observation further distinguishes jobs from
statuses: #423 retained its historical v4 SUCCESS `59928307464` from 00:46:35
and had new identity FAILURE `59933309241`; #428 had no v4 context and retained
identity SUCCESS `59930775981` from 01:37:47 despite its later failed identity
job. No closed-PR run was retried. The immutable installation evidence retains
its original cutoff and is not rewritten to conceal these later events.

### Final corrected-head cutoff — 02:47:20 UTC

At the later 02:47:20 observation, all 182 unique workflow runs on corrected
head `179e8228e73dbde4d5d64efedecb021508973646` were terminal: 112 SUCCESS,
66 FAILURE and 4 CANCELLED. Exactly three runs had attempt 2, each an explicit
retry of its latest required quota-failed job; all three actual replacement
jobs succeeded:

| Required workflow | Run / successful attempt | Actual new job |
| --- | --- | --- |
| Authority evolution | [45743500534/2](https://github.com/agent-teams-ai/.github/actions/runs/45743500534/attempts/2) | 139657318121 |
| Trusted validation | [45743500853/2](https://github.com/agent-teams-ai/.github/actions/runs/45743500853/attempts/2) | 139657323976 |
| Commit author identity | [45743501182/2](https://github.com/agent-teams-ai/.github/actions/runs/45743501182/attempts/2) | 139657331901 |

Their check runs were bound to the exact corrected head and App 15368. Identity
published new pending status `59933809139` at 02:45:49, then fresh SUCCESS
`59933812666` at 02:45:54. This is actual new execution and publication, distinct
from the older retained success described above.

The final natural v4 [run 45743500710/1](https://github.com/agent-teams-ai/.github/actions/runs/45743500710/attempts/1)
also completed SUCCESS without a retry. Qualifier job 139653911941 passed strict
compilation and 70 + 5,939 + 9 tests with zero failures, cancellations, skips or TODOs. Source job
139656687376 returned `noop` at 02:44:24.769, with current head `179e8228…`,
base/caller N and protected S; publisher 139656878569 succeeded. Actual v4 status
`59933764063` was SUCCESS at 02:44:46, targeting that exact run and attempt.

All six current required gates were therefore SUCCESS, and Node 24 compatibility
also remained SUCCESS; the ordinary Node 26/24 formatter, typecheck and
5,807 + 9 results above remain their actual content evidence. The PR was still
OPEN, Draft and unmerged, with head `179e8228…` and base N. Earlier dated
cutoffs, attempt-1 quota failures, cancelled runs and old-head formatting
failures remain part of the record. No closed-PR run was retried.

## Scope and subsequent delivery receipt

The current checkpoint publishes completed source, policy, installation and
permanent-enforcement work through ordinary protected merge. Its own current
head still requires the applicable reviews and hosted checks; successful
checks on earlier preparation heads are not proof for a later revision.
Owner grants, owner-session after-readbacks, validation against actual applied
grants and a real early documentation merge remain explicitly deferred.

Any future native grant is not a documentation path filter. Use stays within
assigned, reviewed delivery and does not authorize independent work, releases,
direct protected-main pushes or ignoring substantive findings. Product
architecture proposals and existing ownership boundaries remain unchanged.
Optional A/B alternatives in the
[maintained quality route](../../../docs/engineering-quality.md#documentation-merge-timing-native-owner-route-2026-11-25-utc)
remain unselected. Asynchronous transport and stacked-PR delivery are separately
unqualified and deferred: explicit assignment and complete review of the entire
affected PR set would be necessary, together with separate transport
qualification. Current delivery uses the ordinary protected single-PR route.

At this snapshot's pre-merge cutoff, the publishing documentation PR's own merge
and postmerge results are not yet observed. Its eventual PR receipt records the
actual head/base, operation result, final tree/attribution and postmerge run
outcomes. The actual PR URL belongs in that receipt, without another content
commit solely to prove this publication.

Closing a PR or editing metadata on a closed PR can cause an open-PR guard to
reject the target. Record any actual closed-target or metadata-change rejection
as FAILURE with its reason, separately from actual resulting-main quality
checks. Do not rerun a closed target solely to seek a green open-PR guard.
Pending, cancelled, omitted and failed checks are not success; the resulting
main full CI still must complete successfully.

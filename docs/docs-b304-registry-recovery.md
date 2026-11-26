# Bounded b304 registry incident recovery

This mechanism covers one Runtime parser incident during the retirement of
deleted canary `1336577313`. Its result is `recovery_pending`, with Runtime
semantics and qualification both `unverified`. Every other current consumer and
all historical admission evidence retain their ordinary checks.

The [typed incident verifier](../scripts/docs-b304-registry-incident.ts) owns the
closed proof and capability contract. The
[staging boundary](../scripts/docs-b304-recovery-staging.ts) and
[base-owned admission workflow](../.github/workflows/docs-admission-evidence.yml)
own the separate archive, authority and policy operations. Source changes still
require both protected-source qualification routes; this guide grants no source
exception or consumer adoption.

## Exact incident and retained evidence

Runtime `1314129620` at `cae4d350c947cd9f74bc04130531527c9a36baeb`
uses frozen runner `b30455e32cf5d54ade6d8301637701347e4ce57c` and stable31.
The complete historical and current policy bytes are identical. The old registry
contains 44 Cohorts and 186 events; the current registry preserves that whole
prefix and appends one Gen3 Cohort with three events. The frozen registry schema
rejects only the appended record, producing the 39 errors retained from the
actual failed authorizer. The current schemas accept both current documents.

The [inert archive](../governance/evidence/docs-b304-registry-recovery/runtime-20261126.json)
binds eight immutable Central Git inputs, three unchanged Runtime file preimages,
all 62 observed checks, three run records, four jobs in each canonical attempt,
and four complete log digests. Its Git blob is
`dba83124c585eb6f31a3da8020f9744606e8f493`. These are historical observations,
not a current grant or live qualification. The canonical
[attempt 1](https://github.com/agent-teams-ai/agent-runtime/actions/runs/45724048832/attempts/1)
succeeded; [attempt 2](https://github.com/agent-teams-ai/agent-runtime/actions/runs/45724048832/attempts/2)
failed before consumer qualification or semantic execution. The successful
[nightly run](https://github.com/agent-teams-ai/agent-runtime/actions/runs/45792972738/attempts/1)
remains in the complete census.

### Run metadata correction before activation

The proposed archive now matches the run endpoints used by the unchanged
production verifier. For current run
[45724048832](https://api.github.com/repos/agent-teams-ai/agent-runtime/actions/runs/45724048832),
`created_at` is `2026-11-25T23:47:44Z`; the separate attempt-2 endpoint
reports `2026-11-26T16:05:21Z`. For the
[nightly run](https://api.github.com/repos/agent-teams-ai/agent-runtime/actions/runs/45792972738),
`updated_at` is `2026-11-26T09:44:47Z`; its attempt-1 endpoint reports
`2026-11-26T09:44:48Z`. The historical canonical observation continues to
use its explicit attempt-1 endpoint.

The earlier proposed archive, blob
`2ec1dd73094608e9b65bb5aa1a29d8f86a2b5271`, remains immutable in retained
source history. This correction precedes any authorization and changes only
those two metadata fields and the corresponding test fixture. All 62 checks,
both four-job sets and their steps, referenced workflows, source inputs, parser
errors and four raw log digests remain unchanged. Regression tests verify the
retained archive through the original proof kernel and refuse substitution of
the attempt metadata. No production endpoint, verifier rule or authority is
changed by this correction.

Every verification rereads the whole census and source. Added, missing, altered
or pending checks, a different attempt, a changed head, an independent failure,
or a changed log invalidates this exact incident. Matching parser errors alone
cannot excuse altered historical Cohort or event bytes. Do not rerun a workflow
to try to preserve this fixed evidence set.

## Sole policy operation

Only `governance/docs-protocol-policy-v2.json` may change:

- Canary `1336577313`: `repository_lifecycle` from `active` to `deleted`.
- `admission.expected_repository_count`: `11` to `10`.
- `admission.owned_repository_count`: `11` to `10`.

The complete policy must move from blob
`2d60b967eb37185a6f85c84c031950dc73458e34` to
`f0d9b42d2968aabcc3d5148374286cd280ee34eb`. Registry
`10a07154e9361bfc148bab9ecb2ca1155325824d` and exceptions
`7fb208e80500a9ff3dfc449e03c9700e6e15e82e` remain exact. All 13 policy rows,
their other fields and ordering remain. The changed counts require the ordinary
full-fleet current admission audit. The capability cannot select an EF or Runtime
Cohort, advance an observation, rewrite a caller, or admit another operation.

## Authority lifecycle and installation

The [authority file](../governance/docs-b304-registry-recovery.json) starts with
the exact inert document:

```json
{
  "schema_version": 1,
  "authorization": null
}
```

An active authorization has only these fields:

| Fields                                             | Required binding                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `id`, `state`, `valid_from`, `expires_at`          | Incident identifier, active state and a UTC validity window of at most seven days  |
| `controller`, `pull_number`, `pull_id`, `head_ref` | Central identity and the real, separate policy-operation PR                        |
| `operation`, `incident`                            | Exact policy images and the single Runtime source incident above                   |
| `proof`                                            | Revision, fixed archive path and blob already present in a merged base ancestor    |
| `verifier_source`                                  | Prior installed revision, verifier path and blob equal to the actual base verifier |
| `owner_decision`                                   | Actual administrator comment ID, actor ID/login and exact body digest              |

1. Qualify and install the source with inert authority. Retain the actual archive
   in a merged ancestor. The separate archive mode permits only the fixed added
   proof file and creates no capability.
2. Open the real policy-only operation PR. Obtain an independent administrator
   decision on that PR using the exact body from `b304RecoveryDecisionText`.
   It binds the operation, proof, installed verifier, validity start and expiry.
   Use actual Git/PR/comment coordinates; never invent a future installation SHA.
3. In a separate authority-only PR, stage `null` to that active record. Trusted
   base code verifies complete Git trees, the open operation PR, archived proof,
   current provider evidence and final owner/admin validity. Staging reports
   `capability_created: false`; it does not evaluate consumer admission.
4. After installation, run ordinary policy admission with the grant in its base.
   Its opaque process-local capability binds the real ten-field execution
   envelope, including current base/head, run/attempt and complete changed paths.
   Initial and final fleet reads must agree; a final owner/admin and clock read
   follows the outer controller checks. Serialized reports cannot replace this
   capability or remove unrelated pending rows.

The record contains neither its own installation commit nor predicted future
operation commits. Archive, authority installation and policy changes cannot be
combined to authorize themselves. Absence or exact `null` creates no capability;
malformed, duplicate-key, oversized or unknown-version records fail closed.

## Expiry, revocation and reversal

Expiry automatically refuses use. The staging route permits only `null` to
`active`, or `active` to `revoked` with every other field unchanged. It cannot
renew, extend, rebind, reactivate or remove a record. Revocation requires the
current human PR owner to retain administrator permission; an expired incident
or unavailable former approver does not prevent that restrictive transition.

Revocation does not undo a policy change. Any policy reversal uses the normal
reviewed policy route and its complete checks; this finite forward capability
cannot authorize it. Preserve the archived evidence and revoked record. Runtime
remains explicitly unverified until its owning qualified migration and current
native checks establish fresh acceptance.

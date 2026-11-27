# ADR-0019: Bounded Docs policy 3.1 runtime support

Status: Accepted implementation scope; protected source delivery and package qualification pending

Date: 2026-11-27

Decision owner: Organization governance

## Authority and context

The owner renewed Extension Foundation's end-to-end delivery task, including
necessary producer, Central, release and consumer prerequisite changes. This
decision records that bounded continuation. It grants no qualification result,
ruleset change, Cohort selection or consumer adoption from local source edits.

Initial Central base `89b5d7c512d9c4b5ae63709857a0d71cb2e6d178` admits generation 3
only with semantic policy 3.0.0 and exact qualification Node 26.11.1. The producer
successor targets patched Node 26.12.1 with controller Node 24.22.3. Changing
the one existing runtime constant would reinterpret historical records and
receipts, while allowing arbitrary 3.x versions would remove the closed policy
boundary. Preserve the old semantic contract and admit one explicit successor.
The implementation integrates protected main
`9d8aa752886c00d5b3d9154e0b6c00e65a4e33cc` and retains all of PR441's
separate B304 source, strict quality entries and admission routes.

## Decision

Generation 3 keeps its existing Cohort digest domain, five package coordinates,
seven dependency edges, closure v2, profile 4, managed state 3 and receipt 1.
Policy identity remains `agent-teams.docs-protocol-current-policy` with the
actual nonzero digest of normal producer policy bytes.

| Policy version | Node range      | Exact qualification runtime           |
| -------------- | --------------- | ------------------------------------- |
| 3.0.0          | `>=26.0.0 <27`  | Node 26.11.1, pnpm 11.20.0, Linux x64 |
| 3.1.0          | `>=26.12.1 <27` | Node 26.12.1, pnpm 11.20.0, Linux x64 |

Both use `node-26-managed-qualified` and pnpm range `>=11.17.0 <12`.
The schema and semantic validator reject cross-paired versions, ranges and
physical tuples. No other policy version, platform or runtime is admitted.
`scripts/docs-managed-runtime-policy.ts` owns the exact typed selection shared
by the existing registry, receipt and consumer workflow adapters. Historical
policy 3.0.0 data, digest domains and published receipts remain unchanged.

Only the trusted authorizer may emit `qualification-node-version`, after
validating the record selected by the committed managed state. Desired rollout
policy, caller inputs and environment values cannot choose that output. The
qualification and untrusted semantic jobs consume it. The existing none,
legacy and generation 2 lanes retain Node 24.21.0; policy 3.0.0 retains Node
26.11.1. The new reusable workflow uses patched Node 24.22.3 for its authority
and structural validator bootstrap. Those jobs execute only base-owned
validators, perform no managed package qualification, and remain separate from
the physical Node 26 qualification tuple. Existing immutable workflow bytes
and producer controller contracts are not rewritten.

Receipt verification still compares the entire exact record, policy digest,
physical runtime, package versions and integrities, installed bytes, closure,
and immutable execution envelope. A valid supporting receipt does not satisfy
central CANARY. Current lifecycle and rollback rules remain mandatory.

## Source admission and delivery

This functional support is separate from append-only Cohort registration,
EF-only desired selection, observed adoption and CANARY promotion. This PR
changes none of their data. Publication coordinates and policy digests must
come from the actual released producer; synthetic fixtures are never records.

At the observed base, temporary Runtime/Admission V7 source
`5ef0d779e5d207a5f027a85e0ae2fd93ca5d7902` binds only PR441's exact target.
Its ordinary route retains frozen Runtime V4 and Admission V1. Neither V7 nor
another PR's source proof admits this support change. Finalize and independently
review this exact functional tuple, then use the existing bounded source
successor procedure with fresh head/base, source lock, real accepting and
rejecting canaries, protected-source execution and serialized required-context
readbacks. Coordinate with active Central work before that transition. Keep
historical owners, their original source bytes and ordinary/data rejection
routes. No source lock, immutable branch or ruleset is changed by this patch.

The already protected `docs-admission-evidence.yml` owns the new helper's
continuing source boundary. After complete paginated changed-file evidence,
its existing pre-no-op executable guard rejects changes to the helper through
either current or previous filename, before code-only, archive, staging or
admission-data modes. Both B304 executable entries remain protected. The helper
also joins the existing mixed-data authority set and imports only Node's built-in
assertion module, so no unlisted executable dependency is introduced.

The current base does not yet list this helper. This support tuple still needs
the independently qualified finite Runtime source transition for its changed
protected workflow and existing validators; it does not admit itself. After
the source merge and restored predecessor requirements, a real helper-only
negative canary must fail required `trusted-admission-evidence`, while an
ordinary code-only positive canary succeeds. This verifies continuing helper
ownership without adding another permanent Runtime framework. Future helper
source changes remain rejected until separately qualified source evolution.

## Verification and limits

Require positive tests of both exact policies, rejecting cross-pairs even with
recomputed record/receipt digests, preserved legacy projection bytes, and
selected-record runtime output during pending upgrades and rollbacks. Keep the
four-job capability split and exact workflow allowlist. The new helper and its
test belong to the existing strict compiler, lint census and test runner.
The materializer tests execute its real workflow script and reject helper
modification, addition, deletion, both rename directions and mixed-data changes
before any no-op or candidate-byte read. Preserve ordinary no-op and B304 cases.
Run the complete current native Central gates after focused checks and an
independent implementation review; re-observe moving main before delivery.

Local tests prove policy and workflow selection. Actual Node 26.12.1 package
qualification, signed publication, protected source admission, EF migration,
rollback and main-branch gates remain separate execution requirements.

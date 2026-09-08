**GO — immutable stable13 record correctness. GO — its initial PUBLISHED_UNQUALIFIED event only.** No actual defect found in either requested scope at the exact file hashes below. This review does not establish a QUALIFIED/CANARY/RECOMMENDED transition, consumer admission, successful migration, or successful rollback.

Reviewed at 2026-09-08T04:11:18.698591Z. Authoritative source: `/var/data/sandboxes/ef-resume-20260907/TEST-ef-new-cohort-registry-20260908/checkout` (S), HEAD `e6a536b61a64ffd27b26967e165bfa998f9b0caf`. Evidence root: `/var/data/sandboxes/ef-resume-20260907/TEST-ef-new-cohort-evidence-20260908` (E). Inspected the actual uncommitted files and Git diff in S, not the separate review checkout. The previous attempt left no owned report; the existing TASK.md was preserved.

The reviewed registry is **301899 bytes**, SHA256 `0f34c170dd8cf371ee58b59df3bd593ab34eb760fe52b08d7736a2ccaf1a316a` at `S/governance/docs-qualified-cohorts.json`. The new closure is **25644 bytes**, SHA256 `f9f00ea9ddba1c236f5f17d8095abdf51a5c6633a9c6b60d9c3ec8952bc399c6` at `S/governance/docs-runtime-closures/sha256-f9f00ea9ddba1c236f5f17d8095abdf51a5c6633a9c6b60d9c3ec8952bc399c6.json`. These are whole-file hashes; the record/event hashes below are separate domain-bound canonical digests.

**Immutable record and append boundary**

- The only tracked diff is 242 insertions, zero deletions, in the registry. It appends one cohort (25 → 26) and one event (113 → 114). All previous cohort objects, event objects, ordering, and top-level metadata match HEAD. The saved `E/registry-base-stable13.json` is byte-identical to HEAD's registry, SHA256 `2c5729048c32dc7c4485b9ff5d5d167dc94520516ea79463b9b7992750eeaa3c`.
- Independently recomputed the stable13 record digest from sorted canonical JSON with domain `agent-teams.docs-qualified-cohort/v2`, excluding `record_digest`: **`sha256:2cd0168ddeb74f0a6e8da1649eee1571512e06414467ce04b9db113e60cc2fa9`**. It matches the current record, the requested digest, and `E/stable13-staged.json`.
- The record explicitly uses generation 2 and exactly the five required coordinates in the required order, with three direct roots and two transitives. The seven internal edges match both the controller's closed edge list and the actual published package manifests, with exact dependency versions. Docs Protocol MCP is absent.
- The schema tuple is consumer integration 3, managed state 2, Docs Protocol 1, qualification receipt 3, Foundation plan/journal/receipt 1/1/1, and Foundation envelope 5. The runtime remains Node `>=24.18.0 <25` and pnpm `>=11.17.0 <12`; all five archive manifests have these exact engines. The closure records its separate resolver version `pnpm@11.20.0` and lockfile `9.0`.
- The declared canary identity is repository ID `1336577313`, `agent-teams-ai/docs-protocol-canary-20260817`. No admission policy change is included.

**Actual publication and provenance**

For every coordinate, rehashed the retained archive's SHA512 SRI and matched it to the record, stored npm metadata, and decoded SLSA subject. Also matched packed name/version, publication timestamp, attestation URL, source commit, source workflow, and invocation run/attempt against the retained audit bundles. Every comparison matched.

| Coordinate | Role | Actual publication UTC | Signed source commit / release run / attempt |
| --- | --- | --- | --- |
| `@agent-teams/repository-mutation@0.2.0` | transitive | `2026-09-07T22:59:41.813Z` | `f7be87586dae11be5641a7e963525b7f63b72338` / `34167531297` / `1` |
| `@agent-teams/document-authoring@0.3.0` | transitive | `2026-09-07T22:59:58.854Z` | same f7 commit / `34167531297` / `1` |
| `@agent-teams/docs-protocol@0.6.0` | direct | `2026-09-07T23:00:21.392Z` | same f7 commit / `34167531297` / `1` |
| `@agent-teams/docs-protocol-agent-teams@0.2.1` | direct | `2026-09-08T03:43:33.930Z` | `ba185fc7a608555601b9b4adc380213396a604ec` / `34183277485` / `1` |
| `@agent-teams/engineering-foundation@1.1.0` | direct | `2026-09-07T23:06:47.586Z` | same f7 commit / `34167531297` / `1` |

All five bind `agent-teams-ai/engineering-foundation`, repository ID `1316243988`, `.github/workflows/release.yml`, and signed workflow ref `refs/heads/main`. The four earlier coordinates and the adapter legitimately have different producer commits; controller W is a third, independent commit.

`E/four-signatures-result.json` records PASS at `2026-09-08T03:14:11.753Z`; `E/adapter-021-signatures-result.json` records PASS at `2026-09-08T03:49:18.036Z`. These support the record's `signature_verified: true`; this reviewer inspected those existing cryptographic results and decoded their bundles, without rerunning signature verification. Both retained release-job observations show an exact attempt-1 `release` job with matching head SHA and terminal success (jobs `101881451045` and `101926512300`). Their separate `attest-release-pr` jobs were skipped. No failed-origin reconciliation claim is needed or present in stable13.

The root-owned `E/stable13-live-first.log` now contains the success line `Qualified Docs Cohort evidence verified: docs-2026-09-08-stable13`. The inspected verifier emits this only after schema/lifecycle validation, npm integrity and publication checks, cryptographic audit binding, exact release run/attempt/path/SHA/success, protected-main ancestry and producer identity, published content, closure, and current protected workflow checks. This is the retained root result, not a new live attestation from this reviewer. The log has no independent exit-code/command receipt; it is not evidence that `pnpm check` or later promotion passed. The requested full live verification was not restarted.

**Five coordinates, seven managed edges, 82 closure entries, twelve historical bundles**

These counts describe different objects and agree:

- The content-addressed closure bytes exactly equal `E/five-package-runtime-closure.json`'s `source` and its decoded `evidence`; its `authority` exactly equals the record. The file is sorted canonical JSON plus one newline and hashes to its filename. Its coordinates and all five lockfile SRIs match the record. Traversing ordinary and optional dependencies from its three exact direct roots reaches exactly **82** snapshots, with 82 physical package records, no missing referenced locator, and no extra unreachable snapshot. Its seven managed edges equal the seven published internal dependencies.
- Read the transition catalog and historical assets directly from the actual adapter `.tgz`, without extraction or package execution. It has **12 unique directTargetBundles** and **zero currentSourceExecutors**. Independently reconstructed each historical qualified projection from the actual central registry, including its immutable record and QUALIFIED event digests, package SRIs, workflow tuple, assets, schemas, runtime closure, and migration fields. All twelve projections match exactly. Every historical skill/caller content-addressed path, retained byte digest, route digest, and docs-script digest matches; those 24 references deduplicate to 11 historical files.
- The exact historical bundle IDs are `docs-2026-08-17-rc1`, `docs-2026-08-17-rc7`, `docs-2026-08-17-rc9`, `docs-2026-08-18-rc1`, `docs-2026-08-18-rc2`, `docs-2026-08-18-rc3`, `docs-2026-08-23-stable1`, `docs-2026-08-24-stable2`, `docs-2026-08-25-stable3`, `docs-2026-08-28-stable8`, `docs-2026-08-28-stable9.1`, and `docs-2026-08-31-stable10`.
- These are historical projections, not twelve current-generation packages, twelve granted rollback edges, or twelve successful rollback executions. `E/record-input-export-verification.json` independently records the root's prior PASS for 12 projections, the same 82-entry authority, and the same rendered caller digest, explicitly limited to published bytes and existing projections.

All four current assets hash to the record: skill `a86d8c9b990124f11b50b1c6703e1aeb5e3b981d51f7e8f5c163c4f5b987d7c5`; caller template `1d4424682157e101f3ae98538a19e59ceeb2fcf8b96687f2694fec77315276ac`; asset catalog `3ec380a1a6dd8534824ba82ff23affba993e19e9cb6b3c5e424ea9973ad686da`; transition catalog `7d7d5308e5495dc159b34aaaceaf5953e4649a1330a96065585777464d68d06c` (all SHA256). Rendering the exact template with current W gives SHA256 `48348ecfad7abe7d7fe8f5aac345a4db73b78a5bf8bb5281e7dfdc9f810fe631`, matching the record.

W binds controller `agent-teams-ai/.github`, repository ID `1316243981`, `.github/workflows/docs-protocol-check.yml`, revision `e6a536b61a64ffd27b26967e165bfa998f9b0caf`, blob `9bcbe54dfec6280045ac596e55c1f14ce5f176e1`. Independently recomputed the Git blob hash from that revision's bytes and confirmed the worktree workflow is identical. Workflow file SHA256: `ddee57a5e685407548ad8eebaa6f1e934600104af192dcd542160915c24fd1d6`. Current protected-default workflow freshness is supported by the existing root live-verifier result, whose implementation explicitly checks the current default-branch blob; no network freshness claim was independently added here.

**Timing and all three rollback origins**

Read `/tmp/ef-cohort-timing-rollback-decision-fast-20260908-artifacts/REPORT.md` and checked its relevant conclusions against central policy, current consumer bindings, and actual published adapter restoration code.

The latest real publication is the adapter at `2026-09-08T03:43:33.930Z`. Adding 24 hours gives `2026-09-09T03:43:33.930Z`; rounding UP to the required whole second yields **`2026-09-09T03:43:34Z`**, exactly the staged `eligible_after`. It does not use release completion, signature-check time, registration time, or a truncated millisecond value.

Both `upgrade_from` and `rollback_to` contain exactly the necessary fleet origins:

| Origin | Current observed consumer binding | Existing authority |
| --- | --- | --- |
| `docs-2026-08-28-stable8` | Token | QUALIFIED event 87; SUPERSEDED, support until `2026-09-28T16:41:06Z` |
| `docs-2026-08-28-stable9.1` | Canary | QUALIFIED event 97; SUPERSEDED, support until `2026-09-30T16:59:35Z` |
| `docs-2026-08-31-stable10` | Runtime, Orchestrator, Platform, Extension | QUALIFIED event 104; currently RECOMMENDED |

All are earlier immutable records and bundled historical targets. The canary's desired stable12 is not its observed source; the source remains stable9.1. All three origins are necessary for this immutable record's intended fleet scope. The published restoration code binds the exact original cohort; a common fallback or stable9.1-only list would not suffice.

Central policy treats eligible_after as compatibility metadata and does not enforce an elapsed-age qualification gate. However, actual adapter `dist/consumer-integration/adapters/node-consumer-restoration.js:49` requires both original and successor eligibleAfter timestamps to be no later than observed time; preparation invokes that guard at line 36. Thus the published restorable preparation/migration path still waits until the stated boundary. This is an operational limit, not a defect in this record or its initial event. No preparation, finalization, rollback receipt, historical-reader execution, or future success is claimed.

**Initial event only**

The new event at registry line 5910 is sequence **114**, state **PUBLISHED_UNQUALIFIED**, effective at **`2026-09-08T03:43:33.930Z`**, exactly the latest publication and already in the past when inspected. `support_until` is null, `canary_evidence` is empty, and evidence references match the real publication/provenance/workflow references on the record. Its predecessor is the existing event-113 digest `sha256:f00b72838a497e3760562ca1cbe51bccfe8aeba11b7f42a3a8c3a90feb7576dd`.

Independently recomputed its digest under `agent-teams.docs-qualified-cohort-event/v1`, excluding `event_digest`: **`sha256:138ff9c7365274703cf37e9139e492226e2eaa5356ca4939fbb4aaf9cd892140`**. It matches both the expected digest and the root staging receipt. Stable13 has exactly this one event. A verifier log containing the word “Qualified” does not change the lifecycle state. There is no fabricated qualification or rollback evidence in this append.

**Actual defects and commit boundary**

No record/event correctness defect found. The operational timing restriction above remains applicable. At inspection, the Git index was empty: “staged” here describes the prepared working-tree append, not a populated index. The new closure is untracked and must accompany the registry in any eventual commit.

The owner's `S/node_modules` symlink is also untracked and absent from the index; it points to `E/signature-tools/node_modules`. It must not be committed. The prospective commit scope consists only of the registry and the single new content-addressed closure. This review performed no Git staging or commit action and did not alter or remove the symlink.

Only this owned REPORT.md was written. No tests, install, network, authentication, package execution, live-verifier rerun, source/product edits, lifecycle mutation, Runtime PR70 action, or other owner's artifact write occurred. The report's GO applies to the exact inspected bytes and these two scopes; integration checks and any later lifecycle evidence remain separate work.

**Retained file SHA256 inventory**

All paths below are under E unless explicitly marked S or /tmp.

| File | SHA256 |
| --- | --- |
| `verified-archives/repository-mutation.tgz` | `0f50cd689728cf05ce88ad984f15fe4381c1580e392ab59195b5b287a00b4a6e` |
| `verified-archives/document-authoring.tgz` | `76aec83bd25ebd43c0b9145e6437b4cf5e4aa75acd145ead46b636ea2b972c3a` |
| `verified-archives/docs-protocol.tgz` | `ecdddbf5c90faf773d98820b7b3429707394252c7370732147a5d91b1fc378d7` |
| `verified-archives/docs-protocol-agent-teams-0.2.1.tgz` | `457cacb48fab3eebe303fb9281a1c524611bd0a6fff608bd88c38ff4e04578c8` |
| `verified-archives/engineering-foundation.tgz` | `835813543dac0ca8383ba19f472eb9d2bf90d1c84700eb0d4d41a403efc9c9e6` |
| `four-signatures-result.json` | `da350dd66c570fceba67a6cc746b1466ee01aaa9dbe5c2b3b054c77e6ad8dd82` |
| `adapter-021-signatures-result.json` | `76b8534383621941a2a563b79eb261a2c3b6726fdd63081ad1900cd88a259537` |
| `four-provenance-summary.json` | `47a66015631181a53b48812622524f9d8dc9ed3bd67a10cb49e8b1f33dc9bb2c` |
| `adapter-021-publication-time.json` | `08379bdd4144cd1506b19892606903d6a25690bdb53baa00a30fcb6491e9fcf3` |
| `ef-release-34167531297-jobs.json` | `823f2ec6bc09fba1a9c12f490c05ea8c8987a42c8ffd030fd5ed2917f51dd224` |
| `ef-release-34183277485-jobs.json` | `ce09790df294b9cf1a80a1e667d769c7657bfc8d4230ee2ca225dde38399b604` |
| `five-package-runtime-closure.json` | `37996558c7e8d7f1c25629bdef4d90d2ada4b91adc366acd68755ebe7e5b9e5c` |
| `record-input-export-verification.json` | `a032178e05d2c231d09a390a343c4ed05a1cf1d0bb702a89be1174769d24b908` |
| `stable13-staged.json` | `65dc91fe9635b3fc068d34a00c086c98d55069610cc22c180cb687406525aadc` |
| `stable13-live-first.log` | `18e66001cad5ca82417d87b62fa73f526d1938d18058848859630288f3a42470` |
| `S/governance/docs-qualified-cohorts.schema.json` | `64fcd7a51966fa4302a9add4e3b4e6c00d30e88f6ba9a100ad450134d174df4d` |
| `S/governance/docs-protocol-policy-v2.json` | `f4181488f87a2a31d26d354adcc36e7e3c15561dba99ee04295399651124c735` |
| `S/scripts/docs-cohort-policy.mjs` | `e70a0984878256069e1fa766be4569223da082a07b0530dd7c1ff08474032226` |
| `S/scripts/verify-docs-cohort-evidence.mjs` | `f7b47c2f42558bbcbdf482803f218abc8cb8ad84ac0d1c352cc7ac17830480d9` |
| `/tmp/ef-cohort-timing-rollback-decision-fast-20260908-artifacts/REPORT.md` | `c60aa783ef3b5fb57a60ca8ba6bd7bcee10acb219ec610410f9ce4976f1a84e9` |

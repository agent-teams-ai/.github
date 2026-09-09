# Legacy Docs consumer successor candidate

Owner decision: this isolated compatibility work is **NONBLOCKING for Token
delivery**. This is an implemented, offline-tested backport candidate, not a
qualified Cohort or a completed Token repair. Token still executes its immutable
stable8 workflow until its owner explicitly adopts a qualified successor.

The delivery checkout base is `b1188de97885b3b6a93e9ed40a614e021c0c0c84`.
`successor.patch` applies instead to the exact legacy workflow source revision
`07d49409cb51f6124ad17673860b812a9d7b5f5b`. Do not apply this inner patch to main:
main already supports mixed-generation authority. The artifact is deliberately
separate from PR203 (`ee92c913`) and ReviewRouter PR175.

The patch backports the current strict policy and registry schemas and their
shared cohort validator from the delivery base, plus an explicit legacy-only
execution guard in the old consumer gate. Reusing the complete shared validator
keeps record/event digest domains, generation-2 registry semantics, migration
references, lifecycle and runtime-closure validation coherent. It does not port
the generation-2 consumer executor or receipt path. The reusable workflow bytes,
legacy isolated install, authorization/receipt binding, and package execution
remain at the old revision. No published policy, record, event, or closure bytes
are edited. Live policy and registry still come from the separately resolved
current controller snapshot; schemas and code remain at the executing workflow
revision. Nothing projects away canary fields or freezes evolving authority.

## Reproduce offline

With the repository's existing dependencies installed and full Git history:

```sh
node --test scripts/docs-legacy-compat.test.mjs
node --test scripts/docs-cohort-policy.test.mjs scripts/verify-docs-consumer-gate.test.mjs
```

The first command archives the exact old commit into a temporary directory,
applies the actual patch without an index or commit, and executes that gate.
It independently reproduces old-policy and old-registry rejection. Positive
fixtures retain every current policy entry and every published cohort/event,
including the other canary, then append a synthetic legacy repository and cohort
in memory. Both schemaVersion 1 and qualification-v2 legacy integrations are
exercised. These fixtures are not Token CI evidence or new published authority.
The test also runs all 93 original stable8 consumer tests against the patched
candidate, including isolation, exact caller/projection, lock and closure
binding, and current-controller/pinned-code separation.

To inspect an unpacked candidate from the repository root (use a new directory):

```sh
candidate_dir=$(mktemp -d /tmp/docs-legacy-successor.XXXXXX)
git archive 07d49409cb51f6124ad17673860b812a9d7b5f5b | tar -x -C "$candidate_dir"
git apply --unsafe-paths --directory="$candidate_dir" compat/docs-legacy/successor.patch
```

This changes four candidate files: the two schemas under `governance/`,
`scripts/docs-cohort-policy.mjs`, and `scripts/verify-docs-consumer-gate.mjs`.
It does not create a supported release, a workflow commit, or adoption metadata.

## Bounded successor qualification checkpoint

[Qualification staging input and checklist](qualification-staging/README.md)
binds delivery candidate `194bf51cbc46d870bb90470aa197ba987d7f5b64`, the exact
inner patch and retained diagnostic inputs. The supplied backport result is
ACCEPT / 195 tests PASS / PR207 maincheck SUCCESS; successor qualification is
still incomplete.

Live stable10 verification failed solely because fresh resolution changed
`fast-uri` 3.1.6 to 3.1.7 (package SRI/locator, snapshot and both Ajv edges).
Root bindings and package count 153 remain identical for Docs 0.4.1 and
Foundation 0.21.0. The immutable closure digest is
`sha256:33d07e21e60a169b86895dab7a1693b7ccf9ccbda6dc2797c9ea0a377b074ab4`;
the captured actual digest is
`sha256:c7454c52e2310e90d94981a4e6bcb902ef0051ed91183d15a8bbc2ff5406edb7`.
The staging checklist references external evidence by exact SHA-256, avoiding
large copied runtime reports in this repository. It records transition qualification inputs, the old-package asset observation,
source materialization commands, and the boundary
between local preparation and separately authorized merge/publication.
Neither this capture nor the existing green backport checks qualify a successor.

## Qualification and adoption remaining

1. Central maintainers review the exact artifact and materialize a new immutable
   successor revision, keeping the legacy workflow isolation. Stage any authority
   evolution under the existing base-owned successor-check/ruleset process;
   authority changes cannot accompany a lifecycle append to bypass those checks.
   Run the required full repository checks on the supported Node/pnpm toolchain.
2. Engineering Foundation verifies and reuses the existing modern managed
   adapter 0.2.2 stable10 historical origin, catalog, skill and caller for the
   intended Docs 0.6.0 route. Old Docs 0.4.1 omits stable10 from its historical
   catalog; that does not require new origin publication or a legacy bridge.
   Bind the actual runtime-specific target and qualify its declared transition
   and supported recovery independently. Token's stable8 adoption path remains
   separately owned; origin possession grants no target eligibility.
3. Bind the actual successor workflow commit/blob, rendered caller, exact package
   graph/SRI/provenance, schema coordinates and content-addressed runtime closure
   into a new legacy Cohort. Preserve all prior record/event bytes. Run
   `pnpm governance:cohorts:verify -- --cohort <new-id>` in that later authorized
   qualification environment; it is not an offline worker command. Qualify on a
   declared non-Token canary with hosted central consumer CI, fresh trusted install
   and receipt evidence. Use the existing evidence verifier and lifecycle gates;
   advance only on verified evidence through PUBLISHED_UNQUALIFIED, VERIFIED,
   COOLDOWN where required, QUALIFIED, CANARY and RECOMMENDED.
4. Token's owner separately chooses adoption after general eligibility is proven,
   updating its exact managed assets, packages/lockfile, caller and qualification
   artifacts. Central admission must bind its actual default-branch green evidence.
   Until consumer CI passes, the compatibility repair remains incomplete.

Stable8 support ends at `2026-09-28T16:41:06Z`; the backport does not extend it.
Stable10 also has the old schema. Stable14's other-canary qualification grants
Token no eligibility. No network, publishing, lifecycle promotion, GitHub mutation,
authentication access, Token edit or commit is part of this artifact workflow.

The 2026-09-09 [stable10 checkpoint](qualification-staging/README.md#stable10-materialization-checkpoint-2026-09-09)
adds exact declared-base source materialization and published-contract inspection.
Fixture clocks now follow the latest event in the complete registry input;
this is deterministic offline test time, never a qualification timestamp.

The historical executable candidate remains at 78/79: its first rollout-message
assertion is stale, and a diagnostic-only regex change exposes a second stale
assertion rejecting an explicitly declared rollback. One regex fix does not pass
the gate. Candidate test reconciliation and complete relevant gates remain a
separate owner obligation; this correction leaves that candidate unchanged.

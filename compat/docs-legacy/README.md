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

## Qualification and adoption remaining

1. Central maintainers review the exact artifact and materialize a new immutable
   successor revision, keeping the legacy workflow isolation. Stage any authority
   evolution under the existing base-owned successor-check/ruleset process;
   authority changes cannot accompany a lifecycle append to bypass those checks.
   Run the required full repository checks on the supported Node/pnpm toolchain.
2. Engineering Foundation verifies the exact published asset catalog, caller
   template, transition catalog and historical assets. The successor must have an
   executable transition from stable8 and an owned recovery path. Existing package
   reuse is unproven; if those assets lack the origin, producer release work needs
   separate approval. No release or package version is invented here.
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

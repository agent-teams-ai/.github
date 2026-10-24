# npm publication through GitHub OIDC

The central reusable `.github/workflows/npm-publish.yml` owns archive admission,
registry reconciliation and registry effects. A consumer calls an immutable
reviewed central commit. Consumer repositories own version selection, preparation,
source CI and installed-consumer tests. Engineering Foundation remains the owner
of reusable development tooling; this workflow adds shell orchestration, not a
second tooling package or a production module boundary. The dependency direction
is consumer workflow -> central workflow. Two distinct consumers (Get Modular and
Process Runtime) justify this narrow shared contract. Their product build and
release policy remain local. Foundation's ordered release route is unchanged.

This version deliberately admits stable `major.minor.patch` versions only. A new
schema and reviewed caller migration must precede prerelease or registry changes.
The maintained archive mechanism is small enough to audit without a framework;
its tradeoff is a fixed GitHub-hosted Linux, public npm and archive-only contract.
There is no checkout or execution of consumer code in the credentialed job.

## One-time admission

Each public package must have an npm trusted publisher admitting its consumer
repository, exact caller workflow filename and `npm` GitHub environment (or the
explicit environment input). Configure npm with the supported reusable-workflow
identity semantics; qualification must establish the actual OIDC identity, not
infer it from the YAML. Protect the caller's main branch, release workflow and
environment according to that repository's policy. No automation token, stored
npm credential or per-release interactive approval is part of this mechanism.
Every package namespace must already exist and expose public dist-tags. An npm
account must perform initial package/trusted-publisher admission where npm
requires it; this is distinct from a repeatable trusted publication.

The reusable workflow admits only `agent-teams-ai`, `refs/heads/main` and original
`push` or `workflow_dispatch` events, or a `workflow_run` whose successful
upstream run was a same-repository push on main at the exact release source. It runs on GitHub-hosted `ubuntu-24.04` with
Node 26.11.1 and exact npm 12.2.0. Writes receive only Actions OIDC, read-only GitHub
contents permission, Actions artifact permission and the npm publisher's admitted
package scope. `actions: write` is confined to the publisher job to delete its
exact resolved intent artifacts after durable readback evidence is uploaded.
GitHub grants a broader Actions scope rather than a per-artifact delete grant;
the trusted workflow binds exact ownership immediately before deletion.
Actions are pinned by commit. Consumer jobs should have no `id-token: write`.

Use a workflow-level repository concurrency group with `cancel-in-progress:
false`; do not reuse that group on either called job, which would deadlock the
caller's two phases. Do not cancel an in-flight publication as a recovery tactic.
An external write may have completed even if its CLI failed or was interrupted.

## Caller graph and artifacts

The caller graph must be `prepare -> publish -> installed-consumer -> promote`.
Its normal successful dependency edges are mandatory. Never use `always()` or
`continue-on-error` to bypass an unsuccessful installed-consumer job for promotion.
Gate preparation on the caller's full required source CI and release policy.

Call the same central immutable workflow exactly once per phase per run, with:

- `phase`: `publish`, then `promote`.
- `artifact-name`: the exact same-run preparation artifact name. Include run ID
  and run attempt, for example `npm-release-${{ github.run_id }}-${{ github.run_attempt }}`.
  Artifact names are immutable; evidence is never overwritten on reruns.
- `environment`: optional, defaults to `npm`.

The preparation artifact root contains `release.json` and original `.tgz` archives:

```json
{
  "schemaVersion": 1,
  "repository": "agent-teams-ai/your-repository",
  "source": "<the exact 40-character github.sha>",
  "packages": [{
    "name": "@agent-teams/example",
    "version": "1.2.3",
    "file": "example-1.2.3.tgz",
    "sha256": "<64 lowercase hex characters>",
    "integrity": "sha512-<base64 SHA512 of the exact archive>"
  }]
}
```

The set contains 1-50 packages with unique names/files, safe archive basenames and
at most 100 MiB per archive. Archives contain regular files/directories under
`package/`, exactly one regular `package/package.json`, and no links or traversal.
Package name/version must match. `private: true` rejects. Repository is either the
exact `https://github.com/owner/repo` string or `repository.url`, allowing `git+`
and `.git`. Archive byte hashes, identities and the whole local set validate
before network IO. Existing registry versions must match the exact same bytes;
the whole existing set reconciles before the first write.

Both phases first perform `npm dist-tag ls` for every admitted package under
GitHub OIDC with empty private user/global config and scripts disabled. A public
read can succeed anonymously, so successful exit alone is insufficient: exact
npm 12.2.0 must emit its `oidc Successfully retrieved and set token` diagnostic
after installing the package-specific exchanged token. Missing GitHub OIDC
request authority, failed exchange, any OIDC failure diagnostic or missing success
diagnostic stops the whole set before any upload or tag mutation, including
reconciliation-only runs. Existing
npm token variables and `NPM_ID_TOKEN` are cleared, forcing the GitHub request
route. This does not publish or alter a dist-tag.

Verbose npm diagnostics can contain the private OIDC request URL. They are
captured only in a private runner temporary directory, with a private cache,
empty npmrc files, color disabled and npm log-file creation disabled. No raw
stdout/stderr is printed or uploaded; the directory is removed on success and
failure. The entire npm process is limited to 90 seconds with a five-second KILL
fallback if it ignores TERM; this also bounds the GitHub token GET.
`authority.tsv` retains only package/version and `oidc-exchange-verified`. The marker is an explicit pinned-CLI implementation contract,
reviewed with `lib/utils/oidc.js` and `lib/commands/dist-tag.js`; changing npm
requires requalifying it. This proves a package-specific OIDC token exchange, not
`publish` or `manageDistTags` permission. Those permissions are established only
by their actual operations. Exchange observation also does not prevent external
authority revocation between the check and a later mutation, which performs its
own fresh exchange.

Before any upload, preflight audits up to 100 retained `npm-upload-intent`
artifacts from this repository. It authenticates their publisher workflow ID,
main/source/run origin through the GitHub API. A prior intent for a still-absent
name/version blocks an automatic replay, including across new runs. Invalid,
expired or over-limit unresolved history requires operator reconciliation. The new full-set
intent is uploaded as immutable `npm-upload-intent` **before** the effect step;
a failed intent upload prevents publication. After complete registry readback
and successful registry evidence upload, the job checks the exact intent artifact
ID/name/run/source again and deletes only that resolved intent. Raw intent and
resolution selection remain in the registry evidence artifact. An exact later
reconciliation also retires matching leftover intents from an interrupted cleanup.
No cleanup runs after a partial/failed effect or failed evidence upload. A rerun attempt greater than one
may reconcile existing bytes but cannot upload absent versions.

`publish` uploads absent versions once under `candidate-run-<run_id>`, with
provenance and scripts disabled. A successful upload waits up to 20 minutes for
metadata and complete tarball readback; HTTP 404 during that wait means processing.
Other errors stop. Every upload or tag mutation first re-reads GitHub main and
requires the exact release source; source advancement stops further effects.
No write is automatically retried. On success, the immutable
`<artifact-name>-registry` artifact contains complete downloaded `.tgz` archives,
the original `release.json` and `receipt.json`. The receipt repeats the manifest
and adds `complete: true`, `runId` (string) and `candidateTag`. It certifies observed
registry byte readback, not installed-consumer success. Failed attempts retain
partial evidence and an effects journal; they do not receive a complete receipt.

The caller's installed-consumer job downloads the original and registry artifacts,
checks receipt/source/run and hashes, then installs the downloaded archives in a
clean consumer environment with scripts disabled. It executes the real package
API, CLI or representative package graph. This must use registry readback bytes,
not local build outputs or a repack. It must complete before `promote` is called.

`promote` validates both artifact sets and same-run receipt, reconciles registry
bytes again, then applies `latest` to every exact version. Same-target promotion
is idempotent. A non-stable or newer observed `latest` blocks a downgrade.
Successful tag writes receive up to five minutes of read-only alias reconciliation;
old metadata or HTTP 404 may lag, while read errors and unexpected/newer versions
stop. The tag write is never repeated during this wait. npm has no compare-and-set
for dist-tags, so this observed-version guard cannot exclude an external writer
racing between the final read and mutation. npm cannot atomically
promote a package set. A partial promotion therefore retains evidence and needs
reconciliation; it never claims all-or-nothing rollback. Promotion evidence is
uploaded as `<artifact-name>-promotion` even after failure.

## Qualification and recovery

Run `node --test scripts/npm-publish.test.mts` with the owning Node pin and
`pnpm quality:typecheck` for focused contract verification. The existing `pnpm
check` route includes the typed test and quality gates. Disposable fake registry
tests execute the production shell, but cannot establish real OIDC, provenance,
registry installation or package permissions. Qualification requires one disposable
admitted npm fixture and each real consumer's hosted publish/installed/promote
route. Record exact source, caller/workflow pins, Actions run/attempt, npm versions,
archive hashes, complete readback receipt and observed dist-tags.

After an unsuccessful or interrupted write, inspect the effects journal and query
the exact name/version until the registry's processing window has resolved. Reuse
identical original archives. Never bump or repack merely to hide uncertainty, and
never repeat the upload without first reconciling whether it already exists.
Rerunning with a new attempt artifact name reconciles existing identical versions
without upload. Keep unresolved intent artifacts for their entire uncertainty
lifetime (90-day retention is requested). Before evidence expires or is deleted,
an operator must reconcile it and retain that disposition. Changing the publisher
workflow identity also requires reconciling its retained intents before migration. The API cannot reveal
an already deleted/purged artifact; this bounded artifact-backed guard is not a
permanent exactly-once ledger. Do not claim replay safety after losing that
history. The 100-intent ceiling is an explicit initial operational limit, not
silent history truncation; extending retention/audit or migrating a durable ledger
requires a reviewed contract change. Mismatched immutable bytes require a new deliberately selected
version. Repair a caller consumer-check failure before any promotion; keep the
candidate tag as evidence until the caller's retention policy permits removal.

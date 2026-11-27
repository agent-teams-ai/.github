# Backend stack version catalog

Owner direction proposed on 2026-11-27. This is the shared version-selection
reference for the technologies in [Backend Stack](backend-stack.md), not a
fleet lockfile or a production admission record.

## How agents choose a version

1. Read the target repository's applicable architecture, current manifest,
   lockfile and accepted dependency decisions. Read this catalog and its
   linked evidence before adding or changing an applicable dependency.
2. At the start of the change, query the official registry or release channel.
   Verify the newest published eligible version, release date, provenance,
   engine and peer requirements, security advisories and compatibility.
   A recorded version is a reference point, not a maximum. Prefer the
   newest compatible release within the selected channel and scope.
3. The ordinary channel is stable/GA. Use a newer major for a greenfield
   consumer after relevant qualification. For existing deployments, review
   compatibility, migrations and rollback before changing a major. A
   pre-release is eligible only for an explicitly selected channel or
   documented owner decision; never select a random alpha, beta or
   commit-suffixed build because it sorts higher. Drizzle 1.0 RC and the
   embedded PostgreSQL wrapper have explicit provisional directions below.
4. Reuse the latest applicable cross-repository evidence, without confusing
   a published version or historical probe with current qualification.
   Qualify the exact package family, compiler/runtime and real affected
   behavior. Do not downgrade strictness or conceal dependency failures.
   If the newest candidate fails, record the exact failing tuple, diagnostics
   and reason, then try the newest compatible supported candidate or retain
   the accepted contingency. No unrelated feature or release is blocked by
   an optional speculative upgrade.
5. Pin the exact selected versions in the consumer's existing package manager
   and lockfile. Do not commit floating registry tags, regenerate released
   migrations, or modify an unrelated consumer automatically. Group coupled
   packages in one compatible update. Apply existing security, admission,
   Docs Cohort, FMS and review rules; this catalog creates no exception.
6. When a shared candidate or evidence changes, update this catalog through
   one scoped central PR linking the authoritative result. Reference it from
   consumer adoption records instead of copying a new competing version
   table. Consumer pins remain independently reviewable and may converge
   gradually.

## Recommended candidates and evidence

Initial observations on 2026-11-27. The table records exact candidates to
evaluate first, not a mandate to install all entries. A released candidate
is not a qualified candidate. Historical test or lockfile evidence is scoped
to the cited source and does not qualify a new consumer. Refresh upstream
metadata on each relevant task even if this table has not yet been updated.

| Technology / channel | Exact candidate or reference | Evidence and boundary |
| --- | --- | --- |
| Node.js | 26.11.1 tooling; 24.21.0 compatibility | [Owning Node profile](node-runtime-compatibility.md). Product production runtimes retain their accepted supported lanes. |
| TypeScript / Oxlint / Oxfmt | Use the exact [Stack Toolchain manifest](https://github.com/agent-teams-ai/engineering-foundation/blob/main/packages/stack-toolchain/toolchain-manifest.json) of the adopted release | Do not duplicate compiler/tool pins here; use the owning [tooling catalog](development-tools.md) and qualified release. |
| Engineering Foundation / Stack Toolchain / FMS | 4.0.2 / 0.3.1 / 0.4.3 | Observed together in [Identity #2's locked graph](https://github.com/agent-teams-ai/identity/blob/eb002b18176f34de26248c8cd12ea6cc9d8d455f/pnpm-lock.yaml); consumer and central admission remain separate. Follow Docs Cohort rules where applicable. |
| Get Modular | core and assembly 0.8.0; resources 0.2.2; conformance 0.5.2 | Observed in the same Identity candidate. Verify current public exports, consumer module standard and the compatible package family. |
| Fastify stable | 5.12.8 | [npm](https://www.npmjs.com/package/fastify?activeTab=versions); observed Identity HTTP host candidate. |
| Connect ES stable | connect, connect-node and connect-fastify 2.3.0 | [npm](https://www.npmjs.com/package/@connectrpc/connect); observed Identity family. Install only applicable adapters. |
| Protobuf ES / Buf stable | @bufbuild/protobuf and protoc-gen-es 2.17.0; @bufbuild/buf 1.75.0 | [Protobuf](https://www.npmjs.com/package/@bufbuild/protobuf), [Buf](https://www.npmjs.com/package/@bufbuild/buf); observed Identity graph. Keep generation and wire tests coupled. |
| PostgreSQL stable | 19.0 new-major candidate; 18.7 existing 18.x candidate | [19 GA](https://www.postgresql.org/about/news/postgresql-19-released-3449/), [18.7](https://www.postgresql.org/docs/18/release-18-7.html). Identity's actual 18.7 test evidence is not qualification of 19. |
| node-postgres stable | pg 8.23.1 | [npm](https://www.npmjs.com/package/pg?activeTab=versions); observed in Orchestrator main and Identity candidate. Keep transaction ownership and precise codecs. |
| Drizzle ORM / Kit, selected 1.0 RC | drizzle-orm and drizzle-kit 1.0.0-rc.6 | [Upstream RC.6](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1rc6); latest observed 1.0 RC, qualification pending. See below. |
| Embedded PostgreSQL wrapper, provisional beta | embedded-postgres 19.0.0-beta.20; 18.7.0-beta.19 for 18.x | [npm](https://www.npmjs.com/package/embedded-postgres?activeTab=versions). Actual engine/platform payload, offline lifecycle and restore qualification required; not released product pins. |
| Dapr stable | 1.19.2 | [Release](https://github.com/dapr/dapr/releases/tag/v1.19.2). Actual private invocation boundary and topology qualification required. |
| NATS server stable | 2.15.3 | [Release](https://github.com/nats-io/nats-server/releases/tag/v2.15.3). JetStream durability and local lifecycle qualification required. |
| NATS Node SDK stable | @nats-io/nats-core, transport-node, jetstream 3.5.0 | [Release](https://github.com/nats-io/nats.js/releases/tag/v3.5.0); matching source manifests in that tag. Install only necessary modules; verify registry artifacts. |
| Temporal stable | server 1.32.2; TypeScript client/worker/workflow 1.24.0 observed baseline | [Server release](https://github.com/temporalio/temporal/releases/tag/v1.32.2); [Orchestrator lockfile](https://github.com/agent-teams-ai/agent-teams-orchestrator/blob/296173655e886896ebc24c472cf71e4c7f8faa66/pnpm-lock.yaml). Recheck SDK family and server compatibility. |
| Centrifugo stable | 6.10.3 | [Release](https://github.com/centrifugal/centrifugo/releases/tag/v6.10.3); proposed evaluation, not an adopted fleet deployment. |
| Keycloak / OpenFGA stable, provisional IAM direction | 26.8.2 / 1.23.0 | [Keycloak](https://github.com/keycloak/keycloak/releases/tag/26.8.2), [OpenFGA](https://github.com/openfga/openfga/releases/tag/v1.23.0). Separate identity, authorization and deployment qualification; no automatic IAM adoption. |
| JOSE stable | 6.2.18 | Observed in Identity candidate; use the maintained JWT/JWKS library only at the owning security boundary. |

For Docker Compose, Kubernetes, language-specific SDKs, native binaries and
deployment images, the owning profile selects the exact versions, image
digests and artifact integrity after reviewing its deployment requirements.
Do not infer a qualified image from a release tag. LangGraph is not selected;
do not install or assign an adoption version by default.

### Drizzle qualification — first shared candidate

[Orchestrator ADR-0052](https://github.com/agent-teams-ai/agent-teams-orchestrator/blob/296173655e886896ebc24c472cf71e4c7f8faa66/docs/decisions/0052-adapter-local-drizzle-and-bounded-dialect-duplication.md)
and [Runtime S2](https://github.com/agent-teams-ai/agent-runtime/blob/e7fa39a169277089fc10dbe6f679d49f537c9539/docs/architecture/agent-runtime-architecture-program-s2-operations-storage.md)
selected the historical exact RC.4 baseline.
[Orchestrator OD-003](https://github.com/agent-teams-ai/agent-teams-orchestrator/blob/296173655e886896ebc24c472cf71e4c7f8faa66/docs/open-decisions/OD-003-persistence-composition.md)
reports 25/25 historical SQLite/PostgreSQL semantic scenarios.
[Runtime storage verification](https://github.com/agent-teams-ai/agent-runtime/blob/e7fa39a169277089fc10dbe6f679d49f537c9539/research/architecture-critique-2026-10/storage-verification/storage-report.md)
reports 47 vendor declaration diagnostics with strict TS 7.0.2 for RC.4 and
73 for 0.45.3. These are not current qualification.
[Identity ADR-0002](https://github.com/agent-teams-ai/identity/blob/eb002b18176f34de26248c8cd12ea6cc9d8d455f/docs/decisions/0002-native-postgres-first-slice.md)
records 72 diagnostics for 0.45.4 (original logs unavailable) and the accepted
native pg contingency.

Evaluate RC.6 first with the current strict Stack compiler, actual PostgreSQL
adapter imports, migration tooling if used, and retained full diagnostics.
Cover real transaction rollback, concurrency, receipt/revision/fencing,
precision, error redaction, ambiguous commit and migration integrity as
applicable. RC.6 changes PostgreSQL decoding, migration/snapshot and ESM
behavior; review the release notes rather than assuming patch compatibility.
Keep the one checked-out client and existing semantic transaction owner;
do not blindly replace it with an ORM transaction or migrator. Keep Drizzle
inside the persistence adapter. Use the accepted direct pg contingency until
the replacement passes, and do not maintain two production implementations
in parallel.

## Repository synchronization

The [observed repository version dashboard](https://github.com/agent-teams-ai/.github/issues/473)
is a derived, read-only view, not another version authority. Initial scope:
Orchestrator, Runtime, Platform, Identity, Account Gateway. It records source
commit/ref, direct lockfile importer resolutions, native pins where evidenced,
planned/draft versus merged state and missing or inaccessible evidence.
Expand the scope to other applicable repositories explicitly; exclude private
source details from this public dashboard.

Refresh the dashboard daily or on demand by reading the current default
branch and named active adoption PRs at exact commit SHAs. Use the existing
repository inventory for discovery, and manifests/lockfiles (or equivalent
language-native locks) for versions. Do not infer installed or deployed
versions from a catalog entry. Separate unavailable, absent and not applicable
states. Update one dashboard in place; retain source links and mark stale
observations. Flag newer eligible releases, mismatched package families,
and divergence from the recommendation. Distinguish expected differences
from pending adoption; report drift, do not automatically block or rewrite
consumer builds.

Use the existing [Renovate preset](../renovate-config.json) for dependency
update proposals wherever adopted; preserve managed Docs Cohort exceptions
and exact version pinning. Where Renovate is not yet installed and verified,
follow the current security update owner in [Governance](../GOVERNANCE.md).
The shared dashboard is visibility only, not another dependency updater.
Foundation's existing workspace dependency declaration capability validates
local declarations where adopted. No additional mandatory gate, scheduler
service, shared lockfile, new package manager or fleet-wide forced update is
introduced. Any future automated enforcement must have concrete adoption,
deterministic tests and its existing owner.

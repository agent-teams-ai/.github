# Technology Stack Catalog

The single entrypoint for shared technology choices, recommended versions,
release channels, qualification evidence and observed repository versions
across Agent Teams. It covers backend, web/frontend, desktop, mobile,
shared libraries, native/runtime and development tools as those choices
are actually made. It is not a universal lockfile or a product architecture
decision.

## Catalog sections

| Area | Canonical source |
| --- | --- |
| Backend, storage, messaging, identity, infrastructure | [Backend roles](backend-stack.md) and [exact backend version candidates](backend-stack-versions.md) |
| Development toolchain and quality | [Development tools](development-tools.md) and the adopted [Stack Toolchain manifest](https://github.com/agent-teams-ai/engineering-foundation/blob/main/packages/stack-toolchain/toolchain-manifest.json) |
| Node runtime profiles | [Node runtime compatibility](node-runtime-compatibility.md) |
| Shared library ownership and consumers | [Ecosystem ownership map](architecture/ecosystem-vision.md); exact shared candidates belong in the relevant catalog section, not duplicate owner tables |
| Web, desktop and mobile | [Observed versions](https://github.com/agent-teams-ai/.github/issues/473); no new shared UI baseline is selected by this catalog. Use the owning product's accepted choices and lockfile. |

Do not infer that a backend choice applies to a UI, that a legacy product's
dependency is a greenfield recommendation, or that an observed release
is qualified. Keep one version authority per tool family. A section can
be split when useful for navigation, not copied into another table.

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
   commit-suffixed build because it sorts higher. The relevant technology
   section records any explicitly selected non-GA channel.
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
6. When a shared candidate or evidence changes, record a reviewed update in
   the owning catalog section, preferably in an existing related central PR
   linking the authoritative result. Reference it from
   consumer adoption records instead of copying a new competing version
   table. Consumer pins remain independently reviewable and may converge
   gradually.

## Agent and synchronization workflow

- Before selecting or changing a shared technology, use this entrypoint
  and its owning section. For an unrelated feature or private dependency,
  use the target repository's normal dependency policy; do not inventory
  every transitive package or trigger organization-wide upgrades.
- When introducing a new shared selection or changing its recommendation,
  update the existing relevant section with exact package/artifact name,
  version, channel, source/date and qualification status. Prefer one
  coherent related PR rather than separate paperwork for each local pin.
- Consumer manifests and lockfiles are the source of actual versions.
  Never hand-maintain a second version matrix in product documentation.
  The [repository version dashboard](https://github.com/agent-teams-ai/.github/issues/473)
  is derived from immutable source observations. The covered repositories
  and exact observations are listed in that single dashboard, not copied here.
- Use the [repository synchronization route](#repository-synchronization)
  and the shared Renovate preset for update proposals; where adopted, use
  Foundation's local declaration checks. Observe changes automatically,
  keep the reviewed catalog and local adoption explicit, and do not add
  a new service, custom package manager, mandatory gate or global lockfile.

The first implementation is documentation plus the existing read-only
dashboard. A future deterministic reporter is optional if the current
observer proves insufficient; it should reuse existing parsers and
repository discovery rather than duplicate dependency management.

## Repository synchronization

The [observed repository version dashboard](https://github.com/agent-teams-ai/.github/issues/473)
is a derived, read-only view, not another version authority. The eight initial
public repositories include the five backend repositories, Review Router,
GetTok and the legacy desktop reference. The dashboard owns the coverage list.
It records source commit/ref, direct lockfile importer resolutions, native pins
where evidenced, planned/draft versus merged state and missing or inaccessible
evidence. If an application lock is missing, label manifest ranges as declared,
not resolved. Keep legacy observations distinct from greenfield recommendations.
Expand scope explicitly; exclude private source details from the public dashboard.

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

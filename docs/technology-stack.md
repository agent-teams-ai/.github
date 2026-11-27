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
| Web, desktop and mobile | Not yet cataloged centrally; use the owning product's accepted choices and exact manifest/lockfile. Add a shared entry when a cross-product selection is actually reviewed. |

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
   commit-suffixed build because it sorts higher. The relevant technology section records any explicitly selected non-GA channel.
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
6. When a shared candidate or evidence changes, record a reviewed update in the owning catalog section, preferably in an
   existing related central PR linking the authoritative result. Reference it from
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
  is derived from immutable source observations. Its initial five-repository
  backend scope remains unchanged until explicitly extended to applicable
  UI, native and other products.
- Use the [existing synchronization route](backend-stack-versions.md#repository-synchronization)
  and the shared Renovate preset for update proposals; where adopted, use
  Foundation's local declaration checks. Observe changes automatically,
  keep the reviewed catalog and local adoption explicit, and do not add
  a new service, custom package manager, mandatory gate or global lockfile.

The first implementation is documentation plus the existing read-only
dashboard. A future deterministic reporter is optional if the current
observer proves insufficient; it should reuse existing parsers and
repository discovery rather than duplicate dependency management.

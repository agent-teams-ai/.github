# Development tools catalog

Read this catalog before choosing or duplicating shared development tooling.
The [universal tooling rule](engineering-quality-standard.md#universal-tooling-and-discoverability)
owns portability, naming and documentation requirements. This catalog routes
agents to the tool owner; it does not activate a package or certify a consumer.

## Choose a tool

| Need | Owner and guide | Availability |
| --- | --- | --- |
| Reusable repository validation, source boundaries, quality coverage, governance and quality-gate composition | [Engineering Foundation README](https://github.com/agent-teams-ai/engineering-foundation#readme) | Existing tooling; use the exact released version and capabilities adopted by the target repository |
| Node/Bun process execution as an explicit mechanism | [node-or-bun README](https://github.com/agent-teams-ai/node-or-bun#readme) | Published mechanism; verify its current support matrix and the consumer's exact pin |
| Central versions, stack presets and stable commands for JS/TS type checking, linting, formatting and compilation | [Planned Stack Toolchain](#planned-stack-toolchain) | Planned; no installation or adoption is available from this entry |

Start with the target repository's AGENTS.md, README, scripts and accepted
profiles. Follow the owning tool guide, verify its released version, and apply
the repository's adoption procedure. Prefer an appropriate existing shared tool
over a consumer-local copy. A planned tool does not replace working commands:
continue using the target repository's current supported tooling until its
replacement is released and explicitly adopted.

## Planned Stack Toolchain

Status: design work, not implemented or published by this delivery.
Stack Toolchain is a working descriptive name. `stack-toolchain` is a package
and CLI candidate, not a reserved or verified publication identity. Do not
install that name based on this catalog. Implementation is owned by the
[Engineering Foundation repository](https://github.com/agent-teams-ai/engineering-foundation).

The tool is intended for ordinary JS/TS projects that repeat tool versions,
presets and check scripts, and need one versioned dependency with stable
commands. It is intended to work independently of Foundation, its quality-gate
runner and organization-specific governance. Repository ownership does not
limit it to this organization.

The initial scope is Node/Bun profiles, type checking, linting, format checking
and TypeScript compilation. The tool owns versions, technical defaults, engine
adapters and fallback classification. Consumers own tsconfig, source paths,
environment types, build outputs, test suites and product policy. Other stack
profiles require a concrete consumer; unrelated toolchains must not become
mandatory downloads for every project.

The proposed normal typecheck route is sequential:

1. Run tsrs. On success, stop; do not run Bun or TypeScript afterward.
2. Only after a classified engine failure or unavailability, try Bun check.
   On success, stop; do not run TypeScript afterward.
3. Only if both earlier engines are unavailable or have classified engine
   failures, try the pinned official TypeScript 7.0.2 checker.

Source diagnostics, invalid configuration, cancellation and uncertain cleanup
fail the command; they are not reasons to search for a passing checker.
The actual engine and any fallback reason remain visible. Compiler versions
can have different language behavior; qualification of selected scenarios is
not a claim of complete semantic equivalence. Forced-engine comparisons belong
to release qualification, not every consumer invocation.

Read-only typecheck and output-producing compile are separate commands.
The first source-only typecheck profile excludes project references; existing
reference-graph build gates remain required. The tool will not add a mandatory
full build before every fast typecheck or replace product test orchestration.

Before implementation, add the package README with purpose, use cases,
supported tasks, consumer configuration, limits and availability. Before
publication, finish package/native qualification and real consumer checks.
Only after verified publication should this entry link the exact package and
its canonical installation/adoption guide. Keep detailed released usage in
that owning README rather than maintaining a second copy here.

## Agent navigation

Organization AGENTS.md links here directly. Other repositories that explicitly
read the Engineering Quality Standard reach this catalog through its required
tooling route. GitHub does not inject these instructions into every session.
If a repository lacks that route, add an explicit link through its normal
instruction update; do not assume automatic discovery or silently adopt tools.

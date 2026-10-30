# Development tools catalog

Read this catalog before choosing or duplicating shared development tooling.
The [universal tooling rule](engineering-quality-standard.md#universal-tooling-and-discoverability)
owns portability, naming and documentation requirements. This catalog routes
agents to the tool owner; it does not activate a package or certify a consumer.

## Choose a tool

| Need                                                                                                         | Owner and guide                                                                                  | Availability                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Reusable repository validation, source boundaries, quality coverage, governance and quality-gate composition | [Engineering Foundation README](https://github.com/agent-teams-ai/engineering-foundation#readme) | Existing tooling; use the exact released version and capabilities adopted by the target repository |
| New owned repository configuration and explicit FMS/Foundation/CI bootstrap | [New repository bootstrap](repository-admission.md#new-repository-bootstrap) | Central source checker and inputless reusable workflow; supported JS/TS pnpm/Bun configuration only, never qualification |
| Node/Bun process execution as an explicit mechanism                                                          | [node-or-bun README](https://github.com/agent-teams-ai/node-or-bun#readme)                       | Published mechanism; verify its current support matrix and the consumer's exact pin                |
| Versioned tools, technical presets and commands for JS/TS checking, linting, formatting and compilation      | [Stack Toolchain](#stack-toolchain)                                                              | Published supported `0.1.1`; consumer adoption remains explicit                                    |

Start with the target repository's AGENTS.md, README, scripts and accepted
profiles. Follow the owning tool guide, verify its released version, and apply
the repository's adoption procedure. Prefer an appropriate existing shared tool
over a consumer-local copy. Continue using the repository's supported tooling
until a replacement has a qualified supported release and is explicitly adopted.

## Stack Toolchain

Status observed on 2026-10-25: `stack-toolchain@0.1.1` is a qualified supported
public release on [npm](https://www.npmjs.com/package/stack-toolchain/v/0.1.1),
with its [GitHub release](https://github.com/agent-teams-ai/engineering-foundation/releases/tag/stack-toolchain%400.1.1)
bound to source `23b5a885ba46a2b43b5715ce82db28fcf04f2175`.
The [released package README](https://github.com/agent-teams-ai/engineering-foundation/blob/23b5a885ba46a2b43b5715ce82db28fcf04f2175/packages/stack-toolchain/README.md)
is the owning guide to exact installation, commands, presets, configuration and
limits. Use it when projects repeat compiler/linter versions, technical presets
and package scripts; upgrade the exact development dependency and lockfile
through the consumer's adoption procedure.

The same [published release run](https://github.com/agent-teams-ai/engineering-foundation/actions/runs/40187728694/attempts/1)
produced `@agent-teams/engineering-foundation@3.0.0`,
`@agent-teams/feature-module-standard@0.3.0` and `stack-toolchain@0.1.1`.
Its companion releases are `@agent-teams/docs-protocol@0.6.6`,
`@agent-teams/docs-protocol-agent-teams@0.5.5`,
`@agent-teams/docs-protocol-mcp@0.2.9`, `@agent-teams/release-checks@0.1.0`,
`@agent-teams/ci-input-proof@0.1.3`, `@agent-teams/repository-mutation@0.4.2`
and `@agent-teams/document-authoring@0.3.6`. These are availability coordinates,
not a requirement to install the entire set or a new Docs Cohort admission.

The earlier `0.0.0-stage` and `0.0.0` artifacts are unsupported bootstrap versions;
use the supported release rather than those artifacts. Publication does not
qualify a consumer's Foundation 3 migration, node-or-bun development-tool adoption,
Get Modular adoption or the repository fleet rollout. Each remains subject to
its own exact pins, reviewed migration and required gates; this catalog records
no new consumer adoption.

The released Node/Bun profiles provide read-only type checking, linting,
format checking, explicit TypeScript compilation and diagnostic commands.
Technical TypeScript and Oxlint presets are included. The CLI runs on supported
Node.js 24 (24.18.0 or newer) and Node.js 26; Bun is an installed checker
fallback, not the CLI host. Read-only type checking accepts standalone projects,
rejects project references and effective `noCheck: true`, and tries tsrs,
then Bun only after classified engine failure or unavailability, then the pinned
official TypeScript checker only if both earlier engines have classified engine
failures or are unavailable.
Success stops the chain. Source diagnostics, invalid configuration, cancellation,
incomplete capture and uncertain cleanup remain failures. Read-only checking
and reference-graph builds remain separate; consumers retain existing build and
test gates. See the released README for exact supported behavior, rather
than a second version table or command recipe here.

Choose the standalone `stack-toolchain` package when only technical JS/TS
checking, linting, formatting or compilation is needed; Foundation is appropriate
when the consumer also explicitly adopts its conformance capabilities.
The package is for ordinary independent projects and does not require Foundation,
organization credentials, governance admission or a product-specific runtime.
Consumers own source paths, tsconfig, ambient types, outputs, tests and product
policy. Additional profiles require a concrete consumer.

## Responsibilities

- Stack Toolchain owns its versioned tool set, technical presets, commands,
  executable resolution, diagnostics and classified checker fallback.
- pnpm catalogs and workspace declarations own a repository's declared dependency
  coordinates and workspace relationships; they do not execute its quality gates.
- Where adopted, Foundation's existing `workspace.dependency-declarations`
  capability checks the consumer's declaration policy. The repository's CI and
  frozen-lock installation checks enforce its reviewed dependency graph and gates.
- Where adopted, the [shared Renovate preset](../renovate-config.json) supplies
  dependency update proposals under the consumer's review and CI. Managed Docs
  Cohort packages continue through qualified Cohort proposals under that preset's
  existing policy.

These responsibilities leave application libraries and repository-specific
technology choices with their owners. A catalog entry does not adopt a tool,
change a consumer pin or replace its working checks.

## Agent navigation

Organization AGENTS.md links here directly. Other repositories that explicitly
read the Engineering Quality Standard reach this catalog through its required
tooling route. GitHub does not inject these instructions into every session.
If a repository lacks that route, add an explicit link through its normal
instruction update; do not assume automatic discovery or silently adopt tools.

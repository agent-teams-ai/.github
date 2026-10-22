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
| Versioned tools, technical presets and commands for JS/TS checking, linting, formatting and compilation      | [Stack Toolchain](#stack-toolchain)                                                              | Implemented source; bootstrap versions only; supported release and adoption pending                |

Start with the target repository's AGENTS.md, README, scripts and accepted
profiles. Follow the owning tool guide, verify its released version, and apply
the repository's adoption procedure. Prefer an appropriate existing shared tool
over a consumer-local copy. Continue using the repository's supported tooling
until a replacement has a qualified supported release and is explicitly adopted.

## Stack Toolchain

Status observed on 2026-10-22: the core `stack-toolchain` package and CLI are
implemented on Engineering Foundation main at
[`67ccfb359fa2112e7a3554576391d4369477f937`](https://github.com/agent-teams-ai/engineering-foundation/commit/67ccfb359fa2112e7a3554576391d4369477f937),
with package tree `828fc03cc56bd30b2800ea101effba9da7facaef`.
The [owning package README](https://github.com/agent-teams-ai/engineering-foundation/blob/main/packages/stack-toolchain/README.md)
is the canonical guide to its commands, presets, configuration and limits.

The observed registry contains only `0.0.0-stage` and `0.0.0`, with `latest`
and `bootstrap` targeting `0.0.0`. These are bootstrap artifacts, not supported
releases. Canonical bootstrap recovery, a qualified supported `0.1.0` release
and consumer adoption remain pending. Do not install the bootstrap artifacts or
use the README's future-release examples as availability proof. This catalog
recommends installation only after qualified supported publication and the
consumer's explicit adoption procedure.

The implemented Node/Bun profiles provide read-only type checking, linting,
format checking, explicit TypeScript compilation and diagnostic commands.
Technical TypeScript and Oxlint presets are included. Type checking tries tsrs,
then Bun only after classified engine failure or unavailability, then the pinned
official TypeScript checker only if both earlier engines have classified engine
failures or are unavailable.
Success stops the chain. Source diagnostics, invalid configuration, cancellation,
incomplete capture and uncertain cleanup remain failures. Read-only checking
and reference-graph builds remain separate; consumers retain existing build and
test gates. See the owning README for exact supported source behavior, rather
than a second version table or command recipe here.

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

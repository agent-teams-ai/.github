# Agent Navigation

Use the [documentation map](docs/README.md) to select the applicable organization policy, standard or evidence.

This repository owns organization-wide defaults and immutable shared
architecture standards. It does not own product-specific architecture.

For new owned production repositories and explicit older opt-ins, start at
[new repository bootstrap](docs/repository-admission.md#new-repository-bootstrap).
Install its explicit FMS, Foundation and CI configuration; GitHub does not
automatically inherit those artifacts or required checks.

For every assigned task, follow the [task-scope boundary](docs/engineering-quality-standard.md#task-scope-and-obvious-corrections).
A plan or open decision does not assign additional work to an agent.

For cross-repository planning, read the [Foundation-first ecosystem vision](docs/architecture/ecosystem-vision.md)
first. Preserve its library-first direction, owner boundaries, and separate
qualification and adoption gates.

For runtime, native/AOT, Wasm or cross-language architecture choices, read
[Native and AOT readiness](docs/engineering-quality-standard.md#native-and-aot-readiness)
and the [scoped delivery plan](docs/architecture/native-readiness-plan.md).
Keep ordinary feature authoring ergonomic; do not infer compiler adoption.

Before changing governance or architecture material, read
[the repository map](README.md), [governance boundaries](GOVERNANCE.md), and
[contribution rules](CONTRIBUTING.md).

For new product architecture and shared-library research, follow the
[greenfield product scope and legacy-reference boundary](README.md#new-product-scope-and-legacy-references)
before selecting the implementation repository or first consumer.

Before choosing or duplicating reusable development tooling, read the
[development tools catalog](docs/development-tools.md) and follow its link to
the owning guide. Check availability and repository adoption before using a tool.

Before choosing or updating shared technologies, read the
[Technology Stack Catalog](docs/technology-stack.md) and its owning section.
Check the newest eligible release in its approved channel, reuse existing
qualification evidence, and pin the tested version. For backend choices,
also read the [backend stack reference](docs/backend-stack.md).
Apply the target repository's explicit adoption and existing decisions;
do not install the entire stack or change unrelated pins.

For feature-module architecture:

1. Start at the [Feature Module Standard index](docs/architecture/feature-module-standard/README.md).
2. Treat every published version, including [v1](docs/architecture/feature-module-standard/v1.md),
   as byte-immutable.
3. Publish changed requirements as a new version and append its exact metadata
   to [`governance/feature-module-standard.json`](governance/feature-module-standard.json).
4. Never apply a central successor silently. Each consumer repository owns its
   local adoption profile, decision, agent route, and deterministic gates.
5. Run `node tools/feature-module-standard/check.mjs` and
   `node --test tools/feature-module-standard/check.test.mjs` for focused
   validation, then run `pnpm check` before proposing a merge. Append-only
   validation requires full Git history; the required CI workflow checks out
   `fetch-depth: 0`.

For governance JavaScript quality, read
[the consumer quality route](docs/engineering-quality.md) and
[its profile](docs/engineering-quality-profile.json). Use the owning
`.node-version` tooling pin for the focused quality commands in that guide and
`pnpm check` (complete); the repository default is Node 26.11.1 while package
engines keep Node 24 compatibility. Preserve its exact required identities
and selected entry files.
Read the quality route's current compiler dependency preflight before invoking
Foundation; never bypass its metadata preflight to run an installed CLI.

For new or changed maintained code targeting JavaScript runtimes, follow
[TypeScript for JavaScript runtimes](docs/engineering-quality-standard.md#typescript-for-javascript-runtimes),
including source coverage in the owning strict typecheck and the scoped
JavaScript fixture/host cases. Existing JavaScript tooling is not an exemption
for new helpers.

For substantive unresolved architecture decisions, follow the
[owner-facing comparison and estimate rule](docs/engineering-quality-standard.md#owner-facing-architecture-decisions-and-estimates).
Use it to describe unresolved choices within the assignment; it grants no
implementation, adoption or release authority.

<!-- agent-teams:quality-standard:start -->
Before planning, implementing, or reviewing changes, read and follow the
[organization Engineering Quality Standard](https://github.com/agent-teams-ai/.github/blob/main/docs/engineering-quality-standard.md).
Apply it with this repository's instructions, accepted decisions and local
adoption profiles. This reference does not change pinned architecture contracts
or certify existing code as conformant.
<!-- agent-teams:quality-standard:end -->

For owner PR merges, follow the [authorship policy](GOVERNANCE.md#commit-and-pull-request-authorship).
ChatGPT agents without `gh` may use the connected GitHub plugin through the
[plugin merge route](GOVERNANCE.md#github-plugin-merge-route); missing CLI or
author-email input alone is not a blocker.

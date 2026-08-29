# Agent Navigation

This repository owns organization-wide defaults and immutable shared
architecture standards. It does not own product-specific architecture.

Before changing governance or architecture material, read
[the repository map](README.md), [governance boundaries](GOVERNANCE.md), and
[contribution rules](CONTRIBUTING.md).

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

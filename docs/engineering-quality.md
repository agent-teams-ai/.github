# Governance JavaScript quality

Central keeps governance semantics in its existing validators. The required
`pnpm check` route statically admits every tracked JavaScript or TypeScript
source and runs Oxlint 1.85.0 over the exact tooling paths derived from that
census.

Central actively adopts the released Engineering Foundation 1.5.0 public Node
preset. Its consumer profile classifies tracked non-test `scripts/*.mjs` files
and the Feature Module Standard checker as tooling, and classifies their test
files as tests. JSON, YAML, and Markdown authority are non-source. The profile
makes no production-source or typed-coverage claim.

Foundation supplies reusable build-time lint policy; it does not own or
reinterpret Central governance, Cohort, inventory, policy, or Feature Module
Standard semantics. Those remain enforced by their existing independent gates.

Run `pnpm check` for the complete required route. Run
`pnpm quality:check` only for the focused source-adoption tests and lint gate.
The check prehook validates the adoption statically; the check body runs lint
once before the unchanged Renovate, governance, Cohort, community-file,
ReviewRouter, and generic test gates.

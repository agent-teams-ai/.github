# Governance JavaScript quality

Central keeps governance semantics in its existing validators. The required
`pnpm check` route now also admits every tracked JavaScript source and runs
Oxlint 1.85.0 over `scripts` and the Feature Module Standard checker.

The released Engineering Foundation 1.5.0 Node preset was tested first. It
reported 352 existing diagnostics across the governance tooling, which exceeds
this rollout's bounded remediation budget. Central therefore uses the accepted
`active-equivalent` fallback: exact protected rules, independent source
completeness, fail-closed route checks, and consumer-owned rejecting tests.
It does not claim TypeScript or compiler coverage and does not let lint replace
governance, cohort, Renovate, community-file, ReviewRouter, or FMS validation.

Run `pnpm check` for the complete required route. Run
`pnpm quality:check` only for the focused source and lint gate. Revisit the
public Foundation preset when its existing diagnostics can be remediated in a
bounded owner slice without changing authority bytes.

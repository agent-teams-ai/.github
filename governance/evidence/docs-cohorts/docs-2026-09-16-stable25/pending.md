# stable25 Token preparation

This is an inert pre-publication handoff for the planned
`docs-2026-09-16-stable25` Token canary. It records the intended five-coordinate
Cohort v2 tuple and the exact migration and rollback edge from Token's current
`docs-2026-09-12-stable21` binding. It is supporting preparation evidence only.
It is not a Qualified Docs Cohort record, lifecycle event, policy selection,
consumer observation, or package-publication claim.

The changed roots are planned as
`@agent-teams/docs-protocol-agent-teams@0.2.9` and
`@agent-teams/engineering-foundation@1.4.0`. Neither version was present in the
public npm registry during preparation. Their SRI, publication timestamps,
signed provenance, release runs, published adapter assets, stable21 transition
bundle, and runtime closure therefore cannot be filled from authority. The
registry schema requires those facts for a real Cohort record, and the first
lifecycle state is `PUBLISHED_UNQUALIFIED`; placeholders would create a false
publication claim.

After both packages are public, construct the immutable record with the
stable23 publication pattern and the stable24 consumer-specific transition
pattern. The adapter tarball must contain a direct stable21 transition bundle.
Run the live Cohort verifier, append the record and lifecycle events against the
then-current tail, and let trusted exact-head CI verify publication, signatures,
provenance, assets, workflow authority, runtime closure, digests, and append-only
history. Only after stable25 reaches `QUALIFIED` may a separate central policy
change select it for Token as `rollout_pending`, preserving observed stable21.
Only successful qualification and semantic checks on Token's public default
branch permit a later observation change to `bound`.

The authoritative Cohort registry and admission policy are intentionally
unchanged. Stable21, stable23, stable24, the exact Token repository identity and
public visibility, and deleted repository tombstones retain their accepted
bytes. No Token repository change, publication, selection, activation, or
observation is included.

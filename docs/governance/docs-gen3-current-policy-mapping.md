# Generation 3 Current Policy Mapping

Status: mapping-only; genuine qualification and production publication are pending.

This document is the current central guidance for mapping the closed
snake-case `governance/docs-qualified-cohorts.json` record shape to the existing
Agent `qualified-docs-cohort/v3` nominal shape. It is not a qualification
receipt, production record, policy publication, or release claim.

## Authorized current identity

- Policy identity: `agent-teams.docs-protocol-current-policy`, version `3.0.0`.
- Authorized policy/schema metadata: policy generation `3`, schema generation `3`.
- Cohort digest domain: `agent-teams.docs-qualified-cohort/v3`.
- Cohort schema: generation `3`.
- Current managed lane: `node-26-managed-qualified`.
- Node range: `>=26.0.0 <27`.
- pnpm range: `>=11.17.0 <12`.
- Exact observed qualification tuple: Node `26.11.1`, pnpm `11.20.0`,
  platform `linux`, architecture `x64`.
- Runtime closure identity: domain `agent-teams.docs-runtime-closure/v2`,
  package manager `pnpm@11.20.0`, lockfile version `9.0`.
- Package closure: exactly five existing package coordinates and exactly seven
  existing internal dependency edges. Generation 3 does not add a sixth
  coordinate.
- Schema tuple: consumer integration `4`, managed state `3`, qualification
  receipt `1`, docs protocol `1`.
- `managedCandidate.selected` is `false` until genuine qualification evidence
  exists. The identifier `node-24-production-default` remains a retained legacy
  nominal identifier and is not the current default claim.

The current consumer-policy generation 3 pair is closed to desired/observed
generation `3` and qualification coordinates profile `4`, Cohort `3`, managed
state `3`, qualification receipt `1`, execution envelope `1`, evidence class
`cohort-v3-supporting-canary`. Pairing those coordinates with generation `2`,
or pairing an observed generation `2` record with desired generation `3`, is a
cross-generation mismatch and remains rejected.

## Closed registry projection

| Central snake-case source | Generation 3 nominal projection |
| --- | --- |
| `cohort_generation: 3` | `schemaVersion: 3` |
| `candidate_digest` | `candidateDigest` |
| `record_digest` | `recordDigest` |
| QUALIFIED `event_digest` | `qualificationEventDigest` |
| QUALIFIED `state` | `lifecycleState` |
| `canary_repositories[].repository_id` | `canaryRepositoryIds` |
| `policy_identity.{id,version,digest}` | `runtime.policy.{id,version,digest}` |
| `runtime.selected_lane` | `runtime.selectedLane` |
| `runtime.node` | `runtime.node` |
| `runtime.pnpm` | `runtime.pnpm` |
| `runtime.qualification_runtime.{node_version,pnpm_version,platform,architecture}` | `runtime.qualificationRuntime.{nodeVersion,pnpmVersion,platform,architecture}` |
| `runtime_closure.{domain,digest}` | `runtime.runtimeClosure.{domain,digest}` |

The five packages, reusable workflow identity, and four existing asset bindings
project through the same nominal keys used by the existing Agent shape. The
generation 3 projection is an unselected candidate projection. It contains no
selection grant; the existing event chain, publication qualification, and
physical CANARY boundary remain mandatory before repository adoption.

## Evidence boundaries

`candidateDigest` remains a retained nonzero digest field. It is not a computed
candidate authorizer, candidate framework, or independent proof. Binding the
exact Cohort record digest and the retained candidate field does not establish
candidate authorship or close a candidate-to-record-to-QUALIFIED cycle.
Independent candidate proof is pending and is not asserted here.

The policy digest is likewise a required nonzero digest of actual normal policy
generator bytes. No actual policy source digest or released qualification tuple
has been produced by this mapping. Test fixtures using synthetic digests and
qualification tuples are inert test data only and are not observed physical
proof.

An absent QUALIFIED record, absent QUALIFIED event, absent exact canary
repository identity, or absent genuine qualification remains a refusal. Shape
validity alone never turns a managed candidate into a successful adoption.

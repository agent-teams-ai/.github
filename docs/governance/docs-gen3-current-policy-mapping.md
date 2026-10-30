# Generation 3 Current Policy Mapping

Status: source implementation proposal; protected delivery and genuine qualification are pending.

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

The desired record owns policy qualification coordinates. For generation `3`
those are profile `4`, Cohort `3`, managed state `3`, qualification receipt `1`,
execution envelope `1`, and evidence class `cohort-v3-supporting-canary`.
The observed record independently owns the observed generation, all five exact
package versions, record/event digests, caller and default-branch evidence.

A declared `rollout_pending` row may have desired `3` and observed `2`.
The old observed fields remain unchanged until a genuine merged default-branch
run establishes the target. The reverse pending rollback may have desired `2`
and observed `3`; its policy coordinates describe target `2`, while the still
committed source `3` continues to require its own profile, runtime and receipt.
A bound row requires identical desired/observed identities and generations.
Unknown generations, missing explicit current discriminators and copied target
versions in old observed coordinates reject. Historical generation `1` retains
its absent discriminator and original digest/receipt contracts.

## Closed registry projection

| Central snake-case source                                                         | Generation 3 nominal projection                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `cohort_generation: 3`                                                            | `schemaVersion: 3`                                                             |
| `candidate_digest`                                                                | `candidateDigest`                                                              |
| `record_digest`                                                                   | `recordDigest`                                                                 |
| QUALIFIED `event_digest`                                                          | `qualificationEventDigest`                                                     |
| QUALIFIED `state`                                                                 | `lifecycleState`                                                               |
| `canary_repositories[].repository_id`                                             | `canaryRepositoryIds`                                                          |
| `policy_identity.{id,version,digest}`                                             | `runtime.policy.{id,version,digest}`                                           |
| `runtime.selected_lane`                                                           | `runtime.selectedLane`                                                         |
| `runtime.node`                                                                    | `runtime.node`                                                                 |
| `runtime.pnpm`                                                                    | `runtime.pnpm`                                                                 |
| `runtime.qualification_runtime.{node_version,pnpm_version,platform,architecture}` | `runtime.qualificationRuntime.{nodeVersion,pnpmVersion,platform,architecture}` |
| `runtime_closure.{domain,digest}`                                                 | `runtime.runtimeClosure.{domain,digest}`                                       |

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

## Existing verifier and evidence boundaries

The live verifier selects generation explicitly, never by package count or an
installed dependency. Generations `2` and `3` use the same closed five-package,
seven-edge mechanism and isolated pnpm `11.20.0` runtime-closure resolver.
All five published manifests must agree with the declared internal edges.
Managed Skill, caller, catalog and transition assets come from the selected
published adapter, including content-addressed assets for every upgrade origin.
Portable Docs does not acquire an invented Foundation runtime dependency.

A generation `3` record requires its nonempty explicit rollback list. Every
rollback target is an earlier, independently QUALIFIED upgrade origin. Unknown,
unqualified, self-referential and undeclared origins reject. Existing legacy
fix-forward rules and immutable generation `2` records retain their contracts.

Both current source and target legs of a cross-generation rollout are checked
against the record their committed managed state actually selects. The selected
record controls integration schema, packages, runtime, assets and receipt; the
desired policy coordinates cannot substitute for those inputs. Recomputed
record/closure digests, wrong provenance, wrong physical runtime, swapped receipt
formats and mutable head/workflow evidence remain rejecting conditions.

Qualification steps are selected from the recorded immutable reusable-workflow
blob and its exact trusted-qualification role/condition. Historical generation
`2` runners retain their literal old step name. Current generation `3` requires
`Run Cohort v2 or v3 qualification through the trusted base-owned runner`;
a successful step with a similar name or an unselected successful alternative
is insufficient. Source preparation on Node `24.21.0` cannot establish the
physical Node `26.11.1` / pnpm `11.20.0` / Linux x64 qualification.

After receipt verification and successful controller stability, the existing
trusted job may retain exactly the nonsecret qualification receipt and install
evidence in a one-day artifact, only for selected generation `3`. It uploads no
temporary tree, archive, credential or environment/log dump. This preserves
already-produced evidence; it creates neither a new receipt namespace nor a
central CANARY grant. The execution-envelope domain remains the existing
`agent-teams.docs-cohort-v2-execution-envelope/v1`.

These functional checks still require the owner-controlled protected-source
successor before installation. No Cohort registration, enrollment, published
successor adapter, actual consumer migration, CANARY or RECOMMENDED transition
is asserted by this source patch or its inert fixtures. Adapter `0.5.5` remains
immutable and does not gain the missing stable31 operational upgrade by a
validator change; the adapter owner's separately reviewed successor is required.

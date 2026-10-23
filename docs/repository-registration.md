# Registering an individually observed repository

The organization distinguishes a complete dated inventory, historical
qualification, a current individual registration and demonstrated conformance.
They are different claims. A newly discovered repository must not disappear
while maintainers wait for another complete inventory observation, and one
repository API response must not be presented as a new complete census.

The [registration supplement](../governance/repository-registration-supplements.json)
is the single authority for individually observed **pending** registrations that
have not yet entered the complete historical authorities. Its
[strict schema](../governance/repository-registration-supplements.schema.json)
permits only active, organization-owned original repositories, an explicit owner,
dated repository metadata, immutable source observations, mandatory full FMS and
unqualified/pending axes. It has no positive qualification or exemption mode.

The canonical reader is `loadRepositoryRegistrationScope` in
[`scripts/governance-policy.mjs`](../scripts/governance-policy.mjs).
`pnpm governance:validate` and the existing live inventory observer use that same
reader. It validates the unchanged historical authorities first, rejects
identity collisions and stale basis revisions, then reconciles the pending
inventory and Docs identities together. The live observer compares the union
against its independent organization observation. It still requires the
dedicated credential, complete-private-visibility assertion and stable two-pass
pagination; an individual registration does not satisfy any of those gates.

## Historical authorities stay historical

The complete
[inventory](../governance/organization-repository-inventory.json), dated
[executable-specification ledger](../governance/executable-spec-qualification.json)
and [Docs policy](../governance/docs-protocol-policy-v2.json) retain their existing
observation coordinates and counts. A supplement binds their exact revisions;
it does not mutate their dates, refresh unrelated repository metadata or imply
that all private repositories are visible. The frozen stable3 policy and
published FMS versions remain byte-immutable.

The combined registration view is a reconciliation input, not another complete
inventory document. Existing historical qualification, exceptions, Docs Cohort
lifecycle and hosted admission verification remain owned by their existing
authorities. A pending row cannot silently grant an admitted consumer, a
qualified executable specification, remote enforcement or an SDK exemption.

## Payments registration and current limits

The supplement records `agent-teams-ai/payments-sdk` under owner
[777genius](https://github.com/777genius). Its dated API observation identifies
the repository independently of its name, and its source coordinates point to
the observed draft of [Payments PR #10](https://github.com/agent-teams-ai/payments-sdk/pull/10).
The JSON record is authoritative for exact IDs, timestamps, revisions, artifact
blobs and axis values; this guide does not maintain a second matrix.

The observed draft source is a reconstruction checkpoint. Newer local test runs
must not be attributed to that earlier published head. The record accepts no
implementation or deployment qualification coordinates and asserts no hosted
check or required-check enforcement. Updating its source observation later
still does not qualify that source. The earlier lost working copy and its old
results are not the reconstructed candidate's evidence.

Full FMS adoption applies to all Payments production modules, including the SDK,
provider integration, PostgreSQL custody and optional Get Modular integration.
The repository owns its profile, semantic architecture decision and positive
and negative conformance gates. A passing configuration check alone is
`configured_not_qualified`; it cannot replace those gates or their review.

Docs Protocol applicability is separately pending explicit onboarding. The
existing `pending_classification` representation uses an unbound, non-consumer
qualification shape; that shape does **not** decide that Docs are inapplicable.
The SDK role does not grant an exemption. Conversely, a full FMS adoption does
not invent a Docs model, select packages or authorize a tooling downgrade.

Before adopting Docs, reconcile the consumer's Foundation/quality requirements
with an eligible exact centrally qualified Cohort. Do not independently install
a Docs package from an npm tag, mix incompatible pins or downgrade the adopted
quality tooling just to match an older Cohort. If no eligible Cohort supports
the required graph, qualify that graph through the existing producer process
and keep consumer admission pending in the meantime.

## Completing the registration

The owner completes each axis with evidence from the actual final source:

1. **Source and FMS:** record the final reviewed immutable consumer revision,
   exact profile/decision/gate artifact blobs and complete same-revision native
   CI. Include full FMS rejection fixtures, source coverage, suppression
   governance and strict compiler coverage. Preserve independently owned module
   boundaries and accepted architectural authority.
2. **Executable specification:** assess the real repository-owned contracts and
   models, their versions, positive and negative fixtures, deterministic gates
   and runtime binding. Historical ledger maturity requires reviewed source
   coordinates and the matching owner approval evidence. Implementation and
   deployment acceptance remain separate: accepted revision, evidence entries
   and coordinate checksum must come from their actual accepted proof. A local
   partial suite, draft PR or merged code is insufficient.
3. **Runtime and package qualification:** bind packed NodeNext/Bundler consumers,
   provider contracts, real PostgreSQL durability and queue scenarios to the
   same final source. Record the scope and limitations of those observations;
   do not turn an adapter test into a whole-product or deployment claim.
4. **Docs:** make the explicit applicability decision. If adopting, follow
   [repository admission](repository-admission.md) with an eligible exact Cohort,
   managed profile/integration/qualification contract, distinct caller/evidence
   paths, immutable central workflow pin and the actual semantic gate. A
   bootstrap candidate may name desired coordinates only. Admission requires
   the actual successful default-branch workflow/check identity, caller digest,
   immutable revision and evidence fields required by the existing policy.
5. **Remote enforcement:** observe the actual ruleset, required context and GitHub
   integration independently. Store its dated API evidence. Caller installation
   and a successful run do not prove that a required check blocks merging.
6. **Historical handoff:** after a complete authenticated organization census is
   available, publish its reviewed snapshot and reconcile the owning ledger and
   Docs policy. Move a repository into those authorities and remove its pending
   supplement row in one reviewed change. Identity overlap is rejected, so a
   repository cannot be governed by competing records. Future positive
   registration states require a separately reviewed proof contract; changing
   a status string in this pending-only schema cannot grant qualification.

The supplement contains the remaining proof checklist. Its source and metadata
coordinates are dated observations, not remote attestation or a continuous
freshness claim. Later repository or PR movement does not retroactively change
what was observed; qualification must use fresh final-source evidence.
The offline checker verifies structure, identity binding and pending status; it
does not re-fetch GitHub or establish that the recorded blobs exist remotely.

This delivery adds a schema to the existing protected verifier inputs and
changes governance validation. It requires the existing separately reviewed
source-authority installation/cutover procedure. It does not authorize its own
installation or alter any existing required check.

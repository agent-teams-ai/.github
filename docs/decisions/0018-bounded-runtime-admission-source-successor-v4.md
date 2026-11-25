# ADR-0018: Bounded runtime admission source successor v4

Status: Proposed installation; protected source qualification and installation prerequisites are pending

Date: 2026-11-26 (Europe/Kiev); refresh of the 2026-11-25 preparation

Decision owner: Organization governance

## Finite prerequisite and scope

The owner requested immediate delivery through native owner PR merges, at least
for specifically assigned, reviewed documentation. Central's canonical identity policy and installed immutable
runtime-v2 source currently require no bypass. Adding the requested GitHub grant
before reconciling those owners would create policy and source drift.

[PR423](https://github.com/agent-teams-ai/.github/pull/423) is the exact five-file
identity compatibility target. Its base is
`755c8515a5d106402a7e9e2cff621fb1fdc855cf`, head
`9dff206369649d9eb7a76edc1943461fde837739`, tree
`fd7d6388cabf8cb86284478213541e66b75bdda9`, pull ID `5483046730`, with three owner
commits: `dcefabe92d308ac07528e999f1e6b3ee2daffed5`,
`2592d8e7a70224ca6df223f53465c3b30c55dacb` and the current head. It
retains the default empty bypass list and accepts only the declared
User `13103045` in `pull_request` mode in the six assigned repositories.
Onboarding still creates the no-bypass default and does not install grants.

The separate v4 source retains the real immutable runtime-v2 implementation at
`6863c4b6e9f17b3a668e0afb9ff33cb9046788d0` for ordinary, dependency and historical
routes. Its one finite route binds the complete PR423 identity, commit list and
five before/after blobs. It does not adopt the unrelated staged v3/PR405 route.

## Source and protection contract

Reviewed source commit S: `72fa7a8af02e9ba7904c912f0bbb457254381002`.

S is retained on the ordinary preparation branch
`refs/heads/review/native-owner-admission-v4-20261125`. The canonical source ref and its lock
are not installed or qualified by that publication.

Reviewed source tree: `e762ed1328421970e92acc5d3639f7235bbbcd04`.
The source has two parents: the previous ordinary preparation commit
`0b91687934938299c379a05f300e7fda915a5a9b` and the current PR423 head
`9dff206369649d9eb7a76edc1943461fde837739`. Both histories are retained; no
published immutable source is rewritten. The intended canonical ref is
`refs/heads/governance/runtime-admission-source-successor-v4`.

The compatibility profile permits only the existing empty bypass list or the
single approved owner PR-only entry on Central main rulesets `19979783` and
`24363205`. Required contexts and App `15368`, strict and creation enforcement,
PR protections and all other governed fields remain unchanged. Source locks
continue to require no bypass. Owner readback checks the actual
`current_user_can_bypass` response separately from the configured mode; an
incomplete hosted public read is not an owner-full attestation.

The owner must create and read back the exact active repository-owned source
lock before first canonical ref publication. The POST explicitly sets
`update_allows_fetch_and_merge: false`, with update, deletion and
non-fast-forward restrictions and no bypass. All earlier source refs, locks,
callers, accepted ADRs and installation evidence remain unchanged.

This uses the existing source-successor mechanism from [ADR-0016](0016-bounded-runtime-admission-source-successor-v2.md).
It introduces no writer platform, credential channel, package or general
admission authority. Preparation-branch publication and local test success do
not establish protected source qualification or grant installation.

## Three-file installation and qualification order

This proposed installation adds only the source-generated main caller, this ADR
and the [installation snapshot](../../governance/evidence/docs-source-successor/runtime-admission-source-successor-v4-installation.md).
The caller must be generated and verified from the actual reviewed source S by
`callerWorkflowDefinition(S)` and `assertCallerWorkflow(bytes, S)`. It pins literal
S and accepts no inputs, inherited secrets, local checkout or commands.

Before installing these files, obtain genuine source push qualification and
source-defined positive and rejecting canaries. Add v4 while v2 remains required,
read back the complete rulesets and the actual blocking evidence, then retire v2
for the exact PR423 finite merge. Verify the actual merge tree, authorship and
postmerge checks. The historical finite-target run cannot certify an installation
PR or a later head.

Restore v2 beside v4 before removing the temporary v4 requirement. Install the
three additive files through the unchanged v2 ordinary route. Then obtain actual
installed-main positive and protected-input negative canaries through immutable
S. Add v4 beside v2 and prove on the same negative head that the required v4
context blocks mergeability. Only after that evidence may v2 be retired for
permanent enforcement. Never merge a negative canary or leave main without a
required source.

After compatible policy and permanent v4 qualification, prepare each of the ten
previously scoped owner-grant PUTs from a fresh owner-full read and change only
`bypass_actors`. Central main must retain its exact v4-only context set. Reusing a
dated pre-cutover PUT with runtime-v2 would reverse the transition and is invalid.
Preserve the existing Runtime always grant, Runtime history rule and all source
and tag locks. Native actor scope is broader than documentation paths; use remains
limited to specifically assigned, reviewed documentation and any wider delivery
scope explicitly authorized by the owner. It grants no authority to select or
expand work independently.

## Pending observations and rollback

The accompanying draft snapshot distinguishes reviewed preparation and current
ordinary hosted content checks from missing protected-source and installation
receipts. This proposal cannot be presented as an accepted installation until
its actual lock, immutable S, source qualification, finite merge and temporary
restoration evidence are recorded. The installation PR result, installed-main
canaries and permanent cutover remain later observations. Once installed, this
three-file snapshot is immutable; subsequent facts belong in separate evidence.

On failure, preserve a required source continuously. Remove only newly installed
owner grants and verify their removal before restoring a predecessor that rejects
visible bypass. Re-add the predecessor before removing v4. Do not unlock, rewrite
or delete any immutable source, and preserve the pre-existing Runtime grant.
Rollback of installed files requires a separately reviewed normal change.

# Proposed guarded installation, not an active route

This source package now includes a guard workflow, executable verifier, admission
composition and unbound authority/proof templates. It adds no required context
and changes no GitHub protection. Required V8 rejects an executable `scripts/`
change on a normal PR; admission evidence and trusted validation also reject
their respective slices. The candidate remains inert until an independently
trusted, separately reviewed transition is installed.
Base `a9521f1f54a9ea836da6ade82344a3c9baded356` contains no
`governance/docs-platform-admission-recovery.json`; it therefore cannot own an
authority record for the policy PR. The public verifier entry requires a
base-owned active record, separate accepted execution decision and installed
guard blobs; none currently exists. Its isolated evidence function returns `candidate_evidence_only`
for synthetic review fixtures and is not admission authority. A later base or a
same-PR record is rejected until a separately reviewed exact old/new Git blob
and regular-file-mode tuple, base-owned record, and renewed independent owner
decision exist. No transition tuple is claimed by this source patch.

## Proposed successor guard contract

A new read-only `pull_request_target` workflow would use the protected base's
code and read-only GitHub API access. It must fetch all changed-file pages and
compare the live central repository ID, PR number 314, default-base SHA
`a9521f1f54a9ea836da6ade82344a3c9baded356`, reviewed head SHA, regular-file
modes and exact Git blob IDs to a fixed tuple. It must reject forks, stale heads,
renames, deletion of existing authority, duplicate paths, symlinks, extra files,
and partial or mixed forward/inverse sets. The guard must pin its own workflow,
test, admission integration and recovery module blobs and reject self-editing.
It must not execute PR-head code or accept an unreviewed user input as authority.
The original six required contexts, including V8 and trusted validation, remain
required unless an independently enforcing exact transition is installed first.

The forward tuple must contain the exact admission verifier and fleet verifier
integration, base-owned recovery record reader, proof schema/record and guard
workflow/test/verifier. A later accepted owner decision and exact hosted failure
proof must predate and be independent of the authorization addition. The record
is read only from the execution base, so a PR cannot approve its own head.
The incident proof must include the exact failed authorization log digest. That
log must uniquely declare `CONTROLLER_SNAPSHOT_SHA` equal to this incident's
central base, and Git readback at that SHA must match the bound policy, registry
and exceptions bytes. A different controller-data snapshot is a different
incident tuple requiring separate review, even if the pinned runner is unchanged.
The inverse tuple must restore every old regular-file mode/blob and remove only
files that the forward tuple added; policy, registry, exceptions, historic
observations and accepted ADRs are not inverse edits.

## Required rejecting guard fixtures

- One allowed forward tuple and one complete inverse tuple pass their exact
  file/mode/blob assertions; neither fixture claims a successful GitHub check.
- A stale base/head, wrong PR or repository ID, fork, renamed path, changed
  mode, wrong old or new blob, missing page, duplicate path, omitted guard file,
  extra script, partial forward or mixed inverse is rejected.
- An authority file added in the same PR as its purportedly covered policy
  operation is rejected; expired, revoked and retired records are rejected.
- A changed required-check list, skipped prior context or successful conclusion
  manufactured by a successor context cannot satisfy the transition.

Exact local G/E/I source byte manifests and the I inverse are review artifacts,
not accepted execution tuples. The draft E proof and I authority explicitly say
`unbound` and are rejected by the guard. Guard publication, independently trusted
bootstrap enforcement, accepted authority, hosted proof and actual admission
remain separate prerequisites. An owner comment alone cannot substitute for
the rejecting required contexts.

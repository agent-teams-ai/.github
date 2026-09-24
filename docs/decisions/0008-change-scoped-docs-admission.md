# ADR-0008: Change-scoped Docs admission and full fleet audit

Status: Accepted; active on Central main at `adda2a7f325ba3308c725135a50cf818422e9abb`

Date: 2026-09-24

Decision owner: Organization governance

## Context

The accepted Docs admission verifier requires every admitted consumer's current
default-branch Docs check to succeed for every central policy edit. Platform's
current head selects stable25 while central policy retains stable21, so its
Docs check fails. This blocks an unrelated Agent Runtime stable28 selection.
The failed Platform check must remain visible and must not be called success.

## Decision

For an exact policy-only PR, trusted base/head comparison determines affected
repository IDs. The verifier still validates the complete policy, registry,
references, lifecycle and historical admission evidence; checks each active
consumer's live identity, historical ancestry and stable current head. It
requires current Docs success and exact execution proof for every changed
consumer row. Unchanged rows are reported as `current_not_evaluated`, never as
`current_verified` or `recovery_pending`.

Any missing base, global policy change, row addition/removal/reorder, change to
a non-consumer row, or combined exceptions/inventory edit uses the original
full-fleet current check. A direct fleet audit has no PR scope and always
checks every current consumer. A daily and manually dispatchable workflow runs
that audit on protected `main`; failures remain actionable but do not make an
unrelated policy selection impossible.

This supersedes only ADR-0001's fleet-wide current-success requirement for
exact policy-only PRs. It does not relax historical or structural admission.
Historical evidence and current operational health are reported separately;
the latter is not silently inferred from a scoped PR admission. Existing
accepted ADR bytes remain unchanged for auditability.

## Rollback and enforcement

Revert the scoped classifier and workflow together to restore full-fleet
admission. PR #318 was integrated by fast-forward of the reviewed exact head;
the original six required contexts, strict policy, pull-request rule and
no-bypass configuration were restored after the transition.
No failed or missing required check may be treated as a passing check.

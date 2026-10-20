# Platform Docs exception retirement

Observation date: 2026-10-19

Decision owner: `agent-teams-ai/organization-maintainers`

Delivery status: proposed candidate; owner-controlled authority transition and
protected-main delivery remain UNBOUND. This record is inert evidence, not an
accepted transition, authorization receipt or successful consumer check.

## Observed facts

Read-only authenticated GitHub API queries observed:

- `GET /repos/agent-teams-ai/agent-teams-platform`: repository ID `1319378484`,
  `visibility: public`, `private: false`, `archived: false`, `disabled: false`,
  default branch `main`.
- `GET /repos/agent-teams-ai/agent-teams-platform/rulesets`: successful response,
  with only active repository branch ruleset `24363204`, `Commit author identity`.
  No Docs required-check rule was observed. Public visibility and a successful
  rulesets query prove neither required Docs enforcement nor consumer success.

The original active Docs exception is preserved in Central main commit
`3a203362c25c5ebbe6e44b745ba3f8a5eecbaad0`, regular file
`governance/docs-protocol-exceptions.json`, Git blob
`ac336b865d697b62c938623f2960864e85f7698a`. Its ID is
`platform-private-required-checks-github-free`, scope `required_docs_check`, owner
`agent-teams-ai/organization-maintainers`, security authority
`governance/code-security-defaults.json`. It was reviewed 2026-09-16, due for
review 2026-10-16 and expiring 2026-11-16. PR367's later date-only renewal is not
evidence that its private/GitHub Free rationale remains true.

## Proposed retirement and limits

Remove that obsolete active Docs exception together with Platform's current v2
`required_check_exception_id` reference. Permit a null reference in the Central
validator while retaining the exact repository/ID restriction for historical
non-null references and all cross-policy authority checks. Preserve the immutable
stable3 snapshot and dated security, Actions and executable-specification records;
their old references do not reactivate the current Docs waiver.

The remaining absence of remote Docs enforcement is an explicit maintainer-owned
gap, not a new exception or an unavailable-provider claim. Local and CI Docs
checks remain mandatory. This candidate changes no ruleset, required context,
consumer pin, desired/observed Cohort or historical admission evidence. It grants
no fleet-success exemption. Current required admission and source-authority
checks still govern delivery until a separately accepted exact transition exists.

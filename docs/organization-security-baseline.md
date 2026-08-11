# Organization security baseline

This is a versioned snapshot of organization policy and observed GitHub state,
not a substitute for querying GitHub before a security-sensitive change.

## Enforced defaults for new repositories

As observed on 2026-08-11, the organization has two live, enforced code-security
default configurations:

- ID `266049`, `Public repository security baseline`, is the default for new
  public repositories. Dependency graph, Dependabot alerts and security updates,
  GitHub Advanced Security, CodeQL default setup, secret scanning, and push
  protection are enabled.
- ID `266048`, `Free dependency security baseline`, is the default for new
  private and internal repositories. Dependency graph, Dependabot alerts, and
  Dependabot security updates are enabled. Paid security features remain
  disabled.

The existing private `agent-teams-platform` repository, ID `1319378484`, was
also observed attached to enforced configuration `266048`. Separate evidence
records preserve the exact API endpoint and method for that attachment, the
Dependabot alerts HTTP `204`, and automated security fixes enabled and unpaused.
The newly created public `agent-plugin-submission-e2e` and
`universal-agent-plugins` repositories were observed attached to enforced public
configuration `266049`. Each has separate 2026-08-11 evidence for the attachment,
the Dependabot alerts HTTP `204`, and automated security fixes enabled and
unpaused. This post-creation state is consistent with the configured public
default and confirms that the expected baseline is present; it does not by itself
prove attachment causality or change the transfer policy below.
The organization GHAS billing repository count of `0` is recorded separately as
an organization observation, so repository attachments do not duplicate it.
This is dated evidence, not continuous monitoring.

The organization API reported `two_factor_requirement_enabled: false` on
2026-08-10. The owner deferred enabling that requirement. The snapshot records
the membership risk and requires reassessment before organization membership
changes; it must not claim `true` unless a later API observation confirms it.

The live source of truth is the GitHub organization configuration API. The
checked-in snapshot is strict-schema validated and reviewable, but validation
does not continuously compare it with GitHub.

## Dependabot ownership

`Security updates only` means Dependabot may open vulnerability-remediation pull
requests from repository alerts. It does not authorize scheduled Dependabot
version-update entries in `.github/dependabot.yml`. Renovate remains the owner of
routine version updates, so the two systems must not compete for those pull
requests. Organization PR
[`universal-agent-plugins#1`](https://github.com/agent-teams-ai/universal-agent-plugins/pull/1)
merged on 2026-08-11 as commit `0c2abee4b834055836866882eb7f77dc0674e2f8`
and removed that repository's scheduled Dependabot version updates, restoring
the security-only invariant.

## Transfers and required-check exception

Organization defaults target new repositories of the matching visibility. A
transferred repository must not be assumed to have received the current default:
audit it after transfer and explicitly apply configuration `266049` or `266048`
as appropriate.

The canonical plan-tier exception is
`platform-private-required-checks-github-free` in the code-security snapshot.
The executable-specification and Actions snapshots reference that ID instead of
copying its definition. It does not make local or CI checks optional; reassess
the exception after a visibility or plan change.

## Dated required-check observation

The executable-specification ledger records the active public-repository
rulesets observed through the GitHub API on 2026-08-11, including each ruleset
ID, check context, and integration ID. GitHub Actions checks are app-bound to
integration `15368`; ReviewRouter checks are app-bound to integration `3599233`.
The two new public repositories returned zero repository rulesets, so their
ledger records explicitly say `observed_absent`, cite the successful dated API
queries, and do not claim required-check enforcement.
This checked-in evidence is not continuous monitoring and must be refreshed
before relying on live enforcement.

Pull request approval is not required in this snapshot. Requiring one approval
while organization review approval is disabled would deadlock the current
single-member organization; CODEOWNERS may document ownership but does not
change that approval rule.

## Actions rollout is separate

Code-security configuration enforcement does not prove GitHub Actions policy
enforcement. The dated Actions API snapshot records read-only default workflow
permissions, disabled workflow approval, all-repository coverage, and required
immutable commit SHAs for external actions. Platform retains exception
`platform-private-required-checks-github-free` only for protected required
checks; it does not weaken the organization-wide action-reference policy.

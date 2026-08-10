# Organization security baseline

This is a versioned snapshot of organization policy and observed GitHub state,
not a substitute for querying GitHub before a security-sensitive change.

## Enforced defaults for new repositories

As observed on 2026-08-10, the organization has two live, enforced code-security
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
Dependabot alerts HTTP `204`, automated security fixes enabled and unpaused, and
the organization GHAS billing repository count of `0`. No one endpoint is cited
for multiple observations. This is dated evidence, not continuous monitoring.

The live source of truth is the GitHub organization configuration API. The
checked-in snapshot is strict-schema validated and reviewable, but validation
does not continuously compare it with GitHub.

## Dependabot ownership

`Security updates only` means Dependabot may open vulnerability-remediation pull
requests from repository alerts. It does not authorize scheduled Dependabot
version-update entries in `.github/dependabot.yml`. Renovate remains the owner of
routine version updates, so the two systems must not compete for those pull
requests.

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
rulesets observed through the GitHub API on 2026-08-10, including each ruleset
ID, check context, and integration ID. GitHub Actions checks are app-bound to
integration `15368`; ReviewRouter checks are app-bound to integration `3599233`.
This checked-in evidence is not continuous monitoring and must be refreshed
before relying on live enforcement.

Pull request approval is not required in this snapshot. Requiring one approval
while organization review approval is disabled would deadlock the current
single-member organization; CODEOWNERS may document ownership but does not
change that approval rule.

## Actions rollout is separate

Code-security configuration enforcement does not prove GitHub Actions policy
enforcement. The dated Actions snapshot records read-only default workflow
permissions and disabled workflow approval, but organization-wide SHA pinning is
still pending Gateway pull request `#7`. Platform also retains exception
`platform-private-required-checks-github-free`. The organization must not be described as fully
Actions-enforced until those conditions and a later snapshot say otherwise.

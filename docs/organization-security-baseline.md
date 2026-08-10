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

The source of truth is the GitHub organization configuration API. The checked-in
snapshot is validated locally so an ID, visibility target, or security-only
semantic cannot drift silently in policy review.

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

`agent-teams-platform` is currently private under an organization on GitHub Free.
GitHub currently rejects ruleset and branch-protection configuration for that
repository, so its deterministic commands and CI workflow are not protected
required checks. This is a documented plan-tier exception, not evidence that the
checks are optional. Reassess it after a visibility or plan change.

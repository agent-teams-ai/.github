# CI/CD: reduce repeated work without weakening qualification

This is a short engineering guide, **not** an organization-wide CI enforcement policy. Each repository owns its required checks, release gates and migration decisions. Adopt optimizations only with local evidence and negative tests.

## What pays off

1. **Run impact-based qualification in the PR.** Start independent checks in parallel; put expensive native, OS, database and packaged E2E behind explicit changed-boundary classifiers. When classification is uncertain, include the check. Keep a stable required gate that fails when a selected job fails, is cancelled or is missing.
2. **Do not repeat an already qualified PR tree after merge.** A push to `main` may use a small fresh smoke *only after* read-only verification of one associated merged PR, the exact merge commit, identical Git trees, a completed successful PR required gate and its authenticated workflow run. Check the new commit identity and a meaningful small contract on `main`. A matching file tree alone is insufficient proof of successful PR CI.
3. **Fail closed for direct or unusual pushes.** No associated PR, a conflict-resolved different tree, cancelled/failed/pending checks, an API outage, an unfamiliar merge route or an intentional direct push must run full qualification. Releases, merge queues and publishing provenance have their own evidence requirements.
4. **Use precise concurrency groups.** Supersede older heads of the *same PR*, not other PRs or release jobs. Do not let a `main` push cancel still-needed PR evidence or silently replace pending production checks.
5. **Cache only immutable inputs.** Key dependency caches to lockfiles and platform/tool versions; allow a cold rebuild. Treat cache entries as untrusted and never cache credentials. Use workflow artifacts for exact build outputs and receipts; bind reusable binaries to source commit, platform and digest rather than reusing unverified bytes.

## Antipatterns

- Full OS/architecture/package matrices on both PR and merge push with no provenance check
- Treating `queued`, `skipped`, neutral, historical checks or an identical tree as E2E success
- Disabling direct-`main` CI merely because most changes arrive through PRs
- Relying on filenames alone to omit security, dependency, process-ownership or release-critical gates
- A broad concurrency group that cancels another branch or a merge-queue check
- Reusing privileged/untrusted cache content or bypassing required gates with a permissive skip
- Adding a cross-repository CI framework before a small, measured local improvement

## Adoption checklist

Before a repository adopts a fast post-merge path, verify with deterministic positive and negative fixtures: successful same-tree merge; direct push; conflicting merge tree; unfinished/cancelled PR CI; invalid status issuer; API failure; and the final required-gate result. Confirm static check names remain stable. Measure runner minutes and queue delay **before and after**; a reduction in workflow job count is not itself a measured time saving.

A practical first adopter is [the Orchestrator's PR-based proof path](https://github.com/777genius/agent_teams_orchestrator/pull/216). It is repository-owned; this guide does not automatically install it elsewhere.

## References

- [GitHub Actions workflow concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency)
- [GitHub Checks API: list checks for a commit](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference)
- [GitHub REST: PRs associated with a commit](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit)
- [GitHub Actions dependency caching and trust boundaries](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [GitHub Actions workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)

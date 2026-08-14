# Repository documentation protocol admission

Every new organization-owned repository starts documentation-protocol
unqualified. GitHub community defaults can supply this guidance, but GitHub does
not automatically install packages, profiles, scripts, workflows, or required
checks in a new repository.

## Admission contract

The repository owner must:

1. add an exact registry version of `@agent-teams/docs-protocol`;
2. add a repository-owned strict profile, schema, owners, templates, and
   reachability rules;
3. expose the fixed `pnpm docs:protocol:check` gate and the common authoring
   commands documented by the protocol;
4. add the thin docs-authoring skill and route `AGENTS.md` to it;
5. call the reusable `agent-teams-ai/.github/.github/workflows/docs-protocol-check.yml`
   workflow from an explicit repository workflow. Pin the central reusable
   workflow target to its own reviewed, nonzero 40-hex revision;
6. prove positive and negative profile/adoption fixtures in a disposable test
   project;
7. update `governance/docs-protocol-policy.json` with the centrally admitted
   exact package version, profile path, caller workflow path, qualification
   evidence path, the nonzero consumer revision at which those three artifacts
   were observed, and the separate nonzero central reusable-workflow revision.

Admission is complete only when the consumer checks and governance validation
both pass for the same revision. A package install, merged pull request, or green
generic CI run alone is not qualification. Required-check enforcement remains a
separate dated GitHub observation.

## Existing exceptions

`craig-meeting-gateway` is an upstream external fork and is not modified by this
protocol. Review the exemption if the fork is detached, ownership changes, or
organization-specific documentation is added.

The private Platform repository retains
`platform-private-required-checks-github-free`. Its local and CI documentation
gate is still mandatory, but the policy must not claim unavailable GitHub Free
required-check enforcement. Review the exception after a plan or visibility
change.

## Inventory and drift

The checked-in inventory and policy must contain exactly the same active
repository identities. This catches omissions in a reviewed snapshot. It is not
a live organization-wide inheritance feature.

A scheduled live audit may be enabled only with a dedicated read-only
organization inventory credential. It must fail closed when the credential is
missing or the API is unavailable. ReviewRouter credentials, `CODEX_AUTH_JSON`,
and a maintainer's interactive `gh` token are forbidden for that automation.

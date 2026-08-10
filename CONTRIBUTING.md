# Contributing

Thank you for contributing to Agent Teams projects.

## Before You Start

1. Read the target repository's `README.md`, `AGENTS.md`, and architecture
   documentation.
2. Discuss changes that alter public contracts, bounded-context ownership,
   security boundaries, persistence semantics, or release policy before coding.
3. Work on a short-lived branch with a conventional prefix such as `feat/`,
   `fix/`, `refactor/`, `docs/`, or `chore/`.

## Pull Requests

- Keep one coherent concern per pull request.
- Use a Conventional Commit style pull request title.
- Include the verification commands and results.
- State compatibility, migration, security, and rollback impact when applicable.
- Do not mix generated churn or unrelated refactors into the change.
- Resolve review conversations before merge.

For an executable-specification change, identify the repository-owned schema or
contract and its version, positive and negative fixtures, and the exact command
that gates it. Describe runtime binding and migration impact when either changes.
If the applicability matrix says the change is not applicable, record explicit
`N/A` with the ownership reason. Do not add validation or state-machine packages,
or enable a foundation capability, without a real repository-owned model and a
gate that imports or executes it.

Repository-specific instructions override this baseline where they are stricter.

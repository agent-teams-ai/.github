# Portable authority historical bodies

`old-overrides.json` and `new-overrides.json` hold UTF-8 line deltas for the 17
modified paths in `governance/docs-portable-authority-r322.json`. Each edit has
a zero-based line index in its starting body, a line count to delete, and the
literal replacement text. Edits apply in descending index order. The seven
candidate-only UTF-8 bodies are string values in `new-additions.json`, keyed by
their manifest paths. JSON escaping preserves their exact bytes, including final
newlines. No modified file is copied into this fixture.

The test selects an exact checked-in source or candidate body by length and
SHA-256. It uses the forward delta when only the source body is present, the
reverse delta when only the candidate body is present, and the addition fixture
when an added path is absent. It then checks both historical bodies against the
manifest's byte length, Git blob SHA-1, and SHA-256, with the path and mode
checked by the manifest. The reverse delta records one source workflow's missing
final newline.

Provenance was verified from exact commit
`ee717a097021894e67f9e814874240ecaf6f4715`, whose governance record names
source base `18b7e22f7247a85181516a7bbb989c9d5fad7be3` and content candidate
`6e77efe7ef0c686c9e95d4d361578c8c594aad13`. For every manifest path,
`git show <source-base>:<path>` (when old exists) and
`git show <content-candidate>:<path>` matched the recorded blob ID, length,
and SHA-256. The deltas and additions need no Git objects, branch, remote,
network, or external patch executable at test time. The JSON map avoids nested
fixture files named `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`,
which the protected-base trusted-validation job treats as installation authority
at any depth. The test executes that job's materialization script against the
G-only path inventory and checks both the no-op result and the former collision.

# Portable authority historical bodies

`old-overrides.json` is a UTF-8, line-level reverse delta for the 17 modified
paths in `governance/docs-portable-authority-r322.json`. The 24 new bodies are
the corresponding checked-in files. Each edit uses a zero-based line index in
the new body, a number of lines to delete, and literal old text to insert.
The test applies edits in descending index order and checks every reconstructed
old and new body against the manifest's byte length, Git blob SHA-1, and SHA-256.
One workflow also records `omit_final_newline`, because that is its only
remaining byte difference and the line itself is already in the checked-in file.
The manifest also checks each path and mode. Added paths have no old body.

Provenance was verified from exact commit
`ee717a097021894e67f9e814874240ecaf6f4715`, whose governance record names
source base `18b7e22f7247a85181516a7bbb989c9d5fad7be3` and content candidate
`6e77efe7ef0c686c9e95d4d361578c8c594aad13`. For every manifest path,
`git show <source-base>:<path>` (when old exists) and
`git show <content-candidate>:<path>` matched the recorded blob ID, length,
and SHA-256. The candidate bodies also matched the checked-in files byte for
byte. This fixture contains only the changed historical lines; it needs no Git
objects, branch, remote, or network at test time.

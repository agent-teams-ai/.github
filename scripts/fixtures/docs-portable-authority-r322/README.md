# Portable authority v2 independent TEST bodies

These fixtures reconstruct the exact 21-path compatibility content transition
from retained Git objects, the r731 reviewed corrected source tree, and its
reviewed composed census. Historical sources identify inspected material only;
no fixture names a future execution or squash SHA.

`new-additions.json` holds the seven added UTF-8 bodies. `old-overrides.json`
and `new-overrides.json` hold reverse and forward line deltas for the fourteen
modified bodies, including the G-installed census preimage and all-four census
postimage. Each zero-based edit deletes a line count and inserts exact literal
text; edits apply in descending starting index order. JSON preserves final
newlines, including the historical workflow with no terminal newline.

Tests authenticate the checked-in source or candidate side before reconstructing
its counterpart, then verify every Git blob, SHA256 and byte length. Literal
reviewed descriptors supply an independent oracle. Reconstructed complete tree
maps admit exactly the forward/inverse pair; additional G installation authority,
frozen Docs rewrites, missing paths, stale bytes or mixed tuples fail.

The census preimage remains the exact G-only 21-tooling-path source. Its corrected
postimage retains both G helpers and both Node helpers, selecting 23 paths.
A disposable NEWTEST composition runs the native census/parser and actual Oxlint
selection with all four included. Source installation remains distinct from
G enforcement: synthetic comments and success-shaped Actions responses cannot
make the reader issue success while activation is UNQUALIFIED.

The fixtures need no retained Git repository, network, remote or external patch
executable to reconstruct their bytes. Consolidated JSON avoids nested
`package.json`/lock/workspace files being misclassified as installation authority.
The actual predecessor materializer is executed against all eleven G additions
and its census modification; former nested-install collisions are rejecting
probes. This is local source evidence, not hosted publication or qualification.

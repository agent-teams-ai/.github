# Portable authority r322: closed v2 source contract

This unmerged PR323 correction follows the accepted r715 finite contract and
r731 independent source review. G is source installed by independent bridge B.
**Source installation does not activate enforcement.** B independently covers
corrected PR322; the selected route does not activate G's two replacement
contexts. G activation remains **UNQUALIFIED**. The consuming verifier fails
closed with `G_ACTIVATION_UNQUALIFIED` before authority observations or success.
Local reconstruction tests are source evidence, not hosted qualification.

The existing PR323 and its review history remain the delivery unit. Its large
existing source change is an owner-accepted coherent exception; this correction
creates no replacement PR, split stack or general migration framework. Accepted
ADR bytes, historical V1/V8 guards and publication evidence remain immutable.

The record has exactly these fields:

| Field | Contract |
| --- | --- |
| `schema_version` | Integer `2`; v1 is rejected |
| `historical_sources` | Exactly `old_base`, `current_main`, `old_g`, `corrected_322`, `reviewed_322`, `corrected_tree`; nonzero Git identities of inspected material |
| `activation` | Literal `UNQUALIFIED`; cannot enable G |
| `manifest` | Sorted exact 21 rows, seven additions and fourteen modifications |

The historical sources are respectively
`18b7e22f7247a85181516a7bbb989c9d5fad7be3`,
`3fe0f135ffc446b3bb174397c6b5783f72a008a2`,
`4e5e722f337ff19dff62aada7bc9a42cedbeb6c9`,
`a5035495279c0cb750a2c9b898acab89cf94edbb`,
`1aaace692e57b13534c809a9b1b77700aab4b938`, and tree
`eea25f3c755d05747fd63f32034cdb3c3378df05`. Corrected owner and reviewed
commits have the same exact tree. These identify historical source material;
none asserts the future G-containing squash or execution base SHA.

Each manifest row contains exactly `path`, `status`, `old`, `new`. Status is
`added` or `modified`; additions have null old sides. Each present side contains
exactly `type: "blob"`, `mode: "100644"`, `blob` (Git SHA1), `bytes` (byte length),
and `sha256` (`sha256:` plus SHA256). The complete verified tree difference must
equal these paths and every descriptor in either direction. Partial, hidden,
extra, mixed, stale or changed-mode tuples fail. G's workflow, record, policy,
reader and their support files are outside this compatibility manifest: G cannot
install or accept its own executable authority through it.

The frozen Docs workflow, community validator and validator test remain blobs
`9bcbe54dfec6280045ac596e55c1f14ce5f176e1`,
`b43b247a4b727974ef878ff09abc05cd17f22d0e`, and
`fe25fc2080ed470098208c7753793e8c1b144e4f`. All three are absent from the
compatibility content difference. Unknown rewrites fail complete-set equality.

The census is the sole composed descriptor: its old side is the installed
G-only census, blob `38844e9615e74474db8419d50b1b80d26ba825b8`, 4,114 bytes,
SHA256 `7f4894ecd051b181b5923975675b9066cc102331ceb16339f19a11ee4679e260`.
Its reviewed postimage is blob `8658090bf484d1394f6ec6aca4f0fdb5164cb8b1`,
4,388 bytes, SHA256
`8c004f5a00e7a7d9249d16e2abfddf584c6ae17f062660641f0c48b0d2361974`.
It retains all four inclusions: `docs-portable-authority-r322`,
`read-docs-portable-authority-r322`, `assert-node-runtime`, and
`check-node-compatibility`, each under `scripts/` with `.mjs` suffix.
G-only and standalone corrected PR322 each select 21 tooling paths; their
composed forecast selects 23 and is compared with actual Oxlint selection.
The other twenty descriptors come directly from the retained Git objects.

The compact `JSON.stringify(manifest)` SHA256 is
`8ee791b1321937633f43d3aa8773f29cbde6ddf8dd093ddecf921bc444561c3d`.
The byte-exact record digest retained by the policy is
`e9babac407a8fcdbcf177cb5b2e74ca79f8678ab5e86389684dea508b602635f`.
A caller-supplied checksum cannot substitute for that source review. Changed
record bytes require independent content review and a coordinated trusted-source
pin update. Deltas independently reconstruct both sides, then verify Git blob,
SHA256, length and complete forward/inverse equality. They require no Git or
network access during focused fixture reconstruction.

The reader's closed v2 execution-coordinate parser retains repository/PR,
actual `base`/`head`, direction, closure, run/attempt, distinct reviewer/admin
comment identities, deadline, protection digest and inverse predecessor fields.
It adds `source_digest` bound to the reviewed record and retains
`manifest_digest`. Review serialization binds `historical_sources`,
`source_digest` and all coordinates except the two later comment IDs. Parsing
these coordinates grants no execution authority: this v2 record always refuses
G activation. A genuine `pull_request_target` API run's `head_sha` identifies
PR HEAD, not execution base. Base-owned workflow/checkout provenance must be
established independently before any separately reviewed future G activation;
this correction makes no such qualification claim. Existing workflow pins stay
unchanged because the selected route needs no new workflow wiring.

B's external execution manifest must bind each eventual **actual** base/head,
complete source/tree difference, deployment digest, owner decision, protection
digest, predecessor and expiry after the preceding squash. It cannot use a
historical source anchor as that future SHA, accept whatever main contains,
waive V1/V8, or use G's record checksum as approval. No publication or protection
change is performed by this source correction.

Retain B until genuine inert stable30 readiness runs from terminal protected
base. Then separately restore all six original App15368 contexts: `check`,
`trusted-admission-evidence`, `trusted-authority-evolution`,
`trusted-admission-authority-evolution-v1`,
`trusted-cohort-authority-evolution-v8`, `trusted-validation`, together with the
original strictness and effective no-bypass protection. The selected route does
not remove V8/trusted-validation in favor of G's replacement contexts, require
paid Team, a new App or admin bypass, or certify a readiness fixture.

Operational rollback can undo PR322's exact 21-path tuple and separately undo
G's eleven additions plus its census modification, using independently accepted
actual predecessor associations. Stable30's retained record, event 180, closure
and publication receipt stay immutable. **No PR325-to-PR326 publication inverse
is authorized.** Withdrawal uses a new append-only lifecycle event.

The historical default and copied legacy execution tuples remain `24.18.0`.
Current Central default and the future G-owned route/portable runtime proofs
use `24.21.0`; copied legacy V8/validation job steps remain unchanged. The
historical verifier-workflow blob pin still identifies only its retained
historical inverse context, not qualification of this successor workflow.
Physical source compatibility uses
`26.10.0` and private YAML `2.9.1`. Stable30 remains Node24 managed authority.
Managed Node26 requires a new immutable qualification contract and explicit
consumer adoption. Physical source execution with the supplied root cache is
not a clean strict Node26 root installation. Full repository results must retain
existing clock/admission failures diagnosed separately in r739; this correction
owns no admission-test repair. Actual restacking, hosted full CI, genuine PR325
live verification, G activation and managed Node26 qualification remain deferred.

The current G-only census is a separately reviewed 26-path source image at
`17b48d5f177fab86d7d531c99d771631699b1a5d`; it is not either frozen 21/23-path
historical census side. Historical TEST preimages now come from exact old Git
blobs in an added inert projection and retain the original descriptor checks
and forward/inverse fixtures. The separately named current e4 source record
remains inert and unchanged; future G composition coordinates and installed
executable closure remain null/pending until exact composition review. Neither
runtime proof nor source checksum grants authority or activates G.

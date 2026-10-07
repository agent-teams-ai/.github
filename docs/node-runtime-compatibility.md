# Node Runtime Compatibility

Node 24 remains the production and repository default runtime. The current
default is exactly `24.21.0`, as recorded in `.node-version`. Do not change a
release, published cohort, receipt, or accepted decision to imply a production
runtime cutover.

Node `26.10.0` is supported only through explicit compatibility lanes. Those
lanes select clean Node 26 toolchains, prove the selected runtime, and run
the source compatibility checker with an isolated, frozen, strict installation
of its pinned YAML parser. The full root dependency graph remains on Node 24
until its published dependencies support Node 26. Node 25 is intentionally unsupported
and is not a migration step.

The migration contract is:

1. Retain Node 24 support and the Node 24 production default.
2. Qualify Node 26 independently without reusing a Node 24 installation tree or
   `node_modules` directory.
3. Keep package engine enforcement strict while allowing only the supported
   Node 24 and Node 26 release lines.
4. Require an owner decision after Node 26 officially enters LTS before any
   release or production cutover.

Historical Docs cohorts and their receipts remain bound to their original Node
24 runtime ranges. Compatibility qualification is new evidence and does not
rewrite those immutable records.

The Docs Cohort append-only workflow keeps its trusted validation on Node 24.
Its full validation path sets up Cohort v1 pnpm before Node cache resolution,
then installs the separate Cohort v2 pnpm binary. The Node 26 compatibility job
checks the runtime contract separately from Cohort qualification; it does not qualify or promote a
Docs Cohort.

The parser is provisioned from `tools/node-compatibility-tooling`, a private,
exactly pinned one-dependency workspace. Its own workspace file prevents pnpm
from climbing into the repository root. Central CI runs the source checker in
independent Node 24 and Node 26 jobs.

Engineering Foundation 1.7.2 selects that exact package root and gives it a
disjoint governed root and one package-owned Source boundary. The consumer
quality profile classifies its three metadata files as a passive parser helper
owned by governance tooling. The closed inventory rejects additional files;
this package coverage declaration introduces no composition capability.

The source checker guards the current public Docs reusable workflow against its
exact accepted-main bytes at `05b30bcc00cdf07cfde9ba60a1136bb9df7f7571`:
SHA-256 `f3a1e7bba95a8d309f6f4a97377d1c68fd2b956f2659e9576fc1350599cb514d`.
This is a regression assertion for the current public file. Historical stable30
workflow bytes, their recorded digests, and their safe-closure validator remain
bound to their original snapshots. Updating this source assertion leaves the
public workflow and release qualification and publication mechanisms unchanged.

Node 24 continues to run the full frozen root installation,
lockfile peer check, and repository gate. Node 26 does not claim a full root
installation while published Engineering Foundation packages retain Node 24-only
engines. The accepted Docs Cohort qualifications and rollback bytes are unchanged.

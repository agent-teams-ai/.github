# Node Runtime Compatibility

Node 24 remains the production and repository default runtime. The current
default is exactly `24.18.0`, as recorded in `.node-version`. Do not change a
release, published cohort, receipt, or accepted decision to imply a production
runtime cutover.

Node `26.10.0` is supported only through explicit compatibility lanes. Those
lanes select clean Node 26 toolchains, perform frozen strict installs, and prove
the selected runtime before running checks. Node 25 is intentionally unsupported
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
checks the runtime contract independently; it does not qualify or promote a
Docs Cohort.

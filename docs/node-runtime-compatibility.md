# Node runtime compatibility

Central's repository tooling defaults to Node `26.11.1`, selected by
`.node-version`, the consumer quality profile and the existing `check` CI job.
Its package engine range retains Node 24 compatibility and excludes Node 25:
`>=24.18.0 <25 || >=26.10.0 <27`. The
[quality route](engineering-quality.md) owns the complete local commands and
exact compiler, linter and package-manager pins. Renovate is the explicitly
isolated Node 24 tool described below; the repository default remains Node 26.

The independent
[Node 24 compatibility workflow](../.github/workflows/node24-compatibility.yml)
selects Node `24.21.0` on a fresh Ubuntu runner, proves the actual process
version, installs the root toolchain and isolated Renovate tool with their frozen
lockfiles, strict engines and strict peer dependencies, then runs the complete
`pnpm check`. It uses
the same repository source and lockfile as the Node 26 default job. It never
reuses a Node 26 `node_modules` directory or a reduced checker suite. A failed
command fails the job.

The two workflows run independently. Node 24 compatibility does not change
the required `check` context, gate ReviewRouter reviews or credential refresh,
or become a dependency of the trusted Docs admission and qualification jobs.
No repository protection or required-check setting changes with this workflow.

## Explicit installation and runtime ownership

Use Node `26.11.1` and pnpm `11.18.0` for the default tooling lane, or select
Node `24.21.0` for the compatibility lane. Bootstrap each fresh checkout in
this order before running checks:

```sh
pnpm install --frozen-lockfile
pnpm --dir tools/renovate-validation install --frozen-lockfile --ignore-scripts
pnpm --dir tools/renovate-validation run build:native
pnpm check
```

The root installation contains the compiler, linter, Foundation and process
helper. `tools/renovate-validation` owns a separate frozen installation of
Renovate `44.24.2` with pnpm's supported
[`devEngines.runtime`](https://pnpm.io/package_json#devenginesruntime) binding
to exact Node `24.21.0`. The runtime's platform artifacts are pinned in that
lockfile. Neither the package manager nor the launcher changes the repository's
default runtime, and `pnpm check` never provisions the tool.

Renovate's [pinned upstream engine](https://github.com/renovatebot/renovate/blob/44.24.2/package.json)
requires Node `^24.11.0`. A strict root install on Node 26 therefore rejected
the earlier combined graph. The observed latest Renovate
`44.181.1` also advertised only the Node 24 engine, so this change retains
the accepted tool pin and gives it a declared runtime owner.

The first managed-runtime probe proved Node 24 execution but built RE2 under
the installing Node 26 process. Renovate then returned exit zero with an ABI
error and a fallback to JavaScript `RegExp`. That result is not accepted as a
successful validation. The bootstrap suppresses install scripts, then invokes
only `pnpm rebuild re2` inside the managed Node 24 environment. The small
TypeScript launcher requires the actual native RE2 module to load before it
runs Renovate's public validation CLI through the existing bounded process
helper. A missing tool, wrong runtime, wrong tool version, failed build, native
load failure or failed validator command rejects the check.

pnpm 11 [reads non-registry settings from YAML rather than `.npmrc`](https://pnpm.io/blog/releases/11.0).
Both workspaces explicitly set `engineStrict`, `strictPeerDependencies` and
`saveExact` to true. They also set `verifyDepsBeforeRun: error`; outdated
dependencies reject instead of triggering implicit installation.
The installed-tool tests read back those effective settings, reject a real
incompatible dependency, prove the same disposable dependency installs without
engine enforcement, and reject dependency drift without changing the installed lockfile.
These are temporary negative controls, not changes to the repository policy.

The workflows use fresh Ubuntu runners. Local execution under both physical
Node versions is checked separately from hosted CI and from portability to
another operating system; this change does not claim Windows qualification.

## Explicit Linux native ABI probe

After the bootstrap, run the separately invoked probe on Linux:

```sh
pnpm exec node scripts/validate-renovate-abi.probe.ts
```

It requires `c++` with C++20 and shared-library support on `PATH`, and the
`include/node` headers in the managed Node `24.21.0` distribution. Those
prerequisites are explicit for this probe; it is not discovered by `pnpm test`
and does not add a compiler requirement to the portable regression suite.
Its source is still selected by strict TypeScript, lint and source-boundary
checks. It fails explicitly outside Linux.

The probe copies the unmodified launcher, process helper and RE2 loader into a
disposable directory. It invokes the launcher through a real file symlink,
first with no native module and then with a tiny compiled addon that declares
an incompatible Node ABI. An exit-zero validator sentinel must remain
unreached in both cases. It never changes the installed RE2 binary or package
cache. The observed Linux x64 result on the managed Node 24 runtime rejected
both missing and wrong-ABI native modules, rejected the symlink invocation
before validation, and left the sentinel absent. This is a bounded loader and
entrypoint failure probe, not validation of a whole alternative RE2 build.

Earlier PR #322 checkpoints kept Node 24 as the default and limited Node 26 to
source checks using a private YAML parser. Those checkpoints describe their
historical source and test evidence. The accepted Node 26 default supersedes
that implementation plan; this reconciled change retains the PR lineage and
adds full Node 24 compatibility execution without restoring the obsolete
default or its parser/checker plumbing.

Historical Docs Cohorts, receipts, accepted decisions and frozen verifier
sources retain their recorded runtimes and exact bytes. Running Central's
complete repository checks on two physical runtimes is source compatibility
evidence. It does not qualify a new managed Docs Cohort, activate a source
successor, change consumer adoption or certify production deployment.

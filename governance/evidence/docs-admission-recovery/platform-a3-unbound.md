# Platform a3 admission cycle: unbound incident coordinates

This is a review fixture, not authorization or a successful check. The adjacent
`platform-a3.json` is an explicit unbound template, not a proof. No accepted
owner decision, failed run attempt/job/log, or base-owned proof blob is recorded.
The isolated verifier requires all of them before returning
`candidate_evidence_only`; the public admission entry remains closed.

| Coordinate | Observed value |
| --- | --- |
| Central base | `a9521f1f54a9ea836da6ade82344a3c9baded356` |
| Central PR | `314`, reference head `9766914e28cfaec721356d9d748d072c9b5579ec` |
| Central before policy blob | `55717f3171b0359b4eedba338f616ae72d943496` |
| Central PR #314 after policy blob | `17a2c987aed7d0fa10cf9e2c5788f45d3ab41aad` |
| Central registry blob | `18f59fc7312d78782f65b5f40dcc3774695211af` |
| Central exceptions blob | `ac336b865d697b62c938623f2960864e85f7698a` |
| Required controller-data snapshot | Central base `a9521f1f54a9ea836da6ade82344a3c9baded356`; actual failed-run log coordinate unobserved |
| Platform repository ID | `1319378484` |
| Platform default source head | `a3ce96e00df2f9958fbd614e7fa6cb965f83cab8` |
| Platform managed projection blob | `ed4e08d2be259269e308b2a38c1a6a3aaf3f0951` |
| Platform profile blob | `81daa0ccde2d9075374f70ac7f8281f751e9e4c0` |
| Platform caller blob | `240d13c9528dc56a869bb13e9a7d3712d875484f` |
| Platform policy desired/observed | `docs-2026-09-12-stable21` / `docs-2026-09-12-stable21` |
| Platform source projection | `docs-2026-09-16-stable25` (`SUPERSEDED`) |

The following fields are intentionally **unbound**: exact failed workflow run ID,
run attempt, trusted authorization job ID, semantic job ID, complete job steps,
trusted diagnostic log SHA-256, independently accepted owner comment and admin
identity, base-owned incident proof Git coordinate, exact failed-run
`CONTROLLER_SNAPSHOT_SHA` log declaration and Git readback, and an installed guard
transition. Source head and policy bytes must be refreshed if they change.

The reference Platform checkout is private and its hosted failed run was not
queried by this worker. Its local bytes alone cannot prove a hosted run or current
success. The r317 guard and authority templates are source candidates only;
the missing independently trusted G bootstrap prevents installation under the
six current required contexts. The current policy must retain the stable21 observation until a genuine
selected-target default-branch push succeeds with exact qualification and
semantics. No stable25 selection is authorized by this fixture.

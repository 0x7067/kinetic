# Agent usability exercise — 9 September 2026

Four fresh evaluator contexts used CLI help or MCP discovery to solve two perturbed layouts each, before and after a focused usability change. Every layout reached measured physics success within its 12-simulation budget. This is a small tool-usability exercise, not a model benchmark or a CLI-versus-MCP ranking.

## Method

The clean baseline was `baa153e` on `main`; development proceeded on `codex/agent-usability`. Baseline verification reproduced 67 Node tests, the standalone build, 35 browser checks, 24 replay checks, and nine external stdio MCP checks with five PNGs.

The starting projects are `examples/offset-left.json` (A) and `examples/offset-right.json` (B). The maintainer verified both start with real failures and admit successful repairs under the unchanged rules. Each transport and round received separate service state and an equal maximum of 12 simulations per layout. Evaluators stopped at first success. Maintainer feasibility runs and browser acceptance simulations are outside evaluator budgets.

One fresh subagent per transport per round received no maintainer conversation. Instructions limited them to help/discovery and returned tool evidence, forbidding source, docs, fixtures, existing solver, memory, other evaluators' artifacts, and paid model APIs. They shared the filesystem; these were conversation-isolated trials with instruction-based source restrictions, not an enforced filesystem blind. Their reports describe complying with those restrictions. No auto-tune or external model API was invoked.

The temporary logging harness runs the real CLI or launches `server/mcp.js` with an external SDK client over stdio. It records arguments, outputs, errors, elapsed invocation time, output bytes, and simulation counts in `evidence/usability/`. Each invocation starts a new process/connection. Evaluators used structured evidence without a browser; separate browser suites supply the visual verification.

B mirrors A and follows it in the same evaluator context. It benefits from learned corrections. The before/after rounds used different fresh contexts and different edit choices. These results cannot isolate the effect of a change on solve rate, efficiency, or latency.

## Measured solve paths

All rows ended in `success:true` with the real cup dwell criterion. Calls include discovery and, for CLI, saving. Times are summed invocation time and the interval from first invocation start to last invocation finish; neither is model-token usage or full end-to-end task latency. Bytes are UTF-8 stdout, including the MCP text-content envelope. One maintainer CLI help preflight is excluded from the first row.

| Round | Interface/layout | Calls | Simulations | Errors | Invocation ms | Interaction span ms | Output bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before | CLI A | 9 | 2 | 1 | 749 | 44,468 | 10,427 |
| Before | CLI B | 6 | 1 | 0 | 602 | 31,144 | 8,749 |
| Before | MCP A | 5 | 2 | 0 | 659 | 29,865 | 14,515 |
| Before | MCP B | 5 | 2 | 0 | 809 | 29,510 | 14,528 |
| After | CLI A | 11 | 2 | 0 | 966 | 58,538 | 7,029 |
| After | CLI B | 7 | 2 | 0 | 645 | 13,022 | 3,994 |
| After | MCP A | 5 | 2 | 0 | 600 | 23,994 | 14,979 |
| After | MCP B | 5 | 2 | 0 | 656 | 30,283 | 14,993 |

The post-change CLI evaluator also completed a directed naming/undo check: 10 additional calls, zero simulations or errors, 863 ms summed invocation time, 17,617 ms interaction span, and 4,636 output bytes. The nested save destination was explicitly prescribed for this retest. These are targeted recovery checks, not spontaneous solve behavior.

Raw transcripts: `evidence/usability/{cli,mcp}-{a,b}.jsonl` and `evidence/usability/after/{cli,mcp}-{a,b}.jsonl`. `metrics.json`, both rounds' `cli-report.md` and `mcp-report.md`, and the saved projects retain exact calls, run IDs, edits and measurements. The harness and starting service states are retained there too. These local evidence files are ignored by Git.

## Observations and changes

The first CLI evaluator requested `batch --help`, found no operation format, and fell back to two `set` calls. Help now lists update/remove/add shapes, field bounds and units, batch limits, retry semantics, and a naming-only example. The next evaluator discovered and used an atomic geometry batch during the free solve. In the separate recovery check it renamed two parts in one revision and verified one undo restored both names.

The first CLI save into a missing directory failed with generic `IO_ERROR`. Save now creates missing parents while retaining exclusive creation unless `--force` is supplied. The second evaluator saved successfully into the prescribed new directory without a filesystem workaround. An integration test also verifies overwrite refusal and an import round trip.

Both original evaluators found `surface:deck` ambiguous: a ramp end and its top share the same collider label. First contacts now include a measured Rapier manifold normal, oriented from the struck collider toward the marble in world coordinates. CLI text and MCP discovery explain direction, post-step velocity, and null/missing evidence. CLI contact timestamps retain the recording's four decimal places for replay queries. The contract reports one normal, not a guessed face label or an exhaustive manifold log.

For A's failed first bridge impact, the normal is `(-0.9848, 0.1392, 0.1035)` and post-step X velocity is `-0.2737 m/s`. The MCP retest's successful repair records `(0.1392, 0.9903, 0)` and `4.2388 m/s` at bridge contact. Both rerun evaluators explicitly used normals to distinguish the obstructing end from a supported landing. Tests check both yaw directions using Three.js transforms; a maintainer comparison with the four saved feasibility traces found identical frames and outcomes after adding this read-only evidence.

## Verification and remaining work

Final verification passed 70 Node tests, the static/standalone build, 35 browser checks, 24 replay checks, and nine live stdio MCP checks with five actual PNGs. CLI/MCP replay parity includes retained contact normals. Both browser suites reported zero JavaScript exceptions. Desktop/mobile comparison, failed/successful runs, feedback, and offline captures were inspected, along with representative video frames. Browser capture tests preserve the human camera/scrubber and historical revisions.

The 24-second excerpt `evidence/final/kinetic-demo.mp4` accompanies full diagnostic WebM recordings, traces, PNGs and JSON reports. Current full recordings are `evidence/videos/3972f5a493906e57b84beb9f5655cdd9.webm`, `evidence/replay/video/e4a5c9cf75e2655fbfca83aab0a0cfe0.webm`, and `evidence/offline-video/8469a601d37783b10764869f534eafff.webm`. Earlier recordings remain separately identifiable; result reports may inventory them too. Initial launch failures remain in `evidence/baseline-launch-failure/`.

Next useful work: make the CLI's post-run hint point to the last editable contact instead of a placeholder that can suggest the workbench, and avoid recommending physics after naming-only edits. A subsequent evaluation should use distinct failure modes with one fresh context per layout. Cup rim geometry and a more focused inspection response remain possible improvements, not demonstrated blockers here.

Only macOS Chromium/software-WebGL acceptance and the local in-app browser were exercised; no Safari/iPhone or hardware-performance claim is made. Run/history retention remains in-memory and bounded. No deployment or unattended agent job was created. The pinned MCP SDK still produces an npm audit finding; `evidence/npm-audit.json` preserves the advisory details. This increment did not change dependencies or broaden the existing loopback/stdio architecture.

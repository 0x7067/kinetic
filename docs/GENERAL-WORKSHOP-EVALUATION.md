# General workshop creation trials — 10 September 2026

Two fresh agent contexts created original scenes using only CLI help or MCP discovery and returned evidence. Each received a separate empty service and a four-simulation budget. They could write their own operation files and inspect returned PNGs, but were instructed not to read implementation, examples, tests, memories, maintainer conversations or one another's work. These restrictions were instruction-based within a shared filesystem. No auto-tune or paid model API was used.

The CLI agent built a nine-object kinetic sculpture with a custom mesh, text, arrow and illustrative plot. Its first five-second simulation showed the ball leaving the catching plinth. A revised end stop kept the ball on the plinth through five seconds, at speed 0.09675 m/s. This establishes the measured endpoint, not indefinite containment. It saved a portable project with the CLI.

The MCP agent built an 18-object sample → smooth → estimate flow diagram with explicit supplied-data labels and a separate sphere/slab experiment. One three-second run recorded contact at 0.7167 s and a final resting center near y=0.55 m, matching the slab top plus sphere radius. The project persisted automatically; no standalone export was claimed through MCP.

Both returned `success:null`, correctly avoiding a made-up challenge criterion. Each evaluator inspected five actual PNGs initially, then two more after fixes. These are bounded creation/usability demonstrations, not independent performance comparisons or a CLI-versus-MCP ranking.

| Interface | Initial calls / errors | Follow-up calls / errors | Actual simulations |
| --- | --- | --- | --- |
| CLI | 18 / 0 | 9 / 2, both resolved by the final probe retry | 2 |
| MCP | 11 / 0 | 5 / 0 | 1 |

The follow-up reused the same authored scenes and evaluator contexts after service/browser restart. Both confirmed persistent IDs, settings, geometry and revision. Recordings and undo history reset as documented.

## Observed friction and revision

- Discovery initially led with marble rules. CLI batch help now begins with general scene operations and clearly scopes marble limits; render help explains its view alias and focused capture.
- A single +Z normal on a box was ambiguous. Scene probes now expose transformed axes, an explicit authored +Y `topSurface` for boxes/cylinders, and a gravity-projected downhill vector. Planar elements retain a +Z normal; other shapes have no single normal.
- That normal correction exposed a CLI formatter dereferencing null even with `--json`. The follow-up recorded two `IO_ERROR` responses. The formatter was fixed, live CLI/MCP probe parity was added for box/sphere/plot, and the final evaluator retry succeeded. Failures remain in the transcript.
- Plots were faint. Stronger axes, thicker curves, larger labels and unlit color-preserving texture materials improved both evaluators' actual focused PNGs. Whole-scene chart labels remain small; focused capture remains useful.

Remaining friction: whole-scene framing has generous margins and widens around escaped bodies; large scenes produce a long property panel; isometric views foreshorten XY annotations; MCP has no complete-project export tool. These limits are documented rather than hidden behind a success score.

## Evidence and measurement boundaries

Ignored local evidence is under `evidence/general-evaluation/`: full `cli-a.jsonl` and `mcp-a.jsonl` transcripts, reports `cli-report.md` and `mcp-report.md`, both saved service states, authored operation files, and actual PNGs in `cli-a-captures/` and `mcp-a-captures/`. The CLI export is `cli-scratch/rolling-study.kinetic.json`.

The wrapper recorded arguments, outputs, errors, elapsed call time, output size and native-image counts. Across initial and follow-up calls, CLI totals were 40,915 output bytes and 2,157 ms summed call time; MCP totals were 79,871 bytes and 1,689 ms, with eight native PNG content items returned. These timings exclude agent reasoning and PNG review; they are not throughput or model-performance results. CLI images were returned as file paths. The wrapper's raw `isRun` flag also marks `run --help`; actual CLI simulations were two, not three.

Final automated evidence includes 87 Node tests, 35 original browser checks, 24 replay checks, 21 scene-browser checks, and nine external stdio MCP checks with five PNGs. The scene suite separately exercises external MCP captures, custom mesh/PNG rendering, historical capture isolation, failure reporting, mobile creation and offline physics. All three browser suites reported zero page exceptions. See `GOAL.md` for logs, recordings and review limitations.

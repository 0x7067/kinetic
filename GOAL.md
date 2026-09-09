# Kinetic continuation checkpoint — v0.4.0 Replay Lab

Keep build → run → observe → revise → save small. CLI first; MCP remains a thin adapter. No general game editor or built-in model service.

## Standalone extraction — 9 September 2026

Extracted the `kinetic/` tree from `0x7067/Scratch`, branch `kinetic/marble-workshop`, commit `7f4e60db3` into the root of `0x7067/kinetic` with fresh history. Application source, tests and locked dependencies are unchanged. The quick start now clones this repository; CI runs from the root on `main`, pull requests and manual dispatch. Scratch bootstrap and source-rewriting workflows are excluded.

Local macOS verification passed: 67 Node tests, the static/offline build, 35 original browser checks, 24 replay checks, and 9 external stdio MCP checks with five actual PNGs. Both browser suites reported no JavaScript exceptions. Desktop comparison and mobile replay screenshots were visually inspected. `actionlint` passed; ripwire found no quality regressions.

Evidence is retained locally under `evidence/`: `browser-results.json`, `mcp-results.json`, `replay/results.json`, screenshots, traces and videos. Initial Chromium launches were denied by the execution sandbox; those logs are preserved under `evidence/sandbox-launch-failure/`. The same suites passed when run outside that sandbox. Generated evidence, dependencies, builds and workshop state remain ignored by Git. Publication is a source repository, with no hosted application or scheduled agent.

## Earlier measured checkpoint in Scratch

Runtime source `aadcd8040d73b5c04cda4c2ed51c16c24143edc5` passed GitHub Actions run **34362284849** on 9 September 2026:

- **67 Node tests**: model, real physics, HTTP safety, CLI, replay sampling/player, historical feedback and live CLI/MCP replay parity.
- **35 original Chromium checks**: CSP startup, editing, actual MCP images, undo/import/reload, cancellation, mobile controls, offline simulation.
- **24 Replay Lab Chromium checks**: real pointer seek near 2.5 seconds, pause/resume, recorded contact/frame jumps, ghost comparison, exact-time CLI captures and historical revision handling.
- No browser JavaScript exceptions. The existing live MCP suite returned five actual PNGs and discovered eight tools. The new replay suite separately captured a historical CLI frame and checked it against the rendered world-space position.
- Geometry counts: 92 → 92 over repeated inspection; 99 → 94 across twelve ghost comparison toggles. This checks accumulation, not device FPS.
- Desktop, standalone and Replay Lab WebM recordings finalized. Actual comparison and mobile PNGs inspected: paused time is 2.50 seconds and mobile replay controls precede the inspector.

The normal CI workflow now runs both browser suites and retains exact source, screenshots, recordings, traces, JSON results and commit provenance. Build artifacts are uploaded only after all checks succeed. Source/docs packaging uses those artifacts, not an untested local bundle.

## What changed

A read-only replay lab supports pause, scrubbing, frame stepping, collision jumps, velocity inspection and a time-aligned blue ghost of a previous attempt. Comparisons report exact field changes rather than treating a smaller miss distance as success. CLI `runs`, `replay` and `compare` and MCP equivalents share recording data without another simulation.

The simulator now records the true release and terminal states and first contacts. Contact surface labels distinguish deck and rail impacts. Historical feedback uses the displayed run/time/revision, while recording the newer saved revision separately. Scrubbing captures the requested input value before pause synchronizes controls; cancelled tuning retains an explicit stopped status.

## Live exploration, not a blind benchmark

A perturbed track required three measured simulations and two edits: lowering the landing ramp alone still failed; correcting its lateral position then succeeded in 4.6083 simulated seconds. No auto-tune or provider API was used. An external stdio MCP client read the failed recording and compared both snapshots without mutating the working layout. See `docs/CLI-EVALUATION-v04.md` and `examples/misaligned-landing.json`.

The implementer had source knowledge. This is not a fresh-agent trial, a fair CLI/MCP efficiency comparison, or proof of general autonomous task success.

## Next useful experiment and boundaries

Have a fresh evaluator solve held-out perturbed layouts using only CLI help or MCP discovery under identical attempt budgets. Do not add a framework or bigger parts catalog before this demonstrates useful feedback.

One fixed challenge, three parts, one dynamic marble; loopback-only service. Project/feedback persist; the twenty-run replay cache and undo history remain in memory and reset on service restart. A note marked addressed is not human approval. Auto-tune is bounded local search, not an LLM. Software-WebGL Chromium acceptance is not Safari/iPhone or hardware-performance certification. No public deployment, paid model call or unattended agent is scheduled.

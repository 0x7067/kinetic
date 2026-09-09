# Kinetic continuation checkpoint — agent usability

Keep build → run → observe → revise → save small. CLI first; MCP remains a thin adapter. No general game editor or built-in model service.

## Current increment — 9 September 2026

Started from clean `main` at `baa153e`, remote `https://github.com/0x7067/kinetic.git`, and created `codex/agent-usability`. Main and prior work were preserved. Reproduced the baseline locally before evaluating changes: 67 Node tests, build, 35 original browser checks, 24 replay checks, and nine external stdio MCP checks with five PNGs.

Four fresh evaluator contexts completed before/after CLI and MCP trials on separately initialized, solvable perturbations. Each layout had a 12-simulation limit. Before: CLI A/B succeeded in 2/1 simulations, MCP in 2/2. After: both interfaces succeeded in 2/2. The second layout mirrored the first and shared its evaluator, so these are bounded sequential usability trials, not independent novice trials or a transport ranking. Evaluators received only discovery and returned evidence; restrictions were instruction-based in a shared filesystem. No external model API or auto-tune was used by them.

Implemented the observed fixes: discoverable CLI edit fields/bounds and atomic batch examples; creation of missing save directories with overwrite protection; measured Rapier contact normals to distinguish obstructing impacts from supported landings. Normals survive shared CLI/MCP replay without a rerun. Full before/after measurements, run IDs and limitations are in `docs/AGENT-USABILITY.md`; starting layouts are `examples/offset-left.json` and `examples/offset-right.json`.

Completed checks on the final application code:

- `npm test`: **70/70 passed**, including executable batch help, atomic undo, nested save/import/overwrite protection, mirrored contact normals and live replay parity.
- `npm run build`: static and standalone output passed, **6.51 MB** standalone HTML.
- `evidence/venv/bin/python tests/browser.py`: **35/35 passed**; external stdio MCP **9/9 with five PNGs**.
- `evidence/venv/bin/python tests/replay-browser.py`: **24/24 passed**. Both browser suites report zero JavaScript exceptions.
- Actual desktop/mobile failed and successful runs, comparison, feedback and offline PNGs inspected. Representative full-recording and demo frames inspected. Initial browser launch failures preserved; Chromium acceptance required the approved execution outside the launch sandbox.
- Four maintainer feasibility cases retain identical physics frames/outcomes after adding normals. Ripwire reports zero gating regressions (two minor findings: one complexity point in simulation evidence serialization and one CLI line); its test obligations were covered by the full suites. `git diff --check` passed.

Evidence: baseline copies in `evidence/baseline/`; final logs at `evidence/final-{node,build,browser,replay}.log`; final PNGs/reports in `evidence/final/`; complete evaluator transcripts, timing/byte metrics and reports in `evidence/usability/` and `evidence/usability/after/`. Short demo: `evidence/final/kinetic-demo.mp4`. Full current recordings are listed in `docs/AGENT-USABILITY.md`. Exact committed source is recorded in the ignored `evidence/final/source-revision.txt` after committing.

Open the local app at `http://127.0.0.1:4317` while `node cli.js serve` is running. The local service was restarted with the changed code and exercised through CLI captures, retaining a failed run and a successful revision. This is a foreground development service, not hosted deployment or unattended agent work.

Next: improve post-run/post-edit CLI hints, then use different failure modes with one fresh evaluator per task. Bounds, revisions, fixed rules, replay isolation and persistence contracts remain intact. Known limits: no Safari/iPhone or hardware-performance verification; first-contact normals are not exhaustive contact manifolds; replay/history are in memory; the pinned SDK's npm audit finding remains recorded in `evidence/npm-audit.json`. No dependency upgrade, public deployment or recurring job is claimed.

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

## Earlier next-step proposal and boundaries

Have a fresh evaluator solve held-out perturbed layouts using only CLI help or MCP discovery under identical attempt budgets. Do not add a framework or bigger parts catalog before this demonstrates useful feedback.

One fixed challenge, three parts, one dynamic marble; loopback-only service. Project/feedback persist; the twenty-run replay cache and undo history remain in memory and reset on service restart. A note marked addressed is not human approval. Auto-tune is bounded local search, not an LLM. Software-WebGL Chromium acceptance is not Safari/iPhone or hardware-performance certification. No public deployment, paid model call or unattended agent is scheduled.

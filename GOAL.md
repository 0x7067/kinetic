# Kinetic — general workshop checkpoint

## Authored-rest default framing — 10 September 2026

Ship A on `kin-next-from-v05-1`, started from current main `2e08e49803def79e303167abe93953c59ff10f65` (v0.5.0). Do not revive `kin-scene-first-1` / PR #1. Default iso/side/top cameras and unfocused captures frame authored document transforms rather than live/replay world matrices. `--focus ID` still tight-crops the live object, including an escaped sample. Remote captures that omit `mode` still preserve the human camera. Sphere padding is tighter: zoom uses `radius * 1.08` and camera distance `max(3, r*2)` instead of `1.22` / `max(6, r*3)`. Marble v1 unfocused captures still use the parts group plus start/goal. Failed marble CLI hints now name the last real part ID (not `<last-part>` or workbench). Inspector UI, MCP export, run persistence, physics catalog expansion, PR #1, new views and plot-label redraw remain out of scope.

Completed checks:

- `npm test`: **90/90 passed**, including authored-rest vs live-matrix framing, demo iso containment for plot/heading/floor, escaped-body default frustum vs `--focus ball`, and the marble fail-hint ID.
- `npm run build`: static and standalone output passed; standalone **6.55 MB**.
- `python3 tests/browser.py`: **35/35 passed**, plus external stdio MCP **5 actual PNGs**. Zero page exceptions.
- `python3 tests/replay-browser.py`: **24/24 passed**. Zero page exceptions.
- `python3 tests/scene-browser.py`: **24/24 passed** (was 21; added authored-rest iso after an escaped ball, tight `--focus ball`, and human-camera preservation for `view.capture`). External stdio MCP **5 actual scene PNGs**. Zero page exceptions.
- Actual demo iso screenshot inspected: `evidence/general-browser/demo-iso-authored.png` keeps the plot, “Motion & meaning” heading and floor readable. CLI side capture of the later expanded scene also keeps those labels readable.

Current limits unchanged: 64 objects, 16 dynamic bodies, 1 MB documents, ten-second simulation, bounded embedded PNGs; custom meshes remain visual, plots show supplied data, and no arbitrary code/forces/joints/imported 3D formats are provided. MCP complete-project export remains CLI/browser-only. Runs and undo history reset on restart. Whole-scene chart labels and the compact inspector remain follow-up work. No Safari/iPhone or hardware-performance certification. This branch is pushed for crewmate review; no pull request is opened here.

## Push checkpoint — 10 September 2026

The user authorized pushing local `main` to `origin` (`https://github.com/0x7067/kinetic.git`). GitHub repository and branch were checked through `gh-axi`; remote main was `baa153eb879961f3e7eb88f8d6f31ceb2e053cad`, an ancestor of the verified workshop. The working tree was clean. Since the full checks below, only GOAL.md checkpoint notes changed; application source and its evidence remain identical to `eceb7a3`. No tests were repeated for these documentation-only notes. Remote branch confirmation is retained in `evidence/general-final/push-verification.txt`; existing runtime limitations remain unchanged.

## Local merge — 10 September 2026

At the user's request, local `main` was fast-forwarded from `baa153e` to verified workshop commit `eceb7a335368c21dd0fa7e17204cee6b216c5088`, including the prior agent-usability increment. The working tree was clean and ancestry was checked; the merge required no conflict resolution or application changes. The 87 Node tests, 80 browser checks, build and live MCP evidence below still apply to the identical application source. This checkpoint update is documentation only. No remote push was performed; existing limitations remain unchanged.

## Completed increment — 10 September 2026

Implemented the agreed general, agent-accessible workshop on `codex/general-workshop`, starting from the tested agent-usability increment `e94bd21271b1f753464a59f186bc837e44be08cb`. Main remains unchanged. The marble challenge is one preserved example, alongside a blank scene and “Motion & meaning.” The current version is 0.5.0.

Version 2 scenes share Workshop validation, revision checking, atomic batches, history and persistence with existing version 1 saves. Ten object kinds cover primitives, custom triangle meshes, text, lines, arrows, embedded PNGs and supplied-data plots. Physics is optional for boxes/spheres/cylinders, with a fresh 120 Hz Rapier world, real contact pairs and multi-body recordings. Scene completion has no implicit success criterion. Three.js computes world transforms, bounds, axes, explicit top-face normals/downhill vectors and capture geometry. Human editing, CLI and the eight-tool stdio MCP adapter use the same document and facts.

Replay, historical feedback, comparison ghosts and camera-preserving captures work in both modes. Invalid assets fail captures explicitly. Default tool output summarizes embedded assets and long geometry. The standalone HTML retains authoring, optional physics and local browser persistence. README, scene schema/CLI guide, an importable example and the normal CI workflow now cover the general workshop.

Completed checks:

- `npm test`: **87/87 passed**, including actual CLI/SDK scene creation, persistence/export/import, replay parity, optimistic conflicts and box/sphere/plot probe parity.
- `npm run build`: static and standalone output passed; standalone **6.55 MB**.
- `tests/browser.py`: **35/35 passed**, plus external stdio MCP **9/9 with five actual PNGs**.
- `tests/replay-browser.py`: **24/24 passed**.
- `tests/scene-browser.py`: **21/21 passed**, including desktop/mobile, custom mesh and decoded PNG, MCP images, physics/replay/ghosts, historical feedback, image failure and offline mode. All three browser suites reported zero page exceptions.
- Final desktop/mobile/offline/comparison screenshots and representative video frames were actually inspected. A short real-browser creation/replay/revision/comparison recording is retained alongside full videos.
- `actionlint` and `git diff --check` passed. Ripwire reports zero unacknowledged gating regressions after scoped review acknowledgments for sequential CLI churn and eleven added lines in the shared renderer. Eight minor existing-symbol changes and twelve new-symbol findings remain disclosed; this is not a zero-debt claim. Its test obligations were covered by the Node and browser suites. CLI main's signature remains unchanged.

Two fresh evaluators created original scenes from empty services. CLI used two simulations to revise an escaping ball into a five-second contained result; MCP used one simulation to verify a sphere resting on a slab. Both confirmed scene persistence across restart. Follow-up probes exposed a null-normal CLI formatting regression, which was fixed, covered with a live parity test and verified by the evaluator. Full methods, calls, failures and limitations are in `docs/GENERAL-WORKSHOP-EVALUATION.md`.

Evidence:

- Final logs: `evidence/general-final-{node,build,browser,replay,scene-browser}.log`; additional probe checks: `evidence/general-final-probe-tests.log`.
- PNGs/results/traces/full video: `evidence/general-browser/`, `evidence/replay/`, `evidence/browser-results.json`, `evidence/mcp-results.json`.
- New scene full desktop recording: `evidence/general-browser/video/d4d2bf4282fce8f73cf8141b1c1604c3.webm`; offline: `evidence/general-browser/offline-video/a1a6e590941c2644ce223abb82c05ba9.webm`.
- Short demo: `evidence/general-final/kinetic-workshop-demo.mp4`; live CLI captures, demo comparison PNG and original marble backup: `evidence/general-final/`.
- Evaluator source-free call transcripts, reports, saved scenes and PNGs: `evidence/general-evaluation/`.
- Quality review: `evidence/general-quality-final.json`, `evidence/general-test-gate.txt`, `.ripwire_quality_acks`.
- Preserved failures: first scene-browser tab-selection failure in `evidence/general-browser-first-failure/`; outdated help/version test in `evidence/general-node-help-test-failure.log`; probe errors in evaluator transcript and `evidence/general-final/ramp-probe.json`; recording harness CSP failure in `evidence/general-final/demo-recording-csp-failure.log`. The harness uses the same test-only CSP bypass as browser acceptance; the app CSP remains restrictive.
- Exact committed source revision and source archive are written into ignored `evidence/general-final/` after commit.

The foreground local service at `http://127.0.0.1:4317` runs the changed code and was exercised with actual CLI PNGs and simulation. The original marble project was exported before an undoable switch to the general demo. This is not a hosted deployment or supervised background agent. No push, merge, provider call or scheduled job is claimed.

Current limits: 64 objects, 16 dynamic bodies, 1 MB documents, ten-second simulation, bounded embedded PNGs; custom meshes remain visual, plots show supplied data, and no arbitrary code/forces/joints/imported 3D formats are provided. MCP complete-project export remains CLI/browser-only. Runs and undo history reset on restart. Whole-scene chart labels and long inspectors can still be improved. No Safari/iPhone or hardware-performance certification; no dependency audit remediation is claimed. Next useful work is tighter framing and a more compact inspector, guided by the retained scenes and measured feedback.

---

The following checkpoints describe the earlier marble-specific scope and are historical; the general-workshop contract above supersedes their product boundaries.

# Earlier checkpoint — agent usability

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

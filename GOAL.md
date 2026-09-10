# Kinetic — general workshop checkpoint

## First native project implementation — 10 September 2026

The vision/showcase commit `92ee95cee622903325eb28baf49170ae1ca4dd55` was pushed to `main` through `gh-axi` and verified at the remote branch. GitHub Actions run `34536715645` completed successfully. Implementation continued on `feat/native-projects` from that commit.

Implemented a first source-project workflow: browser **New project**, CLI `project create/open/apply/pause/resume`, and the ninth MCP tool `kinetic_project`. Creation writes an editable empty Three.js entry, a manifest and dependency declaration. Version 3 snapshots use shared Workshop validation, revisions, history and persistence. Existing v1/v2 projects remain supported. The isolated WebGL preview serves adopted source/assets and the pinned Three.js runtime; it does not execute authored code on the service.

Source adoption validates a separate candidate preview, then rechecks the expected revision before committing. Failed source and stale candidates preserve the accepted project. Live inspection derives Three.js matrices, bounds, axes, source references and frame/camera metadata. Native captures preserve the human camera. Basic object/whole-scene feedback stores the actual capture, source revision and native time/frame. Save/import and restart retain accepted source; unaccepted working-file edits do not silently reload. The original `examples/native-orbit/` demonstrates custom shader code, procedural objects and animation. See `docs/NATIVE-PROJECTS.md` for the contract and limits.

Completed checks:

- `npm test`: **93/93 passed**. `npm run build`: passed; static and **6.57 MB** standalone output.
- Original browser **35/35**, replay **24/24**, general scene **24/24**, native project **24/24**: **107 browser checks**, all with zero unexpected page exceptions. Python tooling ran through `uv` with Playwright 1.57.0 and installed Chromium.
- External stdio MCP returned **five original PNGs**, **five scene PNGs**, and **one native PNG**. The native suite exercised successful browser, CLI and MCP creation; source adoption; custom rendering; geometry probe; feedback; stale/broken candidates; host DOM/API isolation; directory restoration on undo; accepted-source persistence and portable import. Native acceptance is now part of CI.
- Actual native desktop/mobile screenshots, legacy desktop/mobile captures, the native live demo and CLI PNG were inspected. One full-page live capture clipped the offscreen iframe; the original is preserved as `evidence/native-demo/capture-layout-failure.png`. Scrolling the viewport into view produced the complete render in `viewport-visible.png`; the CLI image independently contains the complete scene.
- `git diff --check` passed. Ripwire reports **zero gating regressions**, with four scoped acknowledgments for small independent browser-test wrappers and the standalone example's resource disposal. Eleven new-symbol and five minor findings remain disclosed; this is not a zero-debt claim. Its named Node tests were included in the full suite, and the native browser test exercises additional callbacks that static reachability does not resolve.

Evidence: `evidence/native-final-{node,build}.log`, `evidence/native-browser-final.log`, `evidence/native-regression-{browser-final,replay,scene}.log`, `evidence/native-browser/`, `evidence/native-demo/`, `evidence/native-quality-final.json`, `evidence/native-test-gate.txt`. The initial regression run exposed an outdated eight-tool MCP name assertion; its logs/results/screenshot are preserved in `evidence/native-first-regression-failure/`. The corrected assertion checks all nine real advertised tools. No-mistakes and actionlint are unavailable on this machine; no run of either is claimed.

The GitHub API credential accepted source publication but rejected a tree containing a workflow-file edit. The workflow definition was preserved, and the existing `tests/scene-browser.py` CI entry point now runs native acceptance after its own checks, propagating failure. This keeps the new suite required in CI without changing workflow permissions or configuration.

A foreground local demo service was started on loopback port 4317 with isolated state `evidence/native-demo/state.json`. Its `orbit-demo` source project was created and adopted through the CLI, and an isolated browser is connected. The default `.kinetic/workshop.json` was not replaced. No hosted deployment or agent scheduler is claimed.

Remaining work: typed parameter editing, richer region/time annotations, explicit human review acceptance, durable historical builds/recordings, extra package/build integration, WebGPU support and native standalone experience export. The first bridge accepts adapted factory modules and WebGLRenderer; Fly With Me has not been integrated. Native preview/source budgets and a bounded inspection index remain explicit. This is the first implementation toward the broader goal, not completion of the full roadmap.

## Creation from scratch is first-class — 10 September 2026

The user clarified that Kinetic must also create projects from scratch. Updated the vision, first roadmap milestone and README to cover both **New project** and **Open existing project** through a shared project/preview/revision/feedback/export model. New project must scaffold ordinary source, dependency/build setup and the Three.js bridge, open an empty preview, and give the agent the location, revision and capabilities. An existing repository, human-written boilerplate and mandatory templates are not prerequisites.

Acceptance now begins with an empty target directory and covers agent creation of an original animated scene, human feedback, revision, save and reopen; the existing-project path remains required. The current blank v2 scene and the proposed native-project scaffolder are distinguished explicitly. This update changes documentation only. `git diff --check` passed; the prior application checks remain applicable to unchanged source and were not repeated. General project scaffolding, the native-project bridge and richer feedback UI remain unimplemented.

## Product direction clarified — 10 September 2026

The user wants people to build freely with Kinetic, including experiences like `kunchenguid/fly-with-me`: a better interface to Three.js for agents and better visual feedback for humans. Added `docs/VISION.md` and rewrote the next-step sequence in `docs/SHOWCASE-AND-NEXT-STEPS.md`; README distinguishes this direction from implemented v0.5 capabilities. This supersedes the prior inspector-first recommendation.

Proposed milestone: connect a normal Three.js project through a small runtime bridge, expose semantic scene/parameter/source facts, attach human feedback to an exact view/moment/revision, and complete a revision/compare/review/save loop. Keep ordinary project code as the extension path, preserve Workshop adoption/history and v1/v2 projects, and retain the typed local-service boundary. Resource budgets must not turn the current primitive catalog or 64-object schema into the creative boundary of all projects.

Research: Fly With Me README, VISION, CONTRIBUTING and repository tree were read through `gh-axi`, at reference revision `1ede7880d495284687ae67357cf645698c542009` (`evidence/vision/reference-revision.txt`). Its procedural, animated, interactive experience and same-seed/same-vantage review are the compatibility target. The current `validateScenePart`, `Workshop.addFeedback`, shared view/transport paths and installed Three.js Object3D/ObjectLoader surfaces were inspected to distinguish existing support from proposed work.

The published reference was also opened in an isolated browser at seed 42 with WebGL2, Begin was pressed, and the actual flight screenshot was inspected (`evidence/vision/fly-with-me.png`). This was a visual reference check, not integration or performance qualification. Chromium's default launch lacked a usable sandbox in this environment; the isolated reference session required temporary launch flags. No shared browser profile or persistent configuration was changed.

This is a documentation and planning change. Application source and the previously verified 90 Node / 83 browser checks are unchanged; they were not repeated for prose edits. `git diff --check` is the relevant final file check. Native-project loading, the richer feedback interface and Fly With Me integration remain unimplemented.

## Capability showcase and next-step plan — 10 September 2026

Rechecked application source `81f456498` (v0.5.0) on Linux. Added `examples/bounce-lab.json` and `docs/SHOWCASE-AND-NEXT-STEPS.md`, linked from README. Application source is unchanged. The earlier authored-rest camera change is present in this merged checkout.

Completed checks and evidence:

- `npm test`: **90/90 passed**. `npm run build`: passed; standalone **6.55 MB**.
- All three Python browser suites ran through `uv` with Playwright 1.57.0 and installed Chromium: **35/35**, **24/24 replay**, **24/24 scene**. Zero page exceptions. External stdio MCP returned **five actual PNGs per mode**.
- Custom live CLI showcase created an 11-object Bounce lab, extracted **122 real time/height samples** into a plot, and confirmed annotations left the physics frames identical. Changing sphere restitution 0.9 → 0.1 changed its height at 1.2 s from **1.9354 m → 0.7794 m**. Both runs correctly use `success:null`.
- The marble example changed from failure to dwell-confirmed success at **4.8917 s** after lowering `bridge.y` **2.5 → 2.2 m**. Actual replay comparisons and CLI PNGs were captured.
- Portable Bounce lab export/import retained all 11 object IDs and 122 plot points. Actual desktop/mobile, general scene, bounce replay and marble comparison screenshots were inspected. Nine recorded bounce instants support an interactive showcase; raw browser videos remain available.
- Final video: `evidence/showcase/bounce-replay.mp4`, 8.8 seconds of actual browser replay at half speed; a frame from the final crop was inspected. Full import verification is recorded in `import-verification.json`; the first compact inspection comparison is preserved separately because default output summarizes plot points.
- Logs and custom artifacts: `evidence/showcase/`. Required suite results/screenshots: `evidence/browser-results.json`, `evidence/mcp-results.json`, `evidence/replay/`, `evidence/general-browser/`. Source, run IDs and replay times are recorded in the showcase JSON files.
- Ripwire test gate: no changed/impacted code symbols. `quality-delta` failed to obtain a baseline in this checkout; no quality-delta pass is claimed. No application code changed.

Recommended next increments: compact inspector and authoring layout; readable text/plot captures; bounded experiment bundles with complete MCP export; broader examples and fresh task evaluations. The linked guide supplies acceptance criteria. These are plans, not implemented features or scheduled jobs.

The local demo service was started on loopback port 4317 with isolated state `evidence/showcase/workshop-state.json`. The original default state path was not edited. Captures need a connected browser. Current limits remain 64 objects, 16 dynamic bodies, 1 MB documents, ten-second simulations, primitive-only physics, supplied-data plots and in-memory run/undo history. No hosted deployment, Safari/iPhone verification or hardware-performance claim is made.

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

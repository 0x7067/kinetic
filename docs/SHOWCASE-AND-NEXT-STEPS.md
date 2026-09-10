# Kinetic showcase and next steps

Verified on 10 September 2026 against application source `81f456498` (v0.5.0). Kinetic is a working local visual workshop for people and agents: create a scene, inspect its geometry, render it, optionally simulate it, revise it and save it.

## What works today

| Capability | Current behavior |
| --- | --- |
| Mixed visual scenes | Boxes, spheres, cylinders, planes, custom triangle meshes, text, lines, arrows, embedded PNGs and supplied-data plots share a 3D workspace. |
| Geometry inspection | Three.js computes world transforms, bounds, axes, planar normals, primitive top-face normals, downhill directions and useful camera poses. |
| Optional physics | Boxes, spheres and cylinders can be fixed or dynamic. Rapier runs a fresh world at 120 Hz, with real contacts and recorded transforms/velocities. |
| Replay and revision | Pause, scrub, step and compare an earlier run using a ghost. Feedback carries the displayed object, time, revision, camera and capture. |
| Human and agent authoring | Browser, CLI and eight MCP tools share the same validated project. Revision checks protect newer edits; batches are atomic and undoable. |
| Portable projects | CLI/browser export and import preserve IDs and embedded assets. The standalone HTML supports browser-only authoring, physics and local persistence. |

Scene runs use `success: null`: completion does not establish that a user's objective was met. The marble example separately retains its fixed rules, three-part budget and cup-dwell success criterion.

## Three demonstrations

### Motion & meaning

The built-in example combines a physical ball and tilted block with text, an arrow and an illustrative plot. The live CLI probe of the tilted block returned a top-face normal of approximately `(0.31, 0.95, 0)` and downhill direction `(0.95, -0.31, 0)`. These are computed geometry facts. The built-in plot contains illustrative supplied data.

Capture: `evidence/showcase/mixed-scene.jpg`. Structured evidence: `evidence/showcase/ramp-probe.json`.

### Bounce lab

[Open the portable scene](../examples/bounce-lab.json). Eleven objects combine two dynamic spheres, a dynamic cylinder, a fixed platform, labels, a gravity arrow and a plot. The bodies start at 4 m. The fixed platform uses restitution 0.5; the three dynamic bodies use 0.1, 0.5 and 0.9.

The plot's 122 time/height samples were explicitly extracted from the high-restitution sphere's real recording and added as scene data through a CLI batch. A repeat run after adding annotations produced identical physics frames. This demonstrates a measured-data workflow through the current tools; plots do not automatically bind to a simulation.

Changing that sphere's restitution from 0.9 to 0.1 changed its recorded center height at 1.2 seconds from **1.9354 m to 0.7794 m**. Both scene runs completed, with no inferred success criterion. The example retains the original baseline data; editing the physics does not refresh the plot automatically.

To load it into a running service:

```sh
node cli.js inspect
# Replace N with the returned revision.
node cli.js import examples/bounce-lab.json --revision N
node cli.js probe high
node cli.js run
node cli.js render side
```

Open the workshop browser for captures. `run` returns the recording ID for `replay RUN_ID --at 1.2`. The plot is easiest to read with `render side --focus height-plot`.

Evidence: `evidence/showcase/bounce-{measured-run,baseline,candidate,comparison}.json`, `bounce-comparison.jpg`, `replay-captures.json`, nine actual browser replay captures, and `cli-transcript.json`. The final example was exported and imported again through the live CLI. Its 11 IDs and all 122 plot points survived import.

[Watch 8.8 seconds of actual replay](../evidence/showcase/bounce-replay.mp4), showing four simulated seconds at half speed. This is a crop of the recorded browser viewport; a frame from the final MP4 was inspected.

### Marble repair

The initial layout failed. Lowering `bridge.y` from **2.5 m to 2.2 m** produced a successful recording at **4.8917 simulated seconds**, including the required cup dwell. The comparison displays the failed path beside the successful path at the same recorded time. No auto-tune was used in this demonstration.

Evidence: `evidence/showcase/marble-comparison.json`, `marble-comparison.jpg` and `marble-solved.json`.

## Recommended sequence

Revised after the user's clarification on 10 September 2026: the goal is an agent-friendly interface to general Three.js projects and a stronger human feedback loop. [The product vision](VISION.md) supersedes the original inspector-first recommendation. The current showcase above remains an accurate description of v0.5.

### 1. Create or open a native Three.js project

Provide **New project** from an empty workspace through browser, CLI and MCP: create the editable source and dependency/build setup, a minimal Three.js entry point, the runtime bridge and a ready empty preview. Return the project location, revision and capabilities to the agent. No pre-existing repository, human-written boilerplate or mandatory template is required. Keep optional starters available, preserve existing files and report setup failures with a recoverable state.

Also connect existing projects through the same small bridge for their scene, renderer, cameras and update loop. Support semantic object/group IDs, declared editable parameters, source references, frame-consistent captures, errors and capability discovery. Keep ordinary code and assets as the authoring surface. The existing declarative workshop becomes one supported project type.

Acceptance: beginning with an empty target directory, an agent creates a project and builds an original procedural scene with animation, a custom material and camera controls, then inspects, changes and captures it through CLI/MCP without introducing a new Kinetic object kind. Save and reopen the result. Repeat the relevant loop with an existing project. Parameter edits and adoption of source builds retain revision checks. Existing v1/v2 projects still open and behave correctly. A failed candidate build leaves the current preview available and returns actionable errors.

Implementation starts at `src/scene-model.js` / `src/model.js` for the project/revision boundary, `src/view.js` for the preview bridge, and the shared `server/client.js`, `server/http.js`, `server/mcp.js` and `cli.js` transport paths. Avoid encoding all Three.js classes into another central catalog.

### 2. Make visual feedback the main human workflow

Let people select objects, pin world-space points, mark image regions, and comment on moments or ranges. Preserve the exact camera, frame/time, seed/state when available, source revision and capture. Add a contextual review panel and before/after views that use matching conditions; make acceptance and requests for changes explicit human actions.

Acceptance: “Make these clouds softer, keep the mountain silhouette” reaches an agent with enough evidence to find the intended content and reproduce the reference. The agent can return a candidate for human comparison. Missing raycast targets, regenerated objects and deleted IDs keep their original visual evidence and do not silently point elsewhere. The scene and review controls remain usable at 1440×900 and 390×844.

Extend `Workshop.addFeedback` and its shared transports; preserve its existing historical-revision checks. The current text/object/camera/time/capture attachment is the foundation. Compact inspection and readable annotations belong within this workflow.

### 3. Preserve complete projects and review decisions

Tie candidate builds to source/assets/dependency snapshots and parameter revisions. Save selected captures, recordings and feedback against those revisions. Add complete CLI/MCP project export and a standalone experience build without editor chrome.

Acceptance: export, restart and import restore the reviewed project and before/after context without silently rerunning physics or claiming deterministic playback for live-only code. A human edit made while an agent builds produces an explicit revision conflict. Invalid bundles fail atomically, with existing size/count safeguards adapted to project assets and bounded evidence.

### 4. Prove breadth with real projects

Use [Fly With Me](https://github.com/kunchenguid/fly-with-me) as the demanding compatibility reference, then an interactive data scene and an annotated model. Exercise custom rendering and procedural instances, not just larger arrangements of primitives. Record the integration work required; native support for the reference is not yet implemented.

Have a fresh evaluator carry one human feedback request through source/parameter revision, comparable captures, human review and reopen. Measure missing capabilities, unsupported targets, retries, calls, frame consistency and actual resource use. Successful acceptance requires this loop to work across different project types without new core object kinds.

These are proposed increments. The current blank v2 scene is available today; general Three.js project scaffolding, the native-project bridge and richer feedback UI remain to be implemented. No scheduled work or integration of Fly With Me is claimed by this planning update.

## Verification and limits

Current Linux verification passed **90 Node tests**, build, **35 original browser checks**, **24 replay checks** and **24 general-scene checks**. All browser reports contain zero page exceptions. External stdio MCP checks returned five real PNGs in each mode. The custom showcase separately exercised live CLI creation, inspection, simulation, rendering, replay, comparison and export/import. Actual desktop, mobile, scene and comparison screenshots were inspected.

Logs: `evidence/showcase/{node,build,browser,replay-browser,scene-browser,capture}.log`. Results and original acceptance screenshots remain in `evidence/`, `evidence/replay/` and `evidence/general-browser/`. Generated evidence is local and ignored by Git. The portable Bounce lab scene and this guide are repository artifacts. Application source is unchanged.

Ripwire's test gate found no changed/impacted code symbols. Its quality-delta command could not obtain a baseline in this checkout and is not recorded as passed. Full application checks and direct artifact verification provide the evidence above.

The first import comparison used compact inspection, which intentionally summarizes long geometry, and therefore did not match the complete export. That output is retained as `evidence/showcase/imported-example-compact.json`; repeating the comparison with `inspect --full --json` passed (`import-verification.json`).

Current boundaries: 64 objects, 16 dynamic bodies, ten-second simulations and 1 MB documents; primitive-only collisions; visual-only custom meshes; bounded embedded PNGs; supplied-data plots; in-memory run/undo history. Captures require a connected browser. Testing used Linux software-WebGL Chromium; this is not Safari/iPhone or hardware-performance certification.

The demo service uses loopback port 4317 with isolated state at `evidence/showcase/workshop-state.json`; it does not replace the normal `.kinetic/workshop.json`. No hosted deployment or agent scheduler is included.

Historical context: Funes general-workshop session `01a0871c-8736-7151-9a55-59c993f34935`, 10 September 2026, turn 463, established the general-workshop scope. Current behavior and counts above were checked against this checkout; that session's older branch and test-count statements are historical.

# Kinetic — Ideas in motion

An open workshop for people and agents: create a 3D scene, add text, arrows, images and data plots, inspect its geometry, and optionally simulate physical objects. Three.js supplies rendering and spatial reasoning; Rapier supplies real physics. The loop is create → inspect → run → revise → save. The marble challenge is one example, alongside a blank workspace and a mixed scene.

The [product direction](docs/VISION.md) is broader: create a native Three.js project from scratch or open an existing one, build with an agent, and give human feedback directly on the visible work. The first [native project bridge](docs/NATIVE-PROJECTS.md) now supports ordinary source files, custom geometry/shaders, isolated previews, validated source revisions and object-linked visual feedback.

## Open the workshop

Node.js 22+ and a WebGL2 browser:

```sh
git clone https://github.com/0x7067/kinetic.git
cd kinetic
npm ci
node cli.js serve
# Open http://127.0.0.1:4317
```

A fresh service opens an empty scene. **Scene example** loads “Motion & meaning,” mixing physical shapes, annotations and an illustrative plot. **Marble example** opens the original fixed challenge. Switching templates is an undoable edit; existing saved projects are retained on startup.

**New project** creates an editable Three.js source project and an empty preview. Agents can use `node cli.js project create my-world --revision N`, edit the returned files, then `project apply --revision N`. The browser validates source changes before adoption. [Orbit study](examples/native-orbit/) is an original animated shader scene you can open with `project open examples/native-orbit --revision N`.

See the [verified showcase and next-step plan](docs/SHOWCASE-AND-NEXT-STEPS.md), including an importable [Bounce lab](examples/bounce-lab.json) with a plot derived from recorded physics.

For browser-only use, run `npm run build` and open `dist/kinetic-standalone.html`. Dependencies are embedded. It supports v1/v2 scene authoring, physics and replay, with local browser persistence and no CLI/MCP connection. Native source previews require the local service. Keep third-party notices with redistributed builds.

## Agent interface: CLI first

```sh
node cli.js --help
node cli.js inspect
node cli.js new demo --revision N
node cli.js probe ball
node cli.js run
node cli.js replay RUN_ID --at 1.5
node cli.js set ball y=5 --revision N
node cli.js run --capture
node cli.js compare BASELINE_RUN_ID CANDIDATE_RUN_ID
node cli.js render iso
node cli.js save working-project.json
```

Replace `N` with the revision from `inspect` and run IDs with those returned by `run` or `runs`. `batch --help` documents object types, defaults, limits and atomic operations. `set --help` lists scalar properties; use JSON batches for mesh vertices, line/plot points and embedded images. See [the scene guide](docs/SCENE-WORKSHOP.md) for a complete creation example and project format.

Edits require an inspected revision and never silently overwrite a newer human edit. Batches commit together in one undo step or reject together. Retry uncertain edits with the same request ID and identical payload. `save` creates missing parent directories and requires `--force` to replace an existing file.

Default output is compact. `--json` exposes structured facts; `--full --json` explicitly includes large geometry, embedded assets or full traces. Three.js computes world transforms, bounds, local axes and useful camera poses. Captures return actual PNG files and require an open browser; missing or undecodable images are reported explicitly. Default iso, side and top captures frame authored rest poses; `--focus ID` tight-crops that live object. Remote captures that omit a view mode preserve the human's camera and replay position.

## Create, simulate and review

Scenes support boxes, spheres, cylinders, planes, custom triangle meshes, text, lines, arrows, embedded PNGs and supplied-data plots. All start as visual objects. Set a box, sphere or cylinder to `fixed` or `dynamic` to include it in physics. There is no implicit floor. A scene run reports `rendered` or `completed` with `success: null`; it does not invent a goal or judge the work.

Replay pauses, scrubs and steps through recorded object transforms. Contact buttons jump to recorded first contact pairs. Compare two runs using a blue ghost and a field-by-field edit summary. Historical recordings show their own project revision; return to editing before changing the current document. Feedback attaches the displayed object, run, time, revision, camera and PNG. Resolving feedback is not human approval.

The marble example retains its original physical start, cup, three-part budget, dwell-based success and bounded local auto-tune. Auto-tune is local search, not an AI model. Its contact evidence includes measured first-contact normals, surface labels and marble velocity. The general scene mode records contact pairs and body state without those marble-specific fields.

## MCP adapter

Start the HTTP service and use **Agent tools** in the browser for configuration with the absolute path, or configure your client:

```json
{
  "mcpServers": {
    "kinetic": {
      "command": "node",
      "args": ["/absolute/path/to/kinetic/server/mcp.js"]
    }
  }
}
```

Nine tools share the CLI's project, physics and spatial operations: `kinetic_project`, `kinetic_inspect`, `kinetic_probe`, `kinetic_edit`, `kinetic_run`, `kinetic_view`, `kinetic_feedback`, `kinetic_replay`, and `kinetic_compare`. The project tool creates/opens/applies native source and controls live pause/resume. MCP returns native PNG image content. Edits persist automatically; exporting a complete project with embedded assets currently uses the CLI or browser. Feedback does not wake or supervise an agent.

## Persistence and boundaries

The service atomically saves project and feedback to `.kinetic/workshop.json`; `KINETIC_DATA` selects another location. Twenty runs and twenty undo entries are retained in memory and reset on service restart. Browser-only mode uses localStorage where available. Project export includes embedded assets, but not recordings or feedback. Version 1 marble projects still import; version 2 stores general scenes.

Version 3 stores native source snapshots. It supports up to 48 files, 750 KB of source/encoded assets and a 1 MB portable export; its 64-entry inspection limit does not cap rendered objects. Native previews require the local service and currently support WebGLRenderer, pinned Three.js/addons and local declared assets. Deterministic seek, diagnostic overlays, extra package/build integration and native standalone export remain future work.

Y is up, distances are metres, authoring angles are degrees. Each simulation uses a fresh Rapier world at 120 Hz for at most ten simulated seconds. General scenes allow 64 objects and 16 dynamic bodies. Custom meshes are visual only; images are bounded embedded PNGs; plots display supplied values. This is a bounded workshop, without arbitrary code, model providers, general engine infrastructure or a built-in agent orchestrator.

HTTP binds to loopback and validates Host/Origin headers. It is a local development service. No public deployment, telemetry, paid infrastructure or background agent is included.

## Verify and record

```sh
npm test
npm run build
python -m pip install playwright==1.57.0
python -m playwright install --with-deps chromium
python tests/browser.py
python tests/replay-browser.py
python tests/scene-browser.py
python tests/native-browser.py
```

`CHROMIUM_PATH` can select an installed Chromium. Tests cover real physics, validation/history, HTTP safety, live CLI/stdio MCP, actual images, desktop/mobile editing, replay isolation, persistence and standalone use. Screenshots, recordings, traces and JSON results are retained in `evidence/`, including failures. [GOAL.md](GOAL.md) records the latest checked state and limitations. Earlier marble agent trials remain documented in [AGENT-USABILITY.md](docs/AGENT-USABILITY.md).

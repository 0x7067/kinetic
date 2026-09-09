# Kinetic — Ideas in motion

A small marble workshop for people and agents. Three.js renders the workbench; Rapier runs the actual physics. The core loop is build → run → inspect → revise → save. No model, provider key, or game-engine framework is built in.

## Open the workshop

Node.js 22+ and a WebGL2 browser:

```sh
git clone https://github.com/0x7067/kinetic.git
cd kinetic
npm ci
node cli.js serve
# Open http://127.0.0.1:4317
```

For browser-only use, run `npm run build` and open `dist/kinetic-standalone.html`. Its dependencies are embedded. It has the same simulation and replay UI, but no CLI or MCP connection. Keep the third-party notices with redistributed builds.

## Replay lab

Run the deliberately broken track, then pause or scrub its recording. Contact chips jump to the first contact with each object. Step backward or forward through recorded samples. The velocity arrow shows the marble's recorded direction and speed.

Select **Return to editing**, change the layout and run again. **Compare with** overlays a previous attempt as a blue ghost: its marble, trajectory and deck outlines. Both recordings use the same simulated clock; the ghost stops at its recorded endpoint. A field-by-field summary reports what changed. A smaller miss distance is not automatically a successful run.

Historical recordings show their own project revision, with editing disabled until you return to the current layout. Feedback attaches the displayed object, run, simulated time, revision, camera and PNG rather than quietly attributing an old scene to a newer document.

Three.js supplies quaternion interpolation, world transforms, spatial bounds, raycasting, frame-focused captures and the comparison geometry. Replay interpolates between recorded samples; it neither reruns physics nor fits an invented curve. Samples include release, first contacts and the true final state. Contact positions are the marble's centre after the physics step. Surface labels distinguish decks, side rails, barriers, cup floor/walls and the workbench. Each first contact also records a Rapier world-space normal pointing from the struck surface toward the marble, or `null` when unavailable. Compare it with the deck normal from `probe` to distinguish an end impact from a supported landing. This is one measured manifold normal per object's first contact, not an exhaustive contact log or an inferred face label.

## Agent interface: CLI first

```sh
node cli.js --help
node cli.js inspect
node cli.js probe bridge
node cli.js run
node cli.js runs
node cli.js replay RUN_ID --at 1.5
node cli.js replay RUN_ID --at 1.5 --capture --view side --focus bridge --overlays
node cli.js compare BASELINE_RUN_ID CANDIDATE_RUN_ID
node cli.js save working-project.json
```

Replace the run ID placeholders with IDs returned by `run` or `runs`. Use the revision returned by `inspect` for edits: `node cli.js set PART_ID FIELD=VALUE --revision N`. Supported fields are `name`, `x`, `y`, `z`, `angle`, `yaw`, and `length`. `batch` applies typed add/update/remove operations atomically. `undo`, `redo`, `reset` and `import` also require the inspected revision; they never silently rebase a stale edit.

`set --help` lists field bounds and units; `batch --help` includes operation shapes and a runnable naming-only example. A batch commits all edits in one revision and one undo step, or none on error. `save` creates missing parent directories and refuses to replace an existing file unless `--force` is supplied.

`replay` and `compare` only read retained evidence: they do not create attempts or alter the layout. Add `--json` for structured output, and `--full --json` only when full traces are needed. Captures are PNG files with camera, run, revision and time metadata. Images require an open browser; unavailable images are explicitly reported. A remote capture preserves the human's camera and scrubber. A physics miss exits zero because the simulation completed: inspect `success` and `status`.

Try `examples/misaligned-landing.json` through `import` for a less forgiving layout with the same fixed rules. `docs/CLI-EVALUATION-v04.md` records a source-informed maintainer exercise, not a blind agent benchmark.

`docs/AGENT-USABILITY.md` records the subsequent isolated CLI/MCP trials, observed friction, and verification of the fixes. These small sequential trials do not establish a CLI-versus-MCP ranking.

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

Eight tools share the same operations: `kinetic_inspect`, `kinetic_probe`, `kinetic_edit`, `kinetic_run`, `kinetic_view`, `kinetic_feedback`, `kinetic_replay`, and `kinetic_compare`. MCP returns native PNG image content. Feedback does not wake or supervise an agent by itself. Marking a comment addressed is not human approval.

## Rules and persistence

Y is up, distances are metres, and authoring angles are degrees. One marble, at most three parts, fixed gravity/start/cup. Every attempt creates a fresh 120 Hz physics world, for at most ten simulated seconds. Success requires low-speed residence in the cup's physical sensor region for 0.4 seconds; hitting the workbench fails. Decorative supports are not colliders. Auto-tune is bounded local search, explicitly not an LLM.

The service atomically saves project and feedback to `.kinetic/workshop.json`; set `KINETIC_DATA` to choose another location. The twenty-run replay cache and twenty-entry undo history are in memory and reset on service restart. Browser-only mode uses localStorage for project/feedback where available. **Save project** exports the editable layout, not recordings or feedback.

The service binds to loopback and validates Host/Origin headers. It is not a publicly deployable multi-user service. No arbitrary-code tool, telemetry, network model calls or paid infrastructure is added.

## Verify and record

```sh
npm test
npm run build
python -m pip install playwright==1.57.0
python -m playwright install --with-deps chromium
python tests/browser.py
python tests/replay-browser.py
```

`CHROMIUM_PATH` can select an installed Chromium. The original suite covers CSP startup, editing, real MCP images, persistence, cancellation, responsive controls and offline simulation. The replay suite adds pointer scrubbing, contact/frame jumps, historical feedback, CLI captures, ghost comparisons and mobile replay. Screenshots, WebM recordings, traces and JSON results are retained in `evidence/`, including on failures. `GOAL.md` records the latest measured checkpoint and remaining limits.

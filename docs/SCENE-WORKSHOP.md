# General scenes

Kinetic's default workspace is a version 2 scene. It can be a diagram, annotated model, data illustration or physical experiment. Rendering does not require physics. The original version 1 marble project remains a separate example with fixed challenge rules.

## Create through the CLI

Start `node cli.js serve` and open the browser. Inspect the revision before each edit:

```sh
node cli.js inspect
node cli.js new scene --revision N
node cli.js inspect
```

Save this as `operations.json`, then run `node cli.js batch operations.json --revision N` with the newly inspected revision:

```json
[
  {"type":"configure","title":"Gravity study","settings":{"duration":3}},
  {"type":"add","part":{"id":"floor","kind":"box","width":8,"height":0.2,"depth":5,"body":"fixed","color":"#567969"}},
  {"type":"add","part":{"id":"ball","kind":"sphere","x":-2,"y":4,"radius":0.5,"body":"dynamic","restitution":0.7}},
  {"type":"add","part":{"id":"heading","kind":"text","text":"A gravity study","y":6,"width":8,"height":1.2,"color":"#283f36"}},
  {"type":"add","part":{"id":"direction","kind":"arrow","x":-4,"y":4,"points":[[0,0,0],[0,-2,0]]}},
  {"type":"add","part":{"id":"data","kind":"plot","name":"Illustrative supplied data","x":4,"y":3,"width":4,"height":2.5,"points":[[0,0],[1,1],[2,0.5],[3,2]]}}
]
```

```sh
node cli.js probe ball
node cli.js render side
node cli.js run --capture
node cli.js replay RUN_ID --at 1.5 --capture --view side
node cli.js save gravity-study.json
```

Use the returned run ID. Captures need a connected browser. The example plot is supplied data, not a measurement of this ball. Actual recorded body positions, velocities and contacts are available through `run` and `replay`; an agent can turn measured samples into plot points explicitly.

## Objects and coordinates

An add requires `id` and `kind`, plus the payload listed below. IDs start with a letter and contain at most 40 letters, digits, underscores or hyphens. Names default to the ID. Defaults: position/rotation zero; width/height/depth 1; radius 0.5; color `#d27a57`; opacity 1; body `none`; restitution 0.3; friction 0.5.

| Kind | Geometry or required payload | Physics |
| --- | --- | --- |
| `box` | `width`, `height`, `depth` | Optional |
| `sphere` | `radius` | Optional |
| `cylinder` | `radius`, `height`; axis local Y | Optional |
| `plane` | `width`, `height`; local XY | Visual |
| `mesh` | `vertices: [[x,y,z],...]`, triangle `indices: [0,1,2,...]` | Visual |
| `text` | `text`; `width` and `height` define its local XY panel | Visual |
| `line` | `points: [[x,y,z],...]` | Visual |
| `arrow` | Exactly two distinct XYZ points | Visual |
| `image` | `data: "data:image/png;base64,..."`; local XY panel | Visual |
| `plot` | `points: [[x,y],...]`; local XY panel | Visual |

Positions are metres with Y up. `angle` rotates about Z, `yaw` about Y, `roll` about X, using the shared Three.js quaternion transform. Mesh vertices and line/arrow points are local coordinates transformed with the object. Plot points are data values, mapped to the panel. Probe returns the computed transform, bounds, axes and camera suggestions. Planar panels expose their +Z surface normal. Boxes and cylinders expose the authored local +Y face as `topSurface`, with its world normal, center and gravity-projected downhill direction (null when flat relative to gravity). This face is explicit; it is not a measured collision normal. Other shapes have no single surface normal.

## Operations and persistence

`update` takes `{type:"update",id,changes}`; ID and kind are immutable. `remove` takes `{type:"remove",id}`. `configure` merges `title` and/or `settings`; settings accept `background`, `gravity` and `duration`. `{type:"workspace",template:"scene"|"demo"|"marble"}` must be the sole operation when switching modes. All operations go through Workshop validation, revision checking and history.

A project has `{version:2,revision,title,settings,parts}`. The `parts` array contains scene objects for compatibility with shared history and tools. `examples/workshop.json` is an importable mixed scene. Save/import retain object IDs and embedded images; import advances the current revision. Service edits persist automatically. Run recordings are an in-memory cache and are not included in project export. MCP currently has no separate complete-project export tool; use CLI `save` or browser **Save project** for a portable file.

## Budgets and simulation semantics

- 64 objects, 16 dynamic bodies, 1 MB project/operation-file size; at most 20 operations per batch.
- Positions, local coordinates, plot values and gravity components: −100 to 100. Authoring rotations: −180° to 180°. Dimensions: 0.02–100; radius: 0.02–50.
- Text: 1–500 characters. Lines/plots: 2–512 points. Meshes: 3–3000 vertices, at most 9000 valid triangle indices.
- PNG only: at most 128 KiB decoded and 1024×1024. Remote URLs are rejected. Header validation happens at edit time; actual browser decoding is checked before capture and failures are explicit.
- Colors: `#RRGGBB`; opacity and restitution: 0–1; friction: 0–2. Background defaults to `#eceee6`.
- Gravity defaults to `[0,-9.81,0]`; duration defaults to 5 seconds and accepts 0.1–10. The fixed 120 Hz timestep rounds the endpoint up to a whole tick.

Bodies default to visual-only `none`. Set primitive bodies to `fixed` or `dynamic`; add your own floor. Each run creates a fresh Rapier world. Recordings include the initial state, 30 Hz samples, first-contact samples and the final state. At most 128 first contact pairs are retained. Replay interpolates recorded positions/quaternions without recomputing physics. Static scenes return one frame at time zero and status `rendered`; dynamic scenes return `completed`. Both use `success:null` because there is no challenge objective.

There are no joints, forces, arbitrary scripts, custom collision meshes, imported 3D formats or inferred goals. The current foundation is direct creation, inspectable geometry, optional measured motion, evidence and revision through the same human/agent document.

# Native Three.js projects

Kinetic can create an empty source project, preview ordinary Three.js modules, and adopt source changes after checking the new preview. The browser, CLI and `kinetic_project` MCP tool share this workflow. The existing scene and marble workspaces remain available.

## Start from scratch

Start `node cli.js serve` and open its browser. Click **New project**, or use:

```sh
node cli.js inspect
# Replace N with the inspected revision.
node cli.js project create my-world --revision N
```

The result reports the new source directory and revision. It contains `main.js`, `kinetic.project.json`, a package manifest declaring the pinned Three.js dependency, and a short README. The initial scene contains a camera and lighting with no authored geometry. Kinetic serves its installed Three.js 0.186.0 and addons for the managed preview, so this path needs no project-local package installation.

Directories are created under `KINETIC_PROJECTS`, or `projects/` beside the service's state file by default. A name uses lowercase letters, numbers and hyphens. Existing directories and files are preserved; creation rejects collisions.

Edit the source using normal tools, then apply it:

```sh
node cli.js project apply --revision N
node cli.js inspect
node cli.js probe sculpture
node cli.js render side --focus sculpture
node cli.js project pause
node cli.js project resume
node cli.js save my-project.json
```

The source directory is a working draft. **Apply source changes** prepares an isolated candidate preview. The service adopts it only after successful initialization and a valid inspection receipt, and checks the revision again before committing. A syntax/initialization error or a newer human edit preserves the accepted source snapshot. Apply needs a connected browser; creating the initial project does not.

## Entry contract

Export `createProject({ canvas, THREE })` from the entry module; it may be asynchronous. Return:

```js
{
  scene,                  // THREE.Scene
  camera,                 // THREE.Camera
  renderer,               // WebGLRenderer using the supplied canvas
  update(time, delta) {},  // optional animation, elapsed seconds
  resize(width, height) {},// optional project-specific resize handling
  render(camera) {},      // optional custom rendering; use the supplied camera
  dispose() {}            // optional cleanup for project-owned resources
}
```

The bridge owns the animation scheduling, calls `update`, and renders through the supplied renderer or `render(camera)`. It sizes the renderer and updates a perspective camera's aspect. Imported modules can use `three`, `three/addons/`, and relative files declared in the manifest. Code can construct its own geometries, custom shaders, hierarchies and interactions without adding Kinetic object kinds. See [the empty starter](../templates/native/main.js) and [Orbit study](../examples/native-orbit/main.js), which creates an animated shader sculpture and procedural orbit.

This first bridge supports WebGLRenderer. Third-party bare package imports, arbitrary build commands and WebGPU renderers are not wired into this preview yet. A declared dependency in package.json is not automatically installed or executed by Kinetic.

## Open existing source

Adapt the entry to the contract above and add a manifest:

```json
{
  "version": 1,
  "id": "my-project",
  "title": "My project",
  "entry": "main.js",
  "files": ["main.js", "geometry.js", "assets/texture.png"]
}
```

`id` is optional when first opening a directory; an ID derived from its canonical path is used if absent. Include a stable ID when moving source between directories. Paths are relative and explicit. Listed source/assets are snapshotted, so editing a working file cannot silently change an accepted view. JS/MJS, JSON, GLSL, PNG/JPEG/WebP, GLB/glTF and binary data are supported; list referenced dependencies and assets too. Symlinks and paths escaping the project are rejected.

```sh
node cli.js inspect
node cli.js project open examples/native-orbit --revision N
```

An existing project must satisfy the bridge contract; this is not automatic compatibility with every Three.js application. Fly With Me remains a broader compatibility target.

## Inspect and give feedback

Tag important objects or groups with stable logical IDs:

```js
object.userData.kinetic = {
  id: 'sculpture',
  name: 'Animated shader sculpture',
  source: 'main.js'
};
```

The bridge inspects tagged objects when tags exist, otherwise it provides a bounded index of renderable objects. Automatically assigned index IDs are not stable across structural code changes; use tags for durable object references. Inspection reports world bounds, matrices, axes, source references, camera, animation time/frame and basic renderer counters. It returns at most 64 inspection entries, with total counts and a truncation flag. This does not limit the number of objects that can render.

Select an object in the preview or choose its feedback target, write a note, and save feedback. The note carries its actual capture, project revision, target, camera and native animation time/frame. The agent reads it using the existing feedback commands. Native capture can frame the scene or an object while restoring the human's camera. Diagnostic overlays are explicitly unsupported in this first bridge.

Pause/resume controls live animation. Native time is not a stored physics recording and there is no deterministic seek, challenge success criterion or automatic Rapier integration. A project can implement its own behavior, but Kinetic does not claim it is replayable merely because it animates.

## Revision and persistence boundaries

Version 3 JSON exports include the accepted source/assets and logical inspection IDs. Import validates the preview before adoption. Source and feedback persist across service restart; unaccepted file edits are not adopted on restart. Undo/redo use the same twenty-entry in-memory Workshop history as other project types and preserve the associated source directory while the service runs. Importing a portable JSON snapshot has no working-directory association; open a source directory to continue applying filesystem edits.

The first implementation permits 48 files, 750 KB of source/encoded assets and a 1 MB portable JSON export. Preview requests are bounded and isolated from host DOM and service APIs. These limits bound the prototype's operations; they do not define the long-term creative catalog. Arbitrary project code can still exceed a device's rendering budget; no performance guarantee is made.

Native previews require the local service. The standalone HTML build continues to support v1/v2 authoring; a native standalone experience export is future work. Typed parameter editing, visual region annotations, explicit human acceptance, durable historical builds/recordings, and broader renderer/dependency support are the next increments.

## Verify

`npm test` covers creation, filesystem boundaries, portable limits, revision history and compact output. `uv run --with playwright==1.57.0 python tests/native-browser.py` covers real browser creation, source adoption, custom rendering, CLI/MCP images, feedback, stale/failed candidates, mobile layout, sandbox boundaries, restart and source import. The existing `tests/scene-browser.py` CI entry point also runs native acceptance after the general-scene checks and propagates its exit status; it can still be run independently for focused verification.

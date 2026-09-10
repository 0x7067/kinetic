# Kinetic: Three.js creation with agents and human visual review

Kinetic should let people create the full range of things they can build with Three.js, with agents doing the implementation and humans directing the result through the visible work. Worlds, interactive experiences, models, diagrams, data visualizations, animations and physical experiments all belong here. The current marble and Bounce lab projects are examples, not the product boundary.

This direction follows the user's clarification on 10 September 2026. It supersedes the inspector-first priorities in the initial showcase plan. The [first native bridge](NATIVE-PROJECTS.md) now creates source projects and supports a preview/inspect/feedback/revise/save loop alongside v1/v2 scenes. The broader architecture below remains the direction: typed parameters, richer visual annotations, explicit review decisions and wider runtime integration are still to come.

## The experience we are building

A person starts a new project from an empty workspace and describes an animated landscape to their agent. Kinetic creates a runnable project with a connected preview, and the agent builds the scene and behavior. A human flies through it, pauses at a view, circles a cloud and says, “Make these softer, keep the mountain silhouette, and slow the bird's turns.” The agent receives that exact view and project state, identifies the relevant objects, parameters and source, and prepares a revision. The human compares both versions at the same view and moment, accepts the result or continues the discussion, and saves a project that can run on its own.

The same loop must work for an exploded mechanical model or an interactive chart. Kinetic supplies creation, observation and review tools; the project defines its content, behavior and success criteria.

## What the reference demonstrates

[Fly With Me](https://github.com/kunchenguid/fly-with-me) builds a seeded procedural world around a flying bird, with steering/orbit controls, animation, sound and saved flight state. Its [contribution model](https://github.com/kunchenguid/fly-with-me/blob/main/CONTRIBUTING.md) supports both declarative library entries and custom generators, while its [vision](https://github.com/kunchenguid/fly-with-me/blob/main/VISION.md) makes same-seed, same-vantage human comparison central to visual decisions.

That breadth is the relevant target. Kinetic should be able to work with such a project without translating its terrain, materials, animation and interaction into a growing list of Kinetic-specific object types. The reference is not claimed to run inside Kinetic today. Repository reference reviewed: `1ede7880d495284687ae67357cf645698c542009`.

## Creation: native Three.js projects

Starting from scratch is a first-class product workflow. **New project** creates an ordinary editable project, its dependency/build setup, a minimal Three.js entry point and the Kinetic bridge, then opens an empty live preview. The user does not need an existing repository, Three.js boilerplate or a template. Optional starters can accelerate common ideas without determining what the project can become.

Browser, CLI and MCP must expose project creation through shared operations. Creation returns the project location, initial revision, preview status and capabilities so an agent can immediately build and inspect its first result. The user describes their idea to the agent they already use; this does not require a built-in chat provider or agent orchestrator. A new target must preserve any existing files, and failed setup must leave an explicit, recoverable state.

**Open existing project** supplies the other entry point, connecting a project's current source and assets to the same workflow. Both paths use the same project model, preview bridge, revision handling, human feedback and export. An empty project and an imported experience should not become separate products with separate capabilities.

Support ordinary project source, assets and dependencies, together with a small runtime bridge. A project retains its Three.js scene, renderer, cameras and update loop. The bridge attaches Kinetic's observation and review capabilities to that running project. Creating custom shaders, procedural geometry, imported assets or interactions must be possible through normal project code without a Kinetic core change.

Keep the current declarative scene format as a convenient built-in authoring option, using the same bridge. Preserve v1 marble saves and v2 scenes. Resource budgets should describe preview cost and evidence size; the current 64-object ceiling must not become a creative limit on every project or every rendered instance.

Kinetic does not need to wrap every Three.js API. Agents already know how to write code. The missing interface connects that code to inspectable live results and precise human intent.

## Agent interface: discover, inspect, change and observe

CLI remains primary and MCP shares its facts and operations. A project reports its supported capabilities rather than pretending every experience can simulate or seek identically.

- Inspect the actual scene graph, cameras, materials, animation state and bounded performance/error summaries. Start with semantic groups; expand mesh, instance or vertex detail on request.
- Associate stable logical IDs and optional source locations with objects, groups and exposed parameters. A generated tree can be identified by generator/cell/instance, even if Three.js runtime objects are rebuilt.
- Expose useful parameters with names, types, units and ranges. Validated parameter edits use Workshop revision/history. Larger changes use the agent's normal source-editing tools.
- Capture named cameras, selected objects and requested moments with a receipt tying the image and measured facts to the same rendered revision and frame. Respect the human's view.
- Expose pause, resume, reset and seek only as supported by the project. Seeded reset/seek requires an explicit project contract; otherwise use retained recordings/snapshots or report live-only behavior.

Source changes produce a candidate build tied to a source/asset/dependency snapshot. Adopting the candidate into the active workspace checks the expected revision and records a history entry. A concurrent human parameter edit must cause a stale candidate to be rejected or explicitly reconciled. Live filesystem changes cannot silently replace the reviewed project.

Project code executes in an isolated preview. The service retains its existing loopback and typed-command boundary; it does not gain a general JavaScript or shell evaluation tool. The project owns its experience code, while Workshop owns adopted revisions and review history.

## Human interface: feedback on the work itself

The scene should occupy most of the window, with contextual inspection, playback and a review panel. The interface must allow people to experience the work without permanently surrounding it with editor controls.

Feedback should support an object/group, a world-space point or region, a marked image region, a recorded moment or range, and whole-scene intent. A note includes the annotation, words, camera, frame/time, seed or reproducible state when available, source revision, relevant object/source references and an actual capture.

The image region remains valid evidence even if the scene cannot provide a precise raycast hit. A sky shader, transparent surface or removed procedural object must not make feedback disappear or silently attach it to something else. Preserve the original snapshot and mark unresolved anchors explicitly.

Review shows the agent's proposed change beside its referenced baseline at matching conditions, with a concise description of what changed. Human acceptance and an agent marking a note addressed are distinct events. Preserve accept, request-changes and reopen history; do not treat an agent's feedback resolution as approval.

## Persistence and export

Save source/assets/dependency references, declared parameters, reviewed snapshots and feedback together with stable revision IDs. Package sufficient content to reopen an experiment and understand a decision. Three.js object serialization can support scene data, but a dynamic experience also needs its authored behavior and project state.

Provide a standalone experience build without editor chrome and a separately reviewable project bundle. Capture/share should not require recreating the entire development environment. Publishing remains an explicit action.

## First acceptance scenario

Start from an empty target directory with no Three.js project. Through the normal creation interface, initialize a runnable project and preview. Have an agent build an original animated scene with procedural content, a custom material, camera controls and at least one declared parameter. The project must need no new Kinetic object kind or manual boilerplate supplied by the human.

A human selects or marks something in the view and submits feedback. A fresh agent, using CLI/MCP discovery and the project's normal source files, reproduces the reviewed view, implements a change, and provides comparable before/after evidence. The human accepts or requests changes. Reopening the saved project restores the decision context. A concurrent edit, missing object, live-only timeline or failed build must be represented accurately.

Also connect an existing ordinary Three.js project and exercise the same loop. Use Fly With Me as the demanding compatibility reference after establishing the bridge with a smaller original fixture.

Creation from scratch through feedback, revision and a reopenable result is the next product milestone, alongside the existing-project path. Inspector polish, physics breadth and further catalogs should serve it.

# Kinetic development contract

Kinetic is a general, agent-accessible visual workshop: create → inspect → render → revise → save, with simulation when the scene needs physics. Start with 3D scenes and useful 2D elements in the same workspace. The marble challenge is a sample project; do not treat its object catalog, part budget, or success criterion as limits on the whole product. Keep the shared loop small and reliable without adding a gameplay engine, provider SDK, chat facade, or multi-agent orchestrator.

The primary agent interface is the CLI. Preserve discovery, revision-safe creation and edits, structured inspection, rendering, optional simulation, and persistence through CLI and MCP. Keep default output compact; do not dump full trajectories, mesh arrays, or embedded image bytes unless explicitly requested. MCP is a thin adapter over the same project/physics/spatial facts, not a separate implementation.

Use Three.js for world-space reasoning as well as rendering. Structured inspection should derive transforms, bounds, endpoints, normals, downhill vectors, gap deltas and useful camera poses from Three.js math instead of asking an agent to infer geometry from screenshots. Visual captures remain complementary evidence.

Run `npm test`, `npm run build`, `python tests/browser.py`, `python tests/replay-browser.py`, and `python tests/scene-browser.py`. Also exercise the CLI and external stdio MCP client against a live local service. Inspect actual desktop/mobile screenshots, not only exit codes. Preserve failing evidence while diagnosing. Never relabel missing screenshots or incomplete tests as success.

All object, scene-setting, and workspace changes go through Workshop validation/history. Preserve version 1 marble saves and their fixed challenge rules. Version 2 scenes have optional physics and configurable scene settings; completed scene simulations have no implicit success criterion. Simulations use a fresh Rapier world, fixed timestep, and real contacts. Marble success still requires cup dwell. The renderer replays recorded results; it cannot decide that a challenge succeeded. Auto-tune belongs to the marble example and must be labeled as local search, never an AI model.

Keep HTTP loopback-only with Host/Origin validation. No arbitrary code tools. Bound operations, feedback size, runs, history, and solver retries. Do not let a stale agent overwrite a newer human edit. Preserve persistent IDs through save/import/undo. A feedback resolution is not human approval.

Before stopping, update GOAL.md with completed checks, evidence paths, and remaining limitations. Do not claim a hosted deployment or a background job unless one actually exists.

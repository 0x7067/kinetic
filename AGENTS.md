# Kinetic development contract

Keep creation → actual simulation → evidence → revision → persistence small and reliable. Do not add a provider SDK, chat facade, or multi-agent orchestrator. The engine is primitives plus an optional judge; marble-to-cup is one composition, not the runtime identity.

The primary agent interface is the CLI. Preserve the shell-native loop `help → inspect → run → probe → set → run`. Keep default output compact; do not dump full trajectories or base64 screenshots unless explicitly requested. MCP is a thin adapter over the same project/physics/spatial facts, not a separate implementation.

Use Three.js for world-space reasoning as well as rendering. Structured inspection should derive transforms, bounds, endpoints, normals, downhill vectors, gap deltas and useful camera poses from Three.js math instead of asking an agent to infer geometry from screenshots. Visual captures remain complementary evidence.

Run `npm test`, `npm run build`, and `python tests/browser.py`. Also exercise the CLI and external stdio MCP client against a live local service. Inspect actual desktop/mobile screenshots, not only exit codes. Preserve failing evidence while diagnosing. Never relabel missing screenshots or incomplete tests as success.

All part edits go through Workshop validation/history. A project owns its scene objects. Rapier is opt-in: skip it when there is no dynamic body. A dwell-sensor judge is optional; without one, a completed run reports `success: null` and `status: 'completed'`. The renderer replays recorded results; it cannot decide that the simulation succeeded. Auto-tune is local search and must be labeled accordingly, never as an AI model.

Keep HTTP loopback-only with Host/Origin validation. No arbitrary code tools. Bound operations, feedback size, runs, history, and solver retries. Do not let a stale agent overwrite a newer human edit. Preserve persistent IDs through save/import/undo. A feedback resolution is not human approval.

Before stopping, update GOAL.md with completed checks, evidence paths, and remaining limitations. Do not claim a hosted deployment or a background job unless one actually exists.

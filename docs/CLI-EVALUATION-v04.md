# Maintainer CLI exercise — v0.4.0

This is **source-informed exploration by the implementer**, not a blind benchmark, a fresh-agent evaluation or a claim about arbitrary model success. No auto-tune, model API or hidden solver was invoked. The shared locked challenge rules were unchanged.

## Layout

Starting from the original challenge, the landing ramp was set to y=2.65, z=0.45, pitch=-8°, yaw=8°. The final ramp had z=-0.25, yaw=-8°. The launch and cup were unchanged. The input is supplied as `examples/misaligned-landing.json`.

## Observed sequence

The first run failed at 2.6833 simulated seconds. Just before the first landing-ramp collision, a replay sample at 1.99 seconds showed forward velocity about 3.90 m/s. At the recorded 2.0417-second contact it was about -0.22 m/s. The collision reversed its forward motion; the marble then reached the workbench.

Lowering only the landing ramp to y=2.25 still failed, at 2.7000 seconds. Its closest distance improved by just 0.0289 m; that did not count as success. Correcting only its lateral position to z=0 then produced a successful 4.6083-second run, retaining both nonzero yaw settings and the altered pitch.

CLI comparison reported exactly the height and lateral-position edits. A live external stdio MCP client then read the first run at the collision instant and compared the failed and successful snapshots, without new attempts or document changes.

The terminal transcript contains twelve invocations, including investigation, both edits, three simulations, two comparisons and saving. The measured aggregate process time was 1.672 seconds and aggregate UTF-8 stdout was 6,283 bytes in this container. These numbers exclude reasoning time and are **not** token counts, end-to-end solve latency, browser performance or cross-transport benchmarks. The two exploratory MCP calls returned 1,147 and 2,042 JSON-serialized bytes; their inputs differed from some CLI calls, so this is not a fair CLI/MCP efficiency comparison.

## Improvement prompted by the exercise

Object-level contact names alone did not distinguish a deck impact from a rail impact. Surface tags were subsequently added. A regression test on the same geometry confirms the failed first landing contact is the local negative-Z rail, while the corrected layout first touches the deck. The replay CLI also now prints the velocity vector without requiring full JSON.

The full transcripts and raw input/output snapshots are included with the downloadable evidence. A useful next evaluation is a genuinely fresh agent using only CLI help or MCP discovery on held-out layouts under identical budgets. That has not been performed here.

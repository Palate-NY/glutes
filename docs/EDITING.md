# Editing the training data

This is the contract for changing workouts and plans. Read it before editing anything under `src/data/`.
Everything here can be done through the GitHub API from a Claude.ai chat; nothing needs a local checkout.

## Where things live

| What | Path | Rule |
|---|---|---|
| Workouts | `src/data/sessions/<type>.json` | One JSON array per file, grouped by type. Any new `*.json` file in the folder is loaded automatically. |
| Plans | `src/data/plans/<plan-id>.json` | One file per plan. Any new file is loaded automatically and sorted by start date. |
| Schemas | `schema/session.schema.json`, `schema/plan.schema.json` | Validate an edit against these before committing. |

Current session files: `rest.json`, `z2.json`, `threshold.json` (sweet spot, threshold, over-unders, climb sims), `vo2.json` (VO2, race pace, tests, Half Monty), `sprint.json`, `strength.json`, `cannes-2026.json` (camp-specific rides).

## The loop

1. Read the file you are changing. Read `src/data/sessions/*.json` if you need session ids.
2. Make the edit. Keep key order and formatting like the neighbours so the diff is small.
3. Check it against the schema in `schema/`, and against the rules below that a schema cannot express.
4. Commit straight to `main` with a message that says what changed in training terms, e.g. `Plan: swap W6 Wed to VO2 4x4, add STR_GYM on Fri`.
5. Check the commit status. The `Deploy` workflow runs tests, builds and publishes in about a minute. Green = live at https://palate-ny.github.io/glutes/. Red = the site stays on the last good deploy; open the failed run, read the test output, fix, commit again.

There is no PR flow. A broken commit never takes the site down, it just does not deploy.

## Session shape

```json
{
  "id": "SS_2x15",
  "name": "Sweet Spot 2×15",
  "type": "ss",
  "duration_min": 60,
  "description": "2 × 15min @ 240-258W (SS), 5min recovery",
  "tss": 75,
  "avg_power": 248,
  "notes": "optional, not shown in the app",
  "blocks": [
    { "dur": 900, "power": 160, "label": "Warm-up", "kind": "warm" },
    { "repeat": 3, "blocks": [
      { "dur": 30, "power": 305, "label": "Opener", "kind": "work" },
      { "dur": 60, "power": 145, "label": "Easy", "kind": "rec" }
    ] },
    { "dur": 900, "power": 248, "label": "Sweet Spot", "kind": "work" },
    { "dur": 300, "power": 145, "label": "Recovery", "kind": "rec" },
    { "dur": 900, "power": 248, "label": "Sweet Spot", "kind": "work" },
    { "dur": 480, "power": 130, "label": "Cool-down", "kind": "cool" }
  ]
}
```

Rules:

- `id` is stable and unique across all session files. Never rename an id a plan uses; add a new session instead.
- `type` is one of `rest`, `z2`, `ss`, `thr`, `vo2`, `strength`. `ss`, `thr`, `vo2` are hard days (orange). Sprints on a Z2 ride are `z2`.
- `dur` is seconds, `power` is watts. Powers are absolute; the ZWO export converts to FTP fractions using the current FTP in the app.
- `kind`: `warm`, `work`, `rec`, `easy`, `cool`. Only `work` blocks count as Work time in the chart.
- `{ "repeat": n, "blocks": [...] }` groups can nest. Prefer a group over pasting the same pair 13 times.
- `duration_min` should be within roughly 30% of the sum of the blocks. A test enforces 0.5x to 1.6x.
- Rest and strength sessions have `"blocks": []`, `"tss": 0`, `"avg_power": null`. No chart, no ZWO export.
- House conventions: warm-up 160W `warm`, cool-down 130W `cool`, recovery 145W `rec`, openers 30s @ 305W + 60s @ 145W.

## Plan shape

```json
{
  "id": "2027-season",
  "name": "2027 Season",
  "status": "active",
  "start": "2026-09-07",
  "goal": "FTP 300W + 700W/50s sprint by August 2027.",
  "blocks": [
    { "id": 1, "name": "Phase 1", "focus": "Prep", "purpose": "..." },
    { "id": 2, "name": "Phase 2", "focus": "Foundation", "purpose": "..." }
  ],
  "weeks": [
    { "week": 1, "label": "SEP W1 Prep", "block": 1,
      "days": ["REST", "Z2_60", "EASY45", ["Z2_60","STR_BW"], "REST", "LONG_Z2", "EASY45"] }
  ],
  "upcoming": [
    { "name": "Phase 3", "focus": "Build", "when": "Jan-Mar 2027", "note": "Plan in December." }
  ]
}
```

Rules:

- `start` is the Monday of week 1. Every date in the app is computed from it. Do not change it on a plan that has logged sessions.
- `weeks[].week` runs 1..n with no gaps, in order. Append weeks at the end; do not renumber.
- `days` has exactly 7 entries, Monday to Sunday. Use `"REST"` for a day off, never an empty array. A double day is a list; the first id is the main ride, others show as a chip.
- Every id in `days` must exist in a session file.
- Each `weeks[].block` must be a `blocks[].id`. Week ranges and dates on the block tiles are computed.
- Logged sessions are stored by date, so moving a workout to another day does not carry its log with it. That is intended: the log records what was done on that date.
- Dragging a day's calendar tile onto another day in the app swaps the two workouts for that browser only (a per-date override in localStorage, shown with a "moved" chip and a "Reset to plan" link). The plan file is not touched. If a swap should be permanent, make it here in the JSON.

## Common edits

Swap a workout: change the id in `days`. Nothing else.

Add a week: append `{ "week": 17, ... }` to `weeks`, with 7 days.

Add a phase: add a block with the next integer id, then weeks that reference it. Move the matching entry out of `upcoming`.

New workout: append to the matching type file (or a new file for a camp), then reference its id in the plan. If it is a variation, copy the closest existing session and change the numbers.

Retire a plan: set `"status": "completed"`. Do not delete it; the log for those dates stays viewable through the plan selector.

## What the tests check

- Every session and plan file validates (schema, ids, kinds, week numbering, 7 days, known session ids, Monday start).
- The ZWO writer still produces byte-identical files for the original sessions. Changing an existing session's blocks fails this test on purpose; if the change is intended, update `tests/fixtures/golden-v47.json` for that session or drop it from the fixture.
- The app boots and renders in jsdom.

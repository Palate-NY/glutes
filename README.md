# Glutes

[![Deploy](https://github.com/Palate-NY/glutes/actions/workflows/deploy.yml/badge.svg)](https://github.com/Palate-NY/glutes/actions/workflows/deploy.yml)

Personal cycling training planner and logger. Single user, vanilla JS, no framework.
Dark tile UI, Helvetica, chartreuse accents. Runs as a home-screen web app on iPhone.

Goal: FTP 300W + 700W sprint by August 2027.

## Two ways to work on it

- **Training changes** (workouts, plan, new phase): from a Claude.ai chat through the GitHub connector, no local tools. See "Editing from chat" below and `docs/EDITING.md`.
- **App changes** (UI, logic): clone, `npm install`, `npm run dev`, push.

## Editing from chat

Claude.ai's built-in "GitHub Integration" (Customize, Connectors) is read-only from chat: it attaches files and syncs a Project, it cannot commit. Committing from chat needs a custom connector to GitHub's remote MCP server, authorized through a GitHub App installed on this repo only. Setup is being verified; this section will carry the exact steps once it is.

Project instructions to use once the connector works:

   > You maintain the training data in the GitHub repo Palate-NY/glutes. Before any change, read CLAUDE.md and docs/EDITING.md from the repo. Edit only files under src/data/. Validate against schema/. Commit directly to main with a message describing the training change. After committing, check the commit status and report whether Deploy passed. If it failed, read the run output, fix, and commit again.

Where to look when something goes wrong:

- Commit status on GitHub: green check = live, red cross = tests failed, site unchanged.
- The `Deploy` run under Actions shows which test failed and why (session id unknown, 6 days in a week, bad block kind, ...).
- `docs/EDITING.md` lists the rules the tests enforce.

## Daily use

```bash
npm install        # once
npm run dev        # http://localhost:5173, hot reload
npm test           # session/plan validation, ZWO golden test, migration, app smoke test
npm run build      # production bundle in dist/
git push           # GitHub Actions tests, builds and deploys to GitHub Pages
```

## Layout

```
index.html                  page shell (Vite entry)
src/main.js                 boot: load + migrate state, pick plan, render, wire events
src/app.js                  runtime state shared by UI modules (plan, week, ftp, hrmax)
src/styles.css              all styles
src/data/sessions/*.json    workout library, grouped by type; any new file loads automatically
src/data/plans/*.json       one file per plan (weeks -> session ids); any new file loads automatically
src/lib/sessions.js         JSON loader, validation, repeat-group expansion
src/lib/plan.js             plan loader, validation, date math, current-week detection
src/lib/zwo.js              .zwo writer (byte-identical to the old app, golden-tested)
src/lib/session-log.js      "SESSION LOG" paste parser
src/lib/migrate.js          storage migrations (v1 position keys -> v2 date keys)
src/lib/storage.js          localStorage wrapper, export/import
src/lib/metrics.js          HR estimate, TSS helpers
src/lib/dates.js            local-date helpers
src/ui/week.js              This Week view, day cards, session forms, training blocks
src/ui/viz.js               workout profile chart + mini bars
src/ui/trends.js            Trends view
src/ui/upcoming.js          Upcoming view
src/ui/stats.js             FTP / HRmax / LTHR tiles + history modal
src/ui/data.js              export / import / toast
tests/                      Vitest; fixtures/golden-v47.json is the truth from the old app
schema/                     JSON Schemas for session files and plan files
docs/EDITING.md             the data contract for chat-driven edits
legacy/glutes-v47.html      the single-file app this was migrated from (v0 commit)
```

## Editing workouts

Add or change a session in `src/data/sessions/<type>.json`:

```json
{
  "id": "SS_2x15",
  "name": "Sweet Spot 2×15",
  "type": "ss",
  "duration_min": 60,
  "description": "2 × 15min @ 240-258W (SS), 5min recovery",
  "tss": 75,
  "avg_power": 248,
  "notes": "optional free text",
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

- `type`: `rest | z2 | ss | thr | vo2 | strength`. `ss`, `thr`, `vo2` count as hard days.
- `dur` is seconds, `power` is watts (ZWO export converts to FTP fractions).
- `kind`: `warm | work | rec | easy | cool`. Only `work` blocks count toward "Work" time.
- `{ "repeat": n, "blocks": [...] }` groups can nest.
- The id is what plans reference. Renaming an id breaks every plan that uses it; `npm test` catches that.

## Editing the plan

`src/data/plans/2027-season.json`. `start` must be a Monday. Each week has 7 days; a day is a session id or a list of ids (first one is the "main" ride). Blocks (phases) get their week ranges and dates computed from the weeks that reference them.

To add a new phase in December: append weeks, add a block, run `npm test`, push.

Old plans stay in the repo (`2026-climb-pr.json`) and can be viewed with the plan selector, so the log from May to August 2026 stays readable. Full rules: `docs/EDITING.md`.

## Data and storage

Everything lives in `localStorage` under the key `climb-tracker-state`, same as before.
Logged sessions are keyed by date (`2026-09-10/0`), not by plan position, so editing the plan never re-attaches a log to the wrong workout.

The first load of the new app converts the old position keys (`W3D1S0`) to dates and keeps the untouched original under `climb-tracker-state.v1-backup`.

`localStorage` is per origin: the GitHub Pages site and `localhost:5173` do not share data. Use the Data section at the bottom of the page (Export log / Import log) to copy your log to the dev server, or to back it up.

## Deploying

One-time: in the GitHub repo, Settings -> Pages -> Build and deployment -> Source: **GitHub Actions**.
After that every push to `main` runs tests, builds, and deploys. A failing test blocks the deploy.

The app icons live in `public/` and ship at the site root with the build. `public/icon.svg` is the fallback favicon.

## ZWO export

`src/lib/zwo.js` is tested against files generated by the old app (`tests/zwo.test.js`). If you intentionally change the format, regenerate `tests/fixtures/golden-v47.json` or update the test.

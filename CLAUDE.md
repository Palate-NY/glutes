# Glutes

Personal cycling training planner. Vanilla JS + Vite, deployed to GitHub Pages by the `Deploy` workflow on every push to `main`.

If you are here to change training (workouts, the weekly plan, a new phase): read `docs/EDITING.md` first, edit only files under `src/data/`, validate against `schema/*.json`, commit directly to `main`, then check the commit status. Do not touch `src/**/*.js` for a training change.

If you are here to change the app itself: `README.md` has the layout. Run `npm test` before pushing; the deploy blocks on failing tests.

Writing style for anything user-facing: no em dashes, short sentences.

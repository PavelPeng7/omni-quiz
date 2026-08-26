# Omni Quiz engineering harness

This file is the operational contract for humans and coding agents working in this repository. Keep it short, current, and executable. Product intent belongs in `docs/product-specs/`; architectural facts belong in `ARCHITECTURE.md`; temporary implementation state belongs in `docs/exec-plans/`.

## Start here

Before changing code:

1. Read `README.md` for user-facing behavior.
2. Read `ARCHITECTURE.md` for module boundaries and data flow.
3. Read `docs/product-specs/index.md` for product invariants.
4. Read `docs/exec-plans/active/progress.md` and `docs/exec-plans/tech-debt.md`.
5. Inspect `git status --short`; preserve unrelated work.

Use the repository evidence over stale documentation. If behavior and docs disagree, verify the behavior, then update both in the same change.

## Canonical commands

```bash
npm ci
./scripts/verify-quick.sh
./scripts/verify-full.sh
npm run dev
```

- Run `verify-quick.sh` during implementation.
- Run `verify-full.sh` before a commit, release, or handoff.
- Do not claim verification that was not run. Report environmental blockers exactly.

## Repository map

| Area | Responsibility |
| --- | --- |
| `src/types.ts` | Canonical plugin domain and persistence types |
| `src/parser.ts` | Untrusted Markdown Quiz JSON validation and legacy compatibility |
| `src/evaluator.ts` | Pure answer evaluation and formatting |
| `src/storage.ts` | Schema normalization, migration, sessions, attempts, and persistence queue |
| `src/renderer.ts` | Inline `quiz` block interaction |
| `src/catalog.ts` | Vault-wide Quiz discovery |
| `src/analytics.ts` | Pure dashboard aggregation |
| `src/dashboard.ts` | Dashboard `ItemView`, filtering, navigation, and visualizations |
| `src/main.ts` | Plugin composition, registrations, and lifecycle wiring |
| `skills/omni-quiz-generator/` | Separate authoring skill and its Schema v2 validator |
| `test/` | Plugin unit and regression tests |
| `styles.css` | Theme-aware plugin and dashboard presentation |
| `main.js` | Generated production bundle; required release artifact |

## Non-negotiable invariants

- Markdown Quiz blocks are the source of question content. Plugin `data.json` is the source of learning progress.
- Progress identity is `<Markdown path>::<quiz.id> -> session -> question.id`.
- Preserve `quiz.id` and semantically stable `question.id` values. Changing them disconnects history.
- New quizzes use Schema v2. Legacy blocks without `schemaVersion` remain readable as quick, single-choice L1 quizzes.
- Supported question types are only `single`, `multiple`, `true_false`, and `fill_blank` until the schema, parser, evaluator, renderer, analytics, generator skill, docs, and tests are changed together.
- Attempts are append-only within a session. First-attempt accuracy must not be overwritten by retries.
- A Markdown rename must migrate persisted history.
- Never invent Obsidian APIs. Check the installed `obsidian` type declarations and `minAppVersion`.
- Keep the plugin mobile-compatible: no unguarded Node runtime APIs, global `document`/`window`, regex lookbehind, or network dependency.

## Change workflow

1. Describe the user-visible outcome in `docs/exec-plans/active/progress.md` for multi-file work.
2. Make the smallest coherent change in the owning module.
3. Add behavior-focused tests. Parser and persistence changes require migration or malformed-input coverage.
4. Update all duplicated contracts when Schema v2 changes:
   - `src/types.ts`
   - `src/parser.ts`
   - `skills/omni-quiz-generator/references/quiz-schema.md`
   - `skills/omni-quiz-generator/scripts/validate-quiz.mjs`
   - samples, templates, tests, and user docs
5. Run the appropriate verification script.
6. Update product/design docs when the shipped contract or architectural decision changes.
7. Move a finished execution plan into `docs/exec-plans/completed/` and leave `active/progress.md` ready for the next task.

## Code and UI standards

- Prefer small, focused TypeScript functions and discriminated unions over casts.
- Keep parsing, evaluation, storage, analytics, and DOM rendering separate.
- Treat Markdown, saved plugin data, and DOM events as untrusted inputs.
- Use Obsidian DOM helpers and component lifecycle registration (`registerEvent`, `registerDomEvent`, `register`).
- Use `ownerDocument.defaultView` for cross-window DOM checks and timers.
- Scope CSS under `.quiz-container` or `.omni-quiz-dashboard`; use Obsidian variables, visible `:focus-visible` styles, and 44 px touch targets.
- Do not add a charting or UI dependency when native HTML/CSS is sufficient.
- Keep UI strings in sentence case and use plain task-oriented wording.

## Tests and release artifacts

- Every bug fix needs a regression test that fails without the fix.
- Pure logic belongs in testable modules; do not require an Obsidian runtime for parser, evaluator, storage, catalog extraction, or analytics tests.
- `package.json`, `package-lock.json`, and `manifest.json` versions must match.
- After `npm run build`, review and commit the updated `main.js` when source behavior changed.
- Do not edit a user's Vault `data.json` or install into an external Vault unless the user explicitly asks.

## Documentation maintenance

- `README.md`: installation and user-facing usage only.
- `ARCHITECTURE.md`: stable system structure and dependency direction.
- `docs/product-specs/`: what the product must do and what is out of scope.
- `docs/design-docs/`: durable technical decisions and their consequences.
- `docs/exec-plans/active/`: current execution state, validation, and blockers.
- `docs/exec-plans/completed/`: archived plans that explain shipped changes.
- `docs/exec-plans/tech-debt.md`: concrete debt with impact and exit criteria, not a wish list.

When adding a new rule, put it in the narrowest canonical document and link to it instead of duplicating paragraphs.

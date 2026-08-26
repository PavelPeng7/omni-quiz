# Omni Quiz architecture

## System context

Omni Quiz is a mobile-compatible Obsidian plugin with two connected surfaces:

1. Inline quizzes rendered from fenced `quiz` JSON blocks in Markdown.
2. A Vault-wide dashboard that discovers quizzes and visualizes persisted learning history.

The repository also contains `skills/omni-quiz-generator`, an authoring skill that produces and validates Schema v2 Quiz Markdown. The skill is distributed with the project but does not run inside the Obsidian plugin.

```text
Markdown quiz blocks ──> parser ──> inline renderer ──> evaluator
        │                              │                  │
        │                              └──── attempts ────┤
        │                                                 v
        └────> catalog ──> analytics ──> dashboard     storage
                                                        │
                                                        v
                                              Obsidian plugin data.json

Source notes ──> generator skill ──> Schema v2 quiz Markdown
```

## Runtime composition

`src/main.ts` is the composition root. On plugin load it:

- normalizes saved plugin data and creates one shared `QuizStorage`;
- registers the `quiz` Markdown code-block processor;
- registers the dashboard `ItemView`, Ribbon entry, and command;
- migrates history keys when Markdown files are renamed.

The plugin holds no server connection and makes no network requests.

## Module boundaries

### Domain and validation

- `src/types.ts` defines the canonical in-plugin Quiz, question, answer, session, attempt, history, and statistics types.
- `src/parser.ts` is the trust boundary for Quiz JSON. It converts unknown JSON into the discriminated domain model or throws `QuizParseError` with a user-facing diagnostic.
- `src/evaluator.ts` is pure domain logic. It evaluates answer values and formats submitted/correct answers for display.

Dependency direction:

```text
types <- parser
types <- evaluator
```

Neither module depends on Obsidian.

### Persistence

`src/storage.ts` owns all mutable learning state. Its responsibilities are:

- normalize persisted Schema v2 data;
- migrate legacy `results` data;
- create, complete, and append sessions;
- append immutable question attempts;
- calculate per-session statistics;
- serialize writes through a promise queue;
- migrate file-path-based keys after Markdown renames;
- notify dashboard subscribers after persistence succeeds.

Question content is never copied into plugin data. This avoids stale duplicated content and lets Markdown remain authoritative.

### Inline quiz surface

`src/renderer.ts` is a `MarkdownRenderChild`. It owns ephemeral drafts, edit/retry state, pending saves, and DOM rendering for one Quiz block. It delegates correctness to `evaluator.ts` and durable state to `QuizStorage`.

The renderer must not parse raw JSON, directly call `Plugin.saveData`, or implement dashboard aggregation.

### Dashboard surface

- `src/catalog.ts` reads Markdown files and extracts valid Quiz blocks. A malformed block becomes a catalog warning rather than aborting the entire Vault scan.
- `src/analytics.ts` is a pure aggregation layer over catalog entries and histories. It calculates first-attempt accuracy, cognitive-level distribution, question-type distribution, current progress, and activity.
- `src/dashboard.ts` is an Obsidian `ItemView`. It renders metrics, native progress visualizations, search/filter controls, warnings, and navigation to source notes. Vault changes are debounced before rescanning.

Dependency direction:

```text
parser <- catalog <- dashboard
types  <- analytics <- dashboard
storage -----------> dashboard
```

`analytics.ts` must remain independent of the Obsidian runtime so it can be unit tested.

## Data contracts

### Quiz content

New content uses Schema v2:

- modes: `quick`, `standard`;
- cognitive levels: `L1`, `L2`, `L3`, `L4`;
- question types: `single`, `multiple`, `true_false`, `fill_blank`.

The complete authoring contract is documented in `skills/omni-quiz-generator/references/quiz-schema.md`. Runtime parsing remains backward-compatible with legacy single-choice blocks.

### Learning history

```text
QuizPluginData
└── quizzes["<filePath>::<quizId>"]
    └── sessions[]
        └── answers[questionId][]
            └── { answer, correct, answeredAt }
```

Attempts are append-only. A session may have retries, but learning analytics use each question's first attempt within each session. Completed sessions are immutable from the UI; starting again creates a new session.

### Identity and renames

The Markdown path and `quiz.id` form the history key. `question.id` connects attempts to questions. `src/main.ts` invokes storage migration on Markdown rename so moving a note does not lose visible history. IDs must remain stable across content edits unless the semantic identity truly changes.

## Generator skill boundary

`skills/omni-quiz-generator` is a self-contained content-authoring package:

- `SKILL.md` defines generation behavior;
- `references/quiz-schema.md` documents the supported protocol;
- `assets/quiz-template.md` is the reusable output template;
- `scripts/validate-quiz.mjs` validates generated Markdown;
- `tests/validate-quiz.test.mjs` protects validator behavior.

The validator intentionally duplicates part of `src/parser.ts` because it must run as plain Node.js outside the plugin build. Schema changes therefore require explicit synchronized updates and tests in both locations.

## Build and deployment

TypeScript is type-checked with `tsc` and bundled by esbuild as CommonJS:

```text
src/main.ts -> esbuild -> main.js
```

Obsidian loads:

- `main.js`
- `manifest.json`
- `styles.css`

`main.js` is a tracked release artifact. Development dependencies are not shipped to a Vault. Versions in `package.json`, `package-lock.json`, and `manifest.json` must stay synchronized.

## Operational constraints

- `manifest.json` currently declares `isDesktopOnly: false`; all runtime changes must remain mobile-compatible.
- Obsidian UI may run in popout windows. DOM constructors and timers must come from the owning document/window.
- All visual styles must use Obsidian theme variables and remain scoped to plugin roots.
- Vault scans are read-only. Only `Plugin.saveData` writes learning history.
- The dashboard shows at most 100 filtered cards at once; catalog indexing still scans all Markdown files.

## Extension checklist

Adding a question type is a cross-cutting protocol change. Update, in order:

1. domain types;
2. parser validation;
3. evaluator behavior and formatting;
4. storage answer representation if needed;
5. renderer controls and result display;
6. analytics labels/distribution;
7. generator schema, validator, and template;
8. product/design docs, samples, and tests;
9. production bundle.

Adding a new dashboard metric should start as a pure result in `analytics.ts`, gain unit coverage, and only then be rendered in `dashboard.ts`.

# Design documents

This index records durable decisions that constrain future implementation. Add a dedicated document in this directory when a decision needs alternatives, migration detail, or staged rollout beyond the summaries below.

## DD-001 — Markdown content, plugin-data progress

**Status:** Accepted

Quiz content lives only in Markdown. Learning progress lives only in Obsidian plugin `data.json`.

**Why:** Markdown stays portable, reviewable, and editable without hidden state. Progress can change frequently without rewriting notes or creating noisy sync conflicts.

**Consequences:** Stable IDs are required to reconnect content and progress. Dashboard analytics must join catalog entries with histories at runtime.

## DD-002 — Discriminated Schema v2 with legacy read compatibility

**Status:** Accepted

All new questions declare `type` and `level`. Runtime parsing still accepts the original implicit single-choice format.

**Why:** A discriminated union makes rendering and evaluation explicit while avoiding a forced migration of existing notes.

**Consequences:** New writers must emit Schema v2. Schema changes are cross-cutting and must update both the plugin parser and standalone generator validator.

## DD-003 — Append-only attempts and first-attempt analytics

**Status:** Accepted

Retries append attempts instead of overwriting the prior answer. Mastery analytics use the first attempt per question per session.

**Why:** A learner should be free to retry for feedback without erasing evidence of initial understanding.

**Consequences:** Storage grows with usage and eventually needs a documented retention/compaction policy. Current score and learning signal are intentionally different metrics.

## DD-004 — Pure domain layers around Obsidian views

**Status:** Accepted

Parsing, evaluation, catalog extraction, analytics, and most storage behavior remain independent of the Obsidian UI runtime. `renderer.ts`, `dashboard.ts`, and `main.ts` provide the adapter layer.

**Why:** Pure modules are easier to test and reduce lifecycle/DOM coupling.

**Consequences:** DOM classes must not absorb scoring or aggregation logic. New metrics start in `analytics.ts`; new answer rules start in `evaluator.ts`.

## DD-005 — Native HTML/CSS visualization

**Status:** Accepted

Dashboard visualization uses semantic HTML and native `<progress>` elements styled with Obsidian variables.

**Why:** The current metrics do not justify a charting dependency. Native controls reduce bundle size and preserve theme/mobile accessibility.

**Consequences:** Visualizations are intentionally compact. A future visualization library requires evidence that native elements cannot express the needed relationship.

## DD-006 — Vault scan with block-level fault isolation

**Status:** Accepted

The dashboard scans Markdown files, parses each `quiz` block, and reports malformed blocks without failing the full catalog. File changes trigger a debounced rescan.

**Why:** The Vault is the canonical content store and may contain partially edited notes. One invalid block must not hide valid quizzes elsewhere.

**Consequences:** Scan cost grows with Vault size. Incremental indexing is tracked as technical debt and should be introduced only with measured need and cache invalidation tests.

## DD-007 — Standalone generator validator

**Status:** Accepted

The bundled generator skill has a plain Node.js validator rather than importing the TypeScript plugin parser.

**Why:** The skill must validate files independently of the plugin build and Obsidian environment.

**Consequences:** Protocol validation is duplicated. The engineering harness treats synchronized schema changes as a required workflow step.

## DD-008 — Review-first dashboard with note-derived topics

**Status:** Accepted

The dashboard opens on unresolved wrong answers, offers separate review/topic/library/statistics surfaces, and derives hierarchical topics from the source note's Obsidian tags. A question is unresolved only when its latest attempt across all sessions is wrong; navigation back to that question uses an in-memory coordinator.

**Why:** Review actions should be reachable before aggregate reporting, while existing note tags provide useful organization without expanding the Quiz content schema or duplicating metadata in progress storage.

**Consequences:** Topic changes refresh through the metadata cache and full catalog scan. Multiple Quiz blocks in one note share its topics. Direct question navigation is ephemeral and must degrade safely if the source Quiz or question no longer exists.

## Adding a design document

Use a descriptive filename such as `incremental-vault-index.md` and include:

1. status and owners;
2. problem and constraints;
3. decision drivers;
4. considered alternatives;
5. chosen design and dependency changes;
6. data/schema migration;
7. failure, security, accessibility, and performance analysis;
8. test and rollout plan;
9. unresolved questions;
10. links to the execution plan and resulting commits.

Update this index with a one-paragraph summary and status.

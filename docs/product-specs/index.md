# Product specifications

## Product definition

Omni Quiz turns knowledge stored in Obsidian Markdown into progressively stronger assessments. Its product promise is:

> The same knowledge can be tested at different cognitive levels, while preserving evidence of what the learner understood on the first attempt.

The primary user is a knowledge worker, developer, or student who keeps source notes in Obsidian and wants lightweight self-testing without making AI or a network service mandatory.

## Core jobs

Users must be able to:

1. Store a portable Quiz next to ordinary Markdown knowledge.
2. Answer objective questions with immediate, deterministic feedback.
3. Resume an unfinished assessment after reopening Obsidian.
4. Retry a question without erasing the original learning signal.
5. Start a new session and compare repeated study attempts.
6. Browse all valid quizzes in a Vault and identify weak cognitive levels.
7. Generate Schema v2 Quiz Markdown from grounded source material using the bundled authoring skill.

## Shipped assessment model

### Modes

| Mode | Purpose | Current behavior |
| --- | --- | --- |
| `quick` | Lightweight recall check | Usually single-choice; legacy format maps here |
| `standard` | Mixed objective assessment | Single, multiple, true/false, and fill-blank questions |

Modes describe assessment intent. They do not silently generate, truncate, or randomize questions at runtime.

### Cognitive levels

| Level | Required thinking |
| --- | --- |
| `L1` | Recall or recognize an explicit fact or term |
| `L2` | Explain, classify, compare, or apply a stated rule directly |
| `L3` | Analyze relationships, diagnose a scenario, or combine ideas |
| `L4` | Evaluate a tradeoff or transfer knowledge to a novel scenario |

Levels are authored metadata. The plugin visualizes them but does not infer or rewrite them.

### Supported question types

- `single`: exactly one option ID is correct.
- `multiple`: the submitted set must exactly equal the correct option-ID set.
- `true_false`: the answer is a JSON boolean.
- `fill_blank`: any configured accepted answer matches after trimming; case is ignored unless enabled.

## Learning evidence

- Each complete or in-progress run is a separate session.
- Every submission is appended as an attempt.
- Retrying changes the current score but not the first-attempt score.
- Global and L1–L4 dashboard accuracy use the first answer to each answered question in each session.
- Removed questions and orphaned histories do not contribute to current dashboard statistics.
- Moving or renaming a Markdown note preserves history through key migration.

## Dashboard requirements

The dashboard must:

- index all valid fenced `quiz` blocks in Markdown files;
- isolate malformed files/blocks and show actionable warnings;
- show Quiz count, question count, attempted Quiz count, completed sessions, and first-attempt accuracy;
- visualize L1–L4 accuracy and question-type distribution without a chart dependency;
- support title, Quiz ID, and path search plus mode filtering;
- show current progress, completion count, first-attempt accuracy, and recent activity per Quiz;
- open the source note from a result;
- refresh after persisted answers and debounced Vault changes;
- remain usable with keyboard, mobile touch targets, light/dark themes, and popout windows.

## Content and persistence rules

- Quiz Markdown contains content only; it never contains selected answers or progress.
- Plugin data contains progress only; it does not duplicate question text or correct answers.
- `quiz.id` and `question.id` are durable identities, not display labels.
- New generated quizzes use Schema v2 and exactly one `quiz` block per generated document.
- The generator must validate structure locally and must not invent unsupported facts to meet a requested count.

## Compatibility

- Legacy single-choice blocks without `schemaVersion`, `mode`, `type`, or `level` remain readable.
- Legacy saved results are migrated when loaded, within the limits of the old data (only the last answer can be recovered).
- The plugin remains compatible with the minimum Obsidian version declared in `manifest.json`.
- The runtime remains network-independent and mobile-compatible.

## Current non-goals

- LLM grading or automatic short-answer scoring.
- Essay, ordering, matching, drag/drop, or rich-media question types.
- Adaptive generation, spaced repetition scheduling, or wrong-answer variants.
- Cloud accounts, cross-device sync beyond the user's Vault/plugin-data sync.
- Editing Quiz content from the dashboard.
- Treating question count as difficulty.

These are not prohibited forever. Adding one requires a product decision, design document, schema impact review, and explicit acceptance criteria.

## Release acceptance

A product change is ready when:

- behavior is covered at the lowest practical pure-logic layer;
- legacy parsing and persistence remain intact or have an explicit migration;
- keyboard, touch, theme, and popout constraints are considered for UI changes;
- generator and runtime contracts agree;
- `./scripts/verify-full.sh` passes;
- user documentation and the tracked production bundle are updated.

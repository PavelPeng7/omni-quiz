---
name: omni-quiz-generator
description: Generate or update Obsidian quiz Markdown files for the current Omni Quiz schema. Use when turning notes, articles, lessons, documentation, or pasted knowledge into a quiz, test, self-check, review exercise, or `*.quiz.md` file—even for short requests such as “出题”, “生成测试题”, or “做个测验”. Supports single-choice, multiple-choice, true/false, fill-in-the-blank, and L1–L4 cognitive levels. Do not use for implementing the plugin, unrelated surveys, or general question answering.
---

# Omni Quiz document generator

Create grounded quiz Markdown that the current Omni Quiz plugin can consume directly. Prefer question quality and source fidelity over filling a requested quota.

## Output boundary

Generate:

- One normal Markdown file with exactly one `quiz` fenced block containing strict JSON.
- Schema v2 (`"schemaVersion": 2`) for all new quizzes.
- `quick` mode for a short, lightweight single-choice review when the user explicitly asks for it.
- `standard` mode by default, using any suitable mix of `single`, `multiple`, `true_false`, and `fill_blank` questions.
- A cognitive `level` of `L1`, `L2`, `L3`, or `L4` on every question.

Do not add unsupported short-answer or essay types, AI/API fields, Anki or spaced-repetition fields, dashboard data, or answer-history fields. Do not modify source notes. User progress belongs in the plugin's `data.json`, never in quiz Markdown.

## Inputs and defaults

1. Use the current note, explicitly named files, or pasted text as the source.
2. If a source file is given without a destination, write beside it as `<source-stem>.quiz.md`.
3. For pasted content, use a clear kebab-case topic filename ending in `.quiz.md` in the current workspace.
4. Default to 10 questions unless the user specifies a count.
5. In `standard` mode, choose question types for the content rather than enforcing a fixed distribution. Avoid near-duplicate questions added only to create variety.
6. For `single` and `multiple`, default to 4 options; use 2–6 when that better fits the source.
7. Use the source language throughout.

Inspect an existing destination before writing. Update it only when regeneration or editing is requested; otherwise avoid overwriting it.

## Workflow

### 1. Bound the source

Read the material needed for the quiz and identify its concepts, relationships, procedures, tradeoffs, and supported misconceptions. If it cannot support the requested number of distinct questions, generate fewer and report the limitation. Never invent facts to reach a count or difficulty target.

### 2. Design the assessment

Assign levels by the thinking actually required:

- `L1`: recall or recognize an explicit fact or term.
- `L2`: explain, classify, compare, or apply a stated rule directly.
- `L3`: analyze relationships, diagnose a scenario, or combine multiple source ideas.
- `L4`: evaluate a tradeoff or transfer the material to a novel scenario with source-grounded criteria.

Use higher levels only when the source supports them. A quiz may contain only a subset of levels.

Choose each type deliberately:

- `single`: exactly one defensible option is correct.
- `multiple`: two or more options are independently correct and the correct set is unambiguous. Do not use it merely to disguise a single-choice question.
- `true_false`: the statement is precise and not a trivial wording trick.
- `fill_blank`: the missing term is central and accepted variants can be enumerated. Avoid long free-form responses.

For option questions, make distractors plausible but clearly wrong from the source. Avoid joke options, obvious length clues, “all/none of the above”, double negatives, and inter-question dependencies. Explain the correct answer and, when useful, the tempting misconception. For fill blanks, include only genuinely equivalent accepted answers.

### 3. Preserve identity

- New quiz IDs use descriptive kebab-case ending in `-001`, such as `game-loop-quiz-001`.
- New question IDs use `q001`, `q002`, ... in document order.
- Option IDs use `A`, `B`, `C`, ... in display order.
- IDs must be unique in their scope.
- When updating, preserve `quiz.id` and IDs of semantically unchanged questions. Assign a never-recycled ID to a genuinely new question.

The plugin keys progress by Markdown path plus `quiz.id`, then maps attempts by `question.id`; unnecessary ID changes disconnect learning history.

### 4. Write Schema v2

Read [references/quiz-schema.md](references/quiz-schema.md) before creating or updating output. Reuse [assets/quiz-template.md](assets/quiz-template.md) as the structural template.

The fenced block must be strict JSON accepted by `JSON.parse()`:

- Use double quotes for keys and strings; no comments, trailing commas, YAML, or nested Markdown fences.
- Escape quotes, backslashes, and control characters.
- `single.answer` is one option ID.
- `multiple.answer` is an array of unique option IDs.
- `true_false.answer` is a JSON boolean, not a quoted string.
- `fill_blank.answers` is a non-empty string array; `caseSensitive` is a boolean and defaults to `false` when omitted.
- Set top-level `difficulty.min` and `difficulty.max` to the lowest and highest levels actually present, or omit `difficulty` when it adds no value.
- Never write state fields such as `selectedAnswer`, `correct`, `attempts`, `answeredAt`, or `updatedAt`.

### 5. Validate and review

Run the bundled validator against every generated quiz, resolving the script path relative to this skill directory:

```powershell
node scripts/validate-quiz.mjs "path/to/output.quiz.md"
```

Fix every error and rerun until it reports success. Then manually verify grounding, answer uniqueness/completeness, level accuracy, concise explanations, requested count, and output path. Structural validation does not prove semantic quality.

## Completion response

Report the clickable absolute output path, question count, quiz ID, mode, included question types and level range, and that validation passed. Mention any source limitation that forced fewer questions or lower confidence. Do not paste the whole document when a file was requested unless the user asks for a preview.

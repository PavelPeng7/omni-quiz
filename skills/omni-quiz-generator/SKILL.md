---
name: omni-quiz-generator
description: Generate or update Obsidian quiz Markdown files that conform to the Omni Quiz `quiz` JSON fenced-block schema. Use this skill whenever the user asks to turn notes, articles, lessons, documentation, or pasted knowledge into a quiz, test, self-check, review exercise, or `*.quiz.md` file for Omni Quiz—even if they only say “出题”, “生成测试题”, “做个测验”, or “根据当前笔记检查学习效果”. Do not use it for implementing the plugin itself, unrelated surveys, or general question answering.
compatibility: Requires local file read/write access and Node.js for deterministic validation. No network or authentication is needed.
---

# Omni Quiz document generator

Create a focused single-choice quiz from user-provided source material. The generated Markdown is consumed directly by the Omni Quiz Obsidian plugin, so syntactic stability matters as much as question quality.

## Scope

Generate only:

- A normal Markdown file.
- One `quiz` fenced block containing strict JSON.
- Single-choice questions with one unambiguous correct option.

Do not add multiple-choice, true/false, fill-in-the-blank, short-answer, AI API, Anki, spaced repetition, dashboard, or answer-history fields. Do not modify the source note. User progress belongs to the plugin's `data.json`, never the generated Markdown.

## Inputs and defaults

1. Use the current note, explicitly named files, or pasted text as the knowledge source.
2. If the user gives a source file but no destination, write beside it as `<source-stem>.quiz.md`.
3. If the user provides only pasted content and asks for a file, use a clear kebab-case topic filename ending in `.quiz.md` in the current workspace.
4. Default to 10 questions unless the user specifies a count.
5. Default to 4 options per question. Use 2–6 only when the content genuinely supports that choice.
6. Use the source language for the title, questions, options, explanations, and surrounding Markdown.

When the requested destination could overwrite an existing file, inspect it first. Update it only if the user clearly requested regeneration or editing; otherwise choose a non-conflicting path or ask for direction.

## Workflow

### 1. Read and bound the source

Read all source material needed for the requested quiz. Identify the central concepts, relationships, procedures, tradeoffs, and common misconceptions. If the material cannot support the requested number of distinct questions, generate fewer high-quality questions and state that constraint instead of inventing facts.

### 2. Design grounded questions

For each question:

- Test information that is supported by the source.
- Prefer understanding and application over trivial wording recall.
- Ensure exactly one option is defensibly correct from the source.
- Make distractors plausible but clearly wrong; avoid joke options and obvious length clues.
- Avoid “all of the above”, “none of the above”, double negatives, and trick wording.
- Keep each question independent enough to answer without reading another question.
- Explain why the correct answer is correct. When useful, briefly distinguish it from the most tempting distractor.

Do not fabricate missing facts. If a useful inference is not explicitly stated, phrase the question so the inference follows directly from the provided material.

### 3. Assign stable IDs

IDs preserve user progress when wording changes:

- For a new quiz, use a descriptive kebab-case ID ending in `-001`, such as `game-loop-quiz-001`.
- Use question IDs `q001`, `q002`, ... in document order.
- Use option IDs `A`, `B`, `C`, ... in display order.
- Within one quiz, every question ID must be unique and every option ID within a question must be unique.
- When updating an existing quiz, preserve `quiz.id` and existing `question.id` values for semantically unchanged questions, even if wording or explanations improve.
- Give a new question a new ID. Never recycle the ID of a removed question for a different concept.

### 4. Write the exact document shape

Read [references/quiz-schema.md](references/quiz-schema.md) before creating or updating an output. Reuse [assets/quiz-template.md](assets/quiz-template.md) as the structural template.

The fenced block must contain strict JSON accepted by `JSON.parse()`:

- Use double quotes for all keys and strings.
- Do not use comments, trailing commas, bare keys, YAML, or Markdown fences inside JSON strings.
- Escape embedded quotes, backslashes, and control characters correctly.
- Keep `answer` equal to one option `id`, not the option text.
- Omit `explanation` only when the source genuinely provides no useful explanation.
- Do not add answer-state fields such as `selectedAnswer`, `correct`, `attempts`, or `updatedAt`.

### 5. Validate before finishing

Run the bundled validator against every generated quiz:

```powershell
node scripts/validate-quiz.mjs "path/to/output.quiz.md"
```

Resolve the script path relative to this Skill directory when invoked from another working directory. Fix every reported error and rerun until it prints a success result. Validation checks structure, IDs, answers, question count, frontmatter type, and the exact number of `quiz` blocks; it does not replace a semantic review.

Then manually verify:

- Every answer is supported by the source.
- No question has multiple defensible answers.
- Distractors are plausible and distinct.
- Explanations are concise and do not introduce unsupported claims.
- The requested question count and output path are correct.

## Completion response

Report:

- The created or updated file as a clickable absolute path.
- The number of questions.
- The quiz ID.
- That structural validation passed.
- Any source limitation that forced fewer questions or lower confidence.

Do not paste the entire generated document into chat when a file was requested unless the user also asks to preview it.

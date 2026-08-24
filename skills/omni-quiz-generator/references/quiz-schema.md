# Omni Quiz Schema v2 protocol

## Document shape

Use one Markdown document with optional surrounding Markdown and exactly one `quiz` fenced block. Recommended frontmatter:

```yaml
---
type: quiz
title: 测试标题
---
```

When frontmatter exists, `type` must be `quiz`. Keep its title aligned with the JSON title.

## Data model

```ts
type QuizMode = "quick" | "standard";
type CognitiveLevel = "L1" | "L2" | "L3" | "L4";

interface QuizData {
  schemaVersion: 2;
  id: string;
  title: string;
  mode: QuizMode;
  difficulty?: { min: CognitiveLevel; max: CognitiveLevel };
  questions: QuizQuestion[];
}

interface BaseQuestion {
  id: string;
  type: "single" | "multiple" | "true_false" | "fill_blank";
  level: CognitiveLevel;
  question: string;
  explanation?: string;
}

interface SingleQuestion extends BaseQuestion {
  type: "single";
  options: QuizOption[];
  answer: string;
}

interface MultipleQuestion extends BaseQuestion {
  type: "multiple";
  options: QuizOption[];
  answer: string[];
}

interface TrueFalseQuestion extends BaseQuestion {
  type: "true_false";
  answer: boolean;
}

interface FillBlankQuestion extends BaseQuestion {
  type: "fill_blank";
  answers: string[];
  caseSensitive?: boolean;
}

interface QuizOption {
  id: string;
  text: string;
}
```

## Structural invariants

- All required string values are non-empty.
- `questions` contains at least one item and question IDs are unique.
- Every question declares `type` and `level` in Schema v2.
- `single` and `multiple` have at least two options with unique IDs.
- `single.answer` matches one option ID.
- `multiple.answer` is non-empty, contains no duplicate IDs, and every ID exists in `options`. For generated content, prefer at least two correct answers.
- `true_false.answer` is the JSON literal `true` or `false`.
- `fill_blank.answers` contains at least one non-empty accepted answer. Matching trims surrounding whitespace and ignores case unless `caseSensitive` is `true`.
- `difficulty`, when present, uses L1–L4 and `min` cannot be higher than `max`. Generated quizzes should make it match the actual level range.
- `explanation`, when present, is a string.

## Compatibility and persistence

The plugin can still read legacy single-choice blocks without `schemaVersion`, `mode`, `type`, or `level`, defaulting them to Schema 1, `quick`, `single`, and `L1`. Do not generate legacy format; preserve it only when a user explicitly requires no migration.

Progress identity is:

```text
<Markdown source path>::<quiz.id> -> session -> question.id
```

Preserve the quiz ID and semantically stable question IDs during edits. Never put persisted attempts or correctness state in the Markdown.

## Complete mixed example

See [../assets/quiz-template.md](../assets/quiz-template.md) for a ready-to-adapt Schema v2 document containing all four supported question types.

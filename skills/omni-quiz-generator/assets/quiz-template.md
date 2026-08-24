---
type: quiz
title: "{{QUIZ_TITLE}}"
---

# {{QUIZ_TITLE}}

```quiz
{
  "schemaVersion": 2,
  "id": "{{quiz-id-001}}",
  "title": "{{QUIZ_TITLE}}",
  "mode": "standard",
  "difficulty": {
    "min": "L1",
    "max": "L3"
  },
  "questions": [
    {
      "id": "q001",
      "type": "single",
      "level": "L1",
      "question": "{{SINGLE_QUESTION}}",
      "options": [
        { "id": "A", "text": "{{OPTION_A}}" },
        { "id": "B", "text": "{{OPTION_B}}" },
        { "id": "C", "text": "{{OPTION_C}}" },
        { "id": "D", "text": "{{OPTION_D}}" }
      ],
      "answer": "{{ANSWER_ID}}",
      "explanation": "{{EXPLANATION}}"
    },
    {
      "id": "q002",
      "type": "multiple",
      "level": "L2",
      "question": "{{MULTIPLE_QUESTION}}",
      "options": [
        { "id": "A", "text": "{{OPTION_A}}" },
        { "id": "B", "text": "{{OPTION_B}}" },
        { "id": "C", "text": "{{OPTION_C}}" },
        { "id": "D", "text": "{{OPTION_D}}" }
      ],
      "answer": ["{{ANSWER_ID_1}}", "{{ANSWER_ID_2}}"],
      "explanation": "{{EXPLANATION}}"
    },
    {
      "id": "q003",
      "type": "true_false",
      "level": "L2",
      "question": "{{TRUE_FALSE_STATEMENT}}",
      "answer": false,
      "explanation": "{{EXPLANATION}}"
    },
    {
      "id": "q004",
      "type": "fill_blank",
      "level": "L3",
      "question": "{{FILL_BLANK_QUESTION_WITH_BLANK}}",
      "answers": ["{{ACCEPTED_ANSWER}}", "{{ACCEPTED_VARIANT}}"],
      "caseSensitive": false,
      "explanation": "{{EXPLANATION}}"
    }
  ]
}
```

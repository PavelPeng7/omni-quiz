# Omni Quiz Markdown protocol

## Document structure

Use one Markdown document with optional explanatory Markdown and exactly one `quiz` fenced code block. Recommended frontmatter:

```yaml
---
type: quiz
title: 测试标题
---
```

The frontmatter `title` should match the JSON `title`. The validator requires `type: quiz` when frontmatter exists.

## JSON schema

```ts
interface QuizData {
    id: string;
    title: string;
    questions: QuizQuestion[];
}

interface QuizQuestion {
    id: string;
    question: string;
    options: QuizOption[];
    answer: string;
    explanation?: string;
}

interface QuizOption {
    id: string;
    text: string;
}
```

Validation rules:

- `id`, `title`, `question`, option `id`, option `text`, and `answer` are non-empty strings.
- `questions` contains at least one question.
- Question IDs are unique within the quiz.
- Every question contains at least two options.
- Option IDs are unique within their question.
- `answer` exactly matches one option ID.
- `explanation`, when present, is a string.
- Unknown fields are rejected so accidental progress fields and unsupported future question types cannot enter MVP files.

## Persistence identity

The plugin stores progress under:

```text
<Markdown source path>::<quiz.id>
```

Each answer is matched by `question.id`. Preserve both IDs when editing equivalent quiz content. Changing the file path or quiz ID intentionally creates a separate progress namespace.

## Complete example

````markdown
---
type: quiz
title: 游戏循环测试
---

# 游戏循环测试

```quiz
{
  "id": "game-loop-quiz-001",
  "title": "游戏循环测试",
  "questions": [
    {
      "id": "q001",
      "question": "典型游戏循环持续执行哪组操作？",
      "options": [
        { "id": "A", "text": "输入、更新、渲染" },
        { "id": "B", "text": "保存、上传、下载" },
        { "id": "C", "text": "编译、链接、打包" },
        { "id": "D", "text": "登录、认证、退出" }
      ],
      "answer": "A",
      "explanation": "典型游戏循环反复处理输入、更新游戏状态并渲染画面。"
    }
  ]
}
```
````

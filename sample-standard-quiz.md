---
type: quiz
title: 状态模式标准测验
---

# 状态模式标准测验

```quiz
{
  "schemaVersion": 2,
  "id": "state-pattern-standard-001",
  "title": "状态模式标准测验",
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
      "question": "状态模式主要解决什么问题？",
      "options": [
        { "id": "A", "text": "复杂状态分支导致的行为维护问题" },
        { "id": "B", "text": "纹理尺寸过大" },
        { "id": "C", "text": "网络请求延迟" }
      ],
      "answer": "A",
      "explanation": "状态模式把不同状态下的行为分离到独立对象中。"
    },
    {
      "id": "q002",
      "type": "multiple",
      "level": "L2",
      "question": "以下哪些特征通常说明状态模式值得考虑？",
      "options": [
        { "id": "A", "text": "对象行为随内部状态改变" },
        { "id": "B", "text": "存在大量状态判断分支" },
        { "id": "C", "text": "只需要读取一个配置文件" },
        { "id": "D", "text": "状态转换规则需要集中管理" }
      ],
      "answer": ["A", "B", "D"],
      "explanation": "行为变化、复杂条件分支和明确转换规则都是常见信号。"
    },
    {
      "id": "q003",
      "type": "true_false",
      "level": "L2",
      "question": "状态模式与所有形式的有限状态机完全等价。",
      "answer": false,
      "explanation": "二者相关但关注点不同，不能简单视为完全等价。"
    },
    {
      "id": "q004",
      "type": "fill_blank",
      "level": "L3",
      "question": "状态模式将对象在不同状态下的行为封装到独立的 _____ 对象中。",
      "answers": ["状态", "State"],
      "caseSensitive": false,
      "explanation": "每个状态对象负责对应状态下的行为。"
    }
  ]
}
```

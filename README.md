# Omni Quiz

Omni Quiz 把 Markdown 中的 `quiz` JSON 代码块渲染成可交互测验。它支持快速单选和混合题型标准测验，并在本地记录每次完整测验及每道题的全部尝试。插件不会修改 Quiz Markdown，也不依赖 AI 或网络请求。

## 功能

- 单选、多选、判断和填空题
- `L1`–`L4` 认知等级
- 即时判定、答案解释和重新作答
- 本次得分与首次正确率
- 独立测验会话和完整尝试历史
- 自动恢复旧版单选题和答题记录
- 主页面板浏览整个知识库中的测试题
- L1–L4 首次正确率、题型构成和测验进度可视化

## 测试面板

点击左侧 Ribbon 的柱状图图标，或从命令面板运行“打开测试面板”。面板会自动索引 Vault 中所有 Markdown `quiz` 代码块，并提供：

- 测试题总数、题目总数、已测试数量和完成次数
- 全局及 L1–L4 首次正确率
- 单选、多选、判断和填空题分布
- 按标题、Quiz ID 或文件路径搜索
- Quick / Standard 模式筛选
- 当前进度、最近活动和一键打开原笔记
- 无效 Quiz block 与重复 Quiz ID 提示

面板统计只关联知识库中仍然存在的题目。“首次正确率”按每次测验会话中每道题的第一次回答计算，重新作答不会覆盖薄弱点数据。

## 安装和验证

当前目录可直接作为 Vault 插件目录：

```text
Vault/.obsidian/plugins/omni-quiz/
```

```bash
npm install
npm test
npm run build
```

Obsidian 实际加载 `main.js`、`manifest.json` 和 `styles.css`。构建后重新加载 Obsidian 窗口即可载入新代码。

## Schema v2 示例

````markdown
```quiz
{
  "schemaVersion": 2,
  "id": "state-pattern-001",
  "title": "状态模式测试",
  "mode": "standard",
  "difficulty": { "min": "L1", "max": "L3" },
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "level": "L1",
      "question": "状态模式主要解决什么问题？",
      "options": [
        { "id": "A", "text": "复杂状态分支" },
        { "id": "B", "text": "资源加载" }
      ],
      "answer": "A"
    },
    {
      "id": "q2",
      "type": "multiple",
      "level": "L2",
      "question": "哪些情况适合考虑状态模式？",
      "options": [
        { "id": "A", "text": "行为随状态改变" },
        { "id": "B", "text": "存在复杂条件分支" },
        { "id": "C", "text": "读取静态配置" }
      ],
      "answer": ["A", "B"]
    },
    {
      "id": "q3",
      "type": "true_false",
      "level": "L2",
      "question": "状态模式与所有有限状态机完全等价。",
      "answer": false
    },
    {
      "id": "q4",
      "type": "fill_blank",
      "level": "L3",
      "question": "将行为封装到独立的 _____ 对象中。",
      "answers": ["状态", "State"],
      "caseSensitive": false
    }
  ]
}
```
````

完整示例见 `sample-standard-quiz.md`。原有未声明 `schemaVersion`、`type` 和 `level` 的单选题仍然有效，默认按 `quick`、`single`、`L1` 解析。

## 字段规则

| 题型 | 必需答案字段 | 说明 |
| --- | --- | --- |
| `single` | `answer: string` | 答案必须对应一个选项 ID |
| `multiple` | `answer: string[]` | 必须选择完全相同的一组选项，顺序不影响判分 |
| `true_false` | `answer: boolean` | 使用 JSON 布尔值 `true` 或 `false` |
| `fill_blank` | `answers: string[]` | 任一答案匹配即正确；默认忽略大小写和首尾空格 |

## 学习记录

- Markdown 是题目内容的唯一来源。
- 插件 `data.json` 是学习进度的唯一来源。
- 记录以 `文件路径::quiz.id`、测验会话和 `question.id` 组织。
- 重新作答会追加一次尝试，不会覆盖首次错误。
- “首次正确率”按每题在当前会话中的第一次回答计算。
- 点击“完成测验”后会锁定本次会话；“开始新测验”会创建独立记录。
- 旧版数据会自动迁移，但旧格式只保存最后一次答案，因此无法还原升级前每次尝试的具体内容。

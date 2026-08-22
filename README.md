# Omni Quiz

Omni Quiz 是一个最小化的 Obsidian 单选题插件。它把 Markdown 中的 `quiz` JSON 代码块渲染成可交互测试，并用 Obsidian 的插件数据保存答题状态。插件不会修改 Quiz Markdown，也不包含 AI、网络请求、题库或统计面板。

## 安装方法

当前目录已经是一个 Vault 插件目录：

```text
Vault/.obsidian/plugins/omni-quiz/
```

开发构建：

```bash
npm install
npm run build
```

Obsidian 实际加载只需要下面三个文件：

```text
main.js
manifest.json
styles.css
```

然后在 Obsidian 的“第三方插件”中重新加载并启用 **Omni Quiz**。若插件已启用，构建后可重新加载 Obsidian 窗口以载入新代码。

## Markdown 示例

````markdown
```quiz
{
  "id": "game-loop-001",
  "title": "游戏循环测试",
  "questions": [
    {
      "id": "q001",
      "question": "游戏循环通常会持续执行哪组操作？",
      "options": [
        { "id": "A", "text": "输入、更新、渲染" },
        { "id": "B", "text": "保存、上传、下载" }
      ],
      "answer": "A",
      "explanation": "典型游戏循环不断执行输入处理、状态更新与画面渲染。"
    }
  ]
}
```
````

完整的 10 题文件见 `sample-quiz.md`。

## 使用方式

1. 让 AI 按上述 JSON 协议生成 Quiz Markdown。
2. 在 Obsidian 中打开 Markdown，并切换到阅读视图或实时预览。
3. 选择一个答案，然后点击“提交答案”。
4. 查看正确/错误、正确答案和解释。
5. 点击“重新作答”可修改答案；答题次数会累计。
6. 再次打开笔记时，插件会按照 `文件路径::quiz.id` 和 `question.id` 恢复记录。

## 数据规则

- Markdown 是题目内容的唯一来源。
- 插件 `data.json` 是用户进度的唯一来源。
- 保存记录使用 `quiz.id + question.id` 作为稳定标识；修改题干但保留 ID 时，历史记录会继续生效。
- 从 Markdown 删除的题目不会参与统计，其旧记录在 MVP 中不会自动清理。

## 验证

```bash
npm test
npm run build
```

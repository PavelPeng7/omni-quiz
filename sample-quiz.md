---
type: quiz
title: 游戏编程模式测试
---

# 游戏编程模式测试

```quiz
{
  "id": "game-programming-patterns-001",
  "title": "游戏编程模式测试",
  "questions": [
    {
      "id": "q001",
      "question": "对象池模式最适合解决下面哪个问题？",
      "options": [
        { "id": "A", "text": "保存游戏配置" },
        { "id": "B", "text": "频繁创建和销毁大量短生命周期对象" },
        { "id": "C", "text": "管理网络连接" },
        { "id": "D", "text": "处理角色寻路" }
      ],
      "answer": "B",
      "explanation": "对象池通过复用已经创建的对象，减少频繁实例化和销毁产生的性能开销。"
    },
    {
      "id": "q002",
      "question": "游戏循环通常会持续执行哪组操作？",
      "options": [
        { "id": "A", "text": "输入、更新、渲染" },
        { "id": "B", "text": "保存、上传、下载" },
        { "id": "C", "text": "编译、链接、打包" },
        { "id": "D", "text": "登录、认证、退出" }
      ],
      "answer": "A",
      "explanation": "典型游戏循环不断执行输入处理、游戏状态更新以及画面渲染。"
    },
    {
      "id": "q003",
      "question": "状态模式主要用于什么场景？",
      "options": [
        { "id": "A", "text": "让对象在内部状态变化时改变行为" },
        { "id": "B", "text": "压缩纹理" },
        { "id": "C", "text": "排序文件" },
        { "id": "D", "text": "生成随机数" }
      ],
      "answer": "A",
      "explanation": "状态模式把不同状态的行为分离，避免大量条件分支。"
    },
    {
      "id": "q004",
      "question": "观察者模式最适合实现哪种关系？",
      "options": [
        { "id": "A", "text": "一对多事件通知" },
        { "id": "B", "text": "网格寻路" },
        { "id": "C", "text": "内存压缩" },
        { "id": "D", "text": "资源打包" }
      ],
      "answer": "A",
      "explanation": "主题状态变化时可以通知多个订阅者。"
    },
    {
      "id": "q005",
      "question": "命令模式会把什么封装成对象？",
      "options": [
        { "id": "A", "text": "一次操作或请求" },
        { "id": "B", "text": "一张纹理" },
        { "id": "C", "text": "一个着色器 Pass" },
        { "id": "D", "text": "一个场景文件" }
      ],
      "answer": "A",
      "explanation": "命令对象可被排队、撤销、记录或重放。"
    },
    {
      "id": "q006",
      "question": "组件模式的主要价值是什么？",
      "options": [
        { "id": "A", "text": "通过组合拆分对象能力" },
        { "id": "B", "text": "提高网络带宽" },
        { "id": "C", "text": "减少磁盘容量" },
        { "id": "D", "text": "替代所有继承" }
      ],
      "answer": "A",
      "explanation": "组件让功能保持聚焦，并通过组合构成游戏对象。"
    },
    {
      "id": "q007",
      "question": "脏标记模式用于避免什么？",
      "options": [
        { "id": "A", "text": "没有变化时重复计算" },
        { "id": "B", "text": "玩家输入" },
        { "id": "C", "text": "加载音频" },
        { "id": "D", "text": "网络认证" }
      ],
      "answer": "A",
      "explanation": "只有依赖数据发生变化时，才重新计算缓存结果。"
    },
    {
      "id": "q008",
      "question": "空间分区最常用于优化哪类查询？",
      "options": [
        { "id": "A", "text": "附近对象查询" },
        { "id": "B", "text": "字符串格式化" },
        { "id": "C", "text": "存档序列化" },
        { "id": "D", "text": "UI 本地化" }
      ],
      "answer": "A",
      "explanation": "空间分区减少了邻近检测需要比较的对象数量。"
    },
    {
      "id": "q009",
      "question": "服务定位器的主要风险是什么？",
      "options": [
        { "id": "A", "text": "依赖关系变得隐式" },
        { "id": "B", "text": "纹理一定变模糊" },
        { "id": "C", "text": "帧率固定为 30" },
        { "id": "D", "text": "无法保存 JSON" }
      ],
      "answer": "A",
      "explanation": "全局查找服务很方便，但会隐藏调用方真正依赖的对象。"
    },
    {
      "id": "q010",
      "question": "事件队列相对直接调用的主要优势是什么？",
      "options": [
        { "id": "A", "text": "发送与处理可以在时间上解耦" },
        { "id": "B", "text": "自动生成美术资源" },
        { "id": "C", "text": "消除所有延迟" },
        { "id": "D", "text": "不再需要内存" }
      ],
      "answer": "A",
      "explanation": "消息可以先入队，再由接收方按合适的时机处理。"
    }
  ]
}
```

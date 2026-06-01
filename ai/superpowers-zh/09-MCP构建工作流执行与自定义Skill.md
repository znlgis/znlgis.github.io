---
layout: default
title: 第九章：MCP 构建、工作流执行与自定义 Skill
---

# 第九章：MCP 构建、工作流执行与自定义 Skill

## 9.1 扩展类 Skills 的定位

除了通用工程流程和中文团队规范，superpowers-zh 还提供三类扩展能力：

- `mcp-builder`：指导构建生产级 Model Context Protocol Server。
- `workflow-runner`：在 AI 工具内执行 agency-orchestrator YAML 多角色工作流。
- `writing-skills`：系统化编写和验证新的 Skill。

这三者让 superpowers-zh 不只是在当前项目中规范 AI 行为，还能扩展 AI 的外部能力、协作角色和方法论库。

## 9.2 MCP 是什么

MCP（Model Context Protocol）是一种让 AI 助手连接外部工具、资源和提示模板的协议。`mcp-builder` 将 MCP 原语分成三类：

| 原语 | 用途 | 示例 |
|------|------|------|
| Tools | AI 主动调用的有副作用函数 | 搜索、创建 Issue、删除文件 |
| Resources | AI 只读访问的数据源 | `users://{id}/profile` |
| Prompts | 预定义交互模板 | 代码审查模板、需求澄清模板 |

选择原则：执行操作用 Tool，读取数据用 Resource，引导交互用 Prompt。

## 9.3 MCP Server 项目结构

TypeScript 项目推荐结构：

```text
my-mcp-server/
├── src/
│   ├── index.ts
│   ├── tools/
│   ├── resources/
│   └── lib/
├── tests/
├── package.json
└── tsconfig.json
```

Python 项目推荐结构：

```text
my-mcp-server/
├── src/my_mcp_server/
│   ├── server.py
│   ├── tools/
│   └── lib/
├── tests/
└── pyproject.toml
```

关键思想是把 MCP 注册和业务逻辑分离。Tool handler 应尽量调用可单元测试的纯函数或服务封装，而不是把所有逻辑写在注册代码里。

## 9.4 Tool 设计原则

### 命名

- 使用 `snake_case`。
- 动词开头，例如 `search_users`、`create_issue`、`delete_file`。
- 名称自解释，因为 AI 会根据名称选择工具。

### 参数

- 每个参数有类型和描述。
- 可选参数提供合理默认值。
- 用枚举代替布尔开关，减少歧义。
- 限制范围，例如 `limit` 最小 1 最大 100。

### 描述

描述应说明用途、返回内容和限制：

```text
根据姓名或邮箱搜索用户。返回 ID、姓名、邮箱列表。模糊匹配，最多 50 条。
```

AI 是否正确调用工具，很大程度取决于名称和描述是否清晰。

## 9.5 MCP 错误处理与安全

`mcp-builder` 强调：永远不要让服务器因外部调用失败而崩溃。错误处理应：

1. 用 try/catch 包裹外部调用。
2. 返回可操作错误信息。
3. 设置 `isError: true`。
4. 区分参数错误、权限不足、资源不存在、服务不可用。

安全方面重点关注：

- SQL 查询使用参数化，禁止拼接用户输入。
- 文件路径防止 `../` 路径遍历。
- 命令执行优先用 `execFile`，避免 shell 注入。
- API Key 通过环境变量传入，不写入源码。
- 日志和返回值做敏感信息脱敏。
- 危险操作增加确认参数，例如 `confirm: true`。

## 9.6 MCP 测试策略

推荐三层测试：

### 单元测试

测试业务函数，不依赖 MCP Transport。

### 集成测试

使用 MCP SDK Client 调用 Server，验证工具注册、参数、返回格式和错误路径。

### MCP Inspector

使用 Inspector 交互式查看工具、资源和调用结果：

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

测试至少覆盖正常路径、异常路径、边界值和外部服务失败。

## 9.7 MCP 调试注意事项

MCP 使用 stdio 通信时，不能随意 `console.log`，否则可能破坏协议流。调试应输出到 stderr 或使用 SDK 日志机制。

常见问题：

| 症状 | 可能原因 | 处理方式 |
|------|----------|----------|
| 启动无响应 | transport 未连接 | 检查 `server.connect()` |
| Tool 不出现 | 注册顺序错误 | 先注册再 connect |
| AI 不调用 Tool | 名称和描述不清 | 改善描述和参数说明 |
| 参数总错 | Schema 模糊 | 增加 `.describe()` 和枚举 |
| 调用超时 | 外部服务慢 | 加超时、缓存和错误信息 |

## 9.8 workflow-runner 的作用

`workflow-runner` 让 AI 工具在当前会话中运行 agency-orchestrator 风格 YAML 工作流。它适用于：

- 用户提供 `.yaml` 工作流文件。
- 用户要求多个角色协作完成任务。
- 项目安装了 `agency-agents-zh` 角色库。

它的特点是不需要额外 API Key，当前会话中的 LLM 依次扮演工作流中的角色。

## 9.9 YAML 工作流结构

典型字段：

{% raw %}
```yaml
name: "工作流名称"
agents_dir: "agency-agents-zh"
inputs:
  - name: topic
    required: true
steps:
  - id: analyze
    role: "product/product-manager"
    task: "分析 {{topic}} 的用户价值"
    output: product_analysis
  - id: architecture
    role: "engineering/architect"
    task: "基于 {{product_analysis}} 给出架构建议"
    depends_on: [analyze]
```
{% endraw %}

`workflow-runner` 会解析 inputs、steps、depends_on，做拓扑排序，逐层执行。没有依赖关系的同层步骤可并行执行。

## 9.10 工作流执行产物

执行完成后，结果保存到：

```text
.ao-output/<工作流名称>-<日期>/
├── steps/
│   ├── 1-analyze.md
│   └── 2-architecture.md
├── summary.md
└── metadata.json
```

这让多角色协作结果可追踪、可复盘，而不是只存在聊天记录中。

## 9.11 writing-skills：如何编写新 Skill

`writing-skills` 的核心观点是：编写 Skill 就是把 TDD 应用于流程文档。

流程如下：

1. 找到 AI 当前会犯错的真实场景。
2. 编写压力测试或示例任务，观察没有 Skill 时的失败行为。
3. 编写 Skill 文档，明确触发条件、流程、红线和检查清单。
4. 再次运行场景，观察 AI 是否遵守流程。
5. 如果 AI 仍绕过规则，补充更明确的约束。
6. 重构 Skill 文档，使其更简洁、可执行。

也就是说，不要为了「看起来有用」而写 Skill。应先证明它解决了一个可复现的 AI 行为问题。

## 9.12 新 Skill 的内容结构

推荐结构：

```markdown
---
name: your-skill-name
description: 何时使用这个 Skill
---

# 标题

## 概述

说明解决什么问题。

## 何时使用

列出触发场景和不适用场景。

## 流程

按步骤描述必须执行的动作。

## 红线

列出绝不允许的行为。

## 示例

给出正反例。

## 检查清单

完成前逐项确认。
```

好的 Skill 应该教 AI「怎么干活」，而不是写某个框架教程。

## 9.13 本章小结

`mcp-builder` 扩展 AI 能调用的外部能力，`workflow-runner` 扩展 AI 的多角色协作方式，`writing-skills` 扩展方法论本身。掌握这三者后，你不仅能使用 superpowers-zh，还能围绕团队实际问题持续扩展它。

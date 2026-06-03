---
layout: default
title: 第六章：Agent 与子代理自定义
---

# 第六章：Agent 与子代理自定义

Agent（智能体）是 OpenCode 的灵魂。通过为不同任务配置专门的 Agent——不同的系统提示词、模型、权限、推理强度——你既能提升质量，又能精准控制成本。本章讲解内置 Agent、如何自定义 Agent，以及与省 Token 直接相关的 `model`、`steps`、`permission` 等选项。

---

## 6.1 两类 Agent：主智能体与子智能体

- **主智能体（primary）**：你直接对话的主助手，用 **Tab**（或 `switch_agent` 键位）循环切换。
- **子智能体（subagent）**：主智能体为特定任务调用的专用助手，也可用 **`@` 提及**手动调用，例如 `@general 帮我搜索这个函数`。

子智能体的关键价值：**它们在独立的子会话里工作，不污染主对话的上下文**——这对控制 Token 极其重要（第九章详述）。

---

## 6.2 内置 Agent

### 主智能体

- **build**（默认）：全工具开放，用于实际开发。
- **plan**：受限的规划/分析智能体。默认对「文件编辑」和「bash」都设为 `ask`，适合让模型分析代码、给方案，而不真正改动代码。

### 子智能体

- **general**：通用型，研究复杂问题、执行多步任务，除 todo 外有完整工具权限，可并行跑多份工作。
- **explore**：快速、**只读**，用于探索代码库——按模式找文件、搜关键字、回答「这段代码在哪/怎么写的」。
- **scout**：**只读**，用于外部文档与依赖研究——把依赖仓库克隆进 OpenCode 的托管缓存、查阅库源码、与上游实现交叉比对，而不改动你的工作区。

此外还有几个隐藏的系统 Agent（`compaction` 压缩、`title` 生成标题、`summary` 摘要），自动运行、不可在 UI 选择。

> 善用 explore/scout 这两个**只读子代理**做检索与调研，可以把大量「读」的消耗隔离在子会话里，主会话只接收精炼结论，显著省 Token。

---

## 6.3 自定义 Agent 的两种方式

### 方式一：JSON 配置

在 `opencode.json` 的 `agent` 下定义或覆盖：

```jsonc title="opencode.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "build": {
      "mode": "primary",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "{file:./prompts/build.txt}",
      "permission": { "edit": "allow", "bash": "allow" }
    },
    "plan": {
      "mode": "primary",
      "model": "anthropic/claude-haiku-4-5",
      "permission": { "edit": "deny", "bash": "deny" }
    },
    "code-reviewer": {
      "description": "审查代码的最佳实践与潜在问题",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-5",
      "prompt": "你是代码审查者，关注安全、性能与可维护性。",
      "permission": { "edit": "deny" }
    }
  }
}
```

### 方式二：Markdown 文件（推荐）

把 Agent 写成 Markdown，放在：

- 全局：`~/.config/opencode/agents/`
- 项目：`.opencode/agents/`

```markdown title="~/.config/opencode/agents/review.md"
---
description: 审查代码质量与最佳实践
mode: subagent
model: anthropic/claude-sonnet-4-5
temperature: 0.1
permission:
  edit: deny
  bash: deny
---

你处于代码审查模式，关注：

- 代码质量与最佳实践
- 潜在 Bug 与边界情况
- 性能影响
- 安全考量

只给出建设性反馈，不直接改代码。
```

文件名即 Agent 名：`review.md` 生成 `review` 智能体。前置 frontmatter 是配置，正文是系统提示词。

### 交互式创建

```bash
opencode agent create
```

它会引导你选择保存位置、描述用途、自动生成提示词与标识符、勾选允许的权限（未勾选即拒绝），最后生成 Markdown 文件。

---

## 6.4 Agent 配置项详解

### description（必填）

简述这个 Agent 做什么、何时用。子智能体的 description 会被主智能体用来判断「该不该自动调用它」，请写清楚。

### model（省钱关键）

覆盖该 Agent 使用的模型。**这是按任务分层用模的核心**：

```json title="opencode.json"
{
  "agent": {
    "plan":   { "model": "anthropic/claude-haiku-4-5" },
    "review": { "model": "anthropic/claude-sonnet-4-5" }
  }
}
```

> 若不指定 model：主智能体用全局 `model`；子智能体默认沿用「调用它的主智能体」的模型。让规划、审查、检索等任务用便宜模型，实现任务用强模型，是最有效的成本优化之一。

### temperature / top_p

控制随机性。低值（0.0–0.2）更聚焦、确定，适合分析与规划；高值（0.6–1.0）更有创造性。不设则用模型默认（多数模型为 0，Qwen 约 0.55）。

```json title="opencode.json"
{
  "agent": {
    "analyze":   { "temperature": 0.1 },
    "brainstorm":{ "temperature": 0.7 }
  }
}
```

### steps：限制迭代步数（直接控成本）

`steps` 限制 Agent 在被迫只输出文本前，最多能做多少次「智能体迭代」。**想给成本设上限的用户尤其应该用它**：

```json title="opencode.json"
{
  "agent": {
    "quick-thinker": {
      "description": "迭代受限的快速推理",
      "prompt": "你是快思考者，用最少步骤解决问题。",
      "steps": 5
    }
  }
}
```

达到上限时，Agent 会收到特殊系统提示，要求它总结已完成工作并列出剩余任务。（旧字段 `maxSteps` 已废弃，请用 `steps`。）

### prompt

用 `prompt` 指定该 Agent 的系统提示词文件（路径相对配置文件位置）：

```json title="opencode.json"
{ "agent": { "review": { "prompt": "{file:./prompts/code-review.txt}" } } }
```

### mode / hidden / disable / color

- `mode`：`primary` / `subagent` / `all`（默认 `all`）。
- `hidden: true`：把子智能体从 `@` 自动补全里隐藏，仅供程序化调用（只对 subagent 生效）。
- `disable: true`：禁用该 Agent。
- `color`：UI 颜色，支持十六进制（`#FF5733`）或主题色（`primary`/`accent`/`success` 等）。

### 透传 Provider 选项（推理强度等）

Agent 配置里任何其它键都会**直接透传给 Provider** 作为模型选项。例如对 OpenAI 推理模型控制推理强度与输出冗长度：

```json title="opencode.json"
{
  "agent": {
    "deep-thinker": {
      "description": "对复杂问题使用高推理强度",
      "model": "openai/gpt-5",
      "reasoningEffort": "high",
      "textVerbosity": "low"
    }
  }
}
```

> 反过来，对「轻量/规划」类 Agent 把 `reasoningEffort` 调到 `low`/`minimal`、`textVerbosity` 调到 `low`，就是省 Token 的标准操作。

---

## 6.5 Agent 权限（含按命令/路径细粒度）

每个 Agent 都能独立配置权限，且 **Agent 级规则覆盖全局**。权限键值可为 `allow` / `ask` / `deny`，部分键还支持「glob → 动作」的对象语法：

```markdown title="~/.config/opencode/agents/review.md"
---
description: 只读代码审查
mode: subagent
permission:
  edit: deny
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
    "grep *": allow
  webfetch: deny
---

只分析代码并给出修改建议。
```

要点（第八章会系统展开）：

- 规则按模式匹配，**最后一条命中的规则生效**；因此把 `"*"` 放最前、具体规则放后面。
- 权限键作为通配模式匹配底层工具名，对内置工具、自定义工具、MCP 工具同样适用（如 `"mymcp_*": "deny"` 禁用某 MCP 的全部工具）。

---

## 6.6 默认主智能体与子代理调用控制

### 设置默认主智能体

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "plan"
}
```

`default_agent` 必须是**主智能体**（内置的 `build`/`plan` 或你自定义的主智能体）。把默认设为 `plan`，能让每个新会话都从「只读规划」开始，避免模型上来就乱改、乱跑命令——既安全又省返工。该设置对 TUI、`opencode run`、桌面应用、GitHub Action 全部生效。

### 限制某 Agent 能调用哪些子代理（`permission.task`）

```json title="opencode.json"
{
  "agent": {
    "orchestrator": {
      "mode": "primary",
      "permission": {
        "task": {
          "*": "deny",
          "orchestrator-*": "allow",
          "code-reviewer": "ask"
        }
      }
    }
  }
}
```

当某子代理被 `deny` 时，它会被从 Task 工具描述中完全移除，模型不会再尝试调用它。规则同样「最后命中者生效」。注意：用户始终能通过 `@` 手动调用任意子代理，即使 task 权限拒绝。

---

## 6.7 常见 Agent 用例

- **build**：全工具开放的完整开发。
- **plan**：只读分析与规划，不改代码。
- **review**：只读 + 文档工具的代码审查。
- **debug**：聚焦排查，开放 bash 与 read。
- **docs**：写文档，开放文件操作但禁用系统命令。

把这些 Agent 配上「便宜模型 + 低推理强度 + 收紧权限」，就构成了既高效又省钱的工作台。

---

## 6.8 小结

本章你学会了内置 Agent 的分工、用 JSON/Markdown 自定义 Agent、关键配置项（尤其是 `model`、`steps`、`temperature`、推理强度透传与权限），以及默认 Agent 与子代理调用控制。**「按任务分层用模 + 只读子代理隔离上下文 + 限制步数 + 收紧权限」是 OpenCode 成本优化的四大支柱**，第九章会把它们组装成完整方案。

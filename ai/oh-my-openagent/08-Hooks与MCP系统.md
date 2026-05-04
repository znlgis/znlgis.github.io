---
layout: default
title: 第八章：Hooks 钩子流水线与 MCP 系统
---

# 第八章：Hooks 钩子流水线与 MCP 系统

到这一章为止，前面讲到的"Sisyphus 自动并行、Atlas 强制委派、Junior 不能偷停、编辑改不错行、429 自动 fallback"——背后真正在干活的，是 **Hooks**。

OmO 内置 **52 个 Hook**，覆盖会话 / 消息 / 工具 / 参数全流水线。你可以把它当成 OmO 的**操作系统**：模型只是 CPU，Hooks 才是调度器、内存管理、容错恢复、I/O 拦截、安全护栏。

本章把 Hook 系统和 MCP 系统全面盘一遍。

---

## 8.1 Hook 事件全景

OmO 的 Hook 在 6 个事件点拦截：

| 事件 | 触发时机 | 能做 |
| --- | --- | --- |
| **PreToolUse** | 工具执行前 | 阻断 / 修改输入 / 注入上下文 |
| **PostToolUse** | 工具执行后 | 加警告 / 改输出 / 注入消息 |
| **Message** | 消息处理时 | 内容变换 / 关键词识别 / 模式激活 |
| **Event** | 会话生命周期变更时 | 容错 / fallback / 通知 |
| **Transform** | 上下文变换期间 | 注入上下文 / 校验 thinking 块 |
| **Params** | API 参数下发时 | 调整模型设置 / effort 等 |

Hook 物理上分三层：

- **Core** — 43 个，构成基础流水线；
- **Continuation** — 7 个，专门解决"Agent 偷停 / 半途而废"；
- **Skill** — 2 个，集中处理 Skill 加载与 Skill MCP 编排。

合计 52。下面分组看。

---

## 8.2 Hook 分组速查

### 8.2.1 上下文与注入

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `directory-agents-injector` | Pre + Post | 读文件时自动注入 AGENTS.md（沿目录到根，逐层叠加）。OpenCode 1.1.37+ 已自带原生 AGENTS.md 注入时该 Hook 自动停用。 |
| `directory-readme-injector` | Pre + Post | 自动注入目录 README.md 作为上下文 |
| `rules-injector` | Pre + Post | 当条件匹配时注入 `.claude/rules/`，支持 globs 和 alwaysApply |
| `compaction-context-injector` | Event | 压缩会话时保留关键上下文 |
| `context-window-monitor` | Event | 监控上下文窗口、token 用量 |
| `preemptive-compaction` | Event | 主动在临 token 上限前压缩 |

### 8.2.2 生产力与控制

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `keyword-detector` | Message + Transform | 关键词激活模式：`ultrawork`/`ulw`、`search`/`find`、`analyze`/`investigate` |
| `think-mode` | Params | 自动检测 "think deeply"/"ultrathink"，开启 Extended Thinking |
| `ralph-loop` | Event + Message | 自指型循环管理 |
| `start-work` | Message | `/start-work` 命令调度 |
| `auto-slash-command` | Message | 从 prompt 自动执行斜杠命令 |
| `stop-continuation-guard` | Event + Message | 守护停止机制 |
| `category-skill-reminder` | Event + Post | 提醒 Agent 在适当时机用 Category 与 Skill |
| `anthropic-effort` | Params | 按上下文自动调整 Anthropic API effort |

### 8.2.3 质量与安全

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `comment-checker` | Post | 提醒减少冗余注释，智能避开 BDD / docstring / directive |
| `thinking-block-validator` | Transform | 校验 thinking 块以防 API 报错 |
| `edit-error-recovery` | Post + Event | 编辑工具失败时自动恢复 |
| `write-existing-file-guard` | Pre | 阻止未读先写覆盖 |
| `hashline-read-enhancer` | Post | 给 read 输出加 LINE#ID |
| `hashline-edit-diff-enhancer` | Pre + Post | 给 edit 加 diff 标记 |

### 8.2.4 容错与稳定

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `session-recovery` | Event | 修复会话错误（缺失 tool 结果、空消息、thinking 块异常） |
| `anthropic-context-window-limit-recovery` | Event | 优雅处理 Claude 上下文窗口超限 |
| `runtime-fallback` | Event + Message | 自动切换备胎模型，应对 429 / 503 / 529 / 缺 API key / `timeout_seconds > 0` 自动重试。每模型独立冷却 |
| `model-fallback` | Event + Message | 主模型不可用时管理 fallback 链 |
| `json-error-recovery` | Post | 工具输出 JSON 解析错误恢复 |

### 8.2.5 截断与上下文管理

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `tool-output-truncator` | Post | 截断 Grep / Glob / LSP / AST-grep 输出，按上下文窗口动态调整 |

### 8.2.6 通知与 UX

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `auto-update-checker` | Event | 会话创建时检查版本，启动 toast 显示版本和 Sisyphus 状态 |
| `background-notification` | Event | 后台 Agent 完成时通知 |
| `session-notification` | Event | Agent 进入 idle 时 OS 级通知（macOS / Linux / Windows） |
| `agent-usage-reminder` | Post + Event | 提醒利用专长 Agent 获得更好结果 |
| `question-label-truncator` | Pre | 截断 Question 工具 UI 中过长 label |

### 8.2.7 任务管理

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `task-resume-info` | Post | 提供任务续作信息 |
| `delegate-task-retry` | Post + Event | 委派失败时自动重试 |
| `empty-task-response-detector` | Post | 检测被委派任务空回应 |
| `tasks-todowrite-disabler` | Pre | 任务系统启用时禁用 TodoWrite |

### 8.2.8 持续机制（Continuation 七子）

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `todo-continuation-enforcer` | Event | 揪回偷停的 Agent，强制把 todo 跑完 |
| `compaction-todo-preserver` | Event | 压缩时保留 todo 状态 |
| `unstable-agent-babysitter` | Event | 处理不稳定 Agent，加恢复策略 |

（其余 4 个属于 Atlas / start-work / ralph 等模块的内部子 Hook）

### 8.2.9 集成

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `claude-code-hooks` | All | 执行 Claude Code `settings.json` 中的 Hook |
| `atlas` | Multiple | Atlas 编排核心逻辑 |
| `interactive-bash-session` | Post + Event | 管理交互 tmux 会话 |
| `non-interactive-env` | Pre | 处理非交互环境约束 |

### 8.2.10 专用

| Hook | 事件 | 描述 |
| --- | --- | --- |
| `prometheus-md-only` | Pre | 强制 Prometheus 只产 Markdown |
| `no-sisyphus-gpt` | Message | 防止 Sisyphus 跑在不兼容的 GPT 模型 |
| `no-hephaestus-non-gpt` | Message | 防止 Hephaestus 跑在非 GPT 模型 |
| `sisyphus-junior-notepad` | Pre | 管理 Junior 的 notepad 状态 |

---

## 8.3 Hook 的实战意义：3 个例子

### 8.3.1 场景 1：你写了 `ulw 修登录 bug`

链条：

```
keyword-detector(Message)
  → 识别 "ulw"，标记会话进入 ultrawork 模式
think-mode(Params)
  → 检测到 "ulw"，把 Anthropic effort 调到 high
auto-update-checker(Event)
  → 启动时已经检查过版本
agent-usage-reminder(Post)
  → 第一轮回应里偷偷加："建议派 explore 找现有 auth 代码"
runtime-fallback(Event)
  → 期间如果 Claude 429，秒切到 Kimi K2.5
todo-continuation-enforcer(Event)
  → Agent 想说"完成"但还有 todo 未勾时，把它拽回来
```

你只敲了 7 个字，背后 8 个 Hook 在工作。

### 8.3.2 场景 2：你让它编辑 src/foo.ts

```
write-existing-file-guard(Pre)
  → 强制先 read，再 edit
hashline-read-enhancer(Post on read)
  → read 输出末尾加 LINE#ID
hashline-edit-diff-enhancer(Pre + Post on edit)
  → edit 加 diff 标记
edit-error-recovery(Post on edit + Event)
  → 哈希校验失败时自动让模型重试
comment-checker(Post on edit)
  → 检查并提示删多余 AI 注释
tool-output-truncator(Post on grep / lsp)
  → 把搜索 / 诊断输出截断在合理大小
```

完美的"AI 改代码不出错"流水线。

### 8.3.3 场景 3：跑了一半 Claude 限流了

```
runtime-fallback(Event):
  → 收到 anthropic 429
  → 给 anthropic/claude-opus-4-7 加 30 分钟冷却
  → 按 fallback 链切到 opencode-go/kimi-k2.5
  → 把切换告知用户（toast）
session-recovery(Event):
  → 修复中断的 tool 结果块
anthropic-context-window-limit-recovery(Event):
  → 当我换回 Anthropic 时碰到上下文超限
  → 自动触发智能压缩
preemptive-compaction(Event):
  → 在临近 token 上限前提前压缩
```

整套流水线对用户**完全透明**——你只看到任务在继续。

---

## 8.4 Claude Code Hooks 兼容

OmO 内置 `claude-code-hooks`，可以直接执行 Claude Code `settings.json` 里的 PreToolUse / PostToolUse 命令。例如：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "eslint --fix $FILE" }
        ]
      }
    ]
  }
}
```

可以放在：

- `~/.claude/settings.json`（全局用户）
- `./.claude/settings.json`（项目）
- `./.claude/settings.local.json`（本地、git-ignored）

意味着如果你已经在 Claude Code 里搭了一套自定义 Hook 流水线（例如保存自动 lint，或写文件触发某个 build），**直接搬来 OmO 即可**。

---

## 8.5 关掉 / 替换 Hook

`oh-my-openagent.json`：

```jsonc
{
  "disabled_hooks": ["comment-checker", "agent-usage-reminder"]
}
```

适合关掉某些跟你团队风格冲突的 Hook（例如你团队就是要写大量注释，可以禁 comment-checker）。

**不建议关掉**：

- `prometheus-md-only`（关掉后 Prometheus 可能写代码，破坏 READ-ONLY）；
- `no-sisyphus-gpt` / `no-hephaestus-non-gpt`（关掉后模型错配崩坏）；
- `runtime-fallback` / `model-fallback` / `session-recovery`（关掉后稳定性下降）。

---

## 8.6 MCP 系统：Agent 接外部能力的桥梁

### 8.6.1 三层 MCP 架构

OmO 把 MCP 分三层：

#### Tier 1：内置 MCP

| MCP | 描述 |
| --- | --- |
| **websearch** | 实时网络搜索（基于 Exa AI） |
| **context7** | 任何库 / 框架的官方文档查询 |
| **grep_app** | 公共 GitHub 仓库的极速代码搜索，找实现示例必备 |

#### Tier 2：`.mcp.json` 兼容层

完全兼容 Claude Code：

- `~/.claude.json`
- `~/.config/opencode/.mcp.json`
- `.mcp.json`
- `.claude/.mcp.json`

支持环境变量 `${VAR}` 展开，方便传 API Key。

#### Tier 3：Skill 内嵌 MCP

每个 Skill 在 SKILL.md frontmatter 声明自己的 MCP，**只在调用该 Skill 时启动，结束销毁**。这是 OmO 控制上下文窗口的关键武器——不会出现"装了 30 个全局 MCP，调用每个 Agent 都要把 30 个工具描述塞进 prompt"。

```yaml
---
description: My API skill
mcp:
  my-api:
    url: https://api.example.com/mcp
    oauth:
      clientId: ${CLIENT_ID}
      scopes: ["read", "write"]
---
```

### 8.6.2 OAuth 2.1 全合规（Skill MCP）

OmO 实现了完整的 RFC 合规：

- **自动发现**：先查 `/.well-known/oauth-protected-resource`（RFC 9728），不行回退 `/.well-known/oauth-authorization-server`（RFC 8414）；
- **动态客户端注册**：RFC 7591；
- **PKCE**：所有流；
- **Resource Indicators**：RFC 8707；
- **Token 持久化**：`~/.config/opencode/mcp-oauth.json`（chmod 0600）；
- **自动刷新**：401 自动 refresh；403 + WWW-Authenticate 走 step-up；
- **动态端口**：OAuth 回调端口自动选取。

预先认证：

```bash
bunx oh-my-opencode mcp oauth login <server-name> --server-url https://api.example.com
```

### 8.6.3 Skill MCP 的销毁机制

**典型生命周期**：

```
Sisyphus task(load_skills=["playwright"])
   │
   ▼
Skill MCP Manager
   ├─ 启动 playwright MCP 进程
   ├─ 在子 Agent 的工具集中暴露 skill_mcp 工具
   ▼
Junior 完成任务
   ▼
Skill MCP Manager 销毁 playwright MCP 进程
```

这一机制由 `src/features/skill-mcp-manager/` 实现。优点：

- **上下文清洁**：用完即删，不污染主对话；
- **安全**：每次新 OAuth 流程独立；
- **资源**：长会话不堆积无用进程。

---

## 8.7 模型能力刷新

OmO 的所有 Hook / 工具决策都依赖"这个模型的能力是什么"——是不是 thinking、是不是多模态、上下文窗口多大、是不是 Claude-like。这一份元数据来自 `models.dev` 的快照 + 可刷新缓存：

```bash
bunx oh-my-opencode refresh-model-capabilities
```

启动时自动刷新：

```jsonc
{
  "model_capabilities": {
    "enabled": true,
    "auto_refresh_on_start": true,
    "refresh_timeout_ms": 5000,
    "source_url": "https://models.dev/api.json"
  }
}
```

`bunx oh-my-opencode doctor` 会做能力诊断，包括：

- Agents / Categories 的实际模型解析；
- 配置模型是否落到兼容 fallback；
- 覆盖参数与模型解析的兼容情况。

---

## 8.8 Hook + MCP 共同保障的几条"软规则"

OmO 不是用提示词去乞求模型守规矩，而是用 Hook + 工具权限把规矩**写死**。下面是几条值得记住的"软规则"：

1. **Sisyphus / Atlas / Junior 不能让 todo 半途而废**——`todo-continuation-enforcer`。
2. **Edit 只能改你刚读过的内容**——`write-existing-file-guard` + Hashline。
3. **Prometheus 只能写 Markdown**——`prometheus-md-only`。
4. **Sisyphus 不能跑在老 GPT，Hephaestus 不能跑在 Claude**——`no-sisyphus-gpt` / `no-hephaestus-non-gpt`。
5. **任何 429 / 503 自动切**——`runtime-fallback`。
6. **关键上下文不会被压掉**——`compaction-context-injector` + `compaction-todo-preserver`。
7. **Agent 不会冗余写 AI 风格的注释**——`comment-checker`。
8. **Skill 的 MCP 用完即销**——`skill-mcp-manager`。

理解了这些"被强制执行的纪律"，你就理解了 OmO 工程师常说的那句话："这不是 prompt engineering，这是 OS-level discipline"。

下一章我们会把命令、配置文件、模型回退等"高级配置参考"集中盘点一遍，作为速查手册。

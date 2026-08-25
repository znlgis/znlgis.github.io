---
layout: default
title: 第九章：Extensions 扩展开发
---

# 第九章：Extensions 扩展开发

> Extensions 是 Pi"原语而非功能"哲学的终极出口。本章将带你从零开始编写 TypeScript Extension，全面掌握事件系统、API 方法和上下文对象，最终能独立开发出权限控制、Git 自动化、自定义模型提供商等生产级扩展。

## 9.1 Extensions 概述

### 9.1.1 什么是 Extension

Extension 是一个**TypeScript 模块**，它可以扩展 Pi 的几乎所有行为。一个 Extension 文件本质上是一个导出默认函数的 TypeScript 文件，该函数接收 Pi 的核心 API 对象作为参数：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 你的扩展逻辑写在这里
}
```

通过这个 API 对象，你可以：

- **注册自定义工具**——让 LLM 可以调用你的函数
- **注册自定义命令**——让用户可以通过 `/mycommand` 触发你的逻辑
- **监听 20+ 生命周期事件**——在 Agent 启动、工具调用、消息收发等关键节点插入自定义行为
- **注入或修改系统提示词**——精确控制进入模型的上下文
- **构建自定义 TUI 组件**——对话框、状态栏、编辑器组件、Footer 小部件
- **注册自定义快捷键**——绑定键盘操作到自定义逻辑
- **注册 CLI 标志**——添加 `pi --my-flag` 风格的命令行选项
- **注册自定义模型提供商**——接入任意 LLM API 端点
- **操作会话状态**——发送消息、追加条目、设置标签、触发压缩

### 9.1.2 设计哲学：原语集而非功能集

Pi 的设计哲学是"原语而非功能"（Primitives, not Features）。Extension 系统正是这一哲学的**出口**——Pi 核心本身不内置 MCP、权限弹窗、Git checkpointing、子 Agent 编排、背景 bash 进程等功能，而是将这些"缺失的功能"的实现能力通过扩展 API 暴露给你。

这意味着：

| 你需要的能力 | Pi 核心的做法 | 你的做法 |
|-------------|-------------|---------|
| 权限控制 | 不内置（YOLO 模式） | 写一个 `tool_call` 事件监听器，弹确认对话框 |
| Git 自动提交 | 不内置 | 写一个 `agent_end` 事件监听器，自动 `git add -A && git commit` |
| MCP 集成 | 不内置（渐进式披露替代） | 写一个 Extension 连接 MCP server，注册对应工具 |
| 浏览器自动化 | 不内置 | 装 `pi-playwright` 等社区包，或用 Extension 封装 Playwright 调用 |
| 自定义状态栏 | 不内置 | 通过 `ctx.ui.setStatus()` 和 `ctx.ui.setFooter()` 实现 |

这种模式的代价是**你需要写一些 TypeScript 代码**，但换来的是**无限的灵活性和完全的掌控力**——没有任何行为是你无法修改或拦截的。

### 9.1.3 Extension vs Skill vs Prompt Template：选择指南

很多新手会混淆这三个概念。它们的核心区别如下：

| 维度 | Extension | Skill | Prompt Template |
|------|-----------|-------|-----------------|
| **本质** | 可执行的 TypeScript 代码 | Markdown 文档 | Markdown 模板 |
| **能力** | 调用系统 API、监听事件、注册工具、修改 UI | 向模型提供"怎么做"的指导 | 通过 `/name` 展开一个预设文本 |
| **执行者** | Node.js 运行时（你的代码） | LLM（模型读 Skill 后按指导执行） | 无执行——纯文本展开 |
| **典型场景** | 权限控制、Git 自动化、自定义工具、UI 定制 | "如何部署这个项目"、"如何写单元测试" | 代码审查模板、PR 描述模板、BUG 报告模板 |
| **token 消耗** | 不影响上下文（除非主动注入） | 首次加载时消耗少量 token（渐进式披露） | 展开后直接进入上下文 |
| **复杂度** | 需要 TypeScript 编程 | 只需 Markdown 写作 | 只需 Markdown 写作 |
| **生命周期** | 持续运行，监听事件 | 按需加载（Agent 决定何时使用） | 用户手动触发 |

**选择建议**：

- 如果你需要**拦截/修改 Pi 的行为**（如阻止某个 bash 命令、自动提交 git、在工具调用前后注入逻辑），用 **Extension**。
- 如果你需要**教模型怎么做某件事**（如项目的部署流程、特定框架的最佳实践），用 **Skill**。
- 如果你需要**一个可反复使用的文本模板**（如代码审查清单、commit message 格式），用 **Prompt Template**。

三者可以协同工作：一个 Extension 可以在 `before_agent_start` 事件中动态注入一个 Skill 的路径，或者在 `tool_call` 事件中根据工具名自动展开一个 Prompt Template。

## 9.2 快速开始：第一个 Extension

### 9.2.1 完整代码示例

让我们写一个实用的 Extension：它注册一个 `/greet` 命令、一个 `get_current_time` 工具（LLM 可调用），并监听 `session_start` 事件在会话开始时打印欢迎信息。

```typescript
// ~/.pi/extensions/my-first-extension.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // —— 1. 注册自定义命令 ——
  pi.registerCommand("greet", {
    description: "向用户打招呼",
    async execute(ctx) {
      await ctx.ui.notify("你好！欢迎使用 Pi。");
    },
  });

  // —— 2. 注册 LLM 可调用的工具 ——
  pi.registerTool({
    name: "get_current_time",
    label: "获取当前时间",
    description: "返回当前的系统时间，包括日期、时间和时区信息",
    parameters: Type.Object({
      timezone: Type.Optional(
        Type.String({
          description: "时区，如 'Asia/Shanghai'。不传则使用系统默认时区",
        })
      ),
    }),
    async execute(toolCallId, params) {
      const now = new Date();
      const localeString = params.timezone
        ? now.toLocaleString("zh-CN", { timeZone: params.timezone })
        : now.toLocaleString("zh-CN");
      return {
        content: [
          {
            type: "text",
            text: `当前时间：${localeString} (${now.getTime()}ms)`,
          },
        ],
        details: {},
      };
    },
  });

  // —— 3. 监听会话启动事件 ——
  pi.on("session_start", async (event, ctx) => {
    console.log(`[my-extension] 会话已启动: ${event.sessionId}`);
    await ctx.ui.setStatus(`会话 ${event.sessionId.slice(0, 8)}... 已就绪`);
  });
}
```

### 9.2.2 文件结构

一个 Extension 可以是一个单文件，也可以是一个目录（当需要多个文件时）。推荐的目录结构如下：

```
~/.pi/extensions/
├── my-first-extension.ts          # 单文件 Extension
├── git-automation/                # 多文件 Extension（目录形式）
│   ├── index.ts                   # 入口文件（导出默认函数）
│   ├── git-utils.ts               # 辅助函数
│   └── package.json               # 可选：声明依赖
└── custom-provider/
    ├── index.ts
    └── api-client.ts
```

目录形式的 Extension 必须有一个 `index.ts` 作为入口，该文件同样导出默认函数。如果 `package.json` 中声明了 npm 依赖，Pi 会在加载时自动解析（需要将依赖安装在 extension 目录下，或作为全局 `node_modules` 的一部分）。

### 9.2.3 加载方式

有三种方式加载 Extension：

**方式一：settings.json 配置（推荐）**

在 `~/.pi/agent/settings.json` 或项目的 `.pi/settings.json` 中添加 `extensions` 字段：

```json
{
  "extensions": [
    "~/.pi/extensions/my-first-extension.ts",
    "~/.pi/extensions/git-automation"
  ]
}
```

路径支持 `~` 展开为 home 目录，也支持相对路径（相对于配置文件所在目录）。

**方式二：通过 Pi Package 安装**

如果 Extension 被打包成了 npm 包，可以用 `pi install` 安装：

```bash
pi install npm:@author/pi-my-extension
```

安装后，Extension 会自动出现在 `settings.json` 的 `extensions` 列表中。你也可以通过 `pi install git:https://github.com/user/pi-my-extension` 从 git 仓库安装。

**方式三：CLI 参数动态加载**

```bash
pi --extensions ~/.pi/extensions/my-first-extension.ts
```

这种方式适用于临时测试一个 Extension，但不会持久化到配置文件中。

## 9.3 事件系统

事件系统是 Extension 最核心的能力。Pi 提供了 20+ 生命周期事件，覆盖了 Agent 从启动到关闭、从用户输入到模型响应的完整链路。你可以用 `pi.on(eventName, handler)` 监听事件，返回特定值来改变 Pi 的默认行为。

### 9.3.1 project_trust——项目信任决策

当 Pi 检测到当前项目目录包含 `.pi/settings.json`，但尚未被信任时触发。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.projectPath — 项目路径
  // event.hasSettings — 是否存在 .pi/settings.json
  // event.hasSkills — 是否存在 .pi/skills/
  // event.hasExtensions — 是否存在 .pi/extensions/

  const ok = await ctx.ui.confirm(
    "项目信任",
    `${event.projectPath} 包含项目配置，是否信任？`
  );

  return { trust: ok };
  // 返回 { trust: false } 可拒绝信任，Pi 将不加载项目配置
});
```

### 9.3.2 session_start / session_shutdown——会话生命周期

**session_start**：在新会话创建时触发（包括 `/new` 和首次启动）。

**session_shutdown**：在会话关闭时触发（包括 `/exit` 和 SIGTERM）。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.sessionId — 会话 ID
  // event.mode — 运行模式（"interactive" | "print" | "rpc"）

  console.log(`会话 ${event.sessionId} 已启动，模式：${event.mode}`);
  await ctx.ui.setStatus("Extension 已加载");
});

pi.on("session_shutdown", async (event, ctx) => {
  // event.sessionId — 会话 ID
  // event.reason — 关闭原因（"user" | "error" | "signal"）

  console.log(`会话 ${event.sessionId} 已关闭，原因：${event.reason}`);
  // 适合做清理工作：关闭数据库连接、保存状态文件等
});
```

### 9.3.3 before_agent_start——注入消息或修改系统提示

在每轮用户输入被发送给模型**之前**触发。这是最灵活的事件之一——你可以在这里注入额外的系统指令、添加上下文信息、甚至修改用户消息。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.messages — 即将发送给模型的消息数组（可修改）
  // event.systemPrompt — 系统提示词模板（可修改）

  // 示例1：在用户消息前追加 git status 信息
  const gitStatus = await getGitStatus();
  event.messages.unshift({
    role: "user",
    content: `[系统注入] 当前 Git 状态：\n${gitStatus}`,
  });

  // 示例2：动态扩展系统提示词
  event.systemPrompt = event.systemPrompt + "\n## 额外指令\n- 每次修改代码后自动运行测试。";

  // 返回 { block: true } 可阻止本轮请求发送给模型
});
```

### 9.3.4 agent_start / agent_end——每轮用户提示

**agent_start**：在一轮 Agent 循环**开始**时触发（用户按下 Enter 发送 prompt 时）。

**agent_end**：在一轮 Agent 循环**结束**时触发（模型不再需要调用工具，响应完成时）。

```typescript
pi.on("agent_start", async (event, ctx) => {
  // event.prompt — 原始用户输入
  console.log(`用户输入: ${event.prompt}`);
});

pi.on("agent_end", async (event, ctx) => {
  // event.messages — 本轮完整消息历史
  // event.usage — token 使用统计
  console.log(`本轮消耗: 输入 ${event.usage.inputTokens} tokens, 输出 ${event.usage.outputTokens} tokens`);
});
```

### 9.3.5 turn_start / turn_end——每次 LLM 响应 + 工具调用

**turn_start**：在每次 LLM 响应**开始**时触发（模型返回一行文本或一个工具调用 = 一个 turn）。

**turn_end**：在每次 LLM 响应**结束**时触发。

这里的"turn"是一个比 agent 更细的粒度——一轮 agent 循环中可能包含多个 turn（模型响应 → 工具调用 → 工具结果回传 → 模型再次响应 → ...）。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex — 当前 turn 序号（从 0 开始）
  console.log(`Turn ${event.turnIndex} 开始`);
});

pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex — 当前 turn 序号
  // event.toolCalls — 本轮的工具调用列表
  if (event.toolCalls.length > 0) {
    console.log(`Turn ${event.turnIndex} 包含 ${event.toolCalls.length} 个工具调用`);
  }
});
```

### 9.3.6 message_start / message_update / message_end——消息流

这三个事件跟踪模型响应的**流式输出**过程。

**message_start**：模型开始返回一条新消息时触发。

**message_update**：消息内容增量更新时触发（流式传输中每次收到新 token）。

**message_end**：模型完成一条消息时触发。

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.messageId — 消息 ID
  // event.role — "assistant"
  console.log("模型开始回复");
});

pi.on("message_update", async (event, ctx) => {
  // event.messageId — 消息 ID
  // event.content — 增量内容（流式文本片段）
  // 可用于实时分析模型输出内容，例如检测敏感词
  if (event.content.includes("API_KEY")) {
    console.warn("检测到疑似密钥泄露！");
  }
});

pi.on("message_end", async (event, ctx) => {
  // event.messageId — 消息 ID
  // event.fullContent — 完整消息文本
  // event.usage — token 统计
  console.log(`模型回复完成: ${event.usage.outputTokens} tokens`);
});
```

### 9.3.7 tool_call（可拦截/修改） / tool_result（可修改）

**tool_call**：在工具被**调用之前**触发。这是实现权限控制的核心事件——你可以在事件处理器中检查工具参数，决定是否允许执行。

**tool_result**：在工具执行**完成后**触发。你可以在这里修改工具返回值，或在特定条件下触发后续操作。

```typescript
pi.on("tool_call", async (event, ctx) => {
  // event.toolCallId — 工具调用 ID
  // event.toolName — 工具名称（"read" | "write" | "edit" | "bash" | 自定义工具）
  // event.input — 工具参数对象

  // 示例1：阻止危险的 rm -rf 命令
  if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    const ok = await ctx.ui.confirm(
      "危险操作",
      `即将执行: ${event.input.command}\n\n是否继续？`
    );
    if (!ok) {
      return { block: true, reason: "用户拒绝了 rm -rf 操作" };
    }
  }

  // 示例2：限制 write 工具只能操作特定目录
  if (event.toolName === "write") {
    const targetPath = event.input.path as string;
    if (!targetPath.startsWith("/safe-workspace/")) {
      return {
        block: true,
        reason: `write 工具被限制在 /safe-workspace/ 内，目标路径: ${targetPath}`,
      };
    }
  }

  // 示例3：修改工具参数
  if (event.toolName === "bash" && event.input.command?.startsWith("npm test")) {
    event.input.command = event.input.command + " -- --verbose";
    // 修改后的参数会传递给工具执行
  }
});

pi.on("tool_result", async (event, ctx) => {
  // event.toolCallId — 工具调用 ID
  // event.toolName — 工具名称
  // event.result — 工具执行结果（可修改）
  // event.error — 如果执行失败，这里包含错误信息

  // 示例：自动补充上下文信息
  if (event.toolName === "read" && event.result?.content) {
    const filePath = event.input.path as string;
    const gitBlame = await getGitBlame(filePath);
    if (gitBlame) {
      event.result.content += `\n\n[Git Blame] 最近修改者: ${gitBlame}`;
    }
  }

  // 示例：检测错误并自动介入
  if (event.error && event.toolName === "bash") {
    const cmd = event.input.command as string;
    console.error(`命令执行失败: ${cmd}\n错误: ${event.error.message}`);
    // 可以在这里通过 pi.sendMessage 向模型提示错误信息
  }
});
```

### 9.3.8 tool_execution_start / tool_execution_update / tool_execution_end

跟踪单个工具的**执行过程**。与 `tool_call` 不同，这些事件在工具**实际开始执行后**触发——即 `tool_call` 的事件处理器已经通过（未被 block），工具正在运行。

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId — 工具调用 ID
  // event.toolName — 工具名称
  await ctx.ui.setStatus(`正在执行 ${event.toolName}...`);
});

pi.on("tool_execution_update", async (event, ctx) => {
  // event.toolCallId — 工具调用 ID
  // event.output — 增量输出（如 bash 命令的流式输出）
  // 注意：并非所有工具都支持流式输出
});

pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId — 工具调用 ID
  // event.toolName — 工具名称
  // event.duration — 执行耗时（毫秒）
  await ctx.ui.setStatus(`就绪`);

  if (event.duration > 30000) {
    console.warn(`工具 ${event.toolName} 执行超过 30 秒`);
  }
});
```

### 9.3.9 context——修改发送给 LLM 的消息

`context` 事件在消息被**最终发送给 LLM 之前**触发。与 `before_agent_start` 不同，`context` 事件提供的是底层的消息数组操作能力——你可以精确地插入、删除、修改任何一条消息。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages — 完整的消息数组（[{role, content}, ...]）
  // 可以插入、删除、修改任意消息

  // 示例：在每条 assistant 消息后追加 token 使用统计
  for (let i = event.messages.length - 1; i >= 0; i--) {
    const msg = event.messages[i];
    if (msg.role === "assistant" && msg.tool_calls) {
      // 在工具调用消息后插入一条 user 消息，提示 token 预算
      event.messages.splice(i + 1, 0, {
        role: "user",
        content: "[系统提示] 当前已使用大量 token，请尽量简洁。",
      });
    }
  }

  // 示例：从上下文中移除某些消息以节省 token
  // event.messages = event.messages.filter(m => m.role !== "system");
});
```

### 9.3.10 before_provider_request / after_provider_response

这两个事件让你能**观测甚至修改**发送给 LLM 提供商的原始请求和响应。这是调试模型行为、追踪 token 消耗、甚至实现自定义重试逻辑的利器。

```typescript
pi.on("before_provider_request", async (event, ctx) => {
  // event.provider — 提供商名称（如 "anthropic"、"openai"）
  // event.request — 原始请求体（供应商 API 格式）
  // event.model — 模型 ID

  console.log(
    `[${event.provider}] 请求大小: ${JSON.stringify(event.request).length} 字符`
  );

  // 示例：为所有请求添加自定义 header
  event.request.headers = event.request.headers || {};
  event.request.headers["X-Custom-Trace-Id"] = generateTraceId();
});

pi.on("after_provider_response", async (event, ctx) => {
  // event.provider — 提供商名称
  // event.response — 原始响应体
  // event.error — 如果失败，包含错误对象
  // event.duration — 请求耗时（毫秒）

  if (event.error) {
    console.error(`[${event.provider}] 请求失败: ${event.error.message}`);

    // 示例：对特定错误实现自动重试
    if (event.error.message.includes("rate_limit")) {
      return { retry: true, delay: 5000 };
    }
  } else {
    const usage = event.response.usage;
    console.log(
      `[${event.provider}] 响应: 输入 ${usage.input_tokens} tokens, 输出 ${usage.output_tokens} tokens`
    );
  }
});
```

### 9.3.11 input——拦截/转换用户输入

在用户按下 Enter 后、输入被送入 Agent 循环之前触发。可以拦截、修改或增强用户输入。

```typescript
pi.on("input", async (event, ctx) => {
  // event.original — 原始用户输入文本
  // event.input — 可修改的输入文本

  // 示例：自动补全 @ 文件引用
  if (event.input.startsWith("fix ")) {
    event.input = `修复以下问题，并在修复后运行测试：\n${event.input.slice(4)}`;
  }

  // 返回 { block: true } 阻止输入进入 Agent 循环
});
```

### 9.3.12 user_bash——拦截 `!` 命令

当用户在消息输入框中以 `!` 开头输入命令时触发。`!ls` 会直接在本地 shell 执行（而非发送给模型），`!!` 执行上一条 `!` 命令。

```typescript
pi.on("user_bash", async (event, ctx) => {
  // event.command — 用户输入的命令字符串
  // event.cwd — 当前工作目录

  // 可以修改命令
  if (event.command === "!docker-compose down") {
    const ok = await ctx.ui.confirm(
      "确认操作",
      "确定要关闭所有 Docker 容器？"
    );
    if (!ok) return { block: true };
  }

  // 可以阻止执行
  if (event.command.includes("--force")) {
    return { block: true, reason: "不允许 --force 参数" };
  }
});
```

### 9.3.13 model_select / thinking_level_select

**model_select**：当用户通过 `/model` 命令或快捷键切换模型时触发。

**thinking_level_select**：当用户切换模型的思考级别时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model — 用户选择的模型 ID
  // event.provider — 模型所属供应商

  console.log(`切换到模型: ${event.provider}/${event.model}`);

  // 可以阻止切换
  if (event.model.includes("expensive")) {
    await ctx.ui.notify("已阻止切换到高成本模型", "warning");
    return { block: true };
  }
});

pi.on("thinking_level_select", async (event, ctx) => {
  // event.level — 思考级别（"off" | "low" | "medium" | "high" | "auto"）
});
```

### 9.3.14 session_before_compact / session_compact——自定义压缩

**session_before_compact**：在上下文压缩之前触发，可以影响压缩行为。

**session_compact**：在上下文压缩完成时触发。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  // event.reason — 压缩原因（"token_limit" | "manual"）
  // event.messagesBefore — 压缩前的消息数量

  console.log(`即将压缩上下文，当前消息数: ${event.messagesBefore}`);

  // 可以阻止压缩
  // return { block: true };
});

pi.on("session_compact", async (event, ctx) => {
  // event.messagesBefore — 压缩前消息数
  // event.messagesAfter — 压缩后消息数
  // event.tokensBefore — 压缩前 token 数
  // event.tokensAfter — 压缩后 token 数

  console.log(
    `上下文已压缩: ${event.messagesBefore} → ${event.messagesAfter} 条消息, ` +
    `${event.tokensBefore} → ${event.tokensAfter} tokens`
  );
});
```

### 9.3.15 session_before_tree / session_tree

**session_before_tree**：在 `/tree` 命令生成会话树之前触发。

**session_tree**：在会话树生成完成时触发。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  // event.sessionId — 会话 ID
});

pi.on("session_tree", async (event, ctx) => {
  // event.tree — 会话树结构
  // event.currentNodeId — 当前节点 ID
  console.log(`会话树包含 ${event.tree.nodes.length} 个节点`);
});
```

### 9.3.16 session_before_switch / session_before_fork

**session_before_switch**：在用户通过 `/resume` 或 `/tree` 切换到另一个会话之前触发。

**session_before_fork**：在用户执行 `/fork` 分叉当前会话之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.fromSessionId — 当前会话 ID
  // event.toSessionId — 目标会话 ID

  console.log(`切换会话: ${event.fromSessionId} → ${event.toSessionId}`);
  // 可以在这里保存当前会话状态
});

pi.on("session_before_fork", async (event, ctx) => {
  // event.sessionId — 被分叉的会话 ID
  // event.forkNodeId — 分叉点节点 ID

  const ok = await ctx.ui.confirm(
    "分叉会话",
    "确定要从此节点分叉？分叉后将创建新的分支。"
  );
  if (!ok) return { block: true };
});
```

### 9.3.17 resources_discover——贡献额外资源

允许 Extension 注册额外的 Skills 路径、Prompt Template 路径和 Theme 路径。这在打包 Extension 为 Pi Package 时非常有用。

```typescript
pi.on("resources_discover", async (event, ctx) => {
  // 注册额外的 Skills 目录
  event.skills.push({
    name: "my-custom-skills",
    path: "/path/to/my/skills/directory",
  });

  // 注册额外的 Prompt Template 目录
  event.promptTemplates.push({
    name: "my-templates",
    path: "/path/to/my/templates/directory",
  });

  // 注册额外的 Theme
  event.themes.push({
    name: "my-custom-theme",
    path: "/path/to/my/theme.json",
  });
});
```

## 9.4 API 方法详解

`ExtensionAPI`（上面代码中的 `pi` 参数）提供了丰富的注册和管理方法。本节逐一详解。

### 9.4.1 pi.registerTool(definition)——注册 LLM 可调用的工具

这是最常用的 API 方法之一——让模型可以调用你的自定义函数。

```typescript
import { Type } from "typebox";

pi.registerTool({
  name: "weather",                        // 工具名称（模型看到的名称）
  label: "查询天气",                       // 人类可读标签
  description: "查询指定城市的当前天气信息", // 工具描述（模型用于判断何时调用）
  parameters: Type.Object({               // TypeBox schema 定义参数
    city: Type.String({ description: "城市名称，如 'Beijing'" }),
    units: Type.Optional(
      Type.Union([
        Type.Literal("metric"),
        Type.Literal("imperial"),
      ], { description: "温度单位，metric=摄氏，imperial=华氏" })
    ),
  }),

  // 执行函数
  async execute(toolCallId: string, params: Record<string, unknown>) {
    const city = params.city as string;
    const units = (params.units as string) || "metric";

    // 你的业务逻辑——调用 API、读数据库、执行计算等
    const weatherData = await fetchWeather(city, units);

    // 返回标准 ToolResult 格式
    return {
      content: [
        {
          type: "text",
          text: `${city} 天气: ${weatherData.temp}°, ${weatherData.description}`,
        },
      ],
      // details 会显示在 TUI 的折叠详情区域
      details: weatherData,
    };
  },
});
```

**ToolResult 格式说明**：

- `content`：`{ type: "text", text: string }[]`——返回给模型的文本内容。
- `details`：任意 JSON-serializable 对象——在 TUI 折叠区域展示，模型看不到（不占用上下文）。
- `attachments`：可选，`{ name: string, path: string, type: string }[]`——返回给用户的附件列表。

### 9.4.2 pi.registerCommand(name, options)——注册斜杠命令

注册一个用户可以通过 `/commandName` 调用的命令。

```typescript
pi.registerCommand("stats", {
  description: "显示当前会话统计信息",
  // autoComplete: ["sessions", "tokens", "tools"], // 可选的自动补全候选项

  async execute(ctx) {
    const usage = await ctx.getContextUsage();
    const sessionName = await ctx.getSessionName();

    await ctx.ui.notify(
      `会话: ${sessionName}\n` +
      `Token 使用: 输入 ${usage.inputTokens} / 输出 ${usage.outputTokens}\n` +
      `上下文窗口使用率: ${(usage.usageRatio * 100).toFixed(1)}%`
    );
  },
});
```

命令执行函数接收 `ctx` 对象（详见 [9.5 节](#95-上下文ctx方法)），不接收用户输入参数。如果需要参数，可以在命令执行时通过 `ctx.ui.input()` 获取。

### 9.4.3 pi.registerShortcut(shortcut, options)——注册快捷键

绑定键盘快捷键到自定义逻辑。

```typescript
pi.registerShortcut("Ctrl+G", {
  description: "快速执行 git status",

  async execute(ctx) {
    // 通过 pi.sendUserMessage 向 Agent 发送指令
    await pi.sendUserMessage("请执行 git status 并总结当前仓库状态");
  },
});
```

快捷键格式使用常见的组合键命名：`Ctrl+X`、`Alt+X`、`Ctrl+Shift+X`、`F1`-`F12` 等。当用户按下已注册的快捷键时，执行函数被调用。

### 9.4.4 pi.registerFlag(name, options)——注册 CLI 标志

为 `pi` CLI 命令添加自定义选项标志。

```typescript
pi.registerFlag("auto-commit", {
  description: "每轮 agent 结束后自动 git commit",
  type: "boolean",        // "boolean" | "string" | "number"
  defaultValue: false,

  onSet(value, ctx) {
    if (value) {
      console.log("自动提交已启用");
    }
  },
});
```

注册后，用户可以通过 `pi --auto-commit` 启用该标志。`onSet` 回调在标志被设置时调用（无论是 CLI 参数还是配置文件）。

### 9.4.5 pi.registerProvider(name, config)——注册自定义模型提供商

这是接入任意 LLM API 端点的关键方法。

```typescript
pi.registerProvider("my-custom-provider", {
  label: "我的自定义供应商",

  // 模型列表
  models: [
    {
      id: "my-model-v1",
      name: "My Model V1",
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsThinking: false,
    },
  ],

  // 认证方式
  auth: {
    type: "api_key",  // "api_key" | "oauth" | "subscription"
    label: "API Key",
    envVar: "MY_PROVIDER_API_KEY",
  },

  // API 调用实现
  async createCompletion(params) {
    // params.model — 模型 ID
    // params.messages — 消息数组
    // params.tools — 工具定义数组
    // params.apiKey — 用户的 API Key
    // params.signal — AbortSignal（支持中断）

    const response = await fetch("https://api.my-provider.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        tools: params.tools,
        stream: true,
      }),
      signal: params.signal,
    });

    // 返回 OpenAI-compatible 流式响应格式
    return {
      stream: response.body!,
      // 或者返回非流式响应:
      // response: await response.json(),
    };
  },
});
```

### 9.4.6 pi.unregisterProvider(name)

注销一个已注册的模型提供商。

```typescript
pi.unregisterProvider("my-custom-provider");
```

### 9.4.7 pi.sendMessage(message) / pi.sendUserMessage(content)

向 Agent 发送消息。

**pi.sendMessage**：发送完整的消息对象。

**pi.sendUserMessage**：以用户身份发送文本消息（便捷方法）。

```typescript
// 发送一个完整消息对象
await pi.sendMessage({
  role: "user",
  content: "请分析最近的 git 提交",
  // attachments: [{ name: "diff.txt", path: "/tmp/diff.txt", type: "text" }],
});

// 等价便捷方法
await pi.sendUserMessage("请分析最近的 git 提交");

// 可以指定消息投递方式
await pi.sendUserMessage("注意：即将进行关键操作", {
  mode: "steering",  // "steering"（高优先级） | "follow-up"（默认，追加到队列）
});
```

`steering` 模式的消息会立即中断当前模型响应，以最高优先级注入；`follow-up` 模式的消息则追加到消息队列末尾，在当前模型响应结束后再发送。

### 9.4.8 pi.appendEntry(customType, data)

向会话历史中追加一个自定义类型的条目。这在需要持久化非标准交互记录时很有用。

```typescript
// 追加一个自定义事件条目
pi.appendEntry("ci_result", {
  status: "success",
  buildId: "build-12345",
  url: "https://ci.example.com/builds/12345",
  timestamp: Date.now(),
});

// 这些自定义条目会保存在 JSONL 会话文件中
// 可以通过 registerMessageRenderer 定制其 TUI 渲染
```

### 9.4.9 pi.setSessionName(name) / pi.getSessionName()

管理当前会话的名称。

```typescript
// 获取会话名称
const currentName = await pi.getSessionName();

// 设置会话名称（显示在 /resume 列表中）
await pi.setSessionName("重构用户认证模块");

// 在 agent_end 中自动命名
pi.on("agent_end", async (event, ctx) => {
  const firstPrompt = event.messages.find(m => m.role === "user")?.content;
  if (firstPrompt) {
    const shortName = firstPrompt.slice(0, 40).replace(/\n/g, " ");
    await pi.setSessionName(shortName);
  }
});
```

### 9.4.10 pi.setLabel(entryId, label)

为会话历史中的特定条目设置标签。标签会显示在 `/tree` 视图中，方便后续定位关键节点。

```typescript
pi.on("tool_result", async (event, ctx) => {
  // 对耗时超过 5 秒的操作打标签
  if (event.duration > 5000) {
    pi.setLabel(event.toolCallId, "⚠️ 耗时操作");
  }
});
```

### 9.4.11 pi.registerMessageRenderer(customType, renderer)

为 `pi.appendEntry` 追加的自定义条目类型注册 TUI 渲染器。

```typescript
pi.registerMessageRenderer("ci_result", {
  render(entry) {
    const data = entry.data;
    const icon = data.status === "success" ? "✅" : "❌";
    return `${icon} CI Build #${data.buildId}: ${data.status} — ${data.url}`;
  },
});
```

### 9.4.12 pi.setModel(model)

编程式切换当前模型。

```typescript
// 根据任务复杂度自动切换模型
pi.on("before_agent_start", async (event, ctx) => {
  const userInput = event.messages.find(m => m.role === "user")?.content as string;

  if (userInput && userInput.length > 2000) {
    // 复杂任务切换到更强的模型
    await pi.setModel("anthropic/claude-opus-4-5");
  } else {
    await pi.setModel("anthropic/claude-sonnet-4-5");
  }
});
```

### 9.4.13 pi.getActiveTools() / pi.setActiveTools(names)

管理和查询当前活跃的工具列表。

```typescript
// 获取当前启用的工具列表
const activeTools = pi.getActiveTools();
console.log("当前活跃工具:", activeTools);

// 动态设置工具列表（覆盖 settings.json 中的配置）
pi.setActiveTools(["read", "write", "edit", "bash", "my_custom_tool"]);

// 在特定条件下限制工具
pi.on("before_agent_start", async (event, ctx) => {
  const cwd = process.cwd();
  if (cwd === "/production") {
    // 生产环境中只允许只读工具
    pi.setActiveTools(["read", "grep", "find", "ls"]);
  }
});
```

### 9.4.14 pi.events——扩展间通信事件总线

`pi.events` 是一个独立的事件发射器，用于 Extension 之间的通信。使用它，不同的 Extension 可以互相发送消息和协作。

```typescript
// Extension A：发出事件
pi.events.emit("checkpoint:created", {
  timestamp: Date.now(),
  message: "Auto-saved before model response",
});

// Extension B：监听事件
pi.events.on("checkpoint:created", (data) => {
  console.log(`收到 checkpoint 通知: ${data.message}`);
});
```

这是一个松耦合的通信机制——发送方不需要知道接收方是否存在，接收方也不需要知道发送方的实现细节。

## 9.5 上下文（ctx）方法

在事件处理器中，`ctx` 参数提供了丰富的上下文信息和 UI 操作方法。

### 9.5.1 ctx.ui——用户界面方法

`ctx.ui` 是操作 Pi TUI 的核心接口。

**ctx.ui.select**——弹出选择列表：

```typescript
const choice = await ctx.ui.select(
  "选择操作",                    // 标题
  [
    { id: "commit", label: "提交更改" },
    { id: "push", label: "推送到远程" },
    { id: "revert", label: "撤销更改" },
  ]
);
// choice 为被选中项的 id，用户取消则为 undefined
```

**ctx.ui.confirm**——弹出确认对话框：

```typescript
const ok = await ctx.ui.confirm(
  "确认提交",                           // 标题
  "将提交 3 个文件的更改到 main 分支？"   // 详细信息
);
// ok 为 boolean
```

**ctx.ui.input**——弹出文本输入框：

```typescript
const branchName = await ctx.ui.input(
  "创建分支",           // 标题
  "请输入新分支名称:",    // 提示文本
  "feature/"           // 默认值
);
// branchName 为用户输入的字符串，取消则为 undefined
```

**ctx.ui.notify**——显示通知：

```typescript
await ctx.ui.notify(
  "构建完成！3 个测试全部通过。",  // 消息
  "success"                       // 类型: "info" | "success" | "warning" | "error"
);
```

**ctx.ui.setStatus**——设置状态栏文本：

```typescript
// 在工具执行期间显示状态
await ctx.ui.setStatus("正在运行测试套件...");
// 完成后恢复
await ctx.ui.setStatus("就绪");
```

**ctx.ui.setWidget**——设置自定义 TUI 小部件：

```typescript
// 渲染一个持久化的自定义组件
ctx.ui.setWidget({
  id: "git-status",
  render() {
    return `分支: ${currentBranch} | 待提交: ${stagedCount} | 修改: ${modifiedCount}`;
  },
  // 可选：设置刷新间隔（毫秒）
  interval: 5000,
});
```

**ctx.ui.custom**——弹出自定义 UI 组件：

```typescript
// 弹出一个自定义的 TUI 面板
ctx.ui.custom({
  id: "my-panel",
  title: "自定义面板",
  render() {
    return "这是一个自定义渲染的内容区域\n支持多行和 ANSI 转义序列";
  },
  onKey(key: string) {
    if (key === "q") {
      return { close: true };
    }
  },
});
```

**ctx.ui.setEditorComponent**——替换编辑器组件：

```typescript
// 用自定义编辑器替换 Pi 的默认消息输入编辑器
ctx.ui.setEditorComponent({
  async getInput(): Promise<string> {
    // 你的自定义输入逻辑
    // 例如：从外部文件读取、从剪贴板获取、调用另一个程序等
    return "用户输入内容";
  },

  async setInput(text: string): Promise<void> {
    // 设置编辑器内容
  },
});
```

**ctx.ui.setFooter**——设置底部状态栏内容：

```typescript
ctx.ui.setFooter([
  { key: "Ctrl+S", label: "保存" },
  { key: "Ctrl+Q", label: "退出" },
  { key: "F1", label: "帮助" },
]);
```

### 9.5.2 ctx.mode——当前运行模式

```typescript
pi.on("session_start", async (event, ctx) => {
  switch (ctx.mode) {
    case "interactive":
      console.log("运行在交互式 TUI 模式");
      break;
    case "print":
      console.log("运行在 Print 模式 (-p)");
      break;
    case "rpc":
      console.log("运行在 RPC 模式");
      break;
  }
});
```

运行模式决定了 `ctx.ui` 方法的行为：在 `print` 和 `rpc` 模式下，`ctx.ui.select`、`ctx.ui.confirm` 等交互式方法可能不可用。

### 9.5.3 ctx.hasUI

检查当前运行环境是否支持 UI 交互。

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    if (ctx.hasUI) {
      const ok = await ctx.ui.confirm("危险操作", "确认执行？");
      if (!ok) return { block: true };
    } else {
      // 非交互模式：直接阻止
      return { block: true, reason: "非交互模式下禁止危险操作" };
    }
  }
});
```

### 9.5.4 ctx.sessionManager

会话管理器，提供会话级别的操作。

```typescript
// 获取会话列表（用于构建自定义会话浏览器）
const sessions = await ctx.sessionManager.listSessions();

// 获取当前会话的完整消息历史
const messages = await ctx.sessionManager.getMessages();

// 跳转到会话的特定节点（/tree 功能）
await ctx.sessionManager.goToNode(nodeId);
```

### 9.5.5 ctx.modelRegistry / ctx.model

`ctx.modelRegistry` 提供模型注册表的查询能力；`ctx.model` 是当前使用的模型 ID。

```typescript
// 获取所有可用模型
const allModels = ctx.modelRegistry.getAllModels();

// 获取特定供应商的模型
const anthropicModels = ctx.modelRegistry.getProviderModels("anthropic");

// 获取当前模型
console.log(`当前模型: ${ctx.model}`);
```

### 9.5.6 ctx.compact() / ctx.getContextUsage() / ctx.getSystemPrompt()

**ctx.compact()**：手动触发上下文压缩。

**ctx.getContextUsage()**：获取当前上下文使用情况。

**ctx.getSystemPrompt()**：获取当前系统提示词文本。

```typescript
// 当 token 使用量超过阈值时自动压缩
pi.on("turn_end", async (event, ctx) => {
  const usage = await ctx.getContextUsage();
  if (usage.usageRatio > 0.8) {
    await ctx.ui.notify("上下文使用量超过 80%，正在压缩...", "warning");
    await ctx.compact();
  }
});

// 获取系统提示词用于调试
const systemPrompt = await ctx.getSystemPrompt();
console.log(`系统提示词长度: ${systemPrompt.length} 字符`);
```

`getContextUsage()` 返回的格式：

```typescript
{
  inputTokens: number,       // 当前上下文的输入 token 数
  outputTokens: number,      // 最近一次响应的输出 token 数
  contextWindow: number,     // 模型的上下文窗口大小
  usageRatio: number,        // 使用比例 (0-1)
  totalCost: number,         // 累计费用（美元）
}
```

### 9.5.7 ctx.isIdle() / ctx.abort() / ctx.shutdown()

**ctx.isIdle()**：检查 Agent 是否处于空闲状态（没有正在进行的模型请求或工具调用）。

**ctx.abort()**：中断当前模型请求（相当于用户按 `Ctrl+C`）。

**ctx.shutdown()**：关闭当前会话（相当于 `/exit`）。

```typescript
// 在长时间无活动后自动关闭
let idleTimer: ReturnType<typeof setInterval>;

pi.on("session_start", async (event, ctx) => {
  idleTimer = setInterval(async () => {
    const idle = await ctx.isIdle();
    if (idle) {
      idleSeconds += 5;
      if (idleSeconds > 600) { // 10 分钟无活动
        await ctx.ui.notify("会话已闲置 10 分钟，自动关闭", "info");
        await ctx.shutdown();
      }
    } else {
      idleSeconds = 0;
    }
  }, 5000);
});

pi.on("session_shutdown", async () => {
  clearInterval(idleTimer);
});
```

## 9.6 实战案例

### 9.6.1 案例 1：自动 Git 部署扩展

这个扩展在每轮 Agent 对话结束后自动执行 `git add` 和 `git commit`，如果代码通过测试则自动推送。

```typescript
// ~/.pi/extensions/git-auto-deploy/index.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "child_process";

export default function (pi: ExtensionAPI) {
  pi.registerFlag("auto-commit", {
    description: "每轮 agent 结束后自动 git commit",
    type: "boolean",
    defaultValue: false,
    onSet(value) {
      console.log(`Git 自动提交: ${value ? "已启用" : "已禁用"}`);
    },
  });

  pi.on("agent_end", async (event, ctx) => {
    if (!isAutoCommitEnabled(ctx)) return;

    const cwd = process.cwd();

    try {
      // 检查是否有变更
      const status = execSync("git status --porcelain", { cwd }).toString();
      if (!status.trim()) {
        await ctx.ui.setStatus("无 Git 变更，跳过提交");
        return;
      }

      // 生成 commit message
      const userPrompt = event.messages
        .find(m => m.role === "user")
        ?.content?.toString()
        .slice(0, 60) || "自动提交";

      await ctx.ui.setStatus("正在提交变更...");

      execSync("git add -A", { cwd });
      execSync(`git commit -m "auto: ${userPrompt}"`, { cwd });

      // 可选：自动推送
      const shouldPush = await ctx.ui.confirm(
        "Git 推送",
        "变更已提交。是否推送到远程仓库？"
      );

      if (shouldPush) {
        execSync("git push", { cwd });
        await ctx.ui.notify("已推送到远程仓库", "success");
      } else {
        await ctx.ui.notify("变更已提交（未推送）", "success");
      }

      await ctx.ui.setStatus("就绪");
    } catch (err: any) {
      await ctx.ui.notify(`Git 操作失败: ${err.message}`, "error");
      await ctx.ui.setStatus("Git 操作失败");
    }
  });
}

function isAutoCommitEnabled(ctx: any): boolean {
  // 检查 CLI 标志或配置文件
  return process.argv.includes("--auto-commit");
}
```

### 9.6.2 案例 2：代码统计扩展

这个扩展注册一个 `/codestats` 命令，统计当前项目的代码行数和文件分布，并注册一个 `get_code_stats` 工具供 LLM 调用。

```typescript
// ~/.pi/extensions/code-stats/index.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "fs";
import * as path from "path";

export default function (pi: ExtensionAPI) {
  // —— LLM 可调用的工具 ——
  pi.registerTool({
    name: "get_code_stats",
    label: "代码统计",
    description: "统计项目中各类文件的行数和数量，支持按扩展名过滤",
    parameters: Type.Object({
      directory: Type.Optional(
        Type.String({ description: "要统计的目录，默认为项目根目录" })
      ),
      extensions: Type.Optional(
        Type.Array(Type.String(), {
          description: "要统计的文件扩展名列表，如 ['ts', 'js', 'md']。不传则统计所有文件",
        })
      ),
    }),
    async execute(toolCallId, params) {
      const dir = (params.directory as string) || process.cwd();
      const exts = params.extensions as string[] | undefined;

      const stats = scanDirectory(dir, exts);

      let report = "代码统计报告\n============\n\n";
      for (const [ext, data] of Object.entries(stats)) {
        report += `**${ext}**: ${data.files} 个文件, ${data.lines} 行\n`;
      }
      report += `\n**总计**: ${sumStats(stats).files} 个文件, ${sumStats(stats).lines} 行`;

      return {
        content: [{ type: "text", text: report }],
        details: stats,
      };
    },
  });

  // —— 用户命令 ——
  pi.registerCommand("codestats", {
    description: "显示当前项目的代码统计信息",
    async execute(ctx) {
      const stats = scanDirectory(process.cwd());
      const total = sumStats(stats);

      const lines: string[] = [
        "📊 代码统计",
        "────────────",
      ];

      const sorted = Object.entries(stats).sort((a, b) => b[1].lines - a[1].lines);
      for (const [ext, data] of sorted) {
        const pct = ((data.lines / total.lines) * 100).toFixed(1);
        lines.push(`${ext.padEnd(8)} ${String(data.files).padStart(4)} 文件  ${String(data.lines).padStart(6)} 行  (${pct}%)`);
      }

      lines.push("────────────");
      lines.push(`合计 ${total.files} 文件, ${total.lines} 行`);

      await ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

interface StatData {
  files: number;
  lines: number;
}

function scanDirectory(dir: string, filterExts?: string[]): Record<string, StatData> {
  const stats: Record<string, StatData> = {};
  const ignoreDirs = new Set(["node_modules", ".git", "dist", "build", ".pi", "__pycache__"]);

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name) && !entry.name.startsWith(".")) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1) || "(无扩展名)";
        if (filterExts && !filterExts.includes(ext)) continue;

        try {
          const content = fs.readFileSync(path.join(currentDir, entry.name), "utf-8");
          const lines = content.split("\n").length;

          if (!stats[ext]) stats[ext] = { files: 0, lines: 0 };
          stats[ext].files++;
          stats[ext].lines += lines;
        } catch {
          // 跳过无法读取的文件（如二进制文件）
        }
      }
    }
  }

  walk(dir);
  return stats;
}

function sumStats(stats: Record<string, StatData>): StatData {
  let files = 0, lines = 0;
  for (const data of Object.values(stats)) {
    files += data.files;
    lines += data.lines;
  }
  return { files, lines };
}
```

### 9.6.3 案例 3：自定义模型提供商

这个扩展注册一个 Ollama 本地模型的提供商，让 Pi 可以直接调用本机运行的 Ollama 实例。

```typescript
// ~/.pi/extensions/ollama-provider/index.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  pi.registerProvider("ollama-local", {
    label: "Ollama (本地)",

    auth: {
      type: "none",
      label: "无需认证",
    },

    // 注意：models 需要事先从 Ollama API 获取
    // 这里演示硬编码几个常见模型
    models: [
      {
        id: "deepseek-r1:32b",
        name: "DeepSeek R1 32B",
        contextWindow: 131072,
        maxOutputTokens: 32768,
        supportsTools: true,
        supportsVision: false,
        supportsThinking: true,
      },
      {
        id: "qwen2.5-coder:14b",
        name: "Qwen 2.5 Coder 14B",
        contextWindow: 131072,
        maxOutputTokens: 8192,
        supportsTools: true,
        supportsVision: false,
        supportsThinking: false,
      },
      {
        id: "codellama:34b",
        name: "CodeLlama 34B",
        contextWindow: 16384,
        maxOutputTokens: 4096,
        supportsTools: false,
        supportsVision: false,
        supportsThinking: false,
      },
    ],

    async createCompletion(params) {
      const { model, messages, tools, signal } = params;

      // Ollama 使用 OpenAI-compatible API
      const requestBody: any = {
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: true,
        options: {
          temperature: 0.7,
        },
      };

      // 如果模型支持工具调用，传入工具定义
      if (tools && tools.length > 0) {
        requestBody.tools = tools.map(tool => ({
          type: "function",
          function: {
            name: tool.function?.name || tool.name,
            description: tool.function?.description || tool.description,
            parameters: tool.function?.parameters || tool.parameters,
          },
        }));
      }

      const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ollama API 错误 (${response.status}): ${errorBody}`);
      }

      return {
        stream: response.body!,
      };
    },
  });

  console.log(`[ollama-provider] 已注册 Ollama 本地供应商 (${OLLAMA_BASE_URL})`);
}
```

安装后，你可以通过以下方式使用：

```bash
# 切换到本地部署模型
pi --model ollama-local/deepseek-r1:32b
```

或者通过设置默认模型：

```json
// ~/.pi/agent/settings.json
{
  "modelProvider": "ollama-local/deepseek-r1:32b",
  "extensions": ["~/.pi/extensions/ollama-provider"]
}
```

## 9.7 Extension 开发最佳实践

### 9.7.1 错误处理

Extension 中的未捕获异常会导致 Extension 被卸载，因此务必做好错误处理：

```typescript
pi.on("tool_call", async (event, ctx) => {
  try {
    // 你的逻辑
  } catch (err) {
    console.error(`[my-extension] tool_call 处理失败:`, err);
    // 不要让异常向上传播——返回 undefined 让事件继续传递给下一个处理器
  }
});
```

### 9.7.2 类型安全

始终使用 TypeBox 定义工具参数——它不仅生成 JSON Schema 供 LLM 使用，还在运行时验证参数类型：

```typescript
import { Type } from "typebox";

// 好的做法：完整的 TypeBox schema
const params = Type.Object({
  path: Type.String({ description: "文件路径" }),
  recursive: Type.Optional(Type.Boolean({ description: "是否递归" })),
});

// 避免：用 any 或 object
// parameters: Type.Any()  ← 不要这样做
```

### 9.7.3 性能考虑

- **同步操作尽快返回**：事件处理器中的长时操作应使用 async/await，但务必确保不会阻塞整个事件循环。
- **避免在 `message_update` 中做重计算**：这个事件在每个 token 到达时都会触发，频率极高。如果需要分析完整消息，在 `message_end` 中做。
- **缓存外部数据**：如果需要频繁访问某个外部 API，在 Extension 中缓存结果，而不是每个事件都请求一次。
- **使用 ctx.ui.setWidget 的 interval 参数**：对于需要定期刷新的状态显示，使用 `ctx.ui.setWidget` 的 `interval` 参数而不是自行实现轮询。

### 9.7.4 与 Skills 和 Prompt Templates 协同

Extension 不是孤立存在的——它可以与 Skills 和 Prompt Templates 协同工作：

```typescript
// 在 Extension 中动态注入 Skill 加载指令
pi.on("before_agent_start", async (event, ctx) => {
  const cwd = process.cwd();

  // 检测项目类型并注入对应 Skill
  if (fs.existsSync(path.join(cwd, "package.json"))) {
    event.messages.unshift({
      role: "user",
      content: "[系统指令] 这是一个 Node.js 项目。如果进行代码修改，请参考 @skill:nodejs-best-practices。",
    });
  }

  if (fs.existsSync(path.join(cwd, "Cargo.toml"))) {
    event.messages.unshift({
      role: "user",
      content: "[系统指令] 这是一个 Rust 项目。如果进行代码修改，请参考 @skill:rust-best-practices。",
    });
  }
});
```

### 9.7.5 打包为 Pi Package

当你开发了一个成熟的 Extension，可以将其打包为 npm 包分享给社区：

```json
// package.json
{
  "name": "@my-name/pi-my-extension",
  "version": "1.0.0",
  "description": "一个 Pi Extension 的描述",
  "pi": {
    "extensions": ["index.ts"],
    "skills": ["./skills/"],
    "promptTemplates": ["./templates/"],
    "themes": ["./themes/"]
  }
}
```

`pi` 字段告诉 Pi 这个包包含哪些资源。用户通过 `pi install npm:@my-name/pi-my-extension` 安装后，Pi 会自动加载这些资源。

## 9.8 本章小结

本章我们全面掌握了 Pi 的 Extension 系统：

- Extension 是 TypeScript 模块，通过 `export default function(pi: ExtensionAPI)` 与 Pi 核心交互，是"原语而非功能"哲学的实现出口。
- 通过 `pi.registerTool()`、`pi.registerCommand()`、`pi.registerShortcut()`、`pi.registerFlag()`、`pi.registerProvider()` 等方法，你可以为 Pi 添加自定义工具、命令、快捷键、CLI 标志和模型提供商。
- 20+ 生命周期事件（`project_trust`、`session_start`、`before_agent_start`、`tool_call`、`context`、`before_provider_request` 等）覆盖了 Agent 运行的全部环节，让你可以在任意节点插入自定义逻辑。
- `tool_call` 事件是实现权限控制的核心——返回 `{ block: true }` 即可阻止危险操作。
- `ctx.ui` 提供了完整的 TUI 操作方法：`select`、`confirm`、`input`、`notify`、`setStatus`、`setWidget`、`custom`、`setFooter` 等。
- `ctx` 还提供了会话管理、模型查询、上下文使用统计、手动压缩、中断和关闭等高级能力。
- 多个 Extension 之间可以通过 `pi.events` 事件总线实现松耦合通信。
- 通过三个实战案例（自动 Git 部署、代码统计、自定义模型提供商），你应当已经具备独立开发生产级 Extension 的能力。

Extension 系统是 Pi 灵活性的核心来源。掌握了它，Pi 就不再只是一个终端编码 Agent，而是一个你可以完全按自己意愿重塑的 Agent 平台。

下一章：[第十章：Pi包管理与分发](https://znlgis.github.io/ai/pi/10-Pi包管理与分发/) 将学习如何通过 Pi Package 机制管理、分发和分享你的 Extensions、Skills、Prompt Templates 和 Themes。

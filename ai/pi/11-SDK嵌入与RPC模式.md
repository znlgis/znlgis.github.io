---
layout: default
title: 第十一章：SDK 嵌入与 RPC 模式
---

# 第十一章：SDK 嵌入与 RPC 模式

> Pi 提供了三种脱离终端 TUI 使用 Agent 能力的方式：**SDK**（TypeScript 库嵌入）、**RPC 模式**（进程间 JSONL 通信）和 **Print/JSON 模式**（一次性问答管道）。本章将带你从概念到实践，全面掌握如何将 Pi 的 Agent 能力整合到你自己的应用、自动化流程和工具链中。

## 11.1 SDK 嵌入概述

### 11.1.1 什么场景需要 SDK

在以下场景中，将 Pi 当做库来使用（而非启动独立的 CLI 进程）是最合适的选择：

| 场景 | 描述 |
|------|------|
| **构建自定义 Agent 应用** | 你想做一个 Web UI、桌面应用或移动端 App，底层用 Pi 做 Agent 引擎 |
| **集成到现有工具链** | 你的 Node.js 后端需要"AI 编码助手"能力，不想进程间通信 |
| **自动化工作流** | 你想在 CI/CD 流水线中直接调用 Agent，不通过 subprocess |
| **自定义交互界面** | 你需要一个不同于 Pi 终端 TUI 的交互界面（GUI、WebSocket、HTTP API） |
| **子 Agent 编排** | 在 A Agent 的 Extension 中启动 B Agent 完成子任务 |
| **测试 Agent 行为** | 你想在单元测试中验证 Agent 的工具调用、输出、事件流等行为 |

如果不是上述场景——比如你只是想从 Python、Rust 或其他语言调用 Pi——那么 **RPC 模式**（11.7 节）是更好的选择。

### 11.1.2 SDK 安装

Pi SDK 包含在主包 `@earendil-works/pi-coding-agent` 中，不需要单独安装：

```bash
npm install @earendil-works/pi-coding-agent
```

推荐使用 `--ignore-scripts` 参数以提高安全性：

```bash
npm install --ignore-scripts @earendil-works/pi-coding-agent
```

### 11.1.3 核心导出概览

按下文出现的顺序，SDK 的核心导出包括：

| 导出 | 用途 |
|------|------|
| `createAgentSession()` | 创建 `AgentSession` 的工厂函数 |
| `AgentSession` | 会话接口——发送 prompt、订阅事件、控制模型、压缩上下文 |
| `createAgentSessionRuntime()` | 创建完整的 Agent 运行时（支持会话替换） |
| `AgentSessionRuntime` | 会话运行时——`newSession()`、`switchSession()`、`fork()` |
| `AuthStorage` | 凭据存储——API Key、OAuth Token |
| `ModelRegistry` | 模型注册表——查找、遍历、获取可用模型 |
| `DefaultResourceLoader` | 默认资源加载器——发现 Extensions、Skills、Prompts、Themes |
| `SessionManager` | 会话管理器——创建、打开、继续、列出、树导航 |
| `SettingsManager` | 设置管理器——读取、合并、覆写全局与项目设置 |
| `defineTool()` | 定义自定义工具（TypeBox schema + execute 函数） |
| `createCodingTools()` / `createReadOnlyTools()` | 工具工厂——创建内置工具实例 |
| `InteractiveMode` | 交互式模式——完整 TUI |
| `runPrintMode()` | Print 模式——一次性问答 |
| `runRpcMode()` | RPC 模式——JSONL 进程间通信 |

## 11.2 `createAgentSession()` 工厂函数

`createAgentSession()` 是 SDK 的入口。它接收一组选项，返回一个 `{ session, extensionsResult, modelFallbackMessage }` 对象。

### 11.2.1 完整参数说明

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session, extensionsResult, modelFallbackMessage } = await createAgentSession({
  // === 模型 ===
  model: myModel,              // Model 对象（来自 getModel() 或 modelRegistry.find()）
  thinkingLevel: "medium",     // off | minimal | low | medium | high | xhigh

  // === 认证 ===
  authStorage: authStorage,    // AuthStorage 实例（管理 API Key / OAuth）
  modelRegistry: modelRegistry,// ModelRegistry 实例（模型查找 / 遍历）

  // === 工具 ===
  tools: ["read", "bash"],     // 启用的工具名称列表（默认 ["read","bash","edit","write"]）
  excludeTools: ["edit"],      // 禁用的工具名称列表
  customTools: [myTool],       // 自定义工具数组（defineTool() 创建）
  noTools: "builtin",          // "all" 禁用全部 | "builtin" 禁内置保留扩展

  // === 目录 ===
  cwd: process.cwd(),          // 工作目录（DefaultResourceLoader 从此向上发现资源）
  agentDir: getAgentDir(),     // 全局配置目录（默认 ~/.pi/agent）

  // === 资源 ===
  resourceLoader: myLoader,    // ResourceLoader 实例（加载 Extensions/Skills/Prompts）

  // === 会话 ===
  sessionManager: SessionManager.inMemory(),  // 会话管理器

  // === 设置 ===
  settingsManager: settingsManager,  // 设置管理器

  // === 模型切换范围 ===
  scopedModels: [              // 模型轮转候选列表（Ctrl+P）
    { model: opus, thinkingLevel: "high" },
    { model: haiku, thinkingLevel: "off" },
  ],
});
```

### 11.2.2 核心概念：`SessionManager.inMemory()` vs `SessionManager.create()`

`SessionManager` 控制了会话的存储方式和生命周期：

| 方法 | 存储位置 | 持久化？ | 适用场景 |
|------|----------|----------|----------|
| `SessionManager.inMemory()` | 内存 | ❌ 进程结束即消失 | 测试、一次性脚本、不想留痕迹 |
| `SessionManager.create(cwd)` | 磁盘 JSONL 文件 | ✅ 跨进程持久化 | 正式使用、CI/CD 审计、需要事后回溯 |
| `SessionManager.continueRecent(cwd)` | 磁盘（最近一次） | ✅ | 恢复上次中断的工作 |
| `SessionManager.open(path)` | 指定路径 | ✅ | 打开特定会话、加载分享的会话 |
| `SessionManager.list(cwd)` | — | — | 列出当前项目所有会话 |
| `SessionManager.listAll(cwd)` | — | — | 列出所有项目的会话 |

**基本示例代码：**

```typescript
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

// 1. 创建凭据存储和模型注册表
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

// 2. 创建会话（内存模式）
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

// 3. 订阅事件
session.subscribe((event) => {
  if (event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// 4. 发送提示
await session.prompt("列出当前目录的所有文件");

// 5. 清理
session.dispose();
```

## 11.3 `AgentSession` 接口详解

`AgentSession` 是 SDK 的核心接口，管理 Agent 生命周期、消息历史、模型状态、上下文压缩和事件流。

### 11.3.1 接口定义

```typescript
interface AgentSession {
  // === 会话信息 ===
  sessionFile: string | undefined;   // 会话文件路径（内存模式为 undefined）
  sessionId: string;                 // 会话唯一标识

  // === 消息 ===
  prompt(text: string, options?: PromptOptions): Promise<void>;
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;

  // === 事件 ===
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;

  // === 模型控制 ===
  setModel(model: Model): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  cycleModel(): Promise<ModelCycleResult | undefined>;
  cycleThinkingLevel(): ThinkingLevel | undefined;

  // === 状态访问 ===
  agent: Agent;                          // 底层的 Agent 实例
  model: Model | undefined;              // 当前模型
  thinkingLevel: ThinkingLevel;          // 当前思考级别
  messages: AgentMessage[];              // 所有消息
  isStreaming: boolean;                  // 是否正在流式输出

  // === 树导航 ===
  navigateTree(targetId: string, options?: {
    summarize?: boolean;
    customInstructions?: string;
    replaceInstructions?: boolean;
    label?: string;
  }): Promise<{ editorText?: string; cancelled: boolean }>;

  // === 上下文压缩 ===
  compact(customInstructions?: string): Promise<CompactionResult>;
  abortCompaction(): void;

  // === 控制 ===
  abort(): Promise<void>;
  dispose(): void;
}
```

### 11.3.2 `prompt(text, options?)`——发送提示

向 Agent 发送用户消息。`prompt()` 会解析 Prompt Template（`/name`）和斜杠命令，再将消息送入队列：

```typescript
// 基本用法（Agent 未流式输出时）
await session.prompt("帮我重构这段代码");

// 带图片
await session.prompt("这张图片有什么问题？", {
  images: [{
    type: "image",
    source: {
      type: "base64",
      mediaType: "image/png",
      data: "iVBORw0KGgo..."
    }
  }]
});

// 在流式输出中发送——必须指定 streamingBehavior
await session.prompt("停下来，先做这个", { streamingBehavior: "steer" });
await session.prompt("除此之外，再做这个", { streamingBehavior: "followUp" });
```

`PromptOptions` 完整定义：

```typescript
interface PromptOptions {
  expandPromptTemplates?: boolean;    // 是否展开 /name 模板
  images?: ImageContent[];            // 附带图片
  streamingBehavior?: "steer" | "followUp";  // 流式输出时的排队策略
  source?: InputSource;               // 输入来源标记
  preflightResult?: (success: boolean) => void;  // 提示预处理完成回调
}
```

关键行为：
- **斜杠命令**（如 `/mycommand`）会立即执行，即使 Agent 正在流式输出。它们通过 `pi.sendMessage()` 管理自身的 LLM 交互，不依赖外层排队。
- **Prompt Template**（`.md` 文件定义）会被展开为完整内容后发送或排队。
- **流式输出期间，不指定 `streamingBehavior` 会抛出错误**。请直接使用 `steer()` 或 `followUp()` 方法。
- `preflightResult(true)` 表示提示已被接受、排队或立即处理。
- `preflightResult(false)` 表示预检阶段已被拒绝。

### 11.3.3 `steer(text)` / `followUp(text)`——流式处理时排队

这两个方法用于在 Agent 正在执行时排队插入消息，是 `prompt()` 带 `streamingBehavior` 选项的底层实现：

```typescript
// steer：在当前 LLM 轮次处理完工具调用后、下一轮 LLM 调用前投递
await session.steer("停止当前操作，先修这个 bug");

// followUp：等待 Agent 完全停止后才投递
await session.followUp("完成后，再写一份测试");
```

| 方法 | 投递时机 | 典型用途 |
|------|----------|----------|
| `steer()` | 当前轮次工具调用执行完毕后 | 紧急纠偏、打断当前方向 |
| `followUp()` | Agent 完全停止（无更多工具调用或 steering 消息） | 追加子任务、补充指示 |

两者都会展开 Prompt Template，但不接受斜杠命令（斜杠命令只能通过 `prompt()` 发送）。

### 11.3.4 `subscribe(listener)`——订阅事件

返回一个取消订阅函数。事件类型覆盖了 Agent 的完整生命周期：

```typescript
const unsubscribe = session.subscribe((event) => {
  switch (event.type) {
    // === 流式文本 ===
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.assistantMessageEvent.type === "thinking_delta") {
        // 思考过程（启用思考功能时）
      }
      if (event.assistantMessageEvent.type === "toolcall_start") {
        console.log(`[调用工具] ${event.assistantMessageEvent.toolCall.name}`);
      }
      break;

    // === 工具执行 ===
    case "tool_execution_start":
      console.log(`[开始] ${event.toolName}`);
      break;
    case "tool_execution_update":
      // event.partialResult 包含累积输出
      break;
    case "tool_execution_end":
      console.log(`[结果] ${event.isError ? "出错" : "成功"}`);
      break;

    // === 消息生命周期 ===
    case "message_start":
    case "message_end":
      break;

    // === Agent 生命周期 ===
    case "agent_start":
      console.log("[Agent 开始处理]");
      break;
    case "agent_end":
      console.log(`[Agent 完成] 产生 ${event.messages.length} 条消息`);
      break;

    // === 轮次 ===
    case "turn_start":
    case "turn_end":
      break;

    // === 队列 ===
    case "queue_update":
      console.log(`排队中: steering=${event.steering.length}, followUp=${event.followUp.length}`);
      break;

    // === 压缩 ===
    case "compaction_start":
      console.log(`[压缩] 原因: ${event.reason}`);
      break;
    case "compaction_end":
      if (event.result) {
        console.log(`[压缩完成] 从 ${event.result.tokensBefore} 降至 ~${event.result.estimatedTokensAfter} tokens`);
      }
      break;

    // === 自动重试 ===
    case "auto_retry_start":
      console.log(`[重试] 第 ${event.attempt}/${event.maxAttempts} 次, 等待 ${event.delayMs}ms`);
      break;
    case "auto_retry_end":
      console.log(`[重试结束] ${event.success ? "成功" : `失败: ${event.finalError}`}`);
      break;
  }
});

// 取消订阅
unsubscribe();
```

### 11.3.5 `setModel(model)` / `setThinkingLevel(level)` / `cycleModel()`

运行时切换模型和思考级别：

```typescript
import { getModel } from "@earendil-works/pi-ai";

// 切换到指定模型
const sonnet = getModel("anthropic", "claude-sonnet-4-20250514");
await session.setModel(sonnet!);

// 设置思考级别
session.setThinkingLevel("high");
session.setThinkingLevel("off");  // 关闭思考（节省 token 和成本）

// 遍历模型（类似 Ctrl+P）
const result = await session.cycleModel();
if (result) {
  console.log(`当前模型: ${result.model.id}，思考: ${result.thinkingLevel}`);
}

// 遍历思考级别
const newLevel = session.cycleThinkingLevel();
```

### 11.3.6 `compact(customInstructions?)`——压缩上下文

当上下文中积累了过多消息时，调用 `compact()` 触发上下文压缩：

```typescript
// 默认压缩
const result = await session.compact();
console.log(`摘要: ${result.summary}`);
console.log(`tokens: ${result.tokensBefore} → ~${result.estimatedTokensAfter}`);

// 带自定义指令的压缩
await session.compact("重点保留与数据库迁移相关的讨论");

// 中止正在进行的压缩
session.abortCompaction();
```

压缩结果类型：

```typescript
interface CompactionResult {
  summary: string;             // 对话摘要
  firstKeptEntryId: string;    // 保留的第一条消息 ID
  tokensBefore: number;        // 压缩前 token 数
  estimatedTokensAfter: number;// 压缩后估算 token 数（启发式）
  details: object;             // 详细信息
}
```

### 11.3.7 `navigateTree(targetId)`——树导航

Pi 的会话是一个**树形结构**（每一条用户消息可以创建分支）。`navigateTree()` 可以将会话的"当前位置"跳到任意节点：

```typescript
const result = await session.navigateTree("abc123", {
  summarize: true,                                   // 是否添加摘要
  customInstructions: "从 checkpoint 重新开始分析",  // 自定义指令
  label: "backtrack",                                // 标记节点
});

if (result.cancelled) {
  console.log("导航被取消（Extension 拦截）");
} else {
  console.log(`编辑器文本: ${result.editorText}`);
}
```

### 11.3.8 `abort()` / `dispose()`——中止和清理

```typescript
// 中止当前操作（如工具执行、LLM 调用）
await session.abort();

// 释放资源（取消所有事件订阅、清理内存状态）
session.dispose();
```

### 11.3.9 完整代码示例

下面是一个完整的 SDK 使用示例，覆盖认证、自定义工具、事件订阅和交互流程：

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

async function main() {
  // 1. 设置认证存储和模型注册表
  const authStorage = AuthStorage.create();
  // 运行时 API Key 覆写（不写入磁盘）
  if (process.env.MY_API_KEY) {
    authStorage.setRuntimeApiKey("anthropic", process.env.MY_API_KEY);
  }
  const modelRegistry = ModelRegistry.create(authStorage);

  // 2. 定义自定义工具
  const statusTool = defineTool({
    name: "status",
    label: "系统状态",
    description: "获取当前系统运行状态",
    parameters: Type.Object({}),
    execute: async () => ({
      content: [{ type: "text", text: `运行时间: ${process.uptime()}s` }],
      details: {},
    }),
  });

  // 3. 获取模型
  const model = getModel("anthropic", "claude-sonnet-4-20250514");
  if (!model) throw new Error("模型未找到");

  // 4. 设置管理（内存模式，带覆写）
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: true, maxRetries: 2 },
  });

  // 5. 资源加载器（自定义系统提示词）
  const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: "~/.pi/agent",
    settingsManager,
    systemPromptOverride: () => "你是一个精简的助手。保持回复简洁。",
  });
  await loader.reload();

  // 6. 创建会话
  const { session } = await createAgentSession({
    cwd: process.cwd(),
    agentDir: "~/.pi/agent",
    model,
    thinkingLevel: "medium",
    authStorage,
    modelRegistry,
    tools: ["read", "bash", "status"],
    customTools: [statusTool],
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });

  // 7. 订阅事件
  session.subscribe((event) => {
    if (event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  // 8. 发送提示
  await session.prompt("获取系统状态并列出文件");

  // 9. 清理
  session.dispose();
}

main().catch(console.error);
```

## 11.4 `AgentSessionRuntime` 接口

`AgentSessionRuntime` 解决了"我需要替换当前会话"的需求——比如在同一个进程中支持 `/new`（新会话）、`/resume`（恢复历史会话）、`/fork`（从分支点继续）。Pi 内置的交互式、Print、RPC 三种模式内部都使用了这一层。

### 11.4.1 功能总览

`AgentSessionRuntime` 支持以下会话替换操作：

| 操作 | 描述 | 底层方法 |
|------|------|----------|
| 新会话 | 开始一个全新会话 | `runtime.newSession()` |
| 切换会话 | 加载另一个 JSONL 文件 | `runtime.switchSession(path)` |
| 分支 | 从历史用户消息创建新分支 | `runtime.fork(entryId)` |
| 克隆 | 在当前位置复制会话路径到新文件 | `runtime.fork(entryId, { position: "at" })` |
| 导入 | 从外部 JSONL 导入 | `runtime.importFromJsonl(path)` |

### 11.4.2 创建 Runtime

`createAgentSessionRuntime()` 接收一个 Runtime 工厂函数和初始参数：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

// 定义 Runtime 工厂
const createRuntime: CreateAgentSessionRuntimeFactory = async ({
  cwd, sessionManager, sessionStartEvent
}) => {
  // 创建 cwd 相关服务
  const services = await createAgentSessionServices({ cwd });

  // 从服务创建会话
  const sessionData = await createAgentSessionFromServices({
    services,
    sessionManager,
    sessionStartEvent,
  });

  return {
    ...sessionData,
    services,
    diagnostics: services.diagnostics,
  };
};

// 创建 Runtime
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});
```

### 11.4.3 `newSession()`——新建会话

```typescript
let session = runtime.session;
let unsubscribe = session.subscribe(handleEvent);

// 新建会话
await runtime.newSession();

// 重要：事件订阅绑定到旧 session 上，需要重新订阅
unsubscribe();
session = runtime.session;
unsubscribe = session.subscribe(handleEvent);

// 如果使用了 Extensions，也需要重新绑定
// await runtime.session.bindExtensions(...);
```

### 11.4.4 `fork()`——创建分支

```typescript
// 从指定历史消息创建分支（生成新文件）
await runtime.fork("entry-abc123");

// 克隆：在当前路径位置复制到新文件
await runtime.fork("entry-abc123", { position: "at" });
```

**关键注意事项：** 每次调用 `newSession()`、`switchSession()` 或 `fork()` 后：
1. `runtime.session` 引用会改变
2. 之前的事件订阅全部失效——需要用新的 `session` 重新订阅
3. 如果使用了 Extensions，需要为新 session 重新调用 `session.bindExtensions(...)`
4. 创建失败会抛出错误——由调用方决定如何处理

### 11.4.5 交互式 / Print / RPC 模式建立在 Runtime 之上

三种运行模式都是对 `AgentSessionRuntime` 的封装：

```typescript
// 交互式模式（完整 TUI）
import { InteractiveMode } from "@earendil-works/pi-coding-agent";
const mode = new InteractiveMode(runtime, { /* options */ });
await mode.run();

// Print 模式（一次性问答）
import { runPrintMode } from "@earendil-works/pi-coding-agent";
await runPrintMode(runtime, {
  mode: "text",
  initialMessage: "列出所有 .ts 文件并统计行数",
  initialImages: [],
  messages: [],
});

// RPC 模式（JSONL 进程间通信）
import { runRpcMode } from "@earendil-works/pi-coding-agent";
await runRpcMode(runtime);
```

## 11.5 主要导出清单

下表是 `@earendil-works/pi-coding-agent` 主入口的所有导出，按照功能分组：

### 11.5.1 工厂与运行时

| 导出 | 类型 | 用途 |
|------|------|------|
| `createAgentSession` | 函数 | 创建单个 `AgentSession` |
| `createAgentSessionRuntime` | 函数 | 创建 `AgentSessionRuntime`（支持会话替换） |
| `AgentSessionRuntime` | 类 | 会话运行时容器 |

### 11.5.2 认证与模型

| 导出 | 类型 | 用途 |
|------|------|------|
| `AuthStorage` | 类 | API Key 和 OAuth Token 的持久化存储。`AuthStorage.create()` 从 `~/.pi/agent/auth.json` 加载；`setRuntimeApiKey(provider, key)` 可在运行时覆写而不写入磁盘 |
| `ModelRegistry` | 类 | 模型注册表。`ModelRegistry.create(auth)` 加载自定义模型（`models.json`）；`ModelRegistry.inMemory(auth)` 仅使用内置模型 |

### 11.5.3 资源加载

| 导出 | 类型 | 用途 |
|------|------|------|
| `DefaultResourceLoader` | 类 | 从磁盘按约定发现 Extensions、Skills、Prompts、Themes 和 AGENTS.md |
| `ResourceLoader` | 接口/类型 | ResourceLoader 的类型定义 |
| `createEventBus` | 函数 | 创建事件总线（用于 Extension 间通信） |

### 11.5.4 会话与会话管理

| 导出 | 类型 | 用途 |
|------|------|------|
| `SessionManager` | 类 | 会话的创建、打开、继续、列出、树导航。`inMemory()` 用于测试/脚本；`create(cwd)` 用于持久化 |
| `SettingsManager` | 类 | 全局 + 项目设置的加载、合并、覆写。`create()` 从文件加载（`settings.json`）；`inMemory(settings?)` 纯内存模式 |

### 11.5.5 工具

| 导出 | 类型 | 用途 |
|------|------|------|
| `defineTool` | 函数 | 使用 TypeBox schema 定义自定义工具 |
| `createCodingTools` | 函数 | 创建完整的内置编码工具集（read/write/edit/bash） |
| `createReadOnlyTools` | 函数 | 创建只读工具集（read/grep/find/ls） |
| `createReadTool` / `createBashTool` / `createEditTool` / `createWriteTool` | 函数 | 各自创建单个内置工具 |
| `createGrepTool` / `createFindTool` / `createLsTool` | 函数 | 各自创建单个只读工具 |

### 11.5.6 运行模式

| 导出 | 类型 | 用途 |
|------|------|------|
| `InteractiveMode` | 类 | 完整 TUI 交互式模式 |
| `runPrintMode` | 函数 | 一次性问答（类似 `pi -p`） |
| `runRpcMode` | 函数 | JSONL RPC 模式（类似 `pi --mode rpc`） |
| `runJsonMode` | 函数 | JSON 事件流模式（类似 `pi --mode json`） |

### 11.5.7 常量和辅助

| 导出 | 类型 | 用途 |
|------|------|------|
| `CONFIG_DIR_NAME` | 常量 | 配置目录名称 |
| `getAgentDir` | 函数 | 获取 Agent 全局配置目录路径 |
| `getPackageDir` | 函数 | 获取包目录路径 |
| `getReadmePath` / `getDocsPath` / `getExamplesPath` | 函数 | 获取文档和示例路径 |

### 11.5.8 类型

所有 TypeScript 类型也通过入口导出，包括 `CreateAgentSessionOptions`、`CreateAgentSessionResult`、`ExtensionFactory`、`ExtensionAPI`、`ToolDefinition`、`Skill`、`PromptTemplate`、`Tool` 等。完整的类型定义请参阅第 9 章的 Extension API 文档。

## 11.6 运行模式详解

Pi 提供了四种运行模式，适合不同的使用场景：

### 11.6.1 交互式模式：`pi`（完整 TUI）

这是 Pi 的默认模式，也是第 6 章详细讲解的模式。它提供完整的终端交互界面：

```bash
pi
```

特性：
- 全功能编辑器（模糊文件搜索、Tab 补全、多行输入、图片粘贴）
- 实时流式输出（含思考过程可折叠显示）
- 斜杠命令（`/model`、`/resume`、`/new`、`/tree`、`/fork`、`/compact`、`/export` 等）
- 快捷键（Ctrl+P 切换模型、Ctrl+L 切换思考级别）
- 消息队列（steering / follow-up）
- 会话树导航（`/tree` 可视化）
- 差异化渲染（保留原生终端滚动缓冲区）

### 11.6.2 Print 模式：`pi -p`（脚本用）

一次性问答——发送提示、流式输出结果、退出进程：

```bash
pi -p "列出所有 TypeScript 文件"
```

详见 [11.8 节](#118-print-模式深入)。

### 11.6.3 JSON 模式：`--mode json`（结构化事件流）

将所有 Agent 事件以 JSONL 格式输出到 stdout：

```bash
pi --mode json "重构 src/utils.ts" 2>/dev/null
```

详见 [11.9 节](#119-json-模式深入)。

### 11.6.4 RPC 模式：`--mode rpc`（进程间通信）

通过 stdin/stdout JSONL 协议与外部进程双向通信：

```bash
pi --mode rpc --no-session
```

详见 [11.7 节](#117-rpc-模式深入)。

### 11.6.5 各模式对比表

| 维度 | 交互式 | Print | JSON | RPC |
|------|--------|-------|------|-----|
| **CLI 参数** | `pi`（默认） | `pi -p` | `pi --mode json` | `pi --mode rpc` |
| **交互性** | 完全交互（双向） | 一次性（仅输出） | 一次性（仅输出） | 完全交互（双向） |
| **输出格式** | TUI 渲染 | 纯文本 | JSONL 事件流 | JSONL 命令/事件 |
| **会话持久化** | 默认开启 | 默认关闭 | 可选 | 可选 |
| **进程间通信** | 否 | 否 | 否（仅输出） | 是（stdin/stdout） |
| **编程解析** | 困难 | 中等 | 容易 | 容易 |
| **多轮对话** | 支持 | 不支持 | 不支持 | 支持 |
| **Extension 支持** | 完整 | 无（执行后退出） | 无 | 有（Extension UI 子协议） |
| **适用场景** | 日常编码、人工使用 | CI/CD 简单检查、管道输入 | 日志管线、事件消费、监控 | IDE 集成、多语言客户端、自定义 UI |

## 11.7 RPC 模式深入

RPC 模式是 Pi 最灵活的进程间通信方式。它通过 stdin/stdout 使用 **严格的 JSONL 协议**（每条 JSON 一行，以 LF `\n` 分隔）进行双向通信。

### 11.7.1 启动 RPC 模式

```bash
# 基本启动
pi --mode rpc

# 无持久化会话（适合临时集成）
pi --mode rpc --no-session

# 指定提供商和模型
pi --mode rpc --provider anthropic --model claude-sonnet-4-20250514

# 指定会话名称
pi --mode rpc --name "my-feature-work"

# 自定义会话目录
pi --mode rpc --session-dir /tmp/pi-sessions
```

### 11.7.2 JSONL 协议说明

协议的核心规则：

1. **命令**（command）：客户端向 Pi 进程的 **stdin** 发送 JSON 对象，每行一个
2. **响应**（response）：Pi 进程向 **stdout** 输出 `{ "type": "response", "success": true/false, ... }` 表示命令执行结果
3. **事件**（event）：Pi 进程向 **stdout** 输出异步事件（`agent_start`、`message_update`、`tool_execution_end` 等）
4. **分隔符**：严格使用 LF `\n` 作为记录分隔符。`\r\n` 也兼容（会自动去除尾部 `\r`）
5. **请求/响应关联**：命令可携带可选的 `id` 字段，响应会包含相同 `id`

> **重要提醒**：不要用 Node.js 的 `readline` 模块来解析 RPC 输出！`readline` 会把 Unicode 行分隔符（U+2028、U+2029）当做换行处理，而这些字符在 JSON 字符串中是合法的。你应该自己实现基于 `\n` 的行切分。

### 11.7.3 命令（Commands）

所有命令都是形如 `{"type": "<命令名>", ...}` 的 JSON 对象。以下是完整命令列表：

#### prompt——发送提示

```json
{"id": "req-1", "type": "prompt", "message": "你好，世界！"}
```

携带图片：

```json
{
  "type": "prompt",
  "message": "这张图片有什么问题？",
  "images": [{"type": "image", "data": "base64-data...", "mimeType": "image/png"}]
}
```

流式输出期间发送（必须指定 `streamingBehavior`）：

```json
{"type": "prompt", "message": "换个方向", "streamingBehavior": "steer"}
{"type": "prompt", "message": "追加任务", "streamingBehavior": "followUp"}
```

响应：

```json
{"id": "req-1", "type": "response", "command": "prompt", "success": true}
```

`success: true` 表示提示已被接受。失败发生在接受之后时，通过正常事件和消息流报告，而非第二次响应。

#### steer / follow_up

在 Agent 流式输出期间排队消息的标准方式：

```json
{"type": "steer", "message": "停下来，先修这个 bug"}
{"type": "follow_up", "message": "完成后再写测试"}
```

#### abort——中止

```json
{"type": "abort"}
```

#### get_state——获取状态

```json
{"type": "get_state"}
```

响应包含模型、思考级别、流式状态、压缩状态、消息数量等：

```json
{
  "type": "response", "command": "get_state", "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

#### get_messages——获取所有消息

```json
{"type": "get_messages"}
```

#### set_model / cycle_model / get_available_models——模型管理

```json
{"type": "set_model", "provider": "anthropic", "modelId": "claude-sonnet-4-20250514"}
{"type": "cycle_model"}
{"type": "get_available_models"}
```

#### set_thinking_level / cycle_thinking_level——思考控制

```json
{"type": "set_thinking_level", "level": "high"}
{"type": "cycle_thinking_level"}
```

思考级别：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`（`xhigh` 仅 OpenAI codex-max 支持）。

#### compact——手动压缩上下文

```json
{"type": "compact"}
{"type": "compact", "customInstructions": "重点保留数据库相关讨论"}
```

响应包含压缩前后 token 对比：

```json
{
  "type": "response", "command": "compact", "success": true,
  "data": {
    "summary": "本会话主要讨论了数据迁移方案...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "details": {}
  }
}
```

#### set_auto_compaction——启用/禁用自动压缩

```json
{"type": "set_auto_compaction", "enabled": true}
```

#### set_auto_retry / abort_retry——重试控制

```json
{"type": "set_auto_retry", "enabled": true}
{"type": "abort_retry"}
```

#### set_steering_mode / set_follow_up_mode——排队模式

```json
// steering: "all"（攒够一批投递）| "one-at-a-time"（一次一条，默认）
{"type": "set_steering_mode", "mode": "one-at-a-time"}

// followUp: "all"（Agent 停止后全部投递）| "one-at-a-time"（默认）
{"type": "set_follow_up_mode", "mode": "one-at-a-time"}
```

#### bash——执行命令

```json
{"type": "bash", "command": "ls -la"}
```

响应包含输出、退出码和截断信息：

```json
{
  "type": "response", "command": "bash", "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

`bash` 的执行结果会被创建为一个 `BashExecutionMessage` 存入 Agent 的消息状态，并在**下一次 `prompt` 发送时**转换后注入 LLM 上下文。

#### 会话管理命令

| 命令 | 描述 |
|------|------|
| `new_session` | 创建新会话（可传 `parentSession` 关联父会话） |
| `switch_session` | 切换到指定 JSONL 文件（`sessionPath` 字段） |
| `fork` | 从指定历史消息创建分支（`entryId` 字段） |
| `clone` | 在当前位置克隆当前分支到新会话文件 |
| `get_fork_messages` | 获取可分支的用户消息列表 |
| `get_entries` | 获取会话条目（支持 `since` 游标增量拉取） |
| `get_tree` | 获取会话的树形结构 |
| `get_last_assistant_text` | 获取最后一条助手消息的文本内容 |
| `set_session_name` | 设置会话显示名称 |
| `get_session_stats` | 获取 token 使用、成本、上下文窗口统计 |
| `export_html` | 导出会话为 HTML 文件 |
| `get_commands` | 获取可用的扩展命令/Prompt Template/Skills 列表 |

### 11.7.4 事件（Events）

事件是 Agent 在运行过程中向 stdout 输出的 JSON 对象。**事件不带 `id` 字段**（只有响应带）。

#### 核心事件类型

| 事件 | 描述 |
|------|------|
| `agent_start` | Agent 开始处理提示 |
| `agent_end` | Agent 处理完成，`messages` 字段包含本轮产生的所有新消息 |
| `turn_start` | 新轮次开始（一次 LLM 响应 + 其工具调用为一个轮次） |
| `turn_end` | 轮次结束（`message` 为助手响应，`toolResults` 为工具结果数组） |
| `message_start` | 消息开始 |
| `message_update` | 流式更新——核心事件！`assistantMessageEvent` 子类型见下文 |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始执行（`toolName` + `args`） |
| `tool_execution_update` | 工具执行进度（`partialResult` 为累积输出，非增量） |
| `tool_execution_end` | 工具执行完成（`result` + `isError`） |
| `queue_update` | 待处理的 steering/follow-up 队列发生变化 |
| `compaction_start` / `compaction_end` | 上下文压缩开始/完成 |
| `auto_retry_start` / `auto_retry_end` | 自动重试开始/结束 |
| `extension_error` | Extension 抛出异常 |

#### `message_update` 的 `assistantMessageEvent` 子类型

这是流式输出中最重要的事件。其 `assistantMessageEvent.type` 有以下取值：

| 子类型 | 含义 | 字段 |
|--------|------|------|
| `text_start` | 文本块开始 | `contentIndex` |
| `text_delta` | 文本块新字符 | `contentIndex` + `delta`（新增片段） |
| `text_end` | 文本块结束 | `contentIndex` + `content`（完整文本） |
| `thinking_start` | 思考块开始 | — |
| `thinking_delta` | 思考块新字符 | `delta` |
| `thinking_end` | 思考块结束 | — |
| `toolcall_start` | 工具调用开始 | — |
| `toolcall_delta` | 工具调用参数流式片段 | `delta` |
| `toolcall_end` | 工具调用结束 | `toolCall`（完整对象：`{id, name, arguments}`） |
| `start` | 消息生成开始 | — |
| `done` | 消息完成 | `reason`: `"stop"` \| `"length"` \| `"toolUse"` |
| `error` | 出错中止 | `reason`: `"aborted"` \| `"error"` |

### 11.7.5 扩展 UI 子协议（Extension UI Protocol）

在 RPC 模式下，Extensions 仍然可以通过 `ctx.ui.select()`、`ctx.ui.confirm()` 等方法请求用户交互。Pi 通过一个**请求/响应子协议**实现这一点：

- **对话框方法**（`select`、`confirm`、`input`、`editor`）：Pi 向 stdout 发送 `extension_ui_request`，**阻塞等待**客户端从 stdin 返回 `extension_ui_response`
- **Fire-and-forget 方法**（`notify`、`setStatus`、`setWidget`、`setTitle`、`set_editor_text`）：Pi 向 stdout 发送 `extension_ui_request`，不等待响应

#### 示例：select 请求/响应

```json
// Pi → 客户端（stdout）
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "允许执行危险命令？",
  "options": ["允许", "拒绝"],
  "timeout": 10000
}

// 客户端 → Pi（stdin）
{"type": "extension_ui_response", "id": "uuid-1", "value": "允许"}
```

#### 示例：confirm 请求/响应

```json
// Pi → 客户端（stdout）
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "确认清理？",
  "message": "所有消息将丢失。",
  "timeout": 5000
}

// 客户端 → Pi（stdin）
{"type": "extension_ui_response", "id": "uuid-2", "confirmed": true}
```

#### Fire-and-forget 示例：notify

```json
// Pi → 客户端（stdout），不期待响应
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "命令已被用户拒绝",
  "notifyType": "warning"
}
```

#### 取消对话框

```json
{"type": "extension_ui_response", "id": "uuid-3", "cancelled": true}
```

取消后，Extension 的 `select()`/`input()`/`editor()` 收到 `undefined`，`confirm()` 收到 `false`。

#### RPC 模式下不可用的 UI 方法

某些 Extension UI 方法在 RPC 模式下会被降级或变为空操作：

- `custom()` → 返回 `undefined`
- `setWorkingMessage()`、`setWorkingIndicator()`、`setFooter()`、`setHeader()`、`setEditorComponent()`、`setToolsExpanded()` → 空操作
- `getEditorText()` → 返回 `""`
- `getToolsExpanded()` → 返回 `false`
- `getAllThemes()` → 返回 `[]`
- `getTheme()` → 返回 `undefined`
- `setTheme()` → 返回 `{ success: false, error: "..." }`

`ctx.mode` 在 RPC 模式下为 `"rpc"`，`ctx.hasUI` 为 `true`（因为对话框和 fire-and-forget 方法可用）。如需检测是否存在真正的 TUI，使用 `ctx.mode === "tui"`。

### 11.7.6 Python 集成示例

```python
import subprocess
import json

proc = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)

def send(cmd):
    proc.stdin.write(json.dumps(cmd) + "\n")
    proc.stdin.flush()

def read_events():
    for line in proc.stdout:
        yield json.loads(line)

# 发送提示
send({"type": "prompt", "message": "你好！列出当前目录的文件"})

# 处理事件流
for event in read_events():
    event_type = event.get("type")

    # 流式文本输出
    if event_type == "message_update":
        delta = event.get("assistantMessageEvent", {})
        if delta.get("type") == "text_delta":
            print(delta["delta"], end="", flush=True)

    # 工具调用
    if event_type == "tool_execution_start":
        print(f"\n[工具调用] {event['toolName']}")

    # Agent 完成
    if event_type == "agent_end":
        print("\n[Agent 完成]")
        break
```

### 11.7.7 Node.js 集成示例

Node.js 中处理 RPC 模式的关键在于**正确的 JSONL 行切分**（不要用 `readline`）：

```javascript
const { spawn } = require("child_process");
const { StringDecoder } = require("string_decoder");

const agent = spawn("pi", ["--mode", "rpc", "--no-session"]);

// 正确的 JSONL 解析器（只按 \n 分隔）
function attachJsonlReader(stream, onLine) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) break;

      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      onLine(line);
    }
  });

  stream.on("end", () => {
    buffer += decoder.end();
    if (buffer.length > 0) {
      onLine(buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer);
    }
  });
}

// 处理事件
attachJsonlReader(agent.stdout, (line) => {
  const event = JSON.parse(line);

  if (event.type === "message_update") {
    const { assistantMessageEvent } = event;
    if (assistantMessageEvent.type === "text_delta") {
      process.stdout.write(assistantMessageEvent.delta);
    }
  }

  if (event.type === "agent_end") {
    console.log("\n[Done]");
  }
});

// 发送命令
agent.stdin.write(JSON.stringify({
  type: "prompt",
  message: "列出所有 .ts 文件"
}) + "\n");

// Ctrl+C 中止
process.on("SIGINT", () => {
  agent.stdin.write(JSON.stringify({ type: "abort" }) + "\n");
});
```

## 11.8 Print 模式深入

Print 模式（`-p`）是 Pi 的**一次性问答模式**：发送提示、流式输出结果、退出。它是最简单的非交互式使用方式。

### 11.8.1 基本用法

```bash
# 简单问答
pi -p "列出当前目录的 .ts 文件"

# 多步骤（多条消息依次执行）
pi -p "找到所有 TODO 注释" -p "总结代码中的技术债务"

# 指定模型
pi -p --model anthropic/claude-sonnet-4-20250514 "解释这个项目结构"
```

`-p` 可以重复使用多条，每条在 Agent 上一条的输出完成后执行。

### 11.8.2 管道输入

Print 模式支持从 stdin 读取提示：

```bash
# 从文件读取提示
cat prompt.txt | pi -p

# 从管道获取上下文
git diff HEAD~1 | pi -p "审查这次 diff 的变更，指出潜在问题"

# 结合其他命令
find src -name "*.ts" | wc -l | pi -p "我们项目有多少 TS 文件？请给出解释"
```

### 11.8.3 CI/CD 集成示例

Print 模式非常适合 CI/CD 管道中的一次性检查：

```bash
# 代码风格检查（返回文本结果）
pi -p "检查代码风格并给出建议" 2>/dev/null

# 生成变更总结
git log --oneline HEAD~5..HEAD | pi -p "总结这 5 个 commit 的关键变更"
```

### 11.8.4 GitHub Actions 示例

```yaml
name: AI Code Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install Pi
        run: npm install -g --ignore-scripts @earendil-works/pi-coding-agent

      - name: Run Pi Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          git diff origin/main..HEAD > /tmp/diff.txt
          pi -p --model anthropic/claude-sonnet-4-20250514 "审查以下 diff，重点关注安全问题、性能问题和逻辑错误。给出具体建议。" < /tmp/diff.txt > /tmp/review.txt 2>/dev/null
          cat /tmp/review.txt >> $GITHUB_STEP_SUMMARY
```

### 11.8.5 Print 模式的 SDK 版本

在 TypeScript 中直接调用 `runPrintMode()`：

```typescript
import { runPrintMode } from "@earendil-works/pi-coding-agent";

await runPrintMode(runtime, {
  mode: "text",                         // 输出格式: "text"
  initialMessage: "审查 src/utils.ts",   // 第一条提示
  initialImages: [],                     // 附带图片
  messages: ["再给出重构建议"],          // 后续提示
});
```

## 11.9 JSON 模式深入

JSON 模式（`--mode json`）将所有会话事件以 JSONL 格式输出到 stdout，适合需要**结构化解析** Agent 行为的场景。

### 11.9.1 基本用法

```bash
pi --mode json "列出所有 TypeScript 文件" 2>/dev/null
```

输出是一个 JSONL 流：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"...","cwd":"/path"}
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"assistant","content":[],...}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_delta","delta":"我来","partial":{...}}}
{"type":"message_update","message":{...},"assistantMessageEvent":{"type":"text_delta","delta":"列出","partial":{...}}}
...
{"type":"message_end","message":{...}}
{"type":"turn_end","message":{...},"toolResults":[]}
{"type":"agent_end","messages":[...]}
```

### 11.9.2 与 jq 结合进行事件过滤

```bash
# 提取所有文本响应
pi --mode json "分析项目结构" 2>/dev/null | jq -c 'select(.type == "message_end") | .message.content[] | select(.type == "text") | .text'

# 只关注工具调用
pi --mode json "修复 lint 错误" 2>/dev/null | jq -c 'select(.type == "tool_execution_start") | {tool: .toolName, args: .args}'

# 统计 token 使用
pi --mode json "重构代码" 2>/dev/null | jq -c 'select(.type == "agent_end") | .messages[] | select(.role == "assistant") | .usage'
```

### 11.9.3 事件类型

JSON 模式使用的事件类型与 RPC 模式共享同一套定义（参见 [11.7.4 节](#1174-事件events)），包括：`agent_start`、`agent_end`、`turn_start`、`turn_end`、`message_start`、`message_update`、`message_end`、`tool_execution_start`、`tool_execution_update`、`tool_execution_end`、`queue_update`、`compaction_start`、`compaction_end`、`auto_retry_start`、`auto_retry_end`。

首行总是 `type: "session"` 的会话头。

### 11.9.4 编程解析示例

```typescript
import { spawn } from "child_process";

const pi = spawn("pi", ["--mode", "json", "分析 src/index.ts"]);

// 按行解析 JSONL（同上，不要用 readline）
let buffer = "";
pi.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);

    switch (event.type) {
      case "message_update":
        if (event.assistantMessageEvent?.type === "text_delta") {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;
      case "tool_execution_end":
        console.log(`\n[Tool ${event.toolName}] isError=${event.isError}`);
        break;
    }
  }
});
```

### 11.9.5 JSON 模式 vs Print 模式

| 维度 | Print 模式 (`-p`) | JSON 模式 (`--mode json`) |
|------|-------------------|---------------------------|
| 输出内容 | 纯文本（模型响应） | JSONL 结构化事件流 |
| 编程解析 | 较难（正则/字符串匹配） | 容易（每行一个 JSON） |
| 信息量 | 仅有模型文本输出 | 包含所有内部事件（工具调用、token 使用、压缩等） |
| 适用场景 | 简单一次性问答、给人类看结果 | 日志管线、自动化管道、事件驱动的下游系统 |

## 11.10 实战案例

### 11.10.1 案例 1：批量代码审查脚本

用 SDK 实现一个批量代码审查脚本，扫描项目中所有待审查的文件：

```typescript
import { getModel } from "@earendil-works/pi-ai";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

async function reviewFiles(dir: string) {
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  const model = getModel("anthropic", "claude-sonnet-4-20250514");
  if (!model) throw new Error("模型未找到");

  const files = readdirSync(dir, { recursive: true })
    .filter(f => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map(f => join(dir, f));

  const results: Record<string, string> = {};

  for (const file of files.slice(0, 5)) {  // 限制 5 个文件避免超时
    const content = readFileSync(file, "utf-8");
    const { session } = await createAgentSession({
      model,
      authStorage,
      modelRegistry,
      thinkingLevel: "medium",
      sessionManager: SessionManager.inMemory(),
    });

    let review = "";
    session.subscribe((event) => {
      if (event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta") {
        review += event.assistantMessageEvent.delta;
      }
    });

    console.log(`[审查] ${file}`);
    await session.prompt(`审查以下代码，重点关注安全隐患、逻辑错误和性能问题。给出简明建议。\n\n\`\`\`typescript\n${content}\n\`\`\``);
    results[file] = review;
    session.dispose();
  }

  // 汇总报告
  const report = Object.entries(results)
    .map(([file, review]) => `## ${file}\n\n${review}\n`)
    .join("\n---\n\n");
  writeFileSync("review-report.md", report);
  console.log("审查报告已保存到 review-report.md");
}

reviewFiles("./src").catch(console.error);
```

### 11.10.2 案例 2：CI/CD 集成自动修复

通过 RPC 模式在 CI 中实现"发现 lint 错误 → 自动修复 → 提交 PR 建议"的流程（Python 版）：

```python
#!/usr/bin/env python3
"""CI 自动修复脚本：检测 lint 错误并用 Pi 自动修复"""

import subprocess
import json
import sys
import os


def run_lint():
    """运行 lint 检查"""
    result = subprocess.run(
        ["npx", "eslint", "src/", "--format", "json"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        return None  # 无错误
    return result.stdout


def fix_with_pi(issues: str) -> str:
    """通过 RPC 模式让 Pi 修复问题"""
    proc = subprocess.Popen(
        ["pi", "--mode", "rpc", "--no-session",
         "--model", "anthropic/claude-sonnet-4-20250514"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        env={**os.environ, "ANTHROPIC_API_KEY": os.environ["ANTHROPIC_API_KEY"]}
    )

    def send(cmd):
        proc.stdin.write(json.dumps(cmd) + "\n")
        proc.stdin.flush()

    send({
        "type": "prompt",
        "message": (
            "以下 ESLint 报错需要你逐条修复。"
            "对于每个问题，使用 edit 工具进行精确修改。"
            "完成后列出所有你做的修改。\n\n"
            f"ESLint 报告：\n```json\n{issues}\n```"
        )
    })

    fixes = []
    for line in proc.stdout:
        event = json.loads(line)

        if event.get("type") == "message_update":
            delta = event.get("assistantMessageEvent", {})
            if delta.get("type") == "text_delta":
                fixes.append(delta["delta"])
                print(delta["delta"], end="", flush=True)

        if event.get("type") == "agent_end":
            break

    proc.stdin.close()
    proc.wait()
    return "".join(fixes)


def main():
    print("[CI] 运行 ESLint 检查...")
    issues = run_lint()

    if issues is None:
        print("[CI] 没有 lint 错误，通过！")
        sys.exit(0)

    print(f"[CI] 发现 lint 错误，启动 Pi 自动修复...")
    fix_report = fix_with_pi(issues)

    # 检查是否有修改
    result = subprocess.run(["git", "diff", "--stat"], capture_output=True, text=True)
    if result.stdout.strip():
        print(f"\n[CI] 修改汇总:\n{result.stdout}")
        print("\n[CI] Pi 已自动修复 lint 错误。请审查修改后合并。")
    else:
        print("\n[CI] 没有文件被修改（可能需要人工介入）")


if __name__ == "__main__":
    main()
```

### 11.10.3 案例 3：Python 项目集成 Pi

虽然 Pi 是 TypeScript 生态，但通过 RPC 模式，Python 项目可以像使用一个库一样调用 Pi。下面是一个 Python 封装类：

```python
"""pi_client.py —— Pi RPC 模式的 Python 封装"""

import subprocess
import json
import threading
from typing import Callable, Optional


class PiClient:
    """Pi RPC 客户端的 Python 封装"""

    def __init__(
        self,
        provider: str = "anthropic",
        model: str = "claude-sonnet-4-20250514",
        session_dir: Optional[str] = None,
    ):
        args = [
            "pi", "--mode", "rpc",
            "--provider", provider,
            "--model", model,
        ]
        if session_dir:
            args.extend(["--session-dir", session_dir])
        else:
            args.append("--no-session")

        self.proc = subprocess.Popen(
            args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
        )
        self._listeners: list[Callable] = []
        self._reader_thread = threading.Thread(target=self._read_events, daemon=True)
        self._reader_thread.start()

    def _read_events(self):
        """后台线程读取事件"""
        for line in self.proc.stdout:
            try:
                event = json.loads(line)
                for listener in self._listeners:
                    listener(event)
            except json.JSONDecodeError:
                pass

    def on_event(self, listener: Callable):
        """注册事件监听器"""
        self._listeners.append(listener)

    def send(self, cmd: dict) -> dict:
        """发送命令并等待响应"""
        self.proc.stdin.write(json.dumps(cmd) + "\n")
        self.proc.stdin.flush()

        # 等待对应的响应（简化版：不按 id 匹配）
        for line in self.proc.stdout:
            event = json.loads(line)
            if event.get("type") == "response":
                return event

    def prompt(self, message: str, images=None) -> dict:
        """发送提示"""
        cmd = {"type": "prompt", "message": message}
        if images:
            cmd["images"] = images
        return self.send(cmd)

    def abort(self):
        """中止当前操作"""
        self.send({"type": "abort"})

    def close(self):
        """关闭客户端"""
        self.proc.stdin.close()
        self.proc.wait()


# 使用示例
if __name__ == "__main__":
    client = PiClient()

    def print_text(event):
        if event.get("type") == "message_update":
            delta = event.get("assistantMessageEvent", {})
            if delta.get("type") == "text_delta":
                print(delta["delta"], end="", flush=True)

    client.on_event(print_text)
    client.prompt("用 Python 实现一个简单的 HTTP 服务器")

    # 保持程序运行直到 Agent 结束
    import time; time.sleep(30)
    client.close()
```

## 11.11 本章小结

本章我们全面覆盖了 Pi 的四种编程式使用方式：

- **SDK 嵌入**（`createAgentSession`）是 TypeScript/Node.js 生态中最高效、类型安全、功能最完整的方式。通过 `AgentSession` 接口你可以完全控制 Agent 的生命周期、事件订阅、模型切换和上下文压缩。通过 `AgentSessionRuntime` 你可以在进程中实现 `/new`、`/resume`、`/fork` 等会话替换能力。

- **RPC 模式**（`--mode rpc`）是跨语言集成的最佳选择。它通过严格的 stdin/stdout JSONL 协议实现了完整的命令/事件双向通信，并包含 Extension UI 请求/响应子协议。Python、Rust、Go 等任何支持 subprocess 和 JSON 的语言都可以像使用一个"Agent 服务"一样调用 Pi。

- **Print 模式**（`-p`）是最简单的非交互使用方式。适合 CI/CD 管道、一次性问答、管道输入输出等场景。一条命令、一个结果、进程退出——没有比这更简单的了。

- **JSON 模式**（`--mode json`）将 Agent 的内部事件以结构化 JSONL 输出，适合需要编程解析 Agent 行为的下游系统：日志管线、监控面板、行为分析工具。

选择哪种方式，取决于你的场景：

| 场景 | 推荐方式 |
|------|----------|
| TypeScript/Node.js 项目，需要极致的类型安全和性能 | SDK |
| Python/Rust/Go 等非 JS 语言集成 | RPC 模式 |
| 简单的 CI/CD 一次性检查或代码审查 | Print 模式（`-p`） |
| 构建日志管线、事件消费、监控面板 | JSON 模式（`--mode json`） |
| 构建完整的自定义 UI（Web、桌面等） | RPC 模式（语言无关）或 SDK（Node.js 后端） |
| 测试 Agent 行为、单元测试 | SDK（`SessionManager.inMemory()`） |

下一章：[第十二章：容器化与安全沙箱](12-容器化与安全沙箱) 将探讨 Pi 的容器化与安全沙箱方案——当你不信任 Agent 的 YOLO 模式、或者需要在多租户环境中安全运行时，如何用 Docker、Gondolin 微 VM 和 OpenShell 策略沙箱来隔离 Pi 的运行环境。

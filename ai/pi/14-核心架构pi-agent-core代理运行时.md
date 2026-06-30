---
layout: default
title: 第十四章：核心架构：pi-agent-core 代理运行时
---

# 第十四章：核心架构：pi-agent-core 代理运行时

> 本章深入 Pi monorepo 的第二个核心包——`pi-agent-core`。你将理解 Agent 类的完整生命周期（从构造函数到 `waitForIdle()`）、状态管理（`agent.state` + `agent.reset()`）、基于消息队列的 Steering/Follow-up 投递机制、事件订阅系统、Agent Loop 的底层循环控制流、工具编排（并行/顺序执行 + 钩子拦截）、上下文工程（消息修剪/格式转换/系统提示注入）、传输层抽象（直接模式与 Proxy 模式），以及 Harness 测试工具的设计。读完本章，你将对 Pi 如何将"一次 LLM 调用"变成"一个运行中的 Agent 进程"有源码级的理解。

## 14.1 pi-agent-core 包概述

### 14.1.1 在 monorepo 中的位置

Pi 的 monorepo 结构在第一章（[1.4.2](01-项目概览与核心定位#142-技术架构typescript-monorepo5-个核心包)）中已做全景介绍。`pi-agent-core` 是五个核心包中的第二个，物理路径为：

```
pi/
├── packages/
│   ├── ai/          # pi-ai：统一 LLM API 层
│   ├── agent/       # pi-agent-core：本章主角
│   ├── coding-agent/# pi-coding-agent：交互式 CLI
│   ├── tui/         # pi-tui：终端 UI 库
│   └── orchestrator/# pi-orchestrator：工作流编排
```

npm 包名为 **`@earendil-works/pi-agent-core`**。它没有独立的用户可执行入口——你永远不会在命令行中直接调用它。它的全部价值在于被 `pi-coding-agent`（交互式 CLI）、SDK 嵌入代码（`createAgentSession`）、以及 RPC 服务端消费。

### 14.1.2 核心使命：有状态代理，带工具调用和事件流

`pi-agent-core` 的核心使命可以用一句话概括：

> **持有一个有状态的 Agent 实例，通过内部循环（Agent Loop）不断与 LLM 交互直到任务完成，期间协调工具调用、管理消息队列、发出事件流。**

展开来说，这个包负责以下所有事情：

| 职责 | 说明 |
|------|------|
| **Agent 生命周期** | 构造、启动、暂停、继续、中止、重置 |
| **状态管理** | 维护 systemPrompt、model、tools、messages 等全部状态，支持快照与重置 |
| **Agent Loop 控制流** | 主循环：发送消息 → 等待 LLM 响应 → 解析工具调用 → 执行工具 → 将结果发回 LLM → 循环 |
| **消息队列** | 支持 Steering（控制注入）和 Follow-up（跟进消息）两种投递模式 |
| **事件系统** | 基于 Observer 模式的事件发布/订阅，暴露 Agent 运行时的每一个状态变化 |
| **工具编排** | 支持并行 (`"parallel"`) 和顺序 (`"sequential"`) 两种工具执行策略，提供 beforeToolCall/afterToolCall 钩子 |
| **上下文工程** | 在发送给 LLM 之前对消息进行修剪/压缩（`transformContext`），以及格式转换（`convertToLlm`） |
| **传输层抽象** | 支持直接运行和 stream 代理（Proxy）两种传输模式 |
| **附件处理** | 图片、文件等附件的注入与管理 |

一句话：**`pi-ai` 负责"调哪个 LLM、怎么调"，`pi-agent-core` 负责"Agent 怎么运转"**。二者之间的关系就像引擎与传动系统：引擎提供动力（LLM 调用），传动系统决定动力如何传递到车轮（任务如何推进）。

### 14.1.3 与 pi-ai 的关系

在开始源码分析之前，先明确 `pi-agent-core` 和 `pi-ai`（第十三章）之间的依赖关系：

```
pi-agent-core
  ├── 依赖 pi-ai（调用 LLM、获取流式响应）
  ├── 依赖 TypeBox + AJV（工具参数验证）
  ├── 不依赖 pi-coding-agent（CLI 层）
  ├── 不依赖 pi-tui（UI 层）
  └── 被 pi-coding-agent 和 SDK 消费
```

这意味着 `pi-agent-core` 是一个**纯逻辑层**——它不涉及任何终端渲染、文件系统操作或用户交互逻辑。你可以把它嵌入到不带终端的 Node.js 程序中，通过 SDK 驱动一个"无头"（headless）的 Agent。

---

## 14.2 核心文件结构

进入 `packages/agent/src/` 目录，核心文件布局如下：

```
agent/src/
├── agent.ts             # Agent 类的主入口
├── agent-loop.ts        # agentLoop() / agentLoopContinue() 循环实现
├── types.ts             # 代理类型定义
├── proxy.ts             # 代理代理（stream proxy）
├── harness/             # 测试/开发辅助工具
│   ├── index.ts
│   └── ...
└── utils/               # 内部工具函数
```

### 14.2.1 `agent.ts` — Agent 类

这是用户面对的唯一公共 API。导出 `Agent` 类，它封装了构造、`prompt()`、`continue()`、`abort()`、`waitForIdle()`、`subscribe()`、`steer()`、`followUp()`、`reset()` 等全部公共方法。每个方法的具体语义将在 14.3～14.6 节逐一展开。

### 14.2.2 `agent-loop.ts` — 循环引擎

这个文件实现了 Agent 的核心心跳：`agentLoop()` 和 `agentLoopContinue()`。前者用于启动一条全新的 Agent 循环（从用户的 prompt 开始），后者用于在已存在的循环中恢复执行（如工具调用完成后继续）。这两个函数内部处理了 LLM 调用 → 响应解析 → 工具检测与执行 → 结果回传 → 循环继续 的完整控制流。

### 14.2.3 `types.ts` — 类型定义

包含 `AgentConfig`（构造函数参数）、`AgentState`（运行时可读取的状态对象）、`AgentEvent`（事件类型联合体）、`SteeringMessage` / `FollowUpMessage`（消息队列元素）、`ToolCallEvent` / `ToolResultEvent`（工具相关事件）等所有外部可见的类型定义。这些类型是理解 Agent 行为的入口。

### 14.2.4 `proxy.ts` — Stream Proxy

Stream Proxy 是一种传输层模式：Agent 不直接持有 LLM 连接，而是通过一个中介（Proxy）转发请求和响应流。这在以下场景非常有用：

- **多客户端共享同一个 Agent 实例**（如一个后端进程驱动多个 Web 会话）
- **跨进程通信**（Agent 在一个进程中，TUI 在另一个进程中）
- **RPC 模式**（见第十一章，Agent 通过 stdin/stdout JSONL 暴露给外部进程）

### 14.2.5 `harness/` — 测试工具

`harness/` 目录提供了一套专门为 `pi-agent-core` 设计的测试和开发辅助工具。它不是面向最终用户的，而是面向**扩展开发者**和 **Pi 核心贡献者**的——让你在不启动完整 TUI 的情况下就能对 Agent 进行单元测试和集成测试。

---

## 14.3 Agent 类详解

### 14.3.1 构造函数参数

`Agent` 的构造函数接受一个 `AgentConfig` 对象。以下是完整参数列表及其语义：

```typescript
interface AgentConfig {
  initialState?: {
    systemPrompt?: string;        // 系统提示词
    model?: string;               // 模型标识符，如 "anthropic/claude-sonnet-4"
    tools?: Tool[];               // 可用工具定义数组
    thinkingLevel?: number;       // 思考深度（0 = 禁用，数字越大思考越多）
    messages?: Message[];         // 初始消息历史（用于恢复已有会话）
  };

  convertToLlm?: (messages: Message[]) => LlmInput;
  // 将 Pi 内部消息格式转换为 LLM 供应商接受的格式
  // 默认实现将 system / user / assistant / tool_result 消息映射为
  // OpenAI Chat Completions 格式（由 pi-ai 进一步适配到各供应商）

  transformContext?: (messages: Message[]) => Promise<Message[]>;
  // 异步消息修剪/压缩函数
  // 在每次发送给 LLM 之前调用，用于控制上下文窗口大小
  // 典型实现：保留前 N 条消息 + 当前对话窗口 + 系统提示词快照

  toolExecution?: "parallel" | "sequential";
  // 工具执行策略，默认为 "parallel"
  // "parallel"：LLM 一次返回的所有工具调用并发执行
  // "sequential"：LLM 一次返回的工具调用按顺序逐个执行
  // 注意：无论哪种模式，工具内部的执行（如 bash 命令）总是异步的

  beforeToolCall?: (event: ToolCallEvent) => Promise<ToolCallEvent | void>;
  // 工具执行前钩子
  // 可以修改工具参数（如路径规范化）、注入额外参数、或阻止调用（返回 void 等价于跳过）
  // 典型用途：权限检查、路径沙箱、审计日志

  afterToolCall?: (event: ToolResultEvent) => Promise<ToolResultEvent | void>;
  // 工具执行后钩子
  // 可以修改工具返回结果（如裁剪过长输出）、注入结果摘要、或完全替换结果
  // 典型用途：敏感信息脱敏、输出截断、结果缓存

  abortController?: AbortController;
  // 可选的外部 AbortController，用于从外部取消 Agent 的当前操作
}
```

每个参数的设计理由：

- **`initialState`**：Agent 启动时的初始快照。`systemPrompt` 和 `model` 是必须的（否则 Agent 不知道"作为谁"和"用哪个模型"），`tools` 决定了模型能做什么，`thinkingLevel` 控制推理深度，`messages` 用于恢复已有会话。

- **`convertToLlm`**：Pi 内部使用统一的消息格式（包含 `role`、`content`、`tool_calls`、`tool_call_id` 等字段），但不同 LLM 供应商期望的格式不同。`convertToLlm` 将内部格式转换为各供应商可接受的格式，然后由 `pi-ai` 进一步适配 API 差异。这种"两阶段转换"的设计让 pi-agent-core 完全不感知供应商细节——它只知道"调用 LLM"，其余全部委托给 `pi-ai` 和 `convertToLlm`。

- **`transformContext`**：这是上下文工程的关键入口。在每次 Agent 循环发送消息给 LLM 之前，`transformContext` 被调用，返回值就是最终发往 LLM 的消息数组。典型实现包括：滑动窗口（保留最近 N 轮对话）、摘要压缩（长对话自动生成摘要）、消息去重（移除非必要 message）。

- **`toolExecution`**：控制工具调用的并发策略。`"parallel"` 模式下模型可能在一次响应中要求调用 3 个工具——Agent 会同时发出这 3 个调用，等待全部完成后将结果一起传回 LLM。`"sequential"` 模式下则按 LLM 返回的顺序逐个执行，前一个工具的结果可能影响下一个工具的参数（需要注意：LLM 已经决定好了所有工具调用，顺序执行只能影响工具的副作用，而不能改变已经确定的工具调用序列）。

- **`beforeToolCall` / `afterToolCall`**：这两个钩子是对工具调用的观测和修改点。它们是**同步等待（await）** 的——Agent 在工具执行前会 await `beforeToolCall`，执行后会 await `afterToolCall`。这意味着你可以在这些钩子中做任意异步操作（数据库查询、网络请求、用户确认弹窗），Agent 会完全等待。

- **`abortController`**：提供外部取消能力。当你调用 `agent.abort()` 时，内部会触发这个 controller 的 `abort()` 信号，导致当前正在发出的 LLM 请求被取消（如果底层 transport 支持 `AbortSignal`）。

### 14.3.2 公共方法

Agent 类暴露以下公共方法：

#### `agent.prompt(text: string, attachments?: Attachment[]): Promise<void>`

启动一次新的用户交互。这是最常见的使用方式：用户输入一段文本（可附带图片或文件附件），Agent 开始处理。

```typescript
await agent.prompt("帮我重命名这个函数，把所有调用处一起改掉");
```

调用 `prompt()` 后，Agent 内部启动一轮或多轮 `agentLoop()`，直到模型不再返回工具调用（即任务完成）或发生错误。`prompt()` 返回的 Promise 在 Agent 进入空闲状态（Idle）时 resolve。

**注意**：`prompt()` 的语义是"发起一轮新的对话轮次"。如果 Agent 当前正在处理中（非 Idle 状态），再次调用 `prompt()` 会将新消息放入 Steering 队列（见 14.5 节）。

#### `agent.continue(): Promise<void>`

在某些场景下，Agent 会暂停等待外部信号——例如工具执行超时、用户手动确认操作、或 Agent 进入"需要更多信息"状态。`continue()` 通知 Agent 继续执行。

```typescript
// 场景：Agent 请求确认删除操作
// 用户在 UI 上点击"确认"后：
await agent.continue();
```

底层实现是调用 `agentLoopContinue()`，从当前循环的暂停点继续。

#### `agent.abort(): void`

立即中止当前正在运行的 LLM 请求和所有待执行的操作。`abort()` 不是优雅停止——它通过 `AbortController` 强制取消底层 API 调用，Agent 状态保持在调用 `abort()` 前的快照。

```typescript
// 模型开始无休止的"让我仔细想想……"循环
agent.abort();
// Agent 回到 Idle 状态，消息历史保留
```

**`abort()` 和 `reset()` 的区别**：`abort()` 只中止当前操作，消息历史、工具调用状态等全部保留。`reset()` 是彻底清空。

#### `agent.waitForIdle(): Promise<void>`

等待 Agent 进入空闲状态（即当前没有正在运行的循环）。适用于你需要确保 Agent 完成当前任务后再执行下一步操作的场景。

```typescript
await agent.prompt("分析这个目录下的所有文件");
await agent.waitForIdle(); // 等待 Agent 完成分析
console.log("分析完成，可以查看结果了");
```

`waitForIdle()` 返回一个 Promise，在 Agent 状态变为 `"idle"` 时 resolve。如果 Agent 当前已经 idle，Promise 立即 resolve。

---

## 14.4 状态管理

### 14.4.1 `agent.state` 属性

`agent.state` 是一个**只读**的 `AgentState` 对象，反映了 Agent 当前的完整快照：

```typescript
interface AgentState {
  systemPrompt: string;         // 当前系统提示词
  model: string;                // 当前使用的模型标识符
  tools: Tool[];                // 当前注册的工具列表
  messages: Message[];          // 完整消息历史（包含 system/user/assistant/tool_result）
  status: "idle" | "running";  // Agent 当前运行状态
  error?: Error;                // 如果上次运行失败，此处存储错误对象
}
```

你可以随时读取 `agent.state` 来获取 Agent 的当前状态：

```typescript
console.log(`当前模型：${agent.state.model}`);
console.log(`消息数量：${agent.state.messages.length}`);
console.log(`Agent 状态：${agent.state.status}`);

// 遍历工具列表
for (const tool of agent.state.tools) {
  console.log(`  - ${tool.name}: ${tool.description}`);
}
```

几条关键约束：

- `state` 是**只读快照**——你不能通过 `agent.state.model = "xxx"` 来切换模型。修改状态需要通过 `agent.reset()` 或重新构造 Agent。
- `messages` 数组包含**完整历史**，包括每条 system 消息、用户 prompt、助手响应、工具调用、工具返回值。这让你在任何时候都能审计 Agent 的"思考链"。
- `messages` 的长度可能在 Agent 运行期间不断增长。如果你需要将消息历史持久化（如写入 JSONL 文件以支持会话恢复），这个数组就是你需要的全部数据。

### 14.4.2 `agent.reset(options?: Partial<AgentState>)`

`reset()` 方法将 Agent 重置到初始状态，并可选择性覆盖部分初始值：

```typescript
// 完全重置：清空消息、恢复初始 systemPrompt/model/tools
agent.reset();

// 重置但更换模型
agent.reset({ model: "anthropic/claude-opus-4" });

// 重置但更换系统提示词和工具集
agent.reset({
  systemPrompt: "你是一个 Python 代码审查专家。",
  tools: [readTool, grepTool],
});
```

`reset()` 的行为细节：

- 如果 `Agent` 当前处于 `"running"` 状态，`reset()` 先隐式调用 `abort()` 取消当前操作。
- `messages` 被清空（重置为 `initialState.messages`，如果有的话）。
- `systemPrompt`、`model`、`tools` 恢复为构造函数中的 `initialState` 值，除非你在 `reset()` 参数中显式覆盖。
- `error` 被清除。
- 事件订阅者（通过 `subscribe()` 注册的 listeners）**不会被清除**——重置只影响状态，不影响监听器。

### 14.4.3 状态变更触发事件

每次 Agent 状态变更（`status` 变化、`messages` 追加、`error` 变更等），Agent 都会发出相应的事件。这意味着任何通过 `agent.subscribe()` 注册的监听器都能感知到状态变化——这是构建响应式 UI 的基础。详细的事件类型列表见 14.6 节。

---

## 14.5 Steering 与 Follow-up 机制

这是 Pi 架构中最具特色的设计之一：Agent 运行时维护两条消息队列，允许外部在 Agent 运行过程中注入新指令。

### 14.5.1 两种投递模式

| 模式 | 方法 | 语义 | 触发时机 |
|------|------|------|----------|
| **Steering（控制）** | `agent.steer({...})` | "中断当前任务，立即响应此消息" | 用户干预（如"等等，先别做那个"） |
| **Follow-up（跟进）** | `agent.followUp({...})` | "当前任务完成后，处理这条消息" | 追加任务（如"顺便把测试也改一下"） |

```typescript
// Steering：立即中断
await agent.steer({
  role: "user",
  content: "等等，先别改——我刚才说错了，应该改成 getCwd，不是 getcwd",
  timestamp: Date.now(),
});

// Follow-up：排队等当前任务完成
await agent.followUp({
  role: "user",
  content: "另外，别忘了更新 README 里的用法示例",
  timestamp: Date.now(),
});
```

两条消息的格式完全相同（`SteeringMessage` 和 `FollowUpMessage` 共享同一个接口），区别仅在于 Agent 循环的**处理优先级**。

### 14.5.2 与消息队列的关系

Agent 内部维护了两个消息队列：

```
                    ┌─────────────────────┐
                    │   Steering Queue     │ ← agent.steer()
                    │   (高优先级，LIFO)    │
                    └──────┬──────────────┘
                           │
                    ┌──────▼──────────────┐
                    │   Follow-up Queue    │ ← agent.followUp()
                    │   (低优先级，FIFO)    │
                    └──────┬──────────────┘
                           │
                    ┌──────▼──────────────┐
                    │   Agent Loop         │
                    │   循环检查两个队列    │
                    └──────────────────────┘
```

Agent Loop 在每一轮迭代开始前（发 LLM 请求之前）检查这两个队列：

1. **先检查 Steering 队列**（比 Follow-up 优先级高）。如果队列非空，取出最新的 Steering 消息（LIFO——后进先出，最新的控制指令覆盖旧的），作为下一条 user 角色消息注入到消息历史中。

2. **再检查 Follow-up 队列**。如果 Steering 队列为空但 Follow-up 队列非空，取出最早的一条 Follow-up 消息（FIFO——先进先出，保证顺序），注入到消息历史中。

3. **如果两个队列均为空**，Agent 认为本轮任务完成，进入 idle 状态。

这种设计让你可以在 Agent 运行过程中随时"插入"新的指令，而不需要 `abort()` 后重新 `prompt()`。它与 Pi "完全可观测 + 可介入"的设计哲学一脉相承。

### 14.5.3 配置 steeringMode / followUpMode

Agent 构造函数的 `AgentConfig` 中（或通过环境/项目设置）可以配置两种队列的行为模式：

```typescript
interface AgentConfig {
  // ...

  steeringMode?: "replace" | "append";
  // "replace"（默认）：新 steering 消息替换队列中的旧 steering 消息
  // "append"：新 steering 消息追加到队列末尾
  // 绝大多数场景用 "replace"——你只关心最新的控制指令

  followUpMode?: "interleave" | "sequential";
  // "interleave"（默认）：follow-up 消息可以在 Agent 循环中间插入
  // "sequential"：follow-up 消息严格在当前轮次完成后才处理
}
```

实际使用中，几乎不需要修改这两个默认值。默认的 `steeringMode: "replace"` + `followUpMode: "interleave"` 覆盖了 99% 的用户场景。

---

## 14.6 事件订阅

`pi-agent-core` 的事件系统是整个 Agent 可观测性的基石。所有状态变化、工具调用、LLM 交互都是通过事件暴露出来的——`pi-tui` 的渲染、`pi-coding-agent` 的 Session 记录、Extension 的生命周期钩子，全部依赖这个事件系统。

### 14.6.1 `agent.subscribe(listener)`

注册一个事件监听器：

```typescript
const unsubscribe = agent.subscribe((event) => {
  switch (event.type) {
    case "tool_call":
      console.log(`[${event.type}] 调用工具: ${event.toolName}`);
      break;
    case "tool_result":
      console.log(`[${event.type}] 工具返回: ${event.toolName}`);
      break;
    case "assistant_message":
      console.log(`[${event.type}] 助手响应: ${event.content.substring(0, 50)}...`);
      break;
  }
});

// 当你不再需要监听时：
unsubscribe();
```

`subscribe()` 返回一个 `unsubscribe` 函数，调用它即可取消订阅。这是标准的 Observer 模式——不需要 `removeListener(eventType, handler)`，每个 `subscribe()` 返回独立的取消函数。

### 14.6.2 事件类型详解

完整的事件类型定义（联合体）：

```typescript
type AgentEvent =
  | { type: "status_change"; status: "idle" | "running" }
  // Agent 状态变更（idle ↔ running）

  | { type: "user_message"; message: Message }
  // 用户消息被注入到消息历史中（prompt / steer / followUp）

  | { type: "assistant_message_delta"; content: string; index: number }
  // 流式助手响应的增量（delta）——每个 token 或几个 token 触发一次
  // index 指示这是第几个 choice（通常为 0，除非模型返回多个候选）

  | { type: "assistant_message"; content: string }
  // 助手消息流式输出完成，content 为完整文本

  | { type: "thinking_delta"; content: string }
  // 模型思考过程的增量（thinking trace）——仅支持 thinking 的模型会发出此事件

  | { type: "thinking_done"; content: string }
  // 模型思考过程完成

  | { type: "tool_call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  // 模型发起了工具调用（参数已解析完毕，尚未执行）

  | { type: "tool_result"; toolCallId: string; toolName: string; result: ToolResult; error?: string }
  // 工具执行完成，result 为工具返回内容，error 为执行错误（如果有）

  | { type: "llm_request_start"; messages: Message[]; model: string }
  // 即将向 LLM 发送请求（消息已通过 transformContext + convertToLlm 处理）
  // 这是扩展开发者最常用的事件之一——检查发给 LLM 的完整 payload

  | { type: "llm_request_end"; usage?: { inputTokens: number; outputTokens: number; cost: number } }
  // LLM 请求返回，usage 包含 token 和成本信息（如果供应商提供）

  | { type: "error"; error: Error; recoverable: boolean }
  // Agent 运行中出现错误
  // recoverable 标识 Agent 能否自动恢复（如网络错误可重试，API 认证错误不可恢复）

  | { type: "reset" }
  // Agent 被重置（agent.reset() 被调用）

  | { type: "loop_start" }
  // Agent Loop 的一轮迭代开始

  | { type: "loop_end"; reason: "task_complete" | "user_abort" | "error" }
  // Agent Loop 的一轮迭代结束，reason 指示结束原因
```

### 14.6.3 事件流与状态同步

一个典型的 Agent 运行过程的事件流如下所示（假设用户发起了一次 prompt，模型调用了一个工具后完成了任务）：

```
1. status_change        → { status: "running" }
2. user_message         → { message: { role: "user", content: "帮我..." } }
3. llm_request_start    → { messages: [...], model: "anthropic/claude-sonnet-4" }
4. thinking_delta       → { content: "让我想想..." }   (多次触发)
5. thinking_done        → { content: "..." }
6. tool_call            → { toolCallId: "tc_1", toolName: "read", input: {...} }
7. tool_result          → { toolCallId: "tc_1", toolName: "read", result: {...} }
8. llm_request_start    → { messages: [...+ tool_results], ... }
9. assistant_message_delta → { content: "根据..." }   (多次触发)
10. assistant_message   → { content: "根据文件内容..." }
11. llm_request_end     → { usage: { inputTokens: 1234, outputTokens: 567, cost: 0.023 } }
12. loop_end            → { reason: "task_complete" }
13. status_change       → { status: "idle" }
```

关键保证：

- 每个 `tool_call` 事件都有一个对应的 `tool_result` 事件（通过 `toolCallId` 关联）。
- `loop_start` 和 `loop_end` 成对出现，方便你在它们之间插入自定义逻辑。
- `llm_request_start` 中的 `messages` 数组已经经过了 `transformContext` 和 `convertToLlm` 的完整处理——这是发给 LLM 的真实 payload。
- 所有事件是**顺序发出、同步等待监听器**的（async listener 会被 await）。这意味着你可以在事件处理器中做耗时操作（如写数据库、发网络请求），Agent 会等待。但这也意味着**不要在事件监听器中做过于耗时的同步操作**——它会阻塞整个 Agent。

---

## 14.7 Agent Loop 底层实现

### 14.7.1 `agentLoop()` —— 主循环

这是 Agent 的"心跳"。简化版的伪代码：

```typescript
async function agentLoop(config: AgentConfig, state: AgentState): Promise<void> {
  state.status = "running";

  while (true) {
    emit({ type: "loop_start" });

    // 1. 检查是否存在待处理的 steering / follow-up 消息
    const pendingMessage = checkQueues();
    if (pendingMessage) {
      state.messages.push(pendingMessage);
      emit({ type: "user_message", message: pendingMessage });
    } else if (isFirstIteration) {
      // 第一次迭代：已经有用户 prompt（由 prompt() 注入）
    } else {
      // 没有更多消息要处理 → 任务完成
      emit({ type: "loop_end", reason: "task_complete" });
      break;
    }

    // 2. 应用 transformContext（消息修剪/压缩）
    const contextMessages = config.transformContext
      ? await config.transformContext(state.messages)
      : state.messages;

    // 3. 转换为 LLM 格式
    const llmInput = config.convertToLlm
      ? config.convertToLlm(contextMessages)
      : contextMessages;

    // 4. 调用 LLM，获取流式响应
    emit({ type: "llm_request_start", messages: contextMessages, model: state.model });

    const stream = await callLlm(state.model, llmInput, config.abortController);

    // 5. 流式处理响应
    let textResponse = "";
    let toolCalls: ToolCall[] = [];
    let thinking = "";

    for await (const chunk of stream) {
      if (chunk.type === "text_delta") {
        textResponse += chunk.content;
        emit({ type: "assistant_message_delta", content: chunk.content, index: 0 });
      } else if (chunk.type === "thinking_delta") {
        thinking += chunk.content;
        emit({ type: "thinking_delta", content: chunk.content });
      } else if (chunk.type === "tool_call") {
        toolCalls.push(chunk.toolCall);
      }
    }

    if (thinking) {
      emit({ type: "thinking_done", content: thinking });
    }

    emit({ type: "assistant_message", content: textResponse });

    // 6. 如果模型要求调用工具
    if (toolCalls.length > 0) {
      const toolResults = await executeToolCalls(toolCalls, config);
      // 将工具调用和结果追加到消息历史
      state.messages.push({
        role: "assistant",
        content: textResponse,
        tool_calls: toolCalls,
      });
      for (const result of toolResults) {
        state.messages.push({
          role: "tool",
          tool_call_id: result.toolCallId,
          content: result.content,
        });
      }
      // 循环继续：下次迭代 LLM 会收到工具结果并继续思考
      continue;
    }

    // 7. 没有工具调用 → 本轮完成
    state.messages.push({
      role: "assistant",
      content: textResponse,
    });

    emit({ type: "llm_request_end", usage: stream.usage });
    emit({ type: "loop_end", reason: "task_complete" });
    break;
  }

  state.status = "idle";
}
```

### 14.7.2 `agentLoopContinue()` —— 继续循环

`agentLoopContinue()` 几乎等同于从 `agentLoop()` 的循环体中间启动——它跳过"注入用户消息"的步骤，直接从"LLM 调用"开始。这对应于"Agent 收到外部信号后继续执行"的场景：

```typescript
async function agentLoopContinue(config: AgentConfig, state: AgentState): Promise<void> {
  // 直接进入循环——假设消息历史中已有待处理的 tool_result
  while (true) {
    // ... 与 agentLoop() 中的步骤 2-7 完全相同
  }
}
```

### 14.7.3 循环控制流

完整的控制流图：

```
User prompt → agentLoop()
                │
                ▼
          ┌──────────┐  有 steering/follow-up?  ──yes──→ 注入消息
          │ 检查队列  │                                    │
          └────┬─────┘◄───────────────────────────────────┘
               │ no (第一轮) 或 已注入
               ▼
          ┌──────────┐
          │ transform │  消息修剪/压缩
          │ Context   │
          └────┬─────┘
               ▼
          ┌──────────┐
          │ convert   │  格式转换
          │ ToLlm     │
          └────┬─────┘
               ▼
          ┌──────────┐
          │ Call LLM  │  发送请求，接收流式响应
          └────┬─────┘
               ▼
          ┌──────────┐
          │ 有工具    │──yes──→ executeToolCalls()
          │ 调用？    │            │
          └────┬─────┘            ▼
               │ no         ┌──────────┐
               ▼            │ 注入工具  │  将工具调用和结果
          ┌──────────┐     │ 结果到    │  追加到 messages
          │ 任务完成  │     │ messages  │
          │ 停止循环  │     └────┬─────┘
          └──────────┘           │
                                 └──→ 回到"检查队列"（下一轮循环开始）
```

### 14.7.4 错误恢复

Agent Loop 内置了简单的错误恢复策略：

```typescript
try {
  // LLM 调用 + 工具执行
} catch (error) {
  if (isRetryable(error)) {
    // 可恢复错误（网络超时、速率限制 429、临时服务不可用 503）
    retryCount++;
    if (retryCount <= maxRetries) {
      await sleep(retryDelay * Math.pow(2, retryCount)); // 指数退避
      continue; // 重试本轮循环
    }
  }
  // 不可恢复错误或重试耗尽
  emit({ type: "error", error, recoverable: false });
  state.status = "idle";
  state.error = error;
  break;
}
```

可恢复错误包括：
- 网络超时（`ETIMEDOUT`、`ECONNRESET`）
- HTTP 429（速率限制）
- HTTP 503（服务暂时不可用）
- HTTP 502（网关错误）

不可恢复错误包括：
- HTTP 401/403（认证错误）
- HTTP 400（请求格式错误——通常是工具 schema 有问题）
- HTTP 402（余额不足）
- 工具执行中的异常（由 `tool_result.error` 承载，不会导致 Loop 终止）

---

## 14.8 工具编排

### 14.8.1 并行执行（`toolExecution: "parallel"`）

默认模式。当 LLM 在一次响应中返回多个工具调用时，Agent 使用 `Promise.all()` 并发执行它们：

```typescript
async function executeToolCalls(toolCalls: ToolCall[], config: AgentConfig) {
  const executionPromises = toolCalls.map(async (tc) => {
    // beforeToolCall 钩子（同步等待）
    const modifiedTc = config.beforeToolCall
      ? (await config.beforeToolCall({
          type: "tool_call",
          toolCallId: tc.id,
          toolName: tc.function.name,
          input: tc.function.arguments,
        })) ?? tc
      : tc;

    // 参数验证（TypeBox + AJV）
    const tool = config.initialState?.tools?.find(t => t.name === tc.function.name);
    if (!tool) throw new Error(`未知工具: ${tc.function.name}`);
    const validInput = validateParams(tool.parameters, tc.function.arguments);

    emit({ type: "tool_call", toolCallId: tc.id, toolName: tc.function.name, input: validInput });

    // 执行工具
    let result: ToolResult;
    try {
      result = await tool.execute(tc.id, validInput);
    } catch (err) {
      result = { content: [], error: err.message };
    }

    // afterToolCall 钩子
    const modifiedResult = config.afterToolCall
      ? (await config.afterToolCall({
          type: "tool_result",
          toolCallId: tc.id,
          toolName: tc.function.name,
          result,
          error: result.error,
        })) ?? { result, error: result.error }
      : { result, error: result.error };

    emit({
      type: "tool_result",
      toolCallId: tc.id,
      toolName: tc.function.name,
      result: modifiedResult.result,
      error: modifiedResult.error,
    });

    return { toolCallId: tc.id, result: modifiedResult.result, error: modifiedResult.error };
  });

  return await Promise.all(executionPromises);
}
```

并行模式的优势：
- **速度快**：读取 5 个文件可以同时进行，总耗时 ≈ 最慢的单个读取时间
- **适合独立性强的工具调用**：如同时 `read` 多个文件、同时 `grep` 多个目录

并行模式的局限：
- 如果工具之间有依赖关系（如"先 `grep` 找到文件，再 `read` 那个文件"），LLM 应该分成两轮调用——第一轮 `grep`，第二轮 `read`。把依赖链压入同一个响应中的多个 `tool_call` 在并行模式下会出问题。

### 14.8.2 顺序执行（`toolExecution: "sequential"`）

启用此模式后，Agent 使用 `for...of` 循环逐个执行工具调用：

```typescript
for (const tc of toolCalls) {
  // ... 和并行模式一样的单工具执行逻辑
  const result = await executeTool(tc, config);
  results.push(result);
}
```

顺序模式的优势：
- **确定性更强**：如果工具调用有副作用（如 `bash` 执行命令、`write` 创建文件），顺序执行保证操作的先后顺序
- **便于调试**：你可以看到每个工具按顺序执行，知道"这个结果是在那个结果之后产生的"

顺序模式的代价：
- 总耗时 = 各工具耗时之和，比并行慢

### 14.8.3 beforeToolCall / afterToolCall 钩子

这两个钩子是 Pi Extension 系统中最常用的拦截点。它们的典型用途：

```typescript
// beforeToolCall 示例：路径沙箱
agent = new Agent({
  beforeToolCall: async (event) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      const path = event.input.path as string;
      if (!path.startsWith("/safe/workdir/")) {
        // 阻止写入安全目录之外的文件
        return void 0; // 返回 void = 跳过此工具调用
      }
      // 路径规范化
      event.input.path = path.replace(/\/{2,}/g, "/");
      return event;
    }
  },
});

// afterToolCall 示例：敏感信息脱敏
agent = new Agent({
  afterToolCall: async (event) => {
    if (event.toolName === "bash") {
      // 脱敏输出中的 API Key
      const content = event.result.content;
      if (content && typeof content === "string") {
        event.result.content = content.replace(
          /(sk-[a-zA-Z0-9]{20,})/g,
          "[REDACTED]",
        );
      }
      return event;
    }
  },
});
```

### 14.8.4 工具结果处理

工具返回结果可以是多种格式：

```typescript
interface ToolResult {
  content: string | Array<{
    type: "text" | "image";
    text?: string;
    image?: {
      url?: string;
      base64?: string;
      mediaType?: string;
    };
  }>;
  error?: string;
  details?: Record<string, unknown>; // 附加元数据，不发送给 LLM
}
```

- `content` 是发送给 LLM 的工具结果。支持纯文本和多模态（文本+图片）两种格式。
- `error` 指示工具执行是否出错。Agent Loop 会将其作为错误信息传递给 LLM，让模型有机会自我修正（如 "文件不存在，换个路径试试"）。
- `details` 是开发者专用的元数据字段——它可以包含任意 JSON 数据，**不会**被发送给 LLM（节省 token），但可以在事件监听器中读取。典型用法是存储工具执行耗时、缓存命中状态、或调试信息。

---

## 14.9 上下文工程

上下文工程（Context Engineering）是 Pi 设计哲学的核心（第一章 [1.2.5](01-项目概览与核心定位#125-上下文工程优先精确控制进入模型上下文的内容) 详细阐述过）。`pi-agent-core` 通过两个关键函数实现了上下文工程的执行层。

### 14.9.1 transformContext —— 消息修剪/压缩

`transformContext` 是一个异步函数，在**每次**向 LLM 发送请求之前被调用。它接收当前完整的消息历史数组，返回修剪后的消息数组：

```typescript
transformContext?: (messages: Message[]) => Promise<Message[]>;
```

一个典型的滑动窗口实现：

```typescript
const transformContext = async (messages: Message[]) => {
  const MAX_MESSAGES = 20; // 保留最近 20 条消息

  // 找到最后一条 system 消息（系统提示词快照）
  const systemIndex = messages.findLastIndex(
    (m) => m.role === "system",
  );
  const systemMessage = systemIndex >= 0 ? [messages[systemIndex]] : [];

  // 取最后 N 条非 system 消息
  const recentMessages = messages
    .filter((m) => m.role !== "system")
    .slice(-MAX_MESSAGES);

  return [...systemMessage, ...recentMessages];
};
```

更复杂的实现可能包括：

- **摘要压缩**：当消息历史超过 token 预算时，调用一个便宜的小模型对早期对话生成摘要，用摘要替换原始消息。
- **工具输出截断**：对于过长的 `tool_result`（如 `bash` 命令输出了几千行），裁剪到前 N 行或字符。
- **去重**：移除连续的重复 `assistant_message`（如模型重复输出相同的话）。
- **thinking 内容移除**：在非思考模型中移除 `thinking` 内容（因为非思考模型不生成 `thinking`）。

`pi-coding-agent` 的默认 `transformContext` 实现使用滑动窗口 + 系统提示词快照注入（将 `System.md` 内容作为 system 消息固定在消息历史顶部）。

### 14.9.2 convertToLlm —— 消息格式转换

`convertToLlm` 将 Pi 内部的消息格式转换为 LLM 供应商期望的格式：

```typescript
convertToLlm?: (messages: Message[]) => LlmInput;
```

Pi 内部的消息格式是统一的：

```typescript
interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: Record<string, unknown> };
  }>;
  tool_call_id?: string;
}
```

而不同的 LLM API 期望不同的格式。例如 Anthropic 的 Messages API 需要：

```json
{
  "system": "系统提示词（顶层字段，不在 messages 数组中）",
  "messages": [
    { "role": "user", "content": "..." },
    {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "..." },
        { "type": "tool_use", "id": "...", "name": "...", "input": {...} }
      ]
    },
    {
      "role": "user",
      "content": [
        { "type": "tool_result", "tool_use_id": "...", "content": "..." }
      ]
    }
  ]
}
```

`convertToLlm` 负责这个转换。默认实现将 Pi 格式映射为 OpenAI Chat Completions 格式（这是最通用的格式），再由 `pi-ai` 的供应商适配器（Provider Adapter）根据不同供应商的 API 做第二层转换。

如果你需要为特定的 LLM 供应商做深度定制（而不只是通过 `pi-ai` 的适配层），可以覆盖 `convertToLlm`：

```typescript
const agent = new Agent({
  convertToLlm: (messages) => {
    // 自定义转换逻辑，例如针对 vLLM 的自部署模型做特殊处理
    return {
      model: agent.state.model,
      messages: messages.map((m) => {
        // 自定义映射逻辑...
      }),
      // 注入自定义参数
      extra_body: { repetition_penalty: 1.1 },
    };
  },
});
```

### 14.9.3 系统提示注入

`systemPrompt` 通过 `initialState` 传入，Agent 在每次 LLM 调用时将其作为第一条消息（system 角色）注入。由于 `transformContext` 可以修改消息数组，你可以动态地改变系统提示词内容：

```typescript
const agent = new Agent({
  initialState: {
    systemPrompt: "你是一个编码助手。",
  },
  transformContext: async (messages) => {
    const now = new Date().toISOString();
    // 动态注入当前时间到系统提示词
    const dynamicSystem = {
      role: "system",
      content: `${agent.state.systemPrompt}\n\n当前时间：${now}\n当前工作目录：${process.cwd()}`,
    };
    return [dynamicSystem, ...messages.filter((m) => m.role !== "system")];
  },
});
```

这种方式让你可以在每次 LLM 调用前注入实时的上下文信息（时间、git 分支、终端宽度等），而不需要在构造 Agent 时就把它们写死。

---

## 14.10 传输层抽象

`pi-agent-core` 支持两种传输模式：**直接运行模式**（Direct Mode）和**代理模式**（Proxy Mode）。传输层负责具体的 LLM API 调用——是 Agent 与 `pi-ai` 之间的"网络层"。

### 14.10.1 直接运行模式

这是默认模式。Agent 内部直接持有 `pi-ai` 的 LLM 客户端实例，`callLlm()` 直接发起 HTTP 请求到模型供应商的 API：

```
Agent → pi-ai → HTTP → Anthropic/OpenAI/... API
```

直接模式的特点：
- **最简单**：不需要额外进程或中间件，Agent 构造时即绑定模型
- **性能最优**：没有序列化/反序列化开销，没有进程间通信延迟
- **适合单进程场景**：CLI、本地 TUI、简单的 SDK 嵌入

### 14.10.2 代理（Proxy）模式

代理模式下，Agent 不直接持有 LLM 连接，而是通过一个 **stream proxy** 转发请求：

```
Agent → Stream Proxy → pi-ai → HTTP → API
         ↑
    (可多 Agent 共享)
```

代理模式的实现原理：

```typescript
interface StreamProxy {
  // 发起 LLM 请求，返回可读流
  request(
    messages: Message[],
    model: string,
    tools: Tool[],
    signal?: AbortSignal,
  ): Promise<ReadableStream<LlmChunk>>;
}
```

Agent 内部将 `callLlm()` 替换为对 `proxy.request()` 的调用。Proxy 可以是：

1. **进程内的**：同一个 Node.js 进程中的一个对象
2. **跨进程的**：通过 `Worker` 线程、`child_process` IPC、或网络 socket 通信
3. **跨网络的**：通过 WebSocket 或 HTTP 流连接远程 Proxy 服务器

### 14.10.3 Stream 代理原理

Stream 代理的核心思想是**将 LLM 响应流（ReadableStream）作为一等公民**，让 Agent 和 Proxy 之间的交互就是对事件流的"转发"：

```
                    Agent                          Stream Proxy
                      │                                  │
 prompt("hello") ────►│  构建消息 + 工具定义              │
                      │                                  │
                      │── request(messages, model, tools) ►│
                      │                                  │── callLlm() → API
                      │                                  │
                      │◄─── ReadableStream<LlmChunk> ────│  (流式响应)
                      │                                  │
                      │  解析 chunk，emit 事件             │
                      │  检测 tool_call，执行工具          │
                      │                                  │
                      │── request(messages+results, ...) ►│  (如果 LLM 需要继续)
                      │◄─── ReadableStream<LlmChunk> ────│
                      │                                  │
                      │  任务完成，emit loop_end          │
```

这种设计的关键优势：

- **解耦 Agent 逻辑与 LLM 调用实现**：Agent 不需要知道 LLM API 的认证方式、重试策略、供应商切换等细节。Proxy 负责这些。
- **支持自定义 Proxy 实现**：你可以实现一个带缓存、带熔断、带请求队列的 Proxy，Agent 完全无需感知。
- **为 RPC 模式打下基础**（第十一章）：RPC 模式就是 Proxy 的一种跨进程实现——Agent 在客户端进程，Proxy 在 pi 服务端进程，通过 stdin/stdout JSONL 通信。

---

## 14.11 Harness 测试工具

`packages/agent/src/harness/` 是面向扩展开发者和 Pi 核心贡献者的测试工具集。它的设计目标是：**让你在不启动完整 TUI 的情况下，就能对 Agent 进行单元测试、集成测试和行为验证**。

### 14.11.1 测试代理的辅助工具

Harness 提供的核心辅助函数：

```typescript
import { createTestAgent, MockTool } from "@earendil-works/pi-agent-core/harness";

// 创建一个测试用的 Agent 实例
const agent = createTestAgent({
  systemPrompt: "你是一个测试助手。",
  model: "mock-model", // 使用 mock 模型，不产生实际 API 调用
  tools: [
    MockTool({
      name: "greet",
      description: "按名称问候",
      parameters: Type.Object({ name: Type.String() }),
      // mockedResponses：预定义的"LLM 会生成什么工具调用"
      // 以及"工具应该返回什么结果"
    }),
  ],
});

// 监听事件
const events: AgentEvent[] = [];
agent.subscribe((event) => events.push(event));

// 发送 prompt
await agent.prompt("测试");

// 验证事件序列
assert(events.some((e) => e.type === "tool_call"));
assert(events.some((e) => e.type === "tool_result"));

// 验证消息历史
assert(agent.state.messages.length > 0);
```

关键能力：

- **Mock 模型**：不需要真实的 LLM API，用预设的响应序列（`mockedResponses`）模拟模型行为。你可以精确控制"模型在第几轮返回什么内容、调用什么工具"。
- **事件快照**：Harness 工具会自动捕获所有事件，让你可以断言事件序列的正确性。
- **时间控制**：消除网络延迟带来的不确定性，确保测试的确定性和可复现性。
- **简化的 Agent 配置**：不需要配置完整的 Provider、API Key 等——Harness 自动提供最小化的 mock 环境。

### 14.11.2 模拟工具调用

`MockTool` 是 Harness 中最常用的构造——它创建一个行为完全可控的工具：

```typescript
const readFileTool = MockTool({
  name: "read",
  description: "读取文件",
  parameters: Type.Object({
    path: Type.String(),
  }),
  // 预定义行为：对于给定的路径，返回指定的内容
  responses: new Map([
    ["/src/main.ts", { content: "console.log('hello');" }],
    ["/src/utils.ts", { content: "export const add = (a, b) => a + b;" }],
  ]),
  // 工具执行耗时模拟（ms）
  delay: 50,
});

const agent = createTestAgent({
  // ...
  tools: [readFileTool],
  // 模拟模型的多轮响应
  mockedResponses: [
    // 第 1 轮：模型要求读取两个文件
    {
      type: "assistant",
      content: "让我看看这两个文件。",
      tool_calls: [
        { id: "tc1", function: { name: "read", arguments: { path: "/src/main.ts" } } },
        { id: "tc2", function: { name: "read", arguments: { path: "/src/utils.ts" } } },
      ],
    },
    // 第 2 轮：模型得到工具结果后给出最终回答
    {
      type: "assistant",
      content: "文件分析完毕，建议如下……",
      tool_calls: [],
    },
  ],
});
```

这种"完全可控的 Agent 环境"让你可以在不依赖外部服务的情况下，验证以下场景：

- **工具编排逻辑**：并行/顺序执行的正确性
- **钩子行为**：`beforeToolCall` / `afterToolCall` 是否按预期拦截和修改了工具调用
- **错误处理**：工具执行失败时 Agent 的恢复行为
- **循环控制流**：多轮工具调用的边界情况
- **事件系统**：事件发射的顺序和完整性
- **Steering / Follow-up**：消息队列在不同时机注入时的行为

对于 Extension 开发者（第九章），Harness 是调试和测试 Extension 行为的核心工具——你可以精确控制 Agent 的每一步行为，而不需要在完整的 TUI 中反复手动测试。

---

## 14.12 本章小结

本章我们从源码设计的角度深入了 `pi-agent-core`——Pi 的第二个核心包。关键要点：

- **`pi-agent-core` 是一个纯逻辑层**，不依赖 pi-tui 或 pi-coding-agent。它的唯一职责是持有 Agent 状态并驱动 Agent Loop。它可以被 CLI、SDK、RPC 服务端或任何 Node.js 程序消费。

- **Agent 类的构造函数**通过 `initialState`（systemPrompt/model/tools/messages）、`convertToLlm`（格式转换）、`transformContext`（消息修剪）、`toolExecution`（并行/顺序）、`beforeToolCall`/`afterToolCall` 钩子和 `abortController` 提供了高度的可配置性和可拦截性。

- **四个公共方法**覆盖了完整的交互周期：`prompt()` 启动新交互，`continue()` 恢复暂停的执行，`abort()` 紧急中止，`waitForIdle()` 等待任务完成。

- **状态管理**基于 `agent.state`（只读快照）和 `agent.reset()`（可选参数覆盖），`messages` 数组保存了完整的会话历史——这是会话持久化和恢复的唯一数据源。

- **Steering 和 Follow-up** 机制通过两条优先级不同的消息队列（Steering 高优、Follow-up 低优）实现了在 Agent 运行过程中动态注入指令的能力——这是 Pi"完全可观测 + 可介入"哲学的工程体现。

- **事件系统**基于 Observer 模式，暴露了 `status_change`、`user_message`、`assistant_message_delta`、`tool_call`、`tool_result`、`llm_request_start`、`llm_request_end`、`error`、`loop_start`、`loop_end` 等 12+ 种事件类型。所有事件顺序发出、同步等待监听器——这是 pi-tui 渲染和 Extension 生命周期的底层支撑。

- **Agent Loop** 的控制流严格按照"检查队列 → 修剪上下文 → 格式转换 → 调用 LLM → 解析工具调用 → 执行工具 → 注入结果 → 回到检查队列"的循环推进。内置指数退避重试机制（网络超时、429、503），不可恢复错误（401、400、402）直接终止。

- **工具编排**支持并行（`Promise.all`，适合独立工具）和顺序（`for...of`，适合有副作用的工具）两种策略。`beforeToolCall`/`afterToolCall` 钩子提供了异步观测和修改点。

- **上下文工程**通过 `transformContext`（消息修剪/压缩）和 `convertToLlm`（格式转换）两个可覆盖的函数实现。"在每次 LLM 调用前精确控制进入模型的内容"——这是 Pi 的核心洞见。

- **传输层抽象**（直接模式 vs. Proxy 模式）将 LLM 调用实现与 Agent 逻辑解耦，支持进程内、跨进程、跨网络三种部署拓扑，为 RPC 模式和 SDK 嵌入提供了传输层的灵活性。

- **Harness 测试工具**让扩展开发者和核心贡献者可以在不启动完整 TUI 的情况下，用 Mock 模型和可控工具对 Agent 进行确定性的单元测试和集成测试。

下一章：[第十五章：核心架构pi-tui终端UI库](15-核心架构pi-tui终端UI库) 将深入 Pi 的第三个核心包——`pi-tui`，揭开 Pi 那个无闪烁、保留滚动缓冲区、支持差异化渲染的终端 UI 框架的设计秘密。

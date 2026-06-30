---
layout: default
title: 第十三章：核心架构：pi-ai 统一 LLM API 层
---

# 第十三章：核心架构：pi-ai 统一 LLM API 层

> 本章深入 Pi 最底层、也最关键的基石——`@earendil-works/pi-ai`。你将理解 Pi 如何用一套统一的 TypeScript API 驾驭 Anthropic、OpenAI、Google、Mistral、Amazon Bedrock 等 30+ 模型供应商的原生协议，理解流式/非流式调用、图像生成、跨供应商上下文交接、增量 JSON 解析、凭证自动解析、AbortController 支持等核心工程问题的实现方式。

## 13.1 pi-ai 包概述

### 13.1.1 在 monorepo 中的位置

在 Pi 的 monorepo 结构中，`packages/ai/` 是五个核心包中的**最底层**。它的 npm 包名为 `@earendil-works/pi-ai`，对外不依赖任何其他 Pi 包——它是一个可以**独立使用**的 TypeScript 库。即使你不使用 Pi 的 TUI、Agent 循环、Extension 系统，也可以单独安装它来访问 30+ LLM 供应商的统一 API。

```
packages/
├── ai/          ← 本章主角：统一 LLM API 层
├── agent/       → 第十四章：Agent 运行时
├── coding-agent→ 用户使用的 CLI（组合以上三者）
├── tui/         → 第十五章：终端 UI 库
└── orchestrator→ 工作流编排
```

### 13.1.2 核心使命：多供应商 LLM API 统一接口

pi-ai 解决的问题用一句话概括：**30+ 供应商，四种原生 API 协议，一套 TypeScript 接口**。无论你调用的是 Anthropic 的 Messages API、OpenAI 的 Chat Completions、Google 的 Generative AI API、Mistral 的 Conversations API、还是 Amazon Bedrock 的 Converse Stream API——**上游代码只需要和一种抽象打交道**：

- 一种 `Context` 格式（消息历史 + 系统提示词 + 工具定义）
- 一种 `Tool` 定义格式（基于 TypeBox 的类型安全 Schema）
- 一种流式事件类型（`text_delta`、`thinking_delta`、`toolcall_delta`）
- 一种认证解析方式（自动从环境变量、凭证存储、OAuth 中获取）

这种设计的一个直接后果是：**当你需要在一个 Session 中途把模型从 Claude 换成 DeepSeek，对话历史、工具调用、甚至思维链痕迹都能自动转换，无需手动处理格式差异**。这就是"跨供应商上下文交接"（Cross-Provider Handoff）——pi-ai 最惊艳的能力之一。

### 13.1.3 不依赖 Vercel AI SDK

许多同类项目选择基于 Vercel AI SDK 来屏蔽多供应商差异。Pi 的选择不同：**pi-ai 直接对接各供应商的原生 API**（Anthropic 用 `@anthropic-ai/sdk`，OpenAI 用 `openai`，Google 用 `@google/genai`）。Mario 对此的解释是：

> 直接调用原生 API 意味着我们可以使用每个供应商的全部功能（包括 latest beta 参数），而不是等 Vercel AI SDK 适配。同时，去掉一个中间层的映射意味着更少的 bug 表面和更精确的错误信息。

每个 API 的实现模块都同时提供了 `.lazy` 版本——当运行时或打包器支持动态 import 时，SDK 只在第一次实际调用时才加载，避免启动时的 bundle 膨胀。

---

## 13.2 内部模块结构

pi-ai 的源码目录 `packages/ai/src/` 按职责分为以下模块：

### 13.2.1 src/api/ — 各供应商 API 实现

这是 pi-ai 的"驱动程序层"，每个文件对应一种原生 API 协议的适配：

| 模块 | 对应的 API 协议 | 主要使用方 |
|------|---------------|-----------|
| `anthropic-messages` | Anthropic Messages API | Anthropic 全系列、Amazon Bedrock（部分） |
| `openai-completions` | OpenAI Chat Completions API | Groq、Cerebras、xAI、DeepSeek、OpenRouter、Together AI、Fireworks、Ollama 兼容端点等 |
| `openai-responses` | OpenAI Responses API（Codex） | OpenAI 官方模型、ChatGPT Plus/Pro 令牌 |
| `azure-openai-responses` | Azure OpenAI Responses API | Azure 上托管的 OpenAI 服务 |
| `openai-codex-responses` | OpenAI Codex Responses API | GitHub Copilot（Codex 内部端点） |
| `google-generative-ai` | Google Generative AI API | Gemini API（Google AI Studio） |
| `google-vertex` | Google Vertex AI API | Vertex AI 上托管的 Gemini 和 Claude 模型 |
| `mistral-conversations` | Mistral Conversations API | Mistral Large、Codestral 等 |
| `bedrock-converse-stream` | Amazon Bedrock Converse Stream API | AWS Bedrock 上托管的 Claude、Llama 等 |

每个 API 模块导出两个核心函数：`stream` 和 `streamSimple`。`stream` 接受该 API 的完整选项集（如 Anthropic 的 `thinkingEnabled`、OpenAI 的 `reasoningEffort`），`streamSimple` 则是跨供应商的统一推理级别 API（`reasoning: 'medium'` → 自动映射到各供应商对应的参数）。

你可以直接导入 API 模块，绕过 provider 抽象——这时你需要手动传入 `apiKey`：

```typescript
import { stream } from '@earendil-works/pi-ai/api/anthropic-messages';

const s = stream(claudeModel, context, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  thinkingEnabled: true,
  thinkingBudgetTokens: 2048,
});
```

### 13.2.2 src/auth/ — 认证模块

pi-ai 的认证系统遵循"每个供应商拥有自己的认证逻辑"的设计。核心抽象：

- **`CredentialStore`**：凭证持久化存储接口。定义了 `read(providerId)`、`modify(providerId, fn)`、`delete(providerId)` 三个方法。`modify` 是唯一的写入路径——它接收一个序列化的读-改-写函数，确保并发安全和 OAuth token 刷新时的原子性。
- **`envApiKeyAuth()`**：标准环境变量认证的工厂函数。`envApiKeyAuth('OpenAI API Key', ['OPENAI_API_KEY'])` 定义了"先从凭证存储读取，再回退到第一个已设置的环境变量"的标准行为。
- **OAuth 流程**：支持标准的 OAuth 2.0 登录和 token 刷新。支持的 OAuth 供应商包括 Anthropic（Claude Pro/Max）、OpenAI（ChatGPT Plus/Pro/Codex）、GitHub Copilot。OAuth token 刷新在 `modify` 内部执行，并发请求无法双重刷新。

### 13.2.3 src/providers/ — 各供应商工厂函数

每个内置供应商有一个工厂模块（如 `providers/anthropic.ts`、`providers/openai.ts`），导出：

```typescript
export function anthropicProvider() { ... }
```

每个工厂导入：
- 该供应商的模型 catalog（自动生成的数据）
- 对应的 API 实现的 lazy 包装

工厂函数返回的 `Provider` 对象包含：`id`（唯一标识）、`name`（显示名称）、`auth`（认证解析逻辑）、`models`（模型列表）、`api`（API 实现映射）。

对于混合 API 的供应商（如 GitHub Copilot 同时支持 Anthropic 和 OpenAI 模型），`api` 字段是一个 `{ [apiId]: ApiImplementation }` 映射——每个模型根据其 `api` 字段路由到对应的实现。

### 13.2.4 src/models.ts — Models 集合管理

这是 pi-ai 的核心运行时对象：`Models` 集合。它是一个同步查询 + 异步执行的服务定位器：

- 同步方法（`getModel`、`getModels`、`getProvider`、`getProviders`）返回最后已知的列表
- 异步方法（`stream`、`complete`、`streamSimple`、`completeSimple`）执行实际的 API 调用
- `refresh(providerId?)` 刷新动态供应商的模型列表（静态供应商是空操作）

### 13.2.5 src/types.ts — 核心类型定义

这里定义了 pi-ai 最核心的类型抽象：

```typescript
// 消息上下文
interface Context {
  systemPrompt?: string;
  messages: Message[];
  tools?: Tool[];
}

// 消息（覆盖 user/assistant/toolResult 三种角色）
interface Message {
  role: 'user' | 'assistant' | 'toolResult';
  content: string | ContentBlock[];
  timestamp: number;
  // assistant 消息额外字段
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

// 内容块（统一四种表示）
type ContentBlock = TextContent | ThinkingContent | ToolCallContent | ImageContent;

// 工具定义（基于 TypeBox Schema）
interface Tool {
  name: string;
  description: string;
  parameters: TSchema;
}
```

### 13.2.6 src/utils/ — 工具函数

包含流式解析（增量 JSON 解析器）、token 估算、成本计算、消息格式转换等通用工具函数。

---

## 13.3 Models 集合管理

`Models` 集合是 pi-ai 的入口对象。它管理多个 `Provider`，提供模型查询和 API 调用路由。

### 13.3.1 工厂函数

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek';

// 方式一：创建空集合，逐个注册供应商
const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openaiProvider());
models.setProvider(deepseekProvider());

// 方式二：一次性注册所有内置供应商（适合不在意 bundle 大小的场景）
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
const models = builtinModels(); // 包含 30+ 供应商的全部模型
```

`createModels()` 接受可选的 `credentials`（自定义凭证存储）和 `authContext`。对于静态内置供应商，模型列表在 import 时就已确定；对于动态供应商（如 llama.cpp 服务器），`refresh()` 会拉取最新列表。

### 13.3.2 模型查询

所有查询都是**同步的**，返回最后已知的数据：

```typescript
// 获取所有供应商
const providers = models.getProviders();

// 获取指定供应商
const anthropic = models.getProvider('anthropic');

// 获取所有模型（跨供应商）
const allModels = models.getModels();
// 获取指定供应商的所有模型
const anthropicModels = models.getModels('anthropic');

// 获取指定供应商的指定模型
const model = models.getModel('anthropic', 'claude-sonnet-4-5');
// 如果找不到，返回 undefined（不是抛异常）
```

返回的 `Model` 对象包含丰富的元数据：

```typescript
interface Model<Api extends string = string> {
  id: string;                  // 模型唯一 ID（如 'claude-sonnet-4-5'）
  name: string;                // 显示名称
  provider: string;            // 所属供应商 ID
  api: Api;                    // API 协议标识
  baseUrl?: string;            // API 端点基础 URL
  contextWindow: number;       // 最大上下文窗口（tokens）
  maxTokens: number;           // 最大输出 tokens
  reasoning: boolean;          // 是否支持推理/思考
  input: ('text' | 'image')[]; // 支持的输入类型
  cost: {                      // 定价（美元 / 百万 tokens）
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
}
```

### 13.3.3 hasApi() 守卫

当你通过 `getModel` 获取动态类型的模型时，TypeScript 不知道它对应哪个 API。使用 `hasApi()` 类型守卫来窄化：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

const m = models.getModel('anthropic', 'claude-sonnet-4-5');
if (m && hasApi(m, 'anthropic-messages')) {
  // m: Model<'anthropic-messages'> —— stream 选项完全类型化
  models.stream(m, context, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
}
```

如果你使用的是静态 catalog 导入（`getBuiltinModel`），模型类型已经是确定的，不需要 `hasApi`。

### 13.3.4 静态 Catalog 读取

不创建 `Models` 集合也能直接读取模型 catalog：

```typescript
import { getBuiltinModel, getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all';

const model = getBuiltinModel('openai', 'gpt-5-mini'); // 已经是 Model<'openai-responses'>
const gptModels = getBuiltinModels('openai');
```

这些函数返回的是 import 时已有的静态数据，不涉及任何 Provider 初始化或认证逻辑。

---

## 13.4 流式调用 API

流式调用是 pi-ai 最核心也最复杂的 API。它通过 `AsyncIterable` 返回一个事件流，每个事件携带增量内容。

### 13.4.1 基本用法

```typescript
const model = models.getModel('openai', 'gpt-4o-mini')!;
const context: Context = {
  systemPrompt: '你是一个专业的编码助手。',
  messages: [
    { role: 'user', content: '用 TypeScript 写一个快速排序', timestamp: Date.now() }
  ]
};

const stream = models.stream(model, context);

for await (const event of stream) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    // ... 处理其他事件
  }
}

// 流结束后获取最终消息（包含完整的 content、usage、stopReason）
const finalMessage = await stream.result();
```

### 13.4.2 流式事件类型全集

pi-ai 定义了 11 种流式事件，覆盖了从流开始到结束的所有状态：

| 事件类型 | 触发时机 | 关键属性 |
|----------|---------|---------|
| `start` | 流开始 | `partial`：初始的 assistant 消息结构 |
| `text_start` | 文本块开始 | `contentIndex`：在 content 数组中的位置 |
| `text_delta` | 收到一段文本 | `delta`：新增文本片段；`contentIndex` |
| `text_end` | 文本块完成 | `content`：完整文本；`contentIndex` |
| `thinking_start` | 推理块开始 | `contentIndex`：在 content 数组中的位置 |
| `thinking_delta` | 收到一段推理 | `delta`：新增推理片段；`contentIndex` |
| `thinking_end` | 推理块完成 | `content`：完整推理内容；`contentIndex` |
| `toolcall_start` | 工具调用开始 | `contentIndex`：在 content 数组中的位置 |
| `toolcall_delta` | 参数流式增量 | `delta`：JSON 增量；`partial.content[contentIndex].arguments`：部分解析的参数 |
| `toolcall_end` | 工具调用完成 | `toolCall`：完整的已校验工具调用（`id`、`name`、`arguments`） |
| `done` | 流正常完成 | `reason`：停止原因（`"stop"`、`"length"`、`"toolUse"`）；`message`：最终 assistant 消息 |
| `error` | 发生错误 | `reason`：`"error"` 或 `"aborted"`；`error`：含部分内容的 AssistantMessage |

### 13.4.3 事件交错

一个关键的心理模型：**不同内容块的事件可能交错出现**。供应商可能在同一个上游 chunk 中同时发出文本、推理和工具调用的增量，pi-ai 会按收到顺序发出对应事件。你可能会看到这样的序列：

```
text_start → text_delta → toolcall_start → text_delta → toolcall_delta → text_end → toolcall_end
```

因此你必须使用 `contentIndex` 来将每个 delta/end 事件关联到正确的内容块，**绝对不能假设某个块的 `*_start`/`*_delta`/`*_end` 序列不会被其他块的事件打断**。

### 13.4.4 stream.result() 获取最终结果

调用 `await stream.result()` 会等待流完全结束并返回最终的 `AssistantMessage`：

```typescript
const s = models.stream(model, context);
// 消费事件...
const message = await s.result();

// message 包含：
// - content: ContentBlock[] — 完整的文本/推理/工具调用内容块
// - usage: { input: number; output: number; cacheRead?: number; cost: { input: number; output: number; total: number } }
// - stopReason: 'stop' | 'length' | 'toolUse' | 'error' | 'aborted'
// - errorMessage?: string — 仅在 stopReason 为 'error' 或 'aborted' 时存在
```

### 13.4.5 完整示例：带工具调用的流式循环

```typescript
import { Type, type Context, type Tool } from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';

const models = createModels();
models.setProvider(openaiProvider());

const getTimeTool: Tool = {
  name: 'get_time',
  description: '获取当前时间，可指定时区',
  parameters: Type.Object({
    timezone: Type.Optional(Type.String({ description: '时区，如 Asia/Shanghai' }))
  })
};

const context: Context = {
  systemPrompt: '你是一个助手。',
  messages: [{ role: 'user', content: '现在北京几点？', timestamp: Date.now() }],
  tools: [getTimeTool]
};

const model = models.getModel('openai', 'gpt-4o-mini')!;

// 循环直到模型不再请求工具
let hasToolCalls = true;
while (hasToolCalls) {
  hasToolCalls = false;
  const s = models.stream(model, context);

  for await (const event of s) {
    switch (event.type) {
      case 'text_delta':
        process.stdout.write(event.delta);
        break;
      case 'toolcall_end':
        console.log(`\n调用工具: ${event.toolCall.name}`);
        hasToolCalls = true;
        break;
    }
  }

  const message = await s.result();

  // 处理工具调用
  for (const block of message.content) {
    if (block.type === 'toolCall') {
      let result: string;
      if (block.name === 'get_time') {
        result = new Date().toLocaleString('zh-CN', {
          timeZone: block.arguments.timezone || 'Asia/Shanghai',
          dateStyle: 'full',
          timeStyle: 'long'
        });
      } else {
        result = '未知工具';
      }

      context.messages.push(message);
      context.messages.push({
        role: 'toolResult',
        toolCallId: block.id,
        toolName: block.name,
        content: [{ type: 'text', text: result }],
        isError: false,
        timestamp: Date.now()
      });
    }
  }
}
```

---

## 13.5 非流式调用 API

当你不需要流式输出时的选择。

### 13.5.1 models.complete()

`complete()` 等待完整响应后一次性返回 `AssistantMessage`：

```typescript
const response = await models.complete(model, context);

for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'toolCall') {
    console.log(`工具: ${block.name}(${JSON.stringify(block.arguments)})`);
  } else if (block.type === 'thinking') {
    console.log(`[推理]: ${block.thinking}`);
  }
}

console.log(`输入 tokens: ${response.usage.input}, 输出 tokens: ${response.usage.output}`);
console.log(`费用: $${response.usage.cost.total.toFixed(6)}`);
```

`complete()` 在底层实际上是驱动了一次流式调用然后收集所有增量——所以它和 `stream()` 的行为完全一致，只是不暴露中间事件。`stopReason`、`usage`、`errorMessage` 等字段同样可用。

### 13.5.2 models.completeSimple() — 自动处理 thinking

`completeSimple()` 是 `complete()` 的简化版，它接受跨供应商的统一 `reasoning` 级别而非供应商特定的参数：

```typescript
const response = await models.completeSimple(model, context, {
  reasoning: 'medium' // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
});
```

`reasoning` 级别会被自动映射到各供应商的对应参数：

| pi 级别 | Anthropic (thinkingBudgetTokens) | OpenAI (reasoningEffort) | Google Gemini (budgetTokens) |
|---------|------|------|------|
| `off` | 关闭 thinking | `reasoningEffort: 'none'` | `thinking: { enabled: false }` |
| `minimal` | 1024 | `'minimal'` | 1024 |
| `low` | 2048 | `'low'` | 2048 |
| `medium` | 8192 | `'medium'` | 8192 |
| `high` | 16000 | `'high'` | -1（动态） |
| `xhigh` | 32000 | `'xhigh'` | -1（动态） |

如果模型不支持 reasoning，这些选项会被静默忽略。流式版本的 `streamSimple()` 同样可用，会发出 `thinking_start`/`thinking_delta`/`thinking_end` 事件。

---

## 13.6 图像生成 API

pi-ai 为图像生成提供了与文本对话完全独立但结构一致的 API 表层。

### 13.6.1 ImagesModels 集合

```typescript
import { builtinImagesModels } from '@earendil-works/pi-ai/providers/all';

const imagesModels = builtinImagesModels();
const model = imagesModels.getModel('openrouter', 'google/gemini-2.5-flash-image')!;
```

`ImagesModels` 和 `Models` 是两个独立的集合——图像模型不在 `Models` 中，文本模型不在 `ImagesModels` 中。两个集合共享相同的查询模式（`getModel`、`getModels`、`getProvider`、`getAuth`）和认证解析逻辑。

### 13.6.2 generateImages() 调用

图像生成是一次性 API，不支持流式输出：

```typescript
const result = await imagesModels.generateImages(model, {
  input: [{ type: 'text', text: '生成一个纯白背景上的红色圆形。' }]
});

for (const block of result.output) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'image') {
    console.log(`MIME: ${block.mimeType}`);
    console.log(`数据长度: ${block.data.length}`);
  }
}
```

### 13.6.3 支持的模型

图像生成目前通过 OpenRouter 供应商提供。可用的模型包括 Google Imagen 系列、Stable Diffusion 系列、FLUX 系列等。检查模型元数据确认能力：

```typescript
console.log(model.input);  // ['text'] 或 ['text', 'image']
console.log(model.output); // ['image'] 或 ['image', 'text']
```

部分模型支持图像输入（图像编辑/变换），部分仅支持文本到图像。`generateImages()` 不支持工具调用——它专门用来生成图像。

---

## 13.7 认证解析

pi-ai 的认证系统是其工程精度的集中体现。它不依赖全局单例、环境变量读取或魔法字符串——每个供应商自己声明认证来源、解析优先级和刷新策略。

### 13.7.1 getAuth() 方法

无需发起实际请求即可检查模型的认证状态：

```typescript
const auth = await models.getAuth(model);
if (auth) {
  console.log(`已配置，通过 ${auth.source}`); // 如 "ANTHROPIC_API_KEY", "OAuth", "stored credential"
} else {
  console.log('未配置');
}
```

`getAuth()`：
- 返回 `undefined` 表示该供应商未配置凭据（正常情况，不是错误）
- 抛出 `ModelsError`（`type: "oauth"` 或 `type: "auth"`）表示凭据解析过程出了真正的问题（OAuth token 刷新失败、凭证存储损坏等）

### 13.7.2 凭据解析流程

当调用 `models.stream(model, context)` 时，认证解析遵循以下步骤：

1. **检查显式传入的 `apiKey`**：如果调用时传入了 `{ apiKey: 'sk-xxx' }`，直接使用，**跳过所有后续步骤**。
2. **从凭证存储读取**：如果存在持久化的 `CredentialStore`（如 `~/.pi/auth.json` 的封装），从中读取该供应商的已存储凭据。存储的凭据"拥有"该供应商——一旦存在存储的凭据，环境变量就不再被检查。
3. **从环境变量解析**：每个供应商定义了其标准环境变量（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等），按注册顺序检查第一个已设置的变量。
4. **OAuth 流程**：对于支持 OAuth 的供应商（Anthropic、OpenAI Codex、GitHub Copilot），如果存在已存储的 OAuth token，自动检查有效期并在需要时使用 refresh token 续期。token 刷新在 `CredentialStore.modify()` 内部执行，利用其原子性保证避免并发刷新。
5. **Ambient 凭据**：对于云服务（Amazon Bedrock 使用 AWS Profile/IAM 角色，Vertex AI 使用 gcloud ADC），自动检测运行环境的凭据。

### 13.7.3 CredentialStore 接口

```typescript
interface CredentialStore {
  read(providerId: string): Promise<StoredCredential | undefined>;
  modify(providerId: string, fn: (current: StoredCredential | undefined) => StoredCredential | undefined): Promise<void>;
  delete(providerId: string): Promise<void>;
}
```

`modify` 是唯一的写入路径——它接收一个读-改-写函数，在执行期间对同 provider 的其他并发调用保持序列化。这是确保 OAuth token 刷新不被多个并发请求破坏的关键设计。

---

## 13.8 四种 API 抽象

pi-ai 最底层的差异来自四种（实际上更多，但最核心的是以下四种）原生 API 协议。每种协议有不同的角色命名、工具调用格式、思考输出方式，pi-ai 将它们全部归一化到统一的接口。

### 13.8.1 OpenAI Chat Completions API

**对应 API ID**：`openai-completions`

这是使用最广泛的 API 协议。原生端点路径为 `/v1/chat/completions`，绝大多数 OpenAI 兼容端点（Ollama、vLLM、LM Studio、Groq、Cerebras、xAI、DeepSeek、OpenRouter、Together AI、Fireworks）都使用此协议。

特点：
- 角色：`system`、`user`、`assistant`、`tool`
- 工具调用在 `assistant` 消息的 `tool_calls` 数组中
- 推理模式通过 `reasoning_effort` 参数（或供应商自定义的变体，如 DeepSeek 的 `thinking.type`）
- 流式事件中，每个 chunk 为 `choices[0].delta`

pi-ai 的 `openai-completions` 实现内置了大量兼容性适配（`compat` 字段），以应对不同供应商在细节上的差异——如是否支持 `store` 字段、是否支持 `developer` 角色、`max_tokens` 字段名不同等。

### 13.8.2 OpenAI Responses API

**对应 API ID**：`openai-responses`、`azure-openai-responses`、`openai-codex-responses`

这是 OpenAI 较新的 API（又称 Codex API），与 Chat Completions API 的结构不同。ChatGPT Plus/Pro 令牌和 Azure OpenAI 使用此协议。

与 Chat Completions 的主要差异：
- 请求格式不同于 Chat Completions，有自己的消息结构和参数命名
- 支持更丰富的 `reasoning_summary` 选项
- 缓存机制不同（支持 24 小时 prompt cache retention）
- Azure 变体需要额外的资源名称/部署名称映射

### 13.8.3 Anthropic Messages API

**对应 API ID**：`anthropic-messages`

Anthropic 的原生协议，也被 Amazon Bedrock 和 Vertex AI（部分）使用。

与 OpenAI 协议的核心差异：
- 角色：`user`、`assistant`（Anthropic 不使用 `system` 角色，系统提示词在请求顶层的 `system` 字段中）
- 内容块（Content Blocks）而不是简单的 `content` 字符串：Anthropic 所有消息内容都是结构化的块数组——`text` 块、`tool_use` 块、`tool_result` 块、`thinking` 块
- 工具调用通过 `tool_use` 内容块表示（不是 `tool_calls` 数组）
- `stop_reason`：`"end_turn"`（对应 OpenAI 的 `"stop"`）、`"max_tokens"`（`"length"`）、`"tool_use"`（`"toolUse"`）
- 扩展思考（Extended Thinking）：有专门的 `thinking` 内容块，与 `text` 内容块并行
- Prompt 缓存：使用 `cache_control` 标记来指定哪些内容应被缓存

### 13.8.4 Google Generative AI API

**对应 API ID**：`google-generative-ai`、`google-vertex`

Google Gemini 的原生协议。

与 OpenAI/Anthropic 协议的核心差异：
- `role` 只有 `user` 和 `model`（Google 把 assistant 叫 `model`）
- 工具调用格式是内联的 `functionCall` 和 `functionResponse` parts
- 安全过滤：Google 有严格的输入输出安全过滤，可能直接屏蔽某些内容而不抛出可见错误
- 思考模式：Gemini 2.5 系列的 `thinking` 通过专用配置控制
- 工具调用流式：**Google 不支持函数调用的流式传输**——你会收到一个包含完整参数的单次 `toolcall_delta` 事件

### 13.8.5 API 间的差异与映射

pi-ai 内部的映射关系决定了跨供应商上下文交接的质量。以下是关键映射：

| 概念 | OpenAI | Anthropic | Google |
|------|--------|-----------|--------|
| 用户消息角色 | `user` | `user` | `user` |
| 助手消息角色 | `assistant` | `assistant` | `model` |
| 系统提示词 | messages 中的 `system` 角色 | 请求顶层 `system` 字段 | `systemInstruction` |
| 工具调用 | `tool_calls` 数组 | `tool_use` 内容块 | `functionCall` parts |
| 工具结果角色 | `tool` | `tool_result` 内容块 | `functionResponse` parts |
| 推理/思考 | `reasoning_content` | `thinking` 内容块 | `thoughts` part |
| 正常停止 | `"stop"` | `"end_turn"` | `"STOP"` |
| token 限制停止 | `"length"` | `"max_tokens"` | `"MAX_TOKENS"` |
| 工具调用停止 | `"tool_calls"` | `"tool_use"` | `"TOOL_CALLS"` |

---

## 13.9 跨提供商上下文交接机制

这是 pi-ai 最具野心的功能：**同一个 Session 中切换模型/供应商，消息历史（包括思考痕迹、工具调用）自动转换为目标模型的格式**。

### 13.9.1 基本使用

```typescript
const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openaiProvider());
models.setProvider(googleProvider());

const context: Context = { messages: [] };

// 先用 Claude（带扩展思考）
const claude = models.getModel('anthropic', 'claude-sonnet-4-5')!;
context.messages.push({ role: 'user', content: '25 × 18 等于多少？', timestamp: Date.now() });
context.messages.push(await models.completeSimple(claude, context, { reasoning: 'medium' }));

// 切换到 GPT-5 —— Claude 的思考痕迹自动转为 <thinking> 标记的文本
const gpt5 = models.getModel('openai', 'gpt-5-mini')!;
context.messages.push({ role: 'user', content: '这个计算正确吗？', timestamp: Date.now() });
context.messages.push(await models.complete(gpt5, context));

// 切换到 Gemini —— 同样自动转换
const gemini = models.getModel('google', 'gemini-2.5-flash')!;
context.messages.push({ role: 'user', content: '原始问题是什么？', timestamp: Date.now() });
const geminiResponse = await models.complete(gemini, context);
```

### 13.9.2 角色映射

每个 API 协议对消息角色的命名不同：OpenAI 用 `assistant`，Anthropic 也用 `assistant`（但结构不同），Google 用 `model`。pi-ai 内部维护了一套"中间表示（IR）"——所有消息在切换供应商时都从 IR 映射到目标协议的角色。

`user` 和 `toolResult` 消息基本可以透传（少数例外），但 `assistant` 消息的转换最复杂——特别是包含思考内容时。

### 13.9.3 思维链痕迹转换

当你从一个支持推理的模型（如 Claude extended thinking、GPT-5 reasoning、DeepSeek R1）切换到不支持推理的模型时，pi-ai 的处理策略是：

1. **检测**：判断目标模型是否支持 `reasoning`。如果支持，思考内容可以保留为原格式。
2. **转换**：如果目标模型不支持推理，前一个模型产生的 `thinking` 块被转换为普通文本，用 `<thinking>` XML 标签包裹：

   ```
   <thinking>
   用户要求计算 25 × 18。25 × 10 = 250，25 × 8 = 200，
   250 + 200 = 450。所以 25 × 18 = 450。
   </thinking>
   ```

3. **上下文成本**：这些转换后的文本会消耗目标模型的上下文窗口。在切换前应评估一下 token 用量——但这样做的好处是新模型能看到前任的完整推理轨迹，保持决策的一致性。

### 13.9.4 工具格式标准化

不同协议对工具定义和工具调用结果的表示完全不同：

- OpenAI：工具定义是 `functions` 数组（JSON Schema），调用结果是 `role: "tool"` 消息
- Anthropic：工具定义是请求中的 `tools` 字段（JSON Schema），调用结果是通过 `tool_result` 内容块
- Google：工具定义是 `functionDeclarations`，调用结果是 `functionResponse` parts

pi-ai 在切换供应商时：
1. 将**工具定义**从源协议的格式转换为目标协议的格式（所有供应商本质上都接受 JSON Schema，但字段名和嵌套结构不同）
2. 将**历史消息中的工具调用和结果**从 IR 转为目标协议格式
3. 保留 `toolCallId` 用于追踪对应关系

经过充分测试的切换路径包括：Anthropic ↔ OpenAI、OpenAI ↔ Google、Anthropic ↔ Google。跨不同 API 协议的切换也经过验证，但 Google 的安全过滤在个别情况下可能导致部分响应被屏蔽。

---

## 13.10 部分 JSON 解析

工具调用参数的流式增量解析是 pi-ai 工程精度最高的模块之一。

### 13.10.1 工作原理

当模型在流式输出工具调用参数时（一个大 JSON 对象），供应商不会等整个 JSON 完成才发送——它们会在参数生成过程中以增量的方式逐块推送。pi-ai 在幕后运行一个**增量 JSON 解析器**，尝试从部分数据中解析出最佳-effort 的对象结构。

```typescript
const s = models.stream(model, context);

for await (const event of s) {
  switch (event.type) {
    case 'toolcall_delta': {
      const toolCall = event.partial.content[event.contentIndex];
      if (toolCall.type === 'toolCall' && toolCall.arguments) {
        // toolCall.arguments 是部分解析的结果
        // 当流式进行时，可能包含不完整的值
        if (toolCall.arguments.path) {
          console.log(`正在操作文件: ${toolCall.arguments.path}`);
        }
        if (toolCall.arguments.content) {
          console.log(`内容预览: ${String(toolCall.arguments.content).substring(0, 100)}...`);
        }
      }
      break;
    }
    case 'toolcall_end': {
      // event.toolCall.arguments 现在是完整的，但还未通过 TypeBox 校验
      console.log(`工具调用完成: ${event.toolCall.name}`, event.toolCall.arguments);
      break;
    }
  }
}
```

### 13.10.2 注意事项

在使用部分解析结果时必须保持防御性编程：

- **字段可能缺失**：在 JSON 流式生成的中间阶段，某些字段可能还没开始输出
- **字符串可能被截断**：`"content": "这是一段很长的文本，还` —— 在中途被切断
- **数组可能不完整**：`[1, 2, 3]` 可能在 `[1, 2` 的阶段被解析
- **嵌套对象可能部分填充**
- **`arguments` 至少是 `{}`**：绝不会是 `undefined`，即使在流的最开始阶段
- **Google 供应商不支持函数调用流式**：对于 Google，你将收到一个包含完整参数的单一 `toolcall_delta` 事件

### 13.10.3 validateToolCall() 校验

当你需要将工具调用的参数传递给实际的工具执行函数之前，必须先用 `validateToolCall()` 做校验：

```typescript
import { validateToolCall, type Tool } from '@earendil-works/pi-ai';

for await (const event of s) {
  if (event.type === 'toolcall_end') {
    const toolCall = event.toolCall;
    try {
      const validatedArgs = validateToolCall(tools, toolCall);
      // validatedArgs 已经通过 TypeBox Schema 校验
      const result = await executeMyTool(toolCall.name, validatedArgs);
      // ...
    } catch (error) {
      // 校验失败——将错误作为工具结果返回，让模型重试
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: error.message }],
        isError: true,
        timestamp: Date.now()
      });
    }
  }
}
```

---

## 13.11 结构化工具结果分离

工具调用返回的结果在 pi-ai 中被统一为内容块（Content Blocks），可以同时包含文本和图像：

### 13.11.1 内容块结构

```typescript
type ContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown> };
```

工具结果消息（`toolResult` 角色）可以包含任意组合的文本和图像内容块：

```typescript
context.messages.push({
  role: 'toolResult',
  toolCallId: block.id,
  toolName: block.name,
  content: [
    { type: 'text', text: '图表已生成。' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ],
  isError: false,
  timestamp: Date.now()
});
```

### 13.11.2 "给 LLM 的部分"和"给 UI 展示的部分"

虽然 pi-ai 的类型定义中没有显式的 `details` 字段，但在 Pi 的整体架构中，工具返回结果被用于两个目的：

1. **给 LLM 的上下文**——`content` 中的所有块都会进入模型的上下文窗口，模型能看到文本和图像来继续推理和生成
2. **给 UI 展示的部分**——Pi 的 TUI 渲染器会展示工具调用和返回结果，但如果工具返回了很大的结果（如一个完整文件的内容），TUI 可能会选择折叠或截断显示

这种分离的关键在于**工具实现者**自己决定放什么到 `content` 中——是详细的 LLM 可见数据还是简洁的摘要。推荐的做法是：`content` 中放 LLM 需要的完整信息，UI 展示由 TUI 层的渲染策略决定。

---

## 13.12 中止支持

pi-ai 的整个调用管道都支持通过 `AbortSignal` 中止——从 HTTP 请求到底层 SDK 到流式事件生成。

### 13.12.1 基本用法

```typescript
const controller = new AbortController();

// 2 秒后中止
setTimeout(() => controller.abort(), 2000);

const s = models.stream(model, context, {
  signal: controller.signal
});

for await (const event of s) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'error') {
    // event.reason 告诉你是因为 "error" 还是 "aborted"
    if (event.reason === 'aborted') {
      console.log('\n[请求已被用户中止]');
    }
  }
}

// 获取结果（如果被中止，message 包含部分内容）
const response = await s.result();
if (response.stopReason === 'aborted') {
  console.log('请求中止时的内容:', response.content);
  console.log('已消耗 tokens:', response.usage);
}
```

### 13.12.2 abort signal 传递

`signal` 通过以下路径传递：

1. **用户代码** → `models.stream()` 或 `models.complete()` 的 `options.signal`
2. **Models 集合** → 转发到对应 Provider
3. **Provider** → 转发到对应的 API 实现
4. **API 实现** → 传递给底层 HTTP 请求或 SDK（如 `fetch` 的 `signal` 选项、Anthropic SDK 的 abort 支持）

如果请求已被中止但还有部分内容已从网络到达，这些内容仍然会通过流式事件发送。`stopReason` 会被设为 `"aborted"`，`message.content` 包含所有已收到的内容块。

### 13.12.3 中止后继续

中止后的消息仍然可以追加到上下文历史，并在后续请求中继续：

```typescript
const controller1 = new AbortController();
setTimeout(() => controller1.abort(), 2000);

const partial = await models.complete(model, context, { signal: controller1.signal });

// partial.stopReason === 'aborted'
// partial.content 包含已生成的部分内容

context.messages.push(partial);
context.messages.push({ role: 'user', content: '请接着往下写', timestamp: Date.now() });

const continuation = await models.complete(model, context);
// 模型从被截断的地方继续生成
```

---

## 13.13 自定义供应商

pi-ai 允许你注册任意 OpenAI 或 Anthropic 兼容的端点作为一等供应商——和使用内置供应商完全相同的 API。

### 13.13.1 createProvider()

```typescript
import { createModels, createProvider, envApiKeyAuth, type Model } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000,
};

const ollama = createProvider({
  id: 'ollama',
  name: 'Ollama',
  baseUrl: 'http://localhost:11434/v1',
  auth: { apiKey: { name: 'Ollama', resolve: async () => ({ auth: {} }) } },
  models: [ollamaModel],
  api: openAICompletionsApi(),
});

const models = createModels();
models.setProvider(ollama);

await models.complete(models.getModel('ollama', 'llama-3.1-8b')!, context);
```

### 13.13.2 createModels 选项

`createModels()` 接受两个可选选项：

- `credentials`：自定义 `CredentialStore` 实现（替代默认的内存存储）
- `authContext`：传递给认证解析器的上下文对象（如 CLI vs 浏览器环境的标记）

---

## 13.14 Token 和成本追踪

每次 `stream()` 或 `complete()` 调用完成后，返回的 `AssistantMessage` 都包含精确的用量和成本信息：

```typescript
const message = await models.complete(model, context);

console.log(`输入: ${message.usage.input} tokens`);
console.log(`输出: ${message.usage.output} tokens`);
if (message.usage.cacheRead) {
  console.log(`缓存命中: ${message.usage.cacheRead} tokens`);
}
console.log(`总计费用: $${message.usage.cost.total.toFixed(6)}`);
console.log(`  - 输入费用: $${message.usage.cost.input.toFixed(6)}`);
console.log(`  - 输出费用: $${message.usage.cost.output.toFixed(6)}`);
```

每种模型在 catalog 中有自己的定价表（美元/百万 tokens），pi-ai 根据实际消耗的 token 数自动计算费用。对于支持 prompt 缓存的模型（Anthropic、OpenAI 部分模型），缓存命中和写入的 token 也会被分别计入。

---

## 13.15 错误处理

pi-ai 的一个核心设计原则：**请求失败永远不抛出异常，而是转化为流式事件和最终消息的状态**。

### 13.15.1 流式错误

在流式调用中，错误通过 `error` 事件通知，最终消息携带完整的错误信息：

```typescript
for await (const event of s) {
  if (event.type === 'error') {
    // event.reason: "error" | "aborted"
    // event.error.errorMessage: 错误描述
    // event.error.content: 错误前的部分内容
    console.error(`${event.reason}: ${event.error.errorMessage}`);
  }
}

const message = await s.result();
if (message.stopReason === 'error') {
  console.error('失败:', message.errorMessage);
  console.log('部分内容:', message.content);
}
```

### 13.15.2 非流式错误

`complete()` 返回的 `AssistantMessage` 的 `stopReason` 会是 `"error"`（或 `"aborted"`），`errorMessage` 包含描述。不会抛出异常。

### 13.15.3 调试提供商的原始负载

使用 `onPayload` 回调来检查发往供应商的请求内容：

```typescript
const response = await models.complete(model, context, {
  onPayload: (payload) => {
    console.log('供应商请求负载:', JSON.stringify(payload, null, 2));
  }
});
```

`onPayload` 在 `stream`、`complete`、`streamSimple`、`completeSimple` 中都可用。

---

## 13.16 Faux Provider 测试支持

pi-ai 为测试场景内置了 `fauxProvider()`——一个内存中的模拟供应商：

```typescript
import {
  fauxProvider,
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '@earendil-works/pi-ai';

const faux = fauxProvider({ tokensPerSecond: 50 });
models.setProvider(faux.provider);
const model = faux.getModel();

// 预置响应队列
faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('需要先查看文件结构。'),
    fauxToolCall('read_file', { path: 'src/index.ts' }),
  ], { stopReason: 'toolUse' }),
]);

// 调用时按队列顺序消费
const response = await models.complete(model, context);
// response.content[0].type === 'thinking'
// response.content[1].type === 'toolCall'

// 查询状态
console.log(faux.state.callCount);       // 已调用次数
console.log(faux.getPendingResponseCount()); // 剩余待消费响应数
```

Faux Provider 同样支持流式输出（使用 `models.stream`）——工具调用参数会模拟逐字符的增量流式。当队列耗尽时，返回的 `AssistantMessage` 带有 `errorMessage: "No more faux responses queued"`。

---

## 13.17 本章小结

本章我们完整拆解了 Pi 最底层的基石——`@earendil-works/pi-ai`：

- **它是一个独立的 TypeScript 库**（npm 包 `@earendil-works/pi-ai`），可以脱离 Pi 的其他部分单独使用来访问 30+ LLM 供应商。
- **内部模块按职责清晰划分**：`src/api/`（9 种 API 协议实现）、`src/auth/`（认证解析与 OAuth）、`src/providers/`（供应商工厂）、`src/models.ts`（Models 集合管理）、`src/types.ts`（核心类型）、`src/utils/`（增量 JSON 解析等工具）。
- **Models 集合**是运行时入口：同步的模型查询（`getModel`、`getModels`、`getProvider`）配合异步的 API 调用（`stream`、`complete`、`streamSimple`、`completeSimple`），`hasApi()` 守卫提供了完全的 TypeScript 类型安全。
- **流式 API** 定义了 11 种事件类型（`start` 到 `error`），不同内容块的事件可能交错出现，必须使用 `contentIndex` 做正确关联。`stream.result()` 获取完整的最终消息。
- **非流式 API**（`complete`、`completeSimple`）用于不需要实时输出的场景。`completeSimple` 的 `reasoning` 级别自动映射到各供应商的对应参数。
- **图像生成 API** 使用独立的 `ImagesModels` 集合，通过 `generateImages()` 调用，目前通过 OpenRouter 供应商提供。
- **认证解析**遵循明确的优先级链（显式 `apiKey` > 凭证存储 > 环境变量 > OAuth > ambient credentials），`getAuth()` 可无副作用查询认证状态。
- **四种核心 API 抽象**（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）各有不同的角色命名、工具调用格式和推理输出方式，pi-ai 在内部用统一的 IR 做桥接。
- **跨供应商上下文交接**是最惊艳的能力：切换模型时自动做角色映射、思维链痕迹转换（`<thinking>` 标签包裹）、工具格式标准化。这让"先用 Claude 推理，再用 DeepSeek 执行"这种多模型接力变得简单。
- **部分 JSON 解析**实现了工具调用参数的流式展示，支持实时 UI 更新——但在使用部分解析结果时必须保持防御性编程。
- **工具结果**统一为内容块数组（文本 + 图像），由工具实现者决定放什么到 LLM 可见的 `content` 中。
- **中止支持**通过 `AbortSignal` 贯穿整个调用管道，被中止的消息仍可追加到上下文历史继续后续请求。
- **错误处理**的核心理念是"永远不抛异常"——所有失败都转化为流式事件和消息状态，调用者通过 `stopReason` 和 `errorMessage` 获取信息。

下一章：[第十四章：核心架构pi-agent-core代理运行时](14-核心架构pi-agent-core代理运行时) 将进入 pi-agent-core——看看 Agent 循环、工具执行、事件流、状态管理、消息队列这些"Agent 运行时"层是如何构建在 pi-ai 之上的。

---
layout: default
title: 第10章：核心运行时：Session 日志与 Agent 循环
---

# 第10章：核心运行时：Session 日志与 Agent 循环

第 9 章讲了代码版图，这一章钻到运行时的心脏：一个 agent 的完整交互历史存在哪里、模型每一轮请求如何被拼装、一次 turn 从开始到结束经历了哪些事件。

答案是两件事的组合：`packages/core/session` 提供一条 append-only 的事件日志，`packages/core/agent-loop` 提供默认的驱动循环。理解这两者，你就理解了 dsh 里"模型看到了什么"这件事的全部真相来源。

本章事实以 [architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)、[agent-lifecycle.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/agent-lifecycle.md) 与 [session.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/session.md) 为准。

## 10.1 core 组的"产品 API 脊柱"

官方把 `packages/core/` 称为 **product API spine**（产品 API 脊柱）。它是插件与消费者共同构建其上的稳定表面。五个脊柱包：

| 包 | 职责 | ctx key |
|---|---|---|
| `core/session` | append-only `SessionEvent` 日志 + 内存 store | `ctx.sessions` |
| `core/system-prompt` | prompt 段与工具 schema 的装配注册表 | `ctx.systemPrompt` |
| `core/tools` | 作用域工具注册表 + 受守卫的执行管线 | `ctx.tools` |
| `core/agent` | `Agent` 接口、活注册表、`agent/*` 事件词汇表 | `ctx.agents` |
| `core/agent-loop` | 实现该接口的默认具体 driver | `ctx.agentLoop` |

外加两个配角：`core/scope` 提供作用域注册原语（纯库，无 key），`core/agent-default-model` 提供 Agent 入口的默认模型选择。

脊柱的分工原则是**契约与实现分离**：`agent` 拥有公开契约，`agent-loop` 是它的默认实现。扩展插件只依赖 `dsh-agent` 这个 seam，所以整个 driver 是可替换的。这一章的主角是后两者——`session` 定义"事实"，`agent-loop` 定义"过程"。

## 10.2 Session 日志：append-only 事件流与内存 store

`dsh-session` 提供内存中、事件溯源（event-sourced）的会话模型。一个 `Session` 是**一条 append-only 的 `SessionEvent` 类型日志**——它是 agent 完整交互历史的唯一事实来源。模型的 LLM 消息历史是从日志**派生**出来的，从不单独存储；重放就是对同一批事件重新派生。

一个 `SessionEvent` 是 `type` 上的判别联合（discriminated union），所以 `switch (event.type)` 就能无 cast 地收窄 `event.data`。它的字段：

- `seq`：日志内单调递增的序号，恒等于 `log.length`，保证连续。
- `time`：Unix epoch 毫秒。
- `data`：该事件类型的负载，`append` 时被 `isJsonValue` 运行时校验，必须是 lossless JSON。
- `ignorable?: true`：可选标记。带它的事件，读者不认识其 `type` 时可安全跳过；不带它的事件是必需的——读者遇到不认识且无此标记的 `type` 必须拒绝重建会话，因为静默跳过可能改变日志其余部分的解读方式。
- `sourceEventSeqs?`：仅 `SurfaceEventType` 有，列出本事件引用的早期事件序号（如构成 `assistant/message` 的 chunk 序号）。
- `surfaceOp?`：仅 `SurfaceEventType` 有，声明本事件如何进入有序 surface。

核心类型结构（镜像自 `packages/core/session/src/types.ts`）：

```ts
type SessionEvent<T extends SessionEventType = SessionEventType> = {
  [K in SessionEventType]: {
    type: K
    seq: number          // 单调序号，seq = log.length
    time: number         // Unix epoch ms
    data: SessionEventMap[K]
    ignorable?: true     // 纯信息记录、丢失不影响重建时置 true
  } & (K extends SurfaceEventType ? {
    sourceEventSeqs?: number[]   // 引用的早期事件 seq
    surfaceOp?: SurfaceOp        // 如何进入有序 surface
  } : object)
}[T]
```

`SessionEventType = keyof SessionEventMap`。因为 `SessionEventMap` 是 merge-extensible 的，对 `SessionEvent` 做 switch 时**不能用 `assertNever`**——插件新增的变体是合法的未知值，处理已知 case 后要落回 `default`。

承载这条日志的 `Session` 是一个普通类（不是 Cordis Service），通过 `ctx.sessions.create()` 建活实例。它的公开 API 主体（镜像自 `packages/core/session/src/types.ts` 的 public-api 投影）：

```ts
declare class Session {
  get surface(): SessionSurface        // 有序 surface 的只读投影
  readonly header: SessionHeader       // 深冻结的创建元数据（版本、cwd、血缘）
  get id(): SessionId                  // 从 header 单拷贝派生
  readonly firstLiveSeq: number        // 本进程第一条 append 的 seq
  static create(id?, seed?, header?): Session
  static fromRestore(id, seed, header): Session
  get events(): readonly SessionEvent[] // 不可变快照，事件深冻结
  get seq(): number                     // 下一条事件的 seq = log.length
  append<T>(type, data, ...opts): SessionEvent<T>
  requestHeader(): EpochHeader | undefined
  requestContext(): RequestContext | undefined
  deriveMessages(): Message[]
  deriveEventMessage(event): Message | null
}
```

几个字段的语义值得展开：

- **`header`** 是存储层面的元数据（格式版本、cwd、血缘、seed 边界），刻意**不进事件日志**——它是 storage concern，不是可重放的会话状态。没有 store 提供的 header 时，会合成一个盖着当前 `SESSION_FORMAT_VERSION` 的最小 header，所以 `session.header` 永远存在。
- **`firstLiveSeq`** 是本进程 append 的第一条 seq：等于构造函数 seed 的长度（无 seed 时为 0）。更小 seq 的事件经构造函数进入（replay、fork、resume），从不发布到 `session/event` firehose（seed 不发事件）。它区别于 `header.seedLength`——后者是**持久的** fork 血缘边界。
- **`append`** 是热路径：事件进日志即提交，观察者失败被记录且隔离，不回滚 append。返回的是进入日志的那条事件（含分配的 seq/time），`event.data` 读到的是日志里的快照，而不是调用方手里仍可变的输入。

`ctx.sessions` 是内存 store（`SessionStore`），它刻意**不实现持久化**——持久化插件订阅 `session/event` 事件流，在 `session/flush` 或 dispose 时刷盘。这样存储后端（JSONL / SQLite）与日志核心解耦，热路径永不阻塞在 I/O 上。

## 10.3 SessionEventMap：事件词汇表

事件词汇表由 `SessionEventMap` 定义，且是 **merge-extensible** 的——插件通过 declaration merging 声明自己的事件类型。例如 compaction seam 增加 `compaction/start`/`compaction/summary`/`compaction/end`，hook bridge 增加 log-only 的 `hook/invoked`/`hook/result`。

核心自带的事件成员（来自 [session.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/session.md)）：

| 事件 | 负载 | 说明 |
|---|---|---|
| `turn/start` | `{ turn }` | 在 claim 排队输入或跑 pre-step 前打开 turn；拒绝、空输入、取消、失败都可能让它不花 step 就关闭 |
| `turn/end` | `{ turn, reason }` | 用 `TurnEndReason` 关闭 turn |
| `step/start` | `{ turn, step }` | 打开 turn 的第 step 步——一次模型调用 + 它请求的工具执行 |
| `step/end` | `{ turn, step }` | 关闭该 step |
| `user/message` | `UserMessage` | 模型可见面上的 user 消息：人类 prompt、`agent.inject()` 合成上下文、goal 续轮，`source` 区分来源 |
| `assistant/chunk` | `{ turn, step, chunk }` | raw 流式 chunk，token 级重放保真 |
| `assistant/message` | `{ turn, step, message, usage? }` | 装配后的 assistant 消息；携带 usage 与 `sourceEventSeqs` |
| `tool/call` | `{ turn, step, callId, name, arguments }` | 模型请求一次工具调用；`arguments` 是模型产出的原始 JSON 字符串，未解析 |
| `tool/result` | `{ turn, step, message, error?, meta? }` | 完成调用的模型可见结果；`callId` 与 `tool/call` 配对 |
| `todo/write` | `{ todos }` | 全列表快照，latest write wins；log-only UI 状态，永不进派生历史 |
| `request/header` | `{ header, reason }` | 下一次请求的完整信封（config + system + tools），在 step 内、派发前追加 |
| `request/context` | `RequestContext` | 路由元数据（provider/model/contextWindow），仅当路由或容量变化时记录 |
| `session/end-seed` | 空 | 标记构造函数 seed 的结束；之前的较小 seq 事件来自 seed |

其中 `user/message`、`assistant/message`、`tool/result` 是三个 **message-producing** 的 `SurfaceEventType`——只有它们会产生 LLM 消息，也只有它们能携带 `SurfaceOp` 与 `sourceEventSeqs`。其余都是结构性或 log-only 事件。

`todo/write` 的负载 `TodoItem` 是刻意最小化的：一条 `content` 行加一个三态 `status`（`pending` / `in_progress` / `completed`），没有 id、优先级或 `activeForm`。因为列表每次写入都被整体替换（last-write-wins），条目不需要稳定身份。

`user/message` 的 `source` 字段区分三种来源——直接人类 prompt、`agent.inject()` 合成上下文、entered goal 续轮——三者都把 `content` 原样投影，`source` 负责把它们分开。`tool/result` 的 `meta` 字段对 core 不透明（产生它的工具拥有形状，并在 `presentResult` 里读回来），但**必须 JSON 可序列化**：`Session.append` 用 `isJsonValue` 运行时校验所有事件数据，非可序列化的 `meta` 在源头就被拒，所以持久日志在重放时能复现同一张卡片。

`request/header` 值得单独强调：它把整个请求信封（调用配置、渲染后的 system prompt、装配后的工具 schema）记录成会话状态，所以**每一次会话请求都是日志的纯函数**。一个 reason 为 `'initial'` 或 `'resume'` 的完整快照记录每次循环实例边界；之后变化的请求以 reason `'change'` 再记一条完整快照。`foldRequestHeader(events)` 通过选取最新快照重建信封：

```ts
interface EpochHeader {
  config: LlmCallConfig              // provider、model、reasoning effort、采样参数
  adapterDefaults?: LlmCallConfigAdapterDefaults
  system?: string                    // 渲染后的 system prompt；无 system 的请求缺省
  tools?: ToolSchema[]               // 装配后的工具 schema；无工具的请求缺省
}

interface RequestContext {
  provider: string
  model: string
  contextWindow?: number             // 广告出的最大上下文 token 数
}
```

canonical 形态把空的 system prompt 或工具列表表示为**缺省字段**，与请求构建方式一致。`request/context` 与 `request/header` 分开记录，是因为 capacity 描述的是路由而非请求输入，把它折进信封会让一次 capacity 变化被误判为请求 envelope 的 `change`。

## 10.4 铁律：Model-visible 等价于 logged

这是整章最重要的不变量，原文一句话：

> **Model-visible means logged.** Anything that reaches a model request must be reconstructable from the log, and a runtime invariant asserts it.

翻译过来：**凡是进入模型请求的内容，都必须能从日志重建；运行时 invariant 会断言这一点。** 日志是模型所见的上下文的唯一来源，fork、resume、transcript、telemetry、persistence 全都从这条流派生。

它的直接推论是：**新增一种"模型可见输入"，就必须新增一种 session 事件**——扩展 `SessionEventMap`，然后从日志渲染它。没有任何"绕过日志直接塞给模型"的后门，因为开发期的 invariant（dev invariant）会拿派生历史与日志前缀做交叉验证，两者用完全相同的投影规则，一旦不一致立刻暴露。

为什么这么设计？因为如果允许"内存里有一条消息、日志里没有"，那么 resume 之后的会话就与崩溃前不一致，transcript 与模型实际所见也会分叉。把日志树为唯一事实源，代价是任何模型可见内容都必须先"过日志"这一关——换来的是一致性由构造保证，而不是靠各处小心同步。

## 10.5 deriveMessages() 与 surface 投影

`Session.deriveMessages()` 把事件日志投影成模型看到的 `Message[]`。它是有缓存的（每个 surface 节点首次见到时投影一次，surface 重写时重建）且冻结的（每次返回新数组，但数组内的 `Message` 是共享的深冻结对象，无法通过投影改写日志）。`deriveEventMessage(event)` 是 fold 逐节点应用的纯函数，对外公开——外部重建器与 dev invariant 用完全相同的规则投影日志前缀，不可能与缓存产生分歧。

投影规则（来自 [session.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/session.md)）：

| 事件 | 投影结果 |
|---|---|
| `user/message` | 一条 user 消息，携带精确的 `content` |
| `assistant/message` | 一条 assistant 消息，带产生它的 provider 与 model |
| `tool/result` | 一条 user 消息，携带 `tool-result` block |
| `user/message`（注入上下文，非 user 来源） | 一条 user 消息，按其时间位置原样携带 `content` |
| `assistant/chunk` | **跳过**——它是重放/UI 数据，装配后的 `assistant/message` 才是权威 |
| `turn/*`、`step/*` 等结构性事件 | 不投影成消息 |

两个保真细节值得注意：

- **`assistant/chunk` 原样回放**。raw chunk 事件保留 token 级的重放保真度，`assistant/message` 通过 `sourceEventSeqs` 精确列出构成它的 chunk 序号（包括显式的空数组）。日志里 `seq` 必须连续，所以 chunk 不能被过滤出 canonical 日志。
- **空 content 的 assistant 消息不进历史**。一个被 `max-tokens` 截断、没有任何内容的 step 仍会记录 `assistant/message` 来承载 usage、provider、model，但 content-less 的 assistant turn 不得进入 provider transcript。`assistant/message` 记录每一次成功的 provider 调用，包括 content-less 与 `max-tokens` 结束的调用。

投影走的是 surface 概念。三个 `SurfaceEventType` 的每次 append 都声明 `surfaceOp` 表明自己如何进入有序 surface：

```ts
type SurfaceEventType = 'user/message' | 'assistant/message' | 'tool/result'

type SurfaceOp =
  | 'append'
  | { op: 'replace'; start: number; end: number }
```

- `'append'`：普通尾部追加，user/assistant/tool 消息的正常路径。
- `{ op: 'replace', start, end }`：用本节点替换从 `start` 到 `end`（含）的 surface 节点，`start === end` 替换单个节点。compaction 用它把一段被摘要的区间替换成摘要节点，`sourceEventSeqs` 必须包含所有被遮蔽的 surface 节点。

所以 compaction 不删除历史——它用 `replace` 在 surface 上"遮蔽"一段旧区间，日志本身仍完整可回放。人类可读的 transcript 读日志的 append 原点事件，模型历史读 surface 投影，两者各取所需。

与 `surfaceOp` 配套的是 `SurfaceIntent`——传给 `session.append()` 的 surface 位置参数：

```ts
interface SurfaceIntent {
  surfaceOp: SurfaceOp
  sourceEventSeqs?: number[]   // 已知源事件的完整集合
}
```

它是 message-producing 事件的必填参数，log-only 事件在编译期就拒绝它。只有 `assistant/message` 可以带 present 的空 `sourceEventSeqs`（表示已知为空的 provider 流）。

`Session.surface` 返回稳定的 `SessionSurface` 视图：

```ts
interface SessionSurface {
  nodes: readonly number[]          // 当前 surface 事件 seq，按模型可见顺序
  replaceGeneration: number         // 已提交位置替换的单调计数
}
```

`replaceGeneration` 让增量消费者能区分"纯尾部增长"和"一次重写"——compaction 触发 `replace` 时它递增，其余 append 不动它。这套机制保证派生历史与 surface 投影永远由同一份增量管理器驱动，不会各算各的。

## 10.6 turn 与 step：循环的基本单位

dsh 的循环用两个词计量，区分清楚才读得懂时序图：

- **step**：一次模型请求 + 它调用的那些工具。一个 step 对应一条 `step/start` 到 `step/end`。
- **turn**：零个或多个 step。turn 在它的第一条输入被 claim 之前打开，在"不再欠任何东西"时关闭。

"零个"不是笔误：如果 `agent/pre-step` 拒绝了首次 claim，或者首次 claim 被改写成空，turn 也会关闭——只是没花任何 step。日志里仍会记录 `turn/start` 与 `turn/end`，因为**被拒绝的尝试本身也是事实**。

turn 为何结束，由 `TurnEndReasonMap` 表达，它同样是 merge-extensible 的：

```ts
interface TurnEndReasonMap {
  completed: { kind: 'completed' }
  aborted: { kind: 'aborted'; reason: TurnEndCancelCause }
  blocked: { kind: 'blocked' }
  error: { kind: 'error'; error: LlmFailure }
  'max-tokens': { kind: 'max-tokens' }
  interrupted: { kind: 'interrupted' }
}
```

| reason | 含义 |
|---|---|
| `completed` | 正常完成 |
| `aborted` | 取消请求中断了活 turn，携带 `TurnEndCancelCause` |
| `blocked` | 被阻塞 |
| `error` | turn 失败，`error` 是结构化失败（`LlmError` 原文，或扁平化后的 `{ message, code: 'UNKNOWN' }`） |
| `max-tokens` | 至少一个 step 触及输出 token 上限，即使插件继续了 turn |
| `interrupted` | 持久化后端在 reload 时关闭了崩溃遗留的 turn；循环本身从不发出此标记 |

`max-tokens` 镜像了模型调用的 `FinishReason`：turn 内任一 step 是 `max-tokens`，整个 turn 就以 `max-tokens` 结束而非 `completed`——"被截断"的事实压过"后来继续了"，消费者据此区分干净停止与截断。`interrupted` 是唯一循环不发出的 reason，由崩溃恢复合成。

## 10.7 完整 turn flow 时序

下面是默认 driver 的一次 turn 从唤醒到结束的完整事件流。方括号标注的是持久的 session 事件，其余是 live 扩展点。这是 architecture.md 文本图与 agent-lifecycle.md 时序图的合并视图：

```text
用户 followup(content)
  -> agent/inbox/spliced            （入站队列裁剪广播）
  -> agent/inbox/inserted {message}（消息入队广播）
  排队工作唤醒 driver
  -> agent/status running

[turn/start]
  claim 挂起的 next-step 输入 + 一条排队 prompt
  -> agent/inbox/spliced           （纯删除广播）
  -> agent/inbox/claimed {message, turn}   （逐条广播）
  -> agent/pre-step  (waterfall)   （权威 reject 或 enter(messages)）
     若被拒 / 首次 claim 改写为空 -> 关闭 turn，不花任何 step
     否则进入 step：
       [step/start]
       [user/message]             （每个进入的消息一条）
       装配 prompt 段 + 工具 schema（system-prompt/assemble, waterfall）
       从日志派生模型历史 deriveMessages()
       -> agent/request (waterfall) -> llm/stream (waterfall)
          -> StreamChunk*  -> [assistant/chunk]*
       请求失败 -> [step/end] -> agent/request-error (waterfall)：重试或保留原错误
       [assistant/message]        （携带 usage + sourceEventSeqs）
       [tool/call]*               （每次调用一条：name + 原始 arguments JSON）
       -> tools/pre-execute   (waterfall, 有序)
       -> tools/execute       (concurrent)
       -> tools/post-execute  (waterfall, 有序)
       [tool/result]*             （callId 配对）
       [step/end]
       工具还欠另一次请求，或 next-step 输入到达 -> claim -> 下一个 step
  -> agent/turn-stopping (serial)  （自然停止且 next-step inbox 为空时）
[turn/end]
  -> agent/status idle
```

逐阶段解释：

1. **入站与唤醒**。输入经单一 inbox 到达 driver。`agent/inbox/inserted`/`agent/inbox/spliced` 让 UI 与监听者看到队列变化；排队的工作唤醒 driver，状态切到 `running`。
2. **turn/start 与 claim**。driver 打开 turn，claim 挂起的 next-step 输入外加一条排队 prompt，逐条广播 `agent/inbox/claimed`。
3. **agent/pre-step**。这是"决定模型看到什么"的 waterfall。监听者可以改写被 claim 的消息，也可以权威地拒绝。被拒或首次 claim 改写为空，会关闭一个没花 step 的 turn，日志记录这次尝试。
4. **step/start 与 user/message**。进入 step，把进入的消息逐条以 `user/message` 写入日志。
5. **装配与派生**。`system-prompt/assemble` 把所有插件注册的 prompt 段与工具 schema 拼装起来（它是 waterfall，监听者只有 `agent`、`agent-presets`、`system-prompt` 三个），`deriveMessages()` 从日志投影出模型历史。每个 step 读到的 prompt 段与工具 schema，正是插件们在此之前通过注册贡献的那份。
6. **模型请求与流式**。`agent/request` waterfall 构造请求，`llm/stream` waterfall 触发适配器流式返回；raw chunk 逐条以 `assistant/chunk` 落日志。请求失败则走 `agent/request-error` waterfall 决定重试还是保留原始错误。
7. **assistant/message**。流结束，装配出 `assistant/message`，记录 usage 与构成它的 chunk 序号。
8. **工具执行管线**。模型请求的每个工具调用先写 `tool/call`（参数是模型产出的原始 JSON 字符串，未解析），再依次过 `tools/pre-execute`（有序）、`tools/execute`（并发）、`tools/post-execute`（有序），结果以 `tool/result` 落日志。
9. **step/end 与续步**。一个 step 结束。若工具欠另一次请求，或 next-step 输入已到达，则 claim 进入下一个 step。
10. **agent/turn-stopping 与 turn/end**。自然停止且 next-step inbox 为空时，跑 `agent/turn-stopping` serial 检查点，然后写 `turn/end`，状态回到 `idle`。

`agent/pre-step` 返回的决策是权威的：监听者 wrap `next()` 时默认保留下游消息，除非有意替换。steering 与注入上下文在后续 claim 操作取走它们的 next-step 批次后，经过同一条 waterfall。

## 10.8 事件三类分域

dsh 的事件不都平等。选对事件域是大多数改动要做出的第一个决策。architecture.md 把事件分成三类：

| 域 | 性质 | 用途 | 例子 |
|---|---|---|---|
| Session 事件 | 追加到日志、经 `session/event` 广播的**持久事实** | 必须在 reload 后存活的 | `turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*` |
| Agent 事件（`agent/*`） | 携带活 `Agent` 的**实时观察** | 观察或拦截进行中的工作 | inbox、step、status、request、validation、continuation |
| Capability 事件 | 把策略/适配器挂到 seam 上的**挂载点** | 给 seam 挂策略而不 import 循环 | `fs/*`、`tools/*`、`telemetry/*` |

判别标准就一条：**这个事实 reload 之后还需要吗？** 需要，就写成 session 事件；只是想在流程进行中看一眼或拦一下，就用 `agent/*`；想给某个能力缝上策略，用 capability 事件。三者各司其职，混用会让日志里塞进不持久的实时噪声，或者让拦截点无法持久。

完整的事件生产者/消费者矩阵由 [event-producer-consumer.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/event-producer-consumer.md) 维护，它列出每个 harness 自有事件由哪些包 dispatch、被哪些包监听。`agent/*` 事件词汇表：

| 事件 | 模式 | 说明 |
|---|---|---|
| `agent/created` / `agent/disposed` | emit | agent 生命周期 |
| `agent/status` | emit | 状态（running/idle 等） |
| `agent/error` | emit | 错误广播 |
| `agent/session-start` | emit | 会话启动 |
| `agent/inbox/inserted` / `spliced` / `claimed` / `discarded` | emit | inbox 队列事件 |
| `agent/pre-step` | waterfall | 决定模型看到什么 |
| `agent/request` | waterfall | 构造请求 |
| `agent/request-error` | waterfall | 失败恢复 |
| `agent/turn-stopping` | serial | turn 关闭检查点 |

几个关键事件的消费者面：

- `agent/pre-step` 的监听者最多：`agent-instructions`、`compaction-basic`、`plan-mode`、`repeat-tool-reminder`、`session-checkpoint-policy`、`time-context`、`tool-skill` 等十余个。
- `agent/request-error` 的监听者只有两个：`compaction-basic` 与 `llm-retry`——重试与压缩正是这两个。
- `agent/turn-stopping` 的监听者只有 hook bridge（`hooks-claude-code`、`hooks-codex`）。
- `session/event` 的监听者最多：`acp`、`agent-loop`、`token-meter`、`session-persistence`、`session-title`、`tool-workflow` 等。

`session/event` 是 post-commit、fire-and-forget 的追加流：监听者快照在 log push 之前解析，但回调在之后运行；观察者失败被记录且被隔离，不会让已提交的 append 失败。

## 10.9 waterfall 与 serial：两种事件语义

turn flow 里的事件分两种 dispatch 语义（第 8 章讲过 Cordis 的 `ctx.waterfall` 与普通事件）：

- **waterfall**：监听者必须调用 `next()` 把控制权交给下一个监听者，任何一环都可以改写结果或中止。`agent/pre-step`、`agent/request`、`llm/stream`，以及三个 `tools/*` 事件都是 waterfall。
- **serial**：按顺序依次执行，没有 `next()`。`agent/turn-stopping` 是 serial，是 turn 关闭前的终端检查点。

为什么这些是 waterfall？因为它们都在"生产一个结果"——pre-step 产出"进入 step 的消息集"，request 产出"模型请求"，stream 产出"响应流"，tools 三件套产出"执行结果"。瀑布语义让多个插件对同一个结果做有序改写：注入上下文、改写 system prompt、拦截工具调用，都能插进同一条链而不需要互相知道。

而 `agent/turn-stopping` 是 terminal checkpoint，没有下游结果要传递，只是让多个守卫在 turn 关闭前依次跑一遍，所以是 serial。

三个 `tools/*` 事件虽然都是 waterfall，语义却不同：`tools/pre-execute`（有序）与 `tools/post-execute`（有序）是策略挂载点——`pre-execute` 的监听者包括 `hooks-claude-code`、`hooks-codex`、`tool-jobs`，`post-execute` 的监听者包括 `repeat-tool-reminder`、`spill-policy`、`tool-fs-search`；`tools/execute` 本身是并发执行点，监听者只有 `session-checkpoint-policy` 与 `timeout-policy`（截止时间强制器）。一个工具调用穿过了"拦截→执行→收尾"三段，每一段都有独立的水位可以让插件插手。

对照 event-producer-consumer.md 的 Mode 列，还能看到第三种语义 `parallel`——`session/flush` 就是 parallel：每个监听者都跑、调用方等全部，但没有任何 waterfall 否决权。

## 10.10 inbox：单一入站入口与注入队列

所有输入经**同一个 inbox** 到达 driver。inbox 的精细语义在 [architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) 里写得很克制：

- 有些消息**立即唤醒** driver。
- 注入的上下文**在 inbox 里等待**，直到另一条消息把它唤醒。

第二条正是 `agent.inject()` 的语义：你往会话注入的模型可见上下文（文件变更通知、子目录 AGENTS.md、skill 内容、cron 通知等）不会自己开一个 turn，而是排队等待下一次入站消息把它带进 `agent/pre-step` 的 claim 批次，最终以 `user/message` 落地。inbox 相关的 `agent/*` 事件已在 10.8 列出。

所以"给模型加上下文"的标准姿势不是直接调模型，而是 `agent.inject()`——注入内容走完同一条 inbox 到日志的路径，天然满足 10.4 的铁律。architecture.md 的扩展速查表把这条列得最清楚："Add model-facing context → call `agent.inject()`; it lands in the next admitted request."

## 10.11 ctx.sessions store API 与 fork

`ctx.sessions` 是 `SessionStore`，除了 `get`/`list` 这种查询，它的生命周期 API 设计成"复合 effect 可折叠"的形态：

| 方法 | 作用 |
|---|---|
| `create(id?, options?)` | 建会话并进入 store，已 entered 且 announced |
| `prepare(id?, options?)` | 建会话但**不**进入 store，配 `enter` + `announce` |
| `enter(session)` | 装入 store，装发布钩子，返回 detach disposer，不发 `session/created` |
| `announce(session)` | 对 entered 会话发一次 `session/created` |
| `flush(session)` | 派发被 await 的 `session/flush` 持久化检查点 |
| `get(id)` / `list()` | 查询活会话 |
| `fork(source, boundary?, childSessionId?)` | 从活源会话的稳定前缀建活子会话 |

`prepare` + `enter` + `announce` 三件套存在的原因很具体：agent 的会话生命周期要与其 loop **按顺序**一起拆除（loop 的最终事件必须在 store attachment 结束前发布），所以 agent factory 把会话生命周期折叠进同一个 `ctx.effect`，而不是让会话与 agent 作为两个竞速的兄弟 effect 各自拆除——那样可能在 driver 的关闭事件提交前就把发布钩子摘了。

`session/*` 事件的语义：

| 事件 | 模式 | 语义 |
|---|---|---|
| `session/created` | emit | 进入 store 时发一次；同步 throw 会否决并回滚 |
| `session/disposed` | emit | 会话离开 store 时发一次 |
| `session/event` | emit | post-commit、fire-and-forget 的追加流 |
| `session/flush` | parallel | awaited 持久化检查点，所有监听者都跑 |

`fork` 的语义也值得注意：它接受活 `Session` 或活 `SessionId`，通过 inclusive 的 `boundary` seq 选源事件（默认当前最后一条），要求选中前缀结束在 turn 之外，然后创建深克隆 seed 事件的子会话（带 `parentSession`、`seedLength`、继承的 `cwd`）。显式 `boundary` 允许从任意稳定的 turn 之间位置 fork。API **拒绝**结束在开放 turn 内的前缀，而不是静默裁剪。

## 10.12 新增"模型可见输入"的正确姿势与 SESSION_FORMAT_VERSION

结合 10.4 的铁律，新增一种模型可见输入的正确步骤是：

1. 扩展 `SessionEventMap`，声明新的事件类型（declaration merging）。
2. 让它在 `deriveMessages()` 的投影规则里渲染出对应消息。
3. 从日志渲染（replay 时也能重建），而不是在内存里另存一份。

这就是为什么 compaction 的 `compaction/summary`、hook bridge 的 `hook/*` 记录都长在 `SessionEventMap` 上——它们是模型可见或有日志语义的事实，必须进日志。插件贡献的 log-only 事件不是 `SurfaceEventType`，不进派生历史；它们的拥有者决定它们属于某个开放 turn 还是可以站在 turn 之间。

与此配套的是 **`SESSION_FORMAT_VERSION`** 的单调演进语义。每个会话的 header 在创建时盖上当前的 `SESSION_FORMAT_VERSION`；持久化后端加载时拒绝任何其他版本，报 `SessionFormatUnsupportedError`（区别于 `SessionPersistenceCorruptionError`——前者不是损坏，是版本不匹配）。方向由版本号给出：

- header 版本**高于**当前构建 → 报告"由更新的 harness 写出，请升级 harness 才能打开"。
- header 版本**低于**当前构建 → 报告"本构建不提供升级路径"。

因为在 developer preview 期间**故意不做兼容承诺**，所以旧格式不是被迁移，而是被拒绝——报错会指明方向，而不是静默丢数据。JSONL 后端从原始 header 行就拒绝外来版本，SQLite 后端先用自己的 `SCHEMA_VERSION` pragma 把关整文件结构。事件级同理：日志里出现本构建生成词汇表（`KNOWN_SESSION_EVENT_TYPES`）之外的事件类型，同样拒绝——除非该事件信封带 `ignorable: true`，因为静默跳过一个未识别的必需事件可能改变日志其余部分的解读方式。设计理由与暂缓的升级器链在 `.agents/notes/implemented/architecture/2026-08-10-session-log-version-mechanism.md`。

一句话总结：**格式版本单向递增，旧日志明确拒绝而非静默升级**。这牺牲了"无缝读旧数据"，换来了"日志语义永远可信"。

## 10.13 错误恢复与取消

循环不是只走 happy path。两处错误处理机制值得单独说：

**请求错误与重试**。模型请求失败后，driver 写 `step/end`，然后跑 `agent/request-error` waterfall，监听者返回重试动作或保留原始错误。`llm-retry` 在这里实现 provider 作用域的重试；`compaction-basic` 在这里只处理 canonical context overflow——当上下文确实溢出时，触发可选的工具结果裁剪与摘要选择，在关闭的失败 step 与失败 turn 关闭之间做恢复，只在裁剪或摘要推进了 surface 替换代际时才开一个全新的重试 turn，否则原始请求错误保持权威。

**取消**。`turn/end` 的 `aborted` reason 携带 `TurnEndCancelCause`（`AgentCancelCause` 或导入时的 `{ kind: 'legacy' }` 粗粒度记录）。活的 turn 保留停掉 driver 的取消原因，`agent/turn-stopping` 是取消/停止前的检查点。

这两处都与 session 日志咬合：失败的模型请求没有 assistant message，所以它的 usage chunk 是持久的计量记录；token 计量读每 step 的 `assistant/chunk { type: 'usage' }` 记录，把 `assistant/message.usage` 当作无 usage chunk 时的已提交 step 兜底。

## 10.14 持久化契约与 seed 边界

日志核心给持久化后端提供的契约只有一条：**每条事件都无损持久化，包括 `assistant/chunk`**——`seq` 必须连续，所以 chunk 不能被过滤出 canonical 日志。后端可以选择自己的存储编码（JSONL 后端的默认 packed chunk rows 就是其中一种），只要 `load` 返回与 append 时完全一致的事件。所有 `event.data` 都必须是 JSON 可序列化的，`Session.append` 在源头强制（非可序列化数据直接抛错），所以坏事件进不了日志，`session.events` 永远等于后端能持久化的东西。

`session/end-seed` 是这个契约里的一个精巧边界：一个 seeded 会话（resume、fork、replay）会在它的构造函数 seed 之后、作为第一条 live 写入，追加这条 log-only 事件。它之前的事件 seq 更小、来自 seed，这条生命周期没有产出它们。它的 payload 是空的，位置与 `time` 承载全部含义。

它存在的理由是：seed 历史与 live 工作**字节级无法区分**。一个 `compaction/start` 的未闭合括号，无论写作者是"崩溃在压缩中"还是"此刻正在压缩"，读出来都一样。`session/end-seed` 让拥有独立 open/close 括号的插件能判断：这个 opening marker 之前的边界属于一个已结束的生命周期（无论它是怎么结束的），可以当死历史处理。core 写这个边界但什么都不读它——括号词汇表属于它自己的插件，这也是为什么崩溃修复关 `turn/step/tool` 边界而从不关 `compaction/*`。

## 10.15 与第 8 章 Cordis 范式的呼应

把这一章倒回第 8 章，会发现整个 agent 循环就是**用 waterfall 事件拼出来的插件组合**。

第 8 章讲的是：Cordis 里每个部分都是插件——模型适配器、工具注册表、session 日志、agent 循环本身，全都可替换，注册是 reversible effect，插件卸载时撤销。这一章看到的正是这套范式在运行时展开的样子：

- `llm/stream`、`tools/*`、`agent/pre-step` 这些 waterfall，是"模型适配器插件"与"策略插件"共享的缝。你替换一个 provider，只是往 `ctx.llm` 上注册了另一个适配器，循环代码一行不改。
- `session` 是插件（挂 `ctx.sessions`），`agent-loop` 也是插件（挂 `ctx.agentLoop`）——driver 可以被整个换掉，因为扩展只依赖 `dsh-agent` 契约。
- 事件域的三分类，对应第 8 章"插件贡献 services、typed events、reversible effects"中的 typed events 一层：`session/*` 是持久事实、`agent/*` 是实时协调、`capability` 是挂策略的 seam。

没有特权核心可以 patch——你扩展 dsh 的方式，是把一个插件挂到别的插件旁边，注册行为在插件卸载时自动 unwind。这就是为什么"新增模型可见输入"要扩展 `SessionEventMap`：你是在**扩词汇表**，而不是在一个中心函数里加 if 分支。

## 10.16 本章小结

- `packages/core/` 是产品 API 脊柱：`session`（事实）、`system-prompt`（装配）、`tools`（执行）、`agent`（契约）、`agent-loop`（默认实现）五个包，契约与实现分离。
- session 是 append-only `SessionEvent` 日志，是模型上下文的唯一来源；`ctx.sessions` 是内存 store，持久化由订阅 `session/event` 的插件负责。
- `SessionEventMap` 是 merge-extensible 的事件词汇表；`user/message`、`assistant/message`、`tool/result` 是三个 message-producing 的 `SurfaceEventType`。
- 铁律"Model-visible 等价于 logged"：凡进模型请求的内容必须能从日志重建，运行时 invariant 断言之。
- `deriveMessages()` 从日志投影模型历史：raw chunk 保真回放、空 content 不进历史、`replace` surfaceOp 支持 compaction。
- step = 一次模型请求 + 它调用的工具；turn = 零或多个 step；`TurnEndReasonMap` 表达 turn 为何结束。
- 完整 turn flow：`turn/start → agent/pre-step → step/start → user/message → agent/request → llm/stream → assistant/chunk* → assistant/message → tool/call* → tools/* 三件套 → tool/result* → step/end → agent/turn-stopping → turn/end`。
- 事件三类分域：session 事件（持久事实）、`agent/*`（实时观察/拦截）、capability 事件（挂策略到 seam）。
- waterfall 与 serial 两种语义：`agent/pre-step`、`agent/request`、`llm/stream`、三个 `tools/*` 是 waterfall（必须 `next()`），`agent/turn-stopping` 是 serial（无 `next()`），`session/flush` 是 parallel。
- 输入经单一 inbox 到达 driver；`agent.inject()` 的上下文排队等待下一次入站消息。
- `ctx.sessions` 的 `prepare`/`enter`/`announce` 支撑会话与 loop 的按序拆除；`fork` 从稳定前缀建子会话。
- 新增模型可见输入 = 扩展 `SessionEventMap` 并从日志渲染；`SESSION_FORMAT_VERSION` 单调演进，旧格式被明确拒绝而非静默迁移。
- 错误恢复经 `agent/request-error` waterfall（`llm-retry` 重试、`compaction-basic` 处理上下文溢出），取消由 `aborted` reason 与 `agent/turn-stopping` 表达。
- 持久化契约要求每条事件无损落盘；`session/end-seed` 区分 seed 历史与 live 工作。
- 整个循环是第 8 章 Cordis 范式的展开：插件用 waterfall 事件拼出 agent 循环，无一环节不可替换。

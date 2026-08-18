---
layout: default
title: 第07章：ACP 与 JSON-RPC 自动化接入
---

# 第07章：ACP 与 JSON-RPC 自动化接入

第 1-6 章讲的是"人怎么用 dsh"：Web UI 点按钮、CLI 敲命令、Python SDK 里调函数。这一章换一个视角——**让另一台机器、另一个程序来驱动 dsh**。这是 agent 世界里最常见的一类需求：一个 parent agent 要调度多个子 agent；一个 CI 管线要跑一次性任务；一个后端服务要把 agent 能力封装成接口对外暴露。

dsh 为这类"程序化接入"准备了三个层次的东西：面向自动化的 **ACP server**、通用的 **SDK JSON-RPC 协议栈**，以及把两者串起来的**类型安全 Remote 契约**。理解它们的边界，是写自动化客户端、也理解第 12 章"扩展开发实战"的前提。

> 警告：dsh 目前是 **developer preview**，`THERE WILL BE COMPATIBILITY-BREAKING CHANGES`。本章涉及的协议方法、wire 字段名都可能随版本破坏性变更，写生产客户端前务必以 [master 原文](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/README.md) 为准。

## 7.1 ACP 是什么：面向自动化的 server

ACP（Agent Client Protocol，[agentclientprotocol.com](https://agentclientprotocol.com)）是一个开放的 agent 互操作协议，由 Zed 等编辑器生态推动，目标是一条"任何 agent 客户端都能接任何 agent 后端"的通用线协议。dsh 对它的定位非常克制，在 [packages/acp/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/README.md) 里第一句就划清了边界：

> It is an interoperability transport, not a presentation or human-interaction layer.

翻译过来：ACP 组是把 harness 的 agent 通过 ACP 协议暴露给**程序化客户端**的传输层，不是给人用的界面层。它对应的包是 [packages/acp/acp/](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/acp/README.md)（npm 名 `@deepseek-ai/dsh-acp`）。配套的进程外 subagent *客户端* 不在这个组里，而在 [subagent/subagent-acp](https://github.com/deepseek-ai/deepseek-harness/blob/master/subagent/subagent-acp/README.md)，因为它实现的是 subagent provider 接口。

ACP 的传输形态，就是本章标题里的另一半——**JSON-RPC stdio**：

| 特性 | 说明 |
|---|---|
| 传输 | 进程 stdio，stdout 上每行一个紧凑的 JSON-RPC 2.0 帧（newline-delimited） |
| 定位 | 自动化 server；不是 Web UI、不是编辑器插件、不是人机交互层 |
| session 语义 | 一个连接可以持有多个 session，每个 session 独立 |
| 生命周期 | 每个 `session/new` 创建一个全新的 agent，持久化到 JSONL |
| 不暴露什么 | 编辑器导航、transcript 回放、命令、模式、配置选择器、计划、标题、工具呈现——这些都属于 Web Host 和 client 模块 |

为什么是"stdio + 每行一个 JSON 帧"？因为这是进程间通信里最朴素、最可靠的形态：父进程 `spawn` 子进程，写它的 stdin、读它的 stdout，不需要端口、不需要握手前的网络协商、不关心对方用什么语言写。Python SDK、TypeScript SDK、ACP server 三条线共用同一套"子进程 + newline-delimited JSON-RPC"的骨架，区别只在于上层封装。

ACP 的 plugin 极薄：`apply(ctx, config)` 在 stdin/stdout 上开一个 `AgentSideConnection`，然后驱动 `ctx.agents`。两个配置项：

| Config | 默认 | 含义 |
|---|---|---|
| `provider` | — | 每个新 agent 的初始 provider 路由 |
| `model` | — | 每个新 agent 的初始模型 |

两者都可选——允许另一个 agent/request 监听器来补上目标路由，但"可运行的 ACP 组合"必须同时具备二者。

### 7.1.1 协议契约：七个方法

[dsh-acp 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/acp/README.md) 把 ACP server 支持的协议面收敛成七个方法。这是写任何 ACP 客户端都要背下来的契约：

| Method | 行为 |
|---|---|
| `initialize` | 协商支持的版本；只有挂载了持久化附件存储、且配置的精确 provider/model 显式声明图片输入时，才广告图片提示；audio 与 embedded context 恒为 false；不广告 session/editor/terminal/filesystem/MCP 能力 |
| `authenticate` | no-op，因为 server 不广告任何认证方法 |
| `session/new` | 用绝对主 `cwd` 创建全新 agent；空 `additionalDirectories` 与 `mcpServers` 被接受，非空则拒绝 |
| `session/prompt` | 保留有序文本与受支持的 inline 图片块，resource link 渲染成带括号的文本引用；拒绝 audio、embedded resource、格式非法/空输入、以及未广告能力时的图片；每次 session 只允许一个 in-flight 请求 |
| `session/cancel` | 标记并中止 in-progress 的入队，但不取消无关 Agent 工作；prompt 结算为 `cancelled`；无 in-flight 时取消自主工作；未知 id 是 no-op |
| `session/update` | 对一条已提交的 `assistant/message`，每个非空文本或图片块发一条 `agent_message_chunk`，保持顺序；图片重读并做完整性校验后再 inline base64 投递 |
| `session/request_permission` | 对桥接拥有的审批请求（带 tool call id）提供一次性 allow/reject 选择；客户端可自动应答 |

几个值得背的行为细节：

- **结算语义**：正常 quiescence 报 `end_turn`；显式 ACP cancel、dispose、或入队被丢弃（turnless slot）报 `cancelled`。token 上限结算为 `end_turn`。
- **已提交输出优先**：`session/update` 刻意用"逐 token 延迟"换"干净的自动化结果"——未提交的 provider chunk 和 retry 尝试永远不会漏出部分文本或图片；reasoning 和工具活动留在 session 日志里，通过别的接口观察。
- **连接拥有生命周期**：一个连接释放它所有的 session；没有 per-session close。

## 7.2 运行 ACP demo

[demo:acp](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/acp-agent/README.md) 脚本在根 package.json 里定义为：

```sh
node --import tsx packages/examples/acp-demo/src/bin.ts --config examples/acp-agent/cordis.yml
```

在仓库根目录执行：

```sh
pnpm run demo:acp            # 需要 DEEPSEEK_API_KEY（仓库根 .env 或环境变量）
pnpm run demo:code-mode      # 同一协议，但走 Code Mode 工具传输
```

`examples/acp-agent/cordis.yml` 是一份叶子组合，把 ACP app 挂到完整 agent 栈上。它加载的是一整套能力：

| 层 | 条目（节选） |
|---|---|
| 模型适配器 | `@deepseek-ai/dsh-llm-deepseek`（thinking + reasoningEffort: max，deepseek-v4-flash / deepseek-v4-pro） |
| 沙箱 | `dsh-sandbox-local`、`dsh-sandbox-policy`（workspace-write / danger-full-access）、`dsh-subprocess-local`、`dsh-bash-sandbox`、`dsh-fs-sandbox` |
| 审批 | `dsh-user-approval`（ask / never 策略） |
| ACP 主体 | `@deepseek-ai/dsh-acp-demo`（agent spine + JSONL 持久化 + 协议桥） |
| 令牌与压缩 | `dsh-token-meter`、`dsh-compaction-basic` |
| subagent / workflow | `dsh-subagent`、`dsh-subagent-spawn-in-process`、`dsh-tool-subagent`、`dsh-workflow-worker-thread` |
| hooks | `dsh-hooks-claude-code`、`dsh-hooks-codex` |
| 工具 | `dsh-tool-fs`、`dsh-tool-todo`、`dsh-tool-ralph` 等 |

注意两个关键设计约束，它们直接决定了客户端怎么写：

1. **stdout 是纯净协议信道**。`@deepseek-ai/dsh-acp-demo` 不安装任何 stdout logger，叶子里的诊断必须走 stderr。任何往 stdout 打印日志的插件都会污染 ACP JSON-RPC 帧流，客户端解析会直接崩。
2. **每次 `session/new` 创建全新 agent**，持久化到 JSONL，且不支持 load/list/resume/delete/fork——只有 fresh session。

### 7.2.1 session 工作目录与权限

每个 `session/new` 提供一个绝对 `cwd`。沙箱化的 bash 和文件系统写入把 `workspace-write` 解析到这个 session cwd，所以并发 session 可以各自用不同的项目根；平台临时目录仍是共享的可写 scratch space。

`DSH_PERMISSION_MODE` 环境变量为部署选择 `workspace-write` 或 `danger-full-access`。在 `workspace-write` 下，模型重试请求更大沙箱权限时，server 会发出 `session/request_permission`，带 `allow_once` / `reject_once` 两种选项——**客户端以程序化方式决策**。这个选择只对那一次重试生效，并通过正常的 tool-result/audit 路径记录。server 永远不会弹权限选择器，也不会持久化客户端策略；客户端不响应或给了不可用答案，一律 fail closed（拒绝）。

这就是 ACP 与 Web UI 的本质差别：Web UI 把"是否允许这个工具"抛给人，ACP 把同一个决策抛给**调用方的代码**。

## 7.3 JSON-RPC 是 SDK 层的通用协议

ACP 之上还有一层更"原始"的协议栈，在 [packages/sdk/](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/README.md)。这组包负责"从另一个进程驱动一个 Harness runtime"，调用方只需提供 runtime 可执行文件和它的 `cordis.yml`；它不创建、配置、构建或启动开发者项目。

| 包 | 角色 |
|---|---|
| [`protocol/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/protocol/README.md) | 定义 SDK runtime 的 wire 协议 |
| [`client/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/client/README.md) | 通过 TypeScript client API 驱动一个 Harness runtime |
| [`server/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/server/README.md) | 通过 stdio JSON-RPC 服务进程外的 SDK 客户端 |

`protocol/` 是一个纯库——没有 plugin、没有 Config、没有注册。它的核心是 `JsonRpcLineTransport`：在调用方自有的字节流上做 JSON-RPC 2.0 分帧，每行一个紧凑 JSON 帧。三类帧的判别规则：

| 帧特征 | 类型 |
|---|---|
| 有 `id` 和 `method` | request |
| 只有 `id` | response |
| 只有 `method` | notification |

格式非法的 JSON 行被忽略；缺失 request handler 回 `-32601`；handler reject 回 `-32603` 并带错误消息；错误响应把 pending 的 `request()` reject 成 `JsonRpcResponseError`（保留 wire 上的 `code` 和可选 `data`）。

### 7.3.1 wire 类型表

`types.ts` 命名了 `HarnessSdkJsonRpcServer` 服务的全部 payload：

| 方向 | Method | 类型 |
|---|---|---|
| client→server | `initialize` | `InitializeParams` → `InitializeResult` |
| client→server | `session/prompt` | `SessionPromptParams` → `SessionPromptResult`（持久化的入队回执） |
| client→server | `shutdown` | 无参数 → `{}` |
| server→client | `session.event` | `SessionEventNotification`（runtime 里每个 session，不过滤） |
| server→client | `session.status` | `SessionStatusNotification`（整 agent 的 `running`/`idle` 转换） |
| server→client | `subagent.started` | `SubagentStartedNotification` |
| server→client | `subagent.finished` | `SubagentFinishedNotification`（仅进程内 run） |

两个要点：

- `SessionPromptResult.messageId` 标识的是**入队的那条 UserMessage**，不标识之后的 assistant 消息、turn 结束或 prompt 结果。客户端要靠开放的 `session.event` 流配合整 agent 的 `session.status`，自己定义"这一次活动区间"的边界。
- `initialize.serverInfo.name` 恒为 wire 稳定的 `deepseek-harness-sdk-runtime`，version 是 `0.0.1`，客户端不校验——协议没有版本协商。

`server/` 的 plugin（`dsh-sdk-jsonrpc-server`）`inject: ['agents']`，按 `sessionId` get-or-create 一个 agent。它回答了 `shutdown` 后 flush 响应、dispose 根 context、以 code 0 退出。stdout 同样只承载 JSON-RPC 帧，部署不能挂 stdout logger。

### 7.3.2 TypeScript 客户端：两层 API

`client/`（`@deepseek-ai/dsh-sdk-client`）提供两层消费面，与 Python SDK 一一对应：

```ts
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client'

await using harness = new DeepSeekHarness({
  launch: { command: 'node', args: ['lib/bin.js', 'cordis.yml'] },
  provider: 'deepseek-official',
  model: 'deepseek-v4-flash',
  maxTokens: 49_152,
})
const result = await harness.run('say hi')
console.log(result.finalResponse)
```

- `DeepSeekHarness` 是高层 owned-run API：子进程在首次使用时**惰性启动**，跨 `run()` 调用由实例持有；`close()`（或 `await using`）负责回收子进程。`run()` 拥有一个"活动区间"——入队 prompt，等它的 `MessageId` 出现在 `agent/inbox/spliced` 回执里，再收集到下一个整 agent `idle`。返回 `RunResult { sessionId, finalResponse, events, notifications }`。`finalResponse` 是区间内**最后一条已提交的根 session assistant 文本**，不是因果归属到该 prompt 的响应。
- `HarnessClient` 是低层协议 client：显式 `start()`/`initialize()`/`prompt()`/`request()`/`close()` 加通知订阅。`prompt()` 一旦 runtime 接受就返回入队的 message id，绝不等待 agent 活动。

四个类型化错误面都从这个包导出：`JsonRpcResponseError`（wire 错误响应，保留 code/data）、`RequestTimeoutError`（超时）、`SdkProtocolError`（超出文档协议的响应）、`TransportClosedError`（runtime 已退出，带退出码和截断的 stderr tail）。

`close()` 先发协议 `shutdown`（受 `shutdownTimeoutMs` 约束，默认 1000ms），再走 stdin-EOF → SIGTERM → SIGKILL 的升级阶梯，直到进程真正退出。这套阶梯是 client 私有的——它跑在 harness context 之外，所以不能复用 `dsh-subprocess` service（该 seam 为 SDK 管理的传输留了文档化例外）。

### 7.3.3 SDK 与 ACP 的区别

到这里，两条线的关系已经清楚，值得点破：

| | SDK（`packages/sdk/`） | ACP（`packages/acp/`） |
|---|---|---|
| 协议 | 自定义 SDK wire 协议 | 开放的 Agent Client Protocol |
| 互操作 | 仅 dsh 自己的 client/Python SDK | 任何实现 ACP 的客户端 |
| 通知面 | `session.event`（全量 session 日志）+ `session.status` | `session/update`（只发已提交的 assistant 文本/图片） |
| 审批 | 无 per-prompt 审批方法 | `session/request_permission` 程序化决策 |

## 7.4 TypeScript 侧：ctx.remote 与 Typert 契约

前面讲的 ACP 和 SDK JSON-RPC 都是"进程外"的线协议。dsh 内部还有一套"进程内"的远程调用栈，位于 [packages/api/](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/api/README.md)，它回答一个不同的问题：**Web 前端（client 环境）如何类型安全地调用 Host 进程里的业务方法**。

这套栈的关键词是 **Typert**——一个生成 RPC 描述符（invocation descriptor）的工具链。`packages/api/` 下两个包：

| 包 | 角色 | ctx key |
|---|---|---|
| [`remotes/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/api/remotes/README.md) | Host 侧 Agent/Session 查找策略 + Client 侧 Remote 贡献装配 | 无 service；配置 `ctx.typert`、消费 `ctx.remote` |
| [`gateway/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/api/gateway/README.md) | Host 侧 Typert 派发器 + Client 侧 Remote 端点 | `ctx.typertGateway` / `ctx.remote` |

运行时依赖方向是 `remotes → gateway → connection → webserver`，靠 Cordis 的 service 注入和 Client 模块元数据维持，而不是 import 具体实现。

### 7.4.1 Host 侧：@Remote 与 @RemoteScope

Host 进程里，业务 service 继承 `TypertRemoteService`，用 [dsh-typert-protocol](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/typert/protocol/README.md) 里的两个装饰器标记可远程调用的方法：

- `@Remote` —— 普通 unary RPC 方法；
- `@RemoteScope` —— 方法接收方（receiver）通过已注册的 Host Context provider 解析（例如"作用在某个 agent 上"的方法）。

严格模式从 `ctx.typert.local` 读取生成的 invocation descriptor，对每个调用解析 descriptor 和 Cordis Service、校验精确的具名参数、解析对象/Context 身份、调用业务方法并校验结果。`ctx.typertGateway.invoke()` 是这一切的入口。一个支持取消的 Remote 方法把 `signal: AbortSignal` 作为最后一个 Host 参数——它是 descriptor 元数据，不是 wire 参数。

### 7.4.2 Client 侧：ctx.remote 命名空间

Client 进程里，`@deepseek-ai/dsh-api-gateway/client` 提供 `ctx.remote`。这是前端（或任何 React-free 客户端）面对"远程能力"的统一命名空间，有三个入口：

| 入口 | 作用 |
|---|---|
| `ctx.remote.$mount()` | 校验并注册一个生成的 Host-for-Client 贡献，为调用 fiber 装上具体的直接/作用域方法 |
| `ctx.remote.$on()` | 订阅一个转发过来的 Host 事件，合法键由 Host 装配的转发白名单决定 |
| `ctx.remote.$dispatch()` | 转发面的另一半，属于载体（connection），业务代码不调用 |

每个 namespace 是一个带 trace 的 `remote.<namespace>` 子 Service，最后一个方法撤回后卸载。生成的 declaration merge 通过共享的 `TypertClientRemote` 契约提供 TypeScript API——Client 侧**不 import 具体 Gateway 实现**，靠 Cordis 拿到接口。

### 7.4.3 api/remotes 的职责

`api-remotes` 是"双面 BFF"：Host 侧入口拥有 Agent/Session 身份策略（`createApiRemoteAgentResolver()` 复用存活 Agent、resume 普通冷 session、去重并发 resume、维护 subagent ownership fence）；Client 侧入口 import 生成的 `/remote` 产物作为运行时值，经 `ctx.remote.$mount()` 挂载每个贡献，再 re-export 它们的 declaration merge。

Client 业务包依赖这个 facade，而不是 Gateway 实现或单个 Remote 运行时入口。当前的 Client 装配挂载的是 Goal Remote 贡献和只读的 Host 插件清单贡献（`pluginInventory/list`）。当这个装配卸载时，Cordis 的 effect 所有权会撤回每一个贡献。

一句话总结这条栈的分工：**Typert 在编译期生成 Host-for-Client 契约，Cordis 在运行期把这些契约 mount 到 `ctx.remote`，connection 负责搬运**。这是 dsh 比"手写 fetch + 手写类型"更进一层的自动化和类型安全来源。

## 7.5 hooks 包：Claude Code / Codex 的 hook bridge

[packages/hooks/](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/hooks/README.md) 是另一个"外部协议桥接到 harness"的例子，但桥接对象不是 RPC，而是 **shell hook**。

Claude Code 和 Codex 都允许用户通过一份 `hooks.json` 在生命周期点挂 shell 命令。hooks 子系统让用户把已有的那份配置原样搬过来——point 一个 bridge plugin 到现成的 `hooks.json`，那些外部 shell hook 就能在 harness 的**类型化拦截点**上运行。

| 包 | 角色 | 形态 |
|---|---|---|
| [`hook-protocol/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/hooks/hook-protocol/README.md) | 共享 shell-hook 协议库 | library |
| [`hooks-claude-code/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/hooks/hooks-claude-code/README.md) | Claude Code hook bridge | plugin |
| [`hooks-codex/`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/hooks/hooks-codex/README.md) | Codex hook bridge | plugin |

这里要厘清一个概念层级：**canonical 扩展面本身是 harness 的 typed interception points**（`agent/pre-step`、`tools/pre-execute` 等）。一个"原生 hook"就是一个挂在那些扩展点上的普通 Cordis plugin——它更强，有类型化返回、没有序列化边界。这两个包只是把外部 shell-hook 协议翻译到同一扩展面上的 **bridge**。

Claude Code bridge 的映射关系：

| CC hook | harness 拦截点 | 映射 |
|---|---|---|
| `SessionStart` | `agent/session-start`（emit） | additionalContext → `agent.inject()`（不可阻塞） |
| `UserPromptSubmit` | `agent/pre-step`（waterfall） | `deny` → reject |
| `PreToolUse` | `tools/pre-execute`（waterfall） | `deny`/`ask` → PreToolDecision |
| `PostToolUse` | `tools/post-execute`（waterfall） | `deny` → block with feedback |
| `Stop` | `agent/turn-stopping`（serial） | 阻塞 Stop 经 `steer()` 强制再来一步 |
| `SubagentStart` | `subagent/start`（emit） | additionalContext → 注入 live 子进程 child |
| `SubagentStop` | `subagent/end`（emit） | observe-only |

`hook-protocol` 这个 wire-protocol 库拥有与方言无关的原语：matcher、exit-code/stdout codec、`ctx.shell` 执行、most-restrictive merge、`hook/*` 事件；每个 bridge 拥有自己方言的事件映射（Codex 用 `codex-hooks.json` 和 snake_case 的五事件方言，不能共享 Claude 的文件）。值得强调：这是**兼容路径**，不是推荐做法——任何定制逻辑都该直接写成原生 Cordis plugin。

## 7.6 与 Python SDK 的分工

第 6 章讲过 Python SDK。这里从"协议栈"角度再看一眼它的位置，避免读者把三套东西混为一谈。

[python/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/README.md) 说得很直接：Python SDK 是"通过 stdio 上的 newline-delimited JSON-RPC 与打包好的 runtime 通信的客户端"。它本质是**子进程 + newline-delimited JSON-RPC 封装**，分两个包：

| 目录 | dist / module | 角色 |
|---|---|---|
| `sdk` | `deepseek-harness-sdk` / `deepseek_harness` | 高层 turns API + 低层 JSON-RPC client |
| `sdk-runtime` | `deepseek-harness-runtime-bin` / `deepseek_harness_runtime` | 打包好的 runtime 二进制 + 默认 agent 配置 |

Python SDK 与 TypeScript `dsh-sdk-client` 是"设计孪生"：共享同一个 runtime peer、同一个协议、同样的分层（`DeepSeekHarness` ↔ 高层 owned-run API，`HarnessClient` ↔ 低层协议 client）。[protocol README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/protocol/README.md) 明确说 Python SDK"mirrors these shapes but does not import them"——它镜像了 TS 协议的 shape，但不 import 这些包。关键差异在"运行时发现"：Python SDK 负责找到打包好的可执行文件（bundled-runtime resolution），而 TS client 的 launch spec 完全显式（`command`/`args`），因为它是给"知道自己在拉起哪个 runtime"的 repo 内消费者用的。

## 7.7 自修改 demo：pnpm run demo:cordis

`demo:cordis` 是仓库里一个演示性质的 wrapper（[scripts/demo-cordis.mjs](https://github.com/deepseek-ai/deepseek-harness/blob/master/scripts/demo-cordis.mjs)），不是产品 CLI 特性。它把 **Cordis 工具集**叠到 Web 或 ACP 上：

```sh
pnpm run demo:cordis            # 默认 Web，端口 3081
pnpm run demo:cordis acp        # ACP 面，走 cordis-tools.cordis.yml
```

两条路径分别 spawn：

```text
web: dsh web --patch examples/web-cordis/cordis.yml        (端口 3081)
acp: acp-demo --config examples/acp-agent/cordis-tools.cordis.yml
```

"self-referential"（自指）的含义：这份叠加给 agent 装上了**能 inspect/mount 自己插件运行时的工具**。也就是说，agent 可以观察它自身跑在哪个 Cordis context 上、注册了哪些 plugin、甚至动态挂载/卸载插件。这是"Everything is a plugin"哲学最极致的演示——连"修改 agent 自己"这件事，都是通过再挂一个插件实现的。它同样是第 8 章 Cordis 范式的一个活样本。

## 7.8 三种程序化接入选型对照

把本章和第 6 章的内容收敛成一张选型表：

| 维度 | headless | Python SDK | ACP |
|---|---|---|---|
| 进程形态 | `dsh-headless` bundle，一次性 runner，无 server | SDK 拉起子进程 runtime | 独立 server 进程，stdio 常驻 |
| 传输协议 | 无（进程内） | newline-delimited JSON-RPC | newline-delimited ACP JSON-RPC |
| 消费语言 | 任意（CLI 一次性） | Python | 语言无关（开放协议） |
| session 语义 | 单次 run | 每次 spawn 一个 runtime | 一个连接多个 session，每个独立 |
| 审批/权限 | 进程内策略 | 受 runtime `cordis.yml` 配置 | `session/request_permission` 程序化决策 |
| 典型场景 | CI 一次性任务、脚本 | Python 应用嵌入 agent | parent agent、subagent provider、多语言自动化 |

选型直觉：

- 要**一次性跑完就退**，不想起长驻进程 → headless；
- 是 **Python** 项目、想把 agent 嵌进自己代码里 → Python SDK；
- 要**语言无关**、要**多 session**、要**程序化审批**（parent agent 场景）→ ACP。

再补一层：如果你已经在 dsh 仓库内写 TypeScript，`dsh-sdk-client` 是 Python SDK 的 TS 孪生，但它的 launch 完全显式、不做运行时发现。

## 7.9 ACP 客户端最小示例

下面是基于 [examples/acp-agent/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/acp-agent/README.md) 与 [dsh-acp 契约](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/acp/README.md) 整理的最小客户端。它只演示 `initialize → session/new → session/prompt → session/update` 四个环节，字段 shape 遵循 Agent Client Protocol 规范，方法名与行为以 dsh-acp 文档为准。

先看线上跑的帧（stdout，每行一个 JSON-RPC 2.0）：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/abs/project"}}
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"<sessionId>","content":[{"type":"text","text":"say hi"}]}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"<sessionId>","sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"hi"}}}
```

要点对应回 7.1/7.2 的契约：

- `session/new` 的 `cwd` 必须是**绝对路径**；空 `additionalDirectories` 与 `mcpServers` 被接受，非空则拒绝。
- `session/prompt` 保留 text/image 顺序；`session/update` 每个非空文本或图片块发一条 `agent_message_chunk`。
- stdout 是纯净协议信道，stderr 留给诊断。

一个最小的 Node 客户端骨架（`child_process` + `readline`，不依赖 ACP SDK）：

```ts
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const server = spawn(
  'node',
  ['--import', 'tsx', 'packages/examples/acp-demo/src/bin.ts', '--config', 'examples/acp-agent/cordis.yml'],
  { stdio: ['pipe', 'pipe', 'inherit'] }, // stdout 是协议信道，stderr 透传给诊断
)

let nextId = 0
const pending = new Map<number, (msg: any) => void>()

function request(method: string, params: unknown = {}) {
  const id = ++nextId
  return new Promise<any>((resolve) => {
    pending.set(id, resolve)
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

const lines = createInterface({ input: server.stdout })
lines.on('line', (line) => {
  const msg = JSON.parse(line)
  if (msg.id != null && pending.has(msg.id)) {
    pending.get(msg.id)!(msg)
    pending.delete(msg.id)
  } else if (msg.method === 'session/update') {
    // 已提交的 assistant 文本/图片块
    console.log('chunk:', msg.params.sessionUpdate, msg.params.content?.text)
  }
})

await request('initialize', {})
const { sessionId } = (await request('session/new', { cwd: process.cwd() })).result
const result = await request('session/prompt', { sessionId, content: [{ type: 'text', text: 'say hi' }] })
// 结束时：session/cancel 或直接断开连接；server 在断连时回收该连接持有的所有 session
console.log('prompt settled:', result)
```

注意：真实 ACP 客户端通常直接用 `@agentclientprotocol/sdk` 的 `ClientSideConnection`（仓库 devDependency 里就有，版本 `0.25.1`），它会处理 initialize/authenticate 协商和通知路由；上面的骨架只是为了展示"每行一个 JSON 帧"这一层的真相。dsh 自己的进程内客户端在 [subagent/subagent-acp](https://github.com/deepseek-ai/deepseek-harness/blob/master/subagent/subagent-acp/README.md)。

## 7.10 本章小结

- **ACP 是面向自动化的 server**：JSON-RPC stdio，一个连接多个独立 session，只做程序化驱动、不做人机交互；对应 `packages/acp/`（`@deepseek-ai/dsh-acp`）。
- **运行**：`pnpm run demo:acp`（需 `DEEPSEEK_API_KEY`）；stdout 纯净承载 ACP 帧，诊断走 stderr。
- **SDK 层通用协议**：`packages/sdk/` 的 protocol / server / client 三件套，`JsonRpcLineTransport` 做 newline-delimited JSON-RPC 分帧；`serverInfo.name` 恒为 `deepseek-harness-sdk-runtime`。
- **TypeScript 侧 Remote 契约**：Typert 在编译期生成 Host-for-Client 契约（`@Remote` / `@RemoteScope`），Cordis 在运行期把它 mount 到 `ctx.remote`（`$mount` / `$on` / `$dispatch`）；Host 侧入口是 `ctx.typertGateway`。
- **hooks 包是兼容桥**：把 Claude Code / Codex 的 shell hook 翻译到 harness 的 typed interception points，canonical 做法始终是原生 Cordis plugin。
- **Python SDK 本质是子进程 + newline-delimited JSON-RPC 封装**，是 TS `dsh-sdk-client` 的设计孪生。
- **自修改 demo**：`pnpm run demo:cordis` 把 Cordis 工具集叠上 Web/ACP，让 agent 能 inspect/mount 自己的插件运行时。
- **选型**：headless 适合一次性任务，Python SDK 适合 Python 嵌入，ACP 适合语言无关、多 session、程序化审批的 parent agent 场景。

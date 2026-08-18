---
layout: default
title: 第12章：扩展开发实战：插件 / 工具 / LLM 适配器
---

# 第12章：扩展开发实战：插件 / 工具 / LLM 适配器

第 11 章讲了"能力缝在哪、边界怎么画"，这一章落地到"怎么写"。dsh 的扩展开发不是套模板，而是做一连串小决策：新行为挂到哪个 `ctx` 键、注册是 `ctx.effect`（卸载即回收）、schema 是否进 prompt、UI 渲染意图在哪个阶段定下来。本章以官方 cookbook 为主线，把"加一个包 → 加一个工具 → 加一个 LLM 适配器 → 加 Conversation Node / 设置卡片 → 配置暴露 → 分发"串成一条完整的实战路径，并用一个贯穿全程的小工具插件作为主线示例。

本章代码均取自官方文档的 cookbook 原文（snippet 省略了 import 与 helper 实现，不是 copy-paste 即用），权威出处：

- [docs/cookbook/extension-cookbook.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)
- [docs/cookbook/adding-a-package.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)
- [docs/cookbook/adding-a-tool.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md)
- [docs/cookbook/adding-an-llm-adapter.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-an-llm-adapter.md)
- [docs/cookbook/adding-a-conversation-node.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-conversation-node.md)
- [docs/cookbook/adding-a-settings-card.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-settings-card.md)

老规矩：developer preview，会有破坏性变更。包名、类型名、事件名以 master 为准。

## 12.1 扩展 cookbook 入口

`extension-cookbook.md` 是扩展开发的"地图首页"。它做了两件事：

1. 给出**功能 → 机制映射表**（第 11 章的决策表就是它的浓缩版）。每行回答"我要做 X 产品特性，该挂到哪个扩展点上"。例如：Hook 系统映射到 `agent/session-start`、`agent/pre-step`、`agent/request`、`tools/pre-execute`、`tools/post-execute`、`agent/turn-stopping` 这些 waterfall 上的 listener；MCP 是"每个 server 一个插件：发现工具 → `ctx.tools.register()`"；Memory 是"section provider + tool"。
2. 索引了所有分步指南。下面这张表是本章的结构来源：

| 我要做 | 入口文档 |
| --- | --- |
| 加一个 workspace 包 | [adding-a-package.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md) |
| 加一个面向模型的工具 | [adding-a-tool.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md) |
| 加一个 LLM 适配器 | [adding-an-llm-adapter.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-an-llm-adapter.md) |
| 加一个 Web Client Chat 节点 | [adding-a-conversation-node.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-conversation-node.md) |
| 加一个设置卡片 | [adding-a-settings-card.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-settings-card.md) |

cookbook 还给了四个"插件形状"作为范式：工具插件（注册 `ctx.tools`）、hook 插件（`tools/pre-execute` 上返回类型化决策）、UI 插件（从 `session/event` 渲染、经 `agent.followup()` / `agent.steer()` 回写）、外部协议驱动（把 wire peer 适配到 `ctx.agents`）。写任何扩展前先对号入座，能少走一半弯路。

## 12.2 加一个包

新包的标准骨架（`packages/<group>/<pkg>/`）：

```text
packages/<group>/<pkg>/
  package.json     # 复制 packages/core/tools，改 name/description/deps
  tsconfig.json    # extends ../../../tsconfig.base.json，rootDir src，
                   # outDir lib/types，references 到 vendor/cordis 等
  src/index.ts     # service 默认导出，或插件（name/inject/apply/Config）
  README.md        # service API、事件、扩展点、设计说明 + Model Experience
```

group 尽量复用已有的（`core`、`llm`、`bash`、`compact`、`subagent`、`todo`、`session-persistence`、`ui`、`util`、`support`）。新建 group 也可以，但它是个纯容器：没有 `package.json`、没有源文件，包仍然严格放在它下面一级。

**关键决策：注册到哪个 aggregate。** 一个普通包属于**恰好一个** aggregate（`tsconfig.host.json` 或 `tsconfig.client.json` 二选一，绝不两者都加）。`api/remotes` 是唯一例外（Host 生成契约、Client 后续消费），新包不许照抄它。`packages/client/*` 的包额外 extends `tsconfig.base.client.json`，在 package.json 里声明 `dsh.client`、导出 `./client`，并调用共享的 tsdown preset。

package.json 的不变量由 `pnpm run constraints`（`scripts/check-workspace-constraints.ts`）强制：

| 约束 | 值 |
| --- | --- |
| `private` | `true` |
| `version` | 与根 package.json 一致 |
| `type` | `module` |
| `main` | `lib/index.js` |
| `types` | `lib/types/index.d.ts` |
| `exports["."].types` | `./lib/types/index.d.ts` |
| `exports["."].default` | `./lib/index.js` |
| `@deepseek-ai/cordis` | 同时进 peerDependencies 和 devDependencies（同 range） |
| 每个 dsh peer 依赖 | 镜像进 devDependencies |
| `@deepseek-ai/schemastery` | 进 `dependencies`（它是运行时校验器） |
| `files` | 恰好 `lib/index.js`、`lib/invariant.js`、`lib/types/**/*.d.ts` 加包专属运行时产物 |

包内相对 import 用显式 `.ts` 说明符（如 `export * from './types.ts'`），编译器把它重写为 `.js`，声明里保留 `.ts`，标准 NodeNext 消费者解析到相邻的 `.d.ts`。

**包的拓扑决策**：可替换能力把三角色拆包（第 11 章），单一职责插件一个包。命名时"为稳定职责命名，不为第一个实现命名"——接口包命名能力本身，实现包加机制 / 协议 / 环境 / vendor 限定词。cookbook 里有一张词表（`Controller` / `Store` / `Registry` / `Runtime` / `Provider` / `Backend` / `Engine` 等各自的适用与不适用场景），是命名的权威参考。

**发布形态**：包如何进入运行时，由 package.json 的 `dsh` 字段声明（architecture.md）：

> Each declares itself in its own package.json under a dsh field: `dsh.profile` lists a profile's bundles, and `dsh.bundle` points at a bundle's patch file.

即：一个包要么是一个 **bundle**（`dsh.bundle` 指向 patch 文件），要么是一个 **profile**（`dsh.profile` 列出它叠放的 bundles）。bundle 是"Cordis 配置行 + 挂载代码"的分发格式；profile 是命名的组合（存在 Harness home 下），用户还能再装 out-of-tree 插件、保留自己的 `cordis.patch.yml`。

**Model Experience 要求**：包 README 末尾必须有一段规范的 Model Experience（每个面向模型的条目写 "What the model sees" / "Token effect" / "KV Cache effect" 三栏），外加 "Known Limitations and Deferred Work" 段。这是仓库的强制结构，由脚本校验。它逼你在写包时就回答：这个包给模型看什么、占多少 token、是否破坏 KV cache 复用。

## 12.3 加一个工具

工具是最常见、也最能体现 seam 分工的扩展。最小形状（取自 adding-a-tool.md）：

```ts
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'my-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'read_file',
    description: 'Read a file from disk.',          // 模型看到的东西
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path' },
      limit: { type: 'number' },                     // 默认可选
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      // args 由 schema 推导类型：{ path: string; limit?: number }
      // exec 携带不可变身份 + token；signal 是操作字段
      return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
    },
  }))
}
```

几个必须记住的契约：

**注册是 effect-based 的。** 卸载插件 fiber 就反注册工具，HMR 免费生效。schema 自动进入 system-prompt 组装——你不需要手动把工具描述拼进 prompt。

**`execute()` 的规则**：

- `defineTool` 在 `execute` 跑之前，已经按统一的 `ParameterSchemaSpec` 校验了模型生成的 `arguments`（类型、required 键、literal 约束、exact-one union、嵌套值）。DSL 表达不了的约束（非空字符串、正数、跨字段规则）仍要你自己手查。
- 执行身份受保护：`arguments` 被物化为 detached lossless JSON 并冻结，`exec.token` 是不透明值；`callId`、`name`、`arguments`、`agent`、`token`、`signal` 在分发期间不可变。`args` 当只读输入对待。
- 声明并返回**一个** canonical JSON 值：`output.schema` 用 `ValueSchemaSpec`，根可以是 object / array / scalar / null。`execute` 只返回推导值，注册表快照、校验、冻结后交给 `output.render(args, value)`。不要把 content block 从函数体返回，不要让调用方从散文里解析 id。
- 抛异常或返回非法值 = `isError`。基础设施失败用 throw；成功的领域结果放进 canonical 值，即使 Native 渲染解释的是非理想状态（如非零退出码）。
- 尊重 `exec.signal`，取消在飞的工作。
- 异步通知用 `exec.agent`：`agent.inject(...)` 追加的是"下一次模型请求可见"的持久上下文，不是唤醒（idle agent 保持 idle）。

**守卫执行管线**（这是 hook 插件的接入点）。不要把部署策略硬编码进工具。extension-cookbook 给了一个 permission-gate 例子：

```ts
export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!(await isAllowed(exec))) {
      return { kind: 'deny', reason: 'Denied by policy.' }
    }
    return next()
  })
}
```

五个扩展点的分工：

| 扩展点 | 用途 |
| --- | --- |
| `tools/pre-execute` | 可扩展的 allow / deny / ask 策略（上面的权限门就是例子） |
| `ctx.tools.guard()` | 一个单调的最终 deny，后来的 listener 无法撤销 |
| `tools/execute` | 包裹分发生命周期（deadline / 重试 / 指标；只有 `exec.signal` 可替换） |
| `tools/post-execute` | 显式结果变换、阻塞结果、附加面向模型的上下文 |
| `tools/result` | 观察不可变的最终规范化结果 |

**UI 渲染意图在设计阶段就定。** `output.render` 返回的是面向模型的内容；UI 卡片是另一回事，通过纯展示投影 `presentCall` / `presentResult` 声明。card 种类要选对（`generic` / `terminal` / `diff` / `search` / `web`），`locations: [{ path, line? }]` 让编辑器能跳转。硬规则三条：这些 presenter 在 live streaming 和 session-log REPLAY 上都跑，必须是 `args`（+ result）的**纯函数**（无 I/O、不读 session 状态、不读时钟/随机）；UI-only 格式（fenced console 代码块、diff、相对路径）不进模型结果；`defineTool` 对展示路径软校验，坏日志返回 `undefined` 回退到 generic 卡片，展示永不崩回放。`dsh-tool-fs`（generic/diff）和 `dsh-tool-bash`（terminal）是参考实现。

## 12.4 加一个 LLM 适配器

新模型 provider 的接入契约（取自 adding-an-llm-adapter.md）：

```ts
class MyAdapter extends LlmAdapter {
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> { … }
}

export const name = 'llm-myprovider'
export const inject = ['llm']
export const Config: z<Config> = z.object({ apiKey: z.string(), … })

export function apply(ctx: Context, config: Config) {
  ctx.llm.registerAdapter(['my-provider'], new MyAdapter(…))
}
```

要点：

- **注册**是 effect-based（HMR 安全）；一个 adapter 一个 provider route，重复会 throw，多 route 注册 all-or-nothing。`options.provider` 选 adapter，`options.model` 是 provider 的 model id，所以动态 catalog 适配器可以不上线配置就服务新模型。
- **协议义务**（两个参考实现共同验证过的契约，权威定义在 `packages/llm/llm/src/types.ts` 的 `StreamChunk` 文档）：
  - 在 `finish` **之前**发 `usage`，`finish` 之后发**任何东西都不行**。稳健做法：缓冲 finish/usage 直到 provider 的 end-of-stream 标记再 flush。
  - tool-call `arguments` 端到端是 RAW JSON 字符串，流里用 `argumentsDelta` 发片段；provider 若返回已解析对象，在 `block-end` 重新 stringify。
  - block `index` 按首次出现顺序分配，同一 block 的每个 delta 复用该 index。
  - 错误只有两条正路：从 `stream()` **throw**（传输/协议失败，用 `LlmError` + 稳定 code），或结束流时给 `finish {kind: 'error' | 'aborted'}`（provider 带内失败）。
  - 尊重 `options.signal`；provider 无法兑现的字段（如不支持 stop 序列）要 throw `LlmError(..., 'UNSUPPORTED')` 而不是静默丢弃。
  - 需要 response id / 签名等原生元数据时，发最小 lossless-JSON 投影 `finish.replayState`，重建历史时校验它。
- **凭据契约**：secret 是 cordis-native——schemastery Config + env fallback，从 cordis.yml 经 `!!js process.env.MY_KEY` 喂入。**绝不在代码里读临时 key 文件**。
- **结构**：wire 类型、请求序列化、传输解析、chunk 翻译、adapter 类分开成不同职责；`llm-deepseek` 是参考布局（直接 HTTP，SSE 由 `eventsource-parser` 解析）。

## 12.5 加 Conversation Node

Web Client Chat 视图的"业务行"通过 `ConversationNodeDefinition` + keyed renderer 实现（第 11 章决策表里的 "Add a Web Client Chat node"）。完整示例太长，这里只摘结构骨架（取自 adding-a-conversation-node.md，以 review job 为例）：

```ts
const reviewDefinition: ConversationNodeDefinition<ReviewState> = {
  kind: 'review-job',
  target: 'chat',
  match: (event) => {
    if (event.type === 'review/start') return { id: String(event.data.reviewId), role: 'start' }
    if (event.type === 'review/progress' || event.type === 'review/end') {
      return { id: String(event.data.reviewId), role: 'update' }
    }
    return null
  },
  start: (_context, match) => { /* 返回初始 State */ },
  update: (context, match) => { /* 返回新 State */ },
  publication: match => match.event.type === 'review/progress' ? 'animation-frame' : 'immediate',
  buildViewNode: (context) => { /* 返回 renderer-ready 数据 */ },
}
```

核心概念：

- 先设计一个**可回放的 event family**：每个贡献同一 Node 的事件携带同一个稳定业务 id（`reviewId`），客户端绝不把更新指派给"最新的未完成 Context"。事件类型经 `declare module '@deepseek-ai/dsh-session/types'` 合并进 `SessionEventMap`。
- `match(event)` 是**身份提取器，不是 fold**：只收当前事件，返回 Definition 局部 id + 生命周期角色。命中后装配器按 `(kind, id)` 定位 Context，调一次 `start` 或 `update`。
- 依赖更早的业务 Context 只在 `start` 里经 `reader.previous<State>(kind)` 查，别扫事件。
- 三条 ingestion 路径（replace / prepend / append）各有保证：append 一个 live event 只做一次 `match` + 常数时间 key 查找，Definition 代码必须保住这个性质——**不要在正常 append 路径上遍历整个事件窗口**。
- `target` 与 `buildViewNode` 成对出现；`context.key` 是 React 身份，`anchorSeq` 取持久排序证据，`visibility: 'hidden'` 用于临时退出可见流。

## 12.6 加设置卡片

设置卡片分两半，Host 半与 browser 半，靠 **namespace** 作为 join key 配对（取自 adding-a-settings-card.md）。`packages/client/ui-theme` 是打包范本，卡片实现见 `packages/client/ui-settings-plugins`。

**Host 半**——注册 namespace：

```ts
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

export const MY_PLUGIN_NS = settingsNamespace('my-plugin')

export function apply(ctx: Context, config: Config) {
  let source = () => config
  installSettingsSection(ctx, MY_PLUGIN_NS, Config, config, {
    validate: value => void assertReachable(value.endpoint), // schema 表达不了的约束
    setSource: (current) => { source = current },
    onChange: () => { rebuildFromSettings(source()) },
  })
}
```

字段上 `role('secret')` 让值远离所有响应；`applies: 'restart'` 告诉配置面"改动只在下次启动生效"。

**browser 半**——注册卡片：

```ts
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
  const card = new MyPluginCardController(ctx.settingsScope.bind({ namespace: 'my-plugin' }))
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'my-plugin',
    locale: 'settings.myPlugin',
    inject: () => card.inject(),
  }, MyPluginCard),
  )
}
```

`ctx.settingsScope` 把每次写都用它读到的 revision 围起来（revision fencing）。scope 快照带表单需要的三样：解析后的 `value`、组合 `base`、raw `user` 层——**user 层的键"存在性"（不是值）**才标记一个字段被覆盖。`scope.set(field, value)` 存一个字段，`scope.unset(field)` 清回组合层。

两半都必须落在**一个包**里（Host 半在 `src/`，browser 半在 `src/client/`，导出 `./client` 并声明 `dsh.client`）。Plugins tab 只渲染 Host 已 serve 且卡片已 claim 的 namespace；卡片按注册进 slot 的顺序出现。

## 12.7 配置如何暴露

写扩展最容易犯的错，是把可调参数写死。dsh 的约定：

- **验证过的 Config 字段，cordis.yml 可改。** 插件的 `Config`（schemastery schema）就是它的公开配置面，用户/部署在 cordis.yml 里通过 `config:` 键覆盖。例如 compaction-basic 的 `thresholdRatio` / `retainRatio` 就是这么暴露的（第 11 章 11.4.10）。
- **禁止硬编码可调参数。** 一个参数今天调优、明天要按部署改，就属于 Config，不是常量。
- **`DEFAULT_*` 常量不算可配置性。** 默认值常量只是 schema 默认的来源，不构成"这个参数已暴露"的证据。暴露 = 进了 Config schema 并能在 cordis.yml 改。

secret 走 credentials 域（`CredentialRef` 引用，从不带值）而非 Config 明文（见 12.4）。settings seam 的解析顺序是 `默认值 → 组合 base → user document`，这是 `installSettingsSection` 与普通 Config 的差异所在：前者还能在运行时 hot commit 并回写 user 层，后者是启动期解析。

## 12.8 分发与发现

out-of-tree 插件（不在主仓库里的第三方插件）的分发与发现机制：

- **发现**：给插件仓库加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic（README 原文：Add the `dsh-plugin` topic to your plugin repository for discoverability）。
- **安装**：`dsh` CLI 的 plugin 子命令直接转发给 pnpm，在 profile 目录里执行（[apps/cli README](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md)）：

```text
dsh plugin --profile <name> <pnpm args>
```

它把后面的 pnpm 参数转发到该 profile 的目录，用于管理 profile 的插件依赖。举例（`tui` 是一个装了终端 UI 的 profile，`github:deepseek-harness/turtle-ui` 是 pnpm 可解析的插件来源）：

```sh
dsh plugin --profile tui add github:deepseek-harness/turtle-ui
```

`web` 和 `headless` 两个 profile 首次使用时从内置模板自动初始化；**其它任何 profile 都必须通过 `dsh plugin` 创建**。安装进 profile 的包，出现在该 profile 的 `package.json` 依赖里，pnpm 装到 profile 自己的 `node_modules`，再由 profile 的 `cordis.patch.yml` 以新行挂载。

## 12.9 演示 bundle

仓库自带两类"可运行"的示例，是学习 bundle 组装与协议驱动的最佳起点（extension-cookbook.md 原文）：

- **`packages/examples/`** 是演示 bundle 包：`agent-spine-demo`（headless 快照叶子挂载它 + JSONL persistence）、`acp-demo`（ACP 叶子用 `@deepseek-ai/dsh-acp-demo`）、`jsonrpc-demo`（JSON-RPC 叶子用 `@deepseek-ai/dsh-sdk-jsonrpc-demo`）。
- **`examples/`** 是可运行的 cordis.yml 叶子，每个叶子从 `examples/*/cordis.yml` 加载自己的插件树：`acp-agent`、`headless-agent`、`jsonrpc-agent`、`mcp-memory`、`web-cordis`、`web-schedule`。根 `demo:*` 脚本和这些叶子目录是权威清单。

分工：产品 `dsh` launcher 拥有 Web 和 one-shot headless 执行；ACP 叶子用 `@deepseek-ai/dsh-acp-demo`；JSON-RPC 叶子用 `@deepseek-ai/dsh-sdk-jsonrpc-demo`；headless 快照叶子显式挂载 `@deepseek-ai/dsh-agent-spine-demo` 和 JSONL persistence，再用示例自己的测试 fixture 驱动。

想跑一个完整插件树、看一个最小可组合 agent 长什么样，从 `examples/*/cordis.yml` 读起；想抄"一个 bundle 包怎么声明、怎么被 profile 引用"，看 `packages/examples/*`。

## 12.10 贯穿示例：一个小工具插件从骨架到挂载

把前几节串起来，写一个最小但完整的小工具插件：包骨架（12.2）→ 工具（12.3）→ 挂到 profile（12.8）。

**第一步：包骨架。** `packages/shell/tool-my/package.json` 按 12.2 的不变量写：

```jsonc
{
  "name": "@deepseek-ai/dsh-tool-my",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" }
  },
  "files": ["lib/index.js", "lib/invariant.js", "lib/types/**/*.d.ts"],
  "peerDependencies": { "@deepseek-ai/cordis": "^1.0.0" },
  "devDependencies": { "@deepseek-ai/cordis": "^1.0.0" },
  "dependencies": { "@deepseek-ai/dsh-tools": "workspace:*" }
}
```

`tsconfig.json` extends `../../../tsconfig.base.json`，并在 `tsconfig.host.json` 的 `references` 里加一行（这个包是 Host 侧，只属于这一个 aggregate）。

**第二步：工具本体。** `src/index.ts` 用 12.3 的最小形状：

```ts
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-my'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'read_file',
    description: 'Read a file from disk.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path' },
      limit: { type: 'number' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      return readFile(args.path, { encoding: 'utf8', signal: exec.signal })
    },
  }))
}
```

注册是 `ctx.effect`：这个包一旦从组合里移除，工具随之反注册，schema 也不再进 prompt。Code Mode 里它还免费获得 `await tools.read_file({ path })` 的程序化入口，无需额外集成。

**第三步：挂到 profile。** 在 profile 的 `cordis.patch.yml` 里插入一行，把它挂进组合树（新行即插入，架构上 patch 按 id 替换整行 config 或插入新行）：

```yaml
- name: '@deepseek-ai/dsh-tool-my'
```

如果你愿意把它做成可再分发的 bundle，就在 package.json 里声明 `dsh.bundle` 指向它的 patch 文件，让别的 profile 以 bundle 形式叠放它（12.2）。这样一个工具从"写代码"到"进入某个 profile 的组合"的完整链路就闭环了。

**进阶思考**：这个最小工具缺了什么？它没有 `presentationMeta`（卡片数据无法跨回放持久化）、没有 UI card（回退到 generic 卡片）、没有 `run_in_background`（长任务不能转后台，后台路径要 gate 到 producer config 再经 `ctx.jobs.start({ kind, label, owner: exec.agent, run })` 登记）、没有 Config（无可调参数暴露）。把这些按 12.3 / 12.7 的契约补齐，就是从"能跑的 demo"到"生产级工具"的距离。`packages/shell/tool-bash` 是那条路上的完整参照。

## 12.11 本章小结

- 扩展开发的入口是 extension-cookbook.md：功能 → 机制映射表 + 分步指南索引，写扩展前先对号入座。
- 加一个包：新包注册到唯一 aggregate（host/client 二选一），package.json 走严格不变量，`dsh.profile` / `dsh.bundle` 决定发布为 profile 还是 bundle，README 必带 Model Experience 段。
- 加一个工具：schema 自动进 prompt 组装，`execute` 遵守 canonical 值 / 冻结身份 / signal 契约，策略挂到 `tools/pre-execute | execute | post-execute` 与 `tools/result`，UI 渲染意图（generic / terminal / diff）在设计阶段定。
- 加一个 LLM 适配器：注册到 `ctx.llm`，实现 `StreamChunk` 流式协议（usage 在 finish 前、arguments 端到端 RAW JSON、错误两条正路），secret 走 cordis-native 凭据，一个 adapter 一个 provider route。
- 加 Conversation Node：`ConversationNodeDefinition`（match / start / update）+ keyed renderer，事件带稳定业务 id，append 路径只做常数时间查找。
- 加设置卡片：Host 半注册 namespace、browser 半注册卡片，靠 namespace join，`settingsScope` 做 revision fencing。
- 配置要暴露：验证过的 Config 字段在 cordis.yml 可改，禁止硬编码可调参数，`DEFAULT_*` 常量不算可配置性。
- 分发与发现：`dsh-plugin` topic + `dsh plugin --profile <name> <pnpm args>` 安装 out-of-tree 插件，web/headless 自动初始化、其它 profile 需用 `dsh plugin` 创建。
- 演示与示例：`packages/examples/`（agent-spine / acp / jsonrpc demo）与 `examples/*/cordis.yml` 可运行叶子是学习 bundle 组装与协议驱动的权威起点。

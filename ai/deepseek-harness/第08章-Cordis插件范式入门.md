---
layout: default
title: 第08章：Cordis 插件范式入门
---

# 第08章：Cordis 插件范式入门

前面七章都在"用" dsh。从这一章开始，方向掉转——**"写" dsh**。而写 dsh 的第一步，不是读它的源码，而是理解它跑在什么框架上。

dsh 的全部能力都建立在 **Cordis** 之上：模型适配器、工具注册表、session 日志、agent 循环本身，都是 plugin。没有可补丁的核心，你扩展 dsh 的方式就是"在别的插件旁边再挂一个插件"。所以这一章不涉及任何 dsh 源码细节，只讲 Cordis 的范式——它是第 9 章（源码架构）、第 10 章（运行时）、第 11 章（capability seam）、第 12 章（扩展实战）的共同语言。不掌握它，后面四章会读不下去。

本章以 [cordis-primer.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md) 和生成的 [cordis-api/](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-api/context.md) 原文为准。

## 8.1 Cordis 是什么

Cordis 是 dsh 底层 vendored 的插件框架，它的设计论文是 [《A Programming Paradigm for Spatiotemporal Composability》](https://github.com/cordiverse/paper)。用一句话概括它的思想：

> **时空可组合**——一个 plugin 对共享 context 的每次贡献（service、事件、effect），都携带精确的作用域和生命周期，因此可以在**时间**（加载/卸载）与**空间**（作用域/隔离）两个维度上任意组合、叠加、回卷，而不需要 plugin 之间互相 import 或手动编排启动顺序。

落到工程上，[primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md) 把它拆成五条：

| # | 思想 | 含义 |
|---|---|---|
| 1 | plugin 是实现 Service 的对象 | 可以是一个函数（带可选 `inject` / `apply(ctx)`），也可以是一个 `Service` 子类 |
| 2 | context 是 service 仓库 | 一个 service 在 context 上占一个稳定的 `ctx.<key>`（如 `ctx.tools`、`ctx.llm`、`ctx.sessions`），别的 plugin 按 key 找它，而不是 import 具体实现 |
| 3 | 用 `inject` 声明依赖 | 命名了所需 service 的 plugin 会等那些 service 出现才启动，加载顺序由"需要什么"表达，而非手动 boot 顺序 |
| 4 | 类型化事件用于通信 | service 通过 TypeScript declaration merging 声明事件名，再按 `emit` / `waterfall` / `parallel` / `serial` 派发 |
| 5 | 注册即可逆 effect | prompt section、tool schema、adapter、provider、listener 都通过 `ctx.effect()` / `ctx.on()` 安装，reload / teardown 时能可预测地回卷 |

这三类贡献——**service**（能力）、**类型化事件**（通信）、**可逆 effect**（生命周期）——就是 Cordis 的全部。看懂这张表，dsh 源码里的每个包都是在向某个 context 贡献这三样东西。

### 8.1.1 三种插件形态

Cordis 接受三种插件写法，同一个东西的三种"外形"：

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

// 1. 函数插件：最常见的形态，loader 直接调用它
export function apply(ctx: Context) {}

// 2. 对象插件：带 apply 方法的对象
export const objectPlugin = {
  name: 'object-plugin',
  apply(ctx: Context) {},
}

// 3. 类插件：Service 子类，构造时把自身注册到 ctx.<name>
export class MyService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'myService')
  }
}
```

[教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.md) 的建议很直接：**除非要暴露 service，否则用函数形态**；需要往 `ctx` 上贡献一个命名能力时，才升级到类形态。

一个早期就要知道的坑：`cordis.yml` 里一个条目，如果它的模块**无法解析**（路径/包名拼错），是经 Cordis logger service 上报、而不是崩溃进程；boot 阶段这个报告可能在任何 console exporter 监听之前就丢了。所以"新加的条目好像没反应"时，先查拼写。

## 8.2 "Registrations are effects"

这是 Cordis 最反直觉、也最重要的一条规则：**一切注册都是 effect，卸载时自动回卷**。

传统框架里，注册和清理是分离的两步，程序员要记得"我在 `init` 里 `addEventListener` 了，就得在 `dispose` 里 `removeEventListener`"——忘了就是内存泄漏或幽灵回调。Cordis 把这个契约内建进了框架：任何通过 Cordis API 做的注册，**都会在所属 plugin 卸载时自动撤销**，无需手动清理。

- `ctx.on(event, listener)` —— listener 在卸载时被移除；
- `ctx.plugin(child)` —— 子 plugin 随父 plugin 一起 dispose；
- service 注册（`ctx.provide` / `super(ctx, name)`）——卸载时服务被移除；
- harness 注册表如 `ctx.tools.register(...)` —— 返回的 disposer 挂在调用 plugin 上，自动回卷。

对于 Cordis 没管理的资源（timer、连接、watcher），就用 `ctx.effect()` 把它包起来：

```ts
ctx.effect(() => {
  const timer = setInterval(tick, 200)
  return () => clearInterval(timer)   // 卸载时执行，且只在卸载时执行
})
```

`ctx.effect(execute)` 的语义（[fiber.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-api/fiber.md)）：

1. `execute` **立即执行**；
2. 它产出的 disposer 被收集起来，在"返回的 disposer 被调用"或"fiber 卸载"二者中**先发生**的那个时刻，按**逆序**执行；
3. 调用两次 disposer 是 no-op；
4. `execute` 可以是同步、异步，甚至 generator——generator 每 yield 一个 disposer 就注册一个。

一个 plugin 实例对应一个 **fiber**，fiber 走一个状态机：

```text
PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED
                   ↘ FAILED
```

- `PENDING`：已声明，但某个 `inject` 的 service 还没出现；
- `LOADING / ACTIVE`：`apply` 运行中 / 已完成；
- `FAILED`：`apply` 或 config 校验抛异常（**大声失败，不是跳过**）；
- `UNLOADING / DISPOSED`：disposer 运行中 / 全部拆完。

两点实战提醒（来自 [02-lifecycle-and-effects](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/02-lifecycle-and-effects.md)）：

- 插件因为"依赖 service 消失"或"hot reload"被卸载时，它的注册也会回卷——所以运行中的 consumer 永远拿不到已失效的 service 引用。
- disposer 按逆序开始，但多个 **async** disposer 是并发的；如果 teardown 必须顺序执行，就把它们放进同一个 disposer 里 `await`。

primer 最后给的几条实用规则，值得在写第一个插件前就记住：

- **把行为封装进插件**：工具管线事件归 `ctx.tools`，模型流式归 `ctx.llm`，live agent 协调归 `ctx.agents`。
- **拦截与策略用事件，直接能力调用用 service 方法**。
- **每次注册都要有 disposer**——要么 `ctx.effect()` 返回一个，要么用会自动处理的 Cordis 辅助函数。
- **teardown 顺序敏感的工作放同一个 effect 里**，这样 dispose 会按预期顺序回卷。

## 8.3 关键 API 一览

Cordis 的 API 面很小，全部挂在 `ctx` 上。下面这张表覆盖了写插件要用的核心成员（来源：[context.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-api/context.md)、[events.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-api/events.md)、[fiber.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-api/fiber.md)）：

| API | 用途 | 返回值 |
|---|---|---|
| `ctx.effect(execute, label?)` | 注册一个带清理的 effect；`execute` 立即跑，产出 disposer 在卸载时回卷 | 一个 disposer（幂等） |
| `ctx.on(name, listener, options?)` | 注册一个事件监听器，归当前 fiber 所有；卸载即移除 | disposer；仍注册时返回 `true` |
| `ctx.emit(name, ...args)` | 同步广播一个事件，忽略监听器返回值 | void |
| `ctx.parallel(name, ...args)` | 并发派发，等所有监听器 settle | Promise |
| `ctx.serial(name, ...args)` | 按序 await，第一个非 null/false/undefined 返回即停 | 首个 bail 值 |
| `ctx.waterfall(name, ...args)` | 环绕式中间件，最后一个参数是 `next` | 最外层监听器的返回值 |
| `ctx.provide(name, value)` | 注册一个归当前 fiber 所有的 service 实现 | 注销该 service 的 disposer |
| `ctx.get(name, strict?)` | 不带 inject 要求地读一个 service（可能 `undefined`） | service 值 |
| `ctx.root` | 应用根 context（每个子 context 共享它） | context |
| `ctx.plugin(plugin)` | 从代码挂一个子 plugin | fiber 句柄（可 `dispose()`） |

关于"作用域"（scope），Cordis 语境里没有叫 `ctx.scope` 的单一方法，而是三个创建**子 context** 的原语，它们都不改动父 context：

| API | 用途 |
|---|---|
| `ctx.extend(meta?)` | 建一个带额外元数据的子 context，原型继承父的所有属性 |
| `ctx.isolate(name, label?)` | 为 `name` 建一个独立 service 作用域，供一个不同实现而不影响父作用域；相同 `label` 两次调用会合并作用域 |
| `ctx.intercept(name, config)` | 为下方启动的 plugin 合并 service 专属 intercept config |

dsh 在此基础上又加了 [core/scope](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/scope.md) 包，用 `ScopeKey` + `ScopedLayers` 实现"按 agent 隔离的注册作用域"（一个注册既按 agent 可见、又共享生命周期归属）。第 10/11 章讲 agent scope 时会回到这里。

## 8.4 类型化事件与 declaration merging

Cordis 的事件不是字符串 + `any`。一个 service 声明事件，靠的是 TypeScript 的 **declaration merging**——在 `declare module` 块里往 `Events` 接口加签名：

```ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'stats/report'(name: string, count: number): void
  }
}
```

然后 `ctx.emit('stats/report', ...)` 和 `ctx.on('stats/report', ...)` 就都是完整类型化的。事件名约定用 `namespace/action` 形式，保持扁平的全局事件命名空间可读。

事件分五种派发模式（dispatch mode），模式是事件公开契约的一部分。`DispatchMode` 类型是 `'emit' | 'parallel' | 'serial' | 'bail' | 'waterfall'`：

| 模式 | await？ | 派发顺序 | 有返回值？ | 语义 |
|---|---|---|---|---|
| `emit` | 否 | 按注册顺序观察 | 否 | 同步广播，忽略监听器返回值 |
| `parallel` | 是 | 所有监听器并行 | 否 | 等所有监听器 settle |
| `serial` | 是 | 按注册顺序 await | 是 | 第一个非 null/false/undefined 返回即停 |
| `bail` | 否 | 按注册顺序同步调用 | 是 | `serial` 的同步版，首个 bail 值即停 |
| `waterfall` | 否 | 按注册顺序观察 | 是 | 环绕中间件，末尾是 `next` 续延 |

dsh 新增事件都会用 `@mode` 标签标注模式，让生成的 catalog 检查声明与派发点一致。选模式时记住 primer 的准则：**拦截与策略优先用事件，直接能力调用优先用 service 方法**。

### 8.4.1 SessionEventMap：merge-extensible map 的实例

dsh 把 declaration merging 用到极致的一个例子是 **`SessionEventMap`**。session 日志是 append-only 的 `SessionEvent` 流，也是模型看到上下文的事实来源（见第 10 章）。[architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) 里的规则是：

> **Model-visible means logged.** 任何到达模型请求的内容都必须能从日志重建，runtime 有一个断言强制这一点。

所以"给模型加一种新的可见输入"的正确做法不是 hack 循环，而是 **extend `SessionEventMap`**——往这个 merge-extensible map 加一个新事件类型，再从日志渲染它。这就是 declaration merging 在生产里的完整形态：类型层合并 + 运行时日志重放，两条线由同一个接口声明绑定在一起，永不漂移。

## 8.5 waterfall 语义：next() 是义务

waterfall 是 Cordis 里最容易踩坑的派发模式，也是拦截类扩展点（`agent/request`、`tools/pre-execute`、`approval/request`）的动力来源。

监听器收到 `(...args, next)`：

- **调 `next()`** → 委托给链上下一个监听器（最终是内建行为），可以用 `next()` 的返回值做包装/变换；
- **不调 `next()` 直接 return** → 短路整条链，下游监听器和内建行为都不执行。

一个只观察、只标注的监听器**必须调 `next()`**；忘掉它，会静默吞掉所有下游的默认行为。这是本仓库的 standing rule（[primer 的 waterfall 一节](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md#cordis-waterfall-semantics)）。反过来，对"单一决策"类事件，短路就是设计意图：一个策略监听器"拥有这个决策"时，就该 return 而不调 `next()`。

```ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'demo/transform'(input: string, next: () => Promise<string>): Promise<string>
  }
}

export function apply(ctx: Context) {
  // 包装下游结果
  ctx.on('demo/transform', async (input, next) => (await next()).toUpperCase())
  // 拥有决策时短路
  ctx.on('demo/transform', async (input, next) => {
    if (input.includes('blocked')) return '** blocked **'
    return next()
  })
}
```

需要"先于普通注册"运行时，用 `{ prepend: true }`。上面的代码里，两个监听器都归 `apply` 的 fiber 所有，插件卸载时一起移除。

## 8.6 cordis.yml 配置语法

`cordis.yml` 是一份**插件条目列表**。每个条目描述一个要挂载的插件及其配置：

```yaml
- id: my-greeter          # 可选，patch/overlay 按 id 定位整行
  name: './greeter.ts'    # 模块说明符：相对路径或 npm 包名
  inject: ['tools']       # 可选，等价于代码里的 inject
  config:                 # 可选，经 schema 校验后传给 apply(ctx, config)
    greeting: 'Hello'
  disabled: false         # 可选，为真时跳过挂载
```

条目的 `name` 是**模块说明符**；loader 挂载每个条目。条目**并发启动**，列表位置不保证加载顺序——顺序来自 service 依赖（`inject`），不来自文件里排第几行。

### 8.6.1 !!js 表达式求值（注意是 `!!js`，不是 `!js`）

config 值需要"加载时计算"时，用 `!!js` 标签（两个感叹号）：

```yaml
- name: './config-demo.ts'
  config:
    greeting: !!js process.env.DEMO_GREETING ?? 'Hello'
```

[primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md#loader-configuration) 对求值范围的说明：

- `@deepseek-ai/cordis-plugin-include` 把 `!!js` 解析成表达式节点；
- loader 对条目的 `config` 做插值（在声明的 injection 激活后、对那个 plugin 的 context——即 `ctx.serviceName`）；
- 对条目的 `disabled` 字段，在**每次挂载决策时**对 loader context 求值（本仓库的扩展），让一行能按平台/环境自举开关；
- 其余元数据（`name`、`id`、`inject`…）保持字面量，表达式在那里只是普通 truthy 数据。

`!!js` **只**在 `config` 和 `disabled` 两个位置生效。环境决定挂哪些插件时用 overlay（见 8.6.2），而不是把整行塞进 `!!js`。

### 8.6.2 disabled 与 overlay / 条件组合

- `disabled: true` 或 `disabled: !!js <表达式>` 让一行不参与挂载。`!!js` 的 disabled 每次挂载决策都重新求值。
- **overlay** 是环境选择插件的正路：一个 overlay 补丁按 `id` 定位并整行替换 config，或插入新行。第 5 章讲过 profile/bundle 的分层顺序（bundle 顺序 → profile `cordis.patch.yml` → home 级 → `--patch` overlay），overlay 就是最外层那片"条件组合"。

一个按环境选权限策略的实例（来自 [examples/acp-agent/cordis.yml](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/acp-agent/cordis.yml)）：

```yaml
- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: !!js "process.env.DSH_PERMISSION_MODE ?? (process.env.DSH_SNAPSHOT === undefined ? 'workspace-write' : 'danger-full-access')"
    workspaceRoot: !!js process.cwd()
```

### 8.6.3 config 校验

插件导出一个 `Config`（既是 TS interface 又是运行时 schema）。dsh 用 [Schemastery](https://github.com/shigma/schemastery)，Cordis 本身接受任何 [Standard Schema](https://standardschema.dev/) 校验器。坏配置在 `apply` 之前就让加载失败——**插件永不半配置启动**，`apply` 收到的永远是完整、校验过的 config。

```ts
export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  targets: Schema.array(String).default(['world']),
})
```

## 8.7 @deepseek-ai/cordis 是每个 harness 包的 peerDependency

Cordis 以 vendored 形式随仓库分发：源码在 [vendor/cordis](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)，同步流程记录在 vendor/README。harness 包通过 `@deepseek-ai/cordis` 这个 **peerDependency** 引用它。

为什么要 vendored + peer？因为 context 的"品牌"（brand）靠一个全局 symbol 而非 `instanceof` 判定——`Context.is(value)` 跨 realm、跨多份 cordis 副本都能工作。peerDependency 保证整个进程里只有一个 Cordis 实例被所有 harness 包共享，这样 declaration merging 出的 `ctx` 类型、event map、service 注册才是一致的一份。你自己写插件时，`@deepseek-ai/cordis` 是 peer，不打进你的包里。

## 8.8 最小插件完整骨架

把 8.1-8.7 串起来，一个"能挂到 harness 里"的最小插件长这样（融合 [01](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.md)、[02](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/02-lifecycle-and-effects.md)、[03](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/03-services.md)、[04](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/04-events.md)、[05](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/05-config.md) 章的写法）。逐行注释：

```ts
// 1) 类型导入：只用于注解，运行时消失，不增加运行时依赖
import { Service, type Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

// 2) declaration merging：类型层声明 service 与事件，不产生任何运行时 wiring
declare module '@deepseek-ai/cordis' {
  interface Context {
    greeter: GreeterService          // 让 ctx.greeter 到处类型安全
  }
  interface Events {
    'greeter/hello'(who: string): void   // 让 ctx.emit / ctx.on 类型化
  }
}

// 3) 配置契约：同名 interface + schema，apply 收到的是校验后的完整值
export interface Config {
  greeting: string
}
export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
})

// 4) service 实现：Service 子类本身就是一个 plugin 形态
export class GreeterService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'greeter')           // 注册为 ctx.greeter；这是 effect，卸载即移除
  }
  greet(who: string) {
    this.ctx.emit('greeter/hello', who)   // 通过共享 context 广播事件
    return `Hello, ${who}!`
  }
}

// 5) plugin 入口：loader 调 apply(ctx, config)
export const name = 'greeter'
export function apply(ctx: Context, config: Config) {
  // 挂载 service（可改成 ctx.plugin(GreeterService)）
  ctx.plugin(GreeterService)

  // 事件监听：归本 fiber 所有，卸载即移除
  ctx.on('greeter/hello', (who) => {
    console.log(`${config.greeting}, ${who}!`)
  })

  // 对 Cordis 未管理的资源，用 effect 包起来并返回 disposer
  ctx.effect(() => {
    const timer = setInterval(() => ctx.greeter.greet('tick'), 1000)
    return () => clearInterval(timer)   // 卸载时回卷
  })
}
```

挂到 `cordis.yml`：

```yaml
- name: './greeter.ts'
  config:
    greeting: 'Hola'
```

这套骨架里的每一处——`super(ctx, 'greeter')` 的 service 注册、`ctx.on` 的监听、`ctx.effect` 的 timer——都是 8.2 说的"effect"，插件一旦被卸载（config 编辑、hot reload、依赖 service 消失），三者一起按逆序回卷，不留任何残留。

## 8.9 本章是第 9-12 章的基石

为什么要单独用一章讲 Cordis？因为 dsh 的每一层都建立在这套范式上，后面四章反复引用本章的概念：

| 后续章节 | 会遇到的 Cordis 概念 |
|---|---|
| 第 9 章 源码架构 | 每个核心包向哪个 `ctx.<key>` 贡献 service（`ctx.sessions`、`ctx.tools`、`ctx.llm`、`ctx.agents`…）；profile/bundle 就是 Cordis config 行的组合与分层 |
| 第 10 章 运行时 | `SessionEventMap` 的 merge-extensible 声明、turn/step 事件、waterfall 扩展点（`agent/request`、`tools/pre-execute`）的 next() 委托 |
| 第 11 章 Capability Seam | seam 三角色（Service Definition / Provider / Consumer）就是 Cordis 的 service + inject + effect 的工程化命名 |
| 第 12 章 扩展实战 | 写工具 = 在 `ctx.tools` 上注册（返回 disposer）；写适配器 = 在 `ctx.llm` 上注册；scope 到单个 agent = 用那个 agent 的 `agent.ctx` |

一句话记住这一章：**在 dsh 里扩展，永远是"写一个插件、挂到 context 上、把清理交给 effect"**，没有例外路径。带着这个心智模型去读第 9 章的源码地图，会顺畅很多。

## 8.10 本章小结

- **Cordis 是 vendored 插件框架**，核心思想是"时空可组合"：每次贡献都带作用域与生命周期，可任意叠加回卷。
- **五条思想**：plugin 是 Service 对象、context 是 service 仓库、`inject` 声明依赖、类型化事件通信、注册即可逆 effect。
- **"Registrations are effects"**：`ctx.on` / `ctx.provide` / `ctx.plugin` 的注册在卸载时自动回卷；Cordis 不管理的资源用 `ctx.effect()` 包起来并返回 disposer；fiber 状态机 `PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED`。
- **关键 API**：`ctx.effect`、`ctx.on`、`ctx.emit`、`ctx.parallel`、`ctx.serial`、`ctx.waterfall`、`ctx.provide`、`ctx.get`、`ctx.root`、`ctx.plugin`；作用域用 `ctx.extend` / `ctx.isolate` / `ctx.intercept`，per-agent 隔离由 core/scope 包提供。
- **类型化事件**靠 declaration merging；`SessionEventMap` 是 merge-extensible map 的实例，遵循"Model-visible means logged"。
- **waterfall**：监听器必须调 `next()` 才能继续委托；不调即短路整条链——只观察的监听器绝不能忘 `next()`。
- **cordis.yml**：条目含 `name`/`id`/`inject`/`config`/`disabled`；`!!js`（不是 `!js`）只在 `config` 与 `disabled` 求值；环境选择用 overlay；config 经 schema 校验、坏配置大声失败。
- **`@deepseek-ai/cordis`** 是每个 harness 包的 peerDependency，vendored 共享单实例。
- **最小插件骨架** = 类型声明合并 + 配置 schema + Service 子类 + `apply` 里的 effect 注册 + `cordis.yml` 挂载；这是第 9-12 章的共同基石。

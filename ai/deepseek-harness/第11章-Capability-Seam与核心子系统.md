---
layout: default
title: 第11章：Capability Seam 与核心子系统
---

# 第11章：Capability Seam 与核心子系统

前几章反复提到 dsh 的一个口号：Everything is a plugin。插件是"组织代码"的单位，但光有插件还不足以解释"换掉模型、换掉沙箱、换掉整个执行环境"这种事为什么这么容易。这一章回答一个更底层的问题：dsh 如何把一群互不认识的插件，组织成一批可以整条替换的"能力"，以及这些能力之间的边界画在哪里。

本文涉及的官方文档以 master 分支为准：

- [docs/architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [docs/capability-seams.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md)
- [docs/subsystems/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/README.md)

提醒一次：DeepSeek Harness 目前处于 developer preview，**会有破坏性兼容变更**。本章涉及的包名、`ctx` 键名和事件名以 master 原文为准，阅读时请留意版本差异。

## 11.1 三角色：Service Definition / Provider / Consumer

architecture.md 对 seam 的定义非常简短，但每个词都重要：

> A **seam** is a swappable capability with three roles: a **Service Definition** declaring the interface, a **Service Provider** implementing it, and a **Consumer** using it, commonly a model-facing tool.

把这句话拆开，一个 capability seam 由三个角色构成，缺一不可：

| 角色 | 职责 | 典型形式 |
| --- | --- | --- |
| Service Definition | 声明接口（抽象服务、类型、事件契约） | 一个只含 `abstract` 服务与类型的包 |
| Service Provider | 实现该接口 | 注册到同一个 `ctx` 键上的具体后端 |
| Consumer | 通过该接口完成实际工作 | 通常是面向模型的工具（tool） |

三者缺一不可的意思是：**只有一个角色不构成 seam**。如果一个包同时承担了三个角色（比如一个小工具自己声明、自己实现、自己消费），它只是一个普通插件，而不是一个可替换的 capability。反过来说，当你决定"我要新增一个可替换能力"时，你实际上是在做三件事：设计接口、写一个实现、写一个（通常面向模型的）消费者。

architecture.md 举了一个模板：**shell 三件套**。`shell` 包声明 `ctx.shell` 服务（Service Definition），`bash-local` / `bash-sandbox` / `pwsh-local` 是它的实现（Service Provider），`tool-bash` / `tool-pwsh` 是消费它的模型工具（Consumer）。三者分散在三个独立演进速度的包里，这就是 seam 的教科书式布局。

一个包可以合并角色，但合并与否是设计决策，不是默认值。adding-a-package 的 cookbook 对此有明确建议（[docs/cookbook/adding-a-package.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)）：

> For a swappable capability, separate Service Definition / Service Provider / Consumer roles into packages when they evolve independently.

只有当三者的演进速度一致、没有替换需求时，才把它们压进一个包。反之，一旦你预期某个后端会被换掉（本地执行换成远程执行，HTTP 换成另一个 vendor），就该拆开。

seam 的命名有两条硬规则（来自 adding-a-package cookbook），写包时要遵守：

- **单复数**：单个 engine / runtime / policy / controller / resolver / store / 当前配置，用单数 `ctx` 键；注册表或拥有多个命名成员的服务，用复数键。
- **`local` 的用法**：只在"同主机执行是契约的一部分"时用。所以 `subprocess-local` / `fs-local` 表达"本机实现"，`subprocess-e2b` 用 vendor 名表达"远程实现"。

命名不是美学问题，它直接告诉读者这个包属于 seam 的哪个角色、可不可替换。

capability-seams.md 的开头把一张图里的所有服务分成三类，这张图本身就是理解 dsh 的一把钥匙：

- **core spine service**：核心脊柱服务。不做路由、只有一份，是产品"骨架"的一部分，例如 `ctx.sessions`（append-only 会话日志）。
- **swappable capability seam**：可替换能力缝，即本节讲的三角色。
- **bundle/composition point**：bundle/组合点，例如 `ctx.agentLoop`（唯一的具体 loop 插件）。

这张图由 `scripts/gen-doc-graphs.ts` 自动生成（文件头部注明 do not edit by hand），每个节点标注三样东西：声明服务的 owner 包、已知实现包、以及直接消费该服务的包。图的维护模式是 "hybrid"：服务从 Cordis 声明中发现，interface / implementation / consumer 三种角色由脚本分类，并带完整性守卫（completeness guard）。这意味着"这个 seam 有几个实现、谁直接消费它"，可以只读图、不翻源码地回答。

## 11.2 seam 的意义：换一个 provider 换掉整个产品

seam 最容易被低估的价值，不是"代码整洁"，而是**替换的粒度**。architecture.md 用一句话点破了它的威力：

> Seams are why one provider swap changes the whole product. Filesystem and subprocess providers share one execution world, so pointing them at a remote sandbox moves Bash, PTY, and LSP with them, with no provider forks.

拆解这个论断。`ctx.fs`（文件系统）和 `ctx.subprocess`（子进程）是两个独立的 seam，但它们的实现**共享同一个"执行世界"**。在本地运行时：

- `fs-local` 操作宿主机文件系统；
- `subprocess-local` 在宿主机上拉起进程。

此时 Bash 工具（`tool-bash`，消费 `ctx.shell`，而 `bash-local` 又通过 `ctx.subprocess` 拉起进程）、PTY 终端（`terminal-bash`，消费 `ctx.subprocess` + `ctx.terminals`）、LSP 客户端（`lsp-stdio`，同样通过 `ctx.subprocess` 起 language server）——全都工作在本机。

现在把 `fs-local` 和 `subprocess-local` 换成指向远程沙箱的实现。**因为 Bash、PTY、LSP 都消费同一个 `ctx.subprocess` seam，它们会一起迁移到那个远程沙箱，而不需要给每个工具单独写一个"远程版本"（no provider forks）**。你换的不是三个功能，是一个"执行世界"。

这个原则在 capability-seams.md 的 `ctx.subprocess` 条目里写得更直白：

> The bash executors, the PTY shell backend, the LSP host, and the out-of-process ACP, Codex, and Claude Code subagent backends spawn through ctx.subprocess.

也就是说，`ctx.subprocess` 承载的消费者远超"跑一条命令"这么简单——它同时是 Bash、终端、LSP、以及多个子 agent 后端的进程底座。指向它一换，全链路跟着换。

还有一个重要的边界澄清，同样来自 capability-seams.md：

> Containers, microVMs, and remote execution are sibling implementations of **whole capability seams**, not providers of `ctx.sandbox`.

容器、microVM、远程执行这类隔离方案，不是往 `ctx.sandbox` 上再加一个 backend，而是把 `ctx.fs` + `ctx.subprocess` 这类整条 seam 换成另一套实现。`ctx.sandbox` 的职责窄得多——它只负责"给一个即将 spawn 的 argv 套一层文件效果策略"，并不承载执行世界本身。理解了这条分界线，就理解了为什么 E2B（远程沙箱）的接入方式不是"注册一个 sandbox provider"，而是提供了 `fs-e2b` 和 `subprocess-e2b` 两个包（见 11.8）。

为什么这个设计值得学？因为它把"替换"的成本从 O(消费者数量) 降到了 O(seam 数量)。没有 seam 的世界里，把执行环境从本地换成远程，要改 Bash、PTY、LSP 三个工具各自的后端；有 seam 的世界里，你只换 `ctx.fs` 和 `ctx.subprocess` 两个 provider，其余消费者零改动。seam 的边界画在哪里、画多少，本质上是在决定"未来哪些东西可以被整体替换"。

## 11.3 子系统与 ctx 键对照表

capability-seams.md 维护了一张完整的服务图（含 mermaid 依赖图）。下表抽取了与"模型能力"最相关的一批 `ctx` 键，作为导航索引。角色列取自原文的 Role 分类：`seam` 表示可替换能力，`core` 表示核心 spine 服务（不替换，只做一件事）。

| ctx 键 | 角色 | Owner 包 | 主要实现 | 直接消费者 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `ctx.llm` | seam | `llm` | `llm-deepseek`、`llm-pi-ai`、`llm-replay` | `agent-loop`、`compaction-basic` | 模型适配器注册表；loop 和 compaction 通过 provider 无关的流式服务调用模型 |
| `ctx.tools` | core | `tools` | - | `agent-loop`、全部 `tool-*` 包 | 工具注册表 + 守卫执行管线（pre-policy、monotonic guard、around dispatch、post-policy、final-result observation） |
| `ctx.systemPrompt` | core | `system-prompt` | - | `agent-loop`、`tools`、`tool-fs`、`tool-terminal`、`tool-web` | 为每一步收集 prompt 分节与面向模型的工具 schema |
| `ctx.shell` | seam | `shell` | `bash-local`、`bash-sandbox`、`pwsh-local` | `tool-bash`、`tool-pwsh`、`hooks-claude-code`、`hooks-codex` | Bash 执行器 seam；沙箱版 / 远程版 / PowerShell 版替换 bash-local 而不碰工具层 |
| `ctx.subprocess` | seam | `subprocess` | `subprocess-local`、`subprocess-e2b` | `bash-local`、`bash-sandbox`、`terminal-bash`、`lsp-stdio`、`subagent-acp/codex/claude-code` | 进程 seam；Bash/PTY/LSP/子 agent 的进程底座 |
| `ctx.terminals` | seam | `terminal` | `terminal-bash` | `tool-terminal` | 持久 PTY 会话注册表；后端管终端机制，工具层管 owner-scoped 模型工具 |
| `ctx.fs` | seam | `fs` | `fs-local`、`fs-sandbox`、`fs-e2b` | `tool-fs` | 文件系统 provider seam；`fs-observation-policy` 通过 `fs/*` 事件门贡献观测检查 |
| `ctx.sandbox` | seam | `sandbox` | `sandbox-local` | `bash-sandbox`、`terminal-bash` | 进程沙箱 seam；消费者把"即将 spawn 的 argv"交给它包裹 |
| `ctx.commands` | core | `commands` | - | - | 人类命令注册表；插件注册直接命令，不经模型 |
| `ctx.jobs` | seam | `jobs` | `jobs-local` | `tool-bash`、`tool-terminal`、`tool-subagent`、`tool-jobs` | 后台任务注册表；后台 bash / PTY send / 子 agent 委托在这里登记 |
| `ctx.goals` | core | `goal` | - | - | 同 session 的目标领域；从日志折叠修订态的目标状态 |

这张表不是全部。capability-seams.md 还列了 `ctx.sessions`、`ctx.sessionPersistence`、`ctx.settings`、`ctx.credentials`、`ctx.compaction`、`ctx.subagents`、`ctx.skills`、`ctx.web`、`ctx.lsp`、`ctx.workflowEngine`、`ctx.planMode`、`ctx.agentPresets`、`ctx.approval` 等几十个键，每个都标明了 Owner、实现、直接消费者和伴随插件。写作时的权威来源是[那张表](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md)，以及每个子系统在 `docs/subsystems/` 下的独立参考页（如 [shell](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/shell.md)、[subprocess](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subprocess.md)、[filesystem](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/filesystem.md)）。

一个读图技巧：**角色为 `core` 的键几乎总是"单例、不做路由、只有一份"，角色为 `seam` 的键几乎总是"注册表 + 多个实现 + 一个面向模型的消费者"**。这跟 11.1 的三角色定义一一对应。

上表刻意只列了"面向模型的执行能力"。dsh 还有一批支撑性 seam 与 core 服务，属于"数据 / 配置 / 凭证 / 观察"范畴，同样遵循三角色或单例原则，速查如下：

| ctx 键 | 角色 | 说明 |
| --- | --- | --- |
| `ctx.sessions` | core | append-only Session 实例 + 持久 session 事件流；模型可见即已落日志 |
| `ctx.sessionPersistence` | seam | 持久化后端（`session-persistence-jsonl` / `-sqlite`）持久化同一个 `SessionEvent` 词汇 |
| `ctx.settings` | seam | 用户设置；插件注册 namespace schema，provider 存 raw document，分层解析 |
| `ctx.credentials` | seam | 凭据；配置只带 `CredentialRef` 引用（从不带值），按操作解析 |
| `ctx.skills` | seam | skill provider 注册表（`skill-badge` / `skill-filesystem`） |
| `ctx.web` | seam | 搜索与抓取 provider 共用一个 seam，`tool-web` 拥有稳定的模型名称 |
| `ctx.approval` | seam | 一次性权限决策，走 `approval/request` waterfall；缺席 fail-closed 为 `unavailable` |
| `ctx.subagents` | seam | 子 agent provider 注册表 + 可选的 Activation 延续编排 |
| `ctx.compaction` | seam | 压缩 seam；`compaction-basic` 是参考后端，没有面向模型的 compact 工具 |
| `ctx.lsp` | seam | 恰好四个操作的规范化查询，无协议逃生口 |
| `ctx.workflowEngine` | seam | 工作流引擎；与 bash 一样"一个 context 一个 engine" |
| `ctx.planMode` | core | plan/mode 状态折叠、`/plan` 入口、`exit_plan_mode` 退出 schema |
| `ctx.agentPresets` | core | 按 session 组合 agent，挂 preset `cordis.yml` 到 agent scope |
| `ctx.spillStore` | seam | 溢出存储：存超大工具文本，返回面向模型的 locator + 检索提示 |
| `ctx.storage` | seam | 非 session 存储 hub（`storage-json` / `-sqlite` 并排注册） |
| `ctx.sessionTelemetry` | seam | 捕获、脱敏后交给唯一后端，输出直接离开进程 |
| `ctx.typert` | core | 运行时类型注册表；插件直接或经 loader 注册 zod contribution |
| `ctx.agents` | core | live Agent handle + create/resume 工厂 seam + 进程内 initiator 传播 |

这张表仍然不完整，但它说明了一个规律：**dsh 把"数据 / 配置 / 凭证 / 观察"这些横切关注点也做成了 seam**，于是换持久化后端、换凭据存储、换遥测后端，与换模型、换沙箱一样，都是"换 provider"而非"改代码"。

## 11.4 能力包逐个速览

下面按包目录逐组过一遍，每组只讲"它是什么、缝在哪、消费者是谁"。包路径均可替换 `packages/<group>/<name>` 直接在仓库中查看。

### 11.4.1 llm/

模型能力的最小闭环。`llm` 包声明 `ctx.llm`（适配器注册表 + `StreamChunk` 流式协议），`llm-deepseek`（直接 HTTP，SSE 用 `eventsource-parser` 解析）和 `llm-pi-ai`（包装一个 LLM library）是两个参考实现，`llm-replay` 是测试用的回放实现。`agent-loop` 和 `compaction-basic` 是它的直接消费者。加模型供应商 = 往 `ctx.llm` 注册一个 adapter，见第 12 章。

### 11.4.2 fs/

文件系统能力。`fs` 声明 `ctx.fs`，`fs-local`（本机）、`fs-sandbox`（按共享沙箱模式圈定写边界）、`fs-e2b`（远程）是三个实现。`tool-fs` 的 read/write/edit 全部通过 `ctx.fs` 执行。`fs-observation-policy` 通过 `fs/*` 事件门贡献"观测到的文件状态"检查。

这里 `fs-sandbox` 的写边界来自共享沙箱模式——capability-seams.md 强调 bash 与 fs 不能圈到不同的根（两者都读同一个 `ctx.sandboxPolicy`）。这解释了为什么沙箱模式不是散落各处的开关，而是 `ctx.sandboxPolicy` 这一处权威来源。

### 11.4.3 shell/

命令执行能力。`shell` 声明 `ctx.shell`，实现有 `bash-local`、`bash-sandbox`、`pwsh-local`。`shell-env`（`ctx.shellEnv`）管 DSH_* 环境事实的命名空间，每个 shell 工具每次执行收集一份可信快照。消费者是 `tool-bash`、`tool-pwsh`，以及把外部 hook 配置映射到扩展点上的 `hooks-claude-code` / `hooks-codex`。

### 11.4.4 subprocess/

进程底座，见 11.2。`subprocess` 声明 `ctx.subprocess`，`subprocess-local` 是本机实现，`subprocess-e2b` 是远程实现。它被 bash 执行器、PTY 后端、LSP host、以及 out-of-process 的 ACP / Codex / Claude Code 子 agent 后端共同消费。

它的词汇在 [subprocess 子系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subprocess.md)里有完整定义：完全显式的 `SubprocessSpawnSpec`、基于偏移的输出读取器、以及受管理的 `DSH_*` 环境变量词汇。进程坐标、树/session 生命周期、stdio 处置、终端机制、kill 升级，全都由这个 seam 拥有——这也解释了为什么它是 11.2 里"换执行世界"的枢纽。

### 11.4.5 terminal/

持久 PTY。`terminal` 声明 `ctx.terminals`，`terminal-bash` 是唯一实现，`tool-terminal` 暴露 owner-scoped 的模型工具。`ctx.terminals` 只拥有"精确 Agent 会话身份与清理"，后端才拥有终端机制。

### 11.4.6 lsp/

语言服务器导航。`lsp` 声明 `ctx.lsp`，`lsp-local` 实现，`tool-lsp` 消费。这个 seam 只有**恰好四个操作**的规范化查询（原文强调 no protocol escape hatch），后端必须把协议请求翻译成规范化请求与结果。`lsp-stdio` 通过 `ctx.subprocess` 起语言服务器。

### 11.4.7 skill/

技能能力。`skill` 声明 `ctx.skills`，`skill-badge`、`skill-filesystem` 是 provider，`tool-skill` 渲染 session-prefix 目录并在调用时加载完整技能体。

### 11.4.8 subagent/

子 agent 委托，谱系详见 11.6。`subagent` 声明 `ctx.subagents`，provider 从 `subagent-spawn-in-process` / `-fork` 到 `-acp` / `-codex` / `-claude-code` / `-dsh-sdk` 一应俱全；`tool-subagent` 把一个配置好的 provider 暴露给模型，`tool-subagent-control` 负责投递后续消息。它的能力分叉（start-time vs runtime）见 [subagent 子系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subagent.md)。

### 11.4.9 web/

网络访问。`web` 声明 `ctx.web`，搜索 provider 有 `web-search-exa` / `-perplexity` / `-deepseek`，抓取是 `web-fetch-http`，`tool-web` 拥有稳定的面向模型名称 `web_search` / `web_fetch`。provider 可用性（availability）是它词汇表的一部分，见 [web 子系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/web.md)。

### 11.4.10 compaction/

上下文压缩，是一个可选项而非 loop spine。`compaction` 声明 `ctx.compaction`，`compaction-basic` 是参考后端，`command-compact` 是人工消费者（`/compact` 一类入口），`compaction-tool-result-pruner` 是可选的"无模型工具结果裁剪"服务（`ctx.toolResultPruner`）。核心配置见下表（来自 `BasicCompactionConfig`）：

| 配置键 | 默认 | 含义 |
| --- | --- | --- |
| `thresholdRatio` | `0.8` | 在 `floor(路由上下文窗口 × ratio)` 时压缩 |
| `retainRatio` | `0.16` | 保留的最近 surface 预算占窗口比例；与 `retainTokens` 互斥 |
| `retainTokens` | 无 | 保留的绝对 token 预算；与 `retainRatio` 互斥，且必须低于解析出的阈值 |
| `maxTokens` | `8192` | 摘要调用的生成上限（可能含 reasoning token） |
| `compactionRetries` | `1` | 首次之后仍超阈值时的额外尝试次数 |
| `maxOverflowRetries` | `1` | 规范化上下文窗口溢出后的最大重试次数 |
| `modelPolicies` | `[]` | 精确 `{ provider, model, ...partialPolicy }` 覆盖 |
| `auto` | `true` | 是否注册 step-boundary 压力与溢出恢复监听 |

压力检查发生在 serial `agent/pre-step` 上，溢出恢复走 `agent/request-error`。摘要通过一次 `ctx.llm.stream()` 调用产生，重放对话前缀以复用 provider 的 KV cache。详见 [compaction 子系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/compaction.md)。

`compaction-basic` 的事务用三个 log-only 事件把一次压缩锁起来：`compaction/start`（记锁，数字表示自动 turn、`null` 表示独立手动尝试）、`compaction/summary`（安全摘要投影 + shadowed 范围/seqs + token 计数 + summarize 调用的 provider/model 信封）、`compaction/end`（释放锁，可带 `error`）。锁先加后放：先 append start，再摘要、再 summary、再 surface 替换，最后 end——崩溃会留下"有 start 无 end"的可检测孤儿锁，而不是一个谎报已完成的 end。摘要本身不直接进 surface，而是骑在一个带 `surfaceOp: { op: 'replace' }` 的 `user/message` 上，这是唯一由摘要压缩执行的 surface 变更。

### 11.4.11 workflow/

动态工作流。`workflow` 声明 `ctx.workflowEngine`，`workflow-worker-thread` 是 worker 线程引擎，`tool-workflow` 是模型工具，`tool-ralph` 是固定结构输出的专用消费者。与 bash 一样"一个 context 一个 engine"，没有命名 provider 注册表。

### 11.4.12 todo/

待办事项。`tool-todo` 是面向模型的工具，它的状态通过 `ctx.sessionProjections`（投影单元）折叠，而不是自己维护一个独立 `ctx.todo` 键——这正是"领域状态从日志投影而来"的典型例子。

### 11.4.13 plan/

计划模式。`plan-mode`（`ctx.planMode`）折叠 logged `plan/mode` 状态、在 turn 边界 flush 用户选择、渲染部署侧指南、注册 `/plan`，并保持 `exit_plan_mode` 退出 schema 的稳定。注意它的**强制**职责留在独立的 sandbox / approval 轴上，plan-mode 本身不执法。

### 11.4.14 preset/

按 session 组合 agent，详见 11.7。`agent-presets`（`ctx.agentPresets`）发现 preset 目录，在创建 agent 时把一个 preset `cordis.yml` 挂到 agent scope 下。

### 11.4.15 guard/

loop-hygiene 守卫家族，详见 11.7。`repeat-tool-reminder` 对重复工具调用发出提醒，`timeout-policy` 按部署策略给每次工具调用设置 deadline。

上面 15 组覆盖了模型最直接触碰的能力。还有几个能力包值得知道但不必逐组展开（多数已在 11.3 的速查表里）：`approval`（一次性权限决策）、`attachment`（持久二进制附件存储，host 在 session 事件前提交已接受的图片）、`credentials`（凭据 seam）、`storage` / `storage-domain`（非 session 存储 hub 与领域数据设施）、`spill`（超大工具文本溢出存储）、`session-telemetry`（出站会话报告）、`typert`（运行时类型注册表）、`workspace`（workspace 实体注册表）。它们的共同点是：要么是数据/凭证/观察范畴的 seam，要么是 core 脊柱服务，接法与前面一致——声明、实现、消费，缺一不可。

## 11.5 新增行为到哪：决策表

architecture.md 有一张"Where new behavior goes"的表，是开发时的第一张查表。核心原则：**新行为挂在文档化的扩展点上，而不是改 loop 本身**。把它翻译整理如下（机制列保留英文原文）：

| 目标 | 机制 |
| --- | --- |
| 加模型 provider | 在 `ctx.llm` 上注册 adapter |
| 加面向模型的能力 | 在 `ctx.tools` 上注册；其 schema 自动进入 prompt 组装 |
| 给某个 session 不同的能力集 | 组合一个 agent preset；那里的 service 行需要 `isolate` realm |
| 加 shell 执行 | 注册一个 `ctx.shell` backend；本地实现通过 `ctx.subprocess` spawn |
| 加持久终端执行 | 注册一个 `ctx.terminals` backend + `dsh-tool-terminal` |
| 加人类命令 | 在 `ctx.commands` 上注册；不经模型 turn 直接分发 |
| 加后台任务 | 在 `ctx.jobs` 上注册；`job_*` 工具收集或停止它 |
| 加文件系统访问或策略 | 注册一个 `ctx.fs` provider，或监听 `fs/*` 事件 |
| 圈定 spawn 的进程 | 用一个 `ctx.sandbox` backend；消费者在 spawn 前包裹 argv |
| 拦截 request / tool / turn | 用它的 `agent/*` 或 `tools/*` 事件；`agent/turn-stopping` 停止一个 turn |
| 加面向模型的上下文 | 调 `agent.inject()`；落到下一次被接纳的 request |
| 加 UI 或编辑器集成 | 驱动 `ctx.agents`，从 `session/event` 渲染 |
| 加 Web Client Chat 节点 | 注册 `ConversationNodeDefinition` + keyed renderer |
| 加持久 session 状态 | 扩展 `SessionEventMap`；从日志渲染与回放 |
| 生成 session 标题 | 注册唯一的 `ctx.sessionTitle` provider |
| 管理同 session 目标 | 用 `ctx.goals`；通过 `agent/*` 继续 |
| Fork 一个 live session | `ctx.sessions.fork(source, boundary?, childSessionId?)` |
| 把注册作用域限定到一个 agent | 用该 agent 的 `agent.ctx` |

这张表的含金量在于"**哪一栏都指向一个扩展点，没有一栏指向'改 agent-loop'**"。这也是 extension-cookbook.md 所谓 microkernel claim 的由来：每个产品特性都能映射到某个文档化扩展点上的一个 listener。

顺带补齐这张表背后的**事件域**，因为它决定了"挂在哪"的答案。architecture.md 把事件分成三域：

- **Session 事件**：持久的、append 到日志的事实，经 `session/event` 广播。要"重载后仍在"就用它。
- **Agent 事件**（`agent/*`）：带一个 live `Agent`（inbox、step、status、request、validation、continuation）。观察或拦截在飞的工作用它。
- **Capability 事件**：把策略和 adapter 挂到 seam 上（`fs/*`、`tools/*`、`telemetry/*`），不 import loop。

其中 `agent/pre-step`、`agent/request`、`llm/stream` 和三个 `tools/*` 事件是 **waterfall**（listener 必须调 `next()` 才能委托）；`agent/turn-stopping` 是 **serial**，没有 `next()`。写拦截逻辑时先分清自己挂的是哪一类：waterfall 要记得放行，serial 不用。

最后澄清两个高频混用的粒度词，它们决定了"拦截"作用于哪一层：architecture.md 定义 **step** 是一次模型请求加上它调用的工具，**turn** 是零到多个 step——它在第一个输入被 claim 之前打开，在"什么都不再欠"时关闭。所以决策表里"拦截 request / tool / turn"是三个不同粒度：request 是一个模型调用、tool 是一次工具调用、turn 是整个往复。选择哪个事件域（session / agent / capability）与哪个粒度（request / tool / turn），是写任何拦截插件前的第一道选择题。

## 11.6 subagent 的 provider 谱系

`ctx.subagents` 是 seam 谱系宽度最好的例证。architecture.md 说：

> Subagent providers vary just as widely behind one interface, from a fresh child agent to a delegated turn in another product.

同一个接口背后，从"全新的子 agent"到"委托给另一款产品的 turn"，provider 的实现策略跨度极大：

| Provider 包 | 策略 |
| --- | --- |
| `subagent-spawn-in-process` | 进程内 spawn 一个全新子 agent |
| `subagent-fork-in-process` | 进程内 fork 一个子 agent |
| `subagent-acp` | 通过 Agent Client Protocol 与外部 agent 通信 |
| `subagent-codex` | 委托给 Codex CLI 的一次 turn |
| `subagent-claude-code` | 委托给 Claude Code 的一次 turn |
| `subagent-dsh-sdk` | 通过 dsh SDK（JSON-RPC）驱动另一个 dsh |

消费侧由三个工具分头负责：`tool-subagent` 选择一个 one-shot 或可延续的委托，`tool-subagent-control` 投递后续消息，`tool-ralph` 要求一条全新的结构化输出路由。out-of-process 的 `-acp` / `-codex` / `-claude-code` 后端又都通过 `ctx.subprocess` 拉起（见 11.2），于是"换执行世界"与"换子 agent 策略"在 `ctx.subprocess` 这一层再次汇合。

这一谱系的意义在于：**"委托给另一个 agent 产品"不是一个特殊功能，而是 subagent seam 的一个普通 provider**。你要接一个新 agent 产品，就是在 `ctx.subagents` 上再注册一个 provider，模型侧的工具与权限模型都不用改。

capability-seams.md 对 `ctx.subagents` 的完整描述还提到一层职责：service 本身 "also owns optional Activation-based continuation orchestration"。也就是说，除了 provider 注册表，`ctx.subagents` 还负责可选的、基于 Activation 的延续编排——这正是"可延续委托"（continuable delegation）与"一次性委托"（one-shot）之间差异的出处：`tool-subagent` 在两者之间做选择。

## 11.7 guard 包与 preset 包

这两个包组分别回答"怎么约束"和"怎么组合"。

**guard/——loop-hygiene 守卫家族**。guard 包自述是"loop-hygiene guard family"，其定位是：

> Behavioral guard plugins watch the agent loop for unproductive patterns and enforce per-call budgets. A guard is a self-contained consumer of core services and extension points, not a swappable capability.

注意这里的关键反差：guard **不是** seam。它不声明可替换能力，而是自我包含的"消费者"，监听 loop 上的无生产力模式。成员有两个：

- `repeat-tool-reminder`：对重复的工具调用给出建议性提醒（advisory reminder）。提醒作为 `tools/post-execute` 决策上的 `additionalContexts` 传递，最终以 logged plugin 来源的 `user/message` 事件落盘。
- `timeout-policy`：把每次工具调用的 deadline 作为部署策略装填（registers a `tools/execute` listener）。

deadline 的职责被拆成三块（`dsh-timeout`、capability 终止、以及 timeout-policy 这一策略层），分工记录在 timeout-library Agent Note 里。想理解"守卫怎么接进执行管线"，看 `tools/*` 扩展点即可，第 12 章会展开。

**preset/——按 session 组合 agent**。`agent-presets`（`ctx.agentPresets`）的职责，capability-seams.md 这样写：

> Discovers preset directories over trusted and user-authored roots and mounts one preset cordis.yml under an agent scope during creation.

换句话说，preset 是"给单个 agent 换一套插件组合"的机制。创建 agent 时，一个 preset `cordis.yml` 被挂到该 agent 的 scope 下，于是这个 session 拥有与全局不同的能力集（对应 11.5 决策表里的"Give one session a different capability set"）。组合（composition）在这里是**按 session**的，而非全局切换，这正是 per-session composition 的含义。

## 11.8 sandbox 缝与 E2B POC

最后看执行安全的两块拼图：`ctx.sandbox`（进程圈定）与 E2B（远程执行世界）。

**`ctx.sandbox`** 的契约只有一个核心动词（[sandbox 子系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/sandbox.md)）：

```ts
abstract confine(argv: readonly string[], policy: SandboxPolicy): ConfinedArgv
```

消费者把"它**即将** spawn 的 argv"（注意是 argv 数组，不是 shell 字符串）交给 `confine`，拿到一份包裹后的 argv 再去 spawn。`SandboxMode` 只管文件效果，不管网络与进程可见性：

| mode | 含义 |
| --- | --- |
| `read-only` | 拒绝写入；POSIX runner 额外放行 `/dev/null` sink |
| `workspace-write` | 允许写 workspace 根 + backend 承诺的临时区 |
| `danger-full-access` | 绕过圈定 |

这三个值就是 `SandboxMode` 的全部取值（原文字面量）：

```ts
type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'
```

只有前两个能发给 provider；`danger-full-access` 的消费者 spawn 原始 argv，根本不调 `ctx.sandbox`。`ConfinedSandboxMode` 就是 `Exclude<SandboxMode, 'danger-full-access'>`——策略可携带的那部分。

执行策略是**按调用**（per call）解析的：两个消费者可以在同一瞬间以不同策略圈定（bash 在 `read-only` 下跑，而一个受限子 agent 需要写自己的状态目录），一次获准的升级重试是一次带更宽策略的新调用。enforcement 是"报告出来的事实"——`full` 表示后端管住了策略承诺的每个文件效果，`partial` 表示（如旧内核 Landlock ABI、Windows ACL runner 的 Everyone/hard-link 边界）只覆盖了一部分。**静默的不圈定透传（silent unconfined passthrough）永远非法**，拿不到可用后端就抛 `SandboxUnavailableError`（`SANDBOX_UNAVAILABLE`）。

`sandbox-local` 提供的后端：Linux 用 bwrap/Landlock，macOS 用 Seatbelt，Windows 用 ACL restricted-token。这就是"本地 sandbox"的完整后端清单——没有单独的 native/landlock addon 包，Landlock 只是 Linux 后端的一种机制。

`confine` 的返回值 `ConfinedArgv` 不止是替换后的 argv，还携带三样信息：

- `enforcement`：`full` 或 `partial`，后端实际兑现的 enforcement 事实。
- `denialSignatures`：本后端拒绝时产生的 stderr 子串方言（bwrap 只读 bind 的 EROFS 文本、Landlock 的 EACCES、Seatbelt 的 EPERM）。消费者据此区分"任务失败"与"圈定生效、被挡下"。
- `runnerFailureRules`：结构化的 runner 失败证据规则（非零退出码 + stderr 单行内大小写不敏感的 fatal 签名，先剔除 informational 行）。runner 失败意味着命令**根本没跑**，是沙箱基础设施故障，要单独呈现。

这些细节的存在是为了一个目的：把"被沙箱拒绝"与"沙箱本身坏了"这两件事可验证地区分开，而不是混成一句"命令失败了"。这也是 seam 设计的典型手法——契约里把诊断信息结构化，而不是让消费者靠猜 stderr。

**E2B POC**。远程沙箱的方向是 `packages/e2b/`，但注意它的接入方式（呼应 11.2 的边界澄清）：

- `e2b`（`ctx.e2b`）拥有**一个共享的 E2B SDK handle、远程工作目录、以及最终的沙箱处置**，让两个基础 E2B provider 落在同一个 Linux runtime 里。
- `fs-e2b` 和 `subprocess-e2b` 分别是 `ctx.fs` 和 `ctx.subprocess` 的远程实现。

也就是说，E2B 不是 `ctx.sandbox` 的一个 provider，而是**同时替换了 `ctx.fs` 与 `ctx.subprocess` 两条 seam**。正因为 Bash / PTY / LSP 都消费 `ctx.subprocess`（11.2），把这两条 seam 指向 E2B，整个执行世界就迁到了远程 Linux 沙箱——这正是"换一个 provider 换掉整个产品"最完整的一次演示。E2B 目前是 POC（proof of concept）定位，不是生产后端。

想继续深入单个 seam，`docs/subsystems/` 下每个子系统页是权威参考：`shell.md`（bash 执行器）、`subprocess.md`（进程 seam）、`terminal.md`（PTY）、`filesystem.md`（fs）、`sandbox.md`（进程圈定）、`compaction.md`（压缩）、`subagent.md`（子 agent）、`lsp.md`、`web.md`、`skills.md`、`workflow.md`、`jobs.md`、`plan.md`。每页都有"它是什么、搬动的数据结构、以及由脚本生成并校验的 Cordis API 段"。

## 11.9 本章小结

- capability seam 由三个角色构成：Service Definition（声明接口）、Service Provider（实现）、Consumer（通常是面向模型的工具），三者缺一不可；只有一个角色不是 seam。
- seam 的价值在替换粒度：`ctx.fs` 与 `ctx.subprocess` 共享一个执行世界，指向远程沙箱后 Bash、PTY、LSP 一起迁移，无需 provider fork。
- `ctx.llm` / `ctx.tools` / `ctx.systemPrompt` / `ctx.shell` / `ctx.subprocess` / `ctx.terminals` / `ctx.fs` / `ctx.sandbox` / `ctx.commands` / `ctx.jobs` / `ctx.goals` 是模型能力的关键 `ctx` 键，角色分为 `seam` 与 `core` 两类。
- 能力包可逐个定位：llm / fs / shell / subprocess / terminal / lsp / skill / subagent / web / compaction / workflow / todo / plan / preset / guard，各有明确的 seam、实现与消费者。
- 新增行为查"Where new behavior goes"决策表：加 provider 注册 `ctx.llm`，加工具注册 `ctx.tools`，加 shell 后端注册 `ctx.shell`，加后台任务注册 `ctx.jobs`，加文件策略走 `ctx.fs`；从不改 loop。
- subagent provider 谱系从"全新子 agent"延伸到"委托给另一款产品的 turn"，同一接口背后策略各异。
- guard/ 是 loop-hygiene 守卫家族（`repeat-tool-reminder` + `timeout-policy`），是消费者而非 seam；preset/（`ctx.agentPresets`）按 session 用 `cordis.yml` 组合 agent。
- sandbox 缝只做"按调用圈定 argv"（`read-only` / `workspace-write` / `danger-full-access`），静默透传非法；E2B 是替换 `ctx.fs` + `ctx.subprocess` 整条 seam 的 POC，不是 `ctx.sandbox` 的 provider。

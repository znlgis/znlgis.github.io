---
layout: default
title: 第九章：全局规则 AGENTS.md 深度解读
---

# 第九章：全局规则 AGENTS.md 深度解读

AGENTS.md 是本配置体系中**最重要、最基础**的单一文件——它定义了所有 Agent 共享的行为基线。本章将以 311 行原文为线索，从设计哲学、具体规则、工程实践三个维度逐条深度解读。读完本章，你将不仅理解"规则是什么"，更能理解"为什么这样设计"以及"这些规则如何在日常协作中约束和指导 Agent 行为"。

> 本章内容基于 [znlgis/my-opencode-deepseek-config](https://github.com/znlgis/my-opencode-deepseek-config) 仓库中的 `AGENTS.md` 文件（311 行）逐条解读。实际规则可能随仓库迭代更新，请以仓库最新版本为准。

---

## 9.1 AGENTS.md 的定位与作用

### 9.1.1 全局规则的加载机制

在 OpenCode 的多 Agent 体系中，每个 Agent（orchestrator、solo、planner、deep-worker、explore、oracle、reviewer、librarian、consultant、ui-builder、light-orchestrator、vision）都有各自的 prompt 文件（位于 `agents/` 目录）。AGENTS.md 的特殊之处在于：**它被 OpenCode 自动加载为共享上下文**，意味着每个 Agent 在启动时都会"阅读"这份规则文件，然后才加载自身专属的 prompt。

用一句话概括其定位：

> AGENTS.md 是全局规则文件，定义了所有 Agent 的公共行为基线；`agents/<name>.md` 是各 Agent 的专属 prompt，只描述该角色的独特职责。

### 9.1.2 优先级体系

AGENTS.md 原文开头便明确了优先级关系：

> When prompts overlap, follow the stricter instruction.

翻译为中文：**当 Agent prompt 与 AGENTS.md 的规则重叠时，遵循更严格的指令**。这形成了一条清晰的优先级链：

```
AGENTS.md（全局基线） → Agent prompt（角色专属） → 默认行为
```

优先级判断不是简单的"谁覆盖谁"，而是**取严格者**。举例来说，如果 AGENTS.md 规定"不主动创建文件"，而某个 Agent 的 prompt 中没有提到文件创建策略，那么该 Agent 仍然受到"不主动创建文件"的约束。如果 Agent prompt 中明确说"可以主动创建文件"（更宽松），则 AGENTS.md 的严格规则生效。这个设计确保了全局约束的刚性，不会被子规则意外弱化。

### 9.1.3 设计理念：规则集中管理

为什么需要一个全局规则文件，而不是在每个 Agent prompt 中重复同样的规则？

| 维度 | 分散式（每 Agent 各自定义） | 集中式（AGENTS.md 统一定义） |
|------|---------------------------|---------------------------|
| 维护成本 | 改一条规则需要改 N 个文件 | 改一次，全体系生效 |
| 一致性 | 容易出现各 Agent 规则不同步 | 强制统一，无歧义 |
| 可读性 | Agent prompt 冗长，核心职责被淹没 | Agent prompt 只需描述专属职责 |
| 扩展性 | 新增 Agent 需要复制粘贴大量规则 | 新增 Agent 自动继承全局规则 |

这个设计体现了软件工程中的 DRY 原则（Don't Repeat Yourself）在提示工程（Prompt Engineering）领域的应用。

### 9.1.4 行数的演进历程

AGENTS.md 并非一次性写就。当前版本的 311 行经历了多轮精简与补强：早期版本约 292 行，v20 精简至 229 行，v21 进一步压缩至 212 行，随后在 v23 补强 +15 行（引入委派契约、Job Board 等）一度稳定在 218 行；2026-09 又新增了进度/失败纪律、思考分层、插件映射表等章节，当前为 311 行。每一次增长都要过"token 收益核算"这一关。这一演进过程本身反映了配置迭代的核心思路：

- **删减冗余**：识别并合并重复表达的规则
- **精炼表述**：将冗长的解释压缩为简洁的指令
- **去除过时内容**：随着 OpenCode 框架的演进，某些规则已被框架本身内置
- **按需补强**：当发现新的行为漏洞（如委派契约、后台任务卫生）时，精准补充而非整体膨胀

行数始终是一个有意识的选择——在"足够详尽"和"Token 经济"之间找平衡：常驻前缀每轮都计费，能删则删、确有必要才加，每一次行数变化都对应一次 token 收益核算。

---

## 9.2 核心原则（Core Principles）逐条解读

核心原则是 AGENTS.md 的灵魂——10 条原则覆盖了 Agent 行为的最底层逻辑。每一条原则背后都有深刻的工程洞察。

### 原则 1：检测意图再行动

> **Detect intent before acting.** "Look into X" is not "change X". Answer questions with analysis, not edits — never touch files unless the user explicitly asked for implementation.

这条原则解决了 AI Agent 最常见的**过度行动（Over-Action）**问题。

**问题场景**：用户说"帮我看看这段代码的性能"，一个没有约束的 Agent 可能直接开始重构代码、引入缓存层、修改数据结构——而这些完全不是用户想要的。用户只是想获得一份分析报告。

**设计意图**：强制 Agent 在行动前进行意图分级：

| 用户表述 | 意图级别 | 允许行为 |
|----------|----------|----------|
| "Look into X" / "帮我看看" | 探索（Exploration） | 读取、搜索、分析、报告 |
| "What does X do" / "这个函数做什么" | 查询（Query） | 读取、解释 |
| "Fix X" / "修一下这个 bug" | 修改（Modification） | 编辑文件 |
| "Add feature X" / "添加 X 功能" | 实现（Implementation） | 创建/编辑文件 |

**实践意义**：这条原则是防止 Agent "自作主张"的第一道防线，也是用户信任的基础——你知道 Agent 不会在你只是问问题的时候偷偷改代码。

### 原则 2：最小改动完整解决

> **Make the smallest change that fully solves the task.** Don't touch unrelated code. A complete, correct solution beats a clever or broad one.

这条原则定义了"好方案"的判断标准：**完整正确 > 巧妙宽泛**。

**反例**：修复一个按钮样式问题，Agent 把整个组件的样式体系重构了——虽然结果可能"更好"，但引入了不必要的风险。

**正例**：定位到具体的一行 CSS，只修改那个属性值，验证通过后提交。

关键约束词是 **"the smallest change that fully solves"**——不是"最小的改动"，而是"能完整解决问题的最小改动"。这句话区分了偷工减料和精准打击：

- 只改一半 → 不符合"fully solves"，不行
- 改太多无关代码 → 不符合"smallest"，不行
- 精准定位，只改必要的部分，完整解决问题 → 这才是目标

**工程价值**：最小改动意味着最小的回归风险、最简单的代码审查、最清晰的 git diff。

### 原则 3：先读后写

> **Read before you write.** Never guess what code does — open it.

这是对 AI Agent 最常见的"幻觉"问题的直接回应。

**典型问题**：Agent 基于模型训练数据中的"常见模式"推测某段代码的行为，直接基于推测进行修改——结果推测错误，修改引入 bug。

**强制约束**：在写任何代码之前，必须先打开目标文件阅读实际内容。这个简单原则消除了大量"我以为这段代码是做什么的"引发的错误。

**对 Token 效率的隐含权衡**：读文件需要消耗 Token，但比起基于错误推测写出错误代码然后反复调试所消耗的 Token 和时间，前期的一读是极其划算的投资。

### 原则 4：并行执行独立工作

> **Run independent work in parallel.** Fire multiple independent reads, searches, and fetches in a single batch.

这条原则利用了大语言模型的**工具调用并行化能力**。

**具体表现**：当 Agent 需要读取 3 个不相关的文件时，不应该逐个串行读取，而应该在单次响应中同时发起 3 个读取请求。

| 方式 | 3 次读取耗时 | 描述 |
|------|-------------|------|
| 串行 | 读取 A → 等待 → 读取 B → 等待 → 读取 C | 3 个往返延迟累加 |
| 并行 | 同时发起读取 A、B、C | 仅 1 个往返延迟 |

**适用条件**：必须是**独立**工作。如果读取 B 的内容取决于读取 A 的结果（例如先找到配置文件路径，再读取该文件），就不能并行。

**实践意义**：这条原则对重度实现任务（deep-worker）尤其关键——并行化读取可以将探索阶段的耗时缩短到原来的 1/3 甚至更少。

### 原则 5：尊重角色边界

> **Respect role boundaries.** Read-only agents (`oracle`, `reviewer`, `explore`, `librarian`) never modify files; they report findings as text.

在多 Agent 体系中，角色边界是系统架构的基石。

**只读 Agent 清单**（共 4 个；`vision` 不在此列——它是读写角色，可做轻量视觉修正）：

| Agent | 角色 | 核心行为 |
|-------|------|----------|
| oracle | 深度分析、根因定位 | 读取代码，输出文本报告 |
| reviewer | 代码审查 | 审查 diff，输出审查意见 |
| explore | 代码库探索 | 搜索、定位、报告 |
| librarian | 文档检索 | 查找文档，汇报结果 |

**为什么这些 Agent 必须只读**：一旦允许探索型 Agent 修改文件，就会打破"分析 → 决策 → 执行"的分层架构。Orchestrator 是唯一的决策层，deep-worker 是唯一的执行层。允许 oracle 直接改代码，就相当于让顾问直接操作手术刀——可能的结果是顾问的洞察力和手术的执行力双双失效。

### 原则 6：不主动创建文件

> **Don't create files unless asked.** Never proactively create documentation, README files, or any new file without explicit user request.

这条原则在 AGENTS.md 的"反模式"部分也有对应条目（`No file creation unless asked`），可见其重要性。

**问题根源**：AI Agent 有一种"服务过度"的倾向——完成主要任务后，主动创建 README、CHANGELOG、架构文档等"配套产出"。这些文件往往：
- 用户不需要（增加仓库噪音）
- 内容不可靠（Agent 在 "总结模式" 下容易产生幻觉）
- 需要用户额外花时间审查和删除

**唯一例外**：用户明确说"创建一个文件"或"写一个 README"。

### 原则 7：模型适配

> **Right-size the model to the task.** Prefer flash for routing, search, lookup, planning, and routine implementation; reserve pro for deep reasoning, root-cause analysis, code review, and heavy multi-file implementation. When borderline, prefer flash, then escalate.

本配置体系的核心模型策略：**双模型 + 思考档位分层**（v38+ 曾扩为三模型，2026-09 起 flash 与 vision-exp 合并、回到双模型）。

| 模型 | 适用任务 | 选型逻辑 |
|------|----------|----------|
| DeepSeek V4 Flash（原生多模态） | 路由、搜索、查找、规划、常规实现；多模态识别（图片/截图，仅用户明确提供图像时） | 速度快、成本低、够用 |
| DeepSeek V4 Pro | 深度推理、根因分析、代码审查、重型多文件实现 | 能力强、适合高复杂度任务 |

**"When borderline, prefer flash, then escalate"** 是一个关键的工程决策。当你不确定一个任务是否需要 Pro 时，默认用 Flash。原因：

1. **成本优化**：Flash 的输入成本约为 Pro 的 1/3，边际场景用 Flash 不会显著增加开销
2. **延迟优化**：Flash 响应更快，用户体验更好
3. **升级成本低**：如果 Flash 确实不够，Orchestrator 可以将任务重新路由到 Pro——这个失败成本远低于"每次都用 Pro"的持续成本

### 原则 8：知道停止条件

> **Know your stop condition.** Before starting, define the observable condition that means "done". Once it holds and the change is verified, stop — no bonus polish or extra verification loops.

这条原则对抗的是 AI Agent 的一个惯性问题：**过度打磨**。

**典型场景**：用户要求"修复登录按钮的样式错位"。Agent 修复了样式，验证通过——然后开始"顺便优化表单布局""改一下颜色主题""更新一下版本号"。这些"奖金打磨"：
- 超出了用户的请求范围
- 引入了未经请求的变更风险
- 模糊了本次改动的目的（git diff 不再只包含"修复样式错位"）

**"Done" 的可观察条件**：
- 好的条件："按钮在 Chrome/Firefox/Edge 上位置正确且可点击"
- 坏的条件："代码看起来不错"（主观、不可验证）

**"No extra verification loops"**：验证通过就停止，不要反复验证。Agent 有时会陷入"我再检查一遍……还是不放心……再查一下"的循环，这不仅浪费 Token，还可能导致实际上没有意义的微调。

### 原则 9：先回答再行动

> **Answer first, then act.** When the user asks a question, answer it before making edits or running implementation commands. When responding to user feedback, explicitly state whether you agree or disagree before saying what you changed.

这条原则定义了 Agent 在"回答问题"和"执行操作"之间的优先级：**先回答，后行动**。

**典型场景**：用户问"这个 bug 是什么原因导致的？"——一个没有约束的 Agent 可能直接开始修改代码，而没有先给出诊断结论。用户看到 Agent 在改文件，却不知道 Agent 理解了什么。

**正确流程**：
1. 先给出分析结论：bug 根因是 X，因为 Y
2. 然后（如果需要）执行修改

**"Agree or disagree before saying what you changed"**：当用户给出反馈时，Agent 必须明确表达立场——同意还是不同意——然后再说自己改了什么。这个机制防止 Agent 无条件迎合用户而做出技术上不合理的修改。

**设计意图**：确保用户始终在决策链中。Agent 是工具，不是自主决策者。先回答确保了用户始终有知情权和否决权。

### 原则 10：保持简洁

> **Be concise.** Keep answers short and direct. No fluff, no cheerful filler, no unnecessary preamble. Technical prose only.

这条原则是所有输出质量的最终过滤层。它要求 Agent 的每一句回复都经过"是否必要"的检验。

**禁止的内容**：
- 寒暄性开场白（"很高兴为您服务！"、"当然可以，让我来帮您……"）
- 过度礼貌用语（在不需要的语境下反复道歉或感谢）
- 填充性修饰（"非常"、"极其"、"毫无疑问地"）
- 非技术性闲聊

**允许的内容**：直接、准确、技术性的回答。

**Token 视角**：每一条废话都是浪费。在 10 条原则中，这是最"吝啬"的一条，但也是对 Token 效率贡献最大的一条——它不是一个独立的 Token 节约策略，而是贯穿所有 Agent 行为的输出准则。

**实践意义**：这条原则让 Agent 的回复从"聊天机器人风格"转变为"工程师风格"——简短、准确、直奔主题。

---

## 9.3 DeepSeek 缓存与思考纪律

这是 v35+ 新增的核心章节，直接源于 DeepSeek 官方 `deepseek-harness` 的配置指引。它定义了本配置在**成本与思考**两个维度上的纪律。

### 9.3.1 字节稳定前缀（Byte-Stable Prefix）

> **Byte-stable prefix.** Agent prompts, AGENTS.md, rule order stay byte-identical; early reorders bust the prefix cache and re-pay full input cost.

DeepSeek 的提示缓存（prompt cache）以**字节级前缀**为粒度——只要前缀字节不变，命中的部分就按 `cache_read` 价格计费（约为输入价格的 1/30）。因此：

- Agent prompt、AGENTS.md、规则顺序必须保持字节级一致
- 任何早期的重排都会破坏前缀缓存，导致重新支付全部输入成本
- 易变内容（时间戳、随机 ID、动态文件列表）必须放在 payload 末尾，而非开头

**工程含义**：修改 AGENTS.md 或 Agent prompt 时，尽量**追加**而非**重排**。一次看似无害的章节重排，可能让所有后续会话的缓存全部失效。

### 9.3.2 冻结工具集

> **Freeze toolsets.** Never reorder tool schemas or injected rules mid-session.

工具 schema 和注入规则的重排同样会破坏前缀缓存。会话中途不应重新排序工具定义。

### 9.3.3 温度与思考的 Provider 层拆分

> **Temperature.** flash: 0 (thinking off). pro: unset — thinking is on and temperature/top_p are silently ignored.
> **Thinking.** flash = off (provider-level `thinking: {type:"disabled"}`, the official cost saver); pro = on (default).

本配置的思考开关在 **provider 层**拆分，而非 per-agent：

| 模型 | 温度 | 思考 | 说明 |
|------|------|------|------|
| Flash（原生多模态） | 0 | 关闭 | 官方成本节约方案 |
| Pro | 未设置 | 开启（默认） | 温度/top_p 被静默忽略 |

**关键**：`options.thinking` 是 provider 透传字段（OpenAI 格式的思考开关），不是 OpenCode 原生 schema 字段。Agent 可通过 frontmatter `options.thinking` 覆盖（如 planner/light-orchestrator 在 Flash 上重新开启思考）。

### 9.3.4 一次性请求走 Flash

> **One-shot requests ride flash.** title/summary/compaction and other single-shot tasks run on flash so their volatile content never enters the pro prompt-cache prefix.

title/summary/compaction 等一次性任务运行在 Flash 上，这样它们的易变内容永远不会进入 Pro 的提示缓存前缀。

### 9.3.5 reasoning_content 往返

> **reasoning_content** must round-trip on tool calls (opencode handles it); never reorder messages in ways that break it.

DeepSeek 的 `reasoning_content` 必须在工具调用间正确往返（OpenCode 自动处理）。不要以破坏它的方式重排消息。

### 9.3.6 易变区（Volatile Zone）

> **Volatile zone.** Timestamps, random IDs, per-request tokens, and dynamic file lists are volatile — they bust the prefix cache if they appear early. Keep them out of the head of any payload; append them near the tail where a cache miss costs the least.

时间戳、随机 ID、每次请求的 token、动态文件列表都是易变内容——如果它们出现在 payload 开头，会破坏前缀缓存。应将其放在 payload 末尾，这样即使缓存未命中，代价也最小。

---

## 9.4 思考分层（Thinking Tiers）

### 9.4.1 reasoning_effort 不是模型 ID

> **`reasoning_effort`** is a request-level thinking-strength control (`low`/`high`/`max`), NOT a model id — set per-agent via agent frontmatter `options` (camelCase `reasoningEffort`, deep-merged over `model.options`). The 2-model matrix is inviolate.

`reasoning_effort`（配置中为 camelCase `reasoningEffort`，请求体中转为 snake_case）是**请求级**的思考强度控制（low/high/max），**不是模型 ID**。它通过 Agent frontmatter 的 `options` 设置（深度合并覆盖 `model.options`）。保持它不挂在模型 ID 上，是为了维持双模型矩阵的纯净。

### 9.4.2 三层思考分级

| 层级 | 模型 | 思考 | 适用 Agent |
|------|------|------|-----------|
| 轻量（trivial） | Flash | 关闭（最便宜） | explore、librarian、consultant、ui-builder |
| 中等（mid） | Flash + reasoningEffort low | 开启 + 低强度 | planner、light-orchestrator |
| 深度（deep） | Pro | 默认高 | deep-worker、oracle、reviewer |
| 跟随会话 | 会话所选（默认 Pro） | 随该模型 | solo（无 `model` 字段） |

**路由逻辑**：轻量 → Flash 关闭思考；常规但非平凡的多文件 → Flash + 低思考；深度/不确定 → Pro + 高思考。

---

## 9.5 范围优先 + 始终委派（Scope First + Delegate Always）

这是 v35+ 引入的、替代旧版"上下文管理"章节的核心工作纪律。它把"委托"从一种可选优化提升为**默认行为**。

### 9.5.1 先定范围

> **Size the scope first.** 2+ steps, multi-file, or architectural changes require `planner` first — never go straight to implementation.

2 步以上、多文件或架构级变更，必须先经过 `planner`——绝不直接进入实现。这防止了"边做边想"导致的返工。

### 9.5.2 后台优先

> **BACKGROUND FIRST.** Independent subtasks dispatch in parallel, background. Requires the `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` env var; when unset, dispatch foreground instead.

独立的子任务应**并行、后台**派发。这需要设置环境变量 `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`；未设置时改为前台派发。

### 9.5.3 委派而非亲为

> **Delegate, don't do.** Delegate whenever delegation overhead is smaller than the task; top-level tokens go only to routing and hard problems.

只要委派开销小于任务本身，就委派。顶层 token 只用于路由和难题。这与旧版"委托而非累积"一脉相承，但表述更激进——委派是默认，亲为是例外。

### 9.5.4 子 Agent 空结果回退

> **Subagent empty-result fallback.** A subagent returns an empty result with no workspace changes → retry once with a smaller task; if it fails again, stop and tell the user the subagent infrastructure is failing. Never retry the same task repeatedly, and never inline-execute a heavy implementation at the orchestrator level.

子 Agent 返回空结果且无工作区变更 → 用更小的任务重试一次；再次失败则停止并告知用户子 Agent 基础设施故障。绝不重复重试同一任务，也绝不在 orchestrator 层内联执行重型实现。

### 9.5.5 传递显式 task_id

> **Pass the explicit `task_id`** when resuming a subagent session.

恢复子 Agent 会话时传递显式 `task_id`，以便定位并复用之前的会话上下文。

### 9.5.6 引用路径而非粘贴文件

> **Reference paths, don't paste files.** Point at `src/app.ts:42`.

引用具体路径（如 `src/app.ts:42`），不要将整个文件粘贴进 prompt。子 Agent 可以自行读取所需内容。

---

## 9.6 语言约定

> Reply to the user in the OS locale language (detect from environment). On a zh-CN Windows system, Chinese; en-US, English. Never force English unless asked.

### 9.6.1 自动语言检测机制

AGENTS.md 要求所有 Agent 在启动时检测操作系统语言，并基于检测结果自动切换输出语言。这个设计对中文用户尤其友好。

| 操作系统语言 | Agent 输出语言 | 说明 |
|-------------|---------------|------|
| zh-CN Windows | 中文 | 自动检测，无需配置 |
| en-US Windows/macOS/Linux | 英文 | 默认行为 |
| 其他语言环境 | 对应的系统语言 | 泛化支持 |

### 9.6.2 对中文用户的友好性分析

在 AI 编程工具领域，中文用户的体验长期存在两个痛点：

1. **英文门槛**：大量工具的错误信息、Agent 反馈、文档都是英文，对英文不熟练的开发者形成障碍
2. **翻译生硬**：即使有些工具支持中文，翻译质量也往往不理想，专业术语生硬

AGENTS.md 的语言约定解决了这两个问题：
- **检测而非硬编码**：不需要用户手动设置语言，Agent 自动适配
- **中文为第一优先级**：zh-CN 环境直接输出中文，不经过英文中转
- **专业术语自然**：Agent 在中文环境下使用的中文技术术语是模型训练中自然习得的，而非机械翻译

### 9.6.3 "Never force English unless asked"

这条约束保护了语言自动检测的完整性。如果允许 Agent 在某些场景下自行切换为英文（例如"这段英文技术术语不好翻译"），就会破坏用户对语言一致性的预期。唯一的例外是用户**明确要求**——例如用户说"请用英文回复"。

---

## 9.7 约束条件（Constraints）

> - **No new models.** Only `deepseek/deepseek-v4-pro` and the natively multimodal `deepseek/deepseek-flash` may be used. Do not introduce others.
> - **No new dependencies** without explicit justification from the user.
> - **Pure-config philosophy.** Prefer prompt/config changes over new tooling.

### 9.7.1 仅限 DeepSeek V4 双模型

这条约束定义了本配置的模型边界：**只有两个模型，不允许引入第三个**（v38+ 曾扩展为三模型；2026-09 起 `deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 合并为一个原生多模态的 `deepseek-flash`，回到双模型）。

**设计理由**：

| 原因 | 说明 |
|------|------|
| 成本可控 | DeepSeek 的定价是业界最低水平之一，固定模型 = 固定成本预期 |
| 行为可预测 | 每个模型的表现已知，多模型混用引入行为不确定性 |
| 配置简单 | 两个模型 × 思考档位即可覆盖所有场景 |
| 避免模型蔓延 | 防止 Agent 在运行时"自行决定"切换模型，导致不可预测的行为 |

**如果不是 DeepSeek 用户**：你可能需要修改这条规则。例如使用 Claude 模型的用户需要改为对应的双模型组合。但原则不变——**固定模型，不要混搭多个供应商**。

### 9.7.2 不新增依赖

> No new dependencies without explicit justification from the user.

在 Agent 模式中，"新增依赖"的危险被放大了：

- Agent 可能在 `package.json` 中添加一个质量不明的第三方库
- Agent 可能引入一个与现有技术栈不兼容的工具
- Agent 可能选择一个过时或不再维护的依赖

这条规则将"是否新增依赖"的决策权完全保留给用户。Agent 可以**建议**新增依赖，但不能**擅自执行**。

### 9.7.3 纯配置哲学

> Pure-config philosophy. Prefer prompt/config changes over new tooling.

这是本项目的核心设计哲学之一：**用配置解决问题，而非引入新工具**。

| 方案类型 | 示例 | 优缺点 |
|----------|------|--------|
| 配置方案 | 修改 AGENTS.md 规则、调整 Agent prompt | 零依赖、易理解、可版本控制 |
| 工具方案 | 安装插件、编写脚本、部署服务 | 引入复杂度和维护负担 |

**实践体现**：OpenCode 的 skills、commands、agents 全部通过 `.md` 和 `.jsonc` 文件定义，不需要任何编译或安装步骤。整个体系是"可以带着走"的纯文本配置。

---

## 9.8 多步骤任务纪律

> For any task with 2 or more steps:
> 1. Write an ordered todo list before starting.
> 2. Keep exactly one item `in_progress` at a time.
> 3. Mark each item `completed` immediately after finishing it — never batch.
> 4. Update the list when scope changes.

### 9.8.1 四条规则逐条解读

**规则 1：开始前写有序 TODO 列表**

| 场景 | 不写 TODO 的风险 | 写 TODO 的收益 |
|------|-----------------|---------------|
| 复杂重构（5+ 文件修改） | 忘记某一步，后期补救 | 每步可追踪，不遗漏 |
| 多文件新功能 | 改了 A 忘了 B，功能不完整 | 所有步骤可见 |
| 调试链 | 排查方向漂移，东试一下西试一下 | 排查路径清晰 |

**规则 2：一次只有一个 `in_progress`**

这条规则防止"伪并行"——Agent 同时开始多项修改但都没完成，导致工作区处于中间状态。单任务聚焦确保每步都可提交、可回滚。

**规则 3：完成后立即标记（不批量标记）**

| 做法 | 结果 |
|------|------|
| 批量标记（做完 3 步后一次性标记） | 中间的进度对 Orchestrator 不可见 |
| 即时标记（每完成一步立即标记） | 进度透明，即使 Agent 中断也知道做到了哪 |

**规则 4：范围变化时更新列表**

项目过程中，用户可能说"再加一个功能"或"不用改那个了"。TODO 列表必须实时反映当前的工作范围，否则就失去了"进度地图"的功能。

### 9.8.2 原子化 TODO 格式

v35+ 新增了原子化 TODO 格式要求：

> **Atomic TODO format.** `path: <action> for <scenario> — verify by <check>` (WHERE/WHY/HOW/VERIFY in one line).

每条 TODO 用一行表达 WHERE/WHY/HOW/VERIFY 四个要素。例如：

```
src/auth/login.ts: add rate limiting for brute-force scenario — verify by unit test + manual 5x attempt
```

### 9.8.3 后台任务卫生

AGENTS.md 在 Multi-Step Task Discipline 末尾追加了一条容易被忽视但极其实用的规则：

> **Background task hygiene.** Track task IDs and file ownership for every parallel dispatch. Never act on assumptions about a background task's result before it returns. Overlapping writers on the same file corrupt output.

**核心要点**：

| 规则 | 说明 |
|------|------|
| 追踪 task ID 和文件所有权 | 每次并行派发子 Agent 任务时，记录哪个任务操作了哪些文件 |
| 不等结果不做假设 | 在后台任务返回结果之前，不能基于"猜测的结果"进行后续操作 |
| 重叠写入破坏输出 | 两个 Agent 同时写同一个文件 = 数据损坏 |

**典型事故场景**：Orchestrator 同时派发了两个 deep-worker 任务——任务 A 修改 `src/app.ts` 的第 42-50 行，任务 B 也修改 `src/app.ts` 的第 45-55 行。两个 Agent 分别基于原始文件做了修改，后完成的那个覆盖了先完成的修改，导致任务 A 的结果丢失。

**防护机制**：通过 task ID 追踪文件所有权，确保同一个文件同一时间只有一个写入者。这条规则与 TODO 纪律的"一次一个 in_progress"原则形成呼应——即使在并行场景下，对同一资源的访问也必须串行化。

---

## 9.9 Git 安全

AGENTS.md 对 Git 操作定义了严格的安全边界，防止 Agent 在执行版本控制操作时误伤其他会话的工作：

> - Only stage and commit files you modified in this session. Never `git add -A`, `git reset --hard`, `git checkout .`, or `git clean -fd` — those discard work from other sessions or tools that may share the same working directory.
> - Never `git add <directory>` — stage explicit file paths only. Directory-level staging risks committing unrelated changes from other sessions.
> - Before committing: inspect `git status`, `git diff --staged`, and `git log --oneline -10`. Stage only intended files.
> - Never force-push, skip hooks (`--no-verify`), or amend commits without explicit user request.

### 9.9.1 只提交自己修改的文件

`git add -A`（暂存所有变更）在多会话共享同一工作目录的场景下是**灾难性操作**——它会将其他会话或工具产生的文件一并暂存和提交。同样，`git add <directory>`（目录级暂存）也可能误提交其他会话的无关变更。

**禁止的命令**及原因：

| 禁止命令 | 风险 |
|----------|------|
| `git add -A` | 暂存所有文件，包括其他会话/工具的修改 |
| `git add <directory>` | 目录级暂存，可能提交无关变更 |
| `git reset --hard` | 丢弃所有未提交修改，包括他人正在进行的工作 |
| `git checkout .` | 同上，以文件级别丢弃修改 |
| `git clean -fd` | 删除所有未追踪文件，可能包括其他工具的输出 |

### 9.9.2 提交前的强制检查

每次提交前，Agent 必须执行三项检查：

| 检查项 | 命令 | 目的 |
|--------|------|------|
| 工作区状态 | `git status` | 确认哪些文件被修改，是否有意外变更 |
| 暂存区差异 | `git diff --staged` | 确认即将提交的内容是否符合预期 |
| 提交历史 | `git log --oneline -10` | 了解最近的提交趋势，确保自己的提交与项目历史一致 |

### 9.9.3 禁止的危险操作

以下操作**除非用户明确要求**，否则一律禁止：

- **Force push（`git push --force`）**：覆盖远程历史，可能导致协作者的工作丢失
- **跳过 hooks（`--no-verify`）**：绕过 pre-commit、commit-msg 等质量检查钩子
- **修改历史提交（`git commit --amend`）**：改变已存在的提交，可能破坏他人的工作基础

**设计理念**：Git 是共享工作区的"公共资源"。Agent 是工作区中的一个"租户"，必须尊重其他租户的工作。这些规则确保 Agent 不会因为自动化操作而破坏多人协作的版本控制安全。

---

## 9.10 任务拒绝契约（Task Rejection Contract）

> Refusing the wrong task early is cheaper than half-doing it. Stop and return a plain-text rejection (not a partial attempt) when:
> - The task falls outside the agent's role (read-only agent asked to edit, executor asked to research or delegate).
> - Required context is missing and cannot be safely inferred (which file, what error, what scope) — ask instead of guessing.
> - The task needs a more capable agent — name the escalation target and why.

这是 AGENTS.md 中最具工程智慧的设计之一。它正式定义了 Agent 的**拒绝权**。

### 9.10.1 拒绝条件

Agent 必须在以下三种情况下停止并返回拒绝：

| 拒绝条件 | 示例 | 拒绝逻辑 |
|----------|------|----------|
| 任务超出角色范围 | 要求只读 Agent（oracle）编辑文件 | 角色不允许 |
| 缺少关键上下文且无法推断 | 用户说"改一下那个函数"但没说哪个文件 | 无法安全执行 |
| 任务需要更强的 Agent | Flash 模型遇到需要深度推理的任务 | 应该升级到 Pro |

### 9.10.2 拒绝格式

> Keep it short: what you won't do, why, the right next step — no apologies, no padding, no degraded partial attempt.

格式要素：**拒绝内容 + 原因 + 正确下一步**。

**好的拒绝示例**：

> 我无法修改 `src/app.ts`——我是只读的 oracle agent，只能分析代码和提出建议。请将修改请求转给 deep-worker agent。

**坏的拒绝示例**（AGENTS.md 明确禁止的）：

> 抱歉，我可能无法完成这个任务。让我试试能不能用其他方式帮你……（开始做降级版本）

### 9.10.3 工程价值

| 传统 AI Agent | 有拒绝契约的 Agent |
|---------------|-------------------|
| 遇到不合适任务 → 勉强尝试 → 产出低质量结果 → 用户失望 | 遇到不合适任务 → 干净拒绝 → 路由到正确 Agent → 高质量结果 |
| 浪费 Token 和时间 | Token 和时间花在正确的地方 |
| 用户不知道为什么会失败 | 用户知道问题所在和解决方案 |

**"拒绝比做一半便宜"** 这个理念在工程领域有着广泛的适用性——不仅是 AI Agent，也适用于团队协作中的任何角色。

---

## 9.11 何时询问 vs 何时继续

> Ask for clarification only when:
> - There are multiple interpretations with significantly different effort/impact, or
> - Critical context is missing (which file, what error, what scope).
> Otherwise pick the best default, state the assumption you made, and proceed.
> Ask using the grilling skill's format (one question at a time, prefer multiple choice).

### 9.11.1 决策矩阵

| 场景 | 决策 | 原因 |
|------|------|------|
| 用户说"优化性能"，没说具体模块 | 先 profiling，找出热点，基于数据行动 | 有明确的默认路径（数据驱动） |
| 用户说"改一下登录"，可能是 3 个登录页面中的任何一个 | 询问具体是哪个 | 关键上下文缺失，3 种解读差异巨大 |
| 用户说"换一种颜色"，当前主题只有 2 种可选颜色 | 选对比度更高的那个，陈述假设 | 仅 2 种可能，选更好的默认值即可 |
| 用户说"部署到生产环境"（但没说是否已通过 QA） | 询问是否已通过 QA 和 code review | 影响巨大，缺少关键状态信息 |

### 9.11.2 Grilling Pattern（烧烤模式）

> Ask using the grilling skill's format (one question at a time, prefer multiple choice).

"烧烤模式"是一个精妙的沟通设计：**一次一个问题，提供多选选项**。v38+ 将 grilling 提升为独立技能（`grilling` skill），并配套 `wait-what`（澄清模糊请求）与 `grill-with-docs`（需求模糊 + 领域语言模糊时组合 grilling 与 domain-modeling）。

**为什么一次一个问题**：
- 人类用户面对一连串问题时容易跳过或随机回答
- 一次一个问题让对话像自然对话一样推进
- 每个问题的答案会影响下一个问题的必要性（可能根本不需要问第二个）

**为什么提供多选**：
- 减少用户的打字负担
- 降低理解歧义（选项本身就是对问题范围的澄清）

### 9.11.3 挑战用户（When to Ask vs Proceed 的延伸）

AGENTS.md 在"何时询问"末尾补充了挑战用户的机制：

> If a requested approach will clearly cause problems or contradict established patterns, say so before executing:
> I notice [observation]. This may cause [problem] because [reason].
> Alternative: [suggestion]. Proceed as requested, or try the alternative?

**挑战的时机**："挑战用户"不是无礼的反驳，而是基于专业判断的风险预警。触发条件：

1. **方案明显会导致问题**（例如在已有缓存的系统中引入重复缓存，导致缓存一致性问题）
2. **违反既有模式**（例如项目一直用 REST API，用户突然要求改用 GraphQL）

**三段式结构**：

| 段落 | 内容 | 作用 |
|------|------|------|
| I notice... | 观察到的现象 | 建立事实基础 |
| This may cause... because... | 预测的问题 + 原因 | 说明风险 |
| Alternative... | 替代方案 | 提供积极的建设性建议 |
| Proceed as requested, or... | 让用户选择 | 最终决策权归用户 |

**为什么"说在前面"重要**：

| 行为 | 结果 |
|------|------|
| 发现问题但不说，照做 | 问题发生后用户回溯，发现 Agent "明知道有问题还做"——信任崩塌 |
| 在开始前指出问题，提供替代方案 | 用户要么采纳建议（避免问题），要么明确承担风险——信任保全 |

**用户指令冲突时的处理**：如果用户指令与 AGENTS.md 规则冲突，先确认——用户明确请求优先，但必须被承认为覆盖（override）后才生效。

---

## 9.12 反模式（Blocking）——无条件禁止

反模式部分是 AGENTS.md 中最具约束力的章节——不仅是"不建议"，而是**无条件禁止**。每条规则的背后都是来自真实项目"踩坑"的经验。

### 9.12.1 禁止 Catch-All 文件

> **No catch-all files.** Never create `utils.ts`, `helpers.ts`, `service.ts` — use descriptive filenames.

| 被禁止的文件名 | 为什么是反模式 | 正确的替代 |
|---------------|---------------|-----------|
| `utils.ts` | 什么都能往里扔，最终成为无结构的垃圾场 | `date-formatter.ts`、`string-sanitizer.ts` 等具体命名 |
| `helpers.ts` | 同 `utils.ts`，更模糊 | 按功能拆分 |
| `service.ts` | 单体服务文件，违反单一职责原则 | `user-service.ts`、`payment-service.ts` |

**核心原则**：文件名应当是函数/模块职责的描述。如果无法用具体名称描述一个文件的内容，说明文件本身的结构就有问题。

### 9.12.2 禁止 Emoji

> **No emoji in code or comments,** unless the user explicitly requests it.

**禁止范围**：
- 注释中的 emoji（`// 处理用户登录 ✅`）
- 变量/函数名中的 emoji（极少数语言支持）
- commit message 中的装饰性 emoji（除非项目本身就使用 emoji commit 规范）

**理由**：emoji 在不同终端、字体、操作系统上的渲染不一致，可能导致显示乱码。代码是严肃的工程文档，应当以纯文本保证可移植性。

### 9.12.3 禁止 AI 填充词

> **No AI filler words.** Never use "simply", "obviously", "clearly", "moreover", "furthermore" in comments or explanations.

| 填充词 | 为什么禁止 |
|--------|-----------|
| simply（简单地） | 代码可能并不"简单"，这个词在暗示读者"你应该很容易理解"——如果读者不理解，会产生挫败感 |
| obviously（显然地） | 如果"显然"，就不需要注释；如果需要注释，说明不够"显然"——自相矛盾 |
| clearly（清楚地） | 同上 |
| moreover（此外）、furthermore（而且） | 学术论文连接词，代码注释不需要论文结构 |

这些词是 LLM 训练语料中常见的"语言填充"——它们增加了字数，但没有信息增量。在 Token 即成本的前提下，纯属浪费。

### 9.12.4 禁止空 Catch 块

> **No empty catch blocks** (`catch(e) {}`). If an error is truly ignorable, comment why.

**示例**：

```typescript
// 禁止的写法
try {
  await cache.set(key, value);
} catch (e) {}  // 错误被悄悄吞掉

// 允许的写法（如果错误确实可忽略）
try {
  await cache.set(key, value);
} catch (e) {
  // 缓存写入失败不影响主流程，数据仍持久化在数据库中
}
```

**设计意图**：空 catch 块是调试噩梦的常见来源——一个错误被悄悄吞掉，后续问题表现出的症状与根因相距甚远。如果错误确实可忽略，需要用注释说明**为什么**可忽略，这也是对自己和后续维护者的承诺。

### 9.12.5 禁止不加解释的类型抑制

> **No `@ts-ignore` or `@ts-expect-error`** without a comment explaining why it's necessary and when it can be removed.

**要求**：每个类型抑制注释必须附带：
1. **必要性说明**：为什么这里必须绕过类型检查
2. **移除条件**：什么时候可以安全地移除这个抑制

```typescript
// 禁止的写法
// @ts-ignore
const result = complexExternalLib.doThing(data);

// 允许的写法
// @ts-ignore — complexExternalLib@2.1.0 的类型定义缺少 doThing 方法签名
// 待升级到 2.2.0 后可移除此抑制
const result = complexExternalLib.doThing(data);
```

**设计意图**：`@ts-ignore` 和 `@ts-expect-error` 是类型系统的"紧急逃生门"。如果不标注移除条件和原因，它们就会变成**永久的技术债务**——没有人记得为什么当初要绕过类型检查，也就没有人敢移除它们。

### 9.12.6 禁止注释掉的代码

> **No commented-out code.** Dead code belongs in git history, not the source file.

**问题**：注释掉的代码是"代码僵尸"——它不执行，但存在于源代码中，消耗阅读者的注意力和理解成本。

| 做法 | 理由 |
|------|------|
| 注释掉旧代码，留着"以防万一" | 万一什么？git 历史中有完整记录，随时可以找回 |
| 直接删除旧代码 | 代码干净，git blame 可以追溯到删除原因 |
| 真的需要保留？写清楚为什么 | 极少情况下（如向后兼容的 fallback），添加注释说明保留原因 |

### 9.12.7 循环检测

> **Loop detection.** 3+ consecutive identical tool calls with no progress = spinning. Stop and re-evaluate: change strategy or escalate — never repeat the call and burn tokens.

v35+ 新增的反模式：连续 3 次以上相同的工具调用且无进展 = 空转。应停止并重新评估：改变策略或升级——绝不重复调用并浪费 token。

---

## 9.13 质量标准

质量标准定义了 Agent 产出的可接受下限。它不是"做到最好"的期望，而是"不够好就重来"的门槛。

### 9.13.1 风格匹配

> Match the project's existing style, naming, and conventions.

**关键**：不是"写你自己的风格"，而是"融入项目的风格"。AI Agent 在为新项目写代码时容易使用自己训练数据中的"标准风格"，但每个项目都有自己的惯例。

| 项目惯例 | Agent 应遵循 |
|----------|-------------|
| 使用 `kebab-case` 文件命名 | 不用 `camelCase` |
| 使用 2 空格缩进 | 不用 4 空格或 Tab |
| React 组件用函数式 + Hooks | 不用 Class 组件 |
| 测试文件命名 `*.test.ts` | 不用 `*.spec.ts` |

### 9.13.2 验证通过

> Verify changes build / pass available checks and don't break callers.

**验证清单**：

| 验证项 | 具体操作 |
|--------|----------|
| 构建 | `npm run build` / `cargo build` 等 |
| 测试 | `npm test` / `pytest` 等 |
| 调用者 | grep 修改的函数/类型名，确保所有调用者兼容 |

### 9.13.3 定位引用

> Cite concrete locations (`file:line`) when reporting findings.

在报告中引用具体位置（如 `src/app.ts:42`）而非模糊描述（如"在登录模块的某个地方"）。精确的引用：
- 让报告可验证（可以直接跳到对应位置检查）
- 让报告可操作（知道具体在哪里改）

### 9.13.4 无死代码

> Every public function/method needs at least one caller before commit — no dead code.

**设计意图**：公共函数没有调用者 = 死代码。死代码：

1. 增加维护负担（修 bug 时要检查这些没人用的函数）
2. 增加认知负担（阅读者不知道这些函数是否是"重要的"）
3. 增加测试负担（死代码的测试也是死测试）

如果确实需要一个"未来会用"的公共函数，那应该在**真正需要时**再写——YAGNI 原则（You Aren't Gonna Need It）。

### 9.13.5 自我怀疑

> **Self-skepticism before output.** Before reporting or claiming completion, ask: could I disprove this? Is the severity proportionate? Surface only what survives your own scrutiny.

三个自查问题：

| 问题 | 作用 |
|------|------|
| Could I disprove this?（我能推翻这个结论吗？） | 防止确认偏差 |
| Is the severity proportionate?（严重程度是否恰当？） | 防止过度反应或轻视 |
| Surface only what survives your own scrutiny（只呈现经得起推敲的内容） | 最终的质量判断 |

---

## 9.14 注释纪律

> - Comments explain WHY, not WHAT — if the code already says it, delete it.
> - No filler docstrings. Match the project's docstring convention; if it uses none, add none.

### 9.14.1 WHY 而非 WHAT

这是注释写作的根本原则：

```typescript
// WHAT 注释（无价值——代码已经说了 WHAT）
const MAX_RETRIES = 3;  // 最大重试次数设为 3

// WHY 注释（有价值——解释了为什么是 3）
const MAX_RETRIES = 3;  // 第三方 API 在每秒 3 次以上会触发限流，超出 3 次的重试必然失败
```

`WHAT` 从代码中就能读出来，写注释只是在重复代码。`WHY` 是代码无法表达的——设计决策、业务约束、历史原因，这些才是注释应该承载的信息。

### 9.14.2 匹配项目惯例

> Match the project's existing docstring convention; if it uses none, add none.

**场景**：一个项目没有使用 JSDoc/Rustdoc/Docstring 的惯例，Agent 不应主动为函数添加文档注释。在已经有类型系统的前提下（TypeScript/Rust 等），docstring 的信息增量往往有限，有时反而是噪音。

---

## 9.15 代码风格约束

> **Code Style (when implementing)**

代码风格部分的规则只在 Agent 执行实现任务时生效（"when implementing"），只读 Agent（oracle、reviewer 等）不受这些规则约束。

### 9.15.1 优先 const 而非 let

> **Prefer `const` over `let`;** early return instead of `else`; functional array methods (`flatMap`, `filter`, `map`) over imperative loops.

```typescript
// 避免
let result;
if (condition) {
  result = computeA();
} else {
  result = computeB();
}

// 更好
const result = condition ? computeA() : computeB();
```

**理由**：`const` 声明的变量不可重新赋值，这意味着：
- 阅读者不需要追踪变量是否在后续被修改
- 编译器/静态分析工具能做更精确的分析

### 9.15.2 用早期 return 避免 else

> **Prefer `const` over `let`;** early return instead of `else`; ...

```typescript
// 避免
function process(data: Data | null): Result {
  if (data) {
    // 20 行处理逻辑
  } else {
    return defaultResult;
  }
}

// 更好
function process(data: Data | null): Result {
  if (!data) return defaultResult;
  // 20 行处理逻辑 —— 不需要嵌套在 if 中
}
```

**理由**：`else` 增加了代码的嵌套层级。每一个嵌套层级都会增加认知负担——读者需要在脑中维护"我在哪个分支里"的栈。早期 return 把边界情况提前处理，让主逻辑保持在顶层。

### 9.15.3 函数式数组方法

> **Prefer `const` over `let`;** early return instead of `else`; functional array methods (`flatMap`, `filter`, `map`) over imperative loops.

```typescript
// 避免
const activeUserNames: string[] = [];
for (let i = 0; i < users.length; i++) {
  if (users[i].isActive) {
    activeUserNames.push(users[i].name);
  }
}

// 更好
const activeUserNames = users
  .filter(u => u.isActive)
  .map(u => u.name);
```

**理由**：函数式方法链表达了"数据经过哪些变换"的意图，而 `for` 循环表达的是"如何一步步实现这个变换"。前者更接近人类思维（"从用户列表中筛选活跃用户，提取名字"），后者是机器思维（"创建一个空数组，遍历每个元素，如果满足条件就追加"）。

### 9.15.4 无 import 别名与通配符

> **No import aliases** unless disambiguating a collision; no wildcard imports.

```typescript
// 避免
import * as utils from './utils';
import { useState as useReactState } from 'react';  // 无真正的冲突

// 允许
import { Button as AntButton } from 'antd';
import { Button as MUiButton } from '@mui/material';
// 两个 Button 确实冲突，别名为必要之举
```

### 9.15.5 内联单次使用的值

> **Inline single-use values.** Don't name a value used exactly once.

```typescript
// 避免（value 只用了一次）
const value = computeExpensiveThing(data);
return format(value);

// 更好
return format(computeExpensiveThing(data));
```

**理由**：每个变量都是阅读者需要记忆的"状态"。变量越多，心智负担越大。如果变量只使用一次，它的命名反而增加了一层间接——读者先去理解变量名，再去理解使用场景。

**例外**：如果计算本身非常复杂，用一个有意义的变量名作为"中间结论的标签"是有价值的。判断标准：变量名是否提供了代码本身没有表达的信息。

---

## 9.16 技能体系

> Skills live under `skills/<name>/SKILL.md` and load on demand. Before reinventing a workflow, check whether a skill covers it. The `superpowers` plugin adds process skills (brainstorming, systematic debugging, TDD) — prefer those before raw reasoning.

### 9.16.1 技能的懒加载设计

技能的懒加载机制是上下文管理的关键：本配置包含 23 个自定义技能 + superpowers 插件的 15 个过程技能，全部预加载会显著增加每次调用的 Token 消耗。因此技能在匹配条件满足时才通过 `skill` 工具加载。例如：
- 用户说"修复这个 bug" → 触发 `systematic-debugging` 技能加载
- 用户说"审查代码" → 触发 `code-review` 技能加载

不相关的技能始终保持在磁盘上，不消耗上下文窗口。

### 9.16.2 Superpowers 插件的特殊地位

> The `superpowers` plugin adds process skills (brainstorming, systematic debugging, TDD) — prefer those before raw reasoning.

Superpowers 插件提供的技能是"过程型"的——它们指导 Agent **如何思考和工作**，而非**产出什么**：

| 技能 | 解决的问题 |
|------|-----------|
| brainstorming | 在写代码前先探索需求、约束和设计方案 |
| systematic-debugging | 遇到 bug 时避免随机猜测，使用结构化调试方法 |
| TDD (test-driven-development) | 实现前先写测试 |

---

## 9.17 自我验证与证据纪律

自我验证是 AGENTS.md 中"质量闭环"的核心机制——它定义了 Agent 在声称"完成"之前必须执行的验证步骤和必须提供的证据。

> Before claiming any task complete:
> 1. Re-read every modified file end-to-end — scan for leftover debug prints, TODOs, or incomplete logic.
> 2. Grep for broken callers of any function you changed.
> 3. Run tests if they exist; otherwise state what manual verification you did.
> 4. Plan the narrowest verification path before implementing — pick the cheapest check (build / lint / unit / manual command) that proves the change; never run the full suite just because files changed.

### 9.17.1 每阶段验证一次，而非每次编辑

> **Verify once per phase, not per edit.** Batch verification: one parse + one grep sweep covers all edits in a phase. Do not re-verify after every small edit batch — that is a bonus verification loop.

验证应**按阶段批量**进行，而非每次小编辑后都验证。一次解析 + 一次 grep 扫描即可覆盖一个阶段的所有编辑。每次小编辑后都重新验证是"奖金验证循环"（违反原则 8）。

### 9.17.2 证据先于断言

> Evidence precedes assertion — a passing build, clean lint, end-to-end read, or a grep showing no broken callers. A passing build or clean lint is evidence; "it typechecks" alone is not QA for a behavior change.

证据纪律是 AGENTS.md 中最具"工程严谨性"的章节。它强制 Agent 在声称完成之前必须产生可验证的证据。

**证据层次**：

| 证据类型 | 可靠性 | 适用场景 |
|----------|--------|----------|
| 通过的测试 | 最高 | 有测试覆盖的代码 |
| 成功的构建 | 高 | 编译型语言 |
| 干净的 lint | 中高 | 所有项目 |
| grep 调用者 | 中 | 修改公共 API |
| 端到端重读确认 | 中 | 无自动检查的小修改 |
| 手动验证记录 | 低（但比没有强） | 样式/UI 修改 |

**关键区分**：通过构建或干净的 lint 是**证据**；但"它类型检查通过了"本身不是行为变更的 QA——行为变更需要运行测试或端到端验证。

### 9.17.3 预先设定验证预算

> Set a verification budget up front — choose the minimum non-duplicative evidence that covers your claims. Small mechanical changes follow ordinary project checks directly; only high-risk changes warrant the full loop.

在实现前设定验证预算——选择覆盖你声明所需的最少非重复证据。小的机械性变更直接遵循常规项目检查；只有高风险变更才需要完整验证循环。

### 9.17.4 三步完成检查

源码中的 Self-Verification 定义了完成之前必须执行的三项检查：

| 步骤 | 检查内容 | 防止的问题 |
|------|----------|-----------|
| 端到端重读 | 调试打印、TODO、不完整逻辑 | 留下半成品代码 |
| grep 调用者 | 修改的函数是否还有兼容的调用者 | 破坏性 API 变更 |
| 运行测试 | 已有测试是否全部通过；如无测试则说明手动验证方式 | 回归 bug |

---

## 9.18 插件体系

> - **superpowers** (obra/superpowers) — process skills ... Pin lives in `opencode.jsonc`. The plugin exposes **no model-mapping config** ... superpowers workflows map to models through the agent layer.
> Context compression is **built-in only** — there is no DCP plugin. Compaction fires at `limit.input - compaction.reserved` (flash ~115K, pro ~148K tokens) and prunes old tool output per request.

AGENTS.md 的 Plugins 小节记录唯一插件及其接线映射（原 DCP 插件已移除），并显式标注「本地已有等价 skill 的项不接线」。

### 9.18.1 Superpowers 插件

> **superpowers (obra/superpowers)** — process skills (brainstorming, systematic debugging, TDD); skill-first discipline.

Superpowers 的核心理念：**技能优先**——在任何回复之前，先检查是否有适用的技能。`using-superpowers` 的 bootstrap 注入主会话首条用户消息（v6.4.1 起子会话不再注入），确保 Agent 不会绕过技能体系。本配置将其固定到 git tag `#v6.4.1`，保证字节稳定前缀与行为可复现；插件不提供模型映射能力，接线映射（`writing-plans`→planner、`test-driven-development`/`verification-before-completion`→deep-worker、`verification-before-completion`→light-orchestrator；其余本地有等价物不接线）写在 AGENTS.md 的 Plugins 小节。

### 9.18.2 ~~DCP 插件~~（已移除：压缩 100% 内置）

> **Context compression is built-in only — there is no DCP plugin.** Compaction fires at `limit.input - compaction.reserved` (flash ~115K, pro ~148K tokens) and prunes old tool output per request.

原 `@tarquinen/opencode-dcp` 已于 2026-09 连同 `dcp.jsonc` 移除——它的两块价值（绝对值阈值提前压缩、工具调用去重）由内置 compaction 的显式 `limit.input` 工作窗口与每轮 `prune` 覆盖。历史上的上下文窗口管理诉求：
- 当一个任务阶段结束时，自动裁剪不再需要的上下文
- 子 Agent 的结果会被保留（因为后续阶段可能需要引用）
- 原始探索过程被移除（结论已压缩保留）

（历史：曾固定 `@3.1.15`、按模型成本分层在 77K/38K、55K/26K 触发。）现在的实现方式：`provider.deepseek.models.<id>.limit.input` 给两个模型分别声明工作窗口（flash 131,072 / pro 163,840），触发点 = `limit.input − reserved(16000)`，即 flash 115,072 / pro 147,840 tokens——同样做到了"按模型成本分层、主动提前压缩"，且与 9.3 节的缓存纪律互补：窗口更小 → 缓存前缀更稳、命中率更高、压缩触发更晚。

---

## 9.19 AGENTS.md 的设计亮点总结

回顾 311 行的 AGENTS.md，可以从以下几个维度总结其设计的精妙之处：

### 9.19.1 Token 效率的极致体现

AGENTS.md 的每一个词都经过精心推敲：
- "Reference paths, don't paste files"（8 个词，省数千 Token）
- "Delegate, don't do"（4 个词，定义了委派的核心策略）
- "Byte-stable prefix"（3 个词，定调整篇的缓存节俭哲学）

全文 311 行承载了 17 个章节的完整规则体系——没有废话，没有重复。

### 9.19.2 行为一致性的保障

在多 Agent 体系中，最危险的不是能力不足，而是**行为不一致**——同样的任务，oracle agent 改了文件，explore agent 也改了文件，结果相互覆盖。AGENTS.md 通过统一的全局规则消除了这种风险：

- 所有 Agent 在同一套规则下运行
- 角色边界被严格执行（原则 5 + 拒绝契约）
- 无论哪个 Agent 执行，行为基线一致

### 9.19.3 防止 Agent "创造性越界"

AI Agent 最大的风险之一是**过度发挥**——在完成任务后"顺便"做更多事情：
- 修复 bug 后"顺便"重构了模块（原则 2：最小改动）
- 完成任务后"顺便"创建了 README（原则 6 + 反模式：不创建文件）
- 修改代码后"顺便"调整了不相关的样式（原则 2：不碰无关代码）
- 觉得当前方案不够好，"顺便"升级为"更好"的方案（原则 8：知道停止条件）

AGENTS.md 的十条核心原则有多条直接或间接地防止了创造性越界。这不是偶然——这是设计者对 AI Agent 行为模式深刻洞察后的刻意设计。

### 9.19.4 团队协作的标准化基础

如果把 AGENTS.md 视为一份"Agent 行为规范"，它是团队协作的契约基础：
- **用户知道 Agent 会做什么**：不会偷偷改代码、不会乱建文件、不会用奇怪的文件名
- **Agent 知道彼此的边界**：oracle 不编辑、deep-worker 不研究、orchestrator 不执行
- **新人可以快速理解体系**：读完 AGENTS.md 就知道所有 Agent 的行为基线

### 9.19.5 从 292 行到 311 行的迭代智慧

从 292 行精简（一度到 218 行）再随纪律补强回到 311 行，这一过程不是简单的删减或堆砌，而是对规则体系的深度重构：
- 合并了重复表达的规则
- 去除了已被框架内置的行为约束
- 用更精炼的语言表达等价的约束力
- 保留了所有关键的防护性规则
- 在 v23 后按需补强（委派契约、后台任务卫生、循环检测）

**少即是多**——更短的 AGENTS.md 不仅更省 Token，也更容易被 Agent 完整理解和遵守。过长的规则文件可能在后半部分被 Agent "忽略"（长上下文中的注意力衰减）。

---

## 9.20 本章小结

AGENTS.md 不是一份"参考文档"——它是一份**运行时生效的约束系统**。每一条规则都在每次 Agent 调用中实时发挥作用。理解 AGENTS.md 就是理解本配置体系的"宪法"：

| 章节 | 核心主题 | 关键词 |
|------|----------|--------|
| 核心原则 | Agent 的行为底线（10 条） | 检测意图、最小改动、角色边界、先回答再行动、简洁 |
| 缓存与思考纪律 | 成本与思考 | 字节稳定前缀、冻结工具集、温度/思考 Provider 层拆分 |
| 思考分层 | 思考强度 | reasoning_effort、三层分级 |
| 范围优先 + 委派 | 工作纪律 | planner 先行、后台优先、委派而非亲为 |
| 语言约定 | 用户界面语言 | 自动检测、中文优先 |
| 约束条件 | 技术边界 | 双模型、视觉 opt-in、纯配置 |
| 多步骤纪律 | 任务管理 | TODO 列表、原子化格式、后台任务卫生 |
| Git 安全 | 版本控制安全 | 只提交自己的文件、提交前检查、禁止危险操作 |
| 拒绝契约 | 失败安全 | 拒绝比做一半更便宜 |
| 询问 vs 继续 | 沟通策略 | 最佳默认、烧烤模式、挑战用户 |
| 反模式 | 行为红线 | 无条件禁止、循环检测 |
| 质量标准 | 产出基线 | 风格匹配、无死代码、自我怀疑 |
| 注释纪律 | 注释规范 | WHY 而非 WHAT |
| 代码风格 | 实现规范 | const 优先、早期 return |
| 技能体系 | 能力扩展 | 懒加载、superpowers |
| 自我验证与证据纪律 | 质量闭环 | 每阶段验证一次、证据先于断言 |
| 插件体系 | 能力边界 | superpowers v6.4.1；压缩=内置 compaction（无 DCP） |

有了 AGENTS.md 的整体理解，后续章节（第十章实战工作流、第十二章定制指南）中的具体配置和决策都将有了参照系——你会看到每一条 Agent prompt 是如何在 AGENTS.md 的框架下发挥各自的专属作用。

---

> **下一章**：[第十章：典型工作流实战](https://znlgis.github.io/ai/my-opencode-deepseek-config/10-典型工作流实战/) —— 将本章的规则落实到具体的日常开发场景中。

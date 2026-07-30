---
layout: default
title: 第五章：Orchestrator路由机制深度解析
---

# 第五章：Orchestrator路由机制深度解析

> **前置阅读**：本章依赖第四章（多Agent体系完全解析）中介绍的各个 Agent 角色与职责。如果你尚未了解 planner、deep-worker、oracle 等 Agent 的分工，建议先阅读第四章再返回本章。

Orchestrator 是整个 `my-opencode-deepseek-config` 配置的大脑。它不是执行者——它是调度者。它不写代码、不修 bug、不查文档。它只做一件事：**分析每一个用户请求，判断真实意图，然后将任务派发给最合适的子 Agent**。

这一章将深入解析 Orchestrator 的完整工作机制：从设计哲学到意图门控，从任务分类到模型感知路由，从后备链到纪律规则。

---

## 5.1 Orchestrator 的设计哲学

### 5.1.1 路由而非执行

Orchestrator 的核心定位可以用一句话概括：

> **"你的工作是路由，不是做事。"（Your job is routing, not doing.）**

这不是一句口号，而是嵌入在 prompt 每条指令中的设计约束。Orchestrator 本身使用 `deepseek/deepseek-v4-pro` 模型——整个配置中最昂贵的推理资源——但它不直接执行任何复杂任务。它只做分类和委托。

为什么这样设计？因为在一个多 Agent 系统中，**入口 Agent 的上下文窗口是最稀缺的资源**。如果把上下文浪费在"查找文件"、"阅读代码"、"修复 typo"上，很快就会耗尽窗口，导致无法有效协调全局任务。

Orchestrator 的 prompt 中明确写入了这条规则：

```
- **Always prefer delegation** — your job is routing, not doing
- Only answer directly if the task is trivially simple (one-word answer, basic fact)
- Use the `Task` tool to delegate to subagents
```

这意味着即使是简单的回答，只要需要任何形式的调研，Orchestrator 也会委托给专门的 Agent。

### 5.1.2 意图先于行为

这是整个路由系统最核心的设计原则：

> **"Detect intent before acting. 'Look into X' is not 'change X'. Never start editing files unless the user explicitly asked for implementation."**

用户说"帮我看看这个 bug"，并不意味着应该立即开始修改代码。用户说"这个函数有点慢"，也不意味着应该立即开始优化。

Orchestrator 的 Phase 0（意图门控）就是为这一原则服务的。它要求在每次处理请求之前，先回答一个元问题：**用户真正想要什么？**

| 用户说的 | 用户可能想要的 |
|---------|-------------|
| "看看这个错误" | 诊断根因 → 等确认 → 修复 |
| "优化一下这段代码" | 分析性能瓶颈 → 提方案 → 等确认 |
| "代码有点乱" | 评估代码质量 → 提简化方案 → 等确认 |
| "这里有个 typo" | 直接修复（明确且低风险） |

这种区分在实际使用中极为重要。未经确认就开始修改代码，轻则浪费时间（用户只是随口一说），重则引入不符合预期的变更。

### 5.1.3 上下文经济学

Orchestrator 的设计建立在一个隐式假设上：**上下文窗口 = 金钱**。每一 token 的消耗都有成本，而 Orchestrator 作为入口 Agent，其上下文的"有效载荷比"直接决定了整个系统的效率。

因此，prompt 中包含了详细的上下文管理规则：

- **"Delegate, don't accumulate."** —— 把大型文件交给子 Agent 去读，不要加载到 Orchestrator 的上下文中
- **"Reference paths, don't paste files."** —— 引用文件路径和行号（如 `src/app.ts:42`），而不是把整个文件内容粘贴到 prompt 中
- **"Dispatch by reference, not by paste."** —— 这是单个最昂贵的路由错误：粘贴文件内容到 prompt 会瞬间占满上下文
- **"Stay lean."** —— Orchestrator 的上下文是用于协调的，不是用于数据的

---

## 5.2 意图门控（Phase 0: Intent Gate）

Phase 0 是每次请求经过的第一道关卡。它的任务是将用户的**表面表述**映射到**真实意图**，然后选择对应的默认路由。

这是 Orchestrator prompt 中定义最详细的部分——一个包含 17 种常见模式的意图映射表：

### 5.2.1 完整的意图映射表

| 表面形式 | 真实意图 | 默认路由 |
|---------|---------|---------|
| `"explain X"`, `"how does Y work"` | 研究/理解 | `explore` → 综合 → 回答 |
| `"implement X"`, `"add Y"`, `"create Z"` | 显式实现 | `planner` → `deep-worker` |
| `"look into X"`, `"check Y"`, `"investigate"` | 调查 | `explore` → 报告发现 |
| `"what do you think about X?"` | 评估/建议 | `consultant` → 建议 → 等待确认 |
| `"I'm seeing error X"`, `"Y is broken"` | 需要修复 | `oracle` → 诊断 → `deep-worker` 修复 |
| `"refactor"`, `"improve"`, `"clean up"` | 开放式变更 | `oracle` 评估 → `planner` 建议方案 → 等待确认 |
| `"analyze X"`, `"audit Y"`, `"diagnose Z"` | 深度调查 | `oracle` → 分析并报告 |
| `"optimize X"`, `"make Y faster"` | 性能优化 | `oracle` 分析 → `deep-worker` 实施 |
| `"help me decide"`, `"should I use X or Y"` | 决策支持 | `consultant` → 评估选项 |
| `"deploy X"`, `"release Y"` | 发布流程 | `planner` → `deep-worker` 执行 |
| `"add tests for X"` | 测试实现 | `deep-worker` → 实现测试 |
| `"write docs for X"` | 文档 | `light-orchestrator` → 生成文档 |
| `"review X"`, `"audit security of Y"` | 审查/审计 | `reviewer` → 报告发现 |
| `"trace X"`, `"debug Y from logs"` | 根因调试 | `oracle` → 追踪完整调用链 |
| `"simplify X"`, `"clean up Y code"` | 简化 | `oracle`（通过 `simplify` 技能）→ 报告 → `light-orchestrator` 或 `deep-worker` 应用 |
| `"map out X"`, `"show structure of Y"` | 代码库定位 | `explore`（或 `codemap` 技能）→ 结构化概览 |
| `"research X"`, `"what library for Y"` | 外部研究 | `librarian` → 带引用的发现 |

### 5.2.2 意图门控的核心价值

这个映射表看起来简单，但它解决了多 Agent 系统中最常见的一个问题：**动作误判**。

在没有意图门控的系统中，"look into this bug" 可能触发一个写 Agent 立即开始修改代码。而在这个配置中，相同的请求会触发一个**两阶段流程**：

1. `oracle` 诊断根因 → 报告发现
2. 用户确认后 → `deep-worker` 修复

这个额外的确认步骤看似繁琐，实际上**节省了大量时间**——因为 AI 在很多情况下对用户意图的理解是不够精确的。先诊断、再确认、再实施，避免了错误方向上的大量工作。

### 5.2.3 一个实例演示

假设用户在代码仓库中输入：

> "数据库查询有点慢，帮我看看"

**没有意图门控的系统**可能直接开始改代码（加索引、改查询、引入缓存），但用户可能只是想知道"为什么慢"，或者只是想抱怨一下。

**有意图门控的流程**：

1. **Phase 0 识别**：表面形式 `"look into / check"` → 真实意图：**调查**（不是修复）
2. **分类**：`analysis` 类任务
3. **路由**：`oracle` → 分析查询性能、追踪调用链、识别瓶颈
4. **报告**：`oracle` 返回诊断结果，附文件行号、建议方案
5. **等待确认**：Orchestrator 将 oracle 的发现呈现给用户，询问"是否要我按照这个方案修改？"
6. **用户确认后**：`planner` → 制定实施计划 → `deep-worker` 执行

关键规则（直接引用自 prompt）：

> **"Never start implementing unless the user explicitly requests it."**

---

## 5.3 任务分类系统

在通过意图门控后，Orchestrator 将任务归类到以下 6 个类别之一。类别决定了 Agent 链的选择。

### 5.3.1 六大任务类别

| 类别 | 描述 | Agent 链 |
|------|------|---------|
| `deep` | 自主研究+执行，多文件改动，新功能 | `planner` → `deep-worker` |
| `quick` | 单文件改动，typo 修复，配置调整 | `light-orchestrator` |
| `analysis` | 理解、诊断、审查现有代码 | `oracle` 或 `reviewer` |
| `research` | 在代码库或外部文档中查找信息 | `explore` 或 `librarian` |
| `visual` | 前端、UI、组件、CSS、样式 | `ui-builder` |
| `decision` | 咨询、头脑风暴、评估选项 | `consultant` |

### 5.3.2 各类别详解

#### deep（深度任务）

这是最复杂的任务类别，涉及**多文件改动、架构决策、新功能开发**。deep 类任务有一个硬性规则：

> **"For any `deep` task with 2+ files or non-trivial architecture: always delegate to `planner` first, never skip to `deep-worker` directly."**

这个规则防止了一个常见反模式：跳过规划直接实施。在没有规划的情况下，deep-worker 可能做出与项目架构不兼容的设计决策，导致返工。

deep 类任务的典型流程：

```
用户请求 → Orchestrator 分类为 deep
         → planner（制定实施计划、分解任务、识别风险）
         → handoff plan 交给 deep-worker
         → deep-worker（逐步实施、自验证、输出报告）
```

`planner` 的输出必须包含一个 **Handoff Plan**——一个结构化的、deep-worker 可以直接执行的步骤清单。这是 Planner Agent 的设计要求：

```
## Handoff Plan
1. [具体步骤 — 文件、函数、改什么]
2. [具体步骤]
...
- Risk: [注意什么]
- Test: [如何验证完成]
```

#### quick（快速任务）

quick 类任务由 `light-orchestrator`（运行在 deepseek-v4-flash 上）处理。覆盖范围：

- 单文件改动
- Typo 修复
- 配置调整
- 小规模添加
- 简单技术问题

light-orchestrator 被明确告知：如果任务涉及多文件、复杂逻辑、或任何不确定的情况，**立即拒绝并升级到 deep-worker**：

```
If the task is more complex than expected or involves 2+ non-trivial files,
escalate to `deep-worker` (v4-pro) immediately
```

#### analysis（分析任务）

analysis 类任务使用只读 Agent（`oracle` 和 `reviewer`）。这些 Agent 有硬性的权限限制：

```yaml
permission:
  edit: deny
  write: deny
  task: deny
```

它们永远不会修改文件——只返回带文件行号引用的文本分析结果。

选择 oracle vs reviewer 的判断标准：

- **oracle**：需要追踪调用链、找根因、理解代码流转 —— 用于 bug 排查、性能分析、架构诊断
- **reviewer**：需要评估代码质量、找 bug、审查变更 —— 用于 code review、安全审查

#### research（研究任务）

research 类任务使用 Flash 级别的只读 Agent：

- **explore**：代码库内搜索（grep、glob、LSP 索引、文件定位）
- **librarian**：代码库外搜索（官方文档、API 参考、web 搜索）

两者的关键区别：

| | explore | librarian |
|---|---|---|
| 搜索范围 | 本地代码库 | 互联网 |
| 工具 | grep, glob, LSP, git log | websearch, webfetch |
| 运行模式 | 并行多搜索 | 并行多查找 |

对于 research 类任务，Orchestrator 应当优先使用并行委托——同时派发多个 explore 或 librarian 实例去搜索不同的关键词或模块。

#### visual（视觉任务）

visual 类任务由 `ui-builder` 处理，专门负责：

- UI 组件（React、Vue、Svelte 等）
- CSS、样式、布局
- 响应式设计
- 可访问性

ui-builder 有一条重要的协作规则：**它的输出是"设计交付物"而非"草稿"**。后续 Agent 在跟进 UI 工作时：

```
When `ui-builder` returns UI work, do not "simplify", normalize, or refactor
it in ways that flatten layout, spacing, or motion.
```

如果 UI 任务需要后端/API 改动，ui-builder 应当升级到 `deep-worker`。

#### decision（决策任务）

decision 类任务由 `consultant` 处理，专注于：

- 头脑风暴和方案探讨
- 技术选型（"用哪个库/框架/方案？"）
- 最佳实践建议
- 开放式问答

consultant 被提示保持实用主义：

> **"Don't push unnecessary complexity — YAGNI applies."**

### 5.3.3 分类的保守性原则

当请求无法清晰归类时，Orchestrator 的默认策略是**保守分类**：

> **"Classify conservatively. If a request is ambiguous, default to `oracle`/`explore` for analysis first. Only escalate to `deep-worker` when the path is clear."**

这意味着：
- 不清楚要不要改 → 先分析
- 不清楚改什么 → 先调研
- 不清楚怎么改 → 先规划

这个保守原则防止了"猜测式执行"——在方向不明确的情况下就开始写代码。

---

## 5.4 模型感知路由（Model-Aware Routing）

这是整个配置在**Token 效率**上最精妙的设计。Orchestrator 不是简单地将任务按内容分类，而是同时考虑**模型的成本-能力匹配**。

### 5.4.1 两种模型的能力矩阵

整个配置只使用两种模型（这是 AGENTS.md 中的硬约束）：

| 模型 | 优势 | 最佳场景 | 相对成本 |
|------|------|---------|---------|
| `deepseek-v4-pro` | 深度推理、复杂决策、精细分析 | 规划、架构、调试、代码审查、咨询 | 高 |
| `deepseek-v4-flash` | 速度、低成本、直接执行 | 搜索、查找、简单编辑、文档、快速回答 | 低（约为 Pro 的一半）|

prompt 中明确写道：

> **"Flash agents are ~half the cost of Pro — send them all defined search/lookup/small-edit work."**

这意味着，在相同的 Token 消耗下，Flash 可以处理大约两倍的任务量。

### 5.4.2 五条模型选择原则

Orchestrator prompt 中定义了五条模型选择原则，构成了一个完整的决策框架：

#### 原则 1：Flash 优先 —— 定义明确的任务

> **"Flash-first for defined work. If the task is well-defined and a flash agent can handle it, route there first. Only escalate to pro when flash is out of its depth."**

这意味着系统默认走低成本路径。只有当 Flash 确实无法胜任时（任务深度超出其推理能力），才升级到 Pro。

#### 原则 2：Pro 用于推理，绝不用于查找

> **"Pro for reasoning, never for lookup. Never waste pro on 'find where X is' or 'look up Y docs' — those are explore/librarian territory."**

这是一个硬性约束。Pro 的推理能力不应该浪费在 grep 级别的任务上。"找到认证模块在哪" → explore（Flash）；"分析认证模块的安全漏洞" → oracle（Pro）。

#### 原则 3：边界任务优先 Flash

> **"Borderline tasks: prefer flash. When a task sits between `light-orchestrator` and `deep-worker`, try flash first. If it escalates, pro takes over with full context."**

这是原则 1 的一个特例。当任务处于快速任务和深度任务的边界时，默认走 Flash。如果 Flash Agent 判断任务超出能力范围，它会主动升级，此时 Pro Agent 接管完整的上下文继续工作。

#### 原则 4：Pro 是升级路径，不是默认选项

> **"Pro is the escalation path, not the default. Flash agents should handle everything they're capable of. Pro agents handle what only they can."**

这条原则重新定义了 Pro 的角色定位。在很多系统中，"高级模型"被当作默认选项；而在这个配置中，Pro 是**后备力量**——只在 Flash 真正无能为力时才介入。

#### 原则 5：模型适配任务

> **"Right-size the model to the task. A typo fix doesn't need pro's reasoning. A root-cause bug analysis shouldn't trust flash's surface-level scan."**

每种任务有自己最合适的模型层级。这条原则要求 Orchestrator 对每种任务做出精确的模型匹配。

### 5.4.3 模型选择决策图

以下是一个简化版的决策流程（从 prompt 规则推导）：

```
请求进入
    │
    ├─ 是查找/搜索/定位？ ──→ explore 或 librarian (Flash)
    │
    ├─ 是简单编辑/typo/单文件修改？
    │   └─→ light-orchestrator (Flash)
    │       如果失败 → deep-worker (Pro)
    │
    ├─ 是规划/架构/设计？
    │   └─→ planner (Pro)
    │
    ├─ 是分析/调试/审查？
    │   └─→ oracle 或 reviewer (Pro)
    │
    ├─ 是咨询/头脑风暴/技术选型？
    │   └─→ consultant (Pro)
    │
    ├─ 是前端/UI？
    │   └─→ ui-builder (Pro)
    │
    └─ 是多文件实现/新功能？
        └─→ planner (Pro) → deep-worker (Pro)
```

---

## 5.5 Agent 目录与模型分配

### 5.5.1 完整的 Agent-模型映射

| Agent | 模型 | 层级 | 模式 | 用途 |
|-------|------|------|------|------|
| `planner` | deepseek-v4-pro | Pro | subagent | 战略规划、架构设计、项目分解 |
| `deep-worker` | deepseek-v4-pro | Pro | subagent | 重型实现、多文件改动、复杂算法 |
| `oracle` | deepseek-v4-pro | Pro | subagent | 代码分析、根因调试、解读 diff |
| `reviewer` | deepseek-v4-pro | Pro | subagent | 代码审查、找 bug、质量评估 |
| `consultant` | deepseek-v4-pro | Pro | subagent | 头脑风暴、决策支持、最佳实践 |
| `ui-builder` | deepseek-v4-pro | Pro | subagent | 前端、UI/UX、组件、CSS |
| `explore` | deepseek-v4-flash | Flash | subagent | 快速代码库扫描、grep、文件搜索 |
| `librarian` | deepseek-v4-flash | Flash | subagent | 外部研究、文档查找、web 搜索 |
| `light-orchestrator` | deepseek-v4-flash | Flash | subagent | 简单任务、单文件改动、配置调整 |

### 5.5.2 层级分布

Pro 层（6 个 Agent）：
- 3 个执行者：planner、deep-worker、ui-builder
- 2 个分析者：oracle、reviewer（均为只读）
- 1 个咨询者：consultant

Flash 层（3 个 Agent）：
- 2 个搜索者：explore（代码内）、librarian（代码外）
- 1 个执行者：light-orchestrator（简单编辑）

这个分布体现了一个设计意图：**推理密集的任务集中在 Pro 层，搜索和简单执行尽可能走 Flash 层**。

### 5.5.3 只读 Agent 的权限模型

分析类 Agent（oracle、reviewer、explore、librarian）在定义中包含了明确的权限拒绝：

```yaml
permission:
  edit: deny
  write: deny
  task: deny
```

`task: deny` 意味着这些 Agent 甚至不能派发子任务——它们是完全自包含的分析单元。这防止了"只读 Agent 派发写 Agent"的意外情况。

---

## 5.6 后备链（Fallback Chains）

后备链是系统鲁棒性的核心保障。当某个 Agent 无法完成任务时，系统不会简单报错，而是按照预定义的路径**升级到更合适的 Agent**。

### 5.6.1 完整的后备链定义

Orchestrator prompt 中定义了 9 条后备链：

| 失败场景 | 后备链 | 逻辑 |
|---------|--------|------|
| `deep-worker` 失败 | 重试一次 → `planner`（重规划）→ `deep-worker`（重实施） | 执行失败可能是规划问题，先重规划再重执行 |
| `light-orchestrator` 不确定 | → `deep-worker` | Flash 执行者遇到复杂任务，升级到 Pro 执行者 |
| `oracle` 找不到根因 | → `deep-worker` 做探索性调试 | 静态分析不够时，尝试通过修改代码来理解问题 |
| `librarian` 找不到文档 | → `consultant` 做最佳猜测建议 | 文档缺失时，利用 Pro 的推理能力给出有价值的建议 |
| `consultant` 不确定/缺上下文 | → `planner` 做深入分析 | 咨询遇到瓶颈时，升级到完整的规划分析 |
| `reviewer` 发现严重问题 | → 建议 `oracle` 做根因诊断 | 审查发现表面问题后，深入追踪根本原因 |
| `ui-builder` 需要后端改动 | → `deep-worker` 处理 API/数据层 | UI Agent 不应碰后端逻辑，交给专门的后端执行者 |
| `planner` 计划有缺口 | → `consultant` 提供额外视角 | 规划可能遗漏某些维度，引入顾问的多元视角 |
| `explore` 结果太多/无法缩小 | → `oracle` 做定向分析 | 搜索结果过载时，用 Pro 的推理能力聚焦关键点 |

### 5.6.2 后备链的设计原则

**1. 先重试，再升级**

deep-worker 失败时，不是立即升级，而是**重试一次**。很多失败是瞬时的（工具调用超时、网络波动、格式解析错误），重试可以低成本解决。

**2. 升级时保留完整上下文**

当 Flash Agent 升级到 Pro Agent 时，Pro Agent 拿到的是完整的上下文——不是重新开始。这避免了升级时的信息丢失。

**3. 互补升级而非平级替换**

注意后备链的方向：从搜索到推理（explore → oracle），从分析到执行（oracle → deep-worker），从执行到规划（deep-worker → planner）。每次升级都是能力维度的提升，不是同一能力等级的换人。

**4. 交叉视角**

planner 计划有缺口时找 consultant，reviewer 发现严重问题时找 oracle。这些跨角色的后备链利用了不同 Agent 的能力互补性。

---

## 5.7 纪律规则（Discipline Rules）

Orchestrator prompt 中包含一套完整的纪律规则，用于约束路由行为。这些规则不是可选的"建议"，而是必须遵守的约束。

### 5.7.1 意图而非字面

> **"Intent, not words. 'Look into this' ≠ 'Fix this.' Never start implementing unless the user explicitly requests it. If ambiguous, verify before acting."**

这是纪律规则中排第一的条目。它呼应了 Phase 0 意图门控，并将其上升为硬约束：如果意图不明确，**停下来确认**，不要猜测。

### 5.7.2 保守分类

> **"Classify conservatively. If a request is ambiguous, default to `oracle`/`explore` for analysis first. Only escalate to `deep-worker` when the path is clear."**

在不确定的情况下，默认路径是"先分析"。这避免了在方向不明确的情况下浪费 Pro 级别的执行资源。

### 5.7.3 先规划后构建

> **"Plan before building. For any task touching 2+ files or involving architectural decisions, always delegate to `planner` first. The planner's handoff plan eliminates guesswork."**

这可能是整个 routing 体系中**最重要的单条规则**。它建立了一个不可跳过的关卡：

```
任何  2+ 文件或架构决策 → 必须先走 planner
```

跳过 planner 直接到 deep-worker 是禁止的。原因是：没有规划的执行等于猜测，猜测的成本（返工）远高于规划的成本。

### 5.7.4 并行委托

> **"Delegate in parallel. When multiple independent sub-tasks exist, dispatch them to subagents simultaneously — never sequentially."**

这是上下文管理原则在路由层面的直接体现。如果用户问"数据库连接池配置在哪？消息队列消费者怎么注册？"，这两个问题是完全独立的——应该同时派发两个 explore Agent，而不是一个接一个。

### 5.7.5 保持精简

> **"Stay lean. Use `explore` agents for broad codebase scanning; never load multiple large files into your own context."**

Orchestrator 自身运行在 Pro 模型上，上下文窗口是昂贵的。把大型文件加载到 Orchestrator 的上下文中是对计算资源的浪费。

### 5.7.6 模型适配

> **"Right-size the model. Route to flash agents for search, lookup, and simple edits. Reserve pro agents for tasks requiring reasoning, complex decisions, or multi-step analysis."**

这条规则在节 5.4 中已有详细展开，这里不再重复。

### 5.7.7 引用而非粘贴

> **"Dispatch by reference, not by paste. When handing context to a subagent, reference paths and line numbers, never paste whole file contents."**

这是**单个最昂贵的路由错误**。粘贴文件内容到 prompt 会瞬间消耗大量 token。引用路径（如 `src/auth/login.ts:42-78`）让子 Agent 自己去读需要的部分。

### 5.7.8 复用会话、隔离写范围

> **"Reuse sessions, isolate write scopes. Prefer reusing an existing specialist session over spawning a fresh one. When dispatching parallel background subagents, give each a non-overlapping file/topic scope."**

这包含两个子规则：

**复用会话**：如果已经有一个 explore Agent 在运行，新的搜索任务应该复用这个 Agent 而不是新开一个。这节省了上下文初始化成本。

**写范围隔离**：两个写 Agent（deep-worker、light-orchestrator、ui-builder）永远不能同时操作重叠的文件集。如果发生冲突，必须序列化执行。

### 5.7.9 写范围冲突检测

> **"Write-scope conflict detection. Two writer agents must never operate on overlapping file sets simultaneously. Before dispatching a writer, check whether another writer is active on the same file. If they collide, serialize them: wait for the first writer to finish before starting the second."**

这是一个关键的并发安全规则。在没有这个规则的情况下，两个并行运行的写 Agent 可能同时修改同一个文件，导致数据竞争——输出结果既不是 A 的，也不是 B 的，而是一个损坏的混合体。

### 5.7.10 后台派发纪律

> **"Background dispatch discipline. Default to background for all subagent work that takes more than a few seconds. Track task IDs, collect results via notifications, and synthesize only after all results are in. Do not poll — use the completion signal."**

这条规则有几个重要细节：

- **默认后台**：超过几秒的工作默认走后台，防止 Orchestrator 空等
- **跟踪 task_id**：方便后续关联结果
- **使用完成信号**：不要轮询（浪费 token）
- **检查失败**：后台子 Agent 可能静默失败，必须检查每个结果

### 5.7.11 保留设计交付物

> **"Preserve design handoffs. When `ui-builder` returns UI work, do not 'simplify', normalize, or refactor it in ways that flatten layout, spacing, or motion."**

这条规则保护了 ui-builder 的输出质量。其他 Agent 在跟进 UI 工作时，机械性修改（如改 API 调用、调整数据流向）可以交给 light-orchestrator 或 deep-worker，但任何需要视觉判断的修改必须回到 ui-builder。

---

## 5.8 协议与约定

### 5.8.1 全局规则继承

Orchestrator 遵循 AGENTS.md 中的所有全局规则，包括：

- **多步骤任务纪律**：2+ 步骤的任务需要写 TODO 列表，一次只标记一个 `in_progress`
- **语言适配**：检测操作系统语言，zh-CN Windows 系统自动回复中文
- **何时询问 vs 何时继续**：只有在多种解读且差异大/缺少关键上下文时才问，否则选择最佳默认方案并说明假设
- **任务拒绝契约**：遇到超出能力或权限的任务时，给出清晰的拒绝理由和建议的升级目标

### 5.8.2 命令别名直通

Orchestrator prompt 中包含一条特殊的直通规则：

> **"If the user uses `/deep`, `/quick`, `/ui`, `/review`, `/plan`, `/search`, `/oracle`, `/consult`, immediately delegate to the named agent without re-classification."**

这意味着用户可以通过 `/` 命令绕过整个分类和路由流程，直接命中目标 Agent。这为熟练用户提供了"快速通道"——当你明确知道该用什么 Agent 时，不需要经过 Orchestrator 的判断。

在 `opencode.jsonc` 中，这些命令的定义不仅是简单的 Agent 映射，还附带了初始 prompt 模板：

```
/deep      → deep-worker        "Handle this task with thoroughness and precision."
/quick     → light-orchestrator "Handle this task quickly and efficiently."
/ui        → ui-builder         "Build or modify the UI as requested."
/review    → reviewer           加载 code-review 技能，完整的审查流程
/plan      → planner            "Create a detailed plan for the following."
/search    → librarian          "Research and find information about the following."
/oracle    → oracle             "Analyze and find the root cause of the following."
/consult   → consultant         "Provide options and advice for the following."
```

### 5.8.3 后台派发与结果合成

Orchestrator 在派发子任务后，遵循"收集-合成"模式：

1. 派发多个独立子任务（均设为 `background: true`）
2. 收到完成通知后，检查每个结果是否有错误
3. 对失败的任务执行一次重试
4. 合成所有结果，以用户的操作系统语言呈现

---

## 5.9 模型感知路由的深层设计

### 5.9.1 为什么需要模型感知

在没有模型感知的多 Agent 系统中，所有 Agent 通常使用同一个模型。这导致两个问题：

1. **过度代偿**：简单的 grep 搜索也消耗 Pro 级别的推理资源，支付了不需要的成本
2. **能力不足**：或者反过来，所有任务走 Flash，深度推理任务的质量严重下降

模型感知路由的核心思想是：**让每类任务使用最适合它的模型，而不是使用同一个模型处理一切**。

### 5.9.2 Token 效率的实际收益

虽然具体数字取决于工作负载的构成，但从配置设计可以估算一个合理的效率提升范围：

假设一个典型工作日的任务分布：

| 任务类型 | 占比 | 原模型（全 Pro） | 优化后模型 | Token 节省 |
|---------|------|-----------------|-----------|-----------|
| 搜索/查找 | ~25% | Pro | Flash | ~50% |
| 简单编辑/typo | ~20% | Pro | Flash | ~50% |
| 文档研究 | ~10% | Pro | Flash | ~50% |
| 代码审查 | ~10% | Pro | Pro | 0% |
| 规划/架构 | ~10% | Pro | Pro | 0% |
| 复杂实现 | ~15% | Pro | Pro | 0% |
| 调试/分析 | ~10% | Pro | Pro | 0% |

在 ~55% 的任务上使用 Flash 替代 Pro，考虑 Flash 约 Pro 一半的成本，**整体 Token 消耗可以降低约 40-60%**。这不仅仅是成本问题——更低的 Token 消耗意味着更快的响应速度、更长的会话可持续性、以及更少的上下文压缩需求。

### 5.9.3 真实的请求路由示例

以下是一些典型用户请求在 Orchestrator 中的实际路由路径，附带注解说明为什么这样路由：

#### 示例 1："添加用户登录功能"

```
用户请求: "添加用户登录功能"
    │
Phase 0 意图门控: "add" → 显式实现
    │
分类: deep（多文件改动——路由、中间件、数据库、测试）
    │
路由: planner (Pro) → 制定实施计划
      planner 输出: Handoff Plan
         1. 创建 User 模型 (src/models/user.ts)
         2. 实现密码哈希工具 (src/utils/crypto.ts)
         3. 创建登录 API 路由 (src/routes/auth.ts)
         4. 添加 JWT 中间件 (src/middleware/auth.ts)
         5. 编写测试 (tests/auth.test.ts)
         Risk: 注意 CSRF 防护
         Test: curl 测试 /api/auth/login 端点
      │
      └→ deep-worker (Pro) → 逐步实施，完成后输出验证报告
```

**路由解析**：这是一个 5 文件的新功能开发（deep 类），必须走 planner → deep-worker 链。直接跳到 deep-worker 会导致没有统一的架构设计。

#### 示例 2："logo.png 在哪个目录？"

```
用户请求: "logo.png 在哪个目录？"
    │
Phase 0 意图门控: 查找/定位 → research
    │
分类: research（代码库内搜索）
    │
路由: explore (Flash) → glob "**/logo.png"
      explore 结果: "/public/images/logo.png"
      Orchestrator: "logo.png 在 public/images/ 目录下。"
```

**路由解析**：一个纯粹的查找问题。用 Flash（explore）解决，Pro 模型的推理能力在此浪费。

#### 示例 3："这段代码有点乱，帮忙整理一下"

```
用户请求: "这段代码有点乱，帮忙整理一下"
    │
Phase 0 意图门控: "clean up" / "simplify" → 简化（开放式变更）
    │
分类: analysis → deep（需要先分析再执行）
    │
路由: oracle (Pro) ＋ simplify 技能 → 分析代码结构，识别简化机会
      oracle 输出: 发现了 4 处可简化的地方：
        1. src/utils.ts:15-28 — 三层嵌套 if 可以改为 early return
        2. src/utils.ts:42-55 — 单次使用的 helper 函数可以内联
        3. src/services.ts:10-35 — 重复的错误处理逻辑可以提取
        4. src/api.ts:88-102 — 死变量 counter 未被使用
        Confidence: High
        Effort: Quick (<1h)
      │
      └→ light-orchestrator (Flash) 或 deep-worker (Pro) → 应用简化
         （取决于改动范围：单文件走 Flash，多文件走 Pro）
```

**路由解析**：用户没有说"帮我改"，说的是"帮忙看看/整理一下"。意图门控将其识别为开放式变更而非显式实现。先走 oracle 分析，确认后再执行。实际执行可能走 light-orchestrator（如果改动集中在 1-2 个文件）或 deep-worker（如果跨多个模块）。

#### 示例 4："帮我 review 一下最近的改动"

```
用户请求: "帮我 review 一下最近的改动"
    │
Phase 0 意图门控: "review" → 审查/审计
    │
分类: analysis
    │
路由: reviewer (Pro) → 加载 code-review 技能
      - 按 diff 大小自动调整审查深度（Abbreviated / Full）
      - 覆盖 correctness、security、performance 等维度
      - 按严重性分级输出（critical / major / minor / nit）
      - 输出: severity summary + 具体 file:line 发现
```

**路由解析**：审查任务。reviewer 是 Pro 模型，因为有效的代码审查需要理解设计意图、发现潜在漏洞、评估架构影响——这些都是需要深度推理的任务。

#### 示例 5："npm 中有什么好用的日期处理库？"

```
用户请求: "npm 中有什么好用的日期处理库？"
    │
Phase 0 意图门控: "what library for Y" → 外部研究
    │
分类: research
    │
路由: librarian (Flash) → web 搜索、拉取文档
      librarian 输出:
        - date-fns: 模块化、tree-shakable、不可变 — npm: date-fns
        - dayjs: 轻量 (2KB)、API 兼容 Moment.js — npm: dayjs
        - luxon: 时区支持强、Intl 原生 — npm: luxon
      │
      Orchestrator: 综合 librarian 的发现呈现给用户
      如果需要进一步的技术选型建议，可以升级到 consultant (Pro)
```

**路由解析**：外部研究任务。librarian（Flash）足够完成文档查找和比较。如果用户接下来问"我应该选哪个？"，才会升级到 consultant（Pro）做深度技术选型分析。

#### 示例 6："/ui 把登录页的样式优化一下"

```
用户请求: "/ui 把登录页的样式优化一下"
    │
检测到 "/ui" 命令 → 直通路由，跳过意图门控和分类
    │
路由: ui-builder (Pro) → "Build or modify the UI as requested."
      ui-builder: 读取现有登录页组件 → 优化样式 → 返回修改
      │
      Orchestrator: 保留 ui-builder 的设计交付物，不做"简化"或"规范化"
```

**路由解析**：`/ui` 命令直接跳过了整个路由流程。这是为熟练用户设计的快速通道。

#### 示例 7：一个复杂的复合请求

```
用户请求: "首先找到所有调用 PaymentService 的地方，然后评估是否
          可以安全地将 processPayment 方法改为异步，如果可以就改。"
    │
Phase 0 意图门控: 复合请求 — 包含 research、analysis、implementation 三个阶段
    │
分解为三个独立阶段:
    │
    阶段 1 (research): explore (Flash)
      → 搜索所有 PaymentService.processPayment 的调用点
      → 返回调用点列表（文件:行号）
    │
    阶段 2 (analysis): oracle (Pro)
      → 分析每个调用点的上下文
      → 判断异步改造是否会影响现有同步代码路径
      → 输出: "安全可改"或"存在风险点"
    │
    阶段 3 (implementation) — 仅当 oracle 确认安全:
      → planner (Pro) 制定改造计划
      → deep-worker (Pro) 执行
```

**路由解析**：这是一个多阶段复合任务。每个阶段使用最适合的 Agent 和模型。三个阶段虽然是顺序依赖的，但在每个阶段内部，Orchestrator 仍然可以通过并行派发来优化（例如阶段 2 中同时分析多个调用点）。

---

## 5.10 小结

Orchestrator 的路由机制是整个 `my-opencode-deepseek-config` 配置中设计最密集、逻辑最精妙的部分。它以不到 130 行的 prompt 文本，构建了一个完整的任务调度系统：

- **Phase 0 意图门控**防止动作误判，确保系统先理解再行动
- **六类任务分类系统**为每种请求找到最合适的 Agent 链
- **模型感知路由**将 Token 效率优化到极致，合理路由可节省 40-60% 的消耗
- **9 条后备链**保障系统在 Agent 失败时的优雅降级和升级
- **11 条纪律规则**约束路由行为，防止上下文浪费和并发冲突
- **命令别名直通**为熟练用户提供快速通道

这些机制协同工作，使得 Orchestrator 能够像一个经验丰富的技术主管一样，对每一个请求做出"该找谁、用什么模型、走什么流程"的精准判断——而不是简单地"收到一个请求，随便派给一个 Agent"。

理解 Orchestrator 的路由机制，是理解整个配置运作方式的关键。下一章（第六章：技能体系与插件生态）将深入解析 Skills 和 Plugins 如何在 Agent 之上提供可复用的能力封装。

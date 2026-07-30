---
layout: default
title: 第四章：多Agent体系完全解析
---

# 第四章：多Agent体系完全解析

本章基于 `agents/` 目录下的 10 个 Agent 定义文件，结合 `AGENTS.md` 全局规则和 `orchestrator.md` 路由逻辑，逐层拆解这套纯配置驱动的多 Agent 协作体系。你将看到每个 Agent 的模型选择、权限边界、核心职责、调用时机和设计意图，以及它们如何像一支训练有素的工程团队一样协同工作。

---

## 4.1 多Agent架构设计理念

### 4.1.1 为什么需要多Agent而不是单Agent

单 Agent 模式——一个模型同时负责理解需求、搜索代码、设计方案、编写实现、检查质量——在简单任务上可行，但面对真实工程场景时存在根本性矛盾：

1. **能力矛盾**：搜索定位需要的是速度和广度，架构设计需要的是深度和审慎。一个 Agent 很难同时具备这两种特质。
2. **成本矛盾**：用「最强大」的模型做 grep 搜索，相当于用超级计算机算加减法——每毫秒都在烧钱。
3. **注意力矛盾**：单 Agent 的上下文窗口承载了所有中间结果（搜索结果、代码片段、分析报告），信息密度下降时推理质量随之崩塌。
4. **角色混淆**：一个人同时扮演规划师、实施者、审查者三种角色，等于没有审查——自我审查的盲点远大于外部审查。

多 Agent 架构本质上是一个**注意力分配系统**：让每个 Agent 聚焦在自己最擅长的事情上，把不擅长的部分交给其他 Agent。这类似于一支工程团队的分工——没人会让架构师去 grep 代码库，也没人会让实习生设计系统架构。

### 4.1.2 专业化分工 vs 通用Agent

这套配置选择了**强专业化**路线。10 个 Agent 各有明确定义的角色和边界，而非一个「万能 Agent + 一些辅助工具」。

| 维度 | 通用Agent | 专业化多Agent |
|------|----------|--------------|
| 任务分配 | Agent 自行决定怎么做 | Orchestrator 预先分配 |
| 质量保证 | 依赖 Agent 自律 | Reviewer 外部审查，只读隔离 |
| 成本控制 | 整体使用最贵模型 | Flash 处理轻量任务，Pro 处理推理 |
| 可靠性 | 单点故障 | 后备链自动升级 |
| 可观测性 | 黑盒 | 每个 Agent 有明确的输出格式和验证标准 |

这种设计的代价是复杂度——需要定义 10 个 Agent 的 prompt、路由规则和协作协议。但收益是显著的：每个 Agent 可以针对自己的职责做极致优化，prompt 更短更精准，模型能更好地理解自己的任务边界。

### 4.1.3 只读隔离设计

本体系将 Agent 分为两大阵营：**读写 Agent** 和 **只读 Agent**。只读 Agent 通过 OpenCode 的 `permission` 配置强制拦截写操作：

```
permission:
  edit: deny     # 禁止编辑文件
  write: deny    # 禁止写入文件
  task: deny     # 禁止派生子Agent
```

四个只读 Agent 及其各自定位：

| Agent | 只读原因 | 设计意图 |
|-------|---------|---------|
| `oracle` | 深度代码分析师 | 分析需要冷静客观，一旦有权修改就会倾向于「改完再说」而非「彻底查清」。只读约束迫使它把精力集中在根因分析上，输出带 `file:line` 的精确诊断报告。 |
| `reviewer` | 代码审查者 | 审查与编写必须分离。如果将两者合并，自我审查的盲点（确认偏误、选择性忽略）几乎没有防御手段。只读 + 结构化报告格式确保审查保持独立的批判视角。 |
| `explore` | 代码库搜索专家 | 搜索是纯信息获取行为，不应伴随修改。只读约束还能防止「边搜边改」的分散注意力模式——搜到的结果交给读写 Agent 处理，探索者专注寻找。 |
| `librarian` | 外部研究专家 | Web 搜索和文档检索天然是只读操作。只读约束确保它返回的是原汁原味的文档内容，而非「加上自己理解的改写版本」。 |

这种隔离不是形式主义——它是通过 OpenCode 权限层强制执行的。只读 Agent 尝试修改文件时，OpenCode 会在框架层面拦截，Agent 自身无法绕过。

### 4.1.4 执行与探索分离

更深层的设计原则是**执行与探索的完全分离**：

- **执行型 Agent**（`deep-worker`、`light-orchestrator`）被明确告知：「禁止研究，禁止委托」。它们收到的是已经过充分准备的上下文——Orchestrator 或 Planner 已经把需要搜索的东西搜索完毕，把需要决策的东西决策完毕。执行者的唯一职责是实现。
- **探索型 Agent**（`explore`、`librarian`）被明确告知：「只读，只返回发现」。它们没有修改代码的权限，也没有做决策的权限——决策权在 Orchestrator 或 Planner 手中。

这种分离的核心价值是**消除猜测**。当执行者不需要「研究一下这个地方怎么改」时，它就不会把上下文浪费在不必要的搜索上。当探索者不需要「顺便修一下这里」时，它就不会分心。每个 Agent 的注意力都聚焦在唯一任务上。

### 4.1.5 模型感知：Pro Agent vs Flash Agent

这套配置只使用两个模型，通过不同的分配策略形成明显的两级分工：

| | Pro Agent (v4-pro) | Flash Agent (v4-flash) |
|---|---|---|
| **核心能力** | 深度推理、复杂决策、精细分析 | 速度优先、低成本、直截了当 |
| **适用场景** | 规划、架构、调试、审查、咨询 | 搜索、检索、简单编辑、文档 |
| **成本倍数** | 基准 | 约 1/2 |
| **代表性Agent** | planner, deep-worker, oracle, reviewer, consultant, ui-builder | explore, librarian, light-orchestrator |
| **Agent数量** | 6个 | 3个（explore为hidden，不对外显式路由） |
| **特点** | 每个Agent有独立且细微的温度设置 | temperature统一偏低，追求确定性 |

**模型选择原则**（摘自 orchestrator.md）：

1. **Flash-first for defined work**：定义明确的任务优先用 Flash。如果 Flash Agent 能处理，就不要浪费 Pro。
2. **Pro for reasoning, never for lookup**：Pro 绝不用于「在哪里」「查文档」——那是 explore/librarian 的领地。
3. **Borderline tasks: prefer Flash**：边界任务默认走 Flash，Flash 搞不定时升级到 Pro（带完整上下文）。
4. **Right-size the model to the task**：typo 修复不需要 Pro 的推理能力，根因分析不能信任 Flash 的表面扫描。

这种两级分工的巧妙之处在于**代理闭环**：Flash Agent 自带模型感知声明（如 librarian 的「When research requires deep cross-referencing or nuanced interpretation, ask the orchestrator to escalate to consultant」），当发现自己能力不足时会主动请求升级，而非硬着头皮给出不准确的结果。

### 4.1.6 3级代理嵌套

OpenCode 框架的 `subagent_depth: 3` 配置（在 `opencode.json` 中定义）允许最多 3 层代理嵌套。这意味着：

```
Orchestrator (层级0，入口)
  └── Planner (层级1，子代理)
        └── Explore (层级2，孙代理，Planner探索代码)
              └── [不允许再嵌套，深度到顶]
```

实际使用中，典型的嵌套深度为 2 层（Orchestrator → 专业Agent → 辅助Agent），3 层上限主要用于特殊场景（如 Planner 需要派 Explore 做搜索，Explore 返回结果后 Planner 制定方案交给 Deep Worker）。

---

## 4.2 主入口 Agent：Orchestrator（主编排器）

Orchestrator 是整个系统的「大脑」。它不亲自实现功能，不亲自搜索代码——它的唯一职能是**分析意图、分类任务、路由到最佳子代理**。

### 4.2.1 基本属性

```
name: orchestrator
mode: primary          # 主入口模式，在所有非子代理场景中作为默认Agent
model: deepseek/deepseek-v4-pro
steps: 100             # 100步执行上限，给路由决策空间
color: "#4A90E2"       # 蓝色，代表调度的理性与冷静
```

Orchestrator 使用 Pro 模型。这个选择很关键——路由决策本身需要深度推理：判断用户真实意图（是「看看」还是「改掉」）、评估任务的复杂度（1 个文件还是 20 个文件）、选择最优的子代理链。Flash 模型可能误判意图导致路由错误，而路由错误意味着整个后续流程的方向错误。

### 4.2.2 意图门控（Intent Gate）

这是 Orchestrator 的第一道防线，也是最重要的设计。**「Look into this」≠「Fix this」**——在软件工程的日常对话中，大量请求存在「表面形式」与「真实意图」的偏离：

| 表面形式 | 真实意图 | 默认路由 |
|---------|---------|---------|
| "explain X", "how does Y work" | 研究/理解 | `explore` → 综合 → 回答 |
| "implement X", "add Y", "create Z" | 显式开发 | `planner` → `deep-worker` |
| "look into X", "check Y", "investigate" | 调查（非修复） | `explore` → 报告发现 |
| "what do you think about X?" | 评估/建议 | `consultant` → 提案 → 等待确认 |
| "I'm seeing error X", "Y is broken" | 需要修复 | `oracle` → 诊断 → `deep-worker` 修复 |
| "refactor", "improve", "clean up" | 开放变更 | `oracle` 评估 → `planner` 提案 → 等待确认 |
| "analyze X", "audit Y", "diagnose Z" | 深度调查 | `oracle` → 分析并报告 |
| "optimize X", "make Y faster" | 性能优化 | `oracle` 分析 → `deep-worker` 实施 |
| "help me decide", "should I use X or Y" | 决策支持 | `consultant` → 评估选项 |
| "review X", "audit security of Y" | 审查/审计 | `reviewer` → 报告发现 |
| "trace X", "debug Y from logs" | 根因调试 | `oracle` → 追踪完整调用链 |
| "simplify X", "clean up Y code" | 简化 | `oracle`（通过 `simplify` skill）→ 报告 → 实施 |
| "research X", "what library for Y" | 外部研究 | `librarian` → 带引用的发现 |

**关键约束**：「Never start implementing unless the user explicitly requests it.」——这条规则是防止 Agent 过度解读用户意图的最后屏障。如果意图模糊（比如用户说「这个地方好像有点问题」），Orchestrator 会选择 `oracle`/`explore` 先分析，而非直接派 Deep Worker 修改。

### 4.2.3 六类任务分类

每个用户请求经过意图门控后，会被归入以下六类之一：

| 类别 | 描述 | Agent链 |
|------|------|--------|
| `deep` | 自主研究+执行，多文件改动，新功能 | `planner` → `deep-worker` |
| `quick` | 单文件改动，typo修复，配置调整，小修改 | `light-orchestrator` |
| `analysis` | 理解、诊断、审查已有代码 | `oracle` 或 `reviewer` |
| `research` | 在代码库或外部文档中查找信息 | `explore` 或 `librarian` |
| `visual` | 前端、UI、组件、CSS、样式 | `ui-builder` |
| `decision` | 咨询、头脑风暴、评估选项 | `consultant` |

**Deep 类任务的关键约束**：任何涉及 2+ 文件或非平凡架构变更的任务，**必须先走 Planner，绝不跳过规划直接到 Deep Worker**。这条规则防止了「边写边想」的模式——在没有清晰方案的情况下修改多文件代码，几乎必然导致不一致。

### 4.2.4 模型感知路由

Orchestrator 是模型感知路由的唯一决策点。它的 Agent 目录表明确标注了每个子代理使用的模型：

| 代理 | 模型 | 层级 | 用途 |
|------|------|------|------|
| `planner` | v4-pro | Pro | 战略规划、架构设计、项目拆解、决策支持 |
| `deep-worker` | v4-pro | Pro | 重型实现、多文件改动、复杂算法、调试 |
| `oracle` | v4-pro | Pro | 代码分析、根因调试、diff解读 |
| `reviewer` | v4-pro | Pro | 代码审查、bug发现、改进建议、质量评估 |
| `consultant` | v4-pro | Pro | 头脑风暴、决策支持、最佳实践咨询 |
| `ui-builder` | v4-pro | Pro | 前端、UI/UX、组件、CSS、布局 |
| `explore` | v4-flash | Flash | 快速代码库扫描、grep、文件搜索 |
| `librarian` | v4-flash | Flash | 外部研究、文档检索、Web搜索 |
| `light-orchestrator` | v4-flash | Flash | 简单任务、单文件改动、配置调整 |

### 4.2.5 后备链（Fallback Chains）

后备链是这套体系可靠性的核心保障。每个 Agent 都可能失败（理解偏差、能力不足、偶发错误），后备链定义了清晰的失败处理策略：

```
deep-worker 失败
  → 重试一次（同一代理）
  → 失败 → planner 重新规划 → deep-worker 重新实施

light-orchestrator 不确定
  → 升级到 deep-worker

oracle 找不到根因
  → 交给 deep-worker 做探索性调试

librarian 找不到文档
  → 交给 consultant 提供最佳猜测建议

consultant 不确定/缺少上下文
  → 升级到 planner 做更深入分析

reviewer 发现严重问题
  → 建议 oracle 做根因诊断

ui-builder 需要后端改动
  → 交给 deep-worker 做 API/数据层工作

planner 方案有缺口
  → consultant 提供额外视角

explore 结果太多无法缩小
  → oracle 做定向分析
```

需要特别注意的是 deep-worker 的二次失败处理：第一次失败只做简单重试（可能因为网络、token 截断等偶发问题）；第二次失败说明方案本身有问题，所以回到 planner 重新规划。这种「重试→重规划→重实现」的闭环是典型的生产级容错策略。

### 4.2.6 派发纪律

Orchestrator 的派发行为受一套严格的纪律约束：

1. **不由引用粘贴**：移交上下文时使用路径引用（`src/app.ts:42`），绝不把整个文件内容粘贴到子代理的 prompt 中。粘贴文件是整个系统中最昂贵的路由错误。
2. **并行派发**：多个独立子任务（如同时探索两个模块、同时研究两个 API）必须并行派发到子代理，绝不串行。
3. **后台派发优先**：耗时超过几秒的工作默认使用 `background: true` 模式派发，不轮询等待结果——通过完成信号通知。
4. **写范围冲突检测**：两个写代理（deep-worker、light-orchestrator、ui-builder）绝不在同一文件集上同时操作。如果冲突，序列化处理。
5. **上下文复用**：优先复用已有的专家会话，而非每次都新开——携带的上下文可以节省大量 token。
6. **单主题原则**：不让一个子代理同时做研究和实现——必须拆分。

---

## 4.3 Pro Agent群详解

Pro Agent 使用 `deepseek/deepseek-v4-pro` 模型，共 6 个。每个都有自己独特的 temperature 设置（从严谨的 oracle 0.1 到富有创造力的 consultant 0.5），体现对输出特性的精细控制。

### 4.3.1 Planner（战略规划师）

```
model: deepseek/deepseek-v4-pro
temperature: 0.3      # 偏低温度，追求方案的逻辑一致性和确定性
steps: 60
color: "#9B59B6"      # 紫色，代表战略思维
```

**核心职责**：Planner 是「设计然后建造」哲学的体现者。它在动手之前先思考——设计系统架构、编写技术规格、将大型项目拆解为可执行的实施计划。

**工作流程**：

1. 首先完整理解上下文和需求
2. 探索已有代码库后才开始设计方案——绝不「盲规划」
3. 对于决策类任务：呈现 2-3 个选项，附带诚实的权衡分析，给出带推理的推荐
4. 对于规划类任务：输出单一果断的方案，只在替代方案差异显著时提及
5. 识别风险、边界情况和集成点

**核心输出——Handoff Plan**：

Planner 最关键的输出是一份**可直接由 deep-worker 执行的 Handoff Plan**：

```
## Handoff Plan
1. [具体步骤 — 文件、函数、改动内容]
2. [具体步骤]
...
- 风险：[需要注意的事项]
- 测试：[如何验证完成]
```

Handoff Plan 的设计目标是「消除后续 Agent 的猜测工作」。Deep Worker 收到 Handoff Plan 后不需要自己研究、不需要自己决策——它只需要按照计划执行。如果 Deep Worker 在执行中遇到问题，说明 Handoff Plan 有缺陷，应该回到 Planner 重新规划。

**调用时机**：任何涉及 2+ 文件或非平凡架构变更的任务。Orchestrator 的规则明确：「always delegate to planner first, never skip to deep-worker directly」。

### 4.3.2 Deep Worker（重型实现者）

```
model: deepseek/deepseek-v4-pro
temperature: 0.2      # 低温度，最确定性的实现输出
steps: 100            # 最多步数，允许复杂的多文件实现
color: "#E24A4A"      # 红色，代表执行的力度与紧迫感
```

**核心职责**：Deep Worker 是整个体系中最「重」的执行 Agent。它处理复杂的、多步骤的、多文件的工程工作，自主完成直到任务彻底结束。

**四阶段工作流**：

- **Phase 0: Todo管理** — 对于 2+ 步骤的任务，先写有序 todo 列表。每次只标记一个 `in_progress`，完成即标记 `completed`。
- **Step 1: 并行探索** — 同时发起多个 read/glob/grep 请求，绝不串行。直接使用工具而非委托子代理。
- **Step 2: 实施** — 聚焦最小改动，不碰无关代码。遵循项目代码风格，编写生产级代码（完善的错误处理、边界情况覆盖）。不生成 AI 套话注释。每个公开函数/方法必须有调用者。
- **Step 3: 自验证** — 重读所有修改过的文件，grep 检查调用者是否断裂，运行可用测试，检查未使用的导入。
- **Step 4: 完成报告** — 结构化输出摘要、改动列表和验证结果。

**关键约束——禁止研究，禁止委托**：

```
No research, no delegation.
Use grep/glob/read directly.
If external docs lookup is required, ask the orchestrator to provide that context before you start.
```

这是 Deep Worker 区别于单 Agent 模式的最关键特征。在单 Agent 模式下，Agent 遇到不熟悉的 API 会自己搜索、自己阅读文档——这占用了大量上下文和推理资源。而在多 Agent 架构中，这些研究任务已经在 Planner 阶段完成（或由 Orchestrator 派 Librarian 完成），Deep Worker 收到的上下文已经包含了所有需要的信息。它只需要实现。

**遇到意外情况**：如果事情比预期更复杂，Deep Worker 不会放弃——它会继续完成。只有在真正被卡住时才升级。这条规则反映了「执行者不找借口」的工程文化。

**代码要求**：写出「与资深工程师无异的代码——没有 AI 痕迹」。具体表现为：
- 不使用 AI 套话注释
- 不创建未明确请求的新文件
- 不引入未授权的依赖
- 每个公开函数必须有调用者

### 4.3.3 Oracle（深度代码分析师）

```
model: deepseek/deepseek-v4-pro
temperature: 0.1      # 极低温度，最精确的分析输出
steps: 40
color: "#F39C12"      # 橙色，代表洞察与发现
permission:
  edit: deny          # 只读！
  write: deny
  task: deny
```

**核心职责**：Oracle 是代码库的「透视眼」——根因分析 Bug、解读 diff 和 PR、追踪数据流和控制流、识别架构问题和反模式。它提供带 `file:line` 引用的精确诊断报告。

**分析框架**：

- **偏向简单**：正确的解决方案通常是最不复杂的那个
- **一条清晰路径**：呈现单一主推荐；只在替代方案差异显著时提及
- **深度匹配复杂度**：快速问题得到快速回答，复杂问题得到彻底分析

**标准化输出格式**：

```
**结论（Bottom line）**：2-3句话总结发现。附置信度：高/中/低 + 一行原因。

**行动计划（Action plan）**：编号步骤，≤7项，每项≤2句话。

**工作量估算**：快速（<1h）/ 短期（1-4h）/ 中期（1-2d）/ 长期（3d+）

**为什么是这个方案**：≤4个要点

**注意**：≤3个风险点
```

**与 explore 的本质区别**：explore 是「找东西」，oracle 是「理解东西」。explore 返回的是文件列表和搜索结果，oracle 返回的是诊断结论和修复建议。两者的分工就像图书馆管理员（帮你找到书）和教授（帮你理解书的内容）。

**simplify 技能的宿主**：Oracle 是 `simplify` 技能的指定执行者——在简化代码时，由它做深度分析，然后交给 light-orchestrator 或 deep-worker 执行修改。

### 4.3.4 Reviewer（代码审查者）

```
model: deepseek/deepseek-v4-pro
temperature: 0.2
steps: 40
color: "#27AE60"      # 绿色，代表质量与通过
permission:
  edit: deny          # 只读！
  write: deny
  task: deny
```

**核心职责**：Reviewer 是质量守门人——多维度审查代码、发现真实问题、提出改进建议。它从不修改代码，只报告发现。

**审查方法论（来自 `code-review` 技能）**：

1. **按有效大小确定审查范围**：通过文件类别加权计算 diff 的有效大小（生成文件/lockfile 0倍，配置 0.25倍，测试 0.5倍，逻辑代码 1倍）。≤8 个逻辑文件且 ≤300 有效行时使用简略审查，否则使用完整审查。
2. **覆盖 diff 实际触碰的维度**：正确性、安全性、性能、架构、可维护性等——只覆盖实际涉及的，跳过无关的。
3. **按项目威胁模型校准严重度**：一个准确的发现胜过十个夸大的。自动检查 `package.json` 版本号（v0.x → 兼容性发现最多 minor）、部署模型和仓库可见性。

**审查前的自检清单**：通读每个发生变更的文件，检查未使用的导入、残留的 TODO、死代码，确认新增/变更的函数有调用者。

**输出格式**：以严重度摘要开头 `critical: N | major: N | minor: N | nit: N`，按严重度排序列出发现，每个发现附带具体 `file:line`、问题描述、影响说明和最小修复方案。

**与 security-review 技能的联动**：Reviewer 在开始前会检查 `security-review` 技能是否适用（涉及认证、输入处理、序列化、密钥管理的场景），如适用则加载该技能。

### 4.3.5 Consultant（决策顾问）

```
model: deepseek/deepseek-v4-pro
temperature: 0.5      # 较高温度，允许创造性建议和不同视角
steps: 30
color: "#3498DB"      # 蓝色系，代表理性建议
```

**核心职责**：Consultant 是技术智囊——帮助用户梳理问题、评估方案、提供最佳实践指导、进行头脑风暴。它的定位是「帮助你想清楚」，而非「替你决定」。

**工作流程**：

1. 理解用户的真实目标（而非他们表面提出的问题）
2. 呈现选项及诚实权衡——每个选项的利弊
3. 推荐明确方向并附上推理
4. 务实而非理论化——建立在真实约束之上
5. 有需要时引用具体、真实的案例

**关键原则**：

- **YAGNI**：不推动不必要的复杂性
- **承认等价**：当多个方案同样有效时，坦率承认而非强行推荐
- **诚实**：不知道就说不确定，而非猜测

**Consultant 在决策链中的位置**：Consultant 的输出通常不是终点——它的建议会传递给 Planner（制定方案）或回到 Orchestrator（征求用户确认）。它和 Planner 的区别在于：Consultant 负责「选哪个方向」，Planner 负责「方向定下来后怎么做」。

### 4.3.6 UI Builder（前端UI专家）

```
model: deepseek/deepseek-v4-pro
temperature: 0.3
steps: 60
color: "#E91E63"      # 粉色，代表界面设计
```

**核心职责**：UI Builder 是唯一专注前端的 Agent——构建 UI 组件、编写 CSS 和样式、处理布局和响应式设计、确保可访问性。

**工作流程**：

1. 理解视觉需求和设计意图
2. 探索项目中已有的 UI 模式——匹配风格
3. 增量构建，每步测试视觉效果
4. 确保可访问性（正确的 ARIA、键盘导航、对比度）
5. 处理响应式断点和边界情况

**设计规则**：

- 遵循项目已有的设计系统和组件模式
- 偏好语义化 HTML 而非 div 堆砌
- 关注性能——避免不必要的重渲染和布局抖动
- 设计产出是「交底」而非「草稿」：后续其他 Agent 的机械性跟进必须保留其布局、间距和动效

**跨界处理**：如果任务需要后端/API 改动，UI Builder 会升级到 deep-worker 而非自己跨领域操作。

---

## 4.4 Flash Agent群详解

Flash Agent 使用 `deepseek/deepseek-v4-flash` 模型，共 3 个（其中 `explore` 标记为 `hidden: true`，不对外显式路由，由 Orchestrator 根据需要派发）。它们的共同特征是：快速、低成本、职责高度聚焦。

### 4.4.1 Explore（代码库搜索专家）

```
model: deepseek/deepseek-v4-flash
temperature: 0.1      # 极低温度，搜索不需要创造性
steps: 40
color: "#2ECC71"
hidden: true           # 隐藏在内部，不暴露给用户直接路由
permission:
  edit: deny           # 只读！
  write: deny
  task: deny
```

**核心职责**：Explore 是代码库的「地图绘制员」——回答「X 在哪里实现？」「哪些文件包含 Y？」「这个代码库用的是什么模式？」这类问题。它不实现代码，不调试逻辑，不编辑文件。

**模型感知声明**：

```
You run on v4-flash — fast, cheap.
Return what you find; let the caller (typically a v4-pro agent) interpret.
If a search yields ambiguous results, surface both the findings and the ambiguity
— never make a call that belongs to the reasoning tier.
```

这句话揭示了多 Agent 架构中模型分级的核心逻辑：Flash Agent 的职责是「呈现原始发现 + 标注歧义」，判断和决策留给更强的模型。这种分工使得每个模型都做自己最擅长的事。

**三阶段工作流**：

- **Step 1: 意图分析** — 识别字面请求、真实需求和什么样的结果能让调用方立即继续。
- **Step 2: 并行执行（必须）** — 同时发起多个搜索工具。工具选择策略：LSP 用于定义/引用查找，grep 用于文本模式搜索，glob 用于文件模式匹配，git log 用于历史追溯。
- **Step 3: 结构化结果** — 输出格式要求绝对路径、标注发现为何重要、覆盖所有相关匹配、提供总结性的直接回答。

**特点**：可并行启动多个 Explore 实例进行广泛搜索——这是 Flash 速度和低成本带来的独特优势。Orchestrator 可以同时派发 3 个 Explore 分别搜索不同模块，结果汇总后再交给 Oracle 分析。

### 4.4.2 Librarian（外部研究专家）

```
model: deepseek/deepseek-v4-flash
temperature: 0.2
steps: 30
color: "#8E44AD"      # 深紫色
hidden: true
permission:
  edit: deny           # 只读！
  write: deny
  task: deny
```

**核心职责**：Librarian 是外部知识的「检索官」——搜索官方文档和 API 参考、查找使用示例和最佳实践、研究技术/库/框架、回答「怎么用 X？」。

**与 Explore 的明确分工**：

| | Explore | Librarian |
|---|---|---|
| 搜索范围 | 本地代码库 | 互联网 / 外部文档 |
| 主要工具 | LSP、grep、glob、git log | websearch、webfetch |
| 典型问题 | "认证模块在哪里" | "React 19 有什么新特性" |
| 输出 | 文件路径 + 代码片段 | 摘要 + 源码 URL |

**信息来源优先级**：官方文档 > 知名技术博客 > 社区。始终偏好主源（官方文档、GitHub 仓库）而非二手来源。

**模型感知升级机制**：

```
When research requires deep cross-referencing or nuanced interpretation,
ask the orchestrator to escalate to consultant (v4-pro).
```

当 Librarian 发现研究任务超出自己的分析能力（需要深度交叉引用或微妙解读）时，它会主动请求 Orchestrator 升级到 Consultant（Pro 模型）。这是「能力自知」的设计——比硬着头皮给出不准确答案好得多。

**关键约束**：绝不编造 API 签名或功能——只报告实际找到的内容。如果文档不清晰或缺失，明确说明。

### 4.4.3 Light Orchestrator（轻量执行者）

```
model: deepseek/deepseek-v4-flash
temperature: 0.3
steps: 30
color: "#1ABC9C"      # 青色
```

**核心职责**：Light Orchestrator 是「快速任务的执行者」——处理简单、定义明确、低风险的任务：单文件改动、typo 修复、配置更新、小添加、简单技术问题的快速回答。

**与 Deep Worker 的分工边界**：

| 维度 | Light Orchestrator | Deep Worker |
|------|-------------------|-------------|
| 模型 | v4-flash | v4-pro |
| 文件范围 | 单文件 | 多文件 |
| 逻辑复杂度 | 简单直接 | 复杂算法/逻辑 |
| 架构影响 | 无 | 可能有 |
| 输出格式 | 极简：「Done」+ 1-2行说明 | 结构化：Summary + Changes + Verification |

**关键约束——禁止研究，禁止委托**：

```
No research, no delegation.
You have the full task context from the orchestrator.
Do not spawn subagents.
```

与 Deep Worker 相同的「禁止研究」约束，但原因略有不同：Light Orchestrator 处理的是简单任务，不应该需要研究。如果它发现自己需要研究，说明任务分类错误——应该升级到 Deep Worker。

**升级触发条件**：如果任务比预期更复杂，或涉及 2+ 个非平凡文件，立即升级到 Deep Worker（v4-pro）。「知道何时升级」和「知道何时直接完成」是 Light Orchestrator 的核心能力。

---

## 4.5 Agent 协作模式

单个 Agent 的能力是有限的，真正的力量来自它们之间的协作模式。以下是本体系中几个典型的协作链路。

### 4.5.1 Deep 任务链：Orchestrator → Planner → Deep Worker

这是最完整的深度开发链路，适用于新功能开发和大型重构：

```
用户："实现用户权限管理系统"
  │
  ▼
Orchestrator
  ├─ 意图门控："implement" → 显式开发
  ├─ 分类：deep（多文件 + 新功能）
  │
  ▼
Planner
  ├─ 探索代码库：权限现有机制、数据库模型、中间件
  ├─ 设计方案：RBAC模型、表结构、API设计、中间件
  ├─ 输出 Handoff Plan：具体文件、具体改动、步骤顺序
  │
  ▼
Deep Worker
  ├─ Phase 0: 根据 Handoff Plan 写 Todo 列表
  ├─ Step 1: 并行读取需要修改的文件
  ├─ Step 2: 逐步实施（1.model → 2.migration → 3.middleware → 4.api → 5.tests）
  ├─ Step 3: 自验证 + 测试
  └─ Step 4: 完成报告
```

**关键价值**：每个环节只做自己最擅长的事。Planner 不需要写代码，Deep Worker 不需要做设计。Handoff Plan 在两者之间传递了完整的意图和上下文，消除了猜测。

### 4.5.2 Debug 修复链：Oracle → Deep Worker

```
用户："用户登录后偶尔收不到 JWT token"
  │
  ▼
Orchestrator → Oracle（analysis类：根因分析）
  │
  ▼
Oracle
  ├─ 追踪完整认证流程：路由 → 控制器 → 服务层 → token生成 → 响应
  ├─ 发现：token生成在异步回调内，但响应在回调外提前发送
  ├─ 输出：file:line 引用 + 结论 + 修复建议 + 置信度（高）
  │
  ▼
Deep Worker
  ├─ 根据 Oracle 的诊断报告实施修复
  └─ 自验证
```

**关键价值**：Oracle 的只读约束确保了它不会在分析阶段就动手修改——它必须给出完整的诊断报告。Deep Worker 收到的是精确的修复指令而非模糊的问题描述。

### 4.5.3 审查修复循环：Reviewer → Deep Worker

```
Deep Worker 完成功能实现
  │
  ▼
Orchestrator → Reviewer（analysis类：代码审查）
  │
  ▼
Reviewer
  ├─ 通读所有变更文件
  ├─ 按维度检查：正确性、安全性、性能、可维护性
  ├─ 输出：critical: 0 | major: 2 | minor: 3 | nit: 1
  ├─ major: tokens.ts:42 — 密钥硬编码
  ├─ major: auth.ts:108 — 缺少输入验证
  │
  ▼
Deep Worker（修复 major 问题）
  │
  ▼
Reviewer（再次审查，确认问题已解决）
```

**关键价值**：审查者与实现者的角色分离是代码质量控制的基础。Deep Worker 可能在实现中产生盲点（比如忘记考虑某些边界情况），Reviewer 以独立视角捕捉这些问题。

### 4.5.4 研究模式：并行 Explore + Librarian

```
用户："这个项目的认证模块是怎么实现的？用的是什么库？"
  │
  ▼
Orchestrator
  ├─ 同时派发（并行）：
  │   ├─ Explore：搜索本地代码库中的认证相关代码
  │   └─ Librarian：搜索使用的认证库的文档和最佳实践
  │
  ▼
Explore 返回：auth/ 目录结构、中间件链路、策略模式
Librarian 返回：passport.js 文档、JWT 最佳实践、版本兼容性
  │
  ▼
Orchestrator
  └─ 综合两份报告，用 OS 语言（中文）回复用户
```

**关键价值**：并行派发将总耗时从「本地搜索时间 + 外部搜索时间」降低为「两者中较长的那个」。对于需要同时了解项目现状和外部背景的研究任务，这种并行模式是效率最优解。

### 4.5.5 决策→规划链：Consultant → Planner

```
用户："我应该用 Redis 还是 PostgreSQL 做会话存储？"
  │
  ▼
Orchestrator → Consultant（decision类）
  │
  ▼
Consultant
  ├─ 分析上下文：
  │   ├─ 当前项目已有 PostgreSQL
  │   ├─ 用户量级：< 1000 并发
  │   ├─ 需求：持久化会话 + TTL
  ├─ 推荐：PostgreSQL（减少运维复杂度，已有基础设施）
  │
  ▼
Orchestrator
  ├─ 征求意见确认
  └─ 用户确认后 → Planner
      │
      ▼
    Planner
      ├─ 设计会话存储方案
      ├─ 输出 Handoff Plan：迁移脚本、中间件修改
      └─ → Deep Worker 实施
```

**关键价值**：Consultant 不直接规划实现——它只做决策支持。一旦方向确定，Planner 接手将决策转化为可执行的计划。这种分工确保决策理由和实施方案被清晰记录，便于后续审查和回溯。

### 4.5.6 UI实现链：UI Builder → Deep Worker

```
用户："实现用户设置页面"
  │
  ▼
Orchestrator → Planner → UI Builder（visual类）
  │
  ▼
UI Builder
  ├─ 设计页面布局、组件树、响应式断点
  ├─ 构建纯前端部分：组件、样式、布局
  ├─ 发现需要新增 2 个后端 API 端点
  ├─ 升级到 Deep Worker
  │
  ▼
Deep Worker
  ├─ 实现后端 API（根据 UI Builder 定义的接口契约）
  └─ 完成报告
```

**关键价值**：UI Builder 不碰后端——它专注于界面，需要后端支持时明确升级。这避免了前端 Agent 写出的后端代码质量不足的问题。

---

## 4.6 Agent Prompt 设计原则

每个 Agent 的 prompt（`agents/*.md`）遵循一套精心设计的工程原则。理解这些原则，你就能定制自己的 Agent。

### 4.6.1 精确的角色定义

每个 Agent 的 prompt 以三段式结构定义角色：

**你是谁**：

```
# Deep Worker
You are the heavy-duty implementation agent.
You handle complex, multi-step, multi-file engineering work autonomously.
```

**你能做什么**：

```
# Oracle
- Root cause analysis on bugs and unexpected behavior
- Read and interpret code diffs and PRs
- Trace data flow and control flow across the codebase
```

**你不能做什么**：

```
# Deep Worker
No research, no delegation. Use grep/glob/read directly.
```

这种「肯定+否定」的结构比单纯的正面描述更有效——它直接消除了 AI 最常见的越界行为。当 Deep Worker 被告知「No research」时，它面对不熟悉的 API 不会自己去搜索，而是要求 Orchestrator 提供上下文。这种行为比依赖模型自觉遵守要可靠得多。

### 4.6.2 绝对的边界设定

边界定义分为两个层面：

**权限层（OpenCode 框架层面）**：

```yaml
# 只读 Agent 的 permission 配置
permission:
  edit: deny
  write: deny
  task: deny
```

这是基础设施层的硬约束——只读 Agent 无法绕过。

**行为层（Prompt 层面）**：

```
# Explore
Do NOT use me for: implementing code, debugging logic, or editing files.

# Light Orchestrator
If the task is more complex than expected or involves 2+ non-trivial files,
escalate to deep-worker immediately.
```

这是软约束——告诉 Agent 哪些行为是不被预期和接受的。软约束 + 硬约束的双层边界比单独一层可靠得多。即使 Prompt 层的约束被模型忽略（对于长上下文可能出现），权限层的强制拦截保证了最终的安全性。

### 4.6.3 模型感知的差异设计

Pro Agent 和 Flash Agent 的 Prompt 存在系统性差异：

| 维度 | Pro Agent | Flash Agent |
|------|-----------|-------------|
| **职责描述** | 强调推理、分析、决策 | 强调速度、检索、执行 |
| **自主性** | 高度自主（如 Deep Worker 完成整个任务才停止） | 有限自主（如 Explore 只返回发现，不解释含义） |
| **模型感知声明** | 通常无（本身就是最强的执行模型） | 有明确声明（如「I run on v4-flash — fast, cheap」） |
| **升级机制** | 作为升级接收方 | 内置升级触发条件（如 Librarian 请求升级到 Consultant） |
| **Temperature** | 因职责而异（0.1 ~ 0.5） | 统一偏低（0.1 ~ 0.3） |

Flash Agent 的「模型感知声明」是一个精巧的设计：

```
# Librarian
When research requires deep cross-referencing or nuanced interpretation,
ask the orchestrator to escalate to consultant (v4-pro).
```

这句话的效果是：当 Librarian 意识到「这个任务超出我的能力」时，它不会沉默地给出不准确的结果，而是主动发起升级。这种自省能力比事后补救高效得多——因为它在错误发生之前就阻止了错误。

### 4.6.4 拒绝契约（Task Rejection Contract）

`AGENTS.md` 定义了全局的任务拒绝契约，所有 Agent 都必须遵守：

任何 Agent **必须立即停止并以纯文本形式返回拒绝**（而非部分尝试），当：

- 任务超出 Agent 角色范围（只读 Agent 被要求编辑；执行 Agent 被要求研究或委托）
- 缺少必要的上下文且无法安全推断
- 任务需要更强的 Agent

拒绝格式要求：**一或两句话**——拒绝什么、为什么、正确的下一步。不道歉、不填充、不尝试降级版本。

```
# 正确拒绝示例
"Cannot implement — I'm the explore agent, read-only. 
Route this to deep-worker instead."

# 错误的拒绝（过于冗长）
"I'm sorry, but as an exploration agent, I'm not able to make changes to the codebase. 
I would recommend that you redirect this request to the deep-worker agent, 
which is specifically designed for implementation tasks..."
```

拒绝契约的工程价值：快速失败比慢速半成品更高效。一个错误的修改比一个明确的拒绝更昂贵——拒绝只需要一次重新路由，错误的修改需要发现、回滚、重新实施。

### 4.6.5 输出格式的标准化

不同 Agent 有标准化的输出格式，这确保了信息在多 Agent 间传递时的可消费性：

**Oracle 的标准化报告**：

```
**Bottom line**: [2-3句结论 + 置信度]
**Action plan**: [≤7项]
**Effort estimate**: Quick/Short/Medium/Large
```

**Planner 的 Handoff Plan**：

```
## Handoff Plan
1. [具体步骤]
...
- Risk: [风险]
- Test: [验证方式]
```

**Deep Worker 的完成报告**：

```
## Summary
[2-3句话]

## Changes
- `file:line` — [说明]

## Verification
- [验证结果]
```

**Explore 的结构化结果**：

```
## Findings
### File: /absolute/path:line
- [发现及原因]

### Summary
[直接回答]
```

标准化的输出格式减少了 Agent 之间的「翻译」需求——当 Planner 的输出格式是 Deep Worker 的预期输入格式时，信息传递几乎没有损耗。

### 4.6.6 上下文管理策略

`AGENTS.md` 定义的上下文管理规则，影响了每个 Agent 如何设计自己的 prompt 和外层交互：

1. **委托不积累**：大文件由子代理读取，不加载到 Orchestrator 上下文。
2. **引用不粘贴**：用 `src/app.ts:42` 传递位置，不传输文件内容。
3. **积极压缩**：一条研究路径结束后立即压缩，传递计划和发现而非原始探索记录。
4. **单主题每子代理**：不让一个代理同时做研究和实现。
5. **缓存感知提示**：偏好稳定的、前缀匹配的 prompt 结构，让 OpenCode 的缓存机制跨会话复用计算结果。

**在 Agent prompt 中的具体体现**：

以 Deep Worker 为例，它的 Parallel Exploration 步骤明确要求「Fire multiple reads/glob/grep simultaneously — never sequentially for independent queries。」——这直接来源于上下文管理的并行化原则。

Orchestrator 的派发纪律同样体现这些原则：「Reference paths, don't paste files」和「Delegate in parallel」直接映射为它的具体行为指令。

---

## 4.7 本章小结

本章从 10 个 Agent 的定义出发，完整拆解了这套多 Agent 体系的架构逻辑：

- **设计理念**：专业化分工、只读隔离、执行探索分离、模型感知路由——每一条都是对单 Agent 模式已知缺陷的系统性修正。
- **Orchestrator**：整个体系的中央调度器，通过意图门控和六类任务分类实现精准路由。
- **Pro Agent 群**：6 个使用 v4-pro 的 Agent 覆盖了规划、实施、分析、审查、咨询和 UI 六个关键领域。
- **Flash Agent 群**：3 个使用 v4-flash 的 Agent 承担快速的搜索、检索和简单执行任务。
- **协作模式**：Deep 任务链、Debug 修复链、审查修复循环、并行研究模式、决策规划链——定义了 Agent 间协调的具体方式。
- **Prompt 设计原则**：角色三段式、双层边界、模型感知差异、拒绝契约、标准化输出和上下文管理，构成了可复制的 Agent 设计方法论。

下一章将深入 Orchestrator 的路由机制——探讨意图门控的具体实现、任务分类的决策逻辑和后备链的容错策略。

---

> **参考资料**
> - [my-opencode-deepseek-config/agents/](https://github.com/znlgis/my-opencode-deepseek-config/tree/main/agents) — 10 个 Agent 定义文件
> - [AGENTS.md](https://github.com/znlgis/my-opencode-deepseek-config/blob/main/AGENTS.md) — 全局规则
> - [opencode.json](https://github.com/znlgis/my-opencode-deepseek-config/blob/main/opencode.json) — OpenCode 配置

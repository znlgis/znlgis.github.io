# 第五章：工作模式 Ultrawork、Prometheus 与 Atlas

oh-my-openagent（OmO）日常使用其实只有三种主线工作流：

- **Ultrawork（懒人模式）**：扔出意图，让全员上阵。
- **Prometheus（规划模式）**：先访谈、再规划，把决策都做完。
- **Atlas（执行模式）**：拿着 Prometheus 的计划逐项落地、独立验证。

理解了这三种模式怎么协作，就掌握了 OmO 90% 的使用场景。

---

## 5.1 三种模式的决策流

```
                      你要做什么？
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
   "随手小事 / 改错字"              "复杂任务"
   直接和 Sisyphus 对话                     │
                            ┌───────────────┴───────────────┐
                            ▼                               ▼
                "懒得讲清楚需求"                   "多日 / 高风险 / 关键改动"
                输入 `ulw ...` 让它自己干         先 Prometheus 规划
                                                 再 Atlas 执行
```

更精确地：

| 复杂度 | 路径 | 适用场景 |
| --- | --- | --- |
| 简单 | 直接对话 | 改错字、小补丁、单文件改动 |
| 复杂 + 懒 | `ulw` / `ultrawork` | 复杂但不想写需求文档 |
| 复杂 + 严谨 | `@plan` → `/start-work` | 多步骤、需可验证的执行、关键改动 |

下面分别展开。

---

## 5.2 Ultrawork 模式：懒人福音

### 5.2.1 触发方式

在和 Sisyphus（默认 Agent）对话时，prompt 里出现 `ultrawork` 或 `ulw` 关键词即可：

```
ulw 给登录接口加一段手机号验证码登录的流程
ultrawork 修复 CI 中所有 eslint 警告
ulw fix the failing tests
```

`keyword-detector` Hook 会嗅到这两个关键词并切换到 Ultrawork 模式：

- 启动 IntentGate；
- Sisyphus 进入"激进并行 + 永不停歇"状态；
- todo-continuation-enforcer 全程保护，不让 Agent 偷停；
- 后台 Agent（Explore / Librarian）默认开闸。

### 5.2.2 Ultrawork 的两种打开方式

**方式 A：单次 Ultrawork**

```
ulw 把 src/auth 里的所有 console.log 替换为 logger.debug
```

Sisyphus 跑一轮就停。

**方式 B：Ralph / Ultrawork Loop**

如果你想要"达不到 100% 完成绝不收工"的体验，用 `/ulw-loop`：

```
/ulw-loop "把支付模块从 PayPal 切换到 Stripe"
/ulw-loop "把这个 45k 行的 Tauri 应用改造成 SaaS Web 应用" --max-iterations=200
```

行为：

- Agent 持续工作至检测到 `<promise>DONE</promise>` 才停；
- 中途如果停了但没完成，自动续；
- 最大迭代次数默认 100，超出停；
- 用 `/cancel-ralph` 取消。

`/ralph-loop` 是同样机制但不强制 ultrawork 模式。两者都来自 Anthropic 的 Ralph Wiggum 插件灵感。

### 5.2.3 Ultrawork 的"自动 Plan 复用"

如果当前项目 `.sisyphus/plans/` 里已经有 Prometheus 计划，`ulw` 模式会**自动接上**——继续推进而不是重做。如果没有，则自主探索。

### 5.2.4 何时不用 Ultrawork

- **关键产线变更**（数据库迁移、支付链路）：建议先 Prometheus 走计划；
- **多人协作 / 需要文档留痕**：Atlas 模式输出可审计的进度；
- **真正只是改一行错字**：直接对话即可，没必要打开 ulw 这架机关枪。

---

## 5.3 Prometheus 模式：先想清楚再写

### 5.3.1 心智图

```
你           Prometheus            子 Agent
描述需求 →  访谈 →  调研代码  →   explore / librarian
            ↑                       │
            └─── 多轮往返追问 ────┘
                  ↓
            可放行检查 ✓
                  ↓
            调用 Metis 做缺口分析
                  ↓
            写计划 .sisyphus/plans/{name}.md
                  ↓
            (可选) 高准确度 → Momus 严审
                  ↓
            交付计划，提示 /start-work
```

### 5.3.2 进入 Prometheus 的两种姿势

**姿势 1：Tab → 选 Prometheus**

适合"我刚开新会话、就是来规划的"。心智干净。

**姿势 2：在 Sisyphus 里 `@plan "..."`**

适合"已经在干活，半路想插一个计划"。无须切 Agent，仍触发 Prometheus 流程。

| 场景 | 推荐方式 |
| --- | --- |
| 新会话、专心规划 | Tab → Prometheus |
| 干一半要规划 | `@plan` |
| 想要清晰的"规划态/执行态"切换 | Tab → Prometheus |
| 最快路径 | `@plan` |

两条路最终都走同一个 Prometheus 流程。

### 5.3.3 访谈过程中要做什么

Prometheus 会按你的"意图类型"调整提问风格：

| Intent | 关注点 | 典型提问 |
| --- | --- | --- |
| 重构 | 安全 - 行为不变 | "什么测试验证当前行为？" "回滚方案？" |
| 从零搭建 | 发现 - 模式优先 | "代码库里发现模式 X，跟还是偏？" |
| 中等任务 | 边界 - 精确护栏 | "什么必须不在内？硬约束是？" |
| 架构 | 战略 - 长期影响 | "预期寿命？规模？" |

### 5.3.4 Prometheus 的硬约束

- 它是 **READ-ONLY** 的，只能在 `.sisyphus/` 下创建/修改 Markdown 文件，不能写任何代码（受 `prometheus-md-only` Hook 强制）；
- 它会 **强制调用 Metis** 做一遍缺口分析；
- 你说"开启高准确度"时，它会进 Momus Loop，**直到 OKAY**。

### 5.3.5 计划完成后

Prometheus 会：

1. 把计划落到 `.sisyphus/plans/{name}.md`；
2. 提示你 `/start-work` 开始执行。

至此，规划阶段结束。

---

## 5.4 Atlas 模式：让计划落地

### 5.4.1 启动方式

```
/start-work
```

或指定计划名（多 plan 场景）：

```
/start-work refactor-auth
```

### 5.4.2 `/start-work` 的两条分支

```
检查 .sisyphus/boulder.json
    │
    ├─ 存在 → RESUME 模式
    │   - 读取已有 boulder 状态
    │   - 计算进度（已勾 / 未勾 todo）
    │   - 注入续作提示，让 Atlas 从未完成处继续
    │
    └─ 不存在 → INIT 模式
        - 找 .sisyphus/plans/ 中最新计划
        - 创建 boulder.json
        - 切换会话 Agent 为 Atlas
        - 从 task 1 开始
```

### 5.4.3 Atlas 的执行循环

```mermaid
flowchart LR
    Read[1. 读计划] --> Analyze[2. 分析任务]
    Analyze --> Wisdom[3. 累积智慧]
    Wisdom --> Delegate[4. 委派任务]
    Delegate --> Verify[5. 验证结果]
    Verify -->|更多任务| Delegate
    Verify -->|全部完成| Report[6. 终报]

    Delegate -->|task() / call_omo_agent()| Workers[Sisyphus-Junior / Oracle / Explore / Librarian / 视觉]
    Workers -->|结果 + Learnings| Verify
```

Atlas 自己不写代码，所有的"写"都被强制委派给子 Agent。这种"指挥与执行隔离"是 OmO 区别于普通 Agent 框架的核心做法。

### 5.4.4 Wisdom Accumulation：经验滚雪球

每次 Junior 跑完，Atlas 把回应中可提取的经验分类到：

- **Conventions**：项目里的既定模式；
- **Successes**：成功做法；
- **Failures**：失败和原因；
- **Gotchas**：意外的坑；
- **Commands**：可复用的具体命令。

这些经验会被传递给所有后续 Junior，**第二个任务开始就比第一个聪明**。

笔记本默认目录：

```
.sisyphus/notepads/{plan-name}/
├── learnings.md
├── decisions.md
├── issues.md
├── verification.md
└── problems.md
```

### 5.4.5 会话连续性

Boulder.json 跟踪：

- `active_plan`：当前计划路径；
- `session_ids`：所有为这份计划工作过的会话；
- `started_at`：开工时间；
- `plan_name`：人类可读名字。

举个真实时间线：

```
周一 9:00
└─ @plan "构建用户认证"
└─ Prometheus 访谈生成计划
└─ /start-work
└─ Atlas 开干，建立 boulder.json
└─ 完成 task 1，task 2 进行中
└─ [机器崩溃 / 你下班]

周一 14:00（新会话）
└─ 默认进入 Sisyphus
└─ /start-work
└─ start-work Hook 读 boulder.json
└─ "Resuming 'Build user authentication' - 3 of 8 tasks complete"
└─ Atlas 继续 task 3，上下文一点没丢
```

### 5.4.6 Atlas 的硬约束

- **不能直接写文件 / 改代码 / 修 Bug / 写测试 / Git 提交**——必须通过 Junior 委派；
- 自己只能 read / 跑命令 / lsp_diagnostics / grep / glob / ast-grep；
- 受 Hook 阻止 task / call_omo_agent 之外的写操作。

### 5.4.7 中途叫停 / 切换

- **`/stop-continuation`**：停掉本会话所有的"持续机制"——Ralph Loop、todo continuation、boulder。当你只想让 Atlas 暂停一下：用这个。
- **`exit`**：退出本会话进入新会话，下次再 `/start-work` 续作。
- **手动改 boulder.json**：在多 plan 切换时，删掉 `.sisyphus/boulder.json` 让 `/start-work` 重新选最新计划。

### 5.4.8 `/handoff` 命令：把上下文移交

如果你要换台机器或换会话继续：

```
/handoff
```

它会生成一份结构化的 handoff 文档，包括：当前状态、已做、未做、相关文件路径。把这份文档发到新会话开头，几乎可以无缝接上。

---

## 5.5 三种模式的对比

| 维度 | Ultrawork | Prometheus + Atlas | Hephaestus |
| --- | --- | --- | --- |
| 计划 | 内部 todo + 自主探索 | 外显 Markdown 计划 | 边做边自规划 |
| 委派 | Category + 直接 subagent | Atlas 严格委派 | 自己 explore/librarian |
| 模型 | Sisyphus 默认链 | Prometheus + Atlas 双链 | GPT-5.4 only |
| 适合 | 通用复杂任务 | 多日 / 关键改动 | 深架构 / 跨域硬骨头 |
| 续作 | 中等（todo 累积） | 强（boulder.json + notepad） | 弱（自走流） |
| 验证 | lsp + 测试 + Hook | 同左 + Atlas 独立验证 + Momus | lsp + 测试 |

实战经验：

- **80% 的任务**用 Ultrawork；
- **15% 的任务**（多日工程、关键变更、跨多模块重构）用 Prometheus + Atlas；
- **5% 的任务**（特别想用 GPT-5.4 推理风格）用 Hephaestus。

---

## 5.6 实战示例

### 5.6.1 改一行错字

```
README.md 第 12 行打字错了：把 "intall" 改成 "install"
```

直接对话就好。

### 5.6.2 实现一个新接口（懒人）

```
ulw 在 services/auth.ts 加一个 sendOtp(phone) 方法，调用 Twilio Verify API；带超时 / 重试；用现有 logger，写单测
```

Sisyphus 会自己：

1. 用 Explore 找现有 service 模式；
2. 用 Librarian 查 Twilio Verify 文档；
3. 让 Junior 在 deep 类别下实现；
4. 让 Junior 在 unspecified-low 写测试；
5. 跑 lsp_diagnostics 验证；
6. comment-checker 检查注释清洁。

### 5.6.3 实现一个新功能（严谨流）

```
（Tab 切到 Prometheus）
我想实现"邀请用户加入工作区"的功能：邮件 + 链接，链接 7 天有效，必须支持取消邀请
```

Prometheus 访谈：

- "你的会员表里 invite 是字段还是独立表？"
- "邀请取消后，已经使用的邀请要不要 revoke？"
- "需要支持批量邀请吗？"
- ……

访谈 → Metis 缺口 → 计划落到 `.sisyphus/plans/invite-users.md` → 你审 → `/start-work` → Atlas 派 Junior 一项项做。

### 5.6.4 长链条架构改造

```
（Tab 切 Hephaestus）
把 src/store 从 MobX 迁到 Zustand，不破坏任何现有组件
```

Hephaestus（GPT-5.4 medium）会自主探索每个 store 的引用、生成迁移策略、跨多文件改写——你只用看产出。

---

## 5.7 工作模式中的常见疑问

### Q1：我切到 Prometheus，但它什么都没做？

Prometheus 默认进入访谈模式。**你必须先描述需求**，它会反问你。访谈达到放行标准后，告诉它"make it a plan"，它就会落盘。

### Q2：`/start-work` 报 "no active plan found"？

可能是：

- `.sisyphus/plans/` 是空 → 让 Prometheus 先建一个；
- boulder.json 指向已删除的旧计划 → 删 `.sisyphus/boulder.json` 重试。

### Q3：我手动切到 Atlas，但发现没法操作？

Atlas 主要通过 `/start-work` 进入。你不需要手动切 Atlas——`/start-work` 会自动激活。

### Q4：`@plan` 和切到 Prometheus 有啥区别？

**功能上没区别**。`@plan` 是便捷命令，在 Sisyphus 里直接调起 Prometheus 流程；切 Agent 是显式切换。哪个顺手用哪个。

### Q5：用 Hephaestus 还是 `ulw`？

绝大多数情况用 `ulw`。只有当你**就是要 GPT-5.4** 那种深度推理风格 / AmpCode 深度模式体验时切到 Hephaestus。

### Q6：Ultrawork 和 Ralph Loop 怎么选？

- **`ulw 一次性任务`**：跑一轮就停；
- **`/ulw-loop "..."`**：直到打出 `<promise>DONE</promise>` 才停，多用于"通宵改造"场景。

### Q7：Atlas 会不会自己写代码？

不会。Atlas 被 Hook 强制只能"读 + 委派"，所有写操作必须通过 Junior。

### Q8：boulder.json 有什么用？

它是 Atlas 的"工作锚点"——当前在哪个 plan、当前进度、哪些 session 参与过。删除它就等于"放弃当前 plan，开新一轮"。

---

## 5.8 三种模式的极简记忆

- **Ultrawork**：`ulw <description>` ── 一句话扔出去，Sisyphus 全员上阵。
- **Prometheus**：`@plan "..."` 或 Tab → Prometheus ── 访谈 + 计划文档。
- **Atlas**：`/start-work` ── 拿计划落地，永不丢上下文。

下一章我们将进入 **Category 与 Skill 系统**——理解 OmO 是怎么把"模型 + 工具 + 领域知识"打包成一个可重用单元的。

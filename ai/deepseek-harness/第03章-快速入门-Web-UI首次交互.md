---
layout: default
title: 第03章：快速入门：Web UI 首次交互
---

# 第03章：快速入门：Web UI 首次交互

本章带你在 DeepSeek Harness（CLI 名为 `dsh`）的 Web UI 里完成第一次真正意义的交互：启动服务、配置模型、选择工作目录、跑通一个任务，并借此建立对 agent 能力边界与权限审批机制的直觉。读完本章，你会知道一个 `dsh` session 从空工作区到完成任务，底层发生了什么。

具体你会掌握：

- 如何启动 Web UI，以及默认地址 `http://127.0.0.1:3080` 的含义；
- 首次使用为什么必须"先配模型、再选 workspace"；
- session composer 在没选 workspace 时为什么是禁用的；
- agent 默认能做什么、不能做什么；
- 权限审批（approval）与沙箱（sandbox）两轴是怎么配合的；
- API key 存到哪里、为什么界面上读不回原文。

> **前置要求**：已完成[第二章：安装与环境配置](https://znlgis.github.io/ai/deepseek-harness/第02章-安装与环境配置/)中的 Node.js 安装。Web UI 是 `dsh` 最直接的交互入口，本章所有操作都在浏览器里完成。

> **破坏性变更警告**：DeepSeek Harness 目前处于 _developer preview_ 阶段，迭代很快。官方在 [README](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md) 中明确声明 **THERE WILL BE COMPATIBILITY-BREAKING CHANGES**（会有破坏兼容性的变更）。本章描述的界面文案与字段名以 master 分支为准，未来可能调整。对不上界面时，先看仓库最新的 [Web UI 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md)。

## 3.1 启动 Web UI

启动命令只有一条：

```sh
npx @deepseek-ai/dsh web
```

`npx` 会临时拉取并运行 npm 上的 `@deepseek-ai/dsh` 包，无需全局安装。命令做的事情是启动 Web UI 服务，默认监听 `http://127.0.0.1:3080`，并**在命令行里打印实际的 URL**——如果端口被占用或被配置改过，以打印出来的那个地址为准。

| 事实 | 说明 |
|------|------|
| 默认地址 | `http://127.0.0.1:3080` |
| 地址来源 | 命令行打印为准，不要凭记忆猜 |
| 默认文件系统位置 | `dsh` 进程的启动目录（invoking directory） |
| 新 Web UI 的 workspace | **尚未选择**，需要手动添加 |

第二行和第四行是理解本章后续内容的关键。官方指南的措辞是：`dsh` 进程把启动它的目录当作默认文件系统位置，但一个全新的 Web UI 在你添加 workspace 之前**没有已选 workspace**。也就是说，`npx @deepseek-ai/dsh web` 在哪里执行，决定了 agent 默认的工作目录锚点，但真正生效的 workspace 仍要你在界面里显式选择。

### 3.1.1 为什么默认绑 127.0.0.1

默认地址里的 `127.0.0.1` 不是随意选的：它把服务绑在回环地址上，只对本机开放。要让它监听非回环地址（如 `0.0.0.0` 供局域网访问），属于部署级配置，且必须显式声明对外服务的主机名（`trustedHosts`），否则 `/api` 的信任围栏会拒绝来自非回环 Host 的请求。对首次体验来说，保持默认的纯本机绑定是最安全的选择。

### 3.1.2 从源码运行（可选）

想跑最新代码而非 npm 发布版，可以从仓库检出：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

两条路径得到的是同一个 Web UI。日常使用 `npx` 足够；源码方式适合想跟进 master 或二次开发的人。

打开浏览器访问打印的 URL，你会看到 Web UI 首页。此时还不能直接发任务——界面上缺两样东西：模型配置、已选 workspace。3.2 到 3.5 就是补齐它们并跑通任务的过程。

### 3.1.3 本章术语速查

后面会反复出现几个词，先统一认识：

| 术语 | 含义 |
|------|------|
| `dsh` | DeepSeek Harness 的 CLI 名 |
| session | 一次对话/任务的持久化上下文单元，本章第 3 步建立 |
| workspace | agent 的文件系统根与命令 cwd，本章第 2 步选择 |
| composer | 输入任务的地方；未选 workspace 时禁用 |
| 凭据（credential） | API key 等密钥，存 `$DSH_HOME/.credentials.yaml` |
| 路由（route） | 模型供应商的命名入口，如 `deepseek-official` |

这些词在后续章节（尤其第四章）会高频出现，读到这里先有个印象即可。

## 3.2 三步上手：配置模型、选择 workspace、开 session

首次使用按顺序做三件事，顺序重要：

| 步骤 | 操作 | 目的 |
|------|------|------|
| 1 | **Settings → Models** 填入 DeepSeek API key | 让 agent 有模型可用 |
| 2 | **Choose workspace** 选择项目目录 | 给 agent 一个文件系统边界 |
| 3 | 开一个 session 发任务 | 真正开始干活 |

前两步分别对应"模型配置"与"工作区选择"两个前置条件，缺一不可：

```text
启动 Web UI
   │
   ├─ 无模型 → composer 有 workspace 也没法回话
   │
   └─ 无 workspace → composer 直接不可用（见 3.4）
```

第 3 步建立的 session 是 `dsh` 的核心交互单元——你的每一次任务都发生在一个 session 里，session 会记住上下文、模型选择与权限状态。

### 3.2.1 Web UI 只是入口之一

值得先建立这个认知：Web UI 是 `dsh` 的图形入口，但不是唯一入口。同一个 harness 还有命令行模式（第五章）、Python SDK（第六章）、ACP 自动化接入（第七章）。它们共享同一套模型配置与 session 机制——你在 Web UI 里配的模型，CLI 和 SDK 一样能用。所以本章学的"配置模型、选 workspace、开 session"是横跨所有入口的通用技能，不是 Web UI 特有的操作。

下面 3.3、3.4、3.5 逐一展开这三步；3.6 到 3.10 再解释背后的能力边界、权限机制与存储细节。

## 3.3 配置模型：填入 DeepSeek API key

打开 **Settings → Models**，看到 DeepSeek 官方卡片。它只暴露一个字段：API key。填入从 [DeepSeek 开放平台](https://platform.deepseek.com/)申请的 key 并保存。

```sh
# 仅示意格式，不要当真 key 抄
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

保存后，这条模型路由**立即生效**，不需要重启 server。这是 `dsh` 模型配置的核心体验之一：改配置走热更新，下一次请求就用新值。

### 3.3.1 不填 UI，用环境变量也行

Web UI 的 key 输入框背后是一个凭据引用。`dsh` 的 DeepSeek 适配器默认引用环境变量 `DEEPSEEK_API_KEY`，所以你也可以完全跳过 UI：

```sh
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
npx @deepseek-ai/dsh web
```

凭据解析的次序是：先走凭据层（`ctx.credentials`，即 `.credentials.yaml`），再落到受信任的环境变量层。两种方式二选一即可，效果一致。

### 3.3.2 首次运行的两个错误码

第一次用最容易撞两个错误码，先认识它们：

| 错误码 | 含义 | 处理 |
|--------|------|------|
| `MISSING_CREDENTIAL` | 任何入口都找不到 key | 存 key 或导出环境变量 |
| `INVALID_CREDENTIAL` | 解析到的 key 格式非法，无法放进 HTTP 头 | 换正确的 key |

`dsh` 对每次解析出的 key 做格式校验：一个任何 HTTP 头都带不上的值，会被拒绝并**点名出错的入口**（绝不回显 key 的任何部分），而不是变成一次含糊的 `fetch` 异常。

一个贴心的设计：没有 key 时，路由**仍然注册、模型目录仍然可浏览**。所以首次上手的顺序可以是"先浏览模型 → 存 key → 再提问"，中间无需重启。这正好呼应了"配置热更新"这个贯穿全章的主题。

### 3.3.3 官方卡片背后是哪些模型

DeepSeek 官方卡片对应的是内置适配器 `llm-deepseek`。它默认暴露两个模型：`deepseek-v4-flash`（DeepSeek-V4-Flash）与 `deepseek-v4-pro`（DeepSeek-V4-Pro），各约 100 万 token 的上下文窗口。存完 key 后，模型选择器里就能看到这两个模型，直接选一个开始用。适配器的完整配置（思考档位、`baseURL` 覆盖、上下文兜底、错误码）在第四章 4.8 展开，这里只需知道"存 key → 出模型"这一步就够了。

## 3.4 选择 workspace：session composer 为何不可用

点击 **Choose workspace**，添加你启动 `dsh` 的项目目录，然后选中它。

官方指南有一句明确的话：**在选中 workspace 之前，session composer 保持不可用**（remains unavailable）。为什么要这样设计？原因落在 workspace 的双重角色上：

1. **它是 agent 的文件系统边界**。agent 要读文件、改文件，必须知道"哪些路径是它能碰的"。`dsh` 的进程沙箱（sandbox）用 session 的 cwd 作为 workspace 根，`workspace-write` 这一沙箱模式允许写的范围正是"workspace 根目录之内"。没有 workspace，就没有这个边界。
2. **它是命令执行的工作目录**。agent 跑 shell 命令时，`bash` 工具的 cwd 从这个 workspace 派生。

更准确地说，`dsh` 的沙箱策略服务（`ctx.sandboxPolicy`）对每一次工具调用解析"写边界"，而这个边界来自调用 session 的不可变 cwd——即你选的 workspace。见 [sandbox 子系统文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/sandbox.md)：

> Normal tool calls derive `workspaceRoot` from the calling session's immutable cwd.

所以"未选 workspace 就禁用 composer"不是产品上的任性，而是结构性约束：一个既能读文件又能执行命令的 agent，必须有一个明确的根目录锚点，否则每一步操作都无从解析。选中 workspace 之后，composer 解锁，你才能输入任务。

**选哪个目录**：官方建议选你启动 `dsh` 时所在的项目目录。这个目录决定了 agent 能读写与执行命令的范围边界，所以选的时候想清楚——是只想让它看某个子目录，还是整个仓库。

### 3.4.1 选 workspace 还顺带加载了指令文件

选中 workspace 不只是"给个根目录"。`dsh` 会自动加载项目里的指令文件——`AGENTS.md` / `CLAUDE.md` 这类协作约定——作为 agent 的上下文。这由 `dsh-agent-instructions` 插件负责：它从 session cwd 向上走，按 `projectRootMarkers` 识别项目根，加载沿途存在的指令文件，内容进入模型可见的上下文。

换句话说，workspace 提供了三样东西：文件系统边界、命令 cwd、以及项目自带的约定（如果仓库作者写了 `AGENTS.md`）。这就是为什么"选对目录"比看起来更重要——选错目录，agent 既看不到正确的文件，也读不到项目约定。

## 3.5 第一个任务：让 agent 读懂仓库

开一个 session，发送官方指南建议的第一个任务：

```text
Summarize this repository and identify its main packages.
```

（总结这个仓库，并指出它的主要包。）

如果 workspace 选的是一个 monorepo 项目（例如 deepseek-harness 源码本身），agent 会执行一次完整的探索。你可以观察到它逐步行动，而不是凭空回答：

1. 读目录结构，定位 `package.json` / workspace 配置；
2. 识别主要 package（按名字、依赖关系、用途归类）；
3. 把发现组织成一段总结。

把上面的步骤落到工具调用层面，大致是这样一段序列：

| 阶段 | agent 的动作 | 你看到的效果 |
|------|-------------|-------------|
| 探索 | 列目录、读 `package.json` / workspace 清单 | 工具调用与输出逐条显示 |
| 归纳 | 按依赖与用途归类 package | 出现结构化的中间结论 |
| 输出 | 组织成总结回复 | 一段可读的仓库概览 |

这个"先探后答"的过程在界面里是透明的——你能看到它每一步调用了什么工具、读到了什么、命令输出是什么。选择这个任务作为"第一问"是有意的：它把 agent 的几项基本能力都压了一遍——读文件、执行命令、理解结构、组织输出。下一节就展开这些能力的边界。

## 3.6 agent 的默认能力边界

一个开箱即用的 `dsh` agent 默认能做四件事，官方指南的原话是：

> The agent can read and edit workspace files, run commands, delegate work, and maintain a plan.

| 能力 | 含义 | 举例 |
|------|------|------|
| 读/改 workspace 文件 | 在 workspace 边界内读取与修改文件 | 看源码、编辑代码、改配置 |
| 执行命令 | 通过 shell 工具运行命令 | `ls`、`git`、构建脚本 |
| 委派子任务 | 把工作拆给子 agent | 并行处理多个子问题 |
| 维护 plan | 跟踪任务计划与进度 | 多步任务逐步推进并更新计划 |

### 3.6.1 读写文件的边界

注意限定词 "workspace"：读写都被限制在 workspace 边界内，这就是 3.4 里沙箱 `workspace-write` 模式的体现。写工作区外的文件不是默认能力——那是越界，需要权限策略放行（见 3.7）。

### 3.6.2 执行命令的边界

agent 通过 shell 工具执行命令，命令在 workspace 派生的 cwd 下运行。命令能碰的文件范围同样受沙箱模式约束：`workspace-write` 下，命令只能写 workspace 内与临时目录。

### 3.6.3 委派子任务

"delegate work" 意味着 agent 可以把一个大任务拆成子任务，交给子 agent 并行推进。这是处理大仓库、多文件任务时的关键能力——不必串行地一个文件一个文件看。

### 3.6.4 维护 plan

"maintain a plan" 指 agent 维护一份任务计划，多步任务中持续更新进度。这让你能随时看到"它打算怎么做、做到哪了"。

### 3.6.5 能力是可配置的

这四项是**默认组合**提供的能力，不是硬编码。agent 挂载哪些工具由 composition（插件组合）决定，插件体系允许增删工具、加子 agent、改沙箱模式。这部分在第八、十二章展开。这里先记住：默认能力 = 默认组合的产物，边界可以移动。

### 3.6.6 透明执行与自动标题

两个易被忽略但很实用的默认行为：

1. **执行透明**：agent 的每一步工具调用、命令输出、文件读写都在 session 里可见，你可以随时打断或纠正。它不会"在后台默默改完再汇报"。
2. **自动标题**：session 会生成一个标题。`dsh` 用一次独立的"标题"用途请求来生成标题——这个请求会强制关闭思考（`purpose: 'session-title'`），把有限的输出留给可见的标题文字，不影响对话与压缩的默认值。

## 3.7 权限策略初体验：审批询问机制

当 agent 要执行一个被当前权限策略判定为需要审批的操作时，Web UI 会**在操作执行前弹出询问**。官方指南的措辞是：

> The Web UI asks before operations that require approval under the active permission policy.

理解这套机制要分清两个正交的轴，它们分别由不同的插件负责：

| 轴 | 控制什么 | 取值 | 来源插件 |
|------|----------|------|----------|
| **sandbox mode** | 进程的文件效果边界（只约束文件系统） | `read-only` / `workspace-write` / `danger-full-access` | `dsh-sandbox` + `dsh-sandbox-policy` |
| **approval policy** | 是否需要交互审批 | `ask` / `never` | `dsh-user-approval` |

### 3.7.1 沙箱模式：管"能写到哪"

`SandboxMode` 只治理文件效果，不涉及网络与进程可见性：

| 模式 | 行为 |
|------|------|
| `read-only` | 只读，拒绝写入（仅放行必要的 sink，如 `/dev/null`） |
| `workspace-write` | 允许在 workspace 根目录与后端承诺的临时目录内写入 |
| `danger-full-access` | 绕过所有限制 |

沙箱的执行是"报告出来的事实"而非绝对承诺：`full` 表示后端治理了模式承诺的全部文件效果；`partial` 表示某些后端（老内核 ABI、Windows ACL 跑者的 Everyone/硬链接边界）只治理子集。这是 `dsh` 的诚实设计——做不到的边界会如实上报，而不是假装安全。

### 3.7.2 审批策略：管"要不要问你"

`ApprovalPolicy` 决定一次审批请求在到达任何交互式回答者之前怎么处理：

| 策略 | 行为 |
|------|------|
| `ask`（默认） | 委托给组合进来的回答者；Web UI 就是那个交互式回答者，所以你会看到弹窗。没有回答者时，链式回退到 fail-closed 的 `unavailable` |
| `never` | 从不询问任何人，每个审批请求都确定性地解析为 `rejected`。CI / 无人值守的严格无头立场 |

### 3.7.3 权限预设：把两轴绑成一个直觉选择

这两轴通过**权限预设（permission preset）**打包成用户可理解的选择。默认预设表里有两个条目（见 [config-catalog](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/config-catalog.md) 中 `dsh-permission-presets`）：

| 预设名 | sandbox | approval | 效果 |
|--------|---------|----------|------|
| `workspace-write` | `workspace-write` | `ask` | 写限制在 workspace 内，敏感操作弹窗询问 |
| `danger-full-access` | `danger-full-access` | `never` | 全权限、不询问，自主模式 |

`custom` 这个预设名是保留的，用于"不是任一预设"的派生状态——一旦你改了某个 knob 偏离了预设，系统把它视为 `custom`，而不是硬塞进最近的一个预设名。

初体验阶段你大概率落在 `workspace-write` + `ask` 上：agent 在 workspace 内正常读改文件，一旦触及需要审批的动作，浏览器会停下来问你，你批准后它才继续。

一个具体的初体验场景：你在 `workspace-write` 预设下让 agent "帮我整理项目文档"，它会读写 workspace 内的文件、跑 `git status` 这类只读命令，全程顺畅；一旦它想写 workspace 之外的文件、或执行一个被判定为需要审批的敏感命令，浏览器会弹出审批框，你点允许后它才继续。这就是 `ask` 策略在起作用——审批是逐次、显式的，而不是一次性放行。

### 3.7.4 第二条交互通道：agent 主动提问

除了审批弹窗，agent 还能通过模型可调用的"问用户"工具（`dsh-tool-ask-user`，依赖 `userQuestions` seam）在任务中途主动向你提问。这两条通道都属于 interaction 插件家族，但语义不同：审批是"我要做一件敏感操作，允许吗"，提问是"我需要你补一个信息，是什么"。

一句话概括整个机制：**sandbox 决定"能写到哪"，approval 决定"要不要问你"，预设把它们绑成一个直觉上可理解的整体**。

## 3.8 API key 是 write-only 的

回到 3.3 填的那个 key。它的存储设计值得单独讲清楚，因为这关系到你的密钥安全：

| 事实 | 说明 |
|------|------|
| 回显 | 保存后页面只回显**脱敏描述符**，永远不会回显字面密钥 |
| 存储位置 | `$DSH_HOME/.credentials.yaml` |
| settings 里存什么 | 只存对该凭据的**引用**，不含密钥本体 |
| 权限 | 凭据文件以 owner-only 权限写入 |

所以流程是：你在 Web UI 里贴入 key → key 落盘到 `.credentials.yaml` → `settings.yaml` 只记一个凭据引用 → 页面回显一个脱敏描述符。这带来两个直接后果：

1. **key 一旦保存，界面就"读不回"原文了**。想换 key 就重新贴一个新的，覆盖旧的。
2. **凭据与配置分离**。`settings.yaml` 可以自由提交、备份、传给同事，因为它不含密钥；真正敏感的只有 `.credentials.yaml` 一个文件，且被 owner-only 权限保护。

这套 write-only + 凭据引用的设计贯穿整个 `dsh` 的模型配置体系，第四章会反复遇到它——目录供应商、自定义端点，全部沿用同一套凭据层。

底层机制上，`settings.yaml` 里只写 `apiKeyEnv`（一个引用名），绝不写密钥字面值。取值时引用先经凭据层（`.credentials.yaml`）解析，没有挂载凭据层时再落到受信任的环境变量层。这个"配置只存引用、密钥走凭据 seam"的分层，是"凭据与配置分离"的技术根源，也是你在第四章自定义供应商时会反复看到 `apiKeyEnv` 这个名字的原因。

## 3.9 换模型无需重启

配置模型后你会频繁做一件事：在模型选择器里切换模型。`dsh` 的规则是：**模型变更在下一次请求生效，不需要重启 server**。

这句话有三层含义：

1. 切模型后，直接发下一条消息即可，当前 session 不用关、server 不用动。
2. 生效点是"下一次请求"——已经发出去、正在跑的请求不受影响。
3. 它和 3.3 里"保存 key 立即生效"是同一条机制：模型与凭据的事实都通过热更新通道读取，而非在启动时冻结。

底层实现上，适配器通过一个 thunk（惰性取值函数）**每次操作重读一次**连接事实：base URL、目录、请求默认值、空闲预算都在下次请求生效，而一个正在飞行的流保持它启动时的事实不变。所以"热更新"的粒度是"每次操作"，不是"每次心跳"。

### 3.9.1 为什么能热更新

能"下次请求生效"的底层原因，是适配器不把连接事实冻结在启动时。它注册一个 settings 命名空间，用户 settings 文档里的同名段可以无重启覆盖任意字段；连接事实通过一个 thunk 每次操作重读。所以：

- 一个正在飞行的流，保持它启动时读到的那些事实；
- 一个新请求，读到的是最新的快照。

这也是为什么第四章里你能直接改 `$DSH_HOME/settings.yaml` 来覆盖适配器配置——机制和 UI 保存是同一条通道，都汇入 settings seam。

不过"换模型"有一个容易被忽略的语义细节：**选择模型 = 把该模型设为新 session 的默认值**，而一个已经发过请求的 session 会锁定它自己的模型（记录在 session 的 log 里）。这属于第四章 4.9 的内容，这里先记住"下次请求生效"就够了。

## 3.10 session 列表、历史与 log 预告

Web UI 里你能看到 session 列表与历史——每个 session 是一条独立的对话记录，可以切回去继续、也可以新开一个。这些 session 不是只存在内存里：`dsh` 把每个 session 的完整过程持久化成 **session log**。

session log 是贯穿后续章节的重要概念，这里先给一句话预告：它是 session 的**持久化记录**，包含这个 session 选过的模型、发过的请求、走过的 agent 循环等事实。前面已经埋了它的两个伏笔：

1. "已发请求的 session 锁定其模型"——模型名写进了 session log；
2. 排障时"已附图片会留在 session log 里导致请求重复"——失败的请求状态被持久化了。

这两个行为的机制都来自同一份 log。完整语义（JSONL 后端、`request/header`、agent 循环、模型如何被锁定）在[第十章：核心运行时：Session 日志与 Agent 循环](https://znlgis.github.io/ai/deepseek-harness/第10章-核心运行时-Session日志与Agent循环/)详讲。

## 3.11 本章小结

- `npx @deepseek-ai/dsh web` 启动 Web UI，默认 `http://127.0.0.1:3080`，实际地址以命令行打印为准；默认只绑回环地址。
- 首次使用三步：Settings → Models 填 DeepSeek API key；Choose workspace 选项目目录；开 session 发任务。
- key 也可以走环境变量 `DEEPSEEK_API_KEY`；无 key 时路由仍可浏览，补 key 后无需重启。
- 未选 workspace 时 session composer 不可用，因为 workspace 是 agent 的文件系统边界（沙箱 `workspace-write` 的根）与命令执行的工作目录。
- 第一个任务建议 `Summarize this repository and identify its main packages.`，一次压测读文件、执行命令、理解结构、组织输出。
- agent 默认能力：读/改 workspace 文件、执行命令、委派子任务、维护 plan，且读写被限制在 workspace 边界内；能力是默认组合的产物，可配置。
- 权限机制分两轴：sandbox mode 管文件效果边界，approval policy 管是否询问；默认预设 `workspace-write`（沙箱 + `ask`）会弹窗审批，`danger-full-access`（沙箱 + `never`）是自主模式。
- API key 是 write-only：保存后只回显脱敏描述符，存 `$DSH_HOME/.credentials.yaml`（owner-only），settings 只存凭据引用。
- 换模型无需重启，下次请求生效（适配器每次操作重读连接事实）。
- 每个 session 有列表与历史，持久化为 session log，其完整语义见第十章。

> 下一步：[第四章：模型配置与供应商体系](https://znlgis.github.io/ai/deepseek-harness/第04章-模型配置与供应商体系/)深入配置自定义端点、视觉模型与排障。

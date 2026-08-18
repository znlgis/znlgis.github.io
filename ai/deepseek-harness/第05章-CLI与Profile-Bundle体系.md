---
layout: default
title: 第05章：CLI 与 Profile / Bundle 体系
---

# 第05章：CLI 与 Profile / Bundle 体系

第三章用 Web UI 完成了首次交互，第四章摸清了模型配置与供应商体系。但模型只是插件树里的一层——真正决定"这套 agent 长什么样"的，是哪些插件被挂载、按什么顺序、用什么参数。本章落地到这套组合体系的命令行入口：`dsh`。`dsh` 的定位不是"又一个 agent 命令"，而是一个 **profile 启动器**——它把一组插件 bundle 的 patch 层按顺序叠起来，最后叠上你自己的覆盖层，得到一套真正生效的 agent 配置。理解 profile 与 bundle 的分层模型，是后面所有实战（web、headless、自定义插件）的前提。

> 写作依据：本章所有命令、flag、层级语义均以 master 分支 [apps/cli/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md) 与 [apps/cli/reference/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md) 为准。项目处于 developer preview，命令语法与层级规则仍可能发生破坏性变更。

## 5.1 dsh 是什么：一个 profile 启动器

`dsh` 命令本身几乎不含业务逻辑。它只做两件事，分别由两个源文件负责：

| 文件 | 职责 |
|---|---|
| `apps/cli/src/args.ts` | 拥有命令行**语法**：解析 launcher 自己认识的 flag，产出三种调用形态（boot / dump / plugin） |
| `apps/cli/src/bin.ts` | 只**动态加载被选中的 runner**，其余什么都不做 |

从 `args.ts` 的返回类型能直接看到三种模式（[src/args.ts](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/src/args.ts)）：

- `mode: 'profile'` —— 启动某个 profile，把剩余参数交给它
- `mode: 'dump-config'` —— 打印组合配置树，不启动
- `mode: 'plugin'` —— 把参数转发给 profile 目录里的 pnpm，管理插件

这个设计的意义在于**瘦启动器**：`dsh` 不预设任何 agent 行为，web、headless、tui 等形态只是不同 profile 的不同组合。为什么要做成这样而不是一个大而全的命令？因为 harness 的一切行为都是插件拼出来的，任何固定的命令行都迟早装不下。启动器只认"启哪个 profile、加哪些 overlay、要不要 dump"，剩下的交给被启动的树自己去解释——这让新形态（比如社区做的 tui profile）无需改动 `dsh` 本身就能接入。

同时它是一条可编排的边界：无效命令、误用其他模式的选项、配置错误、启动失败，一律以非零退出码结束。这保证了 `dsh` 可以被脚本和 supervisor 可靠地编排，也解释了后面 5.9 里 headless 为什么能直接当 CI 步骤用。

## 5.2 命令速查表

| 命令 | 作用 |
|---|---|
| `dsh --profile <name>` | 启动 `$DSH_HOME/profiles/<name>` 下的 profile |
| `dsh --profile headless "job"` | 跑一个全新持久会话，打印最终答案后退出 |
| `dsh web` | `--profile web` 的别名 |
| `dsh plugin --profile <name> <pnpm args>` | 把 `<pnpm args>` 转发给 profile 目录内的 pnpm，管理插件 |

四个入口共用一个进程模型：**调用命令时所在的目录是默认 workspace 根目录**；所有模式都会加载目录中适用的 `AGENTS.md` / `CLAUDE.md` 指令（渲染预算 65,536 字节），并使用内存 SQLite 会话内容索引。

`web` 与 `headless` 是随附模板，首次使用自动初始化；其他名字的 profile 必须通过 `dsh plugin` 创建（见 5.8）。

## 5.3 启动器 flag 与 app flag 的分界

这是 `dsh` 最容易踩坑的一点，也是它语法设计的核心。规则只有一条：

> launcher 只解析自己认识的 flag；遇到**第一个不认识的 token** 之后，后面的所有内容都原样交给启动后的 profile，由 profile 里注入的 app 插件解析。

这条规则有两个直接推论：

1. **launcher flag 必须写在前面**。`dsh --profile web --port 8080` 中，`--port` 属于 web app，不是 launcher 的。
2. **`--help` 有两份**。`dsh --help` 打印 launcher 自己的帮助；`dsh --profile web --help` 打印的是 web app 的 flag 帮助，并且只打印、不启动。

官方给出的示例（[apps/cli/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md)）：

```sh
dsh --profile web --port 8080       # --port 属于 web app
dsh --profile tui --resume <id>     # 假设装了 tui profile，--resume 属于终端 app
dsh --profile headless "run the tests"
dsh --profile web --help            # web app 自己的 flag，不是 launcher 的
dsh --help                          # launcher 自己的帮助
```

参数经 `ctx.cmdlineArgs` 以不可变快照形式交给 profile，多个插件可以解析同一份快照；没有读取方的 profile 会忽略自己的 app 参数。这套机制由 [`dsh-cmdline`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/cmdline/README.md) 包承载。

几个边界细节（都来自 [reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)）：

- launcher 的解析器会消耗一个 `--`；要把字面 `--` 传给 app，需要写成 `-- --`。
- 若第一个 app 参数恰好等于 `web` 或 `plugin`，会改选对应子命令。
- `-V` / `--version` 出现在 app 参数边界之前时，打印的是 launcher 的版本。
- `--patch` 是**可重复的单值 collector**（`--patch a.yml --patch b.yml`），刻意不做成变参——变参的 `--patch` 会把后面的 app 参数吞掉。

随附 app 各自拥有这些命令行：

| Profile | 接受的参数 |
|---|---|
| `web` | `--host`、`--port`、可重复的 `--trusted-host` |
| `headless` | 任务文本，作为位置参数 |

web 的 `--port` 会覆盖组合配置里该行的取值——但前提是那行配置保留了表达式（`port: !!js ctx.webStartup.port ?? 3080`）。如果你用 patch 把整个 `config` 换成字面量，就移除了运行时读取，flag 就不再生效。这是"整行替换而非深合并"语义的一个直接后果（见 5.6）。

web 部署侧还有几个值得记住的行为：默认服务地址是 `http://127.0.0.1:3080`；CLI 目前**有意不支持 `--host 0.0.0.0`**，会以用法错误退出；`--trusted-host` 用于给 `/api` 的浏览器信任围栏添加具名 authority（部署表达式会拼接自己的 authority）。生产 Web runner 需要已构建的包与前端产物（`pnpm run build`）；客户端插件的 HMR 接收器始终挂载，但要等单独的 `pnpm run dev:web` watcher 重建客户端 bundle 后才活跃。

## 5.4 Profile：一个目录 = 一套组合

profile 是 `$DSH_HOME/profiles/<name>/` 下的一个目录，里面只有两样东西决定行为：

| 文件 | 内容 |
|---|---|
| `package.json` | 树外插件依赖 + profile manifest `dsh.profile`（含有序的 `bundles` 列表） |
| `cordis.patch.yml` | 用户自己的 patch 层 |

`package.json` 的结构示意（只演示 manifest 关键字段）：

```json
{
  "name": "dsh-profile-<name>",
  "dependencies": {
    "some-out-of-tree-plugin": "..."
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless"]
    }
  }
}
```

理解这里的"为什么"：**profile 不包含任何业务代码**，它只是一张有序清单。真正提供行为的是清单里列出的 bundle（下一节），`cordis.patch.yml` 则是你对这些 bundle 的最后一层覆盖。把"想装什么"（bundle 清单）和"想改什么"（patch 层）分开，好处是：升级 bundle 不影响你的定制，你的定制也不会被 bundle 覆盖——层级顺序固定，后写的赢。

## 5.5 Bundle：配置行 + 代码的分发格式

bundle 是 Cordis 世界里"配置行 + 代码"一起分发的格式。一个 bundle 就是一个 npm 包，它在自己的 `package.json` 里声明自己的 patch 层：

```json
"dsh": {
  "bundle": {
    "patch": "./cordis.patch.yml"
  }
}
```

`dsh` 内置了三个 bundle：

| Bundle | 职责 |
|---|---|
| `@deepseek-ai/dsh-base` | 第一层：原生 DeepSeek 模型适配器、settings 与凭据 provider、`web_search`、默认关闭的会话遥测 |
| `@deepseek-ai/dsh-web-app` | Web UI、HTTP 服务器、`/api` 信任围栏、浏览器客户端 |
| `@deepseek-ai/dsh-headless` | 无 UI 形态：不挂载 ApiProxy、Host、HTTP 服务器、Web 运行时或浏览器客户端，专注 agent spine + 本地工具 |

bundle 名称的解析顺序：**先查 dsh 安装目录，再查 profile 目录**。所以内置 bundle 永远来自当前运行的那个 `dsh` 所属安装，而树外 bundle 来自 profile 的 pnpm 管理的 `node_modules`。裸插件 `name` 在 patch 行里会沿 Node 父目录向上查找，最终到达 dsh 维护的安装后备目录 `$DSH_HOME/profiles/node_modules`（每个包一个符号链接，每次启动自动修复）。这套解析规则保证了内置 bundle 与运行中的 `dsh` 版本一致，避免"装了新版插件却跑旧版内核"的错配。

为什么要区分"base / web-app / headless"三层：base 是所有形态共享的地基（模型、凭据、遥测），web 和 headless 只是在它之上叠不同的交互层。这让 `dsh web` 和 `dsh --profile headless` 共享同一套模型适配与凭据解析逻辑，只是暴露方式不同。

遥测默认关闭这一点值得单独强调：base 挂载的是"已禁用的会话遥测"，任何非空 `DSH_TELEMETRY_DISABLED` 都是硬关闭。因为随附 base **没有遥测脱敏规则**，一旦显式开启，导出内容可能包含消息文本、工具参数与结果、workspace 路径——默认关闭是刻意的部署决策（见仓库 [telemetry default-off note](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/feature/2026-08-10-telemetry-default-off.md)）。

## 5.6 组合顺序与覆盖语义

这是 profile/bundle 体系的**核心规则**。生效配置树以一个空根节点为起点，按顺序叠加：

```
1. 每个 bundle 的 patch（按 dsh.profile.bundles 列表顺序）
2. profile 自己的 cordis.patch.yml
3. home 级 $DSH_HOME/cordis.patch.yml
4. 每个 --patch <path> overlay（按 argv 顺序）
```

覆盖语义有两条，必须记牢：

- **后写的层赢**（per row，逐行比较）。
- **patch 替换整行的 `config` 值**，而不是深度合并其中的键；patch 还可以插入新行。

一个容易误解的点：**home 级 `$DSH_HOME/cordis.patch.yml` 优先于逐 profile 的 `cordis.patch.yml`**。原因在注释里写得很清楚——它是所有 profile 共享的机器本地偏好，所以理应排在后层覆盖前面（"so it outranks the per-profile layer"）。

为什么是"整行替换"而不是深合并？深合并意味着 bundle 更新配置结构时，用户的旧 patch 可能残留下半截失效的键，产生难以排查的"半覆盖"状态。整行替换让每次覆盖都是显式的、可预测的：你要么完全接管这一行，要么不碰它。

看一个具体例子。假设你想在某个 profile 里把模型从 flash 换成 pro，只需覆盖 `llm-deepseek` 这一行：

```yaml
# profile 的 cordis.patch.yml
- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek'
  config:
    thinking: enabled
    reasoningEffort: max
    models:
      - id: deepseek-v4-pro
        contextWindow: 128000
```

注意：这份 patch 的 `config` 是**完整替换** `llm-deepseek` 行的原 config。如果你只写了 `models` 而漏了 `thinking`，那么 `thinking` 的旧值不会"残留"——而是整行被你的新 config 接管，`thinking` 直接变成未定义。这是最容易出错的点：写 patch 时要么照抄整行再改，要么只插入全新的行，不要试图"只改一个键"。

## 5.7 用 --dump-config 查看真实组合树

组合规则听起来抽象，实际有一个直接验证工具——**不启动、只打印**：

```sh
dsh --profile web --dump-default-config
dsh --profile web --patch ./extra.yml --dump-config
```

两个 flag 的区别：

| Flag | 打印范围 |
|---|---|
| `--dump-default-config` | 只打印 bundle 各层 |
| `--dump-config` | 在 bundle 层之上，再加 profile 的 `cordis.patch.yml`、home 级 `$DSH_HOME/cordis.patch.yml` 和 `--patch` overlay |

两者打印时都会**加上注释，标明每一行由哪个文件提供、哪些 overlay 修改过它**；`!!js` 表达式保持未求值；找不到目标的 patch 会报告到 stderr。二者互斥，`--dump-default-config` 不接受 `--patch`。

一个重要限制：**dump 不运行 app 命令行参数 provider**，所以它展示的是"解析任何 app 参数之前"的组合树，也因此**拒绝携带 app 参数的调用**。你无法用 dump 去"猜" `--port` 最终会是什么——那需要在运行时由 `ctx.webStartup` 服务求值。

这个限制的"为什么"在实现注释里写得很直白：如果 dump 能展示 app 参数决定的树，那它和同一调用的真实启动树就不一致了，反而误导人。所以 dump 只回答"哪些层叠出了哪些行"，不回答"运行时 flag 怎么改它"。

## 5.8 首次使用与自定义 profile

`web` 与 `headless` 首次使用会自动从随附模板初始化：

- `web`：base + web-app
- `headless`：base + headless

其他名字的 profile 缺失时会**显式报错**，并提示运行 `dsh plugin --profile <name> add <package>`。

`dsh plugin` 把剩余参数转发给 profile 目录内的 pnpm（`add`、`remove`、`why`、`update` 等子命令照常可用，pnpm 必须在 PATH 上）：

```sh
dsh plugin --profile tui add github:deepseek-harness/turtle-ui
dsh plugin --profile tui remove turtle-ui
dsh --profile tui
```

两个要点：

1. **相对路径 spec**（`.`、`../plugin` 及 `file:`/`link:` 形式）先锚定到调用目录。所以在插件 checkout 里执行 `add .` 装的是该 checkout，不是 profile。
2. **bundle 自动对账**：每次成功运行后，`dsh.profile.bundles` 会对照安装状态重算——依赖解析到声明了 `dsh.bundle.patch` 的包，就加入 layer 栈（`update` 后新获得声明的也会激活）；没有 bundle 声明的依赖保持普通依赖并给一次性警告；已移除的依赖退出 layer 栈。

Git 托管插件的构建放行：随源码发布的插件会在安装时通过 `prepare` 脚本构建，pnpm >= 10 默认拦截。首次 `add` 会失败并给出 `allowBuilds` 提示和指向 profile `pnpm-workspace.yaml` 的指引——把打印的键复制进去再重跑即可。装已构建好的 tarball 或本地 checkout 则无需放行。

## 5.9 headless 一次性任务实战

`headless` profile 是最适合脚本化调用的形态。它没有 UI、不开端口、成功时不向 stderr 写任何东西：

```sh
# 先配置凭据（repo 根 .env，已 gitignore；或导出环境变量）：
#   DEEPSEEK_API_KEY=sk-…
#   DEEPSEEK_BASE_URL=https://…   # 可选；默认走公共 API
pnpm dsh --profile headless "summarize this workspace"
```

（`pnpm dsh` 是仓库源码执行形式；生产安装后直接 `dsh --profile headless "..."`。见 [examples/headless-agent/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/headless-agent/README.md)）

内部流程是一条严格的一次性管线：

1. 通过核心注册表创建一个**全新持久 Agent**
2. 提交任务
3. 等待 quiescence（完全停稳）
4. flush 会话
5. 从持久事件区间推导**最后一个非空 assistant 文本**和最终 `turn/end` 原因
6. 文本打印到 stdout；原因为 `completed` 时退出码 0，否则 1

没有任务文本的调用是该 app 的用法错误。随附 headless profile 不挂载 ApiProxy、Host、HTTP 服务器、Web 运行时或浏览器客户端——成功运行不向 stderr 写任何内容，也不开监听端口。

因为结果只走 stdout 且退出码可靠，`dsh --profile headless` 可以直接嵌进 CI 步骤或 shell 脚本：`if dsh --profile headless "run the tests"; then ... fi`。这是它相对 web 的核心价值——把"一次对话"变成"一次可判定的进程返回"。

## 5.10 cordis.yml 语法逐行拆解

先交代文件定位，避免误读：`examples/headless-agent/cordis.yml` 是仓库里的**测试组合**（replay 与真实模型的 headless 编码 agent 组合，见 [cordis.yml](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/headless-agent/cordis.yml)），"不是一个第二产品入口"。但它完整展示了 Cordis 配置行语法，且与随附的 dsh-headless bundle 组合同源，非常适合逐行讲解。

### 5.10.1 条目结构

每条配置是一个对象，三要素：

```yaml
- id: bash
  name: '@deepseek-ai/dsh-bash-local'
  config:
    timeoutMs: 60000
```

- `id`：本配置在组合树里的身份标识，patch 覆盖时按它定位目标行
- `name`：要挂载的插件名（对应某个 npm 包）
- `config`：该插件的构造配置，会被 Loader 插值后求值

### 5.10.2 `!!js` 表达式

`config` 值可以用 `!!js` 内联 JavaScript 表达式，由 `@deepseek-ai/cordis-plugin-include` 解析成表达式节点。文件里有两个典型用法：

```yaml
# 1. 取运行时 cwd：agent 的工作目录跟随进程启动目录
cwd: !!js process.cwd()

# 2. 环境变量分支：默认 zstd 压缩，DSH_SNAPSHOT 存在时关掉
compression: !!js "process.env.DSH_SNAPSHOT === undefined ? 'zstd' : 'none'"
```

`!!js` 的值保持**惰性求值**：Loader 在该条目的依赖注入激活后、针对该插件上下文（`ctx.serviceName`）才插值。这也是 5.3 里"`--port` 能覆盖配置值"的底层原因——`port: !!js ctx.webStartup.port ?? 3080` 在服务就绪后才取到运行时端口。注意惰性带来的另一面：在线编辑 `cordis.patch.yml` 时，表达式会对仍在运行的服务重新求值，所以它**不会**重置当前已占用的端口。

### 5.10.3 disabled 条目

条目还可以带一个 `disabled` 字段，在**每次挂载决策时**（针对 loader 上下文）求值；为真时该条目加载但停用。环境需要选择插件时，官方推荐用 overlay（patch 层）而不是在源文件里改 disabled——保持组合文件的可复用性（见 [Cordis Primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/cordis-primer.md) 的 Loader Configuration 一节）。

### 5.10.4 组合逐行拆解

下面把文件里的条目按职责分组讲解（`id` / `name` 均照录原文）。先看**地基三件套**——settings、凭据、模型适配器：

| id | name | 作用 |
|---|---|---|
| `settings` | `@deepseek-ai/dsh-settings-file` | 用户 settings 文档（`$DSH_HOME/settings.yaml`，热重载）；其中 `llm-deepseek:` 段可在不重启的情况下覆盖下面的 adapter 条目 |
| `credentials` | `@deepseek-ai/dsh-credentials-local` | 凭据存储：活进程环境优先于 `$DSH_HOME/.credentials.yaml`（仅属主文件、热重载）；adapter 每次请求经它解析 `DEEPSEEK_API_KEY`，所以本文件里没有任何内联 key |
| `llm-deepseek` | `@deepseek-ai/dsh-llm-deepseek` | DeepSeek adapter：`thinking: enabled`、`reasoningEffort: max`（随附默认每次请求满 thinking）；`models` 列出 `deepseek-v4-pro` / `deepseek-v4-flash`，`contextWindow: 128000` |

这三行解释了"为什么配置文件里看不到 API key"：凭据走 provider 动态解析，settings 文档还能在运行时覆盖 adapter 条目，于是同一个组合文件可以被不同 key、不同模型偏好复用，而不必改文件本身。

**本地执行与 agent 骨架**：

| id | name | 作用 |
|---|---|---|
| `subprocess` | `@deepseek-ai/dsh-subprocess-local` | bash 执行器的托管子进程组（spawn/kill/输出管道） |
| `bash` | `@deepseek-ai/dsh-bash-local` | 本地 bash 工具，`timeoutMs: 60000`（60 秒超时） |
| `agent-spine` | `@deepseek-ai/dsh-agent-spine-demo` | 组合骨架：预创建 `main` agent（`provider: deepseek-official`、`model: deepseek-v4-flash`、`cwd: !!js process.cwd()`）、`workspaceContext.maxBytes: 65536`、`persona` 系统提示词 |

`agent-spine` 的 `cwd: !!js process.cwd()` 决定了 agent 在哪个目录工作——这也是"调用目录即默认 workspace 根"落到配置层的具体体现。

**持久化与上下文策略**：

| id | name | 作用 |
|---|---|---|
| `persistence` | `@deepseek-ai/dsh-session-persistence-jsonl` | JSONL 持久化，`root: './.sessions'`，压缩由上面的 `!!js` 环境变量分支决定 |
| `checkpoint-policy` | `@deepseek-ai/dsh-session-checkpoint-policy` | 语义 checkpoint 策略 |
| `token-meter` | `@deepseek-ai/dsh-token-meter` | 派生历史逼近上下文窗口时，对较旧区间做摘要 |
| `compaction-basic` | `@deepseek-ai/dsh-compaction-basic` | 上下文压缩：`thresholdRatio: 0.8`、`retainRatio: 0.16`、`maxTokens: 8192`、`compactionRetries: 1` |
| `session-projection` | `@deepseek-ai/dsh-session-projection` | projection 注册表：持久子 agent 身份（mode/label）折叠进注册单元 |

**子 agent 与工作流**：

| id | name | 作用 |
|---|---|---|
| `subagent` | `@deepseek-ai/dsh-subagent` | 通过独立进程内后端暴露 fresh-child `spawn` 与 completed-prefix `fork` |
| `subagent-spawn-in-process` | `@deepseek-ai/dsh-subagent-spawn-in-process` | spawn 后端（`providerName: spawn`） |
| `subagent-fork-in-process` | `@deepseek-ai/dsh-subagent-fork-in-process` | fork 后端（`providerName: fork`） |
| `tool-subagent` | `@deepseek-ai/dsh-tool-subagent` | 子 agent 工具：`provider: spawn`、`backgroundMode: continuable`、`maxDepth: 1` |
| `tool-subagent-fork` | `@deepseek-ai/dsh-tool-subagent` | fork 保持 one-shot，`enableRunInBackground: false` |
| `workflow-worker-thread` | `@deepseek-ai/dsh-workflow-worker-thread` | worker 线程工作流引擎，把模型生成的 JS 脚本 `agent()` 调用扇出到 spawn 后端 |
| `tool-workflow` | `@deepseek-ai/dsh-tool-workflow` | 工作流工具 |
| `tool-ralph` | `@deepseek-ai/dsh-tool-ralph` | fresh-agent Ralph 迭代消费者 |
| `tool-todo` | `@deepseek-ai/dsh-tool-todo` | `todo_write`，替换已记录整张列表；`allowParallelInProgress: true` |

**文件系统**（收尾三行）：

| id | name | 作用 |
|---|---|---|
| `fs-local` | `@deepseek-ai/dsh-fs-local` | 本地文件系统后端，`cwd: !!js process.cwd()` |
| `fs-observation-policy` | `@deepseek-ai/dsh-fs-observation-policy` | 观察策略：写/改文件需先观察到该文件，相对路径从进程 cwd 解析 |
| `tool-fs` | `@deepseek-ai/dsh-tool-fs` | 面向模型的文件系统工具 |

拆解后能读出一个规律：**顺序即依赖声明**。`settings` 在 `llm-deepseek` 之前，因为 adapter 需要凭据与 settings 服务；`fs-local` 在 `tool-fs` 之前，因为工具需要后端；`checkpoint-policy`、`token-meter`、`compaction-basic` 这些策略型插件则夹在持久化与工具之间，形成"先有存储、再有策略、最后有面向模型的工具"的分层。写自己的 `cordis.yml` 时，先想清楚"谁依赖谁"，再决定行序。

## 5.11 环境变量表

| 变量 | 作用 |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 凭据；adapter 每次请求经凭据 provider 解析 |
| `DEEPSEEK_BASE_URL` | 自定义 API endpoint；默认走公共 API |
| `DSH_HOME` | dsh 的 home 目录（profiles、`cordis.patch.yml`、`.credentials.yaml` 等都在其下） |
| `DSH_PERMISSION_MODE` | 进程级权限预设；新会话默认 `workspace-write`（Bash/FS 变更限于会话 workspace 与平台临时根；读取、网络、进程可见性不受限） |
| `DSH_TELEMETRY_DISABLED` | 任意非空值即遥测硬关闭（最高优先） |
| `DSH_TELEMETRY_MODE` | `FULL` 流式发送每条投影会话事件为 OTLP/HTTP 日志；`FEEDBACK_ONLY` 仅在记录反馈时上传日志后缀 |
| `DSH_TELEMETRY_OTLP_URL` | 指定其他遥测 collector |
| `DSH_TOOLS_MODE` | `native` / `code` / `both`，其他值启动失败 |
| `DEEPSEEK_SEARCH_BASE_URL` | 搜索用的 endpoint |

凭据解析顺序（[reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)）：继承环境 → `$DSH_HOME/.credentials.yaml` → 调用目录的 `.env` → `$DSH_HOME/.env`。受管文档从不物化进 `process.env`；两个 `.env` 文件都是普通启动环境层。

`DSH_PERMISSION_MODE` 只影响"进程后备值"：新会话默认 `workspace-write`；在 Web UI 的 General settings 里存的权限，只作用于**之后的** Web 会话，不会改变已打开的会话。

## 5.12 进程生命周期与信号处理

一个能被 supervisor 可靠管理的 CLI，必须把信号语义讲清楚。`dsh` 的约定（[reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)）：

| 信号 | 行为 |
|---|---|
| 第一次 `SIGINT` / `SIGTERM` | 开始优雅排空（graceful drain），插件树最多 5 秒完成 dispose |
| `SIGTERM` | 监督进程的常规停止请求，在所有形态下都以 0 退出 |
| `SIGINT` | 报告 130（对应 Ctrl+C 的惯例退出码） |
| 第二次信号 | 立即强制退出 |
| 一次性任务卡在 dispose | 第一次 Ctrl+C 直接升级为强制退出，不被吞掉 |

另一个生命周期特性：**每次 profile 启动都会监视 profile 与 home 两个 `cordis.patch.yml` 的有效变更，并以事务方式重新应用**。也就是说，你在运行中改 patch 文件，改动会被热应用，无需重启。一次性运行（headless）则通过有界关闭流程退出，先 dispose 监视器，不留后台进程。

## 5.13 源码执行与安装执行

如果你是仓库贡献者、要从源码跑，执行方式与安装版不同：

```sh
# 全新 checkout 后，以及产物需要更新时，单独构建一次
pnpm run build
# 之后用 pnpm dsh 直接跑 TS 入口并转发所有参数
pnpm dsh --profile headless "run the tests"
```

`pnpm dsh` 脚本会用 `node --import tsx/esm` 启动 `apps/cli/src/bin.ts`，不重新构建。几个易踩的坑（[reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)）：

- Typert Host 产物缺失时，profile 启动报模块解析错误，且**不带构建指引**。
- Host 产物存在后，若前端或 client-plugin bundle 缺失，启动失败并提示 `pnpm run build`。
- launcher **不检查产物新旧**，已存在的陈旧 bundle 会继续跑旧浏览器代码，直到你重建。
- 进程继承启动环境；若 Node 版本需要遵循 `HTTP_PROXY` / `HTTPS_PROXY`，设 `NODE_USE_ENV_PROXY=1`。
- 安装形态直接启动构建后的 `apps/cli/lib/bin.js`，不会重建仓库。

## 5.14 本章小结

- `dsh` 是 profile 启动器：`args.ts` 定义语法，`bin.ts` 只动态加载被选中的 runner，三种模式（boot / dump / plugin）。
- 四个入口命令：`--profile <name>`、`--profile headless "job"`、`web`（别名）、`plugin --profile <name> <pnpm args>`。
- launcher flag 在第一个不认识的 token 处截止，之后全部归 app；`--help` 因此有两份，`--port` 属于 web app 而非 launcher。
- profile 是一个目录：`package.json`（`dsh.profile.bundles` 有序清单 + 依赖）+ `cordis.patch.yml`（用户补丁层）。
- bundle 是"配置行 + 代码"的 npm 分发格式，靠自身 `package.json` 的 `dsh.bundle.patch` 声明；内置 `dsh-base`、`dsh-web-app`、`dsh-headless`。
- 组合顺序固定：bundle patches → profile `cordis.patch.yml` → home `cordis.patch.yml` → `--patch`；后层按行覆盖，**整行替换、不做深合并**。
- `--dump-config` / `--dump-default-config` 在不动真格的前提下查看组合树，`!!js` 保持未求值，且拒绝携带 app 参数。
- headless 是一次性管线：新持久会话 → 提交任务 → 等停稳 → 打印最后 assistant 文本 → 退出码 0/1。
- cordis.yml 条目 = `id` + `name` + `config`，`config` 用 `!!js` 惰性求值，条目可带 `disabled` 字段；行序即依赖声明。
- 核心环境变量：`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DSH_HOME`、`DSH_PERMISSION_MODE`、`DSH_TELEMETRY_DISABLED` 等。
- 信号语义：首次信号优雅排空（5 秒 dispose），`SIGTERM` 退 0、`SIGINT` 退 130，二次信号强退；`cordis.patch.yml` 热重载。

---
layout: default
title: 第06章：Python SDK 编程接入
---

# 第06章：Python SDK 编程接入

第 5 章讲的 `dsh` 是命令行入口，适合交互和脚本化的一次性调用。当你需要在自己的 Python 程序里驱动 agent——比如构建评测 pipeline、批量跑任务、或把 agent 嵌进更大的应用——就应该用 Python SDK。它把整个 harness 打包成一个 subprocess，用 stdio 上的 JSON-RPC 协议通信，你的程序只管发 prompt、收结果。

> 写作依据：本章以 master 分支 [docs/user/guide/python-sdk.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md)、[python/sdk/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk/README.md)、[python/sdk-runtime/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk-runtime/README.md) 为准。SDK 同样处于 developer preview，API 可能发生破坏性变更。

## 6.1 两个包的分工

Python 侧由两个发行包组成，安装时自动配对：

| 目录 | 发行包 / 模块 | 职责 |
|---|---|---|
| `python/sdk` | `deepseek-harness-sdk` / `deepseek_harness` | 高层 turns API + 底层 JSON-RPC 客户端 |
| `python/sdk-runtime` | `deepseek-harness-runtime-bin` / `deepseek_harness_runtime` | 捆绑的 runtime 二进制 + 默认 agent 配置 |

分工的意义：SDK 负责"怎么对话"，runtime-bin 负责"对话需要的那台 Node 运行时"。因为 runtime 被编译成单文件可执行，**目标机器不需要安装系统 Node.js**——这是 Python 用户能直接接入的关键前提。

运行时载体有两种（[python/sdk-runtime/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk-runtime/README.md)）：

| 载体 | 形态 |
|---|---|
| exe（生产） | 单文件 Node 可执行 `dsh-jsonrpc-agent-pkg-<platform>-<arch>`；macOS 额外带原生 `-spawn-helper` 兄弟文件（`node-pty` 使用）。**唯一随 wheel 发布** |
| node（仅开发） | 完整部署闭包 `runtime/node/`，用系统 Node >= 22.19 跑；只用于仓库本地开发，**从不被自动选中**，也不进发布包 |

两个载体的内容同源：`python/sdk-runtime/package.json` 是单 exe 管道的部署根——一份纯依赖清单，它的依赖闭包**既是**编译进 exe 的插件集合，**也是**物化进 `runtime/node/` 的树。往发行包里加一个插件，就是在这份清单里加一行依赖再重建。平台 tag 与可执行文件名的配对由该包的 `platforms.json` 统一维护，供发布构建器与隔离构建钩子共同使用。

## 6.2 安装与前置条件

前置条件：

- Python 3.10 或更新（`requires-python = ">=3.10"`）
- Git
- Linux x64 / Linux arm64 / macOS 14+ arm64
- DeepSeek 兼容的 API endpoint 与凭据
- 一个允许 agent 修改的隔离 workspace

安装一行搞定，`deepseek-harness-sdk` 会带上同版本的 `deepseek-harness-runtime-bin` 平台 wheel：

```sh
python -m pip install deepseek-harness-sdk
```

依赖只有 `pydantic>=2.12,<3` 和同版本 runtime-bin（见 [python/sdk/pyproject.toml](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk/pyproject.toml)）。官方教程建议克隆仓库拿到可运行的示例，再用 venv 安装：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
python -m venv .venv
. .venv/bin/activate
python -m pip install deepseek-harness-sdk
```

运行前设置凭据；当模型由 OpenAI 兼容代理（而非默认 DeepSeek endpoint）提供时，还要设 `DEEPSEEK_BASE_URL`：

```sh
export DEEPSEEK_API_KEY=sk-your-key-here
# export DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1
# export DSH_MODEL=deepseek-v4-flash
# export DSH_SYSTEM_PROMPT='You are a helpful software engineer assistant.'
```

## 6.3 平台限制（易错点）

这是最容易踩坑的地方，务必先看清楚：

| 项 | 限制 |
|---|---|
| 支持的平台 | **仅 Linux x64 / Linux arm64 / macOS 14+ arm64** |
| wheel 固定 tag | `py3-none-manylinux_2_28_x86_64`、`py3-none-manylinux_2_28_aarch64`、`py3-none-macosx_14_0_arm64` |
| Windows | **不支持 agent 会话**。持久 PTY 需要 POSIX 终端底层 |

原因链：持久 Bash 依赖 `node-pty`，而 `node-pty` 需要 POSIX 终端环境；macOS 上还额外需要一个原生 `-spawn-helper` sidecar（缺失即硬启动错误，即使你的组合不用 PTY 工具）。Linux wheel 不带 spawn helper，因为 `node-pty` 直接用分阶段的 `pty.node` addon。

两个连带易错点：

- **该 SDK 不发布 sdist**（只发 wheel）。在不受支持的平台（比如 `win_amd64` 或旧 macOS）上 `pip install` 会因找不到可用 wheel 而失败——这不是 bug，是刻意的平台门控。
- **每个 wheel 只含一个 runtime 可执行**。macOS wheel 里那个 spawn helper 是必配 sidecar；缺失会让安装"不完整"并硬启动错误，所以别手动删 wheel 里的文件。

## 6.4 核心 API：DeepSeekHarness

`DeepSeekHarness` 是唯一需要掌握的高层入口。它**惰性启动**捆绑 runtime 并复用，直到上下文管理器退出。官方完整示例（[docs/user/guide/python-sdk.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md)）：

```python
from pathlib import Path

from deepseek_harness import DeepSeekHarness

config = Path("examples/jsonrpc-agent/minimal.cordis.yml").resolve()
workspace = Path("/absolute/path/to/workspace").resolve()
sessions = Path("/absolute/path/to/sessions").resolve()

with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cwd=str(workspace),
    session_root=str(sessions),
    cordis=str(config),
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

构造参数逐项说明：

| 参数 | 含义 |
|---|---|
| `provider` | 选一个由所选 Cordis 组合注册的 provider route |
| `model` | 该 adapter 解析的模型 id |
| `max_tokens` | 可选，每次请求的输出 token 上限（作用于 root agent 及其进程内后代）；省略则由 provider 默认值接管 |
| `cwd` | agent 的 workspace（绝对路径）；Bash 与文件系统工具都在此目录内活动 |
| `session_root` | 会话日志与状态目录；高层便利参数，内部就是设置 `DSH_SESSION_ROOT` |
| `cordis` | 自定义 Cordis 组合文件路径 |

零配置场景可以什么都不传，SDK 会启动捆绑的默认组合：

```python
from deepseek_harness import DeepSeekHarness

with DeepSeekHarness() as harness:
    result = harness.run("Say hi.")
```

`harness.run(prompt, session_id=...)` 返回的 `RunResult` 字段（[python/sdk/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk/README.md)）：

| 字段 | 含义 |
|---|---|
| `session_id` | 会话 id |
| `final_response` | 区间内**最后一条已提交的 root 会话 assistant 文本** |
| `finish_reason` | 区间内最后一个 root 会话 `turn/end` 的 `kind`（如 `completed`、`max-tokens`、`error`）；没有 turn 结束时为 `None` |
| `events` | 仅含 root 会话事件（后代消息无法顶替 root 响应） |
| `notifications` | root 会话与所有已知后代通知，按线上顺序 |
| `session_root` | 会话目录 |

两个语义要点：

1. `finish_reason` 描述的是"它拥有的区间"，而非因果上归因于这次 prompt 的某个结束原因——steering、注入上下文等排队工作可能在空闲前参与。
2. `final_response` 是"最后一个 root assistant 文本"，与 `maxTokensAsSuccess` 这类部署开关配合时，token 截断的 turn 也可能作为成功结果返回。

一个协议边界：如果某个 `turn/end` 没有字符串型的 `data.reason.kind`，就违反 runtime 协议，SDK 会抛 `SdkProtocolError`。所以不要对 `finish_reason` 做宽松假设，按文档枚举处理。

## 6.5 环境变量表

SDK 侧常用环境变量（来自 [examples/jsonrpc-agent/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/jsonrpc-agent/README.md)）：

| 变量 | 作用 |
|---|---|
| `DEEPSEEK_API_KEY` | 传给 OpenAI 兼容 host endpoint 的凭据 |
| `DEEPSEEK_BASE_URL` | `dsh-llm-deepseek` 使用的 host endpoint |
| `DSH_MODEL` | `minimal.py` 的默认模型（`--model` 优先） |
| `DSH_SYSTEM_PROMPT` | 部署提供的编码 persona；缺省回退到 `You are a helpful software engineer assistant.` |
| `DSH_CWD` | Bash 与文件系统工具的 agent workspace |
| `DSH_CONTEXT_WINDOW` | minimal 变体里 `DSH_MODEL` 目录条目的上下文容量 |
| `DSH_SESSION_ROOT` | JSONL 会话目录 |
| `DSH_CORDIS_CONFIG` | 传给 runtime 的组合配置路径 |
| `DSH_MAX_TOKENS_AS_SUCCESS` | `true`（默认）接受 token 截断结果；`false` 视为错误 |
| `DSH_RUNTIME_MODE` | 载体选择：`exe` / `node` |

零配置运行的机制值得讲清"为什么"：runtime 二进制**总是要求显式配置**（`$DSH_CORDIS_CONFIG` 或 argv 位置参数），没有就大声退出——这是 runtime 的硬语义。SDK 的做法不是隐藏 fallback，而是在 `HarnessClient.start()` 里做一次显式参数注入：当启动落到捆绑 runtime、且 `cordis` 和 `DSH_CORDIS_CONFIG` 都没设置时（runtime 把空值视为缺席，注入检查也如此），注入该包自带的默认配置路径。显式传参，而非静默兜底。

## 6.6 minimal.py 与 minimal.cordis.yml 拆解

官方示例 `examples/jsonrpc-agent/minimal.py` 是 SDK 调用的最小封装（[minimal.py](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/jsonrpc-agent/minimal.py)）：

```python
#!/usr/bin/env python3
"""Run one minimal-agent turn through the bundled Python SDK runtime."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from deepseek_harness import DeepSeekHarness


CONFIG = Path(__file__).with_name("minimal.cordis.yml")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("prompt", help="Task for the minimal agent")
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    parser.add_argument("--session-root", type=Path, default=Path(".dsh-sessions"))
    parser.add_argument("--session-id")
    parser.add_argument("--provider", default="deepseek-official")
    parser.add_argument("--model", default=os.environ.get("DSH_MODEL", "deepseek-v4-flash"))
    parser.add_argument("--max-tokens", type=int)
    args = parser.parse_args()

    workspace = args.workspace.resolve()
    session_root = args.session_root.resolve()
    with DeepSeekHarness(
        provider=args.provider,
        model=args.model,
        max_tokens=args.max_tokens,
        cwd=str(workspace),
        session_root=str(session_root),
        cordis=str(CONFIG.resolve()),
    ) as harness:
        result = harness.run(args.prompt, session_id=args.session_id)
    print(result.final_response)


if __name__ == "__main__":
    main()
```

命令行参数：`prompt`（位置，任务）、`--workspace`（默认当前目录）、`--session-root`（默认 `.dsh-sessions`）、`--session-id`、`--provider`（默认 `deepseek-official`）、`--model`（默认 `DSH_MODEL` 或 `deepseek-v4-flash`）、`--max-tokens`。

配套的 `minimal.cordis.yml` 是一个**极简组合**，把模型面向的工具压缩到恰好两个（[minimal.cordis.yml](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/jsonrpc-agent/minimal.cordis.yml)）：

| 属性 | 值 |
|---|---|
| 系统提示词 | `DSH_SYSTEM_PROMPT`，回退 `You are a helpful software engineer assistant.` |
| 模型 | `--model` → `DSH_MODEL` → `deepseek-v4-flash` |
| 面向模型的工具 | 仅持久 `bash` 与 `str_replace_editor` |
| Bash 超时 | 300 秒（`timeoutMs: 300000`） |
| 编辑器输出上限 | 16,000 字符（`maxOutputChars: 16000`） |
| 上下文压缩 | **关闭**（不挂载 compaction 插件） |
| 文件系统 | 裸本地后端（`danger-full-access`）；编辑器绝对路径可触及 runtime 进程可见的任何路径 |
| 会话持久化 | `DSH_SESSION_ROOT` 下的未压缩 JSONL |

组合文件完整条目如下。先看 **SDK 服务入口与模型 adapter**：

```yaml
# SDK 的 stdio JSON-RPC 服务入口本身也是一个插件条目；缺了它 agent 没有对外通道
- id: sdk-jsonrpc-server
  name: '@deepseek-ai/dsh-sdk-jsonrpc-server'
  config:
    maxTokensAsSuccess: false

- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    streamIdleTimeoutMs: 172800000
    models:
      - id: !!js process.env.DSH_MODEL ?? 'deepseek-v4-flash'
        contextWindow: !!js Number(process.env.DSH_CONTEXT_WINDOW ?? 1000000)
```

这里能看到与第 5 章 `!!js` 一脉相承的用法：模型 id 与上下文窗口都从环境变量惰性取值，`??` 给默认。`maxTokensAsSuccess: false` 表示 token 截断的 turn 会作为错误上报，而不是成功结果。

**沙箱与执行后端**：

```yaml
- id: sandbox
  name: '@deepseek-ai/dsh-sandbox-local'

- id: sandbox-policy
  name: '@deepseek-ai/dsh-sandbox-policy'
  config:
    mode: danger-full-access
    workspaceRoot: !!js process.env.DSH_CWD ?? process.cwd()

- id: subprocess
  name: '@deepseek-ai/dsh-subprocess-local'

- id: pty
  name: '@deepseek-ai/dsh-terminal'

- id: terminal-bash
  name: '@deepseek-ai/dsh-terminal-bash'
  config:
    timeoutMs: 300000

- id: fs-local
  name: '@deepseek-ai/dsh-fs-local'
  config:
    cwd: !!js process.env.DSH_CWD ?? process.cwd()
```

`danger-full-access` 是这里最关键的配置——见 6.9 的安全警告。

**agent 骨架**（刻意关闭了大部分模型面向的能力）：

```yaml
- id: agent-spine
  name: '@deepseek-ai/dsh-agent-spine-demo'
  config:
    includeHarnessIdentity: false
    includeRuntimeContext: false
    persona: !!js process.env.DSH_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'
    workspaceContext: false
    skills:
      enabled: false
    toolBash: false
    toolJobs: false
```

**仅有的两个模型工具 + 持久化**：

```yaml
- id: persistent-bash
  name: '@deepseek-ai/dsh-tool-bash-persistent'
  config:
    timeoutMs: 300000

- id: str-replace-editor
  name: '@deepseek-ai/dsh-tool-str-replace-editor'
  config:
    maxOutputChars: 16000

- id: sessions
  name: '@deepseek-ai/dsh-session-persistence-jsonl'
  config:
    root: !!js process.env.DSH_SESSION_ROOT ?? './.sessions'
    compression: none
```

为什么这样裁剪：`agent-spine` 把 harness 身份、运行时上下文、skills、一次性 bash、任务工具全部关掉，是为了**让 stdout 完全属于 SDK 协议**——没有终端 UI、没有审批 UI、没有向用户提问的工具，turn 完全由 SDK 驱动。`includeHarnessIdentity: false` 与 `includeRuntimeContext: false` 则保证系统提示词只包含部署选定的 persona，沙箱策略事实作为 runtime 用户上下文记录，而非塞进系统提示词。整体思路是"能少一个插件就少一个插件"，让每次调用的行为可预测、可复现。

## 6.7 session_id 复用语义

这是 SDK 编程里最容易搞错、也最有用的一点。官方表述（[guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md)）：

> 复用同一个 harness 和 session id，会保留会话拥有的 Bash 进程，包括其工作目录、导出的环境变量和 shell 函数。

规则很清晰：

- **独立任务 → 用全新 session id**（全新 workspace + 全新会话）。
- **要延续同一段持久对话和 shell 状态 → 复用同一个 id**。

看一个多轮延续的例子：

```python
with DeepSeekHarness(provider="deepseek-official", model="deepseek-v4-flash") as harness:
    harness.run("Create a directory named data and cd into it.", session_id="task-1")
    harness.run("Print the current working directory.", session_id="task-1")
    harness.run("Do something unrelated.", session_id="task-2")
```

第二次 `run` 用 `task-1` 时，Bash 会话还留在 `data` 目录里；用 `task-2` 则从一个干净会话开始。这让你能在评测场景里对一个任务做多轮追问，或在交互式调试里"接着上一步"。反过来，如果该隔离却复用了 id，上一轮残留的 cwd、环境变量和 shell 函数就会污染下一轮——所以 6.8 的基准指南才强调独立任务要各自隔离。

## 6.8 官方跑基准的方式

仓库的 [BENCHMARK.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/BENCHMARK.md) 只有一句话，但点明了正确姿势：

> 按 Python SDK 教程安装 SDK，跑 `jsonrpc-agent` minimal 变体。独立基准任务用各自独立的 workspace 和 session id。

也就是说，官方基准不是用 `dsh` 命令行，而是**用 SDK 驱动 minimal 组合**——因为 SDK 提供了可复用的进程、可控的 `session_id` 和可编程的结果解析，适合批量跑分。独立任务各自隔离 workspace 与 session id，避免会话状态串扰污染分数。

## 6.9 安全警告

`minimal.cordis.yml` 使用 `danger-full-access` 策略：Bash 和编辑器可以修改 runtime 进程能访问的**任何路径**（绝对路径不受 workspace 限制）。官方警告（[jsonrpc-agent/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/examples/jsonrpc-agent/README.md)）：

> 只在一次性 checkout 或容器内运行该组合。

模型输出不可信，`danger-full-access` 意味着一条 `rm -rf` 或覆盖任意文件的能力没有沙箱兜底。生产使用请套容器、用一次性 checkout、限制 runtime 进程的用户权限，并把 workspace 与真实数据隔离开。这也是 minimal 组合刻意只保留两个工具、关掉其他一切的原因之一——把暴露面缩到最小，但仍保留着最强的文件访问能力，所以容器隔离是最后一道、也是唯一可靠的防线。

## 6.10 三种程序化入口选型

到本章为止，你已经看到三种"不点 UI"驱动 harness 的方式（ACP 详见第 7 章）：

| 维度 | `dsh --profile headless` | Python SDK | ACP |
|---|---|---|---|
| 入口形态 | CLI 命令，一次性进程 | Python 进程内 SDK，subprocess JSON-RPC | 面向外部 agent 客户端的协议接入 |
| 会话模型 | 每次一个新持久会话，用完即退 | 复用 harness 与 session_id 延续会话 | 见第 7 章 |
| 结果获取 | stdout 文本 + 退出码 0/1 | `RunResult.final_response` 等结构化字段 | 见第 7 章 |
| 依赖 | 系统里装好 `dsh`（Node 环境） | Python 3.10 + 一个 pip 包（无需系统 Node.js） | 见第 7 章 |
| 适合场景 | CI 步骤、shell 脚本的一次性任务 | 评测 pipeline、批量任务、嵌入 Python 应用 | 需要长期连接或异构客户端时 |

选型直觉：**要跑一次就完 → headless**；**要在 Python 里编程控制、批量跑 → SDK**；**要跨进程、跨语言、长期连接 → 关注 ACP**。三者的共同点是底层都靠同一套 Cordis 组合——你会写 `cordis.yml`，三处都能复用。选 SDK 还是 headless 的一个现实判据：需要复用会话、结构化解析结果、或不想在目标机装 Node，就选 SDK；只需要"跑一次拿个退出码"，headless 更轻。

## 6.11 SDK 生命周期与低层客户端

`DeepSeekHarness` 之外的细节，写需要精细控制的程序时会用到（[python/sdk/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk/README.md)）：

- **生命周期**：runtime 子进程惰性启动并复用。用上下文管理器（推荐），或显式调用 `close()` 结束。
- **子 agent 谱系**：`HarnessClient` 在 runtime 进程生命周期内保留已发现的子 agent 祖先关系。每次 `Session.run()` 里，`RunResult.notifications` 和 `on_notification` 会收到 root 会话与所有已知后代通知（按线上顺序），包括嵌套的子 agent 生命周期与会话事件。
- **`events` vs `notifications`**：`RunResult.events` 只含 root 会话事件，所以后代消息无法顶替 root 响应；`notifications` 才包含后代。
- **低层 `session_prompt()`**：立即返回排队的 `MessageId`。绕过 `Session.run()` 直接调它的人，要自己负责之后的活动边界。
- **零配置注入条件**：当启动落到捆绑 runtime、且 `cordis` 与 `DSH_CORDIS_CONFIG` 均未设置时，注入默认配置；显式设置 `runtime_bin`、`bridge_bin` 或 `launch_args_override` 会**完全禁用**注入。

这些细节的组合场景很典型：默认配置注入只发生在"用捆绑 runtime 且没指定配置"时，一旦你指定了自定义配置或自定义 runtime 入口，就完全由你接管——SDK 不会在背后偷偷补一个配置进去。这种"显式优先"和 6.5 的零配置注入一脉相承。

## 6.12 本章小结

- 两个包：`deepseek-harness-sdk`（turns API + JSON-RPC 客户端）与 `deepseek-harness-runtime-bin`（捆绑 runtime，无需系统 Node.js）。
- 安装 `python -m pip install deepseek-harness-sdk`；Python >= 3.10；依赖 `pydantic>=2.12,<3`。
- 平台仅 Linux x64/arm64、macOS 14+ arm64；持久 PTY 需 POSIX，不支持 Windows agent 会话；只发 wheel 不发 sdist。
- 核心 API：`DeepSeekHarness(...)` 上下文管理器 + `harness.run(prompt, session_id=)`，返回 `result.final_response`。
- 关键环境变量：`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DSH_MODEL`、`DSH_SYSTEM_PROMPT`。
- `minimal.py` 是 SDK 调用的最小封装；`minimal.cordis.yml` 只保留持久 `bash` + `str_replace_editor`，关闭 compaction，用 `danger-full-access` 裸本地 FS。
- `session_id` 复用 = 延续同一持久会话（含 Bash cwd、导出变量、函数）；独立任务用新 id。
- 官方基准用 SDK 驱动 minimal 变体，独立任务各用独立 workspace 与 session id。
- `danger-full-access` 只在一次性 checkout 或容器内使用。
- 三种程序化入口：headless（一次性 CLI）、Python SDK（编程控制）、ACP（外部协议客户端，见第 7 章）。
- 生命周期细节：runtime 惰性启动、`events` 仅 root 而 `notifications` 含后代、`session_prompt()` 返回 `MessageId`、显式 `runtime_bin` 等会禁用默认配置注入。

---
layout: default
title: 第八章：MCP 集成与上下文文件
---

# 第八章：MCP 集成与上下文文件

把 Hermes 接到外部工具世界，最干净的方式是 **MCP（Model Context Protocol）**。它由 Anthropic 推动、目前已经成为 Agent 工具互操作的事实标准。Hermes 不仅是一个出色的 MCP 客户端，还和"项目级上下文文件（context files）"无缝结合，让你不用自己写工具就能让 Agent 操作 GitHub、数据库、文件系统、内部 API 等。本章把 MCP 与 Context Files 一次讲清。

## 8.1 MCP 是什么

> MCP（Model Context Protocol）是一种让"模型/Agent"与"外部工具/数据源"通信的协议。一个 MCP server 把若干工具、资源、prompts 打包成统一接口；一个 MCP client（如 Hermes）按协议拉清单、调工具、读资源。

它的核心好处：

- **不必每次都写一个 Hermes 工具**——已有的 MCP server 直接拿来；
- **stdio 与 HTTP 两种传输**：本地子进程跑 stdio；跨机器跑 HTTP；
- **资源（resources）和 prompts** 也能被读取；
- **工具自动发现与注册**：Hermes 启动时拉清单、注册成动态工具（前缀如 `mcp_<server>_<tool>`）。

## 8.2 安装 MCP 支持

如果你用了一键安装脚本（含 `[all]` extra），MCP 已经装好。否则：

```bash
cd ~/.hermes/hermes-agent
uv pip install -e ".[mcp]"
```

依赖会带上 `mcp`、`pydantic`、`anyio` 等。

## 8.3 添加你的第一个 MCP Server

在 `~/.hermes/config.yaml` 中加：

```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/me/projects"]
```

然后启动 Hermes：

```bash
hermes
```

Hermes 会在启动时：

1. 拉起这个 stdio 子进程；
2. 调 `tools/list`、`resources/list`、`prompts/list`；
3. 将所有工具注册成动态工具（schema 自动转成 OpenAI 风格）。

跟它说：

```
列一下 /home/me/projects 下的文件，然后概括其中三个最大的项目
```

它会自动用刚刚注册的 filesystem 工具完成。

## 8.4 stdio 与 HTTP 两种 server

### 8.4.1 stdio（推荐）

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
  postgres:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgres://localhost/mydb"]
  obsidian:
    command: "uvx"
    args: ["mcp-server-obsidian", "--vault", "/home/me/notes"]
```

特点：本地子进程，无网络暴露，启动开销小。`env` 字段允许传具体的密钥（注意从 `.env` 注入）。

### 8.4.2 HTTP（远端）

```yaml
mcp_servers:
  internal-api:
    transport: http
    url: https://mcp.example.com/internal-api/sse
    headers:
      Authorization: Bearer ${INTERNAL_API_TOKEN}
    sampling: true        # 服务器请求 sampling 时使用 Hermes 的主模型
```

特点：跨机器、跨网络；可以服务化部署 MCP server。开启 `sampling: true` 后，远端 MCP server 在它的工具内部如果需要"让 LLM 帮我决定下一步"，可以反过来调用你 Hermes 当前主模型。

### 8.4.3 OAuth 与凭据

Hermes 支持 MCP server 的 OAuth：

```yaml
mcp_servers:
  notion:
    transport: http
    url: https://mcp.notion.com/mcp
    auth: oauth          # 走 OAuth 流程
```

第一次启动 Hermes 会提示打开浏览器授权；token 存到 `~/.hermes/.env`，自动刷新。

## 8.5 Per-Server 工具过滤

MCP server 暴露的工具不一定个个都要。Hermes 支持 allow/deny：

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    tools:
      allow:
        - search_repositories
        - get_file_contents
        - create_pull_request
      # deny: ["delete_repository"]    # 或者反向
```

也可以全局对 MCP 工具做命名规则：

```yaml
mcp:
  prefix: "mcp"             # 默认；动态工具名形如 mcp_github_search_repositories
  max_tools_per_server: 50  # 防止 server 把 200 个工具都塞 prompt
```

## 8.6 Resources 与 Prompts

部分 MCP server 暴露：

- **Resources**：文件、记录、URL。Hermes 通过 `mcp_<server>_read_resource` 读取并就地展开（类似 `@` 引用）。
- **Prompts**：服务器提供"成熟的 prompt 模板"。Hermes 把它注册成 `/mcp_<server>_<prompt>` 斜杠命令，方便用户直接调用。

## 8.7 一些"立即好用"的 MCP Server 推荐

| Server | 干啥 | 安装 |
|--------|------|------|
| `@modelcontextprotocol/server-filesystem` | 读写指定目录 | npx |
| `@modelcontextprotocol/server-github` | GitHub 全套（issue、PR、commit、search） | npx |
| `@modelcontextprotocol/server-gitlab` | 同上 GitLab 版 | npx |
| `@modelcontextprotocol/server-postgres` | 直连 PG，跑只读查询 | npx |
| `@modelcontextprotocol/server-sqlite` | SQLite | npx |
| `@modelcontextprotocol/server-puppeteer` | 浏览器（替代 browser_*） | npx |
| `@modelcontextprotocol/server-slack` | Slack 工作区 | npx |
| `mcp-server-obsidian` | Obsidian 知识库 | uvx |
| `mcp-server-jira` | Jira | uvx |
| `mcp-server-confluence` | Confluence | uvx |
| `mcp-server-linear` | Linear | uvx |
| `mcp-server-figma` | Figma | uvx |
| `mcp-server-stripe` | Stripe | uvx |
| `mcp-server-kubernetes` | K8s 操作 | uvx |
| `mcp-server-aws` | AWS CLI 风格 | uvx |
| `mcp-server-time` | 时区/日历 | uvx |
| `mcp-server-puppeteer-extra` | 浏览器+vision | npx |

> 完整列表见 [mcpservers.org](https://mcpservers.org/) / [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers)。

## 8.8 自己写 MCP Server

最常见做法是用 [official Python/TypeScript SDK](https://github.com/modelcontextprotocol)。一个最小 Python 例子：

```python
# my_mcp_server.py
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("my-tools")

@mcp.tool()
def fortune(category: str = "default") -> str:
    """返回一句随机箴言。"""
    return "..."

if __name__ == "__main__":
    mcp.run()
```

启动方式：在 `config.yaml`：

```yaml
mcp_servers:
  my-tools:
    command: "python"
    args: ["/abs/path/my_mcp_server.py"]
```

更多见官方 [MCP 教程](https://modelcontextprotocol.io/) 与 Hermes `guides/use-mcp-with-hermes.md`。

## 8.9 MCP vs Hermes 内置工具：什么时候选哪个

| 选 MCP | 选写 Hermes 插件 |
|--------|------------------|
| 已有现成 server | 没有现成方案 |
| 跨多个 Agent 复用 | 仅 Hermes 用 |
| 想跨网络调用 | 仅本地 |
| 不想维护 Hermes 源代码 | 想深度结合 Hermes 内部 hook/事件 |
| 不需要访问 Hermes 内部状态 | 需要 |

## 8.10 Context Files：项目级"自动上下文"

除了 MCP 这种"工具协议"，Hermes 还有一项让它在每个项目里"立刻知道你在做什么"的能力：**Context Files**。

启动时（CLI 模式）Hermes 会从当前工作目录起向上递归，自动加载这些文件：

| 文件名 | 来源/惯例 | 作用 |
|--------|-----------|------|
| `.hermes.md` | Hermes 原生 | 项目级针对 Hermes 的指引 |
| `AGENTS.md` | OpenAI / SWE-agent / Aider 等共享惯例 | 项目级 Agent 指引 |
| `CLAUDE.md` | Anthropic Claude Code | 项目级 Claude 指引 |
| `SOUL.md` | OpenClaw 时代 | 注意：仅从 `$HERMES_HOME` 加载身份，**不**从工作目录读 |
| `.cursorrules` | Cursor IDE | 项目级 Cursor 规则 |

这些文件以一个统一节注入系统提示（在 MEMORY 之后、Tool schema 之前）。**它们是"项目特征"，记忆是"长期画像"，二者各司其职。**

### 8.10.1 一个典型 `AGENTS.md`

```markdown
# Project Conventions for AI Agents

## Tech stack
- Python 3.11, FastAPI, SQLAlchemy 2.x, PostgreSQL
- pre-commit + ruff + black + pytest

## Working agreements
- Always run `pytest -x` before claiming the task done
- All new endpoints must include OpenAPI docstrings
- Migrations use Alembic; never run `alembic upgrade` without showing the SQL diff first

## Where to look
- HTTP layer: `src/api/`
- DB models: `src/db/models.py`
- Configuration: `src/config.py` (env-driven)

## Things Agents should never do
- Don't touch `data/migrations/0001_init.py`
- Don't `pip install` outside Poetry
```

把它放在仓库根，Hermes 在该目录下启动后立刻知道"这个项目用 FastAPI，跑 pytest -x，别动 0001 迁移"。

### 8.10.2 多文件协作

Hermes 默认会同时加载多个 context file 名字（按上面的列表），它们之间无优先级，全部拼接成"项目上下文"块。这样：

- 同一个仓库可以同时容纳 Aider/Cursor/Claude Code/Hermes 的指令；
- 不同 Agent 都能读到自己关心的文件。

### 8.10.3 配置控制

```yaml
context_files:
  enabled: true
  filenames:
    - .hermes.md
    - AGENTS.md
    - CLAUDE.md
    - .cursorrules
  search_upward: true        # 一直向上找直到 root 或 git root
  max_total_chars: 24000     # 上限，避免某个超大文件挤爆系统提示
```

### 8.10.4 与 SOUL.md 的关系

注意：`SOUL.md` **不会**从当前目录读，它只从 `$HERMES_HOME/SOUL.md` 加载，并占据系统提示的"身份"槽位（slot #1）。这是为了让"人格"不随项目漂移。

如果你想"为某个项目设一个不同人格"，正确做法是用 `/personality <name>` overlay，而不是改 `SOUL.md`。

## 8.11 Context References：`@` 即时上下文

第四章简单提到过 `@`，这里再次强调它和 context files 的关系：

- **Context Files** 是"项目级、每次开会都注入"；
- **@ 引用** 是"这条消息临时引入"；
- 二者互补；MCP resources 是"工具可触达的远端文件/记录"。

## 8.12 实战：把 Hermes 变成"GitHub + Postgres + 文件系统"全能助理

```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/me/projects"]

  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
    tools:
      allow:
        - search_repositories
        - get_file_contents
        - list_pull_requests
        - create_pull_request
        - merge_pull_request
        - list_issues

  postgres:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-postgres",
           "postgres://readonly:***@db.internal/myapp"]
```

然后在仓库放：

```
~/code/myapp/
├── AGENTS.md
└── ...
```

效果：Hermes 在 `~/code/myapp/` 里启动后，

- 自动读到项目 AGENTS.md 知道约定；
- 用 `mcp_filesystem_*` 操作 `~/me/projects/`；
- 用 `mcp_github_*` 浏览/合并 PR；
- 用 `mcp_postgres_*` 跑只读 SQL 调研数据；
- 同时仍可以用 Hermes 内置的 `terminal`、`patch`、`memory`、`session_search`。

一个对话就能涵盖 issue → 调研 → 写代码 → 跑测试 → 起 PR 全流程。

## 8.13 调试 MCP

```bash
hermes mcp list                        # 当前启用的 MCP server
hermes mcp inspect <server>            # 看 schema、工具列表
hermes mcp test <server> tools/list    # 直接打方法
HERMES_LOG_LEVEL=debug hermes          # 看运行时日志
```

常见坑：

- `npx` 第一次拉很慢——可以预先 `npm i -g <package>`；
- env 变量没注入——记得 `${VAR}` 形式 + `.env` 内有定义；
- HTTP server 401——检查 `headers.Authorization`；
- 工具数量爆炸——用 `tools.allow` 缩小范围。

## 8.14 本章小结

- **MCP** 是 Hermes 与外部工具世界互通的最干净协议，stdio + HTTP + OAuth 全支持；
- 启用方式仅需 `mcp_servers:` 几行 YAML，Hermes 启动时自动发现注册；
- per-server 工具过滤、prompts、resources 一应俱全；
- **Context Files**（`.hermes.md`、`AGENTS.md`、`CLAUDE.md`、`.cursorrules`）让 Hermes 进入项目即"懂规矩"；
- **MCP + Context Files + 内置工具 + 技能**四件套，几乎能覆盖你 95% 的工程任务。

下一章我们把 Hermes "扩散"出去：消息网关与 15+ 平台接入。

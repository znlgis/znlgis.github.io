---
layout: default
title: 第八章：工具、权限与 MCP 扩展
---

# 第八章：工具、权限与 MCP 扩展

工具（Tools）是 LLM 在你代码库里「动手」的能力，权限（Permission）系统决定每个动作是放行、询问还是禁止，MCP 则把外部能力接入进来。本章讲透三者，并强调它们与安全、上下文体积、Token 成本的关系。

---

## 8.1 内置工具一览

OpenCode 默认**启用全部工具且无需确认**。内置工具包括：

| 工具 | 作用 | 受控权限键 |
|------|------|-----------|
| `bash` | 执行 shell 命令 | `bash` |
| `read` | 读取文件内容（支持按行范围） | `read` |
| `edit` | 精确字符串替换修改文件 | `edit` |
| `write` | 创建/覆盖文件 | `edit` |
| `apply_patch` | 以补丁方式修改 | `edit` |
| `grep` | 用正则搜索文件内容 | `grep` |
| `glob` | 按 glob 匹配文件 | `glob` |
| `list` | 列目录 | `list` |
| `lsp`（实验） | 语言服务器查询 | `lsp` |
| `skill` | 加载 Skill | `skill` |
| `todowrite` / `todoread` | 任务清单 | `todowrite` |
| `webfetch` | 抓取 URL | `webfetch` |
| `websearch` | 联网搜索 | `websearch` |
| `question` | 执行中向用户提问 | `question` |
| `task` | 启动子代理 | `task` |

注意：`write`、`edit`、`apply_patch` 三者都由 **`edit`** 权限统一管控。

### 用 `tools` 开关工具（旧语法）

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "tools": { "write": false, "bash": false }
}
```

> 自 `v1.1.1` 起，布尔型 `tools` 已**废弃**并并入 `permission`（仍向后兼容）。新配置请优先用 `permission`，它更细粒度。

---

## 8.2 权限系统：allow / ask / deny

每条权限规则解析为三者之一：

- `"allow"` —— 无需确认直接运行
- `"ask"` —— 提示你批准
- `"deny"` —— 阻止该动作

### 基本配置

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "bash": "allow",
    "edit": "deny"
  }
}
```

也可以一句话全开：`"permission": "allow"`。

### 默认值

不配置时，OpenCode 采用宽松默认：

- 多数权限默认 `allow`；
- `doom_loop`（同一工具调用连续 3 次相同输入）和 `external_directory`（触碰工作区外路径）默认 `ask`；
- `read` 默认 `allow`，但 `.env` 文件默认 `deny`：

```json title="opencode.json"
{
  "permission": {
    "read": {
      "*": "allow",
      "*.env": "deny",
      "*.env.*": "deny",
      "*.env.example": "allow"
    }
  }
}
```

---

## 8.3 细粒度规则（对象语法）

多数权限支持「输入模式 → 动作」的对象语法，可按 bash 命令、按文件路径精确控制：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "npm *": "allow",
      "rm *": "deny",
      "grep *": "allow"
    },
    "edit": {
      "*": "deny",
      "packages/web/src/content/docs/*.mdx": "allow"
    }
  }
}
```

**关键规则**：按模式匹配，**最后一条命中的规则生效**。惯用法是把兜底的 `"*"` 放最前，具体规则放后面。

通配符：`*` 匹配零或多个任意字符，`?` 匹配恰好一个字符，其余字符字面匹配。

### 外部目录

`external_directory` 控制工具触碰「OpenCode 启动目录之外」的路径（任何接受路径输入的工具，如 `read`/`edit`/`glob`/`grep` 与许多 bash 命令）。可用 `~` 或 `$HOME` 开头：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "external_directory": { "~/projects/personal/**": "allow" },
    "edit": { "~/projects/personal/**": "deny" }
  }
}
```

被允许的外部目录继承工作区默认权限；由于 `read` 默认 allow，这些目录的读取也会被允许，除非显式覆盖。请把列表聚焦在可信路径上。

### 「Ask」时的三个选项

当 OpenCode 提示批准时，UI 给出：

- `once` —— 仅批准本次；
- `always` —— 批准未来匹配建议模式的请求（仅本次 OpenCode 会话内有效）；
- `reject` —— 拒绝。

`always` 会按工具提供的模式（如 bash 的安全前缀 `git status*`）放行后续同类请求。

---

## 8.4 安全实践建议

虽然默认全开很方便，但在以下场景应主动收紧权限：

- **不熟悉的仓库 / 第三方代码**：用 `plan` 默认 Agent，把 `edit`/`bash` 设为 `ask`。
- **CI / 自动化**：精确白名单允许的 bash 命令，`deny` 掉 `rm *`、`git push *` 等危险操作。
- **保护敏感文件**：`read` 里 `deny` 掉密钥、凭证文件（`.env` 已默认拒绝）。

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "git commit *": "deny",
      "git push *": "deny",
      "grep *": "allow"
    }
  },
  "agent": {
    "build": {
      "permission": {
        "bash": {
          "*": "ask",
          "git *": "allow",
          "git commit *": "ask",
          "git push *": "deny",
          "grep *": "allow"
        }
      }
    }
  }
}
```

> 提示：带参数的命令要用模式匹配。`"grep *"` 能放行 `grep pattern file.txt`，而单独的 `"grep"` 会拦截它。

---

## 8.5 MCP 服务器：接入外部工具

通过 **Model Context Protocol（MCP）**，OpenCode 可接入本地或远程的外部工具，接入后自动与内置工具并列供 LLM 使用。

### 重要警告：MCP 会吃 Token

> **每个 MCP 服务器都会把它的工具描述加进上下文。** 工具一多，Token 迅速膨胀。某些 MCP（如 GitHub 官方 MCP）会注入大量 Token，甚至轻易超出上下文上限。

因此原则是：**只启用真正需要的 MCP，并对不用的随时禁用**。这是 MCP 场景下最重要的省 Token 纪律（第九章再次强调）。

### 本地 MCP

```jsonc title="opencode.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-local-mcp-server": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-command"],
      "enabled": true,
      "environment": { "MY_ENV_VAR": "value" }
    }
  }
}
```

本地 MCP 选项：`type`（必填，`"local"`）、`command`（必填，命令与参数数组）、`environment`、`enabled`、`timeout`（拉取工具超时，默认 5000ms）。

### 远程 MCP

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "my-remote-mcp": {
      "type": "remote",
      "url": "https://my-mcp-server.com",
      "enabled": true
    }
  }
}
```

### 随时禁用而不删除

把 `enabled` 设为 `false` 即可临时关闭某个 MCP，保留配置便于以后再开。组织通过远程配置下发的 MCP，也可在本地用 `enabled: true` 按需开启（本地值覆盖远程默认）。

### 用权限统一管控 MCP 工具

权限键作为通配模式匹配工具名，因此可一键管控某 MCP 的全部工具：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": { "mymcp_*": "ask" }
}
```

也可在 Agent 内 `"mymcp_*": "deny"` 让特定 Agent 完全看不到该 MCP，从而**不为它支付任何上下文成本**。

---

## 8.6 其它扩展：插件与自定义工具

- **插件（Plugins）**：用自定义工具、钩子（hooks）、集成扩展 OpenCode。放在 `.opencode/plugins/` 或 `~/.config/opencode/plugins/`，也可从 npm 加载：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-helicone-session", "@my-org/custom-plugin"]
}
```

- **自定义工具（Custom Tools）**：用代码定义专属工具，供 Agent 调用（详见官方 custom-tools 文档）。

---

## 8.7 配套能力：格式化器与 LSP

### 格式化器（Formatter）

默认关闭。设 `"formatter": true` 启用内置；用对象可在保留内置的同时覆盖或加自定义：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "formatter": {
    "prettier": { "disabled": true },
    "custom-prettier": {
      "command": ["npx", "prettier", "--write", "$FILE"],
      "environment": { "NODE_ENV": "development" },
      "extensions": [".js", ".ts", ".jsx", ".tsx"]
    }
  }
}
```

### LSP 服务器

默认关闭。`"lsp": true` 启用内置；用对象覆盖或加自定义：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "lsp": { "typescript": { "disabled": true } }
}
```

LSP 让模型获得诊断、跳转等语言智能，能减少「猜代码」式的反复试探，间接提升效率。

---

## 8.8 小结

本章你掌握了内置工具集、权限系统（allow/ask/deny、对象语法、外部目录、默认值与安全实践）、MCP 接入与其 Token 风险、以及插件、格式化器、LSP 等配套扩展。**收紧权限、裁剪工具、克制启用 MCP**，既是安全实践，也是省 Token 的直接手段——下一章将把这些线索汇总为系统化的最优化方案。

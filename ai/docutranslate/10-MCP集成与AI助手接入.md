---
layout: default
title: 第十章：MCP 集成与 AI 助手接入
---

# 第十章：MCP 集成与 AI 助手接入

DocuTranslate 可以作为一个 **MCP（Model Context Protocol）服务器** 运行，从而被支持 MCP 的 AI 助手（如 Claude Desktop、Cherry Studio、Windsurf 等）直接调用。这意味着你可以在与 AI 助手对话时，让它「帮我把这个 PDF 翻译成中文」，由 DocuTranslate 在后台完成翻译。本章讲解 MCP 的安装、四种运行模式、工具集与客户端配置。

---

## 10.1 什么是 MCP，为什么要用

MCP 是一套让 AI 助手调用外部工具 / 数据源的标准协议。把 DocuTranslate 暴露为 MCP 服务器后：

- AI 助手获得「翻译文件」这项能力，可在对话中自然调用；
- 翻译任务由 DocuTranslate 后端异步执行，助手负责编排（提交、查询、下载）；
- 你无需离开助手界面即可完成文档翻译。

---

## 10.2 安装 MCP 扩展

MCP 功能需要额外的依赖：

```bash
pip install docutranslate[mcp]
# 或 uv：uv add docutranslate[mcp]
```

---

## 10.3 四种运行模式

### 模式一：Stdio（推荐用于 Claude Desktop、Windsurf）

```bash
docutranslate --mcp
```

Stdio 模式通过标准输入输出通信，适合桌面类客户端直接拉起进程。

### 模式二：SSE（推荐用于 Cherry Studio）

```bash
docutranslate --mcp --transport sse --mcp-host 127.0.0.1 --mcp-port 8000
```

客户端配置 SSE 端点：`http://127.0.0.1:8000/mcp/sse`。

### 模式三：Streamable HTTP

```bash
docutranslate --mcp --transport streamable-http --mcp-host 127.0.0.1 --mcp-port 8000
```

### 模式四：Web UI + MCP 联合（推荐！）

```bash
docutranslate -i --with-mcp
```

这会同时启动：

- Web UI：`http://127.0.0.1:8010`
- MCP SSE 端点：`http://127.0.0.1:8010/mcp/sse`
- **任务在 Web UI 与 MCP 之间共享**（同一队列）！

联合模式下 MCP 自动复用 Web 后端的 host 和端口，非常适合「既想用网页界面、又想让 AI 助手调用」的场景。

---

## 10.4 客户端配置示例

### 使用 uvx（无需预先安装）

```json
{
  "mcpServers": {
    "docutranslate": {
      "command": "uvx",
      "args": ["--from", "docutranslate[mcp]", "docutranslate", "--mcp"],
      "env": {
        "DOCUTRANSLATE_API_KEY": "sk-xxxxxx",
        "DOCUTRANSLATE_BASE_URL": "https://api.openai.com/v1",
        "DOCUTRANSLATE_MODEL_ID": "gpt-4o",
        "DOCUTRANSLATE_TO_LANG": "中文",
        "DOCUTRANSLATE_CONCURRENT": "10",
        "DOCUTRANSLATE_CONVERT_ENGINE": "mineru",
        "DOCUTRANSLATE_MINERU_TOKEN": "your-mineru-token"
      }
    }
  }
}
```

### 使用虚拟环境的 Python 解释器

官方强调：**在 MCP 配置中务必使用虚拟环境里的 Python 解释器完整路径**，以确保依赖可用。

```json
{
  "mcpServers": {
    "docutranslate": {
      "command": "/path/to/your/venv/bin/python",
      "args": ["-m", "docutranslate.mcp"],
      "env": {
        "DOCUTRANSLATE_API_KEY": "sk-xxxxxx",
        "DOCUTRANSLATE_BASE_URL": "https://api.openai.com/v1",
        "DOCUTRANSLATE_MODEL_ID": "gpt-4o",
        "DOCUTRANSLATE_TO_LANG": "中文",
        "DOCUTRANSLATE_MINERU_TOKEN": "your-mineru-token"
      }
    }
  }
}
```

Windows 下把 `command` 换成 `C:\\path\\to\\your\\venv\\Scripts\\python.exe`。若 `docutranslate` 已在 PATH 中，也可直接用 `"command": "docutranslate"`、`"args": ["--mcp"]`。

---

## 10.5 MCP 工具集参考

DocuTranslate MCP 服务器提供以下工具（供 AI 助手调用）：

| 工具 | 说明 |
|:---|:---|
| `submit_task` | 提交翻译任务，立即返回 `task_id` |
| `get_task_status` | 查询任务状态；完成时展示所有格式与附件 |
| `download_file` | 把译文或附件下载到本地文件系统 |
| `release_task` | 释放任务资源（临时文件等） |
| `cancel_task` | 取消待处理或运行中的任务 |
| `load_glossary_file` | 加载术语表文件（JSON 或 CSV）供 `submit_task` 使用 |
| `configure_client` | 配置客户端 LLM 设置 |
| `get_client_config` | 获取当前配置（不含敏感信息） |
| `get_status` | 获取服务器状态与信息 |
| `get_supported_formats` | 获取支持的格式列表 |

### submit_task 关键参数

- `file_path`（必填）：文件路径，或以 `http://` / `https://` 开头的 URL。
- `api_key` / `base_url` / `model_id` / `to_lang`：覆盖客户端默认配置。
- `workflow_type`：工作流类型。
- `convert_engine`：PDF 转换引擎。
- `mineru_token`：MinerU Token。
- 以及其他大量高级参数（与 SDK 参数一致）。

### 典型对话式工作流

```
1. submit_task(file_path="doc.pdf", api_key="sk-...", model_id="gpt-4o")
   → task_id = "abc-123"

2. get_task_status("abc-123")
   → { "status": "running", "progress_percent": 45 }

3. get_task_status("abc-123")   # 完成时
   → 翻译完成！可用格式：docx, html, markdown

4. download_file("abc-123", fmt="docx", ...)
   → 保存到本地
```

AI 助手会自动按此顺序编排调用，你只需用自然语言下达翻译指令。

---

## 10.6 通过环境变量配置 MCP

MCP 服务器的默认行为主要通过环境变量控制（在客户端配置的 `env` 中设置）。核心环境变量：

| 环境变量 | 说明 | 必需 |
|:---|:---|:---|
| `DOCUTRANSLATE_API_KEY` | AI 平台 API 密钥 | 是 |
| `DOCUTRANSLATE_BASE_URL` | AI 平台基础 URL | 是 |
| `DOCUTRANSLATE_MODEL_ID` | 模型 ID | 是 |
| `DOCUTRANSLATE_TO_LANG` | 目标语言（默认：中文） | 否 |
| `DOCUTRANSLATE_CONCURRENT` | 并发请求数（默认：10） | 否 |
| `DOCUTRANSLATE_CONVERT_ENGINE` | PDF 转换引擎 | 否 |
| `DOCUTRANSLATE_MINERU_TOKEN` | MinerU API Token | 否 |

完整环境变量清单见第十一章。

---

## 10.7 小结

- MCP 让 AI 助手直接调用 DocuTranslate 翻译能力。
- 四种模式：stdio（桌面客户端）、sse（Cherry Studio）、streamable-http、以及 Web+MCP 联合（`-i --with-mcp`，共享任务队列，最推荐）。
- 配置时用虚拟环境 Python 完整路径，或用 uvx 免安装。
- 工具集覆盖提交、查询、下载、取消、术语表加载与配置查询；模型信息通过 `env` 环境变量注入。
- 下一章系统整理所有环境变量与部署配置。

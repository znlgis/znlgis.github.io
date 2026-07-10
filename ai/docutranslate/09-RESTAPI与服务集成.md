---
layout: default
title: 第九章：REST API 与服务集成
---

# 第九章：REST API 与服务集成

除了 Web 界面和 Python SDK，DocuTranslate 还内置了一个功能齐全的 **RESTful API** 服务。这让你可以把 DocuTranslate 作为一个后端服务，供任意语言的程序、前端应用、自动化流程调用。本章讲解服务的启动、命令行参数、API 结构与集成注意事项。

---

## 9.1 启动 API 服务

Web UI 与 REST API 是**同一个服务**——启动 `docutranslate -i` 后，Web 界面和 API 同时可用：

```bash
docutranslate -i
```

- Web 界面：`http://127.0.0.1:8010`
- **API 文档（Swagger UI）**：`http://127.0.0.1:8010/docs`

Swagger UI 会列出所有可用的 API 端点、请求参数与响应结构，并支持在线试用。**这是了解 API 最权威、最实时的入口**——因为端点会随版本演进，本章讲原理与用法，具体字段请以 `/docs` 为准。

---

## 9.2 命令行参数详解

`docutranslate` 的命令行参数（来自 `cli.py`）：

| 参数 | 说明 | 默认 |
|:---|:---|:---|
| `-i`, `--interactive` | 启动图形界面（GUI）并启动后端服务 | - |
| `--host` | 服务监听地址；局域网访问设 `0.0.0.0` | `127.0.0.1` |
| `-p`, `--port` | 服务监听端口 | `8010` |
| `--cors` | 启用跨域资源共享（CORS） | 关闭 |
| `--cors-regex` | CORS 允许的 Origin 正则 | `^(https?://.*\|null\|file://.*)$` |
| `--mcp` | 启动 MCP 服务器（AI 助手集成，见第十章） | - |
| `--with-mcp` | 启动 Web UI 同时启用 MCP SSE 端点（共用队列） | - |
| `--transport` | MCP 传输方式：`stdio`、`sse`、`streamable-http` | `stdio` |
| `--mcp-host` | MCP 监听地址（sse/streamable-http 模式） | `127.0.0.1` |
| `--mcp-port` | MCP 监听端口（sse/streamable-http 模式） | `8000` |
| `--version` | 查看版本号 | - |
| `--help` | 查看全部参数 | - |

---

## 9.3 局域网与多人使用

DocuTranslate 支持**局域网内多人同时使用**。要开放给其他设备：

```bash
docutranslate -i --host 0.0.0.0 -p 8010
```

然后其他人用 `http://<服务器局域网IP>:8010` 访问。所有人的任务进入同一个后端**任务队列**，异步执行、互不阻塞。这非常适合小团队共享一台配置好模型 Key 的机器。

> ⚠️ 安全提示：`--host 0.0.0.0` 会让服务暴露在网络上。如果机器可被更大范围访问，务必配合防火墙、反向代理认证等手段，避免 API-Key 与翻译服务被滥用。

---

## 9.4 跨域（CORS）与前后端分离

如果你要做**前后端分离**的应用（前端页面调用 DocuTranslate 的 API），浏览器会有跨域限制，需要开启 CORS：

```bash
# 启用默认 CORS 规则
docutranslate -i --cors

# 自定义允许的 Origin 正则
docutranslate -i --cors --cors-regex "^https://myapp\.example\.com$"
```

`--cors-regex` 默认允许所有 HTTP/HTTPS、`null` 与 `file://` 来源，生产环境应收紧为你自己的域名。

---

## 9.5 API 的典型调用流程

DocuTranslate 的翻译是**异步任务式**的（尤其 PDF 解析耗时较长），典型 API 调用流程是「提交任务 → 轮询状态 → 下载结果」：

1. **提交翻译任务**：把文件（或 URL）和模型配置 POST 给服务，立即拿到一个 `task_id`，不阻塞。
2. **查询任务状态**：用 `task_id` 轮询，获取进度百分比、日志、状态（running / completed / error）。
3. **获取 / 下载结果**：任务完成后，按需要的格式下载译文（可能有多种格式和附件）。
4. **释放 / 取消任务**：完成后释放临时资源，或在运行中取消任务。

这与 MCP 工具的设计一致（`submit_task` / `get_task_status` / `download_file` / `release_task` / `cancel_task`，见第十章），因为二者共用同一套后端任务队列。

> 具体的端点路径、请求体字段、响应结构请打开 `http://127.0.0.1:8010/docs` 查看并在线调试——这是最准确的参考。

---

## 9.6 用环境变量预置默认配置

在服务化部署时，通常不希望每次请求都传一堆模型参数。可以用**环境变量**为后端预置默认值（详见第十一章），例如：

```bash
export DOCUTRANSLATE_API_KEY=sk-xxxx
export DOCUTRANSLATE_BASE_URL=https://api.deepseek.com/v1
export DOCUTRANSLATE_MODEL_ID=deepseek-chat
export DOCUTRANSLATE_TO_LANG=中文
docutranslate -i --host 0.0.0.0
```

配合两个开关控制环境变量与请求参数的优先级：

- `DOCUTRANSLATE_ENV_FORCE_OVERRIDE=true`：强制使用 `.env` 中设置的值，忽略请求传参（适合锁定统一配置）。
- `DOCUTRANSLATE_ENV_FORCE_OVERRIDE=false`（默认）：仅当请求未传该参数时才用 `.env` 的默认值。
- `DOCUTRANSLATE_WEB_SKIP_VALIDATION=true`：让 Web 前端跳过空值校验，直接使用后端默认值。

这样前端 / 调用方可以只上传文件，模型配置由服务端统一管理。

---

## 9.7 集成建议

- **异步优先**：提交任务后轮询，不要期望一次请求同步返回结果（大文件会超时）。
- **限流保护**：多用户 / 批量场景下，用 `rpm`、`tpm`、`concurrent` 控制对大模型平台的压力，避免触发限速或产生意外费用。
- **持久化输出**：容器部署时挂载卷保存 `./output`，或及时通过 API 下载后清理任务。
- **鉴权**：DocuTranslate 本身面向可信网络设计；对外提供服务时请在反向代理层加认证（如 Basic Auth、API 网关）。
- **缓存复用**：PDF 解析结果有内存缓存（`DOCUTRANSLATE_CACHE_NUM`），同一文件反复调参时可复用，节省解析开销。

---

## 9.8 小结

- REST API 与 Web UI 是同一服务，`docutranslate -i` 一起启动，文档在 `/docs`。
- 命令行参数控制监听地址、端口、CORS、MCP 等；`--host 0.0.0.0` 开放局域网 / 多人。
- 翻译走「提交任务 → 轮询状态 → 下载结果」的异步模式。
- 服务化部署用环境变量预置模型配置，并注意鉴权、限流与输出持久化。
- 下一章讲另一种「服务化」形态——把 DocuTranslate 作为 MCP 服务器接入 AI 助手。

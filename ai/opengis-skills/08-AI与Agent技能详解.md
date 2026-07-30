---
layout: default
title: 第八章：AI 与 Agent 技能详解
---

# 第八章：AI 与 Agent 技能详解

本章详细介绍 opengis-skills 中 `ai/` 分类下的 **8 个 AI/Agent 技能**。与 GIS、CAD、C# 等面向具体开发领域的技能不同，AI 分类的技能聚焦于**AI 工具本身的使用、配置和扩展**——它们帮助你更高效地构建 AI 应用、编排编码代理、管理多模型协作，以及用 AI 方法论提升编程质量。

这 8 个技能覆盖了从"搭建 LLM 应用平台"到"配置终端编码代理"、从"自学习通用智能体"到"多通道个人 AI 助手"、从"AI 编程方法论"到"大模型文档翻译"的完整链路。无论你是想快速搭一个 RAG 问答机器人、配置开发环境中的 AI 编码助手、还是用大模型批量翻译技术文档，本章都能提供详尽的指导。

阅读本章后，你将能够：

- 用 dify 在 10 分钟内搭建一个带知识库的 GIS 辅助问答机器人
- 理解 opencode / pi / oh-my-openagent 三个编码代理的定位差异和适用场景
- 部署自学习 Agent（hermes-agent）和多通道 AI 网关（openclaw）
- 运用 superpowers-zh 方法论提升 AI 辅助编程的质量
- 使用 docutranslate 批量翻译 GIS/CAD 技术文档并保留原排版

---

## 8.1 AI 技能全景

opengis-skills 的 `ai/` 分类下共包含 8 个技能文件，按应用场景可分为五大类：

| 技能 | 类型 | 一句话说明 | 核心能力 |
|------|------|-----------|----------|
| **dify** | LLM 平台 | 开源 LLM 应用开发平台，可视化编排工作流 | 四类应用（Chatbot/Agent/Workflow/Chatflow）、RAG 知识库、30+ 模型供应商 |
| **opencode** | 编码代理 | 开源终端 AI 编码代理，模型无关 | 75+ 模型提供商、权限系统、Agent/子代理体系、MCP Server 集成 |
| **pi** | 编码代理 | 极简终端 Agent Harness，容器隔离 | 多 Provider 抽象、四工具、Docker 沙箱执行 |
| **oh-my-openagent** | 编排增强 | OpenCode 多模型编排和增强 | 并行 Agent、AST/LSP 工具集成、MCP 集成、插件系统 |
| **hermes-agent** | 自主 Agent | 自学习通用 AI 智能体 | 经验池、环境探索、动态任务分解、跨会话记忆 |
| **openclaw** | AI 网关 | 多通道个人 AI 助手网关 | Gateway 架构、排队/缓冲/负载均衡、多端支持 |
| **superpowers-zh** | 方法论 | 中文 AI 编程方法论 Skills 集合 | TDD、系统化调试、头脑风暴、代码审查、执行计划 |
| **docutranslate** | 文档翻译 | 基于大模型的本地文档翻译工具 | MinerU 解析、多格式支持、排版保护、本地运行 |

> **关键洞察**：这 8 个技能并非互相替代，而是互补关系。dify 负责"搭应用"，opencode/pi/oh-my-openagent 负责"写代码"，hermes-agent/openclaw 负责"自主执行"，superpowers-zh 负责"方法论指导"，docutranslate 负责"文档翻译"。在一个典型的 GIS 项目中，你可能会同时用到其中 3-4 个技能。

### 8.1.1 技能之间的协作关系

下表展示了各 AI 技能之间的典型协作场景：

| 场景 | 涉及的技能 | 协作方式 |
|------|-----------|----------|
| 用 opencode 编码时遵循 TDD 流程 | opencode + superpowers-zh | superpowers-zh 提供方法论引导，opencode 执行编码任务 |
| 搭建 GIS 知识库后用 opencode 调用 | dify + opencode | dify 搭建 RAG 知识库提供 API，opencode 通过 MCP 集成调用 |
| 多 Agent 并行处理 GIS 数据转换 | oh-my-openagent + opencode | oh-my-openagent 编排多个 opencode 实例，分别处理不同文件 |
| 翻译 GIS 文档后喂给 RAG 知识库 | docutranslate + dify | docutranslate 翻译文档，导入 dify 知识库作为语料 |
| 自学习 Agent 持续优化 GIS 脚本 | hermes-agent + opencode | hermes-agent 调用 opencode 执行代码，从经验池学习最优模式 |
| 多端 AI 助手统一管理 | openclaw + 其他 Agent | openclaw 作为入口，路由请求到 dify API、opencode 等后端 |

---

## 8.2 LLM 应用平台：dify

### 8.2.1 项目概述

dify 是一个开源的 LLM 应用开发平台，其核心价值在于**让非程序员也能通过可视化界面搭建 AI 应用**。它抽象掉了模型调用、向量检索、工作流编排等底层复杂性，提供拖拽式节点编排和对话—工作流混合模式。

- **仓库地址**：[https://github.com/langgenius/dify](https://github.com/langgenius/dify)
- **官方文档**：[https://docs.dify.ai](https://docs.dify.ai)
- **开源协议**：Apache-2.0（支持商业闭源）
- **部署方式**：Docker Compose 一键部署

dify 的定位介于"直接调用 LLM API"和"从头开发 AI 应用"之间——它提供的抽象层级恰到好处：低到保留了对模型、Prompt、上下文的自定义能力，高到不需要写前端代码就能得到一个可分享的 Web 应用。

### 8.2.2 核心概念：四类应用

dify 定义了四种应用类型，每种面向不同的交互模式：

| 应用类型 | 交互模式 | 典型场景 | 特点 |
|----------|----------|----------|------|
| **Chatbot** | 多轮对话 | 客服机器人、问答助手 | 支持对话变量、上下文记忆、知识库引用 |
| **Agent** | 推理—行动循环 | 数据查询、工具调用 | LLM 自主选择工具、调用 API、多步推理 |
| **Workflow** | 批量/自动化流程 | 文档处理、数据流水线 | 固定流程，高可靠性，可复现 |
| **Chatflow** | 对话中的工作流 | 引导式问答、表单式收集 | 对话 + 工作流混合，适用于需要收集多步信息的场景 |

**Chatbot 与 Agent 的区别**：Chatbot 是"被动应答"——用户问什么答什么；Agent 是"主动推理"——LLM 自主决定使用哪个工具、查询什么数据、以什么顺序执行动作。Agent 模式下，dify 会维护一个 ReAct（Reasoning + Acting）循环，直到任务完成或达到最大步数限制。

**Workflow 与 Chatflow 的区别**：Workflow 是一次性触发的自动化流程（例如上传 PDF → 分段 → 翻译 → 输出 Markdown）；Chatflow 是会暂停等待用户输入的对话式流程（例如逐步收集用户需求再生成报告）。Chatflow 本质上是 Workflow 中插入了等待用户输入的节点。

### 8.2.3 RAG 知识库流水线

dify 的知识库模块实现了一条完整的 RAG（Retrieval-Augmented Generation）流水线：

```
文档上传 → 分段策略 → 向量化 → 索引存储 → 检索重排 → 上下文注入
```

**分段策略**（Chunking）是决定检索质量的关键环节。dify 支持多种分段模式：

| 分段模式 | 适用内容 | 参数要点 |
|----------|----------|----------|
| **自动分段** | 通用文档 | 按语义边界自动分割，无需手动调参 |
| **固定长度分段** | 代码、结构化文本 | 需设置 chunk_size（推荐 512-1024 tokens）和 overlap（推荐 10-20%） |
| **按分隔符分段** | Markdown、技术文档 | 按 `##`、`###` 等标题分段，保留文档结构 |
| **子分段** | 长文档中的长段落 | 大段落自动再拆分，检索时返回父段上下文 |

对于 GIS 技术文档（GDAL 手册、CesiumJS API 参考等），**推荐使用"按分隔符分段"模式**——这类文档天然具有清晰的层级结构，按 `##` 分段能保留"函数签名 → 参数说明 → 返回值 → 示例"的完整上下文。

**向量化模型选择**：dify 默认使用 OpenAI 的 `text-embedding-3-small`，但也支持：
- 国产模型：智谱 Embedding、百度 Qianfan、阿里通义
- 开源模型：BGE-M3、Jina Embeddings v3
- 本地模型：Ollama 部署的 nomic-embed-text 等

对于中文 GIS 文档，推荐使用 BGE-M3 或智谱 Embedding——它们在中文语义理解上表现优于 OpenAI 的通用模型。

**检索设置**：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 检索方式 | 混合检索 | 同时使用向量检索（语义）+ 关键词检索（BM25），互补优势 |
| 重排序模型 | Cohere Rerank / BGE-Reranker | 对初检结果二次排序，推荐开启 |
| TopK | 3-5 | 返回最相关的 3-5 个分段，太多会稀释关键信息 |
| Score 阈值 | 0.5-0.7 | 低于此分数的分段不返回，避免引入噪声 |

### 8.2.4 可视化工作流编排

dify 工作流的核心是**拖拽式节点编排**——将各类功能节点连接成有向无环图（DAG），定义数据在各节点间的流转路径。

**节点类型一览**：

| 节点分类 | 具体节点 | 用途 |
|----------|----------|------|
| **开始/结束** | Start、End | 定义输入变量和输出结果 |
| **LLM** | LLM | 调用大模型，配置 System/User Prompt、模型参数 |
| **知识检索** | Knowledge Retrieval | 从知识库中检索相关文档分段 |
| **代码** | Code | 在 Python/JavaScript 沙箱中执行自定义逻辑 |
| **条件分支** | IF/ELSE、条件分支 | 根据变量值分流不同路径 |
| **HTTP 请求** | HTTP Request | 调用外部 API，支持 GET/POST/PUT 等 |
| **参数提取** | Parameter Extractor | 从 LLM 输出或用户输入中提取结构化参数 |
| **模板转换** | Template | 使用 Jinja2 模板将多个变量拼接为文本 |
| **变量操作** | Variable Assigner、Variable Aggregator | 设置和聚合对话变量 |
| **迭代** | Iteration | 循环处理数组中的每个元素 |
| **工具** | Tool | 调用内置或自定义工具（搜索、计算器等） |

**典型工作流示例：GIS 数据查询 Agent**

这个工作流演示了如何用 dify 搭建一个"自然语言查询 GIS 数据"的 Agent：

```
Start（用户输入查询语句）
  → Parameter Extractor（提取：表名、空间条件、属性条件、输出格式）
    → IF/ELSE（判断是否有空间条件）
      ├─ 有空间条件 → Code（生成带 ST_Within/ST_Intersects 的 SQL）
      └─ 无条件     → Code（生成普通 SELECT SQL）
    → HTTP Request（调用 PostGIS REST API 执行查询）
      → IF/ELSE（判断查询结果数量）
        ├─ 结果多（>100条） → LLM（汇总统计，只展示关键信息）
        └─ 结果少           → LLM（逐条解释结果）
  → Template（组装回复：统计信息 + 结果摘要 + SQL 语句）
    → End
```

这个工作流展示了 dify 的两个核心能力：一是**条件分支**基于执行结果动态选择路径（结果多时汇总 vs. 结果少时逐条解释），二是**多节点协作**——参数提取、代码生成、API 调用、LLM 总结各司其职。

### 8.2.5 模型供应商支持

截至 2026 年中，dify 支持超过 30 个模型供应商，覆盖国内外主流大模型：

| 分类 | 供应商 |
|------|--------|
| **国际大厂** | OpenAI（GPT-4o/GPT-4.1/GPT-5/o3/o4-mini）、Anthropic（Claude 3.5/Claude 4）、Google（Gemini 2.5） |
| **国产模型** | DeepSeek（V3/R1）、智谱（GLM-4/GLM-4V）、百川（Baichuan 4）、通义千问（Qwen-Max/Qwen3）、月之暗面（Moonshot） |
| **开源/本地** | Ollama（Llama 3/Mistral/Qwen2.5 等）、Xinference、LocalAI |
| **中转/代理** | OpenRouter、Azure OpenAI、Amazon Bedrock |
| **专业领域** | Cohere（Command R+）、Jina（Embedding） |

**多模型协作模式**：dify 允许在同一个工作流中使用不同供应商的模型。例如：用 DeepSeek-V3 做意图识别（成本低），用 Claude 4 做复杂推理（质量高），用 BGE-M3 做中文向量化（语义准确）。这种按需分配模型的设计能显著降低 Token 成本。

### 8.2.6 部署与运维

**Docker 一键部署**（最常用）：

```bash
# 克隆仓库
git clone https://github.com/langgenius/dify.git
cd dify/docker

# 复制环境变量模板
cp .env.example .env

# 编辑 .env，设置必要的密钥（至少配置一个 LLM 供应商的 API Key）
# SECRET_KEY=随机字符串
# OPENAI_API_KEY=sk-xxx

# 启动所有服务
docker compose up -d

# 访问 http://localhost:80 进入 Web 管理界面
```

Docker Compose 会启动以下服务：API Server、Worker（异步任务处理）、Web 前端、PostgreSQL（业务数据）、Redis（缓存和队列）、Weaviate/Qdrant（向量数据库，可选切换）、Nginx（反向代理）。

**生产环境建议**：

| 组件 | 推荐配置 | 说明 |
|------|----------|------|
| API Server | 2 核 4GB+，水平扩展至 3 实例 | 处理 Web 请求和 API 调用 |
| Worker | 2 核 4GB+，按需扩展 | 处理异步任务（文档分段、向量化等） |
| PostgreSQL | 4 核 8GB+，SSD 100GB+ | 业务数据和向量索引可能增长很快 |
| Redis | 1 核 2GB+ | 缓存和 Celery 消息队列 |
| 向量数据库 | 2 核 4GB+，SSD 50GB+ | Weaviate 或 Qdrant，根据文档量决定 |
| Nginx | 1 核 1GB | 反向代理 + SSL 终结 |

### 8.2.7 实战示例：GIS 辅助问答机器人

下面演示如何用 dify 搭建一个**GDAL 文档知识库 + Agent 编排**的 GIS 辅助问答机器人。

**第一步：创建知识库**

1. 进入 dify 管理界面 → 知识库 → 创建知识库
2. 命名：`GDAL 官方文档`
3. 上传文档：上传 GDAL 官方文档的 Markdown/PDF 文件（可从 [gdal.org](https://gdal.org) 下载）
4. 分段设置：
   - 分段模式：按分隔符分段，分隔符设为 `##`
   - 分段最大长度：1024 tokens
   - 重叠长度：100 tokens
5. 向量模型：选择 `bge-m3`（中文友好）或 `text-embedding-3-small`
6. 检索设置：混合检索 + BGE-Reranker 重排序，TopK=4

**第二步：创建 Agent 应用**

1. 进入工作室 → 创建应用 → 选择 Agent 类型
2. 基础设置：
   - 系统提示词：
     ```
     你是一个 GIS 开发助手，专门帮助用户解答 GDAL/OGR 相关问题。
     你有权访问 GDAL 官方文档知识库。
     回答问题时，请：
     1. 先从知识库检索相关信息
     2. 给出准确的命令格式和参数说明
     3. 提供可运行的代码示例
     4. 标注命令适用的 GDAL 版本
     ```
   - 模型：选择 DeepSeek-V3 或 Claude 4（取决于成本和准确性需求）
3. 工具配置：添加知识库（选择刚创建的"GDAL 官方文档"）
4. 对话设置：
   - 开场白：`你好！我是 GIS 助手，可以帮你解答 GDAL/OGR 的各种问题。试试问我"如何用 ogr2ogr 做坐标转换"吧。`
   - 建议问题：
     - 如何用 gdalwarp 重投影栅格数据？
     - ogr2ogr 的 -sql 参数怎么使用？
     - 如何用 GDAL Python API 读取 GeoTIFF 的元数据？
     - gdal_translate 和 gdalwarp 的区别是什么？

**第三步：测试与发布**

1. 在对话框中测试几个问题，观察知识检索是否正确、回答是否准确
2. 如果检索效果不好，回到知识库调整分段参数或切换向量模型
3. 效果满意后，点击发布 → 获得分享链接或 API 端点

**第四步：API 集成**（与其他技能联动）

dify 发布的 Agent 可以生成 API 端点，供 opencode 或其他工具通过 HTTP Request 节点调用：

```python
import requests

response = requests.post(
    "https://your-dify-instance/v1/chat-messages",
    headers={
        "Authorization": "Bearer app-xxxxxxxxxxxxx",
        "Content-Type": "application/json"
    },
    json={
        "query": "如何用 ogr2ogr 把 Shapefile 转成 PostGIS?",
        "user": "gis-dev-01",
        "response_mode": "blocking"
    }
)

answer = response.json()["answer"]
print(answer)
```

这个 API 端点可以被 opengis-skills 中的 opencode、pi、hermes-agent 等编码代理集成，形成"外部知识库 + 本地编码"的协作模式。

---

## 8.3 编码代理

opengis-skills 覆盖了三个编码代理类技能：opencode（全功能）、pi（极简 harness）和 oh-my-openagent（编排增强）。三者功能和定位互补，面向不同的使用场景和偏好。

### 8.3.1 opencode：全功能终端 AI 编码代理

**项目定位**：

opencode 是一个**开源、模型无关、终端优先**的 AI 编码代理。核心理念是"配置即代码"——通过 `opencode.json` 一个声明式配置文件定义所有行为，不依赖任何特定 IDE 或云服务。

- **仓库地址**：[https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
- **官方文档**：[https://opencode.ai](https://opencode.ai)
- **开源协议**：MIT

**核心设计原则**：

1. **模型无关**：通过 AI SDK 抽象层，对接 75+ 个 LLM 提供商，包括 OpenAI、Anthropic、Google、DeepSeek、Groq、Ollama 等。更换模型只需要改一行配置，所有 Agent、Skill、Rule 无需调整。
2. **终端优先**：TUI（终端用户界面）是原生 UI 形态，同时提供 CLI 和 HTTP Server 两种使用模式，方便嵌入 CI/CD 流水线或其他工具。
3. **声明式配置**：`opencode.json` 遵循严格的 JSON Schema，所有配置项都有类型约束和验证，杜绝配置漂移。
4. **逐级权限控制**：三级权限（allow/ask/deny）+ glob 模式匹配，确保 AI 的操作始终在可控范围内。

**opencode.json 配置全览**：

```json
{
  "$schema": "https://opencode.ai/schema.json",
  "model": {
    "provider": "deepseek",
    "model": "deepseek-v4-pro",
    "options": {
      "temperature": 0.7,
      "max_tokens": 8192
    }
  },
  "permission": {
    "default": "ask",
    "rules": {
      "**/*.md": "allow",
      "**/.git/**": "deny",
      "**/node_modules/**": "deny"
    }
  },
  "skills": {
    "paths": [
      "opengis-skills",
      "~/.config/opencode/skills"
    ]
  },
  "agents": {
    "build": {
      "model": { "provider": "deepseek", "model": "deepseek-v4-pro" },
      "permission": { "default": "ask" }
    },
    "plan": {
      "model": { "provider": "deepseek", "model": "deepseek-v4-flash" },
      "permission": { "default": "deny" }
    }
  },
  "mcp": {
    "servers": {
      "postgres": {
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/gisdb"]
      }
    }
  },
  "command": {
    "deploy-gis": {
      "description": "部署 GIS 服务栈",
      "steps": [
        { "run": "docker compose -f gis-stack.yml up -d" },
        { "run": "python scripts/init_postgis.py" }
      ]
    }
  },
  "rules": {
    "project": [
      "优先使用 GDAL CLI 而非自定义 Python 脚本处理栅格数据",
      "空间坐标系统一使用 EPSG:4326，除非任务明确要求其他投影"
    ]
  }
}
```

**权限系统详解**：

opencode 的权限系统是整个代理安全模型的核心。每个文件操作（读/写/执行）在交给 AI 之前都会经过权限检查：

| 权限级别 | 含义 | AI 的行为 | 适用文件 |
|----------|------|-----------|----------|
| `allow` | 允许 | 无需确认，直接执行操作 | `.md`、`package.json`、`*.config.*` 等非破坏性文件 |
| `ask` | 询问 | 弹出确认对话框，等用户批准后执行 | 源代码文件、配置文件、脚本文件（默认级别） |
| `deny` | 拒绝 | 直接拒绝，不给 AI 执行的可能 | `.git/`、`node_modules/`、`.env`、密钥文件 |

glob 模式支持 `**` 递归通配、`*` 单层通配、`?` 单字符通配和 `[abc]` 字符组，与 `.gitignore` 语法一致。权限规则按从上到下的顺序匹配，首次命中即生效。

**Agent 体系**：

opencode 实现了主 Agent + 子代理的分层设计：

| Agent | 角色 | 权限 | 模型 | 适用场景 |
|-------|------|------|------|----------|
| **build**（默认） | 全栈实现者 | 可读写（ask） | pro 模型 | 编码、调试、重构等执行类任务 |
| **plan** | 只读规划者 | 只读（deny） | flash 模型 | 架构设计、方案评审、代码审查 |
| **general**（子代理） | 通用任务执行 | 继承主 Agent | 按需指定 | 被 `@` 调用的通用子任务 |
| **explore**（子代理） | 代码探索 | 只读（deny） | flash 模型 | 搜索代码、分析结构、收集信息 |
| **scout**（子代理） | 快速查找 | 只读（deny） | flash 模型 | 轻量级搜索，不做深度分析 |

使用方式：按 `Tab` 切换主 Agent（build ↔ plan）→ 按 `@` 调用子代理（`@explore` 搜索代码、`@general` 执行通用任务）。这种分层设计实现了**不同任务用不同模型**的 Token 优化策略——探索用便宜的小模型，实现用贵的大模型。

**Git 快照自动备份**：

opencode 在每次 AI 做出文件修改之前自动执行 `git snapshot`（不占用正常 commit 历史），支持 `/undo` 回退和 `/redo` 重做。这意味着 AI 改坏了代码时，你不需要手动 `git checkout` 或从 IDE 的 Local History 中恢复——一条 `/undo` 命令就回到修改前的状态。

**三种使用形态**：

| 形态 | 启动方式 | 适用场景 | 特点 |
|------|----------|----------|------|
| **TUI** | `opencode` | 日常开发 | 终端原生交互，分屏显示对话和文件差异 |
| **CLI** | `opencode run "任务描述"` | CI/CD、脚本化 | 非交互式，适合嵌入自动化流水线 |
| **Server** | `opencode serve --port 3000` | IDE 插件、Web UI | HTTP API，返回 SSE（Server-Sent Events）流式响应 |

**MCP（Model Context Protocol）集成**：

opencode 原生支持 MCP Server，分为本地和远程两种类型：

```json
{
  "mcp": {
    "servers": {
      "postgres": {
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/gisdb"]
      },
      "filesystem": {
        "type": "local",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data/gis"]
      },
      "remote-docs": {
        "type": "remote",
        "url": "http://knowledge-base:3001/mcp"
      }
    }
  }
}
```

这意味着 opencode 不仅能操作本地文件，还能通过 MCP 协议调用数据库查询、远程知识检索、云服务 API 等——将编码代理的能力边界从"本地文件操作"扩展到"任意 MCP 服务"。

**自定义 Command 和 Rule**：

- **Command**：预定义的命令模板，可包含多个步骤。在 TUI 中输入 `/deploy-gis` 即可执行预定义的部署流程。
- **Rule**：项目级约定（类似 CLAUDE.md 或 AGENTS.md），注入到每个对话的 System Prompt 中。Rule 通常放在 `opencode.json` 的 `rules.project` 数组里，也可放在独立的 `AGENTS.md` 文件中。

**AGENTS.md 注入**：

opencode 会自动读取项目根目录的 `AGENTS.md` 文件，将其内容注入到 System Prompt 中。对于 opengis-skills 用户，可以在 AGENTS.md 中写入技能库的引用规则（详见 [第四章 4.6.2](04-AI工具集成指南#462-agentsmd-集成)）。

### 8.3.2 pi：极简终端 Agent Harness

**项目定位**：

pi 是一个**极简、安全的终端 Agent Harness**（TypeScript monorepo），设计哲学与 opencode 相反——open code 追求"全"，pi 追求"薄"。如果说 opencode 是一台功能齐全的瑞士军刀，pi 就是一把单一用途的精密手术刀。

- **仓库结构**：TypeScript monorepo，核心包 `@earendil-works/pi-core`
- **Provider 包**：`pi-provider-openai`、`pi-provider-anthropic`、`pi-provider-deepseek` 等

**核心设计理念**：

1. **Harness 而非 Agent**：pi 定位为 "harness"（马具/线束）而非 "agent"（智能体）。它提供机械化的执行框架——加载配置 → 解析 Prompt → 调用模型 → 执行工具——不附加任何"智能"判断。所有"智慧"来自 Prompt 和模型本身。
2. **只有四个工具**：read（读取文件）、edit（编辑文件）、write（写入文件）、bash（执行命令）。没有代码搜索、没有 Web 搜索、没有 MCP 集成、没有知识库检索。这种极致约束倒逼 Prompt 设计更精准，也消除了工具选择错误导致的安全风险。
3. **Docker 沙箱执行**：所有 bash 命令在独立的 Docker 容器中执行，`--read-only` 挂载工作目录、`--network none` 禁止网络访问、`--memory` 限制资源使用。即使 AI 生成恶意命令，影响也被限制在沙箱内。
4. **Provider 统一抽象**：通过 `pi-core` 定义的 Provider 接口，新增模型供应商只需实现对应的 Provider 包，核心框架无需修改。

**四工具详解**：

| 工具 | 功能 | 安全约束 |
|------|------|----------|
| **read** | 读取文件内容 | 只能读取挂载目录内的文件，路径白名单验证 |
| **edit** | 精确字符串替换编辑 | `oldString` 必须在文件中唯一匹配，防止误改 |
| **write** | 创建或覆写文件 | 不能写入 `.git` 目录，不能创建文件名为空或路径穿越的文件 |
| **bash** | 在 Docker 容器中执行命令 | 容器隔离 + 只读文件系统 + 无网络 + CPU/内存限制 + 超时自动终止 |

**与 opencode 的对比**：

| 维度 | opencode | pi |
|------|----------|-----|
| **定位** | 全功能 AI 编码代理 | 极简 Agent Harness |
| **模型支持** | 75+ 提供商，AI SDK 抽象 | Provider 接口 + 独立包，按需安装 |
| **工具数量** | 10+（读写、搜索、MCP、Git 等） | 4 个（read/edit/write/bash） |
| **权限系统** | allow/ask/deny 三级 + glob | Docker 沙箱隔离（物理隔离，无细粒度控制） |
| **Agent 体系** | 主 Agent + 3 个子代理 | 无 Agent 概念，单层执行 |
| **配置方式** | opencode.json（JSON Schema） | TypeScript 配置对象 |
| **安全模型** | 权限控制（软件层） | 容器隔离（硬件/内核层） |
| **扩展机制** | MCP + Command + Rule + 插件 | Provider 接口 + Extensions/Skills/Prompt 模板 |
| **社区生态** | 活跃，Anomalyco 主导 | 相对小众，社区驱动 |
| **学习曲线** | 中等（配置项丰富） | 低（极简，概念少） |
| **适用场景** | 日常开发、团队协作、CI/CD | 安全敏感任务、不可信代码执行、实验性项目 |

**何时选择 pi 而非 opencode**：

- 需要在不可信环境中运行 AI 生成的代码（如公开的 CTF 挑战、用户提交的脚本审核）
- 团队偏好"最小权限原则"的极端实践——只要四个工具，不接受功能膨胀
- 需要嵌入 TypeScript 项目作为子模块，利用 monorepo 的原生 TypeScript 类型安全
- 研究 Agent 安全模型，需要一个干净简约的 baseline 实现

### 8.3.3 oh-my-openagent：OpenCode 多模型编排与增强

**项目定位**：

oh-my-openagent 是 opencode 的**增强层和编排层**，解决单个 opencode 实例在三方面上的局限：多模型并行协作、代码智能工具缺失、与外部系统（MCP）的深度集成。

- **定位**：OpenCode 插件/增强系统（非独立代理）
- **仓库地址**：[https://github.com/znlgis/oh-my-openagent](https://github.com/znlgis/oh-my-openagent)

**核心能力**：

**1. 并行 Agent 编排**

oh-my-openagent 的核心创新是**多 Agent 并行调度**——将一个大任务拆分为多个子任务，派发给多个 opencode 实例同时执行，最后汇总结果：

```
用户任务："重构 gis-utils 包，同时更新所有调用方"
  │
  ├─→ Agent-1 (@build, model=pro): 重构 src/transform.ts
  ├─→ Agent-2 (@build, model=pro): 重构 src/analysis.ts
  ├─→ Agent-3 (@explore, model=flash): 搜索所有调用方，生成影响分析报告
  └─→ Agent-4 (@build, model=flash): 更新测试文件
  │
  └─→ 汇总结果，解决冲突，生成统一 diff
```

并行调度的关键在于**任务拆分粒度**和**依赖管理**——oh-my-openagent 通过 DAG（有向无环图）描述任务依赖关系，确保"更新调用方"在"重构完成"之后执行。

**2. AST/LSP 工具集成**

oh-my-openagent 集成了 AST（抽象语法树）和 LSP（语言服务器协议）工具，为 opencode 的 AI 注入代码智能：

- **AST 工具**：解析 TypeScript/JavaScript/Python 代码的 AST，提供函数签名、导入关系、类型信息
- **LSP 工具**：调用项目中的 LSP Server，获取 go-to-definition、find-references、hover type 等 IDE 级代码智能

这两种工具解决了纯文本 agent 的常见问题：AI 读到的只是文本，看不到类型关系、调用链路和模块依赖。有了 AST/LSP 增强后，AI 的代码理解能力接近人类开发者在 IDE 中的体验。

**3. MCP（Model Context Protocol）深度集成**

在 opencode 原生 MCP 支持的基础上，oh-my-openagent 提供了更丰富的 MCP 集成：

- **MCP 路由**：根据任务类型自动选择合适的 MCP Server（数据库查询 → PostgreSQL Server、文件操作 → Filesystem Server、GIS 分析 → 自定义 GIS Server）
- **MCP 结果缓存**：对相同查询的 MCP 调用结果缓存，减少重复调用
- **MCP 错误恢复**：MCP Server 异常时自动重试和降级

**4. OpenCode 插件系统**

oh-my-openagent 定义了 opencode 的插件接口：

```typescript
interface OpenCodePlugin {
  name: string;
  version: string;
  hooks: {
    onPreExecute?: (context: TaskContext) => Promise<void>;
    onPostExecute?: (context: TaskContext, result: TaskResult) => Promise<void>;
    onToolCall?: (tool: string, args: unknown) => Promise<unknown>;
    onError?: (error: Error, context: TaskContext) => Promise<ErrorRecovery>;
  };
  providers?: {
    models?: ModelProvider[];
    tools?: ToolProvider[];
  };
}
```

通过这个接口，开发者为 opencode 增加自定义模型提供商、工具、执行钩子。

---

## 8.4 自主 Agent

自主 Agent 的核心特点是**不需要人类在每一步都下达指令**——它们能分解任务、规划执行路径、从经验中学习、跨会话记忆。opengis-skills 覆盖了两个自主 Agent 技能。

### 8.4.1 hermes-agent：自学习通用 AI 智能体

**项目定位**：

hermes-agent 是一个**终端优先、具备自学习能力的通用 AI 智能体**。与传统 Agent 不同，hermes-agent 能从每次执行中积累经验，逐渐优化自己的行为模式。

- **仓库地址**：[https://github.com/znlgis/hermes-agent](https://github.com/znlgis/hermes-agent)
- **设计哲学**：Agent 不应该每次从零开始——它应该像人类一样越用越熟练。

**自学习机制**：

hermes-agent 的自学习体系由四个核心组件构成：

**1. 经验池（Experience Pool）**

经验池是一个持久化的键值存储，记录每次任务的成功/失败情况以及对应的解决方式：

```
经验池条目结构：
{
  "task_hash": "abc123",           // 任务的语义哈希（相同需求产生相同哈希）
  "task_description": "用 GDAL 将多个 TIFF 拼接为一个 VRT",
  "status": "success",             // success | failed
  "solution": {
    "command": "gdalbuildvrt output.vrt input/*.tif",
    "notes": "注意通配符路径中的斜杠方向，Windows 需要反斜杠"
  },
  "context": {
    "os": "linux",
    "gdal_version": "3.9.0",
    "file_count": 12
  },
  "attempts": 3,
  "last_updated": "2026-07-15T10:30:00Z"
}
```

当 Agent 遇到新任务时，先搜索经验池中语义相似的历史记录。如果找到匹配（相似度 > 阈值），直接复用已验证的解决方案，跳过推理环节。这是 hermes-agent 加速执行的核心机制。

**2. 环境探索（Environment Exploration）**

hermes-agent 在首次进入项目目录时，会主动探索项目结构：

- 扫描目录树，识别项目类型（通过 `package.json`、`requirements.txt`、`Cargo.toml` 等）
- 读取配置文件（`.env.example`、`docker-compose.yml` 等）理解基础设施
- 运行 lint/build/test 确认项目状态
- 将探索结果存入**项目记忆库**，后续会话直接读取

这意味着第二次在这个项目中执行任务时，hermes-agent 已经"知道"项目的技术栈、目录结构和当前状态，不需要重新探索。

**3. 动态任务分解（Dynamic Task Decomposition）**

面对复杂任务时，hermes-agent 会递归分解：

```
用户任务："将这个项目的 GDAL 命令从 v2 语法迁移到 v3 语法"
  │
  └─→ L1 分解：扫描所有文件 → 识别旧语法 → 生成迁移计划
      │
      ├─→ L2 子任务1：迁移 src/convert.py 中的 ogr2ogr 调用
      ├─→ L2 子任务2：迁移 scripts/batch.sh 中的 gdalwarp 参数
      ├─→ L2 子任务3：更新 doc/commands.md 中的命令示例
      └─→ L2 子任务4：回归测试
```

分解后的子任务串行/并行执行，取决于依赖关系。每个子任务的执行结果反馈给上层，影响后续子任务的策略。

**4. 知识持久化（跨会话记忆）**

hermes-agent 的持久化存储包含三个数据库：

| 数据库 | 内容 | 存储方式 | 生命周期 |
|--------|------|----------|----------|
| **经验池** | 任务→解决方案映射 | SQLite / JSON 文件 | 永久保留，手动清理 |
| **项目记忆** | 项目结构、技术栈、状态 | 项目根目录 `.hermes/memory/` | 随项目存在 |
| **会话状态** | 当前对话上下文、变量 | 内存 / 临时文件 | 单次会话内有效 |

项目记忆通过 `.hermes/` 目录保存在项目内，可提交 Git。这意味着团队成员 clone 项目后，hermes-agent 直接加载前人的探索结果，即刻拥有项目认知。

**学习曲线和适用场景**：

hermes-agent 的学习效果随着使用次数的增加而增强：

- **第 1-10 次任务**：和普通 Agent 无异，每次探索环境、尝试方案
- **第 11-50 次任务**：经验池开始命中，常见任务秒级完成
- **第 50+ 次任务**：Agent 对项目形成深度理解，能主动发现潜在问题并提出改进建议

适用场景：
- 长期维护的同一项目（经验池价值最大化）
- 重复性高的 GIS 数据处理任务（同样的 GDAL 命令组合反复出现）
- 团队维护的共享 Agent 实例（前人积累的经验后来者直接受益）

### 8.4.2 openclaw：多通道个人 AI 助手网关

**项目定位**：

openclaw 是一个**多通道个人 AI 助手网关**，核心理念是"一个入口管理所有 AI 服务"——它将多个 AI 后端（dify、opencode、hermes-agent 等）统一到同一个入口，通过不同的客户端（终端、Web、IM）接入。

- **仓库地址**：[https://github.com/znlgis/openclaw](https://github.com/znlgis/openclaw)
- **设计哲学**：AI 工具太多导致入口碎片化——需要一个统一的 Gateway 来管理。

**Gateway 架构**：

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ 终端 CLI  │  │ Web UI  │  │ 企业微信  │  │ 飞书     │  ... 客户端层
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     └─────────────┴──────┬──────┴─────────────┘
                          │
                  ┌───────┴───────┐
                  │  OpenClaw     │
                  │  Gateway      │  ← 统一入口
                  │               │
                  │ ┌───────────┐ │
                  │ │ 路由层    │ │  ← 根据请求类型/用户/上下文路由
                  │ ├───────────┤ │
                  │ │ 缓冲层    │ │  ← 请求排队、限流、负载均衡
                  │ ├───────────┤ │
                  │ │ 上下文层  │ │  ← 用户上下文管理、跨会话记忆
                  │ └───────────┘ │
                  └───────┬───────┘
                          │
     ┌─────────────┬──────┼──────┬─────────────┐
     │             │      │      │             │
┌────┴────┐ ┌─────┴───┐ ┌┴────┐ ┌┴──────┐ ┌───┴──────┐
│ dify    │ │opencode │ │pi   │ │hermes │ │openclaw  │  ... 后端层
│ API     │ │Agent    │ │     │ │-agent │ │Skills    │
└─────────┘ └─────────┘ └─────┘ └───────┘ └──────────┘
```

**核心组件**：

**1. 路由层**

路由层根据以下维度将用户请求分配到最合适的后端：

| 路由维度 | 示例规则 |
|----------|----------|
| **任务类型** | 问答 → dify API、编码 → opencode、文档翻译 → 自定义 MCP Server |
| **用户身份** | 开发者 → opencode（高权限）、访客 → dify Chatbot（限权限） |
| **上下文状态** | 有历史对话 → 复用上次使用的后端；新用户 → 根据首次提问内容选择 |
| **负载状态** | dify 排队过长 → 降级到本地 Ollama 模型 |

路由规则通过声明式 YAML 配置定义：

```yaml
routes:
  - name: coding-tasks
    match:
      intent: ["code_generation", "debugging", "refactoring"]
      user_role: ["developer", "admin"]
    backend: opencode
    priority: 100

  - name: knowledge-qa
    match:
      intent: ["question_answering", "documentation"]
    backend: dify
    priority: 80

  - name: translation
    match:
      intent: ["translation"]
    backend: docutranslate-mcp
    priority: 60

  - name: fallback
    match: {}
    backend: local-llm
    priority: 0
```

**2. 缓冲层**

当后端服务繁忙时，缓冲层负责：

- **请求排队**：FIFO（先入先出）队列，保证请求顺序
- **限流**：根据用户级别和 API 配额控制请求速率
- **负载均衡**：同一后端多实例时，轮询或最小负载分配
- **超时处理**：请求超时后自动重试或返回降级响应

**3. 上下文管理层**

openclaw 维护一个**跨设备、跨会话**的用户上下文，包含：

- 用户偏好（常用模型、代码风格、语言）
- 历史对话摘要（长对话自动压缩，保留关键信息）
- 项目上下文（当前项目路径、技术栈、最近操作的文件）
- 技能状态（已加载的 Skills、活跃的 Agent 会话）

上下文存储在后端数据库（PostgreSQL 或 SQLite），通过用户 ID 关联。无论用户从终端、Web 还是 IM 接入，都能获得一致的 AI 体验。

**4. 多端支持**

| 客户端 | 接入方式 | 特点 |
|--------|----------|------|
| **终端** | CLI（`openclaw chat`） | 开发者首选，支持管道和脚本 |
| **Web UI** | 浏览器访问 `localhost:3000` | 可视化管理、对话历史浏览 |
| **企业微信** | Webhook 机器人 | 非技术人员也能用，适合团队知识问答 |
| **飞书** | 应用机器人 | 卡片消息、富文本支持 |
| **HTTP API** | REST API（`/api/chat`） | 供其他系统集成 |

### 8.4.3 自主 Agent 安全考量

自主 Agent 因为"不需要人类在每一步都确认"，安全风险比编码代理更高。以下是使用 hermes-agent 和 openclaw 时的关键安全建议：

| 风险 | 缓解措施 |
|------|----------|
| Agent 误删/修改关键文件 | 配置 `.hermesignore` 排除关键路径（`.git/`、`secrets/`、`prod-config/`） |
| 经验池被污染（错误经验被复用） | 定期人工审查经验池中的"成功"条目；设置经验有效性窗口（超过 N 天的经验需要重新验证） |
| openclaw 路由到错误后端导致数据泄露 | 路由规则加上数据敏感级标签；敏感数据不路由到第三方 API |
| 跨会话上下文泄露 | 上下文数据加密存储；用户退出后清除会话状态 |
| 无限循环执行 | 设置最大执行步数（max_steps）和单任务时间上限（timeout） |

---

## 8.5 AI 编程方法论：superpowers-zh

### 8.5.1 项目概述

**superpowers-zh** 是 opengis-skills 中 `ai/superpowers-zh/SKILL.md` 覆盖的技能，它是 [obra/superpowers](https://github.com/obra/superpowers) 的中文实践版本——一套**面向中文开发者的 AI 编程方法论 Skills 集合**。

与 GIS/CAD 等"领域知识"技能不同，superpowers-zh 提供的是**元技能**——告诉你"如何用 AI 更好地编程"的方法论，而不是某个具体工具的 API 参考。

**核心关系**：

```
superpowers-zh（方法论技能）
  ↓ 指导
opengis-skills（领域技能：GIS/CAD/C#/AI/IoT/3D）
  ↓ 增强
AI 编码代理（opencode/pi/Cursor/Claude Code）
```

superpowers-zh 提供"怎么用 AI 编程"的方法，opengis-skills 提供"让 AI 懂什么领域知识"的内容，两者结合才能发挥最大效能。

### 8.5.2 六大核心实践

superpowers-zh 包含六项核心实践，每一项都是一个独立的 Skill：

#### 实践一：TDD（测试驱动开发）

**不是传统的 TDD，而是 AI 辅助 TDD**。核心流程：

```
1. 用 AI 写测试（描述预期行为 → AI 生成测试代码）
2. 用 AI 写实现（喂入测试 → AI 生成通过测试的最小代码）
3. 用 AI 重构（运行测试确保不破坏 → AI 优化代码结构和性能）
```

**关键原则**：永远先描述测试的预期行为，再让 AI 写实现。这个顺序倒过来（先让 AI 写代码再写测试）是反模式——AI 会根据它生成的代码来写测试，测试就成了"验证错误的正确性"。

**结合 opengis-skills 的例子**：写一个使用 GDAL 读取 GeoTIFF 元数据的函数。

```
第一步：描述测试
  "写一个 pytest 测试：调用 read_geotiff_metadata() 函数，
   传入 test/data/sample.tif，验证返回值包含 width、height、
   crs（应为 EPSG:4326）和 band_count（应为 3）。"

第二步：AI 加载 @opengis-skills/gis/gdal/SKILL.md →
        根据 GDAL Python API 的正确签名生成实现

第三步：测试通过后，
  "重构这个函数，使用 with 语句管理数据集生命周期，避免内存泄漏。"
```

这个流程确保了 AI 生成的代码（1）符合 GDAL 真实 API（技能文件提供的知识）、（2）满足测试预期（TDD 流程保证）、（3）代码质量在重构中持续提升。

#### 实践二：系统化调试（六阶段调试循环）

superpowers-zh 定义了一个结构化的调试流程，避免开发者在 AI 辅助调试时"随机尝试修 bug"：

```
阶段 1 → 精确描述问题（什么输入、什么现象、什么环境）
阶段 2 → 收集证据（错误日志、堆栈、相关代码、复现步骤）
阶段 3 → 形成假设（不超过 3 个，按可能性排序）
阶段 4 → 设计试验（针对可能性最高的假设，设计最小的验证试验）
阶段 5 → 执行试验并分析（如果验证，进入修复；如果证伪，回到阶段 3）
阶段 6 → 修复并回归（修复后运行全部测试，确保不引入新 bug）
```

**与普通"问 AI 这个 bug 怎么修"的区别**：普通方式是把所有信息一次性丢给 AI，期待它给出完美的修复方案。而系统化调试是**迭代式缩小范围**——每次只给 AI 当前阶段需要的上下文，减少噪音，提高诊断准确性。

**GIS 调试示例**：

```
阶段 1: "GDAL 的 ogr2ogr 在将 Shapefile 导入 PostGIS 时，报错
         'ERROR 1: INSERT is for a table without a geometry column'"
阶段 2: 收集 Shapefile 的元信息（ogrinfo -so）、PostGIS 表结构（\d+）、
         ogr2ogr 的完整命令行参数
阶段 3: 假设 A) Shapefile 缺少 .prj 文件导致坐标系未识别；
         假设 B) PostGIS 表已存在但 geometry 列名不是默认的"geom"
阶段 4: 先用 ogrinfo 确认坐标系，再检查表结构
阶段 5: 实验证实假设 A（无 .prj 文件），修复方案：添加 -a_srs EPSG:4326
阶段 6: 修复后用测试数据集验证
```

#### 实践三：头脑风暴（设计与规划）

不是让 AI 直接写代码，而是先和 AI 一起设计、评审、迭代方案。头脑风暴的核心原则是"先发散、再收敛"：

1. **发散阶段**：列出所有可行方案，不评判优劣，越多样越好
2. **收敛阶段**：按约束条件（时间、复杂度、性能、兼容性）筛选，选择一个方案深化设计
3. **评审阶段**：用 AI 扮演反对者角色（Devil's Advocate），找出方案的薄弱点
4. **落地阶段**：将方案转化为可执行的任务清单

#### 实践四：代码审查（Token 节俭的多维度审查）

superpowers-zh 的代码审查方法强调**按文件量调整审查深度**（Scales to Diff Size）和**对照项目威胁模型校准严重程度**（Calibrated Severity）。

审查维度包括：

| 维度 | 关注点 |
|------|--------|
| **正确性** | 逻辑是否正确、边界条件是否处理、是否引入新 bug |
| **安全性** | SQL 注入、XSS、路径穿越、密钥泄露 |
| **性能** | N+1 查询、大循环中的重复计算、不必要的数据拷贝 |
| **可维护性** | 命名是否清晰、函数是否过长、是否有隐藏依赖 |
| **一致性** | 是否遵循项目已有模式、是否引入了新的约定冲突 |

**Token 节俭**原则：对于小改动（< 50 行），全部审查；对于中等改动（50-300 行），按维度抽样；对于大改动（> 300 行），只审查架构变更和公共 API。

#### 实践五：执行计划（Design → Tasks）

将头脑风暴阶段产出的设计转化为**可执行、可追踪的任务清单**。每个任务满足 SMARTC 原则——Specific、Measurable、Achievable、Result-oriented、Time-bound、Checkpoint-able（可检查点）。

**典型任务清单格式**：

```markdown
### 任务 3：实现 Shapefile 导入模块 [预计 2h]
- [ ] 3.1 读取 .shp/.dbf/.shx 文件三元组
- [ ] 3.2 将几何数据转为 GeoJSON（使用 Shapely/ogr）
- [ ] 3.3 将属性数据转为 JSON 对象数组
- [ ] 3.4 写入 PostGIS（使用 psycopg2 + ST_GeomFromGeoJSON）
- [ ] 3.5 错误处理：编码问题（GBK/UTF-8）、无效几何、空属性
- [ ] 3.6 单元测试：覆盖率 > 80%
```

#### 实践六：分支管理（Feature 分支完整生命周期）

superpowers-zh 定义了 feature 分支的完整生命周期管理流程：

```
创建 feature 分支 → 开发 → 提交（Conventional Commits）
  → 自查（自己先 Review）→ 推送 → 创建 PR
    → 代码审查 → 通过 → Squash merge → 删除 feature 分支
```

每一步都有对应的 AI 辅助方式——AI 帮忙写 commit message、AI 自我审查代码后再提交、AI 辅助写 PR 描述。

### 8.5.3 中文提示词模板

superpowers-zh 的核心特色之一是**针对中文开发场景优化的提示词模板**。因为中文开发者的技术语境和需求表达方式与英文开发者存在差异——例如中文资料中对"坐标转换"和"投影变换"的术语混用、对国产中间件（达梦数据库、东方通等）的特殊需求——直接翻译英文提示词往往效果不佳。

模板示例：

```
## TDD 任务启动模板

**项目上下文**：{项目名称}，技术栈 {语言/框架}，当前模块 {模块名}

**任务描述**：实现 {功能名称}，该功能的作用是 {一句话描述}。

**参考规范**：请先加载 @opengis-skills/{分类}/{技能}/SKILL.md，
确保生成的 API 调用和命令参数正确。

**第一步**：根据我的需求描述，生成测试用例（pytest / jest / JUnit 等）。
**第二步**：编写通过测试的最小实现代码。
**第三步**：确认测试通过后，对代码进行重构优化。

**验收标准**：
1. 所有测试通过
2. 代码符合项目现有风格
3. 关键逻辑有注释说明（中文）
4. 无新增 lint 警告
```

### 8.5.4 与 opengis-skills 的互补关系

superpowers-zh 和 opengis-skills 的设计者有意将两者定位为互补关系：

| 维度 | superpowers-zh | opengis-skills |
|------|---------------|----------------|
| **提供什么** | "怎么用 AI 编程"的方法论 | "让 AI 懂什么"的领域知识 |
| **知识类型** | 元知识（方法） | 领域知识（内容） |
| **适用范围** | 所有编程任务 | GIS/CAD/C#/AI/IoT/3D |
| **不变性** | 随时间稳定（方法论不易过时） | 随时间演进（API 变动需更新） |
| **加载方式** | 作为基础方法论，常驻上下文 | 按需加载，具体任务时引用 |

**推荐组合用法**：

1. 将 superpowers-zh 的六大实践（TDD/调试/审查等）设为 AGENTS.md 或 CLAUDE.md 的基础工作流规则
2. 在具体任务时，根据领域按需加载 opengis-skills 的对应技能文件
3. 做到"方法论常驻 + 领域知识按需"——既保证了工作流的一致性，又避免了长上下文

---

## 8.6 文档翻译：docutranslate

### 8.6.1 项目概述

docutranslate 是一个**基于大模型的本地文档翻译工具**，专门解决 GIS、CAD 等技术文档中术语一致性和排版保留的翻译难题。

- **仓库地址**：[https://github.com/znlgis/docutranslate](https://github.com/znlgis/docutranslate)
- **核心能力**：PDF/Word/Excel/Markdown/字幕文件 → 大模型翻译 → 保留原排版输出
- **安全特性**：本地运行，数据不出机器

与通用翻译工具（DeepL、Google Translate）相比，docutranslate 的核心差异在于：

| 维度 | 通用翻译工具 | docutranslate |
|------|-------------|---------------|
| **术语一致性** | 每次翻译独立，同一术语可能不同翻译 | 通过 glossary 文件锁定术语，翻译一致 |
| **排版保留** | 一般丢失 Markdown 标记、表格结构 | 保留所有 Markdown、表格行/列、图片引用 |
| **数据安全** | 发送到云端，可能被存储 | 本地处理，数据不出机器 |
| **领域适配** | 通用语料训练，GIS 术语可能不准确 | 可配置领域 glossary，实现术语对齐 |
| **格式支持** | 通常只支持纯文本/简单文档 | 支持 PDF（通过 MinerU 解析）、Word、Excel、SRT 字幕、Markdown |

### 8.6.2 核心架构：MinerU + MCP + LLM

docutranslate 的翻译流水线分为三个核心环节：

```
文档输入 → MinerU 解析 → MCP Server 调度 → LLM 分段翻译 → 重组输出
```

**MinerU 解析**：

[MinerU](https://github.com/opendatalab/MinerU) 是上海 AI 实验室开源的高质量 PDF 解析工具，能将 PDF 文档转为保留排版结构的 Markdown。与传统的 pdf2text/pypdf 相比，MinerU 的核心优势：

- **识别标题层级**：自动识别 H1-H6 标题，不会将正文文本误认为标题
- **保留表格结构**：将 PDF 表格转为 Markdown 表格，不丢失行列关系
- **定位图片位置**：标记图片在文档中的位置和 alt 文本
- **处理公式**：将 LaTeX 公式保留为原格式
- **双语混排**：中英文混排文档不会出现乱码或文字重叠

对于 GIS 技术文档（GDAL 官方文档、CesiumJS API 参考等），MinerU 的表格保留能力尤其重要——这些文档中大量的参数表格如果被破坏，翻译后无法还原。

**MCP Server 调度**：

docutranslate 将翻译能力封装为 MCP Server（Model Context Protocol），可以被 opencode、Cursor 等支持 MCP 的工具直接调用。设计为 MCP Server 而非独立 CLI 的好处是：翻译能力可以被编排到更复杂的工作流中（例如 opencode 收到一个"翻译并总结"的任务，先调用 docutranslate 翻译文档，再让 LLM 总结内容）。

### 8.6.3 完整工作流

**第 1 步：MinerU 解析文档**

```bash
# 安装 MinerU
pip install magic-pdf

# 解析 PDF 文档
magic-pdf -p input.pdf -o output_dir

# 输出结构：
# output_dir/
#   ├── input.md          # 结构化 Markdown（保留排版）
#   ├── images/           # 提取的图片文件
#   └── input_layout.pdf  # 布局标注 PDF（调试用）
```

**第 2 步：LLM 分段翻译**

docutranslate 按照 Markdown 的标题层级智能分段，每一段交给 LLM 翻译：

```python
# docutranslate 的分段策略（示意）
def segment_markdown(md_content: str) -> list[Segment]:
    """
    按标题层级分段，确保每个段落的上下文完整：
    - 遇到 ## 标题 → 新段开始
    - 代码块不跨段分割
    - 表格整体作为一个段单元
    - 每段控制在 2000 tokens 以内
    """
    pass
```

翻译时，LLM 被要求：
1. 保留所有 Markdown 标记（`##`、`|表格|`、`![图片](path)`、行内代码 `` ` `` 等）
2. 不翻译代码块和命令行示例（保留原样）
3. 术语翻译参考 glossary 文件
4. 遇到不确定的术语时保持原文并添加 `(注:原文xxx)` 注释

**第 3 步：重组输出文件**

翻译完成后，docutranslate 将翻译后的 Markdown 分段重新拼接，修复分页导致的表头断裂、代码块被拆分等问题，输出与原文档排版一致的目标语言 Markdown 文件。

如果需要输出 PDF/Word 等格式，可以再用 Pandoc 等工具从 Markdown 转换。

### 8.6.4 配置与使用

**基本配置**：

```yaml
# docutranslate.yaml
source_lang: en
target_lang: zh-CN
model:
  provider: deepseek
  model: deepseek-chat
  api_key: ${DEEPSEEK_API_KEY}

glossary:
  # GIS 术语表（英文 → 中文）
  - source: "coordinate reference system"
    target: "坐标参考系"
  - source: "raster"
    target: "栅格"
  - source: "vector"
    target: "矢量"
  - source: "shapefile"
    target: "Shapefile"   # 保留原名，品牌/格式名不翻译
  - source: "georeferencing"
    target: "地理配准"
  - source: "affine transformation"
    target: "仿射变换"
  - source: "web mercator"  
    target: "Web 墨卡托"

segmentation:
  max_tokens_per_segment: 2000
  preserve_code_blocks: true
  preserve_tables: true

output:
  format: markdown  # markdown | docx | srt
  add_glossary_notes: true  # 首次出现的术语添加原文注释
```

**命令行使用**：

```bash
# 翻译单个文件
docutranslate translate input.md -o output_zh.md

# 批量翻译
docutranslate batch docs/en/ -o docs/zh/ --pattern "*.md"

# 翻译字幕文件
docutranslate translate lecture.srt --format srt -o lecture_zh.srt

# 使用本地 Ollama 模型（完全离线）
docutranslate translate input.pdf --model ollama:qwen2.5:14b -o output_zh.pdf
```

**作为 MCP Server 使用**：

在 opencode 的 `opencode.json` 中配置：

```json
{
  "mcp": {
    "servers": {
      "docutranslate": {
        "type": "local",
        "command": "docutranslate",
        "args": ["serve", "--port", "3002"]
      }
    }
  }
}
```

配置后，可以在 opencode 对话中直接使用：`@mcp:docutranslate 翻译 docs/api.md 为中文`

### 8.6.5 多模型支持

docutranslate 支持所有兼容 OpenAI API 格式的模型供应商：

| 模型 | 推荐场景 | 特点 |
|------|----------|------|
| DeepSeek-V3 | 大批量翻译（成本敏感） | 中文翻译质量好，Token 价格低 |
| Claude 4 | 高质量翻译（技术文档） | 术语理解能力强，排版保留好 |
| GPT-4o | 通用翻译 | 平衡质量和速度 |
| Qwen2.5（Ollama） | 完全离线翻译 | 本地运行，数据绝对安全 |
| GLM-4 | 中文技术文档 | 国产模型，中文表达自然 |

**模型切换建议**：

- 正式出版级翻译：Claude 4 > GPT-4o > DeepSeek-V3
- 内部参考用翻译（量大、可接受部分瑕疵）：DeepSeek-V3 > Qwen2.5
- 包含严格保密信息的文档：Qwen2.5（本地 Ollama）> 其他

### 8.6.6 与 tongwen（CAD 翻译技能）的关联

opengis-skills 中的 CAD 分类包含 `cad/tongwen/SKILL.md`——一个 AutoCAD DWG 图纸的文字翻译工具。docutranslate 与 tongwen 形成"文档翻译矩阵"：

| | 通用文档 | DWG 图纸 |
|--|----------|----------|
| **工具** | docutranslate | tongwen |
| **格式** | PDF/Word/Excel/Markdown/SRT | DWG/DXF |
| **解析方式** | MinerU（PDF）→ Markdown | AutoCAD .NET API → 提取文字实体 |
| **翻译引擎** | LLM（DeepSeek/Claude/GPT 等） | LLM（同样支持多种模型） |
| **排版保留** | 保留 Markdown 结构和表格 | 保留文字位置/字体/大小/图层 |
| **典型场景** | 翻译 GDAL 官方文档、CesiumJS 教程 | 翻译工程图纸中的标注、图例、标题栏 |

如果你的项目既有大量技术文档（PDF/Markdown）需要翻译，又有 CAD 图纸（DWG）的文字需要处理，docutranslate + tongwen 的组合可以完整覆盖。

---

## 8.7 AI 技能选择决策树

面对 8 个 AI 技能，如何快速选择最合适的？以下决策树帮助你根据任务场景做出选择：

```
需要 AI/Agent 技能？
│
├─ 目标：快速搭建 LLM 应用（问答机器人、RAG 知识库、工作流自动化）
│   └─ ▶ dify
│       - 非程序员可操作：拖拽式工作流编排
│       - 需要对外分享：一键发布 Web 应用 + API 端点
│       - 需要 RAG：内置知识库流水线（分段 → 向量化 → 检索）
│
├─ 目标：终端 AI 编码辅助
│   │
│   ├─ 需要功能全面（权限系统、子代理、MCP、Git 备份、自定义 Command）
│   │   └─ ▶ opencode
│   │       - 主推选项，覆盖 90% 的日常编码场景
│   │       - 与 opengis-skills 原生集成（skills.paths 自动扫描）
│   │
│   ├─ 需要极简 & 容器安全隔离
│   │   └─ ▶ pi
│   │       - 不可信代码执行场景
│   │       - 偏好"最小权限"哲学
│   │
│   └─ 需要在 opencode 基础上增加多模型编排/并行/代码智能
│       └─ ▶ oh-my-openagent
│           - 多 Agent 并行处理大型重构
│           - 需要 AST/LSP 级别的代码理解能力
│
├─ 目标：提升 AI 编程方法论
│   └─ ▶ superpowers-zh
│       - 团队想统一 AI 编程工作流（TDD、调试、审查）
│       - 中文开发环境，需要本地化提示词模板
│       └─ 配合 opengis-skills 领域技能使用效果最佳
│
├─ 目标：部署自主 Agent（能独立完成任务，不需要每步人工确认）
│   │
│   ├─ 需要自学习能力（越用越熟练、跨会话记忆）
│   │   └─ ▶ hermes-agent
│   │       - 长期维护的同一项目
│   │       - 重复性高、模式性强的 GIS 数据处理任务
│   │
│   └─ 需要多端接入 & 多 AI 服务统一管理
│       └─ ▶ openclaw
│           - 多个 AI 工具需要统一入口管理
│           - 团队内需要多端 AI 访问（终端/Web/IM）
│           - 需要请求排队、限流、负载均衡
│
└─ 目标：翻译技术文档
    └─ ▶ docutranslate
        - PDF/Word/Excel/Markdown/字幕 → 保留排版翻译
        - 数据敏感，必须本地运行
        - GIS/CAD 技术术语需要术语表对齐
        └─ 如果翻译 DWG 图纸文字 → 补充使用 cad/tongwen
```

### 8.7.1 常见组合方案

| 需求 | 推荐组合 | 说明 |
|------|----------|------|
| **全栈 GIS 项目开发** | opencode + superpowers-zh + opengis-skills(gis) | opencode 执行编码，superpowers-zh 管理 TDD/调试流程，GIS 技能提供领域知识 |
| **GIS 知识库搭建** | dify + docutranslate + opengis-skills(gis) | docutranslate 翻译文档 → 导入 dify 知识库 → dify 搭建问答机器人 |
| **多 Agent 大型重构** | oh-my-openagent + opencode + superpowers-zh | oh-my-openagent 编排多个 opencode，superpowers-zh 指导每个 Agent 的任务分解和验证 |
| **企业内部 AI 平台** | openclaw + dify + opencode | openclaw 作为统一入口，路由编码任务到 opencode、知识问答到 dify |
| **自动化 GIS 脚本维护** | hermes-agent + opengis-skills(gis) | hermes-agent 从经验池学习 GDAL 命令模式，自动维护和优化脚本 |

---

## 本章小结

本章详细介绍了 opengis-skills 中 `ai/` 分类下的 8 个 AI/Agent 技能，按应用场景分为五大类：

| 分类 | 技能 | 核心价值 |
|------|------|----------|
| **LLM 平台** | dify | 零代码搭建 LLM 应用，可视化工作流 + RAG 知识库 |
| **编码代理** | opencode、pi、oh-my-openagent | 终端 AI 编码辅助，从全功能到极简，从单 Agent 到并行编排 |
| **自主 Agent** | hermes-agent、openclaw | 自学习跨会话智能体 + 多通道统一网关 |
| **方法论** | superpowers-zh | 中文 AI 编程六大实践，提升开发质量和效率 |
| **文档翻译** | docutranslate | 保留排版的本地技术文档翻译，GIS/CAD 术语对齐 |

**关键要点回顾**：

1. **dify** 的核心价值在于降低 LLM 应用门槛——拖拽节点即可搭建 RAG 问答机器人或自动化工作流，无需写前端代码。
2. **opencode** 是 opengis-skills 推荐的主力编码代理——模型无关、权限可控、MCP 集成、与技能库原生集成。
3. **pi** 和 **oh-my-openagent** 分别代表了"极简"和"增强"两个方向——前者追求最小攻击面，后者追求最大协作效率。
4. **hermes-agent** 和 **openclaw** 将 Agent 从"工具"升级为"长期伙伴"——前者自学习进化，后者多端统一服务。
5. **superpowers-zh** 提供了 AI 编程的"方法论层"——指导你"怎么用好 AI"，与 opengis-skills 的"知识层"（AI 应该知道什么）互补。
6. **docutranslate** 解决 GIS/CAD 技术文档翻译的痛点——术语一致、排版保留、本地安全。

这 8 个技能覆盖了从"搭应用"到"写代码"、从"学方法"到"译文档"的完整 AI 工具链。结合前几章介绍的 GIS、CAD、C# 等领域的 59 个技能，opengis-skills 为用户提供了在 AI 辅助下完成专业领域开发的完整能力闭环。

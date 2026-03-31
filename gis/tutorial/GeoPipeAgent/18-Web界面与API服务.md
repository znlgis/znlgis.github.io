---
layout: default
title: 第十八章：Web 界面与 API 服务
---

# 第十八章：Web 界面与 API 服务

## 18.1 概述

GeoPipeAgent 提供了一套完整的 Web 可视化界面，包含：

- **前端**：Vue 3 + TypeScript + Vite，可视化流水线编辑器 + LLM 对话助手
- **后端**：FastAPI + Python，提供 REST API + SSE 流式响应
- **任务队列**：Redis + RQ（Python Redis Queue），支持长时任务异步执行
- **国际化**：中英文双语界面（i18n）

```
浏览器 (Vue 3)
    ↕ HTTP / SSE
FastAPI 后端 (Python)
    ↕ OpenAI 兼容 API          ← LLM 服务（DeepSeek/GPT-4 等）
    ↕ Redis RQ 任务队列
RQ Worker（后台执行流水线）
```

## 18.2 启动 Web 服务

### 方法 1：Docker Compose（推荐）

```bash
# 1. 配置环境变量
cp .env.example .env
vim .env    # 填写 LLM_API_KEY 等

# 2. 启动所有服务
docker compose up -d

# 3. 检查服务状态
docker compose ps
```

访问地址：
- 前端 UI：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

### 方法 2：本地开发模式

```bash
# 安装依赖
pip install -e ".[web]"
pip install -r web/backend/requirements.txt
cd web/frontend && npm install

# 启动 Redis（需单独安装）
redis-server &

# 启动后端 API 服务
cd web/backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 启动 RQ Worker（新终端）
cd web/backend
python -m rq worker geopipe

# 启动前端开发服务器（新终端）
cd web/frontend
npm run dev
```

## 18.3 前端功能模块

前端采用 Vue 3 Composition API + Pinia 状态管理 + Vue Router，包含以下主要视图：

### 18.3.1 流水线编辑器（PipelineEditor.vue）

可视化流水线编辑器是 Web UI 的核心功能：

**主要组件**：
- `FlowCanvas`：基于 VueFlow/ReactFlow 的流程图画布，支持拖拽节点
- `StepNode`：步骤节点组件，显示步骤 ID、类型、状态
- `NodePalette`：步骤选择面板，列出所有可用步骤类别和步骤
- `StepConfigPanel`：选中节点的参数配置面板

**主要功能**：
- 从节点面板拖拽步骤到画布
- 拖拽连线建立步骤间的数据流连接
- 点击节点打开参数配置面板
- 实时 YAML 预览（与画布双向同步）
- 一键执行流水线，实时显示执行进度

### 18.3.2 LLM 对话助手（LlmChat.vue）

内嵌 AI 对话界面：

**主要组件**：
- `ChatWindow`：对话窗口，支持 Markdown 渲染
- `MessageBubble`：消息气泡（用户消息 / AI 回复）

**主要功能**：
- 用自然语言描述 GIS 分析需求
- AI 自动生成 YAML 流水线（基于 Skill 文件）
- 生成的流水线可一键导入编辑器
- 对话历史持久化存储

**交互示例**：

```
用户：帮我分析城市公园的 500 米步行可达范围，并找出范围内的居住小区

AI：我来为你生成一个公园可达性分析流水线：

[生成 YAML 按钮]

name: 公园步行可达性分析
...（YAML 内容）

这个流水线包含：
1. 读取公园和居住小区数据
2. 生成公园 500 米缓冲区
3. 查找缓冲区内的居住小区
4. 保存结果
```

### 18.3.3 模板库（TemplateGallery.vue）

预置流水线模板，一键使用：

- 缓冲区分析
- 叠加分析
- 批量格式转换
- 数据质检（矢量/栅格）
- 等高线提取
- 空间统计

点击模板即可在编辑器中打开，修改参数后执行。

### 18.3.4 Skill 管理（SkillManager.vue）

管理 AI 使用的 Skill 文件模块：

- 查看当前加载的 Skill 模块列表
- 启用/禁用特定步骤类别的 Skill
- 上传自定义 Skill 文件（支持自定义步骤的 AI 能力扩展）

### 18.3.5 任务管理（TaskManager.vue）

管理后台异步任务：

- 查看所有任务的状态（排队中/执行中/完成/失败）
- 实时查看任务执行日志（SSE 推送）
- 取消排队中的任务
- 查看任务历史报告

### 18.3.6 对话历史（ConversationHistory.vue）

查看和管理历史 AI 对话：

- 按时间列出历史对话
- 搜索历史对话内容
- 从历史对话中重新导入生成的流水线
- 清理历史记录

## 18.4 后端 API 服务

### 项目结构

```
web/backend/
├── main.py                    # FastAPI 应用入口
├── config.py                  # LLM 配置管理（读取 .env）
├── models/
│   └── schemas.py             # Pydantic 数据模型（请求/响应）
├── routers/                   # API 路由
│   ├── pipeline.py            # 流水线操作 API
│   ├── llm.py                 # LLM 对话/生成 API
│   ├── export.py              # 导出 API
│   ├── skill.py               # Skill 模块管理 API
│   ├── template.py            # 流水线模板 API
│   └── task.py                # 后台任务管理 API
└── services/                  # 业务逻辑
    ├── llm_service.py         # OpenAI 兼容 LLM 服务
    ├── conversation_store.py  # 对话历史持久化
    ├── pipeline_service.py    # 流水线执行服务
    └── task_queue.py          # Redis RQ 任务队列
```

### 主要 API 端点

#### 流水线相关（`/api/pipeline`）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pipeline/validate` | 校验 YAML 流水线 |
| POST | `/api/pipeline/run` | 同步执行流水线（小任务） |
| POST | `/api/pipeline/run/async` | 异步执行流水线（大任务，返回 task_id） |
| GET | `/api/pipeline/steps` | 获取所有步骤列表 |
| GET | `/api/pipeline/steps/{step_id}` | 获取步骤详情 |
| GET | `/api/pipeline/backends` | 获取后端状态 |

#### LLM 相关（`/api/llm`）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/llm/chat` | 发送对话消息，流式返回（SSE） |
| POST | `/api/llm/generate` | 根据需求描述生成流水线 |
| POST | `/api/llm/analyze` | 分析流水线结果报告 |
| GET | `/api/llm/conversations` | 获取对话历史列表 |
| DELETE | `/api/llm/conversations/{id}` | 删除指定对话 |

#### 任务管理（`/api/task`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/task/{task_id}` | 获取任务状态 |
| GET | `/api/task/{task_id}/logs` | 获取任务日志（SSE 流式推送） |
| DELETE | `/api/task/{task_id}` | 取消任务 |
| GET | `/api/task/` | 获取所有任务列表 |

#### Skill 管理（`/api/skill`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/skill/modules` | 获取 Skill 模块列表 |
| PUT | `/api/skill/modules/{module}` | 启用/禁用 Skill 模块 |
| POST | `/api/skill/upload` | 上传自定义 Skill 文件 |

### API 使用示例

#### 执行流水线（同步）

```python
import requests

response = requests.post(
    "http://localhost:8000/api/pipeline/run",
    json={
        "yaml": """
name: 缓冲区分析
steps:
  - id: load
    use: io.read_vector
    params:
      path: data/roads.geojson
  - id: buffer
    use: vector.buffer
    params:
      input: $load
      distance: 500
  - id: save
    use: io.write_vector
    params:
      input: $buffer
      path: output/result.geojson
""",
        "variables": {
            "input_path": "data/roads.geojson"
        }
    }
)
report = response.json()
print(f"状态：{report['pipeline']['status']}")
```

#### 与 LLM 对话（SSE 流式返回）

```python
import requests
import json

with requests.post(
    "http://localhost:8000/api/llm/chat",
    json={
        "message": "帮我写一个缓冲区分析流水线",
        "conversation_id": "session-001"
    },
    stream=True
) as response:
    for line in response.iter_lines():
        if line.startswith(b"data: "):
            data = json.loads(line[6:])
            print(data.get("content", ""), end="", flush=True)
```

#### 异步执行大任务

```python
import requests
import time

# 提交异步任务
submit_response = requests.post(
    "http://localhost:8000/api/pipeline/run/async",
    json={"yaml": large_pipeline_yaml}
)
task_id = submit_response.json()["task_id"]

# 轮询任务状态
while True:
    status_response = requests.get(f"http://localhost:8000/api/task/{task_id}")
    status = status_response.json()
    
    if status["status"] == "completed":
        print("任务完成！")
        print(status["result"])
        break
    elif status["status"] == "failed":
        print(f"任务失败：{status['error']}")
        break
    else:
        print(f"执行中... ({status.get('progress', 0)}%)")
        time.sleep(2)
```

## 18.5 后端服务配置（config.py）

```python
# web/backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # LLM 配置
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o"
    
    # 服务端口
    backend_port: int = 8000
    frontend_port: int = 3000
    redis_port: int = 6379
    
    # Redis 连接
    redis_url: str = "redis://localhost:6379"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

**支持的 LLM 服务**（任何 OpenAI 兼容 API）：

| 服务 | `LLM_BASE_URL` | 推荐模型 |
|------|----------------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` / `deepseek-reasoner` |
| Ollama（本地） | `http://localhost:11434/v1` | `llama3.1:70b` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |

## 18.6 Docker 服务架构

```yaml
# docker-compose.yml 中的四个服务

services:
  frontend:         # Nginx 静态文件服务器
    image: nginx    # 托管 Vue 3 构建产物
    ports: ["3000:80"]
  
  backend:          # FastAPI + GDAL
    build: ./web/backend
    # 基于 ghcr.io/osgeo/gdal:ubuntu-small-3.8.4 镜像
    # 内置 GDAL 3.8.4 + Python 3.11
    ports: ["8000:8000"]
    env_file: .env
    volumes:
      - ./data:/app/data    # 挂载本地数据目录
      - ./output:/app/output
  
  redis:            # Redis 7（任务队列后端）
    image: redis:7-alpine
    ports: ["6379:6379"]
  
  worker:           # RQ 后台任务处理工作进程
    build: ./web/backend
    command: python -m rq worker geopipe
    # 与 backend 共享镜像，但执行 RQ Worker 命令
```

### 数据目录挂载

在 `docker-compose.yml` 中，`data/` 和 `output/` 目录被挂载到容器中：

```bash
# 将数据文件放入 data/ 目录
cp my-data.shp data/

# 执行流水线（通过 Web UI 或 API）
# 流水线 YAML 中使用 data/my-data.shp 路径

# 结果文件会出现在 output/ 目录
ls output/
```

## 18.7 前端测试

```bash
# 单元测试（Vitest）
cd web/frontend
npm run test

# E2E 测试（Playwright）
npm run test:e2e
```

## 18.8 后端测试

```bash
# 后端 API 测试（pytest）
pip install -r web/backend/requirements.txt
pytest web/backend/tests/ -v
```

测试覆盖：
- 56 个 API 测试（pipeline/llm/task/skill/template 接口）
- 流水线执行集成测试
- LLM 服务 Mock 测试

## 18.9 小结

本章介绍了 GeoPipeAgent 的 Web 界面与 API 服务：

**前端（Vue 3）**：
- 流水线编辑器（可视化拖拽 + YAML 双向同步）
- LLM 对话助手（SSE 流式输出）
- 模板库、Skill 管理、任务管理、对话历史

**后端（FastAPI）**：
- 流水线 API（同步/异步执行）
- LLM API（对话/生成/分析）
- 任务管理 API（Redis RQ）
- Skill 管理 API

**部署**：Docker Compose 一键启动 4 个服务（前端/后端/Redis/Worker）

下一章将介绍如何开发自定义步骤和扩展 GeoPipeAgent 的能力。

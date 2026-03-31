---
layout: default
title: "第十八章：Web 界面与 API 服务"
---

# 第十八章：Web 界面与 API 服务

## 18.1 概述

GeoPipeAgent 提供可选的 Web 界面和 REST API 服务，通过安装 `web` 依赖包启用。基于 FastAPI 构建，支持实时流式输出（SSE）和 AI 集成。

### 安装 Web 依赖

```bash
pip install -e ".[web]"
```

安装内容：
- `fastapi`：高性能 Web 框架
- `uvicorn`：ASGI 服务器
- `openai`：OpenAI API 客户端
- `sse-starlette`：Server-Sent Events（实时推送）
- `python-multipart`：文件上传支持

---

## 18.2 启动 Web 服务

```bash
# 使用默认配置启动（localhost:8000）
geopipe-agent serve

# 指定端口
geopipe-agent serve --port 8080

# 指定监听地址（允许外部访问）
geopipe-agent serve --host 0.0.0.0 --port 8000

# 开发模式（代码变更自动重载）
geopipe-agent serve --reload

# 指定 OpenAI API Key（用于 AI 流水线生成功能）
geopipe-agent serve --openai-key sk-...

# 完整配置
geopipe-agent serve \
  --host 0.0.0.0 \
  --port 8000 \
  --openai-key $OPENAI_API_KEY \
  --reload
```

---

## 18.3 Web 界面功能

访问 `http://localhost:8000` 即可打开 Web 界面。

### 18.3.1 主要功能

| 功能 | 说明 |
|------|------|
| YAML 编辑器 | 在线编辑流水线 YAML，带语法高亮 |
| AI 生成 | 输入自然语言需求，AI 自动生成 YAML |
| 流水线运行 | 一键运行，实时查看执行日志 |
| 步骤浏览器 | 浏览所有可用步骤，查看参数说明 |
| 报告查看 | 可视化展示执行报告 |
| 文件管理 | 管理输入/输出数据文件 |

### 18.3.2 AI 对话界面

Web 界面提供类 ChatGPT 的对话体验：

```
用户：帮我对 data/roads.geojson 做 500 米缓冲区分析

AI：[思考中...]

我已理解你的需求。以下是生成的流水线：

```yaml
pipeline:
  name: "道路缓冲区分析"
  ...
```

要运行这个流水线吗？

用户：运行它

AI：[开始执行流水线...]
[实时显示每步执行状态]
✓ load-roads 完成 (0.03s)
✓ reproject 完成 (0.05s)  
✓ buffer 完成 (0.89s)
✓ save 完成 (0.23s)

流水线执行成功！结果已保存到 output/road_buffer.geojson
```

---

## 18.4 REST API 参考

### 18.4.1 API 文档

启动服务后，访问以下 URL 查看交互式 API 文档：
- Swagger UI：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`

### 18.4.2 核心 API 端点

#### `POST /api/pipeline/run`：运行流水线

```bash
curl -X POST http://localhost:8000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "yaml_content": "pipeline:\n  name: \"test\"...",
    "variables": {
      "buffer_dist": 500,
      "input_path": "data/roads.geojson"
    }
  }'
```

**请求体**：
```json
{
  "yaml_content": "string（YAML 流水线内容）",
  "variables": {
    "key": "value"
  }
}
```

**响应**：
```json
{
  "job_id": "job-uuid-12345",
  "status": "submitted",
  "stream_url": "/api/pipeline/run/job-uuid-12345/stream"
}
```

#### `GET /api/pipeline/run/{job_id}/stream`：实时流式输出（SSE）

```javascript
// 前端 JavaScript 示例
const eventSource = new EventSource('/api/pipeline/run/job-uuid-12345/stream');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log(data.type, data.message);
};

eventSource.addEventListener('step_complete', function(event) {
  const step = JSON.parse(event.data);
  console.log(`步骤 ${step.id} 完成，耗时 ${step.duration}s`);
});

eventSource.addEventListener('pipeline_complete', function(event) {
  const report = JSON.parse(event.data);
  console.log('流水线完成！', report);
  eventSource.close();
});
```

**SSE 事件类型**：

| 事件类型 | 数据结构 | 说明 |
|----------|----------|------|
| `step_start` | `{id, use}` | 步骤开始执行 |
| `step_complete` | `{id, status, duration, stats}` | 步骤执行完成 |
| `step_failed` | `{id, error, suggestion}` | 步骤执行失败 |
| `step_skipped` | `{id, reason}` | 步骤被条件跳过 |
| `pipeline_complete` | 完整报告 JSON | 流水线执行完毕 |
| `pipeline_failed` | `{error, step_id}` | 流水线执行失败 |
| `log` | `{level, message}` | 执行日志 |

#### `POST /api/pipeline/validate`：校验流水线

```bash
curl -X POST http://localhost:8000/api/pipeline/validate \
  -H "Content-Type: application/json" \
  -d '{
    "yaml_content": "pipeline:\n  name: \"test\"..."
  }'
```

**响应（成功）**：
```json
{
  "valid": true,
  "pipeline_info": {
    "name": "测试流水线",
    "step_count": 5,
    "variable_count": 3
  }
}
```

**响应（失败）**：
```json
{
  "valid": false,
  "errors": [
    "步骤 'buffer' 引用了不存在的步骤 'load-data'",
    "步骤 ID 'My Step' 包含非法字符"
  ]
}
```

#### `POST /api/ai/generate`：AI 生成流水线

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "对北京道路数据做500米缓冲区分析，输出GeoJSON",
    "model": "gpt-4o",
    "stream": true
  }'
```

**请求体**：
```json
{
  "prompt": "string（自然语言需求描述）",
  "model": "gpt-4o",   // 可选，默认 gpt-4o
  "stream": true       // 是否流式输出
}
```

**流式响应（SSE）**：
```
data: {"type": "thinking", "content": "分析用户需求..."}
data: {"type": "generating", "content": "pipeline:\n  name..."}
data: {"type": "complete", "yaml": "完整的YAML内容", "explanation": "解释说明"}
```

#### `GET /api/steps`：获取步骤列表

```bash
curl http://localhost:8000/api/steps
curl "http://localhost:8000/api/steps?category=vector"
```

**响应**：
```json
{
  "steps": [
    {
      "id": "vector.buffer",
      "category": "vector",
      "name": "缓冲区分析",
      "description": "...",
      "params": [...]
    }
  ],
  "total": 33
}
```

#### `GET /api/steps/{step_id}`：获取步骤详情

```bash
curl http://localhost:8000/api/steps/vector.buffer
```

#### `GET /api/backends`：获取后端状态

```bash
curl http://localhost:8000/api/backends
```

#### `POST /api/files/upload`：上传数据文件

```bash
curl -X POST http://localhost:8000/api/files/upload \
  -F "file=@data/roads.geojson"
```

**响应**：
```json
{
  "filename": "roads.geojson",
  "path": "uploads/roads.geojson",
  "size_mb": 2.3
}
```

---

## 18.5 Python 客户端示例

```python
import httpx
import json

BASE_URL = "http://localhost:8000"

# 1. 上传数据文件
with open("data/roads.geojson", "rb") as f:
    response = httpx.post(
        f"{BASE_URL}/api/files/upload",
        files={"file": f}
    )
upload_result = response.json()
print(f"文件上传成功：{upload_result['path']}")

# 2. 定义流水线
yaml_content = """
pipeline:
  name: "API 调用示例"
  variables:
    input_path: "uploads/roads.geojson"
    buffer_dist: 500
  steps:
    - id: load
      use: io.read_vector
      params:
        path: "${input_path}"
    - id: reproject
      use: vector.reproject
      params:
        input: "$load"
        target_crs: "EPSG:3857"
    - id: buffer
      use: vector.buffer
      params:
        input: "$reproject"
        distance: "${buffer_dist}"
    - id: save
      use: io.write_vector
      params:
        input: "$buffer"
        path: "output/result.geojson"
        format: "GeoJSON"
  outputs:
    result: "$save"
"""

# 3. 校验流水线
validate_response = httpx.post(
    f"{BASE_URL}/api/pipeline/validate",
    json={"yaml_content": yaml_content}
)
if not validate_response.json()["valid"]:
    print("流水线校验失败:", validate_response.json()["errors"])
    exit(1)

# 4. 运行流水线（获取 job_id）
run_response = httpx.post(
    f"{BASE_URL}/api/pipeline/run",
    json={
        "yaml_content": yaml_content,
        "variables": {"buffer_dist": 1000}  # 覆盖变量
    }
)
job_id = run_response.json()["job_id"]
print(f"流水线已提交，job_id: {job_id}")

# 5. 实时获取执行状态（SSE）
with httpx.stream("GET", f"{BASE_URL}/api/pipeline/run/{job_id}/stream") as stream:
    for line in stream.iter_lines():
        if line.startswith("data: "):
            event_data = json.loads(line[6:])
            if event_data["type"] == "step_complete":
                print(f"✓ {event_data['id']} 完成")
            elif event_data["type"] == "pipeline_complete":
                print("流水线执行成功！")
                print(json.dumps(event_data["report"], indent=2, ensure_ascii=False))
                break
            elif event_data["type"] == "pipeline_failed":
                print(f"流水线失败：{event_data['error']}")
                break
```

---

## 18.6 Docker 部署

### 18.6.1 Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（GDAL）
RUN apt-get update && apt-get install -y \
    gdal-bin libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY . .

# 安装 Python 依赖
RUN pip install -e ".[analysis,network,web]"

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["geopipe-agent", "serve", "--host", "0.0.0.0", "--port", "8000"]
```

### 18.6.2 docker-compose.yml

```yaml
version: '3.8'
services:
  geopipe-agent:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data          # 挂载数据目录
      - ./output:/app/output      # 挂载输出目录
      - ./pipelines:/app/pipelines # 挂载流水线目录
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: unless-stopped
```

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

---

## 18.7 安全配置

### 18.7.1 API Key 认证

```bash
# 启动时设置 API Key
geopipe-agent serve --api-key your-secret-key

# 调用时需要提供 Authorization 头
curl -H "Authorization: Bearer your-secret-key" \
  http://localhost:8000/api/steps
```

### 18.7.2 CORS 配置

```bash
# 允许特定域名的跨域请求
geopipe-agent serve --cors-origins "https://your-frontend.com,https://another-domain.com"

# 开发环境允许所有来源（不建议生产使用）
geopipe-agent serve --cors-origins "*"
```

---

## 18.8 本章小结

本章介绍了 GeoPipeAgent 的 Web 界面和 API 服务（需要 `web` 依赖包）：

1. **启动服务**：`geopipe-agent serve`，支持自定义端口和 Host
2. **Web 界面**：YAML 编辑器、AI 生成、实时执行日志
3. **REST API**：
   - `POST /api/pipeline/run`：运行流水线
   - `GET /api/.../stream`：SSE 实时日志
   - `POST /api/pipeline/validate`：校验流水线
   - `POST /api/ai/generate`：AI 生成流水线
   - `GET /api/steps`：步骤列表
4. **部署**：支持 Docker 容器化部署
5. **安全**：API Key 认证、CORS 配置

Web API 使 GeoPipeAgent 可以作为微服务集成到更大的数据处理系统中。

---

**导航**：[← 第十七章：AI Skill 生成系统](17-AI-Skill生成系统) ｜ [第十九章：自定义步骤与扩展开发 →](19-自定义步骤与扩展开发)

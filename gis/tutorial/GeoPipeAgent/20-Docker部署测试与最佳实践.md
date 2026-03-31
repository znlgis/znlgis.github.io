---
layout: default
title: 第二十章：Docker 部署、测试与最佳实践
---

# 第二十章：Docker 部署、测试与最佳实践

## 20.1 Docker 部署

### 20.1.1 快速部署（一键启动）

```bash
# 1. 克隆仓库
git clone https://github.com/znlgis/GeoPipeAgent.git
cd GeoPipeAgent

# 2. 配置环境变量
cp .env.example .env

# 3. 编辑 .env（填写 LLM API Key 等必要配置）
vim .env

# 4. 构建并启动所有服务
docker compose up -d

# 5. 验证服务正常运行
docker compose ps
curl http://localhost:8000/health
```

### 20.1.2 服务架构

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| `frontend` | nginx:alpine（托管 Vue 3 构建产物） | 3000 | 用户界面 |
| `backend` | ghcr.io/osgeo/gdal:ubuntu-small-3.8.4 | 8000 | FastAPI + GDAL |
| `redis` | redis:7-alpine | 6379 | 任务队列后端 |
| `worker` | 同 backend | — | RQ 后台工作进程 |

### 20.1.3 `docker-compose.yml` 详解

```yaml
services:
  frontend:
    build:
      context: ./web/frontend
      dockerfile: Dockerfile
    ports:
      - "${FRONTEND_PORT:-3000}:80"
    depends_on:
      - backend

  backend:
    build:
      context: ./web/backend
      dockerfile: Dockerfile
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    volumes:
      - ./data:/app/data          # 挂载本地数据目录
      - ./output:/app/output      # 挂载输出目录
      - ./cookbook:/app/cookbook  # 挂载示例流水线
    environment:
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_BASE_URL=${LLM_BASE_URL}
      - LLM_MODEL=${LLM_MODEL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data    # 持久化 Redis 数据

  worker:
    build:
      context: ./web/backend
      dockerfile: Dockerfile
    command: python -m rq worker geopipe
    volumes:
      - ./data:/app/data
      - ./output:/app/output
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

volumes:
  redis_data:
```

### 20.1.4 数据目录挂载

```bash
# 将 GIS 数据放到 data/ 目录
mkdir -p data output

cp ~/my-gis-data/roads.shp data/
cp ~/my-gis-data/buildings.gpkg data/

# 重启服务使数据目录生效（首次已挂载不需要重启）
docker compose restart backend worker

# 在流水线 YAML 中引用（容器内路径）
# path: "data/roads.shp"  →  容器内 /app/data/roads.shp
```

### 20.1.5 生产环境配置建议

**`.env` 生产配置示例**：

```bash
# LLM 配置（生产环境使用专用 API Key）
LLM_API_KEY=sk-prod-xxxxxxxxxxxxxxxxxxxx
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# 端口（生产环境使用标准端口并配合 Nginx 反代）
FRONTEND_PORT=3000
BACKEND_PORT=8000
REDIS_PORT=6379

# 安全配置（如有 Auth 中间件）
SECRET_KEY=your-random-secret-key
ALLOWED_ORIGINS=https://your-domain.com
```

**Nginx 反向代理配置（可选）**：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端
    location / {
        proxy_pass http://localhost:3000;
    }
    
    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header X-Real-IP $remote_addr;
        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
}
```

### 20.1.6 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建并更新服务
docker compose build
docker compose up -d

# 查看更新日志
docker compose logs --tail=50 backend
```

## 20.2 运行测试

### 20.2.1 核心库测试

```bash
# 安装开发依赖
pip install -e ".[dev,analysis,network]"

# 运行全部核心测试（193 个）
python -m pytest tests/ -v

# 运行带覆盖率报告
python -m pytest tests/ -v --cov=geopipe_agent --cov-report=html

# 运行特定类别测试
pytest tests/test_vector_steps.py -v        # 矢量步骤测试
pytest tests/test_raster_steps.py -v        # 栅格步骤测试
pytest tests/test_executor.py -v            # 执行器测试
pytest tests/test_context.py -v             # 上下文测试

# 仅运行失败的测试（调试时用）
pytest tests/ --lf -v
```

### 20.2.2 Web 后端测试

```bash
# 安装 Web 后端依赖
pip install -r web/backend/requirements.txt

# 运行 Web 后端测试（56 个）
pytest web/backend/tests/ -v

# 查看测试覆盖率
pytest web/backend/tests/ --cov=web/backend --cov-report=term-missing
```

### 20.2.3 前端测试

```bash
cd web/frontend

# 安装依赖
npm install

# TypeScript 类型检查
npm run type-check

# 单元测试（Vitest，27 个测试）
npm run test

# 生产构建（验证编译无错误）
npm run build

# E2E 测试（Playwright）
npm run test:e2e
```

### 20.2.4 CI/CD 配置

项目使用 GitHub Actions 自动 CI，配置在 `.github/workflows/ci.yml`：

```yaml
jobs:
  backend-tests:
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]    # 双 Python 版本矩阵
    steps:
      - name: 安装 GDAL 系统依赖
        run: sudo apt-get install gdal-bin libgdal-dev -y
      - name: 安装 Python 依赖
        run: pip install -e ".[dev,analysis,network,web]"
      - name: 运行核心测试
        run: pytest tests/ -v
      - name: 运行 Web 后端测试
        run: pytest web/backend/tests/ -v

  frontend-tests:
    steps:
      - name: TypeScript 类型检查
        run: npm run type-check
      - name: 单元测试
        run: npm run test
      - name: 生产构建
        run: npm run build

  docker-build:
    if: github.ref == 'refs/heads/main'     # 仅主分支构建镜像
    steps:
      - name: 构建前端镜像
        run: docker buildx build ./web/frontend
      - name: 构建后端镜像
        run: docker buildx build ./web/backend
```

## 20.3 最佳实践

### 20.3.1 流水线设计最佳实践

**1. 步骤职责单一**

每个步骤只做一件事，不要在一个步骤中做太多操作：

```yaml
# ✅ 好：步骤职责清晰
- id: load
  use: io.read_vector
  params: {path: "data/roads.shp"}

- id: reproject
  use: vector.reproject
  params: {input: $load, target_crs: "EPSG:3857"}

- id: buffer
  use: vector.buffer
  params: {input: $reproject, distance: 500}
```

**2. 合理使用变量**

将所有可能变化的值提取为变量：

```yaml
# ✅ 好：关键参数都是变量
variables:
  input_path: "data/roads.shp"
  buffer_dist: 500
  target_crs: "EPSG:3857"
  output_path: "output/result.geojson"
```

**3. 为重要步骤添加注释**

```yaml
steps:
  # 读取原始道路数据（WGS84 坐标系）
  - id: load-roads
    use: io.read_vector
    params:
      path: ${input_path}

  # 转换为 Web 墨卡托以便用米为单位做缓冲
  - id: reproject
    use: vector.reproject
    params:
      input: $load-roads
      target_crs: "EPSG:3857"
```

**4. 关键步骤后添加质检**

在重要处理步骤后添加质检，及早发现数据问题：

```yaml
  # 缓冲后立即检查几何有效性
  - id: buffer
    use: vector.buffer
    params:
      input: $reproject
      distance: 500

  - id: qc-buffer
    use: qc.geometry_validity
    params:
      input: $buffer
    on_error: skip   # 质检失败不影响主流程
```

### 20.3.2 性能优化最佳实践

**1. 先裁剪后处理**

对大型数据集，先裁剪到研究区域，再做复杂分析：

```yaml
# ✅ 好：先裁剪，减少后续计算量
- id: clip-first
  use: vector.clip
  params:
    input: $load-large-dataset
    clip: $study-area

- id: buffer-clipped
  use: vector.buffer
  params:
    input: $clip-first    # 处理裁剪后的小数据集
    distance: 500
```

**2. 栅格按需读取波段**

```yaml
# ✅ 好：只读取需要的波段
- id: load-landsat
  use: io.read_raster
  params:
    path: "data/landsat8_11bands.tif"
    bands: [4, 5]    # 只读 NDVI 所需的两个波段
```

**3. 大文件使用 bbox 过滤**

```yaml
- id: load-national
  use: io.read_vector
  params:
    path: "data/national_roads.shp"
    bbox: [116.0, 39.5, 117.0, 40.5]  # 只读取研究区域范围内的数据
```

**4. 输出使用压缩**

```yaml
- id: save-raster
  use: io.write_raster
  params:
    input: $result
    path: "output/result.tif"
    compress: lzw    # LZW 无损压缩可大幅减小文件大小
```

### 20.3.3 错误处理最佳实践

**1. 根据步骤重要性选择错误策略**

```yaml
# 关键步骤：fail（默认）
- id: load-critical
  use: io.read_vector
  params: {path: "data/critical.shp"}
  # on_error: fail  ← 默认，不需要显式写

# 可选步骤：skip
- id: optional-qc
  use: qc.topology
  params: {input: $load}
  on_error: skip

# 网络操作：retry
- id: geocode
  use: network.geocode
  params: {address: "某地址"}
  on_error: retry
```

**2. 分阶段质检**

```yaml
# 在数据进入关键处理前进行质检
- id: input-qc
  use: qc.geometry_validity
  params: {input: $load}
  on_error: fail    # 输入数据无效则终止

# 处理后再次质检
- id: output-qc
  use: qc.geometry_validity
  params: {input: $buffer}
  on_error: skip    # 输出质检失败不影响保存
```

### 20.3.4 AI 协作最佳实践

**1. 保持 Skill 文件最新**

每次添加自定义步骤后，及时更新 Skill 文件：

```bash
# 添加新步骤后
geopipe-agent generate-skill --output-dir skills/
# 重新上传到 AI 工具的知识库
```

**2. 校验 AI 生成的流水线**

AI 生成 YAML 后，先校验再执行：

```bash
geopipe-agent validate ai-generated-pipeline.yaml
```

**3. 为 AI 提供清晰的上下文**

向 AI 描述任务时，包含以下信息：
- 输入数据的路径和格式
- 输入数据的坐标系（CRS）
- 分析目标和期望输出格式
- 是否需要质检步骤

```
用户：请为以下任务生成 GeoPipeAgent 流水线：
- 输入：data/buildings.shp（EPSG:4326，建筑物多边形）
- 需要：检查几何有效性 → 投影到 EPSG:3857 → 计算缓冲区（50m）→ 保存为 GeoJSON
- 输出：output/result.geojson
- 如有无效几何，用 0 距离缓冲修复后再处理
```

### 20.3.5 安全最佳实践

**1. 不在 YAML 中硬编码敏感信息**

```yaml
# ❌ 不好：API Key 硬编码在 YAML 中
variables:
  api_key: "sk-xxxxxxxxxxxxxxxxxxxx"

# ✅ 好：通过 --var 在运行时注入
variables:
  api_key: ""    # 占位，通过 CLI 传入

# 运行时：
# geopipe-agent run pipeline.yaml --var "api_key=$MY_API_KEY"
```

**2. 限制输入路径**

在 Docker 部署中，通过挂载目录限制可访问的文件范围：

```yaml
volumes:
  - ./data:/app/data:ro    # 只读挂载，防止流水线修改原始数据
  - ./output:/app/output   # 读写挂载，允许输出
```

**3. `when` 表达式的安全性**

GeoPipeAgent 的安全求值器（AST 白名单）确保 `when` 表达式不会执行危险代码，即使在 AI 生成流水线的场景中也是安全的。

## 20.4 Cookbook 示例索引

`cookbook/` 目录提供了 7 个即用型流水线示例：

| 文件 | 说明 | 演示的特性 |
|------|------|-----------|
| `buffer-analysis.yaml` | 缓冲区分析 | IO + 投影 + 缓冲 + 保存 |
| `overlay-analysis.yaml` | 叠加分析 | 多图层加载 + 叠加操作 |
| `batch-convert.yaml` | 批量格式转换 | 变量参数化 + IO |
| `filter-simplify.yaml` | 属性筛选 + 几何简化 | query + simplify |
| `dissolve-analysis.yaml` | 按属性融合 | dissolve + 聚合统计 |
| `vector-qc.yaml` | 矢量数据质检 | 多种 qc 步骤组合 |
| `raster-qc.yaml` | 栅格数据质检 | 栅格 qc 步骤组合 |

快速运行示例：

```bash
# 缓冲区分析（准备好测试数据后运行）
geopipe-agent run cookbook/buffer-analysis.yaml

# 矢量质检（对自己的数据）
geopipe-agent run cookbook/vector-qc.yaml \
  --var input_path=data/my_data.shp
```

## 20.5 常见问题解答（FAQ）

**Q1：如何处理大于 1GB 的 GIS 数据？**

A：建议：
1. 使用 `bbox` 参数空间过滤，只读取研究区域
2. 使用 `vector.clip` 先裁剪，再做复杂分析
3. 考虑将数据分块，用批处理脚本分批执行
4. 对于超大栅格，使用 Cloud Optimized GeoTIFF（COG）格式

**Q2：AI 生成的 YAML 中步骤顺序有问题，如何排查？**

A：用 `validate` 命令检查引用顺序：

```bash
geopipe-agent validate ai-generated.yaml
# 如果有前向引用，会报 PipelineValidationError
```

**Q3：如何在 Windows 上使用 GeoPipeAgent？**

A：推荐以下方式（按优先级）：
1. **WSL2 + Ubuntu**：最稳定，完整 Linux 环境
2. **Docker Desktop**：使用 `docker compose up -d` 一键启动
3. **Anaconda + conda-forge**：`conda install -c conda-forge geopandas rasterio`

**Q4：如何为自定义步骤编写 AI Skill 文档？**

A：自定义步骤通过 `@step` 装饰器注册后，`generate-skill` 命令会**自动**将其包含在生成的 Skill 文件中，无需手动编写。

**Q5：执行报告中如何判断所有步骤都成功了？**

```python
import json

report = json.loads(output)

# 检查整体状态
assert report["pipeline"]["status"] == "success"

# 检查所有步骤
failed_steps = [
    s for s in report["steps"] 
    if s["status"] not in ("success", "skipped")
]
assert len(failed_steps) == 0
```

**Q6：如何在流水线中访问上一步骤的属性？**

A：使用步骤属性引用语法：

```yaml
steps:
  - id: load
    use: io.read_vector
    params:
      path: "data/input.shp"

  - id: check-crs
    use: qc.crs_check
    params:
      input: $load
      expected_crs: "EPSG:4326"
    when: "$load.crs != 'EPSG:4326'"    # 基于前步骤的 CRS 属性决定是否执行
```

## 20.6 小结

本章介绍了 GeoPipeAgent 的部署、测试和最佳实践：

**Docker 部署**：
- 一键 `docker compose up -d` 启动全部服务
- 通过 `.env` 配置 LLM API Key 和端口
- 数据目录挂载实现容器内外数据共享

**测试体系**：
- 核心库：193 个测试（`pytest tests/`）
- Web 后端：56 个测试（`pytest web/backend/tests/`）
- 前端：27 个单元测试 + E2E 测试

**最佳实践**：
- 流水线设计：单一职责、变量化、注释
- 性能优化：先裁剪、按需读取波段、压缩输出
- 错误处理：关键步骤 fail、可选步骤 skip、网络操作 retry
- AI 协作：保持 Skill 文件最新、校验 AI 生成的流水线
- 安全：不硬编码敏感信息、限制挂载目录权限

至此，GeoPipeAgent 的完整学习教程已经全部结束。从概述安装到 AI 集成，从步骤详解到自定义扩展，希望这份教程能帮助你充分发挥 GeoPipeAgent 在 GIS 数据分析中的潜力！

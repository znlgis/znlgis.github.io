---
layout: default
title: CLI命令行工具使用指南
---

# 第十三章：CLI 命令行工具使用指南

## 13.1 概述

GeoPipeAgent 提供了功能完整的命令行接口（CLI），基于 Click 框架构建。CLI 是框架的主要用户入口，提供 8 个命令，覆盖了流水线执行、验证、步骤查询、数据信息查看、后端管理和文档生成等功能。

安装 GeoPipeAgent 后，`geopipe-agent` 命令即可使用：

```bash
geopipe-agent --help
```

## 13.2 命令总览

| 命令 | 说明 | 示例 |
|------|------|------|
| `run` | 执行 YAML 流水线 | `geopipe-agent run pipeline.yaml` |
| `validate` | 验证流水线（不执行） | `geopipe-agent validate pipeline.yaml` |
| `list-steps` | 列出所有可用步骤 | `geopipe-agent list-steps` |
| `describe` | 查看步骤详细信息 | `geopipe-agent describe vector.buffer` |
| `info` | 查看 GIS 数据文件信息 | `geopipe-agent info data/roads.shp` |
| `backends` | 列出后端可用状态 | `geopipe-agent backends` |
| `generate-skill-doc` | 生成步骤参考文档 | `geopipe-agent generate-skill-doc` |
| `generate-skill` | 生成完整 Skill 文件集 | `geopipe-agent generate-skill` |

## 13.3 run — 执行流水线

### 13.3.1 基本用法

```bash
geopipe-agent run <pipeline.yaml>
```

### 13.3.2 选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `--var key=value` | 覆盖变量（可多次使用） | `--var input_path=data/new.shp` |
| `--log-level` | 日志级别 | `--log-level DEBUG` |
| `--json-log` | JSON 格式日志 | `--json-log` |

### 13.3.3 使用示例

**执行流水线：**

```bash
geopipe-agent run cookbook/buffer-analysis.yaml
```

**覆盖变量：**

```bash
geopipe-agent run cookbook/buffer-analysis.yaml \
    --var input_path=data/highways.shp \
    --var buffer_dist=1000
```

**调试模式：**

```bash
geopipe-agent run pipeline.yaml --log-level DEBUG
```

**JSON 日志（适合 AI 解析）：**

```bash
geopipe-agent run pipeline.yaml --json-log
```

### 13.3.4 输出格式

成功执行时，JSON 报告输出到 stdout：

```json
{
  "pipeline": "缓冲区分析",
  "status": "success",
  "duration_seconds": 2.345,
  "steps": [
    {
      "id": "load-roads",
      "step": "io.read_vector",
      "status": "success",
      "duration": 0.45,
      "output_summary": {
        "feature_count": 1234,
        "crs": "EPSG:4326",
        "geometry_types": ["LineString"]
      }
    },
    ...
  ],
  "outputs": {
    "result": "$save-result.output",
    "stats": { ... }
  }
}
```

执行失败时，错误信息输出到 stderr：

```json
{
  "error": "StepExecutionError",
  "step_id": "buffer",
  "message": "...",
  "suggestion": "Add a vector.reproject step before this step."
}
```

### 13.3.5 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 执行成功 |
| 1 | 执行失败 |

## 13.4 validate — 验证流水线

### 13.4.1 用法

```bash
geopipe-agent validate <pipeline.yaml>
```

### 13.4.2 功能

只验证 YAML 流水线的合法性，不执行任何步骤。适合在运行前预检。

### 13.4.3 输出示例

**验证通过：**

```json
{
  "status": "valid",
  "pipeline": "缓冲区分析",
  "steps_count": 4,
  "steps": [
    {"id": "load-roads", "use": "io.read_vector"},
    {"id": "reproject", "use": "vector.reproject"},
    {"id": "buffer-analysis", "use": "vector.buffer"},
    {"id": "save-result", "use": "io.write_vector"}
  ]
}
```

**验证失败：**

```json
{
  "status": "invalid",
  "error": "PipelineValidationError",
  "message": "Step id 'My Step' is invalid. step_id must match [a-z0-9_-]."
}
```

## 13.5 list-steps — 列出步骤

### 13.5.1 用法

```bash
geopipe-agent list-steps [--category <类别>] [--format <格式>]
```

### 13.5.2 选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `--category` | 按类别过滤 | `--category vector` |
| `--format` | 输出格式（table/json） | `--format json` |

### 13.5.3 使用示例

**表格格式（默认）：**

```bash
geopipe-agent list-steps
```

输出：

```
ID                             Name                 Category     Backends
--------------------------------------------------------------------------------
io.read_vector                 读取矢量数据          io           -
io.write_vector                写入矢量数据          io           -
vector.buffer                  矢量缓冲区分析        vector       gdal_python, qgis_process
...
Total: 23 steps
```

**按类别过滤：**

```bash
geopipe-agent list-steps --category vector
```

**JSON 格式：**

```bash
geopipe-agent list-steps --format json
```

## 13.6 describe — 查看步骤详情

### 13.6.1 用法

```bash
geopipe-agent describe <step_id>
```

### 13.6.2 输出示例

```bash
geopipe-agent describe vector.buffer
```

```json
{
  "id": "vector.buffer",
  "name": "矢量缓冲区分析",
  "description": "对输入的矢量数据生成指定距离的缓冲区",
  "category": "vector",
  "params": {
    "input": {
      "type": "geodataframe",
      "required": true,
      "description": "输入矢量数据"
    },
    "distance": {
      "type": "number",
      "required": true,
      "description": "缓冲区距离（单位取决于 CRS）"
    },
    "cap_style": {
      "type": "string",
      "required": false,
      "default": "round",
      "enum": ["round", "flat", "square"],
      "description": "端点样式"
    }
  },
  "outputs": {
    "output": {"type": "geodataframe", "description": "缓冲区结果"},
    "stats": {"type": "dict", "description": "统计信息"}
  },
  "backends": ["gdal_python", "qgis_process"],
  "examples": [
    {
      "description": "500米道路缓冲区",
      "params": {"input": "$roads.output", "distance": 500}
    }
  ]
}
```

## 13.7 info — 查看数据文件信息

### 13.7.1 用法

```bash
geopipe-agent info <file>
```

### 13.7.2 功能

自动识别矢量或栅格文件并显示摘要信息。

### 13.7.3 矢量文件示例

```bash
geopipe-agent info data/roads.shp
```

```json
{
  "path": "data/roads.shp",
  "format": "vector",
  "feature_count": 1234,
  "crs": "EPSG:4326",
  "geometry_types": ["LineString"],
  "columns": ["id", "name", "type", "length", "geometry"],
  "bounds": [116.0, 39.0, 117.0, 40.0]
}
```

### 13.7.4 栅格文件示例

```bash
geopipe-agent info data/dem.tif
```

```json
{
  "path": "data/dem.tif",
  "format": "raster",
  "driver": "GTiff",
  "crs": "EPSG:4326",
  "width": 1000,
  "height": 800,
  "bands": 1,
  "dtypes": ["float32"],
  "bounds": [116.0, 39.0, 117.0, 40.0],
  "transform": [0.001, 0.0, 116.0, 0.0, -0.001, 40.0]
}
```

### 13.7.5 识别逻辑

`info` 命令先尝试作为矢量文件读取（GeoPandas），失败后尝试作为栅格文件读取（Rasterio）。

## 13.8 backends — 后端状态

### 13.8.1 用法

```bash
geopipe-agent backends
```

### 13.8.2 输出

```json
[
  {"name": "gdal_python", "available": true},
  {"name": "gdal_cli", "available": false},
  {"name": "qgis_process", "available": false}
]
```

## 13.9 generate-skill-doc — 生成步骤参考文档

### 13.9.1 用法

```bash
geopipe-agent generate-skill-doc
```

### 13.9.2 功能

生成所有已注册步骤的 Markdown 参考文档，输出到 stdout。文档按类别组织，包含每个步骤的参数、输出和示例。

### 13.9.3 输出结构

```markdown
# GeoPipeAgent Steps Reference

## io

### `io.read_vector`

**读取矢量数据** — 从文件读取矢量数据

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | ✅ | — | 矢量数据文件路径 |
...
```

可以重定向到文件：

```bash
geopipe-agent generate-skill-doc > steps-reference.md
```

## 13.10 generate-skill — 生成 Skill 文件集

### 13.10.1 用法

```bash
geopipe-agent generate-skill [--output-dir <目录>]
```

### 13.10.2 默认输出目录

`skills/geopipe-agent/`

### 13.10.3 生成的文件

```
skills/geopipe-agent/
├── SKILL.md                           # 主 Skill 文件
└── reference/
    ├── steps-reference.md             # 步骤参考
    └── pipeline-schema.md             # Schema 文档
```

### 13.10.4 使用示例

```bash
# 生成到默认目录
geopipe-agent generate-skill

# 指定输出目录
geopipe-agent generate-skill --output-dir docs/skills
```

## 13.11 CLI 在 AI 工作流中的使用

### 13.11.1 AI Agent 典型调用流程

```bash
# 1. AI 了解框架能力
geopipe-agent generate-skill-doc

# 2. AI 生成 YAML 流水线（保存到文件）

# 3. AI 验证流水线
geopipe-agent validate pipeline.yaml

# 4. AI 执行流水线
geopipe-agent run pipeline.yaml

# 5. AI 解析 JSON 报告
```

### 13.11.2 错误恢复流程

```bash
# 执行失败
geopipe-agent run pipeline.yaml 2> error.json

# AI 读取错误和建议
cat error.json
# {"error": "StepExecutionError", "suggestion": "Add a vector.reproject step..."}

# AI 修改流水线并重试
geopipe-agent run pipeline_v2.yaml
```

### 13.11.3 批处理模式

使用变量覆盖实现批处理：

```bash
for file in data/*.shp; do
    geopipe-agent run pipeline.yaml --var input_path="$file" > "output/$(basename $file .shp).json"
done
```

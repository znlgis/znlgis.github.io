---
layout: default
title: 第十六章：CLI 命令行工具完全指南
---

# 第十六章：CLI 命令行工具完全指南

## 16.1 概述

GeoPipeAgent 提供了功能完整的命令行工具 `geopipe-agent`，通过 Click 框架实现。安装后可在终端直接使用：

```bash
geopipe-agent --help
```

完整命令列表：

| 命令 | 说明 |
|------|------|
| `run` | 执行 YAML 流水线 |
| `validate` | 校验 YAML 流水线（不执行） |
| `list-steps` | 列出所有可用步骤 |
| `describe` | 查看步骤详情 |
| `info` | 查看 GIS 数据文件摘要 |
| `backends` | 列出可用后端 |
| `generate-skill-doc` | 生成步骤参考文档（供 AI 使用） |
| `generate-skill` | 生成 AI Skill 文件集 |

## 16.2 `geopipe-agent run`

### 基本语法

```bash
geopipe-agent run <YAML_FILE> [选项]
```

### 完整选项

| 选项 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `--var` | 多值字符串 | — | 覆盖流水线变量，格式 `key=value` |
| `--log-level` | 选项 | `INFO` | 日志级别：`DEBUG`/`INFO`/`WARNING`/`ERROR` |
| `--json-log` | 标志 | False | 使用 JSON 格式输出日志 |

### 使用示例

```bash
# 基本执行
geopipe-agent run pipeline.yaml

# 覆盖变量
geopipe-agent run pipeline.yaml --var input_path=data/roads.shp

# 覆盖多个变量
geopipe-agent run pipeline.yaml \
  --var input_path=data/roads.shp \
  --var buffer_dist=1000 \
  --var output_dir=output/batch001/

# 调试模式（显示详细日志）
geopipe-agent run pipeline.yaml --log-level DEBUG

# JSON 日志格式（便于日志聚合）
geopipe-agent run pipeline.yaml --json-log

# 保存报告到文件
geopipe-agent run pipeline.yaml > report.json

# 保存报告并查看日志（stdout 报告，stderr 日志）
geopipe-agent run pipeline.yaml > report.json 2>execution.log
```

### 输出格式

成功时：

```json
{
  "pipeline": {
    "name": "道路缓冲区分析",
    "status": "success",
    "duration": 0.34,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "steps": [
    {"id": "load-roads", "step": "io.read_vector", "status": "success", "duration": 0.12, ...},
    {"id": "buffer", "step": "vector.buffer", "status": "success", "duration": 0.05, ...}
  ],
  "outputs": {
    "result": {"type": "GeoDataFrame", "feature_count": 42, "crs": "EPSG:3857"}
  }
}
```

失败时（输出到 stderr，exit code 1）：

```json
{
  "error": "StepExecutionError",
  "step_id": "buffer",
  "message": "步骤 'buffer' 执行失败：CRS mismatch",
  "suggestion": "Add a vector.reproject step before this step."
}
```

### 在脚本中使用

```bash
#!/bin/bash
# 批量处理脚本

for file in data/*.shp; do
  base=$(basename "$file" .shp)
  output=$(geopipe-agent run template.yaml \
    --var "input_path=$file" \
    --var "output_path=output/${base}.geojson" 2>/dev/null)
  
  # 检查执行状态
  status=$(echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pipeline']['status'])")
  
  if [ "$status" = "success" ]; then
    echo "✅ $base 处理成功"
  else
    echo "❌ $base 处理失败"
    echo "$output" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message', '未知错误'))"
  fi
done
```

```python
# Python 中调用
import subprocess
import json

result = subprocess.run(
    ["geopipe-agent", "run", "pipeline.yaml", "--var", "input_path=data/roads.shp"],
    capture_output=True, text=True
)

report = json.loads(result.stdout)
if report["pipeline"]["status"] == "success":
    feature_count = report["outputs"]["result"]["feature_count"]
    print(f"处理成功，输出 {feature_count} 个要素")
```

## 16.3 `geopipe-agent validate`

### 基本语法

```bash
geopipe-agent validate <YAML_FILE> [--log-level LEVEL]
```

### 说明

校验流水线配置的合法性，**不执行**任何 GIS 操作。适合在 CI/CD 中作为提交前检查。

### 使用示例

```bash
# 基本校验
geopipe-agent validate pipeline.yaml

# 静默模式（仅看结果）
geopipe-agent validate pipeline.yaml --log-level ERROR

# 在 CI 中使用（exit code 非 0 表示失败）
geopipe-agent validate pipeline.yaml && echo "校验通过" || echo "校验失败"
```

### 输出示例

校验通过：

```json
{
  "status": "valid",
  "pipeline": "道路缓冲区分析",
  "steps_count": 4,
  "steps": [
    {"id": "load-roads", "use": "io.read_vector"},
    {"id": "reproject", "use": "vector.reproject"},
    {"id": "buffer", "use": "vector.buffer"},
    {"id": "save", "use": "io.write_vector"}
  ]
}
```

校验失败（stderr，exit code 1）：

```json
{
  "status": "invalid",
  "error": "PipelineValidationError",
  "message": "步骤 ID 'buffer' 重复出现在第 3 步和第 7 步。所有步骤 ID 必须唯一。"
}
```

## 16.4 `geopipe-agent list-steps`

### 基本语法

```bash
geopipe-agent list-steps [--category CATEGORY] [--format FORMAT]
```

### 选项

| 选项 | 值 | 说明 |
|------|-----|------|
| `--category` | `io`/`vector`/`raster`/`analysis`/`network`/`qc` | 过滤步骤类别 |
| `--format` | `table`（默认）/`json` | 输出格式 |

### 使用示例

```bash
# 列出所有步骤（表格格式）
geopipe-agent list-steps

# 只列出矢量步骤
geopipe-agent list-steps --category vector

# JSON 格式输出（便于程序解析）
geopipe-agent list-steps --format json

# 列出质检步骤（JSON 格式）
geopipe-agent list-steps --category qc --format json
```

### 输出示例（表格格式）

```
ID                             Name                 Category     Backends
--------------------------------------------------------------------------------
io.read_vector                 读取矢量数据          io           native_python
io.write_vector                写入矢量数据          io           native_python
io.read_raster                 读取栅格数据          io           native_python
io.write_raster                写入栅格数据          io           native_python
vector.buffer                  缓冲区分析            vector       native_python
vector.clip                    矢量裁剪              vector       native_python
...

Total: 33 steps
```

## 16.5 `geopipe-agent describe`

### 基本语法

```bash
geopipe-agent describe <STEP_ID>
```

### 使用示例

```bash
# 查看缓冲区分析步骤详情
geopipe-agent describe vector.buffer

# 查看 DBSCAN 聚类步骤详情
geopipe-agent describe analysis.cluster

# 查看几何质检步骤详情
geopipe-agent describe qc.geometry_validity
```

### 输出示例

```json
{
  "id": "vector.buffer",
  "name": "缓冲区分析",
  "category": "vector",
  "description": "对矢量要素进行缓冲区分析，生成缓冲面（Polygon）。",
  "params": {
    "input": {
      "required": true,
      "type": "geodataframe",
      "description": "输入 GeoDataFrame（来自前一步骤的引用）"
    },
    "distance": {
      "required": true,
      "type": "number",
      "description": "缓冲距离，单位与 CRS 一致"
    },
    "cap_style": {
      "required": false,
      "type": "string",
      "description": "端点样式：round / flat / square，默认 round"
    },
    "join_style": {
      "required": false,
      "type": "string",
      "description": "拐角样式：round / mitre / bevel，默认 round"
    },
    "resolution": {
      "required": false,
      "type": "integer",
      "description": "圆弧分段数，默认 16"
    }
  },
  "backends": ["native_python"]
}
```

## 16.6 `geopipe-agent info`

### 基本语法

```bash
geopipe-agent info <GIS_FILE>
```

### 说明

快速查看 GIS 数据文件（矢量或栅格）的基本信息，无需编写代码。

### 使用示例

```bash
# 查看矢量文件信息
geopipe-agent info data/roads.shp
geopipe-agent info data/buildings.gpkg
geopipe-agent info data/points.geojson

# 查看栅格文件信息
geopipe-agent info data/dem.tif
geopipe-agent info data/landsat.tif
```

### 矢量文件输出示例

```json
{
  "path": "data/roads.shp",
  "format": "vector",
  "feature_count": 1543,
  "crs": "EPSG:4326",
  "geometry_types": ["LineString"],
  "columns": ["name", "type", "length", "lanes"],
  "bounds": [116.3, 39.5, 117.2, 40.1]
}
```

### 栅格文件输出示例

```json
{
  "path": "data/dem.tif",
  "format": "raster",
  "driver": "GTiff",
  "crs": "EPSG:4326",
  "width": 3601,
  "height": 2401,
  "bands": 1,
  "dtypes": ["float32"],
  "bounds": [116.0, 39.0, 117.0, 40.0],
  "transform": [0.000277, 0.0, 116.0, 0.0, -0.000277, 40.0]
}
```

## 16.7 `geopipe-agent backends`

### 基本语法

```bash
geopipe-agent backends
```

### 说明

检查所有后端的可用状态，帮助诊断后端依赖问题。

### 输出示例

```json
[
  {"name": "native_python", "available": true},
  {"name": "gdal_cli", "available": true},
  {"name": "gdal_python", "available": false},
  {"name": "qgis_process", "available": false},
  {"name": "pyqgis", "available": false},
  {"name": "generic_cli", "available": true},
  {"name": "curl_api", "available": true}
]
```

`available: false` 表示该后端的依赖未满足，需要安装相应工具。

## 16.8 `geopipe-agent generate-skill-doc`

### 基本语法

```bash
geopipe-agent generate-skill-doc [> skill_reference.md]
```

### 说明

生成所有内置步骤的 Markdown 格式参考文档，主要供 AI 读取以了解框架能力。

```bash
# 生成并保存到文件
geopipe-agent generate-skill-doc > skills/reference.md

# 直接查看
geopipe-agent generate-skill-doc | head -50
```

### 输出格式

生成的 Markdown 文档包含所有步骤的：
- ID、名称、类别
- 功能描述
- 参数说明（类型、是否必填、默认值、描述）
- 使用示例

## 16.9 `geopipe-agent generate-skill`

### 基本语法

```bash
geopipe-agent generate-skill [--output-dir DIR]
```

### 说明

生成完整的 AI Skill 文件集（多个 Markdown 文件），按步骤类别组织，供 AI 工具（如 Claude Projects、GPT Custom Instructions）配置使用。

```bash
# 生成到默认目录（skills/geopipe-agent/）
geopipe-agent generate-skill

# 指定输出目录
geopipe-agent generate-skill --output-dir my-project/ai-skills/
```

### 生成的文件结构

```
skills/geopipe-agent/
├── 00-overview.md          # 框架概述、流水线格式说明
├── 01-io-steps.md          # IO 步骤参考
├── 02-vector-steps.md      # 矢量步骤参考
├── 03-raster-steps.md      # 栅格步骤参考
├── 04-analysis-steps.md    # 空间分析步骤参考
├── 05-network-steps.md     # 网络分析步骤参考
└── 06-qc-steps.md          # 数据质检步骤参考
```

详细用法请参见第十七章：AI Skill 生成系统。

## 16.10 常用工作流

### 开发调试工作流

```bash
# 1. 编写 YAML 流水线
vim my-pipeline.yaml

# 2. 校验配置
geopipe-agent validate my-pipeline.yaml

# 3. 查看不确定的步骤详情
geopipe-agent describe vector.buffer

# 4. 检查输入数据信息
geopipe-agent info data/roads.shp

# 5. 调试执行（详细日志）
geopipe-agent run my-pipeline.yaml --log-level DEBUG

# 6. 正式执行并保存报告
geopipe-agent run my-pipeline.yaml > report.json
```

### 批量处理工作流

```bash
# 创建参数化模板
cat > template.yaml << 'EOF'
name: 批量处理模板
variables:
  input_path: ""
  output_path: ""
steps:
  - id: load
    use: io.read_vector
    params:
      path: ${input_path}
  - id: process
    use: vector.buffer
    params:
      input: $load
      distance: 500
  - id: save
    use: io.write_vector
    params:
      input: $process
      path: ${output_path}
outputs:
  result: $save
EOF

# 批量执行
for f in data/*.shp; do
  base=$(basename "$f" .shp)
  geopipe-agent run template.yaml \
    --var "input_path=$f" \
    --var "output_path=output/${base}_buffer.geojson"
done
```

### CI/CD 集成

```yaml
# .github/workflows/validate-pipelines.yml
name: 校验流水线配置
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: 安装 GeoPipeAgent
        run: pip install -e ".[dev]"
      - name: 校验所有流水线
        run: |
          for f in pipelines/*.yaml; do
            echo "校验 $f..."
            geopipe-agent validate "$f"
          done
```

## 16.11 小结

本章详细介绍了 `geopipe-agent` CLI 的全部命令：

- **`run`**：执行流水线，支持 `--var` 变量覆盖、`--log-level` 日志控制、`--json-log` JSON 格式日志
- **`validate`**：流水线配置校验，适合 CI/CD 集成
- **`list-steps`**：查看所有/指定类别的步骤，支持 JSON 格式
- **`describe`**：查看步骤详细参数说明
- **`info`**：查看 GIS 文件摘要信息
- **`backends`**：检查各后端可用状态
- **`generate-skill-doc`/`generate-skill`**：生成 AI Skill 文档

下一章将介绍 AI Skill 生成系统的工作原理和使用方法。

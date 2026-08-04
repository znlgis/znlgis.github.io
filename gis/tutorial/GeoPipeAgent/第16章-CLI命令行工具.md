---
layout: default
title: "第十六章：CLI 命令行工具完全指南"
---

# 第十六章：CLI 命令行工具完全指南

`geopipe-agent` 是 GeoPipeAgent 的命令行接口，基于 Click 框架构建，提供 9 个子命令，覆盖流水线运行、验证、步骤查询和 Skill 生成等功能。

---

## 16.1 命令总览

```bash
geopipe-agent --help
```

```
Usage: geopipe-agent [OPTIONS] COMMAND [ARGS]...

  GeoPipeAgent — AI-Native GIS Analysis Pipeline Framework.

Options:
  --version  Show the version and exit.
  --help     Show this message and exit.

Commands:
  backends             List available GIS backends and their status.
  describe             Show detailed information about a specific step.
  generate-skill       Generate complete Skill file set for AI.
  generate-skill-doc   Generate steps reference Markdown for AI consumption.
  info                 Show summary information about a GIS data file.
  list-steps           List all available pipeline steps.
  run                  Run a YAML pipeline file.
  validate             Validate a YAML pipeline file without executing it.
```

---

## 16.2 `run`：执行流水线

最核心的命令，执行 YAML 流水线文件并输出 JSON 报告。

### 命令格式

```bash
geopipe-agent run [OPTIONS] FILE
```

### 选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--log-level` | `INFO` | 日志级别：`DEBUG`/`INFO`/`WARNING`/`ERROR` |
| `--json-log` | 关闭 | 使用 JSON 格式日志（便于机器解析） |
| `--var key=value` | — | 覆盖流水线变量（可多次使用） |

### 示例

```bash
# 基础执行
geopipe-agent run pipeline.yaml

# 覆盖变量
geopipe-agent run pipeline.yaml --var input_path=data/roads.shp --var buffer_dist=500

# 调试模式
geopipe-agent run pipeline.yaml --log-level DEBUG

# JSON 格式日志（适合日志系统集成）
geopipe-agent run pipeline.yaml --json-log

# 将报告保存到文件
geopipe-agent run pipeline.yaml > report.json
```

### 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 成功 |
| `1` | 失败（YAML 解析错误、校验错误、步骤执行错误等） |

### `--var` 参数格式规范

```bash
# 正确
--var key=value
--var buffer_dist=500
--var input_path=data/roads.shp
--var output_format=GeoJSON

# 错误（缺少 = 号）
--var key value    # ❌
```

---

## 16.3 `validate`：校验流水线

仅校验 YAML 格式和语义，不执行步骤，用于快速检查流水线是否合法。

### 命令格式

```bash
geopipe-agent validate [OPTIONS] FILE
```

### 选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--log-level` | `WARNING` | 日志级别 |

### 示例

```bash
geopipe-agent validate my_pipeline.yaml
```

**成功输出**：

```json
{
  "status": "valid",
  "pipeline": "道路缓冲区分析",
  "steps_count": 4,
  "steps": [
    {"id": "load-roads",   "use": "io.read_vector"},
    {"id": "reproject",    "use": "vector.reproject"},
    {"id": "buffer",       "use": "vector.buffer"},
    {"id": "save-result",  "use": "io.write_vector"}
  ]
}
```

**失败输出**（退出码 1）：

```json
{
  "status": "invalid",
  "error": "PipelineValidationError",
  "message": "Step 'buffer', param 'input': references step 'reprjct' which has not been defined before this step. Available: ['load-roads', 'reproject']"
}
```

---

## 16.4 `list-steps`：查看所有步骤

列出框架注册的所有步骤，支持按类别过滤和 JSON/表格两种输出格式。

### 命令格式

```bash
geopipe-agent list-steps [OPTIONS]
```

### 选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--category` | 全部 | 按类别过滤：`io`/`vector`/`raster`/`analysis`/`network`/`qc` |
| `--format` | `table` | 输出格式：`table`/`json` |

### 示例

```bash
# 查看所有步骤（表格）
geopipe-agent list-steps

# 仅查看 QC 步骤
geopipe-agent list-steps --category qc

# JSON 格式（含完整参数规范）
geopipe-agent list-steps --format json

# 组合使用
geopipe-agent list-steps --category vector --format json
```

**表格输出**：

```
ID                             Name                 Category     Backends
--------------------------------------------------------------------------------
io.read_vector                 读取矢量数据         io           -
io.write_vector                写入矢量数据         io           -
vector.buffer                  矢量缓冲区分析       vector       native_python, qgis_process
vector.clip                    矢量裁剪             vector       native_python, qgis_process
...

Total: 33 steps
```

---

## 16.5 `describe`：查看步骤详情

查看特定步骤的完整参数规范、输出定义、支持后端和示例。

### 命令格式

```bash
geopipe-agent describe STEP_ID
```

### 示例

```bash
geopipe-agent describe vector.buffer
geopipe-agent describe qc.geometry_validity
geopipe-agent describe analysis.cluster
```

**输出（JSON）**：

```json
{
  "id": "vector.buffer",
  "name": "矢量缓冲区分析",
  "description": "对输入的矢量数据生成指定距离的缓冲区",
  "category": "vector",
  "params": {
    "input":    {"type": "geodataframe", "required": true,  "description": "输入矢量数据"},
    "distance": {"type": "number",       "required": true,  "description": "缓冲区距离"},
    "cap_style":{"type": "string",       "required": false, "default": "round",
                 "enum": ["round", "flat", "square"], "description": "端点样式"}
  },
  "outputs": {
    "output": {"type": "geodataframe", "description": "缓冲区结果"},
    "stats":  {"type": "dict",         "description": "统计信息"}
  },
  "backends": ["native_python", "qgis_process"],
  "examples": [
    {"description": "500米道路缓冲区", "params": {"input": "$roads.output", "distance": 500}}
  ]
}
```

---

## 16.6 `info`：查看 GIS 文件信息

快速查看矢量或栅格文件的基本元信息，无需加载到流水线中。

### 命令格式

```bash
geopipe-agent info FILE
```

### 矢量文件输出

```bash
geopipe-agent info data/roads.shp
```

```json
{
  "path": "data/roads.shp",
  "format": "vector",
  "feature_count": 12500,
  "crs": "EPSG:4326",
  "geometry_types": ["LineString"],
  "columns": ["fid", "name", "road_class", "length", "geometry"],
  "bounds": [115.2, 38.8, 117.4, 41.1]
}
```

### 栅格文件输出

```bash
geopipe-agent info data/dem.tif
```

```json
{
  "path": "data/dem.tif",
  "format": "raster",
  "driver": "GTiff",
  "crs": "EPSG:4326",
  "width": 3600,
  "height": 2400,
  "bands": 1,
  "dtypes": ["float32"],
  "bounds": [116.0, 39.5, 117.0, 40.5],
  "transform": [116.0, 0.000278, 0.0, 40.5, 0.0, -0.000278]
}
```

**常用场景**：

- 确认数据的坐标系（确定 `buffer` 距离单位）
- 查看属性字段列表（确定 `query` 表达式中的字段名）
- 了解栅格波段数（确定 `raster.calc` 中的 B1/B2... 对应关系）

---

## 16.7 `backends`：查看后端状态

```bash
geopipe-agent backends
```

```json
[
  {"name": "native_python", "available": true},
  {"name": "gdal_cli",      "available": false},
  ...
]
```

---

## 16.8 `generate-skill-doc`：生成步骤参考文档

生成所有步骤的 Markdown 格式参考文档，主要供 AI 消费（直接粘贴到提示词或保存为文件）。

```bash
geopipe-agent generate-skill-doc

# 保存为文件
geopipe-agent generate-skill-doc > steps-reference.md
```

---

## 16.9 `generate-skill`：生成完整 Skill 文件集

生成 AI Skill 所需的全套文件，包含 SKILL.md（AI 入口文档）、参数参考文档和 Schema 文档。

### 命令格式

```bash
geopipe-agent generate-skill [OPTIONS]
```

### 选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--output-dir` | `skills/geopipe-agent` | 输出目录 |

### 示例

```bash
# 生成到默认目录
geopipe-agent generate-skill

# 生成到指定目录
geopipe-agent generate-skill --output-dir /path/to/skills
```

**生成的文件**：

```
skills/geopipe-agent/
├── SKILL.md                        # AI 入口文档（快速说明如何使用框架）
└── reference/
    ├── steps-reference.md          # 完整步骤参数参考
    └── pipeline-schema.md          # YAML Schema 文档
```

---

## 16.10 常用工作流示例

### 工作流一：开发新流水线

```bash
# 1. 了解数据
geopipe-agent info data/input.shp

# 2. 查看需要的步骤
geopipe-agent describe vector.buffer
geopipe-agent describe qc.geometry_validity

# 3. 编写 pipeline.yaml（手动或 AI 生成）

# 4. 校验流水线
geopipe-agent validate pipeline.yaml

# 5. 调试执行
geopipe-agent run pipeline.yaml --log-level DEBUG

# 6. 正式执行并保存报告
geopipe-agent run pipeline.yaml > output/report.json
```

### 工作流二：AI 辅助生成流水线

```bash
# 1. 生成 Skill 文件
geopipe-agent generate-skill --output-dir skills

# 2. 将 skills/geopipe-agent/SKILL.md 和 skills/geopipe-agent/reference/ 
#    上传给 AI（如 ChatGPT 或 Claude）

# 3. AI 生成 YAML 流水线

# 4. 校验和执行
geopipe-agent validate ai-generated-pipeline.yaml
geopipe-agent run ai-generated-pipeline.yaml
```

### 工作流三：批量处理多个文件

```bash
# 对目录下所有 Shapefile 执行相同处理
for file in data/*.shp; do
    filename=$(basename "$file" .shp)
    geopipe-agent run template.yaml \
        --var input_path="$file" \
        --var output_path="output/${filename}_processed.geojson"
done
```

---

## 16.11 本章小结

本章完整介绍了 `geopipe-agent` CLI 的 9 个命令：

1. **`run`**：执行流水线，`--var` 覆盖变量，`--log-level DEBUG` 调试
2. **`validate`**：校验语法和引用，不执行步骤
3. **`list-steps`**：查看所有步骤，支持类别过滤和 JSON 格式
4. **`describe`**：查看步骤的完整参数规范
5. **`info`**：快速了解 GIS 文件的元信息（CRS、字段、类型等）
6. **`backends`**：检查可用后端状态
7. **`generate-skill-doc`**：生成步骤参考 Markdown
8. **`generate-skill`**：生成完整 AI Skill 文件集

---

**导航**：[← 第十五章：数据模型与错误体系](https://znlgis.github.io/gis/tutorial/GeoPipeAgent/第15章-数据模型与错误体系/) ｜ [第十七章：Skill 文件与 AI 集成 →](https://znlgis.github.io/gis/tutorial/GeoPipeAgent/第17章-Skill文件与AI集成/)

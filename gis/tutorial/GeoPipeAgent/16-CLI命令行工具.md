---
layout: default
title: "第16章：CLI 命令行工具"
---

# 第16章：CLI 命令行工具

> 本章全面解析 GeoPipeAgent 的命令行界面（CLI），包括 8 个核心命令的详细用法、参数说明、输出格式以及 CLI 层的源码架构分析，帮助您在终端中高效操作 GIS 数据分析流水线。

---

## 16.1 CLI 概述

### 16.1.1 为什么需要 CLI

GeoPipeAgent 是一个以 YAML 流水线驱动的 GIS 分析框架，CLI 是用户与框架交互的主要入口。通过 CLI，用户可以：

- **执行流水线**：运行 YAML 定义的分析流程
- **校验流水线**：在不执行的情况下检查 YAML 的正确性
- **探索步骤**：查看所有可用步骤、查看步骤详情
- **查看数据**：快速了解 GIS 数据文件的基本信息
- **管理后端**：查看可用的计算后端及其状态
- **生成文档**：自动生成步骤参考文档和 AI Skill 文件

### 16.1.2 Click 框架基础

GeoPipeAgent 的 CLI 基于 [Click](https://click.palletsprojects.com/) 框架构建。Click 是 Python 中最流行的命令行工具库之一，具有以下优势：

- **装饰器风格**：使用 `@click.command()` 等装饰器定义命令，代码简洁直观
- **类型安全**：内置参数类型校验（如 `click.Path(exists=True)` 自动检查文件是否存在）
- **自动帮助**：自动生成 `--help` 输出，无需手动编写帮助文本
- **嵌套命令组**：支持 `@click.group()` 将多个命令组织在一起

### 16.1.3 命令总览

GeoPipeAgent CLI 共提供 **8 个命令**，涵盖流水线的完整生命周期：

| 命令 | 类别 | 功能描述 |
|------|------|----------|
| `run` | 执行 | 执行 YAML 流水线 |
| `validate` | 校验 | 校验流水线但不执行 |
| `list-steps` | 探索 | 列出所有可用步骤 |
| `describe` | 探索 | 查看步骤详细信息 |
| `info` | 数据 | 查看 GIS 数据文件摘要 |
| `backends` | 系统 | 列出可用后端及状态 |
| `generate-skill-doc` | 文档 | 生成步骤参考 Markdown |
| `generate-skill` | 文档 | 生成完整 AI Skill 文件集 |

### 16.1.4 安装与基本使用

安装 GeoPipeAgent 后，CLI 通过 `geopipe-agent` 命令访问：

```bash
# 查看版本
geopipe-agent --version

# 查看帮助
geopipe-agent --help

# 查看子命令帮助
geopipe-agent run --help
```

`--version` 选项自动从 Python 包元数据中读取版本号，对应源码中的：

```python
@click.version_option(package_name="geopipe-agent")
```

---

## 16.2 geopipe-agent run —— 执行流水线

### 16.2.1 命令概述

`run` 是最核心的命令，用于执行 YAML 定义的 GIS 分析流水线。它完成从解析、校验到执行的完整流程。

```bash
geopipe-agent run <file> [选项]
```

### 16.2.2 参数详解

#### 必需参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | `click.Path(exists=True)` | YAML 流水线文件路径，Click 自动检查文件是否存在 |

#### 可选参数

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--log-level` | `str` | `"INFO"` | 日志级别：DEBUG, INFO, WARNING, ERROR |
| `--json-log` | `flag` | `False` | 启用 JSON 格式日志输出 |
| `--var` | `multiple` | — | 覆盖流水线变量，可多次使用 |

### 16.2.3 --var 变量覆盖机制

`--var` 选项允许在命令行中覆盖 YAML 文件中定义的变量，格式为 `key=value`：

```bash
# 覆盖单个变量
geopipe-agent run pipeline.yaml --var buffer_distance=1000

# 覆盖多个变量
geopipe-agent run pipeline.yaml \
  --var input_file=roads.shp \
  --var buffer_distance=500 \
  --var output_format=GeoJSON

# 覆盖嵌套变量
geopipe-agent run pipeline.yaml --var crs=EPSG:4326
```

源码中，`--var` 被定义为 `multiple=True`，这意味着 Click 会将所有 `--var` 参数收集为一个元组：

```python
@click.option("--var", multiple=True, help="Override: --var key=value")
def run(file, log_level, json_log, var):
    # var 是一个元组，例如 ("buffer_distance=1000", "crs=EPSG:4326")
    overrides = {}
    for v in var:
        key, _, value = v.partition("=")
        overrides[key.strip()] = value.strip()
    # 传递给引擎...
```

### 16.2.4 --log-level 日志级别控制

`--log-level` 控制日志的详细程度，适用于不同场景：

```bash
# 开发调试：显示所有详细信息
geopipe-agent run pipeline.yaml --log-level DEBUG

# 正常运行：显示关键信息（默认）
geopipe-agent run pipeline.yaml --log-level INFO

# 生产环境：仅显示警告和错误
geopipe-agent run pipeline.yaml --log-level WARNING

# 静默模式：仅显示错误
geopipe-agent run pipeline.yaml --log-level ERROR
```

不同日志级别的输出示例：

```
# DEBUG 级别
[DEBUG] 解析变量: buffer_distance = 500
[DEBUG] 解析步骤引用: $load_data -> GeoDataFrame(1024 rows)
[DEBUG] 选择后端: native_python (优先级: 1)
[INFO]  执行步骤: load_data (io.read_vector)
[INFO]  执行步骤: buffer (vector.buffer)
[INFO]  流水线完成: 2/2 步骤成功

# INFO 级别
[INFO]  执行步骤: load_data (io.read_vector)
[INFO]  执行步骤: buffer (vector.buffer)
[INFO]  流水线完成: 2/2 步骤成功
```

### 16.2.5 --json-log JSON 日志格式

启用 `--json-log` 后，所有日志输出将使用结构化 JSON 格式，便于程序解析：

```bash
geopipe-agent run pipeline.yaml --json-log
```

输出示例：

```json
{"timestamp": "2024-01-15T10:30:00.123", "level": "INFO", "logger": "geopipe_agent", "message": "执行步骤: load_data (io.read_vector)"}
{"timestamp": "2024-01-15T10:30:01.456", "level": "INFO", "logger": "geopipe_agent", "message": "执行步骤: buffer (vector.buffer)"}
{"timestamp": "2024-01-15T10:30:02.789", "level": "INFO", "logger": "geopipe_agent", "message": "流水线完成: 2/2 步骤成功"}
```

JSON 日志格式特别适合以下场景：

- **CI/CD 集成**：方便自动化工具解析执行结果
- **日志聚合**：导入 ELK Stack、Splunk 等日志分析平台
- **AI 分析**：让 AI 解析执行日志并提供优化建议

### 16.2.6 执行输出格式

成功执行时，`run` 命令输出结构化的 JSON 结果：

```json
{
  "status": "success",
  "pipeline": "城市绿地缓冲区分析",
  "steps_total": 4,
  "steps_completed": 4,
  "steps_failed": 0,
  "steps_skipped": 0,
  "duration": "3.45s",
  "outputs": {
    "load_data": {"type": "GeoDataFrame", "rows": 1024, "crs": "EPSG:4326"},
    "reproject": {"type": "GeoDataFrame", "rows": 1024, "crs": "EPSG:3857"},
    "buffer": {"type": "GeoDataFrame", "rows": 1024, "crs": "EPSG:3857"},
    "save": {"file": "output/buffer_result.gpkg", "format": "GPKG"}
  }
}
```

### 16.2.7 错误处理输出

当流水线执行失败时，CLI 输出包含详细的错误信息和修复建议：

```json
{
  "status": "failed",
  "error": "StepExecutionError",
  "step_id": "overlay",
  "message": "CRS mismatch between layers",
  "suggestion": "在 overlay 之前添加 vector.reproject 步骤统一坐标系",
  "cause": "Layer A: EPSG:4326, Layer B: EPSG:3857"
}
```

CLI 的退出码约定：

| 退出码 | 含义 |
|--------|------|
| `0` | 执行成功 |
| `1` | 执行失败（流水线错误） |
| `2` | 参数错误（Click 自动处理） |

### 16.2.8 完整使用示例

```bash
# 基础执行
geopipe-agent run analysis.yaml

# 完整参数组合
geopipe-agent run analysis.yaml \
  --log-level DEBUG \
  --json-log \
  --var input_file=data/roads.shp \
  --var buffer_distance=500 \
  --var output_dir=results/

# 在 CI/CD 中使用
geopipe-agent run pipeline.yaml --json-log --log-level WARNING
echo "Exit code: $?"
```

---

## 16.3 geopipe-agent validate —— 校验流水线

### 16.3.1 命令概述

`validate` 命令对 YAML 流水线进行完整校验，但 **不执行** 任何步骤。这在以下场景中非常有用：

- **开发阶段**：快速检查 YAML 语法和语义是否正确
- **CI/CD 流程**：在部署前验证流水线配置
- **AI 生成校验**：检查 AI 生成的流水线是否有效

```bash
geopipe-agent validate <file> [选项]
```

### 16.3.2 参数说明

| 参数/选项 | 类型 | 说明 |
|-----------|------|------|
| `file` | `click.Path(exists=True)` | YAML 流水线文件路径 |
| `--log-level` | `str` | 日志级别，默认 `INFO` |

### 16.3.3 校验内容

`validate` 命令执行以下校验：

1. **YAML 语法校验**：确保文件是合法的 YAML
2. **Schema 校验**：检查必需字段（`name`、`steps`）是否存在
3. **步骤存在性**：验证每个步骤的 `use` 字段引用的步骤是否已注册
4. **参数完整性**：检查必需参数是否提供
5. **引用合法性**：验证 `$step_id` 引用的步骤是否存在且在当前步骤之前定义
6. **变量定义**：检查 `${var.xxx}` 引用的变量是否在 `vars` 中定义

### 16.3.4 校验通过的输出

```bash
$ geopipe-agent validate analysis.yaml
✓ YAML 语法正确
✓ 流水线结构有效
✓ 所有步骤已注册 (4/4)
✓ 参数完整
✓ 引用合法
✓ 校验通过
```

### 16.3.5 校验失败的输出

```bash
$ geopipe-agent validate bad_pipeline.yaml
✓ YAML 语法正确
✓ 流水线结构有效
✗ 步骤 'vector.invalid_step' 未注册
  位置: steps[2] (id: "process_data")
  建议: 使用 'geopipe-agent list-steps' 查看所有可用步骤

校验失败: 1 个错误
```

### 16.3.6 在开发工作流中的应用

```bash
# 编辑后快速校验
vim analysis.yaml && geopipe-agent validate analysis.yaml

# 批量校验目录中的所有流水线
for f in pipelines/*.yaml; do
  echo "校验: $f"
  geopipe-agent validate "$f" || echo "  ✗ 失败"
done
```

---

## 16.4 geopipe-agent list-steps —— 列出步骤

### 16.4.1 命令概述

`list-steps` 命令显示所有已注册的步骤，支持按类别过滤和多种输出格式：

```bash
geopipe-agent list-steps [选项]
```

### 16.4.2 参数说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--category` | `str` | `None` | 按类别过滤步骤 |
| `--format` | `Choice` | `"table"` | 输出格式：`table` 或 `json` |

源码中，`--format` 参数使用了 Click 的 `Choice` 类型确保只接受合法值：

```python
@click.option("--format", "fmt", type=click.Choice(["table", "json"]), default="table")
```

注意参数名使用 `"fmt"` 避免与 Python 内置函数 `format` 冲突。

### 16.4.3 表格格式输出

```bash
$ geopipe-agent list-steps
┌────────────┬─────────────────────────────┬──────────────────────────┐
│ Category   │ Step ID                     │ Name                     │
├────────────┼─────────────────────────────┼──────────────────────────┤
│ io         │ io.read_vector              │ Read Vector Data         │
│ io         │ io.write_vector             │ Write Vector Data        │
│ io         │ io.read_raster              │ Read Raster Data         │
│ io         │ io.write_raster             │ Write Raster Data        │
│ vector     │ vector.buffer               │ Buffer Analysis          │
│ vector     │ vector.reproject            │ Reproject CRS            │
│ vector     │ vector.clip                 │ Clip Features            │
│ vector     │ vector.overlay              │ Overlay Analysis         │
│ vector     │ vector.dissolve             │ Dissolve Features        │
│ vector     │ vector.query                │ Query Features           │
│ vector     │ vector.simplify             │ Simplify Geometries      │
│ ...        │ ...                         │ ...                      │
│ qc         │ qc.geometry_validity        │ Geometry Validity Check  │
│ qc         │ qc.topology                 │ Topology Check           │
│ qc         │ qc.crs_check               │ CRS Check                │
│ ...        │ ...                         │ ...                      │
└────────────┴─────────────────────────────┴──────────────────────────┘
Total: 33 steps in 6 categories
```

### 16.4.4 按类别过滤

```bash
$ geopipe-agent list-steps --category vector
┌────────────┬─────────────────────────────┬──────────────────────────┐
│ Category   │ Step ID                     │ Name                     │
├────────────┼─────────────────────────────┼──────────────────────────┤
│ vector     │ vector.buffer               │ Buffer Analysis          │
│ vector     │ vector.reproject            │ Reproject CRS            │
│ vector     │ vector.clip                 │ Clip Features            │
│ vector     │ vector.overlay              │ Overlay Analysis         │
│ vector     │ vector.dissolve             │ Dissolve Features        │
│ vector     │ vector.query                │ Query Features           │
│ vector     │ vector.simplify             │ Simplify Geometries      │
└────────────┴─────────────────────────────┴──────────────────────────┘
Total: 7 steps
```

可用的类别包括：`io`、`vector`、`raster`、`spatial`、`network`、`qc`。

### 16.4.5 JSON 格式输出

```bash
$ geopipe-agent list-steps --category qc --format json
```

```json
[
  {
    "id": "qc.geometry_validity",
    "name": "Geometry Validity Check",
    "category": "qc",
    "description": "检查几何对象的有效性..."
  },
  {
    "id": "qc.topology",
    "name": "Topology Check",
    "category": "qc",
    "description": "检查拓扑关系..."
  }
]
```

JSON 格式适合程序化处理和 AI 集成。

---

## 16.5 geopipe-agent describe —— 步骤详情

### 16.5.1 命令概述

`describe` 命令显示某个步骤的完整详细信息，包括参数定义、输出说明和使用示例：

```bash
geopipe-agent describe <step_id>
```

### 16.5.2 输出内容

```bash
$ geopipe-agent describe vector.buffer
```

```
Step: vector.buffer
Name: Buffer Analysis
Category: vector
Description: 对输入的矢量数据进行缓冲区分析

Parameters:
  ┌─────────────┬────────┬──────────┬─────────┬──────────────────────────┐
  │ Name        │ Type   │ Required │ Default │ Description              │
  ├─────────────┼────────┼──────────┼─────────┼──────────────────────────┤
  │ input       │ layer  │ ✓        │ -       │ 输入矢量图层             │
  │ distance    │ number │ ✓        │ -       │ 缓冲距离（地图单位）     │
  │ resolution  │ int    │          │ 16      │ 缓冲区圆弧分辨率         │
  │ cap_style   │ string │          │ round   │ 端点样式: round/flat/square│
  │ join_style  │ string │          │ round   │ 连接样式: round/mitre/bevel│
  └─────────────┴────────┴──────────┴─────────┴──────────────────────────┘

Outputs:
  ┌─────────────┬────────┬──────────────────────────┐
  │ Name        │ Type   │ Description              │
  ├─────────────┼────────┼──────────────────────────┤
  │ output      │ layer  │ 缓冲区结果图层           │
  └─────────────┴────────┴──────────────────────────┘

Backends: native_python, geopandas, qgis

Example:
  - id: buffer_roads
    use: vector.buffer
    params:
      input: $load_roads
      distance: 500
```

### 16.5.3 使用场景

`describe` 命令在以下场景中非常有用：

```bash
# 查看步骤需要哪些参数
geopipe-agent describe io.read_vector

# 编写流水线前了解步骤输出格式
geopipe-agent describe qc.geometry_validity

# 为 AI 提供步骤说明
geopipe-agent describe vector.overlay
```

---

## 16.6 geopipe-agent info —— GIS 数据文件摘要

### 16.6.1 命令概述

`info` 命令读取 GIS 数据文件并显示其基本信息摘要，**自动识别矢量和栅格数据**：

```bash
geopipe-agent info <file>
```

### 16.6.2 矢量数据信息

对于矢量数据文件（如 `.shp`、`.gpkg`、`.geojson`），使用 **geopandas** 读取并显示：

```bash
$ geopipe-agent info data/roads.shp
```

```
File: data/roads.shp
Type: Vector
Format: ESRI Shapefile
CRS: EPSG:4326 (WGS 84)
Bounds: (116.2, 39.4, 116.8, 40.1)
Features: 12,345
Geometry Type: LineString

Attributes:
  ┌─────────────┬──────────┬────────────────┐
  │ Column      │ Type     │ Sample         │
  ├─────────────┼──────────┼────────────────┤
  │ road_name   │ object   │ 长安街         │
  │ road_type   │ object   │ primary        │
  │ width       │ float64  │ 12.5           │
  │ lanes       │ int64    │ 4              │
  │ geometry    │ geometry │ LINESTRING(...)│
  └─────────────┴──────────┴────────────────┘
```

### 16.6.3 栅格数据信息

对于栅格数据文件（如 `.tif`、`.img`），使用 **rasterio** 读取并显示：

```bash
$ geopipe-agent info data/dem.tif
```

```
File: data/dem.tif
Type: Raster
Format: GeoTIFF
CRS: EPSG:4326 (WGS 84)
Bounds: (116.0, 39.0, 117.0, 40.0)
Size: 3600 x 3600
Bands: 1
Data Type: float32
NoData: -9999.0
Resolution: (0.000278, 0.000278)
Statistics:
  Band 1: min=0.0, max=2148.5, mean=456.3, std=312.8
```

### 16.6.4 自动识别逻辑

`info` 命令根据文件扩展名和内容自动选择读取方式：

```python
# 矢量格式：使用 geopandas
VECTOR_EXTENSIONS = {".shp", ".gpkg", ".geojson", ".json", ".kml", ".gml", ".fgb"}

# 栅格格式：使用 rasterio
RASTER_EXTENSIONS = {".tif", ".tiff", ".img", ".nc", ".hdf", ".jp2", ".png"}
```

如果扩展名不明确，框架会尝试先用矢量方式读取，失败后再尝试栅格方式。

---

## 16.7 geopipe-agent backends —— 列出可用后端

### 16.7.1 命令概述

`backends` 命令列出所有可用的计算后端及其状态，帮助用户了解当前环境支持哪些后端：

```bash
geopipe-agent backends
```

### 16.7.2 输出示例

```bash
$ geopipe-agent backends
┌─────────────────┬──────────┬──────────────────────────────┐
│ Backend         │ Status   │ Notes                        │
├─────────────────┼──────────┼──────────────────────────────┤
│ native_python   │ ✓ 可用   │ 基于 geopandas/shapely      │
│ geopandas       │ ✓ 可用   │ v0.14.1                      │
│ qgis            │ ✗ 不可用 │ 未安装 QGIS Python 绑定      │
│ pyproj          │ ✓ 可用   │ v3.6.1                       │
│ rasterio        │ ✓ 可用   │ v1.3.9 (GDAL 3.7.3)         │
└─────────────────┴──────────┴──────────────────────────────┘
Available: 4/5
```

### 16.7.3 后端状态说明

- **✓ 可用**：后端的依赖库已安装且可正常导入
- **✗ 不可用**：后端的依赖库未安装或版本不兼容

`backends` 命令在排查流水线执行问题时特别有用。当某个步骤报 `BackendNotAvailableError` 时，可以先检查后端状态。

---

## 16.8 geopipe-agent generate-skill-doc —— 生成步骤参考文档

### 16.8.1 命令概述

`generate-skill-doc` 命令从步骤注册表自动生成步骤参考 Markdown 文档：

```bash
geopipe-agent generate-skill-doc
```

### 16.8.2 输出内容

该命令调用 `generate_steps_reference()` 函数，遍历所有已注册步骤，生成包含以下内容的 Markdown：

- 步骤分类目录
- 每个步骤的完整参数表
- 输出说明
- 支持的后端列表

输出示例（部分）：

```markdown
# GeoPipeAgent Steps Reference

## io 类别

### io.read_vector — 读取矢量数据

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| file | string | ✓ | - | 输入文件路径 |
| layer | string | | None | 图层名（GPKG 等多图层格式） |
| encoding | string | | utf-8 | 文件编码 |

**输出**: GeoDataFrame

**后端**: native_python, geopandas

---

### io.write_vector — 写入矢量数据
...
```

### 16.8.3 使用场景

```bash
# 生成文档并保存
geopipe-agent generate-skill-doc > docs/steps-reference.md

# 配合其他工具使用
geopipe-agent generate-skill-doc | less
```

---

## 16.9 geopipe-agent generate-skill —— 生成 AI Skill 文件集

### 16.9.1 命令概述

`generate-skill` 命令生成完整的 AI Skill 文件集合，供大语言模型（LLM）使用：

```bash
geopipe-agent generate-skill [选项]
```

### 16.9.2 参数说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--output-dir` | `str` | `"skills/geopipe-agent"` | Skill 文件的输出目录 |

### 16.9.3 生成的文件结构

```bash
$ geopipe-agent generate-skill --output-dir skills/geopipe-agent

生成文件:
  skills/geopipe-agent/
  ├── SKILL.md                          # 主 Skill 描述文件
  └── reference/
      ├── steps-reference.md            # 步骤参考文档
      └── pipeline-schema.md            # YAML Schema 文档
```

### 16.9.4 使用方法

```bash
# 使用默认输出目录
geopipe-agent generate-skill

# 自定义输出目录
geopipe-agent generate-skill --output-dir my-skills/geopipe

# 生成后查看
tree skills/geopipe-agent/
cat skills/geopipe-agent/SKILL.md
```

生成的 Skill 文件可以直接提供给 ChatGPT、Claude、Copilot 等 AI 工具，使其能够理解 GeoPipeAgent 的能力并生成正确的 YAML 流水线。详细内容请参见下一章。

---

## 16.10 CLI 源码架构分析

### 16.10.1 Click Group/Command 模式

GeoPipeAgent CLI 使用 Click 的 **命令组（Group）** 模式组织代码。核心入口定义在 `cli.py` 中：

```python
import click

@click.group()
@click.version_option(package_name="geopipe-agent")
def main():
    """GeoPipeAgent - AI-Native GIS Pipeline Framework"""
    pass
```

`@click.group()` 将 `main` 函数定义为一个命令组，所有子命令通过 `@main.command()` 注册到该组：

```python
@main.command()
@click.argument("file", type=click.Path(exists=True))
@click.option("--log-level", default="INFO")
@click.option("--json-log", is_flag=True)
@click.option("--var", multiple=True, help="Override: --var key=value")
def run(file, log_level, json_log, var):
    """执行 GIS 分析流水线"""
    ...

@main.command()
@click.argument("file", type=click.Path(exists=True))
@click.option("--log-level", default="INFO")
def validate(file, log_level):
    """校验流水线（不执行）"""
    ...

@main.command("list-steps")
@click.option("--category", default=None)
@click.option("--format", "fmt", type=click.Choice(["table", "json"]), default="table")
def list_steps(category, fmt):
    """列出所有可用步骤"""
    ...
```

### 16.10.2 命令名称映射

注意 `@main.command("list-steps")` 中的字符串参数——这定义了命令行中使用的命令名（带连字符），而 Python 函数名 `list_steps` 使用下划线。这是 Click 的标准做法：

| Python 函数名 | CLI 命令名 | 说明 |
|---------------|-----------|------|
| `run` | `run` | 名称一致 |
| `validate` | `validate` | 名称一致 |
| `list_steps` | `list-steps` | 连字符形式 |
| `describe` | `describe` | 名称一致 |
| `info` | `info` | 名称一致 |
| `backends` | `backends` | 名称一致 |
| `generate_skill_doc` | `generate-skill-doc` | 连字符形式 |
| `generate_skill` | `generate-skill` | 连字符形式 |

### 16.10.3 入口点配置

CLI 命令通过 Python 包的入口点（entry point）注册，在 `pyproject.toml` 中配置：

```toml
[project.scripts]
geopipe-agent = "geopipe_agent.cli:main"
```

安装包后，`geopipe-agent` 命令会自动调用 `cli.py` 中的 `main` 函数。

### 16.10.4 参数类型系统

Click 提供了丰富的参数类型，GeoPipeAgent 中使用了以下类型：

```python
# 文件路径（自动检查存在性）
click.Path(exists=True)

# 选择类型（限制可选值）
click.Choice(["table", "json"])

# 布尔标志
is_flag=True

# 多值参数（可重复使用）
multiple=True
```

### 16.10.5 整体调用流程

```
用户输入: geopipe-agent run analysis.yaml --var crs=EPSG:4326
    │
    ▼
Click 解析参数
    │
    ├── file = "analysis.yaml" (自动校验存在性)
    ├── log_level = "INFO"
    ├── json_log = False
    └── var = ("crs=EPSG:4326",)
    │
    ▼
run() 函数执行
    │
    ├── setup_logging(log_level, json_log)
    ├── 解析 --var 覆盖
    ├── Parser: 解析 YAML
    ├── Validator: 校验流水线
    ├── Executor: 逐步执行
    └── Reporter: 输出结果
```

---

## 16.11 本章小结

本章全面介绍了 GeoPipeAgent 的 CLI 命令行工具，主要内容包括：

1. **CLI 基础**：基于 Click 框架构建，提供 8 个核心命令
2. **run 命令**：执行流水线的主要入口，支持变量覆盖、日志级别控制和 JSON 日志格式
3. **validate 命令**：校验流水线但不执行，适合开发和 CI/CD 场景
4. **list-steps 命令**：列出所有可用步骤，支持按类别过滤和 JSON 输出
5. **describe 命令**：查看步骤的完整参数和输出说明
6. **info 命令**：自动识别并显示 GIS 数据文件的摘要信息
7. **backends 命令**：查看计算后端的可用状态
8. **generate-skill-doc / generate-skill 命令**：生成 AI Skill 文件和步骤参考文档
9. **源码架构**：Click 的 Group/Command 模式、命令名称映射、入口点配置

下一章我们将深入探讨 AI Skill 生成系统，了解如何将 GeoPipeAgent 的能力封装为 AI 可理解的技能描述。

---

[下一章：AI Skill 生成与集成 →](17-AI-Skill生成与集成.md)

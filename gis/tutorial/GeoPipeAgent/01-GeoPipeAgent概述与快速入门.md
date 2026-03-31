---
layout: default
title: "第一章：GeoPipeAgent 概述与快速入门"
---

# 第一章：GeoPipeAgent 概述与快速入门

> 本章将全面介绍 GeoPipeAgent 的设计理念、核心特性、典型应用场景，并通过一个完整的快速上手示例带你从零开始运行第一个 GIS 分析流水线。

---

## 1.1 GeoPipeAgent 是什么

GeoPipeAgent 是一个 **AI 原生的 GIS 分析流水线框架**（AI-Native GIS Analysis Pipeline Framework），使用 **Python 3.10+** 编写，采用 **MIT 开源许可证** 发布。

它的核心目标是：**让 AI 能够自动生成、编排和执行 GIS 空间分析任务**。

### 1.1.1 一句话定义

> GeoPipeAgent = **YAML 声明式流水线** + **可扩展步骤系统** + **多后端执行引擎** + **AI 技能生成**

传统的 GIS 分析通常需要人工在桌面软件（如 ArcGIS、QGIS）中点击操作，或编写大量 Python 脚本。GeoPipeAgent 改变了这一范式——它允许用户（或 AI）通过一段简单的 YAML 文件来描述整个分析流程，然后由框架自动解析、校验、执行，并生成结构化的 JSON 报告。

### 1.1.2 核心定位

| 维度 | 说明 |
|------|------|
| **语言** | Python 3.10+，充分利用类型注解和 dataclass |
| **许可证** | MIT License，可自由使用、修改、商业化 |
| **目标用户** | AI Agent、GIS 开发者、数据工程师、空间分析师 |
| **设计哲学** | AI-First，声明式优先，约定优于配置 |
| **核心能力** | 流水线编排、空间分析、数据质检、报告生成 |

### 1.1.3 项目起源

GeoPipeAgent 诞生于实际的 AI+GIS 项目需求。在许多场景下，我们需要让大语言模型（LLM）根据用户的自然语言描述，自动生成并执行空间分析任务。然而，直接让 AI 编写 Python 代码存在以下问题：

1. **安全风险**：AI 生成的代码可能包含危险操作
2. **不可预测**：每次生成的代码结构不同，难以标准化处理
3. **难以校验**：无法在执行前验证分析逻辑是否合理
4. **缺乏追踪**：执行过程和结果缺乏统一的记录格式

GeoPipeAgent 通过引入 **YAML 流水线** 这一中间层，优雅地解决了这些问题。AI 只需要生成结构化的 YAML，框架负责安全地执行。

---

## 1.2 AI 优先设计理念

GeoPipeAgent 的设计始终围绕着一个核心理念：**AI First**（AI 优先）。这意味着框架的每一个设计决策都优先考虑 AI 的使用场景。

### 1.2.1 三步流转模型

GeoPipeAgent 的典型工作流程遵循一个清晰的 **三步流转模型**：

```
┌─────────────────────────────────────────────────────────────┐
│                    三步流转模型                               │
│                                                             │
│  ┌──────────┐     ┌──────────────────┐     ┌────────────┐  │
│  │          │     │                  │     │            │  │
│  │  AI/用户  │────▶│  GeoPipeAgent    │────▶│  JSON 报告  │  │
│  │  生成     │     │  解析 & 执行      │     │  结构化输出  │  │
│  │  YAML    │     │                  │     │            │  │
│  └──────────┘     └──────────────────┘     └────────────┘  │
│                                                             │
│  第一步：生成        第二步：执行            第三步：报告      │
└─────────────────────────────────────────────────────────────┘
```

**第一步：AI 生成 YAML**

大语言模型（如 GPT-4、Claude 等）根据用户的自然语言描述，生成一段符合 GeoPipeAgent 规范的 YAML 流水线定义。AI 不需要编写任何 Python 代码，只需要了解 GeoPipeAgent 支持的步骤（Step）和参数格式。

```yaml
# 用户说："帮我对 buildings.shp 做 500 米缓冲区分析"
# AI 生成如下 YAML：
pipeline:
  name: buffer_analysis
  description: 对建筑物图层进行 500 米缓冲区分析
  steps:
    - id: load_data
      use: io.read_vector
      params:
        path: "buildings.shp"
    - id: buffer
      use: vector.buffer
      params:
        input: $load_data
        distance: 500
    - id: save_result
      use: io.write_vector
      params:
        input: $buffer
        path: "buildings_buffer_500m.shp"
```

**第二步：GeoPipeAgent 解析与执行**

GeoPipeAgent 接收 YAML 文件后，执行以下流程：

1. **解析**（Parse）：将 YAML 转换为 `PipelineDefinition` 数据模型
2. **校验**（Validate）：检查步骤 ID 是否合法、引用是否存在、参数类型是否正确
3. **执行**（Execute）：按步骤顺序依次执行，处理步骤间的数据传递
4. **报告**（Report）：生成包含每步结果、统计信息和 QC 问题的 JSON 报告

**第三步：JSON 结构化报告**

执行完成后，GeoPipeAgent 输出一份标准化的 JSON 报告：

```json
{
  "pipeline": "buffer_analysis",
  "status": "success",
  "total_steps": 3,
  "passed_steps": 3,
  "failed_steps": 0,
  "steps": [
    {
      "id": "load_data",
      "use": "io.read_vector",
      "status": "success",
      "output_type": "GeoDataFrame",
      "stats": {
        "feature_count": 1245,
        "crs": "EPSG:4326",
        "bounds": [116.2, 39.8, 116.6, 40.1]
      }
    },
    {
      "id": "buffer",
      "use": "vector.buffer",
      "status": "success",
      "output_type": "GeoDataFrame",
      "stats": {
        "feature_count": 1245,
        "crs": "EPSG:4326"
      }
    },
    {
      "id": "save_result",
      "use": "io.write_vector",
      "status": "success",
      "output": "buildings_buffer_500m.shp"
    }
  ],
  "qc_issues": []
}
```

### 1.2.2 为什么选择 YAML 而非代码

| 考量因素 | YAML 流水线 | Python 代码 |
|----------|-------------|-------------|
| **AI 生成难度** | 低——结构化、模式固定 | 高——语法复杂、变化多 |
| **安全性** | 高——只能调用注册步骤 | 低——可执行任意代码 |
| **校验能力** | 强——执行前可完全校验 | 弱——需要静态分析工具 |
| **可读性** | 非技术人员也可理解 | 需要编程知识 |
| **可重复性** | 完全确定性 | 依赖运行时环境 |
| **版本控制** | 差异清晰、易于审查 | 代码差异可能复杂 |
| **标准化** | 统一的执行和报告格式 | 每个脚本输出不同 |

### 1.2.3 AI Skill 文件系统

GeoPipeAgent 提供了一个创新的 **Skill 文件系统**，它可以自动生成描述每个步骤能力的文档，供 AI 参考：

```bash
# 生成 AI 可读的技能文档
geopipe-agent generate-skill-doc --output skills.md

# 生成单个步骤的技能卡片
geopipe-agent generate-skill --step vector.buffer --output buffer_skill.json
```

生成的 Skill 文档包含每个步骤的：
- 功能描述
- 输入/输出参数定义
- 参数类型和约束
- 使用示例
- 所需后端

AI 可以在生成 YAML 之前先读取这份 Skill 文档，从而准确了解 GeoPipeAgent 的全部能力。

---

## 1.3 核心特性

GeoPipeAgent 提供了以下核心特性，每一个都经过精心设计以支持 AI 驱动的 GIS 分析工作流。

### 1.3.1 YAML 驱动的声明式流水线

所有分析逻辑都通过 YAML 文件声明，而非命令式代码。流水线定义清晰描述了：

- **做什么**（what）：每个步骤要执行的操作
- **用什么数据**（with what data）：输入参数和数据源
- **按什么顺序**（in what order）：步骤的执行顺序
- **在什么条件下**（under what conditions）：条件执行逻辑

```yaml
pipeline:
  name: comprehensive_analysis
  description: 综合空间分析流水线
  crs: "EPSG:4326"
  variables:
    buffer_distance: 1000
    min_area: 500
  steps:
    - id: read_parcels
      use: io.read_vector
      params:
        path: "parcels.gpkg"
    - id: filter_large
      use: vector.filter
      params:
        input: $read_parcels
        expression: "area > ${min_area}"
    - id: create_buffer
      use: vector.buffer
      params:
        input: $filter_large
        distance: ${buffer_distance}
    - id: check_quality
      use: qc.geometry_validity
      params:
        input: $create_buffer
  outputs:
    result: $create_buffer
    qc_report: $check_quality
```

### 1.3.2 可扩展步骤系统

GeoPipeAgent 使用 **`@step` 装饰器** 机制来注册分析步骤，开发者可以轻松地添加新步骤：

```python
from geopipe_agent.steps.registry import step

@step(
    name="vector.buffer",
    description="为矢量要素创建缓冲区",
    params={
        "input": {"type": "geodataframe", "required": True, "description": "输入矢量数据"},
        "distance": {"type": "number", "required": True, "description": "缓冲距离（米）"},
        "resolution": {"type": "number", "required": False, "default": 16, "description": "缓冲区边缘分辨率"}
    },
    output_type="geodataframe",
    tags=["vector", "geometry", "buffer"]
)
def buffer(input, distance, resolution=16, **kwargs):
    """为每个要素创建指定距离的缓冲区。"""
    return input.buffer(distance, resolution=resolution)
```

步骤按功能分类组织：

| 类别 | 前缀 | 典型步骤 |
|------|------|----------|
| **IO** | `io.*` | `io.read_vector`, `io.write_vector`, `io.read_raster`, `io.write_raster` |
| **矢量** | `vector.*` | `vector.buffer`, `vector.clip`, `vector.union`, `vector.intersection`, `vector.dissolve`, `vector.filter` |
| **栅格** | `raster.*` | `raster.clip`, `raster.reproject`, `raster.zonal_stats`, `raster.reclassify`, `raster.hillshade` |
| **分析** | `analysis.*` | `analysis.spatial_join`, `analysis.hotspot`, `analysis.interpolation`, `analysis.density` |
| **网络** | `network.*` | `network.shortest_path`, `network.service_area`, `network.isochrone`, `network.geocode` |
| **质检** | `qc.*` | `qc.geometry_validity`, `qc.attribute_check`, `qc.topology_check`, `qc.crs_consistency` |

### 1.3.3 多后端支持

GeoPipeAgent 通过 **Backend 抽象层** 支持多种 GIS 执行后端：

```
┌─────────────────────────────────────────────────────┐
│                Backend 抽象层                        │
├─────────────┬──────────────┬───────────┬────────────┤
│ native_python│ gdal_cli     │ gdal_python│ qgis_process│
│ (GeoPandas)  │ (ogr2ogr CLI)│ (GDAL API) │ (qgis CLI) │
├─────────────┼──────────────┼───────────┼────────────┤
│ pyqgis      │ generic_cli  │ curl_api  │ 自定义...   │
│ (PyQGIS API)│ (任意 CLI)    │ (REST API)│            │
└─────────────┴──────────────┴───────────┴────────────┘
```

每个后端实现了统一的接口：

```python
class Backend:
    """后端基类"""
    name: str
    
    def is_available(self) -> bool:
        """检查后端是否可用"""
        ...
    
    def execute(self, operation: str, params: dict) -> Any:
        """执行操作"""
        ...
```

用户可以在 YAML 中为每个步骤指定后端：

```yaml
- id: reproject
  use: vector.reproject
  params:
    input: $source
    target_crs: "EPSG:3857"
  backend: gdal_cli  # 使用 ogr2ogr 命令行
```

### 1.3.4 数据质检（QC）集成

GeoPipeAgent 将数据质量检查作为一等公民集成到流水线中：

```yaml
- id: check_geometry
  use: qc.geometry_validity
  params:
    input: $processed_data
    rules:
      - type: no_self_intersection
        severity: error
      - type: no_duplicate_points
        severity: warning
      - type: minimum_area
        value: 10
        severity: error
```

QC 结果被统一收集并汇入最终报告：

```json
{
  "qc_issues": [
    {
      "step_id": "check_geometry",
      "rule": "no_self_intersection",
      "severity": "error",
      "feature_id": 42,
      "message": "要素 42 存在自相交",
      "geometry_wkt": "POLYGON((...))..."
    }
  ],
  "qc_summary": {
    "total_issues": 3,
    "errors": 1,
    "warnings": 2
  }
}
```

### 1.3.5 结构化 JSON 输出

GeoPipeAgent 的所有输出都遵循统一的 JSON 格式，便于程序化处理：

```json
{
  "pipeline": "analysis_pipeline",
  "status": "success",
  "started_at": "2024-01-15T10:30:00Z",
  "finished_at": "2024-01-15T10:30:45Z",
  "duration_seconds": 45.2,
  "total_steps": 5,
  "passed_steps": 5,
  "failed_steps": 0,
  "skipped_steps": 0,
  "steps": [...],
  "qc_issues": [...],
  "qc_summary": {...},
  "outputs": {...}
}
```

### 1.3.6 AI Skill 文件生成

GeoPipeAgent 可以自动生成描述自身能力的 Skill 文件，供大语言模型参考：

```bash
geopipe-agent generate-skill-doc --format markdown --output geopipe_skills.md
```

生成的内容结构如下：

```markdown
# GeoPipeAgent Skills

## io.read_vector
- Description: 读取矢量数据文件
- Params:
  - path (string, required): 文件路径
  - layer (string, optional): 图层名称
- Output: geodataframe
- Example:
  ```yaml
  - id: load
    use: io.read_vector
    params:
      path: "data.shp"
  ```

## vector.buffer
...
```

---

## 1.4 与传统 GIS 工具对比

为了帮助读者更好地理解 GeoPipeAgent 的定位，下面将它与常见的 GIS 工具和方法进行对比。

### 1.4.1 综合对比表

| 特性 | GeoPipeAgent | ArcGIS Pro (ModelBuilder) | QGIS (Processing) | 原生 Python 脚本 |
|------|-------------|--------------------------|--------------------|--------------------|
| **定义方式** | YAML 声明式 | 可视化拖拽 | 可视化/Python | Python 代码 |
| **AI 集成** | ★★★★★ 原生支持 | ★★☆☆☆ 有限 | ★★☆☆☆ 有限 | ★★★☆☆ 需手工 |
| **版本控制** | ★★★★★ YAML 文本 | ★★☆☆☆ 二进制 | ★★★☆☆ XML | ★★★★★ 代码 |
| **可移植性** | ★★★★★ 跨平台 | ★★☆☆☆ Windows | ★★★★☆ 跨平台 | ★★★★☆ 依赖环境 |
| **执行前校验** | ★★★★★ 完整校验 | ★★★☆☆ 部分 | ★★★☆☆ 部分 | ★☆☆☆☆ 无 |
| **报告生成** | ★★★★★ 自动 JSON | ★★★☆☆ 手动 | ★★☆☆☆ 手动 | ★★☆☆☆ 手动 |
| **QC 集成** | ★★★★★ 内置 | ★★★★☆ 有 | ★★★☆☆ 插件 | ★☆☆☆☆ 手动 |
| **安全性** | ★★★★★ 沙箱 | ★★★★☆ 受控 | ★★★☆☆ 有限 | ★☆☆☆☆ 无限制 |
| **学习曲线** | ★★★★☆ 较平缓 | ★★★☆☆ 中等 | ★★★☆☆ 中等 | ★★☆☆☆ 较陡 |
| **开源/费用** | 免费 MIT | 商业许可 | 免费 GPL | 免费 |
| **多后端** | ★★★★★ 6+ 后端 | ★☆☆☆☆ 仅 ArcGIS | ★★☆☆☆ 仅 QGIS | ★★★☆☆ 手动切换 |

### 1.4.2 适用场景对比

**选择 GeoPipeAgent 当你需要：**
- AI 自动生成和执行 GIS 分析
- 标准化的批量处理流程
- 集成到 CI/CD 或自动化流水线
- 统一的 JSON 报告格式
- 多后端灵活切换

**选择传统桌面 GIS 当你需要：**
- 交互式的可视化编辑
- 复杂的制图和出图
- 手动数据探索和分析
- 图形化用户界面

**选择原生 Python 脚本当你需要：**
- 高度定制化的分析逻辑
- 与其他 Python 库深度集成
- 原型开发和实验

---

## 1.5 应用场景

GeoPipeAgent 适用于多种实际场景：

### 1.5.1 AI 驱动的自动化分析

这是 GeoPipeAgent 最核心的应用场景：

```
用户: "帮我分析这个城市的热岛效应，找出温度最高的区域"
  │
  ▼
AI (LLM): 阅读 Skill 文件 → 生成 YAML 流水线
  │
  ▼
GeoPipeAgent: 解析 → 校验 → 执行 → 报告
  │
  ▼
用户: 收到结构化 JSON 报告 + 输出数据
```

### 1.5.2 数据质量保障

在数据入库前自动检查数据质量：

```yaml
pipeline:
  name: data_quality_check
  description: 入库前数据质量检查
  steps:
    - id: load
      use: io.read_vector
      params:
        path: "incoming_data.gpkg"
    - id: check_geom
      use: qc.geometry_validity
      params:
        input: $load
    - id: check_attrs
      use: qc.attribute_check
      params:
        input: $load
        rules:
          - field: name
            not_null: true
          - field: area
            min_value: 0
    - id: check_topo
      use: qc.topology_check
      params:
        input: $load
        rules:
          - type: no_gaps
          - type: no_overlaps
```

### 1.5.3 批量数据处理

处理大量数据文件的标准化流程：

```yaml
pipeline:
  name: batch_process
  description: 批量坐标转换和格式转换
  variables:
    input_dir: "/data/incoming"
    output_dir: "/data/processed"
    target_crs: "EPSG:4326"
  steps:
    - id: read_data
      use: io.read_vector
      params:
        path: "${input_dir}/data.shp"
    - id: reproject
      use: vector.reproject
      params:
        input: $read_data
        target_crs: ${target_crs}
    - id: validate
      use: qc.geometry_validity
      params:
        input: $reproject
    - id: save
      use: io.write_vector
      params:
        input: $reproject
        path: "${output_dir}/data_4326.gpkg"
        driver: "GPKG"
```

### 1.5.4 城市规划分析

综合利用多种空间分析步骤：

```yaml
pipeline:
  name: urban_planning_analysis
  description: 城市规划适宜性分析
  steps:
    - id: load_parcels
      use: io.read_vector
      params:
        path: "parcels.gpkg"
    - id: load_roads
      use: io.read_vector
      params:
        path: "roads.gpkg"
    - id: load_poi
      use: io.read_vector
      params:
        path: "poi.gpkg"
    - id: road_buffer
      use: vector.buffer
      params:
        input: $load_roads
        distance: 200
    - id: near_road
      use: analysis.spatial_join
      params:
        left: $load_parcels
        right: $road_buffer
        how: "inner"
    - id: poi_density
      use: analysis.density
      params:
        input: $load_poi
        radius: 1000
    - id: suitability
      use: analysis.overlay
      params:
        input: $near_road
        overlay: $poi_density
        operation: "intersection"
```

---

## 1.6 快速上手示例

接下来，我们通过一个完整的示例，从安装到运行，体验 GeoPipeAgent 的完整工作流。

### 1.6.1 安装 GeoPipeAgent

```bash
# 创建并激活虚拟环境
python -m venv geopipe-env
source geopipe-env/bin/activate  # Linux/macOS
# geopipe-env\Scripts\activate   # Windows

# 从仓库安装
git clone https://github.com/your-org/GeoPipeAgent.git
cd GeoPipeAgent
pip install -e ".[dev,analysis]"
```

### 1.6.2 验证安装

```bash
# 查看版本
geopipe-agent version

# 输出示例：
# GeoPipeAgent v0.1.0
# Python 3.11.5
# GDAL 3.7.2 (available)
# QGIS not found

# 查看可用后端
geopipe-agent backends

# 输出示例：
# Available backends:
#   ✓ native_python (GeoPandas + Shapely)
#   ✓ gdal_cli (ogr2ogr / gdalwarp)
#   ✓ gdal_python (GDAL Python bindings)
#   ✗ qgis_process (not installed)
#   ✗ pyqgis (not installed)
#   ✓ generic_cli
#   ✓ curl_api

# 查看所有可用步骤
geopipe-agent list-steps

# 输出示例：
# Available steps (42 total):
#
# IO:
#   io.read_vector     - 读取矢量数据
#   io.write_vector    - 写入矢量数据
#   io.read_raster     - 读取栅格数据
#   io.write_raster    - 写入栅格数据
#
# Vector:
#   vector.buffer      - 缓冲区分析
#   vector.clip        - 矢量裁剪
#   vector.union       - 矢量联合
#   ...
```

### 1.6.3 创建 YAML 流水线

创建一个名为 `buffer_analysis.yaml` 的文件：

```yaml
pipeline:
  name: buffer_analysis
  description: 建筑物缓冲区分析示例
  crs: "EPSG:4326"
  variables:
    buffer_distance: 500
  steps:
    - id: load_buildings
      use: io.read_vector
      params:
        path: "data/buildings.shp"

    - id: check_input
      use: qc.geometry_validity
      params:
        input: $load_buildings

    - id: reproject
      use: vector.reproject
      params:
        input: $load_buildings
        target_crs: "EPSG:3857"

    - id: create_buffer
      use: vector.buffer
      params:
        input: $reproject
        distance: ${buffer_distance}

    - id: reproject_back
      use: vector.reproject
      params:
        input: $create_buffer
        target_crs: "EPSG:4326"

    - id: save_result
      use: io.write_vector
      params:
        input: $reproject_back
        path: "output/buildings_buffer.gpkg"
        driver: "GPKG"

  outputs:
    buffer_result: $reproject_back
    qc_report: $check_input
```

### 1.6.4 运行流水线

```bash
# 基本运行
geopipe-agent run buffer_analysis.yaml

# 指定输出报告路径
geopipe-agent run buffer_analysis.yaml --report output/report.json

# 覆盖变量
geopipe-agent run buffer_analysis.yaml --var buffer_distance=1000

# 仅校验不执行
geopipe-agent validate buffer_analysis.yaml

# 查看详细执行日志
geopipe-agent run buffer_analysis.yaml --verbose
```

### 1.6.5 查看 JSON 报告

执行完成后，查看生成的 JSON 报告：

```json
{
  "pipeline": "buffer_analysis",
  "description": "建筑物缓冲区分析示例",
  "status": "success",
  "started_at": "2024-01-15T10:30:00.000Z",
  "finished_at": "2024-01-15T10:30:12.345Z",
  "duration_seconds": 12.345,
  "total_steps": 6,
  "passed_steps": 6,
  "failed_steps": 0,
  "skipped_steps": 0,
  "variables": {
    "buffer_distance": 500
  },
  "steps": [
    {
      "id": "load_buildings",
      "use": "io.read_vector",
      "status": "success",
      "duration_seconds": 1.23,
      "output_type": "GeoDataFrame",
      "stats": {
        "feature_count": 3456,
        "geometry_type": "Polygon",
        "crs": "EPSG:4326",
        "bounds": [116.28, 39.85, 116.52, 40.05],
        "columns": ["id", "name", "height", "area", "geometry"]
      }
    },
    {
      "id": "check_input",
      "use": "qc.geometry_validity",
      "status": "success",
      "duration_seconds": 0.45,
      "output_type": "QcResult",
      "stats": {
        "total_features": 3456,
        "valid_features": 3450,
        "invalid_features": 6,
        "issues_count": 6
      }
    },
    {
      "id": "reproject",
      "use": "vector.reproject",
      "status": "success",
      "duration_seconds": 2.10,
      "output_type": "GeoDataFrame",
      "stats": {
        "feature_count": 3456,
        "crs": "EPSG:3857"
      }
    },
    {
      "id": "create_buffer",
      "use": "vector.buffer",
      "status": "success",
      "duration_seconds": 3.21,
      "output_type": "GeoDataFrame",
      "stats": {
        "feature_count": 3456,
        "buffer_distance": 500,
        "crs": "EPSG:3857"
      }
    },
    {
      "id": "reproject_back",
      "use": "vector.reproject",
      "status": "success",
      "duration_seconds": 2.80,
      "output_type": "GeoDataFrame",
      "stats": {
        "feature_count": 3456,
        "crs": "EPSG:4326"
      }
    },
    {
      "id": "save_result",
      "use": "io.write_vector",
      "status": "success",
      "duration_seconds": 2.50,
      "output": "output/buildings_buffer.gpkg"
    }
  ],
  "qc_issues": [
    {
      "step_id": "check_input",
      "rule": "geometry_validity",
      "severity": "warning",
      "feature_id": 128,
      "message": "要素 128 包含自相交几何"
    },
    {
      "step_id": "check_input",
      "rule": "geometry_validity",
      "severity": "warning",
      "feature_id": 256,
      "message": "要素 256 包含重复顶点"
    }
  ],
  "qc_summary": {
    "total_issues": 6,
    "errors": 0,
    "warnings": 6
  },
  "outputs": {
    "buffer_result": {
      "type": "GeoDataFrame",
      "feature_count": 3456,
      "crs": "EPSG:4326"
    },
    "qc_report": {
      "type": "QcResult",
      "issues_count": 6
    }
  }
}
```

### 1.6.6 查看步骤详情

使用 CLI 查看特定步骤的详细信息：

```bash
# 查看步骤描述
geopipe-agent describe vector.buffer

# 输出示例：
# Step: vector.buffer
# Description: 为矢量要素创建缓冲区
# Category: vector
#
# Parameters:
#   input (geodataframe, required)
#     输入矢量数据
#   distance (number, required)
#     缓冲距离（地图单位，通常为米或度）
#   resolution (number, optional, default=16)
#     缓冲区边缘的分辨率（圆弧分段数）
#   cap_style (string, optional, default="round")
#     端点样式：round, flat, square
#   join_style (string, optional, default="round")
#     连接样式：round, mitre, bevel
#
# Output: geodataframe
#
# Tags: vector, geometry, buffer
#
# Supported backends:
#   - native_python (default)
#   - gdal_cli
#   - qgis_process
#
# Example:
#   - id: my_buffer
#     use: vector.buffer
#     params:
#       input: $source_data
#       distance: 1000
```

---

## 1.7 项目仓库结构总览

GeoPipeAgent 的完整项目结构如下：

```
GeoPipeAgent/
├── src/geopipe_agent/                 # 核心源代码包
│   ├── __init__.py                    # 包初始化，版本号定义
│   ├── cli.py                         # Click CLI 入口，9 个命令
│   ├── errors.py                      # 自定义异常类定义
│   │
│   ├── backends/                      # 多后端执行抽象层
│   │   ├── __init__.py
│   │   ├── base.py                    # Backend 基类定义
│   │   ├── native_python_backend.py   # GeoPandas/Shapely 原生后端
│   │   ├── gdal_cli.py               # ogr2ogr/gdalwarp CLI 后端
│   │   ├── gdal_python_backend.py     # GDAL Python API 后端
│   │   ├── qgis_process.py           # qgis_process CLI 后端
│   │   ├── pyqgis_backend.py         # PyQGIS API 后端
│   │   ├── generic_cli_backend.py    # 通用 CLI 命令后端
│   │   └── curl_api_backend.py       # REST API 调用后端
│   │
│   ├── engine/                        # 执行引擎核心
│   │   ├── __init__.py
│   │   ├── parser.py                  # YAML → PipelineDefinition 解析器
│   │   ├── validator.py               # 流水线定义校验器
│   │   ├── executor.py                # 步骤执行器（含重试、条件逻辑）
│   │   ├── context.py                 # PipelineContext 上下文管理
│   │   └── reporter.py               # JSON 报告生成器
│   │
│   ├── models/                        # 数据模型定义
│   │   ├── __init__.py
│   │   ├── pipeline.py                # PipelineDefinition, StepDefinition
│   │   ├── result.py                  # StepResult（含 __getattr__ 点访问）
│   │   └── qc.py                      # QcIssue 数据类
│   │
│   ├── steps/                         # 步骤注册表与具体实现
│   │   ├── __init__.py
│   │   ├── registry.py                # @step 装饰器与全局注册表
│   │   ├── io/                        # IO 类步骤
│   │   │   ├── __init__.py
│   │   │   ├── read_vector.py
│   │   │   ├── write_vector.py
│   │   │   ├── read_raster.py
│   │   │   └── write_raster.py
│   │   ├── vector/                    # 矢量分析步骤
│   │   │   ├── __init__.py
│   │   │   ├── buffer.py
│   │   │   ├── clip.py
│   │   │   ├── union.py
│   │   │   ├── intersection.py
│   │   │   ├── dissolve.py
│   │   │   ├── filter.py
│   │   │   ├── reproject.py
│   │   │   ├── simplify.py
│   │   │   ├── centroid.py
│   │   │   └── merge.py
│   │   ├── raster/                    # 栅格分析步骤
│   │   │   ├── __init__.py
│   │   │   ├── clip.py
│   │   │   ├── reproject.py
│   │   │   ├── zonal_stats.py
│   │   │   ├── reclassify.py
│   │   │   ├── hillshade.py
│   │   │   ├── slope.py
│   │   │   └── aspect.py
│   │   ├── analysis/                  # 高级空间分析步骤
│   │   │   ├── __init__.py
│   │   │   ├── spatial_join.py
│   │   │   ├── hotspot.py
│   │   │   ├── interpolation.py
│   │   │   ├── density.py
│   │   │   ├── overlay.py
│   │   │   └── voronoi.py
│   │   ├── network/                   # 网络分析步骤
│   │   │   ├── __init__.py
│   │   │   ├── shortest_path.py
│   │   │   ├── service_area.py
│   │   │   ├── isochrone.py
│   │   │   └── geocode.py
│   │   └── qc/                        # 数据质检步骤
│   │       ├── __init__.py
│   │       ├── geometry_validity.py
│   │       ├── attribute_check.py
│   │       ├── topology_check.py
│   │       └── crs_consistency.py
│   │
│   ├── skillgen/                      # AI Skill 生成器
│   │   ├── __init__.py
│   │   └── generator.py              # Skill 文件生成逻辑
│   │
│   └── utils/                         # 通用工具
│       ├── __init__.py
│       ├── logging.py                 # 结构化日志工具
│       └── safe_eval.py              # AST 安全表达式求值
│
├── web/                               # Web 界面和 API 服务
│   ├── backend/                       # FastAPI 后端
│   │   ├── main.py                    # FastAPI 应用入口
│   │   ├── api/                       # API 路由
│   │   ├── worker.py                  # RQ 任务工作进程
│   │   └── requirements.txt
│   └── frontend/                      # Vue.js 前端
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── Dockerfile
│
├── cookbook/                           # 示例流水线集合
│   ├── buffer_analysis.yaml
│   ├── qc_pipeline.yaml
│   ├── raster_analysis.yaml
│   ├── urban_planning.yaml
│   └── batch_processing.yaml
│
├── tests/                             # 测试代码
│   ├── conftest.py
│   ├── test_parser.py
│   ├── test_validator.py
│   ├── test_executor.py
│   ├── test_context.py
│   ├── test_steps/
│   └── test_backends/
│
├── pyproject.toml                     # 项目配置（PEP 621）
├── docker-compose.yml                 # Docker 编排配置
├── .env.example                       # 环境变量模板
├── LICENSE                            # MIT 许可证
└── README.md                          # 项目自述文件
```

### 1.7.1 目录说明

| 目录/文件 | 说明 |
|-----------|------|
| `src/geopipe_agent/` | 核心 Python 包，包含所有框架代码 |
| `src/geopipe_agent/cli.py` | CLI 命令行工具入口，基于 Click 框架 |
| `src/geopipe_agent/backends/` | 多后端抽象实现，支持 GDAL、QGIS 等 |
| `src/geopipe_agent/engine/` | 执行引擎：解析、校验、执行、报告 |
| `src/geopipe_agent/models/` | 数据模型：流水线定义、步骤结果、QC 问题 |
| `src/geopipe_agent/steps/` | 步骤注册表和所有内置步骤实现 |
| `src/geopipe_agent/skillgen/` | AI Skill 文件自动生成 |
| `src/geopipe_agent/utils/` | 通用工具：安全求值、日志 |
| `web/` | Web 界面：FastAPI 后端 + Vue.js 前端 |
| `cookbook/` | 示例 YAML 流水线集合 |
| `tests/` | 完整的测试套件 |
| `pyproject.toml` | 项目元数据和依赖管理 |
| `docker-compose.yml` | Docker 多容器编排 |

---

## 1.8 本章小结

本章介绍了 GeoPipeAgent 的核心概念和设计理念：

1. **定位**：AI 原生的 GIS 分析流水线框架
2. **设计理念**：AI First，三步流转模型（YAML → 执行 → JSON 报告）
3. **核心特性**：YAML 声明式、可扩展步骤、多后端、QC 集成、JSON 输出、AI Skill
4. **应用场景**：AI 驱动分析、数据质检、批量处理、城市规划
5. **快速上手**：从安装到运行的完整流程
6. **仓库结构**：模块化的项目组织

在下一章中，我们将详细介绍 GeoPipeAgent 的安装与环境配置，包括各种安装方式、依赖管理、Docker 部署以及常见问题排查。

---

[下一章：安装与环境配置 →](02-安装与环境配置)

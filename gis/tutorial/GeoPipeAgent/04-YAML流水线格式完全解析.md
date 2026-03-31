---
layout: default
title: 第四章：YAML 流水线格式完全解析
---

# 第四章：YAML 流水线格式完全解析

## 4.1 完整 YAML Schema 概览

一个 GeoPipeAgent YAML 流水线文件的完整格式如下：

```yaml
# ==============================
# 顶层元信息
# ==============================
name: 流水线名称              # 必填，用于日志和报告
description: 流水线的描述说明  # 可选
crs: "EPSG:4326"              # 可选，全局默认 CRS，步骤未指定时使用

# ==============================
# 变量定义
# ==============================
variables:                    # 可选
  var_name: value             # 变量名: 变量值（支持字符串、数值、布尔值）
  another_var: 100

# ==============================
# 步骤列表
# ==============================
steps:                        # 必填，至少包含一个步骤
  - id: step-id               # 必填，唯一标识，格式：[a-z0-9_-]+
    use: category.action      # 必填，步骤类型
    params:                   # 可选（部分步骤无需参数）
      key: value
      ref_param: $other-step  # 步骤引用
      var_param: ${var_name}  # 变量引用
    when: "条件表达式"         # 可选，为 false 时跳过该步骤
    on_error: fail            # 可选，错误策略：fail（默认）/ skip / retry
    backend: native_python    # 可选，指定执行后端

# ==============================
# 输出声明
# ==============================
outputs:                      # 可选
  output_name: $step-id       # 将步骤输出映射到具名输出
```

## 4.2 顶层元信息字段

### `name`（必填）

流水线名称，会出现在执行日志和 JSON 报告中。

```yaml
name: 城市道路缓冲区分析
```

**约束**：
- 类型：字符串
- 必填，不可为空

### `description`（可选）

对流水线的文字说明，有助于团队理解流水线用途。

```yaml
description: |
  对城市主干道做 500m 缓冲区分析，用于评估噪声影响范围。
  输入：WGS84 坐标系 Shapefile
  输出：GeoJSON 格式缓冲面
```

### `crs`（可选）

全局默认坐标参考系（Coordinate Reference System）。当某些步骤需要 CRS 信息但未显式指定时，使用此值。

```yaml
crs: "EPSG:4326"
```

支持的 CRS 格式：
- EPSG 代码：`"EPSG:4326"`、`"EPSG:3857"`
- PROJ 字符串：`"+proj=utm +zone=50 +datum=WGS84"`
- WKT 格式（不推荐，冗长）

## 4.3 variables 块

`variables` 块用于定义可在流水线中复用的变量值，通过 `${var_name}` 语法引用。

### 4.3.1 支持的数据类型

```yaml
variables:
  # 字符串
  input_path: "data/roads.shp"
  output_dir: "output/"

  # 整数
  buffer_distance: 500

  # 浮点数
  tolerance: 0.001

  # 布尔值
  simplify_enabled: true

  # 列表（用于支持列表参数的步骤）
  required_fields:
    - name
    - type
    - length
```

### 4.3.2 变量引用语法

```yaml
steps:
  - id: load
    use: io.read_vector
    params:
      path: ${input_path}          # 引用字符串变量

  - id: buffer
    use: vector.buffer
    params:
      input: $load
      distance: ${buffer_distance} # 引用数值变量
```

### 4.3.3 CLI 覆盖变量

`variables` 中定义的变量可以在运行时通过 `--var` 参数覆盖：

```bash
# 单个变量覆盖
geopipe-agent run pipeline.yaml --var input_path=data/rivers.shp

# 多个变量覆盖
geopipe-agent run pipeline.yaml \
  --var input_path=data/rivers.shp \
  --var buffer_distance=1000 \
  --var simplify_enabled=false
```

这使得同一 YAML 文件可以作为"模板"，在不同数据或参数组合下复用。

## 4.4 steps 块

### 4.4.1 步骤 `id`

步骤 ID 是步骤的唯一标识符，用于：
- 在后续步骤中通过 `$step-id` 引用该步骤的输出
- 在日志和报告中标识步骤

**命名规范**：
- 只允许小写字母、数字、下划线（`_`）、短横线（`-`）
- 示例：`load-data`、`reproject_wgs84`、`buffer500`
- 不允许空格、大写字母、特殊符号

```yaml
steps:
  - id: load-roads      # ✅ 合法
  - id: reproject       # ✅ 合法
  - id: Buffer Analysis # ❌ 含空格和大写，非法
```

### 4.4.2 步骤 `use`

`use` 字段指定步骤类型，格式为 `类别.动作`：

```yaml
use: io.read_vector
use: vector.buffer
use: raster.reproject
use: analysis.voronoi
use: network.shortest_path
use: qc.geometry_validity
```

各类别前缀：

| 前缀 | 说明 | 步骤数 |
|------|------|--------|
| `io` | 数据输入/输出 | 4 |
| `vector` | 矢量数据处理 | 7 |
| `raster` | 栅格数据处理 | 5 |
| `analysis` | 空间分析 | 4 |
| `network` | 网络分析 | 3 |
| `qc` | 数据质检 | 10 |

### 4.4.3 步骤 `params`

`params` 是一个键值对字典，向步骤传递参数。参数值支持：

- **字面量**：直接写值（字符串、数值、布尔值）
- **变量引用**：`${var_name}` 替换为 `variables` 中定义的值
- **步骤引用**：`$step-id` 引用前一步骤的输出数据
- **步骤属性引用**：`$step-id.attr` 引用步骤输出的特定属性

```yaml
steps:
  - id: load
    use: io.read_vector
    params:
      path: ${input_path}        # 变量引用

  - id: reproject
    use: vector.reproject
    params:
      input: $load               # 步骤引用（引用 load 步骤的输出）
      target_crs: "EPSG:3857"   # 字面量

  - id: check-crs
    use: qc.crs_check
    params:
      input: $load
      expected_crs: $load.crs   # 步骤属性引用（引用 load 步骤输出的 crs 属性）
```

### 4.4.4 `when` 条件执行

`when` 字段接受一个表达式字符串，在运行时求值。如果结果为 `false`（或 falsy），该步骤会被**跳过**（状态标记为 `skipped`）而不是执行。

```yaml
variables:
  enable_simplify: false
  min_features: 100

steps:
  - id: load
    use: io.read_vector
    params:
      path: "data/roads.shp"

  - id: simplify
    use: vector.simplify
    params:
      input: $load
      tolerance: 10
    when: "${enable_simplify} == true"   # 变量为 false，跳过此步骤

  - id: buffer
    use: vector.buffer
    params:
      input: $load
      distance: 500
    when: "$load.feature_count > ${min_features}"  # 基于步骤结果的条件
```

**`when` 表达式支持的操作**：
- 比较运算：`==`、`!=`、`>`、`<`、`>=`、`<=`
- 逻辑运算：`and`、`or`、`not`
- 变量/步骤引用：`${var}`、`$step.attr`
- 字面量：字符串（带引号）、数值、`true`/`false`

**注意**：`when` 表达式通过安全求值（AST 白名单）运行，不支持任意 Python 代码。

### 4.4.5 `on_error` 错误策略

当步骤执行抛出异常时，`on_error` 决定框架的行为：

| 值 | 行为 | 适用场景 |
|----|------|----------|
| `fail`（默认） | 立即终止流水线，报告失败 | 步骤失败影响后续所有步骤 |
| `skip` | 跳过当前步骤，继续后续步骤 | 可选的非关键步骤 |
| `retry` | 自动重试最多 3 次，仍失败则终止 | 网络请求、外部 API 调用等不稳定操作 |

```yaml
steps:
  - id: geocode
    use: network.geocode
    params:
      address: "北京市天安门广场"
    on_error: retry    # 网络问题时自动重试

  - id: optional-clip
    use: vector.clip
    params:
      input: $data
      clip: $boundary
    on_error: skip     # 裁剪失败时跳过，不影响主流程
```

### 4.4.6 `backend` 后端指定

在步骤级别指定使用的后端，优先级高于全局配置：

```yaml
steps:
  - id: convert
    use: io.write_vector
    params:
      input: $load
      path: "output/result.shp"
    backend: gdal_cli          # 使用 GDAL CLI 后端而非默认的 native_python

  - id: buffer
    use: vector.buffer
    params:
      input: $load
      distance: 500
    backend: native_python     # 明确使用默认后端
```

## 4.5 outputs 块

`outputs` 块将步骤的输出映射到具名输出，方便在 JSON 报告中查找结果：

```yaml
outputs:
  # 格式：输出名称: $step-id
  buffer_result: $buffer-step    # 将 buffer-step 步骤的输出命名为 buffer_result
  statistics: $stats-step
```

`outputs` 是可选的，但强烈建议定义，这样：
1. JSON 报告的 `outputs` 字段会包含对应结果的位置信息。
2. AI 解析报告时更容易找到关键输出。

## 4.6 步骤引用详解

步骤引用（`$step-id`）是 GeoPipeAgent 的数据流传递机制，支持以下形式：

### 基本引用

```yaml
# $step-id 引用步骤的主要输出（通常是 GeoDataFrame 或 raster 数组）
params:
  input: $load-data
```

### 属性引用

```yaml
# $step-id.attr 引用步骤输出的特定属性
params:
  expected_crs: $load.crs             # 引用步骤输出的 crs 字段
  feature_count: $load.feature_count  # 引用步骤输出的 feature_count 字段
```

常见可引用属性：

| 步骤类型 | 可引用属性 | 说明 |
|----------|-----------|------|
| `io.read_vector` | `.crs`、`.feature_count`、`.geometry_type` | 矢量数据元信息 |
| `io.read_raster` | `.crs`、`.width`、`.height`、`.nodata` | 栅格数据元信息 |
| `vector.*` | `.feature_count`、`.crs` | 矢量步骤通用属性 |
| `qc.*` | `.issue_count`、`.passed` | 质检结果属性 |

## 4.7 YAML 多文档与注释

YAML 本身支持注释（以 `#` 开头），建议在流水线中充分使用注释增加可读性：

```yaml
name: 复杂分析流水线

variables:
  # 输入数据路径
  input_path: "data/buildings.gpkg"
  # 分析缓冲距离（单位：米，需使用投影坐标系）
  buffer_dist: 100
  # 是否执行质检步骤
  run_qc: true

steps:
  # ---- 数据加载阶段 ----
  - id: load
    use: io.read_vector
    params:
      path: ${input_path}

  # ---- 预处理阶段 ----
  - id: reproject
    use: vector.reproject
    params:
      input: $load
      target_crs: "EPSG:3857"    # 转为墨卡托投影，距离单位变为米

  # ---- 分析阶段 ----
  - id: buffer
    use: vector.buffer
    params:
      input: $reproject
      distance: ${buffer_dist}

  # ---- 质检阶段（可选）----
  - id: qc-check
    use: qc.geometry_validity
    params:
      input: $buffer
    when: "${run_qc} == true"
    on_error: skip
```

## 4.8 完整示例：多步骤复杂流水线

以下是一个综合示例，展示了 YAML 格式的各种特性：

```yaml
name: 城市用地适宜性分析
description: 综合道路、水系、土地利用数据，分析城市建设适宜性

crs: "EPSG:4326"

variables:
  road_path: "data/roads.shp"
  water_path: "data/water.shp"
  land_path: "data/land_use.gpkg"
  output_dir: "output/"
  buffer_road: 500     # 道路缓冲距离（米）
  buffer_water: 200    # 水系缓冲距离（米）
  run_simplify: true

steps:
  # 1. 加载数据
  - id: load-roads
    use: io.read_vector
    params:
      path: ${road_path}

  - id: load-water
    use: io.read_vector
    params:
      path: ${water_path}

  - id: load-land
    use: io.read_vector
    params:
      path: ${land_path}

  # 2. 投影转换（统一到 EPSG:3857）
  - id: proj-roads
    use: vector.reproject
    params:
      input: $load-roads
      target_crs: "EPSG:3857"

  - id: proj-water
    use: vector.reproject
    params:
      input: $load-water
      target_crs: "EPSG:3857"

  # 3. 缓冲区分析
  - id: buf-roads
    use: vector.buffer
    params:
      input: $proj-roads
      distance: ${buffer_road}

  - id: buf-water
    use: vector.buffer
    params:
      input: $proj-water
      distance: ${buffer_water}

  # 4. 叠加分析：求道路缓冲区与水系缓冲区的差集
  - id: overlay
    use: vector.overlay
    params:
      left: $buf-roads
      right: $buf-water
      how: difference

  # 5. 简化（可选）
  - id: simplify
    use: vector.simplify
    params:
      input: $overlay
      tolerance: 5
    when: "${run_simplify} == true"

  # 6. 保存结果
  - id: save
    use: io.write_vector
    params:
      input: $simplify
      path: "${output_dir}suitable_areas.geojson"
      driver: GeoJSON
    on_error: retry

outputs:
  suitable_areas: $save
  road_buffer: $buf-roads
  water_buffer: $buf-water
```

## 4.9 常见错误与最佳实践

### 最佳实践

1. **始终定义 `variables`**：将路径、参数等硬编码值提取为变量，提高复用性。
2. **合理使用 `when`**：对于可选步骤，用 `when` 控制是否执行，避免注释/删除步骤。
3. **重要步骤加 `on_error: retry`**：网络请求、外部 API 调用建议设置重试策略。
4. **定义 `outputs`**：明确声明流水线的关键输出，便于 AI 和人类解析报告。
5. **充分注释**：用 `#` 为步骤和变量添加说明，特别是在团队协作中。

### 常见错误

| 错误 | 原因 | 解决方法 |
|------|------|----------|
| `步骤 ID 重复` | 同一 YAML 中有两个相同的 `id` | 确保所有步骤 ID 唯一 |
| `引用不存在的步骤` | `$step-id` 中的 step-id 不存在 | 检查拼写，确保被引用步骤在前 |
| `循环引用` | 步骤 A 引用步骤 B，步骤 B 又引用步骤 A | 调整步骤顺序，消除循环 |
| `变量未定义` | `${var}` 中的变量名在 `variables` 中不存在 | 添加变量定义或通过 `--var` 传入 |

## 4.10 小结

本章全面解析了 GeoPipeAgent YAML 流水线格式的每个字段：

- **顶层字段**：`name`（必填）、`description`、`crs`（可选）
- **`variables`**：定义可复用变量，支持 `${var}` 引用和 CLI `--var` 覆盖
- **`steps`**：步骤列表，每步有 `id`、`use`、`params`、`when`、`on_error`、`backend`
- **`outputs`**：映射步骤结果到具名输出

下一章将深入介绍变量系统和步骤引用的工作机制，包括引用解析的底层原理。

---
layout: default
title: "第四章：YAML 流水线格式完全解析"
---

# 第四章：YAML 流水线格式完全解析

## 4.1 流水线文件总体结构

每个 GeoPipeAgent 流水线文件都是一个标准 YAML 文件，必须以 `pipeline:` 作为**唯一的顶层键**。这是框架解析器（`parser.py`）的强制要求，缺少此键将直接报 `PipelineParseError`。

### 完整结构示例

```yaml
pipeline:
  # ─── 元数据 ───────────────────────────────────
  name: "流水线名称"           # 必填：流水线唯一名称
  description: "流水线描述"    # 可选：说明流水线用途
  crs: "EPSG:4326"            # 可选：默认坐标参考系统

  # ─── 变量定义 ─────────────────────────────────
  variables:                   # 可选：可复用的变量
    input_path: "data/input.shp"
    buffer_dist: 500
    output_dir: "output/"

  # ─── 步骤列表 ─────────────────────────────────
  steps:                       # 必填：步骤列表，顺序执行
    - id: step-one             # 必填：步骤唯一 ID
      use: io.read_vector      # 必填：步骤类型
      params:                  # 步骤参数
        path: "${input_path}"
      when: "true"             # 可选：条件执行
      on_error: fail           # 可选：错误策略
      backend: native_python   # 可选：指定后端

    - id: step-two
      use: vector.buffer
      params:
        input: "$step-one"
        distance: "${buffer_dist}"

  # ─── 输出声明 ─────────────────────────────────
  outputs:                     # 可选：声明流水线输出
    result: "$step-two"
    stats: "$step-two.stats"
```

---

## 4.2 `pipeline:` 顶层键（强制要求）

`pipeline:` 是整个 YAML 文件的根键，这是 GeoPipeAgent 的**解析约定**。

### 正确示例

```yaml
pipeline:          # ✓ 正确：有顶层 pipeline: 键
  name: "测试流水线"
  steps:
    - id: step1
      use: io.read_vector
      params:
        path: "data.geojson"
```

### 错误示例（会报 PipelineParseError）

```yaml
# ✗ 错误：缺少 pipeline: 顶层键
name: "测试流水线"
steps:
  - id: step1
    use: io.read_vector
```

```yaml
# ✗ 错误：顶层键名不正确
workflow:
  name: "测试流水线"
  steps: []
```

### 解析器行为

当 YAML 文件缺少 `pipeline:` 顶层键时，`parser.py` 会抛出：

```
PipelineParseError: 无效的流水线格式：缺少必要的顶层键 'pipeline'
```

---

## 4.3 `name` 字段

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 是否必填 | **是** |
| 约束 | 非空字符串 |

流水线名称用于报告生成和日志标识，建议使用描述性的名称。

```yaml
pipeline:
  name: "城市道路缓冲区分析 v2.0"  # 推荐：版本化、描述性
  # name: "test"                   # 不推荐：不够描述性
```

---

## 4.4 `description` 字段

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 是否必填 | 否 |
| 默认值 | `""` |

多行描述使用 YAML 折叠块语法：

```yaml
pipeline:
  name: "道路分析"
  description: >
    本流水线对城市道路网络进行缓冲区分析，
    筛选主干道并生成 500 米服务范围，
    用于城市规划中的基础设施覆盖分析。
```

---

## 4.5 `crs` 字段

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 是否必填 | 否 |
| 默认值 | `null` |
| 格式 | EPSG 代码、PROJ 字符串或 WKT |

`crs` 字段指定流水线默认的坐标参考系统，主要用于：
- 某些步骤的默认 CRS 上下文
- 报告中的 CRS 元数据

```yaml
pipeline:
  name: "北京道路分析"
  crs: "EPSG:4326"           # WGS84 地理坐标
  # crs: "EPSG:3857"         # Web 墨卡托（米）
  # crs: "EPSG:4490"         # CGCS2000（国家大地坐标系）
  # crs: "EPSG:32650"        # WGS84 UTM Zone 50N
```

**常用 CRS 对照表**：

| CRS | EPSG 代码 | 单位 | 适用范围 |
|-----|-----------|------|----------|
| WGS84 | EPSG:4326 | 度 | 全球，GPS 坐标 |
| Web 墨卡托 | EPSG:3857 | 米 | 网络地图，缓冲区分析 |
| CGCS2000 | EPSG:4490 | 度 | 中国国家标准 |
| Beijing 1954 / GK | EPSG:21460 | 米 | 中国历史数据 |
| UTM Zone 50N | EPSG:32650 | 米 | 中国东部精确距离计算 |

---

## 4.6 `variables` 字段

| 属性 | 值 |
|------|-----|
| 类型 | dict |
| 是否必填 | 否 |
| 默认值 | `{}` |

`variables` 定义可在整个流水线中复用的命名值，使用 `${var_name}` 引用。

### 支持的变量类型

```yaml
pipeline:
  name: "变量类型示例"
  variables:
    # 字符串
    input_path: "data/roads.shp"
    output_dir: "output/"

    # 数字
    buffer_dist: 500
    threshold: 0.001

    # 布尔值
    preserve_topology: true

    # 列表（不常用，部分步骤支持）
    required_fields:
      - road_id
      - name
      - type

  steps:
    - id: load
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: buffer
      use: vector.buffer
      params:
        input: "$load"
        distance: "${buffer_dist}"
```

### 变量的优先级

CLI 通过 `--var` 参数传入的值会**覆盖** YAML 中定义的变量：

```bash
# YAML 中 buffer_dist = 500，CLI 覆盖为 1000
geopipe-agent run pipeline.yaml --var buffer_dist=1000
```

---

## 4.7 `steps` 字段

| 属性 | 值 |
|------|-----|
| 类型 | list[StepDefinition] |
| 是否必填 | **是** |
| 最少步骤 | 1 |
| 执行顺序 | 从上到下，顺序执行 |

`steps` 是流水线的核心，列出所有需要执行的步骤。

---

## 4.8 步骤定义（`StepDefinition`）

每个步骤由以下字段组成：

### 4.8.1 `id` 字段（必填）

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 是否必填 | **是** |
| 格式规则 | `[a-z0-9_-]`，必须在流水线中唯一 |

步骤 ID 用于：
- 在其他步骤中引用该步骤的输出（`$step-id`）
- 在报告中标识步骤
- 在日志中追踪执行

```yaml
steps:
  - id: load-roads        # ✓ 正确：小写字母、连字符
  - id: buffer_zone       # ✓ 正确：下划线
  - id: step01            # ✓ 正确：数字
  # - id: Load Roads      # ✗ 错误：包含大写和空格
  # - id: 步骤1           # ✗ 错误：包含中文
```

**唯一性约束**：如果流水线中有两个步骤使用相同的 `id`，`validator.py` 会报 `PipelineValidationError`。

### 4.8.2 `use` 字段（必填）

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 格式 | `category.action` |
| 是否必填 | **是** |

`use` 指定步骤类型，格式为 `类别.操作`。如果指定了未注册的步骤，执行时会报 `StepNotFoundError`。

```yaml
use: io.read_vector         # IO 类别，读取矢量
use: vector.buffer          # 矢量类别，缓冲区
use: raster.clip            # 栅格类别，裁剪
use: analysis.voronoi       # 分析类别，泰森多边形
use: network.shortest_path  # 网络类别，最短路径
use: qc.geometry_validity   # 质检类别，几何有效性
```

### 4.8.3 `params` 字段

| 属性 | 值 |
|------|-----|
| 类型 | dict |
| 是否必填 | 否（部分步骤有必填参数） |
| 默认值 | `{}` |

`params` 是传给步骤函数的参数字典。参数值可以是：
- **字面量**：直接写值
- **变量引用**：`${var_name}`
- **步骤输出引用**：`$step-id` 或 `$step-id.attr`

```yaml
params:
  path: "data/roads.geojson"         # 字面量（字符串）
  distance: 500                       # 字面量（数字）
  preserve_topology: true             # 字面量（布尔）
  input: "$load-roads"               # 步骤输出引用
  distance: "${buffer_dist}"         # 变量引用
  target_crs: "EPSG:3857"           # 字面量（CRS 字符串）
```

### 4.8.4 `when` 字段（条件执行）

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 是否必填 | 否 |
| 默认值 | 无（始终执行） |

`when` 接受一个布尔表达式，可引用变量和步骤统计值：

```yaml
steps:
  - id: load
    use: io.read_vector
    params:
      path: "data/roads.geojson"

  # 只在数据量大于 1000 时才做简化
  - id: simplify
    use: vector.simplify
    when: "$load.stats.feature_count > 1000"
    params:
      input: "$load"
      tolerance: 0.001

  # 根据变量决定是否执行
  - id: save-debug
    use: io.write_vector
    when: "${enable_debug}"
    params:
      input: "$simplify"
      path: "debug/simplified.geojson"
      format: "GeoJSON"
```

详细的 `when` 表达式语法见第六章。

### 4.8.5 `on_error` 字段（错误策略）

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 可选值 | `fail` / `skip` / `retry` |
| 默认值 | `fail` |

| 策略 | 行为 |
|------|------|
| `fail` | 步骤失败时立即终止整个流水线（默认） |
| `skip` | 步骤失败时跳过该步骤，继续执行后续步骤 |
| `retry` | 最多重试 3 次，每次间隔 0.5 秒，全部失败则终止 |

```yaml
steps:
  - id: fetch-online-data
    use: io.read_vector
    on_error: retry        # 网络请求可能不稳定，自动重试
    params:
      path: "https://api.example.com/data.geojson"

  - id: optional-step
    use: vector.simplify
    on_error: skip         # 此步骤可选，失败不影响后续
    params:
      input: "$load"
      tolerance: 0.001
```

### 4.8.6 `backend` 字段

| 属性 | 值 |
|------|-----|
| 类型 | string |
| 可选值 | `native_python` / `gdal_cli` / `gdal_python` / `qgis_process` / `pyqgis` / `generic_cli` / `curl_api` |
| 默认值 | `native_python` |

```yaml
steps:
  - id: convert-format
    use: io.write_vector
    backend: gdal_cli          # 使用 GDAL CLI 后端
    params:
      input: "$load"
      path: "output/data.gpkg"
      format: "GPKG"
```

---

## 4.9 `outputs` 字段

| 属性 | 值 |
|------|-----|
| 类型 | dict |
| 是否必填 | 否 |
| 默认值 | `{}` |

`outputs` 声明流水线的最终输出，这些值会出现在 JSON 报告的 `outputs` 字段中。

```yaml
outputs:
  # 引用步骤输出数据
  final_data: "$save-result"

  # 引用步骤统计信息
  processing_stats: "$buffer.stats"

  # 引用步骤特定属性
  feature_count: "$load.stats.feature_count"

  # 引用 QC 问题列表
  quality_issues: "$qc-check.issues"
```

---

## 4.10 完整字段参考表

| 字段 | 级别 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| `pipeline` | 顶层 | object | **是** | - | 根键 |
| `pipeline.name` | 二级 | string | **是** | - | 流水线名称 |
| `pipeline.description` | 二级 | string | 否 | `""` | 流水线描述 |
| `pipeline.crs` | 二级 | string | 否 | `null` | 默认 CRS |
| `pipeline.variables` | 二级 | dict | 否 | `{}` | 变量定义 |
| `pipeline.steps` | 二级 | list | **是** | - | 步骤列表 |
| `pipeline.outputs` | 二级 | dict | 否 | `{}` | 输出声明 |
| `steps[].id` | 步骤 | string | **是** | - | 步骤唯一 ID |
| `steps[].use` | 步骤 | string | **是** | - | 步骤类型 |
| `steps[].params` | 步骤 | dict | 否 | `{}` | 步骤参数 |
| `steps[].when` | 步骤 | string | 否 | 无 | 执行条件 |
| `steps[].on_error` | 步骤 | string | 否 | `fail` | 错误策略 |
| `steps[].backend` | 步骤 | string | 否 | `native_python` | 执行后端 |

---

## 4.11 YAML 格式技巧

### 多行字符串

```yaml
pipeline:
  name: "多行示例"
  description: |
    这是第一行描述。
    这是第二行描述。
    可以包含换行。
```

### 注释

```yaml
pipeline:
  name: "有注释的流水线"
  steps:
    # 第一步：加载数据
    - id: load
      use: io.read_vector
      params:
        path: "data.geojson"  # 数据文件路径

    # 第二步：缓冲区分析
    - id: buffer
      use: vector.buffer
      params:
        input: "$load"
        distance: 100   # 单位：米（需要投影坐标系）
```

### 锚点与引用（减少重复）

```yaml
pipeline:
  name: "使用 YAML 锚点"

  # 定义锚点
  variables:
    common_crs: &target_crs "EPSG:3857"

  steps:
    - id: reproject-layer1
      use: vector.reproject
      params:
        input: "$load1"
        target_crs: *target_crs   # 使用锚点引用

    - id: reproject-layer2
      use: vector.reproject
      params:
        input: "$load2"
        target_crs: *target_crs   # 同一 CRS
```

---

## 4.12 常见格式错误

### 错误一：缺少 `pipeline:` 顶层键

```yaml
# ✗ 错误
name: "测试"
steps: []
```

```
PipelineParseError: 缺少必要的顶层键 'pipeline'
```

### 错误二：步骤 ID 包含非法字符

```yaml
# ✗ 错误
steps:
  - id: "Load Roads"    # 包含大写和空格
    use: io.read_vector
```

```
PipelineValidationError: 步骤 ID 'Load Roads' 不符合规范 [a-z0-9_-]
```

### 错误三：引用不存在的步骤

```yaml
# ✗ 错误
steps:
  - id: step-a
    use: io.read_vector
    params:
      path: "data.geojson"
  - id: step-b
    use: vector.buffer
    params:
      input: "$step-x"    # step-x 不存在！
      distance: 100
```

```
PipelineValidationError: 步骤 'step-b' 引用了不存在的步骤 'step-x'
```

### 错误四：重复的步骤 ID

```yaml
# ✗ 错误
steps:
  - id: load
    use: io.read_vector
    params:
      path: "data1.geojson"
  - id: load    # 重复！
    use: io.read_vector
    params:
      path: "data2.geojson"
```

```
PipelineValidationError: 发现重复的步骤 ID: 'load'
```

### 错误五：`on_error` 值不合法

```yaml
# ✗ 错误
steps:
  - id: step1
    use: io.read_vector
    on_error: ignore    # 不合法，应为 fail/skip/retry
```

```
PipelineValidationError: 步骤 'step1' 的 on_error 值 'ignore' 无效，应为 fail/skip/retry
```

---

## 4.13 本章小结

本章全面解析了 GeoPipeAgent YAML 流水线的格式规范：

1. **`pipeline:` 顶层键**：强制要求，缺少会报 `PipelineParseError`
2. **元数据字段**：`name`（必填）、`description`、`crs`
3. **`variables`**：定义可复用变量，CLI 可覆盖
4. **`steps`**：核心字段，包含 `id`、`use`、`params`、`when`、`on_error`、`backend`
5. **`outputs`**：声明流水线最终输出
6. **常见错误**：格式错误的早期诊断有助于快速修复

掌握这些格式规范后，你就能准确理解和编写任意复杂度的 GeoPipeAgent 流水线。

---

**导航**：[← 第三章：快速上手](03-快速上手第一个流水线) ｜ [第五章：变量系统与步骤引用 →](05-变量系统与步骤引用)

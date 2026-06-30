---
layout: default
title: "第四章：YAML 流水线格式完全解析"
---

# 第四章：YAML 流水线格式完全解析

GeoPipeAgent 使用 YAML 文件描述分析流水线。本章完整解析 YAML 格式的每一个字段，帮助你深刻理解流水线的结构规则。

---

## 4.1 顶层结构

所有 GeoPipeAgent 流水线 YAML 文件**必须**有一个顶层 `pipeline:` 键，所有流水线字段均嵌套在其下：

```yaml
pipeline:
  name: "流水线名称"           # 必填
  description: "流水线描述"    # 可选
  crs: "EPSG:4326"            # 可选，全局默认 CRS
  variables:                  # 可选，变量字典
    var_name: value
  steps:                      # 必填，步骤列表
    - id: step_id
      use: category.action
      params:
        key: value
      on_error: fail
      when: "条件表达式"
      backend: native_python
  outputs:                    # 可选，输出声明
    result: "$step_id"
```

> **常见错误**：忘记顶层 `pipeline:` 键。这会导致 `PipelineParseError: Missing 'pipeline' key at the top level`。

---

## 4.2 `pipeline.name`（必填）

流水线名称，字符串类型，出现在 JSON 执行报告的 `pipeline` 字段中。

```yaml
pipeline:
  name: "建筑物数据质检流水线"
```

**规范建议**：使用描述性名称，体现分析目的和数据类型。

---

## 4.3 `pipeline.description`（可选）

流水线的详细描述，字符串类型，用于说明分析目的、数据来源、输出格式等。

```yaml
pipeline:
  name: "NDVI 计算"
  description: "读取多光谱影像，使用波段4（近红外）和波段3（红）计算 NDVI，输出为 GeoTIFF"
```

---

## 4.4 `pipeline.crs`（可选）

全局默认坐标参考系，EPSG 代码字符串（如 `"EPSG:4326"`）。当步骤没有指定 CRS 时，可参考该值。

```yaml
pipeline:
  name: "全国城市分析"
  crs: "EPSG:4326"
```

> **注意**：`crs` 字段目前是元数据性质，不会自动对步骤进行投影转换。需要转换坐标系时，仍需显式使用 `vector.reproject` 或 `raster.reproject` 步骤。

---

## 4.5 `pipeline.variables`（可选）

变量字典，定义可在步骤参数中复用的值。支持字符串、数字、布尔值等类型。

```yaml
pipeline:
  variables:
    input_path: "data/buildings.shp"
    buffer_dist: 100
    output_format: "GeoJSON"
    simplify_tolerance: 0.001
    enable_qc: true
```

变量通过 `${变量名}` 语法引用（详见第五章）。`--var` 命令行参数可在运行时覆盖变量值。

**变量值的类型规则**：
- 当整个参数值是单一 `${var}` 引用时，值的类型等于变量的原始类型（数字仍是数字）
- 当变量嵌入字符串中（如 `"path/${var}.geojson"`）时，变量被转为字符串拼接

---

## 4.6 `pipeline.steps`（必填）

步骤列表，是流水线的核心，定义分析工作流。步骤按列表顺序依次执行。

```yaml
pipeline:
  steps:
    - id: step-1
      use: io.read_vector
      params: { path: "data/input.shp" }

    - id: step-2
      use: vector.buffer
      params: { input: "$step-1", distance: 100 }
```

### 4.6.1 步骤字段详解

每个步骤都是一个包含以下字段的 YAML 映射：

#### `id`（必填）

步骤的唯一标识符。规则：
- 只允许小写字母、数字、下划线、连字符：`[a-z0-9_-]`
- **不允许**包含点号（`.`），因为点号用于属性访问（`$step-id.attr`）
- 在同一流水线中必须唯一
- 推荐使用描述性 ID（`load-roads`、`buffer-500m`）而非无意义缩写（`s1`、`step2`）

```yaml
- id: check-geometry     # ✅ 合法
- id: load_buildings     # ✅ 合法
- id: step1              # ✅ 合法但不推荐
- id: vector.buffer      # ❌ 不合法（含点号）
- id: Load Roads         # ❌ 不合法（含空格和大写）
```

#### `use`（必填）

步骤类型，即步骤注册 ID，格式为 `类别.动作`。完整步骤 ID 列表见第七章至第十二章。

```yaml
use: io.read_vector
use: vector.buffer
use: qc.geometry_validity
```

#### `params`（可选/通常必填）

步骤参数，键值对映射。不同步骤有不同的参数规范。参数值可使用变量替换 `${var}` 和步骤引用 `$step-id`。

```yaml
params:
  input: "$load-roads"        # 步骤引用
  distance: "${buffer_dist}"  # 变量替换
  cap_style: "round"          # 直接值
```

#### `on_error`（可选）

步骤失败时的处理策略，默认 `fail`：

| 值 | 行为 |
|----|------|
| `fail` | 立即终止流水线（默认） |
| `skip` | 跳过该步骤，继续执行后续步骤 |
| `retry` | 自动重试最多 3 次（每次间隔递增：0.5s、1s、1.5s） |

```yaml
- id: fetch-remote
  use: network.geocode
  params: { address: "北京市海淀区" }
  on_error: retry      # 网络请求失败时重试

- id: optional-simplify
  use: vector.simplify
  params: { input: "$load-data", tolerance: 10 }
  on_error: skip       # 简化失败时跳过，不影响后续步骤
```

#### `when`（可选）

条件执行表达式。只有当 `when` 表达式求值为 `True` 时，步骤才会执行；否则步骤状态为 `skipped`，输出为空 `StepResult`。

```yaml
- id: fix-geometry
  use: qc.geometry_validity
  params:
    input: "$load-data"
    auto_fix: true
  when: "$check-geometry.issues_count > 0"   # 仅当存在几何问题时才修复
```

`when` 表达式支持：
- 步骤属性引用：`$step_id.attr`（如 `$check.issues_count`）
- 变量引用：`${var_name}`（如 `${enable_fix}`）
- 比较运算：`==`、`!=`、`>`、`<`、`>=`、`<=`
- 逻辑运算：`and`、`or`、`not`

> **安全性**：`when` 表达式通过 `safe_eval.py` 的 AST 白名单机制求值，防止任意代码执行。

#### `backend`（可选）

指定步骤使用的执行后端。不指定时使用该步骤的默认后端（通常是 `native_python`）。

```yaml
- id: convert-format
  use: vector.reproject
  params:
    input: "$load-data"
    target_crs: "EPSG:3857"
  backend: gdal_cli    # 使用 GDAL CLI 后端而非 native_python
```

---

## 4.7 `pipeline.outputs`（可选）

声明流水线的输出引用，这些值会出现在 JSON 报告的 `outputs` 节中，便于下游系统提取结果。

```yaml
outputs:
  final_data: "$save-result"           # 引用步骤输出（文件路径或 GeoDataFrame 摘要）
  stats: "$buffer.stats"               # 引用步骤统计信息
  issue_count: "$check-geo.issues_count"  # 引用 QC 步骤的问题数量
```

---

## 4.8 完整 YAML 示例（带所有字段）

```yaml
pipeline:
  name: "建筑物数据标准化处理"
  description: "对建筑物矢量数据进行投影转换、几何检查、属性质检，输出标准化结果"
  crs: "EPSG:4326"

  variables:
    input_path: "data/buildings.shp"
    target_crs: "EPSG:4549"         # CGCS2000 / 3-degree Gauss-Kruger zone
    output_path: "output/buildings_std.geojson"
    required_fields: ["name", "height", "type"]

  steps:
    - id: load-data
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: check-crs
      use: qc.crs_check
      params:
        input: "$load-data"
        expected_crs: "EPSG:4326"
      on_error: skip

    - id: check-geometry
      use: qc.geometry_validity
      params:
        input: "$load-data"
        auto_fix: false
        severity: "error"

    - id: fix-geometry
      use: qc.geometry_validity
      params:
        input: "$load-data"
        auto_fix: true
      when: "$check-geometry.issues_count > 0"
      on_error: skip

    - id: reproject
      use: vector.reproject
      params:
        input: "$load-data"
        target_crs: "${target_crs}"

    - id: check-attrs
      use: qc.attribute_completeness
      params:
        input: "$reproject"
        required_fields: "${required_fields}"
        severity: "warning"
      on_error: skip

    - id: save-result
      use: io.write_vector
      params:
        input: "$reproject"
        path: "${output_path}"
        format: "GeoJSON"

  outputs:
    result: "$save-result"
    geometry_issues: "$check-geometry.issues_count"
    attribute_issues: "$check-attrs.issues_count"
```

---

## 4.9 YAML 格式常见错误

### 错误 1：缺少顶层 `pipeline:` 键

```yaml
# ❌ 错误写法
name: "我的流水线"
steps:
  - id: load
    use: io.read_vector
    ...

# ✅ 正确写法
pipeline:
  name: "我的流水线"
  steps:
    - id: load
      use: io.read_vector
      ...
```

### 错误 2：步骤 ID 包含点号

```yaml
# ❌ 错误：点号是属性访问分隔符
- id: io.load        # 错误

# ✅ 正确
- id: io-load        # 使用连字符
- id: load_data      # 或下划线
```

### 错误 3：引用不存在的步骤

```yaml
steps:
  - id: load-data
    use: io.read_vector
    params: { path: "data.shp" }

  - id: buffer
    use: vector.buffer
    params:
      input: "$load_data"   # ❌ 错误：ID 是 load-data，不是 load_data
      distance: 100

  # ✅ 正确
  - id: buffer-2
    use: vector.buffer
    params:
      input: "$load-data"   # 正确引用
      distance: 100
```

### 错误 4：变量未定义就引用

```yaml
pipeline:
  steps:
    - id: load
      use: io.read_vector
      params:
        path: "${data_path}"   # ❌ 如果 variables 中没有 data_path 定义，运行时报错

# 解决方案：在 variables 中定义，或通过 --var 传入
pipeline:
  variables:
    data_path: "data/input.shp"   # ✅
```

---

## 4.10 本章小结

本章完整解析了 YAML 流水线格式：

1. **顶层 `pipeline:` 键**：必须存在，所有字段在其下
2. **`steps` 列表**：流水线核心，每个步骤有 `id`、`use`、`params` 等字段
3. **`on_error`**：`fail`/`skip`/`retry` 三种错误策略
4. **`when`**：基于安全 AST 求值的条件执行
5. **`backend`**：步骤级别的后端指定
6. **`outputs`**：声明流水线输出，便于下游处理

下一章将深入讲解变量系统与步骤引用的工作原理。

---

**导航**：[← 第三章：快速上手](../第03章-快速上手) ｜ [第五章：变量与步骤引用 →](../第05章-变量与步骤引用)

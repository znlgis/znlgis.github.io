---
layout: default
title: 第四章：YAML 流水线格式详解
---

# 第四章：YAML 流水线格式详解

## 4.1 流水线总体结构

GeoPipeAgent 的流水线使用 YAML 格式定义，所有内容必须包裹在顶层的 `pipeline` 键下。一个完整的流水线定义包含以下字段：

```yaml
pipeline:
  name: "流水线名称"           # 必填：流水线名称
  description: "流水线描述"    # 可选：流水线描述
  crs: "EPSG:4326"           # 可选：默认坐标参考系
  variables:                  # 可选：变量定义
    var_name: value
  steps:                      # 必填：步骤列表
    - id: step-id
      use: category.action
      params:
        key: value
  outputs:                    # 可选：输出声明
    result: "$step-id"
```

### 4.1.1 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `pipeline` | 映射 | 顶层键，包含流水线定义 |
| `pipeline.steps` | 列表 | 非空的步骤定义列表 |
| `steps[].id` | 字符串 | 步骤唯一标识符 |
| `steps[].use` | 字符串 | 步骤类型（注册 ID） |

### 4.1.2 可选字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pipeline.name` | 字符串 | "Unnamed Pipeline" | 流水线名称 |
| `pipeline.description` | 字符串 | "" | 流水线描述 |
| `pipeline.crs` | 字符串 | null | 默认 CRS |
| `pipeline.variables` | 映射 | {} | 变量定义 |
| `pipeline.outputs` | 映射 | {} | 输出声明 |
| `steps[].params` | 映射 | {} | 步骤参数 |
| `steps[].when` | 字符串 | null | 条件表达式 |
| `steps[].on_error` | 字符串 | "fail" | 错误策略 |
| `steps[].backend` | 字符串 | null | 指定后端 |

## 4.2 步骤定义详解

### 4.2.1 步骤 ID 规则

步骤 ID 必须遵循以下规则：

- 只允许小写字母、数字、下划线和连字符：`[a-z0-9_-]`
- **不允许使用点号（`.`）**——点号保留给输出引用语法（`$step_id.attr`）
- 在同一个流水线中必须唯一
- 不能为空

合法的步骤 ID 示例：

```yaml
- id: load-data          # ✅ 使用连字符
- id: step_1             # ✅ 使用下划线
- id: reproject2d        # ✅ 字母和数字
```

非法的步骤 ID 示例：

```yaml
- id: load.data          # ❌ 不允许点号
- id: Load-Data          # ❌ 不允许大写字母
- id: ""                 # ❌ 不能为空
```

### 4.2.2 步骤类型（use）

`use` 字段指定要使用的步骤类型，格式为 `category.action`：

| 类别 | 示例 |
|------|------|
| io | `io.read_vector`、`io.write_vector`、`io.read_raster`、`io.write_raster` |
| vector | `vector.buffer`、`vector.clip`、`vector.reproject`、`vector.dissolve`、`vector.simplify`、`vector.query`、`vector.overlay` |
| raster | `raster.reproject`、`raster.clip`、`raster.calc`、`raster.stats`、`raster.contour` |
| analysis | `analysis.voronoi`、`analysis.heatmap`、`analysis.interpolate`、`analysis.cluster` |
| network | `network.shortest_path`、`network.service_area`、`network.geocode` |
| qc | `qc.geometry_validity`、`qc.crs_check`、`qc.topology` 等 10 个 |

### 4.2.3 步骤参数（params）

`params` 是一个键值映射，传递给步骤函数的参数。参数值可以是：

- **字面量**：字符串、数字、布尔值、列表、映射
- **变量引用**：`${var_name}`
- **步骤引用**：`$step_id` 或 `$step_id.attr`

```yaml
params:
  path: "data/roads.shp"           # 字符串字面量
  distance: 500                     # 数字字面量
  auto_fix: true                    # 布尔字面量
  required_fields: ["name", "type"] # 列表字面量
  input: "$load-data"               # 步骤引用
  output_path: "${output_dir}/result.geojson"  # 变量引用
```

## 4.3 变量系统

### 4.3.1 变量定义

在 `pipeline.variables` 中定义变量：

```yaml
pipeline:
  variables:
    input_path: "data/roads.shp"
    buffer_dist: 500
    output_format: "GeoJSON"
    enable_simplify: true
```

变量值可以是任意 YAML 类型：字符串、数字、布尔值等。

### 4.3.2 变量引用语法

使用 `${var_name}` 语法引用变量：

```yaml
steps:
  - id: load
    use: io.read_vector
    params:
      path: "${input_path}"           # → "data/roads.shp"

  - id: buffer
    use: vector.buffer
    params:
      input: "$load"
      distance: "${buffer_dist}"      # → 500（保持原始类型）
```

**类型保持规则**：

- 如果整个参数值就是一个 `${var}` 引用，则保持变量的原始类型（如数字、布尔值）
- 如果 `${var}` 嵌入在字符串中（如 `"output/${name}.geojson"`），则执行字符串插值

### 4.3.3 命令行变量覆盖

可以通过 `--var` 选项在命令行覆盖流水线中定义的变量：

```bash
geopipe-agent run pipeline.yaml --var input_path=new_data.shp --var buffer_dist=1000
```

## 4.4 步骤引用系统

### 4.4.1 基本引用

使用 `$step_id` 引用前一个步骤的输出（等价于 `$step_id.output`）：

```yaml
steps:
  - id: load
    use: io.read_vector
    params:
      path: "data/roads.shp"

  - id: buffer
    use: vector.buffer
    params:
      input: "$load"              # 引用 load 步骤的 output
      distance: 500
```

### 4.4.2 属性引用

使用 `$step_id.attr` 引用步骤结果的具体属性：

```yaml
steps:
  - id: load
    use: io.read_vector
    params:
      path: "data/roads.shp"

  - id: check
    use: qc.geometry_validity
    params:
      input: "$load.output"       # 显式引用 output 属性

  - id: save-issues
    use: io.write_vector
    params:
      input: "$check.issues_gdf"  # 引用 issues_gdf 属性
    when: "$check.issues_count > 0"  # 引用 issues_count 属性
```

可引用的属性包括：

| 属性 | 说明 |
|------|------|
| `output` | 步骤的主输出数据（默认） |
| `stats` 中的键 | 步骤统计信息中的任意键 |
| `metadata` 中的键 | 步骤元数据中的任意键 |

### 4.4.3 引用验证

引用会在流水线校验阶段被检查：

- 引用的步骤必须存在且在当前步骤之前定义
- 引用的变量必须在 `variables` 中定义
- 前向引用（引用后面定义的步骤）会导致校验失败

## 4.5 条件执行

### 4.5.1 when 表达式

使用 `when` 字段定义条件表达式，只有表达式为真时步骤才会执行：

```yaml
- id: fix-geometries
  use: qc.geometry_validity
  params:
    input: "$data"
    auto_fix: true
  when: "$check.issues_count > 0"  # 仅当存在问题时执行
```

### 4.5.2 支持的表达式语法

- **比较运算**：`==`、`!=`、`>`、`<`、`>=`、`<=`
- **布尔运算**：`and`、`or`、`not`
- **变量引用**：`${var_name}`
- **步骤引用**：`$step_id.attr`
- **真值检查**：`$step_id.output`（非空则为真）

示例：

```yaml
# 变量条件
when: "${enable_simplify} == true"

# 步骤结果条件
when: "$check.issues_count > 0"

# 组合条件
when: "$check.issues_count > 0 and ${auto_fix} == true"
```

### 4.5.3 安全评估

`when` 表达式的评估采用 AST 白名单机制：

1. 将表达式中的变量和引用替换为实际值
2. 使用 `ast.parse()` 解析为 AST
3. 验证 AST 只包含安全节点（比较、布尔运算、常量等）
4. 在受限命名空间中执行（`__builtins__` 为空）

不安全的表达式会被拒绝并视为 `False`。

## 4.6 错误处理策略

### 4.6.1 on_error 选项

每个步骤可以通过 `on_error` 字段指定错误处理策略：

| 值 | 行为 | 适用场景 |
|----|------|----------|
| `fail`（默认） | 步骤失败则终止整个流水线 | 关键步骤 |
| `skip` | 步骤失败则跳过，继续后续步骤 | 可选步骤 |
| `retry` | 自动重试（最多 3 次，带退避延迟） | 网络请求等不稳定操作 |

### 4.6.2 示例

```yaml
steps:
  # 关键步骤：失败则终止
  - id: load-data
    use: io.read_vector
    params:
      path: "${input_path}"
    on_error: fail

  # 可选步骤：失败则跳过
  - id: simplify
    use: vector.simplify
    params:
      input: "$load-data"
      tolerance: 10
    on_error: skip

  # 网络步骤：失败自动重试
  - id: geocode
    use: network.geocode
    params:
      address: "北京市天安门"
    on_error: retry
```

### 4.6.3 retry 机制详解

当 `on_error: retry` 时：

- 最多重试 3 次（`_MAX_RETRIES = 3`）
- 每次重试间隔递增（`0.5 * attempt` 秒）
- 第 1 次失败：等待 0.5 秒后重试
- 第 2 次失败：等待 1.0 秒后重试
- 第 3 次失败：抛出异常

## 4.7 后端指定

### 4.7.1 步骤级后端指定

可以在步骤级别指定使用的后端：

```yaml
- id: buffer-with-gdal
  use: vector.buffer
  params:
    input: "$data"
    distance: 500
  backend: gdal_cli          # 使用 GDAL CLI 后端
```

### 4.7.2 后端选择优先级

1. 步骤级 `backend` 字段指定的后端
2. `BackendManager` 自动选择的第一个可用后端

## 4.8 输出声明

### 4.8.1 outputs 字段

`pipeline.outputs` 用于声明流水线的最终输出：

```yaml
pipeline:
  outputs:
    result: "$save"                  # 引用 save 步骤的输出
    stats: "$buffer.stats"           # 引用 buffer 步骤的统计信息
    issues: "$check.issues_gdf"      # 引用质检步骤的问题数据
```

输出会包含在执行报告的 `outputs` 字段中。

## 4.9 解析流程源码分析

GeoPipeAgent 的 YAML 解析由 `engine/parser.py` 负责，核心流程为：

1. **加载 YAML**：使用 `yaml.safe_load()` 安全加载 YAML 内容
2. **提取 pipeline 键**：验证顶层必须包含 `pipeline` 键
3. **解析流水线元数据**：提取 `name`、`description`、`crs`、`variables`、`outputs`
4. **解析步骤列表**：遍历 `steps` 列表，为每个步骤创建 `StepDefinition` 对象
5. **返回 PipelineDefinition**：组装为完整的流水线定义对象

解析器会进行基本的格式检查：
- `pipeline` 必须存在且为映射
- `steps` 必须存在且为非空列表
- 每个步骤必须有 `id` 和 `use` 字段

## 4.10 完整示例

以下是一个包含所有特性的完整流水线示例：

```yaml
pipeline:
  name: "综合矢量分析"
  description: "展示 GeoPipeAgent 所有流水线特性的综合示例"
  crs: "EPSG:4326"

  variables:
    input_path: "data/buildings.shp"
    buffer_dist: 200
    output_dir: "output"
    enable_qc: true
    simplify_tolerance: 5

  steps:
    # 1. 读取数据
    - id: load-data
      use: io.read_vector
      params:
        path: "${input_path}"

    # 2. 投影转换
    - id: reproject
      use: vector.reproject
      params:
        input: "$load-data"
        target_crs: "EPSG:3857"

    # 3. 缓冲区分析（使用 GDAL 后端）
    - id: buffer
      use: vector.buffer
      params:
        input: "$reproject"
        distance: "${buffer_dist}"
        cap_style: "round"
      backend: native_python

    # 4. 条件简化
    - id: simplify
      use: vector.simplify
      params:
        input: "$buffer"
        tolerance: "${simplify_tolerance}"
      when: "${simplify_tolerance} > 0"

    # 5. 可选质检（失败则跳过）
    - id: check-geometry
      use: qc.geometry_validity
      params:
        input: "$simplify"
        auto_fix: false
      when: "${enable_qc} == true"
      on_error: skip

    # 6. 保存结果
    - id: save
      use: io.write_vector
      params:
        input: "$simplify"
        path: "${output_dir}/result.geojson"
        format: "GeoJSON"

  outputs:
    result: "$save"
    buffer_stats: "$buffer.stats"
```

## 4.11 本章小结

本章详细介绍了 GeoPipeAgent 的 YAML 流水线格式，包括顶层结构、步骤定义、变量系统、引用机制、条件执行、错误处理策略和后端指定等核心概念。流水线的 YAML 格式设计遵循声明式原则，使得 AI 可以轻松生成和理解分析流程。下一章将深入探讨变量系统与引用机制的内部实现。

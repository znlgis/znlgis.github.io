---
layout: default
title: "第四章：YAML 流水线定义详解"
---

# 第四章：YAML 流水线定义详解

> 本章全面讲解 GeoPipeAgent YAML 流水线的完整语法规范，包括顶层结构、步骤定义、参数类型、输出声明以及多个完整示例，帮助你掌握流水线编写的所有细节。

---

## 4.1 YAML 流水线顶层结构

每个 GeoPipeAgent 流水线都是一个以 `pipeline` 为根键的 YAML 文件。以下是完整的顶层结构示意：

```yaml
pipeline:
  name: <string>                    # 必填：流水线名称
  description: <string>             # 可选：流水线描述
  crs: <string>                     # 可选：全局坐标参考系统
  variables: <map>                  # 可选：变量定义
  steps: <list>                     # 必填：步骤列表
  outputs: <map>                    # 可选：声明输出
```

### 4.1.1 各字段详细说明

#### `pipeline.name` — 流水线名称

| 属性 | 值 |
|------|-----|
| **类型** | string |
| **必填** | 是 |
| **约束** | 建议使用 snake_case，仅包含 `[a-z0-9_-]` |
| **用途** | 标识流水线，出现在报告和日志中 |

```yaml
pipeline:
  name: urban_buffer_analysis     # ✅ 推荐
  name: UrbanBufferAnalysis       # ⚠️ 可用但不推荐
  name: "my analysis - v2"        # ⚠️ 包含特殊字符需加引号
```

#### `pipeline.description` — 流水线描述

| 属性 | 值 |
|------|-----|
| **类型** | string |
| **必填** | 否 |
| **默认值** | 空字符串 `""` |
| **用途** | 描述流水线的目的和功能，出现在报告中 |

```yaml
pipeline:
  name: buffer_analysis
  description: >
    对城市建筑物图层进行 500 米缓冲区分析，
    并检查几何有效性，最终输出为 GeoPackage 格式。
```

YAML 的 `>` 折叠多行文本为单行，`|` 保留换行。

#### `pipeline.crs` — 全局坐标参考系统

| 属性 | 值 |
|------|-----|
| **类型** | string |
| **必填** | 否 |
| **默认值** | `null`（由输入数据决定） |
| **格式** | EPSG 代码（如 `"EPSG:4326"`）或 PROJ 字符串 |
| **用途** | 设置全局默认 CRS，可被步骤级参数覆盖 |

```yaml
pipeline:
  name: analysis
  crs: "EPSG:4326"          # WGS 84 经纬度
  # crs: "EPSG:3857"        # Web Mercator
  # crs: "EPSG:4490"        # CGCS2000
  # crs: "EPSG:32650"       # WGS 84 / UTM zone 50N
```

常用坐标系速查：

| CRS 代码 | 名称 | 适用场景 |
|-----------|------|----------|
| `EPSG:4326` | WGS 84 | 全球通用，经纬度 |
| `EPSG:3857` | Web Mercator | Web 地图，平面米 |
| `EPSG:4490` | CGCS2000 | 中国国家标准 |
| `EPSG:4547` | CGCS2000 / 3° Zone 39 | 中国局部高精度 |
| `EPSG:32650` | WGS 84 / UTM Zone 50N | 东亚 UTM 分区 |

#### `pipeline.variables` — 变量定义

| 属性 | 值 |
|------|-----|
| **类型** | map (key-value pairs) |
| **必填** | 否 |
| **默认值** | `{}` |
| **用途** | 定义可复用的变量，支持 CLI 覆盖 |

```yaml
pipeline:
  name: analysis
  variables:
    # 字符串变量
    input_file: "data/buildings.shp"
    output_dir: "output"
    target_crs: "EPSG:3857"
    
    # 数值变量
    buffer_distance: 500
    min_area: 100.5
    
    # 布尔变量
    run_qc: true
    skip_reproject: false
    
    # 列表变量
    fields_to_keep:
      - name
      - area
      - type
    
    # 嵌套字典变量
    filter_config:
      min_height: 10
      max_height: 200
      types:
        - residential
        - commercial
```

变量在步骤参数中通过 `${var_name}` 语法引用：

```yaml
  steps:
    - id: load
      use: io.read_vector
      params:
        path: "${input_file}"    # 引用变量
    - id: buffer
      use: vector.buffer
      params:
        input: $load
        distance: ${buffer_distance}  # 引用数值变量
```

#### `pipeline.steps` — 步骤列表

| 属性 | 值 |
|------|-----|
| **类型** | list of step definitions |
| **必填** | 是 |
| **约束** | 至少包含一个步骤 |
| **用途** | 定义流水线的所有执行步骤 |

步骤列表是流水线的核心，按定义顺序依次执行。详见 4.2 节。

#### `pipeline.outputs` — 输出声明

| 属性 | 值 |
|------|-----|
| **类型** | map (key → step reference) |
| **必填** | 否 |
| **默认值** | `{}` |
| **用途** | 声明流水线的最终输出，出现在报告的 outputs 字段中 |

```yaml
pipeline:
  name: analysis
  steps:
    - id: result
      use: vector.buffer
      params: ...
    - id: qc
      use: qc.geometry_validity
      params: ...
  outputs:
    buffer_result: $result          # 引用步骤输出
    quality_report: $qc             # 引用 QC 结果
    feature_count: $result.stats    # 引用步骤统计信息
```

---

## 4.2 Step 步骤定义

每个步骤是一个字典，定义了一个要执行的操作。

### 4.2.1 步骤完整 Schema

```yaml
- id: <string>              # 必填：步骤唯一标识
  use: <string>             # 必填：步骤类型（category.action）
  params: <map>             # 可选：步骤参数
  when: <string>            # 可选：条件表达式
  on_error: <string>        # 可选：错误处理策略
  backend: <string>         # 可选：指定执行后端
```

### 4.2.2 各字段详细说明

#### `id` — 步骤标识

| 属性 | 值 |
|------|-----|
| **类型** | string |
| **必填** | 是 |
| **格式** | `[a-z][a-z0-9_-]*` |
| **约束** | 在流水线内必须唯一 |
| **用途** | 标识步骤，用于引用和日志 |

```yaml
# ✅ 合法的 ID
- id: load_data
- id: step-1
- id: create_buffer_500m
- id: qc-check

# ❌ 不合法的 ID
- id: LoadData        # 不允许大写字母
- id: 1_step          # 不能以数字开头
- id: my step         # 不允许空格
- id: step.one        # 不允许点号
```

#### `use` — 步骤类型

| 属性 | 值 |
|------|-----|
| **类型** | string |
| **必填** | 是 |
| **格式** | `category.action`（如 `vector.buffer`） |
| **约束** | 必须是已注册的步骤名称 |

```yaml
# 步骤类型命名规则：category.action
- id: load
  use: io.read_vector         # 类别: io, 动作: read_vector

- id: buf
  use: vector.buffer           # 类别: vector, 动作: buffer

- id: stats
  use: raster.zonal_stats      # 类别: raster, 动作: zonal_stats

- id: join
  use: analysis.spatial_join   # 类别: analysis, 动作: spatial_join

- id: path
  use: network.shortest_path   # 类别: network, 动作: shortest_path

- id: check
  use: qc.geometry_validity    # 类别: qc, 动作: geometry_validity
```

当前支持的完整步骤类别和步骤列表：

| 类别 | 步骤名称 | 描述 |
|------|----------|------|
| **io** | `io.read_vector` | 读取矢量数据（Shapefile, GeoPackage, GeoJSON 等） |
| | `io.write_vector` | 写入矢量数据 |
| | `io.read_raster` | 读取栅格数据（GeoTIFF, JPEG 等） |
| | `io.write_raster` | 写入栅格数据 |
| **vector** | `vector.buffer` | 缓冲区分析 |
| | `vector.clip` | 矢量裁剪 |
| | `vector.union` | 矢量联合 |
| | `vector.intersection` | 矢量求交 |
| | `vector.dissolve` | 矢量融合 |
| | `vector.filter` | 属性/空间过滤 |
| | `vector.reproject` | 坐标系转换 |
| | `vector.simplify` | 几何简化 |
| | `vector.centroid` | 质心计算 |
| | `vector.merge` | 多图层合并 |
| **raster** | `raster.clip` | 栅格裁剪 |
| | `raster.reproject` | 栅格重投影 |
| | `raster.zonal_stats` | 分区统计 |
| | `raster.reclassify` | 栅格重分类 |
| | `raster.hillshade` | 山体阴影 |
| | `raster.slope` | 坡度分析 |
| | `raster.aspect` | 坡向分析 |
| **analysis** | `analysis.spatial_join` | 空间连接 |
| | `analysis.hotspot` | 热点分析 |
| | `analysis.interpolation` | 空间插值 |
| | `analysis.density` | 密度分析 |
| | `analysis.overlay` | 叠置分析 |
| | `analysis.voronoi` | 泰森多边形 |
| **network** | `network.shortest_path` | 最短路径分析 |
| | `network.service_area` | 服务区分析 |
| | `network.isochrone` | 等时线分析 |
| | `network.geocode` | 地理编码 |
| **qc** | `qc.geometry_validity` | 几何有效性检查 |
| | `qc.attribute_check` | 属性检查 |
| | `qc.topology_check` | 拓扑检查 |
| | `qc.crs_consistency` | CRS 一致性检查 |

#### `params` — 步骤参数

| 属性 | 值 |
|------|-----|
| **类型** | map (key-value pairs) |
| **必填** | 否（取决于步骤定义） |
| **默认值** | `{}` |

参数值可以是：

- **字面值**：字符串、数字、布尔、列表、字典
- **步骤引用**：`$step_id` 或 `$step_id.attr`
- **变量引用**：`${var_name}`
- **混合引用**：`"${output_dir}/result.gpkg"`

```yaml
params:
  # 字面值
  path: "data/buildings.shp"
  distance: 500
  resolution: 16
  preserve_topology: true
  
  # 步骤引用
  input: $load_data                    # 引用步骤输出
  clip_bounds: $boundary.output        # 引用步骤的特定属性
  
  # 变量引用
  target_crs: ${target_crs}           # 引用变量
  output_path: "${output_dir}/result.gpkg"  # 变量嵌入字符串
  
  # 列表
  fields:
    - name
    - area
    - type
  
  # 嵌套字典
  rules:
    - type: no_self_intersection
      severity: error
    - type: minimum_area
      value: 10
      severity: warning
```

#### `when` — 条件执行

| 属性 | 值 |
|------|-----|
| **类型** | string (expression) |
| **必填** | 否 |
| **默认值** | `null`（总是执行） |
| **用途** | 控制步骤是否执行 |

```yaml
# 基于变量的条件
- id: reproject
  use: vector.reproject
  params:
    input: $load_data
    target_crs: ${target_crs}
  when: "not skip_reproject"          # 变量为 false 时执行

# 基于前置步骤结果的条件
- id: fix_geometry
  use: vector.fix_geometry
  params:
    input: $load_data
  when: "check_geom.stats.invalid_features > 0"  # QC 发现问题时执行

# 复合条件
- id: detailed_qc
  use: qc.topology_check
  params:
    input: $processed
  when: "run_qc and load_data.stats.feature_count > 100"

# 比较操作
- id: simplify
  use: vector.simplify
  params:
    input: $buffer_result
    tolerance: 10
  when: "buffer_result.stats.feature_count > 10000"
```

条件表达式支持的操作符：

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `==` | 等于 | `status == "success"` |
| `!=` | 不等于 | `count != 0` |
| `>` | 大于 | `feature_count > 100` |
| `>=` | 大于等于 | `area >= 500` |
| `<` | 小于 | `error_count < 10` |
| `<=` | 小于等于 | `percentage <= 0.05` |
| `and` | 逻辑与 | `a > 0 and b > 0` |
| `or` | 逻辑或 | `a == 0 or b == 0` |
| `not` | 逻辑非 | `not skip_step` |
| `in` | 包含 | `"error" in severity` |

#### `on_error` — 错误处理策略

| 属性 | 值 |
|------|-----|
| **类型** | string |
| **必填** | 否 |
| **默认值** | `"fail"` |
| **可选值** | `"fail"`, `"skip"` |

```yaml
# 默认行为：步骤失败则终止整个流水线
- id: critical_step
  use: io.read_vector
  params:
    path: "important.shp"
  on_error: fail                     # 默认值

# 失败时跳过，继续执行后续步骤
- id: optional_qc
  use: qc.topology_check
  params:
    input: $data
  on_error: skip                     # 失败不影响后续步骤
```

两种策略的行为对比：

| 策略 | 步骤失败时 | 后续步骤 | 流水线状态 | 报告中 |
|------|-----------|----------|-----------|--------|
| `fail` | 立即终止流水线 | 不执行 | `failed` | `status: "error"` |
| `skip` | 记录错误，继续 | 正常执行 | 取决于后续 | `status: "error"` |

#### `backend` — 指定后端

| 属性 | 值 |
|------|-----|
| **类型** | string |
| **必填** | 否 |
| **默认值** | `null`（使用默认后端） |
| **可选值** | `native_python`, `gdal_cli`, `gdal_python`, `qgis_process`, `pyqgis`, `generic_cli`, `curl_api` |

```yaml
# 使用默认后端（native_python）
- id: buffer
  use: vector.buffer
  params:
    input: $data
    distance: 500

# 指定使用 GDAL CLI 后端
- id: reproject
  use: vector.reproject
  params:
    input: $data
    target_crs: "EPSG:3857"
  backend: gdal_cli                  # 使用 ogr2ogr

# 指定使用 QGIS 后端
- id: dissolve
  use: vector.dissolve
  params:
    input: $data
    by: "type"
  backend: qgis_process              # 使用 qgis_process
```

---

## 4.3 命名规则

GeoPipeAgent 对各类标识符有明确的命名规则。

### 4.3.1 步骤 ID 命名规则

```
规则：[a-z][a-z0-9_-]*
```

| 要求 | 说明 | 示例 |
|------|------|------|
| 以小写字母开头 | 不能以数字、下划线或连字符开头 | `load_data` ✅, `1_step` ❌ |
| 仅包含小写字母、数字、下划线、连字符 | 不允许大写、空格、点号 | `step-1` ✅, `Step.1` ❌ |
| 流水线内唯一 | 不允许重复 ID | — |
| 建议使用语义化命名 | 名称应描述步骤的功能 | `create_500m_buffer` ✅ |

**推荐命名模式：**

```yaml
# 动词_名词 模式
- id: load_buildings
- id: create_buffer
- id: check_geometry
- id: save_result

# 动词_修饰词_名词 模式
- id: read_raw_parcels
- id: filter_large_buildings
- id: compute_road_density

# 带数字的顺序步骤
- id: process-step-1
- id: process-step-2

# QC 步骤
- id: qc-geometry
- id: qc-attributes
- id: qc-topology
```

### 4.3.2 步骤类型（use）命名规则

```
规则：category.action
```

| 组成部分 | 规则 | 示例 |
|----------|------|------|
| `category` | 小写字母，代表功能类别 | `io`, `vector`, `raster`, `analysis`, `network`, `qc` |
| `.` | 分隔符 | — |
| `action` | 小写字母+下划线，代表具体操作 | `read_vector`, `buffer`, `spatial_join` |

### 4.3.3 变量命名规则

```
规则：[a-zA-Z_][a-zA-Z0-9_]*
```

```yaml
variables:
  # ✅ 合法
  buffer_distance: 500
  inputFile: "data.shp"
  _temp_var: "temp"
  CRS: "EPSG:4326"
  
  # ❌ 不合法（但 YAML 语法上允许，GeoPipeAgent 可能报警告）
  123var: "bad"         # 以数字开头
  my-var: "bad"         # 包含连字符
```

---

## 4.4 参数类型系统

GeoPipeAgent 的步骤参数支持以下类型：

### 4.4.1 类型对照表

| 类型标识 | Python 类型 | YAML 表示 | 说明 |
|----------|-------------|-----------|------|
| `geodataframe` | `GeoDataFrame` | `$step_id` (引用) | 矢量空间数据 |
| `number` | `int \| float` | `500`, `3.14` | 数值 |
| `string` | `str` | `"text"`, `text` | 字符串 |
| `boolean` | `bool` | `true`, `false` | 布尔值 |
| `list` | `list` | YAML 列表 | 列表 |
| `dict` | `dict` | YAML 字典 | 字典 |
| `path` | `str` | `"file.shp"` | 文件路径（字符串的特殊子类型） |
| `crs` | `str` | `"EPSG:4326"` | CRS 标识（字符串的特殊子类型） |
| `expression` | `str` | `"area > 100"` | 过滤表达式 |
| `any` | `Any` | 任意 | 任意类型 |

### 4.4.2 各类型详细说明与示例

**geodataframe 类型**

通常通过步骤引用传递，不直接在 YAML 中定义：

```yaml
params:
  input: $load_data              # 引用前置步骤的输出 GeoDataFrame
  clip_mask: $boundary           # 另一个 GeoDataFrame 引用
```

**number 类型**

```yaml
params:
  distance: 500                  # 整数
  tolerance: 0.001               # 浮点数
  resolution: 16                 # 整数
  angle: 315.0                   # 浮点数
  buffer_distance: ${buffer_distance}  # 通过变量引用数值
```

**string 类型**

```yaml
params:
  path: "data/buildings.shp"     # 文件路径
  driver: "GPKG"                 # 驱动名称
  target_crs: "EPSG:4326"       # CRS 字符串
  expression: "area > 100"       # 过滤表达式
  by: "type"                     # 字段名
  how: "inner"                   # 连接方式
```

**boolean 类型**

```yaml
params:
  preserve_topology: true        # 保持拓扑
  drop_duplicates: false         # 不删除重复
  include_area: true             # 包含面积
```

**list 类型**

```yaml
params:
  # 字段列表
  fields:
    - name
    - area
    - type
  
  # 数值列表
  breaks:
    - 0
    - 100
    - 500
    - 1000
  
  # QC 规则列表
  rules:
    - type: no_self_intersection
      severity: error
    - type: minimum_area
      value: 10
      severity: warning
```

**dict 类型**

```yaml
params:
  # 重分类映射
  remap:
    1: "forest"
    2: "water"
    3: "urban"
    4: "agriculture"
  
  # 统计配置
  stats:
    mean: true
    sum: true
    count: true
    min: false
    max: false
```

---

## 4.5 完整 Schema 参考

以下是 GeoPipeAgent YAML 流水线的完整 JSON Schema 形式化定义：

```yaml
# GeoPipeAgent Pipeline YAML Schema
# Version: 0.1.0

pipeline:                              # 必填：顶层键
  
  name:                                # 必填：string
    # 流水线名称，建议 snake_case
    # 例：buffer_analysis
    # 约束：非空字符串
  
  description:                         # 可选：string
    # 流水线描述
    # 默认：""
  
  crs:                                 # 可选：string
    # 全局 CRS，格式 "EPSG:XXXX"
    # 默认：null
  
  variables:                           # 可选：map[string, any]
    # 变量键：[a-zA-Z_][a-zA-Z0-9_]*
    # 变量值：any (string, number, boolean, list, dict)
    # 默认：{}
    key1: value1
    key2: value2
  
  steps:                               # 必填：list[StepDefinition]
    # 至少包含一个步骤
    
    - id:                              # 必填：string
      # 格式：[a-z][a-z0-9_-]*
      # 约束：流水线内唯一
      
      use:                             # 必填：string
      # 格式：category.action
      # 约束：必须是已注册步骤
      
      params:                          # 可选：map[string, any]
      # 参数值支持：字面值、$引用、${变量}
      # 默认：{}
      
      when:                            # 可选：string
      # 条件表达式，返回 boolean
      # 支持：比较、逻辑、属性访问
      # 默认：null（总是执行）
      
      on_error:                        # 可选：string
      # 可选值："fail" | "skip"
      # 默认："fail"
      
      backend:                         # 可选：string
      # 可选值：已注册的后端名称
      # 默认：null（使用默认后端）
  
  outputs:                             # 可选：map[string, string]
    # 键：输出名称
    # 值：$step_id 或 $step_id.attr
    # 默认：{}
    output_name: $step_id
```

---

## 4.6 完整示例

### 4.6.1 示例一：简单缓冲区分析

最基本的流水线：读取数据 → 缓冲 → 保存。

```yaml
pipeline:
  name: simple_buffer
  description: 简单的缓冲区分析
  
  variables:
    buffer_distance: 500
  
  steps:
    - id: load
      use: io.read_vector
      params:
        path: "data/buildings.shp"
    
    - id: buffer
      use: vector.buffer
      params:
        input: $load
        distance: ${buffer_distance}
    
    - id: save
      use: io.write_vector
      params:
        input: $buffer
        path: "output/buildings_buffer.gpkg"
        driver: "GPKG"
  
  outputs:
    result: $buffer
```

### 4.6.2 示例二：多步骤 QC 流水线

包含多个质检步骤和条件执行的流水线：

```yaml
pipeline:
  name: data_quality_pipeline
  description: 综合数据质量检查流水线
  crs: "EPSG:4326"
  
  variables:
    input_file: "data/parcels.gpkg"
    output_file: "output/parcels_checked.gpkg"
    run_topology: true
    min_area: 10
    max_name_length: 100
  
  steps:
    # ─── 数据加载 ───
    - id: load_parcels
      use: io.read_vector
      params:
        path: "${input_file}"
    
    # ─── 几何有效性检查 ───
    - id: check_geometry
      use: qc.geometry_validity
      params:
        input: $load_parcels
        rules:
          - type: no_self_intersection
            severity: error
          - type: no_duplicate_points
            severity: warning
          - type: minimum_area
            value: ${min_area}
            severity: error
          - type: valid_polygon
            severity: error
    
    # ─── 属性检查 ───
    - id: check_attributes
      use: qc.attribute_check
      params:
        input: $load_parcels
        rules:
          - field: parcel_id
            not_null: true
            unique: true
            severity: error
          - field: owner_name
            not_null: true
            max_length: ${max_name_length}
            severity: warning
          - field: area_sqm
            not_null: true
            min_value: 0
            severity: error
          - field: land_use
            not_null: true
            allowed_values:
              - residential
              - commercial
              - industrial
              - agricultural
              - public
            severity: error
    
    # ─── CRS 一致性检查 ───
    - id: check_crs
      use: qc.crs_consistency
      params:
        input: $load_parcels
        expected_crs: "EPSG:4326"
    
    # ─── 拓扑检查（条件执行）───
    - id: check_topology
      use: qc.topology_check
      params:
        input: $load_parcels
        rules:
          - type: no_gaps
          - type: no_overlaps
          - type: no_slivers
            min_area: 1
      when: "run_topology"
      on_error: skip
    
    # ─── 保存检查结果 ───
    - id: save_result
      use: io.write_vector
      params:
        input: $load_parcels
        path: "${output_file}"
        driver: "GPKG"
  
  outputs:
    data: $load_parcels
    geometry_qc: $check_geometry
    attribute_qc: $check_attributes
    crs_qc: $check_crs
    topology_qc: $check_topology
```

### 4.6.3 示例三：栅格处理流水线

完整的栅格数据处理流程：

```yaml
pipeline:
  name: raster_processing
  description: DEM 栅格数据处理与分析
  crs: "EPSG:32650"
  
  variables:
    dem_path: "data/dem.tif"
    aoi_path: "data/study_area.gpkg"
    output_dir: "output/raster"
  
  steps:
    # ─── 加载 ───
    - id: load_dem
      use: io.read_raster
      params:
        path: "${dem_path}"
    
    - id: load_aoi
      use: io.read_vector
      params:
        path: "${aoi_path}"
    
    # ─── 裁剪 DEM ───
    - id: clip_dem
      use: raster.clip
      params:
        input: $load_dem
        mask: $load_aoi
        crop: true
        nodata: -9999
      backend: gdal_python
    
    # ─── 重投影 ───
    - id: reproject_dem
      use: raster.reproject
      params:
        input: $clip_dem
        target_crs: "EPSG:32650"
        resolution: 30
        resampling: "bilinear"
      backend: gdal_cli
    
    # ─── 地形分析 ───
    - id: calc_slope
      use: raster.slope
      params:
        input: $reproject_dem
        units: "degrees"
    
    - id: calc_aspect
      use: raster.aspect
      params:
        input: $reproject_dem
    
    - id: calc_hillshade
      use: raster.hillshade
      params:
        input: $reproject_dem
        azimuth: 315
        altitude: 45
        z_factor: 1.0
    
    # ─── 坡度重分类 ───
    - id: classify_slope
      use: raster.reclassify
      params:
        input: $calc_slope
        breaks:
          - 0
          - 5
          - 15
          - 25
          - 45
          - 90
        labels:
          - "平坦"
          - "缓坡"
          - "中坡"
          - "陡坡"
          - "急坡"
    
    # ─── 分区统计 ───
    - id: zonal_statistics
      use: raster.zonal_stats
      params:
        zones: $load_aoi
        raster: $reproject_dem
        stats:
          - mean
          - min
          - max
          - std
          - median
    
    # ─── 保存结果 ───
    - id: save_slope
      use: io.write_raster
      params:
        input: $calc_slope
        path: "${output_dir}/slope.tif"
    
    - id: save_hillshade
      use: io.write_raster
      params:
        input: $calc_hillshade
        path: "${output_dir}/hillshade.tif"
  
  outputs:
    slope: $calc_slope
    aspect: $calc_aspect
    hillshade: $calc_hillshade
    slope_classes: $classify_slope
    zonal_stats: $zonal_statistics
```

### 4.6.4 示例四：条件执行流水线

展示条件执行和错误处理的复杂流水线：

```yaml
pipeline:
  name: conditional_pipeline
  description: 带条件执行的智能分析流水线
  
  variables:
    input_file: "data/features.gpkg"
    needs_reproject: true
    target_crs: "EPSG:3857"
    feature_threshold: 1000
    run_advanced_analysis: false
    buffer_distance: 500
  
  steps:
    # ─── 数据加载 ───
    - id: load_data
      use: io.read_vector
      params:
        path: "${input_file}"
    
    # ─── 条件重投影 ───
    - id: reproject
      use: vector.reproject
      params:
        input: $load_data
        target_crs: ${target_crs}
      when: "needs_reproject"
    
    # ─── 有条件地选择正确的输入 ───
    # 如果重投影被跳过，后续步骤使用原始数据
    - id: create_buffer
      use: vector.buffer
      params:
        input: $load_data
        distance: ${buffer_distance}
    
    # ─── 基于要素数量的条件简化 ───
    - id: simplify
      use: vector.simplify
      params:
        input: $create_buffer
        tolerance: 10
        preserve_topology: true
      when: "create_buffer.stats.feature_count > feature_threshold"
    
    # ─── 高级分析（可选）───
    - id: hotspot_analysis
      use: analysis.hotspot
      params:
        input: $create_buffer
        weight_field: "value"
        distance_method: "euclidean"
      when: "run_advanced_analysis"
      on_error: skip
    
    # ─── 密度分析（可选）───
    - id: density_analysis
      use: analysis.density
      params:
        input: $create_buffer
        radius: 2000
        cell_size: 100
      when: "run_advanced_analysis"
      on_error: skip
    
    # ─── QC 总是执行 ───
    - id: final_qc
      use: qc.geometry_validity
      params:
        input: $create_buffer
    
    # ─── 保存结果 ───
    - id: save
      use: io.write_vector
      params:
        input: $create_buffer
        path: "output/result.gpkg"
        driver: "GPKG"
  
  outputs:
    buffer_result: $create_buffer
    qc_report: $final_qc
```

### 4.6.5 示例五：多数据源空间分析

展示处理多个数据源并进行复合分析的流水线：

```yaml
pipeline:
  name: multi_source_analysis
  description: 多数据源城市空间分析
  crs: "EPSG:4326"
  
  variables:
    building_file: "data/buildings.gpkg"
    road_file: "data/roads.gpkg"
    poi_file: "data/poi.gpkg"
    boundary_file: "data/study_area.gpkg"
    road_buffer_dist: 200
    poi_search_radius: 1000
  
  steps:
    # ─── 加载所有数据 ───
    - id: load_buildings
      use: io.read_vector
      params:
        path: "${building_file}"
    
    - id: load_roads
      use: io.read_vector
      params:
        path: "${road_file}"
    
    - id: load_poi
      use: io.read_vector
      params:
        path: "${poi_file}"
    
    - id: load_boundary
      use: io.read_vector
      params:
        path: "${boundary_file}"
    
    # ─── 裁剪到研究区域 ───
    - id: clip_buildings
      use: vector.clip
      params:
        input: $load_buildings
        mask: $load_boundary
    
    - id: clip_roads
      use: vector.clip
      params:
        input: $load_roads
        mask: $load_boundary
    
    - id: clip_poi
      use: vector.clip
      params:
        input: $load_poi
        mask: $load_boundary
    
    # ─── 道路缓冲区 ───
    - id: road_buffer
      use: vector.buffer
      params:
        input: $clip_roads
        distance: ${road_buffer_dist}
    
    # ─── 建筑物与道路缓冲区空间连接 ───
    - id: buildings_near_road
      use: analysis.spatial_join
      params:
        left: $clip_buildings
        right: $road_buffer
        how: "inner"
        predicate: "intersects"
    
    # ─── POI 密度分析 ───
    - id: poi_density
      use: analysis.density
      params:
        input: $clip_poi
        radius: ${poi_search_radius}
        cell_size: 50
    
    # ─── 泰森多边形 ───
    - id: voronoi
      use: analysis.voronoi
      params:
        input: $clip_poi
        clip_to: $load_boundary
    
    # ─── QC ───
    - id: qc_buildings
      use: qc.geometry_validity
      params:
        input: $buildings_near_road
    
    # ─── 保存所有结果 ───
    - id: save_buildings
      use: io.write_vector
      params:
        input: $buildings_near_road
        path: "output/buildings_near_road.gpkg"
        driver: "GPKG"
    
    - id: save_voronoi
      use: io.write_vector
      params:
        input: $voronoi
        path: "output/poi_voronoi.gpkg"
        driver: "GPKG"
  
  outputs:
    buildings_near_road: $buildings_near_road
    poi_density: $poi_density
    voronoi: $voronoi
    qc: $qc_buildings
```

---

## 4.7 outputs 定义与引用

### 4.7.1 outputs 的作用

`outputs` 字段声明流水线的最终输出。它的作用是：

1. **明确性**：清楚地标识哪些步骤产出是最终结果
2. **报告集成**：outputs 的内容会出现在 JSON 报告的 `outputs` 字段中
3. **可读性**：让流水线的用途一目了然
4. **API 集成**：Web API 可以根据 outputs 返回特定结果

### 4.7.2 引用语法

```yaml
outputs:
  # 引用步骤的主输出
  result: $step_id

  # 引用步骤的统计信息
  statistics: $step_id.stats

  # 引用步骤的完整结果对象
  full_result: $step_id.output
```

### 4.7.3 报告中的 outputs

```json
{
  "outputs": {
    "result": {
      "type": "GeoDataFrame",
      "feature_count": 1245,
      "crs": "EPSG:4326",
      "geometry_type": "Polygon"
    },
    "statistics": {
      "feature_count": 1245,
      "mean_area": 523.4,
      "total_area": 651633.0
    }
  }
}
```

---

## 4.8 最佳实践

### 4.8.1 命名约定

```yaml
# ✅ 推荐
pipeline:
  name: urban_suitability_analysis     # snake_case 流水线名
  steps:
    - id: load_buildings               # 动词_名词
    - id: filter_by_height             # 动词_介词_名词
    - id: create_500m_buffer           # 动词_量词_名词
    - id: qc_geometry                  # 类别_检查项

# ❌ 不推荐
pipeline:
  name: MyAnalysis                     # 避免驼峰
  steps:
    - id: step1                        # 无语义
    - id: s2                           # 过于简短
    - id: doTheThing                   # 驼峰命名
```

### 4.8.2 步骤排序

```yaml
steps:
  # 1. 先加载所有数据
  - id: load_buildings
    use: io.read_vector
    ...
  - id: load_roads
    use: io.read_vector
    ...
  
  # 2. 数据预处理（裁剪、投影、过滤）
  - id: clip_buildings
    use: vector.clip
    ...
  - id: reproject
    use: vector.reproject
    ...
  
  # 3. 核心分析
  - id: buffer_analysis
    use: vector.buffer
    ...
  - id: spatial_join
    use: analysis.spatial_join
    ...
  
  # 4. 质量检查
  - id: qc_check
    use: qc.geometry_validity
    ...
  
  # 5. 保存结果
  - id: save_result
    use: io.write_vector
    ...
```

### 4.8.3 变量使用建议

```yaml
# ✅ 将可能变化的值提取为变量
variables:
  buffer_distance: 500
  target_crs: "EPSG:3857"
  input_dir: "data"
  output_dir: "output"

# ✅ 这样可以通过 CLI 轻松覆盖：
# geopipe-agent run pipeline.yaml --var buffer_distance=1000
```

### 4.8.4 错误处理建议

```yaml
# ✅ 关键步骤使用默认的 fail 策略
- id: load_data
  use: io.read_vector
  params:
    path: "important.shp"
  # on_error: fail （默认）

# ✅ 可选步骤使用 skip 策略
- id: optional_analysis
  use: analysis.hotspot
  params:
    input: $data
  on_error: skip

# ✅ 条件执行避免不必要的失败
- id: topology_check
  use: qc.topology_check
  params:
    input: $data
  when: "data.stats.feature_count > 0"
  on_error: skip
```

### 4.8.5 YAML 格式规范

```yaml
# ✅ 使用 2 空格缩进
pipeline:
  name: example
  steps:
    - id: step1
      use: io.read_vector
      params:
        path: "data.shp"

# ✅ 使用注释分隔逻辑段落
steps:
  # ─── 数据加载 ───
  - id: load
    ...
  
  # ─── 空间分析 ───
  - id: analyze
    ...
  
  # ─── 结果输出 ───
  - id: save
    ...

# ✅ 长字符串使用引号
params:
  path: "data/my file with spaces.shp"
  description: "这是一个包含中文的描述"

# ✅ 复杂结构适当换行
params:
  rules:
    - type: no_self_intersection
      severity: error
    - type: minimum_area
      value: 10
      severity: warning
```

---

## 4.9 本章小结

本章完整介绍了 GeoPipeAgent YAML 流水线定义的所有语法：

1. **顶层结构**：name、description、crs、variables、steps、outputs
2. **步骤定义**：id、use、params、when、on_error、backend
3. **命名规则**：步骤 ID 使用 `[a-z][a-z0-9_-]*`，步骤类型使用 `category.action`
4. **参数类型**：geodataframe、number、string、boolean、list、dict
5. **完整示例**：简单缓冲、QC 流水线、栅格处理、条件执行、多数据源分析
6. **outputs**：声明流水线最终输出，集成到 JSON 报告
7. **最佳实践**：命名、排序、变量使用、错误处理、格式规范

在下一章中，我们将深入介绍变量系统和步骤引用机制，了解数据如何在步骤之间流动。

---

[← 上一章：核心架构与模块设计](03-核心架构与模块设计) | [下一章：变量系统与步骤引用 →](05-变量系统与步骤引用)

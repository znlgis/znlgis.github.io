---
layout: default
title: YAML流水线Schema详解
---

# 第四章：YAML 流水线 Schema 详解

## 4.1 流水线顶层结构

每个 GeoPipeAgent 流水线 YAML 文件都以 `pipeline` 作为顶层键。完整的结构如下：

```yaml
pipeline:
  name: "流水线名称"              # 必需：流水线名称
  description: "描述信息"          # 可选：流水线描述
  crs: "EPSG:4326"               # 可选：默认坐标参考系统
  variables:                      # 可选：可复用的变量定义
    var_name: value
  steps:                          # 必需：步骤列表（有序）
    - id: step_id                 # 必需：唯一步骤标识符
      use: category.action        # 必需：步骤注册 ID
      params:                     # 步骤参数
        key: value
      when: "条件表达式"           # 可选：条件执行
      on_error: fail              # 可选：错误处理策略
      backend: gdal_python        # 可选：指定后端
  outputs:                        # 可选：流水线输出声明
    result: "$step_id.output"
```

### 4.1.1 必需字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `pipeline` | 映射 | 顶层容器 |
| `pipeline.name` | 字符串 | 流水线名称（用于报告标识） |
| `pipeline.steps` | 列表 | 步骤定义列表（至少一个步骤） |

### 4.1.2 可选字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `description` | 字符串 | `""` | 流水线描述 |
| `crs` | 字符串 | `null` | 默认 CRS（如 `EPSG:4326`） |
| `variables` | 映射 | `{}` | 变量定义 |
| `outputs` | 映射 | `{}` | 输出声明 |

## 4.2 步骤定义（Step Definition）

每个步骤是 `steps` 列表中的一个映射：

```yaml
- id: buffer-analysis          # 唯一标识符
  use: vector.buffer           # 要执行的步骤类型
  params:                      # 参数
    input: "$read.output"      # 步骤引用
    distance: 500
    cap_style: "round"
  when: "$read.feature_count > 0"  # 条件执行
  on_error: skip               # 错误处理
  backend: gdal_python         # 指定后端
```

### 4.2.1 step_id 规则

`id` 字段是步骤的唯一标识符，有严格的命名规则：

- **允许字符**：小写字母 `a-z`、数字 `0-9`、下划线 `_`、连字符 `-`
- **正则表达式**：`^[a-z0-9_-]+$`
- **禁止使用点号**（`.`）：点号保留给输出引用语法（`$step_id.attr`）
- **必须唯一**：同一流水线中不能有重复的 step_id

合法的 step_id 示例：

```yaml
id: read-data          # ✅ 使用连字符
id: buffer_analysis    # ✅ 使用下划线
id: step1              # ✅ 包含数字
id: load-roads         # ✅ 多单词连字符分隔
```

非法的 step_id 示例：

```yaml
id: read.data          # ❌ 包含点号
id: Buffer             # ❌ 包含大写字母
id: 1step              # ✅ 数字开头是允许的
id: read data          # ❌ 包含空格
```

### 4.2.2 use 字段

`use` 字段指定要执行的步骤类型，格式为 `category.action`：

```yaml
use: io.read_vector       # IO 类：读取矢量数据
use: vector.buffer        # 矢量类：缓冲区分析
use: raster.calc          # 栅格类：波段计算
use: analysis.voronoi     # 分析类：泰森多边形
use: network.shortest_path # 网络类：最短路径
```

`use` 的值必须是已注册的步骤 ID。可以通过 `geopipe-agent list-steps` 查看所有可用的步骤。

### 4.2.3 params 字段

`params` 是一个键值映射，包含传递给步骤的参数。参数值可以是：

| 值类型 | 示例 | 说明 |
|--------|------|------|
| 字面量 | `500`、`"round"`、`true` | 直接使用 |
| 步骤引用 | `$read.output` | 引用其他步骤的输出 |
| 变量引用 | `${input_path}` | 替换为变量值 |
| 嵌入变量 | `data/${name}.shp` | 字符串中嵌入变量 |
| 嵌套映射 | `{key: value}` | 复杂参数 |
| 列表 | `[1, 2, 3]` | 数组参数 |

### 4.2.4 on_error 字段

控制步骤执行失败时的行为：

| 值 | 行为 | 说明 |
|----|------|------|
| `fail` | 停止流水线 | **默认值**，立即终止执行并报错 |
| `skip` | 跳过继续 | 忽略错误，继续执行后续步骤 |
| `retry` | 重试 | 最多重试 3 次，指数退避（0.5s, 1s, 1.5s） |

示例：

```yaml
steps:
  - id: download
    use: io.read_vector
    params:
      path: "http://example.com/data.geojson"
    on_error: retry    # 网络操作适合重试

  - id: optional-step
    use: vector.simplify
    params:
      input: "$download.output"
      tolerance: 0.001
    on_error: skip     # 可选步骤，失败不影响流水线
```

### 4.2.5 when 字段

条件执行表达式，当条件为 `true` 时才执行该步骤：

```yaml
- id: buffer
  use: vector.buffer
  params:
    input: "$read.output"
    distance: 500
  when: "$read.feature_count > 0"  # 只在读到数据时执行
```

支持的操作符：

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `==` | 等于 | `$step.count == 0` |
| `!=` | 不等于 | `$step.status != 'error'` |
| `>` | 大于 | `$step.feature_count > 100` |
| `<` | 小于 | `$step.area < 1000` |
| `>=` | 大于等于 | `$step.count >= 10` |
| `<=` | 小于等于 | `$step.count <= 50` |
| `and` | 逻辑与 | `$a.count > 0 and $b.count > 0` |
| `or` | 逻辑或 | `$a.count > 0 or $b.count > 0` |
| `not` | 逻辑非 | `not $step.count == 0` |

安全性说明：`when` 表达式通过 AST 白名单验证，只允许比较运算、布尔运算和常量，不允许函数调用、属性访问或其他可能不安全的构造。

### 4.2.6 backend 字段

指定该步骤使用的 GIS 后端：

```yaml
- id: buffer
  use: vector.buffer
  params:
    input: "$read.output"
    distance: 500
  backend: gdal_cli    # 使用 GDAL CLI 后端处理大文件
```

可选值：
- `gdal_python`：GeoPandas + Shapely（默认）
- `gdal_cli`：ogr2ogr 命令行工具
- `qgis_process`：QGIS Processing

如果不指定 `backend`，框架会自动选择第一个可用的后端。

注意：IO 类步骤（`io.*`）不使用 Backend，它们直接使用 Fiona/Rasterio 进行文件操作。

## 4.3 变量系统

### 4.3.1 变量定义

变量在 `pipeline.variables` 中定义：

```yaml
pipeline:
  name: "参数化分析"
  variables:
    input_path: "data/roads.shp"
    buffer_dist: 500
    output_format: "GeoJSON"
    target_crs: "EPSG:3857"
```

变量值可以是任意 YAML 值类型：字符串、数字、布尔值、列表或映射。

### 4.3.2 变量引用

在 `params` 中使用 `${var_name}` 语法引用变量：

```yaml
steps:
  - id: read
    use: io.read_vector
    params:
      path: "${input_path}"          # 完整替换
  - id: buffer
    use: vector.buffer
    params:
      input: "$read.output"
      distance: "${buffer_dist}"      # 数值替换
  - id: save
    use: io.write_vector
    params:
      input: "$buffer.output"
      path: "output/result.${output_format}"  # 嵌入式替换
      format: "${output_format}"
```

### 4.3.3 变量类型保持

当 `${var}` 是参数的完整值时，保持变量的原始类型：

```yaml
variables:
  count: 100       # 整数
  flag: true       # 布尔值
  ratio: 0.5       # 浮点数

steps:
  - id: step1
    use: some.step
    params:
      num: "${count}"     # → 整数 100（不是字符串 "100"）
      enabled: "${flag}"  # → 布尔值 true
      scale: "${ratio}"   # → 浮点数 0.5
```

当变量嵌入在字符串中时，执行字符串替换：

```yaml
variables:
  name: "roads"

steps:
  - id: step1
    use: io.read_vector
    params:
      path: "data/${name}.shp"  # → 字符串 "data/roads.shp"
```

### 4.3.4 命令行变量覆盖

通过 `--var` 选项可以在命令行覆盖 YAML 中定义的变量：

```bash
geopipe-agent run pipeline.yaml --var input_path=data/highways.shp --var buffer_dist=1000
```

命令行变量会覆盖 YAML 中的同名变量。注意命令行传入的值始终是字符串类型。

## 4.4 步骤引用系统

### 4.4.1 引用语法

使用 `$step_id.attribute` 语法引用之前步骤的输出：

```yaml
steps:
  - id: read
    use: io.read_vector
    params:
      path: "data/roads.shp"

  - id: buffer
    use: vector.buffer
    params:
      input: "$read.output"     # 引用 read 步骤的输出
      distance: 500
```

### 4.4.2 可引用的属性

每个步骤执行后会产生一个 `StepResult` 对象，包含以下可引用的属性：

| 属性 | 说明 | 示例引用 |
|------|------|---------|
| `output` | 主要输出数据 | `$read.output` |
| `stats` | 统计信息字典 | `$buffer.stats` |
| `metadata` | 元数据字典 | `$read.metadata` |
| stats 中的键 | 具体统计值 | `$buffer.feature_count` |
| metadata 中的键 | 具体元数据 | `$read.crs` |

通过 `StepResult.__getattr__` 方法，stats 和 metadata 中的键可以直接作为属性访问。

### 4.4.3 引用约束

- 只能引用当前步骤 **之前** 定义的步骤（Validator 会检查）
- 引用的步骤 ID 必须存在
- 引用格式必须包含点号（`$step_id.attr`），不能只写 `$step_id`

## 4.5 输出声明

`outputs` 字段声明流水线的最终输出：

```yaml
pipeline:
  name: "分析流水线"
  steps:
    - id: read
      use: io.read_vector
      params: { path: "data/roads.shp" }
    - id: buffer
      use: vector.buffer
      params: { input: "$read.output", distance: 500 }
    - id: save
      use: io.write_vector
      params: { input: "$buffer.output", path: "output/result.geojson" }
  outputs:
    result: "$save.output"
    stats: "$buffer.stats"
    feature_count: "$buffer.feature_count"
```

输出会包含在最终的 JSON 报告中：

```json
{
  "pipeline": "分析流水线",
  "status": "success",
  "outputs": {
    "result": {"type": "GeoDataFrame", "feature_count": 100, "crs": "EPSG:3857"},
    "stats": {"feature_count": 100, "total_area": 12345.67},
    "feature_count": 100
  }
}
```

## 4.6 完整示例

### 4.6.1 缓冲区分析流水线

```yaml
# 对矢量数据进行缓冲区分析
pipeline:
  name: "缓冲区分析"
  description: "对道路数据进行缓冲区分析并输出结果"

  variables:
    input_path: "data/roads.shp"
    buffer_dist: 500
    output_format: "GeoJSON"

  steps:
    - id: load-roads
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: reproject
      use: vector.reproject
      params:
        input: "$load-roads.output"
        target_crs: "EPSG:3857"

    - id: buffer-analysis
      use: vector.buffer
      params:
        input: "$reproject.output"
        distance: "${buffer_dist}"
        cap_style: "round"

    - id: save-result
      use: io.write_vector
      params:
        input: "$buffer-analysis.output"
        path: "output/road_buffer.geojson"
        format: "${output_format}"

  outputs:
    result: "$save-result.output"
    stats: "$buffer-analysis.stats"
```

### 4.6.2 带条件执行的流水线

```yaml
pipeline:
  name: "条件分析"
  variables:
    input_path: "data/parcels.shp"
    min_area: 1000

  steps:
    - id: read
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: filter
      use: vector.query
      params:
        input: "$read.output"
        expression: "area > ${min_area}"

    - id: simplify
      use: vector.simplify
      params:
        input: "$filter.output"
        tolerance: 1.0
      when: "$filter.feature_count > 0"    # 只在有数据时执行

    - id: save
      use: io.write_vector
      params:
        input: "$simplify.output"
        path: "output/result.geojson"
      when: "$filter.feature_count > 0"    # 只在有数据时保存
```

### 4.6.3 带错误处理的流水线

```yaml
pipeline:
  name: "健壮的分析流水线"
  steps:
    - id: read
      use: io.read_vector
      params:
        path: "data/input.shp"

    - id: buffer
      use: vector.buffer
      params:
        input: "$read.output"
        distance: 100
      on_error: retry          # 失败重试

    - id: optional-simplify
      use: vector.simplify
      params:
        input: "$buffer.output"
        tolerance: 0.5
      on_error: skip           # 可选步骤

    - id: save
      use: io.write_vector
      params:
        input: "$buffer.output"
        path: "output/result.geojson"
```

## 4.7 YAML 编写注意事项

### 4.7.1 缩进规范

YAML 使用空格缩进（不是制表符），推荐使用 2 个空格：

```yaml
pipeline:                    # 第 0 级
  name: "流水线"              # 第 1 级（2 空格）
  steps:                     # 第 1 级
    - id: read               # 第 2 级（4 空格）
      use: io.read_vector    # 第 2 级
      params:                # 第 2 级
        path: "data.shp"     # 第 3 级（6 空格）
```

### 4.7.2 字符串引号

YAML 中字符串通常不需要引号，但以下情况建议加引号：

```yaml
# 包含特殊字符时使用引号
path: "data/my file.shp"        # 包含空格
expression: "area > 1000"        # 包含 >
crs: "EPSG:4326"                 # 包含冒号

# 数值字符串需要引号（否则会被解析为数字）
version: "3.0"                   # 需要引号
name: "123"                      # 需要引号
```

### 4.7.3 YAML 注释

使用 `#` 添加注释：

```yaml
pipeline:
  name: "分析流水线"
  # 定义可复用变量
  variables:
    input_path: "data/roads.shp"  # 输入文件路径
  steps:
    # 第一步：读取数据
    - id: read
      use: io.read_vector
      params:
        path: "${input_path}"
```

### 4.7.4 Windows 路径注意

在 Windows 上，YAML 中的文件路径应使用正斜杠：

```yaml
# ✅ 正确
path: "C:/data/roads.shp"

# ❌ 可能出错（反斜杠被解释为转义）
path: "C:\data\roads.shp"
```

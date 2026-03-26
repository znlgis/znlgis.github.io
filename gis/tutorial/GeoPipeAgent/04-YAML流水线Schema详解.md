---
layout: default
title: "第4章：YAML 流水线 Schema 详解"
---

# 第4章：YAML 流水线 Schema 详解

> 本章逐一解析 YAML 流水线定义的每个字段、语法规则和约束条件，结合源码分析帮助您掌握流水线编写的完整知识。

---

## 4.1 流水线顶层结构

### 4.1.1 `pipeline` 根节点

每个 GeoPipeAgent 流水线 YAML 文件必须以 `pipeline` 作为根节点。`parser.py` 在解析时首先检查此节点的存在：

```yaml
pipeline:
  name: "流水线名称"          # 必填
  description: "流水线描述"    # 可选
  crs: "EPSG:4326"           # 可选，全局坐标参考系
  variables:                  # 可选，变量定义
    key: value
  steps:                      # 必填，步骤列表
    - id: step_1
      use: category.action
      params:
        key: value
  outputs:                    # 可选，输出声明
    result: "$step_id.output"
```

### 4.1.2 各字段详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 流水线名称，用于报告标题和日志标识 |
| `description` | string | ❌ | 流水线的详细描述 |
| `crs` | string | ❌ | 全局 CRS，如 `"EPSG:4326"` |
| `variables` | dict | ❌ | 变量定义，在整个流水线中可引用 |
| `steps` | list | ✅ | 步骤定义列表，按顺序执行 |
| `outputs` | dict | ❌ | 输出声明，定义流水线的最终输出 |

### 4.1.3 对应的数据模型

这些字段直接映射到 `models/pipeline.py` 中的 `PipelineDefinition` 数据类：

```python
@dataclass
class PipelineDefinition:
    name: str                          # pipeline.name
    steps: list[StepDefinition]        # pipeline.steps
    description: str | None = None     # pipeline.description
    crs: str | None = None             # pipeline.crs
    variables: dict = field(default_factory=dict)   # pipeline.variables
    outputs: dict = field(default_factory=dict)      # pipeline.outputs
```

### 4.1.4 `name` 字段

`name` 是流水线的唯一标识名称，它会出现在：
- JSON 执行报告的标题中
- 结构化日志的上下文信息中
- CLI 输出的流水线摘要中

```yaml
pipeline:
  name: "城市绿地缓冲区分析"
```

**命名建议**：使用简洁明了的中文或英文名称，描述流水线的主要功能。

### 4.1.5 `description` 字段

可选的详细描述，帮助理解流水线的目的和背景：

```yaml
pipeline:
  name: "城市绿地分析"
  description: |
    分析城市绿地的空间分布特征：
    1. 读取绿地图层
    2. 计算500米缓冲区
    3. 与建筑物图层叠加分析
    4. 输出分析报告
```

### 4.1.6 `crs` 字段

全局坐标参考系统定义。当步骤需要统一 CRS 时，可使用此字段：

```yaml
pipeline:
  crs: "EPSG:4326"     # WGS 84 经纬度
  # 或
  crs: "EPSG:4547"     # CGCS2000 / 3-degree Gauss-Kruger CM 114E
  # 或
  crs: "EPSG:32650"    # WGS 84 / UTM zone 50N
```

常用 CRS 参考：

| EPSG | 名称 | 适用范围 |
|------|------|---------|
| 4326 | WGS 84 | 全球，经纬度 |
| 4490 | CGCS2000 | 中国，经纬度 |
| 4547 | CGCS2000 3度带 | 中国，投影坐标 |
| 32650 | UTM 50N | 东经 114°-120° |
| 3857 | Web Mercator | Web 地图 |

---

## 4.2 步骤定义详解

### 4.2.1 步骤的完整结构

每个步骤的完整定义包含以下字段：

```yaml
- id: step_id           # 必填，步骤唯一标识
  use: category.action   # 必填，要使用的步骤类型
  params:                # 可选，步骤参数
    key: value
  when: "condition"      # 可选，条件执行表达式
  on_error: fail         # 可选，错误处理策略 (fail/skip/retry)
  backend: native_python # 可选，指定后端
```

### 4.2.2 对应的数据模型

步骤定义映射到 `StepDefinition` 数据类：

```python
@dataclass
class StepDefinition:
    id: str                            # 步骤 ID
    use: str                           # 步骤类型
    params: dict = field(default_factory=dict)  # 参数
    when: str | None = None            # 条件表达式
    on_error: str = "fail"             # 错误处理策略
    backend: str | None = None         # 指定后端
```

### 4.2.3 `id` 字段

步骤 ID 是步骤在流水线中的唯一标识，用于：

- 其他步骤通过 `$step_id` 引用该步骤的输出
- 日志和报告中标识步骤
- 验证器检查引用有效性

```yaml
steps:
  - id: load_data         # ✅ 有效
    use: io.read_file
  - id: create-buffer     # ✅ 有效（支持连字符）
    use: vector.buffer
  - id: step_2            # ✅ 有效（支持数字）
    use: vector.clip
```

### 4.2.4 `use` 字段

`use` 字段指定要执行的已注册步骤，格式为 `category.action`：

```yaml
steps:
  - id: read
    use: io.read_file          # IO 类：读取文件
  - id: buffer
    use: vector.buffer         # Vector 类：缓冲区
  - id: check
    use: qc.check_geometry     # QC 类：几何检查
```

执行器通过 `_registry[use]` 查找对应的 `StepInfo`，然后调用其 `func` 函数。如果 `use` 值未注册，验证器会抛出 `StepNotFoundError`。

### 4.2.5 `params` 字段

`params` 是一个字典，传递给步骤函数的参数。参数值可以是：

- 字面值：字符串、数字、布尔值
- 变量引用：`${var_name}`
- 步骤引用：`$step_id` 或 `$step_id.output`
- 嵌套结构：字典或列表

```yaml
params:
  path: "data/roads.shp"          # 字符串字面值
  distance: 500                    # 数字字面值
  keep_original: true              # 布尔字面值
  input: $load_data                # 步骤引用
  crs: ${target_crs}               # 变量引用
  columns: ["name", "type", "area"] # 列表
  options:                          # 嵌套字典
    simplify: true
    tolerance: 0.001
```

步骤函数通过 `StepContext` 获取参数：

```python
def my_step(ctx):
    path = ctx.param("path")                    # 获取参数
    distance = ctx.param("distance")
    keep = ctx.param("keep_original", default=False)  # 带默认值
    gdf = ctx.input("input")                    # 获取输入数据
```

---

## 4.3 步骤 ID 命名规则

### 4.3.1 合法字符

步骤 ID 只允许使用以下字符：

```
[a-z0-9_-]
```

即小写字母、数字、下划线和连字符。

| 示例 | 是否合法 | 说明 |
|------|---------|------|
| `load_data` | ✅ | 下划线连接 |
| `step-1` | ✅ | 连字符连接 |
| `buffer100` | ✅ | 字母加数字 |
| `Load_Data` | ❌ | 不允许大写字母 |
| `step.1` | ❌ | 不允许点号 |
| `步骤1` | ❌ | 不允许中文 |
| `step 1` | ❌ | 不允许空格 |

### 4.3.2 为什么不允许点号

步骤 ID 中不允许使用点号（`.`）的原因在于引用语法的歧义性：

```yaml
# 假设允许 step.1 作为 ID：
params:
  input: $step.1          # 是引用 step 的 "1" 属性？
                          # 还是引用 "step.1" 步骤？
  input: $step.1.output   # 更加混乱
```

点号在引用语法中用作属性分隔符（如 `$step_id.output`），因此步骤 ID 中不能包含点号，以避免解析歧义。

### 4.3.3 唯一性约束

同一流水线中，步骤 ID 必须唯一。验证器在 `validator.py` 中检查：

```python
def _check_duplicate_ids(self, steps: list[StepDefinition]):
    seen = set()
    for step in steps:
        if step.id in seen:
            raise ValidationError(
                f"Duplicate step ID: '{step.id}'"
            )
        seen.add(step.id)
```

### 4.3.4 命名最佳实践

```yaml
steps:
  # ✅ 推荐：动词_名词 格式，清晰描述步骤功能
  - id: load_roads
  - id: buffer_roads
  - id: clip_buildings
  - id: check_geometry
  - id: save_result

  # ❌ 不推荐：含义不清
  - id: step1
  - id: s2
  - id: temp
  - id: data
```

---

## 4.4 参数类型与格式

### 4.4.1 基本类型

步骤参数在 `StepInfo.params` 中声明其类型。GeoPipeAgent 支持的参数类型：

| 类型 | YAML 表示 | Python 类型 | 说明 |
|------|----------|------------|------|
| `string` | `"text"` | `str` | 文本字符串 |
| `number` | `3.14` | `float` | 浮点数 |
| `integer` | `16` | `int` | 整数 |
| `boolean` | `true/false` | `bool` | 布尔值 |
| `geodataframe` | `$step_id` | `GeoDataFrame` | 矢量数据 |
| `raster_info` | `$step_id` | `dict` | 栅格信息 |
| `list` | `[a, b, c]` | `list` | 列表 |
| `dict` | `{k: v}` | `dict` | 字典 |

### 4.4.2 `geodataframe` 类型

这是 GeoPipeAgent 中最常用的参数类型，表示一个 GeoPandas GeoDataFrame 对象。通常通过步骤引用传递：

```yaml
steps:
  - id: load
    use: io.read_file
    params:
      path: "data.shp"          # path 是 string 类型
  - id: buffer
    use: vector.buffer
    params:
      input: $load              # input 是 geodataframe 类型
      distance: 100             # distance 是 number 类型
```

### 4.4.3 `raster_info` 类型

栅格信息类型，通常包含波段数据、元数据等信息：

```yaml
steps:
  - id: read_raster
    use: raster.read
    params:
      path: "dem.tif"
  - id: raster_stats
    use: raster.stats
    params:
      input: $read_raster       # raster_info 类型
```

### 4.4.4 复合类型示例

```yaml
params:
  # 列表类型
  columns: ["name", "area", "population"]

  # 字典类型
  style:
    color: "red"
    weight: 2
    opacity: 0.8

  # 嵌套结构
  filter:
    field: "population"
    operator: ">"
    value: 10000
```

---

## 4.5 条件执行 `when` 表达式

### 4.5.1 基本语法

`when` 字段接受一个字符串表达式，当表达式求值为 `True` 时执行该步骤，否则跳过：

```yaml
steps:
  - id: optional_simplify
    use: vector.simplify
    params:
      input: $buffer
      tolerance: 0.001
    when: "${need_simplify} == true"
```

### 4.5.2 表达式求值流程

```
when 表达式字符串
       │
       ▼
PipelineContext.resolve()
  ├── 替换 ${var} 为变量值
  └── 替换 $step_id.attr 为步骤输出属性
       │
       ▼
safe_eval() 安全求值
  ├── AST 解析
  ├── 白名单节点检查
  └── 编译执行
       │
       ▼
布尔值 (True / False)
```

### 4.5.3 支持的操作符

`safe_eval.py` 使用 AST 白名单机制，只允许安全的操作：

| 类别 | 操作符 | 示例 |
|------|--------|------|
| 比较 | `==`, `!=`, `<`, `>`, `<=`, `>=` | `${count} > 100` |
| 逻辑 | `and`, `or`, `not` | `${a} > 0 and ${b} < 10` |
| 算术 | `+`, `-`, `*`, `/` | `${total} / ${count} > 5` |
| 包含 | `in`, `not in` | `${format} in ["shp", "geojson"]` |
| 身份 | `is`, `is not` | `${value} is not None` |

### 4.5.4 AST 安全验证

`utils/safe_eval.py` 通过 AST（抽象语法树）白名单确保表达式安全，防止代码注入：

```python
import ast

# 允许的 AST 节点类型白名单
ALLOWED_NODES = {
    ast.Expression,
    ast.Compare,
    ast.BoolOp,
    ast.UnaryOp,
    ast.BinOp,
    ast.Constant,     # 字面值：数字、字符串、布尔
    ast.Name,         # 变量名
    ast.Load,
    ast.And, ast.Or, ast.Not,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Add, ast.Sub, ast.Mult, ast.Div,
    ast.In, ast.NotIn, ast.Is, ast.IsNot,
    ast.List, ast.Tuple,
}

def safe_eval(expression: str) -> any:
    """安全求值表达式"""
    tree = ast.parse(expression, mode="eval")

    # 遍历所有节点，检查是否在白名单中
    for node in ast.walk(tree):
        if type(node) not in ALLOWED_NODES:
            raise ValueError(
                f"Unsafe expression node: {type(node).__name__}"
            )

    # 编译并执行
    code = compile(tree, "<expression>", "eval")
    return eval(code)
```

**被拒绝的危险操作**：

```yaml
# ❌ 函数调用被拒绝
when: "os.system('rm -rf /')"

# ❌ 导入被拒绝
when: "__import__('os').system('cmd')"

# ❌ 属性访问被拒绝
when: "''.__class__.__mro__[1]"
```

### 4.5.5 条件执行示例

```yaml
pipeline:
  variables:
    run_qc: true
    feature_count: 1000
    simplify_threshold: 500

  steps:
    - id: load
      use: io.read_file
      params:
        path: "data.shp"

    # 仅在 run_qc 为 true 时执行质检
    - id: quality_check
      use: qc.check_geometry
      params:
        input: $load
      when: "${run_qc} == true"

    # 仅在要素数量超过阈值时执行简化
    - id: simplify
      use: vector.simplify
      params:
        input: $load
        tolerance: 0.001
      when: "${feature_count} > ${simplify_threshold}"
```

---

## 4.6 错误处理策略 `on_error`

### 4.6.1 三种策略

| 策略 | 值 | 行为 |
|------|---|------|
| **终止** | `fail` | 抛出 `StepExecutionError`，终止流水线执行（默认） |
| **跳过** | `skip` | 记录错误信息，跳过该步骤，继续执行后续步骤 |
| **重试** | `retry` | 自动重试，最多 `MAX_RETRIES=3` 次 |

### 4.6.2 `fail` 策略（默认）

当步骤执行失败时，立即终止整个流水线：

```yaml
- id: critical_step
  use: io.read_file
  params:
    path: "important_data.shp"
  on_error: fail     # 默认值，可省略
```

适用场景：关键步骤，失败后继续执行没有意义的情况。

### 4.6.3 `skip` 策略

当步骤执行失败时，跳过该步骤，继续执行后续步骤：

```yaml
- id: optional_enrichment
  use: analysis.spatial_join
  params:
    input: $main_data
    join: $reference_data
  on_error: skip     # 即使失败也继续
```

适用场景：可选的数据增强步骤，失败不影响主流程。

**注意**：被跳过的步骤的输出为 `None`。如果后续步骤引用了被跳过步骤的输出，需要在 `when` 条件中做相应检查。

### 4.6.4 `retry` 策略

当步骤执行失败时，自动重试：

```yaml
- id: remote_fetch
  use: io.read_file
  params:
    path: "https://example.com/data.geojson"
  on_error: retry    # 网络请求可能暂时失败
```

重试机制源码（`executor.py`）：

```python
MAX_RETRIES = 3

def _execute_with_retry(self, step_def, step_ctx):
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            return self._execute_step(step_def, step_ctx)
        except Exception as e:
            last_error = e
            # 可以在这里添加退避策略
            continue
    # 所有重试都失败
    raise StepExecutionError(
        f"Step '{step_def.id}' failed after {MAX_RETRIES} retries: "
        f"{last_error}"
    )
```

### 4.6.5 混合使用示例

```yaml
pipeline:
  name: "健壮的分析流水线"
  steps:
    # 关键步骤：必须成功
    - id: load_main
      use: io.read_file
      params:
        path: "main_data.shp"
      on_error: fail

    # 网络数据获取：可能暂时失败
    - id: fetch_reference
      use: io.read_file
      params:
        path: "https://api.example.com/reference.geojson"
      on_error: retry

    # 可选步骤：失败时跳过
    - id: enrich
      use: analysis.spatial_join
      params:
        input: $load_main
        join: $fetch_reference
      on_error: skip

    # 核心分析：必须成功
    - id: buffer
      use: vector.buffer
      params:
        input: $load_main
        distance: 100
      on_error: fail
```

---

## 4.7 输出声明 `outputs`

### 4.7.1 基本语法

`outputs` 节点声明流水线的最终输出，使用步骤引用语法：

```yaml
pipeline:
  name: "分析示例"
  steps:
    - id: load
      use: io.read_file
      params:
        path: "data.shp"
    - id: buffer
      use: vector.buffer
      params:
        input: $load
        distance: 100
  outputs:
    buffered_data: "$buffer.output"
    feature_count: "$buffer.stats"
```

### 4.7.2 引用语法

| 引用格式 | 说明 |
|----------|------|
| `$step_id` | 引用步骤的完整 StepResult |
| `$step_id.output` | 引用步骤的输出数据 |
| `$step_id.stats` | 引用步骤的统计信息 |
| `$step_id.metadata` | 引用步骤的元数据 |
| `$step_id.issues` | 引用步骤的 QC 问题列表 |

### 4.7.3 报告中的展示

`outputs` 声明的内容会在 JSON 报告的顶层输出：

```json
{
  "pipeline": {
    "name": "分析示例",
    "status": "success"
  },
  "steps": [...],
  "outputs": {
    "buffered_data": "<GeoDataFrame summary>",
    "feature_count": {"count": 150}
  },
  "qc_summary": {...}
}
```

### 4.7.4 实用模式

```yaml
# 模式1：单一结果输出
outputs:
  result: "$final_step.output"

# 模式2：多个结果输出
outputs:
  buildings_in_buffer: "$intersect.output"
  buffer_zone: "$buffer.output"
  statistics: "$buffer.stats"

# 模式3：质检报告输出
outputs:
  data: "$load.output"
  geometry_issues: "$check_geom.issues"
  crs_issues: "$check_crs.issues"
```

---

## 4.8 完整流水线示例解析

### 4.8.1 buffer-analysis.yaml 逐行解析

以下是一个 Cookbook 示例 `buffer-analysis.yaml` 的逐行解析：

```yaml
pipeline:                          # ① 根节点
  name: "缓冲区分析"                # ② 流水线名称
  description: |                   # ③ 多行描述
    对道路数据进行缓冲区分析，
    并与建筑物数据进行叠加分析。
  crs: "EPSG:4326"                 # ④ 全局坐标系

  variables:                       # ⑤ 变量定义区
    buffer_distance: 500           #    缓冲距离（米）
    output_format: "geojson"       #    输出格式

  steps:                           # ⑥ 步骤列表开始
    - id: load_roads               # ⑦ 步骤1：加载道路数据
      use: io.read_file            #    使用 io.read_file 步骤
      params:
        path: "data/roads.shp"     #    输入文件路径

    - id: load_buildings           # ⑧ 步骤2：加载建筑物数据
      use: io.read_file
      params:
        path: "data/buildings.shp"

    - id: buffer_roads             # ⑨ 步骤3：创建缓冲区
      use: vector.buffer
      params:
        input: $load_roads         #    引用步骤1的输出
        distance: ${buffer_distance} #  使用变量

    - id: overlay_analysis         # ⑩ 步骤4：叠加分析
      use: analysis.overlay
      params:
        input: $load_buildings     #    引用步骤2
        overlay: $buffer_roads     #    引用步骤3
        how: "intersection"        #    叠加方式

    - id: save_result              # ⑪ 步骤5：保存结果
      use: io.write_file
      params:
        input: $overlay_analysis   #    引用步骤4
        path: "output/result.${output_format}"  # 使用变量拼接路径

  outputs:                         # ⑫ 输出声明
    affected_buildings: "$overlay_analysis.output"
    analysis_stats: "$overlay_analysis.stats"
```

### 4.8.2 执行顺序分析

```
步骤执行顺序：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 #  步骤 ID            依赖         输出
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1  load_roads         无           GeoDataFrame (roads)
 2  load_buildings     无           GeoDataFrame (buildings)
 3  buffer_roads       load_roads   GeoDataFrame (buffered)
 4  overlay_analysis   load_buildings, buffer_roads
                                    GeoDataFrame (intersection)
 5  save_result        overlay_analysis
                                    写入文件
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4.8.3 数据流向图

```
roads.shp ──▶ [load_roads] ──▶ [buffer_roads] ─────┐
                                                     ▼
buildings.shp ──▶ [load_buildings] ──▶ [overlay_analysis] ──▶ [save_result]
                                               │
                                               ▼
                                         output/result.geojson
```

---

## 4.9 YAML 解析器源码分析

### 4.9.1 `parser.py` 核心逻辑

```python
# engine/parser.py

import yaml
from ..models.pipeline import PipelineDefinition, StepDefinition
from ..errors import ParseError

class Parser:
    @staticmethod
    def parse_yaml(file_path: str) -> PipelineDefinition:
        """解析 YAML 文件，返回 PipelineDefinition"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                raw = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise ParseError(f"Invalid YAML: {e}")
        except FileNotFoundError:
            raise ParseError(f"File not found: {file_path}")

        # 检查根节点
        if not isinstance(raw, dict) or "pipeline" not in raw:
            raise ParseError("Missing 'pipeline' root node")

        pipeline_raw = raw["pipeline"]

        # 检查必填字段
        if "name" not in pipeline_raw:
            raise ParseError("Missing required field: pipeline.name")
        if "steps" not in pipeline_raw:
            raise ParseError("Missing required field: pipeline.steps")

        # 解析步骤列表
        steps = []
        for i, step_raw in enumerate(pipeline_raw["steps"]):
            if not isinstance(step_raw, dict):
                raise ParseError(f"Step {i} is not a valid mapping")
            if "id" not in step_raw:
                raise ParseError(f"Step {i} missing 'id' field")
            if "use" not in step_raw:
                raise ParseError(f"Step {i} missing 'use' field")

            step = StepDefinition(
                id=step_raw["id"],
                use=step_raw["use"],
                params=step_raw.get("params", {}),
                when=step_raw.get("when"),
                on_error=step_raw.get("on_error", "fail"),
                backend=step_raw.get("backend"),
            )
            steps.append(step)

        # 构建并返回 PipelineDefinition
        return PipelineDefinition(
            name=pipeline_raw["name"],
            steps=steps,
            description=pipeline_raw.get("description"),
            crs=pipeline_raw.get("crs"),
            variables=pipeline_raw.get("variables", {}),
            outputs=pipeline_raw.get("outputs", {}),
        )
```

### 4.9.2 YAML 安全加载

注意 `parser.py` 使用 `yaml.safe_load()` 而非 `yaml.load()`，这是为了防止 YAML 反序列化攻击：

```python
# ✅ 安全：只解析基本数据类型
raw = yaml.safe_load(f)

# ❌ 危险：可能执行任意 Python 代码
raw = yaml.load(f, Loader=yaml.FullLoader)
```

`yaml.safe_load()` 只支持以下 YAML 类型：
- 字符串、数字、布尔值、None
- 列表、字典
- 日期时间

### 4.9.3 错误处理

解析器会在以下情况抛出 `ParseError`：

| 情况 | 错误信息 |
|------|---------|
| 文件不存在 | `File not found: <path>` |
| YAML 语法错误 | `Invalid YAML: <details>` |
| 缺少 `pipeline` 根节点 | `Missing 'pipeline' root node` |
| 缺少 `name` 字段 | `Missing required field: pipeline.name` |
| 缺少 `steps` 字段 | `Missing required field: pipeline.steps` |
| 步骤缺少 `id` | `Step {i} missing 'id' field` |
| 步骤缺少 `use` | `Step {i} missing 'use' field` |

---

## 4.10 本章小结

本章详细解析了 YAML 流水线 Schema 的每个组成部分：

1. **顶层结构**：`pipeline` 根节点包含 `name`、`description`、`crs`、`variables`、`steps`、`outputs`
2. **步骤定义**：`id`（唯一标识）、`use`（步骤类型）、`params`（参数）、`when`（条件）、`on_error`（错误策略）、`backend`（后端选择）
3. **命名规则**：步骤 ID 只允许 `[a-z0-9_-]`，不允许点号（避免引用歧义）
4. **参数类型**：支持 string、number、boolean、geodataframe、raster_info 等类型
5. **条件执行**：`when` 表达式通过 AST 白名单安全求值
6. **错误处理**：fail（终止）、skip（跳过）、retry（重试最多 3 次）三种策略
7. **输出声明**：使用步骤引用语法声明流水线最终输出
8. **解析器**：`yaml.safe_load` 安全加载 + 严格字段检查

下一章我们将深入探讨变量系统与步骤引用机制。

---

[下一章：变量系统与步骤引用 →](05-变量系统与步骤引用.md)

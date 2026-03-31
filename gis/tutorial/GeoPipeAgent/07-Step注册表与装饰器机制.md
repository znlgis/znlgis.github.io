---
layout: default
title: "第7章：Step注册表与装饰器机制"
---

# 第7章：Step 注册表与装饰器机制

GeoPipeAgent 的核心扩展能力依赖于其步骤（Step）注册表系统。每个可执行的处理步骤都通过 `@step` 装饰器注册到全局注册表中，框架在运行时从注册表中查找并实例化步骤。本章将完整讲解装饰器语法、参数定义格式、StepInfo 数据结构、注册表 API、步骤加载机制，以及如何开发和注册自定义步骤。

---

## 7.1 @step 装饰器

### 7.1.1 装饰器基本用法

`@step` 装饰器用于将一个 Python 函数注册为 GeoPipeAgent 的可用步骤。被装饰的函数即为步骤的执行逻辑。

```python
from geopipe_agent.registry import step

@step(
    id="vector.buffer",
    name="矢量缓冲区分析",
    description="为矢量数据创建指定距离的缓冲区",
    category="vector",
)
def buffer(context):
    """执行缓冲区分析。"""
    gdf = context.param("input")
    distance = context.param("distance")
    result = gdf.buffer(distance)
    return result
```

### 7.1.2 装饰器完整参数说明

`@step` 装饰器接受以下参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `str` | ✅ | 步骤的唯一标识符，格式为 `category.name`，如 `vector.buffer` |
| `name` | `str` | ✅ | 步骤的人类可读名称（中文或英文） |
| `description` | `str` | ✅ | 步骤的详细描述，说明功能和用途 |
| `category` | `str` | ✅ | 步骤所属类别：`io`、`vector`、`raster`、`analysis`、`network`、`qc` |
| `params` | `list[dict]` | ❌ | 步骤接受的参数定义列表 |
| `outputs` | `list[dict]` | ❌ | 步骤的输出定义列表 |
| `backends` | `list[str]` | ❌ | 支持的后端列表，如 `["native_python", "qgis_process"]` |
| `examples` | `list[dict]` | ❌ | 使用示例列表，每个示例是一个 YAML 片段 |

### 7.1.3 完整装饰器示例

以下是一个包含所有参数的完整装饰器示例：

```python
from geopipe_agent.registry import step

@step(
    id="vector.buffer",
    name="矢量缓冲区分析",
    description=(
        "为输入的矢量数据（GeoDataFrame）创建指定距离的缓冲区。"
        "支持圆形、平头和方形三种端点样式。"
        "可通过 backends 参数选择使用 Python 原生实现或 QGIS 后端。"
    ),
    category="vector",
    params=[
        {
            "name": "input",
            "type": "geodataframe",
            "required": True,
            "description": "输入的 GeoDataFrame，包含要进行缓冲区分析的几何要素",
        },
        {
            "name": "distance",
            "type": "number",
            "required": True,
            "description": "缓冲区距离（单位取决于输入数据的 CRS）",
        },
        {
            "name": "cap_style",
            "type": "string",
            "required": False,
            "default": "round",
            "description": "缓冲区端点样式：round（圆形）、flat（平头）、square（方形）",
        },
        {
            "name": "join_style",
            "type": "string",
            "required": False,
            "default": "round",
            "description": "缓冲区连接样式：round（圆形）、mitre（尖角）、bevel（斜角）",
        },
        {
            "name": "resolution",
            "type": "number",
            "required": False,
            "default": 16,
            "description": "缓冲区圆弧的分段数，值越大越圆滑",
        },
    ],
    outputs=[
        {
            "name": "output",
            "type": "geodataframe",
            "description": "包含缓冲区几何体的 GeoDataFrame",
        },
    ],
    backends=["native_python", "qgis_process"],
    examples=[
        {
            "title": "基本缓冲区",
            "yaml": """
- id: buffer_step
  step: vector.buffer
  params:
    input: ${read_step.output}
    distance: 100
""",
        },
        {
            "title": "方形端点缓冲区",
            "yaml": """
- id: buffer_step
  step: vector.buffer
  params:
    input: ${read_step.output}
    distance: 50
    cap_style: square
""",
        },
    ],
)
def buffer(context):
    """执行缓冲区分析。"""
    gdf = context.param("input")
    distance = context.param("distance")
    cap_style = context.param("cap_style")
    join_style = context.param("join_style")
    resolution = context.param("resolution")

    # 转换端点样式为 Shapely 参数
    cap_style_map = {"round": 1, "flat": 2, "square": 3}
    join_style_map = {"round": 1, "mitre": 2, "bevel": 3}

    result_gdf = gdf.copy()
    result_gdf["geometry"] = gdf.geometry.buffer(
        distance,
        resolution=resolution,
        cap_style=cap_style_map.get(cap_style, 1),
        join_style=join_style_map.get(join_style, 1),
    )
    return result_gdf
```

---

## 7.2 参数定义格式

### 7.2.1 参数定义结构

每个参数是一个字典，包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `str` | ✅ | 参数名称，对应 YAML 中 `params` 下的键名 |
| `type` | `str` | ✅ | 参数类型（见下表） |
| `required` | `bool` | ❌ | 是否为必填参数，默认为 `False` |
| `default` | `Any` | ❌ | 参数默认值，仅在非必填时有意义 |
| `description` | `str` | ✅ | 参数的详细描述 |

### 7.2.2 支持的参数类型

| 类型标识 | Python 类型 | 说明 | 示例值 |
|---------|------------|------|--------|
| `geodataframe` | `geopandas.GeoDataFrame` | 矢量地理数据框 | 来自前序步骤的输出 |
| `number` | `int` 或 `float` | 数值类型 | `100`、`3.14`、`-0.5` |
| `string` | `str` | 字符串类型 | `"EPSG:4326"`、`"round"` |
| `boolean` | `bool` | 布尔类型 | `true`、`false` |
| `list` | `list` | 列表类型 | `["area", "name"]` |
| `dict` | `dict` | 字典类型 | `{"field": "value"}` |

### 7.2.3 参数类型的自动验证

当步骤被执行时，GeoPipeAgent 会自动验证参数类型是否匹配：

```python
# 参数类型验证逻辑（简化版）
TYPE_MAP = {
    "geodataframe": gpd.GeoDataFrame,
    "number": (int, float),
    "string": str,
    "boolean": bool,
    "list": list,
    "dict": dict,
}

def validate_param(param_def: dict, value: Any) -> None:
    """验证参数值是否与定义的类型匹配。"""
    expected_type = TYPE_MAP.get(param_def["type"])
    if expected_type and not isinstance(value, expected_type):
        raise PipelineValidationError(
            f"参数 '{param_def['name']}' 期望类型 {param_def['type']}，"
            f"但接收到 {type(value).__name__}"
        )
```

### 7.2.4 参数定义的完整示例

```python
params=[
    # 必填的 GeoDataFrame 参数
    {
        "name": "input",
        "type": "geodataframe",
        "required": True,
        "description": "输入的矢量数据",
    },

    # 必填的数值参数
    {
        "name": "distance",
        "type": "number",
        "required": True,
        "description": "缓冲区距离",
    },

    # 可选的字符串参数（带默认值）
    {
        "name": "cap_style",
        "type": "string",
        "required": False,
        "default": "round",
        "description": "端点样式: round, flat, square",
    },

    # 可选的布尔参数
    {
        "name": "preserve_topology",
        "type": "boolean",
        "required": False,
        "default": True,
        "description": "是否保持拓扑结构",
    },

    # 可选的列表参数
    {
        "name": "fields",
        "type": "list",
        "required": False,
        "default": [],
        "description": "要保留的属性字段列表",
    },

    # 可选的字典参数
    {
        "name": "options",
        "type": "dict",
        "required": False,
        "default": {},
        "description": "额外的处理选项",
    },
]
```

---

## 7.3 输出定义格式

### 7.3.1 输出定义结构

每个输出是一个字典，包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `str` | ✅ | 输出名称，通常为 `output` |
| `type` | `str` | ✅ | 输出类型（与参数类型相同） |
| `description` | `str` | ✅ | 输出的详细描述 |

### 7.3.2 输出定义示例

```python
# 单一输出（最常见）
outputs=[
    {
        "name": "output",
        "type": "geodataframe",
        "description": "处理后的矢量数据",
    },
]

# 多个输出
outputs=[
    {
        "name": "output",
        "type": "geodataframe",
        "description": "处理后的矢量数据",
    },
    {
        "name": "stats",
        "type": "dict",
        "description": "处理统计信息",
    },
]
```

### 7.3.3 输出与后续步骤的关联

步骤的输出可以通过变量引用在后续步骤中使用：

```yaml
steps:
  - id: buffer_step
    step: vector.buffer
    params:
      input: ${read_step.output}
      distance: 100

  # 引用 buffer_step 的主要输出
  - id: save_step
    step: io.write_vector
    params:
      input: ${buffer_step.output}       # 引用 output
      path: "result.geojson"

  # 引用 buffer_step 的统计信息
  - id: log_stats
    step: utils.log
    params:
      message: "处理了 ${buffer_step.stats.feature_count} 个要素"
```

---

## 7.4 StepInfo 类

### 7.4.1 类定义

`StepInfo` 是步骤元数据的数据容器，存储了 `@step` 装饰器传入的所有信息。注册表中存储的就是 `StepInfo` 对象。

```python
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

@dataclass
class StepInfo:
    """
    步骤元数据信息类。

    存储通过 @step 装饰器注册的步骤的完整元数据。
    """

    # 必填属性
    id: str                          # 步骤唯一标识符，如 "vector.buffer"
    name: str                        # 步骤名称，如 "矢量缓冲区分析"
    description: str                 # 步骤详细描述
    category: str                    # 步骤类别: io, vector, raster, analysis, network, qc
    func: Callable                   # 步骤执行函数的引用

    # 可选属性
    params: List[Dict[str, Any]] = field(default_factory=list)
    outputs: List[Dict[str, Any]] = field(default_factory=list)
    backends: List[str] = field(default_factory=lambda: ["native_python"])
    examples: List[Dict[str, Any]] = field(default_factory=list)
```

### 7.4.2 属性详解

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | `str` | 全局唯一标识符，格式为 `category.action`，如 `vector.buffer` |
| `name` | `str` | 人类可读的步骤名称 |
| `description` | `str` | 步骤功能的详细文字描述 |
| `category` | `str` | 步骤所属分类 |
| `func` | `Callable` | 指向步骤执行函数的引用 |
| `params` | `list[dict]` | 参数定义列表，每个元素是一个参数字典 |
| `outputs` | `list[dict]` | 输出定义列表 |
| `backends` | `list[str]` | 支持的后端列表 |
| `examples` | `list[dict]` | 使用示例列表 |

### 7.4.3 StepInfo 的使用

```python
from geopipe_agent.registry import registry

# 获取步骤信息
info = registry.get("vector.buffer")

# 访问各属性
print(f"ID: {info.id}")                    # vector.buffer
print(f"名称: {info.name}")                 # 矢量缓冲区分析
print(f"类别: {info.category}")             # vector
print(f"描述: {info.description}")          # 为输入的矢量数据创建...
print(f"后端: {info.backends}")             # ['native_python', 'qgis_process']

# 列出所有参数
for param in info.params:
    required = "必填" if param.get("required") else "可选"
    default = param.get("default", "无")
    print(f"  参数: {param['name']} ({param['type']}) [{required}] 默认值: {default}")
    print(f"    描述: {param['description']}")

# 列出所有输出
for output in info.outputs:
    print(f"  输出: {output['name']} ({output['type']})")
    print(f"    描述: {output['description']}")

# 查看示例
for example in info.examples:
    print(f"  示例: {example['title']}")
    print(f"    {example['yaml']}")
```

输出示例：

```
ID: vector.buffer
名称: 矢量缓冲区分析
类别: vector
描述: 为输入的矢量数据（GeoDataFrame）创建指定距离的缓冲区...
后端: ['native_python', 'qgis_process']
  参数: input (geodataframe) [必填] 默认值: 无
    描述: 输入的 GeoDataFrame，包含要进行缓冲区分析的几何要素
  参数: distance (number) [必填] 默认值: 无
    描述: 缓冲区距离（单位取决于输入数据的 CRS）
  参数: cap_style (string) [可选] 默认值: round
    描述: 缓冲区端点样式：round（圆形）、flat（平头）、square（方形）
  输出: output (geodataframe)
    描述: 包含缓冲区几何体的 GeoDataFrame
```

---

## 7.5 Registry API

### 7.5.1 Registry 类概览

`Registry` 是步骤注册表的核心类，它维护所有已注册步骤的映射关系。GeoPipeAgent 使用一个全局单例 `registry` 对象。

```python
class Registry:
    """
    步骤注册表。

    维护所有已注册步骤的全局映射，提供步骤查找、
    列举和分类等功能。
    """

    def __init__(self):
        self._steps: Dict[str, StepInfo] = {}

    def register(self, step_info: StepInfo) -> None:
        """注册一个步骤。"""
        if step_info.id in self._steps:
            raise ValueError(f"步骤 '{step_info.id}' 已存在，不能重复注册")
        self._steps[step_info.id] = step_info

    def get(self, step_id: str) -> StepInfo:
        """获取指定 ID 的步骤信息。"""
        ...

    def list_all(self) -> List[StepInfo]:
        """列出所有已注册步骤。"""
        ...

    def list_by_category(self, category: str) -> List[StepInfo]:
        """列出指定类别的所有步骤。"""
        ...

    def categories(self) -> List[str]:
        """列出所有步骤类别。"""
        ...

    def has(self, step_id: str) -> bool:
        """检查步骤是否已注册。"""
        ...


# 全局单例实例
registry = Registry()
```

### 7.5.2 API 方法详解

#### registry.get(step_id)

根据步骤 ID 获取 `StepInfo` 对象。如果步骤不存在，抛出 `StepNotFoundError`。

```python
from geopipe_agent.registry import registry
from geopipe_agent.errors import StepNotFoundError

# 获取已注册的步骤
info = registry.get("vector.buffer")
print(info.name)  # 矢量缓冲区分析

# 获取不存在的步骤
try:
    info = registry.get("vector.nonexistent")
except StepNotFoundError as e:
    print(e)  # 步骤类型 'vector.nonexistent' 未在注册表中找到
```

**方法签名：**

```python
def get(self, step_id: str) -> StepInfo:
    """
    获取指定 ID 的步骤信息。

    Args:
        step_id: 步骤的唯一标识符

    Returns:
        StepInfo 对象

    Raises:
        StepNotFoundError: 当步骤 ID 不存在时
    """
    if step_id not in self._steps:
        raise StepNotFoundError(step_id)
    return self._steps[step_id]
```

#### registry.list_all()

返回所有已注册步骤的列表。

```python
all_steps = registry.list_all()
print(f"共有 {len(all_steps)} 个已注册步骤")

for info in all_steps:
    print(f"  [{info.category}] {info.id}: {info.name}")
```

输出示例：

```
共有 18 个已注册步骤
  [io] io.read_vector: 读取矢量数据
  [io] io.read_raster: 读取栅格数据
  [io] io.write_vector: 写出矢量数据
  [io] io.write_raster: 写出栅格数据
  [vector] vector.buffer: 矢量缓冲区分析
  [vector] vector.clip: 矢量裁剪
  [vector] vector.dissolve: 矢量融合
  [vector] vector.overlay: 矢量叠加分析
  [vector] vector.query: 矢量查询
  [vector] vector.reproject: 矢量投影变换
  [vector] vector.simplify: 矢量简化
  [raster] raster.calc: 栅格波段运算
  [raster] raster.clip: 栅格裁剪
  [raster] raster.contour: 等值线提取
  [raster] raster.reproject: 栅格投影变换
  [raster] raster.stats: 栅格统计
  [qc] qc.geometry_validity: 几何有效性检查
  [network] network.shortest_path: 最短路径分析
```

**方法签名：**

```python
def list_all(self) -> List[StepInfo]:
    """
    列出所有已注册步骤。

    Returns:
        包含所有 StepInfo 对象的列表，按 ID 排序
    """
    return sorted(self._steps.values(), key=lambda s: s.id)
```

#### registry.list_by_category(category)

按类别筛选步骤。

```python
# 列出所有矢量分析步骤
vector_steps = registry.list_by_category("vector")
print(f"矢量步骤 ({len(vector_steps)} 个):")
for info in vector_steps:
    print(f"  {info.id}: {info.name}")

# 列出所有 IO 步骤
io_steps = registry.list_by_category("io")
print(f"IO 步骤 ({len(io_steps)} 个):")
for info in io_steps:
    print(f"  {info.id}: {info.name}")
```

输出示例：

```
矢量步骤 (7 个):
  vector.buffer: 矢量缓冲区分析
  vector.clip: 矢量裁剪
  vector.dissolve: 矢量融合
  vector.overlay: 矢量叠加分析
  vector.query: 矢量查询
  vector.reproject: 矢量投影变换
  vector.simplify: 矢量简化

IO 步骤 (4 个):
  io.read_vector: 读取矢量数据
  io.read_raster: 读取栅格数据
  io.write_vector: 写出矢量数据
  io.write_raster: 写出栅格数据
```

**方法签名：**

```python
def list_by_category(self, category: str) -> List[StepInfo]:
    """
    列出指定类别的所有步骤。

    Args:
        category: 步骤类别名称

    Returns:
        该类别下所有 StepInfo 对象的列表
    """
    return [
        info for info in self._steps.values()
        if info.category == category
    ]
```

#### registry.categories()

返回所有步骤类别的列表。

```python
cats = registry.categories()
print(f"步骤类别: {cats}")
# 步骤类别: ['analysis', 'io', 'network', 'qc', 'raster', 'vector']

for cat in cats:
    steps = registry.list_by_category(cat)
    print(f"  {cat}: {len(steps)} 个步骤")
```

**方法签名：**

```python
def categories(self) -> List[str]:
    """
    列出所有步骤类别。

    Returns:
        去重且排序后的类别名称列表
    """
    return sorted(set(info.category for info in self._steps.values()))
```

#### registry.has(step_id)

检查指定 ID 的步骤是否已注册。

```python
# 检查步骤是否存在
print(registry.has("vector.buffer"))    # True
print(registry.has("vector.unknown"))   # False

# 常见用法：在执行前检查
if not registry.has(step_config.step):
    raise StepNotFoundError(step_config.step)
```

**方法签名：**

```python
def has(self, step_id: str) -> bool:
    """
    检查步骤是否已注册。

    Args:
        step_id: 步骤的唯一标识符

    Returns:
        如果步骤已注册返回 True，否则返回 False
    """
    return step_id in self._steps
```

---

## 7.6 步骤加载机制

### 7.6.1 load_builtin_steps() 函数

当 GeoPipeAgent 启动时，会调用 `load_builtin_steps()` 函数加载所有内置步骤。该函数位于 `steps/__init__.py` 中。

```python
"""
steps/__init__.py - 内置步骤加载入口

在导入 steps 包时，自动加载并注册所有内置步骤。
"""

def load_builtin_steps():
    """
    加载所有内置步骤。

    通过导入各个步骤子模块来触发 @step 装饰器的执行，
    从而将所有内置步骤注册到全局注册表中。
    """
    # IO 步骤
    from geopipe_agent.steps import io_read_vector
    from geopipe_agent.steps import io_read_raster
    from geopipe_agent.steps import io_write_vector
    from geopipe_agent.steps import io_write_raster

    # 矢量分析步骤
    from geopipe_agent.steps import vector_buffer
    from geopipe_agent.steps import vector_clip
    from geopipe_agent.steps import vector_dissolve
    from geopipe_agent.steps import vector_overlay
    from geopipe_agent.steps import vector_query
    from geopipe_agent.steps import vector_reproject
    from geopipe_agent.steps import vector_simplify

    # 栅格分析步骤
    from geopipe_agent.steps import raster_calc
    from geopipe_agent.steps import raster_clip
    from geopipe_agent.steps import raster_contour
    from geopipe_agent.steps import raster_reproject
    from geopipe_agent.steps import raster_stats

    # QC 步骤
    from geopipe_agent.steps import qc_geometry_validity

    # 网络分析步骤
    from geopipe_agent.steps import network_shortest_path


# 模块导入时自动加载
load_builtin_steps()
```

### 7.6.2 自动加载流程

```
应用启动
  │
  ▼
import geopipe_agent
  │
  ▼
import geopipe_agent.steps
  │
  ▼
steps/__init__.py 被执行
  │
  ▼
load_builtin_steps() 被调用
  │
  ├── import io_read_vector  →  @step 装饰器执行  →  registry.register(StepInfo(...))
  ├── import io_read_raster  →  @step 装饰器执行  →  registry.register(StepInfo(...))
  ├── import vector_buffer   →  @step 装饰器执行  →  registry.register(StepInfo(...))
  ├── import vector_clip     →  @step 装饰器执行  →  registry.register(StepInfo(...))
  ├── ...（其他步骤模块）
  │
  ▼
所有内置步骤已注册到 registry 中
  │
  ▼
框架可以通过 registry.get("step_id") 获取任意已注册步骤
```

### 7.6.3 @step 装饰器的内部实现

```python
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

def step(
    id: str,
    name: str,
    description: str,
    category: str,
    params: Optional[List[Dict[str, Any]]] = None,
    outputs: Optional[List[Dict[str, Any]]] = None,
    backends: Optional[List[str]] = None,
    examples: Optional[List[Dict[str, Any]]] = None,
) -> Callable:
    """
    步骤注册装饰器。

    将一个 Python 函数注册为 GeoPipeAgent 的可用步骤。
    装饰器在模块导入时立即执行注册。

    Returns:
        装饰后的函数（保持原有行为不变）
    """
    def decorator(func: Callable) -> Callable:
        # 创建 StepInfo 对象
        step_info = StepInfo(
            id=id,
            name=name,
            description=description,
            category=category,
            func=func,
            params=params or [],
            outputs=outputs or [],
            backends=backends or ["native_python"],
            examples=examples or [],
        )

        # 注册到全局注册表
        registry.register(step_info)

        # 将 StepInfo 附加到函数上，便于直接访问
        func._step_info = step_info

        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        return wrapper

    return decorator
```

**关键点：**

1. 装饰器在 **模块导入时** 立即执行，不需要手动调用 `register()`
2. `StepInfo` 对象附加到函数的 `_step_info` 属性上
3. 使用 `@wraps(func)` 保留原函数的名称和文档

### 7.6.4 steps/ 目录结构

```
geopipe_agent/
└── steps/
    ├── __init__.py              # load_builtin_steps() 入口
    ├── _delegate.py             # 后端委托辅助模块
    │
    ├── io_read_vector.py        # io.read_vector
    ├── io_read_raster.py        # io.read_raster
    ├── io_write_vector.py       # io.write_vector
    ├── io_write_raster.py       # io.write_raster
    │
    ├── vector_buffer.py         # vector.buffer
    ├── vector_clip.py           # vector.clip
    ├── vector_dissolve.py       # vector.dissolve
    ├── vector_overlay.py        # vector.overlay
    ├── vector_query.py          # vector.query
    ├── vector_reproject.py      # vector.reproject
    ├── vector_simplify.py       # vector.simplify
    │
    ├── raster_calc.py           # raster.calc
    ├── raster_clip.py           # raster.clip
    ├── raster_contour.py        # raster.contour
    ├── raster_reproject.py      # raster.reproject
    ├── raster_stats.py          # raster.stats
    │
    ├── qc_geometry_validity.py  # qc.geometry_validity
    └── network_shortest_path.py # network.shortest_path
```

---

## 7.7 步骤分类体系

GeoPipeAgent 将所有内置步骤分为 6 个类别，每个类别包含一组功能相关的步骤。

### 7.7.1 分类总览

| 类别 | 前缀 | 说明 | 步骤数量 |
|------|------|------|---------|
| `io` | `io.` | 数据输入/输出步骤 | 4 |
| `vector` | `vector.` | 矢量数据分析步骤 | 7 |
| `raster` | `raster.` | 栅格数据分析步骤 | 5 |
| `analysis` | `analysis.` | 通用分析步骤 | 可扩展 |
| `network` | `network.` | 网络分析步骤 | 1+ |
| `qc` | `qc.` | 质量控制步骤 | 1+ |

### 7.7.2 完整的内置步骤列表

#### IO 步骤（io）

| 步骤 ID | 名称 | 说明 |
|---------|------|------|
| `io.read_vector` | 读取矢量数据 | 读取 Shapefile、GeoJSON、GPKG 等矢量文件 |
| `io.read_raster` | 读取栅格数据 | 读取 GeoTIFF 等栅格文件 |
| `io.write_vector` | 写出矢量数据 | 将 GeoDataFrame 写出为各种矢量格式 |
| `io.write_raster` | 写出栅格数据 | 将栅格数据写出为 GeoTIFF 等格式 |

#### 矢量分析步骤（vector）

| 步骤 ID | 名称 | 说明 |
|---------|------|------|
| `vector.buffer` | 矢量缓冲区分析 | 为几何要素创建缓冲区 |
| `vector.clip` | 矢量裁剪 | 按多边形边界裁剪矢量数据 |
| `vector.dissolve` | 矢量融合 | 按字段合并几何要素 |
| `vector.overlay` | 矢量叠加分析 | 集合运算：交集、并集、差集等 |
| `vector.query` | 矢量查询 | 属性查询和空间查询 |
| `vector.reproject` | 矢量投影变换 | 坐标参考系转换 |
| `vector.simplify` | 矢量简化 | 减少顶点数，简化几何形状 |

#### 栅格分析步骤（raster）

| 步骤 ID | 名称 | 说明 |
|---------|------|------|
| `raster.calc` | 栅格波段运算 | 波段数学运算（如 NDVI 计算） |
| `raster.clip` | 栅格裁剪 | 按矢量边界或 bbox 裁剪栅格 |
| `raster.contour` | 等值线提取 | 从 DEM 提取等值线 |
| `raster.reproject` | 栅格投影变换 | 栅格坐标参考系转换 |
| `raster.stats` | 栅格统计 | 计算栅格数据统计信息 |

#### QC 步骤（qc）

| 步骤 ID | 名称 | 说明 |
|---------|------|------|
| `qc.geometry_validity` | 几何有效性检查 | 检查和修复无效几何体 |

#### 网络分析步骤（network）

| 步骤 ID | 名称 | 说明 |
|---------|------|------|
| `network.shortest_path` | 最短路径分析 | 基于路网的最短路径计算 |

---

## 7.8 StepContext 类

### 7.8.1 类定义

`StepContext` 是传递给步骤执行函数的上下文对象，提供了访问参数、输入数据和管道上下文的接口。

```python
class StepContext:
    """
    步骤执行上下文。

    封装了步骤执行时需要的所有信息，包括参数值、
    输入数据、后端选择和管道级上下文。
    """

    def __init__(
        self,
        resolved_params: Dict[str, Any],
        backend: str,
        pipeline_context: "PipelineContext",
    ):
        self._params = resolved_params
        self._backend = backend
        self._pipeline_context = pipeline_context

    def param(self, name: str, default: Any = _MISSING) -> Any:
        """
        获取参数值。

        Args:
            name: 参数名称
            default: 默认值（如果参数不存在）

        Returns:
            参数值

        Raises:
            KeyError: 当参数不存在且未提供默认值时
        """
        if name in self._params:
            return self._params[name]
        if default is not _MISSING:
            return default
        raise KeyError(f"参数 '{name}' 不存在")

    def input(self, name: str = "input") -> Any:
        """
        获取输入数据。

        这是 param() 的便捷方法，默认获取名为 'input' 的参数。

        Args:
            name: 输入参数名称，默认为 "input"

        Returns:
            输入数据
        """
        return self.param(name)

    @property
    def params(self) -> Dict[str, Any]:
        """获取所有参数的字典。"""
        return dict(self._params)

    @property
    def backend(self) -> str:
        """获取当前使用的后端名称。"""
        return self._backend

    @property
    def pipeline_context(self) -> "PipelineContext":
        """获取管道级上下文。"""
        return self._pipeline_context
```

### 7.8.2 方法详解

#### context.param(name, default)

获取指定名称的参数值。

```python
@step(id="vector.buffer", ...)
def buffer(context: StepContext):
    # 获取必填参数
    gdf = context.param("input")
    distance = context.param("distance")

    # 获取可选参数（带默认值）
    cap_style = context.param("cap_style", "round")
    resolution = context.param("resolution", 16)
```

#### context.input(name)

获取输入数据的便捷方法，等价于 `context.param("input")`。

```python
@step(id="vector.simplify", ...)
def simplify(context: StepContext):
    # 以下两种写法等价
    gdf = context.input()           # 默认获取 "input" 参数
    gdf = context.param("input")    # 显式获取 "input" 参数

    # 如果有多个输入
    main_data = context.input("input")
    overlay_data = context.input("overlay")
```

#### context.params 属性

获取所有参数的字典副本。

```python
@step(id="io.write_vector", ...)
def write_vector(context: StepContext):
    all_params = context.params
    print(f"所有参数: {all_params}")
    # {'input': <GeoDataFrame>, 'path': 'output.geojson', 'driver': 'GeoJSON'}
```

#### context.backend 属性

获取当前使用的后端名称。

```python
@step(id="vector.buffer", backends=["native_python", "qgis_process"], ...)
def buffer(context: StepContext):
    if context.backend == "native_python":
        # 使用 GeoPandas 实现
        result = gdf.buffer(distance)
    elif context.backend == "qgis_process":
        # 使用 QGIS 后端实现
        result = _delegate_to_qgis(context)
```

#### context.pipeline_context 属性

获取管道级上下文，可以访问全局变量和其他管道级信息。

```python
@step(id="utils.log", ...)
def log_step(context: StepContext):
    # 访问管道级信息
    pipeline_name = context.pipeline_context.name
    vars = context.pipeline_context.vars
    print(f"管道 '{pipeline_name}' 正在执行...")
```

---

## 7.9 StepResult 类

### 7.9.1 类定义

`StepResult` 封装了步骤执行的返回结果，包括主要输出数据、统计信息、元数据和质量问题。

```python
class StepResult:
    """
    步骤执行结果。

    封装了步骤执行后的所有输出信息。支持通过属性访问
    和字典访问两种方式获取结果数据。
    """

    def __init__(
        self,
        output: Any = None,
        stats: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        issues: Optional[List[Dict[str, Any]]] = None,
    ):
        self.output = output           # 主要输出数据
        self.stats = stats or {}       # 统计信息字典
        self.metadata = metadata or {} # 元数据字典
        self.issues = issues or []     # 质量问题列表

    def __getattr__(self, name: str) -> Any:
        """
        支持点号表示法访问 stats 和 metadata 中的值。

        优先从 stats 中查找，然后从 metadata 中查找。

        Args:
            name: 属性名称

        Returns:
            属性值

        Raises:
            AttributeError: 当属性不存在时
        """
        if name.startswith("_"):
            raise AttributeError(name)

        # 优先从 stats 中查找
        if name in self.stats:
            return self.stats[name]

        # 其次从 metadata 中查找
        if name in self.metadata:
            return self.metadata[name]

        raise AttributeError(
            f"StepResult 没有属性 '{name}'。"
            f"可用的 stats: {list(self.stats.keys())}, "
            f"可用的 metadata: {list(self.metadata.keys())}"
        )
```

### 7.9.2 属性详解

| 属性 | 类型 | 说明 |
|------|------|------|
| `output` | `Any` | 步骤的主要输出数据（如 GeoDataFrame） |
| `stats` | `dict` | 统计信息字典，如 feature_count、crs、bounds 等 |
| `metadata` | `dict` | 元数据字典，如 duration、backend、version 等 |
| `issues` | `list[dict]` | 质量问题列表，每个问题包含 type、message、severity |

### 7.9.3 使用示例

```python
# 步骤执行后获取结果
result = step_executor.execute(step_config, context)

# 访问主要输出
gdf = result.output
print(type(gdf))  # <class 'geopandas.GeoDataFrame'>

# 访问统计信息（字典方式）
print(result.stats["feature_count"])  # 5000
print(result.stats["crs"])            # EPSG:4326

# 访问统计信息（点号表示法 - __getattr__）
print(result.feature_count)  # 5000
print(result.crs)            # EPSG:4326

# 访问元数据
print(result.metadata["duration"])  # 1.234
print(result.metadata["backend"])   # native_python

# 访问质量问题
for issue in result.issues:
    print(f"[{issue['severity']}] {issue['message']}")
```

### 7.9.4 在 YAML 中引用 StepResult

```yaml
steps:
  - id: read_step
    step: io.read_vector
    params:
      path: "input.shp"

  # 引用 output
  - id: buffer_step
    step: vector.buffer
    params:
      input: ${read_step.output}      # StepResult.output
      distance: 100

  # 在 when 条件中引用 stats
  - id: simplify_step
    step: vector.simplify
    params:
      input: ${read_step.output}
      tolerance: 0.001
    when: "${read_step.stats.feature_count} > 10000"
```

---

## 7.10 完整的自定义步骤示例

### 7.10.1 需求描述

假设我们需要创建一个自定义步骤 `analysis.centroid`，用于计算多边形的质心点。

### 7.10.2 步骤定义

创建文件 `my_steps/analysis_centroid.py`：

```python
"""
analysis_centroid.py - 计算多边形质心步骤

自定义步骤示例，展示如何开发和注册一个新的 GeoPipeAgent 步骤。
"""
import geopandas as gpd
from geopipe_agent.registry import step
from geopipe_agent.context import StepContext
from geopipe_agent.result import StepResult


@step(
    id="analysis.centroid",
    name="多边形质心计算",
    description=(
        "计算输入多边形要素的质心（重心）点。"
        "输出一个包含质心点几何体的 GeoDataFrame，"
        "保留原始要素的所有属性字段。"
    ),
    category="analysis",
    params=[
        {
            "name": "input",
            "type": "geodataframe",
            "required": True,
            "description": "输入的多边形 GeoDataFrame",
        },
        {
            "name": "inside",
            "type": "boolean",
            "required": False,
            "default": False,
            "description": (
                "是否确保质心点在多边形内部。"
                "True 时使用 representative_point()（保证在多边形内），"
                "False 时使用 centroid（几何重心，可能在多边形外）"
            ),
        },
    ],
    outputs=[
        {
            "name": "output",
            "type": "geodataframe",
            "description": "包含质心点几何体的 GeoDataFrame",
        },
    ],
    backends=["native_python"],
    examples=[
        {
            "title": "基本质心计算",
            "yaml": """
- id: centroid_step
  step: analysis.centroid
  params:
    input: ${read_step.output}
""",
        },
        {
            "title": "确保质心在多边形内部",
            "yaml": """
- id: centroid_step
  step: analysis.centroid
  params:
    input: ${read_step.output}
    inside: true
""",
        },
    ],
)
def centroid(context: StepContext) -> StepResult:
    """
    计算多边形质心。

    Args:
        context: 步骤执行上下文

    Returns:
        包含质心点和统计信息的 StepResult
    """
    # 获取参数
    gdf = context.param("input")
    inside = context.param("inside", False)

    # 验证输入
    if gdf.empty:
        return StepResult(
            output=gdf,
            stats={"feature_count": 0},
            issues=[{
                "type": "warning",
                "message": "输入数据为空，没有要素需要处理",
                "severity": "low",
            }],
        )

    # 计算质心
    result_gdf = gdf.copy()
    if inside:
        result_gdf["geometry"] = gdf.geometry.representative_point()
    else:
        result_gdf["geometry"] = gdf.geometry.centroid

    # 统计信息
    stats = {
        "feature_count": len(result_gdf),
        "crs": str(result_gdf.crs),
        "bounds": result_gdf.total_bounds.tolist(),
        "method": "representative_point" if inside else "centroid",
    }

    # 元数据
    metadata = {
        "input_geometry_types": list(gdf.geometry.geom_type.unique()),
        "output_geometry_type": "Point",
    }

    return StepResult(
        output=result_gdf,
        stats=stats,
        metadata=metadata,
    )
```

### 7.10.3 注册自定义步骤

有两种方式将自定义步骤注册到 GeoPipeAgent：

#### 方式一：在 YAML 中指定 plugins 目录

```yaml
name: 使用自定义步骤
plugins:
  - path: "./my_steps"

steps:
  - id: read_step
    step: io.read_vector
    params:
      path: "polygons.shp"

  - id: centroid_step
    step: analysis.centroid
    params:
      input: ${read_step.output}
      inside: true

  - id: save_step
    step: io.write_vector
    params:
      input: ${centroid_step.output}
      path: "centroids.geojson"
```

#### 方式二：在 Python 代码中手动导入

```python
# 导入自定义步骤模块即可完成注册（@step 装饰器在导入时自动执行）
import my_steps.analysis_centroid

# 验证注册成功
from geopipe_agent.registry import registry
assert registry.has("analysis.centroid")

# 执行流水线
pipeline = Pipeline.from_yaml("pipeline.yaml")
result = pipeline.execute()
```

#### 方式三：通过环境变量指定插件目录

```bash
export GEOPIPE_PLUGINS_DIR="./my_steps"
geopipe-agent run pipeline.yaml
```

### 7.10.4 在流水线中使用

```yaml
name: 多边形质心分析流水线
description: 读取多边形数据，计算质心并保存

steps:
  - id: read_polygons
    step: io.read_vector
    params:
      path: "buildings.shp"

  - id: reproject
    step: vector.reproject
    params:
      input: ${read_polygons.output}
      target_crs: "EPSG:4326"

  - id: calc_centroid
    step: analysis.centroid
    params:
      input: ${reproject.output}
      inside: true

  - id: save_centroids
    step: io.write_vector
    params:
      input: ${calc_centroid.output}
      path: "building_centroids.geojson"
```

### 7.10.5 测试自定义步骤

```python
"""
test_analysis_centroid.py - 质心步骤单元测试
"""
import pytest
import geopandas as gpd
from shapely.geometry import Polygon
from geopipe_agent.registry import registry
from geopipe_agent.context import StepContext
from geopipe_agent.result import StepResult


@pytest.fixture
def sample_polygons():
    """创建测试用的多边形数据。"""
    polys = [
        Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
        Polygon([(2, 2), (4, 2), (4, 4), (2, 4)]),
    ]
    return gpd.GeoDataFrame(
        {"name": ["A", "B"]},
        geometry=polys,
        crs="EPSG:4326",
    )


def test_centroid_registered():
    """测试步骤已成功注册。"""
    assert registry.has("analysis.centroid")
    info = registry.get("analysis.centroid")
    assert info.name == "多边形质心计算"
    assert info.category == "analysis"


def test_centroid_basic(sample_polygons):
    """测试基本质心计算。"""
    context = StepContext(
        resolved_params={"input": sample_polygons, "inside": False},
        backend="native_python",
        pipeline_context=None,
    )

    info = registry.get("analysis.centroid")
    result = info.func(context)

    assert isinstance(result, StepResult)
    assert len(result.output) == 2
    assert result.stats["feature_count"] == 2
    assert all(result.output.geometry.geom_type == "Point")


def test_centroid_inside(sample_polygons):
    """测试确保质心在多边形内部。"""
    context = StepContext(
        resolved_params={"input": sample_polygons, "inside": True},
        backend="native_python",
        pipeline_context=None,
    )

    info = registry.get("analysis.centroid")
    result = info.func(context)

    # 验证所有质心点在对应多边形内
    for idx, row in result.output.iterrows():
        original_poly = sample_polygons.geometry.iloc[idx]
        assert original_poly.contains(row.geometry)


def test_centroid_empty_input():
    """测试空输入处理。"""
    empty_gdf = gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
    context = StepContext(
        resolved_params={"input": empty_gdf, "inside": False},
        backend="native_python",
        pipeline_context=None,
    )

    info = registry.get("analysis.centroid")
    result = info.func(context)

    assert result.stats["feature_count"] == 0
    assert len(result.issues) == 1
    assert result.issues[0]["type"] == "warning"
```

---

## 7.11 步骤发现与注册流程图

下面是 GeoPipeAgent 从启动到执行步骤的完整流程图：

```
┌─────────────────────────────────────────────────────────────────┐
│                     应用启动阶段                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. import geopipe_agent                                        │
│     └── import geopipe_agent.steps                             │
│         └── load_builtin_steps()                               │
│             ├── import io_read_vector   → @step → register()   │
│             ├── import io_read_raster   → @step → register()   │
│             ├── import vector_buffer    → @step → register()   │
│             ├── import vector_clip      → @step → register()   │
│             ├── ...                                             │
│             └── 所有内置步骤注册完毕                              │
│                                                                 │
│  2. 加载插件目录（如果配置了）                                    │
│     └── scan_plugins(plugins_dir)                              │
│         ├── import analysis_centroid    → @step → register()   │
│         └── ...                                                 │
│                                                                 │
│  3. Registry 就绪                                               │
│     └── registry._steps = {                                    │
│           "io.read_vector": StepInfo(...),                     │
│           "vector.buffer": StepInfo(...),                      │
│           "analysis.centroid": StepInfo(...),                  │
│           ...                                                   │
│         }                                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     流水线解析阶段                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  4. Pipeline.from_yaml("pipeline.yaml")                        │
│     ├── 解析 YAML 文件                                          │
│     ├── 提取步骤配置列表                                         │
│     └── 对每个步骤:                                              │
│         ├── 验证 step type 在 registry 中存在                    │
│         ├── 验证必填参数完整                                      │
│         └── 验证参数类型匹配                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     流水线执行阶段                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  5. pipeline.execute()                                          │
│     └── 对每个步骤配置:                                          │
│         ├── 解析变量引用 ${...}                                  │
│         ├── 求值 when 条件（如果有）                              │
│         ├── registry.get(step_type) → StepInfo                 │
│         ├── 选择后端（auto/指定）                                 │
│         ├── 创建 StepContext                                    │
│         ├── 调用 step_info.func(context) → StepResult          │
│         ├── 记录结果到 PipelineContext                           │
│         └── 如果失败，按 on_error 策略处理                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7.12 本章小结

本章详细介绍了 GeoPipeAgent 的步骤注册表和装饰器机制：

| 主题 | 要点 |
|------|------|
| **@step 装饰器** | 8 个参数完整定义步骤元数据，在模块导入时自动注册 |
| **参数定义** | 支持 6 种类型，带自动类型验证 |
| **StepInfo** | 步骤元数据容器，存储装饰器的所有信息 |
| **Registry API** | get/list_all/list_by_category/categories/has 五个核心方法 |
| **加载机制** | `__init__.py` 中集中导入，触发装饰器注册 |
| **分类体系** | io/vector/raster/analysis/network/qc 六大类别 |
| **StepContext** | 步骤执行上下文，提供参数、后端、管道上下文的访问 |
| **StepResult** | 步骤执行结果，支持点号表示法访问 |
| **自定义步骤** | 定义 → 注册 → 使用 → 测试 完整流程 |

下一章我们将详细介绍所有 IO 步骤的使用方法。

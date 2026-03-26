---
layout: default
title: "第6章：Step注册表与插件系统"
---

# 第6章：Step注册表与插件系统

> 本章将深入剖析 GeoPipeAgent 的步骤注册表机制与插件系统设计。您将了解 `@step` 装饰器的工作原理、`StepInfo` 数据结构的各个字段含义、模块级注册表的管理接口，以及步骤模块的自动发现加载机制。

---

## 6.1 插件系统概述

### 6.1.1 为什么需要注册表

在 GeoPipeAgent 中，流水线由一系列"步骤"（Step）组成。每个步骤对应一个具体的地理空间处理操作，例如读取矢量数据、执行缓冲区分析、投影转换等。为了让引擎能够：

1. **按 ID 查找步骤**：YAML 流水线中通过 `step: io.read_vector` 这样的字符串来引用步骤，引擎需要一种机制将字符串映射到实际的 Python 函数。
2. **列举所有可用步骤**：LLM 在规划流水线时，需要获取所有可用步骤的清单（包括参数、描述等）来生成合理的处理方案。
3. **按类别组织步骤**：步骤被分为 `io`、`vector`、`raster`、`analysis` 等类别，便于管理和展示。
4. **支持扩展**：用户可以编写自定义步骤并注册到系统中，无需修改核心代码。

注册表（Registry）模式正是解决这些需求的经典设计模式。

### 6.1.2 设计理念

GeoPipeAgent 的注册表遵循以下设计原则：

| 原则 | 说明 |
|------|------|
| **声明式注册** | 通过 `@step` 装饰器在函数定义处声明元信息，无需额外配置文件 |
| **模块级单例** | 全局唯一的 `_steps` 字典作为注册表，所有步骤注册到同一处 |
| **自动发现** | 利用 `pkgutil.walk_packages` 自动扫描并加载步骤模块 |
| **元信息驱动** | 每个步骤携带丰富的元信息（参数、输出、示例），可用于 LLM 技能生成 |
| **零耦合** | 步骤模块之间互相独立，注册表与步骤实现完全解耦 |

```
┌─────────────────────────────────────────────────────────┐
│                    注册表架构                              │
│                                                         │
│  ┌──────────┐    @step 装饰器     ┌──────────────────┐  │
│  │ step_a.py│ ──────────────────▶ │                  │  │
│  └──────────┘                     │   _steps 字典     │  │
│  ┌──────────┐    @step 装饰器     │                  │  │
│  │ step_b.py│ ──────────────────▶ │  {id: StepInfo}  │  │
│  └──────────┘                     │                  │  │
│  ┌──────────┐    @step 装饰器     │                  │  │
│  │ step_c.py│ ──────────────────▶ │                  │  │
│  └──────────┘                     └────────┬─────────┘  │
│                                            │            │
│                                    get / list_all /     │
│                                    list_by_category     │
│                                            │            │
│                                   ┌────────▼─────────┐  │
│                                   │   Pipeline Engine │  │
│                                   └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 6.2 StepInfo 数据结构详解

`StepInfo` 是步骤元信息的核心数据类，使用 Python `dataclass` 定义：

```python
from dataclasses import dataclass, field
from typing import Callable

@dataclass
class StepInfo:
    id: str
    func: Callable
    name: str = ""
    description: str = ""
    category: str = ""
    params: dict = field(default_factory=dict)
    outputs: dict = field(default_factory=dict)
    backends: list[str] = field(default_factory=list)
    examples: list[dict] = field(default_factory=list)
```

### 6.2.1 各字段含义

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | `str` | ✅ | 步骤的唯一标识符，格式为 `类别.操作`，如 `io.read_vector` |
| `func` | `Callable` | ✅ | 步骤的实际执行函数引用 |
| `name` | `str` | ❌ | 人类可读的步骤名称，如 `"读取矢量数据"` |
| `description` | `str` | ❌ | 步骤的详细描述，用于 LLM 理解步骤功能 |
| `category` | `str` | ❌ | 步骤所属类别，如 `io`、`vector`、`raster`、`analysis` |
| `params` | `dict` | ❌ | 步骤的参数定义字典，描述每个参数的类型和约束 |
| `outputs` | `dict` | ❌ | 步骤的输出定义字典，描述返回值结构 |
| `backends` | `list[str]` | ❌ | 支持的后端列表，如 `["native_python", "qgis_process"]` |
| `examples` | `list[dict]` | ❌ | 使用示例列表，用于 LLM 技能文件生成 |

### 6.2.2 params 字典的 Schema

`params` 字典的键是参数名，值是描述该参数的字典。典型结构如下：

```python
params = {
    "path": {
        "type": "str",
        "required": True,
        "description": "输入文件路径"
    },
    "layer": {
        "type": "str",
        "required": False,
        "default": None,
        "description": "要读取的图层名称（用于多图层格式如 GPKG）"
    },
    "encoding": {
        "type": "str",
        "required": False,
        "default": "utf-8",
        "description": "文件编码"
    }
}
```

每个参数定义可包含以下字段：

| 字段 | 说明 |
|------|------|
| `type` | 参数类型，如 `str`、`int`、`float`、`bool`、`GeoDataFrame` |
| `required` | 是否为必需参数 |
| `default` | 默认值 |
| `description` | 参数描述 |
| `enum` | 可选值列表，如 `["round", "flat", "square"]` |

### 6.2.3 outputs 字典的结构

`outputs` 字典描述步骤的输出结构：

```python
outputs = {
    "result": {
        "type": "GeoDataFrame",
        "description": "处理后的地理数据框"
    },
    "stats": {
        "type": "dict",
        "description": "处理统计信息，包含 feature_count, crs 等"
    }
}
```

### 6.2.4 backends 列表

`backends` 列表声明步骤支持的后端实现：

```python
backends = ["native_python", "qgis_process"]
```

当前 GeoPipeAgent 支持的后端：

- **`native_python`**：基于 geopandas / shapely / rasterio 的纯 Python 实现
- **`qgis_process`**：通过 QGIS Processing 框架执行（需安装 QGIS）

### 6.2.5 examples 列表

`examples` 列表提供步骤的使用示例，用于 LLM 生成技能文件时参考：

```python
examples = [
    {
        "title": "读取 Shapefile",
        "params": {
            "path": "data/buildings.shp",
            "encoding": "utf-8"
        }
    },
    {
        "title": "读取 GeoPackage 指定图层",
        "params": {
            "path": "data/city.gpkg",
            "layer": "roads"
        }
    }
]
```

---

## 6.3 @step 装饰器详解

### 6.3.1 装饰器源码分析

`@step` 装饰器是注册步骤的核心入口：

```python
def step(id, name="", description="", category="",
         params=None, outputs=None, backends=None, examples=None):
    """步骤注册装饰器。"""
    def decorator(func):
        # 自动推导类别：如果未指定 category，从 id 中提取
        cat = category or (id.split(".")[0] if "." in id else "")

        # 构造 StepInfo 对象
        info = StepInfo(
            id=id,
            func=func,
            name=name,
            description=description,
            category=cat,
            params=params or {},
            outputs=outputs or {},
            backends=backends or [],
            examples=examples or [],
        )

        # 注册到全局注册表
        register(info)

        # 将 StepInfo 附加到函数对象上
        func._step_info = info

        return func
    return decorator
```

### 6.3.2 自动推导 category

装饰器中有一个巧妙的设计——自动从 `id` 推导 `category`：

```python
cat = category or (id.split(".")[0] if "." in id else "")
```

这意味着：

- 如果显式指定了 `category`，则使用指定值
- 如果未指定，且 `id` 包含点号，则取点号前的部分作为类别
- 例如 `id="io.read_vector"` → `category="io"`
- 例如 `id="vector.buffer"` → `category="vector"`

这种约定大于配置的设计减少了重复代码，同时保留了灵活性。

### 6.3.3 _step_info 属性

装饰器会将 `StepInfo` 对象附加到被装饰函数的 `_step_info` 属性上：

```python
func._step_info = info
```

这使得我们可以在任何持有函数引用的地方获取其元信息：

```python
from geopipe_agent.steps.io.read_vector import read_vector

# 通过函数属性获取 StepInfo
info = read_vector._step_info
print(info.id)          # "io.read_vector"
print(info.category)    # "io"
print(info.params)      # {...}
```

### 6.3.4 使用示例

下面是一个典型的步骤注册示例：

```python
from geopipe_agent.registry import step

@step(
    id="vector.buffer",
    name="缓冲区分析",
    description="对输入几何要素创建指定距离的缓冲区",
    params={
        "input": {"type": "GeoDataFrame", "required": True,
                  "description": "输入矢量数据"},
        "distance": {"type": "float", "required": True,
                     "description": "缓冲距离"},
        "cap_style": {"type": "str", "required": False,
                      "default": "round",
                      "enum": ["round", "flat", "square"],
                      "description": "端点样式"},
    },
    outputs={
        "result": {"type": "GeoDataFrame",
                   "description": "缓冲区结果"}
    },
    backends=["native_python", "qgis_process"],
    examples=[
        {
            "title": "创建500米缓冲区",
            "params": {"distance": 500, "cap_style": "round"}
        }
    ],
)
def buffer(ctx):
    """执行缓冲区分析。"""
    ...
```

---

## 6.4 模块级注册表

### 6.4.1 _steps 字典

注册表的核心是一个模块级字典 `_steps`：

```python
_steps: dict[str, StepInfo] = {}
```

键为步骤 ID（字符串），值为对应的 `StepInfo` 对象。这个字典在 `registry.py` 模块加载时创建，整个进程生命周期内保持为单例。

### 6.4.2 注册与查询接口

注册表提供了一组简洁的管理接口：

#### register(info) — 注册步骤

```python
def register(info: StepInfo) -> None:
    _steps[info.id] = info
```

将一个 `StepInfo` 对象注册到全局字典中。如果 ID 已存在则覆盖（后注册的覆盖先注册的）。

#### get(step_id) — 获取单个步骤

```python
def get(step_id: str) -> StepInfo | None:
    return _steps.get(step_id)
```

按 ID 查询步骤。返回 `StepInfo` 对象，未找到则返回 `None`。这是流水线引擎执行步骤时的核心查询路径。

#### list_all() — 列举所有步骤

```python
def list_all() -> list[StepInfo]:
    return list(_steps.values())
```

返回所有已注册步骤的列表。常用于 `list-steps` 命令和 LLM 技能生成。

#### list_by_category(category) — 按类别过滤

```python
def list_by_category(category: str) -> list[StepInfo]:
    return [s for s in _steps.values() if s.category == category]
```

返回指定类别下的所有步骤。例如 `list_by_category("vector")` 返回所有矢量分析步骤。

#### has(step_id) — 检查步骤是否存在

```python
def has(step_id: str) -> bool:
    return step_id in _steps
```

快速检查某个 ID 是否已注册。用于流水线校验阶段。

#### categories() — 获取所有类别

```python
def categories() -> list[str]:
    return sorted({s.category for s in _steps.values()})
```

返回去重并排序后的所有类别列表。例如 `["analysis", "io", "raster", "vector"]`。

#### reset() — 重置注册表

```python
def reset() -> None:
    _steps.clear()
```

清空所有已注册步骤。主要用于测试场景，确保测试之间互不影响。

### 6.4.3 接口使用示例

```python
from geopipe_agent import registry

# 确保已加载内置步骤
from geopipe_agent.steps import load_builtin_steps
load_builtin_steps()

# 列举所有类别
print(registry.categories())
# ['analysis', 'io', 'raster', 'vector']

# 获取所有 IO 步骤
io_steps = registry.list_by_category("io")
for s in io_steps:
    print(f"  {s.id}: {s.name}")
# io.read_vector: 读取矢量数据
# io.write_vector: 写入矢量数据
# io.read_raster: 读取栅格数据
# io.write_raster: 写入栅格数据

# 检查并获取特定步骤
if registry.has("vector.buffer"):
    info = registry.get("vector.buffer")
    print(f"参数: {list(info.params.keys())}")
    print(f"后端: {info.backends}")
```

---

## 6.5 自动发现机制

### 6.5.1 pkgutil.walk_packages 原理

Python 标准库的 `pkgutil.walk_packages` 函数可以递归遍历一个包目录下的所有模块和子包。它返回的每个元素包含三个值：

- `_importer`：导入器对象
- `modname`：完整的模块名（如 `geopipe_agent.steps.io.read_vector`）
- `ispkg`：是否为包（即是否是一个目录而非单个 `.py` 文件）

### 6.5.2 _iter_step_modules 函数

```python
import pkgutil
import importlib
from pathlib import Path

_SKIP_MODULES = {"_delegate", "_common", "_utils"}

def _iter_step_modules():
    """迭代所有步骤模块名称。"""
    package_dir = str(Path(__file__).resolve().parent)
    prefix = "geopipe_agent.steps."

    for _importer, modname, ispkg in pkgutil.walk_packages(
        [package_dir], prefix=prefix
    ):
        # 提取短名称
        short = modname[len(prefix):]

        # 跳过内部辅助模块
        if short in _SKIP_MODULES:
            continue

        # 跳过包本身（只导入叶子模块）
        if ispkg:
            continue

        yield modname
```

关键设计点：

1. **`_SKIP_MODULES` 黑名单**：跳过以下划线开头的辅助模块（如 `_delegate.py`、`_common.py`），这些模块不包含步骤定义。
2. **只处理叶子模块**：`ispkg` 为 `True` 的子包被跳过，因为步骤定义在具体的 `.py` 文件中，而非 `__init__.py` 中。
3. **使用 prefix 确保完整的模块路径**：`prefix="geopipe_agent.steps."` 保证生成的模块名是可直接导入的完整路径。

### 6.5.3 load_builtin_steps 函数

```python
def load_builtin_steps():
    """加载所有内置步骤模块。"""
    for modname in _iter_step_modules():
        importlib.import_module(modname)
```

这个函数的工作原理非常精妙：

1. 遍历所有步骤模块名称
2. 使用 `importlib.import_module` 导入每个模块
3. 模块被导入时，其顶层代码被执行——包括 `@step` 装饰器
4. 装饰器调用 `register(info)`，将步骤注册到全局 `_steps` 字典

整个过程是**声明驱动**的：只要模块中有 `@step` 装饰的函数，导入该模块就自动完成注册。

### 6.5.4 自动发现流程图

```
load_builtin_steps()
        │
        ▼
_iter_step_modules()
        │
        ▼
pkgutil.walk_packages(steps_dir)
        │
        ├──▶ geopipe_agent.steps.io.read_vector
        │         │
        │         ▼
        │    importlib.import_module(...)
        │         │
        │         ▼
        │    @step 装饰器执行
        │         │
        │         ▼
        │    registry.register(StepInfo(...))
        │         │
        │         ▼
        │    _steps["io.read_vector"] = StepInfo(...)
        │
        ├──▶ geopipe_agent.steps.io.write_vector
        │         │ ... (同上)
        │
        ├──▶ geopipe_agent.steps.vector.buffer
        │         │ ... (同上)
        │
        └──▶ ... (其他模块)
```

### 6.5.5 延迟加载与按需加载

默认情况下，`load_builtin_steps()` 会在应用启动时一次性加载所有步骤模块。如果某些步骤有较重的依赖（如 `analysis` 步骤依赖 `scipy`、`sklearn`），可以在模块内部使用延迟导入：

```python
@step(id="analysis.voronoi", ...)
def voronoi(ctx):
    # 延迟导入重量级依赖
    from scipy.spatial import Voronoi as ScipyVoronoi
    import shapely
    ...
```

这样即使模块被加载，重量级依赖也只在步骤实际执行时才被导入。

---

## 6.6 步骤目录结构规范

### 6.6.1 子包组织

GeoPipeAgent 的步骤模块按类别组织为子包：

```
geopipe_agent/
└── steps/
    ├── __init__.py          # load_builtin_steps, _iter_step_modules
    ├── _delegate.py         # run_backend_op 后端委托辅助函数
    │
    ├── io/                  # IO 步骤子包
    │   ├── __init__.py
    │   ├── read_vector.py   # io.read_vector
    │   ├── write_vector.py  # io.write_vector
    │   ├── read_raster.py   # io.read_raster
    │   └── write_raster.py  # io.write_raster
    │
    ├── vector/              # 矢量步骤子包
    │   ├── __init__.py
    │   ├── _delegate.py     # 矢量步骤公共后端委托
    │   ├── buffer.py        # vector.buffer
    │   ├── clip.py          # vector.clip
    │   ├── reproject.py     # vector.reproject
    │   ├── dissolve.py      # vector.dissolve
    │   ├── simplify.py      # vector.simplify
    │   ├── query.py         # vector.query
    │   └── overlay.py       # vector.overlay
    │
    ├── raster/              # 栅格步骤子包
    │   ├── __init__.py
    │   ├── reproject.py     # raster.reproject
    │   ├── clip.py          # raster.clip
    │   ├── calc.py          # raster.calc
    │   ├── stats.py         # raster.stats
    │   └── contour.py       # raster.contour
    │
    └── analysis/            # 高级分析步骤子包
        ├── __init__.py
        ├── voronoi.py       # analysis.voronoi
        ├── heatmap.py       # analysis.heatmap
        ├── interpolate.py   # analysis.interpolate
        └── cluster.py       # analysis.cluster
```

### 6.6.2 __init__.py 约定

每个步骤子包的 `__init__.py` 通常为空文件或仅包含简单的导入声明。步骤注册完全由 `@step` 装饰器在各模块文件中完成，`__init__.py` 不参与注册逻辑。

### 6.6.3 命名约定

| 约定 | 规则 | 示例 |
|------|------|------|
| 步骤 ID | `类别.操作`，全小写，下划线分隔 | `io.read_vector` |
| 模块文件名 | 与操作名一致 | `read_vector.py` |
| 函数名 | 与操作名一致（或简写） | `def read_vector(ctx):` |
| 辅助模块 | 以下划线开头 | `_delegate.py` |

### 6.6.4 添加新步骤的流程

要添加一个自定义步骤，只需以下三步：

```python
# 1. 在合适的子包中创建新文件，如 steps/vector/centroid.py

from geopipe_agent.registry import step

# 2. 使用 @step 装饰器注册
@step(
    id="vector.centroid",
    name="质心计算",
    description="计算每个要素的几何质心",
    params={
        "input": {"type": "GeoDataFrame", "required": True,
                  "description": "输入矢量数据"},
    },
    outputs={
        "result": {"type": "GeoDataFrame",
                   "description": "质心点数据"}
    },
    backends=["native_python"],
)
def centroid(ctx):
    # 3. 实现步骤逻辑
    gdf = ctx.input("input")
    result = gdf.copy()
    result.geometry = gdf.geometry.centroid
    return StepResult(output=result, stats={"feature_count": len(result)})
```

文件创建后，下次调用 `load_builtin_steps()` 时会自动发现并注册该步骤，无需修改任何配置文件。

---

## 6.7 StepInfo.to_dict() 序列化

### 6.7.1 序列化用途

`StepInfo` 对象需要被序列化为字典的场景包括：

1. **`list-steps` 命令**：CLI 命令列出所有可用步骤时，需要将 `StepInfo` 转为可打印格式
2. **技能文件生成**：LLM 需要 JSON 格式的步骤描述来理解每个步骤的功能
3. **API 响应**：Web API 返回步骤信息时需要 JSON 序列化

### 6.7.2 to_dict() 方法

```python
@dataclass
class StepInfo:
    ...

    def to_dict(self) -> dict:
        """将 StepInfo 序列化为字典（排除 func）。"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "params": self.params,
            "outputs": self.outputs,
            "backends": self.backends,
            "examples": self.examples,
        }
```

注意 `func` 字段被排除在序列化结果之外——函数对象不可 JSON 序列化，且外部消费者不需要它。

### 6.7.3 序列化输出示例

```python
info = registry.get("io.read_vector")
import json
print(json.dumps(info.to_dict(), indent=2, ensure_ascii=False))
```

输出：

```json
{
  "id": "io.read_vector",
  "name": "读取矢量数据",
  "description": "从文件读取矢量地理数据，支持 Shapefile、GeoJSON、GeoPackage 等格式",
  "category": "io",
  "params": {
    "path": {
      "type": "str",
      "required": true,
      "description": "输入文件路径"
    },
    "layer": {
      "type": "str",
      "required": false,
      "description": "图层名称"
    },
    "encoding": {
      "type": "str",
      "required": false,
      "default": "utf-8",
      "description": "文件编码"
    }
  },
  "outputs": {
    "result": {
      "type": "GeoDataFrame",
      "description": "读取的地理数据框"
    }
  },
  "backends": [],
  "examples": [
    {
      "title": "读取 Shapefile",
      "params": {"path": "data/buildings.shp"}
    }
  ]
}
```

### 6.7.4 在技能生成中的应用

LLM 技能文件（Skill File）基于 `to_dict()` 的输出生成，为 LLM 提供理解各步骤能力所需的上下文：

```python
# 生成技能文件内容
skills = []
for step_info in registry.list_all():
    skills.append(step_info.to_dict())

skill_content = {
    "version": "1.0",
    "steps": skills,
    "categories": registry.categories(),
}
```

---

## 6.8 本章小结

本章详细介绍了 GeoPipeAgent 的步骤注册表与插件系统：

1. **注册表设计理念**：采用声明式注册 + 自动发现的模式，实现了步骤的零耦合管理
2. **StepInfo 数据结构**：包含 `id`、`func`、`name`、`description`、`category`、`params`、`outputs`、`backends`、`examples` 等丰富的元信息字段
3. **@step 装饰器**：在函数定义处声明元信息，自动推导类别，并将 StepInfo 附加到函数对象
4. **模块级注册表**：通过 `_steps` 字典和 `register`/`get`/`list_all`/`list_by_category`/`has`/`categories`/`reset` 等接口管理步骤
5. **自动发现机制**：利用 `pkgutil.walk_packages` 扫描步骤目录，`importlib.import_module` 触发装饰器执行注册
6. **目录结构规范**：按类别组织子包，遵循统一的命名约定，支持便捷地添加自定义步骤
7. **序列化支持**：`to_dict()` 方法将 StepInfo 转为字典，服务于 `list-steps` 命令和 LLM 技能生成

---

[下一章：IO步骤——数据读写 →](07-IO步骤数据读写.md)

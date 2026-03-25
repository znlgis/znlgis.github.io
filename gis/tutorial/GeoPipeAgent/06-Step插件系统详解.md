---
layout: default
title: Step插件系统详解
---

# 第六章：Step 插件系统详解

## 6.1 插件系统概述

GeoPipeAgent 的 Step 插件系统是框架的核心扩展机制。它允许开发者通过简单的装饰器声明新的分析步骤，无需修改框架核心代码。插件系统由以下三个组件构成：

```
steps/
├── registry.py      # StepRegistry — 全局步骤注册表（单例）
├── decorators.py    # @step 装饰器 — 声明式步骤注册
└── __init__.py      # load_builtin_steps() — 内置步骤加载器
```

## 6.2 StepRegistry 详解

### 6.2.1 单例模式

`StepRegistry` 使用单例模式确保全局只有一个步骤目录：

```python
class StepRegistry:
    _instance: StepRegistry | None = None

    def __new__(cls) -> StepRegistry:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._steps: dict[str, _StepInfo] = {}
        return cls._instance
```

使用 `__new__` 而非 `__init__` 实现单例，确保：
- 第一次调用时创建实例并初始化 `_steps` 字典
- 后续调用返回同一实例
- `_steps` 是实例属性（非类属性），避免多实例共享状态的问题

### 6.2.2 API 说明

```python
class StepRegistry:
    def register(self, info: _StepInfo) -> None:
        """注册一个步骤"""
        self._steps[info.id] = info

    def get(self, step_id: str) -> _StepInfo | None:
        """按 ID 获取步骤（不存在返回 None）"""
        return self._steps.get(step_id)

    def list_all(self) -> list[_StepInfo]:
        """列出所有已注册步骤"""
        return list(self._steps.values())

    def list_by_category(self, category: str) -> list[_StepInfo]:
        """按类别过滤步骤"""
        return [s for s in self._steps.values() if s.category == category]

    def has(self, step_id: str) -> bool:
        """检查步骤是否存在"""
        return step_id in self._steps

    def categories(self) -> list[str]:
        """列出所有类别（已排序）"""
        return sorted({s.category for s in self._steps.values()})

    @classmethod
    def reset(cls) -> None:
        """重置注册表（仅用于测试）"""
        if cls._instance is not None:
            cls._instance._steps = {}
```

### 6.2.3 使用示例

```python
from geopipe_agent.steps.registry import StepRegistry

# 获取注册表实例（始终返回同一个）
registry = StepRegistry()

# 列出所有步骤
for step_info in registry.list_all():
    print(f"{step_info.id}: {step_info.name}")

# 按类别列出
vector_steps = registry.list_by_category("vector")
for s in vector_steps:
    print(f"  {s.id}: {s.description}")

# 查看步骤详情
info = registry.get("vector.buffer")
if info:
    print(info.to_dict())
```

## 6.3 @step 装饰器详解

### 6.3.1 装饰器签名

```python
def step(
    id: str,                    # 步骤 ID（如 "vector.buffer"）
    name: str = "",             # 显示名称
    description: str = "",      # 描述
    category: str = "",         # 类别（可从 id 自动推导）
    params: dict | None = None, # 参数 schema
    outputs: dict | None = None,# 输出 schema
    backends: list[str] | None = None,  # 支持的后端列表
    examples: list[dict] | None = None, # 使用示例
) -> Callable:
```

### 6.3.2 类别自动推导

如果未指定 `category`，装饰器会从 `id` 中自动推导：

```python
cat = category or (id.split(".")[0] if "." in id else "")
```

例如：
- `id="vector.buffer"` → `category="vector"`
- `id="io.read_vector"` → `category="io"`
- `id="raster.calc"` → `category="raster"`

### 6.3.3 装饰器执行流程

```python
def step(...):
    def decorator(func):
        # 1. 推导类别
        cat = category or id.split(".")[0]

        # 2. 创建 _StepInfo 对象
        info = _StepInfo(id=id, func=func, name=name, ...)

        # 3. 注册到全局注册表
        StepRegistry().register(info)

        # 4. 附加元信息到函数（用于内省）
        func._step_info = info

        return func
    return decorator
```

### 6.3.4 完整的步骤声明示例

```python
from geopipe_agent.steps.decorators import step
from geopipe_agent.engine.context import StepContext
from geopipe_agent.models.result import StepResult


@step(
    id="vector.buffer",
    name="矢量缓冲区分析",
    description="对输入的矢量数据生成指定距离的缓冲区",
    category="vector",
    params={
        "input": {
            "type": "geodataframe",
            "required": True,
            "description": "输入矢量数据",
        },
        "distance": {
            "type": "number",
            "required": True,
            "description": "缓冲区距离（单位取决于 CRS）",
        },
        "cap_style": {
            "type": "string",
            "required": False,
            "default": "round",
            "enum": ["round", "flat", "square"],
            "description": "端点样式",
        },
    },
    outputs={
        "output": {"type": "geodataframe", "description": "缓冲区结果"},
        "stats": {"type": "dict", "description": "统计信息"},
    },
    backends=["gdal_python", "qgis_process"],
    examples=[
        {
            "description": "500米道路缓冲区",
            "params": {"input": "$roads.output", "distance": 500},
        },
    ],
)
def vector_buffer(ctx: StepContext) -> StepResult:
    """缓冲区分析步骤实现"""
    gdf = ctx.input("input")
    distance = ctx.param("distance")
    cap_style = ctx.param("cap_style", "round")

    result_gdf = ctx.backend.buffer(gdf, distance, cap_style=cap_style)

    stats = {
        "feature_count": len(result_gdf),
        "total_area": float(result_gdf.geometry.area.sum()),
    }

    return StepResult(output=result_gdf, stats=stats)
```

## 6.4 步骤函数规范

### 6.4.1 函数签名

每个步骤函数必须符合以下签名：

```python
def step_function(ctx: StepContext) -> StepResult:
    ...
```

- **输入**：`StepContext` 对象，提供已解析的参数和后端访问
- **输出**：`StepResult` 对象，包含输出数据和统计信息

### 6.4.2 参数获取

通过 `StepContext` 获取参数：

```python
def my_step(ctx: StepContext) -> StepResult:
    # 获取必需参数
    input_data = ctx.input("input")     # 快捷方式
    input_data = ctx.param("input")     # 等价

    # 获取可选参数（带默认值）
    tolerance = ctx.param("tolerance", 0.001)
    method = ctx.param("method", "douglas")

    # 获取所有参数
    all_params = ctx.params  # dict
```

### 6.4.3 使用后端

对于需要 GIS 操作的步骤，通过 `ctx.backend` 调用后端方法：

```python
def my_step(ctx: StepContext) -> StepResult:
    gdf = ctx.input("input")

    # 调用后端方法
    result = ctx.backend.buffer(gdf, 500)
    result = ctx.backend.clip(gdf, clip_gdf)
    result = ctx.backend.reproject(gdf, "EPSG:3857")
```

注意：IO 步骤不使用后端，它们直接使用 Fiona/Rasterio。

### 6.4.4 返回结果

始终返回 `StepResult` 对象：

```python
def my_step(ctx: StepContext) -> StepResult:
    result_gdf = ...

    return StepResult(
        output=result_gdf,      # 主要输出
        stats={                  # 统计信息（可选）
            "feature_count": len(result_gdf),
            "total_area": float(result_gdf.geometry.area.sum()),
        },
        metadata={               # 元数据（可选）
            "crs": str(result_gdf.crs),
        },
    )
```

## 6.5 内置步骤加载

### 6.5.1 load_builtin_steps()

所有内置步骤通过 `load_builtin_steps()` 函数加载：

```python
def load_builtin_steps() -> None:
    """Import all built-in step modules so they register with StepRegistry."""
    import geopipe_agent.steps.io.read_vector
    import geopipe_agent.steps.io.write_vector
    import geopipe_agent.steps.io.read_raster
    import geopipe_agent.steps.io.write_raster
    import geopipe_agent.steps.vector.buffer
    import geopipe_agent.steps.vector.clip
    import geopipe_agent.steps.vector.reproject
    import geopipe_agent.steps.vector.dissolve
    import geopipe_agent.steps.vector.simplify
    import geopipe_agent.steps.vector.query
    import geopipe_agent.steps.vector.overlay
    import geopipe_agent.steps.raster.reproject
    import geopipe_agent.steps.raster.clip
    import geopipe_agent.steps.raster.calc
    import geopipe_agent.steps.raster.stats
    import geopipe_agent.steps.raster.contour
    import geopipe_agent.steps.analysis.voronoi
    import geopipe_agent.steps.analysis.heatmap
    import geopipe_agent.steps.analysis.interpolate
    import geopipe_agent.steps.analysis.cluster
    import geopipe_agent.steps.network.shortest_path
    import geopipe_agent.steps.network.service_area
    import geopipe_agent.steps.network.geocode
```

### 6.5.2 加载机制

每个步骤模块在 import 时，其顶层的 `@step` 装饰器会立即执行，将步骤注册到 `StepRegistry`。这是 Python 模块加载机制的巧妙利用。

加载顺序：
1. CLI 命令被调用
2. `load_builtin_steps()` 被调用
3. 各步骤模块被 import
4. `@step` 装饰器执行，注册到 `StepRegistry`
5. 注册表中包含了所有 23 个步骤

## 6.6 内置步骤总览

### 6.6.1 五大类别

| 类别 | 步骤数 | 说明 |
|------|--------|------|
| `io` | 4 | 数据输入输出 |
| `vector` | 7 | 矢量分析 |
| `raster` | 5 | 栅格分析 |
| `analysis` | 4 | 高级分析 |
| `network` | 3 | 网络分析 |

### 6.6.2 完整步骤列表

| Step ID | 名称 | 类别 | 使用后端 |
|---------|------|------|---------|
| `io.read_vector` | 读取矢量数据 | io | ❌ |
| `io.write_vector` | 写入矢量数据 | io | ❌ |
| `io.read_raster` | 读取栅格数据 | io | ❌ |
| `io.write_raster` | 写入栅格数据 | io | ❌ |
| `vector.buffer` | 缓冲区分析 | vector | ✅ |
| `vector.clip` | 矢量裁剪 | vector | ✅ |
| `vector.reproject` | 投影转换 | vector | ✅ |
| `vector.dissolve` | 融合 | vector | ✅ |
| `vector.simplify` | 几何简化 | vector | ✅ |
| `vector.query` | 属性查询 | vector | ✅ |
| `vector.overlay` | 叠加分析 | vector | ✅ |
| `raster.reproject` | 栅格投影转换 | raster | ✅ |
| `raster.clip` | 栅格裁剪 | raster | ✅ |
| `raster.calc` | 栅格计算 | raster | ✅ |
| `raster.stats` | 栅格统计 | raster | ✅ |
| `raster.contour` | 等值线生成 | raster | ✅ |
| `analysis.voronoi` | 泰森多边形 | analysis | ✅ |
| `analysis.heatmap` | 热力图 | analysis | ✅ |
| `analysis.interpolate` | 空间插值 | analysis | ✅ |
| `analysis.cluster` | 空间聚类 | analysis | ✅ |
| `network.shortest_path` | 最短路径 | network | ✅ |
| `network.service_area` | 服务区分析 | network | ✅ |
| `network.geocode` | 地理编码 | network | ✅ |

## 6.7 添加自定义步骤

### 6.7.1 开发流程

添加新步骤需要以下步骤：

1. **创建步骤模块文件**
2. **使用 `@step` 装饰器声明**
3. **在 `load_builtin_steps()` 中添加 import**
4. **（如需 Backend）在 `GeoBackend` 基类添加抽象方法**
5. **编写测试**

### 6.7.2 示例：添加自定义 centroid 步骤

**步骤 1**：创建 `src/geopipe_agent/steps/vector/centroid.py`

```python
"""vector.centroid — 提取几何质心"""

from geopipe_agent.steps.decorators import step
from geopipe_agent.engine.context import StepContext
from geopipe_agent.models.result import StepResult


@step(
    id="vector.centroid",
    name="质心提取",
    description="提取矢量要素的几何质心",
    category="vector",
    params={
        "input": {
            "type": "geodataframe",
            "required": True,
            "description": "输入矢量数据",
        },
    },
    outputs={
        "output": {"type": "geodataframe", "description": "质心点数据"},
    },
    backends=["gdal_python"],
)
def vector_centroid(ctx: StepContext) -> StepResult:
    gdf = ctx.input("input")

    result = gdf.copy()
    result["geometry"] = gdf.geometry.centroid

    stats = {
        "feature_count": len(result),
    }

    return StepResult(output=result, stats=stats)
```

**步骤 2**：在 `steps/__init__.py` 中添加 import

```python
def load_builtin_steps() -> None:
    ...
    import geopipe_agent.steps.vector.centroid  # 新增
```

**步骤 3**：验证注册

```bash
geopipe-agent list-steps --category vector
# 应能看到 vector.centroid

geopipe-agent describe vector.centroid
# 显示步骤详情
```

**步骤 4**：编写测试

```python
def test_vector_centroid(sample_geodataframe):
    from geopipe_agent.steps.vector.centroid import vector_centroid
    from geopipe_agent.engine.context import StepContext
    from geopipe_agent.models.result import StepResult

    ctx = StepContext(params={"input": sample_geodataframe})
    result = vector_centroid(ctx)

    assert isinstance(result, StepResult)
    assert len(result.output) == len(sample_geodataframe)
    assert all(result.output.geometry.geom_type == "Point")
```

### 6.7.3 测试注意事项

由于 `StepRegistry` 是单例，测试时需要注意注册表状态：

```python
@pytest.fixture(autouse=True)
def reset_registry():
    """每个测试前重置注册表"""
    from geopipe_agent.steps.registry import StepRegistry
    StepRegistry.reset()
    yield
    StepRegistry.reset()
```

## 6.8 步骤元信息的应用

步骤元信息不仅用于注册，还有以下用途：

### 6.8.1 CLI 文档生成

`list-steps` 和 `describe` 命令使用元信息生成文档：

```bash
geopipe-agent describe vector.buffer
```

输出：

```json
{
  "id": "vector.buffer",
  "name": "矢量缓冲区分析",
  "description": "对输入的矢量数据生成指定距离的缓冲区",
  "category": "vector",
  "params": {
    "input": {"type": "geodataframe", "required": true, "description": "输入矢量数据"},
    "distance": {"type": "number", "required": true, "description": "缓冲区距离"},
    "cap_style": {"type": "string", "required": false, "default": "round", "enum": ["round", "flat", "square"]}
  },
  "outputs": {
    "output": {"type": "geodataframe", "description": "缓冲区结果"}
  },
  "backends": ["gdal_python", "qgis_process"],
  "examples": [{"description": "500米道路缓冲区", "params": {"input": "$roads.output", "distance": 500}}]
}
```

### 6.8.2 Skill 文件生成

Skill 生成器遍历注册表中的所有步骤，自动生成 AI 可消费的参考文档。这意味着只要正确声明了 `@step` 装饰器的元信息，步骤的文档就会自动生成，无需额外维护。

### 6.8.3 验证器使用

Validator 使用注册表来验证 YAML 中的 `use` 字段引用是否合法。

---
layout: default
title: 第六章：Step 插件系统与注册表
---

# 第六章：Step 插件系统与注册表

## 6.1 概述

GeoPipeAgent 的步骤系统是整个框架的核心扩展机制。每个分析步骤都是一个用 `@step` 装饰器注册的 Python 函数，框架通过自动发现机制加载所有内置步骤，并通过全局注册表管理和查询。

本章将深入分析步骤注册表的实现原理、`@step` 装饰器的工作方式以及自动发现机制。

## 6.2 StepInfo 数据模型

每个注册的步骤都用 `StepInfo` 数据类表示：

```python
@dataclass
class StepInfo:
    id: str                                    # 步骤 ID（如 "vector.buffer"）
    func: Callable                             # 步骤执行函数
    name: str = ""                             # 步骤名称（如 "矢量缓冲区分析"）
    description: str = ""                      # 步骤描述
    category: str = ""                         # 分类（如 "vector"）
    params: dict = field(default_factory=dict)  # 参数定义
    outputs: dict = field(default_factory=dict) # 输出定义
    backends: list[str] = field(default_factory=list)  # 支持的后端
    examples: list[dict] = field(default_factory=list) # 使用示例
```

### 6.2.1 参数定义格式

`params` 字典定义了步骤接受的参数，每个参数的定义包含：

| 键 | 类型 | 说明 |
|----|------|------|
| `type` | str | 参数类型（`string`、`number`、`boolean`、`geodataframe` 等） |
| `required` | bool | 是否必填 |
| `default` | any | 默认值 |
| `description` | str | 参数描述 |
| `enum` | list | 可选值列表 |

示例：

```python
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
}
```

### 6.2.2 输出定义格式

`outputs` 字典定义了步骤的输出：

```python
outputs={
    "output": {"type": "geodataframe", "description": "缓冲区结果"},
    "stats": {"type": "dict", "description": "统计信息"},
}
```

### 6.2.3 序列化

`StepInfo.to_dict()` 方法将步骤信息序列化为字典，用于 JSON 输出和 Skill 文件生成。

## 6.3 全局注册表

步骤注册表在 `steps/registry.py` 模块级别维护：

```python
_steps: dict[str, StepInfo] = {}

def register(info: StepInfo) -> None:
    _steps[info.id] = info

def get(step_id: str) -> StepInfo | None:
    return _steps.get(step_id)

def list_all() -> list[StepInfo]:
    return list(_steps.values())

def list_by_category(category: str) -> list[StepInfo]:
    return [s for s in _steps.values() if s.category == category]

def has(step_id: str) -> bool:
    return step_id in _steps

def categories() -> list[str]:
    return sorted({s.category for s in _steps.values()})

def reset() -> None:
    _steps.clear()
```

### 6.3.1 注册表 API

| 函数 | 说明 |
|------|------|
| `register(info)` | 注册一个步骤 |
| `get(step_id)` | 按 ID 获取步骤信息 |
| `list_all()` | 获取所有已注册步骤 |
| `list_by_category(cat)` | 按分类筛选步骤 |
| `has(step_id)` | 检查步骤是否已注册 |
| `categories()` | 获取所有分类 |
| `reset()` | 清空注册表（用于测试） |

## 6.4 @step 装饰器

### 6.4.1 装饰器定义

```python
def step(
    id: str,
    name: str = "",
    description: str = "",
    category: str = "",
    params: dict | None = None,
    outputs: dict | None = None,
    backends: list[str] | None = None,
    examples: list[dict] | None = None,
) -> Callable:
    def decorator(func: Callable) -> Callable:
        cat = category or (id.split(".")[0] if "." in id else "")
        info = StepInfo(
            id=id, func=func, name=name,
            description=description, category=cat,
            params=params or {}, outputs=outputs or {},
            backends=backends or [], examples=examples or [],
        )
        register(info)
        func._step_info = info
        return func
    return decorator
```

### 6.4.2 装饰器行为

1. **自动推断分类**：如果未指定 `category`，从 `id` 中提取（如 `"vector.buffer"` → `"vector"`）
2. **创建 StepInfo**：组装完整的步骤信息对象
3. **注册到全局表**：调用 `register(info)` 将步骤注册到 `_steps` 字典
4. **附加元信息**：在函数上附加 `_step_info` 属性，便于反射访问

### 6.4.3 使用示例

```python
@step(
    id="vector.buffer",
    name="矢量缓冲区分析",
    description="对输入的矢量数据生成指定距离的缓冲区",
    category="vector",
    params={
        "input": {"type": "geodataframe", "required": True, "description": "输入矢量数据"},
        "distance": {"type": "number", "required": True, "description": "缓冲区距离"},
        "cap_style": {"type": "string", "required": False, "default": "round",
                       "enum": ["round", "flat", "square"], "description": "端点样式"},
    },
    outputs={
        "output": {"type": "geodataframe", "description": "缓冲区结果"},
        "stats": {"type": "dict", "description": "统计信息"},
    },
    backends=["native_python", "qgis_process"],
    examples=[
        {"description": "500米道路缓冲区", "params": {"input": "$roads.output", "distance": 500}},
    ],
)
def vector_buffer(ctx: StepContext) -> StepResult:
    return run_backend_op(ctx, "buffer", ...)
```

## 6.5 自动发现机制

### 6.5.1 加载逻辑

`steps/__init__.py` 中的 `load_builtin_steps()` 函数负责自动发现和加载所有内置步骤：

```python
def _iter_step_modules():
    """遍历 steps/ 目录下所有 Python 模块"""
    package_dir = str(Path(__file__).resolve().parent)
    prefix = "geopipe_agent.steps."
    for _importer, modname, ispkg in pkgutil.walk_packages(
        [package_dir], prefix=prefix
    ):
        short = modname[len(prefix):]
        if short in _SKIP_MODULES:  # 跳过 registry 和 _helpers
            continue
        if ispkg:  # 跳过子包的 __init__.py
            continue
        yield modname

def load_builtin_steps() -> None:
    """导入所有内置步骤模块，触发 @step 装饰器注册"""
    for modname in _iter_step_modules():
        importlib.import_module(modname)
```

### 6.5.2 工作原理

1. `pkgutil.walk_packages` 遍历 `steps/` 目录及子目录
2. 跳过非步骤模块（`registry`、`_helpers`）和子包的 `__init__.py`
3. 使用 `importlib.import_module` 导入每个模块
4. 模块导入触发模块级别的 `@step` 装饰器执行
5. 装饰器自动将步骤注册到全局注册表

### 6.5.3 跳过规则

```python
_SKIP_MODULES = {"registry", "_helpers"}
```

以下模块会被跳过：
- `registry`：注册表本身
- `_helpers`：QC 步骤的辅助函数
- `_delegate`：矢量步骤的后端委托辅助函数（以 `_` 开头的模块，但 `_SKIP_MODULES` 只是顶层跳过）

### 6.5.4 触发时机

自动加载在包被首次导入时触发：

```python
# __init__.py
from geopipe_agent.steps import load_builtin_steps as _load_builtin_steps
_load_builtin_steps()
```

这确保了只要 `import geopipe_agent`，所有步骤就已注册完毕。

## 6.6 步骤分类体系

GeoPipeAgent 将 33 个内置步骤组织为六个分类：

### 6.6.1 IO 步骤（4 个）

| 步骤 ID | 文件 | 功能 |
|---------|------|------|
| `io.read_vector` | `steps/io/read_vector.py` | 读取矢量数据 |
| `io.write_vector` | `steps/io/write_vector.py` | 写入矢量数据 |
| `io.read_raster` | `steps/io/read_raster.py` | 读取栅格数据 |
| `io.write_raster` | `steps/io/write_raster.py` | 写入栅格数据 |

### 6.6.2 矢量步骤（7 个）

| 步骤 ID | 文件 | 功能 |
|---------|------|------|
| `vector.buffer` | `steps/vector/buffer.py` | 缓冲区分析 |
| `vector.clip` | `steps/vector/clip.py` | 矢量裁剪 |
| `vector.reproject` | `steps/vector/reproject.py` | 投影转换 |
| `vector.dissolve` | `steps/vector/dissolve.py` | 融合 |
| `vector.simplify` | `steps/vector/simplify.py` | 几何简化 |
| `vector.query` | `steps/vector/query.py` | 属性查询 |
| `vector.overlay` | `steps/vector/overlay.py` | 叠加分析 |

### 6.6.3 栅格步骤（5 个）

| 步骤 ID | 文件 | 功能 |
|---------|------|------|
| `raster.reproject` | `steps/raster/reproject.py` | 栅格投影转换 |
| `raster.clip` | `steps/raster/clip.py` | 栅格裁剪 |
| `raster.calc` | `steps/raster/calc.py` | 栅格计算 |
| `raster.stats` | `steps/raster/stats.py` | 栅格统计 |
| `raster.contour` | `steps/raster/contour.py` | 生成等值线 |

### 6.6.4 空间分析步骤（4 个）

| 步骤 ID | 文件 | 功能 |
|---------|------|------|
| `analysis.voronoi` | `steps/analysis/voronoi.py` | 泰森多边形 |
| `analysis.heatmap` | `steps/analysis/heatmap.py` | 热力图 |
| `analysis.interpolate` | `steps/analysis/interpolate.py` | 空间插值 |
| `analysis.cluster` | `steps/analysis/cluster.py` | 空间聚类 |

### 6.6.5 网络分析步骤（3 个）

| 步骤 ID | 文件 | 功能 |
|---------|------|------|
| `network.shortest_path` | `steps/network/shortest_path.py` | 最短路径 |
| `network.service_area` | `steps/network/service_area.py` | 服务区分析 |
| `network.geocode` | `steps/network/geocode.py` | 地理编码 |

### 6.6.6 数据质检步骤（10 个）

| 步骤 ID | 文件 | 功能 |
|---------|------|------|
| `qc.geometry_validity` | `steps/qc/geometry_validity.py` | 几何有效性检查 |
| `qc.crs_check` | `steps/qc/crs_check.py` | CRS 检查 |
| `qc.topology` | `steps/qc/topology.py` | 拓扑检查 |
| `qc.attribute_completeness` | `steps/qc/attribute_completeness.py` | 属性完整性检查 |
| `qc.attribute_domain` | `steps/qc/attribute_domain.py` | 属性值域检查 |
| `qc.value_range` | `steps/qc/value_range.py` | 数值范围检查 |
| `qc.duplicate_check` | `steps/qc/duplicate_check.py` | 重复要素检查 |
| `qc.raster_nodata` | `steps/qc/raster_nodata.py` | NoData 一致性检查 |
| `qc.raster_resolution` | `steps/qc/raster_resolution.py` | 分辨率一致性检查 |
| `qc.raster_value_range` | `steps/qc/raster_value_range.py` | 栅格值域检查 |

## 6.7 后端委托机制

矢量步骤使用 `_delegate.py` 中的 `run_backend_op` 辅助函数来委托后端执行：

```python
def run_backend_op(ctx, op_name, positional_params, keyword_params, extra_stats):
    gdf = ctx.input()
    backend = ctx.backend

    if backend is not None:
        # 委托给后端执行
        method = getattr(backend, op_name)
        args = [gdf] + [ctx.param(p) for p in positional_params]
        kwargs = {k: ctx.param(v) for k, v in keyword_params.items() if ctx.param(v) is not None}
        result = method(*args, **kwargs)
    else:
        # 无后端时使用默认实现
        ...

    return StepResult(output=result, stats={...})
```

这使得矢量步骤可以透明地在不同后端之间切换。

## 6.8 步骤函数签名约定

所有步骤函数都遵循统一的签名约定：

```python
def step_function(ctx: StepContext) -> StepResult:
    # 1. 从 ctx 获取参数
    input_data = ctx.param("input")
    param_value = ctx.param("param_name", default=default_value)

    # 2. 执行分析逻辑
    result_data = process(input_data, param_value)

    # 3. 构造并返回 StepResult
    return StepResult(
        output=result_data,
        stats={"feature_count": len(result_data), ...},
        metadata={...},
        issues=[...],  # 仅 QC 步骤
    )
```

## 6.9 测试中的注册表重置

测试时使用 `reset()` 和 `reload_builtin_steps()` 确保每个测试用例有干净的注册表：

```python
@pytest.fixture(autouse=True)
def reset_registry():
    registry.reset()
    reload_builtin_steps()
    yield
```

## 6.10 本章小结

本章深入分析了 GeoPipeAgent 的步骤插件系统和注册表机制。`@step` 装饰器是注册步骤的核心方式，全局注册表 `_steps` 管理所有已注册步骤。自动发现机制基于 `pkgutil.walk_packages` 遍历 `steps/` 目录下的所有模块并触发注册。框架将 33 个内置步骤组织为六个分类（IO、矢量、栅格、空间分析、网络分析、数据质检），通过统一的函数签名和后端委托机制保证了良好的扩展性。

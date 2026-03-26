---
layout: default
title: "第13章：Backend 多后端系统"
---

# 第13章：Backend 多后端系统

> 本章深入介绍 GeoPipeAgent 的多后端架构。通过抽象基类 GeoBackend 定义统一接口，5 种后端实现（NativePython、GdalCli、GdalPython、QgisProcess、PyQgis）可以在不修改流水线定义的情况下切换底层 GIS 引擎。BackendManager 负责自动检测可用后端并管理优先级选择。

---

## 13.1 多后端架构概述

### 13.1.1 为什么需要多后端

GIS 处理领域有多种成熟的工具链，各有优势：

| 工具链 | 优势 | 劣势 |
|--------|------|------|
| GeoPandas + Shapely | Python 原生，易于安装 | 大数据性能有限 |
| GDAL/OGR CLI | 性能强，稳定 | 需安装 GDAL 工具 |
| GDAL Python 绑定 | 性能强，API 灵活 | 安装复杂，API 低级 |
| QGIS Processing | 算法丰富，GUI 可视化 | 需完整 QGIS 安装 |
| PyQGIS | QGIS 全功能 Python API | 需 QGIS Python 绑定 |

GeoPipeAgent 的多后端设计使得：

1. **用户无需锁定单一工具链**——根据环境自动选择最佳后端
2. **流水线可移植**——同一份 YAML 在不同环境下运行
3. **性能可优化**——关键步骤可指定高性能后端
4. **渐进式部署**——从最简安装起步，按需添加高级后端

### 13.1.2 策略模式设计

多后端系统采用经典的**策略模式（Strategy Pattern）**：

```
                    ┌──────────────────┐
                    │   GeoBackend     │  ← 抽象策略接口
                    │   (Abstract)     │
                    ├──────────────────┤
                    │ + name()         │
                    │ + is_available() │
                    │ + buffer()       │
                    │ + clip()         │
                    │ + reproject()    │
                    │ + dissolve()     │
                    │ + simplify()     │
                    │ + overlay()      │
                    └────────┬─────────┘
                             │
          ┌──────────┬───────┼───────┬──────────┐
          ▼          ▼       ▼       ▼          ▼
    ┌──────────┐ ┌───────┐ ┌─────┐ ┌───────┐ ┌───────┐
    │ Native   │ │ GDAL  │ │GDAL │ │ Qgis  │ │PyQgis │
    │ Python   │ │ CLI   │ │Py   │ │Process│ │       │
    └──────────┘ └───────┘ └─────┘ └───────┘ └───────┘

                    ┌──────────────────┐
                    │  BackendManager  │  ← 后端管理器
                    │  自动检测 & 选择  │
                    └──────────────────┘
```

### 13.1.3 后端优先级

当用户未指定后端时，BackendManager 按注册顺序选择第一个可用后端：

```
优先级：NativePython > GdalCli > GdalPython > QgisProcess > PyQgis
         (默认可用)    (需 GDAL   (需 GDAL    (需 QGIS    (需 QGIS
                        CLI)       Python)     安装)       Python)
```

---

## 13.2 GeoBackend 抽象基类

### 13.2.1 接口定义

`GeoBackend` 定义了所有后端必须实现的 6 个核心空间操作方法：

```python
from abc import ABC, abstractmethod
from typing import Any

class GeoBackend(ABC):
    """GIS 后端抽象基类"""

    @abstractmethod
    def name(self) -> str:
        """返回后端名称标识"""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """检查后端是否可用（依赖是否已安装）"""
        ...

    @abstractmethod
    def buffer(self, gdf, distance, **kwargs) -> Any:
        """缓冲区分析"""
        ...

    @abstractmethod
    def clip(self, input_gdf, clip_gdf, **kwargs) -> Any:
        """裁剪"""
        ...

    @abstractmethod
    def reproject(self, gdf, target_crs, **kwargs) -> Any:
        """坐标转换"""
        ...

    @abstractmethod
    def dissolve(self, gdf, by=None, **kwargs) -> Any:
        """融合"""
        ...

    @abstractmethod
    def simplify(self, gdf, tolerance, **kwargs) -> Any:
        """简化"""
        ...

    @abstractmethod
    def overlay(self, gdf1, gdf2, how="intersection", **kwargs) -> Any:
        """叠加分析"""
        ...
```

### 13.2.2 六个抽象方法详解

| 方法 | 功能 | 输入 | 输出 |
|------|------|------|------|
| `name()` | 返回后端名称 | — | `str`（如 `"native_python"`） |
| `is_available()` | 检测后端是否可用 | — | `bool` |
| `buffer(gdf, distance)` | 缓冲区分析 | GeoDataFrame + 距离 | 缓冲后的 GeoDataFrame |
| `clip(input_gdf, clip_gdf)` | 空间裁剪 | 输入 GDF + 裁剪 GDF | 裁剪后的 GeoDataFrame |
| `reproject(gdf, target_crs)` | 坐标转换 | GDF + 目标 CRS | 投影后的 GeoDataFrame |
| `dissolve(gdf, by)` | 要素融合 | GDF + 分组字段 | 融合后的 GeoDataFrame |
| `simplify(gdf, tolerance)` | 几何简化 | GDF + 容差 | 简化后的 GeoDataFrame |
| `overlay(gdf1, gdf2, how)` | 叠加分析 | 两个 GDF + 叠加方式 | 叠加结果 GeoDataFrame |

### 13.2.3 overlay 的 how 参数

`overlay` 方法的 `how` 参数支持多种叠加方式：

```
how="intersection"    how="union"         how="difference"
    ┌───┐                ┌───┐               ┌───┐
    │ A ┌┼──┐            │ A │ B │           │ A │──┐
    │   ││  │  → ┌┐      │   │   │  → 全部   │   │  │  → A-B
    └───┼┘──┘    └┘      └───┘───┘           └───┘──┘
      交集                  并集               差集

how="symmetric_difference"   how="identity"
    ┌───┐                     ┌───┐
    │ A ┌┼──┐                 │ A ┌┼──┐
    │   ││  │  → A+B-AB       │   ││  │  → A 保留形状
    └───┼┘──┘                 └───┼┘──┘    B 部分切割
      对称差集                   标识叠加
```

---

## 13.3 NativePythonBackend

### 13.3.1 概述

`NativePythonBackend` 是默认后端，基于 GeoPandas 和 Shapely 实现。它是纯 Python 后端，只需 `pip install geopipeagent` 即可使用。

### 13.3.2 实现细节

```python
class NativePythonBackend(GeoBackend):
    """基于 GeoPandas + Shapely 的默认后端"""

    def name(self) -> str:
        return "native_python"

    def is_available(self) -> bool:
        try:
            import geopandas
            import shapely
            return True
        except ImportError:
            return False

    def buffer(self, gdf, distance, **kwargs):
        result = gdf.copy()
        result["geometry"] = gdf.geometry.buffer(distance, **kwargs)
        return result

    def clip(self, input_gdf, clip_gdf, **kwargs):
        import geopandas as gpd
        return gpd.clip(input_gdf, clip_gdf)

    def reproject(self, gdf, target_crs, **kwargs):
        return gdf.to_crs(target_crs)

    def dissolve(self, gdf, by=None, **kwargs):
        return gdf.dissolve(by=by, **kwargs)

    def simplify(self, gdf, tolerance, **kwargs):
        result = gdf.copy()
        result["geometry"] = gdf.geometry.simplify(
            tolerance, **kwargs
        )
        return result

    def overlay(self, gdf1, gdf2, how="intersection", **kwargs):
        import geopandas as gpd
        return gpd.overlay(gdf1, gdf2, how=how, **kwargs)
```

### 13.3.3 特点

| 特点 | 说明 |
|------|------|
| **安装简单** | pip 直接安装，无外部依赖 |
| **API 友好** | GeoPandas 语法，Pythonic |
| **调试方便** | 纯 Python 调用栈，易于追踪 |
| **性能一般** | 大数据量时可能较慢 |
| **跨平台** | Windows / Linux / macOS 均可用 |

---

## 13.4 GdalCliBackend

### 13.4.1 概述

`GdalCliBackend` 通过 subprocess 调用 GDAL/OGR 命令行工具（`ogr2ogr`、`gdal_translate` 等），利用 GDAL 的高性能 C++ 引擎处理空间数据。

### 13.4.2 实现模式

GdalCliBackend 的每个操作遵循三步模式：

```
1. 写入临时文件         2. 执行 CLI 命令         3. 读取结果文件
┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│ GeoDataFrame │ ──▶  │ ogr2ogr -clipsrc│ ──▶  │  读取输出    │
│ → temp.gpkg  │      │ temp.gpkg ...   │      │  → GDF       │
└──────────────┘      └─────────────────┘      └──────────────┘
```

### 13.4.3 subprocess 调用示例

```python
class GdalCliBackend(GeoBackend):

    def name(self) -> str:
        return "gdal_cli"

    def is_available(self) -> bool:
        import shutil
        return shutil.which("ogr2ogr") is not None

    def clip(self, input_gdf, clip_gdf, **kwargs):
        with tmp_io(input_gdf) as (input_path, output_path):
            clip_path = write_tmp_gdf(clip_gdf)
            cmd = [
                "ogr2ogr",
                "-f", "GPKG",
                "-clipsrc", clip_path,
                output_path,
                input_path,
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return read_gdf(output_path)

    def buffer(self, gdf, distance, **kwargs):
        with tmp_io(gdf) as (input_path, output_path):
            sql = (
                f"SELECT ST_Buffer(geom, {distance}) AS geom, * "
                f"FROM \"{_layer_name(input_path)}\""
            )
            cmd = [
                "ogr2ogr",
                "-f", "GPKG",
                "-sql", sql,
                "-dialect", "SQLite",
                output_path,
                input_path,
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return read_gdf(output_path)

    def reproject(self, gdf, target_crs, **kwargs):
        with tmp_io(gdf) as (input_path, output_path):
            cmd = [
                "ogr2ogr",
                "-f", "GPKG",
                "-t_srs", str(target_crs),
                output_path,
                input_path,
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return read_gdf(output_path)
```

### 13.4.4 tmp_io 上下文管理器

为了简化临时文件的管理，GdalCliBackend 使用 `tmp_io` 上下文管理器：

```python
@contextmanager
def tmp_io(gdf):
    """创建临时输入/输出文件对

    用法:
        with tmp_io(gdf) as (input_path, output_path):
            # input_path: 写入了 gdf 的临时文件
            # output_path: 空的临时输出文件路径
            subprocess.run([...])
            result = read_gdf(output_path)
    """
    input_path = write_tmp_gdf(gdf)
    output_path = make_tmp_path(".gpkg")
    try:
        yield input_path, output_path
    finally:
        # 清理临时文件
        for p in [input_path, output_path]:
            if os.path.exists(p):
                os.remove(p)
```

### 13.4.5 特点

| 特点 | 说明 |
|------|------|
| **高性能** | GDAL C++ 引擎，处理大数据速度快 |
| **功能丰富** | ogr2ogr 支持海量格式和操作 |
| **临时文件开销** | 每次操作需要磁盘 I/O |
| **安装要求** | 需要 GDAL CLI 工具（`ogr2ogr` 在 PATH 中） |
| **错误处理** | 依赖进程退出码和 stderr |

---

## 13.5 GdalPythonBackend

### 13.5.1 概述

`GdalPythonBackend` 使用 GDAL/OGR 的 Python 绑定（`osgeo` 包）直接调用 GDAL C++ 库函数，无需 subprocess 中间步骤。

### 13.5.2 实现示例

```python
class GdalPythonBackend(GeoBackend):

    def name(self) -> str:
        return "gdal_python"

    def is_available(self) -> bool:
        try:
            from osgeo import ogr, osr, gdal
            return True
        except ImportError:
            return False

    def buffer(self, gdf, distance, **kwargs):
        from osgeo import ogr

        result_geoms = []
        for geom in gdf.geometry:
            ogr_geom = ogr.CreateGeometryFromWkt(geom.wkt)
            buffered = ogr_geom.Buffer(distance)
            result_geoms.append(
                shapely.wkt.loads(buffered.ExportToWkt())
            )

        result = gdf.copy()
        result["geometry"] = result_geoms
        return result

    def reproject(self, gdf, target_crs, **kwargs):
        from osgeo import osr

        source_srs = osr.SpatialReference()
        source_srs.ImportFromEPSG(gdf.crs.to_epsg())

        target_srs = osr.SpatialReference()
        target_srs.SetFromUserInput(str(target_crs))

        transform = osr.CoordinateTransformation(
            source_srs, target_srs
        )

        result_geoms = []
        for geom in gdf.geometry:
            ogr_geom = ogr.CreateGeometryFromWkt(geom.wkt)
            ogr_geom.Transform(transform)
            result_geoms.append(
                shapely.wkt.loads(ogr_geom.ExportToWkt())
            )

        result = gdf.copy()
        result["geometry"] = result_geoms
        result.crs = target_crs
        return result
```

### 13.5.3 特点

| 特点 | 说明 |
|------|------|
| **高性能** | 直接调用 C++ 库，无进程开销 |
| **无临时文件** | 在内存中完成所有操作 |
| **安装复杂** | 需要编译或安装 GDAL Python 绑定 |
| **API 低级** | osgeo API 不如 GeoPandas 友好 |

---

## 13.6 QgisProcessBackend

### 13.6.1 概述

`QgisProcessBackend` 通过 `qgis_process` 命令行工具调用 QGIS Processing 算法，充分利用 QGIS 丰富的空间算法库。

### 13.6.2 实现模式

```python
class QgisProcessBackend(GeoBackend):

    def name(self) -> str:
        return "qgis_process"

    def is_available(self) -> bool:
        import shutil
        return shutil.which("qgis_process") is not None

    def buffer(self, gdf, distance, **kwargs):
        with tmp_io(gdf) as (input_path, output_path):
            cmd = [
                "qgis_process", "run",
                "native:buffer",
                "--",
                f"INPUT={input_path}",
                f"DISTANCE={distance}",
                "SEGMENTS=5",
                "END_CAP_STYLE=0",
                "JOIN_STYLE=0",
                f"OUTPUT={output_path}",
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return read_gdf(output_path)

    def clip(self, input_gdf, clip_gdf, **kwargs):
        with tmp_io(input_gdf) as (input_path, output_path):
            clip_path = write_tmp_gdf(clip_gdf)
            cmd = [
                "qgis_process", "run",
                "native:clip",
                "--",
                f"INPUT={input_path}",
                f"OVERLAY={clip_path}",
                f"OUTPUT={output_path}",
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return read_gdf(output_path)

    def dissolve(self, gdf, by=None, **kwargs):
        with tmp_io(gdf) as (input_path, output_path):
            cmd = [
                "qgis_process", "run",
                "native:dissolve",
                "--",
                f"INPUT={input_path}",
                f"FIELD={by or ''}",
                f"OUTPUT={output_path}",
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return read_gdf(output_path)
```

### 13.6.3 qgis_process 算法映射

| GeoBackend 方法 | QGIS Processing 算法 |
|-----------------|----------------------|
| `buffer()` | `native:buffer` |
| `clip()` | `native:clip` |
| `reproject()` | `native:reprojectlayer` |
| `dissolve()` | `native:dissolve` |
| `simplify()` | `native:simplifygeometries` |
| `overlay()` | `native:intersection` / `native:union` 等 |

### 13.6.4 特点

| 特点 | 说明 |
|------|------|
| **算法丰富** | 数百种 QGIS Processing 算法 |
| **结果一致** | 与 QGIS 桌面软件结果一致 |
| **安装要求** | 需完整 QGIS 安装（`qgis_process` 在 PATH 中） |
| **启动开销** | 每次调用需初始化 QGIS 环境 |

---

## 13.7 PyQgisBackend

### 13.7.1 概述

`PyQgisBackend` 使用 PyQGIS（QGIS 的 Python API）直接调用 QGIS 算法，避免了命令行启动的开销。

### 13.7.2 实现示例

```python
class PyQgisBackend(GeoBackend):

    def name(self) -> str:
        return "pyqgis"

    def is_available(self) -> bool:
        try:
            from qgis.core import QgsApplication
            return True
        except ImportError:
            return False

    def buffer(self, gdf, distance, **kwargs):
        from qgis.core import QgsVectorLayer
        import processing

        with tmp_io(gdf) as (input_path, output_path):
            result = processing.run("native:buffer", {
                "INPUT": input_path,
                "DISTANCE": distance,
                "SEGMENTS": 5,
                "END_CAP_STYLE": 0,
                "JOIN_STYLE": 0,
                "OUTPUT": output_path,
            })
            return read_gdf(result["OUTPUT"])

    def overlay(self, gdf1, gdf2, how="intersection", **kwargs):
        import processing

        alg_map = {
            "intersection": "native:intersection",
            "union": "native:union",
            "difference": "native:difference",
            "symmetric_difference": "native:symmetricaldifference",
        }

        alg = alg_map.get(how)
        if not alg:
            raise ValueError(f"Unsupported overlay method: {how}")

        with tmp_io(gdf1) as (input_path, output_path):
            overlay_path = write_tmp_gdf(gdf2)
            result = processing.run(alg, {
                "INPUT": input_path,
                "OVERLAY": overlay_path,
                "OUTPUT": output_path,
            })
            return read_gdf(result["OUTPUT"])
```

### 13.7.3 特点

| 特点 | 说明 |
|------|------|
| **无 CLI 开销** | 直接 Python 调用，无进程启动开销 |
| **QGIS 全功能** | 可访问所有 QGIS 类和方法 |
| **安装要求** | 需要 QGIS Python 绑定 |
| **环境限制** | 通常需在 QGIS Python 环境中运行 |

---

## 13.8 BackendManager 后端管理器

### 13.8.1 核心功能

`BackendManager` 负责后端的注册、检测和选择：

```python
_BACKEND_CLASSES = [
    NativePythonBackend,
    GdalCliBackend,
    GdalPythonBackend,
    QgisProcessBackend,
    PyQgisBackend,
]

class BackendManager:
    """后端管理器——自动检测可用后端并提供选择机制"""

    def __init__(self):
        # 实例化所有后端类
        all_backends = [cls() for cls in _BACKEND_CLASSES]
        # 过滤出可用的后端
        self.backends = [b for b in all_backends if b.is_available()]

    def get(self, preferred=None) -> GeoBackend:
        """获取后端实例

        Args:
            preferred: 优先选择的后端名称

        Returns:
            GeoBackend: 后端实例

        Raises:
            BackendNotAvailableError: 无可用后端
        """
        if preferred:
            for b in self.backends:
                if b.name() == preferred:
                    return b
            raise BackendNotAvailableError(
                f"Backend '{preferred}' is not available. "
                f"Available: {[b.name() for b in self.backends]}"
            )

        if not self.backends:
            raise BackendNotAvailableError(
                "No GIS backend is available. "
                "Please install geopandas at minimum."
            )

        return self.backends[0]  # 返回第一个可用后端
```

### 13.8.2 自动检测流程

```
BackendManager 初始化流程：

  _BACKEND_CLASSES  →  实例化  →  is_available()  →  过滤

  ┌───────────────┐    ┌────┐    ┌─────────────┐    ┌──────────┐
  │NativePython   │───▶│ () │───▶│ is_avail? ✅│───▶│ backends │
  │GdalCli        │───▶│ () │───▶│ is_avail? ❌│    │ [native, │
  │GdalPython     │───▶│ () │───▶│ is_avail? ❌│    │  ...]    │
  │QgisProcess    │───▶│ () │───▶│ is_avail? ❌│    └──────────┘
  │PyQgis         │───▶│ () │───▶│ is_avail? ❌│
  └───────────────┘    └────┘    └─────────────┘
```

### 13.8.3 get() 方法逻辑

| 场景 | preferred 参数 | 行为 |
|------|---------------|------|
| 默认选择 | `None` | 返回第一个可用后端 |
| 指定后端 | `"gdal_cli"` | 查找名称匹配且可用的后端 |
| 指定不存在的后端 | `"spark"` | 抛出 `BackendNotAvailableError` |
| 无可用后端 | `None` | 抛出 `BackendNotAvailableError` |

---

## 13.9 在流水线中指定后端

### 13.9.1 全局后端指定

在 YAML 流水线的顶层配置中指定默认后端：

```yaml
name: 使用 GDAL CLI 后端的流水线
backend: gdal_cli  # 全局后端

steps:
  - id: buffer_roads
    step: vector.buffer
    params:
      input: "$steps.read_roads"
      distance: 100
```

### 13.9.2 步骤级别覆盖

单个步骤可以覆盖全局后端设置：

```yaml
name: 混合后端流水线
backend: native_python  # 全局默认

steps:
  # 使用默认的 native_python 后端
  - id: read_data
    step: io.read_vector
    params:
      path: "data/parcels.gpkg"

  # 此步骤使用 GDAL CLI（大数据量时更快）
  - id: clip_data
    step: vector.clip
    params:
      input: "$steps.read_data"
      clip_geometry: "$steps.read_boundary"
    backend: gdal_cli  # 步骤级别覆盖

  # 此步骤使用 QGIS Processing
  - id: dissolve_data
    step: vector.dissolve
    params:
      input: "$steps.clip_data"
      by: "district"
    backend: qgis_process  # 步骤级别覆盖
```

### 13.9.3 后端选择优先级

```
步骤实际使用的后端 =
    step.backend         (步骤级别，最高优先级)
    ?? pipeline.backend  (流水线级别)
    ?? BackendManager 默认  (第一个可用后端)
```

---

## 13.10 共享工具函数

### 13.10.1 函数清单

CLI 类后端（GdalCli、QgisProcess）共享以下工具函数：

| 函数 | 签名 | 功能 |
|------|------|------|
| `write_tmp_gdf()` | `(gdf, fmt="GPKG") → str` | 将 GeoDataFrame 写入临时文件 |
| `make_tmp_path()` | `(suffix=".gpkg") → str` | 生成临时文件路径 |
| `read_gdf()` | `(path) → GeoDataFrame` | 从文件读取 GeoDataFrame |
| `tmp_io()` | `(gdf) → (input_path, output_path)` | 上下文管理器，管理临时文件对 |

### 13.10.2 write_tmp_gdf

```python
def write_tmp_gdf(gdf, fmt="GPKG"):
    """将 GeoDataFrame 写入临时文件

    Args:
        gdf: 输入 GeoDataFrame
        fmt: 输出格式（默认 GPKG）

    Returns:
        str: 临时文件路径
    """
    path = make_tmp_path(".gpkg")
    gdf.to_file(path, driver=fmt)
    return path
```

### 13.10.3 make_tmp_path

```python
import tempfile
import uuid

def make_tmp_path(suffix=".gpkg"):
    """生成唯一的临时文件路径

    Returns:
        str: 临时文件路径（文件尚不存在）
    """
    tmp_dir = tempfile.gettempdir()
    filename = f"geopipe_{uuid.uuid4().hex[:8]}{suffix}"
    return os.path.join(tmp_dir, filename)
```

### 13.10.4 read_gdf

```python
import geopandas as gpd

def read_gdf(path):
    """从文件读取 GeoDataFrame

    Args:
        path: 文件路径

    Returns:
        GeoDataFrame: 读取的空间数据
    """
    return gpd.read_file(path)
```

### 13.10.5 tmp_io 上下文管理器

```python
from contextlib import contextmanager

@contextmanager
def tmp_io(gdf):
    """创建临时输入/输出文件对的上下文管理器

    自动写入输入数据到临时文件，并在退出时清理所有临时文件。

    Usage:
        with tmp_io(gdf) as (input_path, output_path):
            subprocess.run(["ogr2ogr", output_path, input_path])
            result = read_gdf(output_path)
    """
    input_path = write_tmp_gdf(gdf)
    output_path = make_tmp_path(".gpkg")
    try:
        yield input_path, output_path
    finally:
        for p in [input_path, output_path]:
            if os.path.exists(p):
                os.remove(p)
```

---

## 13.11 后端对比与选择指南

### 13.11.1 功能对比表

| 功能 | NativePython | GdalCli | GdalPython | QgisProcess | PyQgis |
|------|:----------:|:-------:|:----------:|:-----------:|:------:|
| buffer | ✅ | ✅ | ✅ | ✅ | ✅ |
| clip | ✅ | ✅ | ✅ | ✅ | ✅ |
| reproject | ✅ | ✅ | ✅ | ✅ | ✅ |
| dissolve | ✅ | ✅ | ✅ | ✅ | ✅ |
| simplify | ✅ | ✅ | ✅ | ✅ | ✅ |
| overlay | ✅ | ✅ | ✅ | ✅ | ✅ |

### 13.11.2 性能对比

| 后端 | 小数据 (<1k) | 中数据 (1k-100k) | 大数据 (>100k) | 内存效率 |
|------|:----------:|:---------------:|:--------------:|:-------:|
| NativePython | ⭐⭐⭐ | ⭐⭐ | ⭐ | 中 |
| GdalCli | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 高 |
| GdalPython | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 高 |
| QgisProcess | ⭐ | ⭐⭐ | ⭐⭐⭐ | 中 |
| PyQgis | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 中 |

### 13.11.3 依赖安装表

| 后端 | Python 包 | 系统依赖 | 安装命令 |
|------|-----------|---------|----------|
| NativePython | `geopandas`, `shapely` | — | `pip install geopipeagent` |
| GdalCli | — | GDAL CLI (`ogr2ogr`) | `apt install gdal-bin` |
| GdalPython | `GDAL` (Python) | libgdal-dev | `pip install GDAL` |
| QgisProcess | — | QGIS (≥ 3.16) | `apt install qgis` |
| PyQgis | `qgis` (Python) | QGIS (≥ 3.16) | QGIS Python 环境 |

### 13.11.4 选择建议

```
你的使用场景是？

├── 快速开发/原型 ──────────▶ NativePython（默认）
│
├── 生产环境 + 大数据 ──────▶ GdalCli 或 GdalPython
│
├── 需要 QGIS 特有算法 ────▶ QgisProcess
│
├── QGIS 插件开发 ─────────▶ PyQgis
│
└── 需要最大兼容性 ─────────▶ NativePython + 不指定后端
```

---

## 13.12 本章小结

本章详细介绍了 GeoPipeAgent 的多后端架构系统：

**架构设计：**
- **策略模式**：`GeoBackend` 抽象基类定义 6 个标准空间操作接口（buffer、clip、reproject、dissolve、simplify、overlay）
- **自动检测**：`BackendManager` 在初始化时检测所有已安装的后端
- **优先级选择**：步骤级别 > 流水线级别 > 默认（第一个可用后端）

**5 个后端实现：**

| 后端 | 底层引擎 | 适用场景 |
|------|---------|---------|
| `NativePythonBackend` | GeoPandas + Shapely | 默认，开发与原型 |
| `GdalCliBackend` | ogr2ogr 命令行 | 大数据生产环境 |
| `GdalPythonBackend` | GDAL/OGR Python 绑定 | 高性能，无 CLI 开销 |
| `QgisProcessBackend` | qgis_process CLI | QGIS 算法丰富 |
| `PyQgisBackend` | PyQGIS Python API | QGIS 全功能 |

**共享工具：**
- `write_tmp_gdf()`、`make_tmp_path()`、`read_gdf()`、`tmp_io()` 上下文管理器，为 CLI 后端提供统一的临时文件管理机制。

多后端系统使 GeoPipeAgent 能够适应从轻量级开发到企业级生产的各种部署环境，同时保持流水线定义的可移植性。

---

[下一章：Engine 执行引擎详解 →](14-Engine执行引擎详解.md)

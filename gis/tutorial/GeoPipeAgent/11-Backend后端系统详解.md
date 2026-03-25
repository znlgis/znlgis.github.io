---
layout: default
title: Backend后端系统详解
---

# 第十一章：Backend 后端系统详解

## 11.1 概述

Backend（后端）系统是 GeoPipeAgent 的 GIS 引擎抽象层。它将实际的空间操作与步骤逻辑解耦，使得同一个步骤可以使用不同的 GIS 引擎执行。

GeoPipeAgent 提供三种后端：

| 后端 | 类名 | 技术栈 | 适用场景 |
|------|------|--------|---------|
| `gdal_python` | `GdalPythonBackend` | GeoPandas + Shapely | 默认后端，适合中小数据 |
| `gdal_cli` | `GdalCliBackend` | ogr2ogr 命令行工具 | 大文件处理 |
| `qgis_process` | `QgisProcessBackend` | QGIS Processing CLI | 需要 QGIS 算法时 |

## 11.2 抽象基类 GeoBackend

所有后端都继承自 `GeoBackend` 抽象基类，该基类定义了统一的空间操作接口：

```python
from abc import ABC, abstractmethod

class GeoBackend(ABC):
    @abstractmethod
    def name(self) -> str:
        """返回后端标识名称"""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """检查后端依赖是否可用"""
        ...

    @abstractmethod
    def buffer(self, gdf, distance, **kwargs):
        """缓冲区分析"""
        ...

    @abstractmethod
    def clip(self, input_gdf, clip_gdf, **kwargs):
        """矢量裁剪"""
        ...

    @abstractmethod
    def reproject(self, gdf, target_crs, **kwargs):
        """投影转换"""
        ...

    @abstractmethod
    def dissolve(self, gdf, by=None, **kwargs):
        """融合"""
        ...

    @abstractmethod
    def simplify(self, gdf, tolerance, **kwargs):
        """几何简化"""
        ...

    @abstractmethod
    def overlay(self, gdf1, gdf2, how="intersection", **kwargs):
        """叠加分析"""
        ...
```

### 11.2.1 接口方法说明

| 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `buffer` | GeoDataFrame, distance | GeoDataFrame | 生成缓冲区 |
| `clip` | input_gdf, clip_gdf | GeoDataFrame | 裁剪 |
| `reproject` | GeoDataFrame, target_crs | GeoDataFrame | 投影转换 |
| `dissolve` | GeoDataFrame, by | GeoDataFrame | 融合 |
| `simplify` | GeoDataFrame, tolerance | GeoDataFrame | 简化 |
| `overlay` | gdf1, gdf2, how | GeoDataFrame | 叠加分析 |

### 11.2.2 设计说明

当前 `GeoBackend` 只定义了 6 个矢量操作方法。栅格、分析和网络类步骤直接在步骤内部实现，不经过 Backend 抽象层。这是因为：

1. 矢量操作有多种成熟的实现方案（Python API、CLI 工具、QGIS），适合抽象
2. 栅格操作主要依赖 Rasterio 和 NumPy，实现方式相对固定
3. 分析和网络步骤依赖特定的算法库（SciPy、NetworkX），抽象价值有限

## 11.3 GdalPythonBackend（默认后端）

### 11.3.1 技术栈

- **GeoPandas**：矢量数据操作
- **Shapely**：几何计算

### 11.3.2 可用性检测

```python
def is_available(self) -> bool:
    try:
        import geopandas
        import shapely
        return True
    except ImportError:
        return False
```

只要安装了 GeoPandas 和 Shapely，该后端即可用。由于这两个库是 GeoPipeAgent 的核心依赖，`gdal_python` 后端始终可用。

### 11.3.3 实现示例

以 `buffer` 方法为例：

```python
def buffer(self, gdf, distance, **kwargs):
    cap_style = kwargs.get("cap_style", "round")
    cap_map = {"round": 1, "flat": 2, "square": 3}
    cap = cap_map.get(cap_style, 1)

    result = gdf.copy()
    result["geometry"] = gdf.geometry.buffer(distance, cap_style=cap)
    return result
```

### 11.3.4 特点

- **优点**：纯 Python 实现，无需外部工具，API 简洁
- **缺点**：大数据量时性能不如 CLI 工具
- **适用**：日常分析、中小数据集、开发调试

## 11.4 GdalCliBackend

### 11.4.1 技术栈

- **ogr2ogr**：GDAL/OGR 命令行矢量处理工具
- **subprocess**：Python 子进程调用

### 11.4.2 可用性检测

```python
def is_available(self) -> bool:
    return shutil.which("ogr2ogr") is not None
```

检测系统 PATH 中是否存在 `ogr2ogr` 可执行文件。

### 11.4.3 工作流程

GdalCliBackend 的每个方法遵循相同的模式：

```
1. 将 GeoDataFrame 写入临时 GeoJSON 文件
2. 构造 ogr2ogr 命令行
3. 通过 subprocess 执行命令
4. 读取输出文件为 GeoDataFrame
5. 清理临时文件
```

以 `reproject` 为例：

```python
def reproject(self, gdf, target_crs, **kwargs):
    src = self._write_tmp(gdf)          # 写入临时文件
    fd, dst = tempfile.mkstemp(suffix=".geojson")
    os.close(fd)
    try:
        src_crs = str(gdf.crs) if gdf.crs else "EPSG:4326"
        self._run([
            "ogr2ogr", "-f", "GeoJSON", dst, src,
            "-s_srs", src_crs,
            "-t_srs", target_crs,
        ])
        return self._read_result(dst)
    finally:
        os.unlink(src)                   # 清理临时文件
        if os.path.exists(dst):
            os.unlink(dst)
```

### 11.4.4 SQL 操作

部分方法（如 `buffer`、`dissolve`、`overlay`）使用 SQLite SQL 方言执行空间操作：

```python
# buffer 使用 ST_Buffer SQL 函数
sql = f"SELECT ST_Buffer(geometry, {safe_distance}) AS geometry, * FROM \"{layer_name}\""
self._run([
    "ogr2ogr", "-f", "GeoJSON", dst, src,
    "-dialect", "sqlite",
    "-sql", sql,
])
```

### 11.4.5 安全考虑

GdalCliBackend 实现了标识符清洗方法，防止 SQL 注入：

```python
@staticmethod
def _sanitize_identifier(name: str) -> str:
    """只允许字母、数字和下划线"""
    import re
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        raise ValueError(f"Invalid identifier '{name}'")
    return name
```

### 11.4.6 特点

- **优点**：适合大文件处理，利用 GDAL 原生性能
- **缺点**：需要安装 GDAL CLI 工具，临时文件 IO 开销
- **适用**：大数据集处理、服务器环境

## 11.5 QgisProcessBackend

### 11.5.1 技术栈

- **qgis_process**：QGIS Processing CLI 工具
- **subprocess**：Python 子进程调用

### 11.5.2 可用性检测

```python
def is_available(self) -> bool:
    return shutil.which("qgis_process") is not None
```

### 11.5.3 工作流程

QgisProcessBackend 通过 `qgis_process run` 命令调用 QGIS 的 Processing 算法：

```python
@staticmethod
def _run_qgis(algorithm: str, params: dict) -> dict:
    cmd = ["qgis_process", "run", algorithm, "--json"]
    for key, value in params.items():
        cmd.extend([f"--{key}={value}"])

    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)
```

### 11.5.4 算法映射

| Backend 方法 | QGIS 算法 |
|-------------|-----------|
| `buffer` | `native:buffer` |
| `clip` | `native:clip` |
| `reproject` | `native:reprojectlayer` |
| `dissolve` | `native:dissolve` |
| `simplify` | `native:simplifygeometries` |
| `overlay` (intersection) | `native:intersection` |
| `overlay` (union) | `native:union` |
| `overlay` (difference) | `native:difference` |
| `overlay` (symmetric_difference) | `native:symmetricaldifference` |

### 11.5.5 特点

- **优点**：可以使用 QGIS 的完整算法库，结果与 QGIS 桌面一致
- **缺点**：需要安装 QGIS，启动开销较大
- **适用**：需要 QGIS 特定算法的场景

## 11.6 BackendManager

`BackendManager` 负责管理和选择后端：

```python
class BackendManager:
    def __init__(self):
        self.backends: list[GeoBackend] = []
        self._detect_available()

    def _detect_available(self):
        """自动检测所有可用后端"""
        for backend_cls in [GdalPythonBackend, GdalCliBackend, QgisProcessBackend]:
            backend = backend_cls()
            if backend.is_available():
                self.backends.append(backend)

    def get(self, preferred=None) -> GeoBackend:
        """获取后端实例"""
        if preferred:
            # 查找指定的后端
            for b in self.backends:
                if b.name() == preferred:
                    return b
            raise BackendNotAvailableError(
                f"Backend '{preferred}' is not available."
            )
        if not self.backends:
            raise BackendNotAvailableError("No GIS backends available.")
        return self.backends[0]  # 返回第一个可用的
```

### 11.6.1 后端优先级

自动检测按以下顺序：
1. `GdalPythonBackend`（通常总是可用）
2. `GdalCliBackend`（需要安装 GDAL CLI）
3. `QgisProcessBackend`（需要安装 QGIS）

如果没有指定后端，使用第一个可用的（通常是 `gdal_python`）。

## 11.7 在流水线中使用后端

### 11.7.1 自动选择（默认）

不指定 `backend` 字段，框架自动选择：

```yaml
- id: buffer
  use: vector.buffer
  params:
    input: "$read.output"
    distance: 500
# 自动使用第一个可用后端（通常是 gdal_python）
```

### 11.7.2 指定后端

通过 `backend` 字段指定：

```yaml
- id: buffer
  use: vector.buffer
  params:
    input: "$read.output"
    distance: 500
  backend: gdal_cli      # 使用 GDAL CLI 后端
```

### 11.7.3 混合使用后端

同一流水线中不同步骤可以使用不同后端：

```yaml
pipeline:
  name: "混合后端示例"
  steps:
    - id: read
      use: io.read_vector
      params:
        path: "data/large_dataset.shp"
      # IO 步骤不使用后端

    - id: reproject
      use: vector.reproject
      params:
        input: "$read.output"
        target_crs: "EPSG:3857"
      backend: gdal_cli      # 大数据集用 CLI 后端

    - id: buffer
      use: vector.buffer
      params:
        input: "$reproject.output"
        distance: 500
      backend: gdal_python    # 缓冲区用 Python 后端

    - id: save
      use: io.write_vector
      params:
        input: "$buffer.output"
        path: "output/result.geojson"
```

## 11.8 后端对比

| 特性 | gdal_python | gdal_cli | qgis_process |
|------|------------|----------|-------------|
| 依赖 | GeoPandas + Shapely | ogr2ogr CLI | QGIS |
| 安装难度 | 低 | 中 | 高 |
| 大文件性能 | 中 | 高 | 中 |
| 启动开销 | 低 | 中 | 高 |
| 算法丰富度 | 中 | 中 | 高 |
| 内存使用 | 高（全部加载） | 低（流式处理） | 中 |
| 跨平台 | ✅ | ✅ | ✅ |
| 默认可用 | ✅ | ❌ | ❌ |

### 11.8.1 选择建议

| 场景 | 推荐后端 |
|------|---------|
| 日常开发和测试 | `gdal_python` |
| 处理超过 1GB 的数据 | `gdal_cli` |
| 需要 QGIS 特定算法 | `qgis_process` |
| 服务器部署 | `gdal_python` 或 `gdal_cli` |
| 教学演示 | `gdal_python` |

## 11.9 扩展自定义后端

如果需要添加新的后端（例如 PostGIS 后端），步骤如下：

1. **继承 GeoBackend**：实现所有抽象方法
2. **在 BackendManager 中注册**：添加到检测列表

```python
# 示例：PostGIS 后端
class PostgisBackend(GeoBackend):
    def name(self) -> str:
        return "postgis"

    def is_available(self) -> bool:
        try:
            import psycopg2
            return True
        except ImportError:
            return False

    def buffer(self, gdf, distance, **kwargs):
        # 通过 SQL 在 PostGIS 中执行缓冲区
        ...
```

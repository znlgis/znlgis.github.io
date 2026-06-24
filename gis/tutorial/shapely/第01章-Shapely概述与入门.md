---
layout: default
title: 第1章：Shapely 概述与入门
---

# 第1章：Shapely 概述与入门

> Shapely 是 Python 生态中最重要的计算几何库之一。本章将全面介绍 Shapely 的定义、背景、设计理念、在 GIS 生态中的位置，以及如何快速上手使用它。无论你是 GIS 开发者、数据科学家还是空间分析师，Shapely 都是你工具箱中不可或缺的利器。

---

## 1.1 什么是 Shapely

### 1.1.1 Shapely 的定义

Shapely 是一个基于 **BSD 开源许可证**发布的 Python 包，专门用于在 **二维笛卡尔平面**上进行几何对象的操作与分析。它提供了创建、操作和分析平面几何体（如点、线、多边形）的能力，是 Python 空间数据处理的核心基础库。

Shapely 的核心能力包括：

- **几何对象创建**：支持点（Point）、线（LineString）、多边形（Polygon）等所有 OGC Simple Features 标准定义的几何类型
- **空间关系判断**：包含、相交、接触、重叠等拓扑关系的判断
- **几何运算**：交集、并集、差集、缓冲区等空间操作
- **几何属性计算**：面积、长度、质心、边界框等属性的获取
- **几何验证与修复**：检查几何体的有效性并进行修复

```python
# Shapely 的基本用法一览
from shapely import Point, Polygon

# 创建一个点
point = Point(1.0, 2.0)
print(f"点: {point}")           # POINT (1 2)
print(f"类型: {point.geom_type}")  # Point

# 创建一个多边形
polygon = Polygon([(0, 0), (4, 0), (4, 4), (0, 4)])
print(f"面积: {polygon.area}")     # 16.0
print(f"周长: {polygon.length}")   # 16.0

# 空间关系判断
print(f"点在多边形内: {polygon.contains(point)}")  # True
```

### 1.1.2 核心特征

| 特征 | 说明 |
|------|------|
| 开源许可 | BSD 3-Clause License，允许商业使用 |
| 几何维度 | 二维笛卡尔平面（支持 Z 坐标存储但不参与计算） |
| 底层引擎 | 基于 GEOS（C/C++ 几何计算引擎） |
| 标准兼容 | 遵循 OGC Simple Features 规范 |
| Python 版本 | 支持 Python 3.8+ |
| 线程安全 | GEOS 操作时释放 GIL，支持多线程 |

---

## 1.2 项目背景与历史

### 1.2.1 技术渊源

Shapely 的技术基础深植于一条成熟的开源几何计算链条：

```
┌─────────────────────────────────────────────────────────────┐
│                    几何计算引擎的技术传承                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                          │
│   │    JTS      │  Java Topology Suite                     │
│   │  (Java)     │  最早的计算几何库（2002 年）                │
│   └──────┬──────┘                                          │
│          │ C++ 移植                                         │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │    GEOS     │  Geometry Engine - Open Source            │
│   │  (C/C++)    │  PostGIS 的几何引擎                       │
│   └──────┬──────┘                                          │
│          │ Python 绑定                                      │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │   Shapely   │  Python 几何操作库                        │
│   │  (Python)   │  优雅的 Pythonic API                      │
│   └─────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**JTS（Java Topology Suite）**：由加拿大 Vivid Solutions 公司于 2002 年开发的 Java 计算几何库，实现了 OGC 的 Simple Features 规范。JTS 是整个开源几何计算生态的源头。

**GEOS（Geometry Engine - Open Source）**：JTS 的 C/C++ 移植版本，由 Refractions Research 开发，是 PostGIS 空间数据库的核心几何引擎。GEOS 继承了 JTS 的所有算法实现，并针对 C/C++ 环境进行了优化。

**Shapely**：通过 Python 的 ctypes（1.x 版本）或 Cython（2.0 版本）机制调用 GEOS 的 C API，为 Python 开发者提供了简洁、优雅的几何操作接口。

### 1.2.2 版本发展历程

| 时间 | 版本 | 重要里程碑 |
|------|------|-----------|
| 2007 | 1.0 | Shapely 首次发布，通过 ctypes 绑定 GEOS |
| 2010 | 1.2 | 改进了几何操作性能和稳定性 |
| 2014 | 1.4 | 支持 GEOS 3.4+，增加了 prepared geometry |
| 2017 | 1.6 | 改进了 vectorized operations 的初步支持 |
| 2019 | 1.7 | 引入了对 NumPy 数组的初步支持 |
| 2022 | 2.0 | **重大版本更新**：不可变几何体、向量化操作、NumPy 深度集成 |
| 2023 | 2.0.1-2.0.6 | 持续修复和性能改进 |
| 2025 | 2.1.0 | transform_coordseq、M 坐标支持（4月发布） |
| 2025 | 2.1.2 | 性能改进与 Bug 修复（9月发布），当前最新稳定版 |

### 1.2.3 Shapely 2.0 的重大变化

Shapely 2.0 是一次**破坏性的大版本更新**，带来了根本性的架构变化：

**1. 不可变几何体（Immutable Geometries）**

```python
from shapely import Point

p = Point(1, 2)
# Shapely 2.0 中，几何对象是不可变的
# 不能修改已有几何体，只能创建新的
# p.coords = [(3, 4)]  # 这在 2.0 中会抛出异常

# 正确方式：创建新的几何体
p_new = Point(3, 4)
```

**2. 向量化操作（Vectorized Operations）**

```python
import numpy as np
import shapely

# 批量创建点——向量化操作，性能远优于循环
coords = np.array([[0, 0], [1, 1], [2, 2], [3, 3]])
points = shapely.points(coords)
print(points)  # 返回 NumPy 数组，包含 4 个 Point 对象

# 批量计算距离
origin = Point(0, 0)
distances = shapely.distance(points, origin)
print(distances)  # [0.  1.41421356  2.82842712  4.24264069]
```

**3. 可哈希（Hashable）**

```python
from shapely import Point

p1 = Point(1, 2)
p2 = Point(3, 4)

# 2.0 中几何对象可用作字典键和集合元素
point_set = {p1, p2}
point_dict = {p1: "A", p2: "B"}
print(point_dict[p1])  # "A"
```

**4. NumPy 深度集成**

```python
import numpy as np
import shapely

# NumPy 数组可直接存储几何对象
geom_array = np.array([Point(0, 0), Point(1, 1), Point(2, 2)])

# 所有 shapely 顶级函数都支持数组输入
areas = shapely.area(geom_array)
is_valid = shapely.is_valid(geom_array)
```

---

## 1.3 核心设计理念

### 1.3.1 专注于几何计算

Shapely 的设计哲学非常明确——**只做几何计算，做到极致**：

- **不处理坐标参考系统（CRS）**：Shapely 不知道也不关心你的坐标是 WGS84、UTM 还是其他任何投影。所有计算都在笛卡尔平面上进行。如果需要坐标转换，请使用 `pyproj` 库。
- **不关注数据序列化格式**：虽然 Shapely 支持 WKT、WKB 和 GeoJSON 格式的输入输出，但它的核心不是数据格式转换。如果需要读写地理数据文件（Shapefile、GeoPackage 等），请使用 `Fiona` 或 `GDAL/OGR`。
- **不提供可视化功能**：Shapely 本身不绑定任何可视化引擎。如果需要绘图，请配合 `matplotlib` 使用。

```python
# Shapely 专注于几何计算的示例
from shapely import Point, Polygon

# 创建几何体（不需要指定坐标系）
park = Polygon([(0, 0), (100, 0), (100, 80), (0, 80)])
school = Point(50, 40)

# 几何分析
buffer_zone = school.buffer(30)          # 缓冲区分析
overlap = park.intersection(buffer_zone)  # 交集运算
print(f"重叠面积: {overlap.area:.2f}")    # 几何计算结果
```

### 1.3.2 Pythonic API 设计

Shapely 提供了非常符合 Python 编程习惯的 API：

```python
from shapely import Point, Polygon, box

# 像使用普通 Python 对象一样使用几何体
p = Point(1, 2)
print(f"x={p.x}, y={p.y}")        # 属性访问
print(f"WKT: {p}")                 # 字符串表示即 WKT
print(f"repr: {repr(p)}")          # POINT (1 2)

# 运算符重载
poly1 = box(0, 0, 2, 2)
poly2 = box(1, 1, 3, 3)

union = poly1 | poly2              # | 运算符 = union
inter = poly1 & poly2              # & 运算符 = intersection
diff = poly1 - poly2               # - 运算符 = difference
sym_diff = poly1 ^ poly2           # ^ 运算符 = symmetric_difference

# in 运算符
print(Point(1, 1) in poly1)       # 等价于 poly1.contains(Point(1, 1))
```

### 1.3.3 多线程支持

Shapely 2.0 在执行 GEOS 操作时会释放 Python 的全局解释器锁（GIL），这意味着你可以在多线程环境中高效地使用 Shapely：

```python
import shapely
import numpy as np
from concurrent.futures import ThreadPoolExecutor

# 生成大量几何体
polygons = shapely.box(
    np.random.uniform(0, 100, 1000),
    np.random.uniform(0, 100, 1000),
    np.random.uniform(100, 200, 1000),
    np.random.uniform(100, 200, 1000)
)

# GEOS 操作在多线程中可以并行执行
# 因为 GEOS 计算时释放了 GIL
areas = shapely.area(polygons)       # 向量化操作，内部已并行
buffers = shapely.buffer(polygons, 5.0)
```

---

## 1.4 Shapely 在 GIS 生态中的位置

### 1.4.1 Python 空间数据处理生态全景

```
┌─────────────────────────────────────────────────────────────────┐
│                    Python GIS 生态全景                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  应用层                                                         │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐   │
│  │ Web GIS    │  │ 数据分析  │  │  科学计算   │  │ 可视化   │   │
│  │ (Flask/    │  │(Jupyter) │  │ (SciPy)    │  │(Folium/  │   │
│  │  Django)   │  │          │  │            │  │ Kepler)  │   │
│  └─────┬──────┘  └────┬─────┘  └─────┬──────┘  └────┬─────┘   │
│        │              │              │              │           │
│        └──────────────┼──────────────┼──────────────┘           │
│                       ▼                                         │
│  数据框架层     ┌──────────────┐                                │
│                │  GeoPandas   │  空间数据框                      │
│                └──────┬───────┘                                 │
│                       │                                         │
│  核心几何层     ┌──────▼───────┐                                │
│                │   Shapely    │  几何计算  ◄── 你在这里           │
│                └──────┬───────┘                                 │
│                       │                                         │
│  I/O 层        ┌──────▼───────┐  ┌──────────┐                  │
│                │    Fiona     │  │  pyproj   │  坐标转换         │
│                └──────┬───────┘  └──────────┘                   │
│                       │                                         │
│  底层引擎       ┌──────▼───────┐  ┌──────────┐                  │
│                │    GEOS      │  │  GDAL     │  空间数据 I/O    │
│                │   (C/C++)    │  │  (C/C++)  │                  │
│                └──────────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4.2 与相关库的关系

**Shapely 与 GEOS**

Shapely 是 GEOS 的 Python 绑定。GEOS 提供底层的 C/C++ 几何算法实现，Shapely 将其封装为 Pythonic 的接口。Shapely 2.0 使用 Cython 直接绑定 GEOS 的 C API，相比 1.x 的 ctypes 方式性能大幅提升。

```python
import shapely
# 查看 GEOS 版本
print(f"GEOS 版本: {shapely.geos_version}")         # (3, 11, 2)
print(f"Shapely 版本: {shapely.__version__}")        # 2.0.x
```

**Shapely 与 GeoPandas**

GeoPandas 是基于 Pandas 和 Shapely 的空间数据框库。GeoPandas 的 `geometry` 列中的每个元素都是一个 Shapely 几何对象。

```python
import geopandas as gpd
from shapely import Point

# GeoPandas 内部使用 Shapely 几何对象
gdf = gpd.GeoDataFrame({
    'name': ['北京', '上海', '广州'],
    'geometry': [Point(116.4, 39.9), Point(121.5, 31.2), Point(113.3, 23.1)]
})

# 每个元素都是 Shapely 对象
print(type(gdf.geometry[0]))  # <class 'shapely.geometry.point.Point'>
```

**Shapely 与 Fiona**

Fiona 负责地理数据文件的读写（Shapefile、GeoPackage 等），读入的几何数据可以直接转换为 Shapely 对象进行分析。

```python
import fiona
from shapely.geometry import shape

# Fiona 读取，Shapely 分析
with fiona.open("buildings.shp") as src:
    for feature in src:
        geom = shape(feature['geometry'])  # 转为 Shapely 对象
        print(f"面积: {geom.area}")
```

**Shapely 与 PostGIS**

PostGIS 和 Shapely 共享相同的底层引擎（GEOS），因此它们的几何计算结果是一致的。Shapely 适合在 Python 中进行几何分析，而 PostGIS 适合在数据库中进行大规模空间查询。

### 1.4.3 关系对比表

| 库 | 定位 | 与 Shapely 的关系 |
|------|------|-------------------|
| GEOS | C/C++ 几何引擎 | Shapely 的底层引擎 |
| JTS | Java 几何引擎 | GEOS 的 Java 原版，算法同源 |
| PostGIS | 空间数据库 | 与 Shapely 共享 GEOS 引擎 |
| GeoPandas | 空间数据框 | 基于 Shapely 构建 |
| Fiona | 地理文件 I/O | 与 Shapely 搭配使用 |
| pyproj | 坐标转换 | 补充 Shapely 不具备的 CRS 转换能力 |
| GDAL/OGR | 底层空间数据 I/O | Fiona 的底层引擎 |
| matplotlib | 绑图库 | 可用于绘制 Shapely 几何体 |

---

## 1.5 适用场景

### 1.5.1 空间数据预处理

在进行空间分析之前，通常需要对几何数据进行预处理：

```python
from shapely import Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely.validation import make_valid

# 修复无效的几何体
invalid_poly = Polygon([(0, 0), (2, 2), (2, 0), (0, 2)])  # 自交叉
valid_poly = make_valid(invalid_poly)
print(f"修复前有效: {invalid_poly.is_valid}")  # False
print(f"修复后有效: {valid_poly.is_valid}")    # True

# 合并多个几何体
polygons = [
    Polygon([(0, 0), (2, 0), (2, 2), (0, 2)]),
    Polygon([(1, 1), (3, 1), (3, 3), (1, 3)]),
    Polygon([(2, 2), (4, 2), (4, 4), (2, 4)])
]
merged = unary_union(polygons)
print(f"合并后类型: {merged.geom_type}")
```

### 1.5.2 几何分析

```python
from shapely import Point, Polygon, LineString

# 点在面内判断（地理围栏）
fence = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
location = Point(5, 5)
print(f"在围栏内: {fence.contains(location)}")  # True

# 路径与区域的交集（道路穿过公园的部分）
road = LineString([(0, 5), (15, 5)])
park = Polygon([(2, 2), (8, 2), (8, 8), (2, 8)])
road_in_park = road.intersection(park)
print(f"穿过公园的路段长度: {road_in_park.length}")  # 6.0
```

### 1.5.3 Web GIS 后端

```python
from shapely import Point, box
from shapely.geometry import mapping
import json

# GeoJSON 输出（Web API 返回）
polygon = box(0, 0, 10, 10)
geojson = mapping(polygon)
print(json.dumps(geojson, indent=2))
# {
#   "type": "Polygon",
#   "coordinates": [[[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]]
# }

# 空间查询：找到视口范围内的点
viewport = box(100, 30, 120, 40)  # 经度 100-120, 纬度 30-40
cities = [Point(116.4, 39.9), Point(121.5, 31.2), Point(113.3, 23.1)]
visible = [c for c in cities if viewport.contains(c)]
print(f"可见城市数: {len(visible)}")
```

### 1.5.4 科学计算

```python
import numpy as np
import shapely

# 批量生成随机多边形并计算面积分布
np.random.seed(42)
n = 10000
x = np.random.uniform(0, 100, n)
y = np.random.uniform(0, 100, n)
points = shapely.points(x, y)
buffers = shapely.buffer(points, np.random.uniform(1, 10, n))
areas = shapely.area(buffers)

print(f"平均面积: {areas.mean():.2f}")
print(f"最大面积: {areas.max():.2f}")
print(f"面积标准差: {areas.std():.2f}")
```

---

## 1.6 快速上手示例

### 1.6.1 创建基本几何体

```python
from shapely import Point, LineString, Polygon

# 创建点
p1 = Point(0, 0)
p2 = Point(3, 4)
print(f"点 p1: {p1}")               # POINT (0 0)
print(f"点 p2: {p2}")               # POINT (3 4)
print(f"两点距离: {p1.distance(p2)}")  # 5.0

# 创建线
line = LineString([(0, 0), (1, 1), (2, 0), (3, 1)])
print(f"线: {line}")
print(f"线长度: {line.length:.4f}")   # 4.2426

# 创建多边形
poly = Polygon([(0, 0), (4, 0), (4, 3), (0, 3)])
print(f"多边形: {poly}")
print(f"面积: {poly.area}")           # 12.0
print(f"周长: {poly.length}")         # 14.0
print(f"质心: {poly.centroid}")       # POINT (2 1.5)
```

### 1.6.2 缓冲区分析

```python
from shapely import Point

# 以点为圆心创建缓冲区（近似圆）
center = Point(0, 0)
circle = center.buffer(10)
print(f"缓冲区面积: {circle.area:.2f}")  # 约 314.16（≈ π * 10²）
print(f"缓冲区顶点数: {len(circle.exterior.coords)}")  # 默认 65 个顶点

# 控制缓冲区精度
circle_low = center.buffer(10, quad_segs=4)   # 低精度
circle_high = center.buffer(10, quad_segs=64)  # 高精度
print(f"低精度面积: {circle_low.area:.2f}")
print(f"高精度面积: {circle_high.area:.2f}")
```

### 1.6.3 交集运算

```python
from shapely import Polygon

# 两个重叠的矩形
rect1 = Polygon([(0, 0), (3, 0), (3, 3), (0, 3)])
rect2 = Polygon([(1, 1), (4, 1), (4, 4), (1, 4)])

# 交集
intersection = rect1.intersection(rect2)
print(f"交集面积: {intersection.area}")  # 4.0
print(f"交集形状: {intersection}")
# POLYGON ((1 1, 3 1, 3 3, 1 3, 1 1))

# 并集
union = rect1.union(rect2)
print(f"并集面积: {union.area}")  # 14.0

# 差集
difference = rect1.difference(rect2)
print(f"差集面积: {difference.area}")  # 5.0

# 对称差集
sym_diff = rect1.symmetric_difference(rect2)
print(f"对称差集面积: {sym_diff.area}")  # 10.0
```

### 1.6.4 综合示例：简易地理围栏检测

```python
from shapely import Point, Polygon

# 定义围栏区域（模拟校园边界）
campus = Polygon([
    (116.32, 39.98), (116.34, 39.98),
    (116.34, 40.00), (116.32, 40.00)
])

# 模拟 GPS 定位点
locations = [
    ("小明", Point(116.33, 39.99)),   # 校园内
    ("小红", Point(116.35, 39.99)),   # 校园外
    ("小刚", Point(116.34, 39.98)),   # 边界上
]

for name, loc in locations:
    if campus.contains(loc):
        status = "在校园内 ✓"
    elif campus.touches(loc) or campus.boundary.distance(loc) < 0.0001:
        status = "在校园边界 ~"
    else:
        status = "在校园外 ✗"
    print(f"{name}: {status}")
```

---

## 1.7 与其他库的对比

### 1.7.1 Shapely vs GDAL/OGR

| 对比维度 | Shapely | GDAL/OGR |
|---------|---------|----------|
| 主要功能 | 几何计算 | 空间数据读写 + 基本几何操作 |
| 编程体验 | Pythonic，优雅简洁 | C 风格 API，较为繁琐 |
| 数据 I/O | 不支持文件读写 | 支持 200+ 种空间数据格式 |
| 几何能力 | 全面的几何分析和操作 | 基本的几何操作 |
| 底层引擎 | GEOS | GEOS + 自有实现 |
| 适用场景 | 几何分析和处理 | 数据格式转换和读写 |

### 1.7.2 Shapely vs GeoPandas

| 对比维度 | Shapely | GeoPandas |
|---------|---------|-----------|
| 抽象层级 | 单个几何对象 | 几何对象集合（GeoDataFrame） |
| 数据管理 | 不管理属性数据 | 管理几何 + 属性数据 |
| 文件 I/O | 不支持 | 支持 Shapefile、GeoJSON 等 |
| 依赖关系 | 独立 | 依赖 Shapely |
| 适用场景 | 精细几何操作 | 批量空间数据分析 |

### 1.7.3 Shapely vs PostGIS

| 对比维度 | Shapely | PostGIS |
|---------|---------|---------|
| 运行环境 | Python 进程内 | PostgreSQL 数据库 |
| 数据规模 | 适合中小规模 | 适合大规模数据 |
| 引擎 | GEOS | GEOS（相同引擎） |
| 并发支持 | 多线程 | 多连接并行 |
| 空间索引 | STRtree | GiST / SP-GiST |
| 适用场景 | 脚本分析、原型开发 | 生产环境、大规模查询 |

### 1.7.4 互补使用模式

在实际项目中，这些库通常是互补使用的：

```python
# 典型的 Python GIS 工作流
import fiona          # 读取空间数据文件
from shapely.geometry import shape, mapping  # 几何操作
import pyproj         # 坐标转换
import geopandas as gpd  # 空间数据框分析

# 1. 用 Fiona 读取数据
# 2. 用 Shapely 做几何计算
# 3. 用 pyproj 做坐标转换
# 4. 用 GeoPandas 管理数据和批量操作
# 5. 用 matplotlib 可视化结果
```

---

## 1.8 本章小结

本章我们学习了：

- **Shapely 是什么**：一个基于 BSD 许可的 Python 几何操作库，专注于二维笛卡尔平面几何计算
- **技术渊源**：JTS → GEOS → Shapely 的技术传承链
- **设计理念**：专注几何计算、Pythonic API、多线程支持
- **生态位置**：与 GEOS、GeoPandas、Fiona、PostGIS 的关系
- **版本演进**：Shapely 2.0 带来了不可变几何体、向量化操作和 NumPy 集成
- **适用场景**：空间预处理、几何分析、Web 后端、科学计算
- **快速上手**：创建点线面、缓冲区、交集运算

下一章我们将详细介绍 Shapely 的安装与环境配置。

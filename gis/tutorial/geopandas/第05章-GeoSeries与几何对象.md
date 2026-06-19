---
layout: default
title: "第5章：GeoSeries 与几何对象"
---

# 第5章：GeoSeries 与几何对象

> GeoSeries 是 GeoPandas 中承载几何数据的核心容器，而几何对象是空间数据的基本单元。本章将深入讲解 GeoSeries 的创建方式、支持的几何类型、属性访问、构造方法以及向量化操作。

---

## 5.1 GeoSeries 概述

### 5.1.1 定义

GeoSeries 是 GeoPandas 中专门用于存储几何对象的一维数组，继承自 `pandas.Series`。它是 GeoDataFrame 中几何列的数据类型。

```python
import geopandas as gpd
from shapely.geometry import Point

gs = gpd.GeoSeries([Point(0, 0), Point(1, 1), Point(2, 2)], crs="EPSG:4326")
print("类型:", type(gs))
print("dtype:", gs.dtype)
print("CRS:", gs.crs)
print("长度:", len(gs))
```

输出：

```
类型: <class 'geopandas.geoseries.GeoSeries'>
dtype: geometry
CRS: EPSG:4326
长度: 3
```

### 5.1.2 核心特点

| 特点 | 说明 |
|------|------|
| **继承 pandas Series** | 所有 Series 方法可用（索引、切片、过滤等） |
| **存储 Shapely 几何对象** | 每个元素是一个 Shapely 几何对象或 None |
| **自带 CRS** | 每个 GeoSeries 可以有独立的坐标参考系 |
| **向量化操作** | 支持批量空间操作，无需逐行循环 |
| **空间索引** | 内置 STRtree 空间索引，加速空间查询 |
| **"geometry" dtype** | 使用自定义的 pandas ExtensionDtype |

### 5.1.3 与 pandas Series 的关系

```python
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

gs = gpd.GeoSeries([Point(0, 0), Point(1, 1)])

# GeoSeries 是 pandas Series 的子类
print(isinstance(gs, pd.Series))       # True
print(isinstance(gs, gpd.GeoSeries))   # True

# pandas Series 的方法都可以使用
print(gs.index)                         # RangeIndex(start=0, stop=2, step=1)
print(gs.values)                        # GeometryArray
print(gs.iloc[0])                       # POINT (0 0)
print(gs.isna().sum())                  # 0

# GeoSeries 特有的方法
print(gs.area)                          # 面积
print(gs.centroid)                      # 质心
print(gs.is_valid)                      # 有效性
```

### 5.1.4 GeoSeries 在 GeoDataFrame 中的角色

```python
import geopandas as gpd
from shapely.geometry import Point

gdf = gpd.GeoDataFrame({
    '名称': ['A', 'B', 'C'],
    'geometry': [Point(0, 0), Point(1, 1), Point(2, 2)]
}, crs="EPSG:4326")

# 几何列就是 GeoSeries
gs = gdf.geometry
print("几何列类型:", type(gs))          # GeoSeries
print("几何列名称:", gs.name)           # 'geometry'

# 也可以通过列名访问
gs2 = gdf['geometry']
print("列访问类型:", type(gs2))         # GeoSeries

# GeoSeries 操作返回的结果可以直接赋值给 GeoDataFrame
gdf['centroid_geom'] = gdf.centroid
gdf['buffer_geom'] = gdf.buffer(0.5)
```

---

## 5.2 创建 GeoSeries

### 5.2.1 从 Shapely 几何对象创建

最基本的方式是直接从 Shapely 几何对象列表创建：

```python
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon

# 点
gs_points = gpd.GeoSeries([
    Point(116.40, 39.90),   # 北京
    Point(121.47, 31.23),   # 上海
    Point(113.26, 23.13),   # 广州
    None                     # 缺失值
], crs="EPSG:4326")
print("点 GeoSeries:")
print(gs_points)

# 线
gs_lines = gpd.GeoSeries([
    LineString([(0, 0), (1, 1), (2, 0)]),
    LineString([(0, 0), (0, 2), (2, 2)])
])
print("\n线 GeoSeries:")
print(gs_lines)

# 面
gs_polygons = gpd.GeoSeries([
    Polygon([(0, 0), (2, 0), (2, 2), (0, 2)]),
    Polygon([(1, 1), (3, 1), (3, 3), (1, 3)])
])
print("\n面 GeoSeries:")
print(gs_polygons)
```

### 5.2.2 from_wkt() - 从 WKT 创建

WKT（Well-Known Text）是一种常见的几何数据文本表示格式：

```python
import geopandas as gpd

# 从 WKT 字符串列表创建
gs = gpd.GeoSeries.from_wkt([
    'POINT (116.40 39.90)',
    'POINT (121.47 31.23)',
    'LINESTRING (0 0, 1 1, 2 0)',
    'POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))',
    None  # 缺失值
], crs="EPSG:4326")

print("从 WKT 创建:")
print(gs)
print("\n几何类型:", gs.geom_type.tolist())
```

**常见 WKT 格式**：

| 几何类型 | WKT 示例 |
|----------|----------|
| Point | `POINT (0 0)` |
| Point Z | `POINT Z (0 0 10)` |
| LineString | `LINESTRING (0 0, 1 1, 2 0)` |
| Polygon | `POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))` |
| Polygon (含洞) | `POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0), (2 2, 8 2, 8 8, 2 8, 2 2))` |
| MultiPoint | `MULTIPOINT ((0 0), (1 1))` |
| MultiLineString | `MULTILINESTRING ((0 0, 1 1), (2 2, 3 3))` |
| MultiPolygon | `MULTIPOLYGON (((0 0, 1 0, 1 1, 0 0)), ((2 2, 3 2, 3 3, 2 2)))` |
| GeometryCollection | `GEOMETRYCOLLECTION (POINT (0 0), LINESTRING (0 0, 1 1))` |

### 5.2.3 from_wkb() - 从 WKB 创建

WKB（Well-Known Binary）是几何数据的二进制表示，常用于数据库存储和高效传输：

```python
import geopandas as gpd
from shapely.geometry import Point

# 先创建 WKB 数据
gs_original = gpd.GeoSeries([Point(0, 0), Point(1, 1)])
wkb_data = gs_original.to_wkb()

print("WKB 数据 (十六进制):")
print(wkb_data.apply(lambda x: x.hex() if x else None))

# 从 WKB 创建
gs_from_wkb = gpd.GeoSeries.from_wkb(wkb_data, crs="EPSG:4326")
print("\n从 WKB 创建:")
print(gs_from_wkb)
```

### 5.2.4 points_from_xy() - 从坐标创建点

这是创建点数据最便捷的方式：

```python
import geopandas as gpd
import numpy as np

# 基本用法
gs = gpd.GeoSeries.from_xy(
    x=[116.40, 121.47, 113.26],
    y=[39.90, 31.23, 23.13],
    crs="EPSG:4326"
)
print("from_xy:")
print(gs)

# 也可以使用 gpd.points_from_xy（模块级函数）
geom = gpd.points_from_xy(
    x=[116.40, 121.47, 113.26],
    y=[39.90, 31.23, 23.13]
)
gs2 = gpd.GeoSeries(geom, crs="EPSG:4326")
print("\npoints_from_xy:")
print(gs2)

# 包含 Z 坐标
gs_3d = gpd.GeoSeries.from_xy(
    x=[0, 1, 2],
    y=[0, 1, 2],
    z=[10, 20, 30],
    crs="EPSG:4326"
)
print("\n3D 点:")
print(gs_3d)
print("has_z:", gs_3d.has_z.tolist())

# 从 numpy 数组创建（大规模数据）
n = 10000
x = np.random.uniform(113, 122, n)
y = np.random.uniform(22, 41, n)
gs_large = gpd.GeoSeries.from_xy(x, y, crs="EPSG:4326")
print(f"\n大规模数据: {len(gs_large)} 个点")
```

### 5.2.5 创建方式对比

| 方式 | 适用场景 | 性能 | 灵活性 |
|------|----------|------|--------|
| Shapely 对象列表 | 各种几何类型 | 中 | ⭐⭐⭐⭐⭐ |
| `from_wkt()` | WKT 文本数据 | 高 | ⭐⭐⭐ |
| `from_wkb()` | 数据库/二进制数据 | 最高 | ⭐⭐ |
| `from_xy()` / `points_from_xy()` | 经纬度/坐标数据 | 最高 | ⭐⭐（仅点） |

---

## 5.3 支持的几何类型

GeoPandas 通过 Shapely 支持所有 OGC Simple Features 几何类型。

### 5.3.1 Point（点）

点是最简单的几何类型，由一对坐标定义：

```python
from shapely.geometry import Point

# 2D 点
p1 = Point(116.40, 39.90)
print(f"坐标: ({p1.x}, {p1.y})")
print(f"类型: {p1.geom_type}")

# 3D 点
p2 = Point(116.40, 39.90, 100)
print(f"3D 坐标: ({p2.x}, {p2.y}, {p2.z})")
print(f"has_z: {p2.has_z}")

# 点的属性
print(f"坐标元组: {p1.coords[:]}")      # [(116.4, 39.9)]
print(f"边界框: {p1.bounds}")             # (116.4, 39.9, 116.4, 39.9)
print(f"面积: {p1.area}")                 # 0.0
print(f"长度: {p1.length}")               # 0.0
```

**应用场景**：城市位置、监测站点、兴趣点（POI）、事件位置等。

### 5.3.2 LineString（线）

线由两个或更多点按顺序连接而成：

```python
from shapely.geometry import LineString

# 创建线
line = LineString([(0, 0), (1, 1), (2, 0), (3, 1)])
print(f"类型: {line.geom_type}")
print(f"长度: {line.length:.4f}")
print(f"顶点数: {len(line.coords)}")
print(f"坐标列表: {list(line.coords)}")
print(f"边界框: {line.bounds}")

# 线的属性
print(f"起点: {line.coords[0]}")
print(f"终点: {line.coords[-1]}")
print(f"是否闭合: {line.is_closed}")
print(f"是否简单: {line.is_simple}")

# 线上的插值点
midpoint = line.interpolate(0.5, normalized=True)
print(f"中点: {midpoint}")
```

**应用场景**：道路网络、河流、管线、轨迹路线等。

### 5.3.3 LinearRing（线环）

线环是闭合的线，通常作为 Polygon 的边界：

```python
from shapely.geometry import LinearRing

ring = LinearRing([(0, 0), (1, 0), (1, 1), (0, 1)])
print(f"类型: {ring.geom_type}")
print(f"是否闭合: {ring.is_closed}")   # True
print(f"是否简单: {ring.is_simple}")   # True
print(f"长度: {ring.length}")           # 4.0
print(f"面积: {ring.area}")             # 0.0（线没有面积）
print(f"坐标: {list(ring.coords)}")     # 首尾坐标相同
```

> 📝 **注意**：LinearRing 通常不直接使用，而是作为 Polygon 的组成部分（外环和内环）。

### 5.3.4 Polygon（多边形）

多边形由一个外环和零个或多个内环（洞）组成：

```python
from shapely.geometry import Polygon

# 简单多边形
polygon = Polygon([(0, 0), (4, 0), (4, 3), (0, 3)])
print(f"类型: {polygon.geom_type}")
print(f"面积: {polygon.area}")           # 12.0
print(f"周长: {polygon.length}")         # 14.0
print(f"顶点数: {len(polygon.exterior.coords)}")

# 带洞的多边形
polygon_with_hole = Polygon(
    shell=[(0, 0), (10, 0), (10, 10), (0, 10)],   # 外环
    holes=[[(2, 2), (8, 2), (8, 8), (2, 8)]]       # 内环（洞）
)
print(f"\n带洞多边形:")
print(f"  面积: {polygon_with_hole.area}")          # 100 - 36 = 64
print(f"  外环顶点数: {len(polygon_with_hole.exterior.coords)}")
print(f"  内环数量: {len(list(polygon_with_hole.interiors))}")

# 访问外环和内环
print(f"  外环: {polygon_with_hole.exterior}")
for i, hole in enumerate(polygon_with_hole.interiors):
    print(f"  内环{i}: {hole}")
```

**应用场景**：行政区划、建筑物轮廓、用地范围、水域边界等。

### 5.3.5 MultiPoint（多点）

多点是点的集合：

```python
from shapely.geometry import MultiPoint, Point

# 创建多点
mpoint = MultiPoint([(0, 0), (1, 1), (2, 2)])
print(f"类型: {mpoint.geom_type}")
print(f"点数: {len(mpoint.geoms)}")
print(f"边界框: {mpoint.bounds}")

# 访问单个点
for i, point in enumerate(mpoint.geoms):
    print(f"  点{i}: ({point.x}, {point.y})")

# 从 Point 对象创建
mpoint2 = MultiPoint([Point(0, 0), Point(1, 1)])
```

### 5.3.6 MultiLineString（多线）

```python
from shapely.geometry import MultiLineString

mline = MultiLineString([
    [(0, 0), (1, 1), (2, 0)],
    [(3, 0), (4, 1), (5, 0)]
])
print(f"类型: {mline.geom_type}")
print(f"线数: {len(mline.geoms)}")
print(f"总长度: {mline.length:.4f}")

# 访问单条线
for i, line in enumerate(mline.geoms):
    print(f"  线{i}: 长度={line.length:.4f}, 顶点数={len(line.coords)}")
```

**应用场景**：由多段组成的道路、断开的河流等。

### 5.3.7 MultiPolygon（多面）

```python
from shapely.geometry import MultiPolygon, Polygon

mpoly = MultiPolygon([
    Polygon([(0, 0), (2, 0), (2, 2), (0, 2)]),
    Polygon([(3, 3), (5, 3), (5, 5), (3, 5)])
])
print(f"类型: {mpoly.geom_type}")
print(f"多边形数: {len(mpoly.geoms)}")
print(f"总面积: {mpoly.area}")

# 访问单个多边形
for i, poly in enumerate(mpoly.geoms):
    print(f"  多边形{i}: 面积={poly.area}")
```

**应用场景**：由多个不相连部分组成的国家（如印度尼西亚）、群岛等。

### 5.3.8 GeometryCollection（几何集合）

几何集合可以包含不同类型的几何对象：

```python
from shapely.geometry import GeometryCollection, Point, LineString, Polygon

gc = GeometryCollection([
    Point(0, 0),
    LineString([(1, 1), (2, 2)]),
    Polygon([(3, 3), (5, 3), (5, 5), (3, 5)])
])
print(f"类型: {gc.geom_type}")
print(f"子几何数: {len(gc.geoms)}")

for i, geom in enumerate(gc.geoms):
    print(f"  子几何{i}: {geom.geom_type} - {geom}")
```

> ⚠️ **注意**：GeometryCollection 在实际分析中较少使用，大多数空间操作不支持混合几何类型。

### 5.3.9 几何类型总结

| 类型 | 维度 | 描述 | 面积 | 长度 |
|------|------|------|------|------|
| Point | 0D | 单个点 | 0 | 0 |
| MultiPoint | 0D | 点集合 | 0 | 0 |
| LineString | 1D | 单条线 | 0 | > 0 |
| LinearRing | 1D | 闭合线 | 0 | > 0 |
| MultiLineString | 1D | 线集合 | 0 | > 0 |
| Polygon | 2D | 单个面 | > 0 | > 0 |
| MultiPolygon | 2D | 面集合 | > 0 | > 0 |
| GeometryCollection | 混合 | 任意集合 | ≥ 0 | ≥ 0 |

---

## 5.4 几何属性访问

GeoSeries 提供了一系列属性来获取几何对象的信息。

### 5.4.1 geom_type - 几何类型

```python
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon

gs = gpd.GeoSeries([
    Point(0, 0),
    LineString([(0, 0), (1, 1)]),
    Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
])

# 获取几何类型
print("几何类型:")
print(gs.geom_type)
# 0        Point
# 1    LineString
# 2      Polygon
# dtype: object

# 统计类型分布
print("\n类型分布:")
print(gs.geom_type.value_counts())
```

### 5.4.2 is_empty - 是否为空

```python
from shapely import wkt

gs = gpd.GeoSeries([
    Point(0, 0),
    wkt.loads('POINT EMPTY'),  # 空点
    None                        # 缺失值（不同于空几何）
])

print("is_empty:", gs.is_empty.tolist())
# [False, True, False]  — None 不被视为空几何

print("isna:", gs.isna().tolist())
# [False, False, True]  — None 是缺失值
```

> ⚠️ **区分空几何和缺失值**：
> - **空几何** (`POINT EMPTY`)：一个有效的几何对象，但不包含坐标。`is_empty` 为 True。
> - **缺失值** (`None`/`NaN`)：没有几何对象。`isna()` 为 True。

### 5.4.3 is_valid - 是否有效

```python
from shapely.geometry import Polygon

# 有效多边形
valid_poly = Polygon([(0, 0), (2, 0), (2, 2), (0, 2)])

# 无效多边形（自相交的蝴蝶结形状）
invalid_poly = Polygon([(0, 0), (2, 2), (2, 0), (0, 2)])

gs = gpd.GeoSeries([valid_poly, invalid_poly])

print("is_valid:", gs.is_valid.tolist())
# [True, False]

# 修复无效几何
fixed = gs.make_valid()
print("\n修复后 is_valid:", fixed.is_valid.tolist())
# [True, True]
```

### 5.4.4 is_simple - 是否简单

简单几何不包含自相交：

```python
from shapely.geometry import LineString

# 简单线（不自相交）
simple_line = LineString([(0, 0), (1, 1), (2, 0)])

# 非简单线（自相交）
complex_line = LineString([(0, 0), (2, 2), (2, 0), (0, 2)])

gs = gpd.GeoSeries([simple_line, complex_line])
print("is_simple:", gs.is_simple.tolist())
# [True, False]
```

### 5.4.5 is_ring 和 is_closed

```python
from shapely.geometry import LineString, LinearRing

open_line = LineString([(0, 0), (1, 1), (2, 0)])
closed_line = LineString([(0, 0), (1, 1), (2, 0), (0, 0)])
ring = LinearRing([(0, 0), (1, 1), (2, 0)])

gs = gpd.GeoSeries([open_line, closed_line, ring])

# is_closed: 首尾坐标是否相同
# 注意: is_closed 是 Shapely 属性，需要通过 apply 访问或直接使用
print("坐标闭合检查:")
for i, geom in enumerate(gs):
    first = geom.coords[0]
    last = geom.coords[-1]
    print(f"  几何{i}: 首={first}, 尾={last}, 闭合={first == last}")
```

### 5.4.6 has_z 和 has_m

```python
from shapely.geometry import Point

gs = gpd.GeoSeries([
    Point(0, 0),       # 2D
    Point(0, 0, 10),   # 3D (含 Z)
])

print("has_z:", gs.has_z.tolist())
# [False, True]
```

---

## 5.5 几何度量属性

### 5.5.1 area - 面积

```python
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon

gs = gpd.GeoSeries([
    Point(0, 0),
    LineString([(0, 0), (1, 1)]),
    Polygon([(0, 0), (3, 0), (3, 4), (0, 4)])
])

print("面积:")
print(gs.area)
# 0     0.0    ← 点没有面积
# 1     0.0    ← 线没有面积
# 2    12.0    ← 3 × 4 = 12
```

> ⚠️ **重要**：面积的单位取决于 CRS。如果 CRS 是地理坐标系（如 EPSG:4326），面积单位是"平方度"，没有实际意义。需要先转换为投影坐标系再计算面积。

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 错误：直接在地理坐标系下计算面积（单位是平方度）
area_wrong = world.area
print("EPSG:4326 下的面积（无意义）:")
print(area_wrong.head())

# 正确：先转为等面积投影再计算
world_proj = world.to_crs('+proj=aea +lat_1=20 +lat_2=60 +lon_0=0')
area_correct = world_proj.area / 1e6  # 转换为平方公里
print("\n等面积投影下的面积（平方公里）:")
print(area_correct.head())
```

### 5.5.2 length - 长度

```python
from shapely.geometry import LineString, Polygon

gs = gpd.GeoSeries([
    LineString([(0, 0), (3, 4)]),           # 长度 = 5 (3-4-5 直角三角形)
    Polygon([(0, 0), (3, 0), (3, 4), (0, 4)])  # 周长 = 14
])

print("长度/周长:")
print(gs.length)
# 0     5.0
# 1    14.0
```

> 📝 **说明**：对于 Polygon，`length` 返回的是周长（外环长度 + 内环长度之和）。

### 5.5.3 bounds - 边界框

```python
import geopandas as gpd
from shapely.geometry import Point, Polygon

gs = gpd.GeoSeries([
    Point(116.40, 39.90),
    Polygon([(113, 22), (114, 22), (114, 24), (113, 24)])
])

# 每个几何对象的边界框
print("单个边界框:")
print(gs.bounds)
#     minx   miny    maxx   maxy
# 0  116.4  39.90  116.40  39.90
# 1  113.0  22.00  114.00  24.00
```

### 5.5.4 total_bounds - 总边界框

```python
# 所有几何对象的总边界框
print("总边界框:")
print(gs.total_bounds)
# [113.   22.   116.4  39.9]

minx, miny, maxx, maxy = gs.total_bounds
print(f"经度范围: [{minx}, {maxx}]")
print(f"纬度范围: [{miny}, {maxy}]")
```

---

## 5.6 几何构造方法

GeoSeries 提供了多种方法来从现有几何构造新的几何。

### 5.6.1 boundary - 边界

```python
import geopandas as gpd
from shapely.geometry import Polygon, LineString

gs = gpd.GeoSeries([
    Polygon([(0, 0), (2, 0), (2, 2), (0, 2)]),
    LineString([(0, 0), (1, 1), (2, 0)])
])

boundaries = gs.boundary
print("边界:")
print(boundaries)
# 0    LINEARRING (0 0, 2 0, 2 2, 0 2, 0 0)    ← 多边形的边界是线环
# 1    MULTIPOINT (0 0, 2 0)                     ← 线的边界是端点

print("\n边界类型:", boundaries.geom_type.tolist())
```

### 5.6.2 centroid - 质心

```python
import geopandas as gpd
from shapely.geometry import Polygon

gs = gpd.GeoSeries([
    Polygon([(0, 0), (4, 0), (4, 2), (0, 2)]),
    Polygon([(0, 0), (3, 0), (3, 3), (0, 3)])
])

centroids = gs.centroid
print("质心:")
print(centroids)
# 0    POINT (2 1)
# 1    POINT (1.5 1.5)

# 注意：质心可能在几何外部（如 C 形多边形）
# 使用 representative_point() 确保点在几何内部
```

### 5.6.3 envelope - 最小外接矩形（轴对齐）

```python
from shapely.geometry import LineString

gs = gpd.GeoSeries([
    LineString([(0, 0), (1, 2), (3, 1)])
])

print("包络框:")
print(gs.envelope)
# 0    POLYGON ((0 0, 3 0, 3 2, 0 2, 0 0))
```

### 5.6.4 convex_hull - 凸包

```python
from shapely.geometry import MultiPoint

gs = gpd.GeoSeries([
    MultiPoint([(0, 0), (1, 0), (0.5, 1), (1, 1), (0, 1)])
])

print("凸包:")
print(gs.convex_hull)
# POLYGON ((0 0, 0 1, 1 1, 1 0, 0 0))
```

### 5.6.5 exterior 和 interiors

```python
from shapely.geometry import Polygon

# 带洞的多边形
poly = Polygon(
    shell=[(0, 0), (10, 0), (10, 10), (0, 10)],
    holes=[[(2, 2), (4, 2), (4, 4), (2, 4)],
           [(6, 6), (8, 6), (8, 8), (6, 8)]]
)

gs = gpd.GeoSeries([poly])

# 外环
print("外环:")
print(gs.exterior)

# 内环（需要通过 apply 访问）
print("\n内环数量:")
print(gs.apply(lambda g: len(list(g.interiors))))

# 获取所有内环
for i, geom in enumerate(gs):
    for j, interior in enumerate(geom.interiors):
        print(f"  几何{i}, 内环{j}: {interior}")
```

### 5.6.6 representative_point() - 代表点

代表点保证在几何内部（不同于质心，质心可能在几何外部）：

```python
from shapely.geometry import Polygon

# C 形多边形（质心在外部）
c_shape = Polygon([
    (0, 0), (3, 0), (3, 1), (1, 1),
    (1, 2), (3, 2), (3, 3), (0, 3)
])

gs = gpd.GeoSeries([c_shape])

centroid = gs.centroid
rep_point = gs.representative_point()

print("质心:", centroid.iloc[0])
print("质心在几何内:", gs.contains(centroid).iloc[0])

print("\n代表点:", rep_point.iloc[0])
print("代表点在几何内:", gs.contains(rep_point).iloc[0])  # 始终为 True
```

### 5.6.7 构造方法总结

| 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `boundary` | 任意几何 | 边界几何 | Polygon→LinearRing, Line→MultiPoint |
| `centroid` | 任意几何 | Point | 几何质心（可能在外部） |
| `representative_point()` | 任意几何 | Point | 保证在几何内部 |
| `envelope` | 任意几何 | Polygon/Point | 轴对齐最小外接矩形 |
| `convex_hull` | 任意几何 | Polygon/Line/Point | 凸包 |
| `exterior` | Polygon | LinearRing | 外环 |
| `interiors` | Polygon | 内环列表 | 内环（洞） |
| `unary_union` | GeoSeries | 单个几何 | 所有几何的并集 |

---

## 5.7 序列化与反序列化

### 5.7.1 to_wkt() - 导出为 WKT

```python
import geopandas as gpd
from shapely.geometry import Point, Polygon

gs = gpd.GeoSeries([
    Point(116.40, 39.90),
    Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
])

# 导出为 WKT
wkt_series = gs.to_wkt()
print("WKT 输出:")
print(wkt_series)

# 自定义精度
wkt_series_rnd = gs.to_wkt(rounding_precision=2)
print("\n精度为2的 WKT:")
print(wkt_series_rnd)
```

### 5.7.2 to_wkb() - 导出为 WKB

```python
# 导出为 WKB（二进制）
wkb_series = gs.to_wkb()
print("WKB 输出 (十六进制前20字符):")
for i, wkb in enumerate(wkb_series):
    print(f"  几何{i}: {wkb.hex()[:40]}...")

# 导出为十六进制 WKB
wkb_hex = gs.to_wkb(hex=True)
print("\nWKB Hex:")
print(wkb_hex)
```

### 5.7.3 from_wkt() 和 from_wkb() - 反序列化

```python
# WKT 往返
gs_original = gpd.GeoSeries([Point(1.5, 2.5), Point(3.0, 4.0)])
wkt_data = gs_original.to_wkt()
gs_restored = gpd.GeoSeries.from_wkt(wkt_data, crs="EPSG:4326")
print("WKT 往返验证:", gs_original.equals(gs_restored))

# WKB 往返
wkb_data = gs_original.to_wkb()
gs_restored2 = gpd.GeoSeries.from_wkb(wkb_data, crs="EPSG:4326")
print("WKB 往返验证:", gs_original.equals(gs_restored2))
```

### 5.7.4 序列化格式对比

| 格式 | 可读性 | 大小 | 精度 | 速度 | 适用场景 |
|------|--------|------|------|------|----------|
| WKT | ✅ 高 | 大 | 可控 | 慢 | 调试、日志、文本存储 |
| WKB | ❌ 低 | 小 | 完整 | 快 | 数据库存储、网络传输 |
| WKB Hex | 中 | 中 | 完整 | 中 | 数据库文本字段 |
| GeoJSON | ✅ 高 | 大 | 可控 | 中 | Web API、前端交互 |

---

## 5.8 GeoSeries 的向量化操作

### 5.8.1 什么是向量化操作

向量化操作是指对整个 GeoSeries 进行批量处理，而不是逐个元素循环。GeoPandas 1.x 基于 Shapely 2.0，充分利用了其向量化能力。

```python
import geopandas as gpd
from shapely.geometry import Point
import numpy as np
import time

# 创建大量点
n = 100000
gs = gpd.GeoSeries(gpd.points_from_xy(np.random.rand(n), np.random.rand(n)))

# ❌ 非向量化（慢）
start = time.time()
result_slow = gs.apply(lambda g: g.buffer(0.01))
time_slow = time.time() - start

# ✅ 向量化（快）
start = time.time()
result_fast = gs.buffer(0.01)
time_fast = time.time() - start

print(f"数据量: {n}")
print(f"apply 方式: {time_slow:.3f} 秒")
print(f"向量化方式: {time_fast:.3f} 秒")
print(f"加速比: {time_slow/time_fast:.1f}x")
```

### 5.8.2 常用向量化操作示例

```python
import geopandas as gpd
from shapely.geometry import Point, Polygon
import numpy as np

# 创建测试数据
gs1 = gpd.GeoSeries([
    Polygon([(0,0), (2,0), (2,2), (0,2)]),
    Polygon([(1,1), (3,1), (3,3), (1,3)]),
    Polygon([(4,4), (6,4), (6,6), (4,6)])
])

gs2 = gpd.GeoSeries([
    Point(1, 1),
    Point(2, 2),
    Point(5, 5)
])

# 1. 批量缓冲区
buffered = gs1.buffer(0.5)
print("批量缓冲区:", buffered.area.tolist())

# 2. 批量面积计算
areas = gs1.area
print("批量面积:", areas.tolist())

# 3. 批量质心
centroids = gs1.centroid
print("批量质心:", centroids.tolist())

# 4. 批量距离计算（逐对应元素）
distances = gs1.distance(gs2)
print("逐对距离:", distances.tolist())

# 5. 批量空间关系
contains = gs1.contains(gs2)
print("包含关系:", contains.tolist())

# 6. 批量交集
intersection = gs1.intersection(gs1.shift())  # 与偏移后的自身求交
print("交集:", intersection.tolist())
```

### 5.8.3 广播机制

GeoSeries 的空间操作支持广播，即一个 GeoSeries 与一个单独的几何对象操作：

```python
import geopandas as gpd
from shapely.geometry import Point, Polygon

gs = gpd.GeoSeries([
    Polygon([(0,0), (2,0), (2,2), (0,2)]),
    Polygon([(1,1), (3,1), (3,3), (1,3)]),
    Polygon([(4,4), (6,4), (6,6), (4,6)])
])

# 单个几何 vs GeoSeries（广播）
target_point = Point(1, 1)

# 距离（GeoSeries 中每个元素到 target_point 的距离）
distances = gs.distance(target_point)
print("到 (1,1) 的距离:", distances.tolist())

# 包含关系
contains = gs.contains(target_point)
print("是否包含 (1,1):", contains.tolist())

# 交集
intersection = gs.intersection(Polygon([(0,0), (2,0), (2,2), (0,2)]))
print("与矩形的交集面积:", intersection.area.tolist())
```

### 5.8.4 向量化 vs 循环性能对比

| 操作 | 向量化 | apply/循环 | 加速比 |
|------|--------|-----------|--------|
| buffer | `gs.buffer(100)` | `gs.apply(lambda g: g.buffer(100))` | 5-20x |
| centroid | `gs.centroid` | `gs.apply(lambda g: g.centroid)` | 10-50x |
| area | `gs.area` | `gs.apply(lambda g: g.area)` | 10-100x |
| distance | `gs.distance(other)` | `gs.apply(lambda g: g.distance(other))` | 5-30x |
| intersects | `gs.intersects(other)` | `gs.apply(lambda g: g.intersects(other))` | 10-50x |
| to_wkt | `gs.to_wkt()` | `gs.apply(lambda g: g.wkt)` | 3-10x |

---

## 5.9 GeoSeries 与 GeometryArray 的关系

### 5.9.1 底层存储

GeoSeries 的底层数据存储在 GeometryArray 中：

```python
import geopandas as gpd
from shapely.geometry import Point

gs = gpd.GeoSeries([Point(0, 0), Point(1, 1), Point(2, 2)])

# 获取底层 GeometryArray
ga = gs.values
print("类型:", type(ga))
# <class 'geopandas.array.GeometryArray'>

# GeometryArray 的属性
print("长度:", len(ga))
print("dtype:", ga.dtype)
print("nbytes:", ga.nbytes)

# 访问单个元素
print("第一个元素:", ga[0])
print("元素类型:", type(ga[0]))
```

### 5.9.2 GeometryArray 的内部结构

```python
# GeometryArray 内部使用 numpy 对象数组
import numpy as np

ga = gs.values
print("底层数据类型:", type(ga._data))
print("numpy dtype:", ga._data.dtype)  # object
print("包含:", [type(x).__name__ for x in ga._data])
```

### 5.9.3 直接操作 GeometryArray

通常不需要直接操作 GeometryArray，但在需要高性能时可以：

```python
# 通过 Shapely 直接操作（绕过 GeoSeries 开销）
import shapely

points = gs.values._data  # 获取 numpy 数组
buffered = shapely.buffer(points, 0.5)  # Shapely 2.0 向量化
result_gs = gpd.GeoSeries(buffered, crs=gs.crs)
```

---

## 5.10 常用操作示例

### 5.10.1 场景1：计算最近设施距离

```python
import geopandas as gpd
from shapely.geometry import Point
import numpy as np

# 居民点
residents = gpd.GeoDataFrame({
    '编号': [f'R{i}' for i in range(5)],
    'geometry': [
        Point(0, 0), Point(1, 2), Point(3, 1),
        Point(2, 3), Point(4, 4)
    ]
})

# 医院
hospitals = gpd.GeoDataFrame({
    '名称': ['医院A', '医院B'],
    'geometry': [Point(1, 1), Point(3, 3)]
})

# 计算每个居民点到最近医院的距离
def nearest_distance(point, targets):
    return targets.distance(point).min()

residents['最近医院距离'] = residents.geometry.apply(
    lambda p: nearest_distance(p, hospitals.geometry)
)

# 找到最近的医院名称
def nearest_name(point, targets, names):
    idx = targets.distance(point).idxmin()
    return names.iloc[idx]

residents['最近医院'] = residents.geometry.apply(
    lambda p: nearest_name(p, hospitals.geometry, hospitals['名称'])
)

print(residents[['编号', '最近医院距离', '最近医院']])
```

### 5.10.2 场景2：几何简化

```python
import geopandas as gpd

world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))

# 原始顶点数
original_vertices = world.geometry.apply(
    lambda g: sum(len(part.exterior.coords) for part in (g.geoms if hasattr(g, 'geoms') else [g]))
).sum()

# 简化
world_simplified = world.copy()
world_simplified['geometry'] = world.simplify(tolerance=1.0)

simplified_vertices = world_simplified.geometry.apply(
    lambda g: sum(len(part.exterior.coords) for part in (g.geoms if hasattr(g, 'geoms') else [g]))
).sum()

print(f"原始顶点数: {original_vertices}")
print(f"简化后顶点数: {simplified_vertices}")
print(f"减少比例: {(1 - simplified_vertices/original_vertices)*100:.1f}%")
```

### 5.10.3 场景3：创建 Voronoi 图

```python
import geopandas as gpd
from shapely.geometry import MultiPoint, Point
from shapely.ops import voronoi_diagram
import numpy as np

# 创建随机点
np.random.seed(42)
n = 20
points = gpd.GeoSeries([Point(x, y) for x, y in zip(np.random.rand(n)*10, np.random.rand(n)*10)])

# 创建 Voronoi 图
multi_point = MultiPoint(points.tolist())
voronoi = voronoi_diagram(multi_point)

# 转为 GeoSeries
voronoi_gs = gpd.GeoSeries([geom for geom in voronoi.geoms])
print(f"Voronoi 多边形数量: {len(voronoi_gs)}")
print(f"类型: {voronoi_gs.geom_type.value_counts().to_dict()}")
```

### 5.10.4 场景4：批量坐标提取

```python
import geopandas as gpd
from shapely.geometry import Point

gs = gpd.GeoSeries([
    Point(116.40, 39.90),
    Point(121.47, 31.23),
    Point(113.26, 23.13)
])

# 提取 x, y 坐标
x_coords = gs.x
y_coords = gs.y

print("经度:", x_coords.tolist())
print("纬度:", y_coords.tolist())

# 组合成 DataFrame
import pandas as pd
coords_df = pd.DataFrame({
    '经度': gs.x,
    '纬度': gs.y
})
print("\n坐标表:")
print(coords_df)
```

### 5.10.5 场景5：几何变换

```python
import geopandas as gpd
from shapely.geometry import Polygon

gs = gpd.GeoSeries([
    Polygon([(0, 0), (2, 0), (2, 1), (0, 1)])
])

# 平移
translated = gs.translate(xoff=5, yoff=3)
print("平移后:", translated.iloc[0])

# 旋转（绕质心旋转45度）
rotated = gs.rotate(45, origin='centroid')
print("旋转后:", rotated.iloc[0])

# 缩放
scaled = gs.scale(xfact=2, yfact=3, origin='centroid')
print("缩放后:", scaled.iloc[0])

# 仿射变换
# [a, b, d, e, xoff, yoff]
affine = gs.affine_transform([2, 0, 0, 2, 10, 20])
print("仿射变换后:", affine.iloc[0])
```

---

## 5.11 本章小结

本章全面介绍了 GeoSeries 和几何对象的使用：

| 主题 | 要点 |
|------|------|
| GeoSeries 概述 | 继承 pandas Series，存储 Shapely 几何对象 |
| 创建方式 | Shapely 列表、from_wkt()、from_wkb()、from_xy() |
| 几何类型 | Point、LineString、Polygon 及其 Multi 版本、GeometryCollection |
| 几何属性 | geom_type、is_empty、is_valid、is_simple、has_z |
| 度量属性 | area、length、bounds、total_bounds |
| 构造方法 | boundary、centroid、envelope、convex_hull、representative_point |
| 序列化 | to_wkt()、to_wkb()；反序列化 from_wkt()、from_wkb() |
| 向量化操作 | 批量处理性能远优于循环，优先使用 |
| GeometryArray | GeoSeries 的底层存储，基于 numpy 对象数组 |

**核心原则**：

1. **优先使用向量化操作**，性能提升 5-100 倍
2. **注意 CRS**：面积和距离计算需要投影坐标系
3. **区分空几何和缺失值**：`is_empty` vs `isna()`
4. **使用 `make_valid()` 修复无效几何**
5. **`representative_point()` 比 `centroid` 更安全**（保证在几何内部）

**关键速查表**：

```python
# 常用操作速查
gs.area                    # 面积
gs.length                  # 长度/周长
gs.centroid                # 质心
gs.boundary                # 边界
gs.buffer(distance)        # 缓冲区
gs.simplify(tolerance)     # 简化
gs.envelope                # 外接矩形
gs.convex_hull             # 凸包
gs.representative_point()  # 代表点
gs.make_valid()            # 修复无效几何
gs.to_crs(epsg=3857)       # 投影转换
gs.distance(other)         # 距离
gs.intersects(other)       # 相交判断
gs.contains(other)         # 包含判断
gs.within(other)           # 在内部判断
gs.intersection(other)     # 交集
gs.union(other)            # 并集
gs.difference(other)       # 差集
gs.to_wkt()                # 导出 WKT
gs.to_wkb()                # 导出 WKB
gs.x, gs.y                 # 点坐标提取
gs.translate(xoff, yoff)   # 平移
gs.rotate(angle)           # 旋转
gs.scale(xfact, yfact)     # 缩放
```

---

> 📚 **参考资料**
> - [GeoPandas GeoSeries 文档](https://geopandas.org/en/stable/docs/reference/geoseries.html)
> - [Shapely 几何对象文档](https://shapely.readthedocs.io/en/stable/geometry.html)
> - [OGC Simple Features 规范](https://www.ogc.org/standard/sfa/)
> - [Shapely 2.0 迁移指南](https://shapely.readthedocs.io/en/stable/migration.html)

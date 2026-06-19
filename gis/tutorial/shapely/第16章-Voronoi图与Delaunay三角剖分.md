---
layout: default
title: "第16章：Voronoi 图与 Delaunay 三角剖分"
---

# 第16章：Voronoi 图与 Delaunay 三角剖分

> 本章深入讲解 Shapely 中 Voronoi 图和 Delaunay 三角剖分的生成与应用。这两种计算几何工具在空间分析、地形建模、影响范围划分等领域有着广泛的应用。

---

## 16.1 计算几何基础

### 16.1.1 Delaunay 三角剖分

Delaunay 三角剖分是一种将平面点集连接成三角网的方法，其核心性质是：任何三角形的外接圆内部不包含点集中的其他点（空圆性质）。这使得 Delaunay 三角剖分具有以下优点：

- **最大化最小角**：避免产生过于狭长的三角形
- **唯一性**：对于一般位置的点集，Delaunay 三角剖分是唯一的
- **局部性**：适合增量构建和动态更新

### 16.1.2 Voronoi 图

Voronoi 图（也称泰森多边形、Dirichlet 曲面细分）是 Delaunay 三角剖分的对偶图。对于平面上的一组点（称为生成点），Voronoi 图将平面划分为若干区域，每个区域内的点到对应生成点的距离比到其他任何生成点的距离都近。

```
Delaunay 三角剖分与 Voronoi 图的对偶关系：
- Delaunay 三角形的外接圆圆心 → Voronoi 顶点
- Delaunay 边 → 对应 Voronoi 边（垂直平分线段）
- Delaunay 顶点 → Voronoi 区域
```

### 16.1.3 在 GIS 中的应用

| 应用场景 | 使用方法 | 说明 |
|---------|---------|------|
| 气象站影响范围 | Voronoi 图 | 泰森多边形法估算区域降水量 |
| 地形建模 | Delaunay 三角剖分 | 构建不规则三角网（TIN） |
| 服务区划分 | Voronoi 图 | 划分最近服务设施的区域 |
| 有限元分析 | 约束 Delaunay | 生成计算网格 |
| 最近邻分析 | Voronoi 图 | 自然邻域插值 |

---

## 16.2 Delaunay 三角剖分

### 16.2.1 基本用法

使用 `shapely.delaunay_triangles()` 函数（或 `shapely.ops.triangulate()`）从点集生成三角剖分：

```python
from shapely import delaunay_triangles, MultiPoint

# 创建点集
points = MultiPoint([(0, 0), (1, 0), (0.5, 1), (2, 0.5), (1.5, 1.5)])

# 生成 Delaunay 三角剖分
triangles = delaunay_triangles(points)
print(triangles)
# GEOMETRYCOLLECTION (POLYGON ((0 0, 0.5 1, 1 0, 0 0)), ...)

# 遍历三角形
for tri in triangles.geoms:
    print(f"三角形: {tri}")
    print(f"  面积: {tri.area:.4f}")
    print(f"  顶点数: {len(tri.exterior.coords)}")
```

### 16.2.2 tolerance 参数

`tolerance` 参数用于合并距离小于指定容差的点：

```python
from shapely import delaunay_triangles, MultiPoint

# 包含近邻点的点集
points = MultiPoint([
    (0, 0), (1, 0), (0.5, 1),
    (0.001, 0.001),  # 非常接近 (0, 0)
    (2, 0.5)
])

# 不使用容差 - 可能产生极小三角形
tri1 = delaunay_triangles(points, tolerance=0)
print(f"无容差: {len(tri1.geoms)} 个三角形")

# 使用容差 - 合并近邻点
tri2 = delaunay_triangles(points, tolerance=0.01)
print(f"有容差: {len(tri2.geoms)} 个三角形")
```

### 16.2.3 only_edges 参数

设置 `only_edges=True` 时只返回三角剖分的边，而非完整三角形：

```python
from shapely import delaunay_triangles, MultiPoint

points = MultiPoint([(0, 0), (1, 0), (0.5, 1), (2, 0.5)])

# 只返回边
edges = delaunay_triangles(points, only_edges=True)
print(edges)
# MULTILINESTRING ((0 0, 0.5 1), (0 0, 1 0), ...)

for edge in edges.geoms:
    print(f"边: {edge}, 长度: {edge.length:.4f}")
```

### 16.2.4 使用 shapely.ops.triangulate

`shapely.ops.triangulate()` 是 Delaunay 三角剖分的便捷包装函数：

```python
from shapely.ops import triangulate
from shapely import MultiPoint

points = MultiPoint([(0, 0), (5, 0), (5, 5), (0, 5), (2.5, 2.5)])

# triangulate 返回三角形列表（非 GeometryCollection）
triangles = triangulate(points)
print(f"生成 {len(triangles)} 个三角形")

for i, tri in enumerate(triangles):
    print(f"三角形 {i+1}: 面积={tri.area:.2f}")

# 只获取边
edges = triangulate(points, edges=True)
print(f"生成 {len(edges)} 条边")
```

---

## 16.3 约束 Delaunay 三角剖分

### 16.3.1 概念

约束 Delaunay 三角剖分（Constrained Delaunay Triangulation, CDT）允许指定某些边作为约束条件，这些边必须出现在最终的三角剖分中。这在以下场景中非常有用：

- 保留多边形边界
- 保留断裂线（如河流、道路）
- 生成符合边界约束的网格

### 16.3.2 使用 constrained_delaunay_triangles

```python
from shapely import constrained_delaunay_triangles, Polygon

# 对多边形进行约束三角剖分
polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)],
                  [[(2, 2), (8, 2), (8, 8), (2, 8)]])  # 带孔洞

triangles = constrained_delaunay_triangles(polygon)
print(f"三角形数量: {len(triangles.geoms)}")

for tri in triangles.geoms:
    print(f"  面积: {tri.area:.2f}")
```

### 16.3.3 与普通 Delaunay 的对比

```python
from shapely import delaunay_triangles, constrained_delaunay_triangles
from shapely import Polygon, MultiPoint

# L 形多边形
polygon = Polygon([(0, 0), (10, 0), (10, 5), (5, 5), (5, 10), (0, 10)])

# 普通 Delaunay（基于顶点，可能超出多边形边界）
points = MultiPoint(list(polygon.exterior.coords))
dt = delaunay_triangles(points)
print(f"普通 Delaunay: {len(dt.geoms)} 个三角形")

# 约束 Delaunay（保持在多边形内部）
cdt = constrained_delaunay_triangles(polygon)
print(f"约束 Delaunay: {len(cdt.geoms)} 个三角形")

# 验证约束三角形都在多边形内
for tri in cdt.geoms:
    assert polygon.contains(tri) or polygon.touches(tri)
print("所有约束三角形都在多边形内部")
```

---

## 16.4 Voronoi 图

### 16.4.1 基本用法

使用 `shapely.voronoi_polygons()` 生成 Voronoi 图：

```python
from shapely import voronoi_polygons, MultiPoint

# 创建生成点
points = MultiPoint([(0, 0), (2, 0), (1, 2), (3, 1)])

# 生成 Voronoi 多边形
voronoi = voronoi_polygons(points)
print(voronoi)

# 遍历 Voronoi 区域
for i, cell in enumerate(voronoi.geoms):
    print(f"区域 {i+1}:")
    print(f"  类型: {cell.geom_type}")
    print(f"  面积: {cell.area:.4f}")
    print(f"  顶点数: {len(cell.exterior.coords)}")
```

### 16.4.2 extend_to 参数

`extend_to` 参数指定 Voronoi 图的扩展范围：

```python
from shapely import voronoi_polygons, MultiPoint, box

points = MultiPoint([(1, 1), (3, 1), (2, 3)])

# 不指定扩展范围（默认扩展到输入范围的外接矩形）
v1 = voronoi_polygons(points)
print(f"默认范围 - 区域数: {len(v1.geoms)}")

# 指定扩展范围
envelope = box(0, 0, 4, 4)
v2 = voronoi_polygons(points, extend_to=envelope)
print(f"指定范围 - 区域数: {len(v2.geoms)}")

# 裁剪到指定范围
for cell in v2.geoms:
    clipped = cell.intersection(envelope)
    print(f"  裁剪后面积: {clipped.area:.4f}")
```

### 16.4.3 only_edges 参数

```python
from shapely import voronoi_polygons, MultiPoint

points = MultiPoint([(0, 0), (2, 0), (1, 2), (3, 1)])

# 只返回 Voronoi 边
edges = voronoi_polygons(points, only_edges=True)
print(f"Voronoi 边数: {len(edges.geoms)}")

for edge in edges.geoms:
    print(f"  边: 长度={edge.length:.4f}")
```

### 16.4.4 使用 shapely.ops.voronoi_diagram

```python
from shapely.ops import voronoi_diagram
from shapely import MultiPoint, box

points = MultiPoint([(0, 0), (1, 0), (0.5, 1), (2, 0.5)])

# 使用 voronoi_diagram（返回 GeometryCollection）
envelope = box(-1, -1, 3, 2)
diagram = voronoi_diagram(points, envelope=envelope)
print(f"区域数: {len(diagram.geoms)}")

# 只获取边
edges_diagram = voronoi_diagram(points, edges=True)
print(f"边数: {len(edges_diagram.geoms)}")
```

---

## 16.5 实际应用案例

### 16.5.1 泰森多边形法计算区域降水量

```python
from shapely import MultiPoint, voronoi_polygons, Polygon

# 气象站位置和降水量数据
stations = MultiPoint([
    (116.46, 39.92),  # 北京
    (121.47, 31.23),  # 上海
    (113.26, 23.13),  # 广州
    (104.07, 30.67),  # 成都
    (114.31, 30.52),  # 武汉
])
rainfall = [45.2, 62.1, 88.3, 51.7, 73.4]  # mm

# 研究区域边界
study_area = Polygon([
    (100, 20), (125, 20), (125, 42), (100, 42)
])

# 生成 Voronoi 图
voronoi = voronoi_polygons(stations, extend_to=study_area)

# 计算面积加权平均降水量
total_area = 0
weighted_sum = 0

for i, cell in enumerate(voronoi.geoms):
    # 裁剪到研究区域
    clipped = cell.intersection(study_area)
    area = clipped.area
    total_area += area
    weighted_sum += area * rainfall[i]
    print(f"站点 {i+1}: 面积={area:.2f}, 降水={rainfall[i]} mm")

avg_rainfall = weighted_sum / total_area
print(f"\n区域面积加权平均降水量: {avg_rainfall:.2f} mm")
```

### 16.5.2 地形三角网（TIN）构建

```python
from shapely import delaunay_triangles, MultiPoint
import json

# 高程点数据 (x, y, z)
elevation_points = [
    (0, 0, 100), (10, 0, 120), (20, 0, 110),
    (0, 10, 130), (10, 10, 150), (20, 10, 140),
    (0, 20, 115), (10, 20, 135), (20, 20, 125),
    (5, 5, 140), (15, 5, 130), (5, 15, 145),
    (15, 15, 138),
]

# 提取 2D 点用于三角剖分
points_2d = MultiPoint([(x, y) for x, y, z in elevation_points])
z_values = {(x, y): z for x, y, z in elevation_points}

# 生成 Delaunay 三角剖分
triangles = delaunay_triangles(points_2d)
print(f"TIN 三角形数量: {len(triangles.geoms)}")

# 为每个三角形计算平均高程和坡度
for i, tri in enumerate(triangles.geoms):
    coords = list(tri.exterior.coords)[:-1]  # 去掉重复的最后一个点
    z_avg = sum(z_values.get((c[0], c[1]), 0) for c in coords) / 3
    print(f"三角形 {i+1}: 面积={tri.area:.2f}, 平均高程={z_avg:.1f}")
```

### 16.5.3 最近设施服务区划分

```python
from shapely import voronoi_polygons, MultiPoint, Point, Polygon

# 医院位置
hospitals = MultiPoint([
    (2, 3),   # 医院 A
    (8, 7),   # 医院 B
    (5, 1),   # 医院 C
    (1, 8),   # 医院 D
    (9, 2),   # 医院 E
])
hospital_names = ["医院A", "医院B", "医院C", "医院D", "医院E"]

# 城市范围
city_boundary = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

# 生成服务区
service_areas = voronoi_polygons(hospitals, extend_to=city_boundary)

# 分析每个医院的服务范围
for i, area in enumerate(service_areas.geoms):
    clipped = area.intersection(city_boundary)
    print(f"{hospital_names[i]}:")
    print(f"  服务区面积: {clipped.area:.2f} 平方单位")
    print(f"  占城市面积: {clipped.area / city_boundary.area * 100:.1f}%")

# 查找某个居民点最近的医院
resident = Point(6, 5)
for i, area in enumerate(service_areas.geoms):
    if area.contains(resident):
        dist = resident.distance(hospitals.geoms[i])
        print(f"\n居民点 {resident} 最近的医院是 {hospital_names[i]}")
        print(f"距离: {dist:.2f}")
        break
```

---

## 16.6 高级技巧与注意事项

### 16.6.1 大规模点集处理

```python
import numpy as np
from shapely import MultiPoint, delaunay_triangles, voronoi_polygons

# 生成大规模随机点集
np.random.seed(42)
n_points = 10000
coords = np.random.uniform(0, 100, (n_points, 2))
points = MultiPoint(coords.tolist())

# Delaunay 三角剖分
import time

start = time.time()
triangles = delaunay_triangles(points)
dt_time = time.time() - start
print(f"Delaunay ({n_points} 点): {len(triangles.geoms)} 个三角形, 耗时 {dt_time:.3f}s")

# Voronoi 图
start = time.time()
voronoi = voronoi_polygons(points)
vd_time = time.time() - start
print(f"Voronoi ({n_points} 点): {len(voronoi.geoms)} 个区域, 耗时 {vd_time:.3f}s")
```

### 16.6.2 结果裁剪与后处理

```python
from shapely import voronoi_polygons, MultiPoint, box

points = MultiPoint([(1, 1), (3, 1), (2, 3), (4, 3)])
boundary = box(0, 0, 5, 4)

# 生成 Voronoi
voronoi = voronoi_polygons(points, extend_to=boundary)

# 裁剪到边界
clipped_cells = []
for cell in voronoi.geoms:
    clipped = cell.intersection(boundary)
    if not clipped.is_empty:
        clipped_cells.append(clipped)
        print(f"裁剪后面积: {clipped.area:.4f}")

print(f"总面积: {sum(c.area for c in clipped_cells):.4f}")
print(f"边界面积: {boundary.area:.4f}")
```

### 16.6.3 共线点处理

当点集中存在共线点（多个点在同一条直线上）时，需要特别注意：

```python
from shapely import delaunay_triangles, MultiPoint

# 共线点集（所有点在一条线上）
collinear = MultiPoint([(0, 0), (1, 0), (2, 0), (3, 0)])

try:
    result = delaunay_triangles(collinear)
    print(f"结果类型: {result.geom_type}")
    if result.is_empty:
        print("共线点无法生成三角形")
except Exception as e:
    print(f"错误: {e}")

# 添加非共线点解决问题
non_collinear = MultiPoint([(0, 0), (1, 0), (2, 0), (3, 0), (1.5, 1)])
result = delaunay_triangles(non_collinear)
print(f"三角形数: {len(result.geoms)}")
```

---

## 16.7 本章小结

本章介绍了 Shapely 中 Voronoi 图和 Delaunay 三角剖分的核心功能：

| 函数 | 用途 | 返回类型 |
|-----|------|---------|
| `delaunay_triangles()` | Delaunay 三角剖分 | GeometryCollection |
| `constrained_delaunay_triangles()` | 约束三角剖分 | GeometryCollection |
| `voronoi_polygons()` | Voronoi 图 | GeometryCollection |
| `shapely.ops.triangulate()` | 三角剖分（列表） | list |
| `shapely.ops.voronoi_diagram()` | Voronoi 图（包装） | GeometryCollection |

关键要点：
- Delaunay 三角剖分和 Voronoi 图互为对偶
- 约束 Delaunay 可保持边界约束
- `tolerance` 参数可合并近邻点
- `extend_to` 参数控制 Voronoi 图的范围
- 泰森多边形法是 GIS 中最经典的应用之一

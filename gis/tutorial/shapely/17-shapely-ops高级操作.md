---
layout: default
title: "第17章：shapely.ops 高级操作"
---

# 第17章：shapely.ops 高级操作

> 本章全面讲解 `shapely.ops` 模块中的高级几何操作函数。该模块提供了一系列构建在基础几何运算之上的复合操作，包括线段合并、多边形化、几何分割、子线段提取等实用功能。

---

## 17.1 模块概述

`shapely.ops` 模块包含了一组高级几何操作函数，这些函数在基础的集合运算和构造性操作之上，提供了更复杂的几何处理能力：

```python
from shapely.ops import (
    unary_union,      # 一元并集
    linemerge,        # 线段合并
    polygonize,       # 多边形化
    polygonize_full,  # 完整多边形化
    split,            # 几何分割
    substring,        # 子线段提取
    nearest_points,   # 最近点对
    orient,           # 方向统一
    snap,             # 捕捉
    triangulate,      # Delaunay 三角剖分
    voronoi_diagram,  # Voronoi 图
)
```

---

## 17.2 unary_union — 一元并集

### 17.2.1 基本用法

`unary_union()` 将一组几何体合并为一个几何体：

```python
from shapely.ops import unary_union
from shapely import Polygon, MultiPolygon

# 创建重叠的多边形
poly1 = Polygon([(0, 0), (2, 0), (2, 2), (0, 2)])
poly2 = Polygon([(1, 1), (3, 1), (3, 3), (1, 3)])
poly3 = Polygon([(2, 0), (4, 0), (4, 2), (2, 2)])

# 合并
result = unary_union([poly1, poly2, poly3])
print(f"类型: {result.geom_type}")
print(f"面积: {result.area:.2f}")
```

### 17.2.2 与 union_all 的关系

在 Shapely 2.0+ 中，推荐使用 `shapely.union_all()`，`unary_union` 作为向后兼容保留：

```python
import shapely
from shapely.ops import unary_union
from shapely import Polygon
import numpy as np

polys = [
    Polygon([(i, 0), (i+1, 0), (i+1, 1), (i, 1)])
    for i in range(5)
]

# 旧方式
result1 = unary_union(polys)

# 新方式（推荐）
result2 = shapely.union_all(polys)

print(f"unary_union 面积: {result1.area}")
print(f"union_all 面积: {result2.area}")
print(f"结果相同: {result1.equals(result2)}")
```

### 17.2.3 级联并集策略

对于大量几何体，级联并集比逐个合并效率更高：

```python
from shapely.ops import unary_union
from shapely import Point
import time

# 创建大量缓冲区
circles = [Point(i * 0.5, 0).buffer(1) for i in range(100)]

# 方法1：unary_union（内部使用级联策略）
start = time.time()
result1 = unary_union(circles)
t1 = time.time() - start

# 方法2：逐个合并（较慢）
start = time.time()
result2 = circles[0]
for c in circles[1:]:
    result2 = result2.union(c)
t2 = time.time() - start

print(f"unary_union: {t1:.4f}s")
print(f"逐个合并: {t2:.4f}s")
print(f"加速比: {t2/t1:.1f}x")
```

---

## 17.3 linemerge — 线段合并

### 17.3.1 基本用法

`linemerge()` 将连接的线段合并为更少的线段：

```python
from shapely.ops import linemerge
from shapely import MultiLineString, LineString

# 三条首尾相连的线段
lines = MultiLineString([
    [(0, 0), (1, 1)],
    [(1, 1), (2, 0)],
    [(2, 0), (3, 1)],
])

# 合并
merged = linemerge(lines)
print(f"合并前: {len(lines.geoms)} 条线段")
print(f"合并后类型: {merged.geom_type}")
print(f"合并后坐标: {list(merged.coords)}")
# 输出: [(0, 0), (1, 1), (2, 0), (3, 1)]
```

### 17.3.2 处理分支线段

当线段网络存在分支时，无法合并为单条线：

```python
from shapely.ops import linemerge
from shapely import MultiLineString

# Y 形线段（有分支）
lines = MultiLineString([
    [(0, 0), (1, 1)],
    [(1, 1), (2, 2)],
    [(1, 1), (2, 0)],  # 分支
])

merged = linemerge(lines)
print(f"类型: {merged.geom_type}")
# 输出: MultiLineString（因为有分支，不能合并为一条线）

if merged.geom_type == 'MultiLineString':
    print(f"合并后仍有 {len(merged.geoms)} 条线段")
```

### 17.3.3 directed 参数

`directed=True` 时只合并同向连接的线段：

```python
from shapely.ops import linemerge
from shapely import MultiLineString

# 反向连接的线段
lines = MultiLineString([
    [(0, 0), (1, 0)],
    [(2, 0), (1, 0)],  # 反向（终点→终点）
])

# 非定向合并（忽略方向）
merged1 = linemerge(lines, directed=False)
print(f"非定向: {merged1.geom_type}")  # LineString

# 定向合并（考虑方向）
merged2 = linemerge(lines, directed=True)
print(f"定向: {merged2.geom_type}")  # MultiLineString（无法合并）
```

---

## 17.4 polygonize / polygonize_full — 多边形化

### 17.4.1 polygonize 基本用法

`polygonize()` 从线段网络构建多边形：

```python
from shapely.ops import polygonize
from shapely import LineString

# 构成矩形的四条边
lines = [
    LineString([(0, 0), (4, 0)]),
    LineString([(4, 0), (4, 3)]),
    LineString([(4, 3), (0, 3)]),
    LineString([(0, 3), (0, 0)]),
    LineString([(2, 0), (2, 3)]),  # 中间分割线
]

# 多边形化
polygons = list(polygonize(lines))
print(f"生成 {len(polygons)} 个多边形")

for i, poly in enumerate(polygons):
    print(f"多边形 {i+1}: 面积={poly.area:.2f}")
```

### 17.4.2 polygonize_full 完整诊断

`polygonize_full()` 返回完整的多边形化结果，包括诊断信息：

```python
from shapely.ops import polygonize_full
from shapely import LineString

lines = [
    LineString([(0, 0), (4, 0)]),
    LineString([(4, 0), (4, 3)]),
    LineString([(4, 3), (0, 3)]),
    LineString([(0, 3), (0, 0)]),
    LineString([(5, 0), (6, 1)]),  # 悬挂线段
    LineString([(2, 0), (2, 1)]),  # 截断边
]

result = polygonize_full(lines)
polygons, dangles, cut_edges, invalid_rings = result

print(f"多边形: {len(polygons.geoms)}")
print(f"悬挂线段: {len(dangles.geoms)}")
print(f"截断边: {len(cut_edges.geoms)}")
print(f"无效环: {len(invalid_rings.geoms)}")

# 悬挂线段是只有一端连接到网络的线段
for d in dangles.geoms:
    print(f"  悬挂: {d}")

# 截断边是只有部分被使用的线段
for c in cut_edges.geoms:
    print(f"  截断: {c}")
```

---

## 17.5 split — 几何分割

### 17.5.1 用点分割线

```python
from shapely.ops import split
from shapely import LineString, Point

line = LineString([(0, 0), (5, 0), (10, 0)])
point = Point(3, 0)

# 在点处分割线段
result = split(line, point)
print(f"分割为 {len(result.geoms)} 段")
for i, part in enumerate(result.geoms):
    print(f"  段 {i+1}: {list(part.coords)}, 长度={part.length:.2f}")
```

### 17.5.2 用线分割面

```python
from shapely.ops import split
from shapely import Polygon, LineString

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
splitter = LineString([(-1, 5), (11, 5)])  # 水平切割线

result = split(polygon, splitter)
print(f"分割为 {len(result.geoms)} 个部分")
for i, part in enumerate(result.geoms):
    print(f"  部分 {i+1}: 面积={part.area:.2f}")
```

### 17.5.3 用线分割线

```python
from shapely.ops import split
from shapely import LineString

line1 = LineString([(0, 0), (10, 10)])
line2 = LineString([(0, 10), (10, 0)])

result = split(line1, line2)
print(f"分割为 {len(result.geoms)} 段")
for i, part in enumerate(result.geoms):
    print(f"  段 {i+1}: 长度={part.length:.4f}")
```

### 17.5.4 分割注意事项

```python
from shapely.ops import split
from shapely import LineString, Point, snap

line = LineString([(0, 0), (10, 0)])
point = Point(3, 0.001)  # 不在线上的点

# 点不精确在线上时分割失败
result = split(line, point)
print(f"分割结果: {len(result.geoms)} 段")  # 可能是 1（未分割）

# 先捕捉再分割
snapped_line = snap(line, point, tolerance=0.01)
result = split(snapped_line, point)
print(f"捕捉后分割: {len(result.geoms)} 段")
```

---

## 17.6 substring — 子线段提取

### 17.6.1 按绝对距离提取

```python
from shapely.ops import substring
from shapely import LineString

line = LineString([(0, 0), (5, 0), (10, 0)])
print(f"线段总长度: {line.length}")

# 提取距离 2 到 7 的部分
sub = substring(line, 2, 7)
print(f"子线段: {list(sub.coords)}")
print(f"子线段长度: {sub.length:.2f}")

# 从开头提取
sub_start = substring(line, 0, 3)
print(f"前3单位: {list(sub_start.coords)}")

# 从中间到末尾
sub_end = substring(line, 6, line.length)
print(f"后4单位: {list(sub_end.coords)}")
```

### 17.6.2 按归一化距离提取

```python
from shapely.ops import substring
from shapely import LineString

line = LineString([(0, 0), (10, 0), (10, 10)])
print(f"总长度: {line.length}")

# 提取中间 50%（归一化距离 0.25 到 0.75）
mid = substring(line, 0.25, 0.75, normalized=True)
print(f"中间段: {list(mid.coords)}")
print(f"中间段长度: {mid.length:.2f}")

# 提取前半段
first_half = substring(line, 0, 0.5, normalized=True)
print(f"前半段长度: {first_half.length:.2f}")
```

### 17.6.3 反向提取

```python
from shapely.ops import substring
from shapely import LineString

line = LineString([(0, 0), (5, 0), (10, 0)])

# start_dist > end_dist 时反转方向
reversed_sub = substring(line, 7, 3)
print(f"反向子线段: {list(reversed_sub.coords)}")
# 坐标顺序与正向相反
```

---

## 17.7 nearest_points — 最近点对

```python
from shapely.ops import nearest_points
from shapely import Point, LineString, Polygon

# 点与线的最近点
point = Point(3, 3)
line = LineString([(0, 0), (10, 0)])

np1, np2 = nearest_points(point, line)
print(f"点上最近位置: {np1}")  # (3, 3)
print(f"线上最近位置: {np2}")  # (3, 0)
print(f"距离: {point.distance(line):.4f}")

# 两个多边形的最近点
poly1 = Polygon([(0, 0), (2, 0), (2, 2), (0, 2)])
poly2 = Polygon([(5, 5), (7, 5), (7, 7), (5, 7)])

np1, np2 = nearest_points(poly1, poly2)
print(f"\n多边形1最近点: {np1}")
print(f"多边形2最近点: {np2}")
print(f"距离: {poly1.distance(poly2):.4f}")
```

---

## 17.8 orient — 方向统一

```python
from shapely.ops import orient
from shapely import Polygon

# 创建一个顺时针多边形
cw_polygon = Polygon([(0, 0), (0, 1), (1, 1), (1, 0)])

# 检查方向
ring = cw_polygon.exterior
from shapely import is_ccw
print(f"原始方向 CCW: {is_ccw(ring)}")

# 统一为逆时针（sign=1.0，默认）
ccw_polygon = orient(cw_polygon, sign=1.0)
print(f"统一后 CCW: {is_ccw(ccw_polygon.exterior)}")

# 统一为顺时针
cw_again = orient(ccw_polygon, sign=-1.0)
print(f"顺时针 CCW: {is_ccw(cw_again.exterior)}")
```

---

## 17.9 snap — 捕捉操作

```python
from shapely.ops import snap
from shapely import LineString, Point, Polygon

# 将线段捕捉到点
line = LineString([(0, 0), (10, 0)])
point = Point(5, 0.5)

snapped = snap(line, point, tolerance=1.0)
print(f"捕捉前: {list(line.coords)}")
print(f"捕捉后: {list(snapped.coords)}")
# 线上最近的位置会被移动到点的位置

# 多边形边界捕捉
poly1 = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
poly2 = Polygon([(10.1, 0), (20, 0), (20, 10), (10.1, 10)])

snapped_poly2 = snap(poly2, poly1, tolerance=0.5)
print(f"\n捕捉前间隙: {poly1.distance(poly2):.4f}")
print(f"捕捉后间隙: {poly1.distance(snapped_poly2):.4f}")
```

---

## 17.10 组合使用模式

### 17.10.1 道路网络处理

```python
from shapely.ops import linemerge, polygonize, unary_union, split
from shapely import LineString, MultiLineString

# 模拟道路网络
roads = [
    LineString([(0, 0), (10, 0)]),
    LineString([(10, 0), (10, 10)]),
    LineString([(10, 10), (0, 10)]),
    LineString([(0, 10), (0, 0)]),
    LineString([(5, 0), (5, 10)]),
    LineString([(0, 5), (10, 5)]),
]

# 合并相连线段
merged = linemerge(MultiLineString(roads))
print(f"合并后: {merged.geom_type}")

# 从道路网络生成街区（多边形）
blocks = list(polygonize(roads))
print(f"街区数: {len(blocks)}")
for i, block in enumerate(blocks):
    print(f"  街区 {i+1}: 面积={block.area:.2f}")
```

### 17.10.2 河流分割地块

```python
from shapely.ops import split
from shapely import Polygon, LineString

# 地块
parcel = Polygon([(0, 0), (20, 0), (20, 15), (0, 15)])

# 河流（弯曲的线）
river = LineString([(0, 8), (5, 6), (10, 9), (15, 7), (20, 8)])

# 用河流分割地块
parts = split(parcel, river)
print(f"分割为 {len(parts.geoms)} 个部分")

for i, part in enumerate(parts.geoms):
    print(f"  部分 {i+1}:")
    print(f"    面积: {part.area:.2f}")
    print(f"    占比: {part.area / parcel.area * 100:.1f}%")
```

---

## 17.11 本章小结

`shapely.ops` 模块提供的高级操作函数汇总：

| 函数 | 用途 | 输入 | 输出 |
|-----|------|------|------|
| `unary_union` | 批量并集 | 几何列表 | 单个几何 |
| `linemerge` | 合并连接线段 | MultiLineString | LineString/MultiLineString |
| `polygonize` | 从线段构建多边形 | 线段列表 | 多边形生成器 |
| `polygonize_full` | 完整多边形化 | 线段列表 | (多边形, 悬挂, 截断, 无效) |
| `split` | 分割几何体 | 几何 + 分割器 | GeometryCollection |
| `substring` | 提取子线段 | LineString + 距离 | LineString |
| `nearest_points` | 最近点对 | 两个几何 | (Point, Point) |
| `orient` | 统一方向 | Polygon | Polygon |
| `snap` | 捕捉顶点 | 两个几何 + 容差 | 几何 |
| `triangulate` | Delaunay 三角剖分 | 几何 | 三角形列表 |
| `voronoi_diagram` | Voronoi 图 | 几何 | GeometryCollection |

使用建议：
- `unary_union` 适合合并大量几何体，性能远优于逐个 `union`
- `linemerge` 处理路网数据时非常实用
- `polygonize_full` 的诊断输出对调试线段网络问题很有帮助
- `split` 前确保分割器与目标几何精确相交
- `snap` 可解决微小间隙导致的拓扑问题

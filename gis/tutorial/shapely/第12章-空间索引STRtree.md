---
layout: default
title: "第12章：空间索引（STRtree）"
---

# 第12章：空间索引（STRtree）

> 在处理大规模空间数据时，逐一比较每对几何体的效率极低。空间索引通过构建层次化的数据结构，将空间查询的时间复杂度从 O(n²) 降低到 O(n log n)，是 GIS 系统中不可或缺的核心技术。Shapely 提供了基于 STR（Sort-Tile-Recursive）算法的 R-tree 空间索引实现——STRtree，本章将详细介绍其原理、用法和性能优化技巧。

---

## 空间索引概述

### 为什么需要空间索引

考虑一个典型的空间查询场景：在 10,000 个多边形中找出包含某个点的多边形。

```python
from shapely import Point, box
import time

# 暴力搜索的问题
n = 10000
polygons = [box(i % 100, i // 100, i % 100 + 1, i // 100 + 1) for i in range(n)]
query_point = Point(50.5, 50.5)

# O(n) 暴力搜索
start = time.perf_counter()
results = []
for i, poly in enumerate(polygons):
    if poly.contains(query_point):
        results.append(i)
brute_time = time.perf_counter() - start

print(f"暴力搜索: {len(results)} 个结果, 耗时 {brute_time*1000:.2f} ms")
```

如果需要对 10,000 个点逐一查询，暴力搜索就变成了 O(n²) = 1 亿次比较，这在实际应用中是不可接受的。

### 性能提升的原理

空间索引的核心思想是：**先用包围盒（Bounding Box）快速过滤，再精确判断**。

```python
# 空间索引的两阶段过滤策略
# 阶段1: 粗过滤 - 用包围盒快速排除不可能相交的几何体 (极快)
# 阶段2: 精过滤 - 对候选集进行精确的空间关系判断 (较慢但数量少)

from shapely import Point, box

poly = box(0, 0, 10, 10)
query = Point(5, 5)

# 包围盒检查（极快）
bbox_intersects = (
    query.x >= 0 and query.x <= 10 and
    query.y >= 0 and query.y <= 10
)

# 精确检查（较慢）
if bbox_intersects:
    exact_result = poly.contains(query)
    print(f"精确结果: {exact_result}")
```

---

## R-tree 与 STR 算法原理

### R-tree 基础

R-tree（Rectangle tree）是一种树形空间索引结构：

- **叶节点**：存储几何体的最小包围矩形（MBR）和指向实际几何体的引用
- **非叶节点**：存储子节点 MBR 的并集矩形
- **查询过程**：从根节点开始，只遍历与查询范围相交的子树

```python
# R-tree 的概念演示
from shapely import box

# 想象一组几何体被分组
group_a = [box(0, 0, 1, 1), box(1, 0, 2, 1), box(0, 1, 1, 2)]
group_b = [box(5, 5, 6, 6), box(6, 5, 7, 6), box(5, 6, 6, 7)]

# 每组有一个包围盒
from shapely import unary_union
bbox_a = unary_union(group_a).bounds  # (0, 0, 2, 2)
bbox_b = unary_union(group_b).bounds  # (5, 5, 7, 7)

print(f"A组包围盒: {bbox_a}")
print(f"B组包围盒: {bbox_b}")

# 查询 Point(5.5, 5.5) 时，可以直接跳过 A 组
# 因为 (5.5, 5.5) 不在 A 组的包围盒 (0, 0, 2, 2) 内
```

### STR 算法特点

STR（Sort-Tile-Recursive）是一种批量加载（bulk-loading）的 R-tree 构建算法：

1. **排序**：按几何体中心点的 x 坐标排序
2. **分片**：将排序后的几何体分成等大的组
3. **递归**：对每组内再按 y 坐标排序并分组
4. **构建**：自底向上构建树节点

STR 的优势：
- 静态构建，查询性能最优
- 节点填充率高，空间利用好
- 适合一次构建、多次查询的场景

---

## STRtree 类

### 构造函数

```python
from shapely import STRtree, Point, box

# 基本构造
geometries = [
    Point(0, 0),
    Point(1, 1),
    box(2, 2, 3, 3),
    box(4, 4, 5, 5),
]

tree = STRtree(geometries)
print(f"索引中的几何体数量: {len(tree.geometries)}")
```

### 使用 node_capacity 调优

```python
from shapely import STRtree, Point
import time

# 生成大量点
points = [Point(i % 100, i // 100) for i in range(10000)]

# 不同的 node_capacity
for capacity in [5, 10, 20, 50]:
    start = time.perf_counter()
    tree = STRtree(points, node_capacity=capacity)
    build_time = time.perf_counter() - start

    # 测试查询性能
    start = time.perf_counter()
    for _ in range(100):
        tree.query(box(40, 40, 60, 60))
    query_time = time.perf_counter() - start

    print(f"node_capacity={capacity:3d}: "
          f"构建 {build_time*1000:.1f}ms, "
          f"100次查询 {query_time*1000:.1f}ms")
```

### 基本属性

```python
from shapely import STRtree, Point, box

geometries = [Point(i, i) for i in range(100)]
tree = STRtree(geometries)

# 获取几何体数组
print(f"几何体数量: {len(tree.geometries)}")

# geometries 属性返回 NumPy 数组
geoms = tree.geometries
print(f"类型: {type(geoms)}")
print(f"第一个: {geoms[0]}")
```

---

## query 方法详解

### 基本空间查询

```python
from shapely import STRtree, Point, box

# 创建网格点
points = [Point(i % 10, i // 10) for i in range(100)]
tree = STRtree(points)

# 查询与矩形相交的几何体
query_box = box(3, 3, 6, 6)
indices = tree.query(query_box)

print(f"查询结果数量: {len(indices)}")
print(f"返回的索引: {indices}")

# 获取实际的几何体
result_geoms = tree.geometries.take(indices)
for idx in indices[:5]:
    print(f"  索引{idx}: {tree.geometries[idx]}")
```

### 使用 predicate 参数

```python
from shapely import STRtree, Point, box, Polygon

# 创建一些多边形
polygons = [
    box(0, 0, 5, 5),
    box(3, 3, 8, 8),
    box(7, 7, 12, 12),
    box(10, 10, 15, 15),
]
tree = STRtree(polygons)

query_geom = box(4, 4, 9, 9)

# 不同的 predicate
predicates = [
    'intersects',
    'within',
    'contains',
    'overlaps',
    'crosses',
    'touches',
    'covers',
    'covered_by',
    'contains_properly',
]

for pred in predicates:
    indices = tree.query(query_geom, predicate=pred)
    print(f"predicate='{pred}': 匹配 {len(indices)} 个")
    if len(indices) > 0:
        for idx in indices:
            print(f"    索引{idx}: {polygons[idx]}")
```

### intersects 查询

```python
from shapely import STRtree, box

# 创建网格多边形
grid = [box(i, j, i+1, j+1) for i in range(10) for j in range(10)]
tree = STRtree(grid)

# 查询与给定区域相交的网格单元
query_area = box(2.5, 2.5, 5.5, 5.5)

# 默认查询（仅基于包围盒）
bbox_results = tree.query(query_area)
print(f"包围盒过滤结果: {len(bbox_results)} 个")

# 使用 predicate 精确过滤
exact_results = tree.query(query_area, predicate='intersects')
print(f"精确 intersects 结果: {len(exact_results)} 个")
```

### within 和 contains 查询

```python
from shapely import STRtree, Point, box

# 创建随机散布的点
import random
random.seed(42)
points = [Point(random.uniform(0, 100), random.uniform(0, 100))
          for _ in range(1000)]
tree = STRtree(points)

# 查询矩形范围内的点
search_area = box(20, 20, 40, 40)

# 使用 within：找出在 search_area 内的点
within_indices = tree.query(search_area, predicate='contains')
# 注意：因为 search_area 是查询几何体
# tree 中的点 within search_area ←→ search_area contains 点
print(f"区域内的点数: {len(within_indices)}")

# 验证
for idx in within_indices[:5]:
    pt = tree.geometries[idx]
    assert search_area.contains(pt)
    print(f"  点 ({pt.x:.1f}, {pt.y:.1f}) 在搜索区域内")
```

### 返回索引数组

```python
from shapely import STRtree, Point, box
import numpy as np

# STRtree.query 返回 NumPy 索引数组
points = [Point(i, i) for i in range(50)]
tree = STRtree(points)

indices = tree.query(box(10, 10, 30, 30), predicate='intersects')
print(f"返回类型: {type(indices)}")
print(f"索引数组: {indices}")

# 可以直接用于 NumPy 索引操作
geoms = tree.geometries[indices]
print(f"匹配的几何体数量: {len(geoms)}")
```

### 批量查询

```python
from shapely import STRtree, Point, box
import numpy as np

# 构建索引
points = [Point(i % 100, i // 100) for i in range(10000)]
tree = STRtree(points)

# 批量查询多个几何体
query_geoms = np.array([
    box(10, 10, 20, 20),
    box(30, 30, 40, 40),
    box(50, 50, 60, 60),
])

# query 支持数组输入
results = tree.query(query_geoms, predicate='intersects')
print(f"批量查询返回形状: 2 x N 的索引数组")
print(f"结果形状: {results.shape}")

# results[0] 是查询几何体的索引
# results[1] 是匹配到的树中几何体的索引
for i in range(len(query_geoms)):
    mask = results[0] == i
    matched = results[1][mask]
    print(f"查询几何体{i}: 匹配 {len(matched)} 个点")
```

---

## nearest 方法

### 基本最近邻查询

```python
from shapely import STRtree, Point

points = [Point(0, 0), Point(3, 3), Point(6, 6), Point(10, 10)]
tree = STRtree(points)

# 查询最近的几何体
query_point = Point(4, 4)
nearest_idx = tree.nearest(query_point)
print(f"最近几何体索引: {nearest_idx}")
print(f"最近几何体: {tree.geometries[nearest_idx]}")
```

### exclusive 参数

```python
from shapely import STRtree, Point

# 当查询点也在索引中时，排除自身
points = [Point(0, 0), Point(5, 5), Point(10, 10)]
tree = STRtree(points)

# 查询 Point(5, 5) 最近的（不包括自身）
query = Point(5, 5)

# 不排除自身
idx = tree.nearest(query, exclusive=False)
print(f"不排除自身: {tree.geometries[idx]}")  # POINT (5 5)

# 排除自身（精确匹配的几何体）
idx_excl = tree.nearest(query, exclusive=True)
print(f"排除自身: {tree.geometries[idx_excl]}")  # POINT (0 0) 或 POINT (10 10)
```

### 批量最近邻查询

```python
from shapely import STRtree, Point
import numpy as np

# 目标点集
targets = [Point(i * 10, 0) for i in range(10)]
tree = STRtree(targets)

# 查询点集
queries = np.array([Point(5, 0), Point(25, 0), Point(75, 0)])

# 批量最近邻
indices = tree.nearest(queries)
print(f"批量查询返回索引: {indices}")

for i, (q, idx) in enumerate(zip(queries, indices)):
    print(f"查询点 {q} → 最近: {tree.geometries[idx]}")
```

### return_all 处理等距情况

```python
from shapely import STRtree, Point

# 等距的情况
points = [Point(0, 0), Point(10, 0), Point(5, 0)]
tree = STRtree(points)

query = Point(5, 5)  # 到 Point(5,0) 距离为5，到其他点更远

idx = tree.nearest(query)
print(f"最近邻: {tree.geometries[idx]}")
```

---

## 性能对比

### 有索引 vs 无索引

```python
from shapely import STRtree, Point, box
import time

def benchmark(n_objects, n_queries):
    """对比有索引和无索引的查询性能"""
    # 创建几何体
    points = [Point(i % 100, i // 100) for i in range(n_objects)]

    # 构建索引
    start = time.perf_counter()
    tree = STRtree(points)
    build_time = time.perf_counter() - start

    # 查询几何体
    queries = [box(i*5, i*5, i*5+10, i*5+10) for i in range(n_queries)]

    # 有索引查询
    start = time.perf_counter()
    for q in queries:
        tree.query(q, predicate='intersects')
    indexed_time = time.perf_counter() - start

    # 无索引查询（暴力搜索）
    start = time.perf_counter()
    for q in queries:
        [i for i, p in enumerate(points) if q.intersects(p)]
    brute_time = time.perf_counter() - start

    print(f"数据量: {n_objects}, 查询数: {n_queries}")
    print(f"  索引构建: {build_time*1000:.1f} ms")
    print(f"  有索引查询: {indexed_time*1000:.1f} ms")
    print(f"  无索引查询: {brute_time*1000:.1f} ms")
    print(f"  加速比: {brute_time/indexed_time:.1f}x")
    print()

# 不同规模的测试
benchmark(1000, 10)
benchmark(5000, 10)
benchmark(10000, 10)
```

### 不同数据规模的构建时间

```python
from shapely import STRtree, Point
import time

for n in [100, 1000, 5000, 10000, 50000]:
    points = [Point(i % 1000, i // 1000) for i in range(n)]

    start = time.perf_counter()
    tree = STRtree(points)
    elapsed = time.perf_counter() - start

    print(f"n={n:6d}: 构建时间 {elapsed*1000:.2f} ms")
```

---

## 与 Prepared Geometry 结合使用

```python
from shapely import STRtree, Point, Polygon, prepare
import time

# 创建大量点
n_points = 10000
points = [Point(i % 100, i // 100) for i in range(n_points)]
tree = STRtree(points)

# 复杂的查询多边形
query_polygon = Polygon([
    (20, 20), (40, 20), (50, 30), (45, 50),
    (30, 55), (15, 45), (10, 30)
])

# 方法1: STRtree + 普通几何体
start = time.perf_counter()
candidates = tree.query(query_polygon, predicate='intersects')
time1 = time.perf_counter() - start

# 方法2: STRtree 粗过滤 + prepare 精过滤
start = time.perf_counter()
candidate_indices = tree.query(query_polygon)  # 仅 bbox 过滤
prepare(query_polygon)  # 准备几何体
result = [i for i in candidate_indices
          if query_polygon.contains(points[i])]
time2 = time.perf_counter() - start

print(f"STRtree + predicate: {time1*1000:.2f} ms, {len(candidates)} 结果")
print(f"STRtree + prepare:   {time2*1000:.2f} ms, {len(result)} 结果")
```

---

## 实际应用案例

### 案例一：大规模点在面内查询

```python
from shapely import STRtree, Point, Polygon
import random
import time

random.seed(42)

# 模拟行政区划（多个多边形）
districts = [
    Polygon([(0, 0), (30, 0), (30, 30), (0, 30)]),
    Polygon([(30, 0), (60, 0), (60, 30), (30, 30)]),
    Polygon([(60, 0), (100, 0), (100, 30), (60, 30)]),
    Polygon([(0, 30), (50, 30), (50, 60), (0, 60)]),
    Polygon([(50, 30), (100, 30), (100, 60), (50, 60)]),
]
district_names = ["A区", "B区", "C区", "D区", "E区"]

# 大量 POI 点
n_poi = 5000
pois = [Point(random.uniform(0, 100), random.uniform(0, 60))
        for _ in range(n_poi)]

# 使用 STRtree 加速
poi_tree = STRtree(pois)

# 统计每个区域内的 POI 数量
print("各区域 POI 统计:")
for name, district in zip(district_names, districts):
    indices = poi_tree.query(district, predicate='within')
    print(f"  {name}: {len(indices)} 个 POI")
```

### 案例二：空间连接操作

```python
from shapely import STRtree, Point, box
import random

random.seed(123)

# 数据集A：网格区域
grid_size = 10
cells = []
cell_names = []
for i in range(grid_size):
    for j in range(grid_size):
        cells.append(box(i*10, j*10, (i+1)*10, (j+1)*10))
        cell_names.append(f"Cell({i},{j})")

# 数据集B：随机点
n_points = 500
points = [Point(random.uniform(0, 100), random.uniform(0, 100))
          for _ in range(n_points)]

# 空间连接：每个点关联到所在的网格单元
cell_tree = STRtree(cells)

point_to_cell = {}
for i, pt in enumerate(points):
    indices = cell_tree.query(pt, predicate='intersects')
    if len(indices) > 0:
        point_to_cell[i] = indices[0]

# 统计每个网格单元内的点数
from collections import Counter
cell_counts = Counter(point_to_cell.values())

print("网格单元内的点数（前10个）:")
for cell_idx, count in cell_counts.most_common(10):
    print(f"  {cell_names[cell_idx]}: {count} 个点")
```

### 案例三：最近设施查找

```python
from shapely import STRtree, Point
import random

random.seed(456)

# 医院位置
hospitals = [
    Point(10, 10), Point(30, 50), Point(50, 20),
    Point(70, 60), Point(90, 30), Point(20, 80),
    Point(60, 90), Point(80, 10), Point(40, 40),
]
hospital_names = [f"医院{chr(65+i)}" for i in range(len(hospitals))]

tree = STRtree(hospitals)

# 模拟多个急救呼叫位置
emergencies = [
    Point(15, 15), Point(55, 55), Point(85, 25),
    Point(35, 75), Point(65, 45),
]

print("急救调度方案:")
print("-" * 50)
for i, emergency in enumerate(emergencies):
    nearest_idx = tree.nearest(emergency)
    nearest_hospital = hospitals[nearest_idx]
    dist = emergency.distance(nearest_hospital)
    print(f"急救呼叫{i+1} ({emergency.x:.0f}, {emergency.y:.0f}):")
    print(f"  最近医院: {hospital_names[nearest_idx]}"
          f" ({nearest_hospital.x:.0f}, {nearest_hospital.y:.0f})")
    print(f"  距离: {dist:.1f}")
```

---

## 内存占用与性能调优建议

### 内存占用估算

```python
from shapely import STRtree, Point
import sys

# 不同规模的内存占用
for n in [1000, 10000, 100000]:
    points = [Point(i % 1000, i // 1000) for i in range(n)]
    tree = STRtree(points)

    # 估算内存（粗略）
    geom_size = sum(sys.getsizeof(p) for p in points[:100]) / 100
    total_geom = geom_size * n
    print(f"n={n:7d}: "
          f"预估几何体 {total_geom/1024/1024:.1f} MB")
```

### 性能调优建议

```python
# 1. 选择合适的 node_capacity
# 小数据集 (< 1000): node_capacity=5-10
# 中等数据集 (1000-100000): node_capacity=10 (默认)
# 大数据集 (> 100000): node_capacity=20-50

# 2. 使用批量查询而非逐个查询
from shapely import STRtree, Point, box
import numpy as np
import time

points = [Point(i % 100, i // 100) for i in range(10000)]
tree = STRtree(points)

# 反面示例：逐个查询
queries = [box(i*5, i*5, i*5+10, i*5+10) for i in range(20)]

start = time.perf_counter()
results_slow = [tree.query(q, predicate='intersects') for q in queries]
time_slow = time.perf_counter() - start

# 正面示例：批量查询
start = time.perf_counter()
query_array = np.array(queries)
results_fast = tree.query(query_array, predicate='intersects')
time_fast = time.perf_counter() - start

print(f"逐个查询: {time_slow*1000:.2f} ms")
print(f"批量查询: {time_fast*1000:.2f} ms")
```

### 常见使用模式

```python
from shapely import STRtree, Point, box
import numpy as np

# 模式1: 过滤-验证模式
# 先用 STRtree 粗过滤，再精确判断
points = [Point(i % 100, i // 100) for i in range(10000)]
tree = STRtree(points)

query = box(20, 20, 30, 30)
# 粗过滤 + 精过滤一步完成
results = tree.query(query, predicate='within')

# 模式2: 最近邻搜索
# 对每个目标找最近的源
targets = np.array([Point(i*10+5, 5) for i in range(10)])
nearest_indices = tree.nearest(targets)
print(f"最近邻索引: {nearest_indices}")

# 模式3: 空间连接
# 两个数据集的空间关联
set_a = [box(i*10, 0, i*10+10, 10) for i in range(10)]
set_b = [Point(i*5+2.5, 5) for i in range(20)]

tree_a = STRtree(set_a)
join_result = tree_a.query(np.array(set_b), predicate='intersects')
print(f"空间连接结果数: {join_result.shape[1]}")
```

---

## 小结

本章详细介绍了 Shapely 的空间索引 STRtree：

- **STRtree** 基于 STR 算法的 R-tree 实现，适合静态数据集
- **query** 方法支持多种空间谓词过滤，返回索引数组
- **nearest** 方法支持最近邻查询和批量操作
- **批量查询** 使用 NumPy 数组输入可以大幅提升性能
- **性能提升** 通常在 10x-100x 之间，数据量越大越显著

关键调优建议：
1. 使用合适的 `node_capacity`
2. 优先使用批量查询
3. 结合 Prepared Geometry 使用
4. 利用 predicate 参数减少精确计算
5. 对大数据集，先分区再建索引

空间索引是处理大规模空间数据的基础，掌握 STRtree 的使用可以让您的空间分析程序获得数量级的性能提升。

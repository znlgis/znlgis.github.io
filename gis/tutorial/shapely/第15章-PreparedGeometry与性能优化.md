---
layout: default
title: "第15章：Prepared Geometry 与性能优化"
---

# 第15章：Prepared Geometry 与性能优化

> 在处理大规模空间数据时，性能往往是决定项目成败的关键因素。Shapely 提供了多种性能优化手段，包括 Prepared Geometry（预计算空间索引）、向量化操作（ufunc）、精度网格（grid_size）以及多线程并行等。本章将全面介绍这些优化技术，帮助你将空间计算性能提升 10 倍甚至 100 倍。

---

## Prepared Geometry 概述

### 什么是 Prepared Geometry

Prepared Geometry 是一种通过预计算空间索引来加速重复空间谓词查询的技术。当一个几何体需要与大量其他几何体进行空间关系判断时，先对其进行"准备"（prepare），可以显著提升后续查询速度。

```python
from shapely import Point, Polygon, prepare

# 创建一个复杂多边形
polygon = Polygon([
    (0, 0), (10, 0), (10, 10), (5, 8),
    (3, 10), (0, 7), (2, 5), (0, 3)
])

# 准备几何体（预计算内部索引结构）
prepare(polygon)

# 之后对 polygon 的 contains/intersects 等操作会更快
points = [Point(i * 0.5, j * 0.5) for i in range(20) for j in range(20)]
results = [polygon.contains(p) for p in points]
print(f"包含的点数: {sum(results)} / {len(points)}")
```

### 为什么 Prepared Geometry 更快

```python
# 普通几何体：每次调用 contains() 都重新计算
# Prepared Geometry：预先构建内部的空间索引结构
#
# 普通: O(n) 边遍历 × m 次查询 = O(n*m)
# 准备: O(n) 预处理 + O(log n) × m 次查询 = O(n + m*log n)
#
# 当 m 很大时，Prepared 版本快得多

from shapely import Polygon, Point, prepare
import time

# 复杂多边形（100个顶点）
import math
n_vertices = 100
coords = [(10 * math.cos(2 * math.pi * i / n_vertices),
           10 * math.sin(2 * math.pi * i / n_vertices))
          for i in range(n_vertices)]
polygon = Polygon(coords)

# 测试点
test_points = [Point(i * 0.2 - 10, j * 0.2 - 10)
               for i in range(100) for j in range(100)]

# 不准备
start = time.perf_counter()
r1 = [polygon.contains(p) for p in test_points]
time_normal = time.perf_counter() - start

# 准备后
prepare(polygon)
start = time.perf_counter()
r2 = [polygon.contains(p) for p in test_points]
time_prepared = time.perf_counter() - start

print(f"普通查询: {time_normal*1000:.1f} ms")
print(f"准备后查询: {time_prepared*1000:.1f} ms")
print(f"加速比: {time_normal/time_prepared:.1f}x")
```

---

## prepare / destroy_prepared / is_prepared

### prepare(geometry)

```python
from shapely import prepare, Point, Polygon

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

# 准备几何体
prepare(polygon)
# 现在 polygon 内部持有预计算的索引

# 可以正常使用所有方法
print(f"contains Point(5,5): {polygon.contains(Point(5, 5))}")
print(f"intersects Point(15,15): {polygon.intersects(Point(15, 15))}")
```

### destroy_prepared(geometry)

```python
from shapely import prepare, destroy_prepared, Polygon

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

# 准备
prepare(polygon)

# 释放准备结构（通常不需要手动调用）
destroy_prepared(polygon)

# 释放后仍可正常使用，只是不再有加速效果
print(f"释放后仍可用: {polygon.area}")
```

### is_prepared(geometry)

```python
from shapely import prepare, destroy_prepared, is_prepared, Polygon

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

print(f"初始状态: is_prepared = {is_prepared(polygon)}")

prepare(polygon)
print(f"准备后: is_prepared = {is_prepared(polygon)}")

destroy_prepared(polygon)
print(f"释放后: is_prepared = {is_prepared(polygon)}")
```

---

## 支持的加速操作

### 加速操作列表

```python
from shapely import prepare, Point, Polygon, LineString

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
prepare(polygon)

point_inside = Point(5, 5)
point_outside = Point(15, 15)
line_crossing = LineString([(5, -5), (5, 15)])

# 以下操作在 Prepared Geometry 上会加速
operations = {
    'contains': polygon.contains(point_inside),
    'contains_properly': polygon.contains_properly(point_inside) if hasattr(polygon, 'contains_properly') else 'N/A',
    'covers': polygon.covers(point_inside),
    'crosses': polygon.crosses(line_crossing),
    'intersects': polygon.intersects(point_inside),
    'overlaps': polygon.overlaps(Polygon([(5, 5), (15, 5), (15, 15), (5, 15)])),
    'touches': polygon.touches(Point(0, 0)),
    'within': point_inside.within(polygon),
}

for op, result in operations.items():
    print(f"  {op}: {result}")
```

### 详细性能对比

```python
from shapely import prepare, destroy_prepared, Point, Polygon
import time
import math

# 创建复杂多边形
n = 200
coords = [(10 * math.cos(2 * math.pi * i / n),
           10 * math.sin(2 * math.pi * i / n))
          for i in range(n)]
polygon = Polygon(coords)

# 大量测试点
test_points = [Point(i * 0.1 - 10, j * 0.1 - 10)
               for i in range(200) for j in range(200)]

operations = ['contains', 'intersects', 'covers', 'touches']

for op_name in operations:
    # 不准备
    destroy_prepared(polygon)
    op = getattr(polygon, op_name)
    start = time.perf_counter()
    r1 = [op(p) for p in test_points[:1000]]
    time_normal = time.perf_counter() - start

    # 准备后
    prepare(polygon)
    op = getattr(polygon, op_name)
    start = time.perf_counter()
    r2 = [op(p) for p in test_points[:1000]]
    time_prepared = time.perf_counter() - start

    speedup = time_normal / time_prepared if time_prepared > 0 else float('inf')
    print(f"{op_name:20s}: 普通 {time_normal*1000:6.1f}ms, "
          f"准备后 {time_prepared*1000:6.1f}ms, "
          f"加速 {speedup:.1f}x")
```

---

## Shapely 2.0+ 的自动优化

### 自动准备机制

```python
from shapely import Polygon, Point

# Shapely 2.0+ 在首次进行空间关系判断时
# 会自动对几何体进行准备
# 这意味着后续调用会自动加速

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

# 第一次调用可能稍慢（包含准备过程）
result1 = polygon.contains(Point(5, 5))

# 后续调用会更快（已自动准备）
result2 = polygon.contains(Point(3, 3))
result3 = polygon.contains(Point(7, 7))

print(f"结果: {result1}, {result2}, {result3}")
```

### 何时手动准备

```python
# 手动 prepare() 在以下场景仍有价值：
#
# 1. 确保准备在查询前完成（避免第一次查询的延迟）
# 2. 多线程场景下的确定性（提前准备）
# 3. 需要精确控制内存使用

from shapely import prepare, Polygon, Point
import time

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
points = [Point(i * 0.5, j * 0.5) for i in range(20) for j in range(20)]

# 场景：批量查询前预先准备
prepare(polygon)  # 确保已准备

# 批量查询
start = time.perf_counter()
results = [polygon.contains(p) for p in points]
elapsed = time.perf_counter() - start
print(f"批量查询 {len(points)} 点: {elapsed*1000:.2f} ms")
print(f"包含 {sum(results)} 个点")
```

---

## 向量化操作（ufunc）性能

### NumPy 数组 vs Python 循环

```python
from shapely import Point, contains, intersects, Polygon
import numpy as np
import time

# 创建几何体
polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
n_points = 10000
points = np.array([Point(i % 100 * 0.1, i // 100 * 0.1)
                   for i in range(n_points)])

# 方法1: Python 循环
start = time.perf_counter()
results_loop = [polygon.contains(p) for p in points]
time_loop = time.perf_counter() - start

# 方法2: 向量化 ufunc
start = time.perf_counter()
results_vec = contains(polygon, points)
time_vec = time.perf_counter() - start

print(f"Python 循环: {time_loop*1000:.1f} ms")
print(f"向量化 ufunc: {time_vec*1000:.1f} ms")
print(f"加速比: {time_loop/time_vec:.1f}x")
print(f"结果一致: {all(a == b for a, b in zip(results_loop, results_vec))}")
```

### 批量创建 vs 逐个创建

```python
from shapely import points as create_points, Point
import numpy as np
import time

n = 100000

# 方法1: 逐个创建
start = time.perf_counter()
points_slow = [Point(i * 0.01, i * 0.02) for i in range(n)]
time_slow = time.perf_counter() - start

# 方法2: 批量创建
start = time.perf_counter()
coords = np.column_stack([
    np.arange(n) * 0.01,
    np.arange(n) * 0.02
])
points_fast = create_points(coords)
time_fast = time.perf_counter() - start

print(f"逐个创建 {n} 个点: {time_slow*1000:.1f} ms")
print(f"批量创建 {n} 个点: {time_fast*1000:.1f} ms")
print(f"加速比: {time_slow/time_fast:.1f}x")
```

### 向量化空间运算

```python
from shapely import (
    intersection, union, distance,
    Point, Polygon, box
)
import numpy as np
import time

# 创建几何数组
n = 1000
boxes = np.array([box(i % 30, i // 30, i % 30 + 2, i // 30 + 2)
                   for i in range(n)])
query = box(10, 10, 20, 20)

# 向量化距离计算
start = time.perf_counter()
distances = distance(query, boxes)
time_dist = time.perf_counter() - start
print(f"向量化距离计算 ({n} 个): {time_dist*1000:.1f} ms")

# 向量化相交判断
from shapely import intersects
start = time.perf_counter()
mask = intersects(query, boxes)
time_int = time.perf_counter() - start
print(f"向量化相交判断 ({n} 个): {time_int*1000:.1f} ms")
print(f"相交数量: {np.sum(mask)}")
```

---

## 内存优化

### 几何体内存占用估算

```python
from shapely import Point, LineString, Polygon, box
import sys

# 不同几何类型的内存占用
geometries = {
    "Point(0, 0)": Point(0, 0),
    "LineString(10点)": LineString([(i, i) for i in range(10)]),
    "LineString(100点)": LineString([(i, i) for i in range(100)]),
    "Polygon(简单)": box(0, 0, 1, 1),
    "Polygon(100顶点)": Polygon([(i, i**2 % 100) for i in range(100)]),
}

for name, geom in geometries.items():
    size = sys.getsizeof(geom)
    print(f"{name:25s}: {size:6d} bytes ({size/1024:.2f} KB)")
```

### 大数据集的内存管理

```python
from shapely import Point, box
import numpy as np
import gc

# 策略1: 使用 NumPy 数组存储（比 Python list 更高效）
n = 10000

# Python list
points_list = [Point(i, i) for i in range(n)]

# NumPy array
points_array = np.array([Point(i, i) for i in range(n)])

print(f"Python list 长度: {len(points_list)}")
print(f"NumPy array 长度: {len(points_array)}")

# 策略2: 分批处理大数据集
def process_in_batches(data, batch_size=1000):
    """分批处理大数据集，控制内存使用"""
    results = []
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        # 处理当前批次
        batch_result = [p.buffer(1).area for p in batch]
        results.extend(batch_result)
        # 手动触发垃圾回收（大数据集时有用）
        if i % (batch_size * 10) == 0:
            gc.collect()
    return results

# results = process_in_batches(points_list)
# print(f"处理结果数量: {len(results)}")
```

### 坐标数组 vs 几何对象

```python
from shapely import Point, points as create_points
import numpy as np
import sys

n = 10000

# 方案A: 存储为几何对象
geom_array = np.array([Point(i, i*2) for i in range(n)])

# 方案B: 存储为坐标数组，需要时再创建几何体
coord_array = np.column_stack([
    np.arange(n, dtype=np.float64),
    np.arange(n, dtype=np.float64) * 2
])

print(f"几何对象数组: {geom_array.nbytes} bytes")
print(f"坐标数组: {coord_array.nbytes} bytes")
print(f"内存节省: {geom_array.nbytes / coord_array.nbytes:.1f}x")

# 需要时批量创建
geoms_from_coords = create_points(coord_array)
print(f"从坐标创建的几何体数量: {len(geoms_from_coords)}")
```

---

## GIL 释放与多线程

### GEOS 操作自动释放 GIL

```python
# Shapely 2.0+ 的 GEOS 操作会自动释放 Python GIL
# 这意味着可以利用多线程来并行化空间运算

from shapely import Polygon, Point, contains
import numpy as np

# GEOS C 库的操作在执行时释放 GIL
# Python 代码（如列表推导）仍受 GIL 限制

# 因此，向量化的 ufunc 操作可以从多线程中受益
# 而 Python 循环则不行
```

### concurrent.futures 并行示例

```python
from shapely import Polygon, Point, contains, box
import numpy as np
import time
from concurrent.futures import ThreadPoolExecutor

# 创建测试数据
polygon = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])
n = 50000
all_points = np.array([Point(i % 200 * 0.5, i // 200 * 0.5)
                        for i in range(n)])

# 单线程
start = time.perf_counter()
result_single = contains(polygon, all_points)
time_single = time.perf_counter() - start

# 多线程分片处理
def contains_chunk(args):
    poly, points_chunk = args
    return contains(poly, points_chunk)

n_threads = 4
chunks = np.array_split(all_points, n_threads)

start = time.perf_counter()
with ThreadPoolExecutor(max_workers=n_threads) as executor:
    futures = executor.map(contains_chunk,
                           [(polygon, chunk) for chunk in chunks])
    result_multi = np.concatenate(list(futures))
time_multi = time.perf_counter() - start

print(f"单线程: {time_single*1000:.1f} ms")
print(f"多线程 ({n_threads}线程): {time_multi*1000:.1f} ms")
print(f"加速比: {time_single/time_multi:.1f}x")
print(f"结果一致: {np.array_equal(result_single, result_multi)}")
```

### 多进程并行

```python
from shapely import Polygon, to_wkb, from_wkb
import time

# 多进程中需要序列化几何体
# 推荐使用 WKB 格式传递

def worker_task(wkb_data):
    """子进程中的工作函数"""
    from shapely import from_wkb
    polygon = from_wkb(wkb_data)
    # 执行耗时的空间计算
    buffered = polygon.buffer(1)
    simplified = buffered.simplify(0.1)
    return simplified.area

# 准备数据
polygons = [Polygon([(i, i), (i+10, i), (i+10, i+10), (i, i+10)])
            for i in range(100)]
wkb_list = [to_wkb(p) for p in polygons]

# 单进程基准
start = time.perf_counter()
results_single = [worker_task(w) for w in wkb_list]
time_single = time.perf_counter() - start
print(f"单进程: {time_single*1000:.1f} ms")

# 多进程（使用 WKB 序列化传递）
# from concurrent.futures import ProcessPoolExecutor
# with ProcessPoolExecutor(max_workers=4) as executor:
#     results_multi = list(executor.map(worker_task, wkb_list))
```

---

## grid_size 精度网格

### 使用 grid_size 降低精度

```python
from shapely import set_precision, Polygon, Point
import time

# 高精度坐标
polygon = Polygon([
    (0.123456789012345, 0.987654321098765),
    (10.111111111111111, 0.222222222222222),
    (10.333333333333333, 10.444444444444444),
    (0.555555555555556, 10.666666666666666),
])

# 降低精度
for grid_size in [0.001, 0.01, 0.1, 1.0]:
    snapped = set_precision(polygon, grid_size=grid_size)
    print(f"grid_size={grid_size}: 面积={snapped.area:.6f}")
```

### 避免浮点精度问题

```python
from shapely import Polygon, intersection, set_precision

# 浮点精度问题示例
poly1 = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
poly2 = Polygon([(0.9999999999, 0), (2, 0), (2, 1), (0.9999999999, 1)])

# 直接计算可能有精度问题
result = intersection(poly1, poly2)
print(f"直接交集面积: {result.area}")
print(f"直接交集类型: {result.geom_type}")

# 使用精度网格
poly1_snapped = set_precision(poly1, grid_size=1e-6)
poly2_snapped = set_precision(poly2, grid_size=1e-6)
result_snapped = intersection(poly1_snapped, poly2_snapped)
print(f"精度网格交集面积: {result_snapped.area}")
```

### 性能与精度的权衡

```python
from shapely import Polygon, intersection, set_precision
import time

# 创建复杂多边形
import math
n = 1000
coords1 = [(10 * math.cos(2 * math.pi * i / n),
            10 * math.sin(2 * math.pi * i / n))
           for i in range(n)]
coords2 = [(10 * math.cos(2 * math.pi * i / n) + 5,
            10 * math.sin(2 * math.pi * i / n))
           for i in range(n)]

poly1 = Polygon(coords1)
poly2 = Polygon(coords2)

# 高精度计算
start = time.perf_counter()
result_high = intersection(poly1, poly2)
time_high = time.perf_counter() - start
print(f"高精度: {time_high*1000:.1f} ms, 面积={result_high.area:.6f}")

# 低精度计算（grid_size=0.01）
poly1_low = set_precision(poly1, grid_size=0.01)
poly2_low = set_precision(poly2, grid_size=0.01)
start = time.perf_counter()
result_low = intersection(poly1_low, poly2_low)
time_low = time.perf_counter() - start
print(f"低精度: {time_low*1000:.1f} ms, 面积={result_low.area:.6f}")

diff = abs(result_high.area - result_low.area)
print(f"面积差异: {diff:.6f} ({diff/result_high.area*100:.4f}%)")
```

---

## STRtree 与 Prepared Geometry 组合

### 最佳实践：两阶段过滤

```python
from shapely import STRtree, prepare, Point, Polygon
import numpy as np
import time

# 创建大量随机点
n = 50000
np.random.seed(42)
x = np.random.uniform(0, 100, n)
y = np.random.uniform(0, 100, n)
points = np.array([Point(xi, yi) for xi, yi in zip(x, y)])

# 查询多边形
query_poly = Polygon([
    (20, 20), (50, 15), (80, 30),
    (75, 60), (60, 80), (30, 75), (15, 50)
])

# 方法1: 纯暴力搜索
start = time.perf_counter()
results_brute = [i for i, p in enumerate(points)
                 if query_poly.contains(p)]
time_brute = time.perf_counter() - start

# 方法2: STRtree + predicate
tree = STRtree(points)
start = time.perf_counter()
results_tree = tree.query(query_poly, predicate='contains')
time_tree = time.perf_counter() - start

# 方法3: STRtree 粗过滤 + Prepared 精过滤
start = time.perf_counter()
candidates = tree.query(query_poly)  # 仅 bbox
prepare(query_poly)
results_combined = [i for i in candidates
                    if query_poly.contains(points[i])]
time_combined = time.perf_counter() - start

print(f"暴力搜索: {time_brute*1000:.1f} ms, {len(results_brute)} 结果")
print(f"STRtree+predicate: {time_tree*1000:.1f} ms, {len(results_tree)} 结果")
print(f"STRtree+Prepared: {time_combined*1000:.1f} ms, {len(results_combined)} 结果")
```

### 大规模空间连接优化

```python
from shapely import STRtree, prepare, Polygon, Point, box
import numpy as np
import time

# 场景：将 10000 个点关联到 100 个区域

# 创建区域
regions = [box(i % 10 * 10, i // 10 * 10,
               i % 10 * 10 + 10, i // 10 * 10 + 10)
           for i in range(100)]
region_names = [f"R{i}" for i in range(100)]

# 创建点
np.random.seed(42)
n_points = 10000
pts = np.array([Point(np.random.uniform(0, 100),
                       np.random.uniform(0, 100))
                for _ in range(n_points)])

# 方法1: 双重循环（O(n*m)）
start = time.perf_counter()
assignments_brute = {}
for i, pt in enumerate(pts):
    for j, region in enumerate(regions):
        if region.contains(pt):
            assignments_brute[i] = j
            break
time_brute = time.perf_counter() - start

# 方法2: STRtree 优化
region_tree = STRtree(regions)
start = time.perf_counter()
assignments_tree = {}
for i, pt in enumerate(pts):
    indices = region_tree.query(pt, predicate='intersects')
    if len(indices) > 0:
        assignments_tree[i] = indices[0]
time_tree = time.perf_counter() - start

# 方法3: 批量 STRtree
start = time.perf_counter()
result = region_tree.query(pts, predicate='intersects')
assignments_batch = {result[1][i]: result[0][i]
                     for i in range(result.shape[1])}
time_batch = time.perf_counter() - start

print(f"双重循环: {time_brute*1000:.1f} ms")
print(f"STRtree 逐个: {time_tree*1000:.1f} ms")
print(f"STRtree 批量: {time_batch*1000:.1f} ms")
```

---

## 性能调优最佳实践清单

### 完整的最佳实践

```python
# ============================================
# Shapely 性能调优最佳实践清单
# ============================================

# 1. 优先使用向量化操作（ufunc）
# ✗ 慢
# results = [geom1.intersects(g) for g in geom_array]
# ✓ 快
# results = shapely.intersects(geom1, geom_array)

# 2. 批量创建几何体
# ✗ 慢
# points = [Point(x, y) for x, y in coords]
# ✓ 快
# points = shapely.points(coords_array)

# 3. 使用 STRtree 进行空间查询
# ✗ O(n²) 暴力搜索
# ✓ O(n log n) 索引查询

# 4. 利用 Prepared Geometry
# 对频繁查询的几何体调用 prepare()

# 5. 使用 NumPy 数组存储几何体
# np.array([...]) 比 Python list 更高效

# 6. 控制精度
# set_precision(geom, grid_size=0.001)
# 避免不必要的高精度计算

# 7. 分批处理大数据集
# 避免一次性加载所有数据到内存

# 8. 选择合适的序列化格式
# WKB > WKT > GeoJSON（性能排序）

# 9. 利用多线程
# GEOS 操作释放 GIL，可以用 ThreadPoolExecutor

# 10. 简化复杂几何体
# simplify() 减少顶点数，加速后续计算
```

### 性能优化决策流程

```python
def optimization_guide(n_geometries, n_queries, is_repeated):
    """性能优化决策指南"""
    recommendations = []

    if n_geometries > 1000:
        recommendations.append("✓ 使用 STRtree 空间索引")

    if n_queries > 100:
        recommendations.append("✓ 使用 Prepared Geometry")

    if n_geometries > 100:
        recommendations.append("✓ 使用向量化操作（ufunc）")
        recommendations.append("✓ 使用 NumPy 数组存储")

    if n_geometries > 10000:
        recommendations.append("✓ 考虑分批处理")
        recommendations.append("✓ 使用多线程并行")

    if is_repeated:
        recommendations.append("✓ 缓存中间结果")
        recommendations.append("✓ 使用 WKB 序列化缓存")

    print(f"数据量: {n_geometries}, 查询数: {n_queries}")
    print("推荐优化策略:")
    for r in recommendations:
        print(f"  {r}")

# 示例
optimization_guide(50000, 1000, True)
```

---

## 常见性能瓶颈与解决方案

### 瓶颈1：大量小查询

```python
from shapely import STRtree, Point, box, contains
import numpy as np
import time

# 问题：逐个查询效率低
n = 10000
points = np.array([Point(i % 100, i // 100) for i in range(n)])
query_box = box(20, 20, 80, 80)

# 慢：逐个检查
start = time.perf_counter()
slow_result = [query_box.contains(p) for p in points]
time_slow = time.perf_counter() - start

# 快：向量化
start = time.perf_counter()
fast_result = contains(query_box, points)
time_fast = time.perf_counter() - start

print(f"逐个检查: {time_slow*1000:.1f} ms")
print(f"向量化: {time_fast*1000:.1f} ms")
print(f"加速比: {time_slow/time_fast:.1f}x")
```

### 瓶颈2：复杂几何体运算

```python
from shapely import Polygon, simplify, intersection
import math
import time

# 问题：顶点数过多导致运算缓慢
n_vertices = 5000
coords = [(10 * math.cos(2 * math.pi * i / n_vertices) + 5,
           10 * math.sin(2 * math.pi * i / n_vertices) + 5)
          for i in range(n_vertices)]
complex_poly = Polygon(coords)

simple_poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

# 慢：用复杂几何体计算
start = time.perf_counter()
result1 = intersection(complex_poly, simple_poly)
time_complex = time.perf_counter() - start

# 快：先简化再计算
simplified = simplify(complex_poly, tolerance=0.01)
start = time.perf_counter()
result2 = intersection(simplified, simple_poly)
time_simple = time.perf_counter() - start

print(f"复杂多边形 ({len(complex_poly.exterior.coords)} 顶点): {time_complex*1000:.1f} ms")
print(f"简化后 ({len(simplified.exterior.coords)} 顶点): {time_simple*1000:.1f} ms")
print(f"面积差异: {abs(result1.area - result2.area):.6f}")
```

### 瓶颈3：重复计算

```python
from shapely import Polygon, Point
from functools import lru_cache
import time

# 问题：相同几何体反复计算
polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

# 解决方案：缓存结果
# 注意：几何体不可直接作为 dict key
# 可以用 WKB 作为 key

from shapely import to_wkb

class SpatialCache:
    """空间查询缓存"""

    def __init__(self, geometry):
        self.geometry = geometry
        self._cache = {}
        from shapely import prepare
        prepare(self.geometry)

    def contains(self, point):
        key = to_wkb(point)
        if key not in self._cache:
            self._cache[key] = self.geometry.contains(point)
        return self._cache[key]

# 使用缓存
cache = SpatialCache(polygon)

# 模拟重复查询
test_points = [Point(5, 5), Point(15, 15), Point(5, 5), Point(15, 15)]
start = time.perf_counter()
for _ in range(1000):
    for p in test_points:
        cache.contains(p)
elapsed = time.perf_counter() - start
print(f"缓存查询 4000 次: {elapsed*1000:.1f} ms")
print(f"缓存大小: {len(cache._cache)} 条目")
```

### 瓶颈4：数据加载与传输

```python
from shapely import to_wkb, from_wkb, Polygon
import time

# 问题：大量几何体的序列化/反序列化开销
n = 10000
polygons = [Polygon([(i, i), (i+1, i), (i+1, i+1), (i, i+1)])
            for i in range(n)]

# 逐个序列化
start = time.perf_counter()
wkb_list = [to_wkb(p) for p in polygons]
time_serial = time.perf_counter() - start

# 批量序列化
import numpy as np
poly_array = np.array(polygons)
start = time.perf_counter()
wkb_batch = to_wkb(poly_array)
time_batch = time.perf_counter() - start

print(f"逐个序列化: {time_serial*1000:.1f} ms")
print(f"批量序列化: {time_batch*1000:.1f} ms")
print(f"加速比: {time_serial/time_batch:.1f}x")
```

---

## 综合性能优化示例

```python
from shapely import (
    STRtree, prepare, contains,
    Point, Polygon, box,
    points as create_points
)
import numpy as np
import time

def optimized_spatial_join(regions, points):
    """
    优化版空间连接：将点分配到区域

    使用了以下优化技术：
    1. STRtree 空间索引
    2. 批量查询
    3. NumPy 数组操作
    """
    # 构建区域索引
    region_tree = STRtree(regions)

    # 批量查询
    result = region_tree.query(points, predicate='intersects')

    # 转换为点→区域的映射
    # result[0] = 区域索引, result[1] = 点索引
    assignments = {}
    for i in range(result.shape[1]):
        point_idx = result[1][i]
        region_idx = result[0][i]
        if point_idx not in assignments:
            assignments[point_idx] = region_idx

    return assignments

# 测试
np.random.seed(42)
n_regions = 100
n_points = 50000

regions = [box(i % 10 * 10, i // 10 * 10,
               i % 10 * 10 + 10, i // 10 * 10 + 10)
           for i in range(n_regions)]

coords = np.column_stack([
    np.random.uniform(0, 100, n_points),
    np.random.uniform(0, 100, n_points)
])
pts = create_points(coords)

start = time.perf_counter()
result = optimized_spatial_join(np.array(regions), pts)
elapsed = time.perf_counter() - start

print(f"空间连接: {n_points} 点 × {n_regions} 区域")
print(f"耗时: {elapsed*1000:.1f} ms")
print(f"已分配: {len(result)} 点")
print(f"吞吐量: {n_points/elapsed:.0f} 点/秒")
```

---

## 小结

本章介绍了 Shapely 的性能优化完整方案：

**核心优化技术：**
- **Prepared Geometry**：预计算索引，加速重复的空间谓词查询
- **向量化操作**：使用 NumPy 数组和 ufunc，避免 Python 循环
- **STRtree 空间索引**：O(n log n) 查询，替代 O(n²) 暴力搜索
- **grid_size 精度网格**：降低精度换取性能

**并行化技术：**
- GEOS 自动释放 GIL，支持多线程
- 使用 WKB 序列化在多进程间传递几何体

**最佳实践：**
1. 优先使用向量化操作
2. 大数据集必用 STRtree
3. 批量创建几何体
4. 合理简化复杂几何
5. 缓存重复计算结果
6. 分批处理超大数据

掌握这些优化技术，可以让你的空间分析程序从"能跑"变成"跑得快"，从处理千级数据到处理百万级数据。

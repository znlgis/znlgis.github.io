---
layout: default
title: "第19章：Shapely 2.0 迁移指南"
---

# 第19章：Shapely 2.0 迁移指南

> 本章详细介绍从 Shapely 1.x 迁移到 Shapely 2.0+ 的完整指南，包括重大变更、新增功能、迁移步骤和常见问题解决方案。Shapely 2.0 是一个重大版本更新，引入了不可变几何体、向量化操作和 NumPy 原生集成等核心变化。

---

## 19.1 Shapely 2.0 设计目标

Shapely 2.0 的核心设计目标包括：

- **性能提升**：通过 GEOS C API 直接调用和 GIL 释放实现显著加速
- **NumPy 原生集成**：几何体可作为 NumPy 数组元素，支持向量化操作
- **不可变性**：几何体不可变且可哈希，适合作为字典键和集合元素
- **API 现代化**：更清晰的模块组织和命名约定
- **多线程支持**：GEOS 操作自动释放 GIL，支持真正的并行计算

---

## 19.2 重大变更（Breaking Changes）

### 19.2.1 几何对象不可变性

**Shapely 1.x**（可变）：

```python
# ❌ Shapely 2.0 中不再支持
from shapely.geometry import Point

p = Point(0, 0)
# p.coords = [(1, 1)]  # Shapely 1.x 允许，2.0 报错
```

**Shapely 2.0**（不可变）：

```python
from shapely import Point

p = Point(0, 0)
# 创建新对象而非修改原对象
p_new = Point(1, 1)

# 不可变的好处：可哈希
point_set = {Point(0, 0), Point(1, 1), Point(0, 0)}
print(f"集合大小: {len(point_set)}")  # 2（去重）

# 可用作字典键
distances = {Point(0, 0): 0.0, Point(1, 1): 1.414}
print(distances[Point(0, 0)])  # 0.0
```

### 19.2.2 Multi* 几何体迭代方式

**Shapely 1.x**：

```python
# ❌ Shapely 2.0 中已弃用
from shapely.geometry import MultiPoint

mp = MultiPoint([(0, 0), (1, 1), (2, 2)])
# for point in mp:  # 1.x 允许直接迭代
#     print(point)
```

**Shapely 2.0**：

```python
from shapely import MultiPoint

mp = MultiPoint([(0, 0), (1, 1), (2, 2)])

# ✅ 使用 .geoms 属性迭代
for point in mp.geoms:
    print(point)

# ✅ 获取长度
print(f"点数: {len(mp.geoms)}")

# ✅ 索引访问
first = mp.geoms[0]
print(f"第一个点: {first}")
```

### 19.2.3 数组接口移除

**Shapely 1.x**：

```python
import numpy as np
# from shapely.geometry import Point
# p = Point(0, 0)
# arr = np.asarray(p)  # 1.x 返回坐标数组
```

**Shapely 2.0**：

```python
import numpy as np
from shapely import Point, get_coordinates

p = Point(1, 2)

# ✅ 使用 get_coordinates 获取坐标
coords = get_coordinates(p)
print(coords)  # [[1. 2.]]

# ✅ 使用 .coords 获取坐标
print(list(p.coords))  # [(1.0, 2.0)]

# ✅ NumPy 数组中存储几何体（作为对象）
geom_array = np.array([Point(0, 0), Point(1, 1)])
print(geom_array.dtype)  # object
```

### 19.2.4 禁止自定义属性

**Shapely 1.x**：

```python
# ❌ Shapely 2.0 中不再支持
# from shapely.geometry import Point
# p = Point(0, 0)
# p.name = "origin"  # 1.x 允许
```

**Shapely 2.0**：

```python
from shapely import Point

p = Point(0, 0)
# p.name = "origin"  # ❌ 报错：AttributeError

# ✅ 使用外部数据结构
metadata = {id(p): {"name": "origin", "type": "control_point"}}

# ✅ 使用 dataclass 或 namedtuple
from dataclasses import dataclass

@dataclass
class GeoFeature:
    geometry: object
    name: str
    properties: dict

feature = GeoFeature(
    geometry=Point(0, 0),
    name="origin",
    properties={"type": "control_point"}
)
```

### 19.2.5 空几何体一致性

**Shapely 1.x**：

```python
# 不同方式创建的空几何体行为不一致
# Polygon() 可能返回 GeometryCollection EMPTY
```

**Shapely 2.0**：

```python
from shapely import Point, LineString, Polygon, MultiPoint

# 所有空几何体类型一致
empty_point = Point()
empty_line = LineString()
empty_poly = Polygon()
empty_multi = MultiPoint()

print(f"空点: {empty_point.is_empty}, 类型: {empty_point.geom_type}")
print(f"空线: {empty_line.is_empty}, 类型: {empty_line.geom_type}")
print(f"空面: {empty_poly.is_empty}, 类型: {empty_poly.geom_type}")
print(f"空多点: {empty_multi.is_empty}, 类型: {empty_multi.geom_type}")
```

### 19.2.6 .type 属性弃用

```python
from shapely import Point

p = Point(0, 0)

# ❌ 弃用
# print(p.type)  # 会产生 DeprecationWarning

# ✅ 使用 geom_type
print(p.geom_type)  # "Point"
```

### 19.2.7 弃用的函数和类

以下在 Shapely 1.x 中的函数/类在 2.0 中已弃用或移除：

| 弃用/移除 | 替代方案 |
|-----------|---------|
| `asShape()` | `shape()` |
| `asMultiPoint()` | `MultiPoint()` |
| `asLineString()` | `LineString()` |
| `shapely.geometry.base.BaseGeometry.type` | `.geom_type` |
| `shapely.geometry.base.BaseGeometry.array_interface()` | `get_coordinates()` |
| `shapely.ops.cascaded_union()` | `shapely.union_all()` |
| `shapely.affinity.interpret_origin()` | 内部使用 |

---

## 19.3 新增功能

### 19.3.1 向量化操作（ufunc 风格）

Shapely 2.0 最重要的新功能是支持对几何体数组的向量化操作：

```python
import numpy as np
import shapely
from shapely import Point, box

# 创建几何体数组
points = np.array([Point(i, i) for i in range(5)])
target = box(1, 1, 3, 3)

# 向量化谓词测试
results = shapely.contains(target, points)
print(f"包含结果: {results}")
# [False  True  True  True False]

# 向量化缓冲区
buffers = shapely.buffer(points, 0.5)
areas = shapely.area(buffers)
print(f"缓冲区面积: {areas}")

# 向量化距离计算
distances = shapely.distance(points, Point(2, 2))
print(f"距离: {distances}")
```

### 19.3.2 新的模块组织

Shapely 2.0 引入了更清晰的模块组织：

```python
# 创建模块
from shapely import points, linestrings, polygons, box

# 谓词模块（函数形式）
import shapely
shapely.contains(geom_a, geom_b)
shapely.intersects(geom_a, geom_b)

# 集合运算
shapely.union(geom_a, geom_b)
shapely.intersection(geom_a, geom_b)
shapely.difference(geom_a, geom_b)

# 构造操作
shapely.buffer(geom, distance)
shapely.convex_hull(geom)
shapely.simplify(geom, tolerance)

# 度量
shapely.area(geom)
shapely.length(geom)
shapely.distance(geom_a, geom_b)

# I/O
shapely.to_wkt(geom)
shapely.to_wkb(geom)
shapely.from_wkt(wkt_string)
shapely.from_wkb(wkb_bytes)
```

### 19.3.3 GIL 释放与多线程

```python
import numpy as np
import shapely
from shapely import Point
from concurrent.futures import ThreadPoolExecutor
import time

# 创建大量几何体
n = 100000
points_array = np.array([Point(np.random.random(), np.random.random()) for _ in range(n)])
target = Point(0.5, 0.5).buffer(0.3)

# 单线程
start = time.time()
result = shapely.contains(target, points_array)
single_time = time.time() - start
print(f"单线程: {single_time:.4f}s, 包含 {result.sum()} 个点")

# 多线程（GEOS 操作自动释放 GIL）
def contains_chunk(chunk):
    return shapely.contains(target, chunk)

chunks = np.array_split(points_array, 4)

start = time.time()
with ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(contains_chunk, chunks))
multi_time = time.time() - start
total = sum(r.sum() for r in results)
print(f"多线程: {multi_time:.4f}s, 包含 {total} 个点")
```

### 19.3.4 新的 STRtree API

```python
import numpy as np
from shapely import STRtree, Point, box

# Shapely 2.0 的 STRtree
points = [Point(i, j) for i in range(10) for j in range(10)]
tree = STRtree(points)

# 使用谓词查询
query_box = box(2, 2, 5, 5)
indices = tree.query(query_box, predicate='contains')
print(f"包含的点数: {len(indices)}")

# 最近邻查询
nearest_idx = tree.nearest(Point(3.5, 3.5))
print(f"最近邻: {points[nearest_idx]}")
```

---

## 19.4 Shapely 2.1 新特性

### 19.4.1 M 坐标支持

```python
from shapely import Point

# Shapely 2.1+ 支持 M（度量值）坐标
# p = Point(1, 2, z=3, m=4)  # X, Y, Z, M
# print(f"has_m: {p.has_m}")
```

### 19.4.2 Coverage 操作

```python
import shapely
from shapely import Polygon

# 覆盖并集（要求不重叠）
poly1 = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
poly2 = Polygon([(1, 0), (2, 0), (2, 1), (1, 1)])

# coverage_union 比 union 更快（不重叠时）
result = shapely.coverage_union(poly1, poly2)
print(f"覆盖并集: {result.geom_type}")
```

### 19.4.3 concave_hull

```python
from shapely import concave_hull, MultiPoint

points = MultiPoint([(0, 0), (1, 0), (2, 0.5), (1, 1), (0, 1), (0.5, 0.5)])

# 凹包（ratio 控制凹度，0=最凹，1=凸包）
hull = concave_hull(points, ratio=0.3)
print(f"凹包: {hull}")
print(f"面积: {hull.area:.4f}")

# 对比凸包
from shapely import convex_hull
cvx = convex_hull(points)
print(f"凸包面积: {cvx.area:.4f}")
```

---

## 19.5 Shapely 2.2+ 改进

### 19.5.1 性能提升

Shapely 2.2 带来了显著的性能改进：

| 操作 | Shapely 2.0 | Shapely 2.2 | 提升 |
|------|------------|------------|------|
| 属性访问 | 2.6 μs | 0.2 μs | 13x |
| 函数调用开销 | ~200 ns | ~75 ns | 2.7x |
| GEOS 上下文 | 每次创建 | 复用 | 显著 |

### 19.5.2 get_segments

```python
# Shapely 2.2+ 新增
# from shapely import get_segments, LineString
#
# line = LineString([(0, 0), (1, 0), (1, 1), (0, 1)])
# segments = get_segments(line)
# for seg in segments:
#     print(f"线段: {seg}")
```

---

## 19.6 迁移步骤指南

### 19.6.1 第一步：检测兼容性问题

```python
# 开启所有弃用警告
import warnings
warnings.filterwarnings('always', category=DeprecationWarning, module='shapely')

# 运行现有代码，观察警告信息
```

### 19.6.2 第二步：更新导入语句

```python
# 旧方式
# from shapely.geometry import Point, LineString, Polygon
# from shapely.geometry import MultiPoint, MultiLineString, MultiPolygon

# 新方式（Shapely 2.0+，两种都可以）
from shapely import Point, LineString, Polygon
from shapely import MultiPoint, MultiLineString, MultiPolygon

# 旧方式的导入仍然有效，但推荐新方式
```

### 19.6.3 第三步：修复不可变性相关代码

```python
from shapely import LineString, set_coordinates, get_coordinates

line = LineString([(0, 0), (1, 1), (2, 0)])

# ❌ 不能直接修改坐标
# line.coords = [(0, 0), (1, 2), (2, 0)]

# ✅ 创建新几何体
new_line = LineString([(0, 0), (1, 2), (2, 0)])

# ✅ 使用 set_coordinates
import numpy as np
coords = get_coordinates(line)
coords[1, 1] = 2  # 修改第二个点的 Y 坐标
new_line = set_coordinates(line, coords)
```

### 19.6.4 第四步：更新迭代方式

```python
from shapely import MultiPolygon, Polygon

mp = MultiPolygon([
    Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
    Polygon([(2, 0), (3, 0), (3, 1), (2, 1)]),
])

# ❌ 旧方式
# for poly in mp:
#     print(poly.area)

# ✅ 新方式
for poly in mp.geoms:
    print(poly.area)

# ✅ 列表推导
areas = [p.area for p in mp.geoms]
print(f"面积列表: {areas}")
```

### 19.6.5 第五步：利用向量化操作

```python
import numpy as np
import shapely
from shapely import Point

# ❌ 旧方式（Python 循环）
points = [Point(i, i) for i in range(100)]
areas_old = [p.buffer(1).area for p in points]

# ✅ 新方式（向量化）
points_array = np.array(points)
buffers = shapely.buffer(points_array, 1.0)
areas_new = shapely.area(buffers)

# 向量化版本通常快 10-100 倍
```

---

## 19.7 1.x 与 2.x API 对照表

| 功能 | Shapely 1.x | Shapely 2.0+ |
|------|------------|-------------|
| 创建点 | `Point(0, 0)` | `Point(0, 0)` ✅ |
| 修改坐标 | `geom.coords = [...]` | `set_coordinates(geom, coords)` |
| 迭代 Multi | `for g in multi:` | `for g in multi.geoms:` |
| 类型属性 | `geom.type` | `geom.geom_type` |
| 设置属性 | `geom.name = "x"` | 使用外部数据结构 |
| 并集 | `cascaded_union(geoms)` | `shapely.union_all(geoms)` |
| 数组接口 | `np.asarray(geom)` | `get_coordinates(geom)` |
| asShape | `asShape(dict)` | `shape(dict)` |
| STRtree | `tree.query(geom)` | `tree.query(geom, predicate=...)` |
| transform | `shapely.ops.transform(func, geom)` | `shapely.transform(geom, func)` |
| 准备几何 | `prep(geom)` 返回 PreparedGeometry | `shapely.prepare(geom)` 原地准备 |
| WKT 输出 | `geom.wkt` | `geom.wkt` 或 `shapely.to_wkt(geom)` |

---

## 19.8 常见迁移问题

### 19.8.1 TypeError: 'MultiPolygon' object is not iterable

```python
from shapely import MultiPolygon, Polygon

mp = MultiPolygon([
    Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
    Polygon([(2, 0), (3, 0), (3, 1), (2, 1)]),
])

# ❌ 报错
# list(mp)

# ✅ 修复
list(mp.geoms)
```

### 19.8.2 AttributeError: can't set attribute

```python
from shapely import Point

p = Point(0, 0)

# ❌ 报错
# p.label = "test"

# ✅ 修复：使用字典或数据类
from dataclasses import dataclass

@dataclass
class LabeledPoint:
    point: Point
    label: str

lp = LabeledPoint(point=p, label="test")
```

### 19.8.3 DeprecationWarning: __len__

```python
from shapely import Polygon

poly = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])

# ❌ 弃用
# len(poly)  # DeprecationWarning

# ✅ 获取坐标数量
from shapely import get_num_coordinates
print(get_num_coordinates(poly))
```

---

## 19.9 本章小结

Shapely 2.0 迁移的核心要点：

1. **不可变性**：几何体不可修改，使用函数创建新几何体
2. **迭代方式**：使用 `.geoms` 属性迭代 Multi* 几何体
3. **向量化**：优先使用 `shapely.xxx()` 函数式 API 处理数组
4. **模块组织**：新增 `shapely.creation`、`shapely.predicates` 等模块
5. **性能提升**：GIL 释放、GEOS 上下文复用、减少函数调用开销

迁移建议：
- 开启弃用警告逐步发现问题
- 先修复破坏性变更，再逐步利用新功能
- 优先将循环操作转为向量化操作以获得性能提升
- 参考官方迁移文档获取最新信息

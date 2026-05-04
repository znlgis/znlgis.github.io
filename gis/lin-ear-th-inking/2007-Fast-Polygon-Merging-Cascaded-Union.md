---
layout: default
title: JTS 中使用级联并集快速合并多边形
---

# JTS 中使用级联并集快速合并多边形

> 原文：[Fast polygon merging in JTS using Cascaded Union](https://lin-ear-th-inking.blogspot.com/2007/11/fast-polygon-merging-in-jts-using.html)
> 作者：Martin Davis
> 日期：2007年11月

## 概述

级联并集（Cascaded Union）是 JTS 2007 年引入的一种高效多边形合并算法。该方法通过空间索引和递归合并策略，显著提高了大量多边形并集操作的性能，成为空间库中的标准优化技术。

## 传统方法的问题

### 迭代并集

传统的多边形合并方法是逐个将多边形与当前结果进行并集：

```java
// 传统的迭代并集方法（慢）
Geometry result = polygons.get(0);
for (int i = 1; i < polygons.size(); i++) {
    result = result.union(polygons.get(i));
}
```

**问题：**
- 每次迭代都需要处理越来越大的结果几何图形
- 顶点数量累积增长
- 时间复杂度接近 O(n²)

### 性能瓶颈

对于 n 个重叠的多边形：
- 传统方法可能需要处理大量中间几何图形
- 每次并集操作的复杂度随结果大小增加
- 对于大数据集，性能可能比优化方法慢一个数量级

## 级联并集算法

### 核心思想

级联并集通过以下策略优化合并过程：

1. **空间索引**：使用 R 树或类似结构索引多边形
2. **递归合并**：以分治方式两两合并
3. **早期简化**：在早期阶段减少顶点和拓扑复杂度

### 算法流程

```
步骤 1: 空间索引所有多边形
步骤 2: 两两配对合并
步骤 3: 对合并结果递归应用步骤 2
步骤 4: 直到只剩一个结果几何图形
```

```text
原始多边形:  [P1] [P2] [P3] [P4] [P5] [P6] [P7] [P8]
              \   /     \   /     \   /     \   /
第一轮合并:   [U1]      [U2]      [U3]      [U4]
                 \       /           \       /
第二轮合并:      [U5]                [U6]
                      \           /
最终结果:              [结果]
```

## JTS 实现

### CascadedPolygonUnion 类

```java
import org.locationtech.jts.operation.union.CascadedPolygonUnion;
import org.locationtech.jts.geom.Geometry;
import java.util.Collection;

// 多边形集合
Collection<Geometry> polygons = ...;

// 使用级联并集
Geometry result = CascadedPolygonUnion.union(polygons);
```

### 静态方法调用

```java
import org.locationtech.jts.operation.union.CascadedPolygonUnion;

// 直接使用静态方法
List<Polygon> polygonList = new ArrayList<>();
polygonList.add(polygon1);
polygonList.add(polygon2);
polygonList.add(polygon3);
// ... 添加更多多边形

Geometry unionResult = CascadedPolygonUnion.union(polygonList);
```

### 完整示例

```java
import org.locationtech.jts.geom.*;
import org.locationtech.jts.operation.union.CascadedPolygonUnion;
import org.locationtech.jts.io.WKTReader;
import java.util.*;

public class CascadedUnionExample {
    public static void main(String[] args) throws Exception {
        GeometryFactory factory = new GeometryFactory();
        WKTReader reader = new WKTReader(factory);
        
        // 创建多个重叠的多边形
        List<Geometry> polygons = new ArrayList<>();
        
        polygons.add(reader.read(
            "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))"));
        polygons.add(reader.read(
            "POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))"));
        polygons.add(reader.read(
            "POLYGON ((10 0, 20 0, 20 10, 10 10, 10 0))"));
        polygons.add(reader.read(
            "POLYGON ((15 5, 25 5, 25 15, 15 15, 15 5))"));
        
        // 方法 1: 级联并集（推荐）
        long startTime = System.currentTimeMillis();
        Geometry cascadedResult = CascadedPolygonUnion.union(polygons);
        long cascadedTime = System.currentTimeMillis() - startTime;
        
        System.out.println("级联并集结果: " + cascadedResult);
        System.out.println("级联并集耗时: " + cascadedTime + " ms");
        
        // 方法 2: 迭代并集（对比）
        startTime = System.currentTimeMillis();
        Geometry iterativeResult = polygons.get(0);
        for (int i = 1; i < polygons.size(); i++) {
            iterativeResult = iterativeResult.union(polygons.get(i));
        }
        long iterativeTime = System.currentTimeMillis() - startTime;
        
        System.out.println("迭代并集结果: " + iterativeResult);
        System.out.println("迭代并集耗时: " + iterativeTime + " ms");
    }
}
```

## 为什么级联并集更快？

### 早期重叠消除

在合并过程的早期阶段，重叠区域被消除，减少了后续操作的复杂度：

```
原始多边形顶点总数: 1000
第一轮合并后顶点: 600  (减少 40%)
第二轮合并后顶点: 400  (减少 33%)
最终结果顶点: 300     (减少 25%)
```

### 空间局部性

通过空间索引，相邻的多边形优先合并：
- 重叠更可能发生在相邻多边形之间
- 早期合并相邻多边形可以最大化重叠消除
- 减少不必要的几何操作

### 时间复杂度改进

| 方法 | 最佳情况 | 最坏情况 |
|------|---------|---------|
| 迭代并集 | O(n²) | O(n³) |
| 级联并集 | O(n log n) | O(n²) |

## 与 buffer(0) 的比较

一些开发者使用 `buffer(0)` 来"修复"或简化几何图形：

```java
// 不推荐的方法
Geometry combined = geometryCollection.buffer(0);
```

**为什么级联并集更好：**
- 级联并集专为多边形合并优化
- buffer(0) 是通用操作，效率较低
- 级联并集保证正确的拓扑结构
- 级联并集在大数据集上性能更好

## 在其他库中的实现

### GEOS (C++)

```cpp
#include <geos/operation/union/CascadedPolygonUnion.h>

// GEOS 中的级联并集
std::unique_ptr<Geometry> result = 
    CascadedPolygonUnion::Union(&polygons);
```

### PostGIS

```sql
-- PostGIS 自动使用级联并集优化
SELECT ST_Union(geom) FROM polygons;

-- 或明确使用集合并集
SELECT ST_UnaryUnion(ST_Collect(geom)) FROM polygons;
```

### Shapely (Python)

```python
from shapely.ops import unary_union

# Shapely 的 unary_union 使用级联策略
result = unary_union(polygon_list)
```

## 使用建议

### 何时使用级联并集

1. **大量多边形**：当需要合并数百或数千个多边形时
2. **重叠数据**：多边形之间有大量重叠
3. **批量处理**：一次性处理所有多边形

### 何时使用简单并集

1. **少量多边形**：只有几个多边形需要合并
2. **无重叠**：多边形不重叠或很少重叠
3. **增量更新**：需要逐步添加多边形

## 性能基准测试

```java
public class UnionBenchmark {
    public static void benchmark(int numPolygons) {
        List<Geometry> polygons = generateRandomPolygons(numPolygons);
        
        // 级联并集
        long start = System.nanoTime();
        CascadedPolygonUnion.union(polygons);
        long cascadedTime = System.nanoTime() - start;
        
        // 迭代并集
        start = System.nanoTime();
        Geometry result = polygons.get(0);
        for (int i = 1; i < polygons.size(); i++) {
            result = result.union(polygons.get(i));
        }
        long iterativeTime = System.nanoTime() - start;
        
        System.out.printf("多边形数量: %d%n", numPolygons);
        System.out.printf("级联并集: %.2f ms%n", cascadedTime / 1e6);
        System.out.printf("迭代并集: %.2f ms%n", iterativeTime / 1e6);
        System.out.printf("速度提升: %.1fx%n", 
            (double) iterativeTime / cascadedTime);
    }
}
```

## 总结

级联并集是 JTS 中用于合并多边形的标准高效算法。它通过空间索引和分治策略，显著提高了多边形并集操作的性能。对于需要合并大量多边形的应用场景，级联并集是首选方法。

## 参考资料

- [CascadedPolygonUnion JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/union/CascadedPolygonUnion.html)
- [GEOS CascadedPolygonUnion](https://libgeos.org/doxygen/classgeos_1_1operation_1_1geounion_1_1CascadedPolygonUnion.html)
- [PostGIS ST_Union](https://postgis.net/docs/ST_Union.html)

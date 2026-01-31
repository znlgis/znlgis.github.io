---
layout: post
title: "几何裁剪大赛与 PreparedGeometry 性能优化"
date: 2029-07-15 10:00:00 +0800
categories: [GIS, JTS]
tags: [JTS]
---

# 几何裁剪大赛与 PreparedGeometry 性能优化

> 原文：[The Great Geometry Clipping Contest](https://lin-ear-th-inking.blogspot.com/2012/11/the-great-geometry-clipping-contest.html)
> 作者：Martin Davis
> 日期：2012年11月

## 概述

2012 年的"几何裁剪大赛"展示了 JTS PreparedGeometry API 在空间谓词操作中的显著性能优势。本文介绍 PreparedGeometry 的工作原理、使用方法以及它如何通过缓存拓扑结构来加速重复的空间查询。

## PreparedGeometry 简介

### 什么是 PreparedGeometry？

PreparedGeometry 是 JTS 提供的优化类，通过预计算和缓存几何图形的拓扑结构，加速重复的空间谓词测试。

### 为什么需要它？

在空间分析中，经常需要对同一个几何图形进行多次空间关系测试：

```java
// 普通方式：每次调用都重新计算拓扑
for (Geometry testGeom : testGeometries) {
    if (targetPolygon.intersects(testGeom)) {  // 每次都重新计算
        // 处理相交的几何
    }
}

// 使用 PreparedGeometry：只计算一次，多次复用
PreparedGeometry preparedTarget = PreparedGeometryFactory.prepare(targetPolygon);
for (Geometry testGeom : testGeometries) {
    if (preparedTarget.intersects(testGeom)) {  // 使用缓存的拓扑
        // 处理相交的几何
    }
}
```

## PreparedGeometry API

### 创建 PreparedGeometry

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.prep.PreparedGeometry;
import org.locationtech.jts.geom.prep.PreparedGeometryFactory;

public class PreparedGeometryExample {
    public static void main(String[] args) {
        Geometry polygon = ...;  // 原始几何图形
        
        // 方法1：使用工厂类
        PreparedGeometry prepared = PreparedGeometryFactory.prepare(polygon);
        
        // 方法2：使用静态方法
        prepared = PreparedGeometryFactory.prepare(polygon);
    }
}
```

### 支持的谓词操作

PreparedGeometry 支持以下空间谓词：

```java
PreparedGeometry prepared = PreparedGeometryFactory.prepare(polygon);
Geometry testGeom = ...;

// 相交测试
boolean intersects = prepared.intersects(testGeom);

// 包含测试
boolean contains = prepared.contains(testGeom);

// 完全包含测试
boolean containsProperly = prepared.containsProperly(testGeom);

// 覆盖测试
boolean covers = prepared.covers(testGeom);

// 被覆盖测试
boolean coveredBy = prepared.coveredBy(testGeom);

// 交叉测试
boolean crosses = prepared.crosses(testGeom);

// 不相交测试
boolean disjoint = prepared.disjoint(testGeom);

// 接触测试
boolean touches = prepared.touches(testGeom);

// 内部测试
boolean within = prepared.within(testGeom);
```

## 性能比较

### 基准测试场景

几何裁剪大赛的测试场景：

1. **目标几何**：一个复杂的多边形（数千个顶点）
2. **测试几何**：大量的点或小多边形
3. **操作**：对每个测试几何执行 `intersects` 检查

### 测试代码

```java
public class PreparedGeometryBenchmark {
    
    public static void benchmarkRegular(Geometry target, List<Geometry> tests) {
        long startTime = System.currentTimeMillis();
        
        int count = 0;
        for (Geometry test : tests) {
            if (target.intersects(test)) {
                count++;
            }
        }
        
        long endTime = System.currentTimeMillis();
        System.out.printf("普通方式: %d ms, 相交数: %d%n", 
            (endTime - startTime), count);
    }
    
    public static void benchmarkPrepared(Geometry target, List<Geometry> tests) {
        long startTime = System.currentTimeMillis();
        
        // 准备阶段
        PreparedGeometry prepared = PreparedGeometryFactory.prepare(target);
        
        int count = 0;
        for (Geometry test : tests) {
            if (prepared.intersects(test)) {
                count++;
            }
        }
        
        long endTime = System.currentTimeMillis();
        System.out.printf("PreparedGeometry: %d ms, 相交数: %d%n", 
            (endTime - startTime), count);
    }
}
```

### 性能结果

| 测试规模 | 普通方式 | PreparedGeometry | 加速比 |
|---------|---------|------------------|--------|
| 1,000 点 | 500 ms | 50 ms | 10x |
| 10,000 点 | 5,000 ms | 100 ms | 50x |
| 100,000 点 | 50,000 ms | 500 ms | 100x |

**关键发现**：
- 测试次数越多，PreparedGeometry 的优势越明显
- 目标几何越复杂，加速效果越好
- 准备阶段有一次性开销，但在多次测试中可以忽略

## 工作原理

### 拓扑缓存

PreparedGeometry 通过预计算以下内容来加速查询：

1. **边界索引**：对多边形边界建立空间索引
2. **点位置缓存**：预计算点与环的位置关系
3. **边界框**：快速过滤明显不相交的几何

```
原始几何 → PreparedGeometry
              ↓
        +-----------------------+
        | 边界索引 (STRtree)    |
        | 点位置缓存            |
        | 边界框               |
        +-----------------------+
              ↓
        快速空间谓词测试
```

### 为什么 Polygon/Polygon 最受益？

多边形与多边形的操作最计算密集：

1. **边相交检测**：需要检查所有边对
2. **点包含测试**：需要射线法或缠绕数算法
3. **拓扑分析**：需要构建完整的拓扑图

PreparedGeometry 通过缓存这些中间结果，避免重复计算。

## 线程安全性

PreparedGeometry 是**线程安全的**：

```java
// PreparedGeometry 可以在多线程环境中安全使用
PreparedGeometry prepared = PreparedGeometryFactory.prepare(polygon);

// 多线程并行测试
List<Geometry> results = tests.parallelStream()
    .filter(test -> prepared.intersects(test))
    .collect(Collectors.toList());
```

这使得 PreparedGeometry 非常适合并行空间处理。

## 使用建议

### 何时使用 PreparedGeometry

1. **多次测试同一几何**：当需要对同一个几何进行多次空间谓词测试时
2. **复杂几何**：当目标几何有大量顶点时
3. **批量处理**：当需要处理大量测试几何时

### 何时不需要

1. **单次测试**：只进行一次空间测试
2. **简单几何**：目标几何只有几个顶点
3. **频繁变化**：目标几何频繁变化

### 代码模式

```java
public class SpatialQueryOptimizer {
    private Map<Geometry, PreparedGeometry> cache = new HashMap<>();
    
    /**
     * 获取或创建 PreparedGeometry
     */
    public PreparedGeometry getPrepared(Geometry geom) {
        return cache.computeIfAbsent(geom, 
            PreparedGeometryFactory::prepare);
    }
    
    /**
     * 批量空间查询
     */
    public List<Geometry> spatialQuery(
            Geometry target, 
            List<Geometry> candidates,
            SpatialPredicate predicate) {
        
        PreparedGeometry prepared = getPrepared(target);
        
        return candidates.stream()
            .filter(c -> predicate.test(prepared, c))
            .collect(Collectors.toList());
    }
}

@FunctionalInterface
interface SpatialPredicate {
    boolean test(PreparedGeometry prepared, Geometry test);
}
```

## 在其他库中的实现

PreparedGeometry 概念已被移植到多个库：

| 库 | 实现 |
|---|-----|
| GEOS | `GEOSPrepare()` |
| Shapely | `prepared.prep()` |
| PostGIS | 隐式使用 |
| GeoRust | `PreparedGeometry` |

### Shapely 示例

```python
from shapely.geometry import Polygon
from shapely.prepared import prep

polygon = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
prepared = prep(polygon)

for point in test_points:
    if prepared.intersects(point):
        # 处理相交的点
        pass
```

## 总结

PreparedGeometry 是 JTS 中用于优化空间谓词性能的关键工具：

1. **预计算拓扑**：一次准备，多次使用
2. **显著加速**：10-100 倍的性能提升
3. **线程安全**：适合并行处理
4. **广泛支持**：已在多个空间库中实现

对于需要进行大量空间查询的应用，PreparedGeometry 是不可或缺的优化手段。

## 参考资料

- [PreparedGeometry JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/geom/prep/PreparedGeometry.html)
- [GEOS Prepared Geometry](https://libgeos.org/doxygen/classgeos_1_1geom_1_1prep_1_1PreparedGeometry.html)
- [Shapely Prepared Geometry](https://shapely.readthedocs.io/en/stable/manual.html#prepared-geometry-operations)
- [GeoTools DE-9IM 文档](https://docs.geotools.org/maintenance/userguide/library/jts/dim9.html)

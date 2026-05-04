---
layout: default
title: 多边形的外部和内部包络（Outer and Inner Polygon Hulls）
---

# 多边形的外部和内部包络（Outer and Inner Polygon Hulls）

> 原文：[Outer and Inner Polygon Hulls in JTS](https://lin-ear-th-inking.blogspot.com/2022/04/)
> 作者：Martin Davis
> 日期：2022年4月

## 概述

JTS 2022 年版本引入了计算多边形凹包（Concave Hull）的新功能，包括外部包络（Outer Hull）和内部包络（Inner Hull）的概念。这些功能为简化几何图形和生成更紧凑的边界提供了新的工具。

## 凹包的概念

### 凸包 vs 凹包

- **凸包（Convex Hull）**：包围一组点或几何图形的最小凸多边形
- **凹包（Concave Hull）**：可以有凹陷的包围边界，更紧密地贴合原始形状

### 外部包络 vs 内部包络

- **外部包络（Outer Hull）**：在多边形外部形成的简化边界
- **内部包络（Inner Hull）**：在多边形内部形成的简化边界

## 外部包络（Outer Hull）

外部包络是多边形的简化外边界，它：
- 完全包含原始多边形
- 比凸包更紧密贴合原始形状
- 可以通过参数控制简化程度

### 应用场景

1. **边界简化**：减少多边形顶点数量
2. **缓冲区优化**：生成更紧凑的缓冲区
3. **地图概括**：用于不同比例尺的地图表示

### 代码示例

```java
import org.locationtech.jts.algorithm.hull.ConcaveHull;
import org.locationtech.jts.geom.Geometry;

Geometry polygon = ...;

// 计算外部凹包
// lengthRatio 控制简化程度（0-1之间）
// 值越小，包络越紧凑
double lengthRatio = 0.3;
Geometry outerHull = ConcaveHull.concaveHullByLengthRatio(polygon, lengthRatio);
```

## 内部包络（Inner Hull）

内部包络是多边形的简化内边界，它：
- 完全包含在原始多边形内部
- 可用于确定多边形的"核心区域"
- 在保持一定面积的同时简化形状

### 应用场景

1. **核心区域提取**：识别多边形的主要区域
2. **标签放置**：确定标签的最佳位置
3. **内部空间分析**：分析多边形内部的可用空间

### 代码示例

```java
import org.locationtech.jts.algorithm.hull.ConcaveHull;
import org.locationtech.jts.geom.Geometry;

Geometry polygon = ...;

// 计算内部凹包
// 使用负的距离参数表示内部包络
double maxEdgeLength = 50.0;
Geometry innerHull = ConcaveHull.concaveHullByLength(polygon, maxEdgeLength, true);
```

## 参数控制

### 边长控制

通过最大边长参数控制包络的粗糙程度：

```java
// 较小的边长 → 更精细的包络（更多顶点）
Geometry fineHull = ConcaveHull.concaveHullByLength(polygon, 10.0);

// 较大的边长 → 更粗糙的包络（更少顶点）
Geometry coarseHull = ConcaveHull.concaveHullByLength(polygon, 100.0);
```

### 比率控制

通过比率参数控制（相对于原始几何的大小）：

```java
// 比率 0.1 → 非常紧凑的包络
// 比率 1.0 → 凸包
double ratio = 0.3;
Geometry hull = ConcaveHull.concaveHullByLengthRatio(polygon, ratio);
```

### 允许孔洞

可以指定是否允许包络包含孔洞：

```java
// 不允许孔洞
Geometry solidHull = ConcaveHull.concaveHullByLength(polygon, maxLength, false);

// 允许孔洞
Geometry hullWithHoles = ConcaveHull.concaveHullByLength(polygon, maxLength, true);
```

## 算法原理

### 外部包络算法

1. 从凸包开始
2. 逐步向内"侵蚀"边界
3. 移除满足条件的三角形
4. 直到达到指定的参数阈值

### 内部包络算法

1. 从原始多边形开始
2. 通过三角剖分识别内部区域
3. 移除边界处的三角形
4. 生成简化的内部边界

## 与最大内切圆的关系

内部包络和最大内切圆（Maximum Inscribed Circle）提供了互补的功能：

- **最大内切圆**：找到多边形内最大的圆形区域
- **内部包络**：找到多边形内的简化多边形区域

```java
import org.locationtech.jts.algorithm.construct.MaximumInscribedCircle;

// 最大内切圆
Point center = MaximumInscribedCircle.getCenter(polygon, 0.001);
LineString radiusLine = MaximumInscribedCircle.getRadiusLine(polygon, 0.001);
double maxRadius = radiusLine.getLength();

// 内部包络
Geometry innerHull = ConcaveHull.concaveHullByLength(polygon, maxLength, true);
```

## 实际应用示例

### 区域简化

```java
public Geometry simplifyRegion(Geometry region, double targetVertexCount) {
    // 估算边长比率
    double currentVertices = region.getNumPoints();
    double ratio = Math.min(1.0, targetVertexCount / currentVertices);
    
    // 计算外部包络
    return ConcaveHull.concaveHullByLengthRatio(region, ratio);
}
```

### 核心区域提取

```java
public Geometry extractCoreRegion(Geometry region, double margin) {
    // 首先进行负缓冲
    Geometry buffered = region.buffer(-margin);
    
    // 然后计算凹包简化
    if (buffered.isEmpty()) {
        return null;  // 区域太小
    }
    
    return ConcaveHull.concaveHullByLengthRatio(buffered, 0.5);
}
```

## 总结

JTS 的外部和内部多边形包络功能为几何简化和空间分析提供了强大的工具。通过灵活的参数控制，可以根据不同的应用需求生成合适的简化边界。

## 参考资料

- [GEOS ConcaveHull 类](https://libgeos.org/doxygen/classgeos_1_1algorithm_1_1hull_1_1ConcaveHull.html)
- [JTS GitHub 仓库](https://github.com/locationtech/jts)
- [Concave Hull 算法论文](https://arxiv.org/pdf/1309.7829)

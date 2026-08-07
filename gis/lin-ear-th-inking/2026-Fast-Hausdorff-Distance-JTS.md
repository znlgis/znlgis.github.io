---
layout: default
title: JTS 中的快速 Hausdorff 距离与 isFullyWithinDistance
---

# JTS 中的快速 Hausdorff 距离与 isFullyWithinDistance

> 原文：[Fast Hausdorff Distance and isFullyWithinDistance in JTS](https://lin-ear-th-inking.blogspot.com/2026/03/fast-hausdorff-distance-and.html)
> 作者：Martin Davis
> 日期：2026年3月3日

## 概述

我在[上一篇博文](https://znlgis.github.io/gis/lin-ear-th-inking/2026-Hausdorff-Distance-Challenge/)中回顾了 Hausdorff 距离的概念。尽管 Hausdorff 距离在几何数据匹配方面非常有用，但令人惊讶的是，开源实现非常少，而且似乎没有针对线性和多边形数据的高效实现。这甚至包括 CGAL 和 GRASS，它们通常以提供广泛的地理空间操作而著称。

这种高质量 Hausdorff 距离实现的缺乏也延伸到了 JTS Topology Suite。JTS 多年来一直提供 `DiscreteHausdorffDistance` 类，该代码被用于许多地理空间系统（通过 JTS 及其 GEOS 移植），包括 PostGIS、Shapely 和 QGIS 等广泛使用的系统。然而，该实现存在**严重的性能问题**以及其他可用性缺陷。

因此，我很高兴地宣布：**JTS 中发布了新的快速通用 Hausdorff 距离算法**——`DirectedHausdorffDistance` 类。

## 新算法的能力

`DirectedHausdorffDistance` 具有以下功能：

- **处理所有线性几何类型**：点、线和多边形
- **支持距离容差参数**，允许以任意精度计算 Hausdorff 距离
- **自动计算距离容差**，提供"无需魔术数字"的 API
- **极快的性能**：得益于惰性加密和索引距离计算
- **计算距离取得位置的点对**：在输入几何体上
- **支持 prepared 模式**：缓存已计算的索引
- **确定多边形内部的最远点**
- **高效处理相等或几乎相同的几何体**
- **提供 `isFullyWithinDistance` 谓词**：支持短路求值以获得最大性能

**Hausdorff 距离 vs 最短距离（线串之间）**

新类的命名是经过深思熟虑的。算法的核心评估的是从一个几何体到另一个几何体的**有向 Hausdorff 距离**。要计算对称 Hausdorff 距离，只需取两个有向距离 DHD(A,B) 和 DHD(B,A) 中的较大者。这通过 `DirectedHausdorffDistance.hausdorffDistance(a,b)` 函数提供。

## 索引最短距离

Hausdorff 距离依赖于标准的（欧几里得）最短距离函数（从数学定义可以看出）：

```
DHD(A,B) = max_{a ∈ A} dist(a,B)
```

一个关键的**性能改进**是使用 `IndexedFacetDistance` 类来评估最短距离。仅对点集而言，这一优化就能产生显著的提升。

例如，以两个各含 10,000 个点的随机点集为例：
- `DiscreteHausdorffDistance` 耗时 **495 ms**
- `DirectedHausdorffDistance` 仅耗时 **22 ms**——快 22 倍

（值得注意的是，这与使用 `IndexedFacetDistance.nearestPoints` 查找最短距离点的性能相当）。

## 惰性加密

计算 Hausdorff 距离的最大挑战在于，它可能在非顶点的几何位置取得。这意味着必须对线要素边进行加密以添加可评估距离的点。

实现高效的关键是使计算**自适应**——执行**"惰性加密"**。这避免了对不可能出现最远距离的边进行加密。

### 算法细节

加密通过**递归二分线段**来完成。为了优化寻找最大距离位置的过程，算法使用**分支定界**（branch-and-bound）模式：

1. 边线段存储在**优先队列**中，按每个线段的最大可能距离边界函数排序
2. **线段最大距离** = 两端点距离中的较大者
3. **线段最大距离边界** = 线段最大距离 + 线段长度的一半

这是紧确边界。考虑一个长度为 L 的线段 S，一端距离目标为 D，另一端距离为 D+e。线段上最远的点距离为 (L+2D+e)/2 = L/2 + D + e/2。这始终小于 L/2 + D + e，但在极限情况下接近。

**最大距离边界证明**

算法循环处理优先队列中的线段。队列中的第一个线段始终具有最大距离边界。如果这小于当前最大距离，循环终止。如果线段到目标几何体的距离大于当前最大距离，则保存为新的最远线段。否则，对线段进行二分，计算子线段端点距离，并将两者重新插入队列。

**通过线段二分搜索 DHD**

通过加密直到二分线段低于给定长度，可以有向 Hausdorff 距离以任意精度确定。精度距离容差可以由用户指定，也可以自动确定。这提供了"无需魔术数字"的 API，显著提高了易用性。

## 性能对比

将 `DirectedHausdorffDistance` 与 `DiscreteHausdorffDistance` 进行性能比较虽然"不公平"（因为后者实现效率太低），但后者是目前实际使用的实现，所以比较是有意义的。

### 情况一：距离在顶点处取得

当有向 Hausdorff 距离在顶点处取得时（几何体顶点已经足够密集时常见），使用两个分别包含 6,426 和 19,645 个顶点的多边形作为示例：

- `DiscreteHausdorffDistance`（无加密，因子=1）：**1233 ms**
- `DirectedHausdorffDistance`：**25 ms**——快 49 倍

实际上性能差异可能更大。因为无法事先判断 `DiscreteHausdorffDistance` 需要多少加密才能产生准确的答案，通常会指定更高的加密量，这会严重降低性能。

### 情况二：距离在边中间取得

当 Hausdorff 距离在线段中间取得时，需要加密。查询多边形有 468 个顶点，目标有 65 个顶点：

- `DirectedHausdorffDistance`（容差 0.001）：**19 ms**
- `DiscreteHausdorffDistance`（加密因子 0.0001 以获得等效精度）：**1292 ms**
- `DiscreteHausdorffDistance`（加密因子 0.001，精度较低）：**155 ms**——仍然慢 8 倍

## 处理（几乎）相等的几何体

旧的 Hausdorff 距离算法有一个 [GIS Stack Exchange 上报告的问题](https://gis.stackexchange.com/questions/452094)。它涉及两个几乎相同的几何体具有非常微小差异的情况，性能非常慢。

**两个几乎相同的几何体，显示差异位置**

测试发现，新的二分算法在这种情况下表现极差，对于有许多重合线段的几何体普遍如此。特别是计算两个**完全相同**的几何体之间的 Hausdorff 距离时——这种情况在数据集自查询时很容易发生。

问题在于最大距离边界函数依赖于线段距离和线段长度。当线段距离非常小（或为零）时，距离边界由线段长度主导，因此细分将持续到所有线段都短于精度容差。这导致搜索过程中生成大量子线段。

**解决方案**：检查距离为零的子线段是否与目标几何体的某条线段重合。如果是，无需进一步二分，因为子线段的距离也必须为零。有了这个检查，相同（和几乎相同）情况的执行速度与同等规模的一般情况一样快。同样重要的是，无论精度容差如何，这都能检测到非常微小的差异。

该 GIS-SE 案例现在执行约 45 ms，并检测到比输入几何体小 9 个数量级的微小差异。

**Hausdorff 距离约为 0.00099**

## 处理多边形输入

如果 Hausdorff 距离在边上某点取得，则加密线要素就足够了。但对于多边形查询几何体，最远点可能出现在**区域内部**：

**有向 Hausdorff 距离在查询多边形的内部点取得**

为了找到最远的内部点，可以在面积域中使用自适应的分支定界方法。JTS 已经在 `MaximumInscribedCircle` 和 `LargestEmptyCircle` 类中实现了这一点。特别是 `LargestEmptyCircle` 支持将结果约束在某个区域内，这正是 Hausdorff 距离所需要的。

- 目标几何体被视为**障碍物**
- 查询几何体的多边形元素是对空圆中心位置的**约束**

**具有多个面积约束和异构障碍物的有向 Hausdorff 距离**

`LargestEmptyCircle` 算法很复杂，可能看起来会显著降低性能。实际上，它只增加了约 30% 的开销，对于许多输入甚至不可察觉。此外，如果不需要确定多边形内部的最远点，可以通过仅使用多边形线要素（即边界）作为输入来避免此开销。

目前大多数 Hausdorff 距离算法操作的是点集，极少数支持线性几何体，**似乎没有计算多边形几何体 Hausdorff 距离的实现**。这在使用 `isFullyWithinDistance` 谓词时至关重要。

## isFullyWithinDistance

基于距离的查询通常只需要确定距离是否**小于**某个给定值，而不是实际距离值本身。这种布尔谓词的评估速度比完整距离计算快得多，因为一旦找到任何确认超过距离限制的点，计算就可以**短路退出**。

对于最短距离，这种方法由 `Geometry.isWithinDistance`（以及 `DistanceOp` 和其他类中的支持方法）提供。

Hausdorff 距离的等效谓词称为 **isFullyWithinDistance**。它测试几何体的**所有点**是否都在另一个几何体的指定距离内。这通过有向 Hausdorff 距离定义（因此是非对称关系）：

```
isFullyWithinDistance(A,B,d) = DHD(A,B) <= d
```

`DirectedHausdorffDistance` 类通过 `isFullyWithinDistance(A,B,dist)` 函数提供此谓词。由于新类支持所有类型的输入几何体（包括多边形），该谓词是完全通用的。

为了在批量查询中获得更快的性能，可以通过 `isFullyWithinDistance(A,dist)` 方法以 **prepared 模式**执行。此模式缓存目标几何体上构建的空间索引以供复用。

### 性能示例

考虑一个包含约 28K 顶点的欧洲边界数据集（国家和岛屿）。使用德国边界作为目标几何体：

- `isFullyWithinDistance`（距离限制 20）：约 **60 ms**

没有与 `DiscreteHausdorffDistance` 的直接比较，但如果使用保守的加密因子 0.1 计算有向 Hausdorff 距离，时间约为 1100 ms。另一个比较点是运行最短距离查询（仅需 21 ms，但做的工作少得多）。

## ST_DFullyWithin 的更好实现

实现 `isFullyWithinDistance` 的另一种方法是计算几何体 B 的距离 d 缓冲区，并测试它是否覆盖 A：

```
isFullyWithinDistance(A,B,d) = B.buffer(d).covers(A)
```

这是 **PostGIS** 中 `ST_DFullyWithin` 函数目前的实现方式。考虑到当前缺乏高性能的 Hausdorff 距离实现，这是一个合理的设计选择。然而，使用缓冲区存在一些问题：

- 复杂几何体的缓冲区计算可能很慢，**特别是大距离时**
- 存在**鲁棒性 bug** 影响计算缓冲区的风险
- 缓冲区是**线性化近似**，因此位于缓冲区边界附近的查询几何体可能出现**假阴性**

现在，`DirectedHausdorffDistance` 的 `isFullyWithinDistance` 实现可以使该函数**更快、更精确、更鲁棒且可缓存**。（当然，`ST_HausdorffDistance` 函数也能受益。）

## 总结

JTS `DirectedHausdorffDistance` 类为所有 JTS 几何类型提供了快速、可缓存、易于使用的 Hausdorff 距离和 `isFullyWithinDistance` 谓词计算。这是对旧 JTS `DiscreteHausdorffDistance` 类的重大改进，基本上完全替代了它。更广泛地说，它填补了开源地理空间功能的一个显著空白，将允许许多系统提供高质量的 Hausdorff 距离实现。

## 术语对照

| 英文 | 中文 |
|------|------|
| Directed Hausdorff Distance | 有向 Hausdorff 距离 |
| Densification | 加密（线段） |
| Lazy Densification | 惰性加密 |
| Branch-and-Bound | 分支定界 |
| Short-Circuit | 短路求值 |
| Prepared Mode | 预准备模式 |
| Coincident Segment | 重合线段 |
| Tolerance | 容差 |
| Facet | 面/边片段 |
| Spatial Index | 空间索引 |
| Maximum Inscribed Circle | 最大内切圆 |
| Largest Empty Circle | 最大空圆 |

## 相关文章

- [Hausdorff 距离的挑战](https://znlgis.github.io/gis/lin-ear-th-inking/2026-Hausdorff-Distance-Challenge/)
- [使用 JTS 快速检测狭窄多边形](https://znlgis.github.io/gis/lin-ear-th-inking/2025-Fast-Detection-Narrow-Polygons/)
- [JTS 中的距离度量与形状相似性](https://znlgis.github.io/gis/lin-ear-th-inking/2016-Distance-Metrics-Shape-Similarity/)

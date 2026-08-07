---
layout: default
title: Hausdorff 距离的挑战
---

# Hausdorff 距离的挑战

> 原文：[The Hausdorff Distance Challenge](https://lin-ear-th-inking.blogspot.com/2026/02/the-hausdorff-distance-challenge.html)
> 作者：Martin Davis
> 日期：2026年2月23日

## 概述

Hausdorff 距离是一个非常有用的空间函数，但它的名字让人感到神秘。这部分是因为它以 **Felix Hausdorff** 命名——他是拓扑学的奠基人之一，一位在音乐、文学和数学方面都富有创造力的博学者。

**Felix Hausdorff（1868-1942）**

但这个名字完全没有传达出为什么这个函数有用，以及它与我们更熟悉的"最短距离"有何不同。关键区别在于：**最短距离告诉你事物有多近，而 Hausdorff 距离告诉你它们有多远**。因此，一个更具描述性的名字可能是"最远距离"或"最大距离"。出于对 Hausdorff 博士的尊重，只能说这是命名历史上的一个值得更新的文物。（尤其现在越来越被认可的是，其核心概念实际上是由罗马尼亚数学家 Dimitrie Pompeiu 首次发表的。未来的用户会感激不必调用 `ST_PompeiuHausdorffDistance` 函数。）

## 数学定义

Hausdorff 距离（HD）的正式定义为：

```
HD(A,B) = max( DHD(A,B), DHD(B,A) )
```

其中 DHD 是**有向 Hausdorff 距离**（Directed Hausdorff Distance）：

```
DHD(A,B) = max_{a ∈ A} dist(a,B)
```

而 `dist(a,B)` 是点 a 到几何体 B 的常规最短距离：

```
dist(a,B) = min_{b ∈ B} dist(a,b)
```

Hausdorff 距离是对称的，是一个真正的距离度量。有向 Hausdorff 距离是非对称的。两者在不同场景下都有用，但有向版本更具基础性（它也是实现工作的主要部分）。

**有向 Hausdorff 距离是非对称的**

## 应用场景

Hausdorff 距离的主要应用是**衡量两个数据集的匹配程度**，提供它们之间相似性的度量。在空间应用中，这些通常是线或多边形等几何体，但也可以是点云或栅格图像。

Hausdorff 距离作为相似性度量远比最短距离有用，因为它提供了关于形状中**所有**点的信息，而不仅仅是单个最近点。最短距离只约束了**单个**点距离目标的远近，而 Hausdorff 距离约束了查询形状中的**每一个**点。

在下图中，两条线的最短距离很小，但 Hausdorff 距离揭示了它们在某些点上实际上相距很远：

**Hausdorff 距离 vs 最短距离**

## 实现挑战

最短距离和 Hausdorff 距离之间的一个关键区别是：定义最短距离的点对总是包含**至少一个顶点**，而 Hausdorff 距离可能发生在**非顶点位置**。

对于线段，Hausdorff 距离可以发生在边上的任何位置：

对于多边形，它可以发生在边上**或者**查询区域的**内部**：

这使得 Hausdorff 距离对于一般二维几何体的实现要困难得多。最短距离可以通过评估每个几何体上有限顶点集的距离来简单确定，而 Hausdorff 距离需要一种方法从无限多的非顶点位置中评估有限点集。

也许这就是为什么很难找到一般二维几何体的 Hausdorff 距离实现。（或者只是因为不需要快速精确的通用 Hausdorff 距离？肯定不是……）有一些针对**点集**的实现，至少有一个针对**凸多边形**特定情况的实现。还有几个可能支持线段的实现（[这里](https://github.com/anitagraser/movingpandas)和[这里](https://github.com/mapbox/cheap-ruler)），但似乎方式比较粗糙。我还没有找到一个支持一般多边形的实现。太好了——有挑战才有动力！

## 离散 Hausdorff 距离

一种简单的方法是通过**加密线段**来离散化输入的线要素。然后对原始顶点和新增顶点评估 Hausdorff 距离。JTS Topology Suite 的 `DiscreteHausdorffDistance` 类就实现了这种方法。

该算法是多年前（2008年）为 RoadMatcher 线性网络合并工具开发的。在那个用例中它工作得足够好，因为输入通常很小，精度也"足够好"。但它有一些**严重的问题**：

- **要达到精度需要对每条边进行高密度加密**，这意味着性能很慢
- **如果 Hausdorff 距离恰好在顶点处取得**，则不需要加密，但这无法预先判断
- 用户通常**不知道需要什么级别的加密**来获得所需精度的结果（在自动化批处理中尤其成问题，因为几何体可能需要不同程度的加密）
- **使用加密因子而非最大线段长度是一个错误**。很难确定达到所需距离精度需要的因子，而且会导致短边的过度加密
- **当输入相等或非常相似时非常慢**（如[这个问题](https://gis.stackexchange.com/questions/452094)所示）
- **不支持多边形输入**
- **内部最短距离计算效率低下**，因为它没有使用索引算法

其中一些缺陷可以修复。例如，最短距离计算可以通过使用 `IndexedFacetDistance` 来改进（这在开发时不可用）。加密可以用最大线段长度而非因子来控制。但解决所有这些问题需要对算法进行**根本性的重新思考**。

考虑到 JTS 及其 C++ 移植版 GEOS 的广泛部署，任何改进都将惠及大量用户。经过 18 年，是时候替换这段笨拙的旧代码了。所以我很高兴地宣布，**我正在开发一个全新的 Hausdorff 距离实现**，解决上述所有问题。敬请期待后续博文！

## 术语对照

| 英文 | 中文 |
|------|------|
| Hausdorff Distance | Hausdorff 距离 |
| Directed Hausdorff Distance | 有向 Hausdorff 距离 |
| Shortest Distance | 最短距离 |
| Farthest Distance | 最远距离 |
| Densification | 加密（线段） |
| Discrete | 离散 |
| Branch-and-Bound | 分支定界 |
| Convex Polygon | 凸多边形 |
| Spatial Index | 空间索引 |

## 相关文章

- [JTS 中使用级联并集快速合并多边形](https://znlgis.github.io/gis/lin-ear-th-inking/2007-Fast-Polygon-Merging-Cascaded-Union/)
- [JTS 中的距离度量与形状相似性](https://znlgis.github.io/gis/lin-ear-th-inking/2016-Distance-Metrics-Shape-Similarity/)
- [JTS 性能改进](https://znlgis.github.io/gis/lin-ear-th-inking/2012-JTS-Performance-Improvements/)

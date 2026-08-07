---
layout: default
title: RelateNG 性能测试
---

# RelateNG 性能测试

> 原文：[RelateNG Performance](https://lin-ear-th-inking.blogspot.com/2024/05/relateng-performance.html)
> 作者：Martin Davis
> 日期：2024年5月27日

## 概述

[之前的文章](https://znlgis.github.io/gis/lin-ear-th-inking/2024-JTS-Topological-Relationships-RelateNG/)介绍了 JTS Topology Suite 中名为 **RelateNG** 的新算法。它使用 DE-9IM（维度扩展的 9 交集模型）计算几何体之间的拓扑关系。

该算法是大量地理空间环境中执行的众多空间查询的基础。毫不夸张地说，Relate 算法每天在全球数据中心中被执行**数十亿次**。因此，**性能是一个关键的指标**。

## 旧实现的局限性

原始的 JTS `RelateOp` 算法受限于其设计——每次关系评估都需要计算完整的拓扑图。随后开发的 `PreparedGeometry` 为常见空间谓词（如 `intersects` 和 `covers`）提供了显著的性能提升，且不易受几何鲁棒性问题影响。但它有一些缺点：

- 只实现了**少量谓词**
- 设计**不易扩展**到更复杂的谓词
- **不支持** GeometryCollection 输入
- 与通用 `RelateOp` 是完全独立的代码库，增加了维护工作量和 bug/行为不一致的风险

**RelateNG 解决了所有这些问题**。此外，它为**非 prepared（无状态）调用**提供了更好的性能。这对于由于架构限制或缺乏性能关注而无法使用 prepared 模式的系统非常重要。

## 性能测试

以下是性能指标的一些示例。

> **注意**：测试中使用的数据有时会被子集化，以避免因输入几何体之间无交互而导致大量假阴性结果影响测试结果。这反映了这些谓词在系统中的典型部署——在执行完整谓词之前先进行主要范围过滤（即通过空间索引）。

部分数据集使用大地坐标，严格来说 JTS 不处理大地坐标，但这不影响性能测试的目的。

### 点 / 多边形

此测试查询欧洲轮廓的 MultiPolygon（包括较大的岛屿）与合成的随机点数据集，评估 `intersects` 谓词（在点/多边形场景中唯一有意义的谓词）。

**测试数据指标：**
- 查询 MultiPolygon：461 个多边形，22,675 个顶点
- 目标点：10,000 个点

**耗时：**

| 操作 | intersects | intersects (Prep) |
|------|-----------|-------------------|
| Relate | 61.7 s | 21 ms |
| RelateNG | **0.1 s** | 19 ms |

结果清楚地展示了无状态情况下的巨大改进——RelateNG 不在输入多边形上构建拓扑。Prepared 模式下结果非常相似，这符合预期，因为两者都使用缓存的空间索引运行简单的点包含测试。

### 线 / 线

此测试使用美国本土主要河流数据集。查询一条河流干流与河流支流的子集，使用 `intersects` 和 `touches` 关系，在无状态和 prepared 模式下。

**测试数据指标：**
- 查询线：6,975 个顶点
- 目标线：407 条线，47,328 个顶点

**耗时（每 100 次操作执行）：**

| 操作 | intersects | intersects Prep | touches | touches Prep |
|------|-----------|-----------------|---------|--------------|
| Relate | 38.2 s | 133 ms | 36 s | N/A |
| RelateNG | **1.18 s** | 142 ms | **2.05 s** | 2.03 s |

RelateNG 性能远优于 Relate。RelateNG 可以在 prepared 模式下评估 `touches`，但性能与无状态模式相似，因为目前线/线情况不缓存索引。这在未来版本中可以改进。

### 多边形 / 多边形

此测试使用两个多边形数据集：
1. 不列颠哥伦比亚省基岩地质多边形覆盖
2. GADM Level 2 加拿大边界

测试查询一个行政单元多边形与与其范围相交的基岩多边形子集，使用 `intersects` 和 `covers`，在无状态和 prepared 模式下。

**测试数据指标：**
- GADM 单元：4,017 个顶点
- 基岩多边形：4,318 个多边形，337,650 个顶点

**耗时（每 100 次操作执行）：**

| 操作 | intersects | intersects Prep | covers | covers Prep |
|------|-----------|-----------------|--------|-------------|
| Relate | 61.7 s | 534 ms | 54.9 s | 842 ms |
| RelateNG | **5.8 s** | 595 ms | **6.4 s** | 943 ms |

### 多边形 / 多边形 - 自定义 Relate 模式

此测试展示了 RelateNG **高效评估任意 Relate 交集矩阵模式**的能力。使用的模式是 `F***0****`，对应一种可称为"点接触"（point-touches）的关系：两个几何体的边界仅在一个（或多个）点（维度 0）相交，但内部不相交。

此测试使用 GADM Level 1 加拿大边界数据。加拿大包含一个罕见的例子——四个边界在单个点相交（萨斯喀彻温省、曼尼托巴省、西北地区和努纳武特）。

**测试数据指标：**
- GADM 加拿大 Level 1：13 个多边形，4,005,926 个顶点

**耗时：**

| 操作 | F***0**** | F***0**** Prep |
|------|-----------|----------------|
| Relate | 504 s | N/A |
| RelateNG | **9.8 s** | **6.6 s** |

RelateNG 性能远超 Relate。这得益于其分析交集矩阵模式并仅执行必要的拓扑测试的能力，以及不构建输入的完整拓扑结构。测试展示了 prepared 模式下缓存空间索引的效果，尽管无状态模式也非常高效。

## 结果分析

显然，RelateNG 在非 prepared 模式下的性能远超 Relate。`PreparedGeometry` 实现略微更快（这证实了其原始设计的效率），但差距不大。这种差异可能是 RelateNG 中更通用因此更复杂的代码和数据结构导致的结果。缩小这一差距可能是未来研究的领域。

有一点是确定的：**RelateNG 的算法设计为添加特定情况的优化提供了更大的空间**。如果您有一个重要的用例可以通过进一步针对性的优化改进，请在评论中告诉我！

一旦 RelateNG 移植到 GEOS，重新评估这些测试将会很有趣。有时（但不总是）C++ 实现可以比 Java 快得多，因为有更多代码和编译器优化的机会。

## 性能对比总结

| 测试场景 | Relate（无状态） | RelateNG（无状态） | 提升倍数 |
|---------|-----------------|-------------------|---------|
| 点/多边形 intersects | 61.7 s | 0.1 s | ~617x |
| 线/线 intersects | 38.2 s | 1.18 s | ~32x |
| 线/线 touches | 36 s | 2.05 s | ~18x |
| 多边形/多边形 intersects | 61.7 s | 5.8 s | ~11x |
| 多边形/多边形 covers | 54.9 s | 6.4 s | ~9x |
| 自定义模式 F***0**** | 504 s | 9.8 s | ~51x |

## 相关文章

- [JTS 拓扑关系 - 下一代 (RelateNG)](https://znlgis.github.io/gis/lin-ear-th-inking/2024-JTS-Topological-Relationships-RelateNG/)
- [JTS Overlay - 下一代 (OverlayNG)](https://znlgis.github.io/gis/lin-ear-th-inking/2020-JTS-Overlay-Next-Generation/)
- [JTS 性能改进](https://znlgis.github.io/gis/lin-ear-th-inking/2012-JTS-Performance-Improvements/)

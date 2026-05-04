---
layout: default
title: JTS Overlay - 下一代 (OverlayNG)
---

# JTS Overlay - 下一代 (OverlayNG)

> 原文：[JTS Overlay - the Next Generation](https://lin-ear-th-inking.blogspot.com/2020/05/jts-overlay-next-generation.html)
> 作者：Martin Davis
> 日期：2020年5月

## 概述

JTS 的 OverlayNG 算法是对空间叠加操作（如交集、并集、差集和对称差集）的重大改进。该算法由 Martin Davis 于 2020 年公开发布，解决了先前叠加实现中长期存在的鲁棒性、性能和灵活性问题，尤其是在处理复杂和无效几何图形时。

## 主要创新

### 鲁棒性

OverlayNG 使用**显式精度模型**，即使对于通常会触发 `TopologyException` 的几何图形（如自相交多边形、窄条或非常接近的顶点），也能实现可靠的计算。这是相对于之前版本的重大改进，因为旧版本对浮点误差敏感，有时会在"轻度无效"的输入上失败。

### 精度模型

该算法允许使用**任意精度模型**，使计算能够在所需的精度级别上进行，进一步减少由于舍入而导致的拓扑错误。

### 支持所有几何类型

OverlayNG 支持点、线、多边形及其同类集合的所有组合的集合论运算，使空间分析工作流更加灵活。

### 改进的标签和节点处理

叠加计算通过组合交点、来自输入的标签来构建结果图，并确保生成的线性和多边形几何图形是有效的。折叠的多边形边缘（由于舍入/捕捉）成为结果的一部分，保持拓扑一致性。

## 算法步骤

1. **拓扑图构建**：为每个输入几何图形构建一个拓扑图，包括所有自相交节点。
2. **图交集**：计算两个图的边和节点之间所有交点的节点。
3. **标签**：合并来自两个输入的边/节点标签，以进行正确的拓扑分类。
4. **结果图组装**：添加由交点生成的新边和节点，并集成孤立组件。
5. **多边形化和线合并**：对最终几何结果进行多边形化，并根据需要合并所有线性几何图形，确保有效性和一致性。

## 性能和错误处理

- OverlayNG 大大减少了 `TopologyException` 的发生，特别是在以前由于近似重合或接触的几何图形而频繁失败的工作流中。
- 实践者（例如在 QuPath 图像分析中）已确认它能有效避免"非节点交叉"错误并提高整体鲁棒性和处理速度。

## 语义和输出

- OverlayNG 产生的输出始终符合 JTS 标准：有效的 MultiPolygon、结果中没有重复顶点，并且在线性结果中包含所有节点。
- 它支持多边形输入中的轻度无效性（自接触环、沿线段接触的环），这是相对于旧实现的重大实用增强。

## 可用性和采用

- OverlayNG 包含在 JTS 1.18 及更高版本中，此后已通过 NetTopologySuite 移植到 .NET，在那里它提供了对旧叠加操作的强大替代方案。

## 代码示例

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.operation.overlayng.OverlayNG;
import org.locationtech.jts.operation.overlayng.OverlayNGRobust;

// 创建两个几何对象
Geometry geomA = ...;
Geometry geomB = ...;

// 使用 OverlayNG 计算交集
Geometry intersection = OverlayNGRobust.overlay(geomA, geomB, OverlayNG.INTERSECTION);

// 使用 OverlayNG 计算并集
Geometry union = OverlayNGRobust.overlay(geomA, geomB, OverlayNG.UNION);

// 使用 OverlayNG 计算差集
Geometry difference = OverlayNGRobust.overlay(geomA, geomB, OverlayNG.DIFFERENCE);

// 使用 OverlayNG 计算对称差集
Geometry symDifference = OverlayNGRobust.overlay(geomA, geomB, OverlayNG.SYMDIFFERENCE);
```

## 总结

OverlayNG 标志着空间叠加技术的重大进步，使 JTS 及其移植版本在实际空间分析任务中更加强健。无论是处理复杂的多边形叠加还是需要高精度计算的场景，OverlayNG 都提供了可靠的解决方案。

## 参考资料

- [JTS OverlayNG 官方文档](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/overlayng/package-summary.html)
- [JTS GitHub 仓库](https://github.com/locationtech/jts)
- [NetTopologySuite OverlayNG 移植](https://github.com/NetTopologySuite/NetTopologySuite)

---
layout: default
title: JTS 中的 Coverage 清理
---

# JTS 中的 Coverage 清理

> 原文：[Coverage Cleaning in JTS](https://lin-ear-th-inking.blogspot.com/2025/04/coverage-cleaning-in-jts.html)
> 作者：Martin Davis
> 日期：2025年4月

## 概述

Coverage 清理是 JTS 2025 年版本中的重要新功能。`CoverageCleaner` 类可以自动修复具有拓扑错误的数据集，并将其转换为有效的多边形覆盖（Coverage）。

## 什么是多边形覆盖（Polygonal Coverage）？

多边形覆盖是一组多边形，它们满足以下条件：

1. **不重叠**：任意两个多边形不重叠；它们的内部是不相交的
2. **边缘匹配**：相邻多边形的边界在顶点和线段处精确匹配
3. **允许间隙**：覆盖范围内可以存在间隙（没有被任何多边形覆盖的区域）

## Coverage 验证

在清理之前，首先需要了解如何验证 Coverage。`CoverageValidator` 类用于确保数据集形成有效的多边形覆盖：

```java
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;

Geometry[] polygons = ...;

// 验证 Coverage
CoverageValidator validator = new CoverageValidator(polygons);
Geometry[] invalidRings = validator.getInvalidPolygons();

// 检查每个多边形是否有效
for (int i = 0; i < invalidRings.length; i++) {
    if (invalidRings[i] != null) {
        System.out.println("多边形 " + i + " 无效: " + invalidRings[i]);
    }
}
```

### 常见的无效情况

- **重叠**：两个多边形的内部相交
- **边缘不匹配**：相邻多边形的边界没有精确对齐
- **间隙过窄**：虽然间隙是允许的，但过窄的间隙可能被标记为潜在问题

## Coverage 清理

`CoverageCleaner` 类提供了自动化的清理功能：

### 输入
- 多边形数组（`Polygon` 或 `MultiPolygon`），可能包含拓扑错误（重叠、间隙）

### 操作
1. **移除空几何和非多边形输入**
2. **捕捉线工作**：消除小的差异，防止产生狭窄的"尖刺"间隙
3. **合并重叠**：将重叠区域与相邻多边形合并，通常优先选择共享边界最长的多边形
4. **填充间隙**：填充宽度小于指定值的间隙，将其与相邻多边形合并
5. **支持多种合并策略**：默认合并到最长边界

### 输出
- 经过清理的多边形数组，形成有效的多边形覆盖

```java
import org.locationtech.jts.coverage.CoverageCleaner;
import org.locationtech.jts.geom.Geometry;

Geometry[] polygons = ...;

// 创建清理器
CoverageCleaner cleaner = new CoverageCleaner(polygons);

// 设置间隙容差（填充小于此宽度的间隙）
cleaner.setGapWidth(0.01);

// 设置捕捉容差
cleaner.setSnapTolerance(0.001);

// 执行清理
Geometry[] cleanedPolygons = cleaner.clean();

// 验证清理结果
CoverageValidator validator = new CoverageValidator(cleanedPolygons);
boolean isValid = validator.isValid();
```

## 合并策略

CoverageCleaner 支持不同的合并策略来处理重叠和间隙：

### 默认策略：最长边界
将重叠区域或间隙合并到共享边界最长的相邻多边形。

### 自定义策略
可以实现自定义的合并逻辑，例如：
- 基于多边形面积
- 基于属性值
- 基于其他业务规则

## 相关操作

### CoverageUnion

`CoverageUnion` 为有效的覆盖提供高效的并集操作：

```java
import org.locationtech.jts.operation.overlayng.CoverageUnion;

Geometry[] validCoverage = ...;
Geometry union = CoverageUnion.union(validCoverage);
```

优势：
- 利用覆盖拓扑——无需创建新顶点
- 处理速度比完整拓扑交集检查快得多

### Coverage 简化

在清理后，可以对覆盖进行简化以减少顶点数量：

```java
import org.locationtech.jts.coverage.CoverageSimplifier;

Geometry[] simplifiedCoverage = CoverageSimplifier.simplify(cleanedPolygons, tolerance);
```

## 工作流程建议

1. **验证**：首先使用 `CoverageValidator` 检查数据质量
2. **清理**：使用 `CoverageCleaner` 修复拓扑错误
3. **再次验证**：确认清理后的数据形成有效覆盖
4. **进一步处理**：执行并集、简化或其他操作

## 在其他库中的可用性

Coverage 清理和验证功能也可在以下库中使用：

- **GEOS** (C++)：JTS 的 C++ 移植版本
- **NetTopologySuite** (.NET)：JTS 的 .NET 移植版本
- **Shapely** (Python)：基于 GEOS 的 Python 库

## 总结

Coverage 清理是 JTS 对空间数据质量管理的重要贡献。它使得处理来自不同来源、可能存在拓扑问题的多边形数据变得更加容易和可靠。

## 参考资料

- [JTS CoverageCleaner Pull Request](https://github.com/locationtech/jts/pull/1126)
- [NetTopologySuite Coverage 命名空间](https://nettopologysuite.github.io/NetTopologySuite/api/NetTopologySuite.Coverage.html)

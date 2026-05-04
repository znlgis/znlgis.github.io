---
layout: default
title: JTS 拓扑关系 - 下一代 (RelateNG)
---

# JTS 拓扑关系 - 下一代 (RelateNG)

> 原文：[JTS Topological Relationships - the Next Generation](https://lin-ear-th-inking.blogspot.com/2024/05/jts-topological-relationships-next.html)
> 作者：Martin Davis
> 日期：2024年5月

## 概述

RelateNG 是 JTS（Java Topology Suite）2024 年版本中发布的新算法。它是一种高效的新算法，用于检查 JTS 中几何图形之间的空间关系。RelateNG 完全实现了 **DE-9IM**（维度扩展的 9 交集模型）标准，并替代了旧的 `RelateOp` 和 `PreparedGeometry` API。

## 什么是 DE-9IM？

DE-9IM（Dimensionally-Extended 9-Intersection Model）是用于建模拓扑空间关系的标准。它通过一个 3x3 的交集矩阵来对空间关系进行分类：

- 比较两个几何图形的**内部**、**边界**和**外部**
- 结果是一个矩阵，显示每种可能交集的维度（点=0，线=1，面=2，"F"表示空/无交集）
- 它是常见谓词的基础，如 `intersects`、`touches`、`crosses`、`within`、`contains`、`equals`、`overlaps` 和 `disjoint`

### DE-9IM 矩阵示例

```
          Interior  Boundary  Exterior
Interior  [ dim ]   [ dim ]   [ dim ]
Boundary  [ dim ]   [ dim ]   [ dim ]  
Exterior  [ dim ]   [ dim ]   [ dim ]
```

其中 `dim` 可以是：
- `0` - 点维度
- `1` - 线维度
- `2` - 面维度
- `F` - 空集（无交集）
- `T` - 非空（任意维度）
- `*` - 任意（包括空）

## RelateNG 的关键改进

### 高效的短路评估
RelateNG 一旦满足所需条件就会停止计算，提高了效率。

### "准备模式"
为重复评估缓存空间索引，当一个几何图形需要与多个其他几何图形比较时特别有用。

### 鲁棒性
通过依赖局部点拓扑，更好地处理无效的输入几何图形。

### 灵活性
支持包含混合或重叠元素的 `GeometryCollection`。

### 一致性
将零长度线视为点（保持一致性），严格在 2D 中工作，忽略高程（Z 坐标）。

### 边界节点规则支持
支持不同的边界节点规则，如 MOD2 和 ENDPOINT。

## 使用方法

### 计算 DE-9IM 矩阵

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.operation.relateng.RelateNG;
import org.locationtech.jts.operation.relateng.IntersectionMatrix;

Geometry geomA = ...;
Geometry geomB = ...;

// 计算两个几何图形的 DE-9IM 矩阵
IntersectionMatrix matrix = RelateNG.relate(geomA, geomB);
```

### 测试特定关系

```java
// 测试是否匹配特定的 DE-9IM 模式
String pattern = "T*F**FFF*";  // 包含关系的模式
boolean result = RelateNG.relate(geomA, geomB, pattern);
```

### 使用准备模式进行重复测试

```java
// 当需要将一个几何图形与多个其他几何图形比较时
RelateNG relater = RelateNG.prepare(geomA);

for (Geometry geomB : geometries) {
    boolean intersects = relater.evaluate(geomB, "T********");
    // 或使用特定谓词
    boolean contains = relater.evaluate(geomB, "T*F**FFF*");
}
```

## 标准空间谓词

RelateNG 支持所有标准空间谓词：

| 谓词 | DE-9IM 模式 | 描述 |
|------|-------------|------|
| Equals | T*F**FFF* | 几何图形拓扑相等 |
| Disjoint | FF*FF**** | 几何图形不相交 |
| Intersects | T******** 或 *T******* 或 ***T***** 或 ****T**** | 几何图形相交 |
| Touches | FT******* 或 F**T***** 或 F***T**** | 几何图形接触但不重叠 |
| Crosses | T*T****** (线/线) 或 T*****T** (线/面) | 几何图形交叉 |
| Within | T*F**F*** | A 在 B 内部 |
| Contains | T*****FF* | A 包含 B |
| Overlaps | T*T***T** (面/面 或 点/点) 或 1*T***T** (线/线) | 几何图形重叠 |

## 实际应用

- 在 GIS 中分析拓扑关系时，JTS 2024 的 RelateNG 比以前的版本更快、更强大
- 启用空间查询，如"查找所有接触但不重叠另一个区域边界的多边形"
- 支持使用 DE-9IM 模式定义自定义关系

## 性能比较

与旧的 `RelateOp` 相比，RelateNG 具有以下优势：

1. **无需构建完整的拓扑图**：对于简单的谓词测试，可以快速返回结果
2. **缓存支持**：PreparedGeometry 模式下，空间索引可以被重用
3. **更好的错误处理**：对无效几何图形有更好的容错性

## 总结

RelateNG 代表了 JTS 空间关系计算的重大进步。它提供了更高效、更鲁棒的 DE-9IM 实现，同时保持了与 OGC 标准的完全兼容性。对于需要进行大量空间关系测试的应用程序，RelateNG 提供了显著的性能提升。

## 参考资料

- [RelateNG JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/relateng/RelateNG.html)
- [DE-9IM 维基百科](https://en.wikipedia.org/wiki/DE-9IM)
- [PostGIS DE-9IM 教程](https://postgis.net/workshops/postgis-intro/de9im.html)

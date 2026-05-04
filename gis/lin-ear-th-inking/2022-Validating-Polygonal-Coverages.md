---
layout: default
title: 验证 JTS 中的多边形覆盖
---

# 验证 JTS 中的多边形覆盖

> 原文：[Validating Polygonal Coverages in JTS](https://lin-ear-th-inking.blogspot.com/2022/08/)
> 作者：Martin Davis
> 日期：2022年8月

## 概述

多边形覆盖（Polygonal Coverage）验证是确保空间数据质量的关键步骤。JTS 提供了 `CoveragePolygonValidator` 类来验证覆盖中的单个多边形，并识别可能导致覆盖无效的错误。

## 有效覆盖的条件

一个有效的多边形覆盖必须满足以下条件：

### 1. 不重叠（Non-Overlapping）
任意两个多边形的内部不相交。这意味着多边形可以接触（共享边界）但不能重叠。

### 2. 边缘匹配（Edge-Matched）
相邻多边形的边界必须精确匹配：
- 共享边界的顶点必须完全相同
- 不能有"几乎匹配"的边界

### 允许的情况
- **间隙（Gaps）**：覆盖内可以存在没有被多边形覆盖的区域
- **不相邻区域**：多边形可以是不连续的（不必相邻）
- **内部孔洞**：单个多边形可以有内部孔洞

## 覆盖验证 API

### 基本用法

```java
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;

// 多边形数组（覆盖）
Geometry[] coverage = ...;

// 创建验证器
CoverageValidator validator = new CoverageValidator(coverage);

// 检查覆盖是否有效
boolean isValid = validator.isValid();

// 获取无效位置
Geometry[] invalidLocations = validator.getInvalidPolygons();
```

### 检查单个多边形

```java
import org.locationtech.jts.coverage.CoveragePolygonValidator;

Geometry polygon = coverage[0];
Geometry[] adjacentPolygons = getAdjacentPolygons(polygon, coverage);

// 验证单个多边形在覆盖中的有效性
CoveragePolygonValidator polyValidator = 
    new CoveragePolygonValidator(polygon, adjacentPolygons);

// 获取问题边界
Geometry invalidBoundary = polyValidator.validate();

if (invalidBoundary != null) {
    System.out.println("发现无效边界: " + invalidBoundary);
}
```

## 常见的无效情况

### 1. 重叠

两个多边形的内部区域相交：

```
   ┌───────┐
   │   A   │
   │   ┌───┼───┐
   └───┼───┘   │
       │   B   │
       └───────┘
```

重叠区域违反了"不重叠"条件。

### 2. 边缘不匹配

相邻多边形的边界没有精确对齐：

```
   ┌─────────┐
   │    A    │
   └─────●───┘    ← 顶点不一致
   ┌───────┬─┐
   │   B   │ │
   └───────┴─┘
```

这可能是由于数据精度问题或编辑错误导致的。

### 3. 狭窄间隙

虽然间隙是允许的，但过于狭窄的间隙可能表示边缘不匹配：

```
   ┌─────────┐
   │    A    │
   └─────────┘
         ║     ← 狭窄间隙
   ┌─────────┐
   │    B    │
   └─────────┘
```

## 间隙检测

JTS 提供了专门的间隙检测功能：

```java
import org.locationtech.jts.coverage.CoverageGapFinder;

Geometry[] coverage = ...;

// 检测间隙
double gapWidth = 1.0;  // 间隙宽度阈值
CoverageGapFinder gapFinder = new CoverageGapFinder(coverage, gapWidth);
Geometry gaps = gapFinder.getGaps();

if (!gaps.isEmpty()) {
    System.out.println("发现间隙: " + gaps);
}
```

## 诊断信息

验证器提供详细的诊断信息：

```java
CoverageValidator validator = new CoverageValidator(coverage);
Geometry[] invalidPolygons = validator.getInvalidPolygons();

for (int i = 0; i < invalidPolygons.length; i++) {
    if (invalidPolygons[i] != null) {
        System.out.println("多边形 " + i + " 存在问题:");
        System.out.println("  无效边界: " + invalidPolygons[i]);
        
        // 获取边界的类型
        String geomType = invalidPolygons[i].getGeometryType();
        System.out.println("  类型: " + geomType);
        
        // 点 → 可能是重叠区域的角
        // 线 → 不匹配的边界段
        // 多边形 → 重叠区域
    }
}
```

## 错误类型解读

| 返回几何类型 | 可能的问题 |
|------------|-----------|
| Point | 边界接触点问题 |
| LineString | 边界不匹配 |
| Polygon | 与相邻多边形重叠 |
| MultiLineString | 多处边界不匹配 |
| GeometryCollection | 多种问题组合 |

## 验证前的准备

### 1. 确保多边形本身有效

```java
for (int i = 0; i < coverage.length; i++) {
    if (!coverage[i].isValid()) {
        System.out.println("多边形 " + i + " 本身无效");
        // 可以尝试修复
        coverage[i] = coverage[i].buffer(0);
    }
}
```

### 2. 检查空几何

```java
List<Geometry> validPolygons = new ArrayList<>();
for (Geometry g : coverage) {
    if (g != null && !g.isEmpty()) {
        validPolygons.add(g);
    }
}
coverage = validPolygons.toArray(new Geometry[0]);
```

## 与 CoverageCleaner 配合使用

如果验证发现问题，可以使用 `CoverageCleaner` 尝试自动修复：

```java
// 验证
CoverageValidator validator = new CoverageValidator(coverage);
if (!validator.isValid()) {
    // 清理
    CoverageCleaner cleaner = new CoverageCleaner(coverage);
    Geometry[] cleaned = cleaner.clean();
    
    // 重新验证
    CoverageValidator reValidator = new CoverageValidator(cleaned);
    if (reValidator.isValid()) {
        System.out.println("清理成功，覆盖现在有效");
        coverage = cleaned;
    } else {
        System.out.println("清理后仍有问题，可能需要手动修复");
    }
}
```

## 总结

多边形覆盖验证是空间数据质量控制的重要环节。JTS 的 `CoverageValidator` 提供了强大的验证功能，能够识别重叠、边缘不匹配等问题，并提供详细的诊断信息帮助定位和修复问题。

## 参考资料

- [JTS Coverage 包文档](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/coverage/package-summary.html)
- [NetTopologySuite CoverageValidator](https://nettopologysuite.github.io/NetTopologySuite/api/NetTopologySuite.Coverage.CoverageValidator.html)

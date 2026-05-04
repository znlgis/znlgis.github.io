---
layout: default
title: JTS OverlayNG - 节点化策略
---

# JTS OverlayNG - 节点化策略

> 原文：[JTS OverlayNG - Noding Strategies](https://lin-ear-th-inking.blogspot.com/2020/06/jts-overlayng-noding-strategies.html)
> 作者：Martin Davis
> 日期：2020年6月

## 概述

本文是 OverlayNG 系列的深入篇章，专注于介绍 JTS OverlayNG 中的节点化（Noding）策略。节点化是叠加操作的核心组件，OverlayNG 通过可插拔的节点化系统显著提高了鲁棒性和精度。

## 什么是节点化（Noding）？

节点化是指在叠加操作中处理几何图形边的交点的过程。当两个几何图形的边相交时，需要在交点处创建"节点"，以便正确构建拓扑图。节点化的质量直接影响叠加操作的准确性和成功率。

## OverlayNG 的节点化策略

### 1. 浮点精度节点化（MCIndexNoder）

这是默认的快速节点化方法，适用于大多数情况：

```java
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.SegmentStringNoder;

// 使用浮点精度节点化器
SegmentStringNoder noder = new MCIndexNoder();
```

**特点：**
- 速度快
- 适用于大多数标准情况
- 但不完全鲁棒
- 复杂叠加操作可能出现数值误差，导致 `TopologyException`

### 2. 固定精度节点化（SnapRoundingNoder）

提供鲁棒的计算，适用于需要高可靠性的应用：

```java
import org.locationtech.jts.noding.snapround.SnapRoundingNoder;
import org.locationtech.jts.geom.PrecisionModel;

// 使用固定精度节点化器
PrecisionModel pm = new PrecisionModel(1000.0);  // 精度为 0.001
SnapRoundingNoder noder = new SnapRoundingNoder(pm);
```

**特点：**
- 坐标被捕捉到由精度模型定义的网格上
- 防止产生窄条和拓扑错误
- 非常适合需要鲁棒性的应用场景
- 可能略微改变坐标值

### 3. 自定义节点化器

对于高级用例，可以注入自定义的节点化实现：

```java
import org.locationtech.jts.noding.Noder;
import org.locationtech.jts.operation.overlayng.OverlayNG;

// 使用自定义节点化器
Noder customNoder = ...;  // 自定义实现
OverlayNG overlay = new OverlayNG(geomA, geomB, pm, customNoder);
Geometry result = overlay.getResult();
```

## OverlayNGRobust 的渐进式策略

当简单的叠加失败时（由于拓扑崩溃或舍入误差），OverlayNG 使用渐进式方法：

```java
import org.locationtech.jts.operation.overlayng.OverlayNGRobust;

// 使用渐进式鲁棒叠加
Geometry result = OverlayNGRobust.overlay(geomA, geomB, OverlayNG.INTERSECTION);
```

### 渐进式策略步骤

1. **尝试快速浮点精度节点化器**
2. **如果失败**：切换到使用自动计算容差的捕捉节点化器
3. **如果错误持续**：将每个输入几何图形捕捉到自身，然后使用捕捉节点化器进行叠加
4. **分阶段增加容差**并重复
5. **最后**：使用缩放到最大输入精度的快速舍入节点化器

```text
步骤 1: 快速浮点精度
    ↓ 失败
步骤 2: 自动容差捕捉
    ↓ 失败
步骤 3: 自捕捉 + 叠加
    ↓ 失败
步骤 4: 增加容差重试
    ↓ 失败
步骤 5: 最大精度快速舍入
```

这种逐步升级最大程度地减少了叠加失败的可能性，使叠加操作即使在存在"困难"或无效几何图形的情况下也几乎具有确定性和鲁棒性。

## 精度模型详解

### 浮点精度（默认）

```java
import org.locationtech.jts.geom.PrecisionModel;

// 浮点精度（默认）
PrecisionModel floatPM = new PrecisionModel();
```

- 保留原始数据
- 在叠加中可能受到舍入误差的影响

### 固定精度

```java
// 固定精度：小数点后 4 位
PrecisionModel fixedPM = new PrecisionModel(10000.0);

// 固定精度：小数点后 2 位
PrecisionModel fixedPM2 = new PrecisionModel(100.0);
```

- 保证有效性
- 可能略微改变坐标

## 严格模式（Strict Mode）

当启用严格模式时，结果几何图形具有以下特性：

```java
import org.locationtech.jts.operation.overlayng.OverlayNG;

Geometry geomA = ...;
Geometry geomB = ...;

// 创建 OverlayNG 并启用严格模式
OverlayNG overlay = new OverlayNG(geomA, geomB, OverlayNG.INTERSECTION);
overlay.setStrictMode(true);
Geometry result = overlay.getResult();
```

**严格模式特性：**
- 结果几何图形是同质的（只包含一种类型）
- 低维度的片段（如从折叠多边形产生的点或线）被排除
- 输出更简单，适合进一步处理

## 完整代码示例

```java
import org.locationtech.jts.geom.*;
import org.locationtech.jts.operation.overlayng.*;
import org.locationtech.jts.io.WKTReader;

public class NodingStrategiesExample {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        Geometry geomA = reader.read(
            "POLYGON ((0 0, 100 0, 100 100, 0 100, 0 0))");
        Geometry geomB = reader.read(
            "POLYGON ((50 50, 150 50, 150 150, 50 150, 50 50))");
        
        // 方法1：使用默认浮点精度
        Geometry result1 = OverlayNGRobust.overlay(
            geomA, geomB, OverlayNG.INTERSECTION);
        System.out.println("默认精度结果: " + result1);
        
        // 方法2：使用固定精度
        PrecisionModel pm = new PrecisionModel(1000.0);
        Geometry result2 = OverlayNG.overlay(
            geomA, geomB, OverlayNG.INTERSECTION, pm);
        System.out.println("固定精度结果: " + result2);
        
        // 方法3：使用严格模式
        OverlayNG overlay = new OverlayNG(
            geomA, geomB, OverlayNG.UNION);
        overlay.setStrictMode(true);
        Geometry result3 = overlay.getResult();
        System.out.println("严格模式结果: " + result3);
    }
}
```

## 为什么节点化策略重要？

### 鲁棒性
确保并集和交集等操作几乎总是成功，即使使用复杂或"脏"数据也是如此。

### 可插拔性
开发人员可以选择或自定义节点化策略以实现速度或精度的平衡，在性能和鲁棒性之间取得平衡。

### 可链接性
严格模式产生更简单的几何图形，可以在后续叠加中直接使用，无需预处理。

## 在其他库中的实现

- **GEOS**: `OverlayNGRobust` 类提供类似功能
- **NetTopologySuite**: .NET 版本的 OverlayNG 实现
- **PostGIS**: 通过 GEOS 间接使用这些优化

## 总结

OverlayNG 的节点化策略代表了空间叠加技术的重大飞跃。通过可插拔的节点化系统和渐进式鲁棒性方法，开发人员可以在 GIS 处理中实现可定制和渐进式的精度与可靠性方法。这意味着"失败"的叠加操作大大减少，结果更可预测，并且对几何操作有高级控制。

## 参考资料

- [OverlayNG JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/overlayng/OverlayNG.html)
- [OverlayNGRobust JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/overlayng/OverlayNGRobust.html)
- [NetTopologySuite Noding 文档](https://deepwiki.com/NetTopologySuite/NetTopologySuite/5.2-noding-and-precision)

---
layout: post
title: "JTS 中修复无效几何图形"
date: 2029-07-24 10:00:00 +0800
categories: [GIS, JTS]
tags: [JTS]
---

# JTS 中修复无效几何图形

> 原文：[Fixing Invalid Geometry with JTS](https://lin-ear-th-inking.blogspot.com/2021/05/fixing-invalid-geometry-with-jts.html)
> 作者：Martin Davis
> 日期：2021年5月

## 概述

几何有效性是空间数据处理的基础。JTS 不仅能够检测无效几何图形，还提供了自动修复无效几何图形的功能。本文介绍 JTS 中的几何验证和修复机制，以及它们如何符合 OGC Simple Features 规范。

## OGC 几何有效性规范

JTS 使用 OGC（开放地理空间联盟）Simple Features 规范定义的几何模型。该规范对有效几何图形有严格的规则：

### 多边形有效性规则

1. **环必须闭合**：多边形的外环和内环（孔洞）必须首尾相连
2. **孔洞必须在外环内**：内环必须完全包含在外环内
3. **环不能自相交**：不能形成"8"字形
4. **环不能相互交叉**：内环之间不能重叠
5. **内环方向**：内环的方向应与外环相反

```java
// 有效的多边形
POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))

// 无效的多边形 - 自相交（8字形）
POLYGON ((0 0, 10 10, 10 0, 0 10, 0 0))

// 无效的多边形 - 未闭合
POLYGON ((0 0, 10 0, 10 10, 0 10))
```

### 线串有效性规则

1. **至少两个点**：LineString 必须有至少两个不同的点
2. **环必须闭合**：LinearRing 的首尾点必须相同

### 为什么有效性重要？

无效几何图形会导致：
- **面积计算错误**：自相交多边形可能计算出面积为 0
- **叠加操作失败**：交集、并集等操作可能产生错误结果
- **拓扑检查异常**：空间关系判断可能不准确

## 验证几何图形

### 使用 isValid() 方法

```java
import org.locationtech.jts.geom.*;
import org.locationtech.jts.io.WKTReader;

public class GeometryValidation {
    public static void main(String[] args) throws Exception {
        GeometryFactory factory = new GeometryFactory();
        WKTReader reader = new WKTReader(factory);
        
        // 有效的多边形
        Geometry validPolygon = reader.read(
            "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
        System.out.println("有效多边形 isValid: " + validPolygon.isValid());
        // 输出: true
        
        // 无效的多边形 - 自相交
        Geometry invalidPolygon = reader.read(
            "POLYGON ((0 0, 10 10, 10 0, 0 10, 0 0))");
        System.out.println("无效多边形 isValid: " + invalidPolygon.isValid());
        // 输出: false
    }
}
```

### 获取详细的验证错误信息

```java
import org.locationtech.jts.operation.valid.IsValidOp;
import org.locationtech.jts.operation.valid.TopologyValidationError;

public class DetailedValidation {
    public static void validateWithDetails(Geometry geom) {
        IsValidOp validOp = new IsValidOp(geom);
        
        if (!validOp.isValid()) {
            TopologyValidationError error = validOp.getValidationError();
            
            System.out.println("错误类型: " + error.getErrorType());
            System.out.println("错误消息: " + error.getMessage());
            System.out.println("错误位置: " + error.getCoordinate());
        } else {
            System.out.println("几何图形有效");
        }
    }
}
```

### 常见的验证错误类型

| 错误类型 | 描述 |
|---------|------|
| SELF_INTERSECTION | 环自相交 |
| RING_NOT_CLOSED | 环未闭合 |
| HOLE_OUTSIDE_SHELL | 孔洞在外环外 |
| NESTED_HOLES | 孔洞嵌套 |
| DISCONNECTED_INTERIOR | 内部不连通 |
| DUPLICATE_RINGS | 重复的环 |
| TOO_FEW_POINTS | 点数过少 |

## 修复无效几何图形

### 使用 buffer(0) 修复

最简单的修复方法是使用零距离缓冲区：

```java
public Geometry fixWithBuffer(Geometry geom) {
    if (!geom.isValid()) {
        // 使用 buffer(0) 修复
        return geom.buffer(0);
    }
    return geom;
}
```

**注意**：`buffer(0)` 方法：
- 对于大多数自相交问题有效
- 可能改变几何图形的拓扑结构
- 不保证保留所有原始特征

### 使用 GeometryFixer 修复

JTS 1.18+ 引入了专门的 `GeometryFixer` 类：

```java
import org.locationtech.jts.geom.util.GeometryFixer;

public class FixWithGeometryFixer {
    public static Geometry fixGeometry(Geometry geom) {
        if (!geom.isValid()) {
            GeometryFixer fixer = new GeometryFixer(geom);
            return fixer.getResult();
        }
        return geom;
    }
    
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        
        // 自相交的多边形
        Geometry invalid = reader.read(
            "POLYGON ((0 0, 10 10, 10 0, 0 10, 0 0))");
        
        System.out.println("原始几何: " + invalid);
        System.out.println("是否有效: " + invalid.isValid());
        
        // 修复
        Geometry fixed = fixGeometry(invalid);
        
        System.out.println("修复后几何: " + fixed);
        System.out.println("是否有效: " + fixed.isValid());
    }
}
```

### GeometryFixer 的修复策略

`GeometryFixer` 对不同类型的无效性采用不同的修复策略：

```java
import org.locationtech.jts.geom.util.GeometryFixer;

public class GeometryFixerOptions {
    
    /**
     * 使用自定义选项修复几何图形
     */
    public static Geometry fixWithOptions(Geometry geom, boolean keepCollapsed) {
        GeometryFixer fixer = new GeometryFixer(geom);
        
        // 是否保留退化（崩塌）的几何图形
        fixer.setKeepCollapsed(keepCollapsed);
        
        return fixer.getResult();
    }
}
```

**修复的问题类型：**

1. **自相交多边形** → 分割成多个有效多边形
2. **孔洞在外环外** → 移除无效孔洞
3. **嵌套孔洞** → 转换为有效的孔洞结构
4. **重复环** → 移除重复
5. **未闭合环** → 自动闭合

## 批量验证和修复

### 验证几何集合

```java
public class BatchValidation {
    
    /**
     * 验证并报告几何集合中的无效几何
     */
    public static void validateCollection(List<Geometry> geometries) {
        int invalidCount = 0;
        
        for (int i = 0; i < geometries.size(); i++) {
            Geometry geom = geometries.get(i);
            
            if (!geom.isValid()) {
                invalidCount++;
                
                IsValidOp validOp = new IsValidOp(geom);
                TopologyValidationError error = validOp.getValidationError();
                
                System.out.printf("几何 #%d 无效: %s 在 %s%n",
                    i, error.getMessage(), error.getCoordinate());
            }
        }
        
        System.out.printf("总计: %d/%d 无效%n", 
            invalidCount, geometries.size());
    }
    
    /**
     * 批量修复几何集合
     */
    public static List<Geometry> fixCollection(List<Geometry> geometries) {
        List<Geometry> result = new ArrayList<>();
        
        for (Geometry geom : geometries) {
            if (geom.isValid()) {
                result.add(geom);
            } else {
                result.add(new GeometryFixer(geom).getResult());
            }
        }
        
        return result;
    }
}
```

## 预防无效几何

### 最佳实践

1. **验证输入数据**：在处理前验证所有输入几何
2. **使用安全的构造方法**：使用 JTS 的工厂方法创建几何
3. **保持精度一致**：使用一致的精度模型
4. **处理边界情况**：检查空几何和退化几何

```java
public class SafeGeometryCreation {
    private GeometryFactory factory;
    private WKTReader reader;
    
    public SafeGeometryCreation() {
        // 使用固定精度模型
        PrecisionModel pm = new PrecisionModel(1000.0);
        this.factory = new GeometryFactory(pm);
        this.reader = new WKTReader(factory);
    }
    
    /**
     * 安全地创建几何图形
     */
    public Geometry createSafe(String wkt) throws Exception {
        Geometry geom = reader.read(wkt);
        
        // 验证
        if (!geom.isValid()) {
            // 自动修复
            geom = new GeometryFixer(geom).getResult();
        }
        
        return geom;
    }
}
```

## 与其他库的比较

| 功能 | JTS | PostGIS | GEOS |
|------|-----|---------|------|
| 验证 | `isValid()` | `ST_IsValid()` | `GEOSisValid()` |
| 详细错误 | `IsValidOp` | `ST_IsValidReason()` | `GEOSisValidReason()` |
| 修复 | `GeometryFixer` | `ST_MakeValid()` | `GEOSMakeValid()` |

## 总结

JTS 提供了完整的几何验证和修复工具链：

1. **验证**：使用 `isValid()` 快速检查，`IsValidOp` 获取详细信息
2. **修复**：使用 `GeometryFixer` 或 `buffer(0)` 修复无效几何
3. **预防**：使用正确的构造方法和精度模型

遵循 OGC 规范的几何有效性是可靠空间分析的基础。JTS 的修复功能使处理"脏"数据变得更加容易。

## 参考资料

- [JTS IsValidOp JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/valid/IsValidOp.html)
- [JTS GeometryFixer JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/geom/util/GeometryFixer.html)
- [OGC Simple Features 规范](https://www.ogc.org/standards/sfa)
- [PostGIS 几何有效性](https://postgis.net/docs/using_postgis_dbmanagement.html)

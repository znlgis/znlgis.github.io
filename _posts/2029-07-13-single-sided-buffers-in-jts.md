---
layout: post
title: "JTS 中的单侧缓冲区"
date: 2029-07-13 10:00:00 +0800
categories: [GIS, JTS]
tags: [JTS]
---

# JTS 中的单侧缓冲区

> 原文：[Single-Sided Buffers in JTS](https://lin-ear-th-inking.blogspot.com/2010/11/single-sided-buffers-in-jts.html)
> 作者：Martin Davis
> 日期：2010年11月

## 概述

单侧缓冲区（Single-Sided Buffer）是 JTS 2010 年版本添加的重要功能。与标准缓冲区在几何图形两侧创建多边形不同，单侧缓冲区只在线的一侧生成缓冲区。

## 什么是单侧缓冲区？

### 标准缓冲区
标准缓冲区在几何图形的所有方向上扩展指定的距离，创建一个完全包围原始几何图形的多边形。

```
      ╭─────────────────╮
      │                 │
      │    原始线       │
      │    ========     │
      │                 │
      ╰─────────────────╯
         标准缓冲区
```

### 单侧缓冲区
单侧缓冲区只在线的一侧创建多边形：

```
      ═══════════════════
      │                 │
      │   原始线        │
      ╰─────────────────╯
         单侧缓冲区（右侧）
```

## 方向控制

通过缓冲距离的正负号控制缓冲方向：

- **正值**：在线的右侧创建缓冲区
- **负值**：在线的左侧创建缓冲区

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.operation.buffer.BufferOp;
import org.locationtech.jts.operation.buffer.BufferParameters;

Geometry line = ...;

// 创建单侧缓冲区参数
BufferParameters params = new BufferParameters();
params.setSingleSided(true);

// 右侧缓冲区（正值）
double rightDistance = 10.0;
Geometry rightBuffer = BufferOp.bufferOp(line, rightDistance, params);

// 左侧缓冲区（负值）
double leftDistance = -10.0;
Geometry leftBuffer = BufferOp.bufferOp(line, leftDistance, params);
```

## 应用场景

### 1. 道路缓冲区

在道路一侧创建缓冲区，例如：
- 人行道规划
- 停车带
- 噪音缓冲区

```java
// 道路中心线
Geometry roadCenterline = ...;

// 创建道路右侧 3 米的人行道缓冲区
BufferParameters params = new BufferParameters();
params.setSingleSided(true);
Geometry sidewalkArea = BufferOp.bufferOp(roadCenterline, 3.0, params);
```

### 2. 海岸线缓冲区

从海岸线向内陆方向创建缓冲区：
- 海岸侵蚀分析
- 沿海保护区
- 洪水风险区域

```java
// 海岸线
Geometry coastline = ...;

// 向内陆方向创建 100 米缓冲区
BufferParameters params = new BufferParameters();
params.setSingleSided(true);
Geometry coastalZone = BufferOp.bufferOp(coastline, 100.0, params);
```

### 3. 河流管理

在河流一侧创建管理区域：
- 河岸植被带
- 开发限制区
- 生态走廊

## 缓冲区参数配置

### 端点样式（End Cap Style）

对于单侧缓冲区，端点样式总是设置为 `CAP_FLAT`：

```java
BufferParameters params = new BufferParameters();
params.setSingleSided(true);
// 端点样式对单侧缓冲区无效，总是使用 CAP_FLAT
```

### 连接样式（Join Style）

连接样式控制线转角处的处理方式：

```java
BufferParameters params = new BufferParameters();
params.setSingleSided(true);

// 圆角连接（默认）
params.setJoinStyle(BufferParameters.JOIN_ROUND);

// 斜角连接
params.setJoinStyle(BufferParameters.JOIN_MITRE);

// 平角连接
params.setJoinStyle(BufferParameters.JOIN_BEVEL);
```

### 象限段数（Quadrant Segments）

控制曲线近似的精度：

```java
BufferParameters params = new BufferParameters();
params.setSingleSided(true);

// 设置象限段数（默认为 8）
// 数值越大，曲线越平滑
params.setQuadrantSegments(16);
```

### 斜接限制（Mitre Limit）

使用斜角连接时控制尖角的最大长度：

```java
BufferParameters params = new BufferParameters();
params.setSingleSided(true);
params.setJoinStyle(BufferParameters.JOIN_MITRE);

// 设置斜接限制
params.setMitreLimit(5.0);
```

## 代码示例

### 基本用法

```java
import org.locationtech.jts.geom.*;
import org.locationtech.jts.operation.buffer.*;
import org.locationtech.jts.io.WKTReader;

public class SingleSidedBufferExample {
    public static void main(String[] args) throws Exception {
        // 创建测试线
        WKTReader reader = new WKTReader();
        Geometry line = reader.read("LINESTRING (0 0, 100 0, 100 100)");
        
        // 配置单侧缓冲区参数
        BufferParameters params = new BufferParameters();
        params.setSingleSided(true);
        params.setJoinStyle(BufferParameters.JOIN_ROUND);
        params.setQuadrantSegments(8);
        
        // 创建右侧缓冲区
        double distance = 10.0;
        Geometry buffer = BufferOp.bufferOp(line, distance, params);
        
        System.out.println("原始线: " + line);
        System.out.println("单侧缓冲区: " + buffer);
    }
}
```

### 双侧不同宽度

```java
// 创建左右宽度不同的缓冲区
public Geometry createAsymmetricBuffer(Geometry line, 
                                       double leftWidth, 
                                       double rightWidth) {
    BufferParameters params = new BufferParameters();
    params.setSingleSided(true);
    
    // 左侧缓冲区
    Geometry leftBuffer = BufferOp.bufferOp(line, -leftWidth, params);
    
    // 右侧缓冲区
    Geometry rightBuffer = BufferOp.bufferOp(line, rightWidth, params);
    
    // 合并两侧缓冲区
    return leftBuffer.union(rightBuffer);
}
```

## 在其他工具中的支持

单侧缓冲区功能也可在以下工具中使用：

### QGIS
- 处理工具箱 → 矢量几何 → 单侧缓冲区

### PostGIS
```sql
-- PostGIS 中的单侧缓冲区
SELECT ST_Buffer(
    geom,
    10,
    'side=left'
) FROM lines;
```

### Shapely (Python)
```python
from shapely.geometry import LineString
from shapely.ops import single_sided_buffer

line = LineString([(0, 0), (100, 0), (100, 100)])

# 右侧缓冲区
right_buffer = single_sided_buffer(line, 10, side='right')

# 左侧缓冲区
left_buffer = single_sided_buffer(line, 10, side='left')
```

## 注意事项

1. **仅适用于线几何**：单侧缓冲区主要用于 LineString 和 MultiLineString
2. **点几何**：对于点几何，单侧缓冲区与标准缓冲区相同
3. **多边形**：对于多边形，应使用标准缓冲区
4. **方向一致性**：确保线的数字化方向一致，以获得预期的缓冲方向

## 总结

单侧缓冲区是空间分析的重要工具，特别适用于需要在特定方向创建缓冲区的场景。JTS 提供了灵活的参数控制，可以根据不同需求定制缓冲区的形状和精度。

## 参考资料

- [JTS BufferParameters JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/buffer/BufferParameters.html)
- [JTS BufferOp JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/buffer/BufferOp.html)
- [QGIS 单侧缓冲区算法](https://docs.qgis.org/latest/en/docs/user_manual/processing_algs/qgis/vectorgeometry.html#single-sided-buffer)

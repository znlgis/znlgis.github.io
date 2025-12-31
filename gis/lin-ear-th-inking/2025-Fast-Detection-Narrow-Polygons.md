# 使用 JTS 快速检测狭窄多边形

> 原文：[Fast detection of narrow polygons with JTS](https://lin-ear-th-inking.blogspot.com/2025/07/)
> 作者：Martin Davis
> 日期：2025年7月

## 概述

在空间数据处理中，检测"狭窄"多边形是一个常见需求。狭窄多边形（也称为"瘦长"多边形或"条状"多边形）可能是数据质量问题的标志，或者需要特殊处理。JTS 提供了使用最大内切圆（Maximum Inscribed Circle）算法来高效检测这类多边形的能力。

## 什么是狭窄多边形？

狭窄多边形是指宽度相对于其长度很小的多边形。这类多边形可能由于以下原因产生：

- 数据采集误差
- 缓冲区操作的副产品
- 叠加分析产生的细条
- 数据转换时的精度问题

## 最大内切圆算法

### 概念

最大内切圆（Maximum Inscribed Circle, MIC）是完全包含在给定多边形内的最大可能圆。其圆心是多边形内距离边界最远的点，这个点在地理和制图学中被称为**"不可达极点"（Pole of Inaccessibility）**。

### 用于检测狭窄多边形

最大内切圆的半径直接反映了多边形的"宽度"：
- **半径小**：表示多边形狭窄
- **半径大**：表示多边形有足够的内部空间

通过比较最大内切圆半径与多边形的其他度量（如周长、面积或边界框对角线长度），可以识别狭窄多边形。

## JTS 实现

JTS 在 `org.locationtech.jts.algorithm.construct.MaximumInscribedCircle` 类中提供了此算法：

```java
import org.locationtech.jts.algorithm.construct.MaximumInscribedCircle;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.LineString;

Geometry polygon = ...;

// 容差参数控制精度
double tolerance = 0.001;

// 获取最大内切圆的圆心
Point center = MaximumInscribedCircle.getCenter(polygon, tolerance);

// 获取半径线（从圆心到最近边界点）
LineString radiusLine = MaximumInscribedCircle.getRadiusLine(polygon, tolerance);

// 获取半径
double radius = radiusLine.getLength();
```

## 算法原理

最大内切圆算法使用基于网格的逐次逼近方法：

1. **定义边界区域**：确定多边形的边界框
2. **覆盖候选点网格**：在多边形内部覆盖候选点网格
3. **计算距离**：对于每个候选点，计算到边界的最小距离
4. **选择最大距离点**：选择距离最大的点作为圆心候选
5. **细化搜索**：在该圆心周围细化区域，重复直到达到所需精度
6. **返回结果**：返回圆心和半径

该方法使用分支定界策略，空间索引加速点包含检查和距离计算。

## 检测狭窄多边形的实践方法

### 方法1：绝对阈值

```java
public boolean isNarrow(Geometry polygon, double minWidth) {
    double tolerance = minWidth / 100.0;  // 精度设为阈值的 1%
    LineString radiusLine = MaximumInscribedCircle.getRadiusLine(polygon, tolerance);
    double radius = radiusLine.getLength();
    
    // 宽度是半径的两倍
    double width = radius * 2;
    return width < minWidth;
}
```

### 方法2：相对阈值（与边界框比较）

```java
public boolean isNarrowRelative(Geometry polygon, double threshold) {
    // 获取最大内切圆半径
    double tolerance = 0.001;
    LineString radiusLine = MaximumInscribedCircle.getRadiusLine(polygon, tolerance);
    double radius = radiusLine.getLength();
    
    // 获取边界框对角线长度
    Envelope env = polygon.getEnvelopeInternal();
    double diagonal = Math.sqrt(env.getWidth() * env.getWidth() + 
                                env.getHeight() * env.getHeight());
    
    // 计算狭窄度比率
    double narrowRatio = (radius * 2) / diagonal;
    
    return narrowRatio < threshold;
}
```

### 方法3：面积与周长比

```java
public boolean isNarrowByAreaPerimeter(Geometry polygon, double threshold) {
    double area = polygon.getArea();
    double perimeter = polygon.getLength();
    
    // Polsby-Popper 紧凑度分数
    double compactness = (4 * Math.PI * area) / (perimeter * perimeter);
    
    // 结合最大内切圆进一步验证
    double tolerance = 0.001;
    LineString radiusLine = MaximumInscribedCircle.getRadiusLine(polygon, tolerance);
    double radius = radiusLine.getLength();
    
    // 如果紧凑度低且半径小，则为狭窄多边形
    return compactness < threshold && radius < Math.sqrt(area) / 10;
}
```

## 支持的几何类型

MaximumInscribedCircle 算法支持：
- 简单多边形
- 带孔的多边形
- 多多边形（MultiPolygon）

## 在其他库中的可用性

- **Shapely** (Python): `shapely.constructive.maximum_inscribed_circle`
- **GeoPandas** (Python): `GeoSeries.maximum_inscribed_circle()`
- **PostGIS** (SQL): `ST_MaximumInscribedCircle`（需要 GEOS ≥ 3.9）
- **GEOS** (C++): `geos::algorithm::construct::MaximumInscribedCircle`

## 应用场景

1. **数据质量控制**：识别可能存在问题的狭窄多边形
2. **制图标签放置**：找到标签的最佳位置（不可达极点）
3. **几何拟合**：度量学和质量控制中的应用
4. **空间分析**：识别区域内的"最远"点

## 总结

使用最大内切圆算法检测狭窄多边形是一种高效且准确的方法。JTS 提供了稳健的实现，可以轻松集成到空间数据处理工作流中。

## 参考资料

- [JTS MaximumInscribedCircle JavaDoc](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/algorithm/construct/MaximumInscribedCircle.html)
- [PostGIS ST_MaximumInscribedCircle](https://postgis.net/docs/ST_MaximumInscribedCircle.html)
- [GeoPandas maximum_inscribed_circle](https://geopandas.org/en/latest/docs/reference/api/geopandas.GeoSeries.maximum_inscribed_circle.html)

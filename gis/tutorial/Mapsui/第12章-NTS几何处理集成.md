---
layout: default
title: 第12章 - NTS几何处理集成
---

# 第12章：NTS几何处理集成

## 12.1 NetTopologySuite 概述

### 12.1.1 NTS 简介

NetTopologySuite (NTS) 是 JTS Topology Suite 的 .NET 移植版本，提供了强大的空间数据模型和空间分析功能。Mapsui 通过 `Mapsui.Nts` 包与 NTS 深度集成。

```csharp
// 安装必要的 NuGet 包
// Install-Package Mapsui.Nts
// Install-Package NetTopologySuite

using NetTopologySuite.Geometries;
using Mapsui.Nts;
```

### 12.1.2 几何类型

| NTS 类型 | 描述 | WKT 示例 |
|---------|------|---------|
| Point | 点 | `POINT(116.4 39.9)` |
| LineString | 线 | `LINESTRING(0 0, 10 10, 20 0)` |
| Polygon | 多边形 | `POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))` |
| MultiPoint | 多点 | `MULTIPOINT((0 0), (10 10))` |
| MultiLineString | 多线 | `MULTILINESTRING((0 0, 10 10), (20 20, 30 30))` |
| MultiPolygon | 多多边形 | `MULTIPOLYGON(((0 0, 10 0, 10 10, 0 0)))` |
| GeometryCollection | 几何集合 | 混合几何类型 |

## 12.2 创建几何对象

### 12.2.1 GeometryFactory

```csharp
// 创建 GeometryFactory
var geometryFactory = new GeometryFactory(new PrecisionModel(), 3857);

// 创建点
var point = geometryFactory.CreatePoint(new Coordinate(116.4, 39.9));

// 创建线
var lineCoords = new[]
{
    new Coordinate(0, 0),
    new Coordinate(10, 10),
    new Coordinate(20, 0)
};
var line = geometryFactory.CreateLineString(lineCoords);

// 创建多边形（闭合环）
var polygonCoords = new[]
{
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)  // 首尾相连
};
var polygon = geometryFactory.CreatePolygon(polygonCoords);

// 创建带孔的多边形
var shell = geometryFactory.CreateLinearRing(new[]
{
    new Coordinate(0, 0),
    new Coordinate(100, 0),
    new Coordinate(100, 100),
    new Coordinate(0, 100),
    new Coordinate(0, 0)
});

var hole = geometryFactory.CreateLinearRing(new[]
{
    new Coordinate(20, 20),
    new Coordinate(80, 20),
    new Coordinate(80, 80),
    new Coordinate(20, 80),
    new Coordinate(20, 20)
});

var polygonWithHole = geometryFactory.CreatePolygon(shell, new[] { hole });
```

### 12.2.2 WKT 读写

```csharp
using NetTopologySuite.IO;

// WKT 读取
var wktReader = new WKTReader();
var geometry = wktReader.Read("POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");

// WKT 写入
var wktWriter = new WKTWriter();
var wkt = wktWriter.Write(geometry);
Console.WriteLine(wkt);  // POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))
```

### 12.2.3 GeoJSON 读写

```csharp
using NetTopologySuite.IO;

// GeoJSON 读取
var geoJsonReader = new GeoJsonReader();
var geometry = geoJsonReader.Read<Geometry>(geoJson);

// GeoJSON 写入
var geoJsonWriter = new GeoJsonWriter();
var geoJson = geoJsonWriter.Write(geometry);
```

## 12.3 GeometryFeature

### 12.3.1 在 Mapsui 中使用 NTS 几何

```csharp
using Mapsui.Nts;

// 创建 GeometryFeature
var geometryFactory = new GeometryFactory();
var polygon = geometryFactory.CreatePolygon(coordinates);

var feature = new GeometryFeature(polygon);
feature["name"] = "测试多边形";
feature["area"] = polygon.Area;

// 添加样式
feature.Styles = new[] { CreatePolygonStyle() };

// 添加到图层
var layer = new MemoryLayer
{
    Name = "NTS Layer",
    Features = new[] { feature }
};
```

### 12.3.2 从 NTS 几何创建 Mapsui 要素

```csharp
public static class GeometryFeatureFactory
{
    public static IFeature CreateFeature(Geometry geometry)
    {
        return new GeometryFeature(geometry);
    }
    
    public static IEnumerable<IFeature> CreateFeatures(
        IEnumerable<Geometry> geometries)
    {
        return geometries.Select(g => new GeometryFeature(g));
    }
    
    public static GeometryFeature CreatePointFeature(double x, double y)
    {
        var factory = new GeometryFactory();
        var point = factory.CreatePoint(new Coordinate(x, y));
        return new GeometryFeature(point);
    }
    
    public static GeometryFeature CreateLineFeature(
        IEnumerable<(double X, double Y)> points)
    {
        var factory = new GeometryFactory();
        var coords = points.Select(p => new Coordinate(p.X, p.Y)).ToArray();
        var line = factory.CreateLineString(coords);
        return new GeometryFeature(line);
    }
}
```

## 12.4 空间操作

### 12.4.1 缓冲区分析

```csharp
// 创建缓冲区
var point = geometryFactory.CreatePoint(new Coordinate(116.4, 39.9));
var buffer = point.Buffer(1000);  // 1000 米缓冲区

// 单侧缓冲区
var line = geometryFactory.CreateLineString(coordinates);
var leftBuffer = line.Buffer(500, BufferParameters.CAP_FLAT);
```

### 12.4.2 几何运算

```csharp
// 联合 (Union)
var union = geometry1.Union(geometry2);

// 交集 (Intersection)
var intersection = geometry1.Intersection(geometry2);

// 差集 (Difference)
var difference = geometry1.Difference(geometry2);

// 对称差 (SymmetricDifference)
var symDiff = geometry1.SymmetricDifference(geometry2);

// 凸包 (ConvexHull)
var hull = geometry.ConvexHull();

// 简化 (Simplify)
var simplified = TopologyPreservingSimplifier.Simplify(geometry, tolerance);
```

### 12.4.3 空间关系判断

```csharp
// 包含
bool contains = geometry1.Contains(geometry2);

// 相交
bool intersects = geometry1.Intersects(geometry2);

// 相离
bool disjoint = geometry1.Disjoint(geometry2);

// 接触
bool touches = geometry1.Touches(geometry2);

// 覆盖
bool covers = geometry1.Covers(geometry2);

// 被覆盖
bool coveredBy = geometry1.CoveredBy(geometry2);

// 相等
bool equals = geometry1.Equals(geometry2);

// 距离
double distance = geometry1.Distance(geometry2);
```

## 12.5 空间查询

### 12.5.1 空间索引

```csharp
using NetTopologySuite.Index.Strtree;

public class SpatialIndex
{
    private readonly STRtree<IFeature> _index = new();
    
    public void Build(IEnumerable<IFeature> features)
    {
        foreach (var feature in features)
        {
            if (feature is GeometryFeature gf && gf.Geometry != null)
            {
                _index.Insert(gf.Geometry.EnvelopeInternal, feature);
            }
        }
        
        _index.Build();
    }
    
    public IEnumerable<IFeature> Query(Envelope envelope)
    {
        return _index.Query(envelope);
    }
    
    public IEnumerable<IFeature> QueryByPoint(Point point, double tolerance)
    {
        var envelope = new Envelope(
            point.X - tolerance, point.X + tolerance,
            point.Y - tolerance, point.Y + tolerance
        );
        return Query(envelope);
    }
}
```

### 12.5.2 在视口范围内查询

```csharp
public IEnumerable<IFeature> QueryFeaturesInExtent(
    IEnumerable<IFeature> features,
    MRect extent)
{
    var envelope = new Envelope(
        extent.MinX, extent.MaxX,
        extent.MinY, extent.MaxY
    );
    
    return features
        .OfType<GeometryFeature>()
        .Where(f => f.Geometry?.EnvelopeInternal.Intersects(envelope) == true);
}
```

## 12.6 几何编辑

### 12.6.1 顶点编辑

```csharp
public class GeometryEditor
{
    public static Geometry MoveVertex(
        Geometry geometry, 
        int vertexIndex, 
        Coordinate newPosition)
    {
        var coords = geometry.Coordinates.ToArray();
        
        if (vertexIndex >= 0 && vertexIndex < coords.Length)
        {
            coords[vertexIndex] = newPosition;
        }
        
        return RebuildGeometry(geometry, coords);
    }
    
    public static Geometry AddVertex(
        LineString line,
        int afterIndex,
        Coordinate newVertex)
    {
        var coords = line.Coordinates.ToList();
        coords.Insert(afterIndex + 1, newVertex);
        
        return new GeometryFactory().CreateLineString(coords.ToArray());
    }
    
    public static Geometry RemoveVertex(
        Geometry geometry,
        int vertexIndex)
    {
        var coords = geometry.Coordinates.ToList();
        
        if (vertexIndex >= 0 && vertexIndex < coords.Count)
        {
            coords.RemoveAt(vertexIndex);
        }
        
        return RebuildGeometry(geometry, coords.ToArray());
    }
    
    private static Geometry RebuildGeometry(
        Geometry original, 
        Coordinate[] newCoords)
    {
        var factory = original.Factory;
        
        return original switch
        {
            Point => factory.CreatePoint(newCoords[0]),
            LineString => factory.CreateLineString(newCoords),
            Polygon => factory.CreatePolygon(newCoords),
            _ => throw new NotSupportedException()
        };
    }
}
```

### 12.6.2 几何变换

```csharp
using NetTopologySuite.Geometries.Utilities;

// 平移
var translated = AffineTransformation.TranslationInstance(dx, dy)
    .Transform(geometry);

// 旋转
var rotated = AffineTransformation.RotationInstance(
    Math.PI / 4,  // 45度
    centerX, centerY
).Transform(geometry);

// 缩放
var scaled = AffineTransformation.ScaleInstance(
    scaleX, scaleY,
    centerX, centerY
).Transform(geometry);
```

## 12.7 实用工具类

### 12.7.1 几何工具

```csharp
public static class GeometryUtils
{
    /// <summary>
    /// 计算几何的中心点
    /// </summary>
    public static Point GetCentroid(Geometry geometry)
    {
        return geometry.Centroid;
    }
    
    /// <summary>
    /// 计算多边形面积（平方米）
    /// </summary>
    public static double CalculateArea(Polygon polygon)
    {
        // 如果是 Web Mercator，需要转换计算
        return polygon.Area;
    }
    
    /// <summary>
    /// 计算线长度（米）
    /// </summary>
    public static double CalculateLength(LineString line)
    {
        return line.Length;
    }
    
    /// <summary>
    /// 检查几何是否有效
    /// </summary>
    public static bool IsValid(Geometry geometry)
    {
        return geometry.IsValid;
    }
    
    /// <summary>
    /// 修复无效几何
    /// </summary>
    public static Geometry MakeValid(Geometry geometry)
    {
        if (geometry.IsValid) return geometry;
        return geometry.Buffer(0);  // 常用的修复方法
    }
    
    /// <summary>
    /// 简化几何
    /// </summary>
    public static Geometry Simplify(Geometry geometry, double tolerance)
    {
        return TopologyPreservingSimplifier.Simplify(geometry, tolerance);
    }
}
```

## 12.8 本章小结

本章详细介绍了 Mapsui 与 NTS 的集成：

1. **NTS 概述**：几何类型和 GeometryFactory
2. **创建几何对象**：点、线、多边形的创建
3. **GeometryFeature**：在 Mapsui 中使用 NTS 几何
4. **空间操作**：缓冲区、联合、交集等运算
5. **空间关系**：包含、相交、距离等判断
6. **空间查询**：空间索引和范围查询
7. **几何编辑**：顶点编辑和几何变换

在下一章中，我们将学习导航与视图控制。

## 12.9 思考与练习

1. 实现一个要素属性编辑器，支持修改几何和属性。
2. 创建一个空间分析工具，计算两个多边形的重叠面积。
3. 实现一个几何简化功能，根据当前缩放级别动态简化几何。
4. 创建一个多边形分割工具。
5. 实现一个路径分析功能，找出两点间的最短路径。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/Mapsui/第12章-NTS几何处理集成/第11章-瓦片图层与地图服务/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/Mapsui/第12章-NTS几何处理集成/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/Mapsui/第12章-NTS几何处理集成/第13章-导航与视图控制/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

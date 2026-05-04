---
layout: default
title: 第01章：NetTopologySuite 概述与入门
---

# 第01章：NetTopologySuite 概述与入门

## 1.1 NetTopologySuite 简介

NetTopologySuite（简称 NTS）是一个功能强大的 .NET 空间数据处理库，是 Java Topology Suite（JTS）的 .NET 移植版本。它提供了完整的几何对象模型和丰富的空间分析功能，是 .NET 平台上最流行和最成熟的开源 GIS 库之一。

### 1.1.1 项目背景

NetTopologySuite 最初由 Diego Guidi 在 2004 年开始移植，经过近二十年的发展，已经成为 .NET GIS 开发的事实标准。该项目托管在 GitHub 的 NetTopologySuite 组织下，目前由一个活跃的开源社区维护。

**项目地址**：https://github.com/NetTopologySuite/NetTopologySuite

### 1.1.2 核心特性

NetTopologySuite 提供以下核心特性：

1. **完整的几何模型**
   - 支持 OGC Simple Features Specification 定义的所有几何类型
   - Point、LineString、Polygon、MultiPoint、MultiLineString、MultiPolygon、GeometryCollection
   - 支持二维、三维坐标系统

2. **空间关系判断**
   - 支持所有 OGC 标准空间关系谓词
   - Equals、Contains、Within、Intersects、Touches、Crosses、Overlaps、Disjoint
   - 基于 DE-9IM（九交模型）的精确空间关系计算

3. **几何运算**
   - 布尔运算：Union（并集）、Intersection（交集）、Difference（差集）、SymmetricDifference（对称差集）
   - 缓冲区分析、凸包计算、质心计算
   - 几何简化、几何验证和修复

4. **空间索引**
   - R-Tree 空间索引
   - Quadtree 四叉树索引
   - STRtree 排序瓦片递归树

5. **坐标转换**
   - 支持仿射变换
   - 几何旋转、缩放、平移

6. **输入输出**
   - WKT（Well-Known Text）格式
   - WKB（Well-Known Binary）格式
   - GeoJSON 格式
   - Shapefile 格式

### 1.1.3 与 JTS 的关系

NetTopologySuite 是 JTS 的 .NET 移植版本，两者保持高度一致：

| 特性 | JTS | NetTopologySuite |
|------|-----|------------------|
| 语言 | Java | C# (.NET) |
| 几何模型 | 完全相同 | 完全相同 |
| 空间算法 | 完全相同 | 完全相同 |
| API 风格 | Java 风格 | .NET 风格 |
| 命名空间 | org.locationtech.jts | NetTopologySuite |

### 1.1.4 应用场景

NetTopologySuite 广泛应用于以下场景：

- **GIS 桌面应用**：地图编辑、空间分析工具
- **Web GIS 服务**：后端空间计算、地图服务
- **空间数据库**：EF Core 空间扩展、数据格式转换
- **数据处理**：空间数据 ETL、批量空间分析
- **CAD/CAM 系统**：几何计算、碰撞检测
- **游戏开发**：空间查询、地形分析

## 1.2 NetTopologySuite 组织项目概览

NetTopologySuite 组织在 GitHub 上维护了多个相关项目，形成了完整的 .NET GIS 生态系统。

### 1.2.1 核心库

#### NetTopologySuite（核心库）
- **项目地址**：https://github.com/NetTopologySuite/NetTopologySuite
- **NuGet 包**：`NetTopologySuite`
- **功能**：提供核心几何模型和空间算法
- **版本**：当前主要版本为 2.x

```bash
# 安装核心库
dotnet add package NetTopologySuite
```

#### NetTopologySuite.Features
- **NuGet 包**：`NetTopologySuite.Features`
- **功能**：提供 Feature 和 FeatureCollection 类，支持几何+属性的组合数据模型

```bash
dotnet add package NetTopologySuite.Features
```

### 1.2.2 IO 模块（输入/输出）

#### NetTopologySuite.IO.GeoJSON
- **项目地址**：https://github.com/NetTopologySuite/NetTopologySuite.IO.GeoJSON
- **NuGet 包**：`NetTopologySuite.IO.GeoJSON`
- **功能**：GeoJSON 格式读写，支持 Newtonsoft.Json 和 System.Text.Json

```bash
dotnet add package NetTopologySuite.IO.GeoJSON
```

#### NetTopologySuite.IO.Esri.Shapefile
- **项目地址**：https://github.com/NetTopologySuite/NetTopologySuite.IO.Esri
- **NuGet 包**：`NetTopologySuite.IO.Esri.Shapefile`
- **功能**：Shapefile 格式读写，包括 .shp、.shx、.dbf 文件

```bash
dotnet add package NetTopologySuite.IO.Esri.Shapefile
```

#### NetTopologySuite.IO.PostGis
- **NuGet 包**：`Npgsql.NetTopologySuite`
- **功能**：PostgreSQL/PostGIS 空间数据库支持

```bash
dotnet add package Npgsql.NetTopologySuite
```

#### NetTopologySuite.IO.SqlServerBytes
- **NuGet 包**：`NetTopologySuite.IO.SqlServerBytes`
- **功能**：SQL Server 空间数据类型支持

```bash
dotnet add package NetTopologySuite.IO.SqlServerBytes
```

#### NetTopologySuite.IO.VectorTiles
- **项目地址**：https://github.com/NetTopologySuite/NetTopologySuite.IO.VectorTiles
- **NuGet 包**：`NetTopologySuite.IO.VectorTiles`、`NetTopologySuite.IO.VectorTiles.Mapbox`
- **功能**：Mapbox 矢量切片生成和读取

```bash
dotnet add package NetTopologySuite.IO.VectorTiles.Mapbox
```

#### NetTopologySuite.IO.GPX
- **NuGet 包**：`NetTopologySuite.IO.GPX`
- **功能**：GPX 格式读写，用于 GPS 轨迹数据

```bash
dotnet add package NetTopologySuite.IO.GPX
```

#### NetTopologySuite.IO.TinyWKB
- **NuGet 包**：`NetTopologySuite.IO.TinyWKB`
- **功能**：Tiny WKB 格式支持，用于高效二进制传输

```bash
dotnet add package NetTopologySuite.IO.TinyWKB
```

### 1.2.3 数据库集成

#### EF Core SQL Server 集成
- **NuGet 包**：`Microsoft.EntityFrameworkCore.SqlServer.NetTopologySuite`
- **功能**：SQL Server 空间数据类型与 EF Core 集成

```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer.NetTopologySuite
```

#### EF Core PostgreSQL 集成
- **NuGet 包**：`Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite`
- **功能**：PostGIS 与 EF Core 集成

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite
```

### 1.2.4 坐标系统与投影

#### ProjNet4GeoAPI
- **项目地址**：https://github.com/NetTopologySuite/ProjNet4GeoAPI
- **NuGet 包**：`ProjNet`
- **功能**：坐标系统定义和坐标转换

```bash
dotnet add package ProjNet
```

### 1.2.5 其他相关项目

#### NetTopologySuite.Curve
- **功能**：曲线几何支持（CircularString、CompoundCurve 等）

#### VectorTileLayers
- **功能**：矢量切片图层，用于 Mapsui 等地图库

## 1.3 安装与配置

### 1.3.1 环境要求

- **.NET 版本**：.NET Standard 2.0 或更高版本
  - .NET Framework 4.6.1+
  - .NET Core 2.0+
  - .NET 5.0/6.0/7.0/8.0
- **开发工具**：
  - Visual Studio 2019/2022
  - JetBrains Rider
  - Visual Studio Code + C# 扩展

### 1.3.2 使用 NuGet 安装

**通过 .NET CLI 安装：**

```bash
# 安装核心库
dotnet add package NetTopologySuite

# 安装常用扩展
dotnet add package NetTopologySuite.Features
dotnet add package NetTopologySuite.IO.GeoJSON
dotnet add package NetTopologySuite.IO.Esri.Shapefile
dotnet add package ProjNet
```

**通过 Package Manager Console 安装：**

```powershell
Install-Package NetTopologySuite
Install-Package NetTopologySuite.Features
Install-Package NetTopologySuite.IO.GeoJSON
Install-Package NetTopologySuite.IO.Esri.Shapefile
Install-Package ProjNet
```

**通过 PackageReference 添加：**

```xml
<ItemGroup>
    <PackageReference Include="NetTopologySuite" Version="2.5.0" />
    <PackageReference Include="NetTopologySuite.Features" Version="2.2.0" />
    <PackageReference Include="NetTopologySuite.IO.GeoJSON" Version="4.0.0" />
    <PackageReference Include="NetTopologySuite.IO.Esri.Shapefile" Version="1.0.0" />
    <PackageReference Include="ProjNet" Version="2.0.0" />
</ItemGroup>
```

### 1.3.3 验证安装

创建一个简单的控制台应用来验证安装：

```csharp
using NetTopologySuite.Geometries;

// 创建几何工厂
var geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

// 创建一个点
var point = geometryFactory.CreatePoint(new Coordinate(116.4074, 39.9042));

Console.WriteLine($"几何类型: {point.GeometryType}");
Console.WriteLine($"坐标: {point.X}, {point.Y}");
Console.WriteLine($"SRID: {point.SRID}");
Console.WriteLine($"WKT: {point.AsText()}");

// 输出:
// 几何类型: Point
// 坐标: 116.4074, 39.9042
// SRID: 4326
// WKT: POINT (116.4074 39.9042)
```

## 1.4 基本概念

### 1.4.1 几何类型层次结构

NetTopologySuite 的几何类型遵循 OGC Simple Features Specification：

```
Geometry (抽象基类)
├── Point (点)
├── Curve (曲线，抽象)
│   └── LineString (线串)
│       └── LinearRing (闭合环)
├── Surface (面，抽象)
│   └── Polygon (多边形)
└── GeometryCollection (几何集合)
    ├── MultiPoint (多点)
    ├── MultiLineString (多线)
    └── MultiPolygon (多面)
```

### 1.4.2 GeometryFactory

`GeometryFactory` 是创建几何对象的工厂类，用于确保几何对象的一致性：

```csharp
// 创建默认工厂
var factory = new GeometryFactory();

// 创建带有精度模型的工厂
var precisionModel = new PrecisionModel(1000); // 保留3位小数
var factory2 = new GeometryFactory(precisionModel);

// 创建带有 SRID 的工厂
var factory3 = new GeometryFactory(new PrecisionModel(), 4326); // WGS84

// 使用全局服务获取工厂
var factory4 = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
```

### 1.4.3 Coordinate 与 CoordinateSequence

`Coordinate` 类表示单个坐标点：

```csharp
// 二维坐标
var coord2d = new Coordinate(116.4074, 39.9042);

// 三维坐标（带高程）
var coord3d = new CoordinateZ(116.4074, 39.9042, 100.0);

// 带 M 值的坐标
var coordM = new CoordinateM(116.4074, 39.9042, 1.0);

// 带高程和 M 值的坐标
var coordZM = new CoordinateZM(116.4074, 39.9042, 100.0, 1.0);
```

`CoordinateSequence` 是坐标序列，用于高效存储多个坐标：

```csharp
var sequenceFactory = new CoordinateArraySequenceFactory();
var coordinates = new Coordinate[]
{
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
};
var sequence = sequenceFactory.Create(coordinates);
```

### 1.4.4 PrecisionModel

精度模型控制坐标的数值精度：

```csharp
// 浮点精度（默认）
var floatingPrecision = new PrecisionModel(PrecisionModels.Floating);

// 单精度浮点
var singlePrecision = new PrecisionModel(PrecisionModels.FloatingSingle);

// 固定精度（指定小数位数）
var fixedPrecision = new PrecisionModel(1000); // 3位小数
var fixedPrecision2 = new PrecisionModel(10000); // 4位小数
```

### 1.4.5 SRID（空间参考标识符）

SRID 用于标识几何对象的坐标系统：

```csharp
// 常用 SRID
// 4326 - WGS84 经纬度坐标系
// 3857 - Web Mercator 投影坐标系
// 4490 - CGCS2000 中国大地坐标系

var wgs84Factory = new GeometryFactory(new PrecisionModel(), 4326);
var webMercatorFactory = new GeometryFactory(new PrecisionModel(), 3857);

var point = wgs84Factory.CreatePoint(new Coordinate(116.4074, 39.9042));
Console.WriteLine($"SRID: {point.SRID}"); // 输出: 4326
```

## 1.5 快速开始示例

### 1.5.1 创建基本几何对象

```csharp
using NetTopologySuite.Geometries;

var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 1. 创建点
var point = factory.CreatePoint(new Coordinate(116.4074, 39.9042));
Console.WriteLine($"点: {point.AsText()}");

// 2. 创建线
var lineCoords = new Coordinate[]
{
    new Coordinate(116.38, 39.90),
    new Coordinate(116.40, 39.92),
    new Coordinate(116.42, 39.90)
};
var line = factory.CreateLineString(lineCoords);
Console.WriteLine($"线: {line.AsText()}");

// 3. 创建多边形
var polygonCoords = new Coordinate[]
{
    new Coordinate(116.38, 39.88),
    new Coordinate(116.42, 39.88),
    new Coordinate(116.42, 39.92),
    new Coordinate(116.38, 39.92),
    new Coordinate(116.38, 39.88) // 闭合
};
var polygon = factory.CreatePolygon(polygonCoords);
Console.WriteLine($"多边形: {polygon.AsText()}");

// 4. 计算面积和长度
Console.WriteLine($"多边形面积: {polygon.Area}");
Console.WriteLine($"线长度: {line.Length}");
```

### 1.5.2 空间关系判断

```csharp
using NetTopologySuite.Geometries;

var factory = new GeometryFactory();

// 创建两个多边形
var polygon1 = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10, 10), new Coordinate(0, 10),
    new Coordinate(0, 0)
});

var polygon2 = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(5, 5), new Coordinate(15, 5),
    new Coordinate(15, 15), new Coordinate(5, 15),
    new Coordinate(5, 5)
});

// 判断空间关系
Console.WriteLine($"是否相交: {polygon1.Intersects(polygon2)}");       // true
Console.WriteLine($"是否包含: {polygon1.Contains(polygon2)}");         // false
Console.WriteLine($"是否被包含: {polygon1.Within(polygon2)}");         // false
Console.WriteLine($"是否相邻: {polygon1.Touches(polygon2)}");          // false
Console.WriteLine($"是否重叠: {polygon1.Overlaps(polygon2)}");         // true
Console.WriteLine($"是否相等: {polygon1.Equals(polygon2)}");           // false
Console.WriteLine($"是否分离: {polygon1.Disjoint(polygon2)}");         // false
```

### 1.5.3 几何运算

```csharp
using NetTopologySuite.Geometries;

var factory = new GeometryFactory();

var polygon1 = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10, 10), new Coordinate(0, 10),
    new Coordinate(0, 0)
});

var polygon2 = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(5, 5), new Coordinate(15, 5),
    new Coordinate(15, 15), new Coordinate(5, 15),
    new Coordinate(5, 5)
});

// 几何运算
var intersection = polygon1.Intersection(polygon2);    // 交集
var union = polygon1.Union(polygon2);                  // 并集
var difference = polygon1.Difference(polygon2);        // 差集
var symDifference = polygon1.SymmetricDifference(polygon2); // 对称差集

Console.WriteLine($"交集面积: {intersection.Area}");       // 25
Console.WriteLine($"并集面积: {union.Area}");              // 175
Console.WriteLine($"差集面积: {difference.Area}");         // 75
Console.WriteLine($"对称差集面积: {symDifference.Area}");  // 150

// 缓冲区
var buffer = polygon1.Buffer(5);
Console.WriteLine($"缓冲区面积: {buffer.Area}");

// 凸包
var hull = polygon1.ConvexHull();
Console.WriteLine($"凸包: {hull.AsText()}");

// 质心
var centroid = polygon1.Centroid;
Console.WriteLine($"质心: {centroid.AsText()}");
```

### 1.5.4 WKT 读写

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

// 创建 WKT 读写器
var reader = new WKTReader();
var writer = new WKTWriter();

// 从 WKT 字符串读取几何
var geometry = reader.Read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
Console.WriteLine($"几何类型: {geometry.GeometryType}");
Console.WriteLine($"面积: {geometry.Area}");

// 将几何对象写入 WKT 字符串
var point = new GeometryFactory().CreatePoint(new Coordinate(116.4074, 39.9042));
var wkt = writer.Write(point);
Console.WriteLine($"WKT: {wkt}");  // POINT (116.4074 39.9042)

// 读取复杂几何
var multiPolygon = reader.Read(@"
    MULTIPOLYGON (
        ((0 0, 10 0, 10 10, 0 10, 0 0)),
        ((20 20, 30 20, 30 30, 20 30, 20 20))
    )
");
Console.WriteLine($"几何数量: {multiPolygon.NumGeometries}");
```

## 1.6 与其他 GIS 库的对比

### 1.6.1 NetTopologySuite vs Esri Geometry API for .NET

| 特性 | NetTopologySuite | Esri Geometry API for .NET |
|------|------------------|---------------------------|
| 开源协议 | BSD/LGPL | Apache 2.0 |
| 几何模型 | OGC Simple Features | Esri 扩展模型 |
| 曲线支持 | 有限（通过扩展） | 完整支持 |
| 空间关系 | 完整的 DE-9IM | 完整支持 |
| 性能 | 优秀 | 优秀 |
| 数据库支持 | 丰富（EF Core 集成） | 有限 |
| 文档 | 完善 | 一般 |
| 社区活跃度 | 高 | 中等 |

### 1.6.2 NetTopologySuite vs GDAL/OGR

| 特性 | NetTopologySuite | GDAL/OGR (.NET bindings) |
|------|------------------|--------------------------|
| 安装复杂度 | 简单（纯托管） | 复杂（需要本地库） |
| 几何运算 | 完整 | 依赖 GEOS |
| 格式支持 | 有限 | 非常丰富 |
| 栅格支持 | 无 | 完整支持 |
| 跨平台 | 优秀 | 需要配置 |
| 性能 | 优秀 | 优秀 |

### 1.6.3 选择建议

- **选择 NetTopologySuite**：
  - 纯 .NET 项目，不想依赖本地库
  - 主要进行矢量空间分析
  - 需要与 EF Core 集成
  - 需要简单的部署

- **选择 Esri Geometry API**：
  - 需要完整的曲线几何支持
  - 与 ArcGIS 平台集成

- **选择 GDAL/OGR**：
  - 需要处理多种数据格式
  - 需要栅格数据处理
  - 性能是首要考虑

## 1.7 学习路径建议

### 1.7.1 初级阶段

1. 理解几何类型（Point、LineString、Polygon）
2. 掌握 GeometryFactory 的使用
3. 学习 WKT 格式读写
4. 了解基本空间关系判断

### 1.7.2 中级阶段

1. 掌握所有几何运算方法
2. 学习 GeoJSON 格式处理
3. 学习 Shapefile 文件操作
4. 了解坐标系统和投影转换

### 1.7.3 高级阶段

1. 深入理解 DE-9IM 模型
2. 掌握空间索引的使用
3. EF Core 集成开发
4. 性能优化技巧

## 1.8 本章小结

本章介绍了 NetTopologySuite 的基本概念和入门知识：

1. **项目概述**：NetTopologySuite 是 JTS 的 .NET 移植版本，是 .NET 平台上最流行的开源 GIS 库
2. **项目生态**：了解了 NetTopologySuite 组织下的所有相关项目
3. **安装配置**：学习了如何通过 NuGet 安装和配置
4. **基本概念**：理解了几何类型、工厂类、坐标系统等核心概念
5. **快速示例**：通过代码示例演示了基本的几何操作

在接下来的章节中，我们将深入学习各个功能模块的详细使用方法。

## 1.9 参考资源

### 官方资源

- [NetTopologySuite GitHub 主页](https://github.com/NetTopologySuite/NetTopologySuite)
- [NetTopologySuite 官方文档](https://nettopologysuite.github.io/NetTopologySuite/)
- [NuGet 包页面](https://www.nuget.org/packages/NetTopologySuite/)

### 学习资源

- [JTS Topology Suite](https://locationtech.github.io/jts/)
- [OGC Simple Features Specification](https://www.ogc.org/standards/sfa)
- [DE-9IM 空间关系模型](https://en.wikipedia.org/wiki/DE-9IM)

### 社区资源

- [Stack Overflow - nettopologysuite 标签](https://stackoverflow.com/questions/tagged/nettopologysuite)
- [Gitter 聊天室](https://gitter.im/NetTopologySuite/NetTopologySuite)

---

**下一章预告**：第02章将详细介绍开发环境配置和项目创建，包括 Visual Studio 和 VS Code 的配置方法。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-环境配置与项目创建" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

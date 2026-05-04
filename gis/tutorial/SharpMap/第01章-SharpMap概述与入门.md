---
layout: default
title: 第01章：SharpMap 概述与入门
---

# 第01章：SharpMap 概述与入门

## 1.1 SharpMap 简介

SharpMap 是一个功能强大的开源 .NET GIS 库，专为桌面和 Web 应用程序提供易于使用的地图渲染和空间数据处理功能。它是 .NET 平台上最流行的开源 GIS 解决方案之一，特别适合需要快速构建地图应用的开发者。

### 1.1.1 项目背景

SharpMap 项目最初由 Morten Nielsen 创建，自 2004 年以来一直在持续开发和维护。该项目托管在 GitHub 上，拥有活跃的开发者社区。

**项目地址**：https://github.com/SharpMap/SharpMap

SharpMap 的设计目标是提供一个简单、高效、可扩展的地图库，让开发者能够快速实现地图显示、空间数据访问和基本的空间分析功能。

### 1.1.2 核心特性

SharpMap 提供以下核心特性：

1. **多格式数据支持**
   - 支持 ESRI Shapefile 格式
   - 支持 PostGIS 空间数据库
   - 支持 GeoJSON、KML、GML 等格式
   - 支持 Oracle Spatial、SQL Server Spatial
   - 支持 Spatialite 轻量级空间数据库
   - 通过 OGR 支持更多数据格式

2. **地图渲染**
   - 高质量的矢量图层渲染
   - 栅格图层支持（通过 GDAL 扩展）
   - 瓦片图层支持（通过 BruTile 集成）
   - 动态标注和标签渲染
   - 主题渲染和符号化

3. **图层系统**
   - VectorLayer（矢量图层）
   - LabelLayer（标注图层）
   - TileLayer（瓦片图层）
   - GdalRasterLayer（栅格图层）
   - WmsLayer（WMS 服务图层）

4. **空间查询**
   - 空间范围查询
   - 属性过滤查询
   - 点击查询和要素选择
   - 空间关系判断

5. **样式系统**
   - 简单样式定义
   - 主题渲染（基于属性值）
   - 唯一值渲染
   - 分级渲染
   - 自定义符号

6. **坐标转换**
   - 支持 ProjNet 坐标转换库
   - 支持 DotSpatial Projections
   - 支持动态投影转换

7. **UI 控件**
   - WinForms MapBox 控件
   - WPF 地图控件支持
   - 交互式地图工具

### 1.1.3 应用场景

SharpMap 广泛应用于以下场景：

- **桌面 GIS 应用**：地图浏览、数据编辑、空间分析
- **Web GIS 服务**：地图图片生成、WMS 服务
- **数据可视化**：专题地图、统计地图
- **位置服务**：定位展示、轨迹显示
- **资产管理**：设备分布图、管网管理
- **应急指挥**：事件标注、资源调度

### 1.1.4 技术架构概览

SharpMap 采用分层架构设计：

```
┌─────────────────────────────────────────────────────────────┐
│                     UI 层（UI Layer）                        │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │   MapBox    │  │  MapImage   │  │  WPF Map    │        │
│   │  (WinForms) │  │  (WinForms) │  │   Control   │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                    核心层（Core Layer）                       │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │     Map     │  │   Layers    │  │   Styles    │        │
│   │   (地图)    │  │   (图层)    │  │   (样式)    │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                  数据层（Data Layer）                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │  Providers  │  │ Converters  │  │  Geometry   │        │
│   │ (数据提供者)│  │  (格式转换) │  │   (几何)    │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                 扩展层（Extensions Layer）                    │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │    GDAL     │  │   BruTile   │  │   ProjNet   │        │
│   │  (栅格支持) │  │  (瓦片支持) │  │  (坐标转换) │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 1.2 SharpMap 项目生态

SharpMap 项目生态包括核心库和多个扩展库，形成完整的 GIS 解决方案。

### 1.2.1 核心库

#### SharpMap（核心库）
- **NuGet 包**：`SharpMap`
- **功能**：提供核心地图对象、图层、样式和渲染功能
- **当前版本**：1.2.0

```bash
# 安装核心库
Install-Package SharpMap
```

#### SharpMap.UI
- **NuGet 包**：`SharpMap.UI`
- **功能**：提供 WinForms 地图控件（MapBox、MapImage）

```bash
Install-Package SharpMap.UI
```

### 1.2.2 扩展库

#### SharpMap.Extensions
- **NuGet 包**：`SharpMap.Extensions`
- **功能**：
  - GDAL 栅格图层支持
  - 更多数据提供者
  - 扩展功能

```bash
Install-Package SharpMap.Extensions
```

#### SharpMap.Layers.BruTile
- **NuGet 包**：`SharpMap.Layers.BruTile`
- **功能**：
  - 支持在线瓦片地图
  - OpenStreetMap、Bing Maps 等
  - 自定义瓦片源

```bash
Install-Package SharpMap.Layers.BruTile
```

### 1.2.3 相关依赖库

#### NetTopologySuite (NTS)
SharpMap 使用 NetTopologySuite 作为几何核心库：
- 提供几何对象模型
- 空间关系计算
- 几何运算

#### ProjNet
用于坐标系统和投影转换：
- 支持多种坐标系统定义
- 坐标转换功能

#### BruTile
用于瓦片地图支持：
- 瓦片源管理
- 瓦片缓存
- 多种在线地图服务支持

### 1.2.4 项目依赖关系

```
SharpMap
├── NetTopologySuite
│   └── NetTopologySuite.Features
├── Common.Logging
└── System.Drawing.Common

SharpMap.UI
├── SharpMap
└── System.Windows.Forms

SharpMap.Extensions
├── SharpMap
├── GDAL/OGR
└── Additional Providers

SharpMap.Layers.BruTile
├── SharpMap
├── BruTile
└── BruTile.Desktop
```

## 1.3 安装与配置

### 1.3.1 环境要求

- **.NET Framework**：4.6.1 或更高版本
- **.NET Core/.NET 5+**：部分功能支持
- **操作系统**：Windows（UI 控件）、Linux/macOS（服务端渲染）
- **开发工具**：
  - Visual Studio 2019/2022
  - JetBrains Rider
  - Visual Studio Code

### 1.3.2 使用 NuGet 安装

**通过 Package Manager Console 安装：**

```powershell
# 安装核心库
Install-Package SharpMap

# 安装 UI 控件（WinForms）
Install-Package SharpMap.UI

# 安装扩展库（可选）
Install-Package SharpMap.Extensions

# 安装瓦片图层支持（可选）
Install-Package SharpMap.Layers.BruTile
```

**通过 .NET CLI 安装：**

```bash
dotnet add package SharpMap
dotnet add package SharpMap.UI
dotnet add package SharpMap.Extensions
dotnet add package SharpMap.Layers.BruTile
```

**通过 PackageReference 添加：**

```xml
<ItemGroup>
    <PackageReference Include="SharpMap" Version="1.2.0" />
    <PackageReference Include="SharpMap.UI" Version="1.2.0" />
    <PackageReference Include="SharpMap.Extensions" Version="1.2.0" />
    <PackageReference Include="SharpMap.Layers.BruTile" Version="1.2.0" />
</ItemGroup>
```

### 1.3.3 手动安装

如果需要使用最新的开发版本，可以从 GitHub 下载源码编译：

```bash
# 克隆仓库
git clone https://github.com/SharpMap/SharpMap.git

# 切换到开发分支
cd SharpMap
git checkout develop

# 编译解决方案
dotnet build SharpMap.sln
```

### 1.3.4 验证安装

创建一个简单的控制台应用来验证安装：

```csharp
using System;
using System.Drawing;
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;

class Program
{
    static void Main()
    {
        // 创建地图对象
        var map = new Map(new Size(800, 600));
        
        // 设置背景色
        map.BackColor = Color.White;
        
        Console.WriteLine($"SharpMap 版本验证成功！");
        Console.WriteLine($"地图大小: {map.Size.Width} x {map.Size.Height}");
        Console.WriteLine($"背景颜色: {map.BackColor}");
        Console.WriteLine($"图层数量: {map.Layers.Count}");
    }
}
```

## 1.4 基本概念

### 1.4.1 Map 对象

`Map` 是 SharpMap 的核心类，代表一个完整的地图对象：

```csharp
using SharpMap;
using System.Drawing;

// 创建地图对象
var map = new Map(new Size(800, 600));

// 主要属性
map.BackColor = Color.LightBlue;      // 背景颜色
map.SRID = 4326;                       // 空间参考 ID
map.MinimumZoom = 0.1;                 // 最小缩放比例
map.MaximumZoom = 100000;              // 最大缩放比例

// 图层集合
map.Layers.Add(vectorLayer);           // 添加图层
map.BackgroundLayer.Add(tileLayer);    // 添加背景图层

// 渲染地图
Image mapImage = map.GetMap();
```

### 1.4.2 图层（Layer）

SharpMap 支持多种图层类型：

```csharp
// 1. 矢量图层
var vectorLayer = new VectorLayer("States");
vectorLayer.DataSource = new ShapeFile("states.shp");

// 2. 标注图层
var labelLayer = new LabelLayer("State Labels");
labelLayer.DataSource = vectorLayer.DataSource;
labelLayer.LabelColumn = "STATE_NAME";

// 3. 瓦片图层（需要 BruTile 扩展）
var tileLayer = new TileLayer(tileSource, "OSM");

// 4. 栅格图层（需要 Extensions）
var rasterLayer = new GdalRasterLayer("Raster", "image.tif");
```

### 1.4.3 数据提供者（Provider）

数据提供者负责从数据源读取空间数据：

```csharp
// Shapefile 提供者
var shpProvider = new ShapeFile("data.shp", true);

// PostGIS 提供者
var pgProvider = new PostGIS(connectionString, "tablename", "geom", "gid");

// OGR 提供者（支持多种格式）
var ogrProvider = new Ogr("data.geojson");

// WMS 提供者
var wmsProvider = new WmsClient("http://wms-service-url");
```

### 1.4.4 样式（Style）

样式控制图层的可视化效果：

```csharp
using SharpMap.Styles;
using System.Drawing;

// 矢量样式
var style = new VectorStyle
{
    Fill = new SolidBrush(Color.LightGreen),
    Outline = new Pen(Color.DarkGreen, 1),
    EnableOutline = true
};

// 线样式
var lineStyle = new VectorStyle
{
    Line = new Pen(Color.Blue, 2)
};

// 点样式
var pointStyle = new VectorStyle
{
    PointColor = Brushes.Red,
    PointSize = 10
};

// 应用样式到图层
vectorLayer.Style = style;
```

### 1.4.5 坐标系统

SharpMap 使用 SRID（空间参考标识符）标识坐标系统：

```csharp
// 常用 SRID
// 4326 - WGS84 经纬度
// 3857 - Web Mercator
// 4490 - CGCS2000

// 设置地图坐标系
map.SRID = 4326;

// 设置坐标转换
var ctFactory = new ProjNet.CoordinateSystems.Transformations
    .CoordinateTransformationFactory();
var csFactory = new ProjNet.CoordinateSystems.CoordinateSystemFactory();

// 定义源和目标坐标系
var sourceCS = csFactory.CreateFromWkt(wgs84Wkt);
var targetCS = csFactory.CreateFromWkt(webMercatorWkt);

// 创建转换
var transform = ctFactory.CreateFromCoordinateSystems(sourceCS, targetCS);
vectorLayer.CoordinateTransformation = transform;
```

## 1.5 快速开始示例

### 1.5.1 创建简单地图

```csharp
using System;
using System.Drawing;
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;
using SharpMap.Styles;

class Program
{
    static void Main()
    {
        // 1. 创建地图
        var map = new Map(new Size(800, 600));
        map.BackColor = Color.White;
        
        // 2. 创建矢量图层
        var layer = new VectorLayer("Countries");
        layer.DataSource = new ShapeFile("countries.shp", true);
        
        // 3. 设置样式
        layer.Style = new VectorStyle
        {
            Fill = new SolidBrush(Color.LightYellow),
            Outline = new Pen(Color.Black, 1),
            EnableOutline = true
        };
        
        // 4. 添加图层到地图
        map.Layers.Add(layer);
        
        // 5. 缩放到全图
        map.ZoomToExtents();
        
        // 6. 渲染并保存
        var image = map.GetMap();
        image.Save("output.png");
        
        Console.WriteLine("地图已保存到 output.png");
    }
}
```

### 1.5.2 添加多个图层

```csharp
using System.Drawing;
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;
using SharpMap.Styles;

// 创建地图
var map = new Map(new Size(1024, 768));
map.BackColor = Color.LightBlue;

// 添加面图层（底图）
var polygonLayer = new VectorLayer("Countries");
polygonLayer.DataSource = new ShapeFile("countries.shp", true);
polygonLayer.Style = new VectorStyle
{
    Fill = new SolidBrush(Color.FromArgb(200, 144, 238, 144)),
    Outline = new Pen(Color.DarkGreen, 1),
    EnableOutline = true
};

// 添加线图层（道路）
var lineLayer = new VectorLayer("Roads");
lineLayer.DataSource = new ShapeFile("roads.shp", true);
lineLayer.Style = new VectorStyle
{
    Line = new Pen(Color.Gray, 2)
};

// 添加点图层（城市）
var pointLayer = new VectorLayer("Cities");
pointLayer.DataSource = new ShapeFile("cities.shp", true);
pointLayer.Style = new VectorStyle
{
    PointColor = Brushes.Red,
    PointSize = 8
};

// 按顺序添加图层（先添加的在底部）
map.Layers.Add(polygonLayer);
map.Layers.Add(lineLayer);
map.Layers.Add(pointLayer);

// 缩放到全图并渲染
map.ZoomToExtents();
var image = map.GetMap();
image.Save("multi_layers.png");
```

### 1.5.3 添加标注

```csharp
using System.Drawing;
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;
using SharpMap.Styles;

var map = new Map(new Size(800, 600));

// 添加矢量图层
var vectorLayer = new VectorLayer("States");
vectorLayer.DataSource = new ShapeFile("states.shp", true);
vectorLayer.Style = new VectorStyle
{
    Fill = new SolidBrush(Color.LightGreen),
    Outline = new Pen(Color.DarkGreen, 1),
    EnableOutline = true
};

// 创建标注图层
var labelLayer = new LabelLayer("State Labels");
labelLayer.DataSource = vectorLayer.DataSource;
labelLayer.LabelColumn = "STATE_NAME";  // 标注字段
labelLayer.Style = new LabelStyle
{
    Font = new Font("Arial", 10, FontStyle.Bold),
    ForeColor = Color.Black,
    BackColor = new SolidBrush(Color.FromArgb(150, 255, 255, 255)),
    HorizontalAlignment = LabelStyle.HorizontalAlignmentEnum.Center,
    VerticalAlignment = LabelStyle.VerticalAlignmentEnum.Middle
};
labelLayer.Enabled = true;

// 添加图层
map.Layers.Add(vectorLayer);
map.Layers.Add(labelLayer);

map.ZoomToExtents();
var image = map.GetMap();
image.Save("labeled_map.png");
```

### 1.5.4 主题渲染

```csharp
using System.Drawing;
using SharpMap;
using SharpMap.Layers;
using SharpMap.Data.Providers;
using SharpMap.Styles;
using SharpMap.Rendering.Thematics;

var map = new Map(new Size(800, 600));

// 创建矢量图层
var layer = new VectorLayer("States");
layer.DataSource = new ShapeFile("states.shp", true);

// 创建唯一值主题
var theme = new UniqueValuesTheme<string>("REGION", 
    new VectorStyle { Fill = new SolidBrush(Color.Gray) });

// 添加不同区域的样式
theme.AddStyle("Northeast", new VectorStyle 
{ 
    Fill = new SolidBrush(Color.LightBlue),
    Outline = new Pen(Color.Blue, 1),
    EnableOutline = true
});
theme.AddStyle("Southeast", new VectorStyle 
{ 
    Fill = new SolidBrush(Color.LightGreen),
    Outline = new Pen(Color.Green, 1),
    EnableOutline = true
});
theme.AddStyle("Midwest", new VectorStyle 
{ 
    Fill = new SolidBrush(Color.LightYellow),
    Outline = new Pen(Color.Orange, 1),
    EnableOutline = true
});
theme.AddStyle("West", new VectorStyle 
{ 
    Fill = new SolidBrush(Color.LightPink),
    Outline = new Pen(Color.Red, 1),
    EnableOutline = true
});

// 应用主题
layer.Theme = theme;

map.Layers.Add(layer);
map.ZoomToExtents();
var image = map.GetMap();
image.Save("themed_map.png");
```

## 1.6 与其他 GIS 库的对比

### 1.6.1 SharpMap vs GeoTools

| 特性 | SharpMap | GeoTools |
|------|----------|----------|
| 语言 | C# (.NET) | Java |
| 许可证 | LGPL | LGPL |
| 数据格式支持 | 丰富 | 非常丰富 |
| UI 控件 | WinForms/WPF | Swing |
| 学习曲线 | 平缓 | 较陡 |
| 功能完整度 | 中等 | 非常高 |
| 社区活跃度 | 中等 | 高 |

### 1.6.2 SharpMap vs NetTopologySuite

| 特性 | SharpMap | NetTopologySuite |
|------|----------|------------------|
| 主要用途 | 地图渲染和展示 | 几何计算和分析 |
| UI 支持 | 完整 | 无 |
| 数据读写 | 通过 Provider | 通过 IO 模块 |
| 空间分析 | 基本 | 完整 |
| 互补关系 | SharpMap 使用 NTS 作为几何核心 | |

### 1.6.3 SharpMap vs MapWinGIS

| 特性 | SharpMap | MapWinGIS |
|------|----------|-----------|
| 架构 | 纯托管 (.NET) | ActiveX 组件 |
| 跨平台 | 部分支持 | 仅 Windows |
| 安装复杂度 | 简单 | 需要注册组件 |
| 功能 | 地图渲染 | 地图渲染 + 编辑 |
| 性能 | 良好 | 优秀 |

### 1.6.4 选择建议

- **选择 SharpMap**：
  - 需要快速构建地图应用
  - 主要进行地图展示和简单交互
  - 需要纯 .NET 解决方案
  - WinForms 或 WPF 桌面应用

- **选择 NetTopologySuite**：
  - 主要进行空间分析和几何计算
  - 需要与 Entity Framework 集成
  - 不需要 UI 组件

- **选择 GeoTools**：
  - Java 技术栈项目
  - 需要完整的 GIS 功能

## 1.7 学习路径建议

### 1.7.1 初级阶段

1. **基础概念**
   - 理解 Map、Layer、Provider 的关系
   - 掌握基本的地图创建流程
   - 学习 Shapefile 数据读取

2. **简单应用**
   - 创建第一个 WinForms 地图应用
   - 添加矢量图层并设置样式
   - 实现基本的地图交互（缩放、平移）

### 1.7.2 中级阶段

1. **图层深入**
   - 掌握所有图层类型的使用
   - 学习标注图层配置
   - 了解瓦片图层集成

2. **样式进阶**
   - 主题渲染实现
   - 自定义符号
   - 动态样式

3. **数据访问**
   - 多种数据提供者使用
   - 数据库空间数据访问
   - WMS 服务集成

### 1.7.3 高级阶段

1. **坐标系统**
   - 深入理解投影转换
   - 动态坐标转换

2. **性能优化**
   - 大数据量处理
   - 缓存策略
   - 渲染优化

3. **扩展开发**
   - 自定义数据提供者
   - 自定义图层类型
   - 插件开发

## 1.8 本章小结

本章介绍了 SharpMap 的基本概念和入门知识：

1. **项目概述**：SharpMap 是一个功能强大的开源 .NET GIS 库，专为桌面和 Web 应用提供地图功能
2. **项目生态**：了解了 SharpMap 核心库和扩展库的组成
3. **安装配置**：学习了如何通过 NuGet 安装和配置 SharpMap
4. **基本概念**：理解了 Map、Layer、Provider、Style 等核心概念
5. **快速示例**：通过代码示例演示了基本的地图创建和图层操作

在接下来的章节中，我们将深入学习 SharpMap 的各个功能模块。

## 1.9 参考资源

### 官方资源

- [SharpMap GitHub 主页](https://github.com/SharpMap/SharpMap)
- [SharpMap Wiki 教程](https://github.com/SharpMap/SharpMap/wiki)
- [NuGet 包页面](https://www.nuget.org/packages/SharpMap/)

### 学习资源

- [Syncfusion GIS Succinctly 电子书](https://www.syncfusion.com/succinctly-free-ebooks/gis)
- [SharpMap 示例代码](https://github.com/SharpMap/SharpMap/tree/develop/Examples)
- [NetTopologySuite 文档](https://nettopologysuite.github.io/)

### 社区资源

- [GIS Stack Exchange - SharpMap 标签](https://gis.stackexchange.com/questions/tagged/sharpmap)
- [Stack Overflow - SharpMap 问题](https://stackoverflow.com/questions/tagged/sharpmap)

---

**下一章预告**：第02章将详细介绍开发环境配置和项目创建，包括 Visual Studio 项目配置、引用管理和第一个 SharpMap 应用的创建。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-环境配置与项目创建" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

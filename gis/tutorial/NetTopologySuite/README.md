# NetTopologySuite 完整学习教程

<p align="center">
  <strong>🌍 .NET 平台最强大的开源 GIS 空间数据处理库 🌍</strong>
</p>

## 📖 教程简介

本教程是 NetTopologySuite（NTS）的完整中文学习指南，涵盖从入门到高级的所有内容。NetTopologySuite 是 Java Topology Suite（JTS）的 .NET 移植版本，是 .NET 平台上最流行和最成熟的开源 GIS 库。

## 🎯 适用人群

- 🔰 GIS 开发初学者
- 💼 需要在 .NET 项目中处理空间数据的开发者
- 🎓 学习空间分析算法的学生
- 🔧 构建地图服务和空间数据库应用的工程师

## ✨ 教程特色

- 📝 **完整中文内容**：所有章节均为中文编写
- 💻 **代码示例丰富**：每个知识点都有可运行的代码示例
- 🔄 **循序渐进**：从基础到高级，层层递进
- 🎯 **实战导向**：包含多个实际应用案例

## 📚 目录结构

### 第一部分：基础入门

| 章节 | 内容 | 难度 |
|------|------|------|
| [第01章](第01章-NetTopologySuite概述与入门.md) | NetTopologySuite 概述与入门 | ⭐ |
| [第02章](第02章-环境配置与项目创建.md) | 环境配置与项目创建 | ⭐ |
| [第03章](第03章-几何对象模型详解.md) | 几何对象模型详解 | ⭐⭐ |

### 第二部分：空间分析

| 章节 | 内容 | 难度 |
|------|------|------|
| [第04章](第04章-空间关系与谓词操作.md) | 空间关系与谓词操作 | ⭐⭐ |
| [第05章](第05章-几何运算与叠加分析.md) | 几何运算与叠加分析 | ⭐⭐ |
| [第06章](第06章-空间分析算法.md) | 空间分析算法 | ⭐⭐⭐ |

### 第三部分：数据处理

| 章节 | 内容 | 难度 |
|------|------|------|
| [第07章](第07章-GeoJSON数据处理.md) | GeoJSON 数据处理 | ⭐⭐ |
| [第08章](第08章-Shapefile文件操作.md) | Shapefile 文件操作 | ⭐⭐ |

### 第四部分：数据库集成

| 章节 | 内容 | 难度 |
|------|------|------|
| [第09章](第09章-PostGIS数据库集成.md) | PostGIS 数据库集成 | ⭐⭐⭐ |
| [第10章](第10章-Entity-Framework-Core集成.md) | Entity Framework Core 集成 | ⭐⭐⭐ |

### 第五部分：高级主题

| 章节 | 内容 | 难度 |
|------|------|------|
| [第11章](第11章-坐标系转换与投影.md) | 坐标系转换与投影 | ⭐⭐⭐ |
| [第12章](第12章-矢量切片生成.md) | 矢量切片生成 | ⭐⭐⭐ |
| [第13章](第13章-Feature与属性管理.md) | Feature 与属性管理 | ⭐⭐ |
| [第14章](第14章-高级功能与性能优化.md) | 高级功能与性能优化 | ⭐⭐⭐⭐ |

### 第六部分：实战应用

| 章节 | 内容 | 难度 |
|------|------|------|
| [第15章](第15章-实战案例与最佳实践.md) | 实战案例与最佳实践 | ⭐⭐⭐⭐ |

## 🚀 快速开始

### 安装 NuGet 包

```bash
# 核心库
dotnet add package NetTopologySuite

# 常用扩展
dotnet add package NetTopologySuite.Features
dotnet add package NetTopologySuite.IO.GeoJSON
dotnet add package NetTopologySuite.IO.Esri.Shapefile
dotnet add package ProjNet
```

### 第一个程序

```csharp
using NetTopologySuite.Geometries;

// 创建几何工厂
var factory = new GeometryFactory(new PrecisionModel(), 4326);

// 创建一个点（北京坐标）
var beijing = factory.CreatePoint(new Coordinate(116.4074, 39.9042));

// 创建一个多边形
var polygon = factory.CreatePolygon(new Coordinate[]
{
    new Coordinate(116.3, 39.8),
    new Coordinate(116.5, 39.8),
    new Coordinate(116.5, 40.0),
    new Coordinate(116.3, 40.0),
    new Coordinate(116.3, 39.8)
});

// 判断点是否在多边形内
Console.WriteLine($"北京在区域内: {polygon.Contains(beijing)}");

// 计算缓冲区
var buffer = beijing.Buffer(0.1);
Console.WriteLine($"缓冲区面积: {buffer.Area}");
```

## 📦 相关 NuGet 包

| 包名 | 说明 |
|------|------|
| `NetTopologySuite` | 核心库 |
| `NetTopologySuite.Features` | Feature 和属性支持 |
| `NetTopologySuite.IO.GeoJSON` | GeoJSON 读写 |
| `NetTopologySuite.IO.Esri.Shapefile` | Shapefile 读写 |
| `Npgsql.NetTopologySuite` | PostGIS 支持 |
| `Microsoft.EntityFrameworkCore.SqlServer.NetTopologySuite` | SQL Server EF Core 支持 |
| `Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite` | PostgreSQL EF Core 支持 |
| `NetTopologySuite.IO.VectorTiles.Mapbox` | 矢量切片支持 |
| `ProjNet` | 坐标转换 |

## 🔗 相关资源

### 官方资源

- [NetTopologySuite GitHub](https://github.com/NetTopologySuite/NetTopologySuite)
- [NetTopologySuite 文档](https://nettopologysuite.github.io/NetTopologySuite/)
- [NuGet 包](https://www.nuget.org/packages/NetTopologySuite/)

### 学习资源

- [JTS Topology Suite](https://locationtech.github.io/jts/)
- [OGC Simple Features](https://www.ogc.org/standards/sfa)
- [GeoJSON 规范](https://tools.ietf.org/html/rfc7946)

### 社区支持

- 📧 QQ群：289280914
- 🐙 GitHub：[@znlgis](https://github.com/znlgis)
- 🐱 Gitee：[@znlgis](https://gitee.com/znlgis)
- 📺 Bilibili：[space/161342702](https://space.bilibili.com/161342702)

## 📄 版权说明

本教程由 [@znlgis](https://github.com/znlgis) 编写，仅供学习交流使用。

## 📝 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2024-12 | v1.0 | 初始版本，完成全部15章内容 |

---

<p align="center">
  如果这个教程对您有帮助，请给个 ⭐ Star 支持一下！
</p>

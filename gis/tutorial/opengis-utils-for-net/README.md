---
layout: default
title: OpenGIS Utils for .NET 完整教程
---

# OpenGIS Utils for .NET 完整教程

> OGU4Net 是一个基于 MaxRev.Gdal.Universal 的 .NET GIS 二次开发工具库，是 opengis-utils-for-java 的完整 C# .NET Standard 2.0 移植版本。

## 教程概述

本教程全面介绍 OpenGIS Utils for .NET (OGU4Net) 的使用和开发，涵盖从入门到高级应用的各个方面。

### 适用人群

- .NET 开发人员
- GIS 开发人员
- C# 后端开发者
- 地理空间数据工程师

### 前置知识

- C# 编程基础
- .NET Standard 2.0 / .NET Core
- NuGet 包管理
- 基本的 GIS 概念

## 教程目录

### 基础入门

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第01章](第01章-框架概述与设计理念) | 框架概述与设计理念 | OGU4Net简介、核心设计理念、技术架构 |
| [第02章](第02章-快速入门与环境配置) | 快速入门与环境配置 | 环境搭建、NuGet配置、Hello World |
| [第03章](第03章-核心架构解析) | 核心架构解析 | 命名空间、核心接口、设计模式 |

### 核心功能

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第04章](第04章-统一图层模型详解) | 统一图层模型详解 | OguLayer、OguFeature、OguField模型 |
| [第05章](第05章-GDAL引擎架构设计) | GDAL引擎架构设计 | GDAL/OGR引擎、跨平台支持 |
| [第06章](第06章-数据格式转换实战) | 数据格式转换实战 | Shapefile、GeoJSON、FileGDB、PostGIS |
| [第07章](第07章-几何处理与空间分析) | 几何处理与空间分析 | 几何运算、空间关系、拓扑操作 |

### 高级特性

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第08章](第08章-坐标系管理与转换) | 坐标系管理与转换 | 空间参考、坐标转换、投影变换 |
| [第09章](第09章-异常处理体系) | 异常处理体系 | 异常分类、错误处理、调试技巧 |
| [第10章](第10章-实用工具类详解) | 实用工具类详解 | 工具类汇总、常用方法、最佳实践 |

### 实战与扩展

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第11章](第11章-开发实战案例) | 开发实战案例 | 格式转换、空间查询、数据处理 |
| [第12章](第12章-扩展开发指南) | 扩展开发指南 | 自定义引擎、格式扩展、性能优化 |

## 快速开始

### NuGet 依赖

```xml
<PackageReference Include="OpenGIS.Utils.Net" Version="1.0.0" />
```

或使用 .NET CLI：

```bash
dotnet add package OpenGIS.Utils.Net
```

### 示例代码

```csharp
using OpenGIS.Utils.Net;

class Program
{
    static void Main(string[] args)
    {
        // 初始化 GDAL（仅需一次）
        OguGdalConfiguration.ConfigureGdal();
        
        // 读取 Shapefile
        var layer = OguLayerUtil.ReadLayer(
            DataFormatType.SHP,
            "data/cities.shp",
            layerName: null,
            attributeFilter: null,
            spatialFilterWkt: null
        );
        
        // 打印要素信息
        foreach (var feature in layer.Features)
        {
            Console.WriteLine(feature.GeometryWkt);
        }
        
        // 转换为 GeoJSON
        OguLayerUtil.WriteLayer(
            DataFormatType.GEOJSON,
            layer,
            "output/cities.geojson"
        );
    }
}
```

## 核心特性

### 统一图层模型

- **OguLayer** - 统一的图层抽象
- **OguFeature** - 要素对象
- **OguField** - 字段定义
- **OguFieldValue** - 类型安全的字段值容器

### GDAL 引擎支持

- **MaxRev.Gdal.Universal** - 跨平台 GDAL 绑定
- **Windows/Linux/macOS** - 完整的跨平台支持
- **中文编码** - 内置 CodePages 支持

### 数据格式支持

- **Shapefile** - ESRI 矢量格式
- **GeoJSON** - Web GIS 标准格式
- **FileGDB** - ArcGIS 文件地理数据库
- **PostGIS** - PostgreSQL 空间扩展
- **GeoPackage** - OGC 标准格式
- **GML** - Geography Markup Language

### 几何处理

- 几何运算（Buffer、Union、Intersection等）
- 空间关系判断（Contains、Intersects等）
- 拓扑操作（Simplify、Densify等）

## 框架架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      应用层（您的业务代码）                        │
├─────────────────────────────────────────────────────────────────┤
│                        OGU4Net 工具库                            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │  统一图层模型  │   格式转换    │   几何处理    │   坐标转换    │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                        底层GIS引擎                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │          MaxRev.Gdal.Universal (GDAL/OGR/OSR)              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 设计理念

1. **统一抽象** - 提供统一的API，屏蔽底层GDAL复杂性
2. **跨平台** - 基于 .NET Standard 2.0，支持多平台
3. **格式无关** - 支持主流GIS数据格式的读写
4. **模型驱动** - 基于统一的数据模型设计
5. **易于使用** - 简洁的API，降低学习成本

## 与 Java 版本的对比

| 特性 | OGU4J (Java) | OGU4Net (C#) |
|-----|--------------|--------------|
| 底层引擎 | GeoTools + GDAL双引擎 | GDAL单引擎 |
| 目标框架 | Java 17+ | .NET Standard 2.0 |
| 包管理 | Maven | NuGet |
| 几何处理 | JTS/ESRI Geometry API | GDAL/OGR |
| 跨平台 | 通过JVM | 通过.NET Core |
| 中文支持 | 内置 | 内置（CodePages） |

## 相关资源

- [GitHub 仓库](https://github.com/znlgis/opengis-utils-for-net)
- [MaxRev.Gdal.Universal](https://github.com/MaxRev-Dev/gdal.netcore)
- [GDAL 官方文档](https://gdal.org/)
- [OGC 标准](https://www.ogc.org/)

## 许可证

本教程内容基于对 OpenGIS Utils for .NET 的研究和分析编写。

OGU4Net 使用 Apache License 2.0 许可证。

---

开始学习：[第01章 - 框架概述与设计理念 →](第01章-框架概述与设计理念)

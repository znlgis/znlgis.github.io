---
layout: default
title: GeoTools 完整教程
---

# GeoTools 完整教程

> GeoTools 是一个开源的 Java GIS 工具库，提供符合 OGC 标准的空间数据处理、分析和可视化功能。

## 教程概述

本教程全面介绍 [GeoTools](https://github.com/geotools/geotools) 的使用和开发，涵盖从入门到高级应用的各个方面。GeoTools 是 OSGeo 基金会的旗舰项目之一，被广泛应用于 GeoServer、uDig 等知名 GIS 项目中。

### 适用人群

- GIS 开发人员
- Java 后端开发者
- WebGIS 应用开发者
- 空间数据分析师
- GeoServer 扩展开发者

### 前置知识

- Java 编程基础（Java 17+）
- Maven 项目管理
- 基本的 GIS 概念
- SQL 数据库基础（可选）

### 核心特性

GeoTools 提供了丰富的 GIS 功能：

**数据格式支持**
- 矢量格式：Shapefile、GeoJSON、GML、KML、WKT/WKB
- 栅格格式：GeoTIFF、PNG、JPEG、ArcGrid
- 空间数据库：PostGIS、Oracle Spatial、SQL Server、H2GIS

**OGC 标准支持**
- WMS（Web Map Service）客户端
- WFS（Web Feature Service）客户端
- WCS（Web Coverage Service）客户端
- WPS（Web Processing Service）客户端
- SLD（Styled Layer Descriptor）样式
- Filter Encoding 规范

**核心功能**
- 坐标参考系统（CRS）和投影转换
- 基于 JTS 的几何处理
- 要素模型和属性管理
- 地图渲染和输出
- 空间分析和处理

## 教程目录

### 基础入门

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第01章](第01章-GeoTools概述与入门) | GeoTools 概述与入门 | 框架介绍、发展历史、核心特性 |
| [第02章](第02章-环境搭建与快速开始) | 环境搭建与快速开始 | Maven 配置、IDE 设置、Hello World |
| [第03章](第03章-核心架构与模块设计) | 核心架构与模块设计 | 模块组织、设计理念、架构分析 |

### 数据模型

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第04章](第04章-几何对象与JTS集成) | 几何对象与 JTS 集成 | Point、Line、Polygon、几何操作 |
| [第05章](第05章-要素模型与数据结构) | 要素模型与数据结构 | Feature、FeatureType、属性定义 |

### 数据访问

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第06章](第06章-数据源访问与管理) | 数据源访问与管理 | DataStore API、数据源连接 |
| [第07章](第07章-Shapefile读写详解) | Shapefile 读写详解 | ShapefileDataStore、DBF 操作 |
| [第08章](第08章-GeoJSON处理实战) | GeoJSON 处理实战 | GeoJSON 读写、格式转换 |
| [第09章](第09章-数据库空间数据访问) | 数据库空间数据访问 | PostGIS、H2GIS、JDBC DataStore |

### 坐标与样式

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第10章](第10章-坐标参考系统与投影转换) | 坐标参考系统与投影转换 | CRS、EPSG、坐标转换 |
| [第11章](第11章-样式与符号化) | 样式与符号化 | SLD、StyleFactory、符号定义 |
| [第12章](第12章-地图渲染与输出) | 地图渲染与输出 | MapContent、渲染器、图片输出 |

### 服务与分析

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第13章](第13章-OGC服务客户端) | OGC 服务客户端 | WMS、WFS、WCS 客户端使用 |
| [第14章](第14章-空间分析与处理) | 空间分析与处理 | 缓冲区、叠加、空间查询 |

### 高级主题

| 章节 | 标题 | 描述 |
|-----|------|------|
| [第15章](第15章-性能优化与最佳实践) | 性能优化与最佳实践 | 内存管理、索引、批量处理 |
| [第16章](第16章-GeoServer集成开发) | GeoServer 集成开发 | 插件开发、功能扩展 |
| [第17章](第17章-实战案例分析) | 实战案例分析 | 完整项目示例 |
| [第18章](第18章-扩展开发与高级主题) | 扩展开发与高级主题 | 自定义模块、高级功能 |

## 快速开始

### Maven 依赖配置

```xml
<project>
    <properties>
        <geotools.version>35.0</geotools.version>
    </properties>

    <repositories>
        <repository>
            <id>osgeo</id>
            <name>OSGeo Release Repository</name>
            <url>https://repo.osgeo.org/repository/release/</url>
        </repository>
    </repositories>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.geotools</groupId>
                <artifactId>geotools</artifactId>
                <version>${geotools.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <dependency>
            <groupId>org.geotools</groupId>
            <artifactId>gt-main</artifactId>
        </dependency>
        <dependency>
            <groupId>org.geotools</groupId>
            <artifactId>gt-shapefile</artifactId>
        </dependency>
        <dependency>
            <groupId>org.geotools</groupId>
            <artifactId>gt-epsg-hsql</artifactId>
        </dependency>
    </dependencies>
</project>
```

### 示例代码

```java
import org.geotools.api.data.FileDataStore;
import org.geotools.api.data.FileDataStoreFinder;
import org.geotools.api.data.SimpleFeatureSource;
import org.geotools.api.feature.simple.SimpleFeature;
import org.geotools.data.simple.SimpleFeatureIterator;

import java.io.File;

public class QuickStart {
    public static void main(String[] args) throws Exception {
        // 打开 Shapefile
        File file = new File("data/countries.shp");
        FileDataStore store = FileDataStoreFinder.getDataStore(file);
        SimpleFeatureSource source = store.getFeatureSource();
        
        // 读取要素
        try (SimpleFeatureIterator features = source.getFeatures().features()) {
            while (features.hasNext()) {
                SimpleFeature feature = features.next();
                System.out.println(feature.getID() + ": " + 
                    feature.getAttribute("NAME"));
            }
        }
        
        store.dispose();
    }
}
```

## 框架架构

```
┌────────────────────────────────────────────────────────────┐
│                      应用层                                 │
│    GeoServer  │  uDig  │  自定义应用  │  Web服务           │
├────────────────────────────────────────────────────────────┤
│                    GeoTools 核心层                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  地图渲染引擎                          │  │
│  │          gt-render  │  gt-coverage                   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                  样式系统                              │  │
│  │          gt-styling  │  SLD/SE 支持                   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                  数据访问层                            │  │
│  │    DataStore API  │  各格式支持  │  数据库连接         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                  要素模型                              │  │
│  │     Feature  │  FeatureType  │  AttributeType        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                  几何引擎                              │  │
│  │              JTS Topology Suite                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                  坐标参考系统                          │  │
│  │     gt-referencing  │  EPSG 数据库  │  投影转换       │  │
│  └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│                    OGC 标准支持                             │
│      WMS  │  WFS  │  WCS  │  WPS  │  GML  │  Filter       │
└────────────────────────────────────────────────────────────┘
```

## 核心模块说明

| 模块 | 说明 |
|-----|------|
| gt-main | 核心 API，Feature、DataStore 等基础接口 |
| gt-shapefile | Shapefile 格式读写支持 |
| gt-geojson | GeoJSON 格式支持 |
| gt-geopkg | GeoPackage 格式支持 |
| gt-referencing | 坐标参考系统和投影 |
| gt-epsg-hsql | EPSG 坐标系数据库 |
| gt-render | 地图渲染引擎 |
| gt-jdbc | 数据库访问基础 |
| gt-jdbc-postgis | PostGIS 数据库支持 |
| gt-wms | WMS 客户端 |
| gt-wfs-ng | WFS 客户端 |
| gt-process | 空间处理框架 |

## 学习路径建议

### 入门级（1-2 周）

1. 阅读第 1-3 章，了解框架概况
2. 完成环境搭建和第一个程序
3. 学习 Shapefile 基本读写

### 进阶级（2-4 周）

1. 深入学习数据模型（第 4-5 章）
2. 掌握多种数据格式（第 6-9 章）
3. 理解坐标系统和样式（第 10-12 章）

### 高级级（4-8 周）

1. OGC 服务集成（第 13 章）
2. 空间分析应用（第 14 章）
3. 性能优化实践（第 15 章）
4. GeoServer 集成开发（第 16 章）

## 相关资源

### 官方资源

- [GeoTools 官网](https://geotools.org/)
- [GeoTools GitHub](https://github.com/geotools/geotools)
- [GeoTools 文档](https://docs.geotools.org/)
- [GeoTools API 文档](https://docs.geotools.org/latest/javadocs/)

### 相关项目

- [GeoServer](https://geoserver.org/) - 基于 GeoTools 的地图服务器
- [JTS](https://github.com/locationtech/jts) - Java 几何库
- [PostGIS](https://postgis.net/) - PostgreSQL 空间扩展
- [GDAL](https://gdal.org/) - 地理数据抽象库

### 社区支持

- [GeoTools 用户邮件列表](https://sourceforge.net/projects/geotools/lists/geotools-gt2-users)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/geotools)

## 许可证

本教程内容基于对 GeoTools 的研究和分析编写。

GeoTools 使用 [LGPL](https://www.gnu.org/licenses/lgpl-3.0.html) 许可证，这意味着：
- 可以自由使用和分发
- 可用于商业项目
- 对库的修改需要开源
- 使用库的应用无需开源

---

开始学习：[第01章 - GeoTools 概述与入门 →](第01章-GeoTools概述与入门)

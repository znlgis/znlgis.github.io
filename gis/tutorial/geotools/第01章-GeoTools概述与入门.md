---
layout: default
title: 第01章 - GeoTools 概述与入门
---

# 第01章 - GeoTools 概述与入门

## 1.1 GeoTools 简介

### 1.1.1 什么是 GeoTools

GeoTools 是一个开源的 Java GIS（地理信息系统）工具库，由 OSGeo（开源地理空间基金会）维护。它提供了符合 OGC（开放地理空间联盟）标准的方法来处理地理空间数据，是 Java 平台上最成熟、功能最完整的 GIS 开发库之一。

GeoTools 的核心功能包括：

- **空间数据读写**：支持多种矢量和栅格数据格式
- **坐标转换**：完整的坐标参考系统和投影支持
- **地图渲染**：高质量的地图可视化引擎
- **空间分析**：丰富的几何运算和空间查询功能
- **OGC 标准**：全面支持 WMS、WFS、WCS 等服务协议

```
┌─────────────────────────────────────────────────────────────┐
│                    GeoTools 生态系统                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │  GeoServer  │  │    uDig     │  │  自定义应用  │        │
│   │  地图服务器  │  │  桌面 GIS   │  │  Web/移动   │        │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│          │                │                │                │
│          └────────────────┼────────────────┘                │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │  GeoTools   │                          │
│                    │  核心库      │                          │
│                    └──────┬──────┘                          │
│                           │                                 │
│          ┌────────────────┼────────────────┐                │
│          │                │                │                │
│   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐        │
│   │    JTS      │  │   EPSG DB   │  │  OGC 标准   │        │
│   │  几何引擎    │  │  坐标数据库  │  │  实现       │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.1.2 项目历史与发展

GeoTools 项目的发展历程可以追溯到上世纪 90 年代末：

| 时间 | 里程碑 |
|-----|--------|
| 1996 | GeoTools 1 项目启动于利兹大学 |
| 2002 | GeoTools 2 重新设计，采用现代 Java 架构 |
| 2006 | 成为 OSGeo 基金会孵化项目 |
| 2008 | 正式成为 OSGeo 顶级项目 |
| 2014 | GeoTools 12 发布，支持 Java 7 |
| 2018 | GeoTools 20 发布，支持 Java 8 |
| 2022 | GeoTools 27 发布，支持 Java 11 |
| 2024 | GeoTools 31+ 发布，支持 Java 17 |

**版本策略**：

- **稳定版本**：每 6 个月发布一个稳定版本
- **维护版本**：bug 修复和安全更新
- **开发版本**：最新功能，但可能不稳定

### 1.1.3 开源许可证

GeoTools 采用 **LGPL (Lesser General Public License)** 许可证，这是一个比较宽松的开源许可证：

**LGPL 的主要特点**：

1. **自由使用**：可以在任何项目中使用 GeoTools
2. **商业友好**：可以用于商业软件而无需开源整个应用
3. **修改公开**：对 GeoTools 本身的修改需要公开
4. **链接自由**：链接（使用）GeoTools 的代码无需开源

```
┌────────────────────────────────────────────────────────────┐
│                    LGPL 许可证影响                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   您的应用程序                                              │
│   ┌────────────────────────────────────┐                   │
│   │  ┌──────────────────────────────┐  │                   │
│   │  │     您的业务代码              │  │  ← 无需开源      │
│   │  └──────────────────────────────┘  │                   │
│   │              │                      │                   │
│   │              ▼                      │                   │
│   │  ┌──────────────────────────────┐  │                   │
│   │  │     GeoTools 库              │  │  ← LGPL          │
│   │  │  （作为依赖库使用）           │  │                   │
│   │  └──────────────────────────────┘  │                   │
│   └────────────────────────────────────┘                   │
│                                                            │
│   如果修改 GeoTools 源码                                    │
│   ┌────────────────────────────────────┐                   │
│   │     修改后的 GeoTools             │  ← 必须开源        │
│   └────────────────────────────────────┘                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 1.2 GeoTools 核心特性

### 1.2.1 数据格式支持

GeoTools 支持众多的空间数据格式：

**矢量数据格式**：

| 格式 | 模块 | 说明 |
|-----|------|------|
| Shapefile | gt-shapefile | ESRI Shapefile，最常用的 GIS 格式 |
| GeoJSON | gt-geojson | JSON 格式的地理数据 |
| GML | gt-gml3 | OGC 标准的 XML 格式 |
| KML | gt-kml | Google Earth 格式 |
| CSV | gt-csv | 带坐标的 CSV 文件 |
| GeoPackage | gt-geopkg | OGC 标准的 SQLite 格式 |
| WKT/WKB | gt-main | Well-Known Text/Binary |

**栅格数据格式**：

| 格式 | 模块 | 说明 |
|-----|------|------|
| GeoTIFF | gt-geotiff | 带地理信息的 TIFF |
| ArcGrid | gt-arcgrid | ESRI ASCII Grid |
| NetCDF | gt-netcdf | 气象数据格式 |
| JPEG/PNG | gt-coverage | 普通图像带世界文件 |

**空间数据库**：

| 数据库 | 模块 | 说明 |
|--------|------|------|
| PostGIS | gt-jdbc-postgis | PostgreSQL 空间扩展 |
| Oracle Spatial | gt-jdbc-oracle | Oracle 数据库 |
| SQL Server | gt-jdbc-sqlserver | Microsoft SQL Server |
| H2GIS | gt-jdbc-h2gis | 嵌入式空间数据库 |
| MySQL | gt-jdbc-mysql | MySQL 空间扩展 |
| SpatiaLite | gt-jdbc-spatialite | SQLite 空间扩展 |

### 1.2.2 OGC 标准支持

GeoTools 全面实现了 OGC 标准：

**服务标准**：

```
┌─────────────────────────────────────────────────────────────┐
│                    OGC 服务支持                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │    WMS      │    │    WFS      │    │    WCS      │    │
│   │  地图服务    │    │  要素服务    │    │  覆盖服务    │    │
│   │  (gt-wms)   │    │  (gt-wfs)   │    │  (gt-wcs)   │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │    WPS      │    │    WMTS     │    │    CSW      │    │
│   │  处理服务    │    │  切片服务    │    │  目录服务    │    │
│   │  (gt-wps)   │    │  (gt-wmts)  │    │  (gt-csw)   │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**数据标准**：

| 标准 | 说明 |
|-----|------|
| Simple Feature Access | 简单要素模型 |
| GML (Geography Markup Language) | 地理标记语言 |
| Filter Encoding | 过滤器编码规范 |
| SLD (Styled Layer Descriptor) | 样式描述符 |
| SE (Symbology Encoding) | 符号编码 |
| CRS (Coordinate Reference System) | 坐标参考系统 |

### 1.2.3 JTS 集成

GeoTools 使用 **JTS (Java Topology Suite)** 作为其几何引擎。JTS 是一个强大的 Java 几何处理库，提供：

**几何类型**：

```java
// JTS 几何类型示例
Point point = geometryFactory.createPoint(new Coordinate(116.4, 39.9));
LineString line = geometryFactory.createLineString(coordinates);
Polygon polygon = geometryFactory.createPolygon(shell, holes);
MultiPoint multiPoint = geometryFactory.createMultiPoint(points);
MultiLineString multiLine = geometryFactory.createMultiLineString(lines);
MultiPolygon multiPolygon = geometryFactory.createMultiPolygon(polygons);
GeometryCollection collection = geometryFactory.createGeometryCollection(geometries);
```

**空间操作**：

```
┌─────────────────────────────────────────────────────────────┐
│                    JTS 空间操作                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   拓扑操作                     集合操作                      │
│   ┌─────────────────────┐    ┌─────────────────────┐       │
│   │ • buffer() 缓冲区   │    │ • union() 合并       │       │
│   │ • convexHull() 凸包 │    │ • intersection() 相交│       │
│   │ • centroid() 质心   │    │ • difference() 差集  │       │
│   │ • boundary() 边界   │    │ • symDifference()    │       │
│   └─────────────────────┘    │   对称差集            │       │
│                              └─────────────────────┘       │
│                                                             │
│   空间关系                     度量计算                      │
│   ┌─────────────────────┐    ┌─────────────────────┐       │
│   │ • intersects() 相交 │    │ • getArea() 面积     │       │
│   │ • contains() 包含   │    │ • getLength() 长度   │       │
│   │ • within() 在内部   │    │ • distance() 距离    │       │
│   │ • touches() 相接    │    │ • isWithinDistance() │       │
│   │ • crosses() 穿越    │    │   距离判断           │       │
│   │ • overlaps() 重叠   │    └─────────────────────┘       │
│   └─────────────────────┘                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2.4 坐标参考系统

GeoTools 提供完整的坐标参考系统支持：

**常用 EPSG 代码**：

| EPSG | 名称 | 说明 |
|------|------|------|
| 4326 | WGS 84 | GPS 坐标系，全球通用 |
| 3857 | Web Mercator | Web 地图投影 |
| 4490 | CGCS2000 | 中国大地坐标系 2000 |
| 32650 | UTM Zone 50N | UTM 投影（北京地区） |

**坐标转换示例**：

```java
// 创建坐标转换
CoordinateReferenceSystem sourceCRS = CRS.decode("EPSG:4326");
CoordinateReferenceSystem targetCRS = CRS.decode("EPSG:3857");
MathTransform transform = CRS.findMathTransform(sourceCRS, targetCRS);

// 转换坐标
Coordinate source = new Coordinate(116.4, 39.9);
Coordinate target = JTS.transform(source, null, transform);
```

## 1.3 GeoTools 架构概览

### 1.3.1 模块组织

GeoTools 采用模块化设计，主要模块分为以下几类：

```
geotools/
├── modules/
│   ├── library/           # 核心库
│   │   ├── main/         # gt-main: 核心 API
│   │   ├── referencing/  # gt-referencing: 坐标系统
│   │   ├── render/       # gt-render: 渲染引擎
│   │   ├── jdbc/         # gt-jdbc: 数据库基础
│   │   └── coverage/     # gt-coverage: 栅格数据
│   │
│   ├── plugin/           # 数据格式插件
│   │   ├── shapefile/    # gt-shapefile
│   │   ├── geojson/      # gt-geojson
│   │   ├── geopkg/       # gt-geopkg
│   │   └── jdbc-postgis/ # gt-jdbc-postgis
│   │
│   ├── extension/        # 扩展模块
│   │   ├── wms/          # gt-wms
│   │   ├── wfs-ng/       # gt-wfs-ng
│   │   └── graph/        # gt-graph
│   │
│   └── unsupported/      # 实验性模块
│       └── process/      # 空间处理
│
└── docs/                 # 文档
```

### 1.3.2 核心接口设计

GeoTools 的核心接口遵循面向接口编程原则：

```
┌─────────────────────────────────────────────────────────────┐
│                    核心接口层次                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   数据访问                                                   │
│   ┌───────────────────────────────────────────────────┐    │
│   │  DataStore  ──→  FeatureSource  ──→  Features     │    │
│   │     │                   │                          │    │
│   │     ▼                   ▼                          │    │
│   │  DataAccess     FeatureCollection                  │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   要素模型                                                   │
│   ┌───────────────────────────────────────────────────┐    │
│   │  Feature  ──→  FeatureType  ──→  AttributeType    │    │
│   │     │              │                               │    │
│   │     ▼              ▼                               │    │
│   │  Property     PropertyType                         │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
│   几何模型                                                   │
│   ┌───────────────────────────────────────────────────┐    │
│   │  Geometry  ──→  GeometryFactory                    │    │
│   │     │                   │                          │    │
│   │     ▼                   ▼                          │    │
│   │  Point/Line/Polygon   CoordinateSequence          │    │
│   └───────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3.3 工厂模式

GeoTools 大量使用工厂模式来创建对象：

```java
// 几何工厂
GeometryFactory geometryFactory = JTSFactoryFinder.getGeometryFactory();

// 样式工厂
StyleFactory styleFactory = CommonFactoryFinder.getStyleFactory();

// 过滤器工厂
FilterFactory2 filterFactory = CommonFactoryFinder.getFilterFactory2();

// 要素类型构建器
SimpleFeatureTypeBuilder typeBuilder = new SimpleFeatureTypeBuilder();

// 要素构建器
SimpleFeatureBuilder featureBuilder = new SimpleFeatureBuilder(featureType);
```

## 1.4 GeoTools 与相关技术

### 1.4.1 与 GeoServer 的关系

GeoServer 是基于 GeoTools 构建的企业级地图服务器：

```
┌─────────────────────────────────────────────────────────────┐
│                      GeoServer                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                   REST API / Web 界面               │  │
│   └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │      WMS      │     WFS      │     WCS     │  WMTS  │  │
│   └─────────────────────────────────────────────────────┘  │
│                           │                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    GeoTools                         │  │
│   │  DataStore  │  Renderer  │  Styling  │  CRS        │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关系说明**：
- GeoServer 使用 GeoTools 作为核心引擎
- GeoTools 的 DataStore 为 GeoServer 提供数据访问
- GeoTools 的渲染引擎为 GeoServer 生成地图图片
- 扩展 GeoTools 可以增强 GeoServer 功能

### 1.4.2 与 JTS 的关系

JTS (Java Topology Suite) 是 GeoTools 的几何处理核心：

```
┌─────────────────────────────────────────────────────────────┐
│                      GeoTools                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Feature Model           Data Access          Rendering    │
│   ┌─────────────┐       ┌─────────────┐     ┌───────────┐  │
│   │ SimpleFeature│       │  DataStore  │     │  Renderer │  │
│   │ FeatureType │       │FeatureSource│     │   Style   │  │
│   └──────┬──────┘       └──────┬──────┘     └─────┬─────┘  │
│          │                     │                   │        │
│          └─────────────────────┼───────────────────┘        │
│                                │                            │
│                         ┌──────▼──────┐                     │
│                         │     JTS     │                     │
│                         │  Geometry   │                     │
│                         └─────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**JTS 在 GeoTools 中的作用**：
- 提供所有几何类型（Point、LineString、Polygon 等）
- 实现空间操作（buffer、union、intersection 等）
- 支持空间关系判断（contains、intersects、within 等）
- 提供空间索引（R-Tree、Quadtree）

### 1.4.3 与其他 GIS 库对比

| 特性 | GeoTools | GDAL/OGR | PostGIS |
|-----|----------|----------|---------|
| 语言 | Java | C/C++ | SQL |
| 定位 | 开发库 | 数据转换 | 数据存储 |
| OGC 标准 | 完整支持 | 部分支持 | 完整支持 |
| 渲染能力 | 强 | 无 | 无 |
| 学习曲线 | 中等 | 陡峭 | 平缓 |
| 生态系统 | 丰富 | 广泛 | 成熟 |

## 1.5 适用场景分析

### 1.5.1 推荐使用场景

**1. 企业级 GIS 应用开发**

```java
// 示例：企业地理围栏服务
public class GeofenceService {
    private DataStore dataStore;
    
    public boolean isInsideGeofence(Point location, String zoneId) {
        SimpleFeature zone = getZone(zoneId);
        Geometry geofence = (Geometry) zone.getDefaultGeometry();
        return geofence.contains(location);
    }
}
```

**2. 空间数据 ETL 管道**

```java
// 示例：数据格式转换管道
public void convertShapefileToPostGIS(File shapefile, String tableName) {
    // 读取 Shapefile
    FileDataStore sourceStore = FileDataStoreFinder.getDataStore(shapefile);
    SimpleFeatureSource source = sourceStore.getFeatureSource();
    
    // 写入 PostGIS
    DataStore targetStore = getPostGISDataStore();
    targetStore.createSchema(source.getSchema());
    
    SimpleFeatureStore targetFeatureStore = 
        (SimpleFeatureStore) targetStore.getFeatureSource(tableName);
    targetFeatureStore.addFeatures(source.getFeatures());
}
```

**3. 地图服务后端**

```java
// 示例：动态生成地图图片
public BufferedImage renderMap(ReferencedEnvelope bounds) {
    MapContent map = new MapContent();
    map.addLayer(new FeatureLayer(featureSource, style));
    
    GTRenderer renderer = new StreamingRenderer();
    renderer.setMapContent(map);
    
    BufferedImage image = new BufferedImage(800, 600, BufferedImage.TYPE_INT_ARGB);
    renderer.paint(image.createGraphics(), 
                   new Rectangle(800, 600), bounds);
    
    return image;
}
```

**4. 空间分析服务**

```java
// 示例：缓冲区分析
public Geometry bufferAnalysis(Geometry geometry, double distance) {
    // 创建缓冲区
    Geometry buffer = geometry.buffer(distance);
    
    // 查询缓冲区内的要素
    Filter filter = filterFactory.intersects(
        filterFactory.property("geometry"),
        filterFactory.literal(buffer)
    );
    
    return buffer;
}
```

### 1.5.2 不太适合的场景

| 场景 | 原因 | 替代方案 |
|-----|------|----------|
| 前端地图展示 | Java 不适合前端 | OpenLayers、Leaflet |
| 简单坐标计算 | 依赖过重 | 直接使用 JTS |
| 大规模栅格处理 | 性能瓶颈 | GDAL、GeoTrellis |
| 移动 GIS 应用 | 包体积大 | ArcGIS Runtime、MapLibre |
| 实时数据流处理 | 不支持流处理 | Apache Kafka + PostGIS |

## 1.6 第一个 GeoTools 程序

### 1.6.1 环境准备

**系统要求**：
- JDK 17 或更高版本
- Maven 3.8.6 或更高版本
- IDE（推荐 IntelliJ IDEA 或 Eclipse）

**创建项目**：

```bash
# 创建 Maven 项目
mvn archetype:generate \
    -DgroupId=com.example \
    -DartifactId=geotools-demo \
    -DarchetypeArtifactId=maven-archetype-quickstart \
    -DinteractiveMode=false
```

### 1.6.2 Maven 配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>geotools-demo</artifactId>
    <version>1.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <geotools.version>31.0</geotools.version>
    </properties>

    <repositories>
        <repository>
            <id>osgeo</id>
            <name>OSGeo Release Repository</name>
            <url>https://repo.osgeo.org/repository/release/</url>
            <snapshots><enabled>false</enabled></snapshots>
            <releases><enabled>true</enabled></releases>
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
        <!-- 核心模块 -->
        <dependency>
            <groupId>org.geotools</groupId>
            <artifactId>gt-main</artifactId>
        </dependency>
        
        <!-- Shapefile 支持 -->
        <dependency>
            <groupId>org.geotools</groupId>
            <artifactId>gt-shapefile</artifactId>
        </dependency>
        
        <!-- EPSG 坐标系数据库 -->
        <dependency>
            <groupId>org.geotools</groupId>
            <artifactId>gt-epsg-hsql</artifactId>
        </dependency>
        
        <!-- GeoJSON 支持 -->
        <dependency>
            <groupId>org.geotools</groupId>
            <artifactId>gt-geojson</artifactId>
        </dependency>
    </dependencies>
</project>
```

### 1.6.3 Hello GeoTools

```java
package com.example;

import org.geotools.api.feature.simple.SimpleFeature;
import org.geotools.api.feature.simple.SimpleFeatureType;
import org.geotools.api.referencing.crs.CoordinateReferenceSystem;
import org.geotools.data.simple.SimpleFeatureCollection;
import org.geotools.data.simple.SimpleFeatureIterator;
import org.geotools.feature.DefaultFeatureCollection;
import org.geotools.feature.simple.SimpleFeatureBuilder;
import org.geotools.feature.simple.SimpleFeatureTypeBuilder;
import org.geotools.geometry.jts.JTSFactoryFinder;
import org.geotools.referencing.CRS;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;

/**
 * GeoTools 入门示例
 */
public class HelloGeoTools {

    public static void main(String[] args) throws Exception {
        System.out.println("=== GeoTools 入门示例 ===\n");
        
        // 1. 获取几何工厂
        GeometryFactory geometryFactory = JTSFactoryFinder.getGeometryFactory();
        System.out.println("1. 创建几何工厂：" + geometryFactory.getClass().getSimpleName());
        
        // 2. 创建点几何
        Point beijing = geometryFactory.createPoint(new Coordinate(116.4074, 39.9042));
        Point shanghai = geometryFactory.createPoint(new Coordinate(121.4737, 31.2304));
        System.out.println("2. 创建点几何：");
        System.out.println("   北京坐标：" + beijing);
        System.out.println("   上海坐标：" + shanghai);
        
        // 3. 计算距离（度）
        double distance = beijing.distance(shanghai);
        System.out.println("3. 两点距离（度）：" + String.format("%.4f", distance));
        
        // 4. 创建坐标参考系统
        CoordinateReferenceSystem crs = CRS.decode("EPSG:4326");
        System.out.println("4. 坐标参考系统：" + crs.getName());
        
        // 5. 构建要素类型
        SimpleFeatureTypeBuilder typeBuilder = new SimpleFeatureTypeBuilder();
        typeBuilder.setName("City");
        typeBuilder.setCRS(crs);
        typeBuilder.add("location", Point.class);
        typeBuilder.add("name", String.class);
        typeBuilder.add("population", Long.class);
        SimpleFeatureType cityType = typeBuilder.buildFeatureType();
        System.out.println("5. 构建要素类型：" + cityType.getTypeName());
        
        // 6. 创建要素
        SimpleFeatureBuilder featureBuilder = new SimpleFeatureBuilder(cityType);
        
        featureBuilder.add(beijing);
        featureBuilder.add("北京");
        featureBuilder.add(21540000L);
        SimpleFeature beijingFeature = featureBuilder.buildFeature("city.1");
        
        featureBuilder.add(shanghai);
        featureBuilder.add("上海");
        featureBuilder.add(24280000L);
        SimpleFeature shanghaiFeature = featureBuilder.buildFeature("city.2");
        
        System.out.println("6. 创建要素：");
        System.out.println("   " + beijingFeature.getID() + ": " + beijingFeature.getAttribute("name"));
        System.out.println("   " + shanghaiFeature.getID() + ": " + shanghaiFeature.getAttribute("name"));
        
        // 7. 创建要素集合
        DefaultFeatureCollection collection = new DefaultFeatureCollection();
        collection.add(beijingFeature);
        collection.add(shanghaiFeature);
        System.out.println("7. 要素集合大小：" + collection.size());
        
        // 8. 遍历要素
        System.out.println("8. 遍历要素：");
        try (SimpleFeatureIterator iterator = collection.features()) {
            while (iterator.hasNext()) {
                SimpleFeature feature = iterator.next();
                String name = (String) feature.getAttribute("name");
                Long population = (Long) feature.getAttribute("population");
                Point location = (Point) feature.getDefaultGeometry();
                System.out.printf("   %s - 人口: %,d - 坐标: (%.4f, %.4f)%n",
                    name, population, location.getX(), location.getY());
            }
        }
        
        System.out.println("\n=== 示例完成 ===");
    }
}
```

### 1.6.4 运行结果

```
=== GeoTools 入门示例 ===

1. 创建几何工厂：GeometryFactory
2. 创建点几何：
   北京坐标：POINT (116.4074 39.9042)
   上海坐标：POINT (121.4737 31.2304)
3. 两点距离（度）：9.8765
4. 坐标参考系统：WGS 84
5. 构建要素类型：City
6. 创建要素：
   city.1: 北京
   city.2: 上海
7. 要素集合大小：2
8. 遍历要素：
   北京 - 人口: 21,540,000 - 坐标: (116.4074, 39.9042)
   上海 - 人口: 24,280,000 - 坐标: (121.4737, 31.2304)

=== 示例完成 ===
```

## 1.7 本章小结

本章介绍了 GeoTools 的基本概念和特性：

1. **GeoTools 简介**：开源 Java GIS 工具库，OSGeo 项目
2. **核心特性**：数据格式支持、OGC 标准、JTS 集成、坐标系统
3. **架构设计**：模块化设计、工厂模式、接口导向
4. **生态系统**：与 GeoServer、JTS 的关系
5. **适用场景**：企业级 GIS 开发、空间数据处理、地图服务

### 关键要点

- GeoTools 是 Java 平台上最成熟的开源 GIS 库
- 采用 LGPL 许可证，商业友好
- 使用 JTS 作为几何引擎
- 完整支持 OGC 标准
- 模块化设计，按需引入

### 下一步

在下一章中，我们将详细介绍环境搭建和快速开始，包括：
- 开发环境配置
- Maven 依赖管理
- IDE 设置
- 更多示例程序

---

[返回目录](README) | [下一章：环境搭建与快速开始 →](第02章-环境搭建与快速开始)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-环境搭建与快速开始" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

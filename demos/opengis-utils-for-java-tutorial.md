# OGU4J - OpenGIS Utils for Java 学习与开发教程

> 本教程基于 [opengis-utils-for-java](https://github.com/znlgis/opengis-utils-for-java) 主分支最新代码编写，帮助开发者快速上手这个强大的Java GIS工具库。

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 环境配置](#2-环境配置)
- [3. 核心概念](#3-核心概念)
- [4. 快速入门](#4-快速入门)
- [5. 数据格式转换](#5-数据格式转换)
- [6. 几何处理](#6-几何处理)
- [7. 坐标系管理](#7-坐标系管理)
- [8. 实用工具](#8-实用工具)
- [9. 进阶开发](#9-进阶开发)
- [10. 最佳实践](#10-最佳实践)

---

## 1. 项目概述

### 1.1 什么是 OGU4J？

**OGU4J**（OpenGIS Utils for Java）是一个基于开源GIS库（GeoTools、JTS、GDAL/OGR、ESRI Geometry API）的Java GIS二次开发工具库。它提供了统一的图层模型和便捷的格式转换功能，大大简化了GIS数据的读取、处理和导出操作。

### 1.2 为什么选择 OGU4J？

| 特性 | 说明 |
|------|------|
| 🗂️ **统一图层模型** | 屏蔽底层GIS库差异，提供简洁的API接口 |
| 📁 **多格式支持** | Shapefile、GeoJSON、FileGDB、PostGIS、国土TXT等 |
| 🔄 **双引擎架构** | 支持GeoTools和GDAL/OGR引擎灵活切换 |
| 📐 **几何处理** | 丰富的几何操作和空间分析功能 |
| 🌐 **坐标系管理** | 内置CGCS2000支持，便捷的坐标转换 |
| 🛠️ **实用工具** | 压缩解压、编码检测、自然排序等 |

### 1.3 项目架构

```
opengis-utils-for-java/
├── src/main/java/com/znlgis/ogu4j/
│   ├── common/         # 通用工具类
│   │   ├── CrsUtil.java         # 坐标系工具
│   │   ├── ZipUtil.java         # 压缩解压工具
│   │   ├── EncodingUtil.java    # 编码检测工具
│   │   ├── SortUtil.java        # 自然排序工具
│   │   ├── NumUtil.java         # 数字格式化工具
│   │   └── GdalCmdUtil.java     # GDAL命令行工具
│   ├── datasource/     # 数据源工具类
│   │   ├── OguLayerConverter.java  # 图层格式转换核心类
│   │   ├── ShpUtil.java         # Shapefile工具
│   │   ├── PostgisUtil.java     # PostGIS工具
│   │   ├── OgrUtil.java         # OGR/GDAL工具
│   │   ├── GeotoolsUtil.java    # GeoTools工具
│   │   └── GtTxtUtil.java       # 国土TXT工具
│   ├── enums/          # 枚举类型
│   │   ├── GeometryType.java    # 几何类型
│   │   ├── FieldDataType.java   # 字段数据类型
│   │   ├── GisEngineType.java   # GIS引擎类型
│   │   ├── DataFormatType.java  # 数据格式类型
│   │   └── TopologyValidationErrorType.java  # 拓扑错误类型
│   ├── geometry/       # 几何处理工具
│   │   ├── JtsGeometryUtil.java   # JTS几何工具
│   │   ├── EsriGeometryUtil.java  # ESRI几何工具
│   │   └── GeometryConverter.java # 几何格式转换
│   └── model/          # 数据模型
│       ├── layer/      # 图层模型
│       │   ├── OguLayer.java        # 图层
│       │   ├── OguFeature.java      # 要素
│       │   ├── OguField.java        # 字段
│       │   ├── OguFieldValue.java   # 字段值
│       │   ├── OguCoordinate.java   # 坐标
│       │   ├── OguFeatureFilter.java # 要素过滤器
│       │   └── OguLayerMetadata.java # 图层元数据
│       ├── DbConnBaseModel.java     # 数据库连接模型
│       ├── GdbGroupModel.java       # GDB组模型
│       ├── TopologyValidationResult.java  # 拓扑验证结果
│       └── SimpleGeometryResult.java      # 简单几何结果
└── pom.xml             # Maven配置
```

---

## 2. 环境配置

### 2.1 系统要求

- **Java**: 17+（必需）
- **Maven**: 3.6+（推荐）
- **GDAL**: 3.11.0（可选，用于FileGDB格式支持）

### 2.2 Maven依赖配置

在 `pom.xml` 中添加以下配置：

```xml
<!-- 添加OSGeo仓库 -->
<repositories>
    <repository>
        <id>osgeo</id>
        <url>https://repo.osgeo.org/repository/release/</url>
    </repository>
</repositories>

<!-- 添加依赖 -->
<dependency>
    <groupId>com.znlgis.ogu4j</groupId>
    <artifactId>ogu4j</artifactId>
    <version>1.0.0</version>
</dependency>
```

### 2.3 核心依赖说明

| 依赖库 | 版本 | 用途 |
|--------|------|------|
| JTS | 1.20.0 | 几何对象和空间操作 |
| GeoTools | 34.1 | 数据读写和坐标系支持 |
| ESRI Geometry API | 2.2.4 | 高性能几何运算 |
| GDAL | 3.11.0 | FileGDB等格式支持（可选） |
| Hutool | 5.8.41 | 便捷工具方法 |
| Fastjson2 | 2.0.60 | JSON处理 |
| Zip4j | 2.11.5 | 压缩解压 |
| Lombok | 1.18.36 | 简化代码编写 |

### 2.4 GDAL环境配置（可选）

如需使用FileGDB格式或GDAL引擎：

**Windows:**
1. 下载并安装GDAL
2. 设置环境变量 `GDAL_DATA` 和 `PATH`

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install gdal-bin libgdal-dev

# 验证安装
gdalinfo --version
```

**macOS:**
```bash
brew install gdal
```

---

## 3. 核心概念

### 3.1 统一图层模型

OGU4J的核心是**统一图层模型**，它抽象了不同GIS数据格式的差异，提供一致的数据访问接口。

#### OguLayer - 图层

图层是GIS数据的容器，包含名称、坐标系、几何类型、字段定义和要素集合。

```java
public class OguLayer {
    private String name;              // 图层名称
    private Integer wkid;             // 坐标系WKID
    private GeometryType geometryType; // 几何类型
    private List<OguField> fields;    // 字段定义
    private List<OguFeature> features; // 要素集合
    
    // 便捷方法
    public void validate();           // 验证数据完整性
    public List<OguFeature> filter(OguFeatureFilter filter); // 过滤要素
    public int getFeatureCount();     // 获取要素数量
    public String toJSON();           // 转换为JSON
    public static OguLayer fromJSON(String json); // 从JSON创建
}
```

#### OguFeature - 要素

要素是图层中的单个地理实体，包含唯一标识、几何信息和属性值。

```java
public class OguFeature {
    private Long fid;                 // 要素ID
    private String wkt;               // 几何信息（WKT格式）
    private Map<String, Object> attributes; // 属性值集合
    
    // 便捷方法
    public Object getValue(String fieldName);  // 获取属性值
    public void setValue(String fieldName, Object value); // 设置属性值
    public OguFieldValue getAttribute(String fieldName);  // 获取字段值对象
}
```

#### OguField - 字段定义

字段定义描述了属性的元数据信息。

```java
public class OguField {
    private String name;      // 字段名称
    private String alias;     // 字段别名
    private FieldDataType dataType; // 数据类型
    private Integer length;   // 字段长度
    private Integer precision; // 精度
    private Integer scale;    // 小数位数
    private Boolean nullable; // 是否可空
    private Object defaultValue; // 默认值
}
```

#### OguFieldValue - 字段值

字段值容器提供类型安全的值获取方法。

```java
public class OguFieldValue {
    private String name;      // 字段名
    private Object value;     // 原始值
    
    // 类型转换方法
    public String getStringValue();
    public Integer getIntValue();
    public Long getLongValue();
    public Double getDoubleValue();
    public Boolean getBooleanValue();
    public Date getDateValue();
}
```

### 3.2 双引擎架构

OGU4J支持两种GIS引擎，可根据需求选择：

| 引擎 | 适用场景 | 优点 |
|------|---------|------|
| **GeoTools** | 通用场景，纯Java环境 | 无需额外安装，跨平台 |
| **GDAL/OGR** | 需要FileGDB支持，高性能需求 | 格式支持更全面 |

```java
// 使用GeoTools引擎
OguLayer layer = OguLayerConverter.fromShapefile(shpPath, null, null, GisEngineType.GEOTOOLS);

// 使用GDAL引擎
OguLayer layer = OguLayerConverter.fromFileGDB(gdbPath, "layerName", null, null, GisEngineType.GDAL);
```

### 3.3 几何类型

支持的几何类型枚举（`GeometryType`）：

| 类型 | 说明 |
|------|------|
| `POINT` | 点 |
| `MULTIPOINT` | 多点 |
| `LINESTRING` | 线 |
| `MULTILINESTRING` | 多线 |
| `POLYGON` | 面 |
| `MULTIPOLYGON` | 多面 |
| `GEOMETRY` | 通用几何 |
| `GEOMETRYCOLLECTION` | 几何集合 |

### 3.4 字段数据类型

支持的字段数据类型枚举（`FieldDataType`）：

| 类型 | 说明 |
|------|------|
| `STRING` | 字符串 |
| `INTEGER` | 整数 |
| `LONG` | 长整数 |
| `DOUBLE` | 双精度浮点数 |
| `FLOAT` | 单精度浮点数 |
| `DATE` | 日期 |
| `BOOLEAN` | 布尔值 |

---

## 4. 快速入门

### 4.1 Hello World示例

```java
import com.znlgis.ogu4j.model.layer.*;
import com.znlgis.ogu4j.enums.*;
import java.util.*;

public class HelloWorld {
    public static void main(String[] args) {
        // 创建图层
        OguLayer layer = new OguLayer();
        layer.setName("cities");
        layer.setWkid(4490);  // CGCS2000地理坐标系
        layer.setGeometryType(GeometryType.POINT);
        
        // 定义字段
        List<OguField> fields = new ArrayList<>();
        OguField nameField = new OguField();
        nameField.setName("name");
        nameField.setAlias("城市名称");
        nameField.setDataType(FieldDataType.STRING);
        nameField.setLength(50);
        fields.add(nameField);
        
        OguField popField = new OguField();
        popField.setName("population");
        popField.setAlias("人口");
        popField.setDataType(FieldDataType.LONG);
        fields.add(popField);
        
        layer.setFields(fields);
        
        // 添加要素
        List<OguFeature> features = new ArrayList<>();
        
        OguFeature beijing = new OguFeature();
        beijing.setFid(1L);
        beijing.setWkt("POINT (116.4074 39.9042)");
        Map<String, Object> attrs1 = new HashMap<>();
        attrs1.put("name", "北京");
        attrs1.put("population", 21540000L);
        beijing.setAttributes(attrs1);
        features.add(beijing);
        
        OguFeature shanghai = new OguFeature();
        shanghai.setFid(2L);
        shanghai.setWkt("POINT (121.4737 31.2304)");
        Map<String, Object> attrs2 = new HashMap<>();
        attrs2.put("name", "上海");
        attrs2.put("population", 24870000L);
        shanghai.setAttributes(attrs2);
        features.add(shanghai);
        
        layer.setFeatures(features);
        
        // 验证图层
        layer.validate();
        
        // 输出信息
        System.out.println("图层名称: " + layer.getName());
        System.out.println("要素数量: " + layer.getFeatureCount());
        System.out.println("JSON: " + layer.toJSON());
    }
}
```

### 4.2 读取Shapefile

```java
import com.znlgis.ogu4j.datasource.OguLayerConverter;
import com.znlgis.ogu4j.enums.GisEngineType;
import com.znlgis.ogu4j.model.layer.*;

public class ReadShapefile {
    public static void main(String[] args) {
        String shpPath = "/path/to/your/data.shp";
        
        // 读取Shapefile
        OguLayer layer = OguLayerConverter.fromShapefile(
            shpPath, 
            null,  // 无属性过滤
            null,  // 无空间过滤
            GisEngineType.GEOTOOLS
        );
        
        // 遍历要素
        for (OguFeature feature : layer.getFeatures()) {
            System.out.println("FID: " + feature.getFid());
            System.out.println("WKT: " + feature.getWkt());
            
            // 获取属性值
            for (String key : feature.getAttributes().keySet()) {
                Object value = feature.getValue(key);
                System.out.println(key + ": " + value);
            }
            System.out.println("---");
        }
    }
}
```

### 4.3 带过滤条件读取

```java
// 属性过滤 - 使用CQL表达式
OguLayer layer = OguLayerConverter.fromShapefile(
    shpPath, 
    "NAME = '北京'",  // CQL属性过滤
    null, 
    GisEngineType.GEOTOOLS
);

// 空间过滤 - 使用WKT几何
String spatialFilterWkt = "POLYGON ((115 39, 118 39, 118 41, 115 41, 115 39))";
OguLayer layer = OguLayerConverter.fromShapefile(
    shpPath, 
    null, 
    spatialFilterWkt,  // 空间过滤
    GisEngineType.GEOTOOLS
);

// 组合过滤
OguLayer layer = OguLayerConverter.fromShapefile(
    shpPath, 
    "POPULATION > 1000000",  // 人口大于100万
    spatialFilterWkt,         // 在指定范围内
    GisEngineType.GEOTOOLS
);
```

### 4.4 保存为Shapefile

```java
// 保存图层为Shapefile
String outputPath = "/path/to/output.shp";
OguLayerConverter.toShapefile(layer, outputPath, GisEngineType.GEOTOOLS);

System.out.println("Shapefile已保存到: " + outputPath);
```

### 4.5 使用Lambda进行要素过滤

```java
import java.util.List;

// 过滤人口大于500万的城市
List<OguFeature> largeCities = layer.filter(feature -> {
    Long population = (Long) feature.getValue("population");
    return population != null && population > 5000000;
});

// 过滤名称包含"市"的要素
List<OguFeature> cities = layer.filter(feature -> {
    String name = (String) feature.getValue("name");
    return name != null && name.contains("市");
});

// 复合条件过滤
List<OguFeature> filtered = layer.filter(feature -> {
    String province = (String) feature.getValue("province");
    Long area = (Long) feature.getValue("area");
    return "广东".equals(province) && area != null && area > 10000;
});
```

---

## 5. 数据格式转换

### 5.1 GeoJSON

```java
// 读取GeoJSON
OguLayer layer = OguLayerConverter.fromGeoJSON(
    "/path/to/data.geojson", 
    GisEngineType.GEOTOOLS
);

// 保存为GeoJSON
OguLayerConverter.toGeoJSON(layer, "/path/to/output.geojson", GisEngineType.GEOTOOLS);
```

### 5.2 FileGDB（需GDAL支持）

```java
// 读取FileGDB中的指定图层
OguLayer layer = OguLayerConverter.fromFileGDB(
    "/path/to/data.gdb",   // GDB路径
    "layerName",            // 图层名称
    "STATUS = 1",           // 属性过滤（可选）
    null,                   // 空间过滤（可选）
    GisEngineType.GDAL
);

// 保存到FileGDB
OguLayerConverter.toFileGDB(
    layer, 
    "/path/to/output.gdb",  // GDB路径
    "FeatureDataset",       // 要素数据集名称
    "newLayerName",         // 图层名称
    GisEngineType.GDAL
);
```

### 5.3 PostGIS

```java
import com.znlgis.ogu4j.model.DbConnBaseModel;

// 配置数据库连接
DbConnBaseModel dbConn = new DbConnBaseModel();
dbConn.setDbtype("postgis");
dbConn.setHost("localhost");
dbConn.setPort("5432");
dbConn.setDatabase("gisdb");
dbConn.setSchema("public");
dbConn.setUser("postgres");
dbConn.setPasswd("password");

// 从PostGIS读取
OguLayer layer = OguLayerConverter.fromPostGIS(
    dbConn, 
    "table_name", 
    "province = '广东'",  // 属性过滤
    null,                 // 空间过滤
    GisEngineType.GEOTOOLS
);

// 保存到PostGIS
OguLayerConverter.toPostGIS(
    layer, 
    dbConn, 
    "new_table_name", 
    GisEngineType.GEOTOOLS
);
```

### 5.4 国土TXT坐标文件

国土TXT格式是中国自然资源部门常用的坐标数据交换格式。

```java
import com.znlgis.ogu4j.model.layer.OguLayerMetadata;

// 读取国土TXT文件
OguLayer layer = OguLayerConverter.fromTxtFile(
    "/path/to/data.txt", 
    null  // 编码（null则自动检测）
);

// 配置元数据
OguLayerMetadata metadata = new OguLayerMetadata();
metadata.setDataSource("自然资源部");
metadata.setCoordinateSystemName("2000国家大地坐标系");
metadata.setZoneDivision("3");  // 3度带
metadata.setProjectionType("高斯克吕格");
metadata.setMeasureUnit("米");

// 保存为国土TXT文件
int zoneNumber = 39;  // 带号
OguLayerConverter.toTxtFile(
    layer, 
    "/path/to/output.txt", 
    metadata, 
    null,        // 编码（null则使用UTF-8）
    zoneNumber
);
```

### 5.5 格式间互转

```java
// Shapefile -> GeoJSON
OguLayer layer = OguLayerConverter.fromShapefile(shpPath, null, null, GisEngineType.GEOTOOLS);
OguLayerConverter.toGeoJSON(layer, geojsonPath, GisEngineType.GEOTOOLS);

// GeoJSON -> PostGIS
OguLayer layer = OguLayerConverter.fromGeoJSON(geojsonPath, GisEngineType.GEOTOOLS);
OguLayerConverter.toPostGIS(layer, dbConn, "table_name", GisEngineType.GEOTOOLS);

// PostGIS -> Shapefile
OguLayer layer = OguLayerConverter.fromPostGIS(dbConn, "table_name", null, null, GisEngineType.GEOTOOLS);
OguLayerConverter.toShapefile(layer, shpPath, GisEngineType.GEOTOOLS);

// FileGDB -> GeoJSON（需GDAL）
OguLayer layer = OguLayerConverter.fromFileGDB(gdbPath, "layerName", null, null, GisEngineType.GDAL);
OguLayerConverter.toGeoJSON(layer, geojsonPath, GisEngineType.GEOTOOLS);
```

---

## 6. 几何处理

### 6.1 几何格式转换

使用 `GeometryConverter` 进行各种几何格式之间的转换：

```java
import com.znlgis.ogu4j.geometry.GeometryConverter;
import org.locationtech.jts.geom.Geometry;

// WKT <-> JTS Geometry
Geometry geom = GeometryConverter.wkt2Geometry("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
String wkt = GeometryConverter.geometry2Wkt(geom);

// GeoJSON <-> JTS Geometry
String geojson = "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}";
Geometry geom = GeometryConverter.geojson2Geometry(geojson);
String geojsonOut = GeometryConverter.geometry2Geojson(geom);

// WKT <-> GeoJSON
String geojson = GeometryConverter.wkt2Geojson(wkt);
String wkt = GeometryConverter.geojson2Wkt(geojson);

// WKT <-> ESRI JSON
int wkid = 4490;  // CGCS2000
String esriJson = GeometryConverter.wkt2EsriJson(wkt, wkid);
String wkt = GeometryConverter.esriJson2Wkt(esriJson);

// GeoJSON <-> ESRI JSON
String esriJson = GeometryConverter.geoJson2EsriJson(wkid, geojson);
String geojson = GeometryConverter.esriJson2GeoJson(esriJson);
```

### 6.2 JTS几何工具

`JtsGeometryUtil` 提供基于JTS库的几何操作：

#### 空间关系判断

```java
import com.znlgis.ogu4j.geometry.JtsGeometryUtil;

// 判断几何关系
boolean intersects = JtsGeometryUtil.intersects(geomA, geomB);  // 相交
boolean contains = JtsGeometryUtil.contains(geomA, geomB);      // 包含
boolean within = JtsGeometryUtil.within(geomA, geomB);          // 被包含
boolean touches = JtsGeometryUtil.touches(geomA, geomB);        // 相接
boolean crosses = JtsGeometryUtil.crosses(geomA, geomB);        // 穿越
boolean overlaps = JtsGeometryUtil.overlaps(geomA, geomB);      // 重叠
boolean disjoint = JtsGeometryUtil.disjoint(geomA, geomB);      // 分离

// DE-9IM关系模式匹配
boolean matches = JtsGeometryUtil.relatePattern(geomA, geomB, "T*T***FF*");
String relate = JtsGeometryUtil.relate(geomA, geomB);  // 返回DE-9IM矩阵
```

#### 空间分析

```java
// 缓冲区分析
Geometry buffer = JtsGeometryUtil.buffer(geom, 100);  // 100米缓冲区

// 叠加分析
Geometry intersection = JtsGeometryUtil.intersection(geomA, geomB);  // 交集
Geometry union = JtsGeometryUtil.union(geomA, geomB);                // 并集
Geometry difference = JtsGeometryUtil.difference(geomA, geomB);      // 差集
Geometry symDifference = JtsGeometryUtil.symDifference(geomA, geomB); // 对称差

// 凸包与凹包
Geometry convexHull = JtsGeometryUtil.convexHull(geom);
Geometry concaveHull = JtsGeometryUtil.concaveHull(geom);
```

#### 几何属性

```java
// 获取属性
double area = JtsGeometryUtil.area(geom);           // 面积
double length = JtsGeometryUtil.length(geom);       // 长度/周长
Geometry centroid = JtsGeometryUtil.centroid(geom); // 质心
Geometry interiorPoint = JtsGeometryUtil.interiorPoint(geom); // 内部点
int dimension = JtsGeometryUtil.dimension(geom);    // 维度
int numPoints = JtsGeometryUtil.numPoints(geom);    // 点数量
GeometryType geometryType = JtsGeometryUtil.geometryType(geom); // 类型
boolean isEmpty = JtsGeometryUtil.isEmpty(geom);    // 是否为空

// 边界与包围盒
Geometry boundary = JtsGeometryUtil.boundary(geom);  // 边界
Geometry envelope = JtsGeometryUtil.envelope(geom);  // 外包矩形
```

#### 几何相等判断

```java
// 精确相等
boolean equalsExact = JtsGeometryUtil.equalsExact(geomA, geomB);

// 带容差的精确相等
boolean equalsExactTol = JtsGeometryUtil.equalsExactTolerance(geomA, geomB, 0.001);

// 标准化后相等
boolean equalsNorm = JtsGeometryUtil.equalsNorm(geomA, geomB);

// 拓扑相等
boolean equalsTopo = JtsGeometryUtil.equalsTopo(geomA, geomB);
```

#### 距离计算

```java
// 计算距离
double distance = JtsGeometryUtil.distance(geomA, geomB);

// 判断是否在指定距离内
boolean withinDistance = JtsGeometryUtil.isWithinDistance(geomA, geomB, 100);
```

#### 拓扑验证与修复

```java
import com.znlgis.ogu4j.model.TopologyValidationResult;
import com.znlgis.ogu4j.model.SimpleGeometryResult;

// 拓扑有效性验证
TopologyValidationResult validResult = JtsGeometryUtil.isValid(geom);
if (!validResult.isValid()) {
    System.out.println("错误类型: " + validResult.getErrorType().getDesc());
    System.out.println("错误位置: " + validResult.getCoordinate());
    System.out.println("错误信息: " + validResult.getMessage());
}

// 几何简单性检查
SimpleGeometryResult simpleResult = JtsGeometryUtil.isSimple(geom);
if (!simpleResult.isSimple()) {
    System.out.println("非简单点位置: " + simpleResult.getNonSimplePts());
}

// 几何验证修复
Geometry validated = JtsGeometryUtil.validate(geom);

// 几何简化
Geometry simplified = JtsGeometryUtil.simplify(geom, 1.0);  // 容差1米

// 几何加密
Geometry densified = JtsGeometryUtil.densify(geom, 10.0);  // 每10米加点
```

#### 多边形操作

```java
// 多边形分割
Geometry line = GeometryConverter.wkt2Geometry("LINESTRING (5 0, 5 10)");
Geometry splitResult = JtsGeometryUtil.splitPolygon(polygon, line);

// 线转多边形
Geometry polygonized = JtsGeometryUtil.polygonize(lineGeom);
```

### 6.3 ESRI几何工具

`EsriGeometryUtil` 提供基于ESRI Geometry API的几何操作，以WKT字符串为输入输出：

```java
import com.znlgis.ogu4j.geometry.EsriGeometryUtil;

int wkid = 4490;  // 坐标系WKID

// 几何创建
Geometry geom = EsriGeometryUtil.createGeometryByWkt(wkt);
Geometry geom = EsriGeometryUtil.createGeometryByGeoJson(geojson);
Geometry geom = EsriGeometryUtil.createGeometryByJson(esriJson);

// 空间关系判断（需指定坐标系）
boolean intersects = EsriGeometryUtil.intersects(wktA, wktB, wkid);
boolean contains = EsriGeometryUtil.contains(wktA, wktB, wkid);
boolean within = EsriGeometryUtil.within(wktA, wktB, wkid);
boolean disjoint = EsriGeometryUtil.disjoint(wktA, wktB, wkid);
boolean touches = EsriGeometryUtil.touches(wktA, wktB, wkid);
boolean crosses = EsriGeometryUtil.crosses(wktA, wktB, wkid);
boolean overlaps = EsriGeometryUtil.overlaps(wktA, wktB, wkid);
boolean equals = EsriGeometryUtil.equals(wktA, wktB, wkid);

// 空间分析（返回WKT）
String buffer = EsriGeometryUtil.buffer(wkt, wkid, 100);
String intersection = EsriGeometryUtil.intersection(wktA, wktB, wkid);
String union = EsriGeometryUtil.union(wktList, wkid);
String difference = EsriGeometryUtil.difference(wktA, wktB, wkid);
String symDifference = EsriGeometryUtil.symDifference(wktA, wktB, wkid);
String convexHull = EsriGeometryUtil.convexHull(wkt);
String boundary = EsriGeometryUtil.boundary(wkt);

// 几何属性
double area = EsriGeometryUtil.area(wkt);
double length = EsriGeometryUtil.length(wkt);
String centroid = EsriGeometryUtil.centroid(wkt);
int dimension = EsriGeometryUtil.dimension(wkt);
boolean isEmpty = EsriGeometryUtil.isEmpty(wkt);
double distance = EsriGeometryUtil.distance(wktA, wktB, wkid);
GeometryType geometryType = EsriGeometryUtil.geometryType(wkt);
boolean isSimple = EsriGeometryUtil.isSimple(wkt, wkid);

// 几何简化
String simplified = EsriGeometryUtil.simplify(wkt, wkid);
```

---

## 7. 坐标系管理

### 7.1 坐标转换

```java
import com.znlgis.ogu4j.common.CrsUtil;

// WKT字符串坐标转换
String transformedWkt = CrsUtil.transform(wkt, 4490, 4326);  // CGCS2000 -> WGS84

// JTS Geometry坐标转换
Geometry transformed = CrsUtil.transform(geometry, 4490, 4326);

// 图层投影转换
OguLayer reprojected = CrsUtil.reproject(layer, 4326);
```

### 7.2 带号相关操作

CGCS2000坐标系支持带号操作：

```java
// 获取带号
int zoneNumber = CrsUtil.getDh(geometry);  // 从几何获取
int zoneNumber = CrsUtil.getDh(wkt);       // 从WKT获取
int zoneNumber = CrsUtil.getDh(4528);      // 从WKID获取（4528是39带投影坐标系）

// 获取几何对应的WKID
Integer wkid = CrsUtil.getWkid(geometry);

// 获取投影坐标系WKID
Integer projectedWkid = CrsUtil.getProjectedWkid(39);  // 39带 -> 4528
Integer projectedWkid = CrsUtil.getProjectedWkid(geometry);
```

### 7.3 坐标系判断

```java
// 判断是否为投影坐标系
boolean isProjected = CrsUtil.isProjectedCRS(crs);

// 获取容差
double tolerance = CrsUtil.getTolerance(wkid);

// 获取支持的坐标系列表
Map<Integer, CoordinateReferenceSystem> crsList = CrsUtil.getSupportedCRSList();
```

### 7.4 常用坐标系WKID

| WKID | 坐标系名称 |
|------|----------|
| 4326 | WGS 1984 |
| 4490 | CGCS2000 地理坐标系 |
| 4528 | CGCS2000 / 3-degree Gauss-Kruger zone 39 |
| 4529 | CGCS2000 / 3-degree Gauss-Kruger zone 40 |
| 4530 | CGCS2000 / 3-degree Gauss-Kruger zone 41 |
| ... | ... |

---

## 8. 实用工具

### 8.1 ZIP压缩解压

```java
import com.znlgis.ogu4j.common.ZipUtil;
import java.nio.charset.StandardCharsets;

// 压缩文件夹
ZipUtil.zip("/path/to/folder", "/path/to/output.zip");
ZipUtil.zip("/path/to/folder", "/path/to/output.zip", StandardCharsets.UTF_8);

// 解压文件
ZipUtil.unzip("/path/to/input.zip", "/path/to/dest");
ZipUtil.unzip("/path/to/input.zip", "/path/to/dest", StandardCharsets.UTF_8);
```

### 8.2 文件编码检测

```java
import com.znlgis.ogu4j.common.EncodingUtil;
import java.io.File;
import java.nio.charset.Charset;

// 自动检测文件编码
File file = new File("/path/to/file.txt");
Charset charset = EncodingUtil.getFileEncoding(file);
System.out.println("文件编码: " + charset.name());
```

### 8.3 自然排序

```java
import com.znlgis.ogu4j.common.SortUtil;
import java.util.*;

// 字符串自然排序比较
int result = SortUtil.compareString("第5章", "第10章");  // 返回 -1
int result = SortUtil.compareString("file2", "file10");  // 返回 -1

// 列表排序
List<String> chapters = Arrays.asList("第10章", "第2章", "第1章", "第11章");
chapters.sort(SortUtil::compareString);
// 结果: ["第1章", "第2章", "第10章", "第11章"]
```

### 8.4 数字格式化

```java
import com.znlgis.ogu4j.common.NumUtil;

// 去除科学计数法
String plainString = NumUtil.getPlainString(1.234E10);  // "12340000000"
String plainString = NumUtil.getPlainString(1.5E-5);    // "0.000015"
```

### 8.5 GDAL命令行工具

```java
import com.znlgis.ogu4j.common.GdalCmdUtil;
import com.znlgis.ogu4j.model.GdbGroupModel;

// 获取GDB图层结构
GdbGroupModel structure = GdalCmdUtil.getGdbDataStructure("/path/to/data.gdb");
System.out.println("要素数据集: " + structure.getFeatureDatasets());
System.out.println("图层列表: " + structure.getLayers());
```

---

## 9. 进阶开发

### 9.1 批量数据处理

```java
import java.io.File;
import java.util.*;
import java.util.concurrent.*;

public class BatchProcessor {
    
    /**
     * 批量转换Shapefile为GeoJSON
     */
    public static void batchConvert(String inputDir, String outputDir) {
        File dir = new File(inputDir);
        File[] shpFiles = dir.listFiles((d, name) -> name.endsWith(".shp"));
        
        if (shpFiles == null) return;
        
        ExecutorService executor = Executors.newFixedThreadPool(4);
        
        for (File shpFile : shpFiles) {
            executor.submit(() -> {
                try {
                    String baseName = shpFile.getName().replace(".shp", "");
                    String outputPath = outputDir + "/" + baseName + ".geojson";
                    
                    OguLayer layer = OguLayerConverter.fromShapefile(
                        shpFile.getAbsolutePath(), null, null, GisEngineType.GEOTOOLS);
                    OguLayerConverter.toGeoJSON(layer, outputPath, GisEngineType.GEOTOOLS);
                    
                    System.out.println("已转换: " + baseName);
                } catch (Exception e) {
                    System.err.println("转换失败: " + shpFile.getName() + " - " + e.getMessage());
                }
            });
        }
        
        executor.shutdown();
        try {
            executor.awaitTermination(1, TimeUnit.HOURS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

### 9.2 空间分析流水线

```java
public class SpatialAnalysisPipeline {
    
    /**
     * 执行空间分析流水线
     * 1. 读取数据
     * 2. 过滤要素
     * 3. 缓冲区分析
     * 4. 裁剪
     * 5. 输出结果
     */
    public static OguLayer analyze(String inputPath, String clipPath, double bufferDistance) {
        // 1. 读取输入数据
        OguLayer inputLayer = OguLayerConverter.fromShapefile(
            inputPath, null, null, GisEngineType.GEOTOOLS);
        
        // 2. 过滤要素（例如：只处理面积大于1000的多边形）
        List<OguFeature> filtered = inputLayer.filter(feature -> {
            Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
            return geom.getArea() > 1000;
        });
        
        // 3. 缓冲区分析
        List<OguFeature> buffered = new ArrayList<>();
        for (OguFeature feature : filtered) {
            Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
            Geometry buffer = JtsGeometryUtil.buffer(geom, bufferDistance);
            
            OguFeature newFeature = new OguFeature();
            newFeature.setFid(feature.getFid());
            newFeature.setWkt(GeometryConverter.geometry2Wkt(buffer));
            newFeature.setAttributes(feature.getAttributes());
            buffered.add(newFeature);
        }
        
        // 4. 裁剪（如果提供了裁剪范围）
        if (clipPath != null) {
            OguLayer clipLayer = OguLayerConverter.fromShapefile(
                clipPath, null, null, GisEngineType.GEOTOOLS);
            
            if (!clipLayer.getFeatures().isEmpty()) {
                Geometry clipGeom = GeometryConverter.wkt2Geometry(
                    clipLayer.getFeatures().get(0).getWkt());
                
                List<OguFeature> clipped = new ArrayList<>();
                for (OguFeature feature : buffered) {
                    Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
                    if (geom.intersects(clipGeom)) {
                        Geometry intersection = JtsGeometryUtil.intersection(geom, clipGeom);
                        if (!intersection.isEmpty()) {
                            OguFeature newFeature = new OguFeature();
                            newFeature.setFid(feature.getFid());
                            newFeature.setWkt(GeometryConverter.geometry2Wkt(intersection));
                            newFeature.setAttributes(feature.getAttributes());
                            clipped.add(newFeature);
                        }
                    }
                }
                buffered = clipped;
            }
        }
        
        // 5. 构建结果图层
        OguLayer result = new OguLayer();
        result.setName(inputLayer.getName() + "_analyzed");
        result.setWkid(inputLayer.getWkid());
        result.setGeometryType(inputLayer.getGeometryType());
        result.setFields(inputLayer.getFields());
        result.setFeatures(buffered);
        
        return result;
    }
}
```

### 9.3 拓扑检查与修复

```java
public class TopologyChecker {
    
    /**
     * 检查图层中所有要素的拓扑有效性
     */
    public static List<Map<String, Object>> checkTopology(OguLayer layer) {
        List<Map<String, Object>> errors = new ArrayList<>();
        
        for (OguFeature feature : layer.getFeatures()) {
            Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
            TopologyValidationResult result = JtsGeometryUtil.isValid(geom);
            
            if (!result.isValid()) {
                Map<String, Object> error = new HashMap<>();
                error.put("fid", feature.getFid());
                error.put("errorType", result.getErrorType().name());
                error.put("errorDesc", result.getErrorType().getDesc());
                error.put("coordinate", result.getCoordinate());
                error.put("message", result.getMessage());
                errors.add(error);
            }
        }
        
        return errors;
    }
    
    /**
     * 修复图层中的拓扑错误
     */
    public static OguLayer repairTopology(OguLayer layer) {
        List<OguFeature> repairedFeatures = new ArrayList<>();
        
        for (OguFeature feature : layer.getFeatures()) {
            Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
            TopologyValidationResult result = JtsGeometryUtil.isValid(geom);
            
            if (!result.isValid()) {
                // 尝试修复
                Geometry repaired = JtsGeometryUtil.validate(geom);
                OguFeature newFeature = new OguFeature();
                newFeature.setFid(feature.getFid());
                newFeature.setWkt(GeometryConverter.geometry2Wkt(repaired));
                newFeature.setAttributes(feature.getAttributes());
                repairedFeatures.add(newFeature);
            } else {
                repairedFeatures.add(feature);
            }
        }
        
        OguLayer result = new OguLayer();
        result.setName(layer.getName());
        result.setWkid(layer.getWkid());
        result.setGeometryType(layer.getGeometryType());
        result.setFields(layer.getFields());
        result.setFeatures(repairedFeatures);
        
        return result;
    }
}
```

### 9.4 自定义数据源适配

```java
import cn.hutool.http.HttpUtil;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;

public class CustomDataSourceAdapter {
    
    /**
     * 从自定义API读取GIS数据
     * 使用Hutool的HttpUtil发送HTTP请求
     */
    public static OguLayer fromCustomAPI(String apiUrl, Map<String, String> params) {
        // 发送HTTP请求获取数据（使用Hutool的HttpUtil）
        String response = HttpUtil.get(apiUrl, params);
        JSONObject json = JSON.parseObject(response);
        
        // 解析响应构建图层
        OguLayer layer = new OguLayer();
        layer.setName(json.getString("layerName"));
        layer.setWkid(json.getInteger("srid"));
        layer.setGeometryType(GeometryType.valueOf(json.getString("geometryType")));
        
        // 解析字段
        List<OguField> fields = new ArrayList<>();
        JSONArray fieldArray = json.getJSONArray("fields");
        for (int i = 0; i < fieldArray.size(); i++) {
            JSONObject fieldJson = fieldArray.getJSONObject(i);
            OguField field = new OguField();
            field.setName(fieldJson.getString("name"));
            field.setAlias(fieldJson.getString("alias"));
            field.setDataType(FieldDataType.valueOf(fieldJson.getString("type")));
            fields.add(field);
        }
        layer.setFields(fields);
        
        // 解析要素
        List<OguFeature> features = new ArrayList<>();
        JSONArray featureArray = json.getJSONArray("features");
        for (int i = 0; i < featureArray.size(); i++) {
            JSONObject featureJson = featureArray.getJSONObject(i);
            OguFeature feature = new OguFeature();
            feature.setFid(featureJson.getLong("id"));
            feature.setWkt(featureJson.getString("geometry"));
            feature.setAttributes(featureJson.getJSONObject("properties").getInnerMap());
            features.add(feature);
        }
        layer.setFeatures(features);
        
        return layer;
    }
}
```

---

## 10. 最佳实践

### 10.1 内存管理

```java
// 大数据量处理时使用流式处理
public void processLargeDataset(String inputPath, String outputPath) {
    // 使用分页读取
    int pageSize = 1000;
    int offset = 0;
    
    while (true) {
        String filter = String.format("FID >= %d AND FID < %d", offset, offset + pageSize);
        OguLayer batch = OguLayerConverter.fromShapefile(
            inputPath, filter, null, GisEngineType.GEOTOOLS);
        
        if (batch.getFeatures().isEmpty()) {
            break;
        }
        
        // 处理当前批次
        processBatch(batch);
        
        offset += pageSize;
    }
}
```

### 10.2 错误处理

```java
public OguLayer safeLoadLayer(String path) {
    try {
        OguLayer layer = OguLayerConverter.fromShapefile(path, null, null, GisEngineType.GEOTOOLS);
        layer.validate();
        return layer;
    } catch (IllegalArgumentException e) {
        System.err.println("数据验证失败: " + e.getMessage());
        return null;
    } catch (Exception e) {
        System.err.println("数据加载失败: " + e.getMessage());
        e.printStackTrace();
        return null;
    }
}
```

### 10.3 坐标系处理

```java
// 确保数据使用正确的坐标系
public OguLayer ensureCoordinateSystem(OguLayer layer, int targetWkid) {
    if (layer.getWkid() == null) {
        System.out.println("警告: 图层缺少坐标系信息");
        layer.setWkid(targetWkid);
        return layer;
    }
    
    if (!layer.getWkid().equals(targetWkid)) {
        System.out.println("正在转换坐标系: " + layer.getWkid() + " -> " + targetWkid);
        return CrsUtil.reproject(layer, targetWkid);
    }
    
    return layer;
}
```

### 10.4 性能优化

```java
// 使用空间索引加速查询
public List<OguFeature> spatialQuery(OguLayer layer, String queryWkt) {
    Geometry queryGeom = GeometryConverter.wkt2Geometry(queryWkt);
    Envelope envelope = queryGeom.getEnvelopeInternal();
    
    // 先用包围盒过滤
    List<OguFeature> candidates = layer.filter(feature -> {
        Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
        return geom.getEnvelopeInternal().intersects(envelope);
    });
    
    // 再进行精确判断
    return candidates.stream()
        .filter(feature -> {
            Geometry geom = GeometryConverter.wkt2Geometry(feature.getWkt());
            return geom.intersects(queryGeom);
        })
        .collect(Collectors.toList());
}
```

### 10.5 日志记录

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class GisProcessor {
    private static final Logger logger = LoggerFactory.getLogger(GisProcessor.class);
    
    public void process(String inputPath) {
        logger.info("开始处理: {}", inputPath);
        
        try {
            OguLayer layer = OguLayerConverter.fromShapefile(
                inputPath, null, null, GisEngineType.GEOTOOLS);
            logger.info("加载成功, 要素数量: {}", layer.getFeatureCount());
            
            // 处理逻辑...
            
            logger.info("处理完成");
        } catch (Exception e) {
            logger.error("处理失败", e);
            throw e;
        }
    }
}
```

---

## 附录

### A. 常见问题

#### Q1: 如何处理中文乱码？
```java
// Shapefile中文编码问题
// 通过设置系统属性解决
System.setProperty("sun.jnu.encoding", "UTF-8");
System.setProperty("file.encoding", "UTF-8");

// 或使用EncodingUtil检测编码
Charset charset = EncodingUtil.getFileEncoding(new File("data.dbf"));
```

#### Q2: GDAL引擎无法加载？
确保GDAL已正确安装并配置环境变量：
```bash
# Linux
export GDAL_DATA=/usr/share/gdal
export LD_LIBRARY_PATH=/usr/lib:$LD_LIBRARY_PATH

# Windows
set GDAL_DATA=C:\Program Files\GDAL\gdal-data
set PATH=C:\Program Files\GDAL;%PATH%
```

#### Q3: 如何处理大文件？
使用分批处理和流式读取，避免一次性加载全部数据到内存。

### B. 参考资源

- [OGU4J GitHub仓库](https://github.com/znlgis/opengis-utils-for-java)
- [GeoTools官方文档](https://docs.geotools.org/)
- [JTS官方文档](https://locationtech.github.io/jts/)
- [Esri Geometry API](https://github.com/Esri/geometry-api-java)
- [GDAL官方文档](https://gdal.org/)

### C. 许可证

本项目基于 Apache License 2.0 开源许可证。

---

*最后更新时间: 2024年*

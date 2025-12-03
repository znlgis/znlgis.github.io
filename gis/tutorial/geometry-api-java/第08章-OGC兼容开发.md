---
layout: default
title: 第08章 - OGC兼容开发
---

# 第08章 - OGC兼容开发

## 8.1 OGC Simple Feature 规范

### 8.1.1 规范概述

OGC Simple Feature Access (SFA) 是开放地理空间联盟定义的几何数据模型和操作标准。geometry-api-java 通过 `com.esri.core.geometry.ogc` 包提供完整的 OGC 兼容支持。

**OGC 几何类型层次**：
```
Geometry
├── Point
├── Curve
│   └── LineString
│       └── LinearRing
├── Surface
│   └── Polygon
└── GeometryCollection
    ├── MultiPoint
    ├── MultiCurve
    │   └── MultiLineString
    └── MultiSurface
        └── MultiPolygon
```

### 8.1.2 ESRI 与 OGC 几何的对比

| OGC 类型 | ESRI 类型 | 关键区别 |
|---------|-----------|---------|
| Point | Point | 基本相同 |
| LineString | Polyline (单路径) | OGC 是单路径 |
| Polygon | Polygon (单外环) | OGC 严格单外环 |
| MultiPoint | MultiPoint | 基本相同 |
| MultiLineString | Polyline (多路径) | OGC 明确多线串 |
| MultiPolygon | Polygon (多外环) | OGC 明确多多边形 |
| GeometryCollection | 无直接对应 | OGC 特有 |

### 8.1.3 OGC 几何类层次

```java
// OGC 几何类继承关系
com.esri.core.geometry.ogc
├── OGCGeometry                    // 抽象基类
├── OGCPoint                       // 点
├── OGCCurve                       // 曲线（抽象）
│   └── OGCLineString             // 线串
│       └── OGCLinearRing         // 线环
├── OGCSurface                     // 面（抽象）
│   └── OGCPolygon                // 多边形
├── OGCGeometryCollection          // 几何集合（抽象）
│   ├── OGCMultiPoint             // 多点
│   ├── OGCMultiCurve             // 多曲线（抽象）
│   │   └── OGCMultiLineString    // 多线串
│   ├── OGCMultiSurface           // 多面（抽象）
│   │   └── OGCMultiPolygon       // 多多边形
│   └── OGCConcreteGeometryCollection // 具体几何集合
```

## 8.2 OGCGeometry 基类

### 8.2.1 通用方法

```java
// OGCGeometry 提供的通用方法
public abstract class OGCGeometry {
    // 维度信息
    public int dimension();           // 几何维度 (0, 1, 2)
    public int coordinateDimension(); // 坐标维度 (2, 3, 4)
    
    // 类型信息
    public abstract String geometryType();
    public int SRID();
    
    // 属性判断
    public boolean isEmpty();
    public boolean isSimple();
    public boolean is3D();
    public boolean isMeasured();
    
    // 边界和包络
    public abstract OGCGeometry boundary();
    public OGCGeometry envelope();
    
    // 空间关系
    public boolean Equals(OGCGeometry another);
    public boolean disjoint(OGCGeometry another);
    public boolean intersects(OGCGeometry another);
    public boolean touches(OGCGeometry another);
    public boolean crosses(OGCGeometry another);
    public boolean within(OGCGeometry another);
    public boolean contains(OGCGeometry another);
    public boolean overlaps(OGCGeometry another);
    public boolean relate(OGCGeometry another, String matrix);
    
    // 空间操作
    public double distance(OGCGeometry another);
    public OGCGeometry buffer(double distance);
    public OGCGeometry convexHull();
    public OGCGeometry intersection(OGCGeometry another);
    public OGCGeometry union(OGCGeometry another);
    public OGCGeometry difference(OGCGeometry another);
    public OGCGeometry symDifference(OGCGeometry another);
    
    // 格式转换
    public String asText();           // 转 WKT
    public ByteBuffer asBinary();     // 转 WKB
    public String asGeoJson();        // 转 GeoJSON
    public String asJson();           // 转 ESRI JSON
    
    // 与 ESRI 几何互转
    public abstract Geometry getEsriGeometry();
    public SpatialReference getEsriSpatialReference();
    
    // 类型转换
    public abstract OGCGeometry convertToMulti();
    public abstract OGCGeometry reduceFromMulti();
}
```

### 8.2.2 创建 OGC 几何

```java
// 从 WKT 创建
OGCGeometry geom = OGCGeometry.fromText("POINT (116.4 39.9)");

// 从 WKB 创建
byte[] wkbBytes = getWkbData();
OGCGeometry geom2 = OGCGeometry.fromBinary(ByteBuffer.wrap(wkbBytes));

// 从 GeoJSON 创建
String geoJson = "{\"type\":\"Point\",\"coordinates\":[116.4,39.9]}";
OGCGeometry geom3 = OGCGeometry.fromGeoJson(geoJson);

// 从 ESRI JSON 创建
String esriJson = "{\"x\":116.4,\"y\":39.9}";
OGCGeometry geom4 = OGCGeometry.fromJson(esriJson);

// 从 ESRI Shape 创建
byte[] shapeBytes = getShapeData();
OGCGeometry geom5 = OGCGeometry.fromEsriShape(ByteBuffer.wrap(shapeBytes));

// 从 ESRI Geometry 创建
Point esriPoint = new Point(116.4, 39.9);
SpatialReference sr = SpatialReference.create(4326);
OGCGeometry geom6 = OGCGeometry.createFromEsriGeometry(esriPoint, sr);
```

## 8.3 OGC 点几何

### 8.3.1 OGCPoint

```java
// 创建 OGCPoint
OGCPoint point = (OGCPoint) OGCGeometry.fromText("POINT (116.4 39.9)");

// 或从 ESRI Point 创建
Point esriPoint = new Point(116.4, 39.9);
OGCPoint point2 = new OGCPoint(esriPoint, SpatialReference.create(4326));

// OGCPoint 特有方法
double x = point.X();
double y = point.Y();
double z = point.Z();  // 如果有 Z
double m = point.M();  // 如果有 M

// 类型
String type = point.geometryType();  // "Point"
```

### 8.3.2 OGCMultiPoint

```java
// 创建 OGCMultiPoint
OGCMultiPoint multiPoint = (OGCMultiPoint) OGCGeometry.fromText(
    "MULTIPOINT ((0 0), (10 10), (20 20))");

// 或从 ESRI MultiPoint 创建
MultiPoint esriMultiPoint = new MultiPoint();
esriMultiPoint.add(0, 0);
esriMultiPoint.add(10, 10);
OGCMultiPoint mp2 = new OGCMultiPoint(esriMultiPoint, null);

// OGCMultiPoint 特有方法
int numPoints = multiPoint.numGeometries();
OGCPoint firstPoint = (OGCPoint) multiPoint.geometryN(0);
```

## 8.4 OGC 线几何

### 8.4.1 OGCLineString

```java
// 创建 OGCLineString
OGCLineString line = (OGCLineString) OGCGeometry.fromText(
    "LINESTRING (0 0, 10 10, 20 0)");

// 或从 ESRI Polyline 创建
Polyline esriLine = new Polyline();
esriLine.startPath(0, 0);
esriLine.lineTo(10, 10);
esriLine.lineTo(20, 0);
OGCLineString line2 = new OGCLineString(esriLine, 0, null);

// OGCLineString 特有方法
int numPoints = line.numPoints();
OGCPoint startPoint = line.startPoint();
OGCPoint endPoint = line.endPoint();
boolean isClosed = line.isClosed();
boolean isRing = line.isRing();  // 闭合且简单
double length = line.length();

// 获取任意点
OGCPoint pointN = line.pointN(1);
```

### 8.4.2 OGCMultiLineString

```java
// 创建 OGCMultiLineString
OGCMultiLineString multiLine = (OGCMultiLineString) OGCGeometry.fromText(
    "MULTILINESTRING ((0 0, 10 10), (20 20, 30 30))");

// OGCMultiLineString 特有方法
int numLineStrings = multiLine.numGeometries();
OGCLineString firstLine = (OGCLineString) multiLine.geometryN(0);
double totalLength = multiLine.length();
boolean isClosed = multiLine.isClosed();  // 所有组成线都闭合
```

### 8.4.3 OGCLinearRing

```java
// OGCLinearRing 是闭合的简单 LineString
// 通常作为 Polygon 的组成部分，不单独使用

String wkt = "LINEARRING (0 0, 10 0, 10 10, 0 10, 0 0)";
// 注意：许多 WKT 解析器不支持 LINEARRING 类型
```

## 8.5 OGC 面几何

### 8.5.1 OGCPolygon

```java
// 创建 OGCPolygon
OGCPolygon polygon = (OGCPolygon) OGCGeometry.fromText(
    "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");

// 带孔洞的多边形
OGCPolygon polygonWithHole = (OGCPolygon) OGCGeometry.fromText(
    "POLYGON ((0 0, 20 0, 20 20, 0 20, 0 0), (5 5, 5 15, 15 15, 15 5, 5 5))");

// 或从 ESRI Polygon 创建
Polygon esriPolygon = new Polygon();
esriPolygon.startPath(0, 0);
esriPolygon.lineTo(10, 0);
esriPolygon.lineTo(10, 10);
esriPolygon.lineTo(0, 10);
esriPolygon.closePathWithLine();
OGCPolygon polygon2 = new OGCPolygon(esriPolygon, 0, null);

// OGCPolygon 特有方法
OGCLineString exteriorRing = polygon.exteriorRing();
int numInteriorRings = polygon.numInteriorRing();
OGCLineString interiorRing = polygon.interiorRingN(0);
double area = polygon.area();
OGCPoint centroid = polygon.centroid();
OGCPoint pointOnSurface = polygon.pointOnSurface();
```

### 8.5.2 OGCMultiPolygon

```java
// 创建 OGCMultiPolygon
OGCMultiPolygon multiPolygon = (OGCMultiPolygon) OGCGeometry.fromText(
    "MULTIPOLYGON (((0 0, 10 0, 10 10, 0 10, 0 0)), " +
    "((20 20, 30 20, 30 30, 20 30, 20 20)))");

// OGCMultiPolygon 特有方法
int numPolygons = multiPolygon.numGeometries();
OGCPolygon firstPolygon = (OGCPolygon) multiPolygon.geometryN(0);
double totalArea = multiPolygon.area();
OGCPoint centroid = multiPolygon.centroid();
```

## 8.6 OGC 几何集合

### 8.6.1 OGCGeometryCollection

```java
// 创建 OGCConcreteGeometryCollection
OGCGeometry collection = OGCGeometry.fromText(
    "GEOMETRYCOLLECTION (POINT (0 0), LINESTRING (0 0, 10 10))");

OGCConcreteGeometryCollection gc = (OGCConcreteGeometryCollection) collection;

// OGCGeometryCollection 方法
int numGeometries = gc.numGeometries();

for (int i = 0; i < numGeometries; i++) {
    OGCGeometry geom = gc.geometryN(i);
    System.out.println(geom.geometryType());
}
```

### 8.6.2 创建 GeometryCollection

```java
// 从多个 OGCGeometry 创建
List<OGCGeometry> geometries = new ArrayList<>();
geometries.add(OGCGeometry.fromText("POINT (0 0)"));
geometries.add(OGCGeometry.fromText("LINESTRING (0 0, 10 10)"));
geometries.add(OGCGeometry.fromText("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))"));

OGCConcreteGeometryCollection collection = 
    new OGCConcreteGeometryCollection(geometries, SpatialReference.create(4326));
```

### 8.6.3 遍历 GeometryCollection

```java
public void processGeometryCollection(OGCGeometry geometry) {
    if (geometry instanceof OGCConcreteGeometryCollection) {
        OGCConcreteGeometryCollection gc = (OGCConcreteGeometryCollection) geometry;
        for (int i = 0; i < gc.numGeometries(); i++) {
            processGeometryCollection(gc.geometryN(i));  // 递归
        }
    } else {
        // 处理单个几何
        System.out.println(geometry.geometryType() + ": " + geometry.asText());
    }
}
```

## 8.7 OGC 空间操作

### 8.7.1 空间关系

```java
OGCPolygon polygon = (OGCPolygon) OGCGeometry.fromText(
    "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
OGCPoint point = (OGCPoint) OGCGeometry.fromText("POINT (5 5)");

// 空间关系判断
boolean contains = polygon.contains(point);
boolean within = point.within(polygon);
boolean intersects = polygon.intersects(point);
boolean disjoint = polygon.disjoint(point);
boolean touches = polygon.touches(point);
boolean equals = polygon.Equals(polygon);

// DE-9IM 关系
boolean relate = polygon.relate(point, "T*F**F***");  // contains 模式
```

### 8.7.2 空间操作

```java
OGCPolygon p1 = (OGCPolygon) OGCGeometry.fromText(
    "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
OGCPolygon p2 = (OGCPolygon) OGCGeometry.fromText(
    "POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))");

// 缓冲区
OGCGeometry buffer = p1.buffer(2.0);

// 凸包
OGCGeometry hull = p1.convexHull();

// 布尔操作
OGCGeometry intersection = p1.intersection(p2);
OGCGeometry union = p1.union(p2);
OGCGeometry difference = p1.difference(p2);
OGCGeometry symDiff = p1.symDifference(p2);

// 距离
double distance = p1.distance(p2);
```

### 8.7.3 简化操作

```java
OGCGeometry geometry = OGCGeometry.fromText("POLYGON (...)");

// 检查是否简单
boolean isSimple = geometry.isSimple();

// 使几何简单化（OGC 规则）
OGCGeometry simplified = geometry.makeSimple();

// 使几何简单化（Geodatabase 规则，更宽松）
OGCGeometry simplifiedRelaxed = geometry.makeSimpleRelaxed(true);
```

## 8.8 类型转换

### 8.8.1 OGC 与 ESRI 几何互转

```java
// OGC → ESRI
OGCPolygon ogcPolygon = (OGCPolygon) OGCGeometry.fromText(
    "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
Geometry esriGeom = ogcPolygon.getEsriGeometry();
SpatialReference sr = ogcPolygon.getEsriSpatialReference();

// ESRI → OGC
Polygon esriPolygon = new Polygon();
esriPolygon.startPath(0, 0);
esriPolygon.lineTo(10, 0);
esriPolygon.lineTo(10, 10);
esriPolygon.lineTo(0, 10);
esriPolygon.closePathWithLine();

OGCGeometry ogcGeom = OGCGeometry.createFromEsriGeometry(
    esriPolygon, SpatialReference.create(4326));
```

### 8.8.2 单一类型与多类型转换

```java
// 转换为多类型
OGCPoint point = (OGCPoint) OGCGeometry.fromText("POINT (0 0)");
OGCGeometry multiPoint = point.convertToMulti();
System.out.println(multiPoint.geometryType());  // "MultiPoint"

// 从多类型简化
OGCMultiPoint mp = (OGCMultiPoint) OGCGeometry.fromText("MULTIPOINT ((0 0))");
OGCGeometry reduced = mp.reduceFromMulti();
System.out.println(reduced.geometryType());  // "Point"
```

## 8.9 格式转换

### 8.9.1 WKT 读写

```java
// 从 WKT 读取
OGCGeometry geom = OGCGeometry.fromText("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");

// 写入 WKT
String wkt = geom.asText();
System.out.println(wkt);
```

### 8.9.2 WKB 读写

```java
// 从 WKB 读取
byte[] wkbBytes = getWkbData();
OGCGeometry geom = OGCGeometry.fromBinary(ByteBuffer.wrap(wkbBytes));

// 写入 WKB
ByteBuffer wkb = geom.asBinary();
byte[] bytes = new byte[wkb.remaining()];
wkb.get(bytes);
```

### 8.9.3 GeoJSON 读写

```java
// 从 GeoJSON 读取
String geoJson = "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}";
OGCGeometry geom = OGCGeometry.fromGeoJson(geoJson);

// 写入 GeoJSON
String outputGeoJson = geom.asGeoJson();
System.out.println(outputGeoJson);
```

## 8.10 实战应用

### 8.10.1 空间查询封装

```java
public class OGCSpatialQuery {
    private SpatialReference sr;
    
    public OGCSpatialQuery(int srid) {
        this.sr = SpatialReference.create(srid);
    }
    
    /**
     * 查找包含指定点的多边形
     */
    public List<OGCPolygon> findContaining(OGCPoint point, List<OGCPolygon> polygons) {
        List<OGCPolygon> result = new ArrayList<>();
        for (OGCPolygon polygon : polygons) {
            if (polygon.contains(point)) {
                result.add(polygon);
            }
        }
        return result;
    }
    
    /**
     * 查找与指定几何相交的几何
     */
    public List<OGCGeometry> findIntersecting(OGCGeometry query, List<OGCGeometry> geometries) {
        List<OGCGeometry> result = new ArrayList<>();
        for (OGCGeometry geom : geometries) {
            if (query.intersects(geom)) {
                result.add(geom);
            }
        }
        return result;
    }
    
    /**
     * 缓冲区查询
     */
    public List<OGCGeometry> findWithinDistance(OGCGeometry center, 
            double distance, List<OGCGeometry> geometries) {
        OGCGeometry buffer = center.buffer(distance);
        return findIntersecting(buffer, geometries);
    }
}
```

### 8.10.2 几何验证

```java
public class OGCGeometryValidator {
    
    /**
     * 验证几何是否符合 OGC 标准
     */
    public ValidationResult validate(OGCGeometry geometry) {
        ValidationResult result = new ValidationResult();
        
        // 检查是否为空
        if (geometry.isEmpty()) {
            result.addIssue("几何为空");
            return result;
        }
        
        // 检查是否简单
        if (!geometry.isSimple()) {
            result.addIssue("几何不简单（可能自相交）");
        }
        
        // 特定类型检查
        if (geometry instanceof OGCPolygon) {
            validatePolygon((OGCPolygon) geometry, result);
        } else if (geometry instanceof OGCLineString) {
            validateLineString((OGCLineString) geometry, result);
        }
        
        return result;
    }
    
    private void validatePolygon(OGCPolygon polygon, ValidationResult result) {
        // 检查外环方向
        OGCLineString exterior = polygon.exteriorRing();
        if (!isCounterClockwise(exterior)) {
            result.addWarning("外环应为逆时针方向");
        }
        
        // 检查内环方向
        for (int i = 0; i < polygon.numInteriorRing(); i++) {
            OGCLineString interior = polygon.interiorRingN(i);
            if (!isClockwise(interior)) {
                result.addWarning("内环 " + i + " 应为顺时针方向");
            }
        }
        
        // 检查面积
        if (polygon.area() <= 0) {
            result.addIssue("多边形面积非正");
        }
    }
    
    private void validateLineString(OGCLineString line, ValidationResult result) {
        if (line.numPoints() < 2) {
            result.addIssue("线串至少需要2个点");
        }
    }
    
    private boolean isCounterClockwise(OGCLineString ring) {
        // 简化实现：使用面积符号判断
        Polyline polyline = (Polyline) ring.getEsriGeometry();
        Polygon tempPolygon = new Polygon();
        tempPolygon.addPath(polyline, 0, true);
        return tempPolygon.calculateRingArea2D(0) > 0;
    }
    
    private boolean isClockwise(OGCLineString ring) {
        return !isCounterClockwise(ring);
    }
}
```

## 8.11 本章小结

本章详细介绍了 geometry-api-java 的 OGC 兼容开发：

1. **OGC 规范**：Simple Feature Access 标准
2. **OGC 几何类**：Point、LineString、Polygon 等
3. **几何集合**：GeometryCollection 及其子类
4. **空间操作**：关系判断和布尔运算
5. **类型转换**：OGC 与 ESRI 几何互转
6. **格式转换**：WKT、WKB、GeoJSON
7. **实战应用**：空间查询和几何验证

**关键要点**：
- OGC 类型更严格，适合标准化场景
- 使用 OGCGeometry 进行跨平台数据交换
- 注意 OGC 与 ESRI 几何的差异
- 使用 makeSimple() 确保几何符合 OGC 规范

---

[← 上一章：坐标系与空间参考](第07章-坐标系与空间参考) | [下一章：性能优化与加速 →](第09章-性能优化与加速)

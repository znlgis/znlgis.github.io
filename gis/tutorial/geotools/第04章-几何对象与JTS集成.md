---
layout: default
title: 第04章 - 几何对象与JTS集成
---

# 第04章 - 几何对象与JTS集成

## 4.1 JTS 概述

### 4.1.1 JTS 简介

JTS (Java Topology Suite) 是一个用于创建和操作矢量几何的 Java 库。GeoTools 使用 JTS 作为其几何引擎，所有的几何操作都基于 JTS 实现。

**JTS 的主要特点**：

- 实现 OGC Simple Features Specification
- 提供完整的几何类型支持
- 丰富的空间操作和关系判断
- 高效的空间索引
- 稳定的鲁棒性几何算法

```
┌─────────────────────────────────────────────────────────────┐
│                      JTS 架构                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   几何类型                                                   │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Point │ LineString │ Polygon │ Multi* │ Collection │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   空间操作                                                   │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Buffer │ Union │ Intersection │ Difference │ Clip  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   空间关系                                                   │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Contains │ Within │ Intersects │ Touches │ Relate  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   空间索引                                                   │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  R-Tree │ Quadtree │ STRtree │ KdTree               │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.1.2 几何类型体系

JTS 定义了完整的几何类型体系：

```
Geometry (抽象基类)
    │
    ├── Point                    # 点
    │
    ├── LineString               # 线串
    │   └── LinearRing           # 线环（闭合线串）
    │
    ├── Polygon                  # 多边形
    │
    ├── GeometryCollection       # 几何集合
    │   ├── MultiPoint           # 多点
    │   ├── MultiLineString      # 多线串
    │   └── MultiPolygon         # 多多边形
    │
    └── Puntal/Lineal/Polygonal  # 维度接口
```

### 4.1.3 坐标模型

```java
/**
 * Coordinate - 坐标类
 */
public class Coordinate implements Comparable<Coordinate>, Cloneable, Serializable {
    public double x;    // X 坐标
    public double y;    // Y 坐标
    public double z;    // Z 坐标（可选）
    public double m;    // M 值（度量值，可选）
    
    // 构造方法
    public Coordinate() { }
    public Coordinate(double x, double y) { }
    public Coordinate(double x, double y, double z) { }
    public Coordinate(Coordinate c) { }
    
    // 距离计算
    public double distance(Coordinate c) { }
    
    // 相等判断
    public boolean equals2D(Coordinate other) { }
    public boolean equals3D(Coordinate other) { }
}

/**
 * CoordinateSequence - 坐标序列（用于存储大量坐标）
 */
public interface CoordinateSequence extends Cloneable {
    int getDimension();
    int size();
    Coordinate getCoordinate(int i);
    double getX(int index);
    double getY(int index);
    double getZ(int index);
    double getM(int index);
}
```

## 4.2 几何对象创建

### 4.2.1 GeometryFactory

所有几何对象都通过 `GeometryFactory` 创建：

```java
import org.geotools.geometry.jts.JTSFactoryFinder;
import org.locationtech.jts.geom.*;

// 获取几何工厂
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 或者直接创建（指定精度模型和 SRID）
GeometryFactory gf2 = new GeometryFactory(
    new PrecisionModel(PrecisionModel.FLOATING),
    4326
);
```

### 4.2.2 创建 Point

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 方式1：从 Coordinate 创建
Coordinate coord = new Coordinate(116.4074, 39.9042);
Point point1 = gf.createPoint(coord);

// 方式2：从 CoordinateSequence 创建
CoordinateSequence seq = gf.getCoordinateSequenceFactory()
    .create(new Coordinate[]{new Coordinate(116.4074, 39.9042)});
Point point2 = gf.createPoint(seq);

// 创建 3D 点
Coordinate coord3D = new Coordinate(116.4074, 39.9042, 100.0);
Point point3D = gf.createPoint(coord3D);

// 创建空点
Point emptyPoint = gf.createPoint();  // 或 gf.createPoint((Coordinate) null)

System.out.println("Point: " + point1);  // POINT (116.4074 39.9042)
System.out.println("X: " + point1.getX());
System.out.println("Y: " + point1.getY());
```

### 4.2.3 创建 LineString

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 从坐标数组创建
Coordinate[] coords = new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 10),
    new Coordinate(20, 5),
    new Coordinate(30, 15)
};
LineString line = gf.createLineString(coords);

System.out.println("LineString: " + line);
System.out.println("长度: " + line.getLength());
System.out.println("点数: " + line.getNumPoints());
System.out.println("起点: " + line.getStartPoint());
System.out.println("终点: " + line.getEndPoint());
System.out.println("是否闭合: " + line.isClosed());

// 创建 LinearRing（闭合线环）
Coordinate[] ringCoords = new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)  // 首尾相同
};
LinearRing ring = gf.createLinearRing(ringCoords);
```

### 4.2.4 创建 Polygon

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 简单多边形（无孔）
Coordinate[] shellCoords = new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(100, 0),
    new Coordinate(100, 100),
    new Coordinate(0, 100),
    new Coordinate(0, 0)
};
Polygon simplePolygon = gf.createPolygon(shellCoords);

// 带孔多边形
LinearRing shell = gf.createLinearRing(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(100, 0),
    new Coordinate(100, 100),
    new Coordinate(0, 100),
    new Coordinate(0, 0)
});

LinearRing hole = gf.createLinearRing(new Coordinate[] {
    new Coordinate(20, 20),
    new Coordinate(20, 80),
    new Coordinate(80, 80),
    new Coordinate(80, 20),
    new Coordinate(20, 20)
});

Polygon polygonWithHole = gf.createPolygon(shell, new LinearRing[] { hole });

System.out.println("简单多边形面积: " + simplePolygon.getArea());
System.out.println("带孔多边形面积: " + polygonWithHole.getArea());
System.out.println("孔数量: " + polygonWithHole.getNumInteriorRing());
```

### 4.2.5 创建 MultiPoint

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 方式1：从 Point 数组创建
Point[] points = new Point[] {
    gf.createPoint(new Coordinate(0, 0)),
    gf.createPoint(new Coordinate(10, 10)),
    gf.createPoint(new Coordinate(20, 20))
};
MultiPoint multiPoint1 = gf.createMultiPoint(points);

// 方式2：从坐标数组创建
Coordinate[] coords = new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 10),
    new Coordinate(20, 20)
};
MultiPoint multiPoint2 = gf.createMultiPointFromCoords(coords);

System.out.println("MultiPoint: " + multiPoint1);
System.out.println("点数: " + multiPoint1.getNumGeometries());
System.out.println("第一个点: " + multiPoint1.getGeometryN(0));
```

### 4.2.6 创建 MultiLineString

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

LineString line1 = gf.createLineString(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 10)
});

LineString line2 = gf.createLineString(new Coordinate[] {
    new Coordinate(20, 20),
    new Coordinate(30, 30)
});

MultiLineString multiLine = gf.createMultiLineString(
    new LineString[] { line1, line2 }
);

System.out.println("MultiLineString: " + multiLine);
System.out.println("线数: " + multiLine.getNumGeometries());
System.out.println("总长度: " + multiLine.getLength());
```

### 4.2.7 创建 MultiPolygon

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

Polygon poly1 = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Polygon poly2 = gf.createPolygon(new Coordinate[] {
    new Coordinate(20, 20),
    new Coordinate(30, 20),
    new Coordinate(30, 30),
    new Coordinate(20, 30),
    new Coordinate(20, 20)
});

MultiPolygon multiPolygon = gf.createMultiPolygon(
    new Polygon[] { poly1, poly2 }
);

System.out.println("MultiPolygon: " + multiPolygon);
System.out.println("多边形数: " + multiPolygon.getNumGeometries());
System.out.println("总面积: " + multiPolygon.getArea());
```

### 4.2.8 创建 GeometryCollection

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

Geometry[] geometries = new Geometry[] {
    gf.createPoint(new Coordinate(0, 0)),
    gf.createLineString(new Coordinate[] {
        new Coordinate(10, 10),
        new Coordinate(20, 20)
    }),
    gf.createPolygon(new Coordinate[] {
        new Coordinate(30, 30),
        new Coordinate(40, 30),
        new Coordinate(40, 40),
        new Coordinate(30, 40),
        new Coordinate(30, 30)
    })
};

GeometryCollection collection = gf.createGeometryCollection(geometries);

System.out.println("GeometryCollection: " + collection);
System.out.println("几何数: " + collection.getNumGeometries());

// 遍历
for (int i = 0; i < collection.getNumGeometries(); i++) {
    Geometry geom = collection.getGeometryN(i);
    System.out.println("  " + i + ": " + geom.getGeometryType());
}
```

## 4.3 WKT 与 WKB 解析

### 4.3.1 WKT 读写

```java
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.io.WKTWriter;
import org.locationtech.jts.io.ParseException;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// WKT 读取
WKTReader reader = new WKTReader(gf);

try {
    // 解析各种 WKT
    Point point = (Point) reader.read("POINT (116.4074 39.9042)");
    
    LineString line = (LineString) reader.read(
        "LINESTRING (0 0, 10 10, 20 5, 30 15)"
    );
    
    Polygon polygon = (Polygon) reader.read(
        "POLYGON ((0 0, 100 0, 100 100, 0 100, 0 0), " +
        "(20 20, 20 80, 80 80, 80 20, 20 20))"
    );
    
    MultiPoint multiPoint = (MultiPoint) reader.read(
        "MULTIPOINT ((0 0), (10 10), (20 20))"
    );
    
    GeometryCollection collection = (GeometryCollection) reader.read(
        "GEOMETRYCOLLECTION (POINT (0 0), LINESTRING (0 0, 10 10))"
    );
    
    // 打印结果
    System.out.println("Point: " + point);
    System.out.println("Polygon 面积: " + polygon.getArea());
    
} catch (ParseException e) {
    System.err.println("WKT 解析错误: " + e.getMessage());
}

// WKT 写入
WKTWriter writer = new WKTWriter();

Polygon poly = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 默认格式
String wkt = writer.write(poly);
System.out.println("WKT: " + wkt);

// 格式化输出（带缩进）
WKTWriter formattedWriter = new WKTWriter();
formattedWriter.setFormatted(true);
String formattedWkt = formattedWriter.writeFormatted(poly);
System.out.println("Formatted WKT:\n" + formattedWkt);

// 3D WKT
WKTWriter writer3D = new WKTWriter(3);
Point point3D = gf.createPoint(new Coordinate(1, 2, 3));
String wkt3D = writer3D.write(point3D);
System.out.println("3D WKT: " + wkt3D);  // POINT Z (1 2 3)
```

### 4.3.2 WKB 读写

```java
import org.locationtech.jts.io.WKBReader;
import org.locationtech.jts.io.WKBWriter;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 创建测试几何
Polygon polygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// WKB 写入
WKBWriter wkbWriter = new WKBWriter();
byte[] wkb = wkbWriter.write(polygon);
System.out.println("WKB 字节数: " + wkb.length);

// 转换为十六进制字符串
String hexWKB = WKBWriter.toHex(wkb);
System.out.println("Hex WKB: " + hexWKB);

// WKB 读取
WKBReader wkbReader = new WKBReader(gf);
try {
    // 从字节数组读取
    Geometry geom1 = wkbReader.read(wkb);
    System.out.println("从字节数组读取: " + geom1);
    
    // 从十六进制字符串读取
    Geometry geom2 = wkbReader.read(WKBReader.hexToBytes(hexWKB));
    System.out.println("从十六进制读取: " + geom2);
    
} catch (ParseException e) {
    System.err.println("WKB 解析错误: " + e.getMessage());
}

// EWKB（带 SRID）
WKBWriter ewkbWriter = new WKBWriter(2, true);  // 2维，包含 SRID
polygon.setSRID(4326);
byte[] ewkb = ewkbWriter.write(polygon);
System.out.println("EWKB 字节数: " + ewkb.length);
```

### 4.3.3 GeoJSON 读写

```java
import org.geotools.geojson.geom.GeometryJSON;

// 创建 GeoJSON 处理器（15 位小数精度）
GeometryJSON geoJSON = new GeometryJSON(15);

// 创建测试几何
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();
Point point = gf.createPoint(new Coordinate(116.4074, 39.9042));
Polygon polygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 写入 GeoJSON
StringWriter writer = new StringWriter();
geoJSON.write(point, writer);
System.out.println("Point GeoJSON: " + writer);

writer = new StringWriter();
geoJSON.write(polygon, writer);
System.out.println("Polygon GeoJSON: " + writer);

// 读取 GeoJSON
String jsonString = "{\"type\":\"Point\",\"coordinates\":[116.4074,39.9042]}";
Point parsedPoint = geoJSON.readPoint(new StringReader(jsonString));
System.out.println("解析的点: " + parsedPoint);

String polyJson = "{\"type\":\"Polygon\",\"coordinates\":" +
    "[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}";
Polygon parsedPolygon = geoJSON.readPolygon(new StringReader(polyJson));
System.out.println("解析的多边形面积: " + parsedPolygon.getArea());
```

## 4.4 几何属性与度量

### 4.4.1 几何属性

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

Polygon polygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 基本属性
System.out.println("几何类型: " + polygon.getGeometryType());
System.out.println("维度: " + polygon.getDimension());  // 0=点, 1=线, 2=面
System.out.println("坐标维度: " + polygon.getCoordinate().getClass());
System.out.println("点数: " + polygon.getNumPoints());
System.out.println("几何数: " + polygon.getNumGeometries());

// 状态属性
System.out.println("是否为空: " + polygon.isEmpty());
System.out.println("是否简单: " + polygon.isSimple());
System.out.println("是否有效: " + polygon.isValid());
System.out.println("是否矩形: " + polygon.isRectangle());

// 坐标信息
System.out.println("所有坐标: " + Arrays.toString(polygon.getCoordinates()));
System.out.println("坐标序列长度: " + polygon.getCoordinateSequence().size());

// 边界
System.out.println("边界: " + polygon.getBoundary());
System.out.println("包围盒: " + polygon.getEnvelopeInternal());

// SRID
polygon.setSRID(4326);
System.out.println("SRID: " + polygon.getSRID());
```

### 4.4.2 度量计算

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 创建测试几何
Point point1 = gf.createPoint(new Coordinate(0, 0));
Point point2 = gf.createPoint(new Coordinate(3, 4));

LineString line = gf.createLineString(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10)
});

Polygon polygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 距离计算
double distance = point1.distance(point2);
System.out.println("两点距离: " + distance);  // 5.0

double distToLine = point1.distance(line);
System.out.println("点到线距离: " + distToLine);

double distToPoly = point2.distance(polygon);
System.out.println("点到多边形距离: " + distToPoly);

// 长度计算
System.out.println("线长度: " + line.getLength());  // 20.0
System.out.println("多边形周长: " + polygon.getLength());  // 40.0

// 面积计算
System.out.println("多边形面积: " + polygon.getArea());  // 100.0

// 质心和中心点
Point centroid = polygon.getCentroid();
System.out.println("质心: " + centroid);

Point interiorPoint = polygon.getInteriorPoint();
System.out.println("内部点: " + interiorPoint);

// 包围盒
Envelope envelope = polygon.getEnvelopeInternal();
System.out.println("包围盒: " + envelope);
System.out.println("  宽度: " + envelope.getWidth());
System.out.println("  高度: " + envelope.getHeight());
System.out.println("  中心: " + envelope.centre());
```

### 4.4.3 精确面积和长度计算

对于地理坐标（经纬度），需要使用测地线计算：

```java
import org.geotools.referencing.GeodeticCalculator;
import org.geotools.referencing.crs.DefaultGeographicCRS;

// 测地线计算器
GeodeticCalculator calculator = new GeodeticCalculator(DefaultGeographicCRS.WGS84);

// 计算两点间的测地线距离
calculator.setStartingGeographicPoint(116.4074, 39.9042);  // 北京
calculator.setDestinationGeographicPoint(121.4737, 31.2304);  // 上海

double distance = calculator.getOrthodromicDistance();
System.out.println("北京到上海距离: " + distance / 1000 + " 公里");

double azimuth = calculator.getAzimuth();
System.out.println("方位角: " + azimuth + " 度");

// 从起点沿指定方向移动指定距离
calculator.setStartingGeographicPoint(116.4074, 39.9042);
calculator.setDirection(90, 100000);  // 向东 100 公里
Point2D destination = calculator.getDestinationGeographicPoint();
System.out.println("目的地: " + destination);
```

## 4.5 空间操作

### 4.5.1 缓冲区 (Buffer)

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 点缓冲区
Point point = gf.createPoint(new Coordinate(0, 0));
Geometry pointBuffer = point.buffer(5);
System.out.println("点缓冲区: " + pointBuffer.getGeometryType());
System.out.println("缓冲区面积: " + pointBuffer.getArea());

// 线缓冲区
LineString line = gf.createLineString(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10)
});
Geometry lineBuffer = line.buffer(2);
System.out.println("线缓冲区面积: " + lineBuffer.getArea());

// 多边形缓冲区
Polygon polygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 外扩缓冲区
Geometry expandBuffer = polygon.buffer(2);
System.out.println("外扩面积: " + expandBuffer.getArea());

// 内缩缓冲区（负值）
Geometry shrinkBuffer = polygon.buffer(-2);
System.out.println("内缩面积: " + shrinkBuffer.getArea());

// 控制缓冲区质量
// quadrantSegments: 每象限的线段数，值越大越圆滑
Geometry smoothBuffer = point.buffer(5, 32);
System.out.println("光滑缓冲区点数: " + smoothBuffer.getNumPoints());

// 端点样式
// CAP_ROUND: 圆形端点（默认）
// CAP_FLAT: 平头端点
// CAP_SQUARE: 方形端点
import org.locationtech.jts.operation.buffer.BufferParameters;
import org.locationtech.jts.operation.buffer.BufferOp;

BufferParameters params = new BufferParameters();
params.setEndCapStyle(BufferParameters.CAP_FLAT);
params.setJoinStyle(BufferParameters.JOIN_MITRE);
Geometry flatBuffer = BufferOp.bufferOp(line, 2, params);
```

### 4.5.2 合并 (Union)

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 两个相交的多边形
Polygon poly1 = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Polygon poly2 = gf.createPolygon(new Coordinate[] {
    new Coordinate(5, 5),
    new Coordinate(15, 5),
    new Coordinate(15, 15),
    new Coordinate(5, 15),
    new Coordinate(5, 5)
});

// 合并
Geometry union = poly1.union(poly2);
System.out.println("合并结果类型: " + union.getGeometryType());
System.out.println("合并面积: " + union.getArea());

// 批量合并
import org.locationtech.jts.operation.union.UnaryUnionOp;

List<Geometry> geometries = Arrays.asList(poly1, poly2);
Geometry batchUnion = UnaryUnionOp.union(geometries);
System.out.println("批量合并结果: " + batchUnion);

// 级联合并（更高效）
import org.locationtech.jts.operation.union.CascadedPolygonUnion;

Collection<Polygon> polygons = Arrays.asList(poly1, poly2);
Geometry cascadedUnion = CascadedPolygonUnion.union(polygons);
```

### 4.5.3 相交 (Intersection)

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

Polygon poly1 = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Polygon poly2 = gf.createPolygon(new Coordinate[] {
    new Coordinate(5, 5),
    new Coordinate(15, 5),
    new Coordinate(15, 15),
    new Coordinate(5, 15),
    new Coordinate(5, 5)
});

// 相交
Geometry intersection = poly1.intersection(poly2);
System.out.println("相交类型: " + intersection.getGeometryType());
System.out.println("相交面积: " + intersection.getArea());  // 25.0

// 线与多边形相交
LineString line = gf.createLineString(new Coordinate[] {
    new Coordinate(-5, 5),
    new Coordinate(15, 5)
});

Geometry lineIntersection = line.intersection(poly1);
System.out.println("线与多边形相交: " + lineIntersection);
System.out.println("相交长度: " + lineIntersection.getLength());
```

### 4.5.4 差集 (Difference)

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

Polygon poly1 = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Polygon poly2 = gf.createPolygon(new Coordinate[] {
    new Coordinate(5, 5),
    new Coordinate(15, 5),
    new Coordinate(15, 15),
    new Coordinate(5, 15),
    new Coordinate(5, 5)
});

// 差集：poly1 - poly2
Geometry difference = poly1.difference(poly2);
System.out.println("差集类型: " + difference.getGeometryType());
System.out.println("差集面积: " + difference.getArea());  // 75.0

// 对称差集：(poly1 - poly2) + (poly2 - poly1)
Geometry symDifference = poly1.symDifference(poly2);
System.out.println("对称差集面积: " + symDifference.getArea());  // 150.0
```

### 4.5.5 凸包 (ConvexHull)

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 创建点集
MultiPoint points = gf.createMultiPointFromCoords(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(5, 5),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(5, 3)  // 内部点
});

// 计算凸包
Geometry convexHull = points.convexHull();
System.out.println("凸包类型: " + convexHull.getGeometryType());
System.out.println("凸包面积: " + convexHull.getArea());

// 非凸多边形的凸包
Polygon concavePolygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(5, 5),  // 凹点
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Geometry polyConvexHull = concavePolygon.convexHull();
System.out.println("原多边形面积: " + concavePolygon.getArea());
System.out.println("凸包面积: " + polyConvexHull.getArea());
```

### 4.5.6 简化 (Simplify)

```java
import org.locationtech.jts.simplify.DouglasPeuckerSimplifier;
import org.locationtech.jts.simplify.TopologyPreservingSimplifier;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 创建复杂线
Coordinate[] coords = new Coordinate[101];
for (int i = 0; i <= 100; i++) {
    double x = i;
    double y = Math.sin(i * 0.1) * 10 + (Math.random() - 0.5);
    coords[i] = new Coordinate(x, y);
}
LineString complexLine = gf.createLineString(coords);
System.out.println("原始点数: " + complexLine.getNumPoints());

// Douglas-Peucker 简化
Geometry simplifiedDP = DouglasPeuckerSimplifier.simplify(complexLine, 1.0);
System.out.println("DP 简化后点数: " + simplifiedDP.getNumPoints());

// 保持拓扑的简化
Geometry simplifiedTP = TopologyPreservingSimplifier.simplify(complexLine, 1.0);
System.out.println("拓扑保持简化后点数: " + simplifiedTP.getNumPoints());

// 多边形简化
Polygon polygon = (Polygon) complexLine.buffer(5);
System.out.println("原始多边形点数: " + polygon.getNumPoints());

Geometry simplifiedPoly = DouglasPeuckerSimplifier.simplify(polygon, 1.0);
System.out.println("简化后多边形点数: " + simplifiedPoly.getNumPoints());
```

## 4.6 空间关系判断

### 4.6.1 基本关系

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 创建测试几何
Polygon outer = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(20, 0),
    new Coordinate(20, 20),
    new Coordinate(0, 20),
    new Coordinate(0, 0)
});

Point inside = gf.createPoint(new Coordinate(10, 10));
Point outside = gf.createPoint(new Coordinate(30, 30));
Point onBoundary = gf.createPoint(new Coordinate(10, 0));

Polygon overlapping = gf.createPolygon(new Coordinate[] {
    new Coordinate(15, 15),
    new Coordinate(25, 15),
    new Coordinate(25, 25),
    new Coordinate(15, 25),
    new Coordinate(15, 15)
});

// 空间关系判断
System.out.println("=== 空间关系判断 ===");

// contains - 完全包含
System.out.println("outer.contains(inside): " + outer.contains(inside));  // true
System.out.println("outer.contains(outside): " + outer.contains(outside));  // false

// within - 在内部
System.out.println("inside.within(outer): " + inside.within(outer));  // true

// intersects - 相交（有公共部分）
System.out.println("outer.intersects(overlapping): " + outer.intersects(overlapping));  // true
System.out.println("outer.intersects(outside): " + outer.intersects(outside));  // false

// disjoint - 分离（无公共部分）
System.out.println("outer.disjoint(outside): " + outer.disjoint(outside));  // true

// touches - 边界相接
System.out.println("outer.touches(onBoundary): " + outer.touches(onBoundary));  // true

// overlaps - 重叠（部分重合，维度相同）
System.out.println("outer.overlaps(overlapping): " + outer.overlaps(overlapping));  // true

// equals - 几何相等
Polygon duplicate = gf.createPolygon(outer.getCoordinates());
System.out.println("outer.equals(duplicate): " + outer.equals(duplicate));  // true

// equalsExact - 严格相等（考虑坐标顺序）
System.out.println("outer.equalsExact(duplicate): " + outer.equalsExact(duplicate));  // true

// covers/coveredBy - 覆盖关系
System.out.println("outer.covers(inside): " + outer.covers(inside));  // true
System.out.println("inside.coveredBy(outer): " + inside.coveredBy(outer));  // true
```

### 4.6.2 DE-9IM 关系矩阵

```java
import org.locationtech.jts.geom.IntersectionMatrix;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

Polygon poly1 = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Polygon poly2 = gf.createPolygon(new Coordinate[] {
    new Coordinate(5, 5),
    new Coordinate(15, 5),
    new Coordinate(15, 15),
    new Coordinate(5, 15),
    new Coordinate(5, 5)
});

// 获取 DE-9IM 矩阵
IntersectionMatrix matrix = poly1.relate(poly2);
System.out.println("DE-9IM 矩阵: " + matrix);

// 解释矩阵
System.out.println("内部-内部: " + matrix.get(0, 0));  // 2 (面)
System.out.println("内部-边界: " + matrix.get(0, 1));  // 1 (线)
System.out.println("内部-外部: " + matrix.get(0, 2));  // 2 (面)

// 使用模式匹配
System.out.println("是否相交: " + matrix.isIntersects());
System.out.println("是否重叠: " + matrix.isOverlaps(2, 2));
System.out.println("是否包含: " + matrix.isContains());

// 自定义关系判断
boolean customRelate = poly1.relate(poly2, "T*T***T**");
System.out.println("自定义关系: " + customRelate);
```

### 4.6.3 距离关系

```java
GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

Point point = gf.createPoint(new Coordinate(0, 0));
Polygon polygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(10, 0),
    new Coordinate(20, 0),
    new Coordinate(20, 10),
    new Coordinate(10, 10),
    new Coordinate(10, 0)
});

// 计算距离
double distance = point.distance(polygon);
System.out.println("点到多边形距离: " + distance);  // 10.0

// 判断是否在指定距离内
boolean isWithin = point.isWithinDistance(polygon, 15);
System.out.println("是否在 15 单位距离内: " + isWithin);  // true

// 获取最近点
import org.locationtech.jts.operation.distance.DistanceOp;

DistanceOp distOp = new DistanceOp(point, polygon);
Coordinate[] nearestPoints = distOp.nearestPoints();
System.out.println("点上最近点: " + nearestPoints[0]);
System.out.println("多边形上最近点: " + nearestPoints[1]);
```

## 4.7 空间索引

### 4.7.1 STRtree 索引

```java
import org.locationtech.jts.index.strtree.STRtree;
import org.locationtech.jts.geom.Envelope;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 创建 STRtree 索引
STRtree index = new STRtree();

// 添加数据（模拟大量要素）
for (int i = 0; i < 1000; i++) {
    double x = Math.random() * 100;
    double y = Math.random() * 100;
    Point point = gf.createPoint(new Coordinate(x, y));
    
    // 以包围盒为键存储
    index.insert(point.getEnvelopeInternal(), point);
}

// 构建索引（必须在查询前调用）
index.build();

// 范围查询
Envelope queryEnvelope = new Envelope(40, 60, 40, 60);
List<?> results = index.query(queryEnvelope);
System.out.println("范围查询结果数: " + results.size());

// 最近邻查询
import org.locationtech.jts.index.strtree.ItemDistance;

Point queryPoint = gf.createPoint(new Coordinate(50, 50));
Object nearest = index.nearestNeighbour(
    queryPoint.getEnvelopeInternal(),
    queryPoint,
    new GeometryItemDistance()
);
System.out.println("最近点: " + nearest);

// 自定义距离计算
class GeometryItemDistance implements ItemDistance {
    @Override
    public double distance(ItemBoundable item1, ItemBoundable item2) {
        Geometry g1 = (Geometry) item1.getItem();
        Geometry g2 = (Geometry) item2.getItem();
        return g1.distance(g2);
    }
}
```

### 4.7.2 Quadtree 索引

```java
import org.locationtech.jts.index.quadtree.Quadtree;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 创建四叉树索引
Quadtree quadtree = new Quadtree();

// 添加数据
for (int i = 0; i < 1000; i++) {
    double x = Math.random() * 100;
    double y = Math.random() * 100;
    Point point = gf.createPoint(new Coordinate(x, y));
    quadtree.insert(point.getEnvelopeInternal(), point);
}

// 范围查询
Envelope queryEnvelope = new Envelope(40, 60, 40, 60);
List<?> results = quadtree.query(queryEnvelope);
System.out.println("四叉树查询结果数: " + results.size());

// 删除数据
Point toRemove = (Point) results.get(0);
boolean removed = quadtree.remove(toRemove.getEnvelopeInternal(), toRemove);
System.out.println("删除成功: " + removed);

// 查询所有数据
List<?> all = quadtree.queryAll();
System.out.println("索引中总数: " + all.size());
```

## 4.8 几何验证与修复

### 4.8.1 几何验证

```java
import org.locationtech.jts.operation.valid.IsValidOp;
import org.locationtech.jts.operation.valid.TopologyValidationError;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 有效多边形
Polygon validPolygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 无效多边形（自相交）
Polygon invalidPolygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 10),
    new Coordinate(10, 0),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 简单验证
System.out.println("有效多边形 isValid: " + validPolygon.isValid());
System.out.println("无效多边形 isValid: " + invalidPolygon.isValid());

// 详细验证
IsValidOp validOp = new IsValidOp(invalidPolygon);
boolean isValid = validOp.isValid();
if (!isValid) {
    TopologyValidationError error = validOp.getValidationError();
    System.out.println("错误类型: " + error.getErrorType());
    System.out.println("错误消息: " + error.getMessage());
    System.out.println("错误位置: " + error.getCoordinate());
}
```

### 4.8.2 几何修复

```java
import org.locationtech.jts.geom.util.GeometryFixer;

GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

// 无效多边形
Polygon invalidPolygon = gf.createPolygon(new Coordinate[] {
    new Coordinate(0, 0),
    new Coordinate(10, 10),
    new Coordinate(10, 0),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

System.out.println("修复前 isValid: " + invalidPolygon.isValid());

// 修复几何
Geometry fixed = GeometryFixer.fix(invalidPolygon);
System.out.println("修复后 isValid: " + fixed.isValid());
System.out.println("修复后类型: " + fixed.getGeometryType());

// 使用 buffer(0) 修复（传统方法）
Geometry bufferFixed = invalidPolygon.buffer(0);
System.out.println("buffer(0) 修复后 isValid: " + bufferFixed.isValid());
```

## 4.9 本章小结

本章详细介绍了 JTS 几何对象的使用：

1. **几何类型**
   - Point、LineString、Polygon
   - MultiPoint、MultiLineString、MultiPolygon
   - GeometryCollection

2. **几何创建**
   - GeometryFactory 使用
   - WKT/WKB/GeoJSON 解析

3. **几何属性与度量**
   - 基本属性获取
   - 面积、长度、距离计算

4. **空间操作**
   - 缓冲区、合并、相交、差集
   - 凸包、简化

5. **空间关系**
   - contains、within、intersects 等
   - DE-9IM 关系矩阵

6. **空间索引**
   - STRtree、Quadtree

7. **几何验证与修复**
   - IsValidOp
   - GeometryFixer

### 关键要点

- 使用 GeometryFactory 创建几何对象
- 注意几何的有效性验证
- 合理使用空间索引提高性能
- 掌握常用空间操作和关系判断

---

[← 上一章：核心架构与模块设计](https://znlgis.github.io/gis/tutorial/geotools/第03章-核心架构与模块设计/) | [返回目录](https://znlgis.github.io/gis/tutorial/geotools/) | [下一章：要素模型与数据结构 →](https://znlgis.github.io/gis/tutorial/geotools/第05章-要素模型与数据结构/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/geotools/第03章-核心架构与模块设计/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geotools/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geotools/第05章-要素模型与数据结构/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

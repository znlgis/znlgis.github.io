---
layout: default
title: 第23章 - JTS 与上下游技术栈集成
---

# 第23章 - JTS 与上下游技术栈集成

单独使用 JTS 的场景其实不多。绝大多数时候，JTS 是技术栈中间的一层：上面是 GeoTools、GeoServer、Spring Boot 这类框架，下面是 PostGIS、Elasticsearch、Sedona 这类存储与计算引擎，两边都自称“支持 JTS 几何”，但支持的方式、版本、语义各不相同。写出事故的往往不是 JTS 本身，而是**跨栈边界上的语义差异**——同一个 `ST_Buffer` 在 PostGIS 里按米算，在 JTS 里按坐标单位算；同一个 `isValid` 在 GEOS 与 JTS 上对某些自相交图形给出不同结论；同一个 GeoJSON 在 Elasticsearch 里是 `geo_shape`，在 Shapely 里是 `Geometry`，在 Hibernate 里要经过 `GeometryType` 映射。

本章的目标是把这张“JTS 生态地图”画清楚：谁依赖 JTS、谁不依赖、各自暴露什么 API、跨栈迁移时哪些地方会咬人。我们不追求把每个框架讲全（那需要另一套教程），而是聚焦**与 JTS 的接口层**：数据怎么进来、怎么出去、语义怎么对齐。

读完后你应该能：在 GeoTools 里正确拿到 `GeometryFactory` 并做 CRS 转换；把 JTS 调用翻译成 PostGIS 的 `ST_*`；判断某个栈到底用不用 JTS；在 Spring Boot 项目里把 JTS 依赖与线程安全安排好；以及看懂版本兼容矩阵，避免“本地 1.20、服务器 1.18”这种事故。

前置知识：第 6 章（WKT 与 WKB）、第 7 章（GeoJSON 与 TWKB）、第 19 章（坐标系、单位与工程陷阱）。

---

## 23.1 JTS 在技术栈中的位置

### 23.1.1 一张分层图

```
┌──────────────────────────────────────────────────────────────────┐
│ 应用层     Spring Boot / 自研服务 / 批处理作业                     │
├──────────────────────────────────────────────────────────────────┤
│ 框架层     GeoTools   GeoServer   Hibernate Spatial   Sedona      │
│            （这些框架内部依赖 JTS，并向上暴露自己的 API）           │
├──────────────────────────────────────────────────────────────────┤
│ 几何引擎层  JTS (Java)     GEOS (C++)     NTS (.NET)   JSTS (JS)   │
│            ↑ 同源算法思想，各自独立实现（GEOS 是 JTS 的 C++ 移植）  │
├──────────────────────────────────────────────────────────────────┤
│ 存储/检索   PostGIS(GEOS)  Elasticsearch(Lucene)  Oracle Spatial   │
│            MongoDB(GeoJSON)  Sedona(Spark + JTS)                   │
└──────────────────────────────────────────────────────────────────┘
```

这张图里最重要的一条结论：**JTS 只活在 JVM 上**。凡是 JVM 之外的地方（PostGIS 的 C 函数、NTS 的 C# 类、JSTS 的 JS 对象、Shapely 的 Python 包装），它们要么是 JTS 算法的移植（GEOS、NTS、JSTS），要么是完全独立的实现（Lucene 的 spatial 模块）。它们之间**共享算法思想与 WKT/WKB 格式，但不共享二进制、不共享运行时**。

### 23.1.2 三个必须记住的边界事实

| 事实 | 影响 | 应对 |
| --- | --- | --- |
| JTS 不含 CRS | 所有距离、面积、缓冲的单位都是“坐标单位” | 投影前置，或改用 GeoTools/Proj4J 做转换 |
| PostGIS 用 GEOS，不用 JTS | 同名函数在边界情况可能结果不同 | 用 WKB 交换 + 关键用例双端验证 |
| 各栈的“有效性”定义有细微差异 | 一个栈认为合法的几何，另一个可能拒绝 | 入库前用目标栈的校验函数复核 |

### 23.1.3 数据交换的三种载体

跨栈传几何，实际只有三种可靠载体：

```
JTS Geometry ──WKB(hex)──> PostGIS bytea / Elasticsearch binary / 文件
             ──WKT──────> SQL 字面量 / 日志 / 测试用例
             ──GeoJSON──> 前端 / ES geo_shape / MongoDB
```

| 载体 | 精度 | 体积 | 跨栈友好度 | 适用场景 |
| --- | --- | --- | --- | --- |
| WKB | 双精度无损 | 最小 | 最好（所有栈都支持） | 服务间传输、入库 |
| WKT | 双精度但文本有舍入风险 | 大 | 好（人可读） | 调试、SQL 字面量、测试 |
| GeoJSON | 双精度，但默认 6 位小数 | 中 | 好（Web 生态） | 前后端交互、地图展示 |

**关键细节**：JTS 的 `GeoJsonWriter` 默认输出保留了完整双精度，但很多前端库与 ES 会按 6 位小数处理。做高精度业务（地籍、管线）时，Web 层用 GeoJSON 展示、内部用 WKB 传输，是最稳的组合。

---

## 23.2 GeoTools 集成

### 23.2.1 GeoTools 与 JTS 的关系

GeoTools 是 JTS 最重要的下游：它把 JTS 当作**唯一的几何引擎**，所有 `SimpleFeature` 的几何属性都是 `org.locationtech.jts.geom.Geometry`。两者版本强绑定——GeoTools 的每个版本都锁定一个 JTS 版本，混用会出现 `NoSuchMethodError`。

| 关注点 | 怎么确认 | 说明 |
| --- | --- | --- |
| 锁定的 JTS 版本 | `mvn dependency:tree -Dincludes=org.locationtech.jts` | GeoTools 每个版本只对应一个 JTS 版本 |
| 接口包的前缀 | 看 import 是 `org.geotools.*` 还是 `org.geotools.api.*` | 较新的 GeoTools 把接口拆到了 `org.geotools.api.*` |
| 是否允许覆盖 JTS | 看 GeoTools BOM 的 `dependencyManagement` | 手动升级 JTS 极易导致 `NoSuchMethodError` |

> **唯一权威来源是 GeoTools 自己的 BOM 与发布说明**。不要凭记忆锁版本，也不要在使用 GeoTools 的项目里单独升级 `jts-core`——两者的二进制契约比版本号看起来的更紧。

### 23.2.2 拿到正确的 GeometryFactory

在 GeoTools 环境里**不要自己 `new GeometryFactory()`**，因为 GeoTools 会配置精度模型与坐标序列工厂。正确做法是用 `JTSFactoryFinder`：

```java
import org.geotools.geometry.jts.JTSFactoryFinder;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class GeoToolsGeometryFactoryDemo {

  public static void main(String[] args) throws Exception {
    // 由 GeoTools 提供、按当前运行环境配置好的工厂
    GeometryFactory gf = JTSFactoryFinder.getGeometryFactory();

    WKTReader reader = new WKTReader(gf);
    Geometry geom = reader.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");

    System.out.println("SRID = " + geom.getSRID());
    System.out.println("area = " + geom.getArea());
    System.out.println("isValid = " + geom.isValid());
  }
}
```

`JTSFactoryFinder.getGeometryFactory()` 不带参数时返回默认工厂；也可以传入 `Hints`（如 `Hints.CRS`、`Hints.JTS_PRECISION_MODEL`）来定制。注意它返回的工厂通常**不带 SRID**——SRID 要显式设到几何上（`geom.setSRID(4326)`），或者由 FeatureType 的 CRS 提供。

### 23.2.3 CRS 转换：JTS.transform

JTS 本身不做投影变换，这一步必须交给 GeoTools：

```java
import org.geotools.geometry.jts.JTS;
import org.geotools.referencing.CRS;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.opengis.referencing.crs.CoordinateReferenceSystem;
import org.opengis.referencing.operation.MathTransform;

public class CrsTransformDemo {

  public static void main(String[] args) throws Exception {
    GeometryFactory gf = new GeometryFactory();
    WKTReader reader = new WKTReader(gf);

    Geometry wgs84 = reader.read("POINT (116.397 39.909)");
    wgs84.setSRID(4326);

    CoordinateReferenceSystem src = CRS.decode("EPSG:4326", true);
    CoordinateReferenceSystem dst = CRS.decode("EPSG:3857", true);
    MathTransform transform = CRS.findMathTransform(src, dst, true);

    // 几何整体变换
    Geometry webMercator = JTS.transform(wgs84, transform);
    System.out.println(webMercator);

    // 单点变换（更轻量，但要注意 null 参数的位置）
    Coordinate srcCoord = new Coordinate(116.397, 39.909);
    Coordinate dstCoord = JTS.transform(srcCoord, null, transform);
    System.out.println(dstCoord);

    // 反向变换
    MathTransform inverse = transform.inverse();
    Geometry back = JTS.transform(webMercator, inverse);
    System.out.println(back);
  }
}
```

输出（按 EPSG:3857 球面墨卡托公式 `x = lon × R × π/180`、`y = R × ln(tan(π/4 + lat × π/360))` 计算，R = 6378137）：

```text
POINT (12957254.770 4852727.206)
(12957254.770..., 4852727.206...)
POINT (116.397 39.909)
```

反向变换回到 WGS84 后与原始坐标的差异在 1e-9 量级，这是双精度浮点的正常往返误差。

三个注意点：

1. **`CRS.decode("EPSG:4326", true)` 的第二个参数是 `longitudeFirst`**。传 `true` 表示“经度在前”，符合 GIS 惯例；传 `false` 会得到纬度在前，然后所有坐标都错位。这个参数是 GeoTools 里最高频的事故源之一。
2. **`JTS.transform(Geometry, MathTransform)` 返回新几何**，不修改输入。但内部的坐标数组可能是共享的，别在变换后复用原几何做写入。
3. **变换后的几何可能不再“有效”**：反投影、跨带变换都可能产生自相交。关键业务在变换后补一次 `GeometryFixer.fix` 或 `IsValidOp` 校验。

### 23.2.4 Feature 与几何属性

GeoTools 的 `SimpleFeature` 把几何作为普通属性存储，构建要素类型时要显式声明几何字段的 CRS：

```java
import org.geotools.api.feature.simple.SimpleFeature;
import org.geotools.api.feature.simple.SimpleFeatureType;
import org.geotools.feature.simple.SimpleFeatureBuilder;
import org.geotools.feature.simple.SimpleFeatureTypeBuilder;
import org.geotools.referencing.CRS;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;

public class FeatureDemo {

  public static void main(String[] args) throws Exception {
    GeometryFactory gf = new GeometryFactory();
    WKTReader reader = new WKTReader(gf);

    SimpleFeatureTypeBuilder tb = new SimpleFeatureTypeBuilder();
    tb.setName("parcel");
    tb.setCRS(CRS.decode("EPSG:4326", true));
    tb.add("geom", Geometry.class);          // 默认几何字段名
    tb.add("code", String.class);
    tb.add("area", Double.class);
    SimpleFeatureType type = tb.buildFeatureType();

    Geometry polygon = reader.read("POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))");
    polygon.setSRID(4326);

    SimpleFeature feature = SimpleFeatureBuilder.build(type, new Object[] {
        polygon, "A-001", polygon.getArea()
    }, "parcel.1");

    System.out.println(feature.getID());
    System.out.println(feature.getDefaultGeometry());
    System.out.println(feature.getAttribute("code"));
  }
}
```

`SimpleFeatureTypeBuilder` 的 `setCRS` 只影响元数据，**不会自动给几何设 SRID**。如果你的下游依赖 `geom.getSRID()` 判断坐标系，要自己设。

### 23.2.5 GeoTools 读文件的几何走向

```
Shapefile ──DataStore.getFeatureSource()──> SimpleFeatureCollection
     │                                            │
     │  (GeoTools 内部用 JTS 几何)                  │ 遍历 features
     ▼                                            ▼
  Geometry（读时可能是原始精度，也可能被 curve 化）  feature.getDefaultGeometry() → JTS Geometry
     │
     ├─ 需要投影：JTS.transform(geom, MathTransform)
     └─ 需要序列化：WKBWriter（二进制）/ GeoJsonWriter（Web）
```

要点：Shapefile 读取默认**不做投影变换**，返回的几何坐标还是原始坐标系；CRS 记录在 FeatureType 里。要统一坐标，读出来后自己 transform。

---

## 23.3 GeoServer 中的 JTS

### 23.3.1 GeoServer 的几何处理链

GeoServer 构建在 GeoTools 之上，因此它处理几何时用的就是 JTS。请求链路大致是：

```
WMS/WFS 请求 ──> GeoServer 渲染/输出引擎 ──> GeoTools DataStore ──> 数据源
                        │
                        ├─ 过滤器（Filter）：CQL 的 INTERSECTS/CONTAINS 最终编译为 JTS 谓词
                        ├─ 重投影：JTS.transform
                        └─ 输出：GeoJSON/GML/KML（几何由 JTS 写出）
```

这意味着你在 GeoServer 里看到的“几何问题”，本质上是 JTS 行为：

- **WFS 输出的 GeoJSON 坐标精度**由 GeoServer 的 `GEOSERVER_JSON` 输出格式参数控制，不是 JTS 的 `GeoJsonWriter` 默认行为。
- **SLD 里的 buffer 单位**是坐标单位，不是米。要按米缓冲，必须先投影到米制 CRS 再写 SLD。
- **WMS 渲染的几何简化**用的是 GeoTools 的简化器（内部仍是 JTS 的 `DouglasPeuckerSimplifier`）。

### 23.3.2 常见配置层陷阱

| 现象 | 根因 | 处置 |
| --- | --- | --- |
| WMS 出图边缘断裂 | 数据跨带、CRS 定义不一致 | 统一数据与图层 CRS，避免运行时跨带拼接 |
| WFS 返回几何被“截断” | 输出格式的 `maxFeatures` 或坐标精度限制 | 检查输出格式参数 |
| CQL `INTERSECTS` 报 `TopologyException` | 数据里有非法几何 | 入库前 `ST_MakeValid` 或 JTS `GeometryFixer` |
| 缓冲区 SLD 尺寸忽大忽小 | 单位随 CRS 变 | 固定米制 CRS 或用 `uom` 明确指定 |

GeoServer 本身不提供“几何修复”开关，**非法几何要在入库或 ETL 阶段解决**。这一点和 PostGIS 不同，PostGIS 至少有 `ST_MakeValid` 可以在查询时兜底。

---


## 23.4 PostGIS / GEOS：ST_* 与 JTS 方法对照

### 23.4.1 为什么不能简单按名字对应

PostGIS 的空间能力由 GEOS 提供，而 GEOS 是 JTS 的 C++ 移植——**算法思想同源，实现独立**。这带来两个后果：

1. **语义基本一致**：相交、缓冲、有效性的判定逻辑是同一套算法演化来的，绝大多数结果相同。
2. **边界情况可能不同**：数值鲁棒性处理、精度模型默认值、异常类型都与 JTS 有差异。尤其是 GEOS 版本与 JTS 版本不同步时。

所以对照表的作用是“**知道该调哪个函数**”，不是“保证结果逐位相同”。关键业务要双端验证。

### 23.4.2 核心方法对照表

| JTS（Java） | PostGIS SQL | 语义说明 | 注意 |
| --- | --- | --- | --- |
| `geom.intersection(other)` | `ST_Intersection(a, b)` | 交集 | 两边都可能有拓扑异常 |
| `geom.union(other)` | `ST_Union(a, b)` | 并集 | 双参数版是二元并 |
| `geom.union()` | `ST_Union(geom)` | 一元并（聚合） | PG 里是聚合函数 |
| `geom.difference(other)` | `ST_Difference(a, b)` | 差集 | 注意参数顺序 |
| `geom.symDifference(other)` | `ST_SymDifference(a, b)` | 对称差 | — |
| `geom.buffer(d)` | `ST_Buffer(geom, d)` | 缓冲 | 单位=坐标单位，不是米 |
| `geom.buffer(d, qs)` | `ST_Buffer(geom, d, 'quad_segs=n')` | 带象限段数 | 参数写法不同 |
| `OffsetCurve.getCurve(g, d)` | `ST_OffsetCurve(geom, d)` | 偏移曲线 | 单侧线，不是面 |
| `geom.convexHull()` | `ST_ConvexHull(geom)` | 凸包 | — |
| `geom.getCentroid()` | `ST_Centroid(geom)` | 质心 | 对多点集合是加权平均 |
| `geom.getInteriorPoint()` | `ST_PointOnSurface(geom)` | 面内点 | 保证落在面内 |
| `geom.getEnvelope()` | `ST_Envelope(geom)` | 包络矩形 | — |
| `geom.getBoundary()` | `ST_Boundary(geom)` | 边界 | — |
| `geom.isValid()` | `ST_IsValid(geom)` | 有效性 | 判定细节可能有差异 |
| `IsValidOp.getValidationError()` | `ST_IsValidReason(geom)` | 无效原因 | 返回文本 |
| `GeometryFixer.fix(geom)` | `ST_MakeValid(geom)` | 修复 | 都尽量保面积，但策略不同 |
| `geom.getArea()` | `ST_Area(geom)` | 面积 | 经纬度下是平方度 |
| `geom.getLength()` | `ST_Length(geom)` | 长度 | 同上 |
| `geom.distance(other)` | `ST_Distance(a, b)` | 距离 | 同上 |
| `geom.intersects(other)` | `ST_Intersects(a, b)` | 相交 | PG 会自动用索引 |
| `geom.contains(other)` | `ST_Contains(a, b)` | 包含 | — |
| `geom.within(other)` | `ST_Within(a, b)` | 被包含 | 与 Contains 互为反向 |
| `geom.covers(other)` | `ST_Covers(a, b)` | 覆盖 | 边界也计入 |
| `geom.touches(other)` | `ST_Touches(a, b)` | 相接 | 只共享边界 |
| `geom.relate(other, "T*F**F***")` | `ST_Relate(a, b, 'T*F**F***')` | DE-9IM 匹配 | 两边语法一致 |
| `geom.relate(other)` | `ST_Relate(a, b)` | 返回 DE-9IM 矩阵 | — |
| `DouglasPeuckerSimplifier.simplify(g, t)` | `ST_Simplify(geom, t)` | DP 简化 | 可能产生无效几何 |
| `TopologyPreservingSimplifier.simplify(g, t)` | `ST_SimplifyPreserveTopology(geom, t)` | TP 简化 | 保拓扑 |
| `VWSimplifier.simplify(g, t)` | `ST_SimplifyVW(geom, t)` | VW 简化 | 保形状 |
| `Densifier.densify(g, t)` | `ST_Segmentize(geom, t)` | 加密 | 语义一致 |
| `LineMerger` | `ST_LineMerge(geom)` | 线合并 | PG 返回 MultiLineString |
| `Polygonizer` | `ST_Polygonize(geom)` | 线构面 | — |
| `geom.norm()` | `ST_Normalize(geom)` | 归一化 | 环起点/顺序统一 |
| `geom.reverse()` | `ST_Reverse(geom)` | 反序 | — |
| `geom.getNumPoints()` | `ST_NPoints(geom)` | 顶点数 | — |
| `geom.getNumGeometries()` | `ST_NumGeometries(geom)` | 元素个数 | — |
| `geom.getGeometryN(i)` | `ST_GeometryN(geom, i)` | 取第 i 个 | PG 下标从 1 开始 |
| `WKBWriter.write(geom)` | `ST_AsBinary(geom)` | 转 WKB | — |
| `WKTWriter.write(geom)` | `ST_AsText(geom)` | 转 WKT | — |
| `GeoJsonWriter.write(geom)` | `ST_AsGeoJSON(geom)` | 转 GeoJSON | 精度参数不同 |
| `WKTReader.read(s)` | `ST_GeomFromText(s, srid)` | 文本转几何 | PG 要显式 SRID |
| `WKBReader.read(bytes)` | `ST_GeomFromWKB(bytes, srid)` | 二进制转几何 | 同上 |

### 23.4.3 单位陷阱：最贵的一课

同一句“缓冲 100 米”，两边的写法与正确性完全不同：

```sql
-- PostGIS：如果 geom 是 EPSG:4326，这 100 的单位是“度”，结果是错的
SELECT ST_Buffer(geom, 100) FROM parcels;

-- 正确写法一：先投影到米制 CRS 再缓冲
SELECT ST_Transform(
         ST_Buffer(ST_Transform(geom, 3857), 100), 4326)
FROM parcels;

-- 正确写法二：用 geography 类型（按米计算）
SELECT ST_Buffer(geom::geography, 100) FROM parcels;
```

JTS 侧对应的正确写法：

```java
// 错误：geom 的坐标是经纬度，100 没有意义
Geometry wrong = geom.buffer(100);

// 正确：先投影（借 GeoTools），缓冲后再投影回去
Geometry projected = JTS.transform(geom, toMercator);
Geometry buffered = projected.buffer(100);
Geometry result = JTS.transform(buffered, toWgs84);
```

**记住一句话：JTS 和 PostGIS 的 `buffer` 都只认坐标单位。** 唯一例外是 PostGIS 的 `geography` 类型，它会在内部按球面计算——但那是 PostGIS 的扩展，不是 GEOS/JTS 的能力。

### 23.4.4 从 JTS 生成 PostGIS 可用的 SQL

批量入库时，用 WKB 十六进制是最稳的方式：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKBWriter;

public class PostgisInsertHelper {

  /**
   * 生成可直接拼进 SQL 的 ST_GeomFromWKB 表达式。
   * 注意：生产环境务必用 PreparedStatement + setBytes，不要字符串拼接。
   */
  public static String toInsertLiteral(Geometry geom, int srid) {
    WKBWriter writer = new WKBWriter(2, true);   // 2 维，包含 SRID
    byte[] wkb = writer.write(geom);
    return "ST_GeomFromWKB('\\x" + WKBWriter.toHex(wkb) + "'::bytea, " + srid + ")";
  }
}
```

更推荐的做法是走 JDBC 参数：

```java
String sql = "INSERT INTO parcels(geom) VALUES (ST_GeomFromWKB(?, 4326))";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
  ps.setBytes(1, new WKBWriter(2, true).write(geom));
  ps.executeUpdate();
}
```

用 `includeSRID=true` 时，WKB 头部会内嵌 SRID，PG 端的 `ST_SRID` 就能直接读到，不必再传第二个参数。

---

## 23.5 NetTopologySuite（.NET）

### 23.5.1 关系与命名映射

NetTopologySuite（NTS）是 JTS 的 .NET 移植，API 结构高度相似但命名遵循 C# 规范：

| JTS（Java） | NTS（C#） | 差异 |
| --- | --- | --- |
| `org.locationtech.jts.geom.Geometry` | `NetTopologySuite.Geometries.Geometry` | 命名空间不同 |
| `GeometryFactory` | `GeometryFactory`（`NTS.Geometries`） | 构造方式略有差异 |
| `WKTReader` / `WKTWriter` | `WKTReader` / `WKTWriter`（`NTS.IO`） | 用法几乎一致 |
| `geom.intersection(other)` | `geom.Intersection(other)` | 方法首字母大写 |
| `geom.isValid()` | `geom.IsValid` | 属性而非方法 |
| `geom.getArea()` | `geom.Area` | 属性 |
| `STRtree` | `STRtree` | 一致 |
| `GeometryFixer` | `GeometryFixer`（1.x 后期引入） | 版本相关 |
| `CoverageValidator` | `NetTopologySuite.Coverage.CoverageValidator` | 有对应实现 |

### 23.5.2 跨语言数据交换

JVM 与 .NET 之间传几何，**唯一推荐 WKB**：

```java
// Java 端：写 WKB
WKBWriter writer = new WKBWriter(2, true);
byte[] bytes = writer.write(geom);
String hex = WKBWriter.toHex(bytes);
```

```csharp
// C# 端：读 WKB
var reader = new NetTopologySuite.IO.WKBReader();
var geom = reader.Read(NetTopologySuite.IO.WKBReader.HexToBytes(hex));
Console.WriteLine(geom.Area);
```

不要用 WKT 跨语言传输：双方对 `NaN`、极高精度小数、`EMPTY` 的文本表示可能不同，解析失败率明显高于 WKB。

---

## 23.6 JSTS（JavaScript）与前端

### 23.6.1 JSTS 的定位

JSTS 是 JTS 的 JavaScript 移植，主要用在浏览器与 Node.js 里做几何运算。它的 API 刻意模仿 JTS：

```javascript
// 浏览器/Node 中：使用 JSTS 的 GeoJSONReader/Writer
const jsts = require('jsts');
const reader = new jsts.io.GeoJSONReader();
const writer = new jsts.io.GeoJSONWriter();

const geom = reader.read({ type: 'Polygon', coordinates: [[[0,0],[10,0],[10,10],[0,10],[0,0]]] });
const buffered = geom.buffer(1);
console.log(writer.write(buffered));
```

对应 JTS 的 `GeoJsonReader`/`GeoJsonWriter` 与 `geom.buffer(1)`。语义基本一致，但**实现经过 JS 化**，浮点行为与 JTS 有细微差异。

### 23.6.2 前后端分工建议

| 任务 | 放在前端（JSTS） | 放在后端（JTS） |
| --- | --- | --- |
| 即时预览（拖拽后立刻看效果） | ✅ | ❌ 延迟高 |
| 小于 1 万顶点的简单运算 | ✅ | 可选 |
| 批量叠加、海量数据 | ❌ 内存爆 | ✅ |
| 结果需要入库/审计 | ❌ | ✅ |
| 精度敏感（地籍、管线） | ❌ | ✅ |

一句话：**JSTS 用于交互，JTS 用于权威计算**。同一份几何在前端算完只用于展示，最终结果以后端为准。

---

## 23.7 Shapely 与 GEOS（Python）

### 23.7.1 依赖关系

Shapely 是 Python 的几何库，底层用 GEOS。所以链路是：

```
Python 业务代码 ──> Shapely ──> GEOS(C++) ──> 与 JTS 同源的算法
```

Shapely 2.x 起把 GEOS 的实现暴露得更彻底，性能大幅提升，但仍然**不是 JTS**。

### 23.7.2 JTS 与 Shapely 对照

| JTS | Shapely | 说明 |
| --- | --- | --- |
| `WKTReader.read(s)` | `shapely.wkt.loads(s)` | — |
| `WKTWriter.write(g)` | `shapely.wkt.dumps(g)` | — |
| `geom.intersection(o)` | `a.intersection(b)` | — |
| `geom.union(o)` | `a.union(b)` | — |
| `geom.buffer(d)` | `g.buffer(d)` | 单位同样问题 |
| `geom.isValid()` | `g.is_valid` | 属性 |
| `geom.is_empty()` | `g.is_empty` | 属性 |
| `GeometryFixer.fix(g)` | `shapely.make_valid(g)` | Shapely 2.0+ |
| `geom.getArea()` | `g.area` | 属性 |
| `STRtree` | `shapely.STRtree` | Shapely 2.0+ 直接提供 |
| `PreparedGeometry` | `shapely.prepare(g)` | 2.0+ |
| `relate(a,b)` | `a.relate(b)` | 返回 DE-9IM 字符串 |

跨语言交换仍用 WKB 最稳：

```python
# Python 端读 JTS 生成的 WKB
from shapely import wkb
geom = wkb.loads(bytes.fromhex(hex_string))
print(geom.area, geom.is_valid)
```

### 23.7.3 一个常见的混合架构

```
Java 服务（JTS）──WKB──> Python 分析脚本（Shapely/GEOS）
       ↑                        │
       └──────WKB 结果回写───────┘
```

这种架构的关键约束是**版本对齐**：Shapely 的 GEOS 版本必须与 JTS 主版本大致同期，否则某些边界几何的结果会不同。用 WKB 交换能规避格式问题，但规避不了算法差异。

---

## 23.8 Hibernate Spatial 与 JPA

### 23.8.1 定位

Hibernate Spatial 把 JTS 几何映射到数据库的空间类型。它自己不实现几何算法，而是**桥接**：

```
JPA Entity 字段（Geometry）
        │  Hibernate Spatial 的 GeometryType / 方言
        ▼
数据库空间列（geometry / SDO_GEOMETRY / 自定义二进制）
```

### 23.8.2 实体映射

```java
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

import org.locationtech.jts.geom.Geometry;

@Entity
public class Parcel {

  @Id
  private Long id;

  @Column(columnDefinition = "geometry(Polygon, 4326)")
  private Geometry geom;

  private String code;

  // getters / setters 省略
}
```

注意 `columnDefinition` 是**方言相关**的：PostgreSQL/PostGIS 写成 `geometry(Polygon,4326)`，Oracle 写成 `SDO_GEOMETRY`，MySQL 写成 `GEOMETRY`。写死会让项目无法换库。

### 23.8.3 三个容易踩的坑

| 坑 | 表现 | 处置 |
| --- | --- | --- |
| 依赖版本错配 | `NoSuchMethodError: Geometry.getSRID` | 用 Hibernate 官方 BOM 锁定 `hibernate-spatial` 与 `hibernate-core` |
| 坐标系丢失 | 查询出来 `SRID=0` | 写入前 `geom.setSRID(4326)`，或由方言配置默认 SRID |
| 延迟加载导致几何被代理包装 | `ClassCastException` | 用 `Hibernate.unproxy()` 或关闭该字段的懒加载 |

---

## 23.9 Elasticsearch 与 OpenSearch

### 23.9.1 关键认知：ES 不用 JTS

Elasticsearch 的空间检索基于 **Lucene 的 spatial 模块**，它有自己的几何表示（`org.apache.lucene.geo.*`），**与 JTS 无关**。你能在 ES 里用 GeoJSON 或 WKT 传几何，是因为客户端/服务端做了格式转换，不是因为它内部跑 JTS。

这带来两个实际影响：

1. **精度模型不同**：ES 的 `geo_shape` 默认按经纬度处理，且默认是“平面近似”；`shape` 类型才支持任意坐标系的平面几何。
2. **支持的操作有限**：ES 主要做查询（intersects/within/disjoint），**不做叠加运算**。想在 ES 里求两个面的交，做不到，必须取出来用 JTS 算。

### 23.9.2 字段类型与查询

| 字段类型 | 用途 | 坐标系 | JTS 对应 |
| --- | --- | --- | --- |
| `geo_point` | 单点 | 经纬度 | `Point` |
| `geo_shape` | 任意地理几何 | 经纬度（WGS84） | `Geometry`（需转 GeoJSON） |
| `shape` | 平面几何 | 任意笛卡尔坐标 | `Geometry`（需转 GeoJSON） |
| `point` | 平面点 | 笛卡尔 | `Point` |

### 23.9.3 用 JTS 生成 ES 可索引的 GeoJSON

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.geojson.GeoJsonWriter;

public class EsGeoJsonHelper {

  /**
   * 把 JTS 几何转成 ES geo_shape 可直接接受的 JSON。
   * ES 的 geo_shape 要求坐标是 [lon, lat] 顺序，GeoJSON 标准也是这个顺序，
   * 所以这里不需要翻转。
   */
  public static String toGeoShapeJson(Geometry geom) {
    GeoJsonWriter writer = new GeoJsonWriter(6);   // 保留 6 位小数，约 0.1 米精度
    writer.setEncodeCRS(false);                     // ES 不接受 crs 字段
    return writer.write(geom);
  }
}
```

两个细节：`GeoJsonWriter(int decimals)` 控制小数位，地籍级精度建议 7 位；`setEncodeCRS(false)` 很重要，因为部分老版本 ES 会拒绝带 `crs` 成员的 GeoJSON。

---

### 23.9.4 常用 geo_shape 查询的 DSL

索引里的几何由 JTS 生成，查询端则是 ES 自己的 DSL。几个最常用的写法（可直接贴进 Kibana Dev Tools 验证）：

```json
// 1. 找出与给定多边形相交的文档（relation 默认 intersects）
POST /parcels/_search
{
  "query": {
    "geo_shape": {
      "geom": {
        "shape": {
          "type": "Polygon",
          "coordinates": [[[116.39, 39.90], [116.41, 39.90],
                           [116.41, 39.92], [116.39, 39.92],
                           [116.39, 39.90]]]
        },
        "relation": "intersects"
      }
    }
  }
}

// 2. 完全包含（文档几何被查询几何包含）
//    把 relation 改成 "within"；反过来“查询几何被文档包含”用 "contains"

// 3. 只有距离条件时用 geo_distance（点数据、geo_point 字段）
GET /shops/_search
{
  "query": {
    "geo_distance": {
      "distance": "3km",
      "location": { "lat": 39.909, "lon": 116.397 }
    }
  }
}
```

`relation` 的四个取值对应关系很直接：

| relation | 语义 | JTS 对应 |
| --- | --- | --- |
| `intersects` | 有公共点（默认） | `intersects` |
| `within` | 文档几何在查询几何内部 | `within` |
| `contains` | 文档几何包含查询几何 | `contains` |
| `disjoint` | 不相交 | `disjoint` |

注意 ES 的 `within`/`contains` 是**查询几何与文档几何**的关系，方向容易搞反；建议先用一条已知数据验证方向，再写进业务代码。


## 23.10 Apache Sedona 与 Spark

### 23.10.1 定位

Apache Sedona（原 GeoSpark）在 Spark 之上做分布式空间计算，**内部用 JTS 做单机几何运算**，用空间索引与分区做分布式加速。所以它和 JTS 的关系是“包裹”而不是“替代”。

| Sedona API | 内部实现 | 对应 JTS |
| --- | --- | --- |
| `ST_Intersects(a, b)` | JTS `intersects` | `geom.intersects` |
| `ST_Contains` | JTS `contains` | `geom.contains` |
| `ST_Buffer` | JTS `buffer` | `geom.buffer` |
| `ST_Intersection` | JTS `intersection` | `geom.intersection` |
| `ST_Union` | JTS `union` | `geom.union` |
| `ST_IsValid` | JTS `isValid` | `geom.isValid` |
| `ST_MakeValid` | JTS `GeometryFixer` | `GeometryFixer.fix` |
| `ST_Transform` | 依赖 Proj4J | GeoTools `JTS.transform`（JTS 本身无此能力） |

注意最后一行：**Sedona 的 `ST_Transform` 不是 JTS 的能力**，它内部用 Proj4J。这说明“JTS 不含 CRS”这条约束在分布式栈里同样成立。

### 23.10.2 分布式场景下的 JTS 使用原则

| 原则 | 原因 |
| --- | --- |
| 每行几何尽量小（< 1 万顶点） | JTS 单次运算内存与耗时随顶点数增长 |
| 先分区再算 | 空间连接必须靠空间分区避免 O(n²) |
| 避免在 UDF 里 new 大量临时对象 | JVM GC 压力大，Sedona 建议复用工厂 |
| 非法几何先 `ST_MakeValid` | 分布式环境下一次异常会让整个 task 重试 |

---

### 23.10.3 一段可运行的 Sedona 作业骨架

Sedona 的 SQL 层把 JTS 调用包装成了 `ST_*` 函数，写法和 PostGIS 非常接近：

```java
// Spark SQL：把 WKT 列转成几何，做空间连接，再输出 WKT
Dataset<Row> parcels = spark.read().parquet("parcels.parquet");   // 含 wkt 列
Dataset<Row> pois    = spark.read().parquet("pois.parquet");      // 含 wkt 列

parcels.createOrReplaceTempView("parcels");
pois.createOrReplaceTempView("pois");

Dataset<Row> joined = spark.sql(
    "SELECT p.id AS parcel_id, o.id AS poi_id, o.name "
  + "FROM parcels p JOIN pois o "
  + "ON ST_Intersects(ST_GeomFromWKT(p.wkt), ST_GeomFromWKT(o.wkt))");

joined.show(10);
```

三个实践要点：

1. **空间连接必须靠分区**：Sedona 用 `ST_Contains` 之类谓词做 join 时，会先按网格分区，避免 O(n²)。数据倾斜（某个网格要素过多）时性能会骤降，需要用 `ST_Split`/`ST_SubDivide` 预先切分超大几何。
2. **WKT 只是入口**：Spark 内部用二进制几何，WKT 解析（`ST_GeomFromWKT`）是 CPU 热点，能落 Parquet/GeoParquet 就别反复解析 WKT。
3. **非法几何会拖垮整个 task**：分布式环境下一次异常会导致 task 重试，务必先 `ST_MakeValid`（内部就是 JTS 的 `GeometryFixer`）。


## 23.11 Spring Boot 中的 JTS

### 23.11.1 依赖与自动配置

最小依赖：

```xml
<dependency>
  <groupId>org.locationtech.jts</groupId>
  <artifactId>jts-core</artifactId>
  <version>1.20.0</version>
</dependency>

<!-- 需要 GeoJSON -->
<dependency>
  <groupId>org.locationtech.jts.io</groupId>
  <artifactId>jts-io-common</artifactId>
  <version>1.20.0</version>
</dependency>

<!-- 需要 Hibernate 空间映射 -->
<dependency>
  <groupId>org.hibernate.orm</groupId>
  <artifactId>hibernate-spatial</artifactId>
  <version>${hibernate.version}</version>
</dependency>
```

Spring Boot 本身**没有 JTS 自动配置**。`GeometryFactory`、`WKTReader`、`WKBWriter` 这些都要自己声明成 Bean，或者用静态工具类。

### 23.11.2 线程安全与 Bean 设计

| 类 | 线程安全 | 是否可复用 | 建议 |
| --- | --- | --- | --- |
| `GeometryFactory` | 是（不可变配置） | 可 | 单例 Bean |
| `WKTReader` | **否**（内部有状态） | 不可 | 每次 new 或 `ThreadLocal` |
| `WKTWriter` | **否** | 不可 | 每次 new |
| `WKBReader` / `WKBWriter` | **否** | 不可 | 每次 new |
| `GeoJsonReader` / `GeoJsonWriter` | **否** | 不可 | 每次 new |
| `PreparedGeometry` | 是 | 可 | 按几何缓存 |
| `STRtree` | 构建后只读则安全 | 可 | 构建一次，只读共享 |

这张表是很多“偶发乱码/解析失败”问题的根源：把 `WKTReader` 声明成单例 Bean，在并发下内部缓冲区被串改，解析结果随机出错。

```java
import org.locationtech.jts.geom.GeometryFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JtsConfig {

  /** 工厂无状态，可以安全共享。 */
  @Bean
  public GeometryFactory geometryFactory() {
    return new GeometryFactory();
  }

  // 反例：不要这样写！
  // @Bean
  // public WKTReader wktReader() { return new WKTReader(); }
}
```

### 23.11.3 一个典型的分层用法

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.springframework.stereotype.Service;

@Service
public class ParcelService {

  private final GeometryFactory geometryFactory;

  public ParcelService(GeometryFactory geometryFactory) {
    this.geometryFactory = geometryFactory;
  }

  /**
   * 解析 WKT 并做有效性修复。
   * WKTReader 每次新建，避免并发问题。
   */
  public Geometry parseAndFix(String wkt) throws Exception {
    WKTReader reader = new WKTReader(geometryFactory);
    Geometry geom = reader.read(wkt);
    return geom.isValid() ? geom : org.locationtech.jts.geom.util.GeometryFixer.fix(geom);
  }
}
```

---

## 23.12 版本兼容矩阵

### 23.12.1 JTS 自身的兼容承诺

| 变更类型 | 兼容性 | 说明 |
| --- | --- | --- |
| 新增类/方法 | 二进制兼容 | 放心升级 |
| 修改方法签名 | **不兼容** | 极少发生，走弃用流程 |
| 删除弃用 API | **不兼容** | 大版本才可能 |
| 内部实现变化（包私有） | 兼容 | 但行为可能微调 |
| 默认行为切换 | 兼容但**语义变化** | 如 1.20 的 `jts.relate=ng` |

JTS 用 ABI Laboratory 跟踪二进制兼容性，但**不保证跨大版本的行为完全一致**。典型例子：1.20 引入 `RelateNG` 后，`jts.relate=ng` 会让部分关系谓词结果更精确（也更慢/更快），这类差异不会体现在签名上。

### 23.12.2 生态版本组合建议

| 栈 | 建议组合 | 风险点 |
| --- | --- | --- |
| GeoTools 29+ | JTS 1.20.x | GeoTools BOM 锁死 JTS 版本，不要手动覆盖 |
| GeoServer 2.25+ | 随 GeoTools | 不要单独升级 JTS |
| Hibernate 6.4+ | JTS 1.19.x / 1.20.x + `hibernate-spatial` | `hibernate-spatial` 与 core 必须同版本 |
| Sedona 1.6+ | JTS 1.19.x / 1.20.x | Spark 版本与 Sedona 绑定 |
| Spring Boot 3.x | 引入 JTS 1.20.x | 注意 Jakarta 命名空间 |
| ES 8.x | 无 JTS 依赖 | 只需 GeoJSON 交换 |

### 23.12.3 用 Maven 检查冲突

```bash
# 看完整的依赖树，找重复的 JTS 版本
mvn dependency:tree -Dincludes=org.locationtech.jts

# 看某个依赖为什么被引入
mvn dependency:tree -Dincludes=org.locationtech.jts:jts-core -Dverbose

# 排除传递依赖里的旧版本
```

```xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>some-geo-lib</artifactId>
  <version>1.0</version>
  <exclusions>
    <exclusion>
      <groupId>org.locationtech.jts</groupId>
      <artifactId>jts-core</artifactId>
    </exclusion>
  </exclusions>
</dependency>
```

**统一版本的正确姿势是在父 POM 的 `<dependencyManagement>` 里锁一次**，而不是在每个依赖上排除。

---

## 23.13 跨栈迁移注意事项

### 23.13.1 迁移检查清单

从 PostGIS 迁到 JTS，或从 JTS 迁到分布式引擎，按这份清单过一遍：

```
┌──────────────────────────────────────────────────────────────┐
│ 跨栈迁移检查清单                                              │
├──────────────────────────────────────────────────────────────┤
│ □ 1. 坐标系：目标栈是否处理 CRS？单位是米还是度？              │
│ □ 2. 有效性定义：目标栈的 isValid 与源栈是否一致？             │
│ □ 3. 精度模型：是否需要在边界加固定精度（scale factor）？      │
│ □ 4. 空几何语义：EMPTY 与 NULL 的处理是否一致？               │
│ □ 5. 环方向：是否要求外环顺时针/逆时针？                      │
│ □ 6. Z/M 值：目标栈是否丢弃？是否影响结果？                   │
│ □ 7. 索引：目标栈是否需要显式建空间索引？                     │
│ □ 8. 异常语义：拓扑异常是抛错还是返回 NULL？                  │
│ □ 9. 批量大小：单次传输的几何总量是否超限？                   │
│ □ 10. 并发：Reader/Writer 是否被共享？                        │
└──────────────────────────────────────────────────────────────┘
```

### 23.13.2 五个真实的“迁移事故”

**事故一：环方向导致面积符号反转。** JTS 的 `Polygon` 不强制环方向，但某些栈（如部分三维引擎、某些 OGC 服务）要求外环逆时针。迁移后面积变负或渲染成洞。

**事故二：`EMPTY` 与 `NULL`。** PostGIS 里 `ST_GeomFromText('POLYGON EMPTY')` 是合法的空几何，JTS 也能表示；但某些 ORM 会把空几何映射成 `null`，于是 `geom.isEmpty()` 变成 NPE。

**事故三：坐标顺序。** GeoJSON 是 `[lon, lat]`，某些库内部是 `(lat, lon)`。EPSG:4326 的官方轴序其实是 `(lat, lon)`，而 GIS 惯例是 `(lon, lat)`——GeoTools 的 `CRS.decode(srid, true)` 就是在处理这件事。

**事故四：精度截断。** 前端 GeoJSON 默认 6 位小数（约 0.1 米），地籍数据要求毫米级，来回一趟就丢了精度。内部一律用 WKB。

**事故五：版本静默降级。** Maven 传递依赖把 `jts-core` 从 1.20 拉到 1.18，代码里用了 `RelateNG` 就在运行期 `NoClassDefFoundError`。用 `dependency:tree` 定期体检。

### 23.13.3 迁移的验证策略

```
  抽样几何集（含边界案例）
        │
        ├──> 源栈计算 ──> 结果 R1（WKT 规范化后比较）
        │
        └──> 目标栈计算 ──> 结果 R2
                 │
                 ▼
        比较策略：
          1. 精确比对（normalize 后 equalsExact）
          2. 容差比对（equalsExact(tol)）
          3. 语义比对（面积/长度/顶点数在容差内）
          4. 拓扑比对（DE-9IM 矩阵一致）
```

实践建议：**边界案例比随机样本更有价值**。准备一批“共线、重合边、洞贴边、自相交、极小面积、极大坐标”的用例，比跑一万条普通数据更能暴露差异。

---

## 23.14 常见问题与避坑

### 23.14.1 GeoTools 相关

**Q：`JTS.transform` 报 `IllegalArgumentException: Expected 2 dimensions`。**
A：源几何与目标 CRS 的轴数不匹配。常见于 Z 值几何转二维 CRS，或 `CRS.decode` 时轴序参数写错。先确认 `src.getCoordinateSystem().getDimension()`。

**Q：坐标转换后整体偏移几百米。**
A：几乎都是轴序问题。`CRS.decode("EPSG:4326")` 默认可能是 `(lat, lon)`，加 `true` 参数强制经度在前。

**Q：GeoTools 读出来的几何 `isValid()` 是 false。**
A：源数据本身非法。GeoTools 不做自动修复，读出来后自己 `GeometryFixer.fix`。

### 23.14.2 PostGIS 相关

**Q：JTS 算的 `ST_Area` 和 PostGIS 不一样。**
A：先确认两者坐标系是否相同。经纬度下 PostGIS 的 `ST_Area` 也是平方度；若用了 `geography` 类型则按平方米，两者不该直接比。

**Q：`ST_Buffer` 在 PG 里比 JTS 快很多。**
A：PG 有索引与查询计划优化，且 GEOS 的缓冲实现经过 C++ 优化。单次运算差距不大，差距来自批量与索引。

**Q：`ST_Union` 超时。**
A：用 `ST_Union(ARRAY[...])` 或先 `ST_Collect` 再 union，避免逐行聚合反复扫描。

### 23.14.3 其他栈

**Q：ES 里能算两个面的交集吗。**
A：不能。ES 只做查询匹配，叠加运算要取出几何用 JTS 算。

**Q：Shapely 与 JTS 结果不一致。**
A：GEOS 与 JTS 版本不同步。用 WKB 交换能排除格式问题，但算法差异仍在；关键业务做双端对照。

**Q：Hibernate 报 `UnsupportedOperationException: Geometry is not supported`。**
A：没加 `hibernate-spatial` 依赖，或方言没配。PostgreSQL 用 `PostgisPGDialect`（具体类名随 Hibernate 版本变化，以官方文档为准）。

---

## 23.15 本章小结

- JTS 只活在 JVM 上；GEOS、NTS、JSTS 是同源思想的独立移植，ES 的 Lucene spatial 与 JTS 无关。
- JTS 不含 CRS，所有距离/面积/缓冲的单位都是坐标单位；投影必须交给 GeoTools 或 Proj4J。
- GeoTools 与 JTS 版本强绑定，用其 BOM 锁版本；几何工厂用 `JTSFactoryFinder.getGeometryFactory()`，不要自己 new。
- `CRS.decode("EPSG:4326", true)` 的 `longitudeFirst` 参数是最高频的坐标错位来源。
- PostGIS 用 GEOS，与 JTS 语义基本一致但边界可能不同；`ST_*` 与 JTS 方法可按下表对照，单位语义必须显式处理。
- 跨栈传几何优先 WKB（无损、体积小），WKT 用于调试，GeoJSON 用于前端展示。
- NTS/JSTS/Shapely 的 API 与 JTS 高度相似，但方法名大小写、属性 vs 方法、版本支持度各不相同。
- Hibernate Spatial 只做映射，不做算法；`columnDefinition` 是方言相关的，写死会锁死数据库。
- Elasticsearch/OpenSearch 不做叠加运算，只做查询匹配，字段类型分 `geo_shape`/`shape`。
- Sedona 在 Spark 上包裹 JTS，`ST_Transform` 靠 Proj4J 而非 JTS。
- Spring Boot 里 `GeometryFactory` 可单例，`WKTReader`/`WKBReader`/`GeoJsonWriter` 绝不能单例。
- 版本兼容性用 `mvn dependency:tree -Dincludes=org.locationtech.jts` 定期检查，在父 POM 的 `dependencyManagement` 里统一锁定。

---

## 相关资源

- JTS 官方仓库：[https://github.com/locationtech/jts](https://github.com/locationtech/jts)
- JTS Javadoc：[https://locationtech.github.io/jts/javadoc/](https://locationtech.github.io/jts/javadoc/)
- GeoTools 官方文档：[https://docs.geotools.org/](https://docs.geotools.org/)
- PostGIS 空间函数参考：[https://postgis.net/docs/reference.html](https://postgis.net/docs/reference.html)
- NetTopologySuite 文档：[https://nettopologysuite.github.io/](https://nettopologysuite.github.io/)
- Apache Sedona 文档：[https://sedona.apache.org/](https://sedona.apache.org/)
- Shapely 文档：[https://shapely.readthedocs.io/](https://shapely.readthedocs.io/)
- Elasticsearch geo_shape 文档：[https://www.elastic.co/guide/en/elasticsearch/reference/current/geo-shape.html](https://www.elastic.co/guide/en/elasticsearch/reference/current/geo-shape.html)
- 本系列第 19 章（坐标系、单位与工程陷阱）：[https://znlgis.github.io/gis/tutorial/jts/第19章-坐标系单位与工程陷阱/](https://znlgis.github.io/gis/tutorial/jts/第19章-坐标系单位与工程陷阱/)
- 本系列第 22 章（扩展开发与自定义函数）：[https://znlgis.github.io/gis/tutorial/jts/第22章-扩展开发与自定义函数/](https://znlgis.github.io/gis/tutorial/jts/第22章-扩展开发与自定义函数/)
- 本系列第 24 章（综合实战案例）：[https://znlgis.github.io/gis/tutorial/jts/第24章-综合实战案例/](https://znlgis.github.io/gis/tutorial/jts/第24章-综合实战案例/)

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/jts/第22章-扩展开发与自定义函数/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/第24章-综合实战案例/" class="chapter-nav__next">下一章 →</a>
</div>

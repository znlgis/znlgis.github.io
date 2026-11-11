---
layout: default
title: 第07章 - GeoJSON 与 TWKB 数据交换
---

# 第07章 - GeoJSON 与 TWKB 数据交换

第 6 章讲的 WKT/WKB 是 GIS 圈的“母语”：规范严格、跨库支持最广、零依赖可用。但真实系统里还有两种格式天天出现：**GeoJSON** 是 Web 事实标准——前端地图、REST 接口、MongoDB、Elasticsearch 都在用；**TWKB**（Tiny Well-Known Binary）是 PostGIS 生态里的紧凑二进制格式，用“量化 + 增量 + varint”把几何压到 WKB 的几分之一，专门解决海量要素的传输与存储成本。

这两种格式都不在 `jts-core` 里，而在 `jts-io-common` 模块的 `org.locationtech.jts.io.geojson` 与 `org.locationtech.jts.io.twkb` 两个包里。这不是随意的划分：`jts-io-common` 引入了 `json-simple` 依赖，而 `jts-core` 刻意保持零运行时依赖。理解这条边界，能帮你在“要不要引这个模块”的问题上做出正确决定。

本章先讲 `jts-io-common` 的模块结构与依赖，再分别深入 GeoJSON 的读写细节（decimals、CRS 编码、环方向、空几何）与 TWKB 的压缩原理（precision、varint、bbox、size），然后做一次 WKB/TWKB/GeoJSON 的三方对比，最后给出自定义格式扩展的思路。所有输出均为本机编译 `jts-io-common` 源码后的实跑结果。

前置知识：第 6 章（WKT 与 WKB 序列化）。GeoJSON 的很多坑与 WKT 同源（精度、空几何），先读完第 6 章会更顺。

---

## 7.1 jts-io-common 模块结构

### 7.1.1 为什么单独拆一个模块

`jts-core` 的设计原则之一是**零运行时依赖**：它只依赖 JDK，任何项目引入都不会带来依赖冲突。这条原则是 JTS 能被 GeoTools、GeoServer、Hibernate Spatial 等大量框架安全嵌入的基础。

但 GeoJSON 需要 JSON 解析器。JTS 团队的选择是：

- 把 GeoJSON/TWKB 这些“需要第三方库”的格式拆到 `jts-io-common`；
- 该模块只引一个轻量依赖 `json-simple`；
- `jts-core` 保持零依赖不动。

```
┌──────────────────────────────────────────────────────────┐
│                        jts-core                          │
│  geom / algorithm / operation / index / io(WKT,WKB)      │
│  运行时依赖：无（仅 JDK）                                 │
└───────────────────────────┬──────────────────────────────┘
                            │ 依赖
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    jts-io-common                         │
│  io.geojson   （需要 json-simple）                        │
│  io.twkb      （纯手写字节流，无额外依赖）                  │
│  io(WKT/WKB 辅助类，如 WKTReader 的扩展)                   │
│  运行时依赖：jts-core + json-simple                      │
└──────────────────────────────────────────────────────────┘
```

**工程含义**：如果你的服务只用 WKT/WKB，导 `jts-core` 就够了；一旦要 GeoJSON，就必须多引一个 jar 和一个传递依赖。在依赖敏感的容器环境里，这个差别值得纳入考量。

### 7.1.2 Maven 坐标

注意 `jts-io-common` 的 groupId 与 `jts-core` **不同**：

| 模块 | groupId | artifactId | 版本（示例） |
| --- | --- | --- | --- |
| 核心 | `org.locationtech.jts` | `jts-core` | 1.20.0 |
| IO 通用 | `org.locationtech.jts.io` | `jts-io-common` | 1.20.0 |

```xml
<dependency>
  <groupId>org.locationtech.jts</groupId>
  <artifactId>jts-core</artifactId>
  <version>1.20.0</version>
</dependency>

<!-- GeoJSON / TWKB 需要这个 -->
<dependency>
  <groupId>org.locationtech.jts.io</groupId>
  <artifactId>jts-io-common</artifactId>
  <version>1.20.0</version>
</dependency>
```

这是很多人第一次用 GeoJSON 时踩的坑：只加了 `jts-core`，然后 `import org.locationtech.jts.io.geojson.GeoJsonReader` 编译不过，误以为是 JTS 版本问题。**先确认 groupId 是不是 `org.locationtech.jts.io`**。

### 7.1.3 包结构

```
org.locationtech.jts.io
├── geojson
│   ├── GeoJsonReader      ← GeoJSON 文本 → Geometry
│   ├── GeoJsonWriter      ← Geometry → GeoJSON 文本
│   ├── GeoJsonConstants   ← "type" / "coordinates" / "features" 等常量
│   └── OrientationTransformer ← 环方向转换（Right Hand Rule）
└── twkb
    ├── TWKBWriter         ← Geometry → TWKB 字节
    ├── TWKBReader         ← TWKB 字节 → Geometry
    ├── TWKBHeader         ← 头部位字段（包私有）
    ├── Varint             ← 变长整数编解码（包私有）
    └── BoundsExtractor    ← 批量读取时提取范围
```

值得注意的两个细节：

1. `TWKBHeader` 与 `Varint` 是**包私有**（`class TWKBHeader`，没有 `public`），说明 TWKB 的内部结构不打算作为公开 API。你只需要用 `TWKBWriter`/`TWKBReader`。
2. `OrientationTransformer` 是 GeoJSON 环方向处理的实现类，`GeoJsonWriter` 的 `setForceCCW` 会用到它。

### 7.1.4 版本与依赖矩阵

| jts-io-common 版本 | 依赖 jts-core | json-simple | 新增内容 |
| --- | --- | --- | --- |
| 1.16 | 1.16 | 1.1.1 | 引入 GeoJSON 读写 |
| 1.17 | 1.17 | 1.1.1 | GeoJSON 增强 |
| 1.18 | 1.18 | 1.1.1 | 引入 TWKB（`io.twkb`） |
| 1.19 | 1.19 | 1.1.1 | TWKB 修正（M 值、空几何等） |
| 1.20 | 1.20 | 1.1.1 | 与 core 同步 |

> 版本号必须与 `jts-core` 一致。混用（比如 io 1.20 + core 1.18）会在运行期出现 `NoSuchMethodError`，因为 io 模块调用了 core 的新 API。

---

## 7.2 GeoJSON 规范速览

### 7.2.1 核心结构

GeoJSON（RFC 7946）用 JSON 表达几何，顶层是带 `type` 的对象。七种几何类型与 JTS 的子类一一对应：

| GeoJSON type | JTS 类型 | coordinates 结构 |
| --- | --- | --- |
| `Point` | `Point` | `[x, y]` |
| `LineString` | `LineString` | `[[x,y], ...]` |
| `Polygon` | `Polygon` | `[[[x,y], ...], ...]`（第一层是环） |
| `MultiPoint` | `MultiPoint` | `[[x,y], ...]` |
| `MultiLineString` | `MultiLineString` | `[[[x,y],...], ...]` |
| `MultiPolygon` | `MultiPolygon` | `[[[[x,y],...]], ...]` |
| `GeometryCollection` | `GeometryCollection` | 用 `geometries` 而非 `coordinates` |

再加两个容器类型：

| 容器 | 结构 | JTS 对应 |
| --- | --- | --- |
| `Feature` | `{type, geometry, properties, id}` | 无直接对应（几何在 `geometry` 字段里） |
| `FeatureCollection` | `{type, features: [...]}` | `GeoJsonReader` 读成 `GeometryCollection` |

**重要认知**：JTS 只认“几何”，不认“要素”。GeoJSON 的 `Feature`/`FeatureCollection` 是**带属性的容器**，JTS 读它们时会把 `geometry` 抽出来丢掉属性。属性处理是 GeoTools 的 `SimpleFeature` 的职责（见第 23 章）。

### 7.2.2 坐标顺序

GeoJSON 规定坐标是 `[经度, 纬度]`（`[lon, lat]`），也就是 **x 在前、y 在后**。这与 EPSG:4326 的官方轴序（纬度在前）相反，但符合 GIS 惯例，也和 JTS 的 `Coordinate.x/y` 语义一致。

推论：**JTS 的几何写 GeoJSON 不需要翻转坐标**。只有当你的数据源是“按 EPSG 轴序存储”的时候才需要翻转——那种情况通常出现在直接读 WKT 或某些严格按规范实现的库。

### 7.2.3 环方向（Right Hand Rule）

RFC 7946 要求：

- **外环逆时针**（counter-clockwise，CCW）；
- **内环（洞）顺时针**（clockwise，CW）。

但 RFC 也说明“解析端不应拒绝方向错误的几何”。JTS 的做法是：

- `GeoJsonWriter` **默认不强制**（`isForceCCW = false`），原样输出几何的环方向；
- 调用 `setForceCCW(true)` 才会按右手法则重排。

这一点在源码注释里写得很明确：

> The GeoJSON specification states that polygons should be emitted using the counter-clockwise shell orientation. This is not enforced by this writer.

### 7.2.4 空几何表达

RFC 7946 没有明确规定“类型化空几何”怎么写，JTS 的选择是**用空的 `coordinates` 数组**：

```text
POINT EMPTY        -> {"type":"Point","coordinates":[]}
LINESTRING EMPTY   -> {"type":"LineString","coordinates":[]}
POLYGON EMPTY      -> {"type":"Polygon","coordinates":[]}
GEOMETRYCOLLECTION EMPTY -> {"type":"GeometryCollection","geometries":[]}
```

这符合“保留类型”的直觉，但要注意：**别的库不一定这么写**。有些库输出 `null`，有些直接省略该要素。跨库交换时空几何是最容易产生分歧的地方之一。

---

## 7.3 GeoJsonWriter 详解

### 7.3.1 公开 API

```java
public class GeoJsonWriter {
  public static final String EPSG_PREFIX = "EPSG:";

  public GeoJsonWriter();          // 等价于 GeoJsonWriter(8)
  public GeoJsonWriter(int decimals);

  public void setEncodeCRS(boolean isEncodeCRS);
  public void setForceCCW(boolean isForceCCW);

  public String write(Geometry geometry);
  public void write(Geometry geometry, Writer writer) throws IOException;
}
```

注意方法名是 `setEncodeCRS`，不是 `setEncodeCrs`（JTS 里 CRS 一贯全大写）。参数 `decimals` 是“小数位数”，构造器内部会转成 `scale = Math.pow(10, decimals)`。

### 7.3.2 默认行为：会输出 CRS！

这是最容易让人意外的一点。`GeoJsonWriter` 的字段默认值是：

```java
private double scale;
private boolean isEncodeCRS = true;    // 默认 true！
private boolean isForceCCW = false;
```

所以 `new GeoJsonWriter().write(geom)` 的输出**会带 `crs` 字段**：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.io.geojson.GeoJsonWriter;

GeometryFactory gf = new GeometryFactory();
Geometry poly = new WKTReader(gf).read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");

System.out.println(new GeoJsonWriter().write(poly));
```

输出（本机实跑）：

```text
{"type":"Polygon","coordinates":[[[0.0,0.0],[10,0.0],[10,10],[0.0,10],[0.0,0.0]]],"crs":{"type":"name","properties":{"name":"EPSG:0"}}}
```

看到 `EPSG:0` 了吗？因为几何的 SRID 是 0（默认工厂不设 SRID）。**多数消费端（前端库、ES、MongoDB）不接受 `crs` 字段**，RFC 7946 甚至已经移除了 `crs` 成员。所以生产代码几乎总是要：

```java
GeoJsonWriter writer = new GeoJsonWriter();
writer.setEncodeCRS(false);      // 关键一行
String json = writer.write(geom);
```

输出变成纯 RFC 7946 格式：

```text
{"type":"Polygon","coordinates":[[[0.0,0.0],[10,0.0],[10,10],[0.0,10],[0.0,0.0]]]}
```

如果确实需要 CRS 信息，正确做法是**在服务协议层带**（比如 HTTP 头、或者 FeatureCollection 的自定义字段），而不是塞进几何的 `crs` 成员。

### 7.3.3 decimals 参数的实测效果

```java
GeometryFactory gf = new GeometryFactory();
WKTReader reader = new WKTReader(gf);
Geometry pt = reader.read("POINT (116.39742800001 39.90923000002)");

for (int d : new int[] {8, 6, 3}) {
  GeoJsonWriter w = new GeoJsonWriter(d);
  w.setEncodeCRS(false);
  System.out.println("decimals=" + d + " -> " + w.write(pt));
}
```

输出（本机实跑）：

```text
decimals=8 -> {"type":"Point","coordinates":[116.397428,39.90923]}
decimals=6 -> {"type":"Point","coordinates":[116.397428,39.90923]}
decimals=3 -> {"type":"Point","coordinates":[116.397,39.909]}
```

两个观察：

1. **decimals=8 与 decimals=6 输出相同**：因为原值的有效小数只有 6 位（`116.39742800001` 舍入到 8 位是 `116.39742800`，去掉尾零就是 `116.397428`）。这是 `DecimalFormat` 的行为，不是 bug。
2. **decimals 是“舍入”不是“截断”**：`39.90923000002` 在 3 位时输出 `39.909`（第 4 位是 2，舍去）。

**精度建议**：

| 场景 | decimals | 说明 |
| --- | --- | --- |
| 一般 Web 展示 | 6 | 约 0.1 米精度，够用 |
| 高德/百度等互联网地图 | 6~7 | 与底图精度匹配 |
| 地籍、管线 | 7~8 | 毫米级；超过 8 位没意义（双精度极限） |
| 面积/长度计算 | 不要用 GeoJSON 传输 | 用 WKB，避免舍入误差累积 |

### 7.3.4 setForceCCW：环方向规范化

```java
GeometryFactory gf = new GeometryFactory();
WKTReader reader = new WKTReader(gf);

// 故意写一个顺时针的矩形（外环）
Geometry cw = reader.read("POLYGON ((0 0, 0 10, 10 10, 10 0, 0 0))");

GeoJsonWriter plain = new GeoJsonWriter();
plain.setEncodeCRS(false);
System.out.println("不强制: " + plain.write(cw));

GeoJsonWriter ccw = new GeoJsonWriter();
ccw.setEncodeCRS(false);
ccw.setForceCCW(true);
System.out.println("强制CCW: " + ccw.write(cw));
```

输出（本机实跑）：

```text
不强制: {"type":"Polygon","coordinates":[[[0.0,0.0],[0,10],[10,10],[10,0],[0.0,0.0]]]}
强制CCW: {"type":"Polygon","coordinates":[[[0.0,0.0],[10,0],[10,10],[0,10],[0.0,0.0]]]}
```

可以看到 `setForceCCW(true)` 把环的遍历方向从 (0,0)→(0,10)→(10,10)→(10,0) 翻成了 (0,0)→(10,0)→(10,10)→(0,10)，也就是逆时针。

**什么时候需要开它**：

- 下游严格按 RFC 7946 校验（某些地图引擎、某些 GeoJSON 校验器）；
- 数据要交付给国外团队或开放平台，对方按规范实现。

**什么时候不需要**：

- 只在自家前后端传（Leaflet/Mapbox/OpenLayers 都能正确渲染任意方向）；
- 对性能敏感（多一次遍历 + 可能重建几何）。

### 7.3.5 空几何输出

```java
GeometryFactory gf = new GeometryFactory();
WKTReader reader = new WKTReader(gf);
GeoJsonWriter writer = new GeoJsonWriter();
writer.setEncodeCRS(false);

for (String wkt : new String[] {
    "POINT EMPTY", "LINESTRING EMPTY", "POLYGON EMPTY", "GEOMETRYCOLLECTION EMPTY"}) {
  System.out.println(wkt + " -> " + writer.write(reader.read(wkt)));
}
```

输出（本机实跑）：

```text
POINT EMPTY -> {"type":"Point","coordinates":[]}
LINESTRING EMPTY -> {"type":"LineString","coordinates":[]}
POLYGON EMPTY -> {"type":"Polygon","coordinates":[]}
GEOMETRYCOLLECTION EMPTY -> {"type":"GeometryCollection","geometries":[]}
```

这种“保留类型 + 空数组”的写法，JTS 的 `GeoJsonReader` 能原样读回来。但别的库可能会把它当成“无效几何”丢弃，跨库时要做兼容测试。

---

## 7.4 GeoJsonReader 详解

### 7.4.1 公开 API

```java
public class GeoJsonReader {
  public GeoJsonReader();
  public GeoJsonReader(GeometryFactory geometryFactory);
  public Geometry read(String json) throws ParseException;
  public Geometry read(Reader reader) throws ParseException;
}
```

API 比 writer 还简单。构造器可选 `GeometryFactory`：传入时会用它构造几何，**并且覆盖 GeoJSON 里 `crs` 指定的 SRID**；不传时行为取决于 `crs` 成员（源码注释：“The default constructor uses the SRID from the Geojson CRS and the default PrecisionModel”）。

### 7.4.2 读取几何、Feature 与 FeatureCollection

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.geojson.GeoJsonReader;

public class ReadKinds {

  public static void main(String[] args) throws ParseException {
    GeoJsonReader reader = new GeoJsonReader();

    // 1. 纯几何
    Geometry g1 = reader.read(
        "{\"type\":\"Point\",\"coordinates\":[1,2]}");
    System.out.println("几何   = " + g1);

    // 2. Feature（属性被丢弃，只取 geometry）
    Geometry g2 = reader.read(
        "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]},"
        + "\"properties\":{\"name\":\"A\"}}");
    System.out.println("Feature= " + g2);

    // 3. FeatureCollection（读成 GeometryCollection）
    Geometry g3 = reader.read(
        "{\"type\":\"FeatureCollection\",\"features\":["
        + "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]},\"properties\":{}},"
        + "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[3,4]},\"properties\":{}}]}");
    System.out.println("FC     = " + g3 + " 元素数=" + g3.getNumGeometries());
  }
}
```

输出（本机实跑）：

```text
几何   = POINT (1 2)
Feature= POINT (1 2)
FC     = GEOMETRYCOLLECTION (POINT (1 2), POINT (3 4)) 元素数=2
```

**这是使用 `GeoJsonReader` 最重要的一条认知**：它只负责几何，属性全部丢弃。如果你的业务需要属性，必须自己解析 JSON（Jackson/Gson）取 `properties`，再和几何配对；或者直接用 GeoTools 的 `FeatureJSON`/DataStore。

### 7.4.3 读取时的常见错误

```java
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.geojson.GeoJsonReader;

public class BadGeoJson {

  public static void main(String[] args) {
    GeoJsonReader reader = new GeoJsonReader();
    String[] bad = {
        "{\"type\":\"Circle\",\"coordinates\":[1,2]}",           // 未知类型
        "{\"coordinates\":[1,2]}",                                  // 缺 type
        "{not json}",                                               // 非法 JSON
        "{\"type\":\"Point\",\"coordinates\":[\"a\",\"b\"]}" // 非数字
    };
    for (String json : bad) {
      try {
        System.out.println("意外成功: " + reader.read(json));
      } catch (ParseException e) {
        System.out.println("ParseException: " + e.getMessage());
      } catch (RuntimeException e) {
        System.out.println("RuntimeException(" + e.getClass().getSimpleName()
            + "): " + e.getMessage());
      }
    }
  }
}
```

输出（本机实跑）：

```text
ParseException: Could not parse Geometry from GeoJson string.  Unsupported 'type':Circle
ParseException: Could not parse Geometry from Json string.  No 'type' property found.
ParseException: Unexpected character (n) at position 1.
ParseException: Could not parse Point from GeoJson string.
```

这几类脏数据都规规矩矩地抛 `ParseException`，比 WKT 那边（结构错误抛 `IllegalArgumentException`）更一致。但仍有两个**静默的坑**：

| 输入 | 实际行为 | 危险程度 |
| --- | --- | --- |
| `{"type":"Point","coordinates":[1]}` | **成功**，解析成 `POINT (1 0)`，缺失的 y 补 0 | 高：坐标错位却无异常 |
| `{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1]]]}` | 抛 `ParseException`（环未闭合） | 低：能及时发现 |
| `{"type":"Point","coordinates":[1,2,3]}` | **成功**，但 Z 只在维度里、`toString` 看不到 | 中：见 7.4.5 |
| `{"type":"Point","coordinates":"x"}` | 可能抛 `ClassCastException`（非受检） | 中：需 catch Exception |

第一条最值得警惕：**少给一个坐标不会报错，而是补 0**。所以生产代码不要只看“有没有抛异常”，还要做几何合法性/范围校验：

```java
public Geometry strictParse(String json) throws ParseException {
  Geometry g = new GeoJsonReader().read(json);
  if (g.isEmpty()) return g;

  // 1. 坐标必须在合理范围内（WGS84 经纬度）
  org.locationtech.jts.geom.Envelope env = g.getEnvelopeInternal();
  if (env.getMinX() < -180 || env.getMaxX() > 180
      || env.getMinY() < -90 || env.getMaxY() > 90) {
    throw new IllegalArgumentException("coordinate out of WGS84 range: " + env);
  }
  // 2. 面几何必须有效
  if (g.getDimension() == 2 && !g.isValid()) {
    throw new IllegalArgumentException("invalid polygon: " + g);
  }
  return g;
}
```

这个“范围校验”还能一次性抓出“经纬度写反”这类最常见的数据错误（比如把 `[116.4, 39.9]` 写成 `[39.9, 116.4]`，纬度 116 超出 ±90 立刻暴露）。

### 7.4.4 SRID 的处理

```java
// 带 crs 的 GeoJSON
String withCrs = "{\"type\":\"Point\",\"coordinates\":[1,2],"
    + "\"crs\":{\"type\":\"name\",\"properties\":{\"name\":\"EPSG:4326\"}}}";

System.out.println("默认构造器 SRID = "
    + new GeoJsonReader().read(withCrs).getSRID());

GeometryFactory gf4326 = new GeometryFactory(new PrecisionModel(), 4326);
System.out.println("指定工厂 SRID   = "
    + new GeoJsonReader(gf4326).read("{\"type\":\"Point\",\"coordinates\":[1,2]}").getSRID());
```

输出：

```text
默认构造器 SRID = 4326
指定工厂 SRID   = 4326
```

两条规则：

1. **不传工厂时，从 `crs` 成员里解析 SRID**（形如 `EPSG:4326`）。
2. **传了工厂时，以工厂的 SRID 为准**（源码注释：“override the GeoJson CRS”）。

如果 GeoJSON 里没有 `crs`，默认按 WGS84（4326）处理（源码注释里写明 “If there is no CRS specified then the default CRS is a geographic coordinate reference system, using the WGS84 datum”）。

但**默认构造器与传入工厂的行为不同**，实测对照：

| 场景 | `new GeoJsonReader()` | `new GeoJsonReader(new GeometryFactory())`（SRID=0 的工厂） |
| --- | --- | --- |
| GeoJSON 无 `crs` | SRID = **4326** | SRID = **0** |
| GeoJSON 有 `crs: EPSG:4326` | 4326 | 0 |
| GeoJSON 有 `crs: EPSG:3857` | 3857 | 0 |
| `new GeoJsonReader(gf4326)` 读 `crs: EPSG:3857` | — | **4326**（工厂覆盖 crs） |

结论：**传了工厂，工厂说了算**。想让 SRID 跟着 GeoJSON 走，就用无参构造器；想强制统一 SRID，就传一个带 SRID 的工厂。不要混着用，否则会出现“同一个接口不同分支 SRID 不一样”的灵异事件。

### 7.4.5 GeoJSON 的 Z 值：能读，但默认看不见

```java
GeoJsonReader reader = new GeoJsonReader();
Geometry p = reader.read("{\"type\":\"Point\",\"coordinates\":[1,2,3]}");

System.out.println("toString = " + p);
System.out.println("维度     = "
    + ((Point) p).getCoordinateSequence().getDimension());
System.out.println("显式输出 = " + new WKTWriter(3).write(p));
```

输出（本机实跑）：

```text
toString = POINT (1 2)
维度     = 3
显式输出 = POINT Z(1 2)
```

看到矛盾了吗？维度明明是 3，`toString` 却只显示两个坐标。原因是 `Geometry.toString()` 内部用的是 2 维 `WKTWriter`——**Z 值在内存里，只是默认打印不出来**。

这也解释了为什么“GeoJSON 往返后 Z 没了”这类反馈经常是误报：先确认你打印时用的 writer 是几维。

至于**写出**，`GeoJsonWriter` 会老老实实输出 Z：

```java
GeoJsonWriter w = new GeoJsonWriter();
w.setEncodeCRS(false);
System.out.println(w.write(new WKTReader().read("POINT Z (1 2 3)")));
```

```text
{"type":"Point","coordinates":[1,2,3]}
```

读回来维度也是 3。所以 **Z 的往返是通的**，前提是你别用 2 维 writer 打印后下结论。

但**M 值有一个静默事故**，这是本章最值得记住的坑之一：

```java
WKTReader r = new WKTReader(new GeometryFactory());
GeoJsonWriter w = new GeoJsonWriter();
w.setEncodeCRS(false);

// 1. 带 M 的几何写出去
Geometry m = r.read("POINT M (1 2 4)");
String json = w.write(m);
System.out.println("写出 = " + json);

// 2. 读回来看看变成什么
Geometry back = new GeoJsonReader().read(json);
System.out.println("读回 = " + new WKTWriter(3).write(back));
```

输出（本机实跑）：

```text
写出 = {"type":"Point","coordinates":[1,2,4]}
读回 = POINT Z(1 2 4)
```

**M 变成了 Z！** 因为 GeoJSON 规范里坐标的第三个元素**约定是高程（Z）**，没有 M 的位置。JTS 写出时把 M 放在第三位，读回来就按 Z 解释。这不是 JTS 的 bug，是格式本身的限制。

同理 `POINT ZM (1 2 3 4)` 写出去会丢掉 M：

```text
写出 = {"type":"Point","coordinates":[1,2,3]}
读回 = POINT Z(1 2 3)
```

**结论**：

- **GeoJSON 不是 M 值的安全载体**。需要度量值（里程、桩号、时间戳）时，请放在 Feature 的 `properties` 里，不要塞进坐标。
- Z 可以走 GeoJSON 的第三个坐标，但下游未必都保留（很多前端库会忽略第三位）。
- 既要 Z 又要 M 的场景，用 WKB（注意第 6 章说的 M 位问题）或自定义二进制协议。

---


## 7.5 TWKB 压缩原理

### 7.5.1 为什么还需要一个二进制格式

WKB 已经很小了，但它是“精确的冗余”：每个坐标固定 16 字节（两个 double），晒 100 万个点就是 16 MB。对海量要素（轨迹、路网、地块），这个体积在传输与存储上都是负担。

TWKB（Tiny Well-Known Binary）的思路完全不同：**牺牲可控精度，换取数量级的压缩**。它依靠三项技术：

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 量化（Quantization）                                     │
│    坐标先乘以 10^precision 再取整，把 double 变成小整数       │
│    116.397428 * 10^6 = 116397428（int）                      │
├─────────────────────────────────────────────────────────────┤
│ 2. 增量编码（Delta Encoding）                                │
│    不存绝对坐标，只存“与上一个点的差”                         │
│    相邻点差通常很小 → 数值小 → 编码短                         │
├─────────────────────────────────────────────────────────────┤
│ 3. 变长整数（Varint + ZigZag）                               │
│    小整数用 1 字节，大整数才用更多字节                        │
│    负数用 ZigZag 映射成正数，避免符号位浪费                   │
└─────────────────────────────────────────────────────────────┘
```

三者叠加的效果是：一条密集折线的 TWKB 通常是 WKB 的 **3%~30%**（取决于点的密度与精度）。

### 7.5.2 头部结构

TWKB 的头部分两到三个字节，外加可选字段。`TWKBWriter.writeHeaderTo` 的实现在源码里非常清晰：

```java
// 第 1 字节：几何类型（低 4 位）+ XY 精度（高位，ZigZag 编码后左移 4 位）
final int geometryType = header.geometryType().getValue();
final int precisionHeader = Varint.zigZagEncode(header.xyPrecision()) << 4;
typeAndPrecisionHeader = precisionHeader | geometryType;
out.writeByte(typeAndPrecisionHeader);

// 第 2 字节：元数据标志位
metadataHeader = (hasBBOX  ? 0b00000001 : 0)
               | (hasSize  ? 0b00000010 : 0)
               | (hasIdList? 0b00000100 : 0)
               | (hasExtPrecision ? 0b00001000 : 0)
               | (isEmpty   ? 0b00010000 : 0);
out.writeByte(metadataHeader);

// 第 3 字节（仅当有 Z/M 时）：扩展维度
if (header.hasExtendedPrecision()) {
  int extendedDimsHeader = (hasZ ? 0b00000001 : 0) | (hasM ? 0b00000010 : 0);
  extendedDimsHeader |= zPrecision << 2;
  extendedDimsHeader |= mPrecision << 5;
  out.writeByte(extendedDimsHeader);
}

// 可选：几何体长度（varint）
if (header.hasSize()) {
  writeUnsignedVarInt(header.geometryBodySize(), out);
}
```

字段含义：

| 字段 | 位数 | 含义 |
| --- | --- | --- |
| 几何类型 | 4 | 1=Point, 2=LineString, 3=Polygon, 4=MultiPoint, 5=MultiLineString, 6=MultiPolygon, 7=GeometryCollection |
| XY 精度 | 4（ZigZag 后） | 小数位数，范围 -7~7 |
| bbox 标志 | 1 | 是否带包络 |
| size 标志 | 1 | 是否带几何体长度 |
| id list 标志 | 1 | 是否带要素 ID 列表 |
| 扩展精度标志 | 1 | 是否带 Z/M |
| empty 标志 | 1 | 是否空几何 |
| Z 精度 | 3（在扩展字节里） | 0~7 |
| M 精度 | 3（在扩展字节里） | 0~7 |

### 7.5.3 一个真实的 TWKB 字节串

以 10×10 的矩形为例：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKBWriter;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.io.twkb.TWKBReader;
import org.locationtech.jts.io.twkb.TWKBWriter;

GeometryFactory gf = new GeometryFactory();
Geometry poly = new WKTReader(gf).read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");

byte[] twkb = new TWKBWriter().write(poly);
System.out.println("长度 = " + twkb.length);
System.out.println("十六进制 = " + WKBWriter.toHex(twkb));
System.out.println("读回 = " + new TWKBReader().read(twkb));
```

输出（本机实跑）：

```text
长度 = 32
十六进制 = E3080101050000008084AF5F0000008084AF5F00FF83AF5F000000FF83AF5F00
读回 = POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))
```

对比 WKB 的 93 字节，TWKB 只有 **32 字节（34%）**。因为默认 `GeometryFactory` 用的是 `CoordinateArraySequenceFactory`，`WKTReader` 造出来的坐标序列维度是 **3**（`CoordinateArraySequence` 的维度由坐标推断，默认字段值也是 3），所以这个几何的序列 `hasZ() == true`，头部会多一个 extendedPrecision 字节。验证方式：

```java
Geometry poly = new WKTReader(new GeometryFactory())
    .read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
System.out.println(((Polygon) poly).getExteriorRing()
    .getCoordinateSequence().hasZ());   // true
```

逐字节拆解：

```text
E3    <- 第1字节
        低 4 位 = 3  -> 几何类型 Polygon
        高 4 位 = E  -> ZigZag 编码后的精度：zigZagEncode(7) = (7<<1)^(7>>31) = 14 = 0xE
08    <- 第2字节（metadata）
        0b00001000 -> 仅 bit3 = extendedPrecision（无 bbox、无 size、非空）
01    <- 第3字节（扩展维度）
        bit0=1 -> hasZ；bit1=0 -> hasM；zPrecision=0；mPrecision=0
01    <- 环数 = 1
05    <- 点数 = 5
00    <- 第1点 X 增量
00    <- 第1点 Y 增量
00    <- 第1点 Z 增量
8084AF5F ...  <- 后续点的 X/Y/Z 增量，均为 varint
```

验算一下 `0xE3`：低 4 位 `3` 是 Polygon 的类型码；高 4 位 `0xE` = 14，反解 zigzag：`zigzagDecode(14) = (14 >> 1) = 7`，正是默认的 `xyPrecision = 7`。

再验算 `0x08`：按 7.5.2 的位定义，`0b00001000` 只有 bit3 置位，对应 `hasExtendedPrecision = true`——因为几何带了 Z。

> 提示：`TWKBWriter` 的默认 `xyPrecision` 是 7，所以不设参数时头部就是 `E3 xx 01 ...`。如果显式设 `setXYPrecision(2)`，高 4 位会变成 zigzag(2)=4，首字节变成 `43`——这也是判断“这个 TWKB 用了多少精度”的最快方式。

### 7.5.4 precision 参数：压缩率与精度的旋钮

`setXYPrecision(int)` 是 TWKB 最重要的参数：

- **正数 d**：保留 d 位小数（`116.397428` 在 d=6 时变成整数 `116397428`）；
- **0**：取整到个位；
- **负数 -d**：舍入到 10^d 位（比如 -1 表示十位）；
- 允许范围 **-7 ~ 7**。

```java
import java.util.ArrayList;
import java.util.List;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.io.WKBWriter;
import org.locationtech.jts.io.twkb.TWKBReader;
import org.locationtech.jts.io.twkb.TWKBWriter;

public class PrecisionImpact {

  public static void main(String[] args) throws Exception {
    GeometryFactory gf = new GeometryFactory();
    Coordinate[] pts = new Coordinate[1000];
    for (int i = 0; i < pts.length; i++) {
      pts[i] = new Coordinate(116.397428 + i * 1e-5, 39.90923 + i * 1e-5);
    }
    Geometry line = gf.createLineString(pts);

    int wkbLen = new WKBWriter().write(line).length;
    System.out.printf("WKB: %d 字节, %d 点%n", wkbLen, line.getNumPoints());

    for (int p : new int[] {7, 6, 5, 4}) {
      TWKBWriter w = new TWKBWriter();
      w.setXYPrecision(p);
      byte[] b = w.write(line);
      LineString rt = (LineString) new TWKBReader().read(b);
      System.out.printf("precision=%d: %5d 字节 (%5.1f%%), 读回 %d 点, 首点 %s%n",
          p, b.length, b.length * 100.0 / wkbLen, rt.getNumPoints(), rt.getCoordinateN(0));
    }
  }
}
```

输出（本机实跑）：

```text
WKB: 16009 字节, 1000 点
precision=7:  5011 字节 ( 31.3%), 读回 1000 点, 首点 (116.397428, 39.90923, 0.0)
precision=6:  3011 字节 ( 18.8%), 读回 1000 点, 首点 (116.397428, 39.90923, 0.0)
precision=5:  3011 字节 ( 18.8%), 读回 1000 点, 首点 (116.39743, 39.90923, 0.0)
precision=4:   613 字节 (  3.8%), 读回 201 点, 首点 (116.3974, 39.9092, 0.0)
```

这张表信息量很大：

- **precision=7**：压缩到 31%，精度 1e-7 度（约 1 厘米），坐标完全一致。
- **precision=6**：压缩到 19%，精度 1e-6 度（约 0.1 米），本样例坐标恰好没变（因为数据本身是 6 位）。
- **precision=5**：体积与 6 相同，但坐标已舍入（`116.39743`）——**体积不再下降是因为 delta 值仍在 2~3 字节区间**。
- **precision=4**：体积骤降到 3.8%，但**点数从 1000 掉到 201**！原因：精度降到 1e-4 度（约 11 米）后，相邻点的差值被量化成 0（重复坐标），TWKB 读取时会丢弃重复点。

**这是 TWKB 最危险的特性**：低精度不仅丢精度，还会**丢点、改变拓扑**。线可能被简化，面可能退化，多边形的洞可能消失。所以：

| 用途 | 建议 precision | 理由 |
| --- | --- | --- |
| 地图瓦片（zoom < 12） | 3~4 | 屏幕上看不出差别 |
| 地图瓦片（zoom 12~16） | 5~6 | 平衡 |
| 一般 Web 展示 | 6 | 约 0.1 米 |
| 地籍/管线 | 7 | 约 1 厘米 |
| 参与后续空间运算 | **不要用 TWKB** | 用 WKB |

### 7.5.5 bbox 与 size 标志

```java
TWKBWriter base = new TWKBWriter();
TWKBWriter withBbox = new TWKBWriter();
withBbox.setIncludeBbox(true);
TWKBWriter withSize = new TWKBWriter();
withSize.setIncludeSize(true);

Geometry poly = new WKTReader().read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
System.out.println("默认      = " + base.write(poly).length + " 字节");
System.out.println("带 bbox   = " + withBbox.write(poly).length + " 字节");
System.out.println("带 size   = " + withSize.write(poly).length + " 字节");
```

输出（本机实跑，二维矩形）：

```text
默认      = 32 字节
带 bbox   = 45 字节
带 size   = 34 字节
```

（bbox 增加 13 字节：4 个边界值 × 各 2~4 字节 varint；size 增加 2 字节。）

**什么时候开 bbox**：

- **批量传输**：接收端可以先读 bbox 做空间过滤，不必解码整个几何 → 显著加速。
- 单条记录、且接收端一定要解码 → 纯浪费。

**什么时候开 size**：

- **连续写多条 TWKB 到同一个流**：有 size 才能安全地“跳过不需要的记录”。这是 `TWKBWriter` 相对 `WKBWriter` 的一个关键优势（回忆第 6 章：裸 WKB 连写无法安全跳过）。
- 单独一条记录 → 不需要。

### 7.5.6 维度设置的“陷阱”

`TWKBWriter` 提供 `setEncodeZ(boolean)` 与 `setEncodeM(boolean)`，乍看像“维度开关”，但实测行为反直觉：

```java
GeometryFactory gf = new GeometryFactory();

// 情况 1：几何自带 Z，即使不调 setEncodeZ，也会编码 Z
Geometry gz = gf.createPoint(new Coordinate(1, 2, 3.456));
byte[] b1 = new TWKBWriter().write(gz);
System.out.println("Z几何不设开关 -> "
    + new WKTWriter(3).write(new TWKBReader().read(b1)));

// 情况 2：几何只有 XY，调了 setEncodeZ(true) 也只是写个 0
Geometry gxy = gf.createPoint(new Coordinate(1, 2));
TWKBWriter w = new TWKBWriter();
w.setEncodeZ(true);
byte[] b2 = w.write(gxy);
System.out.println("XY几何设Z开关 -> "
    + new WKTWriter(3).write(new TWKBReader().read(b2)));
```

输出（本机实跑）：

```text
Z几何不设开关 -> POINT Z(1 2 3)
XY几何设Z开关 -> POINT Z(1 2 0)
```

原因在 `TWKBWriter.setDimensions`：

```java
private static TWKBHeader setDimensions(Geometry g, TWKBHeader header) {
    if (g.isEmpty()) {
        return header.setHasZ(false).setHasM(false);
    }
    if (g instanceof Point) {
        return setDimensions(((Point) g).getCoordinateSequence(), header);
    }
    // ... LineString / Polygon 类似
}

private static TWKBHeader setDimensions(CoordinateSequence seq, TWKBHeader header) {
    boolean hasZ = seq.hasZ();
    boolean hasM = seq.hasM();
    return header.setHasZ(hasZ).setHasM(hasM);
}
```

**几何自身的维度会覆盖 `setEncodeZ`/`setEncodeM` 的设置**。所以：

- 想让 Z 进 TWKB，**先让几何真的有 Z**（用 `Coordinate(x,y,z)` 构造），而不是调开关。
- `setEncodeZ(true)` 对纯 XY 几何只会写入一堆 0，白白浪费空间。
- 同理，几何有 Z 而你想丢掉 Z，得先 `GeometryPrecisionReducer` 或手工降维，光靠不调开关没用。

### 7.5.7 TWKB 不携带 SRID

```java
Geometry g = new GeometryFactory().createPoint(new Coordinate(1, 2));
g.setSRID(4326);
byte[] b = new TWKBWriter().write(g);
System.out.println("读回 SRID = " + new TWKBReader().read(b).getSRID());
```

输出：

```text
读回 SRID = 0
```

TWKB 规范里没有 SRID 字段（这是它与 EWKB 的又一个差别）。SRID 必须由外部协议携带（数据库列定义、消息头、配置）。**不要指望 TWKB 帮你记住坐标系**。

---

## 7.6 三种格式的横向对比

### 7.6.1 体积实测

以 1000 个点的折线为例（本机实跑）：

| 格式 | 体积 | 相对 WKB | 精度 | 可读性 |
| --- | --- | --- | --- | --- |
| WKB | 16,009 字节 | 100% | 双精度无损 | 无 |
| TWKB precision=7 | 5,011 字节 | 31.3% | 1e-7 度（约 1 cm） | 无 |
| TWKB precision=6 | 3,011 字节 | 18.8% | 1e-6 度（约 0.1 m） | 无 |
| TWKB precision=4 | 613 字节 | 3.8% | 1e-4 度（约 11 m），**丢点** | 无 |
| GeoJSON（6 位小数） | 约 25,000 字节 | 约 156% | 6 位小数 | 高 |
| WKT（6 位小数） | 25,601 字节 | 160% | 6 位小数 | 高 |

（GeoJSON 体积为估算，实际取决于是否带 `properties` 与空白字符。第 6 章实测 WKT 6 位小数为 25,601 字节。）

### 7.6.2 能力矩阵

| 能力 | WKB | TWKB | GeoJSON |
| --- | --- | --- | --- |
| 精度无损 | ✅ | ❌（量化） | ❌（可配置小数位） |
| 保留 Z | ✅ | ✅ | ✅（第三位） |
| 保留 M | ⚠️（依赖实现） | ✅（需几何有 M） | ❌（M 变 Z） |
| 携带 SRID | ⚠️（仅 EWKB） | ❌ | ⚠️（`crs`，已废弃） |
| 携带属性 | ❌ | ❌ | ✅（Feature `properties`） |
| 可读性 | ❌ | ❌ | ✅ |
| 自带长度字段 | ❌ | ✅（可选） | ❌ |
| 自带 bbox | ❌ | ✅（可选） | ❌ |
| 标准库支持 | 全 | PostGIS/部分 | 全 |
| 前端友好 | ❌ | ❌ | ✅ |

### 7.6.3 选型决策树

```
需要传属性吗？
├── 是 → GeoJSON（Feature/FeatureCollection）
│         │
│         └── 属性里有几何坐标（M 值）吗？→ 有的话别塞坐标，放 properties
└── 否
    ├── 需要参与精确空间运算吗？
    │   ├── 是 → WKB
    │   └── 否
    │       ├── 传输/存储成本是瓶颈吗？
    │       │   ├── 是 → TWKB（precision 6~7）
    │       │   └── 否 → WKB（最省心）
    │       └── 前端需要直读吗？
    │           ├── 是 → GeoJSON
    │           └── 否 → WKB
    └── 只用于调试/日志？→ WKT（人可读）
```

一句话总结：**WKB 是“正确性优先”的默认选择，TWKB 是“成本优先”的优化手段，GeoJSON 是“Web 生态优先”的交换格式**。

### 7.6.4 组合使用的最佳实践

实际系统里三者经常同时出现，典型组合：

```
客户端 ──GeoJSON──> API 网关 ──WKB──> 微服务 A ──TWKB──> 缓存/瓦片服务
                                  └──WKT──> 日志/审计
```

- **对外接口**：GeoJSON（前端友好、可带属性）。
- **服务间传输**：WKB（无损、跨语言支持最好）。
- **缓存与瓦片**：TWKB（体积小、可带 bbox 加速过滤）。
- **日志与审计**：WKT（人可读、可 grep）。

注意边界处的**精度损失是单向的**：GeoJSON 量化 → WKB 无损 → TWKB 再量化。一旦经过 TWKB，就再也回不到双精度。所以**权威数据永远用 WKB 存**，TWKB 只做“派生物”。

---

## 7.7 jts-io-ora 与 jts-io-sde

### 7.7.1 定位

`modules/io` 下除了 `common`，还有两个“需要专有依赖”的模块：

| 模块 | artifactId | 依赖 | 用途 |
| --- | --- | --- | --- |
| `io/ora` | `jts-io-ora` | Oracle JDBC 驱动 | 读写 Oracle Spatial 的 `SDO_GEOMETRY` |
| `io/sde` | `jts-io-sde` | ArcSDE Java SDK | 读写 ArcSDE 几何 |

它们的共同特点是**默认不参与构建**，必须显式打开 profile：

```bash
mvn install -Poracle     # 构建 jts-io-ora
mvn install -Parcsde     # 构建 jts-io-sde
```

原因很简单：Oracle 驱动与 ArcSDE SDK 都不是开源可分发的依赖，不能放进 Maven 中央仓库。想用就必须自己把厂商的 jar 装进本地仓库。

### 7.7.2 什么时候需要它们

绝大多数 Java 项目**不需要**这两个模块：

- 用 PostGIS/MySQL/通用 JDBC → 用 WKB + `ST_GeomFromWKB` 就够了；
- 用 Hibernate Spatial → 它自己处理方言，不直接用这两个模块；
- 只有**直连 Oracle Spatial** 或**通过 ArcSDE 读写**时，才需要它们。

替代方案（更常用）：

| 场景 | 推荐做法 |
| --- | --- |
| Oracle Spatial | 用 `SDO_UTIL.TO_WKBGEOMETRY` 转 WKB，再用 JTS 的 `WKBReader` |
| ArcSDE | 升级到 ArcGIS 的 REST/Feature Service，或走 GeoTools 的 ArcSDE datastore |
| 通用数据库 | 只用 `jts-core` + WKB |

**结论**：把这两个模块当成“历史兼容层”，新项目不要依赖它们。

---

## 7.8 自定义格式扩展

### 7.8.1 什么时候需要自己写格式

JTS 提供 WKT/WKB/GeoJSON/TWKB 四种，覆盖了绝大多数场景。需要自己扩展的典型情况：

- **私有二进制协议**：需要在几何之外附带业务字段（时间戳、置信度、来源 ID），且要求单条记录自解释；
- **特定压缩算法**：比如按精度分层的多分辨率编码（类似地图瓦片）；
- **与既有系统对接**：对方有私有格式，只能用 JTS 做几何运算。

### 7.8.2 实现要点：两条路线

**路线一：基于 WKB 包装**

最简单也最稳：用 `WKBWriter` 把几何转成字节，再套一层自己的帧头。

```java
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.WKBReader;
import org.locationtech.jts.io.WKBWriter;

/**
 * 自定义帧格式：magic(2) + version(1) + srid(4) + geomLen(4) + geom(WKB) + attrLen(2) + attr(UTF-8)
 */
public class MyGeoFrame {

  private static final short MAGIC = (short) 0x4A54;   // "JT"
  private static final byte VERSION = 1;

  public static byte[] encode(Geometry geom, String attr) throws IOException {
    byte[] wkb = new WKBWriter(2, true).write(geom);
    byte[] attrBytes = attr == null
        ? new byte[0]
        : attr.getBytes(StandardCharsets.UTF_8);

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    DataOutputStream out = new DataOutputStream(baos);
    out.writeShort(MAGIC);
    out.writeByte(VERSION);
    out.writeInt(geom.getSRID());
    out.writeInt(wkb.length);
    out.write(wkb);
    out.writeShort(attrBytes.length);
    out.write(attrBytes);
    out.flush();
    return baos.toByteArray();
  }

  public static Geometry decodeGeometry(byte[] frame) throws IOException, ParseException {
    java.io.DataInputStream in = new java.io.DataInputStream(
        new java.io.ByteArrayInputStream(frame));
    short magic = in.readShort();
    if (magic != MAGIC) {
      throw new IOException("bad magic: " + Integer.toHexString(magic));
    }
    byte version = in.readByte();
    if (version != VERSION) {
      throw new IOException("unsupported version: " + version);
    }
    in.readInt();                            // srid（WKB 里已带，这里冗余存放便于快速读取）
    int geomLen = in.readInt();
    byte[] wkb = new byte[geomLen];
    in.readFully(wkb);
    return new WKBReader().read(wkb);
  }
}
```

这个格式的优点：**几何编码完全复用 JTS**，你只需要管帧结构与版本号；缺点：WKB 本身的体积与精度特性都继承下来。

**路线二：基于 TWKB 的思想自己实现量化编码**

如果体积是核心诉求，可以参考 TWKB 的做法（量化 + delta + varint），自己实现更贴合业务的编码。但要注意：

- 量化必然有损，要设计好“精度元数据”（存在帧头里）；
- delta 编码要求点有序，**必须先保证几何的顶点顺序稳定**；
- varint 实现容易出边界 bug（负数、大值），建议直接借鉴 `Varint` 的 ZigZag 方案。

**强烈建议**：除非确实需要，否则**不要在 WKB 之上再造一个通用几何格式**。优先用 TWKB（成熟、有规范、跨库），只在“必须带业务字段”时才做薄薄一层包装。

### 7.8.3 扩展时的三条纪律

| 纪律 | 原因 |
| --- | --- |
| 帧头必须带版本号 | 否则将来改结构无法兼容旧数据 |
| 必须带长度字段 | 否则无法跳过不认识的记录（参考 WKB 连写的教训） |
| 几何部分复用 JTS 的 coder | 自己实现几何编解码几乎一定会漏掉空几何/环闭合/ZM 等边界 |

---

## 7.9 常见问题与避坑

### 7.9.1 依赖与模块

**Q：`import org.locationtech.jts.io.geojson.GeoJsonReader` 编译不过。**
A：没引 `jts-io-common`，或 groupId 写错。注意它是 `org.locationtech.jts.io`，不是 `org.locationtech.jts`。

**Q：GeoJSON 相关类在 `jts-core` 里找不到。**
A：确认一下，GeoJSON/TWKB 只在 `jts-io-common`。`jts-core` 只有 WKT/WKB。

**Q：引了 `jts-io-common` 后跟项目里的 json 库冲突。**
A：`jts-io-common` 依赖 `json-simple`，它比较老但包名独立（`org.json.simple`），一般不会冲突。真冲突就 `<exclusions>` 掉，但要自己提供兼容实现——不建议。

**Q：TWKB 在 `jts-core` 里吗？**
A：不在，也在 `jts-io-common` 的 `io.twkb` 包。

### 7.9.2 GeoJSON 相关

**Q：输出的 GeoJSON 带 `crs` 字段，前端不认。**
A：`GeoJsonWriter` 默认 `isEncodeCRS = true`。加 `setEncodeCRS(false)`。参考 7.3.2。

**Q：输出的 `crs` 是 `EPSG:0`。**
A：几何的 SRID 是 0。要么给几何设 SRID，要么（更常见）关掉 CRS 输出。

**Q：GeoJSON 里的属性丢了。**
A：`GeoJsonReader` 只返回几何，属性必须自己解析。参考 7.4.2。

**Q：`coordinates:[1]` 这种明显缺坐标的数据居然解析成功。**
A：JTS 会补 0，得到 `POINT (1 0)`。必须自己做范围校验。参考 7.4.3。

**Q：GeoJSON 往返后 M 值变成了 Z。**
A：格式限制，GeoJSON 第三位约定是 Z。M 值放 `properties`。参考 7.4.5。

**Q：多边形方向不符合 RFC 7946。**
A：默认不强制。需要时 `setForceCCW(true)`。参考 7.3.4。

**Q：空几何输出成 `coordinates: []`，对方解析失败。**
A：这是 JTS 的约定，不是所有库都认。跨库时建议直接丢弃空几何，或在协议层标注。

### 7.9.3 TWKB 相关

**Q：TWKB 读回来的点少了。**
A：precision 太低导致相邻点量化后重合，被去重。提高精度，或不要用 TWKB 承载需要逐点还原的数据。参考 7.5.4。

**Q：`setEncodeZ(true)` 之后 Z 全是 0。**
A：几何本身没有 Z。TWKB 的维度由几何的 `CoordinateSequence` 决定，`setEncodeZ` 会被覆盖。参考 7.5.6。

**Q：TWKB 读回来 SRID 是 0。**
A：TWKB 不带 SRID，必须外部传。参考 7.5.7。

**Q：`setXYPrecision(8)` 抛异常。**
A：允许范围是 -7~7。TWKB 规范限制，超出无意义（双精度也只能表示到 ~15 位有效数字，经纬度场景 7 位已到厘米级）。

**Q：TWKB 能直接给前端用吗。**
A：不能。浏览器端没有成熟的 TWKB 解码库，前端请用 GeoJSON。

### 7.9.4 性能与选型

**Q：GeoJSON 太大，能压缩吗。**
A：HTTP 层用 gzip/br 压缩（GeoJSON 文本压缩率很高，通常 5~10 倍）。不要为了省流量自己改格式。

**Q：TWKB 比 WKB 小，为什么不全用 TWKB。**
A：因为有损。参与空间运算的数据必须是精确的，TWKB 只适合“展示与传输”。

**Q：批量传输用哪个。**
A：服务间用 WKB；需要跨网络省带宽且能接受精度损失时用 TWKB（带 bbox）；前端用 GeoJSON（gzip）。

**Q：一个请求里既要属性又要高精度几何怎么办。**
A：用 GeoJSON Feature 带属性，但几何部分改用 WKB 的十六进制字符串放在 `properties` 里（或分两个字段）。这是很多内部 API 的做法。

---

## 7.10 本章小结

- GeoJSON 与 TWKB 都在 `jts-io-common`（groupId `org.locationtech.jts.io`），`jts-core` 只有 WKT/WKB 且零运行时依赖。
- `GeoJsonWriter` **默认输出 `crs` 字段**（`isEncodeCRS = true`），生产代码几乎总要先 `setEncodeCRS(false)`。
- `decimals` 控制小数位（默认 8），是舍入不是截断；尾随 0 会被去掉，所以 6 位与 8 位可能输出相同。
- `setForceCCW(true)` 才会按 RFC 7946 的右手法则重排环方向，默认原样输出。
- `GeoJsonReader` 只返回几何，`Feature`/`FeatureCollection` 的属性全部丢弃；要属性请自己解析或改用 GeoTools。
- 默认构造器从 `crs` 取 SRID（无 crs 时按 4326），传了 `GeometryFactory` 则以工厂的 SRID 为准。
- **缺失坐标会补 0 而不报错**（`[1]` → `POINT (1 0)`），所以入口必须做坐标范围与有效性校验。
- GeoJSON 的第三位坐标约定是 Z，**M 值写出去会变成 Z**；M 必须放 `properties`。
- TWKB 用“量化 + delta + varint”压缩，实测 1000 点折线：precision=7 为 WKB 的 31%，precision=6 为 19%，precision=4 为 3.8% 但**丢点**。
- `precision` 越低不仅丢精度，还可能合并相邻点、改变拓扑；参与运算的数据不要用 TWKB。
- `setEncodeZ`/`setEncodeM` 会被几何自身的维度覆盖；TWKB 不携带 SRID。
- `bbox` 与 `size` 标志位在批量传输时很有价值：前者让接收端提前过滤，后者让接收端安全跳过。
- 选型口诀：正确性优先用 WKB，成本优先用 TWKB，Web 生态优先用 GeoJSON。

---

## 相关资源

- JTS 官方仓库：[https://github.com/locationtech/jts](https://github.com/locationtech/jts)
- RFC 7946（GeoJSON 规范）：[https://tools.ietf.org/html/rfc7946](https://tools.ietf.org/html/rfc7946)
- TWKB 规范：[https://github.com/TWKB/Specification/blob/master/twkb.md](https://github.com/TWKB/Specification/blob/master/twkb.md)
- PostGIS ST_AsTWKB 文档：[https://postgis.net/docs/ST_AsTWKB.html](https://postgis.net/docs/ST_AsTWKB.html)
- JTS Javadoc（`io.geojson`）：[https://locationtech.github.io/jts/javadoc/org/locationtech/jts/io/geojson/package-summary.html](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/io/geojson/package-summary.html)
- 本系列第 06 章（WKT 与 WKB 序列化）：[https://znlgis.github.io/gis/tutorial/jts/第06章-WKT与WKB序列化/](https://znlgis.github.io/gis/tutorial/jts/第06章-WKT与WKB序列化/)
- 本系列第 08 章（空间关系谓词与 DE-9IM）：[https://znlgis.github.io/gis/tutorial/jts/第08章-空间关系谓词与DE-9IM/](https://znlgis.github.io/gis/tutorial/jts/第08章-空间关系谓词与DE-9IM/)
- 本系列第 23 章（JTS 与上下游技术栈集成）：[https://znlgis.github.io/gis/tutorial/jts/第23章-JTS与上下游技术栈集成/](https://znlgis.github.io/gis/tutorial/jts/第23章-JTS与上下游技术栈集成/)

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/jts/第06章-WKT与WKB序列化/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/第08章-空间关系谓词与DE-9IM/" class="chapter-nav__next">下一章 →</a>
</div>

---
layout: default
title: 第01章 - JTS 概述与生态定位
---

# 第01章 - JTS 概述与生态定位

如果你在 Java 世界里处理过矢量几何，几乎不可能绕开 JTS。它是一个“只做几何”的库：没有地图渲染、没有坐标参考系、没有数据源访问，却支撑着 GeoServer、GeoTools、PostGIS 生态中大量的空间运算。很多开发者第一次接触它，是在某个 `Geometry.buffer()` 返回了奇怪的结果，或者某个 `TopologyException` 让批处理任务半夜挂掉之后。

本章的目的不是教你调用 API，而是先把“JTS 是什么、从哪里来、在整个 GIS 技术栈里站在什么位置、能做什么不能做什么”讲清楚。这些看似务虚的内容，直接决定了后面每一章的用法：为什么 JTS 的坐标不能直接算面积、为什么 1.20 版本要另起一套 RelateNG、为什么同一个 `union` 在不同版本里结果不同，答案都藏在它的定位与演进史里。

读完后你应该能够：向同事准确解释 JTS 的职责边界；根据项目需求选对版本与模块；判断一个问题该用 JTS 解决还是应该换工具；并跑通第一个既能编译又有实际意义的例子。前置知识只需要基本的 Java 语法和“经纬度坐标”的朴素概念，不要求 GIS 专业背景。

---

## 1.1 什么是 JTS

### 1.1.1 一句话定义

JTS（Java Topology Suite，Java 拓扑套件）是一个用 Java 编写的、用于创建与操作**矢量几何**的开源库。它实现 OGC Simple Features Specification（简单要素规范）定义的几何模型与空间谓词，提供几何构造、序列化、空间关系判断、叠加分析、缓冲区、化简、索引、三角剖分等一整套能力。

官方定位可以用它自己 README 里的一句话概括：

> The JTS Topology Suite is a Java library for creating and manipulating vector geometry.

注意这里的两个限定词：**vector geometry**（矢量几何）与 **manipulating**（操作）。它不是 GIS 平台，也不是地图引擎，而是一个被各种平台当作“几何计算内核”来调用的基础库。

### 1.1.2 “拓扑”二字的分量

名字里的 Topology 不是装饰。JTS 的核心价值不在于“能存点线面”，而在于能回答**几何之间的拓扑关系**并在此基础上做运算：

- 两个多边形是否相交、谁包含谁、边界是否接触；
- 两个面叠加后，交集是面、线还是点；
- 一条线是否自相交、一个多边形是否有孔洞嵌套；
- 对一批面做并集后，是否仍保持拓扑一致（无缝隙、无重叠）。

这些问题的答案必须与坐标的**精确值无关**，只与几何的**拓扑结构**有关。例如两个相邻地块共用一条边，即使公共边上的顶点顺序、重复点数量不同，`touches` 也应返回 `true`——这正是“拓扑”的含义，也是 JTS 内部要做节点化（noding）、精化（precision reduction）、鲁棒判定（robust predicate）的原因。后面第 8、9、18 章会反复回到这个主题。

### 1.1.3 一个 30 秒示例

先感受一下它有多“轻”。下面这段代码不涉及任何 GIS 数据文件，纯手工构造几何：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class FirstLook {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        Geometry a = reader.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
        Geometry b = reader.read("POLYGON ((5 5, 15 5, 15 15, 5 15, 5 5))");

        System.out.println("a 的面积: " + a.getArea());                 // 100.0
        System.out.println("a 与 b 相交: " + a.intersects(b));          // true
        System.out.println("交集面积: " + a.intersection(b).getArea()); // 25.0
        System.out.println("并集面积: " + a.union(b).getArea());        // 175.0
    }
}
```

运行这段代码只需要一个 jar 包：`jts-core`。它没有配置文件、没有数据库连接、没有初始化流程。这就是 JTS 的日常形态——一个纯粹的、无状态的（几何对象本身可重用，但操作无全局状态）计算库。也正因为如此，它可以被嵌进几乎任何 Java 程序：Web 服务、批处理、桌面客户端、Spark 任务，甚至 Android 应用。

### 1.1.4 JTS 不做什么

把边界说清楚，后面才不会误用：

| 能力 | JTS 是否提供 | 通常由谁提供 |
|------|--------------|--------------|
| 坐标参考系定义与投影转换 | 否 | GeoTools、Proj4J、PROJ |
| Shapefile / GeoJSON / GML 文件读写 | 部分（仅 WKT/WKB/GeoJSON/TWKB） | GeoTools、GDAL、自研解析 |
| 地图渲染与符号化 | 否 | GeoTools、SharpMap、前端地图库 |
| 栅格 / 影像处理 | 否 | GDAL、GeoTools coverage |
| 空间数据库访问 | 否 | JDBC + PostGIS、Hibernate Spatial |
| 拓扑编辑（共享边联动修改） | 否 | ArcGIS、QGIS、专业拓扑编辑工具 |
| 三维实体运算（布尔、体积） | 极有限 | 专业 CAD/三维内核（如 OCCT） |
| 几何算法本体 | **是** | —— |

一句话：**JTS 负责“算”，不负责“存、取、画、转”**。这四个字之外的活，都要交给别的库。第 19 章会用具体案例说明，忽略这条边界会付出什么代价。

---

## 1.2 历史与项目治理

理解一段历史，往往比读十页 API 文档更能解释“为什么代码长这样”。JTS 的包名、许可证、模块结构，都能在它的历史里找到原因。

### 1.2.1 起源：Vivid Solutions 的几何内核

JTS 最早由加拿大公司 Vivid Solutions 开发，核心作者是 Martin Davis（mdavis），最初以 `com.vividsolutions.jts` 包名发布，许可证为 LGPL。2001 年 5 月发布 0.0 版，2002 年 2 月发布 1.0 版，此后以大约每年一个版本的节奏演进。

早期 JTS 的另一个重要产物是 **JTS TestBuilder**：一个可交互的图形工具，能加载几何、执行任意 JTS 函数、对比结果、跑 XML 测试用例。它至今仍在仓库的 `modules/app` 里（见 1.6 节与第 2 章）。很多 JTS 的算法设计文档、规范讨论，都是围绕 TestBuilder 里的可视化结果展开的。

### 1.2.2 2016—2017：迁入 Eclipse LocationTech

2016/2017 年，Vivid Solutions 把项目捐献给 Eclipse 基金会下的 **LocationTech** 工作组（LocationTech 是 Eclipse 基金会的一个工业工作组，专注地理空间技术）。这次迁移带来三个实质变化，也是新手最容易踩坑的地方：

1. **包名变更**：`com.vividsolutions.jts.*` 变为 `org.locationtech.jts.*`。
2. **Maven 坐标变更**：groupId 从 `com.vividsolutions` 变为 `org.locationtech.jts`（io 模块为 `org.locationtech.jts.io`）。
3. **许可证变更**：从 LGPL 改为 **EPL 2.0 与 EDL 1.0 双许可**。

这次变更发生在 JTS 1.15 版本，官方在 `MIGRATION.md` 里给了两条 sed 命令用于批量替换：

```bash
git grep -l com.vividsolutions | grep pom.xml | xargs sed -i "s/com.vividsolutions/org.locationtech.jts/g"
git grep -l com.vividsolutions | xargs sed -i "s/com.vividsolutions/org.locationtech/g"
```

如果你接手的是一个 2017 年之前的老项目，看到依赖里写着 `com.vividsolutions:jts`，不要惊讶——那是 1.14 及更早的坐标。两者 API 高度相似，但**不能混用**：同一个类在两个包名下会被当成两个不同类，混用会导致 ClassCastException 或方法签名不匹配。

### 1.2.3 版本时间线

下表按官方 `doc/JTS_Version_History.md` 整理（截取 1.14 之后的部分，更早版本见文档）：

| 版本 | 发布时间 | 标志性变化 |
|------|----------|------------|
| 1.14 | 2015-09-23 | 迁入 LocationTech 前的最后一个 com.vividsolutions 版本 |
| 1.15 | 2017-11-30 | 包名改为 org.locationtech.jts；许可证改为 EPL 2.0 / EDL 1.0 |
| 1.16 | 2018-09-10 | 引入 XYZM 坐标访问（getZ/getM）；Z 字段弃用 |
| 1.17 | 2020-07-01 | 几何算法与性能改进 |
| 1.18 | 2020-12-23 | 引入 **OverlayNG** 新一代叠加引擎 |
| 1.19 | 2022-06-21 | 引入 PolygonTriangulator、OffsetCurve、TWKB、RelateNG 的前身工作 |
| 1.20 | 2024-09-18 | 引入 **RelateNG**、CoverageValidator/CoverageUnion/CoverageSimplifier、VariableBuffer |
| 1.21 | 开发中 | 本教程源码基线（1.21.0-SNAPSHOT），新增 CoverageCleaner、MinimumBoundingTriangle、DirectedHausdorffDistance 等 |

这张表不需要背，但有几个版本号必须记住：**1.15（包名分界）**、**1.18（OverlayNG）**、**1.20（RelateNG/Coverage）**。它们是网上大量代码片段“拷过来跑不通”的根源。

### 1.2.4 许可证：从 LGPL 到双许可

现在 JTS 采用双许可，任选其一：

- **EPL 2.0**（Eclipse Public License）：弱 copyleft，修改 JTS 源码再分发时需要开源修改部分，但仅仅链接使用不受影响。
- **EDL 1.0**（Eclipse Distribution License，即 Revised BSD / 3-clause BSD）：宽松许可，允许闭源分发，只需保留版权声明。

对绝大多数商业项目来说，选择 EDL 即可满足法务要求。官方 `FAQ-LICENSING.md` 里还区分了两种下游形态：**Downstream projects**（链接 JTS 的项目，如 GeoTools、GeoServer）与 **Derivative projects**（移植到其他语言的衍生项目，如 GEOS、JSTS）。这两种形态的合规义务不同，做产品前值得读一遍原文（链接见本章末尾）。

### 1.2.5 社区与沟通渠道

JTS 的社区规模不大但非常稳定，主要渠道：

- **GitHub 仓库**：`locationtech/jts`，issue 与 PR 都在这里；
- **邮件列表**：`jts-dev`（Eclipse 基金会托管），设计讨论主要发生地；
- **Javadoc**：`https://locationtech.github.io/jts/javadoc`，查类与方法的权威入口；
- **Stack Overflow / GIS Stack Exchange**：日常问答，标签 `jts` 与 `jts-topology-suite`。

一个实用提示：JTS 的 Javadoc 在很多类上写得相当克制，遇到“这个方法到底怎么算”的问题，与其在搜索引擎里翻旧博客，不如直接看源码——第 21 章会系统地讲怎么读。

---

## 1.3 JTS 与 OGC Simple Features

### 1.3.1 几何模型的标准来源

OGC（Open Geospatial Consortium）的 **Simple Features Specification** 定义了一套与具体编程语言无关的几何模型：

- 几何类型：Point、LineString、LinearRing、Polygon、MultiPoint、MultiLineString、MultiPolygon、GeometryCollection；
- 每个几何都有 **Dimension**（0 点、1 线、2 面）、**Boundary**（边界）、**Interior**（内部）、**Exterior**（外部）；
- 几何必须满足有效性约束（例如多边形环必须闭合、不能自相交）。

JTS 的类层次几乎是这份规范的逐条翻译：

```
                     Geometry (abstract)
                            │
        ┌───────────┬───────┴────────┬──────────────┐
        │           │                │              │
      Point    LineString     Polygon        GeometryCollection
                    │                              │
              LinearRing              ┌────────────┼────────────┐
                                      │            │            │
                                 MultiPoint  MultiLineString  MultiPolygon
```

其中 `LinearRing` 是 `LineString` 的子类但限制了“必须闭合”；三个 `Multi*` 又都是 `GeometryCollection` 的子类。这个设计带来一个常见困惑：**判断几何类型不能用 `instanceof GeometryCollection`**，因为 `MultiPolygon` 也会命中。正确做法是看 `getGeometryType()` 或使用 `getNumGeometries()/getGeometryN()` 的通用接口。第 4 章会详细展开这套模型。

### 1.3.2 DE-9IM：空间关系的通用语言

两个几何之间的关系，OGC 用 **DE-9IM**（Dimensionally Extended Nine-Intersection Model）来描述：把两个几何各自的 Interior、Boundary、Exterior 两两求交，得到 3×3 共 9 个交集的维度（-1 表示空，0/1/2 表示点/线/面）。这个 9 元组就是两个几何的“关系指纹”。

JTS 提供两套接口：

- 命名谓词：`intersects`、`contains`、`within`、`touches`、`crosses`、`overlaps`、`covers`、`coveredBy`、`disjoint`、`equalsTopo`；
- 底层矩阵：`relate()` 返回 `IntersectionMatrix`，可取出 9 个维度值，也可以传入形如 `"T*F**F***"` 的模式做匹配。

例如“A 包含 B”的 DE-9IM 模式是 `T*****FF*`。命名谓词本质上就是预设的模式匹配，只是更快、更易读。第 8 章会完整讲这套理论，并说明 1.20 引入的 RelateNG 与旧 RelateOp 的差异。

### 1.3.3 与 WKT/WKB/GeoJSON 的关系

规范不仅定义了模型，也定义了交换格式。JTS 支持其中的主要几种：

| 格式 | 规范来源 | JTS 支持类 | 所在模块 |
|------|----------|-----------|----------|
| WKT（Well-Known Text） | OGC SFA | WKTReader / WKTWriter | jts-core |
| WKB（Well-Known Binary） | OGC SFA | WKBReader / WKBWriter | jts-core |
| GeoJSON | RFC 7946 | GeoJsonReader / GeoJsonWriter | jts-io-common |
| TWKB（Tiny WKB） | 社区规范 | TWKBReader / TWKBWriter | jts-io-common |
| GML | OGC GML | 不直接支持（GeoTools 提供） | —— |

注意一个容易记错的点：**WKT/WKB 的读取类在 `jts-core` 的 `org.locationtech.jts.io` 包里，而不是在 `jts-io-common` 模块里**。`jts-io-common` 只提供 GeoJSON 与 TWKB（以及部分 WKB 辅助工具）。这是很多人配依赖时踩过的坑：只想读 WKT，却引了一堆用不到的 json 相关类，或者反过来以为引了 core 就能读 GeoJSON。

### 1.3.4 实现覆盖度

JTS 对 SFA 的覆盖相当完整，但也不是 100%：

- **完整实现**：全部 8 种几何类型、基本谓词、叠加、缓冲区、简化、有效性检查；
- **部分实现**：曲线类型（CircularString、CompoundCurve、CurvePolygon）——JTS 不支持曲线，读入时会报错或需要预先把曲线离散化；3D 仅支持坐标携带 Z，运算基本在 2D 平面进行；
- **未实现**：拓扑要素模型（TopoFeature）、覆盖（Coverage）的完整编辑语义（1.20 起有 CoverageValidator 等校验工具，但不是编辑工具）。

因此，当你的数据里有圆弧、三维实体或拓扑规则时，要提前规划转换路径，不要等跑到一半才发现 JTS 不支持。

---

## 1.4 技术谱系：GEOS、NTS、JSTS 与 Shapely

### 1.4.1 一张家族树

JTS 的影响力远超“一个 Java 库”。它的算法被反复移植，形成了一个事实标准：

```
                        JTS (Java, 2001-)
                              │
        ┌─────────────────────┼────────────────────────┐
        │                     │                        │
      GEOS (C++)          JSTS (JavaScript)      NetTopologySuite (.NET)
        │ 2003-               2012-                    2011-
        │
        ├── Shapely (Python wrapper) 2007-
        ├── rgeos / sf (R) 
        ├── GEOSwift (Swift)
        ├── rgeo (Ruby)
        └── 大量 C/C++/Go/Rust 绑定
```

这张图解释了一个常见现象：你在 PostGIS 里写的 `ST_Buffer`、在 GeoServer 里配的样式、在 Python 里用的 `shapely.buffer`，底层很可能跑的是同一套算法（PostGIS 用 GEOS，Shapely 用 GEOS，GEOS 是 JTS 的 C++ 移植）。因此它们的**结果在数学期望上应当一致**，但浮点实现、精度模型、默认参数不同，边界情况可能仍有差异。

### 1.4.2 各实现对比

| 实现 | 语言 | 与 JTS 关系 | 典型用途 | 许可证 |
|------|------|-------------|----------|--------|
| JTS | Java | 本源 | Java 服务端、GeoTools/GeoServer | EPL 2.0 / EDL 1.0 |
| GEOS | C++ | 手工移植，算法同步跟进 | PostGIS、QGIS、GDAL、Shapely | LGPL 2.1 |
| NetTopologySuite | C# | 手工移植，API 风格贴近 | .NET GIS、EF Core 空间扩展 | BSD 3-Clause |
| JSTS | JavaScript | 手工移植 | 浏览器端几何运算 | EPL 2.0 / EDL 1.0 |
| Shapely | Python | GEOS 的 Python 封装 | 数据科学、脚本 | BSD 3-Clause |
| dart_jts | Dart | 移植 | Flutter 地图应用 | —— |
| KTS | Kotlin | JTS 的 Kotlin 多平台移植 | 跨平台 | —— |

本博客的 GIS 教程栏目里，NetTopologySuite 与 Shapely 两套教程可以和本系列对照阅读：**API 名称会变，算法语义不变**——理解了 JTS 的 DE-9IM 与叠加引擎，再看 NTS 或 Shapely 会非常轻松。

### 1.4.3 为什么会有这么多移植

原因有三：

1. **语言生态壁垒**：Java 服务端需要 JVM 库，C++ 需要零开销的原生库，前端需要 JS 库，无法共享同一份代码；
2. **许可证兼容性**：JTS 的 EDL 允许闭源使用，但 GEOS 因历史原因选了 LGPL，PostGIS 等项目的选择又反过来影响了生态；
3. **性能与部署形态**：浏览器、移动端对包体积与启动时间敏感，需要更轻的实现。

移植的代价是**行为一致性维护**：JTS 修了一个 overlay 的边界 bug，GEOS/NTS 要各自跟进。这也是为什么这些项目在 issue 里经常引用 JTS 的 PR 编号。作为使用者，遇到“同样是 buffer，PostGIS 和 Shapely 结果不同”的问题时，先查两边的 GEOS/JTS 版本，往往就真相大白了。

---

## 1.5 下游生态：谁在用 JTS

### 1.5.1 主要下游项目

| 下游项目 | 角色 | 使用方式 |
|----------|------|----------|
| GeoTools | Java GIS 工具包 | 直接依赖，几何层完全用 JTS |
| GeoServer | 地图/要素服务器 | 通过 GeoTools 使用 JTS |
| GeoWebCache | 瓦片缓存 | 几何裁剪 |
| Hibernate Spatial | ORM 空间扩展 | 几何类型与谓词 |
| Elasticsearch / OpenSearch | 搜索引擎 | 空间查询的几何计算 |
| Apache Sedona (原 GeoSpark) | 分布式空间分析 | 几何运算 |
| JTS TestBuilder | 交互测试工具 | 自带 |
| 各类 ETL 工具（GeoKettle、自研） | 空间数据处理 | 几何转换、校验 |

### 1.5.2 在 GeoServer / GeoTools 中的位置

一条 WMS 请求在 GeoServer 内部大致这样流动（简化）：

```
HTTP 请求
   │
   ▼
GeoServer (服务层)  ─── WMS/WFS/WCS 协议解析
   │
   ▼
GeoTools (数据层)   ─── 要素读取、CRS 转换、样式渲染
   │
   ▼
JTS (几何层)        ─── 几何裁剪、buffer、简化、有效性
   │
   ▼
数据源 (PostGIS/Shapefile/...)
```

这解释了为什么 GeoTools 教程第 4 章专门讲“几何对象与 JTS 集成”：GeoTools 自己不实现几何算法，它把 CRS、要素、样式这些“GIS 概念”包在 JTS 的“几何数字”外面。**JTS 是地基，GeoTools 是楼层**。

### 1.5.3 数据库与大数据栈

- **PostGIS**：不依赖 JTS，而是依赖 GEOS（JTS 的 C++ 移植）。所以 PostGIS 的 `ST_Union` 与 JTS 的 `union` 语义一致，但版本更新节奏不同。
- **Elasticsearch/OpenSearch**：内置 JTS 做空间查询的几何计算（geo_shape 的相交、包含判断）。
- **Apache Sedona**：用 JTS 在 Spark 分区内做几何运算，再自己处理分布式聚合。
- **Flink/Beam 空间扩展**：类似思路，JTS 负责单机几何，框架负责分布式调度。

### 1.5.4 在技术栈中的位置

用一张分层图收束本节：

```
┌──────────────────────────────────────────────────────┐
│ 应用层：WebGIS 前端、桌面端、业务系统                  │
├──────────────────────────────────────────────────────┤
│ 服务层：GeoServer、自研 REST 服务、Spark 作业          │
├──────────────────────────────────────────────────────┤
│ GIS 工具层：GeoTools、Hibernate Spatial、Sedona       │
│  （负责：CRS、数据源、要素、样式、序列化）              │
├──────────────────────────────────────────────────────┤
│ 几何内核层：JTS / GEOS / NTS / JSTS                   │
│  （负责：几何模型、谓词、叠加、缓冲、索引、三角剖分）    │
├──────────────────────────────────────────────────────┤
│ 数据层：PostGIS、Shapefile、GeoJSON、对象存储          │
└──────────────────────────────────────────────────────┘
```

认清自己站在哪一层，是选型与排障的第一步。业务代码里直接调 JTS 完全没问题，但一旦涉及 CRS 转换、数据读取，就应该往上借一层工具，而不是自己重造。

---

## 1.6 架构总览与模块划分

### 1.6.1 Maven 多模块结构

JTS 仓库是一个标准的 Maven 多模块工程，根目录只有一个父 POM：

```
jts/
├── pom.xml                 父 POM（groupId: org.locationtech.jts）
├── build-tools/            构建期工具（PMD/Checkstyle 规则等）
└── modules/
    ├── core/               jts-core：几何模型、算法、索引
    ├── io/
    │   ├── common/         jts-io-common：GeoJSON、TWKB、WKB 辅助
    │   ├── ora/            jts-io-ora：Oracle 读写（需 -Poracle）
    │   └── sde/            jts-io-sde：ArcSDE 读写（需 -Parcsde）
    ├── app/                jts-app：TestBuilder 图形工具
    ├── tests/              jts-tests：XML 测试套件与 TestRunner
    ├── example/            jts-example：示例代码
    └── lab/                jts-lab：实验性算法（非稳定 API）
```

### 1.6.2 模块职责与依赖

| 模块 | 产物 | 主要内容 | 是否需要 | 稳定性 |
|------|------|----------|----------|--------|
| core | jts-core | Geometry 体系、谓词、叠加、buffer、索引、io(WKT/WKB) | 必须 | 稳定 |
| io/common | jts-io-common | GeoJSON、TWKB | 按需 | 稳定 |
| io/ora | jts-io-ora | Oracle SDO_GEOMETRY 读写 | 按需 | 稳定（需专有依赖） |
| io/sde | jts-io-sde | ArcSDE 读写 | 按需 | 稳定（需专有依赖） |
| app | jts-app | TestBuilder GUI | 开发调试 | 工具 |
| tests | jts-tests | XML 测试与 TestRunner | 贡献/验证 | 工具 |
| example | jts-example | 示例 | 学习 | 示例 |
| lab | jts-lab | 实验算法 | 尝鲜 | **不稳定** |

实际项目里，99% 的场景只需要一个依赖：

```xml
<dependency>
    <groupId>org.locationtech.jts</groupId>
    <artifactId>jts-core</artifactId>
    <version>1.20.0</version>
</dependency>
```

要处理 GeoJSON 再加 `jts-io-common`（groupId 是 `org.locationtech.jts.io`，别写错）。注意不要同时引两个不同版本的 jts-core，Maven 的“最近优先”仲裁可能让你在不知不觉中降级。

### 1.6.3 包结构地图

`jts-core` 的源码根包是 `org.locationtech.jts`，直接子包按职责划分：

| 包 | 职责 | 代表类 |
|----|------|--------|
| geom | 几何模型与工厂 | Geometry、GeometryFactory、Coordinate、Envelope |
| geom/impl | CoordinateSequence 实现 | CoordinateArraySequence、PackedCoordinateSequence |
| geom/prep | 预处理几何（加速谓词） | PreparedGeometry、PreparedGeometryFactory |
| geom/util | 几何编辑与提取工具 | GeometryEditor、GeometryFixer、AffineTransformation |
| algorithm | 基础算法 | Distance、Centroid、ConvexHull、RobustLineIntersector |
| algorithm/hull | 凹包 | ConcaveHull、ConcaveHullOfPolygons |
| algorithm/distance | 距离度量 | DiscreteHausdorffDistance、DirectedHausdorffDistance |
| algorithm/locate | 点在面内定位 | IndexedPointInAreaLocator |
| algorithm/construct | 构造类算法 | MaximumInscribedCircle、LargestEmptyCircle |
| algorithm/match | 匹配 | （几何匹配） |
| index | 空间索引 | STRtree、Quadtree、HPRtree、KdTree |
| io | 序列化 | WKTReader、WKBReader、WKTWriter |
| noding | 节点化 | MCIndexNoder、SnapRoundingNoder |
| operation | 运算总目录 | buffer、overlay、overlayng、relate、relateng、valid、union、distance、polygonize、linemerge |
| triangulate | 三角剖分 | DelaunayTriangulationBuilder、VoronoiDiagramBuilder |
| linearref | 线性参考 | LengthIndexedLine、LocationIndexedLine |
| simplify | 化简 | DouglasPeuckerSimplifier、TopologyPreservingSimplifier |
| precision | 精度处理 | PrecisionModel、GeometryPrecisionReducer |
| coverage | 覆盖质检 | CoverageValidator、CoverageUnion、CoverageSimplifier |
| math | 数值工具 | DD（双精度双倍）、MathUtil |
| util | 杂项 | Assert、GeometricShapeFactory |

这张表在后面的章节里会被反复引用，建议先有个印象：**看到需求，先想它属于哪个包**，比盲搜 Javadoc 快得多。

### 1.6.4 双引擎：overlay 与 overlayng

一个必须提前知道的事实：JTS 内部**同时存在两套叠加引擎**：

- `org.locationtech.jts.operation.overlay`：2001 年以来的经典实现，基于 geomgraph；
- `org.locationtech.jts.operation.overlayng`：1.18 引入的新一代实现，基于标签化的边图（OverlayLabel/OverlayGraph）。

更反直觉的是：**截至 1.21.0-SNAPSHOT，高层 API（`Geometry.union` 等）默认仍然走旧引擎**。`GeometryOverlay.OVERLAY_NG_DEFAULT` 的值为 `false`，要切换到新引擎，需要设系统属性：

```bash
java -Djts.overlay=ng -cp ... YourApp
```

或者显式调用新引擎的 API：

```java
import org.locationtech.jts.operation.overlayng.OverlayNGRobust;

Geometry result = OverlayNGRobust.overlay(a, b, OverlayNG.INTERSECTION);
```

同理，关系谓词有 `jts.relate=ng` 开关（`GeometryRelate.RELATE_NG_DEFAULT = false`），1.20 引入的 RelateNG 也尚未成为默认。为什么要“两套并存、慢慢切换”？因为 JTS 有海量下游，任何一个算法行为的改变都可能破坏别人的生产结果，所以新引擎先以可选方式放出，经过若干版本验证后再转正。第 9 章会深入对比两者，这里只需记住：**默认值可能是“旧”的，遇到结果异常先确认引擎**。

### 1.6.5 设计原则

读 JTS 源码时，会反复看到四种设计模式，认识它们能大幅降低阅读成本：

1. **工厂模式**：`GeometryFactory` 统一创建几何，管理 SRID、PrecisionModel、CoordinateSequenceFactory。所有几何都持有对自己的工厂的引用（`getFactory()`），做运算时结果会沿用同一个工厂。
2. **访问者模式**：`GeometryFilter`、`CoordinateSequenceFilter`、`ItemVisitor`（索引查询）都是访问者。好处是遍历逻辑与业务逻辑解耦，坏处是写起来啰嗦。
3. **不变式与复制语义**：几何对象不是严格不可变，但 JTS 的约定是“运算返回新对象，不修改输入”。例如 `a.union(b)` 不会改变 `a`、`b`。这一点在写批处理时非常重要——可以放心复用输入对象。
4. **门面（Facade）**：`Geometry` 上的 `union`、`buffer`、`intersects` 等方法，内部会转发到 `operation` 包的实现类。所以“看 Geometry 的 API”只是入口，“看 operation 的实现”才是真相。

---

## 1.7 1.15 ~ 1.21 版本演进与选型建议

### 1.7.1 关键特性时间线

| 版本 | 新特性 | 对使用者的影响 |
|------|--------|----------------|
| 1.15 | 包名/许可证变更 | 老代码要改 import |
| 1.16 | XYZM 坐标访问 | Z 字段弃用，改用 getZ()/getM() |
| 1.18 | OverlayNG | 可选新引擎，鲁棒性更好 |
| 1.19 | PolygonTriangulator、OffsetCurve、TWKB | 三角剖分与偏移曲线进入稳定 API |
| 1.20 | RelateNG、CoverageValidator/CoverageUnion/CoverageSimplifier、VariableBuffer | 关系判断新引擎、覆盖数据质检工具链 |
| 1.21（开发中） | CoverageCleaner、MinimumBoundingTriangle、DirectedHausdorffDistance、KdTree 最近邻 | 覆盖清理、三角形最小包围、有向豪斯多夫距离 |

### 1.7.2 1.18：OverlayNG 的意义

旧叠加引擎有个著名问题：在极端坐标（极大、极小、共线、几乎重合）下可能抛出 `TopologyException`，或者产生自相交的结果。OverlayNG 的设计目标就是**在保持结果一致的前提下提升鲁棒性与性能**：它把输入先做精度归约（snap-rounding），再用标签化的边图计算，避免旧引擎中“边图重建”的脆弱环节。

但要注意：**OverlayNG 不是默认引擎**（见 1.6.4）。如果你的项目需要它，做法有三种：

```java
// 方式一：全局系统属性（启动参数）
// java -Djts.overlay=ng ...

// 方式二：显式调用
Geometry r1 = OverlayNGRobust.overlay(a, b, OverlayNG.UNION);

// 方式三：在关键路径上包装一层，按业务场景选择
```

第 9 章会给出“什么时候该切、怎么验证结果没变”的完整方法论。

### 1.7.3 1.19：三角剖分、偏移曲线与 TWKB

1.19 是“功能性”很强的一个版本：

- `PolygonTriangulator` / `ConstrainedDelaunayTriangulator`：把多边形剖分成三角形，做 TIN、有限元、渲染都靠它（第 15 章）；
- `OffsetCurve`：生成线的偏移曲线（单侧缓冲的“线”版本），道路中心线偏移、河道蓝线常用（第 10 章）；
- `TWKBReader/Writer`：紧凑二进制格式，适合移动端与传输量敏感场景（第 7 章）。

### 1.7.4 1.20：RelateNG 与 Coverage

1.20 有两个方向：

1. **RelateNG**：新一代关系判断引擎，接口更简洁（`RelateNG.relate(a, b, pattern)`），并修复了旧引擎在 GeometryCollection、精度边界上的若干问题。
2. **Coverage 工具链**：`CoverageValidator`（校验覆盖数据的缝隙与重叠）、`CoverageUnion`（保持覆盖结构的并集）、`CoverageSimplifier`（覆盖化简）、`CoverageGapFinder`、`CoverageCleaner`（1.21）。这套工具对地籍、行政区、国土调查等“无缝无叠”数据质检是刚需（第 17 章）。

### 1.7.5 1.21：正在发生的演进

1.21 尚在开发（`1.21.0-SNAPSHOT`），但已能看到方向：

- `CoverageCleaner`：自动清理覆盖数据中的小缝隙/重叠；
- `MinimumBoundingTriangle`：最小包围三角形（此前只有最小包围圆、最小面积矩形）；
- `DirectedHausdorffDistance`：有向豪斯多夫距离，轨迹相似度常用；
- `KdTree.nearestNeighbor/nearestNeighbors`：KD 树的最近邻查询补全；
- 大量鲁棒性修复（`RelateNG` 缓存、`BufferOp` 环腐蚀启发式、`Quadrant` 计算鲁棒性等）。

生产项目不要直接用 SNAPSHOT，但如果新特性正好解决你的痛点，可以查看对应的 issue/PR，判断它何时进入下一个正式版。

### 1.7.6 版本选型建议

| 场景 | 建议版本 | 理由 |
|------|----------|------|
| 新项目、无历史包袱 | 1.20.0（最新正式版） | 稳定 + RelateNG/Coverage 可用 |
| 老项目升级 | 先升到 1.20.0，再做回归测试 | 1.15 之后的 API 基本兼容 |
| 需要 1.21 新特性 | 1.21 正式版发布后再用 | SNAPSHOT 不适合生产 |
| 与 GeoTools/GeoServer 集成 | 跟随其依赖版本 | 避免几何类冲突 |
| 只需要基础几何 | 1.19+ 均可 | 核心 API 多年稳定 |

---

## 1.8 最重要的工程约束：JTS 不含坐标系

### 1.8.1 只认坐标数字

这是初学者最常犯、后果最严重的误解。**JTS 的几何对象里没有“坐标系”这个概念**。`Geometry.setSRID(int)` 只是给几何挂了一个整数标签，JTS 内部**不会**用它做任何转换，也不会因为 SRID 不同而拒绝运算。

因此下面这段代码在 JTS 看来完全合法：

```java
Geometry beijing = reader.read("POINT (116.4 39.9)");        // 经纬度
Geometry local  = reader.read("POINT (500000 4400000)");     // 投影坐标
System.out.println(beijing.distance(local));                 // 会算出一个没有意义的数
```

JTS 会老老实实按平面直角坐标系做欧氏距离计算，得到约 440 万——这个数字既不是米也不是度，纯粹是“两个坐标差的平方和开方”。

### 1.8.2 SRID 只是标签

`setSRID` 的真实用途只有两个：

1. **序列化时携带**：WKB 写入时可以带 SRID（EWKB 风格），读回来还原；
2. **下游框架识别**：GeoTools 等框架会读取 SRID 来决定是否需要投影转换。

它绝不会让 `getArea()` 的单位从“平方度”变成“平方米”。记住这句话：**SRID 是名片，不是转换器**。

### 1.8.3 度与米：一个尖锐的对比

用经纬度直接算面积，误差有多大？取北京附近一个约 1km × 1km 的区域：

```java
// 经纬度坐标（WGS84），1 度纬度约 111km，1 度经度在北纬 40° 约 85km
Geometry degBox = reader.read(
    "POLYGON ((116.40 39.90, 116.41 39.90, 116.41 39.91, 116.40 39.91, 116.40 39.90))");
System.out.println(degBox.getArea());   // 0.0001（单位：平方度）

// 相同区域投影到 Web Mercator 后（近似值）
System.out.println(degBox.getArea() * 111000 * 85000); // 约 943,500,000，单位已混乱
```

正确做法是**先把几何投影到米制坐标系，再做面积/长度/距离计算**。JTS 本身不提供投影能力，所以这个“先投影”的动作要么在数据入库前完成，要么借助 GeoTools/Proj4J 完成（第 19 章给出完整方案）。

### 1.8.4 三种解决方案

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| 预投影 | 数据入库/加载前统一转成米制投影 | 运行时零开销，逻辑最简单 | 需要确定投影带；跨带区域难处理 |
| 运行时转换 | 用 GeoTools CRS.findMathTransform 逐几何转换 | 灵活 | 引入较重依赖，有性能开销 |
| 近似计算 | 用球面公式估算长度/面积 | 依赖轻 | 仅适合粗略统计，不能替代真实几何运算 |

本教程后续章节默认：**几何运算在平面投影坐标下进行**，涉及经纬度时会显式提醒。第 19 章会把这条约束展开成一份工程检查清单。

---

## 1.9 JTS 擅长什么、不擅长什么

### 1.9.1 擅长清单

- **空间关系判断**：相交、包含、接触、覆盖、DE-9IM 矩阵；
- **叠加分析**：并、交、差、对称差，支持面/线/点混合；
- **缓冲区**：点线面缓冲、单侧缓冲、可变距离缓冲、负缓冲；
- **几何清理与修复**：有效性检查、GeometryFixer 修复、覆盖数据质检；
- **距离与度量**：欧氏距离、索引加速距离、豪斯多夫距离、弗雷歇距离；
- **化简与概括**：道格拉斯-普克、拓扑保持化简、VW 化简、覆盖化简；
- **空间索引**：STRtree、Quadtree、HPRtree、KdTree；
- **三角剖分与 Voronoi**：Delaunay、约束 Delaunay、Voronoi、多边形三角剖分；
- **线性参考**：里程定位、线段截取、沿线插值；
- **序列化**：WKT、WKB、GeoJSON、TWKB。

### 1.9.2 不擅长（或不该用）

| 需求 | 为什么不适合 | 建议 |
|------|--------------|------|
| 坐标系转换 | 不提供 | GeoTools、Proj4J、PROJ |
| 大量要素的存储与查询 | 无持久化与索引存储 | PostGIS、Elasticsearch |
| 地图渲染 | 无渲染能力 | GeoTools、前端地图库 |
| 三维实体布尔运算 | 运算在 2D 平面，Z 仅携带 | OCCT、CGAL、专业 CAD 内核 |
| 超大几何（百万级顶点） | 内存与算法复杂度受限 | 分块、简化、GeoSpark/Sedona |
| 字符串/属性数据处理 | 与几何无关 | 普通 Java 集合或数据库 |
| 实时高频小几何运算 | 对象创建开销 | 对象池、预处理几何、缓存 |

### 1.9.3 与替代方案对照

| 需求 | JTS | GEOS/PostGIS | 专业三维内核 |
|------|-----|--------------|--------------|
| 2D 几何运算 | ★★★★★ | ★★★★★ | ★★ |
| 3D 实体 | ★ | ★ | ★★★★★ |
| 曲线支持 | ★ | ★★ | ★★★★★ |
| 坐标系 | ☆ | ★★★★ | ★★★ |
| 分布式 | ☆ | ★★★ | ☆ |

（★ 越多越强，☆ 表示不具备）

---

## 1.10 第一个完整程序：从 WKT 到缓冲区

### 1.10.1 环境准备

最小依赖只需要 `jts-core` 一个 jar。用 Maven 的话：

```xml
<properties>
    <jts.version>1.20.0</jts.version>
</properties>

<dependency>
    <groupId>org.locationtech.jts</groupId>
    <artifactId>jts-core</artifactId>
    <version>${jts.version}</version>
</dependency>
```

下载 jar 手动运行也可以，但推荐用 Maven/Gradle，便于管理版本与传递依赖（jts-core 本身几乎无外部依赖，这是它的一大优点）。

### 1.10.2 完整代码

下面的例子覆盖了 JTS 最常见的四件事：解析、校验、运算、序列化。

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.operation.valid.IsValidOp;
import org.locationtech.jts.operation.valid.TopologyValidationError;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.io.WKTWriter;

public class HelloJts {
    public static void main(String[] args) throws Exception {
        GeometryFactory factory = new GeometryFactory();
        WKTReader reader = new WKTReader(factory);
        WKTWriter writer = new WKTWriter();

        // 1. 解析
        Geometry plot = reader.read(
            "POLYGON ((116.40 39.90, 116.41 39.90, 116.41 39.91, 116.40 39.91, 116.40 39.90))");
        System.out.println("类型: " + plot.getGeometryType());
        System.out.println("顶点数: " + plot.getNumPoints());

        // 2. 校验
        IsValidOp validOp = new IsValidOp(plot);
        if (!validOp.isValid()) {
            TopologyValidationError err = validOp.getValidationError();
            System.out.println("无效: " + err.getMessage() + " @ " + err.getCoordinate());
        } else {
            System.out.println("几何有效");
        }

        // 3. 缓冲（注意：单位是“坐标单位”，这里是度，仅作演示）
        Geometry buffered = plot.buffer(0.001);
        System.out.println("缓冲后面积(平方度): " + buffered.getArea());

        // 4. 序列化
        System.out.println("WKT: " + writer.write(buffered));
        System.out.println("包络: " + plot.getEnvelopeInternal());
    }
}
```

### 1.10.3 输出解读

在自己机器上运行，输出大致如下（缓冲后坐标做了舍入）：

```
类型: Polygon
顶点数: 5
几何有效
缓冲后面积(平方度): 0.0001243...
WKT: POLYGON ((116.399 39.899, ...))
包络: Envelope[116.4 : 116.41, 39.9 : 39.91]
```

几个值得注意的点：

- `buffer(0.001)` 里的 `0.001` 是**坐标单位**（此处为度），不是米。这就是 1.8 节强调的坐标系问题；
- `getEnvelopeInternal()` 返回的包络是矩形范围，常用于快速过滤与索引；
- `WKTWriter` 默认输出保留坐标原始精度，格式由 `OrdinateFormat` 控制（第 6 章）。

### 1.10.4 常见报错

| 现象 | 原因 | 解决 |
|------|------|------|
| `NoClassDefFoundError: org/locationtech/jts/geom/Geometry` | jar 没进 classpath | 检查依赖与打包 |
| `ClassCastException: com.vividsolutions...` | 新旧包名混用 | 统一到 org.locationtech.jts |
| `TopologyException` | 几何无效或精度问题 | 先校验/修复，再运算（第 17、18 章） |
| `ParseException` | WKT 语法错误 | 检查括号、空格、环闭合 |
| 结果面积是 0 或极小 | 经纬度当米用 | 先投影（第 19 章） |

---

## 1.11 学习路线图

### 1.11.1 三类读者的路线

**路线 A：应用开发者（只想把活干完）**

```
第01章 → 第02章 → 第04章 → 第06章 → 第08章 → 第09章 → 第10章 → 第17章 → 第19章
        （概念）  （环境）  （模型）  （读写）  （谓词）  （叠加）  （缓冲）  （质检）  （坐标系）
```

**路线 B：GIS 平台开发者（要集成、要性能）**

```
第01章 → 第03章 → 第04章 → 第08章 → 第09章 → 第13章 → 第18章 → 第20章 → 第23章
        （全貌）  （架构）  （模型）  （关系）  （叠加）  （索引）  （鲁棒）  （性能）  （集成）
```

**路线 C：算法/源码贡献者（要改代码）**

```
第01章 → 第03章 → 第05章 → 第09章 → 第12章 → 第18章 → 第21章 → 第22章
        （全貌）  （架构）  （构建）  （叠加）  （化简）  （鲁棒）  （构建/测试）（扩展）
```

### 1.11.2 章节依赖图

```
   Part 1 基础（1-4）
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
   Part 2 数据（5-7） Part 3 运算（8-12） Part 4 结构（13-18）
        │              │              │
        └──────────────┴──────────────┘
                       │
                       ▼
              Part 5 工程（19-24）
```

各章相对独立，但第 8、9 章是后续所有运算章节的基础；第 4 章是全书的地基。如果时间有限，至少精读 4、8、9 三章。

### 1.11.3 阅读建议

- 每章的代码都能独立运行，建议**边读边敲**，尤其是输出值，不要只看不跑；
- 遇到“这个 API 我记得不是这样”的疑问，直接查对应版本的 Javadoc 或源码，不要依赖记忆；
- 涉及版本的结论（如“默认走旧引擎”）都以源码为准，本教程标注了核对位置；
- 每章末尾的“常见问题与避坑”是从真实项目里提炼的，比正文更值得反复看。

---

## 1.12 常见问题与避坑

### 1.12.1 概念类

**Q1：JTS 能直接读 Shapefile 吗？**
不能。JTS 只支持 WKT/WKB/GeoJSON/TWKB 这些“几何文本/二进制”格式。Shapefile 是“几何 + 属性 + 投影”的复合格式，需要 GeoTools、GDAL 或专门的读取库。

**Q2：JTS 的坐标是经纬度还是投影坐标？**
都可以，它不关心。但**运算语义是平面欧氏几何**，所以经纬度下算出的面积/长度/距离没有物理意义（见 1.8 节）。

**Q3：为什么 `equals` 返回 false，但两个几何看起来一样？**
`equals` 是对象相等（或结构比较），拓扑相等要用 `equalsTopo`。此外顶点顺序、环方向不同也会导致 `equalsExact` 为 false。

**Q4：`contains` 和 `covers` 有什么区别？**
二者都表示“包含”，但边界处理不同：`covers` 允许一个点恰好在多边形边界上时返回 true，`contains` 对“点位于边界”返回 false。业务上判断“地块是否覆盖某点”通常用 `covers`。

### 1.12.2 依赖类

**Q5：应该引哪个 artifact？**
绝大多数场景只引 `org.locationtech.jts:jts-core`。要 GeoJSON 再加 `org.locationtech.jts.io:jts-io-common`。

**Q6：项目里同时有 com.vividsolutions 和 org.locationtech 两套包怎么办？**
不能共存于同一运算链。用 Maven 的 `dependencyManagement` 统一版本，或升级所有依赖到 1.15+。老代码可以用 `MIGRATION.md` 里的 sed 批量改包名。

**Q7：jts-core 有传递依赖吗？**
几乎为零，这是它适合嵌入式场景的重要原因。`jts-io-common` 会引入少量 JSON 相关依赖。

### 1.12.3 版本类

**Q8：升级到 1.20 后 `union` 结果变了？**
先确认有没有设 `-Djts.overlay=ng`，以及是否显式调用了新引擎。默认开关在 1.20 里仍是旧引擎，但如果你之前手动设过系统属性，升级后行为可能不同。

**Q9：1.20 的 RelateNG 值得切吗？**
新项目、对 GeometryCollection 关系判断或性能有要求时值得；存量项目建议灰度，用同一批数据对比结果后再切（第 8 章给了对比方法）。

**Q10：为什么有些 1.21 的类在 1.20 里找不到？**
1.21 尚在开发中。使用前先确认目标版本，可对照官方 Javadoc 的版本标识。

---

## 1.13 本章小结

- JTS 是 Java 矢量几何内核，实现 OGC Simple Features，核心价值在**拓扑关系判断与几何运算**；
- 它只负责“算”，不负责坐标转换、数据读写、渲染与存储；
- 历史三次关键转折：Vivid Solutions 起源 → 2016/17 迁入 LocationTech（包名/坐标/许可证变更）→ 1.18/1.20 双引擎演进；
- 许可证为 EPL 2.0 / EDL 1.0 双许可，商业项目通常选 EDL；
- 模块中 `jts-core` 必引，`jts-io-common` 按需引，`lab` 不稳定；
- 包结构按职责划分，看到需求先定位包，再定位类；
- **overlay 与 relate 的新引擎默认未开启**，需要系统属性或显式 API；
- JTS 不携带坐标系，SRID 只是标签，面积/长度/距离必须先投影到米制坐标；
- 学习路线按角色分三条，4、8、9 章是全书地基。

---

## 相关资源

- JTS 官方仓库：`https://github.com/locationtech/jts`
- JTS Javadoc：`https://locationtech.github.io/jts/javadoc`
- JTS 用户指南（USING.md）：`https://github.com/locationtech/jts/blob/master/USING.md`
- JTS 迁移指南（MIGRATION.md）：`https://github.com/locationtech/jts/blob/master/MIGRATION.md`
- 许可 FAQ：`https://github.com/locationtech/jts/blob/master/FAQ-LICENSING.md`
- 版本历史：`https://github.com/locationtech/jts/blob/master/doc/JTS_Version_History.md`
- LocationTech 项目主页：`https://locationtech.org/projects/technology.jts`
- 本博客相关教程：[GeoTools 教程](https://znlgis.github.io/gis/tutorial/geotools/) · [NetTopologySuite 教程](https://znlgis.github.io/gis/tutorial/NetTopologySuite/) · [Shapely 教程](https://znlgis.github.io/gis/tutorial/shapely/)

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/jts/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/第02章-安装配置与快速开始/" class="chapter-nav__next">下一章 →</a>
</div>

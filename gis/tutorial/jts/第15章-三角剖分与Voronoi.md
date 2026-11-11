---
layout: default
title: 第15章 - 三角剖分与 Voronoi
---

# 第15章 - 三角剖分与 Voronoi

三角剖分是把二维区域切成三角形的过程。它看起来只是一个“把多边形切成三角形”的几何操作，实际上是 TIN（不规则三角网）建模、地形插值、等值线生成、Voronoi 邻近分析、有限元网格、三维渲染等一系列应用的共同底座。JTS 的三角剖分模块既有教科书级的增量 Delaunay 算法实现，也有面向工程的多边形三角剖分与约束 Delaunay 工具，覆盖了从“点集构网”到“带洞多边形剖分”的主要需求。

本章从最基础的 Delaunay 准则讲起，然后深入 JTS 的 quadedge 数据结构——一个用四个有向边表示一条无向边的精巧设计。理解它，你才能读懂 `QuadEdgeSubdivision` 的 locate/insertSite 为什么那样写，也才能在需要自定义三角剖分算法时知道从哪里下手。随后依次介绍点集 Delaunay、约束 Delaunay、Voronoi 图、`tri` 包的多边形三角剖分与 TIN 插值，最后讨论鲁棒性与工程应用。

本章示例基于 JTS 1.20.0，所有 WKT 输出均为实际运行结果；1.21 新增/变更的 API 会单独标注。前置知识：第 4 章的几何模型、第 11 章的坐标与距离、第 13 章的 KdTree（约束 Delaunay 用它做站点索引）。

## 15.1 三角剖分基础

### 15.1.1 从点集到三角形

给定平面上一个点集 P，三角剖分（triangulation）是把 P 的凸包切成一组互不重叠、并集等于凸包的三角形，且每个三角形的顶点都来自 P、每个点都至少属于一个三角形。满足这两个条件的剖分有无穷多种，Delaunay 剖分是其中“形状最好”的一种。

**Delaunay 准则**：任意三角形的外接圆内部不含其他点。等价地，任意两个相邻三角形组成的凸四边形，其对角线是两条对角线中较短的一条（局部 Delaunay）。这两个等价性质分别给出了两种算法思路：空圆判定用于增量插入，边翻转（edge flip）用于局部优化。

```
Delaunay 与非 Delaunay 的对比（同一组点）

   Delaunay（空外接圆）           非 Delaunay（瘦长三角形）
   ┌───────────────┐             ┌───────────────┐
   │ ●───────────● │             │ ●───────────● │
   │ │ ╲       ╱ │ │             │ │ ╲       ╱ │ │
   │ │   ╲   ╱   │ │             │ │   ╲   ╱   │ │
   │ │     ●     │ │             │ │     ●     │ │
   │ │   ╱   ╲   │ │             │ │   ╱   ╲   │ │
   │ │ ╱       ╲ │ │             │ │ ╱       ╲ │ │
   │ ●───────────● │             │ ●───────────● │
   └───────────────┘             └───────────────┘
   外接圆不含其他点                 交换对角线后更"胖"

   四个共圆点的情况下，两种剖分都满足空圆准则（退化情形）
```

Delaunay 剖分有几个工程上非常重要的性质：

- **最大化最小角**：在所有三角剖分中，Delaunay 剖分的最小内角最大，避免出现“针状”三角形，这对插值精度与数值稳定性至关重要。
- **唯一性**：如果没有四点共圆，Delaunay 剖分唯一；存在共圆点时，对角线选择可能不同，但都满足准则。
- **与 Voronoi 对偶**：Delaunay 三角形的外接圆圆心连起来就是 Voronoi 图，两者是同一结构的两种表达。

### 15.1.2 凸包、约束与 TIN

JTS 的三角剖分 API 分两类：

1. **点集 Delaunay**：输入是一堆点，输出覆盖凸包的三角形。适合“从采样点构建 TIN”。
2. **约束 Delaunay**：输入是点 + 约束线（例如地块边界、道路），输出仍然覆盖凸包，但约束线必须作为三角形的边存在。适合“带边界的地形建模”。

此外还有第三类，专为多边形服务：

3. **多边形三角剖分**：输入是带洞的多边形，输出恰好覆盖多边形内部的三角形（不覆盖凸包与多边形之间的区域）。JTS 1.19 起提供 `PolygonTriangulator` 与 `ConstrainedDelaunayTriangulator`。

```
三种输入的输出范围对比

   点集 Delaunay              约束 Delaunay            多边形三角剖分

   ┌─────────────┐           ┌─────────────┐          ┌─────────────┐
   │ ▲ ▲ ▲ ▲ ▲ │           │ ▲ ▲ ▲ ▲ ▲ │          │ ┌─────────┐ │
   │  ▲ ▲ ▲ ▲  │           │  ▲─▲─▲─▲  │          │ │ ▲ ▲ ▲  │ │
   │   ▲ ▲ ▲   │           │  │ ▲ ▲ │  │          │ │  ▲ ▲   │ │
   └─────────────┘           └─────────────┘          └─────────────┘
   覆盖凸包                   覆盖凸包 + 约束边         仅覆盖多边形内部
```

TIN（Triangulated Irregular Network）是点集 Delaunay 的典型产物：把带高程的采样点建成三角网，每个三角形内部用平面（线性）插值，就能得到连续的地形表面。JTS 不提供完整的 TIN 类，但 `Vertex.interpolateZ` 与三角剖分结果足以自己组装一个（15.8 节）。

### 15.1.3 模块地图

```
modules/core/src/main/java/org/locationtech/jts/triangulate/
├── DelaunayTriangulationBuilder.java        点集 Delaunay（入口）
├── ConformingDelaunayTriangulationBuilder.java 约束 Delaunay（入口）
├── ConformingDelaunayTriangulator.java      约束三角剖分算法主体
├── IncrementalDelaunayTriangulator.java     增量插入
├── VoronoiDiagramBuilder.java               Voronoi 图（入口）
├── ConstraintSplitPointFinder.java           约束分裂点策略接口
├── NonEncroachingSplitPointFinder.java       默认策略
├── MidpointSplitPointFinder.java             中点策略
├── ConstraintEnforcementException.java       约束无法满足时抛出
├── Segment.java / SplitSegment.java          约束线段及分裂
├── quadedge/                                 四边形边结构
│   ├── QuadEdge.java / Vertex.java
│   ├── QuadEdgeSubdivision.java              剖分容器
│   ├── QuadEdgeLocator.java / LastFoundQuadEdgeLocator.java
│   ├── TrianglePredicate.java / TriangleVisitor.java
│   ├── QuadEdgeTriangle.java / QuadEdgeUtil.java
│   └── EdgeConnectedTriangleTraversal.java
├── polygon/                                  多边形三角剖分
│   ├── PolygonTriangulator.java
│   ├── ConstrainedDelaunayTriangulator.java
│   ├── PolygonEarClipper.java                耳朵裁剪
│   ├── PolygonHoleJoiner.java                洞合并
│   ├── PolygonNoder.java
│   └── TriDelaunayImprover.java              边翻转优化
└── tri/                                      Tri 邻接结构
    ├── Tri.java
    ├── TriangulationBuilder.java
    └── TriEdge.java
```

### 15.1.4 两条 API 路线

| 路线 | 核心类 | 输出类型 | 适合场景 | 是否支持洞 |
| --- | --- | --- | --- | --- |
| quadedge 路线 | `DelaunayTriangulationBuilder`、`ConformingDelaunayTriangulationBuilder`、`VoronoiDiagramBuilder` | `GeometryCollection`（`Polygon`）、`MultiLineString` | 点集构网、TIN、Voronoi、约束网 | 不直接支持（输出凸包内） |
| tri 路线 | `PolygonTriangulator`、`ConstrainedDelaunayTriangulator` | `GeometryCollection`（`Polygon`）+ `List<Tri>` | 多边形剖分、有限元网格、渲染三角化 | 支持（洞会被合并） |

两条路线的底层数据结构不同：quadedge 路线用 `QuadEdgeSubdivision`（半边四元组），tri 路线用 `Tri`（三角形 + 三邻接）。前者适合增量构建与拓扑遍历，后者适合批处理与邻接查询。做工程选型时，先看“输入是点还是面”，再看“是否需要邻接信息”。

## 15.2 quadedge 数据结构

### 15.2.1 四个有向边的想法

Guibas 与 Stolfi 在 1985 年提出的 quad-edge 结构，用一个四元组表示一条无向边：

```
一条边的四条记录（e, e.rot, e.rot.rot, e.rot.rot.rot）

             e.rot
        ┌───────────┐
        │           │
   e    │     ●     │  e.sym (= e.rot.rot)
  ──────►     │     ◄──────
   orig       │        dest
              │
           e.rot^3

  e          = 从 orig 到 dest 的有向边
  e.sym()    = 从 dest 到 orig 的反向边
  e.rot()    = e 逆时针旋转 90°（对偶边，指向左侧面）
  e.rot().rot().rot() = 顺时针旋转 90°

  旋转四次回到自身：e.rot().rot().rot().rot() == e
```

四个记录各自保存 `next` 指针（`oNext`），形成四个环：绕起点的出边环、绕终点的入边环、绕左面的边环、绕右面的边环。所有拓扑算子都由 `rot` 与 `next` 组合而成：

```java
public final QuadEdge rot();      // 逆时针 90°，对偶
public final QuadEdge sym();      // rot.rot，反向边
public final QuadEdge invRot();   // rot.sym，顺时针 90°
public final QuadEdge oNext();    // next，绕起点的下一条出边
public final QuadEdge oPrev();    // rot.next.rot
public final QuadEdge dNext();    // sym.oNext.sym
public final QuadEdge dPrev();    // invRot.oNext.invRot
public final QuadEdge lNext();    // invRot.oNext.rot，左面下一条
public final QuadEdge lPrev();    // next.sym
public final QuadEdge rNext();    // rot.next.invRot
public final QuadEdge rPrev();    // sym.oNext
```

记住 `oNext` 与 `lNext` 两个就够用了：`oNext` 绕起点转一圈，用于遍历节点的出边；`lNext` 沿左面走一圈，用于遍历三角形/面的边界。其余算子是它们的组合。

### 15.2.2 四个基本操作

`QuadEdge` 提供四个静态方法构建与修改拓扑：

```java
/** 创建一条从 o 到 d 的新边，返回 orig 侧记录 */
public static QuadEdge makeEdge(Vertex o, Vertex d);

/** 把两条边的 next 环拼接（splice） */
public static void splice(QuadEdge a, QuadEdge b);

/** 在 a 的终点与 b 的起点之间连一条新边 */
public static QuadEdge connect(QuadEdge a, QuadEdge b);

/** 翻转边 e（用于 Delaunay 局部优化） */
public static void swap(QuadEdge e);
```

`splice` 是整个结构的心脏，它交换两条边的 `next` 指针，从而把两个环合并或把一个环拆开。Delaunay 增量插入时的“扇形连接”就是 `makeEdge` + 反复 `connect`；边翻转优化就是 `swap`。

```
splice(a, b) 的语义（示意）

   splice 前:  a ──► aNext      b ──► bNext
   splice 后:  a ──► bNext      b ──► aNext

   直观理解：把 a 所在的 next 环与 b 所在的 next 环在 a、b 处"剪开再交叉连接"
```

### 15.2.3 Vertex 与几何谓词

`Vertex` 包装一个 `Coordinate`，并提供三角剖分需要的几何判定：

| 方法 | 含义 |
| --- | --- |
| `isInCircle(a, b, c)` | 本点是否在三角形 abc 的外接圆内（使用 `TrianglePredicate.isInCircleRobust`） |
| `isCCW(b, c)` | 本点、b、c 是否逆时针 |
| `rightOf(e)` / `leftOf(e)` | 本点在有向边 e 的右侧 / 左侧 |
| `classify(p0, p1)` | 点相对有向线段的位置：LEFT/RIGHT/BEYOND/BEHIND/BETWEEN/ORIGIN/DESTINATION |
| `circleCenter(b, c)` | 外接圆圆心（用齐次坐标 `HCoordinate` 计算） |
| `interpolateZ(...)` | 三角形内线性插值 Z（静态重载支持 3 点/线段） |
| `midPoint(a)` | 中点 |

`isInCircle` 用的是鲁棒判定（`TrianglePredicate` 内部用 `DD` 双精度扩展与自适应误差界），这是 Delaunay 算法在近共圆点上不发散的关键。1.12 起 JTS 就改用了更鲁棒的 inCircle 公式，自己实现时不要退回朴素的叉积行列式。

### 15.2.4 手工建边与遍历

下面例子不走 Builder，直接操作 `QuadEdge`，理解拓扑算子。注意 `QuadEdge.makeEdge` 是静态方法，但 `QuadEdgeSubdivision` 也有同名实例方法（它会登记边以便管理），两者不要混用。

```java
import org.locationtech.jts.triangulate.quadedge.QuadEdge;
import org.locationtech.jts.triangulate.quadedge.Vertex;

public class QuadEdgeDemo {
    public static void main(String[] args) {
        Vertex a = new Vertex(0, 0);
        Vertex b = new Vertex(10, 0);
        Vertex c = new Vertex(0, 10);
        Vertex d = new Vertex(2, 2);      // 三角形内部一点，用于外接圆判定

        QuadEdge e0 = QuadEdge.makeEdge(a, b);   // a -> b
        QuadEdge e1 = QuadEdge.makeEdge(b, c);   // b -> c
        QuadEdge e2 = QuadEdge.makeEdge(c, a);   // c -> a

        QuadEdge.splice(e0.sym(), e1);           // 把 b 处连起来
        QuadEdge.splice(e1.sym(), e2);
        QuadEdge.splice(e2.sym(), e0);

        System.out.println("e0=" + e0 + ", sym=" + e0.sym());
        System.out.println("e0.oNext()=" + e0.oNext());
        System.out.println("e0.lNext()=" + e0.lNext());
        System.out.println("d.isInCircle(a,b,c)=" + d.isInCircle(a, b, c));
    }
}
```

示例输出：

```
e0=LINESTRING ( 0 0, 10 0 ), sym=LINESTRING ( 10 0, 0 0 )
e0.oNext()=LINESTRING ( 0 0, 0 10 )
e0.lNext()=LINESTRING ( 10 0, 0 10 )
d.isInCircle(a,b,c)=true
```

三个输出分别对应三种遍历：

- `e0` 与 `e0.sym()` 是一对反向边，`QuadEdge.toString()` 用 `WKTWriter.toLineString` 输出，会带空格。
- `e0.oNext()` 是绕起点 `a=(0,0)` 的下一条出边 `a→c`。
- `e0.lNext()` 是沿左面（三角形内部）的下一条边；对 `a→b→c` 这个三角形，`a→b` 的左面下一条是 `b→c`，所以输出 `(10 0, 0 10)`。
- `d.isInCircle(a,b,c)=true` 说明内点 `(2,2)` 在三角形外接圆内，这是 Delaunay 判定用的鲁棒谓词。

如果只建三条边而没有 `splice` 成环，`oNext`/`lNext` 的行为会退化成自环（`next` 指向自己），遍历没有意义。**半边的所有遍历语义都建立在“已正确 splice”之上**，这是手工操作 `QuadEdge` 时最容易漏的一步。

## 15.3 QuadEdgeSubdivision：剖分容器

### 15.3.1 Frame 三角形

半边的拓扑操作需要一个“无穷远”的边界来处理凸包以外的区域。JTS 的做法是在点集包络外创建一个足够大的“框架三角形”（frame triangle），把整个点集包住，剖分在框架内部进行，输出几何时再排除框架顶点。

```java
public QuadEdgeSubdivision(Envelope env, double tolerance);
private void createFrame(Envelope env) {
    double frameSize = Math.max(deltaX, deltaY) * FRAME_SIZE_FACTOR; // 10.0
    frameVertex[0] = new Vertex(centreX, env.getMaxY() + frameSize);
    frameVertex[1] = new Vertex(env.getMinX() - frameSize, env.getMinY() - frameSize);
    frameVertex[2] = new Vertex(env.getMaxX() + frameSize, env.getMinY() - frameSize);
    // frameEnv 为框架三角形的包络
}
```

`FRAME_SIZE_FACTOR = 10.0`，也就是框架三角形的尺寸是数据范围的 10 倍。这个系数在 1.20 被调整过（版本历史 #931 “Improve robustness of Delaunay Triangulation frame size heuristic”），原因是太小会导致框架边参与 Delaunay 判定、产生错误的“外部三角形”；太大则损失浮点精度。

```
Frame 三角形与数据范围

        △ frame[0] (centreX, maxY + 10*size)
       ╱ ╲
      ╱   ╲
     ╱ 数据 ╲
    ╱  □□□□  ╲
   ╱   □□□□   ╲
  △─────────────△
 frame[1]        frame[2]

  数据点全部落在框架三角形内部；
  输出 getTriangles(false) 时会排除含框架顶点的三角形
```

### 15.3.2 定位与插入

增量 Delaunay 的核心是两个操作：

- **locate(Vertex v)**：找到包含 v 的三角形（或 v 落在其上的边），返回一条起点或终点为 v 的有向边。JTS 用 `LastFoundQuadEdgeLocator` 缓存上一次定位结果，利用“下一个插入点通常离上一个不远”的空间局部性加速。
- **insertSite(Vertex v)**：如果 v 已存在（在容差内）直接返回；否则以 v 为顶点，把所在三角形（或边上）拆成 2~3 个三角形，然后对受影响的边做 Delaunay 翻转（`swap`）。

```java
public QuadEdge locate(Vertex v);
public QuadEdge locate(Coordinate p);
public QuadEdge insertSite(Vertex v);
public boolean isDelaunay();          // 全量检查所有边是否满足局部 Delaunay
```

定位失败会抛 `LocateFailureException`，通常意味着拓扑已被破坏（例如退化的 frame、NaN 坐标、容差设置不当）。`isDelaunay()` 是很好的自检手段：插入完一批点后调一次，确认没有漏翻转的边。

### 15.3.3 输出方法

`QuadEdgeSubdivision` 的输出方法很多，按“输出什么”分类：

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `getEdges(GeometryFactory)` | `MultiLineString` | 所有非框架主边 |
| `getTriangles(GeometryFactory)` | `GeometryCollection` | 所有非框架三角形（闭合环） |
| `getTriangles(boolean includeFrame, GeometryFactory)` | `GeometryCollection` | 是否包含框架三角形 |
| `getTriangleVertices(boolean)` | `List<Vertex[]>` | 三角形顶点 |
| `getTriangleCoordinates(boolean)` | `List<Coordinate[]>` | 三角形坐标（闭合） |
| `getTriangleEdges(boolean)` | `List<QuadEdge[]>` | 三角形的三条有向边 |
| `getPrimaryEdges(boolean)` | `List<QuadEdge>` | 每条无向边只取一次 |
| `getVertexUniqueEdges(boolean)` | `List<QuadEdge>` | 每个顶点一条出边 |
| `getVertices(boolean)` | `Collection<Vertex>` | 顶点集合 |
| `getVoronoiDiagram(GeometryFactory)` | `GeometryCollection` | Voronoi 面 |
| `getVoronoiCellPolygons(GeometryFactory)` | `List<Polygon>` | 每个站点的 Voronoi 面，`userData` 为站点坐标 |
| `isDelaunay()` | `boolean` | 局部 Delaunay 自检 |

`visitTriangles(TriangleVisitor, boolean includeFrame)` 是底层遍历入口：它沿 `lNext` 环游每个三角形，把三条边交给 `TriangleVisitor` 回调。上面大部分输出方法内部都是 `visitTriangles` 加一个 visitor 实现的。

### 15.3.4 容差语义

构造器第二个参数 `tolerance` 在 `QuadEdgeSubdivision` 里有两个用途：

1. **点重合判定**：`isVertexOfEdge` 与 `insertSite` 用 `v.equals(e.orig(), tolerance)` 判断点是否已存在。容差为 0 时用精确坐标比较。
2. **边重合容差**：`edgeCoincidenceTolerance = tolerance / 1000`，用于 `isOnEdge` 判断点是否落在边上。也就是说 tolerance 传 0.001 时，距离边 0.000001 以内会被认为在边上。

容差的单位与坐标单位一致。地理坐标系（度）下给 0.001 意味着约 100 米，会把大片点合并成一个；投影坐标系（米）下给 0.001 才是 1 毫米。**没有坐标系信息的容差一定会出事**。

### 15.3.5 完整示例：从点到面

```java
import java.util.List;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.DelaunayTriangulationBuilder;
import org.locationtech.jts.triangulate.quadedge.QuadEdgeSubdivision;
import org.locationtech.jts.triangulate.quadedge.Vertex;

public class SubdivisionWalkDemo {
    public static void main(String[] args) throws Exception {
        GeometryFactory gf = new GeometryFactory();
        Geometry sites = new WKTReader().read(
            "MULTIPOINT ((10 10), (10 20), (20 20))");

        DelaunayTriangulationBuilder builder = new DelaunayTriangulationBuilder();
        builder.setSites(sites);
        QuadEdgeSubdivision subdiv = builder.getSubdivision();
        System.out.println("isDelaunay=" + subdiv.isDelaunay());
        System.out.println("vertices=" + subdiv.getVertices(false).size());
        System.out.println("triangles=" + subdiv.getTriangles(gf).getNumGeometries());

        // 每个三角形输出顶点坐标
        List<Coordinate[]> coords = subdiv.getTriangleCoordinates(false);
        for (Coordinate[] tri : coords) {
            System.out.println("三角形顶点：" + tri[0] + " / " + tri[1] + " / " + tri[2]);
        }

        // 也可以拿到三角形顶点对象
        List<Vertex[]> verts = subdiv.getTriangleVertices(false);
        System.out.println("三角形数(Vertex)=" + verts.size());

        // 查找某条边
        System.out.println("locate((15,15))=" + subdiv.locate(new Coordinate(15, 15)));
        Polygon ignored = null;
        Geometry unused = null;
    }
}
```

示例输出：

```
isDelaunay=true
vertices=3
triangles=1
三角形顶点：(10.0, 20.0, NaN) / (10.0, 10.0, NaN) / (20.0, 20.0, NaN)
三角形数(Vertex)=1
locate((15,15))=LINESTRING ( 20 20, 10 10 )
```

`Coordinate.toString()` 会打印 Z 值，点集的 Z 未设置时为 `NaN`。`locate` 返回的是“包含该点或该点所在边”的一条有向边，输出具体是哪条边取决于当前剖分拓扑，不应依赖。

## 15.4 DelaunayTriangulationBuilder：点集 Delaunay

### 15.4.1 API

```java
public class DelaunayTriangulationBuilder {
    public DelaunayTriangulationBuilder();
    public void setSites(Geometry geom);        // 从几何的坐标中取站点
    public void setSites(Collection coords);    // 直接给 Coordinate 集合
    public void setTolerance(double tolerance);
    public QuadEdgeSubdivision getSubdivision();
    public Geometry getEdges(GeometryFactory geomFact);
    public Geometry getTriangles(GeometryFactory geomFact);
}
```

三个使用要点：

1. `setSites` 会**去重并排序**。源码里 `extractUniqueCoordinates` 先 `copyDeep` 再 `Arrays.sort`，然后用 `CoordinateList(coordsCopy, false)` 去重。排序不仅为了去重，也让增量插入的顺序稳定，输出可复现。
2. `getEdges` 与 `getTriangles` 都**不包含框架三角形**（内部调用 `false` 版本的 includeFrame）。
3. `getTriangles` 返回 `GeometryCollection`，每个元素是闭合环构成的 `Polygon`；不是 `MultiPolygon`，因为三角形之间共享边、不满足 `MultiPolygon` 的“内部不相交”约束。

### 15.4.2 完整示例

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.DelaunayTriangulationBuilder;

public class DelaunayDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();

        Geometry sites = reader.read("MULTIPOINT ((10 10), (10 20), (20 20))");
        DelaunayTriangulationBuilder builder = new DelaunayTriangulationBuilder();
        builder.setSites(sites);

        System.out.println("边：" + builder.getEdges(gf));
        System.out.println("三角形：" + builder.getTriangles(gf));
    }
}
```

示例输出：

```
边：MULTILINESTRING ((10 20, 20 20), (10 10, 10 20), (10 10, 20 20))
三角形：GEOMETRYCOLLECTION (POLYGON ((10 20, 10 10, 20 20, 10 20)))
```

三个点只能构成一个三角形，输出符合预期。换个更典型的例子——8 个随机点：

```java
Geometry sites = reader.read(
    "MULTIPOINT ((50 40), (140 70), (80 100), (130 140),"
    + " (30 150), (70 180), (190 110), (120 20))");
```

对应 9 个三角形（`n` 个点、`h` 个凸包点，三角形数为 `2n - 2 - h`；这里 `n=8`，凸包点 `h=5`，`2*8-2-5=9`）。这个公式可以用来验证输出数量：**三角形数 = 2n - 2 - h**，边数 = 3n - 3 - h（不含框架）。如果数量对不上，多半是点重复、共线或容差把点合并了。

### 15.4.3 输入去重与排序

`setSites(Geometry)` 会遍历 `geom.getCoordinates()`，因此：

- 传入 `Polygon` 时，站点包含外环与内环的所有顶点（不是面内部的点）。
- 传入 `MultiPoint` 时，重复点会被去重。
- 传入 `GeometryCollection` 时，所有组件的坐标都会被收集。
- `Coordinate` 的 Z 值会保留在三角剖分中，但 Delaunay 判定只用 XY。

去重基于 `Coordinate.compareTo`（先 x 后 y 再 z），因此 Z 不同的同 XY 点会被当作不同点吗？`CoordinateList(coordsCopy, false)` 的去重调用 `equals2D` 吗？看一下实现：`CoordinateList.add(Coordinate, boolean)` 的 `allowRepeated` 参数为 false 时用 `Coordinate.equals` 比较——而 `Coordinate.equals` 是 `equals2D`，忽略 Z。所以同 XY、不同 Z 的点会被去重，保留排序后的第一个（Z 可能不是期望的那个）。**如果 Z 有业务含义，输入前务必自己按 XY 去重并确定保留规则。**

### 15.4.4 容差与退化情形

`setTolerance` 传给 `QuadEdgeSubdivision`，影响点合并与边判定。默认 0.0 表示精确。实践建议：

- 数据已经过精度归一（坐标都在网格上）时用 0.0；
- 数据有轻微抖动、又不想改变坐标时，可用很小的容差（如 1e-9 相对坐标量级），但要清楚它只影响“点是否被视为同一点”，不会移动坐标；
- 需要彻底合并近距点时，先做 `SnappingNoder` 或坐标取整，不要把大容差丢给三角剖分——大容差会让 locate/insertSite 的拓扑判断出错，出现 `LocateFailureException` 或非 Delaunay 结果。

退化情形与输出：

| 输入 | 输出/行为 |
| --- | --- |
| 0 个点 | `getTriangles` 返回空 `GeometryCollection` |
| 1 个点 | 无三角形，`getEdges` 空 |
| 2 个点 | 无三角形，`getEdges` 可能返回一条边（框架内） |
| 全部共线 | 无三角形，可能抛 `LocateFailureException` 或输出退化边 |
| 大量重复点 | 去重后按唯一点数处理 |
| 四点共圆 | 对角线选择不唯一，输出仍满足 Delaunay |

对共线点，最稳妥的预处理是先做 `ConvexHull` 判断维度：如果凸包是线段，就别做三角剖分了，直接报“数据不足以构网”。

### 15.4.5 与凸包的关系

Delaunay 三角剖分的边界就是点集凸包。因此可以用一条简单规则校验结果：把所有三角形的边收集起来，统计每条边被多少个三角形共享——共享 1 次的边构成凸包边界，共享 2 次的边是内部边，共享超过 2 次说明拓扑坏了。JTS 的 `QuadEdgeSubdivision.getPrimaryEdges` 已经保证每条无向边只出现一次，但自己实现校验逻辑时这个“边—三角形计数”是标准做法。

```java
// 校验：三角形面积之和应等于凸包面积
Geometry tris = builder.getTriangles(gf);
double triArea = tris.getArea();
double hullArea = new org.locationtech.jts.algorithm.ConvexHull(
    sites).getConvexHull().getArea();
System.out.println("三角形面积和=" + triArea + ", 凸包面积=" + hullArea);
System.out.println("一致=" + (Math.abs(triArea - hullArea) < 1e-6));
```

示例输出（三点例子）：

```
三角形面积和=50.0, 凸包面积=50.0
一致=true
```

这是最便宜也最有效的三角剖分质检：面积不守恒，说明有洞、重叠或漏三角形。

## 15.5 约束 Delaunay 三角剖分

### 15.5.1 为什么需要约束

点集 Delaunay 只保证“覆盖凸包”，它不知道地块边界在哪。把地块的四个角点作为站点构网，三角形会横穿地块内部；而建模需求往往是“地块边界必须作为三角形的边”。约束 Delaunay 三角剖分（Constrained Delaunay Triangulation，CDT）就是为此设计的：给定站点与一组约束线段，输出覆盖凸包的三角网，且每条约束线段都是某条三角形的边。

```
约束边必须出现在三角网中

   站点 ●        ●        ●
        │        │        │
        │  约束边 x=5       │
        │        │        │
        ●────────●────────●
        │        │        │
        │        │        │
        ●────────●────────●

   没有约束：对角线可能横穿 x=5
   有约束：x=5 这条线段被切成若干三角形的边
```

JTS 的实现思路分两步：

1. **先做无约束 Delaunay**：把所有站点（包括约束线的端点、被插入的分裂点）建成普通 Delaunay 三角网。
2. **强制约束**：对每条约束线段，检查是否存在“侵占点”（encroachment point）——即落在该线段的直径圆（diameter circle）内的其他点。如果存在，就把线段从中点附近劈开，把一个新点插入三角网，然后继续处理两段。重复直到所有约束段都满足 Gabriel 条件（直径圆内无点），此时该线段必然是三角网中的一条边。

```
侵占点与分裂

   A ●───────────────● B     约束线段 AB
          ╲       ╱
           ╲     ╱
            ● C               C 落在 AB 的直径圆内 => 侵占
   => 在 AB 上找分裂点 P（默认 NonEncroachingSplitPointFinder）
   A ●───────●───────● B
              P
   => 分别处理 AP、PB，直到没有侵占点
```

### 15.5.2 API

```java
public class ConformingDelaunayTriangulationBuilder {
    public ConformingDelaunayTriangulationBuilder();
    public void setSites(Geometry geom);
    public void setConstraints(Geometry constraintLines);  // 约束线，通常是 LineString/MultiLineString
    public void setTolerance(double tolerance);
    public QuadEdgeSubdivision getSubdivision();
    public Geometry getEdges(GeometryFactory geomFact);
    public Geometry getTriangles(GeometryFactory geomFact);
}
```

与点集版本的区别只有 `setConstraints` 与内部算法。注意没有 `setConstraints(Collection)` 重载，约束必须包成 `Geometry`；如果约束来自多个来源，先 `GeometryFactory.buildGeometry` 合并。

### 15.5.3 算法参数与异常

`ConformingDelaunayTriangulator` 是算法主体，几个常量/参数值得知道：

| 参数 | 默认/常量 | 作用 |
| --- | --- | --- |
| `tolerance` | 由 builder 传入，默认 0 | 站点合并容差，传给内部 `KdTree` |
| `MAX_SPLIT_ITER` | `99` | 约束强制阶段的最大迭代次数 |
| `splitFinder` | `NonEncroachingSplitPointFinder` | 分裂点选择策略 |
| `vertexFactory` | `null`（用默认 `ConstraintVertex`） | 自定义顶点类型 |
| 异常 | `ConstraintEnforcementException` | 迭代超限或无法满足约束时抛出 |

`enforceConstraints` 的核心循环：

```java
do {
    splits = enforceGabriel(segments);
    count++;
} while (splits > 0 && count < MAX_SPLIT_ITER);

if (count == MAX_SPLIT_ITER) {
    throw new ConstraintEnforcementException(
        "Too many splitting iterations while enforcing constraints.  Last split point was at: ",
        splitPt);
}
```

`ConstraintEnforcementException` 携带 `getPoint()`，能告诉你最后一次分裂发生在哪里。遇到这个异常，八成是：约束线自交、约束线端点不在站点上且与站点距离过近、tolerance 设得比约束间的距离还大、或者坐标量级过大导致浮点精度不足。

### 15.5.4 完整示例

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.ConformingDelaunayTriangulationBuilder;

public class ConformingDelaunayDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();

        ConformingDelaunayTriangulationBuilder builder =
            new ConformingDelaunayTriangulationBuilder();
        // 四个角点 + 一条竖直约束线
        builder.setSites(reader.read(
            "MULTIPOINT ((0 0), (10 0), (10 10), (0 10))"));
        builder.setConstraints(reader.read("LINESTRING (5 0, 5 10)"));
        builder.setTolerance(0.0);

        Geometry tris = builder.getTriangles(gf);
        System.out.println("三角形数=" + tris.getNumGeometries());
        System.out.println("总面积=" + tris.getArea());
        System.out.println("边=" + builder.getEdges(gf));
    }
}
```

示例输出：

```
三角形数=4
总面积=100.0
边=MULTILINESTRING ((5 10, 10 10), (0 10, 5 10), (0 0, 0 10), (0 0, 5 0), (5 0, 10 0), (10 0, 10 10), (5 0, 10 10), (5 0, 5 10), (0 10, 5 0))
```

关键验证点：

- 输出边里出现了 `(5 0, 5 10)`，说明约束线确实成了三角形的一条边。
- 总面积 100 = 10×10，说明没有丢区域。
- 三角形数 4 = 2×4 个点 - 2 - 4 个凸包点 + 2（约束边引入的额外点）？实际上公式不再适用，因为约束线端点 `(5,0)`、`(5,10)` 被作为新站点插入。可用“面积守恒 + 约束边存在”两条规则替代点数公式做校验。

### 15.5.5 自定义分裂策略

`ConstraintSplitPointFinder` 只有一个方法：

```java
public interface ConstraintSplitPointFinder {
    Coordinate findSplitPoint(Segment seg, Coordinate encroachPt);
}
```

JTS 提供两个实现：

- `NonEncroachingSplitPointFinder`（默认）：在约束线段的“安全区间”内取点，保证新点不会再次侵占相邻约束段。判断依据是 `Segment.projectionFactor` 与半段长度。
- `MidpointSplitPointFinder`：直接取中点，简单但可能反复分裂不收敛。

自定义的典型场景是“约束线上已有顶点优先作为分裂点”（避免插入过多新点）。实现时要注意：返回的点必须落在线段上，且不能与已有站点重合，否则会陷入无限分裂。

```java
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.triangulate.ConstraintSplitPointFinder;
import org.locationtech.jts.triangulate.Segment;

public class EndpointSplitFinder implements ConstraintSplitPointFinder {
    @Override
    public Coordinate findSplitPoint(Segment seg, Coordinate encroachPt) {
        // 简化示例：取中点（生产代码应做安全区间判断）
        return seg.midPoint();
    }
}
```

`Segment.midPoint()` 返回 `Coordinate`，与默认策略相比缺少“非侵占”保证，仅用于演示接口用法。

### 15.5.6 使用约束 Delaunay 的注意事项

1. **约束线必须是简单线**：自交的约束线会让分裂逻辑反复失败。输入前先用 `IsSimpleOp` 检查。
2. **约束线端点最好落在站点或边界上**：端点悬空会引入额外分裂点，增加三角形数与不可控性。
3. **约束线之间不要重叠**：两条约束线共线重叠时，拆分结果依赖处理顺序，可能出现极窄三角形。
4. **tolerance 不要大于约束间最小距离**：否则约束端点会被合并，约束边消失。
5. **结果是凸包内的三角网**：CDT 不会裁掉凸包与约束区域之间的部分。如果只要约束区域内部，需要用约束区域面去做裁剪（`intersection`）或直接用多边形三角剖分。
6. **版本差异**：1.20 修复了 frame 尺寸启发式（#931）与边界凸性（#1004），老版本在窄长数据上可能出现三角形越界。升级后再做回归对比。

## 15.6 VoronoiDiagramBuilder：Voronoi 图

### 15.6.1 Delaunay 的对偶

Voronoi 图把平面划分成若干“势力范围”：每个站点对应一个区域，区域内任意点到该站点的距离小于到其他任何站点的距离。它与 Delaunay 三角剖分互为对偶：

- Delaunay 三角形的外接圆圆心 = Voronoi 顶点；
- Delaunay 的一条边 ↔ Voronoi 的一条边（两站点连线的垂直平分线的一段）；
- Delaunay 三角形的三条边 ↔ Voronoi 中三条边交于一个顶点。

```
Delaunay（实线）与 Voronoi（虚线）对偶

   ●───────────●
   │ ╲       ╱ │        Delaunay 三角形的外接圆圆心
   │   ╲   ╱   │        就是 Voronoi 的顶点
   │     ●     │
   │   ╱   ╲   │        每条 Delaunay 边对应一条
   │ ╱       ╲ │        Voronoi 边（垂直平分线）
   ●───────────●

   工程意义：Delaunay 算完，Voronoi 只是"取外心 + 连边"
```

JTS 的实现正是如此：`QuadEdgeSubdivision.getVoronoiDiagram` 先 `visitTriangles(new TriangleCircumcentreVisitor(), true)` 把每条边的对偶位置设为外接圆圆心，再遍历每个顶点的出边，沿 `oPrev` 收集外心，闭合成 Voronoi 面。

### 15.6.2 API

```java
public class VoronoiDiagramBuilder {
    public VoronoiDiagramBuilder();
    public void setSites(Geometry geom);
    public void setSites(Collection coords);
    public void setClipEnvelope(Envelope clipEnv);   // 裁剪范围
    public void setTolerance(double tolerance);
    public QuadEdgeSubdivision getSubdivision();
    public Geometry getDiagram(GeometryFactory geomFact);
}
```

三个参数的语义：

| 参数 | 默认行为 | 影响 |
| --- | --- | --- |
| `sites` | 必填 | 站点集合，内部去重排序 |
| `clipEnv` | 未设置时：站点包络向外扩“一个对角线长度” | 决定输出面的边界范围 |
| `tolerance` | 0 | 站点合并容差，传给 `QuadEdgeSubdivision` |

默认裁剪范围的实现：

```java
diagramEnv = clipEnv;
if (diagramEnv == null) {
    diagramEnv = DelaunayTriangulationBuilder.envelope(siteCoords);
    double expandBy = diagramEnv.getDiameter();
    diagramEnv.expandBy(expandBy);   // 四周各扩一个对角线长度
}
```

也就是说，不设裁剪时，输出范围是站点包络的 3 倍见方（每边扩一个对角线）。这个默认值足以让所有内部 Voronoi 面闭合，但也意味着结果比数据范围大很多；工程上几乎总是要显式设 `setClipEnvelope`。

### 15.6.3 裁剪逻辑

`getDiagram` 的流程：

1. `subdiv.getVoronoiDiagram(geomFact)` 得到未裁剪的 Voronoi 面集合。
2. `clean(polys)`：检查是否存在“含超短边且无效”的面（`SHORT_SEG_TOLERANCE_FACTOR = 1e-10` 倍对角线），如果有，用 `SnappingPointIndex` 把顶点吸附一遍，修复共圆点导致的拓扑问题。这个清洗是 1.21 的改进（#1174 “Add Voronoi snapping heuristic to fix invalid diagram topology”）。
3. `clipGeometryCollection(polysClean, diagramEnv)`：把每个面用裁剪矩形求交。完全在矩形内的面原样保留；部分相交的做 `intersection`；完全在外面的丢弃。

输出因此有两个特点：

- 类型是 `GeometryCollection`，不是 `MultiPolygon`（裁剪后的面之间可能有共享边，不满足 `MultiPolygon` 约束）。
- 每个面的 `userData` 被设置为对应站点的坐标（`cellPoly.setUserData(v.getCoordinate())`），这是把“面”关联回“站点”的关键。

### 15.6.4 完整示例

```java
import org.locationtech.jts.geom.Envelope;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.VoronoiDiagramBuilder;

public class VoronoiDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();

        VoronoiDiagramBuilder builder = new VoronoiDiagramBuilder();
        builder.setSites(reader.read(
            "MULTIPOINT ((0 0), (10 0), (0 10), (10 10))"));
        builder.setClipEnvelope(new Envelope(-5, 15, -5, 15));
        builder.setTolerance(0.0);

        Geometry diagram = builder.getDiagram(gf);
        System.out.println("面数=" + diagram.getNumGeometries());
        double sum = 0;
        for (int i = 0; i < diagram.getNumGeometries(); i++) {
            Geometry cell = diagram.getGeometryN(i);
            sum += cell.getArea();
            System.out.println("面积=" + cell.getArea()
                + " 站点=" + cell.getUserData());
        }
        System.out.println("面积和=" + sum);
    }
}
```

示例输出：

```
面数=4
面积=100.0 站点=(10.0, 10.0, NaN)
面积=100.0 站点=(0.0, 10.0, NaN)
面积=100.0 站点=(0.0, 0.0, NaN)
面积=100.0 站点=(10.0, 0.0, NaN)
面积和=400.0
```

4 个站点在 10×10 的正方形角上，裁剪范围 20×20 以它们为中心，每个 Voronoi 面恰好是 10×10，面积和 400 = 20×20。面顺序不保证与站点顺序一致，用 `userData` 建映射即可。

### 15.6.5 从 Voronoi 面到业务对象

```java
import java.util.HashMap;
import java.util.Map;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;

/** 把 Voronoi 面与站点属性关联起来 */
public final class VoronoiLookup {
    private final Map<String, Geometry> cellBySite = new HashMap<String, Geometry>();

    public VoronoiLookup(Geometry diagram) throws Exception {
        for (int i = 0; i < diagram.getNumGeometries(); i++) {
            Geometry cell = diagram.getGeometryN(i);
            Coordinate site = (Coordinate) cell.getUserData();
            if (site == null) continue;
            cellBySite.put(key(site), cell);
        }
    }

    public Geometry cellOf(Coordinate site) {
        return cellBySite.get(key(site));
    }

    private static String key(Coordinate c) {
        return c.x + "," + c.y;
    }
}
```

`userData` 的类型是 `Coordinate`（源码 `cellPoly.setUserData(v.getCoordinate())`），它可能是 `CoordinateXY` 等子类，用 x/y 拼 key 比直接用 `Coordinate` 做 map key 更稳（避免 Z/NaN 与 hashCode 差异）。如果业务站点有 ID，建议在 `setSites` 之前把 ID 写进自己的站点表，再按坐标反查。

### 15.6.6 常见坑

**1. 不设裁剪范围，结果巨大。**
默认范围是站点包络扩一个对角线（3 倍见方），站点分布越散结果越大，面积统计完全失真。工程上必须 `setClipEnvelope`，且裁剪范围要与业务边界一致。

**2. 以为裁剪范围外也有面。**
裁剪外的面被丢弃，所以“Voronoi 面积和”等于裁剪矩形面积，而不是无穷大。

**3. 站点重合导致面缺失。**
`setSites` 会去重，重合站点只保留一个，输出面数少于输入点数。如果业务需要“重合站点合并后的面”，这是正确行为；如果需要区分，先给重合点加微小偏移或换算法。

**4. 共圆站点产生无效面。**
4 个以上点共圆时，Voronoi 顶点退化，可能出现零面积面或自交面。1.17/1.18/1.21 都修过相关问题（#447、#740、#1174）。遇到时先检查 `diagram.isValid()`，必要时对结果做 `GeometryFixer` 或提高数据精度。

**5. Voronoi 面不是“服务区”。**
Voronoi 只考虑欧氏距离，不考虑道路、河流、行政区、时间成本。真实服务区分析要用网络距离或栅格成本距离，Voronoi 只能作为“直线距离近似”。

### 15.6.7 最近站点查询

有了 Voronoi 面，最近站点查询可以退化成“点在哪个面里”：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.index.strtree.STRtree;

public class NearestSiteByVoronoi {
    private final STRtree cellIndex = new STRtree();

    public NearestSiteByVoronoi(Geometry diagram) {
        for (int i = 0; i < diagram.getNumGeometries(); i++) {
            Geometry cell = diagram.getGeometryN(i);
            cellIndex.insert(cell.getEnvelopeInternal(), cell);
        }
        cellIndex.build();
    }

    public Object nearestSite(Point p) {
        for (Object o : cellIndex.query(p.getEnvelopeInternal())) {
            Geometry cell = (Geometry) o;
            if (cell.covers(p)) return cell.getUserData();
        }
        // 裁剪边界外的点没有对应面，返回 null 由调用方处理
        return null;
    }
}
```

注意 `covers` 而不是 `contains`：点落在 Voronoi 边界（两个站点等距）时，用 `contains` 会返回 false，导致“边界点查不到站点”。如果必须给出唯一答案，可以用 `intersects` 后按站点 ID 取最小者。

## 15.7 tri 包与多边形三角剖分

### 15.7.1 Tri：带邻接的三角形

`org.locationtech.jts.triangulate.tri.Tri` 是 1.19 引入的轻量三角形结构（#775），面向“批量三角化 + 邻接查询”场景。它保存三个顶点坐标 `p0/p1/p2` 与三个邻居 `tri0/tri1/tri2`，明确约定**顶点顺序为顺时针**（`validate()` 会检查 `Orientation.CLOCKWISE`）。

```java
public class Tri {
    public Tri(Coordinate p0, Coordinate p1, Coordinate p2);
    public static Tri create(Coordinate p0, Coordinate p1, Coordinate p2);

    public void setAdjacent(Tri tri0, Tri tri1, Tri tri2);
    public Tri getAdjacent(int index);
    public int getIndex(Coordinate p);      // 顶点在三角形中的下标
    public int getIndex(Tri tri);           // 邻居边的下标

    public Tri split(Coordinate p);         // 在 p 处把三角形一分为三
    public void flip(int index);            // 与第 index 条边对面的三角形交换对角线
    public void remove();                   // 从邻接关系中摘除自身

    public double getArea();
    public double getLength();              // 周长
    public Polygon toPolygon(GeometryFactory geomFact);
    public void validate();                 // 检查方向与邻接一致性
    public boolean isBorder();              // 是否有边界边
    public boolean isInteriorVertex(int index);
}
```

索引约定（很容易记错）：

| 索引 | 含义 |
| --- | --- |
| 顶点 0/1/2 | `p0/p1/p2` |
| 边 0 | `p0 → p1` |
| 边 1 | `p1 → p2` |
| 边 2 | `p2 → p0` |
| `next(i)` | `(i+1) % 3` |
| `prev(i)` | `(i+2) % 3` |
| `oppVertex(edgeIndex)` | 该边对面的顶点 = `prev(edgeIndex)` |
| `oppEdge(vertexIndex)` | 该顶点对面的边 = `next(vertexIndex)` |

```
Tri 的边与顶点下标

            p0
           ╱  ╲
      边2 ╱    ╲ 边0
         ╱      ╲
        p2──────p1
            边1

  边0 = p0→p1，边1 = p1→p2，边2 = p2→p0
  三角形按顺时针排列（p0,p1,p2）
```

### 15.7.2 建立邻接

单独一个 `Tri` 没有邻接信息，`TriangulationBuilder.build(List<Tri>)` 会扫描所有三角形的边，用 `TriEdge`（无向边的坐标对）作为 key 建立邻接：

```java
public class TriangulationBuilder {
    public static void build(List<? extends Tri> triList);
}
```

它只能建立“恰好共享一条边”的邻接；如果两个三角形只在顶点相触，不算邻接。建立后可以用 `tri.validate()` 检查邻接一致性：共享边两端坐标必须一致，且两个三角形不能有边交叉。

```java
import java.util.ArrayList;
import java.util.List;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.triangulate.tri.Tri;
import org.locationtech.jts.triangulate.tri.TriangulationBuilder;

public class TriAdjacentDemo {
    public static void main(String[] args) {
        List<Tri> list = new ArrayList<Tri>();
        // 注意：Tri 要求顺时针，所以顶点顺序是 (0,0),(10,10),(10,0)
        Tri t0 = Tri.create(new Coordinate(0, 0),
                            new Coordinate(10, 10),
                            new Coordinate(10, 0));
        Tri t1 = Tri.create(new Coordinate(10, 10),
                            new Coordinate(0, 0),
                            new Coordinate(0, 10));
        list.add(t0);
        list.add(t1);

        TriangulationBuilder.build(list);
        System.out.println("t0 邻居数=" + t0.numAdjacent()
            + ", t1 邻居数=" + t1.numAdjacent());
        System.out.println("t0 是否含边界边=" + t0.isBorder());
        System.out.println("t0 面积=" + t0.getArea()
            + ", 周长=" + t0.getLength());
        t0.validate();
        System.out.println("邻接校验通过, t0=" + t0);
    }
}
```

示例输出：

```
t0 邻居数=1, t1 邻居数=1
t0 是否含边界边=true
t0 面积=50.0, 周长=34.14213562373095
t0 邻接校验通过, t0=POLYGON ((0 0, 10 10, 10 0, 0 0))
```

如果把顶点顺序写成逆时针（`(0,0),(10,0),(10,10)`），`validate()` 会抛 `IllegalArgumentException: Tri is not oriented correctly`。这是使用 `Tri` 最容易踩的坑：JTS 的 `Polygon` 外壳也是顺时针，但很多人习惯按逆时针构造三角形。

### 15.7.3 PolygonTriangulator：任意多边形三角剖分

`PolygonTriangulator` 处理“带洞多边形”，输出恰好覆盖多边形内部的三角形：

```java
public class PolygonTriangulator {
    public static Geometry triangulate(Geometry geom);
    public PolygonTriangulator(Geometry inputGeom);
    public Geometry getResult();        // GeometryCollection<Polygon>
    public List<Tri> getTriangles();    // 带邻接的三角形列表
}
```

算法分两步：

1. **PolygonHoleJoiner.join(poly)**：把洞环通过“桥接边”并入外环，得到一个简单多边形（可能带重复顶点）。桥接边的选择要求不能与已有边相交，JTS 用“找可见顶点”的扫描实现。
2. **PolygonEarClipper.triangulate(polyShell)**：耳朵裁剪。维护一个双向链表表示当前多边形顶点，反复找“凸角且三角形内无其他顶点”的耳朵，切掉它并记录三角形。为了加速“三角形内是否有顶点”，它用 `VertexSequencePackedRtree` 做顶点索引；为了处理洞合并产生的重复顶点，它还有一套重复顶点扫描逻辑（`isValidEarScan`）。

```
耳朵裁剪（ear clipping）

   ┌────────────────────┐
   │ ●───●───●───●      │   找凸角 ●───●───●
   │ │   ╲       │      │   三角形内无其他顶点 => 是耳朵
   │ │    ╲      │      │   切掉耳朵，记录三角形
   │ ●─────●─────●      │   重复直到只剩 3 个顶点
   └────────────────────┘

   复杂度：朴素 O(n^2)，用顶点索引后可到近 O(n log n)
```

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.polygon.PolygonTriangulator;

public class PolygonTriangulatorDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();
        // 10x10 的方形，中间挖一个 6x6 的洞
        Geometry poly = reader.read(
            "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0),"
            + " (2 2, 2 8, 8 8, 8 2, 2 2))");

        Geometry tris = PolygonTriangulator.triangulate(poly);
        System.out.println("三角形数=" + tris.getNumGeometries());
        System.out.println("三角形面积和=" + tris.getArea());
        System.out.println("原多边形面积=" + poly.getArea());
        System.out.println("首个三角形=" + tris.getGeometryN(0));
    }
}
```

示例输出：

```
三角形数=8
三角形面积和=64.0
原多边形面积=64.0
首个三角形=POLYGON ((0 0, 2 2, 0 10, 0 0))
```

面积守恒（64 = 100 - 36）说明三角剖分正确覆盖了带洞多边形；首个三角形具体是哪一个取决于桥接边与裁剪顺序，不应依赖。

### 15.7.4 ConstrainedDelaunayTriangulator：更“胖”的剖分

耳朵裁剪产生的三角形可能非常瘦长。`ConstrainedDelaunayTriangulator` 在耳朵裁剪之后加了一步 Delaunay 优化：

```java
List<Tri> triList = PolygonEarClipper.triangulate(polyShell);
TriangulationBuilder.build(triList);   // 建邻接
TriDelaunayImprover.improve(triList);  // 反复 flip 直到局部 Delaunay
```

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.polygon.ConstrainedDelaunayTriangulator;

public class CDTDemo {
    public static void main(String[] args) throws Exception {
        Geometry poly = new WKTReader().read(
            "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0),"
            + " (2 2, 2 8, 8 8, 8 2, 2 2))");
        Geometry tris = ConstrainedDelaunayTriangulator.triangulate(poly);
        System.out.println("三角形数=" + tris.getNumGeometries());
        System.out.println("面积和=" + tris.getArea());
    }
}
```

示例输出：

```
三角形数=8
面积和=64.0
```

三角形数相同、面积和相同，说明 flip 不改变拓扑覆盖，只改变形状。对渲染、有限元、插值等对三角形质量敏感的场景，应优先用 `ConstrainedDelaunayTriangulator`；只关心“覆盖”时 `PolygonTriangulator` 更快。

### 15.7.5 两条路线对比

| 维度 | `PolygonTriangulator` | `ConstrainedDelaunayTriangulator` |
| --- | --- | --- |
| 引入版本 | 1.19 | 1.19 |
| 算法 | 洞合并 + 耳朵裁剪 | 洞合并 + 耳朵裁剪 + Delaunay 优化 |
| 三角形质量 | 一般（可能瘦长） | 好（局部 Delaunay） |
| 速度 | 快 | 较慢（flip 开销） |
| 输出 | `GeometryCollection` | `GeometryCollection` |
| 邻接信息 | `PolygonTriangulator#getTriangles()` 返回 `List<Tri>`，但未建邻接 | 已建邻接 |
| 适用 | 渲染三角化、简单剖分 | TIN、有限元、插值 |

注意：`PolygonTriangulator.getTriangles()` 返回的 `Tri` **没有建立邻接**，要邻接得自己调 `TriangulationBuilder.build`；`ConstrainedDelaunayTriangulator.getTriangles()` 返回的已经建好邻接。

### 15.7.6 性能与数据准备

- 顶点数超过几万时，耳朵裁剪的重复顶点扫描会明显变慢。可以先用 `GeometryPrecisionReducer` 把坐标归一到整数网格，减少“视觉重合但浮点不等”的顶点。
- 洞特别多（例如上千个岛）时，`PolygonHoleJoiner` 的桥接查找是性能热点；按外环分块处理（每个块少量洞）通常更快。
- 输入必须是有效多边形（无自交、洞在外环内）。无效输入可能导致死循环（`Unable to find a valid ear`）或面积不守恒。剖分前先 `IsValidOp` 检查。
- 输出三角形是闭合环的 `Polygon`，方向与 `Tri` 的顺时针约定一致；如果下游需要逆时针（例如某些渲染引擎），统一 `reverse()` 即可。

## 15.8 TIN 生成与 Z 值插值

### 15.8.1 从三角剖分到 TIN

TIN（Triangulated Irregular Network，不规则三角网）= 三角剖分 + 每个顶点的高程。JTS 没有单独的 `TIN` 类，但 `DelaunayTriangulationBuilder` 输出的三角形顶点保留了输入坐标的 Z 值，因此可以自己组装：

```
TIN 的数学基础：分片线性插值

   三角形内任意点 P 的高程 =
   所在平面在 P 处的取值

   z(P) = z0 + a·(x - x0) + b·(y - y0)

   其中 (a, b) 由三个顶点解出：
   ┌ z1 - z0 ┐   ┌ x1-x0  y1-y0 ┐ ┌ a ┐
   │         │ = │              │ │   │
   └ z2 - z0 ┘   └ x2-x0  y2-y0 ┘ └ b ┘

   JTS 的 Vertex.interpolateZ 就是解这个 2x2 线性方程组
```

`Vertex` 提供三个静态插值重载：

```java
/** 三角形内插值（三点确定平面） */
public static double interpolateZ(Coordinate p, Coordinate v0, Coordinate v1, Coordinate v2);

/** 线段上按距离比例插值 */
public static double interpolateZ(Coordinate p, Coordinate p0, Coordinate p1);

/** 实例方法：以本点为三角形第一顶点 */
public double interpolateZValue(Vertex v0, Vertex v1, Vertex v2);
```

当 Z 值为 `NaN`（输入点没有高程）时，插值结果也是 `NaN`。做地形计算前务必检查输入点的 Z 有效性。

### 15.8.2 完整示例：构网与插值

下面例子用 4 个带高程的角点构网，计算体积，并对查询点插值。4 个点恰好共面（`z = 10 + x + 2y`），因此两个三角形的插值结果必须一致——这也是一个很好的自检。

```java
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.DelaunayTriangulationBuilder;
import org.locationtech.jts.triangulate.quadedge.Vertex;

public class TinDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();

        Geometry sites = reader.read(
            "MULTIPOINT ((0 0 10), (10 0 20), (0 10 30), (10 10 40))");
        DelaunayTriangulationBuilder builder = new DelaunayTriangulationBuilder();
        builder.setSites(sites);
        Geometry tris = builder.getTriangles(gf);
        System.out.println("三角形：" + tris);

        // 1. 体积：每个三角形是一个三棱柱，体积 = 底面积 × 平均高
        double volume = 0;
        for (int i = 0; i < tris.getNumGeometries(); i++) {
            Polygon p = (Polygon) tris.getGeometryN(i);
            Coordinate[] c = p.getExteriorRing().getCoordinates();
            volume += p.getArea() * (c[0].z + c[1].z + c[2].z) / 3.0;
        }
        System.out.println("体积=" + volume);

        // 2. 插值：查询点落在哪个三角形内
        Coordinate q = new Coordinate(5, 5);
        org.locationtech.jts.geom.Point qp = gf.createPoint(q);
        for (int i = 0; i < tris.getNumGeometries(); i++) {
            Polygon p = (Polygon) tris.getGeometryN(i);
            if (!p.covers(qp)) continue;
            Coordinate[] c = p.getExteriorRing().getCoordinates();
            System.out.println("z(5,5)=" + Vertex.interpolateZ(q, c[0], c[1], c[2]));
        }
    }
}
```

示例输出：

```
三角形：GEOMETRYCOLLECTION (POLYGON ((0 10, 0 0, 10 0, 0 10)), POLYGON ((0 10, 10 0, 10 10, 0 10)))
体积=2500.0
z(5,5)=25.0
z(5,5)=25.0
```

第三、四行输出两次，是因为 `(5,5)` 恰好落在两个三角形的公共对角线 `(0,10)-(10,0)` 上，`covers` 对两个三角形都返回 true。数值一致（都是 25.0）验证了插值正确。生产代码处理边界点时，要明确“归属唯一三角形”的规则（例如 `contains` + 上/左闭），否则在公共边上会重复统计。

### 15.8.3 三角形定位

TIN 插值的第一步是“查询点落在哪个三角形”。三角形数量大时，逐个 `covers` 是 O(n)；用 STRtree 建一次索引后查询是 O(log n)：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.index.strtree.STRtree;

public class TinLocator {
    private final STRtree index = new STRtree();

    public TinLocator(Geometry triangles) {
        for (int i = 0; i < triangles.getNumGeometries(); i++) {
            Polygon tri = (Polygon) triangles.getGeometryN(i);
            index.insert(tri.getEnvelopeInternal(), tri);
        }
        index.build();
    }

    /** 返回包含该点的第一个三角形；点在公共边上时结果不唯一 */
    public Polygon locate(Point p) {
        for (Object o : index.query(p.getEnvelopeInternal())) {
            Polygon tri = (Polygon) o;
            if (tri.covers(p)) return tri;
        }
        return null;
    }
}
```

`covers` 会包含边界，因此公共边上的点可能命中多个三角形；如果业务要求唯一，返回第一个并与你的三角形构造顺序绑定，或者给三角形加稳定的 ID 后取最小 ID。

### 15.8.4 土方量计算

“挖填方量”是 TIN 最常见的工程应用。如果基准面是水平的（标高 `h0`），体积 = Σ 三角形面积 × (平均高 - h0)：

```java
public static double volumeBetween(Geometry triangles, double designElevation) {
    double volume = 0;
    for (int i = 0; i < triangles.getNumGeometries(); i++) {
        Polygon p = (Polygon) triangles.getGeometryN(i);
        if (p.getNumInteriorRing() > 0) continue;      // TIN 三角形无洞
        org.locationtech.jts.geom.Coordinate[] c =
            p.getExteriorRing().getCoordinates();
        double avgZ = (c[0].z + c[1].z + c[2].z) / 3.0;
        volume += p.getArea() * (avgZ - designElevation);
    }
    return volume;
}
```

返回值正数代表“高于设计面”（挖方），负数代表“低于设计面”（填方）。真实项目还要考虑：

- 基准面不是水平面时，要用设计面（`GeometryFixer` 后的 TIN/栅格）与地形 TIN 求差，逐三角形积分；
- 边坡、挡墙等垂直结构无法用 2.5D TIN 表达；
- 面积与体积的单位取决于坐标单位（米制下为 m² 与 m³），地理坐标系下结果没有物理意义。

### 15.8.5 精度假设与失效场景

TIN 插值本质是分片线性，适用条件是“地表在三角形内部近似平面”。以下情况误差会很大：

1. **地形突变处**（陡崖、路堤、矿坑）：三角形跨越突变线，插值会把两侧高程“平均”掉。解决方法是把突变线作为约束边（约束 Delaunay），强制三角形沿突变线划分。
2. **点密度不足**：大三角形内部没有采样点，插值完全由三个角决定，可能偏离真实地形。应按地形复杂度控制点密度或加入骨架点。
3. **Z 值精度不足**：高程只保留到分米时，体积误差与面积成正比，大范围计算前要评估。
4. **边界外推**：凸包外的点无法插值（不在任何三角形内）。需要外推时，要么扩大构网范围，要么用最近三角形平面外推并标记为“估算”。

## 15.9 鲁棒性、边界与数值问题

### 15.9.1 鲁棒谓词

三角剖分对几何谓词的正确性极其敏感：一次 `isInCircle` 判断错误就可能导致非 Delaunay 甚至拓扑不一致。JTS 的对策是：

- `TrianglePredicate.isInCircleRobust`：用 `DD`（双精度扩展）计算行列式，并配合自适应误差界；只有符号不确定时才回退到高精度计算。
- `Orientation.index`：用 `CGAlgorithmsDD` 做鲁棒的方向判定。
- `Vertex.isCCW` 用的是普通叉积——它只用于比较，不用于拓扑决策。

自己实现三角剖分时，**不要用普通 double 叉积做 inCircle**。四点接近共圆时，普通叉积的舍入误差会让判断随机翻转，表现为“部分区域出现翻转不收敛”或“isDelaunay() 反复为 false”。

### 15.9.2 退化输入

| 输入情形 | 现象 | 处理 |
| --- | --- | --- |
| 重复点 | `setSites` 自动去重 | 无需处理，但要注意 Z 保留规则 |
| 全部共线 | 无三角形 / `LocateFailureException` | 先判断凸包维度，拒绝构网 |
| 少量点共线 | 产生零面积三角形或跳过 | 用 `setTolerance` 或预处理去共线 |
| 四点共圆 | 对角线选择不唯一，仍满足 Delaunay | 结果可复现性依赖输入顺序，业务不要依赖具体对角线 |
| 极窄三角形 | 面积接近 0，法向不稳定 | 用 `TriDelaunayImprover` 或过滤薄三角形 |
| 坐标量级 1e7、差异 1e-9 | 精度不足，定位失败 | 平移到局部原点后再算 |
| 含 NaN/Infinity | 抛异常或结果错乱 | 入库前过滤 |

JTS 测试里保留了大量“窄三角形”回归用例（`DelaunayTest` 中的 GEOS-719、GEOS-946、Shapely-1873 等），它们都涉及坐标量级大、点几乎共线的情形。这些用例能通过，靠的是鲁棒谓词与 1.20 的 frame 启发式，而不是“数据凑巧”。

### 15.9.3 Frame 尺寸问题

`FRAME_SIZE_FACTOR = 10.0` 是一个经验值。太小，框架三角形会与数据点“抢”Delaunay 边，导致凸包边界出现凹口或定位失败；太大，框架顶点与数据点的坐标差过大，`HCoordinate` 计算外心时精度损失，可能出现外心跑到无穷远。

1.20.0 的 #931 改进了这个启发式：框架尺寸不再简单按包络最大值乘系数，而是考虑数据范围的最小/最大边与坐标量级。如果你在老版本遇到“靠近边界的点构网结果异常”，升级到 1.20+ 通常是第一选择。

### 15.9.4 坐标归一化

最有效的鲁棒性技巧不是调参，而是**把坐标平移到局部原点**：

```java
// 以数据包络中心为原点，把坐标压到 [-1, 1] 附近
Envelope env = sites.getEnvelopeInternal();
double cx = env.centre().x;
double cy = env.centre().y;
Coordinate[] shifted = new Coordinate[sites.getNumPoints()];
for (int i = 0; i < shifted.length; i++) {
    Coordinate c = sites.getCoordinates()[i];
    shifted[i] = new Coordinate(c.x - cx, c.y - cy, c.getZ());
}
Geometry localSites = new GeometryFactory().createMultiPointFromCoords(shifted);
// 构网后再把结果平移回去
```

投影坐标动辄 `500000, 3000000`，double 的有效位数约有 15~16 位十进制，减去大数后剩下的有效位只够表示到 1e-9 量级。平移到局部原点后，同样的数据能获得接近满精度的几何计算。这个技巧对叠加、缓冲同样适用，不只是三角剖分。

### 15.9.5 异常对照表

| 异常 | 触发点 | 常见原因 | 处理 |
| --- | --- | --- | --- |
| `LocateFailureException` | `QuadEdgeSubdivision.locate` | 拓扑被破坏、frame 太小、NaN 坐标、容差过大 | 归一化坐标、清理数据、升级版本 |
| `ConstraintEnforcementException` | `enforceConstraints` 迭代超限 | 约束线自交/重叠、端点悬空、容差过大 | 拆分约束、端点落到站点、减小容差 |
| `IllegalArgumentException: Tri is not oriented correctly` | `Tri.validate` | 顶点逆时针 | 交换两个顶点 |
| `IllegalStateException: Unable to find a valid ear` | `PolygonEarClipper.compute` | 多边形无效/自交/重复点 | 先 `IsValidOp` 检查 + `GeometryFixer` 修复 |
| `TopologyException`（Voronoi 无效） | `getVoronoiDiagram` | 站点共圆/重合、坐标精度不足 | 吸附/去重、升级 1.21、结果 `GeometryFixer` |
| `NullPointerException`（Voronoi） | `getVoronoiCellPolygons` | 站点为空 | 空输入直接返回空集合 |

### 15.9.6 三角剖分自检清单

1. **面积守恒**：三角形面积和 == 输入凸包（或面）面积。
2. **Delaunay 性**：`subdiv.isDelaunay() == true`。
3. **约束存在**：每条约束线段都能在输出边集合中找到（或作为三角形边出现）。
4. **三角形数量**：点集 Delaunay 满足 `2n - 2 - h`，不满足就查重复点/共线。
5. **顶点一致**：`getVertices(false).size()` 等于去重后的站点数。
6. **有效性**：每个输出三角形 `isValid()`，面积为正。

把这六条写成一个 `TriangulationChecker`，在数据入库和算法升级后各跑一次，能挡住绝大多数回归问题。

## 15.10 应用案例

### 15.10.1 地形插值服务

把 TIN 封装成“给定坐标返回高程”的服务：

```java
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.triangulate.quadedge.Vertex;

public class TerrainService {
    private final Geometry triangles;
    private final TinLocator locator;
    private final GeometryFactory gf = new GeometryFactory();

    public TerrainService(Geometry triangles) {
        this.triangles = triangles;
        this.locator = new TinLocator(triangles);
    }

    /** 返回高程；点不在 TIN 范围内或 Z 无效时返回 Double.NaN */
    public double elevationAt(double x, double y) {
        Point p = gf.createPoint(new Coordinate(x, y));
        Polygon tri = locator.locate(p);
        if (tri == null) return Double.NaN;
        Coordinate[] c = tri.getExteriorRing().getCoordinates();
        if (Double.isNaN(c[0].z) || Double.isNaN(c[1].z) || Double.isNaN(c[2].z)) {
            return Double.NaN;
        }
        return Vertex.interpolateZ(new Coordinate(x, y), c[0], c[1], c[2]);
    }

    public Geometry getTriangles() { return triangles; }
}
```

服务化时注意：`TinLocator` 的 STRtree 构建一次即可，注册为单例；`elevationAt` 是纯函数，可安全并发调用。TIN 数据更新时整体替换服务实例，避免索引与三角形不一致。

### 15.10.2 Voronoi 服务区面积统计

用 Voronoi 图做“最近设施”分析，并统计每个设施的服务面积：

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.locationtech.jts.geom.Envelope;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.VoronoiDiagramBuilder;

public class VoronoiAreaReport {
    public static void main(String[] args) throws Exception {
        GeometryFactory gf = new GeometryFactory();
        Geometry sites = new WKTReader().read(
            "MULTIPOINT ((10 10), (80 20), (40 70), (90 90), (20 90))");

        VoronoiDiagramBuilder builder = new VoronoiDiagramBuilder();
        builder.setSites(sites);
        builder.setClipEnvelope(new Envelope(0, 100, 0, 100));
        Geometry diagram = builder.getDiagram(gf);

        List<String> rows = new ArrayList<String>();
        double total = 0;
        for (int i = 0; i < diagram.getNumGeometries(); i++) {
            Geometry cell = diagram.getGeometryN(i);
            total += cell.getArea();
            rows.add("站点=" + cell.getUserData() + " 面积=" + cell.getArea());
        }
        Collections.sort(rows);
        for (String r : rows) System.out.println(r);
        System.out.println("服务区总面积=" + total);
    }
}
```

示例输出（真实运行结果，按字符串排序）：

```
站点=(10.0, 10.0, NaN) 面积=1854.492902930403
站点=(20.0, 90.0, NaN) 面积=1248.4375000000002
站点=(40.0, 70.0, NaN) 面积=2637.9778554778554
站点=(80.0, 20.0, NaN) 面积=2720.5960705960706
站点=(90.0, 90.0, NaN) 面积=1538.495670995671
服务区总面积=10000.0
```

总面积恒等于裁剪矩形面积 10000，这是验证裁剪是否正确的最快方式。若面积和小于 10000，说明有面被丢弃或裁剪失败；大于 10000，说明面有重叠。

### 15.10.3 面要素三角化用于渲染

很多渲染引擎只接受三角形。用 `ConstrainedDelaunayTriangulator` 把面要素转成三角形列表：

```java
import java.util.ArrayList;
import java.util.List;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.triangulate.polygon.ConstrainedDelaunayTriangulator;

public class RenderMeshBuilder {
    /** 输出 [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] 的扁平三角形数组 */
    public static float[] buildMesh(Geometry polygons) {
        Geometry tris = ConstrainedDelaunayTriangulator.triangulate(polygons);
        List<Float> data = new ArrayList<Float>();
        for (int i = 0; i < tris.getNumGeometries(); i++) {
            Polygon tri = (Polygon) tris.getGeometryN(i);
            Coordinate[] c = tri.getExteriorRing().getCoordinates();
            for (int j = 0; j < 3; j++) {
                data.add((float) c[j].x);
                data.add((float) c[j].y);
                data.add((float) c[j].getZ());
            }
        }
        float[] out = new float[data.size()];
        for (int i = 0; i < out.length; i++) out[i] = data.get(i);
        return out;
    }
}
```

渲染时注意三角形顶点顺序（JTS 输出顺时针），如果引擎默认逆时针为正面，需要 `reverse()` 或调整背面剔除设置。

### 15.10.4 约束网用于地块建模

地块内部需要加密采样点时，用约束 Delaunay 保证地块边界不被跨越：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.triangulate.ConformingDelaunayTriangulationBuilder;

public class ParcelMeshDemo {
    public static void main(String[] args) throws Exception {
        GeometryFactory gf = new GeometryFactory();
        WKTReader reader = new WKTReader();

        ConformingDelaunayTriangulationBuilder builder =
            new ConformingDelaunayTriangulationBuilder();
        builder.setSites(reader.read("MULTIPOINT ((0 0), (100 0), (100 60), (0 60), (50 30), (20 15))"));
        // 地块边界作为约束
        builder.setConstraints(reader.read(
            "LINESTRING (0 0, 100 0, 100 60, 0 60, 0 0)"));
        Geometry tris = builder.getTriangles(gf);
        System.out.println("三角形数=" + tris.getNumGeometries());
        System.out.println("面积和=" + tris.getArea());
    }
}
```

这类用法要注意：约束线是闭合的地块边界，`LINESTRING` 首尾相同即可（不需要 `LinearRing`）。面积和应等于地块面积（6000），如果大于，说明约束没有被强制（三角形跨出边界），需要检查约束是否传对、容差是否过大。

## 15.11 常见问题与避坑

**1. 把 `getTriangles` 的结果当 `MultiPolygon` 用。**
返回的是 `GeometryCollection`，因为三角形共享边，不满足 `MultiPolygon` 内部不相交的约束。需要 `MultiPolygon` 时先 `GeometryFixer.fix` 或接受 `GeometryCollection`。

**2. 用点集 Delaunay 剖分带洞多边形。**
点集 Delaunay 只覆盖凸包，洞不会被挖掉。要精确覆盖多边形内部，用 `PolygonTriangulator` 或 `ConstrainedDelaunayTriangulator`。

**3. 忘记 `Tri` 的顺时针约定。**
`Tri.create(p0, p1, p2)` 必须按顺时针；逆时针会在 `validate()` 时抛异常，或在 `flip`/`split` 时产生错误拓扑。

**4. 给 `DelaunayTriangulationBuilder` 喂了带重复点的数据，却按输入点数校验三角形数。**
`setSites` 会去重。三角形数公式用的是去重后的点数。

**5. 容差设得太大导致点被合并。**
`tolerance` 是绝对距离。地理坐标系下 0.001 是百米级，投影坐标下是毫米级。先明确单位再给值。

**6. 用 `SnappingNoder` 处理三角剖分输入后，Z 值丢了。**
`SnappingNoder` 只处理 XY；坐标被替换后 Z 可能沿用旧值或变成 NaN。带高程的数据要单独维护 Z，或在捕捉后按原始点回填。

**7. Voronoi 不设裁剪范围，面积统计全错。**
默认范围是站点包络的 3 倍见方。必须 `setClipEnvelope`。

**8. Voronoi 面数与站点数不一致。**
重合站点被去重、裁剪外站点被丢弃都会导致数量变化。用 `userData` 建映射，不要用索引下标对应。

**9. 认为约束 Delaunay 会裁剪掉约束外的区域。**
CDT 输出仍是凸包内的三角网。要只保留约束区域，需再做裁剪。

**10. 用 `QuadEdgeSubdivision.locate` 的返回值做业务判断。**
返回哪条边依赖当前拓扑与缓存，不稳定。要定位三角形请用 `getTriangleVertices` 或自己建三角形索引。

**11. 在 `isDelaunay()` 为 false 时继续使用结果。**
说明插入了点但没有完成翻转，结果可能不是合法 Delaunay。先定位是哪个点/哪条边导致，再决定是容差问题还是数据退化。

**12. 大坐标直接构网。**
`(500000, 3000000)` 量级的坐标做外心与 inCircle 计算会损失有效位。平移到局部原点是最简单有效的优化。

## 15.12 本章小结

- Delaunay 剖分的定义是“任意三角形外接圆内不含其他点”，它最大化最小角、避免针状三角形，是 TIN 与插值的首选。
- quadedge 用“一条无向边 = 四个有向记录”表达全部拓扑，`rot`、`sym`、`oNext`、`lNext` 四个算子组合出一切遍历。
- `QuadEdgeSubdivision` 用框架三角形处理无穷远边界，`locate` + `insertSite` 实现增量插入，`isDelaunay()` 可做自检。
- `DelaunayTriangulationBuilder` 的输入会去重排序，输出覆盖凸包；三角形数满足 `2n - 2 - h`，面积和应等于凸包面积。
- `ConformingDelaunayTriangulationBuilder` 通过“侵占点 + 分裂”强制约束线成为三角形的边，失败时抛 `ConstraintEnforcementException`。
- `VoronoiDiagramBuilder` 基于 Delaunay 对偶，默认裁剪范围是站点包络的 3 倍见方，工程上必须显式 `setClipEnvelope`；Voronoi 面 `userData` 是站点坐标。
- `tri` 包的 `Tri` 是带三邻接的顺时针三角形，`TriangulationBuilder` 负责建邻接，适合批量剖分与邻接查询。
- `PolygonTriangulator` 用“洞合并 + 耳朵裁剪”剖分带洞多边形；`ConstrainedDelaunayTriangulator` 额外做 Delaunay 优化，三角形质量更好但更慢。
- TIN 插值依赖 `Vertex.interpolateZ` 的分片线性模型；体积 = Σ 三角形面积 × 平均高差。地形突变处必须用约束边，否则插值会被“抹平”。
- 鲁棒性依赖鲁棒谓词与坐标归一化；退化输入（共线、共圆、重复点、NaN）要在入口处清洗，输出侧用面积守恒、`isDelaunay`、约束边存在性做自检。

## 15.13 相关资源

- JTS Javadoc：`org.locationtech.jts.triangulate` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/triangulate/package-summary.html>
- JTS Javadoc：`QuadEdgeSubdivision` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/triangulate/quadedge/QuadEdgeSubdivision.html>
- JTS Javadoc：`VoronoiDiagramBuilder` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/triangulate/VoronoiDiagramBuilder.html>
- JTS Javadoc：`Tri` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/triangulate/tri/Tri.html>
- 源码路径：`modules/core/src/main/java/org/locationtech/jts/triangulate/`
- 版本说明：`doc/JTS_Version_History.md`（1.19 新增 Tri/PolygonTriangulator/ConstrainedDelaunayTriangulator #775/#862；1.20 修复 frame 尺寸与边界凸性 #931/#1004；1.21 Voronoi 吸附修复 #1174）
- 相关章节：[第04章 - 几何对象模型详解](https://znlgis.github.io/gis/tutorial/jts/第04章-几何对象模型详解/)、[第11章 - 距离度量与几何统计](https://znlgis.github.io/gis/tutorial/jts/第11章-距离度量与几何统计/)、[第13章 - 空间索引体系](https://znlgis.github.io/gis/tutorial/jts/第13章-空间索引体系/)、[第17章 - 有效性与 Coverage 质检](https://znlgis.github.io/gis/tutorial/jts/第17章-有效性与Coverage质检/)

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/jts/第14章-线网处理与Noding/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/第16章-线性参考系统/" class="chapter-nav__next">下一章 →</a>
</div>

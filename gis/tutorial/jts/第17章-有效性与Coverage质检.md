---
layout: default
title: 第17章 - 有效性与 Coverage 质检
---

# 第17章 - 有效性与 Coverage 质检

## 17.1 质检的两个层次：几何有效性与覆盖率有效性

### 17.1.1 为什么“能算”不等于“算对”

在 GIS 工程里，最容易被忽略的一类事故是：数据本身拓扑错误，但算法仍然返回了结果。JTS 的大多数空间操作假设输入几何是**有效的**（valid，符合 OGC Simple Features 规范）；当输入无效时，叠加分析、缓冲区、三角剖分等算法并不会主动报错，而是产生难以解释的结果——面积偏大、孔洞消失、多边形被劈成碎片，甚至抛出 **TopologyException**。

更隐蔽的是第二类问题：**单个要素有效，但要素之间关系错误**。相邻的两个行政区块都各自有效，却存在 1 厘米的缝隙或 2 厘米的重叠；单独检查每个多边形都通过，叠加成一张图时就无法得到无缝无叠的覆盖率。JTS 1.20 引入的 **coverage** 包专门解决这一类“要素间质检”。

本章围绕这两层质检展开：

- 第一层：单要素有效性，用 **IsValidOp**、**IsSimpleOp**、**RepeatedPointTester** 检查，用 **GeometryFixer** 修复；
- 第二层：要素间覆盖有效性，用 **CoverageValidator**、**CoveragePolygonValidator**、**CoverageGapFinder** 检查缝隙与重叠，用 **CoverageCleaner** 清理、**CoverageSimplifier** 化简、**CoverageUnion** 高效合并。

读完后你应当能够：独立设计一条“解析 → 单要素校验 → 修复 → 覆盖率校验 → 清理 → 入库”的质检流水线，并解释每条检查背后的算法与代价。

### 17.1.2 三层质检模型

工程上通常把质检拆成三层，越往下越贵：

```
┌──────────────────────────────────────────────────────────────┐
│ 第 1 层：语法与数值                                           │
│   坐标是否有限值（非 NaN / 非 Inf）、几何类型是否支持、        │
│   环是否闭合、点数是否足够                                    │
│   工具：IsValidOp.isValid(Coordinate)、IsValidOp、WKTReader   │
├──────────────────────────────────────────────────────────────┤
│ 第 2 层：单要素拓扑                                           │
│   环是否自相交、孔是否在壳内、孔是否嵌套、内部是否连通、      │
│   多部件是否嵌套 / 重复环                                     │
│   工具：IsValidOp.getValidationError、GeometryFixer           │
├──────────────────────────────────────────────────────────────┤
│ 第 3 层：要素间关系（覆盖率）                                 │
│   内部是否互不相交、公共边是否精确匹配、是否存在窄缝 / 重叠    │
│   工具：CoverageValidator、CoverageGapFinder、CoverageCleaner │
└──────────────────────────────────────────────────────────────┘
```

三层检查的成本差异很大。第 1 层基本是线性扫描；第 2 层需要对环做 noding（先求交再判拓扑），复杂度与顶点数近似 O(n log n)；第 3 层要对整个数据集建 **STRtree** 索引并做相邻要素间的线段匹配，成本与要素数量、共享边数量都相关。因此质检系统的设计原则是：**便宜的先做，昂贵的按需做，检查结果可缓存**。

| 检查层次 | 典型 API | 输入 | 典型耗时（1 万顶点多边形） | 能否自动修复 |
| --- | --- | --- | --- | --- |
| 数值合法性 | IsValidOp.isValid(Coordinate) | 单个坐标 | 纳秒级 | 可（删除非法点） |
| 单要素有效性 | IsValidOp.isValid(Geometry) | 单个几何 | 毫秒级 | 多数可（GeometryFixer） |
| 简单性 | IsSimpleOp.isSimple(Geometry) | 线或面 | 毫秒级 | 部分可 |
| 覆盖率有效性 | CoverageValidator.validate(Geometry[]) | 一组面 | 与相邻对数成正比 | 可（CoverageCleaner） |
| 窄缝检测 | CoverageGapFinder.findGaps | 一组面 | 较高（需先 Union） | 可（CoverageCleaner） |

## 17.2 OGC SFS 有效性规则

### 17.2.1 点与线的有效性

JTS 的有效性定义直接对应 OGC Simple Features 规范，判断入口是 **Geometry.isValid()**，内部委托给 **IsValidOp**。规则可以按几何类型逐条列出。

**Point**：坐标必须是有限值。**IsValidOp.isValid(Coordinate)** 会显式检查 x、y 是否为 NaN 或 Infinite，任一为真即判定无效，错误码为 **INVALID_COORDINATE**。

**MultiPoint**：每个点有效即可。注意，**MultiPoint 里存在完全重复的点仍然是有效的**——重复点属于“简单性”范畴，由 IsSimpleOp 处理，而不是有效性。

**LineString**：坐标有效，且**去重后的点数至少为 2**。源码中常量 `MIN_SIZE_LINESTRING = 2`，检查函数是 `isNonRepeatedSizeAtLeast`：连续重复的点不计数。

**LinearRing**：坐标有效、首尾坐标相同（闭合）、去重后至少 4 个点（三点才能围出面积，加上闭合点共 4 个）、且环自身不能自相交（端点重合是允许的）。这四条依次对应错误码 **INVALID_COORDINATE**、**RING_NOT_CLOSED**、**TOO_FEW_POINTS**、**RING_SELF_INTERSECTION**。

**GeometryCollection**：所有子要素都有效。

### 17.2.2 多边形的有效性

多边形是质检的主战场。一个 **Polygon** 有效，当且仅当：

1. 所有环坐标有效；
2. 所有环闭合；
3. 所有环去重后点数足够；
4. 任意两个环之间不存在“非法相交”——不穿越、不共线重叠、不产生重复环；
5. 每个孔都落在壳的内部（允许在边界上接触，但不能穿出）；
6. 孔与孔之间不嵌套；
7. 多边形的内部是连通的（不能因为孔与壳相切把内部切成两块）。

下面这张示意图列出最常见的四类无效多边形：

```
   自相交（蝴蝶结）        孔在壳外
   ┌──────────────┐        ┌──────────────┐
   │   ╱╲    ╱╲   │        │   ┌────┐     │
   │  ╱  ╲  ╱  ╲  │        │   │壳  │  ┌──┴──┐
   │ ╱    ╲╱    ╲ │        │   └────┘  │ 孔  │
   │ ╲    ╱╲    ╱ │        │           └──┬──┘
   │  ╲  ╱  ╲  ╱  │        │              │
   │   ╲╱    ╲╱   │        └──────────────┘
   └──────────────┘        错误码 2：HOLE_OUTSIDE_SHELL
   错误码 6：RING_SELF_INTERSECTION

   孔嵌套                  内部不连通（孔相切成“细腰”）
   ┌──────────────┐        ┌──────────────┐
   │ ┌──────────┐ │        │   ┌──────┐   │
   │ │ ┌──────┐ │ │        │   │ 孔 A │   │
   │ │ │ 内孔 │ │ │        │   └──┬───┘   │
   │ │ └──────┘ │ │        │      │       │
   │ └──────────┘ │        │   ┌──┴───┐   │
   │              │        │   │ 孔 B │   │
   └──────────────┘        │   └──────┘   │
   错误码 3：NESTED_HOLES   └──────────────┘
                            错误码 4：DISCONNECTED_INTERIOR
```

**MultiPolygon** 在此基础上增加三条要素间规则：

- 不同多边形的壳不能部分重叠，也不能沿边重叠（**SELF_INTERSECTION**，由 PolygonTopologyAnalyzer 报告）；
- 一个多边形的壳不能整体落在另一个多边形的内部（**NESTED_SHELLS**，由 IndexedNestedPolygonTester 报告）；
- 不能出现完全相同的环（**DUPLICATE_RINGS**）。

下表把错误码与触发条件、典型成因对应起来，便于质检报告落地：

| 错误码 | 常量名 | 含义 | 典型成因 |
| --- | --- | --- | --- |
| 0 | ERROR | 保留但未使用 | 历史遗留 |
| 1 | REPEATED_POINT | 已废弃 | SFS 认为重复点合法 |
| 2 | HOLE_OUTSIDE_SHELL | 孔部分或全部在壳外 | 编辑时拖动孔、数据合并错位 |
| 3 | NESTED_HOLES | 孔嵌套在另一个孔内部 | 挖洞操作叠加、面转环 |
| 4 | DISCONNECTED_INTERIOR | 内部被切成多块 | 孔与壳相切形成“细腰” |
| 5 | SELF_INTERSECTION | 两个环相交 | 多部件重叠、共享边未精确匹配 |
| 6 | RING_SELF_INTERSECTION | 单个环自相交 | 手工数字化打结、坐标舍入 |
| 7 | NESTED_SHELLS | 多部件的壳嵌套 | 岛被重复录入为大面的一部分 |
| 8 | DUPLICATE_RINGS | 两个环完全相同 | 重复要素、复制粘贴 |
| 9 | TOO_FEW_POINTS | 线或环点数不足 | 退化几何、抽稀过度 |
| 10 | INVALID_COORDINATE | 坐标为 NaN 或 Inf | 计算溢出、序列化异常 |
| 11 | RING_NOT_CLOSED | 环首尾不闭合 | 手工拼坐标、裁剪未闭合 |

### 17.2.3 空几何与“合法但荒谬”

空几何（EMPTY）一律有效，源码第一行就是 `if (g.isEmpty()) return true;`。这一点在批量质检时要特别小心：一个被误删成 EMPTY 的面要素不会在有效性检查中暴露，却会造成面积缺失。质检规则里应当额外加入“空值检查”和“面积阈值检查”，这两项 JTS 不负责。

同理，JTS 只回答“是否符合 SFS”，不回答“是否合理”。一个面积为 1e-9 平方米的碎片多边形完全有效，但它更可能是数字化噪声。业务质检必须在有效性之外叠加尺寸、面积、比例尺、属性完整性等规则。

## 17.3 IsValidOp：从布尔值到错误定位

### 17.3.1 两种调用姿势

最简单的用法是静态方法 **IsValidOp.isValid(Geometry)**，只返回布尔值。如果要定位问题，需要构造实例并调用 **getValidationError()**，它返回 **TopologyValidationError**，其中包含错误码、错误消息和错误位置坐标。

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.valid.IsValidOp;
import org.locationtech.jts.operation.valid.TopologyValidationError;

public class IsValidDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();

        // 蝴蝶结形状：环自相交
        Geometry bowtie = reader.read(
            "POLYGON ((0 0, 10 10, 10 0, 0 10, 0 0))");

        System.out.println("isValid = " + bowtie.isValid());   // false

        IsValidOp op = new IsValidOp(bowtie);
        TopologyValidationError err = op.getValidationError();
        if (err != null) {
            System.out.println("错误码 = " + err.getErrorType()); // 6
            System.out.println("错误消息 = " + err.getMessage());
            // Ring Self-intersection
            Coordinate pt = err.getCoordinate();
            System.out.println("错误位置 = " + pt);              // (5, 5)
            System.out.println("完整描述 = " + err);
            // Ring Self-intersection at or near point (5.0, 5.0, NaN)
        }
    }
}
```

需要注意：**getValidationError() 内部会重新执行一次完整校验**。如果同时需要布尔值和错误详情，不要先调 `isValid()` 再调 `getValidationError()`，直接取错误对象再判空即可，避免重复计算。

### 17.3.2 内部检查顺序与短路

IsValidOp 按几何类型分派，遇到第一个错误立即返回（短路）。多边形的检查顺序在源码中固定为：

1. 坐标有效性（对应 `checkCoordinatesValid`）；
2. 环闭合性（`checkRingsClosed`）；
3. 环点数（`checkRingsPointSize`）；
4. 环间相交分析（构造 **PolygonTopologyAnalyzer**，调用 `checkAreaIntersections`）；
5. 孔在壳内（`checkHolesInShell`）；
6. 孔不嵌套（`checkHolesNotNested`，内部用 IndexedNestedHoleTester）；
7. 内部连通（`checkInteriorConnected`）。

顺序不是随意排的，而是**前置条件**决定的：只有先确认环之间不相交，后面才能用“取孔上一个点做点在面内判断”这种廉价方法判断孔是否在壳内；否则孔穿出壳外的情形可能被误判。源码注释里也明确写了 `checkHolesInShell` 依赖“孔已经过测试，确认不与壳相交”。

```
        IsValidOp.isValid(Geometry)
                  │
                  ▼
        ┌───────────────────┐
        │ 按类型分派         │
        └─────────┬─────────┘
                  ▼
        ┌───────────────────┐   否    ┌──────────────┐
        │ 坐标为有限值？     ├────────►│ 错误码 10     │
        └─────────┬─────────┘         └──────────────┘
                  ▼
        ┌───────────────────┐   否    ┌──────────────┐
        │ 环首尾闭合？       ├────────►│ 错误码 11     │
        └─────────┬─────────┘         └──────────────┘
                  ▼
        ┌───────────────────┐   否    ┌──────────────┐
        │ 去重后点数足够？   ├────────►│ 错误码 9      │
        └─────────┬─────────┘         └──────────────┘
                  ▼
        ┌───────────────────────────┐ 是 ┌──────────────┐
        │ 环之间有非法相交？         ├───►│ 错误码 5 / 6  │
        │ （PolygonTopologyAnalyzer）│    │ 8 / 4        │
        └─────────┬─────────────────┘    └──────────────┘
                  │ 否
                  ▼
        ┌───────────────────┐   是    ┌──────────────┐
        │ 孔在壳外？         ├────────►│ 错误码 2      │
        └─────────┬─────────┘         └──────────────┘
                  ▼
        ┌───────────────────┐   是    ┌──────────────┐
        │ 孔嵌套？           ├────────►│ 错误码 3      │
        └─────────┬─────────┘         └──────────────┘
                  ▼
        ┌───────────────────┐   是    ┌──────────────┐
        │ 内部不连通？       ├────────►│ 错误码 4      │
        └─────────┬─────────┘         └──────────────┘
                  ▼ 否
              判定有效
```

### 17.3.3 自接触环：ESRI 兼容开关

默认情况下，两种“自接触成洞”的环被判为无效：

- **inverted shell**：壳自接触，接触点围出一个贴在壳上的洞；
- **exverted hole**：孔自接触，一个孔被分成两个仅在一点相接触的孔。

调用 **setSelfTouchingRingFormingHoleValid(true)** 后，这两类情况按 ESRI SDE 模型视为合法。但要注意源码注释里的限制：**只要自接触导致多边形内部不连通，仍然无效**，包括蝴蝶结壳、与壳另一点再接触的倒置壳、形成孤岛的 C 形孔等。

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.valid.IsValidOp;

public class SelfTouchingDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        // 壳自接触形成“倒置壳”（JTS 单元测试 ValidSelfTouchingRingTest 用例）
        Geometry g = reader.read(
            "POLYGON ((10 90, 90 90, 90 10, 10 10, 10 90, 20 70, 30 70,"
          + " 30 50, 40 50, 40 70, 30 70, 30 80, 10 90))");

        IsValidOp strict = new IsValidOp(g);
        System.out.println("默认判定 = " + strict.isValid()); // false

        IsValidOp esri = new IsValidOp(g);
        esri.setSelfTouchingRingFormingHoleValid(true);
        System.out.println("ESRI 兼容 = " + esri.isValid());  // true
    }
}
```

这个开关只影响“自接触成洞”一种情形，不会放过其他错误。与 PostGIS 的 `ST_IsValid(geom, 1)` 中“允许自接触环成洞”的旗标语义一致，跨库迁移数据时可用来对齐判定口径。

## 17.4 TopologyValidationError 全部错误码详解

### 17.4.1 错误对象的结构

**TopologyValidationError** 是一个很薄的值对象，只有两个字段：错误类型 `errorType` 与错误位置 `pt`。构造时会对坐标做一次 `copy()`，避免调用方后续修改坐标影响错误记录。对外 API 如下：

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `getErrorType()` | int | 错误码，对应类中定义的常量 |
| `getMessage()` | String | 错误消息，取自 `errMsg` 数组，不含位置 |
| `getCoordinate()` | Coordinate | 错误位置；构造时允许为 null |
| `toString()` | String | 消息 + “at or near point ...”，便于日志 |

`errMsg` 数组的下标就是错误码，所以 `getMessage()` 直接用 `errMsg[errorType]` 取值。如果拿到一个不认识的错误码，说明用了不匹配的 JTS 版本——错误码是公开常量，跨大版本保持稳定，但 0 与 1 两个码已经废弃。

### 17.4.2 逐码解析与复现

**错误码 2：HOLE_OUTSIDE_SHELL（孔在壳外）**。判定逻辑是先比包络：孔的包络若不能被壳的包络覆盖，直接判定孔在外；否则用 **PolygonTopologyAnalyzer.isRingNested** 判断孔是否被壳包含。错误位置取孔的首坐标（源码里是 `holePt0`），因此它可能只是“孔上离壳最近方向的一个点”，不一定是穿出点。复现：

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.valid.IsValidOp;
import org.locationtech.jts.operation.valid.TopologyValidationError;

public class HoleOutsideDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();
        // 壳是 0..10 的方块，孔却放在 20..25
        Geometry g = r.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0),"
                          + " (20 20, 25 20, 25 25, 20 25, 20 20))");
        TopologyValidationError e = new IsValidOp(g).getValidationError();
        System.out.println(e.getErrorType());  // 2
        System.out.println(e);                 // Hole lies outside shell at or near point (20, 20, NaN)
    }
}
```

**错误码 3：NESTED_HOLES（孔嵌套）**。检查由 **IndexedNestedHoleTester** 完成：对每个孔在孔集合中查询包络相交的候选，再用点在面内判断是否被另一个孔包含。注意这个检查的前提是“孔之间不交叉”，交叉情形会先被错误码 5 拦截。

**错误码 4：DISCONNECTED_INTERIOR（内部不连通）**。这是最容易被忽视的错误码。两种典型形态：

- 孔与壳在两点接触，接触点把多边形内部夹成一个“细腰”，几何上不连通；
- 多个孔与壳相切，形成一条把内部一分为二的“洞链”。

前者的位置由 **PolygonIntersectionAnalyzer** 记录的双接触点给出；后者由 **PolygonRing.findHoleCycleLocation** 在孔-壳接触图上找环得到。源码中 `isInteriorDisconnected()` 先看已有双接触点，再按 `isInvertedRingValid` 决定是否做自接触检查，最后做洞环检查。

**错误码 5：SELF_INTERSECTION（环间相交）**。用于多边形内部两个不同环（壳-孔、孔-孔）或 MultiPolygon 不同部件的环之间穿越、共线重叠的情形。**错误码 6：RING_SELF_INTERSECTION（环自相交）** 只针对单个环自身。两者由同一次 noding 分析产生，靠参与相交的环身份区分。

**错误码 7：NESTED_SHELLS（壳嵌套）**。MultiPolygon 中一个部件整体落在另一个部件内部。用 **IndexedNestedPolygonTester** 检测，位置取被嵌套多边形的内部点或首点。

**错误码 8：DUPLICATE_RINGS（重复环）**。两个环的顶点序列完全相同，noding 后表现为两组完全重合的线段。

**错误码 9：TOO_FEW_POINTS（点数不足）**。线去重后少于 2 点，或环去重后少于 4 点。注意“去重后”三个字：`LINESTRING (0 0, 0 0, 0 0)` 看起来有 3 个点，去重后只剩 1 个，判无效。

**错误码 10：INVALID_COORDINATE（非法坐标）**。x 或 y 为 NaN / Infinite。JTS 1.21 起 **WKTReader** 支持读入 `Inf` 与 `-Inf`（大小写不敏感），这意味着这类数据现在能进入内存，质检层必须显式拦截，而不是指望解析失败。

**错误码 11：RING_NOT_CLOSED（环未闭合）**。首个坐标与最后一个坐标不相等。注意 WKT 里写 `POLYGON ((...))` 时，很多工具会自动补闭合点，但手工拼数组不会。用 **GeometryFactory.createLinearRing(Coordinate[])** 时也不强制闭合，必须自己保证首尾一致。

### 17.4.3 错误定位的精度边界

TopologyValidationError 的坐标是“at or near”，不是精确的故障点。原因在于 JTS 在发现错误时只保留了一个代表性坐标：孔在壳外取孔首点，环自相交取交点，内部不连通取接触点。工程上若要精确定位，推荐两种做法：

1. 把错误坐标做成一个 **POINT** 输出到质检图层，配合原始要素渲染，由人工判读；
2. 对报错要素做“二分裁剪”：按包络四等分后分别校验，逐步缩小到具体子区域，再定位到坐标段。

第二种做法在超大要素（数十万顶点）上很实用，因为 IsValidOp 本身不提供错误所在环的索引。

## 17.5 自相交与环拓扑分析：PolygonTopologyAnalyzer

### 17.5.1 为什么不能只做两两求交

判断多边形有效性时，如果对每对环都调用一次 `intersection()`，复杂度会随环数平方增长，而且叠加运算本身也有鲁棒性风险。JTS 1.18.2 之后重写了这部分逻辑，改为**把所有环的线段当成一个整体做一次 noding**，在 noding 过程中用 **SegmentIntersector** 同步判定拓扑关系。核心类就是 **PolygonTopologyAnalyzer**。

它位于 `org.locationtech.jts.operation.valid` 包，**是包私有类**（源码声明为 `class PolygonTopologyAnalyzer`，没有 `public`），普通调用方拿不到。理解它的意义在于：读源码、调性能、解释错误码。

### 17.5.2 分析流程

```
  输入 Polygon / MultiPolygon
        │
        ▼
  createSegmentStrings()
  为每个环创建 SegmentString，并附带 PolygonRing 元信息
  （壳 or 孔、所属多边形编号、是否倒置）
        │
        ▼
  PolygonIntersectionAnalyzer（实现 SegmentIntersector）
        │
        ├── 记录穿越（crossing）→ 错误码 5 / 6
        ├── 记录共线重叠（collinear overlap）
        │     ├── 同向且完全相等 → 错误码 8
        │     └── 部分重叠、非同向 → 错误码 5
        ├── 记录自接触节点（self-touch node）
        │     ├── 允许倒置环 → 记录，供连通性检查
        │     └── 不允许 → 错误码 6
        └── 记录双接触（double touch）→ 错误码 4
        │
        ▼
  MCIndexNoder 完成 noding
        │
        ▼
  isInteriorDisconnected()
        ├── 双接触点已存在 → 不连通
        ├── 自接触检查（仅倒置环合法时）
        └── 洞环检查（PolygonRing 接触图找环）
```

### 17.5.3 PolygonIntersectionAnalyzer 的判定规则

noding 过程中，每对相交线段都会回调 `processIntersections`，分析器据两侧的 **PolygonRing** 身份与相交类型给出结论。规则可以整理为下表：

| 相交形态 | 环关系 | 判定 |
| --- | --- | --- |
| 线段在内部穿越 | 任意两个环 | 错误码 5（多部件时也是 5） |
| 交点恰为端点且两侧都是顶点 | 同一环相邻段 | 合法（正常折点） |
| 线段重合且方向相反、长度相等 | 壳与孔 / 两个孔 | 合法匹配边 |
| 线段重合且方向相同、长度相等 | 任意 | 错误码 8（重复环）或 5 |
| 线段共线但只有部分重叠 | 任意 | 错误码 5 |
| 环与自身在非相邻段相交 | 同一环 | 错误码 6 |
| 环与自身在非相邻段仅端点接触 | 同一环 | 默认错误码 6（自接触） |

“方向”在这里很关键。JTS 不要求环的方向符合右手规则，因此判断“合法匹配边”时必须比较两条共线线段在各自环中的走向：真实覆盖率里相邻多边形的公共边走向相反；若同向，说明两块面朝同一侧铺开，必然是重叠或重复。

### 17.5.4 内部连通性与“洞环”

一个多边形内部不连通，本质是“孔与壳的接触图里出现了把内部隔断的环”。把每个环看成一个节点，环与环的每个接触点看成一条边，若在这个图上能找到环（cycle），那么多边形内部就被切开了。源码中 **PolygonRing.findHoleCycleLocation** 负责在孔集合里找这种环，并返回一个接触点作为错误位置。

这也解释了一个常见困惑：**两个孔只在一点相切，为什么多边形无效？** 因为相切点把内部夹断成两块，面积为正的两块互不连通，违反了“内部连通”规则。把两个孔稍微拉开，或合并成一个大孔，即可修复。

### 17.5.5 源码视角：1.18.2 的重构

1.18.2 的版本历史里有一组相关条目：“Improve design and performance of IsValidOp”“Fix IsValidOp for repeated node points”（1.19）。重构前的实现基于 **GeometryGraph** 与 **EdgeEnd** 的拓扑图，内存与常数开销都大；重构后用 noding + SegmentIntersector 的流式分析，顺带把“重复节点导致误报”的老问题修掉。对使用者的直接影响是：

- IsValidOp 更快，尤其是多部件面；
- 重复点不再导致误报，但会在 noding 前被“跳过”，因此错误位置可能落在重复点附近；
- 内部类名变化，不要依赖 `operation.valid` 里的包私有实现类做扩展。

## 17.6 IsSimpleOp 与 RepeatedPointTester

### 17.6.1 简单性的定义

**简单性（simplicity）** 与有效性是两套独立的概念：

- **Point** 永远简单；
- **MultiPoint** 简单当且仅当没有重复点；
- **LineString** 简单当且仅当除端点外不自交；闭合线串（环）只在端点重合时仍算简单；
- **MultiLineString** 简单当且仅当每个元素简单，且元素之间的交点都必须是两个元素的边界点（边界规则可配置）；
- **Polygonal** 没有严格意义的简单性定义，IsSimpleOp 退化为“检查所有环是否简单”，因此 **不能** 用它替代 `isValid()`；
- **GeometryCollection** 简单当且仅当所有子要素简单。

```java
import java.util.List;
import org.locationtech.jts.algorithm.BoundaryNodeRule;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.valid.IsSimpleOp;

public class IsSimpleDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();

        // 一条自己穿过自己的线
        Geometry line = r.read("LINESTRING (0 0, 10 10, 10 0, 0 10)");
        System.out.println(IsSimpleOp.isSimple(line)); // false
        Coordinate bad = IsSimpleOp.getNonSimpleLocation(line);
        System.out.println(bad);                      // (5, 5, NaN)

        // 找出全部非简单点
        IsSimpleOp op = new IsSimpleOp(line);
        op.setFindAllLocations(true);
        List<Coordinate> pts = op.getNonSimpleLocations();
        System.out.println("非简单点数量 = " + pts.size());

        // 线性网络：使用端点边界规则，允许端点相接
        Geometry net = r.read(
            "MULTILINESTRING ((0 0, 5 0), (5 0, 10 0))");
        System.out.println("Mod-2 规则 = " + IsSimpleOp.isSimple(net));      // true
        IsSimpleOp endpointRule =
            new IsSimpleOp(net, BoundaryNodeRule.ENDPOINT_BOUNDARY_RULE);
        System.out.println("端点规则 = " + endpointRule.isSimple());         // true
    }
}
```

### 17.6.2 边界节点规则

简单性的边界判定由 **BoundaryNodeRule** 决定，JTS 内置四种：

| 常量 | 规则 | 适用场景 |
| --- | --- | --- |
| `MOD2_BOUNDARY_RULE` | 端点出现奇数次算边界（OGC SFS 默认） | 通用简单性判断 |
| `ENDPOINT_BOUNDARY_RULE` | 所有端点都算边界 | 线网连通性、管网拓扑 |
| `MULTIVALENT_ENDPOINT_BOUNDARY_RULE` | 端点出现两次及以上算边界 | 特殊网络模型 |
| `MONOVALENT_ENDPOINT_BOUNDARY_RULE` | 端点只出现一次才算边界 | 悬挂线检测 |

默认构造 `new IsSimpleOp(geom)` 使用 Mod-2 规则。注意 Mod-2 下闭合线串没有边界点，因此两条闭合线在端点处相切会被判为**不简单**；如果业务上认为“环端点相切可以接受”，改用端点规则。

### 17.6.3 实现要点

IsSimpleOp 的实现路径是：提取 SegmentString（**extractSegmentStrings**）→ 用 **MCIndexNoder** 做线段相交检测 → **NonSimpleIntersectionFinder** 作为 SegmentIntersector 判定每个交点是否“非简单”。判定逻辑有几层：

1. 跳过同一线段与自身；
2. 内部交点 → 非简单；
3. 两条线段完全相等（交点数为 2）→ 非简单；
4. 同一 SegmentString 的相邻线段交点 → 允许；
5. 交点不是两个 SegmentString 的端点 → 非简单；
6. 两个端点都在各自的闭合环上，且分属不同线 → 按 `isClosedEndpointsInInterior` 判定。

源码还专门处理了“重复端点”问题：`trimRepeatedPoints` 会去掉首尾连续的重复点，否则`LINESTRING (0 0, 0 0, 5 5)`这类数据会误报。这是 1.19 修复的问题（版本历史 #851）。

### 17.6.4 RepeatedPointTester：重复点检测

**RepeatedPointTester** 只做一件事：找出**连续重复坐标**。在 OGC SFS 中，重复点不再导致几何无效（错误码 1 已废弃），但重复点仍值得质检：

- 会让 WKB/WKT 体积膨胀；
- 会让某些算法的“边”为零长度，增加 noding 负担；
- 是数字化设备的常见产物，可作为数据质量指标。

```java
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.valid.RepeatedPointTester;

public class RepeatedPointDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();
        Geometry g = r.read("LINESTRING (0 0, 5 5, 5 5, 10 10)");

        RepeatedPointTester t = new RepeatedPointTester();
        System.out.println("有重复点 = " + t.hasRepeatedPoint(g)); // true
        Coordinate c = t.getCoordinate();
        System.out.println("重复坐标 = " + c);                     // (5, 5, NaN)

        // 也可以直接检查坐标数组
        boolean has = t.hasRepeatedPoint(g.getCoordinates());
        System.out.println(has);                                   // true
    }
}
```

注意：RepeatedPointTester 用 `Coordinate.equals` 判断相等，而 Coordinate 的 equals 等价于 **equals2D**，即只看 x、y。Z 值不同但平面位置相同的两个连续点，仍会被判为重复点。

## 17.7 GeometryFixer：无效几何的修复策略

### 17.7.1 设计目标与语义规则

**GeometryFixer**（1.18.2 引入，位于 `org.locationtech.jts.geom.util`）的定位是“把无效几何变成有效几何，并尽量保留形状与位置”。它不追求“最小编辑”，而是追求**确定性**：同样的输入永远得到同样的输出，且输出一定是合法几何。

源码 Javadoc 列出的语义规则可以视为修复契约：

1. x 或 y 为非有限值的顶点被删除（对应 `Coordinate.isValid()`）；
2. 连续重复点被压缩为一个点；
3. 空的原子几何原样返回；
4. 集合中的空元素被移除；
5. **Point**：保留合法坐标，否则变成 EMPTY；
6. **LineString**：修正坐标序列；
7. **LinearRing**：修正坐标；能保留环就保留，否则降级为 LineString；
8. **Polygon**：转换为有效 Polygon 或 MultiPolygon，尽量保留范围与顶点；与壳相交的孔从壳中减去；壳外的孔转换为独立多边形；
9. **MultiPolygon**：逐个修复后再做 union，消除部件间重叠；
10. **GeometryCollection**：逐元素修复；
11. 塌缩（collapse）处理由 `keepCollapsed` 控制：默认 false 转为空并从集合移除；true 转为低维几何。

### 17.7.2 两个关键参数

| 参数 | 默认值 | 含义 | 典型用法 |
| --- | --- | --- | --- |
| `keepCollapsed` | false | 塌缩的线/面是否保留为低维几何 | 需要保留“退化成线的面”时设为 true |
| `keepMulti` | true | 修复后只剩一个元素的 MULTI 是否仍返回 MULTI | 需要保持图层几何类型一致时保留默认 |

**为什么默认不保留塌缩？** 因为一个塌缩成线的多边形在业务上通常意味着数字化错误，转成 EMPTY 后被移除，能让问题在统计上暴露（要素数变少），而不是悄悄变成一条谁也不会注意的线。反之，如果下游系统的几何类型是强约束的（比如入库表要求 `geometry(MultiPolygon, 4326)`），保留 MULTI 更安全。

### 17.7.3 修复是怎么实现的

GeometryFixer 的实现可以拆成三个动作：

1. **清理坐标**：`fixCoordinates` 调用 **CoordinateArrays.removeRepeatedOrInvalidPoints**，再 `copyDeep` 复制，保证返回新数组；
2. **修复环**：`fixRing` 把环包装成 `Polygon`，调用 **BufferOp.bufferByZero(poly, true)**。零距离缓冲区会执行一次“输入简化 + 环规范化”，能把自相交环整理成合法的环序列；这是 JTS 里最稳健的“环修复”手段之一；
3. **处理孔与外环关系**：`fixHoles` 修复每个孔，然后 `classifyHoles` 用 **PreparedGeometry.intersects** 判断孔与壳是否相交——相交的孔作为“要减去的洞”，不相交的孔作为“独立壳”；最后用 **OverlayNGRobust.difference** 从壳中减洞，再用 **OverlayNGRobust.union** 合并所有壳。

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.util.GeometryFixer;
import org.locationtech.jts.io.WKTReader;

public class FixerDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();

        // 孔在壳外：修复后会得到一个 MultiPolygon（壳 + 由孔变成的面）
        Geometry bad1 = r.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0),"
                             + " (20 20, 25 20, 25 25, 20 25, 20 20))");
        Geometry fixed1 = GeometryFixer.fix(bad1);
        System.out.println(fixed1.getGeometryType()); // MultiPolygon
        System.out.println(fixed1.isValid());         // true
        System.out.println(fixed1.getNumGeometries()); // 2

        // 蝴蝶结：修复为合法面（可能被拆成多个部件）
        Geometry bad2 = r.read("POLYGON ((0 0, 10 10, 10 0, 0 10, 0 0))");
        Geometry fixed2 = GeometryFixer.fix(bad2);
        System.out.println(fixed2.isValid());          // true
        System.out.println(fixed2.getArea());          // 50.0

        // 塌缩控制：一个退化成线的面
        Geometry degenerate =
            r.read("POLYGON ((0 0, 1 1, 2 2, 0 0))");
        System.out.println(GeometryFixer.fix(degenerate).getGeometryType());
        // Polygon：默认 keepCollapsed=false，塌缩部件被清空为 EMPTY 面

        GeometryFixer fixer = new GeometryFixer(degenerate);
        fixer.setKeepCollapsed(true);   // 保留为低维几何
        fixer.setKeepMulti(false);      // 单元素 MULTI 降为单几何
        Geometry kept = fixer.getResult();
        System.out.println(kept.isValid()); // true
    }
}
```

上例中“退化成线的面”的默认输出在不同版本与输入细节下可能是空面或线，工程上不要依赖具体类型，**应当始终按 `isValid()` 与维度判断**，而不是断言几何类型。

### 17.7.4 修复的代价：必须复检与对比

GeometryFixer 的输入即使有效也会被处理并返回新对象（源码明确写着“Input geometries are always processed”）。因此：

- **不要把它当成免费的规范化步骤**放在每次操作前，开销相当于一次 buffer(0) 加若干次 overlay；
- **修复前后必须对比**：面积变化率、顶点数变化率、包络变化、部件数变化，超过阈值要进人工复核队列；
- **孔在壳外时会被转成独立多边形**，这意味着面积可能“变多”，地籍业务中必须拦截；
- 修复不做坐标吸附（snapping），1 厘米的错位依旧错位，要靠 **CoverageCleaner** 或专门的 snapping 处理；
- 修复后要重新跑 **IsValidOp**，虽然设计上保证有效，但上游若含非有限坐标或极端数值，仍建议复检。

## 17.8 Coverage 质量模型：从要素有效性到覆盖率有效性

### 17.8.1 什么是“有效的覆盖率”

**Polygonal coverage（多边形覆盖率）** 是一组满足两条规则的多边形：

1. 所有多边形的**内部互不相交**（可以沿边相邻，不能重叠，也不能完全相同）；
2. 若两个多边形的边界相交，则相交处的**顶点与线段必须精确匹配**——公共边两侧的顶点集合完全一致，不能一边有节点、另一边没有。

注意规则里没有“容差”二字。JTS 的覆盖率有效性是**零容差**判定：两个多边形共享边相差 1e-12 也会被判为无效。这是它与许多商业软件“带容差拓扑检查”的最大区别。

```
   合法覆盖率                    非法覆盖率（缝隙）
   ┌───────┬───────┐            ┌───────┐┌───────┐
   │   A   │   B   │            │   A   ││   B   │
   │       │       │            │       ││       │
   ├───────┼───────┤            └───────┘└───────┘
   │   C   │   D   │              中间出现细缝
   └───────┴───────┘

   非法覆盖率（重叠）            非法覆盖率（节点不匹配）
   ┌───────┐                     ┌───────┬───┬───┐
   │   A   │                     │   A   │ B │   │
   │  ┌────┴───┐                 │       ├───┘   │
   │  │   B    │                 │       │       │
   └──┴────────┘                 └───────┴───────┘
   A、B 内部相交                 B 边上有节点，A 边没有
```

覆盖率有效**允许空洞**（没有面覆盖的区域），也允许覆盖率由多个互不相连的区域组成。是否把空洞视为“缝隙错误”取决于业务与宽度阈值。

### 17.8.2 CoverageValidator：整组校验

**CoverageValidator**（1.20 新增，位于 `org.locationtech.jts.coverage`）是整组覆盖率校验的入口。核心 API：

| 方法 | 说明 |
| --- | --- |
| `isValid(Geometry[] coverage)` | 静态方法，返回整组是否有效 |
| `isValid(Geometry[] coverage, double gapWidth)` | 同时检查窄缝 |
| `validate(Geometry[] coverage)` | 返回与输入等长的数组，无效处为线几何，有效处为 null |
| `validate(Geometry[] coverage, double gapWidth)` | 带窄缝检测 |
| `hasInvalidResult(Geometry[] result)` | 判断结果数组中是否有非 null 项 |
| `setGapWidth(double)` | 实例方法，设置窄缝宽度阈值 |

实现思路很直接：先把所有多边形插入一个 **STRtree**，然后逐个多边形查询包络相交（并按 `gapWidth` 外扩）的邻居，交给 **CoveragePolygonValidator** 做局部校验，最后汇总成数组。

```java
import java.util.List;
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.io.WKTWriter;

public class CoverageValidateDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();
        Geometry[] coverage = new Geometry[] {
            // 两个正方形，共享边在 x = 10
            r.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))"),
            r.read("POLYGON ((10 0, 20 0, 20 10, 10 10, 10 0))")
        };

        System.out.println(CoverageValidator.isValid(coverage)); // true

        // 人为制造 0.1 的缝隙
        Geometry[] gapped = new Geometry[] {
            r.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))"),
            r.read("POLYGON ((10.1 0, 20 0, 20 10, 10.1 10, 10.1 0))")
        };
        // 注意：不带 gapWidth 时，互不相交的缝隙不算“无效覆盖率”
        System.out.println(CoverageValidator.isValid(gapped));       // true
        System.out.println(CoverageValidator.isValid(gapped, 0.2));  // false（缝隙宽 0.1 < 0.2）

        CoverageValidator v = new CoverageValidator(gapped);
        v.setGapWidth(0.15);
        Geometry[] errs = v.validate();
        WKTWriter w = new WKTWriter();
        for (int i = 0; i < errs.length; i++) {
            if (errs[i] != null) {
                System.out.println("要素 " + i + " 无效段: " + w.write(errs[i]));
            }
        }
        // 输出类似：要素 0 无效段: LINESTRING (10 0, 10 10)
    }
}
```

### 17.8.3 CoveragePolygonValidator：单面视角与六类错误

**CoveragePolygonValidator** 校验“一个目标多边形 + 一组相邻多边形”是否构成合法覆盖率。它的结果是一条线几何：目标多边形上导致无效的边界段；完全合法时返回空 LineString。

源码 Javadoc 明确列出它能检测的六类错误：

| 序号 | 错误类型 | 判定方式 |
| --- | --- | --- |
| 1 | 目标多边形与另一个多边形重复 | 规范化线段完全相同且方向相同 |
| 2 | 边界段与相邻段相等且同向 | 意味着两个面朝同一侧铺开，内部重叠 |
| 3 | 边界段共线重叠但长度不等 | 部分重叠 |
| 4 | 边界段在相邻段的非顶点处接触 | 节点不匹配（T 型接触） |
| 5 | 边界段穿入相邻多边形 | 穿越 |
| 6 | 边界段完全落在相邻多边形内部 | 包含 |

实现上分两步：先“标记匹配段”，再“标记无效段”。

- **标记匹配段**：把所有目标环和相邻环的线段做归一化（按坐标排序，方向可翻转），放入 HashMap。命中相同 key 时，比较两侧在环中的方向；方向相反是合法匹配，方向相同则是错误 1/2。匹配成功的线段标记为“已知”，后续不再检查——这让**合规数据**的校验非常快，因为大部分内部边都被提前标记。
- **标记无效段**：对剩余未匹配段，用 **MCIndexSegmentSetMutualIntersector**（带 `gapWidth` 作为距离容差）与相邻环做相交检测，由 **InvalidSegmentDetector** 标记错误 3/4/5；再对每个未匹配段检查端点是否落在相邻多边形内部，标记错误 6。为提升性能，源码按 `RING_SECTION_STRIDE = 1000` 把环切成 1000 段一段的“节”，按节的包络先筛相邻多边形，避免逐点做点在面内。

### 17.8.4 关于“匹配容差”的重要澄清

很多同学会问：能不能给 CoverageValidator 设置一个 0.001 米的匹配容差，让“差不多对齐”的边也算匹配？

**不能。** 源码里没有任何匹配容差参数，唯一与距离有关的参数是 `gapWidth`，而它只用于**额外识别窄缝**，不用于放宽边界匹配：

- 边界匹配是**精确的坐标比较**（线段端点相等）；
- `gapWidth` 的作用是把查询包络外扩，并把“距离小于阈值的窄缝”也标记为无效；
- 若数据存在系统性错位（例如两次数字化偏移 2 厘米），正确做法是先用 **CoverageCleaner** 的 snapping 把线work 吸附到一起，再做校验。

这一点在工程上极其重要：把期望寄托在“容差参数”上，会导致质检报告与真实拓扑状态不一致。

### 17.8.5 性能与分区

CoverageValidator 内部已有 STRtree，但整组校验仍然是一次性把所有面放进内存。面对百万级图斑，建议**按行政区/图幅分区**，每区单独校验，并注意：

- 分区边界处的共享边只属于一侧，校验时不会报错，但跨区错位会被漏检；因此要么给分区加 buffer 并把边界带纳入两侧，要么按“图幅 + 邻接图幅”成对校验；
- `gapWidth` 越大，外扩查询越多，性能下降；建议按数据精度设定（例如 1:500 数据取 0.05 米，1:2000 取 0.2 米）；
- 无效段结果数组与输入等长，100 万要素对应 100 万引用，内存可控（null 占一个引用），但若序列化成 WKT 输出要分批。

## 17.9 CoverageGapFinder：窄缝检测

### 17.9.1 与 Validator 内建窄缝检测的区别

CoverageValidator 的 `gapWidth` 是一种**启发式**检测：它把“未匹配段 + 近距离相邻段”标记为无效。它快，但有两个已知问题（源码 Javadoc 自己写明）：

- `gapWidth` 设得较大时，某些窄缝反而检测不到；
- 可能误报：把实际更宽的缝隙的一部分线work 标成缝隙。

**CoverageGapFinder** 是更准确的做法：先用 **CoverageUnion** 把整组覆盖合并成一张面，再检查合并结果里的**洞**，对每个洞计算**最大内切圆半径**，半径小于 `gapWidth / 2` 的洞判定为窄缝。

### 17.9.2 原理与限制

```
  coverage 数组
       │
       ▼
  CoverageUnion.union()  →  一张合并面（可能带洞）
       │
       ▼
  遍历每个洞（内环）
       │
       ▼
  MaximumInscribedCircle.isRadiusWithin(洞面, gapWidth / 2)
       │
       ├── true  → 该洞是“窄缝”，输出为面
       └── false → 正常空洞，忽略
```

限制（源码明确说明）：

- 输入覆盖率应当先通过 **CoverageValidator**；无效覆盖率可能导致漏报甚至异常；
- **把覆盖率分成两个互不相连区域的“缝”不会被识别**（因为 Union 后它不是一个洞）；
- **gore（三角楔形缝）不被识别为 gap**；
- 需要 JTS 1.20 及以上。

### 17.9.3 用法示例

```java
import org.locationtech.jts.coverage.CoverageGapFinder;
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class GapFinderDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();
        // 四个多边形拼成外框，中间留一个 2×2 的封闭空洞（合法覆盖率）
        Geometry[] coverage = new Geometry[] {
            r.read("POLYGON ((0 0, 10 0, 10 4, 6 4, 4 4, 0 4, 0 0))"),   // 下
            r.read("POLYGON ((0 6, 4 6, 6 6, 10 6, 10 10, 0 10, 0 6))"), // 上
            r.read("POLYGON ((0 4, 4 4, 4 6, 0 6, 0 4))"),               // 左
            r.read("POLYGON ((6 4, 10 4, 10 6, 6 6, 6 4))")              // 右
        };
        System.out.println(CoverageValidator.isValid(coverage));         // true

        // 空洞最大内切圆半径 = 1，宽度 = 2 < 2.5，判定为窄缝
        Geometry gaps = CoverageGapFinder.findGaps(coverage, 2.5);
        System.out.println(gaps.getGeometryType()); // Polygon（或 MultiPolygon）
        System.out.println(gaps.getArea());         // 4.0（2×2 的空洞）
        // 注意：不封闭、开口于覆盖边界的缝隙不会被识别（见 17.9.2）
    }
}
```

得到的缝面可以直接作为质检图层输出，用于人工修复，也可以交给 CoverageCleaner 自动合并。

## 17.10 CoverageCleaner：缝隙与重叠的自动清理

### 17.10.1 能力与处理流程

**CoverageCleaner** 是 1.21 新增的类（1.20 及以前没有），目标是：输入一组**各自有效**但彼此存在重叠、缝隙、节点不匹配的多边形，输出一组**一对一**的合法覆盖率多边形。注意“一对一”：输出数组与输入等长，但个别位置可能是 null。

```
  输入 coverage（各自有效，彼此可能重叠/有缝）
        │
        ▼
  ① 线work 吸附（Snapping）
     默认按输入范围直径的一小部分自动确定距离，
     消除小错位、保证公共边节点一致
        │
        ▼
  ② 重新多边形化 + 分类
     判断每个结果面是“单个父要素”“多个父要素重叠”“无父要素缝隙”
        │
        ├── 重叠 → 按合并策略并入某个父要素
        ├── 缝隙（宽度 < maxGapWidth）→ 并入共享边最长的相邻面
        └── 单一面 → 直接归属
        │
        ▼
  ③ 输出与输入一一对应的合法覆盖率
```

### 17.10.2 四种重叠合并策略

| 常量 | 值 | 策略 | 适用场景 |
| --- | --- | --- | --- |
| `MERGE_LONGEST_BORDER` | 0 | 并入公共边界最长的多边形（默认） | 通用，语义最自然 |
| `MERGE_MAX_AREA` | 1 | 并入面积最大的多边形 | 大面优先，减少碎面 |
| `MERGE_MIN_AREA` | 2 | 并入面积最小的多边形 | 小面优先，保持小要素完整 |
| `MERGE_MIN_INDEX` | 3 | 并入输入数组中下标最小的多边形 | 有优先级顺序的数据（先入为主） |

“最长公共边界”策略对地籍很友好：两块地重叠一条边时，重叠部分通常应归给与它共享边界更长的那块，而不是简单按面积。

### 17.10.3 参数与调用示例

静态方法有三个常用重载：

- `clean(Geometry[] coverage, double snappingDistance, int overlapMergeStrategy, double maxGapWidth)`：全参数；
- `clean(Geometry[] coverage, double snappingDistance, double maxGapWidth)`：默认最长边界策略；
- `cleanOverlapGap(Geometry[] coverage, int overlapMergeStrategy, double maxGapWidth)`：使用默认吸附距离；
- `cleanGapWidth(Geometry[] coverage, double maxGapWidth)`：默认吸附 + 默认策略。

`snappingDistance` 传 **-1** 表示自动计算（源码内部把初始值置为“待计算”，按输入范围推算）；传 **0** 关闭吸附。关闭吸附可能导致共线数据无法正确 noding，源码注释专门提醒了这一点。

```java
import org.locationtech.jts.coverage.CoverageCleaner;
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class CoverageCleanDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();
        Geometry[] dirty = new Geometry[] {
            r.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))"),
            r.read("POLYGON ((9.98 0, 20 0, 20 10, 9.98 10, 9.98 0))") // 重叠 0.02
        };

        System.out.println(CoverageValidator.isValid(dirty));      // false

        // 吸附距离 0.001，最长边界合并，缝隙宽度阈值 0.05
        Geometry[] clean = CoverageCleaner.clean(
            dirty, 0.001, CoverageCleaner.MERGE_LONGEST_BORDER, 0.05);

        System.out.println(clean.length);                          // 2（与输入等长）
        System.out.println(CoverageValidator.isValid(clean));      // true
        System.out.println(clean[0].getArea());                    // 约 100
        System.out.println(clean[1].getArea());                    // 约 100

        // 需要知道哪些重叠被合并、哪些缝隙被填了吗？
        CoverageCleaner cc = new CoverageCleaner(dirty);
        cc.setSnappingDistance(0.001);
        cc.setGapMaximumWidth(0.05);
        cc.clean();
        System.out.println("合并的重叠面数 = " + cc.getOverlaps().size());
        System.out.println("填平的缝隙数 = " + cc.getMergedGaps().size());
    }
}
```

### 17.10.4 结果语义与已知问题

- 输出数组与输入**一一对应**；某个输入若为非面或空、被吸附塌缩、或被另一个输入完全覆盖，对应输出为 **null**。入库前要处理 null（删除或标记）。
- 输出保证通过 `CoverageValidator.isValid`，但不保证与输入面积完全一致；缝隙被填、重叠被分，面积必然变化。业务上要设置面积变化阈值（例如 ±2%），超出转人工。
- 已知问题：**又长又窄、且与多个多边形相邻的缝隙**在合并后可能形成“尖刺”（归属给单个面后拉出一条细长凸起）。量产地籍数据若遇尖刺，可在清理后跑一遍 **CoverageSimplifier** 或在缝隙中部打断。
- 源码列出的未来增强包括：按面积设缝隙阈值、把长缝分段后再归属、支持每个多边形的优先级值。这意味着当前版本的合并策略是“全局统一”的，无法表达“这块地优先”。

## 17.11 CoverageSimplifier 与 CoverageUnion

### 17.11.1 拓扑保持化简：CoverageSimplifier

普通 **DouglasPeuckerSimplifier** 逐要素化简，会把共享边两侧简成不同折线，直接破坏覆盖率。**CoverageSimplifier**（1.20 增强）把整组覆盖作为输入，**共享边只化简一次**，因此化简结果仍然是合法覆盖率。

它使用类似 Visvalingam-Whyatt 的**面积法**：每次移除面积增量最小的顶点，直到面积容差用尽；对外暴露的 `tolerance` 是这个面积容差的平方根，量纲与坐标一致，可以粗略理解为“线最多偏移多少距离”。

关键特性（源码 Javadoc）：

- 输出要素数与输入相同；输入合法则输出合法；
- 节点（三个及以上多边形共享的顶点、两个及以上共享的边界顶点）保持不动；
- 多边形保持线邻接关系，边不会被删除；
- 环最少保留 4 个顶点；
- 小于面积容差的环（洞或孤岛）会被移除，但每个输入几何至少保留面积最大的一个部件；
- 支持分别设置内部边与外部边的容差，从而只化简“补丁内部”而不动外边界。

```java
import org.locationtech.jts.coverage.CoverageSimplifier;
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class CoverageSimplifyDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();
        Geometry[] cov = new Geometry[] {
            r.read("POLYGON ((0 0, 5 0, 10 0, 10 5, 10 10, 5 10, 0 10, 0 5, 0 0))"),
            r.read("POLYGON ((10 0, 15 0, 20 0, 20 10, 15 10, 10 10, 10 5, 10 0))")
        };

        // 统一容差
        Geometry[] s1 = CoverageSimplifier.simplify(cov, 1.0);
        System.out.println(CoverageValidator.isValid(s1)); // true

        // 只化简内部边（共享边），外边界不动
        Geometry[] s2 = CoverageSimplifier.simplifyInner(cov, 0.5);
        System.out.println(s2[0].getNumPoints() <= cov[0].getNumPoints()); // true

        // 实例方式：控制小环移除与平滑权重
        CoverageSimplifier cs = new CoverageSimplifier(cov);
        cs.setRemovableRingSizeFactor(1.0);
        cs.setSmoothWeight(0.5);          // 取值 0..1，越大越平滑
        Geometry[] s3 = cs.simplify(0.5, 2.0); // 内部 0.5、外部 2.0
        System.out.println(s3.length);    // 2
    }
}
```

注意：化简的容差单位是**坐标单位**。经纬度数据上传入 0.5 意味着 0.5 度，约 55 公里，会直接把小面抹平。这一点与第 19 章的坐标系陷阱直接相关。

### 17.11.2 CoverageUnion：覆盖率专用合并

覆盖率合并（把相邻面融成一张大面）有两种写法：

- `CoverageUnion.union(Geometry[])`：`org.locationtech.jts.coverage` 包下的便捷入口；
- `org.locationtech.jts.operation.overlayng.CoverageUnion.union(GeometryCollection)`：底层实现。

```java
import org.locationtech.jts.coverage.CoverageUnion;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class CoverageUnionDemo {
    public static void main(String[] args) throws Exception {
        WKTReader r = new WKTReader();
        Geometry[] cov = new Geometry[] {
            r.read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))"),
            r.read("POLYGON ((10 0, 20 0, 20 10, 10 10, 10 0))")
        };
        Geometry all = CoverageUnion.union(cov);
        System.out.println(all.getGeometryType()); // Polygon
        System.out.println(all.getArea());         // 200.0
    }
}
```

它比逐对 `union()` 快得多，因为利用了“公共边精确匹配”这一前提，直接把覆盖率边界链拼起来，不需要完整叠加。代价是**不做任何有效性检查**：输入不是合法覆盖率时，有时会抛 **TopologyException**，有时（更糟）会静默产出错误结果。所以生产流程一定是“先校验，后 Union”。

## 17.12 工程案例：地籍/行政区/国土调查质检流水线

### 17.12.1 整体流程

```
  原始数据（WKT/GeoJSON/SHP 转换后）
        │
        ▼
  ① 解析与坐标检查
     - 解析失败 / 空几何 / 非有限坐标 → 拒收
     - SRID 一致性检查（见第 19 章）
        │
        ▼
  ② 单要素有效性检查（IsValidOp）
     - 记录错误码与位置 → 质检报告
        │
        ├── 可修复（自相交、重复点、孔越界）→ GeometryFixer
        │        └── 修复后复检 + 面积变化阈值
        └── 不可接受 → 退回作业员
        │
        ▼
  ③ 上传/解析到要素池，按行政区（或图幅）分组
        │
        ▼
  ④ 覆盖率校验（CoverageValidator）
     - 要素间重叠 / 节点不匹配 / 窄缝
     - 输出无效段图层，定位到责任要素
        │
        ▼
  ⑤ 自动清理（CoverageCleaner）
     - 吸附距离按成图比例尺设定
     - 缝隙阈值按精度指标设定
     - 输出 null 与面积变化超限的要素进人工队列
        │
        ▼
  ⑥ 复核与入库
     - 复检覆盖率 + 单要素有效性
     - 汇总行政单元面积，与台账核对
     - 通过后写 PostGIS / 文件，保留质检报告
```

### 17.12.2 质检规则表

| 检查项 | 规则/阈值（示例） | 工具 | 不合格处置 |
| --- | --- | --- | --- |
| 坐标合法 | 无 NaN/Inf | IsValidOp.isValid(Coordinate) | 拒收 |
| 环闭合 | 首尾坐标相等 | IsValidOp | 自动修复 |
| 自相交 | 无 | IsValidOp（错误码 5/6） | GeometryFixer + 人工复核 |
| 孔越界/嵌套 | 无 | IsValidOp（2/3） | GeometryFixer |
| 重复点 | 数量占比 < 1% | RepeatedPointTester | 批量去重 |
| 最小面积 | 地籍 ≥ 1 平方米（按比例尺） | Geometry.getArea | 退回 |
| 要素间重叠 | 面积 > 0.001 平方米 | CoverageValidator | CoverageCleaner |
| 公共边匹配 | 零容差 | CoverageValidator | CoverageCleaner（吸附） |
| 窄缝 | 宽度 ≤ 0.05 米（1:500） | CoverageGapFinder / Validator | CoverageCleaner 填平 |
| 行政单元面积 | 与台账偏差 ≤ 0.1% | 汇总后比对 | 人工核查 |

### 17.12.3 批量实现骨架

```java
import java.util.ArrayList;
import java.util.List;
import org.locationtech.jts.coverage.CoverageCleaner;
import org.locationtech.jts.coverage.CoverageGapFinder;
import org.locationtech.jts.coverage.CoverageValidator;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.util.GeometryFixer;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.valid.IsValidOp;
import org.locationtech.jts.operation.valid.TopologyValidationError;

public class QcPipeline {
    static class Report {
        int total;
        int invalidInput;
        int fixed;
        int stillInvalid;
        int nullAfterClean;
        boolean coverageValid;
        double gapArea;
    }

    public static Report check(String[] wkts) throws Exception {
        WKTReader reader = new WKTReader();
        List<Geometry> fixedList = new ArrayList<Geometry>();
        Report rep = new Report();

        for (String wkt : wkts) {
            rep.total++;
            Geometry g = reader.read(wkt);
            IsValidOp op = new IsValidOp(g);
            TopologyValidationError err = op.getValidationError();
            if (err != null) {
                rep.invalidInput++;
                Geometry fixed = GeometryFixer.fix(g);
                if (fixed.isValid()) {
                    rep.fixed++;
                    fixedList.add(fixed);
                } else {
                    rep.stillInvalid++;
                }
            } else {
                fixedList.add(g);
            }
        }

        Geometry[] coverage = fixedList.toArray(new Geometry[0]);
        rep.coverageValid = CoverageValidator.isValid(coverage);

        Geometry gaps = CoverageGapFinder.findGaps(coverage, 0.05);
        rep.gapArea = gaps.getArea();

        Geometry[] clean = CoverageCleaner.clean(
            coverage, 0.001, CoverageCleaner.MERGE_LONGEST_BORDER, 0.05);
        int nulls = 0;
        for (Geometry c : clean) {
            if (c == null) nulls++;
        }
        rep.nullAfterClean = nulls;
        rep.coverageValid = CoverageValidator.isValid(clean);
        return rep;
    }

    public static void main(String[] args) throws Exception {
        String[] tiles = new String[] {
            "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))",
            "POLYGON ((10 0, 20 0, 20 10, 10 10, 10 0))"
        };
        Report rep = check(tiles);
        System.out.println("总数 = " + rep.total);
        System.out.println("输入无效 = " + rep.invalidInput);
        System.out.println("修复成功 = " + rep.fixed);
        System.out.println("覆盖率有效 = " + rep.coverageValid);
    }
}
```

### 17.12.4 报告与回归

质检系统必须留下**可追溯的报告**，否则修复动作无法解释。建议至少记录：

- 每个要素的质检结论、错误码、错误坐标；
- 修复前后面积、周长、顶点数、部件数；
- 覆盖率无效段的 WKT（可直接渲染）；
- 清理阶段的吸附距离、缝隙阈值、合并策略，以及哪些要素被置 null；
- 运行版本（JTS 版本、规则版本），便于复现。

回归测试的做法是维护一个“金标准”小数据集：每次升级 JTS 或调整阈值，跑一遍检查，对比错误码数量、无效段长度、面积变化分布。JTS 大版本之间这些算法有改进（例如 1.19 修 IsValidOp 重复点、1.21 修 BoundaryChainNoder 自接触），输出可能变化，靠回归集才能发现。

## 17.13 常见问题与避坑

### 17.13.1 十个高频坑

| 序号 | 坑 | 现象 | 正确做法 |
| --- | --- | --- | --- |
| 1 | 用 `isSimple()` 判多边形有效 | 自相交面被判“有效” | 有效性用 `isValid()`，简单性用 `IsSimpleOp` |
| 2 | 以为重复点无效 | 质检不报错，但 WKB 变大 | 用 RepeatedPointTester 单独统计 |
| 3 | 每次操作前都 `isValid()` | 吞吐量骤降 | 只在入口校验/修复，结果缓存 |
| 4 | GeometryFixer 之后不复检 | 修复后面积暴增 | 修复后复检 + 面积变化阈值 |
| 5 | 把 CoverageValidator 的 gapWidth 当匹配容差 | 质检永远不通过 | 用 CoverageCleaner 吸附 |
| 6 | 覆盖率校验只查单要素 | 缝隙没人管 | 成组 CoverageValidator |
| 7 | 对无效覆盖率直接 CoverageUnion | 偶发异常或静默错误结果 | 先校验后 Union |
| 8 | 坐标是经纬度却用米做缝隙阈值 | 阈值形同虚设 | 阈值与坐标单位一致（见第 19 章） |
| 9 | 分区校验忽略边界要素 | 跨区错位漏检 | 分区带 buffer 或成对校验 |
| 10 | 修复时 keepCollapsed 默认值误判 | 面悄悄消失 | 显式设置参数并统计空几何 |

### 17.13.2 性能清单

- **批量化**：CoverageValidator 一次传数组，别循环调单面版本；
- **先便宜后昂贵**：先坐标与结构检查，再有效性，最后覆盖率；
- **缓存**：有效性、覆盖率只依赖几何本身，可在入库时算一次存字段；
- **分区**：按行政单元或图幅切分，并行度按 CPU 核数但注意内存；
- **避免 WKT 反复序列化**：无效段结果直接传对象，落盘时再一次性写；
- **注意 `gapWidth` 与吸附距离不要设大**：会显著增加相交检测量。

## 17.14 本章小结

1. JTS 质检分两层：**单要素有效性**（IsValidOp）与**要素间覆盖率有效性**（CoverageValidator），两者判定规则完全不同，不可互相替代。
2. 有效性遵循 OGC SFS：坐标有限、环闭合、点数足够、环不自交、孔在壳内、孔不嵌套、内部连通；错误码 0~11 中 0 与 1 已废弃。
3. **IsValidOp.getValidationError()** 才带错误码与位置；它与 `isValid()` 都会完整执行校验，不要重复调用。
4. **isSimple()** 不是有效性检查；Polygonal 的简单性只检查环，不检查孔/嵌套/连通性。
5. 重复点在 SFS 下合法，但仍应作为数据质量指标用 **RepeatedPointTester** 统计。
6. **GeometryFixer** 是确定性的“转合法”工具：清理非法/重复坐标、零距离 buffer 修环、孔越界转面、多部件 union 消重叠；要显式设置 `keepCollapsed` 与 `keepMulti` 并复检。
7. 覆盖率有效性是**零容差**的：内部不重叠 + 公共边节点精确匹配；`gapWidth` 只用于窄缝识别，不是匹配容差。
8. **CoveragePolygonValidator** 能定位六类要素间错误并返回导致错误的边界线；**CoverageValidator** 用 STRtree 做整组校验。
9. **CoverageGapFinder** 用“合并后洞的最大内切圆”识别窄缝，比 Validator 的启发式更准，但识别不了把覆盖分成两块的缝。
10. **CoverageCleaner**（1.21 新增）吸附 + 合并重叠 + 填窄缝，输出与输入一一对应的合法覆盖率；**CoverageSimplifier** 拓扑保持化简；**CoverageUnion** 高效合并但要求输入合法。
11. 工程落地要有“检查 → 修复 → 复检 → 报告 → 回归”的闭环，并对面积/部件数变化设阈值，防止自动修复把业务数据改坏。

## 17.15 相关资源

- 系列目录：[JTS 教程目录](https://znlgis.github.io/gis/tutorial/jts/)
- 几何对象模型：第 04 章（了解 `Geometry` 与子类型是理解错误码的前提）
- 空间关系与 DE-9IM：第 08 章（理解“内部/边界/外部”才能理解连通性判定）
- 叠加分析：第 09 章（OverlayNG 是修复与清理的底层引擎）
- 几何化简：第 12 章（对比普通化简与覆盖率保持化简）
- 精度模型与数值鲁棒性：第 18 章（修复与校验失败的数值根源）
- 坐标系与工程陷阱：第 19 章（缝隙阈值的单位问题）
- 综合实战：第 24 章（完整数据治理流程）
- JTS 官方 Javadoc：https://locationtech.github.io/jts/javadoc/
- 源码路径：`modules/core/src/main/java/org/locationtech/jts/operation/valid`、`org/locationtech/jts/coverage`、`org/locationtech/jts/geom/util/GeometryFixer.java`

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/jts/第16章-线性参考系统/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/第18章-精度模型与数值鲁棒性/" class="chapter-nav__next">下一章 →</a>
</div>

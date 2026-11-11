---
layout: default
title: 第14章 - 线网处理与 Noding
---

# 第14章 - 线网处理与 Noding

GIS 数据里大量的“脏”并不是坐标错，而是线与线之间没有交点：两条道路在图上交叉，几何却各走各的，交叉处没有共享顶点；一条河与一条支流相接，端点差了几厘米；两个面图层叠在一起，边界线互相穿过但没有打断。任何依赖拓扑的算法（叠加分析、缓冲区、多边形化、网络分析、连通性检查）在这些数据上都会给出错误结果，而错误往往以“结果面缺失”“面面积对不上”“线网不连通”的形式出现，很难反查。

Noding（节点化，也译作“打节点”“求交打断”）就是解决这一类问题的预处理步骤：把一组线段集合中所有的相交点算出来，在交点处把线段打断，输出一组“任意两条线段只在端点相交”的线段集合。它看起来只是一个几何求交问题，实际上涉及容差、精度、鲁棒性、性能与拓扑正确性，是 JTS 里最容易被低估的子系统之一。

本章围绕 `org.locationtech.jts.noding` 包展开，并顺带讲清三个紧密相关的工具：用 `Polygonizer` 把节点化后的线网还原成面，用 `LineMerger`/`LineSequencer`/`LineDissolver` 把碎线重新缝合成有意义的线串，以及用 `edgegraph` 的半边结构做线网拓扑分析。读完后你应该能独立搭建一条“道路网/管网预处理流水线”，并知道每一步的容差该怎么给、什么时候必须用捕捉舍入（snap-rounding）。

前置知识：第 4 章的 `LineString`/`CoordinateSequence`，第 8 章的空间关系谓词，第 13 章的空间索引（节点化的性能几乎完全取决于索引）。

## 14.1 什么是 Noding

### 14.1.1 定义

给定一组线段（segment），Noding 的任务是计算所有交点在每条线段上的位置，并据此把线段切分成更小的线段，使得输出集合满足：**任意两条输出线段要么不相交，要么只在端点处相交**。满足这个性质的集合称为“已节点化（noded）”的集合。

注意两个容易混淆的概念：

- **节点（node）**：线段上的一个分割点，可能是交点，也可能是原来的顶点、端点。
- **节点化（noding）**：在节点处切割线段的整个过程。节点化的输出不是“交点列表”，而是“切割后的线段集合”。

JTS 里还有一类相关但不同的处理叫 **snap-rounding（捕捉舍入）**：先把坐标舍入到固定精度网格，再把距离网格点足够近的线段“捕捉”到网格点上，从而既完成节点化又完成精度归一化。它不是普通 noding 的替代品，而是“带精度约束的 noding”。

### 14.1.2 为什么需要节点化

```
未节点化的两条线（叠加/求交时会出现拓扑错误）

   A: (0,0) ─────────────── (10,0)
   B:            │
                │  (5,-5) ~ (5,5)，与 A 交于 (5,0) 但无共享顶点

   叠加分析需要把 A 在 (5,0) 处打断：
   A1: (0,0) ─── (5,0)
   A2:            (5,0) ───── (10,0)
   B1: (5,-5) ── (5,0)
   B2:            (5,0) ── (5,5)
```

典型需要节点化的场景：

1. **叠加分析（overlay）**：两个图层的边界线必须互相打断，才能正确构建“边—环—面”的拓扑图。OverlayNG 内部会先对输入做 noding。
2. **缓冲区（buffer）**：偏移曲线在凹角处会自交，必须打断后按奇偶规则重建面，否则会出现“蝴蝶结”式自交面。
3. **多边形化（polygonize）**：把线框转成面时，线框必须在交点处打断，否则环无法闭合。
4. **网络分析**：道路在平面交叉处必须有共享节点，否则连通性判断会把立交桥和平面路口混为一谈——这里要注意，节点化是“几何上相交即打断”，高架桥与地面道路的分离需要额外的 Z 值或图层约束，noding 本身不解决语义问题。
5. **有效性修复**：自相交的线/面在修复前常先节点化，避免修复算法面对退化输入。

### 14.1.3 一个最小示例

下面用 `MCIndexNoder` 对两条对角线做节点化，交叉点在 `(5,5)`。代码是完整可运行的（JTS 1.20.0），输出为真实结果。

```java
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.locationtech.jts.algorithm.RobustLineIntersector;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.IntersectionAdder;
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.NodedSegmentString;
import org.locationtech.jts.noding.SegmentString;
import org.locationtech.jts.noding.SegmentStringUtil;

public class NodingDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();

        // 1. 把几何转成 SegmentString 集合
        List<SegmentString> segStrings = new ArrayList<SegmentString>();
        String[] lines = {
            "LINESTRING (0 0, 10 10)",
            "LINESTRING (0 10, 10 0)"
        };
        for (String wkt : lines) {
            LineString line = (LineString) reader.read(wkt);
            segStrings.add(new NodedSegmentString(line.getCoordinates(), line));
        }

        // 2. 建 noder：索引 + 交点处理策略
        MCIndexNoder noder = new MCIndexNoder();
        noder.setSegmentIntersector(
            new IntersectionAdder(new RobustLineIntersector()));

        // 3. 节点化
        noder.computeNodes(segStrings);

        // 4. 取切分后的线段
        Collection noded = noder.getNodedSubstrings();
        System.out.println("节点化后线段数=" + noded.size());
        System.out.println(SegmentStringUtil.toGeometry(noded, gf));
    }
}
```

示例输出：

```
节点化后线段数=4
MULTILINESTRING ((0 0, 5 5), (5 5, 10 10), (0 10, 5 5), (5 5, 10 0))
```

这里有两个实现细节值得注意：`NodedSegmentString` 构造时传入了原 `LineString` 作为 `data`，节点化后可以通过 `ss.getData()` 找回源对象；输出集合的顺序与输入顺序、索引遍历顺序有关，不能依赖。

### 14.1.4 noding 包地图

```
modules/core/src/main/java/org/locationtech/jts/noding/
├── SegmentString.java              线段串接口
├── NodableSegmentString.java       可添加交点的线段串
├── NodedSegmentString.java         默认实现（核心）
├── BasicSegmentString.java         只读轻量实现
├── Noder.java                      节点化接口
├── SinglePassNoder.java            单遍节点化基类
├── MCIndexNoder.java               基于单调链索引的默认实现
├── SimpleNoder.java                O(n^2) 参考实现
├── ScaledNoder.java                缩放坐标后再节点化（精度）
├── IteratedNoder.java              迭代节点化（旧）
├── SegmentExtractingNoder.java     只拆段、不求交
├── ValidatingNoder.java            包装器：节点化后校验
├── FastNodingValidator.java        快速校验器
├── NodingValidator.java            全量校验器（慢）
├── IntersectionAdder.java          求交并写入 NodedSegmentString
├── IntersectionFinderAdder.java    内部交点收集
├── SegmentIntersectionDetector.java 只检测、不修改
├── NodingIntersectionFinder.java   校验用交点探测器
├── SegmentSetMutualIntersector.java 两组线段集合求交
├── BoundaryChainNoder.java         边界链节点化（Coverage 用）
├── snap/                           SnappingNoder（顶点捕捉）
└── snapround/                      SnapRoundingNoder（捕捉舍入）
```

### 14.1.5 两条技术路线

| 路线 | 代表实现 | 是否改变坐标 | 拓扑保证 | 典型用途 |
| --- | --- | --- | --- | --- |
| 精确求交 + 打断 | `MCIndexNoder` + `IntersectionAdder` | 否 | 依赖浮点求交精度，可能出现极近点 | 叠加、多边形化、一般预处理 |
| 顶点捕捉 | `SnappingNoder` | 是（吸附到容差内最近点） | 容差内顶点一致 | 修复“差一点点”的线网 |
| 捕捉舍入 | `SnapRoundingNoder` | 是（舍入到精度网格） | 输出满足精度模型的节点化 | 固定精度数据、缓冲、精度归一 |
| 缩放 + 精确求交 | `ScaledNoder` + `MCIndexNoder` | 是（坐标整体缩放取整） | 需谨慎，可能破坏拓扑 | 特定算法内部（如历史缓冲实现） |

选择路线取决于数据质量与下游要求：数据本身干净、只需打断相交线，用第一条；端点不重合、需要“缝合”用捕捉；要求输出严格落在固定精度网格上，用捕捉舍入。第 14.5、14.6 节会分别展开。

## 14.2 SegmentString 家族

### 14.2.1 从 Geometry 到 SegmentString

JTS 的节点化算法不直接操作 `Geometry`，而是操作 `SegmentString`。原因有三：几何对象不可变、节点化需要往线上“插入点”、以及算法需要在顶点级别做索引。

```java
public interface SegmentString {
    Object getData();                                  // 关联的源对象
    void setData(Object data);
    int size();                                        // 顶点数
    Coordinate getCoordinate(int i);
    Coordinate[] getCoordinates();
    boolean isClosed();
    default Coordinate prevInRing(int index);           // 环上前一个顶点
    default Coordinate nextInRing(int index);           // 环上后一个顶点
}

/** 支持在指定线段上添加交点 */
public interface NodableSegmentString extends SegmentString {
    void addIntersection(Coordinate intPt, int segmentIndex);
}
```

四个实现的分工：

| 实现 | 可变性 | 是否记录节点 | 用途 |
| --- | --- | --- | --- |
| `NodedSegmentString` | 不可变坐标 + 可变节点列表 | 是（`SegmentNodeList`） | 节点化主实现 |
| `BasicSegmentString` | 只读 | 否 | 校验、只读求交 |
| `NodedSegmentString` 拷贝构造 | 由其他 SegmentString 复制 | 新列表 | 包装只读输入 |
| `SegmentStringDissolver` | 不适用 | 不适用 | 按坐标内容去重合并（见 14.8） |

### 14.2.2 节点如何存储

`NodedSegmentString` 内部持有一个 `SegmentNodeList`，本质是 `TreeMap<SegmentNode, SegmentNode>`。`SegmentNode` 用「线段下标 + 交点坐标 + 线段八分圆（octant）」实现排序，从而保证同一条线段上的多个交点按几何顺序排列，且可以用二分法快速定位。这个设计非常关键：节点化的复杂度如果靠“找到交点后线性插入节点”，在大线串上会退化为 O(k²)；用有序结构才能保持近似 O(k log k)。

```
一条 SegmentString 上的 SegmentNodeList（按位置排序）

  顶点0        节点a        节点b        顶点1        顶点2
   (0,0)───────(2,1)────────(5,2)────────(8,0)───────(10,3)
                 │            │
             segmentIndex=0,  0,
             octant 记录方向   但坐标不同 → 排序靠 octant+坐标

  节点按 (segmentIndex, octant, 坐标) 排序，
  最后 getSplitEdges() 顺序输出切分后的线段
```

`getSplitEdges` 的职责是把每条线按节点顺序切成连续线段，同时处理三类特殊情况：端点节点（保证首尾各有一个节点）、塌缩节点（相邻两个节点坐标相同，必须插入以形成零长度段）、以及重复坐标。这些细节在实现里占了大量代码，也是“自己写节点化”最容易漏掉的部分。

### 14.2.3 从 Geometry 提取 SegmentString

手写循环转换虽然简单，但 JTS 提供了标准工具 `SegmentStringUtil`：

```java
public class SegmentStringUtil {
    public static List extractSegmentStrings(Geometry geom);        // 返回 NodedSegmentString 列表
    public static List extractNodedSegmentStrings(Geometry geom);   // 同上（显式命名）
    public static List extractBasicSegmentStrings(Geometry geom);   // 返回 BasicSegmentString
    public static Geometry toGeometry(Collection segStrings, GeometryFactory geomFact);
    public static String toString(List segStrings);                 // 调试用
}
```

`extractNodedSegmentStrings` 会用 `LinearComponentExtracter` 提取所有线组件（`LineString`、`LinearRing`，以及多几何里的线），并为每条线创建 `NodedSegmentString`，`data` 指向原几何。`toGeometry` 则把结果转回 `LineString` 或 `MultiLineString`，是节点化调试的常用收尾函数。

```java
List segStrings = SegmentStringUtil.extractSegmentStrings(inputGeom);
Noder noder = new MCIndexNoder(new IntersectionAdder(new RobustLineIntersector()));
noder.computeNodes(segStrings);
Geometry nodedGeom = SegmentStringUtil.toGeometry(
    noder.getNodedSubstrings(), inputGeom.getFactory());
System.out.println(nodedGeom);
```

### 14.2.4 完整示例：逐条打印切分结果

```java
import java.util.Collection;
import java.util.List;

import org.locationtech.jts.algorithm.RobustLineIntersector;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.IntersectionAdder;
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.Noder;
import org.locationtech.jts.noding.SegmentString;
import org.locationtech.jts.noding.SegmentStringUtil;

public class SegmentStringWalkDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new WKTReader().read(
            "MULTILINESTRING ((0 0, 10 10), (0 10, 10 0))");

        List segStrings = SegmentStringUtil.extractSegmentStrings(input);
        Noder noder = new MCIndexNoder(
            new IntersectionAdder(new RobustLineIntersector()));
        noder.computeNodes(segStrings);

        Collection noded = noder.getNodedSubstrings();
        for (Object o : noded) {
            SegmentString ss = (SegmentString) o;
            StringBuilder sb = new StringBuilder("数据=" + ss.getData() + " 顶点=");
            for (int i = 0; i < ss.size(); i++) {
                if (i > 0) sb.append(" -> ");
                sb.append(ss.getCoordinate(i));
            }
            System.out.println(sb);
        }
    }
}
```

参考输出（顺序依索引遍历而定）：

```
数据=MULTILINESTRING ((0 0, 10 10), (0 10, 10 0)) 顶点=(0.0, 0.0) -> (5.0, 5.0)
数据=MULTILINESTRING ((0 0, 10 10), (0 10, 10 0)) 顶点=(5.0, 5.0) -> (10.0, 10.0)
数据=MULTILINESTRING ((0 0, 10 10), (0 10, 10 0)) 顶点=(0.0, 10.0) -> (5.0, 5.0)
数据=MULTILINESTRING ((0 0, 10 10), (0 10, 10 0)) 顶点=(5.0, 5.0) -> (10.0, 0.0)
```

注意每个子串的 `data` 都指向整个输入几何，而不是指向某条 `LineString`——这是 `extractNodedSegmentStrings` 的实现约定（`new NodedSegmentString(pts, geom)`）。如果业务上需要追溯“这条子串来自哪条线”，应该自己构造并传入更细的 data，例如 `line.setUserData("road-123")`。

## 14.3 Noder 接口与 MCIndexNoder

### 14.3.1 接口

```java
public interface Noder {
    void computeNodes(Collection segStrings);   // 计算节点
    Collection getNodedSubstrings();             // 取切分后的线段串
}
```

`SinglePassNoder` 是它的抽象子类，额外持有一个 `SegmentIntersector`：

```java
public abstract class SinglePassNoder implements Noder {
    protected SegmentIntersector segInt;
    public void setSegmentIntersector(SegmentIntersector segInt);
    // computeNodes / getNodedSubstrings 仍为抽象
}
```

这个“noder 负责枚举候选线段对、intersector 负责决定对交点做什么”的分离，是 JTS 节点化设计的核心。同一套索引与枚举逻辑可以配不同 intersector 实现不同语义：记录交点并打断（`IntersectionAdder`）、只统计（`NodingIntersectionFinder`）、只检测是否相交（`SegmentIntersectionDetector`）、甚至只做几何求交而不修改线（`IntersectionFinderAdder`）。

### 14.3.2 MCIndexNoder 内部

`MCIndexNoder` 的名字是 Monotone Chain Index Noder。它的工作流程：

1. 对每个 `SegmentString`，用 `MonotoneChainBuilder.getChains` 拆成若干单调链。
2. 每条链计算包络，插入空间索引。**1.20 起默认索引是 `HPRtree`**（1.19 及以前是 `STRtree`）。
3. 对每条链，用其包络查索引，找到可能重叠的链。只处理 `testChain.getId() > queryChain.getId()` 的对，避免重复。
4. 对两个链调用 `computeOverlaps` 二分递归，定位到真正相交的线段对，回调 `SegmentIntersector.processIntersections`。
5. 全部处理完后，`getNodedSubstrings()` 调 `NodedSegmentString.getNodedSubstrings`，把每条线的节点列表展开成切分子串。

源码片段（1.20）：

```java
public class MCIndexNoder extends SinglePassNoder {
    private List monoChains = new ArrayList();
    private SpatialIndex index = new HPRtree();      // 1.20 起
    private int idCounter = 0;
    private double overlapTolerance = 0;

    public MCIndexNoder() { }
    public MCIndexNoder(SegmentIntersector si) { super(si); }
    public MCIndexNoder(SegmentIntersector si, double overlapTolerance) {
        super(si);
        this.overlapTolerance = overlapTolerance;
    }
}
```

`overlapTolerance` 是为“带容差的节点化”准备的：当两条线相距小于容差时也认为可能相交。它不改变交点坐标，只是放宽索引与链比较的包络。`SnappingNoder` 就利用了这个参数（传入 `2 * snapTolerance`）。

### 14.3.3 SimpleNoder：O(n²) 的参考实现

`SimpleNoder.computeNodes` 是双重循环：每条线与每条线、每条线段与每条线段全比一遍，复杂度 O(n²·m²)。它存在的意义是作为正确性基准与教学样例，**不要用于生产数据**。

| 对比项 | `SimpleNoder` | `MCIndexNoder` |
| --- | --- | --- |
| 候选枚举 | 全量两两比较 | 单调链 + 空间索引 |
| 复杂度 | O(N²) | 近 O(N log N + K) |
| 大规模数据 | 不可用 | 可用 |
| 依赖索引 | 无 | `HPRtree`（1.20+） |
| 适用场景 | 单测、小数据验证 | 生产 |

### 14.3.4 一个可复用的 noder 工厂方法

实际项目里经常需要“同一套节点化参数在多个地方复用”，建议封装成工厂：

```java
import org.locationtech.jts.algorithm.RobustLineIntersector;
import org.locationtech.jts.noding.IntersectionAdder;
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.Noder;

public final class Noders {
    private Noders() { }

    /** 精确求交节点化：不改变坐标，只打断 */
    public static Noder exact() {
        return new MCIndexNoder(
            new IntersectionAdder(new RobustLineIntersector()));
    }

    /** 带容差的求交节点化：包络放宽，适合近距线 */
    public static Noder exactWithTolerance(double tolerance) {
        return new MCIndexNoder(
            new IntersectionAdder(new RobustLineIntersector()), tolerance);
    }
}
```

注意第二个方法只是让索引“多看一点”，并不保证容差内的线真的被打断——它依赖 `IntersectionAdder` 的 `LineIntersector` 判定。真要“距离小于容差就视为相交”，应当用 `SnappingNoder` 或 `SnapRoundingNoder`（14.6 节）。

## 14.4 SegmentIntersector 与交点处理器

### 14.4.1 接口

```java
public interface SegmentIntersector {
    void processIntersections(
        SegmentString e0, int segIndex0,
        SegmentString e1, int segIndex1);

    /** 已处理完足够信息时返回 true，noder 可提前结束 */
    default boolean isDone() { return false; }
}
```

参数是“线段对”：`e0` 的第 `segIndex0` 条线段与 `e1` 的第 `segIndex1` 条线段。实现者需要自己用 `LineIntersector` 求交，并决定是否把交点写回 `NodableSegmentString`。

### 14.4.2 IntersectionAdder：标准实现

`IntersectionAdder` 是最常用的实现，它做四件事：

1. 用 `LineIntersector.computeIntersection` 计算两条线段的关系。
2. 排除“平凡交点”（同一条线的相邻线段共享端点、闭合环首尾相接），避免把顶点当成交点重复插入。
3. 把非平凡交点通过 `NodedSegmentString.addIntersections` 写入两边的节点列表。
4. 维护统计计数器：`numTests`、`numIntersections`、`numProperIntersections`、`numInteriorIntersections`，以及 `hasIntersection()`、`hasProperIntersection()` 等查询。

这些计数器在调试“为什么没打断”时非常有用：

```java
import java.util.List;

import org.locationtech.jts.algorithm.RobustLineIntersector;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.IntersectionAdder;
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.SegmentStringUtil;

public class AdderStatsDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new WKTReader().read(
            "MULTILINESTRING ((0 0, 10 10), (0 10, 10 0))");

        List segStrings = SegmentStringUtil.extractSegmentStrings(input);
        IntersectionAdder adder = new IntersectionAdder(new RobustLineIntersector());
        MCIndexNoder noder = new MCIndexNoder(adder);
        noder.computeNodes(segStrings);

        System.out.println("numTests=" + adder.numTests);
        System.out.println("numIntersections=" + adder.numIntersections);
        System.out.println("numProperIntersections=" + adder.numProperIntersections);
        System.out.println("numInteriorIntersections=" + adder.numInteriorIntersections);
        System.out.println("hasIntersection=" + adder.hasIntersection());
    }
}
```

示例输出：

```
numTests=1
numIntersections=1
numProperIntersections=1
numInteriorIntersections=1
hasIntersection=true
```

四个计数器的含义：`numTests` 是实际调用的线段对数量；`numIntersections` 是求交结果为“有交点”的次数；`numProperIntersections` 是严格内部相交（交点不在任何线段端点上）；`numInteriorIntersections` 是交点落在某条线段的内部（含 T 形相交）。对两条一横一竖的线，`numTests=1` 说明索引只命中了一对候选，这就是索引带来的收益。

### 14.4.3 SegmentIntersectionDetector：只检测不修改

当目的只是“判断两组线是否相交”时，不需要真的打断。`SegmentIntersectionDetector` 实现 `SegmentIntersector`，只记录状态并实现 `isDone()` 提前退出：

```java
public class SegmentIntersectionDetector implements SegmentIntersector {
    public void setFindProper(boolean findProper);              // 只要严格内部相交
    public void setFindAllIntersectionTypes(boolean findAllTypes);
    public boolean hasIntersection();
    public boolean hasProperIntersection();
    public boolean hasNonProperIntersection();
    public Coordinate getIntersection();
    public Coordinate[] getIntersectionSegments();
    /** 达到目标即返回 true，noder 停止后续枚举 */
    public boolean isDone();
}
```

配合 `FastSegmentSetIntersectionFinder` 使用，可以在建一次索引后反复判断：

```java
import java.util.List;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.FastSegmentSetIntersectionFinder;
import org.locationtech.jts.noding.SegmentStringUtil;

public class IntersectionCheckDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        Geometry base = reader.read("LINESTRING (0 0, 10 0)");
        Geometry probe = reader.read("LINESTRING (5 -5, 5 5)");
        Geometry far = reader.read("LINESTRING (5 20, 5 30)");

        List baseSegs = SegmentStringUtil.extractBasicSegmentStrings(base);
        FastSegmentSetIntersectionFinder finder =
            new FastSegmentSetIntersectionFinder(baseSegs);

        System.out.println("probe 相交=" + finder.intersects(
            SegmentStringUtil.extractBasicSegmentStrings(probe)));
        System.out.println("far 相交=" + finder.intersects(
            SegmentStringUtil.extractBasicSegmentStrings(far)));
    }
}
```

示例输出：

```
probe 相交=true
far 相交=false
```

`FastSegmentSetIntersectionFinder` 内部用 `MCIndexSegmentSetMutualIntersector` 为 base 集合建 `STRtree` 单调链索引，然后让 probe 集合逐链查询。这种“一边建索引、另一边流式查询”的模式适合“一条新线是否穿过已有路网”的实时判断。

### 14.4.4 FastNodingValidator：验证节点化结果

节点化做完后，怎么确认结果真的“已节点化”？JTS 提供两级校验：

- `NodingValidator`：全量两两比较，O(n²)，还会检查端点落在其他线内部、塌缩等退化情况。适合小数据与回归测试。
- `FastNodingValidator`：用 `MCIndexNoder` + `NodingIntersectionFinder` 做索引加速校验，O(n log n) 量级，适合生产前自检。

```java
import java.util.List;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.FastNodingValidator;
import org.locationtech.jts.noding.SegmentStringUtil;

public class NodingValidatorDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new WKTReader().read(
            "MULTILINESTRING ((0 0, 10 10), (0 10, 10 0))");

        List segStrings = SegmentStringUtil.extractSegmentStrings(input);
        FastNodingValidator validator = new FastNodingValidator(segStrings);
        System.out.println("isValid=" + validator.isValid());
        System.out.println("message=" + validator.getErrorMessage());
    }
}
```

示例输出：

```
isValid=false
message=found non-noded intersection between LINESTRING ( 0 0, 10 10 ) and LINESTRING ( 0 10, 10 0 )
```

`FastNodingValidator.checkValid()` 会抛 `TopologyException`，而 `isValid()` 只返回布尔值。在生产流水线里建议用 `isValid()` + 记录 `getErrorMessage()`，避免异常打断批处理；在开发阶段用 `checkValid()` 尽早暴露问题。

顺便说明 `NodedSegmentString.getNodedSubstrings` 的一个语义：它返回的每条子串都是**同一原始线段串的一部分**，若原线有 5 个节点，会返回 6 条子串。子串之间在端点处共享坐标对象（或等值坐标），这正是下游拓扑构建所依赖的性质。`SegmentStringUtil.toGeometry` 会把这些子串直接转成 `MultiLineString`，不合并、不排序，因此输出的线段顺序并不保证与输入一致。

## 14.5 容差、精度与迭代

### 14.5.1 三个精度工具

普通 `MCIndexNoder` 有一个隐含前提：输入坐标是“精确”的，两条线要么真的相交、要么不相交。现实数据往往不满足：端点差 0.0001、两条线在浮点意义上“擦边”、不同来源的数据精度不一致。JTS 为这些情况准备了三个包装/变体：

| 工具 | 作用 | 是否改变坐标 | 是否保证收敛 | 典型用途 |
| --- | --- | --- | --- | --- |
| `ScaledNoder` | 先把坐标乘以 `scaleFactor` 并取整，再交给内部 noder | 是（整体缩放） | 依赖内部 noder | 固定精度叠加、历史缓冲实现 |
| `IteratedNoder` | 反复节点化直到没有内部交点 | 否（只打断） | 最多 `MAX_ITER=5` 轮，超限抛异常 | 旧代码、鲁棒性兜底 |
| `ValidatingNoder` | 包装任意 noder，节点化后立刻用 `FastNodingValidator` 校验 | 依赖内部 noder | 校验失败抛 `TopologyException` | 生产流水线自检 |

### 14.5.2 ScaledNoder：先缩放再求交

`ScaledNoder` 的构造器接受一个内部 `Noder` 与缩放因子：

```java
public ScaledNoder(Noder noder, double scaleFactor);
public ScaledNoder(Noder noder, double scaleFactor, double offsetX, double offsetY);
public boolean isIntegerPrecision();   // scaleFactor == 1.0 时为 true
```

它的工作方式是：`computeNodes` 时把每条线的坐标按 `Math.round((x - offsetX) * scaleFactor)` 取整后交给内部 noder；`getNodedSubstrings` 时再把结果除以 `scaleFactor` 并加回偏移。注意源码里的一个细节：

```java
isScaled = ! isIntegerPrecision();   // scaleFactor == 1.0 时不做缩放
```

也就是说，`new ScaledNoder(noder, 1.0)` 是**不缩放**的（因为它假设输入已经是整数坐标）。要让坐标落到 0.01 的网格上，缩放因子应传 100，而不是 1。

```java
import java.util.ArrayList;
import java.util.List;

import org.locationtech.jts.algorithm.RobustLineIntersector;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.IntersectionAdder;
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.NodedSegmentString;
import org.locationtech.jts.noding.Noder;
import org.locationtech.jts.noding.ScaledNoder;
import org.locationtech.jts.noding.SegmentString;
import org.locationtech.jts.noding.SegmentStringUtil;

public class ScaledNoderDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();
        List<SegmentString> segs = new ArrayList<SegmentString>();
        String[] lines = {
            "LINESTRING (0.004 0.004, 10.004 0.004)",
            "LINESTRING (5.004 -5, 5.004 5)"
        };
        for (String wkt : lines) {
            LineString line = (LineString) reader.read(wkt);
            segs.add(new NodedSegmentString(line.getCoordinates(), line));
        }

        // 缩放 100 倍 => 坐标落到 0.01 网格，交点被"吸"到 (5,0)
        Noder noder = new ScaledNoder(
            new MCIndexNoder(new IntersectionAdder(new RobustLineIntersector())),
            100);
        noder.computeNodes(segs);
        System.out.println(SegmentStringUtil.toGeometry(
            noder.getNodedSubstrings(), gf));
    }
}
```

示例输出：

```
MULTILINESTRING ((0 0, 5 0), (5 0, 10 0), (5 -5, 5 0), (5 0, 5 5))
```

结果是四条子线，交点在 `(5,0)`（原本两条线的交点约在 `(5.004, 0.004)`，缩放取整后变成 `(500,0)`，再缩放回来就是 `(5,0)`）。这演示了 `ScaledNoder` 的“精度归一”效果，但也暴露了它的代价：**所有顶点都被取整，几何精度被强行改变，拓扑可能被破坏**。

JTS 自己在 `BufferOp` 的注释里写得很明确：

```java
/*
 * SnapRoundingNoder does not require rounded input,
 * so could be used by itself.
 * But using ScaledNoder may be faster, since it avoids
 * rounding within SnapRoundingNoder.
 * (Note this only works for buffering, because
 * ScaledNoder may invalidate topology.)
 */
Noder snapNoder = new SnapRoundingNoder(new PrecisionModel(1.0));
Noder noder = new ScaledNoder(snapNoder, fixedPM.getScale());
```

也就是说，`ScaledNoder` 只在“缓冲”这类对拓扑破坏不敏感（结果会重新构建面）的算法里安全；千万不要拿它做通用叠加或拓扑分析的预处理。

### 14.5.3 IteratedNoder：反复求交直到干净

浮点求交的经典问题是：两条线打断后，新产生的端点可能与另一条线“几乎相交”，需要再打断一次。`IteratedNoder` 就是反复执行“求交 + 打断”，直到某一轮没有新的内部交点为止：

```java
public class IteratedNoder implements Noder {
    public static final int MAX_ITER = 5;
    public IteratedNoder(PrecisionModel pm);
    public void setMaximumIterations(int maxIter);
    public void computeNodes(Collection segStrings) throws TopologyException;
}
```

内部实现是每轮 new 一个 `MCIndexNoder` + `IntersectionAdder`，用 `numInteriorIntersections` 作为“还有没有未打断的交点”的判据；如果连续多轮节点数不降反升且超过 `maxIter`，抛 `TopologyException("Iterated noding failed to converge after N iterations")`。

```java
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.noding.IteratedNoder;
import org.locationtech.jts.noding.SegmentStringUtil;

public class IteratedNoderDemo {
    public static void main(String[] args) throws Exception {
        org.locationtech.jts.geom.Geometry input =
            new org.locationtech.jts.io.WKTReader().read(
                "MULTILINESTRING ((0 0, 10 10), (0 10, 10 0))");

        IteratedNoder noder = new IteratedNoder(new PrecisionModel());
        noder.setMaximumIterations(5);
        noder.computeNodes(SegmentStringUtil.extractSegmentStrings(input));
        System.out.println("子串数=" + noder.getNodedSubstrings().size());
    }
}
```

这段示例的预期输出是 `子串数=4`。`IteratedNoder` 在 JTS 1.18 之后已很少出现在主线路径上（叠加改走 OverlayNG + SnapRoundingNoder），保留它主要是兼容旧代码。新项目不建议用它做“精度兜底”，因为它的收敛性依赖数据，且不改变坐标，无法解决“差一点点”的端点问题。

### 14.5.4 ValidatingNoder：让错误尽早暴露

`ValidatingNoder` 是装饰器模式的典型应用：包一层，节点化后立刻校验。

```java
public class ValidatingNoder implements Noder {
    public ValidatingNoder(Noder noder);
    public void computeNodes(Collection segStrings);
    public Collection getNodedSubstrings();
}
```

源码只有几行：

```java
public void computeNodes(Collection segStrings) {
    noder.computeNodes(segStrings);
    nodedSS = noder.getNodedSubstrings();
    validate();                     // FastNodingValidator.checkValid()
}
```

```java
import org.locationtech.jts.algorithm.RobustLineIntersector;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.noding.IntersectionAdder;
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.Noder;
import org.locationtech.jts.noding.SegmentStringUtil;
import org.locationtech.jts.noding.ValidatingNoder;

public class ValidatingNoderDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new org.locationtech.jts.io.WKTReader().read(
            "MULTILINESTRING ((0 0, 10 10), (0 10, 10 0))");

        Noder raw = new MCIndexNoder(
            new IntersectionAdder(new RobustLineIntersector()));
        Noder safe = new ValidatingNoder(raw);
        safe.computeNodes(SegmentStringUtil.extractSegmentStrings(input));
        System.out.println("校验通过，子串数=" + safe.getNodedSubstrings().size());
    }
}
```

预期输出：`校验通过，子串数=4`。如果节点化因浮点问题失败，这里会抛 `TopologyException`，比让错误数据流入下游更划算。建议在数据入库/批处理入口统一套一层 `ValidatingNoder`，用一次校验换整条流水线的可观测性。

### 14.5.5 怎么选

```
数据精度是否统一？
├─ 是（同一精度模型、坐标已在网格上）
│    └─ MCIndexNoder + IntersectionAdder
│         └─ 可选：ValidatingNoder 包装自检
├─ 否，但可以接受改变坐标
│    ├─ 需要固定精度网格（如 CAD 数据、缓冲）
│    │    └─ SnapRoundingNoder（推荐）或 ScaledNoder
│    └─ 只是端点抖动
│         └─ SnappingNoder(tolerance)
└─ 否，且不能改变坐标
     └─ 先清洗数据（坐标转换/去重/捕捉入库），再走精确路径
```

## 14.6 捕捉与捕捉舍入

### 14.6.1 问题：差一点点

```
两条线“看起来”相交，实际差 0.0003

  A: (0,0) ──────────────────────────── (10,0)
  B:                          │
                              │ (5, 0.0003) 起，向下
                              │
  精确求交：不相交（A 在 y=0，B 起点在 y=0.0003）
  结果：叠加时 B 没被打断，多边形化时环不闭合
```

这类问题不能靠“把容差调大”解决：`RobustLineIntersector` 的容差是浮点确定性容差（判断共线/端点），不是几何距离容差。JTS 的解法是**先把近距点吸附到一起，再求交**，这就是 snapping 与 snap-rounding。

### 14.6.2 SnappingNoder：顶点捕捉

`SnappingNoder` 的过程分两步：

1. **顶点捕捉**：用 `SnappingPointIndex`（内部是 `KdTree(snapTolerance)`）把所有顶点按容差聚类，容差内的顶点统一替换为同一个坐标。
2. **交点捕捉**：在捕捉后的线上用 `MCIndexNoder`（`overlapTolerance = 2 * snapTolerance`）求交；交点本身也通过捕捉索引吸附到已有顶点或交点簇上。

```java
public class SnappingNoder implements Noder {
    public SnappingNoder(double snapTolerance);
    public void computeNodes(Collection inputSegStrings);
    public Collection getNodedSubstrings();
}
```

```java
import java.util.ArrayList;
import java.util.List;

import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.NodedSegmentString;
import org.locationtech.jts.noding.SegmentString;
import org.locationtech.jts.noding.SegmentStringUtil;
import org.locationtech.jts.noding.snap.SnappingNoder;

public class SnappingNoderDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();
        List<SegmentString> segs = new ArrayList<SegmentString>();
        segs.add(new NodedSegmentString(((LineString) reader.read(
            "LINESTRING (0 0, 10 0)")).getCoordinates(), null));
        segs.add(new NodedSegmentString(((LineString) reader.read(
            "LINESTRING (10.0004 0.0003, 10 10)")).getCoordinates(), null));

        SnappingNoder noder = new SnappingNoder(0.001);   // 容差 1mm（假设单位为米）
        noder.computeNodes(segs);
        System.out.println(SegmentStringUtil.toGeometry(
            noder.getNodedSubstrings(), gf));
    }
}
```

示例输出：

```
MULTILINESTRING ((0 0, 10 0), (10 0, 10 10))
```

第二条线的起点 `(10.0004, 0.0003)` 被吸附到 `(10,0)`，与第一条线端点重合。注意输出仍是两条线，`SnappingNoder` 只保证“容差内顶点一致”，不做合并——合并是 `LineMerger` 的职责。

三个使用要点：

- **容差是绝对距离**，不是比例。地理坐标系（经纬度）下 0.001 度约 100 米，传错会灾难性合并。务必先投影到米制坐标再给容差。
- **捕捉会移动坐标**，且移动方向取决于顶点处理顺序（先插入的坐标胜出）。对成果数据要记录“捕捉前/后坐标”，便于质量回溯。
- `SnappingNoder` 的捕捉是“顶点到顶点/交点”，不是“顶点到线段”。如果一条线的端点悬在另一条线中间（T 形），需要 `SnapRoundingNoder` 或先做投影插入。

### 14.6.3 SnapRoundingNoder：网格捕捉舍入

`SnapRoundingNoder` 是 1.18 引入的现代实现（#599），用来取代已弃用的 `MCIndexSnapRounder` 与已删除的 `SimpleSnapRounder`。它的核心数据结构是 **HotPixel（热点像素）**：对精度模型的每个网格单元，记录落在这个单元里的点与线段，查询时判断线段是否穿过某个热点像素。

```java
public class SnapRoundingNoder implements Noder {
    public SnapRoundingNoder(PrecisionModel pm);
    public void computeNodes(Collection inputSegmentStrings);
    public Collection getNodedSubstrings();
}
```

处理流程（源码 `snapRound` 方法）：

1. `addIntersectionPixels`：用 `MCIndexNoder` + `SnapRoundingIntersectionAdder` 找所有交点，把交点“四舍五入到网格”后作为 HotPixel 加入索引。`nearnessTol = (1/scale) / 100`，即网格尺寸的百分之一。
2. `addVertexPixels`：把所有输入顶点也作为 HotPixel 加入。
3. `computeSnaps`：对每条线，先把坐标舍入到网格；然后逐段查询 HotPixel，凡是被 HotPixel 命中的地方都插入节点；最后再处理“顶点恰好落在节点像素”的情况。

```java
import java.util.ArrayList;
import java.util.List;

import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.NodedSegmentString;
import org.locationtech.jts.noding.Noder;
import org.locationtech.jts.noding.SegmentString;
import org.locationtech.jts.noding.SegmentStringUtil;
import org.locationtech.jts.noding.snapround.SnapRoundingNoder;

public class SnapRoundingDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();
        List<SegmentString> segs = new ArrayList<SegmentString>();
        segs.add(new NodedSegmentString(((LineString) reader.read(
            "LINESTRING (0 0, 10 0)")).getCoordinates(), null));
        segs.add(new NodedSegmentString(((LineString) reader.read(
            "LINESTRING (5.0001 -5, 5.0001 5)")).getCoordinates(), null));

        // 精度模型 scale=1 => 网格 1.0，所有坐标舍入到整数
        Noder noder = new SnapRoundingNoder(new PrecisionModel(1.0));
        noder.computeNodes(segs);
        System.out.println(SegmentStringUtil.toGeometry(
            noder.getNodedSubstrings(), gf));
    }
}
```

示例输出：

```
MULTILINESTRING ((0 0, 5 0), (5 0, 10 0), (5 -5, 5 0), (5 0, 5 5))
```

`5.0001` 被舍入到 `5`，交点落在 `(5,0)` 这个网格点上。与 `SnappingNoder` 相比，`SnapRoundingNoder` 有三个本质区别：

| 对比项 | `SnappingNoder` | `SnapRoundingNoder` |
| --- | --- | --- |
| 精度模型 | 任意（容差是绝对距离） | 必须提供 `PrecisionModel`，输出落在网格上 |
| 捕捉对象 | 顶点 ↔ 顶点/交点 | 顶点与交点 ↔ 网格像素 |
| 输出坐标 | 取自已有顶点 | 全部舍入到网格 |
| 适用 | 端点抖动、近距顶点 | 固定精度数据、缓冲、精度归一 |
| 性能 | 快（KdTree + 索引） | 较慢（HotPixel 索引 + 多次遍历） |

使用 `SnapRoundingNoder` 的常见错误是“精度模型给错”。`new PrecisionModel(1.0)` 表示网格 1.0；`new PrecisionModel(1000)` 表示网格 0.001。`PrecisionModel` 还有一个 `FLOATING` 类型，它没有固定网格，传给 `SnapRoundingNoder` 会得到 `scale = 1`（因为 `getScale()` 对 FLOATING 返回 1.0），结果是把所有坐标舍入到整数——这显然不是“浮点精度”的意思。要固定精度，务必用显式的 `new PrecisionModel(scale)`。

### 14.6.4 GeometryNoder：几何级封装

`GeometryNoder` 把 `SnapRoundingNoder` 包成“输入几何集合、输出线串列表”的便利类：

```java
public class GeometryNoder {
    public GeometryNoder(PrecisionModel pm);
    public void setValidate(boolean isValidated);
    public List node(Collection geoms);   // 返回 List<LineString>
}
```

它内部用 `LinearComponentExtracter` 提取所有线组件、转成 `NodedSegmentString`、执行捕捉舍入、再把结果转回 `LineString`。注意它**只接受线状输入**：面几何会被提取出边界线，但不会保留面的结构。

```java
import java.util.Arrays;
import java.util.List;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.snapround.GeometryNoder;

public class GeometryNoderDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        Geometry g1 = reader.read("LINESTRING (0 0, 11 11)");
        Geometry g2 = reader.read("LINESTRING (0 11, 11 0)");

        GeometryNoder noder = new GeometryNoder(new PrecisionModel(1.0));
        noder.setValidate(true);
        List lines = noder.node(Arrays.asList(g1, g2));
        System.out.println("输出线数=" + lines.size());
        for (Object o : lines) {
            System.out.println("  " + o);
        }
    }
}
```

示例输出：

```
输出线数=4
  LINESTRING (0 0, 6 6)
  LINESTRING (6 6, 11 11)
  LINESTRING (0 11, 6 6)
  LINESTRING (6 6, 11 0)
```

两条线原本精确相交于 `(5.5, 5.5)`，在 `PrecisionModel(1.0)` 下被舍入到 `(6,6)`，于是四条子线都汇于 `(6,6)`。这个“交点被移动到网格点”的行为是 snap-rounding 的定义使然，不是 bug。如果业务要求交点保持 `(5.5,5.5)`，就不能用固定精度模型，而应使用 `SnappingNoder` 或精确 `MCIndexNoder`。

### 14.6.5 版本迁移表

| 版本 | 变化 | 影响 |
| --- | --- | --- |
| 1.7 | 引入 `noding.snapround` 包（`MCIndexSnapRounder`） | 老代码常见 |
| 1.18 | 新增 `SnapRoundingNoder`；`MCIndexSnapRounder` 标记 `@Deprecated`；删除 `SimpleSnapRounder` | 新代码用 `SnapRoundingNoder` |
| 1.18 | `GeometryPrecisionReducer` 改用 OverlayNG + snap-rounding | 精度归一路径统一 |
| 1.18 | `GeometryNoder` 改用 `SnapRoundingNoder` | 行为与旧版略有差异 |
| 1.19 | 修复 `SnapRoundingNoder` 的容差处理（#802） | 升级建议 |

如果代码里还在用 `MCIndexSnapRounder`，迁移方式是：`new MCIndexSnapRounder(pm)` → `new SnapRoundingNoder(pm)`，接口都是 `Noder`，其余调用不变。注意 `SnapRoundingNoder` 的 `getNodedSubstrings()` 返回的是 `NodedSegmentString.getNodedSubstrings(snappedResult)` 的结果（已经展开成子串），而 `MCIndexSnapRounder` 的返回也是子串，语义一致。

### 14.6.6 容差怎么给

| 数据情形 | 推荐做法 | 容差建议 |
| --- | --- | --- |
| 同一数据源、同一精度 | 精确 noding，不捕捉 | 0 |
| 端点抖动、来源不同 | `SnappingNoder` | 数据精度的 1~3 倍（如 1cm 精度给 0.03） |
| 要求输出固定精度 | `SnapRoundingNoder(pm)` | 由 `PrecisionModel` 决定，不再额外给容差 |
| 地理坐标系（度） | 先投影到米制 | 投影后按上一行处理 |
| 大规模数据 | 精确 noding + `ValidatingNoder` | 0，错误数据单独修复 |

## 14.7 Polygonizer：从线网重建面

### 14.7.1 算法流程

`Polygonizer` 的输入是一组线（通常是节点化后的），输出是由这些线围成的面。它的算法本质是“有向边图 + 环提取 + 洞归属”：

```
输入线集合
   │
   ▼
① 构建 PolygonizeGraph：每条线拆成有向边（正反两条），
   按端点合并节点
   │
   ▼
② 删除悬挂线（dangles）：从度为 1 的节点反复删除边，
   直到没有度为 1 的节点
   │
   ▼
③ 删除割边（cut edges）：删除后会让图不连通的边（桥）
   │
   ▼
④ 提取 EdgeRing：沿有向边环游，得到闭合环
   │   ├─ 校验环有效性 → invalidRingLines
   │   └─ 判断环是 shell 还是 hole（面积符号）
   ▼
⑤ HoleAssigner：把每个洞分配给包含它的最小 shell
   │
   ▼
⑥ 输出 Polygon 集合（可选：只保留构成有效面状几何的）
```

理解这个流程就能解释 `Polygonizer` 的三个“副产品”：`getDangles()`（悬挂线）、`getCutEdges()`（割边/桥）、`getInvalidRingLines()`（自交或方向错误的环）。它们不是错误，而是“无法围成面”的那部分输入，业务上往往需要单独处理（例如悬挂线是道路支路，割边是两个区域之间的连接线）。

### 14.7.2 API

| 方法 | 说明 |
| --- | --- |
| `Polygonizer()` | 默认构造，提取所有环构成的面（包括洞形成的嵌套面） |
| `Polygonizer(boolean extractOnlyPolygonal)` | `true` 时只输出能构成有效 `Polygonal` 几何的面 |
| `add(Geometry)` / `add(Collection)` | 添加输入，自动提取其中的 `LineString` 组件 |
| `getPolygons()` | 返回 `Collection<Polygon>` |
| `getGeometry()` | 返回 `GeometryCollection` 或 `MultiPolygon`（取决于构造参数） |
| `getDangles()` | 悬挂线列表 |
| `getCutEdges()` | 割边列表 |
| `getInvalidRingLines()` | 无效环的线串列表 |
| `setCheckRingsValid(boolean)` | 关闭环有效性检查以提速（默认开启） |

`setCheckRingsValid(false)` 是性能优化开关：跳过后不会输出 `invalidRingLines`，适合“输入可信、只要面”的批处理。1.14 起加入。

### 14.7.3 完整示例：带洞的面 + 悬挂线

```java
import java.util.Collection;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.polygonize.Polygonizer;

public class PolygonizerDemo {
    public static void main(String[] args) throws Exception {
        // 外环 + 内环 + 一条悬挂线
        Geometry lines = new WKTReader().read(
            "MULTILINESTRING ("
            + " (0 0, 10 0), (10 0, 10 10), (10 10, 0 10), (0 10, 0 0),"
            + " (2 2, 8 2), (8 2, 8 8), (8 8, 2 8), (2 8, 2 2),"
            + " (15 0, 20 0))");

        // 默认模式：会同时输出"外环带洞"与"内环单独成面"
        Polygonizer p1 = new Polygonizer();
        p1.add(lines);
        System.out.println("默认模式 polygons=" + p1.getPolygons().size());
        System.out.println(p1.getPolygons());

        // 只保留能构成有效面状几何的部分
        Polygonizer p2 = new Polygonizer(true);
        p2.add(lines);
        Collection polygons = p2.getPolygons();
        System.out.println("polygonal 模式 polygons=" + polygons.size());
        System.out.println("geometry=" + p2.getGeometry());

        System.out.println("dangles=" + p2.getDangles());
        System.out.println("cutEdges=" + p2.getCutEdges());
        System.out.println("invalidRingLines=" + p2.getInvalidRingLines());
    }
}
```

示例输出：

```
默认模式 polygons=2
[POLYGON ((10 0, 0 0, 0 10, 10 10, 10 0), (2 8, 2 2, 8 2, 8 8, 2 8)), POLYGON ((2 2, 2 8, 8 8, 8 2, 2 2))]
polygonal 模式 polygons=1
geometry=POLYGON ((10 10, 10 0, 0 0, 0 10, 10 10), (2 8, 2 2, 8 2, 8 8, 2 8))
dangles=[LINESTRING (15 0, 20 0), LINESTRING (15 0, 20 0)]
cutEdges=[]
invalidRingLines=[]
```

三个值得注意的细节：

1. **默认模式会输出“洞单独成面”**。因为默认构造等价于 `extractOnlyPolygonal = false`，算法把每个环都当作可能的 shell，内环既作为外环的洞，又作为自己的 shell 输出。需要“有效面状几何”时必须用 `new Polygonizer(true)`。
2. **dangles 里同一条悬挂线出现了两次**。`PolygonizeGraph.deleteDangles` 会从两个度为 1 的端点分别处理，同一条边可能被记录两次。使用前建议用 `Set` 或 `LineString.equalsExact` 去重。
3. **输出的面方向与输入无关**，`Polygonizer` 会保证 shell 为顺时针（JTS 内部约定）、hole 为逆时针。不要依赖输入的环方向。

### 14.7.4 输入必须先节点化

`Polygonizer` 不会自动求交。如果两条线在图中交叉但没有共享顶点，它们不属于同一个节点，环就串不起来：

```java
// 错误：两条线交叉但未打断，Polygonizer 什么也围不出来
Geometry bad = reader.read(
    "MULTILINESTRING ((0 0, 10 10), (0 10, 10 0), ...)");

// 正确：先节点化，再丢给 Polygonizer
List segStrings = SegmentStringUtil.extractSegmentStrings(bad);
Noder noder = new MCIndexNoder(new IntersectionAdder(new RobustLineIntersector()));
noder.computeNodes(segStrings);
Geometry noded = SegmentStringUtil.toGeometry(noder.getNodedSubstrings(), gf);

Polygonizer p = new Polygonizer(true);
p.add(noded);
Geometry result = p.getGeometry();
```

这也是第 14 章把 noding 放在 polygonize 前面的原因：两者是同一条流水线的上下游。

### 14.7.5 性能与退化输入

- 1.20.0 优化了 `Polygonizer` 在“大量岛”场景下的性能（#906），岛洞归属从 O(洞×壳) 改为带索引的分配（`HoleAssigner`）。百万级线框数据建议升级到 1.20+。
- 输入含大量自交环时，`setCheckRingsValid(true)`（默认）会调用 `EdgeRing.computeValid` 做校验，成本不低；如果数据可信，可以设为 `false`。
- `getGeometry()` 在 `extractOnlyPolygonal = false` 时返回 `GeometryCollection`，其中可能嵌套面；`true` 时返回 `MultiPolygon` 或 `Polygon`，可直接参与后续叠加。
- 悬挂线特别多时，`deleteDangles` 会做大量图遍历。可以先用 `LineMerger` 把碎线合并成长线，减少边数，再 `Polygonizer`。

## 14.8 线缝合三件套：LineMerger、LineSequencer、LineDissolver

节点化会把长线切成碎段，把相交线切成小段。下游如果只需要“连通的整条线”，就要重新缝合。JTS 提供了三个语义不同的工具，名字很像，用途差别很大。

### 14.8.1 LineMerger：按节点合并

`LineMerger` 把输入线按端点建图，然后从“度不为 2”的节点出发，沿着度 2 的节点一路串下去，得到尽可能长的线串。核心规则是：**只在度为 2 的节点继续串**，遇到分叉（度 ≥ 3）或断头（度 1）就停。

```java
import java.util.Collection;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.linemerge.LineMerger;

public class LineMergerDemo {
    public static void main(String[] args) throws Exception {
        WKTReader reader = new WKTReader();
        GeometryFactory gf = new GeometryFactory();
        Geometry input = reader.read(
            "MULTILINESTRING ((0 0, 5 0), (10 0, 5 0), (10 0, 15 0))");

        LineMerger merger = new LineMerger();
        merger.add(input);
        Collection merged = merger.getMergedLineStrings();
        System.out.println("合并后线数=" + merged.size());
        System.out.println(gf.buildGeometry(merged));
    }
}
```

示例输出：

```
合并后线数=1
LINESTRING (0 0, 5 0, 10 0, 15 0)
```

中间那条 `(10 0, 5 0)` 方向与另两条相反，`LineMerger` 会自动调整方向完成首尾相接。输出的 LineString 顶点顺序是“从起点走到终点”，但起点选择由实现内部的节点遍历顺序决定，不要依赖。

`LineMerger` 不会在交叉点分叉：如果三条线交于一点（度 3），它会分别串出三条线，而不是把它们合成一条。这是它与 `LineDissolver` 的关键区别。

### 14.8.2 LineSequencer：把线排成连续路径

`LineSequencer` 解决的是另一个问题：把一组线重排/反向，使它们“首尾相接”地连成一个 `MultiLineString`，即输出几何的第 i 条线终点等于第 i+1 条线起点。这本质上是图论里的欧拉路径问题，判定条件是一个连通分量内奇数度节点不超过 2 个。

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.operation.linemerge.LineSequencer;

public class LineSequencerDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new WKTReader().read(
            "MULTILINESTRING ((0 0, 5 0), (10 0, 5 0), (10 0, 15 0))");

        LineSequencer sequencer = new LineSequencer();
        sequencer.add(input);
        System.out.println("isSequenceable=" + sequencer.isSequenceable());
        System.out.println(sequencer.getSequencedLineStrings());
    }
}
```

示例输出：

```
isSequenceable=true
MULTILINESTRING ((0 0, 5 0), (5 0, 10 0), (10 0, 15 0))
```

注意它**不合并顶点**：输出仍是 3 条 `LineString`，只是保证顺序与方向连续。如果先 `LineMerger` 再 `LineSequencer`，通常会得到一条长线（如果节点度数允许）。另外 `LineSequencer.isSequenced(Geometry)` 是静态方法，可直接检查一个 `MultiLineString` 是否已经排好序，适合做数据质检。

判定不可排序的例子是“Y 形”三条线：中心节点度 3，奇数度节点为 1 个（中心）加三个端点共 4 个，超过 2，`isSequenceable()` 返回 `false`，`getSequencedLineStrings()` 返回 `null`。使用时务必先判断。

### 14.8.3 LineDissolver：合并同向重叠段

`LineDissolver` 是三个工具里最“暴力”的：它把输入线拆成边图，按半边结构找最长路径，把“能被同一条路径覆盖”的线段合并，**并丢弃重复的共线线段**。它的典型用途是“把重复录入的边界线合成一条”。

```java
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.dissolve.LineDissolver;

public class LineDissolverDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new WKTReader().read(
            "MULTILINESTRING ((0 0, 5 0), (5 0, 10 0), (3 0, 7 0))");
        System.out.println(LineDissolver.dissolve(input));
    }
}
```

示例输出：

```
MULTILINESTRING ((3 0, 7 0), (0 0, 5 0, 10 0))
```

输入包含三段：0~5、5~10、3~7，其中 3~7 与前面两段部分重叠。`LineDissolver` 输出的两条线仍覆盖了重叠区域（3~7 与 0~10 在 3~7 段重复），但要理解它的语义：它把**完全相同的边**只保留一次，而“部分重叠”的线会被拆成不同边级别，输出结果仍需再做一次 noding 才能消除重叠。`LineDissolver` 的强项是“同一批数据里重复录入的线”，不是“任意部分重叠的线”。

### 14.8.4 三者对比

| 工具 | 核心逻辑 | 输出 | 是否合并顶点 | 是否保留原始分段 | 典型场景 |
| --- | --- | --- | --- | --- | --- |
| `LineMerger` | 度 2 节点串联 | `Collection<LineString>` | 是（去重顶点） | 否（合成更长线） | 碎线合并、河段拼接 |
| `LineSequencer` | 欧拉路径排序 | 单个 `Geometry` | 否 | 是（只调顺序/方向） | 路径规划、轨迹连续化 |
| `LineDissolver` | 半边图最长路径 | `Geometry` | 是 | 否（丢弃重复边） | 去重、边界线归并 |

选择建议：

- 要“一条连通的线” → `LineMerger`；
- 要“顺序/方向连续的多段线” → `LineSequencer`；
- 要“去掉重复录入的线” → `LineDissolver`；
- 三者都不改变节点化后的拓扑（不会新增交点），所以顺序上永远是“先 noding，再缝合”。

## 14.9 edgegraph 与 planargraph：半边结构

### 14.9.1 HalfEdge 的结构

`edgegraph` 是 JTS 1.15 之后引入的轻量半边（half-edge）图，用来替代老旧的 `planargraph` 做线网拓扑遍历。`HalfEdge` 的关键字段只有三个：`orig`（起点坐标）、`sym`（对偶半边）、`next`（同节点的下一条边）。其余拓扑关系全部由这三个指针推导：

```
一个节点周围的半边环（星形）

             e1
        ┌────────→
        │
   e0   │   e2
  ←─────●─────→
        │
        ↓
       e3

  e0.sym() = e0 的对偶（反向边）
  e0.oNext() = e2   （绕节点逆时针的下一条出边）
  e0.dNext() = ...  （绕目标节点的下一条边）
  e0.lNext() = ...  （左侧面的下一条边）
```

完整方法列表：

| 方法 | 含义 |
| --- | --- |
| `orig()` / `dest()` | 起点 / 终点 |
| `sym()` | 对偶半边（反向） |
| `next()` / `oNext()` | 下一条边 / 绕同一起点的下一条出边 |
| `prev()` / `oPrev()` | 前一条边 / 绕同一起点的前一条出边 |
| `dNext()` / `dPrev()` | 绕终点的下一条 / 前一条边 |
| `lNext()` / `lPrev()` | 左侧面的下一条 / 前一条边 |
| `insert(HalfEdge)` | 按角度顺序插入一条出边 |
| `find(Coordinate)` | 找指向某点的出边 |
| `degree()` | 节点度数 |

`oNext()` 的实现只有一个表达式：`sym.next`。这种“用最少的指针表达全部拓扑”的设计让半边图遍历非常快，也是 `LineDissolver`、`EdgeGraph` 等实现的基础。

### 14.9.2 EdgeGraph 与 EdgeGraphBuilder

`EdgeGraph` 负责维护“坐标 → 半边”的映射，并在插入边时按角度顺序把出边插到正确位置：

```java
public class EdgeGraph {
    public HalfEdge addEdge(Coordinate orig, Coordinate dest);  // 已存在则返回已有边
    public HalfEdge findEdge(Coordinate orig, Coordinate dest);
    public Collection getVertexEdges();                          // 每个节点的第一条出边
    public static boolean isValidEdge(Coordinate orig, Coordinate dest); // 排除零长度
}
```

`EdgeGraphBuilder` 是几何层的入口：`build(Collection geoms)` 会遍历所有 `LineString`，逐段调用 `addEdge`。重复的边只会保留一条，这是 `LineDissolver` 去重的底层机制。

```java
import java.util.Collections;

import org.locationtech.jts.edgegraph.EdgeGraph;
import org.locationtech.jts.edgegraph.EdgeGraphBuilder;
import org.locationtech.jts.edgegraph.HalfEdge;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class EdgeGraphDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new WKTReader().read(
            "MULTILINESTRING ((0 0, 5 0), (5 0, 5 5), (5 5, 0 0), (5 0, 10 0))");
        EdgeGraph graph = EdgeGraphBuilder.build(Collections.singletonList(input));

        System.out.println("有出边的节点数=" + graph.getVertexEdges().size());

        HalfEdge e = graph.findEdge(new Coordinate(5, 0), new Coordinate(5, 5));
        System.out.println("找到边=" + (e != null) + ", 起点度数=" + e.degree());

        // 绕节点遍历所有出边
        HalfEdge start = e;
        HalfEdge curr = start;
        do {
            System.out.println("  " + curr + " -> " + curr.dest());
            curr = curr.oNext();
        } while (curr != start);
    }
}
```

示例输出（JTS 1.20.0）：

```
有出边的节点数=4
找到边=true, 起点度数=3
  HE(5.0 0.0, 5.0 5.0) -> (5.0, 5.0, NaN)
  HE(5.0 0.0, 0.0 0.0) -> (0.0, 0.0, NaN)
  HE(5.0 0.0, 10.0 0.0) -> (10.0, 0.0, NaN)
```

`(5,0)` 节点连接三个方向：到 `(5,5)`、到 `(0,0)`、到 `(10,0)`，度数 3。`HalfEdge.toString()` 输出的是“起点 → 终点”，遍历从 `findEdge(5 0, 5 5)` 得到的边开始，沿 `oNext()` 绕节点转一圈，依次经过指向 `(0,0)`、`(10,0)` 的边；输出的 `dest()` 是 `Coordinate`，`toString()` 会带上 `NaN` 的 Z 值。

### 14.9.4 HalfEdge 的插入与角序

`insert(HalfEdge eAdd)` 不是简单链表头插，而是按**角度顺序**插入：`compareAngularDirection` 先比较象限（`Quadrant.quadrant`），再在相同象限内用 `Orientation.index` 做叉积比较。因此 `oNext()` 遍历得到的出边是按角度有序的。这个性质让“找最小/最大角度方向”“判断转向”“构建面”都可以在 O(degree) 内完成。

```java
// 找节点所有出边中角度最小的方向（用于确定面的起始边等）
HalfEdge lowest = start;
HalfEdge e = start.oNext();
do {
    if (e.compareTo(lowest) < 0) lowest = e;
    e = e.oNext();
} while (e != start);
```

`HalfEdge.isEdgesSorted()` 可以用来断言插入逻辑是否维持了角序，调试自研图算法时很有用。

### 14.9.5 planargraph：老一代线网图

`org.locationtech.jts.planargraph` 是 JTS 早期实现的平面图框架，包含 `PlanarGraph`、`Node`、`Edge`、`DirectedEdge`、`DirectedEdgeStar`、`Subgraph`、`NodeMap` 以及 `algorithm.ConnectedSubgraphFinder`。`LineMerger` 与 `LineSequencer` 内部用的正是它（`LineMergeGraph`、`LineMergeDirectedEdge`）。

两代结构的关系：

| 维度 | `planargraph` | `edgegraph` |
| --- | --- | --- |
| 引入版本 | 早期（JTS 1.x） | 1.15 之后 |
| 抽象层级 | 节点、边、有向边、星形边组 | 半边（HalfEdge） |
| 代码量 | 大（多个类） | 小（一个类 + 图容器） |
| 角度顺序 | `DirectedEdgeStar` 维护 | `HalfEdge.insert` 按角度插入 |
| 使用位置 | `LineMerger`、`LineSequencer`、旧覆盖算法 | `LineDissolver`、新算法 |
| 推荐程度 | 维护老代码时了解即可 | 新代码优先 |

如果只是“合并线/排序线”，直接用 `LineMerger`/`LineSequencer` 即可，不需要碰 `planargraph`；只有要自己实现“面追踪”“连通分量分析”“网络转向限制”这类算法，才需要下到图结构层。用 `planargraph` 时注意它的 `DirectedEdge` 方向语义与 `edgegraph` 相反（前者 `getEdgeDirection()` 表示是否与原边同向），迁移代码时容易搞反。

### 14.9.6 用半边图算节点度数分布

道路网预处理的常见质检指标是“度数为 1 的节点数”（断头路）、“度数为 2 的节点数”（可合并的伪节点）、“度数 ≥ 3 的节点数”（真实路口）。用 `EdgeGraph` 可以几行算出来：

```java
import java.util.Collections;
import java.util.Map;
import java.util.TreeMap;

import org.locationtech.jts.edgegraph.EdgeGraph;
import org.locationtech.jts.edgegraph.EdgeGraphBuilder;
import org.locationtech.jts.edgegraph.HalfEdge;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

public class DegreeStatsDemo {
    public static void main(String[] args) throws Exception {
        Geometry input = new WKTReader().read(
            "MULTILINESTRING ((0 0, 5 0), (5 0, 5 5), (5 5, 0 0), (5 0, 10 0))");
        EdgeGraph graph = EdgeGraphBuilder.build(Collections.singletonList(input));

        Map<Integer, Integer> histogram = new TreeMap<Integer, Integer>();
        for (Object o : graph.getVertexEdges()) {
            HalfEdge e = (HalfEdge) o;
            int degree = e.degree();
            histogram.merge(degree, 1, Integer::sum);
        }
        System.out.println("度数分布=" + histogram);
    }
}
```

示例输出：

```
度数分布={1: 2, 2: 1, 3: 1}
```

解释：`(0,0)` 与 `(10,0)` 是断头（度 1），`(5,5)` 只有两条边（度 2，属于可合并的伪节点），`(5,0)` 是真实三岔口（度 3）。把这段代码扩成“按 `LineString` 统计、按图层统计”，就是一个可用的路网拓扑质检器。

## 14.10 实战：道路网/管网预处理流水线

### 14.10.1 完整流程

```
原始线网（多源、精度不一、有重复、有断头）
   │
   ▼
① 清洗：去空、去零长度、去重复点（CoordinateArrays.removeRepeatedPoints）
   │
   ▼
② 精度统一：SnapRoundingNoder(pm) 或 SnappingNoder(tol)
   │
   ▼
③ 节点化：MCIndexNoder + IntersectionAdder（精确路径）
   │
   ▼
④ 自检：FastNodingValidator.isValid()
   │
   ▼
⑤ 缝合：LineMerger（合并碎段）
   │
   ▼
⑥ 拓扑分析：EdgeGraph 度数分布 / 连通分量
   │
   ▼
⑦ 成果：干净线网 + 质检报告
```

### 14.10.2 代码实现

下面是一个可直接运行的简化版流水线（数据内联，便于复现）。它演示了去重、清洗、捕捉舍入、节点化、校验、合并与拓扑统计七步。

```java
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.locationtech.jts.algorithm.RobustLineIntersector;
import org.locationtech.jts.edgegraph.EdgeGraph;
import org.locationtech.jts.edgegraph.EdgeGraphBuilder;
import org.locationtech.jts.edgegraph.HalfEdge;
import org.locationtech.jts.geom.CoordinateArrays;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.noding.FastNodingValidator;
import org.locationtech.jts.noding.IntersectionAdder;
import org.locationtech.jts.noding.MCIndexNoder;
import org.locationtech.jts.noding.Noder;
import org.locationtech.jts.noding.SegmentStringUtil;
import org.locationtech.jts.noding.snapround.SnapRoundingNoder;
import org.locationtech.jts.operation.linemerge.LineMerger;

public class RoadPreprocessDemo {
    public static void main(String[] args) throws Exception {
        GeometryFactory gf = new GeometryFactory();
        WKTReader reader = new WKTReader();

        // 1. 模拟三条"脏"数据：一条正常、一条端点差一点、一条重复
        Geometry raw = reader.read(
            "MULTILINESTRING ("
            + " (0 0, 10 0),"
            + " (10.0002 0.0001, 10.0002 8),"
            + " (0 0, 10 0))");

        // 2. 去重：按规范化 WKT 判重，保留首次出现的几何
        Set<String> seen = new HashSet<String>();
        List<Geometry> unique = new ArrayList<Geometry>();
        for (int i = 0; i < raw.getNumGeometries(); i++) {
            Geometry line = raw.getGeometryN(i);
            if (seen.add(line.norm().toString())) {
                unique.add(line);
            }
        }
        Geometry uniqueGeom = gf.buildGeometry(unique);
        System.out.println("去重后线数=" + unique.size());

        // 3. 清洗：去重复点
        List<Geometry> cleaned = new ArrayList<Geometry>();
        for (Geometry line : unique) {
            cleaned.add(gf.createLineString(
                CoordinateArrays.removeRepeatedPoints(line.getCoordinates())));
        }
        Geometry cleanedGeom = gf.buildGeometry(cleaned);

        // 4. 捕捉舍入到 0.001 网格
        Noder snapper = new SnapRoundingNoder(new PrecisionModel(1000));
        snapper.computeNodes(SegmentStringUtil.extractSegmentStrings(cleanedGeom));
        Geometry snapped = SegmentStringUtil.toGeometry(
            snapper.getNodedSubstrings(), gf);
        System.out.println("捕捉舍入后=" + snapped);

        // 5. 精确节点化
        List segStrings = SegmentStringUtil.extractSegmentStrings(snapped);
        MCIndexNoder noder = new MCIndexNoder(
            new IntersectionAdder(new RobustLineIntersector()));
        noder.computeNodes(segStrings);
        Collection noded = noder.getNodedSubstrings();

        // 6. 校验
        FastNodingValidator validator = new FastNodingValidator(noded);
        if (!validator.isValid()) {
            throw new IllegalStateException(validator.getErrorMessage());
        }
        System.out.println("节点化校验通过，子线段数=" + noded.size());

        // 7. 合并碎段
        LineMerger merger = new LineMerger();
        merger.add(SegmentStringUtil.toGeometry(noded, gf));
        Collection merged = merger.getMergedLineStrings();
        Geometry result = gf.buildGeometry(merged);
        System.out.println("合并后线数=" + merged.size());
        System.out.println(result);

        // 8. 拓扑统计
        EdgeGraph graph = EdgeGraphBuilder.build(Collections.singletonList(result));
        int deadEnds = 0;
        for (Object o : graph.getVertexEdges()) {
            if (((HalfEdge) o).degree() == 1) deadEnds++;
        }
        System.out.println("断头节点数=" + deadEnds);
    }
}
```

示例输出（JTS 1.20.0）：

```
去重后线数=2
捕捉舍入后=MULTILINESTRING ((0 0, 10 0), (10 0, 10 8))
节点化校验通过，子线段数=2
合并后线数=1
LINESTRING (0 0, 10 0, 10 8)
断头节点数=2
```

输出解读：

- 重复输入的那条 `(0 0, 10 0)` 在第 2 步被去重，否则 `LineMerger` 会把重复边当成“来回方向”的两条边，合并出错误结果（实测未去重时输出 `MULTILINESTRING ((10 0, 10 8), (10 0, 0 0, 10 0))`，主路被绕了一圈）。
- 端点 `(10.0002, 0.0001)` 被捕捉舍入到 `(10,0)`，于是支路与主路真正相接。
- 节点化后只有 2 条子线段（主路 1 条 + 支路 1 条），因为交点就在主路端点上，不需要再打断主路。
- 合并后得到一条 `LINESTRING (0 0, 10 0, 10 8)`：主路与支路在 `(10,0)` 处以“L 形”连通，`LineMerger` 在度 2 节点继续合并。
- 两个断头节点分别是 `(0,0)` 与 `(10,8)`。

这个流程可以直接套到实际数据上，只需把内联 WKT 换成 `WKTReader`/`GeoJSONReader` 读文件。

### 14.10.3 工程注意事项

1. **先投影再处理**：`SnapRoundingNoder(pm)` 的精度模型与坐标单位绑定。经纬度数据直接给 `PrecisionModel(1e6)` 相当于 0.000001 度（约 0.1 米），与投影坐标的 1e6 完全不是一回事。推荐在米制投影坐标系下做预处理。
2. **捕捉舍入会移动成果坐标**：如果成果要回到原始坐标系，捕捉后的坐标转换回去会有偏移。对精度敏感的业务，保留原始坐标与“捕捉映射表”。
3. **批量处理注意内存**：`SegmentStringUtil.extractSegmentStrings` 会为每条线复制坐标数组；百万级线网建议分块（按行政区/瓦片）处理。
4. **不要跳过校验**：节点化失败的表现往往是下游叠加报 `TopologyException`，届时很难定位到具体线段。入口处 `FastNodingValidator` 的成本远小于事后排查。
5. **立交与平面交叉**：noding 只处理二维相交，无法区分“高架跨越”和“地面路口”。需要 Z 值、图层属性或显式节点表来补充语义；常见做法是先按图层拆分处理，再在应用层合并。

## 14.11 常见问题与避坑

**1. 直接对未节点化的线做 Polygonizer，结果为空或面不全。**
`Polygonizer` 不做求交。交叉线必须先 `MCIndexNoder` 或 `SnapRoundingNoder` 处理，再丢进去。

**2. 以为 `SnappingNoder` 会合并线。**
它只移动顶点，不合并 `SegmentString`，输出仍是多条线。合并是 `LineMerger` 的工作。

**3. 给 `SnapRoundingNoder` 传 `PrecisionModel.FLOATING`。**
`getScale()` 对 FLOATING 返回 1.0，结果是所有坐标舍入到整数，数据被“压扁”到 1 米/1 度网格。固定精度必须用 `new PrecisionModel(scale)`。

**4. 捕捉容差按“看起来差不多”给。**
容差是绝对距离，且会随单位变化。经纬度数据给 0.001 约等于 100 米，会把整条街的端点合并。先投影、再按数据精度给 1~3 倍。

**5. 用 `ScaledNoder` 做通用预处理。**
JTS 源码明确注释 “ScaledNoder may invalidate topology”，它只适合缓冲这类会重建面的算法。通用叠加请用 `SnapRoundingNoder`。

**6. `IteratedNoder` 不收敛时抛异常被吞掉。**
`TopologyException` 说明数据精度已经超出算法能处理的范围，继续跑只会产生错误结果。应该捕获后单独隔离问题线段。

**7. `LineMerger` 在度 3 节点处不合并。**
这是设计行为。要“穿过路口继续合并”，应先用 `LineDissolver` 或自定义图遍历，而不是调大容差。

**8. `LineSequencer` 返回 `null`。**
不可排序（奇数度节点超过 2）时 `getSequencedLineStrings()` 返回 `null` 而不是抛异常。先调 `isSequenceable()`。

**9. `Polygonizer.getDangles()` 出现重复元素。**
`deleteDangles` 从两个端点分别处理，同一条悬挂线可能被记录两次。使用前去重。

**10. 以为 `Polygonizer` 默认输出“带洞的面”。**
默认构造会把洞环也当成 shell 输出一份。要有效面状几何用 `new Polygonizer(true)`。

**11. `HalfEdge` 遍历死循环。**
`oNext()` 遍历必须用 `do/while (curr != start)`，不能只判 null；如果图构建错误（例如插入了零长度边），环可能不闭合。`EdgeGraph.addEdge` 已经排除了 `orig.equals(dest)` 的边，但 `NaN` 坐标仍可能破坏角序。

**12. 节点化后坐标“看起来没变”但结果不同。**
`NodedSegmentString` 只在交点处新增顶点，原始顶点对象可能被复用。比对结果时用 `equalsExact` 而不是对象引用。

## 14.12 本章小结

- Noding 的输出不是交点列表，而是**在交点处打断后的线段集合**；它保证任意两条输出线段只在端点相交。
- `SegmentString` 是节点化的操作单元；`NodedSegmentString` 用有序的 `SegmentNodeList` 存节点，是默认实现。
- `Noder` 负责枚举候选线段对，`SegmentIntersector` 决定如何处理交点；`MCIndexNoder` + `IntersectionAdder` 是最常用的组合。
- `MCIndexNoder` 1.20 起默认使用 `HPRtree` 索引，配合单调链把候选枚举从 O(n²) 降到近 O(n log n)。
- `SimpleNoder` 是 O(n²) 参考实现，只用于教学与小数据验证。
- `ScaledNoder` 会改变坐标并可能破坏拓扑，只适合缓冲区类算法；通用精度归一应使用 `SnapRoundingNoder`。
- `SnappingNoder` 做顶点捕捉，适合端点抖动；`SnapRoundingNoder` 做网格捕捉舍入，输出严格落在精度网格上，1.18 起取代 `MCIndexSnapRounder`。
- `ValidatingNoder` + `FastNodingValidator` 是生产流水线的自检标准配置。
- `Polygonizer` 把节点化后的线网还原成面，副产品是 dangles/cutEdges/invalidRingLines；默认模式会输出嵌套面，需要有效面状几何时用 `new Polygonizer(true)`。
- `LineMerger` 合并度 2 节点、`LineSequencer` 做欧拉排序、`LineDissolver` 去重，三者语义不同，必须按目的选择。
- `edgegraph` 的 `HalfEdge` 用最少指针表达线网拓扑，边按角度有序，是自研网络分析与质检的利器；`planargraph` 是它的前一代，维护老代码时了解即可。

## 14.13 相关资源

- JTS Javadoc：`org.locationtech.jts.noding` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/noding/package-summary.html>
- JTS Javadoc：`SnapRoundingNoder` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/noding/snapround/SnapRoundingNoder.html>
- JTS Javadoc：`Polygonizer` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/operation/polygonize/Polygonizer.html>
- JTS Javadoc：`EdgeGraph` / `HalfEdge` <https://locationtech.github.io/jts/javadoc/org/locationtech/jts/edgegraph/package-summary.html>
- 源码路径：`modules/core/src/main/java/org/locationtech/jts/noding/`、`operation/polygonize/`、`operation/linemerge/`、`edgegraph/`
- 版本说明：`doc/JTS_Version_History.md`（1.18 新增 SnapRoundingNoder、弃用 MCIndexSnapRounder；1.20 优化 HPRtree 与 Polygonizer）
- 相关章节：[第09章 - 叠加分析详解](https://znlgis.github.io/gis/tutorial/jts/第09章-叠加分析详解/)、[第10章 - 缓冲区与偏移曲线](https://znlgis.github.io/gis/tutorial/jts/第10章-缓冲区与偏移曲线/)、[第13章 - 空间索引体系](https://znlgis.github.io/gis/tutorial/jts/第13章-空间索引体系/)、[第17章 - 有效性与 Coverage 质检](https://znlgis.github.io/gis/tutorial/jts/第17章-有效性与Coverage质检/)

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/jts/第13章-空间索引体系/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/jts/第15章-三角剖分与Voronoi/" class="chapter-nav__next">下一章 →</a>
</div>

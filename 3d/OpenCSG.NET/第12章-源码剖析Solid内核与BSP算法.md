---
layout: default
title: 第12章：源码剖析——Solid 内核与 BSP 算法
---

# 第12章：源码剖析——Solid 内核与 BSP 算法

前面的章节教你"怎么用"，本章带你"看透原理"。我们潜入 OpenCSG.NET 的**引擎室**，逐层拆解 `Solid`、`Tree`、`Node`、`PolygonTreeNode` 这几个核心类，看清一次布尔运算从头到尾发生了什么。理解这些内部机制，能帮你**诊断疑难杂症**（为什么某个模型出洞、为什么慢）、**评估性能**，也为第 14 章的二次开发打底。本章偏理论，但每个结论都对应可观察的行为。

## 12.1 Solid：一袋多边形 + 两个标志位

`Solid`（`Solid.cs`）本质极简——它就是**一袋多边形**加上两个布尔标志：

```csharp
public class Solid
{
    public List<Polygon> Polygons;
    public bool IsCanonicalized;
    public bool IsRetesselated;

    public const int DefaultResolution2D = 32;
    public const int DefaultResolution3D = 12;
}
```

- `Polygons`：构成实体表面的凸多边形列表（B-rep，见第 3 章）。
- `IsCanonicalized` / `IsRetesselated`：两个**"整洁度"标志**，记录这袋多边形是否已经过"规范化"和"重镶嵌"两道清理工序（下文详解）。
- `DefaultResolution2D = 32` / `DefaultResolution3D = 12`：圆柱/圆等曲面的默认分段数（见第 5 章）。

新建的空 `Solid` 两个标志都为 `true`（已经很整洁），但 `FromPolygons` 造出来的**都是 `false`**——因为一袋原始多边形还没清理：

```csharp
public static Solid FromPolygons(List<Polygon> polygons)
{
    var csg = new Solid();
    csg.Polygons = polygons;
    csg.IsCanonicalized = false;
    csg.IsRetesselated = false;
    return csg;
}
```

这两个标志是**惰性清理**的开关：布尔运算过程中会把它们打成 `false`，只在运算收尾时才真正执行昂贵的清理。这是一个重要的性能设计。

## 12.2 布尔运算的算法骨架

第 3 章讲过 CSG 布尔基于 **BSP 树**。这里看实现。三种运算都遵循经典的 csg.js 算法，核心是构造两棵 BSP 树、互相裁剪、再合并。

### 12.2.1 并集 Union

```csharp
public Solid Union(params Solid[] others)
{
    if (others.Length == 0)
        return this.Retesselated().Canonicalized();

    var center = CombinedBoundsAll(this, others).Center;   // ① 求合并包围盒中心
    var result = TranslateBy(this, center.Negated);         // ② 整体平移到原点附近
    for (var i = 0; i < others.Length; i++)
        result = result.UnionSubLocal(TranslateBy(others[i], center.Negated));
    result = result.Retesselated().Canonicalized();         // ④ 收尾清理
    return TranslateBy(result, center);                     // ⑤ 平移回原位
}
```

注意 ①②⑤——**先把所有几何平移到合并包围盒中心附近，算完再平移回去**。这是数值稳定性的关键（见 12.5）。真正的布尔在 `UnionSubLocal`：

```csharp
Solid UnionSubLocal(Solid csg)
{
    if (!MayOverlap(csg))                   // 包围盒不相交 → 直接拼接，跳过 BSP
        return UnionForNonIntersecting(csg);

    var treeA = new Tree(Bounds, Polygons);
    var treeB = new Tree(csg.Bounds, csg.Polygons);

    treeA.ClipTo(treeB, false);   // 用 B 裁掉 A 在 B 内部的面
    treeB.ClipTo(treeA);          // 用 A 裁掉 B 在 A 内部的面
    treeB.Invert();               // 翻转 B
    treeB.ClipTo(treeA);          // 再裁一次，去掉重叠面
    treeB.Invert();               // 翻转回来

    var newpolygons = new List<Polygon>(treeA.AllPolygons());
    newpolygons.AddRange(treeB.AllPolygons());
    return Solid.FromPolygons(newpolygons);
}
```

直觉：并集 = **A 在 B 外的部分** + **B 在 A 外的部分**。裁剪就是去掉"陷在对方内部"的面，翻转+再裁一遍则处理共面重叠，避免留下内壁。

### 12.2.2 差集 Subtract 与交集 Intersect

差集与交集共用同一套裁剪工具，只是**翻转（Invert）的时机**不同——这正是 CSG 的精妙之处，靠"翻转内外"把并集算法复用成差集和交集：

```csharp
// 差集 A − B
Solid SubtractSub(Solid csg, ...)
{
    var a = new Tree(Bounds, Polygons);
    var b = new Tree(csg.Bounds, csg.Polygons);
    a.Invert();            // 把 A 内外翻转
    a.ClipTo(b);
    b.ClipTo(a, true);     // alsoRemoveCoplanarFront=true
    a.AddPolygons(b.AllPolygons());
    a.Invert();            // 翻回来
    return Solid.FromPolygons(a.AllPolygons());
}

// 交集 A ∩ B
Solid IntersectSub(Solid csg, ...)
{
    var a = new Tree(Bounds, Polygons);
    var b = new Tree(csg.Bounds, csg.Polygons);
    a.Invert();
    b.ClipTo(a);
    b.Invert();
    a.ClipTo(b);
    b.ClipTo(a);
    a.AddPolygons(b.AllPolygons());
    a.Invert();
    return Solid.FromPolygons(a.AllPolygons());
}
```

`Subtract`/`Intersect` 接收 `params Solid[]`，**从左到右逐个折叠**，且只在**最后一个**操作数上执行 `retesselate`/`canonicalize`（`islast` 标志），中间步骤跳过清理以省时间。

### 12.2.3 包围盒短路优化

三种运算开头都可能走"快速通道"：`MayOverlap` 用**轴对齐包围盒（AABB）** 判断两个实体是否可能相交。若它们的包围盒都不重叠（比如相距很远的两个零件做并集），根本无需构造昂贵的 BSP 树，直接把两袋多边形拼起来即可（`UnionForNonIntersecting`）。这个廉价的预判在装配大量分离零件时能省下大量时间。

## 12.3 Tree / Node：迭代式 BSP 的实现

`Tree`（`Tree.cs`）封装了一棵 BSP，它内部其实有**两套树**：

```csharp
class Tree
{
    PolygonTreeNode polygonTree;   // 多边形层级（管理"分裂"）
    Node rootnode;                 // 空间划分树（BSP 本体）
}
```

- `Node`：真正的 **BSP 节点**，每个节点有一个分割平面 `Plane`、`Front`/`Back` 子节点，以及落在该平面上的多边形引用。
- `PolygonTreeNode`：一套**平行的多边形层级**，专门跟踪"一个多边形被平面切成几片"的父子关系。

### 12.3.1 关键工程决策：全部迭代，杜绝递归

一个非常值得学习的实现细节：`Node` 的所有核心操作——`Invert`、`ClipPolygons`、`ClipTo`、`AddPolygonTreeNodes`——**都用显式的 `Stack`/`Queue` 手动迭代，而不是递归**。例如构建 BSP 的 `AddPolygonTreeNodes`：

```csharp
public void AddPolygonTreeNodes(PolygonTreeNodeList addpolygontreenodes)
{
    var args = new Args(node: this, polygonTreeNodes: addpolygontreenodes);
    Stack<Args>? stack = null;
    while (true)
    {
        // ……取当前节点的分割平面（没有就用第一个多边形的平面）……
        // ……把多边形按平面分到 frontnodes / backnodes……
        // ……把 front/back 压栈，继续循环，而不是递归调用自己……
        if (stack != null && stack.Count > 0) args = stack.Pop();
        else break;
    }
}
```

**为什么这么写？** BSP 树在复杂模型上可能很深（成百上千层）。若用递归，深树会直接**爆栈**（`StackOverflowException`）。改用堆上的显式栈，就把递归深度从受限的调用栈搬到了几乎无限的堆内存，**保证了大模型的健壮性**。这是把教科书递归算法工程化落地的典范。

### 12.3.2 Invert：翻转内外

`Node.Invert` 把整棵树的每个平面 `Flipped()`，并交换所有节点的 `Front`/`Back`。几何意义就是**把实体的"内"和"外"对调**——这正是 12.2.2 里差集/交集复用并集算法的底层开关。它用一个 `Queue` 广度优先地遍历整棵树完成翻转。

### 12.3.3 ClipPolygons：裁剪的核心

`ClipPolygons` 是"裁掉对方内部面"的执行者。对送进来的每个多边形，用当前 BSP 节点的平面做 `SplitByPlane`：

- 落在平面**前方**的片 → 送入 `Front` 子树继续裁；
- 落在**后方**的片 → 若有 `Back` 子树就继续，**若没有 Back 子树，说明这片在实体内部，直接 `Remove()` 删除**。

如此递归下压，最终留下的就是"在对方实体外部"的表面。`alsoRemoveCoplanarFront` 参数控制共面朝前的片是保留还是一并删除——差集里对 B 用 `true`，以干净地切出减料面。

## 12.4 PolygonTreeNode：可分裂的多边形与两个小优化

当一个多边形被平面切开，OpenCSG.NET 不是简单地替换它，而是用 `PolygonTreeNode` 记录"父多边形 → 若干子片"的层级：切开时给父节点 `AddChild` 两个子片、把父多边形置空（`RecursivelyInvalidatePolygon`），枚举时 `GetPolygons` 只收集**叶子**上的当前有效片。这样同一个多边形可以被反复细分，而系统始终能拿到"当前最新的碎片集合"。

### 12.4.1 包围球快速排斥

`SplitPolygonByPlane` 在真正做昂贵的多边形切割前，先用**包围球**快速排斥：算平面到多边形包围球心的有符号距离 `d`，

- `d > 半径` → 整片在平面前方，不用切；
- `d < −半径` → 整片在后方，不用切；
- 否则才调用 `plane.SplitPolygon` 精确切割。

`SplitPolygon` 的结果类型分五种：`0` 共面朝前、`1` 共面朝后、`2` 纯前、`3` 纯后、其余为**跨越**（真正一分为二，生成前后两个子片）。这个"先球判、后精切"的两级策略避免了大量无谓的精确计算。

### 12.4.2 PolygonTreeNodeList：0/1/N 三态微集合

`PolygonTreeNodeList` 是一个不起眼却精彩的**内存优化**。BSP 里会产生海量的小列表，而其中绝大多数只装 **0 个或 1 个**元素。为每个这样的列表都 `new List<T>()` 会造成巨大的分配压力。于是这个类做了三态特化：

```csharp
class PolygonTreeNodeList
{
    PolygonTreeNode? node0;              // 只有 1 个元素时用它
    List<PolygonTreeNode>? nodes;        // 有 2+ 个元素时才分配真正的 List
    public int Count => nodes != null ? nodes.Count : (node0 != null ? 1 : 0);
    // Add() 在从 1 变 2 时才升级为 List
}
```

- **0 个元素**：两个字段都为 null，零分配。
- **1 个元素**：存进 `node0`，仍零 List 分配。
- **≥2 个元素**：这才创建 `List`。

在动辄百万次操作的布尔运算里，这个"按需升级"的技巧显著降低了 GC 压力，是热点路径上的实打实优化。

## 12.5 数值稳定性：为什么要"搬到原点"

12.2.1 提到 Union 会把几何平移到合并包围盒中心再运算。**原因是浮点精度**。BSP 判断一个点在平面哪一侧，靠的是 `法向量 · 点 − 平面偏移W`。当坐标很大（比如工程坐标 `(-49256, 12000, 5)`）时，两个大数相减会发生**灾难性抵消（catastrophic cancellation）**，有效位数骤降，导致"点到底在平面前还是后"判断出错，模型出现漏洞或碎面。

把几何整体搬到原点附近，坐标数量级变小，相减的精度就恢复了；算完再搬回去。上游仓库专门有 `LargeCoordinateUnionTest` 之类的测试守护这个行为。**启示**：如果你的模型远离原点还出现布尔异常，手动 `Translate` 到原点附近再运算往往能解决。

## 12.6 Canonicalize 与 Retesselate：两道收尾清理

布尔运算产出的"多边形袋"是零散的：同一个顶点可能有多份浮点略有差异的副本，同一个平面上可能散落很多本可合并的小三角形。收尾的两道工序负责清理，它们都受标志位保护、惰性执行。

### 12.6.1 Canonicalized：规范化拓扑

```csharp
Solid Canonicalized()
{
    if (IsCanonicalized) return this;      // 已整洁，直接返回
    var factory = new FuzzyCsgFactory();
    var result = factory.GetCsg(this);     // 按容差合并重复顶点/平面
    ...
}
```

`FuzzyCsgFactory` 内部有 `VertexFactory`/`PlaneFactory`，用一个**容差量化的 Key**（把坐标量化成整数 `X,Y,Z,U,V`）做 `LookupOrCreate`：几何上"足够接近"的顶点/平面被**合并成同一个共享实例**。这样浮点噪声被抹平，拓扑变得干净、可比较——为下一步重镶嵌和后续布尔提供一致的 `Tag`。

### 12.6.2 Retesselated：重镶嵌合并共面

```csharp
Solid Retesselated()
{
    if (IsRetesselated) return this;
    // 按 (PlaneTag, SharedTag) 把多边形分组——即"同一平面同一材质"的片
    // 每组若有 ≥2 片，调用 RetesselateCoplanarPolygons 合并/重划分
    ...
}
```

重镶嵌把**同一平面上**的多个多边形收集起来，用一个**扫描线算法**（`RetesselateCoplanarPolygons`，源码里那一大段带 `RetesselateActivePolygon`/`Line2D` 的逻辑）重新划分成更规整、更少的多边形，消除布尔切割留下的 **T 形接缝**和碎片。结果面数更少、网格更干净，导出的 STL 也更规整。

### 12.6.3 惰性与标志位

关键在于两者都**先查标志位**：`if (IsCanonicalized) return this;`。布尔运算中间步骤把标志设为 `false` 但**不立即清理**，只在最外层收尾时才跑一次。这避免了在多步布尔链里反复做昂贵清理——**只在最后清理一次**。理解这点能解释一个现象：把多次布尔拆成多条语句、还是串成一条链，性能可能不同。

## 12.7 Tag 系统：贯穿始终的身份标识

上面反复出现的 `Tag`（顶点 Tag、平面 Tag、共享数据 Tag）来自一个全局计数器：

```csharp
static int staticTag = 1;
public static int GetTag() => System.Threading.Interlocked.Increment(ref staticTag);
```

用 `Interlocked.Increment` 保证**线程安全**地分发全局唯一整数 ID。这些 Tag 有两大用途：

1. **变换缓存**（第 7 章）：`Transform` 用 Tag 作字典键，同一个顶点/平面只变换一次。
2. **分组去重**（本章）：Retesselate 用 `(PlaneTag, SharedTag)` 分组，Canonicalize 用 Tag 标识合并后的共享实例。

一个小整数 ID 把"同一个几何元素"在整套算法里串联起来，既省内存又提速。

## 12.8 一次布尔运算的全景回放

把本章串成一条时间线——`a.Subtract(b)` 到底经历了什么：

1. **入口**：`Subtract` 折叠参数，对最后一个操作数标记 `islast=true`。
2. **建树**：为 `a`、`b` 各建一棵 `Tree`（`Node` BSP + `PolygonTreeNode` 层级），`AddPolygonTreeNodes` 迭代式地选平面、分前后，把多边形装进 BSP。
3. **裁剪**：`a.Invert()` → `a.ClipTo(b)` → `b.ClipTo(a, true)`，用包围球快排 + 精确切割逐面裁剪，`PolygonTreeNodeList` 三态微集合压制分配。
4. **合并**：`a.AddPolygons(b.AllPolygons())` 把 B 的保留面并入 A，`a.Invert()` 翻回来。
5. **收尾**：因 `islast`，执行 `Retesselated()`（合并共面、消 T 缝）与 `Canonicalized()`（合并重复顶点/平面），标志位置 `true`。
6. **产出**：一个干净的 `Solid`，可继续布尔或导出 STL。

## 12.9 本章小结

- `Solid` = **一袋多边形** + `IsCanonicalized`/`IsRetesselated` 两个惰性清理标志；`FromPolygons` 造出的实体标志为 `false`，收尾时才清理。
- 三种布尔运算共用 **BSP 裁剪** 工具，靠 **Invert 时机**区分并/差/交；`Subtract`/`Intersect` 逐个折叠、只在最后清理；包围盒 `MayOverlap` 提供短路优化。
- `Tree` 内含 **`Node` 空间 BSP** 与 **`PolygonTreeNode` 多边形层级**两套树；所有核心操作**迭代而非递归**，避免深树爆栈。
- 两个精妙优化：`SplitPolygonByPlane` 的**包围球快速排斥**、`PolygonTreeNodeList` 的 **0/1/N 三态微集合**（压制 GC）。
- **数值稳定性**：布尔前把几何搬到原点附近，规避大坐标下的浮点灾难性抵消；远离原点出问题时手动平移可解。
- **收尾清理**：`Canonicalized`（FuzzyCsgFactory 按容差合并顶点/平面）+ `Retesselated`（扫描线合并共面、消 T 缝），均由标志位惰性触发。
- **Tag 系统**（`Interlocked` 全局唯一 ID）贯穿变换缓存与分组去重。

理论到此告一段落。下一章回到实战——用命令式 API 一步步建出一根**冷弯 C 型钢檩条**，把前面所学融会贯通。

---

<div style="display:flex; justify-content:space-between; margin-top:3rem;">
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第12章-源码剖析Solid内核与BSP算法/第11章-CsgNode的JSON序列化/">← 上一章</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第12章-源码剖析Solid内核与BSP算法/">目录</a>
  <a href="https://znlgis.github.io/3d/OpenCSG.NET/第12章-源码剖析Solid内核与BSP算法/第13章-实战案例冷弯C型钢檩条建模/">下一章 →</a>
</div>

---
layout: default
title: 第9章：Clipper 类结构与初始化
---

# 第9章：Clipper 类结构与初始化

## 9.1 概述

`Clipper` 类继承自 `ClipperBase`，是用户直接使用的主要类。它实现了多边形布尔运算的核心算法，包括交集、并集、差集和异或运算。

## 9.2 类定义

```csharp
public class Clipper : ClipperBase
{
    // 初始化选项常量
    public const int ioReverseSolution = 1;
    public const int ioStrictlySimple = 2;
    public const int ioPreserveCollinear = 4;

    // 私有成员
    private ClipType m_ClipType;
    private Maxima m_Maxima;
    private TEdge m_SortedEdges;
    private List<IntersectNode> m_IntersectList;
    IComparer<IntersectNode> m_IntersectNodeComparer;
    private bool m_ExecuteLocked;
    private PolyFillType m_ClipFillType;
    private PolyFillType m_SubjFillType;
    private List<Join> m_Joins;
    private List<Join> m_GhostJoins;
    private bool m_UsingPolyTree;
    
#if use_xyz
    public delegate void ZFillCallback(IntPoint bot1, IntPoint top1, 
        IntPoint bot2, IntPoint top2, ref IntPoint pt);
    public ZFillCallback ZFillFunction { get; set; }
#endif

    // 公共属性
    public bool ReverseSolution { get; set; }
    public bool StrictlySimple { get; set; }
}
```

## 9.3 成员变量详解

### 9.3.1 运算状态

| 成员 | 类型 | 说明 |
|------|------|------|
| `m_ClipType` | `ClipType` | 当前裁剪操作类型 |
| `m_ClipFillType` | `PolyFillType` | 裁剪多边形的填充规则 |
| `m_SubjFillType` | `PolyFillType` | 主体多边形的填充规则 |
| `m_ExecuteLocked` | `bool` | 防止重入执行 |
| `m_UsingPolyTree` | `bool` | 是否使用 PolyTree 输出 |

### 9.3.2 数据结构

| 成员 | 类型 | 说明 |
|------|------|------|
| `m_Maxima` | `Maxima` | 局部极大值链表 |
| `m_SortedEdges` | `TEdge` | 排序边列表头 |
| `m_IntersectList` | `List<IntersectNode>` | 交点列表 |
| `m_Joins` | `List<Join>` | 连接点列表 |
| `m_GhostJoins` | `List<Join>` | 幽灵连接点（水平边） |

### 9.3.3 辅助结构

**Maxima 结构**：
```csharp
internal class Maxima
{
    internal cInt X;        // 极大值的 X 坐标
    internal Maxima Next;   // 下一个极大值
    internal Maxima Prev;   // 上一个极大值
}
```

**IntersectNode 结构**：
```csharp
public class IntersectNode
{
    internal TEdge Edge1;   // 参与交点的第一条边
    internal TEdge Edge2;   // 参与交点的第二条边
    internal IntPoint Pt;   // 交点坐标
}
```

**Join 结构**：
```csharp
internal class Join
{
    internal OutPt OutPt1;  // 第一个输出点
    internal OutPt OutPt2;  // 第二个输出点
    internal IntPoint OffPt; // 偏移点（用于判断连接方向）
}
```

## 9.4 构造函数

```csharp
public Clipper(int InitOptions = 0) : base()
{
    m_Scanbeam = null;
    m_Maxima = null;
    m_ActiveEdges = null;
    m_SortedEdges = null;
    m_IntersectList = new List<IntersectNode>();
    m_IntersectNodeComparer = new MyIntersectNodeSort();
    m_ExecuteLocked = false;
    m_UsingPolyTree = false;
    m_PolyOuts = new List<OutRec>();
    m_Joins = new List<Join>();
    m_GhostJoins = new List<Join>();
    
    // 解析初始化选项
    ReverseSolution = (ioReverseSolution & InitOptions) != 0;
    StrictlySimple = (ioStrictlySimple & InitOptions) != 0;
    PreserveCollinear = (ioPreserveCollinear & InitOptions) != 0;
    
#if use_xyz
    ZFillFunction = null;
#endif
}
```

### 9.4.1 初始化选项

| 选项 | 值 | 说明 |
|------|-----|------|
| `ioReverseSolution` | 1 | 反转结果多边形方向 |
| `ioStrictlySimple` | 2 | 确保结果是简单多边形 |
| `ioPreserveCollinear` | 4 | 保留共线顶点 |

**使用示例**：
```csharp
// 默认选项
Clipper c1 = new Clipper();

// 反转结果
Clipper c2 = new Clipper(Clipper.ioReverseSolution);

// 组合多个选项
Clipper c3 = new Clipper(
    Clipper.ioStrictlySimple | 
    Clipper.ioPreserveCollinear
);
```

## 9.5 Execute 方法

Clipper 提供了四个 Execute 重载方法：

### 9.5.1 返回 Paths（简化版）

```csharp
public bool Execute(ClipType clipType, Paths solution, 
    PolyFillType FillType = PolyFillType.pftEvenOdd)
{
    return Execute(clipType, solution, FillType, FillType);
}
```

### 9.5.2 返回 Paths（完整版）

```csharp
public bool Execute(ClipType clipType, Paths solution,
    PolyFillType subjFillType, PolyFillType clipFillType)
{
    if (m_ExecuteLocked) return false;
    if (m_HasOpenPaths) 
        throw new ClipperException(
            "Error: PolyTree struct is needed for open path clipping.");

    m_ExecuteLocked = true;
    solution.Clear();
    m_SubjFillType = subjFillType;
    m_ClipFillType = clipFillType;
    m_ClipType = clipType;
    m_UsingPolyTree = false;
    
    bool succeeded;
    try
    {
        succeeded = ExecuteInternal();
        if (succeeded) BuildResult(solution);
    }
    finally
    {
        DisposeAllPolyPts();
        m_ExecuteLocked = false;
    }
    return succeeded;
}
```

### 9.5.3 返回 PolyTree（简化版）

```csharp
public bool Execute(ClipType clipType, PolyTree polytree,
    PolyFillType FillType = PolyFillType.pftEvenOdd)
{
    return Execute(clipType, polytree, FillType, FillType);
}
```

### 9.5.4 返回 PolyTree（完整版）

```csharp
public bool Execute(ClipType clipType, PolyTree polytree,
    PolyFillType subjFillType, PolyFillType clipFillType)
{
    if (m_ExecuteLocked) return false;
    m_ExecuteLocked = true;
    m_SubjFillType = subjFillType;
    m_ClipFillType = clipFillType;
    m_ClipType = clipType;
    m_UsingPolyTree = true;
    
    bool succeeded;
    try
    {
        succeeded = ExecuteInternal();
        if (succeeded) BuildResult2(polytree);
    }
    finally
    {
        DisposeAllPolyPts();
        m_ExecuteLocked = false;
    }
    return succeeded;
}
```

## 9.6 ExecuteInternal 核心方法

```csharp
private bool ExecuteInternal()
{
    try
    {
        Reset();
        m_SortedEdges = null;
        m_Maxima = null;

        cInt botY, topY;
        if (!PopScanbeam(out botY)) return false;
        
        InsertLocalMinimaIntoAEL(botY);
        
        while (PopScanbeam(out topY) || LocalMinimaPending())
        {
            ProcessHorizontals();
            m_GhostJoins.Clear();
            
            if (!ProcessIntersections(topY)) return false;
            
            ProcessEdgesAtTopOfScanbeam(topY);
            botY = topY;
            InsertLocalMinimaIntoAEL(botY);
        }

        // 修正方向
        foreach (OutRec outRec in m_PolyOuts)
        {
            if (outRec.Pts == null || outRec.IsOpen) continue;
            if ((outRec.IsHole ^ ReverseSolution) == (Area(outRec) > 0))
                ReversePolyPtLinks(outRec.Pts);
        }

        // 处理连接
        JoinCommonEdges();

        // 清理输出
        foreach (OutRec outRec in m_PolyOuts)
        {
            if (outRec.Pts == null) continue;
            else if (outRec.IsOpen)
                FixupOutPolyline(outRec);
            else
                FixupOutPolygon(outRec);
        }

        // 处理严格简单模式
        if (StrictlySimple) DoSimplePolygons();
        
        return true;
    }
    finally 
    {
        m_Joins.Clear();
        m_GhostJoins.Clear();          
    }
}
```

### 9.6.1 执行流程图

```
ExecuteInternal()
       │
       ▼
    Reset()
       │
       ▼
PopScanbeam(botY)
       │
       ▼
InsertLocalMinimaIntoAEL(botY)
       │
       ▼
┌──────────────────────────────┐
│  while (有扫描线或待处理LM)  │
│         │                    │
│         ▼                    │
│  ProcessHorizontals()        │
│         │                    │
│         ▼                    │
│  ProcessIntersections(topY)  │
│         │                    │
│         ▼                    │
│  ProcessEdgesAtTopOfScanbeam │
│         │                    │
│         ▼                    │
│  InsertLocalMinimaIntoAEL    │
│         │                    │
│         └────────────────────┘
       │
       ▼
   方向修正
       │
       ▼
 JoinCommonEdges()
       │
       ▼
   输出清理
       │
       ▼
 DoSimplePolygons() (可选)
       │
       ▼
    返回结果
```

## 9.7 公共属性

### 9.7.1 ReverseSolution

```csharp
public bool ReverseSolution { get; set; }
```

**功能**：反转结果多边形的方向。

**默认行为**：
- 外轮廓：逆时针（正面积）
- 孔洞：顺时针（负面积）

**启用后**：
- 外轮廓：顺时针
- 孔洞：逆时针

### 9.7.2 StrictlySimple

```csharp
public bool StrictlySimple { get; set; }
```

**功能**：确保输出是严格简单的多边形（没有自交点）。

**注意**：启用此选项可能增加处理时间和输出多边形数量。

### 9.7.3 PreserveCollinear

```csharp
public bool PreserveCollinear { get; set; }  // 继承自 ClipperBase
```

**功能**：保留共线顶点。

**默认行为**：移除共线顶点以简化输出。

## 9.8 Z 坐标处理（use_xyz）

```csharp
#if use_xyz
public delegate void ZFillCallback(IntPoint bot1, IntPoint top1, 
    IntPoint bot2, IntPoint top2, ref IntPoint pt);
public ZFillCallback ZFillFunction { get; set; }
#endif
```

**用途**：当两条边相交创建新点时，通过回调函数计算 Z 坐标。

**使用示例**：
```csharp
#if use_xyz
// 插值计算 Z
clipper.ZFillFunction = (bot1, top1, bot2, top2, ref IntPoint pt) =>
{
    // 基于两条边的端点插值计算交点的 Z
    double ratio1 = (double)(pt.Y - bot1.Y) / (top1.Y - bot1.Y);
    double z1 = bot1.Z + ratio1 * (top1.Z - bot1.Z);
    
    double ratio2 = (double)(pt.Y - bot2.Y) / (top2.Y - bot2.Y);
    double z2 = bot2.Z + ratio2 * (top2.Z - bot2.Z);
    
    pt.Z = (cInt)((z1 + z2) / 2);  // 平均值
};
#endif
```

## 9.9 使用示例

### 9.9.1 基本使用

```csharp
// 创建多边形
Path subject = new Path();
subject.Add(new IntPoint(0, 0));
subject.Add(new IntPoint(100, 0));
subject.Add(new IntPoint(100, 100));
subject.Add(new IntPoint(0, 100));

Path clip = new Path();
clip.Add(new IntPoint(50, 50));
clip.Add(new IntPoint(150, 50));
clip.Add(new IntPoint(150, 150));
clip.Add(new IntPoint(50, 150));

// 执行裁剪
Clipper clipper = new Clipper();
clipper.AddPath(subject, PolyType.ptSubject, true);
clipper.AddPath(clip, PolyType.ptClip, true);

Paths solution = new Paths();
bool success = clipper.Execute(ClipType.ctIntersection, solution);
```

### 9.9.2 使用 PolyTree 获取层次结构

```csharp
Clipper clipper = new Clipper();
clipper.AddPaths(subjects, PolyType.ptSubject, true);
clipper.AddPaths(clips, PolyType.ptClip, true);

PolyTree tree = new PolyTree();
clipper.Execute(ClipType.ctUnion, tree);

// 遍历结果
void TraverseTree(PolyNode node, int depth)
{
    for (int i = 0; i < node.ChildCount; i++)
    {
        PolyNode child = node.Childs[i];
        string type = child.IsHole ? "孔洞" : "外轮廓";
        Console.WriteLine($"{new string(' ', depth * 2)}{type}: {child.Contour.Count}点");
        TraverseTree(child, depth + 1);
    }
}

TraverseTree(tree, 0);
```

### 9.9.3 复用 Clipper 实例

```csharp
Clipper clipper = new Clipper();

// 第一次操作
clipper.AddPaths(paths1, PolyType.ptSubject, true);
Paths result1 = new Paths();
clipper.Execute(ClipType.ctUnion, result1);

// 清理并重用
clipper.Clear();
clipper.AddPaths(paths2, PolyType.ptSubject, true);
clipper.AddPaths(paths3, PolyType.ptClip, true);
Paths result2 = new Paths();
clipper.Execute(ClipType.ctDifference, result2);
```

## 9.10 本章小结

本章详细分析了 Clipper 类的结构：

1. **类设计**：
   - 继承自 ClipperBase
   - 通过构造函数参数设置选项
   - 支持多种 Execute 重载

2. **核心成员**：
   - 运算状态（ClipType、FillType等）
   - 数据结构（Maxima、IntersectList、Joins等）
   - 属性选项（ReverseSolution、StrictlySimple等）

3. **Execute 方法**：
   - 支持 Paths 和 PolyTree 两种输出
   - 可指定不同的填充规则
   - 通过 ExecuteInternal 执行核心算法

4. **可选功能**：
   - Z 坐标处理（use_xyz）
   - 严格简单多边形
   - 保留共线顶点

理解 Clipper 类的结构是正确使用该库的基础。

---

[上一章：局部极小值与扫描线](第08章-局部极小值与扫描线) | [返回目录](index) | [下一章：布尔运算执行流程](第10章-布尔运算执行流程)

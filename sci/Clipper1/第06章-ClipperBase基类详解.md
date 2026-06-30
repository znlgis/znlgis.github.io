---
layout: default
title: �?章：ClipperBase 基类详解
---

# �?章：ClipperBase 基类详解

## 6.1 概述

`ClipperBase` �?`Clipper` 类的基类，负责管理多边形数据的存储和预处理。它实现了路径添加、边初始化、局部极小值管理等核心功能，为 Clipper 的裁剪算法提供基础支持�?

## 6.2 类定义与成员变量

```csharp
public class ClipperBase
{    
    // 常量
    internal const double horizontal = -3.4E+38;
    internal const int Skip = -2;
    internal const int Unassigned = -1;
    internal const double tolerance = 1.0E-20;

    // 坐标范围常量
#if use_int32
    public const cInt loRange = 0x7FFF;
    public const cInt hiRange = 0x7FFF;
#else
    public const cInt loRange = 0x3FFFFFFF;
    public const cInt hiRange = 0x3FFFFFFFFFFFFFFFL; 
#endif

    // 成员变量
    internal LocalMinima m_MinimaList;      // 局部极小值链表头
    internal LocalMinima m_CurrentLM;        // 当前处理的局部极小�?
    internal List<List<TEdge>> m_edges = new List<List<TEdge>>();  // 边列�?
    internal Scanbeam m_Scanbeam;            // 扫描线链�?
    internal List<OutRec> m_PolyOuts;        // 输出多边形记�?
    internal TEdge m_ActiveEdges;            // 活动边表�?
    internal bool m_UseFullRange;            // 是否使用高精度模�?
    internal bool m_HasOpenPaths;            // 是否有开放路�?

    // 属�?
    public bool PreserveCollinear { get; set; }
}
```

### 6.2.1 成员变量详解

| 成员 | 类型 | 说明 |
|------|------|------|
| `m_MinimaList` | `LocalMinima` | 局部极小值链表，�?Y 降序排列 |
| `m_CurrentLM` | `LocalMinima` | 当前正在处理的局部极小�?|
| `m_edges` | `List<List<TEdge>>` | 所有添加的路径的边数据 |
| `m_Scanbeam` | `Scanbeam` | 扫描�?Y 坐标链表 |
| `m_PolyOuts` | `List<OutRec>` | 输出多边形记录列�?|
| `m_ActiveEdges` | `TEdge` | 活动边表的头指针 |
| `m_UseFullRange` | `bool` | 是否启用 128 位高精度计算 |
| `m_HasOpenPaths` | `bool` | 是否包含开放路�?|

## 6.3 构造函数与清理

### 6.3.1 构造函�?

```csharp
internal ClipperBase() //constructor (nb: no external instantiation)
{
    m_MinimaList = null;
    m_CurrentLM = null;
    m_UseFullRange = false;
    m_HasOpenPaths = false;
}
```

**设计说明**�?
- 使用 `internal` 修饰符，不允许外部直接实例化
- 只能通过子类 `Clipper` 创建实例

### 6.3.2 Clear 方法

```csharp
public virtual void Clear()
{
    DisposeLocalMinimaList();
    for (int i = 0; i < m_edges.Count; ++i)
    {
        for (int j = 0; j < m_edges[i].Count; ++j) 
            m_edges[i][j] = null;
        m_edges[i].Clear();
    }
    m_edges.Clear();
    m_UseFullRange = false;
    m_HasOpenPaths = false;
}
```

**清理顺序**�?
1. 清理局部极小值链�?
2. 清理所有边数据（显式设�?null 帮助 GC�?
3. 重置状态标�?

### 6.3.3 DisposeLocalMinimaList

```csharp
private void DisposeLocalMinimaList()
{
    while (m_MinimaList != null)
    {
        LocalMinima tmpLm = m_MinimaList.Next;
        m_MinimaList = null;
        m_MinimaList = tmpLm;
    }
    m_CurrentLM = null;
}
```

**作用**：遍历并释放局部极小值链表�?

## 6.4 坐标范围检�?

```csharp
void RangeTest(IntPoint Pt, ref bool useFullRange)
{
    if (useFullRange)
    {
        if (Pt.X > hiRange || Pt.Y > hiRange || 
            -Pt.X > hiRange || -Pt.Y > hiRange) 
            throw new ClipperException("Coordinate outside allowed range");
    }
    else if (Pt.X > loRange || Pt.Y > loRange || 
             -Pt.X > loRange || -Pt.Y > loRange) 
    {
        useFullRange = true;
        RangeTest(Pt, ref useFullRange);  // 递归检查高精度范围
    }
}
```

**逻辑流程**�?
1. 如果已经在高精度模式，检查是否超�?hiRange
2. 如果在低精度模式且坐标超�?loRange�?
   - 切换到高精度模式
   - 重新检查是否超�?hiRange

## 6.5 边初始化

### 6.5.1 InitEdge

```csharp
private void InitEdge(TEdge e, TEdge eNext, TEdge ePrev, IntPoint pt)
{
    e.Next = eNext;
    e.Prev = ePrev;
    e.Curr = pt;
    e.OutIdx = Unassigned;
}
```

**功能**：初始化边的链表指针和当前点�?

### 6.5.2 InitEdge2

```csharp
private void InitEdge2(TEdge e, PolyType polyType)
{
    if (e.Curr.Y >= e.Next.Curr.Y)
    {
        e.Bot = e.Curr;
        e.Top = e.Next.Curr;
    }
    else
    {
        e.Top = e.Curr;
        e.Bot = e.Next.Curr;
    }
    SetDx(e);
    e.PolyTyp = polyType;
}
```

**功能**�?
1. 确定边的 Bot（底部）�?Top（顶部）
2. 计算斜率
3. 设置多边形类�?

### 6.5.3 SetDx

```csharp
private void SetDx(TEdge e)
{
    e.Delta.X = (e.Top.X - e.Bot.X);
    e.Delta.Y = (e.Top.Y - e.Bot.Y);
    if (e.Delta.Y == 0) 
        e.Dx = horizontal;
    else 
        e.Dx = (double)(e.Delta.X) / (e.Delta.Y);
}
```

**斜率定义**�?
- `Dx = ΔX / ΔY`
- 水平边：`Dx = horizontal`（特殊标记值）

**为什么使�?ΔX/ΔY 而非 ΔY/ΔX**�?
- 扫描线是水平的，从下向上扫描
- 需要知�?Y 增加 1 �?X 变化多少
- 这样在更新边的当�?X 坐标时更直接

## 6.6 AddPath 方法

这是 ClipperBase 最重要的方法，负责将路径转换为内部边数据结构：

```csharp
public bool AddPath(Path pg, PolyType polyType, bool Closed)
{
#if use_lines
    if (!Closed && polyType == PolyType.ptClip)
        throw new ClipperException("AddPath: Open paths must be subject.");
#else
    if (!Closed)
        throw new ClipperException("AddPath: Open paths have been disabled.");
#endif

    int highI = (int)pg.Count - 1;
    
    // 移除重复的尾部点
    if (Closed) while (highI > 0 && (pg[highI] == pg[0])) --highI;
    while (highI > 0 && (pg[highI] == pg[highI - 1])) --highI;
    if ((Closed && highI < 2) || (!Closed && highI < 1)) return false;

    // 创建边数�?
    List<TEdge> edges = new List<TEdge>(highI + 1);
    for (int i = 0; i <= highI; i++) edges.Add(new TEdge());
        
    bool IsFlat = true;

    // 阶段1：基础边初始化
    edges[1].Curr = pg[1];
    RangeTest(pg[0], ref m_UseFullRange);
    RangeTest(pg[highI], ref m_UseFullRange);
    InitEdge(edges[0], edges[1], edges[highI], pg[0]);
    InitEdge(edges[highI], edges[0], edges[highI - 1], pg[highI]);
    for (int i = highI - 1; i >= 1; --i)
    {
        RangeTest(pg[i], ref m_UseFullRange);
        InitEdge(edges[i], edges[i + 1], edges[i - 1], pg[i]);
    }
    TEdge eStart = edges[0];

    // 阶段2：移除重复顶点和共线�?
    TEdge E = eStart, eLoopStop = eStart;
    for (;;)
    {
        if (E.Curr == E.Next.Curr && (Closed || E.Next != eStart))
        {
            // 移除重复�?
            if (E == E.Next) break;
            if (E == eStart) eStart = E.Next;
            E = RemoveEdge(E);
            eLoopStop = E;
            continue;
        }
        if (E.Prev == E.Next) break;  // 只剩两个顶点
        else if (Closed &&
            SlopesEqual(E.Prev.Curr, E.Curr, E.Next.Curr, m_UseFullRange) && 
            (!PreserveCollinear || !Pt2IsBetweenPt1AndPt3(E.Prev.Curr, E.Curr, E.Next.Curr))) 
        {
            // 移除共线中间�?
            if (E == eStart) eStart = E.Next;
            E = RemoveEdge(E);
            E = E.Prev;
            eLoopStop = E;
            continue;
        }
        E = E.Next;
        if ((E == eLoopStop) || (!Closed && E.Next == eStart)) break;
    }

    // 检查结果是否有�?
    if ((!Closed && (E == E.Next)) || (Closed && (E.Prev == E.Next)))
        return false;

    if (!Closed)
    {
        m_HasOpenPaths = true;
        eStart.Prev.OutIdx = Skip;  // 标记开放路径的最后一条边
    }

    // 阶段3：二次边初始�?
    E = eStart;
    do
    {
        InitEdge2(E, polyType);
        E = E.Next;
        if (IsFlat && E.Curr.Y != eStart.Curr.Y) IsFlat = false;
    }
    while (E != eStart);

    // 阶段4：添加局部极小�?
    // ... (见后续分�?
    
    return true;
}
```

### 6.6.1 处理流程�?

```
输入路径
    �?
检查开放路径限�?
    �?
移除重复尾部�?
    �?
创建边数�?
    �?
阶段1：基础初始化（链表指针、当前点�?
    �?
阶段2：清理无效数据（重复点、共线边�?
    �?
阶段3：计算方向（Bot/Top、Dx�?
    �?
阶段4：识别并记录局部极小�?
    �?
添加到边列表
```

### 6.6.2 RemoveEdge

```csharp
TEdge RemoveEdge(TEdge e)
{
    e.Prev.Next = e.Next;
    e.Next.Prev = e.Prev;
    TEdge result = e.Next;
    e.Prev = null;  // 标记为已删除
    return result;
}
```

**功能**：从双向链表中移除一条边，返回下一条边�?

## 6.7 斜率比较

### 6.7.1 SlopesEqual（两条边�?

```csharp
internal static bool SlopesEqual(TEdge e1, TEdge e2, bool UseFullRange)
{
    if (UseFullRange)
        return Int128.Int128Mul(e1.Delta.Y, e2.Delta.X) ==
               Int128.Int128Mul(e1.Delta.X, e2.Delta.Y);
    else 
        return (cInt)(e1.Delta.Y) * (e2.Delta.X) ==
               (cInt)(e1.Delta.X) * (e2.Delta.Y);
}
```

**数学原理**�?
两条边斜率相�?�?`Δy1/Δx1 = Δy2/Δx2` �?`Δy1 * Δx2 = Δx1 * Δy2`

使用乘法交叉比较避免除法，同时避免除以零的问题�?

### 6.7.2 SlopesEqual（三个点�?

```csharp
internal static bool SlopesEqual(IntPoint pt1, IntPoint pt2,
    IntPoint pt3, bool UseFullRange)
{
    if (UseFullRange)
        return Int128.Int128Mul(pt1.Y - pt2.Y, pt2.X - pt3.X) ==
               Int128.Int128Mul(pt1.X - pt2.X, pt2.Y - pt3.Y);
    else 
        return (cInt)(pt1.Y - pt2.Y) * (pt2.X - pt3.X) - 
               (cInt)(pt1.X - pt2.X) * (pt2.Y - pt3.Y) == 0;
}
```

**用�?*：判断三点是否共线�?

## 6.8 局部极小值管�?

### 6.8.1 LocalMinima 结构

```csharp
internal class LocalMinima
{
    internal cInt Y;              // 极小值的 Y 坐标
    internal TEdge LeftBound;     // 左边界边
    internal TEdge RightBound;    // 右边界边
    internal LocalMinima Next;    // 下一个极小值（链表�?
}
```

### 6.8.2 InsertLocalMinima

```csharp
private void InsertLocalMinima(LocalMinima newLm)
{
    if (m_MinimaList == null)
    {
        m_MinimaList = newLm;
    }
    else if (newLm.Y >= m_MinimaList.Y)
    {
        // 插入到链表头�?
        newLm.Next = m_MinimaList;
        m_MinimaList = newLm;
    } 
    else
    {
        // 在链表中找到正确位置
        LocalMinima tmpLm = m_MinimaList;
        while (tmpLm.Next != null && (newLm.Y < tmpLm.Next.Y))
            tmpLm = tmpLm.Next;
        newLm.Next = tmpLm.Next;
        tmpLm.Next = newLm;
    }
}
```

**排序规则**：按 Y 坐标降序排列（最�?Y 值在前）�?

这样在扫描时，从最低的 Y（底部）开始向上扫描，可以按顺序处理局部极小值�?

### 6.8.3 PopLocalMinima

```csharp
internal Boolean PopLocalMinima(cInt Y, out LocalMinima current)
{
    current = m_CurrentLM;
    if (m_CurrentLM != null && m_CurrentLM.Y == Y)
    {
        m_CurrentLM = m_CurrentLM.Next;
        return true;
    }
    return false;
}
```

**功能**：如果当前局部极小值的 Y 坐标等于给定值，弹出并返回�?

## 6.9 扫描线管�?

### 6.9.1 Scanbeam 结构

```csharp
internal class Scanbeam
{
    internal cInt Y;          // Y 坐标
    internal Scanbeam Next;   // 下一个扫描线
}
```

### 6.9.2 InsertScanbeam

```csharp
internal void InsertScanbeam(cInt Y)
{
    // 单链表：降序排列，忽略重�?
    if (m_Scanbeam == null)
    {
        m_Scanbeam = new Scanbeam();
        m_Scanbeam.Next = null;
        m_Scanbeam.Y = Y;
    }
    else if (Y > m_Scanbeam.Y)
    {
        Scanbeam newSb = new Scanbeam();
        newSb.Y = Y;
        newSb.Next = m_Scanbeam;
        m_Scanbeam = newSb;
    }
    else
    {
        Scanbeam sb2 = m_Scanbeam;
        while (sb2.Next != null && (Y <= sb2.Next.Y)) 
            sb2 = sb2.Next;
        if (Y == sb2.Y) return;  // 忽略重复
        Scanbeam newSb = new Scanbeam();
        newSb.Y = Y;
        newSb.Next = sb2.Next;
        sb2.Next = newSb;
    }
}
```

### 6.9.3 PopScanbeam

```csharp
internal Boolean PopScanbeam(out cInt Y)
{
    if (m_Scanbeam == null)
    {
        Y = 0;
        return false;
    }
    Y = m_Scanbeam.Y;
    m_Scanbeam = m_Scanbeam.Next;
    return true;
}
```

## 6.10 输出多边形管�?

### 6.10.1 OutRec 结构

```csharp
internal class OutRec
{
    internal int Idx;              // 索引
    internal bool IsHole;          // 是否为孔�?
    internal bool IsOpen;          // 是否为开放路�?
    internal OutRec FirstLeft;     // 父轮廓（用于孔洞�?
    internal OutPt Pts;            // 点链表头
    internal OutPt BottomPt;       // 最底部的点
    internal PolyNode PolyNode;    // 对应�?PolyNode
}
```

### 6.10.2 CreateOutRec

```csharp
internal OutRec CreateOutRec()
{
    OutRec result = new OutRec();
    result.Idx = Unassigned;
    result.IsHole = false;
    result.IsOpen = false;
    result.FirstLeft = null;
    result.Pts = null;
    result.BottomPt = null;
    result.PolyNode = null;
    m_PolyOuts.Add(result);
    result.Idx = m_PolyOuts.Count - 1;
    return result;
}
```

### 6.10.3 DisposeOutRec

```csharp
internal void DisposeOutRec(int index)
{
    OutRec outRec = m_PolyOuts[index];
    outRec.Pts = null;
    outRec = null;
    m_PolyOuts[index] = null;
}
```

## 6.11 边界框计�?

```csharp
public static IntRect GetBounds(Paths paths)
{
    int i = 0, cnt = paths.Count;
    while (i < cnt && paths[i].Count == 0) i++;
    if (i == cnt) return new IntRect(0, 0, 0, 0);
    
    IntRect result = new IntRect();
    result.left = paths[i][0].X;
    result.right = result.left;
    result.top = paths[i][0].Y;
    result.bottom = result.top;
    
    for (; i < cnt; i++)
        for (int j = 0; j < paths[i].Count; j++)
        {
            if (paths[i][j].X < result.left) 
                result.left = paths[i][j].X;
            else if (paths[i][j].X > result.right) 
                result.right = paths[i][j].X;
            if (paths[i][j].Y < result.top) 
                result.top = paths[i][j].Y;
            else if (paths[i][j].Y > result.bottom) 
                result.bottom = paths[i][j].Y;
        }
    return result;
}
```

## 6.12 Reset 方法

```csharp
internal virtual void Reset()
{
    m_CurrentLM = m_MinimaList;
    if (m_CurrentLM == null) return;

    // 重置所有边
    m_Scanbeam = null;
    LocalMinima lm = m_MinimaList;
    while (lm != null)
    {
        InsertScanbeam(lm.Y);
        TEdge e = lm.LeftBound;
        if (e != null)
        {
            e.Curr = e.Bot;
            e.OutIdx = Unassigned;
        }
        e = lm.RightBound;
        if (e != null)
        {
            e.Curr = e.Bot;
            e.OutIdx = Unassigned;
        }
        lm = lm.Next;
    }
    m_ActiveEdges = null;
}
```

**功能**：重置所有状态，准备执行新的裁剪操作�?

## 6.13 本章小结

ClipperBase �?Clipper 的基础架构类：

1. **数据存储**：管理边、局部极小值、扫描线等核心数�?

2. **路径处理**：AddPath 将用户输入转换为内部数据结构

3. **几何计算**：提供斜率比较、范围检查等基础功能

4. **生命周期管理**：Clear �?Reset 方法管理对象状�?

5. **精度控制**：自动检测并切换到高精度模式

理解 ClipperBase 的实现对于深入理�?Clipper 的工作原理至关重要�?

---

[上一章：Int128高精度运算](�?5�?Int128高精度运�? | [返回目录](../index) | [下一章：TEdge边缘结构](�?7�?TEdge边缘结构)

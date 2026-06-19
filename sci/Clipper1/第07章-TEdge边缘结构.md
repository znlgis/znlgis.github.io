---
layout: default
title: 第7章：边缘数据结构 TEdge 深入分析
---

# 第7章：边缘数据结构 TEdge 深入分析

## 7.1 概述

`TEdge` 是 Clipper1 中最核心的内部数据结构，代表多边形的一条边。Vatti 裁剪算法的所有操作都围绕边展开：边的插入、删除、交点计算、输出构建等。深入理解 TEdge 的设计对于理解 Clipper 算法至关重要。

## 7.2 TEdge 类定义

```csharp
internal class TEdge 
{
    internal IntPoint Bot;        // 底部端点
    internal IntPoint Curr;       // 当前点（随扫描线更新）
    internal IntPoint Top;        // 顶部端点
    internal IntPoint Delta;      // 增量 (Top - Bot)
    internal double Dx;           // 斜率 (Delta.X / Delta.Y)
    internal PolyType PolyTyp;    // 多边形类型
    internal EdgeSide Side;       // 当前在输出多边形的哪一侧
    internal int WindDelta;       // 缠绕数变化量
    internal int WindCnt;         // 缠绕计数
    internal int WindCnt2;        // 对方多边形类型的缠绕计数
    internal int OutIdx;          // 输出多边形索引
    internal TEdge Next;          // 下一条边（多边形顺序）
    internal TEdge Prev;          // 上一条边（多边形顺序）
    internal TEdge NextInLML;     // LML 中的下一条边
    internal TEdge NextInAEL;     // AEL 中的下一条边
    internal TEdge PrevInAEL;     // AEL 中的上一条边
    internal TEdge NextInSEL;     // SEL 中的下一条边
    internal TEdge PrevInSEL;     // SEL 中的上一条边
}
```

## 7.3 坐标相关字段

### 7.3.1 Bot、Top、Curr

```
      Top (X_top, Y_top)
         ●
        /
       /
      /   ← Curr (当前扫描线位置)
     /
    /
   ●
Bot (X_bot, Y_bot)

约定：Bot.Y >= Top.Y（Clipper Y轴向上）
```

**字段说明**：

| 字段 | 说明 |
|------|------|
| Bot | 边的底部端点（Y 值较大） |
| Top | 边的顶部端点（Y 值较小） |
| Curr | 当前扫描线与边的交点，随扫描进行更新 |

### 7.3.2 Delta 和 Dx

```csharp
Delta.X = Top.X - Bot.X;
Delta.Y = Top.Y - Bot.Y;  // 总是 <= 0（因为 Bot.Y >= Top.Y）
Dx = Delta.X / Delta.Y;    // 水平边时设为 horizontal 常量
```

**Dx 的物理意义**：
- 表示 Y 坐标每减少 1 时，X 坐标变化量
- 用于计算扫描线与边的交点

### 7.3.3 Curr 的更新

在处理每个扫描线时，需要更新边的当前 X 坐标：

```csharp
// 在 TopX 方法中计算
private static cInt TopX(TEdge edge, cInt currentY)
{
    if (currentY == edge.Top.Y)
        return edge.Top.X;
    return edge.Bot.X + Round(edge.Dx * (currentY - edge.Bot.Y));
}

// 在 ProcessEdgesAtTopOfScanbeam 中更新
e.Curr.X = TopX(e, topY);
e.Curr.Y = topY;
```

## 7.4 多边形类型与方向

### 7.4.1 PolyTyp

```csharp
internal PolyType PolyTyp;  // ptSubject 或 ptClip
```

标识边属于主体多边形还是裁剪多边形。

### 7.4.2 Side

```csharp
internal EdgeSide Side;  // esLeft 或 esRight
```

标识边当前位于输出多边形的左侧还是右侧。

```
输出多边形示意：
        Top
        /\
       /  \
 Left /    \ Right
     /      \
    /________\
       Bot
       
esLeft: 边在输出多边形的左侧
esRight: 边在输出多边形的右侧
```

### 7.4.3 WindDelta

```csharp
internal int WindDelta;  // 1, -1, 或 0
```

**含义**：从下往上穿过这条边时，缠绕数的变化量。

| 值 | 说明 |
|----|------|
| 1 | 向上穿过时缠绕数 +1 |
| -1 | 向上穿过时缠绕数 -1 |
| 0 | 开放路径的边 |

### 7.4.4 WindCnt 和 WindCnt2

```csharp
internal int WindCnt;   // 同类型多边形的缠绕计数
internal int WindCnt2;  // 不同类型多边形的缠绕计数
```

**缠绕计数的作用**：
- 确定点是否在多边形内部
- 实现不同的填充规则

## 7.5 链表指针

TEdge 参与多个链表，每个链表有不同的用途：

### 7.5.1 多边形链表（Next/Prev）

```csharp
internal TEdge Next;  // 多边形中的下一条边
internal TEdge Prev;  // 多边形中的上一条边
```

形成闭合的双向循环链表，表示原始多边形的边：

```
   e0 ←→ e1 ←→ e2 ←→ e3 ←→ e0
   (循环链表)
```

### 7.5.2 LML 链表（NextInLML）

```csharp
internal TEdge NextInLML;  // Local Minima List 中的后续边
```

**LML（Local Minima List）**：从局部极小值点延伸的边序列。

```
                 ●──────●
                / NextInLML
               /
              ●  ← 局部极小值
             /
NextInLML   /
           /
          ●
```

### 7.5.3 AEL 链表（NextInAEL/PrevInAEL）

```csharp
internal TEdge NextInAEL;  // 活动边表中的下一条边
internal TEdge PrevInAEL;  // 活动边表中的上一条边
```

**AEL（Active Edge List）**：当前扫描线穿过的所有边，按 X 坐标排序。

```
扫描线: ─────────────────────────────────
           │    │       │      │
          e1   e2      e3     e4
           
AEL: e1 ←→ e2 ←→ e3 ←→ e4
```

### 7.5.4 SEL 链表（NextInSEL/PrevInSEL）

```csharp
internal TEdge NextInSEL;  // 排序边表中的下一条边
internal TEdge PrevInSEL;  // 排序边表中的上一条边
```

**SEL（Sorted Edge List）**：用于水平边处理和交点排序。

### 7.5.5 OutIdx

```csharp
internal int OutIdx;  // 输出多边形记录的索引
```

| 值 | 含义 |
|----|------|
| Unassigned (-1) | 边尚未与输出多边形关联 |
| Skip (-2) | 边应被跳过（开放路径的终点边） |
| >= 0 | 关联的 OutRec 索引 |

## 7.6 边的生命周期

### 7.6.1 创建阶段（AddPath）

```csharp
// 1. 创建边对象
List<TEdge> edges = new List<TEdge>(highI + 1);
for (int i = 0; i <= highI; i++) edges.Add(new TEdge());

// 2. 初始化多边形链表
InitEdge(edges[0], edges[1], edges[highI], pg[0]);

// 3. 设置方向和斜率
InitEdge2(E, polyType);
```

### 7.6.2 进入 AEL

当扫描线到达边的底部（局部极小值）时，边被插入 AEL：

```csharp
private void InsertEdgeIntoAEL(TEdge edge, TEdge startEdge)
{
    if (m_ActiveEdges == null)
    {
        edge.PrevInAEL = null;
        edge.NextInAEL = null;
        m_ActiveEdges = edge;
    }
    else if (startEdge == null && E2InsertsBeforeE1(m_ActiveEdges, edge))
    {
        // 插入到 AEL 头部
        edge.PrevInAEL = null;
        edge.NextInAEL = m_ActiveEdges;
        m_ActiveEdges.PrevInAEL = edge;
        m_ActiveEdges = edge;
    }
    else
    {
        // 找到正确位置插入
        if (startEdge == null) startEdge = m_ActiveEdges;
        while (startEdge.NextInAEL != null &&
               !E2InsertsBeforeE1(startEdge.NextInAEL, edge))
            startEdge = startEdge.NextInAEL;
        edge.NextInAEL = startEdge.NextInAEL;
        if (startEdge.NextInAEL != null) 
            startEdge.NextInAEL.PrevInAEL = edge;
        edge.PrevInAEL = startEdge;
        startEdge.NextInAEL = edge;
    }
}
```

### 7.6.3 在 AEL 中更新

```csharp
// 交换两条边的位置
internal void SwapPositionsInAEL(TEdge edge1, TEdge edge2)
{
    // 复杂的链表指针操作...
}

// 从 AEL 删除
internal void DeleteFromAEL(TEdge e)
{
    TEdge AelPrev = e.PrevInAEL;
    TEdge AelNext = e.NextInAEL;
    if (AelPrev == null && AelNext == null && (e != m_ActiveEdges))
        return; // 已删除
    if (AelPrev != null)
        AelPrev.NextInAEL = AelNext;
    else 
        m_ActiveEdges = AelNext;
    if (AelNext != null)
        AelNext.PrevInAEL = AelPrev;
    e.NextInAEL = null;
    e.PrevInAEL = null;
}
```

### 7.6.4 边的延续（UpdateEdgeIntoAEL）

当边到达中间转折点时，更新为下一段：

```csharp
internal void UpdateEdgeIntoAEL(ref TEdge e)
{
    if (e.NextInLML == null)
        throw new ClipperException("UpdateEdgeIntoAEL: invalid call");
    
    TEdge AelPrev = e.PrevInAEL;
    TEdge AelNext = e.NextInAEL;
    e.NextInLML.OutIdx = e.OutIdx;
    
    // 更新 AEL 指针
    if (AelPrev != null)
        AelPrev.NextInAEL = e.NextInLML;
    else 
        m_ActiveEdges = e.NextInLML;
    if (AelNext != null)
        AelNext.PrevInAEL = e.NextInLML;
    
    e.NextInLML.Side = e.Side;
    e.NextInLML.WindDelta = e.WindDelta;
    e.NextInLML.WindCnt = e.WindCnt;
    e.NextInLML.WindCnt2 = e.WindCnt2;
    e = e.NextInLML;
    e.Curr = e.Bot;
    e.PrevInAEL = AelPrev;
    e.NextInAEL = AelNext;
    
    if (!IsHorizontal(e)) InsertScanbeam(e.Top.Y);
}
```

### 7.6.5 离开 AEL

当扫描线到达边的顶部（局部极大值）时：

```csharp
// 在 DoMaxima 中
DeleteFromAEL(e);
DeleteFromAEL(eMaxPair);
```

## 7.7 边的排序

### 7.7.1 E2InsertsBeforeE1

```csharp
private bool E2InsertsBeforeE1(TEdge e1, TEdge e2)
{
    if (e2.Curr.X == e1.Curr.X)
    {
        if (e2.Top.Y > e1.Top.Y)
            return e2.Top.X < TopX(e1, e2.Top.Y);
        else 
            return e1.Top.X > TopX(e2, e1.Top.Y);
    }
    else 
        return e2.Curr.X < e1.Curr.X;
}
```

**排序规则**：
1. 首先按当前 X 坐标排序
2. X 相同时，按斜率方向排序（确保正确的左右关系）

### 7.7.2 IsHorizontal

```csharp
internal static bool IsHorizontal(TEdge e)
{
    return e.Delta.Y == 0;
}
```

水平边需要特殊处理，因为它们与扫描线平行。

## 7.8 边对的查找

### 7.8.1 GetMaximaPair

找到在同一个局部极大值点的配对边：

```csharp
internal TEdge GetMaximaPair(TEdge e)
{
    if ((e.Next.Top == e.Top) && e.Next.NextInLML == null)
        return e.Next;
    else if ((e.Prev.Top == e.Top) && e.Prev.NextInLML == null)
        return e.Prev;
    else 
        return null;
}
```

### 7.8.2 GetMaximaPairEx

```csharp
internal TEdge GetMaximaPairEx(TEdge e)
{
    TEdge result = GetMaximaPair(e);
    if (result == null || result.OutIdx == Skip ||
        ((result.NextInAEL == result.PrevInAEL) && !IsHorizontal(result))) 
        return null;
    return result;
}
```

额外检查确保配对边仍在 AEL 中。

## 7.9 边的可视化

```
多边形：
        ●(100, 200)──────●(300, 200)
       /                  \
      /                    \
     /                      \
    ●(0, 100)              ●(400, 100)
     \                      /
      \                    /
       \                  /
        ●(100, 0)────────●(300, 0)

边分解：
e0: (100,0) → (0,100)   Bot=(100,0), Top=(0,100)
e1: (0,100) → (100,200) Bot=(0,100), Top=(100,200)
e2: (100,200) → (300,200) 水平边
e3: (300,200) → (400,100) Bot=(400,100), Top=(300,200)
e4: (400,100) → (300,0)  Bot=(300,0), Top=(400,100)
e5: (300,0) → (100,0)    水平边

扫描过程：
Y=0:   AEL = [e0, e5, e4]
Y=100: AEL = [e1, e3]
Y=200: 处理完成
```

## 7.10 本章小结

TEdge 是 Clipper 算法的核心数据结构：

1. **几何信息**：Bot、Top、Curr、Delta、Dx 描述边的位置和方向

2. **多边形属性**：PolyTyp、Side、WindDelta、WindCnt 用于布尔运算

3. **链表关系**：
   - Next/Prev：原始多边形结构
   - NextInLML：局部极小值延伸
   - NextInAEL/PrevInAEL：活动边表
   - NextInSEL/PrevInSEL：排序边表

4. **生命周期**：从创建、插入 AEL、更新、到删除的完整过程

理解 TEdge 的设计是理解 Clipper 算法的关键。

---

[上一章：ClipperBase基类详解](第06章-ClipperBase基类详解) | [返回目录](index) | [下一章：局部极小值与扫描线](第08章-局部极小值与扫描线)

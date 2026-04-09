---
layout: default
title: "第10章：Clipper 类源码解读（二）— Vatti 算法核心流程"
---

# 第10章：Clipper 类源码解读（二）— Vatti 算法核心流程

## 10.1 引言

上一章（第9章）我们详细剖析了 `Clipper` 类的整体结构、执行入口 `Execute()` / `ExecuteInternal()`、输出构建方法 `BuildResult()` / `BuildResult2()`，以及各种辅助工具方法。我们了解到 `ExecuteInternal()` 是整个布尔运算的主循环——它驱动扫描线从底部向顶部扫过所有事件点，在每个扫描束高度依次调用：

1. **`InsertLocalMinimaIntoAEL(botY)`** — 将当前扫描线高度的局部最小值插入活动边表
2. **`ProcessHorizontals()`** — 处理水平边
3. **`ProcessIntersections(topY)`** — 处理边的交叉
4. **`ProcessEdgesAtTopOfScanbeam(topY)`** — 处理到达扫描束顶部的边

本章是 Clipper 源码解读中**最核心、最关键**的一章。我们将深入到 Vatti 裁剪算法的实际实现细节中，逐行解读上述每一个关键方法，以及它们调用的所有子方法。

### 本章涵盖的核心方法一览

| 编号 | 方法名 | 功能 | 重要程度 |
|:---:|:---|:---|:---:|
| 1 | `InsertLocalMinimaIntoAEL()` | 局部最小值插入活动边表 | ★★★★★ |
| 2 | `InsertEdgeIntoAEL()` | 将边按 X 坐标有序插入 AEL | ★★★★ |
| 3 | `E2InsertsBeforeE1()` | AEL 排序比较函数 | ★★★ |
| 4 | `SetWindingCount()` | 计算边的缠绕数 | ★★★★★ |
| 5 | `IsContributing()` | 判断边是否贡献输出 | ★★★★★ |
| 6 | `IsEvenOddFillType()` | 判断奇偶填充类型 | ★★★ |
| 7 | `IsEvenOddAltFillType()` | 判断对侧奇偶填充类型 | ★★★ |
| 8 | `AddLocalMinPoly()` | 在局部最小值处创建输出多边形 | ★★★★★ |
| 9 | `AddLocalMaxPoly()` | 在局部最大值处关闭输出多边形 | ★★★★★ |
| 10 | `AddOutPt()` | 向输出多边形添加顶点 | ★★★★ |
| 11 | `ProcessEdgesAtTopOfScanbeam()` | 处理扫描束顶部的边事件 | ★★★★★ |
| 12 | `DoMaxima()` | 处理局部最大值 | ★★★★ |
| 13 | `IsMinima()` / `IsMaxima()` / `IsIntermediate()` | 边状态分类 | ★★★ |
| 14 | `GetMaximaPair()` / `GetMaximaPairEx()` | 查找最大值配对边 | ★★★ |

---

## 10.2 Vatti 算法概述

### 10.2.1 扫描线算法的核心思想

Vatti 算法（由 Bala R. Vatti 于 1992 年提出）是一种基于**扫描线（Scanline）**的多边形裁剪算法。其核心思想是：

> 一条水平扫描线从坐标平面的底部（最小 Y 值）向顶部（最大 Y 值）扫过，在扫描过程中维护一个**活动边表（Active Edge List, AEL）**，记录当前与扫描线相交的所有边。当扫描线到达特定事件点（局部最小值、局部最大值、中间顶点、边交叉点）时，算法更新 AEL 并根据缠绕数规则决定是否输出多边形边界。

**注意**：在 Clipper 的坐标系中，Y 轴**向上**为正方向。扫描线从**小 Y（底部）向大 Y（顶部）**移动。每条边的 `Bot`（底部端点）Y 值小于 `Top`（顶部端点）Y 值。

### 10.2.2 扫描线扫描过程 ASCII 图

以下 ASCII 图展示了一个简单的多边形裁剪场景中扫描线的工作方式：

```
  Y
  ^
  |
  |  扫描线 4 (topY=90) ─────────────────── 处理最大值，关闭多边形
  |       ╱╲          ╱╲
  |      ╱  ╲        ╱  ╲
  |  扫描线 3 (topY=70) ─────────────── 处理中间顶点/交叉
  |    ╱    ╲╳╱    ╲
  |   ╱     ╱╲╲     ╲
  |  扫描线 2 (topY=50) ─────────────── 处理交叉，更新AEL顺序
  |  ╱    ╱    ╲╲    ╲
  | ╱   ╱        ╲╲   ╲
  |  扫描线 1 (botY=20) ─────────────── 插入局部最小值到AEL
  | ╲ ╱            ╲╲╱
  |  V               V
  |  局部最小值1      局部最小值2
  +──────────────────────────────→ X
```

### 10.2.3 核心数据结构关系

```
  ┌──────────────┐
  │  Scanbeam    │    扫描束优先队列：存储所有需要处理的 Y 值
  │  (Y值队列)    │
  └──────┬───────┘
         │ 每个Y值触发
         ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ LocalMinima  │────→│ LocalMinima  │────→│ LocalMinima  │
  │ (局部最小值)  │     │ (局部最小值)  │     │ (局部最小值)  │
  │ Y, LB, RB   │     │ Y, LB, RB   │     │ Y, LB, RB   │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                    │
         ▼                    ▼
  ┌──────────────────────────────────────────────────┐
  │              Active Edge List (AEL)               │
  │  双向链表，按 X 坐标从左到右排序                     │
  │                                                    │
  │  edge1 ←→ edge2 ←→ edge3 ←→ edge4 ←→ ...        │
  │  (X小)                              (X大)          │
  └──────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────┐
  │           Output Polygon List (m_PolyOuts)        │
  │  每个 OutRec 包含一个环形双向链表的 OutPt           │
  │                                                    │
  │  OutPt1 → OutPt2 → OutPt3 → OutPt1 (环形)        │
  └──────────────────────────────────────────────────┘
```

### 10.2.4 算法主循环回顾

在第9章中我们已经看到 `ExecuteInternal()` 的主循环：

```
while (有下一个扫描束Y值) {
    botY = 当前扫描束底部Y;
    topY = 弹出下一个扫描束Y;

    1. InsertLocalMinimaIntoAEL(botY);   // 插入局部最小值
    2. ProcessHorizontals();              // 处理水平边
    3. ProcessIntersections(topY);        // 处理交叉
    4. ProcessEdgesAtTopOfScanbeam(topY); // 处理扫描束顶部事件
}
```

本章将深入解读步骤 1 和步骤 4，以及它们调用的所有子方法。

---

## 10.3 边状态分类方法

在进入核心方法之前，我们需要理解三个简单但极其重要的边状态分类方法。它们决定了扫描线到达某个 Y 坐标时，每条边处于何种状态。

### 10.3.1 IsMinima — 判断是否为局部最小值

```csharp
private bool IsMinima(TEdge e)
{
    return e != null && (e.Prev.NextInLML != e) && (e.Next.NextInLML != e);
}
```

**逐行解读**：

| 行 | 代码 | 说明 |
|:---:|:---|:---|
| 1 | `e != null` | 空指针保护 |
| 2 | `e.Prev.NextInLML != e` | 前驱边的"LML中下一条边"不是当前边 |
| 3 | `e.Next.NextInLML != e` | 后继边的"LML中下一条边"不是当前边 |

**含义**：一条边是局部最小值的底部边，当且仅当它不是任何其他边通过 `NextInLML` 链接过来的"延续边"。

```
  局部最小值示意图：

      ╱      ╲         ← e.Prev 和 e.Next 的 NextInLML
     ╱        ╲           都不指向 e
    ╱          ╲
   ╱            ╲
  V──────────────V      ← 这是局部最小值点
  e.Prev    e    e.Next
  (左bound)      (右bound)
```

### 10.3.2 IsMaxima — 判断是否为局部最大值

```csharp
private bool IsMaxima(TEdge e, double Y)
{
    return (e != null && e.Top.Y == Y && e.NextInLML == null);
}
```

**逐行解读**：

| 行 | 代码 | 说明 |
|:---:|:---|:---|
| 1 | `e != null` | 空指针保护 |
| 2 | `e.Top.Y == Y` | 边的顶部端点 Y 坐标等于当前扫描线 Y |
| 3 | `e.NextInLML == null` | 没有后续延续边（边到此结束） |

**含义**：当一条边到达其顶部端点，且没有后续边延续（`NextInLML == null`），说明这是一个局部最大值——多边形在此处"收口"。

```
  局部最大值示意图：

  ∧──────────────∧      ← 局部最大值点 (Top.Y == Y, NextInLML == null)
   ╲            ╱
    ╲          ╱
     ╲        ╱
      ╲      ╱
```

### 10.3.3 IsIntermediate — 判断是否为中间顶点

```csharp
private bool IsIntermediate(TEdge e, double Y)
{
    return (e.Top.Y == Y && e.NextInLML != null);
}
```

**逐行解读**：

| 行 | 代码 | 说明 |
|:---:|:---|:---|
| 1 | `e.Top.Y == Y` | 边的顶部端点 Y 坐标等于当前扫描线 Y |
| 2 | `e.NextInLML != null` | 有后续延续边（边并未结束） |

**含义**：边到达了一个**拐点**——当前线段结束，但多边形轮廓在此处转折为另一条边继续向上延伸。

```
  中间顶点示意图：

            ╱       ← NextInLML 指向的延续边
           ╱
          ╱
  ───────●          ← 中间顶点 (Top.Y == Y, NextInLML != null)
        ╱
       ╱
      ╱             ← 当前边
```

### 10.3.4 三种状态的对比总结

```
  ┌────────────────┬──────────────┬────────────────┬───────────────────┐
  │     状态        │  Top.Y == Y  │  NextInLML     │  含义             │
  ├────────────────┼──────────────┼────────────────┼───────────────────┤
  │  IsMinima      │     N/A      │  不被引用       │  多边形从此处展开  │
  │  IsMaxima      │     是       │  == null        │  多边形在此处收口  │
  │  IsIntermediate│     是       │  != null        │  边在此处转折延续  │
  └────────────────┴──────────────┴────────────────┴───────────────────┘
```

---

## 10.4 GetMaximaPair 与 GetMaximaPairEx — 查找最大值配对边

### 10.4.1 GetMaximaPair

在处理局部最大值时，我们需要找到"对面那条边"——即与当前边在同一个局部最大值点会合的另一条边。

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

**逐行解读**：

| 行 | 代码 | 说明 |
|:---:|:---|:---|
| 1 | `e.Next.Top == e.Top` | 后继边的顶点与当前边的顶点相同 |
| 2 | `e.Next.NextInLML == null` | 后继边也是一个终止边（没有延续） |
| 3 | `return e.Next` | 后继边就是配对边 |
| 4 | `e.Prev.Top == e.Top` | 前驱边的顶点与当前边顶点相同 |
| 5 | `e.Prev.NextInLML == null` | 前驱边也是终止边 |
| 6 | `return e.Prev` | 前驱边就是配对边 |
| 7 | `return null` | 找不到配对（不应该发生） |

```
  配对边示意图（在多边形的环形边列表中）：

      e.Prev ←── e ──→ e.Next
         ╲              ╱
          ╲            ╱
           ╲──────────╱
            最大值顶点
            (两边的 Top 相同)
```

### 10.4.2 GetMaximaPairEx

```csharp
internal TEdge GetMaximaPairEx(TEdge e)
{
    TEdge result = GetMaximaPair(e);
    if (result == null || result.OutIdx == Skip ||
      ((result.NextInAEL == result.PrevInAEL) && !IsHorizontal(result))) return null;
    return result;
}
```

**逐行解读**：

| 行 | 代码 | 说明 |
|:---:|:---|:---|
| 1 | `GetMaximaPair(e)` | 首先调用基础版本获取配对边 |
| 2 | `result == null` | 没有找到配对边 |
| 3 | `result.OutIdx == Skip` | 配对边已被标记为跳过（已被处理过） |
| 4 | `result.NextInAEL == result.PrevInAEL` | 配对边在 AEL 中前后邻居相同 |
| 5 | `!IsHorizontal(result)` | 且配对边不是水平边 |
| 6 | `return null` | 以上任一条件成立时返回 null |

**为什么需要 Ex 版本？** 因为在某些退化情况下，配对边可能已经被处理（标记为 `Skip`），或者 AEL 中只剩一条边（`NextInAEL == PrevInAEL`），此时需要特殊处理而不是常规的最大值处理流程。

---

## 10.5 IsEvenOddFillType 与 IsEvenOddAltFillType

### 10.5.1 IsEvenOddFillType — 判断同类型填充规则

```csharp
private bool IsEvenOddFillType(TEdge edge)
{
    if (edge.PolyTyp == PolyType.ptSubject)
        return m_SubjFillType == PolyFillType.pftEvenOdd;
    else
        return m_ClipFillType == PolyFillType.pftEvenOdd;
}
```

**功能**：判断给定边所属的多边形类型（Subject 或 Clip）是否使用奇偶填充规则。

- 如果边属于 Subject 多边形 → 检查 `m_SubjFillType`
- 如果边属于 Clip 多边形 → 检查 `m_ClipFillType`

### 10.5.2 IsEvenOddAltFillType — 判断对侧多边形的填充规则

```csharp
private bool IsEvenOddAltFillType(TEdge edge)
{
    if (edge.PolyTyp == PolyType.ptSubject)
        return m_ClipFillType == PolyFillType.pftEvenOdd;
    else
        return m_SubjFillType == PolyFillType.pftEvenOdd;
}
```

**功能**：判断给定边的**对侧**多边形类型是否使用奇偶填充规则。

- 如果边属于 Subject → 检查 **Clip** 的填充类型
- 如果边属于 Clip → 检查 **Subject** 的填充类型

**为什么需要这两个方法？** 在计算缠绕数时：
- `WindCnt` 使用同类型填充规则（`IsEvenOddFillType`）
- `WindCnt2` 使用对侧填充规则（`IsEvenOddAltFillType`）

---

## 10.6 InsertEdgeIntoAEL 与 E2InsertsBeforeE1 — AEL 有序插入

### 10.6.1 AEL 的排序规则

活动边表（AEL）是一个按**当前 X 坐标从左到右**排序的双向链表。当新的边需要插入 AEL 时，必须找到正确的位置以维持有序性。

```
  AEL 排序示意图（扫描线 Y = 30）：

  m_ActiveEdges
       │
       ▼
  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
  │ edge A │←──→│ edge B │←──→│ edge C │←──→│ edge D │
  │ X=10   │    │ X=25   │    │ X=40   │    │ X=55   │
  └────────┘    └────────┘    └────────┘    └────────┘
  (最左)                                      (最右)
```

### 10.6.2 InsertEdgeIntoAEL 源码

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
        edge.PrevInAEL = null;
        edge.NextInAEL = m_ActiveEdges;
        m_ActiveEdges.PrevInAEL = edge;
        m_ActiveEdges = edge;
    }
    else
    {
        if (startEdge == null) startEdge = m_ActiveEdges;
        while (startEdge.NextInAEL != null &&
          !E2InsertsBeforeE1(startEdge.NextInAEL, edge))
            startEdge = startEdge.NextInAEL;
        edge.NextInAEL = startEdge.NextInAEL;
        if (startEdge.NextInAEL != null) startEdge.NextInAEL.PrevInAEL = edge;
        edge.PrevInAEL = startEdge;
        startEdge.NextInAEL = edge;
    }
}
```

**逐行解读**：

| 步骤 | 条件 | 操作 | 说明 |
|:---:|:---|:---|:---|
| 1 | `m_ActiveEdges == null` | 直接设为头节点 | AEL 为空，新边成为唯一边 |
| 2 | `startEdge == null` 且新边应插在最前面 | 插入头部 | 新边的 X 坐标最小 |
| 3 | 否则 | 从 `startEdge` 开始向右遍历 | 找到第一个应在新边之后的位置 |
| 4 | 找到位置后 | 标准双向链表插入 | 维护前后指针 |

**`startEdge` 参数的作用**：当已知新边应该在某个特定边之后（例如已经插入了左边界 `lb`，再插入右边界 `rb` 时，`rb` 一定在 `lb` 之后），可以传入 `startEdge` 作为搜索起点，避免从头遍历，提高效率。

### 10.6.3 E2InsertsBeforeE1 源码

```csharp
private bool E2InsertsBeforeE1(TEdge e1, TEdge e2)
{
    if (e2.Curr.X == e1.Curr.X)
    {
        if (e2.Top.Y > e1.Top.Y)
            return e2.Top.X < TopX(e1, e2.Top.Y);
        else return e1.Top.X > TopX(e2, e1.Top.Y);
    }
    else return e2.Curr.X < e1.Curr.X;
}
```

**逐行解读**：

| 行 | 条件 | 返回值 | 说明 |
|:---:|:---|:---|:---|
| 1 | `e2.Curr.X == e1.Curr.X` | — | 两边当前 X 坐标相同，需进一步比较 |
| 2 | `e2.Top.Y > e1.Top.Y` | `e2.Top.X < TopX(e1, e2.Top.Y)` | e2 更高时，比较 e2 顶部 X 与 e1 在该高度的 X |
| 3 | 否则 | `e1.Top.X > TopX(e2, e1.Top.Y)` | e1 更高时，比较 e1 顶部 X 与 e2 在该高度的 X |
| 4 | `e2.Curr.X != e1.Curr.X` | `e2.Curr.X < e1.Curr.X` | 直接按当前 X 坐标比较 |

**核心逻辑**：
- **常见情况**（X 不同）：直接比较当前 X 坐标，X 小的在前面
- **X 相同时**：需要根据边的斜率（通过比较未来的 X 位置）来决定顺序，确保随着扫描线上移，左边的边始终在右边的边之前

```
  X 相同时的排序逻辑示意图：

  情况1: e2 在 e1 左边（e2 应在 e1 之前）
          e1      e2
           ╲    ╱
            ╲  ╱
             ╳         ← 当前扫描线，X 坐标相同
            ╱  ╲
           ╱    ╲

  情况2: e2 在 e1 右边（e2 不应在 e1 之前）
          e2      e1
           ╲    ╱
            ╲  ╱
             ╳         ← 当前扫描线，X 坐标相同
            ╱  ╲
           ╱    ╲
```

---

## 10.7 SetWindingCount — 缠绕数计算

这是 Clipper 算法中**最复杂也最关键**的方法之一。缠绕数决定了每条边内侧是"填充区域"还是"非填充区域"，直接影响布尔运算结果。

### 10.7.1 缠绕数的概念

**缠绕数（Winding Number）**描述了从一个点出发，多边形边界围绕该点旋转的次数。在 Clipper 中：

- `WindCnt`：同类型（Subject 或 Clip）多边形的缠绕数
- `WindCnt2`：对侧类型多边形的缠绕数

```
  缠绕数计算示意图（从左向右穿过边）：

  外部(WindCnt=0)  │  内部(WindCnt=1)  │  外部(WindCnt=0)
                   │                    │
  ←── 扫描线 ──→   边1(WindDelta=1)     边2(WindDelta=-1)

  穿过边1: WindCnt += WindDelta = 0+1 = 1 → 进入内部
  穿过边2: WindCnt += WindDelta = 1+(-1) = 0 → 回到外部
```

### 10.7.2 完整源码

```csharp
private void SetWindingCount(TEdge edge)
{
    TEdge e = edge.PrevInAEL;
    //find the edge of the same polytype that immediately preceeds 'edge' in AEL
    while (e != null && ((e.PolyTyp != edge.PolyTyp) || (e.WindDelta == 0))) e = e.PrevInAEL;
    if (e == null)
    {
        PolyFillType pft;
        pft = (edge.PolyTyp == PolyType.ptSubject ? m_SubjFillType : m_ClipFillType);
        if (edge.WindDelta == 0) edge.WindCnt = (pft == PolyFillType.pftNegative ? -1 : 1);
        else edge.WindCnt = edge.WindDelta;
        edge.WindCnt2 = 0;
        e = m_ActiveEdges; //ie get ready to calc WindCnt2
    }
    else if (edge.WindDelta == 0 && m_ClipType != ClipType.ctUnion)
    {
        edge.WindCnt = 1;
        edge.WindCnt2 = e.WindCnt2;
        e = e.NextInAEL; //ie get ready to calc WindCnt2
    }
    else if (IsEvenOddFillType(edge))
    {
        //EvenOdd filling ...
        if (edge.WindDelta == 0)
        {
            bool Inside = true;
            TEdge e2 = e.PrevInAEL;
            while (e2 != null)
            {
                if (e2.PolyTyp == e.PolyTyp && e2.WindDelta != 0)
                    Inside = !Inside;
                e2 = e2.PrevInAEL;
            }
            edge.WindCnt = (Inside ? 0 : 1);
        }
        else
        {
            edge.WindCnt = edge.WindDelta;
        }
        edge.WindCnt2 = e.WindCnt2;
        e = e.NextInAEL; //ie get ready to calc WindCnt2
    }
    else
    {
        //nonZero, Positive or Negative filling ...
        if (e.WindCnt * e.WindDelta < 0)
        {
            if (Math.Abs(e.WindCnt) > 1)
            {
                if (e.WindDelta * edge.WindDelta < 0) edge.WindCnt = e.WindCnt;
                else edge.WindCnt = e.WindCnt + edge.WindDelta;
            }
            else
                edge.WindCnt = (edge.WindDelta == 0 ? 1 : edge.WindDelta);
        }
        else
        {
            if (edge.WindDelta == 0)
                edge.WindCnt = (e.WindCnt < 0 ? e.WindCnt - 1 : e.WindCnt + 1);
            else if (e.WindDelta * edge.WindDelta < 0)
                edge.WindCnt = e.WindCnt;
            else edge.WindCnt = e.WindCnt + edge.WindDelta;
        }
        edge.WindCnt2 = e.WindCnt2;
        e = e.NextInAEL; //ie get ready to calc WindCnt2
    }

    //update WindCnt2 ...
    if (IsEvenOddAltFillType(edge))
    {
        while (e != edge)
        {
            if (e.WindDelta != 0)
                edge.WindCnt2 = (edge.WindCnt2 == 0 ? 1 : 0);
            e = e.NextInAEL;
        }
    }
    else
    {
        while (e != edge)
        {
            edge.WindCnt2 += e.WindDelta;
            e = e.NextInAEL;
        }
    }
}
```

### 10.7.3 逐段详解

#### 第一步：向左查找同类型前驱边

```csharp
TEdge e = edge.PrevInAEL;
while (e != null && ((e.PolyTyp != edge.PolyTyp) || (e.WindDelta == 0))) e = e.PrevInAEL;
```

从当前边在 AEL 中的左邻居开始，向左遍历，跳过：
- 不同类型（PolyTyp 不同）的边
- `WindDelta == 0` 的边（开放路径的边，不参与缠绕计算）

目的是找到**最近的同类型有效边**，因为该边的缠绕数是计算新边缠绕数的基础。

```
  查找过程示意图：

  AEL: ... ←→ [Clip边] ←→ [Subject边,WD=0] ←→ [Subject边,WD=1] ←→ [新Subject边]
                跳过(不同类型)    跳过(WD==0)        找到! e指向此处        edge
```

#### 第二步：e == null（左边没有同类型边）

```csharp
if (e == null)
{
    PolyFillType pft;
    pft = (edge.PolyTyp == PolyType.ptSubject ? m_SubjFillType : m_ClipFillType);
    if (edge.WindDelta == 0) edge.WindCnt = (pft == PolyFillType.pftNegative ? -1 : 1);
    else edge.WindCnt = edge.WindDelta;
    edge.WindCnt2 = 0;
    e = m_ActiveEdges;
}
```

**含义**：当前边左边没有任何同类型的有效边，说明这是该类型在 AEL 中从左数第一条边。

| 条件 | `WindCnt` 设置 | 说明 |
|:---|:---|:---|
| `WindDelta == 0`（开放路径）且 `pftNegative` | -1 | 负向填充的开放路径特殊处理 |
| `WindDelta == 0`（开放路径）且其他 | 1 | 其他填充类型的开放路径 |
| `WindDelta != 0` | `edge.WindDelta` | 普通边，WindCnt 等于自身的 WindDelta |

`WindCnt2` 设为 0（左边没有对侧边），然后 `e` 指向 AEL 头部，准备计算 `WindCnt2`。

#### 第三步：edge.WindDelta == 0 且不是 Union 操作

```csharp
else if (edge.WindDelta == 0 && m_ClipType != ClipType.ctUnion)
{
    edge.WindCnt = 1;
    edge.WindCnt2 = e.WindCnt2;
    e = e.NextInAEL;
}
```

**含义**：开放路径的边（`WindDelta == 0`）在非 Union 操作时，始终设 `WindCnt = 1`，继承前驱的 `WindCnt2`。

#### 第四步：奇偶填充规则

```csharp
else if (IsEvenOddFillType(edge))
{
    if (edge.WindDelta == 0)
    {
        bool Inside = true;
        TEdge e2 = e.PrevInAEL;
        while (e2 != null)
        {
            if (e2.PolyTyp == e.PolyTyp && e2.WindDelta != 0)
                Inside = !Inside;
            e2 = e2.PrevInAEL;
        }
        edge.WindCnt = (Inside ? 0 : 1);
    }
    else
    {
        edge.WindCnt = edge.WindDelta;
    }
    edge.WindCnt2 = e.WindCnt2;
    e = e.NextInAEL;
}
```

**奇偶填充规则**：每穿过一条同类型的边，内外状态翻转一次。

```
  奇偶填充示意图：

  外部 │ 内部 │ 外部 │ 内部 │ 外部
       边1    边2    边3    边4
  WC=0  WC=1  WC=0  WC=1  WC=0

  每穿过一条边，WindCnt 在 0 和 1 之间翻转
```

对于 `WindDelta == 0` 的开放路径边：通过数左边同类型边的个数来确定当前处于内部还是外部。

对于普通边（`WindDelta != 0`）：直接设为 `edge.WindDelta`（在奇偶模式下始终为 ±1）。

#### 第五步：非零 / 正向 / 负向填充规则

```csharp
else
{
    //nonZero, Positive or Negative filling ...
    if (e.WindCnt * e.WindDelta < 0)
    {
        // 前驱边的 WindCnt 和 WindDelta 符号不同
        if (Math.Abs(e.WindCnt) > 1)
        {
            if (e.WindDelta * edge.WindDelta < 0) edge.WindCnt = e.WindCnt;
            else edge.WindCnt = e.WindCnt + edge.WindDelta;
        }
        else
            edge.WindCnt = (edge.WindDelta == 0 ? 1 : edge.WindDelta);
    }
    else
    {
        // 前驱边的 WindCnt 和 WindDelta 符号相同
        if (edge.WindDelta == 0)
            edge.WindCnt = (e.WindCnt < 0 ? e.WindCnt - 1 : e.WindCnt + 1);
        else if (e.WindDelta * edge.WindDelta < 0)
            edge.WindCnt = e.WindCnt;
        else edge.WindCnt = e.WindCnt + edge.WindDelta;
    }
    edge.WindCnt2 = e.WindCnt2;
    e = e.NextInAEL;
}
```

这是最复杂的情况。在非零填充规则下，缠绕数可以超过 ±1。算法需要根据前驱边的缠绕数和两条边的方向（WindDelta 的符号）来累加或抵消缠绕数。

**非零填充缠绕数计算逻辑表**：

| 前驱 `e.WindCnt * e.WindDelta` | `Math.Abs(e.WindCnt)` | `e.WindDelta * edge.WindDelta` | `edge.WindDelta` | 结果 `edge.WindCnt` |
|:---:|:---:|:---:|:---:|:---|
| < 0 | > 1 | < 0 | 非零 | `e.WindCnt`（保持） |
| < 0 | > 1 | >= 0 | 非零 | `e.WindCnt + edge.WindDelta`（累加） |
| < 0 | <= 1 | — | == 0 | 1 |
| < 0 | <= 1 | — | != 0 | `edge.WindDelta` |
| >= 0 | — | — | == 0 | `e.WindCnt ± 1`（绝对值增加） |
| >= 0 | — | < 0 | != 0 | `e.WindCnt`（保持） |
| >= 0 | — | >= 0 | != 0 | `e.WindCnt + edge.WindDelta`（累加） |

#### 第六步：计算 WindCnt2（对侧缠绕数）

```csharp
if (IsEvenOddAltFillType(edge))
{
    while (e != edge)
    {
        if (e.WindDelta != 0)
            edge.WindCnt2 = (edge.WindCnt2 == 0 ? 1 : 0);
        e = e.NextInAEL;
    }
}
else
{
    while (e != edge)
    {
        edge.WindCnt2 += e.WindDelta;
        e = e.NextInAEL;
    }
}
```

从前一步设置好的起始位置 `e` 开始，向右遍历到当前边 `edge`，累计所有经过的**对侧类型**边的缠绕数：

- **奇偶模式**：每遇到一条有效的对侧边，WindCnt2 在 0/1 之间翻转
- **非零模式**：累加所有对侧边的 WindDelta

```
  WindCnt2 计算示意图：

  假设当前边 edge 属于 Subject，需要计算 Clip 边的影响

  AEL: [Subj] [Clip,WD=1] [Clip,WD=-1] [Subj] [Clip,WD=1] [edge(Subj)]
                  ↑              ↑                    ↑
                  │              │                    │
              WindCnt2 += 1  WindCnt2 += (-1)    WindCnt2 += 1
              = 1            = 0                 = 1

  最终 edge.WindCnt2 = 1
```

---

## 10.8 IsContributing — 贡献判断

### 10.8.1 功能概述

`IsContributing()` 是决定一条边是否**贡献到输出多边形**的核心方法。它综合考虑：

1. 边自身的缠绕数（`WindCnt`）和填充规则
2. 对侧类型的缠绕数（`WindCnt2`）
3. 当前的裁剪操作类型（`ClipType`）

### 10.8.2 完整源码

```csharp
private bool IsContributing(TEdge edge)
{
    PolyFillType pft, pft2;
    if (edge.PolyTyp == PolyType.ptSubject)
    {
        pft = m_SubjFillType;
        pft2 = m_ClipFillType;
    }
    else
    {
        pft = m_ClipFillType;
        pft2 = m_SubjFillType;
    }

    switch (pft)
    {
        case PolyFillType.pftEvenOdd:
            if (edge.WindDelta == 0 && edge.WindCnt != 1) return false;
            break;
        case PolyFillType.pftNonZero:
            if (Math.Abs(edge.WindCnt) != 1) return false;
            break;
        case PolyFillType.pftPositive:
            if (edge.WindCnt != 1) return false;
            break;
        default: //PolyFillType.pftNegative
            if (edge.WindCnt != -1) return false;
            break;
    }

    switch (m_ClipType)
    {
        case ClipType.ctIntersection:
            switch (pft2)
            {
                case PolyFillType.pftEvenOdd:
                case PolyFillType.pftNonZero:
                    return (edge.WindCnt2 != 0);
                case PolyFillType.pftPositive:
                    return (edge.WindCnt2 > 0);
                default:
                    return (edge.WindCnt2 < 0);
            }
        case ClipType.ctUnion:
            switch (pft2)
            {
                case PolyFillType.pftEvenOdd:
                case PolyFillType.pftNonZero:
                    return (edge.WindCnt2 == 0);
                case PolyFillType.pftPositive:
                    return (edge.WindCnt2 <= 0);
                default:
                    return (edge.WindCnt2 >= 0);
            }
        case ClipType.ctDifference:
            if (edge.PolyTyp == PolyType.ptSubject)
                switch (pft2)
                {
                    case PolyFillType.pftEvenOdd:
                    case PolyFillType.pftNonZero:
                        return (edge.WindCnt2 == 0);
                    case PolyFillType.pftPositive:
                        return (edge.WindCnt2 <= 0);
                    default:
                        return (edge.WindCnt2 >= 0);
                }
            else
                switch (pft2)
                {
                    case PolyFillType.pftEvenOdd:
                    case PolyFillType.pftNonZero:
                        return (edge.WindCnt2 != 0);
                    case PolyFillType.pftPositive:
                        return (edge.WindCnt2 > 0);
                    default:
                        return (edge.WindCnt2 < 0);
                }
        case ClipType.ctXor:
            if (edge.WindDelta == 0)
                switch (pft2)
                {
                    case PolyFillType.pftEvenOdd:
                    case PolyFillType.pftNonZero:
                        return (edge.WindCnt2 == 0);
                    case PolyFillType.pftPositive:
                        return (edge.WindCnt2 <= 0);
                    default:
                        return (edge.WindCnt2 >= 0);
                }
            else
                return true;
    }
    return true;
}
```

### 10.8.3 两阶段判断逻辑

#### 阶段一：自身填充规则过滤

首先根据边自身所属类型的填充规则，检查 `WindCnt` 是否表明该边处于"填充边界"上：

| 填充规则 | 贡献条件（通过第一阶段） |
|:---|:---|
| `pftEvenOdd` | `WindDelta == 0` 时必须 `WindCnt == 1`；否则通过 |
| `pftNonZero` | `abs(WindCnt) == 1` |
| `pftPositive` | `WindCnt == 1` |
| `pftNegative` | `WindCnt == -1` |

如果第一阶段不通过，直接返回 `false`。

#### 阶段二：裁剪操作与对侧缠绕数

通过第一阶段后，根据裁剪操作类型和对侧缠绕数判断：

**Intersection（交集）判断表**：

| 对侧填充规则 (`pft2`) | 贡献条件 (`WindCnt2`) | 含义 |
|:---|:---|:---|
| EvenOdd / NonZero | `WindCnt2 != 0` | 该边内侧处于对侧多边形内部 |
| Positive | `WindCnt2 > 0` | 正向穿越计数大于0 |
| Negative | `WindCnt2 < 0` | 负向穿越计数小于0 |

**Union（并集）判断表**：

| 对侧填充规则 (`pft2`) | 贡献条件 (`WindCnt2`) | 含义 |
|:---|:---|:---|
| EvenOdd / NonZero | `WindCnt2 == 0` | 该边内侧处于对侧多边形外部 |
| Positive | `WindCnt2 <= 0` | 不在正向填充区域内 |
| Negative | `WindCnt2 >= 0` | 不在负向填充区域内 |

**Difference（差集）判断表**（Subject 边）：

| 对侧填充规则 (`pft2`) | 贡献条件 (`WindCnt2`) | 含义 |
|:---|:---|:---|
| EvenOdd / NonZero | `WindCnt2 == 0` | Subject 边不在 Clip 内部 |
| Positive | `WindCnt2 <= 0` | Subject 边不在 Clip 正向区域内 |
| Negative | `WindCnt2 >= 0` | Subject 边不在 Clip 负向区域内 |

**Difference（差集）判断表**（Clip 边）：

| 对侧填充规则 (`pft2`) | 贡献条件 (`WindCnt2`) | 含义 |
|:---|:---|:---|
| EvenOdd / NonZero | `WindCnt2 != 0` | Clip 边在 Subject 内部 |
| Positive | `WindCnt2 > 0` | Clip 边在 Subject 正向区域内 |
| Negative | `WindCnt2 < 0` | Clip 边在 Subject 负向区域内 |

**Xor（异或）**：
- `WindDelta == 0`（开放路径）：与 Union 的 Subject 边规则相同
- `WindDelta != 0`（普通边）：始终贡献（`return true`）

### 10.8.4 布尔运算直觉理解

```
  交集（Intersection）: A ∩ B
  ┌─────────┐
  │    A    ┌┼────────┐
  │         │█████████│  ← 只保留两者重叠区域
  │         └┼────────┘
  └─────────┘    B

  并集（Union）: A ∪ B
  ┌─────────┐
  │█████████┌┼────────┐
  │█████████│█████████│  ← 保留两者任一覆盖的区域
  │█████████└┼────────┘
  └─────────┘████████B

  差集（Difference）: A - B
  ┌─────────┐
  │█████████┌┼────────┐
  │█████████│         │  ← 只保留 A 有而 B 没有的区域
  │█████████└┼────────┘
  └─────────┘    B

  异或（Xor）: A ⊕ B
  ┌─────────┐
  │█████████┌┼────────┐
  │█████████│         │  ← 保留两者不重叠的区域
  │█████████└┼────────┘
  └─────────┘████████B
```

---

## 10.9 AddOutPt — 向输出多边形添加顶点

### 10.9.1 功能概述

`AddOutPt` 是将一个新的顶点添加到输出多边形环形链表中的核心方法。它处理两种情况：
1. 边尚无关联的输出多边形（`OutIdx < 0`）→ 创建新的输出记录
2. 边已有关联的输出多边形 → 将新顶点追加到现有链表

### 10.9.2 完整源码与注释

```csharp
private OutPt AddOutPt(TEdge e, IntPoint pt)
{
    if (e.OutIdx < 0)
    {
        // ========== 情况1: 创建全新的输出多边形 ==========
        OutRec outRec = CreateOutRec();       // 创建新的输出记录
        outRec.IsOpen = (e.WindDelta == 0);   // 开放路径标记
        OutPt newOp = new OutPt();            // 创建第一个输出点
        outRec.Pts = newOp;                   // 输出记录指向该点
        newOp.Idx = outRec.Idx;               // 记录所属输出记录索引
        newOp.Pt = pt;                        // 设置坐标
        newOp.Next = newOp;                   // 自环（环形链表初始化）
        newOp.Prev = newOp;                   // 自环
        if (!outRec.IsOpen)
            SetHoleState(e, outRec);          // 设置孔洞状态
        e.OutIdx = outRec.Idx;                // 边关联到此输出记录
        return newOp;
    }
    else
    {
        // ========== 情况2: 追加到现有输出多边形 ==========
        OutRec outRec = m_PolyOuts[e.OutIdx]; // 获取已有的输出记录
        OutPt op = outRec.Pts;                // 获取链表头指针
        bool ToFront = (e.Side == EdgeSide.esLeft); // 左侧边追加到前面

        // 重复点检测：如果新点与头/尾相同则不添加
        if (ToFront && pt == op.Pt) return op;
        else if (!ToFront && pt == op.Prev.Pt) return op.Prev;

        // 创建新的输出点并插入环形链表
        OutPt newOp = new OutPt();
        newOp.Idx = outRec.Idx;
        newOp.Pt = pt;
        newOp.Next = op;                     // 新点的下一个指向头部
        newOp.Prev = op.Prev;                // 新点的前一个指向原尾部
        newOp.Prev.Next = newOp;              // 原尾部的下一个指向新点
        op.Prev = newOp;                      // 头部的前一个指向新点
        if (ToFront) outRec.Pts = newOp;      // 如果追加到前面，更新头指针
        return newOp;
    }
}
```

### 10.9.3 环形双向链表操作图解

**情况1: 创建新多边形（单点自环）**

```
  创建后的状态：

  outRec.Pts ──→ ┌─────────┐
                 │  newOp   │
                 │  Pt=(x,y)│
                 │  Next ───┼──→ (自身)
                 │  Prev ───┼──→ (自身)
                 └─────────┘
```

**情况2: 追加到现有链表（ToFront = true，追加到前面）**

```
  追加前：
                   outRec.Pts
                       │
                       ▼
  ┌──────┐    ┌──────┐    ┌──────┐
  │ Pt C │←──→│ Pt A │←──→│ Pt B │
  └──────┘    └──────┘    └──────┘
       ↑                       │
       └───────────────────────┘  (环形)

  追加后（新点 D 插入到 A 前面，成为新的头部）：
                   outRec.Pts
                       │
                       ▼
  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐
  │ Pt C │←──→│ Pt D │←──→│ Pt A │←──→│ Pt B │
  └──────┘    └──────┘    └──────┘    └──────┘
       ↑            (新头部)                │
       └────────────────────────────────────┘  (环形)
```

**情况2: 追加到现有链表（ToFront = false，追加到尾部）**

```
  追加后（新点 D 插入到 A 和 C 之间，但头指针不变）：
                   outRec.Pts
                       │
                       ▼
  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐
  │ Pt D │←──→│ Pt A │←──→│ Pt B │←──→│ Pt C │
  └──────┘    └──────┘    └──────┘    └──────┘
       ↑  (新尾部)                         │
       └───────────────────────────────────┘  (环形)
```

### 10.9.4 Side 属性的作用

`e.Side` 属性标记边位于输出多边形的左侧（`esLeft`）还是右侧（`esRight`）：

- **左侧边（esLeft）**：新顶点追加到链表**前面**（`ToFront = true`），因为左侧边沿逆时针方向生长
- **右侧边（esRight）**：新顶点追加到链表**尾部**（`ToFront = false`），因为右侧边沿顺时针方向生长

```
  左侧边和右侧边示意图：

           ╱          ╲
          ╱  输出多边形  ╲
  左侧边 ╱    (内部)     ╲ 右侧边
  esLeft ╱               ╲ esRight
        ╱                 ╲
       ╱───────────────────╲
            局部最小值
```

---

## 10.10 AddLocalMinPoly 与 AddLocalMaxPoly — 局部极值处的多边形操作

### 10.10.1 AddLocalMinPoly — 在局部最小值处创建输出多边形段

当扫描线经过一个贡献输出的局部最小值时，需要**开始**一个新的输出多边形段（或将当前点添加到现有输出多边形）。

```csharp
private OutPt AddLocalMinPoly(TEdge e1, TEdge e2, IntPoint pt)
{
    OutPt result;
    TEdge e, prevE;
    if (IsHorizontal(e2) || (e1.Dx > e2.Dx))
    {
        result = AddOutPt(e1, pt);
        e2.OutIdx = e1.OutIdx;
        e1.Side = EdgeSide.esLeft;
        e2.Side = EdgeSide.esRight;
        e = e1;
        if (e.PrevInAEL == e2)
            prevE = e2.PrevInAEL;
        else
            prevE = e.PrevInAEL;
    }
    else
    {
        result = AddOutPt(e2, pt);
        e1.OutIdx = e2.OutIdx;
        e1.Side = EdgeSide.esRight;
        e2.Side = EdgeSide.esLeft;
        e = e2;
        if (e.PrevInAEL == e1)
            prevE = e1.PrevInAEL;
        else
            prevE = e.PrevInAEL;
    }

    if (prevE != null && prevE.OutIdx >= 0 && prevE.Top.Y < pt.Y && e.Top.Y < pt.Y)
    {
        cInt xPrev = TopX(prevE, pt.Y);
        cInt xE = TopX(e, pt.Y);
        if ((xPrev == xE) && (e.WindDelta != 0) && (prevE.WindDelta != 0) &&
          SlopesEqual(new IntPoint(xPrev, pt.Y), prevE.Top, new IntPoint(xE, pt.Y), e.Top, m_UseFullRange))
        {
            OutPt outPt = AddOutPt(prevE, pt);
            AddJoin(result, outPt, e.Top);
        }
    }
    return result;
}
```

**逐段详解**：

#### 步骤一：确定左右边并创建输出点

```
  判断哪条边作为"主边"（创建输出点的边）：

  条件: IsHorizontal(e2) || (e1.Dx > e2.Dx)

  含义: 如果 e2 是水平的，或者 e1 的斜率更大（更趋向水平），
       则 e1 作为左侧边，e2 作为右侧边。

  e1.Dx > e2.Dx 时：
       e1(左边,斜率大)    e2(右边,斜率小)
          ╲              ╱
           ╲            ╱
            ╲──────────╱
              局部最小值 pt
```

**Side 分配**：
- 主边（创建输出点的边）设为 `esLeft`
- 另一条边设为 `esRight`
- 两条边共享同一个 `OutIdx`

#### 步骤二：检查可能的连接（Join）

```csharp
if (prevE != null && prevE.OutIdx >= 0 && prevE.Top.Y < pt.Y && e.Top.Y < pt.Y)
{
    cInt xPrev = TopX(prevE, pt.Y);
    cInt xE = TopX(e, pt.Y);
    if ((xPrev == xE) && (e.WindDelta != 0) && (prevE.WindDelta != 0) &&
      SlopesEqual(...))
    {
        OutPt outPt = AddOutPt(prevE, pt);
        AddJoin(result, outPt, e.Top);
    }
}
```

**含义**：如果左侧的前驱边与当前边在同一斜率上（共线），则需要记录一个"连接"（Join），以便后续合并共享边界的多边形。

### 10.10.2 AddLocalMaxPoly — 在局部最大值处关闭输出多边形段

```csharp
private void AddLocalMaxPoly(TEdge e1, TEdge e2, IntPoint pt)
{
    AddOutPt(e1, pt);
    if (e2.WindDelta == 0) AddOutPt(e2, pt);
    if (e1.OutIdx == e2.OutIdx)
    {
        e1.OutIdx = Unassigned;
        e2.OutIdx = Unassigned;
    }
    else if (e1.OutIdx < e2.OutIdx)
        AppendPolygon(e1, e2);
    else
        AppendPolygon(e2, e1);
}
```

**逐行解读**：

| 步骤 | 代码 | 说明 |
|:---:|:---|:---|
| 1 | `AddOutPt(e1, pt)` | 将最大值点添加到 e1 的输出多边形 |
| 2 | `if (e2.WindDelta == 0) AddOutPt(e2, pt)` | 如果 e2 是开放路径的边，也添加该点 |
| 3 | `e1.OutIdx == e2.OutIdx` | 两条边属于同一个输出多边形 → 多边形闭合 |
| 4 | `Unassigned` | 将两条边的 OutIdx 标记为未分配 |
| 5 | `AppendPolygon(e1, e2)` | 两条边属于不同输出多边形 → 合并 |

```
  局部最大值处理示意图：

  情况A: e1, e2 属于同一个输出多边形（多边形闭合）
  ∧──────────────∧
   ╲    同一个    ╱
    ╲  输出多边形 ╱
     ╲          ╱
      ╲        ╱
       V──────V     ← 之前在局部最小值处创建

  情况B: e1, e2 属于不同输出多边形（多边形合并）
  ∧──────────────∧
   ╲   OutRec1  ╱ ╲  OutRec2   ╱
    ╲          ╱   ╲          ╱
     ╲        ╱     ╲        ╱
  → 需要将两个 OutRec 合并为一个
```

---

## 10.11 InsertLocalMinimaIntoAEL — 核心方法详解

这是 Vatti 算法中**最重要**的方法之一。每当扫描线到达一个新的扫描束底部 Y 坐标时，该方法将所有该 Y 坐标处的局部最小值插入活动边表。

### 10.11.1 完整源码

```csharp
private void InsertLocalMinimaIntoAEL(cInt botY)
{
    LocalMinima lm;
    while (PopLocalMinima(botY, out lm))
    {
        TEdge lb = lm.LeftBound;
        TEdge rb = lm.RightBound;

        OutPt Op1 = null;
        if (lb == null)
        {
            InsertEdgeIntoAEL(rb, null);
            SetWindingCount(rb);
            if (IsContributing(rb))
                Op1 = AddOutPt(rb, rb.Bot);
        }
        else if (rb == null)
        {
            InsertEdgeIntoAEL(lb, null);
            SetWindingCount(lb);
            if (IsContributing(lb))
                Op1 = AddOutPt(lb, lb.Bot);
            InsertScanbeam(lb.Top.Y);
        }
        else
        {
            InsertEdgeIntoAEL(lb, null);
            InsertEdgeIntoAEL(rb, lb);
            SetWindingCount(lb);
            rb.WindCnt = lb.WindCnt;
            rb.WindCnt2 = lb.WindCnt2;
            if (IsContributing(lb))
                Op1 = AddLocalMinPoly(lb, rb, lb.Bot);
            InsertScanbeam(lb.Top.Y);
        }

        if (rb != null)
        {
            if (IsHorizontal(rb))
            {
                if (rb.NextInLML != null)
                    InsertScanbeam(rb.NextInLML.Top.Y);
                AddEdgeToSEL(rb);
            }
            else
                InsertScanbeam(rb.Top.Y);
        }

        if (lb == null || rb == null) continue;

        if (Op1 != null && IsHorizontal(rb) &&
          m_GhostJoins.Count > 0 && rb.WindDelta != 0)
        {
            for (int i = 0; i < m_GhostJoins.Count; i++)
            {
                Join j = m_GhostJoins[i];
                if (HorzSegmentsOverlap(j.OutPt1.Pt.X, j.OffPt.X, rb.Bot.X, rb.Top.X))
                    AddJoin(j.OutPt1, Op1, j.OffPt);
            }
        }

        if (lb.OutIdx >= 0 && lb.PrevInAEL != null &&
          lb.PrevInAEL.Curr.X == lb.Bot.X &&
          lb.PrevInAEL.OutIdx >= 0 &&
          SlopesEqual(lb.PrevInAEL.Curr, lb.PrevInAEL.Top, lb.Curr, lb.Top, m_UseFullRange) &&
          lb.WindDelta != 0 && lb.PrevInAEL.WindDelta != 0)
        {
            OutPt Op2 = AddOutPt(lb.PrevInAEL, lb.Bot);
            AddJoin(Op1, Op2, lb.Top);
        }

        if (lb.NextInAEL != rb)
        {
            if (rb.OutIdx >= 0 && rb.PrevInAEL.OutIdx >= 0 &&
              SlopesEqual(rb.PrevInAEL.Curr, rb.PrevInAEL.Top, rb.Curr, rb.Top, m_UseFullRange) &&
              rb.WindDelta != 0 && rb.PrevInAEL.WindDelta != 0)
            {
                OutPt Op2 = AddOutPt(rb.PrevInAEL, rb.Bot);
                AddJoin(Op1, Op2, rb.Top);
            }

            TEdge e = lb.NextInAEL;
            if (e != null)
                while (e != rb)
                {
                    IntersectEdges(rb, e, lb.Curr);
                    e = e.NextInAEL;
                }
        }
    }
}
```

### 10.11.2 整体流程分析

```
  InsertLocalMinimaIntoAEL 流程图：

  ┌─────────────────────────────────────────┐
  │ 循环: PopLocalMinima(botY, out lm)      │
  │ 取出所有 Y == botY 的局部最小值          │
  └──────────────┬──────────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────┐
  │ 获取 lb (LeftBound), rb (RightBound) │
  └──────────┬─────────┬────────────┘
             │         │
     ┌───────┴───┐ ┌───┴────────┐ ┌────────────┐
     │ lb==null  │ │ rb==null   │ │ 两者都存在  │
     │ (只有右边)│ │ (只有左边) │ │ (正常情况)  │
     └───────┬───┘ └───┬────────┘ └─────┬──────┘
             │         │                │
             ▼         ▼                ▼
     插入rb到AEL  插入lb到AEL    插入lb,rb到AEL
     设置缠绕数   设置缠绕数     设置缠绕数(共享)
     检查贡献     检查贡献       检查贡献
                               AddLocalMinPoly
                 │                │
                 ▼                ▼
  ┌──────────────────────────────────────┐
  │ 处理水平右边界: AddEdgeToSEL         │
  │ 注册扫描束: InsertScanbeam           │
  └──────────────┬───────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────┐
  │ 处理 GhostJoin 转换                  │
  │ 处理共线边的 Join                     │
  │ 处理 lb 与 rb 之间的夹缝边交叉        │
  └──────────────────────────────────────┘
```

### 10.11.3 分段详解

#### 段落一：弹出局部最小值

```csharp
LocalMinima lm;
while (PopLocalMinima(botY, out lm))
{
    TEdge lb = lm.LeftBound;
    TEdge rb = lm.RightBound;
```

从局部最小值列表中弹出所有 Y 坐标等于 `botY` 的局部最小值。每个局部最小值包含左边界（`lb`）和右边界（`rb`），代表多边形在该点"展开"的两条边。

#### 段落二：处理三种边界情况

**情况 A：只有右边界（lb == null）**

```csharp
if (lb == null)
{
    InsertEdgeIntoAEL(rb, null);
    SetWindingCount(rb);
    if (IsContributing(rb))
        Op1 = AddOutPt(rb, rb.Bot);
}
```

这种情况通常发生在开放路径（polyline）中。只将右边界插入 AEL，计算缠绕数，检查是否贡献输出。

**情况 B：只有左边界（rb == null）**

```csharp
else if (rb == null)
{
    InsertEdgeIntoAEL(lb, null);
    SetWindingCount(lb);
    if (IsContributing(lb))
        Op1 = AddOutPt(lb, lb.Bot);
    InsertScanbeam(lb.Top.Y);
}
```

同理，但需要将左边界的顶部 Y 注册为扫描束事件。

**情况 C：左右边界都存在（正常情况）**

```csharp
else
{
    InsertEdgeIntoAEL(lb, null);       // 先插入左边界
    InsertEdgeIntoAEL(rb, lb);         // 再插入右边界（从 lb 位置开始搜索）
    SetWindingCount(lb);               // 计算左边界缠绕数
    rb.WindCnt = lb.WindCnt;           // 右边界继承左边界的缠绕数
    rb.WindCnt2 = lb.WindCnt2;         // 右边界继承左边界的对侧缠绕数
    if (IsContributing(lb))
        Op1 = AddLocalMinPoly(lb, rb, lb.Bot);  // 创建输出多边形段
    InsertScanbeam(lb.Top.Y);          // 注册扫描束事件
}
```

**关键设计**：右边界 `rb` 直接继承左边界 `lb` 的缠绕数，而不是独立计算。这是因为在局部最小值处，左右边界刚刚从同一点展开，它们之间没有其他同类型的边，所以缠绕数相同。

```
  局部最小值的 AEL 插入示意图：

  插入前 AEL:
  ... ←→ [edge_prev] ←→ [edge_next] ←→ ...

  插入后 AEL（lb.Curr.X < rb.Curr.X 的情况）:
  ... ←→ [edge_prev] ←→ [lb] ←→ [rb] ←→ [edge_next] ←→ ...
                          ↑       ↑
                          └───┬───┘
                              │
                          同一个局部最小值的左右边界
```

#### 段落三：处理水平右边界

```csharp
if (rb != null)
{
    if (IsHorizontal(rb))
    {
        if (rb.NextInLML != null)
            InsertScanbeam(rb.NextInLML.Top.Y);
        AddEdgeToSEL(rb);
    }
    else
        InsertScanbeam(rb.Top.Y);
}
```

如果右边界是水平的，需要特殊处理：
- 将水平边加入 SEL（Sorted Edge List），稍后由 `ProcessHorizontals()` 处理
- 如果水平边有延续边（`NextInLML`），注册延续边顶部的扫描束事件
- 非水平右边界直接注册其顶部 Y 作为扫描束事件

```
  水平右边界示意图：

       ╱──────────── rb (水平) ────→ NextInLML
      ╱                                 ╲
     ╱                                   ╲
    lb                                    继续向上
     ╲                                   ╱
      ╲       局部最小值                 ╱
```

#### 段落四：Ghost Join 转换

```csharp
if (Op1 != null && IsHorizontal(rb) &&
  m_GhostJoins.Count > 0 && rb.WindDelta != 0)
{
    for (int i = 0; i < m_GhostJoins.Count; i++)
    {
        Join j = m_GhostJoins[i];
        if (HorzSegmentsOverlap(j.OutPt1.Pt.X, j.OffPt.X, rb.Bot.X, rb.Top.X))
            AddJoin(j.OutPt1, Op1, j.OffPt);
    }
}
```

**Ghost Join 机制**：当一条水平边被处理时，可能与之前标记的"幽灵连接"（Ghost Join）重叠。幽灵连接是在处理水平边时暂存的潜在连接信息，此处检查是否与新插入的水平右边界重叠，如果重叠则转换为正式的连接（Join）。

#### 段落五：共线边的 Join 处理

```csharp
if (lb.OutIdx >= 0 && lb.PrevInAEL != null &&
  lb.PrevInAEL.Curr.X == lb.Bot.X &&
  lb.PrevInAEL.OutIdx >= 0 &&
  SlopesEqual(lb.PrevInAEL.Curr, lb.PrevInAEL.Top, lb.Curr, lb.Top, m_UseFullRange) &&
  lb.WindDelta != 0 && lb.PrevInAEL.WindDelta != 0)
{
    OutPt Op2 = AddOutPt(lb.PrevInAEL, lb.Bot);
    AddJoin(Op1, Op2, lb.Top);
}
```

如果左边界与其 AEL 中的前驱边**共线**（相同起始 X 且斜率相同），则创建一个连接记录。这确保了共享边界的输出多边形最终会被正确合并。

#### 段落六：处理夹缝边的交叉

```csharp
if (lb.NextInAEL != rb)
{
    // ... 类似的共线检查 for rb ...

    TEdge e = lb.NextInAEL;
    if (e != null)
        while (e != rb)
        {
            IntersectEdges(rb, e, lb.Curr);
            e = e.NextInAEL;
        }
}
```

**关键**：如果在 AEL 中，`lb` 和 `rb` 之间存在其他边（"夹缝边"），说明这些边与新插入的局部最小值的边在当前 Y 坐标处相交。需要对每个夹缝边调用 `IntersectEdges()` 处理交叉。

```
  夹缝边示意图：

  AEL: ... ←→ [lb] ←→ [夹缝边1] ←→ [夹缝边2] ←→ [rb] ←→ ...
                        ↑             ↑
                        │             │
                   这些边与 rb 在 lb.Curr 处相交
                   需要调用 IntersectEdges(rb, e, lb.Curr)
```

---

## 10.12 ProcessEdgesAtTopOfScanbeam — 扫描束顶部处理

### 10.12.1 功能概述

当扫描线从 `botY` 移动到 `topY` 时，`ProcessEdgesAtTopOfScanbeam(topY)` 处理所有在 `topY` 处发生的事件：

1. **局部最大值**：两条边在此处汇合，多边形"收口"
2. **中间顶点**：一条边在此处结束，被其延续边替换
3. **普通边**：更新当前 X 坐标

### 10.12.2 完整源码

```csharp
private void ProcessEdgesAtTopOfScanbeam(cInt topY)
{
    TEdge e = m_ActiveEdges;
    while (e != null)
    {
        // ========== 第一遍：处理最大值和水平边 ==========
        bool IsMaximaEdge = IsMaxima(e, topY);
        if (IsMaximaEdge)
        {
            TEdge eMaxPair = GetMaximaPairEx(e);
            IsMaximaEdge = (eMaxPair == null || !IsHorizontal(eMaxPair));
        }

        if (IsMaximaEdge)
        {
            if (StrictlySimple) InsertMaxima(e.Top.X);
            TEdge ePrev = e.PrevInAEL;
            DoMaxima(e);
            if (ePrev == null) e = m_ActiveEdges;
            else e = ePrev.NextInAEL;
        }
        else
        {
            if (IsIntermediate(e, topY) && IsHorizontal(e.NextInLML))
            {
                UpdateEdgeIntoAEL(ref e);
                if (e.OutIdx >= 0) AddOutPt(e, e.Bot);
                AddEdgeToSEL(e);
            }
            else
            {
                e.Curr.X = TopX(e, topY);
                e.Curr.Y = topY;
            }

            if (StrictlySimple)
            {
                TEdge ePrev = e.PrevInAEL;
                if ((e.OutIdx >= 0) && (e.WindDelta != 0) && ePrev != null &&
                  (ePrev.OutIdx >= 0) && (ePrev.Curr.X == e.Curr.X) &&
                  (ePrev.WindDelta != 0))
                {
                    IntPoint ip = new IntPoint(e.Curr);
                    OutPt op = AddOutPt(ePrev, ip);
                    OutPt op2 = AddOutPt(e, ip);
                    AddJoin(op, op2, ip);
                }
            }
            e = e.NextInAEL;
        }
    }

    // ========== 处理水平边 ==========
    ProcessHorizontals();
    m_Maxima = null;

    // ========== 第二遍：处理中间顶点 ==========
    e = m_ActiveEdges;
    while (e != null)
    {
        if (IsIntermediate(e, topY))
        {
            OutPt op = null;
            if (e.OutIdx >= 0) op = AddOutPt(e, e.Top);
            UpdateEdgeIntoAEL(ref e);

            TEdge ePrev = e.PrevInAEL;
            TEdge eNext = e.NextInAEL;
            if (ePrev != null && ePrev.Curr.X == e.Bot.X &&
              ePrev.Curr.Y == e.Bot.Y && op != null &&
              ePrev.OutIdx >= 0 && ePrev.Curr.Y > ePrev.Top.Y &&
              SlopesEqual(e.Curr, e.Top, ePrev.Curr, ePrev.Top, m_UseFullRange) &&
              (e.WindDelta != 0) && (ePrev.WindDelta != 0))
            {
                OutPt op2 = AddOutPt(ePrev, e.Bot);
                AddJoin(op, op2, e.Top);
            }
            else if (eNext != null && eNext.Curr.X == e.Bot.X &&
              eNext.Curr.Y == e.Bot.Y && op != null &&
              eNext.OutIdx >= 0 && eNext.Curr.Y > eNext.Top.Y &&
              SlopesEqual(e.Curr, e.Top, eNext.Curr, eNext.Top, m_UseFullRange) &&
              (e.WindDelta != 0) && (eNext.WindDelta != 0))
            {
                OutPt op2 = AddOutPt(eNext, e.Bot);
                AddJoin(op, op2, e.Top);
            }
        }
        e = e.NextInAEL;
    }
}
```

### 10.12.3 两遍遍历的设计

该方法对 AEL 进行**两遍遍历**，这不是偶然的设计选择：

**第一遍**：处理最大值和水平延续边
- 最大值会导致边从 AEL 中删除
- 水平延续边需要先加入 SEL

**中间步骤**：调用 `ProcessHorizontals()` 处理所有水平边

**第二遍**：处理中间顶点
- 将到达中间顶点的边替换为其延续边（`UpdateEdgeIntoAEL`）
- 检查与邻居边的共线连接

```
  两遍遍历的时序：

  第一遍遍历 AEL
       │
       ├─ 处理最大值 (DoMaxima) → 删除边
       ├─ 处理水平延续 → 加入SEL
       └─ 更新非事件边的 X 坐标
       │
  ProcessHorizontals()  ← 处理所有水平边
       │
  第二遍遍历 AEL
       │
       └─ 处理中间顶点 → UpdateEdgeIntoAEL → 替换为延续边
```

### 10.12.4 第一遍遍历详解

#### 最大值处理

```csharp
bool IsMaximaEdge = IsMaxima(e, topY);
if (IsMaximaEdge)
{
    TEdge eMaxPair = GetMaximaPairEx(e);
    IsMaximaEdge = (eMaxPair == null || !IsHorizontal(eMaxPair));
}
```

首先判断边是否到达了最大值（`Top.Y == topY` 且 `NextInLML == null`）。但如果配对边是水平的，则暂时不作为最大值处理（让水平边处理逻辑来处理）。

```csharp
if (IsMaximaEdge)
{
    if (StrictlySimple) InsertMaxima(e.Top.X);
    TEdge ePrev = e.PrevInAEL;
    DoMaxima(e);
    if (ePrev == null) e = m_ActiveEdges;
    else e = ePrev.NextInAEL;
}
```

调用 `DoMaxima(e)` 处理最大值后，由于 `e` 已被从 AEL 删除，需要通过 `ePrev` 来获取下一个要处理的边。

#### 中间顶点的水平延续处理

```csharp
if (IsIntermediate(e, topY) && IsHorizontal(e.NextInLML))
{
    UpdateEdgeIntoAEL(ref e);        // 用延续边替换当前边
    if (e.OutIdx >= 0) AddOutPt(e, e.Bot);  // 记录拐点
    AddEdgeToSEL(e);                 // 水平边加入SEL
}
```

如果边到达了中间顶点且其延续边是水平的，在第一遍就处理（因为水平边需要在 `ProcessHorizontals` 之前加入 SEL）。

#### 普通边的 X 坐标更新

```csharp
else
{
    e.Curr.X = TopX(e, topY);
    e.Curr.Y = topY;
}
```

对于没有事件的普通边，简单地将其当前坐标更新到新的扫描线高度。

### 10.12.5 第二遍遍历详解

```csharp
e = m_ActiveEdges;
while (e != null)
{
    if (IsIntermediate(e, topY))
    {
        OutPt op = null;
        if (e.OutIdx >= 0) op = AddOutPt(e, e.Top);  // 记录中间顶点
        UpdateEdgeIntoAEL(ref e);                      // 用延续边替换

        // 检查与前驱边的共线连接
        TEdge ePrev = e.PrevInAEL;
        TEdge eNext = e.NextInAEL;
        if (ePrev != null && ePrev.Curr.X == e.Bot.X && ...)
        {
            OutPt op2 = AddOutPt(ePrev, e.Bot);
            AddJoin(op, op2, e.Top);
        }
        // 检查与后继边的共线连接
        else if (eNext != null && eNext.Curr.X == e.Bot.X && ...)
        {
            OutPt op2 = AddOutPt(eNext, e.Bot);
            AddJoin(op, op2, e.Top);
        }
    }
    e = e.NextInAEL;
}
```

**中间顶点处理流程**：

```
  中间顶点处理示意图：

  替换前：                    替换后：
       延续边(NextInLML)           新的活动边
          ╱                          ╱
         ╱                          ╱
        ●  ← 中间顶点             ●  ← e.Bot (原来的 Top)
       ╱                          │
      ╱                           │ (已从AEL移除)
     ╱ 当前边

  UpdateEdgeIntoAEL 将当前边替换为 NextInLML 指向的延续边
  e.Bot = 原边的 Top (中间顶点的坐标)
  e.Top = 延续边的 Top
```

---

## 10.13 DoMaxima — 局部最大值处理

### 10.13.1 完整源码

```csharp
private void DoMaxima(TEdge e)
{
    TEdge eMaxPair = GetMaximaPairEx(e);
    if (eMaxPair == null)
    {
        if (e.OutIdx >= 0) AddOutPt(e, e.Top);
        DeleteFromAEL(e);
        return;
    }

    TEdge eNext = e.NextInAEL;
    while (eNext != null && eNext != eMaxPair)
    {
        IntersectEdges(e, eNext, e.Top);
        SwapPositionsInAEL(e, eNext);
        eNext = e.NextInAEL;
    }

    if (e.OutIdx == Unassigned && eMaxPair.OutIdx == Unassigned)
    {
        DeleteFromAEL(e);
        DeleteFromAEL(eMaxPair);
    }
    else if (e.OutIdx >= 0 && eMaxPair.OutIdx >= 0)
    {
        if (e.OutIdx >= 0) AddLocalMaxPoly(e, eMaxPair, e.Top);
        DeleteFromAEL(e);
        DeleteFromAEL(eMaxPair);
    }
#if use_lines
    else if (e.WindDelta == 0)
    {
        if (e.OutIdx >= 0)
        {
            AddOutPt(e, e.Top);
            e.OutIdx = Unassigned;
        }
        DeleteFromAEL(e);
        if (eMaxPair.OutIdx >= 0)
        {
            AddOutPt(eMaxPair, e.Top);
            eMaxPair.OutIdx = Unassigned;
        }
        DeleteFromAEL(eMaxPair);
    }
#endif
    else throw new ClipperException("DoMaxima error");
}
```

### 10.13.2 逐段详解

#### 步骤一：查找配对边

```csharp
TEdge eMaxPair = GetMaximaPairEx(e);
if (eMaxPair == null)
{
    if (e.OutIdx >= 0) AddOutPt(e, e.Top);
    DeleteFromAEL(e);
    return;
}
```

如果找不到有效的配对边（退化情况），简单地添加顶点并删除当前边。

#### 步骤二：处理夹缝边

```csharp
TEdge eNext = e.NextInAEL;
while (eNext != null && eNext != eMaxPair)
{
    IntersectEdges(e, eNext, e.Top);
    SwapPositionsInAEL(e, eNext);
    eNext = e.NextInAEL;
}
```

如果 `e` 和 `eMaxPair` 之间存在其他边，需要处理这些交叉：

```
  DoMaxima 夹缝边处理示意图：

  处理前 AEL:
  ... ←→ [e] ←→ [夹缝边1] ←→ [夹缝边2] ←→ [eMaxPair] ←→ ...

  第1次循环: IntersectEdges(e, 夹缝边1, e.Top)
             SwapPositionsInAEL(e, 夹缝边1)
  AEL: ... ←→ [夹缝边1] ←→ [e] ←→ [夹缝边2] ←→ [eMaxPair] ←→ ...

  第2次循环: IntersectEdges(e, 夹缝边2, e.Top)
             SwapPositionsInAEL(e, 夹缝边2)
  AEL: ... ←→ [夹缝边1] ←→ [夹缝边2] ←→ [e] ←→ [eMaxPair] ←→ ...

  循环结束: e 和 eMaxPair 现在相邻
```

#### 步骤三：关闭多边形

```csharp
if (e.OutIdx == Unassigned && eMaxPair.OutIdx == Unassigned)
{
    // 两条边都没有输出 → 简单删除
    DeleteFromAEL(e);
    DeleteFromAEL(eMaxPair);
}
else if (e.OutIdx >= 0 && eMaxPair.OutIdx >= 0)
{
    // 两条边都有输出 → 创建局部最大值多边形
    if (e.OutIdx >= 0) AddLocalMaxPoly(e, eMaxPair, e.Top);
    DeleteFromAEL(e);
    DeleteFromAEL(eMaxPair);
}
```

| 情况 | `e.OutIdx` | `eMaxPair.OutIdx` | 操作 |
|:---:|:---:|:---:|:---|
| 1 | Unassigned | Unassigned | 直接删除两条边 |
| 2 | >= 0 | >= 0 | 调用 AddLocalMaxPoly 关闭多边形，然后删除 |
| 3 | WindDelta==0 | 任意 | 开放路径特殊处理（use_lines） |

---

## 10.14 完整实例：矩形交集追踪

下面我们通过一个完整的实例，追踪 Vatti 算法处理两个矩形交集的全过程。

### 10.14.1 输入数据

```
  Subject 矩形 A: (10, 10) → (50, 10) → (50, 50) → (10, 50)
  Clip 矩形 B:    (30, 20) → (70, 20) → (70, 60) → (30, 60)

  操作: Intersection（交集）
  填充规则: EvenOdd

  坐标平面图：

  Y=60  ┌──────────────────────┐
        │                      │
  Y=50  ├──────────┐ B(Clip)   │
        │ A(Subj)  │           │
        │    ┌─────┼───────────┤  ← 交集区域在 (30,20)-(50,50)
        │    │█████│           │
  Y=20  │    └─────┼───────────┘
        │          │
  Y=10  └──────────┘
       X=10  X=30  X=50       X=70
```

### 10.14.2 局部最小值

经过 `ClipperBase.AddPath()` 处理后，产生以下局部最小值：

| 序号 | Y 坐标 | LeftBound | RightBound | 类型 |
|:---:|:---:|:---|:---|:---:|
| LM1 | 10 | A 左边(10,10)→(10,50) | A 右边(50,10)→(50,50) | Subject |
| LM2 | 20 | B 左边(30,20)→(30,60) | B 右边(70,20)→(70,60) | Clip |

（注：矩形的水平底边会被拆分处理，此处为简化模型）

### 10.14.3 扫描束事件队列

初始扫描束队列：`{10, 20, 50, 60}`

### 10.14.4 步骤追踪

#### 步骤 1：botY = 10

**InsertLocalMinimaIntoAEL(10)**

弹出 LM1（Subject 矩形的底部）：

```
  lb = A左边(向上, X从10到10, Y从10到50)
  rb = A右边(向上, X从50到50, Y从10到50)

  操作:
  1. InsertEdgeIntoAEL(lb, null) → AEL: [lb]
  2. InsertEdgeIntoAEL(rb, lb)  → AEL: [lb] ←→ [rb]
  3. SetWindingCount(lb):
     - 向左找同类型边 → 无 (e == null)
     - lb.WindCnt = lb.WindDelta = 1
     - lb.WindCnt2 = 0
  4. rb.WindCnt = lb.WindCnt = 1
     rb.WindCnt2 = lb.WindCnt2 = 0
  5. IsContributing(lb):
     - pft = EvenOdd, WindCnt ok (通过第一阶段)
     - ClipType = Intersection, pft2 = EvenOdd
     - WindCnt2 == 0 → return false ← 不贡献!
     (因为此时 Clip 多边形还没有边在 AEL 中)
```

**AEL 状态（Y=10）**：

```
  AEL: [A_left, X=10, WC=1, WC2=0] ←→ [A_right, X=50, WC=1, WC2=0]
  扫描束: {20, 50, 60}
  输出多边形: (空)
```

#### 步骤 2：botY = 20

**InsertLocalMinimaIntoAEL(20)**

弹出 LM2（Clip 矩形的底部）：

```
  lb = B左边(向上, X从30到30, Y从20到60)
  rb = B右边(向上, X从70到70, Y从20到60)

  当前 AEL: [A_left, X=10] ←→ [A_right, X=50]

  操作:
  1. InsertEdgeIntoAEL(lb, null):
     - lb.Curr.X = 30, 在 A_left(X=10) 之后, A_right(X=50) 之前
     - AEL: [A_left] ←→ [B_left] ←→ [A_right]

  2. InsertEdgeIntoAEL(rb, lb):
     - rb.Curr.X = 70, 在 A_right(X=50) 之后
     - AEL: [A_left] ←→ [B_left] ←→ [A_right] ←→ [B_right]

  3. SetWindingCount(B_left):
     - 向左找同类型(Clip)边 → 无 (e == null)
     - B_left.WindCnt = B_left.WindDelta = 1
     - B_left.WindCnt2 = 0
     - 计算 WindCnt2: 从 AEL 头部遍历到 B_left
       - 经过 A_left (Subject, WindDelta=1): WindCnt2 += 1 = 1
     - B_left.WindCnt2 = 1

  4. B_right.WindCnt = B_left.WindCnt = 1
     B_right.WindCnt2 = B_left.WindCnt2 = 1

  5. IsContributing(B_left):
     - pft = EvenOdd (Clip 的填充规则)
     - 第一阶段: WindCnt = 1, 通过 EvenOdd 检查 ✓
     - ClipType = Intersection, pft2 = EvenOdd (Subject 的填充规则)
     - WindCnt2 = 1 != 0 → return true ← 贡献!

  6. Op1 = AddLocalMinPoly(B_left, B_right, (30,20))
     - 创建输出多边形，第一个点 (30,20)
```

但是等等——`lb` 和 `rb` 之间有 `A_right`！

```
  AEL: [A_left] ←→ [B_left] ←→ [A_right] ←→ [B_right]
                        lb          夹缝边!         rb

  lb.NextInAEL != rb → 需要处理夹缝边!

  IntersectEdges(rb=B_right, e=A_right, lb.Curr=(30,20))
  → 这会处理 B_right 与 A_right 在 (30,20) 处的虚拟交叉
```

**AEL 状态（Y=20）**：

```
  AEL: [A_left,X=10,WC=1,WC2=0] ←→ [B_left,X=30,WC=1,WC2=1]
       ←→ [A_right,X=50,WC=1,WC2=1] ←→ [B_right,X=70,WC=1,WC2=1]

  扫描束: {50, 60}
  输出多边形: OutRec0 含顶点 (30,20)
```

#### 步骤 3：ProcessIntersections 和 ProcessEdgesAtTopOfScanbeam

随着扫描线继续向上移动到 topY=50：

- A_left（垂直边 X=10）和 A_right（垂直边 X=50）到达它们的顶部
- 在 topY=50 处，`ProcessEdgesAtTopOfScanbeam(50)` 检测到：
  - A_left 和 A_right 是最大值边（`IsMaxima` 返回 true）
  - 调用 `DoMaxima` 处理

```
  Y=50 处理时的 AEL 和输出变化：

  输出多边形逐步积累的顶点:
  (30,20) → (50,20) → (50,50) → (30,50)

  这形成了交集区域：
  (30,20) ──→ (50,20)
     │                │
     │   交集区域     │
     │                │
  (30,50) ←── (50,50)
```

#### 步骤 4：完成（botY=50, topY=60）

最终 B_left 和 B_right 在 Y=60 处到达最大值，被从 AEL 移除。

**最终输出**：矩形 `[(30,20), (50,20), (50,50), (30,50)]`，即两个矩形的交集区域。

---

## 10.15 算法正确性保证

### 10.15.1 缠绕数不变量

Vatti 算法的正确性依赖于以下不变量：

1. **AEL 有序性**：AEL 中的边始终按当前扫描线高度的 X 坐标从左到右排序
2. **缠绕数一致性**：每条边的 `WindCnt` 和 `WindCnt2` 准确反映了从左边界到该边所穿越的边数
3. **扫描束完整性**：所有需要处理的 Y 坐标都被注册到扫描束队列中

### 10.15.2 为什么交叉处理在 InsertLocalMinimaIntoAEL 中发生

当新的局部最小值被插入 AEL 时，它的左右边界之间可能已经存在其他边。这些边与新插入的边在 `botY` 处"交叉"（虽然这是一个瞬时事件，不是真正的几何交叉），需要通过 `IntersectEdges` 来正确更新输出多边形。

```
  为什么需要处理夹缝边：

  场景: 两个三角形的并集

      A的左边    B的左边  B的右边    A的右边
         ╲       ╱        ╲       ╱
          ╲     ╱          ╲     ╱
           ╲   ╱            ╲   ╱
            ╲ ╱              ╲ ╱
             V ← A的最小值    V ← B的最小值 (同一Y)

  在 A 的最小值处，AEL 中:
  [A_left] ←→ [B_left] ←→ [B_right] ←→ [A_right]

  A_left 和 A_right 之间夹着 B 的两条边
  → 必须处理这些交叉以正确计算布尔运算结果
```

---

## 10.16 关键设计模式总结

### 10.16.1 事件驱动的扫描线

```
  ┌────────────┐     ┌────────────┐     ┌────────────┐
  │ 局部最小值  │     │ 边交叉      │     │ 局部最大值  │
  │ 事件       │     │ 事件        │     │ 事件       │
  │ (插入AEL)  │     │ (交换AEL)   │     │ (删除AEL)  │
  └──────┬─────┘     └──────┬─────┘     └──────┬─────┘
         │                  │                   │
         ▼                  ▼                   ▼
  ┌──────────────────────────────────────────────────┐
  │              Active Edge List (AEL)               │
  │            全局状态：边的有序集合                    │
  └──────────────────────────────────────────────────┘
         │                  │                   │
         ▼                  ▼                   ▼
  ┌──────────────────────────────────────────────────┐
  │           Output Polygon List                     │
  │           输出：多边形顶点环形链表                  │
  └──────────────────────────────────────────────────┘
```

### 10.16.2 缠绕数与贡献判断的分离

```
  SetWindingCount()          IsContributing()
       │                         │
       ▼                         ▼
  计算 WindCnt, WindCnt2    根据 WindCnt, WindCnt2
  (纯数学计算,             结合 ClipType 和 FillType
   与操作类型无关)          判断是否输出
```

这种分离设计使得：
- 缠绕数计算代码可以复用于所有布尔操作
- 添加新的布尔操作只需修改 `IsContributing()`
- 填充规则（EvenOdd / NonZero / Positive / Negative）独立于操作类型

### 10.16.3 环形双向链表的输出表示

```
  为什么使用环形双向链表？

  1. 从左侧边添加顶点（头部插入）: O(1)
  2. 从右侧边添加顶点（尾部插入）: O(1)
  3. 合并两个多边形（AppendPolygon）: O(1)
  4. 遍历所有顶点: O(n)，且不需要知道起始/结束位置
  5. 判断环的方向（顺/逆时针）: 通过面积符号
```

---

## 10.17 方法调用关系图

```
  ExecuteInternal()
  │
  ├─── InsertLocalMinimaIntoAEL(botY)
  │    ├─── PopLocalMinima()
  │    ├─── InsertEdgeIntoAEL()
  │    │    └─── E2InsertsBeforeE1()
  │    ├─── SetWindingCount()
  │    │    ├─── IsEvenOddFillType()
  │    │    └─── IsEvenOddAltFillType()
  │    ├─── IsContributing()
  │    ├─── AddOutPt()
  │    │    ├─── CreateOutRec()
  │    │    └─── SetHoleState()
  │    ├─── AddLocalMinPoly()
  │    │    ├─── AddOutPt()
  │    │    ├─── TopX()
  │    │    ├─── SlopesEqual()
  │    │    └─── AddJoin()
  │    ├─── InsertScanbeam()
  │    ├─── AddEdgeToSEL()
  │    ├─── HorzSegmentsOverlap()
  │    ├─── AddJoin()
  │    └─── IntersectEdges()
  │
  ├─── ProcessHorizontals()        ← 下一章详解
  │
  ├─── ProcessIntersections(topY)  ← 下一章详解
  │
  └─── ProcessEdgesAtTopOfScanbeam(topY)
       ├─── IsMaxima()
       ├─── GetMaximaPairEx()
       │    └─── GetMaximaPair()
       ├─── IsIntermediate()
       ├─── IsHorizontal()
       ├─── DoMaxima()
       │    ├─── GetMaximaPairEx()
       │    ├─── IntersectEdges()
       │    ├─── SwapPositionsInAEL()
       │    ├─── AddLocalMaxPoly()
       │    │    ├─── AddOutPt()
       │    │    └─── AppendPolygon()
       │    └─── DeleteFromAEL()
       ├─── InsertMaxima()
       ├─── UpdateEdgeIntoAEL()
       ├─── AddOutPt()
       ├─── AddEdgeToSEL()
       ├─── TopX()
       ├─── ProcessHorizontals()
       ├─── SlopesEqual()
       └─── AddJoin()
```

---

## 10.18 常见问题与陷阱

### 10.18.1 为什么 rb 直接继承 lb 的缠绕数？

在 `InsertLocalMinimaIntoAEL` 中：

```csharp
rb.WindCnt = lb.WindCnt;
rb.WindCnt2 = lb.WindCnt2;
```

这是因为在局部最小值处，`lb` 和 `rb` 是从同一个点展开的。在 AEL 中，`lb` 刚好在 `rb` 左边（或它们之间可能有夹缝边，但夹缝边属于不同类型或已处理）。对于同一个局部最小值的左右边界，它们"看到"的同类型边完全相同，因此缠绕数一致。

### 10.18.2 为什么 ProcessEdgesAtTopOfScanbeam 需要两遍遍历？

第一遍处理最大值和水平延续边，第二遍处理中间顶点。如果合并为一遍：
- 最大值处理会删除边，可能影响后续中间顶点的邻居关系
- 水平边需要先全部加入 SEL 再统一处理

### 10.18.3 DoMaxima 中为什么需要 SwapPositionsInAEL？

```csharp
while (eNext != null && eNext != eMaxPair)
{
    IntersectEdges(e, eNext, e.Top);
    SwapPositionsInAEL(e, eNext);    // ← 为什么需要交换？
    eNext = e.NextInAEL;
}
```

因为在最大值点处，边 `e` 需要"跨过"所有夹缝边到达其配对边 `eMaxPair`。每次交换后，`e` 向右移动一位，最终与 `eMaxPair` 相邻。交换操作同时保持了 AEL 的正确顺序。

---

## 10.19 性能考量

| 操作 | 时间复杂度 | 说明 |
|:---|:---:|:---|
| `InsertEdgeIntoAEL` | O(n) | n 为 AEL 中的边数 |
| `SetWindingCount` | O(n) | 需要遍历 AEL 中的部分边 |
| `IsContributing` | O(1) | 纯条件判断 |
| `AddOutPt` | O(1) | 环形链表插入 |
| `AddLocalMinPoly` | O(1) | 创建或追加 |
| `DoMaxima` | O(k) | k 为夹缝边数量 |
| `ProcessEdgesAtTopOfScanbeam` | O(n) | 两遍遍历 AEL |

整体算法的时间复杂度为 **O((n + k) log n)**，其中 n 为顶点总数，k 为交叉点数。

---

## 10.20 小结

本章深入剖析了 Vatti 裁剪算法在 Clipper 库中的核心实现，涵盖了以下关键方面：

1. **边状态分类**（`IsMinima`/`IsMaxima`/`IsIntermediate`）：理解边在不同扫描线高度的状态
2. **缠绕数计算**（`SetWindingCount`）：正确计算同类型和对侧类型的缠绕数
3. **贡献判断**（`IsContributing`）：根据缠绕数、填充规则和操作类型决定边是否贡献输出
4. **AEL 管理**（`InsertEdgeIntoAEL`/`E2InsertsBeforeE1`）：维护活动边表的有序性
5. **输出多边形构建**（`AddOutPt`/`AddLocalMinPoly`/`AddLocalMaxPoly`）：通过环形双向链表构建输出
6. **扫描束处理**（`InsertLocalMinimaIntoAEL`/`ProcessEdgesAtTopOfScanbeam`/`DoMaxima`）：驱动算法前进的核心方法

下一章将继续解读 `ProcessHorizontals`（水平边处理）和 `ProcessIntersections`（交叉处理）这两个同样重要的子算法。

---

> **版权声明**：Clipper 库源码版权归 Angus Johnson 所有（Clipper Library v6.4.2, Boost Software License）。本章的源码引用和解读仅用于教学目的。

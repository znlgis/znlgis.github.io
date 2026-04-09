---
layout: default
title: "第8章：ClipperBase 基类源码解读（下）— 扫描线与活动边表"
---

# 第8章：ClipperBase 基类源码解读（下）— 扫描线与活动边表

## 8.1 引言

在上一章中，我们详细分析了 `ClipperBase` 的前半部分——类声明、常量定义、边初始化、局部最小值查找、`ProcessBound` 边界处理以及 `AddPath` 的完整流程。这些内容解决了"如何将用户输入的多边形路径转化为 Clipper 内部数据结构"的问题。

本章（下篇）将聚焦于 `ClipperBase` 的后半部分（大约第 900 行至第 1359 行），涵盖以下核心主题：

| 主题 | 方法 | 职责 |
|:---|:---|:---|
| **斜率计算** | `SetDx`、`IsHorizontal`、`SlopesEqual`(×3) | 边的方向性计算与共线判断 |
| **几何测试** | `PointIsVertex`、`PointOnLineSegment`、`PointOnPolygon`、`Pt2IsBetweenPt1AndPt3` | 点与多边形的空间关系判断 |
| **扫描束管理** | `InsertScanbeam`、`PopScanbeam` | 维护扫描线事件的 Y 坐标有序队列 |
| **局部最小值管理** | `InsertLocalMinima`、`PopLocalMinima`、`LocalMinimaPending` | 局部最小值链表的增删查 |
| **活动边表操作** | `SwapPositionsInAEL`、`DeleteFromAEL`、`UpdateEdgeIntoAEL` | AEL 双向链表的核心操作 |
| **输出管理** | `CreateOutRec`、`DisposeOutRec` | 输出多边形记录的生命周期管理 |
| **重置与查询** | `Reset`、`GetBounds`、`ReverseHorizontal` | 状态重置、边界矩形计算、水平边修正 |

这些方法共同构成了扫描线算法的**运行时基础设施**——它们不是算法本身，而是算法运行所依赖的"地基"。

---

## 8.2 SetDx() — 逆斜率计算

### 8.2.1 源码

```csharp
private void SetDx(TEdge e)
{
    e.Delta.X = (e.Top.X - e.Bot.X);
    e.Delta.Y = (e.Top.Y - e.Bot.Y);
    if (e.Delta.Y == 0) e.Dx = horizontal;
    else e.Dx = (double)(e.Delta.X) / (e.Delta.Y);
}
```

### 8.2.2 详细解析

`SetDx` 计算一条边的**逆斜率**（inverse slope），即 `ΔX / ΔY`，而不是通常数学中的 `ΔY / ΔX`。这里的 `Delta` 是从 `Bot`（底部）到 `Top`（顶部）的向量。

**为什么使用逆斜率？**

在扫描线算法中，扫描线沿 Y 轴从下往上（Y 值从大到小）推进。对于每条活动边，我们需要知道"当 Y 变化 1 个单位时，X 变化多少"——这正是 `ΔX / ΔY` 的定义。

```
数学推导：

标准斜率：k = ΔY / ΔX  （"X 变化 1，Y 变化 k"）
逆斜率：  Dx = ΔX / ΔY  （"Y 变化 1，X 变化 Dx"）

在扫描线推进中：
  当前 X = Bot.X + (当前 Y - Bot.Y) × Dx
```

**特殊情况——水平边：**

```csharp
if (e.Delta.Y == 0) e.Dx = horizontal;  // horizontal = -3.4E+38
```

当 `Delta.Y == 0` 时，边是完全水平的，此时 `ΔX / ΔY` 会导致除零错误。Clipper 将其设为特殊的哨兵值 `horizontal`（`-3.4E+38`），后续通过 `IsHorizontal()` 方法检测。

**计算示例：**

```
边从 (10, 50) 到 (30, 10)：
  Delta.X = 30 - 10 = 20
  Delta.Y = 10 - 50 = -40
  Dx = 20 / (-40) = -0.5
  含义：Y 每减小 1，X 减小 0.5

边从 (0, 100) 到 (0, 0)：
  Delta.X = 0 - 0 = 0
  Delta.Y = 0 - 100 = -100
  Dx = 0 / (-100) = 0.0
  含义：垂直边，X 不随 Y 变化

边从 (10, 5) 到 (30, 5)：
  Delta.X = 30 - 10 = 20
  Delta.Y = 5 - 5 = 0
  Dx = horizontal（-3.4E+38）
  含义：水平边，特殊处理
```

> **注意**：`Delta` 的方向总是从 `Bot` 到 `Top`（Y 减小方向），因此 `Delta.Y` 对于非水平边总是**负数或零**。但由于 `Bot` 和 `Top` 是在 `InitEdge2` 中根据 Y 值确定的，`Top.Y <= Bot.Y`，所以 `Delta.Y = Top.Y - Bot.Y <= 0`。

---

## 8.3 IsHorizontal() — 水平边判断

### 8.3.1 源码

```csharp
internal static bool IsHorizontal(TEdge e)
{
    return e.Delta.Y == 0;
}
```

### 8.3.2 解析

判断一条边是否水平。注意这里**不是**通过检查 `e.Dx == horizontal` 来判断，而是直接检查 `Delta.Y == 0`。这两种方式在效果上等价（因为 `SetDx` 中当 `Delta.Y == 0` 时设置 `Dx = horizontal`），但检查整数比较（`Delta.Y == 0`）比浮点比较（`Dx == horizontal`）更可靠。

**为什么水平边需要特殊处理？**

在扫描线算法中，水平边是"退化"的情况：

1. 水平边不与任何扫描线"相交"于单一点——它与扫描线重合
2. 水平边没有明确的"上"和"下"——它完全处于同一 Y 坐标
3. 水平边的处理需要在扫描线到达其 Y 坐标时一次性完成

```
普通边与扫描线的关系：         水平边与扫描线的关系：

扫描线 ─────●─────────        扫描线 ════════════════
            │                         ●──────────●
            │                         （完全重合！）
            │
```

---

## 8.4 SlopesEqual() — 共线判断（三个重载）

`SlopesEqual` 是 Clipper 几何精度保障的核心方法之一，共有三个重载版本。

### 8.4.1 重载 1：两条边的斜率比较

```csharp
internal static bool SlopesEqual(TEdge e1, TEdge e2, bool UseFullRange)
{
    if (UseFullRange)
        return Int128.Int128Mul(e1.Delta.Y, e2.Delta.X) ==
            Int128.Int128Mul(e1.Delta.X, e2.Delta.Y);
    else return (cInt)(e1.Delta.Y) * (e2.Delta.X) ==
      (cInt)(e1.Delta.X) * (e2.Delta.Y);
}
```

**数学原理：**

两条线段平行（斜率相等）的条件是：

```
ΔY1 / ΔX1 == ΔY2 / ΔX2
```

为避免除法（可能导致除零或精度损失），等价变换为叉积形式：

```
ΔY1 × ΔX2 == ΔX1 × ΔY2
```

这是一个纯整数运算，完全精确，没有浮点误差。

### 8.4.2 重载 2：三个点的共线检查

```csharp
internal static bool SlopesEqual(IntPoint pt1, IntPoint pt2,
    IntPoint pt3, bool UseFullRange)
{
    if (UseFullRange)
        return Int128.Int128Mul(pt1.Y - pt2.Y, pt2.X - pt3.X) ==
          Int128.Int128Mul(pt1.X - pt2.X, pt2.Y - pt3.Y);
    else return
      (cInt)(pt1.Y - pt2.Y) * (pt2.X - pt3.X) - (cInt)(pt1.X - pt2.X) * (pt2.Y - pt3.Y) == 0;
}
```

检查三个点 `pt1`、`pt2`、`pt3` 是否共线。等价于检查向量 `(pt1→pt2)` 和 `(pt2→pt3)` 的叉积是否为零：

```
叉积 = (pt1.Y - pt2.Y) × (pt2.X - pt3.X) - (pt1.X - pt2.X) × (pt2.Y - pt3.Y)

如果叉积 = 0，则三点共线
```

> **注意**：标准精度版本使用 `- ... == 0` 的形式，而扩展精度版本使用 `== ...` 的形式。两者在数学上等价，但在代码实现上略有不同——标准精度版本将两个乘积直接相减再与零比较，而扩展精度版本（因为 `Int128` 不支持减法运算符？）使用等式比较。

### 8.4.3 重载 3：四个点的平行检查

```csharp
internal static bool SlopesEqual(IntPoint pt1, IntPoint pt2,
    IntPoint pt3, IntPoint pt4, bool UseFullRange)
{
    if (UseFullRange)
        return Int128.Int128Mul(pt1.Y - pt2.Y, pt3.X - pt4.X) ==
          Int128.Int128Mul(pt1.X - pt2.X, pt3.Y - pt4.Y);
    else return
      (cInt)(pt1.Y - pt2.Y) * (pt3.X - pt4.X) - (cInt)(pt1.X - pt2.X) * (pt3.Y - pt4.Y) == 0;
}
```

检查线段 `pt1→pt2` 与线段 `pt3→pt4` 是否平行。与重载 2 的原理相同——叉积为零表示平行。

### 8.4.4 精度保障机制

三个重载都遵循相同的精度策略：

| 模式 | 条件 | 乘法方式 | 中间结果范围 |
|:---|:---|:---|:---|
| 标准精度 | `UseFullRange == false` | 普通 `long` 乘法 | 最大约 4.6 × 10^18（在 `long` 范围内） |
| 扩展精度 | `UseFullRange == true` | `Int128.Int128Mul` | 最大约 8.5 × 10^37（需要 128 位） |

```
标准精度下的乘法安全分析：

坐标最大值 ≤ loRange = 0x3FFFFFFF ≈ 1.07 × 10^9
坐标差值最大 ≤ 2 × loRange ≈ 2.15 × 10^9
乘积最大 ≤ (2.15 × 10^9)^2 ≈ 4.6 × 10^18
long.MaxValue ≈ 9.2 × 10^18

4.6 × 10^18 < 9.2 × 10^18 ✓ 安全！

扩展精度下的乘法分析：

坐标最大值 ≤ hiRange ≈ 4.6 × 10^18
坐标差值最大 ≤ 2 × hiRange ≈ 9.2 × 10^18
乘积最大 ≤ (9.2 × 10^18)^2 ≈ 8.5 × 10^37
long.MaxValue ≈ 9.2 × 10^18

8.5 × 10^37 >> 9.2 × 10^18 ✗ 溢出！→ 需要 Int128
```

---

## 8.5 PointIsVertex() — 点是否为顶点

### 8.5.1 源码

```csharp
internal bool PointIsVertex(IntPoint pt, OutPt pp)
{
    OutPt pp2 = pp;
    do
    {
        if (pp2.Pt == pt) return true;
        pp2 = pp2.Next;
    }
    while (pp2 != pp);
    return false;
}
```

### 8.5.2 解析

遍历 `OutPt` 循环链表，检查给定点 `pt` 是否是某个顶点。`OutPt` 是输出多边形的顶点结构，形成**单向循环链表**。

```
OutPt 循环链表：

    pp → [A] → [B] → [C] → [D] → [A]（回到起点）
          │                         │
          └─────────────────────────┘

查找过程：
  pp2 = pp → 检查 A → 检查 B → 检查 C → 检查 D → pp2 == pp → 结束
```

**时间复杂度**：O(n)，其中 n 是多边形的顶点数。

---

## 8.6 PointOnLineSegment() — 点在线段上

### 8.6.1 源码

```csharp
internal bool PointOnLineSegment(IntPoint pt,
    IntPoint linePt1, IntPoint linePt2, bool UseFullRange)
{
    if (UseFullRange)
        return ((pt.X == linePt1.X) && (pt.Y == linePt1.Y)) ||
          ((pt.X == linePt2.X) && (pt.Y == linePt2.Y)) ||
          (((pt.X > linePt1.X) == (pt.X < linePt2.X)) &&
          ((pt.Y > linePt1.Y) == (pt.Y < linePt2.Y)) &&
          ((Int128.Int128Mul((pt.X - linePt1.X), (linePt2.Y - linePt1.Y)) ==
          Int128.Int128Mul((linePt2.X - linePt1.X), (pt.Y - linePt1.Y)))));
    else
        return ((pt.X == linePt1.X) && (pt.Y == linePt1.Y)) ||
          ((pt.X == linePt2.X) && (pt.Y == linePt2.Y)) ||
          (((pt.X > linePt1.X) == (pt.X < linePt2.X)) &&
          ((pt.Y > linePt1.Y) == (pt.Y < linePt2.Y)) &&
          ((pt.X - linePt1.X) * (linePt2.Y - linePt1.Y) ==
            (linePt2.X - linePt1.X) * (pt.Y - linePt1.Y)));
}
```

### 8.6.2 算法分解

判断点 `pt` 是否在线段 `linePt1→linePt2` 上，共三个条件（逻辑 OR）：

#### 条件 1 & 2：端点检查

```csharp
((pt.X == linePt1.X) && (pt.Y == linePt1.Y))   // pt 就是 linePt1
((pt.X == linePt2.X) && (pt.Y == linePt2.Y))   // pt 就是 linePt2
```

如果点恰好是线段的某个端点，直接返回 `true`。

#### 条件 3：介于两端点之间 + 共线

```csharp
(((pt.X > linePt1.X) == (pt.X < linePt2.X)) &&   // X 在两端之间
 ((pt.Y > linePt1.Y) == (pt.Y < linePt2.Y)) &&    // Y 在两端之间
 (叉积 == 0))                                       // 共线
```

**包围盒测试**：`(pt.X > linePt1.X) == (pt.X < linePt2.X)` 这个技巧判断 `pt.X` 是否严格在 `linePt1.X` 和 `linePt2.X` 之间（无论大小顺序）。这实际上是一个**开区间**的包围盒测试。

**共线测试**：叉积 `(pt.X - linePt1.X) × (linePt2.Y - linePt1.Y) == (linePt2.X - linePt1.X) × (pt.Y - linePt1.Y)` 检查向量 `(linePt1→pt)` 和 `(linePt1→linePt2)` 是否共线。

```
图示：

    linePt1 ●────────●──────● linePt2
                      pt
                      
    包围盒测试：pt.X 在 linePt1.X 和 linePt2.X 之间 ✓
                pt.Y 在 linePt1.Y 和 linePt2.Y 之间 ✓
    共线测试：  叉积 = 0 ✓
    结论：      pt 在线段上 ✓
```

---

## 8.7 PointOnPolygon() — 点在多边形边上

### 8.7.1 源码

```csharp
internal bool PointOnPolygon(IntPoint pt, OutPt pp, bool UseFullRange)
{
    OutPt pp2 = pp;
    while (true)
    {
        if (PointOnLineSegment(pt, pp2.Pt, pp2.Next.Pt, UseFullRange))
            return true;
        pp2 = pp2.Next;
        if (pp2 == pp) break;
    }
    return false;
}
```

### 8.7.2 解析

遍历 `OutPt` 循环链表的每一条边（从 `pp2.Pt` 到 `pp2.Next.Pt`），逐一调用 `PointOnLineSegment` 检查点是否在边上。

```
多边形边遍历：

    [A] → [B] → [C] → [D] → [A]

检查的边：A→B, B→C, C→D, D→A
对每条边调用 PointOnLineSegment(pt, edge.start, edge.end)
```

---

## 8.8 扫描束管理

扫描束（Scanbeam）是驱动整个 Vatti 扫描线算法的**事件队列**。它存储了所有需要处理的 Y 坐标值——在这些 Y 坐标上，可能会发生边的插入、删除、交叉等"事件"。

### 8.8.1 InsertScanbeam() — 插入扫描束

```csharp
internal void InsertScanbeam(cInt Y)
{
    //single-linked list: sorted descending, ignoring dups.
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
        while (sb2.Next != null && (Y <= sb2.Next.Y)) sb2 = sb2.Next;
        if (Y == sb2.Y) return; //ie ignores duplicates
        Scanbeam newSb = new Scanbeam();
        newSb.Y = Y;
        newSb.Next = sb2.Next;
        sb2.Next = newSb;
    }
}
```

#### 算法详解

`InsertScanbeam` 维护一个**按 Y 坐标降序排列**的单向链表，并自动去重。

**三种插入情况：**

| 情况 | 条件 | 操作 |
|:---|:---|:---|
| 空链表 | `m_Scanbeam == null` | 创建第一个节点 |
| 插入头部 | `Y > m_Scanbeam.Y` | 新节点成为链表头 |
| 插入中间或尾部 | 其他 | 遍历找到正确位置插入，跳过重复值 |

**图示：**

```
初始状态：
  m_Scanbeam → [Y=50] → [Y=30] → [Y=10] → null

插入 Y=40：
  遍历：50 > 40 → sb2 = [Y=50]
         sb2.Next.Y = 30, 40 > 30 → 停止
  插入：
  m_Scanbeam → [Y=50] → [Y=40] → [Y=30] → [Y=10] → null
                          ↑ 新插入

插入 Y=30（重复）：
  遍历：50 > 30 → sb2 = [Y=50]
         sb2.Next.Y = 40, 30 ≤ 40 → sb2 = [Y=40]
         sb2.Next.Y = 30, 30 ≤ 30 → sb2 = [Y=30]
  检查：Y == sb2.Y → 30 == 30 → 跳过重复！

插入 Y=60：
  60 > m_Scanbeam.Y(50) → 插入头部
  m_Scanbeam → [Y=60] → [Y=50] → [Y=40] → [Y=30] → [Y=10] → null
```

#### 扫描束数据结构示意图

```
m_Scanbeam
     │
     ▼
  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐
  │ Y=60 │───→│ Y=50 │───→│ Y=40 │───→│ Y=30 │───→│ Y=10 │───→ null
  └──────┘    └──────┘    └──────┘    └──────┘    └──────┘
  
  降序排列：60 > 50 > 40 > 30 > 10
  
  Pop 操作从头部取出最大 Y 值
  扫描线从 Y=60 开始，向 Y=10 方向推进（从下往上）
```

> **为什么降序排列？** 在 Clipper 的坐标系中，Y 轴向下为正。扫描线从最大 Y 值（最下方）开始，逐步向最小 Y 值（最上方）推进。降序排列使得 `Pop` 操作总是返回下一个要处理的（最大的）Y 坐标。

### 8.8.2 PopScanbeam() — 弹出扫描束

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

从链表头部弹出最大的 Y 值。这是一个标准的链表头部删除操作：

```
弹出前：
  m_Scanbeam → [Y=60] → [Y=50] → [Y=40] → ...

弹出后：
  Y = 60（输出参数）
  m_Scanbeam → [Y=50] → [Y=40] → ...
  返回 true

链表为空时：
  Y = 0
  返回 false
```

---

## 8.9 局部最小值管理

### 8.9.1 InsertLocalMinima() — 有序插入局部最小值

```csharp
private void InsertLocalMinima(LocalMinima newLm)
{
    if (m_MinimaList == null)
    {
        m_MinimaList = newLm;
    }
    else if (newLm.Y >= m_MinimaList.Y)
    {
        newLm.Next = m_MinimaList;
        m_MinimaList = newLm;
    }
    else
    {
        LocalMinima tmpLm = m_MinimaList;
        while (tmpLm.Next != null && (newLm.Y < tmpLm.Next.Y))
            tmpLm = tmpLm.Next;
        newLm.Next = tmpLm.Next;
        tmpLm.Next = newLm;
    }
}
```

#### 算法分析

与 `InsertScanbeam` 类似，`InsertLocalMinima` 也维护一个按 Y 坐标排序的单向链表，但排列顺序也是**降序**（Y 值最大的在头部）。注意与 `InsertScanbeam` 的一个重要区别：**不去重**——允许多个局部最小值拥有相同的 Y 坐标。

**三种情况：**

| 情况 | 条件 | 操作 |
|:---|:---|:---|
| 空链表 | `m_MinimaList == null` | 直接作为链表头 |
| 头部插入 | `newLm.Y >= m_MinimaList.Y` | 新节点成为链表头 |
| 中间/尾部插入 | 其他 | 遍历找到第一个 Y ≤ newLm.Y 的位置，插入其前方 |

**重要**：使用 `>=` 而非 `>` 进行头部插入判断，意味着相同 Y 值的新节点会被插入到**已有同 Y 值节点的前面**（LIFO 顺序）。

```
示例：依次插入 Y=30, Y=50, Y=30

步骤 1：插入 Y=30
  m_MinimaList → [Y=30] → null

步骤 2：插入 Y=50（50 >= 30 → 头部插入）
  m_MinimaList → [Y=50] → [Y=30] → null

步骤 3：插入 Y=30
  遍历：tmpLm = [Y=50]
         tmpLm.Next.Y = 30, newLm.Y(30) < 30? 否 → 停止
  插入到 [Y=50] 之后：
  m_MinimaList → [Y=50] → [Y=30(新)] → [Y=30(旧)] → null
```

### 8.9.2 PopLocalMinima() — 弹出当前局部最小值

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

**注意**：这个方法与 `PopScanbeam` 不同——它只在当前局部最小值的 Y 坐标**等于**给定的 Y 值时才"弹出"（实际上是将指针前移）。

**使用方式**：在扫描线推进到某个 Y 坐标时，反复调用 `PopLocalMinima(Y, ...)` 来获取该 Y 坐标处的所有局部最小值：

```csharp
// 典型调用模式（在 Clipper.ExecuteInternal 中）：
LocalMinima lm;
while (PopLocalMinima(botY, out lm))
{
    // 处理这个局部最小值——插入其左右边界到 AEL
    InsertLocalMinimaIntoAEL(botY);
}
```

```
链表状态：
  m_CurrentLM → [Y=50] → [Y=50] → [Y=30] → [Y=10] → null

调用 PopLocalMinima(50, out lm)：
  current = [Y=50]（第一个）, m_CurrentLM → [Y=50]（第二个）
  返回 true, lm = 第一个 [Y=50]

再次调用 PopLocalMinima(50, out lm)：
  current = [Y=50]（第二个）, m_CurrentLM → [Y=30]
  返回 true, lm = 第二个 [Y=50]

再次调用 PopLocalMinima(50, out lm)：
  current = [Y=30], Y != 50
  返回 false（Y=50 处的局部最小值已全部弹出）
```

### 8.9.3 LocalMinimaPending() — 检查是否还有待处理的局部最小值

```csharp
internal Boolean LocalMinimaPending()
{
    return (m_CurrentLM != null);
}
```

简单地检查 `m_CurrentLM` 是否为 `null`。当所有局部最小值都已处理完毕时返回 `false`。

---

## 8.10 活动边表（AEL）管理

活动边表（Active Edge List，AEL）是扫描线算法的核心数据结构之一。它是一个**双向链表**，包含当前扫描线所穿过的所有边，按 X 坐标排序。

### 8.10.1 AEL 的双向链表结构

```
m_ActiveEdges（链表头）
     │
     ▼
  ┌──────┐         ┌──────┐         ┌──────┐         ┌──────┐
  │ E_a  │ ⟷ │ E_b  │ ⟷ │ E_c  │ ⟷ │ E_d  │
  │ X=10 │         │ X=25 │         │ X=40 │         │ X=60 │
  └──────┘         └──────┘         └──────┘         └──────┘
  PrevInAEL=null   PrevInAEL=E_a   PrevInAEL=E_b   PrevInAEL=E_c
  NextInAEL=E_b    NextInAEL=E_c   NextInAEL=E_d   NextInAEL=null

  按 X 坐标从左到右排序
```

每个 `TEdge` 节点通过两个指针参与 AEL：
- `PrevInAEL`：指向左边的边
- `NextInAEL`：指向右边的边

### 8.10.2 SwapPositionsInAEL() — 交换两条边的位置

```csharp
internal void SwapPositionsInAEL(TEdge edge1, TEdge edge2)
{
    //check that one or other edge hasn't already been removed from AEL ...
    if (edge1.NextInAEL == edge1.PrevInAEL ||
      edge2.NextInAEL == edge2.PrevInAEL) return;

    if (edge1.NextInAEL == edge2)
    {
        TEdge next = edge2.NextInAEL;
        if (next != null)
            next.PrevInAEL = edge1;
        TEdge prev = edge1.PrevInAEL;
        if (prev != null)
            prev.NextInAEL = edge2;
        edge2.PrevInAEL = prev;
        edge2.NextInAEL = edge1;
        edge1.PrevInAEL = edge2;
        edge1.NextInAEL = next;
    }
    else if (edge2.NextInAEL == edge1)
    {
        TEdge next = edge1.NextInAEL;
        if (next != null)
            next.PrevInAEL = edge2;
        TEdge prev = edge2.PrevInAEL;
        if (prev != null)
            prev.NextInAEL = edge1;
        edge1.PrevInAEL = prev;
        edge1.NextInAEL = edge2;
        edge2.PrevInAEL = edge1;
        edge2.NextInAEL = next;
    }
    else
    {
        TEdge next = edge1.NextInAEL;
        TEdge prev = edge1.PrevInAEL;
        edge1.NextInAEL = edge2.NextInAEL;
        if (edge1.NextInAEL != null)
            edge1.NextInAEL.PrevInAEL = edge1;
        edge1.PrevInAEL = edge2.PrevInAEL;
        if (edge1.PrevInAEL != null)
            edge1.PrevInAEL.NextInAEL = edge1;
        edge2.NextInAEL = next;
        if (edge2.NextInAEL != null)
            edge2.NextInAEL.PrevInAEL = edge2;
        edge2.PrevInAEL = prev;
        if (edge2.PrevInAEL != null)
            edge2.PrevInAEL.NextInAEL = edge2;
    }

    if (edge1.PrevInAEL == null)
        m_ActiveEdges = edge1;
    else if (edge2.PrevInAEL == null)
        m_ActiveEdges = edge2;
}
```

#### 安全检查

```csharp
if (edge1.NextInAEL == edge1.PrevInAEL ||
  edge2.NextInAEL == edge2.PrevInAEL) return;
```

如果某条边的 `NextInAEL` 和 `PrevInAEL` 相同，说明它已经从 AEL 中被移除（或者是异常状态），直接返回。

#### 情况 1：edge1 和 edge2 相邻（edge1 在前）

```csharp
if (edge1.NextInAEL == edge2)
```

```
交换前：
  ... ⟷ [prev] ⟷ [edge1] ⟷ [edge2] ⟷ [next] ⟷ ...

交换后：
  ... ⟷ [prev] ⟷ [edge2] ⟷ [edge1] ⟷ [next] ⟷ ...

指针变更：
  next.PrevInAEL = edge1        （原来是 edge2）
  prev.NextInAEL = edge2        （原来是 edge1）
  edge2.PrevInAEL = prev        （原来是 edge1）
  edge2.NextInAEL = edge1       （原来是 next）
  edge1.PrevInAEL = edge2       （原来是 prev）
  edge1.NextInAEL = next        （原来是 edge2）
```

#### 情况 2：edge1 和 edge2 相邻（edge2 在前）

```csharp
else if (edge2.NextInAEL == edge1)
```

与情况 1 对称，edge2 在 edge1 的左边。

#### 情况 3：edge1 和 edge2 不相邻

```csharp
else
```

```
交换前：
  ... ⟷ [prevA] ⟷ [edge1] ⟷ [nextA] ⟷ ... ⟷ [prevB] ⟷ [edge2] ⟷ [nextB] ⟷ ...

交换后：
  ... ⟷ [prevA] ⟷ [edge2] ⟷ [nextA] ⟷ ... ⟷ [prevB] ⟷ [edge1] ⟷ [nextB] ⟷ ...

操作步骤：
  1. 保存 edge1 的邻居：next = edge1.NextInAEL, prev = edge1.PrevInAEL
  2. 把 edge1 移到 edge2 的位置：
     edge1.NextInAEL = edge2.NextInAEL
     edge1.PrevInAEL = edge2.PrevInAEL
     更新 edge1 新邻居的反向指针
  3. 把 edge2 移到 edge1 原来的位置：
     edge2.NextInAEL = next
     edge2.PrevInAEL = prev
     更新 edge2 新邻居的反向指针
```

#### 更新链表头

```csharp
if (edge1.PrevInAEL == null)
    m_ActiveEdges = edge1;
else if (edge2.PrevInAEL == null)
    m_ActiveEdges = edge2;
```

如果交换后某条边变成了链表头（`PrevInAEL == null`），更新 `m_ActiveEdges` 指针。

#### 完整图示：三种情况

```
情况 1：相邻交换（edge1 → edge2）

  交换前：  [A] ⟷ [E1] ⟷ [E2] ⟷ [B]
  交换后：  [A] ⟷ [E2] ⟷ [E1] ⟷ [B]

情况 2：相邻交换（edge2 → edge1）

  交换前：  [A] ⟷ [E2] ⟷ [E1] ⟷ [B]
  交换后：  [A] ⟷ [E1] ⟷ [E2] ⟷ [B]

情况 3：非相邻交换

  交换前：  [A] ⟷ [E1] ⟷ [C] ⟷ [D] ⟷ [E2] ⟷ [B]
  交换后：  [A] ⟷ [E2] ⟷ [C] ⟷ [D] ⟷ [E1] ⟷ [B]
```

### 8.10.3 DeleteFromAEL() — 从活动边表删除

```csharp
internal void DeleteFromAEL(TEdge e)
{
    TEdge AelPrev = e.PrevInAEL;
    TEdge AelNext = e.NextInAEL;
    if (AelPrev == null && AelNext == null && (e != m_ActiveEdges))
        return; //already deleted
    if (AelPrev != null)
        AelPrev.NextInAEL = AelNext;
    else m_ActiveEdges = AelNext;
    if (AelNext != null)
        AelNext.PrevInAEL = AelPrev;
    e.NextInAEL = null;
    e.PrevInAEL = null;
}
```

#### 算法分析

从 AEL 中删除一条边。这是标准的双向链表节点删除操作。

**安全检查：**

```csharp
if (AelPrev == null && AelNext == null && (e != m_ActiveEdges))
    return; //already deleted
```

如果边的前驱和后继都是 `null`，且它不是链表头，则说明它已经被删除过了。这是一种**幂等性**保护——多次调用 `DeleteFromAEL` 不会出错。

**四种删除场景：**

```
场景 1：删除中间节点
  [A] ⟷ [E] ⟷ [B]  →  [A] ⟷ [B]
  A.NextInAEL = B
  B.PrevInAEL = A

场景 2：删除头节点
  [E] ⟷ [B] ⟷ [C]  →  [B] ⟷ [C]
  m_ActiveEdges = B
  B.PrevInAEL = null

场景 3：删除尾节点
  [A] ⟷ [E]  →  [A]
  A.NextInAEL = null

场景 4：删除唯一节点
  [E]  →  (空)
  m_ActiveEdges = null
```

删除后，被删除边的 `NextInAEL` 和 `PrevInAEL` 被设为 `null`，这既是清理操作，也是"已删除"的标记。

### 8.10.4 UpdateEdgeIntoAEL() — 更新活动边

```csharp
internal void UpdateEdgeIntoAEL(ref TEdge e)
{
    if (e.NextInLML == null)
        throw new ClipperException("UpdateEdgeIntoAEL: invalid call");
    TEdge AelPrev = e.PrevInAEL;
    TEdge AelNext = e.NextInAEL;
    e.NextInLML.OutIdx = e.OutIdx;
    if (AelPrev != null)
        AelPrev.NextInAEL = e.NextInLML;
    else m_ActiveEdges = e.NextInLML;
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

#### 什么时候需要"更新"边？

当扫描线推进到一条边的 `Top.Y` 坐标时，这条边到达了其顶部。如果这条边还有后续边（`NextInLML != null`），说明多边形在此处有一个"拐点"——边的方向发生了变化。此时需要用后续边替换当前边在 AEL 中的位置。

```
多边形拐点示意：

            ● Top of e
           ╱ ╲
          ╱   ╲ ← e.NextInLML（新方向）
    e ───╱     ╲
        ╱       ╲
       ● Bot     ● Top of NextInLML

当扫描线到达 e 的 Top 时：
  AEL 中的 e 被替换为 e.NextInLML
```

#### 执行流程

1. **验证**：确保 `NextInLML` 不为 `null`（否则这条边应该被删除而非更新）

2. **保存 AEL 位置**：记录当前边在 AEL 中的前驱和后继

3. **属性传递**：将当前边的关键属性复制到后续边
   - `OutIdx`：关联的输出多边形索引
   - `Side`：左侧/右侧标识
   - `WindDelta`、`WindCnt`、`WindCnt2`：绕数相关属性

4. **替换**：在 AEL 中用 `NextInLML` 替换当前边

5. **初始化新边**：
   - `Curr = Bot`：新边从底部开始
   - 恢复 AEL 链接

6. **注册扫描事件**：如果新边不是水平的，将其 `Top.Y` 插入扫描束，确保将来能处理到新边的顶部

```
AEL 中的替换过程：

替换前：
  ... ⟷ [AelPrev] ⟷ [e] ⟷ [AelNext] ⟷ ...
                        │
                        └── e.NextInLML = [newE]

替换后：
  ... ⟷ [AelPrev] ⟷ [newE] ⟷ [AelNext] ⟷ ...
                        │
                        ├── newE.OutIdx = e.OutIdx
                        ├── newE.Side = e.Side
                        ├── newE.WindDelta = e.WindDelta
                        └── newE.Curr = newE.Bot
```

---

## 8.11 输出多边形管理

### 8.11.1 CreateOutRec() — 创建输出记录

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

创建一个新的 `OutRec` 对象并添加到 `m_PolyOuts` 列表中。

**初始化详解：**

| 字段 | 初始值 | 说明 |
|:---|:---|:---|
| `Idx` | 先设为 `Unassigned`，后设为列表索引 | 最终值为此 `OutRec` 在 `m_PolyOuts` 中的位置 |
| `IsHole` | `false` | 是否是孔洞（稍后由算法确定） |
| `IsOpen` | `false` | 是否是开放路径的输出 |
| `FirstLeft` | `null` | 指向包含此多边形的外层多边形 |
| `Pts` | `null` | 输出顶点链表（尚未添加任何点） |
| `BottomPt` | `null` | 最底部的顶点（用于方向判断） |
| `PolyNode` | `null` | 对应的 `PolyNode` 节点（构建多边形树时使用） |

**注意**：`result.Idx` 被赋值了两次——先是 `Unassigned`（-1），然后是 `m_PolyOuts.Count - 1`。第一次赋值似乎多余，但可能是防御性编程的体现。

### 8.11.2 DisposeOutRec() — 释放输出记录

```csharp
internal void DisposeOutRec(int index)
{
    OutRec outRec = m_PolyOuts[index];
    outRec.Pts = null;
    outRec = null;
    m_PolyOuts[index] = null;
}
```

释放指定索引的输出记录：
1. 清除顶点链表引用（`Pts = null`），帮助 GC 回收顶点
2. 将局部变量设为 `null`（这步在 C# 中无实际效果）
3. 将列表中的引用设为 `null`

**注意**：此方法不会从 `m_PolyOuts` 列表中移除元素（不改变索引），只是将对应位置设为 `null`。这保持了其他 `OutRec` 的索引不变——因为很多 `TEdge` 通过 `OutIdx` 引用 `OutRec` 的索引。

---

## 8.12 ReverseHorizontal() — 水平边方向翻转

### 8.12.1 源码

```csharp
private void ReverseHorizontal(TEdge e)
{
    //swap horizontal edges' top and bottom x's so they follow the natural
    //progression of the bounds - ie so their xbots will align with the
    //adjoining lower edge. [Helpful in the ProcessHorizontal() method.]
    Swap(ref e.Top.X, ref e.Bot.X);
#if use_xyz
    Swap(ref e.Top.Z, ref e.Bot.Z);
#endif
}
```

### 8.12.2 解析

对于水平边，`Top.Y == Bot.Y`，因此交换 `Top.X` 和 `Bot.X` 不会改变边的几何形状——它只是改变了"哪个端点被视为 Top，哪个被视为 Bot"。

**为什么需要翻转？**

在 `ProcessBound` 中，我们需要确保水平边的 `Bot.X` 与其下方相邻边的 `Top.X` 对齐。这是因为在扫描线处理水平边时（`ProcessHorizontal`），算法假设水平边的 `Bot` 端是与边界链中前一条边相连的端点。

```
翻转前：
    水平边：Bot=(30,5), Top=(10,5)
    下方边的 Top=(10,5)
    Bot.X=30 ≠ 下方边.Top.X=10 → 不对齐！

翻转后：
    水平边：Bot=(10,5), Top=(30,5)
    下方边的 Top=(10,5)
    Bot.X=10 == 下方边.Top.X=10 → 对齐 ✓
```

---

## 8.13 Reset() — 状态重置

### 8.13.1 源码

```csharp
internal virtual void Reset()
{
    m_CurrentLM = m_MinimaList;
    if (m_CurrentLM == null) return; //ie nothing to process

    //reset all edges ...
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

### 8.13.2 详细分析

`Reset` 方法将 `ClipperBase` 的状态恢复到"准备执行"的状态。它被声明为 `virtual`，子类 `Clipper` 会重写它来清理额外的运行时状态。

**执行流程：**

1. **重置局部最小值指针**：`m_CurrentLM = m_MinimaList`，将"当前"指针回到链表头部

2. **重建扫描束**：清空现有的 `m_Scanbeam`，然后遍历所有局部最小值，将它们的 Y 坐标插入扫描束。这确保了每次执行裁剪操作时，扫描束都是从最新的局部最小值列表重建的。

3. **重置所有边的状态**：对每个局部最小值的左右边界：
   - `e.Curr = e.Bot`：将当前坐标重置为底部坐标（扫描从最低点开始）
   - `e.OutIdx = Unassigned`：取消与输出多边形的关联

4. **清空活动边表**：`m_ActiveEdges = null`

**使用场景**：

`Reset` 使得 `Clipper` 可以在不重新添加路径的情况下**多次执行裁剪操作**。用户可以：

```csharp
clipper.AddPath(subject, PolyType.ptSubject, true);
clipper.AddPath(clip, PolyType.ptClip, true);

// 第一次执行
clipper.Execute(ClipType.ctIntersection, solution1);

// 第二次执行（不同的裁剪类型，Reset 在 Execute 内部被调用）
clipper.Execute(ClipType.ctUnion, solution2);
```

---

## 8.14 GetBounds() — 计算边界矩形

### 8.14.1 源码

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
            if (paths[i][j].X < result.left) result.left = paths[i][j].X;
            else if (paths[i][j].X > result.right) result.right = paths[i][j].X;
            if (paths[i][j].Y < result.top) result.top = paths[i][j].Y;
            else if (paths[i][j].Y > result.bottom) result.bottom = paths[i][j].Y;
        }
    return result;
}
```

### 8.14.2 解析

这是一个 `static` 方法，计算一组路径的轴对齐包围盒（AABB）。

**算法流程：**

1. 跳过空路径，找到第一个非空路径
2. 如果所有路径都为空，返回 `(0,0,0,0)`
3. 用第一个有效点初始化结果矩形
4. 遍历所有路径的所有点，更新最小/最大的 X 和 Y 值

**注意坐标系**：`top` 对应最小 Y 值，`bottom` 对应最大 Y 值——这与屏幕坐标系（Y 向下增大）一致。

```
包围盒示例：

  paths = [[(10,20), (50,80), (30,10)],
           [(60,40), (90,60)]]

  result:
    left   = 10  (最小 X)
    right  = 90  (最大 X)
    top    = 10  (最小 Y)
    bottom = 80  (最大 Y)

       10        50   60        90
    10  ┌──────────────────────────┐
        │         ●                │
    20  │  ●                       │
        │                          │
    40  │                 ●        │
        │                          │
    60  │                      ●   │
        │                          │
    80  │         ●                │
        └──────────────────────────┘
```

---

## 8.15 数据结构协作关系全景图

在本章结束之前，让我们用一个全景图来展示 `ClipperBase` 中所有数据结构的协作关系：

```
                           ClipperBase 数据结构全景图
                           ═══════════════════════════

用户输入                    内部数据结构                    输出
─────────                  ────────────                   ──────

                       ┌─── m_MinimaList ───────────────────┐
Path[] ──AddPath──→    │  [LM_1]→[LM_2]→[LM_3]→null       │
                       │    │LeftBound  │RightBound         │
                       │    ▼           ▼                   │
                       │  [TEdge]     [TEdge]               │
                       │    │NextInLML  │NextInLML          │
                       │    ▼           ▼                   │
                       │  [TEdge]     [TEdge]               │
                       │    ...         ...                  │
                       │                                    │
                       │         ↓ Reset()                  │
                       │                                    │
                       │  m_Scanbeam                        │
                       │  [Y=80]→[Y=50]→[Y=30]→[Y=10]→null│
                       │                                    │
                       │         ↓ Execute()                │
                       │                                    │
                       │  m_ActiveEdges (AEL)               │
                       │  [E_a]⟷[E_b]⟷[E_c]⟷[E_d]        │
                       │    ↕         ↕                     │
                       │  SwapPositionsInAEL                │
                       │  DeleteFromAEL                     │
                       │  UpdateEdgeIntoAEL                 │
                       │                                    │
                       │  m_PolyOuts                        │
                       │  [OutRec_0] [OutRec_1] ...        │──→ 最终结果
                       │    │Pts                            │
                       │    ▼                               │
                       │  [OutPt]→[OutPt]→[OutPt]→...      │
                       └────────────────────────────────────┘
```

---

## 8.16 方法调用关系表

| 调用者 | 被调用方法 | 场景 |
|:---|:---|:---|
| `AddPath` | `RangeTest` | 每个顶点的范围检查 |
| `AddPath` | `InitEdge` | 第一阶段边初始化 |
| `AddPath` | `InitEdge2` | 第二阶段边初始化 |
| `AddPath` | `RemoveEdge` | 删除重复/共线的边 |
| `AddPath` | `SlopesEqual` | 共线点检测 |
| `AddPath` | `Pt2IsBetweenPt1AndPt3` | 尖刺检测 |
| `AddPath` | `FindNextLocMin` | 查找局部最小值 |
| `AddPath` | `ProcessBound` | 处理左右边界 |
| `AddPath` | `InsertLocalMinima` | 插入局部最小值到有序链表 |
| `InitEdge2` | `SetDx` | 计算逆斜率 |
| `ProcessBound` | `ReverseHorizontal` | 修正水平边方向 |
| `ProcessBound` | `InsertLocalMinima` | Skip 边产生新的局部最小值 |
| `Reset` | `InsertScanbeam` | 从局部最小值重建扫描束 |
| `UpdateEdgeIntoAEL` | `InsertScanbeam` | 为新边注册扫描事件 |
| `UpdateEdgeIntoAEL` | `IsHorizontal` | 判断新边是否水平 |
| `PointOnLineSegment` | `Int128.Int128Mul` | 扩展精度叉积 |
| `PointOnPolygon` | `PointOnLineSegment` | 逐边检查 |
| `CreateOutRec` | — | 创建新的输出记录 |
| `Clear` | `DisposeLocalMinimaList` | 清理局部最小值链表 |

---

## 8.17 本章小结

本章完成了对 `ClipperBase` 后半部分的详细分析。让我们回顾所有涵盖的内容：

### 核心方法分类

| 类别 | 方法 | 复杂度 | 重要性 |
|:---|:---|:---:|:---:|
| **斜率计算** | `SetDx` | O(1) | ★★★★★ |
| **斜率计算** | `IsHorizontal` | O(1) | ★★★★ |
| **共线判断** | `SlopesEqual` ×3 | O(1) | ★★★★★ |
| **几何测试** | `PointIsVertex` | O(n) | ★★★ |
| **几何测试** | `PointOnLineSegment` | O(1) | ★★★★ |
| **几何测试** | `PointOnPolygon` | O(n) | ★★★ |
| **几何测试** | `Pt2IsBetweenPt1AndPt3` | O(1) | ★★★ |
| **扫描束** | `InsertScanbeam` | O(n) | ★★★★★ |
| **扫描束** | `PopScanbeam` | O(1) | ★★★★★ |
| **局部最小值** | `InsertLocalMinima` | O(n) | ★★★★★ |
| **局部最小值** | `PopLocalMinima` | O(1) | ★★★★★ |
| **局部最小值** | `LocalMinimaPending` | O(1) | ★★★ |
| **AEL 操作** | `SwapPositionsInAEL` | O(1) | ★★★★★ |
| **AEL 操作** | `DeleteFromAEL` | O(1) | ★★★★★ |
| **AEL 操作** | `UpdateEdgeIntoAEL` | O(1)* | ★★★★★ |
| **输出管理** | `CreateOutRec` | O(1) | ★★★★ |
| **输出管理** | `DisposeOutRec` | O(1) | ★★★ |
| **状态管理** | `Reset` | O(m) | ★★★★ |
| **查询** | `GetBounds` | O(n) | ★★★ |
| **工具** | `ReverseHorizontal` | O(1) | ★★★ |

*`UpdateEdgeIntoAEL` 本身是 O(1)，但内部调用的 `InsertScanbeam` 是 O(n)。

### 设计模式总结

1. **哨兵值模式**：`horizontal`（-3.4E+38）、`Skip`（-2）、`Unassigned`（-1）——用特殊值标记特殊状态，避免额外的布尔标志
2. **渐进式精度升级**：`RangeTest` 自动检测并升级到 128 位精度，对用户透明
3. **叉积替代除法**：`SlopesEqual` 使用叉积比较避免浮点除法，保证精确性
4. **有序链表**：扫描束和局部最小值都使用插入排序维护有序性，适合逐步构建的场景
5. **双向链表**：AEL 使用双向链表支持高效的插入、删除和交换操作
6. **模板方法模式**：`ClipperBase` 提供基础设施，`Clipper`（子类）提供具体算法实现

### 第 7-8 章总览

经过上下两篇的详细分析，我们已经完整覆盖了 `ClipperBase` 的全部 812 行代码（第 547-1359 行）。`ClipperBase` 是连接"用户输入"和"Vatti 扫描线算法"的桥梁——它将原始的顶点坐标序列转化为算法可以高效处理的内部数据结构。

在下一章中，我们将进入真正的核心——`Clipper` 类的源码分析，看看这些精心准备的数据结构如何在 Vatti 扫描线算法中被驱动和操纵。

---

## 8.18 附录：ClipperBase 完整方法索引

| 行号范围 | 方法名 | 可见性 | 章节 |
|:---:|:---|:---:|:---:|
| 547-565 | 常量与字段声明 | — | 第 7 章 §7.2-7.3 |
| 576-579 | `PreserveCollinear` | public | 第 7 章 §7.4 |
| 582-587 | `Swap` | public | 第 7 章 §7.5 |
| 590-593 | `IsHorizontal` | internal static | 第 8 章 §8.3 |
| 596-604 | `PointIsVertex` | internal | 第 8 章 §8.5 |
| 607-623 | `PointOnLineSegment` | internal | 第 8 章 §8.6 |
| 626-636 | `PointOnPolygon` | internal | 第 8 章 §8.7 |
| 639-649 | `SlopesEqual`（重载 1） | internal static | 第 8 章 §8.4.1 |
| 652-661 | `SlopesEqual`（重载 2） | internal static | 第 8 章 §8.4.2 |
| 664-673 | `SlopesEqual`（重载 3） | internal static | 第 8 章 §8.4.3 |
| 676-682 | 构造函数 | internal | 第 7 章 §7.6 |
| 685-695 | `Clear` | public virtual | 第 7 章 §7.7 |
| 698-705 | `DisposeLocalMinimaList` | private | 第 7 章 §7.7 |
| 708-720 | `RangeTest` | private | 第 7 章 §7.8 |
| 723-729 | `InitEdge` | private | 第 7 章 §7.9 |
| 732-744 | `InitEdge2` | private | 第 7 章 §7.10 |
| 747-770 | `FindNextLocMin` | private | 第 7 章 §7.11 |
| 773-870 | `ProcessBound` | private | 第 7 章 §7.12 |
| 873-966 | `AddPath`（前半） | public | 第 7 章 §7.13 |
| 966-1064 | `AddPath`（后半） | public | 第 7 章 §7.13 |
| 1067-1073 | `AddPaths` | public | 第 7 章 §7.14 |
| 1076-1082 | `Pt2IsBetweenPt1AndPt3` | internal | 第 7 章 §7.15 |
| 1085-1092 | `RemoveEdge` | private | 第 7 章 §7.15 |
| 1095-1101 | `SetDx` | private | 第 8 章 §8.2 |
| 1104-1119 | `InsertLocalMinima` | private | 第 8 章 §8.9.1 |
| 1122-1131 | `PopLocalMinima` | internal | 第 8 章 §8.9.2 |
| 1134-1142 | `ReverseHorizontal` | private | 第 8 章 §8.12 |
| 1145-1173 | `Reset` | internal virtual | 第 8 章 §8.13 |
| 1176-1195 | `GetBounds` | public static | 第 8 章 §8.14 |
| 1198-1220 | `InsertScanbeam` | internal | 第 8 章 §8.8.1 |
| 1223-1233 | `PopScanbeam` | internal | 第 8 章 §8.8.2 |
| 1236-1239 | `LocalMinimaPending` | internal | 第 8 章 §8.9.3 |
| 1242-1254 | `CreateOutRec` | internal | 第 8 章 §8.11.1 |
| 1257-1262 | `DisposeOutRec` | internal | 第 8 章 §8.11.2 |
| 1265-1286 | `UpdateEdgeIntoAEL` | internal | 第 8 章 §8.10.4 |
| 1289-1341 | `SwapPositionsInAEL` | internal | 第 8 章 §8.10.2 |
| 1344-1356 | `DeleteFromAEL` | internal | 第 8 章 §8.10.3 |

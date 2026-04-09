---
layout: default
title: "第7章：ClipperBase 基类源码解读（上）— 初始化与边处理"
---

# 第7章：ClipperBase 基类源码解读（上）— 初始化与边处理

## 7.1 引言

在前面的章节中，我们已经深入分析了 Clipper1 的基础数据结构（`IntPoint`、`IntRect`）、128 位整数运算（`Int128`）、多边形树结构（`PolyNode`/`PolyTree`）、边结构（`TEdge`）以及各种辅助数据结构。这些内容构成了 Clipper 算法的"零件库"。而从本章开始，我们将进入整个 Clipper 库的**核心引擎**——`ClipperBase` 基类。

`ClipperBase` 是 `Clipper` 类的直接父类，它负责：

| 职责 | 说明 |
|:---|:---|
| **路径输入与预处理** | 接收用户输入的多边形路径，去除重复点和共线点 |
| **边链表构建** | 将顶点序列转化为 `TEdge` 双向循环链表 |
| **局部最小值提取** | 从边链表中识别出所有"局部最小值"点 |
| **扫描线事件生成** | 将局部最小值的 Y 坐标插入扫描束（Scanbeam） |
| **范围检测** | 动态判断坐标是否需要使用扩展精度（128 位整数运算） |
| **活动边表管理** | 提供活动边表（AEL）的增删改查基础设施 |

本章（上篇）聚焦于 `ClipperBase` 的**前半部分**（大约第 547 行至第 900 行），涵盖类声明、常量定义、成员字段、构造函数、清理方法、范围检测、边初始化、局部最小值查找、边界处理（`ProcessBound`）以及最关键的 `AddPath` 方法。

> **注意**：`ClipperBase` 中最复杂的方法是 `ProcessBound()` 和 `AddPath()`。本章将对这两个方法进行**逐行级别**的深度解析，配合大量 ASCII 图示说明。

---

## 7.2 类声明与常量定义

### 7.2.1 源码

```csharp
public class ClipperBase
{
    internal const double horizontal = -3.4E+38;
    internal const int Skip = -2;
    internal const int Unassigned = -1;
    internal const double tolerance = 1.0E-20;
    internal static bool near_zero(double val) { return (val > -tolerance) && (val < tolerance); }

#if use_int32
    public const cInt loRange = 0x7FFF;
    public const cInt hiRange = 0x7FFF;
#else
    public const cInt loRange = 0x3FFFFFFF;
    public const cInt hiRange = 0x3FFFFFFFFFFFFFFFL;
#endif
```

### 7.2.2 常量逐一解析

#### `horizontal = -3.4E+38`

这是一个**哨兵值**（sentinel value），用于标识水平边。在 `SetDx()` 方法中，当一条边的 `Delta.Y == 0` 时（即完全水平），其斜率 `Dx` 将被设置为此值。

为什么选择 `-3.4E+38`？

- `double` 类型的最大值约为 `1.7E+308`，所以 `-3.4E+38` 是一个极大的负数
- 它不会与任何正常的 `Dx` 值冲突
- 它是一个负数，因此在排序时水平边会被"特殊对待"
- 选择一个固定常量而非 `double.MinValue`，是为了方便在代码中通过 `==` 进行精确比较

```
正常边的 Dx 范围：大约在 -10^15 到 +10^15 之间
水平边的 Dx 值：  -3.4 × 10^38 （远超正常范围）

数值轴：
←─────────────────┬──────────────────────→
   -3.4E+38      正常 Dx 值范围
   (horizontal)
```

#### `Skip = -2`

边的 `OutIdx` 字段设为 `Skip` 时，表示该边应被跳过，不参与裁剪运算。这主要用于**开放路径**（open paths）的处理——开放路径的起始边和终止边需要被标记为 `Skip`，因为它们并非真正的"边界"。

#### `Unassigned = -1`

边的 `OutIdx` 初始值。表示该边尚未与任何输出多边形（`OutRec`）关联。在裁剪过程中，当边第一次产生输出点时，`OutIdx` 会被设为对应 `OutRec` 的索引。

#### `tolerance = 1.0E-20` 和 `near_zero()`

```csharp
internal const double tolerance = 1.0E-20;
internal static bool near_zero(double val) { return (val > -tolerance) && (val < tolerance); }
```

这是一个极小的容差值，用于浮点数的零值判断。`near_zero()` 函数判断一个 `double` 值是否"足够接近零"。注意这里使用的是**开区间**比较（`>` 和 `<`），而非闭区间。

在实际的 Clipper 代码中，由于坐标采用整数类型 `cInt`，浮点运算只出现在斜率 `Dx` 的计算和交点计算中。`near_zero()` 主要用于交点计算时的分母检查。

### 7.2.3 范围常量 `loRange` 与 `hiRange`

```csharp
#if use_int32
    public const cInt loRange = 0x7FFF;        // = 32,767
    public const cInt hiRange = 0x7FFF;        // = 32,767
#else
    public const cInt loRange = 0x3FFFFFFF;    // = 1,073,741,823（约 10.7 亿）
    public const cInt hiRange = 0x3FFFFFFFFFFFFFFFL; // = 4,611,686,018,427,387,903（约 4.6 × 10^18）
#endif
```

这两个常量定义了坐标值的**安全范围**，是 Clipper 精度保障机制的核心：

| 常量 | 64 位值 | 十进制近似值 | 含义 |
|:---:|:---:|:---:|:---|
| `loRange` | `0x3FFFFFFF` | ≈ 10.7 亿 | 标准精度的坐标上限 |
| `hiRange` | `0x3FFFFFFFFFFFFFFF` | ≈ 4.6 × 10^18 | 扩展精度的坐标上限 |

**为什么不是直接用 `long.MaxValue`？**

关键在于**中间计算的溢出风险**。在斜率比较（`SlopesEqual`）中，需要计算两个坐标差值的**叉积**：

```
dy1 * dx2 == dy2 * dx1
```

- 当坐标在 `loRange` 范围内时，`dy1` 和 `dx2` 各自不超过 `2 × loRange ≈ 2.1 × 10^9`，它们的乘积不超过 `4.4 × 10^18`，恰好在 `long` 的范围内（`long.MaxValue ≈ 9.2 × 10^18`）
- 当坐标超出 `loRange` 但在 `hiRange` 范围内时，中间乘积可能溢出 `long`，此时需要使用 `Int128` 进行 128 位乘法

```
坐标范围示意图：

0                    loRange              hiRange            long.MaxValue
├───────────────────────┼──────────────────────┼─────────────────────┤
│    标准精度区间        │   扩展精度区间        │    超出允许范围      │
│  (直接用 long 运算)    │  (使用 Int128 运算)   │    (抛出异常)        │
```

---

## 7.3 成员字段详解

### 7.3.1 源码

```csharp
internal LocalMinima m_MinimaList;
internal LocalMinima m_CurrentLM;
internal List<List<TEdge>> m_edges = new List<List<TEdge>>();
internal Scanbeam m_Scanbeam;
internal List<OutRec> m_PolyOuts;
internal TEdge m_ActiveEdges;
internal bool m_UseFullRange;
internal bool m_HasOpenPaths;
```

### 7.3.2 逐字段解析

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| `m_MinimaList` | `LocalMinima` | 局部最小值链表的**头指针**。所有路径的局部最小值按 Y 坐标**降序**排列（Y 值最大的在前）。这是一个单向链表，通过 `Next` 指针连接。 |
| `m_CurrentLM` | `LocalMinima` | 当前正在处理的局部最小值。在扫描线推进过程中，此指针从链表头部逐步向后移动。 |
| `m_edges` | `List<List<TEdge>>` | 所有路径的边数组。外层 `List` 的每个元素对应一条路径（一次 `AddPath` 调用），内层 `List` 包含该路径的所有 `TEdge` 对象。保存边数组是为了防止 GC 回收。 |
| `m_Scanbeam` | `Scanbeam` | 扫描束链表的头指针。按 Y 坐标**降序**排列的单向链表，存储所有需要处理的 Y 事件坐标。 |
| `m_PolyOuts` | `List<OutRec>` | 输出多边形记录列表。每个 `OutRec` 代表结果中的一个多边形环。 |
| `m_ActiveEdges` | `TEdge` | 活动边表（AEL）的头指针。AEL 是一个**双向链表**，包含当前扫描线与之相交的所有边，按 X 坐标排序。 |
| `m_UseFullRange` | `bool` | 是否需要使用扩展精度（128 位整数运算）。初始为 `false`，当检测到坐标超过 `loRange` 时自动切换为 `true`。 |
| `m_HasOpenPaths` | `bool` | 是否包含开放路径。影响后续裁剪算法中的 winding number 计算。 |

### 7.3.3 数据结构关系图

```
ClipperBase
├── m_MinimaList ──→ [LM_1] ──→ [LM_2] ──→ [LM_3] ──→ null
│                       ↑
│   m_CurrentLM ────────┘
│
├── m_edges ──→ [ [edge0, edge1, edge2, ...],     ← 路径 1 的所有边
│                 [edge0, edge1, edge2, ...],     ← 路径 2 的所有边
│                 ... ]
│
├── m_Scanbeam ──→ [Y=50] ──→ [Y=30] ──→ [Y=10] ──→ null
│                  (降序排列)
│
├── m_PolyOuts ──→ [ OutRec_0, OutRec_1, OutRec_2, ... ]
│
└── m_ActiveEdges ──→ E_a ⟷ E_b ⟷ E_c ⟷ E_d ──→ null
                     (双向链表，按 X 坐标排序)
```

---

## 7.4 PreserveCollinear 属性

```csharp
public bool PreserveCollinear
{
    get;
    set;
}
```

这是一个自动属性，控制是否保留共线点：

- **`false`（默认）**：在 `AddPath` 处理闭合路径时，相邻的共线边会被合并为一条边。例如三个共线点 A-B-C 中的中间点 B 会被移除。
- **`true`**：保留共线点，仅移除"尖刺"（spike），即 B 在 A 和 C 之间但方向发生反转的情况。

```
PreserveCollinear = false 时：
A ─── B ─── C   →   A ─────── C  （B 被移除）

PreserveCollinear = true 时：
A ─── B ─── C   →   A ─── B ─── C  （B 被保留）

但 "尖刺" 总是被移除：
A ─── C ─── B   →   A ─── B  （C 不在 A-B 之间，属于尖刺）
```

---

## 7.5 Swap 工具方法

```csharp
public void Swap(ref cInt val1, ref cInt val2)
{
    cInt tmp = val1;
    val1 = val2;
    val2 = tmp;
}
```

经典的三变量交换。使用 `ref` 参数实现原地交换两个 `cInt` 值。这个方法主要在 `ReverseHorizontal()` 中被调用，用于交换水平边的 `Top.X` 和 `Bot.X`。

---

## 7.6 构造函数

### 7.6.1 源码

```csharp
internal ClipperBase() //constructor (nb: no external instantiation)
{
    m_MinimaList = null;
    m_CurrentLM = null;
    m_UseFullRange = false;
    m_HasOpenPaths = false;
}
```

### 7.6.2 解析

构造函数被声明为 `internal`，这意味着：

- **不能从库外部直接实例化** `ClipperBase`
- 只能通过其子类 `Clipper` 来使用
- 这是一种典型的**模板方法模式**——`ClipperBase` 提供基础设施，`Clipper` 提供具体的裁剪算法实现

初始化内容：
1. 局部最小值链表头指针 → `null`（无路径已加载）
2. 当前局部最小值指针 → `null`
3. 扩展精度标志 → `false`（假定坐标在标准范围内）
4. 开放路径标志 → `false`

注意，`m_edges`、`m_Scanbeam`、`m_PolyOuts`、`m_ActiveEdges` 不在构造函数中初始化。`m_edges` 在字段声明时已初始化为空 `List`，而其余字段默认为 `null`，这些会在 `Reset()` 或执行阶段才被设置。

---

## 7.7 Clear() 与 DisposeLocalMinimaList()

### 7.7.1 Clear() 源码

```csharp
public virtual void Clear()
{
    DisposeLocalMinimaList();
    for (int i = 0; i < m_edges.Count; ++i)
    {
        for (int j = 0; j < m_edges[i].Count; ++j) m_edges[i][j] = null;
        m_edges[i].Clear();
    }
    m_edges.Clear();
    m_UseFullRange = false;
    m_HasOpenPaths = false;
}
```

`Clear()` 被声明为 `virtual`，子类 `Clipper` 会重写它来清理额外的资源。

**执行流程：**

1. **释放局部最小值链表**：调用 `DisposeLocalMinimaList()`
2. **释放所有边对象**：
   - 外层循环遍历每条路径
   - 内层循环将每个 `TEdge` 引用设为 `null`（帮助 GC）
   - 清空内层 `List`
   - 清空外层 `List`
3. **重置标志位**：`m_UseFullRange` 和 `m_HasOpenPaths` 恢复为 `false`

### 7.7.2 DisposeLocalMinimaList() 源码

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

逐节点释放局部最小值链表。在 C# 中这并非严格必要（GC 会自动回收），但将引用显式设为 `null` 可以加速 GC 回收，特别是在处理大量多边形时。

**执行示意：**

```
初始状态：
m_MinimaList → [LM_1] → [LM_2] → [LM_3] → null

第 1 轮：tmpLm = LM_2, m_MinimaList = null, m_MinimaList = LM_2
m_MinimaList → [LM_2] → [LM_3] → null

第 2 轮：tmpLm = LM_3, m_MinimaList = null, m_MinimaList = LM_3
m_MinimaList → [LM_3] → null

第 3 轮：tmpLm = null, m_MinimaList = null, m_MinimaList = null
m_MinimaList → null

最后：m_CurrentLM = null
```

---

## 7.8 RangeTest() — 动态范围检测

### 7.8.1 源码

```csharp
void RangeTest(IntPoint Pt, ref bool useFullRange)
{
    if (useFullRange)
    {
        if (Pt.X > hiRange || Pt.Y > hiRange || -Pt.X > hiRange || -Pt.Y > hiRange)
            throw new ClipperException("Coordinate outside allowed range");
    }
    else if (Pt.X > loRange || Pt.Y > loRange || -Pt.X > loRange || -Pt.Y > loRange)
    {
        useFullRange = true;
        RangeTest(Pt, ref useFullRange);
    }
}
```

### 7.8.2 算法分析

`RangeTest` 是 Clipper 精度自适应机制的核心。它对每个输入坐标点进行范围检查：

**流程图：**

```
                     输入点 (X, Y)
                          │
                ┌─────────▼──────────┐
                │  useFullRange == ?  │
                └────┬──────────┬────┘
                     │ true     │ false
              ┌──────▼──────┐ ┌─▼───────────────────┐
              │ |X| 或 |Y|  │ │ |X| 或 |Y|          │
              │ > hiRange ? │ │ > loRange ?          │
              └───┬─────┬───┘ └───┬──────────┬───────┘
                  │yes  │no       │yes       │no
           ┌──────▼──┐  │    ┌───▼────────┐  │
           │ 抛出异常 │  │    │useFullRange│  │
           │ 坐标超限 │  │    │  = true    │  │
           └─────────┘  │    │ 递归调用    │  │
                        │    │ RangeTest   │  │
                    通过 ✓    └────────────┘  通过 ✓
```

**关键设计思想：**

1. **两级范围检查**：先检查 `loRange`，若超出则升级到 `hiRange`
2. **渐进式升级**：`useFullRange` 是通过 `ref` 传递的，一旦被设为 `true`，后续所有操作都会使用 128 位精度
3. **递归检查**：升级后立即递归调用自身，确保在 `hiRange` 级别也通过检查
4. **绝对值检查**：通过分别检查 `-Pt.X > hiRange` 来处理负坐标，避免了调用 `Math.Abs` 的开销
5. **不可逆升级**：一旦升级到扩展精度，就不会降级回来——这是因为后续的 `SlopesEqual` 等方法需要全局一致的精度模式

---

## 7.9 InitEdge() — 边的第一阶段初始化

### 7.9.1 源码

```csharp
private void InitEdge(TEdge e, TEdge eNext, TEdge ePrev, IntPoint pt)
{
    e.Next = eNext;
    e.Prev = ePrev;
    e.Curr = pt;
    e.OutIdx = Unassigned;
}
```

### 7.9.2 解析

`InitEdge` 负责建立 `TEdge` 节点之间的**双向循环链表**关系：

- `e.Next`：指向下一个边
- `e.Prev`：指向上一个边
- `e.Curr`：当前顶点坐标
- `e.OutIdx`：初始化为 `Unassigned`（-1），表示尚未关联到任何输出多边形

**注意**：此阶段尚未设置 `Bot`、`Top`、`Dx`、`PolyTyp` 等属性，这些在 `InitEdge2` 中完成。

### 7.9.3 从顶点到边链表的映射

假设有一个四边形 ABCD：

```
输入顶点序列：[A, B, C, D]

创建 4 个 TEdge 节点 e0, e1, e2, e3：

InitEdge(e0, e1, e3, A)  →  e0.Curr=A, e0.Next=e1, e0.Prev=e3
InitEdge(e3, e0, e2, D)  →  e3.Curr=D, e3.Next=e0, e3.Prev=e2
InitEdge(e2, e3, e1, C)  →  e2.Curr=C, e2.Next=e3, e2.Prev=e1
InitEdge(e1, e2, e0, B)  →  e1.Curr=B, e1.Next=e2, e1.Prev=e0

形成双向循环链表：

    ┌──────────────────────────────────────────┐
    │                                          │
    ▼                                          │
  [e0:A] ⟷ [e1:B] ⟷ [e2:C] ⟷ [e3:D] ────────┘
    │                                          ▲
    └──────────────────────────────────────────┘

每条 TEdge 代表从 e.Curr 到 e.Next.Curr 的一条边：
  e0: A→B
  e1: B→C
  e2: C→D
  e3: D→A
```

> **重要**：在 `AddPath` 的代码中，初始化顺序是先初始化 `edges[0]` 和 `edges[highI]`，然后从 `highI-1` 逆序到 `1`。这确保了循环链表的正确连接。

---

## 7.10 InitEdge2() — 边的第二阶段初始化

### 7.10.1 源码

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

### 7.10.2 解析

`InitEdge2` 完成边的**方向性初始化**，为每条边确定 `Bot`（底部）和 `Top`（顶部）：

**关键规则**：在 Clipper 的坐标系中，Y 值**越大越靠下**（屏幕坐标系）。因此：

```
如果 e.Curr.Y >= e.Next.Curr.Y：
    e.Curr 在下方 → Bot = e.Curr
    e.Next.Curr 在上方 → Top = e.Next.Curr
    ┌─── 边的方向：从下（Bot）到上（Top）

否则：
    e.Curr 在上方 → Top = e.Curr
    e.Next.Curr 在下方 → Bot = e.Next.Curr
```

**图示：**

```
情况 1: e.Curr.Y >= e.Next.Curr.Y
（当前点在下方或同一水平线）

    Top = e.Next.Curr ●
                      │  ↑ 边的方向
                      │
    Bot = e.Curr      ●

情况 2: e.Curr.Y < e.Next.Curr.Y
（当前点在上方）

    Top = e.Curr      ●
                      │  ↑ 边的方向
                      │
    Bot = e.Next.Curr ●
```

接下来调用 `SetDx(e)` 计算斜率，最后设置 `PolyTyp`（`ptSubject` 或 `ptClip`）。

> **注意**：`Bot` 和 `Top` 的确定与边在链表中的遍历方向无关——它们**总是**按照 Y 坐标大小决定。这对后续的扫描线处理至关重要。

---

## 7.11 FindNextLocMin() — 查找下一个局部最小值

### 7.11.1 源码

```csharp
private TEdge FindNextLocMin(TEdge E)
{
    TEdge E2;
    for (; ; )
    {
        while (E.Bot != E.Prev.Bot || E.Curr == E.Top) E = E.Next;
        if (E.Dx != horizontal && E.Prev.Dx != horizontal) break;
        while (E.Prev.Dx == horizontal) E = E.Prev;
        E2 = E;
        while (E.Dx == horizontal) E = E.Next;
        if (E.Top.Y == E.Prev.Bot.Y) continue; //ie just an intermediate horz.
        if (E2.Prev.Bot.X < E.Bot.X) E = E2;
        break;
    }
    return E;
}
```

### 7.11.2 什么是局部最小值？

在扫描线算法中，**局部最小值**（Local Minimum）是多边形轮廓上一个特殊的顶点——从这个顶点出发，两侧的边都是向上（Y 减小方向）延伸的。换句话说，它是一个"V"形谷底。

```
几何示意：

          ╲        ╱
           ╲      ╱
            ╲    ╱
             ╲  ╱         两条边都向上延伸
              ╲╱
              LM          ← 局部最小值点（Y 值最大，最靠下）
```

在 `TEdge` 链表的上下文中，局部最小值的特征是：

- 边 `E` 的底部（`Bot`）不等于前一条边的底部（`E.Prev.Bot`）
- 并且 `E.Curr != E.Top`（即 `E` 不是"向上走"的边）

### 7.11.3 算法逐步解析

**第一个 while 循环：**

```csharp
while (E.Bot != E.Prev.Bot || E.Curr == E.Top) E = E.Next;
```

跳过所有不是局部最小值的边：
- `E.Bot != E.Prev.Bot`：如果相邻两条边不共享底部顶点，则不是局部最小值
- `E.Curr == E.Top`：如果当前顶点就是边的顶部，说明这条边在向上走（当前点在上方），还没到谷底

**水平边处理：**

当找到一个可能的局部最小值后，需要检查它是否涉及水平边。水平边会使局部最小值的判断变得复杂：

```csharp
if (E.Dx != horizontal && E.Prev.Dx != horizontal) break;
```

如果当前边和前一条边都不是水平的，那就直接确认为局部最小值。

```csharp
while (E.Prev.Dx == horizontal) E = E.Prev;
E2 = E;
while (E.Dx == horizontal) E = E.Next;
```

如果涉及水平边，算法会先回溯到水平序列的左端（`E2`），再前进到水平序列的右端（`E`）。

```csharp
if (E.Top.Y == E.Prev.Bot.Y) continue; //ie just an intermediate horz.
```

如果水平边序列只是连接两个等高点的"中间过渡"，则不是真正的局部最小值，继续搜索。

```csharp
if (E2.Prev.Bot.X < E.Bot.X) E = E2;
```

在有效的水平边局部最小值中，选择 X 坐标更小的端点作为起始（**左对齐原则**）。

**图示：水平边序列中的局部最小值**

```
情况 1：简单局部最小值（无水平边）

    ╲      ╱
     ╲    ╱
      ╲  ╱
       ╲╱
       E          FindNextLocMin 返回 E

情况 2：带水平边的局部最小值

    ╲              ╱
     ╲            ╱
      ╲   horz   ╱
       ●────────●
      E2        E

    如果 E2.Prev.Bot.X < E.Bot.X，返回 E2（左对齐）

情况 3：中间水平（不是局部最小值）

           ╱
      horz╱
    ●────●
    │
    │             这只是边上的一个水平段，
    ↓             不是真正的局部最小值
                  → continue 继续搜索
```

---

## 7.12 ProcessBound() — 边界处理（核心复杂方法）

### 7.12.1 源码

```csharp
private TEdge ProcessBound(TEdge E, bool LeftBoundIsForward)
{
    TEdge EStart, Result = E;
    TEdge Horz;

    if (Result.OutIdx == Skip)
    {
        //check if there are edges beyond the skip edge in the bound and if so
        //create another LocMin and calling ProcessBound once more ...
        E = Result;
        if (LeftBoundIsForward)
        {
            while (E.Top.Y == E.Next.Bot.Y) E = E.Next;
            while (E != Result && E.Dx == horizontal) E = E.Prev;
        }
        else
        {
            while (E.Top.Y == E.Prev.Bot.Y) E = E.Prev;
            while (E != Result && E.Dx == horizontal) E = E.Next;
        }
        if (E == Result)
        {
            if (LeftBoundIsForward) Result = E.Next;
            else Result = E.Prev;
        }
        else
        {
            //there are more edges in the bound beyond result starting with E
            if (LeftBoundIsForward)
                E = Result.Next;
            else
                E = Result.Prev;
            LocalMinima locMin = new LocalMinima();
            locMin.Next = null;
            locMin.Y = E.Bot.Y;
            locMin.LeftBound = null;
            locMin.RightBound = E;
            E.WindDelta = 0;
            Result = ProcessBound(E, LeftBoundIsForward);
            InsertLocalMinima(locMin);
        }
        return Result;
    }

    if (E.Dx == horizontal)
    {
        //We need to be careful with open paths because this may not be a
        //true local minima (ie E may be following a skip edge).
        //Also, consecutive horz. edges may start heading left before going right.
        if (LeftBoundIsForward) EStart = E.Prev;
        else EStart = E.Next;
        if (EStart.Dx == horizontal) //ie an adjoining horizontal skip edge
        {
            if (EStart.Bot.X != E.Bot.X && EStart.Top.X != E.Bot.X)
                ReverseHorizontal(E);
        }
        else if (EStart.Bot.X != E.Bot.X)
            ReverseHorizontal(E);
    }

    EStart = E;
    if (LeftBoundIsForward)
    {
        while (Result.Top.Y == Result.Next.Bot.Y && Result.Next.OutIdx != Skip)
            Result = Result.Next;
        if (Result.Dx == horizontal && Result.Next.OutIdx != Skip)
        {
            Horz = Result;
            while (Horz.Prev.Dx == horizontal) Horz = Horz.Prev;
            if (Horz.Prev.Top.X > Result.Next.Top.X) Result = Horz.Prev;
        }
        while (E != Result)
        {
            E.NextInLML = E.Next;
            if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Prev.Top.X)
                ReverseHorizontal(E);
            E = E.Next;
        }
        if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Prev.Top.X)
            ReverseHorizontal(E);
        Result = Result.Next; //move to the edge just beyond current bound
    }
    else
    {
        while (Result.Top.Y == Result.Prev.Bot.Y && Result.Prev.OutIdx != Skip)
            Result = Result.Prev;
        if (Result.Dx == horizontal && Result.Prev.OutIdx != Skip)
        {
            Horz = Result;
            while (Horz.Next.Dx == horizontal) Horz = Horz.Next;
            if (Horz.Next.Top.X == Result.Prev.Top.X ||
                Horz.Next.Top.X > Result.Prev.Top.X) Result = Horz.Next;
        }

        while (E != Result)
        {
            E.NextInLML = E.Prev;
            if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Next.Top.X)
                ReverseHorizontal(E);
            E = E.Prev;
        }
        if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Next.Top.X)
            ReverseHorizontal(E);
        Result = Result.Prev; //move to the edge just beyond current bound
    }
    return Result;
}
```

### 7.12.2 方法概览

`ProcessBound` 是 `ClipperBase` 中**最复杂的方法之一**。它的职责是：

1. 从局部最小值点出发，沿着一个方向（左边界或右边界）**向上**遍历边
2. 为遍历路径上的每条边设置 `NextInLML` 指针，构建"局部最小值链表"（LML）
3. 处理遍历过程中遇到的水平边，必要时翻转其 `Top.X` 和 `Bot.X`
4. 找到边界的终点（下一个局部最小值的底部或 `Skip` 标记的边），返回终点**之后**的边
5. 处理 `Skip` 边的特殊情况（开放路径的端点）

### 7.12.3 参数说明

| 参数 | 含义 |
|:---|:---|
| `E` | 起始边——局部最小值处的左边界或右边界 |
| `LeftBoundIsForward` | 如果为 `true`，则"向前"（`Next` 方向）遍历即为"向上"；如果为 `false`，则"向后"（`Prev` 方向）遍历即为"向上" |

### 7.12.4 Skip 边处理（开放路径特殊情况）

```csharp
if (Result.OutIdx == Skip)
{
    E = Result;
    if (LeftBoundIsForward)
    {
        while (E.Top.Y == E.Next.Bot.Y) E = E.Next;  // 沿着连续上升的边前进
        while (E != Result && E.Dx == horizontal) E = E.Prev;  // 回退跳过水平边
    }
    else
    {
        while (E.Top.Y == E.Prev.Bot.Y) E = E.Prev;  // 反方向前进
        while (E != Result && E.Dx == horizontal) E = E.Next;
    }
    ...
}
```

当边的 `OutIdx == Skip` 时，说明这是一条开放路径的端点边。此时需要：

1. 尝试跳过 `Skip` 边，找到边界中的其他边
2. 如果没有更多边（`E == Result`），则简单地返回下一条边
3. 如果还有更多边，**递归创建**一个新的局部最小值并再次调用 `ProcessBound`

```
开放路径 Skip 边示意：

    ●───● (Skip 边，开放路径端点)
    │
    ●     ← 这里可能还有边需要处理
    │
    ●     ← ProcessBound 需要发现并处理这些边
```

### 7.12.5 水平边的方向修正

```csharp
if (E.Dx == horizontal)
{
    if (LeftBoundIsForward) EStart = E.Prev;
    else EStart = E.Next;
    if (EStart.Dx == horizontal)
    {
        if (EStart.Bot.X != E.Bot.X && EStart.Top.X != E.Bot.X)
            ReverseHorizontal(E);
    }
    else if (EStart.Bot.X != E.Bot.X)
        ReverseHorizontal(E);
}
```

水平边的 `Top.X` 和 `Bot.X` 在 `InitEdge2` 中可能不符合边界处理的预期方向。`ReverseHorizontal` 会交换它们，使水平边的 X 坐标方向与边界遍历方向一致。

**为什么需要翻转？**

在 `InitEdge2` 中，`Bot` 和 `Top` 是根据 Y 坐标确定的。但对于水平边（`Delta.Y == 0`），`Bot.Y == Top.Y`，此时 `Bot` 和 `Top` 的 X 坐标顺序取决于初始化时的相邻边关系。在边界处理中，我们需要确保水平边的 X 坐标**与相邻非水平边正确对齐**。

```
修正前（可能的错误方向）：
     Bot.X=10    Top.X=5
     ●──────────●
     
修正后（ReverseHorizontal 翻转）：
     Bot.X=5     Top.X=10
     ●──────────●
     
确保 Bot.X 与下方相邻边的 Top.X 对齐
```

### 7.12.6 左边界的向上遍历（LeftBoundIsForward = true）

```csharp
EStart = E;
if (LeftBoundIsForward)
{
    // 步骤 1：找到边界的最高点
    while (Result.Top.Y == Result.Next.Bot.Y && Result.Next.OutIdx != Skip)
        Result = Result.Next;
    
    // 步骤 2：处理顶部的水平边
    if (Result.Dx == horizontal && Result.Next.OutIdx != Skip)
    {
        Horz = Result;
        while (Horz.Prev.Dx == horizontal) Horz = Horz.Prev;
        if (Horz.Prev.Top.X > Result.Next.Top.X) Result = Horz.Prev;
    }
    
    // 步骤 3：设置 NextInLML 链接
    while (E != Result)
    {
        E.NextInLML = E.Next;
        if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Prev.Top.X)
            ReverseHorizontal(E);
        E = E.Next;
    }
    if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Prev.Top.X)
        ReverseHorizontal(E);
    Result = Result.Next; // 返回边界之外的下一条边
}
```

**步骤 1** 沿 `Next` 方向向上遍历，直到找到边界的最高点。判断条件 `Result.Top.Y == Result.Next.Bot.Y` 表示当前边的顶部与下一条边的底部在同一 Y 坐标——即它们首尾相连，向上延伸。

**步骤 2** 处理顶部的水平边群。当边界的最高边是水平的时候，需要确定边界的真正终点。算法会回溯水平边序列，选择使边界包含更多水平边的终点。

**步骤 3** 是最核心的操作——构建 `NextInLML` 链。这个链表连接了从局部最小值到局部最大值之间的所有边，形成边界的"上行路径"。

```
                    局部最大值
                   ● Result (终点边)
                  ╱
                 ╱  NextInLML 链的方向
                ╱        │
               ●         │ e2.NextInLML = e3
              ╱          │
             ╱           │ e1.NextInLML = e2
            ╱            │
           ● EStart      │ e0.NextInLML = e1
            (起始边 E)
           ●
         局部最小值
```

### 7.12.7 右边界的向上遍历（LeftBoundIsForward = false）

右边界的处理逻辑与左边界**对称**：

- 遍历方向：`Prev`（而非 `Next`）
- `NextInLML` 指向：`E.Prev`（而非 `E.Next`）
- 水平边对齐检查：`E.Bot.X != E.Next.Top.X`（而非 `E.Prev.Top.X`）
- 返回值：`Result.Prev`（而非 `Result.Next`）

```
左边界（Forward）          右边界（Backward）

遍历方向 →               遍历方向 ←
E → E.Next → ...         E → E.Prev → ...
NextInLML = E.Next       NextInLML = E.Prev
```

### 7.12.8 完整流程图

```
ProcessBound(E, LeftBoundIsForward)
│
├── E.OutIdx == Skip?
│   ├── YES → 处理开放路径的 Skip 边
│   │         寻找 Skip 之后的其他边
│   │         └── 有更多边? → 创建新 LocalMinima，递归调用 ProcessBound
│   │             没有? → 返回下一条边
│   │
│   └── NO ↓
│
├── E.Dx == horizontal?
│   └── YES → 检查相邻边的 X 对齐，必要时 ReverseHorizontal
│
├── LeftBoundIsForward?
│   ├── TRUE  → 沿 Next 方向遍历
│   │           1. 找到上行终点 Result
│   │           2. 处理顶部水平边
│   │           3. 设置 NextInLML = Next
│   │           4. 修正水平边方向
│   │           5. 返回 Result.Next
│   │
│   └── FALSE → 沿 Prev 方向遍历
│               1. 找到上行终点 Result
│               2. 处理顶部水平边
│               3. 设置 NextInLML = Prev
│               4. 修正水平边方向
│               5. 返回 Result.Prev
```

---

## 7.13 AddPath() — 完整的路径添加流程

### 7.13.1 方法签名与输入验证

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
```

**参数说明：**

| 参数 | 类型 | 含义 |
|:---|:---|:---|
| `pg` | `Path`（即 `List<IntPoint>`） | 要添加的多边形顶点路径 |
| `polyType` | `PolyType` | 路径类型：`ptSubject`（主体）或 `ptClip`（裁剪） |
| `Closed` | `bool` | 路径是否闭合 |

**编译时约束**：
- 如果定义了 `use_lines`：开放路径只能是 Subject 类型
- 如果未定义 `use_lines`：不允许开放路径

### 7.13.2 去除尾部重复点

```csharp
int highI = (int)pg.Count - 1;
if (Closed) while (highI > 0 && (pg[highI] == pg[0])) --highI;
while (highI > 0 && (pg[highI] == pg[highI - 1])) --highI;
if ((Closed && highI < 2) || (!Closed && highI < 1)) return false;
```

**逻辑解析：**

1. `highI` 初始化为最后一个顶点的索引
2. **闭合路径**：从末尾开始，移除与第一个点重复的点（因为闭合路径的首尾应该不同——闭合关系由算法隐含处理）
3. **所有路径**：从末尾开始，移除与前一个点重复的相邻点
4. **有效性检查**：闭合路径至少需要 3 个不同的点（三角形），开放路径至少需要 2 个不同的点（线段）

```
示例：输入 pg = [A, B, C, D, A, A]，Closed = true

第 1 步：highI = 5
第 2 步（闭合去重）：pg[5]==pg[0]? A==A → highI=4; pg[4]==pg[0]? A==A → highI=3
第 3 步（相邻去重）：pg[3]==pg[2]? D==C → 不等，停止
结果：highI = 3，有效顶点为 [A, B, C, D]（索引 0 到 3）
```

### 7.13.3 创建边数组

```csharp
//create a new edge array ...
List<TEdge> edges = new List<TEdge>(highI + 1);
for (int i = 0; i <= highI; i++) edges.Add(new TEdge());

bool IsFlat = true;
```

为每个有效顶点创建一个 `TEdge` 对象。`IsFlat` 标志用于检测完全水平的路径（所有顶点 Y 坐标相同）。

### 7.13.4 第一阶段初始化 — 构建循环链表

```csharp
//1. Basic (first) edge initialization ...
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
```

**执行顺序：**

1. 特殊处理：先设置 `edges[1].Curr`（因为 `InitEdge(edges[0], ...)` 需要 `edges[1]` 的信息？实际上这行并非必须的——`InitEdge` 不读取 `eNext.Curr`，但这可能是历史遗留代码）
2. 范围检查：检查首尾两个顶点
3. 初始化首尾两个边（处理循环链接）
4. 逆序初始化中间的边，同时对每个顶点做范围检查
5. 设置 `eStart` 为 `edges[0]`

**循环链表结构（以 4 个顶点为例）：**

```
edges[0] ⟷ edges[1] ⟷ edges[2] ⟷ edges[3]
   │                                    │
   └────────────────────────────────────┘
   （循环连接）

edges[0].Next = edges[1],  edges[0].Prev = edges[3]
edges[1].Next = edges[2],  edges[1].Prev = edges[0]
edges[2].Next = edges[3],  edges[2].Prev = edges[1]
edges[3].Next = edges[0],  edges[3].Prev = edges[2]
```

### 7.13.5 第二阶段 — 去除重复点和共线点

```csharp
//2. Remove duplicate vertices, and (when closed) collinear edges ...
TEdge E = eStart, eLoopStop = eStart;
for (; ; )
{
    //nb: allows matching start and end points when not Closed ...
    if (E.Curr == E.Next.Curr && (Closed || E.Next != eStart))
    {
        if (E == E.Next) break;
        if (E == eStart) eStart = E.Next;
        E = RemoveEdge(E);
        eLoopStop = E;
        continue;
    }
    if (E.Prev == E.Next)
        break; //only two vertices
    else if (Closed &&
      SlopesEqual(E.Prev.Curr, E.Curr, E.Next.Curr, m_UseFullRange) &&
      (!PreserveCollinear ||
      !Pt2IsBetweenPt1AndPt3(E.Prev.Curr, E.Curr, E.Next.Curr)))
    {
        //Collinear edges are allowed for open paths but in closed paths
        //the default is to merge adjacent collinear edges into a single edge.
        //However, if the PreserveCollinear property is enabled, only overlapping
        //collinear edges (ie spikes) will be removed from closed paths.
        if (E == eStart) eStart = E.Next;
        E = RemoveEdge(E);
        E = E.Prev;
        eLoopStop = E;
        continue;
    }
    E = E.Next;
    if ((E == eLoopStop) || (!Closed && E.Next == eStart)) break;
}

if ((!Closed && (E == E.Next)) || (Closed && (E.Prev == E.Next)))
    return false;
```

**这是一个复杂的清理循环，让我们逐条件分析：**

#### 条件 1：相邻重复点

```csharp
if (E.Curr == E.Next.Curr && (Closed || E.Next != eStart))
```

- 如果当前边与下一条边的顶点相同，则移除当前边
- 对于开放路径，允许首尾顶点相同（`E.Next != eStart` 条件排除这种情况）
- 如果移除后链表只剩一个节点（`E == E.Next`），退出循环

#### 条件 2：只剩两个顶点

```csharp
if (E.Prev == E.Next) break;
```

如果链表只剩两个节点（互为 Prev 和 Next），退出循环。两个点不足以构成闭合多边形。

#### 条件 3：共线点移除

```csharp
else if (Closed &&
  SlopesEqual(E.Prev.Curr, E.Curr, E.Next.Curr, m_UseFullRange) &&
  (!PreserveCollinear ||
  !Pt2IsBetweenPt1AndPt3(E.Prev.Curr, E.Curr, E.Next.Curr)))
```

仅对闭合路径执行共线检查：
- `SlopesEqual(p1, p2, p3)` 检查三个点是否共线
- 当 `PreserveCollinear == false` 时，移除所有共线的中间点
- 当 `PreserveCollinear == true` 时，仅移除"尖刺"——即 `Pt2` 不在 `Pt1` 和 `Pt3` 之间的情况

```
正常共线（PreserveCollinear=true 时保留）：
  Pt1 ──── Pt2 ──── Pt3     Pt2 在 Pt1 和 Pt3 之间

"尖刺"共线（总是移除）：
  Pt1 ──── Pt3 ──── Pt2     Pt2 不在 Pt1 和 Pt3 之间
                              （路径在 Pt3 处折返）
```

#### 循环终止条件

```csharp
E = E.Next;
if ((E == eLoopStop) || (!Closed && E.Next == eStart)) break;
```

- 闭合路径：当回到起点 `eLoopStop` 时退出
- 开放路径：当到达最后一个有效边时退出

#### 有效性最终检查

```csharp
if ((!Closed && (E == E.Next)) || (Closed && (E.Prev == E.Next)))
    return false;
```

去重后检查是否还有足够的边。如果闭合路径只剩 2 个点或开放路径只剩 1 个点，返回 `false`。

### 7.13.6 开放路径的 Skip 标记

```csharp
if (!Closed)
{
    m_HasOpenPaths = true;
    eStart.Prev.OutIdx = Skip;
}
```

对于开放路径，最后一条边（`eStart.Prev`，即循环链表中 `eStart` 的前驱）被标记为 `Skip`。这条边连接路径的最后一个点和第一个点——对于开放路径，这条"回边"不应参与裁剪。

```
开放路径 A → B → C → D：

    [e0:A] → [e1:B] → [e2:C] → [e3:D] → [e0:A]
                                  │
                                  └── e3.OutIdx = Skip（D→A 这条边是虚拟的）
```

### 7.13.7 第三阶段初始化 — InitEdge2 与平坦路径检测

```csharp
//3. Do second stage of edge initialization ...
E = eStart;
do
{
    InitEdge2(E, polyType);
    E = E.Next;
    if (IsFlat && E.Curr.Y != eStart.Curr.Y) IsFlat = false;
}
while (E != eStart);
```

遍历所有边，对每条边执行第二阶段初始化（设置 `Bot`、`Top`、`Dx`、`PolyTyp`）。同时检测路径是否完全平坦（所有点的 Y 坐标相同）。

### 7.13.8 完全平坦路径的特殊处理

```csharp
//4. Finally, add edge bounds to LocalMinima list ...

//Totally flat paths must be handled differently when adding them
//to LocalMinima list to avoid endless loops etc ...
if (IsFlat)
{
    if (Closed) return false;
    E.Prev.OutIdx = Skip;
    LocalMinima locMin = new LocalMinima();
    locMin.Next = null;
    locMin.Y = E.Bot.Y;
    locMin.LeftBound = null;
    locMin.RightBound = E;
    locMin.RightBound.Side = EdgeSide.esRight;
    locMin.RightBound.WindDelta = 0;
    for (; ; )
    {
        if (E.Bot.X != E.Prev.Top.X) ReverseHorizontal(E);
        if (E.Next.OutIdx == Skip) break;
        E.NextInLML = E.Next;
        E = E.Next;
    }
    InsertLocalMinima(locMin);
    m_edges.Add(edges);
    return true;
}
```

完全平坦的路径（所有顶点 Y 相同）需要特殊处理：

1. 闭合的平坦路径没有意义（面积为零），直接返回 `false`
2. 开放的平坦路径作为一个特殊的局部最小值处理：
   - `LeftBound = null`（没有左边界）
   - `RightBound = E`（整条路径作为右边界）
   - `WindDelta = 0`（不影响绕数计算）
   - 将所有边通过 `NextInLML` 链接起来

```
完全平坦的开放路径：A(10,5) → B(20,5) → C(30,5)

Y = 5   ●────●────●
        A    B    C

创建一个 LocalMinima：
  Y = 5
  LeftBound = null
  RightBound → e0 → e1 → e2（通过 NextInLML 链接）
```

### 7.13.9 正常路径的局部最小值提取

```csharp
m_edges.Add(edges);
bool leftBoundIsForward;
TEdge EMin = null;

//workaround to avoid an endless loop in the while loop below when
//open paths have matching start and end points ...
if (E.Prev.Bot == E.Prev.Top) E = E.Next;

for (; ; )
{
    E = FindNextLocMin(E);
    if (E == EMin) break;
    else if (EMin == null) EMin = E;

    //E and E.Prev now share a local minima (left aligned if horizontal).
    //Compare their slopes to find which starts which bound ...
    LocalMinima locMin = new LocalMinima();
    locMin.Next = null;
    locMin.Y = E.Bot.Y;
    if (E.Dx < E.Prev.Dx)
    {
        locMin.LeftBound = E.Prev;
        locMin.RightBound = E;
        leftBoundIsForward = false; //Q.nextInLML = Q.prev
    }
    else
    {
        locMin.LeftBound = E;
        locMin.RightBound = E.Prev;
        leftBoundIsForward = true; //Q.nextInLML = Q.next
    }
    locMin.LeftBound.Side = EdgeSide.esLeft;
    locMin.RightBound.Side = EdgeSide.esRight;

    if (!Closed) locMin.LeftBound.WindDelta = 0;
    else if (locMin.LeftBound.Next == locMin.RightBound)
        locMin.LeftBound.WindDelta = -1;
    else locMin.LeftBound.WindDelta = 1;
    locMin.RightBound.WindDelta = -locMin.LeftBound.WindDelta;

    E = ProcessBound(locMin.LeftBound, leftBoundIsForward);
    if (E.OutIdx == Skip) E = ProcessBound(E, leftBoundIsForward);

    TEdge E2 = ProcessBound(locMin.RightBound, !leftBoundIsForward);
    if (E2.OutIdx == Skip) E2 = ProcessBound(E2, !leftBoundIsForward);

    if (locMin.LeftBound.OutIdx == Skip)
        locMin.LeftBound = null;
    else if (locMin.RightBound.OutIdx == Skip)
        locMin.RightBound = null;
    InsertLocalMinima(locMin);
    if (!leftBoundIsForward) E = E2;
}
return true;
```

这是 `AddPath` 的核心循环。让我们逐步分析：

#### 步骤 1：查找所有局部最小值

```csharp
E = FindNextLocMin(E);
if (E == EMin) break;
else if (EMin == null) EMin = E;
```

循环调用 `FindNextLocMin` 遍历环形链表中的所有局部最小值。`EMin` 记录第一个找到的局部最小值，当再次回到它时，说明所有局部最小值都已处理。

#### 步骤 2：确定左右边界

```csharp
if (E.Dx < E.Prev.Dx)
{
    locMin.LeftBound = E.Prev;
    locMin.RightBound = E;
    leftBoundIsForward = false;
}
else
{
    locMin.LeftBound = E;
    locMin.RightBound = E.Prev;
    leftBoundIsForward = true;
}
```

在局部最小值处，`E` 和 `E.Prev` 是两条分叉向上的边。通过比较它们的 `Dx`（逆斜率）来确定哪条是左边界、哪条是右边界：

- `Dx` 更小的边更"陡峭"或更偏左 → 作为左边界的对侧
- 实际规则：`E.Dx < E.Prev.Dx` 时，`E.Prev` 在左，`E` 在右

```
局部最小值处的左右边界判断：

        左边界              右边界
        (Dx 较大)           (Dx 较小)
           ╲                   ╱
            ╲                 ╱
             ╲               ╱
              ╲             ╱
               ╲           ╱
                ╲         ╱
                 ●───────●
              E.Prev      E
              
    E.Dx < E.Prev.Dx → E 是右边界，E.Prev 是左边界
```

#### 步骤 3：设置 WindDelta

```csharp
if (!Closed) locMin.LeftBound.WindDelta = 0;
else if (locMin.LeftBound.Next == locMin.RightBound)
    locMin.LeftBound.WindDelta = -1;
else locMin.LeftBound.WindDelta = 1;
locMin.RightBound.WindDelta = -locMin.LeftBound.WindDelta;
```

`WindDelta` 决定了边对绕数（winding number）的贡献：
- 开放路径：`WindDelta = 0`（不影响绕数）
- 闭合路径：根据左边界的 `Next` 是否指向右边界来判断方向
  - 如果 `LeftBound.Next == RightBound`，说明左边界的"前进方向"指向右边界 → `WindDelta = -1`
  - 否则 → `WindDelta = 1`
- 右边界的 `WindDelta` 总是与左边界相反

#### 步骤 4：处理两个边界

```csharp
E = ProcessBound(locMin.LeftBound, leftBoundIsForward);
if (E.OutIdx == Skip) E = ProcessBound(E, leftBoundIsForward);

TEdge E2 = ProcessBound(locMin.RightBound, !leftBoundIsForward);
if (E2.OutIdx == Skip) E2 = ProcessBound(E2, !leftBoundIsForward);
```

分别对左边界和右边界调用 `ProcessBound`。注意：
- 左边界的遍历方向是 `leftBoundIsForward`
- 右边界的遍历方向是 `!leftBoundIsForward`（方向相反）
- 如果 `ProcessBound` 返回的边是 `Skip`，则需要再次调用以跳过它

#### 步骤 5：处理 Skip 标记的边界

```csharp
if (locMin.LeftBound.OutIdx == Skip)
    locMin.LeftBound = null;
else if (locMin.RightBound.OutIdx == Skip)
    locMin.RightBound = null;
```

如果边界处理后被标记为 `Skip`，则将对应的边界设为 `null`。这在开放路径中很常见。

#### 步骤 6：插入局部最小值并继续

```csharp
InsertLocalMinima(locMin);
if (!leftBoundIsForward) E = E2;
```

将构建好的局部最小值插入有序链表。`E` 或 `E2` 作为下一轮查找局部最小值的起始边。

### 7.13.10 AddPath 完整流程图

```
AddPath(pg, polyType, Closed)
│
├── 1. 输入验证（开放路径约束）
│
├── 2. 去除尾部重复点，计算 highI
│       └── 有效性检查（至少 3 点/2 点）
│
├── 3. 创建 TEdge 数组
│
├── 4. InitEdge() × N：构建双向循环链表
│       └── 范围检查 RangeTest × N
│
├── 5. 清理循环：去除重复点和共线点
│       ├── RemoveEdge() 删除无效节点
│       └── 有效性再检查
│
├── 6. 开放路径：标记最后一条边为 Skip
│
├── 7. InitEdge2() × N：设置 Bot/Top/Dx/PolyTyp
│       └── 检测是否完全平坦
│
├── 8. 完全平坦？
│       ├── YES + Closed → return false
│       └── YES + Open → 特殊处理，创建单边 LocalMinima
│
├── 9. 循环查找所有局部最小值
│       ├── FindNextLocMin()
│       ├── 确定左右边界（比较 Dx）
│       ├── 设置 WindDelta
│       ├── ProcessBound(LeftBound)
│       ├── ProcessBound(RightBound)
│       ├── 处理 Skip 边界
│       └── InsertLocalMinima()
│
└── return true
```

---

## 7.14 AddPaths() — 批量添加路径

### 7.14.1 源码

```csharp
public bool AddPaths(Paths ppg, PolyType polyType, bool closed)
{
    bool result = false;
    for (int i = 0; i < ppg.Count; ++i)
        if (AddPath(ppg[i], polyType, closed)) result = true;
    return result;
}
```

### 7.14.2 解析

`AddPaths` 是 `AddPath` 的批量版本。它简单地遍历路径集合，逐一调用 `AddPath`。

**关键点：**
- 返回值为 `true` 只要**至少有一条**路径成功添加
- 即使某些路径无效（返回 `false`），其他路径仍会继续处理
- 这符合"尽力而为"的设计原则——无效路径被静默忽略

---

## 7.15 辅助方法：Pt2IsBetweenPt1AndPt3 和 RemoveEdge

### 7.15.1 Pt2IsBetweenPt1AndPt3

```csharp
internal bool Pt2IsBetweenPt1AndPt3(IntPoint pt1, IntPoint pt2, IntPoint pt3)
{
    if ((pt1 == pt3) || (pt1 == pt2) || (pt3 == pt2)) return false;
    else if (pt1.X != pt3.X) return (pt2.X > pt1.X) == (pt2.X < pt3.X);
    else return (pt2.Y > pt1.Y) == (pt2.Y < pt3.Y);
}
```

判断点 `pt2` 是否在 `pt1` 和 `pt3` 之间（假设三点共线）：

- 如果三个点中有任意两个相同，返回 `false`
- 如果 `pt1.X != pt3.X`（非垂直线段）：检查 `pt2.X` 是否严格在 `pt1.X` 和 `pt3.X` 之间
- 如果 `pt1.X == pt3.X`（垂直线段）：检查 `pt2.Y` 是否严格在 `pt1.Y` 和 `pt3.Y` 之间

**巧妙之处**：`(pt2.X > pt1.X) == (pt2.X < pt3.X)` 这个表达式等价于检查 `pt2.X` 严格位于 `pt1.X` 和 `pt3.X` 之间，无论 `pt1.X` 和 `pt3.X` 的大小关系如何。

```
pt1.X=2, pt3.X=8, pt2.X=5:
  (5 > 2) == (5 < 8)  →  true == true  →  true ✓

pt1.X=8, pt3.X=2, pt2.X=5:
  (5 > 8) == (5 < 2)  →  false == false  →  true ✓

pt1.X=2, pt3.X=8, pt2.X=10:
  (10 > 2) == (10 < 8)  →  true == false  →  false ✓
```

### 7.15.2 RemoveEdge

```csharp
TEdge RemoveEdge(TEdge e)
{
    //removes e from double_linked_list (but without removing from memory)
    e.Prev.Next = e.Next;
    e.Next.Prev = e.Prev;
    TEdge result = e.Next;
    e.Prev = null; //flag as removed (see ClipperBase.Clear)
    return result;
}
```

从双向循环链表中移除一条边：

```
移除前：
... ⟷ [A] ⟷ [E] ⟷ [B] ⟷ ...

移除后：
... ⟷ [A] ⟷ [B] ⟷ ...
       [E].Prev = null (标记为已移除)

返回值：E.Next（即 B）
```

将 `e.Prev` 设为 `null` 不仅是断开链接，更是一个**标记**——在 `Clear()` 方法中，通过检查 `Prev == null` 来识别已移除的边。

---

## 7.16 本章小结

本章详细分析了 `ClipperBase` 的前半部分，涵盖了从类声明到路径添加的完整流程：

| 主题 | 关键内容 |
|:---|:---|
| **常量系统** | `horizontal` 哨兵值、`Skip`/`Unassigned` 标记、双级范围常量 |
| **精度自适应** | `RangeTest` 的两级检查与不可逆升级机制 |
| **边初始化** | 两阶段初始化（`InitEdge` 建立链表 → `InitEdge2` 设置方向） |
| **局部最小值** | `FindNextLocMin` 处理水平边序列的复杂搜索逻辑 |
| **边界处理** | `ProcessBound` 的 Skip 处理、水平边修正、NextInLML 链构建 |
| **路径添加** | `AddPath` 的 9 步流程：验证→去重→建链→清理→初始化→找极值→处理边界 |

`ProcessBound` 和 `AddPath` 是本章最复杂的两个方法。理解它们的关键在于：

1. **环形链表的遍历**：所有边形成一个双向循环链表，局部最小值是"V"形谷底
2. **NextInLML 链**：从局部最小值向上延伸的边通过 `NextInLML` 串联，形成"上行路径"
3. **水平边的特殊性**：水平边没有 Y 方向的变化，需要特殊的方向修正和局部最小值判断

在下一章（下篇）中，我们将继续分析 `ClipperBase` 的后半部分，包括 `SetDx`、`SlopesEqual`、扫描束管理、活动边表操作等内容。

---

## 7.17 附录：AddPath 执行时序表

以一个简单三角形 `[(0,0), (50,50), (100,0)]` 为例：

| 步骤 | 操作 | 结果 |
|:---:|:---|:---|
| 1 | 输入验证 | Closed=true, highI=2 |
| 2 | 去除尾部重复 | 无重复，highI=2 |
| 3 | 创建 3 个 TEdge | edges[0], edges[1], edges[2] |
| 4 | InitEdge × 3 | 构建循环链表 e0⟷e1⟷e2⟷e0 |
| 5 | RangeTest × 3 | 全部在 loRange 内，m_UseFullRange=false |
| 6 | 清理循环 | 无重复无共线，无操作 |
| 7 | InitEdge2 × 3 | 设置 Bot/Top/Dx |
| 8 | IsFlat 检查 | Y 坐标有 0 和 50，不平坦 |
| 9 | FindNextLocMin | 找到 Y=50 处的局部最小值 |
| 10 | 确定左右边界 | 根据 Dx 比较分配 |
| 11 | ProcessBound × 2 | 构建 NextInLML 链 |
| 12 | InsertLocalMinima | 插入 Y=50 的局部最小值 |
| 13 | 循环结束 | 回到 EMin，退出 |
| 14 | 返回 true | 路径添加成功 |

```
三角形的局部最小值：

    (0,0)                (100,0)
       ●──────────────────●       ← 局部最大值（两个）
        ╲                ╱
         ╲              ╱
          ╲            ╱
           ╲          ╱
            ╲        ╱
             ╲      ╱
              ╲    ╱
               ╲  ╱
                ╲╱
               (50,50)              ← 局部最小值
               
注意：Y 轴向下为正，所以 (50,50) 在最下方
```

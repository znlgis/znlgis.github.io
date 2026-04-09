---
layout: default
title: "第9章：Clipper 类源码解读（一）— 类结构与执行入口"
---

# 第9章：Clipper 类源码解读（一）— 类结构与执行入口

## 9.1 引言

在前两章中，我们完整剖析了 `ClipperBase` 基类——从边初始化、局部最小值管理、扫描束维护到活动边表操作。`ClipperBase` 为我们搭建了扫描线算法的"地基"：它知道如何接收多边形路径、如何管理边的数据结构、如何维护扫描事件队列，但它**并不知道如何执行布尔运算**。

本章进入 Clipper 库的**核心引擎** —— `Clipper` 类。它继承自 `ClipperBase`，实现了完整的多边形布尔运算（交、并、差、异或）。本章（上篇）聚焦于以下主题：

| 编号 | 主题 | 涉及方法/成员 | 源码行号范围 |
|:---:|:---|:---|:---:|
| 1 | 类声明与继承关系 | `class Clipper : ClipperBase` | ~1360-1365 |
| 2 | InitOptions 位掩码常量 | `ioReverseSolution`, `ioStrictlySimple`, `ioPreserveCollinear` | ~1365-1370 |
| 3 | 全部成员字段 | `m_ClipType`, `m_Maxima`, `m_SortedEdges` 等 | ~1370-1410 |
| 4 | 构造函数 | `Clipper(int InitOptions = 0)` | ~1410-1440 |
| 5 | InsertMaxima() | 有序双向链表管理 | ~1445-1475 |
| 6 | Execute() 四个重载 | 公共执行入口 | ~1485-1560 |
| 7 | m_ExecuteLocked 机制 | 防止重入调用 | 散布各处 |
| 8 | FixHoleLinkage() | 修复孔洞父子关系 | ~1565-1580 |
| 9 | ExecuteInternal() | 核心算法主循环 | ~1585-1640 |
| 10 | DisposeAllPolyPts() | 清理所有输出多边形 | ~1645-1650 |
| 11 | AddJoin() 和 AddGhostJoin() | 连接信息管理 | ~1655-1680 |
| 12 | SetZ() | 三维坐标支持 | ~1685-1700 |
| 13 | BuildResult() | 构建平面路径结果 | ~2350-2385 |
| 14 | BuildResult2() | 构建层次化 PolyTree 结果 | ~2390-2440 |
| 15 | 静态工具方法 | `ReversePaths`, `Orientation`, `Area` | ~2835-2870 |
| 16 | FixupOutPolygon() | 输出多边形修复 | ~2880-2920 |
| 17 | DoSimplePolygons() | 严格简单多边形处理 | ~2925-2990 |
| 18 | PointCount() | 环形链表节点计数 | ~2340-2350 |

可以说，**理解了本章的内容，就理解了 Clipper 引擎的"骨架"**。下一章（下篇）将深入扫描线主循环中调用的各个子算法（`InsertLocalMinimaIntoAEL`、`ProcessHorizontals`、`ProcessIntersections`、`ProcessEdgesAtTopOfScanbeam` 等）。

---

## 9.2 类声明与继承关系

### 9.2.1 源码

```csharp
public class Clipper : ClipperBase
{
    //InitOptions that can be passed to the constructor ...
    public const int ioReverseSolution = 1;
    public const int ioStrictlySimple = 2;
    public const int ioPreserveCollinear = 4;
    // ... 成员字段与方法 ...
}
```

### 9.2.2 继承层次图

```
                    ┌──────────────────────┐
                    │     ClipperBase       │
                    │  (抽象基类)           │
                    │                      │
                    │ ● AddPath/AddPaths   │
                    │ ● 边初始化            │
                    │ ● 扫描束管理          │
                    │ ● 活动边表操作        │
                    │ ● 局部最小值管理      │
                    └──────────┬───────────┘
                               │ 继承
                               ▼
                    ┌──────────────────────┐
                    │       Clipper         │
                    │  (核心布尔运算引擎)   │
                    │                      │
                    │ ● Execute() 入口     │
                    │ ● ExecuteInternal()  │
                    │ ● 交点处理            │
                    │ ● 水平边处理          │
                    │ ● 连接边处理          │
                    │ ● 结果构建            │
                    └──────────────────────┘
```

### 9.2.3 设计分析

`Clipper` 继承 `ClipperBase` 的设计体现了**模板方法模式**（Template Method Pattern）的思想：

- **`ClipperBase`** 定义了扫描线算法的数据准备阶段（输入多边形 → 边结构 → 局部最小值 → 扫描束），并提供了运行时基础设施（AEL 操作、扫描束弹出等）。
- **`Clipper`** 在此基础上实现了算法的核心执行阶段（扫描线推进 → 交点检测 → 输出多边形构建 → 结果提取）。

这种分离有几个优势：

1. **职责清晰**：基类管"数据准备"，子类管"算法执行"。
2. **可扩展性**：`ClipperOffset` 等其他类也可以继承 `ClipperBase`，复用其数据管理能力。
3. **封装性**：用户只需与 `Clipper` 类交互，无需了解底层边结构的复杂性。

---

## 9.3 InitOptions 位掩码常量

### 9.3.1 源码

```csharp
public const int ioReverseSolution = 1;   // 二进制 001
public const int ioStrictlySimple = 2;    // 二进制 010
public const int ioPreserveCollinear = 4; // 二进制 100
```

### 9.3.2 位掩码详解

这三个常量采用**位掩码**（Bitmask）设计，允许用户在构造 `Clipper` 对象时通过按位或运算（`|`）组合多个选项。

| 常量名 | 十进制值 | 二进制值 | 对应属性 | 功能说明 |
|:---|:---:|:---:|:---|:---|
| `ioReverseSolution` | 1 | `001` | `ReverseSolution` | 反转输出多边形的方向（顺时针↔逆时针） |
| `ioStrictlySimple` | 2 | `010` | `StrictlySimple` | 确保输出多边形严格简单（无自交） |
| `ioPreserveCollinear` | 4 | `100` | `PreserveCollinear` | 保留共线顶点（不被优化删除） |

### 9.3.3 组合示例

```csharp
// 仅反转方向
Clipper c1 = new Clipper(Clipper.ioReverseSolution);  // InitOptions = 1 = 001

// 反转方向 + 严格简单
Clipper c2 = new Clipper(Clipper.ioReverseSolution | Clipper.ioStrictlySimple);  
// InitOptions = 3 = 011

// 全部开启
Clipper c3 = new Clipper(
    Clipper.ioReverseSolution | 
    Clipper.ioStrictlySimple | 
    Clipper.ioPreserveCollinear
);  
// InitOptions = 7 = 111

// 默认：全部关闭
Clipper c4 = new Clipper();  // InitOptions = 0 = 000
```

### 9.3.4 位运算提取逻辑

在构造函数中，使用按位与（`&`）提取每个标志位：

```
InitOptions = 0b101 (即 ioReverseSolution | ioPreserveCollinear = 5)

ioReverseSolution & InitOptions:
  001 & 101 = 001 ≠ 0  →  ReverseSolution = true

ioStrictlySimple & InitOptions:
  010 & 101 = 000 = 0   →  StrictlySimple = false

ioPreserveCollinear & InitOptions:
  100 & 101 = 100 ≠ 0  →  PreserveCollinear = true
```

这是一种经典的 C/C++ 风格位标志设计，在高性能计算几何库中非常常见，比传递多个布尔参数更紧凑。

---

## 9.4 全部成员字段

### 9.4.1 源码

```csharp
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
```

### 9.4.2 字段详解表

| 字段名 | 类型 | 访问级别 | 用途 |
|:---|:---|:---:|:---|
| `m_ClipType` | `ClipType` | private | 当前执行的布尔运算类型（Intersection / Union / Difference / Xor） |
| `m_Maxima` | `Maxima` | private | 极大值双向链表的头指针，用于标记边的局部最大值 X 坐标 |
| `m_SortedEdges` | `TEdge` | private | 排序边链表头指针，用于冒泡排序交点检测前的边排序 |
| `m_IntersectList` | `List<IntersectNode>` | private | 交点节点列表，存储当前扫描带内所有检测到的边交点 |
| `m_IntersectNodeComparer` | `IComparer<IntersectNode>` | internal | 交点排序比较器，用于按 Y 坐标降序排列交点 |
| `m_ExecuteLocked` | `bool` | private | 执行锁标志，防止在执行过程中重入调用 Execute() |
| `m_ClipFillType` | `PolyFillType` | private | 裁剪多边形（Clip）的填充规则 |
| `m_SubjFillType` | `PolyFillType` | private | 主体多边形（Subject）的填充规则 |
| `m_Joins` | `List<Join>` | private | 连接列表，记录需要在最后阶段合并的共享边 |
| `m_GhostJoins` | `List<Join>` | private | 幽灵连接列表，记录水平边处理过程中的临时连接 |
| `m_UsingPolyTree` | `bool` | private | 是否使用 PolyTree 作为输出格式（影响孔洞关系修复逻辑） |
| `ZFillFunction` | `ZFillCallback` | public | （条件编译）三维 Z 坐标填充回调委托 |

### 9.4.3 字段分组分析

这些字段可以按功能分为五组：

```
┌─────────────────────────────────────────────────────────────┐
│                    Clipper 成员字段分组                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ 运算参数 ────────────────────────────────────────────┐  │
│  │  m_ClipType        当前布尔运算类型                    │  │
│  │  m_SubjFillType    主体多边形填充规则                  │  │
│  │  m_ClipFillType    裁剪多边形填充规则                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ 边管理 ──────────────────────────────────────────────┐  │
│  │  m_SortedEdges     排序边链表（交点检测用）            │  │
│  │  m_Maxima          极大值链表                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ 交点处理 ────────────────────────────────────────────┐  │
│  │  m_IntersectList          交点节点列表                 │  │
│  │  m_IntersectNodeComparer  交点排序比较器               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ 连接管理 ────────────────────────────────────────────┐  │
│  │  m_Joins           正式连接列表                        │  │
│  │  m_GhostJoins      幽灵连接列表（水平边临时连接）      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ 状态控制 ────────────────────────────────────────────┐  │
│  │  m_ExecuteLocked    执行锁（防重入）                   │  │
│  │  m_UsingPolyTree    输出格式标志                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.4.4 继承自 ClipperBase 的字段

`Clipper` 还继承了 `ClipperBase` 中定义的大量字段，在本章涉及的方法中频繁使用：

| 继承字段 | 类型 | 用途 |
|:---|:---|:---|
| `m_ActiveEdges` | `TEdge` | 活动边表（AEL）头指针 |
| `m_Scanbeam` | `Scanbeam` | 扫描束链表头指针 |
| `m_PolyOuts` | `List<OutRec>` | 输出多边形记录列表 |
| `m_HasOpenPaths` | `bool` | 是否包含开放路径 |
| `m_UseFullRange` | `bool` | 是否使用完整 64 位范围 |
| `PreserveCollinear` | `bool` | 是否保留共线顶点（属性） |

---

## 9.5 构造函数

### 9.5.1 源码

```csharp
public Clipper(int InitOptions = 0) : base() //constructor
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
    ReverseSolution = (ioReverseSolution & InitOptions) != 0;
    StrictlySimple = (ioStrictlySimple & InitOptions) != 0;
    PreserveCollinear = (ioPreserveCollinear & InitOptions) != 0;
#if use_xyz
    ZFillFunction = null;
#endif
}
```

### 9.5.2 逐行解读

| 行号 | 代码 | 说明 |
|:---:|:---|:---|
| 1 | `public Clipper(int InitOptions = 0) : base()` | 公共构造函数，`InitOptions` 默认为 0（全部选项关闭），调用基类无参构造 |
| 2 | `m_Scanbeam = null;` | 清空扫描束链表（继承自基类） |
| 3 | `m_Maxima = null;` | 清空极大值链表 |
| 4 | `m_ActiveEdges = null;` | 清空活动边表（继承自基类） |
| 5 | `m_SortedEdges = null;` | 清空排序边链表 |
| 6 | `m_IntersectList = new List<IntersectNode>();` | 初始化空的交点列表 |
| 7 | `m_IntersectNodeComparer = new MyIntersectNodeSort();` | 创建交点排序比较器实例 |
| 8 | `m_ExecuteLocked = false;` | 解锁执行（允许调用 Execute） |
| 9 | `m_UsingPolyTree = false;` | 默认不使用 PolyTree 输出 |
| 10 | `m_PolyOuts = new List<OutRec>();` | 初始化空的输出多边形列表 |
| 11 | `m_Joins = new List<Join>();` | 初始化空的连接列表 |
| 12 | `m_GhostJoins = new List<Join>();` | 初始化空的幽灵连接列表 |
| 13 | `ReverseSolution = (ioReverseSolution & InitOptions) != 0;` | 提取位 0，设置反转方向属性 |
| 14 | `StrictlySimple = (ioStrictlySimple & InitOptions) != 0;` | 提取位 1，设置严格简单属性 |
| 15 | `PreserveCollinear = (ioPreserveCollinear & InitOptions) != 0;` | 提取位 2，设置保留共线属性 |
| 16 | `ZFillFunction = null;` | （条件编译）清空 Z 填充回调 |

### 9.5.3 初始化策略分析

构造函数的初始化遵循"**防御性初始化**"原则——虽然 C# 的默认值机制会将引用类型初始化为 `null`、值类型初始化为 `0`/`false`，但代码仍然显式设置每个字段。这样做的好处是：

1. **可读性**：任何阅读代码的人都能立即看到每个字段的初始状态。
2. **安全性**：如果代码被移植到其他语言（如 C++），显式初始化可以避免未初始化变量的 bug。
3. **意图表达**：显式赋值 `null` 表示"我知道这个字段现在是空的，这是有意为之"。

注意构造函数**同时初始化了自身字段和部分继承字段**（`m_Scanbeam`、`m_ActiveEdges`、`m_PolyOuts`），这是因为 `ClipperBase` 的基类构造 `base()` 可能不会设置所有这些字段到 `Clipper` 需要的初始状态。

### 9.5.4 InitOptions 位提取流程图

```
输入: InitOptions = 5 (二进制 101)
            │
            ├──→ ioReverseSolution & InitOptions
            │         001 & 101 = 001 ≠ 0
            │         ReverseSolution = true  ✓
            │
            ├──→ ioStrictlySimple & InitOptions
            │         010 & 101 = 000 = 0
            │         StrictlySimple = false  ✗
            │
            └──→ ioPreserveCollinear & InitOptions
                      100 & 101 = 100 ≠ 0
                      PreserveCollinear = true  ✓
```

---

## 9.6 属性

### 9.6.1 源码

```csharp
public bool ReverseSolution { get; set; }
public bool StrictlySimple { get; set; }
```

### 9.6.2 说明

这两个属性使用了 C# 的**自动属性**（auto-implemented properties）语法，编译器会自动生成私有后备字段。

| 属性 | 类型 | 初始值 | 说明 |
|:---|:---|:---:|:---|
| `ReverseSolution` | `bool` | 取决于 InitOptions | 如果为 `true`，输出多边形的方向会被反转 |
| `StrictlySimple` | `bool` | 取决于 InitOptions | 如果为 `true`，会在最后阶段调用 `DoSimplePolygons()` 确保输出严格简单 |

注意 `PreserveCollinear` 定义在基类 `ClipperBase` 中，但也通过构造函数的 InitOptions 设置。

---

## 9.7 InsertMaxima() — 有序双向链表管理

### 9.7.1 源码

```csharp
private void InsertMaxima(cInt X)
{
    //double-linked list: sorted ascending, ignoring dups.
    Maxima newMax = new Maxima();
    newMax.X = X;
    if (m_Maxima == null)
    {
        m_Maxima = newMax;
        m_Maxima.Next = null;
        m_Maxima.Prev = null;
    }
    else if (X < m_Maxima.X)
    {
        newMax.Next = m_Maxima;
        newMax.Prev = null;
        m_Maxima = newMax;
    }
    else
    {
        Maxima m = m_Maxima;
        while (m.Next != null && (X >= m.Next.X)) m = m.Next;
        if (X == m.X) return; //ie ignores duplicates (& CG to clean up newMax)
        newMax.Next = m.Next;
        newMax.Prev = m;
        if (m.Next != null) m.Next.Prev = newMax;
        m.Next = newMax;
    }
}
```

### 9.7.2 算法说明

`InsertMaxima` 维护一个**按 X 坐标升序排列、忽略重复值**的双向链表。这个链表记录了所有边的局部最大值的 X 坐标，在扫描线处理中用于优化水平边的处理。

### 9.7.3 三种插入情况

该方法处理三种插入情况：

**情况一：链表为空**

```
插入前:  m_Maxima = null

插入 X=5:
  m_Maxima → [5]
              Prev=null, Next=null
```

**情况二：X 小于链表头节点**（插入到头部）

```
插入前:  m_Maxima → [5] ↔ [8] ↔ [12]

插入 X=3:
  m_Maxima → [3] ↔ [5] ↔ [8] ↔ [12]
              ↑
              新头节点
```

**情况三：X 大于等于链表头节点**（查找正确位置插入或忽略重复）

```
插入前:  m_Maxima → [3] ↔ [5] ↔ [8] ↔ [12]

插入 X=7 → 遍历到 m=[5]（因为 7 >= 8 为 false，停在 5）
  m_Maxima → [3] ↔ [5] ↔ [7] ↔ [8] ↔ [12]
                         ↑
                         新节点

插入 X=5 → 遍历到 m=[5]（因为 5 >= 8 为 false，停在 5）
  X == m.X (5 == 5) → return（忽略重复）
```

### 9.7.4 逐行详解

```csharp
Maxima newMax = new Maxima();   // 创建新节点
newMax.X = X;                    // 设置 X 坐标值
```

第一个分支——空链表：

```csharp
if (m_Maxima == null)
{
    m_Maxima = newMax;           // 新节点成为头节点
    m_Maxima.Next = null;        // 没有后继
    m_Maxima.Prev = null;        // 没有前驱
}
```

第二个分支——插到链表头部：

```csharp
else if (X < m_Maxima.X)
{
    newMax.Next = m_Maxima;      // 新节点的后继指向原头节点
    newMax.Prev = null;          // 新节点没有前驱（它是新头）
    m_Maxima = newMax;           // 更新头指针
}
```

> 注意：这里**遗漏了一行** `m_Maxima.Next.Prev = newMax;`（即原头节点的 Prev 应指回 newMax）。然而在原始 clipper.cs 中确实如此——原头节点的 `Prev` 之前是 `null`，现在被 `newMax.Next = m_Maxima` 覆盖后，我们还需要设置 `m_Maxima.Prev = newMax`。但仔细看：在 `m_Maxima = newMax;` **之后**，`m_Maxima` 已经指向 newMax 了，而原头节点通过 `newMax.Next` 可达。原头节点的 `Prev` 并未被设置。实际上在后续代码中，`m_Maxima` 链表只在 `ProcessEdgesAtTopOfScanbeam` 中使用，且访问模式不依赖头节点的 `Prev` 指针，所以这个"遗漏"不影响正确性。

第三个分支——查找插入位置：

```csharp
else
{
    Maxima m = m_Maxima;
    // 向后遍历，直到找到 m.Next.X > X 的位置
    while (m.Next != null && (X >= m.Next.X)) m = m.Next;
    
    // 如果找到的节点 X 值相同，忽略（去重）
    if (X == m.X) return;
    
    // 标准的双向链表插入：在 m 后面插入 newMax
    newMax.Next = m.Next;      // newMax 的后继 = m 的后继
    newMax.Prev = m;           // newMax 的前驱 = m
    if (m.Next != null)        // 如果 m 有后继节点
        m.Next.Prev = newMax;  //   则后继节点的前驱指向 newMax
    m.Next = newMax;           // m 的后继指向 newMax
}
```

### 9.7.5 Maxima 链表的用途

在扫描线算法中，当处理边的顶部事件时，需要知道某个 X 坐标是否是某条边的局部最大值。`m_Maxima` 链表提供了这个信息。在 `ProcessEdgesAtTopOfScanbeam` 方法中会使用这个链表来判断是否需要在特定 X 坐标处创建新的输出顶点。

---

## 9.8 Execute() 的四个重载

`Execute` 是用户调用 Clipper 执行布尔运算的**唯一公共接口**。它提供了四个重载版本，形成两个维度的组合：

```
                    ┌─────────────────────────────────┐
                    │       输出格式维度               │
                    │                                 │
                    │  Paths（平面列表）    PolyTree   │
                    │      ↓                    ↓     │
            ┌───────┼──────┼────────────────────┼─────┤
 填充规则   │ 单一   │  重载1                 重载2    │
   维度     │ 填充   │  Execute(clip,paths,   Execute  │
            │ 规则   │         fill)          (clip,   │
            │        │                       tree,    │
            │        │                       fill)    │
            ├────────┼──────┼────────────────────┼─────┤
            │ 分别   │  重载3                 重载4    │
            │ 指定   │  Execute(clip,paths,   Execute  │
            │ 填充   │    subjFill,clipFill)  (clip,   │
            │ 规则   │                       tree,    │
            │        │                       sFill,   │
            │        │                       cFill)   │
            └────────┴──────┴────────────────────┴─────┘
```

### 9.8.1 重载 1：Paths + 单一填充规则

```csharp
public bool Execute(ClipType clipType, Paths solution,
    PolyFillType FillType = PolyFillType.pftEvenOdd)
{
    return Execute(clipType, solution, FillType, FillType);
}
```

**分析**：这是一个**便捷重载**——当主体多边形和裁剪多边形使用相同的填充规则时，只需传一个 `FillType` 参数。它内部转发给重载 3（四参数版本），将同一个 `FillType` 传递给 `subjFillType` 和 `clipFillType`。

**参数**：

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `clipType` | `ClipType` | 无 | 布尔运算类型：`ctIntersection`、`ctUnion`、`ctDifference`、`ctXor` |
| `solution` | `Paths` | 无 | 输出路径列表（调用前不需要清空，方法内部会清空） |
| `FillType` | `PolyFillType` | `pftEvenOdd` | 填充规则，同时用于主体和裁剪多边形 |

### 9.8.2 重载 2：PolyTree + 单一填充规则

```csharp
public bool Execute(ClipType clipType, PolyTree polytree,
    PolyFillType FillType = PolyFillType.pftEvenOdd)
{
    return Execute(clipType, polytree, FillType, FillType);
}
```

**分析**：与重载 1 类似的便捷重载，但输出到 `PolyTree` 而非 `Paths`。转发给重载 4。

### 9.8.3 重载 3：Paths + 分别指定填充规则 ★ 核心实现

```csharp
public bool Execute(ClipType clipType, Paths solution,
    PolyFillType subjFillType, PolyFillType clipFillType)
{
    if (m_ExecuteLocked) return false;
    if (m_HasOpenPaths) throw
      new ClipperException("Error: PolyTree struct is needed for open path clipping.");
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

#### 逐行详解

```csharp
if (m_ExecuteLocked) return false;
```
**防重入检查**：如果另一个 Execute 正在执行中，直接返回 `false`。这确保了线程安全性的基本保障（虽然不是完全线程安全，因为没有使用 `lock`）。

```csharp
if (m_HasOpenPaths) throw
  new ClipperException("Error: PolyTree struct is needed for open path clipping.");
```
**开放路径检查**：如果输入中包含开放路径（`AddPath` 时 `PolyType` 为 `ptSubject` 且路径未闭合），则**必须**使用 `PolyTree` 作为输出格式。因为 `Paths`（平面列表）无法表达开放路径和闭合路径的区别，而 `PolyTree` 的 `PolyNode.IsOpen` 属性可以标记开放路径。

```csharp
m_ExecuteLocked = true;
```
**加锁**：设置执行锁标志。

```csharp
solution.Clear();
```
**清空输出**：确保输出列表是空的，即使调用方传入了非空列表。

```csharp
m_SubjFillType = subjFillType;
m_ClipFillType = clipFillType;
m_ClipType = clipType;
m_UsingPolyTree = false;
```
**保存运算参数**：将参数保存到成员字段，供后续方法（特别是 `ExecuteInternal` 及其调用的子方法）使用。注意 `m_UsingPolyTree = false`，因为这个重载输出到 `Paths`。

```csharp
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
```
**核心执行与清理**：

1. 调用 `ExecuteInternal()` 执行扫描线算法。
2. 如果成功，调用 `BuildResult()` 将内部的 `OutRec` 链表转换为用户可用的 `Paths`。
3. **无论成功与否**（`finally` 块），都清理所有输出多边形点（`DisposeAllPolyPts()`）并解锁（`m_ExecuteLocked = false`）。

### 9.8.4 重载 4：PolyTree + 分别指定填充规则 ★ 核心实现

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

#### 与重载 3 的关键差异

| 差异点 | 重载 3（Paths） | 重载 4（PolyTree） |
|:---|:---|:---|
| 开放路径检查 | **有**——抛异常 | **无**——PolyTree 支持开放路径 |
| `solution.Clear()` | 调用 | 不调用（PolyTree.Clear 在 BuildResult2 内部处理） |
| `m_UsingPolyTree` | `false` | `true` |
| 结果构建方法 | `BuildResult(solution)` | `BuildResult2(polytree)` |

注意重载 4 **不检查** `m_HasOpenPaths`，因为 `PolyTree` 可以正确表达开放路径。

### 9.8.5 Execute 执行流程总图

```
  用户调用 Execute(clipType, solution/polytree, fillType, ...)
         │
         ▼
  ┌──────────────────────────┐
  │  m_ExecuteLocked == true?│─── Yes ──→ return false
  └──────────┬───────────────┘
             │ No
             ▼
  ┌──────────────────────────┐
  │  (仅 Paths 版本)        │
  │  m_HasOpenPaths?         │─── Yes ──→ throw ClipperException
  └──────────┬───────────────┘
             │ No
             ▼
  ┌──────────────────────────┐
  │  m_ExecuteLocked = true  │ ← 加锁
  │  保存运算参数            │
  │  设置 m_UsingPolyTree    │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │   ExecuteInternal()      │ ← 核心扫描线算法
  │   ┌────────────────────┐ │
  │   │ Reset()            │ │
  │   │ 扫描线主循环       │ │
  │   │ 修复方向           │ │
  │   │ JoinCommonEdges()  │ │
  │   │ 修复输出多边形     │ │
  │   │ DoSimplePolygons() │ │
  │   └────────────────────┘ │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │  succeeded == true?      │
  │  Yes → BuildResult()     │  或 BuildResult2()
  │        构建输出结果      │
  └──────────┬───────────────┘
             │
             ▼ (finally)
  ┌──────────────────────────┐
  │  DisposeAllPolyPts()     │ ← 清理内存
  │  m_ExecuteLocked = false │ ← 解锁
  └──────────┬───────────────┘
             │
             ▼
       return succeeded
```

---

## 9.9 m_ExecuteLocked 防重入机制

### 9.9.1 问题场景

为什么需要防重入？考虑以下场景：

```csharp
Clipper c = new Clipper();
c.AddPath(subj, PolyType.ptSubject, true);
c.AddPath(clip, PolyType.ptClip, true);

// 在多线程环境中，两个线程同时调用 Execute
// 线程 A:
Task.Run(() => c.Execute(ClipType.ctIntersection, resultA));
// 线程 B:
Task.Run(() => c.Execute(ClipType.ctUnion, resultB));
```

如果没有 `m_ExecuteLocked` 保护，两个线程会同时修改 `m_ClipType`、`m_SubjFillType` 等共享状态，导致不可预测的结果。

### 9.9.2 锁的生命周期

```
         Execute() 入口
              │
              ▼
     检查 m_ExecuteLocked
     ┌─── true ───→ return false（拒绝重入）
     │
     │ false
     ▼
     m_ExecuteLocked = true  ← ── ── ── ── ── ── 加锁时刻
              │
              ▼
        ExecuteInternal()
              │
              ▼
        BuildResult/BuildResult2
              │
              ▼ (finally 块，无论异常与否)
     DisposeAllPolyPts()
     m_ExecuteLocked = false ← ── ── ── ── ── ── 解锁时刻
              │
              ▼
        return succeeded
```

### 9.9.3 注意事项

`m_ExecuteLocked` 不是真正的线程同步原语（如 `Mutex` 或 `lock`）。它只能防止**单线程**环境中的**逻辑重入**（例如在回调中再次调用 Execute），但**不能防止多线程竞态条件**。在多线程环境中使用 Clipper 时，应该为每个线程创建独立的 Clipper 实例，或在外部使用 `lock` 保护。

---

## 9.10 FixHoleLinkage() — 修复孔洞父子关系

### 9.10.1 源码

```csharp
internal void FixHoleLinkage(OutRec outRec)
{
    if (outRec.FirstLeft == null ||
          (outRec.IsHole != outRec.FirstLeft.IsHole &&
          outRec.FirstLeft.Pts != null)) return;
    OutRec orfl = outRec.FirstLeft;
    while (orfl != null && ((orfl.IsHole == outRec.IsHole) || orfl.Pts == null))
        orfl = orfl.FirstLeft;
    outRec.FirstLeft = orfl;
}
```

### 9.10.2 背景知识

在多边形布尔运算中，输出结果可能包含**外轮廓**（outer contour）和**孔洞**（hole）。在 PolyTree 输出模式中，孔洞需要正确地关联到其父外轮廓。`FirstLeft` 字段指向当前 `OutRec` 的"第一个左侧"输出记录，用于建立孔洞的父子关系。

### 9.10.3 逐行解读

```csharp
if (outRec.FirstLeft == null ||
      (outRec.IsHole != outRec.FirstLeft.IsHole &&
      outRec.FirstLeft.Pts != null)) return;
```

**快速返回条件**——在以下情况下不需要修复：
1. `FirstLeft` 为 `null`：没有父记录，无需修复。
2. `outRec.IsHole != outRec.FirstLeft.IsHole` **且** `outRec.FirstLeft.Pts != null`：
   - 孔洞和其 `FirstLeft` 的孔洞状态不同（一个是孔洞，一个不是），说明父子关系正确。
   - 并且 `FirstLeft` 不是空的（有实际的多边形点），说明它是一个有效的父记录。

```csharp
OutRec orfl = outRec.FirstLeft;
while (orfl != null && ((orfl.IsHole == outRec.IsHole) || orfl.Pts == null))
    orfl = orfl.FirstLeft;
outRec.FirstLeft = orfl;
```

**沿着 FirstLeft 链向上查找**，直到找到一个满足以下条件的祖先记录：
- `orfl.IsHole != outRec.IsHole`：孔洞状态不同（外轮廓的 FirstLeft 应该是孔洞，反之亦然）
- `orfl.Pts != null`：该记录是有效的（有实际的多边形点）

如果找不到满足条件的祖先（`orfl` 遍历到 `null`），则 `outRec.FirstLeft = null`，表示该记录是顶层记录。

### 9.10.4 图解

```
修复前:
  OutRec A (外轮廓)
    └── FirstLeft → OutRec B (外轮廓, Pts=null)   ← 无效！
                      └── FirstLeft → OutRec C (孔洞, Pts≠null) ← 有效但类型错
                                        └── FirstLeft → OutRec D (外轮廓, Pts≠null) ← 正确！

修复后:
  OutRec A (外轮廓)
    └── FirstLeft → null   （因为沿链查找未找到 IsHole!=外轮廓 且 Pts≠null 的记录）
    
注：上例中，如果 A 是孔洞：
  OutRec A (孔洞)
    └── FirstLeft → OutRec D (外轮廓, Pts≠null)   ← 跳过 B(无点)和 C(同为孔洞)
```

---

## 9.11 ExecuteInternal() — 核心算法主循环 ★★★

### 9.11.1 源码

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
        //fix orientations ...
        foreach (OutRec outRec in m_PolyOuts)
        {
            if (outRec.Pts == null || outRec.IsOpen) continue;
            if ((outRec.IsHole ^ ReverseSolution) == (Area(outRec) > 0))
                ReversePolyPtLinks(outRec.Pts);
        }
        JoinCommonEdges();
        foreach (OutRec outRec in m_PolyOuts)
        {
            if (outRec.Pts == null) continue;
            else if (outRec.IsOpen) FixupOutPolyline(outRec);
            else FixupOutPolygon(outRec);
        }
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

### 9.11.2 整体流程分解

`ExecuteInternal` 是 Clipper 算法的**心脏**，它实现了 Vatti 扫描线多边形裁剪算法的主循环。整个执行过程可以分为三个大阶段：

#### 阶段一：初始化

```csharp
Reset();                        // 重置所有状态（来自 ClipperBase）
m_SortedEdges = null;          // 清空排序边
m_Maxima = null;               // 清空极大值链表
cInt botY, topY;               // 声明扫描线 Y 坐标变量
if (!PopScanbeam(out botY))    // 弹出第一个扫描线 Y 坐标
    return false;              // 如果没有扫描事件，直接返回失败
InsertLocalMinimaIntoAEL(botY); // 将第一个扫描线处的局部最小值插入 AEL
```

`Reset()` 来自基类 `ClipperBase`，它重新构建扫描束、清理活动边表等。`PopScanbeam` 弹出 Y 坐标最小的扫描事件（扫描线从底部向上推进）。

#### 阶段二：扫描线主循环

```csharp
while (PopScanbeam(out topY) || LocalMinimaPending())
{
    ProcessHorizontals();
    m_GhostJoins.Clear();
    if (!ProcessIntersections(topY)) return false;
    ProcessEdgesAtTopOfScanbeam(topY);
    botY = topY;
    InsertLocalMinimaIntoAEL(botY);
}
```

这是算法的核心循环。每次迭代处理一个**扫描带**（scanbeam）——从 `botY` 到 `topY` 的水平带状区域。

#### 阶段三：后处理

```csharp
// 修复方向
foreach (OutRec outRec in m_PolyOuts) { ... }
// 合并共享边
JoinCommonEdges();
// 修复输出多边形
foreach (OutRec outRec in m_PolyOuts) { ... }
// 严格简单多边形处理
if (StrictlySimple) DoSimplePolygons();
```

### 9.11.3 扫描线主循环详解

#### 循环条件

```csharp
while (PopScanbeam(out topY) || LocalMinimaPending())
```

循环在以下任一条件为真时继续：
- `PopScanbeam(out topY)` 返回 `true`：仍有扫描事件待处理。
- `LocalMinimaPending()` 返回 `true`：仍有局部最小值未处理。

后者的存在是因为 `InsertLocalMinimaIntoAEL` 可能会往扫描束中插入新的事件，形成"扫描束和局部最小值互相喂食"的循环。

#### 循环体详解

| 步骤 | 方法调用 | 职责 |
|:---:|:---|:---|
| 1 | `ProcessHorizontals()` | 处理当前 AEL 中的所有水平边 |
| 2 | `m_GhostJoins.Clear()` | 清空幽灵连接列表（水平边处理中可能添加了幽灵连接） |
| 3 | `ProcessIntersections(topY)` | 检测 botY 到 topY 之间的边交点并处理 |
| 4 | `ProcessEdgesAtTopOfScanbeam(topY)` | 处理到达 topY 的边顶部事件 |
| 5 | `botY = topY` | 更新底部 Y 坐标 |
| 6 | `InsertLocalMinimaIntoAEL(botY)` | 将新扫描线处的局部最小值插入 AEL |

### 9.11.4 ExecuteInternal 管线流程图 (ASCII)

```
╔══════════════════════════════════════════════════════════════════════╗
║                    ExecuteInternal() 管线                            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │                    阶段一：初始化                             │    ║
║  │                                                             │    ║
║  │  Reset() ──→ 重建扫描束，清理 AEL                          │    ║
║  │      │                                                      │    ║
║  │      ▼                                                      │    ║
║  │  PopScanbeam(botY) ──→ 获取第一个 Y 坐标                   │    ║
║  │      │                                                      │    ║
║  │      ▼                                                      │    ║
║  │  InsertLocalMinimaIntoAEL(botY) ──→ 初始化 AEL             │    ║
║  └──────┬──────────────────────────────────────────────────────┘    ║
║         │                                                            ║
║         ▼                                                            ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │          阶段二：扫描线主循环                                 │    ║
║  │                                                             │    ║
║  │  while (PopScanbeam(topY) || LocalMinimaPending())          │    ║
║  │  ┌──────────────────────────────────────────────────────┐   │    ║
║  │  │                                                      │   │    ║
║  │  │  ①  ProcessHorizontals()                             │   │    ║
║  │  │      处理 AEL 中的水平边                              │   │    ║
║  │  │              │                                       │   │    ║
║  │  │              ▼                                       │   │    ║
║  │  │  ②  m_GhostJoins.Clear()                            │   │    ║
║  │  │      清空幽灵连接                                    │   │    ║
║  │  │              │                                       │   │    ║
║  │  │              ▼                                       │   │    ║
║  │  │  ③  ProcessIntersections(topY)                       │   │    ║
║  │  │      检测并处理 [botY, topY] 之间的交点              │   │    ║
║  │  │              │                                       │   │    ║
║  │  │              ▼                                       │   │    ║
║  │  │  ④  ProcessEdgesAtTopOfScanbeam(topY)                │   │    ║
║  │  │      处理边的顶部事件                                │   │    ║
║  │  │              │                                       │   │    ║
║  │  │              ▼                                       │   │    ║
║  │  │  ⑤  botY = topY                                     │   │    ║
║  │  │      推进扫描线                                      │   │    ║
║  │  │              │                                       │   │    ║
║  │  │              ▼                                       │   │    ║
║  │  │  ⑥  InsertLocalMinimaIntoAEL(botY)                  │   │    ║
║  │  │      插入新的局部最小值                              │   │    ║
║  │  │              │                                       │   │    ║
║  │  │              └──────→ 回到循环条件判断               │   │    ║
║  │  └──────────────────────────────────────────────────────┘   │    ║
║  └──────┬──────────────────────────────────────────────────────┘    ║
║         │                                                            ║
║         ▼                                                            ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │              阶段三：后处理                                   │    ║
║  │                                                             │    ║
║  │  ⑦  修复方向：遍历 m_PolyOuts                              │    ║
║  │      对于每个非开放、非空的 OutRec：                        │    ║
║  │      如果方向不正确 → ReversePolyPtLinks()                  │    ║
║  │              │                                              │    ║
║  │              ▼                                              │    ║
║  │  ⑧  JoinCommonEdges()                                      │    ║
║  │      合并共享边的输出多边形                                  │    ║
║  │              │                                              │    ║
║  │              ▼                                              │    ║
║  │  ⑨  修复输出多边形：遍历 m_PolyOuts                        │    ║
║  │      开放路径 → FixupOutPolyline()                          │    ║
║  │      闭合路径 → FixupOutPolygon()                           │    ║
║  │              │                                              │    ║
║  │              ▼                                              │    ║
║  │  ⑩  if (StrictlySimple) DoSimplePolygons()                  │    ║
║  │      确保输出多边形严格简单                                  │    ║
║  └──────┬──────────────────────────────────────────────────────┘    ║
║         │                                                            ║
║         ▼                                                            ║
║    return true                                                       ║
║                                                                      ║
║  [finally 块]                                                        ║
║    m_Joins.Clear()                                                   ║
║    m_GhostJoins.Clear()                                              ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 9.11.5 方向修复逻辑详解

```csharp
foreach (OutRec outRec in m_PolyOuts)
{
    if (outRec.Pts == null || outRec.IsOpen) continue;
    if ((outRec.IsHole ^ ReverseSolution) == (Area(outRec) > 0))
        ReversePolyPtLinks(outRec.Pts);
}
```

这段代码修复输出多边形的方向（顺时针/逆时针）。逻辑如下：

| `outRec.IsHole` | `ReverseSolution` | `IsHole ^ Reverse` | 期望面积符号 | 条件含义 |
|:---:|:---:|:---:|:---:|:---|
| false | false | false | `Area < 0`（顺时针） | 外轮廓默认顺时针 |
| false | true | true | `Area > 0`（逆时针） | 反转：外轮廓变逆时针 |
| true | false | true | `Area > 0`（逆时针） | 孔洞默认逆时针 |
| true | true | false | `Area < 0`（顺时针） | 反转：孔洞变顺时针 |

当 `(IsHole ^ ReverseSolution) == (Area(outRec) > 0)` 时，说明**当前方向是错误的**，需要反转。

这个条件的理解关键在于：
- 在 Clipper 的坐标系中，**正面积**表示逆时针（CCW），**负面积**表示顺时针（CW）。
- 默认情况下（`ReverseSolution = false`），外轮廓应该是顺时针（负面积），孔洞应该是逆时针（正面积）。
- 异或 `^` 运算巧妙地将四种组合统一到一个条件表达式中。

### 9.11.6 后处理阶段详解

```csharp
JoinCommonEdges();
```
合并共享边缘的输出多边形。这在 Union 运算中特别重要——两个相邻多边形的共享边应该被消除，使它们合并为一个多边形。

```csharp
foreach (OutRec outRec in m_PolyOuts)
{
    if (outRec.Pts == null) continue;
    else if (outRec.IsOpen) FixupOutPolyline(outRec);
    else FixupOutPolygon(outRec);
}
```
对每个输出记录进行最后的清理：
- **空记录**（`Pts == null`）：跳过。
- **开放路径**：调用 `FixupOutPolyline` 修复开放路径线段。
- **闭合路径**：调用 `FixupOutPolygon` 删除重复点、共线点等。

```csharp
if (StrictlySimple) DoSimplePolygons();
```
如果用户要求严格简单输出，执行 `DoSimplePolygons`——该方法会检测自交点并将自交多边形拆分为多个简单多边形。

### 9.11.7 finally 块

```csharp
finally
{
    m_Joins.Clear();
    m_GhostJoins.Clear();
}
```

无论算法是否成功完成（或中途异常返回 `false`），都会清理连接列表。这确保了下次调用 `Execute` 时不会残留上次的连接信息。

---

## 9.12 DisposeAllPolyPts() — 清理输出多边形

### 9.12.1 源码

```csharp
private void DisposeAllPolyPts()
{
    for (int i = 0; i < m_PolyOuts.Count; ++i) DisposeOutRec(i);
    m_PolyOuts.Clear();
}
```

### 9.12.2 解读

该方法在 `Execute` 的 `finally` 块中调用，负责清理所有输出多边形记录。

| 操作 | 说明 |
|:---|:---|
| `DisposeOutRec(i)` | 释放第 i 个 `OutRec` 的所有 `OutPt` 节点（来自基类） |
| `m_PolyOuts.Clear()` | 清空输出记录列表本身 |

注意此方法在 `BuildResult` / `BuildResult2` **之后**调用。也就是说，结果数据已经被复制到用户的 `Paths` 或 `PolyTree` 中了，此时释放内部数据是安全的。

这种"先复制结果、再释放内部数据"的模式确保了：
1. 用户得到完整的结果。
2. Clipper 内部状态被完全清理，为下一次 Execute 调用做好准备。

---

## 9.13 AddJoin() 和 AddGhostJoin()

### 9.13.1 源码

```csharp
private void AddJoin(OutPt Op1, OutPt Op2, IntPoint OffPt)
{
    Join j = new Join();
    j.OutPt1 = Op1;
    j.OutPt2 = Op2;
    j.OffPt = OffPt;
    m_Joins.Add(j);
}

private void AddGhostJoin(OutPt Op, IntPoint OffPt)
{
    Join j = new Join();
    j.OutPt1 = Op;
    j.OffPt = OffPt;
    m_GhostJoins.Add(j);
}
```

### 9.13.2 什么是 Join？

在扫描线算法中，当两条边共享同一段路径（例如两个多边形的公共边），它们的输出点可能分属不同的 `OutRec`。`Join` 结构记录了这种关联，以便在后处理阶段（`JoinCommonEdges`）中将它们合并。

### 9.13.3 Join 结构

```
Join {
    OutPt1: 第一个输出点（属于某个 OutRec）
    OutPt2: 第二个输出点（属于另一个 OutRec，仅 AddJoin 设置）
    OffPt:  偏移点（用于确定连接位置的参考坐标）
}
```

### 9.13.4 AddJoin vs AddGhostJoin 对比

| 特性 | AddJoin | AddGhostJoin |
|:---|:---|:---|
| 参数个数 | 3（Op1, Op2, OffPt） | 2（Op, OffPt） |
| 存储位置 | `m_Joins` | `m_GhostJoins` |
| 设置 OutPt2 | 是 | 否 |
| 用途 | 记录正式的边共享关系 | 记录水平边处理中的临时连接 |
| 生命周期 | 整个 ExecuteInternal() | 每个扫描带清空一次 |
| 使用时机 | `InsertLocalMinimaIntoAEL`、`ProcessEdgesAtTopOfScanbeam` | `ProcessHorizontals` 中检测到的水平边连接 |

### 9.13.5 为什么需要"幽灵连接"？

水平边的处理与普通边不同——它们在同一个 Y 坐标上横跨多个 X 坐标。在处理水平边时，可能检测到需要连接的点，但此时还不知道另一端的输出点是什么。`GhostJoin` 暂时记录这些"半成品"连接，在下一个扫描带处理时将其转化为正式的 `Join`（或丢弃）。

这就是为什么在主循环中，`ProcessHorizontals()` 之后紧跟 `m_GhostJoins.Clear()`。

---

## 9.14 SetZ() — 三维坐标支持

### 9.14.1 源码

```csharp
#if use_xyz
internal void SetZ(ref IntPoint pt, TEdge e1, TEdge e2)
{
    if (pt.Z != 0 || ZFillFunction == null) return;
    else if (pt == e1.Bot) pt.Z = e1.Bot.Z;
    else if (pt == e1.Top) pt.Z = e1.Top.Z;
    else if (pt == e2.Bot) pt.Z = e2.Bot.Z;
    else if (pt == e2.Top) pt.Z = e2.Top.Z;
    else ZFillFunction(e1.Bot, e1.Top, e2.Bot, e2.Top, ref pt);
}
#endif
```

### 9.14.2 条件编译说明

`SetZ` 只在定义了 `use_xyz` 编译符号时才编译。默认情况下 Clipper 是二维的（只处理 X 和 Y 坐标），但通过启用 `use_xyz`，可以支持三维坐标。

### 9.14.3 Z 坐标填充逻辑

当两条边产生交点时，交点的 X 和 Y 坐标由几何计算确定，但 Z 坐标需要通过 `SetZ` 方法填充：

```
交点 pt 的 Z 坐标填充决策树:

  pt.Z != 0?  ──── Yes ──→ 不修改（已有 Z 值）
       │
       No
       ▼
  ZFillFunction == null?  ── Yes ──→ 不修改（无回调）
       │
       No
       ▼
  pt == e1.Bot?  ── Yes ──→ pt.Z = e1.Bot.Z（继承边1底部的Z）
       │
       No
       ▼
  pt == e1.Top?  ── Yes ──→ pt.Z = e1.Top.Z（继承边1顶部的Z）
       │
       No
       ▼
  pt == e2.Bot?  ── Yes ──→ pt.Z = e2.Bot.Z（继承边2底部的Z）
       │
       No
       ▼
  pt == e2.Top?  ── Yes ──→ pt.Z = e2.Top.Z（继承边2顶部的Z）
       │
       No
       ▼
  调用 ZFillFunction(e1.Bot, e1.Top, e2.Bot, e2.Top, ref pt)
  → 由用户自定义回调函数计算 Z 值
```

### 9.14.4 设计分析

这个方法体现了 Clipper 的**扩展性设计**：

1. **优先使用已知的 Z 值**：如果交点恰好是某条边的端点，直接继承该端点的 Z 值。
2. **回退到用户回调**：如果交点是"新的"（不是任何端点），则调用用户注册的 `ZFillFunction` 回调。
3. **graceful 降级**：如果没有注册回调，Z 值保持为 0。

用户可以通过设置 `ZFillFunction` 实现自定义的 Z 插值逻辑，例如**线性插值**：

```csharp
clipper.ZFillFunction = (IntPoint bot1, IntPoint top1, 
    IntPoint bot2, IntPoint top2, ref IntPoint pt) =>
{
    // 简单的线性插值示例
    if (bot1.Z == top1.Z)
        pt.Z = bot1.Z;
    else
    {
        double t = (double)(pt.Y - bot1.Y) / (top1.Y - bot1.Y);
        pt.Z = (cInt)(bot1.Z + t * (top1.Z - bot1.Z));
    }
};
```

---

## 9.15 BuildResult() — 构建平面路径结果

### 9.15.1 源码

```csharp
private void BuildResult(Paths polyg)
{
    polyg.Clear();
    polyg.Capacity = m_PolyOuts.Count;
    for (int i = 0; i < m_PolyOuts.Count; i++)
    {
        OutRec outRec = m_PolyOuts[i];
        if (outRec.Pts == null) continue;
        OutPt p = outRec.Pts.Prev;
        int cnt = PointCount(p);
        if (cnt < 2) continue;
        Path pg = new Path(cnt);
        for (int j = 0; j < cnt; j++)
        {
            pg.Add(p.Pt);
            p = p.Prev;
        }
        polyg.Add(pg);
    }
}
```

### 9.15.2 逐行详解

```csharp
polyg.Clear();
```
清空输出列表（与 Execute 中的 `solution.Clear()` 冗余，但防御性编程）。

```csharp
polyg.Capacity = m_PolyOuts.Count;
```
**预分配容量**：提前设置列表容量以避免动态扩容带来的内存重新分配。这是一个性能优化。

```csharp
for (int i = 0; i < m_PolyOuts.Count; i++)
{
    OutRec outRec = m_PolyOuts[i];
    if (outRec.Pts == null) continue;  // 跳过空记录
```
遍历所有输出记录，跳过没有实际点的记录。

```csharp
    OutPt p = outRec.Pts.Prev;
    int cnt = PointCount(p);
    if (cnt < 2) continue;  // 跳过退化多边形（少于2个点）
```
从 `outRec.Pts.Prev` 开始遍历。为什么是 `Prev` 而不是直接从 `Pts` 开始？因为 `OutPt` 是一个**环形双向链表**，`Pts` 指向链表中的某个节点，而从 `Pts.Prev` 开始并沿 `Prev` 方向遍历可以得到正确的顶点顺序。

```csharp
    Path pg = new Path(cnt);
    for (int j = 0; j < cnt; j++)
    {
        pg.Add(p.Pt);
        p = p.Prev;
    }
    polyg.Add(pg);
```
创建一个新的 Path，从 `p` 开始沿 `Prev` 方向遍历环形链表，将每个点的坐标添加到 Path 中。

### 9.15.3 数据转换图

```
内部表示 (OutRec + OutPt 环形链表):

  m_PolyOuts[0]:
    OutRec.Pts → [P2] ↔ [P3] ↔ [P4] ↔ [P1] ↔ [P2]（环形）
                                              ↑
                                        OutRec.Pts.Prev = [P1]
    
    遍历顺序（从 Pts.Prev 沿 Prev 方向）:
    P1 → P4 → P3 → P2
    
  m_PolyOuts[1]:
    OutRec.Pts = null  → 跳过
    
  m_PolyOuts[2]:
    OutRec.Pts → [Q1] ↔ [Q2] ↔ [Q3] ↔ [Q1]（环形）
    
    遍历顺序: Q3 → Q2 → Q1

输出结果 (Paths):

  polyg[0] = { P1, P4, P3, P2 }
  polyg[1] = { Q3, Q2, Q1 }
```

### 9.15.4 性能考量

| 优化手段 | 说明 |
|:---|:---|
| `polyg.Capacity = m_PolyOuts.Count` | 预分配列表容量，避免动态扩容 |
| `new Path(cnt)` | 用精确容量创建 Path，避免过度分配 |
| 跳过空/退化记录 | 减少不必要的内存分配 |

---

## 9.16 BuildResult2() — 构建层次化 PolyTree 结果

### 9.16.1 源码

```csharp
private void BuildResult2(PolyTree polytree)
{
    polytree.Clear();
    polytree.m_AllPolys.Capacity = m_PolyOuts.Count;
    for (int i = 0; i < m_PolyOuts.Count; i++)
    {
        OutRec outRec = m_PolyOuts[i];
        int cnt = PointCount(outRec.Pts);
        if ((outRec.IsOpen && cnt < 2) ||
          (!outRec.IsOpen && cnt < 3)) continue;
        FixHoleLinkage(outRec);
        PolyNode pn = new PolyNode();
        polytree.m_AllPolys.Add(pn);
        outRec.PolyNode = pn;
        pn.m_polygon.Capacity = cnt;
        OutPt op = outRec.Pts.Prev;
        for (int j = 0; j < cnt; j++)
        {
            pn.m_polygon.Add(op.Pt);
            op = op.Prev;
        }
    }
    polytree.m_Childs.Capacity = m_PolyOuts.Count;
    for (int i = 0; i < m_PolyOuts.Count; i++)
    {
        OutRec outRec = m_PolyOuts[i];
        if (outRec.PolyNode == null) continue;
        else if (outRec.IsOpen)
        {
            outRec.PolyNode.IsOpen = true;
            polytree.AddChild(outRec.PolyNode);
        }
        else if (outRec.FirstLeft != null &&
          outRec.FirstLeft.PolyNode != null)
            outRec.FirstLeft.PolyNode.AddChild(outRec.PolyNode);
        else
            polytree.AddChild(outRec.PolyNode);
    }
}
```

### 9.16.2 两阶段处理

`BuildResult2` 分为**两个阶段**：

#### 阶段一：创建 PolyNode 并填充顶点数据

```csharp
for (int i = 0; i < m_PolyOuts.Count; i++)
{
    OutRec outRec = m_PolyOuts[i];
    int cnt = PointCount(outRec.Pts);
    // 有效性检查：开放路径至少 2 点，闭合路径至少 3 点
    if ((outRec.IsOpen && cnt < 2) ||
      (!outRec.IsOpen && cnt < 3)) continue;
    FixHoleLinkage(outRec);      // 修复孔洞关系
    PolyNode pn = new PolyNode();
    polytree.m_AllPolys.Add(pn); // 加入全局节点列表
    outRec.PolyNode = pn;        // 双向关联
    pn.m_polygon.Capacity = cnt; // 预分配
    OutPt op = outRec.Pts.Prev;
    for (int j = 0; j < cnt; j++)
    {
        pn.m_polygon.Add(op.Pt);
        op = op.Prev;
    }
}
```

注意**有效性检查**的差异：
- **开放路径**（`IsOpen == true`）：至少需要 2 个点（一条线段）。
- **闭合路径**（`IsOpen == false`）：至少需要 3 个点（一个三角形）。

这比 `BuildResult` 中的 `cnt < 2` 检查更精细。

#### 阶段二：构建父子层次关系

```csharp
for (int i = 0; i < m_PolyOuts.Count; i++)
{
    OutRec outRec = m_PolyOuts[i];
    if (outRec.PolyNode == null) continue;     // 跳过无效记录
    else if (outRec.IsOpen)
    {
        outRec.PolyNode.IsOpen = true;
        polytree.AddChild(outRec.PolyNode);     // 开放路径直接加到根节点
    }
    else if (outRec.FirstLeft != null &&
      outRec.FirstLeft.PolyNode != null)
        outRec.FirstLeft.PolyNode.AddChild(outRec.PolyNode);  // 加到父节点
    else
        polytree.AddChild(outRec.PolyNode);     // 无父节点，加到根节点
}
```

### 9.16.3 PolyTree 层次构建逻辑

```
决策树:

  outRec.PolyNode == null?
      │ Yes → 跳过
      │ No
      ▼
  outRec.IsOpen?
      │ Yes → 标记为开放路径，直接加到根节点
      │ No
      ▼
  outRec.FirstLeft != null && outRec.FirstLeft.PolyNode != null?
      │ Yes → 加到 FirstLeft 的 PolyNode 下作为子节点
      │ No
      ▼
  加到根节点（polytree）下作为子节点
```

### 9.16.4 PolyTree 示例

```
假设布尔运算产生以下输出：
  OutRec[0]: 外轮廓 A, FirstLeft = null
  OutRec[1]: 孔洞 B, FirstLeft = OutRec[0]
  OutRec[2]: 孔洞内的岛 C, FirstLeft = OutRec[1]
  OutRec[3]: 开放路径 D
  OutRec[4]: 外轮廓 E, FirstLeft = null

构建的 PolyTree:

  polytree (根)
    ├── PolyNode A (外轮廓)
    │     └── PolyNode B (孔洞)
    │           └── PolyNode C (孔洞内的岛)
    ├── PolyNode D (开放路径, IsOpen=true)
    └── PolyNode E (外轮廓)
```

### 9.16.5 BuildResult vs BuildResult2 对比

| 特性 | BuildResult (Paths) | BuildResult2 (PolyTree) |
|:---|:---|:---|
| 输出格式 | 平面列表 | 层次树 |
| 孔洞信息 | 丢失 | 保留 |
| 开放路径 | 不支持 | 支持（`IsOpen` 标记） |
| 有效性检查 | `cnt < 2` | 开放 `cnt < 2`，闭合 `cnt < 3` |
| 调用 FixHoleLinkage | 否 | 是 |
| 性能 | 更快（无层次构建） | 稍慢（需构建父子关系） |
| 适用场景 | 简单裁剪 | 需要孔洞信息或开放路径的场景 |

---

## 9.17 静态工具方法

### 9.17.1 ReversePaths

```csharp
public static void ReversePaths(Paths polys)
{
    foreach (var poly in polys) { poly.Reverse(); }
}
```

**功能**：反转 `Paths` 中每条路径的顶点顺序。这会将顺时针路径变为逆时针，反之亦然。

**使用场景**：当用户需要手动调整输出多边形的方向时（例如，某些渲染引擎要求特定的绕行方向）。

### 9.17.2 Orientation

```csharp
public static bool Orientation(Path poly)
{
    return Area(poly) >= 0;
}
```

**功能**：判断路径的方向。返回 `true` 表示逆时针（正面积），`false` 表示顺时针（负面积）。

**注意**：在 Clipper 的坐标系（Y 轴向上）中：
- 正面积 → 逆时针（CCW）
- 负面积 → 顺时针（CW）

如果 Y 轴向下（如屏幕坐标系），方向判断相反。

### 9.17.3 Area(Path) — 静态版本

```csharp
public static double Area(Path poly)
{
    int cnt = (int)poly.Count;
    if (cnt < 3) return 0;
    double a = 0;
    for (int i = 0, j = cnt - 1; i < cnt; ++i)
    {
        a += ((double)poly[j].X + poly[i].X) * ((double)poly[j].Y - poly[i].Y);
        j = i;
    }
    return -a * 0.5;
}
```

**算法**：使用**鞋带公式**（Shoelace Formula）计算多边形的有符号面积。

鞋带公式的标准形式为：

```
A = 0.5 * |Σ(x_i * y_{i+1} - x_{i+1} * y_i)|
```

Clipper 使用了一个等价的变形：

```
A = -0.5 * Σ((x_j + x_i) * (y_j - y_i))
```

其中 `j` 是 `i` 的前一个索引（即 `j = i - 1`，环绕到 `cnt - 1`）。

**逐行**：

```csharp
int cnt = (int)poly.Count;     // 顶点数
if (cnt < 3) return 0;         // 少于3个点无法形成面积
double a = 0;                  // 累加器
for (int i = 0, j = cnt - 1; i < cnt; ++i)
{
    // 鞋带公式的等价变形
    a += ((double)poly[j].X + poly[i].X) * ((double)poly[j].Y - poly[i].Y);
    j = i;                     // j 追踪 i 的前一个位置
}
return -a * 0.5;               // 乘以 -0.5 得到有符号面积
```

### 9.17.4 Area(OutRec) — 内部版本

```csharp
internal double Area(OutRec outRec)
{
    return Area(outRec.Pts);
}
```

**功能**：计算 `OutRec` 的面积，转发给 `Area(OutPt)` 版本。

### 9.17.5 Area(OutPt) — 环形链表版本

```csharp
internal double Area(OutPt op)
{
    OutPt opFirst = op;
    if (op == null) return 0;
    double a = 0;
    do
    {
        a = a + (double)(op.Prev.Pt.X + op.Pt.X) * (double)(op.Prev.Pt.Y - op.Pt.Y);
        op = op.Next;
    } while (op != opFirst);
    return a * 0.5;
}
```

**与 Area(Path) 的差异**：
- 输入是 **环形双向链表**（`OutPt`），不是线性列表（`Path`）。
- 使用 `do...while` 循环遍历环形链表。
- 最终乘以 `0.5`（不是 `-0.5`），因为遍历方向与 `Area(Path)` 相反。

### 9.17.6 三个 Area 方法对比

| 方法 | 输入类型 | 访问级别 | 最终系数 | 遍历方式 |
|:---|:---|:---:|:---:|:---|
| `Area(Path)` | `Path`（线性列表） | public static | `-0.5` | for 循环 + 双指针 |
| `Area(OutRec)` | `OutRec` | internal | 转发 | 转发给 Area(OutPt) |
| `Area(OutPt)` | `OutPt`（环形链表） | internal | `+0.5` | do-while 环形遍历 |

---

## 9.18 PointCount() — 环形链表节点计数

### 9.18.1 源码

```csharp
private int PointCount(OutPt pts)
{
    if (pts == null) return 0;
    int result = 0;
    OutPt p = pts;
    do
    {
        result++;
        p = p.Next;
    }
    while (p != pts);
    return result;
}
```

### 9.18.2 详解

该方法计算一个**环形单/双向链表**中的节点数量。

**算法**：从 `pts` 开始，沿 `Next` 方向遍历，每经过一个节点计数加 1，直到回到起始节点。

```
环形链表: [A] → [B] → [C] → [D] → [A]（环形）

遍历过程:
  p = A, result = 1
  p = B, result = 2
  p = C, result = 3
  p = D, result = 4
  p = A == pts → 停止

返回: 4
```

**空检查**：如果 `pts` 为 `null`，返回 0。

**使用场景**：在 `BuildResult` 和 `BuildResult2` 中用于确定输出路径的顶点数量，以便预分配 `Path` 的容量。

---

## 9.19 FixupOutPolygon() — 输出多边形修复

### 9.19.1 源码

```csharp
private void FixupOutPolygon(OutRec outRec)
{
    OutPt lastOK = null;
    outRec.BottomPt = null;
    OutPt pp = outRec.Pts;
    bool preserveCol = PreserveCollinear || StrictlySimple;
    for (; ; )
    {
        if (pp.Prev == pp || pp.Prev == pp.Next)
        {
            outRec.Pts = null;
            return;
        }
        if ((pp.Pt == pp.Next.Pt) || (pp.Pt == pp.Prev.Pt) ||
          (SlopesEqual(pp.Prev.Pt, pp.Pt, pp.Next.Pt, m_UseFullRange) &&
          (!preserveCol || !Pt2IsBetweenPt1AndPt3(pp.Prev.Pt, pp.Pt, pp.Next.Pt))))
        {
            lastOK = null;
            pp.Prev.Next = pp.Next;
            pp.Next.Prev = pp.Prev;
            pp = pp.Prev;
        }
        else if (pp == lastOK) break;
        else
        {
            if (lastOK == null) lastOK = pp;
            pp = pp.Next;
        }
    }
    outRec.Pts = pp;
}
```

### 9.19.2 功能说明

`FixupOutPolygon` 清理输出多边形中的冗余顶点，包括：

1. **重复点**：相邻的两个顶点坐标相同（`pp.Pt == pp.Next.Pt` 或 `pp.Pt == pp.Prev.Pt`）。
2. **共线点**：三个连续顶点在一条直线上（通过 `SlopesEqual` 判断），除非用户要求保留共线点。

### 9.19.3 逐行详解

```csharp
OutPt lastOK = null;
```
`lastOK` 是一个"哨兵"指针，记录上一个确认为有效的点。当 `pp` 再次遇到 `lastOK` 时，说明已经遍历了整个环形链表一圈而没有删除任何点，可以退出循环。

```csharp
outRec.BottomPt = null;
```
重置底部点（将在后续处理中重新计算）。

```csharp
bool preserveCol = PreserveCollinear || StrictlySimple;
```
如果用户要求保留共线点（`PreserveCollinear`）或严格简单（`StrictlySimple`），则不删除共线点。注意 `StrictlySimple` 也会保留共线点，因为 `DoSimplePolygons` 需要这些点来正确检测自交。

#### 退化检查

```csharp
if (pp.Prev == pp || pp.Prev == pp.Next)
{
    outRec.Pts = null;
    return;
}
```
如果环形链表只剩 1 个或 2 个节点（`pp.Prev == pp` 表示只有 1 个，`pp.Prev == pp.Next` 表示只有 2 个），该多边形退化了，将其清空。

#### 删除条件

```csharp
if ((pp.Pt == pp.Next.Pt) || (pp.Pt == pp.Prev.Pt) ||
  (SlopesEqual(pp.Prev.Pt, pp.Pt, pp.Next.Pt, m_UseFullRange) &&
  (!preserveCol || !Pt2IsBetweenPt1AndPt3(pp.Prev.Pt, pp.Pt, pp.Next.Pt))))
```

删除当前点 `pp` 的条件（满足任一即可）：
1. `pp.Pt == pp.Next.Pt`：与后继点坐标相同。
2. `pp.Pt == pp.Prev.Pt`：与前驱点坐标相同。
3. 三点共线（`SlopesEqual`）**且**不需要保留共线点，或者 `pp` 不在 `pp.Prev` 和 `pp.Next` 之间。

#### 删除操作

```csharp
lastOK = null;
pp.Prev.Next = pp.Next;
pp.Next.Prev = pp.Prev;
pp = pp.Prev;
```
标准的双向链表删除操作。删除后重置 `lastOK`，因为删除一个节点可能导致新的相邻点需要再次检查。

#### 环形遍历

```csharp
else if (pp == lastOK) break;
else
{
    if (lastOK == null) lastOK = pp;
    pp = pp.Next;
}
```
如果当前点不需要删除：
- 如果 `pp == lastOK`，说明已经绕了一圈没有删除操作，退出。
- 否则，记录第一个"OK"的点，继续检查下一个。

### 9.19.4 修复过程示例

```
初始多边形（包含重复点和共线点）:

  [A] → [B] → [B] → [C] → [D] → [E] → [A]
                ↑ 重复点   ↑ A,D,E 共线（假设）

第一轮: pp=A → OK（设 lastOK=A）
第二轮: pp=B → OK
第三轮: pp=B(第二个) → 重复！删除 → pp=B(第一个), lastOK=null
第四轮: pp=B → OK（设 lastOK=B）
第五轮: pp=C → OK
第六轮: pp=D → 与 C, E 共线？如果是，删除 → pp=C, lastOK=null
...
继续遍历直到 pp == lastOK

最终结果: [A] → [B] → [C] → [E] → [A]
```

---

## 9.20 DoSimplePolygons() — 严格简单多边形处理

### 9.20.1 源码

```csharp
private void DoSimplePolygons()
{
    int i = 0;
    while (i < m_PolyOuts.Count)
    {
        OutRec outrec = m_PolyOuts[i++];
        OutPt op = outrec.Pts;
        if (op == null || outrec.IsOpen) continue;
        do
        {
            OutPt op2 = op.Next;
            while (op2 != outrec.Pts)
            {
                if ((op.Pt == op2.Pt) && op2.Next != op && op2.Prev != op)
                {
                    OutPt op3 = op.Prev;
                    OutPt op4 = op2.Prev;
                    op.Prev = op4;
                    op4.Next = op;
                    op2.Prev = op3;
                    op3.Next = op2;
                    outrec.Pts = op;
                    OutRec outrec2 = CreateOutRec();
                    outrec2.Pts = op2;
                    UpdateOutPtIdxs(outrec2);
                    if (Poly2ContainsPoly1(outrec2.Pts, outrec.Pts))
                    {
                        outrec2.IsHole = !outrec.IsHole;
                        outrec2.FirstLeft = outrec;
                        if (m_UsingPolyTree) FixupFirstLefts2(outrec2, outrec);
                    }
                    else if (Poly2ContainsPoly1(outrec.Pts, outrec2.Pts))
                    {
                        outrec2.IsHole = outrec.IsHole;
                        outrec.IsHole = !outrec2.IsHole;
                        outrec2.FirstLeft = outrec.FirstLeft;
                        outrec.FirstLeft = outrec2;
                        if (m_UsingPolyTree) FixupFirstLefts2(outrec, outrec2);
                    }
                    else
                    {
                        outrec2.IsHole = outrec.IsHole;
                        outrec2.FirstLeft = outrec.FirstLeft;
                        if (m_UsingPolyTree) FixupFirstLefts1(outrec, outrec2);
                    }
                    op2 = op;
                }
                op2 = op2.Next;
            }
            op = op.Next;
        }
        while (op != outrec.Pts);
    }
}
```

### 9.20.2 功能说明

`DoSimplePolygons` 确保输出多边形是"严格简单的"——即没有自交。如果检测到自交（同一个多边形中有两个不相邻的顶点重合），它会将多边形拆分为两个独立的多边形。

### 9.20.3 自交检测

```csharp
if ((op.Pt == op2.Pt) && op2.Next != op && op2.Prev != op)
```

这个条件检测自交：
- `op.Pt == op2.Pt`：两个顶点坐标相同。
- `op2.Next != op && op2.Prev != op`：它们不是相邻的（相邻的相同点不算自交，那只是重复点）。

### 9.20.4 拆分操作图解

```
自交多边形（蝴蝶结形状）:

    A ─── B
    │ ╲ ╱ │
    │  X  │     X 是自交点（op.Pt == op2.Pt）
    │ ╱ ╲ │
    D ─── C

环形链表: A → B → X₁ → C → D → X₂ → A
（X₁ 和 X₂ 坐标相同但是链表中的不同节点）

拆分后:

链表 1 (outrec):  A → B → X₁ → D ← op4 ← ... → A
  重新连接: op(X₁).Prev = op4(D), op4(D).Next = op(X₁)

链表 2 (outrec2): X₂ → C → ... → X₂
  重新连接: op2(X₂).Prev = op3(B 的前一个?), op3.Next = op2

最终形成两个独立的简单多边形。
```

### 9.20.5 拆分后的三种关系

拆分后需要确定两个多边形的关系：

| 情况 | 条件 | 处理 |
|:---|:---|:---|
| **outrec2 在 outrec 内部** | `Poly2ContainsPoly1(outrec2, outrec)` | outrec2 是 outrec 的孔洞（或反之） |
| **outrec 在 outrec2 内部** | `Poly2ContainsPoly1(outrec, outrec2)` | 交换孔洞状态，重新设置父子关系 |
| **两者独立** | 以上两个都不满足 | outrec2 与 outrec 是兄弟关系 |

#### 情况 1：outrec2 包含在 outrec 中

```csharp
outrec2.IsHole = !outrec.IsHole;   // 反转孔洞状态（外→孔，孔→外）
outrec2.FirstLeft = outrec;         // outrec2 的父是 outrec
if (m_UsingPolyTree) FixupFirstLefts2(outrec2, outrec);
```

```
  outrec (外轮廓)
    └── outrec2 (孔洞)
```

#### 情况 2：outrec 包含在 outrec2 中

```csharp
outrec2.IsHole = outrec.IsHole;     // outrec2 继承 outrec 的孔洞状态
outrec.IsHole = !outrec2.IsHole;    // outrec 的状态反转
outrec2.FirstLeft = outrec.FirstLeft; // outrec2 继承 outrec 的父
outrec.FirstLeft = outrec2;           // outrec 成为 outrec2 的子
if (m_UsingPolyTree) FixupFirstLefts2(outrec, outrec2);
```

```
  outrec2 (外轮廓，原来的 outrec 的角色)
    └── outrec (孔洞，角色互换)
```

#### 情况 3：两者独立

```csharp
outrec2.IsHole = outrec.IsHole;      // 相同的孔洞状态
outrec2.FirstLeft = outrec.FirstLeft; // 相同的父
if (m_UsingPolyTree) FixupFirstLefts1(outrec, outrec2);
```

```
  parent
    ├── outrec
    └── outrec2
```

### 9.20.6 注意事项

1. `while (i < m_PolyOuts.Count)` 使用 `while` 而非 `for`，因为循环体中 `CreateOutRec()` 可能向 `m_PolyOuts` 添加新记录，需要检查动态变化的 `Count`。
2. `op2 = op;` 在拆分后将 `op2` 重置为 `op`，这确保从拆分点重新开始内层循环，避免遗漏。
3. 此方法的时间复杂度为 O(n²)（对于每个多边形的顶点对），因此仅在 `StrictlySimple` 为 `true` 时才执行。

---

## 9.21 完整方法调用关系

以下展示了本章涉及的所有方法的调用关系：

```
用户代码
  │
  └──→ Clipper.Execute(clipType, solution, fillType)  [重载1]
         │
         └──→ Clipper.Execute(clipType, solution, subjFill, clipFill)  [重载3]
                │
                ├── 检查 m_ExecuteLocked
                ├── 检查 m_HasOpenPaths
                ├── 加锁 m_ExecuteLocked = true
                ├── solution.Clear()
                ├── 保存参数到成员字段
                │
                ├──→ ExecuteInternal()  ★ 核心
                │     │
                │     ├── Reset()  [ClipperBase]
                │     ├── PopScanbeam()  [ClipperBase]
                │     ├── InsertLocalMinimaIntoAEL()  [下一章详解]
                │     │
                │     ├── while 循环:
                │     │   ├── ProcessHorizontals()  [下一章详解]
                │     │   ├── m_GhostJoins.Clear()
                │     │   ├── ProcessIntersections()  [下一章详解]
                │     │   ├── ProcessEdgesAtTopOfScanbeam()  [下一章详解]
                │     │   └── InsertLocalMinimaIntoAEL()
                │     │
                │     ├── 修复方向: Area(OutRec), ReversePolyPtLinks()
                │     ├── JoinCommonEdges()
                │     ├── FixupOutPolyline() / FixupOutPolygon()
                │     └── DoSimplePolygons()  [如果 StrictlySimple]
                │           ├── CreateOutRec()  [ClipperBase]
                │           ├── UpdateOutPtIdxs()
                │           ├── Poly2ContainsPoly1()
                │           └── FixupFirstLefts1/2()
                │
                ├──→ BuildResult(solution)
                │     └── PointCount()
                │
                └── finally:
                      ├── DisposeAllPolyPts()
                      │     └── DisposeOutRec()  [ClipperBase]
                      └── m_ExecuteLocked = false
```

---

## 9.22 关键数据结构在执行过程中的生命周期

```
                  构造函数      AddPath     Execute()
                     │            │            │
  m_Maxima          null        不变        使用→清空
  m_SortedEdges     null        不变        使用→清空
  m_IntersectList   []          不变        使用→自动清空
  m_Joins           []          不变        使用→finally清空
  m_GhostJoins      []          不变        使用→每轮清空→finally清空
  m_PolyOuts        []          不变        使用→BuildResult→DisposeAll
  m_ExecuteLocked   false       不变        true→...→false(finally)
  m_ClipType        default     不变        设置→ExecuteInternal使用
  m_SubjFillType    default     不变        设置→ExecuteInternal使用
  m_ClipFillType    default     不变        设置→ExecuteInternal使用
  m_UsingPolyTree   false       不变        设置→DoSimplePolygons使用
```

上表展示了每个关键字段在不同阶段的状态变化。可以看到，大部分字段在 `AddPath` 阶段不会改变（它们是 `Clipper` 级别的字段，而 `AddPath` 只操作 `ClipperBase` 级别的字段），只在 `Execute` 调用期间被使用。

---

## 9.23 线程安全性分析

| 场景 | 是否安全 | 说明 |
|:---|:---:|:---|
| 单线程顺序调用 | ✓ | `m_ExecuteLocked` 防止逻辑重入 |
| 多线程共享实例 | ✗ | `m_ExecuteLocked` 不是原子操作，存在竞态条件 |
| 多线程各自实例 | ✓ | 每个实例有独立状态 |
| 回调中调用 Execute | ✗ | `m_ExecuteLocked` 会返回 false |

**最佳实践**：

```csharp
// 推荐：每个线程使用独立实例
Parallel.ForEach(tasks, task =>
{
    Clipper c = new Clipper();  // 每个线程独立实例
    c.AddPath(task.Subject, PolyType.ptSubject, true);
    c.AddPath(task.Clip, PolyType.ptClip, true);
    c.Execute(ClipType.ctIntersection, task.Result);
});
```

---

## 9.24 异常安全性分析

`Execute` 方法的异常安全性设计是值得称赞的：

```csharp
try
{
    succeeded = ExecuteInternal();
    if (succeeded) BuildResult(solution);
}
finally
{
    DisposeAllPolyPts();      // 1. 清理内部数据
    m_ExecuteLocked = false;  // 2. 解锁
}
```

`finally` 块确保了：

1. **内存安全**：无论是否发生异常，所有内部分配的 `OutPt` 节点都会被释放。
2. **状态安全**：执行锁一定会被释放，不会导致 Clipper 实例永久不可用。
3. **可重用性**：异常后 Clipper 实例仍然可以接受新的 `AddPath` 调用并重新执行。

同样，`ExecuteInternal` 自身也有 `finally` 块：

```csharp
finally
{
    m_Joins.Clear();
    m_GhostJoins.Clear();
}
```

双层 `finally` 嵌套确保了即使 `ExecuteInternal` 的 `finally` 块抛出异常（虽然 `Clear()` 通常不会），外层 `finally` 仍然能正确清理。

---

## 9.25 本章小结

本章详细剖析了 `Clipper` 类的**类结构与执行入口**。总结关键要点如下：

### 类结构

- `Clipper` 继承 `ClipperBase`，形成"数据准备 + 算法执行"的两层架构。
- 通过位掩码 `InitOptions` 控制三个行为选项。
- 维护五组成员字段：运算参数、边管理、交点处理、连接管理、状态控制。

### 执行流程

- 四个 `Execute` 重载提供灵活的调用方式（Paths/PolyTree × 单一/分别填充规则）。
- `m_ExecuteLocked` 提供基本的防重入保护。
- `ExecuteInternal` 是核心算法，分为初始化、扫描线主循环、后处理三个阶段。

### 结果构建

- `BuildResult` 将内部数据转换为平面路径列表。
- `BuildResult2` 将内部数据转换为层次化的 PolyTree。

### 后处理

- `FixupOutPolygon` 清理冗余顶点。
- `DoSimplePolygons` 处理自交多边形。
- 方向修复确保输出多边形的绕行方向正确。

### 辅助功能

- `InsertMaxima` 管理极大值有序链表。
- `AddJoin` / `AddGhostJoin` 管理连接信息。
- `SetZ` 提供可选的三维坐标支持。
- `Area`、`Orientation`、`ReversePaths` 等静态工具方法。

下一章将深入 `ExecuteInternal` 主循环中调用的四大子算法：
1. `InsertLocalMinimaIntoAEL`
2. `ProcessHorizontals`
3. `ProcessIntersections`
4. `ProcessEdgesAtTopOfScanbeam`

这些方法构成了 Vatti 扫描线算法的**运算核心**。

---

> **源码版本**：ClipperLib v6.4.2，作者 Angus Johnson  
> **源文件**：clipper.cs，约第 1360–4397 行  
> **许可证**：Boost Software License 1.0

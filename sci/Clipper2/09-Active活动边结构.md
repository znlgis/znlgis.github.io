---
layout: default
title: 第9章：Active 活动边结构
---

# 第9章：Active 活动边结构

## 9.1 概述

在 Vatti 扫描线算法中，活动边表（Active Edge List, AEL）是核心数据结构之一。`Active` 类表示当前扫描线穿过的边，这些边按 X 坐标排序，用于确定多边形区域的边界。

## 9.2 Active 类定义

### 9.2.1 完整定义

```csharp
internal class Active
{
    public Point64 bot;          // 边的底部端点
    public Point64 top;          // 边的顶部端点
    public long curX;            // 当前扫描线上的 X 坐标
    
    public double dx;            // 斜率的倒数 (dx/dy)
    
    public int windDx;           // 缠绕方向 (+1 或 -1)
    public int windCnt;          // 缠绕计数
    public int windCnt2;         // 另一多边形的缠绕计数
    
    public OutRec? outrec;       // 输出记录
    
    // 链表指针
    public Active? prevInAEL;    // AEL 中的前一条边
    public Active? nextInAEL;    // AEL 中的后一条边
    public Active? prevInSEL;    // SEL 中的前一条边
    public Active? nextInSEL;    // SEL 中的后一条边
    
    public Active? mergeJump;    // 合并跳转
    
    public Vertex? vertexTop;    // 顶部顶点
    public LocalMinima localMin; // 所属的局部极小值
    
    public bool isLeftBound;     // 是否为左边界
}
```

### 9.2.2 成员变量详解

| 成员 | 类型 | 说明 |
|------|------|------|
| `bot` | `Point64` | 边的下端点（Y值较小） |
| `top` | `Point64` | 边的上端点（Y值较大） |
| `curX` | `long` | 当前扫描线 Y 处的 X 坐标 |
| `dx` | `double` | 斜率倒数，用于X坐标插值 |
| `windDx` | `int` | 边的方向：+1向上，-1向下 |
| `windCnt` | `int` | 当前边的缠绕计数 |
| `windCnt2` | `int` | 另一类型路径的缠绕计数 |
| `outrec` | `OutRec?` | 关联的输出多边形记录 |

## 9.3 斜率倒数 (dx)

### 9.3.1 计算方法

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private static double GetDx(Point64 pt1, Point64 pt2)
{
    double dy = pt2.Y - pt1.Y;
    if (dy != 0)
        return (pt2.X - pt1.X) / dy;
    else if (pt2.X > pt1.X)
        return double.MaxValue;  // 向右的水平边
    else
        return double.MinValue;  // 向左的水平边
}
```

### 9.3.2 几何意义

```
           │
    top ●──┼──
          ╲│
           ╲   dx = ΔX/ΔY
            ╲
         ●───╲────
    bot     │╲
            │ ╲
           Y轴
```

- `dx > 0`：边向右倾斜（随Y增加，X增加）
- `dx < 0`：边向左倾斜（随Y增加，X减少）
- `dx = 0`：垂直边
- `dx = ±MaxValue`：水平边

### 9.3.3 X 坐标插值

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private static long TopX(Active ae, long currentY)
{
    // 计算边在 currentY 处的 X 坐标
    if (currentY == ae.top.Y || ae.top.X == ae.bot.X)
        return ae.top.X;
    else if (currentY == ae.bot.Y)
        return ae.bot.X;
    else
        return ae.bot.X + (long)Math.Round(ae.dx * (currentY - ae.bot.Y));
}
```

## 9.4 活动边表 (AEL)

### 9.4.1 AEL 的结构

AEL 是一个双向链表，按 X 坐标排序：

```
AEL 头 ←→ Active1 ←→ Active2 ←→ Active3 ←→ ... ←→ null
          (X=10)     (X=30)      (X=50)
```

### 9.4.2 链表指针

```csharp
public Active? prevInAEL;    // 前一条边
public Active? nextInAEL;    // 后一条边
```

### 9.4.3 插入到 AEL

```csharp
private void InsertLeftEdge(Active ae)
{
    Active ae2;
    if (_actives == null)
    {
        // AEL 为空，直接作为头
        ae.prevInAEL = null;
        ae.nextInAEL = null;
        _actives = ae;
    }
    else if (!IsValidAelOrder(_actives, ae))
    {
        // 插入到头部
        ae.prevInAEL = null;
        ae.nextInAEL = _actives;
        _actives.prevInAEL = ae;
        _actives = ae;
    }
    else
    {
        // 找到正确位置
        ae2 = _actives;
        while (ae2.nextInAEL != null && IsValidAelOrder(ae2.nextInAEL, ae))
            ae2 = ae2.nextInAEL;
        
        // 在 ae2 后插入
        ae.nextInAEL = ae2.nextInAEL;
        if (ae2.nextInAEL != null)
            ae2.nextInAEL.prevInAEL = ae;
        ae.prevInAEL = ae2;
        ae2.nextInAEL = ae;
    }
}
```

### 9.4.4 排序规则

```csharp
private static bool IsValidAelOrder(Active res, Active cmp)
{
    // 首先比较当前 X 坐标
    if (res.curX != cmp.curX)
        return res.curX < cmp.curX;
    
    // X 相等时，比较斜率（决定未来的相对位置）
    // 使用叉积比较斜率
    Point64 d = new Point64(cmp.top.X - cmp.bot.X, cmp.top.Y - cmp.bot.Y);
    
    // 计算叉积符号
    return InternalClipper.CrossProduct(
        new Point64(0, 0), 
        new Point64(res.top.X - res.bot.X, res.top.Y - res.bot.Y),
        d) < 0;
}
```

## 9.5 缠绕计数 (Winding Count)

### 9.5.1 windDx 方向

```csharp
public int windDx;  // +1 或 -1
```

- `windDx = +1`：边从下往上（随扫描线前进，边向上）
- `windDx = -1`：边从上往下（随扫描线前进，边向下）

```
   ○─────────○
   │         │
   │  内部   │ ← windDx = +1（左边）
   │         │ → windDx = -1（右边）
   │         │
   ○─────────○
```

### 9.5.2 windCnt 累积

当扫描线从左到右穿过边时：

```csharp
private void SetWindCountForClosedPathEdge(Active ae)
{
    Active? ae2 = ae.prevInAEL;
    
    // 找到同类型的前一条边
    while (ae2 != null && 
           (GetPolyType(ae2) != GetPolyType(ae) || IsOpen(ae2)))
    {
        ae2 = ae2.prevInAEL;
    }
    
    if (ae2 == null)
    {
        // 没有前一条同类型边
        ae.windCnt = ae.windDx;
    }
    else if (_fillrule == FillRule.EvenOdd)
    {
        // 奇偶规则
        ae.windCnt = ae.windDx;
        ae.windCnt2 = ae2.windCnt2;
    }
    else
    {
        // 非零规则
        if (ae2.windCnt * ae2.windDx < 0)
        {
            if (Math.Abs(ae2.windCnt) > 1)
            {
                if (ae2.windDx * ae.windDx < 0)
                    ae.windCnt = ae2.windCnt;
                else
                    ae.windCnt = ae2.windCnt + ae.windDx;
            }
            else
                ae.windCnt = (IsOpen(ae) ? 1 : ae.windDx);
        }
        else
        {
            if (ae2.windDx * ae.windDx < 0)
                ae.windCnt = ae2.windCnt;
            else
                ae.windCnt = ae2.windCnt + ae.windDx;
        }
        ae.windCnt2 = ae2.windCnt2;
    }
}
```

### 9.5.3 填充判断

```csharp
private bool IsContributingClosed(Active ae)
{
    switch (_fillrule)
    {
        case FillRule.EvenOdd:
            // 奇数穿越为内部
            return (ae.windCnt & 1) != 0;
            
        case FillRule.NonZero:
            // 非零为内部
            return ae.windCnt != 0;
            
        case FillRule.Positive:
            // 正数为内部
            return ae.windCnt > 0;
            
        case FillRule.Negative:
            // 负数为内部
            return ae.windCnt < 0;
    }
    return false;
}
```

## 9.6 边的生命周期

### 9.6.1 创建 Active

从 LocalMinima 创建边：

```csharp
private Active CreateActive(Vertex v, bool goingUp, LocalMinima locMin)
{
    Active ae = new Active();
    ae.bot = v.pt;
    ae.vertexTop = goingUp ? v.next! : v.prev!;
    ae.top = ae.vertexTop.pt;
    ae.curX = ae.bot.X;
    ae.localMin = locMin;
    ae.isLeftBound = goingUp;
    ae.windDx = goingUp ? 1 : -1;
    ae.dx = GetDx(ae.bot, ae.top);
    
    return ae;
}
```

### 9.6.2 更新边的顶点

当扫描到边的顶点时，需要更新到下一条边：

```csharp
private void UpdateEdgeIntoAEL(ref Active ae)
{
    ae.bot = ae.top;
    ae.vertexTop = ae.isLeftBound ? 
        ae.vertexTop!.next : ae.vertexTop!.prev;
    ae.top = ae.vertexTop!.pt;
    ae.curX = ae.bot.X;
    ae.dx = GetDx(ae.bot, ae.top);
    
    // 重新插入到正确位置
    if (!IsHorizontal(ae))
        AddScanline(ae.top.Y);
    
    // 处理水平边...
}
```

### 9.6.3 删除边

当边到达局部最大值时删除：

```csharp
private void DeleteFromAEL(Active ae)
{
    Active? prev = ae.prevInAEL;
    Active? next = ae.nextInAEL;
    
    if (prev != null)
        prev.nextInAEL = next;
    else
        _actives = next;
    
    if (next != null)
        next.prevInAEL = prev;
    
    // 清理引用
    ae.prevInAEL = null;
    ae.nextInAEL = null;
}
```

## 9.7 边交换

### 9.7.1 为什么需要交换

当两条边相交时，它们的 X 顺序会改变：

```
     扫描线1：  边A ─── 边B
                  ╲   ╱
                   ╲ ╱
                    ╳  ← 交点
                   ╱ ╲
                  ╱   ╲
     扫描线2：  边B ─── 边A
```

### 9.7.2 SwapPositionsInAEL

```csharp
private void SwapPositionsInAEL(Active ae1, Active ae2)
{
    // 确保 ae1 在 ae2 之前
    if (ae1.nextInAEL != ae2)
    {
        // 不相邻，需要特殊处理
        Active? prev1 = ae1.prevInAEL;
        Active? next1 = ae1.nextInAEL;
        Active? prev2 = ae2.prevInAEL;
        Active? next2 = ae2.nextInAEL;
        
        // 更新四个链接...
    }
    else
    {
        // 相邻情况
        Active? prev = ae1.prevInAEL;
        Active? next = ae2.nextInAEL;
        
        if (prev != null) prev.nextInAEL = ae2;
        else _actives = ae2;
        
        ae2.prevInAEL = prev;
        ae2.nextInAEL = ae1;
        ae1.prevInAEL = ae2;
        ae1.nextInAEL = next;
        
        if (next != null) next.prevInAEL = ae1;
    }
}
```

## 9.8 排序边列表 (SEL)

### 9.8.1 SEL 的作用

SEL（Sorted Edge List）用于管理当前扫描线上需要处理的边：

```csharp
public Active? prevInSEL;
public Active? nextInSEL;
```

### 9.8.2 SEL vs AEL

| 特性 | AEL | SEL |
|------|-----|-----|
| 用途 | 存储所有活动边 | 临时排序用 |
| 排序依据 | X 坐标 | 处理优先级 |
| 生命周期 | 长期 | 单次扫描线处理 |

## 9.9 水平边处理

### 9.9.1 水平边的特殊性

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static bool IsHorizontal(Active ae)
{
    return ae.top.Y == ae.bot.Y;
}
```

水平边的 `dx` 为 `MaxValue` 或 `MinValue`，需要特殊处理。

### 9.9.2 水平边结构

```csharp
internal class HorzSegment
{
    public OutPt? leftOp;
    public OutPt? rightOp;
    public bool leftToRight;
}

internal class HorzJoin
{
    public OutPt? op1;
    public OutPt? op2;
}
```

## 9.10 isLeftBound 标志

### 9.10.1 定义

```csharp
public bool isLeftBound;
```

标识边是局部极小值的左边界还是右边界：

```
              ╱╲
             ╱  ╲
            ╱    ╲
      左边界      右边界
       ↗          ↖
        ╲        ╱
         ╲      ╱
          ╲    ╱
           ╲  ╱
            ╲╱  ← 局部极小值
```

### 9.10.2 作用

- 确定边的遍历方向
- 配对左右边界构建输出多边形

## 9.11 mergeJump 字段

### 9.11.1 用途

```csharp
public Active? mergeJump;
```

用于优化边的合并操作，跳过已处理的边。

### 9.11.2 使用场景

当多条边在同一点汇合时，使用 `mergeJump` 快速找到需要处理的边。

## 9.12 调试辅助

### 9.12.1 ToString 方法

```csharp
#if DEBUG
public override string ToString()
{
    return $"Active: ({bot.X},{bot.Y})->({top.X},{top.Y}) " +
           $"curX={curX} dx={dx:F2} windCnt={windCnt}";
}
#endif
```

### 9.12.2 遍历 AEL

```csharp
internal void DumpAEL()
{
    Active? ae = _actives;
    Console.WriteLine("=== AEL ===");
    while (ae != null)
    {
        Console.WriteLine(ae.ToString());
        ae = ae.nextInAEL;
    }
}
```

## 9.13 本章小结

`Active` 类是 Clipper2 扫描线算法的核心结构：

1. **几何信息**：`bot`、`top`、`curX`、`dx`
2. **缠绕信息**：`windDx`、`windCnt`、`windCnt2`
3. **链表指针**：`prevInAEL`、`nextInAEL`、`prevInSEL`、`nextInSEL`
4. **输出关联**：`outrec`
5. **顶点信息**：`vertexTop`、`localMin`、`isLeftBound`

理解 Active 的结构和操作是理解 Clipper2 扫描线算法的关键。

---

[上一章：ClipperBase基类详解](08-ClipperBase基类详解) | [返回目录](index) | [下一章：Vertex与LocalMinima](10-Vertex与LocalMinima)

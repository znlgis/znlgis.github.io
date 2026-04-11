---
layout: default
title: 第11章：OutRec 与 OutPt 输出结构
---

# 第11章：OutRec 与 OutPt 输出结构

## 11.1 概述

当 Clipper2 的扫描线算法处理多边形时，需要构建输出多边形。`OutRec`（输出记录）和 `OutPt`（输出点）是用于存储和构建输出多边形的核心数据结构。

## 11.2 OutPt 类

### 11.2.1 类定义

```csharp
internal class OutPt
{
    public Point64 pt;      // 点坐标
    public OutPt? next;     // 下一个输出点
    public OutPt? prev;     // 上一个输出点
    public OutRec outrec;   // 所属的输出记录
    public Joiner? joiner;  // 连接器（用于处理自相交）
}
```

### 11.2.2 双向循环链表

与 `Vertex` 类似，`OutPt` 形成双向循环链表：

```
  op1 ←→ op2 ←→ op3 ←→ op4 ←→ op1
   │                         │
   └─────────────────────────┘
```

### 11.2.3 OutPt vs Vertex

| 特性 | Vertex | OutPt |
|------|--------|-------|
| 用途 | 输入多边形 | 输出多边形 |
| 内容 | pt, flags | pt, outrec, joiner |
| 创建时机 | 预处理阶段 | 扫描线处理中 |
| 数量 | 与输入相同 | 可能更多（交点） |

## 11.3 OutRec 类

### 11.3.1 类定义

```csharp
internal class OutRec
{
    public int idx;             // 索引
    public OutRec? owner;       // 所有者（外轮廓）
    public Active? frontEdge;   // 前边
    public Active? backEdge;    // 后边
    public OutPt? pts;          // 输出点链表
    public PolyPath64? polypath; // 多边形树路径
    public Rect64 bounds;       // 边界矩形
    public Path64? path;        // 最终路径
    public bool isOpen;         // 是否开放路径
    public List<OutRec?>? splits; // 分割记录
    public OutRec? recursiveSplit; // 递归分割
}
```

### 11.3.2 成员详解

| 成员 | 类型 | 说明 |
|------|------|------|
| `idx` | `int` | 在 outrecList 中的索引 |
| `owner` | `OutRec?` | 父轮廓（包含此轮廓的外轮廓） |
| `frontEdge` | `Active?` | 当前构建的前边 |
| `backEdge` | `Active?` | 当前构建的后边 |
| `pts` | `OutPt?` | 输出点链表的头 |
| `bounds` | `Rect64` | 计算后的边界框 |
| `isOpen` | `bool` | 是否为开放路径 |

### 11.3.3 Owner 关系

```
外轮廓 (OutRec A, owner = null)
├── 孔洞 (OutRec B, owner = A)
│   └── 岛屿 (OutRec C, owner = B)
└── 孔洞 (OutRec D, owner = A)
```

## 11.4 创建 OutRec

### 11.4.1 CreateOutRec 方法

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private OutRec CreateOutRec()
{
    OutRec result = _outRecPool.Get();
    result.idx = _outrecList.Count;
    result.owner = null;
    result.frontEdge = null;
    result.backEdge = null;
    result.pts = null;
    result.polypath = null;
    result.isOpen = false;
    result.splits = null;
    result.recursiveSplit = null;
    
    _outrecList.Add(result);
    return result;
}
```

### 11.4.2 对象池使用

```csharp
// 获取
OutRec outrec = _outRecPool.Get();

// 归还
_outRecPool.Return(outrec);
```

## 11.5 创建 OutPt

### 11.5.1 AddOutPt 方法

```csharp
private OutPt AddOutPt(Active ae, Point64 pt)
{
    OutPt newOp = _outPtPool.Get();
    newOp.pt = pt;
    newOp.joiner = null;
    newOp.outrec = ae.outrec!;
    
    OutPt? op = ae.outrec!.pts;
    
    if (op == null)
    {
        // 第一个点
        newOp.next = newOp;
        newOp.prev = newOp;
        ae.outrec.pts = newOp;
    }
    else if (ae == ae.outrec.frontEdge)
    {
        // 添加到前端
        newOp.next = op;
        newOp.prev = op.prev;
        op.prev!.next = newOp;
        op.prev = newOp;
        ae.outrec.pts = newOp;
    }
    else
    {
        // 添加到后端
        newOp.prev = op;
        newOp.next = op.next;
        op.next!.prev = newOp;
        op.next = newOp;
    }
    
    return newOp;
}
```

### 11.5.2 插入位置示意

```
前端插入 (frontEdge):
    新点 → pts → op2 → op3 → ...
    
后端插入 (backEdge):
    pts → 新点 → op2 → op3 → ...
```

## 11.6 构建输出多边形

### 11.6.1 StartOutRec 方法

```csharp
private void StartOutRec(Active ae1, Active ae2)
{
    OutRec outrec = CreateOutRec();
    
    // 设置边关联
    ae1.outrec = outrec;
    ae2.outrec = outrec;
    
    SetOwner(outrec, ae1, ae2);
    
    // 确定前后边
    if (ae1.curX <= ae2.curX)
    {
        outrec.frontEdge = ae1;
        outrec.backEdge = ae2;
    }
    else
    {
        outrec.frontEdge = ae2;
        outrec.backEdge = ae1;
    }
}
```

### 11.6.2 AddLocalMinPoly

```csharp
private OutPt? AddLocalMinPoly(Active ae1, Active ae2, Point64 pt, 
    bool isNew = false)
{
    OutRec outrec;
    
    if (isNew)
    {
        outrec = CreateOutRec();
        outrec.isOpen = IsOpen(ae1);
        
        // 设置边
        if (ae1.curX <= ae2.curX)
        {
            outrec.frontEdge = ae1;
            outrec.backEdge = ae2;
        }
        else
        {
            outrec.frontEdge = ae2;
            outrec.backEdge = ae1;
        }
        
        ae1.outrec = outrec;
        ae2.outrec = outrec;
    }
    else
    {
        outrec = ae1.outrec!;
    }
    
    OutPt op = AddOutPt(ae1, pt);
    
    if (!isNew)
    {
        // 处理合并情况
        AddOutPt(ae2, pt);
    }
    
    return op;
}
```

### 11.6.3 AddLocalMaxPoly

```csharp
private void AddLocalMaxPoly(Active ae1, Active ae2, Point64 pt)
{
    AddOutPt(ae1, pt);
    
    if (ae1.outrec == ae2.outrec)
    {
        // 同一个 OutRec，闭合多边形
        ae1.outrec!.frontEdge = null;
        ae1.outrec.backEdge = null;
        ae1.outrec = null;
        ae2.outrec = null;
    }
    else
    {
        // 合并两个 OutRec
        MergeOutRecs(ae1, ae2);
    }
}
```

## 11.7 Owner 设置

### 11.7.1 SetOwner 方法

```csharp
private void SetOwner(OutRec outrec, Active ae1, Active ae2)
{
    // 查找有效的 owner
    OutRec? owner = null;
    
    // 尝试从 ae1 的左侧边找 owner
    Active? ae = ae1.prevInAEL;
    while (ae != null)
    {
        if (ae.outrec != null && !ae.outrec.isOpen)
        {
            owner = ae.outrec;
            break;
        }
        ae = ae.prevInAEL;
    }
    
    outrec.owner = GetRealOwner(owner);
}
```

### 11.7.2 确定嵌套关系

```csharp
private OutRec? GetRealOwner(OutRec? outrec)
{
    while (outrec != null && outrec.pts == null)
        outrec = outrec.owner;
    return outrec;
}
```

## 11.8 OutRec 合并

### 11.8.1 MergeOutRecs 方法

```csharp
private void MergeOutRecs(Active ae1, Active ae2)
{
    OutRec? outrec1 = ae1.outrec;
    OutRec? outrec2 = ae2.outrec;
    
    if (outrec1 == null || outrec2 == null) return;
    if (outrec1 == outrec2) return;
    
    // 确定哪个是 owner
    OutRec? keepRec, discardRec;
    if (outrec1.idx < outrec2.idx)
    {
        keepRec = outrec1;
        discardRec = outrec2;
    }
    else
    {
        keepRec = outrec2;
        discardRec = outrec1;
    }
    
    // 合并点链表
    MergePaths(keepRec, discardRec);
    
    // 更新引用
    discardRec.pts = null;
    discardRec.owner = keepRec;
    ae2.outrec = keepRec;
}
```

### 11.8.2 MergePaths 合并点链表

```csharp
private void MergePaths(OutRec keep, OutRec discard)
{
    OutPt op1 = keep.pts!;
    OutPt op2 = discard.pts!;
    
    // 连接两个环
    OutPt op1Last = op1.prev!;
    OutPt op2Last = op2.prev!;
    
    op1Last.next = op2;
    op2.prev = op1Last;
    op2Last.next = op1;
    op1.prev = op2Last;
    
    // 更新所有点的 outrec
    OutPt op = op2;
    do
    {
        op.outrec = keep;
        op = op.next!;
    } while (op != op2);
}
```

## 11.9 边界计算

### 11.9.1 GetBounds 方法

```csharp
internal static Rect64 GetBounds(OutPt op)
{
    Rect64 result = new Rect64(
        long.MaxValue, long.MaxValue,
        long.MinValue, long.MinValue);
    
    OutPt op2 = op;
    do
    {
        if (op2.pt.X < result.left) result.left = op2.pt.X;
        if (op2.pt.X > result.right) result.right = op2.pt.X;
        if (op2.pt.Y < result.top) result.top = op2.pt.Y;
        if (op2.pt.Y > result.bottom) result.bottom = op2.pt.Y;
        op2 = op2.next!;
    } while (op2 != op);
    
    return result;
}
```

## 11.10 Joiner 连接器

### 11.10.1 Joiner 类

```csharp
internal class Joiner
{
    public int idx;
    public OutPt op1;
    public OutPt? op2;
    public Joiner? next1;
    public Joiner? next2;
}
```

### 11.10.2 用途

Joiner 用于处理自相交多边形的连接：

```
        ●───────●
       ╱ ╲     ╱
      ╱   ╲   ╱
     ╱     ╲ ╱
    ●───────●──────●
           交点需要 Joiner 处理
```

### 11.10.3 创建 Joiner

```csharp
private void AddJoin(OutPt op1, OutPt op2)
{
    Joiner joiner = new Joiner
    {
        idx = _joinerList.Count,
        op1 = op1,
        op2 = op2,
        next1 = op1.joiner,
        next2 = op2.joiner
    };
    
    op1.joiner = joiner;
    op2.joiner = joiner;
    
    _joinerList.Add(joiner);
}
```

## 11.11 路径构建

### 11.11.1 BuildPath 方法

```csharp
private Path64? BuildPath(OutPt op, bool reverse, bool isOpen)
{
    int cnt = CountOutPts(op);
    if (cnt < 2) return null;
    if (!isOpen && cnt < 3) return null;
    
    Path64 result = new Path64(cnt);
    
    OutPt op2 = op;
    if (reverse)
    {
        do
        {
            result.Add(op2.pt);
            op2 = op2.prev!;
        } while (op2 != op);
    }
    else
    {
        do
        {
            result.Add(op2.pt);
            op2 = op2.next!;
        } while (op2 != op);
    }
    
    return result;
}
```

### 11.11.2 CountOutPts

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private static int CountOutPts(OutPt op)
{
    int result = 0;
    OutPt op2 = op;
    do
    {
        result++;
        op2 = op2.next!;
    } while (op2 != op);
    return result;
}
```

## 11.12 清理输出点

### 11.12.1 CleanCollinear 方法

```csharp
private void CleanCollinear(OutRec outrec)
{
    OutPt? op = outrec.pts;
    if (op == null) return;
    
    OutPt startOp = op;
    OutPt? op2;
    
    do
    {
        op2 = op;
        
        // 跳过重复点
        while (op2.next != startOp && op2.pt == op2.next!.pt)
        {
            DisposeOutPt(op2.next);
        }
        
        // 移除共线点
        if (op2.prev != op2.next &&
            InternalClipper.IsCollinear(op2.prev!.pt, op2.pt, op2.next!.pt))
        {
            if (op2 == outrec.pts)
                outrec.pts = op2.prev;
            DisposeOutPt(op2);
            op2 = op2.prev;
            if (op2 == outrec.pts) startOp = op2;
        }
        else
        {
            op2 = op2.next;
        }
    } while (op2 != startOp);
}
```

### 11.12.2 DisposeOutPt

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private void DisposeOutPt(OutPt op)
{
    op.prev!.next = op.next;
    op.next!.prev = op.prev;
    
    _outPtPool.Return(op);
}
```

## 11.13 分割处理

### 11.13.1 splits 列表

```csharp
public List<OutRec?>? splits;
```

当一个 OutRec 因为自相交而分割时，splits 记录子记录。

### 11.13.2 CheckSplitOwner

```csharp
private void CheckSplitOwner(OutRec outrec)
{
    if (outrec.splits == null) return;
    
    foreach (OutRec? split in outrec.splits)
    {
        if (split != null && split.pts != null)
        {
            // 处理分割后的多边形
            ProcessSplit(split);
        }
    }
}
```

## 11.14 本章小结

`OutRec` 和 `OutPt` 是 Clipper2 输出多边形的核心结构：

1. **OutPt**：
   - 输出点，形成双向循环链表
   - 包含坐标、链接和所属 OutRec
   - 使用对象池管理

2. **OutRec**：
   - 输出记录，表示一个输出多边形
   - 维护点链表和边界信息
   - owner 字段建立嵌套关系

3. **关键操作**：
   - 创建和添加输出点
   - 合并和分割 OutRec
   - 清理共线点
   - 构建最终路径

4. **Joiner**：
   - 处理自相交情况
   - 连接需要合并的点

理解输出结构是理解 Clipper2 如何生成最终结果的关键。

---

[上一章：Vertex与LocalMinima](10-Vertex与LocalMinima) | [返回目录](index) | [下一章：Clipper64裁剪类详解](12-Clipper64裁剪类详解)

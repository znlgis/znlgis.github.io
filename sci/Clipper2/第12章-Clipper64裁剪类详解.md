---
layout: default
title: 第12章：Clipper64 裁剪类详解
---

# 第12章：Clipper64 裁剪类详解

## 12.1 概述

`Clipper64` 是 Clipper2 的核心裁剪类，用于对整数坐标的多边形执行布尔运算。它继承自 `ClipperBase`，实现了完整的 Vatti 扫描线裁剪算法。

## 12.2 类定义

### 12.2.1 类声明

```csharp
public class Clipper64 : ClipperBase
{
#if USINGZ
    internal ZCallback64? _zCallback;
    public ZCallback64? ZCallback
    {
        get => _zCallback;
        set => _zCallback = value;
    }
#endif
}
```

### 12.2.2 继承关系

```
ClipperBase (抽象基类)
    ↓
Clipper64 (整数坐标裁剪)
```

## 12.3 Execute 方法

### 12.3.1 主要重载

```csharp
// 输出到 Paths64
public bool Execute(ClipType clipType, FillRule fillRule, Paths64 closedSolution)
{
    return Execute(clipType, fillRule, closedSolution, new Paths64());
}

// 输出到 Paths64，分离闭合和开放路径
public bool Execute(ClipType clipType, FillRule fillRule, 
    Paths64 closedSolution, Paths64 openSolution)
{
    closedSolution.Clear();
    openSolution.Clear();
    
    try
    {
        ExecuteInternal(clipType, fillRule);
        BuildPaths(closedSolution, openSolution);
    }
    catch
    {
        return false;
    }
    
    ClearSolution();
    return true;
}

// 输出到 PolyTree64
public bool Execute(ClipType clipType, FillRule fillRule, PolyTree64 polytree)
{
    return Execute(clipType, fillRule, polytree, new Paths64());
}

// 输出到 PolyTree64，分离开放路径
public bool Execute(ClipType clipType, FillRule fillRule, 
    PolyTree64 polytree, Paths64 openSolution)
{
    polytree.Clear();
    openSolution.Clear();
    
    try
    {
        ExecuteInternal(clipType, fillRule);
        BuildTree(polytree, openSolution);
    }
    catch
    {
        return false;
    }
    
    ClearSolution();
    return true;
}
```

### 12.3.2 返回值说明

- `true`：裁剪成功
- `false`：裁剪过程中发生异常

## 12.4 ExecuteInternal 方法

### 12.4.1 核心执行流程

```csharp
private void ExecuteInternal(ClipType clipType, FillRule fillRule)
{
    if (clipType == ClipType.NoClip) return;
    
    _fillrule = fillRule;
    _cliptype = clipType;
    
    Reset();
    
    // 排序局部极小值
    if (!PopScanline(out long y)) return;
    
    while (true)
    {
        // 插入当前 Y 的局部极小值
        InsertLocalMinimaIntoAEL(y);
        
        // 处理水平边
        while (PopHorz(out Active? ae))
        {
            DoHorizontal(ae!);
        }
        
        // 处理顶部事件
        if (!PopScanline(out long nextY)) break;
        
        // 处理边交点
        DoIntersections(y, nextY);
        
        // 处理顶部边
        DoTopOfScanbeam(nextY);
        
        // 继续下一个扫描线
        y = nextY;
    }
    
    // 处理开放路径
    ProcessOpenPaths();
}
```

### 12.4.2 Reset 方法

```csharp
private void Reset()
{
    if (!_isSortedMinimaList)
    {
        _minimaList.Sort((a, b) => b.vertex.pt.Y.CompareTo(a.vertex.pt.Y));
        _isSortedMinimaList = true;
    }
    
    // 重置扫描线
    _scanlineList.Clear();
    foreach (var lm in _minimaList)
        AddScanline(lm.vertex.pt.Y);
    
    _currentLocMinIdx = 0;
    _actives = null;
    _sel = null;
    _currentBotY = 0;
}
```

## 12.5 InsertLocalMinimaIntoAEL

### 12.5.1 方法实现

```csharp
private void InsertLocalMinimaIntoAEL(long botY)
{
    // 处理所有当前 Y 坐标的局部极小值
    while (PopLocalMinima(botY, out LocalMinima locMin))
    {
        Vertex vert = locMin.vertex;
        
        // 创建左边和右边
        Active leftBound = CreateLeftEdge(vert, locMin);
        Active rightBound = CreateRightEdge(vert, locMin);
        
        // 检查是否是有效边
        if (leftBound.bot.Y != leftBound.top.Y)
        {
            // 插入左边到 AEL
            InsertLeftEdge(leftBound);
            
            // 设置缠绕计数
            SetWindCountForClosedPathEdge(leftBound);
            
            // 检查是否贡献输出
            if (IsContributingClosed(leftBound))
                SetOutRecReference(leftBound, rightBound);
        }
        
        if (rightBound.bot.Y != rightBound.top.Y)
        {
            // 插入右边到 AEL
            InsertRightEdge(rightBound, leftBound);
            
            // 设置缠绕计数
            SetWindCountForClosedPathEdge(rightBound);
            
            // 检查交点
            CheckAndAddIntersection(leftBound, rightBound, botY);
        }
        
        // 添加局部最小值多边形
        if (leftBound.outrec != null || rightBound.outrec != null)
            AddLocalMinPoly(leftBound, rightBound, leftBound.bot);
    }
}
```

### 12.5.2 CreateLeftEdge

```csharp
private Active CreateLeftEdge(Vertex v, LocalMinima locMin)
{
    Active ae = new Active();
    ae.bot = v.pt;
    ae.curX = v.pt.X;
    ae.localMin = locMin;
    ae.isLeftBound = true;
    
    // 设置顶点和方向
    ae.vertexTop = v.next!;
    ae.top = ae.vertexTop.pt;
    ae.windDx = 1;
    ae.dx = GetDx(ae.bot, ae.top);
    
    return ae;
}
```

## 12.6 DoIntersections

### 12.6.1 交点处理主逻辑

```csharp
private void DoIntersections(long topY, long nextY)
{
    if (BuildIntersectList(topY, nextY))
    {
        ProcessIntersectList();
        _intersectList.Clear();
    }
}
```

### 12.6.2 BuildIntersectList

```csharp
private bool BuildIntersectList(long topY, long nextY)
{
    if (_actives == null || _actives.nextInAEL == null) return false;
    
    // 计算所有相邻边对的交点
    Active? ae = _actives;
    while (ae.nextInAEL != null)
    {
        Active ae2 = ae.nextInAEL;
        
        if (GetIntersection(ae, ae2, out Point64 pt) &&
            pt.Y >= nextY && pt.Y <= topY)
        {
            // 添加到交点列表
            AddIntersect(ae, ae2, pt);
        }
        
        ae = ae2;
    }
    
    // 按 Y 坐标排序交点
    if (_intersectList.Count > 1)
    {
        _intersectList.Sort((a, b) => {
            if (a.pt.Y != b.pt.Y)
                return b.pt.Y.CompareTo(a.pt.Y);
            return a.pt.X.CompareTo(b.pt.X);
        });
    }
    
    return _intersectList.Count > 0;
}
```

### 12.6.3 ProcessIntersectList

```csharp
private void ProcessIntersectList()
{
    foreach (IntersectNode node in _intersectList)
    {
        // 处理交点
        IntersectEdges(node.ae1, node.ae2, node.pt);
        
        // 交换边在 AEL 中的位置
        SwapPositionsInAEL(node.ae1, node.ae2);
    }
}
```

## 12.7 IntersectEdges

### 12.7.1 核心交点处理

```csharp
private void IntersectEdges(Active ae1, Active ae2, Point64 pt)
{
    // 根据填充规则和路径类型决定如何处理交点
    
    bool ae1Contributing = ae1.outrec != null;
    bool ae2Contributing = ae2.outrec != null;
    
    // 更新缠绕计数
    UpdateWindCount(ae1, ae2);
    
    bool ae1ContributingNew = IsContributing(ae1);
    bool ae2ContributingNew = IsContributing(ae2);
    
    if (ae1Contributing != ae1ContributingNew ||
        ae2Contributing != ae2ContributingNew)
    {
        // 贡献状态改变，需要添加输出点
        if (ae1Contributing && ae2Contributing)
        {
            // 两边都贡献 -> 添加局部最大值
            AddLocalMaxPoly(ae1, ae2, pt);
        }
        else if (ae1Contributing)
        {
            // 只有 ae1 贡献
            AddOutPt(ae1, pt);
            SwapOutrecs(ae1, ae2);
        }
        else if (ae2Contributing)
        {
            // 只有 ae2 贡献
            AddOutPt(ae2, pt);
            SwapOutrecs(ae1, ae2);
        }
        else
        {
            // 两边都不贡献 -> 开始新的局部最小值
            AddLocalMinPoly(ae1, ae2, pt, true);
        }
    }
    else if (ae1Contributing)
    {
        // 状态未改变，添加输出点
        AddOutPt(ae1, pt);
        AddOutPt(ae2, pt);
    }
}
```

### 12.7.2 UpdateWindCount

```csharp
private void UpdateWindCount(Active ae1, Active ae2)
{
    // 更新 ae1 和 ae2 的缠绕计数
    if (GetPolyType(ae1) == GetPolyType(ae2))
    {
        // 同类型路径
        if (_fillrule == FillRule.EvenOdd)
        {
            int tmp = ae1.windCnt;
            ae1.windCnt = ae2.windCnt;
            ae2.windCnt = tmp;
        }
        else
        {
            if (ae1.windCnt + ae2.windDx == 0)
                ae1.windCnt = -ae1.windCnt;
            else
                ae1.windCnt += ae2.windDx;
            
            if (ae2.windCnt - ae1.windDx == 0)
                ae2.windCnt = -ae2.windCnt;
            else
                ae2.windCnt -= ae1.windDx;
        }
    }
    else
    {
        // 不同类型路径
        if (_fillrule != FillRule.EvenOdd)
        {
            ae1.windCnt2 += ae2.windDx;
            ae2.windCnt2 -= ae1.windDx;
        }
        else
        {
            ae1.windCnt2 = ae1.windCnt2 == 0 ? 1 : 0;
            ae2.windCnt2 = ae2.windCnt2 == 0 ? 1 : 0;
        }
    }
}
```

## 12.8 DoTopOfScanbeam

### 12.8.1 处理扫描带顶部

```csharp
private void DoTopOfScanbeam(long y)
{
    _sel = null;
    
    Active? ae = _actives;
    while (ae != null)
    {
        // 更新边的当前 X 坐标
        ae.curX = TopX(ae, y);
        
        if (ae.top.Y == y)
        {
            // 边到达顶点
            ae = DoMaxima(ae);
        }
        else
        {
            // 边继续向上
            if (ae.vertexTop != null)
            {
                // 检查是否有水平边
                if (ae.vertexTop.pt.Y == y && 
                    ae.vertexTop.pt.X != ae.top.X)
                {
                    // 处理水平边
                    PushHorz(ae);
                }
            }
            ae = ae.nextInAEL;
        }
    }
}
```

### 12.8.2 DoMaxima

```csharp
private Active? DoMaxima(Active ae)
{
    Active? nextAe = ae.nextInAEL;
    
    // 查找配对边
    Active? ae2 = GetMaximaPair(ae);
    
    if (ae2 == null)
    {
        // 没有配对边（开放路径）
        if (ae.outrec != null)
            AddOutPt(ae, ae.top);
        DeleteFromAEL(ae);
        return nextAe;
    }
    
    // 处理局部最大值
    if (ae.outrec != null || ae2.outrec != null)
    {
        AddLocalMaxPoly(ae, ae2, ae.top);
    }
    
    // 更新边到下一段
    if (IsLocalMaxima(ae))
    {
        DeleteFromAEL(ae);
        DeleteFromAEL(ae2);
    }
    else
    {
        UpdateEdgeIntoAEL(ref ae);
        UpdateEdgeIntoAEL(ref ae2);
    }
    
    return nextAe;
}
```

## 12.9 水平边处理

### 12.9.1 DoHorizontal

```csharp
private void DoHorizontal(Active horz)
{
    Point64 pt;
    bool horzIsOpen = IsOpen(horz);
    
    // 确定水平边方向
    Point64 startPt, endPt;
    if (horz.bot.X < horz.top.X)
    {
        startPt = horz.bot;
        endPt = horz.top;
    }
    else
    {
        startPt = horz.top;
        endPt = horz.bot;
    }
    
    // 获取左右边界
    Active? leftBound = GetLeftBound(horz);
    Active? rightBound = GetRightBound(horz);
    
    // 处理与其他边的交点
    Active? ae = leftBound;
    while (ae != null && ae != rightBound)
    {
        pt.X = ae.curX;
        pt.Y = horz.bot.Y;
        
        if (pt.X >= startPt.X && pt.X <= endPt.X)
        {
            // 处理交点
            IntersectEdges(horz, ae, pt);
            
            // 交换位置
            SwapPositionsInAEL(horz, ae);
        }
        
        ae = ae.nextInAEL;
    }
    
    // 更新水平边
    UpdateEdgeIntoAEL(ref horz);
}
```

## 12.10 BuildPaths

### 12.10.1 构建输出路径

```csharp
private void BuildPaths(Paths64 closedPaths, Paths64 openPaths)
{
    closedPaths.Capacity = _outrecList.Count;
    openPaths.Capacity = _outrecList.Count;
    
    foreach (OutRec outrec in _outrecList)
    {
        if (outrec.pts == null) continue;
        
        Path64? path = BuildPath(outrec.pts, 
            ReverseSolution != IsPositive(outrec), 
            outrec.isOpen);
        
        if (path == null) continue;
        
        if (outrec.isOpen)
            openPaths.Add(path);
        else
            closedPaths.Add(path);
    }
}
```

### 12.10.2 IsPositive 判断

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private static bool IsPositive(OutRec outrec)
{
    // 计算多边形面积的符号
    return Area(outrec) >= 0;
}
```

## 12.11 Z 坐标处理

### 12.11.1 ZCallback 委托

```csharp
#if USINGZ
public delegate void ZCallback64(Point64 bot1, Point64 top1,
    Point64 bot2, Point64 top2, ref Point64 intersectPt);
#endif
```

### 12.11.2 使用示例

```csharp
#if USINGZ
Clipper64 clipper = new Clipper64();
clipper.ZCallback = (bot1, top1, bot2, top2, ref Point64 pt) =>
{
    // 线性插值计算 Z 值
    if (top1.Y - bot1.Y != 0)
    {
        double t = (pt.Y - bot1.Y) / (double)(top1.Y - bot1.Y);
        pt.Z = (long)(bot1.Z + t * (top1.Z - bot1.Z));
    }
    else
    {
        pt.Z = bot1.Z;
    }
};
#endif
```

## 12.12 错误处理

### 12.12.1 异常捕获

```csharp
public bool Execute(ClipType clipType, FillRule fillRule, Paths64 solution)
{
    solution.Clear();
    
    try
    {
        ExecuteInternal(clipType, fillRule);
        BuildPaths(solution, new Paths64());
        return true;
    }
    catch (Exception)
    {
        // 捕获所有异常，返回 false
        return false;
    }
    finally
    {
        ClearSolution();
    }
}
```

### 12.12.2 常见错误

1. **空路径**：输入路径少于 3 个点
2. **坐标溢出**：坐标超出 MaxCoord 范围
3. **自相交**：复杂的自相交情况

## 12.13 使用示例

### 12.13.1 基本使用

```csharp
Clipper64 clipper = new Clipper64();

// 添加主体
Path64 subject = new Path64 {
    new Point64(0, 0),
    new Point64(100, 0),
    new Point64(100, 100),
    new Point64(0, 100)
};
clipper.AddSubject(subject);

// 添加裁剪
Path64 clip = new Path64 {
    new Point64(50, 50),
    new Point64(150, 50),
    new Point64(150, 150),
    new Point64(50, 150)
};
clipper.AddClip(clip);

// 执行交集
Paths64 result = new Paths64();
clipper.Execute(ClipType.Intersection, FillRule.NonZero, result);
```

### 12.13.2 多次执行

```csharp
Clipper64 clipper = new Clipper64();
clipper.AddSubject(subject);
clipper.AddClip(clip);

// 第一次：交集
Paths64 intersection = new Paths64();
clipper.Execute(ClipType.Intersection, FillRule.NonZero, intersection);

// 不需要 Clear()，可以继续使用
// 第二次：并集
Paths64 union = new Paths64();
clipper.Execute(ClipType.Union, FillRule.NonZero, union);
```

## 12.14 本章小结

`Clipper64` 是 Clipper2 的核心类：

1. **Execute 方法**：执行布尔运算的入口
2. **ExecuteInternal**：扫描线算法主循环
3. **关键步骤**：
   - 插入局部极小值
   - 处理交点
   - 处理水平边
   - 处理扫描带顶部
4. **输出构建**：将内部结构转换为 Paths64 或 PolyTree64
5. **Z 坐标支持**：通过 ZCallback 处理 Z 值

掌握 `Clipper64` 的使用和实现原理是使用 Clipper2 的关键。

---

[上一章：OutRec与OutPt输出结构](第11章-OutRec与OutPt输出结构) | [返回目录](index) | [下一章：ClipperD浮点裁剪类](第13章-ClipperD浮点裁剪类)

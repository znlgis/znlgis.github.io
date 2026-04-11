---
layout: default
title: 第17章：RectClip 矩形裁剪优化
---

# 第17章：RectClip 矩形裁剪优化

## 17.1 概述

`RectClip64` 和 `RectClipLines64` 是 Clipper2 专门为矩形裁剪优化的类。当裁剪区域是矩形时，使用这些类比通用的 `Clipper64` 快得多。这是 Clipper2 相对于 Clipper1 的重要改进之一。

## 17.2 为什么需要矩形裁剪优化

### 17.2.1 常见场景

- **地图瓦片切割**：将大地图切割为小瓦片
- **视口裁剪**：裁剪到可视区域
- **边界框过滤**：快速过滤超出范围的几何体

### 17.2.2 性能对比

```
通用裁剪 (Clipper64):
- 需要构建完整的扫描线结构
- 处理任意多边形的交点
- 时间复杂度: O(n log n)

矩形裁剪 (RectClip64):
- 利用矩形的简单性质
- 简化的交点计算
- 时间复杂度: O(n)，常数因子小
```

## 17.3 RectClip64 类

### 17.3.1 类定义

```csharp
public class RectClip64
{
    private readonly Rect64 _rect;
    internal readonly Point64 _rectMidPt;
    internal readonly Path64 _rectPath;
    internal Path64 _pathOut;
    internal readonly List<OutPt2> _results;
    internal readonly List<Active> _actives;
    private int _startLocIdx;
    
    public RectClip64(Rect64 rect)
    {
        _rect = rect;
        _rectMidPt = rect.MidPoint();
        _rectPath = rect.AsPath();
        _results = new List<OutPt2>();
        _actives = new List<Active>();
    }
}
```

### 17.3.2 Rect64 属性

```csharp
// 矩形的四个边
internal readonly long rectLeft;
internal readonly long rectTop;
internal readonly long rectRight;
internal readonly long rectBottom;

// 预计算的矩形顶点
internal readonly Point64[] rectCorners;  // 四个角点
```

## 17.4 矩形位置编码

### 17.4.1 Location 枚举

```csharp
internal enum Location
{
    Inside,      // 在矩形内部
    Left,        // 在左边外
    Top,         // 在上边外
    Right,       // 在右边外
    Bottom       // 在下边外
}
```

### 17.4.2 GetLocation 方法

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private Location GetLocation(Point64 pt)
{
    if (pt.X == _rect.left && pt.Y >= _rect.top && pt.Y <= _rect.bottom)
        return Location.Left;
    if (pt.X == _rect.right && pt.Y >= _rect.top && pt.Y <= _rect.bottom)
        return Location.Right;
    if (pt.Y == _rect.top && pt.X >= _rect.left && pt.X <= _rect.right)
        return Location.Top;
    if (pt.Y == _rect.bottom && pt.X >= _rect.left && pt.X <= _rect.right)
        return Location.Bottom;
    
    if (pt.X < _rect.left) return Location.Left;
    if (pt.X > _rect.right) return Location.Right;
    if (pt.Y < _rect.top) return Location.Top;
    if (pt.Y > _rect.bottom) return Location.Bottom;
    
    return Location.Inside;
}
```

### 17.4.3 位置关系图

```
           Top
       ┌─────────┐
  Left │ Inside  │ Right
       │         │
       └─────────┘
          Bottom
          
角点属于两个边界：
左上角 = Left ∪ Top
右上角 = Right ∪ Top
左下角 = Left ∪ Bottom
右下角 = Right ∪ Bottom
```

## 17.5 Execute 方法

### 17.5.1 执行裁剪

```csharp
public Paths64 Execute(Paths64 paths)
{
    Paths64 result = new Paths64();
    
    if (_rect.IsEmpty() || paths.Count == 0)
        return result;
    
    foreach (Path64 path in paths)
    {
        if (path.Count < 3) continue;
        
        // 快速边界框检查
        Rect64 pathBounds = Clipper.GetBounds(path);
        
        if (!_rect.Intersects(pathBounds))
        {
            // 完全在矩形外，跳过
            continue;
        }
        
        if (_rect.Contains(pathBounds))
        {
            // 完全在矩形内，直接添加
            result.Add(path);
            continue;
        }
        
        // 需要实际裁剪
        ClipPath(path, result);
    }
    
    return result;
}
```

### 17.5.2 ClipPath 核心逻辑

```csharp
private void ClipPath(Path64 path, Paths64 result)
{
    _pathOut = new Path64();
    
    int pathLen = path.Count;
    Point64 prev = path[pathLen - 1];
    Location prevLoc = GetLocation(prev);
    
    for (int i = 0; i < pathLen; i++)
    {
        Point64 curr = path[i];
        Location currLoc = GetLocation(curr);
        
        if (prevLoc == Location.Inside)
        {
            // 前一点在内部
            if (currLoc == Location.Inside)
            {
                // 当前点也在内部
                _pathOut.Add(curr);
            }
            else
            {
                // 当前点在外部，计算交点
                AddIntersection(prev, curr, prevLoc, currLoc);
            }
        }
        else
        {
            // 前一点在外部
            if (currLoc == Location.Inside)
            {
                // 当前点在内部，计算交点
                AddIntersection(prev, curr, prevLoc, currLoc);
                _pathOut.Add(curr);
            }
            else if (currLoc == prevLoc)
            {
                // 同一边界，可能需要添加角点
                // ...
            }
            else
            {
                // 不同边界，可能穿过矩形
                AddCorners(prevLoc, currLoc);
            }
        }
        
        prev = curr;
        prevLoc = currLoc;
    }
    
    if (_pathOut.Count > 0)
    {
        result.Add(_pathOut);
    }
}
```

## 17.6 交点计算

### 17.6.1 AddIntersection

```csharp
private void AddIntersection(Point64 prev, Point64 curr, 
    Location prevLoc, Location currLoc)
{
    // 计算与矩形边的交点
    
    if (currLoc == Location.Left || prevLoc == Location.Left)
    {
        // 与左边相交
        Point64 ip = GetLeftIntersection(prev, curr);
        if (ip.Y >= _rect.top && ip.Y <= _rect.bottom)
            _pathOut.Add(ip);
    }
    
    if (currLoc == Location.Right || prevLoc == Location.Right)
    {
        // 与右边相交
        Point64 ip = GetRightIntersection(prev, curr);
        if (ip.Y >= _rect.top && ip.Y <= _rect.bottom)
            _pathOut.Add(ip);
    }
    
    if (currLoc == Location.Top || prevLoc == Location.Top)
    {
        // 与上边相交
        Point64 ip = GetTopIntersection(prev, curr);
        if (ip.X >= _rect.left && ip.X <= _rect.right)
            _pathOut.Add(ip);
    }
    
    if (currLoc == Location.Bottom || prevLoc == Location.Bottom)
    {
        // 与下边相交
        Point64 ip = GetBottomIntersection(prev, curr);
        if (ip.X >= _rect.left && ip.X <= _rect.right)
            _pathOut.Add(ip);
    }
}
```

### 17.6.2 边界交点计算

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private Point64 GetLeftIntersection(Point64 p1, Point64 p2)
{
    if (p1.X == p2.X) return new Point64(_rect.left, p1.Y);
    
    double m = (double)(p2.Y - p1.Y) / (p2.X - p1.X);
    long y = p1.Y + (long)Math.Round(m * (_rect.left - p1.X));
    return new Point64(_rect.left, y);
}

[MethodImpl(MethodImplOptions.AggressiveInlining)]
private Point64 GetTopIntersection(Point64 p1, Point64 p2)
{
    if (p1.Y == p2.Y) return new Point64(p1.X, _rect.top);
    
    double m = (double)(p2.X - p1.X) / (p2.Y - p1.Y);
    long x = p1.X + (long)Math.Round(m * (_rect.top - p1.Y));
    return new Point64(x, _rect.top);
}
```

## 17.7 角点处理

### 17.7.1 AddCorners

```csharp
private void AddCorners(Location prevLoc, Location currLoc)
{
    // 当路径从一个边界跨到另一个边界时，可能需要添加角点
    
    // 确定需要添加哪些角点
    int startIdx = LocToIdx(prevLoc);
    int endIdx = LocToIdx(currLoc);
    
    if (startIdx == endIdx) return;
    
    // 按顺时针或逆时针添加角点
    bool clockwise = IsClockwise(prevLoc, currLoc);
    
    int idx = startIdx;
    while (idx != endIdx)
    {
        _pathOut.Add(_rectCorners[idx]);
        idx = clockwise ? (idx + 1) % 4 : (idx + 3) % 4;
    }
}
```

### 17.7.2 角点索引

```
    0 ─────────── 1
    │             │
    │             │
    │             │
    3 ─────────── 2
    
Corner[0] = (left, top)
Corner[1] = (right, top)
Corner[2] = (right, bottom)
Corner[3] = (left, bottom)
```

## 17.8 RectClipLines64 类

### 17.8.1 线段裁剪

```csharp
public class RectClipLines64
{
    private readonly Rect64 _rect;
    
    public RectClipLines64(Rect64 rect)
    {
        _rect = rect;
    }
    
    public Paths64 Execute(Paths64 paths)
    {
        Paths64 result = new Paths64();
        
        foreach (Path64 path in paths)
        {
            if (path.Count < 2) continue;
            
            ClipLine(path, result);
        }
        
        return result;
    }
}
```

### 17.8.2 ClipLine

```csharp
private void ClipLine(Path64 path, Paths64 result)
{
    Path64 segment = new Path64();
    
    Point64 prev = path[0];
    Location prevLoc = GetLocation(prev);
    
    if (prevLoc == Location.Inside)
        segment.Add(prev);
    
    for (int i = 1; i < path.Count; i++)
    {
        Point64 curr = path[i];
        Location currLoc = GetLocation(curr);
        
        if (prevLoc == Location.Inside)
        {
            if (currLoc == Location.Inside)
            {
                // 两点都在内部
                segment.Add(curr);
            }
            else
            {
                // 离开矩形
                segment.Add(GetExitPoint(prev, curr, currLoc));
                
                // 保存当前线段
                if (segment.Count >= 2)
                {
                    result.Add(segment);
                    segment = new Path64();
                }
            }
        }
        else
        {
            if (currLoc == Location.Inside)
            {
                // 进入矩形
                segment.Add(GetEntryPoint(prev, curr, prevLoc));
                segment.Add(curr);
            }
            else if (LineIntersectsRect(prev, curr))
            {
                // 穿过矩形
                Point64 entry = GetEntryPoint(prev, curr, prevLoc);
                Point64 exit = GetExitPoint(prev, curr, currLoc);
                
                segment.Add(entry);
                segment.Add(exit);
                result.Add(segment);
                segment = new Path64();
            }
        }
        
        prev = curr;
        prevLoc = currLoc;
    }
    
    if (segment.Count >= 2)
        result.Add(segment);
}
```

## 17.9 优化技术

### 17.9.1 快速边界检查

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private bool FastReject(Rect64 pathBounds)
{
    return pathBounds.right < _rect.left ||
           pathBounds.left > _rect.right ||
           pathBounds.bottom < _rect.top ||
           pathBounds.top > _rect.bottom;
}

[MethodImpl(MethodImplOptions.AggressiveInlining)]
private bool FastAccept(Rect64 pathBounds)
{
    return pathBounds.left >= _rect.left &&
           pathBounds.right <= _rect.right &&
           pathBounds.top >= _rect.top &&
           pathBounds.bottom <= _rect.bottom;
}
```

### 17.9.2 内联优化

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private bool IsInsideRect(Point64 pt)
{
    return pt.X >= _rect.left && pt.X <= _rect.right &&
           pt.Y >= _rect.top && pt.Y <= _rect.bottom;
}
```

## 17.10 使用示例

### 17.10.1 多边形裁剪

```csharp
// 定义裁剪矩形
Rect64 rect = new Rect64(0, 0, 100, 100);

// 创建裁剪器
RectClip64 rc = new RectClip64(rect);

// 待裁剪的多边形
Paths64 polygons = new Paths64 {
    new Path64 {
        new Point64(-50, 50),
        new Point64(150, 50),
        new Point64(150, 150),
        new Point64(-50, 150)
    }
};

// 执行裁剪
Paths64 result = rc.Execute(polygons);
```

### 17.10.2 线段裁剪

```csharp
Rect64 rect = new Rect64(0, 0, 100, 100);
RectClipLines64 rcl = new RectClipLines64(rect);

Paths64 lines = new Paths64 {
    new Path64 {
        new Point64(-50, 50),
        new Point64(150, 50)
    }
};

Paths64 result = rcl.Execute(lines);
// result[0] = [(0,50), (100,50)]
```

### 17.10.3 批量处理

```csharp
Rect64 rect = new Rect64(0, 0, 100, 100);
RectClip64 rc = new RectClip64(rect);

// 一次性裁剪多个多边形
Paths64 allPolygons = GetAllPolygons();
Paths64 result = rc.Execute(allPolygons);
```

## 17.11 与 Clipper64 对比

### 17.11.1 性能测试

```csharp
// 测试代码
Rect64 rect = new Rect64(0, 0, 1000, 1000);
Paths64 paths = GenerateRandomPaths(10000);

// RectClip64
var sw1 = Stopwatch.StartNew();
RectClip64 rc = new RectClip64(rect);
Paths64 result1 = rc.Execute(paths);
sw1.Stop();

// Clipper64
var sw2 = Stopwatch.StartNew();
Clipper64 c = new Clipper64();
c.AddSubject(paths);
c.AddClip(rect.AsPath());
Paths64 result2 = new Paths64();
c.Execute(ClipType.Intersection, FillRule.NonZero, result2);
sw2.Stop();

// RectClip64 通常快 5-20 倍
```

### 17.11.2 适用场景

| 场景 | 推荐方法 |
|------|----------|
| 矩形裁剪 | RectClip64 |
| 任意多边形裁剪 | Clipper64 |
| 简单边界检查 | RectClip64 |
| 复杂布尔运算 | Clipper64 |

## 17.12 本章小结

RectClip 提供了优化的矩形裁剪：

1. **专用算法**：利用矩形的几何特性
2. **快速拒绝**：边界框检查
3. **简化计算**：直接计算与边的交点
4. **角点处理**：正确处理跨边界情况
5. **线段版本**：RectClipLines64 处理开放路径

对于矩形裁剪场景，使用 RectClip64 可以获得显著的性能提升。

---

[上一章：ClipperOffset偏移类详解](16-ClipperOffset偏移类详解) | [返回目录](index) | [下一章：Minkowski和与差](18-Minkowski和与差)

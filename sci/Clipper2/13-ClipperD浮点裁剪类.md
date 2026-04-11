---
layout: default
title: 第13章：ClipperD 浮点裁剪类
---

# 第13章：ClipperD 浮点裁剪类

## 13.1 概述

`ClipperD` 是 Clipper2 提供的浮点坐标裁剪类。它内部将浮点坐标缩放为整数进行计算，然后将结果转换回浮点数。这种设计既保留了整数运算的精确性，又提供了浮点接口的便利性。

## 13.2 类定义

### 13.2.1 类声明

```csharp
public class ClipperD : ClipperBase
{
    private readonly double _scale;
    private readonly double _invScale;
    
#if USINGZ
    private ZCallbackD? _zCallback;
    public ZCallbackD? ZCallback
    {
        get => _zCallback;
        set => _zCallback = value;
    }
#endif
    
    public ClipperD(int roundingDecimalPrecision = 2)
    {
        InternalClipper.CheckPrecision(roundingDecimalPrecision);
        _scale = Math.Pow(10, roundingDecimalPrecision);
        _invScale = 1 / _scale;
    }
}
```

### 13.2.2 精度参数

```csharp
// roundingDecimalPrecision 范围：-8 到 8
// 
// precision = 2:  _scale = 100,    精确到小数点后2位
// precision = 3:  _scale = 1000,   精确到小数点后3位
// precision = 0:  _scale = 1,      整数
// precision = -2: _scale = 0.01,   精确到百位
```

## 13.3 缩放原理

### 13.3.1 坐标转换

```
浮点坐标 → 整数坐标（乘以 scale）
(12.345, 67.890) → (1234, 6789) [precision=2]

整数坐标 → 浮点坐标（乘以 invScale）
(1234, 6789) → (12.34, 67.89) [precision=2]
```

### 13.3.2 Scale 和 InvScale

```csharp
public ClipperD(int roundingDecimalPrecision = 2)
{
    // 检查精度范围
    InternalClipper.CheckPrecision(roundingDecimalPrecision);
    
    // 计算缩放因子
    _scale = Math.Pow(10, roundingDecimalPrecision);
    _invScale = 1 / _scale;
}
```

## 13.4 AddPath/AddPaths 方法

### 13.4.1 添加浮点路径

```csharp
public void AddPath(PathD path, PathType pathType, bool isOpen = false)
{
    AddPaths(new PathsD { path }, pathType, isOpen);
}

public void AddPaths(PathsD paths, PathType pathType, bool isOpen = false)
{
    if (paths.Count == 0) return;
    
    // 转换为整数路径
    Paths64 paths64 = new Paths64(paths.Count);
    foreach (PathD path in paths)
    {
        Path64 path64 = new Path64(path.Count);
        foreach (PointD pt in path)
        {
            path64.Add(new Point64(pt, _scale));
        }
        paths64.Add(path64);
    }
    
    // 调用基类方法
    base.AddPaths(paths64, pathType, isOpen);
}
```

### 13.4.2 便捷方法

```csharp
public void AddSubject(PathD path)
{
    AddPath(path, PathType.Subject);
}

public void AddSubject(PathsD paths)
{
    AddPaths(paths, PathType.Subject);
}

public void AddOpenSubject(PathD path)
{
    AddPath(path, PathType.Subject, true);
}

public void AddClip(PathD path)
{
    AddPath(path, PathType.Clip);
}

public void AddClip(PathsD paths)
{
    AddPaths(paths, PathType.Clip);
}
```

## 13.5 Execute 方法

### 13.5.1 主要重载

```csharp
// 输出到 PathsD
public bool Execute(ClipType clipType, FillRule fillRule, PathsD closedSolution)
{
    return Execute(clipType, fillRule, closedSolution, new PathsD());
}

// 分离闭合和开放路径
public bool Execute(ClipType clipType, FillRule fillRule,
    PathsD closedSolution, PathsD openSolution)
{
    closedSolution.Clear();
    openSolution.Clear();
    
    try
    {
        ExecuteInternal(clipType, fillRule);
        
        // 构建整数路径
        Paths64 closedPaths64 = new Paths64();
        Paths64 openPaths64 = new Paths64();
        BuildPaths(closedPaths64, openPaths64);
        
        // 转换为浮点路径
        ConvertPaths(closedPaths64, closedSolution);
        ConvertPaths(openPaths64, openSolution);
    }
    catch
    {
        return false;
    }
    
    ClearSolution();
    return true;
}

// 输出到 PolyTreeD
public bool Execute(ClipType clipType, FillRule fillRule, PolyTreeD polytree)
{
    return Execute(clipType, fillRule, polytree, new PathsD());
}

public bool Execute(ClipType clipType, FillRule fillRule,
    PolyTreeD polytree, PathsD openSolution)
{
    polytree.Clear();
    openSolution.Clear();
    
    try
    {
        ExecuteInternal(clipType, fillRule);
        
        // 构建整数多边形树
        PolyTree64 polytree64 = new PolyTree64();
        Paths64 openPaths64 = new Paths64();
        BuildTree(polytree64, openPaths64);
        
        // 转换为浮点
        ConvertPolyTree(polytree64, polytree);
        ConvertPaths(openPaths64, openSolution);
    }
    catch
    {
        return false;
    }
    
    ClearSolution();
    return true;
}
```

### 13.5.2 ConvertPaths

```csharp
private void ConvertPaths(Paths64 paths64, PathsD pathsD)
{
    pathsD.Capacity = paths64.Count;
    
    foreach (Path64 path64 in paths64)
    {
        PathD pathD = new PathD(path64.Count);
        
        foreach (Point64 pt in path64)
        {
            pathD.Add(new PointD(pt, _invScale));
        }
        
        pathsD.Add(pathD);
    }
}
```

### 13.5.3 ConvertPolyTree

```csharp
private void ConvertPolyTree(PolyPath64 polytree64, PolyPathD polytreeD)
{
    polytreeD.Clear();
    polytreeD.Scale = _invScale;
    
    ConvertPolyTreeNode(polytree64, polytreeD);
}

private void ConvertPolyTreeNode(PolyPath64 node64, PolyPathD nodeD)
{
    // 转换当前节点的路径
    if (node64.Polygon != null)
    {
        PathD pathD = new PathD(node64.Polygon.Count);
        foreach (Point64 pt in node64.Polygon)
        {
            pathD.Add(new PointD(pt, _invScale));
        }
        nodeD.Polygon = pathD;
    }
    
    // 递归转换子节点
    foreach (PolyPath64 child64 in node64)
    {
        PolyPathD childD = nodeD.AddChild();
        ConvertPolyTreeNode(child64, childD);
    }
}
```

## 13.6 精度控制

### 13.6.1 精度检查

```csharp
internal static void CheckPrecision(int precision)
{
    if (precision < -8 || precision > 8)
        throw new Exception("Error: Precision is out of range.");
}
```

### 13.6.2 精度选择建议

| 应用场景 | 建议精度 | 说明 |
|----------|----------|------|
| 屏幕坐标 | 0-1 | 像素级精度 |
| CAD 应用 | 2-4 | 毫米级精度 |
| 地理坐标 | 6-8 | 经纬度精度 |
| 科学计算 | 8 | 最高精度 |

### 13.6.3 精度与性能

```csharp
// 高精度意味着更大的整数值
// precision = 8: _scale = 100000000
// 
// 坐标值被放大后可能接近 MaxCoord 限制
// 需要平衡精度和坐标范围
```

## 13.7 Z 坐标处理

### 13.7.1 ZCallbackD 委托

```csharp
#if USINGZ
public delegate void ZCallbackD(PointD bot1, PointD top1,
    PointD bot2, PointD top2, ref PointD intersectPt);
#endif
```

### 13.7.2 Z 回调转换

```csharp
#if USINGZ
private void InternalZCallback(Point64 bot1, Point64 top1,
    Point64 bot2, Point64 top2, ref Point64 intersectPt)
{
    if (_zCallback == null) return;
    
    // 转换为浮点
    PointD bot1D = new PointD(bot1, _invScale);
    PointD top1D = new PointD(top1, _invScale);
    PointD bot2D = new PointD(bot2, _invScale);
    PointD top2D = new PointD(top2, _invScale);
    PointD intersectPtD = new PointD(intersectPt, _invScale);
    
    // 调用用户回调
    _zCallback(bot1D, top1D, bot2D, top2D, ref intersectPtD);
    
    // Z 值保持整数
    intersectPt = new Point64(intersectPt.X, intersectPt.Y, intersectPtD.z);
}
#endif
```

### 13.7.3 使用示例

```csharp
#if USINGZ
ClipperD clipperD = new ClipperD(2);
clipperD.ZCallback = (bot1, top1, bot2, top2, ref PointD pt) =>
{
    // 线性插值
    if (Math.Abs(top1.y - bot1.y) > 0.0001)
    {
        double t = (pt.y - bot1.y) / (top1.y - bot1.y);
        pt.z = (long)(bot1.z + t * (top1.z - bot1.z));
    }
};
#endif
```

## 13.8 与 Clipper64 的对比

### 13.8.1 功能对比

| 特性 | Clipper64 | ClipperD |
|------|-----------|----------|
| 输入类型 | Point64, Path64 | PointD, PathD |
| 输出类型 | Paths64, PolyTree64 | PathsD, PolyTreeD |
| 内部计算 | 整数 | 整数（缩放后） |
| 精度控制 | 无 | 可配置 |
| 性能 | 略快 | 有转换开销 |

### 13.8.2 选择建议

```csharp
// 使用 Clipper64 当：
// - 数据本身是整数
// - 需要最高性能
// - 精确控制坐标

// 使用 ClipperD 当：
// - 数据是浮点数
// - 需要小数精度
// - 便利性优先
```

## 13.9 使用示例

### 13.9.1 基本使用

```csharp
ClipperD clipper = new ClipperD(3);  // 3 位小数精度

PathD subject = new PathD {
    new PointD(0.0, 0.0),
    new PointD(100.5, 0.0),
    new PointD(100.5, 100.5),
    new PointD(0.0, 100.5)
};
clipper.AddSubject(subject);

PathD clip = new PathD {
    new PointD(50.25, 50.25),
    new PointD(150.75, 50.25),
    new PointD(150.75, 150.75),
    new PointD(50.25, 150.75)
};
clipper.AddClip(clip);

PathsD result = new PathsD();
clipper.Execute(ClipType.Intersection, FillRule.NonZero, result);

// 结果坐标精确到 0.001
foreach (PathD path in result)
{
    foreach (PointD pt in path)
    {
        Console.WriteLine($"({pt.x:F3}, {pt.y:F3})");
    }
}
```

### 13.9.2 混合使用

```csharp
// 可以混合使用静态方法和类实例

// 方法1：使用 ClipperD 类
ClipperD clipper = new ClipperD(2);
clipper.AddSubject(subjectPaths);
clipper.AddClip(clipPaths);
PathsD result1 = new PathsD();
clipper.Execute(ClipType.Union, FillRule.NonZero, result1);

// 方法2：使用静态方法
PathsD result2 = Clipper.Union(subjectPaths, clipPaths, 
    FillRule.NonZero, precision: 2);
```

## 13.10 常见问题

### 13.10.1 精度丢失

```csharp
// 问题：输出坐标与输入略有不同
ClipperD clipper = new ClipperD(2);  // 2 位小数

PointD input = new PointD(12.345, 67.891);
// 内部：(1234, 6789)
// 输出：(12.34, 67.89) - 第三位小数丢失

// 解决：使用更高精度
ClipperD clipper = new ClipperD(4);  // 4 位小数
```

### 13.10.2 坐标溢出

```csharp
// 问题：高精度 + 大坐标可能溢出
ClipperD clipper = new ClipperD(8);  // scale = 100000000

PointD bigPt = new PointD(1e12, 1e12);
// 缩放后：1e20 > MaxCoord，溢出！

// 解决：限制坐标范围或降低精度
// 使用精度 6，坐标范围约 ±9e12
```

### 13.10.3 性能优化

```csharp
// 批量处理时，避免重复创建 ClipperD
ClipperD clipper = new ClipperD(2);

foreach (var data in dataList)
{
    clipper.Clear();
    clipper.AddSubject(data.Subject);
    clipper.AddClip(data.Clip);
    
    PathsD result = new PathsD();
    clipper.Execute(ClipType.Intersection, FillRule.NonZero, result);
    
    // 处理结果...
}
```

## 13.11 内部实现细节

### 13.11.1 Point64 构造

```csharp
// PointD 转 Point64
public Point64(PointD pt, double scale)
{
    X = (long)Math.Round(pt.x * scale, MidpointRounding.AwayFromZero);
    Y = (long)Math.Round(pt.y * scale, MidpointRounding.AwayFromZero);
#if USINGZ
    Z = pt.z;  // Z 直接复制，不缩放
#endif
}
```

### 13.11.2 PointD 构造

```csharp
// Point64 转 PointD
public PointD(Point64 pt, double scale)
{
    x = pt.X * scale;  // scale 通常是 invScale
    y = pt.Y * scale;
#if USINGZ
    z = pt.Z;
#endif
}
```

## 13.12 本章小结

`ClipperD` 提供了浮点坐标的裁剪接口：

1. **核心原理**：浮点坐标缩放为整数计算
2. **精度控制**：通过 `roundingDecimalPrecision` 参数
3. **API 对应**：与 `Clipper64` 对应的浮点版本方法
4. **Z 坐标**：支持浮点 Z 回调
5. **使用场景**：需要浮点精度的应用

选择 `ClipperD` 还是 `Clipper64` 取决于数据类型和精度需求。

---

[上一章：Clipper64裁剪类详解](12-Clipper64裁剪类详解) | [返回目录](index) | [下一章：布尔运算执行流程](14-布尔运算执行流程)

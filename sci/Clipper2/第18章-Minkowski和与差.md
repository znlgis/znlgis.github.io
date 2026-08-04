---
layout: default
title: 第18章：Minkowski 和与差
---

# 第18章：Minkowski 和与差

## 18.1 概述

Minkowski 和与差是两种重要的几何运算，在碰撞检测、运动规划、膨胀/腐蚀等领域有广泛应用。Clipper2 提供了这些运算的实现。

## 18.2 数学定义

### 18.2.1 Minkowski 和

给定两个点集 A 和 B，它们的 Minkowski 和定义为：

```
A ⊕ B = { a + b | a ∈ A, b ∈ B }
```

即 A 中的每个点与 B 中的每个点相加得到的所有点的集合。

### 18.2.2 Minkowski 差

```
A ⊖ B = { a - b | a ∈ A, b ∈ B }
     = A ⊕ (-B)
```

即 A 与 B 的反射的 Minkowski 和。

### 18.2.3 几何意义

```
Minkowski 和的几何意义：
将形状 B 的中心沿着形状 A 的边界移动，B 扫过的区域

       A              B             A ⊕ B
    ┌─────┐         ┌──┐         ┌───────┐
    │     │    ⊕    │  │    =    │       │
    │     │         └──┘         │       │
    └─────┘                      │       │
                                 └───────┘
                                 (圆角化)
```

## 18.3 Clipper2 中的实现

### 18.3.1 MinkowskiSum 方法

```csharp
public static Paths64 MinkowskiSum(Path64 pattern, Path64 path, bool isClosed)
{
    return Minkowski(pattern, path, true, isClosed);
}

public static PathsD MinkowskiSum(PathD pattern, PathD path, bool isClosed, 
    int precision = 2)
{
    InternalClipper.CheckPrecision(precision);
    double scale = Math.Pow(10, precision);
    
    Path64 pattern64 = Clipper.ScalePath64(pattern, scale);
    Path64 path64 = Clipper.ScalePath64(path, scale);
    
    Paths64 result64 = Minkowski(pattern64, path64, true, isClosed);
    
    return Clipper.ScalePathsD(result64, 1.0 / scale);
}
```

### 18.3.2 MinkowskiDiff 方法

```csharp
public static Paths64 MinkowskiDiff(Path64 pattern, Path64 path, bool isClosed)
{
    return Minkowski(pattern, path, false, isClosed);
}
```

### 18.3.3 Minkowski 核心实现

```csharp
private static Paths64 Minkowski(Path64 pattern, Path64 path, 
    bool isSum, bool isClosed)
{
    int patternCnt = pattern.Count;
    int pathCnt = path.Count;
    
    if (patternCnt == 0 || pathCnt == 0) return new Paths64();
    
    // 如果是差集，反转 pattern
    Path64 pat = isSum ? pattern : ReversePath(pattern);
    
    // 计算所有边的 Minkowski 结果
    Paths64 result = new Paths64();
    
    if (isClosed)
    {
        // 闭合路径
        for (int i = 0; i < pathCnt; i++)
        {
            Path64 quad = TranslatePath(pat, path[i]);
            result.Add(quad);
        }
    }
    else
    {
        // 开放路径
        for (int i = 0; i < pathCnt - 1; i++)
        {
            Path64 quad = TranslatePath(pat, path[i]);
            result.Add(quad);
        }
        
        // 最后一点
        Path64 lastQuad = TranslatePath(pat, path[pathCnt - 1]);
        result.Add(lastQuad);
    }
    
    // 使用裁剪器合并所有结果
    Clipper64 clipper = new Clipper64();
    clipper.AddSubject(result);
    
    Paths64 solution = new Paths64();
    clipper.Execute(ClipType.Union, FillRule.NonZero, solution);
    
    return solution;
}
```

## 18.4 TranslatePath

### 18.4.1 实现

```csharp
private static Path64 TranslatePath(Path64 path, Point64 delta)
{
    Path64 result = new Path64(path.Count);
    
    foreach (Point64 pt in path)
    {
        result.Add(new Point64(pt.X + delta.X, pt.Y + delta.Y));
    }
    
    return result;
}
```

### 18.4.2 作用示意

```
原始 pattern:        平移到 path[i]:
    ○──○                    ○──○
    │  │      + (dx, dy) =  │  │
    ○──○                    ○──○
                              ↑
                        位于 path[i] 位置
```

## 18.5 详细算法

### 18.5.1 凸多边形 Minkowski 和

对于凸多边形，有更高效的算法：

```csharp
private static Path64 ConvexMinkowskiSum(Path64 a, Path64 b)
{
    // 确保都是逆时针
    if (!IsPositive(a)) a = ReversePath(a);
    if (!IsPositive(b)) b = ReversePath(b);
    
    // 合并边的旋转角
    int i = IndexOfLowestPoint(a);
    int j = IndexOfLowestPoint(b);
    
    int lenA = a.Count;
    int lenB = b.Count;
    
    Path64 result = new Path64(lenA + lenB);
    
    int iEnd = i + lenA;
    int jEnd = j + lenB;
    
    while (i < iEnd || j < jEnd)
    {
        // 添加当前点
        result.Add(new Point64(
            a[i % lenA].X + b[j % lenB].X,
            a[i % lenA].Y + b[j % lenB].Y
        ));
        
        // 比较边的角度，选择较小的前进
        double angleA = EdgeAngle(a, i % lenA);
        double angleB = EdgeAngle(b, j % lenB);
        
        if (angleA < angleB)
            i++;
        else if (angleB < angleA)
            j++;
        else
        {
            i++;
            j++;
        }
    }
    
    return result;
}
```

### 18.5.2 通用算法

对于非凸多边形，使用分解方法：

```csharp
private static Paths64 GeneralMinkowskiSum(Path64 pattern, Path64 path)
{
    Paths64 result = new Paths64();
    
    int pathLen = path.Count;
    int patternLen = pattern.Count;
    
    // 对于路径的每条边
    for (int i = 0; i < pathLen; i++)
    {
        int j = (i + 1) % pathLen;
        
        // 创建边对应的四边形
        Path64 quad = new Path64(patternLen * 2);
        
        // 沿着 pattern 平移
        for (int k = 0; k < patternLen; k++)
        {
            quad.Add(new Point64(
                path[i].X + pattern[k].X,
                path[i].Y + pattern[k].Y
            ));
        }
        
        for (int k = patternLen - 1; k >= 0; k--)
        {
            quad.Add(new Point64(
                path[j].X + pattern[k].X,
                path[j].Y + pattern[k].Y
            ));
        }
        
        result.Add(quad);
    }
    
    // 合并所有四边形
    return Clipper.Union(result, FillRule.NonZero);
}
```

## 18.6 应用场景

### 18.6.1 碰撞检测

```csharp
// 检测两个多边形是否碰撞
bool CheckCollision(Path64 polyA, Path64 polyB)
{
    // 计算 Minkowski 差
    Paths64 diff = Clipper.MinkowskiDiff(polyA, polyB, true);
    
    // 如果原点在差集内，则碰撞
    Point64 origin = new Point64(0, 0);
    
    foreach (Path64 path in diff)
    {
        if (Clipper.PointInPolygon(origin, path) != 
            PointInPolygonResult.IsOutside)
        {
            return true;  // 碰撞
        }
    }
    
    return false;  // 无碰撞
}
```

### 18.6.2 机器人运动规划

```csharp
// 计算机器人可以移动的空间
Paths64 ComputeConfigurationSpace(Path64 robot, Paths64 obstacles)
{
    // 机器人围绕参考点（通常是中心）
    Path64 robotCentered = CenterPath(robot);
    
    Paths64 expandedObstacles = new Paths64();
    
    foreach (Path64 obstacle in obstacles)
    {
        // 每个障碍物膨胀为 Minkowski 和
        Paths64 expanded = Clipper.MinkowskiSum(
            robotCentered, obstacle, true);
        expandedObstacles.AddRange(expanded);
    }
    
    // 合并所有膨胀后的障碍物
    return Clipper.Union(expandedObstacles, FillRule.NonZero);
}
```

### 18.6.3 形态学操作

```csharp
// 膨胀操作
Paths64 Dilate(Path64 shape, Path64 structuringElement)
{
    // 膨胀 = Minkowski 和
    return Clipper.MinkowskiSum(structuringElement, shape, true);
}

// 腐蚀操作
Paths64 Erode(Path64 shape, Path64 structuringElement)
{
    // 腐蚀 = Minkowski 差（的边界内部）
    // 需要更复杂的处理...
    Path64 reflected = ReflectPath(structuringElement);
    Paths64 diff = Clipper.MinkowskiDiff(shape, reflected, true);
    return diff;
}
```

## 18.7 性能优化

### 18.7.1 简化 pattern

```csharp
// 减少 pattern 的点数可以提高性能
Path64 SimplifyPattern(Path64 pattern, double tolerance)
{
    return Clipper.SimplifyPath(pattern, tolerance);
}
```

### 18.7.2 凸壳优化

```csharp
// 如果只需要外轮廓，可以使用凸壳
Path64 ConvexHullMinkowski(Path64 pattern, Path64 path)
{
    // 对于凸多边形，Minkowski 和的结果也是凸的
    Path64 hullA = Clipper.ConvexHull(pattern);
    Path64 hullB = Clipper.ConvexHull(path);
    
    return ConvexMinkowskiSum(hullA, hullB);
}
```

### 18.7.3 分而治之

```csharp
// 对于大型路径，可以分段处理
Paths64 MinkowskiSumLarge(Path64 pattern, Path64 path)
{
    const int chunkSize = 100;
    
    if (path.Count <= chunkSize)
    {
        return Clipper.MinkowskiSum(pattern, path, true);
    }
    
    Paths64 result = new Paths64();
    
    for (int i = 0; i < path.Count; i += chunkSize)
    {
        int end = Math.Min(i + chunkSize + 1, path.Count);
        Path64 chunk = path.GetRange(i, end - i);
        
        Paths64 chunkResult = Clipper.MinkowskiSum(pattern, chunk, false);
        result.AddRange(chunkResult);
    }
    
    return Clipper.Union(result, FillRule.NonZero);
}
```

## 18.8 使用示例

### 18.8.1 基本 Minkowski 和

```csharp
// 正方形 pattern
Path64 square = new Path64 {
    new Point64(-10, -10),
    new Point64(10, -10),
    new Point64(10, 10),
    new Point64(-10, 10)
};

// 三角形路径
Path64 triangle = new Path64 {
    new Point64(0, 0),
    new Point64(100, 0),
    new Point64(50, 100)
};

// 计算 Minkowski 和
Paths64 result = Clipper.MinkowskiSum(square, triangle, true);

// 结果是三角形"膨胀"了正方形的大小
```

### 18.8.2 Minkowski 差用于碰撞

```csharp
Path64 movingObject = CreateRectangle(0, 0, 20, 20);
Path64 obstacle = CreateRectangle(50, 50, 30, 30);

// 计算 Minkowski 差
Paths64 diff = Clipper.MinkowskiDiff(obstacle, movingObject, true);

// 检查移动目标位置是否碰撞
Point64 targetPosition = new Point64(40, 40);
bool willCollide = IsPointInPaths(targetPosition, diff);
```

### 18.8.3 浮点版本

```csharp
PathD circleApprox = CreateCircleApprox(0, 0, 5.0, 32);
PathD complexPath = LoadPathFromFile("path.dat");

// 使用浮点计算
PathsD result = Clipper.MinkowskiSum(circleApprox, complexPath, true, 3);
```

## 18.9 注意事项

### 18.9.1 路径方向

```csharp
// Minkowski 和要求路径是逆时针的
// 确保方向正确
if (!Clipper.IsPositive(pattern))
    pattern = Clipper.ReversePath(pattern);

if (!Clipper.IsPositive(path))
    path = Clipper.ReversePath(path);
```

### 18.9.2 自相交处理

```csharp
// Minkowski 和可能产生自相交
// 结果通过 Union 自动清理
Paths64 raw = MinkowskiSumRaw(pattern, path);
Paths64 clean = Clipper.Union(raw, FillRule.NonZero);
```

### 18.9.3 性能考量

```
时间复杂度：O(n * m + k log k)
- n = pattern 点数
- m = path 点数
- k = 结果点数

空间复杂度：O(n * m)
```

## 18.10 本章小结

Minkowski 和与差是强大的几何运算：

1. **Minkowski 和**：形状膨胀、扫描区域
2. **Minkowski 差**：碰撞检测、穿透深度
3. **应用广泛**：机器人、游戏、CAD
4. **实现方式**：分解为平移 + 并集
5. **优化方法**：凸壳、分段处理

正确使用这些运算可以解决许多实际问题。

---

[上一章：RectClip矩形裁剪优化](https://znlgis.github.io/sci/Clipper2/第17章-RectClip矩形裁剪优化/) | [返回目录](https://znlgis.github.io/sci/Clipper2/) | [下一章：PolyTree多边形树结构](https://znlgis.github.io/sci/Clipper2/第19章-PolyTree多边形树结构/)

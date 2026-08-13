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

public static PathsD MinkowskiSum(PathD pattern, PathD path, bool isClosed)
{
    return Minkowski.Sum(pattern, path, isClosed);
}
```

说明：当前版本 Clipper 类只保留上述 3 参包装，PathD 重载内部委托给 `Minkowski.Sum`（该重载带 `int decimalPlaces = 2` 默认参数，精度固定由内部按 2 位小数处理）。早期版本教程中的 `precision` 参数已从公开 API 中移除，调用时不再需要（也无法）指定精度。

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

### 18.6.3 形态学基础概念

二值形态学（binary morphology）是处理形状的基本工具。与 18.6.1、18.6.2 不同，本节的"膨胀""腐蚀"是形态学算子，它们与 Minkowski 运算密切相关，但**并非同义词**。

设 A 为待处理形状，B 为结构元素（structuring element，通常是圆盘、方形这类较小的凸形状）。两个基本算子定义为：

```
膨胀（Dilation）：A ⊕ B = ∪_{b∈B} (A + b) = { a + b | a ∈ A, b ∈ B }
   即结构元素 B 沿 A 的所有点平移后扫过的并集，等价于 A 与 B 的 Minkowski 和。

腐蚀（Erosion）：A ⊖ B = { x | x + B ⊆ A }
   即使得"平移后的结构元素仍完全落在 A 内部"的所有 x 的集合。
```

几何直觉：

- 膨胀让形状"变胖"：填充小凹陷、弥合窄缝；
- 腐蚀让形状"变瘦"：剔除细小突起、断开窄桥。

**重要警告：Minkowski 差 A ⊕ (−B) 不是腐蚀。** Minkowski 差（18.6.1 的碰撞检测）计算的是"两个形状发生接触时参考点的位置集合"，关心 B 与 A 边界的相切关系；而腐蚀要求的是"结构元素**整个**放入形状内部"的位置集合，两者在数学上和几何上都不是一回事。若用 `MinkowskiDiff` 代替腐蚀会得到错误结果——这正是早期版本教程中 18.6.3 示例代码的缺陷（既错误地使用了 MinkowskiDiff，又引用了未定义的 ReflectPath）。腐蚀必须通过补集方法计算，见 18.6.5。

### 18.6.4 形态学膨胀

膨胀就是 A 与结构元素 B 的 Minkowski 和，可直接调用 `Clipper.MinkowskiSum`。先用正多边形近似一个以原点为中心的圆盘结构元素：

```csharp
using Clipper2Lib;

// 圆盘结构元素（正多边形近似，中心在原点）
public static Path64 MakeDisk(long radius, int edgeCount = 32)
{
    Path64 disk = new Path64(edgeCount);
    for (int i = 0; i < edgeCount; i++)
    {
        double angle = 2 * Math.PI * i / edgeCount;
        disk.Add(new Point64(
            (long)Math.Round(radius * Math.Cos(angle)),
            (long)Math.Round(radius * Math.Sin(angle))));
    }
    return disk;
}

// 形态学膨胀：A ⊕ B = MinkowskiSum(A, B)
public static Paths64 MorphDilate(Path64 shape, Path64 se)
    => Clipper.MinkowskiSum(shape, se, true);
```

示例：对三角形做半径 5 的圆盘膨胀，三个尖角被磨圆，形状整体向外扩张 5 个单位：

```csharp
Path64 triangle = new Path64 {
    new Point64(0, 0),
    new Point64(100, 0),
    new Point64(50, 100)
};
Path64 disk = MakeDisk(5);
Paths64 dilated = MorphDilate(triangle, disk);
```

### 18.6.5 形态学腐蚀（补集法）

腐蚀不能由 Minkowski 和直接得出，但可以通过补集与 Minkowski 和来构造。设 Aᶜ 表示 A 的补集，Bʳ = { −b | b ∈ B } 表示结构元素关于原点的反射，则：

```
推导：x ∉ (A ⊖ B)
  ⟺ 存在 b ∈ B 使 x + b ∉ A
  ⟺ 存在 b ∈ B 使 x + b ∈ Aᶜ
  ⟺ x ∈ Aᶜ ⊕ (−B) = Aᶜ ⊕ Bʳ

取补集即得：A ⊖ B = (Aᶜ ⊕ Bʳ)ᶜ
```

几何含义："形状内部能放得下结构元素的位置" = "补集向外膨胀后剩下的部分"。因此腐蚀 = 先对补集做（反射结构元素的）Minkowski 和，再取补集。需要补集、反射、腐蚀三个函数；包围盒必须比原始形状大一圈（至少一个结构元素的直径），否则腐蚀结果会被边界截断。

```csharp
// 补集：包围盒减去 paths
public static Paths64 Complement(Paths64 paths, Rect64 bounds)
{
    Path64 box = Clipper.MakePath(new long[] {
        bounds.left, bounds.top,
        bounds.right, bounds.top,
        bounds.right, bounds.bottom,
        bounds.left, bounds.bottom });
    return Clipper.Difference(new Paths64 { box }, paths, FillRule.NonZero);
}

// 结构元素关于原点的反射：B^r = {-b : b in B}
public static Path64 ReflectPath(Path64 pattern)
{
    Path64 reflected = new Path64(pattern.Count);
    foreach (Point64 pt in pattern)
        reflected.Add(new Point64(-pt.X, -pt.Y));
    return reflected;
}

// 形态学腐蚀：A ⊖ B = (A^c ⊕ B^r)^c
public static Paths64 MorphErode(Path64 shape, Path64 se)
{
    Rect64 b = Clipper.GetBounds(shape);
    Rect64 sb = Clipper.GetBounds(se);
    long w = sb.right - sb.left, h = sb.bottom - sb.top;
    Rect64 bounds = new Rect64(b.left - w, b.top - h, b.right + w, b.bottom + h);

    Paths64 comp = Complement(new Paths64 { shape }, bounds);
    Path64 seReflected = ReflectPath(se);
    Paths64 grown = new Paths64();
    foreach (Path64 p in comp)
        grown.AddRange(Clipper.MinkowskiSum(p, seReflected, true));
    return Complement(grown, bounds);
}
```

注意事项：

- **结构元素必须以原点为中心**。反射与 Minkowski 和的平移性质都要求结构元素中心在原点，否则腐蚀结果会整体平移。
- **结构元素对称时 Bʳ = B**，可省略 `ReflectPath`。圆盘、方形、正多边形都关于原点对称。
- **腐蚀结果可能为空**。当结构元素比形状还大，或形状存在比结构元素更窄的区域时，A ⊖ B = ∅。继续做开运算前需先判空。

### 18.6.6 开运算与闭运算

膨胀与腐蚀组合出两个更常用的算子：

```
开运算（Opening）：(A ⊖ B) ⊕ B
闭运算（Closing）：(A ⊕ B) ⊖ B
```

```csharp
// 开运算：(A ⊖ B) ⊕ B —— 平滑凸角、剔除细小突起、断开窄桥
public static Paths64 MorphOpen(Path64 shape, Path64 se)
{
    Paths64 eroded = MorphErode(shape, se);
    Paths64 opened = new Paths64();
    foreach (Path64 p in eroded)
        opened.AddRange(Clipper.MinkowskiSum(p, se, true));
    return Clipper.Union(opened, FillRule.NonZero);
}

// 闭运算：(A ⊕ B) ⊖ B —— 平滑凹角、填充细小凹陷、弥合窄缝
public static Paths64 MorphClose(Path64 shape, Path64 se)
{
    Paths64 dilated = MorphDilate(shape, se);
    Paths64 closed = new Paths64();
    foreach (Path64 p in dilated)
        closed.AddRange(MorphErode(p, se));
    return Clipper.Union(closed, FillRule.NonZero);
}
```

几何效果：

- **开运算**：先腐蚀剔除比结构元素还细小的突起和窄桥，再膨胀恢复主体尺寸——结果平滑了凸角、去除了毛刺。
- **闭运算**：先膨胀填平细小凹陷和窄缝，再腐蚀恢复主体尺寸——结果平滑了凹角、弥合了裂缝。

结构元素为圆盘时，开/闭运算等价于用 `ClipperOffset` 的往返偏移（见第16章）：

```csharp
// 开 = 先收缩再膨胀
Paths64 opened = Clipper.InflatePaths(paths, -r, JoinType.Round, EndType.Polygon);
opened = Clipper.InflatePaths(opened,  r, JoinType.Round, EndType.Polygon);

// 闭 = 先膨胀再收缩
Paths64 closed = Clipper.InflatePaths(paths,  r, JoinType.Round, EndType.Polygon);
closed = Clipper.InflatePaths(closed, -r, JoinType.Round, EndType.Polygon);
```

### 18.6.7 形态学梯度与组合应用

形态学梯度定义为膨胀与腐蚀之差，得到形状的"边界带"：

```
Gradient(A) = (A ⊕ B) \ (A ⊖ B)
```

```csharp
// 形态学梯度：(A ⊕ B) \ (A ⊖ B) —— 边界带
public static Paths64 MorphGradient(Path64 shape, Path64 se)
    => Clipper.Difference(MorphDilate(shape, se), MorphErode(shape, se), FillRule.NonZero);
```

典型应用：

- **边界带提取**：梯度输出即形状边界两侧宽度约为结构元素直径的条带，可用于描边渲染与边界检测。
- **多边形质量检查**：对比原形状与开/闭运算结果的差异，可定位过细的尖角、自相交或退化区域。
- **地图综合（generalization）**：对建筑面先开运算剔除小于结构元素的碎块，再闭运算弥合断裂，是制图综合中形态学滤波的标准流程。

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
PathsD result = Clipper.MinkowskiSum(circleApprox, complexPath, true);
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
6. **形态学基础**：膨胀 = Minkowski 和；腐蚀 ≠ Minkowski 差，须用补集法 `A ⊖ B = (Aᶜ ⊕ Bʳ)ᶜ`
7. **形态学组合**：开运算 `(A ⊖ B) ⊕ B`（剔突起、断窄桥）、闭运算 `(A ⊕ B) ⊖ B`（填凹陷、弥窄缝）、梯度 `(A ⊕ B) \ (A ⊖ B)`（边界带）

正确使用这些运算可以解决许多实际问题。

---

[上一章：RectClip矩形裁剪优化](https://znlgis.github.io/sci/Clipper2/第17章-RectClip矩形裁剪优化/) | [返回目录](https://znlgis.github.io/sci/Clipper2/) | [下一章：PolyTree多边形树结构](https://znlgis.github.io/sci/Clipper2/第19章-PolyTree多边形树结构/)

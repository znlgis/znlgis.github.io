---
layout: default
title: 第6章：InternalClipper 内部工具类
---

# 第6章：InternalClipper 内部工具类

## 6.1 概述

`InternalClipper` 是 Clipper2 的核心工具类，包含了大量的数学计算和几何判断方法。这些方法主要用于内部算法实现，但部分方法也可供外部使用。

## 6.2 类定义

```csharp
public static class InternalClipper
{
    internal const long MaxInt64 = 9223372036854775807;
    internal const long MaxCoord = MaxInt64 / 4;
    internal const double max_coord = MaxCoord;
    internal const double min_coord = -MaxCoord;
    internal const long Invalid64 = MaxInt64;

    internal const double floatingPointTolerance = 1E-12;
    internal const double defaultMinimumEdgeLength = 0.1;
    
    // ... 方法定义
}
```

## 6.3 精度相关方法

### 6.3.1 精度检查

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static void CheckPrecision(int precision)
{
    if (precision < -8 || precision > 8)
        throw new Exception("Error: Precision is out of range.");
}
```

精度参数范围为 -8 到 8，表示小数点位置。

### 6.3.2 近似零判断

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static bool IsAlmostZero(double value)
{
    return (Math.Abs(value) <= floatingPointTolerance);
}
```

判断浮点数是否接近零（容差 10⁻¹²）。

## 6.4 向量运算

### 6.4.1 叉积（Cross Product）

叉积用于判断点的位置关系和多边形方向。

```csharp
public static double CrossProduct(Point64 pt1, Point64 pt2, Point64 pt3)
{
    // typecast to double to avoid potential int overflow
    return ((double) (pt2.X - pt1.X) * (pt3.Y - pt2.Y) -
            (double) (pt2.Y - pt1.Y) * (pt3.X - pt2.X));
}
```

**几何意义**：
- 返回值 > 0：pt3 在向量 pt1→pt2 的左侧
- 返回值 < 0：pt3 在向量 pt1→pt2 的右侧
- 返回值 = 0：三点共线

### 6.4.2 叉积符号

```csharp
public static int CrossProductSign(Point64 pt1, Point64 pt2, Point64 pt3)
{
    long a = pt2.X - pt1.X;
    long b = pt3.Y - pt2.Y;
    long c = pt2.Y - pt1.Y;
    long d = pt3.X - pt2.X;
    
    UInt128Struct ab = MultiplyUInt64((ulong) Math.Abs(a), (ulong) Math.Abs(b));
    UInt128Struct cd = MultiplyUInt64((ulong) Math.Abs(c), (ulong) Math.Abs(d));
    
    int signAB = TriSign(a) * TriSign(b);
    int signCD = TriSign(c) * TriSign(d);

    if (signAB == signCD)
    {
        int result;
        if (ab.hi64 == cd.hi64)
        {
            if (ab.lo64 == cd.lo64) return 0;
            result = (ab.lo64 > cd.lo64) ? 1 : -1;
        }
        else result = (ab.hi64 > cd.hi64) ? 1 : -1;
        return (signAB > 0) ? result : -result;
    }
    return (signAB > signCD) ? 1 : -1;
}
```

这个方法使用 128 位整数避免溢出，只返回符号（-1、0、1）而非精确值。

### 6.4.3 点积（Dot Product）

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static double DotProduct(Point64 pt1, Point64 pt2, Point64 pt3)
{
    // typecast to double to avoid potential int overflow
    return ((double) (pt2.X - pt1.X) * (pt3.X - pt2.X) +
            (double) (pt2.Y - pt1.Y) * (pt3.Y - pt2.Y));
}

[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static double DotProduct(PointD vec1, PointD vec2)
{
    return (vec1.x * vec2.x + vec1.y * vec2.y);
}
```

**用途**：判断角度关系
- 点积 > 0：夹角 < 90°
- 点积 = 0：夹角 = 90°（垂直）
- 点积 < 0：夹角 > 90°

### 6.4.4 PointD 向量叉积

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static double CrossProduct(PointD vec1, PointD vec2)
{
    return (vec1.y * vec2.x - vec2.y * vec1.x);
}
```

## 6.5 共线性判断

### 6.5.1 IsCollinear 方法

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static bool IsCollinear(Point64 pt1, Point64 sharedPt, Point64 pt2)
{
    long a = sharedPt.X - pt1.X;
    long b = pt2.Y - sharedPt.Y;
    long c = sharedPt.Y - pt1.Y;
    long d = pt2.X - sharedPt.X;
    // When checking for collinearity with very large coordinate values
    // then ProductsAreEqual is more accurate than using CrossProduct.
    return ProductsAreEqual(a, b, c, d);
}
```

### 6.5.2 ProductsAreEqual 方法

```csharp
internal static bool ProductsAreEqual(long a, long b, long c, long d)
{
    // nb: unsigned values will be needed for CalcOverflowCarry()
    ulong absA = (ulong) Math.Abs(a);
    ulong absB = (ulong) Math.Abs(b);
    ulong absC = (ulong) Math.Abs(c);
    ulong absD = (ulong) Math.Abs(d);

    UInt128Struct mul_ab = MultiplyUInt64(absA, absB);
    UInt128Struct mul_cd = MultiplyUInt64(absC, absD);

    // nb: it's important to differentiate 0 values here from other values
    int sign_ab = TriSign(a) * TriSign(b);
    int sign_cd = TriSign(c) * TriSign(d);

    return mul_ab.lo64 == mul_cd.lo64 && 
           mul_ab.hi64 == mul_cd.hi64 && 
           sign_ab == sign_cd;
}
```

这个方法使用 128 位乘法来精确判断 `a*b == c*d`，避免浮点数精度问题。

## 6.6 线段相交

### 6.6.1 GetLineIntersectPt（Point64 版本）

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
public static bool GetLineIntersectPt(Point64 ln1a,
    Point64 ln1b, Point64 ln2a, Point64 ln2b, out Point64 ip)
{
    double dy1 = (ln1b.Y - ln1a.Y);
    double dx1 = (ln1b.X - ln1a.X);
    double dy2 = (ln2b.Y - ln2a.Y);
    double dx2 = (ln2b.X - ln2a.X);
    double det = dy1 * dx2 - dy2 * dx1;
    
    if (det == 0.0)
    {
        ip = new Point64();
        return false;  // 平行线
    }

    double t = ((ln1a.X - ln2a.X) * dy2 - (ln1a.Y - ln2a.Y) * dx2) / det;
    
    // 将交点限制在线段1上
    if (t <= 0.0) ip = ln1a;
    else if (t >= 1.0) ip = ln1b;
    else
    {
        ip.X = (long) (ln1a.X + t * dx1);
        ip.Y = (long) (ln1a.Y + t * dy1);
#if USINGZ
        ip.Z = 0;
#endif
    }
    return true;
}
```

**参数 t 的含义**：
- t = 0：交点在 ln1a
- t = 1：交点在 ln1b
- 0 < t < 1：交点在线段内部
- t < 0 或 t > 1：交点在线段延长线上

### 6.6.2 线段相交判断

```csharp
internal static bool SegsIntersect(Point64 seg1a, 
    Point64 seg1b, Point64 seg2a, Point64 seg2b, bool inclusive = false)
{
    double dy1 = (seg1b.Y - seg1a.Y);
    double dx1 = (seg1b.X - seg1a.X);
    double dy2 = (seg2b.Y - seg2a.Y);
    double dx2 = (seg2b.X - seg2a.X);
    double cp = dy1 * dx2 - dy2 * dx1;
    
    if (cp == 0) return false; // 平行线段

    if (inclusive)
    {
        // 包含端点接触的情况
        // ... 详细逻辑
    }
    else
    {
        // 不包含端点接触
        // ... 详细逻辑
    }
}
```

## 6.7 点在多边形内判断

### 6.7.1 PointInPolygon 方法

```csharp
public static PointInPolygonResult PointInPolygon(Point64 pt, Path64 polygon)
{
    int len = polygon.Count, start = 0;
    if (len < 3) return PointInPolygonResult.IsOutside;

    // 跳过与测试点同 Y 坐标的起始点
    while (start < len && polygon[start].Y == pt.Y) start++;
    if (start == len) return PointInPolygonResult.IsOutside;

    bool isAbove = polygon[start].Y < pt.Y, startingAbove = isAbove;
    int val = 0, i = start + 1, end = len;
    
    while (true)
    {
        if (i == end)
        {
            if (end == 0 || start == 0) break;
            end = start;
            i = 0;
        }
        
        // 快速跳过不穿过水平线的点
        if (isAbove)
        {
            while (i < end && polygon[i].Y < pt.Y) i++;
        }
        else
        {
            while (i < end && polygon[i].Y > pt.Y) i++;
        }

        if (i == end) continue;

        Point64 curr = polygon[i], prev;
        if (i > 0) prev = polygon[i - 1];
        else prev = polygon[len - 1];

        // 检查点是否在边上
        if (curr.Y == pt.Y)
        {
            if (curr.X == pt.X || (curr.Y == prev.Y &&
                ((pt.X < prev.X) != (pt.X < curr.X))))
                return PointInPolygonResult.IsOn;
            i++;
            if (i == start) break;
            continue;
        }

        // 射线法计数
        if (pt.X < curr.X && pt.X < prev.X)
        {
            // 点在边的左侧，不计数
        }
        else if (pt.X > prev.X && pt.X > curr.X)
        {
            val = 1 - val; // 切换计数
        }
        else
        {
            int cps2 = CrossProductSign(prev, curr, pt);
            if (cps2 == 0) return PointInPolygonResult.IsOn;
            if ((cps2 < 0) == isAbove) val = 1 - val;
        }
        isAbove = !isAbove;
        i++;
    }

    // 最终判断
    // ... 边界情况处理
    
    return val == 0 ? PointInPolygonResult.IsOutside 
                    : PointInPolygonResult.IsInside;
}
```

这是经典的射线法（Ray Casting）实现，经过优化处理边界情况。

## 6.8 距离计算

### 6.8.1 点到线段的最近点

```csharp
public static Point64 GetClosestPtOnSegment(Point64 offPt,
    Point64 seg1, Point64 seg2)
{
    if (seg1.X == seg2.X && seg1.Y == seg2.Y) return seg1;
    
    double dx = (seg2.X - seg1.X);
    double dy = (seg2.Y - seg1.Y);
    
    // 投影参数
    double q = ((offPt.X - seg1.X) * dx +
                (offPt.Y - seg1.Y) * dy) / ((dx*dx) + (dy*dy));
    
    // 限制在 [0, 1] 范围内
    if (q < 0) q = 0; 
    else if (q > 1) q = 1;
    
    return new Point64(
        seg1.X + Math.Round(q * dx, MidpointRounding.ToEven),
        seg1.Y + Math.Round(q * dy, MidpointRounding.ToEven)
    );
}
```

### 6.8.2 路径包含判断

```csharp
public static bool Path2ContainsPath1(Path64 path1, Path64 path2)
{
    // 容忍一定的舍入误差
    PointInPolygonResult pip = PointInPolygonResult.IsOn;
    
    foreach (Point64 pt in path1)
    {
        switch (PointInPolygon(pt, path2))
        {
            case PointInPolygonResult.IsOutside:
                if (pip == PointInPolygonResult.IsOutside) return false;
                pip = PointInPolygonResult.IsOutside;
                break;
            case PointInPolygonResult.IsInside:
                if (pip == PointInPolygonResult.IsInside) return true;
                pip = PointInPolygonResult.IsInside;
                break;
            default: break;
        }
    }
    
    // 位置仍不确定时，检查中点
    Point64 mp = GetBounds(path1).MidPoint();
    return PointInPolygon(mp, path2) != PointInPolygonResult.IsOutside;
}
```

## 6.9 三元符号函数

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static int TriSign(long x)
{
    return (x < 0) ? -1 : (x > 0) ? 1 : 0;
}
```

返回值：
- x < 0：返回 -1
- x > 0：返回 1
- x = 0：返回 0

## 6.10 坐标值检查

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static long CheckCastInt64(double val)
{
    if ((val >= max_coord) || (val <= min_coord)) return Invalid64;
    return (long)Math.Round(val, MidpointRounding.AwayFromZero);
}
```

将浮点数转换为 64 位整数，超出范围时返回无效值。

## 6.11 本章小结

`InternalClipper` 类提供了 Clipper2 核心算法所需的数学工具：

1. **向量运算**：叉积、点积，用于方向判断
2. **共线性判断**：使用 128 位精度避免溢出
3. **线段相交**：计算交点和判断是否相交
4. **点在多边形内**：射线法实现
5. **距离计算**：点到线段的最近点

这些方法的高效和正确实现是 Clipper2 稳定运行的基础。

---

[上一章：枚举类型与常量](../第05章-枚举类型与常量) | [返回目录](../index) | [下一章：高精度运算](../第07章-高精度运算)

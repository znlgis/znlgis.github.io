---
layout: default
title: �?7章：ClipperOffset 偏移类详�?
---

# �?7章：ClipperOffset 偏移类详�?

## 17.1 概述

`ClipperOffset` 类用于对多边形进行偏移（扩张或收缩）操作。这在制造业（刀具补偿）、地图制作（缓冲区分析）、图形设计（描边效果）等领域有广泛应用�?

## 17.2 类定�?

```csharp
public class ClipperOffset
{
    private Paths m_destPolys;
    private Path m_srcPoly;
    private Path m_destPoly;
    private List<DoublePoint> m_normals = new List<DoublePoint>();
    private double m_delta, m_sinA, m_sin, m_cos;
    private double m_miterLim, m_StepsPerRad;

    private IntPoint m_lowest;
    private PolyNode m_polyNodes = new PolyNode();

    public double ArcTolerance { get; set; }
    public double MiterLimit { get; set; }

    private const double two_pi = Math.PI * 2;
    private const double def_arc_tolerance = 0.25;
    
    // ...
}
```

## 17.3 成员变量详解

| 成员 | 类型 | 说明 |
|------|------|------|
| `m_destPolys` | `Paths` | 目标多边形集�?|
| `m_srcPoly` | `Path` | 当前处理的源多边�?|
| `m_destPoly` | `Path` | 当前构建的目标多边形 |
| `m_normals` | `List<DoublePoint>` | 边的单位法向�?|
| `m_delta` | `double` | 偏移距离 |
| `m_sinA` | `double` | 当前角度的正弦�?|
| `m_sin`, `m_cos` | `double` | 圆弧步进的三角函数�?|
| `m_miterLim` | `double` | 斜接限制因子 |
| `m_StepsPerRad` | `double` | 每弧度的步数 |
| `m_lowest` | `IntPoint` | 最低点位置 |
| `m_polyNodes` | `PolyNode` | 输入多边形的节点�?|
| `ArcTolerance` | `double` | 圆弧近似容差 |
| `MiterLimit` | `double` | 斜接限制 |

## 17.4 构造函�?

```csharp
public ClipperOffset(
    double miterLimit = 2.0, double arcTolerance = def_arc_tolerance)
{
    MiterLimit = miterLimit;
    ArcTolerance = arcTolerance;
    m_lowest.X = -1;
}
```

### 17.4.1 MiterLimit

斜接限制控制尖角的最大延伸长度�?

```
MiterLimit = 距离 / delta

�?MiterLimit (�?2):
    �?
     ╲▁▁▁  �?裁切
      �?
       �?

�?MiterLimit (�?10):
          �?
         �?
        �?
       �?
      �?
     �?�?长尖�?
```

### 17.4.2 ArcTolerance

圆弧近似的精度控制�?

```
高容差（粗糙）：           低容差（平滑）：
      ___                      ⌢⌣
    _/   \_                  �?   �?
   /       \                �?     �?
  |         |              |        |
```

## 17.5 Clear 方法

```csharp
public void Clear()
{
    m_polyNodes.Childs.Clear();
    m_lowest.X = -1;
}
```

## 17.6 AddPath/AddPaths

```csharp
public void AddPath(Path path, JoinType joinType, EndType endType)
{
    int highI = path.Count - 1;
    if (highI < 0) return;
    
    PolyNode newNode = new PolyNode();
    newNode.m_jointype = joinType;
    newNode.m_endtype = endType;

    // 移除重复�?
    if (endType == EndType.etClosedLine || endType == EndType.etClosedPolygon)
        while (highI > 0 && path[0] == path[highI]) highI--;
    
    newNode.m_polygon.Capacity = highI + 1;
    newNode.m_polygon.Add(path[0]);
    
    int j = 0, k = 0;
    for (int i = 1; i <= highI; i++)
        if (newNode.m_polygon[j] != path[i])
        {
            j++;
            newNode.m_polygon.Add(path[i]);
            // 跟踪最低点
            if (path[i].Y > newNode.m_polygon[k].Y ||
                (path[i].Y == newNode.m_polygon[k].Y &&
                path[i].X < newNode.m_polygon[k].X)) 
                k = j;
        }
    
    if (endType == EndType.etClosedPolygon && j < 2) return;

    m_polyNodes.AddChild(newNode);

    // 更新全局最低点
    if (endType != EndType.etClosedPolygon) return;
    if (m_lowest.X < 0)
        m_lowest = new IntPoint(m_polyNodes.ChildCount - 1, k);
    else
    {
        IntPoint ip = m_polyNodes.Childs[(int)m_lowest.X].m_polygon[(int)m_lowest.Y];
        if (newNode.m_polygon[k].Y > ip.Y ||
            (newNode.m_polygon[k].Y == ip.Y &&
            newNode.m_polygon[k].X < ip.X))
            m_lowest = new IntPoint(m_polyNodes.ChildCount - 1, k);
    }
}

public void AddPaths(Paths paths, JoinType joinType, EndType endType)
{
    foreach (Path p in paths)
        AddPath(p, joinType, endType);
}
```

## 17.7 JoinType 枚举

```csharp
public enum JoinType { 
    jtSquare,  // 方形连接
    jtRound,   // 圆形连接
    jtMiter    // 斜接连接
}
```

### 17.7.1 Square（方形）

```
原始�?          偏移�?
    �?             ┌──�?
   �?              �? �?
  �?               �? �?
```

在拐角处创建 45° 斜切边�?

### 17.7.2 Round（圆形）

```
原始�?          偏移�?
    �?             ╭──�?
   �?              �? �?
  �?               �? �?
```

在拐角处创建圆弧�?

### 17.7.3 Miter（斜接）

```
原始�?          偏移�?
    �?               �?
   �?             �?
  �?           �?
             �?
```

延伸边线直到相交。受 MiterLimit 限制�?

## 17.8 EndType 枚举

```csharp
public enum EndType { 
    etClosedPolygon,  // 闭合多边�?
    etClosedLine,     // 闭合�?
    etOpenButt,       // 开�?平头
    etOpenSquare,     // 开�?方头
    etOpenRound       // 开�?圆头
}
```

### 17.8.1 ClosedPolygon

```
输入:              输出:
┌──────�?         ╭────────�?
�?     �?         �?       �?
�?     �?   �?    �?       �?
�?     �?         �?       �?
└──────�?         ╰────────�?
```

偏移闭合多边形的所有边�?

### 17.8.2 ClosedLine

```
输入:              输出:
┌──────�?         ╭────╮╭────�?
�?     �?         �?   ││    �?
�?     �?   �?    �?   ││    �?
�?     �?         �?   ││    �?
└──────�?         ╰────╯╰────�?
```

偏移闭合线的两侧，但不闭合末端�?

### 17.8.3 OpenButt（平头）

```
输入:              输出:
────────          ┌────────�?
                  �?       �?
            �?    �?       �?
                  �?       �?
                  └────────�?
```

末端垂直截断�?

### 17.8.4 OpenSquare（方头）

```
输入:              输出:
────────         ┌──────────�?
                 �?         �?
           �?    �?         �?
                 �?         �?
                 └──────────�?
```

末端延伸 delta 距离后截断�?

### 17.8.5 OpenRound（圆头）

```
输入:              输出:
────────          ╭──────────�?
                  �?         �?
            �?    �?         �?
                  �?         �?
                  ╰──────────�?
```

末端使用半圆�?

## 17.9 Execute 方法

```csharp
public void Execute(ref Paths solution, double delta)
{
    solution.Clear();
    FixOrientations();
    DoOffset(delta);
    
    // 使用 Clipper 清理自相�?
    Clipper clpr = new Clipper();
    clpr.AddPaths(m_destPolys, PolyType.ptSubject, true);
    
    if (delta > 0)
    {
        clpr.Execute(ClipType.ctUnion, solution, 
            PolyFillType.pftPositive, PolyFillType.pftPositive);
    }
    else
    {
        IntRect r = ClipperBase.GetBounds(m_destPolys);
        Path outer = new Path(4);
        outer.Add(new IntPoint(r.left - 10, r.bottom + 10));
        outer.Add(new IntPoint(r.right + 10, r.bottom + 10));
        outer.Add(new IntPoint(r.right + 10, r.top - 10));
        outer.Add(new IntPoint(r.left - 10, r.top - 10));

        clpr.AddPath(outer, PolyType.ptSubject, true);
        clpr.ReverseSolution = true;
        clpr.Execute(ClipType.ctUnion, solution, 
            PolyFillType.pftNegative, PolyFillType.pftNegative);
        if (solution.Count > 0) solution.RemoveAt(0);
    }
}

public void Execute(ref PolyTree solution, double delta)
{
    solution.Clear();
    FixOrientations();
    DoOffset(delta);
    
    // 使用 Clipper 清理
    Clipper clpr = new Clipper();
    clpr.AddPaths(m_destPolys, PolyType.ptSubject, true);
    
    if (delta > 0)
    {
        clpr.Execute(ClipType.ctUnion, solution, 
            PolyFillType.pftPositive, PolyFillType.pftPositive);
    }
    else
    {
        // ... 负偏移处�?...
    }
}
```

### 17.9.1 正偏�?vs 负偏�?

```
正偏�?(delta > 0): 扩张
┌────�?       ╭──────�?
�?   �?  �?   �?     �?
└────�?       ╰──────�?

负偏�?(delta < 0): 收缩
╭──────�?       ┌────�?
�?     �?  �?   �?   �?
╰──────�?       └────�?
```

## 17.10 FixOrientations

确保多边形方向正确：

```csharp
private void FixOrientations()
{
    if (m_lowest.X >= 0 && 
        !Clipper.Orientation(m_polyNodes.Childs[(int)m_lowest.X].m_polygon))
    {
        // 最低点的多边形方向错误，反转所�?
        for (int i = 0; i < m_polyNodes.ChildCount; i++)
        {
            PolyNode node = m_polyNodes.Childs[i];
            if (node.m_endtype == EndType.etClosedPolygon ||
                (node.m_endtype == EndType.etClosedLine && 
                Clipper.Orientation(node.m_polygon)))
                node.m_polygon.Reverse();
        }
    }
    else
    {
        for (int i = 0; i < m_polyNodes.ChildCount; i++)
        {
            PolyNode node = m_polyNodes.Childs[i];
            if (node.m_endtype == EndType.etClosedLine &&
                !Clipper.Orientation(node.m_polygon))
                node.m_polygon.Reverse();
        }
    }
}
```

## 17.11 使用示例

### 17.11.1 基本偏移

```csharp
// 创建正方�?
Path square = new Path();
square.Add(new IntPoint(0, 0));
square.Add(new IntPoint(100, 0));
square.Add(new IntPoint(100, 100));
square.Add(new IntPoint(0, 100));

// 偏移操作
ClipperOffset co = new ClipperOffset();
co.AddPath(square, JoinType.jtRound, EndType.etClosedPolygon);

Paths solution = new Paths();
co.Execute(ref solution, 10);  // 扩张 10 单位
```

### 17.11.2 线段偏移

```csharp
// 创建线段
Path line = new Path();
line.Add(new IntPoint(0, 0));
line.Add(new IntPoint(100, 0));
line.Add(new IntPoint(100, 100));

// 偏移成带宽度的路�?
ClipperOffset co = new ClipperOffset();
co.AddPath(line, JoinType.jtRound, EndType.etOpenRound);

Paths solution = new Paths();
co.Execute(ref solution, 5);  // 宽度�?10
```

### 17.11.3 自定义参�?

```csharp
ClipperOffset co = new ClipperOffset(
    miterLimit: 4.0,      // 较大的斜接限�?
    arcTolerance: 0.1     // 更平滑的圆弧
);

co.AddPath(polygon, JoinType.jtMiter, EndType.etClosedPolygon);

Paths solution = new Paths();
co.Execute(ref solution, 15);
```

## 17.12 本章小结

本章详细分析�?ClipperOffset 类：

1. **类结�?*�?
   - 成员变量管理偏移状�?
   - ArcTolerance �?MiterLimit 控制质量

2. **连接类型**�?
   - Square：方形裁�?
   - Round：圆弧过�?
   - Miter：尖角延�?

3. **端点类型**�?
   - ClosedPolygon/ClosedLine：闭合路�?
   - OpenButt/OpenSquare/OpenRound：开放路�?

4. **执行流程**�?
   - FixOrientations 确保正确方向
   - DoOffset 执行偏移计算
   - 使用 Clipper 清理自相�?

---

[上一章：填充规则详解](�?6�?填充规则详解) | [返回目录](../index) | [下一章：偏移算法实现](�?8�?偏移算法实现)

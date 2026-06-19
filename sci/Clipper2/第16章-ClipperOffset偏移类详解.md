---
layout: default
title: 第16章：ClipperOffset 偏移类详解
---

# 第16章：ClipperOffset 偏移类详解

## 16.1 概述

`ClipperOffset` 类用于对多边形和路径进行偏移（膨胀或收缩）操作。这在 CAD、CNC 加工、地图缓冲区分析等领域有广泛应用。

## 16.2 类定义

### 16.2.1 类声明

```csharp
public class ClipperOffset
{
    // 选项
    private double _miterLimit;
    private double _arcTolerance;
    private bool _preserveCollinear;
    private bool _reverseSolution;
    
    // 内部数据
    private readonly List<Group> _groupList;
    private readonly PathD _normals;
    private readonly Paths64 _solution;
    
    // delta 相关
    private double _groupDelta;
    private double _delta;
    private double _absGroupDelta;
    private double _mitLimSqr;
    private double _stepsPerRad;
    private double _stepSin;
    private double _stepCos;
    
    // 构造函数
    public ClipperOffset(double miterLimit = 2.0, 
        double arcTolerance = 0.25,
        bool preserveCollinear = false,
        bool reverseSolution = false)
    {
        _miterLimit = miterLimit;
        _arcTolerance = arcTolerance;
        _preserveCollinear = preserveCollinear;
        _reverseSolution = reverseSolution;
        _groupList = new List<Group>();
        _normals = new PathD();
        _solution = new Paths64();
    }
}
```

### 16.2.2 Group 类

```csharp
internal class Group
{
    internal Paths64 paths;
    internal JoinType joinType;
    internal EndType endType;
    internal bool pathsReversed;
    
    public Group(Paths64 paths, JoinType joinType, EndType endType)
    {
        this.paths = paths;
        this.joinType = joinType;
        this.endType = endType;
    }
}
```

## 16.3 JoinType 连接类型

### 16.3.1 枚举定义

```csharp
public enum JoinType
{
    Miter,    // 斜接
    Square,   // 方形
    Bevel,    // 斜角
    Round     // 圆角
}
```

### 16.3.2 Miter（斜接）

```
原始：           Miter 偏移：
   ╲                 ╱│
    ╲               ╱ │
     ╲             ╱  │
      ╲──────────╱    │
                      │
                      │

延伸两条偏移边到相交点
受 MiterLimit 限制
```

### 16.3.3 Square（方形）

```
原始：           Square 偏移：
   ╲                 ┌─┐
    ╲               ╱  │
     ╲             ╱   │
      ╲──────────╱─────┘

在拐角处添加方形
```

### 16.3.4 Bevel（斜角）

```
原始：           Bevel 偏移：
   ╲                  ╱
    ╲                ╱│
     ╲              ╱ │
      ╲──────────╱───┘

直接连接两条偏移边
```

### 16.3.5 Round（圆角）

```
原始：           Round 偏移：
   ╲                 ╭─╮
    ╲               ╱   ╲
     ╲             ╱     │
      ╲──────────╱──────╯

使用圆弧连接
```

## 16.4 EndType 端点类型

### 16.4.1 枚举定义

```csharp
public enum EndType
{
    Polygon,   // 闭合多边形
    Joined,    // 连接的开放路径
    Butt,      // 平头
    Square,    // 方形端
    Round      // 圆形端
}
```

### 16.4.2 各类型图示

```
原始路径：○────────────────○

Polygon (闭合):
┌──────────────────┐
│                  │
│  ○────────────○  │
│                  │
└──────────────────┘

Joined (连接):
○────────────────○
│                │
○────────────────○

Butt (平头):
│────────────────│
│                │
│────────────────│

Square (方形端):
┌────────────────┐
│                │
│                │
│                │
└────────────────┘

Round (圆形端):
╭────────────────╮
│                │
│                │
│                │
╰────────────────╯
```

## 16.5 AddPath/AddPaths 方法

### 16.5.1 添加路径

```csharp
public void AddPath(Path64 path, JoinType joinType, EndType endType)
{
    if (path.Count == 0) return;
    
    Paths64 paths = new Paths64(1) { path };
    AddPaths(paths, joinType, endType);
}

public void AddPaths(Paths64 paths, JoinType joinType, EndType endType)
{
    if (paths.Count == 0) return;
    
    _groupList.Add(new Group(paths, joinType, endType));
}
```

### 16.5.2 清除数据

```csharp
public void Clear()
{
    _groupList.Clear();
}
```

## 16.6 Execute 方法

### 16.6.1 执行偏移

```csharp
public void Execute(double delta, Paths64 solution)
{
    solution.Clear();
    
    if (_groupList.Count == 0) return;
    
    _solution.Clear();
    
    // 设置偏移量
    _delta = delta;
    
    // 处理每个组
    foreach (Group group in _groupList)
    {
        DoGroupOffset(group);
    }
    
    // 合并结果
    if (_solution.Count > 0)
    {
        // 使用裁剪器合并可能重叠的区域
        Clipper64 clipper = new Clipper64();
        clipper.PreserveCollinear = _preserveCollinear;
        clipper.ReverseSolution = _reverseSolution;
        clipper.AddSubject(_solution);
        clipper.Execute(ClipType.Union, FillRule.Positive, solution);
    }
}
```

### 16.6.2 Execute 重载

```csharp
// 输出到 PolyTree64
public void Execute(double delta, PolyTree64 polytree)
{
    Paths64 paths = new Paths64();
    Execute(delta, paths);
    
    // 构建 PolyTree
    BuildPolyTree(paths, polytree);
}

// 浮点版本
public void Execute(double delta, PathsD solution)
{
    Paths64 paths64 = new Paths64();
    Execute(delta, paths64);
    
    // 转换为浮点
    solution.Clear();
    foreach (Path64 path in paths64)
    {
        PathD pathD = new PathD(path.Count);
        foreach (Point64 pt in path)
        {
            pathD.Add(new PointD(pt));
        }
        solution.Add(pathD);
    }
}
```

## 16.7 DoGroupOffset

### 16.7.1 组偏移处理

```csharp
private void DoGroupOffset(Group group)
{
    if (group.endType == EndType.Polygon)
    {
        // 闭合多边形
        _groupDelta = group.pathsReversed ? -_delta : _delta;
    }
    else
    {
        // 开放路径
        _groupDelta = Math.Abs(_delta);
    }
    
    _absGroupDelta = Math.Abs(_groupDelta);
    
    // 计算斜接限制
    if (_miterLimit > 1)
        _mitLimSqr = 2 / (_miterLimit * _miterLimit);
    else
        _mitLimSqr = 2;
    
    // 计算圆弧步进
    if (_absGroupDelta > 0)
    {
        double arcTol = _arcTolerance > 0 ? 
            _arcTolerance : 
            _absGroupDelta * 0.25;
        
        _stepsPerRad = Math.PI / Math.Acos(1 - arcTol / _absGroupDelta);
        _stepSin = Math.Sin(2 * Math.PI / _stepsPerRad);
        _stepCos = Math.Cos(2 * Math.PI / _stepsPerRad);
        
        if (_groupDelta < 0) _stepSin = -_stepSin;
    }
    
    // 处理每条路径
    foreach (Path64 path in group.paths)
    {
        DoPath(path, group);
    }
}
```

## 16.8 DoPath 路径偏移

### 16.8.1 处理单条路径

```csharp
private void DoPath(Path64 path, Group group)
{
    int pathLen = path.Count;
    if (pathLen < 2) return;
    
    // 构建法线向量
    BuildNormals(path);
    
    Path64 result = new Path64();
    
    if (group.endType == EndType.Polygon)
    {
        // 闭合多边形偏移
        OffsetPolygon(path, result, group.joinType);
    }
    else if (group.endType == EndType.Joined)
    {
        // 连接的开放路径
        OffsetOpenJoined(path, result, group.joinType);
    }
    else
    {
        // 开放路径
        OffsetOpenPath(path, result, group.joinType, group.endType);
    }
    
    if (result.Count > 0)
        _solution.Add(result);
}
```

### 16.8.2 构建法线

```csharp
private void BuildNormals(Path64 path)
{
    _normals.Clear();
    int cnt = path.Count;
    
    for (int i = 0; i < cnt; i++)
    {
        int j = (i + 1) % cnt;
        
        double dx = path[j].X - path[i].X;
        double dy = path[j].Y - path[i].Y;
        double len = Math.Sqrt(dx * dx + dy * dy);
        
        if (len > 0)
        {
            dx /= len;
            dy /= len;
        }
        
        // 法线：垂直于边的单位向量
        _normals.Add(new PointD(dy, -dx));
    }
}
```

## 16.9 偏移计算

### 16.9.1 OffsetPolygon

```csharp
private void OffsetPolygon(Path64 path, Path64 result, JoinType joinType)
{
    int pathLen = path.Count;
    
    for (int i = 0, k = pathLen - 1; i < pathLen; k = i++)
    {
        // 偏移当前边
        Point64 pt = new Point64(
            path[i].X + _normals[k].x * _groupDelta,
            path[i].Y + _normals[k].y * _groupDelta
        );
        result.Add(pt);
        
        // 处理拐角
        DoJoin(path, result, i, k, joinType);
    }
}
```

### 16.9.2 DoJoin 拐角处理

```csharp
private void DoJoin(Path64 path, Path64 result, int j, int k, JoinType joinType)
{
    // 计算拐角角度
    double cosA = _normals[k].x * _normals[j].x + 
                  _normals[k].y * _normals[j].y;
    
    // 凹角检测
    double sinA = _normals[k].x * _normals[j].y - 
                  _normals[k].y * _normals[j].x;
    
    if (sinA * _groupDelta < 0)
    {
        // 凹角：添加交点
        Point64 pt = GetIntersection(_normals[k], _normals[j], 
            path[j], _groupDelta);
        result.Add(pt);
        return;
    }
    
    // 凸角：根据 JoinType 处理
    switch (joinType)
    {
        case JoinType.Miter:
            DoMiter(path, result, j, k, cosA);
            break;
            
        case JoinType.Square:
            DoSquare(path, result, j, k);
            break;
            
        case JoinType.Bevel:
            DoBevel(path, result, j, k);
            break;
            
        case JoinType.Round:
            DoRound(path, result, j, k, sinA);
            break;
    }
}
```

### 16.9.3 DoMiter

```csharp
private void DoMiter(Path64 path, Path64 result, int j, int k, double cosA)
{
    // 检查是否超过斜接限制
    double q = _groupDelta / (1 + cosA);
    
    if (q > _mitLimSqr * _absGroupDelta)
    {
        // 超过限制，使用斜角
        DoBevel(path, result, j, k);
    }
    else
    {
        // 正常斜接
        result.Add(new Point64(
            path[j].X + (_normals[k].x + _normals[j].x) * q,
            path[j].Y + (_normals[k].y + _normals[j].y) * q
        ));
    }
}
```

### 16.9.4 DoRound

```csharp
private void DoRound(Path64 path, Path64 result, int j, int k, double sinA)
{
    // 计算圆弧需要的步数
    double a = Math.Atan2(sinA, 
        _normals[k].x * _normals[j].x + _normals[k].y * _normals[j].y);
    int steps = Math.Max(2, (int)Math.Ceiling(_stepsPerRad * Math.Abs(a)));
    
    // 起始点
    double x = _normals[k].x;
    double y = _normals[k].y;
    
    for (int i = 0; i < steps; i++)
    {
        result.Add(new Point64(
            path[j].X + x * _groupDelta,
            path[j].Y + y * _groupDelta
        ));
        
        // 旋转
        double x2 = x * _stepCos - y * _stepSin;
        y = x * _stepSin + y * _stepCos;
        x = x2;
    }
}
```

## 16.10 开放路径偏移

### 16.10.1 OffsetOpenPath

```csharp
private void OffsetOpenPath(Path64 path, Path64 result, 
    JoinType joinType, EndType endType)
{
    // 偏移正向
    OffsetLine(path, result, joinType);
    
    // 处理终点
    DoEndCap(path, result, endType, false);
    
    // 偏移反向
    OffsetLineReverse(path, result, joinType);
    
    // 处理起点
    DoEndCap(path, result, endType, true);
}
```

### 16.10.2 DoEndCap 端点处理

```csharp
private void DoEndCap(Path64 path, Path64 result, EndType endType, bool isStart)
{
    int idx = isStart ? 0 : path.Count - 1;
    Point64 pt = path[idx];
    PointD normal = isStart ? 
        new PointD(-_normals[0].x, -_normals[0].y) : 
        _normals[path.Count - 2];
    
    switch (endType)
    {
        case EndType.Butt:
            // 平头：不添加额外点
            result.Add(new Point64(
                pt.X + normal.x * _groupDelta,
                pt.Y + normal.y * _groupDelta
            ));
            break;
            
        case EndType.Square:
            // 方形端
            result.Add(new Point64(
                pt.X + normal.x * _groupDelta - normal.y * _groupDelta,
                pt.Y + normal.y * _groupDelta + normal.x * _groupDelta
            ));
            result.Add(new Point64(
                pt.X - normal.x * _groupDelta - normal.y * _groupDelta,
                pt.Y - normal.y * _groupDelta + normal.x * _groupDelta
            ));
            break;
            
        case EndType.Round:
            // 圆形端
            DoRoundEnd(pt, normal, result);
            break;
    }
}
```

## 16.11 参数配置

### 16.11.1 MiterLimit

```csharp
public double MiterLimit
{
    get => _miterLimit;
    set => _miterLimit = value > 0 ? value : 2.0;
}
```

MiterLimit 控制斜接角的最大延伸：

```
MiterLimit = 2（默认）：角度约 60° 以下使用斜接
MiterLimit = 4：角度约 30° 以下使用斜接
MiterLimit = 1：总是使用斜角
```

### 16.11.2 ArcTolerance

```csharp
public double ArcTolerance
{
    get => _arcTolerance;
    set => _arcTolerance = value > 0 ? value : 0.25;
}
```

ArcTolerance 控制圆弧的精度：
- 值越小，圆弧越平滑
- 值越大，圆弧越粗糙
- 默认 0.25，即误差 0.25 单位

## 16.12 使用示例

### 16.12.1 基本使用

```csharp
ClipperOffset co = new ClipperOffset();

// 添加多边形
Path64 polygon = new Path64 {
    new Point64(0, 0),
    new Point64(100, 0),
    new Point64(100, 100),
    new Point64(0, 100)
};
co.AddPath(polygon, JoinType.Round, EndType.Polygon);

// 执行膨胀 10 单位
Paths64 result = new Paths64();
co.Execute(10, result);

// 执行收缩 5 单位
co.Clear();
co.AddPaths(result, JoinType.Round, EndType.Polygon);
Paths64 shrunk = new Paths64();
co.Execute(-5, shrunk);
```

### 16.12.2 开放路径

```csharp
ClipperOffset co = new ClipperOffset();

Path64 line = new Path64 {
    new Point64(0, 0),
    new Point64(100, 50),
    new Point64(200, 0)
};

// 圆角端点
co.AddPath(line, JoinType.Round, EndType.Round);

Paths64 result = new Paths64();
co.Execute(10, result);
```

## 16.13 本章小结

`ClipperOffset` 提供了强大的路径偏移功能：

1. **JoinType**：四种拐角连接方式
2. **EndType**：五种端点处理方式
3. **参数控制**：MiterLimit 和 ArcTolerance
4. **自动合并**：使用裁剪器合并重叠区域

合理配置参数可以满足各种偏移需求。

---

[上一章：填充规则详解](第15章-填充规则详解) | [返回目录](index) | [下一章：RectClip矩形裁剪优化](第17章-RectClip矩形裁剪优化)

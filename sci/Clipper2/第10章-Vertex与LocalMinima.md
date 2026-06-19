---
layout: default
title: 第10章：Vertex 顶点与 LocalMinima 局部极小值
---

# 第10章：Vertex 顶点与 LocalMinima 局部极小值

## 10.1 概述

在 Clipper2 的扫描线算法中，`Vertex` 和 `LocalMinima` 是两个关键的内部数据结构。`Vertex` 表示多边形的顶点，而 `LocalMinima` 表示多边形轮廓中的局部最低点，是扫描线算法的起始点。

## 10.2 Vertex 类

### 10.2.1 类定义

```csharp
internal class Vertex
{
    public Point64 pt;        // 顶点坐标
    public Vertex? next;      // 下一个顶点
    public Vertex? prev;      // 上一个顶点
    public VertexFlags flags; // 顶点标志
}
```

### 10.2.2 双向循环链表

每个多边形的顶点形成一个双向循环链表：

```
    ○──next──→○──next──→○
    │         │         │
    ↑         ↑         ↑
  prev      prev      prev
    │         │         │
    ○←─prev───○←─prev───○
    
    闭合路径形成环形：
    v1 ←→ v2 ←→ v3 ←→ v4 ←→ v1
```

### 10.2.3 Vertex vs Point64

| 特性 | Point64 | Vertex |
|------|---------|--------|
| 类型 | struct | class |
| 内容 | 仅坐标 | 坐标+链接+标志 |
| 用途 | 用户输入/输出 | 内部处理 |
| 关系 | 独立 | 链表节点 |

## 10.3 VertexFlags 枚举

### 10.3.1 定义

```csharp
[Flags]
internal enum VertexFlags
{
    None = 0,
    OpenStart = 1,   // 开放路径起点
    OpenEnd = 2,     // 开放路径终点
    LocalMax = 4,    // 局部最大值
    LocalMin = 8     // 局部最小值
}
```

### 10.3.2 位标志操作

```csharp
// 设置标志
vertex.flags |= VertexFlags.LocalMin;

// 检查标志
bool isLocalMin = (vertex.flags & VertexFlags.LocalMin) != 0;

// 组合标志
vertex.flags = VertexFlags.OpenStart | VertexFlags.LocalMin;

// 清除标志
vertex.flags &= ~VertexFlags.LocalMax;
```

### 10.3.3 标志的几何意义

```
           ●  LocalMax（局部最大值）
          ╱╲
         ╱  ╲
        ╱    ╲
       ╱      ╲
      ●        ●  普通顶点
       ╲      ╱
        ╲    ╱
         ╲  ╱
          ╲╱
           ●  LocalMin（局部极小值）
```

## 10.4 LocalMinima 类

### 10.4.1 类定义

```csharp
internal class LocalMinima
{
    public readonly Vertex vertex;     // 极小值顶点
    public readonly PathType pathtype; // 路径类型（Subject/Clip）
    public readonly bool isOpen;       // 是否开放路径
    
    public LocalMinima(Vertex vertex, PathType pathtype, bool isOpen = false)
    {
        this.vertex = vertex;
        this.pathtype = pathtype;
        this.isOpen = isOpen;
    }
}
```

### 10.4.2 只读字段

使用 `readonly` 关键字确保一旦创建就不可修改：

```csharp
public readonly Vertex vertex;
public readonly PathType pathtype;
public readonly bool isOpen;
```

### 10.4.3 局部极小值的特征

一个顶点是局部极小值当且仅当：
- 前一个顶点的 Y 坐标 > 当前顶点的 Y 坐标
- 后一个顶点的 Y 坐标 ≥ 当前顶点的 Y 坐标
- 或者相反方向（取决于遍历顺序）

## 10.5 顶点链表构建

### 10.5.1 从 Path64 创建 Vertex 链表

```csharp
private void AddPathToVertexList(Path64 path, PathType pathtype, bool isOpen)
{
    int pathCnt = path.Count;
    if (pathCnt < 2) return;
    if (!isOpen && pathCnt < 3) return;
    
    // 创建顶点数组
    Vertex[] vertices = new Vertex[pathCnt];
    
    // 第一个顶点
    vertices[0] = new Vertex { pt = path[0] };
    
    // 创建中间顶点
    for (int i = 1; i < pathCnt; i++)
    {
        vertices[i] = new Vertex { pt = path[i] };
        vertices[i].prev = vertices[i - 1];
        vertices[i - 1].next = vertices[i];
    }
    
    // 闭合路径
    if (!isOpen)
    {
        vertices[pathCnt - 1].next = vertices[0];
        vertices[0].prev = vertices[pathCnt - 1];
    }
    
    // 标记局部极值
    MarkLocalMinMax(vertices[0], pathtype, isOpen);
    
    // 添加到顶点列表
    _vertexList.Add(new List<Vertex>(vertices));
}
```

### 10.5.2 去除重复顶点

```csharp
private Vertex? AddVertexWithDuplicateCheck(Point64 pt, Vertex? prev)
{
    // 跳过重复点
    if (prev != null && pt == prev.pt)
        return prev;
    
    Vertex v = new Vertex
    {
        pt = pt,
        prev = prev
    };
    
    if (prev != null)
        prev.next = v;
    
    return v;
}
```

## 10.6 标记局部极值

### 10.6.1 识别局部极小值

```csharp
private void MarkLocalMinMax(Vertex firstVertex, PathType pathtype, bool isOpen)
{
    Vertex curr = firstVertex;
    
    do
    {
        // 检查是否为局部极小值
        if (IsLocalMin(curr))
        {
            curr.flags |= VertexFlags.LocalMin;
            AddLocMin(curr, pathtype, isOpen);
        }
        // 检查是否为局部最大值
        else if (IsLocalMax(curr))
        {
            curr.flags |= VertexFlags.LocalMax;
        }
        
        curr = curr.next!;
    } while (curr != firstVertex);
}
```

### 10.6.2 IsLocalMin 判断

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private static bool IsLocalMin(Vertex vertex)
{
    Vertex prev = vertex.prev!;
    Vertex next = vertex.next!;
    
    // Y轴向下，较小Y值为"下方"
    // 判断当前点是否比前后都低
    return prev.pt.Y > vertex.pt.Y && next.pt.Y >= vertex.pt.Y;
}
```

### 10.6.3 IsLocalMax 判断

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private static bool IsLocalMax(Vertex vertex)
{
    Vertex prev = vertex.prev!;
    Vertex next = vertex.next!;
    
    // 判断当前点是否比前后都高
    return prev.pt.Y < vertex.pt.Y && next.pt.Y <= vertex.pt.Y;
}
```

### 10.6.4 处理水平边

```csharp
// 当有水平边时，需要特殊处理
// 向前或向后搜索非水平顶点
private static Vertex? FindNextNonHorizontal(Vertex v, bool goForward)
{
    Vertex start = v;
    v = goForward ? v.next! : v.prev!;
    
    while (v != start && v.pt.Y == start.pt.Y)
    {
        v = goForward ? v.next! : v.prev!;
    }
    
    return v != start ? v : null;
}
```

## 10.7 开放路径处理

### 10.7.1 标记开放路径端点

```csharp
private void MarkOpenPathEndpoints(Vertex firstVertex)
{
    // 标记起点
    firstVertex.flags |= VertexFlags.OpenStart;
    
    // 找到终点
    Vertex last = firstVertex;
    while (last.next != null && last.next != firstVertex)
    {
        last = last.next;
    }
    
    // 标记终点
    last.flags |= VertexFlags.OpenEnd;
}
```

### 10.7.2 开放路径的局部极值

```csharp
// 开放路径的起点和终点也可能是局部极值
// 需要检查边界情况

if (isOpen)
{
    // 起点检查
    if (IsLocalMinAtStart(firstVertex))
    {
        firstVertex.flags |= VertexFlags.LocalMin;
        AddLocMin(firstVertex, pathtype, true);
    }
    
    // 终点检查
    if (IsLocalMinAtEnd(lastVertex))
    {
        lastVertex.flags |= VertexFlags.LocalMin;
        AddLocMin(lastVertex, pathtype, true);
    }
}
```

## 10.8 局部极小值列表管理

### 10.8.1 添加到列表

```csharp
private void AddLocMin(Vertex vert, PathType pathtype, bool isOpen)
{
    // 添加扫描线
    if (!_scanlineList.Contains(vert.pt.Y))
        _scanlineList.Add(vert.pt.Y);
    
    // 创建并添加 LocalMinima
    LocalMinima lm = new LocalMinima(vert, pathtype, isOpen);
    _minimaList.Add(lm);
    
    // 标记需要重新排序
    _isSortedMinimaList = false;
}
```

### 10.8.2 排序极小值列表

```csharp
private void SortMinimaList()
{
    if (!_isSortedMinimaList)
    {
        // 按 Y 坐标降序排序（从大到小，即从上到下）
        _minimaList.Sort((a, b) => b.vertex.pt.Y.CompareTo(a.vertex.pt.Y));
        _isSortedMinimaList = true;
    }
}
```

### 10.8.3 扫描顺序

```
Y = 100  ──────────────────  ← 开始扫描
         ╲                ╱
Y = 80    ╲              ╱
           ╲    ╱╲     ╱
Y = 60      ╲  ╱  ╲   ╱
             ╲╱    ╲ ╱
Y = 40  LocalMin1  LocalMin2  ← 极小值点
              ╲    ╱
Y = 20         ╲  ╱
                ╲╱
Y = 0     LocalMin3           ← 结束扫描
```

## 10.9 从 LocalMinima 创建 Active

### 10.9.1 创建左右边

```csharp
private void InsertLocalMinima(LocalMinima locMin)
{
    Vertex vert = locMin.vertex;
    
    // 创建左边界（向上方向）
    Active leftEdge = new Active();
    leftEdge.bot = vert.pt;
    leftEdge.top = vert.next!.pt;
    leftEdge.curX = leftEdge.bot.X;
    leftEdge.dx = GetDx(leftEdge.bot, leftEdge.top);
    leftEdge.windDx = 1;  // 向上
    leftEdge.localMin = locMin;
    leftEdge.isLeftBound = true;
    leftEdge.vertexTop = vert.next;
    
    // 创建右边界（向上方向，但沿prev方向）
    Active rightEdge = new Active();
    rightEdge.bot = vert.pt;
    rightEdge.top = vert.prev!.pt;
    rightEdge.curX = rightEdge.bot.X;
    rightEdge.dx = GetDx(rightEdge.bot, rightEdge.top);
    rightEdge.windDx = -1;  // 向上但沿相反方向
    rightEdge.localMin = locMin;
    rightEdge.isLeftBound = false;
    rightEdge.vertexTop = vert.prev;
    
    // 插入到 AEL
    InsertLeftEdge(leftEdge);
    InsertRightEdge(rightEdge);
}
```

### 10.9.2 边的配对

```
              左边界    右边界
                ↑        ↑
                │        │
                │        │
                └────────┘
                    ●
              LocalMinima
```

## 10.10 迭代处理极小值

### 10.10.1 主循环

```csharp
private void ProcessLocalMinima(long y)
{
    while (_currentLocMinIdx < _minimaList.Count)
    {
        LocalMinima locMin = _minimaList[_currentLocMinIdx];
        
        // 检查是否到达当前 Y
        if (locMin.vertex.pt.Y != y) break;
        
        // 处理这个极小值
        InsertLocalMinima(locMin);
        
        _currentLocMinIdx++;
    }
}
```

### 10.10.2 PopLocalMinima

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private bool PopLocalMinima(long y, out LocalMinima locMin)
{
    if (_currentLocMinIdx < _minimaList.Count &&
        _minimaList[_currentLocMinIdx].vertex.pt.Y == y)
    {
        locMin = _minimaList[_currentLocMinIdx++];
        return true;
    }
    
    locMin = null!;
    return false;
}
```

## 10.11 顶点遍历

### 10.11.1 向上遍历

```csharp
private Vertex? NextVertex(Vertex current, bool goLeft)
{
    if (goLeft)
        return current.prev;
    else
        return current.next;
}
```

### 10.11.2 跳过相同 Y 坐标

```csharp
private Vertex GetNextVertex(Vertex vertex, bool goingUp)
{
    Vertex result = goingUp ? vertex.next! : vertex.prev!;
    
    // 跳过水平段
    while (result.pt.Y == vertex.pt.Y)
    {
        result = goingUp ? result.next! : result.prev!;
    }
    
    return result;
}
```

## 10.12 内存管理

### 10.12.1 顶点重用

```csharp
// 顶点通常不重用，因为它们的生命周期与路径相同
// 但在清理时需要正确释放

internal void ClearVertexList()
{
    foreach (var vertList in _vertexList)
    {
        vertList.Clear();
    }
    _vertexList.Clear();
}
```

### 10.12.2 LocalMinima 管理

```csharp
internal void ClearMinimaList()
{
    _minimaList.Clear();
    _currentLocMinIdx = 0;
    _isSortedMinimaList = false;
}
```

## 10.13 调试与可视化

### 10.13.1 打印顶点链表

```csharp
#if DEBUG
internal void DumpVertices(Vertex start)
{
    Vertex v = start;
    int count = 0;
    
    Console.WriteLine("=== Vertices ===");
    do
    {
        Console.WriteLine($"{count++}: ({v.pt.X},{v.pt.Y}) flags={v.flags}");
        v = v.next!;
    } while (v != start && v != null);
}
#endif
```

### 10.13.2 打印极小值列表

```csharp
#if DEBUG
internal void DumpMinimaList()
{
    Console.WriteLine("=== LocalMinima ===");
    foreach (var lm in _minimaList)
    {
        Console.WriteLine($"Y={lm.vertex.pt.Y} X={lm.vertex.pt.X} " +
                          $"type={lm.pathtype} open={lm.isOpen}");
    }
}
#endif
```

## 10.14 本章小结

`Vertex` 和 `LocalMinima` 是 Clipper2 扫描线算法的基础结构：

1. **Vertex**：
   - 存储顶点坐标和链接
   - 形成双向循环链表
   - 使用标志位标记特殊顶点

2. **VertexFlags**：
   - `LocalMin/LocalMax`：标记极值点
   - `OpenStart/OpenEnd`：标记开放路径端点

3. **LocalMinima**：
   - 存储极小值顶点引用
   - 包含路径类型和开放状态
   - 是扫描线算法的起点

4. **关键操作**：
   - 顶点链表构建
   - 局部极值识别
   - 极小值排序和迭代

理解这些结构是理解 Clipper2 扫描线算法执行过程的基础。

---

[上一章：Active活动边结构](第09章-Active活动边结构) | [返回目录](index) | [下一章：OutRec与OutPt输出结构](第11章-OutRec与OutPt输出结构)

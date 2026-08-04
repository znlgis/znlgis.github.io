---
layout: default
title: 第8章：ClipperBase 基类详解
---

# 第8章：ClipperBase 基类详解

## 8.1 概述

`ClipperBase` 是 Clipper2 裁剪引擎的核心基类，定义了多边形裁剪算法的主要数据结构和基础方法。`Clipper64` 和 `ClipperD` 都继承自这个类。

## 8.2 类层次结构

```
ClipperBase (抽象基类)
├── Clipper64 (整数坐标裁剪)
└── ClipperD (浮点坐标裁剪)
```

## 8.3 核心成员变量

### 8.3.1 变量声明

```csharp
public abstract class ClipperBase
{
    // 选项标志
    private ClipType _cliptype;
    private FillRule _fillrule;
    
    // 数据列表
    internal List<LocalMinima> _minimaList;
    internal List<List<Vertex>> _vertexList;
    internal List<long> _scanlineList;
    
    // 活动边表
    internal Active? _actives;
    internal Active? _sel;
    
    // 输出结构
    internal List<OutRec> _outrecList;
    internal List<HorzSegment>? _horz_seg_list;
    internal List<HorzJoin>? _horz_join_list;
    
    // 状态标志
    internal bool _isSortedMinimaList;
    internal bool _hasOpenPaths;
    
    // 其他
    internal int _currentLocMinIdx;
    internal long _currentBotY;
    
    // 对象池
    private readonly Pool<OutPt> _outPtPool;
    private readonly Pool<OutRec> _outRecPool;
    
    // ...
}
```

### 8.3.2 变量用途说明

| 变量名 | 类型 | 用途 |
|--------|------|------|
| `_minimaList` | `List<LocalMinima>` | 局部极小值列表 |
| `_vertexList` | `List<List<Vertex>>` | 顶点列表的列表 |
| `_scanlineList` | `List<long>` | 扫描线Y坐标列表 |
| `_actives` | `Active?` | 活动边表头指针 |
| `_outrecList` | `List<OutRec>` | 输出记录列表 |
| `_hasOpenPaths` | `bool` | 是否包含开放路径 |

## 8.4 局部极小值列表 (MinimaList)

### 8.4.1 LocalMinima 结构

```csharp
internal class LocalMinima
{
    public readonly Vertex vertex;
    public readonly PathType pathtype;
    public readonly bool isOpen;
    
    public LocalMinima(Vertex vertex, PathType pathtype, bool isOpen = false)
    {
        this.vertex = vertex;
        this.pathtype = pathtype;
        this.isOpen = isOpen;
    }
}
```

### 8.4.2 极小值的几何意义

在多边形轮廓中，局部极小值是Y坐标最低的点（在Y轴向上的坐标系中）：

```
           ▲ Y
           │
    ○──────●──────○     ← 局部最大值
    │             │
    │             │
    ○             ○
     ╲           ╱
      ╲         ╱
       ╲       ╱
        ●─────●         ← 局部极小值
           │
```

### 8.4.3 添加到极小值列表

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private void AddLocMin(Vertex vert, PathType pathtype, bool isOpen)
{
    // 如果需要构建扫描线列表
    if (!_scanlineList.Contains(vert.pt.Y))
        _scanlineList.Add(vert.pt.Y);
    
    // 添加到局部极小值列表
    _minimaList.Add(new LocalMinima(vert, pathtype, isOpen));
}
```

### 8.4.4 排序极小值

```csharp
private void SortMinima()
{
    if (!_isSortedMinimaList)
    {
        // 按 Y 坐标降序排序（从上到下扫描）
        _minimaList.Sort((a, b) => b.vertex.pt.Y.CompareTo(a.vertex.pt.Y));
        _isSortedMinimaList = true;
    }
}
```

## 8.5 顶点列表 (VertexList)

### 8.5.1 Vertex 结构

```csharp
internal class Vertex
{
    public Point64 pt;
    public Vertex? next;
    public Vertex? prev;
    public VertexFlags flags;
}
```

每个多边形路径都有自己的顶点链表，存储在 `_vertexList` 中。

### 8.5.2 顶点标志

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

### 8.5.3 顶点链表构建

```csharp
private void AddPathsToVertexList(Paths64 paths, PathType pathType, bool isOpen)
{
    foreach (Path64 path in paths)
    {
        Vertex? firstVert = null;
        Vertex? prevVert = null;
        
        foreach (Point64 pt in path)
        {
            // 跳过重复点
            if (prevVert != null && pt == prevVert.pt) continue;
            
            Vertex v = new Vertex
            {
                pt = pt,
                flags = VertexFlags.None
            };
            
            if (firstVert == null)
                firstVert = v;
            else
            {
                prevVert!.next = v;
                v.prev = prevVert;
            }
            prevVert = v;
        }
        
        // 闭合路径
        if (!isOpen && firstVert != null && prevVert != null)
        {
            prevVert.next = firstVert;
            firstVert.prev = prevVert;
        }
        
        // 将顶点列表添加到 _vertexList
        if (firstVert != null)
            _vertexList.Add(CreateVertexList(firstVert));
        
        // 识别并标记局部极值
        MarkLocalMinMax(firstVert, pathType, isOpen);
    }
}
```

## 8.6 扫描线列表 (ScanlineList)

### 8.6.1 扫描线的作用

扫描线算法的核心是维护一个有序的Y坐标列表，算法在每个Y坐标处进行事件处理。

```csharp
internal List<long> _scanlineList;
```

### 8.6.2 扫描线操作

```csharp
// 添加扫描线
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private void AddScanline(long y)
{
    // 使用二分查找保持有序
    int index = _scanlineList.BinarySearch(y);
    if (index < 0)
        _scanlineList.Insert(~index, y);
}

// 弹出下一个扫描线
[MethodImpl(MethodImplOptions.AggressiveInlining)]
private bool PopScanline(out long y)
{
    if (_scanlineList.Count == 0)
    {
        y = 0;
        return false;
    }
    
    // 获取最后一个（最大Y值）
    int lastIndex = _scanlineList.Count - 1;
    y = _scanlineList[lastIndex];
    _scanlineList.RemoveAt(lastIndex);
    return true;
}
```

### 8.6.3 扫描线事件类型

在每个扫描线位置，可能发生以下事件：

1. **插入边**：局部极小值点，开始向上扫描
2. **删除边**：局部最大值点，边结束
3. **交点处理**：两条边相交
4. **水平边处理**：水平边的特殊处理

## 8.7 AddPath/AddPaths 方法

### 8.7.1 AddPath 方法

```csharp
public void AddPath(Path64 path, PathType pathtype, bool isOpen = false)
{
    AddPaths(new Paths64 { path }, pathtype, isOpen);
}
```

### 8.7.2 AddPaths 核心实现

```csharp
public void AddPaths(Paths64 paths, PathType pathtype, bool isOpen = false)
{
    if (isOpen) _hasOpenPaths = true;
    
    // 标记需要重新排序
    _isSortedMinimaList = false;
    
    // 将路径添加到顶点列表
    AddPathsToVertexList(paths, pathtype, isOpen);
}
```

### 8.7.3 便捷方法

```csharp
public void AddSubject(Path64 path)
{
    AddPath(path, PathType.Subject);
}

public void AddSubject(Paths64 paths)
{
    AddPaths(paths, PathType.Subject);
}

public void AddOpenSubject(Path64 path)
{
    AddPath(path, PathType.Subject, true);
}

public void AddClip(Path64 path)
{
    AddPath(path, PathType.Clip);
}

public void AddClip(Paths64 paths)
{
    AddPaths(paths, PathType.Clip);
}
```

## 8.8 清理和重置

### 8.8.1 Clear 方法

```csharp
public void Clear()
{
    // 清空所有数据
    ClearSolution();
    _minimaList.Clear();
    _vertexList.Clear();
    _scanlineList.Clear();
    _currentLocMinIdx = 0;
    _isSortedMinimaList = false;
    _hasOpenPaths = false;
}
```

### 8.8.2 ClearSolution 方法

```csharp
internal void ClearSolution()
{
    // 清空输出结构
    _actives = null;
    _sel = null;
    
    // 回收对象到池中
    foreach (var outrec in _outrecList)
    {
        if (outrec.pts != null)
            DisposeOutPts(outrec.pts);
        _outRecPool.Return(outrec);
    }
    
    _outrecList.Clear();
    _horz_seg_list?.Clear();
    _horz_join_list?.Clear();
}
```

## 8.9 对象池

### 8.9.1 Pool 类

Clipper2 使用对象池来减少GC压力：

```csharp
internal class Pool<T> where T : class, new()
{
    private readonly Stack<T> _pool = new Stack<T>();
    
    public T Get()
    {
        return _pool.Count > 0 ? _pool.Pop() : new T();
    }
    
    public void Return(T item)
    {
        _pool.Push(item);
    }
}
```

### 8.9.2 使用对象池

```csharp
// 获取对象
OutPt op = _outPtPool.Get();
op.pt = pt;
op.next = null;
op.prev = null;

// 归还对象
_outPtPool.Return(op);
```

### 8.9.3 对象池的好处

1. **减少内存分配**：重用已创建的对象
2. **减少GC压力**：避免频繁创建和销毁对象
3. **提高性能**：特别是在处理大量多边形时

## 8.10 PreserveCollinear 属性

### 8.10.1 定义

```csharp
public bool PreserveCollinear { get; set; }
```

### 8.10.2 作用

控制是否保留共线点：

```csharp
// 三个共线点
// A ─── B ─── C

// PreserveCollinear = false（默认）
// 结果：A ─── C（移除B）

// PreserveCollinear = true
// 结果：A ─── B ─── C（保留B）
```

### 8.10.3 实现

```csharp
private void AddVertex(Vertex v, Vertex prev)
{
    if (!PreserveCollinear)
    {
        // 检查是否共线
        if (prev.prev != null && 
            IsCollinear(prev.prev.pt, prev.pt, v.pt))
        {
            // 移除 prev 顶点
            prev.prev.next = v;
            v.prev = prev.prev;
            return;
        }
    }
    
    // 正常添加
    prev.next = v;
    v.prev = prev;
}
```

## 8.11 ReverseSolution 属性

### 8.11.1 定义

```csharp
public bool ReverseSolution { get; set; }
```

### 8.11.2 作用

控制输出多边形的方向：

```csharp
// ReverseSolution = false（默认）
// 外轮廓：逆时针
// 内轮廓（孔洞）：顺时针

// ReverseSolution = true
// 外轮廓：顺时针
// 内轮廓（孔洞）：逆时针
```

## 8.12 状态检查方法

### 8.12.1 IsEmpty

```csharp
internal bool IsEmpty()
{
    return _minimaList.Count == 0;
}
```

### 8.12.2 HasOpenPaths

```csharp
internal bool HasOpenPaths()
{
    return _hasOpenPaths;
}
```

## 8.13 内部辅助方法

### 8.13.1 GetPolyType

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static PathType GetPolyType(Active ae)
{
    return ae.localMin.pathtype;
}
```

### 8.13.2 IsOpen

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static bool IsOpen(Active ae)
{
    return ae.localMin.isOpen;
}
```

### 8.13.3 IsHotEdge

```csharp
[MethodImpl(MethodImplOptions.AggressiveInlining)]
internal static bool IsHotEdge(Active ae)
{
    return ae.outrec != null;
}
```

"热边"是指当前正在构建输出多边形的边。

## 8.14 调试支持

### 8.14.1 ToString 方法

```csharp
#if DEBUG
public override string ToString()
{
    return $"ClipperBase: {_minimaList.Count} minima, " +
           $"{_vertexList.Count} vertex lists, " +
           $"{_outrecList.Count} output records";
}
#endif
```

### 8.14.2 调试可视化

在调试模式下，可以添加方法来可视化内部状态：

```csharp
#if DEBUG
internal void DumpActives()
{
    Active? ae = _actives;
    int count = 0;
    while (ae != null)
    {
        Console.WriteLine($"Active {count++}: bot=({ae.bot.X},{ae.bot.Y}), " +
                          $"top=({ae.top.X},{ae.top.Y})");
        ae = ae.nextInAEL;
    }
}
#endif
```

## 8.15 本章小结

`ClipperBase` 是 Clipper2 的核心基类，包含：

1. **核心数据结构**：
   - `_minimaList`：局部极小值列表
   - `_vertexList`：顶点列表
   - `_scanlineList`：扫描线Y坐标列表
   - `_actives`：活动边表
   - `_outrecList`：输出记录列表

2. **关键方法**：
   - `AddPath/AddPaths`：添加路径
   - `Clear/ClearSolution`：清理状态
   - 各种辅助方法

3. **性能优化**：
   - 对象池减少GC
   - 内联优化
   - 懒排序

理解 `ClipperBase` 的结构是理解 Clipper2 裁剪算法的基础。

---

[上一章：高精度运算](https://znlgis.github.io/sci/Clipper2/第07章-高精度运算/) | [返回目录](https://znlgis.github.io/sci/Clipper2/) | [下一章：Active活动边结构](https://znlgis.github.io/sci/Clipper2/第09章-Active活动边结构/)

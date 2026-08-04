---
layout: default
title: 第19章：PolyTree 多边形树结构
---

# 第19章：PolyTree 多边形树结构

## 19.1 概述

`PolyTree` 是 Clipper2 中用于表示具有层次结构的多边形的数据结构。它能够正确表示外轮廓和孔洞的嵌套关系，这在许多应用场景中非常重要。

## 19.2 为什么需要 PolyTree

### 19.2.1 Paths64 的局限

```csharp
// Paths64 只是路径的列表，没有层次信息
Paths64 paths = new Paths64 {
    outerPolygon,   // 外轮廓
    hole1,          // 孔洞1
    hole2,          // 孔洞2
    island          // 孔洞中的岛屿
};

// 问题：无法知道哪个是哪个的孔洞
```

### 19.2.2 PolyTree 的优势

```
PolyTree 层次结构：

Root (虚拟根节点)
├── OuterPolygon1 (外轮廓)
│   ├── Hole1 (孔洞)
│   │   └── Island1 (孔洞中的岛屿)
│   └── Hole2 (孔洞)
└── OuterPolygon2 (另一个外轮廓)
    └── Hole3 (孔洞)
```

## 19.3 PolyPath64 类

### 19.3.1 类定义

```csharp
public class PolyPath64 : IEnumerable<PolyPath64>
{
    internal PolyPath64? _parent;
    internal readonly List<PolyPath64> _childs = new List<PolyPath64>();
    public Path64? Polygon { get; set; }
    
    public PolyPath64(PolyPath64? parent = null)
    {
        _parent = parent;
    }
    
    public PolyPath64? Parent => _parent;
    public int Count => _childs.Count;
    public bool IsHole => _parent != null && !_parent.IsHole;
    
    public PolyPath64 this[int index] => _childs[index];
    
    public IEnumerator<PolyPath64> GetEnumerator()
    {
        return _childs.GetEnumerator();
    }
}
```

### 19.3.2 成员说明

| 成员 | 类型 | 说明 |
|------|------|------|
| `_parent` | `PolyPath64?` | 父节点 |
| `_childs` | `List<PolyPath64>` | 子节点列表 |
| `Polygon` | `Path64?` | 多边形路径 |
| `IsHole` | `bool` | 是否为孔洞 |

### 19.3.3 IsHole 判断

```csharp
public bool IsHole
{
    get
    {
        // 根节点不是孔洞
        if (_parent == null) return false;
        
        // 如果父节点是孔洞，则自己不是孔洞
        // 如果父节点不是孔洞，则自己是孔洞
        return !_parent.IsHole;
    }
}

// 层次关系：
// Level 0 (Root):     不是孔洞（虚拟根）
// Level 1 (外轮廓):   不是孔洞
// Level 2 (孔洞):     是孔洞
// Level 3 (岛屿):     不是孔洞
// Level 4 (岛中孔):   是孔洞
// ...
```

## 19.4 PolyTree64 类

### 19.4.1 类定义

```csharp
public class PolyTree64 : PolyPath64
{
    public PolyTree64() : base(null)
    {
        // PolyTree64 是特殊的根节点
        // 它没有父节点，也没有 Polygon
    }
    
    public void Clear()
    {
        _childs.Clear();
    }
}
```

### 19.4.2 与 PolyPath64 的关系

```
PolyTree64 (根节点，无 Polygon)
    ↓ 继承
PolyPath64 (普通节点，有 Polygon)
```

## 19.5 PolyPathD 和 PolyTreeD

### 19.5.1 浮点版本

```csharp
public class PolyPathD : IEnumerable<PolyPathD>
{
    internal PolyPathD? _parent;
    internal readonly List<PolyPathD> _childs = new List<PolyPathD>();
    public PathD? Polygon { get; set; }
    public double Scale { get; internal set; }
    
    public bool IsHole => _parent != null && !_parent.IsHole;
    
    // ... 类似 PolyPath64
}

public class PolyTreeD : PolyPathD
{
    public PolyTreeD() : base(null)
    {
        Scale = 1.0;
    }
}
```

### 19.5.2 Scale 属性

```csharp
// 用于 ClipperD 的精度转换
public double Scale { get; internal set; }

// 设置后会传递给所有子节点
internal void SetScale(double scale)
{
    Scale = scale;
    foreach (var child in _childs)
    {
        (child as PolyPathD)?.SetScale(scale);
    }
}
```

## 19.6 添加子节点

### 19.6.1 AddChild 方法

```csharp
public PolyPath64 AddChild(Path64 path)
{
    PolyPath64 child = new PolyPath64(this);
    child.Polygon = path;
    _childs.Add(child);
    return child;
}
```

### 19.6.2 使用示例

```csharp
PolyTree64 tree = new PolyTree64();

// 添加外轮廓
PolyPath64 outer = tree.AddChild(outerPath);

// 添加孔洞到外轮廓
PolyPath64 hole = outer.AddChild(holePath);

// 添加岛屿到孔洞
PolyPath64 island = hole.AddChild(islandPath);
```

## 19.7 遍历 PolyTree

### 19.7.1 IEnumerable 实现

```csharp
// PolyPath64 实现了 IEnumerable<PolyPath64>
foreach (PolyPath64 child in polyTree)
{
    ProcessPath(child.Polygon);
    
    // 递归处理子节点
    foreach (PolyPath64 grandChild in child)
    {
        ProcessPath(grandChild.Polygon);
    }
}
```

### 19.7.2 递归遍历

```csharp
void TraversePolyTree(PolyPath64 node, int level = 0)
{
    // 处理当前节点
    if (node.Polygon != null)
    {
        string indent = new string(' ', level * 2);
        string type = node.IsHole ? "Hole" : "Polygon";
        Console.WriteLine($"{indent}{type}: {node.Polygon.Count} points");
    }
    
    // 递归处理子节点
    foreach (PolyPath64 child in node)
    {
        TraversePolyTree(child, level + 1);
    }
}
```

### 19.7.3 收集所有路径

```csharp
void CollectPaths(PolyPath64 node, Paths64 outerPaths, Paths64 holes)
{
    if (node.Polygon != null)
    {
        if (node.IsHole)
            holes.Add(node.Polygon);
        else
            outerPaths.Add(node.Polygon);
    }
    
    foreach (PolyPath64 child in node)
    {
        CollectPaths(child, outerPaths, holes);
    }
}
```

## 19.8 在 Clipper64 中使用

### 19.8.1 Execute 输出到 PolyTree

```csharp
Clipper64 clipper = new Clipper64();
clipper.AddSubject(subjects);
clipper.AddClip(clips);

PolyTree64 tree = new PolyTree64();
clipper.Execute(ClipType.Intersection, FillRule.NonZero, tree);

// 现在 tree 包含了层次化的结果
```

### 19.8.2 与 Paths64 对比

```csharp
// 方式1：输出到 Paths64（丢失层次信息）
Paths64 solution = new Paths64();
clipper.Execute(ClipType.Union, FillRule.NonZero, solution);

// 方式2：输出到 PolyTree64（保留层次信息）
PolyTree64 tree = new PolyTree64();
clipper.Execute(ClipType.Union, FillRule.NonZero, tree);
```

## 19.9 PolyTree 转 Paths

### 19.9.1 PolyTreeToPaths64

```csharp
public static Paths64 PolyTreeToPaths64(PolyTree64 polytree)
{
    Paths64 result = new Paths64();
    AddPolyPath(polytree, result);
    return result;
}

private static void AddPolyPath(PolyPath64 polypath, Paths64 paths)
{
    if (polypath.Polygon != null)
        paths.Add(polypath.Polygon);
    
    foreach (PolyPath64 child in polypath)
    {
        AddPolyPath(child, paths);
    }
}
```

### 19.9.2 静态方法

```csharp
// Clipper 类中的便捷方法
Paths64 paths = Clipper.PolyTreeToPaths64(tree);
PathsD pathsD = Clipper.PolyTreeToPathsD(treeD);
```

## 19.10 实际应用

### 19.10.1 绘制带孔洞的多边形

```csharp
void DrawPolyTree(PolyTree64 tree, Graphics g)
{
    foreach (PolyPath64 outer in tree)
    {
        // 创建带孔洞的 GraphicsPath
        GraphicsPath gp = new GraphicsPath();
        
        // 添加外轮廓
        gp.AddPolygon(ToPointArray(outer.Polygon));
        
        // 添加孔洞
        foreach (PolyPath64 hole in outer)
        {
            gp.AddPolygon(ToPointArray(hole.Polygon));
            
            // 递归处理孔洞中的岛屿
            DrawIslands(hole, gp);
        }
        
        // 设置填充规则
        gp.FillMode = FillMode.Alternate;
        
        // 绘制
        g.FillPath(brush, gp);
    }
}
```

### 19.10.2 计算嵌套面积

```csharp
double CalculateNetArea(PolyPath64 node)
{
    double area = 0;
    
    if (node.Polygon != null)
    {
        double pathArea = Math.Abs(Clipper.Area(node.Polygon));
        
        if (node.IsHole)
            area -= pathArea;
        else
            area += pathArea;
    }
    
    // 递归处理子节点
    foreach (PolyPath64 child in node)
    {
        area += CalculateNetArea(child);
    }
    
    return area;
}
```

### 19.10.3 SVG 导出

```csharp
string ExportToSvg(PolyTree64 tree)
{
    StringBuilder sb = new StringBuilder();
    sb.AppendLine("<svg xmlns=\"http://www.w3.org/2000/svg\">");
    
    foreach (PolyPath64 outer in tree)
    {
        sb.Append("<path d=\"");
        
        // 外轮廓
        AppendPathData(sb, outer.Polygon, false);
        
        // 孔洞
        foreach (PolyPath64 hole in outer)
        {
            AppendPathData(sb, hole.Polygon, true);
        }
        
        sb.AppendLine("\" fill=\"blue\" fill-rule=\"evenodd\" />");
    }
    
    sb.AppendLine("</svg>");
    return sb.ToString();
}
```

## 19.11 构建 PolyTree

### 19.11.1 内部构建过程

```csharp
// 在 ClipperBase 中
private void BuildTree(PolyTree64 polytree, Paths64 openPaths)
{
    polytree.Clear();
    
    // 处理所有 OutRec
    foreach (OutRec outrec in _outrecList)
    {
        if (outrec.pts == null) continue;
        
        // 构建路径
        Path64 path = BuildPath(outrec.pts, false, false);
        if (path == null || path.Count < 3) continue;
        
        // 确定父节点
        PolyPath64 parent = GetParent(outrec, polytree);
        
        // 添加到树中
        outrec.polypath = parent.AddChild(path);
    }
}

private PolyPath64 GetParent(OutRec outrec, PolyTree64 tree)
{
    OutRec? owner = outrec.owner;
    
    while (owner != null && owner.polypath == null)
        owner = owner.owner;
    
    if (owner == null)
        return tree;
    else
        return owner.polypath!;
}
```

### 19.11.2 Owner 关系

```csharp
// OutRec 的 owner 字段决定了层次关系
// owner 链形成了包含关系

OutRec A (owner = null)     → 属于 PolyTree 根
OutRec B (owner = A)        → B 是 A 的孔洞
OutRec C (owner = B)        → C 是 B 中的岛屿
```

## 19.12 调试与可视化

### 19.12.1 打印树结构

```csharp
void PrintTree(PolyPath64 node, int depth = 0)
{
    string indent = new string(' ', depth * 2);
    
    if (node.Polygon != null)
    {
        double area = Clipper.Area(node.Polygon);
        Console.WriteLine($"{indent}{(node.IsHole ? "Hole" : "Outer")}: " +
                          $"{node.Polygon.Count} pts, area={area:F1}");
    }
    else
    {
        Console.WriteLine($"{indent}Root");
    }
    
    foreach (var child in node)
    {
        PrintTree(child, depth + 1);
    }
}
```

### 19.12.2 验证树结构

```csharp
bool ValidateTree(PolyPath64 node)
{
    foreach (var child in node)
    {
        // 检查父引用
        if (child._parent != node)
        {
            Console.WriteLine("Invalid parent reference!");
            return false;
        }
        
        // 检查孔洞状态交替
        if (child.Polygon != null && node.Polygon != null)
        {
            if (child.IsHole == node.IsHole)
            {
                Console.WriteLine("Invalid hole/polygon alternation!");
                return false;
            }
        }
        
        // 递归检查
        if (!ValidateTree(child))
            return false;
    }
    
    return true;
}
```

## 19.13 本章小结

PolyTree 是 Clipper2 中表示层次化多边形的重要结构：

1. **层次关系**：正确表示外轮廓、孔洞、岛屿的嵌套
2. **PolyPath64**：树的节点，包含路径和子节点
3. **PolyTree64**：根节点，没有路径
4. **IsHole 属性**：自动计算是否为孔洞
5. **遍历方式**：IEnumerable 支持 foreach
6. **应用场景**：绘图、SVG 导出、面积计算

当需要保留多边形的层次结构时，使用 PolyTree 而不是 Paths64。

---

[上一章：Minkowski和与差](https://znlgis.github.io/sci/Clipper2/第18章-Minkowski和与差/) | [返回目录](https://znlgis.github.io/sci/Clipper2/) | [下一章：实际应用与最佳实践](https://znlgis.github.io/sci/Clipper2/第20章-实际应用与最佳实践/)

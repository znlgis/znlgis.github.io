---
layout: default
title: Provider系统与参数化设计
---

# 第十章：Provider系统与参数化设计

## 10.1 Provider系统概述

### 10.1.1 什么是Provider

Provider系统是LightCAD中实现参数化设计的核心机制。它允许通过参数集（ParameterSet）动态生成二维图案（Shape）和三维模型（Solid），实现真正的参数化BIM组件。

```
┌─────────────────────────────────────────┐
│           LcComponentDefinition          │
│            (组件定义)                     │
├─────────────────────────────────────────┤
│    ┌─────────────┐  ┌─────────────┐    │
│    │ShapeProvider│  │SolidProvider│    │
│    │ (二维图案)  │  │ (三维模型)  │    │
│    └──────┬──────┘  └──────┬──────┘    │
│           │                │            │
│           ▼                ▼            │
│    ┌─────────────┐  ┌─────────────┐    │
│    │LcParameterSet│  │LcParameterSet│   │
│    │  (参数集)    │  │  (参数集)    │   │
│    └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────┘
```

### 10.1.2 Provider类型

| Provider类型 | 功能 | 输出 |
|-------------|------|------|
| ShapeProvider | 生成二维图案 | Curve2dGroupCollection |
| SolidProvider | 生成三维模型 | Solid3dCollection |

### 10.1.3 QdLayoutProvider项目结构

```
QdLayoutProvider/
├── GlobalUsing.cs
├── QdLayoutProviderRegist.cs    # Provider注册入口
├── QdBarrierProvider.cs         # 防护栏杆Provider
├── QdBermProvider.cs            # 出土道路Provider
├── QdEarthworkProvider.cs       # 土方回填Provider
├── QdFenceProvider.cs           # 围栏Provider
├── QdFoundationPitProvider.cs   # 基坑Provider
├── QdGroundProvider.cs          # 硬化地面Provider
├── QdHardenProvider.cs          # 路面硬化Provider
├── QdIntersectionProvider.cs    # 交叉口Provider
├── QdLawnProvider.cs            # 草坪Provider
└── QdSiteProvider.cs            # 场地Provider
```

## 10.2 Provider注册

### 10.2.1 IDllProviderImporter接口

```csharp
public interface IDllProviderImporter
{
    /// <summary>
    /// 获取导入的Provider集合
    /// </summary>
    (ShapeProviderCollection shapeProviders, SolidProviderCollection solidProviders) GetImportProviders();
}
```

### 10.2.2 注册实现

```csharp
namespace QdLayoutProvider
{
    public class QdLayoutDllProviderImporter : IDllProviderImporter
    {
        internal static ShapeProviderCollection ShapeProviders = new ShapeProviderCollection();
        internal static SolidProviderCollection SolidProviders = new SolidProviderCollection();
        
        public (ShapeProviderCollection, SolidProviderCollection) GetImportProviders()
        {
            // 注册所有Provider
            QdFenceProvider.RegistProviders();
            QdLawnProvider.RegistProviders();
            QdFoundationPitProvider.RegistProviders();
            QdGroundProvider.RegistProviders();
            QdEarthworkProvider.RegistProviders();
            QdBermProvider.RegistProviders();
            QdHardenProvider.RegistProviders();
            QdSiteProvider.RegistProviders();
            QdIntersectionProvider.RegistProviders();
            
            return (ShapeProviders, SolidProviders);
        }
    }
}
```

## 10.3 ShapeProvider开发

### 10.3.1 ShapeProvider委托

```csharp
/// <summary>
/// Shape创建委托
/// </summary>
/// <param name="pset">参数集</param>
/// <param name="creator">Shape创建器</param>
/// <returns>二维曲线组集合</returns>
public delegate Curve2dGroupCollection CreateShape(LcParameterSet pset, ShapeCreator creator);
```

### 10.3.2 注册ShapeProvider

```csharp
internal static void RegistProviders()
{
    // 方式一：使用元组列表
    ConvertToProviders(new List<(string uuid, string name, CreateShape creator)>
    {
        ("uuid-1", "名称1", ShapeMethod1),
        ("uuid-2", "名称2", ShapeMethod2),
    });
}

private static void ConvertToProviders(List<(string uuid, string name, CreateShape creator)> list)
{
    foreach (var item in list)
    {
        var provider = new ShapeProvider
        {
            Uuid = item.uuid,
            Name = item.name,
            Creator = item.creator
        };
        QdLayoutDllProviderImporter.ShapeProviders.Add(provider);
    }
}
```

### 10.3.3 ShapeProvider实现示例

```csharp
/// <summary>
/// 草坪二维图案Provider
/// </summary>
internal static Curve2dGroupCollection 草坪(LcParameterSet pset, ShapeCreator creator)
{
    // 获取组件实例
    var component = creator.ComIns as DirectComponent;
    var outline = component.BaseCurve as Polyline2d;
    
    if (outline == null || outline.Curve2ds.Count == 0)
        return new Curve2dGroupCollection();
    
    // 创建曲线组
    var curveGroup = new Curve2dGroup();
    
    // 添加轮廓线
    curveGroup.Curve2ds.AddRange(outline.Curve2ds.Clone());
    
    // 添加填充图案（草坪纹理）
    var fillPattern = CreateGrassPattern(outline);
    curveGroup.Curve2ds.AddRange(fillPattern);
    
    return new Curve2dGroupCollection { curveGroup };
}

private static List<Curve2d> CreateGrassPattern(Polyline2d outline)
{
    var patterns = new List<Curve2d>();
    
    // 获取包围盒
    var box = new Box2().ExpandByPoints(
        outline.Curve2ds.SelectMany(c => c.GetPoints()).ToArray()
    );
    
    // 生成草坪纹理线
    var spacing = 500;  // 500mm间距
    for (double x = box.Min.X; x < box.Max.X; x += spacing)
    {
        // 垂直短线模拟草
        for (double y = box.Min.Y; y < box.Max.Y; y += spacing)
        {
            var point = new Vector2(x + Random(-50, 50), y + Random(-50, 50));
            
            // 检查点是否在轮廓内
            if (IsPointInPolygon(point, outline))
            {
                var grassLine = new Line2d(
                    point,
                    point + new Vector2(0, 100 + Random(-30, 30))
                );
                patterns.Add(grassLine);
            }
        }
    }
    
    return patterns;
}
```

## 10.4 SolidProvider开发

### 10.4.1 SolidProvider委托

```csharp
/// <summary>
/// Solid创建委托
/// </summary>
public delegate Solid3dCollection CreateSolid(
    LcComponentDefinition definition, 
    LcParameterSet pset, 
    SolidCreator creator);

/// <summary>
/// 材质获取委托
/// </summary>
public delegate MaterialInfo[] GetMaterials(
    LcComponentDefinition definition, 
    LcParameterSet pset, 
    SolidCreator creator, 
    Solid3d solid);
```

### 10.4.2 注册SolidProvider

```csharp
internal static void RegistProviders()
{
    // 注册Solid Provider
    ConvertToProvider(
        "solid-uuid-1",                    // UUID
        nameof(GetSolid_基坑),              // 名称
        GetSolid_基坑,                      // 创建方法
        GetSolidMats_基坑                   // 材质方法
    );
}

private static void ConvertToProvider(
    string uuid, 
    string name, 
    CreateSolid creator, 
    GetMaterials getMats)
{
    var provider = new SolidProvider
    {
        Uuid = uuid,
        Name = name,
        Creator = creator,
        MaterialGetter = getMats
    };
    QdLayoutDllProviderImporter.SolidProviders.Add(provider);
}
```

### 10.4.3 SolidProvider实现示例

```csharp
/// <summary>
/// 基坑三维模型Provider
/// </summary>
private static Solid3dCollection GetSolid_基坑(
    LcComponentDefinition definition, 
    LcParameterSet pset, 
    SolidCreator creator)
{
    // 获取参数
    var outline = pset.GetValue<Polyline2d>("Outline");
    var bottom = pset.GetValue<double>("Bottom");
    var elevation = pset.GetValue<double>("Elevation");
    var factor = pset.GetValue<double>("Factor");
    var pattern = pset.GetValue<int>("Pattern");
    
    // 计算放坡宽度
    var width = (elevation - bottom) * factor;
    
    // 确保轮廓方向正确
    if (ShapeUtils.isClockWise(outline.Curve2ds.SelectMany(n => n.GetPoints(2)).ToListEx()))
    {
        outline.Reverse();
    }
    
    // 获取顶部和底部轮廓
    var curves = GetShape(outline.Curve2ds.Clone());
    List<Curve3d> topCurves, bottomCurves;
    
    if (pattern == 0)  // 向外放坡
    {
        bottomCurves = curves.Select(n => n.ToCurve3d().Translate(0, 0, bottom)).ToList();
        topCurves = ShapeExtend(curves, width).Select(n => n.ToCurve3d().Translate(0, 0, elevation)).ToList();
    }
    else  // 向内放坡
    {
        topCurves = GetShape(curves).Select(n => n.ToCurve3d().Translate(0, 0, elevation)).ToList();
        bottomCurves = ShapeExtend(curves, -width).Select(n => n.ToCurve3d().Translate(0, 0, bottom)).ToList();
    }
    
    // 创建坑底面
    var pitGeometry = CreatePitBottomGeometry(bottomCurves, bottom);
    var pitSolid = new Solid3d
    {
        Name = "Pit",
        Geometry = pitGeometry
    };
    
    // 创建坡面
    var slopeGeometry = CreateSlopesGeometry(topCurves, bottomCurves);
    var slopeSolid = new Solid3d
    {
        Name = "Slope",
        Geometry = slopeGeometry
    };
    
    return new Solid3dCollection { pitSolid, slopeSolid };
}

/// <summary>
/// 基坑材质获取
/// </summary>
private static MaterialInfo[] GetSolidMats_基坑(
    LcComponentDefinition definition, 
    LcParameterSet pset, 
    SolidCreator creator, 
    Solid3d solid)
{
    // 返回不同部位的材质
    return new MaterialInfo[]
    {
        MaterialManager.GetMaterial(MaterialManager.Metal1Uuid),     // 坑底
        MaterialManager.GetMaterial(MaterialManager.ConcreteUuid)   // 坡面
    };
}
```

## 10.5 参数集（ParameterSet）

### 10.5.1 LcParameterSet基本操作

```csharp
public class LcParameterSet
{
    /// <summary>
    /// 获取参数值
    /// </summary>
    public T GetValue<T>(string name);
    
    /// <summary>
    /// 设置参数值
    /// </summary>
    public void SetValue(string name, object value);
    
    /// <summary>
    /// 检查参数是否存在
    /// </summary>
    public bool ContainsKey(string name);
    
    /// <summary>
    /// 获取所有参数名
    /// </summary>
    public IEnumerable<string> Keys { get; }
}
```

### 10.5.2 参数类型

```csharp
// 基本类型
double doubleValue = pset.GetValue<double>("Width");
int intValue = pset.GetValue<int>("Count");
string stringValue = pset.GetValue<string>("Name");
bool boolValue = pset.GetValue<bool>("Enabled");

// 几何类型
Vector2 point = pset.GetValue<Vector2>("Position");
Polyline2d poly = pset.GetValue<Polyline2d>("Outline");
Box2 box = pset.GetValue<Box2>("Bounds");

// 复杂类型
MaterialInfo material = pset.GetValue<MaterialInfo>("Material");
```

### 10.5.3 参数验证

```csharp
private static void ValidateParameters(LcParameterSet pset)
{
    // 检查必需参数
    if (!pset.ContainsKey("Outline"))
        throw new ArgumentException("缺少必需参数: Outline");
    
    // 检查参数范围
    var bottom = pset.GetValue<double>("Bottom");
    var elevation = pset.GetValue<double>("Elevation");
    
    if (bottom >= elevation)
        throw new ArgumentException("底部标高必须小于顶部标高");
    
    var factor = pset.GetValue<double>("Factor");
    if (factor <= 0 || factor > 2)
        throw new ArgumentException("放坡系数必须在0到2之间");
}
```

## 10.6 几何工具方法

### 10.6.1 曲线偏移

```csharp
/// <summary>
/// 将曲线集合偏移指定距离
/// </summary>
public static List<Curve2d> ShapeExtend(List<Curve2d> curves, double width)
{
    var newCurves = new List<Curve2d>();
    
    for (var i = 0; i < curves.Count; i++)
    {
        var curve = curves[i].Clone();
        
        if (curve is Line2d line)
        {
            // 线段偏移：沿垂直方向移动
            var perpDir = line.Dir.Clone().RotateAround(new Vector2(), -Math.PI / 2);
            line.Translate(perpDir.MultiplyScalar(width));
            newCurves.Add(line);
        }
        else if (curve is Arc2d arc)
        {
            // 圆弧偏移：调整半径
            if (arc.IsClockwise)
                arc.Radius -= width;
            else
                arc.Radius += width;
            
            // 转换为线段近似
            var count = Math.Max(5, (int)Math.Abs((arc.EndAngle - arc.StartAngle) / Math.PI * 16));
            var points = arc.GetPoints(count);
            for (var k = 0; k < count; k++)
            {
                newCurves.Add(new Line2d(points[k].Clone(), points[k + 1].Clone()));
            }
        }
    }
    
    // 处理相邻曲线的交点
    AdjustCurveIntersections(newCurves);
    
    return newCurves;
}
```

### 10.6.2 曲线转换为线段

```csharp
/// <summary>
/// 将混合曲线转换为线段集合
/// </summary>
public static List<Curve2d> GetShape(List<Curve2d> curves)
{
    var newCurves = new List<Curve2d>();
    
    foreach (var curve in curves)
    {
        var cloned = curve.Clone();
        
        if (cloned is Line2d line)
        {
            newCurves.Add(line);
        }
        else if (cloned is Arc2d arc)
        {
            // 根据角度范围确定分段数
            var count = Math.Max(5, (int)Math.Abs((arc.EndAngle - arc.StartAngle) / Math.PI * 16));
            var points = arc.GetPoints(count);
            
            for (var k = 0; k < count; k++)
            {
                newCurves.Add(new Line2d(points[k].Clone(), points[k + 1].Clone()));
            }
        }
    }
    
    return newCurves;
}
```

### 10.6.3 多边形三角化

```csharp
/// <summary>
/// 将多边形三角化
/// </summary>
public static List<Triangle> Triangulate(List<Vector2> points)
{
    var triangles = new List<Triangle>();
    
    // 使用耳切法（Ear Clipping）进行三角化
    var remaining = new List<int>(Enumerable.Range(0, points.Count));
    
    while (remaining.Count > 3)
    {
        bool earFound = false;
        
        for (int i = 0; i < remaining.Count; i++)
        {
            int prev = remaining[(i - 1 + remaining.Count) % remaining.Count];
            int curr = remaining[i];
            int next = remaining[(i + 1) % remaining.Count];
            
            if (IsEar(points, remaining, prev, curr, next))
            {
                triangles.Add(new Triangle(points[prev], points[curr], points[next]));
                remaining.RemoveAt(i);
                earFound = true;
                break;
            }
        }
        
        if (!earFound) break;  // 无法继续三角化
    }
    
    // 添加最后一个三角形
    if (remaining.Count == 3)
    {
        triangles.Add(new Triangle(
            points[remaining[0]], 
            points[remaining[1]], 
            points[remaining[2]]
        ));
    }
    
    return triangles;
}
```

## 10.7 完整Provider示例

### 10.7.1 草坪Provider

```csharp
internal static class QdLawnProvider
{
    internal static void RegistProviders()
    {
        // 注册Shape Provider
        ConvertToProviders(new List<(string uuid, string name, CreateShape creator)>
        {
            ("lawn-shape-uuid", "草坪", CreateLawnShape)
        });
        
        // 注册Solid Provider
        ConvertToProvider(
            "lawn-solid-uuid",
            "草坪三维",
            CreateLawnSolid,
            GetLawnMaterials
        );
    }
    
    /// <summary>
    /// 创建草坪二维图案
    /// </summary>
    private static Curve2dGroupCollection CreateLawnShape(LcParameterSet pset, ShapeCreator creator)
    {
        var component = creator.ComIns as DirectComponent;
        var outline = component.BaseCurve as Polyline2d;
        
        if (outline == null) return new Curve2dGroupCollection();
        
        var group = new Curve2dGroup();
        
        // 添加边界线
        group.Curve2ds.AddRange(outline.Curve2ds.Clone());
        
        // 添加草坪填充图案
        AddGrassFillPattern(group, outline);
        
        return new Curve2dGroupCollection { group };
    }
    
    /// <summary>
    /// 创建草坪三维模型
    /// </summary>
    private static Solid3dCollection CreateLawnSolid(
        LcComponentDefinition definition, 
        LcParameterSet pset, 
        SolidCreator creator)
    {
        var component = creator.ComIns as DirectComponent;
        var outline = component.BaseCurve as Polyline2d;
        var bottom = pset.GetValue<double>("Bottom");
        
        if (outline == null) return new Solid3dCollection();
        
        // 获取轮廓点
        var points2d = outline.Curve2ds.SelectMany(c => c.GetPoints()).ToList();
        
        // 三角化
        var triangles = Triangulate(points2d);
        
        // 创建几何数据
        var vertices = new List<double>();
        var indices = new List<int>();
        int idxOffset = 0;
        
        foreach (var tri in triangles)
        {
            // 顶面
            vertices.Add(tri.A.X); vertices.Add(bottom + 50); vertices.Add(tri.A.Y);
            vertices.Add(tri.B.X); vertices.Add(bottom + 50); vertices.Add(tri.B.Y);
            vertices.Add(tri.C.X); vertices.Add(bottom + 50); vertices.Add(tri.C.Y);
            
            indices.Add(idxOffset); indices.Add(idxOffset + 1); indices.Add(idxOffset + 2);
            idxOffset += 3;
        }
        
        var geometry = new GeometryData
        {
            Verteics = vertices.ToArray(),
            Indics = indices.ToArray(),
            Groups = new GeometryGroup[]
            {
                new GeometryGroup { Name = "Surface", Start = 0, Count = indices.Count, MaterialIndex = 0 }
            }
        };
        
        var solid = new Solid3d
        {
            Name = "Lawn",
            Geometry = geometry
        };
        
        return new Solid3dCollection { solid };
    }
    
    /// <summary>
    /// 获取草坪材质
    /// </summary>
    private static MaterialInfo[] GetLawnMaterials(
        LcComponentDefinition definition, 
        LcParameterSet pset, 
        SolidCreator creator, 
        Solid3d solid)
    {
        return new MaterialInfo[]
        {
            MaterialManager.GetMaterial(MaterialManager.LawnUuid)
        };
    }
    
    private static void AddGrassFillPattern(Curve2dGroup group, Polyline2d outline)
    {
        // 草坪填充图案实现...
    }
}
```

## 10.8 Provider调试

### 10.8.1 日志输出

```csharp
private static Solid3dCollection CreateSolid_Debug(
    LcComponentDefinition definition, 
    LcParameterSet pset, 
    SolidCreator creator)
{
    try
    {
        Console.WriteLine("=== CreateSolid Started ===");
        
        // 输出参数
        foreach (var key in pset.Keys)
        {
            Console.WriteLine($"Parameter: {key} = {pset.GetValue<object>(key)}");
        }
        
        // 创建模型
        var result = DoCreateSolid(definition, pset, creator);
        
        Console.WriteLine($"Created {result.Count} solids");
        return result;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error in CreateSolid: {ex.Message}");
        Console.WriteLine(ex.StackTrace);
        throw;
    }
}
```

### 10.8.2 几何验证

```csharp
private static void ValidateGeometry(GeometryData geometry)
{
    // 检查顶点数量
    if (geometry.Verteics == null || geometry.Verteics.Length == 0)
        throw new Exception("几何数据没有顶点");
    
    if (geometry.Verteics.Length % 3 != 0)
        throw new Exception("顶点数组长度必须是3的倍数");
    
    // 检查索引
    if (geometry.Indics == null || geometry.Indics.Length == 0)
        throw new Exception("几何数据没有索引");
    
    if (geometry.Indics.Length % 3 != 0)
        throw new Exception("索引数组长度必须是3的倍数（三角形）");
    
    // 检查索引范围
    int maxIndex = geometry.Verteics.Length / 3 - 1;
    foreach (var idx in geometry.Indics)
    {
        if (idx < 0 || idx > maxIndex)
            throw new Exception($"索引 {idx} 超出范围 [0, {maxIndex}]");
    }
    
    Console.WriteLine($"Geometry validation passed: {geometry.Verteics.Length / 3} vertices, {geometry.Indics.Length / 3} triangles");
}
```

## 10.9 本章小结

本章详细介绍了FY_Layout的Provider系统与参数化设计：

1. **Provider概述**：ShapeProvider和SolidProvider的作用
2. **Provider注册**：IDllProviderImporter接口实现
3. **ShapeProvider开发**：二维图案的参数化生成
4. **SolidProvider开发**：三维模型的参数化生成
5. **参数集操作**：LcParameterSet的使用方法
6. **几何工具**：曲线偏移、转换、三角化等
7. **完整示例**：草坪Provider的完整实现
8. **调试技巧**：日志输出和几何验证

Provider系统是实现参数化BIM组件的关键技术，掌握它可以创建真正可配置、可复用的设计构件。下一章我们将学习UI界面开发与命令系统。

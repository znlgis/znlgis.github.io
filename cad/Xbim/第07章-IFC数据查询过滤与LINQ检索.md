---
layout: default
title: 第07章：IFC数据查询过滤与LINQ检索
---

# 第07章：IFC 数据查询、过滤与 LINQ 检索

Xbim 给 .NET 开发者最舒适的体验之一，就是把 IFC 模型当成一棵"对象图 + LINQ"使用。本章系统讲解查询模式、性能要点与典型场景。

## 1. 三个核心入口

```csharp
model.Instances                                  // IEntityCollection
model.Instances.OfType<TIfcType>()               // 按类型查询
model.Instances[entityLabel]                     // 按 #id 查询
```

它们组合起来就是 IFC 数据访问的全部基础。

## 2. 用 OfType<T> 取出某类对象

```csharp
var walls = model.Instances.OfType<IIfcWall>();
var doors = model.Instances.OfType<IIfcDoor>();
var spaces = model.Instances.OfType<IIfcSpace>();
```

### 2.1 注意继承关系

`OfType<IIfcBuildingElement>()` 会**包括所有派生类**：墙、板、柱、梁、门、窗、屋顶、楼梯……。这一行为与 `IEnumerable<T>.OfType<T>()` 一致。

如果只想要"恰好是 `IfcWall`，不包含 `IfcWallStandardCase`"——可以加显式过滤：

```csharp
var pureWalls = model.Instances.OfType<IIfcWall>(false)   // false = 仅本类型
                       .Where(w => w.GetType() == typeof(Xbim.Ifc4.SharedBldgElements.IfcWall));
```

### 2.2 字符串重载

```csharp
var entities = model.Instances.OfType("IfcWall");
```

适合需要在运行时动态决定类型的场景（例如配置文件驱动的导出器）。

## 3. 用 LINQ 表达复杂检索

Xbim 的实体集合对 `IEnumerable<IPersistEntity>` 友好，所有 LINQ 操作（Where、Select、GroupBy、Join、OrderBy）都可用。

### 3.1 过滤外墙

```csharp
var externalWalls = model.Instances.OfType<IIfcWall>()
    .Where(w => w.IsExternal() == true);
```

`IsExternal()` 是 `Xbim.Ifc.Extensions` 提供的扩展方法，会去 `Pset_WallCommon.IsExternal` 中读 `bool`。

### 3.2 取所有楼层 + 楼层下的所有产品

```csharp
foreach (var storey in model.Instances.OfType<IIfcBuildingStorey>())
{
    var elements = storey.ContainsElements
        .SelectMany(rel => rel.RelatedElements)
        .ToList();

    Console.WriteLine($"{storey.Name}: {elements.Count} 个构件");
}
```

`ContainsElements` 是反向引用：返回所有把 `storey` 作为 `RelatingStructure` 的 `IfcRelContainedInSpatialStructure` 集合。

### 3.3 按类型分组统计

```csharp
var stat = model.Instances.OfType<IIfcProduct>()
    .GroupBy(p => p.ExpressType.Name)
    .OrderByDescending(g => g.Count());

foreach (var g in stat)
    Console.WriteLine($"{g.Key,-30} {g.Count(),8}");
```

### 3.4 关联查询：墙 + 门

```csharp
// 找出某面墙上挂的所有门（通过 IfcRelVoidsElement + IfcRelFillsElement）
var wall = model.Instances.OfType<IIfcWall>().First();
var doorsInWall = wall.HasOpenings
    .SelectMany(rv => rv.RelatedOpeningElement.HasFillings)
    .Select(rf => rf.RelatedBuildingElement)
    .OfType<IIfcDoor>()
    .ToList();
```

这段路径展示了 IFC "关系实体" 的连接方式：墙 → IfcRelVoidsElement → IfcOpeningElement → IfcRelFillsElement → IfcDoor。

## 4. 反向引用（INVERSE）的速度问题

EXPRESS 的 INVERSE 在 Xbim 中是**遍历模型实例反查**实现的：

```csharp
public IEnumerable<IfcRelContainedInSpatialStructure> ContainsElements
    => Model.Instances
        .Where<IfcRelContainedInSpatialStructure>(r => r.RelatingStructure == this);
```

对一份 100 万实体的模型反复访问反向属性会非常慢。Xbim 提供解决：

```csharp
using (model.BeginInverseCaching())
{
    foreach (var p in model.Instances.OfType<IIfcProduct>())
    {
        var defByProps = p.IsDefinedBy.OfType<IIfcRelDefinesByProperties>();
        // ...
    }
}
```

`BeginInverseCaching()` 一次扫描全部关系实体并按 `RelatingXxx` / `RelatedXxx` 建立索引，循环结束后释放。**任何会在循环里多次读 INVERSE 的代码都应该套上它**。

## 5. 表达式树到 Esent 索引（v6+）

Xbim v6 在 EsentModel 上增加了基于 ExpressType 索引的"快速 OfType"：

- 当查询是纯 `OfType<T>()` 时，Esent 后端会直接用类型索引，O(1) 拿到匹配 Label 列表，不用扫描全表。
- 复合 LINQ 仍然是 LINQ-to-Objects。

因此尽量把 `OfType<T>()` 放在最前面，再 `Where`：

```csharp
// 推荐
var t = model.Instances.OfType<IIfcDoor>().Where(d => d.OverallHeight > 2000);
// 不推荐：先扫整个模型
var t = model.Instances.Where(e => e is IIfcDoor d && d.OverallHeight > 2000);
```

## 6. 通过 EntityLabel 直查

每条 STEP21 行 `#42 = ...` 中的 42 在 Xbim 内部就是 `EntityLabel`。可以直接：

```csharp
var entity = model.Instances[42];
```

适合外部参考（如校验报告里报"#1234 不合规"，直接拿来定位）。

## 7. 表达式构建：Linq 结合 ExpressMetaData

下面是一段把"任何实体的某个属性等于某值"封装成通用查询的代码，体现 Xbim 元模型的反射威力：

```csharp
public static IEnumerable<IPersistEntity> Where(IModel model, string ifcType, string propName, object value)
{
    var et = model.Metadata.ExpressType(ifcType.ToUpper());
    if (et == null) yield break;

    var prop = et.Properties.Values.FirstOrDefault(p =>
        string.Equals(p.Name, propName, StringComparison.OrdinalIgnoreCase));
    if (prop == null) yield break;

    foreach (var e in model.Instances.OfType(ifcType))
    {
        var v = prop.PropertyInfo.GetValue(e);
        if (Equals(v, value)) yield return e;
    }
}
```

这是写 IFC 通用导出器、规则引擎、IDS 校验器的基础模式。

## 8. 常见查询食谱

### 8.1 项目根

```csharp
var project = model.Instances.OfType<IIfcProject>().Single();
```

每份 IFC 文件**有且仅有一个** `IfcProject`，可以放心用 `Single()`。

### 8.2 楼层树

```csharp
foreach (var site in project.Sites())
foreach (var bldg in site.Buildings())
foreach (var storey in bldg.BuildingStoreys())
{
    Console.WriteLine($"{site.Name} / {bldg.Name} / {storey.Name} (Elev={storey.Elevation})");
}
```

`Sites()`、`Buildings()`、`BuildingStoreys()` 是 `Xbim.Ifc.Extensions` 中按 `IfcRelAggregates` 解析的扩展方法。

### 8.3 所有空间及其所属楼层

```csharp
foreach (var sp in model.Instances.OfType<IIfcSpace>())
{
    var storey = sp.Decomposes
        .Select(d => d.RelatingObject)
        .OfType<IIfcBuildingStorey>()
        .FirstOrDefault();
    Console.WriteLine($"{storey?.Name} - {sp.Name}");
}
```

### 8.4 所有外墙的总长度（按 BaseQuantity）

```csharp
double totalLen = 0;
foreach (var wall in model.Instances.OfType<IIfcWall>())
{
    if (wall.IsExternal() != true) continue;
    var len = wall.GetQuantitySetValue<double>("Qto_WallBaseQuantities", "Length");
    totalLen += len;
}
Console.WriteLine($"外墙总长 = {totalLen / 1000:F2} m");   // mm 转 m
```

### 8.5 计算每个空间内的家具数量

```csharp
var furnByRoom = (from rel in model.Instances.OfType<IIfcRelContainedInSpatialStructure>()
                  where rel.RelatingStructure is IIfcSpace
                  from f in rel.RelatedElements.OfType<IIfcFurnishingElement>()
                  group f by (IIfcSpace)rel.RelatingStructure into g
                  select new { Space = g.Key, Count = g.Count() });

foreach (var x in furnByRoom)
    Console.WriteLine($"{x.Space.Name} : {x.Count}");
```

## 9. 投影到自定义 DTO

很多业务最终需要把 IFC 转成业务 DTO：

```csharp
public record WallDto(string Id, string Name, double Length, bool External);

var dtos = model.Instances.OfType<IIfcWall>()
    .Select(w => new WallDto(
        w.GlobalId,
        w.Name?.ToString() ?? "",
        w.GetQuantitySetValue<double>("Qto_WallBaseQuantities", "Length"),
        w.IsExternal() == true))
    .ToList();
```

之后再写到数据库或 JSON。

## 10. 按 GlobalId 查询

```csharp
var byGuid = model.Instances.OfType<IIfcRoot>()
    .FirstOrDefault(r => r.GlobalId == "1xS3BCk291UvhgP2dvNsgp");
```

GUID 比 EntityLabel 更稳定（保存/加载之后 EntityLabel 可能改变，但 GUID 不变），是模型对比、增量更新的首选键。

## 11. 性能最佳实践清单

- 大模型务必 `BeginInverseCaching()` / `BeginEntityCaching()`；
- 尽早用 `OfType<T>()` 限定类型；
- 不要用 `model.Instances.Count()` 频繁触发全扫描，缓存到变量；
- 避免在循环中重复创建 `Where` 谓词；
- 对**关系实体的字段**建立局部字典：

```csharp
var spaceByElement = model.Instances.OfType<IIfcRelContainedInSpatialStructure>()
    .Where(r => r.RelatingStructure is IIfcSpace)
    .SelectMany(r => r.RelatedElements.Select(e => (e, r.RelatingStructure)))
    .ToDictionary(t => t.e.GlobalId, t => (IIfcSpace)t.RelatingStructure);
```

## 12. 小结

`Xbim.Ifc4.Interfaces.IIfc*` + LINQ + INVERSE 缓存 + 扩展方法，构成了 Xbim 查询能力的"黄金四件套"。掌握它们后，绝大多数"提取信息 / 出报表 / 写检查器"的需求都能在几十行代码内完成。

下一章我们从"读"切到"写"：如何用 Xbim 创建合法、合规、可被其他软件读懂的 IFC 实体。

---
layout: default
title: 第10章：空间结构构件与IfcRelationship关系网络
---

# 第10章：空间结构、构件与 IfcRelationship 关系网络

IFC 的特色不在于"有 IfcWall"，而在于**用关系实体显式表达构件之间几乎所有的关联**。本章把这张关系网逐条拆开，并给出在 Xbim 中对应的访问/构造方式。

## 1. 关系实体的总览

IFC 标准把关系归为三大类（按 IFC4 命名）：

```
IfcRelationship
├── IfcRelDecomposes              组成 / 分解
│   ├── IfcRelAggregates          聚合（项目→场地→楼层…）
│   ├── IfcRelNests               嵌套（带顺序的子集合）
│   └── IfcRelProjectsElement     建筑要素的"投射"（凸出）
├── IfcRelConnects                连接（拓扑或语义连接）
│   ├── IfcRelContainedInSpatialStructure   构件被空间容器包含
│   ├── IfcRelConnectsElements              元素直接连接
│   ├── IfcRelConnectsPathElements          线性元素端到端连接
│   ├── IfcRelConnectsWithRealizingElements 通过中间元素连接（焊缝、插销）
│   ├── IfcRelInterferesElements             干涉关系
│   ├── IfcRelVoidsElement                  开洞
│   ├── IfcRelFillsElement                  填充开洞
│   ├── IfcRelCoversBldgElements / IfcRelCoversSpaces 覆盖装饰
│   ├── IfcRelSpaceBoundary                 空间边界
│   └── IfcRelReferencedInSpatialStructure  跨空间引用
└── IfcRelAssociates / IfcRelDefines / IfcRelAssigns  语义关联（属性/类型/角色等）
```

按用途分类，可以归结为：

| 用途 | 主要关系 |
| --- | --- |
| 组装层级 | `IfcRelAggregates`、`IfcRelNests` |
| 空间层级 | `IfcRelContainedInSpatialStructure`、`IfcRelReferencedInSpatialStructure` |
| 类型/属性 | `IfcRelDefinesByType`、`IfcRelDefinesByProperties` |
| 材料/分类 | `IfcRelAssociatesMaterial`、`IfcRelAssociatesClassification` |
| 几何拓扑 | `IfcRelVoidsElement`、`IfcRelFillsElement`、`IfcRelCoversBldgElements`、`IfcRelSpaceBoundary` |
| 任务/资源 | `IfcRelAssignsToProcess`、`IfcRelAssignsToActor`、`IfcRelAssignsToGroup` |

## 2. 空间结构：IfcRelAggregates 链

```
IfcProject
  └─ IfcRelAggregates ─→ IfcSite (1..n)
      └─ IfcRelAggregates ─→ IfcBuilding (1..n)
          └─ IfcRelAggregates ─→ IfcBuildingStorey (1..n)
              └─ IfcRelAggregates ─→ IfcSpace (0..n)
```

任何 `IfcSpatialStructureElement` 都能再往下嵌套（楼层下分区、空间下分子空间、公园下分小品）。

### 2.1 在 Xbim 中遍历

```csharp
var project = model.Instances.OfType<IIfcProject>().Single();
foreach (var dec in project.IsDecomposedBy.SelectMany(r => r.RelatedObjects).OfType<IIfcSite>())
{
    PrintTree(dec, 0);
}

void PrintTree(IIfcObjectDefinition o, int depth)
{
    Console.WriteLine($"{new string(' ', depth*2)}{o.ExpressType.Name}: {o.Name}");
    foreach (var child in o.IsDecomposedBy.SelectMany(r => r.RelatedObjects))
        PrintTree(child, depth + 1);
}
```

`Xbim.Ifc.Extensions` 中有 `Sites()`、`Buildings()`、`BuildingStoreys()` 等扩展方法可直接拿到对应层级。

### 2.2 构件挂到空间

```csharp
storey.AddElement(wall);   // 创建 IfcRelContainedInSpatialStructure
```

跨楼层引用（一根贯通柱穿过 3 层）则用 `IfcRelReferencedInSpatialStructure`：

```csharp
foreach (var s in storeys)
    s.ReferencesElements.Add(model.Instances.New<IfcRelReferencedInSpatialStructure>(r =>
    {
        r.RelatingStructure = s;
        r.RelatedElements.Add(column);
    }));
```

## 3. 类型化：IfcRelDefinesByType

把"具体实例"和"类型/族"绑定。一个类型可被多个实例引用：

```csharp
using var txn = model.BeginTransaction("Type");
var wallType = model.Instances.New<IfcWallType>(t =>
{
    t.Name = "WT-200";
    t.PredefinedType = IfcWallTypeEnum.STANDARD;
});

// 让多面墙共用一个类型
foreach (var w in walls)
    w.AddDefiningType(wallType);   // 创建 / 复用 IfcRelDefinesByType
```

`AddDefiningType` 是 Xbim 扩展方法。底层会复用同一个 `IfcRelDefinesByType`（其 `RelatedObjects` 是集合）。

## 4. 开洞与门窗

### 4.1 数据流

1. 墙先有几何（实体扫掠）；
2. 创建 `IfcOpeningElement`（开口几何）；
3. 用 `IfcRelVoidsElement` 把开口"挖掉"墙；
4. 创建 `IfcDoor` / `IfcWindow`；
5. 用 `IfcRelFillsElement` 把门窗填进开口。

```csharp
var opening = model.Instances.New<IfcOpeningElement>(/* 几何与位置 */);
model.Instances.New<IfcRelVoidsElement>(r =>
{
    r.RelatingBuildingElement = wall;
    r.RelatedOpeningElement   = opening;
});

var door = model.Instances.New<IfcDoor>(d => d.Name = "D-1");
model.Instances.New<IfcRelFillsElement>(r =>
{
    r.RelatingOpeningElement = opening;
    r.RelatedBuildingElement = door;
});
```

### 4.2 读取

```csharp
foreach (var w in model.Instances.OfType<IIfcWall>())
foreach (var voidRel in w.HasOpenings)
{
    var op = voidRel.RelatedOpeningElement;
    foreach (var fillRel in op.HasFillings)
        Console.WriteLine($"Wall {w.Name} 上有 {fillRel.RelatedBuildingElement.ExpressType.Name} '{fillRel.RelatedBuildingElement.Name}'");
}
```

## 5. 空间边界

IfcSpaceBoundary 描述"墙、板等围合空间的关系"，是能耗/CFD 分析的关键。

```csharp
foreach (var sb in space.BoundedBy)   // INVERSE
{
    Console.WriteLine($"Space {space.Name} 边界 {sb.RelatedBuildingElement.Name} ({sb.PhysicalOrVirtualBoundary}, {sb.InternalOrExternalBoundary})");
}
```

`PhysicalOrVirtualBoundary` 区分实墙边界与"虚拟边界"（房间隔断的概念分隔）。`InternalOrExternalBoundary` 区分内/外边界。

## 6. 群组（Group）

IfcGroup 用来表达"系统"、"装配"等无空间意义的集合：

```csharp
var fanGroup = model.Instances.New<IfcGroup>(g => g.Name = "排风系统");
model.Instances.New<IfcRelAssignsToGroup>(r =>
{
    r.RelatingGroup = fanGroup;
    r.RelatedObjects.AddRange(allFans);
});
```

子类 `IfcSystem`、`IfcDistributionSystem`、`IfcZone` 等表达不同语义。

## 7. 任务、过程与资源

施工进度（4D）通过 `IfcTask` + `IfcRelAssignsToProcess` + `IfcRelSequence` 实现。预算/资源（5D）用 `IfcCostItem`、`IfcResource`、`IfcRelAssignsToControl` 等。

简单示例：

```csharp
var task = model.Instances.New<IfcTask>(t =>
{
    t.Name = "拆除外墙";
    t.PredefinedType = IfcTaskTypeEnum.DEMOLITION;
});
model.Instances.New<IfcRelAssignsToProcess>(r =>
{
    r.RelatingProcess = task;
    r.RelatedObjects.AddRange(externalWalls);
});
```

## 8. 嵌套（IfcRelNests）

与 `IfcRelAggregates` 的区别：嵌套是**有顺序**的（例如管道系统中阀门、弯头按线路顺序排列）；而聚合是无序的"整体–部分"。

## 9. 局部坐标系统（IfcLocalPlacement）

虽然不属于"关系实体"，但本质上构件的"父子坐标系链"也是一种关系，由 `PlacementRelTo` 串联：

```
IfcLocalPlacement( wall )
  PlacementRelTo → IfcLocalPlacement( storey )
    PlacementRelTo → IfcLocalPlacement( building )
      PlacementRelTo → IfcLocalPlacement( site )
        PlacementRelTo → null  (世界坐标系)
```

最终的全球变换矩阵是这条链的相乘。Xbim 提供 `IfcProduct.ToWorldCoordinateSystem()` 一步算好。

## 10. 工业惯例：什么挂在哪一级

以下惯例是大多数 BIM 软件遵守的，写代码时尽量照做以保证模型可被 Revit、ArchiCAD、Tekla 等正确读懂：

| 内容 | 一般挂位置 |
| --- | --- |
| 项目级单位、坐标系、地址 | `IfcProject` |
| 项目北、楼层标高、高程 | `IfcSite` / `IfcBuildingStorey` |
| 楼栋名、地址 | `IfcBuilding` |
| 房间编号、面积 | `IfcSpace` |
| 普通构件 | `IfcBuildingStorey.AddElement(...)` |
| 跨层柱、立管 | `IfcBuildingStorey.ReferencesElements` |
| 类型属性（防火、热工） | 挂在 `IfcXxxType` 上 |
| 实例属性（位置编号、备注） | 挂在 `IfcXxx` 上 |
| 几何 `Body` / `Axis` / `FootPrint` | `IfcShapeRepresentation.RepresentationIdentifier` |

## 11. 校验完整性的小工具

写完模型后跑一遍下面的"基本完整性检查"是个好习惯：

```csharp
foreach (var p in model.Instances.OfType<IIfcProduct>())
{
    if (p is IIfcSpatialStructureElement) continue;

    var contained = p.ContainedInStructure.Any();
    var referenced = p.ReferencedInStructures.Any();
    if (!contained && !referenced)
        Console.WriteLine($"[警告] {p.ExpressType.Name} #{p.EntityLabel} 未挂到任何空间");

    if (string.IsNullOrEmpty(p.GlobalId))
        Console.WriteLine($"[错误] {p.ExpressType.Name} #{p.EntityLabel} 缺 GlobalId");

    if (p.ObjectPlacement == null)
        Console.WriteLine($"[警告] {p.ExpressType.Name} {p.Name} 缺 ObjectPlacement");
}
```

## 12. 小结

- IFC 用关系实体显式表达构件之间所有关联：聚合、空间包含、类型、属性、材料、分类、开洞、群组、任务、空间边界…
- 每条关系都是 `IfcRoot` 子类，本身有 GUID/属性，可被进一步描述；
- Xbim 通过反向引用、扩展方法、类型化集合，让你能用面向对象方式自然遍历这些关系；
- 写出"合规、能被各家软件读懂"的 IFC，关键在于**正确建立关系**，而不是堆砌实体。

下一章开始我们进入 Xbim 的另一半重头戏 —— 几何引擎 `XbimGeometry`。

---
layout: default
title: 第08章：IFC模型创建编辑与事务管理
---

# 第08章：IFC 模型创建、编辑与事务管理

读过 Xbim 之后，下一步是**写**。本章系统讲怎样从零创建 IFC 模型、修改既有模型，以及事务、撤销、编辑作用域。

## 1. 一切写操作都要在事务里

Xbim 强制要求修改 IFC 模型必须先 `BeginTransaction`：

```csharp
using var txn = model.BeginTransaction("Add wall");
// ... 修改 ...
txn.Commit();   // 不调用 Commit 默认回滚
```

事务承担三个责任：

1. **状态机保护**：未在事务中修改属性会抛 `XbimReadOnlyException`；
2. **撤销支持**：每次属性变更被记录为 `(doAction, undoAction)`；
3. **持久化批处理**：Esent 后端把修改先写入日志，Commit 后再 flush 到磁盘。

> 嵌套事务：Xbim 不支持真正嵌套，但可以串联多个独立事务来组织逻辑。

## 2. New<T> 创建实体

只有 `IInstantiableEntity` 子类（即非抽象的 IFC 实体）能被实例化：

```csharp
var wall = model.Instances.New<Xbim.Ifc4.SharedBldgElements.IfcWall>(w =>
{
    w.GlobalId = IfcGloballyUniqueId.ConvertToBase64(Guid.NewGuid());
    w.Name = "Wall-001";
    w.OwnerHistory = model.OwnerHistoryAddObject;
});
```

- `GlobalId` 默认会自动生成，所以一般可省略；
- `OwnerHistory` 也会从 `XbimEditorCredentials` 自动注入（若你用扩展方法 `Initialize`/`AddObject`）；
- 初始化 lambda 可以集中设置常用属性。

## 3. 项目骨架：IfcProject.Initialize

写一份完整 IFC 至少需要：项目（IfcProject）、单位（IfcUnitAssignment）、几何上下文（IfcGeometricRepresentationContext）、所有者历史（IfcOwnerHistory）、空间结构（Site → Building → Storey）。手工建非常繁琐，Xbim 提供 `Initialize`：

```csharp
using var txn = model.BeginTransaction("Init");
var project = model.Instances.New<Xbim.Ifc4.Kernel.IfcProject>(p =>
{
    p.Initialize(ProjectUnits.SIUnitsUK);   // mm + degree
    p.Name = "Demo Project";
});

var site = model.Instances.New<Xbim.Ifc4.ProductExtension.IfcSite>(s => s.Name = "Default Site");
project.AddSite(site);

var building = model.Instances.New<Xbim.Ifc4.ProductExtension.IfcBuilding>(b =>
{
    b.Name = "Building 1";
    b.CompositionType = IfcElementCompositionEnum.ELEMENT;
});
site.AddBuilding(building);

var storey = model.Instances.New<Xbim.Ifc4.ProductExtension.IfcBuildingStorey>(s =>
{
    s.Name = "1F";
    s.Elevation = 0;
});
building.AddToSpatialDecomposition(storey);

txn.Commit();
```

`AddSite`、`AddBuilding`、`AddToSpatialDecomposition` 等扩展方法位于 `Xbim.Ifc.Extensions`，会自动建立 `IfcRelAggregates` 关系实体。

## 4. 把构件挂到空间结构

```csharp
using var txn = model.BeginTransaction("Add wall to storey");
var wall = model.Instances.New<IfcWall>(w => w.Name = "MyWall");
storey.AddElement(wall);   // 创建 IfcRelContainedInSpatialStructure
txn.Commit();
```

注意：**没有挂到空间结构的构件在多数 BIM 软件里看不到**，因为它们不在浏览树里。

## 5. 给构件加几何

完整的几何创建会在第 12 章细讲。这里给一个最简单"立一面墙"的样例：

```csharp
// 1. 建轮廓 1000 x 200 矩形
var profile = model.Instances.New<IfcRectangleProfileDef>(p =>
{
    p.ProfileType = IfcProfileTypeEnum.AREA;
    p.XDim = 1000;
    p.YDim = 200;
    p.Position = model.Instances.New<IfcAxis2Placement2D>(ax => ax.Location = model.Instances.New<IfcCartesianPoint>(pt => pt.SetXY(0, 0)));
});

// 2. 拉伸 3000mm
var solid = model.Instances.New<IfcExtrudedAreaSolid>(s =>
{
    s.SweptArea = profile;
    s.Position  = model.Instances.New<IfcAxis2Placement3D>();
    s.ExtrudedDirection = model.Instances.New<IfcDirection>(d => d.SetXYZ(0, 0, 1));
    s.Depth = 3000;
});

// 3. ShapeRepresentation
var modelContext = project.ModelContext();
var rep = model.Instances.New<IfcShapeRepresentation>(r =>
{
    r.ContextOfItems = modelContext;
    r.RepresentationType = "SweptSolid";
    r.RepresentationIdentifier = "Body";
    r.Items.Add(solid);
});

var shape = model.Instances.New<IfcProductDefinitionShape>(s => s.Representations.Add(rep));
wall.Representation = shape;

// 4. 局部坐标系
wall.ObjectPlacement = model.Instances.New<IfcLocalPlacement>(lp =>
{
    lp.RelativePlacement = model.Instances.New<IfcAxis2Placement3D>();
});
```

## 6. 修改既有实体

直接对属性赋值即可：

```csharp
using var txn = model.BeginTransaction("Rename");
foreach (var w in model.Instances.OfType<IIfcWall>())
    w.Name = "Wall-" + w.EntityLabel;
txn.Commit();
```

`set` 访问器内部会：

1. 检查模型是否在事务中；
2. 把变更记入 `ITransaction.AddReversibleAction`；
3. 触发 `PropertyChanging` / `PropertyChanged` 事件；
4. 标记 `ActivationStatus = ActivatedReadWrite`。

## 7. 删除实体

```csharp
using var txn = model.BeginTransaction("Delete entity");
model.Delete(wall);
txn.Commit();
```

注意：

- 删除会**清除所有引用**（这是 Esent/Memory 后端中实现的"墓碑+扫描"机制）；
- 但**不会自动删除关系实体**（例如 `IfcRelContainedInSpatialStructure`）。要把关系实体也清掉，最好先 `wall.HasOpenings.ToList().ForEach(model.Delete)` 处理依赖；
- 也可以使用 `XbimEntityDeletionHelper`（社区扩展）做级联删除。

## 8. 复制实体

`Xbim.Common.IModel.InsertCopy<T>` 是把实体（含其依赖图）从一个模型复制到另一个的强大工具：

```csharp
var copied = targetModel.InsertCopy(sourceWall, mappings, propTransform: null,
    includeInverses: false, keepLabels: false);
```

参数：

- `mappings`：跨调用的复用字典，避免同一实体被复制多次；
- `propTransform`：每个属性一个回调，用于改写引用、过滤、重命名；
- `includeInverses`：是否带反向引用上的关系实体一起复制；
- `keepLabels`：是否保留原 EntityLabel。

InsertCopy 是写"模型合并"、"模型差分"工具的核心 API。

## 9. 撤销 / 回滚

事务提供两种结束方式：

```csharp
txn.Commit();    // 持久化
txn.RollBack();  // 撤销
```

如果在 `using` 块中**没有调用 Commit**，dispose 时会自动 RollBack。这种"默认回滚"的设计安全但容易让新人忘记调 Commit 而看不到效果。

## 10. 编辑大型模型的事务策略

对几十万实体的修改，单一巨型事务会让 Esent 日志爆掉。推荐分批：

```csharp
const int BatchSize = 5000;
var batches = wallList.Chunk(BatchSize);
foreach (var batch in batches)
{
    using var txn = model.BeginTransaction("Update walls");
    foreach (var w in batch) w.Name = "X";
    txn.Commit();
}
```

每个 batch 提交一次，既能利用事务原子性，又控制了内存与日志大小。

## 11. 校验与诊断

写完模型后，建议立刻检查：

1. **schema 合法性**：用 `IfcStore.SaveAs` 写出来再 `Open` 一次，能闭环就基本合法；
2. **MVD 一致性**：可用第三方工具如 `Solibri Anywhere`、`IFC Validator`；
3. **GlobalId 唯一性**：扫一遍 `OfType<IIfcRoot>()` 看是否重复；
4. **关系完整性**：确保新建的构件都通过 `IfcRelContainedInSpatialStructure` 挂到 storey，类型对象通过 `IfcRelDefinesByType` 关联实例。

Xbim.IDS.Validator（第 15 章）可在 CI 中自动跑这些检查。

## 12. 小示例：从零建一个最小 IFC4 模型

```csharp
using Xbim.Common.Step21;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;
using Xbim.Ifc4.Kernel;
using Xbim.Ifc4.ProductExtension;
using Xbim.Ifc4.SharedBldgElements;

XbimEditorCredentials cred = new()
{
    ApplicationFullName       = "Hello-IFC",
    ApplicationIdentifier     = "DEMO",
    ApplicationDevelopersName = "你",
    ApplicationVersion        = "1.0",
    EditorsFamilyName         = "—",
    EditorsGivenName          = "—",
};

using var model = IfcStore.Create(cred, XbimSchemaVersion.Ifc4, XbimStoreType.InMemoryModel);
using (var txn = model.BeginTransaction("Build"))
{
    var project = model.Instances.New<IfcProject>(p =>
    {
        p.Initialize(ProjectUnits.SIUnitsUK);
        p.Name = "Demo";
    });
    var site = model.Instances.New<IfcSite>(s => s.Name = "Site");
    var bldg = model.Instances.New<IfcBuilding>(b =>
    {
        b.Name = "Bldg";
        b.CompositionType = IfcElementCompositionEnum.ELEMENT;
    });
    var storey = model.Instances.New<IfcBuildingStorey>(s =>
    {
        s.Name = "Level 1";
        s.Elevation = 0;
    });
    project.AddSite(site);
    site.AddBuilding(bldg);
    bldg.AddToSpatialDecomposition(storey);

    var wall = model.Instances.New<IfcWall>(w => w.Name = "W-1");
    storey.AddElement(wall);

    txn.Commit();
}

model.SaveAs("HelloIfc.ifc");
```

跑完会得到一份只含一面墙的最小 IFC4 文件。你可以在 XbimXplorer 中打开它验证树结构。

## 13. 小结

- Xbim 的写流程围绕 `IfcStore.Create` + `BeginTransaction` + `Instances.New<T>` 三件事；
- `Initialize` 与 `Add*` 扩展方法能极大减少模板代码；
- 复杂修改建议分批事务、配合 `BeginInverseCaching`；
- 编辑后用回环 SaveAs/Open + 第三方校验工具验证。

下一章我们专门拆解 IFC 中的**属性集、量集、材料、分类**——这些"语义"信息，往往才是 BIM 项目最有价值的部分。

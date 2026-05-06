---
layout: default
title: 第05章：XbimEssentials体系结构与IfcStore模型容器
---

# 第05章：Xbim.Essentials 体系结构与 IfcStore 模型容器

上一章我们看到 `Xbim.Common` 提供了与具体后端无关的抽象。本章把视角拉到应用开发者最常打交道的入口：`Xbim.Ifc.IfcStore`。

## 1. Xbim.Essentials 程序集分解

打开 NuGet 包 `Xbim.Essentials` 你会发现它实际上是一组**元包**，包括：

```
Xbim.Common
Xbim.Tessellator
Xbim.Ifc
Xbim.Ifc2x3
Xbim.Ifc4
Xbim.Ifc4x3
Xbim.IO
Xbim.IO.Step21
Xbim.IO.Xml
Xbim.IO.MemoryModel
Xbim.IO.Esent          (仅 Windows)
Xbim.IDS               (可选)
```

按用途划分：

| 类别 | 程序集 | 内容 |
| --- | --- | --- |
| 入口 | `Xbim.Ifc` | `IfcStore` 高层 API |
| 抽象/基础 | `Xbim.Common` | `IModel`、`IPersistEntity`、元数据、DI |
| Schema | `Xbim.Ifc2x3`、`Xbim.Ifc4`、`Xbim.Ifc4x3` | 自动生成的实体类、枚举、SELECT 接口 |
| 抽象接口 | `Xbim.Ifc4` 中的 `Xbim.Ifc4.Interfaces.*` | 跨版本接口（被 2x3 与 4x3 也实现） |
| IO | `Xbim.IO`、`Xbim.IO.Step21`、`Xbim.IO.Xml`、`Xbim.IO.MemoryModel`、`Xbim.IO.Esent` | 序列化与持久化 |
| 几何细分 | `Xbim.Tessellator` | 纯托管三角化（备选，无 OCCT） |

应用层最常 `using` 的命名空间：

```csharp
using Xbim.Ifc;                    // IfcStore
using Xbim.Ifc4.Interfaces;        // IIfcWall、IIfcProject 等
using Xbim.Ifc4.Kernel;            // 具体类（写时使用）
using Xbim.Ifc4.SharedBldgElements;
using Xbim.Common.Step21;          // XbimSchemaVersion
```

## 2. IfcStore：一切的起点

`IfcStore` 是 `Xbim.Ifc` 的核心类型，它把"打开/创建/保存 IFC 文件"封装成最简单的形式。本质上它是一个**装饰器**，在内部根据文件大小、平台、配置选择合适的 `IModel` 实现（Memory / Esent），并把后续访问代理给它。

主要静态工厂：

```csharp
// 打开已有文件，自动识别 .ifc / .ifcxml / .ifczip
public static IfcStore Open(
    string path,
    XbimEditorCredentials editorDetails = null,
    double? ifcDatabaseSizeThreshHold = null,    // 大于此 MB 自动落 Esent
    ReportProgressDelegate progDelegate = null,
    XbimDBAccess accessMode = XbimDBAccess.Read);

// 从流打开（明确 schema）
public static IfcStore Open(
    Stream data, StorageType dataType,
    XbimSchemaVersion schema, XbimModelType modelType,
    XbimEditorCredentials editorDetails = null,
    ReportProgressDelegate progDelegate = null,
    int codePageOverride = -1);

// 从空白创建
public static IfcStore Create(
    XbimEditorCredentials editorDetails,
    XbimSchemaVersion ifcVersion,
    XbimStoreType storageType);
```

### 2.1 打开示例

```csharp
using var model = IfcStore.Open(@"C:\Models\SampleHouse.ifc");
Console.WriteLine(model.SchemaVersion);   // Ifc4
```

打开过程会：

1. 探测文件头识别格式（STEP21 / XML / ZIP）；
2. 探测 `FILE_SCHEMA(('IFC4'));` 行获得 schema 版本；
3. 比较文件大小与 `ifcDatabaseSizeThreshHold`（默认 100MB）：
   - 小：用 `MemoryModel`；
   - 大：写一个临时 `.xbim` Esent 文件并落地；
4. 通过对应版本的工厂（`IfcMemoryModel<TFactory>` 或 `EsentModel`）解析；
5. 把内部 `IModel` 包装到 `IfcStore` 返回。

### 2.2 创建空模型

```csharp
var credentials = new XbimEditorCredentials
{
    ApplicationDevelopersName = "Acme",
    ApplicationFullName       = "Acme BIM Tool",
    ApplicationIdentifier     = "ACME.BIM",
    ApplicationVersion        = "1.0.0",
    EditorsFamilyName         = "Doe",
    EditorsGivenName          = "John",
    EditorsOrganisationName   = "Acme Construction",
};

using var model = IfcStore.Create(credentials, XbimSchemaVersion.Ifc4, XbimStoreType.InMemoryModel);
using var txn = model.BeginTransaction("Initialise");
var project = model.Instances.New<Xbim.Ifc4.Kernel.IfcProject>(p =>
{
    p.Name = "Demo";
    p.Initialize(ProjectUnits.SIUnitsUK);
});
txn.Commit();

model.SaveAs("Demo.ifc");
```

这里 `Initialize(ProjectUnits.SIUnitsUK)` 是 Xbim 提供的扩展方法，会一次性创建 `IfcUnitAssignment`、长度/面积/体积/角度的默认单位、`IfcGeometricRepresentationContext`、`IfcOwnerHistory` 等"项目骨架"，省去你手工建几十个实体的麻烦。

### 2.3 保存

```csharp
model.SaveAs("Demo.ifc");        // STEP21
model.SaveAs("Demo.ifcxml");     // ifcXML（自动按扩展名）
model.SaveAs("Demo.ifczip");     // ifcZIP
model.SaveAs("Demo.xbim");       // Esent 二进制（Xbim 私有，最快加载）
```

`SaveAs` 会按扩展名分发到对应 writer。

## 3. XbimEditorCredentials 与 OwnerHistory

IFC 强制要求每个 `IfcRoot` 有 `OwnerHistory`（谁创建/修改了它）。`XbimEditorCredentials` 集中保存这些信息，`IfcStore` 在写实体时自动生成并复用 `IfcOwnerHistory`。

要点：

- **必填项**：应用名、版本、开发者名、编辑者姓与名；
- **可选**：组织、地址；
- **重复使用**：同一段 `XbimEditorCredentials` 在一次会话中只生成一个 `IfcOwnerHistory` 实例并复用，避免冗余。

## 4. 后端选择：Memory vs Esent

| 特性 | MemoryModel | EsentModel |
| --- | --- | --- |
| 平台 | 跨平台 | Windows |
| 内存占用 | 全部加载到内存 | 按需 Activate |
| 适合规模 | <200MB IFC | 数 GB 都可承载 |
| 写入速度 | 极快 | 较慢（Esent 日志） |
| 持久化 | 需 SaveAs | 自动 `.xbim` 文件 |
| 支持事务回滚 | 有限 | 完整事务（崩溃恢复） |

经验法则：

- 临时打开转换 / 提取数据 → MemoryModel；
- 长期编辑、巨型模型、ETL → EsentModel；
- 不确定 → `XbimStoreType.HeuristicModel`，让 Xbim 按文件大小自动选。

## 5. 跨版本 IIfcXxx 接口

实际开发中，最常推荐的写法是**只读用 Interfaces，写时用具体类**：

```csharp
// 读：版本无关
foreach (var space in model.Instances.OfType<IIfcSpace>())
    Console.WriteLine($"{space.LongName}  Vol={space.GetGrossVolume()}");

// 写：必须挑具体 schema
if (model.SchemaVersion == XbimSchemaVersion.Ifc4)
{
    var w = model.Instances.New<Xbim.Ifc4.SharedBldgElements.IfcWall>();
}
else if (model.SchemaVersion == XbimSchemaVersion.Ifc2X3)
{
    var w = model.Instances.New<Xbim.Ifc2x3.SharedBldgElements.IfcWall>();
}
```

为了避免重复，Xbim 提供 `IfcStore.Instances.New(string ifcType)` 这种字符串重载，配合 schema 工厂帮助你写跨版本代码。

## 6. 命名空间组织（IFC4 为例）

```
Xbim.Ifc4
├── Kernel/                      IfcRoot, IfcProject, IfcRelationship 等
├── ProductExtension/            IfcProduct, IfcSpatialStructureElement
├── SharedBldgElements/          IfcWall, IfcSlab, IfcDoor, IfcWindow
├── SharedBldgServiceElements/   IfcDistributionElement, IfcEnergyConversionDevice
├── SharedComponentElements/     IfcDiscreteAccessory, IfcFastener
├── SharedFacilitiesElements/    IfcAsset, IfcInventory
├── HvacDomain/                  IfcAirTerminal, IfcDuct...
├── ElectricalDomain/            IfcCableSegment...
├── MeasureResource/             IfcLengthMeasure, IfcAreaMeasure
├── PropertyResource/            IfcPropertySet, IfcPropertySingleValue
├── QuantityResource/            IfcElementQuantity, IfcQuantityArea
├── GeometryResource/            IfcAxis2Placement3D, IfcDirection
├── TopologyResource/            IfcEdge, IfcFace, IfcShell
├── GeometricModelResource/      IfcExtrudedAreaSolid, IfcBooleanResult
├── GeometricConstraintResource/ IfcLocalPlacement, IfcGridPlacement
├── MaterialResource/            IfcMaterial, IfcMaterialLayerSet
├── DateTimeResource/            ...
├── RepresentationResource/      IfcShapeRepresentation
├── ProfileResource/             IfcRectangleProfileDef, IfcCircleProfileDef
└── Interfaces/                  IIfcXxx 跨版本接口
```

记住这种"按 EXPRESS schema 模块分目录"的规则后，IDE 中按需导入会非常快。

## 7. 扩展方法：`Xbim.Ifc.Extensions`

为了让 IFC 代码不那么繁琐，Xbim 在 `Xbim.Ifc.Extensions` 命名空间提供大量便捷扩展方法：

- `IfcProject.Initialize(ProjectUnits)`
- `IfcSpatialStructureElement.AddElement(IfcProduct)` —— 把构件包含到空间
- `IfcSpatialStructureElement.AddToSpatialDecomposition(IfcObjectDefinition)` —— 添加子空间
- `IfcRoot.AddPropertySet(IfcPropertySet)`
- `IfcRoot.GetPropertySingleValue<T>(string pset, string prop)`
- `IfcObjectDefinition.GetPropertySet(string)` / `GetPropertySingleValue(...)`
- `IfcWall.AddMaterial(IfcMaterial)`
- `IfcProduct.AddDefiningType(IfcTypeObject)`

**强烈建议**养成"先在扩展方法里查找有没有现成功能"的习惯——它们会替你正确地创建 `IfcRelXxx` 关系实体，避免新手忘了关系导致模型不合法。

## 8. 进度回调与日志

打开/保存大型 IFC 时，传入 `ReportProgressDelegate` 把进度反馈给 UI：

```csharp
using var model = IfcStore.Open(path,
    progDelegate: (percent, msg) =>
    {
        Console.Write($"\r{msg} {percent}%");
    });
```

进度回调贯穿 STEP21 解析、Esent 落地、几何转换等耗时步骤。

## 9. 文件头读取（不解析全文）

有时只想看一眼"这个文件什么 schema、什么应用导出"，而不想吞进数 GB。`Xbim.IO.Step21.HeaderParser` 配合 `IfcStore.GetFileSchema(path)` 可只读 HEADER 段：

```csharp
using var fs = File.OpenRead(path);
var schemas = MemoryModel.GetSchemaVersion(fs);
```

## 10. 配置 IfcStore 的全局默认

```csharp
IfcStore.ModelProviderFactory.UseHeuristicModelProvider();    // 自适应
IfcStore.ModelProviderFactory.UseMemoryModelProvider();        // 强制内存
IfcStore.ModelProviderFactory.UseEsentModelProvider();         // 强制 Esent
```

> v6 后还可以通过依赖注入（`AddXbimToolkit(...)`）在程序启动时统一配置。

## 11. 一个完整的 Round-Trip 示例

```csharp
using Xbim.Common.Step21;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

XbimEditorCredentials cred = new()
{
    ApplicationDevelopersName = "Demo",
    ApplicationFullName       = "Demo App",
    ApplicationIdentifier     = "DEMO",
    ApplicationVersion        = "1.0",
    EditorsFamilyName         = "Wang",
    EditorsGivenName          = "Wei"
};

// 1. 打开
using var model = IfcStore.Open("input.ifc", cred, accessMode: XbimDBAccess.ReadWrite);

// 2. 修改：所有墙加一个属性
using (var txn = model.BeginTransaction("Add Pset_WallCommon.IsExternal"))
{
    foreach (var wall in model.Instances.OfType<IIfcWall>())
        wall.SetPropertySingleValue("Pset_WallCommon", "IsExternal", true);
    txn.Commit();
}

// 3. 另存
model.SaveAs("output.ifc");
```

`SetPropertySingleValue` 是扩展方法（来自 `Xbim.Ifc.Extensions`），会自动建立 `IfcPropertySet` + `IfcPropertySingleValue` + `IfcRelDefinesByProperties`。

## 12. 小结

本章我们掌握了：

- Xbim.Essentials 由若干程序集组成，按职责清晰分工；
- `IfcStore` 是高层入口，封装打开 / 创建 / 保存；
- Memory vs Esent 两种后端的选择策略；
- 通过 Interfaces 写跨版本代码、通过具体类写新数据；
- 扩展方法是优雅地操作 IFC 模型的关键工具。

下一章我们将深入 IO 层，看看 STEP21、ifcXML、ifcZIP 是如何在 Xbim 中被解析和写出的。

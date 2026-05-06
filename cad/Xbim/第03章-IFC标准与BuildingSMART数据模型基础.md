---
layout: default
title: 第03章：IFC标准与BuildingSMART数据模型基础
---

# 第03章：IFC 标准与 BuildingSMART 数据模型基础

要真正理解 Xbim，就必须先理解它所表达的对象 —— **IFC（Industry Foundation Classes）**。本章不依赖任何代码，专注于厘清 IFC 标准本身。

## 1. 一份给 BIM 数据的"普通话"

不同 BIM 软件内部用各自的私有数据结构存储建筑模型：Revit 用 `.rvt`、ArchiCAD 用 `.pln`、Tekla 用 `.db1`。它们彼此并不兼容。BIM 的核心价值是**全生命周期的协同**——设计、施工、运维、监管多方都需要共享同一份数据，所以一种**中立的、开放的、跨软件**的数据格式必不可少。

IFC 就是这样一个标准：

- 由 **buildingSMART International** 制定、维护；
- 收录于国际标准 **ISO 16739**；
- 使用 **EXPRESS（ISO 10303-11）** 定义数据模型；
- 用 **STEP21（ISO 10303-21）** 文本格式序列化；
- 同时支持 XML、JSON、压缩 ZIP 等表达形式。

理解 IFC 后再回头看 Xbim 的实体类、接口、序列化器，你会发现它们都是这套标准的"机械翻译"。

## 2. IFC 的版本演进

| 版本 | 发布时间 | 主要特点 |
| --- | --- | --- |
| IFC1.x – IFC2.x | 1997–2003 | 早期版本，已废弃 |
| **IFC2x3 TC1** | 2007 | 长期事实标准，许多软件至今导出此版本 |
| **IFC4 (Add2 TC1)** | 2017 | 重大重构：新增几何、装配、面板、统一参数化 |
| IFC4.1, IFC4.2 | 2018+ | 加入桥梁、隧道、铁路、公路等基础设施扩展 |
| **IFC4x3** | 2020+ 持续 | 把 IFC4.x 系列合并为正式标准，重点支持基础设施 |
| IFC5（在研） | — | 重大改革，方向尚未定型 |

Xbim 同时支持 IFC2x3、IFC4、IFC4x3，并在 `Xbim.Ifc4.Interfaces` 中提供统一接口屏蔽版本差异（详见第 05 章）。

## 3. IFC 的层次架构

IFC 数据模型是分层的，使用"洋葱模型"自底向上构建：

```
┌────────────── 领域层（Domain Layer） ──────────────┐
│ IfcArchitectureDomain, IfcStructuralAnalysisDomain,│
│ IfcHvacDomain, IfcElectricalDomain, ...            │
├──────────── 互操作层（Interoperability Layer） ────┤
│ IfcSharedBldgElements, IfcSharedFacilitiesElements,│
│ IfcSharedMgmtElements, IfcSharedComponentElements ,│
│ IfcSharedInfrastructureElements ...                │
├──────────── 核心层（Core Layer） ──────────────────┤
│ IfcKernel, IfcControlExtension,                    │
│ IfcProductExtension, IfcProcessExtension           │
├──────────── 资源层（Resource Layer） ──────────────┤
│ IfcGeometryResource, IfcTopologyResource,          │
│ IfcMaterialResource, IfcMeasureResource,           │
│ IfcDateTimeResource, IfcGeometricModelResource,... │
└────────────────────────────────────────────────────┘
```

**核心约定**：上层只能引用下层的实体，反之不行。这种分层使得 IFC 既稳定（资源层很少变动）又能演进（领域层可以独立扩展）。

### 3.1 资源层（Resource Layer）

提供最底层的数据类型积木，例如：

- `IfcMeasureResource`：长度、角度、面积、体积等度量类型；
- `IfcGeometryResource`：点、向量、坐标系、轴系；
- `IfcTopologyResource`：顶点、边、环、面、壳、实体；
- `IfcGeometricModelResource`：拉伸体、扫掠体、布尔结果、面表示；
- `IfcDateTimeResource`、`IfcMaterialResource`、`IfcPropertyResource`、`IfcCostResource` 等。

### 3.2 核心层（Core Layer）

定义最基础的 BIM 抽象。最重要的几个根类型：

- **`IfcRoot`** —— 一切"实体根"的祖先，含 `GlobalId`、`OwnerHistory`、`Name`、`Description`。
- **`IfcObjectDefinition`** —— `IfcRoot` 的子类，又分：
  - **`IfcObject`**：实例（一根具体的墙）
  - **`IfcTypeObject`**：类型/族（"M_基本墙: 200mm"）
  - **`IfcContext`**：项目/库的上下文容器
- **`IfcRelationship`** —— 关系实体的祖先（IFC 用关系实体显式表达对象之间的关联，是其最显著的设计特征之一）。
- **`IfcPropertyDefinition`** —— 属性集与类型属性的祖先。

**关键概念：GlobalId（GUID）**

每个 `IfcRoot` 都有一个全球唯一 ID，使用 22 字符的 IFC 自定义 base64 编码（不是标准的 GUID 格式）。这是模型对比、版本控制、数据交换的关键锚点。Xbim 中由 `Xbim.Ifc4.UtilityResource.IfcGloballyUniqueId` 处理。

### 3.3 互操作层（Interoperability Layer）

定义跨领域共享的 BIM 元素，例如：

- `IfcWall`、`IfcSlab`、`IfcBeam`、`IfcColumn`、`IfcDoor`、`IfcWindow`、`IfcStair`、`IfcRoof`；
- `IfcFurniture`、`IfcEquipment`；
- `IfcDistributionElement`（管道、风管、电气元件的基础）。

### 3.4 领域层（Domain Layer）

每个领域有自己专门的元素：

- 建筑：`IfcDoorPanelProperties`、`IfcCurtainWall`；
- 结构：`IfcStructuralPointAction`、`IfcStructuralAnalysisModel`；
- 暖通：`IfcAirTerminal`、`IfcDuctSegment`、`IfcPipeFitting`；
- 电气：`IfcCableSegment`、`IfcElectricMotor`；
- 基础设施（IFC4x3）：`IfcBridge`、`IfcRailway`、`IfcRoad`、`IfcTunnel`。

## 4. IFC 的关键设计模式

理解 IFC 必须掌握以下几个反复出现的模式。它们构成了"读 IFC 模型"的语法。

### 4.1 对象 / 类型分离

每根真实的墙是一个 `IfcWall` **实例**，其类型/族是 `IfcWallType`。两者通过 `IfcRelDefinesByType` 关系关联：

```
IfcWall (instance) ── IfcRelDefinesByType ──> IfcWallType
```

属性、材料、几何模板可以挂在 `IfcWallType` 上，被多个 `IfcWall` 共享。

### 4.2 显式关系（Relationships）

IFC **不**用 C# 风格的指针表达关联，而是把每一种关联实例化为一个**关系实体**。例如"楼板属于某个楼层"不是写成 `slab.Storey = storey`，而是创建一个 `IfcRelContainedInSpatialStructure`：

```
IfcRelContainedInSpatialStructure
   RelatingStructure = IfcBuildingStorey  (容器：楼层)
   RelatedElements   = [IfcSlab, IfcWall, IfcColumn, ...]  (内容)
```

常用关系实体：

| 关系 | 含义 |
| --- | --- |
| `IfcRelAggregates` | 整体–部分（项目 → 场地 → 建筑 → 楼层） |
| `IfcRelContainedInSpatialStructure` | 构件被空间容器包含 |
| `IfcRelDefinesByType` | 实例–类型 |
| `IfcRelDefinesByProperties` | 对象–属性集 |
| `IfcRelAssociatesMaterial` | 对象–材料 |
| `IfcRelAssociatesClassification` | 对象–分类码（OmniClass、Uniclass 等） |
| `IfcRelVoidsElement` | 墙开洞（被减掉的开口） |
| `IfcRelFillsElement` | 门窗填充开口 |
| `IfcRelConnectsElements` | 一般连接 |
| `IfcRelSpaceBoundary` | 空间边界 |

这种"关系即实体"的设计虽然繁琐，但具有显式、可被查询、可附加额外信息（关系本身也是 `IfcRoot`，有 GUID/属性）等好处。

### 4.3 空间结构（Spatial Structure）

每个 IFC 模型都有一棵空间结构树：

```
IfcProject
└── IfcSite
    └── IfcBuilding
        ├── IfcBuildingStorey (1F)
        │   └── IfcSpace (Living Room)
        ├── IfcBuildingStorey (2F)
        └── ...
```

构件（墙、板、柱、门、窗）通过 `IfcRelContainedInSpatialStructure` 挂在某个空间下。这是后续遍历模型、出量、做空间分析的基础。

### 4.4 属性集 / 量集（Property Set / Quantity Set）

IFC 把"属性"显式从对象中抽离：

- **`IfcPropertySet`**：包含若干 `IfcProperty`（典型子类 `IfcPropertySingleValue`、`IfcPropertyEnumeratedValue`、`IfcPropertyTableValue`）。
- **`IfcElementQuantity`**：包含若干 `IfcPhysicalQuantity`（长度、面积、体积、计数）。

PSet 的命名通常采用 `Pset_XxxCommon` 模式（buildingSMART 维护一份标准 PSet 词表）。一个对象可以同时关联多个 PSet（通过 `IfcRelDefinesByProperties`）。

### 4.5 几何表达（Representation）

IFC 几何分两层：

- **位置（Placement）**：`IfcLocalPlacement` 形成一棵相对坐标系树，最终对齐到全球或工程坐标系。
- **形状（Representation）**：`IfcProductDefinitionShape` 包含若干 `IfcShapeRepresentation`，每个又包含若干 `IfcRepresentationItem`（`IfcExtrudedAreaSolid`、`IfcBooleanResult`、`IfcFacetedBrep`、`IfcTriangulatedFaceSet`、`IfcPolyLine` 等）。

每个 `IfcShapeRepresentation` 标注了 `RepresentationType`（"SweptSolid"、"Brep"、"MappedRepresentation"、"Tessellation" 等）和 `ContextOfItems`（"Body"、"Axis"、"FootPrint"），同一个对象常常同时拥有多种表达。

第 11–12 章会详细分析 Xbim.Geometry 是如何把这些隐式描述转成网格的。

## 5. EXPRESS 数据建模语言简介

EXPRESS 是 ISO 10303-11 定义的面向对象的数据建模语言，IFC schema 文件（`.exp`）就是用 EXPRESS 写的。它的语法风格近似 Pascal，举例：

```
ENTITY IfcWall
  SUBTYPE OF (IfcBuildingElement);
  PredefinedType : OPTIONAL IfcWallTypeEnum;
WHERE
  CorrectPredefinedType : ...
END_ENTITY;
```

EXPRESS 关键概念：

- **ENTITY**：实体（类）；
- **SUBTYPE OF**：继承；
- **OPTIONAL**：可空；
- **LIST / SET / ARRAY / BAG**：集合；
- **WHERE / RULE / FUNCTION**：约束/校验规则；
- **DERIVE**：派生属性；
- **INVERSE**：反向引用（"我被谁引用"）；
- **TYPE / SELECT / ENUMERATION**：类型别名、联合、枚举。

Xbim.CodeGeneration 会把这些元素分别映射为：

- ENTITY → C# class
- SUBTYPE → 继承 + 接口
- SELECT → 标记接口（`IIfcCurveOrEdgeCurveSelect` 等）
- ENUMERATION → C# enum
- INVERSE → C# 计算属性，运行时遍历模型反查

## 6. STEP21 文件格式

STEP21 是 IFC 最常见的序列化格式（`.ifc` 扩展名）。它是纯文本的，结构如下：

```
ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('SampleHouse.ifc','2024-01-01T00:00:00',...);
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('1xS3BCk291UvhgP2dvNsgp',#2,'Sample House',$,$,$,$,(#20),#7);
#2=IFCOWNERHISTORY(#3,#6,$,.ADDED.,$,$,$,1577836800);
#3=IFCPERSONANDORGANIZATION(#4,#5,$);
...
ENDSEC;
END-ISO-10303-21;
```

要点：

- 每行以 `#<id>=ENTITY(...);` 形式定义一个实体实例；
- 实体之间通过 `#<id>` 引用形成有向图；
- `$` 表示空（OPTIONAL 未填）；
- `*` 表示派生（DERIVE）；
- `.ENUM_VALUE.` 表示枚举值；
- `'string'`、`(...)`、`(#1,#2,#3)` 分别为字符串、元组、列表。

第 06 章会展示 Xbim 如何在 `Xbim.IO.Step21` 中实现这套语法的解析与生成。

## 7. ifcXML、ifcZIP、ifcJSON

- **ifcXML**：XML 表达，结构对应 EXPRESS schema，便于与 XSLT、XSD 工具链集成，但体积大；
- **ifcZIP**：把 .ifc 或 .ifcXML 用 zip 压缩，是大型模型分发的常见格式；
- **ifcJSON**：尚未正式发布的 JSON 序列化（草案中），Xbim 暂未原生支持。

Xbim 通过 `Xbim.IO.Xml` 与 `IfcStore` 自动识别 `.ifc / .ifcxml / .ifczip` 后缀。

## 8. MVD：模型视图定义

IFC schema 包含数千个实体，但实际工程中没有任何项目会用全。MVD（Model View Definition）就是 buildingSMART 制定的"用例子集"：

- **CoordinationView**：建筑/结构/暖通三专业协调，最经典的 MVD；
- **ReferenceView**：仅做参考查看，禁用复杂参数化；
- **DesignTransferView**：允许带可编辑信息；
- **基础设施 MVD**：桥梁、隧道、公路、铁路（IFC4x3 重点）。

文件头 `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),...)` 会写出 MVD 名称。校验工具会按 MVD 检查模型是否合规。

## 9. IDS：信息交付规范（新一代校验）

IDS（Information Delivery Specification）是 buildingSMART 较新（2022+）推出的、用 XML 编写的轻量级模型校验规范。它替代了过去庞杂的 mvdXML，可以表达诸如：

- 项目中所有 `IfcWall` 必须含 `Pset_WallCommon.IsExternal`；
- 所有外墙必须有"防火等级"属性；
- 所有 `IfcSpace` 必须有面积与体积量；

Xbim 团队为此专门提供了 [`Xbim.IDS.Validator`](https://github.com/xBimTeam/Xbim.IDS.Validator)。第 15 章会展开。

## 10. 在 Xbim 中的对应

铺垫这么多 IFC 概念后，我们快速对照 Xbim 的 C# 类：

| IFC 概念 | Xbim C# 接口（在 `Xbim.Ifc4.Interfaces` 中） |
| --- | --- |
| 实体根 | `IIfcRoot` |
| 项目 | `IIfcProject` |
| 空间结构 | `IIfcSite`, `IIfcBuilding`, `IIfcBuildingStorey`, `IIfcSpace` |
| 构件 | `IIfcWall`, `IIfcSlab`, `IIfcDoor`, `IIfcColumn`, ... |
| 类型 | `IIfcWallType`, `IIfcDoorType`, ... |
| 关系 | `IIfcRelAggregates`, `IIfcRelContainedInSpatialStructure`, ... |
| 属性集 | `IIfcPropertySet`, `IIfcPropertySingleValue` |
| 量集 | `IIfcElementQuantity`, `IIfcQuantityLength`, `IIfcQuantityVolume` |
| 几何上下文 | `IIfcGeometricRepresentationContext` |
| 几何表达 | `IIfcShapeRepresentation`, `IIfcExtrudedAreaSolid`, `IIfcBooleanResult` |

无论文件是 IFC2x3 还是 IFC4，只要通过 `IIfcXxx` 接口访问，写出来的代码都能保持一份。

## 11. 小结

本章我们站在 IFC 标准本身的角度，理解了 Xbim 即将映射到 .NET 的世界：

- IFC 是面向 BIM 的 ISO 标准开放数据模型；
- 它分四层、含数千实体，但有清晰的根类与关系模式；
- 几何分位置和形状两层，形状又分多种 representation；
- 序列化主流是 STEP21 的 `.ifc` 文本格式，也支持 XML/ZIP；
- buildingSMART 还制定了 MVD、IDS、BCF、COBie 等配套标准。

下一章我们将打开 `Xbim.Common`，看看 Xbim 是如何把 EXPRESS 元模型搬进 .NET 内存的。

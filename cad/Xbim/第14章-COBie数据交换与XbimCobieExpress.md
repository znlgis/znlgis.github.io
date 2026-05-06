---
layout: default
title: 第14章：COBie数据交换与XbimCobieExpress
---

# 第14章：COBie 数据交换与 Xbim.CobieExpress

BIM 不仅是设计阶段的事——交付给业主与设施管理（FM）后，模型中"资产数据"的价值往往超过几何本身。**COBie**（Construction-Operations Building information exchange）就是把建筑资产数据从 BIM 模型抽出、组织成可被 FM 系统消费的开放标准。

## 1. COBie 是什么

COBie 由 NIBS（美国国家建筑科学研究院）发起、被 BS 1192-4、ISO 19650-4 等收录，本质是：

> "一组用 Excel 工作表（或对应的 STEP/JSON）表达建筑资产移交数据的标准。"

它包含若干工作表（按字母顺序，命名固定）：

| 表 | 内容 |
| --- | --- |
| Contact | 项目相关人员/组织 |
| Facility | 设施总体 |
| Floor | 楼层 |
| Space | 空间 |
| Zone | 区 |
| Type | 设备/构件类型 |
| Component | 设备/构件实例 |
| System | 系统（HVAC、电气等） |
| Assembly | 装配关系 |
| Connection | 连接 |
| Spare | 备件 |
| Resource | 维护资源 |
| Job | 维护作业 |
| Document | 关联文件 |
| Attribute | 自定义属性键值表 |
| Coordinate | 坐标 |
| Issue | 缺陷/问题 |

每张表是固定列的二维数据，行之间通过 `ExtIdentifier` / `ExtSystem` 等列做主外键关联。

## 2. Xbim.CobieExpress 项目

[`xBimTeam/XbimCobieExpress`](https://github.com/xBimTeam/XbimCobieExpress) 提供：

- **COBie 数据模型**（按 COBie Express schema 生成的 .NET 类）；
- **从 IFC 抽取 COBie 数据**（`IfcToCoBieLiteUkExchanger`、`CobieExpressHelper`）；
- **导出为 Excel / JSON / STEP**；
- **对照 COBie UK / COBie 2.4 等不同方言的列定义**。

主要程序集：

```
Xbim.CobieExpress             COBie schema 实体（自动生成）
Xbim.CobieExpress.IO          IO（XLS、JSON、STEP）
Xbim.CobieLiteUK              较旧的 LiteUK 数据模型（兼容）
Xbim.IO.CobieExpress          IModel 后端（沿用 Xbim.Common）
```

值得一提的是，COBie 也是用 EXPRESS 描述的（`COBieExpress.exp`），所以 Xbim.CodeGeneration 同一套代码生成机制被复用。

## 3. 从 IFC 到 COBie：基本流程

```csharp
using Xbim.CobieExpress;
using Xbim.CobieExpress.Exchanger;
using Xbim.IO.CobieExpress;
using Xbim.Ifc;

using var ifc = IfcStore.Open("input.ifc");

// 1. 创建一个空 COBie 模型
using var cobie = CobieModel.OpenStep21Zip("template.cobie") ?? new CobieModel();
using (var txn = cobie.BeginTransaction("From IFC"))
{
    // 2. 从 IFC 抽取
    var exchanger = new IfcToCoBieExpressExchanger(ifc, cobie);
    exchanger.Convert();
    txn.Commit();
}

// 3. 导出为 Excel
cobie.ExportToTable("output.xlsx", out var report);
Console.WriteLine(report);
```

`IfcToCoBieExpressExchanger` 负责按 COBie 表把 IFC 实体映射过来：

| IFC | → | COBie |
| --- | --- | --- |
| `IfcOwnerHistory.OwningUser.ThePerson` | | Contact |
| `IfcProject` / `IfcSite` / `IfcBuilding` | | Facility |
| `IfcBuildingStorey` | | Floor |
| `IfcSpace` | | Space |
| `IfcZone`、`IfcSystem` | | Zone / System |
| `IfcXxxType` | | Type |
| `IfcXxx`（设备类） | | Component |
| 各种 PSet / Qto | | Attribute |

抽取过程是规则化的：根据"COBie 应该挂什么属性"在 IFC 中按 PSet 名/属性名查找；找不到则记录到报告中提示用户补全。

## 4. 表格化：Xbim.IO.TableStore

Xbim 提供一个通用的"按映射规则把任何 EXPRESS 模型导成 Excel"的小框架 [`Xbim.IO.TableStore`](https://github.com/xBimTeam/XbimEssentials)。它由：

- **ClassMapping**：哪些类→哪些工作表；
- **PropertyMapping**：哪些属性→哪些列；
- **TableHashing**：去重；
- **ConfigurationFile**：JSON 描述映射规则。

COBie 的导出实际上就是一组预定义的 ClassMapping。如果你需要把任意 IFC 数据导成 Excel，可以参考 COBie 的 mapping 文件作为蓝本。

## 5. COBie 模型的读取

```csharp
using var cobie = CobieModel.OpenStep21Zip("file.cobie.zip");
foreach (var space in cobie.Instances.OfType<CobieSpace>())
    Console.WriteLine($"{space.Name} - {space.Description}");

foreach (var comp in cobie.Instances.OfType<CobieComponent>())
    Console.WriteLine($"{comp.Name} (Type={comp.Type?.Name}, Floor={comp.Floor?.Name})");
```

CobieModel 也实现了 `Xbim.Common.IModel` 接口，所以对 COBie 数据用 `OfType<T>()` + LINQ 的方式与 IFC 完全一致。

## 6. 双向：从 Excel 反向导入 COBie 模型

```csharp
var cobie = new CobieModel();
cobie.ImportFromTable("output.xlsx", out var report);
```

把业主补全的 Excel 反向变成 CobieModel，再可以重新导出 STEP/JSON，或回写部分字段到 IFC（社区有相关示例项目）。

## 7. COBie UK Lite

`Xbim.CobieLiteUK` 是较早的"轻量 COBie"实现（基于英国 PAS 1192 的 COBie UK 子集）。结构上比完整 COBie Express 简单，但目前已逐步被 Express 版本取代。新项目建议直接使用 `Xbim.CobieExpress`。

## 8. COBie 与 IFC 不同的关注点

写代码时注意几个差异：

- **IFC 关注几何 + 关系**；**COBie 关注资产 + 时间** —— Component 必带"安装日期、保修起止"等字段；
- **IFC 用 GUID**，**COBie 用 ExtIdentifier**（通常是 IFC 的 GUID 转换而来）；
- **COBie 表是扁平的**，没有继承层级，所以一些 IFC 概念（例如多层墙）会被压扁成"Type + 自定义 Attribute"；
- COBie Excel 在英美工程行业是合同交付物，**列顺序、表头大小写、空值约定**都需严格遵守。

## 9. 工程实践中的常见痛点与解决

1. **PSet 缺失**：模型没填 `Pset_Asset.Manufacturer` 等关键属性 → COBie Type/Component 报警告，需要在设计阶段就规定 PSet 标准；
2. **类型/实例混乱**：实例没挂 IfcType → COBie Type 表为空，Component 找不到 Type 主键。要么修模型，要么在 Exchange 配置里用启发式（按几何/名称聚类）；
3. **跨语言**：业主要求中文 Excel → 在 mapping 配置里把列头改成本地化字符串，Xbim.IO.TableStore 支持；
4. **批量校验**：大量项目交付前，写个控制台工具用 Xbim.CobieExpress + Xbim.IDS.Validator 跑 CI 流水线，自动产出问题清单。

## 10. 小结

`Xbim.CobieExpress` 把 IFC 信息转化为面向运维的资产数据：

- 同一份代码生成机制（从 EXPRESS）复用到 COBie Schema；
- `IfcToCoBieExpressExchanger` 一行调用完成抽取；
- `Xbim.IO.TableStore` 可双向 Excel ↔ COBie；
- `CobieModel` 与 `IfcStore` 同样基于 `Xbim.Common.IModel`，开发体验一致。

下一章我们继续看 Open BIM 生态：IDS 模型校验与 BCF 协同。

---
layout: default
title: 第15章：IDS模型校验BCF协同与生态扩展
---

# 第15章：IDS 模型校验、BCF 协同与生态扩展

本章覆盖 Open BIM 生态中三个关键标准在 Xbim 中的实现：

1. **IDS（Information Delivery Specification）**：模型质量校验；
2. **BCF（BIM Collaboration Format）**：工作流协同；
3. **bSDD（buildingSMART Data Dictionary）**：术语字典；
4. 以及若干在 Xbim 周边发展的生态项目。

## 1. IDS：现代 IFC 校验标准

### 1.1 来龙去脉

在 IDS 出现之前，buildingSMART 用 **mvdXML** 描述"模型应满足什么要求"。mvdXML 表达力强但语法复杂、写一份规则文件可能上百 KB，工程师望而却步。**IDS（v0.9 → v1.0 于 2024 正式发布）** 是 buildingSMART 推出的简化方案：

- XML 格式，结构清晰；
- 表达"对哪些对象、要求哪些属性、值满足什么模式"；
- 工程师/BIM 经理可以手写或在 GUI 里编辑；
- 工具可以一键校验任意 IFC 文件并产出标准化报告。

一个最小 IDS 文件：

```xml
<ids xmlns="http://standards.buildingsmart.org/IDS"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <info>
    <title>外墙必须有防火等级</title>
  </info>
  <specifications>
    <specification name="Pset_WallCommon.FireRating" ifcVersion="IFC4">
      <applicability>
        <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
        <property dataType="IFCBOOLEAN">
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>IsExternal</simpleValue></baseName>
          <value><simpleValue>true</simpleValue></value>
        </property>
      </applicability>
      <requirements>
        <property dataType="IFCLABEL">
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>FireRating</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>
```

含义："对所有外墙（IsExternal=true 的 IfcWall），要求 `Pset_WallCommon.FireRating` 必须存在。"

### 1.2 Xbim.IDS.Validator

[`xBimTeam/Xbim.IDS.Validator`](https://github.com/xBimTeam/Xbim.IDS.Validator) 是 Xbim 团队的官方实现：

- 解析 `.ids` 文件为 `IdsSpecification` 对象图；
- 对 `IfcStore` 中匹配 `applicability` 的实体逐条检查 `requirements`；
- 输出 `ValidationOutcome` 报告（成功/失败 + 详细原因）。

NuGet：`dotnet add package Xbim.IDS.Validator`

最小用法：

```csharp
using Xbim.Ifc;
using Xbim.IDS.Validator.Core;
using Xbim.IDS.Validator.Core.Configuration;
using Microsoft.Extensions.DependencyInjection;

var sp = new ServiceCollection()
    .AddIdsValidation()
    .BuildServiceProvider();

var validator = sp.GetRequiredService<IIdsModelValidator>();

using var ifc = IfcStore.Open("model.ifc");
var outcome = await validator.ValidateAgainstIdsAsync(ifc, "rules.ids", logger: null);

foreach (var result in outcome.ExecutedRequirements)
    Console.WriteLine($"{result.Status} : {result.Specification.Name} on #{result.TestedEntity?.EntityLabel}");
```

输出粒度可以细到"哪个属性的哪个值不满足"。配合 CI（GitHub Actions / Azure Pipelines）就能在每次模型更新时自动跑校验。

### 1.3 IDS 表达能力

IDS 1.0 支持的核心 facet：

- **Entity**：限定 IFC 类型（含子类型）+ predefined type；
- **Attribute**：实体直接属性约束；
- **Classification**：分类码约束（"必须有 Uniclass EF_25_*"）；
- **Property**：PSet/属性约束；
- **Material**：材料约束；
- **PartOf**：父级关系约束（如"必须属于某 IfcZone"）。

值约束支持 simpleValue、restriction（pattern/enumeration/length/min/max）。

### 1.4 与编辑器的集成

业界已经有若干 IDS 编辑器：

- **IDS Editor**（buildingSMART 官方草案）；
- **Plan2Bim IDS Editor**（开源）；
- **BlenderBIM** 内置；
- **xBIM IDS GUI**（社区）。

工程团队的典型工作流：

1. BIM 经理在 GUI 里拼出 `.ids`；
2. 设计协议要求模型必须通过该 IDS；
3. 项目仓库 CI 用 Xbim.IDS.Validator 自动校验；
4. 报告以 SARIF/JUnit XML 输出，挂到 PR/MR 评论。

## 2. BCF：协同问题报告格式

BCF（BIM Collaboration Format）是 buildingSMART 制定的"问题/任务交换"格式，用于不同 BIM 软件之间传递 RFI（Request For Information）、碰撞、冲突、修改建议等。

### 2.1 BCF 结构

`.bcfzip` 是一个 zip 文件，内含多个 `Topic`，每个 topic 文件夹有：

- `markup.bcf`（XML：标题、状态、责任人、关联 IFC GUID）；
- `viewpoint.bcfv`（XML：相机参数 + 剖切 + 高亮）；
- `snapshot.png`（截图）；
- 可选附件、评论。

也有"BCF API"协议（HTTP/JSON），用于在线服务（BIM 协同平台）之间互通。

### 2.2 Xbim 的 BCF 实现

[`xBimTeam/XbimBCF`](https://github.com/xBimTeam/XbimBCF) 提供：

- BCF v2.1、v3.0 数据模型；
- 读写 `.bcfzip`；
- 简单 BCF API 客户端。

```csharp
using Xbim.BCF;

using var fs = File.OpenRead("issues.bcfzip");
var doc = BCFv21.BCFFile.Deserialize(fs);
foreach (var topic in doc.Topics)
{
    Console.WriteLine($"[{topic.Markup.Topic.TopicStatus}] {topic.Markup.Topic.Title}");
    foreach (var c in topic.Markup.Comments)
        Console.WriteLine($"  - {c.Author}: {c.Comment}");
}
```

### 2.3 与 IFC + 视点联动

BCF Viewpoint 含 PerspectiveCamera 或 OrthogonalCamera 参数。结合 Xbim.WebUI 即可"点击 issue 跳转到对应视角"：

```js
viewer.setCameraParametersFromBCF(viewpoint);
viewer.setState('Hidden', allIds);
viewer.setState('Visible', viewpoint.components.visibility.exceptions);
```

## 3. bSDD：术语字典

[buildingSMART Data Dictionary](https://search.bsdd.buildingsmart.org/) 是一个跨语言的"BIM 词典"——给每个分类、属性、值用 GUID + 多语言定义。Xbim 没有官方专用的 bSDD 包，但其 IDS 实现支持引用 bSDD URL，作为约束的"权威来源"。

实务做法：在 IDS Property 的 `propertySet` 里写 `xs:anyURI` 形式的 bSDD URI，Xbim.IDS.Validator 会按 URI 反查标准定义并比较。

## 4. 其他生态项目

围绕 Xbim 还存在若干社区/相关项目：

| 项目 | 说明 |
| --- | --- |
| [Xbim.Toolkit](https://github.com/xBimTeam) 组织主页 | 总入口 |
| [XbimSamples](https://github.com/xBimTeam/XbimSamples) | 官方示例代码（C# + .NET） |
| [Xbim.IFC4x3](https://github.com/xBimTeam/XbimEssentials) 中已合并 | 基础设施扩展（桥/隧/路/铁/水利） |
| [Xbim.CodeGeneration](https://github.com/xBimTeam/XbimEssentials) | 从 EXPRESS 自动生成实体类 |
| [BIMOpenSchemaIfcDb](https://github.com/CDIC-IBA/BIMOpenSchemaIfcDb) | 第三方：基于 Xbim 的关系数据库映射 |
| [XbimXplorerPlugins](https://github.com/xBimTeam/XbimWindowsUI/tree/master/XbimXplorerPlugins) | XbimXplorer 插件示例 |
| [BimSurfer](https://github.com/opensourceBIM/BIMsurfer) | 与 Xbim 类似定位的 Web 查看器，可对比学习 |
| [IFCViewer (Xeokit)](https://xeokit.io/) | 商业 + 开源混合的 Web 渲染器 |
| [IfcDoc](https://github.com/buildingSMART/IfcDoc) | buildingSMART 官方的 IFC 文档生成器 |

## 5. 把它们组合成 BIM 工具链

一个完整的"BIM 资产交付平台"可能包含：

```
1. Designer 上传 .ifc
       │
       ▼
2. 服务器（Xbim.Essentials）
   - 解析 → IfcStore
   - Xbim3DModelContext.CreateContext()
   - Xbim.IDS.Validator 跑校验
   - Xbim.CobieExpress 抽取 COBie
       │
       ├── 校验失败 → 报告
       │
       ├── 几何 → output.wexbim → 推到 CDN
       │
       └── COBie → Excel/JSON → 推到资产系统
       │
       ▼
3. Web 查看器（Xbim.WebUI）
   - 加载 wexbim
   - 拾取联动属性查询
   - 显示 BCF Issue
       │
       ▼
4. 业主 / FM 系统
   - 用 COBie 数据初始化 CMMS
   - 用 BCF 进行运维问题协同
```

每一步都能被 Xbim 工具集独立完成，这是它在企业级 BIM 系统中被广泛采用的根本原因。

## 6. 性能与可靠性建议

- **CI 中跑 Xbim.IDS.Validator**：每次模型变更自动执行；
- **Esent 缓存**：将 .xbim 缓存到对象存储，多次重用；
- **拆分流水线**：解析 / 几何 / 校验 / COBie 四个独立 worker，按需重跑；
- **日志接入 ELK**：几何引擎产生大量警告，统一搜集后分析模型质量趋势；
- **多 schema 准备**：IFC2x3 → IFC4 → IFC4x3 三种场景都要测试。

## 7. 小结

Open BIM 不只是"会读 .ifc"——还包括：

- **IDS** 用来表达"模型必须满足什么条件"，Xbim.IDS.Validator 直接落地；
- **BCF** 用于跨平台传递问题、视点、评论，XbimBCF 提供完整数据模型；
- **bSDD** 提供跨语言术语字典，IDS 中可引用；
- **COBie** 完成资产交付（上一章），与 IDS、BCF 共同构成"模型质量 + 协同 + 移交"三角。

通过 Xbim，你可以在 .NET 单一技术栈内覆盖以上所有标准。下一章我们做综合实战，把 16 章所学串起来。

---
layout: default
title: 第16章：综合实战构建IFC处理与BIM应用
---

# 第16章：综合实战 —— 构建 IFC 处理与 BIM 应用

前 15 章把 Xbim 的方方面面拆开讲解。本章用一个完整的、贴近真实业务的案例把它们串起来，并给出后续学习与扩展的建议。

## 案例：BimQA — 一个最小的 BIM 模型质量平台

**目标**：业主收到设计方提交的 `.ifc` 文件后，用一个 .NET 服务自动完成：

1. 加载并基本校验（schema、单位、空间结构完整性）；
2. 提取统计报表（构件计数、外墙长度、面积、体积、空间清单）；
3. 用 IDS 文件进行规则化校验；
4. 抽取 COBie Excel；
5. 生成 `.wexbim` 供浏览器查看；
6. 输出综合报告（HTML + JSON + Excel + BCF）。

我们按这个目标把代码模块化分层。

## 1. 项目骨架

```
BimQA/
├── BimQA.Core/            领域服务、IFC 处理流水线
├── BimQA.Web/             ASP.NET Core 前端 + API
├── BimQA.Cli/             命令行版本
└── BimQA.Tests/           xUnit 测试
```

`BimQA.Core` 引用：

```xml
<PackageReference Include="Xbim.Essentials" Version="6.0.*" />
<PackageReference Include="Xbim.Geometry" Version="5.1.*" />
<PackageReference Include="Xbim.CobieExpress" Version="6.0.*" />
<PackageReference Include="Xbim.IDS.Validator" Version="1.0.*" />
<PackageReference Include="Microsoft.Extensions.Hosting" Version="8.0.*" />
```

> 不同模块的版本号需以 NuGet 最新发布为准，详见各仓库 README。

## 2. 启动配置

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xbim.Common.Configuration;

var host = Host.CreateApplicationBuilder(args);

host.Services.AddXbimToolkit(b => b
    .AddMemoryModel()
    .AddEsentModel()
    .AddHeuristicModel()
    .AddLogging(l => l.AddConsole().SetMinimumLevel(LogLevel.Information))
);

host.Services.AddIdsValidation();
host.Services.AddSingleton<BimQAPipeline>();

await host.Build().Services.GetRequiredService<BimQAPipeline>().RunAsync(args[0]);
```

`AddXbimToolkit` 是 v6+ 的扩展，把 Xbim 的几何引擎、模型工厂、日志一次性接入 .NET DI。

## 3. 流水线总线

```csharp
public class BimQAPipeline
{
    private readonly IIdsModelValidator _ids;
    private readonly ILogger<BimQAPipeline> _log;

    public BimQAPipeline(IIdsModelValidator ids, ILogger<BimQAPipeline> log)
    { _ids = ids; _log = log; }

    public async Task RunAsync(string ifcPath)
    {
        var workdir = Path.Combine(Path.GetDirectoryName(ifcPath)!, "_bimqa");
        Directory.CreateDirectory(workdir);

        using var model = OpenLarge(ifcPath);

        var basic    = BasicReport(model);
        var stats    = ExtractStats(model);
        var idsRpt   = await ValidateIds(model);
        var cobiePath= ExtractCobie(model, Path.Combine(workdir, "cobie.xlsx"));
        var wexbim   = ConvertGeometry(model, Path.Combine(workdir, "model.wexbim"));
        var bcf      = WriteBcfIssues(idsRpt, Path.Combine(workdir, "issues.bcfzip"));

        WriteHtml(workdir, basic, stats, idsRpt, cobiePath, wexbim, bcf);
    }
}
```

下面把每一步具体化。

## 4. 鲁棒地打开模型

```csharp
public static IfcStore OpenLarge(string path)
{
    var cred = new XbimEditorCredentials
    {
        ApplicationFullName       = "BimQA",
        ApplicationIdentifier     = "BIMQA",
        ApplicationDevelopersName = "Demo",
        ApplicationVersion        = "1.0",
        EditorsFamilyName         = "—",
        EditorsGivenName          = "—",
    };

    return IfcStore.Open(path, cred,
        ifcDatabaseSizeThreshHold: 50,        // 50MB+ 自动 Esent
        accessMode: XbimDBAccess.ReadWrite);
}
```

## 5. 基本报告

```csharp
public static BasicReport BasicReport(IfcStore m)
{
    var project = m.Instances.OfType<IIfcProject>().Single();
    var units   = project.UnitsInContext;
    return new()
    {
        Schema    = m.SchemaVersion.ToString(),
        Project   = project.Name,
        LongName  = project.LongName,
        Phase     = project.Phase,
        Sites     = m.Instances.CountOf<IIfcSite>(),
        Buildings = m.Instances.CountOf<IIfcBuilding>(),
        Storeys   = m.Instances.CountOf<IIfcBuildingStorey>(),
        Spaces    = m.Instances.CountOf<IIfcSpace>(),
    };
}
```

`CountOf<T>` 是个简单的扩展方法，对大模型用 `OfType<T>(false).Count()` 比 LINQ Count 更快。

## 6. 模型统计

```csharp
public static List<TypeStat> ExtractStats(IfcStore m)
{
    using var _ = m.BeginInverseCaching();
    return m.Instances.OfType<IIfcProduct>()
        .GroupBy(p => p.ExpressType.Name)
        .Select(g => new TypeStat(
            Type: g.Key,
            Count: g.Count(),
            External: g.Count(x => (x as IIfcWall)?.IsExternal() == true),
            TotalLength: g.Sum(x => x.GetQuantitySetValue<double>("Qto_WallBaseQuantities", "Length"))
        ))
        .OrderByDescending(s => s.Count)
        .ToList();
}
```

## 7. IDS 校验

```csharp
public async Task<IdsValidationResult> ValidateIds(IfcStore m)
{
    var rules = "rules.ids";
    var result = await _ids.ValidateAgainstIdsAsync(m, rules, _log,
        verbosity: ValidationOptions.IncludePassed);
    return result;
}
```

把 `ExecutedRequirements` 中失败项汇总，写成报告：

```csharp
var failed = result.ExecutedRequirements
    .Where(r => r.Status == ValidationStatus.Fail)
    .GroupBy(r => r.Specification.Name);
foreach (var g in failed)
{
    _log.LogWarning("[FAIL] {Spec} : {Count}", g.Key, g.Count());
    foreach (var f in g.Take(10))
        _log.LogWarning("    #{Id} {Reason}", f.TestedEntity?.EntityLabel, f.Reason);
}
```

## 8. COBie 抽取

```csharp
public string ExtractCobie(IfcStore m, string outPath)
{
    using var cobie = new CobieModel();
    using (var txn = cobie.BeginTransaction("From IFC"))
    {
        var ex = new IfcToCoBieExpressExchanger(m, cobie);
        ex.Convert();
        txn.Commit();
    }
    cobie.ExportToTable(outPath, out var report);
    File.WriteAllText(Path.ChangeExtension(outPath, ".cobie.log"), report);
    return outPath;
}
```

## 9. 几何转换 + Wexbim

```csharp
public string ConvertGeometry(IfcStore m, string wexbimPath)
{
    var ctx = new Xbim3DModelContext(m);
    ctx.CreateContext(progDelegate: (p, msg) => _log.LogDebug("Geom {P}% {Msg}", p, msg));

    using var fs = File.Create(wexbimPath);
    using var bw = new BinaryWriter(fs);
    m.SaveAsWexBim(bw);

    return wexbimPath;
}
```

只在 Windows + x64 下运行。如果服务部署在 Linux，可以把这一步外包给一个 Windows worker。

## 10. 把失败项导成 BCF

```csharp
public string WriteBcfIssues(IdsValidationResult res, string bcfPath)
{
    var bcf = new BCFv21.BCFFile();
    int i = 1;
    foreach (var r in res.ExecutedRequirements.Where(r => r.Status == ValidationStatus.Fail))
    {
        var topic = new BCFv21.BCFTopic
        {
            Markup = new()
            {
                Topic = new()
                {
                    Title = $"[{r.Specification.Name}] failed",
                    Description = r.Reason,
                    TopicStatus = "Open",
                    CreationDate = DateTime.UtcNow,
                    Guid = Guid.NewGuid().ToString(),
                },
                Comments = { }
            },
            Viewpoints =
            {
                // 可以在此挂上 GUID -> ProductLabel 的相机视点
            }
        };
        bcf.Topics.Add(topic);
        i++;
    }

    using var fs = File.Create(bcfPath);
    bcf.Serialize(fs);
    return bcfPath;
}
```

## 11. HTML 报告

最简单的方式是用 [Razor](https://learn.microsoft.com/aspnet/core/mvc/views/razor) 或字符串模板拼一个静态 HTML，包含：

- 项目基本信息卡；
- 类型统计表；
- IDS 失败列表（按规则分组，可点击展开）；
- 嵌入 Xbim.WebUI 加载 `model.wexbim`；
- 下载按钮：cobie.xlsx、issues.bcfzip、原始 ifc。

这部分代码与具体 UI 框架相关，此处略。建议把 wexbim 与 webui 资源一并复制到 `_bimqa/web/`，HTML 中用相对路径引用。

## 12. 部署架构建议

如果要从一次性脚本演进到企业级服务：

```
[Web UI]  ──>  [Web API (ASP.NET Core)]  ──>  [Queue (Azure Service Bus / RabbitMQ)]
                                           │
                                           ▼
                                  [Worker (Windows x64)]
                                  - Xbim.Essentials
                                  - Xbim.Geometry (OCCT)
                                  - Xbim.IDS.Validator
                                  - Xbim.CobieExpress
                                           │
                                           ▼
                              [Object Storage] + [Cosmos DB / PostgreSQL]
```

要点：

- **Worker 必须 Windows x64**（几何引擎限制）；
- **解耦异步**：模型转换可能数十分钟，必须走队列；
- **缓存 .xbim**：同一模型版本只转一次，后续只取缓存；
- **审计日志**：记录每次校验、谁触发、规则版本，方便追溯。

## 13. 未来扩展方向

学完本教程后，你可以按以下路线深入：

1. **支持 IFC4x3 基础设施模型**：桥、隧道、铁路、公路、水利。Xbim.Ifc4x3 已经覆盖，业务侧需编写专门的提取与可视化规则。
2. **接入 IDS 编辑器**：让业主直接在 Web UI 拖拽生成 `.ids`，自动跑校验。
3. **多模型对比**：使用 GlobalId 做"同一构件版本对比"，输出修改集。
4. **碰撞检测**：用 Xbim.Geometry + OCCT 的布尔交集实现轻量碰撞检查；或集成 [Octree](https://github.com/Open-Cascade-SAS/OCCT) 索引加速。
5. **GraphQL API**：把 IFC 关系网络暴露为 GraphQL，前端可灵活查询。
6. **glTF 导出**：把 wexbim 转 glTF 2.0，对接 Babylon.js / Three.js 等通用引擎。
7. **AI 增强**：用 LLM 解析自然语言规则 → 生成 IDS；或用机器学习做模型分类、构件命名规范化。

## 14. 学习资源汇总

- [`xBimTeam`](https://github.com/xBimTeam) GitHub 组织
- [Xbim 官网](https://xbimteam.github.io/) / [文档站点](https://docs.xbim.net/)
- [`XbimSamples`](https://github.com/xBimTeam/XbimSamples) 示例代码集
- [buildingSMART 标准首页](https://www.buildingsmart.org/standards/)
- [IFC 4 文档](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/)
- [IFC 4x3 文档](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/)
- [IDS 标准](https://github.com/buildingSMART/IDS)
- [BCF 标准](https://github.com/buildingSMART/BCF-XML)
- [Open CASCADE 官网](https://www.opencascade.com/) / [OCCT 仓库](https://github.com/Open-Cascade-SAS/OCCT)
- [IfcOpenShell](https://ifcopenshell.org/)（对照学习）

## 15. 总结

通过 16 章的学习，我们：

- 理解了 IFC、EXPRESS、STEP21 三层标准的关系；
- 掌握了 `Xbim.Essentials` 中 `IfcStore` + `IModel` + LINQ 的应用层用法；
- 熟悉了 `Xbim.Geometry` 与 OCCT 的几何处理流程；
- 学会用 Wexbim + Xbim.WebUI / Xbim.Presentation 做 3D 可视化；
- 接入了 IDS、BCF、COBie 三大 Open BIM 标准；
- 完成了一个端到端的 BIM 质量平台实例。

Xbim 不只是"读 IFC 的库"，而是 .NET 生态中最完整的 Open BIM 工具集。希望本教程能帮助你在 BIM 二次开发的道路上走得更远，也欢迎参与到 [`xBimTeam`](https://github.com/xBimTeam) 的开源贡献中。

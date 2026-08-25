---
layout: default
title: 第09章：Ara3D-Studio插件开发
---

# 第09章：Ara3D Studio 插件开发

Ara3D Studio 是一个交互式三维创作应用，其强大之处在于**用 C# 脚本扩展**：你写一个实现特定接口的类，Studio 就把它变成一个可交互的节点/命令，参数自动生成 UI。本章讲解 `Ara3D.Studio.API` 的接口体系、`FlowObject` 数据流模型、特性驱动的参数 UI，以及 5 种常见插件范式。

## 1. 插件的本质

Studio 插件是一个普通 C# 类库，引用 `Ara3D.Studio.API`，实现其中某个接口（如 `IScriptedComponent`）。Studio 通过反射发现这些类型，把公有属性转成参数控件，运行时调用你的 `Eval`/`Modify` 等方法生成或改造几何。核心理念：**声明式参数 + 纯函数式求值**。

## 2. Studio.API 接口体系

```csharp
// 脚本组件：生成或修改内容的节点
public interface IScriptedComponent
{
    FlowObject Eval(EvalContext context, FlowObject input);
}

// 资产与来源
public interface IAsset       { string Name { get; } }
public interface IAssetSource { IEnumerable<IAsset> GetAssets(); }
public interface ILoader   : IScriptedComponent { }   // 从文件/来源加载
public interface IGenerator: IScriptedComponent { }   // 无输入，纯生成
public interface IModifier : IScriptedComponent { }   // 修改输入

// 导出与命令
public interface IExporter { void Export(FlowObject obj, string path); }
public interface IScriptedCommand { void Execute(IHostApplication app); }
public interface IModelCommand   { IModel3D Execute(IModel3D model); }
public class     SimpleCommand : IScriptedCommand { /* 便捷基类 */ }

// 工具与动画
public interface ITool     { /* 视口交互工具 */ }
public interface IAnimated { void Update(double time); }
```

三种“生成器/修改器”语义：`IGenerator`（凭空造）、`IModifier`（改造上游）、`ILoader`（从外部读）。它们都归约到 `IScriptedComponent.Eval`。

## 3. FlowObject——数据流对象

节点之间传递的是 `FlowObject`——一个把**内容、表现、属性、附件**打包在一起的不可变对象：

```csharp
public class FlowObject
{
    public object                        Content      { get; }  // 主数据（如 IModel3D）
    public PresentationData              Presentation { get; }  // 显示相关
    public IReadOnlyList<FlowAttribute>  Attributes   { get; }  // 参数值
    public IReadOnlyList<FlowAttachment> Attachments  { get; }  // 附加数据

    // 不可变 —— With* 返回副本
    public FlowObject WithContent(object content);
    public FlowObject WithPresentation(PresentationData p);
    public FlowObject WithAttributes(IReadOnlyList<FlowAttribute> a);
    public FlowObject WithAttachment(FlowAttachment a);
}
```

配套类型：`FlowAttribute`（名/值/类型）、`FlowTypes`（类型系统）、`EvalContext`（求值上下文：时间、随机源、宿主服务）、`IHostApplication`（宿主应用 API）、`AssetSource`、`CameraState`。

## 4. 特性驱动的参数 UI

Studio 自动为组件的公有属性生成控件；用特性精细控制：

| 特性 | 作用 |
| --- | --- |
| `[Category("...")]` | 分组归类 |
| `[Range(min, max)]` | 数值滑条范围 |
| `[Options(nameof(Prop))]` | 下拉选项（引用一个提供选项的属性/方法） |
| `[Animated]` | 该参数可随时间动画 |
| `[OnDemand]` | 仅在需要时求值（惰性/开销大的计算） |

```csharp
public class MyGenerator : IGenerator
{
    [Category("尺寸"), Range(0.1f, 10f)]
    public float Radius { get; set; } = 1f;

    [Category("尺寸"), Range(3, 128)]
    public int Segments { get; set; } = 32;

    [Options(nameof(GetShapes))]
    public string Shape { get; set; } = "Cylinder";
    public string[] GetShapes() => new[] { "Cylinder", "Cone", "Torus" };

    public FlowObject Eval(EvalContext ctx, FlowObject input)
    {
        var mesh = /* 用 Radius/Segments/Shape 造几何 */;
        return input.WithContent((IModel3D)mesh);
    }
}
```

## 5. 五种常见插件范式

### 范式一：纯生成器（Generator）

无输入，凭参数造几何。示例项目里的 `MeshGenerators`（Cylinder、Cone、Torus、Sphere、Box 等）：

```csharp
public class TorusGenerator : IGenerator
{
    [Range(0.1f, 10f)] public float MajorRadius { get; set; } = 2f;
    [Range(0.1f, 5f)]  public float MinorRadius { get; set; } = 0.5f;
    [Range(3, 128)]    public int   Segments    { get; set; } = 48;

    public FlowObject Eval(EvalContext ctx, FlowObject input)
    {
        TriangleMesh3D torus = SurfaceMeshes.Torus(MajorRadius, MinorRadius, Segments, Segments);
        return input.WithContent((IModel3D)torus);
    }
}
```

### 范式二：类型化修改器（typed Modifier）

改造上游几何。`Deformers` 里的 `TwistDeformer`、`Push`：

```csharp
public class TwistDeformer : IModifier
{
    [Range(-180f, 180f)] public float AnglePerUnit { get; set; } = 30f;

    public FlowObject Eval(EvalContext ctx, FlowObject input)
    {
        var model = (IModel3D)input.Content;
        var twisted = model.Deform(p =>
        {
            var a = (p.Y * AnglePerUnit).Radians;
            var (s, c) = (a.Sin, a.Cos);
            return new Point3D(p.X * c - p.Z * s, p.Y, p.X * s + p.Z * c);
        });
        return input.WithContent(twisted);
    }
}
```

### 范式三：FlowObject 修改器

不仅改内容，还改表现/属性/附件（例如着色、打标签）：

```csharp
public class Colorize : IModifier
{
    [Category("外观")] public Color Color { get; set; } = new(1, 0, 0, 1);

    public FlowObject Eval(EvalContext ctx, FlowObject input)
    {
        var model = ((IModel3D)input.Content)
                    .WithInstances(inst => inst.WithColor(Color));
        return input.WithContent(model)
                    .WithPresentation(input.Presentation);
    }
}
```

### 范式四：上下文感知 / 动画生成器

用 `EvalContext` 的时间做动画，配合 `[Animated]`：

```csharp
public class PulsingSphere : IGenerator, IAnimated
{
    [Range(0.1f, 5f), Animated] public float BaseRadius { get; set; } = 1f;
    public double Time { get; private set; }
    public void Update(double time) => Time = time;

    public FlowObject Eval(EvalContext ctx, FlowObject input)
    {
        var r = BaseRadius * (1 + 0.2f * (float)Math.Sin(ctx.Time * 2));
        return input.WithContent((IModel3D)SurfaceMeshes.Sphere(r, 32, 32));
    }
}
```

### 范式五：命令（Command）

对场景执行一次性操作，不参与数据流：

```csharp
public class SelectLargeElements : SimpleCommand
{
    public override void Execute(IHostApplication app)
    {
        var model = app.CurrentModel;
        var big = model.Where(inst => inst.Bounds.Volume > 10);
        app.Select(big);
    }
}
```

## 6. 更多示例参考

示例项目里覆盖了丰富的生成/修改模式，值得直接阅读源码模仿：

- **MeshGenerators**：Cylinder / Cone / Torus / Sphere / Box / Plane 等；
- **Deformers**：TwistDeformer、Push（沿法线推移）；
- **Transformers**：平移/旋转/缩放/阵列；
- **PlaneCut**：用平面裁剪模型；
- **Stairs**：参数化楼梯（踏步数、踏面、踢面）；
- **Fractal**：L 系统/递归分形，展示实例化威力；
- **RoofBeams**：屋架梁生成，演示 `Model3DBuilder` 实例化装配。

## 7. 开发与调试建议

- 组件类保持**无副作用**：`Eval` 只依赖输入 + 参数，返回新 `FlowObject`；
- 参数属性给合理默认值和 `[Range]`，Studio 才能生成友好 UI；
- 开销大的计算标 `[OnDemand]`，避免每帧重算；
- 需要动画就实现 `IAnimated` 并给相关参数打 `[Animated]`；
- 善用第 05/06 章的几何 API（`SurfaceMeshes`、`PlatonicSolids`、`Deform`、`Model3DBuilder`）。

## 8. 本章小结

- Studio 插件 = 实现 `Ara3D.Studio.API` 接口的普通 C# 类，参数 UI 自动生成；
- 核心接口：`IScriptedComponent`（`Eval`）及其语义化子接口 `IGenerator`/`IModifier`/`ILoader`，以及 `IExporter`/`IScriptedCommand`/`ITool`/`IAnimated`；
- `FlowObject` 是不可变的数据流载体（内容/表现/属性/附件），用 `With*` 演进；
- `[Category]`/`[Range]`/`[Options]`/`[Animated]`/`[OnDemand]` 特性驱动 UI 与求值行为；
- 五种范式：生成器、类型化修改器、FlowObject 修改器、动画生成器、命令。

下一章是压轴——二次开发实战：Bowerbird 实时脚本、Revit 插件、以及完整的构建/测试/发布工作流。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/ara3d-sdk/第08章-BIM与IFC数据处理/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/3d/ara3d-sdk/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/3d/ara3d-sdk/第10章-二次开发实战构建测试与发布/" style="text-decoration: none;">下一章 →</a>
</div>

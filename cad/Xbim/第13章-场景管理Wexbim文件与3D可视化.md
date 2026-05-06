---
layout: default
title: 第13章：场景管理Wexbim文件与3D可视化
---

# 第13章：场景管理、Wexbim 文件与 3D 可视化

把 IFC 模型显示在屏幕上是大多数 BIM 应用的核心需求。本章梳理 Xbim 提供的可视化方案：桌面端的 `Xbim.WindowsUI`（基于 WPF）、浏览器端的 `Xbim.WebUI`（基于 WebGL/TypeScript），以及它们共同依赖的中间格式 **Wexbim**。

## 1. 整体数据流

```
.ifc / .ifcXML / .ifcZIP
       │ Xbim.IO + Xbim.Ifc
       ▼
   IfcStore (in-memory 或 .xbim Esent)
       │ Xbim.ModelGeometry.Scene + Xbim.Geometry.Engine
       ▼
   GeometryStore（嵌入 .xbim） / .wexbim 文件
       │ Xbim.Presentation (WPF) 或 Xbim.WebUI (WebGL)
       ▼
   3D 视图、漫游、剖切、拾取
```

## 2. Wexbim 文件结构

`.wexbim`（Web XBIM）是 Xbim 设计的紧凑二进制几何流，专为渲染优化：

- **Header**：版本、单位、世界包围盒；
- **Regions**：区域划分（一个 region 是一束相邻几何，方便视锥剔除）；
- **ShapeGeometries[]**：去重的几何条目（顶点/法线/索引/包围盒/表面样式）；
- **ShapeInstances[]**：每个产品 → (`IfcProductLabel`、变换矩阵、引用的 ShapeGeometry id、style id)；
- **Styles[]**：颜色、透明、镜面参数。

设计要点：

1. **几何与实例分离**：1000 扇相同窗只存一份几何 + 1000 个 4×4 矩阵；
2. **按区域分桶**：渲染端可只解析视野内的 region；
3. **流式读取**：不必一次性载入整 wexbim；
4. **轻量** TS/WebAssembly 解析器即可使用。

`Xbim.WindowsUI` 与 `Xbim.WebUI` 共用同一份 wexbim，这是 Xbim 的关键设计杠杆。

## 3. 生成 Wexbim：服务器/批处理端

```csharp
using Xbim.Ifc;
using Xbim.ModelGeometry.Scene;

using var model = IfcStore.Open(@"input.ifc");
var ctx = new Xbim3DModelContext(model);
ctx.CreateContext();          // 几何转换
model.SaveAs("output.xbim");  // 含 GeometryStore，无需单独 wexbim

// 同时另存为独立 wexbim：
using var fs = File.Create("output.wexbim");
using var bw = new BinaryWriter(fs);
model.SaveAsWexBim(bw);
```

`SaveAsWexBim` 是 `Xbim.ModelGeometry.Scene` 提供的扩展方法。生成的 `.wexbim` 比 `.ifc` 小 5–20 倍，加载比解析 IFC 快两个数量级。

## 4. WPF 桌面渲染：Xbim.WindowsUI

[`xBimTeam/XbimWindowsUI`](https://github.com/xBimTeam/XbimWindowsUI) 仓库主要程序集：

- **`Xbim.Presentation`**：核心 WPF 控件，含 `DrawingControl3D`（HelixToolkit 集成）；
- **`Xbim.Presentation.LayerStyling`**：按构件类型/材料/层 着色；
- **`XbimXplorer`**：完整桌面查看器（含菜单、属性面板、空间树）。

### 4.1 在自己 WPF 应用中嵌入

NuGet 添加 `Xbim.WindowsUI` 后：

```xml
<Window x:Class="MyApp.MainWindow"
        xmlns:xbim="http://schemas.xbim.com/Presentation">
  <Grid>
    <xbim:DrawingControl3D x:Name="View" />
  </Grid>
</Window>
```

```csharp
using var model = IfcStore.Open("model.ifc");
new Xbim3DModelContext(model).CreateContext();
View.Model = model;
View.ReloadModel(DrawingControl3D.ModelRefreshOptions.ViewPreserveSelection);
```

### 4.2 拾取与高亮

```csharp
View.SelectedEntityChanged += (s, e) =>
{
    var ent = View.SelectedEntity;
    if (ent != null)
        Console.WriteLine($"选中 {ent.GlobalId} {ent.Name}");
};
```

### 4.3 视图操作

`DrawingControl3D` 暴露：

- `Viewport`（HelixToolkit `HelixViewport3D`）；
- `ZoomSelected()` / `ZoomExtents()`；
- 剖切：`SetCutPlane(...)` / `ClearCutPlane()`；
- 显示/隐藏类型：`HiddenInstances`、`IsolateInstances`；
- 颜色覆盖：`OverrideColor(IfcType, Color)`。

### 4.4 XbimXplorer：调试利器

直接下载 `XbimXplorer.exe` 打开任意 IFC：

- 树状空间结构 + 属性面板；
- 直接看每个实体的 STEP21 行；
- 内置 STEP21 文本编辑器（高级模式）；
- 支持 IFC + wexbim + xbim；
- 插件机制：自己写 Plugin DLL 即可挂菜单项。

学习 Xbim 时，建议**在 IDE 里写代码 + XbimXplorer 里观察**，效率事半功倍。

## 5. 浏览器渲染：Xbim.WebUI

[`xBimTeam/XbimWebUI`](https://github.com/xBimTeam/XbimWebUI) 是用 TypeScript + WebGL 实现的浏览器端查看器。

### 5.1 安装

```bash
npm install @xbim/webui
```

或直接引用 release 中的 `xbim-viewer.bundle.js`。

### 5.2 最小示例

```html
<!DOCTYPE html>
<canvas id="viewer" width="800" height="600"></canvas>
<script src="xbim-viewer.bundle.js"></script>
<script>
  const viewer = new xBimViewer.Viewer('viewer');
  viewer.background = [0xff, 0xff, 0xff, 0xff];
  viewer.loadAsync('model.wexbim').then(() => {
    viewer.start();
    viewer.show(xBimViewer.ViewType.DEFAULT);
  });
</script>
```

`Viewer.loadAsync` 会通过 `fetch` 拉取 `.wexbim`，在 worker 中解析后上传到 GPU buffer。无 jQuery、无 React 依赖，适合嵌入任何 Web 框架。

### 5.3 主要 API

- **加载**：`load`、`loadAsync`、多模型 `loadFromUrl(url, tag)`；
- **相机**：`show(ViewType)`、`zoomTo(productId)`；
- **样式**：`setState(state, ids)`（高亮 / 隐藏 / X 光 / 半透明）；
- **拾取**：`getID(x, y)` 返回鼠标位置下的 product id；
- **剖切**：`addClippingPlane(plane)`；
- **测量**：第三方插件 `xbim-viewer-measurement-plugin`；
- **事件**：`'pick'`、`'mouseDown'`、`'loaded'`、`'fps'`。

### 5.4 与 React/Vue 集成

把 `Viewer` 作为 ref 持有的纯 JS 对象，在 `useEffect` 里初始化 + 在 cleanup 里 `viewer.stop()` 即可。Web 端常见模式：

- 模型上传 → 服务器后端用 Xbim 转换 → 推送 `.wexbim` URL；
- 浏览器加载并展示；
- 拾取后通过 `productId` 调用后端拉属性。

## 6. 多模型联动

`xBim.Viewer` 与 `Xbim.Presentation` 都支持加载多份模型并叠加显示：

```csharp
// WPF
View.Models.Add(new XbimReferencedModel(architecturalModel));
View.Models.Add(new XbimReferencedModel(structuralModel));
```

```js
// Web
viewer.loadAsync('arch.wexbim', 'arch');
viewer.loadAsync('mep.wexbim', 'mep');
```

可以做架构、结构、机电三专业叠合检查，配合 `IfcRelInterferesElements` 处理碰撞。

## 7. 联调：从 IFC 到 Web 查看器的最短路径

服务器端（C#）：

```csharp
public ActionResult<FileResult> Convert(IFormFile ifc)
{
    var tmp = Path.GetTempFileName();
    using (var fs = System.IO.File.Create(tmp))
        ifc.CopyTo(fs);

    using var model = IfcStore.Open(tmp);
    new Xbim3DModelContext(model).CreateContext();

    var output = Path.ChangeExtension(tmp, ".wexbim");
    using (var ow = new BinaryWriter(System.IO.File.Create(output)))
        model.SaveAsWexBim(ow);

    return PhysicalFile(output, "application/octet-stream", "model.wexbim");
}
```

前端：

```js
const file = e.target.files[0];
const fd = new FormData();
fd.append('ifc', file);
const r = await fetch('/api/convert', { method: 'POST', body: fd });
const blob = await r.blob();
const url = URL.createObjectURL(blob);
viewer.loadAsync(url);
viewer.start();
```

## 8. 性能调优

可视化大模型（>500MB IFC，>5M 三角形）的常见手段：

1. **预生成 wexbim 并 CDN 化**：浏览器端永远不直接处理 IFC；
2. **分区下载**：用空间树拆 wexbim，按需加载某些楼层；
3. **LOD**：对相同几何使用不同 deflection 三角化得到多套 wexbim；
4. **细节剔除**：`Xbim3DModelContext` 时跳过 `IfcSpace`、`IfcAnnotation` 等不必显示的类型；
5. **WebUI 端开启 instance rendering**：`viewer.useInstancedRendering = true`，对 `IfcMappedItem` 大量复用的几何效果显著；
6. **避免巨型单几何**：把"复杂屋顶"切分为若干 representation 让 GPU 并行剔除。

## 9. 自定义着色与剖切

`Xbim.Presentation.LayerStyling` 提供若干 `LayerStyler`：

- `LayerStylerType`：按 IFC 类型上色；
- `LayerStylerProperty`：按 PSet 属性上色（例如按"防火等级"上不同颜色）；
- `LayerStylerStorey`：按楼层上色。

也可以继承 `BaseLayerStyler` 写自己的样式器，挂到 `DrawingControl3D.LayerStyler`。

剖切：

```csharp
View.SetCutPlane(new XbimVector3D(0, 0, 1), new XbimPoint3D(0, 0, 3000));
```

WebUI：

```js
viewer.addClippingPlane({normal: [0,0,1], offset: 3000});
```

## 10. 渲染的可访问性与扩展

Xbim.WebUI 提供：

- 键盘导航（focus 进入 canvas 后 ↑↓←→ 旋转）；
- WAI-ARIA 友好的容器；
- 触屏支持（双指旋转/缩放）。

XbimXplorer 也对应有键盘快捷键。建议在企业项目中保留这些行为，方便辅助工具用户。

## 11. 与第三方渲染管线集成

如果不想用 Xbim 内置查看器，可用以下路径：

- **Three.js**：解析 `.wexbim` 为 Geometry/InstancedMesh（社区有相关 demo）；
- **Unity**：以 wexbim 或 IFC 为输入，写自己的解析；
- **Unreal**：通过 `IfcOpenShell` 或 `Xbim` 转 glTF 后导入；
- **AutoCAD/Revit**：内嵌 WPF 控件（DrawingControl3D），桌面集成。

这就是为什么"几何抽象 + 通用 wexbim 中间层"的设计这么有价值。

## 12. 小结

- Wexbim 是 Xbim 在 IFC 与渲染之间的关键中间格式；
- 桌面用 `Xbim.Presentation` (WPF + HelixToolkit)，浏览器用 `Xbim.WebUI` (WebGL/TypeScript)；
- 大模型务必走"服务器转换 + CDN 分发 + 客户端流式渲染"路径；
- LayerStyler、Clipping、多模型联动是 BIM 工具最常用的高阶功能。

下一章开始进入 Open BIM 生态的其他主流模块：COBie、IDS、BCF。

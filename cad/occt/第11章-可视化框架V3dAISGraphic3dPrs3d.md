---
layout: default
title: 第11章：可视化框架 V3d AIS Graphic3d Prs3d
---

# 第11章：可视化框架 V3d / AIS / Graphic3d / Prs3d

OCCT 自带功能完整的 3D 可视化体系，能够直接渲染 B-Rep、网格、辅助元素，支持选择、拾取、动画、PBR 材质、剖切、注释。它由多个工具包协作：

- `Aspect`：与窗口、显示连接的抽象；
- `Graphic3d`：渲染层抽象（视图、相机、灯光、材质、结构体）；
- `OpenGl`：OpenGL/Vulkan 后端；
- `V3d`：高层视图与查看器；
- `Prs3d`：呈现属性（线宽、颜色、显示模式参数）；
- `StdPrs`：标准对象的显示算法；
- `SelectMgr`：拾取与选择管理；
- `AIS`（Application Interactive Services）：交互对象与上下文。

本章按从底到顶的顺序梳理，并给出 Qt 集成示例。

## 1. 体系总览

```
应用代码 → AIS_InteractiveContext → AIS_InteractiveObject → Prs3d/StdPrs 显示算法
                                                          ↘
                                                            Graphic3d_Structure → V3d_View → OpenGl_Driver → GPU
```

`AIS` 是日常开发面向的 API；`V3d_View` 控制相机/视口；`Graphic3d_Structure` 是后端绘制单元；`OpenGl` 实现具体绘制。

## 2. 创建 Viewer 与 View

```cpp
Handle(Aspect_DisplayConnection) dc = new Aspect_DisplayConnection();
Handle(OpenGl_GraphicDriver) drv = new OpenGl_GraphicDriver(dc);
Handle(V3d_Viewer) viewer = new V3d_Viewer(drv);
viewer->SetDefaultLights();
viewer->SetLightOn();

Handle(V3d_View) view = viewer->CreateView();
Handle(Aspect_Window) win = new Xw_Window(dc, "demo", 0, 0, 800, 600);
view->SetWindow(win);
if (!win->IsMapped()) win->Map();
view->MustBeResized();
view->FitAll();
```

平台差异：
- Windows：`WNT_Window`；
- Linux/X11：`Xw_Window`；
- macOS：`Cocoa_Window`；
- Qt：用 `QWindow::winId()`/`HWND` 包装；
- Web/Emscripten：`Wasm_Window`。

## 3. AIS Context

```cpp
Handle(AIS_InteractiveContext) ctx = new AIS_InteractiveContext(viewer);
ctx->SetDisplayMode(AIS_Shaded, false);
Handle(AIS_Shape) ais = new AIS_Shape(shape);
ctx->Display(ais, true);
ctx->SetColor(ais, Quantity_Color(Quantity_NOC_GREEN), false);
ctx->SetMaterial(ais, Graphic3d_NameOfMaterial_Aluminium, false);
```

`AIS_InteractiveContext` 管理：
- 对象的显示/隐藏；
- 选择高亮；
- 显示模式切换（shaded/wireframe/HLR）；
- 局部上下文（OCCT 7.6 起统一为 SelectionMode）；
- 拾取过滤；
- 视图回调。

## 4. 常用交互对象 `AIS_InteractiveObject`

派生类：
- `AIS_Shape`：B-Rep；
- `AIS_Point`、`AIS_Line`、`AIS_Plane`、`AIS_Triangulation`：几何元素；
- `AIS_TextLabel`、`AIS_Dimension`、`AIS_Trihedron`、`AIS_Axis`、`AIS_Manipulator`：注释/操控；
- `AIS_ViewCube`：视图导航立方体；
- `AIS_LightSource`：光源；
- `AIS_RubberBand`、`AIS_Selection`：辅助；
- `AIS_ConnectedInteractive`：实例化（共享同一显示数据）。

自定义对象继承 `AIS_InteractiveObject`，重写 `Compute(...)`、`ComputeSelection(...)` 即可。

## 5. 显示模式与 Prs3d

`AIS_DisplayMode`：`AIS_WireFrame`、`AIS_Shaded`，部分对象支持自定义模式（HLR、剖面）。
`Prs3d_Drawer` 控制显示属性：
- 线型 `Prs3d_LineAspect`；
- 面阴影 `Prs3d_ShadingAspect`；
- 边线 `Prs3d_LineAspect FaceBoundaryAspect`；
- 选择高亮 `Prs3d_IsoAspect`。

```cpp
Handle(Prs3d_Drawer) d = ais->Attributes();
d->SetFaceBoundaryDraw(true);
d->SetFaceBoundaryAspect(new Prs3d_LineAspect(Quantity_NOC_BLACK, Aspect_TOL_SOLID, 1.0));
ctx->Redisplay(ais, true);
```

## 6. 材质、灯光、PBR

`Graphic3d_MaterialAspect` 提供经典 Phong 材质（环境/漫反射/镜面/高光），`Graphic3d_PBRMaterial`（OCCT 7.5+）支持基于物理的渲染：金属度、粗糙度、IOR、贴图。

打开 PBR：
```cpp
Graphic3d_RenderingParams& p = view->ChangeRenderingParams();
p.Method = Graphic3d_RM_RAYTRACING;        // 或 Graphic3d_RM_RASTERIZATION
p.IsShadowEnabled = true;
p.IsAntialiasingEnabled = true;
p.IsGlobalIlluminationEnabled = true;
p.UseEnvironmentMapBackground = true;
view->Redraw();
```

`V3d_Viewer::SetLightOn` 添加光源；`AIS_LightSource` 在交互场景中可移动。

## 7. 选择与拾取

`SelectMgr_SelectionManager` 维护一组 `SelectMgr_Selection`，每个交互对象在不同选择模式下计算自己的 `SensitiveEntity`（点、面、网格）。

```cpp
ctx->Activate(ais, /*mode*/4);   // 4 通常表示面（顶点 1，边 2，wire 3，face 4，shell 5，solid 6）
ctx->MoveTo(x, y, view, true);
ctx->Select(false);
for (ctx->InitSelected(); ctx->MoreSelected(); ctx->NextSelected()) {
    Handle(AIS_InteractiveObject) o = ctx->SelectedInteractive();
    TopoDS_Shape s = ctx->SelectedShape();
}
```

支持矩形/多边形选择、过滤器（`SelectMgr_Filter`）、动态高亮。

## 8. 相机与视图

`V3d_View` 提供：
- `FitAll`、`ZoomAtPoint`、`SetSize`；
- `Pan`、`Rotation`、`StartRotation`；
- `SetProj(V3d_TypeOfOrientation)` 视图方向；
- `Camera()` 直接拿到 `Graphic3d_Camera`，控制透视/正交、焦距、视野。

## 9. 视图工具

`AIS_ViewCube` 提供右上角导航立方体；`V3d_Trihedron` 显示坐标轴；`Aspect_GradientFillMethod` 设置渐变背景；`V3d_View::SetBackgroundColor` 单色背景；`V3d_View::SetBackgroundImage` 图片背景。

## 10. 注释与剖切

- `AIS_Dimension`（继承自 PrsDim）：长度、角度、半径、直径标注；
- `AIS_Manipulator`：交互拖拽对象，绑定到 AIS 对象；
- `Graphic3d_ClipPlane`：动态剖切平面，可附加到视图或对象。

```cpp
Handle(Graphic3d_ClipPlane) cp = new Graphic3d_ClipPlane(gp_Pln(gp_Pnt(0,0,50), gp_Dir(0,0,1)));
cp->SetCapping(true);
cp->SetCappingColor(Quantity_NOC_RED);
view->AddClipPlane(cp);
```

## 11. 高级渲染特性

- 阴影（光源 → 视图开启）；
- 抗锯齿（FSAA、SSAA）；
- 屏幕空间环境光遮蔽 SSAO；
- 雾化、深度剪裁；
- 离屏渲染 `V3d_View::ToPixMap` 截图；
- 交互式光线追踪 `Graphic3d_RM_RAYTRACING`，需要 GPU 支持。

## 12. Qt 集成

OCCT 仓库 `samples/qt/Common` 提供 `OcctView` 模板。要点：
- `QWidget::winId()` 返回原生句柄，包装 `WNT_Window`/`Xw_Window`/`Cocoa_Window`；
- 在 `paintEvent` 调用 `view->Redraw()`；
- 鼠标/键盘事件转发到 `AIS_ViewController` 简化交互逻辑（OCCT 7.5 起内置）；
- 多 GL 上下文：使用 `Aspect_DisplayConnection` 共享。

## 13. 性能调优

- `Graphic3d_RenderingParams::FrustumCullingState` 启用视锥剔除；
- 对装配用 `AIS_ConnectedInteractive` 复用显示数据；
- 大模型使用 LOD（自定义 `AIS_InteractiveObject::AcceptDisplayMode` 配合细化）；
- 适当增大 `Linear deflection` 减少三角形；
- 关闭 `FaceBoundaryDraw` 可以加速；
- 使用 `V3d_View::SetImmediateUpdate(false)`，批量修改后再 `Redraw`。

## 14. 调试

- Draw：`vinit`、`vdisplay`、`vsetdispmode`、`vfit`、`vcamera`；
- `tools/VInspector` 调试 AIS/SelectMgr；
- `Graphic3d_FrameStats` 实时帧率/三角数；
- `Message_Messenger` 中 OpenGL 警告/错误。

## 15. 离屏 / Web

OCCT 7.6+ 支持 Vulkan + Web (Emscripten)：用 `samples/webgl` 作为起点，可把模型可视化嵌入浏览器。

可视化体系完成后，CAD 应用基本可以“可见可点”。下一章我们看 OCCT 强大的“数据交换”模块。

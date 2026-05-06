---
layout: default
title: 第17章：与 Qt VTK Python pythonOCC 生态集成
---

# 第17章：与 Qt / VTK / Python(pythonOCC) 等生态集成

OCCT 是 C++ 内核，它真正发挥威力往往需要与 GUI、可视化、脚本、应用框架结合。OCCT 官方 `samples/` 目录提供 Qt、MFC、C#、Java、Android、iOS、Web 等示例，社区还衍生了 pythonOCC、CadQuery、PyCAD、OcctGym 等绑定。本章介绍最常见的集成路径。

## 1. Qt + OCCT

Qt 是 OCCT 桌面端最常见搭档。仓库 `samples/qt/Tutorial`、`samples/qt/IESample`、`samples/qt/OCCTOverview`、`samples/qt/AISSelector` 提供成体系的示例。要点：

### 1.1 视图容器

- 自定义 `QWidget`/`QOpenGLWidget` 包装 `V3d_View`；
- 通过 `winId()` 获取原生句柄；构造 `WNT_Window`/`Xw_Window`/`Cocoa_Window`；
- 重写 `resizeEvent`/`paintEvent`/`mouseMoveEvent` 调用 `view->Redraw()`、`AIS_ViewController` 处理交互；
- OCCT 7.5+ 的 `AIS_ViewController` 大幅简化（含轨道相机、缩放、平移、矩形选择等）。

### 1.2 信号槽

- AIS 选择 → 发自定义信号 `selectionChanged(TopoDS_Shape)`；
- 事务 → 触发 `documentModified`；
- 长任务 → 用 `QtConcurrent` + `QFuture` + `Message_ProgressIndicator`。

### 1.3 资源与构建

- CMake 中同时 `find_package(Qt6 COMPONENTS Widgets OpenGLWidgets)` 与 `find_package(OpenCASCADE)`；
- 注意 Qt 与 OCCT 都引用 OpenGL，确保链接顺序；
- macOS Cocoa 需要在 `main` 中处理 NSAutoreleasePool。

### 1.4 高级 Qt 组件

- `QToolBox` + AIS 显示模式切换；
- `QDockWidget` 布置 `DFBrowser`/`ShapeView` 风格的检查面板；
- `QGraphicsView` 显示 2D 工程图；
- 与 Qt3D / QtQuick 3D 集成：通过 `QOpenGLContext::globalShareContext()` 共享上下文。

## 2. VTK + OCCT

VTK 强于科学可视化、流场、医疗。OCCT 提供 `IVtk*` 工具包：
- `IVtkOCC_Shape`、`IVtkOCC_ShapeMesher`：把 `TopoDS_Shape` 转为 `vtkPolyData`；
- `IVtkTools_ShapeDataSource`：作为 VTK pipeline 节点；
- `IVtkTools_ShapeObject`、`IVtkTools_ShapePicker`：选择拾取；

```cpp
auto src = vtkSmartPointer<IVtkTools_ShapeDataSource>::New();
src->SetShape(new IVtkOCC_Shape(shape));
auto m = vtkSmartPointer<vtkPolyDataMapper>::New();
m->SetInputConnection(src->GetOutputPort());
auto a = vtkSmartPointer<vtkActor>::New();
a->SetMapper(m);
renderer->AddActor(a);
```

适用场景：与 VTK 原有应用整合（仿真后处理 + CAD 模型）。日常 CAD 仍推荐 AIS。

## 3. Python：pythonOCC 与 cadquery

OCCT 的官方 SWIG 绑定历史多变；社区维护的 [pythonOCC](https://github.com/tpaviot/pythonocc-core) 是事实标准：

```python
from OCC.Core.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCC.Core.BRepAlgoAPI import BRepAlgoAPI_Fuse
from OCC.Display.SimpleGui import init_display

box = BRepPrimAPI_MakeBox(10, 20, 30).Shape()
display, start_display, _, _ = init_display()
display.DisplayShape(box, update=True)
start_display()
```

特点：
- 几乎一一映射 C++ API；
- 提供 `Display` 模块（基于 wxPython/PyQt + OpenGL）；
- 与 NumPy/SciPy 协作；
- 安装：`mamba install -c conda-forge pythonocc-core`。

CadQuery（参考本博客 `cad/cadquery`）在 pythonOCC 之上提供 Pythonic 流式 API，更适合参数化建模。

## 4. C# / .NET

社区方案：
- `OCCTProxy`、`OpenCascade.NET` 等 C++/CLI 包装；
- `Helix Toolkit` + 自实现 P/Invoke；
- WPF 中嵌入 OCCT View 需要原生窗口句柄包装。

OCCT 官方仓库的 `samples/CSharp` 给出 WPF 的最简集成示例。

## 5. Web：WebAssembly

OCCT 7.6+ 支持 Emscripten 编译，社区项目：
- `chevrotain/occt-import-js`：基于 Emscripten 的 STEP 读取器；
- `OCJS`、`opencascade.js`：完整 OCCT WASM 绑定；
- `cad-viewer-vue`、`three-occ` 桥接 Three.js。

构建步骤：
```bash
emcmake cmake .. -DBUILD_LIBRARY_TYPE=Static -DUSE_FREETYPE=OFF -DBUILD_MODULE_Visualization=OFF ...
emmake make -j
```

输出 `.wasm` + JS 胶水代码后通过 npm 包发布。注意 OCCT 体量大，WASM 通常 10–30 MB，需分模块按需加载。

## 6. CAD 应用：FreeCAD、CAD Assistant、Salome

- **FreeCAD**：将 OCCT 用作几何内核，本博客 `cad/FreeCAD/` 给出完整教程；
- **CAD Assistant**（Open Cascade 公司）：免费查看器，展示 STEP/glTF/IGES 能力；
- **Salome**：法国仿真平台，OCCT + GEOM + SMESH；
- **KiCad** 部分使用 OCCT 处理 3D 元件（STEP）；
- **Mayo**：开源 CAD 查看器，Qt + OCCT。

研究这些项目的源码是学习 OCCT“产品级用法”的捷径。

## 7. CAM / 仿真集成

- **CAM**：与 LinuxCNC、CAMotics 集成时通常导出 STL/STEP；OCCT 自带 `BRepOffset` 可生成偏置面，作为刀具路径的基础；
- **FEM**：`SMESH`（Salome 模块）以 OCCT shape 作为输入网格化；OCCT 的 `BRepGProp` 可提供质量属性。

## 8. AI / 大模型应用

近年新趋势：
- 用 LLM 生成 cadquery/PythonOCC 脚本，自动产出参数化模型；
- OCCT 提供稳定的几何/拓扑接口，适合作为 AI 输出的后端；
- 与 RAG/Agent 结合：把企业 CAD 数据通过 OCCT + XCAF 抽取为元数据，供 LLM 检索。

## 9. 与游戏引擎

- Unreal/Unity 直接消费 OCCT 输出的 glTF/STL，少量项目通过 P/Invoke 调用 OCCT；
- 游戏引擎通常不需要精确 B-Rep；建议 OCCT 端做几何处理后导出网格。

## 10. 容器与云部署

- Docker：基于 `debian:bookworm`，apt 安装 `libocct-*-dev`，COPY 自有应用；
- Kubernetes：把 OCCT 算法封装成 gRPC 服务（输入 STEP，输出 glTF），供前端调用；
- Headless：Linux 上需要 `Xvfb`（如果使用 V3d 截图），或 Vulkan offscreen。

## 11. 与 OpenCascadeCommunityEdition (OCE)

OCE 是 OCCT 的社区分支，长期已停止维护，新项目推荐直接使用 OCCT。文档/Issue 中遇到 OCE 名词时按 OCCT 等价 API 处理即可。

## 12. 跨内核兼容

OCCT 与商业内核（Parasolid、ACIS、CGM）通过中性格式（STEP/IGES/JT）交换；几何精度不同导致细节差异，转换后建议 `ShapeFix` + `BRepCheck`。

## 13. 文档生态

- Open Cascade Reference Manual（doxygen）；
- User Guides（按模块）；
- `dox/tutorial` 入门；
- 官方论坛（dev.opencascade.org）；
- Stack Overflow `[opencascade]` 标签；
- GitHub Discussions（仓库内）；
- 社区博客与本系列教程。

## 14. 选型建议

- 桌面 CAD/CAE：Qt + OCCT + OCAF；
- 仿真/科学：VTK + OCCT；
- 自动化建模 / DevOps：pythonOCC 或 cadquery；
- Web 查看器：OCCT WASM + Three.js / Babylon.js；
- 嵌入式：仅链接核心 toolkit + 网格预生成。

OCCT 的生态很丰富，选择正确组合可以让团队更快达成目标。下一章给出综合实战，把整个教程串成一个完整案例。

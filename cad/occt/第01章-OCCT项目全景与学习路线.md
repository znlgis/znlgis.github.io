---
layout: default
title: 第01章：OCCT项目全景与学习路线
---

# 第01章：OCCT 项目全景与学习路线

## 1. OCCT 是什么

Open CASCADE Technology（简称 OCCT）是一个开源的 C++ 三维 CAD/CAM/CAE 开发平台，由法国 Matra Datavision 在 1990 年代推出，2000 年开源，目前由 Open Cascade SAS 维护，仓库托管于 [Open-Cascade-SAS/OCCT](https://github.com/Open-Cascade-SAS/OCCT)。它不是一个面向最终用户的 CAD 软件，而是一组用于构建 CAD 应用的底层 SDK，提供从基础数学、几何/拓扑表达、建模算法、可视化到数据交换与应用框架的一整套构件。

围绕 OCCT 已经形成了庞大的生态：FreeCAD、CAD Assistant、KiCad（部分）、Salome、CadQuery、pythonOCC、ChiliCAD、Mayo、3DViewStation 等都直接或间接基于 OCCT。理解 OCCT 等于打开了进入 CAD 内核世界的大门。

## 2. 主要能力

OCCT 大致可以分为以下能力域，每个域都对应一组以 `T`（Toolkit）形式发布的工具包：

- **几何与拓扑内核**：B-Rep 边界表示、NURBS 曲线/曲面、`TopoDS_Shape` 拓扑、`Geom_*` 几何抽象、`gp_*` 数学基元。
- **建模算法**：从基本体（Box、Cylinder、Sphere、Torus、Cone）到布尔运算（BOPAlgo）、特征操作（圆角倒角、抽壳、偏置、扫掠、放样）、曲面填充、修复、简化。
- **可视化**：基于 OpenGL/Vulkan 的 `Graphic3d`、`OpenGl`、`V3d` 视图，`AIS` 交互层，`Prs3d` 表达层，`SelectMgr` 拾取与选择管理。
- **数据交换**：STEP、IGES、STL、OBJ、glTF、VRML、PLY、XBF/XCAF 等导入导出，支持几何、装配、PMI、属性。
- **应用框架（OCAF）**：参数化文档、撤销/重做、引用、命名稳定性、扩展属性、装配树、XCAF 工业数据交换。
- **网格化（BRepMesh）**：将精确 B-Rep 转换为三角网格供显示、3D 打印、有限元、可视化使用。
- **修复与简化（ShapeHealing/ShapeFix/ShapeUpgrade）**：导入数据修复、容差统一、缝合、面合并。
- **Draw 测试框架**：基于 Tcl 的脚本控制台，是回归测试、调试、教学、原型实验的核心工具。
- **数据修复与互操作**：`BRepCheck`、`ShapeAnalysis`、`ShapeProcess`、`UnitsAPI` 等。

## 3. OCCT 的版本与发布节奏

OCCT 的主版本以年度大版本（如 7.6、7.7、7.8、7.9、8.0）+ 小版本（patch）演进。仓库默认分支为 `master`，发布分支以 `IR` 或 `V7_x_y` 命名，正式版本通过 Git tag（例如 `V8_0_0`）发布。OCCT 8.0.0（2026年5月发布）是一个里程碑版本：以 C++17 为编译基线，引入了全新的 `occ` 命名空间（逐步替代 `opencascade` 命名空间），`Standard_Real` 全面过渡为 `double`，新增 TKHelix 模块、ODE（常微分方程求解）支持和 Light OCCT（轻量级构建）Beta。8.0.0 p1 补丁于 2026年6月发布。新版本通常会带来：

- 几何与拓扑算法的稳定性与性能提升（如 BOP 与圆角性能、并行化）；
- 数据交换格式扩展（STEP AP242、glTF 2.0、3MF、IFC 等的逐步增强）；
- 现代化的可视化（PBR 物理材质、阴影、动画、Vulkan/Metal 后端尝试）；
- C++ 标准提升（17、20）以及 CMake 体系完善；
- 新的工具包，例如近年的 `TKDEGLTF`、`TKDESTEP` 等数据交换重构。

学习时建议锁定一个稳定版本（例如 8.0.0 或 7.9.x），在掌握后再追踪 master 的新特性。

## 4. 仓库结构总览

OCCT 仓库根目录主要包含：

- `src/`：所有 C++ 源代码，每个工具包（toolkit）一个子目录，如 `gp/`、`Geom/`、`TopoDS/`、`BRepBuilderAPI/`、`BOPAlgo/`、`AIS/`、`Graphic3d/`、`STEPControl/`、`OCAF*` 等，超过 200 个工具包。
- `adm/`：构建系统辅助脚本与元数据，包括 `cmake/`、`templates/`、`UDLIST` 等，OCCT 的 toolkit/类列表大量由生成器维护。
- `dox/`：Doxygen 文档源（用户指南、参考手册）。
- `data/`：测试与示例使用的几何文件（STEP、IGES、BRep 等）。
- `tests/`：基于 Draw 的庞大回归测试集，按模块组织。
- `samples/`：C++、Qt、MFC、C#、Tcl、Java、Android、iOS 等示例工程。
- `tools/`：辅助工具如 `DFBrowser`、`MessageView`、`ShapeView`、`VInspector`，是调试 OCAF/拓扑/可视化的利器。
- `genproj` / CMake：负责生成 IDE 工程或跨平台构建脚本。

仓库根目录的 `README.md`、`OCCT_BUILD.md`、`overview.md`、`CONTRIBUTING.md` 等文件给出了构建、贡献、依赖说明，是首次接触必读的入口。

## 5. 模块层级与依赖关系

OCCT 的模块（Module）是工具包的集合，从上到下的依赖关系大致为：

1. **Foundation Classes (FoundationClasses)**：`Standard`、`TCollection`、`NCollection`、`TColStd`、`gp`、`Bnd`、`Quantity`、`Message`、`Resource` 等，是后续一切的基础。
2. **Modeling Data**：`Geom`、`Geom2d`、`GeomAdaptor`、`TopoDS`、`TopAbs`、`TopExp`、`BRep`、`BRepAdaptor`、`Poly` 等。
3. **Modeling Algorithms**：`GeomAPI`、`Geom2dAPI`、`BRepBuilderAPI`、`BRepPrimAPI`、`BRepAlgoAPI`、`BRepOffsetAPI`、`BRepFilletAPI`、`ChFi3d`、`BRepMesh`、`ShapeAnalysis/Fix/Upgrade` 等。
4. **Visualization**：`Aspect`、`Graphic3d`、`OpenGl`、`V3d`、`AIS`、`Prs3d`、`SelectMgr`、`StdPrs`、`MeshVS`。
5. **Data Exchange**：`STEPControl`、`IGESControl`、`StlAPI`、`RWGltf`、`RWObj`、`Vrml*`、`XCAFDoc`、`STEPCAF*`、`IGESCAF*`。
6. **Application Framework (OCAF)**：`TDF`、`TDocStd`、`TFunction`、`TPrsStd`、`AppStd`、`XmlOcaf`、`BinOcaf`、`XCAF`。
7. **Draw Test Harness**：`Draw`、`TestDraw`，以及各模块的 `*Test`（`BRepTest`、`AIS Test`、`XSDRAWSTEP` 等）。

理解依赖关系有助于按顺序学习：先底层数学，再几何与拓扑，再算法与可视化，最后数据交换与应用框架。

## 6. 编程范式

OCCT 是一个传统的 C++ 库，但它采用了若干独特的设计：

- **句柄（`Handle(T)`）**：除少数纯数据类型外，OCCT 对象通常通过引用计数智能指针 `Handle(T)` 操作，本质上是 `opencascade::handle<T>` 的别名，并由 `Standard_Transient` 提供基类。
- **`gp_*` 值类型**：点、向量、矩阵、坐标系等基础类是普通值类型，按值传递。
- **大量 BuilderAPI**：建模 API 多为构造一个临时算法对象，调用 `Build()`、`IsDone()` 后取出 `Shape()` 结果，这是 OCCT 风格的“算法即对象”。
- **`TopoDS_Shape` + 共享底层数据**：拓扑对象本身是值类型壳子，底层数据共享、可拷贝廉价。
- **错误处理**：早期使用异常 `Standard_Failure`，新代码倾向 `Message_Report` 与状态返回。需注意 `OCC_CATCH_SIGNALS` 宏与 SEH。
- **集合类**：`NCollection_*` 是模板化的容器，`TColStd_*`、`TColgp_*`、`TopTools_*` 是预实例化的常用集合。

适应 OCCT 风格需要时间，但只要把握“值类型 + 句柄 + Builder API”三件套即可上手。

## 7. 学习路线总览

针对不同背景，建议的学习路线如下：

**入门路线（4–6 周）**：
1. 阅读 `dox/overview/overview.md`，对模块全貌有印象。
2. 编译 OCCT，跑通 `Draw Test Harness` 与 `qt/Tutorial`、`qt/IESample` 示例。
3. 学习 `gp`、`Geom`、`Geom2d` 基础，理解点、向量、坐标系、曲线/曲面抽象。
4. 学习 `TopoDS`、`BRepBuilderAPI`、`BRepPrimAPI`、`BRepAlgoAPI`，能用 C++ 构造一个零件。
5. 学习 `AIS`、`V3d`，能在 Qt 程序中显示与拾取模型。

**进阶路线（2–3 个月）**：
1. 深入 `BRep`、`Geom`、`Adaptor`、`Approx`、`GeomFill`、`BRepFill`、`BRepOffsetAPI`，理解算法实现思路。
2. 学习 `BOPAlgo`、`BRepAlgoAPI`、`BRepFilletAPI`，掌握布尔运算与圆角倒角，理解参数与失败处理。
3. 学习 `BRepMesh`、`StlAPI`，理解离散化参数与精度。
4. 学习数据交换：STEP/IGES/glTF/OBJ，掌握 XCAF 的装配树、颜色、属性。
5. 学习 OCAF：构建一个具备撤销/重做、保存加载的小型参数化应用。

**精通路线（半年以上）**：
1. 阅读各模块 `dox/user_guides/*` 用户指南，对照 `src/` 源码与 `tests/` 测试用例。
2. 用 Draw 脚本调试算法、复现回归用例、提交补丁。
3. 跟踪 master 分支的新特性，参与 OCCT bugtracker（mantis）讨论。
4. 阅读关键算法源码，例如 `BOPAlgo_PaveFiller`、`BRepFill_Pipe`、`ChFi3d_Builder`、`BRepMesh_IncrementalMesh`。
5. 选择一个领域深耕：CAM、仿真、BIM、可视化，结合 OCCT 与领域库构建产品。

## 8. 推荐资料

- 官方仓库 README、OCCT_BUILD.md、CONTRIBUTING.md
- 官方 Reference Manual（Doxygen 生成）
- 官方 User Guides：Foundation Classes、Modeling Data、Modeling Algorithms、Visualization、Data Exchange、Application Framework、Draw Test Harness、Test Manual
- 官方论坛 dev.opencascade.org/forums，问题量与历史积淀均可观
- pythonOCC 与 CadQuery 源码：对照 OCCT API 学习 Pythonic 封装
- FreeCAD 源码：对照 OCCT 在大型 CAD 应用中的实际用法

## 9. 本教程的章节安排

后续 17 章按以下顺序展开：环境与构建（第02章）、底层框架（第03章）、几何与拓扑（第04–06章）、建模算法（第07–09章）、网格化（第10章）、可视化（第11章）、数据交换（第12章）、OCAF（第13章）、Draw（第14章）、曲面（第15章）、性能（第16章）、生态集成（第17章）、综合实战（第18章）。每一章都尽量结合源码路径、官方文档章节、典型 API 与示例代码，使读者既能快速上手，又能在源码中找到对应实现。

---
layout: default
title: 第12章：数据交换 STEP IGES STL glTF OBJ
---

# 第12章：数据交换 STEP / IGES / STL / glTF / OBJ

数据交换（Data Exchange）是 OCCT 在 CAD 工业中应用最广泛的能力之一。它涵盖中性格式（STEP、IGES）、可视化格式（glTF、VRML、OBJ）、网格格式（STL、PLY）、点云、3D PDF 等，并通过 XCAF 把装配树、颜色、属性、PMI、层、单位完整携带。

## 2024 年以来 OCCT 把数据交换持续重构为以 `RWXxx` 为命名前缀的“读/写器”系列（如 `RWStep`、`RWGltf`、`RWObj`、`RWStl`、`RWMesh`、`RWPly`）以及独立的 `TKDESTEP`、`TKDEIGES`、`TKDEGLTF`、`TKDEOBJ`、`TKDEVRML`、`TKDESTL` toolkit。本章覆盖主要格式与 API。

## 1. 通用模型

OCCT 的数据交换有三个层次：

1. **几何级**：仅传几何/拓扑（`STEPControl_Reader/Writer`、`IGESControl_*`）；
2. **XCAF 级**：传装配 + 颜色 + 层 + 名称 + PMI（`STEPCAFControl_*`、`IGESCAFControl_*`、`RWGltf_CafReader/Writer`、`RWObj_CafReader/Writer`）；
3. **网格级**：纯三角网格交换（`StlAPI`、`RWPly`、`RWStl`、`RWGltf` 网格）。

工程中应优先使用 XCAF 级，能完整保留装配信息。

## 2. STEP（ISO 10303）

STEP 是工业标准，常用 AP：AP203（机械）、AP214（汽车）、AP242（含 PMI）、AP209（FEM）。OCCT 支持 AP203/AP214/AP242。

### 几何级
```cpp
STEPControl_Reader r;
r.ReadFile("part.step");
r.TransferRoots();
TopoDS_Shape s = r.OneShape();

STEPControl_Writer w;
w.Transfer(s, STEPControl_AsIs);
w.Write("out.step");
```

### XCAF 级
```cpp
Handle(TDocStd_Document) doc;
Handle(XCAFApp_Application) app = XCAFApp_Application::GetApplication();
app->NewDocument("MDTV-XCAF", doc);

STEPCAFControl_Reader cr;
cr.ReadFile("asm.step");
cr.SetColorMode(true);
cr.SetNameMode(true);
cr.SetLayerMode(true);
cr.Transfer(doc);

STEPCAFControl_Writer cw;
cw.Transfer(doc);
cw.Write("out.step");
```

XCAF 后续详见第 13 章。

### 选项与资源
通过 `Resource_Manager`（XSTEP 资源）控制：
- 单位（`read.step.unit`、`write.step.unit`）；
- 容差（`read.precision.val`、`write.precision.val`）；
- 模式（`read.step.assembly.level`、`write.step.assembly.mode`）；
- 名称、颜色、层映射；
- 容差处理（`read.precision.mode`：`Fix/Min/Max`）。

## 3. IGES（IGES 5.3）

IGES 主要用于交换曲线/曲面/线框/B-Rep（实体）。
```cpp
IGESControl_Reader r;
r.ReadFile("part.iges");
r.TransferRoots();
TopoDS_Shape s = r.OneShape();

IGESControl_Writer w("MM", 1);   // 单位 + 模型空间
w.AddShape(s);
w.ComputeModel();
w.Write("out.iges");
```

XCAF 版本：`IGESCAFControl_Reader/Writer`。
IGES 不支持装配树细节，建议使用 STEP。

## 4. STL（ASCII / Binary）

STL 仅有三角网格，无颜色/装配（`Color STL`/`Magics` 扩展非标准）。
```cpp
BRepMesh_IncrementalMesh m(shape, 0.1);

StlAPI_Writer w;
w.ASCIIMode() = false;
w.Write(shape, "out.stl");

TopoDS_Shape r;
StlAPI::Read(r, "in.stl");          // 注意：STL 是网格，OCCT 读后是 Compound 形式
```

`RWStl` 与 `RWMesh` 可读写更复杂的 mesh。3D 打印一般 binary。

## 5. OBJ

OBJ 支持三角网格 + UV + 法向 + 简单材质（mtl）。OCCT 读写：
```cpp
RWObj_CafReader rd;
rd.SetDocument(doc);
rd.Perform("model.obj", Message_ProgressRange());

RWObj_CafWriter wr("model.obj");
wr.Perform(doc, Message_ProgressRange());
```

`SetMemoryLimit`、`SetSinglePrecision`、`SetMergeAngle` 等参数控制网格合并与精度。

## 6. glTF 2.0

glTF 是 Web 友好的现代 3D 格式，OCCT 7.5+ 支持几何 + 装配 + 材质 + Draco 压缩。

```cpp
RWGltf_CafReader rd;
rd.SetDocument(doc);
rd.SetParallel(true);
rd.Perform("model.glb", Message_ProgressRange());

RWGltf_CafWriter wr("model.glb", /*isBinary=*/true);
wr.SetTransformationFormat(RWGltf_WriterTrsfFormat_TRS);
wr.SetMergeFaces(true);
wr.SetSplitIndices16(true);
wr.SetParallel(true);
wr.Perform(doc, fileInfo, Message_ProgressRange());
```

参数控制 PBR 材质、场景拆分、Y-up/Z-up（`SetCoordinateSystem`）、压缩（Draco）。

## 7. VRML / X3D

`VrmlAPI_Writer` 输出 VRML 1.0/2.0，主要用于早期 Web 与教学：
```cpp
VrmlAPI_Writer w;
w.SetRepresentation(VrmlAPI_BothRepresentation);
w.Write(shape, "out.wrl");
```

OCCT 7.6 起还提供 X3D（XML 版 VRML2）写出。

## 8. PLY 与点云

`RWPly_CafWriter` 导出三角网格到 PLY；`RWMesh_CafReader/Writer` 是更通用的网格 IO 框架。点云 OCCT 没有原生支持，但可借助 `Graphic3d_Group::AddPrimitive` 绘制，或通过自定义读写。

## 9. DXF / DWG

OCCT 不直接支持 DXF/DWG。社区项目 `oce-utils`、`libredwg`（参考本博客 `cad/libredwg`）可与 OCCT 桥接。

## 10. 3MF

OCCT 7.6+ 提供 `RWGltf` 风格的 3MF 读写（实验性），主要支持 mesh + color + asset，未支持扩展材料/格架。

## 11. 资源与配置

OCCT 数据交换大量参数通过资源文件控制：
- `XSTEP`（STEP）；
- `IGES`（IGES）；
- `XSTEPResource`/`IGESResource` 在 `resources/`。

环境变量 `CSF_STEPDefaults`、`CSF_IGESDefaults`、`CSF_XSTEPResource` 决定加载位置。`Interface_Static::SetIVal/RVal/CVal` 在程序运行时动态修改。

## 12. 修复与转换流程

导入数据后通常执行：
1. `ShapeFix_Shape` 修复拓扑；
2. `ShapeUpgrade_UnifySameDomain` 合并相同曲面相邻面；
3. `ShapeFix_Wire` 收紧 wire；
4. `BRepLib::SameParameter`；
5. `BRepCheck_Analyzer` 校验。

转换流程示意（IGES → 实体）：
```cpp
ShapeFix_Shape sf(s);
sf.Perform();
TopoDS_Shape s2 = sf.Shape();

ShapeUpgrade_UnifySameDomain u(s2, true, true, true);
u.Build();
TopoDS_Shape s3 = u.Shape();
```

## 13. 多线程

OCCT 7.5+ 多个 IO 类提供 `SetParallel(true)`，对大装配（>1000 零件）的 STEP/glTF 读写明显加速。注意：并行只在解析阶段，写出仍可能单线程。

## 14. 进度与诊断

`Message_ProgressIndicator`/`ProgressRange` 用于进度回调；`Message_Report` 收集警告与错误。可在 Qt 中绑定到进度条。
```cpp
Handle(Message_PrinterToReport) pr = new Message_PrinterToReport;
Message::DefaultMessenger()->AddPrinter(pr);
```

## 15. 实战：装配体 STEP → glTF

```cpp
Handle(TDocStd_Document) doc;
auto app = XCAFApp_Application::GetApplication();
app->NewDocument("XmlOcaf", doc);

STEPCAFControl_Reader rd;
rd.SetColorMode(true); rd.SetNameMode(true); rd.SetLayerMode(true);
rd.ReadFile("asm.step");
rd.Transfer(doc);

// 网格化所有形体
Handle(XCAFDoc_ShapeTool) st = XCAFDoc_DocumentTool::ShapeTool(doc->Main());
TDF_LabelSequence labs; st->GetFreeShapes(labs);
for (Standard_Integer i = 1; i <= labs.Length(); ++i) {
    TopoDS_Shape s = st->GetShape(labs.Value(i));
    BRepMesh_IncrementalMesh(s, 0.1, false, 0.5, true);
}

TColStd_IndexedDataMapOfStringString fileInfo;
fileInfo.Add("Generator", "OCCT");
RWGltf_CafWriter wr("asm.glb", true);
wr.SetParallel(true);
wr.Perform(doc, fileInfo, Message_ProgressRange());
```

## 16. 性能与限制

- STEP 读写速度受字符串解析瓶颈，OCCT 已逐步用流式优化；
- IGES 5.3 没有装配概念，OCCT 用 SubFigure 模拟；
- glTF 写出大装配时显存压力大，建议合并面；
- STL 体量大时使用 binary；
- 巨型装配（>50K 零件）建议拆分多文件 + 引用。

数据交换贯穿 CAD 与下游工具链。下一章我们将进入 OCAF，让 OCCT 应用具备“工程文档”的能力。

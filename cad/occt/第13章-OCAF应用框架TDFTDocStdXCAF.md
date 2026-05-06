---
layout: default
title: 第13章：OCAF 应用框架 TDF TDocStd XCAF
---

# 第13章：OCAF 应用框架 TDF / TDocStd / XCAF

OCAF（Open CASCADE Application Framework）是 OCCT 自带的“CAD 应用基础设施”：把数据组织成带标签的层级树，每个标签上挂载一系列“属性”（Attribute），由文档统一管理事务、撤销/重做、保存加载、引用、命名稳定性。XCAF 在 OCAF 之上扩展了 CAD 工业语义：装配树、颜色、层、材料、尺寸、PMI。

## 1. 为什么需要 OCAF？

仅靠 `TopoDS_Shape` 无法构成一个工程应用：
- 用户需要撤销/重做；
- 需要把多个零件组成装配体并保存；
- 修改后要保留命名（“顶面”仍然是“顶面”）；
- 需要引用：A 引用 B，B 改 A 自动更新；
- 需要扩展属性：颜色、备注、材料、加工参数。

OCAF 用 **Label-Attribute** 模型解决：
- `TDF_Label`：树状标签，类似文件系统路径；
- `TDF_Attribute`：挂在 label 上的数据；
- `TDocStd_Document`：根，管理事务、撤销栈、文件 IO。

## 2. `TDF` 标签树

```cpp
Handle(TDocStd_Application) app = new TDocStd_Application;
BinDrivers::DefineFormat(app);
XmlDrivers::DefineFormat(app);

Handle(TDocStd_Document) doc;
app->NewDocument("BinOcaf", doc);

TDF_Label root = doc->Main();
TDF_Label l1 = root.NewChild();
TDF_Label l2 = root.NewChild();
TDF_Label l11 = l1.NewChild();
```

label 可由 `TDF_TagSource` 自动派号，也可指定 entry 字符串（如 `0:1:2`）。`TDF_Tool::Entry`/`Label` 在字符串与 label 之间转换。

## 3. 属性

属性继承自 `TDF_Attribute`。常用：
- `TDataStd_Name`、`TDataStd_Comment`、`TDataStd_Integer/Real/Boolean`；
- `TDataStd_AsciiString`、`TDataStd_RealArray` 等数组；
- `TDataStd_TreeNode`：在 label 间建立任意有向关系；
- `TDataStd_UAttribute`：用 GUID 标识自定义类别；
- `TNaming_NamedShape`：保存 shape 与“演化”记录（修改/删除/生成）；
- `TFunction_Function`：参数化函数节点；
- `TPrsStd_AISPresentation`：管理可视化对象。

```cpp
TDataStd_Name::Set(l1, "Body");
Handle(TNaming_NamedShape) ns;
TNaming_Builder b(l1);
b.Generated(myShape);
```

## 4. 事务、撤销、重做

```cpp
doc->NewCommand();         // 开启一个事务
TDataStd_Real::Set(l1, 5.0);
doc->CommitCommand();

doc->Undo();
doc->Redo();
```

撤销栈深度：`doc->SetUndoLimit(50)`。注意：所有修改都必须在事务中，否则 OCAF 不记录。

## 5. 保存与加载

`BinOcaf` 是二进制格式，`XmlOcaf` 是 XML 格式：
```cpp
app->SaveAs(doc, "asm.xbf");          // 自动根据 doc 格式
app->Open("asm.xbf", doc);
```

OCAF 文件可包含多个文档，互相引用（`TDocStd_XLink`）。

## 6. 引用与外部文档

`TDocStd_XLink` 让一个文档引用另一个文档的 label，构建轻量装配。`TDocStd_XLinkTool::Copy` 复制带引用的子树。

## 7. 命名服务（Naming）

`TNaming_NamedShape` + `TNaming_Selector` 组合实现“持久命名”：
- `Generated/Modified/Delete` 记录算法演化；
- `TNaming_Selector` 通过几何/拓扑特征“记住”一条边，在重计算后自动重新定位。

这是参数化建模能稳定工作的关键——FreeCAD 的“拓扑命名”问题在 OCCT 7.5+ `TNaming` 体系中已得到改善（仍非完美）。

## 8. 函数节点 `TFunction`

`TFunction_Function` 把一个 label 标识为“可计算节点”，绑定一个 `TFunction_Driver`。`TFunction_Iterator`/`TFunction_GraphNode` 维护依赖图，自动按拓扑序重算。

模式：
- `Driver::MustExecute(label)` 判断是否需要重算；
- `Driver::Execute(label, log)` 执行算法，写入 `TNaming_NamedShape`；
- 改动输入 → 自动标记下游脏 → 下次 `Recompute` 重算。

## 9. AIS 集成 `TPrsStd`

`TPrsStd_AISViewer::New(doc->Main(), viewer)` 把视图绑定到文档；`TPrsStd_AISPresentation::Set(label, GUID)` 自动创建/更新 AIS 对象，跟随属性变化刷新显示。

## 10. XCAF：CAD 工业语义

`XCAF` 在 OCAF 之上提供：
- `XCAFDoc_DocumentTool::ShapeTool(doc->Main())` 装配树；
- `ColorTool`：颜色（surface/curve/generic）；
- `LayerTool`：层；
- `MaterialTool`：材料；
- `DimTolTool`、`ViewTool`、`NotesTool`：PMI；
- `VisMaterialTool`：可视化材质（PBR）；
- `ClippingPlaneTool`、`NotesTool`、`ToleranceTool`。

```cpp
auto app = XCAFApp_Application::GetApplication();
Handle(TDocStd_Document) d;
app->NewDocument("BinXCAF", d);

Handle(XCAFDoc_ShapeTool) st = XCAFDoc_DocumentTool::ShapeTool(d->Main());
TDF_Label la = st->AddShape(shape, true /*isAssembly*/);
TDF_Label lp = st->AddShape(part);
st->AddComponent(la, lp, location);

Handle(XCAFDoc_ColorTool) ct = XCAFDoc_DocumentTool::ColorTool(d->Main());
ct->SetColor(lp, Quantity_Color(Quantity_NOC_RED), XCAFDoc_ColorSurf);
```

## 11. STEP/glTF/OBJ 与 XCAF

第 12 章已经看到，`STEPCAFControl_*`、`RWGltf_CafReader/Writer`、`RWObj_CafReader/Writer` 都直接读写 XCAF。这是构建工业级数据交换的推荐路径。

## 12. 撤销/重做的实现要点

每个 `TDF_Attribute` 实现 `Restore`、`NewEmpty`、`Paste`，OCAF 使用“对偶 delta”记录前后值。对自定义属性，正确实现这三个方法即可享受撤销/重做。

## 13. 性能注意

- 巨大装配避免在每个零件上挂太多属性；
- 尽量用 `Reference` 共享，不要复制 shape；
- `Undo` 栈过深会消耗内存，可定期 `ClearUndos`；
- XML 格式比二进制慢一个数量级，仅做开发调试用。

## 14. 调试

- `TDF_Tool::Entry(label)` 打印 label 路径；
- `tools/DFBrowser` 可视化文档树；
- `TDocStd_Document::IsModified()` 判断是否需要保存；
- `TDF_Delta` 可观察事务变化。

## 15. 何时不用 OCAF

- 仅做几何运算的算法库（不需要文档/撤销）；
- Web 端轻量查看器（OCAF 体量大）；
- 命令行批处理工具（用普通 STEP/glTF 直接处理）。

OCAF 是 OCCT 应用从“算法库”升级到“CAD 应用”的关键。下一章我们看 OCCT 的官方 Python 替代品——Tcl 驱动的 Draw Test Harness。

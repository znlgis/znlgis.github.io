---
layout: default
title: 第08章：布尔运算与高级建模 BOPAlgo BRepAlgoAPI
---

# 第08章：布尔运算与高级建模 BOPAlgo / BRepAlgoAPI

布尔运算（Boolean Operation, BOP）是 CAD 内核的核心功能之一：把两个或多个形体合并、相减或求交，生成新的形体。OCCT 的布尔实现历经多次重构，目前的算法栈是：底层 `BOPAlgo`（Boolean Operations Algorithms）、`BOPDS`（数据结构）、`IntTools`（求交）三者协作，对外通过 `BRepAlgoAPI_*` 暴露。

## 1. 算法体系总览

- `BOPAlgo_PaveFiller`：核心几何处理器，负责求交、分裂、构造 PaveBlock、SectionEdge。
- `BOPAlgo_Builder`：通用构造器，支持多体（>2）。
- `BOPAlgo_BOP`：基于 Builder 的布尔操作器（fuse/cut/common/section）。
- `BOPAlgo_Section`：求两个形体的相交曲线。
- `BOPAlgo_MakerVolume`：从一组面构造体素（Volume Maker）。
- `BOPAlgo_Splitter`：用一组工具拓扑分割目标拓扑。
- `BOPAlgo_CellsBuilder`：基于拓扑细胞的高级布尔，可灵活组合。

对外的 `BRepAlgoAPI_*` 包括：
- `BRepAlgoAPI_Fuse`：并集；
- `BRepAlgoAPI_Cut`：差集；
- `BRepAlgoAPI_Common`：交集；
- `BRepAlgoAPI_Section`：相交曲线；
- `BRepAlgoAPI_BooleanOperation`：通用基类；
- `BRepAlgoAPI_Splitter`：分割；
- `BRepAlgoAPI_Defeaturing`：移除小特征。

## 2. 典型布尔运算

```cpp
TopoDS_Shape a = BRepPrimAPI_MakeBox(50, 50, 50).Shape();
TopoDS_Shape b = BRepPrimAPI_MakeSphere(gp_Pnt(50,50,50), 30).Shape();

BRepAlgoAPI_Cut cut(a, b);
cut.SetRunParallel(true);
cut.SetFuzzyValue(1e-6);
cut.Build();
if (!cut.IsDone()) { /* 处理错误 */ }
TopoDS_Shape result = cut.Shape();
```

控制参数：
- `SetRunParallel(true)`：开启并行求交（依赖 TBB 或 OCCT 内置线程池）；
- `SetFuzzyValue(tol)`：模糊容差，处理面贴合、近重合的边；
- `SetGlue(BOPAlgo_GlueShift|GlueFull)`：避免不必要的求交，加速大装配；
- `SetCheckInverted(false)`：禁用自检（相信输入闭合性）；
- `SetUseOBB(true)`：使用 OBB 加速预筛选。

## 3. `BOPAlgo_Builder`：多操作数

```cpp
BOPAlgo_Builder builder;
builder.AddArgument(s1);
builder.AddArgument(s2);
builder.AddArgument(s3);
builder.SetRunParallel(true);
builder.Perform();
TopoDS_Shape r = builder.Shape();
```

通用 Builder 把所有输入分裂成最小不重合的拓扑单元，便于后续选择/重组。

## 4. `BOPAlgo_CellsBuilder`：细胞布尔

`CellsBuilder` 把多个输入分裂为“原子细胞”，再让用户选择哪些细胞作为正/负组成结果。这种方式在重叠多体、设计变体、CSG 树压缩中非常有用：

```cpp
BOPAlgo_CellsBuilder cb;
cb.AddArgument(a);
cb.AddArgument(b);
cb.Perform();

TopTools_ListOfShape toAdd, toRemove;
toAdd.Append(a); toAdd.Append(b);
cb.AddToResult(toAdd, toRemove, /*material*/0);
TopoDS_Shape r = cb.Shape();
```

可以多次调用 `AddToResult`/`RemoveFromResult` 形成自定义结果。

## 5. `BOPAlgo_Splitter`：分割

不需要布尔语义、只想用工具切割目标：
```cpp
BRepAlgoAPI_Splitter sp;
TopTools_ListOfShape args;  args.Append(target);
TopTools_ListOfShape tools; tools.Append(plane);
sp.SetArguments(args);
sp.SetTools(tools);
sp.Build();
```

输出是 target 被 tools 分割后的所有拓扑碎片（compound）。

## 6. `BRepAlgoAPI_Defeaturing`：移除特征

输入实体 + 一组要移除的面，自动重建邻接面，常用于反向去圆角、去孔：
```cpp
BRepAlgoAPI_Defeaturing df;
df.SetShape(shape);
df.AddFacesToRemove(faces);
df.Build();
```

## 7. 求交线 `BRepAlgoAPI_Section`

```cpp
BRepAlgoAPI_Section sec(s1, s2, false);
sec.ComputePCurveOn1(true);
sec.Approximation(true);
sec.Build();
TopoDS_Shape edges = sec.Shape();
```

`ComputePCurveOn1`/`On2` 让结果边带 PCurve 信息，便于在原面上重建。

## 8. 布尔失败的常见原因与对策

OCCT 的 BOP 已经相当稳健，但失败仍时有发生：

| 现象 | 可能原因 | 对策 |
| --- | --- | --- |
| `IsDone()=false`，`HasErrors()=true` | 输入拓扑不合法 | 先 `BRepCheck_Analyzer` 修复；`ShapeFix_Shape` |
| 结果丢面/丢体 | 容差不一致 | 调整 `SetFuzzyValue`、`UpdateTolerances` |
| 结果非闭合 | 切割工具未穿透 | 扩大工具尺寸或加 `MakeHalfSpace` |
| 性能极慢 | 大装配重叠 | `SetGlue`、`SetRunParallel`、按零件逐个 cut |
| Section 缺线 | 几何近似 | `Approximation(true)`，调高容差 |
| 相交曲线断裂 | 容差过紧 | `SetFuzzyValue(1e-4)`，再做 `ShapeUpgrade_UnifySameDomain` |

## 9. 容差与 Fuzzy 值

OCCT 的容差与 Fuzzy 值并存：

- 拓扑顶点/边/面的 tolerance 描述名义几何的精度；
- Fuzzy 值是 BOP 在求交时附加的“宽容”距离；
- 实际生效的容差是 `max(tol_topo, fuzzy)`。

工程上推荐 fuzzy = 1e-6 到 1e-4 mm，根据数据来源（设计 / 扫描）调整。

## 10. 历史 vs 持久命名

布尔后如何把原来的“前面 / 后面 / 顶面”继续标识？OCCT 提供：

- `BRepAlgoAPI_BooleanOperation::Modified(shape)`、`Generated(shape)`、`IsDeleted(shape)`：算法溯源；
- `BRepTools_History`：保存完整修改历史；
- 上层 OCAF 的 `Topo命名 (TNaming)`：维护持久命名（详见第 13 章）。

```cpp
BRepTools_History history(/*shapes*/, builder);
const TopTools_ListOfShape& mod = history.Modified(face);
```

## 11. 高级建模算法

除了布尔，ModelingAlgorithms 还包含：

- `BRepFill_*`、`BRepOffsetAPI_*`：扫掠、放样、偏置、管道；
- `BRepFilletAPI_*`、`ChFi3d_*`：圆角、倒角；
- `BRepFeat_*`：特征建模（凸台、孔、槽、加强筋、镜像）；
- `BRepProj_Projection`：曲线投影到拓扑；
- `BRepClass3d_SolidClassifier`：点-体分类；
- `BRepPrimAPI_MakeRevol`、`MakePrism`：单参数体；
- `BRepFill_TrimShellCorner`、`BRepOffset_MakeOffset`：偏置体（壳偏置）；
- `BRepMesh_*`：网格化（第 10 章）。

下一章将专门介绍局部操作（圆角、倒角、抽壳、偏置、扫掠、放样）。

## 12. 实战：CSG 风格建模

```cpp
TopoDS_Shape base = BRepPrimAPI_MakeBox(100, 60, 20).Shape();
gp_Ax2 ax(gp_Pnt(50, 30, -1), gp_Dir(0, 0, 1));
TopoDS_Shape hole = BRepPrimAPI_MakeCylinder(ax, 10, 22).Shape();
TopoDS_Shape r1 = BRepAlgoAPI_Cut(base, hole);

gp_Ax2 ax2(gp_Pnt(0, 0, 20), gp_Dir(0, 0, 1));
TopoDS_Shape boss = BRepPrimAPI_MakeCylinder(ax2, 15, 30).Shape();
TopoDS_Shape r2 = BRepAlgoAPI_Fuse(r1, boss);
```

## 13. 性能调优

- 优先减小输入复杂度（先合并相同曲面、删除不必要的孔）；
- 使用 `BRepAlgoAPI_BooleanOperation::SetCheckInverted(false)` 跳过检测；
- 多核：`SetRunParallel(true)`；
- 对装配多次相同操作：使用 `BRepAlgoAPI_BuilderAlgo` 的多输入模式，避免重复求交；
- 巨大装配采用 `OCAF + XCAF`，每个零件独立做 BOP；
- 使用 `tools/MessageView` 监控警告。

布尔运算是 CAD 中最“动手即出错”的部分，务必在熟悉容差体系与诊断手段后再处理工程数据。下一章我们看局部操作。

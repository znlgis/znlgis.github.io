---
layout: default
title: 第14章：Draw 测试框架与 TCL 扩展
---

# 第14章：Draw 测试框架与 TCL 扩展

Draw Test Harness（简称 Draw）是 OCCT 自带的脚本控制台，基于 Tcl/Tk。它既是 OCCT 的“官方 REPL”，也是回归测试运行器、教学环境、原型实验台。掌握 Draw 几乎等于免费获得一个交互式 OCCT 调试器。

## 1. 启动 Draw

构建 OCCT 后会得到 `DRAWEXE` 可执行文件以及 `draw.bat`/`draw.sh` 启动脚本：

```bash
source install/env.sh
draw.sh
```

启动后进入 Tcl 控制台。第一件事是加载 OCCT 命令：
```
Draw[1]> pload ALL
```
`pload` 加载共享库中的 Tcl 命令绑定，常用 keyword 有 `MODELING`、`VISUALIZATION`、`OCAF`、`XSTEP`、`XDE`、`ALL`。

## 2. 基础命令

```
box b 100 50 30
pcylinder c 10 30
pcone n 20 5 30
psphere s 25
fit
```

- `box`、`pcylinder`、`pcone`、`psphere` 创建基本体；
- `bcommon`/`bfuse`/`bcut` 旧式布尔；
- `bop a b` + `bopfuse r`、`bopcommon r`、`bopcut r` 是新版；
- `axo`、`top`、`front` 切换视角；
- `fit`/`zoom`/`pan`；
- `donly s` 仅显示 s；
- `erase`/`display`；
- `vinit View1` 创建 V3d 视图，与传统 Draw 视图共存。

## 3. 几何与拓扑命令

- 几何：`line`、`circle`、`ellipse`、`bsplinecurve`、`bsplinesurf`；
- 拓扑：`vertex`、`mkedge`、`wire`、`mkplane`、`mkface`、`sewing`、`mksolid`；
- 转换：`mkcurve c1 e1`、`mksurface s1 f1`；
- 检查：`whatis`、`tolerance`、`checkshape`、`tcheck`、`bdump`、`tprint`；
- 拷贝：`tcopy`、`copy`、`tmove`；
- 拆分：`explode s F`、`explode s E`、`explode s V`，结果命名 `s_1`、`s_2`...

## 4. 圆角倒角与高级建模

```
fillet f s 5 e1 e2 e3
chamfer ch s e1 f1 1 1
prism p w 0 0 30
revol r w 0 0 0 0 0 1 1.5
thrusections L S R w1 w2 w3
```

- `fillet`/`chamfer`：参数顺序略不同；
- `prism`：拉伸；
- `revol`：旋转（轴 + 角度）；
- `thrusections`：放样；
- `pipe`、`mksweep`：扫掠；
- `offsetshape`、`offsetcompshape`：偏置体。

## 5. 数据交换

```
stepread part.step a *
igesread part.iges a *
stepwrite a out.step
stlread mesh.stl m
stlwrite s out.stl
ReadGltf doc model.glb
WriteGltf doc out.glb
```

`XDE`/`XCAF` 命令前缀通常以 `XDoc_*` 或 `XOpen/XSave` 形式：
```
XOpen asm.xbf D
XGetShape s D 0:1:1:1
XSetColor D 0:1:1:1 1 0 0
```

## 6. OCAF 命令

```
NewDocument D BinXCAF
XAddShape D s
XGetFreeShapes D
DFBrowse D
```

`DFBrowse` 启动可视化树浏览（也可用 `tools/DFBrowser`）。

## 7. 可视化命令

```
vinit
vdisplay s
vfit
vsetdispmode s 1
vrotate 0.3 0.3 0
vlight -create -type ambient -name a
vrenderparams -raytracing -shadows on -reflections on
vbackground -color BLACK
vsetcolor s RED
vselmode s 4 1   # 启用面选择
```

`vviewcube`、`vtrihedron`、`vmanipulator`、`vdimension` 等增强交互。

## 8. 测试系统

OCCT 仓库 `tests/` 目录由 Draw 脚本组成，每个 grid（目录）下若干测试用例（文件）：

```
tests/<group>/<grid>/<case>.test
```

运行：
```
testgrid                # 全量
testgrid bugs modalg    # 指定 group/grid
testgrid -outdir results/<run>
```

测试结果写入 `results/<run>` 目录，可与历史运行对比 (`testdiff`)。这是 OCCT 项目质量保证的基石，也是初学者熟悉算法用法的宝库。

## 9. 编写测试

`test/<group>/<grid>/<id>` 通常结构：
```
puts "TODO ..."
puts "============"

box b 10 20 30
checkshape b
```

`checkshape`、`checkmaxtol`、`checkprops`、`checktriangles` 等是断言宏（在 `tests/grid/begin` 中加载）。失败会被 `testgrid` 标记为 FAIL。

## 10. 自定义命令（C++ → Tcl）

OCCT 用 `Draw_Interpretor` 注册命令：
```cpp
static Standard_Integer myCommand(Draw_Interpretor& di, Standard_Integer argc, const char** argv) {
    if (argc < 3) { di << "usage: mycmd name dim\n"; return 1; }
    BRepPrimAPI_MakeBox box(atof(argv[2]), atof(argv[2]), atof(argv[2]));
    DBRep::Set(argv[1], box.Shape());
    return 0;
}

void MyPlugin::Commands(Draw_Interpretor& di) {
    di.Add("mycmd", "name dim", __FILE__, myCommand, "demo");
}
```

通过 plugin 机制（`PLUGIN(MyPlugin)`）打包成独立动态库，再用 `pload MYPLUGIN` 加载。

## 11. Tcl 脚本能力

Draw 是完整 Tcl 8.6 解释器：
- 变量 `set v 10`；
- 控制流 `if`、`for`、`foreach`、`while`；
- 过程 `proc name {args} { ... }`；
- 文件 `open`、`puts`、`gets`；
- 表达式 `expr {sin($x) * 2}`；
- 列表 `lindex`、`lappend`；
- 字符串 `regexp`、`format`。

可在 Draw 中编写完整脚本，实现自动化建模、数据校验、批量转换等。

## 12. 跨平台 GUI Draw

`Draw_Window` 在 Linux/macOS/Windows 提供原生窗口；`vinit` 启用 V3d 视图与 AIS 上下文。可同时使用 Tk GUI（按钮、画布）做更复杂界面，但 OCCT 主推 Qt 集成方案。

## 13. 调试 OCCT 算法

Draw 是调试 OCCT 内部算法的最佳工具：
- 抽出失败案例 → `restore in.brep s` → 在 Draw 复现；
- 打开 `OCC_CATCH_SIGNALS`：捕获 SEG fault；
- `dump s` 查看 BRep 内部；
- `valuepoles e` 打印 BSpline 控制点；
- `dlog`/`message` 控制日志。

## 14. CI 集成

OCCT 自有 CI 使用 `testgrid` + `testdiff` 对比基准。第三方项目可在 CI 中调用 `DRAWEXE -batch -script test.tcl` 运行回归测试，无需 GUI。

## 15. 学习路径

- 通读 `dox/user_guides/test_harness/test_harness.md`；
- 浏览 `tests/` 中典型 grid（`bugs`、`modalg`、`boolean`、`fillet`、`offsetwire`）熟悉算法套路；
- 在 Draw 中复现你即将用 C++ 写的算法，确保参数选择正确；
- 自定义 plugin，把项目内部命令暴露给 Draw 做调试。

掌握 Draw 后，OCCT 的“调试维度”立刻提升一档。下一章我们集中讨论 OCCT 在曲面建模与自由形状领域的能力。

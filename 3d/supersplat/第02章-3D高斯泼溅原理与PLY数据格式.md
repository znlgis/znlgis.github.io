---
layout: default
title: 第02章：3D高斯泼溅原理与PLY数据格式
---

# 第02章：3D 高斯泼溅原理与 PLY 数据格式

要真正用好 SuperSplat，必须先理解它所操作的数据本质——3D 高斯泼溅模型。本章从原理讲到数据格式，帮助你建立“每一次编辑到底在改什么”的直觉。

## 1. 从 NeRF 到 3D 高斯泼溅

辐射场（Radiance Field）的目标是：给定空间中任意一点和观察方向，预测该处的颜色与密度，从而重建出可自由视角漫游的三维场景。

- **NeRF（2020）** 用一个多层感知机（MLP）隐式表示辐射场，渲染时需要对每条光线采样大量点并逐点查询网络，**训练慢、渲染慢**（每帧需数秒）。
- **3D Gaussian Splatting（2023）** 改用**显式**表示：用成千上万（几十万到上千万）个三维高斯椭球（Gaussian）作为“基元”直接铺满空间，通过基于光栅化的“泼溅（splatting）”渲染，可在现代 GPU 上达到**实时（>100 FPS）**且画质优异。

3DGS 的核心优势：训练快（分钟到小时级）、渲染实时、画质高、可编辑（因为是显式的点集）。**正因为它是显式点集，SuperSplat 才能像编辑点云一样对它进行选择、删除、变换。**

## 2. 一个高斯点包含哪些信息

每个 3D 高斯由一组参数定义，渲染时这些参数共同决定它在屏幕上呈现为一个带颜色、带透明度、有方向和大小的“模糊椭圆斑点”：

1. **位置（Position）**：椭球中心的三维坐标 `x, y, z`。
2. **协方差 / 形状**：决定椭球的大小与朝向，实际存储为：
   - **缩放（Scale）**：三个轴向的尺寸 `scale_0, scale_1, scale_2`（通常以对数形式存储）；
   - **旋转（Rotation）**：一个四元数 `rot_0, rot_1, rot_2, rot_3`，表示椭球朝向。
3. **不透明度（Opacity）**：`opacity`，控制该高斯的透明程度（通常经过 sigmoid 激活）。
4. **颜色 / 球谐系数（Spherical Harmonics, SH）**：
   - **DC 分量**：`f_dc_0, f_dc_1, f_dc_2`，对应 RGB 的基础颜色（0 阶球谐）；
   - **高阶分量**：`f_rest_0 … f_rest_N`，用于表达**视角相关**的颜色变化（高光、反射等）。阶数越高，系数越多：1 阶各通道 3 个、2 阶 5 个、3 阶 7 个，三通道合计 3 阶时为 45 个 `f_rest`。

> 理解要点：颜色不是简单的 RGB，而是用**球谐函数**编码的、随观察方向变化的颜色场。这正是 3DGS 能表现出真实反光的原因，也是第 06 章颜色编辑需要特别处理 SH 的原因。

## 3. 球谐函数（SH）速览

球谐函数是定义在球面上的一组正交基，类似傅里叶级数之于一维信号。在 3DGS 中：

- 用低阶 SH 系数表示每个高斯在不同观察方向上的出射颜色；
- **0 阶（DC）** 是与方向无关的常数项，可近似看作“基础颜色”；
- **高阶项** 编码方向相关的颜色变化。

SuperSplat 在 `src/sh-utils.ts` 中实现了 SH 相关工具。一个常见常量是 0 阶球谐基函数值 `SH_C0 = 0.28209479177387814`。把 DC 系数转换为可显示的颜色时使用：

```text
color = 0.5 + f_dc * SH_C0   （再裁剪到 [0,1]）
```

源码 `src/editor.ts` 中即可见到该换算：

```ts
const SH_C0 = 0.28209479177387814;
const decodeColorChannel = (value: number) => {
    return Math.min(1, Math.max(0, 0.5 + value * SH_C0));
};
```

这意味着当你在 SuperSplat 中“拾取某个高斯的颜色”时，本质是把它的 DC 球谐系数反解为 RGB。

## 4. PLY 文件格式详解

3DGS 训练管线（如 Inria 官方实现）最常见的输出是 **PLY（Polygon File Format）** 文件。PLY 是一种通用的多边形/点数据格式，分为 ASCII 与二进制两种；3DGS 使用**二进制小端（binary_little_endian）**以节省体积。

### 4.1 文件结构

PLY 由**头部（header，ASCII 文本）** 与**数据体（body，二进制或 ASCII）** 两部分构成。一个典型 3DGS PLY 头部如下：

```text
ply
format binary_little_endian 1.0
element vertex 1048576
property float x
property float y
property float z
property float nx
property float ny
property float nz
property float f_dc_0
property float f_dc_1
property float f_dc_2
property float f_rest_0
property float f_rest_1
...
property float f_rest_44
property float opacity
property float scale_0
property float scale_1
property float scale_2
property float rot_0
property float rot_1
property float rot_2
property float rot_3
end_header
<binary data ...>
```

要点：

- `element vertex N`：声明共有 N 个顶点（即 N 个高斯点）；
- 每个 `property float xxx`：声明每个顶点拥有的属性及类型，顺序即二进制中的字节排列顺序；
- `nx, ny, nz`（法线）在 3DGS 中通常存在但不被使用，常为 0；
- `f_dc_*` 为 DC 颜色，`f_rest_*` 为高阶 SH（数量取决于 SH 阶数）；
- `opacity`、`scale_*`、`rot_*` 含义如上一节所述。

### 4.2 数据量与体积问题

假设 SH 取 3 阶，则单个顶点属性数约为：3(xyz) + 3(法线) + 3(f_dc) + 45(f_rest) + 1(opacity) + 3(scale) + 4(rot) = **62 个 float**，每个 4 字节，即约 **248 字节/点**。对于一个 100 万点的模型，仅数据体就约 **248 MB**。这正是高斯模型“又大又重”的根源，也是 SuperSplat 要做**裁剪清理**与**压缩**的根本动机（详见第 08 章）。

## 5. SuperSplat 支持的数据格式

SuperSplat（借助 `@playcanvas/splat-transform` 与 `src/splat-serialize.ts`、`src/file-handler.ts`）支持加载与导出多种高斯泼溅格式：

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| 标准 PLY | `.ply` | 3DGS 训练输出的通用格式，未压缩，体积大 |
| 压缩 PLY | `.ply`（compressed） | PlayCanvas 定义的量化压缩 PLY，体积显著减小 |
| Splat | `.splat` | antimatter15 提出的紧凑二进制格式，常用于 Web 查看器 |
| SOG / 超压缩 | `.sog` / `.json` + WebP | PlayCanvas 的 Self-Organizing Gaussians，用 WebP 纹理存储，体积极小，适合 Web |
| CSV | `.csv` | 文本导出，便于分析或外部处理 |
| PLY 序列 | 多个 `.ply` | 用于体积视频/动态高斯（见 `src/ply-sequence.ts`） |

> 不同格式的取舍：编辑/归档用 PLY（无损），Web 发布用压缩 PLY 或 SOG（小体积、快加载）。第 08 章会详细对比。

## 6. 坐标系与朝向

3DGS 模型的坐标系取决于训练管线（COLMAP、相机约定等），常见问题是导入后**上下颠倒、朝向不对、比例异常**。SuperSplat 提供整体变换（平移/旋转/缩放）来校正方向，并通过 `scene-config.ts` 中的相机与网格配置提供参照。第 05 章会讲解如何规范化模型方向。

PlayCanvas 引擎使用**右手坐标系、Y 轴向上**。理解这一点有助于解释为什么有些从外部工具导入的模型需要绕 X 轴旋转 180°。

## 7. 高斯点的“状态”概念

SuperSplat 在加载模型后，会为每个高斯点维护一组**状态位**（见 `src/splat-state.ts`），这是它实现非破坏式编辑的关键：

- `selected`：是否被选中；
- `hidden`：是否被隐藏；
- `deleted`：是否被标记删除。

这些状态以位掩码（bitmask）形式按区间（IndexRanges）批量设置，所有编辑操作（第 04 章）本质上都是在修改这些状态位，并可通过历史栈撤销/重做。**删除在导出前都是“标记删除”，因此完全可逆**——这是理解 SuperSplat 编辑模型的核心。

## 8. 本章小结

本章从原理层面拆解了 3D 高斯泼溅：

- 它是 NeRF 之后的显式辐射场表示，由大量带位置、形状（缩放+旋转）、不透明度、球谐颜色的三维高斯组成；
- 颜色用球谐函数编码，DC 项近似基础色，高阶项表达视角相关效果；
- 训练输出通常是二进制 PLY，属性顺序固定、体积庞大；
- SuperSplat 支持 PLY、压缩 PLY、splat、SOG、CSV、PLY 序列等格式；
- 每个高斯点在编辑器中拥有 selected/hidden/deleted 状态位，使编辑非破坏、可撤销。

掌握这些，你就能理解后续每个工具“改的是哪一组数据”。下一章我们正式进入在线编辑器，学习加载模型与视图操作。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/supersplat/第01章-SuperSplat项目全景与学习路线/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/3d/supersplat/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/3d/supersplat/第03章-在线编辑器使用入门与视图操作/" style="text-decoration: none;">下一章 →</a>
</div>

---
layout: default
title: 第01章：CadQuery概述与入门
---

# 第01章：CadQuery概述与入门

## 1.1 CadQuery简介

### 1.1.1 什么是CadQuery

CadQuery是一个直观、易用的Python模块，专门用于构建参数化3D CAD模型。使用CadQuery，开发者可以编写简短、简洁的脚本来生成高质量的CAD模型。它的核心理念是"代码即模型"，通过Python代码来描述3D几何形状，使得模型可以轻松地进行参数化定制。

与传统的GUI CAD软件不同，CadQuery采用脚本化的方式进行建模。这种方式有几个显著优势：

1. **参数化设计**：通过修改脚本中的参数，可以快速生成不同尺寸和形状的模型
2. **版本控制**：代码形式的模型可以使用Git等版本控制系统进行管理
3. **批量生成**：可以通过循环和函数批量生成大量相似的模型
4. **可复用性**：模型代码可以作为库被其他项目引用

### 1.1.2 CadQuery的发展历史

CadQuery最初是基于FreeCAD API开发的。FreeCAD提供了Python接口，使得CadQuery能够快速开发并获得跨平台能力。然而，随着项目的发展，开发团队发现FreeCAD API在某些高级操作和选择器方面存在限制。

为了突破这些限制，CadQuery 2.0版本进行了重大重构，直接基于OpenCASCADE Technology（OCCT）的Python包装器OCP进行开发。最新的CadQuery 2.7.0版本（2026年2月发布）延续了这一架构，持续改进性能和功能。这个架构决定带来了以下好处：

- **更强的控制力**：直接访问OCCT内核，可以实现更复杂的几何操作
- **更好的灵活性**：不再受限于中间层API的功能范围
- **更高的性能**：减少了中间层的开销

当然，这也意味着开发团队需要自行处理跨平台部署等问题，但团队认为这是一个值得的权衡。

### 1.1.3 CadQuery与OpenSCAD的对比

CadQuery经常被拿来与OpenSCAD进行比较，因为两者都是开源的、基于脚本的参数化模型生成器。然而，CadQuery在多个方面具有显著优势：

| 特性 | CadQuery | OpenSCAD |
|------|----------|----------|
| 编程语言 | Python（标准语言） | 自定义语言 |
| CAD内核 | OCCT（功能强大） | CGAL（功能相对有限） |
| STEP支持 | 原生支持导入导出 | 不支持 |
| NURBS支持 | 支持 | 不支持 |
| 代码量 | 较少 | 较多 |
| 生态系统 | Python丰富的库支持 | 有限 |
| 构建速度 | 快 | 较慢 |

**具体优势详解：**

1. **标准编程语言**
   - CadQuery使用Python，这意味着可以利用Python丰富的标准库和第三方库
   - 可以使用成熟的IDE（如PyCharm、VSCode）进行开发
   - 便于与其他Python项目集成

2. **强大的CAD内核**
   - OCCT原生支持NURBS、样条曲线、曲面缝合、STL修复等复杂操作
   - 支持标准CSG操作之外的高级建模功能

3. **STEP格式支持**
   - 可以导入/导出无损的STEP格式
   - 可以从其他CAD软件创建的STEP模型开始，添加参数化特征

4. **更简洁的代码**
   - 可以基于其他特征、工作平面、顶点的位置来定位新特征
   - 链式调用使得代码更加流畅和易读

### 1.1.4 CadQuery的核心特性

CadQuery的核心特性包括：

**1. 自然语言式建模**
```python
# 代码描述与人类语言描述相近
# "在XY平面上创建一个80x60x10的盒子，然后在顶面中心钻一个直径22的孔"
result = (
    cq.Workplane("XY")
    .box(80, 60, 10)
    .faces(">Z")
    .workplane()
    .hole(22)
)
```

**2. 参数化建模**
```python
# 参数可以轻松修改
length = 80.0
width = 60.0
height = 10.0
hole_diameter = 22.0

result = (
    cq.Workplane("XY")
    .box(length, width, height)
    .faces(">Z")
    .workplane()
    .hole(hole_diameter)
)
```

**3. 多格式输出**
- STEP：无损CAD格式，工业标准
- STL：3D打印常用格式
- AMF：添加制造格式
- 3MF：3D制造格式
- DXF：2D绘图格式
- VRML：虚拟现实建模语言

**4. 高级建模功能**
- 倒角和圆角
- 曲线拉伸
- 参数曲线
- 放样
- 扫略

**5. 装配体支持**
- 可以将多个零件组合成装配体
- 支持约束定义
- 支持层次化组装

## 1.2 CadQuery的技术架构

### 1.2.1 整体架构概览

CadQuery的技术架构可以分为以下几个层次：

```
┌─────────────────────────────────────────────┐
│           用户脚本 / 应用程序               │
├─────────────────────────────────────────────┤
│              CadQuery API                   │
│  (Workplane, Selectors, Assembly, etc.)     │
├─────────────────────────────────────────────┤
│           OCP (Open CASCADE Python)          │
│         Python bindings for OCCT            │
├─────────────────────────────────────────────┤
│     Open CASCADE Technology (OCCT)          │
│          C++ CAD 内核                        │
└─────────────────────────────────────────────┘
```

**各层职责：**

1. **用户脚本/应用程序层**
   - 用户编写的CadQuery脚本
   - 集成CadQuery的应用程序

2. **CadQuery API层**
   - Workplane：工作平面，核心建模接口
   - Selectors：选择器，用于选择几何元素
   - Assembly：装配体管理
   - Sketch：2D草图功能
   - 导入导出功能

3. **OCP层**
   - OCCT的Python绑定
   - 提供对OCCT功能的Python访问

4. **OCCT层**
   - 底层CAD内核
   - 提供几何建模、布尔运算等核心功能

### 1.2.2 核心概念

**Workplane（工作平面）**

Workplane是CadQuery最核心的概念。它代表一个2D工作平面，可以在上面进行草图绘制和3D操作。

```python
# 创建一个在XY平面上的工作平面
wp = cq.Workplane("XY")

# 工作平面可以偏移
wp_offset = cq.Workplane("XY").workplane(offset=10)

# 工作平面可以在任意面上创建
box = cq.Workplane("XY").box(10, 10, 10)
top_face_wp = box.faces(">Z").workplane()
```

**Selector（选择器）**

选择器用于从模型中选择特定的几何元素（面、边、顶点等）。

```python
# 选择Z方向最高的面
.faces(">Z")

# 选择所有圆形边
.edges("%Circle")

# 选择最近的顶点
.vertices("<X")
```

**Shape（形状）**

Shape是OCCT中的基本几何对象，包括：
- Vertex（顶点）
- Edge（边）
- Wire（线框）
- Face（面）
- Shell（壳）
- Solid（实体）
- Compound（复合体）

### 1.2.3 数据流

CadQuery的典型数据流如下：

```
草图定义 → 2D几何 → 3D操作 → 实体模型 → 导出
   │          │          │          │
   │          │          │          └─ STEP/STL/等
   │          │          └─ 拉伸/旋转/扫略/放样
   │          └─ 点、线、圆、矩形等
   └─ Workplane创建
```

## 1.3 环境搭建与安装

### 1.3.1 系统要求

在安装CadQuery之前，请确保系统满足以下要求：

**操作系统：**
- Windows 10/11（64位）
- macOS（Intel和Apple Silicon）
- Linux（主要发行版）

**Python版本：**
- Python 3.9 - 3.13（推荐3.11或3.12）

**硬件要求：**
- 至少4GB RAM（推荐8GB以上）
- 1GB以上磁盘空间

### 1.3.2 使用Conda安装（推荐）

Conda是推荐的安装方式，因为它可以更好地处理CadQuery复杂的依赖关系。

**步骤1：安装Miniforge**

如果还没有安装Conda，推荐安装Miniforge，这是一个轻量级的Conda发行版：

从 https://github.com/conda-forge/miniforge 下载适合您系统的安装包并安装。

**步骤2：创建新环境**

```bash
# 创建一个名为cadquery的新环境
conda create -n cadquery python=3.11

# 激活环境
conda activate cadquery
```

**步骤3：安装CadQuery**

推荐使用mamba代替conda进行安装，因为mamba更快且内存占用更少：

```bash
# 如果还没有mamba，先安装它
conda install mamba -n base -c conda-forge

# 安装CadQuery
mamba install -c conda-forge cadquery
```

如果要安装开发版本（包含最新功能但可能不稳定）：

```bash
mamba install -c conda-forge -c cadquery cadquery=master
```

### 1.3.3 使用pip安装

pip安装方式更简单，但在某些系统上可能会遇到问题。

**步骤1：创建虚拟环境（强烈推荐）**

```bash
# 创建虚拟环境
python -m venv cadquery-env

# 激活虚拟环境
# Windows:
cadquery-env\Scripts\activate
# Linux/macOS:
source cadquery-env/bin/activate
```

**步骤2：升级pip**

```bash
python -m pip install --upgrade pip
```

**步骤3：安装CadQuery**

```bash
pip install cadquery  # 当前最新版本为2.7.0
```

安装最新开发版本：

```bash
pip install git+https://github.com/CadQuery/cadquery.git
```

### 1.3.4 安装CQ-editor（可视化IDE）

CQ-editor是CadQuery的官方图形化IDE，提供实时预览、调试等功能。

**使用Conda安装（推荐）：**

```bash
mamba install -c conda-forge -c cadquery cq-editor
```

**运行CQ-editor：**

```bash
cq-editor
```

CQ-editor的主要功能：
- 代码编辑器：语法高亮、自动补全
- 3D预览：实时查看模型
- 调试器：逐步执行脚本
- 栈检查器：查看CadQuery对象栈
- 导出功能：直接导出STEP、STL等格式

### 1.3.5 在Jupyter中使用CadQuery

CadQuery可以在Jupyter Notebook/Lab中直接使用：

**安装jupyter-cadquery：**

```bash
pip install jupyter-cadquery
```

**在Jupyter中显示模型：**

```python
import cadquery as cq
from jupyter_cadquery import show

# 创建一个简单的盒子
box = cq.Workplane("XY").box(10, 10, 10)

# 显示模型
show(box)
```

### 1.3.6 验证安装

安装完成后，可以通过以下代码验证安装是否成功：

```python
import cadquery as cq

# 创建一个简单的模型
result = cq.Workplane("XY").box(10, 20, 30)

# 检查结果
print(f"CadQuery版本: {cq.__version__}")
print(f"模型体积: {result.val().Volume()}")
print("安装成功！")
```

## 1.4 第一个CadQuery程序

### 1.4.1 Hello World - 创建一个盒子

让我们从最简单的例子开始：

```python
import cadquery as cq

# 创建一个10x20x5的盒子
result = cq.Workplane("XY").box(10, 20, 5)

# 导出为STEP文件
cq.exporters.export(result, "hello_box.step")

print("盒子创建成功！")
```

**代码解析：**

1. `import cadquery as cq` - 导入CadQuery库，使用cq作为别名
2. `cq.Workplane("XY")` - 创建一个在XY平面上的工作平面
3. `.box(10, 20, 5)` - 在工作平面上创建一个长10、宽20、高5的盒子
4. `cq.exporters.export()` - 将结果导出为文件

### 1.4.2 带孔的盒子

让我们创建一个更有趣的模型——带孔的盒子：

```python
import cadquery as cq

# 定义参数
length = 80.0
width = 60.0
thickness = 10.0
hole_diameter = 22.0

# 创建带孔的盒子
result = (
    cq.Workplane("XY")
    .box(length, width, thickness)  # 创建基础盒子
    .faces(">Z")                     # 选择顶面
    .workplane()                     # 在顶面创建新工作平面
    .hole(hole_diameter)             # 钻孔
)

# 导出模型
cq.exporters.export(result, "box_with_hole.step")
```

**代码解析：**

1. 定义参数使模型可以轻松调整
2. `.faces(">Z")` - 选择Z轴正方向最远的面（即顶面）
3. `.workplane()` - 在选中的面上创建新的工作平面
4. `.hole(hole_diameter)` - 创建一个贯穿孔

### 1.4.3 带圆角的零件

添加圆角让零件更加美观和实用：

```python
import cadquery as cq

# 创建带圆角的盒子
result = (
    cq.Workplane("XY")
    .box(30, 20, 10)
    .edges("|Z")      # 选择所有平行于Z轴的边
    .fillet(2)        # 对选中的边进行圆角处理
)

# 导出模型
cq.exporters.export(result, "filleted_box.step")
```

**边选择器说明：**
- `|Z` - 选择平行于Z轴的边
- `|X` - 选择平行于X轴的边
- `|Y` - 选择平行于Y轴的边

### 1.4.4 组合多个特征

一个完整的零件示例：

```python
import cadquery as cq

# 参数定义
base_width = 100
base_depth = 80
base_height = 10
boss_diameter = 30
boss_height = 20
hole_diameter = 8

# 创建零件
result = (
    cq.Workplane("XY")
    # 创建基础板
    .box(base_width, base_depth, base_height)
    # 选择顶面，创建凸台
    .faces(">Z")
    .workplane()
    .circle(boss_diameter / 2)
    .extrude(boss_height)
    # 在凸台顶部钻孔
    .faces(">Z")
    .workplane()
    .hole(hole_diameter)
    # 对基础板的竖直边倒圆角
    .faces("<Z")
    .workplane()
    .edges()
    .fillet(3)
)

# 导出模型
cq.exporters.export(result, "complete_part.step")
```

## 1.5 CadQuery基本工作流程

### 1.5.1 典型建模流程

CadQuery的典型建模流程遵循以下步骤：

```
1. 创建工作平面（Workplane）
        ↓
2. 绘制2D草图
        ↓
3. 转换为3D（拉伸/旋转等）
        ↓
4. 选择特征（面/边/顶点）
        ↓
5. 添加/修改特征
        ↓
6. 重复4-5直到完成
        ↓
7. 导出模型
```

### 1.5.2 链式调用

CadQuery使用链式调用（Method Chaining）风格，每个方法返回一个CadQuery对象，可以继续调用下一个方法：

```python
result = (
    cq.Workplane("XY")
    .box(10, 10, 5)
    .faces(">Z")
    .workplane()
    .hole(3)
    .faces("<Z")
    .workplane(invert=True)
    .rect(5, 5)
    .cutBlind(-2)
)
```

这种风格使代码更加紧凑和易读，每一行代表一个操作步骤。

### 1.5.3 对象栈概念

CadQuery维护一个对象栈（Object Stack），用于存储当前操作的几何元素：

```python
# 初始栈为空
wp = cq.Workplane("XY")  # 栈：[工作平面原点]

# 绘制圆后，栈中是圆
wp = wp.circle(5)  # 栈：[Circle]

# 拉伸后，栈中是实体
wp = wp.extrude(10)  # 栈：[Solid]

# 选择面后，栈中是面
wp = wp.faces(">Z")  # 栈：[Face]
```

理解对象栈对于编写正确的CadQuery代码非常重要。

### 1.5.4 坐标系统

CadQuery使用右手坐标系：

```
        Z (上)
        │
        │
        │
        └───────── Y (右)
       /
      /
     X (前)
```

**工作平面选项：**
- `"XY"` - 水平面，Z轴向上
- `"XZ"` - 正面，Y轴向外
- `"YZ"` - 侧面，X轴向外
- `"front"` - 等同于XZ
- `"back"` - XZ的反面
- `"top"` - 等同于XY
- `"bottom"` - XY的反面
- `"left"` - YZ的反面
- `"right"` - 等同于YZ

## 1.6 常用工具与资源

### 1.6.1 官方资源

**官方文档：**
- 完整文档：https://cadquery.readthedocs.io/
- 快速参考手册：https://cadquery.readthedocs.io/en/latest/_static/cadquery_cheatsheet.html

**GitHub资源：**
- 主仓库：https://github.com/CadQuery/cadquery
- CQ-editor：https://github.com/CadQuery/CQ-editor
- OCP绑定：https://github.com/CadQuery/OCP

**社区支持：**
- GitHub Discussions：https://github.com/CadQuery/cadquery/discussions
- Google Group：https://groups.google.com/g/cadquery
- Discord服务器：https://discord.com/invite/Bj9AQPsCfx

### 1.6.2 学习资源

**示例代码：**
- 官方示例：https://cadquery.readthedocs.io/en/latest/examples.html
- 社区Cookbook：https://github.com/khaledelhady44/CadQuery-Cookbook

**视频教程：**
- Linux安装教程：https://youtu.be/sjLTePOq8bQ
- Windows安装教程：https://youtu.be/3Tg_RJhqZRg

### 1.6.3 实用项目参考

**FxBricks乐高火车系统：**
FxBricks使用CadQuery构建产品开发流水线，他们开源了CAD流程文档和cq-kit工具库：
- 流程文档：https://github.com/fx-bricks/fx-cad-notes
- cq-kit：https://github.com/michaelgale/cq-kit

**社区插件：**
- cadquery-plugins：https://github.com/CadQuery/cadquery-plugins

## 1.7 本章小结

本章我们全面介绍了CadQuery的基础知识：

1. **CadQuery简介**
   - CadQuery是Python编写的参数化3D CAD库
   - 基于OCCT内核，功能强大
   - 与OpenSCAD相比具有多项优势

2. **技术架构**
   - 分层架构：用户脚本 → CadQuery API → OCP → OCCT
   - 核心概念：Workplane、Selector、Shape

3. **环境搭建**
   - 推荐使用Conda安装
   - 可选安装CQ-editor可视化IDE
   - 支持Jupyter集成

4. **基础编程**
   - 创建简单模型
   - 链式调用风格
   - 对象栈概念

5. **资源与工具**
   - 官方文档和社区支持
   - 学习资源和项目参考

通过本章的学习，您应该已经能够：
- 理解CadQuery的核心概念和工作原理
- 成功安装和配置CadQuery开发环境
- 编写简单的CadQuery脚本创建基本3D模型

在下一章中，我们将深入学习CadQuery的Workplane和草图系统，这是进行复杂建模的基础。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-Workplane与草图系统" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

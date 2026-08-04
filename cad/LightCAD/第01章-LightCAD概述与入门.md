---
layout: default
title: LightCAD概述与入门
---

# 第一章：LightCAD概述与入门

## 1.1 LightCAD简介

### 1.1.1 项目定位与背景

LightCAD是由启道软件（Qidao Soft）开发的一款专业级开源CAD平台，基于.NET 10构建，采用C#语言编写。作为一个完整的二维/三维计算机辅助设计系统，LightCAD致力于为建筑工程设计、机械制图、参数化建模等领域提供一个功能丰富且高度可扩展的设计解决方案。

LightCAD的设计理念源于对主流CAD系统的深入分析和改进。它不仅提供了传统CAD系统所具备的绑图、建模和标注功能，还通过模块化架构和插件系统，让开发者能够根据行业需求进行深度定制和二次开发。

### 1.1.2 项目仓库信息

- **GitHub仓库地址**：[https://github.com/znlgis/lightcad1](https://github.com/znlgis/lightcad1)
- **开发语言**：C#
- **目标框架**：.NET 10（Windows平台）
- **渲染引擎**：Three.js4Net + OpenTK
- **UI框架**：Windows Forms + Avalonia
- **许可协议**：启道软件开源许可

### 1.1.3 核心特性

LightCAD具备以下核心特性：

1. **模块化分层架构**：从数学库到用户界面，每一层职责明确、依赖清晰
2. **完整的二维绘图功能**：支持直线、圆弧、椭圆、多段线、样条曲线等基本图元
3. **强大的三维建模能力**：支持拉伸、旋转、放样、融合等参数化实体建模操作
4. **多种渲染后端**：集成Three.js4Net和OpenTK，支持WebGL和OpenGL渲染
5. **灵活的插件系统**：基于Weikio Plugin Framework，支持运行时动态加载插件
6. **行业插件预置**：内置建筑（QdArch）、电气（QdElectric）、暖通（QdHvac）、结构（QdStruct）、给排水（QdWater）五大行业插件
7. **DWG/DXF兼容**：通过ODA SDK实现与AutoCAD格式的完整兼容
8. **丰富的字体支持**：内置50+种SHX字体和多种TrueType字体
9. **视图构建系统**：支持正交投影、截面视图、详图等多种视图生成方式
10. **跨平台潜力**：基于.NET 10，具备跨平台运行的技术基础

## 1.2 LightCAD整体架构概览

### 1.2.1 分层架构图

LightCAD采用严格的分层架构设计，从底层到上层的依赖关系如下：

```
┌─────────────────────────────────────────────┐
│              用户界面层                        │
│    LightCAD.WinForm / LightCAD.Model         │
├─────────────────────────────────────────────┤
│              应用运行时层                      │
│           LightCAD.Runtime                    │
├─────────────────────────────────────────────┤
│              绘图交互层                        │
│           LightCAD.Drawing                    │
├─────────────────────────────────────────────┤
│              渲染工具层                        │
│          LightCAD.RenderUtils                 │
├─────────────────────────────────────────────┤
│              核心数据层                        │
│            LightCAD.Core                      │
├─────────────────────────────────────────────┤
│              数学基础层                        │
│           LightCAD.MathLib                    │
└─────────────────────────────────────────────┘
```

### 1.2.2 核心模块说明

| 模块 | 说明 | 关键职责 |
|------|------|----------|
| **LightCAD.MathLib** | 数学基础库 | 向量/矩阵运算、曲线数学、几何变换、交集计算 |
| **LightCAD.Core** | 核心数据模型 | 文档结构、图元实体、属性定义、元素类型系统 |
| **LightCAD.RenderUtils** | 渲染工具 | Three.js桥接、资源管理、事件系统、三维控件 |
| **LightCAD.Drawing** | 二维绘图 | 视口管理、输入系统、捕捉系统、夹点编辑 |
| **LightCAD.Runtime** | 应用运行时 | 视图构建、投影处理、高层操作逻辑 |
| **LightCAD.Model** | UI模型控件 | Avalonia XAML控件、模型编辑器、状态栏 |
| **LightCAD.WinForm** | Windows窗体应用 | 主应用程序入口、字体资源、窗口管理 |

### 1.2.3 辅助模块

除核心模块外，LightCAD还包含以下辅助模块：

- **LightCAD.ImportAndExport**：文件导入导出，支持DWG/DXF/SketchUp格式
- **LightCAD.Component.Actions**：组件操作动作，如创建立方体、拉伸等
- **LightCAD.PrjManager**：项目管理器
- **LightCAD.LocalSolution**：本地工作空间管理
- **LightCAD.DBHelper / LightCAD.DBUtility**：数据库操作工具

## 1.3 技术栈详解

### 1.3.1 .NET 10平台

LightCAD基于微软最新的长期支持版（LTS）.NET 10平台构建。选择.NET 10的主要原因包括：

- **高性能**：.NET 10在JIT编译、GC（垃圾回收）和整体运行时性能上都有显著提升
- **跨平台支持**：虽然当前主要面向Windows，但.NET 10为未来的跨平台扩展预留了可能性
- **现代C#语言特性**：支持模式匹配、记录类型、全局using等现代语法
- **长期支持**：作为LTS版本，可以获得微软的长期安全更新和技术支持

### 1.3.2 渲染技术

LightCAD采用双渲染引擎策略：

**Three.js4Net（主要3D渲染）**

Three.js4Net是Three.js JavaScript 3D库的.NET封装版本。它提供了：

- 场景图管理（Scene Graph）
- 相机系统（透视投影/正交投影）
- 材质和光照系统
- 几何体生成和变换
- WebGL后端渲染

**OpenTK（OpenGL渲染）**

OpenTK是.NET平台的OpenGL绑定库，在LightCAD中作为补充渲染后端：

- 直接GPU访问，实现高性能渲染
- 支持OpenGL 3.3+标准
- 用于需要低级图形控制的场景

### 1.3.3 UI框架

LightCAD使用混合UI架构：

- **Windows Forms**：作为主应用程序容器，管理窗口生命周期和顶层布局
- **Avalonia**：用于内部控件和面板，提供现代化的XAML声明式UI

这种混合方案充分利用了Windows Forms的成熟稳定性和Avalonia的现代化UI表达能力。

### 1.3.4 第三方依赖库

| 库名称 | 版本 | 用途 |
|--------|------|------|
| MathNet.Numerics | 5.0.0 | 高级数学运算 |
| System.Drawing.Common | 8.0.1 | 图形基元 |
| SignalR Client | 9.0.4 | 实时通信 |
| ThreeJs4Net | - | 3D图形渲染 |
| OpenTK | - | OpenGL绑定 |
| Flee | - | 表达式求值 |
| netDxf | - | DXF文件处理 |
| Weikio PluginFramework | - | 插件加载框架 |

## 1.4 LightCAD与其他CAD系统的对比

### 1.4.1 与AutoCAD的对比

| 对比维度 | LightCAD | AutoCAD |
|----------|----------|---------|
| 开源性 | 开源 | 商业闭源 |
| 开发语言 | C# (.NET 10) | C++/ObjectARX |
| 文件格式 | 兼容DWG/DXF | 原生DWG |
| 插件系统 | Weikio Plugin Framework | ObjectARX/.NET API |
| 二次开发 | C# | C++/C#/LISP/VBA |
| 运行平台 | Windows（可扩展跨平台） | Windows/Mac |
| 体积 | 轻量级 | 大型应用 |

### 1.4.2 与FreeCAD的对比

| 对比维度 | LightCAD | FreeCAD |
|----------|----------|---------|
| 开发语言 | C# | C++/Python |
| 建模内核 | 自研 | OpenCascade |
| UI框架 | WinForms+Avalonia | Qt |
| 参数化 | 支持 | 支持 |
| BIM支持 | 内置行业插件 | 通过工作台扩展 |
| 学习曲线 | 适中 | 较陡 |

### 1.4.3 与LibreCAD的对比

| 对比维度 | LightCAD | LibreCAD |
|----------|----------|----------|
| 维度 | 2D+3D | 仅2D |
| 开发语言 | C# | C++ |
| 3D建模 | 完整支持 | 不支持 |
| 实体建模 | 拉伸/旋转/放样等 | 不支持 |
| 渲染 | Three.js+OpenGL | Qt |

## 1.5 应用场景

LightCAD适用于以下应用场景：

### 1.5.1 建筑工程设计

通过内置的建筑（QdArch）、结构（QdStruct）、暖通（QdHvac）、电气（QdElectric）、给排水（QdWater）插件，LightCAD可以直接用于建筑工程的多专业协同设计。

### 1.5.2 CAD二次开发学习

LightCAD的开源特性和清晰的架构设计，使其成为学习CAD系统内部原理的绝佳教材。开发者可以深入了解：

- CAD数据模型如何组织
- 几何图元如何定义和渲染
- 视口交互如何实现
- 参数化建模如何工作
- 投影和视图生成算法

### 1.5.3 行业定制CAD开发

企业可以基于LightCAD进行行业定制：

- 开发专有的图元类型
- 实现行业特定的设计规范检查
- 集成企业内部的数据管理系统
- 构建自动化设计流程

### 1.5.4 BIM正向设计

作为飞扬集成设计平台的核心组件，LightCAD支持BIM（建筑信息模型）正向设计：

- 从二维方案到三维模型的完整工作流
- 参数化驱动的构件设计
- 多专业协同设计

## 1.6 快速体验

### 1.6.1 获取源代码

```bash
# 从GitHub克隆仓库
git clone https://github.com/znlgis/lightcad1.git

# 进入项目目录
cd lightcad1
```

### 1.6.2 项目结构一览

克隆完成后，可以看到以下项目结构：

```
lightcad1/
├── LightCAD1.sln                    # 解决方案文件
├── src/
│   ├── LightCAD.MathLib/            # 数学库
│   ├── LightCAD.Core/               # 核心数据模型
│   ├── LightCAD.RenderUtils/        # 渲染工具
│   ├── LightCAD.Drawing/            # 绘图模块
│   ├── LightCAD.Runtime/            # 运行时
│   ├── LightCAD.Model/              # UI模型控件
│   ├── LightCAD.WinForm/            # WinForm应用
│   ├── LightCAD.ImportAndExport/    # 导入导出
│   ├── LightCAD.Component.Actions/  # 组件操作
│   ├── LightCAD.PrjManager/         # 项目管理
│   ├── LightCAD.LocalSolution/      # 本地方案
│   ├── LightCAD.DBHelper/           # 数据库帮助
│   ├── LightCAD.DBUtility/          # 数据库工具
│   ├── Libs/                        # 第三方库（DLL）
│   ├── Plugins/                     # 预编译行业插件
│   ├── ThirdParty/                  # 第三方源码
│   └── netDxf/                      # DXF处理库
├── test/
│   ├── LightCAD.MathLib.Tests/      # 数学库测试
│   └── WinFormTest/                 # 窗体测试
└── QuickStart/                      # 快速入门示例
```

### 1.6.3 编译与运行

1. 使用Visual Studio 2026打开`LightCAD1.sln`
2. 确保已安装.NET 10 SDK
3. 将`LightCAD.WinForm`设为启动项目
4. 按F5编译并运行

首次编译可能需要还原NuGet包，请确保网络连接正常。编译成功后，将看到LightCAD的主界面窗口。

## 1.7 学习路线图

为了系统地掌握LightCAD的开发，建议按以下路线学习：

### 1.7.1 基础阶段（第1-4章）

- 了解整体架构和设计理念
- 搭建开发环境
- 熟悉分层设计原则
- 掌握数学库的使用

### 1.7.2 数据模型阶段（第5-8章）

- 深入理解核心数据模型
- 掌握二维/三维图元系统
- 学习实体建模操作

### 1.7.3 图形系统阶段（第9-12章）

- 理解渲染管线
- 掌握视口管理
- 学习视图构建
- 了解交互系统

### 1.7.4 应用开发阶段（第13-16章）

- 学习UI框架使用
- 掌握文件格式处理
- 开发插件扩展
- 实现自定义命令

### 1.7.5 进阶阶段（第17-20章）

- 了解数据库集成
- 掌握标注系统
- 优化性能
- 实战案例练习

## 1.8 本章小结

本章介绍了LightCAD的基本概念、核心特性和整体架构。LightCAD是一个功能完整、架构清晰的开源CAD平台，基于.NET 10构建，采用模块化分层设计，集成了Two.js/Three.js和OpenGL双渲染引擎，支持插件扩展和行业定制。

通过后续章节的学习，您将逐步深入LightCAD的各个核心模块，最终具备独立进行CAD二次开发的能力。

---

> **下一章**：[第二章：开发环境搭建与项目配置](https://znlgis.github.io/cad/LightCAD/第02章-开发环境搭建与项目配置/)

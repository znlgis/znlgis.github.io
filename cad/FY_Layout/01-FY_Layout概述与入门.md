---
layout: default
title: FY_Layout概述与入门
---

# 第一章：FY_Layout概述与入门

## 1.1 飞扬集成设计平台简介

### 1.1.1 平台定位与背景

飞扬集成设计平台（FY_Layout）是一个面向建筑工程设计行业的开源BIM正向设计支撑软件。该平台致力于融合二维设计、三维设计、BIM设计、智能设计、协同设计为一体，为建筑设计师和工程师提供一个完整的设计解决方案。

FY_Layout作为飞扬集成设计平台的场地布置二次开发插件示例，展示了如何基于LightCAD核心框架进行专业功能的扩展开发。这个项目不仅是一个功能完善的场布设计工具，更是一个优秀的CAD二次开发学习范例。

### 1.1.2 项目仓库信息

- **仓库地址**：https://gitee.com/qidaosoft/FY_Layout
- **授权协议**：CC-BY-NC 4.0
- **核心框架**：基于LightCAD/LightBIM平台
- **开发语言**：C#
- **开发环境**：Visual Studio 2026 社区版（17.14以上）
- **目标框架**：.NET 10 Windows

### 1.1.3 业务愿景

飞扬集成设计平台的核心业务愿景包括：

1. **功能精简化**：对流行的CAD系统进行功能裁剪，确保系统的简洁及稳定性
2. **开源透明**：对所有核心代码开源，文件格式开放，兼容DWG/DXF格式，并与主流模型格式互通
3. **插件体系**：建立统一管理的插件体系，确保插件间的互操作性，规范部署及自动发布
4. **二三维一体化**：实现与二维设计全兼容的三维组件体系，支持建筑、结构、机电专业的二三维组件设计

## 1.2 FY_Layout功能概述

### 1.2.1 核心功能模块

FY_Layout作为场地布置插件，提供了以下核心功能：

| 功能模块 | 说明 | 命令 |
|---------|------|------|
| 草坪（Lawn） | 绿化区域绘制，支持任意绘制、矩形绘制、多段线转换 | Lawn, LawnRec, LawnChange |
| 围栏（Fence） | 工地围挡绘制，支持自定义样式 | Fence |
| 拟建建筑（PlanBuild） | 规划建筑轮廓绘制 | PlanBuild |
| 基坑（FoundationPit） | 基坑开挖区域绘制，支持放坡计算 | FoundationPit, FoundationPitRec |
| 硬化地面（Ground） | 道路和硬化区域绘制 | Ground, GroundRec |
| 土方回填（Earthwork） | 土方回填区域标注 | Earthwork, EarthworkRec |
| 出土道路（Berm） | 出土运输路径绘制 | Berm |
| 防护栏杆（Barrier） | 安全防护设施绘制 | Barrier |
| 城市道路（Road） | 市政道路绘制 | Road |
| 场地（Site） | 场地边界绘制 | Site, SiteRec |
| 用地红线（PropertyLine） | 用地边界绘制 | PropertyLine, PropertyLineRec |
| 板房布置（PlateBuilding） | 临时建筑布置 | PlateBuilding |

### 1.2.2 技术特点

1. **二三维一体化**
   - 所有场布元素同时支持二维绘制和三维显示
   - 实时切换二维/三维视图
   - 统一的数据模型

2. **参数化设计**
   - 所有元素支持参数化定义
   - 支持实时参数修改
   - 自动更新图形显示

3. **多种创建方式**
   - 任意多边形绘制
   - 矩形快速绘制
   - 已有多段线转换

4. **专业化属性**
   - 基坑支持放坡系数设置
   - 土方支持标高设置
   - 材质和样式自定义

## 1.3 项目结构分析

### 1.3.1 解决方案结构

FY_Layout的项目结构如下：

```
FY_Layout/
├── LightBIM.sln                 # 解决方案文件
├── Libs/                        # 依赖库目录
│   ├── LightCAD.Core.dll
│   ├── LightCAD.Drawing.dll
│   ├── LightCAD.Drawing.Actions.dll
│   ├── LightCAD.MathLib.dll
│   ├── LightCAD.Model.dll
│   ├── LightCAD.Runtime.dll
│   ├── LightCAD.RenderUtils.dll
│   ├── ThreeJs4Net.dll
│   └── ...其他依赖
├── QdLayout/                    # 主插件项目
│   ├── QdLayout.csproj
│   ├── GlobalUsing.cs           # 全局using声明
│   ├── LayoutPlugin.cs          # 插件入口
│   ├── LayoutCmds.cs            # 命令定义
│   ├── LayoutElementType.cs     # 元素类型定义
│   ├── LcCurveChangeLoop.cs     # 曲线闭合工具
│   ├── Barrier/                 # 防护栏杆模块
│   ├── Berm/                    # 出土道路模块
│   ├── Earthwork/               # 土方回填模块
│   ├── Equipment/               # 设备模块
│   ├── Fence/                   # 围栏模块
│   ├── FoundationPit/           # 基坑模块
│   ├── Ground/                  # 硬化地面模块
│   ├── Harden/                  # 路面硬化模块
│   ├── Lawn/                    # 草坪模块
│   ├── OpenLine/                # 开门边线模块
│   ├── PlanBuild/               # 拟建建筑模块
│   ├── PlateHouse/              # 板房模块
│   ├── PropertyLine/            # 用地红线模块
│   ├── Road/                    # 道路模块
│   ├── Site/                    # 场地模块
│   ├── TemplateArrange/         # 模板排布模块
│   ├── Properties/              # 资源文件
│   └── Resources/               # 图标等资源
├── QdLayoutProvider/            # Provider项目
│   ├── QdLayoutProvider.csproj
│   ├── GlobalUsing.cs
│   ├── QdLayoutProviderRegist.cs
│   ├── QdBarrierProvider.cs
│   ├── QdBermProvider.cs
│   ├── QdEarthworkProvider.cs
│   ├── QdFenceProvider.cs
│   ├── QdFoundationPitProvider.cs
│   ├── QdGroundProvider.cs
│   ├── QdHardenProvider.cs
│   ├── QdIntersectionProvider.cs
│   ├── QdLawnProvider.cs
│   └── QdSiteProvider.cs
├── Build/                       # 编译输出目录
└── 飞扬主程序/                  # 主程序文件夹
```

### 1.3.2 核心依赖说明

| 依赖库 | 功能说明 |
|-------|---------|
| LightCAD.Core | 核心框架，包含文档、元素、事务等基础类 |
| LightCAD.Drawing | 二维绘图引擎 |
| LightCAD.Drawing.Actions | 绘图操作和交互处理 |
| LightCAD.MathLib | 数学库，包含几何运算、CSG等 |
| LightCAD.Model | 模型定义 |
| LightCAD.Runtime | 运行时环境 |
| LightCAD.RenderUtils | 渲染工具 |
| ThreeJs4Net | 三维渲染引擎（基于OpenGL的Three.js .NET实现） |
| Newtonsoft.Json | JSON序列化 |
| Svg | SVG处理 |
| netDxf | DXF文件处理 |

## 1.4 快速开始

### 1.4.1 环境准备

1. **安装Visual Studio 2026**
   - 版本要求：17.14或更高版本
   - 安装.NET桌面开发工作负载
   - 安装.NET 10 SDK

2. **克隆代码仓库**
   ```bash
   git clone https://gitee.com/qidaosoft/FY_Layout.git
   cd FY_Layout
   ```

3. **打开解决方案**
   - 使用VS2022打开`LightBIM.sln`

### 1.4.2 编译与运行

1. **还原NuGet包**
   - 解决方案会自动还原依赖包

2. **选择配置**
   - 配置选择：Debug 或 Release
   - 平台：Any CPU

3. **编译项目**
   - 按F6或选择"生成→生成解决方案"
   - 编译输出到`Build`目录

4. **调试运行**
   - 主程序位于`飞扬主程序`文件夹下的`lightcad.EXE`
   - 支持VS2022附加进程断点调试

### 1.4.3 项目配置说明

QdLayout项目的csproj文件关键配置：

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <BaseOutputPath>..\Build</BaseOutputPath>
  </PropertyGroup>
  
  <!-- 引用LightCAD核心库 -->
  <ItemGroup>
    <Reference Include="LightCAD.Core">
      <HintPath>..\Libs\LightCAD.Core.dll</HintPath>
    </Reference>
    <!-- 其他引用... -->
  </ItemGroup>
</Project>
```

## 1.5 架构概览

### 1.5.1 插件架构

FY_Layout采用标准的LightCAD插件架构：

```
┌─────────────────────────────────────────────────────────┐
│                   LightCAD 主程序                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  ILcPlugin   │  │  LcDocument  │  │  LcRuntime   │  │
│  │  插件接口    │  │  文档管理    │  │  运行时环境  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   QdLayout 插件                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │LayoutPlugin  │  │ LayoutCmds   │  │ElementTypes  │  │
│  │  插件入口    │  │  命令定义    │  │  元素类型    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │                场布元素模块                        │  │
│  │  Lawn | Fence | FoundationPit | PlanBuild | ...  │  │
│  └──────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                 QdLayoutProvider                         │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │           参数化三维模型生成器                     │  │
│  │  QdLawnProvider | QdFoundationPitProvider | ...  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.5.2 元素模型

每个场布元素都遵循统一的模型架构：

```
ElementType（元素类型定义）
    ↓
Element（元素实例）
    ├── 属性数据（Properties）
    ├── 几何数据（Geometry）
    └── 样式数据（Style）
    
ElementAction（元素操作类）
    ├── Draw() - 二维绘制
    ├── GetControlGrips() - 控制点
    └── SetDragGrip() - 夹点编辑

Element3dAction（三维操作类）
    └── Get3dObject() - 三维对象生成
```

### 1.5.3 命令系统

LightCAD使用特性标记的命令系统：

```csharp
[CommandClass]
public class LayoutCmds
{
    [CommandMethod(Name = "Lawn", ShortCuts = "LW")]
    public CommandResult DrawLawn(IDocumentEditor docEditor, string[] args)
    {
        var lawnAction = new LawnAction(docEditor);
        lawnAction.ExecCreatePoly(args);
        return CommandResult.Succ();
    }
}
```

## 1.6 学习路径建议

### 1.6.1 基础阶段

1. **熟悉C#语言**
   - 掌握面向对象编程
   - 理解async/await异步编程
   - 了解泛型和委托

2. **了解CAD基础概念**
   - 坐标系统
   - 图层管理
   - 几何图形

3. **学习LightCAD框架**
   - 文档结构
   - 元素类型
   - 事务机制

### 1.6.2 进阶阶段

1. **插件开发**
   - ILcPlugin接口实现
   - 命令系统
   - UI集成

2. **元素开发**
   - 自定义元素类型
   - ElementAction实现
   - 属性编辑器

3. **三维渲染**
   - ThreeJs4Net基础
   - 材质与纹理
   - 模型生成

### 1.6.3 高级阶段

1. **参数化设计**
   - Provider系统
   - 参数表达式
   - 动态模型

2. **复杂交互**
   - 夹点编辑
   - 捕捉系统
   - 实时预览

3. **性能优化**
   - 绘图优化
   - 内存管理
   - 异步处理

## 1.7 本章小结

本章介绍了FY_Layout的基本概念、项目结构和快速入门方法。FY_Layout是一个功能完善的场地布置插件，同时也是学习LightCAD二次开发的优秀范例。

通过学习本教程，您将能够：
- 理解LightCAD插件开发的基本架构
- 掌握场布元素的实现方法
- 学会二维绘制和三维渲染的技术
- 具备独立开发CAD插件的能力

下一章我们将详细介绍开发环境的搭建和项目配置。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="02-开发环境搭建与项目配置" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

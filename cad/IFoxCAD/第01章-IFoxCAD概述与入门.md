---
layout: default
title: 第一章：IFoxCAD概述与入门
---

# 第一章：IFoxCAD概述与入门

## 1.1 IFoxCAD简介

### 1.1.1 什么是IFoxCAD

IFoxCAD是一个基于.NET的AutoCAD/中望CAD二次开发类库，它是由落魄山人基于雪山飞狐（狐哥）的NFox类库重构而来的开源项目。IFoxCAD的命名寓意为"I(爱)Fox(狐哥)"，这不仅是对原作者的致敬，也体现了开发者对CAD二次开发的热爱与追求。

IFoxCAD的核心设计理念是提供一个"最小化的内核"，即DBTrans、SymbolTable、ResultData、SelectFilter等基础类作为核心功能，而其他丰富的功能都通过扩展方法的方式来实现。这种设计使得类库既保持了简洁性，又具备了强大的扩展能力。

### 1.1.2 IFoxCAD的发展历程

IFoxCAD的发展经历了几个重要的阶段：

**第一阶段：NFox类库的诞生**

雪山飞狐（狐哥）在明经论坛发布了最初的开源库，这是IFoxCAD的前身。这个开源库为CAD二次开发提供了很多便利的封装，受到了开发者的广泛欢迎。后来，狐哥对自己的项目进行了极大的丰富，形成了完整的NFox类库。

**第二阶段：NFox类库的整理与发布**

落魄山人在征得雪山飞狐的同意后，对NFox类库进行了系统的整理，增加了详细的注释说明，使得类库更加易于理解和使用。整理后的NFox类库得到了更广泛的传播和应用。

**第三阶段：IFoxCAD的诞生**

由于种种原因，NFox类库后来无法继续维护。此时落魄山人已经完全理解了NFox类库的设计思想，考虑到原有封装过于复杂，初学者理解起来困难，于是决定进行重构。重构后的类库被命名为IFoxCAD，发布于Inspire Function（中文名：跃动方程）组织下。

### 1.1.3 IFoxCAD的设计理念

IFoxCAD的设计理念主要体现在以下几个方面：

**最小化内核设计**

IFoxCAD采用最小化内核的设计理念，核心类只包含DBTrans、SymbolTable、ResultData、SelectFilter等基础类。这些类提供了CAD二次开发中最核心的功能：事务管理、符号表操作、扩展数据处理和选择集过滤。通过这种设计，开发者可以快速理解类库的核心概念，而不需要被复杂的继承层次所困扰。

**扩展方法优先**

除了核心类之外，IFoxCAD的其他功能都通过扩展方法来实现。这种设计有几个优点：首先，扩展方法可以直接在现有的CAD API对象上调用，使用起来非常自然；其次，扩展方法可以根据需要选择性地使用，不会增加核心类的复杂度；最后，扩展方法便于开发者根据自己的需求进行扩展和定制。

**面向事务的编程模式**

CAD本身推荐使用事务（Transaction）来对数据库进行增删改操作，但是默认的Transaction类提供的方法较少，每次操作都需要手动进行大量的重复性操作。IFoxCAD的DBTrans类延续了CAD的事务思路，对事务操作进行了深度封装，使得事务管理变得简单而优雅。

**易于入门和学习**

IFoxCAD的设计充分考虑了初学者的学习曲线。通过最小化内核和丰富的扩展方法，初学者可以从简单的事务操作开始，逐步深入到更复杂的功能。同时，类库中的代码注释详细，文档齐全，降低了学习门槛。

## 1.2 IFoxCAD的架构设计

### 1.2.1 AutoCAD .NET API架构回顾

在深入了解IFoxCAD之前，我们需要先回顾一下AutoCAD .NET API的基本架构。AutoCAD的.NET API采用了层次化的对象模型设计。

**Application对象层**

Application是AutoCAD应用程序的顶级对象，它包含了以下主要成员：
- DocumentManager：文档管理器，管理所有打开的文档
- DocumentWindowCollection：文档窗口集合
- MainWindow：主窗口
- MenuBar：菜单栏
- MenuGroups：菜单组
- Preferences：用户偏好设置
- StatusBar：状态栏
- UserConfigurationManager：用户配置管理器

**Document对象层**

Document对象代表一个打开的DWG文档，它包含了以下主要成员：
- Database：文档的数据库，存储所有的图元和设置
- Editor：编辑器，提供用户交互功能
- GraphicsManager：图形管理器
- TransactionManager：事务管理器
- Window：文档窗口

**Database对象层**

Database是CAD数据库的核心，它包含了所有的图形数据和设置。数据库主要由两部分组成：
- Tables（符号表）：包括BlockTable（块表）、LayerTable（图层表）、LinetypeTable（线型表）等九大符号表
- NamedDictionaries（命名字典）：包括Layout字典、组字典、材质字典等

**Transaction对象层**

Transaction是CAD数据库操作的核心机制。所有对数据库的修改都应该在事务中进行。事务的基本流程是：
1. 开始事务（StartTransaction）
2. 修改对象
3. 提交（Commit）或放弃（Abort）事务

### 1.2.2 IFoxCAD的项目结构

IFoxCAD采用了清晰的项目结构，主要包含以下目录和文件：

```
IFoxCAD/
├── bin/                      -- 用于放置生成的nuget包和dll
├── docs/                     -- 架构及API定义说明文档
├── src/                      -- 源码目录
│   ├── CADShared/            -- 共享项目，所有的核心代码都在这里
│   │   ├── Algorithms/       -- 基础算法和数据结构
│   │   ├── Assoc/            -- 关联函数
│   │   ├── Basal/            -- 基础类的函数
│   │   ├── ExtensionMethod/  -- 扩展函数（核心扩展方法）
│   │   ├── Initialize/       -- 初始化相关
│   │   ├── PE/               -- PE相关
│   │   ├── ResultData/       -- 扩展数据处理
│   │   ├── Runtime/          -- 核心运行时类
│   │   └── SelectionFilter/  -- 选择集过滤器类
│   ├── IFoxCAD.AutoCad/      -- AutoCAD的类库项目
│   └── IFoxCAD.ZwCad/        -- 中望CAD的类库项目
└── tests/                    -- 测试类
    ├── TestAcad2025/         -- AutoCAD测试
    ├── TestShared/           -- 共享测试代码
    └── TestZcad2025/         -- 中望CAD测试
```

**CADShared共享项目**

这是IFoxCAD的核心代码所在，使用共享项目的方式可以让同一套代码同时支持AutoCAD和中望CAD。主要模块包括：

- **Runtime目录**：包含DBTrans、SymbolTable、Env等核心运行时类
- **ExtensionMethod目录**：包含大量的扩展方法，如EditorEx、EntityEx、DatabaseEx等
- **SelectionFilter目录**：包含选择集过滤器相关的类
- **ResultData目录**：包含扩展数据处理相关的类

**IFoxCAD.AutoCad和IFoxCAD.ZwCad项目**

这两个项目主要包含GlobalUsings和项目配置，实际的代码都在CADShared共享项目中。这种设计使得同一套代码可以同时支持AutoCAD和中望CAD两个平台。

### 1.2.3 IFoxCAD的核心类

IFoxCAD的核心类主要包括：

**DBTrans类**

DBTrans是IFoxCAD最核心的类，它封装了CAD的Transaction类，提供了统一的事务管理接口。DBTrans类的主要特点包括：

- 封装了文档、数据库、编辑器、事务等常用对象
- 提供了九大符号表的访问属性
- 提供了各种命名字典的访问属性
- 支持前台文档、后台数据库和文件三种操作模式
- 支持自动提交和手动控制事务

**SymbolTable类**

SymbolTable是符号表的统一管理类，它可以处理CAD的九大符号表：
- BlockTable（块表）
- LayerTable（图层表）
- LinetypeTable（线型表）
- TextStyleTable（文字样式表）
- DimStyleTable（标注样式表）
- RegAppTable（注册应用程序表）
- UcsTable（用户坐标系表）
- ViewTable（视图表）
- ViewportTable（视口表）

**OpFilter类**

OpFilter是选择集过滤器的基类，提供了构建复杂过滤器的能力。通过操作符重载和链式调用，可以方便地构建各种过滤条件。

**ResultData相关类**

包括XDataList、XRecordDataList、LispList等，用于处理CAD的扩展数据。

## 1.3 环境搭建与准备

### 1.3.1 开发环境要求

在开始使用IFoxCAD进行开发之前，需要准备以下开发环境：

**操作系统**

- Windows 10或更高版本（推荐Windows 11）
- 64位操作系统

**开发工具**

- Visual Studio 2022或更高版本（推荐使用最新版本）
- 建议安装.NET桌面开发工作负载

**目标CAD软件**

- AutoCAD 2019或更高版本
- 或中望CAD 2021或更高版本

**SDK和框架**

- .NET Framework 4.8（用于支持较老版本的CAD）
- .NET 8.0/10（.NET 10为最新LTS版本，推荐用于新版本CAD）

### 1.3.2 获取IFoxCAD

IFoxCAD可以通过以下几种方式获取：

**通过NuGet包管理器安装**

这是最推荐的方式。在Visual Studio中，可以通过NuGet包管理器搜索"IFox.CAD"并安装。根据目标CAD版本选择相应的包：
- IFox.CAD.ACAD - 用于AutoCAD开发
- IFox.CAD.ZCAD - 用于中望CAD开发

**通过源码编译**

如果需要修改或扩展IFoxCAD，可以从GitHub克隆源码：
```
git clone https://github.com/znlgis/IFoxCAD.git
```

然后使用Visual Studio打开IFoxCAD.sln解决方案文件，编译生成所需的dll。

### 1.3.3 创建第一个IFoxCAD项目

下面我们来创建第一个使用IFoxCAD的项目：

**步骤1：创建类库项目**

在Visual Studio中创建一个新的类库项目：
- 项目类型：类库（.NET Framework）或类库（.NET）
- 目标框架：根据目标CAD版本选择相应的.NET版本

**步骤2：添加NuGet包引用**

通过NuGet包管理器添加以下包引用：
- IFox.CAD.ACAD 或 IFox.CAD.ZCAD
- 对应版本的AutoCAD.NET API包

**步骤3：创建初始化类**

创建一个类来实现插件的初始化：

```csharp
using IFoxCAD.Cad;
using Autodesk.AutoCAD.Runtime;

[assembly: CommandClass(typeof(MyPlugin.Commands))]

namespace MyPlugin
{
    public class Commands
    {
        [CommandMethod("Hello")]
        public void HelloWorld()
        {
            using var tr = new DBTrans();
            tr.Editor?.WriteMessage("\n欢迎使用IFoxCAD！");
        }
    }
}
```

**步骤4：配置调试**

在项目属性中配置调试选项：
- 启动外部程序：选择acad.exe的路径
- 命令行参数：可以添加/nologo等参数

**步骤5：编译和测试**

编译项目，然后在AutoCAD中使用NETLOAD命令加载生成的dll文件，输入Hello命令测试。

## 1.4 IFoxCAD的使用方式

### 1.4.1 IFoxCAD的版本说明

目前IFoxCAD的最新版本为v0.9.9.1，同时也维护着多个历史版本。每个版本都有其特点和适用场景：

- **0.5版本**：早期稳定版本，API相对稳定
- **0.6版本**：过渡版本，进行了一些API调整
- **0.7版本**：中间版本，包含许多改进
- **0.9版本**（最新）：v0.9.9.1，包含最新特性，支持AutoCAD/ZWCAD/GStarCAD 2026+

建议新项目使用最新的0.9版本，以获得最完整的功能支持和最新CAD版本兼容。

### 1.4.2 使用NuGet包引用

使用NuGet包是最简单的方式。在.csproj文件中添加包引用：

```xml
<ItemGroup>
  <PackageReference Include="IFox.CAD.ACAD" Version="0.9.*" />
</ItemGroup>
```

或者通过Visual Studio的NuGet包管理器界面添加。

### 1.4.3 使用项目模板

IFoxCAD提供了项目模板，可以快速创建符合规范的CAD插件项目：

**VS模板插件**

可以在Visual Studio扩展市场搜索IFoxCAD模板插件安装。安装后，在创建新项目时可以选择IFoxCAD项目模板。

**NET项目模板**

推荐使用.NET项目模板来创建项目。可以通过以下命令安装模板：
```
dotnet new install IFoxCAD.Templates
```

然后使用以下命令创建项目：
```
dotnet new ifoxcad -n MyProject
```

### 1.4.4 GlobalUsings配置

为了简化代码，建议在项目中配置GlobalUsings。创建GlobalUsings.cs文件：

```csharp
global using Autodesk.AutoCAD.ApplicationServices;
global using Autodesk.AutoCAD.DatabaseServices;
global using Autodesk.AutoCAD.EditorInput;
global using Autodesk.AutoCAD.Geometry;
global using Autodesk.AutoCAD.Runtime;
global using IFoxCAD.Cad;
```

这样在其他代码文件中就不需要重复写这些using语句了。

## 1.5 第一个IFoxCAD程序详解

### 1.5.1 HelloWorld程序分析

让我们详细分析前面创建的HelloWorld程序：

```csharp
using IFoxCAD.Cad;
using Autodesk.AutoCAD.Runtime;

[assembly: CommandClass(typeof(MyPlugin.Commands))]

namespace MyPlugin
{
    public class Commands
    {
        [CommandMethod("Hello")]
        public void HelloWorld()
        {
            using var tr = new DBTrans();
            tr.Editor?.WriteMessage("\n欢迎使用IFoxCAD！");
        }
    }
}
```

**命令类注册**

`[assembly: CommandClass(typeof(MyPlugin.Commands))]`这行代码将Commands类注册为命令类。AutoCAD在加载插件时会扫描带有此特性的类。

**命令方法定义**

`[CommandMethod("Hello")]`特性将HelloWorld方法注册为CAD命令。用户在命令行输入"Hello"时，这个方法会被调用。

**创建事务**

`using var tr = new DBTrans();`创建了一个DBTrans事务对象。使用using语句可以确保事务在使用完毕后被正确释放。DBTrans的默认构造函数会打开当前活动文档，并自动提交事务。

**输出消息**

`tr.Editor?.WriteMessage("\n欢迎使用IFoxCAD！");`通过编辑器对象向命令行输出消息。这里使用了空条件运算符(?.)来避免可能的空引用异常。

### 1.5.2 绘制简单图形

下面我们来创建一个绘制直线的命令：

```csharp
[CommandMethod("DrawLine")]
public void DrawLine()
{
    using var tr = new DBTrans();
    
    // 创建直线对象
    var line = new Line(new Point3d(0, 0, 0), new Point3d(100, 100, 0));
    
    // 将直线添加到当前空间
    tr.CurrentSpace.AddEntity(line);
    
    tr.Editor?.WriteMessage("\n已绘制一条直线！");
}
```

这个例子展示了IFoxCAD的基本工作流程：
1. 创建DBTrans事务
2. 创建图元对象
3. 将图元添加到数据库
4. 事务自动提交（using语句结束时）

### 1.5.3 图层操作示例

接下来我们来看看如何操作图层：

```csharp
[CommandMethod("CreateLayer")]
public void CreateLayer()
{
    using var tr = new DBTrans();
    
    // 添加新图层
    tr.LayerTable.Add("MyLayer", layer =>
    {
        layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 1); // 红色
        layer.LineWeight = LineWeight.LineWeight030; // 线宽0.30
    });
    
    // 在新图层上绘制圆
    var circle = new Circle(new Point3d(50, 50, 0), Vector3d.ZAxis, 25);
    circle.Layer = "MyLayer";
    tr.CurrentSpace.AddEntity(circle);
    
    tr.Editor?.WriteMessage("\n已创建图层并绘制圆！");
}
```

这个例子展示了：
- 如何使用LayerTable添加新图层
- 如何设置图层的属性（颜色、线宽等）
- 如何将图元添加到指定图层

### 1.5.4 选择图元示例

下面是一个选择图元的示例：

```csharp
[CommandMethod("SelectEntities")]
public void SelectEntities()
{
    using var tr = new DBTrans();
    
    // 构建过滤器：选择所有直线和圆
    var filter = OpFilter.Build(e => 
        e.Dxf(0) == "LINE" | e.Dxf(0) == "CIRCLE");
    
    // 提示用户选择
    var result = tr.Editor?.GetSelection(filter);
    
    if (result?.Status == PromptStatus.OK)
    {
        var count = result.Value.Count;
        tr.Editor?.WriteMessage($"\n共选择了 {count} 个图元！");
    }
}
```

这个例子展示了：
- 如何使用OpFilter构建选择集过滤器
- 如何使用Editor获取用户选择
- 如何处理选择结果

## 1.6 常见问题与解决方案

### 1.6.1 事务相关问题

**问题1：忘记释放事务**

如果不使用using语句或忘记调用Dispose，事务可能不会被正确提交或释放，导致数据丢失或内存泄漏。

**解决方案**：始终使用using语句或try-finally确保事务被释放：
```csharp
using var tr = new DBTrans();
// 或者
try
{
    var tr = new DBTrans();
    // 操作
}
finally
{
    tr?.Dispose();
}
```

**问题2：跨文档操作错误**

当需要操作非当前文档时，可能会遇到"eNotFromThisDocument"错误。

**解决方案**：使用正确的构造函数创建DBTrans，并确保锁定文档：
```csharp
using var tr = new DBTrans(targetDocument, true, true); // 锁定文档
```

### 1.6.2 图元操作问题

**问题1：图元不显示**

添加图元后没有显示在图形中。

**解决方案**：
- 确保事务被正确提交
- 确保图元添加到了正确的块表记录
- 检查图元的图层是否被冻结或关闭

**问题2：修改图元后不生效**

修改了图元的属性但没有生效。

**解决方案**：修改图元前需要打开写模式：
```csharp
var ent = tr.GetObject<Entity>(id, OpenMode.ForWrite);
ent.Color = Color.FromColorIndex(ColorMethod.ByAci, 1);
```

### 1.6.3 编译和加载问题

**问题1：找不到类型或命名空间**

编译时提示找不到IFoxCAD相关的类型。

**解决方案**：
- 确保正确安装了NuGet包
- 检查项目的目标框架是否正确
- 确保添加了正确的GlobalUsings

**问题2：加载插件时出错**

使用NETLOAD加载插件时出错。

**解决方案**：
- 检查dll是否与CAD版本匹配
- 检查是否有依赖项缺失
- 查看AutoCAD的日志文件获取详细错误信息

## 1.7 学习资源与社区

### 1.7.1 官方资源

**IFoxCAD官方文档**

IFoxCAD的官方文档是学习的首选资源：
- 项目文档：《IFoxCAD类库从入门到精通》
- API文档：IFoxCAD API文档

**GitHub仓库**

- 源码仓库：https://github.com/znlgis/IFoxCAD
- 可以在Issues中提交问题和建议

### 1.7.2 社区交流

**QQ群**

可以加入IFoxCad交流群进行交流学习，群内有很多经验丰富的开发者可以帮助解答问题。

**QQ频道**

由于QQ群为丐群，也可以加入QQ频道【CAD二次开发】进行交流。

### 1.7.3 学习建议

**对于初学者**

1. 首先熟悉AutoCAD的基本操作和概念
2. 学习C#编程基础
3. 了解AutoCAD .NET API的基本架构
4. 从简单的命令开始，逐步深入
5. 多阅读IFoxCAD的源码和示例

**对于有经验的开发者**

1. 直接阅读IFoxCAD的架构说明文档
2. 研究DBTrans和SymbolTable的实现原理
3. 探索扩展方法的使用技巧
4. 参与IFoxCAD的开发和贡献

## 1.8 本章小结

本章我们全面介绍了IFoxCAD类库的概况：

1. **IFoxCAD简介**：介绍了IFoxCAD的起源、发展历程和设计理念
2. **架构设计**：回顾了AutoCAD .NET API的架构，介绍了IFoxCAD的项目结构和核心类
3. **环境搭建**：介绍了开发环境要求和项目创建流程
4. **使用方式**：介绍了IFoxCAD的版本和不同的使用方式
5. **入门示例**：通过HelloWorld、绘制图形、图层操作、选择图元等示例展示了IFoxCAD的基本用法
6. **常见问题**：列举了常见问题及解决方案
7. **学习资源**：介绍了官方资源和社区交流渠道

通过本章的学习，读者应该对IFoxCAD有了初步的了解，并能够创建简单的CAD插件程序。在接下来的章节中，我们将深入学习IFoxCAD的各个核心模块，掌握更多的开发技巧。

下一章我们将详细介绍DBTrans事务管理类，这是IFoxCAD最核心的类，也是进行CAD二次开发的基础。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第02章-DBTrans事务管理核心教程" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

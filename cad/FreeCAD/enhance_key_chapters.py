#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Enhance key chapters with detailed content

ch21_content = """# 第21章：FreeCAD架构解析

## 21.1 FreeCAD整体架构

### 21.1.1 架构概述

FreeCAD采用模块化的分层架构设计，主要分为以下几层：

**应用层（App）**
- 非GUI的核心功能层
- 包含文档对象模型
- 实现参数化建模逻辑
- 独立于图形界面

**界面层（Gui）**
- 基于Qt的图形用户界面
- 视图和控制器组件
- 用户交互处理
- 可视化渲染

**基础层（Base）**
- 基础类和工具函数
- 向量、矩阵等数学类
- 文件I/O操作
- 异常处理机制

**模块层（Mod）**
- 各种功能模块（工作台）
- 可插拔的扩展机制
- 独立的功能单元

### 21.1.2 核心组件

**1. 文档对象（Document Object）**

FreeCAD中的所有对象都继承自DocumentObject基类：

```python
import FreeCAD

# 文档对象是FreeCAD的基本单位
obj = FreeCAD.ActiveDocument.addObject("Part::Box", "MyBox")
print(type(obj))  # <class 'Part.Box'>
```

**2. 属性系统（Property System）**

FreeCAD使用强大的属性系统管理对象数据：

- Property：基础属性类
- PropertyString、PropertyFloat、PropertyVector等具体类型
- 支持属性链接和表达式

```python
# 添加自定义属性
obj.addProperty("App::PropertyLength", "CustomLength")
obj.CustomLength = 50.0
```

**3. 视图提供者（View Provider）**

每个DocumentObject都有对应的ViewProvider控制其显示：

```python
# 访问视图属性
view = obj.ViewObject
view.ShapeColor = (1.0, 0.0, 0.0)  # 设置为红色
view.Transparency = 50
```

## 21.2 OpenCASCADE几何内核

### 21.2.1 OpenCASCADE简介

OpenCASCADE是FreeCAD的几何建模引擎，提供：

- BRep（边界表示）实体建模
- NURBS曲线曲面
- 布尔运算
- 拓扑数据结构

### 21.2.2 几何类型

**TopoDS形状层次**

```
TopoDS_Shape（基类）
├── TopoDS_Compound（复合体）
├── TopoDS_CompSolid（复合实体）
├── TopoDS_Solid（实体）
├── TopoDS_Shell（壳）
├── TopoDS_Face（面）
├── TopoDS_Wire（线框）
├── TopoDS_Edge（边）
└── TopoDS_Vertex（顶点）
```

### 21.2.3 在FreeCAD中使用OCC

```python
import Part

# 创建基本形状
box = Part.makeBox(10, 10, 10)
print(type(box))  # <class 'Part.Shape'>

# 访问拓扑元素
print(f"顶点数: {len(box.Vertexes)}")
print(f"边数: {len(box.Edges)}")
print(f"面数: {len(box.Faces)}")
```

## 21.3 Qt图形界面框架

### 21.3.1 Qt在FreeCAD中的角色

FreeCAD使用Qt 5作为GUI框架：

- 主窗口和对话框
- 工具栏和菜单
- 面板和停靠窗口
- 事件处理

### 21.3.2 PySide2集成

Python通过PySide2访问Qt功能：

```python
from PySide2 import QtWidgets, QtCore, QtGui

# 创建自定义对话框
class MyDialog(QtWidgets.QDialog):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("自定义对话框")
        layout = QtWidgets.QVBoxLayout()
        layout.addWidget(QtWidgets.QLabel("Hello FreeCAD!"))
        self.setLayout(layout)
```

## 21.4 Coin3D渲染引擎

### 21.4.1 Coin3D简介

Coin3D是OpenInventor的开源实现，负责FreeCAD的3D渲染：

- 场景图管理
- 实时3D渲染
- 交互式操作
- 硬件加速

### 21.4.2 Pivy Python绑定

Pivy提供Python访问Coin3D的能力：

```python
from pivy import coin

# 创建场景节点
root = coin.SoSeparator()
material = coin.SoMaterial()
material.diffuseColor = (1, 0, 0)
root.addChild(material)

cube = coin.SoCube()
root.addChild(cube)
```

## 21.5 Python集成

### 21.5.1 Python在FreeCAD中的角色

Python是FreeCAD的第一公民：

- 脚本自动化
- 宏录制
- 插件开发
- 自定义工作台

### 21.5.2 Python解释器

FreeCAD内置CPython解释器：

```python
import sys
print(f"Python版本: {sys.version}")
print(f"FreeCAD版本: {FreeCAD.Version()}")
```

### 21.5.3 C++与Python的交互

FreeCAD使用以下技术实现C++和Python的互操作：

- Boost.Python：C++类导出到Python
- 自动生成的Python绑定
- 双向调用支持

## 21.6 文档模型

### 21.6.1 Document类

Document是FreeCAD的核心容器：

```python
import FreeCAD

# 创建新文档
doc = FreeCAD.newDocument("MyDoc")

# 文档属性
print(doc.Name)
print(doc.FileName)
print(doc.Label)

# 文档操作
doc.save()
doc.recompute()
```

### 21.6.2 对象图

文档中的对象形成有向无环图（DAG）：

- 对象之间可以相互引用
- 形成依赖关系
- 支持参数化更新

```python
# 创建对象依赖
box = doc.addObject("Part::Box", "Box")
box.Length = 10

# 创建依赖于box的对象
fillet = doc.addObject("Part::Fillet", "Fillet")
fillet.Base = box
fillet.Edges = [(1, 2.0)]

doc.recompute()  # 更新整个依赖链
```

### 21.6.3 撤销/重做机制

FreeCAD实现了事务性撤销系统：

```python
# 开始事务
doc.openTransaction("Create Box")

box = doc.addObject("Part::Box", "Box")
box.Length = 20

# 提交事务
doc.commitTransaction()

# 撤销
doc.undo()

# 重做
doc.redo()
```

## 21.7 工作台架构

### 21.7.1 工作台结构

每个工作台是一个独立的模块：

```
Mod/Part/
├── Init.py          # 模块初始化
├── InitGui.py       # GUI初始化
├── App/            # 应用层代码（C++）
├── Gui/            # 界面层代码（C++）
└── Resources/      # 资源文件（图标、UI等）
```

### 21.7.2 工作台生命周期

```python
class MyWorkbench(Workbench):
    """自定义工作台"""
    
    def Initialize(self):
        """工作台激活时调用"""
        import MyCommands
        self.appendToolbar("My Tools", ["Cmd1", "Cmd2"])
        self.appendMenu("My Menu", ["Cmd1", "Cmd2"])
    
    def Activated(self):
        """切换到此工作台时调用"""
        print("工作台已激活")
    
    def Deactivated(self):
        """离开此工作台时调用"""
        print("工作台已停用")
    
    def GetClassName(self):
        return "Gui::PythonWorkbench"

# 注册工作台
FreeCADGui.addWorkbench(MyWorkbench())
```

## 21.8 命令系统

### 21.8.1 命令模式

FreeCAD使用命令模式实现用户操作：

```python
class MyCommand:
    """自定义命令"""
    
    def GetResources(self):
        return {
            'Pixmap': 'my_icon.svg',
            'MenuText': '我的命令',
            'ToolTip': '执行我的操作'
        }
    
    def IsActive(self):
        """命令是否可用"""
        return FreeCAD.ActiveDocument is not None
    
    def Activated(self):
        """命令执行"""
        print("命令已执行")

# 注册命令
FreeCADGui.addCommand('MyCommand', MyCommand())
```

### 21.8.2 命令生命周期

1. 创建命令对象
2. 检查IsActive()
3. 调用Activated()
4. 执行具体操作

## 21.9 参数化引擎

### 21.9.1 表达式引擎

FreeCAD支持在属性中使用表达式：

```python
# 使用表达式
box = doc.addObject("Part::Box", "Box")
box.setExpression("Length", "10 * 2")
box.setExpression("Width", "Box.Length / 2")

# 获取表达式
expr = box.getExpression("Length")
print(expr)  # "10 * 2"
```

### 21.9.2 依赖图

参数化建模依赖于对象依赖图：

- 自动检测循环依赖
- 拓扑排序计算顺序
- 增量更新机制

```python
# 查看对象依赖
deps = box.OutList  # box依赖的对象
refs = box.InList   # 依赖box的对象
```

## 21.10 文件格式

### 21.10.1 FCStd格式

FreeCAD的原生格式是ZIP压缩包：

```
MyProject.FCStd (ZIP文件)
├── Document.xml        # 文档结构
├── GuiDocument.xml     # GUI设置
├── PartShape.brp       # Part形状数据
└── thumbnails/         # 缩略图
    └── Thumbnail.png
```

### 21.10.2 读写文件

```python
# 保存文档
doc.save("/path/to/file.FCStd")

# 打开文档
doc = FreeCAD.open("/path/to/file.FCStd")

# 导入/导出
import ImportGui
ImportGui.insert("/path/to/file.step", "MyDoc")
```

## 21.11 插件机制

### 21.11.1 插件加载

FreeCAD在启动时自动加载Mod目录下的模块：

1. 扫描Mod目录
2. 执行Init.py
3. 如果有GUI，执行InitGui.py
4. 注册工作台和命令

### 21.11.2 外部工作台

用户可以将外部工作台安装到：

- Windows: `%APPDATA%\FreeCAD\Mod\`
- Linux: `~/.local/share/FreeCAD/Mod/`
- macOS: `~/Library/Application Support/FreeCAD/Mod/`

## 21.12 多线程架构

### 21.12.1 线程模型

FreeCAD主要在主线程运行，但支持：

- 后台重新计算
- 异步文件加载
- 多线程渲染（部分功能）

### 21.12.2 线程安全

注意事项：

- GUI操作必须在主线程
- 文档对象访问需要加锁
- 使用Qt的信号槽机制跨线程通信

## 21.13 扩展点

### 21.13.1 主要扩展点

FreeCAD提供多个扩展点：

1. **自定义对象类型**
   - FeaturePython对象
   - ViewProviderPython
   
2. **自定义命令**
   - Command类
   - 工具栏和菜单
   
3. **自定义工作台**
   - Workbench类
   - 完整的UI定制
   
4. **自定义文件格式**
   - 导入/导出器
   
5. **自定义求解器**
   - 有限元分析
   - 约束求解

### 21.13.2 扩展开发流程

1. 确定扩展类型
2. 创建模块目录结构
3. 实现核心功能（C++或Python）
4. 实现GUI部分
5. 编写文档和示例
6. 发布到社区

## 21.14 性能考虑

### 21.14.1 性能优化策略

- **延迟计算**：只在需要时计算
- **缓存结果**：避免重复计算
- **增量更新**：只更新变化部分
- **空间索引**：加速空间查询

### 21.14.2 性能分析

```python
import time

# 计时
start = time.time()
doc.recompute()
elapsed = time.time() - start
print(f"重新计算耗时: {elapsed:.2f}秒")

# 查看对象计算时间
for obj in doc.Objects:
    print(f"{obj.Label}: {obj.ExecutionTime}ms")
```

## 21.15 调试技巧

### 21.15.1 日志输出

```python
import FreeCAD

# 输出到报告视图
FreeCAD.Console.PrintMessage("普通消息\\n")
FreeCAD.Console.PrintWarning("警告消息\\n")
FreeCAD.Console.PrintError("错误消息\\n")
```

### 21.15.2 Python调试

```python
# 使用pdb调试器
import pdb

def my_function():
    x = 10
    pdb.set_trace()  # 设置断点
    y = x * 2
    return y
```

## 21.16 本章小结

本章深入讲解了FreeCAD的架构：

- 理解分层架构设计
- 掌握核心组件原理
- 了解OpenCASCADE几何内核
- 熟悉Qt和Coin3D的作用
- 理解Python集成机制
- 掌握工作台和命令系统
- 了解参数化引擎原理
- 熟悉文件格式和插件机制

这些知识是进行FreeCAD二次开发的基础，为后续章节打下坚实基础。

## 21.17 扩展阅读

- FreeCAD源代码：https://github.com/FreeCAD/FreeCAD
- OpenCASCADE文档：https://dev.opencascade.org/
- Qt文档：https://doc.qt.io/
- Coin3D文档：https://coin3d.github.io/
- Python C API：https://docs.python.org/3/c-api/
"""

with open("第21章：FreeCAD架构解析.md", "w", encoding="utf-8") as f:
    f.write(ch21_content)
    
print("Enhanced Chapter 21: FreeCAD架构解析")


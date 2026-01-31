---
layout: post
title: "第02章：Workplane与草图系统"
date: 2024-09-17 10:00:00 +0800
categories: [CAD开发, CadQuery]
tags: [CadQuery]
---

# 第02章：Workplane与草图系统

## 2.1 Workplane深入理解

### 2.1.1 什么是Workplane

Workplane（工作平面）是CadQuery中最核心的概念，它是进行所有建模操作的基础。Workplane可以理解为一个2D绘图平面，你可以在上面绘制草图，然后将这些2D草图转换为3D实体。

从技术角度来说，Workplane包含以下信息：
- **原点（Origin）**：工作平面的中心点
- **法向量（Normal）**：垂直于平面的方向
- **X方向（X Direction）**：平面内的X轴方向
- **Y方向（Y Direction）**：平面内的Y轴方向（由法向量和X方向确定）

```python
import cadquery as cq

# 创建一个基本的XY平面工作平面
wp = cq.Workplane("XY")

# 原点在(0, 0, 0)，法向量指向Z正方向
```

### 2.1.2 预定义工作平面

CadQuery提供了多个预定义的工作平面，对应标准视图：

```python
# 顶视图 - XY平面
top = cq.Workplane("XY")      # 或 cq.Workplane("top")

# 底视图 - XY平面的反面
bottom = cq.Workplane("bottom")

# 前视图 - XZ平面
front = cq.Workplane("XZ")    # 或 cq.Workplane("front")

# 后视图 - XZ平面的反面
back = cq.Workplane("back")

# 右视图 - YZ平面
right = cq.Workplane("YZ")    # 或 cq.Workplane("right")

# 左视图 - YZ平面的反面
left = cq.Workplane("left")
```

**各平面方向对照表：**

| 平面名称 | 法向量方向 | 平面内X方向 | 平面内Y方向 |
|---------|-----------|------------|------------|
| XY/top | +Z | +X | +Y |
| bottom | -Z | +X | -Y |
| XZ/front | +Y | +X | +Z |
| back | -Y | -X | +Z |
| YZ/right | +X | +Y | +Z |
| left | -X | -Y | +Z |

### 2.1.3 自定义工作平面

除了预定义平面，还可以创建自定义的工作平面：

**方法1：使用偏移**

```python
# 在Z=10的位置创建一个平行于XY的工作平面
wp = cq.Workplane("XY", origin=(0, 0, 10))

# 或者使用workplane方法进行偏移
wp = cq.Workplane("XY").workplane(offset=10)
```

**方法2：在现有面上创建**

```python
# 创建一个盒子
box = cq.Workplane("XY").box(10, 10, 10)

# 在顶面上创建新的工作平面
wp = box.faces(">Z").workplane()

# 在侧面上创建工作平面
wp = box.faces(">X").workplane()
```

**方法3：使用点和方向创建**

```python
# 使用center参数指定原点
wp = cq.Workplane("XY").center(5, 5)  # 原点移到(5, 5, 0)
```

### 2.1.4 工作平面变换

**平移工作平面：**

```python
# 使用center移动工作平面原点
wp = cq.Workplane("XY").center(10, 20)

# 使用move方法相对移动
wp = cq.Workplane("XY").move(10, 20)
```

**旋转工作平面：**

```python
# 创建一个倾斜的工作平面
# transformed方法可以同时进行旋转和平移
wp = cq.Workplane("XY").transformed(rotate=(45, 0, 0))

# 复合变换
wp = cq.Workplane("XY").transformed(
    offset=(10, 0, 0),    # 平移
    rotate=(0, 45, 0)     # 旋转
)
```

### 2.1.5 工作平面堆栈

CadQuery使用堆栈来管理工作平面上的对象。理解堆栈操作对于高级建模至关重要：

```python
# 创建工作平面，堆栈中有一个点（原点）
wp = cq.Workplane("XY")  # 栈: [Point(0,0,0)]

# 绘制圆，堆栈中变为圆
wp = wp.circle(5)  # 栈: [Circle]

# 拉伸，堆栈中变为实体
solid = wp.extrude(10)  # 栈: [Solid]

# 选择面，堆栈中变为面
faces = solid.faces(">Z")  # 栈: [Face]

# 在面上创建新工作平面
new_wp = faces.workplane()  # 栈: [Point(工作平面原点)]
```

## 2.2 2D草图绘制

### 2.2.1 基本形状

**矩形：**

```python
# 居中的矩形
rect = cq.Workplane("XY").rect(20, 10)  # 20x10的矩形

# 从角点开始的矩形
rect = cq.Workplane("XY").rect(20, 10, centered=False)

# 指定圆角的矩形
rect = cq.Workplane("XY").rect(20, 10, forConstruction=False)
```

**圆形：**

```python
# 标准圆
circle = cq.Workplane("XY").circle(10)  # 半径为10的圆

# 圆弧
arc = cq.Workplane("XY").arc((0, 0), (10, 0), (5, 5))
```

**椭圆：**

```python
# 椭圆
ellipse = cq.Workplane("XY").ellipse(10, 5)  # 长轴10，短轴5
```

**多边形：**

```python
# 正多边形
polygon = cq.Workplane("XY").polygon(6, 10)  # 六边形，外接圆半径10

# 使用顶点列表创建多边形
points = [(0, 0), (10, 0), (10, 10), (5, 15), (0, 10)]
polygon = cq.Workplane("XY").polyline(points).close()
```

### 2.2.2 线条和曲线

**直线：**

```python
# 绘制直线
# lineTo - 绝对坐标
line = cq.Workplane("XY").lineTo(10, 10)

# line - 相对坐标
line = cq.Workplane("XY").line(10, 10)  # 从当前位置移动(10, 10)

# 水平线和垂直线
hline = cq.Workplane("XY").hLine(10)  # 水平线，长度10
vline = cq.Workplane("XY").vLine(10)  # 垂直线，长度10
```

**折线：**

```python
# 使用折线绘制复杂路径
points = [(0, 0), (10, 0), (10, 10), (0, 10)]
polyline = cq.Workplane("XY").polyline(points)

# 闭合折线形成多边形
closed = polyline.close()
```

**样条曲线：**

```python
# 通过控制点的样条曲线
points = [(0, 0), (5, 10), (10, 5), (15, 15)]
spline = cq.Workplane("XY").spline(points)

# 指定切线方向的样条
spline = cq.Workplane("XY").spline(
    points,
    tangents=[(0, 1), (1, 0)],  # 起点和终点的切线方向
    includeCurrent=True
)
```

**三点圆弧：**

```python
# 三点圆弧
arc = cq.Workplane("XY").threePointArc((5, 5), (10, 0))
# 从当前点，经过(5, 5)，到达(10, 0)
```

**切线圆弧：**

```python
# 与上一段相切的圆弧
# 先画一条线，然后画切线圆弧
result = (
    cq.Workplane("XY")
    .lineTo(10, 0)
    .tangentArcPoint((20, 10))  # 切线圆弧到达(20, 10)
)
```

### 2.2.3 组合草图

**布尔运算：**

```python
# 在2D草图中进行布尔运算需要使用Sketch API
from cadquery import Sketch

sketch = (
    Sketch()
    .rect(20, 20)
    .circle(5, mode="s")  # 减去圆形
)

result = cq.Workplane("XY").placeSketch(sketch).extrude(10)
```

**多个草图元素：**

```python
# 使用push/pop管理多个位置
result = (
    cq.Workplane("XY")
    .pushPoints([(0, 0), (20, 0), (20, 20), (0, 20)])  # 四个位置
    .circle(3)  # 在每个位置画圆
    .extrude(5)  # 一起拉伸
)
```

### 2.2.4 构造几何

构造几何（Construction Geometry）用于辅助定位，不会成为最终几何的一部分：

```python
# 构造圆 - 用于定位
result = (
    cq.Workplane("XY")
    .circle(20, forConstruction=True)  # 构造圆
    .vertices()  # 选择圆上的顶点位置
    .circle(3)  # 在这些位置画实际的圆
    .extrude(5)
)
```

## 2.3 Sketch API（新式草图）

### 2.3.1 Sketch API简介

CadQuery 2.1引入了新的Sketch API，提供了更强大的2D草图功能，支持约束和更复杂的几何关系。

```python
from cadquery import Sketch

# 创建一个简单的草图
sketch = (
    Sketch()
    .rect(20, 10)
    .vertices()
    .fillet(2)
)

# 将草图放置到工作平面并拉伸
result = cq.Workplane("XY").placeSketch(sketch).extrude(5)
```

### 2.3.2 Sketch基本形状

```python
from cadquery import Sketch

# 矩形
s = Sketch().rect(20, 10)

# 圆
s = Sketch().circle(10)

# 椭圆
s = Sketch().ellipse(15, 10)

# 正多边形
s = Sketch().regularPolygon(10, 6)  # 半径10的六边形

# 梯形
s = Sketch().trapezoid(20, 10, 80)  # 底20，高10，角度80度

# 圆角矩形
s = Sketch().rect(20, 10).vertices().fillet(2)
```

### 2.3.3 Sketch布尔运算

Sketch支持通过mode参数进行布尔运算：

```python
from cadquery import Sketch

# mode参数值：
# "a" - 添加（默认）
# "s" - 减去
# "i" - 相交
# "c" - 构造几何

# 创建一个带孔的矩形
sketch = (
    Sketch()
    .rect(30, 20)           # 添加矩形
    .circle(5, mode="s")    # 减去圆形
)

# 更复杂的例子
sketch = (
    Sketch()
    .rect(40, 30)                   # 基础矩形
    .push([(10, 0), (-10, 0)])      # 两个位置
    .circle(5, mode="s")            # 在两个位置减去圆
    .reset()                         # 重置位置
    .rect(20, 5, mode="s")          # 减去中间的矩形
)
```

### 2.3.4 Sketch定位

```python
from cadquery import Sketch

# 使用push定位多个位置
sketch = (
    Sketch()
    .push([(0, 0), (20, 0), (20, 20), (0, 20)])
    .circle(3)
)

# 使用rarray创建矩形阵列
sketch = (
    Sketch()
    .rarray(10, 10, 3, 3)  # x间距10，y间距10，3x3阵列
    .circle(2)
)

# 使用parray创建极坐标阵列
sketch = (
    Sketch()
    .parray(15, 0, 360, 6)  # 半径15，起始0度，结束360度，6个
    .circle(3)
)
```

### 2.3.5 Sketch约束（高级）

Sketch API支持约束系统，可以基于几何关系定位元素：

```python
from cadquery import Sketch

# 使用约束创建相切的圆
sketch = (
    Sketch()
    .circle(10, tag="c1")                    # 主圆，打标签
    .constrain("c1", "Fixed", None)          # 固定主圆
    .circle(5, tag="c2")                     # 小圆
    .constrain("c1", "c2", "Tangent", None)  # 小圆与主圆相切
    .solve()                                  # 求解约束
)
```

## 2.4 实际应用示例

### 2.4.1 创建复杂轮廓

```python
import cadquery as cq

# 创建一个T形截面
t_section = (
    cq.Workplane("XY")
    # 画出T形轮廓
    .moveTo(-15, 0)
    .lineTo(-15, 5)
    .lineTo(-5, 5)
    .lineTo(-5, 30)
    .lineTo(5, 30)
    .lineTo(5, 5)
    .lineTo(15, 5)
    .lineTo(15, 0)
    .close()
    # 拉伸成3D
    .extrude(100)
)

cq.exporters.export(t_section, "t_section.step")
```

### 2.4.2 创建齿轮轮廓

```python
import cadquery as cq
import math

def gear_profile(module, teeth, pressure_angle=20):
    """创建齿轮轮廓"""
    pitch_radius = module * teeth / 2
    addendum = module
    dedendum = 1.25 * module
    
    outer_radius = pitch_radius + addendum
    inner_radius = pitch_radius - dedendum
    
    # 简化的齿轮轮廓（使用圆形近似）
    result = (
        cq.Workplane("XY")
        .circle(outer_radius)
        .circle(inner_radius / 2)  # 中心孔
        .extrude(10)
    )
    
    return result

# 创建一个齿轮
gear = gear_profile(2, 20)
cq.exporters.export(gear, "gear.step")
```

### 2.4.3 创建凸轮轮廓

```python
import cadquery as cq
import math

def cam_profile(base_radius, lift, num_points=100):
    """创建简单的凸轮轮廓"""
    points = []
    for i in range(num_points):
        angle = 2 * math.pi * i / num_points
        # 简谐运动轮廓
        r = base_radius + lift * (1 + math.cos(angle)) / 2
        x = r * math.cos(angle)
        y = r * math.sin(angle)
        points.append((x, y))
    
    return points

# 创建凸轮
points = cam_profile(20, 10)
cam = (
    cq.Workplane("XY")
    .spline(points, periodic=True)
    .close()
    .extrude(15)
    .faces(">Z")
    .workplane()
    .hole(10)  # 轴孔
)

cq.exporters.export(cam, "cam.step")
```

### 2.4.4 创建带槽的零件

```python
import cadquery as cq

# 创建一个带T型槽的底板
result = (
    cq.Workplane("XY")
    # 基础板
    .box(100, 50, 20)
    # 在顶面创建T型槽
    .faces(">Z")
    .workplane()
    # 上部分槽
    .rect(10, 40)
    .cutBlind(-8)
    # 下部分槽（更宽）
    .faces(">Z")
    .workplane(offset=-8)
    .rect(20, 40)
    .cutBlind(-8)
)

cq.exporters.export(result, "t_slot_plate.step")
```

## 2.5 最佳实践

### 2.5.1 草图设计原则

1. **先规划后绘制**
   - 在开始编码前，先画出草图设计
   - 确定关键尺寸和约束关系

2. **使用参数化设计**
   ```python
   # 好的做法
   width = 20
   height = 10
   result = cq.Workplane("XY").rect(width, height)
   
   # 避免
   result = cq.Workplane("XY").rect(20, 10)
   ```

3. **合理使用构造几何**
   ```python
   # 使用构造几何辅助定位
   result = (
       cq.Workplane("XY")
       .circle(30, forConstruction=True)  # 构造圆用于定位
       .vertices()
       .circle(5)  # 实际的圆
       .extrude(10)
   )
   ```

### 2.5.2 工作平面管理

1. **选择合适的初始平面**
   - 大多数零件从"XY"平面开始
   - 根据零件主要方向选择

2. **正确使用workplane方法**
   ```python
   # 在面上创建新工作平面
   .faces(">Z").workplane()
   
   # 偏移工作平面
   .workplane(offset=10)
   
   # 反转工作平面方向
   .workplane(invert=True)
   ```

3. **理解坐标系变换**
   ```python
   # 每个workplane()调用创建新的局部坐标系
   # 后续操作基于新坐标系
   ```

### 2.5.3 调试技巧

1. **分步构建**
   ```python
   # 分步骤构建，便于调试
   step1 = cq.Workplane("XY").box(20, 20, 10)
   step2 = step1.faces(">Z").workplane()
   step3 = step2.hole(5)
   result = step3
   ```

2. **使用show_object（CQ-editor中）**
   ```python
   # 在CQ-editor中显示中间结果
   step1 = cq.Workplane("XY").box(20, 20, 10)
   show_object(step1, name="step1")
   
   step2 = step1.faces(">Z").workplane().hole(5)
   show_object(step2, name="step2")
   ```

3. **检查栈状态**
   ```python
   # 查看当前栈中的对象
   wp = cq.Workplane("XY").box(10, 10, 10)
   print(f"栈中对象数量: {len(wp.objects)}")
   print(f"对象类型: {type(wp.objects[0])}")
   ```

## 2.6 本章小结

本章详细介绍了CadQuery的Workplane和草图系统：

1. **Workplane理解**
   - 工作平面是建模的基础
   - 预定义平面和自定义平面
   - 工作平面变换和堆栈管理

2. **2D草图绘制**
   - 基本形状：矩形、圆、椭圆、多边形
   - 线条和曲线：直线、折线、样条、圆弧
   - 组合草图和构造几何

3. **Sketch API**
   - 新式草图系统
   - 布尔运算和定位
   - 约束系统

4. **实际应用**
   - 复杂轮廓创建
   - 参数化设计示例

通过本章的学习，您应该能够：
- 熟练使用工作平面进行建模
- 绘制各种2D草图
- 使用Sketch API进行高级草图设计
- 应用最佳实践进行参数化设计

下一章我们将学习3D建模操作，包括拉伸、旋转、扫略、放样等核心功能。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第01章-CadQuery概述与入门" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第03章-3D建模操作" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

---
layout: default
title: Python绑定开发
---

# 第13章 Python绑定开发

## 13.1 Python绑定概述

### 13.1.1 py-slvs简介

py-slvs是SolveSpace约束求解器的Python绑定，允许在Python中使用几何约束求解功能。

**特点**
- 原生Python接口
- 支持Python 3.6+
- 跨平台支持
- 类型提示支持

**适用场景**
- 快速原型开发
- 脚本化CAD操作
- 科学计算和仿真
- 教育和学习

### 13.1.2 安装

**从PyPI安装**

```bash
pip install py-slvs
```

**从源码安装**

```bash
git clone https://github.com/solvespace/solvespace
cd solvespace
pip install .
```

**验证安装**

```python
import slvs
print(slvs.__all__)
```

## 13.2 基础API

### 13.2.1 导入模块

```python
from slvs import (
    # 实体创建
    add_base_2d, add_point_2d, add_point_3d,
    add_line_2d, add_line_3d,
    add_normal_2d, add_normal_3d,
    add_distance, add_circle, add_arc,
    add_workplane, add_cubic,
    
    # 约束创建
    add_constraint,
    coincident, distance, equal, 
    horizontal, vertical,
    parallel, perpendicular,
    angle, diameter, tangent,
    symmetric, symmetric_h, symmetric_v,
    midpoint, ratio, length_diff, dragged,
    
    # 求解
    solve_sketch, clear_sketch,
    get_param_value, set_param_value,
    
    # 辅助函数
    make_quaternion, quaternion_u, quaternion_v, quaternion_n,
    
    # 常量
    ResultFlag, ConstraintType,
    E_NONE, E_FREE_IN_3D
)
```

### 13.2.2 数据类型

```python
from slvs import Slvs_Entity, Slvs_Constraint, Slvs_SolveResult

# 实体字典结构
entity: Slvs_Entity = {
    'h': int,        # 句柄
    'group': int,    # 组号
    'type': int,     # 类型
    'wrkpl': int,    # 工作平面
    'point': list,   # 点引用列表
    'normal': int,   # 法线引用
    'distance': int, # 距离引用
    'param': list    # 参数引用列表
}

# 约束字典结构
constraint: Slvs_Constraint = {
    'h': int,
    'group': int,
    'type': int,
    'wrkpl': int,
    'valA': float,
    'ptA': int,
    'ptB': int,
    'entityA': int,
    'entityB': int,
    'entityC': int,
    'entityD': int,
    'other': int,
    'other2': int
}

# 求解结果
result: Slvs_SolveResult = {
    'result': int,   # ResultFlag
    'dof': int,      # 自由度
    'rank': int,     # 矩阵秩
    'bad': int       # 问题约束数
}
```

### 13.2.3 结果标志

```python
class ResultFlag(IntEnum):
    OKAY = 0               # 成功
    INCONSISTENT = 1       # 约束冲突
    DIDNT_CONVERGE = 2     # 未收敛
    TOO_MANY_UNKNOWNS = 3  # 参数过多
    REDUNDANT_OKAY = 4     # 有冗余但成功
```

## 13.3 创建实体

### 13.3.1 基础2D平面

```python
# 创建标准XY平面作为工作平面
group = 1
workplane = add_base_2d(group)

# workplane是一个预定义的工作平面实体
```

### 13.3.2 创建点

```python
# 2D点（在工作平面上）
p1 = add_point_2d(group, 0.0, 0.0, workplane)
p2 = add_point_2d(group, 100.0, 0.0, workplane)

# 3D点
p3 = add_point_3d(group, 0.0, 0.0, 0.0)
p4 = add_point_3d(group, 100.0, 100.0, 50.0)
```

### 13.3.3 创建线段

```python
# 2D线段
line1 = add_line_2d(group, p1, p2, workplane)

# 3D线段
line2 = add_line_3d(group, p3, p4)
```

### 13.3.4 创建圆和弧

```python
# 创建法线（继承工作平面）
normal = add_normal_2d(group, workplane)

# 创建距离（半径）
radius = add_distance(group, 25.0, workplane)

# 创建圆心
center = add_point_2d(group, 50.0, 50.0, workplane)

# 创建圆
circle = add_circle(group, normal, center, radius, workplane)

# 创建圆弧
arc_start = add_point_2d(group, 75.0, 50.0, workplane)
arc_end = add_point_2d(group, 50.0, 75.0, workplane)
arc = add_arc(group, normal, center, arc_start, arc_end, workplane)
```

### 13.3.5 创建贝塞尔曲线

```python
# 四个控制点
cp0 = add_point_2d(group, 0.0, 0.0, workplane)
cp1 = add_point_2d(group, 30.0, 50.0, workplane)
cp2 = add_point_2d(group, 70.0, 50.0, workplane)
cp3 = add_point_2d(group, 100.0, 0.0, workplane)

# 创建三次贝塞尔曲线
cubic = add_cubic(group, cp0, cp1, cp2, cp3, workplane)
```

### 13.3.6 创建3D工作平面

```python
# 创建原点
origin = add_point_3d(group, 0.0, 0.0, 100.0)

# 创建法线（四元数）
qw, qx, qy, qz = make_quaternion(1, 0, 0,  0, 1, 0)  # XY方向
normal_3d = add_normal_3d(group, qw, qx, qy, qz)

# 创建工作平面
wp = add_workplane(group, origin, normal_3d)
```

## 13.4 添加约束

### 13.4.1 重合约束

```python
# 使两点重合
c1 = coincident(group, p1, p2, workplane)

# 3D重合
c2 = coincident(group, p3, p4, E_FREE_IN_3D)
```

### 13.4.2 距离约束

```python
# 两点之间的距离
c3 = distance(group, p1, p2, 50.0, workplane)

# 点到线的距离
c4 = distance(group, p1, line1, 10.0, workplane)
```

### 13.4.3 方向约束

```python
# 水平约束
c5 = horizontal(group, line1, workplane)

# 垂直约束
c6 = vertical(group, line2, workplane)

# 平行约束
c7 = parallel(group, line1, line2, workplane)

# 垂直于约束
c8 = perpendicular(group, line1, line2, workplane)
```

### 13.4.4 角度约束

```python
# 两线夹角
c9 = angle(group, line1, line2, 45.0, workplane)

# 反向角度
c10 = angle(group, line1, line2, 45.0, workplane, inverse=True)
```

### 13.4.5 尺寸约束

```python
# 直径约束
c11 = diameter(group, circle, 50.0)

# 等长约束
c12 = equal(group, line1, line2, workplane)

# 长度比约束
c13 = ratio(group, line1, line2, 2.0, workplane)

# 长度差约束
c14 = length_diff(group, line1, line2, 10.0, workplane)
```

### 13.4.6 对称约束

```python
# 关于平面对称
c15 = symmetric(group, p1, p2, workplane)

# 水平对称
c16 = symmetric_h(group, p1, p2, workplane)

# 垂直对称
c17 = symmetric_v(group, p1, p2, workplane)
```

### 13.4.7 其他约束

```python
# 中点约束
c18 = midpoint(group, p1, line1, workplane)

# 相切约束
c19 = tangent(group, arc, line1, workplane)

# 固定约束
c20 = dragged(group, p1, workplane)
```

### 13.4.8 通用约束函数

```python
from slvs import add_constraint, ConstraintType

# 使用通用约束函数
c = add_constraint(
    grouph=group,
    c_type=ConstraintType.PT_PT_DISTANCE,
    wp=workplane,
    v=50.0,
    p1=point1,
    p2=point2
)
```

## 13.5 求解

### 13.5.1 基本求解

```python
# 求解指定组
result = solve_sketch(group, calculate_faileds=True)

# 检查结果
if result['result'] == ResultFlag.OKAY:
    print("求解成功!")
    print(f"自由度: {result['dof']}")
else:
    print(f"求解失败: {result['result']}")
    print(f"问题约束数: {result['bad']}")
```

### 13.5.2 获取参数值

```python
# 获取点的坐标
x = get_param_value(p1['param'][0])
y = get_param_value(p1['param'][1])
print(f"点坐标: ({x}, {y})")
```

### 13.5.3 设置参数值

```python
# 修改参数值
set_param_value(p1['param'][0], 100.0)

# 重新求解
result = solve_sketch(group, True)
```

### 13.5.4 清除草图

```python
# 清除所有数据，准备新的求解
clear_sketch()
```

## 13.6 完整示例

### 13.6.1 约束矩形

```python
from slvs import *

def create_constrained_rectangle(width, height):
    """创建一个完全约束的矩形"""
    
    clear_sketch()
    
    group = 1
    wp = add_base_2d(group)
    
    # 创建四个角点
    p1 = add_point_2d(group, 0, 0, wp)
    p2 = add_point_2d(group, width, 0, wp)
    p3 = add_point_2d(group, width, height, wp)
    p4 = add_point_2d(group, 0, height, wp)
    
    # 创建四条边
    bottom = add_line_2d(group, p1, p2, wp)
    right = add_line_2d(group, p2, p3, wp)
    top = add_line_2d(group, p3, p4, wp)
    left = add_line_2d(group, p4, p1, wp)
    
    # 添加约束
    horizontal(group, bottom, wp)
    horizontal(group, top, wp)
    vertical(group, left, wp)
    vertical(group, right, wp)
    
    # 尺寸约束
    distance(group, p1, p2, width, wp)
    distance(group, p2, p3, height, wp)
    
    # 固定原点
    distance(group, p1, E_NONE, 0, wp)  # 到原点距离为0
    
    # 求解
    result = solve_sketch(group, True)
    
    if result['result'] == ResultFlag.OKAY:
        print(f"矩形创建成功，自由度: {result['dof']}")
        
        # 输出顶点坐标
        points = [p1, p2, p3, p4]
        for i, p in enumerate(points):
            x = get_param_value(p['param'][0])
            y = get_param_value(p['param'][1])
            print(f"  P{i+1}: ({x:.2f}, {y:.2f})")
    else:
        print(f"创建失败: {result['result']}")
    
    return result

# 使用
create_constrained_rectangle(100, 60)
```

### 13.6.2 参数化连杆机构

```python
from slvs import *
import math

def create_four_bar_linkage(l1, l2, l3, l4, theta):
    """
    创建四连杆机构
    l1: 曲柄长度
    l2: 连杆长度
    l3: 摇杆长度
    l4: 机架长度
    theta: 曲柄角度（度）
    """
    
    clear_sketch()
    group = 1
    wp = add_base_2d(group)
    
    # 固定铰链点
    A = add_point_2d(group, 0, 0, wp)  # 曲柄固定点
    D = add_point_2d(group, l4, 0, wp) # 摇杆固定点
    
    # 计算初始位置
    theta_rad = math.radians(theta)
    bx = l1 * math.cos(theta_rad)
    by = l1 * math.sin(theta_rad)
    
    B = add_point_2d(group, bx, by, wp)  # 曲柄端点
    C = add_point_2d(group, l4/2, l2/2, wp)  # 连杆端点（初始猜测）
    
    # 创建连杆
    crank = add_line_2d(group, A, B, wp)      # 曲柄
    coupler = add_line_2d(group, B, C, wp)    # 连杆
    rocker = add_line_2d(group, C, D, wp)     # 摇杆
    ground = add_line_2d(group, A, D, wp)     # 机架
    
    # 添加约束
    # 固定A点
    coincident(group, A, E_NONE, wp)
    
    # 机架水平
    horizontal(group, ground, wp)
    
    # 机架长度
    distance(group, A, D, l4, wp)
    
    # 各杆长度
    distance(group, A, B, l1, wp)
    distance(group, B, C, l2, wp)
    distance(group, C, D, l3, wp)
    
    # 曲柄角度
    angle(group, crank, ground, theta, wp)
    
    # 求解
    result = solve_sketch(group, True)
    
    if result['result'] == ResultFlag.OKAY:
        ax = get_param_value(A['param'][0])
        ay = get_param_value(A['param'][1])
        bx = get_param_value(B['param'][0])
        by = get_param_value(B['param'][1])
        cx = get_param_value(C['param'][0])
        cy = get_param_value(C['param'][1])
        dx = get_param_value(D['param'][0])
        dy = get_param_value(D['param'][1])
        
        return {
            'A': (ax, ay),
            'B': (bx, by),
            'C': (cx, cy),
            'D': (dx, dy),
            'dof': result['dof']
        }
    else:
        return None

# 使用
linkage = create_four_bar_linkage(30, 70, 50, 80, 45)
if linkage:
    print("四连杆机构位置:")
    for name, pos in linkage.items():
        if name != 'dof':
            print(f"  {name}: ({pos[0]:.2f}, {pos[1]:.2f})")
```

### 13.6.3 动画生成

```python
from slvs import *
import matplotlib.pyplot as plt
import numpy as np

def animate_mechanism():
    """生成连杆机构动画数据"""
    
    positions = []
    
    for theta in range(0, 360, 5):
        result = create_four_bar_linkage(30, 70, 50, 80, theta)
        if result:
            positions.append({
                'theta': theta,
                'B': result['B'],
                'C': result['C']
            })
    
    # 绘制轨迹
    bx = [p['B'][0] for p in positions]
    by = [p['B'][1] for p in positions]
    cx = [p['C'][0] for p in positions]
    cy = [p['C'][1] for p in positions]
    
    plt.figure(figsize=(10, 8))
    plt.plot(bx, by, 'b-', label='Point B trajectory')
    plt.plot(cx, cy, 'r-', label='Point C trajectory')
    plt.scatter([0, 80], [0, 0], c='black', s=100, marker='s', label='Fixed points')
    plt.axis('equal')
    plt.legend()
    plt.grid(True)
    plt.title('Four-bar Linkage Trajectories')
    plt.savefig('linkage_animation.png')
    plt.close()

# animate_mechanism()
```

## 13.7 高级用法

### 13.7.1 批量参数修改

```python
def parametric_sweep(param_handle, values):
    """对参数进行扫描"""
    results = []
    
    for val in values:
        set_param_value(param_handle, val)
        result = solve_sketch(1, False)
        
        if result['result'] == ResultFlag.OKAY:
            results.append({
                'input': val,
                'status': 'ok',
                'dof': result['dof']
            })
        else:
            results.append({
                'input': val,
                'status': 'failed'
            })
    
    return results
```

### 13.7.2 约束冲突检测

```python
def diagnose_constraints(group):
    """诊断约束问题"""
    
    result = solve_sketch(group, True)
    
    diagnosis = {
        'status': ResultFlag(result['result']).name,
        'dof': result['dof'],
        'issues': []
    }
    
    if result['result'] == ResultFlag.INCONSISTENT:
        diagnosis['issues'].append('存在约束冲突')
    elif result['result'] == ResultFlag.DIDNT_CONVERGE:
        diagnosis['issues'].append('求解未收敛，检查初始位置')
    elif result['dof'] > 0:
        diagnosis['issues'].append(f'欠约束，剩余{result["dof"]}个自由度')
    
    return diagnosis
```

### 13.7.3 封装类

```python
class ConstraintSketch:
    """约束草图封装类"""
    
    def __init__(self):
        clear_sketch()
        self.group = 1
        self.workplane = add_base_2d(self.group)
        self.points = []
        self.lines = []
        self.constraints = []
    
    def add_point(self, x, y):
        p = add_point_2d(self.group, x, y, self.workplane)
        self.points.append(p)
        return p
    
    def add_line(self, p1, p2):
        line = add_line_2d(self.group, p1, p2, self.workplane)
        self.lines.append(line)
        return line
    
    def constrain_distance(self, e1, e2, value):
        c = distance(self.group, e1, e2, value, self.workplane)
        self.constraints.append(c)
        return c
    
    def constrain_horizontal(self, line):
        c = horizontal(self.group, line, self.workplane)
        self.constraints.append(c)
        return c
    
    def solve(self):
        return solve_sketch(self.group, True)
    
    def get_point_position(self, point):
        x = get_param_value(point['param'][0])
        y = get_param_value(point['param'][1])
        return (x, y)


# 使用
sketch = ConstraintSketch()
p1 = sketch.add_point(0, 0)
p2 = sketch.add_point(100, 0)
line = sketch.add_line(p1, p2)
sketch.constrain_horizontal(line)
sketch.constrain_distance(p1, p2, 50)

result = sketch.solve()
print(sketch.get_point_position(p2))  # (50.0, 0.0)
```

## 13.8 注意事项

### 13.8.1 内存管理

```python
# 每次创建新草图前清除
clear_sketch()

# 实体和约束在clear_sketch()后失效
# 不要保存跨clear_sketch()的引用
```

### 13.8.2 常见错误

```python
# 错误：使用无效的工作平面
# wrong_wp = {'h': 0}  # 不要手动创建
# 正确：使用函数创建
wp = add_base_2d(group)

# 错误：混用不同组的实体
# 约束只能引用同组或之前组的实体

# 错误：忘记求解就读取参数
# 参数值在solve_sketch()后才更新
```

### 13.8.3 性能优化

```python
# 批量操作时关闭失败检测
result = solve_sketch(group, False)  # 更快

# 只在最终需要时检测
if result['result'] != ResultFlag.OKAY:
    result = solve_sketch(group, True)  # 获取详细信息
```

## 13.9 总结

本章介绍了SolveSpace的Python绑定:

1. **安装和导入**: pip安装和模块导入
2. **基础API**: 数据类型和结果标志
3. **创建实体**: 点、线、圆、弧、曲线
4. **添加约束**: 各种约束类型
5. **求解操作**: 求解、参数读写
6. **完整示例**: 矩形、连杆机构、动画
7. **高级用法**: 参数扫描、诊断、封装类
8. **注意事项**: 内存、错误、性能

下一章将分析SolveSpace的源码架构。

---

**导航**
- 上一章: [第12章 - C语言库API详解](https://znlgis.github.io/cad/solvespace/第12章-C语言库API详解/)
- 下一章: [第14章 - 源码架构分析](https://znlgis.github.io/cad/solvespace/第14章-源码架构分析/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/cad/solvespace/第13章-Python绑定开发/第12章-C语言库API详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/cad/solvespace/第13章-Python绑定开发/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/cad/solvespace/第13章-Python绑定开发/第14章-源码架构分析/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

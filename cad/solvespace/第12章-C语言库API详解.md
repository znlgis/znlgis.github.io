---
layout: default
title: C语言库API详解
---

# 第12章 C语言库API详解

## 12.1 库概述

### 12.1.1 libslvs简介

libslvs是SolveSpace的约束求解器库，提供纯C接口。

**特点**
- 独立的几何约束求解器
- 不依赖GUI
- 可嵌入其他应用
- 跨平台支持

**适用场景**
- CAD软件开发
- 机器人运动学
- 机械仿真
- 游戏物理引擎

### 12.1.2 构建库文件

```bash
# 克隆仓库
git clone https://github.com/solvespace/solvespace
cd solvespace
git submodule update --init

# 构建
mkdir build && cd build
cmake .. -DENABLE_GUI=OFF -DENABLE_CLI=OFF
make slvs

# 输出文件
# Linux: libslvs.so
# Windows: slvs.dll
# macOS: libslvs.dylib
```

### 12.1.3 安装

```bash
# Linux系统安装
sudo cp libslvs.so /usr/local/lib/
sudo cp ../include/slvs.h /usr/local/include/
sudo ldconfig

# 或使用CMake安装
sudo make install
```

## 12.2 核心数据结构

### 12.2.1 参数 (Slvs_Param)

```c
typedef struct {
    Slvs_hParam     h;      // 参数句柄
    Slvs_hGroup     group;  // 所属组
    double          val;    // 参数值
} Slvs_Param;
```

**说明**
- `h`: 唯一标识符，用于引用参数
- `group`: 参数所属的组
- `val`: 当前数值（求解后更新）

### 12.2.2 实体 (Slvs_Entity)

```c
typedef struct {
    Slvs_hEntity    h;          // 实体句柄
    Slvs_hGroup     group;      // 所属组
    int             type;       // 实体类型
    Slvs_hEntity    wrkpl;      // 工作平面
    Slvs_hEntity    point[4];   // 点引用
    Slvs_hEntity    normal;     // 法线引用
    Slvs_hEntity    distance;   // 距离引用
    Slvs_hParam     param[4];   // 参数引用
} Slvs_Entity;
```

### 12.2.3 约束 (Slvs_Constraint)

```c
typedef struct {
    Slvs_hConstraint    h;          // 约束句柄
    Slvs_hGroup         group;      // 所属组
    int                 type;       // 约束类型
    Slvs_hEntity        wrkpl;      // 工作平面
    double              valA;       // 约束值
    Slvs_hEntity        ptA;        // 点A
    Slvs_hEntity        ptB;        // 点B
    Slvs_hEntity        entityA;    // 实体A
    Slvs_hEntity        entityB;    // 实体B
    Slvs_hEntity        entityC;    // 实体C
    Slvs_hEntity        entityD;    // 实体D
    int                 other;      // 其他标志
    int                 other2;     // 其他标志2
} Slvs_Constraint;
```

### 12.2.4 系统 (Slvs_System)

```c
typedef struct {
    // 输入
    Slvs_Param      *param;         // 参数数组
    int             params;          // 参数数量
    Slvs_Entity     *entity;        // 实体数组
    int             entities;        // 实体数量
    Slvs_Constraint *constraint;    // 约束数组
    int             constraints;     // 约束数量
    
    Slvs_hParam     *dragged;       // 拖动参数
    int             ndragged;        // 拖动参数数量
    
    int             calculateFaileds; // 是否计算失败约束
    
    // 输出
    Slvs_hConstraint *failed;       // 失败约束数组
    int             faileds;         // 失败约束数量
    int             dof;             // 自由度
    int             result;          // 求解结果
} Slvs_System;
```

## 12.3 实体类型

### 12.3.1 点类型

```c
// 3D空间中的点
#define SLVS_E_POINT_IN_3D    50000
// 参数: x, y, z

// 2D工作平面上的点
#define SLVS_E_POINT_IN_2D    50001
// 参数: u, v (工作平面坐标)
```

### 12.3.2 法线类型

```c
// 3D法线（四元数表示）
#define SLVS_E_NORMAL_IN_3D   60000
// 参数: qw, qx, qy, qz

// 2D法线（继承工作平面）
#define SLVS_E_NORMAL_IN_2D   60001
// 无参数，继承wrkpl
```

### 12.3.3 其他实体

```c
#define SLVS_E_DISTANCE       70000  // 距离（半径等）
#define SLVS_E_WORKPLANE      80000  // 工作平面
#define SLVS_E_LINE_SEGMENT   80001  // 线段
#define SLVS_E_CUBIC          80002  // 三次贝塞尔曲线
#define SLVS_E_CIRCLE         80003  // 圆
#define SLVS_E_ARC_OF_CIRCLE  80004  // 圆弧
```

## 12.4 约束类型

### 12.4.1 点约束

```c
#define SLVS_C_POINTS_COINCIDENT  100000  // 点重合
#define SLVS_C_PT_PT_DISTANCE     100001  // 点-点距离
#define SLVS_C_PT_PLANE_DISTANCE  100002  // 点-平面距离
#define SLVS_C_PT_LINE_DISTANCE   100003  // 点-线距离
#define SLVS_C_PT_IN_PLANE        100005  // 点在平面上
#define SLVS_C_PT_ON_LINE         100006  // 点在线上
#define SLVS_C_PT_ON_CIRCLE       100022  // 点在圆上
```

### 12.4.2 线约束

```c
#define SLVS_C_HORIZONTAL         100019  // 水平
#define SLVS_C_VERTICAL           100020  // 垂直
#define SLVS_C_PARALLEL           100025  // 平行
#define SLVS_C_PERPENDICULAR      100026  // 垂直于
#define SLVS_C_ANGLE              100024  // 角度
```

### 12.4.3 等式约束

```c
#define SLVS_C_EQUAL_LENGTH_LINES 100008  // 等长
#define SLVS_C_LENGTH_RATIO       100009  // 长度比
#define SLVS_C_LENGTH_DIFFERENCE  100033  // 长度差
#define SLVS_C_EQUAL_RADIUS       100029  // 等半径
#define SLVS_C_DIAMETER           100021  // 直径
```

### 12.4.4 对称和相切

```c
#define SLVS_C_SYMMETRIC          100014  // 对称
#define SLVS_C_SYMMETRIC_HORIZ    100015  // 水平对称
#define SLVS_C_SYMMETRIC_VERT     100016  // 垂直对称
#define SLVS_C_SYMMETRIC_LINE     100017  // 关于线对称
#define SLVS_C_AT_MIDPOINT        100018  // 中点
#define SLVS_C_ARC_LINE_TANGENT   100027  // 弧-线相切
#define SLVS_C_CUBIC_LINE_TANGENT 100028  // 曲线-线相切
#define SLVS_C_CURVE_CURVE_TANGENT 100032 // 曲线-曲线相切
```

## 12.5 便捷函数

### 12.5.1 创建参数

```c
Slvs_Param Slvs_MakeParam(Slvs_hParam h, Slvs_hGroup group, double val);
```

### 12.5.2 创建实体

```c
// 2D点
Slvs_Entity Slvs_MakePoint2d(Slvs_hEntity h, Slvs_hGroup group,
                             Slvs_hEntity wrkpl,
                             Slvs_hParam u, Slvs_hParam v);

// 3D点
Slvs_Entity Slvs_MakePoint3d(Slvs_hEntity h, Slvs_hGroup group,
                             Slvs_hParam x, Slvs_hParam y, Slvs_hParam z);

// 3D法线
Slvs_Entity Slvs_MakeNormal3d(Slvs_hEntity h, Slvs_hGroup group,
                              Slvs_hParam qw, Slvs_hParam qx,
                              Slvs_hParam qy, Slvs_hParam qz);

// 工作平面
Slvs_Entity Slvs_MakeWorkplane(Slvs_hEntity h, Slvs_hGroup group,
                               Slvs_hEntity origin, Slvs_hEntity normal);

// 线段
Slvs_Entity Slvs_MakeLineSegment(Slvs_hEntity h, Slvs_hGroup group,
                                 Slvs_hEntity wrkpl,
                                 Slvs_hEntity ptA, Slvs_hEntity ptB);

// 圆
Slvs_Entity Slvs_MakeCircle(Slvs_hEntity h, Slvs_hGroup group,
                            Slvs_hEntity wrkpl,
                            Slvs_hEntity center,
                            Slvs_hEntity normal, Slvs_hEntity radius);

// 圆弧
Slvs_Entity Slvs_MakeArcOfCircle(Slvs_hEntity h, Slvs_hGroup group,
                                 Slvs_hEntity wrkpl,
                                 Slvs_hEntity normal,
                                 Slvs_hEntity center,
                                 Slvs_hEntity start, Slvs_hEntity end);
```

### 12.5.3 创建约束

```c
Slvs_Constraint Slvs_MakeConstraint(Slvs_hConstraint h,
                                    Slvs_hGroup group,
                                    int type,
                                    Slvs_hEntity wrkpl,
                                    double valA,
                                    Slvs_hEntity ptA,
                                    Slvs_hEntity ptB,
                                    Slvs_hEntity entityA,
                                    Slvs_hEntity entityB);
```

### 12.5.4 四元数函数

```c
// 从四元数计算U向量
void Slvs_QuaternionU(double qw, double qx, double qy, double qz,
                      double *x, double *y, double *z);

// 从四元数计算V向量
void Slvs_QuaternionV(double qw, double qx, double qy, double qz,
                      double *x, double *y, double *z);

// 从四元数计算N向量
void Slvs_QuaternionN(double qw, double qx, double qy, double qz,
                      double *x, double *y, double *z);

// 从U、V向量创建四元数
void Slvs_MakeQuaternion(double ux, double uy, double uz,
                         double vx, double vy, double vz,
                         double *qw, double *qx, double *qy, double *qz);
```

## 12.6 求解函数

### 12.6.1 主求解函数

```c
void Slvs_Solve(Slvs_System *sys, Slvs_hGroup hg);
```

**参数**
- `sys`: 包含参数、实体、约束的系统
- `hg`: 要求解的组

**结果**
- `sys->result`: 求解状态
- `sys->dof`: 剩余自由度
- `sys->param[].val`: 更新后的参数值
- `sys->failed[]`: 失败的约束

### 12.6.2 结果代码

```c
#define SLVS_RESULT_OKAY            0  // 成功
#define SLVS_RESULT_INCONSISTENT    1  // 约束冲突
#define SLVS_RESULT_DIDNT_CONVERGE  2  // 未收敛
#define SLVS_RESULT_TOO_MANY_UNKNOWNS 3 // 参数过多
#define SLVS_RESULT_REDUNDANT_OKAY  4  // 有冗余但成功
```

## 12.7 完整示例

### 12.7.1 3D距离约束示例

```c
#include <stdio.h>
#include <stdlib.h>
#include <slvs.h>

int main() {
    Slvs_System sys;
    memset(&sys, 0, sizeof(sys));
    
    // 分配内存
    sys.param = malloc(10 * sizeof(Slvs_Param));
    sys.entity = malloc(10 * sizeof(Slvs_Entity));
    sys.constraint = malloc(10 * sizeof(Slvs_Constraint));
    sys.dragged = malloc(10 * sizeof(Slvs_hParam));
    sys.failed = malloc(10 * sizeof(Slvs_hConstraint));
    sys.faileds = 10;
    
    Slvs_hGroup g = 1;
    
    // 创建点1 (10, 10, 10)
    sys.param[sys.params++] = Slvs_MakeParam(1, g, 10.0);
    sys.param[sys.params++] = Slvs_MakeParam(2, g, 10.0);
    sys.param[sys.params++] = Slvs_MakeParam(3, g, 10.0);
    sys.entity[sys.entities++] = Slvs_MakePoint3d(101, g, 1, 2, 3);
    
    // 创建点2 (20, 20, 20)
    sys.param[sys.params++] = Slvs_MakeParam(4, g, 20.0);
    sys.param[sys.params++] = Slvs_MakeParam(5, g, 20.0);
    sys.param[sys.params++] = Slvs_MakeParam(6, g, 20.0);
    sys.entity[sys.entities++] = Slvs_MakePoint3d(102, g, 4, 5, 6);
    
    // 创建线段
    sys.entity[sys.entities++] = Slvs_MakeLineSegment(200, g,
                                    SLVS_FREE_IN_3D, 101, 102);
    
    // 添加距离约束: 两点距离 = 30
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        1, g,
        SLVS_C_PT_PT_DISTANCE,
        SLVS_FREE_IN_3D,
        30.0,
        101, 102, 0, 0);
    
    // 标记点2为拖动点（优先保持）
    sys.dragged[sys.ndragged++] = 4;
    sys.dragged[sys.ndragged++] = 5;
    sys.dragged[sys.ndragged++] = 6;
    
    // 求解
    Slvs_Solve(&sys, g);
    
    if(sys.result == SLVS_RESULT_OKAY) {
        printf("求解成功!\n");
        printf("点1: (%.3f, %.3f, %.3f)\n",
               sys.param[0].val, sys.param[1].val, sys.param[2].val);
        printf("点2: (%.3f, %.3f, %.3f)\n",
               sys.param[3].val, sys.param[4].val, sys.param[5].val);
        printf("自由度: %d\n", sys.dof);
    } else {
        printf("求解失败: %d\n", sys.result);
    }
    
    // 清理
    free(sys.param);
    free(sys.entity);
    free(sys.constraint);
    free(sys.dragged);
    free(sys.failed);
    
    return 0;
}
```

### 12.7.2 2D草图示例

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <slvs.h>

int main() {
    Slvs_System sys;
    memset(&sys, 0, sizeof(sys));
    
    sys.param = malloc(50 * sizeof(Slvs_Param));
    sys.entity = malloc(50 * sizeof(Slvs_Entity));
    sys.constraint = malloc(50 * sizeof(Slvs_Constraint));
    sys.failed = malloc(50 * sizeof(Slvs_hConstraint));
    sys.faileds = 50;
    
    // 组1: 工作平面
    Slvs_hGroup g1 = 1;
    double qw, qx, qy, qz;
    
    // 原点
    sys.param[sys.params++] = Slvs_MakeParam(1, g1, 0.0);
    sys.param[sys.params++] = Slvs_MakeParam(2, g1, 0.0);
    sys.param[sys.params++] = Slvs_MakeParam(3, g1, 0.0);
    sys.entity[sys.entities++] = Slvs_MakePoint3d(101, g1, 1, 2, 3);
    
    // 法线（XY平面）
    Slvs_MakeQuaternion(1, 0, 0,  0, 1, 0,  &qw, &qx, &qy, &qz);
    sys.param[sys.params++] = Slvs_MakeParam(4, g1, qw);
    sys.param[sys.params++] = Slvs_MakeParam(5, g1, qx);
    sys.param[sys.params++] = Slvs_MakeParam(6, g1, qy);
    sys.param[sys.params++] = Slvs_MakeParam(7, g1, qz);
    sys.entity[sys.entities++] = Slvs_MakeNormal3d(102, g1, 4, 5, 6, 7);
    
    // 工作平面
    sys.entity[sys.entities++] = Slvs_MakeWorkplane(200, g1, 101, 102);
    
    // 组2: 在工作平面上的草图
    Slvs_hGroup g2 = 2;
    
    // 创建矩形的四个点
    sys.param[sys.params++] = Slvs_MakeParam(11, g2, 0.0);
    sys.param[sys.params++] = Slvs_MakeParam(12, g2, 0.0);
    sys.entity[sys.entities++] = Slvs_MakePoint2d(301, g2, 200, 11, 12);
    
    sys.param[sys.params++] = Slvs_MakeParam(13, g2, 50.0);
    sys.param[sys.params++] = Slvs_MakeParam(14, g2, 0.0);
    sys.entity[sys.entities++] = Slvs_MakePoint2d(302, g2, 200, 13, 14);
    
    sys.param[sys.params++] = Slvs_MakeParam(15, g2, 50.0);
    sys.param[sys.params++] = Slvs_MakeParam(16, g2, 30.0);
    sys.entity[sys.entities++] = Slvs_MakePoint2d(303, g2, 200, 15, 16);
    
    sys.param[sys.params++] = Slvs_MakeParam(17, g2, 0.0);
    sys.param[sys.params++] = Slvs_MakeParam(18, g2, 30.0);
    sys.entity[sys.entities++] = Slvs_MakePoint2d(304, g2, 200, 17, 18);
    
    // 创建四条边
    sys.entity[sys.entities++] = Slvs_MakeLineSegment(401, g2, 200, 301, 302);
    sys.entity[sys.entities++] = Slvs_MakeLineSegment(402, g2, 200, 302, 303);
    sys.entity[sys.entities++] = Slvs_MakeLineSegment(403, g2, 200, 303, 304);
    sys.entity[sys.entities++] = Slvs_MakeLineSegment(404, g2, 200, 304, 301);
    
    // 添加约束
    // 底边水平
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        1, g2, SLVS_C_HORIZONTAL, 200, 0, 0, 0, 401, 0);
    
    // 右边垂直
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        2, g2, SLVS_C_VERTICAL, 200, 0, 0, 0, 402, 0);
    
    // 顶边水平
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        3, g2, SLVS_C_HORIZONTAL, 200, 0, 0, 0, 403, 0);
    
    // 左边垂直
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        4, g2, SLVS_C_VERTICAL, 200, 0, 0, 0, 404, 0);
    
    // 宽度 = 100
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        5, g2, SLVS_C_PT_PT_DISTANCE, 200, 100.0, 301, 302, 0, 0);
    
    // 高度 = 60
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        6, g2, SLVS_C_PT_PT_DISTANCE, 200, 60.0, 302, 303, 0, 0);
    
    // 固定左下角位置
    sys.constraint[sys.constraints++] = Slvs_MakeConstraint(
        7, g2, SLVS_C_PT_PT_DISTANCE, 200, 10.0, 301, 101, 0, 0);
    
    sys.calculateFaileds = 1;
    
    // 求解
    Slvs_Solve(&sys, g2);
    
    if(sys.result == SLVS_RESULT_OKAY) {
        printf("求解成功!\n");
        printf("矩形顶点:\n");
        printf("  P1: (%.1f, %.1f)\n", sys.param[7].val, sys.param[8].val);
        printf("  P2: (%.1f, %.1f)\n", sys.param[9].val, sys.param[10].val);
        printf("  P3: (%.1f, %.1f)\n", sys.param[11].val, sys.param[12].val);
        printf("  P4: (%.1f, %.1f)\n", sys.param[13].val, sys.param[14].val);
        printf("自由度: %d\n", sys.dof);
    } else {
        printf("求解失败: %d\n", sys.result);
        for(int i = 0; i < sys.faileds; i++) {
            printf("问题约束: %d\n", sys.failed[i]);
        }
    }
    
    free(sys.param);
    free(sys.entity);
    free(sys.constraint);
    free(sys.failed);
    
    return 0;
}
```

## 12.8 编译和链接

### 12.8.1 Linux编译

```bash
# 编译
gcc -c example.c -o example.o

# 链接
gcc example.o -o example -lslvs -lm

# 或一步完成
gcc example.c -o example -lslvs -lm
```

### 12.8.2 Windows编译

```batch
REM Visual Studio
cl example.c slvs.lib

REM MinGW
gcc example.c -o example.exe -lslvs
```

### 12.8.3 CMake集成

```cmake
cmake_minimum_required(VERSION 3.10)
project(my_cad_app)

find_library(SLVS_LIB slvs)
find_path(SLVS_INCLUDE slvs.h)

add_executable(my_app main.c)
target_include_directories(my_app PRIVATE ${SLVS_INCLUDE})
target_link_libraries(my_app ${SLVS_LIB})
```

## 12.9 总结

本章详细介绍了SolveSpace C语言库API:

1. **库概述**: 特点、构建、安装
2. **数据结构**: 参数、实体、约束、系统
3. **实体类型**: 点、法线、线段、圆等
4. **约束类型**: 完整的约束类型列表
5. **便捷函数**: 创建实体和约束的辅助函数
6. **求解函数**: 主求解函数和结果处理
7. **完整示例**: 3D和2D示例代码
8. **编译链接**: 各平台编译方法

下一章将介绍Python绑定开发。

---

**导航**
- 上一章: [第11章 - 命令行工具使用](第11章-命令行工具使用)
- 下一章: [第13章 - Python绑定开发](第13章-Python绑定开发)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第11章-命令行工具使用" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第13章-Python绑定开发" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

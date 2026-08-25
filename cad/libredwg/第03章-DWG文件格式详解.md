---
layout: default
title: 第03章 - DWG文件格式详解
---

# 第03章 - DWG文件格式详解

## 3.1 DWG文件格式概述

### 3.1.1 DWG格式的历史

DWG（Drawing）文件格式是AutoCAD的原生二进制文件格式，由Autodesk公司开发并持续维护。

**历史演进：**

| 年份 | 版本 | AutoCAD版本 | 主要变化 |
|------|------|-------------|----------|
| 1982 | R1.0-R1.4 | 1.0-1.4 | 初始格式 |
| 1983 | R2.0-R2.6 | 2.0-2.6 | 基础结构确立 |
| 1988 | R9-R10 | 9-10 | 扩展实体支持 |
| 1990 | R11 | 11 | 引入更多表类型 |
| 1994 | R13 | 13 | 重大格式重构 |
| 1997 | R14 | 14 | 优化存储效率 |
| 1999 | R2000 | 2000 | 现代格式基础 |
| 2004 | R2004 | 2004 | 压缩和加密改进 |
| 2007 | R2007 | 2007 | Unicode支持 |
| 2010 | R2010 | 2010 | 参数化设计支持 |
| 2013 | R2013 | 2013 | 云协作功能 |
| 2018 | R2018 | 2018 | 最新格式增强 |

### 3.1.2 格式版本标识

LibreDWG通过文件头中的版本字符串识别DWG版本：

```c
// 版本字符串对照
"AC1.2"   -> R1.2
"AC1.40"  -> R1.4
"AC1.50"  -> R2.05
"AC2.10"  -> R2.1
"AC2.21"  -> R2.21
"AC2.22"  -> R2.22
"AC1001"  -> R2.4
"AC1002"  -> R2.5
"AC1003"  -> R2.6
"AC1004"  -> R9
"AC1006"  -> R10
"AC1009"  -> R11/R12
"AC1012"  -> R13
"AC1014"  -> R14
"AC1015"  -> R2000
"AC1018"  -> R2004
"AC1021"  -> R2007
"AC1024"  -> R2010
"AC1027"  -> R2013
"AC1032"  -> R2018
```

### 3.1.3 文件格式特点

**二进制格式特性：**

1. **紧凑存储**：使用位编码压缩数据
2. **分段结构**：数据按功能分段组织
3. **句柄引用**：对象间通过句柄引用关联
4. **版本兼容**：向后兼容的设计原则
5. **加密支持**：R2004+支持密码保护

**与DXF的区别：**

| 特性 | DWG | DXF |
|------|-----|-----|
| 格式类型 | 二进制 | ASCII/二进制 |
| 文件大小 | 较小 | 较大 |
| 读取速度 | 较快 | 较慢 |
| 可读性 | 不可直接阅读 | 可阅读（ASCII） |
| 完整性 | 完整 | 可能丢失信息 |
| 开放性 | 私有格式 | 公开格式 |

## 3.2 DWG文件整体结构

### 3.2.1 R2000格式结构

R2000格式（用于R13-R2000）是理解DWG的基础：

```
┌─────────────────────────────────────────┐
│              文件头 (Header)             │
│  - 版本标识                              │
│  - 校验和                                │
│  - 编码页                                │
├─────────────────────────────────────────┤
│            HEADER段 (Section)            │
│  - 绘图变量                              │
│  - 系统设置                              │
├─────────────────────────────────────────┤
│           CLASSES段 (Section)            │
│  - 动态加载类定义                        │
├─────────────────────────────────────────┤
│           HANDLES段 (Section)            │
│  - 对象句柄映射表                        │
├─────────────────────────────────────────┤
│        OBJFREESPACE段 (Section)          │
│  - 对象空闲空间信息                      │
│  - 2NDHEADER（备用头）                   │
├─────────────────────────────────────────┤
│         TEMPLATE段 (Section)             │
│  - 测量单位变量                          │
├─────────────────────────────────────────┤
│          AUXHEADER段 (Section)           │
│  - 辅助头信息（仅R2000）                 │
├─────────────────────────────────────────┤
│           OBJECTS段 (Section)            │
│  - 所有实体和对象数据                    │
└─────────────────────────────────────────┘
```

### 3.2.2 R2004+格式结构

R2004及之后版本引入了更复杂的分页和压缩机制：

```
┌─────────────────────────────────────────┐
│           文件头 (0x00-0xFF)             │
├─────────────────────────────────────────┤
│         R2004_Header (0x100)             │
│  - 段信息定位                            │
│  - 加密密钥                              │
├─────────────────────────────────────────┤
│              INFO段                      │
│  - 所有段的元数据                        │
├─────────────────────────────────────────┤
│           SYSTEM_MAP段                   │
│  - 段页面映射                            │
├─────────────────────────────────────────┤
│            各数据段...                   │
│  - HEADER                                │
│  - CLASSES                               │
│  - HANDLES                               │
│  - OBJECTS（分页存储）                   │
│  - SUMMARYINFO                           │
│  - PREVIEW                               │
│  - VBAPROJECT                            │
│  - APPINFO                               │
│  - FILEDEPLIST                           │
│  - ACDS                                  │
│  - REVHISTORY                            │
│  - SECURITY                              │
│  - ...                                   │
└─────────────────────────────────────────┘
```

### 3.2.3 文件头详解

**基本文件头（前32字节）：**

```c
// 文件头结构
struct DWG_Header {
    char version[6];      // 版本字符串，如 "AC1015"
    char zeros[5];        // 填充零
    char maint_version;   // 维护版本
    char one;             // 固定值1
    uint32_t image_seeker; // 缩略图位置
    uint16_t codepage;    // 代码页
    int32_t num_sections; // 段数量
    // ... 更多字段
};
```

**代码页对照表（常用）：**

| 代码页值 | 编码 | 说明 |
|----------|------|------|
| 1 | ASCII | 基本ASCII |
| 2 | CP932 | 日语Shift-JIS |
| 3 | CP936 | 简体中文GBK |
| 4 | CP949 | 韩语 |
| 5 | CP950 | 繁体中文Big5 |
| 30 | ANSI_1252 | 西欧 |
| 31 | ANSI_1251 | 西里尔文 |

## 3.3 数据类型与编码

### 3.3.1 位编码数据类型

LibreDWG定义了一系列位编码数据类型：

**基本类型：**

```c
// 原始类型
BITCODE_RC  // 1字节无符号字符 (uint8_t)
BITCODE_RS  // 2字节无符号短整数 (uint16_t)
BITCODE_RL  // 4字节无符号长整数 (uint32_t)
BITCODE_RD  // 8字节IEEE-754双精度浮点

// 位编码类型
BITCODE_B   // 1位布尔值
BITCODE_BB  // 2位值
BITCODE_3B  // 1-3位值
BITCODE_4BITS // 4位值

BITCODE_BS  // 位编码短整数
BITCODE_BL  // 位编码长整数
BITCODE_BLL // 位编码64位长整数
BITCODE_BD  // 位编码双精度浮点
BITCODE_DD  // 带默认值的位编码双精度
```

**位编码短整数(BS)编码规则：**

```
前2位决定编码方式：
00 = 后续8位表示值（0-255）
01 = 后续16位表示值（0-65535）
10 = 值为0
11 = 值为256
```

**位编码双精度(BD)编码规则：**

```
前2位决定编码方式：
00 = 后续完整64位IEEE-754双精度
01 = 值为1.0
10 = 值为0.0
11 = 不使用
```

### 3.3.2 复合类型

```c
// 坐标点类型
BITCODE_2BD   // 2D点（两个BD）
BITCODE_3BD   // 3D点（三个BD）
BITCODE_2RD   // 2D点（两个RD）
BITCODE_3RD   // 3D点（三个RD）

// 特殊类型
BITCODE_BE    // 位编码挤出向量（默认0,0,1）
BITCODE_BT    // 位编码厚度值

// 字符串类型
BITCODE_TV    // 变长ASCII字符串
BITCODE_TU    // 变长Unicode字符串（UCS-2）
BITCODE_TF    // 定长字节缓冲区
BITCODE_TFF   // 嵌入式定长字符串

// 句柄类型
BITCODE_H     // 句柄引用
```

### 3.3.3 颜色类型

```c
// 颜色结构体
typedef struct _dwg_CMC_color {
    BITCODE_BS index;      // 颜色索引（ACI）
    BITCODE_BL rgb;        // RGB值（R2004+）
    BITCODE_RC flag;       // 标志位
    char *name;            // 颜色名称
    char *book_name;       // 颜色手册名
} Dwg_Color;

// 颜色索引对照
// 0 = ByBlock
// 1 = 红色
// 2 = 黄色
// 3 = 绿色
// 4 = 青色
// 5 = 蓝色
// 6 = 品红
// 7 = 白色/黑色（取决于背景）
// 256 = ByLayer
```

### 3.3.4 句柄编码

句柄是DWG中对象间引用的核心机制：

```c
// 句柄类型（code字段）
0  // 无关联
2  // 软拥有引用
3  // 硬拥有引用
4  // 软指针引用
5  // 硬指针引用

// 相对句柄编码（size_code字段）
0x06 // 当前句柄+1
0x08 // 当前句柄-1
0x0A // 当前句柄+偏移
0x0C // 当前句柄-偏移
```

## 3.4 主要段详解

### 3.4.1 HEADER段

HEADER段包含所有绘图变量：

```c
// 绘图变量示例
typedef struct _dwg_header_variables {
    BITCODE_BD DIMSCALE;     // 尺寸比例
    BITCODE_BD DIMASZ;       // 箭头大小
    BITCODE_BD DIMEXO;       // 延伸线偏移
    BITCODE_BD DIMDLI;       // 尺寸线间距
    BITCODE_BD DIMEXE;       // 延伸线超出
    BITCODE_BD DIMRND;       // 取整精度
    BITCODE_BD DIMDLE;       // 尺寸线延伸
    BITCODE_BD DIMTP;        // 公差上限
    BITCODE_BD DIMTM;        // 公差下限
    // ... 数百个变量
    
    // 常用变量
    BITCODE_3BD INSBASE;     // 插入基点
    BITCODE_3BD EXTMIN;      // 范围最小点
    BITCODE_3BD EXTMAX;      // 范围最大点
    BITCODE_3BD LIMMIN;      // 界限最小点
    BITCODE_3BD LIMMAX;      // 界限最大点
    
    // 表引用句柄
    BITCODE_H CLAYER;        // 当前图层
    BITCODE_H TEXTSTYLE;     // 当前文字样式
    BITCODE_H CELTYPE;       // 当前线型
    BITCODE_H DIMSTYLE;      // 当前尺寸样式
} Dwg_Header_Variables;
```

### 3.4.2 CLASSES段

CLASSES段定义动态加载的对象类型：

```c
// 类定义结构
typedef struct _dwg_class {
    BITCODE_BS number;       // 类号（从500开始）
    BITCODE_BS proxyflag;    // 代理标志
    char *appname;           // 应用程序名
    char *cppname;           // C++类名
    char *dxfname;           // DXF名称
    BITCODE_B is_zombie;     // 是否为僵尸类
    BITCODE_BS item_class_id; // 项目类ID
} Dwg_Class;

// 类号分配
// < 500  : 固定类型（LINE, CIRCLE等）
// >= 500 : 动态加载类型
```

**类的稳定性级别：**

| 级别 | 说明 |
|------|------|
| stable | 完全支持，API稳定 |
| unstable | 部分支持，API可能变化 |
| debugging | 仅调试模式支持 |
| unhandled | 未处理，仅保留类型 |

### 3.4.3 OBJECTS段

OBJECTS段包含所有实体和对象数据：

```c
// 对象通用头结构
typedef struct _dwg_object {
    BITCODE_RL size;           // 对象大小
    BITCODE_BS type;           // 对象类型
    BITCODE_H handle;          // 对象句柄
    BITCODE_H* reactors;       // 反应器列表
    BITCODE_H ownerhandle;     // 拥有者句柄
    BITCODE_BL num_reactors;   // 反应器数量
    BITCODE_B is_xdic_missing; // XDictionary缺失
    BITCODE_B has_ds_data;     // 有DataStorage数据
    
    union {
        Dwg_Entity_LINE *LINE;
        Dwg_Entity_CIRCLE *CIRCLE;
        Dwg_Entity_ARC *ARC;
        Dwg_Entity_TEXT *TEXT;
        // ... 所有实体类型
        
        Dwg_Object_LAYER *LAYER;
        Dwg_Object_STYLE *STYLE;
        Dwg_Object_LTYPE *LTYPE;
        // ... 所有对象类型
    } tio;
} Dwg_Object;
```

### 3.4.4 HANDLES段

HANDLES段是对象句柄到文件位置的映射：

```
句柄映射表格式：
┌─────────────────┬─────────────────┐
│   句柄偏移量    │   位置偏移量    │
├─────────────────┼─────────────────┤
│   相对值存储    │   相对值存储    │
│   （递增）      │   （可回退）    │
└─────────────────┴─────────────────┘
```

## 3.5 实体类型详解

### 3.5.1 实体公共字段

所有图形实体共享的字段：

```c
// 实体公共头
typedef struct _dwg_entity_common {
    BITCODE_H ownerhandle;     // 所属块
    BITCODE_BL num_reactors;   // 反应器数量
    BITCODE_H* reactors;       // 反应器句柄数组
    BITCODE_H xdicobjhandle;   // 扩展字典句柄
    
    // 图形属性
    BITCODE_BB entmode;        // 实体模式
    BITCODE_BL num_eed;        // 扩展实体数据数量
    BITCODE_B preview_exists;  // 有预览图像
    BITCODE_B graphics_size;   // 图形数据大小
    
    // 实体属性
    BITCODE_CMC color;         // 颜色
    BITCODE_BD linetype_scale; // 线型比例
    BITCODE_BB linetype_flags; // 线型标志
    BITCODE_BB plotstyle_flags; // 打印样式标志
    BITCODE_RC lineweight;     // 线宽
    
    // 引用句柄
    BITCODE_H layer;           // 图层句柄
    BITCODE_H ltype;           // 线型句柄
    BITCODE_H plotstyle;       // 打印样式句柄
} Dwg_Entity_Common;
```

### 3.5.2 基本几何实体

**LINE（直线）：**

```c
typedef struct _dwg_entity_LINE {
    // 继承公共字段
    BITCODE_B z_is_zero;       // Z坐标为零
    BITCODE_3BD start;         // 起点
    BITCODE_3BD end;           // 终点
    BITCODE_BD thickness;      // 厚度
    BITCODE_BE extrusion;      // 挤出方向
} Dwg_Entity_LINE;
```

**CIRCLE（圆）：**

```c
typedef struct _dwg_entity_CIRCLE {
    BITCODE_3BD center;        // 圆心
    BITCODE_BD radius;         // 半径
    BITCODE_BD thickness;      // 厚度
    BITCODE_BE extrusion;      // 挤出方向
} Dwg_Entity_CIRCLE;
```

**ARC（圆弧）：**

```c
typedef struct _dwg_entity_ARC {
    BITCODE_3BD center;        // 圆心
    BITCODE_BD radius;         // 半径
    BITCODE_BD thickness;      // 厚度
    BITCODE_BE extrusion;      // 挤出方向
    BITCODE_BD start_angle;    // 起始角度（弧度）
    BITCODE_BD end_angle;      // 终止角度（弧度）
} Dwg_Entity_ARC;
```

**POINT（点）：**

```c
typedef struct _dwg_entity_POINT {
    BITCODE_3BD point;         // 点坐标
    BITCODE_BD thickness;      // 厚度
    BITCODE_BE extrusion;      // 挤出方向
    BITCODE_BD x_ang;          // X角度
} Dwg_Entity_POINT;
```

### 3.5.3 复杂实体

**POLYLINE（多段线）：**

```c
// 2D多段线
typedef struct _dwg_entity_POLYLINE_2D {
    BITCODE_BS flag;           // 标志
    BITCODE_BS curve_type;     // 曲线类型
    BITCODE_BD start_width;    // 起始宽度
    BITCODE_BD end_width;      // 终止宽度
    BITCODE_BD thickness;      // 厚度
    BITCODE_BD elevation;      // 高程
    BITCODE_BE extrusion;      // 挤出方向
    BITCODE_H first_vertex;    // 第一个顶点
    BITCODE_H last_vertex;     // 最后一个顶点
    BITCODE_H seqend;          // SEQEND句柄
} Dwg_Entity_POLYLINE_2D;

// 3D多段线
typedef struct _dwg_entity_POLYLINE_3D {
    BITCODE_RC curve_type;     // 曲线类型
    BITCODE_RC flag;           // 标志
    BITCODE_H first_vertex;
    BITCODE_H last_vertex;
    BITCODE_H seqend;
} Dwg_Entity_POLYLINE_3D;
```

**LWPOLYLINE（轻量多段线）：**

```c
typedef struct _dwg_entity_LWPOLYLINE {
    BITCODE_BS flag;           // 标志（闭合等）
    BITCODE_BD const_width;    // 常量宽度
    BITCODE_BD elevation;      // 高程
    BITCODE_BD thickness;      // 厚度
    BITCODE_BE extrusion;      // 挤出方向
    BITCODE_BL num_points;     // 点数量
    BITCODE_2RD *points;       // 点数组
    BITCODE_BL num_bulges;     // 凸度数量
    BITCODE_BD *bulges;        // 凸度数组
    BITCODE_BL num_widths;     // 宽度数量
    Dwg_LWPOLYLINE_width *widths; // 宽度数组
} Dwg_Entity_LWPOLYLINE;
```

### 3.5.4 文字实体

**TEXT（单行文字）：**

```c
typedef struct _dwg_entity_TEXT {
    BITCODE_RC dataflags;      // 数据标志
    BITCODE_BD elevation;      // 高程
    BITCODE_2RD insertion_pt;  // 插入点
    BITCODE_2RD alignment_pt;  // 对齐点
    BITCODE_BE extrusion;      // 挤出方向
    BITCODE_BD thickness;      // 厚度
    BITCODE_BD oblique_angle;  // 倾斜角度
    BITCODE_BD rotation;       // 旋转角度
    BITCODE_BD height;         // 文字高度
    BITCODE_BD width_factor;   // 宽度因子
    BITCODE_TV text_value;     // 文字内容
    BITCODE_BS generation;     // 生成标志
    BITCODE_BS horiz_alignment; // 水平对齐
    BITCODE_BS vert_alignment;  // 垂直对齐
    BITCODE_H style;           // 文字样式句柄
} Dwg_Entity_TEXT;
```

**MTEXT（多行文字）：**

```c
typedef struct _dwg_entity_MTEXT {
    BITCODE_3BD insertion_pt;  // 插入点
    BITCODE_BE extrusion;      // 挤出方向
    BITCODE_3BD x_axis_dir;    // X轴方向
    BITCODE_BD rect_width;     // 矩形宽度
    BITCODE_BD rect_height;    // 矩形高度
    BITCODE_BS attachment;     // 附着方式
    BITCODE_BS drawing_dir;    // 绘制方向
    BITCODE_BD extents_width;  // 范围宽度
    BITCODE_BD extents_height; // 范围高度
    BITCODE_TV text;           // 文字内容（带格式码）
    BITCODE_H style;           // 文字样式句柄
    BITCODE_BD linespace_style; // 行距类型
    BITCODE_BD linespace_factor; // 行距因子
} Dwg_Entity_MTEXT;
```

### 3.5.5 尺寸标注实体

**尺寸标注公共结构：**

```c
typedef struct _dwg_entity_DIMENSION_common {
    BITCODE_RC class_version;  // 类版本
    BITCODE_3BD extrusion;     // 挤出方向
    BITCODE_2RD text_midpt;    // 文字中点
    BITCODE_BD elevation;      // 高程
    BITCODE_RC flags_1;        // 标志1
    BITCODE_TV user_text;      // 用户文字
    BITCODE_BD text_rotation;  // 文字旋转
    BITCODE_BD horiz_dir;      // 水平方向
    // ... 更多字段
    
    BITCODE_H dimstyle;        // 尺寸样式句柄
    BITCODE_H block;           // 块句柄
} Dwg_Entity_DIMENSION_common;

// 线性尺寸
typedef struct _dwg_entity_DIMENSION_LINEAR {
    Dwg_Entity_DIMENSION_common common;
    BITCODE_3BD xline1_pt;     // 延伸线1点
    BITCODE_3BD xline2_pt;     // 延伸线2点
    BITCODE_3BD def_pt;        // 定义点
    BITCODE_BD oblique_angle;  // 倾斜角度
    BITCODE_BD dim_rotation;   // 尺寸旋转
} Dwg_Entity_DIMENSION_LINEAR;
```

## 3.6 非图形对象

### 3.6.1 符号表对象

**LAYER（图层）：**

```c
typedef struct _dwg_object_LAYER {
    BITCODE_BS flag;           // 标志（冻结、锁定等）
    BITCODE_TV name;           // 图层名
    BITCODE_B is_64bit;        // 64位标志
    BITCODE_BS xrefindex;      // 外部引用索引
    BITCODE_B xrefdep;         // 外部引用依赖
    BITCODE_CMC color;         // 颜色
    
    BITCODE_H ltype;           // 线型句柄
    BITCODE_H material;        // 材质句柄
    BITCODE_H plotstyle;       // 打印样式句柄
} Dwg_Object_LAYER;
```

**STYLE（文字样式）：**

```c
typedef struct _dwg_object_STYLE {
    BITCODE_BS flag;           // 标志
    BITCODE_TV name;           // 样式名
    BITCODE_BD fixed_height;   // 固定高度
    BITCODE_BD width_factor;   // 宽度因子
    BITCODE_BD oblique_angle;  // 倾斜角度
    BITCODE_RC generation;     // 生成标志
    BITCODE_BD last_height;    // 最后高度
    BITCODE_TV font_name;      // 字体名
    BITCODE_TV bigfont_name;   // 大字体名
} Dwg_Object_STYLE;
```

**LTYPE（线型）：**

```c
typedef struct _dwg_object_LTYPE {
    BITCODE_BS flag;           // 标志
    BITCODE_TV name;           // 线型名
    BITCODE_TV description;    // 描述
    BITCODE_BD pattern_len;    // 图案长度
    BITCODE_RC alignment;      // 对齐方式
    BITCODE_RC num_dashes;     // 短划数量
    Dwg_LTYPE_dash *dashes;    // 短划数组
    // ... 字符串和形状定义
} Dwg_Object_LTYPE;
```

### 3.6.2 块对象

**BLOCK_HEADER（块头）：**

```c
typedef struct _dwg_object_BLOCK_HEADER {
    BITCODE_TV name;           // 块名
    BITCODE_B is_64bit;        // 64位标志
    BITCODE_BS flag;           // 标志
    BITCODE_3BD base_pt;       // 基点
    BITCODE_TV xref_pname;     // 外部引用路径
    
    // 拥有的实体链表
    BITCODE_H first_entity;    // 第一个实体
    BITCODE_H last_entity;     // 最后一个实体
    
    // 关联对象
    BITCODE_H block_entity;    // BLOCK实体
    BITCODE_H endblk_entity;   // ENDBLK实体
    BITCODE_H layout;          // 布局句柄
} Dwg_Object_BLOCK_HEADER;
```

### 3.6.3 字典对象

```c
typedef struct _dwg_object_DICTIONARY {
    BITCODE_BL numitems;       // 条目数量
    BITCODE_RC cloning;        // 克隆标志
    BITCODE_RC hard_owner;     // 硬拥有者标志
    BITCODE_TV *texts;         // 键名数组
    BITCODE_H *itemhandles;    // 值句柄数组
} Dwg_Object_DICTIONARY;
```

## 3.7 扩展数据

### 3.7.1 扩展实体数据(EED)

EED允许第三方应用在实体上附加自定义数据：

```c
typedef struct _dwg_eed {
    BITCODE_BS size;           // 数据大小
    BITCODE_H handle;          // 应用程序句柄
    Dwg_Eed_Data *data;        // 数据数组
} Dwg_Eed;

// EED数据类型
typedef struct _dwg_eed_data {
    BITCODE_RC code;           // 数据代码
    union {
        BITCODE_TV string;     // 字符串 (code=0)
        BITCODE_RC layer[2];   // 图层名 (code=1)
        BITCODE_RD handle[2];  // 句柄 (code=5)
        BITCODE_3RD point;     // 点 (code=10,11)
        BITCODE_RD real;       // 实数 (code=40,41,42)
        BITCODE_RS rs;         // 短整数 (code=70)
        BITCODE_RL rl;         // 长整数 (code=71)
        // ...
    } u;
} Dwg_Eed_Data;
```

### 3.7.2 扩展字典(XDICTIONARY)

扩展字典用于存储更复杂的自定义数据：

```c
// 通过句柄引用访问
if (entity->xdicobjhandle) {
    Dwg_Object *xdict = dwg_ref_object(dwg, entity->xdicobjhandle);
    if (xdict && xdict->type == DWG_TYPE_DICTIONARY) {
        Dwg_Object_DICTIONARY *dict = xdict->tio.object->tio.DICTIONARY;
        // 遍历字典条目
        for (int i = 0; i < dict->numitems; i++) {
            printf("Key: %s\n", dict->texts[i]);
        }
    }
}
```

## 3.8 对象坐标系统

### 3.8.1 WCS与OCS

DWG文件使用两种坐标系统：

- **WCS (World Coordinate System)**：世界坐标系
- **OCS (Object Coordinate System)**：对象坐标系

**挤出向量(Extrusion)与OCS：**

```c
// 挤出向量定义了OCS的Z轴方向
// 默认值 (0, 0, 1) 表示OCS与WCS相同

// OCS到WCS转换
void ocs_to_wcs(const BITCODE_BE extrusion, 
                const BITCODE_3BD ocs_point,
                BITCODE_3BD *wcs_point) {
    // 计算任意轴算法
    BITCODE_3BD ax, ay, az;
    az = extrusion;
    
    if (fabs(az.x) < 1/64.0 && fabs(az.y) < 1/64.0) {
        // 使用Y轴
        ax.x = az.z;
        ax.y = 0;
        ax.z = -az.x;
    } else {
        // 使用Z轴
        ax.x = -az.y;
        ax.y = az.x;
        ax.z = 0;
    }
    // 归一化ax
    normalize(&ax);
    // ay = az × ax
    cross_product(&ay, &az, &ax);
    
    // 转换坐标
    wcs_point->x = ocs_point.x * ax.x + 
                   ocs_point.y * ay.x + 
                   ocs_point.z * az.x;
    wcs_point->y = ocs_point.x * ax.y + 
                   ocs_point.y * ay.y + 
                   ocs_point.z * az.y;
    wcs_point->z = ocs_point.x * ax.z + 
                   ocs_point.y * ay.z + 
                   ocs_point.z * az.z;
}
```

### 3.8.2 负比例块的处理

当块以负X比例插入时，挤出向量会反转：

```c
// 挤出向量为 (0, 0, -1) 时需要特殊处理
if (extrusion.z < 0) {
    // 翻转X坐标
    for (each point) {
        point.x = -point.x;
    }
}
```

## 3.9 本章小结

本章详细介绍了DWG文件格式：

1. **格式历史**：从1982年至今的版本演进
2. **整体结构**：R2000和R2004+的段组织方式
3. **数据类型**：位编码类型及其编码规则
4. **主要段**：HEADER、CLASSES、OBJECTS、HANDLES的内容
5. **实体结构**：基本几何实体和复杂实体的字段定义
6. **非图形对象**：图层、样式、块等对象的结构
7. **扩展数据**：EED和XDICTIONARY的使用
8. **坐标系统**：WCS与OCS的转换

理解这些结构对于使用LibreDWG进行开发至关重要。

---

**下一章预告**：[第04章 - 核心架构与数据结构](https://znlgis.github.io/cad/libredwg/第04章-核心架构与数据结构/) - 深入了解LibreDWG的内部架构设计和主要数据结构。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/cad/libredwg/第02章-环境搭建与安装配置/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/cad/libredwg/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/cad/libredwg/第04章-核心架构与数据结构/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

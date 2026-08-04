---
layout: default
title: 第08章 - DWG文件创建与写入
---

# 第08章 - DWG文件创建与写入

## 8.1 写入功能概述

### 8.1.1 写入支持状态

LibreDWG的写入功能仍在持续完善中：

| 版本范围 | 支持状态 | 说明 |
|----------|----------|------|
| R1.4 - R2000 | ✓ 稳定 | 推荐使用 |
| R2004 | ⚠ 实验性 | 需要特殊编译选项 |
| R2007+ | ⚠ 开发中 | 功能有限 |

**推荐**：默认使用R2000格式输出，兼容性最好。

### 8.1.2 写入函数

```c
// 写入DWG文件
int dwg_write_file(const char *filename, Dwg_Data *dwg);

// 设置输出版本
void dwg_set_version(Dwg_Data *dwg, Dwg_Version_Type version);
```

## 8.2 创建空白DWG

### 8.2.1 初始化DWG结构

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dwg.h>
#include <dwg_api.h>

// 初始化空白DWG结构
int init_dwg(Dwg_Data *dwg, Dwg_Version_Type version)
{
    // 清零
    memset(dwg, 0, sizeof(Dwg_Data));
    
    // 设置版本
    dwg->header.version = version;
    
    // 设置默认头变量
    dwg->header_vars.DIMSCALE = 1.0;
    dwg->header_vars.DIMASZ = 2.5;
    dwg->header_vars.DIMTXT = 2.5;
    dwg->header_vars.DIMEXE = 1.25;
    dwg->header_vars.DIMEXO = 0.625;
    
    // 设置范围（初始值）
    dwg->header_vars.EXTMIN.x = 1e20;
    dwg->header_vars.EXTMIN.y = 1e20;
    dwg->header_vars.EXTMIN.z = 1e20;
    dwg->header_vars.EXTMAX.x = -1e20;
    dwg->header_vars.EXTMAX.y = -1e20;
    dwg->header_vars.EXTMAX.z = -1e20;
    
    // 设置界限
    dwg->header_vars.LIMMIN.x = 0;
    dwg->header_vars.LIMMIN.y = 0;
    dwg->header_vars.LIMMAX.x = 420;  // A3横向
    dwg->header_vars.LIMMAX.y = 297;
    
    // 插入基点
    dwg->header_vars.INSBASE.x = 0;
    dwg->header_vars.INSBASE.y = 0;
    dwg->header_vars.INSBASE.z = 0;
    
    // 单位
    dwg->header_vars.INSUNITS = 4;  // 毫米
    dwg->header_vars.LUNITS = 2;    // 十进制
    dwg->header_vars.LUPREC = 4;    // 4位小数
    
    return 0;
}

// 使用dwgadd命令创建（推荐方式）
// dwgadd是最简单的创建DWG的方法
```

### 8.2.2 使用dwgadd工具

对于简单的DWG创建，推荐使用`dwgadd`工具：

**创建脚本 create_drawing.txt:**

```
# 创建简单图形
LINE 0,0,0 100,0,0
LINE 100,0,0 100,100,0
LINE 100,100,0 0,100,0
LINE 0,100,0 0,0,0
CIRCLE 50,50,0 30
TEXT 50,50,0 "CENTER" 5
```

**执行创建:**

```bash
dwgadd create_drawing.txt -o output.dwg
```

### 8.2.3 从JSON/DXF创建

```bash
# 从DXF创建
dwgwrite input.dxf -o output.dwg

# 从JSON创建
dwgwrite input.json -o output.dwg

# 指定版本
dwgwrite -r r2000 input.dxf -o output.dwg
```

## 8.3 添加基本图层

### 8.3.1 创建图层

```c
#include <dwg.h>

// 添加新图层
Dwg_Object_LAYER* add_layer(Dwg_Data *dwg, const char *name, int color)
{
    // 分配新对象空间
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    // 设置对象类型
    obj->type = DWG_TYPE_LAYER;
    obj->fixedtype = DWG_TYPE_LAYER;
    obj->name = strdup("LAYER");
    obj->supertype = DWG_SUPERTYPE_OBJECT;
    obj->parent = dwg;
    obj->index = index;
    
    // 分配对象数据
    obj->tio.object = calloc(1, sizeof(Dwg_Object_Object));
    obj->tio.object->tio.LAYER = calloc(1, sizeof(Dwg_Object_LAYER));
    
    Dwg_Object_LAYER *layer = obj->tio.object->tio.LAYER;
    
    // 设置图层属性
    layer->name = strdup(name);
    layer->color.index = color;
    layer->on = 1;
    layer->frozen = 0;
    layer->locked = 0;
    layer->plotflag = 1;
    layer->lineweight = -3;  // 默认
    
    // 设置句柄
    obj->handle.value = dwg->num_objects + 100;  // 简化处理
    
    return layer;
}

// 使用示例
void create_layers(Dwg_Data *dwg)
{
    add_layer(dwg, "0", 7);           // 默认图层，白色
    add_layer(dwg, "WALLS", 1);       // 红色
    add_layer(dwg, "DOORS", 3);       // 绿色
    add_layer(dwg, "WINDOWS", 5);     // 蓝色
    add_layer(dwg, "TEXT", 7);        // 白色
    add_layer(dwg, "DIMENSIONS", 2);  // 黄色
}
```

## 8.4 添加图形实体

### 8.4.1 添加直线

```c
#include <dwg.h>

// 添加LINE实体
Dwg_Entity_LINE* add_line(Dwg_Data *dwg, 
                          double x1, double y1, double z1,
                          double x2, double y2, double z2)
{
    // 分配新对象
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    // 设置对象基本信息
    obj->type = DWG_TYPE_LINE;
    obj->fixedtype = DWG_TYPE_LINE;
    obj->name = strdup("LINE");
    obj->supertype = DWG_SUPERTYPE_ENTITY;
    obj->parent = dwg;
    obj->index = index;
    
    // 分配实体数据
    obj->tio.entity = calloc(1, sizeof(Dwg_Object_Entity));
    obj->tio.entity->tio.LINE = calloc(1, sizeof(Dwg_Entity_LINE));
    
    Dwg_Entity_LINE *line = obj->tio.entity->tio.LINE;
    line->parent = obj->tio.entity;
    
    // 设置几何数据
    line->start.x = x1;
    line->start.y = y1;
    line->start.z = z1;
    line->end.x = x2;
    line->end.y = y2;
    line->end.z = z2;
    
    // 默认挤出向量
    line->extrusion.x = 0;
    line->extrusion.y = 0;
    line->extrusion.z = 1;
    
    // 默认厚度
    line->thickness = 0;
    
    // 设置默认实体属性
    obj->tio.entity->color.index = 256;  // ByLayer
    obj->tio.entity->ltype_scale = 1.0;
    obj->tio.entity->lineweight = -1;  // ByLayer
    
    // 设置句柄
    obj->handle.value = dwg->num_objects + 100;
    
    // 更新范围
    update_extents(dwg, x1, y1, z1);
    update_extents(dwg, x2, y2, z2);
    
    return line;
}

// 辅助函数：更新图纸范围
void update_extents(Dwg_Data *dwg, double x, double y, double z)
{
    if (x < dwg->header_vars.EXTMIN.x) dwg->header_vars.EXTMIN.x = x;
    if (y < dwg->header_vars.EXTMIN.y) dwg->header_vars.EXTMIN.y = y;
    if (z < dwg->header_vars.EXTMIN.z) dwg->header_vars.EXTMIN.z = z;
    if (x > dwg->header_vars.EXTMAX.x) dwg->header_vars.EXTMAX.x = x;
    if (y > dwg->header_vars.EXTMAX.y) dwg->header_vars.EXTMAX.y = y;
    if (z > dwg->header_vars.EXTMAX.z) dwg->header_vars.EXTMAX.z = z;
}
```

### 8.4.2 添加圆

```c
#include <dwg.h>
#include <math.h>

// 添加CIRCLE实体
Dwg_Entity_CIRCLE* add_circle(Dwg_Data *dwg,
                              double cx, double cy, double cz,
                              double radius)
{
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    obj->type = DWG_TYPE_CIRCLE;
    obj->fixedtype = DWG_TYPE_CIRCLE;
    obj->name = strdup("CIRCLE");
    obj->supertype = DWG_SUPERTYPE_ENTITY;
    obj->parent = dwg;
    obj->index = index;
    
    obj->tio.entity = calloc(1, sizeof(Dwg_Object_Entity));
    obj->tio.entity->tio.CIRCLE = calloc(1, sizeof(Dwg_Entity_CIRCLE));
    
    Dwg_Entity_CIRCLE *circle = obj->tio.entity->tio.CIRCLE;
    circle->parent = obj->tio.entity;
    
    circle->center.x = cx;
    circle->center.y = cy;
    circle->center.z = cz;
    circle->radius = radius;
    circle->thickness = 0;
    circle->extrusion.x = 0;
    circle->extrusion.y = 0;
    circle->extrusion.z = 1;
    
    obj->tio.entity->color.index = 256;
    obj->tio.entity->ltype_scale = 1.0;
    
    obj->handle.value = dwg->num_objects + 100;
    
    // 更新范围
    update_extents(dwg, cx - radius, cy - radius, cz);
    update_extents(dwg, cx + radius, cy + radius, cz);
    
    return circle;
}
```

### 8.4.3 添加圆弧

```c
#include <dwg.h>
#include <math.h>

// 添加ARC实体
Dwg_Entity_ARC* add_arc(Dwg_Data *dwg,
                        double cx, double cy, double cz,
                        double radius,
                        double start_angle, double end_angle)  // 角度制
{
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    obj->type = DWG_TYPE_ARC;
    obj->fixedtype = DWG_TYPE_ARC;
    obj->name = strdup("ARC");
    obj->supertype = DWG_SUPERTYPE_ENTITY;
    obj->parent = dwg;
    obj->index = index;
    
    obj->tio.entity = calloc(1, sizeof(Dwg_Object_Entity));
    obj->tio.entity->tio.ARC = calloc(1, sizeof(Dwg_Entity_ARC));
    
    Dwg_Entity_ARC *arc = obj->tio.entity->tio.ARC;
    arc->parent = obj->tio.entity;
    
    arc->center.x = cx;
    arc->center.y = cy;
    arc->center.z = cz;
    arc->radius = radius;
    // 转换为弧度
    arc->start_angle = start_angle * M_PI / 180.0;
    arc->end_angle = end_angle * M_PI / 180.0;
    arc->thickness = 0;
    arc->extrusion.x = 0;
    arc->extrusion.y = 0;
    arc->extrusion.z = 1;
    
    obj->tio.entity->color.index = 256;
    
    obj->handle.value = dwg->num_objects + 100;
    
    return arc;
}
```

### 8.4.4 添加点

```c
#include <dwg.h>

// 添加POINT实体
Dwg_Entity_POINT* add_point(Dwg_Data *dwg, double x, double y, double z)
{
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    obj->type = DWG_TYPE_POINT;
    obj->fixedtype = DWG_TYPE_POINT;
    obj->name = strdup("POINT");
    obj->supertype = DWG_SUPERTYPE_ENTITY;
    obj->parent = dwg;
    obj->index = index;
    
    obj->tio.entity = calloc(1, sizeof(Dwg_Object_Entity));
    obj->tio.entity->tio.POINT = calloc(1, sizeof(Dwg_Entity_POINT));
    
    Dwg_Entity_POINT *point = obj->tio.entity->tio.POINT;
    point->parent = obj->tio.entity;
    
    point->x = x;
    point->y = y;
    point->z = z;
    point->thickness = 0;
    point->extrusion.x = 0;
    point->extrusion.y = 0;
    point->extrusion.z = 1;
    
    obj->tio.entity->color.index = 256;
    
    obj->handle.value = dwg->num_objects + 100;
    
    update_extents(dwg, x, y, z);
    
    return point;
}
```

## 8.5 添加文字

### 8.5.1 添加单行文字

```c
#include <dwg.h>

// 添加TEXT实体
Dwg_Entity_TEXT* add_text(Dwg_Data *dwg,
                          double x, double y, double z,
                          const char *content,
                          double height,
                          double rotation)  // 角度制
{
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    obj->type = DWG_TYPE_TEXT;
    obj->fixedtype = DWG_TYPE_TEXT;
    obj->name = strdup("TEXT");
    obj->supertype = DWG_SUPERTYPE_ENTITY;
    obj->parent = dwg;
    obj->index = index;
    
    obj->tio.entity = calloc(1, sizeof(Dwg_Object_Entity));
    obj->tio.entity->tio.TEXT = calloc(1, sizeof(Dwg_Entity_TEXT));
    
    Dwg_Entity_TEXT *text = obj->tio.entity->tio.TEXT;
    text->parent = obj->tio.entity;
    
    // 设置位置
    text->ins_pt.x = x;
    text->ins_pt.y = y;
    text->elevation = z;
    text->alignment_pt.x = x;
    text->alignment_pt.y = y;
    
    // 设置文字属性
    text->text_value = strdup(content);
    text->height = height;
    text->rotation = rotation * M_PI / 180.0;  // 转换为弧度
    text->width_factor = 1.0;
    text->oblique_ang = 0;
    
    // 对齐方式
    text->horiz_alignment = 0;  // 左对齐
    text->vert_alignment = 0;   // 基线
    
    // 挤出向量
    text->extrusion.x = 0;
    text->extrusion.y = 0;
    text->extrusion.z = 1;
    
    obj->tio.entity->color.index = 256;
    
    obj->handle.value = dwg->num_objects + 100;
    
    return text;
}

// 带对齐选项的文字
Dwg_Entity_TEXT* add_text_aligned(Dwg_Data *dwg,
                                  double x, double y, double z,
                                  const char *content,
                                  double height,
                                  int horiz_align,   // 0=左, 1=中, 2=右
                                  int vert_align)    // 0=基线, 1=底, 2=中, 3=顶
{
    Dwg_Entity_TEXT *text = add_text(dwg, x, y, z, content, height, 0);
    
    text->horiz_alignment = horiz_align;
    text->vert_alignment = vert_align;
    
    // 如果有对齐，需要设置alignment_pt
    if (horiz_align != 0 || vert_align != 0) {
        text->alignment_pt.x = x;
        text->alignment_pt.y = y;
        text->dataflags |= 2;  // 标记有对齐点
    }
    
    return text;
}
```

### 8.5.2 添加多行文字

```c
#include <dwg.h>

// 添加MTEXT实体
Dwg_Entity_MTEXT* add_mtext(Dwg_Data *dwg,
                            double x, double y, double z,
                            const char *content,
                            double width,
                            double height)
{
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    obj->type = DWG_TYPE_MTEXT;
    obj->fixedtype = DWG_TYPE_MTEXT;
    obj->name = strdup("MTEXT");
    obj->supertype = DWG_SUPERTYPE_ENTITY;
    obj->parent = dwg;
    obj->index = index;
    
    obj->tio.entity = calloc(1, sizeof(Dwg_Object_Entity));
    obj->tio.entity->tio.MTEXT = calloc(1, sizeof(Dwg_Entity_MTEXT));
    
    Dwg_Entity_MTEXT *mtext = obj->tio.entity->tio.MTEXT;
    mtext->parent = obj->tio.entity;
    
    // 设置位置
    mtext->ins_pt.x = x;
    mtext->ins_pt.y = y;
    mtext->ins_pt.z = z;
    
    // 设置尺寸
    mtext->rect_width = width;
    mtext->rect_height = 0;  // 自动计算
    
    // 设置文字
    mtext->text = strdup(content);
    
    // X轴方向
    mtext->x_axis_dir.x = 1;
    mtext->x_axis_dir.y = 0;
    mtext->x_axis_dir.z = 0;
    
    // 挤出向量
    mtext->extrusion.x = 0;
    mtext->extrusion.y = 0;
    mtext->extrusion.z = 1;
    
    // 附着点（1=左上, 2=中上, 3=右上, 4=左中...）
    mtext->attachment = 1;  // 左上
    
    // 行距
    mtext->linespace_style = 1;  // At least
    mtext->linespace_factor = 1.0;
    
    obj->tio.entity->color.index = 256;
    
    obj->handle.value = dwg->num_objects + 100;
    
    return mtext;
}
```

## 8.6 添加复杂图形

### 8.6.1 添加多段线

```c
#include <dwg.h>

// 多段线顶点结构
typedef struct {
    double x, y;
    double bulge;
    double start_width;
    double end_width;
} PolyVertex;

// 添加LWPOLYLINE
Dwg_Entity_LWPOLYLINE* add_lwpolyline(Dwg_Data *dwg,
                                       PolyVertex *vertices,
                                       int num_vertices,
                                       int closed)
{
    BITCODE_BL index = dwg->num_objects;
    dwg->num_objects++;
    dwg->object = realloc(dwg->object, 
                          dwg->num_objects * sizeof(Dwg_Object));
    
    Dwg_Object *obj = &dwg->object[index];
    memset(obj, 0, sizeof(Dwg_Object));
    
    obj->type = DWG_TYPE_LWPOLYLINE;
    obj->fixedtype = DWG_TYPE_LWPOLYLINE;
    obj->name = strdup("LWPOLYLINE");
    obj->supertype = DWG_SUPERTYPE_ENTITY;
    obj->parent = dwg;
    obj->index = index;
    
    obj->tio.entity = calloc(1, sizeof(Dwg_Object_Entity));
    obj->tio.entity->tio.LWPOLYLINE = calloc(1, sizeof(Dwg_Entity_LWPOLYLINE));
    
    Dwg_Entity_LWPOLYLINE *pline = obj->tio.entity->tio.LWPOLYLINE;
    pline->parent = obj->tio.entity;
    
    // 基本属性
    pline->flag = closed ? 1 : 0;
    pline->elevation = 0;
    pline->thickness = 0;
    pline->const_width = 0;
    pline->extrusion.x = 0;
    pline->extrusion.y = 0;
    pline->extrusion.z = 1;
    
    // 分配点数组
    pline->num_points = num_vertices;
    pline->points = calloc(num_vertices, sizeof(BITCODE_2RD));
    
    // 检查是否需要凸度和宽度数组
    int has_bulges = 0, has_widths = 0;
    for (int i = 0; i < num_vertices; i++) {
        if (fabs(vertices[i].bulge) > 1e-10) has_bulges = 1;
        if (fabs(vertices[i].start_width) > 1e-10 ||
            fabs(vertices[i].end_width) > 1e-10) has_widths = 1;
    }
    
    if (has_bulges) {
        pline->num_bulges = num_vertices;
        pline->bulges = calloc(num_vertices, sizeof(BITCODE_BD));
    }
    
    if (has_widths) {
        pline->num_widths = num_vertices;
        pline->widths = calloc(num_vertices, sizeof(Dwg_LWPOLYLINE_width));
    }
    
    // 填充数据
    for (int i = 0; i < num_vertices; i++) {
        pline->points[i].x = vertices[i].x;
        pline->points[i].y = vertices[i].y;
        
        if (has_bulges) {
            pline->bulges[i] = vertices[i].bulge;
        }
        
        if (has_widths) {
            pline->widths[i].start = vertices[i].start_width;
            pline->widths[i].end = vertices[i].end_width;
        }
        
        update_extents(dwg, vertices[i].x, vertices[i].y, 0);
    }
    
    obj->tio.entity->color.index = 256;
    obj->handle.value = dwg->num_objects + 100;
    
    return pline;
}

// 便捷函数：创建矩形
void add_rectangle(Dwg_Data *dwg, double x, double y, 
                   double width, double height)
{
    PolyVertex verts[4] = {
        {x, y, 0, 0, 0},
        {x + width, y, 0, 0, 0},
        {x + width, y + height, 0, 0, 0},
        {x, y + height, 0, 0, 0}
    };
    
    add_lwpolyline(dwg, verts, 4, 1);  // 闭合
}

// 便捷函数：创建正多边形
void add_regular_polygon(Dwg_Data *dwg, double cx, double cy, 
                         double radius, int sides)
{
    PolyVertex *verts = calloc(sides, sizeof(PolyVertex));
    
    for (int i = 0; i < sides; i++) {
        double angle = 2 * M_PI * i / sides - M_PI / 2;  // 从顶部开始
        verts[i].x = cx + radius * cos(angle);
        verts[i].y = cy + radius * sin(angle);
    }
    
    add_lwpolyline(dwg, verts, sides, 1);
    free(verts);
}
```

## 8.7 写入文件

### 8.7.1 完整写入示例

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <dwg.h>

// 创建简单图形并保存
int create_simple_drawing(const char *filename)
{
    Dwg_Data dwg;
    int error;
    
    // 初始化
    memset(&dwg, 0, sizeof(Dwg_Data));
    dwg.header.version = R_2000;
    
    // 设置头变量
    dwg.header_vars.INSUNITS = 4;  // 毫米
    dwg.header_vars.EXTMIN.x = 1e20;
    dwg.header_vars.EXTMIN.y = 1e20;
    dwg.header_vars.EXTMAX.x = -1e20;
    dwg.header_vars.EXTMAX.y = -1e20;
    
    // 创建默认图层
    add_layer(&dwg, "0", 7);
    
    // 添加图形
    // 绘制矩形框
    add_line(&dwg, 0, 0, 0, 100, 0, 0);
    add_line(&dwg, 100, 0, 0, 100, 80, 0);
    add_line(&dwg, 100, 80, 0, 0, 80, 0);
    add_line(&dwg, 0, 80, 0, 0, 0, 0);
    
    // 绘制圆
    add_circle(&dwg, 50, 40, 0, 20);
    
    // 添加文字
    add_text(&dwg, 50, 40, 0, "CENTER", 5, 0);
    
    // 写入文件
    printf("正在写入: %s\n", filename);
    error = dwg_write_file(filename, &dwg);
    
    if (error) {
        fprintf(stderr, "写入失败，错误码: %d\n", error);
        dwg_free(&dwg);
        return -1;
    }
    
    printf("写入成功\n");
    dwg_free(&dwg);
    return 0;
}

int main(int argc, char *argv[])
{
    const char *filename = argc > 1 ? argv[1] : "output.dwg";
    return create_simple_drawing(filename);
}
```

### 8.7.2 从DXF创建DWG

通常更推荐先创建DXF，再转换为DWG：

```c
#include <stdio.h>
#include <dwg.h>

// 通过DXF中转创建DWG
int create_via_dxf(const char *dwg_filename)
{
    // 1. 创建DXF内容
    FILE *dxf = fopen("temp.dxf", "w");
    if (!dxf) return -1;
    
    // DXF头部
    fprintf(dxf, "0\nSECTION\n2\nHEADER\n");
    fprintf(dxf, "9\n$ACADVER\n1\nAC1015\n");  // R2000
    fprintf(dxf, "9\n$INSUNITS\n70\n4\n");     // 毫米
    fprintf(dxf, "0\nENDSEC\n");
    
    // 实体段
    fprintf(dxf, "0\nSECTION\n2\nENTITIES\n");
    
    // LINE
    fprintf(dxf, "0\nLINE\n");
    fprintf(dxf, "8\n0\n");           // 图层
    fprintf(dxf, "10\n0.0\n");        // 起点X
    fprintf(dxf, "20\n0.0\n");        // 起点Y
    fprintf(dxf, "30\n0.0\n");        // 起点Z
    fprintf(dxf, "11\n100.0\n");      // 终点X
    fprintf(dxf, "21\n0.0\n");        // 终点Y
    fprintf(dxf, "31\n0.0\n");        // 终点Z
    
    // CIRCLE
    fprintf(dxf, "0\nCIRCLE\n");
    fprintf(dxf, "8\n0\n");           // 图层
    fprintf(dxf, "10\n50.0\n");       // 圆心X
    fprintf(dxf, "20\n50.0\n");       // 圆心Y
    fprintf(dxf, "30\n0.0\n");        // 圆心Z
    fprintf(dxf, "40\n25.0\n");       // 半径
    
    fprintf(dxf, "0\nENDSEC\n");
    fprintf(dxf, "0\nEOF\n");
    
    fclose(dxf);
    
    // 2. 读取DXF
    Dwg_Data dwg;
    memset(&dwg, 0, sizeof(Dwg_Data));
    
    int error = dxf_read_file("temp.dxf", &dwg);
    if (error) {
        fprintf(stderr, "读取DXF失败\n");
        return -1;
    }
    
    // 3. 写入DWG
    error = dwg_write_file(dwg_filename, &dwg);
    
    dwg_free(&dwg);
    remove("temp.dxf");
    
    return error ? -1 : 0;
}
```

## 8.8 使用dwgadd脚本

### 8.8.1 dwgadd脚本语法

```
# 这是注释

# 基本图形
LINE x1,y1,z1 x2,y2,z2
CIRCLE x,y,z radius
ARC x,y,z radius start_angle end_angle
POINT x,y,z

# 文字
TEXT x,y,z "content" height
TEXT x,y,z "content" height rotation

# 图层操作
LAYER name color
SETLAYER name
```

### 8.8.2 复杂脚本示例

**house.txt:**

```
# 房屋平面图
# 创建图层
LAYER "WALLS" 1
LAYER "DOORS" 3
LAYER "WINDOWS" 5
LAYER "FURNITURE" 6
LAYER "TEXT" 7

# 外墙
SETLAYER "WALLS"
LINE 0,0,0 8000,0,0
LINE 8000,0,0 8000,6000,0
LINE 8000,6000,0 0,6000,0
LINE 0,6000,0 0,0,0

# 内墙
LINE 4000,0,0 4000,4000,0
LINE 0,4000,0 4000,4000,0

# 门（用圆弧表示开启方向）
SETLAYER "DOORS"
ARC 4000,800,0 800 0 90
LINE 4000,0,0 4000,800,0
LINE 4000,1600,0 4000,4000,0

# 窗户
SETLAYER "WINDOWS"
LINE 1500,6000,0 3000,6000,0
LINE 5500,6000,0 7000,6000,0
LINE 8000,2000,0 8000,4000,0

# 家具（简化表示）
SETLAYER "FURNITURE"
# 床
LINE 500,4500,0 2500,4500,0
LINE 2500,4500,0 2500,5500,0
LINE 2500,5500,0 500,5500,0
LINE 500,5500,0 500,4500,0

# 餐桌
CIRCLE 6000,3000,0 500

# 标注
SETLAYER "TEXT"
TEXT 2000,2000,0 "客厅" 200
TEXT 6000,3000,0 "餐厅" 200
TEXT 2000,5000,0 "卧室" 200
```

**执行:**

```bash
dwgadd house.txt -o house.dwg
```

## 8.9 本章小结

本章介绍了DWG文件的创建与写入：

1. **写入支持**：R2000版本最稳定，推荐使用
2. **初始化**：创建空白DWG结构的方法
3. **添加图层**：创建和管理图层
4. **添加实体**：LINE、CIRCLE、ARC、POINT等
5. **添加文字**：TEXT和MTEXT实体
6. **复杂图形**：LWPOLYLINE和便捷函数
7. **写入文件**：dwg_write_file的使用
8. **dwgadd工具**：使用脚本快速创建图形

---

**下一章预告**：[第09章 - 格式转换实战](https://znlgis.github.io/cad/libredwg/第09章-格式转换实战/) - 学习DWG与DXF、JSON、SVG等格式的转换。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/cad/libredwg/第08章-DWG文件创建与写入/第07章-DWG文件读取与解析/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/cad/libredwg/第08章-DWG文件创建与写入/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/cad/libredwg/第08章-DWG文件创建与写入/第09章-格式转换实战/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

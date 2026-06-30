---
layout: default
title: 第06章 - C语言API编程基础
---

# 第06章 - C语言API编程基础

## 6.1 API概述

### 6.1.1 头文件结构

LibreDWG提供两层API：

```c
// 核心层 - 底层数据结构和函数
#include <dwg.h>

// API层 - 简化的高级接口
#include <dwg_api.h>
```

**选择建议：**
- 一般开发使用`dwg_api.h`即可
- 需要底层控制时使用`dwg.h`
- 可以同时包含两者

### 6.1.2 编译和链接

**基本编译命令：**

```bash
# 使用gcc
gcc -o myapp myapp.c -lredwg

# 使用pkg-config
gcc -o myapp myapp.c $(pkg-config --cflags --libs libredwg)
```

**Makefile示例：**

```makefile
CC = gcc
CFLAGS = $(shell pkg-config --cflags libredwg)
LDFLAGS = $(shell pkg-config --libs libredwg)

all: myapp

myapp: myapp.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)

clean:
	rm -f myapp
```

**CMake配置：**

```cmake
cmake_minimum_required(VERSION 3.10)
project(MyDWGApp C)

find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBREDWG REQUIRED libredwg)

add_executable(myapp myapp.c)
target_include_directories(myapp PRIVATE ${LIBREDWG_INCLUDE_DIRS})
target_link_libraries(myapp ${LIBREDWG_LIBRARIES})
```

## 6.2 基本读取操作

### 6.2.1 读取DWG文件

```c
#include <stdio.h>
#include <string.h>
#include <dwg.h>

int main(int argc, char *argv[])
{
    Dwg_Data dwg;
    int error;
    
    if (argc < 2) {
        fprintf(stderr, "用法: %s <dwg文件>\n", argv[0]);
        return 1;
    }
    
    // 初始化结构体（重要！）
    memset(&dwg, 0, sizeof(Dwg_Data));
    
    // 读取DWG文件
    error = dwg_read_file(argv[1], &dwg);
    
    if (error >= DWG_ERR_CRITICAL) {
        fprintf(stderr, "读取文件失败，错误码: %d\n", error);
        return 1;
    }
    
    // 打印基本信息
    printf("DWG版本: %s\n", dwg.header.version);
    printf("对象数量: %lu\n", (unsigned long)dwg.num_objects);
    printf("类数量: %lu\n", (unsigned long)dwg.num_classes);
    
    // 释放内存
    dwg_free(&dwg);
    
    return 0;
}
```

### 6.2.2 错误处理

```c
#include <dwg.h>

int read_dwg_with_error_handling(const char *filename)
{
    Dwg_Data dwg;
    int error;
    
    memset(&dwg, 0, sizeof(Dwg_Data));
    error = dwg_read_file(filename, &dwg);
    
    // 检查各种错误
    if (error & DWG_ERR_IOERROR) {
        fprintf(stderr, "IO错误：无法读取文件\n");
        return -1;
    }
    
    if (error & DWG_ERR_INVALIDDWG) {
        fprintf(stderr, "无效的DWG文件格式\n");
        return -1;
    }
    
    if (error & DWG_ERR_OUTOFMEM) {
        fprintf(stderr, "内存不足\n");
        return -1;
    }
    
    // 非严重错误可以继续处理
    if (error && error < DWG_ERR_CRITICAL) {
        fprintf(stderr, "警告：存在非严重错误 (0x%x)\n", error);
    }
    
    if (error >= DWG_ERR_CRITICAL) {
        fprintf(stderr, "严重错误，无法继续 (0x%x)\n", error);
        dwg_free(&dwg);
        return -1;
    }
    
    // 处理DWG数据...
    
    dwg_free(&dwg);
    return 0;
}
```

### 6.2.3 版本检测

```c
#include <dwg.h>

void print_version_info(Dwg_Data *dwg)
{
    printf("文件版本字符串: %s\n", dwg->header.version);
    
    // 使用版本枚举
    switch (dwg->header.version) {
        case R_2018:
            printf("版本: AutoCAD 2018 (R2018)\n");
            break;
        case R_2013:
            printf("版本: AutoCAD 2013 (R2013)\n");
            break;
        case R_2010:
            printf("版本: AutoCAD 2010 (R2010)\n");
            break;
        case R_2007:
            printf("版本: AutoCAD 2007 (R2007)\n");
            break;
        case R_2004:
            printf("版本: AutoCAD 2004 (R2004)\n");
            break;
        case R_2000:
            printf("版本: AutoCAD 2000 (R2000)\n");
            break;
        case R_14:
            printf("版本: AutoCAD R14\n");
            break;
        case R_13:
            printf("版本: AutoCAD R13\n");
            break;
        default:
            printf("版本: 其他 (%d)\n", dwg->header.version);
    }
}
```

## 6.3 遍历对象

### 6.3.1 遍历所有对象

```c
#include <dwg.h>

void iterate_all_objects(Dwg_Data *dwg)
{
    BITCODE_BL i;
    
    printf("对象列表（共 %lu 个）:\n", (unsigned long)dwg->num_objects);
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        printf("对象 %lu: 类型=%d (%s), 句柄=0x%lx\n",
               (unsigned long)i,
               obj->type,
               obj->name ? obj->name : "unknown",
               (unsigned long)obj->handle.value);
    }
}
```

### 6.3.2 按类型遍历

```c
#include <dwg.h>

// 统计各类型对象数量
void count_object_types(Dwg_Data *dwg)
{
    BITCODE_BL i;
    int line_count = 0;
    int circle_count = 0;
    int arc_count = 0;
    int text_count = 0;
    int mtext_count = 0;
    int other_count = 0;
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        switch (obj->fixedtype) {
            case DWG_TYPE_LINE:
                line_count++;
                break;
            case DWG_TYPE_CIRCLE:
                circle_count++;
                break;
            case DWG_TYPE_ARC:
                arc_count++;
                break;
            case DWG_TYPE_TEXT:
                text_count++;
                break;
            case DWG_TYPE_MTEXT:
                mtext_count++;
                break;
            default:
                other_count++;
                break;
        }
    }
    
    printf("类型统计:\n");
    printf("  LINE: %d\n", line_count);
    printf("  CIRCLE: %d\n", circle_count);
    printf("  ARC: %d\n", arc_count);
    printf("  TEXT: %d\n", text_count);
    printf("  MTEXT: %d\n", mtext_count);
    printf("  其他: %d\n", other_count);
}
```

### 6.3.3 遍历模型空间实体

```c
#include <dwg.h>
#include <dwg_api.h>

void iterate_model_space(Dwg_Data *dwg)
{
    Dwg_Object_Ref *mspace_ref;
    Dwg_Object *mspace_obj;
    Dwg_Object_BLOCK_HEADER *mspace;
    Dwg_Object *obj;
    
    // 获取模型空间块记录
    mspace_ref = dwg->header_vars.BLOCK_RECORD_MSPACE;
    if (!mspace_ref || !mspace_ref->obj) {
        fprintf(stderr, "无法获取模型空间\n");
        return;
    }
    
    mspace_obj = mspace_ref->obj;
    if (mspace_obj->fixedtype != DWG_TYPE_BLOCK_HEADER) {
        fprintf(stderr, "模型空间类型错误\n");
        return;
    }
    
    mspace = mspace_obj->tio.object->tio.BLOCK_HEADER;
    
    printf("模型空间实体:\n");
    
    // 从第一个实体开始遍历
    if (mspace->first_entity && mspace->first_entity->obj) {
        obj = mspace->first_entity->obj;
        
        while (obj) {
            if (obj->supertype == DWG_SUPERTYPE_ENTITY) {
                printf("  实体: %s (句柄: 0x%lx)\n",
                       obj->name ? obj->name : "unknown",
                       (unsigned long)obj->handle.value);
            }
            
            // 获取下一个实体
            // 需要通过句柄链遍历
            // 简化处理：检查owned entities
            break; // 简化示例
        }
    }
}
```

## 6.4 访问实体属性

### 6.4.1 LINE实体

```c
#include <dwg.h>

void process_line(Dwg_Object *obj)
{
    Dwg_Entity_LINE *line;
    
    if (obj->fixedtype != DWG_TYPE_LINE) {
        return;
    }
    
    line = obj->tio.entity->tio.LINE;
    
    printf("LINE:\n");
    printf("  起点: (%.6f, %.6f, %.6f)\n",
           line->start.x, line->start.y, line->start.z);
    printf("  终点: (%.6f, %.6f, %.6f)\n",
           line->end.x, line->end.y, line->end.z);
    printf("  厚度: %.6f\n", line->thickness);
    printf("  挤出: (%.6f, %.6f, %.6f)\n",
           line->extrusion.x, line->extrusion.y, line->extrusion.z);
    
    // 计算长度
    double dx = line->end.x - line->start.x;
    double dy = line->end.y - line->start.y;
    double dz = line->end.z - line->start.z;
    double length = sqrt(dx*dx + dy*dy + dz*dz);
    printf("  长度: %.6f\n", length);
}
```

### 6.4.2 CIRCLE实体

```c
#include <dwg.h>
#include <math.h>

void process_circle(Dwg_Object *obj)
{
    Dwg_Entity_CIRCLE *circle;
    
    if (obj->fixedtype != DWG_TYPE_CIRCLE) {
        return;
    }
    
    circle = obj->tio.entity->tio.CIRCLE;
    
    printf("CIRCLE:\n");
    printf("  圆心: (%.6f, %.6f, %.6f)\n",
           circle->center.x, circle->center.y, circle->center.z);
    printf("  半径: %.6f\n", circle->radius);
    printf("  厚度: %.6f\n", circle->thickness);
    printf("  挤出: (%.6f, %.6f, %.6f)\n",
           circle->extrusion.x, circle->extrusion.y, circle->extrusion.z);
    
    // 计算周长和面积
    double circumference = 2 * M_PI * circle->radius;
    double area = M_PI * circle->radius * circle->radius;
    printf("  周长: %.6f\n", circumference);
    printf("  面积: %.6f\n", area);
}
```

### 6.4.3 TEXT实体

```c
#include <dwg.h>

void process_text(Dwg_Object *obj)
{
    Dwg_Entity_TEXT *text;
    
    if (obj->fixedtype != DWG_TYPE_TEXT) {
        return;
    }
    
    text = obj->tio.entity->tio.TEXT;
    
    printf("TEXT:\n");
    printf("  内容: %s\n", text->text_value ? text->text_value : "(空)");
    printf("  插入点: (%.6f, %.6f)\n",
           text->ins_pt.x, text->ins_pt.y);
    printf("  高度: %.6f\n", text->height);
    printf("  旋转: %.6f 度\n", text->rotation * 180.0 / M_PI);
    printf("  宽度因子: %.6f\n", text->width_factor);
    printf("  水平对齐: %d\n", text->horiz_alignment);
    printf("  垂直对齐: %d\n", text->vert_alignment);
}
```

### 6.4.4 LWPOLYLINE实体

```c
#include <dwg.h>

void process_lwpolyline(Dwg_Object *obj)
{
    Dwg_Entity_LWPOLYLINE *lwpline;
    BITCODE_BL i;
    
    if (obj->fixedtype != DWG_TYPE_LWPOLYLINE) {
        return;
    }
    
    lwpline = obj->tio.entity->tio.LWPOLYLINE;
    
    printf("LWPOLYLINE:\n");
    printf("  点数: %lu\n", (unsigned long)lwpline->num_points);
    printf("  闭合: %s\n", (lwpline->flag & 1) ? "是" : "否");
    printf("  高程: %.6f\n", lwpline->elevation);
    printf("  厚度: %.6f\n", lwpline->thickness);
    
    // 打印所有顶点
    printf("  顶点:\n");
    for (i = 0; i < lwpline->num_points; i++) {
        printf("    %lu: (%.6f, %.6f)",
               (unsigned long)i,
               lwpline->points[i].x,
               lwpline->points[i].y);
        
        // 打印凸度（如果有）
        if (i < lwpline->num_bulges && lwpline->bulges) {
            printf(", 凸度=%.6f", lwpline->bulges[i]);
        }
        
        // 打印宽度（如果有）
        if (i < lwpline->num_widths && lwpline->widths) {
            printf(", 宽度=(%.6f, %.6f)",
                   lwpline->widths[i].start,
                   lwpline->widths[i].end);
        }
        
        printf("\n");
    }
}
```

## 6.5 访问图层和样式

### 6.5.1 遍历图层

```c
#include <dwg.h>

void list_layers(Dwg_Data *dwg)
{
    BITCODE_BL i;
    
    printf("图层列表:\n");
    printf("%-20s %-10s %-15s %s\n",
           "名称", "颜色", "线型", "状态");
    printf("----------------------------------------------------\n");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->fixedtype == DWG_TYPE_LAYER) {
            Dwg_Object_LAYER *layer = obj->tio.object->tio.LAYER;
            
            const char *status = "";
            if (layer->frozen) status = "冻结";
            else if (!layer->on) status = "关闭";
            else if (layer->locked) status = "锁定";
            else status = "正常";
            
            printf("%-20s %-10d %-15s %s\n",
                   layer->name ? layer->name : "(无名)",
                   layer->color.index,
                   layer->ltype && layer->ltype->obj ? 
                       layer->ltype->obj->tio.object->tio.LTYPE->name : "Continuous",
                   status);
        }
    }
}
```

### 6.5.2 获取实体的图层信息

```c
#include <dwg.h>

void get_entity_layer(Dwg_Data *dwg, Dwg_Object *obj)
{
    Dwg_Object_Entity *ent;
    Dwg_Object_LAYER *layer;
    
    if (obj->supertype != DWG_SUPERTYPE_ENTITY) {
        return;
    }
    
    ent = obj->tio.entity;
    
    if (ent->layer && ent->layer->obj) {
        if (ent->layer->obj->fixedtype == DWG_TYPE_LAYER) {
            layer = ent->layer->obj->tio.object->tio.LAYER;
            printf("实体所在图层: %s\n", layer->name);
        }
    } else {
        printf("实体所在图层: 0 (默认)\n");
    }
}
```

### 6.5.3 遍历文字样式

```c
#include <dwg.h>

void list_styles(Dwg_Data *dwg)
{
    BITCODE_BL i;
    
    printf("文字样式列表:\n");
    printf("%-15s %-15s %-10s %s\n",
           "名称", "字体", "高度", "宽度因子");
    printf("--------------------------------------------------\n");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->fixedtype == DWG_TYPE_STYLE) {
            Dwg_Object_STYLE *style = obj->tio.object->tio.STYLE;
            
            printf("%-15s %-15s %-10.2f %.2f\n",
                   style->name ? style->name : "(无名)",
                   style->font_file ? style->font_file : "(默认)",
                   style->fixed_height,
                   style->width_factor);
        }
    }
}
```

## 6.6 使用dwg_api.h

### 6.6.1 简化的API函数

```c
#include <dwg.h>
#include <dwg_api.h>

// 使用API获取实体属性
void demo_api_functions(Dwg_Data *dwg)
{
    BITCODE_BL i;
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->fixedtype == DWG_TYPE_LINE) {
            Dwg_Entity_LINE *line = obj->tio.entity->tio.LINE;
            
            // 使用API宏/函数
            dwg_point_3d start, end;
            
            dwg_ent_line_get_start_point(line, &start, NULL);
            dwg_ent_line_get_end_point(line, &end, NULL);
            
            printf("LINE: (%.2f,%.2f,%.2f) -> (%.2f,%.2f,%.2f)\n",
                   start.x, start.y, start.z,
                   end.x, end.y, end.z);
        }
        
        if (obj->fixedtype == DWG_TYPE_CIRCLE) {
            Dwg_Entity_CIRCLE *circle = obj->tio.entity->tio.CIRCLE;
            
            dwg_point_3d center;
            BITCODE_BD radius;
            
            dwg_ent_circle_get_center(circle, &center, NULL);
            dwg_ent_circle_get_radius(circle, &radius, NULL);
            
            printf("CIRCLE: 圆心(%.2f,%.2f,%.2f), 半径%.2f\n",
                   center.x, center.y, center.z, radius);
        }
    }
}
```

### 6.6.2 API遍历宏

```c
#include <dwg.h>
#include <dwg_api.h>

// 使用DWG_GETALL宏遍历特定类型
void demo_getall_macro(Dwg_Data *dwg)
{
    BITCODE_BL error = 0;
    Dwg_Entity_LINE *line;
    Dwg_Entity_CIRCLE *circle;
    
    // 遍历所有LINE
    printf("所有LINE实体:\n");
    line = dwg_getall_LINE(dwg);
    while (line) {
        printf("  LINE: (%.2f,%.2f) -> (%.2f,%.2f)\n",
               line->start.x, line->start.y,
               line->end.x, line->end.y);
        line = (Dwg_Entity_LINE*)line->parent->parent->next_entity;
        // 注意：实际遍历需要更复杂的逻辑
        break;
    }
}
```

## 6.7 通用实体处理

### 6.7.1 通用实体处理函数

```c
#include <dwg.h>
#include <math.h>

// 通用实体处理器
void process_entity(Dwg_Object *obj)
{
    if (obj->supertype != DWG_SUPERTYPE_ENTITY) {
        return;
    }
    
    Dwg_Object_Entity *ent = obj->tio.entity;
    
    // 打印通用信息
    printf("实体: %s\n", obj->name);
    printf("  句柄: 0x%lx\n", (unsigned long)obj->handle.value);
    printf("  颜色索引: %d\n", ent->color.index);
    printf("  线型比例: %.2f\n", ent->ltype_scale);
    printf("  线宽: %d\n", ent->lineweight);
    
    // 按类型处理
    switch (obj->fixedtype) {
        case DWG_TYPE_LINE:
            process_line(obj);
            break;
        case DWG_TYPE_CIRCLE:
            process_circle(obj);
            break;
        case DWG_TYPE_ARC:
            process_arc(obj);
            break;
        case DWG_TYPE_TEXT:
            process_text(obj);
            break;
        case DWG_TYPE_MTEXT:
            process_mtext(obj);
            break;
        case DWG_TYPE_LWPOLYLINE:
            process_lwpolyline(obj);
            break;
        // ... 其他类型
        default:
            printf("  (未实现的类型处理)\n");
            break;
    }
}

void process_arc(Dwg_Object *obj)
{
    Dwg_Entity_ARC *arc = obj->tio.entity->tio.ARC;
    
    printf("  圆心: (%.6f, %.6f, %.6f)\n",
           arc->center.x, arc->center.y, arc->center.z);
    printf("  半径: %.6f\n", arc->radius);
    printf("  起始角: %.2f 度\n", arc->start_angle * 180.0 / M_PI);
    printf("  终止角: %.2f 度\n", arc->end_angle * 180.0 / M_PI);
}

void process_mtext(Dwg_Object *obj)
{
    Dwg_Entity_MTEXT *mtext = obj->tio.entity->tio.MTEXT;
    
    printf("  插入点: (%.6f, %.6f, %.6f)\n",
           mtext->ins_pt.x, mtext->ins_pt.y, mtext->ins_pt.z);
    printf("  宽度: %.6f\n", mtext->rect_width);
    printf("  内容: %s\n", mtext->text ? mtext->text : "(空)");
}
```

### 6.7.2 计算范围（Extents）

```c
#include <dwg.h>
#include <float.h>
#include <math.h>

typedef struct {
    double min_x, min_y, min_z;
    double max_x, max_y, max_z;
} Extents3D;

void init_extents(Extents3D *ext)
{
    ext->min_x = ext->min_y = ext->min_z = DBL_MAX;
    ext->max_x = ext->max_y = ext->max_z = -DBL_MAX;
}

void update_extents_point(Extents3D *ext, double x, double y, double z)
{
    if (x < ext->min_x) ext->min_x = x;
    if (y < ext->min_y) ext->min_y = y;
    if (z < ext->min_z) ext->min_z = z;
    if (x > ext->max_x) ext->max_x = x;
    if (y > ext->max_y) ext->max_y = y;
    if (z > ext->max_z) ext->max_z = z;
}

void calculate_extents(Dwg_Data *dwg, Extents3D *ext)
{
    BITCODE_BL i;
    
    init_extents(ext);
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->supertype != DWG_SUPERTYPE_ENTITY) {
            continue;
        }
        
        switch (obj->fixedtype) {
            case DWG_TYPE_LINE: {
                Dwg_Entity_LINE *line = obj->tio.entity->tio.LINE;
                update_extents_point(ext, line->start.x, line->start.y, line->start.z);
                update_extents_point(ext, line->end.x, line->end.y, line->end.z);
                break;
            }
            case DWG_TYPE_CIRCLE: {
                Dwg_Entity_CIRCLE *circle = obj->tio.entity->tio.CIRCLE;
                update_extents_point(ext, 
                    circle->center.x - circle->radius,
                    circle->center.y - circle->radius,
                    circle->center.z);
                update_extents_point(ext,
                    circle->center.x + circle->radius,
                    circle->center.y + circle->radius,
                    circle->center.z);
                break;
            }
            case DWG_TYPE_POINT: {
                Dwg_Entity_POINT *point = obj->tio.entity->tio.POINT;
                update_extents_point(ext, point->x, point->y, point->z);
                break;
            }
            // ... 其他类型
        }
    }
    
    printf("图纸范围:\n");
    printf("  最小: (%.6f, %.6f, %.6f)\n", ext->min_x, ext->min_y, ext->min_z);
    printf("  最大: (%.6f, %.6f, %.6f)\n", ext->max_x, ext->max_y, ext->max_z);
}
```

## 6.8 完整示例程序

### 6.8.1 DWG信息查看器

```c
/* dwg_info.c - DWG文件信息查看器 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <dwg.h>

// 版本名称映射
const char* get_version_name(Dwg_Version_Type version)
{
    switch (version) {
        case R_1_1: return "R1.1";
        case R_1_2: return "R1.2";
        case R_2_0: return "R2.0";
        case R_9: return "R9";
        case R_10: return "R10";
        case R_11: return "R11/R12";
        case R_13: return "R13";
        case R_14: return "R14";
        case R_2000: return "R2000";
        case R_2004: return "R2004";
        case R_2007: return "R2007";
        case R_2010: return "R2010";
        case R_2013: return "R2013";
        case R_2018: return "R2018";
        default: return "未知";
    }
}

// 统计实体类型
void print_entity_stats(Dwg_Data *dwg)
{
    int stats[100] = {0};
    const char *type_names[100] = {0};
    BITCODE_BL i;
    int type_count = 0;
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        if (obj->supertype == DWG_SUPERTYPE_ENTITY) {
            int type = obj->fixedtype;
            if (type < 100) {
                if (stats[type] == 0 && obj->name) {
                    type_names[type] = obj->name;
                }
                stats[type]++;
            }
        }
    }
    
    printf("\n实体类型统计:\n");
    printf("%-20s %s\n", "类型", "数量");
    printf("--------------------------------\n");
    
    for (i = 0; i < 100; i++) {
        if (stats[i] > 0) {
            printf("%-20s %d\n", 
                   type_names[i] ? type_names[i] : "Unknown",
                   stats[i]);
        }
    }
}

// 打印图层信息
void print_layers(Dwg_Data *dwg)
{
    BITCODE_BL i;
    int layer_count = 0;
    
    printf("\n图层列表:\n");
    printf("%-25s %-10s %s\n", "名称", "颜色", "状态");
    printf("------------------------------------------\n");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        if (obj->fixedtype == DWG_TYPE_LAYER) {
            Dwg_Object_LAYER *layer = obj->tio.object->tio.LAYER;
            
            const char *status = "正常";
            if (layer->frozen) status = "冻结";
            else if (!layer->on) status = "关闭";
            else if (layer->locked) status = "锁定";
            
            printf("%-25s %-10d %s\n",
                   layer->name ? layer->name : "(无名)",
                   layer->color.index,
                   status);
            layer_count++;
        }
    }
    printf("共 %d 个图层\n", layer_count);
}

// 打印文本内容
void print_texts(Dwg_Data *dwg, int max_count)
{
    BITCODE_BL i;
    int count = 0;
    
    printf("\n文本内容（最多显示 %d 个）:\n", max_count);
    printf("------------------------------------------\n");
    
    for (i = 0; i < dwg->num_objects && count < max_count; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->fixedtype == DWG_TYPE_TEXT) {
            Dwg_Entity_TEXT *text = obj->tio.entity->tio.TEXT;
            if (text->text_value && strlen(text->text_value) > 0) {
                printf("[TEXT] %s\n", text->text_value);
                count++;
            }
        }
        else if (obj->fixedtype == DWG_TYPE_MTEXT) {
            Dwg_Entity_MTEXT *mtext = obj->tio.entity->tio.MTEXT;
            if (mtext->text && strlen(mtext->text) > 0) {
                // 截取前50个字符
                char buf[51];
                strncpy(buf, mtext->text, 50);
                buf[50] = '\0';
                printf("[MTEXT] %s%s\n", buf, 
                       strlen(mtext->text) > 50 ? "..." : "");
                count++;
            }
        }
    }
}

// 主函数
int main(int argc, char *argv[])
{
    Dwg_Data dwg;
    int error;
    
    if (argc < 2) {
        printf("用法: %s <dwg文件> [选项]\n", argv[0]);
        printf("选项:\n");
        printf("  -l    显示图层列表\n");
        printf("  -t    显示文本内容\n");
        printf("  -s    显示实体统计\n");
        printf("  -a    显示所有信息\n");
        return 1;
    }
    
    // 解析选项
    int show_layers = 0, show_texts = 0, show_stats = 0;
    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "-l") == 0) show_layers = 1;
        else if (strcmp(argv[i], "-t") == 0) show_texts = 1;
        else if (strcmp(argv[i], "-s") == 0) show_stats = 1;
        else if (strcmp(argv[i], "-a") == 0) {
            show_layers = show_texts = show_stats = 1;
        }
    }
    
    // 读取DWG
    memset(&dwg, 0, sizeof(Dwg_Data));
    error = dwg_read_file(argv[1], &dwg);
    
    if (error >= DWG_ERR_CRITICAL) {
        fprintf(stderr, "读取失败，错误码: 0x%x\n", error);
        return 1;
    }
    
    // 基本信息
    printf("==========================================\n");
    printf("DWG文件信息: %s\n", argv[1]);
    printf("==========================================\n");
    printf("版本: %s (%s)\n", 
           dwg.header.version, 
           get_version_name(dwg.header.version));
    printf("对象总数: %lu\n", (unsigned long)dwg.num_objects);
    printf("类数量: %lu\n", (unsigned long)dwg.num_classes);
    
    // 范围信息
    printf("\n图纸范围:\n");
    printf("  EXTMIN: (%.2f, %.2f, %.2f)\n",
           dwg.header_vars.EXTMIN.x,
           dwg.header_vars.EXTMIN.y,
           dwg.header_vars.EXTMIN.z);
    printf("  EXTMAX: (%.2f, %.2f, %.2f)\n",
           dwg.header_vars.EXTMAX.x,
           dwg.header_vars.EXTMAX.y,
           dwg.header_vars.EXTMAX.z);
    
    // 可选信息
    if (show_stats) print_entity_stats(&dwg);
    if (show_layers) print_layers(&dwg);
    if (show_texts) print_texts(&dwg, 20);
    
    dwg_free(&dwg);
    return 0;
}
```

**编译和使用：**

```bash
# 编译
gcc -o dwg_info dwg_info.c -lredwg -lm

# 使用
./dwg_info drawing.dwg -a
```

## 6.9 本章小结

本章介绍了LibreDWG的C语言API编程基础：

1. **头文件和编译**：dwg.h和dwg_api.h的使用，编译链接方法
2. **基本读取**：dwg_read_file函数和错误处理
3. **对象遍历**：遍历所有对象和按类型遍历
4. **实体访问**：LINE、CIRCLE、TEXT等实体的属性访问
5. **图层样式**：遍历图层、获取实体图层信息
6. **API函数**：dwg_api.h提供的简化接口
7. **实用示例**：完整的DWG信息查看器

---

**下一章预告**：[第07章 - DWG文件读取与解析](../第07章-DWG文件读取与解析) - 深入学习DWG文件的读取和解析技术。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第05章-命令行工具详解" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第07章-DWG文件读取与解析" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

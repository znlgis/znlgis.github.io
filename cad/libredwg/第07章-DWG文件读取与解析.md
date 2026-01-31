---
layout: default
title: 第07章 - DWG文件读取与解析
---

# 第07章 - DWG文件读取与解析

## 7.1 读取流程详解

### 7.1.1 读取函数

LibreDWG提供多种读取方式：

```c
// 从文件读取
int dwg_read_file(const char *filename, Dwg_Data *dwg);

// 从内存读取
int dwg_read_data(Dwg_Data *dwg, BITCODE_RC *data, size_t data_size);

// 设置版本后读取（用于特定版本处理）
void dwg_set_as_version(Dwg_Data *dwg, Dwg_Version_Type version);
```

### 7.1.2 读取流程

```
┌─────────────────────────────────────────┐
│           dwg_read_file()               │
├─────────────────────────────────────────┤
│  1. 打开文件                             │
│  2. 读取文件头（识别版本）               │
│  3. 根据版本调用相应解码器               │
│     ├── decode_R13_R2000()              │
│     ├── decode_R2004()                  │
│     └── decode_R2007()                  │
│  4. 解析各段数据                         │
│     ├── HEADER段                        │
│     ├── CLASSES段                       │
│     ├── HANDLES段                       │
│     └── OBJECTS段                       │
│  5. 解析对象引用                         │
│  6. 返回结果                             │
└─────────────────────────────────────────┘
```

### 7.1.3 完整读取示例

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dwg.h>

typedef struct {
    int verbose;
    int resolve_refs;
} ReadOptions;

int read_dwg_file(const char *filename, Dwg_Data *dwg, ReadOptions *opts)
{
    int error;
    
    // 初始化
    memset(dwg, 0, sizeof(Dwg_Data));
    
    // 设置选项
    if (opts && opts->verbose) {
        dwg->opts |= DWG_OPTS_IN;  // 输入详细信息
    }
    
    // 读取文件
    printf("正在读取: %s\n", filename);
    error = dwg_read_file(filename, dwg);
    
    // 处理读取结果
    if (error >= DWG_ERR_CRITICAL) {
        fprintf(stderr, "严重错误: 无法读取文件 (0x%x)\n", error);
        return -1;
    }
    
    if (error) {
        printf("警告: 读取过程中存在非严重错误 (0x%x)\n", error);
        
        if (error & DWG_ERR_WRONGCRC)
            printf("  - CRC校验错误\n");
        if (error & DWG_ERR_NOTYETSUPPORTED)
            printf("  - 某些功能尚不支持\n");
        if (error & DWG_ERR_UNHANDLEDCLASS)
            printf("  - 存在未处理的类\n");
        if (error & DWG_ERR_INVALIDTYPE)
            printf("  - 存在无效类型\n");
    }
    
    // 解析引用（如果需要）
    if (opts && opts->resolve_refs) {
        if (dwg->dirty_refs) {
            printf("正在解析对象引用...\n");
            dwg_resolve_objectrefs_silent(dwg);
        }
    }
    
    printf("读取完成\n");
    printf("  版本: %s\n", dwg->header.version);
    printf("  对象数: %lu\n", (unsigned long)dwg->num_objects);
    
    return 0;
}

int main(int argc, char *argv[])
{
    Dwg_Data dwg;
    ReadOptions opts = {1, 1};  // verbose=1, resolve_refs=1
    
    if (argc < 2) {
        printf("用法: %s <dwg文件>\n", argv[0]);
        return 1;
    }
    
    if (read_dwg_file(argv[1], &dwg, &opts) != 0) {
        return 1;
    }
    
    // 处理数据...
    
    dwg_free(&dwg);
    return 0;
}
```

## 7.2 头变量解析

### 7.2.1 常用头变量

```c
#include <dwg.h>

void parse_header_variables(Dwg_Data *dwg)
{
    Dwg_Header_Variables *vars = &dwg->header_vars;
    
    // 版本信息
    printf("=== 版本信息 ===\n");
    printf("ACADVER: %s\n", vars->ACADVER);
    printf("ACADMAINTVER: %d\n", vars->ACADMAINTVER);
    
    // 绘图范围
    printf("\n=== 绘图范围 ===\n");
    printf("EXTMIN: (%.4f, %.4f, %.4f)\n", 
           vars->EXTMIN.x, vars->EXTMIN.y, vars->EXTMIN.z);
    printf("EXTMAX: (%.4f, %.4f, %.4f)\n", 
           vars->EXTMAX.x, vars->EXTMAX.y, vars->EXTMAX.z);
    printf("LIMMIN: (%.4f, %.4f)\n", 
           vars->LIMMIN.x, vars->LIMMIN.y);
    printf("LIMMAX: (%.4f, %.4f)\n", 
           vars->LIMMAX.x, vars->LIMMAX.y);
    
    // 插入基点
    printf("\n=== 插入基点 ===\n");
    printf("INSBASE: (%.4f, %.4f, %.4f)\n",
           vars->INSBASE.x, vars->INSBASE.y, vars->INSBASE.z);
    
    // 单位设置
    printf("\n=== 单位设置 ===\n");
    printf("INSUNITS: %d\n", vars->INSUNITS);
    printf("LUNITS: %d\n", vars->LUNITS);
    printf("LUPREC: %d\n", vars->LUPREC);
    printf("AUNITS: %d\n", vars->AUNITS);
    printf("AUPREC: %d\n", vars->AUPREC);
    
    // 尺寸设置
    printf("\n=== 尺寸设置 ===\n");
    printf("DIMSCALE: %.4f\n", vars->DIMSCALE);
    printf("DIMASZ: %.4f\n", vars->DIMASZ);
    printf("DIMTXT: %.4f\n", vars->DIMTXT);
    
    // 时间信息
    printf("\n=== 时间信息 ===\n");
    printf("TDCREATE: %.6f\n", vars->TDCREATE.value);
    printf("TDUPDATE: %.6f\n", vars->TDUPDATE.value);
    printf("TDINDWG: %.6f\n", vars->TDINDWG.value);
}
```

### 7.2.2 单位换算

```c
#include <dwg.h>

// 获取单位名称
const char* get_unit_name(int insunits)
{
    switch (insunits) {
        case 0: return "无单位";
        case 1: return "英寸";
        case 2: return "英尺";
        case 3: return "英里";
        case 4: return "毫米";
        case 5: return "厘米";
        case 6: return "米";
        case 7: return "千米";
        case 8: return "微英寸";
        case 9: return "密耳";
        case 10: return "码";
        case 11: return "埃";
        case 12: return "纳米";
        case 13: return "微米";
        case 14: return "分米";
        case 15: return "十米";
        case 16: return "百米";
        case 17: return "吉米";
        case 18: return "天文单位";
        case 19: return "光年";
        case 20: return "秒差距";
        default: return "未知";
    }
}

// 单位转换因子（转换为米）
double get_unit_to_meters(int insunits)
{
    switch (insunits) {
        case 1: return 0.0254;       // 英寸
        case 2: return 0.3048;       // 英尺
        case 3: return 1609.344;     // 英里
        case 4: return 0.001;        // 毫米
        case 5: return 0.01;         // 厘米
        case 6: return 1.0;          // 米
        case 7: return 1000.0;       // 千米
        case 10: return 0.9144;      // 码
        case 14: return 0.1;         // 分米
        default: return 1.0;         // 默认为米
    }
}

void print_drawing_size(Dwg_Data *dwg)
{
    Dwg_Header_Variables *vars = &dwg->header_vars;
    
    double width = vars->EXTMAX.x - vars->EXTMIN.x;
    double height = vars->EXTMAX.y - vars->EXTMIN.y;
    
    int units = vars->INSUNITS;
    double factor = get_unit_to_meters(units);
    
    printf("图纸尺寸:\n");
    printf("  宽度: %.4f %s (%.4f 米)\n", 
           width, get_unit_name(units), width * factor);
    printf("  高度: %.4f %s (%.4f 米)\n", 
           height, get_unit_name(units), height * factor);
}
```

## 7.3 解析实体数据

### 7.3.1 按类型解析器

```c
#include <dwg.h>
#include <math.h>

// 几何信息结构
typedef struct {
    double x, y, z;
} Point3D;

typedef struct {
    Point3D start;
    Point3D end;
    double length;
} LineInfo;

typedef struct {
    Point3D center;
    double radius;
    double circumference;
    double area;
} CircleInfo;

// 解析LINE
int parse_line(Dwg_Object *obj, LineInfo *info)
{
    if (obj->fixedtype != DWG_TYPE_LINE) return -1;
    
    Dwg_Entity_LINE *line = obj->tio.entity->tio.LINE;
    
    info->start.x = line->start.x;
    info->start.y = line->start.y;
    info->start.z = line->start.z;
    info->end.x = line->end.x;
    info->end.y = line->end.y;
    info->end.z = line->end.z;
    
    double dx = info->end.x - info->start.x;
    double dy = info->end.y - info->start.y;
    double dz = info->end.z - info->start.z;
    info->length = sqrt(dx*dx + dy*dy + dz*dz);
    
    return 0;
}

// 解析CIRCLE
int parse_circle(Dwg_Object *obj, CircleInfo *info)
{
    if (obj->fixedtype != DWG_TYPE_CIRCLE) return -1;
    
    Dwg_Entity_CIRCLE *circle = obj->tio.entity->tio.CIRCLE;
    
    info->center.x = circle->center.x;
    info->center.y = circle->center.y;
    info->center.z = circle->center.z;
    info->radius = circle->radius;
    info->circumference = 2 * M_PI * info->radius;
    info->area = M_PI * info->radius * info->radius;
    
    return 0;
}

// 通用解析器
void parse_entities(Dwg_Data *dwg)
{
    BITCODE_BL i;
    int line_count = 0, circle_count = 0;
    double total_line_length = 0;
    double total_circle_area = 0;
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->supertype != DWG_SUPERTYPE_ENTITY) continue;
        
        switch (obj->fixedtype) {
            case DWG_TYPE_LINE: {
                LineInfo info;
                if (parse_line(obj, &info) == 0) {
                    total_line_length += info.length;
                    line_count++;
                }
                break;
            }
            case DWG_TYPE_CIRCLE: {
                CircleInfo info;
                if (parse_circle(obj, &info) == 0) {
                    total_circle_area += info.area;
                    circle_count++;
                }
                break;
            }
        }
    }
    
    printf("解析结果:\n");
    printf("  直线: %d 条, 总长度: %.4f\n", line_count, total_line_length);
    printf("  圆: %d 个, 总面积: %.4f\n", circle_count, total_circle_area);
}
```

### 7.3.2 解析多段线

```c
#include <dwg.h>

// 多段线顶点信息
typedef struct {
    double x, y;
    double bulge;       // 凸度
    double start_width;
    double end_width;
} PolylineVertex;

// 多段线信息
typedef struct {
    int num_vertices;
    PolylineVertex *vertices;
    int is_closed;
    double elevation;
    double total_length;
} PolylineInfo;

// 计算两点间距离
double point_distance(double x1, double y1, double x2, double y2)
{
    double dx = x2 - x1;
    double dy = y2 - y1;
    return sqrt(dx*dx + dy*dy);
}

// 计算圆弧长度（从凸度）
double arc_length_from_bulge(double chord_length, double bulge)
{
    if (fabs(bulge) < 1e-10) {
        return chord_length;  // 直线段
    }
    
    // 圆弧半径
    double theta = 4 * atan(fabs(bulge));
    double radius = chord_length / (2 * sin(theta / 2));
    
    return radius * theta;
}

// 解析LWPOLYLINE
int parse_lwpolyline(Dwg_Object *obj, PolylineInfo *info)
{
    if (obj->fixedtype != DWG_TYPE_LWPOLYLINE) return -1;
    
    Dwg_Entity_LWPOLYLINE *pline = obj->tio.entity->tio.LWPOLYLINE;
    
    info->num_vertices = pline->num_points;
    info->is_closed = (pline->flag & 1) ? 1 : 0;
    info->elevation = pline->elevation;
    
    // 分配顶点数组
    info->vertices = (PolylineVertex*)calloc(
        info->num_vertices, sizeof(PolylineVertex));
    
    if (!info->vertices) return -1;
    
    // 填充顶点数据
    for (BITCODE_BL i = 0; i < pline->num_points; i++) {
        info->vertices[i].x = pline->points[i].x;
        info->vertices[i].y = pline->points[i].y;
        
        if (i < pline->num_bulges && pline->bulges) {
            info->vertices[i].bulge = pline->bulges[i];
        }
        
        if (i < pline->num_widths && pline->widths) {
            info->vertices[i].start_width = pline->widths[i].start;
            info->vertices[i].end_width = pline->widths[i].end;
        }
    }
    
    // 计算总长度
    info->total_length = 0;
    int segments = info->is_closed ? info->num_vertices : info->num_vertices - 1;
    
    for (int i = 0; i < segments; i++) {
        int j = (i + 1) % info->num_vertices;
        
        double chord = point_distance(
            info->vertices[i].x, info->vertices[i].y,
            info->vertices[j].x, info->vertices[j].y);
        
        info->total_length += arc_length_from_bulge(chord, info->vertices[i].bulge);
    }
    
    return 0;
}

// 释放多段线信息
void free_polyline_info(PolylineInfo *info)
{
    if (info->vertices) {
        free(info->vertices);
        info->vertices = NULL;
    }
}

// 使用示例
void process_lwpolylines(Dwg_Data *dwg)
{
    BITCODE_BL i;
    
    printf("LWPOLYLINE列表:\n");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->fixedtype == DWG_TYPE_LWPOLYLINE) {
            PolylineInfo info;
            
            if (parse_lwpolyline(obj, &info) == 0) {
                printf("  句柄: 0x%lx\n", (unsigned long)obj->handle.value);
                printf("    顶点数: %d\n", info.num_vertices);
                printf("    闭合: %s\n", info.is_closed ? "是" : "否");
                printf("    总长度: %.4f\n", info.total_length);
                printf("\n");
                
                free_polyline_info(&info);
            }
        }
    }
}
```

### 7.3.3 解析块引用

```c
#include <dwg.h>

// 块引用信息
typedef struct {
    char *block_name;
    Point3D insertion_point;
    Point3D scale;
    double rotation;
    int has_attributes;
    int num_attributes;
} InsertInfo;

// 解析INSERT
int parse_insert(Dwg_Data *dwg, Dwg_Object *obj, InsertInfo *info)
{
    if (obj->fixedtype != DWG_TYPE_INSERT) return -1;
    
    Dwg_Entity_INSERT *insert = obj->tio.entity->tio.INSERT;
    
    // 插入点
    info->insertion_point.x = insert->ins_pt.x;
    info->insertion_point.y = insert->ins_pt.y;
    info->insertion_point.z = insert->ins_pt.z;
    
    // 缩放
    info->scale.x = insert->scale.x;
    info->scale.y = insert->scale.y;
    info->scale.z = insert->scale.z;
    
    // 旋转（弧度转角度）
    info->rotation = insert->rotation * 180.0 / M_PI;
    
    // 属性
    info->has_attributes = insert->has_attribs;
    info->num_attributes = insert->num_owned;
    
    // 获取块名
    info->block_name = NULL;
    if (insert->block_header && insert->block_header->obj) {
        Dwg_Object *blk_obj = insert->block_header->obj;
        if (blk_obj->fixedtype == DWG_TYPE_BLOCK_HEADER) {
            Dwg_Object_BLOCK_HEADER *blk = 
                blk_obj->tio.object->tio.BLOCK_HEADER;
            if (blk->name) {
                info->block_name = strdup(blk->name);
            }
        }
    }
    
    return 0;
}

// 处理块引用
void process_inserts(Dwg_Data *dwg)
{
    BITCODE_BL i;
    
    printf("块引用(INSERT)列表:\n");
    printf("%-20s %-30s %-10s %s\n", "块名", "插入点", "旋转", "属性数");
    printf("-------------------------------------------------------------------\n");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->fixedtype == DWG_TYPE_INSERT) {
            InsertInfo info;
            
            if (parse_insert(dwg, obj, &info) == 0) {
                printf("%-20s (%.2f,%.2f,%.2f)    %.2f°   %d\n",
                       info.block_name ? info.block_name : "(未知)",
                       info.insertion_point.x,
                       info.insertion_point.y,
                       info.insertion_point.z,
                       info.rotation,
                       info.num_attributes);
                
                if (info.block_name) free(info.block_name);
            }
        }
    }
}
```

## 7.4 解析尺寸标注

### 7.4.1 尺寸标注类型

```c
#include <dwg.h>

// 尺寸标注通用信息
typedef struct {
    int type;           // 尺寸类型
    char *dimension_text;
    double measurement;
    double text_rotation;
    Point3D text_position;
} DimensionInfo;

// 获取尺寸类型名称
const char* get_dimension_type_name(int type)
{
    switch (type) {
        case DWG_TYPE_DIMENSION_LINEAR: return "线性尺寸";
        case DWG_TYPE_DIMENSION_ALIGNED: return "对齐尺寸";
        case DWG_TYPE_DIMENSION_ANG3PT: return "三点角度";
        case DWG_TYPE_DIMENSION_ANG2LN: return "两线角度";
        case DWG_TYPE_DIMENSION_RADIUS: return "半径尺寸";
        case DWG_TYPE_DIMENSION_DIAMETER: return "直径尺寸";
        case DWG_TYPE_DIMENSION_ORDINATE: return "坐标尺寸";
        default: return "未知";
    }
}

// 解析线性尺寸
int parse_dimension_linear(Dwg_Object *obj, DimensionInfo *info)
{
    if (obj->fixedtype != DWG_TYPE_DIMENSION_LINEAR) return -1;
    
    Dwg_Entity_DIMENSION_LINEAR *dim = obj->tio.entity->tio.DIMENSION_LINEAR;
    
    info->type = DWG_TYPE_DIMENSION_LINEAR;
    info->measurement = dim->dim.act_measurement;
    info->text_rotation = dim->dim.text_rotation;
    info->text_position.x = dim->dim.text_midpt.x;
    info->text_position.y = dim->dim.text_midpt.y;
    info->text_position.z = 0;
    
    if (dim->dim.user_text) {
        info->dimension_text = strdup(dim->dim.user_text);
    } else {
        info->dimension_text = NULL;
    }
    
    return 0;
}

// 处理所有尺寸标注
void process_dimensions(Dwg_Data *dwg)
{
    BITCODE_BL i;
    int dim_count = 0;
    
    printf("尺寸标注列表:\n");
    printf("%-15s %-15s %-20s\n", "类型", "测量值", "文字");
    printf("--------------------------------------------------\n");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        // 检查是否为尺寸类型
        switch (obj->fixedtype) {
            case DWG_TYPE_DIMENSION_LINEAR:
            case DWG_TYPE_DIMENSION_ALIGNED:
            case DWG_TYPE_DIMENSION_ANG3PT:
            case DWG_TYPE_DIMENSION_ANG2LN:
            case DWG_TYPE_DIMENSION_RADIUS:
            case DWG_TYPE_DIMENSION_DIAMETER:
            case DWG_TYPE_DIMENSION_ORDINATE:
            {
                DimensionInfo info = {0};
                
                // 简化处理，使用通用字段
                if (obj->tio.entity) {
                    // 获取通用尺寸数据
                    printf("%-15s ", get_dimension_type_name(obj->fixedtype));
                    
                    // 根据类型解析
                    switch (obj->fixedtype) {
                        case DWG_TYPE_DIMENSION_LINEAR: {
                            Dwg_Entity_DIMENSION_LINEAR *d = 
                                obj->tio.entity->tio.DIMENSION_LINEAR;
                            printf("%-15.4f ", d->dim.act_measurement);
                            printf("%s\n", d->dim.user_text ? d->dim.user_text : "<>");
                            break;
                        }
                        // ... 其他类型类似处理
                        default:
                            printf("(未实现解析)\n");
                    }
                    
                    dim_count++;
                }
                break;
            }
        }
    }
    
    printf("\n共 %d 个尺寸标注\n", dim_count);
}
```

## 7.5 解析文本内容

### 7.5.1 提取所有文本

```c
#include <dwg.h>
#include <string.h>
#include <ctype.h>

// 文本信息
typedef struct {
    char *content;
    Point3D position;
    double height;
    double rotation;
    char *layer_name;
    int type;  // 1=TEXT, 2=MTEXT
} TextInfo;

// 清理MTEXT格式码
char* strip_mtext_formatting(const char *text)
{
    if (!text) return NULL;
    
    size_t len = strlen(text);
    char *result = (char*)malloc(len + 1);
    if (!result) return NULL;
    
    const char *src = text;
    char *dst = result;
    
    while (*src) {
        // 跳过格式码
        if (*src == '\\') {
            src++;
            // 常见格式码
            if (*src == 'P' || *src == 'p') {
                // 段落符号，替换为换行
                *dst++ = '\n';
                src++;
            } else if (*src == 'L' || *src == 'l' ||
                       *src == 'O' || *src == 'o' ||
                       *src == 'K' || *src == 'k' ||
                       *src == 'U' || *src == 'u') {
                // 下划线等样式码
                src++;
            } else if (*src == 'f' || *src == 'F' ||
                       *src == 'H' || *src == 'h' ||
                       *src == 'W' || *src == 'w' ||
                       *src == 'A' || *src == 'a' ||
                       *src == 'C' || *src == 'c') {
                // 跳过到分号
                while (*src && *src != ';') src++;
                if (*src == ';') src++;
            } else if (*src == '\\') {
                *dst++ = '\\';
                src++;
            } else {
                src++;
            }
        } else if (*src == '{' || *src == '}') {
            // 跳过花括号
            src++;
        } else {
            *dst++ = *src++;
        }
    }
    
    *dst = '\0';
    return result;
}

// 获取实体图层名
char* get_entity_layer_name(Dwg_Data *dwg, Dwg_Object *obj)
{
    if (obj->supertype != DWG_SUPERTYPE_ENTITY) return NULL;
    
    Dwg_Object_Entity *ent = obj->tio.entity;
    
    if (ent->layer && ent->layer->obj) {
        if (ent->layer->obj->fixedtype == DWG_TYPE_LAYER) {
            Dwg_Object_LAYER *layer = 
                ent->layer->obj->tio.object->tio.LAYER;
            return layer->name ? strdup(layer->name) : NULL;
        }
    }
    
    return strdup("0");  // 默认图层
}

// 提取所有文本
void extract_all_texts(Dwg_Data *dwg)
{
    BITCODE_BL i;
    
    printf("文本内容提取:\n");
    printf("============================================\n");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->fixedtype == DWG_TYPE_TEXT) {
            Dwg_Entity_TEXT *text = obj->tio.entity->tio.TEXT;
            char *layer = get_entity_layer_name(dwg, obj);
            
            printf("[TEXT] 图层: %-15s 位置: (%.2f, %.2f)\n",
                   layer ? layer : "0",
                   text->ins_pt.x, text->ins_pt.y);
            printf("  内容: %s\n\n",
                   text->text_value ? text->text_value : "(空)");
            
            if (layer) free(layer);
        }
        else if (obj->fixedtype == DWG_TYPE_MTEXT) {
            Dwg_Entity_MTEXT *mtext = obj->tio.entity->tio.MTEXT;
            char *layer = get_entity_layer_name(dwg, obj);
            char *clean_text = strip_mtext_formatting(mtext->text);
            
            printf("[MTEXT] 图层: %-15s 位置: (%.2f, %.2f)\n",
                   layer ? layer : "0",
                   mtext->ins_pt.x, mtext->ins_pt.y);
            printf("  内容: %s\n\n",
                   clean_text ? clean_text : "(空)");
            
            if (layer) free(layer);
            if (clean_text) free(clean_text);
        }
    }
}
```

### 7.5.2 搜索文本

```c
#include <dwg.h>
#include <string.h>
#include <regex.h>

// 文本搜索结果
typedef struct {
    unsigned long handle;
    char *text;
    double x, y;
    char *layer;
} TextSearchResult;

// 简单文本搜索
int search_text_simple(Dwg_Data *dwg, const char *pattern, 
                       int case_sensitive)
{
    BITCODE_BL i;
    int found_count = 0;
    
    printf("搜索: \"%s\" (%s)\n\n", pattern,
           case_sensitive ? "区分大小写" : "不区分大小写");
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        const char *text_content = NULL;
        double x = 0, y = 0;
        
        if (obj->fixedtype == DWG_TYPE_TEXT) {
            Dwg_Entity_TEXT *text = obj->tio.entity->tio.TEXT;
            text_content = text->text_value;
            x = text->ins_pt.x;
            y = text->ins_pt.y;
        }
        else if (obj->fixedtype == DWG_TYPE_MTEXT) {
            Dwg_Entity_MTEXT *mtext = obj->tio.entity->tio.MTEXT;
            text_content = mtext->text;
            x = mtext->ins_pt.x;
            y = mtext->ins_pt.y;
        }
        
        if (text_content) {
            int match;
            
            if (case_sensitive) {
                match = strstr(text_content, pattern) != NULL;
            } else {
                // 不区分大小写搜索
                char *text_lower = strdup(text_content);
                char *pattern_lower = strdup(pattern);
                
                for (char *p = text_lower; *p; p++) *p = tolower(*p);
                for (char *p = pattern_lower; *p; p++) *p = tolower(*p);
                
                match = strstr(text_lower, pattern_lower) != NULL;
                
                free(text_lower);
                free(pattern_lower);
            }
            
            if (match) {
                printf("找到: 句柄=0x%lx  位置=(%.2f, %.2f)\n",
                       (unsigned long)obj->handle.value, x, y);
                printf("  内容: %.100s%s\n\n",
                       text_content,
                       strlen(text_content) > 100 ? "..." : "");
                found_count++;
            }
        }
    }
    
    printf("共找到 %d 处匹配\n", found_count);
    return found_count;
}

// 正则表达式搜索
int search_text_regex(Dwg_Data *dwg, const char *pattern)
{
    regex_t regex;
    int ret;
    
    ret = regcomp(&regex, pattern, REG_EXTENDED | REG_ICASE);
    if (ret) {
        fprintf(stderr, "无效的正则表达式\n");
        return -1;
    }
    
    printf("正则搜索: \"%s\"\n\n", pattern);
    
    BITCODE_BL i;
    int found_count = 0;
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        const char *text_content = NULL;
        
        if (obj->fixedtype == DWG_TYPE_TEXT) {
            text_content = obj->tio.entity->tio.TEXT->text_value;
        }
        else if (obj->fixedtype == DWG_TYPE_MTEXT) {
            text_content = obj->tio.entity->tio.MTEXT->text;
        }
        
        if (text_content) {
            ret = regexec(&regex, text_content, 0, NULL, 0);
            if (!ret) {
                printf("匹配: 0x%lx - %s\n",
                       (unsigned long)obj->handle.value,
                       text_content);
                found_count++;
            }
        }
    }
    
    regfree(&regex);
    
    printf("\n共找到 %d 处匹配\n", found_count);
    return found_count;
}
```

## 7.6 解析扩展数据

### 7.6.1 读取EED

```c
#include <dwg.h>

// 打印扩展实体数据
void print_eed(Dwg_Object *obj)
{
    if (obj->supertype != DWG_SUPERTYPE_ENTITY) return;
    
    Dwg_Object_Entity *ent = obj->tio.entity;
    
    if (ent->num_eed == 0) return;
    
    printf("实体 0x%lx 的扩展数据:\n", (unsigned long)obj->handle.value);
    
    for (BITCODE_BL i = 0; i < ent->num_eed; i++) {
        Dwg_Eed *eed = &ent->eed[i];
        
        printf("  EED %lu:\n", (unsigned long)i);
        printf("    大小: %d\n", eed->size);
        printf("    应用程序句柄: 0x%lx\n", 
               eed->handle ? (unsigned long)eed->handle->absolute_ref : 0);
        
        // 遍历数据项
        Dwg_Eed_Data *data = eed->data;
        while (data) {
            printf("    代码 %d: ", data->code);
            
            switch (data->code) {
                case 0:  // 字符串
                    printf("字符串 = %s\n", data->u.eed_0.string);
                    break;
                case 1:  // 图层名
                    printf("图层名\n");
                    break;
                case 5:  // 句柄
                    printf("句柄\n");
                    break;
                case 10: // 点
                case 11:
                    printf("点 = (%.4f, %.4f, %.4f)\n",
                           data->u.eed_10.point.x,
                           data->u.eed_10.point.y,
                           data->u.eed_10.point.z);
                    break;
                case 40: // 实数
                case 41:
                case 42:
                    printf("实数 = %.6f\n", data->u.eed_40.real);
                    break;
                case 70: // 短整数
                    printf("短整数 = %d\n", data->u.eed_70.rs);
                    break;
                case 71: // 长整数
                    printf("长整数 = %ld\n", (long)data->u.eed_71.rl);
                    break;
                default:
                    printf("(未知类型)\n");
            }
            
            // 移动到下一个数据项
            // 注意：实际实现需要根据data结构正确遍历
            break;
        }
    }
}

// 查找特定应用的EED
void find_eed_by_appname(Dwg_Data *dwg, const char *appname)
{
    BITCODE_BL i, j;
    int found = 0;
    
    printf("搜索应用 \"%s\" 的扩展数据:\n", appname);
    
    for (i = 0; i < dwg->num_objects; i++) {
        Dwg_Object *obj = &dwg->object[i];
        
        if (obj->supertype != DWG_SUPERTYPE_ENTITY) continue;
        
        Dwg_Object_Entity *ent = obj->tio.entity;
        
        for (j = 0; j < ent->num_eed; j++) {
            Dwg_Eed *eed = &ent->eed[j];
            
            // 检查应用程序名称
            if (eed->handle && eed->handle->obj) {
                Dwg_Object *app_obj = eed->handle->obj;
                if (app_obj->fixedtype == DWG_TYPE_APPID) {
                    // 比较应用程序名称
                    // 实际实现需要访问APPID对象的name字段
                    found++;
                }
            }
        }
    }
    
    printf("找到 %d 个包含该应用扩展数据的实体\n", found);
}
```

## 7.7 本章小结

本章深入介绍了DWG文件的读取与解析：

1. **读取流程**：dwg_read_file的使用和错误处理
2. **头变量解析**：EXTMIN/EXTMAX、单位、时间等变量
3. **实体解析**：LINE、CIRCLE、LWPOLYLINE等的详细解析
4. **块引用解析**：INSERT的块名、插入点、缩放、旋转
5. **尺寸标注解析**：各种尺寸类型的解析方法
6. **文本提取**：TEXT和MTEXT的内容提取和格式清理
7. **扩展数据**：EED的读取和解析

---

**下一章预告**：[第08章 - DWG文件创建与写入](第08章-DWG文件创建与写入) - 学习如何使用LibreDWG创建新的DWG文件。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第06章-C语言API编程基础" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第08章-DWG文件创建与写入" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

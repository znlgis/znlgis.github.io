---
layout: default
title: 第06章：CSG 布尔建模方法
---

# 第06章：CSG 布尔建模方法

## 1. CSG 思维

CSG 是 Constructive Solid Geometry，即构造实体几何。OpenSCAD 的建模核心就是把基本体通过并集、差集、交集和变换组合为复杂实体。理解 CSG 的关键是把模型拆成“材料”和“刀具”：哪些体表示保留材料，哪些体表示切除空间，哪些体用于限制范围。

## 2. union 并集

`union` 合并多个对象：

```scad
union() {
    cube([40, 20, 5], center = true);
    translate([0, 0, 10]) cylinder(h = 20, d = 12, center = true);
}
```

许多情况下，多个顶层对象会隐式并列显示，但显式写 `union()` 能让结构更清晰，尤其是在差集或交集中作为一个整体使用时。

## 3. difference 差集

`difference` 用第一个子对象减去后续所有子对象：

```scad
difference() {
    cube([50, 30, 10], center = true);
    cylinder(h = 12, d = 8, center = true);
}
```

差集是机械建模中最常用的操作，用于孔、槽、腔体、倒角、避让和装配空间。

注意事项：

- 切除体要比被切对象略大，避免共面。
- 孔的圆柱应贯穿实体，而不是刚好等高。
- 差集对象过多会增加渲染时间，可分组优化。
- 切除体可用 `#` 高亮检查位置。

## 4. intersection 交集

`intersection` 只保留多个对象重叠区域：

```scad
intersection() {
    sphere(20);
    cube([30, 30, 10], center = true);
}
```

交集适合裁剪曲面、限制复杂对象范围、制作圆顶切片、生成特定包络内的结构。

## 5. 组合布尔的结构化写法

复杂模型应分模块写布尔逻辑：

```scad
module body() {
    cube([80, 40, 10], center = true);
}

module holes() {
    for (x = [-25, 25])
        translate([x, 0, 0]) cylinder(h = 12, d = 5, center = true);
}

module part() {
    difference() {
        body();
        holes();
    }
}

part();
```

这种写法比把所有语句堆在一个 `difference` 里更容易维护。

## 6. 避免共面问题

布尔运算中，两个面完全重合可能导致预览闪烁、渲染警告或导出异常。常见解决方式是添加微小余量：

```scad
epsilon = 0.01;

difference() {
    cube([40, 20, 5], center = true);
    translate([0, 0, 0]) cylinder(h = 5 + 2*epsilon, d = 8, center = true);
}
```

不要滥用过大的余量，否则会改变设计尺寸。`epsilon` 应只用于布尔稳定性，不应成为修补错误设计的工具。

## 7. 可制造性约束

CSG 只保证几何组合，不保证可制造。设计零件时还需考虑：

- 3D 打印最小壁厚。
- 螺丝孔预留间隙。
- 嵌件热熔孔径。
- 卡扣变形空间。
- FDM 桥接长度和支撑方向。
- SLA 排液孔和空腔厚度。
- CNC 刀具半径导致的内角限制。

例如，FDM 打印 M3 通孔不应简单设置 `d = 3.0`，通常需要根据机器、材料和后处理使用 3.2 到 3.5 mm 左右的孔径。

## 8. 用差集制作盒体

```scad
module open_box(size = [80, 50, 25], wall = 2) {
    difference() {
        cube(size, center = true);
        translate([0, 0, wall])
            cube([size[0]-2*wall, size[1]-2*wall, size[2]], center = true);
    }
}

open_box();
```

盒体看似简单，但工程细节很多：底部厚度、侧壁厚度、圆角、盖子配合、螺丝柱、筋板、倒角、开孔、文字标识都应拆分成独立模块。

## 9. 用 hull 制作圆角板

```scad
module rounded_plate(size = [60, 30, 4], r = 5) {
    hull() {
        for (x = [-size[0]/2+r, size[0]/2-r])
            for (y = [-size[1]/2+r, size[1]/2-r])
                translate([x, y, 0]) cylinder(h = size[2], r = r, center = true);
    }
}

rounded_plate();
```

这种方式比 `minkowski` 更快，适合二维平面圆角板。

## 10. 布尔建模检查清单

- 模型是否由清晰的主体、切除、参考三类对象组成？
- 切除体是否略微超出被切对象？
- 是否避免了重合面和零厚度？
- 是否把重复孔位封装为模块或循环？
- 是否把复杂布尔分阶段组织，便于定位问题？
- F6 渲染是否有非流形、自交或空对象警告？
- 导出后是否在切片软件或网格检查工具中确认闭合？

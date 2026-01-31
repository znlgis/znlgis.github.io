---
layout: post
title: "第06章 - Entity API实体管理"
date: 2024-03-06 10:00:00 +0800
categories: [GIS, CesiumJS]
tags: [CesiumJS, Entity, API]
---

# 第06章：Entity API实体管理

## 6.1 Entity 概述

### 6.1.1 什么是 Entity

Entity 是 CesiumJS 中的高级数据表示 API，提供了一种简单、统一的方式来描述场景中的各种对象。Entity API 封装了底层 Primitive 的复杂性，让开发者能够专注于数据本身。

```
┌─────────────────────────────────────────────────────────────────┐
│                        Entity API                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  特点：                                                          │
│  ├── 简单易用的对象模型                                          │
│  ├── 自动处理时间动态属性                                        │
│  ├── 内置多种图形类型                                            │
│  ├── 自动管理渲染优化                                            │
│  └── 支持拾取和信息展示                                          │
│                                                                  │
│  图形类型：                                                      │
│  ├── point      - 点                                            │
│  ├── billboard  - 广告牌（图标）                                 │
│  ├── label      - 标签（文字）                                   │
│  ├── polyline   - 折线                                          │
│  ├── polygon    - 多边形                                        │
│  ├── rectangle  - 矩形                                          │
│  ├── ellipse    - 椭圆                                          │
│  ├── corridor   - 走廊                                          │
│  ├── wall       - 墙                                            │
│  ├── cylinder   - 圆柱                                          │
│  ├── ellipsoid  - 椭球                                          │
│  ├── box        - 盒子                                          │
│  ├── model      - 3D模型                                        │
│  └── path       - 路径                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.1.2 Entity 基本结构

```javascript
const entity = viewer.entities.add({
    // 基本属性
    id: 'unique-id',           // 唯一标识
    name: '实体名称',          // 名称
    description: '描述信息',   // HTML 描述（显示在 InfoBox）
    show: true,                // 是否显示
    
    // 位置（可选，某些图形需要）
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
    
    // 方向（可选）
    orientation: Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(heading, pitch, roll)
    ),
    
    // 图形组件（可同时拥有多个）
    point: { /* 点配置 */ },
    billboard: { /* 广告牌配置 */ },
    label: { /* 标签配置 */ },
    polyline: { /* 折线配置 */ },
    polygon: { /* 多边形配置 */ },
    // ... 其他图形组件
    
    // 自定义属性
    properties: {
        customField1: 'value1',
        customField2: 'value2'
    }
});
```

## 6.2 点状实体

### 6.2.1 Point（点）

```javascript
// 基本点
const point = viewer.entities.add({
    name: '基本点',
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
    point: {
        pixelSize: 10,                       // 像素大小
        color: Cesium.Color.RED,             // 颜色
        outlineColor: Cesium.Color.WHITE,    // 轮廓颜色
        outlineWidth: 2                      // 轮廓宽度
    }
});

// 完整配置
const advancedPoint = viewer.entities.add({
    name: '高级点',
    position: Cesium.Cartesian3.fromDegrees(116.5, 39.9, 100),
    point: {
        show: true,                          // 是否显示
        pixelSize: 15,                       // 像素大小
        color: Cesium.Color.YELLOW,          // 颜色
        outlineColor: Cesium.Color.BLACK,    // 轮廓颜色
        outlineWidth: 3,                     // 轮廓宽度
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 高度参考
        scaleByDistance: new Cesium.NearFarScalar(1000, 2, 100000, 0.5), // 距离缩放
        translucencyByDistance: new Cesium.NearFarScalar(1000, 1, 100000, 0.2), // 距离透明度
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000), // 显示距离
        disableDepthTestDistance: Number.POSITIVE_INFINITY // 禁用深度测试距离
    }
});
```

### 6.2.2 Billboard（广告牌）

```javascript
// 基本广告牌
const billboard = viewer.entities.add({
    name: '图标',
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.8, 100),
    billboard: {
        image: 'marker.png',                 // 图片 URL
        width: 32,                           // 宽度（像素）
        height: 32,                          // 高度（像素）
        scale: 1.0                           // 缩放
    }
});

// 完整配置
const advancedBillboard = viewer.entities.add({
    name: '高级图标',
    position: Cesium.Cartesian3.fromDegrees(116.5, 39.8, 100),
    billboard: {
        show: true,
        image: 'marker.png',
        width: 48,
        height: 48,
        scale: 1.0,
        color: Cesium.Color.WHITE,           // 着色
        rotation: Cesium.Math.toRadians(45), // 旋转角度
        alignedAxis: Cesium.Cartesian3.ZERO, // 对齐轴
        
        // 锚点位置
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        
        // 像素偏移
        pixelOffset: new Cesium.Cartesian2(0, -10),
        
        // 眼睛偏移（相机空间）
        eyeOffset: new Cesium.Cartesian3(0, 0, 0),
        
        // 高度参考
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        
        // 距离缩放
        scaleByDistance: new Cesium.NearFarScalar(1000, 2, 100000, 0.5),
        
        // 距离透明度
        translucencyByDistance: new Cesium.NearFarScalar(1000, 1, 100000, 0.3),
        
        // 像素偏移缩放
        pixelOffsetScaleByDistance: new Cesium.NearFarScalar(1000, 1, 100000, 0.1),
        
        // 显示距离条件
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000),
        
        // 禁用深度测试
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        
        // 尺寸（覆盖 width/height）
        sizeInMeters: false
    }
});

// 使用 Canvas 生成图标
function createCustomBillboard(text, color = '#ff0000') {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // 绘制圆形背景
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // 绘制文字
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    
    return canvas.toDataURL();
}

viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(116.6, 39.8, 100),
    billboard: {
        image: createCustomBillboard('A', '#3498db'),
        width: 48,
        height: 48
    }
});
```

### 6.2.3 Label（标签）

```javascript
// 基本标签
const label = viewer.entities.add({
    name: '文字标签',
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.7, 100),
    label: {
        text: '北京',
        font: '16px sans-serif',
        fillColor: Cesium.Color.WHITE
    }
});

// 完整配置
const advancedLabel = viewer.entities.add({
    name: '高级标签',
    position: Cesium.Cartesian3.fromDegrees(116.5, 39.7, 100),
    label: {
        show: true,
        text: '高级标签示例',
        
        // 字体样式
        font: 'bold 20px Microsoft YaHei',
        
        // 填充样式
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        
        // 轮廓样式
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        
        // 背景
        showBackground: true,
        backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.8),
        backgroundPadding: new Cesium.Cartesian2(8, 4),
        
        // 位置
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        eyeOffset: new Cesium.Cartesian3(0, 0, 0),
        
        // 高度参考
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        
        // 距离缩放
        scaleByDistance: new Cesium.NearFarScalar(1000, 1.5, 100000, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(1000, 1, 100000, 0.3),
        
        // 显示条件
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
});

// 点 + 标签组合
viewer.entities.add({
    name: '标注点',
    position: Cesium.Cartesian3.fromDegrees(116.6, 39.7, 100),
    point: {
        pixelSize: 8,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
    },
    label: {
        text: '标注点',
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12)
    }
});
```

## 6.3 线状实体

### 6.3.1 Polyline（折线）

```javascript
// 基本折线
const polyline = viewer.entities.add({
    name: '基本折线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            116.0, 39.0,
            116.5, 39.5,
            117.0, 39.0
        ]),
        width: 3,
        material: Cesium.Color.RED
    }
});

// 带高度的折线
const polyline3D = viewer.entities.add({
    name: '3D折线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            116.0, 39.0, 1000,
            116.5, 39.5, 5000,
            117.0, 39.0, 2000
        ]),
        width: 5,
        material: Cesium.Color.YELLOW
    }
});

// 贴地折线
const groundPolyline = viewer.entities.add({
    name: '贴地折线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            116.0, 38.5,
            117.0, 38.5
        ]),
        width: 5,
        material: Cesium.Color.GREEN,
        clampToGround: true  // 贴地
    }
});

// 虚线材质
const dashedPolyline = viewer.entities.add({
    name: '虚线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            116.0, 38.0,
            117.0, 38.0
        ]),
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.CYAN,
            dashLength: 16,
            dashPattern: parseInt('1111000011110000', 2)
        })
    }
});

// 箭头材质
const arrowPolyline = viewer.entities.add({
    name: '箭头线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            116.0, 37.5,
            117.0, 37.5
        ]),
        width: 10,
        material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.PURPLE)
    }
});

// 发光材质
const glowPolyline = viewer.entities.add({
    name: '发光线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            116.0, 37.0,
            117.0, 37.0
        ]),
        width: 10,
        material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.BLUE
        })
    }
});

// 轮廓材质
const outlinePolyline = viewer.entities.add({
    name: '轮廓线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            116.0, 36.5,
            117.0, 36.5
        ]),
        width: 8,
        material: new Cesium.PolylineOutlineMaterialProperty({
            color: Cesium.Color.ORANGE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK
        })
    }
});

// 渐变材质
const gradientPolyline = viewer.entities.add({
    name: '渐变线',
    polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            116.0, 36.0,
            117.0, 36.0
        ]),
        width: 10,
        material: new Cesium.PolylineColorAppearance({
            colors: [
                Cesium.Color.RED,
                Cesium.Color.YELLOW,
                Cesium.Color.GREEN
            ]
        })
    }
});
```

### 6.3.2 Corridor（走廊）

```javascript
// 基本走廊
const corridor = viewer.entities.add({
    name: '走廊',
    corridor: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            115.0, 39.0,
            115.5, 39.5,
            116.0, 39.0
        ]),
        width: 5000,  // 宽度（米）
        material: Cesium.Color.RED.withAlpha(0.5)
    }
});

// 带高度的走廊
const extrudedCorridor = viewer.entities.add({
    name: '立体走廊',
    corridor: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            115.0, 38.5,
            115.5, 39.0,
            116.0, 38.5
        ]),
        width: 3000,
        height: 100,           // 底部高度
        extrudedHeight: 1000,  // 顶部高度
        material: Cesium.Color.BLUE.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.WHITE
    }
});

// 贴地走廊
const groundCorridor = viewer.entities.add({
    name: '贴地走廊',
    corridor: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            115.0, 38.0,
            115.5, 38.5,
            116.0, 38.0
        ]),
        width: 2000,
        material: Cesium.Color.GREEN.withAlpha(0.5),
        classificationType: Cesium.ClassificationType.TERRAIN  // 贴地
    }
});
```

### 6.3.3 Wall（墙）

```javascript
// 基本墙
const wall = viewer.entities.add({
    name: '墙',
    wall: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            114.0, 39.0, 0,
            114.5, 39.0, 0,
            114.5, 39.5, 0,
            114.0, 39.5, 0,
            114.0, 39.0, 0
        ]),
        maximumHeights: [1000, 2000, 3000, 2000, 1000],
        minimumHeights: [0, 0, 0, 0, 0],
        material: Cesium.Color.RED.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.BLACK
    }
});

// 简化墙（统一高度）
const simpleWall = viewer.entities.add({
    name: '简单墙',
    wall: {
        positions: Cesium.Cartesian3.fromDegreesArray([
            114.0, 38.5,
            114.5, 38.5,
            114.5, 39.0,
            114.0, 39.0,
            114.0, 38.5
        ]),
        minimumHeights: new Array(5).fill(0),
        maximumHeights: new Array(5).fill(2000),
        material: new Cesium.ImageMaterialProperty({
            image: 'wall_texture.png',
            repeat: new Cesium.Cartesian2(4, 1)
        })
    }
});
```

## 6.4 面状实体

### 6.4.1 Polygon（多边形）

```javascript
// 基本多边形
const polygon = viewer.entities.add({
    name: '基本多边形',
    polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
            118.0, 39.0,
            119.0, 39.0,
            119.0, 40.0,
            118.0, 40.0
        ]),
        material: Cesium.Color.RED.withAlpha(0.5)
    }
});

// 带孔洞的多边形
const polygonWithHoles = viewer.entities.add({
    name: '带孔多边形',
    polygon: {
        hierarchy: {
            positions: Cesium.Cartesian3.fromDegreesArray([
                118.0, 38.0,
                119.5, 38.0,
                119.5, 39.0,
                118.0, 39.0
            ]),
            holes: [{
                positions: Cesium.Cartesian3.fromDegreesArray([
                    118.3, 38.3,
                    118.7, 38.3,
                    118.7, 38.7,
                    118.3, 38.7
                ])
            }, {
                positions: Cesium.Cartesian3.fromDegreesArray([
                    119.0, 38.3,
                    119.3, 38.3,
                    119.3, 38.7,
                    119.0, 38.7
                ])
            }]
        },
        material: Cesium.Color.BLUE.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
    }
});

// 立体多边形（拉伸）
const extrudedPolygon = viewer.entities.add({
    name: '立体多边形',
    polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
            118.0, 37.0,
            118.5, 37.0,
            118.5, 37.5,
            118.0, 37.5
        ]),
        height: 0,              // 底部高度
        extrudedHeight: 10000,  // 顶部高度
        material: Cesium.Color.ORANGE.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.WHITE
    }
});

// 贴地多边形
const groundPolygon = viewer.entities.add({
    name: '贴地多边形',
    polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
            118.5, 37.0,
            119.0, 37.0,
            119.0, 37.5,
            118.5, 37.5
        ]),
        material: Cesium.Color.GREEN.withAlpha(0.5),
        classificationType: Cesium.ClassificationType.TERRAIN
    }
});

// 带纹理的多边形
const texturedPolygon = viewer.entities.add({
    name: '纹理多边形',
    polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
            119.0, 37.0,
            119.5, 37.0,
            119.5, 37.5,
            119.0, 37.5
        ]),
        material: new Cesium.ImageMaterialProperty({
            image: 'texture.png',
            repeat: new Cesium.Cartesian2(2, 2)
        })
    }
});

// 渐变/条纹多边形
const stripedPolygon = viewer.entities.add({
    name: '条纹多边形',
    polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
            119.5, 37.0,
            120.0, 37.0,
            120.0, 37.5,
            119.5, 37.5
        ]),
        material: new Cesium.StripeMaterialProperty({
            evenColor: Cesium.Color.WHITE,
            oddColor: Cesium.Color.BLUE,
            repeat: 10
        })
    }
});
```

### 6.4.2 Rectangle（矩形）

```javascript
// 基本矩形
const rectangle = viewer.entities.add({
    name: '矩形',
    rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(120.0, 39.0, 121.0, 40.0),
        material: Cesium.Color.RED.withAlpha(0.5)
    }
});

// 立体矩形
const extrudedRectangle = viewer.entities.add({
    name: '立体矩形',
    rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(120.0, 38.0, 121.0, 39.0),
        height: 0,
        extrudedHeight: 5000,
        material: Cesium.Color.BLUE.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.WHITE
    }
});

// 带纹理的矩形
const texturedRectangle = viewer.entities.add({
    name: '纹理矩形',
    rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(121.0, 38.0, 122.0, 39.0),
        material: new Cesium.ImageMaterialProperty({
            image: 'satellite.jpg'
        }),
        rotation: Cesium.Math.toRadians(45)  // 旋转
    }
});
```

### 6.4.3 Ellipse（椭圆）

```javascript
// 基本椭圆（圆）
const circle = viewer.entities.add({
    name: '圆形',
    position: Cesium.Cartesian3.fromDegrees(122.0, 39.5, 0),
    ellipse: {
        semiMajorAxis: 50000,  // 长半轴（米）
        semiMinorAxis: 50000,  // 短半轴（米）= 长半轴时为圆
        material: Cesium.Color.RED.withAlpha(0.5)
    }
});

// 椭圆
const ellipse = viewer.entities.add({
    name: '椭圆',
    position: Cesium.Cartesian3.fromDegrees(122.0, 38.5, 0),
    ellipse: {
        semiMajorAxis: 80000,
        semiMinorAxis: 40000,
        rotation: Cesium.Math.toRadians(45),  // 旋转角度
        material: Cesium.Color.BLUE.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
    }
});

// 立体椭圆（圆柱/椭圆柱）
const extrudedEllipse = viewer.entities.add({
    name: '立体椭圆',
    position: Cesium.Cartesian3.fromDegrees(123.0, 39.0, 0),
    ellipse: {
        semiMajorAxis: 30000,
        semiMinorAxis: 30000,
        height: 0,
        extrudedHeight: 20000,
        material: Cesium.Color.GREEN.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.BLACK
    }
});

// 贴地椭圆
const groundEllipse = viewer.entities.add({
    name: '贴地椭圆',
    position: Cesium.Cartesian3.fromDegrees(123.0, 38.0, 0),
    ellipse: {
        semiMajorAxis: 50000,
        semiMinorAxis: 30000,
        material: Cesium.Color.YELLOW.withAlpha(0.5),
        classificationType: Cesium.ClassificationType.TERRAIN
    }
});
```

## 6.5 立体实体

### 6.5.1 Box（盒子）

```javascript
// 基本盒子
const box = viewer.entities.add({
    name: '盒子',
    position: Cesium.Cartesian3.fromDegrees(124.0, 39.5, 10000),
    box: {
        dimensions: new Cesium.Cartesian3(10000, 10000, 20000), // 长/宽/高（米）
        material: Cesium.Color.RED.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.BLACK
    }
});

// 带方向的盒子
const orientedBox = viewer.entities.add({
    name: '旋转盒子',
    position: Cesium.Cartesian3.fromDegrees(124.0, 38.5, 10000),
    orientation: Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(124.0, 38.5, 10000),
        new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(45),  // 航向
            Cesium.Math.toRadians(0),   // 俯仰
            Cesium.Math.toRadians(0)    // 翻滚
        )
    ),
    box: {
        dimensions: new Cesium.Cartesian3(15000, 8000, 25000),
        material: Cesium.Color.BLUE.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.WHITE
    }
});
```

### 6.5.2 Cylinder（圆柱）

```javascript
// 圆柱
const cylinder = viewer.entities.add({
    name: '圆柱',
    position: Cesium.Cartesian3.fromDegrees(125.0, 39.5, 10000),
    cylinder: {
        length: 20000,        // 高度（米）
        topRadius: 5000,      // 顶部半径
        bottomRadius: 5000,   // 底部半径
        material: Cesium.Color.GREEN.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.BLACK
    }
});

// 圆锥
const cone = viewer.entities.add({
    name: '圆锥',
    position: Cesium.Cartesian3.fromDegrees(125.0, 38.5, 10000),
    cylinder: {
        length: 20000,
        topRadius: 0,         // 顶部半径为0 = 圆锥
        bottomRadius: 8000,
        material: Cesium.Color.ORANGE.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.BLACK
    }
});

// 截锥
const frustum = viewer.entities.add({
    name: '截锥',
    position: Cesium.Cartesian3.fromDegrees(126.0, 39.0, 10000),
    cylinder: {
        length: 15000,
        topRadius: 3000,
        bottomRadius: 8000,
        material: Cesium.Color.PURPLE.withAlpha(0.7)
    }
});
```

### 6.5.3 Ellipsoid（椭球）

```javascript
// 球体
const sphere = viewer.entities.add({
    name: '球体',
    position: Cesium.Cartesian3.fromDegrees(127.0, 39.5, 15000),
    ellipsoid: {
        radii: new Cesium.Cartesian3(10000, 10000, 10000), // x/y/z 半径相等 = 球
        material: Cesium.Color.RED.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.BLACK
    }
});

// 椭球
const ellipsoid = viewer.entities.add({
    name: '椭球',
    position: Cesium.Cartesian3.fromDegrees(127.0, 38.5, 15000),
    ellipsoid: {
        radii: new Cesium.Cartesian3(15000, 10000, 8000),
        material: Cesium.Color.BLUE.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.WHITE
    }
});

// 半球（用于传感器等）
const hemisphere = viewer.entities.add({
    name: '半球',
    position: Cesium.Cartesian3.fromDegrees(128.0, 39.0, 0),
    ellipsoid: {
        radii: new Cesium.Cartesian3(20000, 20000, 20000),
        innerRadii: new Cesium.Cartesian3(0, 0, 0),
        minimumClock: Cesium.Math.toRadians(0),
        maximumClock: Cesium.Math.toRadians(360),
        minimumCone: Cesium.Math.toRadians(0),
        maximumCone: Cesium.Math.toRadians(90),  // 只显示上半球
        material: Cesium.Color.CYAN.withAlpha(0.5)
    }
});
```

## 6.6 3D 模型

### 6.6.1 Model（模型）

```javascript
// 基本模型
const model = viewer.entities.add({
    name: '3D模型',
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 0),
    model: {
        uri: 'model.glb',
        scale: 1.0
    }
});

// 完整配置
const advancedModel = viewer.entities.add({
    name: '高级模型',
    position: Cesium.Cartesian3.fromDegrees(116.5, 39.9, 0),
    orientation: Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(116.5, 39.9, 0),
        new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(90),
            0,
            0
        )
    ),
    model: {
        uri: 'model.glb',
        scale: 2.0,
        minimumPixelSize: 64,         // 最小像素大小
        maximumScale: 20000,          // 最大缩放
        
        // 颜色混合
        color: Cesium.Color.WHITE,
        colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
        colorBlendAmount: 0.5,
        
        // 轮廓
        silhouetteColor: Cesium.Color.RED,
        silhouetteSize: 2.0,
        
        // 光照
        lightColor: undefined,        // 使用场景光照
        imageBasedLightingFactor: new Cesium.Cartesian2(1.0, 1.0),
        
        // 阴影
        shadows: Cesium.ShadowMode.ENABLED,
        
        // 裁剪平面
        clippingPlanes: undefined,
        
        // 高度参考
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        
        // 显示条件
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000),
        
        // 动画
        runAnimations: true,          // 运行内置动画
        clampAnimations: true         // 动画循环
    }
});

// 动画模型控制
const animatedModel = viewer.entities.add({
    name: '动画模型',
    position: Cesium.Cartesian3.fromDegrees(116.6, 39.9, 0),
    model: {
        uri: 'animated_model.glb',
        scale: 1.0,
        runAnimations: true
    }
});

// 获取模型后控制动画
viewer.scene.postRender.addEventListener(function() {
    const model = animatedModel.model;
    if (model && model.ready) {
        // 可以访问模型动画
    }
});
```

## 6.7 EntityCollection 管理

### 6.7.1 实体集合操作

```javascript
const entities = viewer.entities;

// ===== 添加实体 =====
const entity = entities.add({
    name: '实体',
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
    point: { pixelSize: 10 }
});

// ===== 获取实体 =====
const byId = entities.getById('entity-id');
const all = entities.values;  // 所有实体数组

// ===== 检查实体 =====
const contains = entities.contains(entity);

// ===== 移除实体 =====
entities.remove(entity);
entities.removeById('entity-id');
entities.removeAll();

// ===== 挂起/恢复事件 =====
entities.suspendEvents();  // 挂起事件
// 批量操作...
entities.resumeEvents();   // 恢复事件

// ===== 事件监听 =====
entities.collectionChanged.addEventListener(function(collection, added, removed, changed) {
    console.log('添加:', added.length);
    console.log('移除:', removed.length);
    console.log('修改:', changed.length);
});
```

### 6.7.2 批量创建实体

```javascript
// 高效批量创建
function createBulkEntities(viewer, dataArray) {
    const entities = viewer.entities;
    
    // 挂起事件，提高性能
    entities.suspendEvents();
    
    try {
        dataArray.forEach((data, index) => {
            entities.add({
                id: `point-${index}`,
                name: data.name,
                position: Cesium.Cartesian3.fromDegrees(data.lon, data.lat, data.height || 0),
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.fromCssColorString(data.color || '#ff0000')
                },
                label: {
                    text: data.name,
                    font: '12px sans-serif',
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10)
                },
                properties: data.properties
            });
        });
    } finally {
        // 确保恢复事件
        entities.resumeEvents();
    }
}

// 使用示例
const data = [
    { name: '点1', lon: 116.0, lat: 39.0, color: '#ff0000' },
    { name: '点2', lon: 117.0, lat: 39.5, color: '#00ff00' },
    { name: '点3', lon: 118.0, lat: 40.0, color: '#0000ff' }
];

createBulkEntities(viewer, data);
```

### 6.7.3 实体过滤与查询

```javascript
// 按条件过滤实体
function filterEntities(entities, predicate) {
    return entities.values.filter(predicate);
}

// 示例：获取所有点实体
const pointEntities = filterEntities(viewer.entities, entity => entity.point);

// 示例：获取特定属性的实体
const redEntities = filterEntities(viewer.entities, entity => {
    return entity.point && 
           entity.point.color && 
           entity.point.color.getValue().equals(Cesium.Color.RED);
});

// 示例：获取可见范围内的实体
function getVisibleEntities(viewer) {
    const rectangle = viewer.camera.computeViewRectangle();
    if (!rectangle) return [];
    
    return viewer.entities.values.filter(entity => {
        if (!entity.position) return false;
        const position = entity.position.getValue(viewer.clock.currentTime);
        if (!position) return false;
        
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        return Cesium.Rectangle.contains(rectangle, cartographic);
    });
}
```

## 6.8 实体交互

### 6.8.1 选择与高亮

```javascript
// 监听选中实体变化
viewer.selectedEntityChanged.addEventListener(function(entity) {
    if (entity) {
        console.log('选中:', entity.name);
    } else {
        console.log('取消选中');
    }
});

// 手动设置选中实体
viewer.selectedEntity = entity;

// 自定义高亮效果
function highlightEntity(entity, highlighted) {
    if (entity.point) {
        entity.point.color = highlighted ? Cesium.Color.YELLOW : Cesium.Color.RED;
        entity.point.pixelSize = highlighted ? 15 : 10;
    }
    
    if (entity.polygon) {
        entity.polygon.material = highlighted 
            ? Cesium.Color.YELLOW.withAlpha(0.7) 
            : Cesium.Color.RED.withAlpha(0.5);
    }
}

// 鼠标悬停高亮
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
let highlightedEntity = null;

handler.setInputAction(function(movement) {
    const pickedObject = viewer.scene.pick(movement.endPosition);
    
    // 取消之前的高亮
    if (highlightedEntity) {
        highlightEntity(highlightedEntity, false);
        highlightedEntity = null;
    }
    
    // 高亮新实体
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
        highlightedEntity = pickedObject.id;
        highlightEntity(highlightedEntity, true);
    }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
```

### 6.8.2 实体信息展示

```javascript
// 设置实体描述（显示在 InfoBox）
const entityWithInfo = viewer.entities.add({
    name: '信息实体',
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 0),
    point: { pixelSize: 10, color: Cesium.Color.RED },
    description: `
        <h3>实体信息</h3>
        <table>
            <tr><td>名称</td><td>信息实体</td></tr>
            <tr><td>经度</td><td>116.4°</td></tr>
            <tr><td>纬度</td><td>39.9°</td></tr>
        </table>
        <p>这是一段描述文字。</p>
    `
});

// 动态生成描述
function generateDescription(entity) {
    const position = entity.position.getValue(viewer.clock.currentTime);
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    
    return `
        <div style="padding: 10px;">
            <h3>${entity.name}</h3>
            <p>经度: ${Cesium.Math.toDegrees(cartographic.longitude).toFixed(4)}°</p>
            <p>纬度: ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(4)}°</p>
            <p>高度: ${cartographic.height.toFixed(2)} 米</p>
        </div>
    `;
}

// 监听选中并更新描述
viewer.selectedEntityChanged.addEventListener(function(entity) {
    if (entity) {
        entity.description = generateDescription(entity);
    }
});
```

## 6.9 本章小结

本章详细介绍了 Entity API：

1. **Entity 概念**：高级数据表示方式
2. **点状实体**：Point、Billboard、Label
3. **线状实体**：Polyline、Corridor、Wall
4. **面状实体**：Polygon、Rectangle、Ellipse
5. **立体实体**：Box、Cylinder、Ellipsoid
6. **3D 模型**：Model 加载与配置
7. **集合管理**：EntityCollection 操作
8. **交互处理**：选择、高亮、信息展示

在下一章中，我们将详细介绍 Primitive 底层渲染 API。

## 6.10 思考与练习

1. 创建一个包含多种实体类型的演示场景。
2. 实现实体的批量导入导出功能。
3. 开发自定义的实体样式管理器。
4. 实现鼠标悬停显示实体信息的功能。
5. 创建一个实体编辑器，支持拖拽移动实体。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第05章-相机系统与视角控制" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第07章-Primitive底层渲染" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
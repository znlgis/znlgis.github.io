---
layout: post
title: "第07章 - Primitive底层渲染"
date: 2024-03-07 10:00:00 +0800
categories: [GIS, CesiumJS]
tags: [CesiumJS, Primitive, 渲染]
---

# 第07章：Primitive底层渲染

## 7.1 Primitive 概述

### 7.1.1 Primitive vs Entity

Primitive 是 CesiumJS 的底层渲染 API，相比 Entity API 有更高的性能和灵活性：

```
┌─────────────────────────────────────────────────────────────────┐
│                   Entity vs Primitive 对比                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Entity API                                                      │
│  ├── 简单易用，面向对象                                          │
│  ├── 自动处理时间动态                                            │
│  ├── 内置拾取和信息展示                                          │
│  ├── 适合中小规模数据                                            │
│  └── 性能较低（有额外开销）                                      │
│                                                                  │
│  Primitive API                                                   │
│  ├── 性能更高，接近原生 WebGL                                    │
│  ├── 支持几何实例化（GPU Instancing）                            │
│  ├── 更灵活的外观控制                                            │
│  ├── 适合大规模数据渲染                                          │
│  └── 需要更多代码，学习曲线较陡                                  │
│                                                                  │
│  选择建议：                                                      │
│  ├── < 1000 个对象 → Entity API                                 │
│  ├── > 1000 个对象 → Primitive API                              │
│  ├── 需要动态属性 → Entity API                                  │
│  └── 需要极致性能 → Primitive API                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.1.2 Primitive 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Primitive 架构                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Primitive                                                       │
│  ├── GeometryInstance[]  (几何实例数组)                         │
│  │   ├── Geometry        (几何形状)                             │
│  │   ├── modelMatrix     (模型矩阵)                             │
│  │   ├── id              (标识符)                               │
│  │   └── attributes      (实例属性)                             │
│  │                                                              │
│  └── Appearance          (外观)                                 │
│      ├── material        (材质)                                 │
│      ├── vertexShader    (顶点着色器)                           │
│      └── fragmentShader  (片段着色器)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Geometry（几何体）

### 7.2.1 内置几何类型

CesiumJS 提供了丰富的内置几何类型：

```javascript
// ===== 点几何 =====
// 注意：点通常使用 PointPrimitiveCollection

// ===== 线几何 =====
// SimplePolylineGeometry - 简单折线
const simplePolylineGeometry = new Cesium.SimplePolylineGeometry({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 39.0,
        117.0, 39.5,
        118.0, 39.0
    ]),
    colors: [Cesium.Color.RED, Cesium.Color.GREEN, Cesium.Color.BLUE]
});

// PolylineGeometry - 带宽度的折线
const polylineGeometry = new Cesium.PolylineGeometry({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 38.5,
        117.0, 39.0,
        118.0, 38.5
    ]),
    width: 5.0
});

// GroundPolylineGeometry - 贴地折线
const groundPolylineGeometry = new Cesium.GroundPolylineGeometry({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 38.0,
        118.0, 38.0
    ]),
    width: 5.0
});

// ===== 面几何 =====
// PolygonGeometry - 多边形
const polygonGeometry = new Cesium.PolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray([
            116.0, 37.0,
            117.0, 37.0,
            117.0, 38.0,
            116.0, 38.0
        ])
    )
});

// RectangleGeometry - 矩形
const rectangleGeometry = new Cesium.RectangleGeometry({
    rectangle: Cesium.Rectangle.fromDegrees(118.0, 37.0, 119.0, 38.0),
    vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL
});

// EllipseGeometry - 椭圆
const ellipseGeometry = new Cesium.EllipseGeometry({
    center: Cesium.Cartesian3.fromDegrees(120.0, 37.5),
    semiMajorAxis: 50000,
    semiMinorAxis: 30000,
    rotation: Cesium.Math.toRadians(45)
});

// CircleGeometry - 圆形
const circleGeometry = new Cesium.CircleGeometry({
    center: Cesium.Cartesian3.fromDegrees(121.0, 37.5),
    radius: 40000
});

// CorridorGeometry - 走廊
const corridorGeometry = new Cesium.CorridorGeometry({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 36.0,
        117.0, 36.5,
        118.0, 36.0
    ]),
    width: 10000
});

// WallGeometry - 墙
const wallGeometry = new Cesium.WallGeometry({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 35.0,
        117.0, 35.0,
        117.0, 36.0
    ]),
    maximumHeights: [10000, 15000, 12000],
    minimumHeights: [0, 0, 0]
});

// ===== 立体几何 =====
// BoxGeometry - 盒子
const boxGeometry = Cesium.BoxGeometry.fromDimensions({
    dimensions: new Cesium.Cartesian3(10000, 10000, 20000),
    vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL
});

// CylinderGeometry - 圆柱
const cylinderGeometry = new Cesium.CylinderGeometry({
    length: 20000,
    topRadius: 5000,
    bottomRadius: 5000
});

// SphereGeometry - 球体
const sphereGeometry = new Cesium.SphereGeometry({
    radius: 10000,
    vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL
});

// EllipsoidGeometry - 椭球
const ellipsoidGeometry = new Cesium.EllipsoidGeometry({
    radii: new Cesium.Cartesian3(15000, 10000, 8000)
});

// CoplanarPolygonGeometry - 共面多边形
const coplanarPolygonGeometry = new Cesium.CoplanarPolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArrayHeights([
            116.0, 34.0, 1000,
            117.0, 34.0, 1000,
            117.0, 35.0, 1000,
            116.0, 35.0, 1000
        ])
    )
});
```

### 7.2.2 几何体配置选项

```javascript
// 多边形详细配置
const detailedPolygon = new Cesium.PolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray([/* 外环坐标 */]),
        [
            new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray([/* 内环1坐标 */])
            ),
            new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray([/* 内环2坐标 */])
            )
        ]
    ),
    height: 0,                  // 底部高度
    extrudedHeight: 10000,      // 顶部高度（拉伸）
    vertexFormat: Cesium.VertexFormat.ALL,
    stRotation: 0,              // 纹理旋转
    ellipsoid: Cesium.Ellipsoid.WGS84,
    granularity: Cesium.Math.RADIANS_PER_DEGREE,  // 细分粒度
    perPositionHeight: false,   // 每个顶点独立高度
    closeTop: true,             // 封闭顶部
    closeBottom: true,          // 封闭底部
    arcType: Cesium.ArcType.GEODESIC  // 边类型
});

// 矩形详细配置
const detailedRectangle = new Cesium.RectangleGeometry({
    rectangle: Cesium.Rectangle.fromDegrees(110, 30, 120, 40),
    height: 100,
    extrudedHeight: 5000,
    rotation: Cesium.Math.toRadians(10),
    stRotation: Cesium.Math.toRadians(45),
    vertexFormat: Cesium.VertexFormat.POSITION_NORMAL_AND_ST,
    ellipsoid: Cesium.Ellipsoid.WGS84,
    granularity: Cesium.Math.RADIANS_PER_DEGREE
});
```

### 7.2.3 GeometryInstance（几何实例）

```javascript
// 创建几何实例
const instance = new Cesium.GeometryInstance({
    geometry: new Cesium.RectangleGeometry({
        rectangle: Cesium.Rectangle.fromDegrees(116.0, 39.0, 117.0, 40.0)
    }),
    
    // 模型变换矩阵
    modelMatrix: Cesium.Matrix4.IDENTITY,
    
    // 实例标识（用于拾取）
    id: 'my-rectangle',
    
    // 实例属性
    attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
            Cesium.Color.RED.withAlpha(0.5)
        ),
        show: new Cesium.ShowGeometryInstanceAttribute(true)
    }
});

// 创建多个实例（高效渲染大量相同几何体）
const instances = [];
for (let i = 0; i < 100; i++) {
    const lon = 100 + Math.random() * 30;
    const lat = 20 + Math.random() * 20;
    
    instances.push(new Cesium.GeometryInstance({
        geometry: new Cesium.CircleGeometry({
            center: Cesium.Cartesian3.fromDegrees(lon, lat),
            radius: 10000
        }),
        id: `circle-${i}`,
        attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                Cesium.Color.fromRandom({ alpha: 0.7 })
            )
        }
    }));
}
```

## 7.3 Appearance（外观）

### 7.3.1 内置外观类型

```javascript
// ===== MaterialAppearance - 材质外观 =====
const materialAppearance = new Cesium.MaterialAppearance({
    material: Cesium.Material.fromType('Color', {
        color: Cesium.Color.RED
    }),
    flat: false,               // 是否扁平着色
    faceForward: true,         // 正面朝向相机
    translucent: true,         // 半透明
    closed: false              // 闭合体
});

// ===== PerInstanceColorAppearance - 实例颜色外观 =====
const perInstanceColorAppearance = new Cesium.PerInstanceColorAppearance({
    flat: false,
    translucent: true
});

// ===== EllipsoidSurfaceAppearance - 椭球面外观 =====
const ellipsoidSurfaceAppearance = new Cesium.EllipsoidSurfaceAppearance({
    material: Cesium.Material.fromType('Stripe', {
        horizontal: true,
        repeat: 10
    }),
    aboveGround: false
});

// ===== PolylineColorAppearance - 折线颜色外观 =====
const polylineColorAppearance = new Cesium.PolylineColorAppearance({
    translucent: false
});

// ===== PolylineMaterialAppearance - 折线材质外观 =====
const polylineMaterialAppearance = new Cesium.PolylineMaterialAppearance({
    material: Cesium.Material.fromType('PolylineGlow', {
        glowPower: 0.3,
        color: Cesium.Color.BLUE
    })
});

// ===== DebugAppearance - 调试外观 =====
const debugAppearance = new Cesium.DebugAppearance({
    attributeName: 'normal',   // 显示法线
    perInstanceAttribute: false
});
```

### 7.3.2 Material（材质）

```javascript
// ===== 内置材质类型 =====
// Color - 纯色
const colorMaterial = Cesium.Material.fromType('Color', {
    color: Cesium.Color.RED
});

// Image - 图片纹理
const imageMaterial = Cesium.Material.fromType('Image', {
    image: 'texture.png',
    repeat: new Cesium.Cartesian2(2, 2)
});

// DiffuseMap - 漫反射贴图
const diffuseMapMaterial = Cesium.Material.fromType('DiffuseMap', {
    image: 'diffuse.png',
    channels: 'rgb',
    repeat: new Cesium.Cartesian2(1, 1)
});

// Stripe - 条纹
const stripeMaterial = Cesium.Material.fromType('Stripe', {
    horizontal: true,
    evenColor: Cesium.Color.WHITE,
    oddColor: Cesium.Color.BLACK,
    offset: 0,
    repeat: 10
});

// Grid - 网格
const gridMaterial = Cesium.Material.fromType('Grid', {
    color: Cesium.Color.YELLOW,
    cellAlpha: 0.2,
    lineCount: new Cesium.Cartesian2(8, 8),
    lineThickness: new Cesium.Cartesian2(1, 1)
});

// Checkerboard - 棋盘格
const checkerboardMaterial = Cesium.Material.fromType('Checkerboard', {
    lightColor: Cesium.Color.WHITE,
    darkColor: Cesium.Color.BLACK,
    repeat: new Cesium.Cartesian2(4, 4)
});

// Dot - 点阵
const dotMaterial = Cesium.Material.fromType('Dot', {
    lightColor: Cesium.Color.WHITE,
    darkColor: Cesium.Color.BLACK,
    repeat: new Cesium.Cartesian2(5, 5)
});

// Water - 水面
const waterMaterial = Cesium.Material.fromType('Water', {
    baseWaterColor: Cesium.Color.BLUE.withAlpha(0.5),
    blendColor: Cesium.Color.BLUE.withAlpha(0.5),
    specularMap: undefined,
    normalMap: Cesium.buildModuleUrl('Assets/Textures/waterNormals.jpg'),
    frequency: 10000.0,
    animationSpeed: 0.01,
    amplitude: 1.0,
    specularIntensity: 0.5
});

// RimLighting - 边缘光照
const rimLightingMaterial = Cesium.Material.fromType('RimLighting', {
    color: Cesium.Color.GOLD,
    rimColor: Cesium.Color.WHITE,
    width: 0.3
});

// Fade - 渐变
const fadeMaterial = Cesium.Material.fromType('Fade', {
    fadeInColor: Cesium.Color.RED,
    fadeOutColor: Cesium.Color.TRANSPARENT,
    maximumDistance: 0.5,
    repeat: true,
    fadeDirection: {
        x: true,
        y: false
    },
    time: new Cesium.Cartesian2(0, 0)
});

// ===== 折线专用材质 =====
// PolylineOutline - 折线轮廓
const polylineOutlineMaterial = Cesium.Material.fromType('PolylineOutline', {
    color: Cesium.Color.RED,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2
});

// PolylineGlow - 折线发光
const polylineGlowMaterial = Cesium.Material.fromType('PolylineGlow', {
    color: Cesium.Color.CYAN,
    glowPower: 0.25,
    taperPower: 1.0
});

// PolylineArrow - 折线箭头
const polylineArrowMaterial = Cesium.Material.fromType('PolylineArrow', {
    color: Cesium.Color.YELLOW
});

// PolylineDash - 折线虚线
const polylineDashMaterial = Cesium.Material.fromType('PolylineDash', {
    color: Cesium.Color.WHITE,
    gapColor: Cesium.Color.TRANSPARENT,
    dashLength: 16,
    dashPattern: 255
});
```

### 7.3.3 自定义着色器

```javascript
// 自定义外观（顶点着色器 + 片段着色器）
const customAppearance = new Cesium.MaterialAppearance({
    material: new Cesium.Material({
        fabric: {
            type: 'CustomMaterial',
            uniforms: {
                color: new Cesium.Color(1.0, 0.0, 0.0, 1.0),
                time: 0
            },
            source: `
                czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    
                    // 基于时间的动画效果
                    float t = fract(time * 0.1);
                    vec2 st = materialInput.st;
                    
                    // 波浪效果
                    float wave = sin(st.s * 10.0 + time) * 0.5 + 0.5;
                    
                    material.diffuse = color.rgb * wave;
                    material.alpha = color.a;
                    
                    return material;
                }
            `
        }
    })
});

// 更新 uniform（动画）
viewer.scene.preRender.addEventListener(function(scene, time) {
    customAppearance.material.uniforms.time = Cesium.JulianDate.secondsDifference(
        time, 
        Cesium.JulianDate.fromIso8601('2024-01-01')
    );
});
```

## 7.4 Primitive 使用

### 7.4.1 创建 Primitive

```javascript
// 基本 Primitive
const primitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.RectangleGeometry({
            rectangle: Cesium.Rectangle.fromDegrees(116, 39, 117, 40)
        }),
        attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                Cesium.Color.RED.withAlpha(0.5)
            )
        }
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
        translucent: true
    })
});

// 添加到场景
viewer.scene.primitives.add(primitive);

// 多实例 Primitive
const multiInstancePrimitive = new Cesium.Primitive({
    geometryInstances: [
        new Cesium.GeometryInstance({
            geometry: new Cesium.CircleGeometry({
                center: Cesium.Cartesian3.fromDegrees(116, 38),
                radius: 30000
            }),
            id: 'circle1',
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED)
            }
        }),
        new Cesium.GeometryInstance({
            geometry: new Cesium.CircleGeometry({
                center: Cesium.Cartesian3.fromDegrees(117, 38),
                radius: 30000
            }),
            id: 'circle2',
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.BLUE)
            }
        })
    ],
    appearance: new Cesium.PerInstanceColorAppearance()
});

viewer.scene.primitives.add(multiInstancePrimitive);
```

### 7.4.2 Primitive 配置选项

```javascript
const configuredPrimitive = new Cesium.Primitive({
    geometryInstances: instances,
    appearance: appearance,
    
    // 渲染选项
    show: true,                              // 是否显示
    modelMatrix: Cesium.Matrix4.IDENTITY,    // 模型矩阵
    
    // 性能选项
    asynchronous: true,                      // 异步创建几何体
    compressVertices: true,                  // 压缩顶点
    allowPicking: true,                      // 允许拾取
    releaseGeometryInstances: true,          // 释放几何实例内存
    
    // 遮挡选项
    cull: true,                              // 视锥体裁剪
    
    // 深度测试
    depthFailAppearance: undefined,          // 深度测试失败时的外观
    
    // 阴影
    shadows: Cesium.ShadowMode.DISABLED,     // 阴影模式
    
    // 分类（贴地）
    classificationType: undefined            // 分类类型
});
```

### 7.4.3 GroundPrimitive（贴地图元）

```javascript
// 贴地多边形
const groundPrimitive = new Cesium.GroundPrimitive({
    geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray([
                    116.0, 39.0,
                    117.0, 39.0,
                    117.0, 40.0,
                    116.0, 40.0
                ])
            )
        }),
        id: 'ground-polygon',
        attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                Cesium.Color.GREEN.withAlpha(0.5)
            )
        }
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
        translucent: true
    }),
    classificationType: Cesium.ClassificationType.TERRAIN  // 仅贴地形
    // Cesium.ClassificationType.CESIUM_3D_TILE  // 仅贴 3D Tiles
    // Cesium.ClassificationType.BOTH            // 都贴
});

viewer.scene.groundPrimitives.add(groundPrimitive);

// 贴地折线
const groundPolylinePrimitive = new Cesium.GroundPolylinePrimitive({
    geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.GroundPolylineGeometry({
            positions: Cesium.Cartesian3.fromDegreesArray([
                116.0, 38.0,
                117.0, 38.5,
                118.0, 38.0
            ]),
            width: 5.0
        }),
        id: 'ground-polyline',
        attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED)
        }
    }),
    appearance: new Cesium.PolylineColorAppearance()
});

viewer.scene.groundPrimitives.add(groundPolylinePrimitive);
```

## 7.5 特殊图元集合

### 7.5.1 PointPrimitiveCollection（点集合）

```javascript
// 创建点集合
const pointCollection = viewer.scene.primitives.add(
    new Cesium.PointPrimitiveCollection()
);

// 添加点
const point = pointCollection.add({
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
    pixelSize: 10,
    color: Cesium.Color.RED,
    outlineColor: Cesium.Color.WHITE,
    outlineWidth: 2
});

// 批量添加点
for (let i = 0; i < 10000; i++) {
    pointCollection.add({
        position: Cesium.Cartesian3.fromDegrees(
            100 + Math.random() * 30,
            20 + Math.random() * 20,
            0
        ),
        pixelSize: 5 + Math.random() * 5,
        color: Cesium.Color.fromRandom({ alpha: 0.8 })
    });
}

// 修改点属性
point.color = Cesium.Color.BLUE;
point.pixelSize = 15;

// 移除点
pointCollection.remove(point);

// 获取点
const pointAt = pointCollection.get(0);

// 清空所有点
pointCollection.removeAll();
```

### 7.5.2 BillboardCollection（广告牌集合）

```javascript
// 创建广告牌集合
const billboardCollection = viewer.scene.primitives.add(
    new Cesium.BillboardCollection()
);

// 添加广告牌
const billboard = billboardCollection.add({
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
    image: 'marker.png',
    width: 32,
    height: 32,
    scale: 1.0,
    color: Cesium.Color.WHITE,
    rotation: 0,
    alignedAxis: Cesium.Cartesian3.ZERO,
    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, 0),
    eyeOffset: new Cesium.Cartesian3(0, 0, 0),
    scaleByDistance: new Cesium.NearFarScalar(1000, 2, 100000, 0.5),
    translucencyByDistance: new Cesium.NearFarScalar(1000, 1, 100000, 0.3),
    pixelOffsetScaleByDistance: undefined,
    imageSubRegion: undefined,
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    sizeInMeters: false
});

// 使用 Canvas 创建自定义图标
function createMarkerImage(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    
    return canvas;
}

// 批量添加自定义广告牌
const markers = ['A', 'B', 'C', 'D', 'E'];
const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

markers.forEach((marker, index) => {
    billboardCollection.add({
        position: Cesium.Cartesian3.fromDegrees(116 + index * 0.5, 39.5, 0),
        image: createMarkerImage(marker, colors[index]),
        width: 48,
        height: 48,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    });
});
```

### 7.5.3 LabelCollection（标签集合）

```javascript
// 创建标签集合
const labelCollection = viewer.scene.primitives.add(
    new Cesium.LabelCollection()
);

// 添加标签
const label = labelCollection.add({
    position: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 100),
    text: '北京',
    font: '20px sans-serif',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    showBackground: true,
    backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.8),
    backgroundPadding: new Cesium.Cartesian2(8, 4),
    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, -10),
    scaleByDistance: new Cesium.NearFarScalar(1000, 1.5, 100000, 0.5),
    translucencyByDistance: new Cesium.NearFarScalar(1000, 1, 100000, 0.3),
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000),
    disableDepthTestDistance: Number.POSITIVE_INFINITY
});

// 动态更新标签
label.text = '北京市';
label.fillColor = Cesium.Color.YELLOW;
```

### 7.5.4 PolylineCollection（折线集合）

```javascript
// 创建折线集合
const polylineCollection = viewer.scene.primitives.add(
    new Cesium.PolylineCollection()
);

// 添加折线
const polyline = polylineCollection.add({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 39.0,
        117.0, 39.5,
        118.0, 39.0
    ]),
    width: 3,
    material: Cesium.Material.fromType('Color', {
        color: Cesium.Color.RED
    })
});

// 使用虚线材质
polylineCollection.add({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 38.5,
        118.0, 38.5
    ]),
    width: 3,
    material: Cesium.Material.fromType('PolylineDash', {
        color: Cesium.Color.YELLOW,
        dashLength: 16
    })
});

// 使用箭头材质
polylineCollection.add({
    positions: Cesium.Cartesian3.fromDegreesArray([
        116.0, 38.0,
        118.0, 38.0
    ]),
    width: 10,
    material: Cesium.Material.fromType('PolylineArrow', {
        color: Cesium.Color.BLUE
    })
});
```

## 7.6 PrimitiveCollection 管理

### 7.6.1 集合操作

```javascript
const primitives = viewer.scene.primitives;

// ===== 添加图元 =====
const primitive = primitives.add(new Cesium.Primitive({ /* ... */ }));
const index = primitives.add(primitive, 0);  // 插入到指定位置

// ===== 获取图元 =====
const count = primitives.length;
const p = primitives.get(0);
const contains = primitives.contains(primitive);

// ===== 移除图元 =====
primitives.remove(primitive);
const removed = primitives.removeAll();

// ===== 调整顺序 =====
primitives.raise(primitive);        // 上移一层
primitives.lower(primitive);        // 下移一层
primitives.raiseToTop(primitive);   // 移到最顶层
primitives.lowerToBottom(primitive); // 移到最底层

// ===== 属性 =====
primitives.show = true;             // 显示/隐藏所有
primitives.destroyPrimitives = true; // 移除时是否销毁
```

### 7.6.2 批量管理

```javascript
// 图元管理器
class PrimitiveManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.primitives = new Map();
    }
    
    add(id, primitive) {
        if (this.primitives.has(id)) {
            this.remove(id);
        }
        this.viewer.scene.primitives.add(primitive);
        this.primitives.set(id, primitive);
        return primitive;
    }
    
    get(id) {
        return this.primitives.get(id);
    }
    
    remove(id) {
        const primitive = this.primitives.get(id);
        if (primitive) {
            this.viewer.scene.primitives.remove(primitive);
            this.primitives.delete(id);
            return true;
        }
        return false;
    }
    
    show(id, visible) {
        const primitive = this.primitives.get(id);
        if (primitive) {
            primitive.show = visible;
        }
    }
    
    clear() {
        this.primitives.forEach((primitive, id) => {
            this.viewer.scene.primitives.remove(primitive);
        });
        this.primitives.clear();
    }
    
    getIds() {
        return Array.from(this.primitives.keys());
    }
}

// 使用
const manager = new PrimitiveManager(viewer);

manager.add('polygon1', new Cesium.Primitive({ /* ... */ }));
manager.add('polygon2', new Cesium.Primitive({ /* ... */ }));

manager.show('polygon1', false);
manager.remove('polygon2');
manager.clear();
```

## 7.7 本章小结

本章详细介绍了 Primitive 底层渲染 API：

1. **Primitive 概念**：与 Entity 的对比、架构设计
2. **Geometry**：各种几何类型、配置选项
3. **Appearance**：外观类型、材质系统
4. **Primitive 使用**：创建、配置、贴地图元
5. **特殊图元集合**：Point、Billboard、Label、Polyline
6. **集合管理**：添加、移除、排序操作

在下一章中，我们将详细介绍影像图层与地图服务。

## 7.8 思考与练习

1. 创建一个大规模点数据（10万+）的可视化场景。
2. 实现自定义着色器材质效果。
3. 对比 Entity 和 Primitive 渲染相同数据的性能差异。
4. 开发一个图元管理器，支持分组和批量操作。
5. 实现贴地多边形的动态编辑功能。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第06章-Entity-API实体管理" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第08章-影像图层与地图服务" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
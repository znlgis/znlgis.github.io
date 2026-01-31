---
layout: post
title: 第10章 - 3D Tiles大规模数据
date: 2024-03-10 10:00:00 +0800
categories: [GIS, CesiumJS]
tags: [CesiumJS, 3D-Tiles, 倾斜摄影]
---

# 第10章：3D Tiles大规模数据

## 10.1 3D Tiles 概述

### 10.1.1 什么是 3D Tiles

3D Tiles 是 OGC 社区标准，专为 Web 端大规模三维地理数据的流式传输和渲染而设计。它是 CesiumJS 处理海量三维数据的核心技术。

```
┌─────────────────────────────────────────────────────────────────┐
│                      3D Tiles 架构                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  tileset.json (根节点)                                          │
│  ├── asset        - 资产信息（版本等）                          │
│  ├── geometricError - 几何误差（LOD控制）                       │
│  └── root         - 根瓦片                                      │
│      ├── boundingVolume - 包围体                                │
│      ├── content   - 瓦片内容（.b3dm/.i3dm/.pnts等）            │
│      └── children  - 子瓦片                                     │
│                                                                  │
│  内容类型：                                                      │
│  ├── .b3dm  - Batched 3D Model（批量三维模型）                  │
│  ├── .i3dm  - Instanced 3D Model（实例化模型）                  │
│  ├── .pnts  - Point Cloud（点云）                               │
│  ├── .cmpt  - Composite（复合瓦片）                             │
│  └── .glb   - glTF 模型（3D Tiles 1.1）                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.1.2 3D Tiles 特点

| 特点 | 描述 |
|-----|------|
| LOD | 层次细节，根据距离动态加载不同精度 |
| 流式加载 | 按需加载，无需一次性加载全部数据 |
| 空间索引 | 基于包围体的高效空间查询 |
| 属性数据 | 支持 Batch Table 存储属性 |
| 样式化 | 支持条件样式渲染 |

## 10.2 加载 3D Tiles

### 10.2.1 基本加载

```javascript
// 从 URL 加载
const tileset = await Cesium.Cesium3DTileset.fromUrl(
    'https://your-server/tileset/tileset.json'
);
viewer.scene.primitives.add(tileset);

// 定位到 tileset
viewer.zoomTo(tileset);

// 从 Cesium ion 加载
const ionTileset = await Cesium.Cesium3DTileset.fromIonAssetId(75343);
viewer.scene.primitives.add(ionTileset);
viewer.zoomTo(ionTileset);
```

### 10.2.2 完整配置

```javascript
const tileset = await Cesium.Cesium3DTileset.fromUrl(
    'https://your-server/tileset/tileset.json',
    {
        // ===== 显示设置 =====
        show: true,
        
        // ===== LOD 设置 =====
        maximumScreenSpaceError: 16,     // 最大屏幕空间误差（越小越精细）
        maximumMemoryUsage: 512,         // 最大内存使用（MB）
        
        // ===== 加载策略 =====
        skipLevelOfDetail: true,         // 跳过 LOD 级别
        baseScreenSpaceError: 1024,      // 基础屏幕空间误差
        skipScreenSpaceErrorFactor: 16,  // 跳过因子
        skipLevels: 1,                   // 跳过级别数
        immediatelyLoadDesiredLevelOfDetail: false,  // 立即加载目标 LOD
        loadSiblings: false,             // 加载兄弟瓦片
        
        // ===== 剔除设置 =====
        cullWithChildrenBounds: true,    // 使用子包围体剔除
        cullRequestsWhileMoving: true,   // 移动时剔除请求
        cullRequestsWhileMovingMultiplier: 60.0,
        
        // ===== 预加载 =====
        preloadWhenHidden: false,        // 隐藏时预加载
        preloadFlightDestinations: true, // 预加载飞行目的地
        preferLeaves: false,             // 优先加载叶子节点
        
        // ===== 动态调整 =====
        dynamicScreenSpaceError: false,  // 动态屏幕空间误差
        dynamicScreenSpaceErrorDensity: 0.00278,
        dynamicScreenSpaceErrorFactor: 4.0,
        dynamicScreenSpaceErrorHeightFalloff: 0.25,
        
        // ===== 模型矩阵 =====
        modelMatrix: Cesium.Matrix4.IDENTITY,
        
        // ===== 阴影 =====
        shadows: Cesium.ShadowMode.ENABLED,
        
        // ===== 拾取 =====
        enablePick: true,
        
        // ===== 调试 =====
        debugShowBoundingVolume: false,
        debugShowContentBoundingVolume: false,
        debugShowViewerRequestVolume: false,
        debugShowGeometricError: false,
        debugShowRenderingStatistics: false,
        debugShowMemoryUsage: false
    }
);

viewer.scene.primitives.add(tileset);
```

### 10.2.3 位置调整

```javascript
// 调整 tileset 位置
const tileset = await Cesium.Cesium3DTileset.fromUrl(url);

// 等待加载完成
tileset.readyPromise.then(function(tileset) {
    // 获取当前位置
    const boundingSphere = tileset.boundingSphere;
    const cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center);
    
    // 设置新位置
    const newLongitude = Cesium.Math.toRadians(116.4);
    const newLatitude = Cesium.Math.toRadians(39.9);
    const newHeight = 0;
    
    // 计算偏移
    const surface = Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        0
    );
    const offset = Cesium.Cartesian3.fromRadians(
        newLongitude,
        newLatitude,
        newHeight
    );
    const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
    
    tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
});

// 使用辅助函数
function moveTileset(tileset, longitude, latitude, height = 0) {
    const cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center);
    const surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0);
    const offset = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
    const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
    tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
}
```

## 10.3 3D Tiles 样式

### 10.3.1 基本样式

```javascript
// 单色样式
tileset.style = new Cesium.Cesium3DTileStyle({
    color: 'color("red")'
});

// 透明度
tileset.style = new Cesium.Cesium3DTileStyle({
    color: 'color("blue", 0.5)'
});

// 显示/隐藏
tileset.style = new Cesium.Cesium3DTileStyle({
    show: true,
    color: 'color("white")'
});
```

### 10.3.2 条件样式

```javascript
// 基于属性的条件样式
tileset.style = new Cesium.Cesium3DTileStyle({
    color: {
        conditions: [
            ['${height} >= 100', 'color("red")'],
            ['${height} >= 50', 'color("orange")'],
            ['${height} >= 20', 'color("yellow")'],
            ['true', 'color("white")']
        ]
    }
});

// 多条件组合
tileset.style = new Cesium.Cesium3DTileStyle({
    color: {
        conditions: [
            ['${type} === "residential" && ${height} > 50', 'color("blue")'],
            ['${type} === "commercial"', 'color("red")'],
            ['${type} === "industrial"', 'color("gray")'],
            ['true', 'color("white")']
        ]
    },
    show: '${height} > 0'
});

// 渐变色
tileset.style = new Cesium.Cesium3DTileStyle({
    color: 'color("red") * vec4(1.0, ${height}/100.0, 0.0, 1.0)'
});

// HSL 颜色
tileset.style = new Cesium.Cesium3DTileStyle({
    color: 'hsl(${height}/200.0, 1.0, 0.5)'
});

// RGB 混合
tileset.style = new Cesium.Cesium3DTileStyle({
    color: 'rgb(${height}*2, 100, 200)'
});
```

### 10.3.3 点云样式

```javascript
// 点云基本样式
tileset.style = new Cesium.Cesium3DTileStyle({
    pointSize: 5,
    color: 'color("cyan")'
});

// 基于属性的点大小
tileset.style = new Cesium.Cesium3DTileStyle({
    pointSize: '${intensity} / 10',
    color: {
        conditions: [
            ['${classification} === 2', 'color("brown")'],  // 地面
            ['${classification} === 6', 'color("green")'],  // 建筑
            ['${classification} === 9', 'color("blue")'],   // 水体
            ['true', 'color("white")']
        ]
    }
});

// 基于高程的渐变
tileset.style = new Cesium.Cesium3DTileStyle({
    pointSize: 3,
    color: 'hsv(${POSITION}[2] / 100.0, 1.0, 1.0)'
});
```

## 10.4 3D Tiles 交互

### 10.4.1 拾取与属性查询

```javascript
// 点击拾取
const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

handler.setInputAction(function(click) {
    const pickedObject = viewer.scene.pick(click.position);
    
    if (Cesium.defined(pickedObject) && pickedObject.primitive instanceof Cesium.Cesium3DTileset) {
        console.log('选中 3D Tiles');
        
        // 获取要素属性
        if (Cesium.defined(pickedObject.getProperty)) {
            const height = pickedObject.getProperty('height');
            const name = pickedObject.getProperty('name');
            console.log('高度:', height);
            console.log('名称:', name);
        }
        
        // 获取所有属性名
        if (Cesium.defined(pickedObject.getPropertyIds)) {
            const propertyIds = pickedObject.getPropertyIds();
            console.log('属性列表:', propertyIds);
            
            propertyIds.forEach(id => {
                console.log(`${id}:`, pickedObject.getProperty(id));
            });
        }
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
```

### 10.4.2 高亮选中

```javascript
// 高亮选中的要素
let highlighted = {
    feature: undefined,
    originalColor: new Cesium.Color()
};

handler.setInputAction(function(movement) {
    // 重置之前的高亮
    if (Cesium.defined(highlighted.feature)) {
        highlighted.feature.color = highlighted.originalColor;
        highlighted.feature = undefined;
    }
    
    // 拾取新要素
    const pickedObject = viewer.scene.pick(movement.endPosition);
    
    if (Cesium.defined(pickedObject) && pickedObject.primitive instanceof Cesium.Cesium3DTileset) {
        highlighted.feature = pickedObject;
        Cesium.Color.clone(pickedObject.color, highlighted.originalColor);
        pickedObject.color = Cesium.Color.YELLOW;
    }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
```

## 10.5 性能优化

### 10.5.1 LOD 优化

```javascript
// 根据设备性能调整
function optimizeForDevice(tileset) {
    // 检测设备性能
    const isLowEnd = !viewer.scene.context.webgl2;
    
    if (isLowEnd) {
        tileset.maximumScreenSpaceError = 32;     // 降低精度
        tileset.maximumMemoryUsage = 256;         // 降低内存
        tileset.skipLevelOfDetail = true;
        tileset.skipLevels = 2;
    } else {
        tileset.maximumScreenSpaceError = 8;
        tileset.maximumMemoryUsage = 1024;
        tileset.skipLevelOfDetail = false;
    }
}

// 动态调整（根据帧率）
let lastFrameTime = performance.now();
viewer.scene.postRender.addEventListener(function() {
    const currentTime = performance.now();
    const frameTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    
    const fps = 1000 / frameTime;
    
    if (fps < 30) {
        tileset.maximumScreenSpaceError = Math.min(tileset.maximumScreenSpaceError * 1.1, 64);
    } else if (fps > 55) {
        tileset.maximumScreenSpaceError = Math.max(tileset.maximumScreenSpaceError * 0.95, 4);
    }
});
```

### 10.5.2 内存管理

```javascript
// 监控内存使用
tileset.tileLoad.addEventListener(function(tile) {
    console.log('瓦片加载:', tile.content.url);
});

tileset.tileUnload.addEventListener(function(tile) {
    console.log('瓦片卸载:', tile.content.url);
});

tileset.tileFailed.addEventListener(function(error) {
    console.error('瓦片加载失败:', error);
});

// 获取统计信息
viewer.scene.postRender.addEventListener(function() {
    const stats = tileset._statistics;
    console.log('加载瓦片数:', stats.numberOfLoadedTiles);
    console.log('内存使用(MB):', stats.texturesByteLength / 1024 / 1024);
});
```

## 10.6 3D Tiles 调试

```javascript
// 启用调试显示
tileset.debugShowBoundingVolume = true;
tileset.debugShowContentBoundingVolume = true;
tileset.debugShowViewerRequestVolume = true;
tileset.debugShowGeometricError = true;
tileset.debugShowRenderingStatistics = true;
tileset.debugShowMemoryUsage = true;
tileset.debugShowUrl = true;

// 使用 Inspector
viewer.extend(Cesium.viewerCesium3DTilesInspectorMixin);

// 显示帧率
viewer.scene.debugShowFramesPerSecond = true;
```

## 10.7 本章小结

本章详细介绍了 3D Tiles：

1. **概念**：OGC 标准、架构设计、内容类型
2. **加载**：URL 加载、Ion 加载、位置调整
3. **样式**：单色、条件样式、点云样式
4. **交互**：拾取、属性查询、高亮
5. **性能**：LOD 优化、内存管理
6. **调试**：调试选项、Inspector

在下一章中，我们将详细介绍数据格式与数据源。

## 10.8 思考与练习

1. 加载并展示城市建筑 3D Tiles 数据。
2. 实现基于建筑高度的渐变色样式。
3. 开发点击建筑显示属性信息的功能。
4. 优化大规模 3D Tiles 的加载性能。
5. 实现 3D Tiles 的动态过滤（显示/隐藏特定类型）。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第09章-地形数据处理" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第11章-数据格式与数据源" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

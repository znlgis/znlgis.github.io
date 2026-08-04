---
layout: default
title: 第04章 - Viewer与场景管理
---

# 第04章：Viewer与场景管理

## 4.1 Viewer 深入解析

### 4.1.1 Viewer 创建与配置

Viewer 是 CesiumJS 应用的核心入口，提供了丰富的配置选项：

```javascript
// 完整的 Viewer 配置示例
const viewer = new Cesium.Viewer('cesiumContainer', {
    // ===== 核心配置 =====
    scene3DOnly: false,                    // 仅 3D 模式
    sceneMode: Cesium.SceneMode.SCENE3D,   // 初始场景模式
    mapProjection: new Cesium.GeographicProjection(), // 地图投影
    
    // ===== 地形配置 =====
    terrainProvider: Cesium.createWorldTerrain({
        requestWaterMask: true,            // 水体遮罩
        requestVertexNormals: true         // 顶点法线（光照）
    }),
    
    // ===== 影像配置 =====
    imageryProvider: false,                // 禁用默认影像
    baseLayerPicker: true,                 // 底图选择器
    
    // ===== 时间配置 =====
    shouldAnimate: false,                  // 自动播放
    animation: true,                       // 动画控件
    timeline: true,                        // 时间轴
    
    // ===== UI 控件 =====
    fullscreenButton: true,                // 全屏按钮
    vrButton: false,                       // VR 按钮
    geocoder: true,                        // 地理编码搜索
    homeButton: true,                      // 主页按钮
    infoBox: true,                         // 信息框
    sceneModePicker: true,                 // 场景模式选择器
    selectionIndicator: true,              // 选择指示器
    navigationHelpButton: true,            // 导航帮助
    navigationInstructionsInitiallyVisible: false,
    
    // ===== 渲染配置 =====
    shadows: false,                        // 阴影
    terrainShadows: Cesium.ShadowMode.DISABLED,
    requestRenderMode: false,              // 按需渲染
    maximumRenderTimeChange: Infinity,     // 最大渲染时间变化
    
    // ===== 目标帧率 =====
    targetFrameRate: undefined,            // 目标帧率
    useBrowserRecommendedResolution: true, // 使用浏览器推荐分辨率
    
    // ===== WebGL 上下文 =====
    contextOptions: {
        webgl: {
            alpha: false,                  // 透明背景
            depth: true,                   // 深度缓冲
            stencil: false,                // 模板缓冲
            antialias: true,               // 抗锯齿
            premultipliedAlpha: true,      // 预乘 Alpha
            preserveDrawingBuffer: false,  // 保留绘图缓冲
            powerPreference: 'high-performance', // 性能优先
            failIfMajorPerformanceCaveat: false
        }
    },
    
    // ===== 其他 =====
    orderIndependentTranslucency: true,    // 顺序无关透明
    creditContainer: undefined,            // 版权容器
    creditViewport: undefined,             // 版权视口
    dataSources: new Cesium.DataSourceCollection() // 数据源集合
});
```

### 4.1.2 Viewer 主要属性

```javascript
// ===== 核心组件 =====
const scene = viewer.scene;                 // 场景对象
const camera = viewer.camera;               // 相机对象
const canvas = viewer.canvas;               // WebGL 画布
const clock = viewer.clock;                 // 时钟对象
const cesiumWidget = viewer.cesiumWidget;   // 底层 Widget

// ===== 数据管理 =====
const entities = viewer.entities;           // 实体集合
const dataSources = viewer.dataSources;     // 数据源集合
const imageryLayers = viewer.imageryLayers; // 影像图层集合
const terrainProvider = viewer.terrainProvider; // 地形提供者

// ===== UI 组件 =====
const animation = viewer.animation;         // 动画控件
const timeline = viewer.timeline;           // 时间轴
const homeButton = viewer.homeButton;       // 主页按钮
const geocoder = viewer.geocoder;           // 地理编码器
const sceneModePicker = viewer.sceneModePicker; // 场景模式选择器
const infoBox = viewer.infoBox;             // 信息框
const selectionIndicator = viewer.selectionIndicator; // 选择指示器

// ===== 选中对象 =====
const selectedEntity = viewer.selectedEntity; // 当前选中的实体
const trackedEntity = viewer.trackedEntity;   // 当前跟踪的实体
```

### 4.1.3 Viewer 主要方法

```javascript
// ===== 飞行定位 =====
// 飞到实体
viewer.flyTo(entity, {
    duration: 3,                            // 飞行时间
    offset: new Cesium.HeadingPitchRange(0, -0.5, 5000) // 偏移
});

// 缩放到实体
viewer.zoomTo(entity);

// 飞到数据源
viewer.flyTo(dataSource);

// 飞到 3D Tileset
viewer.flyTo(tileset);

// ===== 跟踪实体 =====
viewer.trackedEntity = entity;              // 开始跟踪
viewer.trackedEntity = undefined;           // 停止跟踪

// ===== 强制渲染 =====
viewer.render();                            // 手动渲染一帧

// ===== 调整大小 =====
viewer.resize();                            // 重新调整大小

// ===== 销毁 =====
viewer.destroy();                           // 销毁 Viewer
viewer.isDestroyed();                       // 检查是否已销毁

// ===== 扩展 =====
viewer.extend(myExtension);                 // 应用扩展
```

## 4.2 Scene 场景管理

### 4.2.1 Scene 配置

```javascript
const scene = viewer.scene;

// ===== 渲染模式 =====
scene.mode = Cesium.SceneMode.SCENE3D;      // 3D 模式
// Cesium.SceneMode.SCENE2D                  // 2D 模式
// Cesium.SceneMode.COLUMBUS_VIEW            // 哥伦布视图
// Cesium.SceneMode.MORPHING                 // 变形中

// 场景模式切换
scene.morphTo2D(2.0);                        // 切换到 2D，2秒过渡
scene.morphTo3D(2.0);                        // 切换到 3D
scene.morphToColumbusView(2.0);              // 切换到哥伦布视图

// ===== 渲染质量 =====
scene.fxaa = true;                           // FXAA 抗锯齿
scene.msaaSamples = 4;                       // MSAA 多重采样
scene.postProcessStages.fxaa.enabled = true; // 后处理 FXAA

// ===== 光照 =====
scene.light = new Cesium.DirectionalLight({
    direction: new Cesium.Cartesian3(1, 0, 0)
});
scene.globe.enableLighting = true;           // 地球光照
scene.globe.dynamicAtmosphereLighting = true; // 动态大气光照

// ===== 背景 =====
scene.backgroundColor = Cesium.Color.BLACK;  // 背景色
scene.skyBox.show = true;                    // 天空盒
scene.sun.show = true;                       // 太阳
scene.moon.show = true;                      // 月亮
scene.skyAtmosphere.show = true;             // 大气层
```

### 4.2.2 Globe 地球配置

```javascript
const globe = viewer.scene.globe;

// ===== 基本设置 =====
globe.show = true;                           // 显示地球
globe.baseColor = Cesium.Color.BLUE;         // 基础颜色
globe.showGroundAtmosphere = true;           // 地面大气
globe.showWaterEffect = true;                // 水体效果

// ===== 光照设置 =====
globe.enableLighting = true;                 // 启用光照
globe.dynamicAtmosphereLighting = true;      // 动态大气光照
globe.dynamicAtmosphereLightingFromSun = false; // 来自太阳的光照

// ===== 地形设置 =====
globe.depthTestAgainstTerrain = true;        // 地形深度测试
globe.terrainExaggeration = 1.0;             // 地形夸张系数
globe.terrainExaggerationRelativeHeight = 0; // 地形夸张相对高度

// ===== 瓦片设置 =====
globe.tileCacheSize = 100;                   // 瓦片缓存大小
globe.maximumScreenSpaceError = 2;           // 最大屏幕空间误差
globe.preloadSiblings = false;               // 预加载相邻瓦片
globe.preloadAncestors = true;               // 预加载祖先瓦片

// ===== 渲染设置 =====
globe.translucency.enabled = false;          // 半透明
globe.translucency.frontFaceAlpha = 1.0;     // 正面透明度
globe.translucency.backFaceAlpha = 1.0;      // 背面透明度
globe.undergroundColor = Cesium.Color.BLACK; // 地下颜色
globe.undergroundColorAlphaByDistance = undefined; // 地下颜色透明度
```

### 4.2.3 大气与环境效果

```javascript
// ===== 天空大气 =====
const skyAtmosphere = viewer.scene.skyAtmosphere;
skyAtmosphere.show = true;
skyAtmosphere.hueShift = 0.0;                // 色调偏移
skyAtmosphere.saturationShift = 0.0;         // 饱和度偏移
skyAtmosphere.brightnessShift = 0.0;         // 亮度偏移

// ===== 雾效 =====
const fog = viewer.scene.fog;
fog.enabled = true;
fog.density = 0.0002;                        // 雾密度
fog.screenSpaceErrorFactor = 2.0;            // 屏幕空间误差因子
fog.minimumBrightness = 0.03;                // 最小亮度

// ===== 天空盒 =====
const skyBox = viewer.scene.skyBox;
skyBox.show = true;
// 自定义天空盒
scene.skyBox = new Cesium.SkyBox({
    sources: {
        positiveX: 'skybox_px.jpg',
        negativeX: 'skybox_nx.jpg',
        positiveY: 'skybox_py.jpg',
        negativeY: 'skybox_ny.jpg',
        positiveZ: 'skybox_pz.jpg',
        negativeZ: 'skybox_nz.jpg'
    }
});

// ===== 太阳 =====
const sun = viewer.scene.sun;
sun.show = true;
sun.glowFactor = 1.0;                        // 光晕因子

// ===== 月亮 =====
const moon = viewer.scene.moon;
moon.show = true;
moon.textureUrl = 'moon.jpg';                // 月球纹理
```

### 4.2.4 阴影配置

```javascript
// 启用阴影
viewer.shadows = true;
viewer.terrainShadows = Cesium.ShadowMode.ENABLED;

// 阴影贴图配置
const shadowMap = viewer.scene.shadowMap;
shadowMap.enabled = true;
shadowMap.size = 2048;                       // 阴影贴图大小
shadowMap.softShadows = true;                // 软阴影
shadowMap.darkness = 0.3;                    // 阴影暗度
shadowMap.maximumDistance = 10000;           // 最大阴影距离

// 阴影模式
// Cesium.ShadowMode.DISABLED    // 禁用
// Cesium.ShadowMode.ENABLED     // 启用（投射和接收）
// Cesium.ShadowMode.CAST_ONLY   // 仅投射
// Cesium.ShadowMode.RECEIVE_ONLY // 仅接收
```

## 4.3 地形管理

### 4.3.1 地形提供者类型

```javascript
// ===== Cesium World Terrain（推荐）=====
viewer.terrainProvider = Cesium.createWorldTerrain({
    requestWaterMask: true,                  // 水体遮罩
    requestVertexNormals: true               // 顶点法线
});

// ===== Cesium ion 地形 =====
viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
    requestWaterMask: true,
    requestVertexNormals: true
});

// ===== 自定义地形服务 =====
viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
    'https://your-terrain-server.com/terrain/',
    {
        requestWaterMask: true,
        requestVertexNormals: true
    }
);

// ===== 椭球体地形（无高程）=====
viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

// ===== ArcGIS 地形 =====
viewer.terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
    'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
);

// ===== Google 地形 =====
viewer.terrainProvider = await Cesium.createGooglePhotorealistic3DTileset();
```

### 4.3.2 地形采样

```javascript
// 单点高程采样
const positions = [Cesium.Cartographic.fromDegrees(116.4, 39.9)];
const promise = Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions);
promise.then(function(updatedPositions) {
    console.log('高程:', updatedPositions[0].height);
});

// 多点高程采样
const multiPositions = [
    Cesium.Cartographic.fromDegrees(116.0, 39.0),
    Cesium.Cartographic.fromDegrees(117.0, 40.0),
    Cesium.Cartographic.fromDegrees(118.0, 39.5)
];

Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, multiPositions)
    .then(function(samples) {
        samples.forEach(function(position, index) {
            console.log(`点 ${index}: 高程 ${position.height} 米`);
        });
    });

// 指定级别采样
Cesium.sampleTerrain(viewer.terrainProvider, 11, positions)
    .then(function(samples) {
        console.log('采样结果:', samples);
    });
```

### 4.3.3 地形剖面分析

```javascript
// 地形剖面线采样
async function getTerrainProfile(startLon, startLat, endLon, endLat, samples = 100) {
    const positions = [];
    
    for (let i = 0; i <= samples; i++) {
        const fraction = i / samples;
        const lon = startLon + (endLon - startLon) * fraction;
        const lat = startLat + (endLat - startLat) * fraction;
        positions.push(Cesium.Cartographic.fromDegrees(lon, lat));
    }
    
    const sampledPositions = await Cesium.sampleTerrainMostDetailed(
        viewer.terrainProvider, 
        positions
    );
    
    return sampledPositions.map((pos, index) => ({
        distance: index * (Cesium.Cartesian3.distance(
            Cesium.Cartesian3.fromDegrees(startLon, startLat),
            Cesium.Cartesian3.fromDegrees(endLon, endLat)
        ) / samples),
        height: pos.height,
        longitude: Cesium.Math.toDegrees(pos.longitude),
        latitude: Cesium.Math.toDegrees(pos.latitude)
    }));
}

// 使用示例
const profile = await getTerrainProfile(116.0, 39.0, 117.0, 40.0, 50);
console.log('剖面数据:', profile);
```

## 4.4 影像图层管理

### 4.4.1 影像提供者类型

```javascript
const imageryLayers = viewer.imageryLayers;

// ===== Cesium ion 影像 =====
const ionImagery = await Cesium.IonImageryProvider.fromAssetId(2);
imageryLayers.addImageryProvider(ionImagery);

// ===== Bing Maps =====
const bingImagery = await Cesium.BingMapsImageryProvider.fromUrl(
    'https://dev.virtualearth.net',
    {
        key: 'your-bing-key',
        mapStyle: Cesium.BingMapsStyle.AERIAL
    }
);
imageryLayers.addImageryProvider(bingImagery);

// ===== OpenStreetMap =====
const osmImagery = new Cesium.OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/'
});
imageryLayers.addImageryProvider(osmImagery);

// ===== ArcGIS =====
const arcgisImagery = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
);
imageryLayers.addImageryProvider(arcgisImagery);

// ===== WMS =====
const wmsImagery = new Cesium.WebMapServiceImageryProvider({
    url: 'https://your-wms-server.com/wms',
    layers: 'layer1,layer2',
    parameters: {
        service: 'WMS',
        format: 'image/png',
        transparent: true
    }
});
imageryLayers.addImageryProvider(wmsImagery);

// ===== WMTS =====
const wmtsImagery = new Cesium.WebMapTileServiceImageryProvider({
    url: 'https://your-wmts-server.com/wmts',
    layer: 'layer-name',
    style: 'default',
    tileMatrixSetID: 'EPSG:3857',
    format: 'image/png'
});
imageryLayers.addImageryProvider(wmtsImagery);

// ===== TMS =====
const tmsImagery = await Cesium.TileMapServiceImageryProvider.fromUrl(
    'https://your-tms-server.com/tiles/',
    {
        fileExtension: 'png',
        minimumLevel: 0,
        maximumLevel: 18
    }
);
imageryLayers.addImageryProvider(tmsImagery);

// ===== 单张图片 =====
const singleImagery = new Cesium.SingleTileImageryProvider({
    url: 'https://example.com/image.png',
    rectangle: Cesium.Rectangle.fromDegrees(116.0, 39.0, 117.0, 40.0)
});
imageryLayers.addImageryProvider(singleImagery);
```

### 4.4.2 图层操作

```javascript
const imageryLayers = viewer.imageryLayers;

// ===== 添加图层 =====
const layer = imageryLayers.addImageryProvider(provider);
const layerAtIndex = imageryLayers.addImageryProvider(provider, 0); // 插入到指定位置

// ===== 移除图层 =====
imageryLayers.remove(layer);                 // 移除指定图层
imageryLayers.remove(layer, true);           // 移除并销毁
imageryLayers.removeAll();                   // 移除所有图层
imageryLayers.removeAll(true);               // 移除并销毁所有

// ===== 图层顺序 =====
imageryLayers.raise(layer);                  // 上移一层
imageryLayers.lower(layer);                  // 下移一层
imageryLayers.raiseToTop(layer);             // 移到最顶层
imageryLayers.lowerToBottom(layer);          // 移到最底层

// ===== 获取图层 =====
const layerCount = imageryLayers.length;     // 图层数量
const layerAt = imageryLayers.get(0);        // 获取指定索引图层
const indexOf = imageryLayers.indexOf(layer); // 获取图层索引

// ===== 图层属性 =====
layer.show = true;                           // 显示/隐藏
layer.alpha = 1.0;                           // 透明度 (0-1)
layer.brightness = 1.0;                      // 亮度 (0-2)
layer.contrast = 1.0;                        // 对比度 (0-2)
layer.hue = 0.0;                             // 色调 (-1-1)
layer.saturation = 1.0;                      // 饱和度 (0-2)
layer.gamma = 1.0;                           // 伽马 (0-2)
layer.splitDirection = Cesium.SplitDirection.NONE; // 分割方向
layer.minificationFilter = Cesium.TextureMinificationFilter.LINEAR;
layer.magnificationFilter = Cesium.TextureMagnificationFilter.LINEAR;

// ===== 图层事件 =====
imageryLayers.layerAdded.addEventListener(function(layer, index) {
    console.log('图层添加:', index);
});

imageryLayers.layerRemoved.addEventListener(function(layer, index) {
    console.log('图层移除:', index);
});

imageryLayers.layerMoved.addEventListener(function(layer, newIndex, oldIndex) {
    console.log('图层移动:', oldIndex, '->', newIndex);
});
```

### 4.4.3 图层混合示例

```javascript
// 创建影像图层管理器
class ImageryLayerManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.layers = new Map();
    }
    
    // 添加图层
    async addLayer(name, provider, options = {}) {
        const layer = this.viewer.imageryLayers.addImageryProvider(provider);
        
        // 应用选项
        if (options.alpha !== undefined) layer.alpha = options.alpha;
        if (options.brightness !== undefined) layer.brightness = options.brightness;
        if (options.show !== undefined) layer.show = options.show;
        
        this.layers.set(name, layer);
        return layer;
    }
    
    // 获取图层
    getLayer(name) {
        return this.layers.get(name);
    }
    
    // 设置图层可见性
    setVisible(name, visible) {
        const layer = this.layers.get(name);
        if (layer) layer.show = visible;
    }
    
    // 设置图层透明度
    setAlpha(name, alpha) {
        const layer = this.layers.get(name);
        if (layer) layer.alpha = alpha;
    }
    
    // 移除图层
    removeLayer(name) {
        const layer = this.layers.get(name);
        if (layer) {
            this.viewer.imageryLayers.remove(layer, true);
            this.layers.delete(name);
        }
    }
    
    // 切换图层
    switchBaseLayer(name) {
        this.layers.forEach((layer, layerName) => {
            layer.show = (layerName === name);
        });
    }
}

// 使用示例
const layerManager = new ImageryLayerManager(viewer);

// 添加多个底图
await layerManager.addLayer('osm', new Cesium.OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/'
}));

await layerManager.addLayer('satellite', await Cesium.IonImageryProvider.fromAssetId(2));

// 切换底图
layerManager.switchBaseLayer('satellite');
```

## 4.5 UI 控件管理

### 4.5.1 内置控件配置

```javascript
// ===== 动画控件 =====
const animation = viewer.animation;
animation.viewModel.multiplierChanged.addEventListener(function(value) {
    console.log('播放速度:', value);
});

// ===== 时间轴 =====
const timeline = viewer.timeline;
timeline.makeLabel = function(date) {
    return Cesium.JulianDate.toIso8601(date);
};
timeline.zoomTo(
    Cesium.JulianDate.fromIso8601('2024-01-01'),
    Cesium.JulianDate.fromIso8601('2024-12-31')
);

// ===== 主页按钮 =====
viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function(info) {
    // 自定义主页位置
    info.cancel = true;
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 15000000)
    });
});

// ===== 地理编码器 =====
viewer.geocoder.viewModel.searchText = '北京';
viewer.geocoder.viewModel.search();

// ===== 场景模式选择器 =====
viewer.sceneModePicker.viewModel.duration = 2.0; // 切换动画时长

// ===== 信息框 =====
viewer.infoBox.frame.sandbox = 'allow-same-origin allow-scripts';
viewer.infoBox.viewModel.showInfo = true;

// ===== 选择指示器 =====
viewer.selectionIndicator.viewModel.showSelection = true;
```

### 4.5.2 隐藏/显示控件

```javascript
// 创建时隐藏控件
const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    timeline: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    baseLayerPicker: false
});

// 运行时隐藏控件
viewer.animation.container.style.display = 'none';
viewer.timeline.container.style.display = 'none';

// 隐藏版权信息
viewer.cesiumWidget.creditContainer.style.display = 'none';

// 隐藏 logo
viewer._cesiumWidget._creditContainer.style.display = 'none';
```

### 4.5.3 自定义控件

```javascript
// 创建自定义工具栏
class CustomToolbar {
    constructor(viewer) {
        this.viewer = viewer;
        this.container = this.createContainer();
    }
    
    createContainer() {
        const container = document.createElement('div');
        container.className = 'custom-toolbar';
        container.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 999;
            background: rgba(42, 42, 42, 0.8);
            padding: 10px;
            border-radius: 4px;
        `;
        
        this.viewer.container.appendChild(container);
        return container;
    }
    
    addButton(options) {
        const button = document.createElement('button');
        button.innerHTML = options.icon || options.text;
        button.title = options.tooltip || '';
        button.style.cssText = `
            display: block;
            margin: 5px 0;
            padding: 8px 16px;
            cursor: pointer;
            background: #303030;
            color: white;
            border: 1px solid #444;
            border-radius: 4px;
        `;
        
        button.addEventListener('click', options.onClick);
        this.container.appendChild(button);
        
        return button;
    }
    
    addSeparator() {
        const separator = document.createElement('div');
        separator.style.cssText = `
            height: 1px;
            background: #444;
            margin: 10px 0;
        `;
        this.container.appendChild(separator);
    }
}

// 使用示例
const toolbar = new CustomToolbar(viewer);

toolbar.addButton({
    text: '🏠 主页',
    tooltip: '回到主页视角',
    onClick: () => viewer.camera.flyHome()
});

toolbar.addButton({
    text: '📍 定位',
    tooltip: '定位到北京',
    onClick: () => {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 15000)
        });
    }
});

toolbar.addSeparator();

toolbar.addButton({
    text: '📷 截图',
    tooltip: '保存当前视图',
    onClick: () => {
        const canvas = viewer.scene.canvas;
        const link = document.createElement('a');
        link.download = 'cesium_screenshot.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
});
```

## 4.6 场景事件与交互

### 4.6.1 场景事件监听

```javascript
// ===== 渲染事件 =====
viewer.scene.preUpdate.addEventListener(function(scene, time) {
    // 每帧更新前
});

viewer.scene.postUpdate.addEventListener(function(scene, time) {
    // 每帧更新后
});

viewer.scene.preRender.addEventListener(function(scene, time) {
    // 每帧渲染前
});

viewer.scene.postRender.addEventListener(function(scene, time) {
    // 每帧渲染后
});

// ===== 场景模式变化 =====
viewer.scene.morphStart.addEventListener(function(scene, prevMode, newMode, isMorphing) {
    console.log('场景模式开始切换:', prevMode, '->', newMode);
});

viewer.scene.morphComplete.addEventListener(function(scene, prevMode, newMode, isMorphing) {
    console.log('场景模式切换完成:', newMode);
});

// ===== 地形变化 =====
viewer.scene.terrainProviderChanged.addEventListener(function() {
    console.log('地形提供者已更改');
});
```

### 4.6.2 相机控制器配置

```javascript
const controller = viewer.scene.screenSpaceCameraController;

// ===== 启用/禁用控制 =====
controller.enableRotate = true;              // 旋转
controller.enableTranslate = true;           // 平移
controller.enableZoom = true;                // 缩放
controller.enableTilt = true;                // 倾斜
controller.enableLook = true;                // 环视

// ===== 缩放限制 =====
controller.minimumZoomDistance = 100;        // 最小缩放距离
controller.maximumZoomDistance = 20000000;   // 最大缩放距离

// ===== 倾斜限制 =====
controller.minimumCollisionTerrainHeight = 15000; // 最小碰撞地形高度
controller.maximumMovementRatio = 0.1;       // 最大移动比率

// ===== 惯性设置 =====
controller.inertiaSpin = 0.9;                // 旋转惯性
controller.inertiaTranslate = 0.9;           // 平移惯性
controller.inertiaZoom = 0.8;                // 缩放惯性

// ===== 鼠标按键映射 =====
controller.rotateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
controller.translateEventTypes = Cesium.CameraEventType.RIGHT_DRAG;
controller.zoomEventTypes = [
    Cesium.CameraEventType.MIDDLE_DRAG,
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH
];
controller.tiltEventTypes = [
    Cesium.CameraEventType.MIDDLE_DRAG,
    Cesium.CameraEventType.PINCH
];
```

## 4.7 本章小结

本章深入介绍了 Viewer 与场景管理：

1. **Viewer 配置**：完整的配置选项、属性和方法
2. **Scene 管理**：场景模式、渲染质量、光照配置
3. **Globe 配置**：地球渲染、光照、瓦片设置
4. **地形管理**：多种地形提供者、地形采样、剖面分析
5. **影像图层**：多种影像源、图层操作、混合管理
6. **UI 控件**：内置控件配置、自定义控件
7. **场景交互**：事件监听、相机控制器

在下一章中，我们将详细介绍相机系统与视角控制。

## 4.8 思考与练习

1. 创建一个包含多个底图切换功能的 Viewer。
2. 实现地形剖面分析，绘制剖面图。
3. 配置自定义天空盒和大气效果。
4. 创建一个完整的工具栏，包含常用功能。
5. 实现图层透明度滑块控件。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/cesium/第04章-Viewer与场景管理/第03章-核心架构与模块设计/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/cesium/第04章-Viewer与场景管理/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/cesium/第04章-Viewer与场景管理/第05章-相机系统与视角控制/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

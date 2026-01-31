---
layout: default
title: 第05章 - View视图与坐标系统
---

# 第05章 - View 视图与坐标系统

## 5.1 View 对象概述

### 5.1.1 View 的作用

View 对象控制地图的可视化状态，包括：

- **中心点（Center）**：地图显示的中心位置
- **缩放级别（Zoom）**：地图的缩放层级
- **分辨率（Resolution）**：每像素代表的地图单位
- **旋转角度（Rotation）**：地图的旋转角度（弧度）
- **投影（Projection）**：地图使用的坐标参考系统

```
┌─────────────────────────────────────────────────────────────┐
│                      View 状态模型                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    View                              │  │
│   │                                                      │  │
│   │    center ────────────────────── 中心点坐标          │  │
│   │    zoom ──────────────────────── 缩放级别            │  │
│   │    resolution ────────────────── 分辨率              │  │
│   │    rotation ──────────────────── 旋转角度            │  │
│   │    projection ────────────────── 投影系统            │  │
│   │                                                      │  │
│   │    ┌─────────────────────────────────────────────┐  │  │
│   │    │              约束系统                        │  │  │
│   │    │  extent ─────────── 范围约束                 │  │  │
│   │    │  minZoom/maxZoom ── 缩放约束                 │  │  │
│   │    │  constrainRotation ─ 旋转约束                │  │  │
│   │    └─────────────────────────────────────────────┘  │  │
│   │                                                      │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.1.2 View 的创建

```javascript
import View from 'ol/View';
import { fromLonLat, get as getProjection } from 'ol/proj';

// 基础创建
const view = new View({
  center: fromLonLat([116.4074, 39.9042]),
  zoom: 10
});

// 完整配置
const fullView = new View({
  // 中心点（必须使用地图投影坐标）
  center: fromLonLat([116.4074, 39.9042]),
  
  // 缩放级别或分辨率（二选一）
  zoom: 10,
  // resolution: 1000,
  
  // 旋转角度（弧度）
  rotation: 0,
  
  // 投影系统
  projection: 'EPSG:3857', // 默认值
  
  // 缩放约束
  minZoom: 2,
  maxZoom: 18,
  
  // 分辨率约束（与缩放约束互斥）
  // minResolution: 0.5,
  // maxResolution: 100000,
  
  // 范围约束
  extent: undefined, // [minX, minY, maxX, maxY]
  
  // 约束设置
  constrainRotation: true, // 旋转约束（true = 只允许 0 度）
  enableRotation: true,     // 允许旋转
  constrainOnlyCenter: false, // 仅约束中心点
  smoothExtentConstraint: true,
  smoothResolutionConstraint: true,
  
  // 缩放因子
  zoomFactor: 2,
  
  // 多世界显示
  multiWorld: false,
  
  // 视图边距
  padding: [0, 0, 0, 0] // [top, right, bottom, left]
});
```

## 5.2 View 状态管理

### 5.2.1 中心点操作

```javascript
import { fromLonLat, toLonLat } from 'ol/proj';

// 获取中心点（地图投影坐标）
const center = view.getCenter();
console.log('Web Mercator 坐标:', center);

// 转换为经纬度
const lonLat = toLonLat(center);
console.log('经纬度:', lonLat);

// 设置中心点
view.setCenter(fromLonLat([121.4737, 31.2304]));

// 带动画设置中心点
view.animate({
  center: fromLonLat([121.4737, 31.2304]),
  duration: 1000
});

// 获取中心点相关信息
const centerAtResolution = view.getCenterInternal(); // 内部方法
```

### 5.2.2 缩放级别操作

```javascript
// 获取当前缩放级别
const zoom = view.getZoom();
console.log('当前缩放:', zoom);

// 设置缩放级别
view.setZoom(12);

// 获取整数缩放级别
const roundedZoom = Math.round(view.getZoom());

// 获取缩放范围
const minZoom = view.getMinZoom();
const maxZoom = view.getMaxZoom();

// 缩放限制
view.setMinZoom(5);
view.setMaxZoom(15);

// 缩放一级
function zoomIn(view) {
  const currentZoom = view.getZoom();
  view.animate({
    zoom: currentZoom + 1,
    duration: 250
  });
}

function zoomOut(view) {
  const currentZoom = view.getZoom();
  view.animate({
    zoom: currentZoom - 1,
    duration: 250
  });
}
```

### 5.2.3 分辨率操作

```javascript
// 获取当前分辨率（每像素代表的地图单位）
const resolution = view.getResolution();
console.log('当前分辨率:', resolution, '米/像素');

// 设置分辨率
view.setResolution(500);

// 获取分辨率范围
const minResolution = view.getMinResolution();
const maxResolution = view.getMaxResolution();

// 分辨率与缩放级别转换
const zoomForResolution = view.getZoomForResolution(resolution);
const resolutionForZoom = view.getResolutionForZoom(10);

// 获取指定范围的分辨率
const size = map.getSize();
const extent = [12800000, 4700000, 13200000, 5000000];
const resolutionForExtent = view.getResolutionForExtent(extent, size);

// 获取所有分辨率（瓦片图层）
const resolutions = view.getResolutions();
```

### 5.2.4 旋转操作

```javascript
// 获取旋转角度（弧度）
const rotation = view.getRotation();
console.log('旋转角度:', rotation, '弧度');
console.log('旋转角度:', rotation * 180 / Math.PI, '度');

// 设置旋转
view.setRotation(Math.PI / 4); // 45度

// 旋转到北方
function resetRotation(view) {
  view.animate({
    rotation: 0,
    duration: 300
  });
}

// 旋转指定角度
function rotateBy(view, degrees) {
  const currentRotation = view.getRotation();
  const radians = degrees * Math.PI / 180;
  view.animate({
    rotation: currentRotation + radians,
    duration: 300
  });
}

// 约束旋转到整数角度
function constrainRotationToSteps(view, steps = 8) {
  const rotation = view.getRotation();
  const step = 2 * Math.PI / steps;
  const constrainedRotation = Math.round(rotation / step) * step;
  view.animate({
    rotation: constrainedRotation,
    duration: 200
  });
}
```

### 5.2.5 范围计算

```javascript
// 计算当前视口范围
const size = map.getSize();
const extent = view.calculateExtent(size);
console.log('视口范围:', extent);
// [minX, minY, maxX, maxY]

// 判断坐标是否在视口内
function isCoordinateInView(view, map, coordinate) {
  const extent = view.calculateExtent(map.getSize());
  return (
    coordinate[0] >= extent[0] &&
    coordinate[0] <= extent[2] &&
    coordinate[1] >= extent[1] &&
    coordinate[1] <= extent[3]
  );
}

// 获取视口中心到边缘的距离
const center = view.getCenter();
const extent = view.calculateExtent(map.getSize());
const halfWidth = (extent[2] - extent[0]) / 2;
const halfHeight = (extent[3] - extent[1]) / 2;
```

## 5.3 视图动画

### 5.3.1 基础动画

```javascript
// 平移动画
view.animate({
  center: fromLonLat([121.4737, 31.2304]),
  duration: 1000
});

// 缩放动画
view.animate({
  zoom: 15,
  duration: 500
});

// 旋转动画
view.animate({
  rotation: Math.PI / 2,
  duration: 500
});

// 组合动画（同时执行）
view.animate({
  center: fromLonLat([121.4737, 31.2304]),
  zoom: 15,
  rotation: 0,
  duration: 1000
});
```

### 5.3.2 连续动画

```javascript
// 连续动画（按顺序执行）
view.animate(
  { center: fromLonLat([116.4074, 39.9042]), duration: 1000 },
  { zoom: 15, duration: 500 },
  { rotation: Math.PI / 4, duration: 500 }
);

// 飞行动画（先缩小再放大）
function flyTo(view, destination, zoom, done) {
  const startZoom = view.getZoom();
  const targetZoom = zoom || startZoom;
  const minZoom = Math.min(startZoom, targetZoom, 8);
  
  let parts = 2;
  let called = false;
  
  function callback(complete) {
    --parts;
    if (called) {
      return;
    }
    if (parts === 0 || !complete) {
      called = true;
      done && done(complete);
    }
  }
  
  view.animate(
    {
      center: destination,
      duration: 1000
    },
    callback
  );
  
  view.animate(
    {
      zoom: minZoom,
      duration: 500
    },
    {
      zoom: targetZoom,
      duration: 500
    },
    callback
  );
}

// 使用示例
flyTo(view, fromLonLat([121.4737, 31.2304]), 15, (complete) => {
  console.log('动画完成:', complete);
});
```

### 5.3.3 缓动函数

```javascript
import { easeIn, easeOut, inAndOut, linear } from 'ol/easing';

// 使用内置缓动函数
view.animate({
  center: fromLonLat([121.4737, 31.2304]),
  duration: 1000,
  easing: easeOut // 先快后慢
});

view.animate({
  zoom: 15,
  duration: 500,
  easing: easeIn // 先慢后快
});

view.animate({
  center: fromLonLat([116.4074, 39.9042]),
  duration: 1000,
  easing: inAndOut // 两头慢中间快
});

view.animate({
  rotation: 0,
  duration: 300,
  easing: linear // 匀速
});

// 自定义缓动函数
function bounce(t) {
  const s = 7.5625;
  const p = 2.75;
  
  if (t < 1 / p) {
    return s * t * t;
  }
  if (t < 2 / p) {
    t -= 1.5 / p;
    return s * t * t + 0.75;
  }
  if (t < 2.5 / p) {
    t -= 2.25 / p;
    return s * t * t + 0.9375;
  }
  t -= 2.625 / p;
  return s * t * t + 0.984375;
}

view.animate({
  center: fromLonLat([121.4737, 31.2304]),
  duration: 1500,
  easing: bounce
});

// 弹性缓动
function elastic(t) {
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}
```

### 5.3.4 动画回调

```javascript
// 动画完成回调
view.animate(
  {
    center: fromLonLat([121.4737, 31.2304]),
    duration: 1000
  },
  (complete) => {
    if (complete) {
      console.log('动画正常完成');
    } else {
      console.log('动画被中断');
    }
  }
);

// 取消动画
// 调用新的 animate 会取消正在进行的动画
view.animate({
  center: fromLonLat([116.4074, 39.9042]),
  duration: 2000
});

// 1秒后取消
setTimeout(() => {
  view.animate({
    center: view.getCenter(),
    duration: 0
  });
}, 1000);

// 或使用 cancelAnimations
view.cancelAnimations();
```

## 5.4 视图约束

### 5.4.1 范围约束

```javascript
import { boundingExtent, buffer } from 'ol/extent';
import { fromLonLat } from 'ol/proj';

// 设置视图范围约束（只能在此范围内平移）
const chinaExtent = [
  ...fromLonLat([73.0, 3.0]),
  ...fromLonLat([136.0, 54.0])
];

const view = new View({
  center: fromLonLat([116.4074, 39.9042]),
  zoom: 4,
  extent: chinaExtent // 范围约束
});

// 动态设置范围约束
// 注意：需要创建新的 View 对象

// 基于图层范围约束
function constrainToLayerExtent(map, vectorLayer) {
  const source = vectorLayer.getSource();
  
  source.once('change', () => {
    if (source.getState() === 'ready') {
      const extent = source.getExtent();
      const bufferedExtent = buffer(extent, 10000); // 添加缓冲
      
      const view = new View({
        center: map.getView().getCenter(),
        zoom: map.getView().getZoom(),
        extent: bufferedExtent
      });
      
      map.setView(view);
    }
  });
}
```

### 5.4.2 缩放约束

```javascript
// 整数缩放级别约束
const view = new View({
  center: fromLonLat([116.4074, 39.9042]),
  zoom: 10,
  constrainResolution: true // 强制整数缩放级别
});

// 自定义分辨率序列
const resolutions = [
  156543.03392804097,
  78271.51696402048,
  39135.75848201024,
  19567.87924100512,
  9783.93962050256,
  4891.96981025128,
  2445.98490512564,
  1222.99245256282,
  611.49622628141,
  305.748113140705,
  152.8740565703525,
  76.43702828517625,
  38.21851414258813,
  19.109257071294063,
  9.554628535647032,
  4.777314267823516,
  2.388657133911758,
  1.194328566955879,
  0.5971642834779395
];

const view = new View({
  center: fromLonLat([116.4074, 39.9042]),
  resolutions: resolutions,
  zoom: 10
});
```

### 5.4.3 旋转约束

```javascript
// 禁用旋转
const view = new View({
  center: fromLonLat([116.4074, 39.9042]),
  zoom: 10,
  enableRotation: false
});

// 约束到特定角度（如 0, 90, 180, 270 度）
const view2 = new View({
  center: fromLonLat([116.4074, 39.9042]),
  zoom: 10,
  constrainRotation: 4 // 4 个方向
});

// 约束到 8 个方向（0, 45, 90, 135, 180, 225, 270, 315 度）
const view3 = new View({
  center: fromLonLat([116.4074, 39.9042]),
  zoom: 10,
  constrainRotation: 8
});

// 只允许正北（0 度）
const view4 = new View({
  center: fromLonLat([116.4074, 39.9042]),
  zoom: 10,
  constrainRotation: true // 等同于 constrainRotation: 1
});
```

## 5.5 适应范围（fit）

### 5.5.1 基础 fit 操作

```javascript
import { fromLonLat } from 'ol/proj';
import { boundingExtent } from 'ol/extent';

// 适应指定范围
const extent = [
  ...fromLonLat([115.0, 39.0]),
  ...fromLonLat([118.0, 41.0])
];

view.fit(extent, {
  size: map.getSize()
});

// 带配置的 fit
view.fit(extent, {
  size: map.getSize(),
  padding: [50, 50, 50, 50], // [top, right, bottom, left]
  duration: 1000, // 动画时长
  maxZoom: 15, // 最大缩放级别
  minResolution: 1, // 最小分辨率
  nearest: false, // 是否取最近的有效分辨率
  callback: (complete) => {
    console.log('fit 完成:', complete);
  }
});

// 适应几何对象
const geometry = feature.getGeometry();
view.fit(geometry, {
  padding: [100, 100, 100, 100],
  maxZoom: 16
});

// 适应多个点
const coordinates = [
  fromLonLat([116.4074, 39.9042]),
  fromLonLat([121.4737, 31.2304]),
  fromLonLat([113.2644, 23.1291])
];
const pointsExtent = boundingExtent(coordinates);
view.fit(pointsExtent, {
  padding: [50, 50, 50, 50],
  duration: 500
});
```

### 5.5.2 fit 高级用法

```javascript
// 适应图层范围
function fitToLayer(map, layer) {
  const source = layer.getSource();
  
  if (source instanceof VectorSource) {
    const extent = source.getExtent();
    if (extent && !isEmpty(extent)) {
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 500
      });
    }
  }
}

// 适应所有要素
function fitToAllFeatures(map, vectorSource) {
  const features = vectorSource.getFeatures();
  
  if (features.length > 0) {
    const extent = vectorSource.getExtent();
    map.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      maxZoom: 16
    });
  }
}

// 适应选中要素
function fitToSelectedFeatures(map, features) {
  if (features.length === 0) return;
  
  const geometries = features.map(f => f.getGeometry());
  const collection = new GeometryCollection(geometries);
  const extent = collection.getExtent();
  
  map.getView().fit(extent, {
    padding: [50, 50, 50, 50],
    maxZoom: 16,
    duration: 500
  });
}

// 考虑侧边栏的 fit
function fitWithSidebar(map, extent, sidebarWidth) {
  const size = map.getSize();
  const viewportWidth = size[0] - sidebarWidth;
  
  map.getView().fit(extent, {
    size: [viewportWidth, size[1]],
    padding: [50, 50, 50, sidebarWidth + 50]
  });
}
```

## 5.6 投影系统

### 5.6.1 内置投影

```javascript
import { get as getProjection, transform, fromLonLat, toLonLat } from 'ol/proj';

// 获取内置投影
const wgs84 = getProjection('EPSG:4326');      // WGS84 经纬度
const webMercator = getProjection('EPSG:3857'); // Web Mercator

// 投影属性
console.log('代码:', webMercator.getCode());        // EPSG:3857
console.log('单位:', webMercator.getUnits());       // m
console.log('范围:', webMercator.getExtent());      // 全球范围
console.log('是否全球:', webMercator.isGlobal());   // true
console.log('米/单位:', webMercator.getMetersPerUnit()); // 1

// 常用坐标转换
// 经纬度 → Web Mercator
const webMercatorCoord = fromLonLat([116.4074, 39.9042]);

// Web Mercator → 经纬度
const lonLatCoord = toLonLat([12958752.49, 4853167.35]);

// 通用转换
const coord = transform(
  [116.4074, 39.9042],
  'EPSG:4326',
  'EPSG:3857'
);
```

### 5.6.2 注册自定义投影

```javascript
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { get as getProjection, addProjection, addCoordinateTransforms } from 'ol/proj';
import Projection from 'ol/proj/Projection';

// 定义 CGCS2000 投影
proj4.defs('EPSG:4490', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');

// 定义 CGCS2000 高斯投影（3度带）
proj4.defs('EPSG:4527', 
  '+proj=tmerc +lat_0=0 +lon_0=117 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs'
);

// 注册到 OpenLayers
register(proj4);

// 使用自定义投影
const cgcs2000 = getProjection('EPSG:4490');
const cgcs2000Gauss = getProjection('EPSG:4527');

// 在 View 中使用
const view = new View({
  projection: 'EPSG:4490',
  center: [116.4074, 39.9042],
  zoom: 10
});

// 手动添加投影（不使用 proj4）
const customProjection = new Projection({
  code: 'CUSTOM:001',
  units: 'm',
  extent: [-20037508.34, -20037508.34, 20037508.34, 20037508.34]
});

addProjection(customProjection);
```

### 5.6.3 中国常用投影

```javascript
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';

// CGCS2000 经纬度
proj4.defs('EPSG:4490', '+proj=longlat +ellps=GRS80 +no_defs');

// CGCS2000 高斯投影 3度带（以中央经线命名）
// 75度带
proj4.defs('EPSG:4513', '+proj=tmerc +lat_0=0 +lon_0=75 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
// 78度带
proj4.defs('EPSG:4514', '+proj=tmerc +lat_0=0 +lon_0=78 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
// ...
// 117度带（北京）
proj4.defs('EPSG:4527', '+proj=tmerc +lat_0=0 +lon_0=117 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
// 120度带（上海）
proj4.defs('EPSG:4528', '+proj=tmerc +lat_0=0 +lon_0=120 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');

// 北京54坐标系
proj4.defs('EPSG:4214', '+proj=longlat +ellps=krass +towgs84=15.8,-154.4,-82.3,0,0,0,0 +no_defs');

// 西安80坐标系
proj4.defs('EPSG:4610', '+proj=longlat +ellps=IAU76 +no_defs');

register(proj4);

// 根据经度计算 CGCS2000 3度带号和投影
function getCGCS2000Zone(longitude) {
  const zone = Math.floor((longitude + 1.5) / 3);
  const centralMeridian = zone * 3;
  const epsg = 4512 + zone; // 近似计算
  return { zone, centralMeridian, epsg };
}
```

### 5.6.4 投影转换

```javascript
import { transform, transformExtent } from 'ol/proj';

// 坐标转换
const wgs84Coord = [116.4074, 39.9042];
const mercatorCoord = transform(wgs84Coord, 'EPSG:4326', 'EPSG:3857');
console.log('Web Mercator:', mercatorCoord);

// 反向转换
const backToWgs84 = transform(mercatorCoord, 'EPSG:3857', 'EPSG:4326');
console.log('WGS84:', backToWgs84);

// 范围转换
const wgs84Extent = [115, 39, 118, 41];
const mercatorExtent = transformExtent(wgs84Extent, 'EPSG:4326', 'EPSG:3857');
console.log('Mercator 范围:', mercatorExtent);

// 几何对象转换
import { Geometry } from 'ol/geom';

const geometry = feature.getGeometry();
const transformedGeometry = geometry.clone().transform('EPSG:4326', 'EPSG:3857');

// 要素转换
const transformedFeature = feature.clone();
transformedFeature.getGeometry().transform('EPSG:4326', 'EPSG:3857');

// 批量转换要素
function transformFeatures(features, sourceProj, targetProj) {
  return features.map(feature => {
    const cloned = feature.clone();
    cloned.getGeometry().transform(sourceProj, targetProj);
    return cloned;
  });
}
```

## 5.7 View 事件

### 5.7.1 属性变化事件

```javascript
// 中心点变化
view.on('change:center', (event) => {
  const center = view.getCenter();
  const lonLat = toLonLat(center);
  console.log('中心点变化:', lonLat);
});

// 分辨率变化
view.on('change:resolution', (event) => {
  const resolution = view.getResolution();
  const zoom = view.getZoom();
  console.log('分辨率变化:', resolution, '缩放:', zoom);
});

// 旋转变化
view.on('change:rotation', (event) => {
  const rotation = view.getRotation();
  const degrees = rotation * 180 / Math.PI;
  console.log('旋转变化:', degrees, '度');
});

// 任意属性变化
view.on('propertychange', (event) => {
  console.log('属性变化:', event.key);
});

// 组合监听
function onViewChange(view, callback) {
  const keys = [
    view.on('change:center', callback),
    view.on('change:resolution', callback),
    view.on('change:rotation', callback)
  ];
  
  return function unsubscribe() {
    keys.forEach(key => unByKey(key));
  };
}

const unsubscribe = onViewChange(view, () => {
  console.log('视图状态变化');
});

// 取消监听
// unsubscribe();
```

### 5.7.2 防抖处理

```javascript
// 防抖视图变化事件
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const onViewChanged = debounce(() => {
  const center = view.getCenter();
  const zoom = view.getZoom();
  
  // 保存视图状态
  saveViewState({ center, zoom });
  
  // 加载当前范围的数据
  loadDataForExtent(view.calculateExtent(map.getSize()));
}, 300);

view.on('change:center', onViewChanged);
view.on('change:resolution', onViewChanged);
```

## 5.8 实战示例

### 5.8.1 视图状态持久化

```javascript
class ViewStatePersistence {
  constructor(map, storageKey = 'map_view_state') {
    this.map = map;
    this.view = map.getView();
    this.storageKey = storageKey;
    
    this.init();
  }
  
  init() {
    // 恢复保存的状态
    this.restore();
    
    // 监听视图变化
    this.view.on('change:center', () => this.save());
    this.view.on('change:resolution', () => this.save());
    this.view.on('change:rotation', () => this.save());
  }
  
  save() {
    const state = {
      center: this.view.getCenter(),
      zoom: this.view.getZoom(),
      rotation: this.view.getRotation()
    };
    
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }
  
  restore() {
    const saved = localStorage.getItem(this.storageKey);
    
    if (saved) {
      try {
        const state = JSON.parse(saved);
        
        if (state.center) {
          this.view.setCenter(state.center);
        }
        if (state.zoom !== undefined) {
          this.view.setZoom(state.zoom);
        }
        if (state.rotation !== undefined) {
          this.view.setRotation(state.rotation);
        }
      } catch (e) {
        console.error('恢复视图状态失败:', e);
      }
    }
  }
  
  clear() {
    localStorage.removeItem(this.storageKey);
  }
}

// 使用
const viewPersistence = new ViewStatePersistence(map);
```

### 5.8.2 书签功能

```javascript
class ViewBookmarks {
  constructor(map) {
    this.map = map;
    this.view = map.getView();
    this.bookmarks = this.loadBookmarks();
  }
  
  add(name) {
    const bookmark = {
      name: name,
      center: this.view.getCenter(),
      zoom: this.view.getZoom(),
      rotation: this.view.getRotation(),
      timestamp: Date.now()
    };
    
    this.bookmarks.push(bookmark);
    this.saveBookmarks();
    
    return bookmark;
  }
  
  goto(bookmark) {
    this.view.animate({
      center: bookmark.center,
      zoom: bookmark.zoom,
      rotation: bookmark.rotation,
      duration: 1000
    });
  }
  
  remove(name) {
    this.bookmarks = this.bookmarks.filter(b => b.name !== name);
    this.saveBookmarks();
  }
  
  getAll() {
    return [...this.bookmarks];
  }
  
  loadBookmarks() {
    const saved = localStorage.getItem('map_bookmarks');
    return saved ? JSON.parse(saved) : [];
  }
  
  saveBookmarks() {
    localStorage.setItem('map_bookmarks', JSON.stringify(this.bookmarks));
  }
}

// 使用示例
const bookmarks = new ViewBookmarks(map);

// 添加书签
bookmarks.add('北京');

// 获取所有书签
const allBookmarks = bookmarks.getAll();

// 跳转到书签
bookmarks.goto(allBookmarks[0]);
```

### 5.8.3 地图漫游

```javascript
class MapTour {
  constructor(map, locations) {
    this.map = map;
    this.view = map.getView();
    this.locations = locations;
    this.currentIndex = 0;
    this.isPlaying = false;
    this.interval = null;
  }
  
  play(intervalMs = 3000) {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.showLocation(this.currentIndex);
    
    this.interval = setInterval(() => {
      this.next();
    }, intervalMs);
  }
  
  pause() {
    this.isPlaying = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  next() {
    this.currentIndex = (this.currentIndex + 1) % this.locations.length;
    this.showLocation(this.currentIndex);
  }
  
  previous() {
    this.currentIndex = (this.currentIndex - 1 + this.locations.length) % this.locations.length;
    this.showLocation(this.currentIndex);
  }
  
  showLocation(index) {
    const location = this.locations[index];
    
    this.view.animate({
      center: fromLonLat(location.center),
      zoom: location.zoom || 12,
      duration: 1500
    });
    
    // 触发事件
    if (this.onLocationChange) {
      this.onLocationChange(location, index);
    }
  }
  
  goto(index) {
    if (index >= 0 && index < this.locations.length) {
      this.currentIndex = index;
      this.showLocation(index);
    }
  }
}

// 使用示例
const locations = [
  { name: '北京', center: [116.4074, 39.9042], zoom: 11 },
  { name: '上海', center: [121.4737, 31.2304], zoom: 11 },
  { name: '广州', center: [113.2644, 23.1291], zoom: 11 },
  { name: '深圳', center: [114.0579, 22.5431], zoom: 11 }
];

const tour = new MapTour(map, locations);

tour.onLocationChange = (location, index) => {
  console.log(`当前位置: ${location.name} (${index + 1}/${locations.length})`);
};

// 开始漫游
tour.play(5000);

// 暂停
// tour.pause();

// 手动导航
// tour.next();
// tour.previous();
// tour.goto(2);
```

## 5.9 本章小结

本章详细介绍了 View 视图与坐标系统：

1. **View 概述**：作用、创建方式
2. **状态管理**：中心点、缩放、分辨率、旋转、范围
3. **视图动画**：基础动画、连续动画、缓动函数
4. **视图约束**：范围约束、缩放约束、旋转约束
5. **适应范围**：fit 基础操作、高级用法
6. **投影系统**：内置投影、自定义投影、坐标转换
7. **View 事件**：属性变化、防抖处理
8. **实战示例**：状态持久化、书签功能、地图漫游

### 关键要点

- View 管理地图的所有可视化状态
- 使用 animate 方法实现平滑过渡
- 理解分辨率与缩放级别的关系
- 正确配置投影系统处理不同坐标数据
- 使用 fit 方法适应数据范围

### 下一步

在下一章中，我们将详细学习 Layer 图层体系，包括：
- 图层类型详解
- 图层配置与管理
- 图层组使用
- 图层渲染控制

---

[← 上一章：Map地图对象详解](第04章-Map地图对象详解) | [返回目录](README) | [下一章：Layer图层体系 →](第06章-Layer图层体系)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第04章-Map地图对象详解" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第06章-Layer图层体系" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

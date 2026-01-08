---
layout: default
title: 第06章 - Layer图层体系
---

# 第06章 - Layer 图层体系

## 6.1 图层概述

### 6.1.1 图层的概念

图层（Layer）是 OpenLayers 中用于组织和显示地理数据的基本单元。每个图层都有自己的数据源（Source）和渲染方式，多个图层按照堆叠顺序叠加显示，形成完整的地图画面。

```
┌─────────────────────────────────────────────────────────────┐
│                      图层堆叠模型                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  VectorLayer (标注层)                 zIndex: 100    │  │
│   └─────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  VectorLayer (业务数据层)             zIndex: 50     │  │
│   └─────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  TileLayer (影像注记层)               zIndex: 10     │  │
│   └─────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  TileLayer (底图层)                   zIndex: 0      │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   渲染顺序：从下往上                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.1.2 图层类型

OpenLayers 提供多种图层类型以满足不同需求：

| 图层类型 | 类名 | 用途 |
|---------|------|------|
| 瓦片图层 | ol/layer/Tile | 显示瓦片地图（底图、影像等） |
| 矢量图层 | ol/layer/Vector | 显示矢量要素（点、线、面） |
| 矢量瓦片图层 | ol/layer/VectorTile | 显示矢量瓦片 |
| 图像图层 | ol/layer/Image | 显示单张图像 |
| 热力图层 | ol/layer/Heatmap | 显示热力图 |
| WebGL 点图层 | ol/layer/WebGLPoints | WebGL 渲染大量点 |
| 图层组 | ol/layer/Group | 组合多个图层 |

### 6.1.3 图层基类

所有图层都继承自 Layer 基类，共享以下通用属性：

```javascript
import Layer from 'ol/layer/Layer';

// Layer 基类通用配置
const layerOptions = {
  // 可见性
  visible: true,
  
  // 透明度 (0-1)
  opacity: 1.0,
  
  // 堆叠顺序
  zIndex: 0,
  
  // 渲染范围限制
  extent: undefined, // [minX, minY, maxX, maxY]
  
  // 缩放级别限制
  minZoom: undefined,
  maxZoom: undefined,
  
  // 分辨率限制
  minResolution: undefined,
  maxResolution: undefined,
  
  // 数据源
  source: null,
  
  // CSS 类名
  className: 'ol-layer',
  
  // 自定义属性
  properties: {
    name: 'MyLayer',
    type: 'overlay'
  }
};
```

## 6.2 TileLayer 瓦片图层

### 6.2.1 基础使用

```javascript
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';

// OpenStreetMap 图层
const osmLayer = new TileLayer({
  source: new OSM()
});

// XYZ 瓦片图层
const xyzLayer = new TileLayer({
  source: new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19
  })
});

// WMS 瓦片图层
const wmsLayer = new TileLayer({
  source: new TileWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: {
      'LAYERS': 'workspace:layer',
      'TILED': true
    },
    serverType: 'geoserver'
  })
});
```

### 6.2.2 瓦片图层配置

```javascript
const tileLayer = new TileLayer({
  // 通用属性
  visible: true,
  opacity: 1.0,
  zIndex: 0,
  
  // 数据源
  source: new OSM(),
  
  // 预加载级别（向上预加载的层数）
  preload: 0, // 0 表示不预加载
  
  // 是否使用临时瓦片（加载失败时）
  useInterimTilesOnError: true,
  
  // 自定义属性
  properties: {
    name: 'OSM底图',
    isBasemap: true
  }
});

// 获取/设置属性
tileLayer.get('name'); // 'OSM底图'
tileLayer.set('name', 'OpenStreetMap');

// 可见性操作
tileLayer.setVisible(false);
const isVisible = tileLayer.getVisible();

// 透明度操作
tileLayer.setOpacity(0.8);
const opacity = tileLayer.getOpacity();

// 数据源操作
const source = tileLayer.getSource();
tileLayer.setSource(new XYZ({ url: '...' }));
```

### 6.2.3 瓦片加载事件

```javascript
const tileSource = tileLayer.getSource();

// 瓦片开始加载
tileSource.on('tileloadstart', (event) => {
  console.log('瓦片开始加载:', event.tile.getTileCoord());
});

// 瓦片加载完成
tileSource.on('tileloadend', (event) => {
  console.log('瓦片加载完成:', event.tile.getTileCoord());
});

// 瓦片加载失败
tileSource.on('tileloaderror', (event) => {
  console.error('瓦片加载失败:', event.tile.getTileCoord());
});

// 加载进度跟踪
class TileLoadingTracker {
  constructor(source) {
    this.loading = 0;
    this.loaded = 0;
    
    source.on('tileloadstart', () => {
      this.loading++;
      this.update();
    });
    
    source.on('tileloadend', () => {
      this.loaded++;
      this.update();
    });
    
    source.on('tileloaderror', () => {
      this.loaded++;
      this.update();
    });
  }
  
  update() {
    const progress = this.loading > 0 ? this.loaded / this.loading : 1;
    console.log(`加载进度: ${Math.round(progress * 100)}%`);
    
    if (this.loaded === this.loading) {
      this.loading = 0;
      this.loaded = 0;
      console.log('所有瓦片加载完成');
    }
  }
}

const tracker = new TileLoadingTracker(tileSource);
```

## 6.3 VectorLayer 矢量图层

### 6.3.1 基础使用

```javascript
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle } from 'ol/style';

// 空矢量图层
const vectorLayer = new VectorLayer({
  source: new VectorSource()
});

// 从 GeoJSON 加载
const geojsonLayer = new VectorLayer({
  source: new VectorSource({
    url: '/data/points.geojson',
    format: new GeoJSON()
  })
});

// 带样式的矢量图层
const styledLayer = new VectorLayer({
  source: new VectorSource(),
  style: new Style({
    fill: new Fill({
      color: 'rgba(66, 133, 244, 0.3)'
    }),
    stroke: new Stroke({
      color: '#4285F4',
      width: 2
    }),
    image: new Circle({
      radius: 8,
      fill: new Fill({ color: '#4285F4' }),
      stroke: new Stroke({ color: '#fff', width: 2 })
    })
  })
});
```

### 6.3.2 矢量图层配置

```javascript
const vectorLayer = new VectorLayer({
  // 通用属性
  visible: true,
  opacity: 1.0,
  zIndex: 10,
  
  // 数据源
  source: new VectorSource(),
  
  // 样式
  style: styleFunction,
  
  // 去重叠（标注避让）
  declutter: false,
  
  // 渲染缓冲区（像素）
  renderBuffer: 100,
  
  // 动画时是否更新
  updateWhileAnimating: false,
  
  // 交互时是否更新
  updateWhileInteracting: false,
  
  // 渲染模式
  renderMode: 'vector', // 'vector' | 'image'
  
  // 自定义属性
  properties: {
    name: '业务数据',
    queryable: true
  }
});
```

### 6.3.3 动态样式

```javascript
import { Style, Fill, Stroke, Circle, Text } from 'ol/style';

// 样式函数
function styleFunction(feature, resolution) {
  const type = feature.get('type');
  const name = feature.get('name');
  
  // 根据类型返回不同样式
  const styles = {
    school: new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: '#FF5722' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      }),
      text: new Text({
        text: name,
        offsetY: -15,
        font: '12px sans-serif',
        fill: new Fill({ color: '#333' })
      })
    }),
    hospital: new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: '#E91E63' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      }),
      text: new Text({
        text: name,
        offsetY: -15,
        font: '12px sans-serif',
        fill: new Fill({ color: '#333' })
      })
    }),
    default: new Style({
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: '#9E9E9E' }),
        stroke: new Stroke({ color: '#fff', width: 1 })
      })
    })
  };
  
  return styles[type] || styles.default;
}

// 根据分辨率调整样式
function resolutionBasedStyle(feature, resolution) {
  const showLabel = resolution < 100;
  
  return new Style({
    image: new Circle({
      radius: Math.max(4, 10 - resolution / 100),
      fill: new Fill({ color: '#4285F4' })
    }),
    text: showLabel ? new Text({
      text: feature.get('name'),
      font: '12px sans-serif'
    }) : null
  });
}

const layer = new VectorLayer({
  source: vectorSource,
  style: resolutionBasedStyle
});
```

### 6.3.4 矢量图层事件

```javascript
const vectorSource = vectorLayer.getSource();

// 添加要素
vectorSource.on('addfeature', (event) => {
  console.log('添加要素:', event.feature.getId());
});

// 移除要素
vectorSource.on('removefeature', (event) => {
  console.log('移除要素:', event.feature.getId());
});

// 要素变化
vectorSource.on('changefeature', (event) => {
  console.log('要素变化:', event.feature.getId());
});

// 数据源清空
vectorSource.on('clear', () => {
  console.log('数据源已清空');
});

// 数据加载完成
vectorSource.on('featuresloadend', (event) => {
  console.log('数据加载完成, 要素数量:', event.features.length);
});
```

## 6.4 VectorTileLayer 矢量瓦片图层

### 6.4.1 基础使用

```javascript
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Style, Fill, Stroke } from 'ol/style';

// Mapbox 矢量瓦片
const vectorTileLayer = new VectorTileLayer({
  source: new VectorTileSource({
    format: new MVT(),
    url: 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.mvt?access_token=YOUR_TOKEN'
  }),
  style: createVectorTileStyle()
});

// 自托管矢量瓦片
const selfHostedVT = new VectorTileLayer({
  source: new VectorTileSource({
    format: new MVT(),
    url: '/tiles/{z}/{x}/{y}.pbf',
    maxZoom: 14
  })
});
```

### 6.4.2 矢量瓦片样式

```javascript
// 创建矢量瓦片样式
function createVectorTileStyle() {
  return function(feature, resolution) {
    const layer = feature.get('layer');
    const type = feature.getGeometry().getType();
    
    // 根据图层名称返回样式
    switch (layer) {
      case 'water':
        return new Style({
          fill: new Fill({ color: '#9CC0F9' })
        });
        
      case 'landcover':
        return new Style({
          fill: new Fill({ color: '#E8F5E9' })
        });
        
      case 'road':
        return new Style({
          stroke: new Stroke({
            color: '#FFFFFF',
            width: type === 'LineString' ? 2 : 1
          })
        });
        
      case 'building':
        return new Style({
          fill: new Fill({ color: '#D7CCC8' }),
          stroke: new Stroke({ color: '#BCAAA4', width: 1 })
        });
        
      case 'place_label':
        return new Style({
          text: new Text({
            text: feature.get('name'),
            font: '12px sans-serif',
            fill: new Fill({ color: '#333' })
          })
        });
        
      default:
        return null;
    }
  };
}

// 使用 OpenLayers 的样式 JSON（类似 Mapbox Style）
import { applyStyle } from 'ol-mapbox-style';

const vectorTileLayer = new VectorTileLayer({
  declutter: true
});

applyStyle(vectorTileLayer, 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY');
```

## 6.5 ImageLayer 图像图层

### 6.5.1 基础使用

```javascript
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import Static from 'ol/source/ImageStatic';
import { transformExtent } from 'ol/proj';

// WMS 图像图层
const wmsImageLayer = new ImageLayer({
  source: new ImageWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: {
      'LAYERS': 'workspace:layer'
    },
    serverType: 'geoserver',
    ratio: 1 // 请求图像大小与视口的比例
  })
});

// 静态图像图层
const imageExtent = transformExtent(
  [115.0, 39.0, 118.0, 41.0],
  'EPSG:4326',
  'EPSG:3857'
);

const staticImageLayer = new ImageLayer({
  source: new Static({
    url: '/images/overlay.png',
    imageExtent: imageExtent
  })
});
```

### 6.5.2 图像图层应用

```javascript
// 历史地图叠加
const historicalMap = new ImageLayer({
  source: new Static({
    url: '/images/historical_map_1950.jpg',
    imageExtent: mapExtent,
    projection: 'EPSG:3857'
  }),
  opacity: 0.7
});

// 带透明度控制的叠加
function createOverlayWithSlider(imageUrl, extent) {
  const layer = new ImageLayer({
    source: new Static({
      url: imageUrl,
      imageExtent: extent
    }),
    opacity: 0.5
  });
  
  // 创建透明度滑块
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.1';
  slider.value = '0.5';
  
  slider.addEventListener('input', () => {
    layer.setOpacity(parseFloat(slider.value));
  });
  
  document.getElementById('controls').appendChild(slider);
  
  return layer;
}
```

## 6.6 Heatmap 热力图层

### 6.6.1 基础使用

```javascript
import Heatmap from 'ol/layer/Heatmap';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';

// 创建热力图层
const heatmapLayer = new Heatmap({
  source: new VectorSource(),
  
  // 热力图配置
  blur: 15,      // 模糊半径
  radius: 8,     // 点半径
  
  // 权重属性名或函数
  weight: 'weight', // 使用要素的 weight 属性
  // weight: function(feature) { return feature.get('magnitude'); }
  
  // 颜色渐变
  gradient: ['#00f', '#0ff', '#0f0', '#ff0', '#f00']
});

// 添加热力点数据
function addHeatmapPoint(lon, lat, weight = 1) {
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    weight: weight
  });
  heatmapLayer.getSource().addFeature(feature);
}

// 批量添加数据
const heatData = [
  { lon: 116.4074, lat: 39.9042, weight: 1.0 },
  { lon: 116.4174, lat: 39.9142, weight: 0.8 },
  { lon: 116.3974, lat: 39.8942, weight: 0.6 }
];

heatData.forEach(d => addHeatmapPoint(d.lon, d.lat, d.weight));
```

### 6.6.2 热力图配置

```javascript
// 高级热力图配置
const advancedHeatmap = new Heatmap({
  source: vectorSource,
  
  // 模糊半径（像素）
  blur: 20,
  
  // 点半径（像素）
  radius: 10,
  
  // 权重函数
  weight: function(feature) {
    const value = feature.get('value');
    // 归一化到 0-1
    return Math.min(value / 100, 1);
  },
  
  // 自定义颜色渐变
  gradient: [
    'rgba(0, 0, 255, 0)',    // 透明蓝
    'rgba(0, 255, 255, 0.5)', // 半透明青
    'rgba(0, 255, 0, 0.7)',   // 半透明绿
    'rgba(255, 255, 0, 0.8)', // 半透明黄
    'rgba(255, 0, 0, 1)'      // 不透明红
  ],
  
  // 可见性控制
  visible: true,
  opacity: 0.8,
  
  // 缩放限制
  minZoom: 5,
  maxZoom: 18
});

// 动态调整热力图参数
function updateHeatmapParams(params) {
  if (params.blur !== undefined) {
    advancedHeatmap.setBlur(params.blur);
  }
  if (params.radius !== undefined) {
    advancedHeatmap.setRadius(params.radius);
  }
  if (params.gradient !== undefined) {
    advancedHeatmap.setGradient(params.gradient);
  }
}
```

## 6.7 LayerGroup 图层组

### 6.7.1 基础使用

```javascript
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

// 底图组
const basemapGroup = new LayerGroup({
  layers: [
    new TileLayer({
      source: new OSM(),
      visible: true,
      properties: { name: 'osm' }
    }),
    new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      }),
      visible: false,
      properties: { name: 'satellite' }
    })
  ],
  properties: {
    name: 'basemaps',
    title: '底图'
  }
});

// 业务图层组
const overlayGroup = new LayerGroup({
  layers: [
    new VectorLayer({ source: pointSource, properties: { name: 'points' } }),
    new VectorLayer({ source: lineSource, properties: { name: 'lines' } }),
    new VectorLayer({ source: polygonSource, properties: { name: 'polygons' } })
  ],
  properties: {
    name: 'overlays',
    title: '业务图层'
  }
});

// 添加到地图
map.addLayer(basemapGroup);
map.addLayer(overlayGroup);
```

### 6.7.2 图层组操作

```javascript
// 获取图层组中的图层
const layers = basemapGroup.getLayers();

// 切换底图
function switchBasemap(groupName, layerName) {
  const group = findLayerByName(map, groupName);
  if (group instanceof LayerGroup) {
    group.getLayers().forEach(layer => {
      layer.setVisible(layer.get('name') === layerName);
    });
  }
}

switchBasemap('basemaps', 'satellite');

// 遍历所有图层（包括嵌套）
function forEachLayer(layerGroup, callback, depth = 0) {
  layerGroup.getLayers().forEach(layer => {
    callback(layer, depth);
    if (layer instanceof LayerGroup) {
      forEachLayer(layer, callback, depth + 1);
    }
  });
}

forEachLayer(map, (layer, depth) => {
  console.log('  '.repeat(depth) + layer.get('name'));
});

// 设置图层组可见性（影响所有子图层）
overlayGroup.setVisible(false);

// 设置图层组透明度（影响所有子图层）
overlayGroup.setOpacity(0.8);

// 向图层组添加图层
overlayGroup.getLayers().push(newLayer);

// 从图层组移除图层
overlayGroup.getLayers().remove(existingLayer);
```

### 6.7.3 图层目录树

```javascript
// 构建图层目录树
class LayerTree {
  constructor(map, container) {
    this.map = map;
    this.container = container;
    this.build();
  }
  
  build() {
    this.container.innerHTML = '';
    this.buildNode(this.map, this.container, 0);
  }
  
  buildNode(layerGroup, parentElement, depth) {
    layerGroup.getLayers().forEach(layer => {
      const item = this.createLayerItem(layer, depth);
      parentElement.appendChild(item);
      
      if (layer instanceof LayerGroup) {
        const childContainer = document.createElement('div');
        childContainer.className = 'layer-children';
        item.appendChild(childContainer);
        this.buildNode(layer, childContainer, depth + 1);
      }
    });
  }
  
  createLayerItem(layer, depth) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.style.paddingLeft = `${depth * 20}px`;
    
    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = layer.getVisible();
    checkbox.addEventListener('change', () => {
      layer.setVisible(checkbox.checked);
    });
    
    // 标签
    const label = document.createElement('span');
    label.textContent = layer.get('name') || layer.get('title') || 'Unnamed';
    
    // 透明度滑块
    const opacity = document.createElement('input');
    opacity.type = 'range';
    opacity.min = '0';
    opacity.max = '1';
    opacity.step = '0.1';
    opacity.value = layer.getOpacity();
    opacity.addEventListener('input', () => {
      layer.setOpacity(parseFloat(opacity.value));
    });
    
    item.appendChild(checkbox);
    item.appendChild(label);
    item.appendChild(opacity);
    
    // 监听图层变化
    layer.on('change:visible', () => {
      checkbox.checked = layer.getVisible();
    });
    
    layer.on('change:opacity', () => {
      opacity.value = layer.getOpacity();
    });
    
    return item;
  }
}

const layerTree = new LayerTree(map, document.getElementById('layer-tree'));
```

## 6.8 图层管理

### 6.8.1 图层查找

```javascript
// 按名称查找图层
function findLayerByName(mapOrGroup, name) {
  let result = null;
  const layers = mapOrGroup.getLayers ? mapOrGroup.getLayers() : mapOrGroup;
  
  layers.forEach(layer => {
    if (layer.get('name') === name) {
      result = layer;
    } else if (layer instanceof LayerGroup && !result) {
      result = findLayerByName(layer, name);
    }
  });
  
  return result;
}

// 按类型查找图层
function findLayersByType(map, LayerClass) {
  const result = [];
  
  function search(layerGroup) {
    layerGroup.getLayers().forEach(layer => {
      if (layer instanceof LayerClass) {
        result.push(layer);
      }
      if (layer instanceof LayerGroup) {
        search(layer);
      }
    });
  }
  
  search(map);
  return result;
}

const vectorLayers = findLayersByType(map, VectorLayer);

// 按条件查找图层
function findLayersWhere(map, predicate) {
  const result = [];
  
  function search(layerGroup) {
    layerGroup.getLayers().forEach(layer => {
      if (predicate(layer)) {
        result.push(layer);
      }
      if (layer instanceof LayerGroup) {
        search(layer);
      }
    });
  }
  
  search(map);
  return result;
}

// 查找所有可查询图层
const queryableLayers = findLayersWhere(map, layer => layer.get('queryable') === true);
```

### 6.8.2 图层排序

```javascript
// 通过 zIndex 控制图层顺序
baseLayer.setZIndex(0);
overlayLayer.setZIndex(10);
labelLayer.setZIndex(100);

// 将图层移到最上层
function bringToFront(map, layer) {
  const maxZIndex = Math.max(...map.getLayers().getArray().map(l => l.getZIndex() || 0));
  layer.setZIndex(maxZIndex + 1);
}

// 将图层移到最下层
function sendToBack(map, layer) {
  const minZIndex = Math.min(...map.getLayers().getArray().map(l => l.getZIndex() || 0));
  layer.setZIndex(minZIndex - 1);
}

// 交换两个图层的顺序
function swapLayers(layer1, layer2) {
  const z1 = layer1.getZIndex() || 0;
  const z2 = layer2.getZIndex() || 0;
  layer1.setZIndex(z2);
  layer2.setZIndex(z1);
}

// 按数组顺序重排图层
function reorderLayers(map, orderedLayers) {
  orderedLayers.forEach((layer, index) => {
    layer.setZIndex(index);
  });
}
```

### 6.8.3 图层可见性管理

```javascript
// 图层可见性控制器
class LayerVisibilityManager {
  constructor(map) {
    this.map = map;
    this.states = new Map();
  }
  
  // 保存当前状态
  saveState(key) {
    const state = new Map();
    this.forEachLayer(layer => {
      state.set(layer, layer.getVisible());
    });
    this.states.set(key, state);
  }
  
  // 恢复状态
  restoreState(key) {
    const state = this.states.get(key);
    if (state) {
      state.forEach((visible, layer) => {
        layer.setVisible(visible);
      });
    }
  }
  
  // 隐藏所有图层
  hideAll() {
    this.forEachLayer(layer => {
      layer.setVisible(false);
    });
  }
  
  // 显示所有图层
  showAll() {
    this.forEachLayer(layer => {
      layer.setVisible(true);
    });
  }
  
  // 仅显示指定图层
  showOnly(layerNames) {
    this.forEachLayer(layer => {
      layer.setVisible(layerNames.includes(layer.get('name')));
    });
  }
  
  // 切换图层可见性
  toggle(layerName) {
    const layer = findLayerByName(this.map, layerName);
    if (layer) {
      layer.setVisible(!layer.getVisible());
    }
  }
  
  forEachLayer(callback) {
    function traverse(layerGroup) {
      layerGroup.getLayers().forEach(layer => {
        callback(layer);
        if (layer instanceof LayerGroup) {
          traverse(layer);
        }
      });
    }
    traverse(this.map);
  }
}

const visibilityManager = new LayerVisibilityManager(map);

// 保存当前状态
visibilityManager.saveState('default');

// 仅显示特定图层
visibilityManager.showOnly(['basemap', 'points']);

// 恢复默认状态
visibilityManager.restoreState('default');
```

## 6.9 本章小结

本章详细介绍了 OpenLayers 的图层体系：

1. **图层概述**：图层概念、类型、基类属性
2. **TileLayer**：瓦片图层配置、加载事件
3. **VectorLayer**：矢量图层配置、动态样式
4. **VectorTileLayer**：矢量瓦片加载与样式
5. **ImageLayer**：WMS 图像、静态图像
6. **Heatmap**：热力图配置与使用
7. **LayerGroup**：图层组管理、图层目录树
8. **图层管理**：查找、排序、可见性控制

### 关键要点

- 理解不同图层类型的适用场景
- 掌握图层的通用属性和方法
- 使用 LayerGroup 组织图层
- 实现动态样式和事件监听

### 下一步

在下一章中，我们将详细学习 Source 数据源，包括：
- 瓦片数据源详解
- 矢量数据源详解
- 数据加载策略
- 数据源事件

---

[← 上一章：View视图与坐标系统](第05章-View视图与坐标系统) | [返回目录](README) | [下一章：Source数据源详解 →](第07章-Source数据源详解)

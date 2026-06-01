---
layout: default
title: 第16章 - OGC服务集成
---

# 第16章 - OGC 服务集成

## 16.1 WMS 服务

### 16.1.1 WMS 图层

```javascript
import TileWMS from 'ol/source/TileWMS';
import ImageWMS from 'ol/source/ImageWMS';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';

// 瓦片 WMS
const wmsLayer = new TileLayer({
  source: new TileWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: {
      'LAYERS': 'workspace:layer',
      'TILED': true,
      'FORMAT': 'image/png'
    },
    serverType: 'geoserver'
  })
});

// 图像 WMS
const imageWmsLayer = new ImageLayer({
  source: new ImageWMS({
    url: 'http://localhost:8080/geoserver/wms',
    params: { 'LAYERS': 'workspace:layer' },
    ratio: 1,
    serverType: 'geoserver'
  })
});
```

### 16.1.2 GetFeatureInfo

```javascript
map.on('singleclick', async (event) => {
  const source = wmsLayer.getSource();
  const url = source.getFeatureInfoUrl(
    event.coordinate,
    map.getView().getResolution(),
    'EPSG:3857',
    { 'INFO_FORMAT': 'application/json' }
  );
  
  if (url) {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features?.length > 0) {
      showPopup(event.coordinate, data.features);
    }
  }
});
```

### 16.1.3 动态过滤

```javascript
// CQL 过滤
function setWMSFilter(source, filter) {
  source.updateParams({ 'CQL_FILTER': filter });
}

setWMSFilter(wmsSource, "type = 'commercial' AND area > 1000");

// SLD 样式
function setWMSStyle(source, sldBody) {
  source.updateParams({ 'SLD_BODY': sldBody });
}

// 时间过滤
function setWMSTime(source, time) {
  source.updateParams({ 'TIME': time });
}

setWMSTime(wmsSource, '2024-01-01');
```

## 16.2 WFS 服务

### 16.2.1 加载 WFS 数据

```javascript
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';

// 基本 WFS
const wfsSource = new VectorSource({
  format: new GeoJSON(),
  url: function(extent) {
    return 'http://localhost:8080/geoserver/wfs?' +
      'service=WFS&version=1.1.0&request=GetFeature&' +
      'typename=workspace:layer&' +
      'outputFormat=application/json&' +
      'srsname=EPSG:3857&' +
      'bbox=' + extent.join(',') + ',EPSG:3857';
  },
  strategy: bboxStrategy
});

const wfsLayer = new VectorLayer({
  source: wfsSource,
  style: vectorStyle
});
```

### 16.2.2 WFS 事务

```javascript
import WFS from 'ol/format/WFS';
import GML from 'ol/format/GML';

const wfsFormat = new WFS();

// 插入要素
async function insertFeature(feature) {
  const xml = wfsFormat.writeTransaction([feature], null, null, {
    featureNS: 'http://geoserver.org',
    featurePrefix: 'workspace',
    featureType: 'layer',
    srsName: 'EPSG:3857'
  });
  
  const response = await fetch('http://localhost:8080/geoserver/wfs', {
    method: 'POST',
    body: new XMLSerializer().serializeToString(xml)
  });
  
  return response.ok;
}

// 更新要素
async function updateFeature(feature) {
  const xml = wfsFormat.writeTransaction(null, [feature], null, {
    featureNS: 'http://geoserver.org',
    featurePrefix: 'workspace',
    featureType: 'layer',
    srsName: 'EPSG:3857'
  });
  
  return fetch('http://localhost:8080/geoserver/wfs', {
    method: 'POST',
    body: new XMLSerializer().serializeToString(xml)
  });
}

// 删除要素
async function deleteFeature(feature) {
  const xml = wfsFormat.writeTransaction(null, null, [feature], {
    featureNS: 'http://geoserver.org',
    featurePrefix: 'workspace',
    featureType: 'layer'
  });
  
  return fetch('http://localhost:8080/geoserver/wfs', {
    method: 'POST',
    body: new XMLSerializer().serializeToString(xml)
  });
}
```

## 16.3 WMTS 服务

### 16.3.1 WMTS 配置

```javascript
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';

// 从 Capabilities 自动配置
async function createWMTSLayer(capabilitiesUrl, layerName) {
  const response = await fetch(capabilitiesUrl);
  const text = await response.text();
  
  const parser = new WMTSCapabilities();
  const capabilities = parser.read(text);
  
  const options = optionsFromCapabilities(capabilities, {
    layer: layerName,
    matrixSet: 'EPSG:3857'
  });
  
  return new TileLayer({
    source: new WMTS(options)
  });
}

// 使用
const wmtsLayer = await createWMTSLayer(
  'http://localhost:8080/geoserver/gwc/service/wmts?REQUEST=GetCapabilities',
  'workspace:layer'
);
map.addLayer(wmtsLayer);
```

## 16.4 GeoServer 集成

### 16.4.1 REST API

```javascript
class GeoServerClient {
  constructor(baseUrl, auth) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': 'Basic ' + btoa(auth.username + ':' + auth.password),
      'Content-Type': 'application/json'
    };
  }
  
  // 获取图层列表
  async getLayers(workspace) {
    const response = await fetch(
      `${this.baseUrl}/rest/workspaces/${workspace}/layers.json`,
      { headers: this.headers }
    );
    return response.json();
  }
  
  // 获取图层详情
  async getLayer(workspace, layer) {
    const response = await fetch(
      `${this.baseUrl}/rest/workspaces/${workspace}/layers/${layer}.json`,
      { headers: this.headers }
    );
    return response.json();
  }
  
  // 获取样式
  async getStyles() {
    const response = await fetch(
      `${this.baseUrl}/rest/styles.json`,
      { headers: this.headers }
    );
    return response.json();
  }
  
  // 上传样式
  async uploadStyle(name, sld) {
    await fetch(`${this.baseUrl}/rest/styles`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/vnd.ogc.sld+xml' },
      body: sld
    });
  }
}

const geoserver = new GeoServerClient('http://localhost:8080/geoserver', {
  username: 'admin',
  password: 'geoserver'
});
```

### 16.4.2 图例获取

```javascript
function getWMSLegendUrl(baseUrl, layerName, options = {}) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetLegendGraphic',
    LAYER: layerName,
    FORMAT: options.format || 'image/png',
    WIDTH: options.width || 20,
    HEIGHT: options.height || 20,
    ...options.extraParams
  });
  
  return `${baseUrl}?${params.toString()}`;
}

// 创建图例元素
function createLegend(layers) {
  const container = document.createElement('div');
  container.className = 'legend';
  
  layers.forEach(layer => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    
    const img = document.createElement('img');
    img.src = getWMSLegendUrl(
      'http://localhost:8080/geoserver/wms',
      layer.name
    );
    
    const label = document.createElement('span');
    label.textContent = layer.title;
    
    item.appendChild(img);
    item.appendChild(label);
    container.appendChild(item);
  });
  
  return container;
}
```

## 16.5 本章小结

本章介绍了 OGC 服务集成：

1. **WMS 服务**：图层加载、GetFeatureInfo、动态过滤
2. **WFS 服务**：数据加载、事务操作
3. **WMTS 服务**：Capabilities 解析
4. **GeoServer 集成**：REST API、图例

### 关键要点

- WMS 适合栅格显示和简单查询
- WFS 支持矢量编辑和复杂查询
- WMTS 适合高性能瓦片服务
- 使用 GeoServer REST API 管理服务

---

[← 上一章：要素编辑与绘制](第15章-要素编辑与绘制) | [返回目录](index) | [下一章：性能优化与最佳实践 →](第17章-性能优化与最佳实践)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第15章-要素编辑与绘制" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第17章-性能优化与最佳实践" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

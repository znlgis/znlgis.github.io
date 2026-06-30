---
layout: default
title: 第10章 - Control控件系统
---

# 第10章 - Control 控件系统

## 10.1 控件概述

控件（Control）是显示在地图上的用户界面元素，用于提供地图交互功能。OpenLayers 提供多种内置控件，同时支持自定义控件。

### 10.1.1 内置控件

```javascript
import {
  defaults as defaultControls,
  Attribution,
  FullScreen,
  MousePosition,
  OverviewMap,
  Rotate,
  ScaleLine,
  Zoom,
  ZoomSlider,
  ZoomToExtent
} from 'ol/control';

// 默认控件（缩放 + 旋转 + 版权）
const map = new Map({
  controls: defaultControls()
});

// 禁用部分默认控件
const map2 = new Map({
  controls: defaultControls({
    zoom: true,
    rotate: false,
    attribution: false
  })
});

// 扩展默认控件
const map3 = new Map({
  controls: defaultControls().extend([
    new ScaleLine(),
    new FullScreen()
  ])
});
```

### 10.1.2 缩放控件

```javascript
import { Zoom, ZoomSlider, ZoomToExtent } from 'ol/control';

// 基本缩放控件
const zoom = new Zoom({
  className: 'ol-zoom',
  zoomInLabel: '+',
  zoomOutLabel: '−',
  zoomInTipLabel: '放大',
  zoomOutTipLabel: '缩小',
  delta: 1,
  duration: 250,
  target: undefined
});

// 缩放滑块
const zoomSlider = new ZoomSlider({
  className: 'ol-zoomslider',
  duration: 200
});

// 缩放到范围
const zoomToExtent = new ZoomToExtent({
  extent: [12800000, 4700000, 13200000, 5000000],
  label: '⌂',
  tipLabel: '缩放到全图'
});

map.addControl(zoom);
map.addControl(zoomSlider);
map.addControl(zoomToExtent);
```

### 10.1.3 比例尺控件

```javascript
import { ScaleLine } from 'ol/control';

// 基本比例尺
const scaleLine = new ScaleLine({
  units: 'metric',     // 'metric', 'imperial', 'nautical', 'us', 'degrees'
  bar: false,
  steps: 4,
  text: true,
  minWidth: 64,
  maxWidth: 150,
  target: undefined
});

// 条形比例尺
const barScaleLine = new ScaleLine({
  units: 'metric',
  bar: true,
  steps: 4,
  text: true,
  minWidth: 140
});

map.addControl(scaleLine);
```

### 10.1.4 鼠标位置控件

```javascript
import { MousePosition } from 'ol/control';
import { createStringXY, toStringHDMS } from 'ol/coordinate';
import { toLonLat } from 'ol/proj';

// 显示经纬度
const mousePosition = new MousePosition({
  coordinateFormat: function(coordinate) {
    const lonLat = toLonLat(coordinate);
    return `经度: ${lonLat[0].toFixed(6)}, 纬度: ${lonLat[1].toFixed(6)}`;
  },
  projection: 'EPSG:3857',
  className: 'custom-mouse-position',
  target: document.getElementById('mouse-position'),
  placeholder: '移动鼠标显示坐标'
});

// 显示度分秒格式
const dmsMousePosition = new MousePosition({
  coordinateFormat: function(coordinate) {
    const lonLat = toLonLat(coordinate);
    return toStringHDMS(lonLat);
  },
  projection: 'EPSG:3857'
});

map.addControl(mousePosition);
```

### 10.1.5 鹰眼控件

```javascript
import { OverviewMap } from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

const overviewMap = new OverviewMap({
  collapsed: true,
  collapsible: true,
  label: '»',
  collapseLabel: '«',
  tipLabel: '鹰眼',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    projection: 'EPSG:3857',
    maxZoom: 8,
    minZoom: 2
  })
});

map.addControl(overviewMap);
```

### 10.1.6 全屏控件

```javascript
import { FullScreen } from 'ol/control';

const fullScreen = new FullScreen({
  className: 'ol-full-screen',
  label: '⤢',
  labelActive: '×',
  tipLabel: '全屏',
  keys: true,
  source: undefined
});

// 监听全屏状态变化
fullScreen.on('enterfullscreen', () => {
  console.log('进入全屏');
});

fullScreen.on('leavefullscreen', () => {
  console.log('退出全屏');
});

map.addControl(fullScreen);
```

## 10.2 自定义控件

### 10.2.1 基础自定义控件

```javascript
import Control from 'ol/control/Control';

// 创建自定义控件类
class CustomControl extends Control {
  constructor(options = {}) {
    const element = document.createElement('div');
    element.className = 'custom-control ol-unselectable ol-control';
    
    super({
      element: element,
      target: options.target
    });
    
    this.options = options;
    this.render();
  }
  
  render() {
    const button = document.createElement('button');
    button.innerHTML = this.options.label || '⚙';
    button.title = this.options.tipLabel || '自定义控件';
    
    button.addEventListener('click', () => {
      this.handleClick();
    });
    
    this.element.appendChild(button);
  }
  
  handleClick() {
    if (this.options.onClick) {
      this.options.onClick(this.getMap());
    }
  }
}

// 使用自定义控件
const myControl = new CustomControl({
  label: '📍',
  tipLabel: '定位到当前位置',
  onClick: (map) => {
    navigator.geolocation.getCurrentPosition((position) => {
      const coords = fromLonLat([
        position.coords.longitude,
        position.coords.latitude
      ]);
      map.getView().animate({
        center: coords,
        zoom: 15,
        duration: 1000
      });
    });
  }
});

map.addControl(myControl);
```

### 10.2.2 图层切换控件

```javascript
class LayerSwitcher extends Control {
  constructor(options = {}) {
    const element = document.createElement('div');
    element.className = 'layer-switcher ol-unselectable ol-control';
    
    super({
      element: element,
      target: options.target
    });
    
    this.panel = null;
    this.expanded = false;
    
    this.createButton();
  }
  
  createButton() {
    const button = document.createElement('button');
    button.innerHTML = '☰';
    button.title = '图层控制';
    button.addEventListener('click', () => this.toggle());
    this.element.appendChild(button);
  }
  
  toggle() {
    this.expanded = !this.expanded;
    
    if (this.expanded) {
      this.showPanel();
    } else {
      this.hidePanel();
    }
  }
  
  showPanel() {
    if (!this.panel) {
      this.panel = document.createElement('div');
      this.panel.className = 'layer-panel';
      this.element.appendChild(this.panel);
    }
    
    this.panel.innerHTML = '';
    this.buildLayerList(this.getMap().getLayers(), this.panel);
    this.panel.style.display = 'block';
  }
  
  hidePanel() {
    if (this.panel) {
      this.panel.style.display = 'none';
    }
  }
  
  buildLayerList(layers, container, depth = 0) {
    layers.forEach((layer) => {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.style.paddingLeft = `${depth * 15}px`;
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = layer.getVisible();
      checkbox.addEventListener('change', () => {
        layer.setVisible(checkbox.checked);
      });
      
      const label = document.createElement('span');
      label.textContent = layer.get('name') || 'Unnamed';
      
      item.appendChild(checkbox);
      item.appendChild(label);
      container.appendChild(item);
      
      if (layer instanceof LayerGroup) {
        this.buildLayerList(layer.getLayers(), container, depth + 1);
      }
    });
  }
}
```

### 10.2.3 测量控件

```javascript
class MeasureControl extends Control {
  constructor(options = {}) {
    const element = document.createElement('div');
    element.className = 'measure-control ol-unselectable ol-control';
    
    super({
      element: element,
      target: options.target
    });
    
    this.vectorSource = new VectorSource();
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: this.createStyle()
    });
    
    this.draw = null;
    this.measureType = null;
    
    this.createButtons();
  }
  
  createButtons() {
    // 距离测量按钮
    const distanceBtn = document.createElement('button');
    distanceBtn.innerHTML = '📏';
    distanceBtn.title = '距离测量';
    distanceBtn.addEventListener('click', () => this.startMeasure('LineString'));
    
    // 面积测量按钮
    const areaBtn = document.createElement('button');
    areaBtn.innerHTML = '⬜';
    areaBtn.title = '面积测量';
    areaBtn.addEventListener('click', () => this.startMeasure('Polygon'));
    
    // 清除按钮
    const clearBtn = document.createElement('button');
    clearBtn.innerHTML = '🗑';
    clearBtn.title = '清除测量';
    clearBtn.addEventListener('click', () => this.clear());
    
    this.element.appendChild(distanceBtn);
    this.element.appendChild(areaBtn);
    this.element.appendChild(clearBtn);
  }
  
  setMap(map) {
    super.setMap(map);
    if (map) {
      map.addLayer(this.vectorLayer);
    }
  }
  
  startMeasure(type) {
    const map = this.getMap();
    
    if (this.draw) {
      map.removeInteraction(this.draw);
    }
    
    this.measureType = type;
    
    this.draw = new Draw({
      source: this.vectorSource,
      type: type,
      style: this.createStyle()
    });
    
    this.draw.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const result = this.formatMeasure(geometry);
      console.log('测量结果:', result);
      
      // 添加标注
      event.feature.set('measurement', result);
    });
    
    map.addInteraction(this.draw);
  }
  
  formatMeasure(geometry) {
    const type = geometry.getType();
    
    if (type === 'LineString') {
      const length = getLength(geometry);
      if (length > 1000) {
        return `${(length / 1000).toFixed(2)} km`;
      }
      return `${length.toFixed(2)} m`;
    }
    
    if (type === 'Polygon') {
      const area = getArea(geometry);
      if (area > 1000000) {
        return `${(area / 1000000).toFixed(2)} km²`;
      }
      return `${area.toFixed(2)} m²`;
    }
    
    return '';
  }
  
  createStyle() {
    return new Style({
      fill: new Fill({
        color: 'rgba(66, 133, 244, 0.2)'
      }),
      stroke: new Stroke({
        color: '#4285F4',
        width: 2
      }),
      image: new Circle({
        radius: 5,
        fill: new Fill({ color: '#4285F4' })
      })
    });
  }
  
  clear() {
    this.vectorSource.clear();
    if (this.draw) {
      this.getMap().removeInteraction(this.draw);
      this.draw = null;
    }
  }
}
```

### 10.2.4 工具栏控件

```javascript
class Toolbar extends Control {
  constructor(options = {}) {
    const element = document.createElement('div');
    element.className = 'toolbar ol-unselectable ol-control';
    
    super({
      element: element,
      target: options.target
    });
    
    this.tools = new Map();
    this.activeTool = null;
    
    if (options.tools) {
      options.tools.forEach(tool => this.addTool(tool));
    }
  }
  
  addTool(tool) {
    const button = document.createElement('button');
    button.innerHTML = tool.icon;
    button.title = tool.title;
    button.dataset.toolId = tool.id;
    
    button.addEventListener('click', () => {
      this.activateTool(tool.id);
    });
    
    this.element.appendChild(button);
    this.tools.set(tool.id, tool);
  }
  
  activateTool(toolId) {
    // 停用当前工具
    if (this.activeTool) {
      this.deactivateTool(this.activeTool);
    }
    
    // 激活新工具
    const tool = this.tools.get(toolId);
    if (tool && tool.activate) {
      tool.activate(this.getMap());
      this.activeTool = toolId;
      
      // 更新按钮状态
      this.element.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.toolId === toolId);
      });
    }
  }
  
  deactivateTool(toolId) {
    const tool = this.tools.get(toolId);
    if (tool && tool.deactivate) {
      tool.deactivate(this.getMap());
    }
    this.activeTool = null;
  }
}

// 使用工具栏
const toolbar = new Toolbar({
  tools: [
    {
      id: 'pan',
      icon: '✋',
      title: '平移',
      activate: (map) => { /* 默认行为 */ },
      deactivate: (map) => {}
    },
    {
      id: 'draw-point',
      icon: '📍',
      title: '绘制点',
      activate: (map) => {
        const draw = new Draw({ source: vectorSource, type: 'Point' });
        map.addInteraction(draw);
        map.set('currentDraw', draw);
      },
      deactivate: (map) => {
        const draw = map.get('currentDraw');
        if (draw) map.removeInteraction(draw);
      }
    }
  ]
});

map.addControl(toolbar);
```

## 10.3 控件样式

### 10.3.1 CSS 样式定制

```css
/* 自定义控件样式 */
.custom-control {
  position: absolute;
  top: 10px;
  right: 10px;
}

.custom-control button {
  width: 32px;
  height: 32px;
  background: white;
  border: none;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  font-size: 16px;
}

.custom-control button:hover {
  background: #f5f5f5;
}

.custom-control button.active {
  background: #4285F4;
  color: white;
}

/* 图层切换器样式 */
.layer-switcher {
  position: absolute;
  top: 10px;
  right: 50px;
}

.layer-panel {
  position: absolute;
  right: 0;
  top: 40px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 10px;
  min-width: 200px;
}

.layer-item {
  display: flex;
  align-items: center;
  padding: 5px 0;
}

.layer-item input {
  margin-right: 8px;
}

/* 测量控件样式 */
.measure-control {
  position: absolute;
  bottom: 30px;
  left: 10px;
  display: flex;
  gap: 5px;
}

.measure-control button {
  width: 36px;
  height: 36px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

/* 工具栏样式 */
.toolbar {
  position: absolute;
  top: 60px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
```

## 10.4 本章小结

本章介绍了 OpenLayers 的控件系统：

1. **内置控件**：缩放、比例尺、鼠标位置、鹰眼、全屏
2. **自定义控件**：基础控件、图层切换、测量、工具栏
3. **控件样式**：CSS 定制

### 关键要点

- 继承 Control 类创建自定义控件
- 控件通过 element 属性渲染 DOM
- 使用 CSS 定制控件外观

---

[← 上一章：栅格数据与瓦片服务](../第09章-栅格数据与瓦片服务) | [返回目录](../index) | [下一章：Interaction交互系统 →](../第11章-Interaction交互系统)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第09章-栅格数据与瓦片服务" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第11章-Interaction交互系统" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

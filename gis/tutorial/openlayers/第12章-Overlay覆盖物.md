---
layout: default
title: 第12章 - Overlay覆盖物
---

# 第12章 - Overlay 覆盖物

## 12.1 Overlay 概述

Overlay（覆盖物）用于在地图上显示 HTML 元素，常用于弹出框、标注、工具提示等。与 Control 不同，Overlay 的位置与地图坐标关联，会随地图移动。

### 12.1.1 基本使用

```javascript
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';

// 创建弹出框元素
const popup = document.createElement('div');
popup.className = 'ol-popup';
popup.innerHTML = `
  <a href="#" class="ol-popup-closer"></a>
  <div class="ol-popup-content">Hello World!</div>
`;
document.body.appendChild(popup);

// 创建 Overlay
const overlay = new Overlay({
  element: popup,
  positioning: 'bottom-center',
  offset: [0, -10],
  autoPan: true,
  autoPanAnimation: {
    duration: 250
  }
});

// 添加到地图
map.addOverlay(overlay);

// 设置位置
overlay.setPosition(fromLonLat([116.4074, 39.9042]));

// 隐藏 Overlay
overlay.setPosition(undefined);
```

### 12.1.2 配置选项

```javascript
const overlay = new Overlay({
  // 关联的 HTML 元素
  element: document.getElementById('popup'),
  
  // 唯一标识
  id: 'popup-1',
  
  // 定位方式
  positioning: 'bottom-center',
  // 可选值: 'bottom-left', 'bottom-center', 'bottom-right',
  //        'center-left', 'center-center', 'center-right',
  //        'top-left', 'top-center', 'top-right'
  
  // 偏移量 [x, y]
  offset: [0, -10],
  
  // 是否插入到地图视口
  insertFirst: true,
  
  // 是否随地图平移
  stopEvent: true,
  
  // 自动平移
  autoPan: {
    animation: {
      duration: 250
    },
    margin: 20
  },
  
  // CSS 类名
  className: 'ol-overlay-container ol-selectable'
});
```

## 12.2 弹出框

### 12.2.1 信息弹出框

```javascript
class Popup extends Overlay {
  constructor(options = {}) {
    const element = document.createElement('div');
    element.className = 'popup';
    
    super({
      element: element,
      positioning: options.positioning || 'bottom-center',
      offset: options.offset || [0, -10],
      autoPan: {
        animation: { duration: 250 }
      }
    });
    
    this.content = document.createElement('div');
    this.content.className = 'popup-content';
    
    const closer = document.createElement('button');
    closer.className = 'popup-closer';
    closer.innerHTML = '×';
    closer.addEventListener('click', () => this.hide());
    
    element.appendChild(closer);
    element.appendChild(this.content);
  }
  
  show(coordinate, html) {
    this.content.innerHTML = html;
    this.setPosition(coordinate);
  }
  
  hide() {
    this.setPosition(undefined);
  }
}

// 使用示例
const popup = new Popup();
map.addOverlay(popup);

map.on('singleclick', (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, f => f);
  
  if (feature) {
    popup.show(event.coordinate, `
      <h3>${feature.get('name')}</h3>
      <p>${feature.get('description')}</p>
    `);
  } else {
    popup.hide();
  }
});
```

### 12.2.2 工具提示

```javascript
class Tooltip extends Overlay {
  constructor() {
    const element = document.createElement('div');
    element.className = 'tooltip';
    
    super({
      element: element,
      positioning: 'top-center',
      offset: [0, -5],
      stopEvent: false
    });
  }
  
  show(coordinate, text) {
    this.getElement().innerHTML = text;
    this.getElement().style.display = 'block';
    this.setPosition(coordinate);
  }
  
  hide() {
    this.getElement().style.display = 'none';
  }
}

// 悬停提示
const tooltip = new Tooltip();
map.addOverlay(tooltip);

map.on('pointermove', (event) => {
  if (event.dragging) {
    tooltip.hide();
    return;
  }
  
  const feature = map.forEachFeatureAtPixel(event.pixel, f => f);
  
  if (feature) {
    tooltip.show(event.coordinate, feature.get('name'));
    map.getTargetElement().style.cursor = 'pointer';
  } else {
    tooltip.hide();
    map.getTargetElement().style.cursor = '';
  }
});
```

## 12.3 标注

### 12.3.1 HTML 标注

```javascript
// 创建标注
function createMarker(coordinate, options = {}) {
  const element = document.createElement('div');
  element.className = 'marker';
  
  if (options.icon) {
    const img = document.createElement('img');
    img.src = options.icon;
    element.appendChild(img);
  }
  
  if (options.label) {
    const label = document.createElement('span');
    label.className = 'marker-label';
    label.textContent = options.label;
    element.appendChild(label);
  }
  
  const overlay = new Overlay({
    element: element,
    position: coordinate,
    positioning: 'bottom-center',
    offset: [0, 0]
  });
  
  return overlay;
}

// 使用示例
const markers = [
  { coordinate: fromLonLat([116.4074, 39.9042]), icon: '/icons/marker.png', label: '北京' },
  { coordinate: fromLonLat([121.4737, 31.2304]), icon: '/icons/marker.png', label: '上海' }
];

markers.forEach(m => {
  const marker = createMarker(m.coordinate, { icon: m.icon, label: m.label });
  map.addOverlay(marker);
});
```

### 12.3.2 动态标注

```javascript
// 实时位置标注
class PositionMarker extends Overlay {
  constructor(options = {}) {
    const element = document.createElement('div');
    element.className = 'position-marker';
    element.innerHTML = `
      <div class="marker-icon"></div>
      <div class="marker-info">
        <span class="marker-label">${options.label || ''}</span>
        <span class="marker-status"></span>
      </div>
    `;
    
    super({
      element: element,
      positioning: 'center-center'
    });
    
    this.options = options;
    this.statusElement = element.querySelector('.marker-status');
  }
  
  updatePosition(coordinate, status) {
    this.setPosition(coordinate);
    if (this.statusElement && status) {
      this.statusElement.textContent = status;
    }
  }
}

// GPS 追踪
const positionMarker = new PositionMarker({ label: '当前位置' });
map.addOverlay(positionMarker);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const coords = fromLonLat([
        position.coords.longitude,
        position.coords.latitude
      ]);
      positionMarker.updatePosition(coords, `精度: ${position.coords.accuracy}m`);
    },
    (error) => {
      console.error('定位失败:', error);
    },
    { enableHighAccuracy: true }
  );
}
```

## 12.4 信息窗口

### 12.4.1 详细信息窗口

```javascript
class InfoWindow extends Overlay {
  constructor() {
    const element = document.createElement('div');
    element.className = 'info-window';
    
    super({
      element: element,
      autoPan: { animation: { duration: 250 } }
    });
    
    this.element = element;
  }
  
  open(coordinate, data) {
    this.element.innerHTML = this.render(data);
    this.setPosition(coordinate);
    this.bindEvents();
  }
  
  close() {
    this.setPosition(undefined);
  }
  
  render(data) {
    return `
      <div class="info-window-header">
        <h3>${data.title}</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="info-window-body">
        ${data.content}
      </div>
      <div class="info-window-footer">
        ${data.actions ? data.actions.map(action => 
          `<button class="action-btn" data-action="${action.id}">${action.label}</button>`
        ).join('') : ''}
      </div>
    `;
  }
  
  bindEvents() {
    this.element.querySelector('.close-btn').addEventListener('click', () => {
      this.close();
    });
    
    this.element.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.dispatchEvent({ type: 'action', action });
      });
    });
  }
}

// 使用示例
const infoWindow = new InfoWindow();
map.addOverlay(infoWindow);

infoWindow.on('action', (event) => {
  console.log('用户操作:', event.action);
});

map.on('click', (event) => {
  const feature = map.forEachFeatureAtPixel(event.pixel, f => f);
  
  if (feature) {
    infoWindow.open(event.coordinate, {
      title: feature.get('name'),
      content: `<p>${feature.get('description')}</p>`,
      actions: [
        { id: 'edit', label: '编辑' },
        { id: 'delete', label: '删除' }
      ]
    });
  }
});
```

## 12.5 Overlay 管理

```javascript
class OverlayManager {
  constructor(map) {
    this.map = map;
    this.overlays = new Map();
  }
  
  add(id, overlay) {
    this.overlays.set(id, overlay);
    this.map.addOverlay(overlay);
  }
  
  get(id) {
    return this.overlays.get(id);
  }
  
  remove(id) {
    const overlay = this.overlays.get(id);
    if (overlay) {
      this.map.removeOverlay(overlay);
      this.overlays.delete(id);
    }
  }
  
  clear() {
    this.overlays.forEach(overlay => {
      this.map.removeOverlay(overlay);
    });
    this.overlays.clear();
  }
  
  showAll() {
    this.overlays.forEach(overlay => {
      overlay.getElement().style.display = 'block';
    });
  }
  
  hideAll() {
    this.overlays.forEach(overlay => {
      overlay.getElement().style.display = 'none';
    });
  }
}

// 使用示例
const overlayManager = new OverlayManager(map);

// 添加多个标注
data.forEach((item, index) => {
  const marker = createMarker(item.coordinate, item);
  overlayManager.add(`marker-${index}`, marker);
});

// 清除所有
overlayManager.clear();
```

## 12.6 样式

```css
/* 弹出框样式 */
.popup {
  position: absolute;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 15px;
  min-width: 200px;
}

.popup::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  margin-left: -10px;
  border-width: 10px;
  border-style: solid;
  border-color: white transparent transparent transparent;
}

.popup-closer {
  position: absolute;
  top: 5px;
  right: 5px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

/* 工具提示样式 */
.tooltip {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

/* 标注样式 */
.marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.marker img {
  width: 32px;
  height: 32px;
}

.marker-label {
  margin-top: 5px;
  background: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* 信息窗口样式 */
.info-window {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  min-width: 280px;
  max-width: 400px;
}

.info-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}

.info-window-header h3 {
  margin: 0;
  font-size: 16px;
}

.info-window-body {
  padding: 15px;
}

.info-window-footer {
  padding: 10px 15px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.action-btn:hover {
  background: #f5f5f5;
}
```

## 12.7 本章小结

本章介绍了 OpenLayers 的 Overlay 覆盖物：

1. **基本使用**：创建、定位、配置
2. **弹出框**：信息弹出框、工具提示
3. **标注**：HTML 标注、动态标注
4. **信息窗口**：详细信息展示
5. **管理**：批量管理 Overlay
6. **样式**：CSS 定制

### 关键要点

- Overlay 位置与地图坐标关联
- 使用 positioning 控制锚点位置
- autoPan 确保 Overlay 在视口内

---

[← 上一章：Interaction交互系统](https://znlgis.github.io/gis/tutorial/openlayers/第11章-Interaction交互系统/) | [返回目录](https://znlgis.github.io/gis/tutorial/openlayers/) | [下一章：地图事件与动画 →](https://znlgis.github.io/gis/tutorial/openlayers/第13章-地图事件与动画/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第12章-Overlay覆盖物/第11章-Interaction交互系统/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第12章-Overlay覆盖物/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第12章-Overlay覆盖物/第13章-地图事件与动画/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

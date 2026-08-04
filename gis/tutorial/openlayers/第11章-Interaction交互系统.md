---
layout: default
title: 第11章 - Interaction交互系统
---

# 第11章 - Interaction 交互系统

## 11.1 交互概述

Interaction（交互）负责处理用户与地图的交互行为，如拖拽、缩放、绘制、选择等。

### 11.1.1 内置交互

```javascript
import {
  defaults as defaultInteractions,
  DragPan,
  DragRotate,
  DragRotateAndZoom,
  DragZoom,
  DoubleClickZoom,
  KeyboardPan,
  KeyboardZoom,
  MouseWheelZoom,
  PinchRotate,
  PinchZoom,
  DragBox,
  Draw,
  Modify,
  Select,
  Snap,
  Translate
} from 'ol/interaction';

// 默认交互
const map = new Map({
  interactions: defaultInteractions()
});

// 自定义默认交互
const map2 = new Map({
  interactions: defaultInteractions({
    doubleClickZoom: true,
    dragPan: true,
    mouseWheelZoom: true,
    keyboard: true,
    shiftDragZoom: true,
    altShiftDragRotate: false,
    pinchRotate: true,
    pinchZoom: true
  })
});
```

### 11.1.2 导航交互

```javascript
// 鼠标拖拽平移
const dragPan = new DragPan({
  condition: function(event) {
    return event.originalEvent.buttons === 1; // 仅左键
  },
  kinetic: true // 惯性效果
});

// 鼠标滚轮缩放
const mouseWheelZoom = new MouseWheelZoom({
  duration: 250,
  constrainResolution: true, // 整数缩放级别
  useAnchor: true // 以鼠标位置为锚点
});

// 双击缩放
const doubleClickZoom = new DoubleClickZoom({
  delta: 1,
  duration: 250
});

// 键盘导航
const keyboardPan = new KeyboardPan({
  pixelDelta: 128
});

const keyboardZoom = new KeyboardZoom({
  delta: 1,
  duration: 200
});

// 触屏手势
const pinchZoom = new PinchZoom();
const pinchRotate = new PinchRotate();

// 框选缩放
const dragZoom = new DragZoom({
  condition: shiftKeyOnly // Shift + 拖拽
});
```

## 11.2 Select 选择交互

```javascript
import Select from 'ol/interaction/Select';
import { click, pointerMove, singleClick } from 'ol/events/condition';
import { Style, Fill, Stroke, Circle } from 'ol/style';

// 基本选择
const select = new Select({
  condition: click,
  style: new Style({
    fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
    stroke: new Stroke({ color: 'red', width: 3 }),
    image: new Circle({
      radius: 10,
      fill: new Fill({ color: 'red' })
    })
  })
});

// 悬停选择
const hoverSelect = new Select({
  condition: pointerMove,
  style: new Style({
    fill: new Fill({ color: 'rgba(255, 165, 0, 0.3)' }),
    stroke: new Stroke({ color: 'orange', width: 2 })
  })
});

// 多选
const multiSelect = new Select({
  condition: click,
  multi: true,
  toggleCondition: platformModifierKeyOnly // Ctrl/Cmd + 点击切换
});

// 按图层过滤
const layerSelect = new Select({
  layers: [vectorLayer], // 仅在指定图层选择
  filter: (feature, layer) => {
    return feature.get('selectable') !== false;
  }
});

// 监听选择事件
select.on('select', (event) => {
  console.log('选中:', event.selected);
  console.log('取消选中:', event.deselected);
});

map.addInteraction(select);
```

## 11.3 Draw 绘制交互

```javascript
import Draw from 'ol/interaction/Draw';
import { createBox, createRegularPolygon } from 'ol/interaction/Draw';

// 基本绘制
const drawPoint = new Draw({
  source: vectorSource,
  type: 'Point'
});

const drawLine = new Draw({
  source: vectorSource,
  type: 'LineString'
});

const drawPolygon = new Draw({
  source: vectorSource,
  type: 'Polygon'
});

const drawCircle = new Draw({
  source: vectorSource,
  type: 'Circle'
});

// 矩形绘制
const drawBox = new Draw({
  source: vectorSource,
  type: 'Circle',
  geometryFunction: createBox()
});

// 正多边形绘制
const drawSquare = new Draw({
  source: vectorSource,
  type: 'Circle',
  geometryFunction: createRegularPolygon(4)
});

// 自由绘制
const freehandDraw = new Draw({
  source: vectorSource,
  type: 'LineString',
  freehand: true
});

// 绘制事件
drawPolygon.on('drawstart', (event) => {
  console.log('开始绘制');
});

drawPolygon.on('drawend', (event) => {
  console.log('绘制完成:', event.feature);
});

drawPolygon.on('drawabort', (event) => {
  console.log('取消绘制');
});

// 自定义绘制样式
const styledDraw = new Draw({
  source: vectorSource,
  type: 'Polygon',
  style: new Style({
    fill: new Fill({ color: 'rgba(66, 133, 244, 0.2)' }),
    stroke: new Stroke({
      color: '#4285F4',
      width: 2,
      lineDash: [5, 5]
    }),
    image: new Circle({
      radius: 5,
      fill: new Fill({ color: '#4285F4' })
    })
  })
});
```

## 11.4 Modify 修改交互

```javascript
import Modify from 'ol/interaction/Modify';

// 修改所有要素
const modify = new Modify({
  source: vectorSource
});

// 修改选中的要素
const selectedFeatures = select.getFeatures();
const modifySelected = new Modify({
  features: selectedFeatures
});

// 修改事件
modify.on('modifystart', (event) => {
  console.log('开始修改');
});

modify.on('modifyend', (event) => {
  console.log('修改完成');
  event.features.forEach(feature => {
    console.log('修改的要素:', feature.getId());
  });
});

// 删除顶点条件
const modifyWithDelete = new Modify({
  source: vectorSource,
  deleteCondition: function(event) {
    return altKeyOnly(event) && singleClick(event);
  }
});

map.addInteraction(modify);
```

## 11.5 Snap 捕捉交互

```javascript
import Snap from 'ol/interaction/Snap';

// 捕捉到数据源中的所有要素
const snap = new Snap({
  source: vectorSource,
  pixelTolerance: 10 // 捕捉容差（像素）
});

// 捕捉到指定要素
const snapToFeatures = new Snap({
  features: featureCollection
});

// 仅捕捉顶点
const snapVertex = new Snap({
  source: vectorSource,
  vertex: true,
  edge: false
});

// 仅捕捉边
const snapEdge = new Snap({
  source: vectorSource,
  vertex: false,
  edge: true
});

// 注意：Snap 应该在 Draw 和 Modify 之后添加
map.addInteraction(draw);
map.addInteraction(modify);
map.addInteraction(snap);
```

## 11.6 Translate 平移交互

```javascript
import Translate from 'ol/interaction/Translate';

// 平移选中的要素
const translate = new Translate({
  features: select.getFeatures()
});

// 平移数据源中的所有要素
const translateAll = new Translate({
  source: vectorSource
});

// 按图层过滤
const translateFiltered = new Translate({
  layers: [editableLayer],
  filter: (feature, layer) => {
    return feature.get('movable') !== false;
  }
});

// 平移事件
translate.on('translatestart', (event) => {
  console.log('开始平移');
});

translate.on('translateend', (event) => {
  console.log('平移结束');
  event.features.forEach(feature => {
    console.log('新位置:', feature.getGeometry().getCoordinates());
  });
});

map.addInteraction(translate);
```

## 11.7 DragBox 框选交互

```javascript
import DragBox from 'ol/interaction/DragBox';
import { platformModifierKeyOnly } from 'ol/events/condition';

// 框选要素
const dragBox = new DragBox({
  condition: platformModifierKeyOnly // Ctrl/Cmd + 拖拽
});

dragBox.on('boxend', () => {
  const extent = dragBox.getGeometry().getExtent();
  
  // 查询范围内的要素
  const features = vectorSource.getFeaturesInExtent(extent);
  
  // 添加到选择集
  select.getFeatures().clear();
  features.forEach(feature => {
    select.getFeatures().push(feature);
  });
  
  console.log(`选中 ${features.length} 个要素`);
});

dragBox.on('boxstart', () => {
  select.getFeatures().clear();
});

map.addInteraction(dragBox);
```

## 11.8 自定义交互

```javascript
import Interaction from 'ol/interaction/Interaction';
import Pointer from 'ol/interaction/Pointer';

// 继承 Pointer 交互
class CustomPointerInteraction extends Pointer {
  constructor(options = {}) {
    super({
      handleDownEvent: (event) => this.handleDown(event),
      handleUpEvent: (event) => this.handleUp(event),
      handleDragEvent: (event) => this.handleDrag(event),
      handleMoveEvent: (event) => this.handleMove(event)
    });
    
    this.callback = options.callback;
  }
  
  handleDown(event) {
    if (this.callback) {
      this.callback('down', event);
    }
    return true; // 返回 true 表示开始捕获
  }
  
  handleUp(event) {
    if (this.callback) {
      this.callback('up', event);
    }
    return false;
  }
  
  handleDrag(event) {
    if (this.callback) {
      this.callback('drag', event);
    }
  }
  
  handleMove(event) {
    if (this.callback) {
      this.callback('move', event);
    }
  }
}

// 使用自定义交互
const customInteraction = new CustomPointerInteraction({
  callback: (type, event) => {
    console.log(`${type}: ${event.coordinate}`);
  }
});

map.addInteraction(customInteraction);
```

## 11.9 交互管理

```javascript
// 交互管理器
class InteractionManager {
  constructor(map) {
    this.map = map;
    this.interactions = new Map();
    this.activeInteraction = null;
  }
  
  register(name, interaction) {
    this.interactions.set(name, interaction);
    interaction.setActive(false);
    this.map.addInteraction(interaction);
  }
  
  activate(name) {
    // 停用当前交互
    if (this.activeInteraction) {
      this.deactivate(this.activeInteraction);
    }
    
    // 激活新交互
    const interaction = this.interactions.get(name);
    if (interaction) {
      interaction.setActive(true);
      this.activeInteraction = name;
    }
  }
  
  deactivate(name) {
    const interaction = this.interactions.get(name);
    if (interaction) {
      interaction.setActive(false);
    }
    if (this.activeInteraction === name) {
      this.activeInteraction = null;
    }
  }
  
  remove(name) {
    const interaction = this.interactions.get(name);
    if (interaction) {
      this.map.removeInteraction(interaction);
      this.interactions.delete(name);
    }
  }
  
  clear() {
    this.interactions.forEach((interaction, name) => {
      this.map.removeInteraction(interaction);
    });
    this.interactions.clear();
    this.activeInteraction = null;
  }
}

// 使用示例
const interactionManager = new InteractionManager(map);

interactionManager.register('draw-point', new Draw({ source: vectorSource, type: 'Point' }));
interactionManager.register('draw-line', new Draw({ source: vectorSource, type: 'LineString' }));
interactionManager.register('draw-polygon', new Draw({ source: vectorSource, type: 'Polygon' }));
interactionManager.register('modify', new Modify({ source: vectorSource }));
interactionManager.register('select', new Select());

// 切换工具
interactionManager.activate('draw-point');
```

## 11.10 本章小结

本章介绍了 OpenLayers 的交互系统：

1. **导航交互**：平移、缩放、旋转
2. **选择交互**：点击选择、悬停选择、多选
3. **绘制交互**：点、线、面、圆、矩形
4. **修改交互**：修改顶点、删除顶点
5. **捕捉交互**：顶点捕捉、边捕捉
6. **平移交互**：要素平移
7. **框选交互**：范围选择
8. **自定义交互**：继承 Pointer 类

### 关键要点

- 使用条件函数控制交互触发
- 合理组合多个交互实现复杂功能
- Snap 应在 Draw/Modify 之后添加

---

[← 上一章：Control控件系统](https://znlgis.github.io/gis/tutorial/openlayers/第10章-Control控件系统/) | [返回目录](https://znlgis.github.io/gis/tutorial/openlayers/) | [下一章：Overlay覆盖物 →](https://znlgis.github.io/gis/tutorial/openlayers/第12章-Overlay覆盖物/)

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第11章-Interaction交互系统/第10章-Control控件系统/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第11章-Interaction交互系统/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第11章-Interaction交互系统/第12章-Overlay覆盖物/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

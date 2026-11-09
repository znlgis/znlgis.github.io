---
layout: default
title: 第10章 - Control控件系统
---

# 第10章 - Control 控件系统

## 10.1 控件概述

控件（Control）是显示在地图上的用户界面元素，用于提供地图交互功能。OpenLayers 提供多种内置控件，同时支持自定义控件。

### 10.1.1 内置控件

控件在 OpenLayers 里是挂在 `map` 上的 DOM 组件，每个控件对应一个 `element`，由框架插入到地图容器里。控件和交互（Interaction）是两套不同的机制：控件是“按钮、面板、显示框”，交互是“拖拽、绘制、框选”这类行为。缩放控件点一下会调用视图的动画，本质上是控件包了一层交互，但两者在 API 上是分开的，注册方式也不同——控件用 `addControl`，交互用 `addInteraction`。

`defaults()` 返回默认控件集合，包含 Zoom、Rotate、Attribution，以及被禁用的部分（ZoomSlider、OverviewMap 等按需开启）。它的参数是一个“开关表”：`zoom: false` 表示不创建缩放控件，`attribution: false` 关掉右下角的版权信息。这些键与具体的控件类一一对应，拼错的键会被忽略，不会报错，所以关不掉控件时先核对键名。

注意扩展默认控件的写法：`defaults().extend([...])` 返回的是控件集合，`new Map({ controls: ... })` 的 `controls` 选项期望的也是一个集合，示例里直接传返回值是对的。如果自己构造一个 `Collection` 再逐个 `push`，效果一样，但要记得先放默认控件，否则缩放按钮会凭空消失。地图创建之后再追加控件，用 `map.addControl`；移除用 `map.removeControl`。

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

`Zoom` 的 `className` 决定控件的 CSS 类名，默认 `ol-zoom`。改成自定义类名之后，OpenLayers 自带的样式就失效了，控件的定位、按钮外观都要自己写——这是定制外观的入口，也是“控件跑到左上角外面”这类问题的原因。`zoomInLabel` 与 `zoomOutLabel` 是按钮上显示的文字或 HTML，`zoomInTipLabel` 是 `title` 属性的悬停提示，两组参数一个管视觉、一个管可访问性。

`delta` 是每次点击的缩放级数，默认 1。鼠标滚轮和按钮的缩放级数可以不一致，业务上要求“点一次跳两级”时改这里即可，不需要监听点击事件自己调视图。`duration` 是缩放动画的时长（毫秒），默认 250；设成 0 会瞬间跳变，设太大按钮会有“迟钝感”，移动端一般 200 到 300 之间。

`target` 决定控件挂到哪个 DOM 节点上。默认是地图容器，控件按内置的 CSS 定位到左上、左下等角落；传一个自定义容器的 id 或元素，控件就渲染到那里，适合把工具栏放在地图外围的侧边栏里。`target` 为 `undefined` 时用默认容器，显式写 `undefined` 和省略没有区别，示例里写出来是为了提示这个参数存在。

`ZoomToExtent` 的 `extent` 是“缩放到全图”的目标范围，坐标必须与视图投影一致。视图是 EPSG:3857 而 `extent` 写成经纬度范围，点击后会飞到地球另一侧。示例里的范围数值在千万量级，是典型的 Web Mercator 坐标，与默认视图匹配。不传 `extent` 时，控件会缩放到图层的总范围。

三个控件都被 `map.addControl` 添加，没有先移除默认控件，所以页面上会同时出现默认的缩放按钮和这里添加的缩放按钮，两个叠在同一个位置。正确的做法是在创建地图时用 `defaults({ zoom: false })` 关掉默认的，或者根本不再添加 `new Zoom()`。这类重复控件在开发阶段很常见，表现是按钮点一次跳两级。

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

比例尺控件算出当前视图的“图上距离对应实地距离”，并按取整后的刻度显示。`units` 决定单位体系：`metric` 是米/千米，`imperial` 是英尺/英里，`nautical` 是海里，`us` 是美制单位，`degrees` 则直接显示经纬度跨度。单位选择与数据无关，只与展示习惯有关，同一份数据切到不同单位都能正常换算。

`bar` 决定显示形式：`false` 是文字比例尺（“10 km”加一条细线），`true` 是分段色块组成的条形比例尺。条形比例尺在打印、截图时更直观，但它需要更多宽度，`minWidth` 要给到 140 以上才不会被截断。`steps` 是刻度分段的候选数量，控件会在 `minWidth` 与 `maxWidth` 之间选一个能容纳的刻度值，因此最终显示的数字通常不是整数十的倍数。

`text` 控制是否显示文字，关掉后只剩一条线。`minWidth`、`maxWidth` 是控件的宽度约束（像素），它们不直接等于比例尺长度，而是控件在计算刻度时使用的布局边界。想固定比例尺的显示宽度，只能通过调整这两个值间接影响，控件本身没有“指定图上长度”的参数。

比例尺的准确性依赖视图投影。在 EPSG:3857 上，比例尺按赤道处的比例计算，离开赤道后实际地面距离会偏小（纬度 40 度附近偏差约 30%），这是 Web Mercator 的固有特性，不是控件算错。需要高精度比例尺时，视图应改用等距投影，或者接受这个已知偏差并在图例中说明。

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

`MousePosition` 把鼠标当前的地图坐标格式化后显示出来。它有两个关键参数：`projection` 指定传给 `coordinateFormat` 的坐标是什么投影，`coordinateFormat` 是接收坐标数组、返回字符串的函数。示例里 `projection: 'EPSG:3857'`，回调的第一件事就是 `toLonLat` 把 Web Mercator 转回经纬度——如果 `projection` 写成 `'EPSG:4326'`，控件会先替你做这步转换，回调里就不用再转了。

`toLonLat` 不带第二个参数时默认从 `EPSG:3857` 转到 `EPSG:4326`，这也是 OpenLayers 的默认视图投影。用其他投影时要把源投影传进去，写成 `toLonLat(coordinate, 'EPSG:4490')` 之类，否则结果会错得很离谱。经纬度坐标的顺序是 `[经度, 纬度]`，与常见的“纬度在前”写法相反，显示时别把两个数写反。

`target` 可以把坐标显示到地图外的 DOM 节点上，示例传的是 `document.getElementById('mouse-position')`。这里有个时序问题：脚本执行时该节点必须已经存在，写在 `<head>` 里的脚本拿到的是 null，控件就静默不显示。把脚本放到 `</body>` 前，或者在 `DOMContentLoaded` 里初始化，能避免这一类问题。`placeholder` 是鼠标不在图上时显示的提示文字。

`toStringHDMS(lonLat)` 把十进制经纬度转成度分秒格式，输入顺序同样是 `[经度, 纬度]`。度分秒在国内的测绘、规划成果里仍然常见，配合 `createStringXY(6)` 这类预设格式化函数可以做出“经纬度切换显示”的下拉选项。`createStringXY` 的精度参数是小数位数，6 位大约对应 0.1 米。

`mousePosition` 被添加到地图上了，`dmsMousePosition` 只创建没有添加，所以页面上只会显示一个坐标框。两个控件同时添加会叠在同一个位置，实际项目里通常只保留一个，用配置切换格式。

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

鹰眼（OverviewMap）在右下角放一张缩略图，用一个矩形框标出主图当前视野的位置，拖动框可以移动主图。它内部是一个独立的 `Map` 实例，有自己的图层和视图，所以需要给它单独的图层配置——示例里传了一个 OSM 图层，与主图用的是什么底图无关。想让它和主图一致，就把主图的底图图层也传进去，注意传的是图层对象而不是数据源，同一个图层实例不能同时挂在两个地图上，要新建一个指向同一数据源的图层。

`collapsed` 是初始状态：`true` 表示默认收起，只留一个小按钮；`collapsible` 决定用户能否手动展开收起，设为 false 时始终展开。`label` 和 `collapseLabel` 是展开、收起按钮上的字符，`tipLabel` 是悬停提示。这几个参数只是文案，不改变行为。

`view` 参数配置缩略图的视图，`maxZoom` 限制鹰眼最多放大到几级，防止缩略图和大图一样细；`minZoom` 防止缩得太小。缩略图不需要显示细节，把 `maxZoom` 设到 8 以下能让底图请求量明显减少。不传 `view` 时会从主图视图复制一份配置，但缩略图的视野范围是独立变化的。

鹰眼控件本身不跟随主图视图的 `projection` 变化。主图切投影（比如从 3857 换到自定义投影）时，鹰眼的视图仍然是创建时的那套配置，可能出现矩形框位置对不上。动态切投影的场景里，需要在切换后重建鹰眼控件，或者手动调用它的 `setMap` 重新挂载。

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

`FullScreen` 调用浏览器的全屏 API（`requestFullscreen`），把 `source` 指定的元素全屏显示；不传 `source` 时默认全屏地图容器。全屏 API 必须在用户手势（点击、按键）的回调里调用，否则浏览器会拒绝并抛错——控件内部已经在点击回调里处理了这件事，自己实现时要注意。

`label` 与 `labelActive` 是两种状态下按钮显示的文字或图标，一个表示“进入全屏”，一个表示“退出全屏”。`tipLabel` 是悬停提示，全屏状态切换后控件会自动更新它。`keys` 决定是否支持键盘操作，开启后按钮可以通过 Tab 聚焦、回车触发，是默认开启的无障碍支持。

`enterfullscreen` 与 `leavefullscreen` 是两个自定义事件，用控件的 `on` 方法监听。它们只在全屏状态通过该控件切换时触发；用户按 ESC 退出全屏时，浏览器会直接退出，是否触发事件取决于浏览器的实现。要在任何情况下都拿到状态，监听 `document` 的 `fullscreenchange` 事件更可靠，再判断 `document.fullscreenElement` 是否为空。

全屏之后地图容器尺寸会变化，OpenLayers 的 `Map` 通过 `ResizeObserver` 感知容器变化并自动更新尺寸，通常不需要手动调 `updateSize()`。如果地图被放在 `display: none` 的容器里、之后才显示，自动检测可能拿不到尺寸，这时要手动调一次 `map.updateSize()`，否则会出现“地图只渲染左上角一块”的现象。

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

内置控件覆盖了常用的交互入口，业务上总会有内置没有的需求：图层树、量测工具条、图例、比例尺切换、坐标跳转。OpenLayers 的自定义控件机制很简单：继承 `Control`，把一个 DOM 元素传给父类构造函数，剩下的界面和逻辑自己写。控件不需要知道地图怎么渲染，只需要在需要时通过 `getMap()` 拿到地图对象。

### 10.2.1 基础自定义控件

构造函数里先创建 `element`，再 `super({ element })`，这个顺序不能反——`Control` 的构造函数会读取 `element` 并初始化内部状态，之后 `this.element` 才可用。类名里的 `ol-unselectable` 是 OpenLayers 的约定类，作用是禁止用户选中控件文字；`ol-control` 提供默认的定位与按钮样式。两个类名保留着，再叠加自己的类名做定制，是最省事的做法。

`render()` 在构造函数里调用一次，往 `element` 里填按钮。这不是 OpenLayers 的约定方法，而是这个示例自己的写法，名字叫什么都行。真正需要覆盖的父类方法是 `setMap(map)`：地图挂载、卸载、切换时会被调用，适合在这里做“跟随地图”的初始化与清理，比如把控件创建的图层加到地图上、注销事件监听。示例里的测量控件就重写了 `setMap`，见 10.2.3。

`handleClick` 里通过 `this.getMap()` 拿到地图对象。`getMap()` 在控件未挂载时返回 `undefined`，按钮点击理论上发生在挂载之后，但代码在控件被移除后仍可能被触发（DOM 还留在页面上），判空是必要的。`onClick` 回调里用了浏览器定位 API，`navigator.geolocation` 在非 HTTPS 环境下不可用，本地开发用 `localhost` 可以，部署到 HTTP 站点会静默失败。

定位回调里 `fromLonLat` 把经纬度转成视图投影坐标，再交给 `view.animate` 做带动画的跳转。`duration` 是动画时长，`zoom` 是目标级别；`animate` 还支持 `center`、`resolution`、`rotation` 的组合，以及 `easing` 缓动函数。注意 `position.coords` 的经度、纬度顺序是 `longitude` 在前，与 `fromLonLat` 的参数顺序一致。

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

图层切换器的核心是把 `map.getLayers()` 返回的图层集合渲染成勾选框列表。`getLayers()` 返回的是 `Collection`，不是数组，但它有 `forEach` 方法，示例直接遍历是合法的。每个图层用 `layer.get('name')` 取显示名，这个属性在创建图层时通过 `properties` 传入，没传就显示 `Unnamed`——所以图层的 `name` 属性要在构造时统一设置好。

`checkbox.checked = layer.getVisible()` 取初始可见性，`change` 事件里 `layer.setVisible(...)` 同步回去。这里没有处理反向同步：外部代码（比如别的按钮）改了图层可见性，面板上的勾选框不会跟着变。要做到双向同步，需要监听每个图层的 `change:visible` 事件，在回调里更新对应的 DOM 节点，同时用标志位防止事件循环。

`buildLayerList` 用递归处理 `LayerGroup`，`depth` 参数控制缩进。判断分组的写法 `layer instanceof LayerGroup` 在混用多个 OpenLayers 版本或打包工具导致类重复时可能失效，更稳的判断是看图层有没有 `getLayers` 方法。递归没有终止保护，如果图层组互相嵌套成环（正常配置不会出现），会无限递归。

`showPanel` 每次展开都清空面板重建，实现简单但会丢失滚动位置和输入焦点。面板里如果只有勾选框，重建的代价可以忽略；有搜索框、拖拽排序这类有状态的控件时，应当改为增量更新。`panel.style.display` 直接操作内联样式，与 10.3 节建议的“样式写 CSS”相冲突，这里是运行时显隐，用类名切换更规范，示例为了简短用了内联写法。

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

测量控件把“控件”和“交互”组合起来：按钮是控件，绘制是 `Draw` 交互，结果落到一个专用的矢量图层上。构造函数里创建了 `VectorSource` 与 `VectorLayer`，但**没有**立刻把图层加到地图上——这一步放在重写的 `setMap` 里，因为构造函数执行时控件还没挂载，`getMap()` 是 undefined。

`setMap(map)` 先调用 `super.setMap(map)`，再判断 `map` 是否存在。控件被移除时 `setMap(undefined)` 会被调用，这里没有处理卸载分支，图层会留在原来的地图上。完整的写法应当在该分支里 `map.removeLayer(this.vectorLayer)`，否则控件销毁后测量图形还画在图上。这是自定义控件最容易被忽略的生命周期点。

`startMeasure(type)` 先移除上一次创建的 `Draw` 交互，再创建新的。`Draw` 的 `source` 指向测量图层的数据源，画完的要素直接进入该图层；`type` 决定绘制线段还是多边形。`style` 参数让绘制过程中的预览图形也用同一套样式，否则预览是默认的蓝点，落笔之后才变成自定义样式，视觉上会跳一下。

`drawend` 事件在用户完成绘制时触发，`event.feature` 是刚生成的要素。`getLength(geometry)` 与 `getArea(geometry)` 来自 `ol/sphere`，按球面计算，返回米和平方米；它们接收的几何坐标必须是经纬度（EPSG:4326），而地图视图默认是 EPSG:3857。示例里没有做投影转换，直接把 3857 的坐标传进去，算出来的长度和面积是错的——正确做法是先把几何 `clone().transform('EPSG:3857', 'EPSG:4326')` 再计算。这是量测类代码最常见的错误，结果通常偏大若干倍，很容易被当成“算法不准”。

`formatMeasure` 按 1000 米、1000000 平方米切换单位。`measurement` 属性被写到要素上，方便后续在弹窗或列表里读取；`console.log` 只是演示，正式代码应当把结果渲染到界面元素里。`clear()` 清空数据源并移除交互，但没有把 `measureType` 重置，重复点击同一按钮时状态是一致的，问题不大。

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

工具栏是“一组工具只有一个处于激活状态”的容器。它把每个工具的 `activate`、`deactivate` 回调统一管理，按钮的高亮由 `activeTool` 状态驱动，业务代码只需要提供回调，不用自己处理互斥。这个模式适合把多种交互（平移、绘制、量测、框选）做成工具条。

`addTool` 把按钮的 `dataset.toolId` 与工具 id 绑定，点击时调用 `activateTool`。`dataset` 是 `data-*` 属性的读写接口，`button.dataset.toolId = 'pan'` 对应 HTML 的 `data-tool-id` 属性，取值时注意大小写转换规则（`toolId` ↔ `tool-id`）。`this.tools` 用的是 `Map`，避免工具 id 与对象原型属性重名时的意外覆盖。

`activateTool` 的逻辑是“先停旧的、再启新的”。`deactivateTool` 里把它自己的 `activeTool` 置空，`activateTool` 随后又设置新的，顺序正确。但 `deactivateTool` 没有更新按钮的 `active` 类，只在激活新工具时统一 `toggle` 了一遍，所以停用后如果不再激活任何工具，旧按钮会保留高亮。想支持“再次点击取消激活”，需要在 `activateTool` 开头判断 `toolId === this.activeTool` 并走反激活分支。

示例里 `pan` 工具的 `activate` 是空函数，注释写“默认行为”，实际什么都没做。地图的平移是默认交互，不需要额外开启；但如果之前激活过绘制工具、绘制交互还在，切回 `pan` 时应该移除绘制交互。工具之间的清理责任由谁承担要设计清楚，否则会出现“切到平移了还能继续画”的问题。

`draw-point` 工具把创建的 `Draw` 实例存到 `map.set('currentDraw', draw)`，反激活时再取出来移除。用地图对象的属性当临时存储很省事，但地图是全局共享对象，多个控件都用这个键就会互相覆盖。更干净的做法是把状态存在控件实例上，用 `this.currentDraw` 保存。示例的写法在只用一个工具栏时不会出问题，属于可接受的简化。

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

OpenLayers 的默认控件样式在 `ol.css` 里，通过 `.ol-control`、`.ol-zoom` 这类类名提供定位和外观。自定义控件只要带上 `ol-control` 类，就能继承默认的定位方式（绝对定位、圆角、半透明背景），再叠加自己的类名覆盖细节。完全不用默认样式也可以，但那时要让父容器有定位上下文，否则 `position: absolute` 会相对整个页面定位。

### 10.3.1 CSS 样式定制

这套样式假设地图容器带有 `position: relative`，否则绝对定位的控件会以最近的已定位祖先为基准，可能跑到页面顶部。`.custom-control` 用 `top`/`right` 定位，数值是相对地图容器的像素偏移；改地图尺寸、加侧边栏时这些数值要跟着调整，所以真实项目里常用 CSS 变量统一管理边距。

按钮样式里 `border: none` 与 `border-radius: 4px` 覆盖了浏览器默认外观，`box-shadow` 提供层次感。`.layer-panel` 用 `position: absolute` 相对控件定位，`top: 40px` 正好落在按钮下方；面板宽度用 `min-width` 而不是固定值，中文标签较长时不会被截断。`.measure-control` 用 `display: flex` 把三个按钮横排，`gap` 控制间距，这是比浮动布局更省事的做法。

`.toolbar` 用 `flex-direction: column` 竖排工具按钮。工具栏与测量控件如果都定位在左上角，会互相遮挡，实际布局时要给它们分配不同角落，或者用一个容器统一排布。`.active` 类的高亮由 JavaScript 在切换工具时添加，样式本身只负责颜色，两者配合才能看出当前激活的是哪个工具。

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

控件开发的检查清单：DOM 元素在构造时创建并传给父类；初始化和清理放在重写的 `setMap` 里，两条分支都要处理；样式写进 CSS，不在脚本里逐条设置 `style`；跟随地图的监听器在卸载时注销；控件自带的状态（展开/收起、激活工具）集中在一个字段里，不用散落的局部变量。这几条做到，控件反复挂载、切换投影、销毁重建时都不会留下问题。

本章介绍了 OpenLayers 的控件系统：

1. **内置控件**：缩放、比例尺、鼠标位置、鹰眼、全屏
2. **自定义控件**：基础控件、图层切换、测量、工具栏
3. **控件样式**：CSS 定制

### 关键要点

- 继承 Control 类创建自定义控件
- 控件通过 element 属性渲染 DOM
- 使用 CSS 定制控件外观

---

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第09章-栅格数据与瓦片服务/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/openlayers/第11章-Interaction交互系统/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

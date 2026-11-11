---
layout: default
title: 第04章 - Map 地图对象详解
---

# 第04章 - Map 地图对象详解

上一章讲了 Leaflet 的骨架，这一章落到唯一那个"中枢"对象：`LeafletMap`。地图上所有图层、控件、交互处理器、事件、pane 都挂在它身上，它同时承担五个角色——DOM 容器的持有者、视图状态的唯一真相、图层注册表、事件总线、坐标换算器。

正因为职责这么多，`Map` 的选项有 40 多个，方法 70 多个。全背下来没有意义。这一章按"初始化 → 视图 → 坐标 → 尺寸 → pane → 事件"的顺序梳理，重点讲清楚默认值的含义与 2.0 的行为变化，剩下的查 API 文档即可。

## 4.1 构造一个地图：初始化顺序决定了什么能生效

`src/map/Map.js` 的构造器按固定顺序执行六步，这个顺序直接决定了哪些选项在什么时候生效：

```js
constructor(id, options) {
  options = Util.setOptions(this, options);   // ① 合并默认值
  this._initContainer(id);                    // ② 找到/创建容器，设 role="region"、aria-label="Map"
  this._initLayout();                         // ③ 建 pane 树与控制容器
  this._initEvents();                         // ④ 绑定 DOM 事件（resize、scroll 等）
  if (options.maxBounds) this.setMaxBounds(options.maxBounds);
  if (options.zoom !== undefined) this._zoom = this._limitZoom(options.zoom);
  if (options.center && options.zoom !== undefined) {
    this.setView(new LatLng(options.center), options.zoom, {reset: true});
  }
  // ⑤ 创建控件（attribution、zoom）与 7 个 handler
  this.callInitHooks();
  this._addLayers(this.options.layers);       // ⑥ 挂初始图层
}
```

从这段代码能读出三个结论。

**第一，只给 `center` 不给 `zoom` 不会设置视图。** 判断条件是 `options.center && options.zoom !== undefined`，两者缺一不可。这也是"我传了 center 但地图还是空白"最常见的原因。

**第二，`layers` 选项在控件之后才加载。** 所以初始图层里的 `GridLayer` 能正确触发 `zoomlevelschange`，进而调整地图缩放范围。

**第三，初始化就会触发 `setView(..., {reset: true})`。** 1.x 里这个参数是三态的（第三个参数 `true` 表示强制 reset），2.0 改成了选项对象，迁移文档明确写着 `setView(center, zoom, true) no longer forces a view reset. Use setView(center, zoom, {reset: true})`。老代码传布尔值不会报错，但 reset 语义丢了。

### 4.1.1 容器参数

`new LeafletMap('map')` 接受字符串 ID 或直接传 `HTMLElement`：

```js
import {LeafletMap, TileLayer} from 'leaflet';

const el = document.getElementById('map');
const map = new LeafletMap(el, {center: [30.27, 120.15], zoom: 12});
```

传元素的好处是可以在框架里用 ref 拿到节点（React 的 `useRef`、Vue 的 `template ref`），避免 ID 冲突。传字符串时，内部走 `getElementById`，找不到会抛 `Map container not found`。

## 4.2 选项按功能分组

### 4.2.1 状态类选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `crs` | CRS 类 | `EPSG3857` | 坐标参考系，非专业需求不要改 |
| `center` | LatLng | `undefined` | 初始中心；与 `zoom` 同时给才生效 |
| `zoom` | number | `undefined` | 初始层级 |
| `minZoom` / `maxZoom` | number | `undefined` | 不设时从已加载的 `GridLayer` 自动推导 |
| `layers` | Layer[] | `[]` | 初始化时加入的图层 |
| `maxBounds` | LatLngBounds | `null` | 限制可视范围，越界回弹 |
| `renderer` | Renderer | `undefined`（即 `SVG`） | 矢量渲染器；2.0 用它替代已删除的 `preferCanvas` |

`minZoom` / `maxZoom` 的自动推导逻辑值得单说：给地图加一个 `maxZoom: 18` 的底图图层，地图的最大层级就变成 18；再加一个 `maxZoom: 20` 的图层，地图会放宽到 20。图层被移除时会重新计算并触发 `zoomlevelschange`。

### 4.2.2 动画与性能类选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `zoomAnimation` | `true` | 缩放动画总开关 |
| `zoomAnimationThreshold` | `4` | 缩放跨度超过 4 级时不播动画，直接跳 |
| `fadeAnimation` | `true` | 瓦片与弹窗淡入 |
| `markerZoomAnimation` | `true` | marker 参与缩放动画；关掉后动画期间 marker 会消失 |
| `transform3DLimit` | `8388608` | CSS 位移的最大值，2 的 23 次方，32 位浮点精度边界 |

`transform3DLimit` 取 2 的 23 次方，源码注释是 `Precision limit of a 32-bit float`。地图平移靠 CSS `transform` 位移整个 pane，位移超过约 838 万像素后浮点精度丢失、图层错位；Leaflet 的对策是在 `moveend` 检测位移并重置视图。正常项目碰不到，`SimpleCRS` 的超大平面图上连续 `panBy` 可能触发。

### 4.2.3 交互类选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `dragging` | `true` | 拖动平移 |
| `inertia` | `true` | 拖动惯性 |
| `inertiaDeceleration` | `3400` | 惯性减速度，单位 px/s² |
| `inertiaMaxSpeed` | `1400` | 惯性最大速度，单位 px/s |
| `easeLinearity` | `0.2` | 惯性缓动曲线强度 |
| `worldCopyJump` | `false` | 跨世界副本平移时无缝跳回 |
| `maxBoundsViscosity` | `0.0` | `maxBounds` 的"硬度"，1.0 为完全拖不动 |
| `boxZoom` | `true` | Shift + 拖拽框选放大 |
| `doubleClickZoom` | `true` | 双击放大；可传 `'center'` 强制以视图中心为缩放原点 |
| `scrollWheelZoom` | `true` | 滚轮缩放；同样支持 `'center'` |
| `wheelDebounceTime` | `40` | 滚轮事件节流，单位毫秒 |
| `wheelPxPerZoomLevel` | `60` | 每 60 像素滚轮量 = 1 级缩放 |
| `tapHold` | `true` | 长按触发 `contextmenu`（2.0 起全平台默认开启） |
| `tapTolerance` | `15` | 判定为点击允许的最大手指位移，单位像素 |
| `pinchZoom` | `true` | 双指缩放；1.x 里叫 `touchZoom` |
| `bounceAtZoomLimits` | `true` | 捏合超出缩放范围时回弹 |
| `trackResize` | `true` | 自动跟随容器尺寸变化 |

三个数值的来由：`inertiaMaxSpeed` 在 1.x 是 `Infinity`，2.0 改为 `1400`，更新日志给的理由是"快速一甩会把地图扔出好几屏"；`wheelDebounceTime: 40` 限频、`wheelPxPerZoomLevel: 60` 决定滚多少算一级，触控板用户抱怨太灵敏时调大后者（如 90）比调前者有效；`maxBoundsViscosity` 只在配了 `maxBounds` 时有效，业务上"不允许拖出行政区"就用 `1.0`。

### 4.2.4 键盘、控件与本地化

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `keyboard` | `true` | 方向键平移、加减号缩放 |
| `keyboardPanDelta` | `80` | 方向键每次平移的像素数 |
| `ariaKeyShortcuts` | `false` | 是否给容器设 `aria-keyshortcuts`；2.0 默认关闭，因为该属性只对美式键盘正确 |
| `zoomControl` | `true` | 自动加缩放控件 |
| `attributionControl` | `true` | 自动加版权控件 |
| `closePopupOnClick` | `true` | 点击地图关闭弹窗 |
| `translate` | 恒等函数 | 2.0 新增，用于翻译控件标题与无障碍标签 |

`translate` 是 beta.2 加入的，签名是 `translate(text) => string | undefined`：

```js
const dict = {
  'Zoom in': '放大',
  'Zoom out': '缩小',
  'Close popup': '关闭'
};

const map = new LeafletMap('map', {
  center: [30.27, 120.15],
  zoom: 12,
  translate: text => dict[text]
});
```

返回 `undefined` 时保留英文。注意文档说明的时机：文本是在渲染时翻译的，因此要在添加控件、打开弹窗前设置好。

## 4.3 视图控制：五组方法

### 4.3.1 直接设定

```js
map.setView([31.23, 121.47], 13);       // 中心 + 层级
map.setZoom(14);                        // 只改层级，保持中心
map.setZoomAround([31.23, 121.47], 15); // 以指定经纬度为中心缩放
```

2.0 有一个行为改进值得记住：**这些调用可以叠加，且以"动画目标"为基准**。beta.3 更新日志的说法是 `zoomIn(), zoomOut(), setZoom(), panTo() and panBy() build on the view a running animation is heading to`。连点两次放大按钮会真的放大两级，而不是像 1.x 那样第二次打断第一次。同理 `panTo(c).panBy(o)` 的落点是 `c + o`。

但 `getCenter()` / `getZoom()` 返回的仍然是"当前实际视图"，不是动画目标。做状态同步时这一点很关键：不要在 `zoomIn()` 之后立刻读 `getZoom()` 期望拿到新值，要监听 `zoomend`。

### 4.3.2 相对移动

```js
map.panBy([200, 0]);                 // 向右平移 200 像素
map.panTo([30.5, 120.5]);            // 平移到经纬度
map.zoomIn(2);                       // 放大 2 级（默认 zoomDelta）
map.zoomOut(0.5);                    // 缩小半级，需要 zoomSnap <= 0.5
```

`zoomIn(delta)` 的参数是"级数"，不是"次数"。而是否允许半级，取决于 `zoomSnap`。

### 4.3.3 分数级缩放：zoomSnap 与 zoomDelta

默认 `zoomSnap: 1`，地图层级会被吸附到整数。要做"丝滑缩放"或地图应用的精细定位，需要成对调整：

```js
const map = new LeafletMap('map', {
  center: [30.27, 120.15],
  zoom: 12,
  zoomSnap: 0.25,     // 允许 12.0 / 12.25 / 12.5 这样的层级
  zoomDelta: 0.5,     // 按钮与键盘每次变化 0.5 级
  wheelPxPerZoomLevel: 90
});

map.on('zoomend', () => console.log(map.getZoom())); // 12.5 这类小数
```

三个参数的分工：`zoomSnap` 决定"允许的最小粒度"，`zoomDelta` 决定"每次操作变多少"，`wheelPxPerZoomLevel` 决定"滚轮滚多少像素算一级"。`zoomSnap: 0` 表示完全不吸附，但在小数层级下瓦片会明显模糊（因为浏览器把相邻层级的瓦片放大显示），视觉上是否可接受要实测。

### 4.3.4 飞行与适配

```js
map.flyTo([39.9, 116.4], 10, {duration: 2});        // 带平滑飞行的视图切换
map.fitBounds([[30.1, 120.0], [30.4, 120.4]]);      // 按 bounds 自动定层级
map.fitBounds(bounds, {padding: [40, 40], maxZoom: 16});
map.flyToBounds(bounds, {duration: 1.5});
map.fitWorld({maxZoom: 3});
```

`fitBounds` 的 `padding` 有两个形式：全局 `padding: [x, y]`，或分别设 `paddingTopLeft` 与 `paddingBottomRight`。后者在"左侧有固定侧边栏"的布局里必须用，否则自动缩放的区域会被侧边栏挡住一块。

`flyTo` 不是简单插值：它先算目标视图，再按当前视口大小决定中间层级，让镜头"拉远—平移—拉近"。2.0 尊重系统的 `prefers-reduced-motion`，开启时退化为直接跳转。

### 4.3.5 限制与守护

```js
map.setMaxBounds([[29.0, 119.0], [32.0, 122.5]]);
map.setMinZoom(9);
map.setMaxZoom(17);
map.panInside([30.27, 120.15]);          // 把该点纳入视野，必要时平移
map.panInsideBounds(bounds);             // 让当前视图落进 bounds 内
```

`setMaxBounds` 除了限制拖动，还会影响 `fitBounds` 的结果——目标范围超出允许范围时，结果会被裁剪。

## 4.4 坐标换算 API

这是 Map 最容易被低估的部分。任何"自定义渲染、屏幕空间判断、把 DOM 坐标转经纬度"的需求都要用到它：

| 方法 | 输入 → 输出 | 典型用途 |
|------|-------------|----------|
| `map.project(latlng, zoom?)` | LatLng → 绝对像素 `Point` | 算两点像素距离、给自定义图层做投影 |
| `map.unproject(point, zoom?)` | 绝对像素 → LatLng | 反算 |
| `map.latLngToLayerPoint(latlng)` | LatLng → 相对像素原点 | 给 pane 内元素定位 |
| `map.layerPointToLatLng(point)` | 相对像素 → LatLng | 从元素位置反算 |
| `map.latLngToContainerPoint(latlng)` | LatLng → 相对容器左上角 | 判断要素是否在可视区 |
| `map.containerPointToLatLng(point)` | 相对容器像素 → LatLng | 鼠标位置转经纬度 |
| `map.pointerEventToLatLng(e)` | PointerEvent → LatLng | 从原始事件取坐标 |
| `map.getPixelOrigin()` | — → `Point` | 自定义图层必备 |
| `map.getPixelBounds()` | — → `Bounds` | 计算可见瓦片范围 |

2.0 有一处精度变化：`latLngToLayerPoint` 与 `latLngToContainerPoint` 返回**小数像素**，1.x 是四舍五入后的整数。迁移文档把它列为静默变更。需要整数就自己 `.round()`：

```js
const p = map.latLngToContainerPoint(latlng).round();
console.log(p.x, p.y);   // 整数
```

这条变化对"把元素对齐到像素网格"的自定义图层有实际影响：以前自动取整，现在可能出现 0.5px 的偏移，元素边缘发虚。

## 4.5 尺寸与生命周期

### 4.5.1 invalidateSize：什么时候必须调

地图只在三种时机知道容器尺寸变了：窗口 resize（`trackResize` 开启时）、`ResizeObserver` 回调（2.0 新增，能感知父容器变化）、以及你手动调 `invalidateSize`。

典型必须手动调的场景：

```js
// 场景一：侧边栏折叠
sidebar.addEventListener('transitionend', () => map.invalidateSize());

// 场景二：Tab 切换后显示地图
tabs.addEventListener('shown', () => map.invalidateSize({pan: false}));

// 场景三：容器初始隐藏（display:none），显示后
panel.hidden = false;
map.invalidateSize(true);   // true 等价于 {animate: true}
```

`invalidateSize(true)` 是 `{animate: true}` 的简写；默认 `animate: false, pan: true`。`trackResize` 在 2.0 里由 `ResizeObserver` 派发 `resize`，再用 `requestAnimationFrame` 合并成一次 `invalidateSize({debounceMoveend: true})`——所以改完尺寸立刻读 `map.getSize()` 可能还是旧值。

### 4.5.2 remove 与资源释放

```js
map.remove();   // 移除所有图层与事件监听，触发 'unload'
```

单页应用切路由时必须调 `remove()`，否则 DOM 残留、`ResizeObserver` 继续监听、全局事件不释放；2.0 会同时取消待执行的动画帧与过渡监听。

## 4.6 pane 与控件

pane 的层级已在第 3 章讲过，这里只补操作 API：

```js
// 新建 pane（第二参可传容器名，默认继承 mapPane）
map.createPane('labels', map.getPane('tilePane'));

// 取 pane 元素，改 z-index 与指针行为
const pane = map.getPane('labels');
pane.style.zIndex = 620;
pane.style.pointerEvents = 'none';

// 一次性拿全部 pane
console.log(Object.keys(map.getPanes())); // mapPane/tilePane/overlayPane/...
```

控件的挂载与卸载：

```js
import {LeafletMap, ScaleControl} from 'leaflet';

const scale = new ScaleControl({position: 'bottomleft', imperial: false});
scale.addTo(map);      // 等价于 map.addControl(scale)
map.removeControl(scale);
```

`position` 只有 `'topleft'` / `'topright'` / `'bottomleft'` / `'bottomright'` 四个合法值，传别的值控件挂到 `undefined` 上抛异常——自定义控件第一坑。

## 4.7 事件

地图事件分六类，常用的列在下表：

| 类别 | 事件 | 触发时机 |
|------|------|----------|
| 视图 | `movestart` / `move` / `moveend` | 平移开始 / 过程中（含动画每帧）/ 结束 |
| 视图 | `zoomstart` / `zoom` / `zoomend` | 缩放开始 / 过程中 / 结束 |
| 视图 | `viewreset` / `load` / `resize` | 需要重绘 / 首次渲染完成 / 尺寸变化 |
| 交互 | `click` / `dblclick` / `contextmenu` | 点击 / 双击 / 右键或长按 |
| 指针 | `pointerdown` / `pointermove` / `pointerup` / `pointerover` / `pointerout` | 2.0 用 Pointer Events 取代 mouse 系列 |
| 图层 | `layeradd` / `layerremove` | 图层加入 / 移除 |
| 弹窗 | `popupopen` / `popupclose` / `autopanstart` | 弹窗打开 / 关闭 / 自动平移开始 |
| 定位 | `locationfound` / `locationerror` | 地理定位成功 / 失败 |

2.0 的事件改名清单（旧名字会打一次 `console.error` 且监听器永不执行）：

| 1.x | 2.0 |
|-----|-----|
| `mousedown` / `mouseup` / `mousemove` | `pointerdown` / `pointerup` / `pointermove` |
| `mouseover` / `mouseout` | `pointerover` / `pointerout` |
| `keypress` | `keydown` |
| `click` / `dblclick` / `contextmenu` | 不变 |

一个 2.0 的静默差异：`pointermove` 不只对应鼠标，手指拖动也会触发。如果某段逻辑只想响应鼠标，要检查 `e.originalEvent.pointerType === 'mouse'`。

## 4.8 地理定位

```js
map.locate({setView: true, maxZoom: 14, enableHighAccuracy: true, timeout: 10000});

map.on('locationfound', e => {
  console.log(e.latlng, e.accuracy);          // 经纬度与精度（米）
  new Circle(e.latlng, {radius: e.accuracy}).addTo(map);
});

map.on('locationerror', e => {
  console.warn('定位失败：', e.message, e.code);
});

map.stopLocate();   // 停止 watch
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `watch` | `false` | 是否持续监听位置变化 |
| `setView` | `false` | 是否自动把视图移到用户位置 |
| `maxZoom` | `Infinity` | 自动定位时的最大层级 |
| `timeout` | `10000` | 超时毫秒数，超时触发 `locationerror` |
| `maximumAge` | `0` | 允许使用多久内的缓存位置 |
| `enableHighAccuracy` | `false` | 是否要求高精度（更耗电） |

生产环境两点：`locate` 依赖 HTTPS（Geolocation API 硬要求，`localhost` 除外）；国内定位结果是 GCJ-02 偏移，直接画在 WGS-84 底图上会偏几百米，需业务层纠偏。

## 4.9 2.0 的 Map 行为变化

见 4.2 与 4.3 的表格：第三参改选项对象、`touchZoom` → `pinchZoom`、`preferCanvas` 删除、`ariaKeyShortcuts` 默认关闭、坐标换算返回小数、视图方法以动画目标为基准。另有两条静默变化：`getCenter()` 刚创建时不再吸附到整像素；控件点击后不再把焦点抢回地图。

## 4.10 排错清单

| 现象 | 原因 | 修法 |
|------|------|------|
| 地图区域全空、无瓦片请求 | 容器高度为 0，或只给了 `center` 没给 `zoom` | 给容器高度；两个选项同时给 |
| `Map container not found` | 构造时 `#map` 还不存在 | 脚本放 `</body>` 前，或包在 `DOMContentLoaded` 里 |
| 切 Tab 后地图只显示一半 | 隐藏时尺寸算错 | 显示后调 `map.invalidateSize()` |
| 连续两次 `zoomIn()` 只放大一级 | 用了 1.x 语义（2.0 已修复） | 升级到 2.0；1.x 里用 `setZoom` |
| `flyTo` 报错 `Invalid LatLng` | 坐标数组里有 `undefined` 或字符串 `'null'` | 2.0 会校验；用 `LatLng.validate()` 过滤脏数据 |
| 地图拖出边界后回弹太软 | `maxBoundsViscosity` 为 0 | 设成 `1.0` |
| 滚轮缩放太灵敏 / 太迟钝 | `wheelPxPerZoomLevel` 不合适 | 调大 = 更迟钝；配合 `wheelDebounceTime` |

## 4.11 本章小结

| 要点 | 结论 |
|------|------|
| 构造必给两项 | `center` 与 `zoom` 同时存在才会设视图 |
| 视图方法语义 | 2.0 起连续调用叠加，读值仍取"当前视图"而非动画目标 |
| 分数级缩放 | `zoomSnap` 定粒度，`zoomDelta` 定步长，`wheelPxPerZoomLevel` 定滚轮灵敏度 |
| 尺寸变化 | `trackResize` 覆盖窗口与父容器；隐藏→显示、Tab 切换后手动 `invalidateSize()` |
| 坐标换算 | 给 pane 用 `latLngToLayerPoint`，判断可视区用 `latLngToContainerPoint` |
| 事件改名 | mouse 系列 → pointer 系列，`keypress` → `keydown` |
| 需要删地图时 | 单页应用切路由必须 `map.remove()` |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第03章-核心架构与设计哲学/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第05章-图层体系与图层控制/" class="chapter-nav__next">下一章 →</a>
</div>

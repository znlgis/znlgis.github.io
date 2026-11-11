---
layout: default
title: 第08章 - 标记 Marker 与图标体系
---

# 第08章 - 标记 Marker 与图标体系

Marker 是 Leaflet 里唯一"绑定单个地理点 + 可交互 + 可拖拽"的图层。它的实现比看上去复杂：一个 marker 在 DOM 里最多对应两个元素（图标与阴影），位置靠 CSS `transform` 平移，层级由纬度实时计算，还要处理键盘可达性与拖拽状态互斥。

2.0 对 Marker 做了两处结构性改动，都值得单开一节：默认图标从三张 PNG 换成一份内联 SVG，以及新增了旋转能力。前者解决了困扰 1.x 多年的"打包后 marker 图标 404"问题，后者把过去要靠 leaflet-rotatedmarker 插件做的事收进了核心。

## 8.1 构造与定位

### 8.1.1 最小用法

```js
import {LeafletMap, TileLayer, Marker} from 'leaflet';

const map = new LeafletMap('map').setView([30.27, 120.15], 13);
new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

const marker = new Marker([30.27, 120.15]).addTo(map);
marker.bindPopup('默认图标');
```

`new Marker(latlng, options?)` 的第一个参数可以是 `[lat, lng]` 数组、`{lat, lng}` 对象或 `LatLng` 实例。2.0 起坐标会严格校验：

```js
new Marker(['30.27', 120.15]);   // 数字字符串可以，会被转成数字
new Marker([null, 120.15]);      // 抛 Invalid LatLng object
new Marker([undefined, 120.15]); // 抛 Invalid LatLng object
```

1.x 会把 `null`、`''`、布尔值转成 `0` 或 `1`，结果是脏数据被画到几内亚湾（0, 0）。2.0 改成在构造时就抛错，这对数据来源不可控的业务是好事——错误暴露在数据入口，而不是渲染层的诡异位置。要批量过滤脏数据用 `LatLng.validate()`：

```js
const raw = [[30.27, 120.15], [null, 120.15], [30.30, 120.20]];
const points = raw.filter(p => LatLng.validate(p));
points.forEach(p => new Marker(p).addTo(map));
```

### 8.1.2 定位链路

marker 的屏幕位置计算可以拆成四步：

```text
LatLng
  │ map.latLngToLayerPoint(latlng)      转成相对像素原点的坐标
  ▼
layerPoint（可能带小数，2.0 起不再取整）
  │ _setPos() → DomUtil.setPosition
  ▼
CSS: transform: translate3d(x, y, 0)
  │ 再叠加 iconAnchor 的负 margin（由 _setIconStyles 设置）
  ▼
图标的"尖端"落在经纬度上
```

关键在最后一步。`iconAnchor` 不是"图标的中心"，而是"图标上要对准经纬度的那个点"，用负 margin 实现：

```js
// src/layer/marker/Icon.js
if (!isNaN(anchor.x)) { style.marginLeft = (-anchor.x) + 'px'; }
if (!isNaN(anchor.y)) { style.marginTop  = (-anchor.y) + 'px'; }
```

所以默认图标的 `iconAnchor: [12, 41]` 表示"图标内 (12, 41) 这个像素对准坐标"——对一个 25×46 的图钉来说，就是底部尖端偏上 5px 的位置。

### 8.1.3 层级：由纬度决定

Marker 的 z-index 不是全局排序，而是按纬度实时计算：越靠南（纬度越小）的 marker 越靠前，这样在俯视地图上"近处遮挡远处"的视觉才自然。

```js
// 想让某个 marker 永远在最上层
const important = new Marker([30.27, 120.15], {zIndexOffset: 1000}).addTo(map);

// 悬停时抬升（默认关闭）
new Marker([30.30, 120.20], {riseOnHover: true, riseOffset: 250}).addTo(map);
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `zIndexOffset` | `0` | 在纬度序基础上加的偏移，正数更大 |
| `riseOnHover` | `false` | 悬停时临时抬升 |
| `riseOffset` | `250` | 抬升的量 |

2.0 增加了一条：**获得键盘焦点的 marker 永远会被提到最前**，不受 `riseOnHover` 控制。beta.3 更新日志的原话是 `riseOnHover only controls hover: focused markers always come to the front`。如果业务上依赖 `zIndexOffset` 做严格分层，要注意焦点会打破它。

## 8.2 图标体系：Icon / DefaultIcon / DivIcon

### 8.2.1 三个类的关系

```text
Icon            基础类：iconUrl + iconSize + iconAnchor + shadow*
  ├── DefaultIcon   默认蓝色图钉，内联 SVG data URI，支持 color 选项
  └── DivIcon       用 <div> 代替图片，可放任意 HTML
```

`Icon` 的必填项只有 `iconUrl`，其余都可选：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `iconUrl` | `null` | **必填**，图标图片地址 |
| `iconRetinaUrl` | `null` | 高分屏图标地址 |
| `iconSize` | `null` | 图标尺寸（像素），数字表示正方形 |
| `iconAnchor` | `null` | 对准经纬度的点；有 size 时默认居中 |
| `popupAnchor` | `[0, 0]` | 弹窗相对 iconAnchor 的偏移 |
| `tooltipAnchor` | `[0, 0]` | tooltip 的挂载点偏移 |
| `shadowUrl` | `null` | 阴影图片，不给就没有阴影 |
| `shadowSize` / `shadowAnchor` | `null` | 阴影的尺寸与锚点 |
| `className` | `''` | 加到图标与阴影元素上的类名 |
| `crossOrigin` | `false` | 跨域属性，读取像素数据时必须设 |

### 8.2.2 自定义图片图标

```js
import {Icon, Marker} from 'leaflet';

const pin = new Icon({
  iconUrl: '/assets/icons/pin.png',
  iconRetinaUrl: '/assets/icons/pin@2x.png',
  iconSize: [32, 40],
  iconAnchor: [16, 40],      // 底部尖端
  popupAnchor: [0, -40],     // 弹窗在图标上方
  tooltipAnchor: [16, -20],
  shadowUrl: '/assets/icons/pin-shadow.png',
  shadowSize: [40, 40],
  shadowAnchor: [16, 40]
});

new Marker([30.27, 120.15], {icon: pin}).addTo(map);
```

四个坐标值要成套调：`iconSize` 决定元素尺寸，`iconAnchor` 决定"哪个点贴地"，`popupAnchor` 与 `tooltipAnchor` 决定附属 UI 的落点。改了一个不改其他，最常见的结果是"弹窗盖住图标"或"图标悬在半空"。

### 8.2.3 2.0 的默认图标：内联 SVG

1.x 的默认图标是三张 PNG（`marker-icon.png`、`marker-icon-2x.png`、`marker-shadow.png`），放在 `dist/images/`。打包器不会自动处理 CSS 里的图片引用，于是"图标 404"成了 1.x 最著名的社区问题，衍生出一堆 `L.Icon.Default.prototype._getIconUrl` 补丁。

2.0 直接把这个问题的前提去掉了：默认图标是一份内联的 SVG data URI，源码在 `src/layer/marker/DefaultIcon.js`：

```js
const defaultOptions = {
  iconUrl: pin('%23126FC6', '%23107BC2', '%232E6C97', '%233883B7'),
  iconSize: [25, 46],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  color: null
};
```

三个直接后果：

1. **不再有 `dist/images/` 目录**，`leaflet.zip` 里也没有图片要拷；
2. **1.x 的补丁代码必须删掉**，迁移文档明确要求删掉 `delete L.Icon.Default.prototype._getIconUrl` 与 `Icon.Default.mergeOptions({...})` 那一段——因为 `Icon.Default` 与图片文件都不存在了；
3. **可以用 `color` 改颜色**：

```js
import {DefaultIcon, Marker} from 'leaflet';

new Marker([30.27, 120.15], {
  icon: new DefaultIcon({color: 'crimson'})
}).addTo(map);
```

`color` 传任意 CSS 颜色值，内部把 `#` 转义成 `%23` 后拼进 SVG。注意 2.0 的默认图标尺寸是 **25×46**（1.x 是 25×41），因为阴影画进了同一张图里，不再有独立的 shadow 元素。如果你的代码里写死了 1.x 的尺寸，要一起改。

全局换默认图标用 `mergeOptions`：

```js
Marker.mergeOptions({icon: new DefaultIcon({color: '#2e7d32'})});
```

## 8.3 DivIcon：用 HTML 做图标

`DivIcon` 用 `<div>` 代替 `<img>`，忽略 `iconUrl` 与所有 shadow 选项：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `html` | `false` | 内部 HTML；也可传 `HTMLElement` |
| `iconSize` | `[12, 12]` | 尺寸，也可完全交给 CSS |
| `bgPos` | `null` | 背景图偏移，配合 CSS 雪碧图 |
| `className` | `'leaflet-div-icon'` | 元素类名 |

### 8.3.1 文本标签

```js
import {DivIcon, Marker} from 'leaflet';

const label = new DivIcon({
  className: 'poi-label',
  html: '<span>西湖</span>',
  iconSize: [60, 24],
  iconAnchor: [30, 12]
});

new Marker([30.24, 120.15], {icon: label}).addTo(map);
```

配套 CSS 建议写在站点的样式表里（本章正文不内联样式）：

```css
.poi-label {
  background: #fff;
  border: 1px solid #888;
  border-radius: 12px;
  text-align: center;
  line-height: 22px;
  font-size: 12px;
}
```

### 8.3.2 传 DOM 元素而非字符串

`html` 传字符串时会走 `innerHTML`，内容来自用户数据时有 XSS 风险。传 `HTMLElement` 更安全：

```js
const el = document.createElement('div');
el.className = 'badge';
el.textContent = untrustedName;    // 纯文本，不会被解析成 HTML
new Marker(latlng, {icon: new DivIcon({html: el, iconSize: [80, 24]})}).addTo(map);
```

`DivIcon` 的另一个高频用途是编号图标（1、2、3…）与状态标记（红/黄/绿圆点），这类需求用 CSS 类切换比准备一堆图片省事得多。

### 8.3.3 DivIcon 的定位细节

`DivIcon` 与 `Icon` 共享 `iconSize` / `iconAnchor` 的定位逻辑（同一段 `_setIconStyles`），但有一点不同：`DivIcon` **没有阴影**，`createShadow` 返回 `null`。所以给 `DivIcon` 传 `shadowUrl` 不会产生任何效果。

## 8.4 旋转

2.0 新增的能力，选项名是 `rotation`（角度，顺时针），默认 `null` 表示不旋转：

```js
const car = new Marker([30.27, 120.15], {
  rotation: 45,
  icon: new DivIcon({html: '<span class="car">→</span>', iconSize: [24, 24]})
}).addTo(map);

car.setRotation(90);          // 运行时改
console.log(car.getRotation()); // 90
car.setRotation(null);        // 取消旋转
```

源码注释里写了一条容易被忽略的规则：**旋转过的 marker 没有阴影**，即使角度是 0°。原因是阴影是竖直图钉的投影，跟着图标歪掉会很难看。所以如果显式传了 `rotation: 0`，也会得到"无阴影"的 marker。

迁移相关：如果项目用了 leaflet-rotatedmarker 插件，2.0 下它不工作，`rotationAngle` 选项被静默忽略。把 `rotationAngle` 换成 `rotation` 即可。

## 8.5 拖拽

```js
const draggable = new Marker([30.27, 120.15], {
  draggable: true,
  autoPan: true,
  autoPanPadding: [50, 50],
  autoPanSpeed: 10
}).addTo(map);

draggable.on('dragstart', () => console.log('开始拖'));
draggable.on('drag', e => console.log('拖动中', e.latlng));
draggable.on('dragend', e => console.log('结束于', e.target.getLatLng()));

// 运行时开关
draggable.dragging.disable();
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `draggable` | `false` | 是否可拖拽 |
| `autoPan` | `false` | 拖到地图边缘时自动平移 |
| `autoPanPadding` | `[50, 50]` | 距边缘多少像素开始自动平移 |
| `autoPanSpeed` | `10` | 每次自动平移的像素数 |

`draggable` 的实现是一个独立的 `Handler`（`MarkerDrag`），挂在 `marker.dragging` 上，可以在运行时 `enable()` / `disable()`。2.0 beta.3 修了两个拖拽相关的 bug：拖拽中调用 `setIcon` 会中断拖拽、重新加入地图后 `draggable` 状态错误地恢复。如果遇到这类表现，先确认版本不低于 beta.3。

键盘可达性：可拖拽的 marker 获得焦点后，方向键每次移动 10 像素，按住 Shift 每次 30 像素。这是 2.0 新增的，1.x 只能靠鼠标。

## 8.6 事件

Marker 与 Path 一样是 Interactive layer，但默认 **不冒泡**：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `interactive` | `true` | 是否响应指针事件 |
| `bubblingPointerEvents` | `false` | 事件是否冒泡到地图 |
| `keyboard` | `true` | 是否可 Tab 聚焦、Enter/Space 触发点击 |
| `title` | `''` | 浏览器原生 tooltip 文本 |
| `alt` | `'Marker'` | 图标的 `alt` 属性文本 |
| `autoPanOnFocus` | `true` | 键盘聚焦时自动平移到可见范围 |

```js
const m = new Marker([30.27, 120.15], {
  title: '点击查看详情',      // 悬停显示
  alt: '监测站 A',            // 屏幕阅读器读这个
  keyboard: true
}).addTo(map);

m.on('click', e => {
  console.log('点击', e.latlng);
  e.originalEvent.stopPropagation();   // 需要阻止冒泡时手动处理
});
```

无障碍相关的方法都在 2.0 补齐了：可交互 marker 的元素带 `role="button"`、`tabIndex=0`；有弹窗时还会设 `aria-expanded` 与 `aria-controls`；Enter/Space 可以触发点击。`alt` 的默认值 `'Marker'` 会走地图的 `translate` 选项，可以用来做中文翻译。

## 8.7 排错清单

| 现象 | 原因 | 修法 |
|------|------|------|
| 图标 404 / 显示为破图 | 还在用 1.x 的 `dist/images/` 路径，或保留了 1.x 的补丁代码 | 删掉补丁；2.0 用内联 SVG，或给 `Icon` 传自己图片的绝对路径 |
| 图标位置偏了半个身位 | 只设了 `iconSize` 没设 `iconAnchor` | 一起设置，`iconAnchor` 取"贴地点" |
| 弹窗盖住图标 | `popupAnchor` 未调整 | 一般设 `[0, -iconHeight]` 让弹窗在图标上方 |
| `Invalid LatLng object` | 坐标含 `null` / `undefined` / 非法字符串 | 用 `LatLng.validate()` 过滤 |
| 悬停时 marker 不抬升 | `riseOnHover` 默认 `false` | 显式设 `true` |
| 某个 marker 被别的盖住，调 `zIndexOffset` 无效 | 焦点抬升优先于 `zIndexOffset` | 避免依赖严格层级；或用 pane 分组（见第 3 章） |
| `rotation` 无效 | 用了 leaflet-rotatedmarker 的 `rotationAngle` | 换成 `rotation`；插件本身在 2.0 不可用 |
| 旋转后阴影消失 | 设计如此：旋转的 marker 不画阴影 | 需要阴影就自己用 CSS 加 |
| marker 在 `display:none` 的容器里位置错乱 | 隐藏时尺寸为 0，投影计算出错 | 显示后调 `map.invalidateSize()`（见第 4 章） |

## 8.8 生产建议

**用 `DivIcon` 承载业务标签，用 `Icon` 承载图形符号。** 前者改文案只需改字符串，后者需要美术资源。数量大时 `DivIcon` 的 DOM 节点更多，注意配合聚类插件。

**坐标进 Marker 之前先校验。** 2.0 会抛错，这比 1.x 静默画到 (0, 0) 好，但异常会中断整个渲染循环。在数据入口统一过滤：`if (!LatLng.validate(c)) continue;`。

**不要在 `onAdd` 之外的时机改 `icon` 选项。** 运行时换图标用 `setIcon(newIcon)`，它会重建 DOM 并保留位置与弹窗绑定；直接改 `marker.options.icon` 不会立即生效。

**上千个 marker 考虑聚类。** Leaflet 核心不带聚类，需要 leaflet.markercluster 之类的插件；2.0 下要选声明支持 2.0 的版本。纯展示场景也可以退一步：把点渲染进 Canvas 或服务端预聚合成网格。

## 8.9 本章小结

| 要点 | 结论 |
|------|------|
| 定位 | `latLngToLayerPoint` → `transform` 平移；`iconAnchor` 通过负 margin 实现"贴地" |
| 层级 | 按纬度排序，`zIndexOffset`（默认 `0`）微调；2.0 起焦点 marker 永远最前 |
| 默认图标 | 2.0 改为内联 SVG，25×46，支持 `color`；1.x 的 PNG 补丁必须删除 |
| 自定义图标 | `Icon` 需 `iconUrl` + `iconSize` + `iconAnchor` 成套设置 |
| DivIcon | HTML 做图标，无阴影，默认 `iconSize: [12, 12]`；传 `HTMLElement` 避免 XSS |
| 旋转 | `rotation`（2.0 新增），旋转后无阴影；旧插件 `rotationAngle` 无效 |
| 拖拽 | `draggable`（默认 `false`）+ `marker.dragging` 运行时开关；键盘可用方向键移动 |
| 事件 | 默认 `bubblingPointerEvents: false`，与 Path 相反 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第07章-矢量图层与路径绘制/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第09章-弹窗Popup与工具提示/" class="chapter-nav__next">下一章 →</a>
</div>

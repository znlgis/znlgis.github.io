---
layout: default
title: 第09章 - 弹窗 Popup 与工具提示
---

# 第09章 - 弹窗 Popup 与工具提示

弹窗（Popup）与工具提示（Tooltip）在 Leaflet 里是同一套东西的两个形态：都继承自 `DivOverlay`，都是"带位置的浮动 HTML 容器"，都通过 `bindPopup()` / `bindTooltip()` 挂到图层上。差别在于交互语义——Popup 点击打开、有箭头与关闭按钮、同一时刻只应有一个；Tooltip 悬停即显、可以常驻、不带关闭按钮。

2.0 在这里做了一处架构调整：`DivOverlay` 不再继承 `Layer`，改为继承 `LayerBase`。迁移文档的说法是 `Popups and tooltips are no longer instanceof Layer`。它们仍然支持 `addTo()`、`openOn()`、`map.addLayer()`，但不再享有 `Layer` 上的 `bindPopup` 之类能力。实际影响：如果代码里有 `popup instanceof L.Layer` 的判断，2.0 下会走另一个分支。

## 9.1 两种绑定方式

### 9.1.1 绑到图层上（推荐）

```js
import {LeafletMap, TileLayer, Marker} from 'leaflet';

const map = new LeafletMap('map').setView([30.27, 120.15], 13);
new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

const marker = new Marker([30.27, 120.15]).addTo(map);

marker.bindPopup('<b>监测站 A</b><br>PM2.5: 42', {
  maxWidth: 280,
  autoPan: true
});

// 首次打开
marker.openPopup();
```

`bindPopup` 做三件事：创建一个 `Popup` 实例（或复用传入的实例）、注册 `click` 事件、把弹窗挂到图层的 `_popup` 上。之后点击图层就会打开弹窗。

内容可以是字符串、`HTMLElement`、`DocumentFragment`，或返回其中之一的函数：

```js
// 函数形式：每层用不同的内容
marker.bindPopup(layer => {
  const latlng = layer.getLatLng();
  return '<b>坐标</b><br>' + latlng.lat.toFixed(4) + ', ' + latlng.lng.toFixed(4);
});
```

### 9.1.2 独立弹窗

```js
import {Popup} from 'leaflet';

const popup = new Popup({maxWidth: 300, autoPan: true})
  .setLatLng([30.27, 120.15])
  .setContent('<b>独立弹窗</b>')
  .openOn(map);

// 也可以直接挂到地图上（不会自动关闭其他弹窗）
popup.addTo(map);
```

`openOn` 与 `addTo` 的区别在源码里写得很清楚：`openOn` 会先检查 `map._popup` 是否设置了 `autoClose`，是则移除上一个弹窗；`addTo` 不检查。要做"同屏多个弹窗"就用 `addTo`，要"一次只显示一个"就用 `openOn` 或 `map.openPopup()`。

## 9.2 Popup 的选项

`src/layer/Popup.js` 的默认值：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `pane` | `'popupPane'` | 所在 pane，z-index 700 |
| `offset` | `[0, 7]` | 相对锚点的偏移像素 |
| `maxWidth` | `300` | 最大宽度（像素） |
| `minWidth` | `50` | 最小宽度（像素） |
| `maxHeight` | `null` | 设置后内容超高时出现滚动条，容器带 `leaflet-popup-scrolled` 类 |
| `autoPan` | `true` | 弹窗超出视口时自动平移地图 |
| `autoPanPadding` | `[5, 5]` | 自动平移的边距 |
| `autoPanPaddingTopLeft` / `autoPanPaddingBottomRight` | `null` | 分别指定两侧边距（有固定侧边栏时用） |
| `keepInView` | `false` | 禁止用户把弹窗拖出视野（需要配合地图拖动事件） |
| `closeButton` | `true` | 是否显示右上角关闭按钮 |
| `closeButtonLabel` | `'Close popup'` | 关闭按钮的无障碍标签，可被 `translate` 翻译 |
| `autoClose` | `true` | 打开新弹窗时自动关闭旧的 |
| `closeOnEscapeKey` | `true` | 按 Esc 关闭 |
| `trackResize` | `true` | 内容尺寸变化（如图片加载）时重新定位 |
| `className` | `''` | 自定义类名 |

### 9.2.1 宽度与滚动

`maxWidth: 300` 是默认上限，超长文本会自动换行。如果要固定宽度，同时设 `minWidth` 与 `maxWidth` 为同一值：

```js
marker.bindPopup(longHtml, {
  minWidth: 360,
  maxWidth: 360,
  maxHeight: 240      // 超过 240px 出滚动条
});
```

`maxHeight` 有个坑：它给的是内容容器的高度上限，弹窗的箭头与内外边距仍会额外占据空间。想让"弹窗总高度"不超过 300px，设 `maxHeight` 时要留出余量（约 40px 箭头 + padding）。

### 9.2.2 自动平移

`autoPan: true` 时，弹窗打开前会计算它是否会超出视口，超出就平移地图。这在"点击靠近屏幕边缘的 marker"时体验很好，但有两个副作用：

1. 每次打开都可能触发一次地图移动，如果同时监听了 `moveend` 做数据加载，会造成额外请求；
2. 与 `maxBounds` 冲突时，平移会被边界卡住，弹窗仍可能被裁切。

用 `autoPanPaddingTopLeft` / `autoPanPaddingBottomRight` 给"侧边栏/工具栏"留位置：

```js
new Popup({
  autoPan: true,
  autoPanPaddingTopLeft: [60, 80],       // 左侧 60px、顶部 80px 不放弹窗
  autoPanPaddingBottomRight: [20, 20]
});
```

### 9.2.3 关闭行为的四个开关

| 场景 | 控制项 | 默认 |
|------|--------|------|
| 点击地图空白处关闭 | `map` 的 `closePopupOnClick`，可被弹窗的 `closeOnClick` 覆盖 | 关闭 |
| 打开新弹窗时关闭旧弹窗 | `autoClose` | 关闭旧弹窗 |
| 按 Esc 关闭 | `closeOnEscapeKey` | 关闭 |
| 点击弹窗自身 | 不关闭 | — |

```js
// 允许同屏多个弹窗 + 点地图不关闭
const map = new LeafletMap('map', {center: [30.27, 120.15], zoom: 13, closePopupOnClick: false});
marker.bindPopup('常驻', {autoClose: false});
```

## 9.3 Tooltip 的选项

`src/layer/Tooltip.js` 的默认值：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `pane` | `'tooltipPane'` | 所在 pane，z-index 650 |
| `offset` | `[0, 0]` | 相对锚点的偏移 |
| `direction` | `'auto'` | 方向：`right` / `left` / `top` / `bottom` / `center` / `auto` |
| `permanent` | `false` | 常驻显示还是悬停显示 |
| `sticky` | `false` | 是否跟随指针移动 |
| `opacity` | `0.9` | 整体透明度 |
| `className` | `''` | 自定义类名 |

`direction: 'auto'` 会在左右之间动态切换：弹窗靠近左边界时朝右开，靠近右边界时朝左开。方向决定的是"提示框的哪个点贴在锚点上"，源码里的映射表是：

```js
const directions = {
  top: [0.5, 1],     // 提示框水平居中、底边贴锚点
  bottom: [0.5, 0],
  center: [0.5, 0.5],
  right: [0, 0.5],   // 左边中点贴锚点
  left: [1, 0.5]
};
```

### 9.3.1 悬停提示

```js
marker.bindTooltip('监测站 A', {
  direction: 'top',
  offset: [0, -40]      // 向上让开图标
});
```

`Tooltip` 的默认偏移是 `[0, 0]`，而 marker 的 `tooltipAnchor` 默认是 `[16, -28]`（见第 8 章）。两个偏移会叠加，所以给 marker 挂 tooltip 时通常不需要再改 `offset`，除非要微调。

### 9.3.2 常驻标签

```js
const label = new Marker([30.27, 120.15]).addTo(map);
label.bindTooltip('A 站', {permanent: true, direction: 'right'});
```

`permanent: true` 时，tooltip 在图层加入地图后立即显示，不依赖悬停。源码里的判断在 `bindTooltip` 中：

```js
if (this._tooltip.options.permanent && this._map?.hasLayer(this)) {
  this.openTooltip();
}
```

注意这个判断要求图层已经在地图上。先 `bindTooltip` 再 `addTo` 的场景，靠的是 `_initTooltipInteractions` 里注册的 `add@ 事件。

### 9.3.3 sticky：跟着指针走

```js
new Polygon(coords, {
  color: '#3388ff'
}).bindTooltip('面积 3.2 km²', {sticky: true}).addTo(map);
```

`sticky: true` 时，tooltip 的位置跟着 `pointermove` 事件走，而不是固定在几何中心。适合大面积多边形——用户指到哪就显示到哪。它依赖 `_moveTooltip` 里的判断：只有 `sticky` 且 `originalEvent` 存在时才用 `pointerEventToLatLng` 重新取值。

### 9.3.4 键盘聚焦时的提示

2.0 修了一个 1.x 的老问题：tooltip 只在**键盘焦点**（`:focus-visible`）时打开，不再因为"窗口重新获得焦点"或"弹窗关闭后焦点回到图层"而意外弹出。源码里对这个行为的注释是：

```js
// open only on keyboard focus: an element clicked with the mouse keeps focus and gets it again whenever the
// window is refocused or a popup closes, which would open the tooltip without the pointer over the layer
```

对开发者意味着：不要指望用鼠标点一下图层就让 tooltip 常驻；那应该用 `permanent: true`。

## 9.4 方法一览

`Layer` 上成对的 popup / tooltip 方法（两者结构完全对称）：

| Popup | Tooltip | 说明 |
|-------|---------|------|
| `bindPopup(content, opts)` | `bindTooltip(content, opts)` | 绑定内容并注册打开事件 |
| `unbindPopup()` | `unbindTooltip()` | 解绑并关闭 |
| `openPopup(latlng?)` | `openTooltip(latlng?)` | 打开；不传坐标时用图层默认锚点 |
| `closePopup()` | `closeTooltip()` | 关闭 |
| `togglePopup()` | `toggleTooltip()` | 切换 |
| `isPopupOpen()` | `isTooltipOpen()` | 是否打开 |
| `setPopupContent(content)` | `setTooltipContent(content)` | 改内容 |
| `getPopup()` | `getTooltip()` | 取实例 |

2.0 修正了两个返回值语义：`closeTooltip()` 返回图层本身（1.x 返回 tooltip），`isTooltipOpen()` 在未绑定时返回 `false`（1.x 返回 `undefined`）。迁移文档把它们列在"静默变更"里。

还有一条容易踩的：`openPopup()` 不传坐标时，要求图层能提供中心点。源码里的 `_prepareOpen` 会依次尝试 `getCenter()`、`getLatLng()`、`getBounds().getCenter()`，三者都没有就抛 `Unable to get source layer LatLng`。

## 9.5 内容与安全

字符串内容会被当作 HTML 插入（`innerHTML`）。官方文档在 Popup 与 Tooltip 的说明里都写了同一句安全提醒：

> Popup string content is rendered as HTML. If your content may include untrusted input, sanitize it first, or build a DOM element using `textContent` to render it as plain text.

正确做法：

```js
const el = document.createElement('div');
const title = document.createElement('strong');
title.textContent = user.name;        // 用户数据走 textContent
el.append(title);
el.append(document.createTextNode(' 评分：' + user.score));
marker.bindPopup(el);
```

需要富文本时用 DOMPurify 之类的库白名单过滤，不要自己写正则。

2.0 beta.3 还修了一个 `DocumentFragment` 的 bug：以前第一次打开后内容会变空。现在 fragment 的子节点会被缓存并在每次更新时重新插入。如果项目里有"用 fragment 建复杂弹窗"的写法，确认版本不低于 beta.3。

## 9.6 事件

| 事件 | 触发对象 | 事件属性 |
|------|----------|----------|
| `popupopen` | 地图、绑定它的图层 | `popup` |
| `popupclose` | 地图、绑定它的图层 | `popup` |
| `tooltipopen` | 地图、绑定它的图层 | `tooltip` |
| `tooltipclose` | 地图、绑定它的图层 | `tooltip` |
| `contentupdate` | 弹窗 / 提示自身 | — |
| `autopanstart` | 地图 | — |

```js
map.on('popupopen', e => {
  console.log('打开：', e.popup.getLatLng());
  // 弹窗里的 DOM 此时已存在，可以查节点
  const btn = e.popup.getElement().querySelector('.detail-btn');
  btn?.addEventListener('click', () => loadDetail());
});
```

在 `popupopen` 里绑内层按钮的点击是最常用的模式，因为弹窗内容每次打开都可能重建。

## 9.7 排错清单

| 现象 | 原因 | 修法 |
|------|------|------|
| `popup instanceof L.Layer` 为 `false` | 2.0 改了继承链 | 用 `instanceof L.DivOverlay` 或判断 `typeof popup.openOn` |
| 弹窗打开后被裁切 / 偏出屏幕 | `autoPan` 关闭，或与 `maxBounds` 冲突 | 打开 `autoPan`，并检查 `maxBounds` |
| 弹窗盖住 fixed 定位的侧边栏 / 导航 | 地图容器有 `isolation: isolate`（2.0 新增） | 给地图容器设 `z-index` 整体调整层级 |
| `Unable to get source layer LatLng` | 图层没有 `getCenter` / `getLatLng` / `getBounds` | 调 `openPopup(latlng)` 显式传坐标 |
| tooltip 在鼠标点击后不消失 | 用了 `permanent: true` 或 `sticky: true` 但忘了关闭 | 手动 `closeTooltip()`，或改用非 permanent |
| 悬停 tooltip 闪烁 | 弹窗与 tooltip 的判定区域重叠 | 调整 `offset` / `direction`，避免 tooltip 压住鼠标 |
| 弹窗内图片加载后位置错乱 | 内容尺寸变化未触发重排 | 2.0 默认 `trackResize: true` 可解；老版本手动 `popup.update()` |
| 弹窗关闭后焦点跳到页面顶部 | 焦点在弹窗内且被移除 | 2.0 已处理：焦点会回到来源元素或地图容器 |
| 移动端长按出现图片保存菜单 | marker 图标被当作图片 | 2.0 已修；确保 CSS 里没有覆盖 `-webkit-touch-callout` |

## 9.8 生产建议

**一次只开一个弹窗。** 用 `map.openPopup()` 或 `openOn()`，不要用 `addTo`。多个弹窗同屏在移动端会互相遮挡，而且每个都要做自动平移，体验很乱。

**弹窗内容尽量轻。** 弹窗打开时才创建 DOM，里面塞图表或 iframe 会明显卡顿。重型内容改为"弹窗里放按钮，点击后打开侧边栏"。

**无障碍别漏。** 2.0 给键盘可达的 marker 加了 `aria-expanded` 与 `aria-controls`，弹窗本身带 `role` 语义与关闭按钮标签。自定义弹窗结构时保留这些属性；`closeButtonLabel` 可以用 `translate` 翻译成中文。

**tooltip 优先用 `permanent` 做标签、用悬停做补充信息。** 悬停 tooltip 在触屏上不可用（没有 hover 状态），移动端要么改 `permanent`，要么靠点击弹窗。这是移动适配里最容易被漏掉的一条。

## 9.9 本章小结

| 要点 | 结论 |
|------|------|
| 继承关系 | 2.0 起 `DivOverlay` 继承 `LayerBase`，不再 `instanceof Layer` |
| 打开方式 | `openOn()` 会自动关旧弹窗，`addTo()` 不会 |
| Popup 默认值 | `offset: [0, 7]`、`maxWidth: 300`、`minWidth: 50`、`autoPan: true`、`autoClose: true` |
| Tooltip 默认值 | `direction: 'auto'`、`permanent: false`、`sticky: false`、`opacity: 0.9` |
| 内容安全 | 字符串走 `innerHTML`；用户数据用 `textContent` 或先消毒 |
| 事件 | `popupopen` / `popupclose` / `tooltipopen` / `tooltipclose` 同时在地图与图层上触发 |
| 键盘 | tooltip 只在 `:focus-visible` 时打开；Enter/Space 可触发 marker 的点击 |
| 移动端 | 悬停 tooltip 不可用，改用 `permanent` 或点击弹窗 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第08章-标记Marker与图标体系/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第10章-控件系统与界面定制/" class="chapter-nav__next">下一章 →</a>
</div>

---
layout: default
title: 第06章 - 瓦片图层与 OGC 地图服务
---

# 第06章 - 瓦片图层与 OGC 地图服务
栅格瓦片是 Leaflet 里唯一"能撑满全屏且不卡"的底图形态。瓦片图层的类层次只有三层：

```text
GridLayer          管"格子"：算可见范围、创建/回收 DOM 元素、控制透明度与层级
  └── TileLayer    管"URL"：把 {z}/{x}/{y} 填进模板，加载 <img>
        └── WMSTileLayer  管"参数"：把 WMS 的 bbox、layers、srs/crs 拼进 URL
```

这个分层决定了扩展方式：想换瓦片来源，继承 `TileLayer` 重写 `getTileUrl`；想换瓦片内容形态（canvas、div、video），继承 `GridLayer` 实现 `createTile`。搞混这两个扩展点，会写出"拿不到 URL"或"瓦片不显示"的代码。

## 6.1 GridLayer：格子管理器

### 6.1.1 它做什么

`GridLayer` 不关心瓦片是什么。它的职责是：根据当前视图算出需要哪些 `(x, y, z)`，为每个格子调用 `createTile` 拿到一个 `HTMLElement`，把它绝对定位到正确位置，并在移出视野后回收。

关键选项：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `tileSize` | `256` | 瓦片边长（像素）；可传 `Point(w, h)` 用非方形瓦片 |
| `opacity` | `1` | 整层透明度，可运行时 `setOpacity()` |
| `updateWhenIdle` | `false` | `true` 时只在平移结束后加载新瓦片（省请求，拖动时留白） |
| `updateWhenZooming` | `true` | 缩放动画过程中是否逐级更新 |
| `updateInterval` | `200` | 平移时最多每 200 ms 更新一次 |
| `keepBuffer` | `2` | 视野外保留几圈瓦片再回收 |
| `minZoom` / `maxZoom` | `0` / `undefined` | 本层可见的层级范围 |
| `minNativeZoom` / `maxNativeZoom` | `undefined` | 瓦片服务实际拥有的层级；超出时用边界层级缩放显示 |
| `noWrap` | `false` | `true` 时不在水平方向重复世界副本 |
| `pane` | `'tilePane'` | 默认在瓦片 pane |
| `zIndex` | `1` | 图层叠放顺序 |
| `bounds` | `null` | 只在这些经纬度范围内加载 |

`minNativeZoom` / `maxNativeZoom` 是最常被忽略的一对。它们解决的是"地图能缩放到 19，但服务商只提供到 17"的问题：

```js
new TileLayer('https://tiles.example.com/{z}/{x}/{y}.png', {
  minZoom: 0,
  maxZoom: 19,
  maxNativeZoom: 17   // 18、19 级用 17 级的瓦片放大显示
}).addTo(map);
```

源码里的实现是一个简单的夹取：

```js
_clampZoom(zoom) {
  const options = this.options;
  if (undefined !== options.minNativeZoom && zoom < options.minNativeZoom) {
    return options.minNativeZoom;
  }
  if (undefined !== options.maxNativeZoom && options.maxNativeZoom < zoom) {
    return options.maxNativeZoom;
  }
  return zoom;
}
```

所以 18 级时实际请求的是 `/{z}/` 填 17 的瓦片，再由浏览器放大。代价是模糊，收益是不会出现"放大后一片空白"。

### 6.1.2 继承 GridLayer 画自定义瓦片

`GridLayer` 唯一的必须实现是 `createTile(coords, done?)`，返回一个 `HTMLElement`。下面的例子在瓦片上画坐标文字，做瓦片网格调试：

```js
import {LeafletMap, GridLayer, DomUtil} from 'leaflet';

class CoordTileLayer extends GridLayer {
  createTile(coords) {
    const tile = DomUtil.create('div', 'leaflet-tile');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    tile.style.cssText = 'font:12px monospace;color:#333;background:#fff;border:1px solid #ccc;';
    tile.textContent = coords.x + ',' + coords.y + ',' + coords.z;
    return tile;
  }
}

const map = new LeafletMap('map').setView([30.27, 120.15], 4);
new CoordTileLayer().addTo(map);
```

异步场景（例如用第三方库渲染到 canvas）用第二个参数 `done`：

```js
createTile(coords, done) {
  const canvas = document.createElement('canvas');
  const size = this.getTileSize();
  canvas.width = size.x;
  canvas.height = size.y;
  renderAsync(coords, canvas)
    .then(() => done(null, canvas))
    .catch(err => done(err, canvas));
  return canvas;      // 必须同步返回元素，done 只负责通知"画完了"
}
```

`done(err)` 会触发 `tileerror` 事件。注意 `createTile` 必须**同步返回**一个元素，`done` 只是告诉 GridLayer 这个瓦片可以显示了。

## 6.2 TileLayer：URL 模板

### 6.2.1 模板占位符

`TileLayer` 的构造函数第一个参数是 URL 模板，支持这些占位符：

| 占位符 | 含义 |
|--------|------|
| `{z}` | 层级 |
| `{x}` / `{y}` | 列号 / 行号（TMS 方案里 y 从下往上） |
| `{-y}` | 反序行号，等价于 `(2^z - 1 - y)` |
| `{s}` | 子域名，从 `subdomains` 里按顺序取 |
| `{r}` | 设备像素比大于 1 时为 `'@2x'`，否则空字符串 |
| `其他键` | 从图层的 `options` 里取同名属性 |

例如要带 token：

```js
new TileLayer('https://tiles.example.com/{z}/{x}/{y}.png?key={tk}', {
  tk: 'YOUR_TOKEN',
  subdomains: 'abc',
  maxZoom: 18
});
```

源码里的替换逻辑是 `Util.template(this._url, data)`，其中 `data` 由 `options` 加 `r/s/x/y/z` 组成。有一个细节：找不到对应值时 `Util.template` 会抛 `No value provided for variable {`xxx`}`，所以 `subdomains` 错写成不存在的键会直接报错。

### 6.2.2 TMS 与 y 轴方向

大多数 XYZ 服务（Google、OSM、高德）的 y 轴从上往下，TMS 规范从下往上。用 `tms: true` 切换：

```js
// TMS 服务：y 从下往上
new TileLayer('https://server/tms/{z}/{x}/{y}.png', {tms: true});

// 等价写法：用 {-y}
new TileLayer('https://server/tiles/{z}/{x}/{-y}.png');
```

两个都写反而会更正两次，症状是"地图上下颠倒且拼接错乱"。判断方法：如果瓦片边界对得上但整体上下翻转，就是 y 轴方向问题。

### 6.2.3 subdomains 与并发

浏览器对同一域名的并发连接数有限制（HTTP/1.1 约 6 个），瓦片服务常用多子域名绕开：

```js
new TileLayer('https://{s}.tile.example.com/{z}/{x}/{y}.png', {
  subdomains: ['a', 'b', 'c', 'd'],
  maxZoom: 19
});
```

`subdomains` 可以是字符串 `'abcd'`（每个字符一个）或数组。HTTP/2 下多域名收益很小，反而增加 DNS 与连接开销——如果服务端已经上 HTTP/2，用单域名。

### 6.2.4 detectRetina 的实际行为

`detectRetina: true` 时，若 `devicePixelRatio >= 1.5`，TileLayer 会做四件联动的事（构造函数里直接改 `options`）：

```text
tileSize     → 减半（256 → 128）
zoomOffset   → +1
maxZoom      → -1
maxNativeZoom / minNativeZoom → 各 -1（若设置了）
```

本质是"用高一层的瓦片、按半尺寸显示"，等效于请求 2 倍图。副作用是请求量翻四倍、且 URL 里的 `{z}` 与地图层级不再一一对应。如果服务商支持 `{r}` 占位符，用 `{r}` 更简单，不需要开 `detectRetina`。

## 6.3 WMSTileLayer：把 OGC 服务当瓦片

### 6.3.1 默认参数

`WMSTileLayer` 继承 `TileLayer`，把 WMS 的 GetMap 请求参数拼进 URL。默认的 WMS 参数是：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `service` | `'WMS'` | 固定 |
| `request` | `'GetMap'` | 固定 |
| `layers` | `''` | **必填**，逗号分隔的图层名 |
| `styles` | `''` | 逗号分隔的样式名 |
| `format` | `'image/jpeg'` | 有透明度的图层要改 `'image/png'` |
| `transparent` | `false` | 透明背景开关 |
| `version` | `'1.1.1'` | WMS 版本 |

图层自身的选项只有两个：`crs`（默认 `null`，即跟随地图的 CRS）与 `uppercase`（默认 `false`，为 `true` 时参数名转大写）。

### 6.3.2 一个可用的 GeoServer 示例

```js
import {LeafletMap, WMSTileLayer} from 'leaflet';

const map = new LeafletMap('map').setView([30.27, 120.15], 9);

new WMSTileLayer('http://localhost:8080/geoserver/wms', {
  layers: 'workspace:roads',        // GeoServer 里要求 "工作区:图层名"
  format: 'image/png',
  transparent: true,
  version: '1.3.0',
  attribution: '&copy; 自建 GeoServer'
}).addTo(map);
```

### 6.3.3 轴序陷阱：WMS 1.3.0 + EPSG:4326

这是 WMS 最著名的坑。源码 `getTileUrl` 里有一段专门的判断：

```js
const bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ?
  [min.y, min.x, max.y, max.x] :     // 纬度在前
  [min.x, min.y, max.x, max.y])      // 经度在前
  .join(',');
```

WMS 1.3.0 在 EPSG:4326 下要求 bbox 按 `miny,minx,maxy,maxx` 排列（纬度在前），1.1.1 则是 `minx,miny,maxx,maxy`。Leaflet 会按 `version` 与 `crs` 自动处理，但有两个前提：

1. `version` 必须真的传对。声明 1.3.0 但服务端只认 1.1.1，就会拿到"图片整体转了 90 度"或空白；
2. 自定义 `crs` 时，比较的是 `this._crs === EPSG4326`（对象恒等），传一个自制对象不会走纬度优先分支。

### 6.3.4 参数与版本切换

`setParams` 可以运行时改参数并重绘：

```js
const wms = new WMSTileLayer('http://localhost:8080/geoserver/wms', {
  layers: 'workspace:roads',
  format: 'image/png',
  transparent: true
}).addTo(map);

// 换图层，不重建对象
wms.setParams({layers: 'workspace:buildings'});
// 第二个参数 noRedraw=true 只改参数不立即重绘
wms.setParams({styles: 'highlight'}, true);
```

参数名大小写由 `uppercase` 控制。有些老服务端（尤其 .NET 系）要求全大写，设 `uppercase: true` 即可。

自定义参数会被原样拼进 URL。源码注释说明：`If any custom options not documented here are used, they will be sent to the WMS server as extra parameters`。这给了传 vendor 参数（如 GeoServer 的 `CQL_FILTER`）的能力，但要注意值里不能有未编码的 `&`。

## 6.4 事件与错误处理

GridLayer 事件：

| 事件 | 触发时机 | 事件对象关键字段 |
|------|----------|------------------|
| `loading` | 开始加载瓦片 | — |
| `tileloadstart` | 单个瓦片开始请求 | `tile`、`coords` |
| `tileload` | 单个瓦片加载完成 | 同上 |
| `tileerror` | 单个瓦片出错 | 同上 |
| `tileunload` | 瓦片被移除出视野 | 同上 |
| `load` | 所有可见瓦片加载完毕 | — |

用 `tileerror` 做兜底：

```js
const layer = new TileLayer('https://tiles.example.com/{z}/{x}/{y}.png', {
  maxZoom: 18,
  errorTileUrl: 'https://tiles.example.com/blank.png'
}).addTo(map);

let errors = 0;
layer.on('tileerror', e => {
  errors++;
  if (errors === 1) {
    console.warn('首个瓦片失败：', e.coords, e.tile.src);
  }
});
```

`errorTileUrl` 是专门为"某些层级没有数据"设计的：把失败瓦片替换成一张占位图，避免出现破图图标。

## 6.5 排错清单

| 现象 | 原因 | 修法 |
|------|------|------|
| 整层空白，`tileerror` 大量触发 | URL 模板错、跨域被拒、token 失效 | 用 DevTools Network 看实际请求 URL；核对 `{z}/{x}/{y}` 是否被替换 |
| 瓦片上下颠倒 | y 轴方向与 TMS 不匹配 | 加 `tms: true`，或改用 `{-y}`（二者不要同时） |
| 瓦片整体旋转 90° | WMS 1.3.0 与 1.1.1 的轴序差异 | 显式指定与服务端一致的 `version` |
| 放大到某一级后空白 | 服务端没有该层级瓦片 | 设 `maxNativeZoom`（以及 `minNativeZoom`） |
| 缩小时地图出现多份 | 世界副本重复 | `noWrap: true`，或配合 `bounds` 限制 |
| 底图叠了两层、请求量翻倍 | 多个底图同时 `addTo` | 切换时先 `removeLayer`（见第 5 章） |
| 高分屏上瓦片模糊 | 没开 `detectRetina` 或服务端无 2 倍图 | 用 `{r}` 占位符，或开 `detectRetina` |
| 拖动时地图频繁闪烁 | `updateWhenIdle: false` + 网络慢 | 试 `updateWhenIdle: true` 并配合 `keepBuffer: 3` |
| 瓦片请求被浏览器缓存穿透 | 服务端没给 `Cache-Control` | 服务端加缓存头；客户端无解 |

## 6.6 生产建议

**瓦片服务的坐标系必须是 Web Mercator（EPSG:3857）。** Leaflet 默认 CRS 就是 `EPSG3857`，瓦片网格按它的投影切分。服务端若用 EPSG:4326 切片，要么换 `crs: EPSG4326`（此时瓦片方案与常见 XYZ 不兼容），要么在服务端重切。

**`maxNativeZoom` 一定要设。** 不设的后果不是报错，而是"用户放大到 19 级看到一片灰"。设了之后至少是"放大后模糊但可见"。

**`updateWhenIdle` 与 `keepBuffer` 是一对调优参数。** 移动端弱网优先"少请求"：`updateWhenIdle: true` + `keepBuffer: 3`；桌面端体验优先保留默认值。

**注意 CORS 与 referrerPolicy。** 2.0 把 TileLayer 的 `referrerPolicy` 默认值改成了 `'strict-origin-when-cross-origin'`，官方文档特别提醒：使用 `tile.openstreetmap.org` 时**不要改这个值**，OSM 的瓦片使用政策依赖它。需要读取瓦片像素数据（canvas 导出）时必须设 `crossOrigin: true`，且服务端要返回允许跨域的响应头。

**自建瓦片服务用 `leaflet.zip` + 内网 CDN。** 涉密或内网项目把瓦片与 Leaflet 都放内网，注意 2.0 的 zip 里没有 images 目录（默认图标已改为内联 SVG），不需要额外拷图。

## 6.7 本章小结

| 要点 | 结论 |
|------|------|
| 类层次 | `GridLayer`（格子）→ `TileLayer`（URL）→ `WMSTileLayer`（参数） |
| 两个扩展点 | 换内容形态重写 `createTile`；换 URL 规则重写 `getTileUrl` |
| 常用默认值 | `tileSize: 256`、`maxZoom: 18`（TileLayer）、`subdomains: 'abc'`、`updateInterval: 200`、`keepBuffer: 2` |
| 层级夹取 | `maxNativeZoom` 让超出层级的瓦片放大显示，避免空白 |
| TMS | `tms: true` 或 `{-y}` 二选一，不要同时用 |
| WMS 轴序 | 1.3.0 + EPSG:4326 是纬度在前，Leaflet 自动处理但依赖 `version` 与 `crs` 传对 |
| 调试手段 | `tileerror` + Network 面板看真实请求 URL |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第05章-图层体系与图层控制/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第07章-矢量图层与路径绘制/" class="chapter-nav__next">下一章 →</a>
</div>

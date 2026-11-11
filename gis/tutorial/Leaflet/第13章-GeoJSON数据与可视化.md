---
layout: default
title: 第13章 - GeoJSON 数据与可视化
---

# 第13章 - GeoJSON 数据与可视化

## 13.1 从一份 JSON 到地图上的图形

GIS 后端最常吐出的格式就是 GeoJSON（RFC 7946）。它把几何写成 `[lng, lat]` 坐标数组，把属性挂在 `properties` 上。Leaflet 的 `GeoJSON` 层要做的事只有一件：把每个 Feature 翻译成一个 Leaflet 图层，再按几何类型分派到 Polyline、Polygon、Marker 或 CircleMarker。

翻译规则是固定的，源码 `GeoJSON.geometryToLayer()` 的 `switch` 写死了映射：

| GeoJSON 类型 | 生成的图层 | 嵌套层级 |
| --- | --- | --- |
| `Point` | `Marker`（默认）或 `pointToLayer` 返回的图层 | — |
| `MultiPoint` | `FeatureGroup`，成员是一组 Marker | — |
| `LineString` | `Polyline` | `coordsToLatLngs(coords, 0)` |
| `MultiLineString` | `Polyline`（多段） | 深度 1 |
| `Polygon` | `Polygon` | 深度 1 |
| `MultiPolygon` | `Polygon`（多环） | 深度 2 |
| `GeometryCollection` | `FeatureGroup` | 逐个几何递归 |
| `FeatureCollection` | `FeatureGroup` | 逐个 Feature 递归 |

注意 `MultiPoint` 不是 Marker，而是一个 `FeatureGroup`。这意味着你调用 `layer.setStyle()`、`bindPopup()` 时，行为与单个 Marker 不同：`bindPopup` 会转发给成员，`setStyle` 只对带 `setStyle` 的成员生效。

```js
import {LeafletMap, TileLayer, GeoJSON} from 'leaflet';
import 'leaflet/styles.css';

const map = new LeafletMap('map', {center: [39.9042, 116.4074], zoom: 10});
new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const fc = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			properties: {name: '点位 A', kind: 'poi'},
			geometry: {type: 'Point', coordinates: [116.397, 39.908]}
		},
		{
			type: 'Feature',
			properties: {name: '线路 B', kind: 'route'},
			geometry: {type: 'LineString', coordinates: [[116.35, 39.90], [116.40, 39.92], [116.45, 39.91]]}
		}
	]
};

const layer = new GeoJSON(fc).addTo(map);
map.fitBounds(layer.getBounds());
```

`layer.getBounds()` 来自 `FeatureGroup`，会遍历所有成员，取 `getBounds()` 或 `getLatLng()` 的并集。对刚加载完的 GeoJSON 调 `fitBounds` 是标准开场动作。

## 13.2 addData 的内部顺序

`new GeoJSON(data, options)` 构造函数只做两件事：保存 options，然后如果传了 data 就调 `addData(data)`。`addData` 对每个对象依次执行：

```text
addData(geojson)
 ├─ 数组或带 features 的对象 → 递归展开
 ├─ asFeature(geojson)             裸几何包装成 Feature（properties 为 {}）
 ├─ 空 geometry → 直接 return（2.0 行为）
 ├─ options.filter(feature) 为 false → 直接 return
 ├─ geometryToLayer(feature, options)   按类型造图层
 ├─ layer.feature = feature             挂回引用
 ├─ layer.defaultOptions = layer.options  快照原始样式，给 resetStyle 用
 ├─ resetStyle(layer)                   应用 style 选项
 ├─ options.onEachFeature(feature, layer)  回调
 └─ addLayer(layer)                     加入 FeatureGroup，触发 layeradd
```

这个顺序解释了四个常见疑问：

- **`filter` 在造图层之前执行**，所以被过滤掉的 Feature 不会产生任何 DOM。而且官方类型注释明确写了一句：运行期修改 `filter` 只影响之后 `addData` 的数据，不会重新评估已加载的 Feature。想按条件重绘，得清空重加。
- **`style` 在 `onEachFeature` 之前应用**，回调里可以再 `layer.setStyle()` 覆盖。
- **`onEachFeature` 拿到的 layer 已经在地图外但已完整构建**，适合 `bindPopup`、`on()`，不适合读取像素坐标。
- **`layer.feature` 始终指向原始 Feature 对象**，是取属性的正路，不要从 `e.target.options` 里翻。

2.0 有一处行为变化值得记住：输入是裸几何（没有 `Feature` 包装）时，`filter` 和 `onEachFeature` 收到的是包装后的 Feature，且与 `layer.feature` 是同一个对象；几何为 `null` 的 Feature 会被跳过。1.x 里这两种情况的表现不同，迁移时如果依赖过旧行为，要重新测。

## 13.3 五个选项逐个讲

### 13.3.1 style

`style` 可以是对象，也可以是函数。对象用于“所有线面同样式”，函数用于按属性分级：

```js
// 统一描边
new GeoJSON(fc, {
	style: {color: '#3388ff', weight: 3, opacity: 0.8, fillOpacity: 0.2}
}).addTo(map);

// 按属性设色
function densityStyle(feature) {
	const v = feature.properties.density;
	return {
		fillColor: v > 500 ? '#800026' : v > 100 ? '#E31A1C' : '#FED976',
		weight: 1,
		color: 'white',
		fillOpacity: 0.7
	};
}
```

`style` 只对 `Path`（线、面、圆）生效。点默认生成 `Marker`，Marker 没有 `setStyle`，所以给点设 `style` 无效——这是“点了没变色”的最常见原因。要控制点的外观，走 `pointToLayer`。

### 13.3.2 pointToLayer

函数签名 `(feature, latlng) => Layer`，默认实现是 `new Marker(latlng)`。返回 `CircleMarker` 是最常用的替代，它能吃到 `style` 里的路径样式：

```js
new GeoJSON(fc, {
	pointToLayer(feature, latlng) {
		return new CircleMarker(latlng, {
			radius: 6,
			fillColor: feature.properties.kind === 'poi' ? '#ff7800' : '#3388ff',
			color: '#fff',
			weight: 1,
			fillOpacity: 0.9
		});
	},
	style: {weight: 2}
}).addTo(map);
```

如果仍想用 `Marker` 但想让点继承组选项，加 `markersInheritOptions: true`（默认 `false`）。它只对默认生成的 Marker 有效，`pointToLayer` 自己返回的实例按你自己的参数来。

### 13.3.3 onEachFeature

在图层加入组之前调用，是绑交互的统一入口：

```js
const geo = new GeoJSON(fc, {
	onEachFeature(feature, layer) {
		const p = feature.properties;
		if (p.name) {
			layer.bindTooltip(p.name, {direction: 'top'});
		}
		layer.on('click', () => {
			console.log(feature.geometry.type, p);
		});
	}
}).addTo(map);
```

不要在 `onEachFeature` 里调用 `map.fitBounds()`——此时图层还没加入组，更没加入地图，`getBounds()` 是空的。需要全量范围，等 `GeoJSON` 构造完再调。

### 13.3.4 filter

```js
new GeoJSON(fc, {
	filter: feature => feature.properties.kind === 'poi'
}).addTo(map);
```

过滤是“创建期一次性”的。数据量大时用它先砍掉不需要渲染的要素，比全量加载再做样式隐藏划算得多——后者仍然要为每个 Feature 创建 DOM 或 canvas 绘制指令。

### 13.3.5 coordsToLatLng

默认实现是 `new LatLng(coords[1], coords[0], coords[2])`，即 `[lng, lat]` → `[lat, lng]`。当数据源不是标准 GeoJSON 坐标（例如已经是 `[lat, lng]`，或者带投影坐标）时换掉它：

```js
new GeoJSON(raw, {
	coordsToLatLng(coords) {
		// 数据是 [lat, lng, alt]
		return new LatLng(coords[0], coords[1], coords[2]);
	}
}).addTo(map);
```

**不要**为了“少写一层转换”就改这个函数而数据本身是标准 GeoJSON——坐标系一换，所有几何都会镜像或旋转。

## 13.4 样式重置与动态改色

`GeoJSON` 提供三个样式方法：

| 方法 | 作用 |
| --- | --- |
| `resetStyle(layer?)` | 把图层的 `options` 恢复成创建时的快照，再套用一次 `style` 函数 |
| `setStyle(style)` | 对所有成员应用新样式，参数可以是对象或函数 |
| `eachLayer(fn)` | 遍历成员（继承自 `FeatureGroup`） |

`resetStyle` 的实现依赖 `addData` 时存下的 `layer.defaultOptions`：它把 `layer.options` 换成以快照为原型的对象，再重新求值 `style`。所以悬停高亮 + 移出还原的标准写法是：

```js
let geojson;

function highlight(e) {
	const layer = e.target;
	layer.setStyle({weight: 4, color: '#666', fillOpacity: 0.85});
	layer.bringToFront();
}

function reset(e) {
	geojson.resetStyle(e.target);
}

geojson = new GeoJSON(fc, {
	style: densityStyle,
	onEachFeature(feature, layer) {
		layer.on({pointerover: highlight, pointerout: reset});
	}
}).addTo(map);
```

这里必须用 `resetStyle` 而不是 `setStyle(densityStyle)`。后者不会清除你手动加上的额外属性（比如 `dashArray: ''` 之外的残留），而前者从快照重建，能保证完全回到初始状态。

2.0 的 `Path.setStyle()` 有一个例外：`className` 只在元素创建时应用，后续 `setStyle({className})` 只改 `options`，不改 DOM 的 class。要用 class 控制样式，请在 `pointToLayer` 或 `style` 里就给好。

## 13.5 实战：分级设色 + 悬停高亮

把上面的片段拼成一个完整可用页面：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>GeoJSON 分级设色</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@2.0.0-beta.3/dist/leaflet.css">
	<style>
		html, body, #map { height: 100%; margin: 0; }
		.info { padding: 6px 8px; background: rgba(255,255,255,.9); border-radius: 4px; font: 13px/18px sans-serif; }
	</style>
</head>
<body>
<div id="map"></div>
<script type="importmap">
{
	"imports": {
		"leaflet": "https://cdn.jsdelivr.net/npm/leaflet@2.0.0-beta.3/dist/leaflet.js"
	}
}
</script>
<script type="module">
import {LeafletMap, TileLayer, GeoJSON, Control, DomUtil} from 'leaflet';

const map = new LeafletMap('map').setView([37.8, -96], 4);
new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const grades = [0, 10, 20, 50, 100, 200, 500, 1000];
const colors = ['#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#E31A1C', '#BD0026', '#800026'];

function getColor(d) {
	for (let i = grades.length - 1; i >= 0; i--) {
		if (d > grades[i]) { return colors[i]; }
	}
	return colors[0];
}

function style(feature) {
	return {
		fillColor: getColor(feature.properties.density),
		weight: 1,
		opacity: 1,
		color: 'white',
		fillOpacity: 0.7
	};
}

let geojson;
function highlight(e) {
	geojson.resetStyle(e.target);
	e.target.setStyle({weight: 3, color: '#333'});
	e.target.bringToFront();
}
function unhighlight(e) {
	geojson.resetStyle(e.target);
}

const info = new Control({position: 'topright'});
info.onAdd = function () {
	this._div = DomUtil.create('div', 'info');
	this.update();
	return this._div;
};
info.update = function (props) {
	this._div.innerHTML = props
		? `<b>${props.name}</b><br>${props.density} 人/mi²`
		: '悬停查看详情';
};
info.addTo(map);

geojson = new GeoJSON(statesData, {
	style,
	onEachFeature(feature, layer) {
		layer.on({pointerover: highlight, pointerout: unhighlight});
		layer.on('pointerover', () => info.update(feature.properties));
		layer.on('pointerout', () => info.update());
	}
}).addTo(map);
</script>
</body>
</html>
```

页面里 `statesData` 需要你自己提供一份 FeatureCollection。关键点：`highlight` 里先 `resetStyle` 再 `setStyle`，保证多个要素连续悬停时不会互相污染样式。

## 13.6 反向导出：toGeoJSON

图层能转回 GeoJSON，`Polyline`、`Polygon`、`Marker`、`Circle`、`CircleMarker`、`GeoJSON`、`FeatureGroup`、`LayerGroup` 都有 `toGeoJSON(precision?)`：

```js
const poly = new Polygon([[39.9, 116.3], [39.9, 116.5], [40.0, 116.5]], {color: 'red'}).addTo(map);

const feature = poly.toGeoJSON();
console.log(feature.geometry.type);        // "Polygon"
console.log(feature.geometry.coordinates[0][0]); // [116.3, 39.9] — 已转成 [lng, lat]

// 控制小数位：默认 6 位，false 表示不取整
console.log(poly.toGeoJSON(4));
```

`Circle` 会被导出成 `Point`（只有圆心），半径信息不在标准 GeoJSON 里，这是有损的。`CircleMarker` 同理。要做圆形的可交换表达，自己转成 Polygon 或存成属性。

## 13.7 排错

**控制台报 `Invalid GeoJSON object.`** `geometryToLayer()` 的 `switch` 走到 `default` 分支。原因通常是 `type` 拼错（`'Featurecollection'` 大小写、`'MultiPolygon '` 带空格）或传入的不是 JSON 对象而是字符串。先 `JSON.parse` 再传。

**所有图形都跑到南半球或镜像。** 数据是 `[lat, lng]` 但按标准 GeoJSON 处理，或者相反。标准是 `[lng, lat]`。用 `coordsToLatLng` 之前先确认真实顺序，最直接的验证是打印第一个坐标看经度是否落在 -180~180、纬度是否落在 -90~90；如果两者都在范围内，只能拿一个已知地物对比。

**Polygon 画成了奇怪的交叉形状。** GeoJSON 的 Polygon 要求外环闭合（首尾坐标相同），且多边形的环嵌套层级是 `[ring][point][2]`。少一层数组或漏了闭合点，坐标会被重新连接。手写数据时用 `[ring.map(...)]` 包两层。

**点没有 popup，线面正常。** 点默认是 `Marker`，`bindPopup` 正常可用；如果用了 `pointToLayer` 返回自定义图层但没有 `bindPopup` 实现，自然没有。另外 `filter` 返回 `false` 的要素不会进入 `onEachFeature`。

**`resetStyle` 后样式没变化。** 检查是否在 `addData` 之后又直接改了 `layer.options`，那会破坏快照语义。另外 `resetStyle` 只对带 `setStyle` 的图层有效，Marker 不会变。

**大数据量页面直接卡死。** 默认 SVG 渲染器给每个要素创建一个 `<path>`，几千个还可以，几万个就顶不住。改 `renderer: new Canvas()`（见第 16 章），并且先用 `filter` 砍数据、用 `simplify` 预处理几何。

**`getBounds()` 返回 `NaN`。** 有要素坐标含 `null` 或字符串。2.0 的 `LatLng` 会直接抛错，所以更可能是坐标数组长度为 1 或 2 但含 `undefined`。入库前用 `LatLng.validate()` 校验。

## 13.8 生产建议

- 数据超过 2000 个要素就不要一次性塞进 `GeoJSON`。按视野或按图层分组加载，`moveend` 时用 `map.getBounds()` 请求后端只返回视口内的要素。
- 用 `pointToLayer` + `CircleMarker` 代替默认 Marker。Marker 每个都是一个带图片的 DOM，CircleMarker 在 canvas 下只是绘制指令，几千个点的差距是数量级的。
- 把 `style` 写成纯函数，不要在函数内部读取会变化的全局状态。`resetStyle` 会重新调用它，状态不一致会导致“移出后颜色变了”。
- `onEachFeature` 里只做轻量绑定。给一万个要素各绑一个闭包，内存会翻倍；交互可以改成在 `GeoJSON` 层上监听事件，用 `e.propagatedFrom` 找到来源图层。
- 属性里可能含有 HTML 的数据不要直接 `bindPopup(feature.properties.name)`，用 `textContent` 或先转义。`bindPopup` 传字符串会当 HTML 解析。
- `toGeoJSON` 的默认精度是 6 位小数，与入库精度一致；需要更高精度显式传 `false`，但要注意体积膨胀。

## 13.9 本章小结

| 要点 | 结论 |
| --- | --- |
| 类关系 | `GeoJSON` 继承 `FeatureGroup`，成员是按几何类型生成的图层 |
| 类型映射 | Point→Marker，LineString→Polyline，Polygon→Polygon，MultiPoint→FeatureGroup |
| 坐标顺序 | GeoJSON 是 `[lng, lat]`，Leaflet 是 `[lat, lng]`，由 `coordsToLatLng` 转换 |
| addData 顺序 | filter → geometryToLayer → 快照样式 → style → onEachFeature → addLayer |
| style | 只对 Path 生效；点要换 `pointToLayer` 返回 CircleMarker |
| resetStyle | 从创建时快照恢复再重算 style，悬停高亮的正确还原方式 |
| filter | 创建期一次性过滤，改选项不会重新评估已加载数据 |
| 2.0 变化 | 裸几何也包装成 Feature 传回调；`null` 几何自动跳过 |
| 导出 | `toGeoJSON(precision)` 默认 6 位小数；Circle 导出为点，有损 |
| 大数据 | Canvas 渲染器 + 视口裁剪 + 几何简化，三者缺一不可 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第12章-坐标系统投影与地理计算/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/Leaflet/第14章-插件生态与常用插件/" class="chapter-nav__next">下一章 →</a>
</div>

---
layout: default
title: 第06章 - 数据源 Source 体系
---

# 第06章 - 数据源 Source 体系

## 6.1 source 是"数据从哪来"的唯一入口

样式里的 `sources` 是一个对象，键是业务自定义的 id，值是数据源定义。图层通过 `source` 字段引用它。全库只有六类标准 source，另有一类只能通过 API 添加：

| 类型 | 数据形态 | 是否分瓦片 | 典型场景 |
| --- | --- | --- | --- |
| `vector` | 矢量瓦片（PBF/MLT） | 是 | 矢量底图、POI、路网 |
| `raster` | 栅格瓦片（PNG/JPEG/WebP） | 是 | 影像、扫描地图 |
| `raster-dem` | 高程栅格瓦片 | 是 | 地形、山体阴影、高程分色 |
| `geojson` | 单个 GeoJSON | 前端切片 | 业务标注、小范围专题 |
| `video` | 视频 URL 数组 | 否 | 视频贴图 |
| `image` | 单张图片 URL | 否 | 单图叠加、航拍拼图 |
| `canvas` | Canvas 元素 | 否 | 实时绘制（API 添加，见 6.8） |

选型的第一判断是"数据量级"：超过几万个要素，用矢量瓦片；几百到几千个要素、需要频繁增删改，用 GeoJSON；整幅图、不需要切瓦片，用 image。

## 6.2 vector：矢量瓦片

```json
{
  "type": "vector",
  "tiles": ["https://tiles.example.com/{z}/{x}/{y}.pbf"],
  "minzoom": 0,
  "maxzoom": 14,
  "scheme": "xyz",
  "attribution": "© Example"
}
```

也可以用 `url` 指向 TileJSON 描述文件，由服务端给出 `tiles`、`minzoom`、`maxzoom`、`bounds` 等元信息：

```json
{"type": "vector", "url": "https://tiles.example.com/tiles.json"}
```

v8 规范给 `vector` 定义的字段与默认值：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `url` | string | 无 | TileJSON 地址，与 `tiles` 二选一 |
| `tiles` | string[] | 无 | 瓦片 URL 模板，支持 `{z}/{x}/{y}` 与 `{bbox}`（自定义 CRS） |
| `bounds` | number[4] | `[-180,-85.051129,180,85.051129]` | 数据覆盖范围 |
| `minzoom` / `maxzoom` | number | `0` / `22` | 瓦片可用层级 |
| `scheme` | enum | `xyz` | `xyz`（y 从上到下）或 `tms`（y 从下到上） |
| `emptyResponse` | enum | `blank` | 空响应视为空白瓦片还是缺失 |
| `encoding` | enum | `mvt` | `mvt` 或 `mlt`（MapLibre Tile） |
| `promoteId` | string/object | 无 | 用要素属性充当 feature id |
| `volatile` | boolean | `false` | true 时不进缓存（适合高频更新） |
| `sparse` | boolean | `false` | 6.17 实验项：缺失瓦片从祖先层级切分 |

`scheme` 选错会得到"瓦片上下颠倒"的效果，这是接第三方瓦片服务时最常见的错。TMS 的 y 原点是左下角，XYZ 是左上角，公式是 `y_tms = 2^z - 1 - y_xyz`。

`promoteId` 把属性字段提升为 feature id，`setFeatureState`、`queryRenderedFeatures` 返回的 `feature.id` 才有值。不设置时 id 可能为空，跨瓦片匹配同一条路也会失效。

```js
map.addSource('roads', {
  type: 'vector',
  tiles: ['https://tiles.example.com/roads/{z}/{x}/{y}.pbf'],
  minzoom: 5,
  maxzoom: 14,
  promoteId: 'road_id' // 用属性 road_id 作为 feature id
});

map.on('click', 'road-line', (e) => {
  const id = e.features[0].id; // 有了 promoteId，这里才有稳定的值
  map.setFeatureState({source: 'roads', id}, {selected: true});
});
```

`source-layer` 是另一个高频错误点。矢量瓦片内部有一层一层的命名空间，图层要同时指定 `source` 与 `source-layer`，后者必须与瓦片里的层名完全一致。层名写错的典型表现是"图层加了但什么都不显示，也没有报错"。

## 6.3 geojson：业务数据的主力

GeoJSON 源把一份完整 GeoJSON 在前端切成瓦片，因此有三个成本：解析、切片、内存。规范默认值如下：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `data` | object / URL | 无 | 内联 GeoJSON、URL 或 `FeatureCollection` |
| `maxzoom` | number | `18` | 切片的最大层级；超过后不再细分 |
| `buffer` | number | `128` | 瓦片边界外扩（像素），防止线/面在图块边缘被裁断 |
| `tolerance` | number | `0.375` | 简化容差，越大几何越少越粗糙 |
| `cluster` | boolean | `false` | 是否聚合 |
| `clusterRadius` | number | `50` | 聚合半径（像素） |
| `clusterMaxZoom` | number | 无 | 超过该层级不再聚合 |
| `clusterMinPoints` | number | 无 | 少于此数的簇不聚合 |
| `clusterProperties` | object | 无 | 聚合后保留的统计属性 |
| `lineMetrics` | boolean | `false` | 开启后才能用 `line-progress` 表达式 |
| `generateId` | boolean | `false` | 为每个要素生成自增 id |
| `promoteId` | string/object | 无 | 用属性作 feature id |

```js
map.addSource('sensors', {
  type: 'geojson',
  data: '/api/sensors.geojson',
  cluster: true,
  clusterRadius: 50,
  clusterMaxZoom: 14,
  clusterProperties: {
    // 聚合后计数与取最大值
    count: ['+', ['get', 'count']],
    maxValue: ['max', ['get', 'value']]
  }
});

map.addLayer({
  id: 'sensor-clusters',
  type: 'circle',
  source: 'sensors',
  filter: ['has', 'point_count'],
  paint: {
    'circle-radius': ['step', ['get', 'point_count'], 14, 10, 20, 100, 28],
    'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 100, '#f28cb1']
  }
});
```

`buffer` 的调参值得单独说：它是"图块边缘几何外扩"，默认 128 px 已经比较宽。省流量的场景可以调到 64，但线宽大、标注贴边的图层会出现断口。

### 6.3.1 setData 与 updateData

GeoJSON 源有两套更新接口：

```js
const src = map.getSource('sensors');

// 全量替换：适合数据整体变化，内部会重新切片
await src.setData(newFeatureCollection);

// 增量更新：只传变化的部分，适合高频小改
await src.updateData({
  add: [newFeature],
  update: [{id: 42, newGeometry: newPoint, addOrUpdateProperties: [{key: 'value', value: 9}]}],
  remove: [{id: 7}]
});
```

6.0.0 移除了 `setData` 的第二个参数（`waitForCompletion`）和返回值里的 `this`，现在返回 `Promise<void>`。6.12 修过一个内存问题：`setData` 调用速度超过 worker 处理速度时内存会持续增长直到页面崩溃，现在会合并排队。即便如此，高频更新仍应优先用 `updateData`——全量 `setData` 会让整个数据重新切片。

### 6.3.2 聚合查询

```js
const src = map.getSource('sensors');

// 某个聚合点展开后的 zoom
const zoom = await src.getClusterExpansionZoom(clusterId);

// 聚合点下的原始要素（分页）
const leaves = await src.getClusterLeaves(clusterId, 10, 0);

// 聚合点的直接子级
const children = await src.getClusterChildren(clusterId);

map.easeTo({center: leafLngLat, zoom});
```

这三个方法都是异步的，且要求 source 的 `cluster` 为 true，否则行为不可预期。

## 6.4 raster 与 raster-dem：栅格与高程

```json
{
  "type": "raster",
  "tiles": ["https://tiles.example.com/ortho/{z}/{x}/{y}.jpg"],
  "tileSize": 256,
  "minzoom": 0,
  "maxzoom": 18
}
```

`raster` 的 `tileSize` **默认 512**，这一点常被忽略。如果服务端提供的是 256 px 瓦片而没写 `tileSize: 256`，瓦片会被放大到 512 渲染，画面发虚。代码里的注释直接点明了这个坑。

```json
{
  "type": "raster-dem",
  "tiles": ["https://dem.example.com/{z}/{x}/{y}.png"],
  "encoding": "terrarium",
  "tileSize": 256
}
```

`raster-dem` 的 `encoding` 有三个取值：`mapbox`（默认，RGB 三通道打包）、`terrarium`（Mapzen/AWS Terrain Tiles 使用）、`custom`（配合 `redFactor`/`greenFactor`/`blueFactor`/`baseShift` 自定义解码）。编码写错时地形高度会整体错乱，表现为"山高得离谱"或"全是平地"。

```js
// DEM 源单独加，不直接显示
map.addSource('dem', {
  type: 'raster-dem',
  tiles: ['https://dem.example.com/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 12
});

// 作为山体阴影显示
map.addLayer({
  id: 'hillshade',
  type: 'hillshade',
  source: 'dem',
  paint: {'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#3b3b3b'}
});

// 作为地形使用（第 14 章展开）
map.setTerrain({source: 'dem', exaggeration: 1.2});
```

## 6.5 video 与 image：整幅贴图

这两类源不接受瓦片，而是把一张图（或视频帧）按四个角坐标贴到地图上。`coordinates` 的顺序是**左上、右上、右下、左下**，经纬度对。

```json
{
  "type": "image",
  "url": "https://example.com/plan.png",
  "coordinates": [
    [116.30, 39.95],
    [116.48, 39.95],
    [116.48, 39.85],
    [116.30, 39.85]
  ]
}
```

```js
map.addSource('drone-video', {
  type: 'video',
  urls: ['/media/drone.mp4', '/media/drone.webm'],
  coordinates: [
    [116.30, 39.95],
    [116.48, 39.95],
    [116.48, 39.85],
    [116.30, 39.85]
  ]
});

map.addLayer({id: 'drone', type: 'raster', source: 'drone-video'});

// 浏览器要求用户交互后才能播放
document.getElementById('play').addEventListener('click', async () => {
  await map.getSource('drone-video').play();
});
```

视频源的 `play()`/`pause()` 受浏览器自动播放策略限制，必须由用户手势触发。image 源则常用于"没有地理坐标的平面图"，四角坐标给错会让图整体旋转。

## 6.6 添加、替换与移除 source

```js
// 添加（重复 id 会抛 Source "xxx" already exists.）
map.addSource('poi', {type: 'geojson', data: '/data/poi.geojson'});

// 取出来做后续操作
const poi = map.getSource('poi');

// 移除前必须先移除引用它的图层，否则后续渲染会报错
map.removeLayer('poi-layer');
map.removeSource('poi');
```

移除顺序是硬约束：**先删图层，再删 source**。反过来做，图层仍在引用一个不存在的 source，地图在下一帧就会报 `There is no source with this ID=...`。

`addSource` 的第三个参数还支持 `{validate: false}`，用于跳过规范校验（例如 source 类型是自定义注册的）。6.0.0 起 `raster-dem` 源也会被校验，之前漏掉了。

## 6.7 自定义源与协议

两个扩展点经常被混淆：

- **`addProtocol`**：拦截 URL 方案，例如把 `pmtiles://` 或 `s3://` 映射成实际请求。它改的是"怎么取数据"，数据格式仍是标准瓦片。
- **`addSourceType`**：注册一个全新的 source 类型，需要同时提供主线程与 worker 端实现，属于深度定制。例如 3D Tiles 类插件走的就是这条路。

```js
import {addProtocol} from 'maplibre-gl';

addProtocol('myscheme', async (params, abortController) => {
  const res = await fetch(params.url.replace('myscheme://', 'https://'), {
    signal: abortController.signal
  });
  if (!res.ok) throw new Error('请求失败：' + res.status);
  return {data: await res.arrayBuffer()};
});

// 之后样式里可以直接写 myscheme://host/tiles/{z}/{x}/{y}.pbf
```

6.11 起 `addProtocol` 的返回值允许直接给 `ImageBitmap` 或 `HTMLImageElement`，用于图片类资源，省掉一次编解码。

## 6.8 canvas：实时绘制的源

`canvas` 不在样式规范的 source 类型列表里，只能通过 `addSource` 的 API 形式添加，参数是 `CanvasSourceSpecification`：

```js
const canvasEl = document.getElementById('overlay');
const ctx = canvasEl.getContext('2d');

// 每帧把内容画到 canvas 上
function draw(t) {
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.fillStyle = 'rgba(255,80,0,0.4)';
  ctx.fillRect((Math.sin(t / 500) + 1) * 50, 40, 80, 80);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

map.addSource('overlay', {
  type: 'canvas',
  canvas: canvasEl,
  coordinates: [
    [116.30, 39.95],
    [116.48, 39.95],
    [116.48, 39.85],
    [116.30, 39.85]
  ],
  animate: true // 允许按帧更新纹理
});
map.addLayer({id: 'overlay-layer', type: 'raster', source: 'overlay'});
```

`animate: true` 时 MapLibre 会持续把 canvas 内容上传为纹理，属于稳定开销；静态内容设 `false`，只在需要时调 `source.play()` 更新。

## 6.9 排错

**图层加了但不显示。** 四个检查点：`source` id 是否正确、`source-layer` 是否与瓦片层名一致、`minzoom/maxzoom` 是否把当前层级排除、`filter` 是否把所有要素筛掉。

**`Source "x" already exists.`** 重复添加。切换数据用 `getSource(x).setData()`，不要 `removeSource` 后再 `addSource`（后者会丢缓存，切回时瓦片重下）。

**瓦片 404 却不报错。** 检查 `emptyResponse` 与服务的响应。404 默认被视为"空白瓦片"，不会触发 `error`；这也是"服务挂了但地图安静地空着"的常见原因。

**地形高度明显错误。** 先确认 `encoding`：Mapbox Terrain-RGB 用 `mapbox`，AWS Terrain Tiles 用 `terrarium`。再看 `tileSize`，DEM 常用 256，写 512 会被插值放大，高程细节丢失。

**GeoJSON 大数据卡顿。** 分三步：把 `tolerance` 调大简化几何、限制 `maxzoom` 不要到 18、必要时转成矢量瓦片。30 万点以上的 GeoJSON 在前端切片，首屏通常要几秒。

**source 数据变了但画面没变。** `setData` 返回的 Promise 未等就继续操作，或者改了对象但没触发新引用。GeoJSON 源按引用比较，原地改 `features` 数组不会触发更新。

## 6.10 生产建议

**矢量瓦片优先。** 只要数据量超过几万要素、或者要长期维护，就上矢量瓦片。GeoJSON 适合"业务数据量小、更新频繁、需要前端即时过滤"的场景。

**promoteId 是长期收益。** 有了稳定的 feature id，`setFeatureState` 才能跨瓦片、跨缩放保持一致；没有它，选中态会在缩放时丢失。

**按 source 拆分缓存。** `maxTileCacheSize` 是单 source 的上限。底图 source 可以给大一些，业务图层给默认值，避免底图挤掉业务瓦片。

**给 raster 明确 tileSize。** 不写就按 512 渲染，与 256 的服务端瓦片不匹配时画面发虚，这个问题在截图评审时经常被当成"图源质量差"。

**注意 volatile 的代价。** `volatile: true` 不进缓存，每次都要重新请求，只用于秒级更新的实时图层。

## 6.11 本章小结

| 主题 | 结论 |
| --- | --- |
| 类型 | 规范内 6 类：vector、raster、raster-dem、geojson、video、image；canvas 仅 API 添加 |
| vector | `scheme` 默认 xyz、`encoding` 默认 mvt（可选 mlt）、`promoteId` 给稳定 id |
| geojson | `maxzoom` 默认 18、`buffer` 128、`tolerance` 0.375；聚合默认关闭 |
| raster | `tileSize` 默认 512，256 瓦片必须显式声明 |
| raster-dem | `encoding` 默认 mapbox，另有 terrarium、custom 三种 |
| video/image | `coordinates` 顺序为左上、右上、右下、左下 |
| 删除顺序 | 先 `removeLayer` 再 `removeSource` |
| 扩展 | `addProtocol` 改取数方式，`addSourceType` 注册新类型 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第05章-样式规范StyleSpec详解/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第07章-图层Layer体系详解/" class="chapter-nav__next">下一章 →</a>
</div>

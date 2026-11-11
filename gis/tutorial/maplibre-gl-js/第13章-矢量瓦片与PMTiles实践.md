---
layout: default
title: 第13章 - 矢量瓦片与 PMTiles 实践
---

# 第13章 - 矢量瓦片与 PMTiles 实践

## 13.1 瓦片编号与 URL 模板

矢量瓦片把地图切成 z/x/y 金字塔。MapLibre 请求的每个瓦片都是 `{z}/{x}/{y}` 三元组，源（Source）负责把三元组拼成 URL 并解析响应。四条规则贯穿全章：

- **z0 是 1 块瓦片**，覆盖整个墨卡托世界，z1 是 2×2，以此类推；第 n 级共 4^n 块。
- **x 向东递增，y 向南递增**（`scheme: 'xyz'`，默认）；TMS 是 y 向北递增，需要 `scheme: 'tms'` 翻转。
- **瓦片坐标原点在世界左上角**，与经纬度无关，投影由瓦片服务器预先完成。
- **瓦片始终是 512×512 CSS 像素**，这是 MapLibre 的硬约束（见 13.2），不是可调参数。

自己出瓦片的服务很多，但 URL 模板的占位符要写全。最小配置：

```js
map.addSource('parcels', {
  type: 'vector',
  tiles: [
    'https://tiles.example.com/parcels/{z}/{x}/{y}.pbf',   // 标准模板
    'https://fallback.example.com/parcels/{z}/{x}/{y}.mvt' // 可给多个，按序回退
  ],
  minzoom: 6,
  maxzoom: 14,
  attribution: '© 某市自然资源局'
});
```

`tiles` 是数组而不是字符串，这一点常被写错。改成字符串不报错，但源会静默不加载——因为找不到 `tiles[0]`。

## 13.2 Vector source 的参数与硬约束

`VectorTileSource` 构造时先设默认值再覆盖（`src/source/vector_tile_source.ts`）：

```ts
this.minzoom = 0;
this.maxzoom = 22;
this.scheme = 'xyz';
this.tileSize = 512;
this.sparse = false;
this.reparseOverscaled = true;
this.isTileClipped = true;

extend(this, pick(options, ['url', 'scheme', 'tileSize', 'promoteId', 'encoding']));
if (this.tileSize !== 512) {
    throw new Error('vector tile sources must have a tileSize of 512');
}
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `minzoom` | `0` | 低于此级别不加载体瓦片（但仍会按需过采样显示） |
| `maxzoom` | `22` | 高于此级别用过采样（overzoom）拉伸 maxzoom 瓦片 |
| `tileSize` | `512` | **必须为 512**，其他值直接抛错 |
| `scheme` | `'xyz'` | `'tms'` 时翻转 y |
| `sparse` | `false` | 实验性。`true` 时 404 瓦片用最近的祖先瓦片切片填充，最多上溯 10 级 |
| `promoteId` | 无 | 把要素属性提升为 `feature.id`，`setFeatureState` 的前置条件 |
| `encoding` | 无 | 瓦片编码，`'mlt'` 为 MapLibre Tile 格式 |
| `attribution` | 无 | 会进入版权控件的文字 |

`tileSize: 512` 的报错很直白：

```text
Error: vector tile sources must have a tileSize of 512
```

它来自构造函数里的 `throw`，不是 `error` 事件，不能 `map.on('error')` 捕获，必须在 `addSource` 的 `try/catch` 里处理。

### 13.2.1 用 url 指向 TileJSON

`url` 与 `tiles` 二选一，`url` 指向一个 TileJSON：

```json
{
  "tilejson": "3.0.0",
  "name": "parcels",
  "tiles": ["https://tiles.example.com/parcels/{z}/{x}/{y}.pbf"],
  "minzoom": 6,
  "maxzoom": 14,
  "bounds": [116.1, 39.6, 116.8, 40.2],
  "attribution": "© 某市自然资源局"
}
```

`bounds` 不只是元信息：`TileBounds` 会用它裁剪视口，超出范围直接不请求瓦片。瓦片服务只在局部有数据时**务必写 bounds**，能省掉大量 404。

运行时可以换地址，不用删源重建：

```js
map.getSource('parcels').setUrl('https://tiles.example.com/parcels-v2/tiles.json');
map.getSource('parcels').setTiles(['https://tiles.example.com/parcels/{z}/{x}/{y}.mvt']);
```

`setTiles` 会清空已加载瓦片并重新请求，`setUrl` 等价于换 TileJSON 后再加载。

## 13.3 过采样与 404

地图放大到 z15，源只到 z14 时，MapLibre 不请求 z15，而是拿 z14 的瓦片放大显示——这叫 overzoom（过采样）。`reparseOverscaled: true` 表示过采样瓦片要由 worker 重新切分，以得到正确的图层数据；`zoomLevelsToOverscale`（`Map` 选项，默认 `4`）限制最多向上过采样 4 级，超出后加载空瓦片。

对服务端的影响：用户从 z14 继续放大到 z18，服务端**完全不需要** z15–z18 的瓦片，请求量由 `maxzoom` 截断。这也是为什么把 `maxzoom` 设成真实数据精度比设成 22 更好——设得比数据高，用户仍能看到清晰的放大结果，服务端也没有额外请求。

404 的处理取决于 `sparse`。默认 `false`，404 表示"这块是空的"，加载空瓦片；`sparse: true` 时 404 表示"这块没有瓦片，借用祖先"，适合不规则范围的数据集（比如只覆盖部分行政区的建筑面）。

## 13.4 PMTiles：单文件瓦片包

PMTiles 把整块金字塔打包成一个文件，通过 HTTP Range 请求取"某个 z/x/y 在文件里的字节偏移"。对静态数据这是部署成本最低的方案：一个 `.pmtiles` 文件扔到对象存储，不需要瓦片服务器。

MapLibre 本身不认识 `pmtiles://` 协议，要用官方示例里的 `pmtiles` 库注册进去：

```html
<script src="https://unpkg.com/pmtiles@3.2.0/dist/pmtiles.js"></script>
<script type="module">
  import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.mjs';

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const url = 'https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles';
  const p = new pmtiles.PMTiles(url);
  protocol.add(p);                       // 与 map 共用同一个实例，避免重复拉 header

  const map = new maplibregl.Map({
    container: 'map',
    zoom: 12,
    center: [11.25, 43.77],
    style: {
      version: 8,
      sources: {
        base: {
          type: 'vector',
          url: 'pmtiles://' + url,       // 注意 pmtiles:// 前缀
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'landuse', source: 'base', 'source-layer': 'landuse', type: 'fill',
                 paint: { 'fill-color': 'steelblue' } }]
    }
  });
</script>
```

三个 API 缺一不可：`new pmtiles.Protocol()` 创建协议实现，`maplibregl.addProtocol('pmtiles', protocol.tile)` 把它的 `tile` 方法注册为加载器，`protocol.add(p)` 把这个 `PMTiles` 实例登记到协议里。只注册协议而不登记实例，请求会失败。

`pmtiles` 的 `Protocol.tile` 签名与 MapLibre 的 `AddProtocolAction` 一致：

```ts
type AddProtocolAction = (
  requestParameters: RequestParameters,
  abortController: AbortController
) => Promise<GetResourceResponse<AddProtocolResponseData>>;
// 成功时返回 { data: ArrayBuffer }，失败时 throw
```

所以自己实现协议时，只要返回 `{data: ArrayBuffer}` 就能被当作矢量瓦片解析；返回 `ImageBitmap` 则被当作图片。

### 13.4.1 完整可用页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>PMTiles 完整示例</title>
  <link href="https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.css" rel="stylesheet" />
  <style>body { margin: 0; } #map { height: 100vh; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/pmtiles@3.2.0/dist/pmtiles.js"></script>
  <script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.mjs';

    const pmtilesUrl = 'https://pmtiles.io/protomaps(vector)ODbL_firenze.pmtiles';

    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    const archive = new pmtiles.PMTiles(pmtilesUrl);
    protocol.add(archive);

    // 先取 header，就能用文件自带的中心点与缩放范围初始化相机
    archive.getHeader().then((header) => {
      const map = new maplibregl.Map({
        container: 'map',
        style: {
          version: 8,
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          sources: {
            base: {
              type: 'vector',
              url: 'pmtiles://' + pmtilesUrl,
              attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
            }
          },
          layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#f2efe9' } },
            { id: 'landuse', type: 'fill', source: 'base', 'source-layer': 'landuse',
              paint: { 'fill-color': 'steelblue', 'fill-opacity': 0.6 } },
            { id: 'roads', type: 'line', source: 'base', 'source-layer': 'roads',
              paint: { 'line-color': '#444', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 4] } },
            { id: 'places', type: 'symbol', source: 'base', 'source-layer': 'places',
              layout: { 'text-field': ['get', 'name'], 'text-size': 12 },
              paint: { 'text-color': '#222' } }
          ]
        },
        center: [header.centerLon, header.centerLat],
        zoom: header.maxZoom - 2
      });

      map.on('error', (e) => console.error('[map]', e.error && e.error.message));

      map.on('load', () => {
        console.log('tile 范围', header.minZoom, '-', header.maxZoom);
        console.log('文件字节数', header.tileDataLength);
      });
    });
  </script>
</body>
</html>
```

`header` 里有 `minZoom`、`maxZoom`、`centerLon`、`centerLat`、`tileDataLength` 等字段，用它初始化相机比硬编码中心点可靠。`getHeader()` 是异步的，地图必须等它 resolve 之后再构造，否则拿不到中心点。

### 13.4.2 PMTiles 与瓦片服务器的取舍

| 维度 | PMTiles（单文件） | 动态瓦片服务（Martin/TiTiler 等） |
| --- | --- | --- |
| 部署 | 一个文件 + 支持 Range 的对象存储 | 需要常驻服务与数据库 |
| 数据更新 | 重新生成整个文件（局部更新需重写） | 改一行数据即生效 |
| 请求模式 | 每次取字节区间，通常几百字节到几 KB | 整块瓦片，通常 20KB–200KB |
| 缓存 | 对象存储 + CDN，命中率极高 | 需要自己加缓存层 |
| 适用 | 底图、历史归档、离线包 | 实时业务数据、按权限过滤 |

PMTiles 的隐性成本在**生成**：数据变了要重跑整个转换，不适合分钟级更新的业务图层。静态底图、年度变更的规划数据、需要下载到本地的野外作业包，则是它的主场。

## 13.5 常见错误

| 报错/现象 | 原因 | 修法 |
| --- | --- | --- |
| `vector tile sources must have a tileSize of 512` | 传了 256 或 1024 | 删掉 `tileSize`，或改成 512 |
| 地图全白，控制台 404 一片 | 模板写成 `{z}/{y}/{x}`，或用了 TMS 服务没设 `scheme: 'tms'` | 核对模板顺序；TMS 加 `scheme: 'tms'` |
| `Unable to parse the tile response as a vector tile` | 服务返回 gzip 但没设 `Content-Encoding`，或返回的是 JSON 错误页 | 检查响应头；确认瓦片真实格式 |
| 图层不显示但源已加载 | `source-layer` 名字与瓦片里的 layer 名不一致 | 解一个瓦片看 `layers` 列表；名字大小写敏感 |
| `pmtiles://` 请求 404 | 只 `addProtocol` 没 `protocol.add(archive)`，或 URL 少了前缀 | 两步都做，URL 拼 `pmtiles://` |
| 放大后变糊、无新瓦片 | `maxzoom` 设得比数据实际精度高，全在 overzoom | 把 `maxzoom` 调到真实精度，或补瓦片 |
| `setFeatureState` 无效 | 要素没有 `id` | 源上配 `promoteId`，或数据里带 `id` |

第二条的来源是 URL 模板本身：TMS 的 y 从南往北数，与 xyz 相反，只差一个翻转，症状是"位置对但上下颠倒"或"整片 404"，取决于服务端对越界 y 的处理。

调试瓦片最有效的办法是直接解一个：

```bash
# 抓一块瓦片，用 tippecanoe 自带的 tile-join 或 @mapbox/vector-tile 检查
curl -s 'https://tiles.example.com/parcels/12/3371/1552.pbf' -o tile.pbf
node -e "const {VectorTile}=require('@mapbox/vector-tile');const Pbf=require('pbf');const fs=require('fs');const t=new VectorTile(new Pbf(fs.readFileSync('tile.pbf')));console.log(Object.keys(t.layers))"
```

输出形如 `[ 'landuse', 'roads', 'places' ]`，把这些名字原样填进 `source-layer` 即可。

## 13.6 生产建议

**矢量源优先，栅格源兜底。** 同一个数据集，矢量瓦片在 60% 缩放下仍然清晰，栅格要请求多个分辨率层级；但矢量瓦片需要浏览器端逐要素布局，要素极多（单瓦片数十万）时会卡在 worker 解析上，此时退回栅格反而更稳。

**`maxzoom` 与 `minzoom` 按数据精度定，不要按视觉需要定。** 数据精度只到 1:2000，`maxzoom` 设 18 只会让用户看到放大的粗线；设在 14–16，overzoom 的效果一样，服务端瓦片量少一个数量级。

**给动态图层留出刷新路径。** 瓦片有缓存，热点数据（施工状态、车辆位置）不要进瓦片，用 GeoJSON 源 + `setData` 或`setFeatureState`，只有静态底图走瓦片。

**注意 HTTP 头。** 瓦片服务的 `Content-Encoding: gzip`、`Cache-Control: max-age` 直接影响加载速度；`Access-Control-Expose-Headers: Content-Length` 缺失时部分监控工具读不到大小。

**PMTiles 放在 CDN 后面。** Range 请求在对象存储上单价低但延迟敏感，CDN 对 Range 的支持要确认（多数支持，但可能忽略 Range 返回整个文件，几 GB 的包会拖死客户端）。

## 13.7 本章小结

| 要点 | 事实 |
| --- | --- |
| 瓦片尺寸 | 矢量源 `tileSize` 必须 512，否则构造函数直接抛错 |
| 默认范围 | `minzoom: 0`、`maxzoom: 22`、`scheme: 'xyz'` |
| 过采样 | 超过 `maxzoom` 用过采样，`zoomLevelsToOverscale` 默认 4 级 |
| 404 语义 | 默认空瓦片；`sparse: true` 时借用最近祖先瓦片 |
| PMTiles 接入 | `new pmtiles.Protocol()` + `addProtocol('pmtiles', protocol.tile)` + `protocol.add(archive)` |
| 运行期换源 | `setUrl()` / `setTiles()`，不需 remove/add |
| 换事件 | 源数据质量差先 `map.on('error')`，再解瓦片核对 `source-layer` |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第12章-标记弹窗与自定义覆盖物/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第14章-三维地形天空与大气效果/" class="chapter-nav__next">下一章 →</a>
</div>

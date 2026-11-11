---
layout: default
title: 第17章 - 空间分析Turf集成与插件生态
---

# 第17章 - 空间分析Turf集成与插件生态

## 17.1 客户端空间分析的位置

MapLibre 只负责"画"和"查可见要素"，不做空间分析：没有缓冲区、没有叠加分析、没有距离量算。分析能力要么放在服务端（GeoServer、pg_tilestack、PostGIS），要么在浏览器里用 Turf 这类纯 JS 库算。

选择取决于三件事：

| 条件 | 客户端（Turf） | 服务端（PostGIS 等） |
| --- | --- | --- |
| 数据量 | 万级要素、单次分析 | 百万级、复杂空间索引 |
| 交互频率 | 跟随鼠标实时算 | 提交表单后算 |
| 数据敏感性 | 数据已在浏览器里 | 数据不出服务端 |
| 部署成本 | 零后端 | 需要数据库与服务 |

界面上"拖一个圈看里面有啥"、"点两个点算距离"这类交互，客户端算最跟手；"整个区的用地平衡表"这类，服务端算。

## 17.2 queryRenderedFeatures：先学会"查"

分析的输入通常来自地图上已经渲染的要素。两个查询 API 分工明确：

| API | 输入 | 返回 | 典型用途 |
| --- | --- | --- | --- |
| `queryRenderedFeatures` | 屏幕坐标（点或矩形）或 options | 当前**渲染出来**的要素（`MapGeoJSONFeature[]`） | 点选、框选 |
| `querySourceFeatures` | 源 id + `{sourceLayer, filter}` | 源里**已加载瓦片**中的要素（`GeoJSONFeature[]`） | 按属性批量取 |

```js
// 点选：只查指定图层，返回数组，按渲染顺序自上而下
const features = map.queryRenderedFeatures(e.point, { layers: ['buildings', 'parcels'] });

// 框选：给两个角点，顺序任意
const box = [[e.point.x - 40, e.point.y - 40], [e.point.x + 40, e.point.y + 40]];
const inBox = map.queryRenderedFeatures(box, { layers: ['parcels'] });

// 带属性过滤，省去返回后再筛
const big = map.queryRenderedFeatures(e.point, {
  layers: ['parcels'],
  filter: ['>', ['get', 'area'], 500]
});

// 从源里取要素：矢量源必须给 sourceLayer
const sourceFeatures = map.querySourceFeatures('parcels-src', { sourceLayer: 'parcels' });
```

三个容易踩空的地方：

1. `queryRenderedFeatures` 只返回**当前视口内、已渲染**的要素。缩放到别的区域后查不到，是正常的。
2. `querySourceFeatures` 只返回**已加载瓦片**里的要素，不保证覆盖整个源；它不会为了查询去下载瓦片。
3. 矢量源的 `sourceLayer` 必填，且要与瓦片里的 layer 名完全一致；GeoJSON 源忽略这个参数。

## 17.3 Turf 集成

Turf 7.x 是模块化包，可以整包引入，也可以只装需要的子包：

```bash
# 全量（约 1.5 MB 未压缩，适合快速原型）
npm install @turf/turf@7.4.0

# 按需（生产推荐，只引真正用到的函数）
npm install @turf/boolean-point-in-polygon@7.4.0 @turf/buffer@7.4.0 @turf/distance@7.4.0
```

```js
import * as turf from '@turf/turf';

// 点在多边形内：返回 boolean，options.ignoreBoundary 默认 false
const inside = turf.booleanPointInPolygon(turf.point([116.39, 39.9]), polygonFeature);

// 距离：默认单位 kilometers，可选 miles/nauticalmiles/degrees/radians
const km = turf.distance(turf.point([116.39, 39.9]), turf.point([116.48, 39.92]), { units: 'kilometers' });

// 缓冲区：单位与 distance 一致
const buffered = turf.buffer(lineFeature, 0.5, { units: 'kilometers' });

// 相交
const clipped = turf.intersect(turf.featureCollection([polyA, polyB]));
```

Turf 的坐标约定与 GeoJSON 一致：`[经度, 纬度]`，不是 `[纬度, 经度]`。MapLibre 的 `LngLat` 序列化出来是 `{lng, lat}` 对象，喂给 Turf 前要转数组，这是最容易出错的一步。

### 17.3.1 距离换算：别直接用米

`map.project()` 得到的是像素距离，像素与米的关系随纬度和缩放变化。要算"图上两点实际相距多少米"，用 Turf 而不是像素：

```js
const a = map.getCenter();
const b = map.unproject([map.getCanvas().width - 10, map.getCanvas().height / 2]);

const meters = turf.distance(
  turf.point([a.lng, a.lat]),
  turf.point([b.lng, b.lat]),
  { units: 'meters' }
);
console.log('右边缘中心距地图中心', meters.toFixed(0), 'm');
```

在墨卡托投影下，越远离赤道同样的像素代表越短的实地距离。用像素反推比例尺在纬度 40° 会偏 30% 以上，这不是 MapLibre 的 bug，是投影的性质。

## 17.4 交互式分析：框选统计

把查询和分析接起来：框选 → 高亮 → 统计。完整示例：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>框选分析</title>
  <link href="https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    body { margin: 0; }
    #map { height: 100vh; }
    .stat-panel { position: absolute; top: 12px; left: 12px; z-index: 5; background: #fff;
      padding: 8px 12px; border-radius: 4px; font: 12px ui-monospace, monospace; box-shadow: 0 0 0 2px rgba(0,0,0,.1); }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="stat-panel" id="stat">按住 Shift 拖拽框选</div>
  <script src="https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/@turf/turf@7.4.0/turf.min.js"></script>
  <script>
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [116.39, 39.9],
      zoom: 11
    });

    let start = null;
    map.on('mousedown', (e) => {
      if (!e.originalEvent.shiftKey) return;
      start = e.point;
      map.dragPan.disable();
    });

    map.on('mouseup', (e) => {
      if (!start) return;
      const box = [[Math.min(start.x, e.point.x), Math.min(start.y, e.point.y)],
                   [Math.max(start.x, e.point.x), Math.max(start.y, e.point.y)]];
      start = null;
      map.dragPan.enable();

      const features = map.queryRenderedFeatures(box);
      if (!features.length) { console.log('框内无要素'); return; }

      // 用 Turf 把屏幕框换成地理多边形，再做精确判定
      const sw = map.unproject(box[0]);
      const ne = map.unproject(box[1]);
      const bboxPolygon = turf.bboxPolygon([sw.lng, sw.lat, ne.lng, ne.lat]);

      const unique = new Map();
      let totalArea = 0;
      for (const f of features) {
        const key = f.id !== undefined ? f.id : JSON.stringify(f.properties);
        if (unique.has(key)) continue;
        unique.set(key, f);
        if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
          if (turf.booleanIntersects(f, bboxPolygon)) {
            totalArea += turf.area(f) / 1e6;   // m² → km²
          }
        }
      }
      document.getElementById('stat').textContent =
        '要素 ' + unique.size + ' 个，相交面积 ' + totalArea.toFixed(3) + ' km²';
    });
  </script>
</body>
</html>
```

这个例子演示了完整分工：MapLibre 负责"框内有哪些要素"（屏幕空间，快），Turf 负责"是不是真的相交、面积多少"（地理空间，准）。只用其中一个都不对——`queryRenderedFeatures` 的矩形是屏幕矩形，倾斜视角下它对应的地面范围不是矩形；只用 Turf 遍历全量要素又太慢。

## 17.5 插件生态：五类，按需取

MapLibre 官方维护了一份插件清单（<https://maplibre.org/maplibre-gl-js/docs/plugins/>），分五类。挑常用的列一下，便于按问题找工具：

| 类别 | 代表项目 | 解决什么 |
| --- | --- | --- |
| 界面控件 | `maplibre-gl-compare`、`mapbox-gl-draw`、`Terra Draw`、`maplibre-gl-export`、`maplibre-gl-geocoder` | 卷帘对比、绘制编辑、导出图片/PDF、地址搜索 |
| 渲染扩展 | `deck.gl`、`maplibre-three-plugin`、`maplibre-gl-lidar`、`maplibre-contour` | 大规模 WebGL 图层、Three.js 3D、点云、等高线 |
| 图层类型 | `PMTiles for MapLibre`、`maplibre-cog-protocol`、`mapbox-gl-animated-images` 类项目 | 单文件瓦片、COG 影像、动图/脉冲点 |
| 工具库 | `turf`、`mapbox-gl-sync-move`、`Styl`、`mapbox-gl-utils` | 空间分析、多图联动、样式校验、图层增删糖 |
| 框架集成 | `react-map-gl`、`svelte-maplibre`、`ngx-maplibre-gl`、`LibreGL`(Vue) | 声明式绑定 |

挑插件先看它是不是**协议级**扩展。用 `addProtocol` 接入的（PMTiles、COG、CSV/GPX）通常最稳，因为它复用了 MapLibre 的请求与缓存机制；自定义图层（`CustomLayerInterface`）只影响渲染，稳定性次之；直接操作私有字段的插件最脆弱，升级主版本就可能失效。

### 17.5.1 用 addProtocol 扩展数据格式

插件形态里最值得自己掌握的是协议扩展。比如要直接读 `.csv` 或 `.geojson.gz`：

```js
maplibregl.addProtocol('gzjson', async (params, abortController) => {
  const res = await fetch(params.url.replace('gzjson://', 'https://'), {
    signal: abortController.signal
  });
  if (!res.ok) throw new Error(\`加载失败: \${res.status}\`);
  const buf = await res.arrayBuffer();
  // 浏览器原生支持 gzip 解压
  const stream = new Response(buf).body.pipeThrough(new DecompressionStream('gzip'));
  return { data: await new Response(stream).text() };
});

map.addSource('gzip-geojson', {
  type: 'geojson',
  data: 'gzjson://example.com/big.geojson.gz'
});
```

协议回调的返回值必须符合 `AddProtocolResponseData`：`ArrayBuffer`（瓦片）、`ImageBitmap`/`HTMLImageElement`（图片）、`string` 或已解析对象（JSON）。`params.type` 会告诉你调用方期望哪一种，返回类型不对会静默失败。

## 17.6 排错

| 现象 | 原因 | 修法 |
| --- | --- | --- |
| Turf 返回 `NaN` | 坐标顺序写反（`[lat, lng]`）或传了 `LngLat` 对象 | 统一转成 `[lng, lat]` 数组 |
| `booleanPointInPolygon` 总是 false | 多边形环未闭合，或 GeoJSON 用 `geometry` 而非 `Feature` | 用 `turf.polygon` 构造；传 Feature |
| `queryRenderedFeatures` 返回空 | 图层还没加载 / 不在视口 / 图层名拼错 | 在 `idle` 后调用；核对图层 id |
| `querySourceFeatures` 漏要素 | 只查了已加载瓦片 | 需要全量时走服务端，或先 `fitBounds` 让瓦片加载 |
| 打包体积过大 | 整包引入 `@turf/turf`（117 个依赖） | 改成按函数引入子包 |
| `addProtocol` 注册后无效 | 协议名大小写不一致，或 URL 前缀不匹配 | 协议名用纯小写，URL 前缀完全一致 |

第二、三条是空间查询里最常见的两类失败。前者错在数据形状，后者错在时序——`queryRenderedFeatures` 在 `load` 之前调用一定是空数组。

## 17.7 生产建议

**分析代码与渲染代码分开。** 把 Turf 计算放进独立的 `analysis.js`，输入输出都是纯 GeoJSON。这样同一套逻辑可以搬到 Node 端做批量校验，也便于写单测。

**大范围分析放服务端。** 浏览器里遍历 10 万个多边形做 `booleanIntersects`，即使有 R 树索引也要几百毫秒，主线程一卡页面就掉帧。超过约 2 万要素的分析请求，走服务端更稳。

**按需引入 Turf 子包。** `@turf/turf` 7.4.0 有 117 个依赖，整包打入会显著增加首屏体积；`@turf/distance` 这类子包只有几 KB。

**插件锁版本，升级先看主版本变更。** 插件普遍依赖 MapLibre 内部行为，MapLibre 升主版本（如 v5→v6）时插件往往滞后。锁死 `package.json` 里的 `maplibre-gl` 版本，升级前先跑插件的示例。

**别把插件当标准。** 插件解决了 80% 的场景，但剩下 20% 往往要改源码或自己实现。用之前先读它的核心文件大小——一个几千行的插件，出问题时读得动；几十万行的框架，就得评估维护成本。

## 17.8 本章小结

| 要点 | 事实 |
| --- | --- |
| 查询分工 | `queryRenderedFeatures` 查视口已渲染要素；`querySourceFeatures` 查源的已加载瓦片 |
| 矢量源必填 | `querySourceFeatures` 的 `sourceLayer` 对矢量源必填，GeoJSON 源忽略 |
| Turf 版本 | `@turf/turf@7.4.0`，117 个依赖，生产建议按子包引入 |
| 坐标顺序 | 一律 `[lng, lat]`，`LngLat` 对象要先转数组 |
| 插件分层 | 协议级（最稳）> 自定义图层 > 直接改私有字段 |
| 协议扩展 | `addProtocol` 返回值类型必须匹配 `params.type` |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第16章-动态数据动画与时间维度/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第18章-性能优化与最佳实践/" class="chapter-nav__next">下一章 →</a>
</div>

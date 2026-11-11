---
layout: default
title: 第05章 - 样式规范 Style Spec 详解
---

# 第05章 - 样式规范 Style Spec 详解

## 5.1 style 是一份被严格约束的 JSON

MapLibre 渲染什么、怎么渲染，全部由一份 style JSON 决定。这份 JSON 的结构由 `@maplibre/maplibre-gl-style-spec` 定义，6.17.0 依赖 `^26.6.0`，对应规范版本 v8。规范源文件是 `v8.json`，主线程与 worker 都用它校验样式。

一个合法的最小样式只有三个必填字段：

```json
{
  "version": 8,
  "sources": {},
  "layers": [
    {"id": "bg", "type": "background", "paint": {"background-color": "#e9eef2"}}
  ]
}
```

`version` 的类型是枚举，值只能是 `8`；`sources` 与 `layers` 都是必填。少任何一个，校验就会失败。如果打开 `validateStyle`（默认开），错误会以 `error` 事件抛出；关掉之后格式错的内容可能被静默接受，然后在渲染阶段以更难懂的方式失败，生产环境关它之前先想清楚。

## 5.2 根级字段：除了 sources 和 layers 还剩什么

v8 的根对象共 20 个字段，按用途分四类：

| 类别 | 字段 | 类型/默认值 | 作用 |
| --- | --- | --- | --- |
| 必填 | `version` | 枚举，固定 `8` | 规范版本 |
| 必填 | `sources` | 对象 | 六类数据源的定义 |
| 必填 | `layers` | 数组 | 图层列表，顺序即绘制顺序（后画的在上） |
| 相机初值 | `center` / `centerAltitude` | 经纬度 / 米 | 地图初始中心与中心海拔 |
| 相机初值 | `zoom` / `bearing` / `pitch` / `roll` | 数字 | 初始缩放、方位角、俯仰、翻滚 |
| 资源 | `sprite` | `{id, url}` 数组 | 图标与图案的雪碧图 |
| 资源 | `glyphs` | URL 模板字符串 | SDF 字体 PBF 的地址模板 |
| 资源 | `font-faces` | 对象 | 直接以字体文件描述字形，替代 glyphs 的另一种方式 |
| 视觉 | `light` | 对象 | 3D 图层的光照方向、颜色、强度 |
| 视觉 | `sky` | 对象 | 天空、地平线、雾的颜色与混合 |
| 视觉 | `terrain` | `{source, exaggeration}` | 地形源与高程夸张系数 |
| 视觉 | `projection` | `{type}` | `mercator` / `globe` / `vertical-perspective` |
| 其他 | `name` / `metadata` | 字符串 / 任意 | 名称与自定义元数据 |
| 其他 | `transition` | `{duration: 300, delay: 0}` | 全局过渡时长与延迟（毫秒） |
| 其他 | `state` | 对象，默认 `{}` | `global-state` 表达式的默认值表 |

其中 `sprite` 的细节值得单独提：v8 支持多个雪碧图，写成数组 `[{"id": "default", "url": "..."}, {"id": "poi", "url": "..."}]`。引用图片时用 `id:image-name` 作前缀；`id` 为 `default` 时前缀可省略。只有一个雪碧图时，旧写法 `"sprite": "https://..."` 仍然兼容。

```json
{
  "version": 8,
  "name": "basemap",
  "sprite": [
    {"id": "default", "url": "https://example.com/sprites/basic"},
    {"id": "transit", "url": "https://example.com/sprites/transit"}
  ],
  "glyphs": "https://example.com/fonts/{fontstack}/{range}.pbf",
  "sources": {},
  "layers": [],
  "transition": {"duration": 250, "delay": 0}
}
```

## 5.3 layers：公共字段与十个类型

所有图层共享同一组公共字段，差异在 `type` 与各自的 `paint`/`layout`：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 全局唯一的图层名 |
| `type` | 是 | 见下表 |
| `source` | 除 background 外必填 | 引用 `sources` 里的 id |
| `source-layer` | vector 源必填 | 矢量瓦片内的图层名 |
| `minzoom` / `maxzoom` | 否 | 0–24；小于 minzoom 或大于等于 maxzoom 时隐藏 |
| `filter` | 否 | 按属性或几何类型筛选要素 |
| `layout` | 否 | 影响几何生成的属性（是否可见、是否参与碰撞等） |
| `paint` | 否 | 影响最终像素的属性（颜色、宽度、透明度等） |
| `metadata` | 否 | 任意元数据，不参与渲染，建议加前缀 |

十个规范内类型如下。第 3 章列过 11 种图层，是把渲染器内部的 `custom` 也算进去；`custom` 不是 style 文件里的类型，而是通过 `addLayer` 传入的自定义渲染对象。

| 类型 | 依赖的 source | 典型用途 | 关键 paint 属性 |
| --- | --- | --- | --- |
| `background` | 无 | 底色、纯色铺底 | `background-color`、`background-opacity` |
| `fill` | vector / geojson | 面填充 | `fill-color`、`fill-opacity`、`fill-outline-color` |
| `line` | vector / geojson | 线、边、路径 | `line-color`、`line-width`、`line-dasharray` |
| `symbol` | vector / geojson | 图标与文字标注 | `icon-image`、`text-field`、`text-size` |
| `circle` | vector / geojson | 点要素画圆 | `circle-radius`、`circle-color` |
| `heatmap` | vector / geojson | 热力分布 | `heatmap-radius`、`heatmap-weight` |
| `fill-extrusion` | vector / geojson | 三维体块、建筑 | `fill-extrusion-height`、`-base` |
| `raster` | raster | 影像、栅格底图 | `raster-opacity`、`raster-resampling` |
| `hillshade` | raster-dem | 山体阴影 | `hillshade-illumination-direction` |
| `color-relief` | raster-dem | 高程分色 | `color-relief-color` |

`layout` 与 `paint` 的区别不是"静态与动态"，而是**影响几何还是影响像素**。`line-cap` 决定线端如何生成顶点，属于 layout；`line-color` 只改变片元颜色，属于 paint。这个区分直接影响性能：改 layout 往往要重新生成 Bucket，改 paint 可能只是换 uniform（详见 3.5 与 5.6）。

## 5.4 属性值类型与默认值

v8 给每个属性都定义了类型、默认值、取值范围和是否支持过渡。写样式时最常踩的坑是"以为有默认值其实没有"和"以为能插值其实不能"。

### 5.4.1 paint 关键默认值

| 属性 | 类型 | 默认值 | 备注 |
| --- | --- | --- | --- |
| `background-color` | color | `#000000` | 不填就是黑底 |
| `background-opacity` | number | `1` | 0–1 |
| `fill-color` | color | `#000000` | |
| `fill-opacity` | number | `1` | 影响填充与 1px 描边 |
| `fill-outline-color` | color | 无 | 不填则不描边 |
| `fill-antialias` | boolean | `true` | 关掉可省一点性能，边缘变硬 |
| `line-color` | color | `#000000` | 与 `line-pattern` 互斥 |
| `line-width` | number | `1` | 单位像素 |
| `line-opacity` | number | `1` | |
| `line-blur` | number | `0` | |
| `line-gap-width` | number | `0` | 画双线（描边效果）用 |
| `line-offset` | number | `0` | 正负决定左右偏移 |
| `line-dasharray` | number[] | 无 | 虚线，单位与线宽相关 |
| `circle-radius` | number | `5` | 像素 |
| `circle-color` | color | `#000000` | |
| `circle-stroke-width` | number | `0` | |
| `circle-pitch-scale` | enum | `map` | `map` 随俯仰缩放，`viewport` 不缩放 |
| `heatmap-radius` | number | `30` | |
| `heatmap-weight` | number | `1` | |
| `heatmap-intensity` | number | `1` | |
| `fill-extrusion-height` | number | `0` | 不填则完全没有立体 |
| `fill-extrusion-base` | number | `0` | |
| `raster-opacity` | number | `1` | |
| `raster-fade-duration` | number | `300` | 瓦片淡入，ms |
| `raster-resampling` | enum | `linear` | 影像用 `linear`，分类栅格可改 `nearest` |
| `hillshade-illumination-direction` | number | `335` | 度 |
| `hillshade-exaggeration` | number | `0.5` | |

### 5.4.2 layout 关键默认值

| 属性 | 类型 | 默认值 | 备注 |
| --- | --- | --- | --- |
| `visibility` | enum | `visible` | 只有 `visible` / `none` 两值 |
| `line-cap` | enum | `butt` | `butt` / `round` / `square` |
| `line-join` | enum | `miter` | `miter` / `bevel` / `round` |
| `line-miter-limit` | number | `2` | 超过该值转 bevel |
| `line-round-limit` | number | `1.05` | 小角度时转 round |
| `text-field` | formatted | `""` | 空字符串表示不显示 |
| `text-size` | number | `16` | 像素 |
| `text-font` | array | `["Open Sans Regular","Arial Unicode MS Regular"]` | 字体栈 |
| `text-max-width` | number | `10` | 单位 em |
| `text-padding` | number | `2` | 碰撞框外扩像素 |
| `text-allow-overlap` | boolean | `false` | true 时忽略碰撞 |
| `icon-size` | number | `1` | 相对原图倍率 |
| `symbol-placement` | enum | `point` | `point` / `line` / `line-center` |
| `symbol-sort-key` | number | 无 | 越小越优先参与碰撞 |

`layout_symbol` 是规范里最大的属性组，共 47 个字段。以上列的是高频项，完整清单可以在 `v8.json` 的 `layout_symbol` 里查到。

## 5.5 filter：两代语法与一条硬规则

`filter` 有两种写法，都仍然有效：

```json
{
  "filter": ["==", "class", "primary"]
}
```

```json
{
  "filter": ["==", ["get", "class"], "primary"]
}
```

第一种是旧式语法，属性名直接写字符串；第二种是表达式语法，用 `["get", ...]` 取值。6.x 的默认行为是：**混用两代语法会产生警告级别的校验错误，但不再中止样式加载**。早期版本会直接把地图画成空白，这个行为已经在 v6 修掉。

filter 支持的算子是一份固定清单：

| 类别 | 算子 |
| --- | --- |
| 比较 | `==`、`!=`、`>`、`>=`、`<`、`<=` |
| 集合 | `in`、`!in` |
| 逻辑 | `all`、`any`、`none` |
| 存在性 | `has`、`!has` |

一条容易忽略的硬规则：**filter 里不能用 `feature-state`**。规范对 `layer.filter` 的说明明确写了这一点，`feature-state` 属于渲染阶段的表达式，只能在 paint/layout 属性里用。需要在过滤层面表达"选中态"，只能用属性字段或拆图层。

另一条规则是：**filter 里的 zoom 表达式只在整数 zoom 级别求值**。缩放到 10.4 时，用的仍是 zoom=10 时的结果。所以不要把 filter 当作连续插值的工具，那属于 paint。

```js
// 选中态不能用 feature-state 做 filter，正确做法是拆一个高亮图层
map.addLayer({
  id: 'roads-selected',
  type: 'line',
  source: 'roads',
  'source-layer': 'transportation',
  filter: ['==', ['get', 'id'], -1], // 初始不匹配任何要素
  paint: {'line-color': '#ff7a00', 'line-width': 6}
});

function selectRoad(id) {
  // 用 setFilter 切换精确匹配，避免逐要素 feature-state 的复杂度
  map.setFilter('roads-selected', ['==', ['get', 'id'], id]);
}
```

## 5.6 过渡、表达式与数据驱动

paint 属性大多支持过渡：样式里可以写 `"fill-color-transition": {"duration": 500, "delay": 100}`，或者在根级 `transition` 里设全局默认。规范里 `transition` 的默认值是 `{duration: 300, delay: 0}`，单位毫秒。

过渡能不能生效，取决于属性的 `transition` 标记与 `property-type`：

| property-type | 含义 | 例子 |
| --- | --- | --- |
| 常量 | 只能是常量，不能数据驱动 | `background-color` |
| `data-driven` | 可按 feature 属性逐要素取值，支持插值 | `line-color`、`fill-opacity` |
| `cross-faded` | 跨瓦片淡入淡出，不能插值 | `icon-image`、`text-field` |

规范里每个属性都带 `expression` 元数据，写明允许的输入范围，例如 `line-color` 是 `{"interpolated": true, "parameters": ["zoom", "feature", "feature-state"]}`，`text-size` 是 `["zoom", "feature"]`。看这份元数据就能判断某个表达式能不能用在某个属性上，比试错快。

```json
{
  "id": "population-fill",
  "type": "fill",
  "source": "districts",
  "paint": {
    "fill-color": [
      "interpolate", ["linear"], ["get", "density"],
      0, "#f7fbff",
      1000, "#c6dbef",
      5000, "#6baed6",
      20000, "#2171b5"
    ],
    "fill-opacity-transition": {"duration": 400, "delay": 0}
  }
}
```

## 5.7 校验：把错误挡在样式进入地图之前

规范包同时提供了校验器，可以在 CI 里跑，不必等到浏览器里才发现拼写错误。

```bash
# 用官方 CLI 校验一个样式文件
npx @maplibre/maplibre-gl-style-spec gl-style-validate style.json

# 格式化（统一缩进与键顺序，便于 diff）
npx @maplibre/maplibre-gl-style-spec gl-style-format style.json
```

在运行时，校验由 `validateStyle` 控制：默认 `true`，样式里每个不合法的属性都会通过 `error` 事件报出，并带上路径（例如 `layers[3].paint.line-color`）。6.x 改进了错误定位，看到这种路径能直接定位到具体图层与属性。

```js
const map = new maplibregl.Map({
  container: 'map',
  style: styleObject,
  validateStyle: true // 默认就是 true，写出来是为了提醒
});

map.on('error', (e) => {
  // 样式校验错误通常带 sourceId 或 style 路径信息
  console.error(e.error?.message);
});
```

生产环境可以把 `validateStyle` 设为 `false`：样式在上线前已经用 CLI 校验过，运行时省掉校验开销，某些打包器还能对校验代码做 tree-shaking。代价是运行时拼错的属性不再报错，所以要有"样式必须过 CI"的流程兜底。

## 5.8 常见坑

**`layers` 顺序就是绘制顺序。** 后声明的图层画在上面。把标注图层写在面图层之前，标注会被盖住——这不是 bug。

**`fill-outline-color` 不等于描边。** 它只在填充边缘画 1 像素宽的线，且仅对 `fill-antialias: true` 有效。要可控线宽，叠一个 `line` 图层。

**`line-width` 的单位是像素，不随 zoom 变化。** 想让线随缩放变粗，必须写 `["interpolate", ["linear"], ["zoom"], ...]`；直接写 `line-width: 2`，在任何缩放级别都是 2 px。

**`text-field` 不能直接写 feature 属性名。** 要么用 `{name}` 这类 token 语法，要么用 `["get", "name"]`。写 `"text-field": "name"` 会得到字面量 "name"。

**sprite 路径会追加 `.json` 与 `.png`。** 写成 `https://x/y.png` 会变成 `https://x/y.png.json`，正确写法是不带扩展名的 `https://x/y`。

**glyphs 必须是 `{fontstack}/{range}.pbf` 模板。** 少了占位符，字体请求会 404，标注全部不显示且没有明显报错。

**`version` 只能是 8。** 写 7 或 9 都过不了校验。

## 5.9 生产建议

**样式分文件维护再合并。** 一个城市级底图样式动辄上千行，直接手写一个 JSON 不可维护。常见做法是按图层分文件、构建时合并，或者用 style 生成库。

**用 `transformStyle` 而不是复制粘贴。** 换底图、打补丁、加业务图层都在运行时做，比维护两份完整样式可靠。

**把 `transition` 显式写死。** 依赖默认 300 ms 在不同版本间可能变化，显式声明能让视觉不随升级漂移。

**关掉不用的图层而不是删掉。** 调试图层用 `"visibility": "none"`，上线时按环境生成不同样式；删掉再换回来容易丢配置。

**样式体积也要进性能预算。** 一份 2 MB 的样式 JSON 解析要几百毫秒，首屏卡顿有时不是瓦片慢，而是样式本身太大。压缩与拆分 sprite 是最直接的两招。

## 5.10 本章小结

| 主题 | 结论 |
| --- | --- |
| 必填字段 | `version: 8`、`sources`、`layers` |
| 根字段 | 20 个，含 camera 初值、sprite/glyphs、light/sky/terrain/projection、transition、state |
| 图层类型 | 规范内 10 种；`custom` 由 `addLayer` 传入，不属于样式文件类型 |
| layout vs paint | layout 影响几何生成，paint 影响像素；前者改动的重算成本更高 |
| 关键默认值 | 线宽 1、圆半径 5、文字 16 px、背景黑、过渡 300 ms |
| filter | 两代语法可混用（会告警）；不支持 `feature-state`；zoom 只在整数级别求值 |
| 表达式约束 | 每个属性带 `expression.parameters`，决定能用 zoom/feature/feature-state 中的哪些 |
| 校验 | CLI 上 CI；运行时 `validateStyle` 默认 true，错误带路径 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第04章-Map对象与地图生命周期/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/maplibre-gl-js/第06章-数据源Source体系/" class="chapter-nav__next">下一章 →</a>
</div>

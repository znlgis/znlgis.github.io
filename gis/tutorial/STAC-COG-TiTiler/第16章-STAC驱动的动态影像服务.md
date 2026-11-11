---
layout: default
title: 第16章 - STAC 驱动的动态影像服务
---

# 第16章 - STAC 驱动的动态影像服务

第 15 章的 MosaicJSON 是"预生成索引"：先把文件列表烧成 quadkey 映射，再拿它出图。这条路稳定，但有一个前提——索引必须先在。当数据每天新增、检索条件由用户在前端勾选（时间、云量、传感器）时，预生成就成了瓶颈：一份索引覆盖不了任意组合，按组合预生成又会有组合爆炸。

STAC 驱动的动态服务把这一步推迟到请求时：用 STAC 检索拿到文件列表，立即出图。这一章讲清楚三件事——TiTiler 的 `/stac` 端点能做什么、动态 mosaic 怎么拼、这条路在什么规模下会失效。

---

## 16.1 两条完全不同的接入路径

"STAC 驱动"在工程上有两种做法，成本和能力差距很大，先分清：

| 路径 | 输入 | 索引 | 适用 |
|------|------|------|------|
| Item 直读 | 单个 STAC Item 的 URL | 无 | 单景浏览、多资产合成、按 render 出图 |
| 动态 mosaic | STAC 检索 API + 查询条件 | 请求时在内存里建 | 条件驱动浏览，规模在百级 Item 内 |
| 静态 mosaic | cogeo-mosaic 生成的 MosaicJSON | 预生成 | 千级以上文件、稳定出图、要 CDN |

第一条是同一次请求读一个 Item 的若干个 asset，TiTiler 的 `/stac` 端点就是它。第二条是用 `cogeo-mosaic` 的 `STACBackend`，每次请求 POST 一次 STAC 检索、在内存里构造 MosaicJSON，再走镶嵌流程。第三条是第 15 章。

选择的分界线是"每次请求要检索多少个 Item"。100 个以内，动态 mosaic 的额外开销可以接受；超过 300 个，检索本身就要分页多次，一次瓦片请求的延迟会突破 2 秒，前端会明显卡顿；再往上必须预生成。

## 16.2 /stac 端点：以 Item 为输入

`/stac` 这组路由来自 `MultiBaseTilerFactory(reader=STACReader)`。和 `/cog` 的区别不是路径，是"输入是一个 JSON 而不是一个 GeoTIFF"：

| 端点 | 说明 |
|------|------|
| `/stac/assets` | 列出 Item 里所有可读的 asset 名称 |
| `/stac/info` | 各 asset 的元数据（2.x 起必须带 `assets`） |
| `/stac/asset_statistics` | 逐 asset 的统计 |
| `/stac/statistics` | 合并后的统计 |
| `/stac/tiles/{tms}/{z}/{x}/{y}` | 多 asset 合成出图 |
| `/stac/{tms}/tilejson.json` | 带渲染参数的瓦片模板 |
| `/stac/point/{lon},{lat}` | 逐 asset 像元值 |
| `/stac/renders` | STAC Render 扩展定义的渲染预设 |
| `/stac/renders/{render_id}` | 单个预设的元数据与可用的瓦片链接 |

`STACReader` 的构造函数签名决定了哪些 asset 能用。它有一组过滤参数，默认值写在 `rio_tiler/io/stac.py`：

| 参数 | 默认 | 作用 |
|------|------|------|
| `include_asset_types` | `DEFAULT_VALID_TYPE` 白名单 | 只收 GeoTIFF/COG/JP2/HDF 等栅格类型 |
| `exclude_asset_types` | None | 排除特定类型 |
| `include_assets` | None | 只要指定名称的 asset |
| `exclude_assets` | None | 排除指定名称的 asset |
| `default_assets` | None | 未指定 `assets` 时的兜底 |

`DEFAULT_VALID_TYPE` 的内容值得抄下来，因为它是"为什么这个 asset 不出现"的唯一答案：`image/tiff; application=geotiff`、`image/tiff; application=geotiff; profile=cloud-optimized`、`image/tiff; profile=cloud-optimized; application=geotiff`、`image/vnd.stac.geotiff; cloud-optimized=true`、`image/tiff`、`image/x.geotiff`、`image/jp2`、`application/x-hdf5`、`application/x-hdf`。

注意里面没有 `image/png`、`image/jpeg`。一个 Item 里放了 PNG 预览图，`/stac/assets` 不会列它——这是设计如此，不是 bug。如果确实要读，得在构造 `STACReader` 时传自定义的 `include_asset_types`。

`/stac` 的最简调用：

```bash
ITEM="https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2A_50TMK_20240101_0_L2A"
BASE="http://127.0.0.1:8000/stac"

# 1. 有哪些 asset 可用
curl -s "$BASE/assets?url=$ITEM" | jq -r '.assets[]' | head

# 2. 看其中一个的元数据（2.x 必须带 assets）
curl -s "$BASE/info?url=$ITEM&assets=red&assets=nir" \
  | jq 'to_entries[] | {key: .key, dtype: .value.dtype}'

# 3. 真彩色出图
curl -s -o tc.png "$BASE/tiles/WebMercatorQuad/13/6707/3113.png\
  ?url=$ITEM&assets=red&assets=green&assets=blue&rescale=0,3000"
```

`assets` 在 2.x 是必填的，这一点和第 12 章的变更表一致。漏了会得到 400 加 `MissingAssets`；`/info` 与 `/statistics` 想一次看全部，用特殊值 `assets=:all:`。

更细的波段控制用资产选项语法：

```bash
# 每个资产只取第 1 波段，再做一个归一化指数
curl -s -o ndvi.png "$BASE/tiles/WebMercatorQuad/13/6707/3113.png\
  ?url=$ITEM&assets=red|bidx=1&assets=nir|bidx=1\
  &expression=b2-b1&rescale=-1,1&colormap_name=rdylgn"
```

这里 `b1`、`b2` 指的是"合成后数组"的第 1、2 波段，不是源文件的波段号。`assets=red|bidx=1` 表示从 red 资产里取第 1 个波段放进合成数组，`assets=nir|bidx=1` 表示 nir 的第 1 个波段，所以 `b1` 是 red、`b2` 是 nir，`expression=b2-b1` 就是 NIR 减 Red。这个对应关系在三个以上资产时最容易搞错，排查靠 `/stac/point` 的 `band_descriptions` 和 `values` 对照。

## 16.3 STAC Render 扩展

`/stac/renders` 是 `stacRenderExtension` 注册的，读的是 Item 里的 `renders` 字段（STAC Render 扩展）。它把"渲染配方"从服务端配置搬进了 Item，前端拿 Item 就知道怎么出图。

一个带 `renders` 的 Item 片段：

```json
{
  "type": "Feature",
  "stac_version": "1.1.0",
  "id": "S2A_50TMK_20240101_0_L2A",
  "properties": {
    "datetime": "2024-01-01T03:12:00Z",
    "renders": {
      "truecolor": {
        "title": "True Color",
        "assets": ["red", "green", "blue"],
        "rescale": [[0, 3000], [0, 3000], [0, 3000]],
        "minmax_zoom": [0, 15]
      },
      "ndvi": {
        "title": "NDVI",
        "assets": ["red", "nir"],
        "expression": "(b2-b1)/(b2+b1)",
        "rescale": [[-1, 1]],
        "colormap_name": "rdylgn"
      }
    }
  }
}
```

`GET /stac/renders?url=<item>` 会返回每个 render 的 `valid`、`params` 和一组 `links`，links 里直接给出拼好的瓦片模板与 tilejson 地址。这是把"渲染配方"交给数据生产方维护的标准做法——换了映射方案，改 Item 即可，不用改服务端配置、也不用前端发版。

`minmax_zoom` 在 `RenderItem` 模型里被声明为两个整数的数组，用来限制该 render 可用的层级。TiTiler 本身不对超出范围的请求做拦截，这个字段是给客户端做层级选择用的。

`RenderItem` 还兼容旧版本写法：如果 Item 里写的是 `asset_bidx` 或 `asset_expression`（1.x 语法），`_adapt_render_for_v2()` 会把它翻译成 2.x 的 `assets=A|bidx=1` 形式。这意味着从旧目录升级到 2.x 时，Item 里的 renders 不用改写。

一个细节：`/renders` 返回的 `valid` 字段是"这组参数能不能通过 tile 端点的依赖校验"的结果。`valid: false` 说明配方里用了不支持的参数名，比如 `tile_scale`（2.x 已删除）。这条信息比 500 报错有用得多。

## 16.4 动态 mosaic：STACBackend

`cogeo-mosaic` 的 `STACBackend` 是只读 backend，URL 用 `stac+https://` 前缀。它的工作方式很直接：每次打开时 POST 一次 STAC 检索，把返回的 Item 烧成内存里的 MosaicJSON。

```python
from cogeo_mosaic.backends import MosaicBackend

query = {
    "collections": ["sentinel-2-l2a"],
    "bbox": [116.2, 39.8, 116.6, 40.1],
    "datetime": "2024-01-01/2024-03-31",
    "query": {"eo:cloud_cover": {"lt": 10}},
    "limit": 500,
    "fields": {
        "include": ["id", "properties.datetime", "assets.red.href", "assets.nir.href"],
        "exclude": ["geometry"],
    },
}

with MosaicBackend(
    "stac+https://earth-search.aws.element84.com/v1/search",
    query=query,
    minzoom=8,
    maxzoom=15,
    mosaic_options={"accessor": lambda f: f["assets"]["red"]["href"]},
) as mosaic:
    print(len(mosaic.mosaic_def.tiles))
    img = mosaic.tile(12, 3372, 1552)
```

三个关键参数：

**`accessor`** 决定"MosaicJSON 的每个值是什么"。默认的 `default_stac_accessor` 优先取 Item 的 `self` 链接，其次用 `root` 链接拼出 `/collections/{c}/items/{id}`，最后回退到 Item ID。这三种形式对 TiTiler 来说都只是字符串，真正被 GDAL 打开时需要一个能解析它的 reader。用 `accessor` 直接取 asset 的 `href` 是最省事的做法——MosaicJSON 里存的就是 COG 直链，`Reader` 能直接打开。

**`mosaic_options`** 里的 `tilematrixset` 决定 quadkey 的网格。默认是 `WebMercatorQuad`；换 TMS 时必须同时把 `minzoom`/`maxzoom` 按新 TMS 的口径给，否则 quadkey 层级会算错。官方文档专门用一节讲了这件事。

**`stac_api_options`** 有两个分页参数：`max_items` 限总量，`limit` 限单页。默认不限总量，遇到覆盖全球的 collection 加宽松的时间条件，会一直翻页到超时。生产环境必须设 `max_items`，它既是成本护栏也是延迟护栏。

接进 TiTiler 时，`MosaicTilerFactory` 的 `backend` 换成 `MosaicBackend`，URL 传 `stac+https://...` 即可，其余和静态 mosaic 一样。但要注意 `backend_dependency`：检索条件不能写在 URL 里（太长了），通常得自定义一个 dependency 从固定配置或短参数构造 query。

```python
from typing import Annotated

from fastapi import Depends, Query


def StacQueryParams(
    cloud: Annotated[int, Query(ge=0, le=100, description="最大云量百分比")] = 20,
    days: Annotated[int, Query(ge=1, le=365, description="回看天数")] = 30,
) -> dict:
    """把少量 query 参数翻译成 STAC 检索条件。"""
    from datetime import datetime, timedelta, timezone

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return {
        "collections": ["sentinel-2-l2a"],
        "datetime": f"{start:%Y-%m-%dT%H:%M:%SZ}/{end:%Y-%m-%dT%H:%M:%SZ}",
        "query": {"eo:cloud_cover": {"lt": cloud}},
    }
```

这样前端只需要传 `cloud=10&days=7`，检索条件由服务端拼。直接暴露完整 STAC 查询是危险的：它可以把 `limit` 设到很大，一次请求把整个 collection 拉下来。

## 16.5 与 STAC API 的分工

`/stac` 端点只认 Item URL 或直接内联的 Item，不认 STAC API 的检索接口。这句话要成立需要补一句：`STACReader` 的 `input` 会被 `fetch()` 用 httpx 拉取，只要那个 URL 返回合法的 Item JSON 就行。所以"动态"这一半必须靠 STAC API 或者 `STACBackend`。

分工也就清楚了：

| 职责 | 由谁承担 |
|------|----------|
| 检索（时间/空间/属性过滤、分页、排序） | STAC API（第 8～10 章） |
| Item 到 COG 的映射 | Item 的 `assets` 字段 |
| 渲染配方 | Item 的 `renders`（Render 扩展）或 URL 参数 |
| 瓦片生成 | TiTiler |
| 索引 | MosaicJSON（静态）或 STACBackend（动态） |

典型的前端交互是两步：先调 STAC API 的 `/search` 拿 Item 列表（只取 `id`、`bbox`、`datetime`、`assets.thumbnail.href` 几个字段），列表页用缩略图；用户点进某个 Item，再调 `/stac/renders?url=<item>` 和 `/stac/tiles/...` 出图。

不要让列表页直接请求 `/stac/info`。一个 50 条的列表页会产生 50 次文件打开，每次都要读 COG 头，S3 上就是几百个 Range 请求。正确做法是在入库时就把 `info` 的结果写进 Item 的属性里，列表页只读 STAC API。

一个可用的检索请求（用 `fields` 裁剪返回体，能显著降低延迟）：

```bash
curl -s -X POST "https://earth-search.aws.element84.com/v1/search" \
  -H "Content-Type: application/json" \
  -d '{
    "collections": ["sentinel-2-l2a"],
    "bbox": [116.2, 39.8, 116.6, 40.1],
    "datetime": "2024-01-01T00:00:00Z/2024-03-31T23:59:59Z",
    "query": {"eo:cloud_cover": {"lt": 10}},
    "limit": 50,
    "fields": {
      "include": ["id", "bbox", "properties.datetime", "properties.eo:cloud_cover",
                  "assets.thumbnail.href", "assets.red.href"],
      "exclude": ["geometry", "links"]
    }
  }' | jq '.features | length'
```

`fields.include` 里必须显式写 `assets.xxx.href`，只写 `assets` 会把整个资产对象带回来，体积可能翻十倍。返回体在 50 条时通常还有 100～300 KB，这是列表页首屏延迟的主要来源。

## 16.6 排错

**`MissingAssets: No valid asset found. Asset's media types not supported`。** Item 里没有符合 `DEFAULT_VALID_TYPE` 白名单的资产。常见于自己生成的 Item：asset 的 `type` 写成 `image/tiff` 之外的字符串（如 `image/tiff; application=geotiff; profile=cloud-optimized; application=gdal` 多写了参数），或者干脆没写 `type`。修法是补齐 media type，或在构造 `STACReader` 时放宽 `include_asset_types`。

**`InvalidAssetName` → 404，但 `/stac/assets` 里明明有。** 大小写不匹配，或者 asset 名里含 `.`、`-` 等被 URL 编码破坏的字符。`assets=red.nir` 会被当成两个参数的开始，必须用 `%2E` 或者改名。

**Item 能打开，但瓦片全黑。** 多半是 asset 的 `href` 是相对路径。STAC 1.1.0 的 Link 与 Asset 都允许相对 href，解析时要基于 Item 的 `self`（`scheme://host/path/to/item.json`）解析成绝对路径。`pystac.Item.from_dict(data, href)` 的第二个参数就是做这件事的；如果 Item 缺 `self` 链接，相对路径就解析不了。

**`/stac/info` 返回 400 提示缺 assets。** 2.x 的行为，用 `assets=:all:` 或显式列出。

**`STACBackend` 超时。** 检索结果超过 `max_items` 或者没有任何限制。给 `stac_api_options` 加 `max_items`，并把 `fields` 裁到最小。

**动态 mosaic 出来的图与列表页看到的顺序不一致。** `PixelSelectionMethod.first` 用的顺序是 STAC 返回顺序，而 STAC API 不保证排序稳定。要让"最新的优先"，得在 query 里加 `sortby`（STAC API 的 Sort 扩展），或者用 `lastbandhigh` 配合质量波段。

## 16.7 生产建议

- **Item 里塞 `renders`，不要塞参数**。渲染配方属于数据，改配方不该触发服务端发版；而 `renders` 能被 `/stac/renders` 直接消费，也能被 tilejson 的 `raster_layers` 暴露给前端。
- **动态 mosaic 只做"探索"，不做"产品"**。用户拖动地图时每个瓦片都触发一次检索，成本不可控。把探索结果固化成 MosaicJSON，才是可缓存、可计量的形态。
- **给 STAC API 的检索加短 TTL 缓存**。同一 bbox + 时间窗在许多瓦片请求里重复出现，用 `(bbox, datetime, query)` 的哈希做键，缓存 30～60 秒，能把检索请求数降一个数量级。
- **列表页与出图页分离**。列表页只读 STAC API 的裁剪字段，出图页才碰 TiTiler。混在一起的后果是列表页 P95 被瓦片服务的冷启动拖垮。
- **`assets` 顺序要在文档里写死**。`assets=red&assets=green&assets=blue` 的顺序决定 RGB 通道，多资产合成时前端随机排列是最常见的"颜色不对"来源。

## 16.8 本章要点

| 结论 | 依据 |
|------|------|
| `/stac` 只接受符合白名单媒体类型的 asset | `STACReader.DEFAULT_VALID_TYPE` |
| 2.x 的 `/stac/info` 必须带 `assets`，全部用 `:all:` | 2.0 迁移文档 |
| 资产选项里 `bN` 指合成数组的波段 | `AssetsExprParams` 与 `_parse_asset()` |
| `/stac/renders` 读 Item 的 `renders` 字段 | `stacRenderExtension` 与 STAC Render 扩展 |
| 旧版 `asset_bidx` 会被自动翻译 | `_adapt_render_for_v2()` |
| `STACBackend` 每次打开都重新检索 | cogeo-mosaic backends 文档 |
| 动态 mosaic 的规模上限约百级 Item | 检索延迟随 Item 数线性增长 |
| `fields.include` 要精确到 `assets.x.href` | 只写 `assets` 会带全对象 |

下一章处理"出图之后"：这些瓦片怎么被 CDN 缓存、缓存键怎么设计才不会被参数污染、签名地址与 token 该放在哪一层。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第15章-MosaicJSON与影像镶嵌/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第17章-瓦片缓存CDN与鉴权/" class="chapter-nav__next">下一章 →</a>
</div>

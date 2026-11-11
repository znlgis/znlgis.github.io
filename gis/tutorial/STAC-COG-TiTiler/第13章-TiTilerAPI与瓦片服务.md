---
layout: default
title: 第13章 - TiTiler API 与瓦片服务
---

# 第13章 - TiTiler API 与瓦片服务

上一章把 TiTiler 拆成了工厂和中间件。这一章落到具体接口：一次瓦片请求吃哪些参数、返回什么结构、哪些参数会真的改变像素。很多人调 TiTiler 的挫败感来自“参数写进去了但画面没变”，根因通常不是参数写错，而是参数没走到对应环节——`nodata` 影响的是读取，`rescale` 影响的是渲染，两者错配就会得到一张全白或全黑的图。

先把一条硬规则放前面：**TiTiler 的 query 参数不是自由文本，每一个都绑定到一个 Pydantic 模型，非法值在依赖注入阶段就被拒绝**。好处是坏参数不会带进 GDAL；代价是错误信息是 422 加一段 JSON Schema 描述，不熟悉的人容易以为服务挂了。

---

## 13.1 一次瓦片请求的几何

`/cog/tiles/{tileMatrixSetId}/{z}/{x}/{y}` 里的 `z/x/y` 不是“第几级第几列”，而是“在指定 TileMatrixSet 的第 z 个矩阵里的列行号”。同一个 `z/x/y` 在 `WebMercatorQuad` 和 `WorldCRS84Quad` 下指向完全不同的地理范围，这是两个 TMS 混用时最常见的错位来源。

WebMercatorQuad 的定义（EPSG:3857，原点在左上，`pointOfOrigin = [-20037508.3427892, 20037508.3427892]`）：

```text
第 z 级矩阵宽高 = 2^z 个瓦片
单瓦片地理跨度 = 40075016.6855785 / 2^z 米
z=0   单瓦片约 40075 km（全球一张）
z=10  单瓦片约 39.1 km
z=14  单瓦片约 2.45 km
z=18  单瓦片约 153 m
```

一张瓦片在像元层面是 256×256（TMS 的 `tileWidth × tileHeight`），所以 z=14 时地面分辨率约 2.45 km / 256 ≈ 9.6 m。当源数据是 10 m 分辨率的 Sentinel-2 时，z=14 已经接近 1:1，往下的 z=13、z=12 会读 overview，往上的 z=15 及以上要做上采样。这个“哪一级开始读 overview”的判断在 rio-tiler 内部由 `minzoom`／`maxzoom` 和源数据的 internal overviews 决定，`/info` 能看到结果。

反查：给一个经纬度，怎么算它落在哪张瓦片？

```python
import math

def lonlat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)

print(lonlat_to_tile(116.391, 39.907, 12))   # 北京，z=12
# 预期输出形如 (3372, 1552)，具体值取决于取整规则
```

`asinh(tan(lat))` 等价于 Web 墨卡托的 y 反算，比手写对数公式数值更稳。纬度超过 ±85.0511° 时没有对应瓦片，clamp 会把结果压到边缘，真实请求则得到 404。

## 13.2 端点全景

`TilerFactory` 注册的端点按功能分四组。下表是 2.x 的实际路径（前缀由 `include_router` 决定，这里省略）：

| 分组 | 方法 | 路径 | 返回 |
|------|------|------|------|
| 元数据 | GET | `/info` | `Info` JSON：bounds、band_descriptions、dtype、nodata_type 等 |
| 元数据 | GET | `/info.geojson` | 同上，包成 GeoJSON Feature，带 bbox 与 geometry |
| 统计 | GET | `/statistics` | 波段名为键的 `BandStatistics` 字典 |
| 统计 | POST | `/statistics` | 对 GeoJSON 范围内做统计 |
| OGC Tiles | GET | `/tiles` | `TileSetList`，每个 TMS 一个 tileset |
| OGC Tiles | GET | `/tiles/{tileMatrixSetId}` | 单个 tileset 元数据 |
| 瓦片 | GET | `/tiles/{tileMatrixSetId}/{z}/{x}/{y}` | 图片或二进制 |
| 瓦片 | GET | `/tiles/{tileMatrixSetId}/{z}/{x}/{y}.{format}` | 指定格式 |
| 前端 | GET | `/{tileMatrixSetId}/tilejson.json` | TileJSON 3.0.0 |
| 前端 | GET | `/{tileMatrixSetId}/map.html` | 内置查看器 HTML |
| 采样 | GET | `/point/{lon},{lat}` | 像元值 |
| 出图 | GET | `/preview[/{width}x{height}][.{format}]` | 整幅预览 |
| 出图 | GET | `/bbox/{minx},{miny},{maxx},{maxy}[/{w}x{h}].{format}` | 指定范围 |
| 出图 | POST | `/feature[/{w}x{h}][.{format}]` | 按 GeoJSON 裁切 |
| OGC Maps | GET | `/map` | WMS 风格的 `bbox` + `width` + `height` + `crs` |

`/tiles` 与 `/tiles/{tileMatrixSetId}` 是 OGC API - Tiles 的元数据端点，结构来自 `models/OGC.py` 的 `TileSetList`。每个 tileset 里最有用的是 `rel` 为 `tile` 的那条链接：

```json
{
  "tilesets": [{
    "title": "tileset tiled using WebMercatorQuad TileMatrixSet",
    "dataType": "map",
    "crs": "http://www.opengis.net/def/crs/EPSG/0/3857",
    "boundingBox": {
      "lowerLeft": [-180.0, -85.0511287798066],
      "upperRight": [180.0, 85.0511287798066],
      "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
    },
    "links": [
      {"href": ".../tiles/WebMercatorQuad/{z}/{x}/{y}?url=...", "rel": "tile"}
    ]
  }]
}
```

`boundingBox.crs` 用的是 `CRS84`（经纬度、经度在前），而 tileset 的 `crs` 是 `EPSG/0/3857`。一个是数据范围所在的 CRS，一个是瓦片网格的 CRS，两者不一致是规范要求，不是 bug。写客户端时把 bbox 当成 3857 米制坐标去算会得到完全错误的结果。

## 13.3 瓦片端点的参数

路径参数只有五个，查询参数按依赖分组。下表按“影响哪一段”归类，这个归类比按字母排序有用得多：

| 参数 | 类型/默认 | 影响阶段 | 说明 |
|------|-----------|----------|------|
| `tileMatrixSetId` | 路径，必填 | 几何 | TMS 标识，非法值 422 |
| `z` `x` `y` | 路径，整数 | 几何 | 矩阵行列号，越界 404 |
| `format` | 路径，可选 | 编码 | png/jpg/jpeg/webp/tif/tiff/jp2/npy/pngraw |
| `url` | query，必填 | 读取 | 数据集地址，支持 `s3://`、`/vsis3/`、`http(s)://` |
| `bidx` | 可重复整数 | 读取 | 波段序号，从 1 开始 |
| `expression` | str | 读取 | 波段运算，如 `b4/b3`，分号分隔多表达式 |
| `nodata` | int/float/`nan` | 读取 | 覆盖内部 nodata |
| `unscale` | bool，默认 False | 读取 | 应用数据集内部 scale/offset |
| `resampling` | 枚举，默认 nearest | 读取 | RasterIO 重采样，9 个合法值 |
| `reproject` | 枚举，默认 nearest | 读取 | 重投影时的 WarpKernel，14 个合法值 |
| `buffer` | float，默认 0 | 读取 | 瓦片外扩，单位是像元数的一半，必须 0.5 的倍数 |
| `padding` | int，默认 0 | 读取 | 边缘补边，减少重采样接缝 |
| `tilesize` | int，默认取 TMS 矩阵尺寸 | 读取 | 覆盖输出尺寸，如 512 |
| `rescale` | 可重复 `min,max` | 渲染 | 逐波段拉伸 |
| `color_formula` | str | 渲染 | rio-color 公式 |
| `colormap_name` | 枚举 | 渲染 | rio-tiler 内置色带名 |
| `colormap` | str（JSON） | 渲染 | 自定义色带 |
| `return_mask` | bool，默认 True | 渲染 | 是否把掩膜写进输出 |
| `algorithm` | 枚举 | 后处理 | 内置算法名，如 hillshade |
| `algorithm_params` | str（JSON） | 后处理 | 算法参数 |

两个容易误解的默认值：

`resampling` 只管同一 CRS 内的缩放，`reproject` 只在重投影时生效。源数据是 UTM、TMS 是 WebMercator 时两步都会发生，只改前者而图像仍模糊，通常是卡在了后者。

`buffer=0.5` 得到的不是 256×256，而是 257×257。官方参数说明写得很清楚：输出尺寸会扩展为 `tilesize + 2 * buffer`。做瓦片拼接时如果忘了裁掉这圈 buffer，相邻瓦片会出现一像素错位。

## 13.4 输出格式与 dtype

格式决定 dtype 的合法范围，完整对照表来自 `render_image()` 里的 `format_dtypes`：

| 格式 | 合法 dtype | 媒体类型 | 典型体积（256×256） |
|------|-----------|----------|---------------------|
| png | uint8, uint16 | image/png | 8～40 KB |
| pngraw | uint8, uint16 | image/png | 同上，但保留原始掩膜行为 |
| jpeg / jpg | uint8 | image/jpeg | 5～20 KB |
| webp | uint8 | image/webp | 3～15 KB |
| jp2 | uint8, int16, uint16 | image/jp2 | 10～50 KB |
| tif / tiff | 任意 | image/tiff; application=geotiff | 100 KB～1 MB |
| npy | 任意 | application/x-binary | 原始字节，3 波段 256×256 的 uint16 约 512 KB |

体积是经验值：同样 256×256，海面几乎纯色的 JPEG 只要 3 KB，城市纹理能到 25 KB。容量规划按 15 KB 估 P50、40 KB 估 P95。

`npy` 是最容易被低估的格式。它返回 NumPy 的 `.npy`，形状是 `(bands + 1, height, width)`，最后一片是掩膜。用它做像素级校验比解 PNG 可靠得多：

```python
import io

import numpy
import requests

BASE = "http://127.0.0.1:8000/cog"
URL = "https://example.com/data/scene.tif"

r = requests.get(
    f"{BASE}/tiles/WebMercatorQuad/13/6707/3113.npy",
    params={"url": URL, "bidx": [1, 2, 3]},   # 可重复参数用 list
    timeout=30,
)
r.raise_for_status()
arr = numpy.load(io.BytesIO(r.content))
print(arr.shape, arr.dtype)        # 例：(4, 256, 256) uint16
data, mask = arr[:-1], arr[-1]
print(data[0].min(), data[0].max(), mask.mean())
```

`bidx=[1,2,3]` 被编码成 `bidx=1&bidx=2&bidx=3`，正是 FastAPI 解析整数列表期望的形式。写成 `bidx=1,2,3` 会 422，因为 `BidxParams.indexes` 不会拆分逗号串。

另一个坑是 `return_mask`。默认 True 时 PNG 会带 alpha 通道；JPEG 不支持 alpha，会被静默丢弃。如果下游做拼接，用 `return_mask=false` 加 PNG 更省体积，但边缘会变成黑色而不是透明。

## 13.5 tilejson：前端的接入契约

`/{tileMatrixSetId}/tilejson.json` 不只是便利端点，它决定了前端怎么拼 URL。返回体在标准 TileJSON 3.0.0 字段之外，额外塞了四个 TiTiler 专有字段：

| 字段 | 来源 | 用途 |
|------|------|------|
| `tiles` | 由当前请求的 query 重写生成 | 瓦片模板，已带全部渲染参数 |
| `bounds` | `get_geographic_bounds()` | 数据范围（经纬度） |
| `minzoom` / `maxzoom` | 源数据推导，可被 query 覆盖 | 前端跳级 |
| `attribution` | 环境变量 `TITILER_DEFAULT_ATTRIBUTION` | 版权署名 |
| `raster_layers` | `get_renders(src_dst)` | STAC Render 定义的图层 |
| `band_descriptions` | `info()` | 波段含义 |
| `data_type` | `info()` | 数据类型，用来决定 rescale |
| `minmax` | `info()` | 各波段最小最大值，可直接用作 rescale |

`tiles` 字段的生成逻辑值得单独说：它把请求里除 `tilematrixsetid`、`tile_format`、`minzoom`、`maxzoom` 之外的**所有** query 原样带到瓦片 URL 上，并在缺省时补一个 `tilesize`。这意味着三件事：

- 调 `tilejson.json?url=..&rescale=0,3000&colormap_name=viridis`，前端拿到的瓦片模板会自动带上这两个参数，前端不用重复配置；
- 反过来，任何不想泄漏的参数（比如内部 token）也会被带进 `tiles`，出现在浏览器 Network 面板里；
- 参数过多时 URL 会很长，某些代理对 2 KB 以上的 URL 有截断风险。

实际的返回样例（字段顺序按模型定义）：

```json
{
  "tilejson": "3.0.0",
  "scheme": "xyz",
  "tiles": ["https://t.example.com/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=...&tilesize=512"],
  "bounds": [116.28, 39.83, 116.51, 40.02],
  "minzoom": 6,
  "maxzoom": 20,
  "data_type": "uint16",
  "minmax": [[0, 65535]]
}
```

`scheme` 默认是 `xyz`（y 轴向下），不是 `tms`（y 轴向上）。MapLibre 和 Leaflet 默认都按 xyz 处理，所以不用管；自己写瓦片解码器时如果按 TMS 处理，整幅图会上下颠倒。

`tilesize` 的默认值在这里是 512，而瓦片端点默认取 TMS 的 256。这个不一致是有意的：2.0 把 tilejson 默认改成 512，因为高 DPI 屏上 512 更清晰且请求数减半，且 MapLibre 的 raster source 默认也是 512，两端刚好对上。

## 13.6 info、statistics、point 的返回

`/info` 是最该先调的端点，返回 `rio_tiler.models.Info`：

| 字段 | 含义 | 排错用途 |
|------|------|----------|
| `bounds` | 数据集范围（WGS84） | 判断瓦片是否落在数据外 |
| `band_metadata` | 每波段的元数据元组 | 看 nodata、单位 |
| `band_descriptions` | 波段描述 | 判断波段顺序 |
| `dtype` | 数据类型 | 决定 rescale 与输出格式 |
| `nodata_type` | `Alpha`/`Mask`/`Internal`/`Nodata`/`None` | 掩膜从哪来 |
| `colorinterp` | 色彩解释 | 判断是否已经是 RGB |
| `scales` / `offsets` | 内部缩放 | 决定 `unscale` 要不要开 |
| `colormap` | 内嵌色带 | 判断是否需要外部色带 |

`nodata_type` 能解释绝大多数“黑边”：`Alpha` 有 alpha 波段，`Mask` 有独立掩膜波段，`Internal` 是 TIFF 内部 mask，`Nodata` 是 nodata 值，`None` 没有任何掩膜。最后一种情况下透明区按 0 渲染，出图一片黑。

`/statistics` 默认返回每个波段的统计，`percentiles` 默认 `[2, 98]`，`histogram_bins` 默认 10。返回结构里 `histogram` 是 `[counts, bin_edges]` 的两行数组——计数在前、边界在后，这一点与 numpy 的返回值顺序相反，直接画图时别弄反。做自动拉伸时用 `p2` 和 `p98` 比用 `min`／`max` 稳，因为后者会被单个异常像元拉到极端值。

`/point/{lon},{lat}` 返回：

```json
{
  "coordinates": [116.391, 39.907],
  "values": [1234.0],
  "band_names": ["1"],
  "band_descriptions": ["B04"]
}
```

`values` 里可能是 `null`——当该点落在掩膜区或数据外时。前端把 `null` 当 0 处理是最常见的数值错误来源。另外 TiTiler 用的 `JSONResponse` 会把 `NaN`、`Infinity` 转成 `null`，因为标准 JSON 不支持这三个字面量。

## 13.7 完整调用示例

用 curl 走一遍从元数据到瓦片的完整链路，每一步都有明确的预期输出：

```bash
BASE="http://127.0.0.1:8000/cog"
SRC="https://example.com/data/scene.tif"

# 1. 数据集信息
curl -s "$BASE/info?url=$SRC" | jq '{bounds, dtype, nodata_type, band_descriptions}'

# 2. 统计（用 2/98 分位做拉伸区间）
curl -s "$BASE/statistics?url=$SRC&bidx=1&p=2&p=98" | jq '.1 | {min, max}'

# 3. 可选 TMS 与瓦片模板
curl -s "$BASE/tiles?url=$SRC" | jq '.tilesets[].links[] | select(.rel=="tile") | .href'

# 4. 一张瓦片，存盘后看大小与类型
curl -s -o tile.png -w '%{http_code} %{content_type} %{size_download}\n' \
  "$BASE/tiles/WebMercatorQuad/12/3372/1552.png?url=$SRC&rescale=0,3000"

# 5. 检查缓存头
curl -sI "$BASE/tiles/WebMercatorQuad/12/3372/1552.png?url=$SRC" | grep -i cache-control
```

第 5 步的预期输出是 `cache-control: public, max-age=3600`，来自 `ApiSettings.cachecontrol` 的默认值。这个头是 CDN 能否生效的前提，第 17 章展开。

再用 Python 做一次批量校验：给定一组瓦片坐标，统计哪些返回 200、哪些 404。验收新数据集时用它能快速画出实际覆盖范围。

```python
import requests

BASE = "http://127.0.0.1:8000/cog"
SRC = "https://example.com/data/scene.tif"

def probe(x: int, y: int) -> int:
    return requests.get(
        f"{BASE}/tiles/WebMercatorQuad/10/{x}/{y}.png",
        params={"url": SRC, "rescale": "0,3000"},
        timeout=20,
    ).status_code

codes = [probe(x, y) for x in range(840, 860) for y in range(380, 400)]
print(f"命中 {codes.count(200)}/{len(codes)}")
```

这段是串行的，40 个请求大约 2～4 秒。要压测并发应当用独立脚本，别把验收脚本当成压测工具——它的目的是"覆盖范围对不对"，不是"能扛多少 QPS"。



## 13.8 状态码与错误语义

错误处理集中在 `titiler/core/errors.py` 的 `DEFAULT_STATUS_CODES`，映射关系是固定的：

| 异常 | HTTP | 触发条件 |
|------|------|----------|
| `MissingBands` | 400 | 没给 `bidx` 也没给 `expression`，而数据集是多波段 |
| `MissingAssets` | 400 | 多资产端点没给 `assets`（2.x 起必填） |
| `InvalidExpression` | 400 | 表达式语法错，或引用了不存在的波段 |
| `InvalidFormat` | 400 | 输出格式不在枚举内 |
| `InvalidColorFormat` | 400 | `color_formula` 无法解析 |
| `InvalidAssetName` | 404 | `assets=` 指定的资产不存在 |
| `InvalidBandName` | 404 | 表达式里的 `bN` 超出波段数 |
| `TileOutsideBounds` | 404 | 瓦片与数据范围不相交 |
| `RasterioIOError` | 500 | 文件打不开：路径错、权限、网络 |
| `RioTilerError` | 500 | rio-tiler 内部错误 |

这张表要记住的是 **404 的两种含义**：`TileOutsideBounds` 是“这片本来没数据”，`InvalidAssetName`/`InvalidBandName` 是“资源名错”。前者正常，后者是配置错误。日志里两者都表现为 404，生产环境要按 `detail` 里的异常名分桶，否则告警会被正常空瓦片淹没。

502/504 不在 TiTiler 的错误表里，它们来自上游：代理超时、对象存储 5xx。`RasterioIOError` 被映射成 500 而不是 502，这是可以商榷的设计——监控会把“上游存储故障”算成“服务自身故障”。

## 13.9 踩坑清单

**`expression` 与 `bidx` 同时给。** 两个依赖都在 `layer_dependency` 里，`BidxExprParams` 的继承顺序是 `ExpressionParams` 在前、`BidxParams` 在后，`expression` 优先。同时给不会报错，`bidx` 被忽略。

**`rescale` 的个数少于波段数。** rio-tiler 的 `rescale_image()` 里有一句 `if len(in_range) != nbands: in_range = ((in_range[0]),) * nbands`，也就是所有波段都套用第一组 rescale。三波段影像只给 `rescale=0,1000` 时，绿蓝波段也会用 0～1000 拉伸，大概率过曝。

**URL 里带 `&` 的签名地址。** 预签名 URL 自带 `?X-Amz-Signature=...&X-Amz-Date=...`，直接塞进 `url=` 会把后面的参数当成本服务的 query。两种解法：整段 base64 编码，或者只把 query 部分编码后单独传。官方示例给了完整的自定义 `path_dependency` 写法（见 `docs/src/examples/code/working_with_signed_urls.md`）。

**`tilesize=512` 但前端没设 `tileSize`。** MapLibre 的 raster source 默认 512，Leaflet 的 `TileLayer` 默认 256。前者不用改，后者必须写 `tileSize: 512`，否则图像被切成四块各显示一角。

**`unscale=true` 之后 rescale 区间没跟着变。** `unscale` 会把 DN 值按 `scale`/`offset` 转成物理量，数值范围可能从 0～10000 变成 0～1。原来写的 `rescale=0,3000` 就完全失效了。先 `/info` 看 `scales`/`offsets`，再定 rescale。

## 13.10 生产建议

- **把 `/info` 与 `/statistics` 的结果缓存到配置里**。这两个端点要打开文件读元数据，在列表页会成倍放大。
- **`maxzoom` 要显式给**。让 rio-tiler 自己推可能得到 22 甚至更高，而源数据只到 18，多出来的层级全是上采样，白白消耗 CPU 和带宽。
- **错误日志只记 `url` 尾部 64 个字符**。完整 URL 可能含签名，写进日志就是泄漏。
- **对 `/tiles` 与 `/{tms}/tilejson.json` 做短 TTL 缓存**。它们随数据集变化，但一秒内不会变，`max-age=60` 就能挡掉大部分重复请求。
- **`/statistics` 限制 `max_size`**。默认预览是 1024，对超大栅格会读很多块；做自动拉伸建议固定 `max_size=256`，精度足够且成本降一个数量级。

## 13.11 本章要点

| 结论 | 依据 |
|------|------|
| `z/x/y` 只在指定 TMS 下有地理含义 | WebMercatorQuad 与 WorldCRS84Quad 的原点和分辨率不同 |
| `buffer=0.5` 使输出变成 `tilesize+1` | `TileParams.buffer` 的官方描述 |
| `resampling` 与 `reproject` 是两段插值 | `DatasetParams` 的两个独立字段 |
| jpeg/webp 只接受 uint8，png 接受 uint8/uint16 | `render_image()` 的 `format_dtypes` |
| npy 形状是 `(bands+1, h, w)`，末片为掩膜 | 官方 output_format 文档 |
| tilejson 的 `tiles` 会带上全部 query 参数 | `tilejson` 端点的 query 透传逻辑 |
| tilejson 默认 tilesize 512，瓦片端点默认取 TMS 尺寸 | 2.0.0a1 变更记录 |
| 404 同时表示“无数据”与“资源名错” | `TileOutsideBounds` 与 `InvalidAssetName` 都映射 404 |

下一章进入渲染层：`rescale`、`colormap`、`color_formula`、`algorithm` 分别在哪一步改像素，以及为什么同一份数据在不同重采样下会差出一个像素的地物边界。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第12章-TiTiler架构与部署/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第14章-动态渲染重采样与色彩/" class="chapter-nav__next">下一章 →</a>
</div>

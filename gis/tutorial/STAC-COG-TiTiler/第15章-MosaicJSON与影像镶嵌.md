---
layout: default
title: 第15章 - MosaicJSON 与影像镶嵌
---

# 第15章 - MosaicJSON 与影像镶嵌

单片 COG 的瓦片服务，`/cog` 一个端点就够了。但真实业务几乎没有"只看一景"的场景：一个省域的正射影像有上千个分幅，一个时间序列的关键帧有几十期。把上千个 URL 塞进一次请求，路由和参数长度都不允许；逐景出图再在前端拼，接缝和色彩都不一致。

这中间需要一层"哪些文件覆盖了这张瓦片"的索引，这就是 MosaicJSON。它不存像素，只存"瓦片坐标 → 文件列表"的映射，让一次请求知道该打开哪几个 COG、按什么顺序叠加。

---

## 15.1 MosaicJSON 是什么

MosaicJSON 是一份 JSON 规范，当前版本 0.0.3（`developmentseed/mosaicjson-spec` 仓库的 `0.0.3/Readme.md` 与 `schema.json`）。它的定位一句话就能说清：**面向 XYZ 瓦片的 COG 清单**。

和 STAC 的区别值得先厘清，两者经常被混用：

| 维度 | STAC Item | MosaicJSON |
|------|-----------|-----------|
| 描述单位 | 一个资产（一景、一个文件） | 一组资产的瓦片级索引 |
| 空间表达 | 几何 + bbox | quadkey → 文件列表 |
| 时间表达 | `datetime` / `start_datetime` | 无（要靠文件列表里的顺序或 backend 侧处理） |
| 用途 | 目录、检索、溯源 | 直接驱动瓦片渲染 |
| 生成方式 | 采集时元数据抽取 | 从文件列表烧制（burn） |
| 标准 | STAC 1.1.0 | MosaicJSON 0.0.3 |

简单说：STAC 回答"有什么"，MosaicJSON 回答"这张瓦片用哪几个文件"。前者可以很重（带完整元数据、扩展、链接），后者必须很轻，因为它会在每次瓦片请求时被读取。

## 15.2 字段与约束

规范里 17 个字段，真正影响渲染的是下面 8 个：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `mosaicjson` | 是 | string | 版本号，形如 `0.0.3` |
| `tiles` | 是 | object | quadkey → 文件 URL 数组 |
| `minzoom` | 是 | int | 最小层级，键所在层级 |
| `maxzoom` | 是 | int | 最大层级，必须 ≥ minzoom |
| `bounds` | 是（schema） | array | `[left, bottom, right, top]`，WGS84 |
| `quadkey_zoom` | 否 | int | 索引层级，缺省等于 minzoom |
| `center` | 否 | array | `[lon, lat, zoom]` |
| `asset_prefix` | 否 | string | 拼在每个资产前的公共前缀 |

注意 `bounds` 这里有个规范内部的不一致：Readme 3.9 节写的是 OPTIONAL、默认全球，但 `schema.json` 的 `required` 数组里明确包含 `bounds`。校验器按 schema 走，也就是**没有 bounds 会被判无效**。生成工具都会写这个字段，手写 JSON 时容易漏。

`tiles` 的键是 quadkey，不是 `z/x/y`。quadkey 是把瓦片的二进制行列号按位交错编码成的一串 0～3 数字，长度等于层级。规范对键的约束写在 schema 的 `patternProperties` 里：`[0123]{1,30}`，也就是 1 到 30 位。

一个 quadkey 与 XYZ 的换算：

```python
def tile_to_quadkey(x: int, y: int, z: int) -> str:
    """XYZ 瓦片号转 quadkey。"""
    key = []
    for i in range(z, 0, -1):
        digit = 0
        mask = 1 << (i - 1)
        if x & mask:
            digit += 1
        if y & mask:
            digit += 2
        key.append(str(digit))
    return "".join(key)

def quadkey_to_tile(qk: str) -> tuple[int, int, int]:
    """quadkey 转 XYZ 瓦片号。"""
    x = y = 0
    z = len(qk)
    for i, ch in enumerate(qk):
        mask = 1 << (z - i - 1)
        d = int(ch)
        if d & 1:
            x |= mask
        if d & 2:
            y |= mask
    return x, y, z

print(tile_to_quadkey(3372, 1552, 12))   # 形如 "131023013012"
print(quadkey_to_tile("131023013012"))   # (3372, 1552, 12)
```

`quadkey_zoom` 是性能开关。当它小于 `maxzoom` 时，低层级的瓦片请求会把多个 quadkey 的文件列表合并，也就是"一个 z=8 的瓦片对应 z=12 的 16 个 quadkey"。这带来两个后果：低层级请求要读更多文件列表（内存换 IO），但避免了为每个层级都建索引。规范里明确写了"当 `quadkey_zoom` 大于 `minzoom` 时，tiler 会合并 quadkey 的资产列表"。

选值经验：数据量大（十万级以上文件）、覆盖范围广时用 `quadkey_zoom = minzoom + 4` 左右；文件数在千级以下，直接用 `minzoom`，简单且索引小。

## 15.3 生成：cogeo-mosaic create

生成 MosaicJSON 的工具是 `cogeo-mosaic`，CLI 有 `create`、`create-from-features`、`footprint`、`info`、`to-geojson`、`update`、`upload` 七个子命令。最常用的是前两个。

从文件列表生成：

```bash
# list.txt 每行一个 COG 的 URL
cat > list.txt <<'EOF'
https://bucket.s3.amazonaws.com/ortho/tile_001.tif
https://bucket.s3.amazonaws.com/ortho/tile_002.tif
https://bucket.s3.amazonaws.com/ortho/tile_003.tif
EOF

cogeo-mosaic create list.txt -o mosaic.json

# 直接写到 S3，支持 gzip（后缀 .json.gz 自动压缩）
cogeo-mosaic create list.txt -o s3://bucket/mosaic/ortho.json.gz

# 指定层级与覆盖阈值
cogeo-mosaic create list.txt -o mosaic.json \
  --minzoom 8 --maxzoom 16 --quadkey-zoom 10 --min-tile-cover 10
```

`--min-tile-cover` 是"一个文件至少要覆盖瓦片的百分之几才写进列表"，默认 0.0。设成 10 能砍掉大量边缘碎片，显著减小 MosaicJSON 体积，代价是瓦片边缘可能有缺口。

从 GeoJSON / STAC 生成：

```bash
# 从 STAC API 拿 ItemCollection，用某个属性作为资产标识
curl -s "https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items?bbox=116,39,117,40&limit=100" \
  | cogeo-mosaic create-from-features \
      --minzoom 9 --maxzoom 15 \
      --property "assets.red.href" \
      -o mosaic.json
```

`--property` 是访问器路径，支持点号深入。上面这种写法直接取 Item 的 `assets.red.href`，得到的 MosaicJSON 里每个值是 COG 的直链而不是 Item ID。如果用默认的 `id`，MosaicJSON 里存的就是 Item ID，TiTiler 侧还需要一个能把它翻译成文件路径的 reader，这在后端是常见错误——瓦片请求会报 `RasterioIOError`，因为 GDAL 把 Item ID 当成了相对路径。

代码里生成（适合在 ETL 里嵌）：

```python
from cogeo_mosaic.mosaic import MosaicJSON

urls = [
    "https://bucket.s3.amazonaws.com/ortho/tile_001.tif",
    "https://bucket.s3.amazonaws.com/ortho/tile_002.tif",
]

mosaic = MosaicJSON.from_urls(
    urls,
    minzoom=8,
    maxzoom=16,
    quadkey_zoom=None,      # 缺省等于 minzoom
    minimum_tile_cover=0.05,
    tile_cover_sort=False,
)

print(mosaic.minzoom, mosaic.maxzoom, len(mosaic.tiles))
with open("mosaic.json", "w", encoding="utf-8") as f:
    f.write(mosaic.model_dump_json(exclude_none=True))
```

`from_urls` 会逐个打开 COG 读边界，N 个文件就是 N 次 HEAD/GET。一千个文件在本地磁盘上几十秒，在 S3 上可能要几分钟。批量场景下并发读元数据比顺序读快一个数量级，`MosaicJSON.from_urls` 内部已经用了线程池，但受 IO 限制，实际加速比在 4～8 倍之间。

`tile_cover_sort=True` 会把每个 quadkey 的文件列表按覆盖率排序，覆盖率高的排前面。配合 `PixelSelectionMethod.first`（默认）时，这相当于"优先用主体覆盖的影像"，能减少边缘碎片的拼接痕迹。

## 15.4 backend：文件放哪里

cogeo-mosaic 3.0 起把"MosaicJSON 存哪"抽象成 backend，URL 的 scheme 决定实现类：

| Backend | URL 形式 | 读写 | 适用场景 |
|---------|---------|------|----------|
| FileBackend | `file:///path/m.json` 或裸路径 | 读写 | 单机、容器内挂载卷 |
| S3Backend | `s3://bucket/m.json.gz` | 读写 | AWS 上最常用 |
| GCSBackend | `gs://bucket/m.json.gz` | 读写 | GCP |
| ABSBackend | `az://account.blob.core.windows.net/c/m.json` | 读写 | Azure |
| DynamoDBBackend | `dynamodb://region/table` | 读写 | 超大 mosaic，按 quadkey 分项存 |
| SQLiteBackend | `sqlite:///m.db:name` | 读写 | 单机多 mosaic，可事务更新 |
| HttpBackend | `https://host/m.json.gz` | 只读 | 静态托管，配合 CDN |
| STACBackend | `stac+https://api/search` | 只读 | 动态从 STAC 检索生成 |
| MemoryBackend | `:memory:` 或 `None` | 内存 | 临时计算、测试 |

选择的核心变量是**单次瓦片请求要读多少 MosaicJSON 数据**。FileBackend 和 HttpBackend 每次请求都要读整个文件（带 gzip 解压），适合 10 MB 以内；DynamoDB 按 quadkey 只读一个分项，适合几十万键的大 mosaic；SQLite 介于两者之间，本地有 B 树索引但没有网络层的按需读取。

一个 100 万 quadkey、平均每键 4 个 URL 的 MosaicJSON，gzip 后约 40～80 MB。这种规模下 HttpBackend 每次瓦片请求解压 60 MB 是不可接受的，必须换 DynamoDB，或者把 `quadkey_zoom` 抬高、让键数降下来。

`MosaicBackend` 是个工厂函数，按 URL 前缀自动选类，代码里通常不用关心具体类型：

```python
from cogeo_mosaic.backends import MosaicBackend

# 自动识别为 S3Backend
with MosaicBackend("s3://bucket/mosaic/ortho.json.gz") as mosaic:
    print(type(mosaic).__name__)          # S3Backend
    print(mosaic.mosaic_def.minzoom)
    img = mosaic.tile(12, 3372, 1552)
    print(img.array.shape)
```

`tile()` 返回的是 `rio_tiler.models.ImageData`，和单文件 reader 返回的类型一致，所以下游渲染代码可以复用。

## 15.5 接入 TiTiler

`MosaicTilerFactory` 和 `TilerFactory` 的结构几乎一样，区别只有两处：必须传 `backend`，以及多一组 `/assets` 端点用来查"这张瓦片用了哪些文件"。

```python
from fastapi import FastAPI
from cogeo_mosaic.backends import MosaicBackend

from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers
from titiler.mosaic.errors import MOSAIC_STATUS_CODES
from titiler.mosaic.factory import MosaicTilerFactory

app = FastAPI(title="Mosaic Tiler")

mosaic = MosaicTilerFactory(
    backend=MosaicBackend,
    router_prefix="/mosaicjson",
    add_statistics=True,   # 默认 False
    add_part=True,         # 默认 False
    add_ogc_maps=True,     # 默认 False
)
app.include_router(mosaic.router, prefix="/mosaicjson", tags=["Mosaic"])

add_exception_handlers(app, DEFAULT_STATUS_CODES)
add_exception_handlers(app, MOSAIC_STATUS_CODES)
```

`add_*` 的默认值和 `TilerFactory` 不同：镶嵌的 `/statistics`、`/bbox`、`/map` 都是关的。原因是这三个端点对一个 mosaic 做全量计算的成本远高于单文件，官方选择默认不挂。

`MOSAIC_STATUS_CODES` 把 cogeo-mosaic 的异常映射成 HTTP 状态码：`MosaicAuthError` → 401，`MosaicError` → 424，`MosaicNotFoundError` → 404。424（Failed Dependency）这个选择很讲究——它表达的是"你的请求没问题，但我依赖的 mosaic 出错了"，比笼统的 500 更准确。

调用示例：

```bash
MOSAIC="s3://bucket/mosaic/ortho.json.gz"
BASE="http://127.0.0.1:8000/mosaicjson"

# 基本信息
curl -s "$BASE/info?url=$MOSAIC" | jq '{bounds, minzoom, maxzoom}'

# 这张瓦片用了哪些文件（排错神器）
curl -s "$BASE/tiles/WebMercatorQuad/12/3372/1552/assets?url=$MOSAIC" | jq

# 出图
curl -s -o mosaic.png \
  "$BASE/tiles/WebMercatorQuad/12/3372/1552.png?url=$MOSAIC&rescale=0,3000"

# 校验一份 MosaicJSON（注意是 POST）
curl -s -X POST "$BASE/validate" \
  -H "Content-Type: application/json" \
  --data-binary @mosaic.json
```

`/tiles/{tms}/{z}/{x}/{y}/assets` 是排查接缝问题的第一站。它返回该瓦片相交的文件列表，能立刻看出"这块为什么有缝"——列表里少了应该覆盖的文件，或者顺序不对。

`/validate` 是 POST 不是 GET。官方 `docs/src/endpoints/mosaic.md` 的表格里写的还是 GET，那是文档滞后；`extensions/mosaicjson.py` 里注册的是 `@factory.router.post("/validate")`，请求体是完整的 MosaicJSON 对象。用 GET 调用会得到 405。

## 15.6 像素选择：叠加顺序即语义

同一张瓦片上有多个文件时，怎么合并由 `pixel_selection` 决定，默认 `first`。可取值来自 rio-tiler 的 `PixelSelectionMethod` 枚举：

| 值 | 行为 | 适用 |
|----|------|------|
| `first` | 先到先得，填满即停 | 优先级明确的分幅拼接 |
| `highest` | 逐像元取最大值 | 云污染下的反射率、热异常 |
| `lowest` | 逐像元取最小值 | 合成最少云覆盖 |
| `mean` | 堆叠求均值 | 多时相平滑 |
| `median` | 堆叠求中位数 | 去异常值，效果比 mean 稳 |
| `stdev` | 堆叠求标准差 | 变化检测 |
| `sum` | 堆叠求和 | 累积量（如降雨栅格） |
| `lastbandlow` / `lastbandhigh` | 用最后一个波段做决策 | 按质量波段择优 |
| `count` | 统计有效像元数 | 覆盖率分析 |

`first` 的性能最好，因为它有 `exit_when_filled=True`：一旦所有像元都被填满就停止，不再打开后续文件。这意味着一张贴满的瓦片可能只读了列表里的第一个文件，而不是全部。反过来说，`mean`、`median` 必须读完列表里所有文件，成本是 `first` 的数倍到数十倍。

```bash
# 用中位数合成去云
curl -s -o median.png \
  "$BASE/tiles/WebMercatorQuad/12/3372/1552.png?url=$MOSAIC\
  &pixel_selection=median&rescale=0,3000"
```

`MOSAIC_CONCURRENCY` 控制一次瓦片请求内并发读文件的线程数，默认取 `RIO_TILER_MAX_THREADS`（CPU×5）。设成 1 会把并行读退化成串行，延迟随文件数线性增长；设得比 CPU 数大太多只增加上下文切换。我的经验值是 `min(文件数, CPU×4)`。

`MOSAIC_STRICT_ZOOM` 是另一个容易被忽略的环境变量：默认 false，也就是请求的 z 超出 `[minzoom, maxzoom]` 时仍然返回（向上采样或向下采样）。设成 true 后，超出范围直接返回空瓦片。对成本敏感的场景我建议开启，因为 z 超出 maxzoom 的请求是最典型的"无效放大"，只会消耗 CPU。

## 15.7 排错

**`MosaicNotFoundError` → 404。** URL 拼错，或者 backend 类型判错。`s3://` 前缀但实际是 HTTP 可读的公开桶时，被判成 S3Backend 后还需要 AWS 凭证，就会 401 而不是 404。公网可读的 mosaic 一律用 `https://` 前缀。

**`tile outside bounds` → 404，但数据明明覆盖这里。** 先看 `bounds` 字段。手写的 MosaicJSON 里 bounds 写得比实际小，超出部分全被判为越界。规范要求 bounds 覆盖所有层级的全部数据，宁大勿小。

**瓦片有缝。** 三种原因：`--min-tile-cover` 设得太大，边缘文件被过滤；`tile_cover_sort` 没开，`first` 选到了覆盖不全的文件；源 COG 之间有 1～2 像素的空隙。第三种最常见，是分幅生产时的问题，只能在生成 COG 阶段重叠一点。

**低层级请求特别慢。** 大概率是 `quadkey_zoom` 等于 `minzoom` 且数据量大。z=6 的瓦片要遍历它下面所有 quadkey 的键，键数越多越慢。把 `quadkey_zoom` 抬高 3～4 级，让低层级只查少量父键。

**`from_urls` 卡住不动。** 它在逐个读 COG 头。远端文件加 `AWS_NO_SIGN_REQUEST=YES` 或正确的凭证，并确认 `GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR` 已设——不设的话每个文件都多一次 LIST。

**更新后瓦片没变化。** backend 类自带缓存（S3Backend 会缓存已解析的 mosaic），进程不重启就看不到新版本。生产环境更新 MosaicJSON 后要滚动重启，或者改用 DynamoDB 这类实时读的 backend。

## 15.8 生产建议

- **MosaicJSON 要版本化**。文件名带上内容哈希或日期，例如 `ortho-20261101.json.gz`，让 CDN 可以长缓存。原地覆盖会让缓存永远命中旧版本。
- **单文件别超过 50 MB（gzip 后）**。超过就该考虑 DynamoDB 或拆分 mosaic。这个阈值来自"每次瓦片请求都要读一遍"的成本模型。
- **`maxzoom` 不要超过源数据实际分辨率对应的层级**。多出来的层级是纯上采样，白烧 CPU。用第 13 章的 `lonlat_to_tile` 配合源数据分辨率算出这个上限。
- **`first` + `tile_cover_sort` 是默认组合里性价比最高的**。它让最"主体"的文件先被读，`exit_when_filled` 能提前终止，实际 IO 量比无序列表少 30%～50%。
- **对 `/assets` 端点限流**。它会返回完整文件列表，被爬虫盯上等于泄漏数据组织方式。内网用，或者加 token。

## 15.9 本章要点

| 结论 | 依据 |
|------|------|
| MosaicJSON 0.0.3 的 `tiles` 是 quadkey → URL 数组 | `schema.json` 的 `patternProperties` |
| schema 里 `bounds` 是必填 | `0.0.3/schema.json` 的 `required` 数组 |
| `quadkey_zoom` 缺省等于 minzoom | Readme 3.8 节 |
| 9 种 backend，Http 与 STAC 只读 | cogeo-mosaic backends 文档 |
| MosaicTilerFactory 必须传 backend | `mosaic/factory.py` 的 `backend: type[BaseBackend]` |
| `first` 有 `exit_when_filled`，能提前终止 | `FirstMethod.exit_when_filled = True` |
| 424 表示 mosaic 依赖出错 | `MOSAIC_STATUS_CODES` 的映射 |
| `/validate` 是 POST 不是 GET | `extensions/mosaicjson.py` 的路由装饰器 |

下一章把 STAC 和 TiTiler 接起来：不用预生成 MosaicJSON，直接拿 STAC 检索结果驱动出图，以及这条路在什么规模下会失效。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第14章-动态渲染重采样与色彩/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第16章-STAC驱动的动态影像服务/" class="chapter-nav__next">下一章 →</a>
</div>

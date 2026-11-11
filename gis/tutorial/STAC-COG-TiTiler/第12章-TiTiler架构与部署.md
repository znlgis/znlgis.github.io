---
layout: default
title: 第12章 - TiTiler 架构与部署
---

# 第12章 - TiTiler 架构与部署

影像上云的项目走到出图这一步，都会撞上同一堵墙：数据已经躺在对象存储里，COG 也切好了，但浏览器要的是 XYZ 瓦片，不是 GeoTIFF。中间那层把"读一个窗口"翻译成"返回一张 256×256 PNG"的服务，就是 TiTiler。

这一层看起来只是"加个 HTTP 壳"，实际上决定了后面所有章节的形态：瓦片是动态生成还是预切、渲染参数从 URL 来还是从配置来、缓存键怎么设计、鉴权放在哪一跳、成本记在计算还是出口。先把 TiTiler 的装配方式搞清楚，后面十几个问题都有统一的答案。

---

## 12.1 预切金字塔的账算不过来

一张 10980×10980 的 Sentinel-2 单景，切到 z=18 的 WebMercatorQuad，全量瓦片大约 6.9×10^10 张，不可能全切。真实项目只切数据覆盖范围，我按这个口径算一遍：

| 覆盖范围 | z=14 瓦片数 | z=14 体积（按 30 KB/张） | z=18 体积 |
|---------|------------|------------------------|----------|
| 1°×1° | 约 2.1×10^3 | 约 62 MB | 约 16 GB |
| 10°×10° | 约 2.1×10^5 | 约 6.2 GB | 约 1.6 TB |
| 全国（约 60°×35°） | 约 4.3×10^6 | 约 129 GB | 约 33 TB |

算法很朴素：z=14 时全球 16384 列覆盖 360°，1° 约 45.5 列，1°×1° 约 2070 张；每升一级乘 4，z=14 到 z=18 是 4^4=256 倍。这张表说明了预切方案的边界：**小范围、低层级、更新周期以月计**的数据，静态金字塔还能接受；覆盖到省域以上、要支持到 z=18 的浏览，预切在存储和预处理时间上都不成立。

动态切片的成本结构完全不同：不存瓦片，每次请求现读 COG 的一个窗口。一次 z=14 瓦片请求对应源数据约 1.5 m 分辨率的 700×700 像素窗口，COG 内部按 512×512 分块，大约命中 4 个内部块，加上文件头和 IFD，一次请求是 5～10 个 HTTP Range 请求、50～300 ms。关键结论是：**动态切片的成本从"存储 + 预处理"搬到了"计算 + 出口"，命中率决定成败**。这也是第 17 章要专门讲 CDN 的原因。

## 12.2 包结构与依赖边界

TiTiler 不是单体应用，2.x 拆成五个可独立安装的分发，`src/titiler/` 下一层一个：

| 包 | PyPI 名 | 职责 | 关键类 |
|----|---------|------|--------|
| titiler.core | titiler-core | 单数据集/多资产瓦片端点、依赖注入、中间件、算法与色带注册表 | TilerFactory、MultiBaseTilerFactory、TMSFactory、AlgorithmFactory、ColorMapFactory |
| titiler.mosaic | titiler-mosaic | 基于 cogeo-mosaic backend 的镶嵌端点 | MosaicTilerFactory |
| titiler.extensions | titiler-extensions | COG 校验与查看器、STAC 查看器、STAC Render、WMTS/WMS 能力文档 | cogValidateExtension、cogViewerExtension、stacExtension、stacRenderExtension、wmtsExtension |
| titiler.xarray | titiler-xarray | Zarr/NetCDF 多维数据切片 | xarray 版 TilerFactory |
| titiler.application | titiler-application | 把上面几组装成可直接跑的 FastAPI app | main.app |

依赖上有一条硬约束写在 `titiler/core/pyproject.toml`：`requires-python = ">=3.11"`，2.0.0 起要求 `rio-tiler>=9.0,<10.0`。rio-tiler 9 删掉了 `MultiBandReader`，这就是 `MultiBandTilerFactory` 在 2.x 被整个移除的原因——不是 API 审美问题，是下层能力没了。

实际读数据的永远是 rio-tiler，TiTiler 只做三件事：把 URL query 解析成 rio-tiler 的调用参数、把 `ImageData` 渲染成字节流、把异常映射成 HTTP 状态码。理解这条分工，就不会在 TiTiler 里找"重采样算法实现"——那是 GDAL 的活。

## 12.3 Factory 模式：路由是被装配出来的

`TilerFactory` 是一个 attrs 类，实例化时把一组端点注册到自己的 `APIRouter` 上。官方文档列全了它的属性，我按"改哪个会改变 API 表面"重新分组：

| 属性 | 默认值 | 改变什么 |
|------|--------|---------|
| `reader` | 必填，如 `rio_tiler.io.Reader` | 读数据的方式 |
| `path_dependency` | `DatasetPathParams`（query 参数 `url`） | 数据集地址怎么传 |
| `layer_dependency` | `BidxExprParams`（`bidx`/`expression`） | 波段选择 |
| `dataset_dependency` | `DatasetParams`（`nodata`/`unscale`/`resampling`/`reproject`） | 读取与重投影 |
| `tile_dependency` | `TileParams`（`buffer`/`padding`） | 瓦片边缘处理 |
| `process_dependency` | `algorithms.dependency`（`algorithm`/`algorithm_params`） | 后处理算法 |
| `colormap_dependency` | `ColorMapParams`（`colormap_name`/`colormap`） | 色带 |
| `render_dependency` | `ImageRenderingParams`（`rescale`/`color_formula`/`return_mask`） | 渲染 |
| `environment_dependency` | `lambda: {}` | 每次请求的 rasterio.Env |
| `supported_tms` | `morecantile.tms`（全部） | `{tileMatrixSetId}` 的合法取值 |
| `router_prefix` | 空字符串 | 端点前缀 |
| `extensions` | `[]` | 追加的扩展端点 |
| `add_preview` / `add_part` / `add_viewer` | `True` | 是否挂 `/preview`、`/bbox`+`/feature`、`/{tms}/map.html` |
| `add_ogc_maps` | `False` | 是否挂 OGC Maps 的 `/map` |

这张表就是 TiTiler 的"配置面"。想把 `url` 换成 `path`、想加一个必须带的 token、想只支持 `WebMercatorQuad`，改的都是这里，不用碰端点代码。下面是一个只允许两种 TMS 的实例：

```python
"""限定 TMS 的 COG 服务。"""
from fastapi import FastAPI
from morecantile import tms as default_tms
from morecantile.defaults import TileMatrixSets
from rio_tiler.io import Reader
from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers
from titiler.core.factory import TilerFactory

# TileMatrixSets 是 attrs 类，唯一字段是 tilematrixsets: dict
# get() 返回的是 deepcopy，所以这里缓存 TMS 对象是安全的
two_tms = TileMatrixSets(
    {
        "WebMercatorQuad": default_tms.get("WebMercatorQuad"),
        "WorldCRS84Quad": default_tms.get("WorldCRS84Quad"),
    }
)

app = FastAPI(title="COG Tiler")

cog = TilerFactory(reader=Reader, supported_tms=two_tms)
# 只在这一处写 prefix；factory 自己不要再写 router_prefix
app.include_router(cog.router, prefix="/cog", tags=["COG"])
add_exception_handlers(app, DEFAULT_STATUS_CODES)

@app.get("/healthz")
def healthz():
    return {"ok": True}
```

限制 TMS 的实际效果是路径参数变成 `Literal`，传 `/cog/tiles/FooQuad/1/1/1` 会直接 422，而不是跑到 GDAL 里才报错。这个差异在压测时很重要：非法 TMS 的处理成本从"打开文件"降到"路由校验"。

## 12.4 路由布局与 2.x 的破坏性变化

`titiler.application` 组装出的完整路径如下（前缀来自 `main.py` 的 `include_router`）：

| 路径 | 来源 | 说明 |
|------|------|------|
| `/cog/tiles/{tileMatrixSetId}/{z}/{x}/{y}[.{format}]` | TilerFactory + `/cog` | 单 COG 瓦片 |
| `/cog/{tileMatrixSetId}/tilejson.json` | 同上 | TileJSON 3.0.0 文档 |
| `/cog/{tileMatrixSetId}/map.html` | 同上 | 内置查看器 |
| `/cog/info`、`/cog/statistics`、`/cog/point/{lon},{lat}` | 同上 | 元数据与点查 |
| `/stac/tiles/{tileMatrixSetId}/{z}/{x}/{y}` | MultiBaseTilerFactory + `/stac` | 以 STAC Item 为输入 |
| `/mosaicjson/tiles/{tileMatrixSetId}/{z}/{x}/{y}` | MosaicTilerFactory + `/mosaicjson` | 镶嵌 |
| `/zarr/tiles/{tileMatrixSetId}/{z}/{x}/{y}` | xarray factory + `/zarr` | Zarr |
| `/tileMatrixSets`、`/algorithms`、`/colorMaps` | TMSFactory / AlgorithmFactory / ColorMapFactory | 挂在根上，无前缀 |
| `/healthz`、`/`、`/conformance`、`/api`、`/api.html` | application | 健康检查、OGC Common 落地页、OpenAPI |

`/api` 是 OpenAPI JSON，`/api.html` 是 Swagger UI，在 `FastAPI(openapi_url="/api", docs_url="/api.html")` 里定死。做网关白名单时要把这两个排除，否则会暴露全部端点结构。

版本差异是这一节的重点。0.19 到 2.x 的瓦片路由变化，网上一半教程还停在旧写法：

| 能力 | 0.x / 1.x | 2.x |
|------|-----------|-----|
| 瓦片路径 | `/tiles/{tms}/{z}/{x}/{y}` | 同左（`{tms}` 从 0.19 起必填） |
| 高分辨率后缀 | `/tiles/{tms}/{z}/{x}/{y}@2x.png` | 已删除，改用 `?tilesize=512` |
| 瓦片尺寸 | 固定 256 | 默认取 TMS 的 `tileWidth × tileHeight`，可用 `tilesize` 覆盖 |
| tilejson 默认尺寸 | 256 | 512 |
| map.html 默认尺寸 | 256 | 256 |
| 多资产 `assets` | 可选 | **必填**，`/info`、`/statistics` 用 `assets=:all:` |
| 多资产 `bidx` | 有效 | **被忽略**，改用 `assets=B02|bidx=1` |
| `asset_indexes`/`asset_expression` | 支持 | 删除 |
| `MultiBandTilerFactory` | 存在 | 删除 |
| 查看器路径 | `/{tms}/map` | `/{tms}/map.html` |

`assets=B02|bidx=1` 这个写法在 `dependencies.py` 的 `_parse_asset()` 里解析：先按 `|` 切出资产名，剩下每段按 `key=value` 解析，认识的 key 只有 `bidx`、`expression`、`bands` 三个。写成 `assets=B02|indexes=1` 不会报错，只是这个选项被静默丢弃——排查"为什么我选的波段没生效"时最该先看这里。

## 12.5 部署：进程模型与镜像

TiTiler 是纯 CPU 密集的同步代码：端点函数是普通 `def`，Starlette 会把它们丢进线程池。每张瓦片的处理链是 GDAL 读块 → numpy 重采样 → rio-color → PIL 编码，全程占 CPU。这决定了进程模型：

- **uvicorn 多 worker**：`--workers N`，每个 worker 独立进程、独立 GDAL 缓存。N 一般取 vCPU 数，再横向扩副本。
- **gunicorn + UvicornWorker**：官方 compose 两种都给了一份，`gunicorn -k uvicorn.workers.UvicornWorker --workers 1`。容器里我更倾向 uvicorn 直跑，少一层 master 进程的心跳和超时配置。
- **不要用 async 框架的"高并发"心智**：并发能力由线程池和 GDAL 决定，不是由 async 决定。`RIO_TILER_MAX_THREADS` 默认是 CPU 数 × 5（rio-tiler 的 `MAX_THREADS`），这个值直接决定 mosaic 端点一次能并发读多少个 COG。

镜像方面，2.3.0 起基础镜像换成 `cgr.dev/chainguard/wolfi-base`，**运行时用户是 nonroot、uid 65532**（2.2.2 时是 uid 1000）。这个变化会让挂载本地目录做开发的人措手不及：容器内 `/data` 的属主如果是 root，nonroot 用户读不了。解决办法是 `chmod -R a+r`，或者用 `--user $(id -u):$(id -g)` 覆盖。

最小启动命令：

```bash
docker run --rm -p 8000:8000 \
  -e GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR \
  -e GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES \
  -e VSI_CACHE=TRUE \
  -e VSI_CACHE_SIZE=5000000 \
  ghcr.io/developmentseed/titiler:latest \
  uvicorn titiler.application.main:app --host 0.0.0.0 --port 8000 --workers 4

# 确认起来了
curl -s http://127.0.0.1:8000/healthz
```

`/healthz` 返回的是版本集合，不是简单的 `ok`，这对排查"到底是 TiTiler 的问题还是 GDAL 的问题"很有用：

```text
{"versions": {"titiler": "<x.y.z>", "rasterio": "...", "gdal": "...", "proj": "...", "geos": "..."}}
```

生产配置全部走环境变量，前缀 `TITILER_API_`，也可以放 `.env`：

| 环境变量 | 默认值 | 作用 |
|---------|--------|------|
| `TITILER_API_CORS_ORIGINS` | `*` | 逗号分隔的允许来源 |
| `TITILER_API_CORS_ALLOW_METHODS` | `GET` | 允许的方法 |
| `TITILER_API_CACHECONTROL` | `public, max-age=3600` | 写进响应的 Cache-Control |
| `TITILER_API_ROOT_PATH` | 空 | 反向代理挂子路径时必须设 |
| `TITILER_API_DISABLE_COG` / `_STAC` / `_MOSAIC` / `_ZARR` | `False` | 关掉不用的端点组 |
| `TITILER_API_DEBUG` | `False` | 请求日志与 `Server-Timing` |
| `TITILER_API_LOWER_CASE_QUERY_PARAMETERS` | `False` | 兼容大小写混写的旧客户端 |
| `TITILER_API_GLOBAL_ACCESS_TOKEN` | 空 | 全局 `access_token` 校验 |
| `TITILER_API_TELEMETRY_ENABLED` | `False` | 打开 OTLP 链路追踪 |

反向代理挂子路径是高频故障点。控制器里写了 `--root-path=/api/v1/titiler`（compose 里的 `nginx-titiler` 就是这么起的），响应里 `tilejson.json` 生成的瓦片地址才会带正确前缀；漏写就会出现"tilejson 里的 tiles 指向 `/cog/tiles/...`，浏览器 404"。

Kubernetes 上最简的 Deployment 片段：

```yaml
containers:
  - name: titiler
    image: ghcr.io/developmentseed/titiler:2.4.0
    args: ["uvicorn", "titiler.application.main:app",
           "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
    env:
      - {name: GDAL_DISABLE_READDIR_ON_OPEN, value: "EMPTY_DIR"}
      - {name: GDAL_HTTP_MERGE_CONSECUTIVE_RANGES, value: "YES"}
      - {name: VSI_CACHE, value: "TRUE"}
      - {name: VSI_CACHE_SIZE, value: "5000000"}
      - {name: RIO_TILER_MAX_THREADS, value: "32"}
      - {name: TITILER_API_ROOT_PATH, value: "/api/v1/titiler"}
    resources:
      requests: {cpu: "1", memory: "1Gi"}
      limits: {cpu: "2", memory: "2Gi"}
    readinessProbe:
      httpGet: {path: /healthz, port: 8000}
      initialDelaySeconds: 5
      periodSeconds: 10
```

内存 limit 给 2Gi 有依据：GDAL 块缓存（`GDAL_CACHEMAX`）+ VSI 缓存（每句柄 `VSI_CACHE_SIZE`）+ numpy 数组（单次读取受 `RIO_TILER_MAX_ARRAY_SIZE` 限制，默认 1 GB）三者叠加。把 `VSI_CACHE_SIZE` 设成 512 MB 再配 32 线程，光缓存就能把节点打爆——第 20 章展开。

## 12.6 请求处理链路

一次 `GET /cog/tiles/WebMercatorQuad/12/3421/1567?url=...&rescale=0,3000&colormap_name=viridis` 的完整路径：

```text
FastAPI 路由匹配
  └─ 依赖注入（path/query 解析成各个 dependency 对象）
       ├─ path_dependency    -> url
       ├─ layer_dependency   -> bidx / expression
       ├─ dataset_dependency -> nodata / resampling / reproject
       ├─ colormap_dependency-> colormap_name 查表
       └─ render_dependency  -> rescale / color_formula
  └─ rasterio.Env(**environment_dependency)   # 请求级 GDAL 环境
       └─ Reader(url)                          # 打开 COG，读 IFD
            └─ src_dst.tile(z, x, y, tilesize=..., **params)
                 └─ GDAL：按 TMS 算窗口 -> 跨块时多次 Range 读 -> WarpedVRT 重投影
  └─ post_process(algorithm)                   # 可选，如 hillshade
  └─ render_image(...)                         # rescale -> color_formula -> 编码
  └─ Response(content, media_type, headers)    # Cache-Control 由中间件补
```

中间件顺序也值得记：`main.py` 里的注册顺序是 CORS → Compression → CacheControl →（debug 时）Logger/TotalTime。`CacheControlMiddleware` 只在三种条件同时满足时写头：方法为 GET/HEAD、状态码 < 500、响应里还没有 `Cache-Control`。所以"错误不缓存"不用额外配置，5xx 天然跳过；但 404 会被缓存 3600 秒，瓦片边界外的大量 404 会把 CDN 塞满无效条目，第 17 章给规避办法。

`CompressionMiddleware` 的 `minimum_size=1`，但 `exclude_mediatype` 排除了 `image/jpeg`、`image/png`、`image/jp2`、`image/webp`。这是对的：这些格式已压缩，再 gzip 只浪费 CPU。JSON 响应（tilejson、info）会被压缩，tilejson 动辄几 KB，收益明显。

## 12.7 排错：五个真实错误

**404，路径里没有 `tileMatrixSetId`。** 从旧教程抄来的 `/cog/tiles/12/3421/1567.png` 在 2.x 匹配不到任何路由。正确写法是 `/cog/tiles/WebMercatorQuad/12/3421/1567.png`。

**`{"detail": "..."}` 配 500，日志里有 `RasterioIOError`。** `DEFAULT_STATUS_CODES` 把 `RasterioIOError` 映射成 500，把 `MissingBands`/`MissingAssets`/`InvalidExpression` 映射成 400，`InvalidAssetName`/`InvalidBandName`/`TileOutsideBounds` 映射成 404。也就是说 500 基本等价于"文件打不开"：URL 拼错、对象不存在、权限不足，或者 `/vsis3/` 前缀没配对。

**`InvalidDatatypeWarning: Invalid type: uint16 for the png driver`。** `render_image()` 对输出格式的合法 dtype 有白名单：`png` 接受 `uint8`/`uint16`，`jpeg`/`jpg`/`webp` 只接受 `uint8`，`jp2` 接受 `uint8`/`int16`/`uint16`。源数据是 uint16 又显式要 `.jpg`，就会触发这条警告并强制按 min/max 拉伸，图像可能整片发白。

**不指定格式时返回了 PNG，体积比预期大。** 自动选择逻辑是：掩膜里有被掩掉的像元就出 PNG，否则出 JPEG；并且自动模式下 PNG 的合法 dtype 被收窄成 `uint8`。想要 JPEG 的体量就得显式 `.jpg` 加 `rescale`，否则 uint16 数据会被压成 8 位 PNG。

**装完 rasterio wheel 后 GDAL 找不到数据目录。** 官方文档明确写着：用 rasterio wheel 时 `GDAL_DATA` 和 `PROJ_LIB` 必须**取消设置**。镜像里如果从宿主机继承了这两个变量，会看到 `PROJ: proj_create_from_database: Cannot find proj.db` 之类的报错。

## 12.8 生产建议

- **按端点组拆进程**。`/cog` 和 `/mosaicjson` 的资源画像完全不同：前者单请求、低内存、高并发；后者一次读十几到几十个 COG，内存和线程占用高一个量级。用 `TITILER_API_DISABLE_*` 拆成两个 Deployment 分别扩缩容，比混在一起调参有效。
- **`workers` 与 `RIO_TILER_MAX_THREADS` 要一起算**。总并发线程数约等于 workers × MAX_THREADS。4 个 worker 配默认的 `CPU×5` 线程，在 2 核容器上就是 40 个线程抢 2 个核，上下文切换会吃掉收益。经验值是 `workers = vCPU`、`RIO_TILER_MAX_THREADS = 8`，mosaic 场景单独调到 32～64。
- **`root_path` 与网关前缀保持一致**，并且只在一处配置。前缀错位的表现是 tilejson 里的 URL 缺一段，很难从服务端日志看出来。
- **`/healthz` 不要只探 TCP**。它不走 GDAL，探活成功不代表能出图；真正要监控的是 `/cog/info` 的 P95 延迟和 5xx 比例。
- **镜像锁 digest 而不是 tag**。官方 Dockerfile 把 `wolfi-base` 和 `uv` 都锁了 digest，原因是 Wolfi 是滚动发行版，同一个 tag 隔几天拉到的 glibc 版本就可能不同。

## 12.9 本章要点

| 结论 | 依据 |
|------|------|
| 省域以上、要到 z=18 的浏览必须用动态切片 | z=14 到 z=18 是 256 倍存储放大，10°×10° 覆盖在 z=18 约 1.6 TB |
| 2.x 瓦片路由必须带 `{tileMatrixSetId}` | `factory.py` 注册 `/tiles/{tileMatrixSetId}/{z}/{x}/{y}` |
| `@2x` 缩放后缀已删除，改用 `?tilesize=512` | 2.0.0a1 变更记录与 v2 迁移文档 |
| 多资产端点 `assets` 必填、`bidx` 被忽略 | `MultiBaseTilerFactory` 与 2.0 迁移文档 |
| `assets=B02\|bidx=1` 只认 bidx/expression/bands | `dependencies._parse_asset()` |
| 镜像以 nonroot uid 65532 运行 | 2.3.0 变更记录 |
| `Cache-Control` 只补 5xx 以下的 GET/HEAD | `CacheControlMiddleware` 三个条件 |
| rasterio wheel 下 `GDAL_DATA`/`PROJ_LIB` 必须清空 | 官方 performance_tuning 文档 |

下一章把 `/cog` 这组端点逐个拆开，说明每个 query 参数背后的 rio-tiler 调用和返回结构。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第11章-STACBrowser与目录浏览/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第13章-TiTilerAPI与瓦片服务/" class="chapter-nav__next">下一章 →</a>
</div>

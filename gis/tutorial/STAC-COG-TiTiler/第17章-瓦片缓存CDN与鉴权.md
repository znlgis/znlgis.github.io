---
layout: default
title: 第17章 - 瓦片缓存CDN与鉴权
---

# 第17章 - 瓦片缓存CDN与鉴权

一张 256×256 的瓦片，动态生成要 50～300 ms、5～10 次 Range 请求。一个用户拖动一次地图，浏览器发 20～50 个瓦片请求。一个页面打开 3 次拖动，就是上百次请求。没有缓存，后端 CPU 和对象存储的请求数会随用户数线性增长，这是动态瓦片服务最常见的成本失控方式。

缓存分三层：浏览器、CDN、服务端。三层的键、TTL、失效策略各不相同，混在一起设计就会出现"更新了数据但用户看到旧图"或者"缓存命中率 3%"这类问题。这一章把三层的键与鉴权捋清楚。

---

## 17.1 缓存键：URL 就是键

HTTP 缓存没有"配置键"这回事，键就是 URL（加上 `Vary` 里声明的请求头）。TiTiler 的所有参数都在 query 里，所以**一个 URL 严格对应一张确定的图**——前提是参数顺序稳定、没有随机成分。

这条性质既是优点也是陷阱。优点是 CDN 天然可用；陷阱是任何"不影响像素但出现在 URL 里"的参数都会把缓存打成碎片。常见的有：

| 参数 | 是否影响像素 | 缓存影响 |
|------|------------|----------|
| `url` | 是 | 必须进键，不同数据集本就不同图 |
| `rescale` / `colormap_name` / `color_formula` | 是 | 必须进键 |
| `algorithm` / `algorithm_params` | 是 | 必须进键 |
| `bidx` / `expression` / `assets` | 是 | 必须进键 |
| `tilesize` / `buffer` / `padding` | 是 | 必须进键 |
| `access_token` / 签名参数 | 否 | **不应进键**，否则每个 token 一份缓存 |
| `t` / `_` / `cb` 时间戳 | 否 | **不应进键**，经典的防缓存参数反而摧毁缓存 |
| 追踪参数 `utm_*` / `from` | 否 | 不应进键 |

`access_token` 是最麻烦的一个。它出现在 URL 里（TiTiler 的 `TITILER_API_GLOBAL_ACCESS_TOKEN` 就是从 query 读），CDN 默认把整个 query 当键，于是同一个 token 过期换了新的，缓存全部失效。解法有两个：

**用 `Vary` 声明按 Authorization 头缓存**。把 token 从 query 挪到 `Authorization: Bearer`，CDN 侧配置按该头缓存。代价是同一张瓦片对不同用户各缓存一份，命中率取决于用户数。

**用短期签名但保持 URL 稳定**。签名放在路径或 Cookie 里，query 保持纯净。这条路需要网关配合，不是 TiTiler 自己能解决的。

CloudFront 的 query string 处理有一个具体机制值得知道：默认只把白名单里的 query 参数纳入缓存键，其余参数被丢弃。所以正确做法是**把渲染参数加进白名单，把认证参数排除在外**。反过来（全量透传）会让 token 和时间戳污染缓存。

## 17.2 Cache-Control 的实际行为

TiTiler 的缓存头由 `CacheControlMiddleware` 统一注入，配置项是 `TITILER_API_CACHECONTROL`，默认 `public, max-age=3600`。中间件的实现只有一条判断，三个条件同时满足才写头：

```python
if self.cachecontrol and not response_headers.get("Cache-Control"):
    if (
        scope["method"] in ["HEAD", "GET"]
        and message["status"] < self.cachecontrol_max_http_code   # 默认 500
        and not any(re.match(path, scope["path"]) for path in self.exclude_path)
    ):
        response_headers["Cache-Control"] = self.cachecontrol
```

三条推论：

**5xx 不缓存。** 状态码小于 500 才写头，所以 500/502/503 响应没有 `Cache-Control`，CDN 按默认行为处理（通常不缓存）。这对服务端故障恢复是好事。

**404 会被缓存一小时。** 404 小于 500，也会被写头。瓦片边界外的大量 404 会占满 CDN 的无效条目，还可能把"临时的 404"（比如对象存储抖动导致的 404）固化一小时。要区分这两种 404 只能在应用层做：`TileOutsideBounds` 是正常空瓦片，`InvalidAssetName` 是配置错误。

**响应自带 `Cache-Control` 时中间件不覆盖。** 这是给自定义端点留的口子：想在某个端点上设 `max-age=60`，只要在响应里显式写头即可，不用关掉全局中间件。

`exclude_path` 默认只有 `/healthz`，用正则匹配。要排除更多路径（比如 `/api`、`/api.html`），在构造中间件时传 `exclude_path={r"/healthz", r"/api.*"}`。

TTL 的选择没有统一答案，取决于数据更新频率与"可接受的陈旧时间"：

| 数据类型 | 建议 TTL | 理由 |
|----------|---------|------|
| 历史影像、不更新的底图 | 7～30 天 | 内容不变，长缓存收益最大 |
| 每日更新的监测产品 | 6～24 小时 | 与更新周期同量级 |
| 准实时（分钟级） | 60～300 秒 | 只挡突发流量，不追求高命中 |
| 带 token 的私有数据 | 0 或 private | 不能让共享缓存存 |

`private` 与 `public` 的差别在共享缓存上：`private` 禁止 CDN 缓存，只允许浏览器缓存。私有数据如果误用 `public`，CDN 会把 A 用户的图返回给 B 用户——这是最严重的一类缓存事故。

## 17.3 CDN 配置的四个要点

在 TiTiler 前面放 CDN，配置项远不止"填个源站地址"。四个必须处理的点：

**源站的 Host 与路径**。TiTiler 生成的 `tilejson.json` 里的瓦片 URL 用的是 `request.url_for()`，也就是它看到的 Host 和 `root_path`。CDN 回源时如果改写了 Host，生成的 URL 会指向内网地址。解决办法是在 CDN 侧保留原始 Host（`X-Forwarded-Host`）并在 TiTiler 侧正确解析代理头，或者用 `TITILER_API_ROOT_PATH` 固定前缀。

**回源超时与重试**。CDN 的默认回源超时通常是 30 秒，而瓦片生成 P99 可能到 2 秒，看起来足够。但冷启动（进程刚起、GDAL 缓存空）时首请求可能到 5～10 秒，CDN 会判超时并返回 504，同时把 504 缓存一小段时间。给 CDN 配 10～15 秒回源超时、1 次重试，比无限等更稳。

**Range 请求的透传**。TiTiler 本身返回的是完整图片，不涉及 Range；但 CDN 回源到对象存储的那一条链（如果做了 CDN 直连 OSS）必须透传 `Range` 头，否则 COG 的按块读取会退化成整文件下载。这是两套 CDN 配置，别搞混：TiTiler → OSS 是 GDAL 发的 Range 请求，浏览器 → CDN → TiTiler 是普通 GET。

**压缩策略**。TiTiler 的 `CompressionMiddleware` 已经排除了图片类型，CDN 侧不要再对 `image/*` 开 gzip/brotli。对 `application/json`（tilejson、info）开启是划算的，tilejson 通常能压到原体积的 20%～30%。

一个 nginx 侧的最小配置，用于本地验证缓存行为：

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=tiles:100m
                 max_size=10g inactive=7d use_temp_path=off;

server {
    listen 8080;

    location /cog/ {
        proxy_pass http://titiler:8000/cog/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache tiles;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        proxy_cache_valid 200 206 7d;
        proxy_cache_valid 404 1m;        # 空瓦片只缓存一分钟
        proxy_cache_use_stale error timeout updating;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

`proxy_cache_key` 用 `$request_uri` 包含了完整 query，这正是"参数顺序不同就是不同键"的来源。如果客户端对同一组参数有不同顺序（`rescale=0,3000&bidx=1` 与 `bidx=1&rescale=0,3000`），会命中两份缓存。要避免这个问题，客户端必须固定参数顺序，或者网关层做参数归一化。

`X-Cache-Status` 是排错的关键。`MISS`/`HIT`/`STALE`/`UPDATING` 四个值能立刻回答"缓存到底有没有生效"。上线第一天就该把它加进响应头，而不是等出问题再查。

## 17.4 鉴权：三种位置，三种代价

鉴权放在哪一层，决定了缓存能不能用、密钥会不会泄漏。三种做法：

| 位置 | 实现 | 缓存 | 泄漏风险 |
|------|------|------|----------|
| query 参数 `access_token` | TiTiler 内置 `TITILER_API_GLOBAL_ACCESS_TOKEN` | 差（token 进键） | 高（出现在日志、Referer） |
| 请求头 `Authorization` | 网关或自定义 dependency | 中（`Vary` 或按头缓存） | 低 |
| 签名 URL | 源站或网关校验签名 | 好（签名可排除出键） | 中（URL 可转发） |

内置的 `access_token` 只适合内部或演示环境。它的实现是 FastAPI 的 `APIKeyQuery(name="access_token")`，校验逻辑就是字符串相等比较——没有过期、没有作用域、没有速率限制。用在公网等于没有鉴权，唯一的屏障是"别人不知道这个字符串"。

自己实现 token 校验，正规做法是自定义 `path_dependency`，因为它在所有端点上都执行：

```python
from fastapi import HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader
from jose import JWTError, jwt

from titiler.core.factory import TilerFactory

API_KEY = APIKeyHeader(name="Authorization", auto_error=False)
SECRET = "从密钥管理服务读取，不要写死在代码里"


def DatasetPathParams(
    url: str = Query(..., description="Dataset URL"),
    token: str | None = Security(API_KEY),
) -> str:
    """校验 Bearer token 后返回数据集地址。"""
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        jwt.decode(token.removeprefix("Bearer "), SECRET, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    return url


cog = TilerFactory(path_dependency=DatasetPathParams)
```

这段代码和官方 `tiler_with_auth.md` 的思路一致，但把 token 位置从头换成了 `Authorization`。差别很实际：头不会出现在浏览器的 Referer、访问日志的 query 字段、以及用户复制的链接里。

签名 URL 是另一种模型：**服务端签发一个带时效的地址，持有地址即可访问**。它把"鉴权"变成了"授权凭证的分发"，好处是 CDN 能缓存（签名固定时 URL 固定），坏处是链接一旦泄漏在有效期内都可被使用。

对象存储的预签名 URL 有个坑：它自带 `?X-Amz-Signature=...&X-Amz-Date=...`，直接塞进 TiTiler 的 `url=` 会把 `&` 后面的部分当成本服务的 query。两种解法在官方 `working_with_signed_urls.md` 里都有：整段 base64 编码，或者只把 query 部分 base64 后单独传。

```python
import base64

from fastapi import Query


def DatasetPathParams(
    url: str = Query(..., description="Dataset URL"),
    url_params: str | None = Query(
        None, description="Base64 编码的额外 query，用于签名参数"
    ),
) -> str:
    """支持把签名参数与主 URL 分开传递。"""
    if url_params:
        url += "?" + base64.b64decode(url_params).decode()
    return url
```

调用侧：

```bash
# 服务端签发后，只把 query 部分编码
curl -s "http://127.0.0.1:8000/cog/info\
  ?url=https://bucket.s3.amazonaws.com/scene.tif\
  &url_params=$(printf 'X-Amz-Signature%%3Dabc%%26X-Amz-Date%%3D20261111T000000Z' | base64 -w0)"
```

注意 `%%` 是为了在 `printf` 里输出单个 `%`，实际编码进 base64 的是 `X-Amz-Signature=abc&X-Amz-Date=...`。

## 17.5 防盗链与滥用防护

瓦片服务的典型滥用是"被别人嵌到自己的页面里"，消耗你的带宽。三道防线，按成本从低到高：

**`Referer` 白名单**。在网关层校验，只允许自己的域名。它能挡掉大部分低成本的盗链，但 `Referer` 可以被伪造，也能被隐私设置抹掉（此时请求不带 Referer，要决定是放行还是拒绝）。

**短期签名**。每个页面加载时向后端换一个 5～15 分钟有效的 token，嵌进瓦片 URL。盗链者拿到的链接很快过期。代价是每个页面都要多一次换取请求。

**按来源限流**。按 IP 或 token 维度做 QPS 限制。TiTiler 本身没有限流，得靠网关（nginx `limit_req`、Envoy、API Gateway 的 usage plan）。

一个 nginx 的限流片段，按 IP 每秒 20 个请求、突发 40：

```nginx
limit_req_zone $binary_remote_addr zone=tiles:10m rate=20r/s;

location /cog/ {
    limit_req zone=tiles burst=40 nodelay;
    limit_req_status 429;
    proxy_pass http://titiler:8000/cog/;
}
```

`nodelay` 是必要的：不加的话超出速率的请求会排队，而不是立刻 429，排队会把延迟推高并拖垮上游。给 429 配一个 `Retry-After` 头，前端地图库大多能正确退避。

## 17.6 命中率的测量与调优循环

“命中率 90%”是结果指标，不能直接指导动作。可操作的是把它拆成两个可测的量：**同一 URL 的重复请求占比** 与 **TTL 内请求数**。

第一个量从访问日志里算：

```bash
# 统计同一 URL 在 1 小时窗口内的请求次数分布（先剔掉认证类参数）
awk '{print $7}' /var/log/nginx/access.log \
  | sed 's/[?&]\(token\|t\|_\|cb\)=[^&]*//g' \
  | sort | uniq -c | sort -rn \
  | awk '{a[$1]++} END {for (n in a) print n, a[n]}' | sort -n
```

第一列是“某个 URL 被请求的次数”，第二列是“有这么多个 URL”。如果第一列大量集中在 1～2，说明流量几乎全是冷请求，缓存再长也没用——问题在 URL 不重复（时间戳、token、参数顺序）。如果集中在几十上百，缓存就有价值，此时调 TTL 与预热的收益最大。

第二个量决定 TTL 的下界。设某 URL 的到达率为 λ（次/小时），TTL 为 T 小时，一个缓存周期内平均命中 λT−1 次、回源 1 次，命中率约：

```text
hit_ratio ≈ 1 - 1 / (λ × T)
```

代入 λ = 20、T = 1：约 95%；λ = 2、T = 1：只有 50%。这说明两件事：**低频 URL 靠加 TTL 提升命中率的效果有限**（λ 小时 1/(λT) 下降很慢），**高频 URL 只要 TTL 覆盖到下一个请求就够**。

调优的循环因此是：

```text
① 从日志取 Top 100 URL，看重复度
② 重复度低  → 修 URL 稳定性（去时间戳、固定参数顺序、token 移出 query）
③ 重复度高  → 按 λ 分布设 TTL：高频 7 天、中频 1 天、低频 1 小时
④ 观察 X-Cache-Status 的 HIT 比例，回到 ①
```

一个常被忽略的点：**404 的缓存策略会显著影响命中率的分母**。地图拖到数据范围外时，浏览器会发大量越界瓦片请求，这些 404 若只缓存 1 分钟就会持续回源。用 `bounds`（第 19 章）让前端根本不发这些请求，比调 TTL 有效得多。
## 17.7 排错

**CDN 命中率只有个位数。** 三个高频原因：URL 里有时间戳参数；参数顺序不稳定；`Vary` 配得太宽（比如 `Vary: *` 或包含 `User-Agent`）。逐一排除的方法是在源站日志里统计"去掉 query 后路径的重复度"，重复度高但命中率低，问题一定在键上。

**更新数据后仍显示旧图。** 缓存的 TTL 还没过。两种处理：换文件名（`scene-20261101.tif` 而不是 `scene.tif`），这是最干净的做法；或者对 CDN 做路径失效（成本高、有延迟）。我强烈建议前者，把"缓存失效"变成"新 URL"。

**`tilejson.json` 里的瓦片地址指向内网。** 反向代理改了 Host 或没设 `root_path`。检查 `TITILER_API_ROOT_PATH` 与代理的 `X-Forwarded-*` 头。

**浏览器缓存了 401。** 401 也小于 500，会被 `CacheControlMiddleware` 写头。如果网关返回 401 时没带 `Cache-Control: no-store`，浏览器会把"未授权"缓存一小时，用户重新登录后仍然看不到图。给 401/403 显式加 `Cache-Control: no-store`。

**签名 URL 在 TiTiler 侧报 403。** 签名的规范串里包含了 Host 和路径，如果 TiTiler 内部把 `https://` 改写成 `s3://` 或加了 `/vsis3/` 前缀，签名就失效。签名必须针对最终被 GDAL 请求的那个 URL 生成。

## 17.8 生产建议

- **TTL 分层**：静态底图 7 天、日更产品 6 小时、准实时 60 秒、带鉴权 `private`。一套 TTL 打天下必然要么太旧要么太不划算。
- **上线第一天就加 `X-Cache-Status`**。没有它，命中率问题只能靠猜。
- **参数顺序在客户端固定**。写一个 `buildTileUrl(params)` 函数，按固定顺序拼接，全项目只用它。这一条能消掉 10%～20% 的无效缓存条目。
- **token 走头，不走 query**。这是唯一能同时兼顾缓存与安全的做法；代价是前端地图库要支持自定义头（MapLibre 的 `transformRequest` 可以）。
- **给 404 单独设短 TTL**。空瓦片不该占着一小时的缓存位。

## 17.9 本章要点

| 结论 | 依据 |
|------|------|
| 缓存键就是 URL，参数顺序不同即不同键 | HTTP 语义与 nginx 的 `proxy_cache_key` |
| `Cache-Control` 只在 GET/HEAD 且状态 < 500 时写入 | `CacheControlMiddleware` 的三个条件 |
| 404 也会被写 `Cache-Control` | 404 < 500，会被缓存 |
| 响应自带该头时中间件不覆盖 | 中间件的 `not response_headers.get(...)` 判断 |
| 默认 TTL 是 3600 秒 | `ApiSettings.cachecontrol` |
| `access_token` 进 query 会摧毁 CDN 命中率 | token 变化即 URL 变化 |
| 预签名 URL 需要编码后才能传 | 官方 signed URL 示例 |
| 401 也要 `no-store` | 401 < 500 会被缓存 |

下一章把镜头拉远：从原始影像到可出图的 COG，这条流水线怎么在云上跑起来，以及为什么"转换"这一步最容易被做成瓶颈。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第16章-STAC驱动的动态影像服务/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第18章-云原生影像处理流水线/" class="chapter-nav__next">下一章 →</a>
</div>

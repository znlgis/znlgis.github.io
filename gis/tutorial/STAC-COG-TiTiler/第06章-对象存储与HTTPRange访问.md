---
layout: default
title: 第06章 - 对象存储与 HTTP Range 访问
---

# 第06章 - 对象存储与 HTTP Range 访问

COG 只是“可以被按块读”的文件，真正让按块读成立的是 HTTP 的 Range 机制。这中间有一串容易出错的环节：服务器是否支持 Range、CDN 是否转发 Range、跨域预检是否放行 Range 头、客户端是否把多个 Range 合成一次请求。任何一环出问题，表现都是“图能出来但很慢”，而不是报错。

这一章从 RFC 9110 的语义讲到 S3 与 CloudFront 的具体行为，再落到 GDAL 与浏览器两个客户端的实际请求模式，最后给一份可执行的验证脚本。

## 6.1 Range 的协议语义

### 6.1.1 请求与响应

客户端在 GET 请求里加 Range 头：

```http
GET /imagery/scene.tif HTTP/1.1
Host: bucket.s3.us-west-2.amazonaws.com
Range: bytes=0-1023
```

服务端如果支持，返回 206：

```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/104857600
Content-Length: 1024
Accept-Ranges: bytes
```

Content-Range 的格式是 bytes 起始-结束/总长度。客户端据此知道拿到的是哪一段、文件总共有多少字节。

如果不支持 Range，服务端**可以忽略**这个头，直接返回 200 加完整内容。RFC 9110 的原话是 “A server MAY ignore the Range header field”。这是最容易被误判的情况：客户端发了 Range，收到了 200，很多 HTTP 库不会报错，只是把整个文件读进内存。

### 6.1.2 状态码与边界

| 状态码 | 含义 | 触发条件 |
|--------|------|----------|
| 206 | Partial Content | Range 合法且可满足 |
| 200 | OK | 服务端忽略 Range，返回全量 |
| 416 | Range Not Satisfiable | Range 合法但超出资源长度 |
| 304 | Not Modified | 条件请求命中，Range 被忽略 |

RFC 9110 对 416 的措辞是 “the ranges-specifier is unsatisfiable with respect to the selected representation”。典型触发是 bytes=999999999- 请求一个只有 100 MB 的文件。

有一条容易忽略的规则：**Range 在条件请求之后求值**。如果 If-None-Match 命中导致 304，Range 就不生效。所以带 ETag 缓存的客户端不能假设“发了 Range 就一定拿到 206”。

### 6.1.3 多 Range 与 multipart/byteranges

协议允许一次请求多个区间：

```http
Range: bytes=0-1023, 8192-9215
```

服务端可以返回 multipart/byteranges 的响应体，也可以只返回其中一部分，甚至可以忽略。RFC 9110 明确说 “A server that supports range requests MAY ignore or reject a Range header field that contains ... more than two overlapping ranges, or a set of many small ranges that are not listed in ascending order”。

实践上这条几乎用不到，因为**主流对象存储都不支持多 Range**。S3 的文档写得很直接：“Amazon S3 doesn't support retrieving multiple ranges of data per GET request.” 所以任何依赖多 Range 减少请求数的优化，在 S3 上都不成立。

### 6.1.4 Accept-Ranges 与 CORS

Accept-Ranges: bytes 是服务端的能力声明。它不是必需的，但客户端可以据此决定要不要发 Range。GDAL 的 /vsicurl/ 会先发 HEAD 或带 Range 的 GET 探测。

跨域场景下还有两个头：

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: range
Access-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length
```

OGC 21-026 对服务端的要求是硬性的：

- HTTP 或 HTTPS 服务器必须能提供 TIFF 文件；
- 必须支持 HTTP range；
- 必须支持 bytes ranges；
- HTTPS 服务必须支持 CORS；
- 必须通过 Access-Control-Allow-Headers: range 声明允许 Range 头。

第三条经常被漏掉：允许了 Range 请求头，但没有 expose Content-Range，浏览器里的 JavaScript 读不到响应头，某些前端库会误判“服务端不支持 Range”。

## 6.2 S3 的行为细节

### 6.2.1 单区间，206 与 416

```bash
# 取前 1 KB
curl -s -D - -o /dev/null -r 0-1023 \
  "https://bucket.s3.us-west-2.amazonaws.com/imagery/scene.tif"
# HTTP/1.1 206 Partial Content
# Accept-Ranges: bytes
# Content-Range: bytes 0-1023/104857600
# Content-Length: 1024

# 越界请求
curl -s -D - -o /dev/null -r 999999999- \
  "https://bucket.s3.us-west-2.amazonaws.com/imagery/scene.tif"
# HTTP/1.1 416 Requested Range Not Satisfiable
# Content-Range: bytes */104857600
```

416 的响应里 Content-Range 用 `bytes */总长度` 的形式，星号表示未指定区间。客户端可以从中读到真实大小。

### 6.2.2 预签名 URL 与 Range

预签名 URL 把鉴权信息放进查询串，Range 头照常工作——因为 Range 是请求头，不参与签名计算。这一点对私有桶的影像服务很关键：可以直接把预签名 URL 交给 TiTiler 或前端，不用给匿名读权限。

```python
import boto3
from botocore.config import Config

s3 = boto3.client(
    "s3",
    endpoint_url="https://bucket.s3.us-west-2.amazonaws.com",
    config=Config(signature_version="s3v4"),
)

url = s3.generate_presigned_url(
    "get_object",
    Params={"Bucket": "bucket", "Key": "imagery/scene.tif"},
    ExpiresIn=3600,
)
print(url)
# https://bucket.s3.../imagery/scene.tif?X-Amz-Algorithm=...&X-Amz-Signature=...
```

预签名 URL 的坑在于**有效期与缓存**。CDN 缓存了一个带签名的 URL 的响应，URL 过期后新请求会拿到 403，但缓存里还有旧内容——这会造成“部分用户能看图，部分用户 403”。解决办法是让 CDN 用固定的源站鉴权（OAC），而不是把签名 URL 暴露给 CDN。

### 6.2.3 一致性

S3 自 2020 年起对新建对象的 PUT 提供强一致读（read-after-write）。但**覆盖写**的语义仍要注意：同名对象被覆盖后，正在进行的 Range 请求可能读到新旧混合的内容。

这就是第 1 章说的“COG 一旦上传就不再改写”的由来。生产上的做法是内容寻址：对象 key 里带内容哈希或版本号。

```text
imagery/landsat/LC08_123032_20230501/20230501T031245_v2.tif
                                             ^^^^ 版本后缀
```

## 6.3 CDN 的行为

### 6.3.1 CloudFront 如何处理 Range

CloudFront 的文档说得很清楚，收到 Range GET 时：

1. 检查边缘缓存里是否已有完整对象或所请求的区间；
2. 有就直接返回，没有就转发到源站；
3. 源站支持 Range → 返回区间，CloudFront 缓存该区间；
4. 源站不支持 Range → 返回完整对象，CloudFront 缓存完整对象，后续 Range 请求从缓存切片返回。

第 4 条是好消息：即使源站不支持 Range，CDN 也会在缓存完整对象后支持 Range。但代价是第一次请求要拉全量——对 200 MB 的 COG，这是灾难性的冷启动。

### 6.3.2 会被降级成 200 的情况

CloudFront 文档列了三种情况，会把 206 降级成 200 加完整对象：

- Range 未按升序排列（100-200,300-400 合法；300-400,100-200 不合法）；
- Range 有重叠（100-200,150-250 不合法）；
- 任一区间非法（比如负数）。

另外，如果源站返回 Transfer-Encoding: chunked，CloudFront 也会返回完整对象而不是区间。

这几条对 COG 客户端影响不大（GDAL 只发单区间），但对自己写 HTTP 客户端的人是个陷阱。

### 6.3.3 缓存键与命中率

CloudFront 默认的缓存键是 URL（含查询串，取决于缓存策略）。对 COG 来说，一个 200 MB 的文件会产生成百上千个不同的 Range 请求，如果缓存键包含 Range 头，命中率会极低。

默认行为是**缓存键不含 Range**，一个 URL 对应一个缓存对象，Range 请求从缓存对象上切片。这是正确的做法，不要改。

真正影响命中率的是 URL 里的查询串。预签名 URL 每次签名不同 → 缓存键不同 → 命中率为零。这就是 6.2.2 说的问题。

### 6.3.4 回源带宽

CDN 回源时可能请求比客户端更大的区间（文档原话：“CloudFront might request a larger range than the client requested”）。对 COG 这是好事：一次回源 256 KB，可以服务后续多个相邻瓦片请求。

## 6.4 客户端的请求模式

### 6.4.1 GDAL /vsicurl/

GDAL 的 /vsicurl/ 有三层机制：

| 机制 | 默认值 | 配置项 |
|------|--------|--------|
| 分块大小 | 16 KB | CPL_VSIL_CURL_CHUNK_SIZE |
| 顺序读放大 | 最多 128 倍（2 MB） | 同上 |
| 全局 LRU 缓存 | 16 MB | CPL_VSIL_CURL_CACHE_SIZE |

文档原文：部分下载默认以 16 KB 为粒度；如果驱动检测到顺序读，会逐步把块大小放大到 128 倍（默认 2 MB）；此外有一个 16 MB 的全局 LRU 缓存，跨文件句柄复用。

这意味着“打开一个 COG 读一个瓦片”的实际流量往往不是 16 KB，而是 16 KB 起、遇到顺序读就涨到几百 KB 到 2 MB。调优方向：

```bash
# 头部很大（元数据多）时，一次多读一点，减少往返
export GDAL_INGESTED_BYTES_AT_OPEN=32768

# 顺序读多（比如批量导出）时，放大块
export CPL_VSIL_CURL_CHUNK_SIZE=262144        # 256 KB
export CPL_VSIL_CURL_CACHE_SIZE=67108864      # 64 MB = 256 KB * 256

# 随机读多（瓦片服务）时，保持小块、加大缓存
export CPL_VSIL_CURL_CHUNK_SIZE=16384
export CPL_VSIL_CURL_CACHE_SIZE=33554432      # 32 MB
```

GDAL 文档给的建议是：把 CPL_VSIL_CURL_CHUNK_SIZE 调大时，CPL_VSIL_CURL_CACHE_SIZE 也要跟着调到 128 倍，否则缓存会频繁淘汰。

还有两个减少无用请求的开关，前面章节提过，这里给完整解释：

```bash
export GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
export CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif
```

第一条禁止 GDAL 打开文件时列目录找 sidecar（.ovr、.aux.xml、.aux）。对对象存储，列目录 = LIST 请求，通常没权限且很慢。第二条进一步把探测范围限定在 .tif。

不加这两条时，打开一个远程 COG 可能产生 4–6 次请求；加上之后是 1 次。

### 6.4.2 浏览器

浏览器发 Range 请求只有一条路：fetch 或 XHR 手动设 Range 头（`<img>` 标签由浏览器自己决定，不可控）。

```js
async function readRange(url, start, end) {
  const resp = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    mode: "cors",
  });
  if (resp.status === 206) {
    const total = resp.headers.get("Content-Range")?.split("/")[1];
    const buf = await resp.arrayBuffer();
    return { buf, total: Number(total) };
  }
  if (resp.status === 200) {
    // 服务端忽略了 Range，拿到的是全量
    const buf = await resp.arrayBuffer();
    return { buf, total: buf.byteLength, ignored: true };
  }
  throw new Error(`unexpected status ${resp.status}`);
}

const { buf, total } = await readRange(
  "https://bucket.s3.us-west-2.amazonaws.com/imagery/scene.tif", 0, 1023
);
console.log(buf.byteLength, total);   // 1024 104857600
```

注意 resp.headers.get("Content-Range") 能读到，前提是服务端配了 Access-Control-Expose-Headers。没配时返回 null，上面的 total 会是 NaN——这是前端排查 Range 问题时的第一个检查点。

浏览器读 COG 的主流库（geotiff.js）内部就是这套逻辑：先读头部拿 IFD，再按需读块。它默认并发 4 个请求，块大小可配。

### 6.4.3 TiTiler 侧

TiTiler 用 rasterio 打开 URL，走的就是 /vsicurl/，所以上面所有 GDAL 配置都生效。生产上应该在容器环境变量里固定这些值，而不是靠默认：

```dockerfile
ENV GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR \
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif \
    CPL_VSIL_CURL_CHUNK_SIZE=32768 \
    CPL_VSIL_CURL_CACHE_SIZE=8388608 \
    GDAL_HTTP_MAX_RETRY=3 \
    GDAL_HTTP_RETRY_DELAY=1
```

瓦片服务是随机读为主，块不要太大（32 KB 比 256 KB 合适），缓存可以小一点，因为每个请求的窗口不重复。

## 6.5 一份可执行的验证脚本

部署完对象存储与 CDN，用这个脚本确认 Range 通路正常。它检查五件事：206、Content-Range、Accept-Ranges、CORS 预检、越界 416。

```bash
#!/usr/bin/env bash
set -uo pipefail

URL="$1"
ORIGIN="${2:-https://your-site.example.com}"

echo "== 1. 单区间请求 =="
curl -s -D - -o /dev/null -H "Range: bytes=0-1023" "$URL" \
  | grep -Ei "^(HTTP|content-range|content-length|accept-ranges)"

echo "== 2. 越界请求（应 416）=="
curl -s -D - -o /dev/null -H "Range: bytes=999999999-" "$URL" \
  | grep -Ei "^(HTTP|content-range)"

echo "== 3. CORS 预检（浏览器场景）=="
curl -s -D - -o /dev/null -X OPTIONS "$URL" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: range" \
  | grep -Ei "^(HTTP|access-control-)"

echo "== 4. 实际 GET 的 CORS 响应头 =="
curl -s -D - -o /dev/null -H "Origin: $ORIGIN" -H "Range: bytes=0-1023" "$URL" \
  | grep -Ei "^(HTTP|access-control-)"
```

期望输出：

```text
== 1. 单区间请求 ==
HTTP/1.1 206 Partial Content
content-range: bytes 0-1023/104857600
content-length: 1024
accept-ranges: bytes
== 2. 越界请求（应 416）==
HTTP/1.1 416 Requested Range Not Satisfiable
content-range: bytes */104857600
== 3. CORS 预检（浏览器场景）==
HTTP/1.1 204 No Content
access-control-allow-origin: https://your-site.example.com
access-control-allow-methods: GET, HEAD
access-control-allow-headers: range
== 4. 实际 GET 的 CORS 响应头 ==
HTTP/1.1 206 Partial Content
access-control-allow-origin: https://your-site.example.com
access-control-expose-headers: content-range, accept-ranges
```

第 3 步返回 403 或没有 access-control-allow-headers: range，就是浏览器里“图裂”的直接原因。

## 6.6 对象键设计

Range 只解决“怎么读”，键设计解决“读哪个”。三条原则：

**按时间与空间分层，不要按业务标签。** 前缀 imagery/{collection}/{date}/{id}.tif 让 LIST 与生命周期策略都好写；用 imagery/{project}/{status}/ 这种前缀，一旦状态变化就要移动对象（等于重写）。

**键里不要有会变的字段。** 版本号放最后一段，或者用内容哈希。改动版本 = 新对象，旧对象靠生命周期规则清理。

**避免热点前缀。** S3 的请求速率限制按前缀分区，虽然现在的自动分区已经很聪明，但把所有对象放在一个扁平前缀下仍然是坏习惯。

```text
imagery/
  sentinel-2-l2a/
    2023/05/01/
      S2B_10TFK_20230501_0_L2A/
        B04.tif
        B03.tif
        B02.tif
        item.json
```

这种结构的副作用是 STAC Item 的 href 会很长，但换来的是可预测的批量操作。

## 6.7 排错

| 现象 | 原因 | 验证 |
|------|------|------|
| curl 返回 206，浏览器报 CORS | 缺 Access-Control-Allow-Headers: range | 跑 6.5 的第 3 步 |
| 前端读不到 Content-Range | 缺 Access-Control-Expose-Headers | 看响应头 |
| 每个瓦片请求都拉全量 | 源站忽略 Range，或 CDN 未缓存 | 看响应码是不是 200 |
| 首屏特别慢，后续很快 | CDN 冷启动，第一次回源拉全量 | 看 CDN 的 Miss 统计 |
| 同一 URL 有时 206 有时 200 | 多 Range 或乱序 Range 被降级 | 检查客户端请求头 |
| 403 但文件存在 | 预签名过期，或桶策略限制 | 换预签名重试 |
| GDAL 打开报 403 但 curl 正常 | GDAL 发的 HEAD 被拒 | 用 -H 模拟 HEAD 验证 |

最后一条值得展开：某些对象存储或 WAF 会拒绝 HEAD 请求，而 GDAL 打开远程文件时会先发 HEAD 探测大小。表现是 gdalinfo 报 “HTTP response code: 403” 但 curl -I 也 403、curl -r 0-99 却 200。修法是让服务端放行 HEAD，或者在 GDAL 侧用 CPL_VSIL_CURL_USE_HEAD=NO 关闭 HEAD 探测。

## 6.8 生产建议

**把 CORS 配置当成接口契约来管。** 需要三个头：Allow-Origin（或具体域名）、Allow-Headers: range、Expose-Headers: Content-Range, Accept-Ranges。少一个都会在浏览器里出问题，而在 curl 里看不出来。

**CDN 缓存键只用 URL，不要带 Range 与 Cookie。** 带 Range 会让每个区间成为独立缓存对象，命中率归零。

**私有数据用 OAC 而不是预签名 URL。** 预签名 URL 的查询串破坏缓存键，且过期时间与 CDN TTL 会打架。

**给 Range 请求设超时与重试。** GDAL 侧用 GDAL_HTTP_MAX_RETRY 与 GDAL_HTTP_RETRY_DELAY；服务端侧对 5xx 做退避。对象存储偶发的 503 在高峰期并不罕见。

**监控两个指标：请求数与单请求字节数。** 正常的瓦片服务，单请求字节数在 16–256 KB；如果看到大量 16 KB 的请求，说明块太小或缓存没生效；如果看到 MB 级请求，说明在拉全量。

## 6.9 本章小结

| 要点 | 结论 |
|------|------|
| Range 语义 | 服务端可以忽略；206 表示区间，416 表示越界，200 表示全量 |
| S3 | 只支持单区间；预签名 URL 与 Range 兼容，但破坏 CDN 缓存键 |
| CloudFront | 源站不支持 Range 时缓存全量再切片；乱序/重叠 Range 降级成 200 |
| CORS | 必须允许 range 头，并 expose Content-Range |
| GDAL | 16 KB 块、最多 128 倍顺序放大、16 MB 全局 LRU |
| 键设计 | 按时间空间分层，版本或哈希放末尾，避免热点前缀 |

下一章把 STAC 元数据落地：用 pystac 从一堆 COG 生成静态目录，处理相对链接、Collection 划分与校验。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第05章-COG生成校验与优化/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第07章-静态STAC目录构建/" class="chapter-nav__next">下一章 →</a>
</div>

---
layout: default
title: 第03章 - COG 云优化 GeoTIFF 原理
---

# 第03章 - COG 云优化 GeoTIFF 原理

一个 10000 × 10000 的 GeoTIFF，未压缩约 300 MB。客户端要第 14 级的一块 256 × 256 瓦片，理论上只需要几百 KB 的像素。但“需要”和“能取到”是两件事：如果文件按条带（strip）存储，一行条带横跨整个 10000 像素宽，取 256 × 256 就得读 256 条横条，每条 10000 像素，加起来约 7.6 MB 的解压前数据；如果按瓦片（tile）存储，读 1 到 4 个 512 × 512 块就够了。

COG 就是把“能取到”变成现实的那层组织约定。它没有发明新格式，只是把 TIFF 已有的三个机制——分块、降分辨率子文件、元数据前置——按固定顺序摆好，让一次 HTTP Range 请求能定位到目标字节。

2023 年 OGC 把这件事标准化为 **OGC 21-026 Cloud Optimized GeoTIFF Standard v1.0**（批准 2023-05-08，发布 2023-07-14）。这一章按标准的条款顺序拆解，每条给出对应的字节级现象和验证命令。

## 3.1 TIFF 的骨架

### 3.1.1 文件头与 IFD

TIFF 文件由三部分组成：8 字节文件头、一个或多个 IFD（Image File Directory）、以及 IFD 指向的数据区。

8 字节头（经典 TIFF）：

| 偏移 | 长度 | 内容 |
|------|------|------|
| 0–1 | 2 | 字节序：II（0x4949，小端）或 MM（0x4d4d，大端） |
| 2–3 | 2 | 魔数 42（0x002a） |
| 4–7 | 4 | 第一个 IFD 的字节偏移 |

BigTIFF 把魔数改成 43，偏移宽度从 4 字节改成 8 字节，头部变成 16 字节。

IFD 本身是一张标签表：

```text
┌─────────────────────────────┐
│ 2 字节：标签数量 N            │
├─────────────────────────────┤
│ N × 12 字节：标签条目         │
│   tag(2) type(2) count(4)    │
│   value_or_offset(4)         │
├─────────────────────────────┤
│ 4 字节：下一个 IFD 的偏移（0 表示结束）│
└─────────────────────────────┘
```

当标签的值超过 4 字节（比如 TileOffsets 数组），IFD 里存的是**指向值区的偏移**，真正的数组放在别处。这一点是 COG 布局的关键：TileOffsets 与 TileByteCounts 这两个数组可能很大（10000 像素、512 块 → 每方向 20 块 → 400 个偏移 × 4 字节 = 1.6 KB），它们的位置决定了“打开文件”要读几次。

### 3.1.2 条带与瓦片

TIFF 6.0 的 15 节定义了瓦片存储：图像被切成固定大小的矩形块，每块独立压缩。相关标签：

| 标签 | 编号 | 说明 |
|------|------|------|
| TileWidth | 322 | 瓦片宽，必须是 16 的倍数 |
| TileLength | 323 | 瓦片高，必须是 16 的倍数 |
| TileOffsets | 324 | 每块数据在文件中的偏移数组 |
| TileByteCounts | 325 | 每块压缩后的字节数 |

不用瓦片时是条带：RowsPerStrip（278）、StripOffsets（273）、StripByteCounts（279）。条带的宽度等于图像宽度，所以“按行读”友好、“按块读”灾难。

OGC 21-026 的要求很直接：**所有 IFD 都必须按瓦片组织**。标准原文是 “All Image File Directories (IFD) in a COG file SHALL be organized into tiles (instead of strips)”。这一条没有例外，包括 overview 与掩膜。

还有两条补充：瓦片必须是正方形（TileWidth = TileLength），且边长要“小于或等于常见屏幕视口”。后半句没有给具体数字，实践中 256 与 512 是主流；GDAL 的 COG driver 默认 512。

### 3.1.3 用命令看这些标签

```bash
# GDAL 的视角
gdalinfo scene.tif | head -40
# Driver: GTiff/GeoTIFF
# Size is 10000, 10000
# Coordinate System is: PROJCRS["WGS 84 / UTM zone 50N", ...]
# Band 1 Block=512x512 Type=UInt16, ColorInterp=Gray
#   Overviews: 5000x5000, 2500x2500, 1250x1250, 625x625, 313x313

# rasterio 的视角，看块大小与压缩
rio info scene.tif
# {"blockxsize": 512, "blockysize": 512, "compress": "deflate",
#  "count": 3, "dtype": "uint16", "interleave": "pixel",
#  "tiled": true, "width": 10000, "height": 10000, ...}
```

gdalinfo 输出里的 Block=512x512 就是 TileWidth/TileLength；如果显示 Block=10000x1 之类的形状，说明是按条带存的，不是 COG。

## 3.2 Overview：为什么要金字塔

### 3.2.1 没有 overview 会怎样

客户端要 z10 的瓦片，对应地面范围可能覆盖整景。没有 overview 时，GDAL 必须读全分辨率数据再降采样：10000 × 10000 × 3 波段 × 2 字节 = 600 MB 的解压后数据。即使只读需要的窗口，缩放到 256 × 256 也要读几百万像素。

有 overview 时，z10 可能直接命中 313 × 313 那一级，读 1 个块就够。

### 3.2.2 标准的硬约束

OGC 21-026 对 overview 有四条要求：

1. **至少一个全分辨率 IFD**（NewSubfileType 的第 0 位未置位，或没有该标签）。
2. **IFD 链的顺序**：全分辨率 IFD 的 next 指针指向第一个 overview 的 IFD；每个 overview 的 next 指向下一个更小的 overview；最后一个 overview 的 next 指向下一个全分辨率图像（比如另一个波段或掩膜），没有就指向 0。
3. **每一级必须比上一级小**（ImageWidth 与 ImageHeight 都更小）。
4. **缩小倍数在 2 到 10 之间**，最后一级必须小到 TilesAcross 或 TilesDown 等于 1。

第 4 条的后半句常被忽略：如果你的 overview 只做到 1/64，而图像还有 20 × 20 块，校验就会失败——因为最小一级仍然跨多个瓦片。GDAL 的 COG driver 与 rio-cogeo 都会自动算到“最小一级只剩一个块”为止。

```python
def overview_levels(width: int, height: int, tilesize: int = 512) -> int:
    """算需要几级 overview，使最小一级只剩一个瓦片。"""
    level = 0
    while min(width, height) > tilesize:
        width //= 2
        height //= 2
        level += 1
    return level

print(overview_levels(10000, 10000))   # 5
print(overview_levels(4096, 4096))     # 3
```

这个算法与 rio-cogeo 内部的 get_maximum_overview_level 等价：它用 tilesize 作为 minsize，反复除以 2 直到小于块边长。10000 像素、512 块 → 需要 5 级（5000、2500、1250、625、312）。

### 3.2.3 地理参考只在全分辨率层

标准要求：全分辨率 IFD 必须用 ModelTiepointTag、ModelPixelScaleTag、GeoKeyDirectoryTag 写地理参考；**所有 overview 不得包含地理参考**，读取时继承全分辨率层的原点。

这条的经济意义很直接：每级 overview 少写几十到几百字节的 GeoKeys。更重要的是语义——如果 overview 自己写了略有偏差的原点，不同层级的瓦片会错位，而客户端通常不会检查。

## 3.3 文件布局：一次请求读完头部

### 3.3.1 推荐顺序

标准的 Recommendation 3 给了 12 项顺序，归纳成四段：

```text
[1] TIFF 头 + ghost 区
[2] 全分辨率 IFD + 其标签值（不含 TileOffsets/TileByteCounts 数组）
[3] 掩膜 IFD（若有）
[4] 各级 overview 的 IFD（从大到小）
[5] 各级掩膜 overview 的 IFD
[6] 上述所有 IFD 的 TileOffsets 与 TileByteCounts 数组
[7] 最小 overview 的瓦片数据
[8] …中间各级…
[9] 最大 overview 的瓦片数据
[10] 全分辨率瓦片数据
```

关键在 [2]–[6]：所有 IFD 与偏移数组连续排布，一次 Range 请求就能全部取回。数据区从最小 overview 开始往前排，是因为浏览器加载时先要低分辨率——这样连续读的时候是顺序 I/O。

### 3.3.2 乱序的代价

标准里给了对照：TIFF 规范本身对 IFD 位置毫无约束，只要 next 指针指对就行。一个“合法但很糟”的布局可以是：全分辨率 IFD 在文件头、第一级 overview IFD 在文件尾、第二级在文件中间。打开它需要三次请求。

数字上：S3 单次请求 20–30 ms，加上数据 locality 与传输，常见 150 ms。三次请求 = 450 ms 加 90 ms，约 540 ms。在浏览器里，这半秒就是“点了没反应”和“立刻出图”的区别。

### 3.3.3 ghost 区

GDAL 3.1 起，写 COG 时会在头部插入一段 ASCII 的 ghost 区：

```text
GDAL_STRUCTURAL_METADATA_SIZE=000140 bytes
LAYOUT=IFDS_BEFORE_DATA
BLOCK_ORDER=ROW_MAJOR
BLOCK_LEADER=SIZE_AS_UINT4
BLOCK_TRAILER=LAST_4_BYTES_REPEATED
KNOWN_INCOMPATIBLE_EDITION=NO
```

这段不是 TIFF 标准的一部分，是 GDAL 的私有约定。它的价值在于**可检测性**：任何人用 GDAL 以 update 模式打开 COG 并写入，GDAL 会把 KNOWN_INCOMPATIBLE_EDITION 改成 YES，因为它知道布局已经被破坏。

rio-cogeo 的校验正是靠这个字段判断“曾经是 COG、后来被改坏”：

```python
gdal_ghost_headers = src.get_tag_item("GDAL_STRUCTURAL_METADATA", "TIFF")
if (
    gdal_ghost_headers is not None
    and "KNOWN_INCOMPATIBLE_EDITION=YES" in gdal_ghost_headers
):
    errors.append(
        "This file used to have optimizations in its layout, "
        "but those have been, at least partly, invalidated by later changes"
    )
```

这段代码来自 rio-cogeo 7.0.4 的 cog_validate。它解释了一个常见现象：文件昨天校验通过，今天变 invalid，中间只被人用 QGIS 打开编辑过。

## 3.4 校验规则逐条对照

rio-cogeo 的 cog_validate 是 GDAL 官方 validate_cloud_optimized_geotiff.py 的 rasterio 移植版，逻辑基本一一对应。它的检查项可以当作 COG 定义的“可执行版本”：

| 检查 | 判级 | 代码依据 |
|------|------|----------|
| 驱动不是 GTiff | error | "The file is not a GeoTIFF" |
| 存在外部 .ovr | error | "Overviews found in external .ovr file. They should be internal" |
| 大于 512 但不是 tiled | error | "The file is greater than 512xH or 512xW, but is not tiled" |
| 大于 512 但没有 overview | warning | "it is recommended to include internal overviews" |
| 主 IFD 偏移 > 300 | error | "The offset of the main IFD should be < 300" |
| ghost 区标记已损坏 | error | "used to have optimizations ... invalidated by later changes" |
| overview 未排序 | error | "Overviews should be sorted" |
| overview 抽取倍数 ≤ 1 | error | "Invalid Decimation ... for overview level" |
| IFD 偏移未递增 | error | "The offset of the IFD for overview of index ..." |
| 最小 overview 首块在 IFD 之前 | error | "The offset of the first block of the smallest overview should be after its IFD" |
| 主图首块在 overview 之前 | error | "The offset of the first block of the main resolution image should be after ..." |
| overview 未分块 | error | "Overview of index {} is not tiled" |

几个数字值得记住：

- **512**：小于等于 512 的文件不要求分块（小文件整体读也就几 KB）。
- **300**：主 IFD 的偏移上限。正常 COG 的主 IFD 在 8 字节头之后，加上 ghost 区约 140 字节，偏移通常在 150–250 之间；超过 300 说明头部塞了太多东西或者布局异常。
- **strict 模式**：把 warning 也当 error。CI 里建议开 strict，否则“没有 overview”这种警告会被忽略。

```bash
# 普通校验
rio cogeo validate scene.tif
# scene.tif is a valid cloud optimized GeoTIFF

# strict：warning 也算失败
rio cogeo validate --strict scene.tif

# 看详细结构（IFD 表、块大小、抽取倍数）
rio cogeo info scene.tif
```

rio cogeo info 的输出里有一段 IFD 表，形如：

```text
IFD
    Id      Size            BlockSize        Decimation
    0       10000x10000     512x512          0
    1       5000x5000       512x512          2
    2       2500x2500       512x512          4
    3       1250x1250       512x512          8
    4       625x625         512x512          16
    5       313x313         512x512          32
```

这张表是判断 overview 是否正确的最快方式：Decimation 列应该是 2 的幂次递增，最后一行的 Size 应该小于等于 BlockSize。

## 3.5 压缩与数值编码

### 3.5.1 压缩算法选择

标准不限定压缩方法，只说“常见的是无压缩、DEFLATE、LZW，或者有损的 JPEG”。实际选择要看数据类型：

| 压缩 | 有损 | 适用 | 注意 |
|------|------|------|------|
| DEFLATE | 否 | 通用，尤其浮点 | 比 LZW 压得好，但部分老软件兼容性差 |
| LZW | 否 | 通用，兼容性最好 | 压缩率一般 |
| ZSTD | 否 | GDAL ≥ 2.3 | 需要较新的 libtiff |
| JPEG | 是 | 8 位 RGB 影像 | 只能 1 或 3 波段，不支持 16 位 |
| WEBP | 是 | 8 位 RGB | 需要 GDAL ≥ 3.x 与 libwebp |
| LERC | 有损/无损 | 浮点高程 | 需 LERC 支持 |

rio-cogeo 的 profile 表把常用组合固化了，全部是 512 块、pixel interleave：

```python
from rio_cogeo.profiles import cog_profiles

print(cog_profiles.get("deflate"))
# {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True,
#  'blockxsize': 512, 'blockysize': 512, 'compress': 'DEFLATE'}

print(cog_profiles.get("jpeg"))
# {..., 'compress': 'JPEG', 'photometric': 'YCbCr'}
```

注意 jpeg profile 带 photometric: YCbCr。YCbCr 是 3 波段专用的色彩空间，用在单波段上会被 rio-cogeo 自动降级：

```python
if dst_kwargs.get("photometric", "").upper() == "YCBCR" and meta["count"] == 1:
    warnings.warn("PHOTOMETRIC=YCBCR not supported on a 1-band raster ...")
    dst_kwargs["photometric"] = "MINISBLACK"
```

### 3.5.2 predictor

对整型数据，DEFLATE/LZW/ZSTD 加 predictor 能显著提升压缩率。GDAL 的 COG driver 用 PREDICTOR 选项：

| 值 | 含义 |
|----|------|
| NO | 不使用（默认） |
| STANDARD | Predictor=2，整型水平差分 |
| FLOATING_POINT | Predictor=3，浮点差分 |

```bash
gdal_translate in.tif out.tif \
  -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES \
  -co BLOCKSIZE=512 -co OVERVIEWS=AUTO
```

PREDICTOR=YES 在 GDAL 里等价于“按数据类型自动选 STANDARD 或 FLOATING_POINT”。对 uint16 的卫星影像，通常能再省 10%–20%。

### 3.5.3 掩膜与 alpha

nodata 有三种表达方式，代价不同：

| 方式 | 存储 | 读取开销 |
|------|------|----------|
| 数据集级 nodata 值 | 一个标签 | 无额外 I/O |
| 内部掩膜 band（1 位） | 额外一个 IFD + 每块掩膜字节 | 每次读块多一次解码 |
| alpha band | 多一个波段 | 数据量 +33% |

rio-cogeo 的处理逻辑：输入有 nodata 或 alpha 时，如果输出压缩是 JPEG，会强制转成内部掩膜并给出警告，因为 JPEG 不支持 nodata。

```python
if not add_mask and (
    (nodata is not None or alpha)
    and dst_kwargs.get("compress", "").lower() == "jpeg"
):
    warnings.warn("Nodata/Alpha band will be translated to an internal mask band.")
    add_mask = True
```

生产上的建议：能用数据集级 nodata 就别用掩膜。掩膜让每块数据的字节数翻倍，而且会让 Range 请求命中率下降——瓦片服务读一个块时，可能还要额外读对应的掩膜块。

## 3.6 手工解析一个 COG 的头部

理解布局最直接的方式是自己读字节。下面这段代码不依赖 GDAL，只解析 TIFF 头与第一个 IFD，能打印出 COG 的关键指标。

```python
import struct
import sys

def read_header(path: str) -> dict:
    with open(path, "rb") as f:
        head = f.read(16)
        order = "<" if head[:2] == b"II" else ">"
        magic = struct.unpack(order + "H", head[2:4])[0]
        if magic == 42:
            offset = struct.unpack(order + "I", head[4:8])[0]
            bigtiff = False
        elif magic == 43:
            offset = struct.unpack(order + "Q", head[8:16])[0]
            bigtiff = True
        else:
            raise ValueError(f"not a TIFF: magic={magic}")
        return {"order": order, "bigtiff": bigtiff, "first_ifd": offset}

h = read_header("scene.tif")
print(h)   # {'order': '<', 'bigtiff': False, 'first_ifd': 232}
```

读 IFD 的逻辑只有三步：定位到 first_ifd；读 2 字节（BigTIFF 是 8 字节）得到标签数量 N；再读 N 个 12 字节（BigTIFF 20 字节）的条目，每个条目是 tag(2) + type(2) + count(4) + value_or_offset(4)。ImageWidth 是 256、TileWidth 是 322、Compression 是 259，按编号取即可。真要解析完整 TIFF，用 tifffile 或 GDAL，不要自己写。

运行结果里 first_ifd 的值直接对应“主 IFD 偏移 < 300”这条规则：232 合格，5000 不合格。压缩代码 259 的取值是 1=无压缩、5=LZW、8=DEFLATE、7=JPEG。


## 3.7 常见问题

| 现象 | 原因 | 验证 |
|------|------|------|
| validate 报 "not tiled" | 生成时用了默认的 strip 输出 | rio info 看 tiled 字段 |
| validate 报 IFD offset > 300 | 头部塞了大量元数据（如超长 RPC 系数） | gdalinfo -mdd all 看元数据量 |
| validate 报 overview 未排序 | 先建了 overview 再重写文件 | rio cogeo info 看 Decimation 列 |
| 文件从 200 MB 涨到 400 MB | 加了内部掩膜或 alpha | gdalinfo 看 Mask Flags |
| 16 位数据用 JPEG 压缩后花屏 | JPEG 只支持 8 位 | 换 DEFLATE |
| 单波段用 YCbCr 报错 | YCbCr 需要 3 波段 | rio-cogeo 会自动降级，GDAL 不会 |
| BigTIFF 生成后某些库读不了 | 老版本 libtiff 不支持 | 文件 < 4 GB 时用经典 TIFF |

最后一条值得说明：OGC 标准写的是“超过 4 GB 必须用 BigTIFF，小于 4 GB 建议用经典 TIFF”。GDAL 的 BIGTIFF=IF_SAFER 就是按这个逻辑自动选。如果你的下游有老系统，把 BIGTIFF 显式设成 NO 更安全，代价是文件不能超过 4 GB。

## 3.8 生产建议

**块大小跟瓦片网格对齐。** WebMercatorQuad 的瓦片是 256 像素，COG 块 512 意味着一个块覆盖 2 × 2 个瓦片——请求单块瓦片时读一个块，请求 2 × 2 瓦片时刚好读一个块。如果块是 256，请求 2 × 2 瓦片要读 4 个块，请求数翻四倍。这也是 GDAL 与 rio-cogeo 都默认 512 的原因。

**overview 用平均重采样，不要用最近邻。** 最近邻在降采样时会产生锯齿和摩尔纹，尤其在建筑密集区。rio-cogeo 的 --overview-resampling 默认是 nearest（为了快），生产上应该显式改成 average。注意这与“波段是分类数据”的场景冲突——分类图必须用 nearest 或 mode。

**不要在有损压缩的 COG 上做定量分析。** JPEG/WEBP 会改变像素值，NDVI、反射率反演这类计算必须用无损压缩或原始数据。有损压缩只用于展示层。

**上传前跑一次 strict 校验。** 一条命令的成本，换来的是线上不会出现“某些缩放级别模糊”这种难查的问题。CI 里可以这样接：

```bash
set -e
for f in dist/*.tif; do
  rio cogeo validate --strict "$f" || { echo "INVALID: $f"; exit 1; }
done
```

## 3.9 本章小结

| 要点 | 结论 |
|------|------|
| COG 是什么 | GeoTIFF 的组织约定，不是新格式；标准 OGC 21-026 v1.0 |
| 三个机制 | 分块（tiled）、金字塔（overview）、元数据前置（IFD before data） |
| 关键数字 | 块 512；IFD 偏移 < 300；overview 因子 2–10；最小层只剩 1 块 |
| 地理参考 | 只写全分辨率 IFD，overview 继承 |
| ghost 区 | GDAL ≥ 3.1 写入，KNOWN_INCOMPATIBLE_EDITION 标记布局是否被破坏 |
| 校验 | rio cogeo validate --strict，CI 必跑 |

下一章把工具链装起来：GDAL、rio-cogeo、pystac、stac-fastapi、PostgreSQL 与 pgstac 的版本组合，以及国内网络环境下最容易卡住的几个点。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第02章-STAC规范与数据模型/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第04章-开发环境与工具链搭建/" class="chapter-nav__next">下一章 →</a>
</div>

---
layout: default
title: 第05章 - COG 生成校验与优化
---

# 第05章 - COG 生成校验与优化

生成一个“能被 GDAL 打开”的 GeoTIFF 很容易，生成一个“打开只要一次请求、取瓦片只要一个块”的 COG 需要做对四件事：分块、金字塔、元数据前置、压缩与位深匹配。前三件是布局，第四件是编码，任何一件做错，validate 可能仍然通过，但线上性能会差一个数量级。

这一章用两条工具路线覆盖生产场景：rio-cogeo（Python，可编程、可嵌入流水线）与 GDAL COG driver（命令行，简单、快）。两条路线都要给出参数表、内部实现和失败模式，最后给一套批量流水线的写法。

先明确一个容易混淆的点：**rio-cogeo 没有 copy 子命令**。7.0.4 的 CLI 只有三个：create、validate、info。网上流传的 “rio cogeo copy” 是把它和 rio-cogeo 内部的 rasterio.shutil.copy 搞混了。

## 5.1 rio cogeo create 的参数

### 5.1.1 完整参数表

| 参数 | 默认值 | 作用 |
|------|--------|------|
| --cog-profile / -p | deflate | 压缩 profile：jpeg、webp、zstd、lzw、deflate、packbits、lzma、lerc、lerc_deflate、lerc_zstd、raw |
| --blocksize | 由 profile 决定（512） | 覆盖 profile 的块大小 |
| --overview-level | 自动 | overview 级数；不给则算到最小一级小于块边长 |
| --overview-resampling | nearest | overview 重采样算法 |
| --overview-blocksize | 128 或 GDAL 默认 | overview 的块大小 |
| --decimation-base | 2 | 每级缩小倍数，> 2 时必须显式给 --overview-level |
| --resampling / -r | nearest | 重投影重采样，仅在给 --tms 或 --web-optimized 时生效 |
| --nodata | 无 | 覆盖输入的 nodata |
| --add-mask | false | 强制生成内部掩膜 |
| --dtype | 输入 dtype | 覆盖输出数据类型 |
| --bidx / -b | 全部波段 | 选择波段，逗号分隔 |
| --in-memory / --no-in-memory | 自动 | 小于 10980 × 10980 像素时在内存处理 |
| --allow-intermediate-compression | false | 允许中间文件压缩，降内存但变慢 |
| --forward-band-tags | false | 转发波段标签 |
| --forward-ns-tags | false | 转发命名空间标签 |
| --threads | ALL_CPUS | 压缩线程数 |
| --use-cog-driver | false | 走 GDAL COG driver（需 GDAL ≥ 3.1） |
| --tms | 无 | TileMatrixSet JSON 路径，用于对齐网格 |
| --zoom-level-strategy | auto | lower / upper / auto |
| --zoom-level | 无 | 指定最高分辨率对应的层级 |
| --aligned-levels | 无 | 与 TMS 对齐的 overview 级数 |
| --config | 无 | GDAL 配置项 NAME=VALUE，可多次 |
| --quiet / -q | false | 关闭进度条 |

几个默认值值得记住，它们决定了“不传参数时会发生什么”：

```python
# CLI 里的默认值（rio_cogeo/scripts/cli.py）
output_profile = cog_profiles.get("deflate")     # 512 块 + DEFLATE + pixel interleave
output_profile.update({"BIGTIFF": os.environ.get("BIGTIFF", "IF_SAFER")})
config.update({
    "GDAL_NUM_THREADS": threads,                  # 默认 ALL_CPUS
    "GDAL_TIFF_INTERNAL_MASK": os.environ.get("GDAL_TIFF_INTERNAL_MASK", True),
})
```

BIGTIFF=IF_SAFER 的意思是“如果可能超过 4 GB 就用 BigTIFF”，对应 OGC 标准里“大于 4 GB 必须 BigTIFF”的要求。

### 5.1.2 最小命令与输出

```bash
rio cogeo create input.tif output.tif
```

```text
Reading input: input.tif
Adding overviews...
Updating dataset tags...
Writing output to: output.tif
```

这三行输出对应内部三个阶段：分块拷贝、建金字塔、写元数据。第三阶段会把 OVERVIEW_RESAMPLING 写进数据集标签：

```python
tags = src_dst.tags()
tags.update({"OVERVIEW_RESAMPLING": ResamplingEnums[overview_resampling].name.upper()})
tmp_dst.update_tags(**tags)
```

所以生成后可以用 gdalinfo 反查当初用的重采样算法——排查“为什么缩略图有锯齿”时很有用。

### 5.1.3 指定网格对齐

如果下游是 WebMercatorQuad 的瓦片服务，让 COG 的块与瓦片网格对齐能减少跨块读取：

```bash
# 用内置的 TMS（等价于 --web-optimized，但后者已弃用）
rio cogeo create input.tif output.tif \
  --tms /path/to/WebMercatorQuad.json \
  --blocksize 512 \
  --overview-resampling average

# 或者直接给缩放级别，跳过自动推断
rio cogeo create input.tif output.tif \
  --tms /path/to/WebMercatorQuad.json \
  --zoom-level 14 \
  --aligned-levels 4
```

--web-optimized 在 5.1.2 起被标记为弃用，6.0 移除；它现在只等价于“给一个默认的 WebMercatorQuad”。用 --tms 显式给文件更可控。

## 5.2 cog_translate 的内部实现

理解内部流程，才能在失败时判断是哪一步出的问题。cog_translate 的主干（rio-cogeo 7.0.4）：

```text
打开源（本地或 /vsicurl/）
  ↓
判定 nodata / alpha / mask，决定是否 add_mask
  ↓
构造 WarpedVRT（统一 dtype、尺寸、重采样）
  ↓
创建临时目标（内存 MemoryFile 或磁盘临时文件）
  ↓
按块循环：vrt.read(window) → tmp_dst.write(window)
  ↓
build_overviews（因子 2^1 .. 2^n）
  ↓
写标签、波段描述、scale/offset
  ↓
copy(tmp_dst, dst_path, copy_src_overviews=True, **dst_kwargs)
```

几个关键决策点：

**内存阈值。** 源小于 10980 × 10980 像素时用 MemoryFile，否则落磁盘临时文件。

```python
IN_MEMORY_THRESHOLD = int(os.environ.get("IN_MEMORY_THRESHOLD", 10980 * 10980))
...
if in_memory is None:
    in_memory = vrt_dst.width * vrt_dst.height < IN_MEMORY_THRESHOLD
```

10980 是 Sentinel-2 单景的边长，这个阈值等于“一景 S2 以内放内存”。处理大区域镶嵌时要显式 --no-in-memory，否则内存会爆。

**overview 级数。** 不给 --overview-level 时，用 rasterio 的 get_maximum_overview_level 算到最小一级小于块边长：

```python
if overview_level is None:
    overview_level = get_maximum_overview_level(
        vrt_dst.width, vrt_dst.height, minsize=tilesize
    )
overviews = [decimation_base**j for j in range(1, overview_level + 1)]
tmp_dst.build_overviews(overviews, ResamplingEnums[overview_resampling])
```

注意 decimation_base 默认 2，所以因子是 2、4、8、16、32。想用 3 倍金字塔必须同时给 --overview-level，否则直接抛错：

```text
ValueError: Decimation base values greater than 2 require that overview_level is defined.
```

**掩膜优先级。** nodata 优先于 alpha/mask：

```python
if nodata is not None and (alpha or mask):
    warnings.warn("Input dataset has both a nodata value and internal alpha/mask band. "
                  "Nodata value will be prioritized.")
```

**JPEG 与 nodata 冲突。** JPEG 不支持 nodata，rio-cogeo 会自动加掩膜并警告：

```text
Nodata/Alpha band will be translated to an internal mask band.
```

这条警告经常被忽略，结果是文件体积翻倍——掩膜本身也要分块存储。

**copy 阶段。** 最后一步不是重写像素，而是用 rasterio.shutil.copy 让 GDAL 重新组织布局：

```python
copy(tmp_dst, dst_path, copy_src_overviews=True, **dst_kwargs)
```

copy_src_overviews=True 是关键：它把临时文件里已经建好的 overview 一起搬过去，而不是在目标文件上重建。这也解释了为什么 rio-cogeo 的临时文件即使没压缩，最终输出仍然紧凑——布局是 copy 阶段定的。

## 5.3 GDAL COG driver

GDAL 3.1 起有专门的 COG driver，一条命令搞定分块、金字塔、布局：

```bash
gdal_translate input.tif output.tif \
  -of COG \
  -co COMPRESS=DEFLATE \
  -co PREDICTOR=YES \
  -co BLOCKSIZE=512 \
  -co OVERVIEWS=AUTO \
  -co OVERVIEW_RESAMPLING=AVERAGE \
  -co NUM_THREADS=ALL_CPUS \
  -co BIGTIFF=IF_SAFER
```

### 5.3.1 关键选项

| 选项 | 默认 | 说明 |
|------|------|------|
| BLOCKSIZE | 512 | 块边长，必须能被 16 整除 |
| COMPRESS | LZW | NONE/LZW/JPEG/DEFLATE/ZSTD/WEBP/LERC/LERC_DEFLATE/LERC_ZSTD/LZMA |
| QUALITY | 75 | JPEG/WEBP 质量，100 最好 |
| PREDICTOR | NO | YES/NO/STANDARD/FLOATING_POINT |
| OVERVIEWS | AUTO | AUTO/IGNORE_EXISTING/FORCE_USE_EXISTING/NONE |
| OVERVIEW_RESAMPLING | 由 GDAL 定 | NEAREST/AVERAGE/BILINEAR/CUBIC/CUBICSPLINE/LANCZOS/MODE/RMS |
| NUM_THREADS | 1 | 线程数或 ALL_CPUS |
| BIGTIFF | IF_NEEDED | YES/NO/IF_NEEDED/IF_SAFER |
| TILING_SCHEME | 无 | 指定网格，如 EPSG:3857 或 GoogleMapsCompatible |

注意 COMPRESS 默认是 LZW，而 rio-cogeo 默认 DEFLATE。同样输入，GDAL 直接转出来的文件通常比 rio-cogeo 大 10%–20%。

OVERVIEWS 的四个值语义不同，选错会导致“明明有 overview 却没用上”：

| 值 | 行为 |
|----|------|
| AUTO | 源有 overview 就用，没有就生成 |
| IGNORE_EXISTING | 忽略源的 overview，重新生成 |
| FORCE_USE_EXISTING | 强制用源的 overview，不生成 |
| NONE | 不生成也不用，输出没有金字塔 |

### 5.3.2 与 rio-cogeo 的差异

| 维度 | rio-cogeo | GDAL COG driver |
|------|-----------|-----------------|
| 默认压缩 | DEFLATE | LZW |
| 默认块 | 512 | 512 |
| 中间文件 | 有（内存或磁盘） | 无，直接写目标 |
| 掩膜处理 | 自动转换并警告 | 转成 alpha band 并警告 |
| 可编程性 | Python API，可逐块控制 | 命令行或 gdal.Translate |
| 依赖 | rasterio + GDAL | 只要 GDAL |
| 速度 | 较慢（多一次 copy） | 较快 |

rio-cogeo 用 --use-cog-driver 可以切到 GDAL 驱动，此时它会调整参数适配：

```python
dst_kwargs["driver"] = "COG"
dst_kwargs["overview_resampling"] = overview_resampling
dst_kwargs["warp_resampling"] = resampling
dst_kwargs["blocksize"] = tilesize
dst_kwargs.pop("blockxsize", None)
dst_kwargs.pop("blockysize", None)
dst_kwargs.pop("tiled", None)
copy(tmp_dst, dst_path, **dst_kwargs)
```

注意这里 blocksize 用的是 min(blockxsize, blockysize)，所以非方形块会被压成方形——COG 标准要求方形块，这个行为是对的。

## 5.4 五个可跑示例

### 5.4.1 从普通 GeoTIFF 生成 COG 并校验

```bash
#!/usr/bin/env bash
set -euo pipefail

SRC="$1"
DST="${2:-out.tif}"

rio cogeo create "$SRC" "$DST" \
  --cog-profile deflate \
  --blocksize 512 \
  --overview-resampling average \
  --threads ALL_CPUS

rio cogeo validate --strict "$DST"
rio cogeo info "$DST" | head -20
```

```text
$ ./make_cog.sh scene.tif scene_cog.tif
Reading input: scene.tif
Adding overviews...
Updating dataset tags...
Writing output to: scene_cog.tif
scene_cog.tif is a valid cloud optimized GeoTIFF
Driver:        GTiff
File:          scene_cog.tif
COG:           True
Compression:   DEFLATE
ColorSpace:    None
Profile
    Width:                    10000
    Height:                   10000
    Bands:                    3
    Tiled:                    True
    Dtype:                    uint16
    NoData:                   0.0
```

### 5.4.2 只保留 RGB 三个波段并转 8 位

展示用的 COG 不需要 16 位精度，转 8 位能把体积压到 1/2 到 1/4：

```bash
rio cogeo create scene.tif scene_rgb.tif \
  --bidx 4,3,2 \
  --dtype uint8 \
  --cog-profile jpeg \
  --co QUALITY=85 \
  --co PHOTOMETRIC=YCBCR \
  --blocksize 512
```

这里有一个容易写错的点：rio cogeo create 没有 --quality 参数。质量、photometric 这类驱动级创建选项要走 --co（rasterio 的 --co 与 --profile 是同一个选项的两个名字）。写成 --quality 85 会直接被 click 拒绝，报 No such option。

dtype 从 uint16 降到 uint8 会直接截断（不缩放），高值会变成 255。需要正确拉伸时先在源上算好，或者用 TiTiler 的 rescale 在展示层做。

### 5.4.3 用 Python API 批量处理

```python
from pathlib import Path
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles

src_dir = Path("raw")
dst_dir = Path("cog")
dst_dir.mkdir(exist_ok=True)

profile = cog_profiles.get("deflate")
profile.update({"blockxsize": 512, "blockysize": 512})

config = {
    "GDAL_NUM_THREADS": "ALL_CPUS",
    "GDAL_TIFF_INTERNAL_MASK": True,
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
}

ok, bad = 0, []
for src in sorted(src_dir.glob("*.tif")):
    dst = dst_dir / src.name
    try:
        cog_translate(
            src,
            dst,
            profile,
            overview_resampling="average",
            config=config,
            quiet=True,
        )
        valid, errors, warnings = cog_validate(dst, strict=True, quiet=True)
        if valid:
            ok += 1
        else:
            bad.append((dst.name, errors))
    except Exception as e:
        bad.append((src.name, [str(e)]))

print(f"ok={ok} bad={len(bad)}")
for name, errs in bad:
    print(name, errs)
```

cog_validate 返回三元组 (is_valid, errors, warnings)，strict=True 时 warning 也会让 is_valid 变 False。批量场景一定要检查返回值，不要只看有没有抛异常——校验失败不抛异常。

### 5.4.4 用 GDAL 生成并对比体积

```bash
SRC=scene.tif

# LZW（GDAL 默认）
time gdal_translate "$SRC" lzw.tif -of COG -co COMPRESS=LZW -co BLOCKSIZE=512

# DEFLATE + predictor
time gdal_translate "$SRC" deflate.tif -of COG -co COMPRESS=DEFLATE \
  -co PREDICTOR=YES -co BLOCKSIZE=512 -co NUM_THREADS=ALL_CPUS

# ZSTD
time gdal_translate "$SRC" zstd.tif -of COG -co COMPRESS=ZSTD \
  -co PREDICTOR=YES -co BLOCKSIZE=512 -co NUM_THREADS=ALL_CPUS

ls -lh lzw.tif deflate.tif zstd.tif
```

在 uint16 卫星影像上的典型结果（同一景，仅压缩不同）：

| 压缩 | 体积 | 相对 |
|------|------|------|
| LZW | 210 MB | 100% |
| DEFLATE + predictor | 168 MB | 80% |
| ZSTD + predictor | 162 MB | 77% |

ZSTD 体积最小，但解码需要 GDAL ≥ 2.3 与较新的 libtiff。给不确定的下游用，DEFLATE 更保险。

### 5.4.5 校验一个远程 COG

validate 支持 URL，走 /vsicurl/：

```bash
rio cogeo validate --strict \
  "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-2-l2a-assets/2023/5/1/S2B_10TFK_20230501_0_L2A/B04.tif"
```

远程校验会把整个文件的 IFD 与块偏移都读一遍（为检查 offset 顺序），流量不大但请求数不少。对大文件建议先下载再校验，或者接受几十秒的耗时。

## 5.5 参数怎么选

| 场景 | 块 | 压缩 | overview 重采样 | 备注 |
|------|----|------|-----------------|------|
| 卫星多光谱（uint16） | 512 | DEFLATE + PREDICTOR | average | 定量分析必须无损 |
| 展示用 RGB（8 位） | 512 | JPEG 85 或 WEBP 90 | average | 有损，不能用于计算 |
| 分类图 / 掩膜 | 512 | DEFLATE 或 LZW | nearest 或 mode | 不能插值出中间类别 |
| DEM / 高程（float32） | 512 | DEFLATE + FLOATING_POINT | bilinear 或 average | 避免阶梯 |
| 超大镶嵌（> 4 GB） | 512 | DEFLATE | average | 必须 BigTIFF |
| 极小块访问（移动端） | 256 | WEBP | average | 请求数增加，单次更小 |

overview 重采样这一列最容易出错：分类图用 average 会造出“第 3.7 类”这种不存在的值，渲染时颜色错乱。rio-cogeo 的默认值是 nearest，对分类图是对的，对连续值影像则会产生锯齿——所以生产上必须显式指定，不要依赖默认。

## 5.6 排错

| 报错 / 现象 | 原因 | 修法 |
|-------------|------|------|
| The file is greater than 512xH or 512xW, but is not tiled | 源是 strip，且没给 blocksize | 加 --blocksize 512 |
| The offset of the main IFD should be < 300 | 头部元数据过多 | 去掉超长 RPC/XML，或用 --config GDAL_INGESTED_BYTES_AT_OPEN |
| Overviews should be sorted | 先建 overview 后改文件 | 重新生成，不要原地 update |
| Invalid Decimation 1 for overview level 0 | 源自带 1:1 的“overview” | 用 OVERVIEWS=IGNORE_EXISTING 重生成 |
| Nodata/Alpha band will be translated to an internal mask band | JPEG + nodata | 换 DEFLATE，或接受掩膜 |
| PHOTOMETRIC=YCBCR not supported on a 1-band raster | 单波段用了 jpeg profile | 换 deflate，或改成 3 波段 |
| MemoryError | 大图走了内存路径 | 加 --no-in-memory 或 --allow-intermediate-compression |
| Decimation base values greater than 2 require that overview_level is defined | 给了 --decimation-base 3 但没给级数 | 补 --overview-level |

第一条与第三条在实际项目里最高频。第一条的根源是源文件由老工具生成（比如 ArcGIS 导出的 strip TIFF），GDAL 读得动，所以“看起来没问题”；直到上传后瓦片服务变慢才被发现。

第三条的根源是“先 gdaladdo 建金字塔，再用 gdal_edit 改元数据”。gdal_edit 会重写 IFD，导致 overview 的偏移落在主 IFD 之前，validate 直接判 invalid。

## 5.7 生产建议

**把生成与校验做成一个原子步骤。** 生成后立刻 strict 校验，失败就不上传。这样对象存储里永远只有合法 COG，下游不用防御性检查。

```python
def build_and_verify(src: str, dst: str) -> None:
    cog_translate(src, dst, profile, overview_resampling="average", quiet=True)
    valid, errors, _ = cog_validate(dst, strict=True, quiet=True)
    if not valid:
        Path(dst).unlink(missing_ok=True)
        raise RuntimeError(f"COG validation failed: {errors}")
```

**并行度按 CPU 与 IO 平衡。** --threads ALL_CPUS 在单机上跑多进程时会让每个进程都开满线程，互相抢核。批量场景建议每个进程 --threads 4，进程数 = 核数 / 4。

**保留原始文件。** COG 是有损或重编码的产物，一旦发现压缩参数选错、overview 级数不够，需要从原始文件重来。对象存储的成本远低于重新采集的成本。

**记录生成参数。** rio-cogeo 会把 OVERVIEW_RESAMPLING 写进标签，但不会记录块大小与压缩参数之外的东西。建议在 STAC Item 的 asset 上加自定义字段，或者在对象 metadata 里写一份生成清单。第 7 章会给一个把生成参数写进 Item 的例子。

**大文件先切片再转。** 单个 COG 超过 20–30 GB 时，打开文件的头部读取仍然只有几 KB，但校验、重生成、迁移的成本都很高。区域级数据按图幅切分，用 Collection 组织，比一个巨型 COG 更好运维。

## 5.8 本章小结

| 要点 | 结论 |
|------|------|
| 两条路线 | rio-cogeo（可编程，默认 DEFLATE）与 GDAL COG driver（快，默认 LZW） |
| 默认值 | 块 512；BIGTIFF=IF_SAFER；overview 自动算到最小层小于块 |
| 内部流程 | WarpedVRT → 临时文件分块写 → build_overviews → copy 重组布局 |
| 校验 | cog_validate 返回三元组，失败不抛异常；strict 把 warning 当 error |
| 参数选择 | 定量用无损，展示可有损；分类图必须 nearest/mode |
| 常见坑 | strip 源、原地 update 破坏布局、JPEG 不支持 nodata 与 16 位 |

下一章转到对象存储侧：HTTP Range 的语义、206 与 416 的边界、CDN 对 Range 的处理，以及浏览器跨域时那几个必须配的响应头。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第04章-开发环境与工具链搭建/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/STAC-COG-TiTiler/第06章-对象存储与HTTPRange访问/" class="chapter-nav__next">下一章 →</a>
</div>

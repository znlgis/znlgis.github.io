---
layout: default
title: 第07章 - Writers 写入器详解
---

# 第07章 - Writers 写入器详解

## 7.1 writer 决定数据离开 pipeline 时的样子

writer 是 pipeline 的出口，也是**唯一会改变数据物理形态**的 stage。它做三件事：决定容器格式、决定写哪些维度、决定文件头里的元信息（版本、坐标系、scale、压缩）。

这三件事都可能悄悄改坏数据。scale 与 offset 配错，坐标精度就没了；`dataformat_id` 选错，颜色就丢了；`forward` 没给，源文件的头信息全被换成了默认值。本章按“最常用 → 次常用 → 特殊用途”的顺序讲。

## 7.2 writers.las：必须吃透的一个

`writers.las` 是使用率最高的 writer，选项也最多。核心参数：

| 选项 | 默认 | 说明 |
|------|------|------|
| `filename` | 必填 | 输出文件名，可含 `#` 占位符 |
| `minor_version` | **4** | LAS 次版本（1–4）；PDAL 1.0–2.7 默认是 2 |
| `dataformat_id` | **7** | point format，默认 7 需要 LAS 1.4 |
| `compression` | false | `true` 输出 LAZ |
| `scale_x/y/z` | **.01** | 坐标缩放；可写 `auto` |
| `offset_x/y/z` | **0** | 坐标偏移；可写 `auto` |
| `a_srs` | 无 | 写入文件的坐标系（EPSG 或 WKT） |
| `forward` | 无 | 从源 LAS 继承头字段（详见下） |
| `extra_dims` | 无 | 额外维度列表，`all` 表示全部 |
| `pdal_metadata` | false | 把 metadata 与 pipeline 写成 VLR |
| `vlrs` | 无 | 以 JSON 追加自定义 VLR |
| `discard_high_return_numbers` | false | 丢弃超出 point format 上限的回波号 |
| `filesource_id` | 0 | File Source ID |
| `system_id` | “PDAL” | 生成系统字符串 |
| `software_id` | PDAL 版本号 | 生成软件字符串 |
| `creation_doy` / `creation_year` | 无 | 创建日期 |
| `global_encoding` | 0 | 全局编码标志；1.4 输出恒置 bit 4 |
| `project_id` | 全零 UID | 项目 UUID |

`minor_version` 与 `dataformat_id` 的组合是最容易出错的地方。默认值 4 + 7 意味着：**不写任何选项时，你得到的是 LAS 1.4 + point format 7（带 GPS 时间与 RGB）**。很多老软件读不了 1.4，兼容性要求下必须显式降级：

```json
[
    "input.laz",
    {
        "type": "writers.las",
        "filename": "legacy.las",
        "minor_version": 2,
        "dataformat_id": 3,
        "compression": false
    }
]
```

`minor_version: 2` 时 point format 只能取 0–5，写 7 会触发 `LAS version '1.2' only supports point formats 0-5.`。

### 7.2.1 scale 与 offset：精度就藏在这六个数字里

公式第 2 章讲过，这里说选值策略。默认 `scale = .01` 是**厘米级**，适合投影坐标下的地形数据。三类例外：

| 场景 | scale 建议 | 原因 |
|------|-----------|------|
| 投影坐标（UTM 等） | 0.01 或 0.001 | 厘米/毫米精度，够用且省字节 |
| 地理坐标（经纬度） | 1e-7 | 1e-7 度约 1.1 cm；用 0.01 会退化成公里级 |
| 超高精度扫描 | 1e-5 以下 | 视仪器标称精度而定 |

`offset` 用 `auto` 基本总是对的：它把偏移设成该维度的最小值，从而让 int32 存盘值落在 0 附近，避免溢出。

```json
[
    "input.laz",
    {
        "type": "writers.las",
        "filename": "out.las",
        "scale_x": 0.001,
        "scale_y": 0.001,
        "scale_z": 0.001,
        "offset_x": "auto",
        "offset_y": "auto",
        "offset_z": "auto"
    }
]
```

### 7.2.2 forward：继承源文件头

`forward` 是转格式时最该用的选项。它接受一组字段名：

`major_version`、`minor_version`、`dataformat_id`、`filesource_id`、`global_encoding`、`project_id`、`system_id`、`software_id`、`creation_doy`、`creation_year`、`scale_x/y/z`、`offset_x/y/z`

还有三个特殊值：

- `header`：除 scale/offset 外的全部头字段；
- `scale`、`offset`：分别转发缩放与偏移组；
- `all`：等价于 `header` + `scale` + `offset` + `vlr`；
- `vlr`：转发 VLR。

```json
[
    "input.las",
    {
        "type": "writers.las",
        "filename": "copy.laz",
        "compression": "true",
        "forward": "all"
    }
]
```

两个限制必须知道：

1. **显式写的选项优先于转发值。** 所以 `forward: "all"` 与 `"minor_version": 2` 并存时，输出版本是 2。
2. **多源合并时，不一致的头字段会被丢弃并退回默认值。** 三份 LAS 的 scale 各不相同，`forward: "scale"` 就拿不到一致值，只能用默认 `.01`。

VLR 转发的排除名单（文档写明）：`LASF_Projection`、`liblas`、`laszip encoded` 三个 user_id 的 VLR **不转发**；`LASF_Spec` 中除 record_id 0 和 3 之外的也不转发。这些是格式描述性 VLR，PDAL 会自己重建。

### 7.2.3 extra_dims 与 VLR

要写 LAS 标准字段之外的属性，必须用 `extra_dims`：

```json
[
    "input.laz",
    {
        "type": "filters.ferry",
        "dimensions": "=>ScanAngle"
    },
    {
        "type": "writers.las",
        "filename": "out.las",
        "extra_dims": "ScanAngle=float"
    }
]
```

给它 `"all"` 会把所有放不进标准 point record 的维度都写进去。加 `--verbose=Info` 跑一遍能看到实际写了哪些维度、什么类型、什么顺序。

自定义 VLR 用 `vlrs`，支持三种数据来源（直接给 base64 `data`、给 `filename`、或用 `metadata` 引用某个元数据键）：

```json
[
    "input.las",
    {
        "type": "writers.las",
        "filename": "out.las",
        "vlrs": [{
            "description": "自定义记录",
            "record_id": 42,
            "user_id": "myorg",
            "data": "dGhpcyBpcyBzb21lIHRleHQ="
        }]
    }
]
```

`description` 上限 32 字节，超了会被截断。

## 7.3 writers.gdal：从点云到栅格

这是 PDAL 里最“GIS”的 writer：把点云插值成栅格（DEM、DSM、强度图、覆盖计数图）。

```json
[
    "ground.laz",
    {
        "type": "writers.gdal",
        "filename": "dem.tif",
        "resolution": 1.0,
        "output_type": "min",
        "gdaldriver": "GTiff",
        "dimension": "Z"
    }
]
```

### 7.3.1 六个统计量对应六个波段

`output_type` 决定写几个波段，默认 `all`：

| 值 | 波段内容 |
|----|---------|
| `min` | 邻域内点的最小值 |
| `max` | 最大值 |
| `mean` | 平均值 |
| `idw` | Shepard 反距离加权值 |
| `count` | 落入邻域的点数 |
| `stdev` | 总体标准差 |
| `all` | 以上六个全部（默认） |

所以**不写 `output_type` 会得到一个 6 波段 TIFF**，而不是单波段 DEM。做 DEM 时必须显式指定：

```bash
# 地面点做 DEM 用 min 最保守（避免被地物拉高）
pdal pipeline dem.json --writers.gdal.output_type=min
```

`p<i>` 形式还能写百分位波段，例如 `output_type: "p5,p50,p95"`；百分位只在 `binmode: true` 时生效。

### 7.3.2 插值半径与分辨率的耦合

`resolution` 是像元边长，**必填**。`radius` 是参与计算的点到像元中心的最大距离，默认值是 `resolution × √2`：

| 选项 | 默认 | 说明 |
|------|------|------|
| `resolution` | **必填** | 像元边长，X/Y 单位 |
| `radius` | resolution × √2 | 参与插值的半径 |
| `power` | 1.0 | IDW 的距离指数 |
| `window_size` | 0 | 空像元的补救插值窗口（1 = 3×3，2 = 5×5） |
| `nodata` | 视类型 | 默认 double/float/int/short 用 -9999，unsigned 用 9999，uchar 用 255 |
| `output_type` | `all` | 输出哪些统计波段 |
| `binmode` | false | true 时只用像元内的点，不做距离插值 |
| `data_type` | 视驱动 | 输出栅格的数据类型 |
| `gdaldriver` | `GTiff` | GDAL 驱动名 |
| `gdalopts` | 无 | 传给驱动的 `NAME=VALUE` |
| `dimension` | `Z` | 用哪个维度做插值 |
| `bounds` / `origin_x` / `origin_y` / `width` / `height` | 无 | 显式控制栅格范围 |
| `override_srs` / `default_srs` | 无 | 坐标系覆盖 / 补位 |
| `metadata` | 无 | 写入 GDAL 元数据 |
| `pdal_metadata` | false | 把 pipeline 与 metadata 写成 base64 元数据 |
| `allow_empty` | false | 无点也允许写出空栅格 |

`radius` 默认值有个陷阱，文档专门点出来了：当圆的半径覆盖不了整个像元时，**有些点根本不会被考虑**，哪怕它落在像元内部。分辨率越小、点越稀，这个问题越明显。稳妥做法是把 `radius` 显式设成不小于 `resolution × √2`，或者在点云密集时用 `binmode: true`。

### 7.3.3 空像元怎么补

默认 `window_size = 0`，即不补。空像元直接写 `nodata`。设成 1 会用周围 3×3 的非空像元做反距离加权；2 是 5×5，依次类推。

```json
{
    "type": "writers.gdal",
    "filename": "dem_filled.tif",
    "resolution": 1.0,
    "output_type": "min",
    "window_size": 3,
    "nodata": -9999
}
```

**`window_size` 不宜开大。** 它本质是给空洞做插值，窗口越大越容易把远处地形特征带进来，在不连续区域（悬崖、建筑边缘）制造假地形。要填洞，正规做法是回点云里看为什么没有点。

## 7.4 writers.copc：给海量数据做服务化封装

COPC 是“能被 HTTP Range 读”的 LAZ 1.4。写它比写 LAS 慢，因为要先按八叉树重排点。

```json
[
    "sorted.laz",
    {
        "type": "writers.copc",
        "filename": "cloud.copc.laz",
        "threads": 10,
        "forward": "all"
    }
]
```

| 选项 | 默认 | 说明 |
|------|------|------|
| `filename` | 必填 | 输出 COPC 文件 |
| `threads` | 10 | 写入线程数 |
| `scale_x/y/z` | .01 | 与 writers.las 相同 |
| `offset_x/y/z` | 0 | 可设 `auto` |
| `forward` | 无 | 继承头字段与 VLR |
| `extra_dims` | 无 | 额外维度 |
| `a_srs` | 无 | 坐标系 |
| `pdal_metadata` | false | 写 metadata VLR |
| `pipeline` | 无 | 把 pipeline JSON 写成 VLR |
| `vlrs` | 无 | 自定义 VLR |

写之前先排序是常见做法：

```bash
pdal sort cloud.laz sorted.laz && pdal translate sorted.laz out.copc.laz -w writers.copc
```

`forward` 的字段列表比 `writers.las` 少一个 `dataformat_id`（COPC 固定 LAS 1.4），VLR 排除规则相同。

## 7.5 writers.text：调试与交付

文本 writer 有两个用途：调试点、给非 GIS 系统供数。

| 选项 | 默认 | 说明 |
|------|------|------|
| `filename` | 必填 | 文件路径，`"STDOUT"` 表示标准输出 |
| `format` | `csv` | `csv` 或 `geojson` |
| `precision` | 3 | 小数位数 |
| `order` | 无 | 输出列顺序，可逐列指定精度：`"X:3,Y:5,Z:0"` |
| `keep_unspecified` | true | 是否输出未在 `order` 里列出的维度 |
| `write_header` | true | 是否写表头 |
| `quote_header` | true | CSV 表头是否加引号 |
| `delimiter` | `,` | CSV 分隔符 |
| `newline` | `\n` | 换行符（Windows 常用 `\r\n`） |
| `jscallback` | 无 | GeoJSON 时用函数包裹输出 |

调试时最有用的是 `format: "csv"` + `keep_unspecified: true`：一次看到所有维度，比逐个 `pdal info` 快。

```json
[
    "input.las",
    {
        "type": "writers.text",
        "filename": "debug.csv",
        "order": "X:3,Y:3,Z:3,Classification,Intensity",
        "keep_unspecified": false,
        "precision": 2
    }
]
```

`keep_unspecified: false` 是关键：默认 true 会把所有维度都写上，列数可能上百，反而看不清。

## 7.6 其他 writer 速查

| writer | 用途 | 关键选项 |
|--------|------|---------|
| `writers.null` | 丢弃输出，只要副作用 | 无（所有选项被忽略） |
| `writers.raster` | 写 filter 已生成的栅格 | `rasters`（波段名列表）、`nodata`、`gdaldriver` |
| `writers.ogr` | 输出矢量点/多点 | `ogrdriver`、`multicount`（默认 1）、`measure_dim`、`attr_dims` |
| `writers.ply` | PLY 点/mesh | `storage_mode`（ascii/little endian/big endian）、`faces`、`dims` |
| `writers.pcd` | PCL 互通 | ASCII/binary/压缩 |
| `writers.bpf` | NGA BPF v3 | 不如 LAS 常用 |
| `writers.ept_addon` | 给 EPT 追加维度 | 与 Entwine 配合 |

`writers.null` 值得单独提一句：它不是“没用”，而是**只要副作用**的写法。比如用 `filters.hexbin` 生成轮廓文件、用 `pdal_metadata` 导出元数据，都不需要输出点云：

```json
[
    "input.las",
    {
        "type": "filters.hexbin",
        "boundary": "hull.geojson"
    },
    "writers.null"
]
```

注意最后一行不能简写成字符串：读者靠扩展名推断 driver，而 `writers.null` 没有对应扩展名，必须显式写成 `{"type": "writers.null"}`。

## 7.7 多输出：# 占位符与多 writer 串联

第 5、6 章已从 pipeline 角度讲过 `#`，这里补 writer 侧的细节。

`writers.las`、`writers.copc` 之外的多数 writer 都支持 `filename` 里的单个 `#`：

```json
[
    "input.laz",
    { "type": "filters.splitter", "length": 500 },
    "tiles/tile_#.las"
]
```

规则在 `writers.las` 文档里写得很明确：

- 输入是多个 PointView 且文件名含 `#` → 每个 view 写一个文件，`#` 替换成从 1 开始递增的整数；
- 输入是多个 PointView 但文件名**不含** `#` → 所有 view 聚合成一个文件；
- 只有一个 PointView → 正常写一个文件。

第二条规定是最容易“看起来正常、其实错了”的场景：本来想切 20 个瓦片，结果只得到 1 个合并文件，数据没丢，但瓦片结构没了。

想一个 pipeline 出两种格式，就串两个 writer：

```json
[
    "input.laz",
    { "type": "filters.range", "limits": "Classification[2:2]" },
    { "type": "writers.las", "filename": "ground.laz", "compression": "true" },
    { "type": "writers.gdal", "filename": "dem.tif", "resolution": 1.0, "output_type": "min" }
]
```

这是文档认可的形态（`Writer → Writer`）。但**不能分叉**：两个 writer 各自接同一个 filter 的写法会触发 “Pipeline has multiple leaf nodes”，只有第一个分支会执行。

## 7.8 排错

| 现象 | 原因 | 处理 |
|------|------|------|
| `LAS version '1.2' only supports point formats 0-5.` | 版本与 point format 不匹配 | 升 `minor_version` 到 4，或降 `dataformat_id` |
| 输出文件打不开 / 其他软件报错 | 1.4 与老软件不兼容 | 显式 `minor_version: 2`、`dataformat_id: 3` |
| 颜色丢了 | point format 不含 RGB（0/1/6） | 用 2/3/7/8 |
| 坐标只剩厘米/公里级精度 | scale 与坐标系不匹配 | 投影坐标 0.01/0.001，地理坐标 1e-7 |
| 坐标溢出或整体偏移 | `offset` 没设 | `offset_*: "auto"` |
| 输出 DEM 是 6 波段 | 没写 `output_type` | 显式 `output_type: "min"` |
| DEM 有大片 nodata | 点太稀或 `radius` 太小 | 调大 `radius`，或 `window_size` 补洞 |
| DEM 出现不真实的台阶 | `window_size` 太大，跨地形插值 | 调小 `window_size`，优先补点云空洞 |
| `forward` 没生效 | 多源头字段不一致 | 显式写目标头字段，别依赖转发 |
| extra dims 写了但读不回来 | 1.0–1.3 文件需 `use_eb_vlr` | 读侧加 `"use_eb_vlr": true` |
| 瓦片没分开 | 文件名缺 `#` | 加占位符 |
| `writers.null` 报无法推断 writer | 用了字符串形式 | 显式写 `{"type": "writers.null"}` |

其中前两条最值得留意。默认 1.4 + format 7 对现代工具链没问题，但项目一旦要交付给只用老版本 ArcGIS 或某些国产软件的甲方，就必须降级。降级会连带丢 NIR、丢 15 次回波表达、可能丢分类码，**要让需求方确认能接受哪些损失**，别默默转换。

## 7.9 生产建议

**写侧参数写全，不依赖默认值。** `minor_version`、`dataformat_id`、`scale_*`、`offset_*` 四项在每条生产 pipeline 里都显式写。默认值会随 PDAL 版本变，写全了才能保证半年后重跑结果一致。

**转格式一律带 `forward`。** 至少要 `forward: "scale"`，否则坐标精度会在每次转换中被重新量化一遍。

**DEM 生产链路固定为：分类 → 抽地面 → min 插值。** 顺序错了结果就不可比：

```json
[
    "input.laz",
    { "type": "filters.smrf" },
    { "type": "filters.expression", "expression": "Classification == 2" },
    { "type": "writers.gdal", "filename": "dem.tif", "resolution": 1.0, "output_type": "min" }
]
```

**归档用 LAZ，发布用 COPC，交付用 LAS。** 三种目的不同：LAZ 省空间、COPC 支持按需取块、LAS 兼容性最好。别用同一个文件应付三种场景。

**打开 `pdal_metadata`。** 尤其是交付给外部单位的成果数据，VLR 里带着处理历史，能省掉大量扯皮。

## 7.10 小结

| 主题 | 关键事实 |
|------|---------|
| writers.las 默认 | `minor_version=4`、`dataformat_id=7`、`scale=.01`、`offset=0`、不压缩 |
| 兼容性降级 | 1.2 + format 3 最通用；1.4 才能用 6/7/8 |
| scale 选择 | 投影 0.01/0.001；地理 1e-7；`offset: auto` 防溢出 |
| forward | 继承头字段与 VLR；显式选项优先；多源不一致时退回默认 |
| extra_dims | `<name>=<type>` 或 `all`；写 extra bytes VLR（`LASF_Spec`/4） |
| writers.gdal | `resolution` 必填；`output_type` 默认 `all`（6 波段）；`radius` 默认 `resolution×√2` |
| writers.gdal 补洞 | `window_size` 默认 0；1 = 3×3，2 = 5×5；开大易造假地形 |
| writers.copc | LAS 1.4 固定；`threads` 默认 10；先 sort 再写 |
| writers.text | `format` 默认 csv，`precision` 默认 3，`keep_unspecified` 默认 true |
| 多输出 | `#` 占位符逐 view 写；无 `#` 则聚合；writer 只能串联不能分叉 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第06章-Readers读取器详解/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第08章-几何裁剪与重投影过滤器/" class="chapter-nav__next">下一章 →</a>
</div>

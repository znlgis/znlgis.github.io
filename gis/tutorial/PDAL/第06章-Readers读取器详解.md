---
layout: default
title: 第06章 - Readers 读取器详解
---

# 第06章 - Readers 读取器详解

## 6.1 reader 决定了 pipeline 的一切起点

一条 pipeline 里最不该被低估的 stage 是 reader。它不是“打开文件”那么简单，而是**声明 schema**：这条 pipeline 全程能操作哪些 dimension、每个 dimension 是什么类型，全部由 reader 在 prepare 阶段注册决定。

这解释了一类很常见的疑问：“为什么 `filters.assign` 里给 `Intensity` 赋值有效，给 `NIR` 赋值报错？”因为源文件的 point format 里没有 NIR，reader 就没注册这个维度。想加维度得用 `filters.ferry` 先创建。

2.10.0 提供 38 个 reader 文档页，但实际可用数取决于编译选项（见第 3 章）。日常用得最多的是六七个：`readers.las`、`readers.copc`、`readers.ept`、`readers.text`、`readers.gdal`、`readers.faux`。

## 6.2 所有 reader 共享的三个选项

`reader_opts.md` 定义了每个 reader 都会带上的选项：

| 选项 | 默认 | 说明 |
|------|------|------|
| `count` | 不限制 | 最多读多少点 |
| `override_srs` | 无 | 强制覆盖数据自带的 SRS |
| `default_srs` | 无 | 仅在数据没有 SRS 时套用 |

`override_srs` 与 `default_srs` **互斥**，同时写会报错。区别值得划清：

- 文件里 SRS 是错的（或者你确定它是错的）→ 用 `override_srs` 强行改；
- 文件里根本没有 SRS → 用 `default_srs` 补一个；
- 分不清就先用 `pdal info --summary` 看 `srs` 段是否存在。

`count` 在调试时非常有用：先用 `"count": 10000` 跑通整条 pipeline，再放开到全量。它比 `filters.head` 更早生效，能省掉不必要的 I/O。

## 6.3 readers.las：主力 reader

`readers.las` 同时吃 `.las` 与 `.laz`，支持 LAS 1.0–1.4，**不支持含波形的 point format 4/5/9/10**（源码 `pointFormatSupported()` 里明确报错）。

完整选项（来自 `doc/stages/readers.las.md`）：

| 选项 | 默认 | 说明 |
|------|------|------|
| `filename` | 必填 | LAS/LAZ 文件，支持远程 URL |
| `count` | 不限制 | 最多读取点数 |
| `start` | 0 | 起始点索引（0 基） |
| `override_srs` / `default_srs` | 无 | 坐标系覆盖 / 补位 |
| `extra_dims` | 无 | 手动声明额外维度，**覆盖 extra bytes VLR** |
| `use_eb_vlr` | false | 1.0–1.3 文件是否解析 extra bytes VLR |
| `fix_dims` | true | 非法维度名中的字符换成下划线 |
| `nosrs` | false | 不读 SRS VLR |
| `ignore_vlr` | 无 | `userid/record_id` 列表，跳过指定 VLR |
| `ignore_missing_vlrs` | false | 缺失的 VLR 不抛异常 |
| `threads` | 7 | LAZ chunk table 解码线程数 |
| `compression` | — | 已废弃，不要用 |

`start` + `count` 的组合可以拿来分页读大文件：

```json
[
    {
        "type": "readers.las",
        "filename": "big.laz",
        "start": 0,
        "count": 1000000
    },
    "chunk1.las"
]
```

注意 `start` 是**点索引**，不是字节偏移。对 LAZ 来说跳到第 N 个点仍要解压前面的 chunk table，所以分页读 LAZ 的性能收益远小于读未压缩 LAS。真要并行处理大 LAZ，用 `filters.splitter` 或直接上 COPC/EPT。

### 6.3.1 extra bytes 的两个开关

这是 LAS 章节里最实用的一组开关，值得重复一遍：

```json
[
    {
        "type": "readers.las",
        "filename": "legacy-1.2.las",
        "use_eb_vlr": true
    },
    { "type": "writers.text", "filename": "dump.csv" }
]
```

不加 `use_eb_vlr`，1.2 文件里 extra bytes VLR 描述的属性连同数据一起被忽略——文件里明明有，读出来就是没有，且不报错。这是排查“字段丢失”问题时的第一个检查点。

而 `extra_dims` 是手动接管：格式 `<name>=<type>`，多个用逗号分隔。它优先级高于 VLR，甚至可以覆盖 VLR 里的类型定义。用它的场景是文件里的 VLR 损坏或写错了类型。

## 6.4 readers.copc 与 readers.ept：远程与降采样

这两个 reader 的共同点是**不把整个文件拉下来**。COPC 用 HTTP Range 按八叉树块取，EPT 按 `ept.json` 里的层级取。

```json
[
    {
        "type": "readers.copc",
        "filename": "https://example.com/data/cloud.copc.laz",
        "bounds": "([500000,501000],[4000000,4001000])",
        "resolution": 0.5
    },
    "clip.las"
]
```

关键选项对比：

| 选项 | COPC | EPT | 说明 |
|------|------|-----|------|
| `bounds` | 有 | 有 | 2D/3D 范围过滤，在取块阶段生效 |
| `polygon` | 有 | 有 | WKT 多边形，可多个；COPC 多个合成 multipolygon |
| `resolution` | 有 | 有 | 选金字塔层级；单位与数据一致 |
| `requests` | 15 | 15（最小 4） | 并发请求数 |
| `keep_alive` | 10 | — | 内存中保持活跃的 chunk 数 |
| `origin` | — | 有 | 按原始文件名/OriginId 取单个源文件 |
| `header` / `query` | 有 | — | 远程端点的 HTTP 头与查询参数 |
| `vlr` | false | — | 是否把 VLR 导入元数据 |

`requests` 的默认值 15 有个坑：文档直说了“更多不一定更好”，网络比处理快时会堆积内存。带宽充足的专线上把它调到 32–64 有用；走公网时保持默认甚至调低到 4–8 更稳。

`resolution` 是这两个 reader 最实用的参数。米制坐标下 `resolution = 0.1` 表示取到约每平方米 100 点。它选的是**至少这么精细的最粗层级**，结果可能比要求更密，但绝不会更稀。

`readers.ept` 还有一条 `origin`，能按源文件名（支持子串，但必须唯一命中）取出单个文件对应的点。做质检、比对原始分幅时很有用。

## 6.5 readers.text：把 CSV 当点云读

文本是最容易拿到的格式，也是最容易读错的格式。`readers.text` 的规则很苛刻，值得逐条说清。

**第一行必须是表头。** 表头有两种写法：

- 以双引号开头：每个维度名被引号包围，引号之间是单个分隔符（默认空格）；
- 不以引号开头：第一个非字母数字字符被当作分隔符。

**维度名只能是字母与下划线。** PDAL 的维度名有这个限制，`X(m)`、`coord-x` 这类列名会被判非法。解决办法是用 `header` 选项直接给一套合法表头：

```json
[
    {
        "type": "readers.text",
        "filename": "points.xyz",
        "header": "X,Y,Z,Intensity,Classification",
        "skip": 5,
        "separator": ","
    },
    "out.las"
]
```

| 选项 | 默认 | 说明 |
|------|------|------|
| `filename` | 必填 | 文件路径；写 `"STDIN"` 可读标准输入 |
| `header` | 无 | 直接指定表头，此时文件全部行都当数据 |
| `separator` | 由表头推断 | 强制指定分隔符 |
| `skip` | 0 | 跳过开头若干行 |
| `count` | 不限制 | 最多读多少点 |

`header` 与 `skip` 配合是处理“带注释头 CSV”的标准组合：`skip` 跳过原文件的若干行说明，`header` 给出规范列名。

读标准输入的做法：

```bash
cat cloud.csv | pdal translate -i STDIN -o out.las -r readers.text \
    --readers.text.header="X,Y,Z"
```

坐标缺 Z 是常见情况，此时 Z 会被填 0（维度不存在时的默认值）。要用已有列补 Z，用 `filters.ferry` + `filters.assign`。

## 6.6 readers.gdal：把栅格拆成点

方向与 `writers.gdal` 相反：读一个栅格，每个像素变成一个点，X/Y 是像元中心坐标，各波段成为 `band-1`、`band-2`…

| 选项 | 默认 | 说明 |
|------|------|------|
| `filename` | 必填 | 任何 GDAL 可打开的栅格 |
| `header` | 无 | 逗号分隔的维度名列表，把波段映射到标准维度，长度必须等于波段数 |
| `memorycopy` | false | 用 GDAL MEM 驱动把整个栅格读进内存 |
| `gdalopts` | 无 | 传给 GDAL 驱动的 `NAME=VALUE` 列表 |

最典型的用法是给点云上色：

```json
[
    {
        "type": "readers.gdal",
        "filename": "ortho.tif",
        "header": "Red, Green, Blue"
    },
    "ortho.las"
]
```

注意这里读出来的是**栅格像素点**，不是原有点云。要把它贴回点云，得配合 `filters.colorization`（按坐标取值）。

两个性能提示：`memorycopy` 对大栅格能显著提速，但会把整幅栅格放进内存，几十 GB 的影像别开；官方文档专门提醒这个 reader 对 GDAL 缓存敏感，调 `GDAL_CACHEMAX`（单位 MB）往往比换机器有效。

## 6.7 其他 reader 速查

| reader | 格式 | 要点 |
|--------|------|------|
| `readers.faux` | 无文件 | 合成数据，`mode` 必填：constant/random/ramp/uniform/normal/grid |
| `readers.ply` | PLY | ASCII 与二进制都支持，可读 mesh 的顶点 |
| `readers.pcd` | PCD | PCL 的格式，与 PCL 互通 |
| `readers.bpf` | BPF | NGA 规范，v1–v3；只支持 Zlib 压缩，不支持已废弃的 QuickLZ/FastLZ |
| `readers.tindex` | 索引 + 多文件 | 用 `tindex` 生成的索引批量取数，支持 SQL 过滤 |
| `readers.e57` | E57 | 只支持笛卡尔坐标点云；一个文件含多个点云时全部读出并合并 |
| `readers.obj` | OBJ | 点 + mesh |
| `readers.numpy` | 内存 | 只用于 API/Python 场景，从 NumPy 数组读 |

`readers.faux` 值得单独说：它是**唯一不依赖外部数据的 reader**，做 pipeline 冒烟测试最合适。六个模式里 `ramp` 与 `constant` 是确定性的，`uniform`/`normal` 需要显式 `seed` 才可复现（不设时用当前时间做种）。

```json
[
    { "type": "readers.faux", "mode": "constant", "bounds": "([0,0],[0,0],[100,100])", "count": 1000 },
    { "type": "filters.assign", "value": "Classification = 2" },
    "flat.las"
]
```

`readers.tindex` 的选项比其他 reader 复杂得多：`lyr_name`、`srs_column`、`tindex_name`（默认 `location`）、`sql`、`bounds`、`wkt`、`ogr`、`t_srs`（默认 `EPSG:4326`）、`filter_srs`（默认 `EPSG:4326`）、`where`、`dialect`。其中 `t_srs` 与 `filter_srs` 的默认值是地理坐标，数据是投影坐标时**必须显式改**，否则范围过滤会落在错误的位置。

## 6.8 多 reader 与 glob

几个 reader 并列出现时，它们全部进入默认输入列表，下游 filter/writer 拿到的是多份输入：

```json
[
    "a.las",
    "b.las",
    "c.las",
    { "type": "filters.merge" },
    "merged.laz"
]
```

前三行字符串都在 reader 位置（首位或非末位），因此都是 reader。`filters.merge` 没有 `inputs`，消费默认列表里的三个 reader，合并成一份。

更短的写法用 glob：

```json
[
    "/data/tiles/*.laz",
    { "type": "filters.merge" },
    "merged.laz"
]
```

一个通配字符串会被展开成多个 reader（第 5 章 5.3 节讲过）。注意 glob 只在 pipeline 文件里生效，命令行传文件名不会展开。

多 reader 场景有一个硬约束：**它们的维度集合可以不同，但后续 stage 只能用交集**。一个 LAS 有 RGB、另一个没有，那么 `writers.las` 想写 RGB 就会得到 0 值——不会报错，只会静默填充。

## 6.9 排错

| 现象 | 原因 | 处理 |
|------|------|------|
| `PDAL does not support point formats with waveform data (4, 5, 9 and 10)` | 文件是波形 LAS | 先转换去波形（转 LAS 1.2 格式 1/3），或用专门工具 |
| `LAS version '1.2' only supports point formats 0-5.` | 版本与格式不匹配 | 写侧用 `minor_version` 升到 4 |
| 读出来少了若干字段 | 1.0–1.3 的 extra bytes VLR 未启用 | 加 `"use_eb_vlr": true` |
| 维度名带奇怪字符 | 非法字符被 `fix_dims` 替换了下划线 | 关掉 `fix_dims` 或改列名 |
| SRS 是空的 | 文件无 SRS，或 `nosrs` 被打开 | `default_srs` 补一个 |
| `readers.text` 报维度名非法 | 表头含非字母数字字符 | 用 `header` 指定合法表头 |
| 远程 COPC 读得极慢 | `requests` 过高导致内存抖动，或带宽不足 | 降到 4–8 试 |
| `readers.tindex` 范围过滤无效 | `t_srs`/`filter_srs` 默认地理坐标 | 显式设成数据坐标系 |

## 6.10 生产建议

**reader 少而稳。** 一条 pipeline 里 reader 越少越好，多种格式先统一成 LAS/LAZ 或 COPC，再做后续处理。reader 是唯一与“外部世界”耦合的地方，把它隔离出来，其余 stage 就可以稳定复用。

**远程读优先进 COPC。** EPT 适合“整库按范围取”，COPC 适合“单文件按块取”。两者都比“先下载整份再裁”快一个数量级。

**给 reader 显式 `override_srs`。** 数据来源混杂时，SRS 常常缺失或错误。在 reader 上钉死坐标系，比在下游补救便宜。

**读懂 schema 再写 filter。** 用 `pdal info --schema` 看这条 pipeline 能操作哪些维度，比读三页文档快。

**`count` 做灰度发布。** 新 pipeline 上线前先用 `"count": 100000` 跑一遍，验证逻辑正确，再放开全量。

## 6.11 小结

| 主题 | 关键事实 |
|------|---------|
| 作用 | reader 注册 schema，决定 pipeline 全程能操作哪些维度 |
| 通用选项 | `count`、`override_srs`、`default_srs`（后两者互斥） |
| las | LAS 1.0–1.4，不支持波形 4/5/9/10；`start`/`count`/`use_eb_vlr`/`threads`(7) |
| copc/ept | 远程按块读；`bounds`/`polygon`/`resolution`；`requests` 默认 15（EPT 最小 4） |
| text | 首行必须是表头；维度名只能字母下划线；`header`/`separator`/`skip` |
| gdal | 栅格转点；`header` 映射波段；`memorycopy` 换内存；受 `GDAL_CACHEMAX` 影响 |
| 多 reader | 并列即多输入；下游只能用维度交集，缺的维度静默填 0 |
| glob | 只在 pipeline 文件内展开，命令行不展开 |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第05章-PipelineJSON与Stage模型/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第07章-Writers写入器详解/" class="chapter-nav__next">下一章 →</a>
</div>

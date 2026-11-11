---
layout: default
title: 第02章 - 点云数据模型与 LAS/LAZ 格式
---

# 第02章 - 点云数据模型与 LAS/LAZ 格式

## 2.1 为什么点云需要专用容器

先用一个具体数字感受问题规模。一景机载 LiDAR 数据约 1–5 亿个点，每个点至少带 XYZ、强度、回波号、分类、GPS 时间。如果存成 CSV：

- 一行约 60 字节，1 亿点 ≈ 6 GB；
- 全精度浮点文本解析，C++ 读一遍要几分钟；
- 没有类型信息、没有空间范围、没有坐标系，一切靠约定。

LAS 用固定长度的二进制记录解决前三条：每点定长、字段偏移固定、文件头里写明范围与坐标系。代价是**字段集合被标准锁死**——LAS 1.0 到 1.4 只定义了 11 种 point format（0–10），想多存一个属性就得用 extra bytes VLR 绕出去。

PDAL 的定位正是夹在这两层之间：对外支持几十种容器（LAS、LAZ、COPC、BPF、PCD、PLY、E57、文本……），对内只有一套 `Dimension` 表。所以读 LAS 得到的维度集合，往往比 LAS 标准字段多——多出来的部分是 extra bytes 和 reader 补的。

## 2.2 LAS 文件的三段结构

```text
┌──────────────────────────────────────────────────────────────┐
│ Public Header Block         LAS 1.2: 227 B / 1.3: 235 B       │
│                             1.4: 375 B                        │
├──────────────────────────────────────────────────────────────┤
│ VLR 1 … VLR n              变长，记录坐标系、extra bytes 等     │
├──────────────────────────────────────────────────────────────┤
│ Point Data Records         每点定长：20 / 26 / 28 / 34 … 67 B  │
├──────────────────────────────────────────────────────────────┤
│ EVLR 1 … EVLR m            仅 LAS 1.4，变长，可存大块元数据     │
└──────────────────────────────────────────────────────────────┘
```

三段头长不是估算，是 LAS 规范常量，也写死在 PDAL 依赖的 laz-perf 里（`vendor/lazperf/header.cpp`）：

```cpp
const size_t header12::Size = 227;
const size_t header13::Size = 235;
const size_t header14::Size = 375;
```

文件头里的关键字段：版本号、point format id、point record length、点数、每回波点数、XYZ 的 scale 与 offset、min/max 范围、文件创建日期、生成软件字符串。**读 LAS 的很多“怪现象”都能追到这几个字段**，比如坐标只剩厘米精度、点数对不上、范围明显偏移。

## 2.3 Point format 0–10：每一档多了什么

LAS 的点格式不是随便编号的，每加一档就是加一组字段。按 LAS 1.4 R14 规范，各格式的记录长度如下：

**表 2-1 LAS point format 与 PDAL 支持情况**

| 格式 | 字节数 | 新增内容 | PDAL 支持 |
|------|-------|---------|----------|
| 0 | 20 | XYZ + 强度 + 回波标志 + 分类 + 扫描角 + 用户数据 + 点源 ID | 是 |
| 1 | 28 | 格式 0 + GPS 时间（double） | 是 |
| 2 | 26 | 格式 0 + RGB（uint16×3） | 是 |
| 3 | 34 | 格式 1 + RGB | 是 |
| 4 | 57 | 格式 1 + 波形包（29 B） | **否** |
| 5 | 63 | 格式 3 + 波形包 | **否** |
| 6 | 30 | XYZ + 强度 + 回波（1 B）+ 分类标志（1 B）+ 分类（1 B）+ 用户数据 + 扫描角 int16 + 点源 ID + GPS 时间 | 是 |
| 7 | 36 | 格式 6 + RGB | 是 |
| 8 | 38 | 格式 7 + 近红外 NIR | 是 |
| 9 | 59 | 格式 6 + 波形包 | **否** |
| 10 | 67 | 格式 8 + 波形包 | **否** |

支持范围在源码里是硬编码的，不是文档口径。`io/LasHeader.cpp` 的 `pointFormatSupported()`：

```text
hasWave()                              → "PDAL does not support point formats with waveform data (4, 5, 9 and 10)"
versionAtLeast(1,4) && format > 10     → "LAS version X only supports point formats 0-10."
!versionAtLeast(1,4) && format > 5     → "LAS version 'X' only supports point formats 0-5."
```

两个结论：**波形点格式一律不支持**（PDAL 没有波形采样能力，这是设计取舍）；**格式 6–10 必须配 LAS 1.4**，1.2 文件里塞格式 7 会被拒。

字节数与 laz-perf 的 `baseCount()` 完全一致——它只对 0/1/2/3/6/7/8 返回尺寸，波形格式返回 0：

```cpp
switch (format & 0xF) {
case 0: return 20;  case 1: return 28;  case 2: return 26;
case 3: return 34;  case 6: return 30;  case 7: return 36;
case 8: return 38;  default: return 0;   // 4/5/9/10 及未定义格式
}
```

`& 0xF` 这步掩码不是多余：LAZ 会把压缩标志塞进格式号的高位，必须剥掉低位以外的位才能认出真实格式。

## 2.4 X/Y/Z 不是浮点数：scale 与 offset

LAS 里坐标存成 **int32**，用文件头中的 scale 与 offset 还原：

```text
存盘值 = (真实值 - offset) / scale
真实值 = 存盘值 * scale + offset
```

而 `writers.las` 的默认值是 `scale = .01`、`offset = 0`（文档明确写的默认值）。`offset` 可以写 `"auto"`，表示取该维度的最小值；`scale` 也可以写 `"auto"`，让存盘值铺满 int32 范围。

精度就由 scale 决定：

- scale = 0.01 → 1 厘米，1:500 地形测量的下限刚好够；
- scale = 0.001 → 1 毫米，适合扫描仪数据；
- scale = 1e-7 → 约 1.1 厘米（赤道处 1 度 ≈ 111 km），这是经纬度写 LAS 的常用值。

这里有个高频事故：**把点云重投影成 EPSG:4326 后直接写 LAS，忘了改 scale**。经度 116.39 用 scale 0.01 存，只能落到 116.39、116.40 这类格子，横向误差以公里计。官方 `filters.reprojection` 文档专门给了一个示例，写地理坐标时用 `scale_x = 0.0000001`、`scale_y = 0.0000001`、scale_z 保留 0.01：

```json
{
    "type": "writers.las",
    "filename": "example-geog.las",
    "scale_x": "0.0000001",
    "scale_y": "0.0000001",
    "scale_z": "0.01",
    "offset_x": "auto",
    "offset_y": "auto",
    "offset_z": "auto"
}
```

int32 的容量上限也决定了 `offset` 什么时候必须设。存盘值是 int32，上限 2147483647。若 X 真值 500000、scale 0.01，存盘值 5×10⁷，安全；但如果偏移量很大（例如地方坐标 8 位数带多余前缀），乘上 scale 就会溢出。此时把 `offset` 设成数据最小 X，把存盘值压回 0 附近，是标准解法——`"auto"` 做的就是这件事。

## 2.5 位域：分类、回波、扫描角

格式 0–5 的一个字节里塞了 8 个 bit 的分类与标志，格式 6–10 才拆成独立字节。这个差异会直接影响分类码上限：

- **格式 0–5**：Classification 占 5 bit（值域 0–31），同字节的高 3 位是 Synthetic / Key-point / Withheld 标志；
- **格式 6–10**：Classification 占完整 1 字节（值域 0–255），标志位挪到下一个字节，另加 Overlap 标志。

所以“LAS 1.4 才能表达 32 以上的分类码”这句话是对的。用地物分类（ASPRS 类码 0–31 是标准类，64 起为重叠点等）时，格式 0–5 够用；要接 32 以上的自定义类码，就必须 1.4 + 格式 6/7/8。

回波字段同样是位域：格式 0–5 用一个字节的低 3 位表示 ReturnNumber、中 3 位表示 NumberOfReturns（上限 7），高 2 位是扫描方向与航带边缘；格式 6–10 把 ReturnNumber 扩到 4 bit（上限 15）。这也是 1.4 文件能表达更多回波次数的原因。

**扫描角**（ScanAngle）在格式 0–5 里是 int8（-90…90），格式 6–10 扩成 int16，单位是 0.006°，能表达 ±30000×0.006°。做几何校正时若发现角度被截断，先看格式。

## 2.6 VLR 与 extra bytes：标准之外的口袋

VLR（Variable Length Record）是 LAS 的扩展槽：每条形如 `{user_id, record_id, length, data}`，紧跟在文件头之后。几个必知的：

| user_id | record_id | 内容 | 由谁处理 |
|---------|-----------|------|---------|
| `LASF_Projection` | 34735 / 34736 / 34737 | GeoKeyDirectory / GeoDouble / GeoAscii，即坐标系 | PDAL 解析成 `SpatialReference` |
| `LASF_Spec` | 4 | Extra Bytes 描述（维度名、类型、缩放） | `readers.las` / `writers.las` |
| `laszip encoded` | 22204 | LAZ 压缩参数 | laz-perf |
| `liblas` | — | 老 libLAS 元数据 | 忽略 |

Extra bytes 在 LAS 1.4 才正式纳入规范，但不少 1.2/1.3 文件也在用。PDAL 的对应开关是 `use_eb_vlr`：

- 读 1.4 文件：自动解析，无需设置；
- 读 1.0–1.3 文件：**默认不解析**，必须显式设 `"use_eb_vlr": true`，否则那些属性根本不出现在结果里。

写侧对应 `writers.las.extra_dims`。设 `"extra_dims": "all"` 会把所有“放不进标准 point record”的维度写进 extra bytes：

```json
[
    "input.las",
    {
        "type": "filters.ferry",
        "dimensions": "=>MyHeight"
    },
    {
        "type": "filters.assign",
        "value": "MyHeight = Z - 100.0"
    },
    {
        "type": "writers.las",
        "filename": "output.las",
        "extra_dims": "all",
        "forward": "all"
    }
]
```

一个反直觉细节：extra bytes VLR 记录的是**名字、类型、顺序**，所以读回来时维度顺序不等于原始列顺序。想确认到底写了什么，加 `--verbose=Info` 跑一遍，PDAL 会打印写出的 extra 维度名称、类型与次序。

两个例外必须记住：

1. **datatype 0 被忽略**。官方原文：LAS 1.4 文件中 datatype 0 的 extra bytes 会被接受，但对应数据被忽略，不会创建 PDAL 维度。
2. **数组类型会被拆开**。datatype 11–20 是二维数组，生成 `Foo0`、`Foo1`；21–30 是三维数组，生成 `Bar0`、`Bar1`、`Bar2`。

## 2.7 LAZ：同一种格式，加一层压缩

LAZ 不是新格式，而是 **LAS 的点记录部分用 LASzip/laz-perf 压缩**的结果：文件头仍是 LAS 头，point data 换成压缩流，压缩参数记录在 `laszip encoded` VLR 里。因此：

- 读：`readers.las` 同时支持 `.las` 与 `.laz`，不用换 reader；
- 写：`writers.las` 加 `"compression": true`，默认值是 `false`。

```json
[
    "input.las",
    {
        "type": "writers.las",
        "filename": "output.laz",
        "compression": "true",
        "forward": "all"
    }
]
```

`compression` 还接受 `"lazperf"`、`"laszip"` 两个历史值，行为等价于 `true`（都走捆进 PDAL 的 laz-perf）。

压缩率没有通用数字，取决于点位分布与维度熵。别照抄“压缩 10 倍”这类说法，用自己的一份数据实测：

```bash
pdal translate in.las out.laz
ls -lh in.las out.laz
```

代价有三条：压缩是 CPU 换 I/O，单线程编译时可能成为瓶颈；LAZ 不能被不认识 LASzip 的老工具读；对 LAS 1.4 + 格式 6–10，LAZ 的兼容面比 1.2 窄。

## 2.8 COPC：空间索引化的 LAZ 1.4

COPC（Cloud Optimized Point Cloud）不是并列的新格式，而是**受约束的 LAZ 1.4**：点记录按八叉树排序成 chunk，再写一个 `copc` 信息 VLR 描述根节点与层级。换来的是 HTTP Range 按块读取——服务器不必把整份文件发过来。

对应 stage 是 `readers.copc` / `writers.copc`，关键选项：

| 选项 | 默认值 | 作用 |
|------|-------|------|
| `requests` | 15 | 并发取块线程数；网络快而处理慢时调小，避免内存堆积 |
| `keep_alive` | 10 | 内存中保持活跃的 chunk 数 |
| `resolution` | 无限制 | 按期望分辨率选金字塔层级，单位与数据一致 |
| `bounds` / `polygon` | 无 | 空间过滤，在取块阶段就生效 |
| `header` / `query` | — | 远程端点的 HTTP 头与查询参数 |

`resolution` 的语义值得单独说：对米制坐标，`resolution = 0.1` 表示取到地面分辨率约每平方米 100 点。实际选中的层级不必然等于该值，而是“至少这么精细的最粗层级”，所以结果可能比要求更密。

## 2.9 读 LAS 的关键选项

`readers.las` 选项不多，但每一个都会改变结果：

| 选项 | 默认值 | 作用与坑 |
|------|-------|---------|
| `filename` | 必填 | 可以是远程 URL，取决于编译时的网络支持 |
| `start` | 0 | 从第几个点开始读（0 基），配合 `count` 取子集 |
| `count` | 不限制 | 最多读多少点 |
| `override_srs` | 无 | 强制覆盖文件里的 SRS |
| `default_srs` | 无 | 仅在文件没有 SRS 时套用；与 `override_srs` 互斥 |
| `extra_dims` | 无 | 手动声明额外维度，**会覆盖 extra bytes VLR** |
| `use_eb_vlr` | false | 1.0–1.3 文件是否解析 extra bytes VLR |
| `fix_dims` | true | 把非法维度名中的字符换成下划线 |
| `nosrs` | false | 不读 SRS VLR，用于规避 SRS 解析性能问题 |
| `ignore_vlr` | 无 | `userid/record_id` 列表，跳过指定 VLR |
| `threads` | 7 | LAZ chunk table 解码线程数 |

`extra_dims` 的优先级要记牢：文档明确写了它会覆盖 extra bytes VLR，即使同时设了 `use_eb_vlr`。两者都设时以 `extra_dims` 为准。

## 2.10 踩坑清单

**坑一：点数对不上。** 先用 `pdal info --summary` 看 `num_points`，再与 lasinfo、QGIS 对。常见来源：文件头点数与实际点数不一致（文件被截断）、`count`/`start` 选项、上游 filter 去掉了点。LAS 1.4 同时有 legacy 与 extended 两套计数，只读 legacy 的老工具在大文件上会饱和。

**坑二：坐标差一大截。** 先查 SRS 是否读出来（`pdal info --metadata` 里的 `srs` 段），再查 scale/offset。典型组合错误是数据本身为 UTM，而文件里写的是地理坐标。

**坑三：分类全是 0 或 1。** 若上游只写了 5 bit 的 Classification，标志位会丢；另一种情况是管道里的 `filters.range` 把目标类滤掉了。用 `pdal info --stats --dimensions Classification` 看分布最快。

**坑四：写出的 LAS 打不开。** 多数是 point format 与版本组合非法（格式 7 配 1.2），或 extra bytes 类型不被目标软件识别。用 `pdal info` 回读一遍能立刻定位。

**坑五：`forward` 没生效。** `writers.las.forward` 只在输入为 LAS 且来源唯一时全量生效；多文件合并时若各文件头字段不一致，会被忽略并退回默认值，文档写明了这条规则。

## 2.11 生产建议

**scale/offset 策略写进规范。** 投影坐标用 0.01（厘米）或 0.001（毫米），地理坐标用 1e-7，offset 一律 `auto`。转格式时用 `forward: "all"` 继承原 scale，避免多次转换累积量化误差。

**版本与格式成对管理。** 要 32 以上类码或超过 7 次回波，就上 LAS 1.4 + 格式 6/7/8；只需标准类码且要与老软件互通，1.2 + 格式 3 更稳。PDAL 2.8 起 `writers.las.minor_version` 默认已是 4，老流程升级要留意输出版本悄悄变了。

**大文件优先 LAZ 或 COPC。** 归档用 LAZ，要在网络上按需取块用 COPC。写 COPC 之前先确认下游能读——它不是所有 GIS 软件都支持。

**extra bytes 不是垃圾桶。** 每加一个 extra 维度都会增加每点字节数与兼容风险。只写下游真正要的字段，且把 `extra_dims` 显式列出，别图省事用 `all`。

## 2.12 小结

| 主题 | 关键事实 |
|------|---------|
| 文件结构 | header（227/235/375 B）+ VLR + point records + EVLR（1.4） |
| 点格式 | 0–10；不支持波形格式 4/5/9/10；格式 6–10 必须配 LAS 1.4 |
| 记录长度 | 20 / 28 / 26 / 34 / — / — / 30 / 36 / 38 / — / —（字节） |
| 坐标编码 | int32 + scale/offset；默认 `scale=.01`、`offset=0`，可设 `auto` |
| 位域差异 | 格式 0–5 分类 5 bit、回波 3 bit；格式 6–10 分类 8 bit、回波 4 bit |
| extra bytes | `LASF_Spec`/4；1.0–1.3 需 `use_eb_vlr=true`；数组类型拆成 `Foo0/Foo1` |
| LAZ | 同格式的压缩变体，`compression: true` 触发 |
| COPC | 受约束的 LAZ 1.4 + 八叉树，支持 HTTP Range 按块读 |
| 读取选项 | `start`/`count`/`override_srs`/`default_srs`/`use_eb_vlr`/`threads`(7) |

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第01章-PDAL概述与点云生态/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第03章-安装配置与环境搭建/" class="chapter-nav__next">下一章 →</a>
</div>

---
layout: default
title: 第01章 - PDAL 概述与点云生态
---

# 第01章 - PDAL 概述与点云生态

## 1.1 问题：格式与算法之间的 N×M 组合

一个真实的点云项目通常长这样：数据来源有机载 LiDAR 的 LAS 1.2、无人机后处理的 LAZ 1.4、扫描仪的 E57，目标产出是一块范围内的 DEM 和一份入库用的压缩点云。传统做法是拼工具链——las2las 裁范围、las2dem 出栅格、laszip 压缩，每个工具的开关都不一样，中间结果反复落盘。换一种输入格式，整条链路推倒重来。

问题的根源不是工具不够好，而是点云处理长期缺少一层统一抽象：N 种格式要对接 M 种算法，就需要 N×M 份粘合代码。栅格和矢量领域在 2000 年前后由 GDAL/OGR 解决了这个问题——上层只面对一套 `Dataset` 接口，底下接几十种驱动。点云领域对应的答案是 PDAL（Point Data Abstraction Library，点数据抽象库）。它的 README 只有一句话：**PDAL is GDAL for point cloud data**。

这句话描述的是工程结构，不是营销类比：reader 把各种格式解析成统一的维度表，filter 只认维度不认格式，writer 再把维度表序列化回各种容器。N×M 于是塌缩成 N+M。

**表 1-1 点云处理的两条技术路线**

| 维度 | 工具链拼装 | PDAL pipeline |
|------|-----------|---------------|
| 流程组织 | shell 串联，中间文件落盘 | 进程内 stage 链，尽量不落地 |
| 格式 | 每个工具自带解析器 | 统一 reader，维度归一 |
| 算法复用 | 复制粘贴命令行 | filter 任意组合、顺序即语义 |
| 可复现 | 依赖 shell 历史 | pipeline JSON 即处理配方 |
| 扩展 | 改工具源码 | 写插件 stage，不动本体 |

## 1.2 PDAL 的边界

PDAL 是**处理库 + 命令行工具**，不是桌面 GIS，也不是三维引擎。边界划清楚，才不会拿它做不该做的事。

它负责：格式互转（LAS/LAZ/COPC/BPF/PCD/PLY/E57/文本/EPT 等）、坐标重投影、几何裁剪、去噪与滤波、地面分类、点云栅格化、特征计算、切片与瓦片索引、Pipeline 序列化与元数据导出。

它不负责：点云的可视化渲染（Potree、CloudCompare、Cesium 的活）、交互式编辑（手动删点、手工改分类）、制图符号化、通用栅格影像处理（交给 GDAL）、服务化本身（PDAL 只提供读写驱动，服务由 pgpointcloud 等承担）。

还有一条容易被忽略的边界是**算法深度**。PDAL 的滤波器以工程可用为目标：假设明确、参数少、结果稳定。地面分类用的是 SMRF / PMF / CSF 这类成熟方法，不是研究前沿；要做深度学习语义分割，得自己在 Python 里另接。PDAL 提供的是稳定的骨架，算法层是可替换的。

## 1.3 版本基线与许可证

写教程必须钉住版本，否则默认值对不上。本章及后续章节的事实基线是 **PDAL 2.10.0**，对应源码树 `CMakeLists.txt` 里的 `project(PDAL VERSION 2.10.0 LANGUAGES CXX C)`。

许可证是 **BSD 3-Clause**（版权方 Hobu, Inc.），允许商用、闭源分发和二次开发，没有传染性条款。同领域功能重叠最大的 LAStools 采用混合许可（部分工具闭源收费），这是不少团队选型时的分水岭。

**表 1-2 近年发布记录（节选自官方 download 文档）**

| 版本 | 发布日期 |
|------|----------|
| 2.9.3 | 2025-11-26 |
| 2.8.4 | 2025-02-03 |
| 2.7.1 | 2024-03-27 |
| 2.6.3 | 2024-02-05 |
| 2.5.6 | 2023-08-18 |
| 2.4.0 | 2022-03-18 |

主版本号长期停在 2.x 说明 API 稳定，但**小版本之间默认值会变**。实例：`writers.las` 的 `minor_version` 默认值在 PDAL 1.0–2.7 为 2，从 2.8 起改为 **4**。同一条 pipeline 在 2.7 和 2.10 上跑，输出文件的 LAS 版本可能不同，进而影响能否使用 point format 6/7/8。这类差异不读 release note 是查不出来的。

命令行里能直接读到版本事实：

```bash
pdal --version
# ----------------------------------------------------------------
# pdal 2.10.0 (git-version: Release)
# ----------------------------------------------------------------
```

这一行由 `Config::fullVersionString()` 拼出；非 Release 构建会把 40 位 git sha 截成 6 位，用于确认“这个二进制到底编译自哪个提交”。

## 1.4 三层核心抽象

PDAL 的 API 很宽，但核心只有三层。把这三层吃透，后面每个 stage 的文档都能自己读。

### 1.4.1 Dimension：带名字和类型的列

PDAL 不假设点“必须由 XYZ + 强度 + 回波组成”。每个属性是一个 **dimension**，有名字、有类型，注册在 `pdal/Dimension.json`。2.10.0 中共 **132 个**标准维度，例如：

- 坐标：`X`/`Y`/`Z`/`W`，类型 `double`
- 回波：`Intensity`（`uint16`）、`ReturnNumber`/`NumberOfReturns`（`uint8`）
- 分类：`Classification`（`uint8`，别名 `class`、`cls`）
- 颜色：`Red`/`Green`/`Blue`
- 时间：`GpsTime`、`OffsetTime`
- 派生：`HeightAboveGround`、`NormalX`、`Curvature`、`ClusterID`

类型决定精度上限与内存占用。`Classification` 是 `uint8`，只能表达 0–255；把 32 位强度值赋给 `Intensity` 会被静默截断，不报错——这是最隐蔽的一类数据损失。

表里没有的属性也不会丢：reader 可以用 `extra_dims` 以“名字=类型”的形式声明额外维度，LAS 的 extra bytes VLR 内容就是这么进来的。这让 PDAL 能承载比 LAS 标准更宽的数据。

### 1.4.2 PointView：内存中的一批点

**PointView** 是数据容器，相当于“一张点表”。一条 pipeline 在标准模式下，数据以 PointView 为单位在 stage 之间流动。

关键特性是**一个 stage 可以输出多个 PointView**：`filters.splitter` 按瓦片切、`filters.divider` 按容量或轮询切、`filters.crop` 给多个多边形就产出多个视图。下游 writer 只要文件名里带 `#` 占位符，就会为每个视图写一个文件：

```json
[
    "input.las",
    {
        "type" : "filters.crop",
        "bounds" : [ "([0, 75], [0, 75])", "([50, 125], [50, 125])" ]
    },
    "output#.las"
]
```

结果是 `output1.las` 与 `output2.las`，各自只含对应裁剪区的点。

底层存储是**按列**组织：`PointTable` 为每个 dimension 分配一块连续内存，`PointView` 持有的是一组行索引。这解释了两个现象：新增一个维度是 O(1) 的列操作，与点数无关；视图取子集很便宜（只挪索引），但排序或重排要复制列数据。

### 1.4.3 Stage：reader / filter / writer 的统一基类

所有处理单元都继承 `Stage`，按职责分三类：

- **Reader**：入口。`readers.las`、`readers.copc`、`readers.ept`、`readers.gdal`、`readers.text`…
- **Filter**：中间处理。`filters.crop`、`filters.reprojection`、`filters.smrf`、`filters.outlier`…
- **Writer**：出口。`writers.las`、`writers.gdal`、`writers.copc`、`writers.text`…

每个 stage 只做三件事：声明需要哪些维度、准备资源、处理点。stage 之间通过 PointView 连接，所以任意组合都不需要事先约定数据格式。

2.10.0 的 stage 规模（按官方文档页统计）：

**表 1-3 PDAL 2.10.0 的 stage 规模**

| 类别 | 文档页数 | 代表 stage |
|------|---------|-----------|
| readers | 38 | las、copc、ept、gdal、text、e57、ply、pcd |
| filters | 90 | crop、reprojection、range、outlier、smrf、hag_nn、hexbin |
| writers | 23 | las、copc、gdal、text、ply、ogr |

注意“文档页数 ≠ 默认安装可用数”。部分 stage 依赖第三方库（HDF5、TileDB、Matlab、E57、PostgreSQL、Arrow），编译时没开就用不了，以 `pdal --drivers` 的实时输出为准。
## 1.5 Stage 从哪里来：静态注册与插件

PDAL 的 stage 有两种存在形式。绝大多数常用 stage 是**静态注册**的，直接编进 `libpdalcpp` 共享库（Windows 上是 `pdalcpp.dll`）；其余做成**插件**——独立共享库，运行时加载。

插件命名有硬约定：

```text
libpdal_plugin_<type>_<name>.<ext>
                │       └─ 名字须以字母或数字开头，后续可用字母、数字、下划线
                └─ reader | writer | filter | kernel
```

查找顺序：先找 PDAL 库所在目录，再找相对当前工作目录的 `.`、`./lib`、`../lib`、`./bin`、`../bin`。要加自定义路径，用环境变量：

```bash
# Linux / macOS
export PDAL_DRIVER_PATH=/opt/pdal-plugins:/usr/local/lib

# Windows (cmd)
set PDAL_DRIVER_PATH=D:\pdal-plugins;D:\PDAL\bin
```

分隔符在 Windows 是 `;`，其他平台是 `:`。写错不会报错，插件只是静默不加载：`pdal --drivers` 里看不到那个 stage，pipeline 运行时报 `Couldn't create stage`，错误信息不会告诉你是路径没配对。

## 1.6 两种执行模式：standard 与 stream

这是 PDAL 架构里对内存和性能影响最大的设计，也是最常被忽略的。

**standard（标准）模式**：先把全部点读进内存形成完整 `PointTable`，再按 stage 顺序处理。需要全局视图的算法只能在标准模式运行——排序、全局统计量、需要遍历全部点才能定阈值的算法。

**stream（流式）模式**：点被切成块，逐块穿过整条流水线。内存占用与总点数基本无关，只与块大小和 filter 内部缓存有关。

`pdal translate` 与 `pdal pipeline` 默认**尽量**用流式，做不到就静默回退到标准模式。想强制指定：

```bash
pdal translate input.las output.laz --stream    # 要求流式，做不到就退出
pdal translate input.las output.laz --nostream  # 强制标准模式
```

想提前判断一条 pipeline 能不能流式，用 `pdal pipeline --validate`：它只校验不处理，并报告该 pipeline 是否可流式。

差距有多大？以 10 亿点为例，仅 X/Y/Z 三个 `double` 维度就是 24 GB，再加上强度、回波、颜色，很容易突破 40 GB；流式模式的稳态内存通常是几百 MB 到几 GB。所以“大文件处理不动”的抱怨，九成答案在模式选择上。

流式不是免费的：块边界会切断邻域关系。`filters.smrf` 要栅格化全局点云、`filters.outlier` 要全局统计量，它们必然不是流式。反过来，`filters.crop`、`filters.range`、`filters.assign`、`filters.reprojection` 都是逐点可算的，可以安全流式。选 stage 时先问一句：这个算法需要看见全部点吗？

## 1.7 跑通第一条 pipeline

不依赖任何数据文件也能验证环境——`readers.faux` 可以造点。保存为 `hello.json`：

```json
[
    {
        "type": "readers.faux",
        "mode": "ramp",
        "bounds": "([0,99],[0,99],[0,9])",
        "count": 100
    },
    {
        "type": "writers.las",
        "filename": "hello.las"
    }
]
```

```bash
pdal pipeline hello.json
pdal info --summary hello.las
```

`readers.faux` 的 ramp 模式把 `count` 个点从 bounds 最小值均匀铺到最大值，步长为 `(max-min)/(count-1)`（见 `FauxReader::initialize()`）。因此 100 个点在 X/Y 上正好落在 0、1、2 … 99，这份数据是**确定性**的——同一份 JSON，谁跑结果都一样，适合当测试夹具。

`pdal info --summary` 的字段结构（键名来自 `QuickInfo::dumpSummary()`，挂在 `summary` 下）：

```text
{
  "filename": "hello.las",
  "pdal_version": "2.10.0 (git-version: Release)",
  "summary": {
    "num_points": 100,
    "bounds": { "minx": 0, "miny": 0, "minz": 0,
                "maxx": 99, "maxy": 99, "maxz": 9 },
    "dimensions": "X, Y, Z, OffsetTime"
  },
  "reader": "readers.las",
  "now": "2026-…",
  "file_size": 2187
}
```

`dimensions` 里出现了 pipeline 没声明过的 `OffsetTime`，这不是多余的字段：维度集合由 reader 声明，filter 与 writer 只增不减。

三种 `info` 模式要分清：不带选项等价于 `--stats`（扫全部点，O(N)）；`--summary` 只读文件头（大文件上是 O(1)）；`--all` 同时输出 stats、schema 和 metadata。

## 1.8 PDAL 在点云生态中的位置

```text
   采集              索引 / 服务                  处理                 应用
┌──────────┐   ┌────────────────────┐   ┌──────────────┐   ┌──────────────┐
│ 机载 LiDAR │   │ Entwine → EPT      │   │              │   │ Potree       │
│ 车载 / 背包│──▶│ Untwine → COPC/EPT │──▶│     PDAL     │──▶│ CloudCompare │
│ 三维扫描   │   │ COPC（单文件）      │   │              │   │ Cesium       │
└──────────┘   └────────────────────┘   └──────┬───────┘   └──────────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          ▼                     ▼                     ▼
                   PostgreSQL            GeoTIFF / DEM          文本 / JSON
                  (pgpointcloud)         (writers.gdal)        (writers.text)
```

几个关键关系：

- **Entwine / EPT**：Hobu 的点云索引工具，把海量 LAS 组织成八叉树，PDAL 通过 `readers.ept` 读取，可带 `bounds`、`resolution` 做按需加载。EPT 读是流式的，适合几百 GB 级别的在线处理。
- **Untwine**：同样是索引工具，但采用自底向上的构建方式，产出 COPC 或 EPT。
- **COPC**：Cloud Optimized Point Cloud，本质是 LAS 1.4 + LAZ + 空间聚簇八叉树，单文件即可支持 HTTP Range 按块读取。PDAL 提供 `readers.copc`/`writers.copc`，也能直接读远程 URL。
- **PCL**：互补而非替代。PCL 偏机器人、实时与算法研究；PDAL 偏格式抽象与工程流水线。两者通过 PCD 格式互通。
- **LAStools**：功能重叠最大。命令行工具成熟，但许可模式不同；PDAL 用声明式 JSON 组织流程、可嵌入 C++/Python，更适合做产品化的批处理系统。
- **python-pdal**：官方 Python 绑定，把 pipeline 结果暴露为 NumPy 数组。2.1 之后，Python 相关能力（嵌入的 `readers.numpy`/`filters.python` 与扩展本身）统一从 PyPI 分发。

## 1.9 常见误解与真实报错

**误解一：PDAL 与 GDAL 二选一。** 不对，PDAL 强依赖 GDAL。源码里 `cmake/gdal.cmake` 要求 **GDAL ≥ 3.8**，`cmake/proj.cmake` 要求 **PROJ ≥ 9.0**，`cmake/geotiff.cmake` 要求 **GeoTIFF ≥ 1.7.0**，`cmake/curl.cmake` 把 curl 列为 REQUIRED。装 PDAL 等于装一整套 GDAL 依赖栈。

**误解二：装了 PDAL 就有全部 stage。** 见 1.5，先跑 `pdal --drivers` 再谈“文档里有”。

**误解三：pipeline 里 stage 顺序无所谓。** 有所谓，而且有语义：stage 按数组顺序执行；不写 `inputs` 时使用默认输入列表，写了 `inputs` 就用指定 tag 的输出并替换默认列表。乱序会得到“后面 stage 读到了不该读的数据”这类很难排查的结果。

**误解四：`--stream` 一定更快。** 不一定。流式省内存，但块边界会让某些算法退化；小文件上标准模式没有明显额外开销。

真实报错与修法：

| 报错 / 现象 | 原因 | 修法 |
|------------|------|------|
| `Command 'xxx' not recognized` | 子命令拼错，或该 kernel 未编译 | `pdal --list-commands` 查可用命令 |
| `Couldn't create stage xxx` | stage 名错，或插件未加载 | `pdal --drivers` 确认；检查 `PDAL_DRIVER_PATH` |
| `Unable to open file` | 路径、权限或远程协议不支持 | 先用绝对路径；远程 URL 需要编译时带 curl |
| 输出文件 0 个点 | 上游 filter 把点全过滤了 | 删 stage 二分定位；`pdal info --stats` 看分布 |
| Z 精度到厘米就停 | LAS 默认 `scale_z = .01` | writer 显式设 `scale_z`，或用 `offset_z: "auto"` |

## 1.10 生产建议

**锁版本**。生产镜像里钉住 minor 版本，并把 `pdal --version` 的输出写进部署记录。2.7 → 2.8 那次 `writers.las.minor_version` 默认值变化说明小版本也会改行为。

**能流式就别标准模式**。挑逐点可算的 filter 组流水线，把必须全局的（地面分类、离群点）放到最小必要位置。先用 `pdal pipeline --validate` 验证再跑。

**少落地中间文件**。一条 pipeline 干完，比“转格式 → 裁切 → 再转格式”少好几轮磁盘 I/O，也避免中间文件的坐标系与 scale 被意外改写。

**pipeline 进版本库**。JSON 就是处理配方；配合 `--pipeline-serialization`（`pdal pipeline`）或 `--pipeline`（`pdal translate`）把实际执行的 stage 参数存档，出问题可复现。

**远程数据优先 COPC/EPT**。两者都支持带 `bounds`/`resolution` 的降采样读取，比“先下载 40 GB 再裁”快一个数量级，这几乎是 PDAL 相对本地工具链最实用的优势。

## 1.11 小结

**表 1-4 本章要点**

| 主题 | 关键事实 |
|------|---------|
| 定位 | 点云版 GDAL：统一读写抽象 + 流水线框架，BSD 3-Clause |
| 版本基线 | 2.10.0；小版本可能改默认值（LAS `minor_version` 2→4） |
| 核心抽象 | Dimension（132 个标准维度）、PointView（可多视图）、Stage |
| 规模 | 文档口径 readers 38 / filters 90 / writers 23，实际以 `pdal --drivers` 为准 |
| 插件 | `libpdal_plugin_<type>_<name>`，路径由 `PDAL_DRIVER_PATH` 追加 |
| 执行模式 | standard 全内存、stream 分块；默认自动择优，`--stream`/`--nostream` 强制 |
| 编译依赖 | GDAL ≥ 3.8、PROJ ≥ 9.0、GeoTIFF ≥ 1.7.0、curl |
| 排错入口 | `--drivers`、`--list-commands`、`pipeline --validate`、`info --summary` |

下一章进入数据层：LAS/LAZ 的文件头字段、point format 0–10 分别携带什么、VLR 与 extra bytes 如何映射成 PDAL 的维度，以及为什么从 LAS 读出来的维度数量常常比“标准字段”多。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/PDAL/第02章-点云数据模型与LASLAZ格式/" class="chapter-nav__next">下一章 →</a>
</div>

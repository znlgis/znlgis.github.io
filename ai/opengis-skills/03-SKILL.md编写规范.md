---
layout: default
title: 第三章：SKILL.md 编写规范
---

# 第三章：SKILL.md 编写规范

本章面向想为 opengis-skills 贡献新技能或自己编写技能的读者，系统讲解 SKILL.md 的编写规范。无论是为 GIS、CAD、C#、AI、IoT 还是 3D 领域添加新工具，都遵循同一套结构约定，确保 AI 编程助手能高效加载和利用这些技能。

阅读本章后，你将能够：

- 理解 SKILL.md 的完整文件结构
- 编写符合规范的 YAML frontmatter（尤其是 `description` 的 Use when... 格式）
- 组织正文内容的各节，做到信息密度高、可直接执行
- 在文件过大时合理拆分子目录
- 用一份检查清单自检编写质量

---

## 3.1 文件基本结构

一个标准的 SKILL.md 遵循固定的章节顺序。下面是各节在文件中出现的推荐顺序表：

| 序号 | 章节 | 说明 |
|------|------|------|
| 1 | YAML frontmatter | 必填。元数据区块，包括 `name`、`description`、`tags` |
| 2 | 头部引用块 | 必填。项目地址、官方文档、许可证等信息 |
| 3 | 概述 | 必填。项目定位、核心特性，不超过 5 句话 |
| 4 | 环境准备 / 安装 | 强烈建议。各平台安装命令与验证方法 |
| 5 | 核心 API / 命令 | 建议。按功能分组的命令或 API 清单，含可运行示例 |
| 6 | 典型工作流 | 强烈建议。至少 1 个完整的端到端使用场景 |
| 7 | 最佳实践 / 性能优化 | 可选。常见陷阱、性能调优、推荐配置 |
| 8 | 常见问题（FAQ） | 建议。至少 5 条，表格形式 |
| 9 | 参考资源 | 可选。官方文档链接、reference 子目录索引 |
| 10 | 相关技能 | 可选。链接到同一分类下的其他相关 SKILL.md |

> **注意**：以上序号并非固定死板的要求，而是推荐顺序。如果项目体量较小（例如只有 5 个 API），可以将"核心 API"与"典型工作流"合并书写。关键是保持顺序稳定——让 AI 工具和人类读者都形成可预期的阅读路径。

以仓库中最典型的 `gis/gdal/SKILL.md` 为例，其实际结构为：

```text
YAML frontmatter
  -> 头部引用块
    -> 概述
      -> 环境准备
        -> 核心命令结构（新式 CLI + 传统 CLI）
          -> 矢量数据工具（OGR）
            -> 栅格数据工具（GDAL）
              -> 常用环境变量和配置
                -> 数据格式支持
                  -> 常见使用模式
                    -> AI 使用建议
                      -> 相关技能
                        -> 相关资源
```

这个结构覆盖了从"这个工具是什么"到"如何用它解决实际问题"的完整认知链条。

---

## 3.2 YAML Frontmatter 规范

Frontmatter 是 SKILL.md 中最重要的元数据部分。AI 工具通过它来发现、索引和匹配技能。三个必填字段是 `name`、`description` 和 `tags`。

### 3.2.1 name

`name` 是项目的英文短名，全小写，单词之间用连字符分隔。

规则：
- 与项目目录名保持一致（例如 `gis/gdal/` 目录下的 frontmatter 中 `name: gdal`）
- 用连字符代替空格，不用下划线或驼峰
- 不要包含版本号或所有者名称

正例与反例：

```yaml
# 正例
name: gdal
name: geoserver-rest-api
name: geometry-api-java
name: cadquery
name: admin-net-backend

# 反例
name: GDAL              # 不应大写
name: GeoServer_REST    # 不应使用下划线或驼峰
name: gdal-3.9          # 不应包含版本号
```

### 3.2.2 description

`description` 是 AI 工具实现智能匹配的核心字段。**必须**采用英文 `Use when...` 格式，遵循 Anthropic Skill 最佳实践。

**格式规则**：

1. **以 `Use when` 开头**——这是触发条件，告诉 AI"什么情况下加载这个技能"
2. **包含项目定位**——一句话说明这个工具是干什么的
3. **列出关键特性**——用简短的英文短语概括核心能力
4. **一行搞定**——不要超过 500 个字符，力求紧凑有力

**对比示例：好 vs 差**：

```yaml
# 好：明确触发条件 + 定位 + 关键特性
description: "Use when processing geospatial raster/vector data via command line — format conversion (Shapefile to GeoJSON), reprojection, DEM analysis, NDVI calculation, mosaicking. GDAL/OGR CLI: the industry standard for batch geospatial data processing with 50+ command-line tools (ogr2ogr, gdalwarp, gdal_translate, gdal_calc)."

# 好：触发条件 + 几何运算场景 + 技术栈说明
description: "Use when performing computational geometry in Python — intersection, union, buffer, convex hull, simplification. Shapely: Python bindings for GEOS, the C++ geometry engine that powers PostGIS."

# 差：只描述项目，没有触发条件
description: "GDAL 是一个开源GIS库，用于读写各种栅格和矢量地理数据格式"

# 差：中文描述，AI 工具的英文匹配器无法理解
description: "用于命令行处理空间数据格式转换、重投影和 DEM 分析"
```

**L2 分类索引的 description 格式**：

对于 `gis/SKILL.md`、`cad/SKILL.md` 等二级分类索引文件，description 格式略有不同——它引导 AI 进入某大类后进一步匹配子技能：

```yaml
# L2 分类索引用法：Use when 触发条件 + Index of N skills: 子技能列表
description: "Use when processing geospatial data, publishing map services, querying spatial databases, performing geometry operations, or building web map applications. Index of 23 skills: GDAL, GeoServer, QGIS, PostGIS, JTS, GeoPandas, Shapely, CesiumJS, OpenLayers, NetTopologySuite and more."
```

**L1 根入口的 description 格式**（`/SKILL.md`）：

```yaml
description: "Use when working with GIS, CAD, C#, AI, IoT, or 3D tools. Index of 66 skills across 7 categories: gis (23), cad (18), csharp (8), ai (8), iot (1), 3d (2), others (6). Includes tag-based search and scenario-driven recommendations."
```

> **为什么必须是英文？** Anthropic 的 Claude 系列及其他主流 AI 工具的内部 skill 匹配器是基于英文语义工作的。即使你的正文内容用中文书写，`description` 字段也必须使用英文，否则 AI 无法在合适的时机自动发现并加载这个技能。

### 3.2.3 tags

`tags` 是一个列表，用于标签搜索系统。标签帮助 AI 工具在不加载完整 SKILL.md 的情况下快速判断一个技能是否与当前问题相关。

**标签分类**：

tags 应覆盖两个维度：

1. **语言/平台标签**：标记该工具所属的编程语言或运行时
2. **功能领域标签**：标记该工具解决什么问题

以 opengis-skills 仓库中已存在的标签为例：

```yaml
# GDAL：CLI 工具，覆盖矢量、栅格、转换、重投影
tags:
  - gdal
  - ogr
  - cli
  - raster
  - vector
  - conversion
  - reprojection
  - gis
  - geospatial

# Shapely：Python 几何运算
tags:
  - python
  - geometry
  - geos
  - wkt
  - wkb
  - geojson
  - spatial
  - numpy

# Dify：AI 平台
tags:
  - ai
  - platform
  - workflow
  - rag
  - agent
  - llm
```

**标签命名规则**：

- 全小写，用连字符分隔
- 不使用空格
- 避免过度细分的标签（例如不需要 `shapefile-to-geojson-conversion`，用 `conversion` 就够）
- 一个技能通常 5-10 个标签

**常用标签词汇表**：

| 维度 | 建议标签 |
|------|---------|
| 编程语言 | `python`, `javascript`, `java`, `cpp`, `dotnet`, `go` |
| 数据格式 | `raster`, `vector`, `geojson`, `wkt`, `wkb` |
| GIS 领域 | `gis`, `geospatial`, `mapping`, `webmapping`, `spatial-analysis`, `server`, `geometry`, `conversion`, `reprojection` |
| CAD 领域 | `cad`, `2d`, `3d`, `modeling`, `parametric`, `bim`, `pcb` |
| AI 领域 | `ai`, `llm`, `agent`, `rag`, `workflow`, `platform` |
| 接口方式 | `cli`, `api`, `rest`, `library`, `framework` |

### 3.2.4 完整 frontmatter 示例

把以上三个字段放在一起，一个符合规范的 frontmatter 如下：

```yaml
---
name: gdal
description: "Use when processing geospatial raster/vector data via command line — format conversion (Shapefile to GeoJSON), reprojection, DEM analysis, NDVI calculation, mosaicking. GDAL/OGR CLI: the industry standard for batch geospatial data processing with 50+ command-line tools (ogr2ogr, gdalwarp, gdal_translate, gdal_calc)."
tags:
  - gdal
  - ogr
  - cli
  - raster
  - vector
  - conversion
  - reprojection
  - gis
  - geospatial
---
```

---

## 3.3 头部引用块

紧接在 YAML frontmatter 下方，每个 SKILL.md 应当有一个表格形式的引用块，提供项目的最基本信息。格式为：

```markdown
> **项目地址：** <https://github.com/OSGeo/gdal>
>
> **官方文档：** <https://gdal.org/en/latest/>
>
> **源码命令文档：** <https://gdal.org/en/latest/programs/>
>
> **许可证：** MIT
```

这个区域的作用是：
- 让 AI 工具快速了解"去哪找更详细的参考"
- 让人类读者一眼识别项目来源和许可证类型
- 作为后续章节中提到的任何命令/API 的权威验证入口

**推荐包含的字段**：

| 字段 | 说明 | 是否必填 |
|------|------|---------|
| 项目地址 | GitHub/GitLab 等源码仓库 | 是 |
| 官方文档 | 官方文档或 ReadTheDocs 等 | 是 |
| PyPI / npm / NuGet | 包管理页面（如有） | 按需 |
| 许可证 | SPDX 标识符或常见简称 | 推荐 |

### 特殊情况的写法

当项目仓库不可用（如已私有化或 404）时，应在引用块中标注警告：

```markdown
> **项目地址：** <https://github.com/znlgis/geopipe-agent>（仓库已404/私有，暂不可用）
>
> **许可证：** MIT
>
> *此 skill 仅作参考，部分安装方式可能不可用。*
```

---

## 3.4 正文结构规范

本章逐节讲解正文每个部分的撰写要求。所有示例均摘录自 opengis-skills 仓库中的真实 SKILL.md 文件。

### 3.4.1 概述

概述是 AI 工具决定"是否深入加载此技能全文"的关键判断区。

**撰写要求**：
- 用 **不超过 5 句话** 说明项目是什么、核心定位、解决的问题
- 优先用**列表**或**表格**呈现关键特性，而不是长段落
- 语言简洁直白，避免营销话术

**正例（来自 gdal/SKILL.md）**：

```markdown
## 概述

GDAL 是地理空间数据处理的事实标准库。它提供了 **50+ 个命令行工具**，分为两大类：

- **OGR 工具**（开放地理数据模型）：处理矢量数据（点、线、面）
- **GDAL 工具**：处理栅格数据（卫星影像、DEM、栅格地图）
```

**正例（来自 geopipe-agent/SKILL.md）**：

```markdown
## 概述

GeoPipeAgent 是一个 **AI 原生的 GIS 分析流水线引擎**。核心理念是：你（AI）生成 YAML 管道配置，框架负责执行并返回结构化结果。

**核心能力：**

- **声明式流水线**：YAML 定义分析步骤，AI 友好
- **丰富步骤库**：矢量分析、栅格分析、网络分析、空间聚类、数据质检
- **多后端支持**：native_python 和 qgis_process
- **质检框架**：10 种 QC 检查，支持错误/警告/信息三级
```

**反例（应避免）**：

```markdown
## 概述

XXXX 是一个功能强大、性能卓越、易于使用的地理空间数据处理框架。
它诞生于 20XX 年，由国际开源社区共同维护，广泛应用于各个行业和领域，
深受用户喜爱和信赖，是您进行空间数据处理的理想选择。
```

问题：空洞的形容词（"功能强大""性能卓越""深受喜爱"）没有信息量；没有列出具体能力；AI 读完这些句子后仍然不知道这个工具能做什么。

### 3.4.2 环境准备 / 安装

这一节让 AI 能够直接生成可执行的安装命令。

**撰写要求**：
- 覆盖主流操作系统：Linux（区分 Debian/Ubuntu 和 RHEL/CentOS）、macOS、Windows
- 如果存在多种安装方式（系统包管理器、Conda、Docker、pip），逐一列出
- 提供**安装验证命令**——让用户/ AI 确认安装是否成功
- 按需说明依赖项和版本要求

**示例（来自 gdal/SKILL.md）**：

```markdown
## 环境准备

### 前置条件

GDAL 3.0+ 已预装在大多数 Linux 发行版的地理信息处理环境中。确保工具在 `PATH` 中：

\`\`\`bash
gdalinfo --version   # 验证 GDAL 版本
ogrinfo --version    # 验证 OGR 版本
\`\`\`

### 安装方法

#### Linux (Debian/Ubuntu)

\`\`\`bash
apt-get update
apt-get install gdal-bin python3-gdal
\`\`\`

#### macOS (Homebrew)

\`\`\`bash
brew install gdal
\`\`\`

#### Conda

\`\`\`bash
conda install -c conda-forge gdal
\`\`\`

#### Docker

\`\`\`bash
docker run -it osgeo/gdal:latest bash
\`\`\`
```

对于 Python 库类技能，应包含 pip 安装和验证：

```markdown
\`\`\`bash
pip install shapely
\`\`\`

\`\`\`python
import shapely
print(shapely.__version__)  # 验证安装
\`\`\`
```

### 3.4.3 核心 API / 命令

这是 SKILL.md 中 AI 工具**最常用的部分**——它直接告诉 AI 应该生成什么代码或命令。

**撰写要求**：

1. **按功能分组**，用三级标题区分不同模块或领域
2. **每个命令/API 附带一个简短说明**——说明它做什么，而非重复命令名
3. **代码示例必须实际可运行**——参数名、文件路径应尽量使用占位符（`input.shp`、`output.tif`）而非虚构值
4. **关键参数用注释说明**，但注释不要喧宾夺主
5. **代码块指定语言标识**：bash 用 ` ```bash `，python 用 ` ```python `，yaml 用 ` ```yaml `

**表格 + 代码的搭配模式**（来自 shapely/SKILL.md）：

表格提供命令速览，代码块提供可运行示例。两者放在同一节的不同位置，相互补充：

```markdown
## Set-Theoretic Operations

| Function | Description |
|----------|-------------|
| `intersection(a, b, grid_size=None)` | Shared geometry |
| `union_all(geometries)` | N-way union |
| `difference(a, b, grid_size=None)` | A minus B |

\`\`\`python
result = shapely.intersection(polygon_a, polygon_b)
all_merged = shapely.union_all(polygon_array)
cut = shapely.difference(geom_a, geom_b)
\`\`\`
```

**反例（应避免）**：

```markdown
# 只列命令，没有说明和分组
gdalinfo
ogrinfo
ogr2ogr
gdal_translate
gdalwarp
```

这样 AI 无法理解各命令之间的区别和适用场景。至少应该：

```markdown
### 信息查询

- `gdalinfo` — 查看栅格数据信息和元数据
- `ogrinfo` — 查看矢量数据结构和图层列表

### 格式转换

- `ogr2ogr` — 矢量格式转换（如 Shapefile 转 GeoJSON）
- `gdal_translate` — 栅格格式转换和重采样
```

### 3.4.4 典型工作流

这是将零散的 API/命令串联成**真实可用场景**的关键章节。没有工作流的 SKILL.md，AI 可能知道每个命令但不知道怎么组合它们。

**撰写要求**：
- 描述一个真实的业务场景（例如"将 Shapefile 转 GeoJSON 并发布为 WMS 服务"）
- 步骤式描述，每一步给出可执行的代码或命令
- 说明输入是什么、输出是什么
- 对可能出错的地方给出提示

**示例 1：简单工作流（来自 gdal/SKILL.md）**：

```markdown
### 模式 1: 批量格式转换

\`\`\`bash
#!/bin/bash
# 将目录内所有 Shapefile 转换为 GeoJSON

for shp in *.shp; do
  base="${shp%.shp}"
  ogr2ogr -f GeoJSON "$base.geojson" "$shp"
done
\`\`\`
```

**示例 2：AI 友好的推荐工作流**：

这篇来自 gdal/SKILL.md 的"AI 使用建议"段落是供 AI 编程助手直接参照的工作流骨架：

```markdown
### 推荐工作流

1. **探索数据**：
   \`\`\`bash
   gdalinfo input.tif  # 栅格信息
   ogrinfo input.shp   # 矢量信息
   \`\`\`

2. **检查支持的格式和驱动**：
   \`\`\`bash
   gdalinfo --formats
   ogrinfo --formats
   \`\`\`

3. **分步处理**（避免大内存操作）
4. **使用 JSON 输出**（便于解析）
5. **优化性能**：启用多线程、内存缓存、COG 格式
```

**示例 3：多步骤流水线工作流（来自 geopipe-agent/SKILL.md）**：

```yaml
pipeline:
  name: "数据质检修复"
  steps:
    - id: read
      use: io.read_vector
      params:
        path: "data/buildings.shp"
    - id: check_valid
      use: qc.geometry_validity
      params:
        input: "$read"
        severity: error
    - id: fix_valid
      use: qc.geometry_validity
      params:
        input: "$check_valid"
        auto_fix: true
      when: "$check_valid.issues_count > 0"
    - id: save
      use: io.write_vector
      params:
        input: "$fix_valid"
        path: "output/buildings_checked.gpkg"
        format: GPKG
```

这个工作流展示了**质检-修复-输出**的完整链条，AI 可以据此直接生成类似的管道配置。

### 3.4.5 最佳实践

此节不是必填，但对于复杂工具有较强的参考价值。

**撰写要求**：
- 写具体的"该做"和"不该做"，而非泛泛的"注意性能"
- 每个建议配一个简短的代码示例或配置片段
- 按话题用小标题分组（如"性能优化""内存管理""生产环境部署"）

**示例（来自 shapely/SKILL.md）**：

```markdown
## Important Caveats

1. **Z ignored in analysis**: All spatial operations work in x-y plane only.
2. **`contains` excludes boundary**: Use `covers()` or `intersects()` if you need boundary inclusion.
3. **`set_coordinates` modifies in-place**: Copy geometry first with `.copy()` if originals must be preserved.
4. **OOP vs function `buffer` defaults differ**: `Point(0,0).buffer(1)` uses `quad_segs=16`; `shapely.buffer(Point(0,0), 1)` uses `quad_segs=8`.
```

这些"坑"是只有实际用了才知道的，写成列表供 AI 和人类快速扫描，比藏在长段落里有价值得多。

### 3.4.6 FAQ

FAQ 用**表格形式**呈现，至少 5 条。覆盖安装、使用、排错三个维度。

**格式模板**：

```markdown
## 常见问题

| 问题 | 答案 |
|------|------|
| 如何检查 GDAL 版本？ | `gdalinfo --version` |
| ogr2ogr 转换时如何指定编码？ | 使用 `-lco ENCODING=UTF-8` 参数 |
| 如何查看支持的矢量格式？ | `ogrinfo --formats` |
| gdalwarp 裁剪后输出全黑？ | 检查 NoData 值和源/目标 CRS 是否匹配 |
| 如何加速大批量栅格处理？ | 设置 `export GDAL_NUM_THREADS=ALL_CPUS` 和 `export GDAL_CACHEMAX=2048` |
```

FAQ 格式**必须是表格**——这与正文的段落形成对比，让 AI 在快速扫描时可以定位到具体问题。每个问题应尽量简洁：一行提问题，一行给答案（命令或短说明）。

**FAQ 选题建议**：

| 话题 | 示例问题方向 |
|------|------------|
| 安装 | 如何安装特定版本？依赖冲突怎么解决？ |
| 环境 | 如何查看当前版本？如何切换环境？ |
| 常用操作 | 如何实现 XX 到 YY 的转换？如何过滤数据？ |
| 排错 | 报错 XXX 是什么原因？输出结果为空怎么办？ |
| 性能 | 大数据量怎么处理？如何开启多线程？ |

---

## 3.5 reference 子目录拆分策略

当 SKILL.md 内容膨胀到 **500 行以上**时，需要将详细参数表或高级用法拆分到 `reference/` 子目录，主文件只保留概要和使用链接。

### 3.5.1 拆分原则

- **主 SKILL.md**：保留核心命令的**常用用法**和 1-2 个关键示例
- **reference/*.md**：存放完整的参数表格、边界情况、高级用法、性能调优细节
- **引用方式**：在主文件中添加 `[详细参数](reference/xxx-tools.md)` 的链接

### 3.5.2 目录结构示例

以 `gis/gdal/` 为例，其目录布局如下：

```
gis/gdal/
├── SKILL.md                    # 主技能文件（452 行）
└── reference/
    ├── vector-tools.md         # 30+ 个矢量命令的完整参数表
    └── raster-tools.md         # 20+ 个栅格命令的完整参数表
```

在主文件 `gis/gdal/SKILL.md` 中，矢量工具有一个缩略版，然后链接到详细参考：

```markdown
## 矢量数据工具（OGR）

> 完整参数表和高级示例见 [reference/vector-tools.md](reference/vector-tools.md)

### ogrinfo — 矢量数据信息查询

\`\`\`bash
ogrinfo mydata.shp
ogrinfo -json mydata.shp
ogrinfo mydata.shp -where "AREA > 1000"
\`\`\`

### ogr2ogr — 矢量数据格式转换和处理

\`\`\`bash
ogr2ogr output.geojson input.shp
ogr2ogr -t_srs EPSG:3857 output.shp input.shp
ogr2ogr output.shp input.shp -where "area > 1000"
\`\`\`
```

然后在 `reference/vector-tools.md` 中，每个命令有完整的参数说明、表格和高级示例。

### 3.5.3 拆分决策

并不是所有超过 500 行的技能都必须拆分。判断标准：

| 条件 | 建议 |
|------|------|
| 表格超过 20 行且每个参数都需要解释 | 拆分到 reference |
| API/命令数量超过 30 个 | 拆分到 reference |
| 有大量的环境变量或配置项 | 可单独一个 `reference/config.md` |
| 有 5 个以上完整工作流 | 可单独一个 `reference/workflows.md` |
| 总体在 500 行以内 | 不拆分，保持单文件 |

以 `gis/geopipe-agent/` 为例，当前 SKILL.md 约 350 行，包含 30+ 个步骤的完整表格、5 个工作流和 FAQ，虽然信息密度很高但未超过 500 行，因此暂未拆分。

### 3.5.4 reference 文件的编写规范

reference 文件本身**不需要** YAML frontmatter——它不是独立的 SKILL.md，而是主文件的附录。它只需要一个标题和清晰的正文结构。但建议在文件顶部加一行路径提示：

```markdown
# 矢量工具完整参考

> 这是 `gis/gdal/SKILL.md` 的补充文件。请先阅读主文件了解基本用法。

## ogrinfo 完整参数
...
```

---

## 3.6 语言与格式约定

opengis-skills 的 SKILL.md 在语言和格式上有明确的约定。这些约定源自仓库的实践积累，核心目标是**让 AI 和人类都能顺畅阅读**。

### 3.6.1 语言约定

| 内容类型 | 使用语言 | 说明 |
|---------|---------|------|
| 正文说明（概述、安装步骤说明、工作流描述、FAQ 答案） | **中文** | 仓库面向中文用户，正文必须用中文 |
| YAML frontmatter 的 `description` | **英文** | AI 工具匹配器基于英文语义索引 |
| YAML frontmatter 的 `tags` | **英文** | 标签统一英文，方便跨语言检索 |
| 代码、命令、API 名称 | **英文原文** | 不翻译，保持与官方文档一致 |
| 命令行输出、错误信息 | **英文原文** | 不做翻译，保留原始输出 |
| 文件名和路径 | **英文** | 目录名、文件名一概使用英文 |
| 技术术语 | **中英混用** | 如"使用 `ogr2ogr` 进行格式转换" |

### 3.6.2 格式约定

**代码块**：

- 所有代码块必须指定语言标识：` ```bash `、` ```python `、` ```yaml `、` ```json `、` ```markdown `
- 不使用 ` ``` ` 无语言标记的代码块
- 示例中的路径使用占位符，如 `input.shp`、`output.tif`、`data/roads.shp`

**表格**：

- 使用 GFM（GitHub Flavored Markdown）表格格式
- 表头与分隔符对齐不是必须的（仓库使用紧凑格式）
- 不追求表格的视觉花哨，只保证内容正确

**不使用 emoji**：

opengis-skills 的 SKILL.md 不使用 emoji 图标（如 ✅ ❌ 🔧 📦），也不使用 Unicode 装饰符号。正文表达依赖文字本身。标题前的分类标记（如 `### 🧰 数据处理`）仅在 L2 分类索引中少量使用，在 L3 项目级 SKILL.md 中不使用。

**引用格式**：

- 外部链接使用完整 URL（不是相对路径引用内部资源的情况除外）
- 内部引用（链接到其他 SKILL.md 或 reference 文件）使用相对路径
- 引用代码中的关键参数使用反引号：`input`、`output`、`--calc`

### 3.6.3 反例清单

以下是编写中应避免的模式：

| 反例 | 问题 | 正确做法 |
|------|------|---------|
| `## 概述\n\n本项目是一个功能强大的...` | 空洞的形容词 | 直接写它提供什么能力 |
| `> **注意：** 这个功能非常重要！` | 没有说明为什么重要 | 写具体后果："不设置此参数将导致输出文件缺少坐标参考系" |
| 无语言标记的代码块 | AI 无法判断语法 | 始终加 `bash`、`python` 等 |
| API 名字翻译成中文 | 与官方文档脱节 | 保持英文原名，说明用中文 |

---

## 3.7 编写检查清单

写完一个 SKILL.md 后，逐项对照以下清单自检。这些检查点涵盖了前面各节的核心要求：

### Frontmatter 与元数据

- [ ] `name` 全小写，连字符分隔，与目录名一致
- [ ] `description` 遵循 `Use when...` 格式，全英文，不超过 500 字符
- [ ] `description` 包含触发条件、项目定位和关键特性
- [ ] `tags` 覆盖语言/平台标签和功能领域标签
- [ ] 标签命名全小写，连字符分隔，无空格

### 头部引用

- [ ] 包含项目地址（GitHub / GitLab 等源码仓库链接）
- [ ] 包含官方文档链接
- [ ] 包含许可证信息
- [ ] 如项目仓库不可用，已标注警告

### 正文内容

- [ ] 概述不超过 5 句话，优先使用列表呈现特性
- [ ] 安装部分覆盖至少 2 种安装方式
- [ ] 安装部分包含验证命令（如 `--version`）
- [ ] 所有命令/代码示例均可直接运行（非虚构的 API 名称）
- [ ] 代码块均指定了语言标识（`bash`、`python`、`yaml` 等）
- [ ] 包含至少 1 个完整的端到端工作流
- [ ] 工作流包含输入、步骤和输出的完整描述
- [ ] FAQ 至少 5 条，使用表格格式
- [ ] FAQ 覆盖安装、使用、排错三个维度

### 结构与引用

- [ ] 章节顺序符合推荐结构
- [ ] 所有内部相对路径引用正确（`[文字](reference/xxx.md)`）
- [ ] 所有外部 URL 可访问
- [ ] 超过 500 行的文件已考虑 reference 拆分

### 格式与风格

- [ ] 正文使用中文（description 和 tags 除外）
- [ ] 代码、命令、API 名使用英文原文
- [ ] 未使用 emoji 图标（L2 索引级除外）
- [ ] 未出现"功能强大""性能卓越"等空洞形容词
- [ ] 未出现 AI 套话（"综上所述""总而言之""毫无疑问"等）

---

## 3.8 示例：从头编写一个 SKILL.md

为展示完整的编写过程，本节以创建一个假设的 **`libspatialite`** 技能为例，逐步演示从空白到成品的每一步。libspatialite 是一个基于 SQLite 的空间扩展，类似于 PostGIS 但使用 SQLite 作为存储后端。

> 注意：本节是教学演示，不表示 libspatialite 技能已加入仓库。

### 第一步：确定 name 和 tags

先思考这个工具的核心属性：

- **name**：直接使用项目名 `libspatialite`
- **tags**：它用 C 编写，有 Python 绑定，属于空间数据库领域，涉及 SQL 查询。标签定为：

```yaml
name: libspatialite
tags:
  - c
  - python
  - sqlite
  - database
  - spatial
  - sql
  - gis
```

### 第二步：编写 description

按 Use when... 格式，提炼核心能力和触发条件：

```yaml
description: "Use when working with lightweight spatial SQL databases embedded in applications — spatial SQL queries, geometry operations, format import/export. SpatiaLite: spatial extension for SQLite, providing OGC-compliant spatial SQL functions with no server setup."
```

检查点：触发条件（需要内嵌空间数据库）→ 定位（SQLite 空间扩展）→ 关键特性（空间 SQL 查询、几何运算、格式转换、OGC 兼容、免服务端）。

### 第三步：填写引用块

```markdown
> **项目地址：** <https://www.gaia-gis.it/fossil/libspatialite/index>
> **官方文档：** <https://www.gaia-gis.it/gaia-sins/spatialite-cookbook-5/index.html>
> **许可证：** MPL 1.1 / GPL 2.0+
```

### 第四步：写概述

```markdown
## 概述

SpatiaLite 是 SQLite 的空间扩展，使 SQLite 支持 OGC 标准的空间 SQL 查询。它相当于"轻量级 PostGIS"——无需独立数据库服务，一个 `.sqlite` 文件就是完整的空间数据库。

**核心能力：**

- **空间 SQL**：完整的 OGC Simple Features for SQL 实现
- **几何运算**：缓冲区、相交、联合、距离计算等
- **格式支持**：可直接导入/导出 Shapefile、GeoJSON、KML
- **免服务端**：纯文件型数据库，零配置，嵌入式使用
- **Python 支持**：通过 `pysqlite3` 和 `sqlite3` 原生模块访问
```

### 第五步：写安装部分

```markdown
## 环境准备

### 安装

#### Linux (Debian/Ubuntu)

\`\`\`bash
apt-get install libsqlite3-mod-spatialite spatialite-bin
\`\`\`

#### macOS

\`\`\`bash
brew install libspatialite
\`\`\`

#### Conda

\`\`\`bash
conda install -c conda-forge libspatialite
\`\`\`

### 验证安装

\`\`\`bash
spatialite --version
\`\`\`
```

### 第六步：整理核心 API

按"CLI 工具"和"SQL 函数"分组，每组列出常用条目：

```markdown
## 核心命令与 SQL 函数

### CLI 工具

- `spatialite` — 交互式 SQL 终端，支持空间扩展
- `spatialite_tool` — 数据库信息查询和导入导出

### 常用空间 SQL 函数

| 函数 | 说明 |
|------|------|
| `ST_Intersects(A, B)` | 判断两个几何是否相交 |
| `ST_Buffer(geom, distance)` | 创建缓冲区 |
| `ST_Union(A, B)` | 合并几何 |
| `ST_Area(geom)` | 计算面积 |
| `AsGeoJSON(geom)` | 输出为 GeoJSON |

\`\`\`sql
-- 查询指定范围内的要素
SELECT name, AsGeoJSON(geom)
FROM places
WHERE ST_Intersects(geom, ST_Buffer(MakePoint(116.4, 39.9, 4326), 0.01));
\`\`\`
```

### 第七步：编写工作流示例

```markdown
## 典型工作流

### Shapefile 导入并空间查询

\`\`\`bash
# 1. 创建新数据库
spatialite mydata.sqlite "SELECT InitSpatialMetaData(1);"

# 2. 导入 Shapefile
spatialite_tool -i -shp roads -d mydata.sqlite -t roads -c UTF-8

# 3. 执行空间查询
spatialite mydata.sqlite "SELECT name, ST_Length(geom) FROM roads WHERE road_type = 'highway';"

# 4. 导出为 GeoJSON
spatialite mydata.sqlite ".loadshp roads result" -c UTF-8
\`\`\`
```

### 第八步：补充 FAQ

```markdown
## 常见问题

| 问题 | 答案 |
|------|------|
| 如何检查 SpatiaLite 版本？ | `spatialite --version` |
| SQLite 和 SpatiaLite 有什么区别？ | SQLite 本身不支持空间数据类型和函数；SpatiaLite 通过扩展提供 OGC 兼容的空间 SQL |
| 如何从普通 SQLite 升级到 SpatiaLite？ | 加载 SpatiaLite 扩展并执行 `SELECT InitSpatialMetaData(1);` |
| 支持哪些坐标参考系？ | 内置 EPSG 数据集，支持通过 `srs_id` 指定任意 CRS |
| 如何连接 Python 使用 SpatiaLite？ | 使用 `sqlite3` 模块并在连接后加载扩展：`conn.load_extension('mod_spatialite')` |
```

### 第九步：自检

对照 3.7 节的检查清单：

- [x] `name` 全小写，连字符分隔 ✓
- [x] `description` 遵循 Use when... 格式，全英文 ✓
- [x] `tags` 覆盖语言（c, python）和功能领域（database, spatial, sql） ✓
- [x] 包含项目地址、官方文档、许可证 ✓
- [x] 概述不超过 5 句话，用列表呈现特性 ✓
- [x] 安装覆盖 Linux/macOS/Conda 三种方式 ✓
- [x] 安装包含验证命令 ✓
- [x] 所有 SQL 命令可运行 ✓
- [x] 代码块有语言标记 ✓
- [x] 包含 1 个完整工作流（导入→查询→导出） ✓
- [x] FAQ 5 条，表格格式 ✓
- [x] 未使用 emoji，未出现空洞形容词 ✓

完成。这就是一个符合 opengis-skills 规范的 SKILL.md 文件的完整编写过程。

---

## 本章小结

本章系统介绍了 opengis-skills 的 SKILL.md 编写规范，从文件结构到每个字段的细节约定，再到拆分策略和自检清单。核心要点回顾：

1. **YAML frontmatter 是入口**——`description` 必须用英文 `Use when...` 格式，这是 AI 工具发现技能的唯一匹配源
2. **正文用中文，代码用英文**——保持与官方文档一致的同时，让中文读者无障碍理解
3. **表格是 FAQ 和 API 速览的最佳格式**——AI 可以快速定位，人类可以快速扫描
4. **工作流是将零散 API 串联为实用方案的关键**——没有工作流的 SKILL.md 只是参考手册的摘抄
5. **超过 500 行要拆分到 reference/**——保持主文件的精悍和可加载性
6. **写完后对照检查清单自检**——确保 frontmatter、代码可运行性、格式一致性全部到位

下一章将介绍如何将编写好的 SKILL.md 集成到不同的 AI 编程工具中，让它们真正"学会"这些技能。

---
layout: default
title: 附录A 术语表
---

# 附录A 术语表

> **本篇导读**
>
> 术语表是整套教程的“度量衡”：翻模项目里大量的返工与争议，并不是技术做不出来，而是双方对同一个词的理解不同。本附录收 16 个核心术语，按“在本文中的用法”给出解释，并保留英文与缩写，便于对照标准原文、招标文件与软件界面。建议读到含义不确定的词时回来查表，也建议在项目启动会上用这张表统一口径，再谈精度与价格。

## 使用说明

- **用途**：本表是系列教程的术语底稿，用于统一正文、评审与投标文件中的表述；遇到同一概念有多种说法时，以“本文用法”列为准，再回正文确认上下文。
- **口径**：词条按“在本教程中的用法”解释，只保留与翻模相关的那一层含义，不追求词典意义上的完备；写进合同或报审文件前，应回到所引标准的原文核对，不用教程口径替代法定义务。
- **边界**：表内术语覆盖第 01—14 章出现的核心概念；地方标准、厂商文档与项目专有名词不在收录范围，遇到时以原文为准，不作跨体系强行统一。
- **编号约定**：术语表沿用原报告全局编号（表 40），后续增补顺延编号，不按章节重排；英文与缩写以首次出现的形式为准，同义译名只在“本文用法”列并列。

同名不同义是翻模项目最常见的沟通成本；这份术语表按“在本文中的用法”给出解释。

**表 40  核心术语**

| 术语 | 英文 / 缩写 | 本文用法 |
| --- | --- | --- |
| 翻模 | Drawing-based Reconstruction, CAD-to-BIM | 以二维图纸为主要依据重建三维构件模型的过程 |
| 正向设计 | BIM-based Design | 从三维模型出发完成设计与出图，与翻模方向相反 |
| 点云逆向 | Scan-to-BIM | 以激光扫描或摄影测量点云为依据重建模型 |
| 模型深度 | Level of Development (LOD) | 模型几何与信息完整程度的统称，不同体系定义不同 |
| 信息深度 | Level of Information Need | 构件应携带的信息内容与详细程度 |
| 图模一致性 | Drawing-Model Consistency | 模型与图纸在构件层面的一致性 |
| BEP | BIM Execution Plan | 项目 BIM 执行计划，约定标准、流程与责任 |
| 样板文件 | Template | 预置单位、坐标、视图、明细表、构件库的建模起点文件 |
| 构件库 | Component / Family Library | 可复用的标准构件集合 |
| 属性字典 | Attribute Dictionary | 字段名、类型、取值范围与必填规则的集合 |
| 轻量化 | Model Lightweighting | 为浏览与传输优化模型体积与加载方式 |
| IFC | Industry Foundation Classes | buildingSMART 制定的开放 BIM 数据交换标准 |
| 3D Tiles | OGC 3D Tiles | 面向海量三维地理数据的流式传输标准 |
| glTF | GL Transmission Format | Khronos 制定的三维场景传输格式 |
| CGCS2000 | China Geodetic Coordinate System 2000 | 国家大地坐标系 2000 |
| LOD 陷阱 | LOD Ambiguity | 同一等级在不同主体间理解不一致导致的工作量争议 |

资料来源：本报告整理。

## 使用提醒

- 本表按“在本文中的用法”解释，不是标准术语定义；同名不同义在翻模项目里是常态，LOD 与信息深度尤其如此，谈判前先把口径写进合同，再讨论价格。
- 轻量化在本教程特指为浏览与传输优化模型体积与加载方式，不等于降低交付精度；项目若要求简化模型，应在合同里单独约定简化后的精度底线。
- 术语表随教程与标准更新而增补；新增词条顺延编号（表 40 之后），不与章节号绑定，也不因调序而重排。
- 遇到表内未收录的名词，先查[第03章 政策、标准与合规](https://znlgis.github.io/gis/bpc/cadfm/第03章-政策标准与合规/)的标准清单与[附录D 主要资料来源](https://znlgis.github.io/gis/bpc/cadfm/附录D-主要资料来源/)，不要凭印象造词或自造缩写。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/bpc/cadfm/第14章-常见问题与故障排除/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/bpc/cadfm/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/bpc/cadfm/附录B-质检清单/" class="chapter-nav__next">下一章 →</a>
</div>

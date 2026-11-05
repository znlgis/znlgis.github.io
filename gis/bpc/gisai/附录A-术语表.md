---
layout: default
title: 附录A 术语表
---

# 附录A 术语表

> **本篇导读**
>
> 术语表只有一个用法：读到不认识的词就回来查。本附录收 18 条与 GIS×AI 相关的术语：GeoFM、Embedding、冻结编码器对第 5 章；变化检测、精度饱和区对第 4 章；空间智能、空间智能体、智能体原生与 MCP 对第 6—7 章；时空智能对第 2 章；审图号对第 12—13 章；人在环对第 10 章。每条只给一句话定位，不替代正文；判定条件与阈值以对应小节原文为准。

| 术语 | 英文/缩写 | 说明 |
| --- | --- | --- |
| 地理空间基础模型 | GeoFM | 在大规模地理空间数据上预训练、可迁移到多种下游任务的基础模型 |
| 地球观测基础模型 | EO Foundation Model | 面向卫星遥感观测数据的预训练模型，GeoFM 的主要子类 |
| 空间智能 | Spatial Intelligence | 对空间关系、位置、尺度、拓扑的理解与推理能力；2026 年成为产业核心叙事 |
| 时空智能 | Spatio-Temporal Intelligence | 国内语境下对“AI + 时空信息”融合能力的表述，2026 年 10 月被提出为“时空智能+”行动 |
| 空间智能体 | Spatial Agent | 能理解自然语言空间任务、自主调用 GIS 工具与模型完成任务的智能体系统 |
| 智能体原生 | Agent-Native | 以智能体作为系统中枢与主要交互入口的软件架构理念 |
| 嵌入/特征向量 | Embedding | 把地表观测压缩为固定维度的数值向量（如 OlmoEarth 的 128 维），用于相似性比较与下游分类 |
| 变化检测 | Change Detection | 识别同一区域不同时相之间的地表变化，自然资源监测的核心任务 |
| 冻结编码器 | Frozen Encoder | 预训练模型参数不再更新，仅训练下游头的评估策略，用于衡量基础模型的迁移能力 |
| 人在环 | Human-in-the-loop | 保留人工确认环节的 AI 应用模式，是当前 GIS 场景的主流责任架构 |
| MCP | Model Context Protocol | 模型与外部工具的标准调用协议，2025—2026 年在 GIS 领域成为事实标准 |
| 审图号 | Map Approval Number | 地图经审核后获得的编号，公开发布地图的法定标识，有效期 2 年 |
| 实景三维中国 | — | 国家级三维地理空间数据基础设施，“十四五”期间初步建成（2025-12-30 宣布） |
| CIM | City Information Model | 城市信息模型，与 GIS、BIM、IoT 融合的城市级数字底座 |
| RAG | Retrieval-Augmented Generation | 检索增强生成，让模型基于检索到的知识回答，降低幻觉 |
| LoRA | Low-Rank Adaptation | 低秩微调方法，大幅降低模型微调成本 |
| 3DGS | 3D Gaussian Splatting | 三维高斯泼溅，快速三维重建与渲染技术，近年用于城市建模 |
| 精度饱和区 | Accuracy Saturation | 指在该基准上继续提升已无业务意义的区间，方法间差异小于标注噪声 |

## 使用提醒

- 术语只给一句话定位，判定条件、阈值与标准条文以正文对应小节为准，不要用本表代替原文。
- 中文提法以本教程正文为准：空间智能对应国际叙事，时空智能对应国内“时空智能+”行动，两者不要互换。
- 英文缩写按正文出现过的写法收录；厂商私有格式或正文未出现的变体不收录，遇到时回厂商文档核对。
- 产品与标准会随时间变化：本表不标版本年份，MCP、3DGS 这类技术的现状以官方文档与最新标准状态为准。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/bpc/gisai/第14章-前景与行动六条主线行动建议与三句话/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/bpc/gisai/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/bpc/gisai/附录B-技术与场景的匹配矩阵/" class="chapter-nav__next">下一章 →</a>
</div>

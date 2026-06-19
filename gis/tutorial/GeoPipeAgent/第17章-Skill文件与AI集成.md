---
layout: default
title: "第十七章：Skill 文件与 AI 集成"
---

# 第十七章：Skill 文件与 AI 集成

GeoPipeAgent 的 AI 集成能力是其核心价值之一。本章介绍 Skill 文件的结构、生成方式，以及如何将 AI（如 ChatGPT、Claude）与 GeoPipeAgent 结合，实现自然语言驱动的 GIS 分析。

---

## 17.1 AI 集成理念

GeoPipeAgent 的 AI 集成遵循以下设计理念：

1. **AI 是操作者**：AI 负责理解用户需求、生成 YAML 流水线
2. **框架是执行者**：框架负责校验和执行 AI 生成的流水线
3. **JSON 报告是反馈**：执行结果以结构化 JSON 返回给 AI，AI 可以解读结果并给出建议
4. **Skill 文件是接口**：Skill 文件精确描述框架能力，让 AI 无需猜测

这形成了一个完整闭环：**用户需求 → AI 生成 YAML → 框架执行 → JSON 报告 → AI 解读 → 用户获得结果**。

---

## 17.2 Skill 文件结构

通过 `geopipe-agent generate-skill` 生成的 Skill 文件集：

```
skills/geopipe-agent/
├── SKILL.md                        # AI 入口文档
└── reference/
    ├── steps-reference.md          # 步骤参数完整参考（auto-generated）
    └── pipeline-schema.md          # YAML Schema 文档
```

### 17.2.1 `SKILL.md`：AI 入口文档

`SKILL.md` 是为 AI 设计的简洁入门文档，包含：
- 框架功能概述
- 使用流程说明
- 快速 YAML 示例
- 步骤类别速查表
- QC 步骤的"检查并透传"机制说明

```bash
geopipe-agent generate-skill --output-dir skills
cat skills/geopipe-agent/SKILL.md
```

### 17.2.2 `reference/steps-reference.md`：步骤参考

自动生成的步骤参考文档，包含每个步骤的：
- ID 和名称
- 参数表（含类型、是否必填、默认值、说明）
- 输出描述
- 使用示例
- 支持的后端

```bash
geopipe-agent generate-skill-doc > reference.md
```

### 17.2.3 `reference/pipeline-schema.md`：YAML Schema

完整的 YAML 流水线格式说明，包含：
- 顶层结构示例
- 引用语法表（`$step`、`${var}` 等）
- 步骤 ID 规则
- `when` 条件表达式语法
- 错误处理策略说明

---

## 17.3 生成 Skill 文件

```bash
# 生成到默认目录 skills/geopipe-agent/
geopipe-agent generate-skill

# 指定输出目录
geopipe-agent generate-skill --output-dir /tmp/geopipe-skills

# 仅生成步骤参考（单个 Markdown 文件）
geopipe-agent generate-skill-doc > my-steps-reference.md
```

生成的文件是**基于当前注册步骤的实时快照**。如果添加了自定义步骤，重新运行即可更新文档。

---

## 17.4 与大语言模型集成

### 方式一：直接对话（ChatGPT / Claude）

**推荐工作流**：

```
步骤1: 生成 Skill 文件
$ geopipe-agent generate-skill

步骤2: 将以下内容提供给 AI（粘贴到对话中）
  - skills/geopipe-agent/SKILL.md（必须）
  - skills/geopipe-agent/reference/steps-reference.md（建议）
  - 数据文件信息（geopipe-agent info 的输出）

步骤3: 向 AI 描述分析需求
  "我有一份 EPSG:4326 的道路 Shapefile，需要做 500 米缓冲区分析，
   先进行几何质检，有问题则自动修复，最终输出 GeoJSON"

步骤4: AI 生成 YAML 流水线

步骤5: 校验并执行
$ geopipe-agent validate ai-pipeline.yaml
$ geopipe-agent run ai-pipeline.yaml

步骤6: 将 JSON 报告返回 AI 解读（如有错误）
```

### 方式二：系统提示词（System Prompt）

将 Skill 文件内容嵌入 AI 的系统提示词，实现持久化 GIS 分析能力：

```markdown
# System Prompt（示例）

你是一个专业的 GIS 分析师，使用 GeoPipeAgent 框架执行分析。

## 工具说明
[粘贴 SKILL.md 内容]

## 步骤参考
[粘贴 steps-reference.md 内容]

## 工作规则
1. 用户提出 GIS 分析需求时，生成 YAML 流水线
2. 总是先确认输入文件的 CRS（向用户询问或通过 info 命令获取）
3. 投影坐标系中进行距离相关分析（缓冲、服务区等）
4. 对重要数据添加 QC 步骤
5. 当执行报告中有错误时，分析原因并提供修复建议
```

### 方式三：Copilot / 代码补全

将 Skill 文件放在项目目录中，让代码编辑器的 AI 助手（GitHub Copilot、Cursor 等）自动获取上下文。

---

## 17.5 提示词最佳实践

### 有效的需求描述模板

```
我有以下数据：
- 文件：[文件路径]
- 格式：[GeoJSON/Shapefile/GeoTIFF]
- CRS：[EPSG:4326 等]
- 字段：[相关字段名]
- 要素数：[数量级]

我需要：
[具体分析需求，包括：
  - 分析目标
  - 输出格式和路径
  - 需要哪些质检
  - 任何特殊要求]

请生成 GeoPipeAgent YAML 流水线。
```

### 示例提示词

```
我有以下数据：
- 文件：data/poi.geojson（兴趣点）和 data/districts.shp（行政区划）
- POI 字段：name, type, lng, lat
- 行政区划 CRS：EPSG:4326
- 约 50,000 个 POI

我需要：
1. 统计每个行政区内的 POI 数量
2. 进行 DBSCAN 聚类找出 POI 热点（邻域半径 500 米，最小 20 个点）
3. 将聚类结果（去掉噪声点）输出为 output/poi_clusters.geojson
4. 先将数据转换为 EPSG:3857（米制）再进行距离相关分析

请生成 GeoPipeAgent YAML 流水线，并说明每个步骤的作用。
```

---

## 17.6 JSON 报告的 AI 解读

执行报告的 JSON 结构设计为"AI 友好"格式，以下是示例解读提示：

```
以下是 GeoPipeAgent 流水线执行报告，请分析：
1. 流水线是否成功？
2. 各步骤执行情况如何？
3. 如果有 QC 问题，请说明类型和数量
4. 如果有步骤失败，请根据 suggestion 字段提供修复建议

[粘贴 JSON 报告]
```

---

## 17.7 `skillgen/generator.py`：Skill 生成器原理

Skill 生成器位于 `src/geopipe_agent/skillgen/generator.py`，提供以下函数：

```python
generate_steps_reference() -> str
    # 遍历 registry.list_all()，按类别生成 Markdown 参数表

generate_pipeline_schema_doc() -> str
    # 返回预定义的 YAML Schema 文档字符串

generate_skill_file() -> str
    # 返回 SKILL.md 内容（AI 入口文档，含快速示例）

write_skill_files(output_dir) -> list[str]
    # 将所有文件写入目录，返回生成的文件路径列表
```

由于 `generate_steps_reference()` 从注册表实时读取，每次重新安装或添加自定义步骤后，运行 `generate-skill` 可更新文档。

---

## 17.8 自定义 Skill 扩展

如需在 Skill 文档中添加自定义内容（如公司特定的使用规范、常见任务模板等），可以在生成后手动编辑 `SKILL.md`，或在 Python 中扩展 `generate_skill_file()`：

```python
from geopipe_agent.skillgen.generator import generate_skill_file

def my_custom_skill():
    base = generate_skill_file()
    custom = """
## 公司特定规则

- 输出目录始终使用 `/data/output/`
- 所有数据必须先经过 `qc.geometry_validity` 检查
- 投影使用 EPSG:4549（CGCS2000）
"""
    return base + custom
```

---

## 17.9 本章小结

本章介绍了 GeoPipeAgent 与 AI 的集成方式：

1. **Skill 文件**：3 个文件（SKILL.md + 步骤参考 + Schema），供 AI 理解框架
2. **生成命令**：`geopipe-agent generate-skill` 自动生成，基于实时注册步骤
3. **集成方式**：对话粘贴、系统提示词、代码补全三种方式
4. **提示词模板**：提供数据描述和需求说明，让 AI 准确生成流水线
5. **JSON 报告解读**：结构化报告方便 AI 分析执行结果并提供建议

---

**导航**：[← 第十六章：CLI 命令行工具](第16章-CLI命令行工具) ｜ [第十八章：自定义步骤与扩展 →](第18章-自定义步骤与扩展开发)

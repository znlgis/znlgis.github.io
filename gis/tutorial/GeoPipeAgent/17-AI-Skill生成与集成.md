---
layout: default
title: "第17章：AI Skill 生成与集成"
---

# 第17章：AI Skill 生成与集成

> 本章深入解析 GeoPipeAgent 的 AI Skill 生成系统，包括 Skill 文件的结构设计、生成器的源码实现、AI 工作流实战以及与主流 AI 平台的集成方式，展示框架 AI-Native 理念的核心体现。

---

## 17.1 AI Skill 概述

### 17.1.1 什么是 Skill 文件

在 AI-Native 的设计理念中，**Skill 文件** 是一组结构化的文档，用于向大语言模型（LLM）描述一个工具的能力、用法和约束。可以将其理解为 **"给 AI 看的用户手册"**。

传统的软件文档面向人类用户编写，包含大量叙述性文字、截图和背景说明。而 Skill 文件面向 AI 优化，强调：

- **结构化**：使用明确的层次结构和表格，便于 AI 提取关键信息
- **精确性**：参数类型、必需/可选、默认值等信息一目了然
- **示例驱动**：通过丰富的 YAML 示例让 AI 学习正确的输出格式
- **模式化**：定义常见的使用模式（如 QC 模式、ETL 模式），帮助 AI 快速匹配需求

### 17.1.2 为什么需要 Skill 文件

大语言模型的知识来源于训练数据，它们不了解 GeoPipeAgent 这样的专业工具。通过提供 Skill 文件：

```
┌──────────────────────────────────────────────────────────────┐
│                    没有 Skill 文件                            │
│                                                              │
│  用户: "帮我做缓冲区分析"                                     │
│  AI:   "你可以用 ArcGIS 的 Buffer 工具..."  ← 不了解框架     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                    有 Skill 文件                              │
│                                                              │
│  用户: "帮我做缓冲区分析"                                     │
│  AI:   生成正确的 YAML 流水线:                                │
│        steps:                                                │
│          - id: load_data                                     │
│            use: io.read_vector                               │
│            params:                                           │
│              file: ${var.input_file}                         │
│          - id: buffer                                        │
│            use: vector.buffer                                │
│            params:                                           │
│              input: $load_data                               │
│              distance: ${var.buffer_distance}                │
└──────────────────────────────────────────────────────────────┘
```

### 17.1.3 AI-Native 设计理念

GeoPipeAgent 从设计之初就将 AI 集成作为核心目标。这体现在多个层面：

1. **YAML 流水线**：人类可读、AI 可生成的声明式格式
2. **结构化错误**：JSON 格式的错误信息，AI 可解析并给出修复建议
3. **Skill 生成器**：自动从代码生成 AI 可理解的能力描述
4. **变量系统**：支持 AI 为流水线参数化，方便用户后续调整

---

## 17.2 Skill 文件结构

### 17.2.1 文件目录布局

通过 `geopipe-agent generate-skill` 命令生成的 Skill 文件集包含以下结构：

```
skills/geopipe-agent/
├── SKILL.md                          # 主 Skill 描述文件
└── reference/
    ├── steps-reference.md            # 步骤参考文档
    └── pipeline-schema.md            # YAML Schema 文档
```

### 17.2.2 各文件职责

| 文件 | 职责 | 主要读者 |
|------|------|----------|
| `SKILL.md` | 框架总览、快速示例、步骤分类、QC 模式 | AI（首先阅读） |
| `reference/steps-reference.md` | 所有步骤的详细参数和输出定义 | AI（按需查阅） |
| `reference/pipeline-schema.md` | YAML 流水线的完整 Schema 定义 | AI（生成 YAML 时参考） |

### 17.2.3 分层设计的考虑

为什么不将所有信息放在一个文件中？这是基于 LLM 的上下文窗口限制的考虑：

- **SKILL.md** 提供概览和常见模式，在大多数情况下足够 AI 生成正确的流水线
- **steps-reference.md** 在 AI 需要某个步骤的具体参数时查阅，避免一次性加载全部信息
- **pipeline-schema.md** 在 AI 需要了解高级语法（如条件执行、错误处理策略）时参考

这种分层方式可以有效利用 AI 的有限上下文窗口，提高生成质量。

---

## 17.3 generate_steps_reference() —— 步骤参考生成

### 17.3.1 功能说明

`generate_steps_reference()` 是 `skillgen/generator.py` 中的核心函数，它遍历步骤注册表，为每个步骤生成标准化的 Markdown 参考文档。

### 17.3.2 生成逻辑

```python
def generate_steps_reference():
    """从步骤注册表生成步骤参考 Markdown 文档"""
    lines = ["# GeoPipeAgent Steps Reference", ""]

    # 按类别分组
    categories = {}
    for step_id, step_meta in registry.items():
        cat = step_meta["category"]
        categories.setdefault(cat, []).append((step_id, step_meta))

    # 按类别生成文档
    for cat_name, steps in sorted(categories.items()):
        lines.append(f"## {cat_name} 类别")
        lines.append("")

        for step_id, meta in sorted(steps):
            lines.append(f"### {step_id} — {meta['name']}")
            lines.append("")
            lines.append(meta.get("description", ""))
            lines.append("")

            # 参数表格
            if meta.get("params"):
                lines.append("| 参数 | 类型 | 必需 | 默认值 | 说明 |")
                lines.append("|------|------|------|--------|------|")
                for param_name, param_def in meta["params"].items():
                    required = "✓" if param_def.get("required") else ""
                    default = param_def.get("default", "-")
                    lines.append(
                        f"| {param_name} | {param_def['type']} "
                        f"| {required} | {default} | {param_def.get('description', '')} |"
                    )
                lines.append("")

            # 输出表格
            if meta.get("outputs"):
                lines.append("**输出:**")
                lines.append("")
                for out_name, out_def in meta["outputs"].items():
                    lines.append(f"- `{out_name}`: {out_def.get('description', '')}")
                lines.append("")

            # 支持的后端
            if meta.get("backends"):
                lines.append(f"**后端**: {', '.join(meta['backends'])}")
                lines.append("")

            lines.append("---")
            lines.append("")

    return "\n".join(lines)
```

### 17.3.3 生成的文档示例

```markdown
# GeoPipeAgent Steps Reference

## io 类别

### io.read_vector — Read Vector Data

读取矢量数据文件，支持 Shapefile、GeoPackage、GeoJSON 等格式。

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| file | string | ✓ | - | 输入文件路径 |
| layer | string | | None | 图层名（多图层格式） |
| encoding | string | | utf-8 | 文件编码 |
| bbox | array | | None | 空间过滤范围 [minx, miny, maxx, maxy] |

**输出:**

- `output`: 读取的 GeoDataFrame

**后端**: native_python, geopandas

---

### io.write_vector — Write Vector Data

将矢量数据写入文件，支持多种输出格式。

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| input | layer | ✓ | - | 输入矢量图层 |
| file | string | ✓ | - | 输出文件路径 |
| driver | string | | auto | 输出格式驱动 |
| encoding | string | | utf-8 | 文件编码 |

**输出:**

- `output`: 写入的文件路径

**后端**: native_python, geopandas, fiona

---
```

### 17.3.4 设计要点

生成的文档遵循以下原则：

1. **表格化参数**：便于 AI 快速提取参数名、类型和约束
2. **一致的格式**：所有步骤使用相同的文档结构
3. **完整性**：包含所有已注册步骤，不遗漏任何参数
4. **自动更新**：每次生成时从注册表实时读取，确保与代码同步

---

## 17.4 generate_pipeline_schema_doc() —— YAML Schema 文档

### 17.4.1 功能说明

`generate_pipeline_schema_doc()` 生成 YAML 流水线的完整 Schema 文档，帮助 AI 理解流水线的语法结构。

### 17.4.2 Schema 文档内容

生成的文档包含以下部分：

#### 流水线顶层结构

```markdown
## Pipeline YAML Schema

### 顶层字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | ✓ | 流水线名称 |
| description | string | | 流水线描述 |
| vars | object | | 变量定义 |
| steps | array | ✓ | 步骤列表 |
```

#### 变量引用语法

```markdown
### 变量引用

- 变量引用: `${var.variable_name}`
- 步骤输出引用: `$step_id`
- 步骤统计引用: `$step_id.stats.key`
```

#### 条件执行语法

```markdown
### 条件执行

```yaml
steps:
  - id: conditional_step
    use: io.write_vector
    when: "$qc_check.stats.pass_rate > 0.95"
    params:
      input: $process_data
      file: output/result.gpkg
```
```

#### 错误处理策略

```markdown
### 错误处理

```yaml
steps:
  - id: risky_step
    use: vector.overlay
    on_error: skip    # 可选值: fail (默认), skip, retry
    params:
      ...
```
```

### 17.4.3 引用语法详解

Schema 文档中会详细说明三种引用语法：

| 语法 | 含义 | 示例 |
|------|------|------|
| `${var.name}` | 引用变量值 | `${var.buffer_distance}` |
| `$step_id` | 引用步骤的主输出 | `$load_data` |
| `$step_id.stats.key` | 引用步骤的统计信息 | `$qc_check.stats.pass_rate` |

---

## 17.5 generate_skill_file() —— 主 Skill 文件

### 17.5.1 功能说明

`generate_skill_file()` 生成主 SKILL.md 文件，这是 AI 首先阅读的文件，包含框架的整体能力描述和常见使用模式。

### 17.5.2 SKILL.md 结构

生成的 SKILL.md 包含以下核心部分：

```markdown
# GeoPipeAgent Skill

## Overview
GeoPipeAgent 是一个 AI-Native 的 GIS 数据分析流水线框架...

## Quick Start
一个最简单的流水线示例...

## Step Categories
步骤按类别分为: io, vector, raster, spatial, network, qc...

## Common Patterns
### ETL 模式
读取 → 处理 → 保存

### QC 模式
读取 → 多项质检 → 条件保存

### Analysis 模式
读取多层 → 空间分析 → 保存结果

## Reference
- [Steps Reference](reference/steps-reference.md)
- [Pipeline Schema](reference/pipeline-schema.md)
```

### 17.5.3 快速示例部分

SKILL.md 中包含的快速示例帮助 AI 理解基本的流水线结构：

```yaml
# 基本分析流水线
name: Buffer Analysis
description: 对道路进行缓冲区分析
vars:
  input_file: data/roads.shp
  buffer_distance: 500
  output_file: output/buffer_result.gpkg

steps:
  - id: load_data
    use: io.read_vector
    params:
      file: ${var.input_file}

  - id: reproject
    use: vector.reproject
    params:
      input: $load_data
      target_crs: "EPSG:3857"

  - id: buffer
    use: vector.buffer
    params:
      input: $reproject
      distance: ${var.buffer_distance}

  - id: save
    use: io.write_vector
    params:
      input: $buffer
      file: ${var.output_file}
```

### 17.5.4 步骤分类总览

SKILL.md 按类别列出所有步骤，让 AI 快速了解可用的能力：

```markdown
## Step Categories

### io — 数据读写 (4 步骤)
- `io.read_vector`: 读取矢量数据
- `io.write_vector`: 写入矢量数据
- `io.read_raster`: 读取栅格数据
- `io.write_raster`: 写入栅格数据

### vector — 矢量分析 (7 步骤)
- `vector.buffer`: 缓冲区分析
- `vector.reproject`: 坐标系转换
- `vector.clip`: 裁剪
- `vector.overlay`: 叠加分析
- `vector.dissolve`: 融合
- `vector.query`: 查询过滤
- `vector.simplify`: 简化几何

### raster — 栅格分析
- `raster.calc`: 栅格计算
- `raster.reproject`: 栅格重投影
- `raster.clip`: 栅格裁剪
...

### qc — 数据质检
- `qc.geometry_validity`: 几何有效性检查
- `qc.topology`: 拓扑检查
- `qc.crs_check`: 坐标系检查
- `qc.attribute_completeness`: 属性完整性检查
- `qc.attribute_domain`: 属性值域检查
- `qc.value_range`: 值范围检查
- `qc.duplicate_check`: 重复要素检查
...
```

### 17.5.5 QC 模式详解

SKILL.md 特别详细地描述了 QC（数据质检）模式，这是 GeoPipeAgent 的核心使用场景之一：

```markdown
## QC Pattern

数据质检流水线的标准模式：

```yaml
name: Vector QC Pipeline
steps:
  - id: load
    use: io.read_vector
    params:
      file: ${var.input_file}

  - id: check_crs
    use: qc.crs_check
    params:
      input: $load
      expected_crs: "EPSG:4326"

  - id: check_geometry
    use: qc.geometry_validity
    params:
      input: $load
      auto_fix: true

  - id: check_topology
    use: qc.topology
    params:
      input: $check_geometry
      rules: ["no_self_intersection", "no_overlap"]

  - id: save_if_passed
    use: io.write_vector
    when: "$check_topology.stats.pass_rate >= 0.95"
    params:
      input: $check_geometry
      file: ${var.output_file}
```

质检模式的关键要素:
1. 逐步检查不同维度
2. 支持 auto_fix 自动修复
3. 使用 when 条件控制后续步骤
4. 通过 stats 传递质检结果
```

---

## 17.6 write_skill_files() —— 文件写入逻辑

### 17.6.1 功能说明

`write_skill_files(output_dir)` 是最终的写入函数，负责将所有生成的内容写入文件系统。

### 17.6.2 实现逻辑

```python
def write_skill_files(output_dir="skills/geopipe-agent"):
    """将 Skill 文件写入指定目录"""
    import os

    # 创建目录结构
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(os.path.join(output_dir, "reference"), exist_ok=True)

    # 生成并写入主 Skill 文件
    skill_content = generate_skill_file()
    with open(os.path.join(output_dir, "SKILL.md"), "w", encoding="utf-8") as f:
        f.write(skill_content)

    # 生成并写入步骤参考
    steps_ref = generate_steps_reference()
    with open(os.path.join(output_dir, "reference", "steps-reference.md"), "w", encoding="utf-8") as f:
        f.write(steps_ref)

    # 生成并写入 Schema 文档
    schema_doc = generate_pipeline_schema_doc()
    with open(os.path.join(output_dir, "reference", "pipeline-schema.md"), "w", encoding="utf-8") as f:
        f.write(schema_doc)
```

### 17.6.3 写入确认

函数完成后会输出写入文件的摘要：

```
✓ 写入 SKILL.md (12,345 bytes)
✓ 写入 reference/steps-reference.md (28,901 bytes)
✓ 写入 reference/pipeline-schema.md (8,567 bytes)

Skill 文件已生成到: skills/geopipe-agent/
```

### 17.6.4 幂等性

`write_skill_files()` 设计为 **幂等操作**——多次运行会覆盖已有文件，不会产生重复内容。这允许在代码更新后安全地重新生成 Skill 文件。

---

## 17.7 AI 工作流实战

### 17.7.1 完整工作流程

使用 GeoPipeAgent + AI 的完整工作流程如下：

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: 生成 Skill 文件                                     │
│  $ geopipe-agent generate-skill                              │
│                                                              │
│  Step 2: 将 Skill 文件提供给 AI                              │
│  (粘贴 SKILL.md 内容到 AI 对话中)                            │
│                                                              │
│  Step 3: 用自然语言描述需求                                   │
│  "帮我分析北京市的道路数据,做500米缓冲区并保存为GeoPackage"    │
│                                                              │
│  Step 4: AI 生成 YAML 流水线                                 │
│  (AI 根据 Skill 知识生成正确的 YAML)                         │
│                                                              │
│  Step 5: 校验并执行                                          │
│  $ geopipe-agent validate pipeline.yaml                      │
│  $ geopipe-agent run pipeline.yaml                           │
│                                                              │
│  Step 6: AI 解读结果                                         │
│  (将执行结果反馈给 AI,获取分析建议)                          │
└─────────────────────────────────────────────────────────────┘
```

### 17.7.2 实战示例：从需求到执行

**Step 1**：生成 Skill 文件

```bash
geopipe-agent generate-skill
```

**Step 2**：将 SKILL.md 提供给 AI

将 `skills/geopipe-agent/SKILL.md` 的内容粘贴到 AI 对话的系统提示或对话开头。

**Step 3**：自然语言描述需求

```
我有一份北京市的道路数据（roads.shp，坐标系 EPSG:4326），需要：
1. 转换到 EPSG:3857 投影坐标系
2. 对主干道（road_type = 'primary'）做 500 米缓冲区
3. 保存为 GeoPackage 格式
```

**Step 4**：AI 生成的 YAML

```yaml
name: 北京市主干道缓冲区分析
description: 筛选主干道并进行 500 米缓冲区分析

vars:
  input_file: data/roads.shp
  buffer_distance: 500
  output_file: output/primary_road_buffer.gpkg

steps:
  - id: load_roads
    use: io.read_vector
    params:
      file: ${var.input_file}

  - id: reproject
    use: vector.reproject
    params:
      input: $load_roads
      target_crs: "EPSG:3857"

  - id: filter_primary
    use: vector.query
    params:
      input: $reproject
      expression: "road_type == 'primary'"

  - id: buffer
    use: vector.buffer
    params:
      input: $filter_primary
      distance: ${var.buffer_distance}

  - id: save
    use: io.write_vector
    params:
      input: $buffer
      file: ${var.output_file}
```

**Step 5**：校验并执行

```bash
# 先校验
geopipe-agent validate pipeline.yaml
# ✓ 校验通过

# 执行
geopipe-agent run pipeline.yaml
```

**Step 6**：将结果反馈给 AI

```
执行结果:
{
  "status": "success",
  "steps_completed": 5,
  "outputs": {
    "load_roads": {"rows": 12345, "crs": "EPSG:4326"},
    "filter_primary": {"rows": 2341},
    "buffer": {"rows": 2341, "crs": "EPSG:3857"},
    "save": {"file": "output/primary_road_buffer.gpkg"}
  }
}
```

AI 可以解读结果并给出后续建议：

> "分析完成！从 12,345 条道路中筛选出 2,341 条主干道，缓冲区结果已保存。建议你可以进一步对缓冲区做融合（dissolve）操作，避免相邻缓冲区重叠。"

### 17.7.3 错误场景的 AI 辅助

当执行失败时，AI 同样可以帮助解决问题：

```json
{
  "status": "failed",
  "error": "StepExecutionError",
  "step_id": "buffer",
  "message": "CRS mismatch: input data uses geographic CRS (EPSG:4326)",
  "suggestion": "在 buffer 之前添加 vector.reproject 步骤转换到投影坐标系"
}
```

AI 收到这个错误后，可以自动修改流水线并重新生成正确的 YAML。

---

## 17.8 与主流 AI 集成

### 17.8.1 与 ChatGPT 集成

**方式一：自定义 GPT**

在 ChatGPT 的自定义 GPT 中，将 Skill 文件上传为知识库：

1. 创建自定义 GPT
2. 在 "Knowledge" 中上传 SKILL.md、steps-reference.md、pipeline-schema.md
3. 在 "Instructions" 中设置系统提示

```
你是一个 GIS 分析专家，使用 GeoPipeAgent 框架帮助用户创建数据分析流水线。
请根据上传的 Skill 文件生成正确的 YAML 流水线。
始终使用 vars 定义可配置参数。
在分析结果中给出专业的 GIS 建议。
```

**方式二：对话中引用**

```
请阅读以下 GeoPipeAgent Skill 描述：

[粘贴 SKILL.md 内容]

基于以上信息，帮我创建一个...
```

### 17.8.2 与 Claude 集成

Claude 支持更长的上下文窗口，可以同时加载所有 Skill 文件：

```
<skill>
[SKILL.md 内容]
</skill>

<reference>
[steps-reference.md 内容]
</reference>

<schema>
[pipeline-schema.md 内容]
</schema>

请基于以上 GeoPipeAgent 技能描述，帮我创建一个矢量数据质检流水线。
数据文件：buildings.gpkg
需要检查：几何有效性、拓扑关系、属性完整性。
```

Claude 的 Projects 功能也可以将 Skill 文件添加为项目知识，在整个项目对话中持续可用。

### 17.8.3 与 GitHub Copilot 集成

GitHub Copilot 可以通过以下方式集成：

**方式一：仓库级 Skill**

将生成的 Skill 文件放在项目仓库中：

```
my-gis-project/
├── skills/
│   └── geopipe-agent/
│       ├── SKILL.md
│       └── reference/
│           ├── steps-reference.md
│           └── pipeline-schema.md
├── pipelines/
│   ├── analysis.yaml
│   └── qc.yaml
└── data/
```

Copilot 在编辑 YAML 文件时会参考仓库中的 Skill 文件，提供更准确的补全建议。

**方式二：Copilot Chat**

在 Copilot Chat 中引用 Skill 文件：

```
@workspace 参考 skills/geopipe-agent/SKILL.md，帮我创建一个栅格处理流水线
```

### 17.8.4 集成最佳实践

| 实践 | 说明 |
|------|------|
| 定期更新 | 代码更新后重新生成 Skill 文件 |
| 版本控制 | 将 Skill 文件纳入 Git 管理 |
| 最小上下文 | 先给 SKILL.md，需要时再补充 reference |
| 验证输出 | 使用 `validate` 命令验证 AI 生成的 YAML |
| 迭代改进 | 收集 AI 生成的错误模式，优化 Skill 描述 |

---

## 17.9 本章小结

本章全面介绍了 GeoPipeAgent 的 AI Skill 生成与集成系统，主要内容包括：

1. **Skill 概念**：面向 AI 的结构化能力描述文档，是 AI-Native 设计理念的核心体现
2. **文件结构**：三层设计（SKILL.md → steps-reference.md → pipeline-schema.md），优化上下文窗口利用
3. **步骤参考生成**：`generate_steps_reference()` 从注册表自动生成参数表格
4. **Schema 文档生成**：`generate_pipeline_schema_doc()` 定义 YAML 语法规范
5. **主 Skill 文件**：`generate_skill_file()` 提供框架总览和常见模式
6. **AI 工作流**：从生成 Skill → 描述需求 → AI 生成 YAML → 执行 → AI 解读结果的完整流程
7. **平台集成**：与 ChatGPT、Claude、GitHub Copilot 的具体集成方式和最佳实践

下一章我们将深入探讨框架的错误处理机制和调试技巧，了解如何快速定位和解决流水线执行中的问题。

---

[下一章：错误处理与调试 →](18-错误处理与调试.md)

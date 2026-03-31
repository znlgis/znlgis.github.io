---
layout: default
title: 第十七章：AI Skill 生成系统
---

# 第十七章：AI Skill 生成系统

## 17.1 概述

GeoPipeAgent 的核心定位是"AI 优先"框架——不只是为人类提供 YAML 流水线执行能力，更是为 AI 提供一套标准化的能力接口。**AI Skill 生成系统**（`src/geopipe_agent/skillgen/`）正是实现这一目标的关键组件。

### AI Skill 的作用

```
人类需求（自然语言）
        ↓
    大语言模型（LLM）
        │  读取 Skill 文件了解框架能力
        ↓
YAML 流水线（AI 生成）
        ↓
GeoPipeAgent 执行
        ↓
JSON 报告（AI 解析）
```

**Skill 文件**是一种面向 AI 的文档格式，它描述了 GeoPipeAgent 能做什么、怎么做，让 LLM 能够：

1. 理解框架支持哪些 GIS 操作（33 个步骤）
2. 了解每个步骤的参数格式和约束
3. 生成符合 YAML Schema 的流水线配置
4. 避免生成非法引用、错误参数类型等常见错误

## 17.2 skillgen 模块架构

```
src/geopipe_agent/skillgen/
├── __init__.py
└── generator.py          # 核心生成逻辑
```

核心函数：

```python
# 生成 Markdown 格式的步骤参考文档
def generate_steps_reference() -> str:
    """生成所有步骤的 Markdown 参考文档（单文件）。"""

# 生成分类 Skill 文件集
def write_skill_files(output_dir: str) -> list[str]:
    """生成分类 Skill 文件集，返回生成的文件路径列表。"""
```

## 17.3 生成 Skill 文件

### 17.3.1 生成单个参考文档

```bash
# 生成所有步骤的 Markdown 参考
geopipe-agent generate-skill-doc > skills/reference.md
```

生成的文档包含所有 33 个步骤的完整说明，格式示例：

```markdown
# GeoPipeAgent 步骤参考

## IO 步骤

### io.read_vector
**名称**: 读取矢量数据
**类别**: io
**描述**: 读取矢量地理数据文件，返回 GeoDataFrame。

**参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| path | string | ✅ | 文件路径，支持 .shp/.geojson/.gpkg 等 |
| layer | string | ❌ | 多层文件中的图层名称（默认第一层） |
| encoding | string | ❌ | 文件编码，默认自动检测 |
| bbox | array | ❌ | 空间过滤范围 [minx, miny, maxx, maxy] |

**示例**:
```yaml
- id: load
  use: io.read_vector
  params:
    path: "data/roads.shp"
```
...
```

### 17.3.2 生成分类 Skill 文件集

```bash
# 生成到默认目录
geopipe-agent generate-skill

# 生成到自定义目录
geopipe-agent generate-skill --output-dir my-project/skills/
```

生成的文件结构：

```
skills/geopipe-agent/
├── 00-overview.md          # 框架概述 + 流水线 YAML 格式说明
├── 01-io-steps.md          # 4 个 IO 步骤
├── 02-vector-steps.md      # 7 个矢量步骤
├── 03-raster-steps.md      # 5 个栅格步骤
├── 04-analysis-steps.md    # 4 个空间分析步骤
├── 05-network-steps.md     # 3 个网络分析步骤
└── 06-qc-steps.md          # 10 个质检步骤
```

## 17.4 Skill 文件内容结构

### 00-overview.md 内容示例

```markdown
# GeoPipeAgent Skill

## 简介
GeoPipeAgent 是一个 AI 优先的 GIS 数据分析流水线框架。
你可以通过生成 YAML 流水线文件来使用它，框架会执行并返回 JSON 报告。

## 流水线格式

```yaml
name: 流水线名称              # 必填
description: 描述              # 可选
variables:                    # 可选，定义变量
  var_name: value
steps:                        # 必填，步骤列表
  - id: unique-step-id        # 必填
    use: category.action      # 必填（见各步骤文档）
    params:                   # 步骤参数
      key: value
      ref: $other-step-id     # 引用其他步骤的输出
      var: ${var_name}        # 引用变量
    when: "condition"         # 可选，条件执行
    on_error: fail            # fail/skip/retry
outputs:                      # 可选，输出声明
  output_name: $step-id
```

## 注意事项
- 步骤 ID 只允许 [a-z0-9_-]
- $step-id 只能引用之前定义的步骤
- 缓冲区等距离操作需要使用投影坐标系（如 EPSG:3857，单位米）
```

## 17.5 配置 AI 使用 Skill 文件

### 方法 1：Claude Projects（推荐）

1. 在 Claude 的 Project 中添加知识文件
2. 上传 `skills/geopipe-agent/` 目录下的所有文件
3. Claude 会自动学习框架能力

配置后，可以用自然语言描述任务，Claude 会自动生成 YAML 流水线：

```
用户：帮我写一个流水线，读取 roads.shp，做 500 米缓冲区分析，结果保存为 GeoJSON

Claude：
name: 道路缓冲区分析
variables:
  input_path: "roads.shp"
  buffer_dist: 500
steps:
  - id: load
    use: io.read_vector
    params:
      path: ${input_path}
  - id: reproject
    use: vector.reproject
    params:
      input: $load
      target_crs: "EPSG:3857"
  - id: buffer
    use: vector.buffer
    params:
      input: $reproject
      distance: ${buffer_dist}
  - id: save
    use: io.write_vector
    params:
      input: $buffer
      path: "output/roads_buffer.geojson"
outputs:
  result: $save
```

### 方法 2：OpenAI Custom Instructions

在 ChatGPT 的 Custom Instructions 中粘贴 Skill 文件内容，让 GPT-4 了解框架能力。

### 方法 3：系统提示词（System Prompt）

对于 API 调用，将 Skill 文件内容作为系统提示词：

```python
import openai

# 读取 Skill 文件
with open("skills/geopipe-agent/00-overview.md") as f:
    overview = f.read()
with open("skills/geopipe-agent/02-vector-steps.md") as f:
    vector_steps = f.read()

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {
            "role": "system",
            "content": f"你是 GeoPipeAgent 流水线生成专家。以下是框架文档：\n\n{overview}\n\n{vector_steps}"
        },
        {
            "role": "user",
            "content": "帮我写一个缓冲区分析流水线，输入 roads.shp，缓冲距离 1000 米，输出 GeoJSON"
        }
    ]
)
print(response.choices[0].message.content)
```

## 17.6 Web UI 中的 AI 集成

GeoPipeAgent 的 Web UI 提供了内置的 LLM 对话助手，无需手动配置 Skill 文件：

### 自动 Skill 加载

Web 后端（FastAPI）在启动时自动：
1. 调用 `generate_steps_reference()` 生成步骤参考
2. 将参考文档作为 AI 对话的系统提示词
3. AI 助手可以直接回答有关步骤的问题

### Skill 管理界面

Web UI 提供 Skill 管理页面（`SkillManager.vue`），可以：
- 查看当前加载的所有 Skill 文件
- 手动上传自定义 Skill 文件
- 启用/禁用特定 Skill 模块

### LLM 对话流程

```
用户在 Web UI 输入自然语言需求
        ↓
FastAPI /api/llm/generate 接口
        ↓
构建提示词（Skill 文件 + 用户需求）
        ↓
调用 LLM API（OpenAI/DeepSeek 等）
        ↓
LLM 返回 YAML 流水线
        ↓
自动校验（validate_pipeline）
        ↓
在 Web 编辑器中展示
        ↓
用户确认后一键执行
```

## 17.7 Skill 文件的技术细节

### 生成原理

`generator.py` 通过以下步骤生成 Skill 文档：

1. **遍历步骤注册表**：调用 `registry.list_all()` 获取所有注册步骤
2. **按类别分组**：将步骤按 `category`（io/vector/raster 等）分组
3. **渲染 Markdown 模板**：将每个步骤的 `StepInfo` 渲染为标准化 Markdown 格式
4. **写入文件**：按类别输出到对应文件

### 自定义步骤自动出现在 Skill 文件中

由于 Skill 文件从注册表动态生成，**自定义步骤**在通过 `@step` 装饰器注册后，会自动出现在生成的 Skill 文件中。这意味着 AI 可以立即学习和使用你添加的自定义步骤，无需手动更新文档。

```python
# 添加自定义步骤
@step(
    id="my.custom_analysis",
    name="自定义分析",
    category="my",
    description="执行我的专有 GIS 分析算法",
    params={
        "input": {"required": True, "type": "geodataframe", "description": "输入数据"},
        "method": {"required": False, "type": "string", "description": "分析方法", "default": "standard"},
    }
)
def my_custom_analysis(ctx: StepContext) -> StepResult:
    # ... 实现
    pass

# 重新生成 Skill 文件，自动包含 my.custom_analysis
geopipe-agent generate-skill --output-dir skills/
```

## 17.8 实战：AI 自动化 GIS 数据处理

### 完整工作流示例

以下是一个完整的 AI 驱动 GIS 分析工作流：

**步骤 1**：配置 AI 使用 Skill 文件（一次性配置）

```bash
geopipe-agent generate-skill --output-dir skills/
# 将 skills/ 目录内容上传到 Claude Project 或配置为系统提示词
```

**步骤 2**：用自然语言描述任务

```
用户：我有一份全国铁路线 SHP 文件（roads.shp，EPSG:4326），
需要：
1. 提取高铁线路（字段 type == '高铁'）
2. 投影到 EPSG:3857
3. 做 2000 米缓冲区
4. 统计缓冲区内的县域（counties.shp）
5. 结果保存为 GeoPackage

请生成 GeoPipeAgent 流水线 YAML 文件。
```

**步骤 3**：AI 生成 YAML

```yaml
name: 高铁缓冲区县域统计
description: 提取高铁线路、缓冲区分析、统计覆盖县域

variables:
  railway_path: "roads.shp"
  county_path: "counties.shp"
  output_path: "output/railway_analysis.gpkg"
  buffer_dist: 2000

steps:
  - id: load-railway
    use: io.read_vector
    params:
      path: ${railway_path}

  - id: filter-hsr
    use: vector.query
    params:
      input: $load-railway
      expr: "type == '高铁'"

  - id: reproject-hsr
    use: vector.reproject
    params:
      input: $filter-hsr
      target_crs: "EPSG:3857"

  - id: buffer-hsr
    use: vector.buffer
    params:
      input: $reproject-hsr
      distance: ${buffer_dist}

  - id: dissolve-buffer
    use: vector.dissolve
    params:
      input: $buffer-hsr

  - id: load-county
    use: io.read_vector
    params:
      path: ${county_path}

  - id: reproject-county
    use: vector.reproject
    params:
      input: $load-county
      target_crs: "EPSG:3857"

  - id: overlay-county
    use: vector.overlay
    params:
      left: $reproject-county
      right: $dissolve-buffer
      how: intersection

  - id: save
    use: io.write_vector
    params:
      input: $overlay-county
      path: ${output_path}
      driver: GPKG
      layer: "hsr_covered_counties"

outputs:
  result: $save
```

**步骤 4**：执行并获取报告

```bash
geopipe-agent run hsr_analysis.yaml > report.json
```

**步骤 5**：AI 解析报告并继续分析

```
用户（粘贴 report.json）：执行完成，报告如上，共覆盖了多少个县？

AI：根据执行报告，overlay-county 步骤输出了 XXX 个要素（县域），
    其中 feature_count 为 XXX，表示有 XXX 个县域与高铁缓冲区有交叉覆盖...
```

## 17.9 小结

本章介绍了 GeoPipeAgent 的 AI Skill 生成系统：

- **Skill 文件**：面向 AI 的标准化框架能力文档
- **生成命令**：`generate-skill-doc`（单文件）和 `generate-skill`（分类文件集）
- **配置方法**：Claude Projects、OpenAI Custom Instructions、API 系统提示词
- **Web UI 集成**：内置 LLM 对话助手，自动加载 Skill
- **自定义步骤自动支持**：新步骤注册后自动出现在生成的 Skill 文件中

下一章将介绍 GeoPipeAgent 的 Web 可视化界面与 API 服务。

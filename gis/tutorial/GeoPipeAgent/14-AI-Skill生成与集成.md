---
layout: default
title: AI-Skill生成与集成
---

# 第十四章：AI Skill 生成与集成

## 14.1 什么是 Skill 文件

Skill 文件是 GeoPipeAgent 的一个核心创新——它是一套自动生成的文档，专门设计用于 AI Agent 消费。AI 通过阅读 Skill 文件来理解框架的能力，然后自主生成 YAML 流水线。

Skill 系统由 `skillgen/generator.py` 模块实现，包含三个文档生成器：

| 文件 | 生成函数 | 说明 |
|------|---------|------|
| `SKILL.md` | `generate_skill_file()` | 主 Skill 文件，框架概览 |
| `steps-reference.md` | `generate_steps_reference()` | 步骤参考文档 |
| `pipeline-schema.md` | `generate_pipeline_schema_doc()` | YAML Schema 文档 |

## 14.2 Skill 文件生成

### 14.2.1 CLI 命令

```bash
# 生成到默认目录 skills/geopipe-agent/
geopipe-agent generate-skill

# 指定目录
geopipe-agent generate-skill --output-dir docs/ai-skills
```

### 14.2.2 生成目录结构

```
skills/geopipe-agent/
├── SKILL.md                    # 主 Skill 文件
└── reference/
    ├── steps-reference.md      # 步骤参考
    └── pipeline-schema.md      # Schema 文档
```

### 14.2.3 Python API

```python
from geopipe_agent.skillgen.generator import write_skill_files

files = write_skill_files("skills/geopipe-agent")
for f in files:
    print(f"Generated: {f}")
```

## 14.3 SKILL.md — 主 Skill 文件

SKILL.md 是 AI Agent 阅读的第一个文件，包含以下内容：

### 14.3.1 框架介绍

向 AI 解释 GeoPipeAgent 是什么、如何使用：

```markdown
# GeoPipeAgent Skill

## What is GeoPipeAgent?

GeoPipeAgent is an AI-native GIS analysis pipeline framework.
You (AI) can generate YAML pipeline files to perform GIS analysis tasks.

## How to Use

1. Understand the task
2. Choose steps (refer to steps-reference.md)
3. Write YAML pipeline
4. Execute: geopipe-agent run <pipeline.yaml>
5. Interpret results
```

### 14.3.2 快速示例

包含一个完整的 YAML 流水线示例，让 AI 快速理解格式：

```yaml
pipeline:
  name: "Buffer Analysis"
  steps:
    - id: read
      use: io.read_vector
      params:
        path: "data/roads.shp"
    - id: buffer
      use: vector.buffer
      params:
        input: "$read.output"
        distance: 500
    - id: save
      use: io.write_vector
      params:
        input: "$buffer.output"
        path: "output/buffer_result.geojson"
```

### 14.3.3 核心概念

向 AI 解释关键概念：
- Steps 的命名规则（`category.action`）
- 步骤引用语法（`$step_id.attribute`）
- 变量语法（`${var_name}`）
- IO 步骤与分析步骤的区别

### 14.3.4 步骤类别概览

列出所有可用的步骤类别和步骤 ID。

## 14.4 steps-reference.md — 步骤参考文档

### 14.4.1 自动生成机制

步骤参考文档是从注册表中所有步骤的元信息自动生成的：

```python
def generate_steps_reference() -> str:
    load_builtin_steps()
    registry = StepRegistry()

    for category in registry.categories():
        for info in registry.list_by_category(category):
            # 生成每个步骤的文档
            # 包含参数表、输出描述、示例等
```

### 14.4.2 文档格式

每个步骤的文档包含：

```markdown
### `vector.buffer`

**矢量缓冲区分析** — 对输入的矢量数据生成指定距离的缓冲区

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `input` | geodataframe | ✅ | — | 输入矢量数据 |
| `distance` | number | ✅ | — | 缓冲区距离 |
| `cap_style` | string | ❌ | round | 端点样式 (options: round, flat, square) |

**Outputs:**

- `output` (geodataframe): 缓冲区结果
- `stats` (dict): 统计信息

**Examples:**

- 500米道路缓冲区: `{'input': '$roads.output', 'distance': 500}`

**Backends:** gdal_python, qgis_process
```

### 14.4.3 自动更新

由于文档是从步骤元信息动态生成的，添加新步骤后只需重新运行生成命令，文档就会自动包含新步骤。这消除了文档与代码不同步的问题。

## 14.5 pipeline-schema.md — Schema 文档

Schema 文档详细描述了 YAML 流水线的格式规范：

### 14.5.1 内容

- 顶层结构说明
- 引用语法（`$step.attr`、`${var}`）
- step_id 命名规则
- on_error 错误处理选项
- when 条件执行语法
- 完整示例

### 14.5.2 引用语法表

```markdown
| Syntax | Description | Example |
|--------|-------------|---------|
| `$step_id.output` | Reference step output | `$buffer.output` |
| `$step_id.stats` | Reference step stats | `$buffer.stats` |
| `${var_name}` | Variable substitution | `${input_path}` |
```

## 14.6 AI 集成模式

### 14.6.1 工作流程

```
AI Agent 启动
    │
    ▼ 读取 Skill 文件
AI 理解 GeoPipeAgent 能力
    │
    ▼ 接收用户任务
AI 分析 GIS 需求
    │
    ▼ 参考 steps-reference.md
AI 选择合适的步骤
    │
    ▼ 参考 pipeline-schema.md
AI 生成 YAML 流水线
    │
    ▼ 调用 geopipe-agent validate
验证流水线
    │
    ▼ 调用 geopipe-agent run
执行流水线
    │
    ▼ 解析 JSON 报告
AI 向用户报告结果
```

### 14.6.2 Prompt 集成示例

在 AI Agent 的系统 prompt 中引入 Skill 文件：

```
你是一个 GIS 分析助手。你可以使用 GeoPipeAgent 框架执行空间分析任务。

框架文档：
{SKILL.md 的内容}

步骤参考：
{steps-reference.md 的内容}

当用户提出 GIS 分析需求时，你应该：
1. 分析需求，确定需要的步骤
2. 生成 YAML 流水线
3. 使用 geopipe-agent run 执行
4. 解析结果并向用户报告
```

### 14.6.3 错误自动修复

当执行失败时，AI 可以利用错误中的 `suggestion` 字段自动修复：

```json
{
  "error": "StepExecutionError",
  "step_id": "buffer",
  "message": "CRS mismatch",
  "suggestion": "Add a vector.reproject step before this step."
}
```

AI 读取 suggestion 后，自动在 buffer 步骤前添加 reproject 步骤，重新生成并执行流水线。

## 14.7 只生成步骤参考文档

如果只需要步骤参考文档（不需要完整 Skill 文件集）：

```bash
# 输出到 stdout
geopipe-agent generate-skill-doc

# 重定向到文件
geopipe-agent generate-skill-doc > docs/steps-reference.md
```

或在 Python 中：

```python
from geopipe_agent.skillgen.generator import generate_steps_reference

doc = generate_steps_reference()
print(doc)
```

## 14.8 自定义步骤的文档生成

当你添加自定义步骤时，只要正确声明了 `@step` 装饰器的元信息，步骤的文档就会自动生成。关键是确保以下字段完整：

```python
@step(
    id="custom.my_step",
    name="我的自定义步骤",              # 显示名称
    description="详细的功能描述",        # 描述
    category="custom",
    params={
        "input": {
            "type": "geodataframe",
            "required": True,
            "description": "输入数据的详细说明",  # 参数描述
        },
    },
    outputs={
        "output": {
            "type": "geodataframe",
            "description": "输出数据的详细说明",  # 输出描述
        },
    },
    examples=[
        {
            "description": "使用示例的描述",      # 示例
            "params": {"input": "$read.output"},
        },
    ],
)
def my_step(ctx):
    ...
```

然后重新运行 `geopipe-agent generate-skill`，你的步骤就会出现在文档中。

## 14.9 Skill 系统的设计理念

### 14.9.1 AI 优先

Skill 文件的设计以 AI 的阅读习惯为核心：
- **结构化**：使用 Markdown 表格和代码块，AI 容易解析
- **自描述**：每个步骤包含完整的参数说明和示例
- **可操作**：文档直接告诉 AI 如何使用，而不仅仅是描述

### 14.9.2 自动化

所有文档从代码自动生成，消除了手动维护文档的负担：
- 添加新步骤 → 重新生成 → 文档自动更新
- 修改参数 → 重新生成 → 文档自动同步
- 无需担心文档与代码不一致

### 14.9.3 可扩展

Skill 生成器可以扩展以支持其他文档格式（如 JSON Schema、OpenAPI 等），也可以为不同的 AI 平台生成定制化的文档。

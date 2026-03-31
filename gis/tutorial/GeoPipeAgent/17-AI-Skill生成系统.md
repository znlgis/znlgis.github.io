---
layout: default
title: "第十七章：AI Skill 生成系统"
---

# 第十七章：AI Skill 生成系统

## 17.1 概述

AI Skill 生成系统是 GeoPipeAgent **AI 优先（AI-First）** 理念的核心实现。通过生成标准化的技能文档（Skill 文件），让 ChatGPT、Claude 等大语言模型能够**理解框架能力并生成正确的 YAML 流水线**。

### 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│  第一步：生成 Skill 文件                                      │
│  geopipe-agent generate-skill --output-dir skills/          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  第二步：将 Skill 文件提供给 AI                               │
│  将 skills/geopipe-agent/ 目录中的文件复制到 AI 系统提示或   │
│  上传给对话中的 AI 助手                                       │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  第三步：AI 理解框架能力                                      │
│  AI 阅读步骤参考、YAML Schema、使用示例                      │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  第四步：用户用自然语言描述需求                               │
│  "帮我对北京道路数据做 500 米缓冲区分析，保存为 GeoJSON"     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  第五步：AI 生成 YAML 流水线                                  │
│  AI 根据 Skill 文件，生成符合规范的 YAML                     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  第六步：执行流水线                                           │
│  geopipe-agent run generated_pipeline.yaml                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 17.2 生成 Skill 文件

### 17.2.1 基本命令

```bash
# 生成到默认目录
geopipe-agent generate-skill

# 指定输出目录
geopipe-agent generate-skill --output-dir skills/geopipe-agent
```

### 17.2.2 生成的文件结构

```
skills/geopipe-agent/
├── SKILL.md                          # 主技能文件（给 AI 阅读）
└── reference/
    ├── steps-reference.md            # 所有步骤的完整参数参考
    └── pipeline-schema.md            # YAML 流水线格式规范
```

### 17.2.3 各文件内容说明

#### `SKILL.md`（主技能文件）

包含：
- **框架概述**：GeoPipeAgent 是什么，能做什么
- **核心概念**：流水线、步骤、变量、引用
- **YAML 格式速查**：顶层结构和必填字段
- **步骤索引**：按类别列出所有步骤
- **完整示例**：2-3 个典型流水线示例

#### `reference/steps-reference.md`（步骤参考）

包含每个步骤的：
- 步骤 ID 和说明
- 所有参数（名称、类型、是否必填、默认值、说明）
- 输出字段说明
- 使用示例（YAML 片段）

#### `reference/pipeline-schema.md`（Pipeline Schema）

包含：
- YAML 格式的完整规范（字段、类型、约束）
- 变量引用语法 `${var}`
- 步骤引用语法 `$step-id`、`$step-id.stats`
- 错误策略说明
- 后端说明

---

## 17.3 将 Skill 文件提供给 AI

### 17.3.1 方法一：复制到系统提示（System Prompt）

对于有系统提示配置的 AI 应用（如自定义 GPT、Claude Projects），将 `SKILL.md` 内容放入系统提示：

```
你是一个 GIS 数据分析助手，专门使用 GeoPipeAgent 框架进行分析。

【GeoPipeAgent 技能文档】
[在此粘贴 SKILL.md 全文]

当用户提出 GIS 分析需求时，你应当：
1. 理解用户需求
2. 根据技能文档选择合适的步骤
3. 生成符合规范的 YAML 流水线
4. 解释每个步骤的用途
```

### 17.3.2 方法二：在对话中上传文件

直接将 `SKILL.md` 和 `reference/steps-reference.md` 上传到 ChatGPT 或 Claude 的对话中：

```
用户：[上传 SKILL.md 和 steps-reference.md 文件]

用户提示：
我已上传了 GeoPipeAgent 框架的技能文档。
请根据这些文档，帮我生成一个流水线：
- 输入：北京市道路数据 data/beijing_roads.geojson
- 操作：筛选主干道，做 500 米缓冲区分析
- 输出：output/primary_road_buffer.geojson
```

### 17.3.3 方法三：自定义 GPT 配置

在 OpenAI 的自定义 GPT 中配置：

```json
{
  "instructions": "你是 GeoPipeAgent 流水线生成助手...[SKILL.md 内容]",
  "capabilities": {
    "code_interpreter": true
  }
}
```

---

## 17.4 AI 生成流水线示例

### 17.4.1 简单需求

**用户输入**：
> 我有一份城市 POI 数据（data/pois.geojson），想计算每个 POI 周围 200 米内的覆盖区域，保存为 GeoJSON。

**AI 生成的 YAML**：

```yaml
pipeline:
  name: "POI 200米覆盖区域分析"
  description: "计算城市 POI 数据的 200 米覆盖区域"

  variables:
    input_path: "data/pois.geojson"
    buffer_distance: 200
    output_path: "output/poi_coverage_200m.geojson"
    working_crs: "EPSG:3857"

  steps:
    - id: load-pois
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: reproject
      use: vector.reproject
      params:
        input: "$load-pois"
        target_crs: "${working_crs}"

    - id: buffer
      use: vector.buffer
      params:
        input: "$reproject"
        distance: "${buffer_distance}"
        cap_style: "round"

    - id: reproject-back
      use: vector.reproject
      params:
        input: "$buffer"
        target_crs: "EPSG:4326"

    - id: save
      use: io.write_vector
      params:
        input: "$reproject-back"
        path: "${output_path}"
        format: "GeoJSON"

  outputs:
    coverage_area: "$save"
    stats: "$buffer.stats"
```

### 17.4.2 复杂需求

**用户输入**：
> 我需要对一批提交的道路数据做质量检查：
> 1. 检查几何有效性
> 2. 确认坐标系是 EPSG:4326
> 3. 检查必填字段：road_id、road_name、road_type
> 4. road_type 只能是：主干道、次干道、支路
> 5. 如果有质检问题，保存问题报告；如果全部通过，继续做缓冲区分析

**AI 生成的 YAML**：

```yaml
pipeline:
  name: "道路数据质检与缓冲区分析"
  description: "先做全面质检，通过后再做缓冲区分析"

  variables:
    input_path: "data/roads_submitted.geojson"
    expected_crs: "EPSG:4326"
    buffer_distance: 300

  steps:
    - id: load
      use: io.read_vector
      params:
        path: "${input_path}"

    - id: qc-geometry
      use: qc.geometry_validity
      params:
        input: "$load"

    - id: qc-crs
      use: qc.crs_check
      params:
        input: "$qc-geometry"
        expected_crs: "${expected_crs}"

    - id: qc-completeness
      use: qc.attribute_completeness
      params:
        input: "$qc-crs"
        required_fields:
          - "road_id"
          - "road_name"
          - "road_type"

    - id: qc-domain
      use: qc.attribute_domain
      params:
        input: "$qc-completeness"
        field: "road_type"
        allowed_values:
          - "主干道"
          - "次干道"
          - "支路"

    # 有问题时保存质检报告
    - id: save-issues
      use: io.write_vector
      when: "len($qc-domain.issues) > 0"
      params:
        input: "$qc-domain"
        path: "output/qc_failed_data.geojson"
        format: "GeoJSON"

    # 无问题时继续缓冲区分析
    - id: reproject
      use: vector.reproject
      when: "len($qc-domain.issues) == 0"
      params:
        input: "$qc-domain"
        target_crs: "EPSG:3857"

    - id: buffer
      use: vector.buffer
      when: "len($qc-domain.issues) == 0"
      params:
        input: "$reproject"
        distance: "${buffer_distance}"
        cap_style: "round"

    - id: save-result
      use: io.write_vector
      when: "len($qc-domain.issues) == 0"
      params:
        input: "$buffer"
        path: "output/road_buffer.geojson"
        format: "GeoJSON"

  outputs:
    qc_issues: "$qc-domain.issues"
    geometry_check: "$qc-geometry.stats"
```

---

## 17.5 AI 生成流水线的最佳实践

### 17.5.1 给 AI 的有效提示模板

```
任务描述：[描述要完成的 GIS 分析任务]

输入数据：
  - 文件路径：[路径]
  - 数据类型：[矢量/栅格]
  - 坐标系：[EPSG:XXXX]
  - 主要字段：[字段名列表]

分析步骤：
  1. [步骤描述]
  2. [步骤描述]
  ...

输出要求：
  - 格式：[GeoJSON/Shapefile/GeoPackage]
  - 路径：[输出路径]

特殊要求：
  - 需要进行质量检查（/不需要）
  - 缓冲区距离：[距离]米
  - 过滤条件：[条件]

请生成符合 GeoPipeAgent 规范的 YAML 流水线文件。
```

### 17.5.2 验证 AI 生成的流水线

AI 生成的流水线在使用前应进行校验：

```bash
# 1. 保存 AI 生成的 YAML
cat > ai_generated.yaml << 'EOF'
[粘贴 AI 生成的 YAML]
EOF

# 2. 校验格式
geopipe-agent validate ai_generated.yaml

# 3. 查看流水线信息
geopipe-agent info ai_generated.yaml

# 4. 测试运行（先用小数据集）
geopipe-agent run ai_generated.yaml \
  --var input_path=data/sample_small.geojson \
  --log-level DEBUG
```

### 17.5.3 常见 AI 生成错误和修复

**错误一：缺少投影转换**

AI 可能直接对 WGS84 数据做缓冲区：
```yaml
# AI 可能生成（错误！缓冲单位是度而非米）
- id: buffer
  use: vector.buffer
  params:
    input: "$load"   # 可能是 WGS84 数据
    distance: 500    # 单位是度，不是米！
```

修复：在缓冲前添加 `vector.reproject`：
```yaml
- id: reproject
  use: vector.reproject
  params:
    input: "$load"
    target_crs: "EPSG:3857"

- id: buffer
  use: vector.buffer
  params:
    input: "$reproject"   # 现在是米制坐标
    distance: 500
```

**错误二：步骤 ID 格式不正确**

```yaml
# AI 可能使用大写或空格（错误！）
- id: "Load Roads"
  use: io.read_vector
```

修复：
```yaml
- id: load-roads
  use: io.read_vector
```

**错误三：忘记 `pipeline:` 顶层键**

```yaml
# AI 可能忘记顶层键（错误！）
name: "分析流水线"
steps:
  - id: load
    use: io.read_vector
```

修复：
```yaml
pipeline:
  name: "分析流水线"
  steps:
    - id: load
      use: io.read_vector
```

---

## 17.6 与 Web API 集成（AI 自动化）

如果安装了 `web` 依赖，可以通过 Web API 实现完全自动化的 AI → 流水线 → 执行流程：

```bash
pip install -e ".[web]"
```

```python
# 示例：使用 OpenAI API 自动生成并执行流水线
import openai
import yaml
import subprocess

# 读取 Skill 文档
with open("skills/geopipe-agent/SKILL.md") as f:
    skill_doc = f.read()

with open("skills/geopipe-agent/reference/steps-reference.md") as f:
    steps_ref = f.read()

# 用户需求
user_request = """
我有一份上海市道路数据（data/shanghai_roads.geojson），
请生成一个流水线：筛选主干道，投影到 EPSG:3857，
做 800 米缓冲区，保存为 output/shanghai_primary_buffer.geojson
"""

# 调用 AI 生成流水线
client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "system",
            "content": f"""你是 GeoPipeAgent 流水线生成助手。
根据以下技能文档生成正确的 YAML 流水线：

{skill_doc}

步骤参考：
{steps_ref}

请只输出 YAML 代码，不要有其他文字。"""
        },
        {
            "role": "user",
            "content": user_request
        }
    ]
)

# 提取生成的 YAML
yaml_content = response.choices[0].message.content
# 去掉可能的 markdown 代码块标记
yaml_content = yaml_content.strip().removeprefix("```yaml").removesuffix("```").strip()

# 保存 YAML
with open("ai_generated_pipeline.yaml", "w") as f:
    f.write(yaml_content)

# 校验和执行
result = subprocess.run(
    ["geopipe-agent", "validate", "ai_generated_pipeline.yaml"],
    capture_output=True, text=True
)

if result.returncode == 0:
    print("校验通过，开始执行...")
    subprocess.run(["geopipe-agent", "run", "ai_generated_pipeline.yaml"])
else:
    print("流水线校验失败：")
    print(result.stderr)
```

---

## 17.7 本章小结

本章介绍了 GeoPipeAgent 的 AI Skill 生成系统：

1. **生成 Skill 文件**：`geopipe-agent generate-skill --output-dir skills/`
2. **三个文件**：`SKILL.md`（主文档）、`steps-reference.md`（步骤参考）、`pipeline-schema.md`（格式规范）
3. **提供给 AI**：系统提示、文件上传、自定义 GPT 等方式
4. **AI 生成流水线**：基于技能文档，AI 可以准确生成 YAML
5. **校验和修复**：用 `validate` 命令检查，修复常见错误
6. **自动化集成**：通过 OpenAI API 实现全自动流水线生成和执行

AI Skill 系统是 GeoPipeAgent 与现代 AI 工具链连接的桥梁，使得"自然语言 → GIS 分析"成为可能。

---

**导航**：[← 第十六章：CLI 命令行工具完全指南](16-CLI命令行工具完全指南) ｜ [第十八章：Web 界面与 API 服务 →](18-Web界面与API服务)

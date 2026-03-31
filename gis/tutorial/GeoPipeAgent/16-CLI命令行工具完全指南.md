---
layout: default
title: "第十六章：CLI 命令行工具完全指南"
---

# 第十六章：CLI 命令行工具完全指南

## 16.1 概述

GeoPipeAgent 提供 `geopipe-agent` 命令行工具，包含 **11 个子命令**，覆盖流水线执行、校验、步骤查询、AI 技能生成等全流程操作。

```
geopipe-agent <子命令> [参数] [选项]
```

---

## 16.2 快速参考

| 子命令 | 说明 |
|--------|------|
| `run` | 运行流水线 |
| `validate` | 校验流水线格式 |
| `list-steps` | 列出所有可用步骤 |
| `describe` | 查看步骤详情 |
| `info` | 查看流水线信息 |
| `backends` | 查看可用后端 |
| `generate-skill-doc` | 生成 Skill 文档（标准输出） |
| `generate-skill` | 生成 Skill 文件到目录 |

---

## 16.3 `geopipe-agent run`：运行流水线

### 16.3.1 基本语法

```bash
geopipe-agent run <pipeline_file> [选项]
```

### 16.3.2 选项说明

| 选项 | 说明 | 示例 |
|------|------|------|
| `--var key=value` | 覆盖 YAML 变量 | `--var buffer_dist=500` |
| `--log-level LEVEL` | 日志级别 | `--log-level DEBUG` |
| `--json-log` | JSON 格式日志 | `--json-log` |
| `--output FILE` | 报告输出文件 | `--output report.json` |

### 16.3.3 使用示例

```bash
# 基本运行
geopipe-agent run pipeline.yaml

# 覆盖单个变量
geopipe-agent run pipeline.yaml --var buffer_dist=1000

# 覆盖多个变量
geopipe-agent run pipeline.yaml \
  --var input_path=data/new_data.geojson \
  --var buffer_dist=300 \
  --var output_dir=output/batch2/

# 调试模式（显示详细日志）
geopipe-agent run pipeline.yaml --log-level DEBUG

# 静默模式（只显示错误）
geopipe-agent run pipeline.yaml --log-level ERROR

# JSON 格式日志（便于日志系统采集）
geopipe-agent run pipeline.yaml --json-log

# 保存报告到文件
geopipe-agent run pipeline.yaml --output reports/result.json

# 组合使用
geopipe-agent run pipeline.yaml \
  --var input_path=data/city.geojson \
  --log-level DEBUG \
  --output reports/city_analysis.json
```

### 16.3.4 日志级别说明

| 级别 | 说明 | 适用场景 |
|------|------|----------|
| `DEBUG` | 所有信息，含内部状态 | 开发调试 |
| `INFO` | 正常执行信息（默认） | 日常使用 |
| `WARNING` | 警告信息 | 生产监控 |
| `ERROR` | 仅错误信息 | 安静执行 |

### 16.3.5 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 成功 |
| `1` | 流水线执行失败 |
| `2` | 解析/校验错误 |
| `3` | 参数错误 |

```bash
# 在 shell 脚本中检查执行结果
geopipe-agent run pipeline.yaml
if [ $? -eq 0 ]; then
    echo "流水线执行成功"
else
    echo "流水线执行失败，退出码: $?"
fi
```

### 16.3.6 批量执行

```bash
#!/bin/bash
# batch_run.sh - 批量处理多个城市的数据

CITIES=("beijing" "shanghai" "guangzhou" "shenzhen")

for city in "${CITIES[@]}"; do
    echo "处理: $city"
    geopipe-agent run analysis_pipeline.yaml \
      --var input_path="data/${city}/roads.geojson" \
      --var output_dir="output/${city}/" \
      --log-level INFO \
      --output "reports/${city}_report.json"

    if [ $? -ne 0 ]; then
        echo "处理 $city 时发生错误，继续下一个..."
    fi
done

echo "批量处理完成"
```

---

## 16.4 `geopipe-agent validate`：校验流水线

### 16.4.1 基本语法

```bash
geopipe-agent validate <pipeline_file>
```

### 16.4.2 使用示例

```bash
# 校验流水线文件
geopipe-agent validate pipeline.yaml

# 成功输出
# ✓ 流水线 "道路缓冲区分析" 格式有效
# 步骤数量: 5
# 变量数量: 3
# 输出声明: result, stats

# 失败输出
# ✗ 流水线校验失败:
#   - 步骤 'buffer' 引用了不存在的步骤 'load-data'（应为 'load-roads'）
#   - 步骤 ID 'My Step' 包含非法字符（应符合 [a-z0-9_-]）
```

`validate` 命令适合用于：
- **开发阶段**：在运行前确认格式正确
- **CI/CD 流水线**：PR 合并前的格式检查
- **AI 生成后**：验证 AI 生成的 YAML 是否合法

```bash
# 在 CI 中使用
geopipe-agent validate pipelines/production.yaml || exit 1
```

---

## 16.5 `geopipe-agent list-steps`：列出步骤

### 16.5.1 基本语法

```bash
geopipe-agent list-steps [选项]
```

### 16.5.2 选项说明

| 选项 | 说明 | 示例 |
|------|------|------|
| `--category` | 按类别过滤 | `--category io` |
| `--format` | 输出格式 | `--format table` 或 `--format json` |

### 16.5.3 使用示例

```bash
# 列出所有步骤（表格格式）
geopipe-agent list-steps

# 输出：
# ┌──────────────────────────────┬──────────┬────────────────────────────────┐
# │ 步骤 ID                       │ 类别     │ 说明                           │
# ├──────────────────────────────┼──────────┼────────────────────────────────┤
# │ io.read_vector               │ io       │ 读取矢量数据                   │
# │ io.write_vector              │ io       │ 写入矢量数据                   │
# │ io.read_raster               │ io       │ 读取栅格数据                   │
# │ io.write_raster              │ io       │ 写入栅格数据                   │
# │ vector.buffer                │ vector   │ 缓冲区分析                     │
# │ ...                          │ ...      │ ...                            │
# └──────────────────────────────┴──────────┴────────────────────────────────┘

# 仅列出 IO 步骤
geopipe-agent list-steps --category io

# 仅列出矢量步骤
geopipe-agent list-steps --category vector

# 仅列出质检步骤
geopipe-agent list-steps --category qc

# JSON 格式输出（便于程序处理）
geopipe-agent list-steps --format json

# JSON 输出示例
# [
#   {"id": "io.read_vector", "category": "io", "description": "读取矢量数据", ...},
#   ...
# ]
```

### 16.5.4 可用类别

| 类别值 | 说明 | 步骤数 |
|--------|------|--------|
| `io` | 数据读写 | 4 |
| `vector` | 矢量分析 | 7 |
| `raster` | 栅格分析 | 5 |
| `analysis` | 空间分析（需要 analysis 依赖） | 4 |
| `network` | 网络分析（需要 network 依赖） | 3 |
| `qc` | 数据质检 | 10 |

---

## 16.6 `geopipe-agent describe`：查看步骤详情

### 16.6.1 基本语法

```bash
geopipe-agent describe <step_id>
```

### 16.6.2 使用示例

```bash
# 查看 vector.buffer 步骤详情
geopipe-agent describe vector.buffer

# 输出：
# 步骤: vector.buffer
# 名称: 缓冲区分析
# 类别: vector
# 描述: 在矢量要素周围生成指定距离的缓冲多边形
#
# 参数:
#   input       (GeoDataFrame, 必填) 输入矢量数据
#   distance    (float, 必填)        缓冲距离（单位与 CRS 相同）
#   cap_style   (string, 可选)       端头样式: round/flat/square（默认: round）
#
# 输出:
#   output      (GeoDataFrame) 缓冲区多边形数据
#   stats.feature_count  (int)   要素数量
#   stats.total_area     (float) 缓冲区总面积
#
# 示例:
#   - id: buffer
#     use: vector.buffer
#     params:
#       input: "$load"
#       distance: 500
#       cap_style: "round"
#
# 支持的后端: native_python, gdal_cli

# 查看 QC 步骤
geopipe-agent describe qc.geometry_validity

# 查看分析步骤
geopipe-agent describe analysis.cluster
```

---

## 16.7 `geopipe-agent info`：查看流水线信息

### 16.7.1 基本语法

```bash
geopipe-agent info <pipeline_file>
```

### 16.7.2 使用示例

```bash
geopipe-agent info pipeline.yaml

# 输出：
# ╔══════════════════════════════════════════════════╗
# ║ 流水线信息                                         ║
# ╠══════════════════════════════════════════════════╣
# ║ 名称: 道路缓冲区分析                               ║
# ║ 描述: 对城市道路做 500 米缓冲区分析               ║
# ║ CRS:  EPSG:4326                                   ║
# ╠══════════════════════════════════════════════════╣
# ║ 变量 (3):                                         ║
# ║   input_path   = data/roads.geojson               ║
# ║   buffer_dist  = 500                              ║
# ║   output_dir   = output/                          ║
# ╠══════════════════════════════════════════════════╣
# ║ 步骤 (5):                                         ║
# ║  1. load-roads      →  io.read_vector             ║
# ║  2. reproject       →  vector.reproject           ║
# ║  3. buffer          →  vector.buffer              ║
# ║  4. reproject-back  →  vector.reproject           ║
# ║  5. save            →  io.write_vector            ║
# ╠══════════════════════════════════════════════════╣
# ║ 输出 (2):                                         ║
# ║   result        = $save                           ║
# ║   buffer_stats  = $buffer.stats                   ║
# ╚══════════════════════════════════════════════════╝
```

---

## 16.8 `geopipe-agent backends`：查看可用后端

```bash
geopipe-agent backends
```

输出示例：
```
可用后端:
  ✓ native_python  — GeoPandas + Shapely [始终可用]
  ✓ gdal_cli       — ogr2ogr 命令行 [GDAL 3.6.2]
  ✓ gdal_python    — GDAL Python API [GDAL 3.6.2]
  ✗ qgis_process   — QGIS Processing CLI [未找到 qgis_process]
  ✗ pyqgis         — PyQGIS Python API [QGIS 未安装]
  ✓ generic_cli    — 通用 CLI 后端 [始终可用]
  ✓ curl_api       — HTTP/curl 后端 [始终可用]

说明:
  ✓ 可用  ✗ 不可用（需要安装对应软件）
```

---

## 16.9 `geopipe-agent generate-skill-doc`：生成技能文档

### 16.9.1 说明

将框架的完整能力描述输出为 Markdown 格式的技能文档，可直接输出到终端或重定向到文件：

```bash
# 输出到终端
geopipe-agent generate-skill-doc

# 重定向到文件
geopipe-agent generate-skill-doc > SKILL.md

# 查看生成的文档
cat SKILL.md | head -50
```

---

## 16.10 `geopipe-agent generate-skill`：生成技能文件

### 16.10.1 基本语法

```bash
geopipe-agent generate-skill [--output-dir <目录>]
```

### 16.10.2 使用示例

```bash
# 生成到默认目录（skills/geopipe-agent/）
geopipe-agent generate-skill

# 指定输出目录
geopipe-agent generate-skill --output-dir my-skills/geopipe/

# 生成后查看文件结构
tree skills/
# skills/
# └── geopipe-agent/
#     ├── SKILL.md                          # 主技能描述
#     └── reference/
#         ├── steps-reference.md            # 完整步骤参考
#         └── pipeline-schema.md            # YAML Schema 规范
```

### 16.10.3 生成的文件说明

| 文件 | 内容 |
|------|------|
| `SKILL.md` | AI 技能主文件，包含框架概述和快速开始 |
| `reference/steps-reference.md` | 所有步骤的完整参数和输出文档 |
| `reference/pipeline-schema.md` | YAML 流水线格式的完整规范 |

---

## 16.11 在 CI/CD 中使用 CLI

### GitHub Actions 示例

```yaml
# .github/workflows/geoanalysis.yml
name: GIS Analysis Pipeline

on:
  push:
    paths:
      - 'pipelines/**'
      - 'data/**'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install GeoPipeAgent
        run: |
          pip install -e ".[analysis]"

      - name: Validate Pipeline
        run: |
          geopipe-agent validate pipelines/production.yaml

      - name: Run Analysis
        run: |
          geopipe-agent run pipelines/production.yaml \
            --var input_path=data/latest.geojson \
            --var output_dir=output/ \
            --log-level INFO \
            --output reports/latest_report.json

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: analysis-report
          path: reports/latest_report.json
```

### Jenkins Pipeline 示例

```groovy
pipeline {
    agent any
    stages {
        stage('Validate') {
            steps {
                sh 'geopipe-agent validate pipelines/daily_analysis.yaml'
            }
        }
        stage('Run Analysis') {
            steps {
                sh """
                    geopipe-agent run pipelines/daily_analysis.yaml \
                        --var input_path=${DATA_PATH} \
                        --var report_date=${BUILD_DATE} \
                        --json-log \
                        --output reports/report_${BUILD_NUMBER}.json
                """
            }
        }
    }
    post {
        always {
            archiveArtifacts 'reports/*.json'
        }
        failure {
            mail to: 'team@example.com',
                 subject: "GIS 分析失败 [${env.BUILD_NUMBER}]"
        }
    }
}
```

---

## 16.12 Shell 完成（Tab 补全）

```bash
# Bash
eval "$(_GEOPIPE_AGENT_COMPLETE=bash_source geopipe-agent)"

# Zsh
eval "$(_GEOPIPE_AGENT_COMPLETE=zsh_source geopipe-agent)"

# Fish
eval (env _GEOPIPE_AGENT_COMPLETE=fish_source geopipe-agent)

# 持久化（加入 ~/.bashrc）
echo 'eval "$(_GEOPIPE_AGENT_COMPLETE=bash_source geopipe-agent)"' >> ~/.bashrc
```

---

## 16.13 常见问题

### 问题一：`geopipe-agent` 命令不存在

```bash
# 检查虚拟环境是否激活
which python && which geopipe-agent

# 重新安装
pip install -e .
```

### 问题二：`run` 命令执行时找不到文件

```bash
# 确认当前工作目录
pwd

# 流水线中的相对路径基于运行命令的工作目录，而非 YAML 文件位置
# 应该从项目根目录运行
cd /path/to/project
geopipe-agent run pipelines/analysis.yaml
```

### 问题三：`--var` 类型问题

```bash
# CLI 传入的值默认为字符串，框架会自动转换
# 数值型变量
geopipe-agent run pipeline.yaml --var buffer_dist=500
# 等效于 YAML 中 buffer_dist: 500 （数值）

# 字符串变量（含特殊字符时加引号）
geopipe-agent run pipeline.yaml --var "road_filter=road_type == '主干道'"
```

---

## 16.14 本章小结

本章完整介绍了 `geopipe-agent` CLI 工具的所有命令：

1. **`run`**：执行流水线，支持变量覆盖、日志控制、报告输出
2. **`validate`**：静态校验流水线格式（适合 CI/CD 集成）
3. **`list-steps`**：查看可用步骤（支持分类过滤）
4. **`describe`**：查看步骤的详细参数和示例
5. **`info`**：查看流水线结构信息
6. **`backends`**：检查可用执行后端
7. **`generate-skill-doc`**：生成 AI 技能文档
8. **`generate-skill`**：生成完整 Skill 文件包

CLI 是 GeoPipeAgent 的主要使用入口，熟练掌握这些命令可以显著提升工作效率。

---

**导航**：[← 第十五章：数据模型与错误体系](15-数据模型与错误体系) ｜ [第十七章：AI Skill 生成系统 →](17-AI-Skill生成系统)

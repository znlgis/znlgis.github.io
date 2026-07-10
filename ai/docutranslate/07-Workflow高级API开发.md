---
layout: default
title: 第七章：Workflow 高级 API 开发
---

# 第七章：Workflow 高级 API 开发

Client SDK（第六章）足够应付绝大多数场景。但当你需要**更精细的控制**——例如自定义转换器配置、组合特定的导出器、复用底层对象做二次开发——就要用到底层的 **Workflow API**。本章讲解 Workflow 的统一模式、配置对象体系，以及各工作流的用法。

---

## 7.1 Workflow 的统一模式

所有工作流都遵循同一套「配置 → 实例化 → 读取 → 翻译 → 导出」的模式：

```
1. 创建 TranslatorConfig     （LLM 翻译设置）
2. 创建 WorkflowConfig        （工作流设置，含转换器 / 导出器配置）
3. 创建 Workflow 实例
4. workflow.read_path(文件)   （读取输入文件）
5. await workflow.translate_async()   （或同步 workflow.translate()）
6. workflow.save_as_*(name=...) 或 export_to_*(...)   （保存 / 导出）
```

关键点：

- **配置与执行分离**：先用 dataclass 风格的 Config 对象把参数组织好，再传给 Workflow。
- **同步 / 异步双接口**：`translate()` 与 `translate_async()` 都可用。
- **多种输出方法**：`save_as_html`、`save_as_markdown`、`save_as_docx` 等落盘；`export_to_html`、`export_to_markdown` 等返回内容字符串。

---

## 7.2 配置对象体系

Workflow API 用一组分层的 Config 对象来描述一次翻译：

- **TranslatorConfig（及子类如 `MDTranslatorConfig`）**：描述大模型翻译参数。
- **ConverterConfig（如 `ConverterMineruConfig`）**：描述文档转换器（PDF 解析）参数。
- **ExporterConfig（如 `MD2HTMLExporterConfig`）**：描述导出器参数。
- **WorkflowConfig（如 `MarkdownBasedWorkflowConfig`）**：把上述子配置组合起来，作为工作流的总配置。

### 通用 TranslatorConfig 选项

| 选项 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `base_url` | str | - | AI 平台基础 URL |
| `api_key` | str | - | AI 平台 API 密钥 |
| `model_id` | str | - | 模型 ID |
| `to_lang` | str | - | 目标语言 |
| `chunk_size` | int | 3000 | 文本分块大小 |
| `concurrent` | int | 10 | 并发请求数 |
| `temperature` | float | 0.3 | LLM 温度 |
| `timeout` | int | 60 | 请求超时（秒） |
| `retry` | int | 3 | 重试次数 |

（术语表、自定义提示词、思考模式、限速等参数同样可在 TranslatorConfig 中设置，见第八章。）

### 格式特定选项

| 选项 | 适用工作流 | 说明 |
|:---|:---|:---|
| `insert_mode` | Docx、Xlsx、Html、Epub | `replace`（默认）、`append`、`prepend` |
| `json_paths` | Json | JSONPath 表达式（如 `["$.*", "$.name"]`） |
| `separator` | Docx、Xlsx、Html、Epub | append/prepend 模式的分隔符 |
| `convert_engine` | MarkdownBased | `mineru`（默认）、`mineru_deploy` |

---

## 7.3 完整示例：用 MarkdownBasedWorkflow 翻译 PDF

这是最常见的用例——用 MinerU 把 PDF 转成 Markdown，再用大模型翻译，异步执行：

```python
import asyncio
from docutranslate.workflow.md_based_workflow import (
    MarkdownBasedWorkflow, MarkdownBasedWorkflowConfig,
)
from docutranslate.converter.x2md.converter_mineru import ConverterMineruConfig
from docutranslate.translator.ai_translator.md_translator import MDTranslatorConfig
from docutranslate.exporter.md.md2html_exporter import MD2HTMLExporterConfig


async def main():
    # 1. 翻译器配置
    translator_config = MDTranslatorConfig(
        base_url="https://open.bigmodel.cn/api/paas/v4",  # AI 平台 Base URL
        api_key="YOUR_ZHIPU_API_KEY",                     # API Key
        model_id="glm-4-air",                             # 模型 ID
        to_lang="English",                                # 目标语言
        chunk_size=3000,                                  # 分块大小
        concurrent=10,                                    # 并发数
        # glossary_generate_enable=True,                  # 启用自动术语表
        # glossary_dict={"Jobs": "乔布斯"},                # 传入术语表
        # system_proxy_enable=True,                        # 启用系统代理
    )

    # 2. 转换器配置（在线 MinerU）
    converter_config = ConverterMineruConfig(
        mineru_token="YOUR_MINERU_TOKEN",
        formula_ocr=True,     # 开启公式识别
    )

    # 3. 工作流总配置
    workflow_config = MarkdownBasedWorkflowConfig(
        convert_engine="mineru",
        converter_config=converter_config,
        translator_config=translator_config,
        html_exporter_config=MD2HTMLExporterConfig(cdn=True),  # HTML 导出配置
    )

    # 4. 实例化工作流
    workflow = MarkdownBasedWorkflow(config=workflow_config)

    # 5. 读取文件并翻译
    print("开始读取和翻译文件...")
    workflow.read_path("path/to/your/document.pdf")
    await workflow.translate_async()
    # 同步方式：workflow.translate()
    print("翻译完成！")

    # 6. 保存结果（多种格式）
    workflow.save_as_html(name="translated_document.html")
    workflow.save_as_markdown_zip(name="translated_document.zip")
    workflow.save_as_markdown(name="translated_document.md")  # 内嵌图片的 markdown
    print("文件已保存到 ./output 文件夹。")

    # 或直接拿到内容字符串
    html_content = workflow.export_to_html()
    md_content = workflow.export_to_markdown()


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 7.4 其他工作流的导入

所有工作流遵循相同模式，只需导入对应的 Workflow 与 Config：

```python
# TXT:  from docutranslate.workflow.txt_workflow import TXTWorkflow, TXTWorkflowConfig
# JSON: from docutranslate.workflow.json_workflow import JsonWorkflow, JsonWorkflowConfig
# DOCX: from docutranslate.workflow.docx_workflow import DocxWorkflow, DocxWorkflowConfig
# XLSX: from docutranslate.workflow.xlsx_workflow import XlsxWorkflow, XlsxWorkflowConfig
# EPUB: from docutranslate.workflow.epub_workflow import EpubWorkflow, EpubWorkflowConfig
# HTML: from docutranslate.workflow.html_workflow import HtmlWorkflow, HtmlWorkflowConfig
# SRT:  from docutranslate.workflow.srt_workflow import SrtWorkflow, SrtWorkflowConfig
# ASS:  from docutranslate.workflow.ass_workflow import AssWorkflow, AssWorkflowConfig
```

它们的 Config 里主要区别在于格式特定选项：

- `insert_mode`：`replace` / `append` / `prepend`（用于 docx / xlsx / html / epub）。
- `json_paths`：JSONPath 表达式（用于 JSON）。
- `separator`：append/prepend 模式的分隔符。

---

## 7.5 何时用 Workflow API，何时用 Client SDK

| 需求 | 推荐 |
|:---|:---|
| 快速翻译一个 / 一批文件 | Client SDK |
| 让工具自动判断文件类型 | Client SDK |
| 需要精确指定转换器 / 导出器配置 | Workflow API |
| 需要访问底层 workflow 对象做二次开发 | Workflow API（或 `Result.workflow`） |
| 想在框架里内嵌自定义组件 | Workflow API |

其实 Client SDK 内部也是调用 Workflow 实现的，`Result.workflow` 还能拿到底层工作流对象。所以你可以**先用 Client SDK 起步，需要精细控制时再下沉到 Workflow API**。

---

## 7.6 小结

- Workflow API 的统一套路：建 Config → 建 Workflow → `read_path` → `translate(_async)` → `save_as_*` / `export_to_*`。
- 配置分层：TranslatorConfig（翻译）+ ConverterConfig（解析）+ ExporterConfig（导出）→ WorkflowConfig（总）。
- 各格式工作流导入路径规整，格式差异集中在少数格式特定选项。
- 下一章讲三项跨工作流的高级能力：术语表、自定义提示词与 JSON 翻译。

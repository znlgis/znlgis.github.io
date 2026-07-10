---
layout: default
title: 第六章：Client SDK 编程使用
---

# 第六章：Client SDK 编程使用

如果你想在 Python 脚本、自动化流程或自己的应用中调用 DocuTranslate，最简单的方式就是 **Client SDK**。它把复杂的工作流、转换器、导出器都封装在一个 `Client` 类背后，几行代码即可完成翻译。本章详细讲解 `Client` 的用法、全部参数与 `Result` 结果对象。

---

## 6.1 最小示例

```python
from docutranslate.sdk import Client

# 用你的 AI 平台设置初始化客户端
client = Client(
    api_key="YOUR_OPENAI_API_KEY",       # 或其他兼容平台的 API key
    base_url="https://api.openai.com/v1/",
    model_id="gpt-4o",
    to_lang="中文",
    concurrent=10,                         # 并发请求数
)

# 翻译纯文本文件（无需 PDF 解析引擎）
result = client.translate("path/to/your/document.txt")
print(f"翻译完成！保存位置: {result.save()}")
```

`Client` 的核心优点：

- **自动检测**：自动识别文件类型并选择合适的工作流。
- **灵活配置**：可在初始化时设默认值，也可在每次 `translate()` 调用时覆盖。
- **多种输出**：既能保存到磁盘，也能导出为 Base64 字符串（便于 API 传输）。
- **异步支持**：`translate_async()` 支持并发翻译多个文件。

---

## 6.2 翻译不同类型的文件

### 翻译 PDF（需要 MinerU）

```python
# 方式 A：在线 MinerU（需要 Token）
result = client.translate(
    "path/to/your/document.pdf",
    convert_engine="mineru",
    mineru_token="YOUR_MINERU_TOKEN",
    formula_ocr=True,      # 启用公式识别
)
result.save(fmt="html")    # 论文推荐导出 html

# 方式 B：本地部署 MinerU（内网 / 离线）
result = client.translate(
    "path/to/your/document.pdf",
    convert_engine="mineru_deploy",
    mineru_deploy_base_url="http://127.0.0.1:8000",
    mineru_deploy_backend="hybrid-auto-engine",
)
result.save(fmt="markdown")
```

### 翻译 Word（保持格式）

```python
result = client.translate(
    "path/to/your/document.docx",
    insert_mode="replace",   # replace / append / prepend
)
result.save(fmt="docx")      # 保存为 docx，保留格式
```

### 导出为 Base64（用于 API 传输）

```python
base64_content = result.export(fmt="html")
print(f"导出内容长度: {len(base64_content)}")
```

---

## 6.3 Client 参数完整说明

初始化 `Client` 或调用 `translate()` 时可用的参数（同名参数在 `translate()` 中会覆盖初始化时的默认值）：

### 基础配置

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `api_key` | str | - | AI 平台 API 密钥 |
| `base_url` | str | - | AI 平台基础 URL |
| `model_id` | str | - | 翻译使用的模型 ID |
| `to_lang` | str | - | 目标语言（如 `"中文"`、`"English"`、`"日本語"`） |
| `provider` | str | `"auto"` | AI 提供商类型（auto、openai、azure 等） |

### 性能与调优

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `concurrent` | int | 10 | 并发 LLM 请求数 |
| `chunk_size` | int | 3000 | 文本分块大小 |
| `temperature` | float | 0.3 | LLM 温度参数 |
| `timeout` | int | 60 | 请求超时（秒） |
| `retry` | int | 3 | 失败重试次数 |
| `rpm` | int | - | 每分钟请求数限制 |
| `tpm` | int | - | 每分钟 Token 数限制 |
| `thinking` | str | `"auto"` | 思考模式：`"auto"`、`"none"`、`"block"` |
| `force_json` | bool | False | 强制 JSON 输出模式 |
| `extra_body` | str | - | JSON 字符串格式的额外请求体，会合并进 API 请求 |
| `custom_prompt` | str | - | 自定义翻译提示词 |
| `system_proxy_enable` | bool | False | 启用系统代理 |

### 输出与保存

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `output_dir` | str | `"./output"` | `save()` 的默认输出目录 |
| `skip_translate` | bool | False | 跳过翻译，仅解析文档 |

### PDF / MinerU 相关

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `convert_engine` | str | `"mineru"` | PDF 解析引擎：`mineru`、`mineru_deploy` |
| `md2docx_engine` | str | `"auto"` | Markdown 转 docx 引擎：`python`、`pandoc`、`auto`、`null` |
| `mineru_token` | str | - | 在线 MinerU 的 Token |
| `model_version` | str | `"vlm"` | MinerU 模型版本：`pipeline`、`vlm` |
| `formula_ocr` | bool | True | PDF 解析启用公式 OCR |
| `code_ocr` | bool | True | PDF 解析启用代码 OCR |
| `mineru_deploy_base_url` | str | - | 本地 MinerU 地址 |
| `mineru_deploy_backend` | str | `"hybrid-auto-engine"` | 本地后端类型 |
| `mineru_deploy_parse_method` | str | `"auto"` | 解析方法：`auto`、`txt`、`ocr` |
| `mineru_deploy_table_enable` | bool | True | 本地启用表格识别 |
| `mineru_deploy_formula_enable` | bool | True | 本地启用公式识别 |
| `mineru_deploy_start_page_id` | int | 0 | 本地解析起始页 |
| `mineru_deploy_end_page_id` | int | 99999 | 本地解析结束页 |
| `mineru_deploy_lang_list` | list | - | 本地解析语言列表 |
| `mineru_deploy_server_url` | str | - | http-client 后端服务地址 |

### 格式特定

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `insert_mode` | str | `"replace"` | Docx/Xlsx/Txt 插入模式：`replace`、`append`、`prepend` |
| `separator` | str | `"\n"` | append/prepend 模式的分隔符 |
| `segment_mode` | str | `"line"` | 分段模式：`line`、`paragraph`、`none` |
| `translate_regions` | list | - | Excel 翻译区域（如 `"Sheet1!A1:B10"`） |
| `json_paths` | list | - | JSON 翻译的 JSONPath 表达式（如 `"$.data.*"`） |

### 术语表

| 参数 | 类型 | 默认值 | 说明 |
|:---|:---|:---|:---|
| `glossary_generate_enable` | bool | - | 启用自动术语表生成 |
| `glossary_dict` | dict | - | 术语表字典（如 `{"Jobs": "乔布斯"}`） |
| `glossary_agent_config` | dict | - | 术语表代理配置 |

---

## 6.4 Result 结果对象

`translate()` 返回一个 `Result` 对象，提供以下方法 / 属性：

| 方法 / 属性 | 参数 | 说明 |
|:---|:---|:---|
| `save()` | `output_dir`、`name`、`fmt` | 将翻译结果保存到磁盘，返回保存路径 |
| `export()` | `fmt` | 导出为 Base64 编码字符串（适合 API 传输） |
| `supported_formats` | - | 获取当前结果支持的输出格式列表 |
| `workflow` | - | 访问底层工作流对象，进行高级操作 |

`fmt` 的取值取决于文件类型对应的工作流（见第五章），例如 `html`、`markdown`、`markdown_zip`、`docx`、`txt`、`xlsx`、`json`、`epub`、`srt`、`ass` 等。

```python
result = client.translate("paper.pdf", convert_engine="mineru", mineru_token="...")
print(result.supported_formats)          # 查看可导出的格式
path = result.save(name="paper_zh", fmt="html")  # 保存 html
print(f"已保存到 {path}")
```

---

## 6.5 异步与批量翻译

`Client` 提供 `translate_async()`，配合 `asyncio.gather` 可以并发翻译多个文件，显著提升批量任务的吞吐：

```python
import asyncio
from docutranslate.sdk import Client

async def translate_multiple():
    client = Client(
        api_key="YOUR_API_KEY",
        base_url="https://api.openai.com/v1/",
        model_id="gpt-4o",
        to_lang="中文",
    )

    files = ["doc1.pdf", "doc2.docx", "notes.txt"]
    results = await asyncio.gather(
        *[client.translate_async(f) for f in files]
    )

    for r in results:
        print(f"保存位置: {r.save()}")

asyncio.run(translate_multiple())
```

注意：并发翻译多个文件时，每个文件内部还会有 `concurrent` 个分块并发。请综合估算总并发量，避免触发平台的 RPM/TPM 限制（可用 `rpm`、`tpm` 参数限流）。

---

## 6.6 小结

- `Client` 是最推荐的编程入口：初始化一次，之后 `translate()` / `translate_async()` 即可。
- 参数很多，但大多有合理默认值——最少只需 `api_key`、`base_url`、`model_id`、`to_lang`。
- 翻译 PDF 记得加 `convert_engine` 和 MinerU 相关参数。
- `Result` 用 `save()` 落盘、`export()` 拿 Base64、`supported_formats` 查可用格式。
- 需要更精细控制（自定义转换器 / 导出器）时，进入下一章的 Workflow API。

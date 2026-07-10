---
layout: default
title: 第四章：大模型与 PDF 解析引擎配置
---

# 第四章：大模型与 PDF 解析引擎配置

DocuTranslate 依赖两类外部能力：

1. **大语言模型（必需）**：负责翻译，需要 `base_url`、`api_key`、`model_id`。
2. **PDF 解析引擎（仅翻译 PDF 时需要）**：负责把 PDF 解析成 Markdown，使用 MinerU（在线或本地）。

本章逐一讲清如何配置这两块，这也是新手最容易卡住的地方。

---

## 4.1 获取大模型 API Key

翻译功能依赖大模型，你需要从任一 AI 平台拿到三样东西：`base_url`、`api_key`、`model_id`。DocuTranslate 支持绝大部分**兼容 OpenAI 接口**的平台。

### 4.1.1 推荐模型

官方推荐性价比高、速度快的模型：

- 火山引擎：`doubao-seed-1-6-flash`、`doubao-seed-1-6` 系列
- 智谱：`glm-4-flash`（有免费额度）
- 阿里云：`qwen-plus`、`qwen-flash`
- DeepSeek：`deepseek-chat`

翻译任务通常不需要顶级推理模型，选「快而便宜」的 flash 类模型即可获得很好的性价比。

### 4.1.2 常见平台的 base_url 一览

| 平台名称 | 获取 API Key | base_url |
|:---|:---|:---|
| ollama（本地） | 无需 Key | `http://127.0.0.1:11434/v1` |
| lm studio（本地） | 无需 Key | `http://127.0.0.1:1234/v1` |
| 302.AI | [获取](https://share.302.ai/BgRLAe) | `https://api.302.ai/v1` |
| openrouter | [获取](https://openrouter.ai/settings/keys) | `https://openrouter.ai/api/v1` |
| openai | [获取](https://platform.openai.com/api-keys) | `https://api.openai.com/v1/` |
| gemini | [获取](https://aistudio.google.com/u/0/apikey) | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| deepseek | [获取](https://platform.deepseek.com/api_keys) | `https://api.deepseek.com/v1` |
| 智谱 AI | [获取](https://open.bigmodel.cn/usercenter/apikeys) | `https://open.bigmodel.cn/api/paas/v4` |
| 腾讯混元 | [获取](https://console.cloud.tencent.com/hunyuan/api-key) | `https://api.hunyuan.cloud.tencent.com/v1` |
| 阿里云百炼 | [获取](https://bailian.console.aliyun.com/?tab=model#/api-key) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 火山引擎 | [获取](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey) | `https://ark.cn-beijing.volces.com/api/v3` |
| 硅基流动 | [获取](https://cloud.siliconflow.cn/account/ak) | `https://api.siliconflow.cn/v1` |
| DMXAPI | [获取](https://www.dmxapi.cn/token) | `https://www.dmxapi.cn/v1` |
| 聚光 AI | [获取](https://ai.juguang.chat/console/token) | `https://ai.juguang.chat/v1` |

只要平台兼容 OpenAI 的 `/chat/completions` 接口，都可以按同样方式填写。

### 4.1.3 使用本地模型（离线 / 内网）

若你希望完全离线或不想把内容发给云端，可用 **Ollama** 或 **LM Studio** 在本机跑开源模型：

- Ollama：`base_url` 填 `http://127.0.0.1:11434/v1`，`api_key` 随便填一个非空值，`model_id` 填你 `ollama pull` 下来的模型名（如 `qwen2.5`）。
- LM Studio：`base_url` 填 `http://127.0.0.1:1234/v1`，在 LM Studio 中加载模型并开启本地服务。

本地模型翻译质量取决于模型大小与显存，适合对隐私要求极高的场景。

---

## 4.2 PDF 解析引擎概览

**只有翻译 PDF（以及部分走 Markdown 流程的文件）时才需要解析引擎。** 翻译 txt / docx / xlsx / json / epub / 字幕都不需要它。

DocuTranslate 支持的转换引擎（`convert_engine`）包括：

- `identity`：不做额外转换（用于已经是文本 / Markdown 的输入）。
- `mineru`：使用在线 [MinerU](https://mineru.net) 云端服务解析 PDF（免费，需要 Token，**推荐**）。
- `mineru_deploy`：使用你**本地部署**的 MinerU 服务解析（离线 / 内网）。
- `docling`：另一种文档解析引擎（可选）。

MinerU 具备 OCR 能力，能处理**扫描件 PDF**，并识别学术论文中的**表格、公式、代码**。

---

## 4.3 方案 A：在线 MinerU（推荐，免费）

如果选择 `convert_engine="mineru"`，需要申请一个免费的 MinerU Token：

1. 访问 [MinerU 官网 API 文档](https://mineru.net/apiManage/docs) 注册并申请 API。
2. 在 [API Token 管理界面](https://mineru.net/apiManage/token) 创建一个新的 Token。
3. 把 Token 填入 Web 界面对应字段，或在代码中传入 `mineru_token`。

> ⚠️ **注意**：MinerU Token 有 **14 天有效期**，过期后需要重新创建。

在线 MinerU 的优点是无需本地算力、开箱即用；缺点是 PDF 内容会上传到 MinerU 云端解析（对隐私敏感的内容请改用本地部署）。

相关可调参数（详见第六、七章）：

- `model_version`：MinerU 模型版本，`"pipeline"` 或 `"vlm"`（默认 `vlm`）。
- `formula_ocr`：是否启用公式 OCR（默认 `True`）。
- `code_ocr`：是否启用代码 OCR（默认 `True`）。
- `mineru_language`（环境变量 `DOCUTRANSLATE_MINERU_LANGUAGE`）：解析语言，如 `ch`、`en`、`japan`。

---

## 4.4 方案 B：本地部署 MinerU（离线 / 内网）

在离线或内网环境中，可以本地部署 MinerU，然后设 `convert_engine="mineru_deploy"`，把 `mineru_deploy_base_url` 指向你的本地 MinerU 地址。

本地 MinerU 的部署参考其官方仓库 [opendatalab/MinerU](https://github.com/opendatalab/MinerU)。部署好后，DocuTranslate 中的相关参数：

| 参数 | 说明 | 默认值 |
|:---|:---|:---|
| `mineru_deploy_base_url` | 本地 MinerU API 地址 | 如 `http://127.0.0.1:8000` |
| `mineru_deploy_backend` | 后端类型：`pipeline`、`vlm-auto-engine`、`vlm-http-client`、`hybrid-auto-engine`、`hybrid-http-client` | `hybrid-auto-engine` |
| `mineru_deploy_parse_method` | 解析方法：`auto`、`txt`、`ocr` | `auto` |
| `mineru_deploy_table_enable` | 是否启用表格识别 | `True` |
| `mineru_deploy_formula_enable` | 是否启用公式识别 | `True` |
| `mineru_deploy_start_page_id` | 解析起始页 | `0` |
| `mineru_deploy_end_page_id` | 解析结束页 | `99999` |
| `mineru_deploy_lang_list` | 解析语言列表 | - |
| `mineru_deploy_server_url` | http-client 后端时的服务地址 | - |

Client SDK 使用示例（详见第六章）：

```python
from docutranslate.sdk import Client

client = Client(
    api_key="YOUR_LLM_API_KEY",
    base_url="https://api.deepseek.com/v1",
    model_id="deepseek-chat",
    to_lang="中文",
    convert_engine="mineru_deploy",
    mineru_deploy_base_url="http://127.0.0.1:8000",  # 你的本地 MinerU 地址
)
result = client.translate("document.pdf")
result.save(fmt="markdown")
```

本地部署的优点是完全离线、数据不出内网；缺点是需要一定的部署成本与算力（尤其 VLM 后端）。

---

## 4.5 「大模型」与「PDF 解析」是两件独立的事

新手常见误解：以为翻译 PDF 只需要一个大模型 Key。实际上：

- **大模型**（DeepSeek / 智谱 / 本地模型…）负责**翻译文字**。
- **MinerU**（在线 / 本地）负责**把 PDF 变成可翻译的文本**。

翻译 PDF 时，两者都要配置好；翻译非 PDF 文件时，只需要大模型。你完全可以「用云端 DeepSeek 翻译 + 在线 MinerU 解析」，也可以「用本地 Ollama 翻译 + 本地 MinerU 解析」实现全离线。

---

## 4.6 小结

- 大模型配置三要素：`base_url` + `api_key` + `model_id`，任意兼容 OpenAI 的平台皆可，推荐 flash 类高性价比模型。
- 想离线翻译就用 Ollama / LM Studio 本地模型。
- 翻译 PDF 才需要 MinerU：在线 MinerU 免费但 Token 14 天有效且内容上云；本地 MinerU 全离线但需自行部署。
- 记住：大模型负责「翻译」，MinerU 负责「把 PDF 变文本」，二者独立配置。

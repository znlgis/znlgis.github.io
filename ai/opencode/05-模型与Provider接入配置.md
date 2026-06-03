---
layout: default
title: 第五章：模型与 Provider 接入配置
---

# 第五章：模型与 Provider 接入配置

模型选择直接决定 OpenCode 的能力、速度和成本。本章讲解如何接入 Provider、选择与配置模型、使用模型变体（variants）控制推理强度，以及如何接入本地模型——这些都是「最优化配置」的核心抓手。

---

## 5.1 Provider 与模型的关系

OpenCode 基于 [AI SDK](https://ai-sdk.dev/) 和 [Models.dev](https://models.dev)，支持 **75+ 个 Provider**。模型的完整 ID 格式始终是：

```text
provider_id/model_id
```

例如：

- `anthropic/claude-sonnet-4-5`
- `openai/gpt-5`
- `opencode/gpt-5.1-codex`（通过 OpenCode Zen）
- `ollama/llama2`（本地自定义 Provider）

大多数主流 Provider 已预加载。通过 `/connect` 添加密钥，或设置对应环境变量，即可在启动时自动可用。

---

## 5.2 选择与设置默认模型

在 TUI 内用 `/models` 选择当前模型。要设置默认模型，在配置里写 `model`：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5"
}
```

### 模型加载优先级

启动时按以下顺序决定使用哪个模型：

1. 命令行 `--model` / `-m` 标志（格式同样是 `provider/model`）；
2. 配置文件里的 `model`；
3. 上次使用的模型；
4. 按内部优先级选第一个可用模型。

---

## 5.3 `small_model`：轻量任务分流（省钱关键）

OpenCode 会执行一些「轻量任务」，比如生成会话标题、做摘要。这些任务**不需要**昂贵的旗舰模型。`small_model` 让你为它们指定一个便宜的小模型：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5"
}
```

默认情况下，OpenCode 会尝试用你 Provider 下更便宜的模型，否则回退到主模型。**显式配置一个真正便宜的小模型，是最简单的一笔省钱操作**（详见第九章）。

---

## 5.4 推荐模型

模型层出不穷，但真正同时擅长「写代码」和「工具调用」的并不多。官方推荐（非穷举、可能过时）包括：

- GPT 5.2
- GPT 5.1 Codex
- Claude Opus 4.5
- Claude Sonnet 4.5
- Minimax M2.1
- Gemini 3 Pro

实务建议：**日常实现用 Sonnet 级别，复杂硬骨头临时切到 Opus/GPT 旗舰，轻量任务用 Haiku/Mini/Nano**。这种「分层用模」策略能在质量和成本间取得最佳平衡。

---

## 5.5 配置模型选项

可在 `provider.<id>.models.<model>.options` 下为具体模型设置参数，例如 OpenAI 的推理强度、Anthropic 的思考预算：

```jsonc title="opencode.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "openai": {
      "models": {
        "gpt-5": {
          "options": {
            "reasoningEffort": "high",
            "textVerbosity": "low",
            "reasoningSummary": "auto"
          }
        }
      }
    },
    "anthropic": {
      "models": {
        "claude-sonnet-4-5-20250929": {
          "options": {
            "thinking": { "type": "enabled", "budgetTokens": 16000 }
          }
        }
      }
    }
  }
}
```

> 这里的 `reasoningEffort`、`textVerbosity`、`thinking.budgetTokens` 等都是**省 Token 的直接旋钮**：降低推理强度、降低输出冗长度、压低思考预算，都会显著减少 Token 消耗（第九章详述）。Agent 级配置会覆盖这里的全局设置。

---

## 5.6 模型变体（Variants）：一键切换推理强度

变体让同一个模型拥有多套配置，无需重复定义。OpenCode 为许多 Provider 内置了默认变体：

- **Anthropic**：`high`（默认）、`max`（最大思考预算）
- **OpenAI**：大致有 `none` / `minimal` / `low` / `medium` / `high` / `xhigh`
- **Google**：`low` / `high`

### 自定义变体

```jsonc title="opencode.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "openai": {
      "models": {
        "gpt-5": {
          "variants": {
            "thinking": { "reasoningEffort": "high", "textVerbosity": "low" },
            "fast":     { "disabled": true }
          }
        }
      }
    }
  }
}
```

### 在会话中循环切换变体

用键位 `variant_cycle`（默认 `ctrl+t`）即可在变体间快速切换。**这是日常控制成本的利器**：简单任务切到 `low`/`minimal`，难题临时切到 `high`/`max`，用完再切回来。

---

## 5.7 Provider 通用选项：超时与缓存

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "options": {
        "timeout": 600000,
        "chunkTimeout": 30000,
        "setCacheKey": true
      }
    }
  }
}
```

- `timeout`：请求超时（毫秒，默认 300000），设为 `false` 关闭。
- `chunkTimeout`：流式响应分块之间的超时，超时则中止请求。
- `setCacheKey`：确保为该 Provider 始终设置缓存键。**对支持提示缓存（prompt caching）的模型，这能大幅降低重复上下文的费用**（第九章详述）。

也可用 `baseURL` 自定义任意 Provider 的端点（代理或自建网关）：

```json title="opencode.json"
{
  "provider": {
    "anthropic": { "options": { "baseURL": "https://api.anthropic.com/v1" } }
  }
}
```

---

## 5.8 OpenCode Zen：官方精选模型网关

OpenCode Zen 是官方测试并调优过的模型清单，作为一个普通 Provider 接入，**完全可选**：

1. 在 [OpenCode Zen 控制台](https://opencode.ai/auth) 登录、填账单、拿 API Key；
2. TUI 内 `/connect` 选 OpenCode Zen 并粘贴密钥；
3. `/models` 查看推荐模型，按量计费。

在配置里 Zen 模型 ID 形如 `opencode/<model-id>`，例如：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/gpt-5.1-codex"
}
```

Zen 的价值在于：它替你解决了「同一个模型在不同 Provider 上质量参差不齐」的问题——经过基准测试与调优，开箱即得到「这个模型的最佳版本」。

---

## 5.9 接入本地模型（零 API 费用）

本地模型完全免费（只耗电与算力），是极致省钱的方案。OpenCode 通过自定义 Provider + OpenAI 兼容端点接入它们。

### Ollama

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": {
        "llama2": { "name": "Llama 2" }
      }
    }
  }
}
```

字段说明：

- `ollama`：自定义 Provider ID，可任意命名；
- `npm`：使用的适配包，OpenAI 兼容 API 用 `@ai-sdk/openai-compatible`；
- `name`：UI 显示名；
- `options.baseURL`：本地服务端点；
- `models`：模型 ID → 配置的映射。

> 提示：若工具调用不工作，尝试在 Ollama 中增大 `num_ctx`（从 16k–32k 起步）。

### LM Studio

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "lmstudio": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio (local)",
      "options": { "baseURL": "http://127.0.0.1:1234/v1" },
      "models": {
        "google/gemma-3n-e4b": { "name": "Gemma 3n-e4b (local)" }
      }
    }
  }
}
```

llama.cpp 的 `llama-server`（默认 `http://127.0.0.1:8080/v1`）等其它 OpenAI 兼容端点同理。

---

## 5.10 限制可用 Provider

为避免误用昂贵 Provider，或在团队中收敛选择，可用白名单/黑名单：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "enabled_providers": ["anthropic", "openai"],
  "disabled_providers": ["gemini"]
}
```

- `enabled_providers`：白名单，设置后只启用列出的 Provider；
- `disabled_providers`：黑名单，即使有密钥/环境变量也不加载；
- **`disabled_providers` 优先级高于 `enabled_providers`**。

被禁用的 Provider 不会加载、不会出现在 `/models` 列表里。

---

## 5.11 小结

本章你掌握了：模型 ID 格式、默认模型与加载优先级、`small_model` 分流、模型选项与变体、Provider 超时与缓存、OpenCode Zen、本地模型接入、以及 Provider 白/黑名单。其中 `small_model`、变体切换、`setCacheKey`、`reasoningEffort`/`textVerbosity`、本地模型，都是第九章「Token 优化」会反复使用的核心工具。

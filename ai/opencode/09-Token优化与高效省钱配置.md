---
layout: default
title: 第九章：Token 优化与高效省钱配置（重点）
---

# 第九章：Token 优化与高效省钱配置（重点）

这是本教程的**核心章节**。我们把前面所有零散的配置项，组装成一套系统化的「更省 Token、更高效」的最优化策略。目标只有一个：在**不牺牲（甚至提升）效果**的前提下，把每个任务的 Token 消耗与费用压到最低。

先记住一条总纲：**Token 成本 ≈ 上下文体积 × 单价 × 调用轮数**。一切优化都围绕这三个因子展开——压缩上下文、降低单价、减少无效轮数。

---

## 9.1 先量化，再优化：用数据驱动

优化前一定先看清钱花在哪。用 `opencode stats`：

```bash
opencode stats --days 7 --models 5   # 最近 7 天，按模型 Top5 看用量
opencode stats --tools 10            # 看哪些工具被调用最多
opencode stats --project ""          # 只看当前项目
```

重点关注：

- **哪个模型消耗最大** → 是否能把它的部分工作分流到更便宜的模型；
- **哪类工具调用最频繁** → 是否有冗余的读取/搜索可以收敛；
- **输入 Token 是否远大于输出** → 通常意味着上下文太臃肿（MCP 工具、长历史、重复读文件）。

优化一轮后再次 `stats` 对比，形成闭环。

---

## 9.2 因子一：压缩上下文体积

上下文是最大的成本来源。OpenCode 提供多个旋钮。

### 9.2.1 自动压缩与裁剪（`compaction`）

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 10000
  }
}
```

- `auto`（默认 `true`）：上下文将满时**自动压缩**会话为更短的摘要，避免溢出与昂贵的长上下文请求。
- `prune`（默认 `true`）：**移除旧的工具输出**以省 Token——这通常是上下文里最臃肿的部分（大段文件内容、命令输出）。
- `reserved`：为压缩预留的 Token 缓冲，避免压缩过程本身溢出。

> 建议保持 `auto` 与 `prune` 都为 `true`。这是「无脑省钱」的默认底座。

### 9.2.2 主动压缩（`/compact`）

不必等自动触发，在一个阶段性任务完成后主动 `/compact`（键位 `ctrl+x c`）把上下文收敛成摘要，再继续下一阶段。养成「里程碑后压缩」的习惯。

### 9.2.3 一个任务一个会话（`/new`）

长会话会持续累积历史。**完成一个独立任务就 `/new`（`ctrl+x n`）开新会话**，是最简单有效的降本动作——丢掉无关历史，让新任务从干净上下文起步。

### 9.2.4 精准喂上下文，而非全量

- 用 `@文件` 只引用**相关**文件，而不是让模型漫无目的地读整个仓库。
- 用只读子代理 `@explore` / `@scout` 做检索，让它们在**子会话**里消化大量文件，主会话只接收结论（见 9.4）。
- 在 `AGENTS.md` 里写「按需懒加载外部文件」的指令（见第七章 7.3），避免一次性灌入所有规则。

### 9.2.5 用 Skills 替代「大块常驻提示词」

Skills（`SKILL.md`）只在需要时被加载，平时只占一行描述。把冗长的操作流程从 `AGENTS.md` 迁到 Skill，可显著降低每次请求的固定上下文开销。

---

## 9.3 因子二：降低单价（分层用模）

不同任务对模型能力的需求天差地别。**让贵模型只做难事，便宜模型做杂活**，是性价比最高的策略。

### 9.3.1 配置 `small_model` 分流轻量任务

标题生成、摘要等后台任务用便宜模型：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5"
}
```

### 9.3.2 按 Agent / 命令分层用模

- 规划、审查、检索类 Agent → 便宜模型；
- 实现类 Agent → 强模型；
- 自定义命令可单独指定 `model`，并用 `subtask: true` 丢进子会话。

```json title="opencode.json"
{
  "agent": {
    "plan":    { "model": "anthropic/claude-haiku-4-5" },
    "build":   { "model": "anthropic/claude-sonnet-4-5" },
    "review":  { "mode": "subagent", "model": "anthropic/claude-haiku-4-5", "permission": { "edit": "deny" } }
  }
}
```

### 9.3.3 用变体动态调推理强度

用 `ctrl+t`（`variant_cycle`）在会话中随时切换推理强度：简单任务用 `low`/`minimal`，难题临时升到 `high`/`max`，用完切回。也可预定义变体（见第五章 5.6）。推理 Token 往往是隐形大头，按需调强度能省很多。

### 9.3.4 降低推理与输出冗长度

对支持的模型，全局或按 Agent 压低这两个旋钮：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "openai": {
      "models": {
        "gpt-5": {
          "options": { "reasoningEffort": "low", "textVerbosity": "low" }
        }
      }
    },
    "anthropic": {
      "models": {
        "claude-sonnet-4-5-20250929": {
          "options": { "thinking": { "type": "enabled", "budgetTokens": 8000 } }
        }
      }
    }
  }
}
```

- `reasoningEffort: low/minimal` → 减少推理 Token；
- `textVerbosity: low` → 输出更精炼，减少输出 Token；
- `thinking.budgetTokens` 调小 → 压低 Anthropic 思考预算。

> 权衡：推理强度过低会损伤复杂任务质量。实践做法是「默认低、难题临时升」。

### 9.3.5 善用本地模型与免费层

把「不敏感、可容错」的杂活（生成样板、解释代码、起草文档）交给本地模型（Ollama / LM Studio，见第五章 5.9），API 费用直接归零。OpenCode Zen 也提供若干免费模型可作小模型分流。

### 9.3.6 开启提示缓存（`setCacheKey`）

对支持 prompt caching 的 Provider，开启缓存键可让**重复的系统提示/上下文前缀**以极低价复用：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": { "options": { "setCacheKey": true } }
  }
}
```

在「同一会话多轮、系统提示固定」的编码场景，缓存命中能显著降本。

---

## 9.4 因子三：减少无效轮数与浪费

### 9.4.1 Plan → Build 工作流

先在 `plan` 模式让模型把方案说清楚、你确认无误，再切 `build` 实现。**这能大幅减少「实现错了再推翻重来」的昂贵返工**。把 `default_agent` 设为 `plan` 让每个会话默认从规划开始：

```json title="opencode.json"
{ "$schema": "https://opencode.ai/config.json", "default_agent": "plan" }
```

### 9.4.2 用 `steps` 给智能体设迭代上限

防止模型陷入「反复试探」的烧钱循环：

```json title="opencode.json"
{
  "agent": {
    "build": { "steps": 25 },
    "quick": { "steps": 5 }
  }
}
```

达到上限时它会总结进度并列出剩余任务，由你决定是否继续。

### 9.4.3 只读子代理隔离「重读取」上下文

把检索、调研这类「读很多、产出一句结论」的工作交给 `@explore`（代码库）和 `@scout`（外部依赖）。它们在独立子会话里消耗 Token，**主会话只拿回精炼结果**，避免大量文件内容污染主上下文、在后续每一轮被重复计费。

### 9.4.4 克制 MCP，裁剪工具

- 每个启用的 MCP 都把工具描述常驻进上下文，**每一轮都为它付费**。只开真正要用的，其余 `enabled: false`。
- 用权限把不需要的工具/某 MCP 整组 `deny`，让模型「看不到」它们，从而不为其描述付费：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "websearch": "deny",
    "githubmcp_*": "deny"
  }
}
```

### 9.4.5 提供高质量上下文，减少来回澄清

`AGENTS.md` 写清构建/测试命令、约定与坑；用 `@文件` 给足参考；像对初级开发者那样把需求讲清楚。**前期多花几十 Token 把话说明白，能省下后面成百上千 Token 的反复问答。**

### 9.4.6 LSP 减少「猜代码」

启用 `lsp`（第八章 8.7）让模型直接拿到诊断与符号信息，减少「改完跑、报错再改」的循环。

---

## 9.5 与「大仓库性能」相关的开关

大型仓库里，部分功能会带来额外 IO/索引开销，按需调整：

### 快照（`snapshot`）

OpenCode 用内部 Git 仓库跟踪文件改动以支持撤销/回滚。超大仓库或多 submodule 项目可能因此索引慢、占盘大：

```json title="opencode.json"
{ "$schema": "https://opencode.ai/config.json", "snapshot": false }
```

> 权衡：关闭后 `/undo`、`/redo` 将无法回滚文件改动。一般建议保留，仅在确有性能问题时关闭。

### 文件监听忽略（`watcher`）

把噪声目录排除出文件监听，减少无谓开销：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "watcher": { "ignore": ["node_modules/**", "dist/**", ".git/**"] }
}
```

### 图片附件归一化（`attachment.image`）

OpenCode 会在发送前压缩过大图片，避免巨大的 base64 负载吃 Token：

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "attachment": {
    "image": { "auto_resize": true, "max_width": 2000, "max_height": 2000 }
  }
}
```

---

## 9.6 「最优化配置」速查清单

把上面的策略落成一份可执行清单：

- [ ] `compaction.auto` 与 `compaction.prune` 保持开启
- [ ] 配置 `small_model` 分流轻量任务
- [ ] 按 Agent/命令分层用模（杂活便宜、难事强模型）
- [ ] 默认低推理强度 + `textVerbosity: low`，难题用 `ctrl+t` 临时升档
- [ ] 对支持的 Provider 开启 `setCacheKey`
- [ ] `default_agent: "plan"`，坚持 Plan→Build 工作流
- [ ] 给 Agent 设合理 `steps` 上限
- [ ] 检索/调研走只读子代理 `@explore` / `@scout`
- [ ] 只启用必需的 MCP，其余 `enabled: false` 或权限 `deny`
- [ ] 用 `@文件` 精准喂上下文，`AGENTS.md` 用懒加载、长流程用 Skill
- [ ] 一个任务一个会话，里程碑后 `/compact` 或 `/new`
- [ ] 不用的工具（如 `websearch`）按需 `deny`
- [ ] 大仓库按需配置 `watcher.ignore`，必要时关 `snapshot`
- [ ] 定期 `opencode stats` 复盘，数据驱动持续优化
- [ ] 杂活尽量用本地模型 / 免费模型

---

## 9.7 小结

省 Token 的本质是**管理上下文、分层用模、消除浪费**三件事。OpenCode 把这三件事都做成了显式配置：`compaction`/`prune`、`small_model`/变体/推理强度、`plan` 默认 + `steps` + 只读子代理 + MCP 克制。把第九章的清单逐条落到你的 `opencode.json` 里，你就拥有了一套「又快又省」的最优化配置。下一章给出可直接套用的完整配置模板，并讲解最佳实践与排障。

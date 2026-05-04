# 第六章：类别（Category）与技能（Skill）系统

oh-my-openagent（OmO）做对的一件事，是把"挑模型"和"装领域知识"分开。前者是 **Category**（类别）——它回答"这是什么种类的活儿？"；后者是 **Skill**（技能）——它回答"这件事需要什么专业知识和工具？"。两者组合起来，能在不到一秒内把一个普通子 Agent 装备成"前端工程师 + 浏览器测试员 + Git 提交艺术家"。

本章把 Category 与 Skill 系统讲透：8 个内置类别、7 个内置技能、自定义方式、组合策略、最佳实践。

---

## 6.1 为什么是 Category，而不是直接选模型

直接让 Agent 在调用时写 `model: "gpt-5.4"` 有两个致命问题：

1. **认知偏差**：模型知道自己被叫做 "GPT-5.4"，会按它对自己的认知去回答，反而把限制强化；而 Category（"ultrabrain"、"deep"、"quick"）是描述意图的词，模型会更自然地把自己当成"被叫来做这种工作的专家"。
2. **维护噩梦**：明天 GPT-5.5 出来了，全代码库改 `gpt-5.4` 字符串？运行时哪个 Agent 哪个变体落到哪个 fallback？类别让这一切**和模型解耦**。

OmO 把这一层抽象写在了源码 `src/tools/delegate-task/constants.ts` 里。

---

## 6.2 8 个内置 Category

| Category | 默认配置 | 运行时回退顺序 | 适用 |
| --- | --- | --- | --- |
| `visual-engineering` | `google/gemini-3.1-pro` (high) | gemini-3.1-pro → glm-5 → claude-opus-4-7 → glm-5 → k2p5 | 前端、UI/UX、设计、样式、动画 |
| `ultrabrain` | `openai/gpt-5.4` (xhigh) | gpt-5.4 → gemini-3.1-pro → claude-opus-4-7 → glm-5 | 复杂硬核逻辑、架构决策 |
| `deep` | `openai/gpt-5.4` (medium) | gpt-5.4 → claude-opus-4-7 → gemini-3.1-pro | 目标导向自主问题求解 |
| `artistry` | `google/gemini-3.1-pro` (high) | gemini-3.1-pro → claude-opus-4-7 → gpt-5.4 | 创意 / 艺术性强、追求新颖 |
| `quick` | `openai/gpt-5.4-mini` | gpt-5.4-mini → claude-haiku-4-5 → gemini-3-flash → minimax-m2.7 → gpt-5-nano | 改字、单文件、小修改 |
| `unspecified-low` | `anthropic/claude-sonnet-4-6` | claude-sonnet-4-6 → gpt-5.3-codex → kimi-k2.5 → gemini-3-flash → minimax-m2.7 | 不属于其他类别、低投入 |
| `unspecified-high` | `anthropic/claude-opus-4-7` (max) | claude-opus-4-7 → gpt-5.4 → glm-5 → k2p5 → kimi-k2.5 | 不属于其他类别、高投入 |
| `writing` | `kimi-for-coding/k2p5` 或 `google/gemini-3-flash` | gemini-3-flash → kimi-k2.5 → claude-sonnet-4-6 → minimax-m2.7 | 文档、技术写作 |

### 6.2.1 调用方式

通过 `task` 工具的 `category` 参数：

```typescript
task({
  category: "visual-engineering",
  prompt: "为 dashboard 页面加一个响应式图表组件"
});
```

OmO 会自动启动一个 Sisyphus-Junior，配上对应的模型 + fallback 链 + 默认参数，然后跑你给的 prompt。

### 6.2.2 设计原则

- **频谱化**：从 quick / unspecified-low（极便宜） 到 unspecified-high（极贵）；
- **风格化**：visual-engineering 偏 Gemini；ultrabrain / deep 偏 GPT-5.4；artistry 偏 Gemini；writing 偏 Kimi / Gemini Flash；
- **类别即温度 / effort 偏好**：例如 ultrabrain 默认 xhigh，artistry 偏高温度。

---

## 6.3 自定义 Category

在你的 `oh-my-openagent.json` / `oh-my-opencode.json` 里直接 override 或新建。完整 schema：

| 字段 | 类型 | 描述 |
| --- | --- | --- |
| `description` | string | 类别描述，会显示在 task prompt 里 |
| `model` | string | 模型 ID（如 `anthropic/claude-opus-4-7`） |
| `variant` | string | 变体（`max`、`xhigh` 等） |
| `temperature` | number | 0.0~2.0 |
| `top_p` | number | 0.0~1.0 |
| `prompt_append` | string | 追加到系统提示词 |
| `thinking` | object | `{ type: "enabled", budgetTokens: 16000 }` |
| `reasoningEffort` | string | `low` / `medium` / `high` |
| `textVerbosity` | string | `low` / `medium` / `high` |
| `tools` | object | 禁用工具：`{ "tool_name": false }` |
| `maxTokens` | number | 最大响应 token |
| `is_unstable_agent` | boolean | 标记不稳定，强制后台执行以便监控 |

### 6.3.1 三个实用配置示例

```jsonc
{
  "categories": {
    // 1. 新建一个"中文技术作家"类别
    "korean-writer": {
      "model": "google/gemini-3-flash",
      "temperature": 0.5,
      "prompt_append": "你是一位中文技术作家，保持友好清晰的语气。"
    },

    // 2. 覆盖已有类别（把 visual-engineering 改成 GPT-5.4）
    "visual-engineering": {
      "model": "openai/gpt-5.4",
      "temperature": 0.8
    },

    // 3. 配置思考模型 + 限制工具
    "deep-reasoning": {
      "model": "anthropic/claude-opus-4-7",
      "thinking": { "type": "enabled", "budgetTokens": 32000 },
      "tools": { "websearch_web_search_exa": false }
    }
  }
}
```

### 6.3.2 Sisyphus-Junior 是它的执行人

记住：**所有 Category 都是通过 Sisyphus-Junior 执行的**。Junior 的核心限制：

- 不能再 `task()` / `call_omo_agent()`（避免无限委派）；
- 必须通过 `lsp_diagnostics` 验证才能完成；
- 不能改计划文件。

---

## 6.4 7 个内置 Skill

Skill 比 Category 更"模板化"：每个 Skill 是一个 SKILL.md 文件，包含：

- frontmatter：name / description / mcp 依赖；
- markdown 主体：被注入到 Agent 系统 prompt 里的"专业知识"。

OmO 内置：

| Skill | 触发关键词 | 描述 |
| --- | --- | --- |
| **git-master** | commit / rebase / squash / "who wrote" / "when was X added" | Git 专家，三专长：原子提交、Rebase 手术、历史考古 |
| **playwright** | 浏览器任务、测试、截图 | 通过 Playwright MCP 浏览器自动化（默认） |
| **agent-browser** | 浏览器任务（agent-browser CLI） | Vercel agent-browser CLI，覆盖导航、快照、截图、网络监听、脚本交互 |
| **dev-browser** | 状态化的浏览器脚本 | 持久页面状态，迭代式工作流和带身份的会话 |
| **frontend-ui-ux** | UI/UX、样式 | 设计师转开发者人格，强调审美方向、特别字体、和谐配色 |
| **review-work** | "review work" / "QA my work" | 落地后审查协调器，并行启动 5 个后台子 Agent：目标验证、代码质量、安全、人工 QA、上下文挖掘 |
| **ai-slop-remover** | "remove AI slop" / "de-AI" / "humanize" | 在保留功能的前提下剔除 AI 痕迹：冗长注释、过度错误处理、过度抽象、AI 套话 |

### 6.4.1 git-master 核心法则

git-master 是 OmO 体验里最显眼的 Skill 之一。三条核心原则：

**多次提交是默认行为**：

```
3+ 个文件 → 必须 ≥ 2 次提交
5+ 个文件 → 必须 ≥ 3 次提交
10+ 个文件 → 必须 ≥ 5 次提交
```

**自动检测风格**：

- 分析最近 30 个 commit，判断语言（中/英文）和风格（语义化 / 普通 / 简短）；
- 自动匹配你这个仓库的提交习惯。

**用法**：

```
/git-master commit these changes
/git-master rebase onto main
/git-master who wrote this authentication code?
```

它会按你的仓库风格把"这个 PR 的 17 处改动"切成 5 个原子化提交，依赖关系正确，并且 Commit message 看起来像你自己写的。

### 6.4.2 frontend-ui-ux 设计哲学

这个 Skill 把"UI/UX"提升成一个完整的设计师人格：

- **设计流程**：Purpose → Tone → Constraints → Differentiation；
- **审美方向**：选一个极致——brutalist / maximalist / retro-futuristic / luxury / playful；
- **字体**：用有特色的字体，避开 Inter / Roboto / Arial；
- **配色**：和谐配色 + 锋利点缀，避免"紫白搭"AI slop；
- **动效**：高冲击错位呈现、滚动触发、出乎意料的 hover；
- **反模式**：通用字体、可预测布局、模板化设计。

### 6.4.3 浏览器自动化两选一

OmO 通过 `browser_automation_engine.provider` 切换：

**Playwright MCP（默认）**：

```yaml
mcp:
  playwright:
    command: npx
    args: ["@playwright/mcp@latest"]
```

```
/playwright Navigate to example.com and take a screenshot
```

**Agent Browser CLI（Vercel）**：

```json
{
  "browser_automation_engine": { "provider": "agent-browser" }
}
```

```bash
bun add -g agent-browser
```

```
Use agent-browser to navigate to example.com and extract the main heading
```

二者都能：导航 / 交互 / 截图 PDF / 表单 / 等待网络 / 抓内容。区别在于：Playwright MCP 是稳定标准；agent-browser 在 Vercel 生态下更灵活。

---

## 6.5 自定义 Skill：写一个 SKILL.md

把这个文件丢到 `.opencode/skills/my-skill/SKILL.md`：

```markdown
---
name: my-skill
description: My special custom skill
mcp:
  my-mcp:
    command: npx
    args: ["-y", "my-mcp-server"]
---

# My Skill Prompt

This content will be injected into the agent's system prompt.
...
```

OmO 在加载 Skill 时按以下优先级（高 → 低）扫描：

1. `.opencode/skills/*/SKILL.md`（项目 / OpenCode 原生）
2. `~/.config/opencode/skills/*/SKILL.md`（用户 / OpenCode 原生）
3. `.claude/skills/*/SKILL.md`（项目 / Claude Code 兼容）
4. `.agents/skills/*/SKILL.md`（项目 / Agents 约定）
5. `~/.agents/skills/*/SKILL.md`（用户 / Agents 约定）

**同名 Skill** 高优先级覆盖低优先级。如果你想关闭内置 Skill：

```jsonc
{ "disabled_skills": ["playwright"] }
```

---

## 6.6 Skill 内嵌 MCP 与 OAuth

Skill 的 frontmatter 可以声明自己的 MCP 服务，**只在该 Skill 被调用时启动，结束即销毁**——这是 OmO 控制上下文窗口的关键技术。

OAuth-protected Skill MCP（RFC 2.1 全合规）示例：

```yaml
---
description: My API skill
mcp:
  my-api:
    url: https://api.example.com/mcp
    oauth:
      clientId: ${CLIENT_ID}
      scopes: ["read", "write"]
---
```

OmO 自动处理：

- **自动发现**：先查 `/.well-known/oauth-protected-resource`（RFC 9728），不行回退 `/.well-known/oauth-authorization-server`（RFC 8414）；
- **动态客户端注册**：支持 RFC 7591（clientId 可选）；
- **PKCE**：所有流必须；
- **Resource Indicators**：根据 MCP URL 自动按 RFC 8707 生成；
- **Token 存储**：`~/.config/opencode/mcp-oauth.json`（chmod 0600）；
- **自动刷新**：401 自动刷新；403 + WWW-Authenticate 走 step-up authorization；
- **动态端口**：OAuth 回调用自动端口。

预先认证：

```bash
bunx oh-my-opencode mcp oauth login <server-name> --server-url https://api.example.com
```

---

## 6.7 Category + Skill：3 个王牌组合

### 6.7.1 The Designer：UI 实现专家

```
category: visual-engineering
load_skills: ["frontend-ui-ux", "playwright"]
```

效果：用 Gemini 3.1 Pro 写带美感的 UI，再用 Playwright 直接打开浏览器验证渲染效果——闭环。

### 6.7.2 The Architect：设计评审

```
category: ultrabrain
load_skills: []
```

效果：用 GPT-5.4 xhigh 推理做架构评审，纯思考、不做无关动作。

### 6.7.3 The Maintainer：快修 + 干净提交

```
category: quick
load_skills: ["git-master"]
```

效果：用 GPT-5.4 Mini 快速修小问题，git-master 自动按风格切成多个原子提交。

### 6.7.4 The Validator：QA 我的工作

`review-work` Skill 本身就是组合策略——它在被触发时一次性并行启动 5 个后台子 Agent：

- 目标验证 Agent：检查是否实现了原始需求；
- 代码质量 Agent：lint / 风格 / 复杂度；
- 安全 Agent：审查潜在漏洞；
- 人工 QA Agent：实际跑、点、验；
- 上下文挖掘 Agent：检查相关文件 / 测试是否被同步更新。

**5 个全 PASS 才算通过**。这是 OmO 区别于"AI 写完就吹自己写完了"的硬手段。

---

## 6.8 task 委派的 7 要素 prompt

任何时候你想给子 Agent 派任务，都建议照下面 7 个要素写——清晰具体的 prompt 是组合发挥的前提：

1. **TASK**：单一目标；
2. **EXPECTED OUTCOME**：交付物是什么；
3. **REQUIRED SKILLS**：要 `load_skills` 哪些；
4. **REQUIRED TOOLS**：必须用的工具白名单；
5. **MUST DO**：硬性要求；
6. **MUST NOT DO**：硬性禁止；
7. **CONTEXT**：相关文件路径、模式、参考资料。

**坏例子**：

> "Fix this"

**好例子**：

> **TASK**：修复 `LoginButton.tsx` 在移动端的布局崩坏。
> **CONTEXT**：`src/components/LoginButton.tsx`，使用 Tailwind CSS。
> **MUST DO**：在 `md:` 断点改 flex-direction。
> **MUST NOT DO**：不要改桌面端布局。
> **EXPECTED**：移动端按钮垂直排列。

---

## 6.9 Category-Skill 工作机制小结

```
Sisyphus / Atlas
   │
   │ task({category, load_skills, prompt})
   ▼
┌────────────────────────────┐
│ Sisyphus-Junior            │
│  ─ 按 category 选模型       │
│  ─ 按 load_skills 注入提示词│
│  ─ 启动 Skill 内嵌 MCP      │
│  ─ 按 7 要素 prompt 工作    │
└────────────────────────────┘
   │
   ▼
完成 → 验证 → 回收 → 销毁 Skill MCP
```

下一章我们把视角从"高层抽象"切回"工具实现层"，看 OmO 是怎么用 Hashline、LSP、AST-Grep、Tmux 把 Agent 变成有 IDE 级精度的开发者。

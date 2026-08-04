---
layout: default
title: 第八章：Skills 技能系统
---

{% raw %}

# 第八章：Skills 技能系统


> 本章全面解析 Pi 的技能系统：从 Skills 的概念与定位、加载优先级与目录结构、SKILL.md 格式规范，到创建完整 Skill 的实战示例、调用方式与配置，以及 Prompt Templates 提示模板和 Themes 主题系统。读完本章，你将能够为你的 Pi 构建、组织和管理一整套可复用的技能库，并通过主题系统定制你专属的终端编码环境。

## 8.1 Skills 概述

### 8.1.1 什么是 Skill

**Skill（技能）** 是 Pi 中一个核心的可扩展性单元。严格来说，一个 Skill 就是一个**遵循 Agent Skills 开放标准的自包含能力包**——它告诉 Agent **何时**使用该项技能，以及**如何**执行该项技能。每个 Skill 的核心载体是一个或多个 `SKILL.md` 文件，使用 Markdown 格式编写，包含 YAML frontmatter 元数据和 Markdown 正文。

Skill 被加载后，会被注入到 Agent 的系统提示词中，相当于你用结构化的方式教会 Agent 一项新的"能力"。这种能力可以是任何事情：

- 一段标准化的部署流程（"当前项目如何构建并推送到生产环境"）
- 一套数据库迁移的约定（"必须先生成迁移 SQL、再跑 pre-flight 检查、最后执行"）
- 一份代码审查清单（"审查 PR 时重点检查这 5 个安全维度"）
- 一个项目特定的编码规范（"本项目的错误处理必须使用 Result 模式"）
- 一个外部工具的调用说明（"何时以及如何使用 `gh` CLI 创建 PR"）

### 8.1.2 渐进式披露：按需加载，不占上下文

Skill 最核心的一个设计特征是**渐进式披露**（Progressive Disclosure）。在 Pi 启动时，Agent **只看到**每个 Skill 的**名称和一句话摘要**（来自 `SKILL.md` 的 frontmatter 中的 `description` 字段）。完整文档的正文内容并**不会**被注入系统提示词——直到 Agent 实际需要使用该 Skill 时才加载。

这一设计的动机与 Pi 的上下文工程哲学完全一致：**每一个进入模型上下文的 token 都必须有充分的理由**。如果你有 20 个 Skill，每个 Skill 正文 2000 字，把它们全部注入系统提示词将消耗约 40,000 token——这些 token 中超过 90% 在当前会话中永远不会被用到。渐进式披露确保了只有在 Agent 判断"我需要这个技能"时，才付出那一次性的 token 成本。

流程如下：

1. **启动时**：Pi 扫描所有 Skill 目录，收集每个 Skill 的 `name` 和 `description`。
2. **注入摘要**：所有 Skill 的名称和简短描述被追加到系统提示词中（通常是几句话的量）。
3. **按需触发**：Agent 在对话中识别出某项任务与某个 Skill 的描述匹配，通过调用内部机制加载该 Skill 的完整 `SKILL.md` 内容。
4. **上下文消耗**：加载后的 Skill 正文进入当前会话上下文，Agent 依据其中的指令执行任务。

这种模式与 MCP（Model Context Protocol）的"启动时全部加载"形成鲜明对比。Pi 刻意不内置 MCP 支持，一个核心原因就是 MCP Server 的工具定义开销过大——一个典型的 Playwright MCP Server 带 21 个工具，工具描述总计 13,700 tokens，但这些工具在大多数会话中根本不会被调用。Skill 的渐进式披露让 token 预算始终用于**真正需要的能力**。

### 8.1.3 与 Extensions 的区别

Skill 和 Extension 是 Pi 中两种核心的扩展机制，但它们解决的问题完全不同：

| 维度 | Skill | Extension |
|------|-------|-----------|
| **核心载体** | Markdown 文件（`SKILL.md`） | TypeScript/JavaScript 代码 |
| **解决的问题** | 教 Agent"何时做某事、怎么做"——补充**知识和流程** | 给 Pi **注册新工具、新命令、监听事件**——扩展**运行时的能力** |
| **注入方式** | 按需注入系统提示词（渐进式披露） | 在 Pi 启动时加载并运行 |
| **编写难度** | 低。写好 Markdown 即可，不懂代码也能创建 | 中高。需要 TypeScript 基础，理解 Pi 的 Extension API |
| **典型场景** | 编码规范、部署流程、代码审查清单、项目约定 | 自定义 LLM 工具、权限控制系统、Git checkpointing、MCP 适配器 |
| **跨平台** | 遵循 Agent Skills 开放标准，理论上可在其他支持该标准的 Agent 中复用 | 依赖 Pi 专有的 Extension API，不可跨平台移植 |

一句话总结：**Skill 告诉 Agent 做什么、怎么做；Extension 给 Agent 增加做事情的工具和手段**。两者互补，而非互斥。一个典型的 Pi 工作流中，你可能会同时使用多个 Skill（知识注入）和多个 Extension（能力注入）。

### 8.1.4 agentskills.io 标准

Pi 的 Skill 格式遵循 [agentskills.io](https://agentskills.io) 开放标准。这是一个由社区推动的、旨在让 Agent Skills 在不同 Agent 平台之间实现互操作的标准协议。遵循该标准意味着：

- 你的 Skill 可以在任何支持 agentskills.io 标准的 Agent 工具集中使用（不仅是 Pi）。
- 你可以直接从 agentskills.io 或 Pi Package 生态中安装社区贡献的 Skill，开箱即用。
- Skill 的结构是标准化的、可预测的——任何 Agent 都能按同一套规则解析和加载。

agentskills.io 标准定义了 `SKILL.md` 的核心结构（YAML frontmatter + Markdown 正文）、必需和可选字段、以及渐进式披露的语义。Pi 在此基础上增加了自己的加载机制（多层路径、CLI 参数、Pi Package 集成），但文件格式本身完全兼容标准。

## 8.2 Skill 的加载位置与优先级

Pi 在启动时从多个位置发现和加载 Skill。理解这些位置的优先级和加载顺序，对于组织你的技能库至关重要——尤其是在你有全局技能、项目技能、以及通过包安装的社区技能时。

### 8.2.1 加载位置总览

Pi 按以下位置查找 Skill（后面的会**追加**到前面的之后，同名的按后加载者为准）：

| 序号 | 位置 | 作用范围 | 典型用途 |
|------|------|----------|----------|
| 1 | **全局目录**：`~/.pi/agent/skills/` | 所有项目 | 你个人的通用技能（Git 工作流、通用代码审查、PR 创建等） |
| 2 | **全局备选目录**：`~/.agents/skills/` | 所有项目 | 与 agentskills.io 标准兼容的全局备选位置 |
| 3 | **全局 settings.json**：`~/.pi/agent/settings.json` 中的 `skills` 数组 | 所有项目 | JSON 显式声明的全局技能路径（可以是绝对路径或相对主目录的路径） |
| 4 | **项目目录**：`<项目根>/.pi/skills/` | 当前项目 | 项目特定的技能（部署流程、数据库迁移、项目编码规范） |
| 5 | **项目备选目录**：`<项目根>/.agents/skills/` | 当前项目 | 与 agentskills.io 标准兼容的项目级备选位置 |
| 6 | **项目 settings.json**：`<项目根>/.pi/settings.json` 中的 `skills` 数组 | 当前项目 | JSON 显式声明的项目技能路径 |
| 7 | **Pi Package**：通过 `pi install` 安装的包的 `skills/` 目录 | 按包启用 | 社区贡献的技能（需要先在 settings 中启用对应包） |
| 8 | **CLI 参数**：`pi --skill <path>` 或 `pi --skill-dir <dir>` | 当前会话 | 一次性的、临时的技能注入 |

### 8.2.2 全局目录详解

**`~/.pi/agent/skills/`**

这是 Pi 的**主全局技能目录**。你可以把通用技能放在这里，它们会在你所有的 Pi 会话中可用。目录结构如下：

```
~/.pi/agent/skills/
├── git-workflow/
│   └── SKILL.md
├── pr-review/
│   └── SKILL.md
├── deploy-check/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── verify-deploy.sh
│   └── references/
│       └── deploy-checklist.md
└── code-style/
    └── SKILL.md
```

**`~/.agents/skills/`**

这是 agentskills.io 标准定义的**备选全局位置**。如果你同时使用多个支持 Agent Skills 标准的工具（比如 OpenClaw、Hermes Agent 等），把技能放在 `~/.agents/skills/` 可以让它们在不同工具之间共享。Pi 会同时扫描两个目录，同名 Skill 以 `~/.pi/agent/skills/` 中的版本优先。

### 8.2.3 项目目录详解

**`<项目根>/.pi/skills/`**

这是 Pi 的**主项目级技能目录**。项目技能通常在 Git 仓库中版本化管理，随项目一起分发。团队成员克隆仓库后无需额外配置即可获得这些技能。

**`<项目根>/.agents/skills/`**

与全局的 `~/.agents/skills/` 相对应，这是 agentskills.io 标准定义的项目级备选位置。

> **项目根目录的查找规则：** Pi 从当前工作目录向上查找，直到找到一个 Git 仓库的根目录（即含有 `.git/` 的目录）。如果找不到 Git 根目录，则以当前工作目录作为"项目根"。`.` 开头的配置文件（如 `.pi/`、`.agents/`）按同样规则向上查找。

### 8.2.4 settings.json 中的 skills 数组

你可以在全局或项目 `settings.json` 中通过 `skills` 数组显式声明技能路径。这一机制提供了比目录扫描更精确的控制——你可以加载位于磁盘任意位置的 Skill、可以明确控制加载顺序、可以只加载某个目录中的特定 Skill。

全局 `~/.pi/agent/settings.json` 示例：

```json
{
  "skills": [
    "~/my-custom-skills/deploy-skill",
    "/opt/shared-skills/security-audit",
    "/home/user/.pi/agent/skills/git-workflow"
  ]
}
```

项目 `.pi/settings.json` 示例：

```json
{
  "skills": [
    "./docs/skills/db-migration",
    "./docs/skills/api-design"
  ]
}
```

> **路径解析规则：** 以 `~` 开头的路径展开为用户主目录。以 `/` 开头的是绝对路径。以 `./` 或 `../` 开头的是相对于配置文件所在目录的路径。裸名称（如 `"deploy-skill"`）相对于 Pi 的默认 Skills 目录（`~/.pi/agent/skills/`）。

### 8.2.5 Pi Package 中的 Skills

当通过 `pi install` 安装一个 Pi Package 时，如果该包包含 `skills/` 目录（或在 `package.json` 中通过 `pi.skills` 字段声明），这些 Skill 将被 Pi 发现。你需要通过 settings 中的 `enabledResources` 或 `extensions` 配置来启用包的技能。

```bash
# 安装一个包含 Skill 的社区包
pi install npm:@some-author/pi-deploy-workflow

# 在 settings.json 中启用该包的 Skills
```

```json
{
  "extensions": {
    "@some-author/pi-deploy-workflow": {
      "enabled": true,
      "resources": ["skills"]
    }
  }
}
```

### 8.2.6 CLI 参数：按需注入

Pi 的 CLI 提供了两个参数用于在启动时按需注入 Skill：

```bash
# 加载单个 Skill
pi --skill ~/my-temp-skill/special-task

# 加载整个目录中的所有 Skill
pi --skill-dir ~/my-temp-skill-set/
```

CLI 加载的 Skill 会**在以上所有位置之后**追加，且只对当前会话有效。这非常适合一些一次性的、实验性的、或者你还不想加入全局/项目配置的技能。

### 8.2.7 同名 Skill 的优先级

当多个位置存在同名的 Skill 时（以目录名称作为 Skill 名称），优先级遵循"越具体、越靠后加载者优先"的原则：

1. CLI 参数（最高优先级）
2. 项目级 settings.json 中的 skills 数组
3. 项目级 `.pi/skills/` 和 `.agents/skills/`
4. 全局 settings.json 中的 skills 数组
5. 全局 `~/.pi/agent/skills/` 和 `~/.agents/skills/`
6. Pi Package（最低优先级）

换句话说，如果你有一个名为 `deploy` 的全局通用部署技能，然后在外包项目中，它的 `.pi/skills/deploy/` 目录下也有一个同名技能，那么在此外包项目中启动 Pi 时，Agent 会使用项目级的 `deploy` 技能（因为它后加载，覆盖了全局版本）。

## 8.3 Skill 目录结构

### 8.3.1 标准目录布局

一个完整的 Skill 目录遵循以下结构：

```
my-skill/
├── SKILL.md              # 必需。Skill 的核心定义文件
├── scripts/              # 可选。辅助脚本（Shell/Python/Node.js 等）
│   ├── pre-check.sh
│   └── run-migration.py
└── references/           # 可选。按需加载的参考文档
    ├── api-spec.md
    ├── error-codes.md
    └── config-template.yaml
```

### 8.3.2 SKILL.md（必需）

`SKILL.md` 是每个 Skill 目录中**唯一必需**的文件。它包含两个部分：

1. **YAML frontmatter**（文件头部，由 `---` 包裹）：定义 Skill 的元数据。
2. **Markdown 正文**：Agent 加载此 Skill 后会阅读的指令内容。

### 8.3.3 scripts/ 目录（可选）

`scripts/` 目录存放与 Skill 配套的辅助脚本。Agent 可以在执行该 Skill 时通过 `bash` 工具调用这些脚本。脚本可以用任何语言编写——Shell、Python、Node.js——只要 Agent 的运行环境能执行它们。

这里的脚本通常是一些**标准化、可重复的操作流程**，比如：

- 部署前的环境检查脚本（`pre-check.sh`）
- 数据库迁移执行脚本（`run-migration.py`）
- 测试覆盖率报告生成脚本（`coverage-report.sh`）

Skill 正文中应当包含对这些脚本的**使用说明**——何时调用、如何调用、需要什么参数、预期输出是什么。

### 8.3.4 references/ 目录（可选）

`references/` 目录存放**按需加载的参考文档**。与 SKILL.md 正文不同，`references/` 中的文件不会在 Skill 被触发时自动全部注入。相反，Skill 正文中会指示 Agent：当你需要某个具体信息时，去读取 `references/` 中的对应文件。

这进一步实现了**分层渐进式披露**：

- 第一层：Skill 名称和描述（启动时注入，极低成本）
- 第二层：Skill 正文 SKILL.md（被触发时注入，中等成本）
- 第三层：`references/` 中的具体文档（Agent 按需调用 `read` 工具加载，精确成本）

例如，一个 GitHub API 集成 Skill 的正文可能只有 800 字的核心流程说明，而 `references/api-spec.md` 存放了详细的 API 端点文档（5000 字）。Agent 只在实际需要调用特定 API 时才去读取这份参考文档。

## 8.4 SKILL.md 格式详解

### 8.4.1 完整结构

一个完整的 `SKILL.md` 文件结构如下：

```markdown
---
name: my-skill-name
description: 一句话描述这个 Skill 做什么、何时应该使用
license: MIT
compatibility: requires: bash git node>=20
allowed-tools: read write edit bash grep
disable-model-invocation: false
---

# Skill Name（可选标题）

## Setup

（如果需要前置设置步骤，在此描述）

## Usage

（核心指令：Agent 应该遵循的步骤、注意事项、验证方式）
```

### 8.4.2 YAML Frontmatter 字段详解

#### name（必填）

Skill 的唯一标识名称。用作 `/skill:name` 命令的参数，也用于同名 Skill 的去重和优先级判断。

**命名规则：**

- 只能使用小写字母、数字和连字符（`a-z`、`0-9`、`-`）
- 不能以连字符开头或结尾
- 长度不超过 64 个字符
- 推荐使用简洁、描述性的名称，如 `git-workflow`、`db-migration`、`pr-review`

```yaml
name: docker-deploy
```

如果 `name` 字段缺失，Pi 会使用 Skill 的**目录名**作为名称。如果你手动通过 `--skill` 加载了一个目录但 SKILL.md 中没有 `name` 字段，目录名就是它的名字。

#### description（必填）

一句话描述这个 Skill **做什么**和**何时应该使用**。这是渐进式披露的第一层——Agent 启动时只会看到这行描述，因此必须足够精确，让 Agent 能够**正确判断**当前任务是否需要加载此 Skill。

**好的 description 示例：**

```yaml
description: 当用户要求将当前项目部署到生产环境时使用。包含构建 Docker 镜像、推送到 ECR、更新 ECS 服务的完整流程。
```

```yaml
description: 当用户要求对 PR 或代码变更进行安全审查时使用。检查硬编码密钥、SQL 注入、XSS、路径遍历、不安全的反序列化等 5 大安全维度。
```

**不好的 description 示例：**

```yaml
description: 帮助部署。  # 太模糊，Agent 不知道何时该用它
```

```yaml
description: 这是一个代码审查技能。  # 什么样的审查？什么场景？
```

一个实用原则：你的 description 应该能够**排除**大部分不适用的情况。如果 Agent 拿到一个"重构代码"的请求，而你的 `deploy-skill` 的 description 是"帮助部署"，Agent 可能无法判断该不该加载。但如果 description 是"当用户要求将当前项目部署到生产环境时使用"，Agent 就能很清楚地判断：这不是部署请求，不需要加载。

#### license（可选）

Skill 的许可证标识。使用 [SPDX 标识符](https://spdx.org/licenses/)。

```yaml
license: MIT
```

这个字段对于团队共享和社区分发 Skill 尤为重要——你应该标明 Skill 的许可证，让他人知道他们可以如何使用、修改和分发你的 Skill。

#### compatibility（可选）

声明 Skill 的运行环境要求。格式为自由文本，但推荐使用以下约定：

```yaml
compatibility: requires: docker git node>=22
```

```yaml
compatibility: requires: python>=3.10 psql  # 需要 python 3.10+ 和 psql 命令
```

Agent 在加载 Skill 后会检查这些依赖是否满足（通过 `bash` 工具执行对应的版本检查命令）。如果某个依赖缺失，Agent 可以提前告知用户，而不是在执行到一半时才发现。

#### allowed-tools（可选，实验性）

限制此 Skill 在执行过程中**只能使用哪些 Pi 工具**。如果设置了此字段，Agent 在执行该 Skill 时将**无法调用未列出的工具**。

```yaml
allowed-tools: read write edit bash grep
```

> **实验性说明：** 此字段目前仍在实验阶段，行为和语义可能在未来版本中变化。它的设计意图是提供一种 Skill 级别的权限控制——比如你写了一个"代码审查" Skill，它只需要 `read` 和 `grep`，你通过 `allowed-tools: read grep` 确保它不会意外修改文件。

#### disable-model-invocation（可选）

如果设为 `true`，此 Skill **不会**被 Agent 自动匹配和加载——只能通过 `/skill:name` 命令手动唤起。

```yaml
disable-model-invocation: true
```

这个字段适用于那些副作用很大、你希望完全由**用户决定何时执行**的 Skill。例如，一个"删除生产数据库"的 Skill——你肯定不希望 Agent 因为误判而自动执行它。

### 8.4.3 Markdown 正文结构

YAML frontmatter 之后是 Markdown 正文——这是 Agent 加载 Skill 后实际阅读的指令内容。没有强制的格式要求，但社区实践已经形成了推荐的两段式结构：

#### Setup 段（可选）

描述 Agent 在执行此 Skill **之前**需要做的准备工作和前置检查。例如：

```markdown
## Setup

1. 检查当前是否在 Git 仓库根目录（执行 `git rev-parse --show-toplevel`）。
2. 确认 `package.json` 中的版本号已更新。
3. 确认 `.env.production` 文件存在且包含必要的环境变量。
4. 检查 Docker daemon 是否在运行。
```

Setup 段的作用是**防止 Agent 在条件不满足时盲目执行**。把"检查前置条件"写在这里，Agent 会先验证再动手。

#### Usage 段（必填）

描述 Agent 在执行此 Skill 时**应该遵循的核心步骤**。这是 Skill 正文的主体部分。一个好的 Usage 段应该：

- **步骤明确、可执行**：每一步都是一个 Agent 可以独立完成的操作（读取文件、执行命令、修改代码）。
- **包含验证**：关键步骤之后应有验证方法（"执行 `npm test`，确保全部通过"）。
- **含常见问题和陷阱**：如果某个步骤有已知的容易出错的地方，应该在这里提醒 Agent。
- **含示例**：如果某种操作的格式容易搞错，给出正确示例。

```markdown
## Usage

### 1. 构建阶段

```bash
npm run build:prod
```

验证：确认 `dist/` 目录生成，且 `dist/index.html` 存在。

### 2. Docker 镜像构建与推送

```bash
docker build -t myapp:${VERSION} .
docker tag myapp:${VERSION} registry.example.com/myapp:${VERSION}
docker push registry.example.com/myapp:${VERSION}
```

常见问题：如果推送失败，先执行 `docker login registry.example.com`。

### 3. 更新 Kubernetes Deployment

使用 `kubectl set image` 更新镜像：

```bash
kubectl set image deployment/myapp myapp=registry.example.com/myapp:${VERSION} -n production
```

验证：等待滚动更新完成：

```bash
kubectl rollout status deployment/myapp -n production
```

### 4. 部署后验证

1. 访问健康检查端点：`curl https://api.example.com/health`
2. 确认响应状态码为 200。
3. 检查最近 5 分钟的日志，确保没有 ERROR 级别日志：
   ```bash
   kubectl logs -l app=myapp -n production --since=5m | grep ERROR
   ```
```

> **编写 Skill 正文的黄金法则：** 把自己放到 Agent 的角度——如果你是一个只拥有 `read`、`write`、`edit`、`bash` 四个工具的编码 Agent，你需要什么样的指令才能准确、安全地完成当前任务？Skill 正文就是你写给 Agent 的"操作手册"。宁可多写一步、多写一个验证，也不要留下模棱两可的余地。

## 8.5 创建 Skill 的完整示例

下面通过三个实战示例，展示如何从零开始编写完整的 Skill。每个示例都包含一个真实的场景、完整的 `SKILL.md` 内容，以及配套的目录结构。

### 8.5.1 示例 1：部署脚本 Skill

**场景：** 你维护一个 Next.js 全栈项目，部署到 Kubernetes 集群。每次部署都需要经过：运行测试、构建 Docker 镜像、推送到镜像仓库、更新 Deployment、等待滚动更新完成、验证健康检查。你希望在项目中沉淀一个 `deploy` Skill，确保每次部署都遵循同一套流程。

**目录结构：**

```
.pi/skills/deploy/
├── SKILL.md
├── scripts/
│   └── verify-deploy.sh
└── references/
    └── rollback-guide.md
```

**scripts/verify-deploy.sh：**

```bash
#!/bin/bash
# 部署后验证脚本：检查生产环境健康状态

ENDPOINT="${1:-https://api.example.com/health}"
MAX_RETRIES=10
RETRY_INTERVAL=3

for i in $(seq 1 $MAX_RETRIES); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT")
  if [ "$STATUS" = "200" ]; then
    echo "✅ Health check passed (HTTP $STATUS)"
    exit 0
  fi
  echo "⏳ Attempt $i/$MAX_RETRIES: HTTP $STATUS, retrying in ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

echo "❌ Health check failed after $MAX_RETRIES attempts"
exit 1
```

**references/rollback-guide.md（摘要）：**

```markdown
# 回滚操作指南

## 快速回滚到上一个版本

kubectl rollout undo deployment/myapp -n production

## 回滚到指定版本

kubectl rollout history deployment/myapp -n production
kubectl rollout undo deployment/myapp --to-revision=<REVISION> -n production
```

**SKILL.md：**

```markdown
---
name: deploy
description: 当用户要求部署项目到生产环境（Kubernetes）时使用。包含运行测试、构建 Docker 镜像、推送镜像仓库、更新 Deployment 和部署后验证的完整流程。
license: MIT
compatibility: requires: docker kubectl node>=22 npm
---

# 项目部署技能

## Setup

执行部署前，依次完成以下检查：

1. **确认工作目录：** 在项目根目录执行，用 `pwd` 确认。
2. **Git 状态检查：** `git status --porcelain` 应无输出（无未提交的变更）。如果用户明确要求忽略变更部署，此检查可跳过。
3. **当前分支确认：** `git branch --show-current` 应为 `main` 或用户指定的发布分支。
4. **环境变量检查：** 确认 `version=${NEW_VERSION}` 已经可用（由用户提供或从 `package.json` 读取）。如果是用户指定的版本号，必须和用户再次确认版本号是否正确。
5. **权限检查：** `kubectl auth can-i update deployments -n production` 应返回 `yes`。

## Usage

### 第 1 步：运行测试套件

```bash
npm test
```

如果任何测试失败，**中止部署**，向用户报告失败原因。不要跳过测试继续部署。

### 第 2 步：构建项目

```bash
npm run build
```

验证：确认 `.next/` 或 `dist/` 目录已生成。

### 第 3 步：构建 Docker 镜像

```bash
docker build -t registry.example.com/myapp:${version} .
```

验证：`docker images registry.example.com/myapp:${version}` 应显示镜像信息。

### 第 4 步：推送镜像到仓库

```bash
docker push registry.example.com/myapp:${version}
```

如果推送失败（如认证过期），执行 `docker login registry.example.com` 后重试。

### 第 5 步：更新 Kubernetes Deployment

```bash
kubectl set image deployment/myapp myapp=registry.example.com/myapp:${version} -n production
```

### 第 6 步：等待滚动更新完成

```bash
kubectl rollout status deployment/myapp -n production --timeout=300s
```

如果超时，检查 Pod 状态：

```bash
kubectl get pods -l app=myapp -n production
kubectl describe pod <failing-pod> -n production
```

### 第 7 步：部署后验证

运行验证脚本：

```bash
bash .pi/skills/deploy/scripts/verify-deploy.sh
```

预期输出：`✅ Health check passed (HTTP 200)`

### 第 8 步：记录部署信息

向用户报告以下信息：
- 部署的版本号
- 镜像完整路径
- 滚动更新耗时
- 健康检查结果

### 常见问题

- **镜像构建失败：** 检查 `Dockerfile` 是否存在、`npm run build` 是否已执行、网络是否可达。
- **推送权限问题：** 确认已登录镜像仓库（`docker login`）。
- **Pod 一直 CrashLoopBackOff：** 读取 `references/rollback-guide.md`，执行回滚。
- **需要回滚：** 参考 `references/rollback-guide.md` 中的回滚指南。
```

### 8.5.2 示例 2：数据库迁移 Skill

**场景：** 你的团队使用 TypeORM 管理数据库迁移。每次需要新增迁移时，必须先生成迁移 SQL 文件、手工检查生成的 SQL 是否正确（尤其是 `DROP` / `ALTER` 等危险操作）、然后在本地测试环境先跑一遍、最后提交迁移文件。你希望通过一个 `db-migration` Skill 来规范化这个流程，减少误操作。

**目录结构：**

```
.pi/skills/db-migration/
├── SKILL.md
└── references/
    └── safety-rules.md
```

**references/safety-rules.md（摘要）：**

```markdown
# 数据库迁移安全规则

## 绝对禁止的操作（迁移 SQL 中）

- DROP DATABASE
- DROP TABLE（除非用户明确要求）
- TRUNCATE TABLE
- 不带 WHERE 子句的 DELETE

## 需要手工确认的操作

- ALTER TABLE ... DROP COLUMN —— 确认该列已无代码引用
- ALTER TABLE ... MODIFY —— 检查是否会截断数据
- ADD FOREIGN KEY —— 确认被引用的表和数据已存在

## 迁移文件命名规范

{timestamp}-{descriptive-name}.ts
例如：1719820800000-add-user-avatar-column.ts
```

**SKILL.md：**

```markdown
---
name: db-migration
description: 当用户需要为项目创建、运行或回滚 TypeORM 数据库迁移时使用。涵盖生成迁移文件、审查迁移 SQL、本地测试和提交的完整工作流。
license: MIT
compatibility: requires: node>=22 npm typeorm
allowed-tools: read write edit bash grep
---

# 数据库迁移技能

## Setup

1. **确认环境：** 确认本地有可用的测试数据库实例。通过读取项目配置（如 `.env.test` 或 `ormconfig.ts`）获取数据库连接信息。
2. **确认 ORM 配置：** 读取项目根目录的 `ormconfig.ts` 或 `data-source.ts`，理解迁移文件的存放路径和命名规则。
3. **确认 CLI 可用：** 执行 `npx typeorm --version` 验证 TypeORM CLI 已安装。

## Usage

### 场景 A：创建新的迁移

#### A.1 了解变更内容

先和用户确认：需要迁移哪些 Schema 变更（新增列、修改列类型、新增表、新增索引等）。如果用户提供了 Entity 文件的变更，读取相关的 Entity 文件理解变更内容。

#### A.2 生成迁移文件

```bash
npm run migration:generate -- src/migrations/<MigrationName>
```

或等效命令（以项目的 `package.json` scripts 中的实际命令为准）。

#### A.3 审查生成的迁移 SQL

读取生成的迁移文件，**逐条检查**每条 SQL 语句。对照 `references/safety-rules.md` 中的规则：

- 是否包含任何禁止的操作（DROP DATABASE、DROP TABLE、TRUNCATE 等）？
- 是否包含需要手工确认的操作（DROP COLUMN、MODIFY、ADD FOREIGN KEY）？如果有，**必须**向用户确认后再继续。
- 迁移的 `up` 和 `down` 方法是否成对、正确？

#### A.4 在测试环境运行迁移

```bash
npm run migration:run -- --dataSource=test
```

验证：执行后检查测试数据库的 Schema 是否与 Entity 定义一致。

#### A.5 提交迁移文件

确认以上步骤均成功后，告知用户迁移文件已准备好，可以提交。**不要**自动提交——Git 提交操作由用户决定。

### 场景 B：运行已有的迁移

```bash
npm run migration:run
```

在执行前：
1. 确认当前数据库的迁移状态：`npm run migration:show`
2. 确认待执行的迁移列表中没有意外的迁移。

### 场景 C：回滚上一次迁移

```bash
npm run migration:revert
```

在执行前：
1. **警告用户：** 回滚可能导致数据丢失（如果迁移包含 DROP COLUMN 等操作）。
2. 确认当前是哪个迁移将被回滚：`npm run migration:show`
3. 询问用户是否确实需要回滚。

### 常见问题

- **迁移生成器没有检测到变更：** 确认 Entity 文件已正确修改，且 `ormconfig.ts` 中 `migrations` 路径配置正确。
- **迁移执行失败（如列已存在）：** 检查是否有部分迁移已执行。使用 `npm run migration:show` 查看已执行迁移列表。
- **测试数据库不可用：** 读取 `.env.test` 检查数据库连接配置，必要时协助启动本地测试数据库。
```

### 8.5.3 示例 3：代码审查 Skill

**场景：** 你希望 Pi 能够对你的 PR（Pull Request）进行自动化的代码审查，检查 5 个安全维度：硬编码密钥、SQL 注入、XSS、路径遍历、不安全的反序列化。另外还需要检查代码风格是否与项目一致、是否有明显的逻辑错误。你创建一个 `pr-review` Skill，并设置为 `disable-model-invocation: true`（确保只有在你主动唤起时才会执行审查）。

**目录结构：**

```
.pi/skills/pr-review/
├── SKILL.md
├── references/
│   ├── security-checklist.md
│   └── style-guide.md
└── scripts/
    └── diff-analyzer.sh
```

**scripts/diff-analyzer.sh：**

```bash
#!/bin/bash
# 分析 PR 的文件变更统计

DIFF_FILE="${1:-/dev/stdin}"

echo "=== 文件变更统计 ==="
echo ""
echo "新增文件："
grep -c '^new file mode' "$DIFF_FILE" 2>/dev/null || echo "0"

echo "删除文件："
grep -c '^deleted file mode' "$DIFF_FILE" 2>/dev/null || echo "0"

echo "修改文件："
grep -c '^--- a/' "$DIFF_FILE" 2>/dev/null || echo "0"

echo ""
echo "变更行数："
grep -c '^+[^+]' "$DIFF_FILE" 2>/dev/null || echo "0"  # 新增行（排除 +++）
echo "移除行数："
grep -c '^-[^-]' "$DIFF_FILE" 2>/dev/null || echo "0"  # 删除行（排除 ---）
```

**references/security-checklist.md（摘要）：**

```markdown
# 安全审查清单

## 1. 硬编码密钥（Hardcoded Secrets）

搜索以下模式：
- `password = "..."` 、`secret = "..."`、`apiKey = "..."`、`api_key = "..."`、
- `token = "..."`、`private_key = "..."`、`access_key = "..."`、
- `-----BEGIN RSA PRIVATE KEY-----`
- AWS Access Key 模式（`AKIA...`）

如果发现硬编码密钥，标记为 **CRITICAL**。

## 2. SQL 注入（SQL Injection）

检查以下模式：
- 字符串拼接构造 SQL：`query = "SELECT * FROM " + tableName`
- 模板字面量构造 SQL：`query = \`SELECT * FROM ${table}\``
- 未使用参数化查询的原始 SQL 执行。

## 3. XSS（跨站脚本）

检查以下模式：
- `innerHTML =`、`dangerouslySetInnerHTML`
- `document.write(...)`
- 未转义的用户输入渲染。

## 4. 路径遍历（Path Traversal）

检查以下模式：
- 从用户输入拼接文件路径：`fs.readFile(userInput + "/data.txt")`
- 未使用 `path.resolve()` 或 `path.normalize()` 清理路径。

## 5. 不安全的反序列化

检查以下模式：
- `eval(...)`、`new Function(...)`
- Node.js 中未验证输入即调用的 `JSON.parse()`（实际漏洞较少）
- Python 中的 `pickle.loads()`、`yaml.load()`（非 `safe_load`）
```

**SKILL.md：**

```markdown
---
name: pr-review
description: 当用户提供 PR 链接或 diff 内容，并要求进行审查时使用。检查安全漏洞（硬编码密钥、SQL 注入、XSS、路径遍历、不安全反序列化）、代码风格一致性和潜在逻辑错误。
license: MIT
disable-model-invocation: true
---

# 代码审查技能

> 此 Skill 设计为手动唤起模式（`disable-model-invocation: true`），而非自动触发。原因：代码审查是一项高价值、需要用户明确意图的任务。我们不希望 Agent 因为上下文中的"review"、"check"等模糊关键词而误触发审查流程。

## Setup

1. **获取变更内容：**
   - 如果用户提供了 GitHub PR 链接，使用 `gh pr diff <PR_NUMBER>` 获取 diff。
   - 如果用户提供了 diff 内容或 patch 文件路径，直接读取。
   - 如果用户说"审查当前变更"，执行 `git diff main...HEAD`（或用户指定的基准分支）。

2. **统计变更范围：**
   运行 `bash .pi/skills/pr-review/scripts/diff-analyzer.sh <diff_file>` 获取变更统计。向用户报告变更范围。

3. **加载审查清单：**
   读取 `references/security-checklist.md` 和 `references/style-guide.md`，将审查规则加载到当前上下文。

## Usage

按以下顺序进行审查：

### 第一轮：安全审查（优先级最高）

对每个修改的文件，按 `references/security-checklist.md` 中的 5 个维度逐一检查。

**报告格式：**

```
### 安全审查结果

**CRITICAL（必须修复）：**
- 文件：src/config/database.ts:42
  问题：硬编码数据库密码 `const password = "admin123"`
  建议：改用环境变量 `process.env.DB_PASSWORD`

**WARNING（建议修复）：**
- 文件：src/routes/user.ts:156
  问题：SQL 查询使用字符串拼接
  代码：`db.query("SELECT * FROM users WHERE id = " + userId)`
  建议：改用参数化查询 `db.query("SELECT * FROM users WHERE id = ?", [userId])`

**PASS（未发现问题）：**
- src/utils/format.ts
- src/components/Header.tsx
```

### 第二轮：代码风格审查

对照 `references/style-guide.md` 中的项目规范，检查：
- 命名约定（变量、函数、文件）是否一致
- 缩进和格式是否与项目 `biome.json` / `eslint.config.js` 一致
- 是否有过大的函数（建议 > 50 行时提醒用户考虑拆分）
- 是否有未使用的 import 或变量

### 第三轮：逻辑审查

- 是否有明显的空指针/undefined 访问风险
- 数组索引是否检查越界
- Promise 是否有对应的 `.catch()` 或 `try/catch`
- 是否有死循环风险（`while(true)` 无 break 条件）
- 是否有竞态条件风险（异步操作顺序依赖）

### 第四轮：生成审查摘要

在上述三轮完成后，生成一份简洁的审查摘要：

```
### 审查摘要

- 变更范围：3 个文件，+42 / -15 行
- 安全审查：发现 1 个 CRITICAL 问题，2 个 WARNING
- 代码风格：2 处命名不一致
- 逻辑审查：未发现明显问题

整体评估：建议修复 1 个 CRITICAL 问题后合并。
```

### 注意事项

- **不要**在审查报告中评论"这段代码写得很好"之类的表扬性内容——只报告问题。
- 如果某个文件过大（> 500 行），分段审查并告知用户当前进度。
- 如果 diff 涉及 20 个以上文件，在开始前询问用户是否需要对所有文件审查，或只审查特定目录。
- 如果用户未提供 diff 或 PR 链接，先询问再执行——不要猜测审查范围。
```

## 8.6 Skill 的调用方式

### 8.6.1 手动唤起：`/skill:name` 命令

在 Pi 的交互式 TUI 中，你可以通过斜杠命令手动唤起一个 Skill：

```
/skill:deploy
```

输入后，Pi 会立即加载 `deploy` Skill 的完整 `SKILL.md` 内容到当前会话，Agent 会依据 Skill 指令来响应你后续的请求。

> **注意：** `disable-model-invocation: true` 的 Skill  **只能**通过 `/skill:name` 命令唤起，不会被自动匹配加载。这为你提供了对高风险 Skill（如部署、数据库回滚）的完全控制权。

### 8.6.2 自动匹配加载

对于没有设置 `disable-model-invocation: true` 的 Skill，Pi 会在启动时将它们的 `name` 和 `description` 注入到 Agent 的系统提示词中（渐进式披露的第一层）。Agent 在处理用户请求时，会根据当前任务与各 Skill 描述之间的匹配度，**自行判断**是否需要加载某个 Skill 的完整内容。

触发自动匹配的条件：

1. 用户的请求与该 Skill 的 `description` 描述的场景**明显相关**。
2. Agent 认为自己**缺乏**完成当前任务所需的具体指令或流程知识。
3. 当前上下文中尚未加载该 Skill（避免重复加载）。

**示例对话：**

```
用户：帮我把当前项目部署到生产环境。
Agent：（识别"部署"任务，匹配到 deploy Skill 的 description）
Agent：好的，我将按照 deploy 技能来执行部署流程。先进行前置检查……
（Agent 内部加载 deploy SKILL.md，遵循其指令执行部署）
```

如果你不希望某个 Skill 被自动匹配，只需在 SKILL.md 的 frontmatter 中设置 `disable-model-invocation: true`。

### 8.6.3 `enableSkillCommands` 配置

在 settings.json 中，可以通过 `enableSkillCommands` 字段控制是否允许 Skill 通过斜杠命令加载：

```json
{
  "enableSkillCommands": true
}
```

默认值为 `true`。如果设为 `false`，Pi 将**不会**注册任何 `/skill:name` 命令，但 Skills 仍然可以通过自动匹配加载（前提是没有设置 `disable-model-invocation: true`）。

这一选项适用于你只想通过自动匹配来触发 Skill，而不希望斜杠命令污染命令空间的场景。

## 8.7 Prompt Templates 提示模板

### 8.7.1 什么是 Prompt Template

**Prompt Template（提示模板）** 是一种简单的参数化提示文本片段。与 Skill（完整的操作指令）不同，Prompt Template 通常只是一段简短的、可参数化的提示语，用于快速向 Agent 传达一个标准化的意图或格式要求。

一个 Prompt Template 本质上就是一个 Markdown 文件，其中包含 `{{参数名}}` 占位符。当你在对话中通过斜杠命令调用它时，Pi 会将参数值填充到占位符中，然后将完整文本作为你的消息发送给 Agent。

### 8.7.2 Prompt Template 与 Skill 的区别

| 维度 | Skill | Prompt Template |
|------|-------|-----------------|
| **本质** | 给 Agent 的操作手册（何时做、怎么做） | 给 Agent 的格式化提示（"用这种格式回答"） |
| **内容量** | 通常较长（数百到数千字），包含多步骤指令 | 通常较短（几十到几百字），一段标准化提示 |
| **注入方式** | 按需注入系统提示词（Agent 阅读后执行） | 直接作为用户消息发送（参数替换后） |
| **是否可调用** | Agent 可自动匹配加载 | Agent 不能触发，只能由用户通过斜杠命令使用 |
| **参数化** | 不支持 | 支持 `{{参数}}` 占位符 |
| **典型场景** | 部署流程、代码审查、迁移工作流 | 生成 commit message、代码解释、翻译、格式化输出 |

### 8.7.3 Prompt Template 的加载位置

Prompt Template 文件从以下位置加载：

| 位置 | 作用范围 |
|------|----------|
| `~/.pi/agent/prompts/` | 全局 |
| `<项目根>/.pi/prompts/` | 当前项目 |
| Pi Package 的 `prompts/` 目录 | 按包启用 |

### 8.7.4 Prompt Template 的格式

Prompt Template 文件是一个纯 Markdown 文件，**不需要 YAML frontmatter**（与 SKILL.md 不同）。文件名（不含 `.md` 扩展名）即为其模板名称。

**示例：`~/.pi/agent/prompts/commit.md`**

```markdown
请为以下代码变更生成一条 Git commit message。

要求：
- 遵循 Conventional Commits 规范（格式：type(scope): description）
- 使用英文撰写
- 首行不超过 72 个字符
- 如果需要详细说明，在首行之后空一行，然后写 body 部分

{{#if language}}
语言：{{language}}
{{/if}}

{{#if context}}
额外上下文：{{context}}
{{/if}}

变更内容：
{{diff}}
```

### 8.7.5 Prompt Template 的使用方式

在 Pi 的 TUI 中，输入 `/` 后跟模板名称即可调用：

```
/commit language=中文 context=修复了登录页面的SQL注入漏洞 diff=git diff
```

Pi 会将参数填充到模板中，得到完整的提示文本，然后将其作为你的消息发送给 Agent。

如果你的模板**没有参数**（纯静态提示），直接输入 `/模板名` 即可立即发送。

### 8.7.6 示例：创建 Prompt Template

**场景：** 你经常需要让 Agent 解释一段代码的功能和潜在问题。你希望有一个标准化的 prompt 格式。

**文件：`~/.pi/agent/prompts/explain.md`**

```markdown
请为以下代码提供详细解释。用中文回复。

要求：
1. 先概述这段代码的整体功能（1-2 句话）。
2. 逐段解释关键逻辑。
3. 指出任何潜在的 bug、性能问题或安全隐患。
4. 如果代码中有不符合 {{language}} 最佳实践的地方，也请指出。

{{#if focus}}
重点关注：{{focus}}
{{/if}}

代码：
\`\`\`{{language}}
{{code}}
\`\`\`
```

**使用：**

```
/explain language=TypeScript focus=错误处理 code=await fetch('/api/data'); const data = await response.json();
```

### 8.7.7 Prompt Template 的高级用法：条件渲染

Prompt Template 支持简单的条件渲染语法（`{{#if 参数名}}...{{/if}}`）。如果某个参数未被提供，对应的块将被完全移除——这让你的模板在参数可选时保持简洁。

```markdown
请审查以下代码。

{{#if checklist}}
按照以下清单逐项检查：
{{checklist}}
{{/if}}

{{#if style_guide}}
本项目期望的代码风格：
{{style_guide}}
{{/if}}

变更：
{{diff}}
```

## 8.8 Themes 主题系统

### 8.8.1 内置主题

Pi 自带两个内置主题：

| 主题名 | 描述 |
|--------|------|
| `dark` | 深色主题（默认），适合深色背景的终端 |
| `light` | 浅色主题，适合浅色背景的终端（如白底 VS Code 终端） |

切换主题最简单的方式是在 Pi 的 TUI 中输入：

```
/theme dark
/theme light
```

或通过设置持久化：

```json
{
  "theme": "light"
}
```

### 8.8.2 自定义主题

Pi 的主题系统支持自定义主题文件（JSON 格式），通过 settings.json 中的 `theme` 字段指定路径即可加载。

**自定义主题文件的位置：**

| 位置 | 说明 |
|------|------|
| `~/.pi/agent/themes/` | 全局主题文件目录 |
| 任意路径 | 通过 `theme` 配置指向的具体路径 |

**主题文件的 JSON 结构：**

一个自定义主题文件定义了 Pi TUI 中各元素的颜色、样式和外观。以下是一个完整的主题文件示例：

```json
{
  "name": "dracula",
  "description": "基于 Dracula 配色方案的自定义 Pi 主题",
  "colors": {
    "background": "#282a36",
    "foreground": "#f8f8f2",
    "accent": "#bd93f9",
    "success": "#50fa7b",
    "warning": "#f1fa8c",
    "error": "#ff5555",
    "dimmed": "#6272a4",
    "highlight": "#44475a",
    "userMessage": "#8be9fd",
    "assistantMessage": "#f8f8f2",
    "toolCall": "#ffb86c",
    "toolResult": "#6272a4",
    "thinkingBackground": "#3a3d4a",
    "thinkingForeground": "#6272a4",
    "codeBackground": "#383a59",
    "codeForeground": "#f8f8f2",
    "diffAdded": "#50fa7b",
    "diffRemoved": "#ff5555",
    "diffHeader": "#bd93f9"
  },
  "ui": {
    "statusBarStyle": "default",
    "borderStyle": "single",
    "separatorStyle": "thin",
    "codeBlockBorder": true,
    "useBoldForHeadings": true,
    "useItalicForComments": true
  }
}
```

**颜色字段说明：**

| 字段 | 作用 |
|------|------|
| `background` | 主题背景色（TUI 的底色） |
| `foreground` | 默认文字颜色 |
| `accent` | 强调色（用于状态栏、选中元素、链接等交互元素） |
| `success` | 成功状态（如 `/checkpoint` 成功提示） |
| `warning` | 警告状态 |
| `error` | 错误状态（如模型返回错误、工具执行失败） |
| `dimmed` | 次要文字颜色（如时间戳、提示信息、折叠的工具输出） |
| `highlight` | 高亮背景色（如当前选中的树节点、消息高亮） |
| `userMessage` | 用户消息的文字颜色 |
| `assistantMessage` | Agent 响应消息的文字颜色 |
| `toolCall` | 工具调用信息的文字颜色 |
| `toolResult` | 工具返回结果的文字颜色 |
| `thinkingBackground` | 思考过程的背景色（thinking traces） |
| `thinkingForeground` | 思考过程的文字颜色 |
| `codeBackground` | 代码块的背景色 |
| `codeForeground` | 代码块的文字颜色 |
| `diffAdded` | diff 中新增行的颜色 |
| `diffRemoved` | diff 中删除行的颜色 |
| `diffHeader` | diff 头部（文件名、行号）的颜色 |

**UI 字段说明：**

| 字段 | 可选值 | 作用 |
|------|--------|------|
| `statusBarStyle` | `"default"`、`"minimal"` | 状态栏样式：`default` 显示所有信息（模型、状态、快捷键提示）；`minimal` 只显示模型名称 |
| `borderStyle` | `"single"`、`"double"`、`"none"` | 面板边界的线条样式 |
| `separatorStyle` | `"thin"`、`"thick"`、`"none"` | 消息之间的分隔符样式 |
| `codeBlockBorder` | `true` / `false` | 代码块是否绘制边框 |
| `useBoldForHeadings` | `true` / `false` | Markdown 标题是否加粗 |
| `useItalicForComments` | `true` / `false` | Markdown 注释/引用是否斜体 |

### 8.8.3 主题热重载

Pi 的主题系统支持**热重载**（Hot Reload）：修改主题文件后，无需重启 Pi——TUI 会**即时**反映变更。这极大地降低了"调试主题颜色"的成本——你可以在 IDE 中打开主题 JSON 文件，一边改颜色值一边在 Pi 的 TUI 中实时查看效果。

热重载的实现基于文件系统监控（`fs.watch`）：Pi 会持续监控当前激活的主题文件（以及通过 `theme` 配置项指定的任何自定义主题），当检测到文件变更时，重新解析 JSON 并生成新的样式配置。

> **提示：** 你可以通过 `/hotkeys` 查看当前主题的快捷键。通常情况下，Pi 提供了 `Ctrl+T` 快捷键用于快速切换浅色/深色主题。如果你加载了自定义主题，`Ctrl+T` 会在 `dark` → `light` → `<custom-theme-1>` → `<custom-theme-2>` 之间循环切换。

### 8.8.4 主题配置方式

主题可以通过以下任一方式配置（优先级从高到低）：

#### 方式 1：CLI 参数（单次会话）

```bash
pi --theme dracula
```

#### 方式 2：settings.json（持久化）

全局配置 `~/.pi/agent/settings.json`：

```json
{
  "theme": "dracula"
}
```

或项目配置 `./pi/settings.json`：

```json
{
  "theme": "~/my-themes/dracula.json"
}
```

#### 方式 3：交互式 /theme 命令

在 Pi 的 TUI 中直接输入 `/theme dracula`。

#### 方式 4：/hotkey 快捷键（快速切换）

`Ctrl+T`：在已配置的主题之间循环切换。

#### 主题路径解析规则

| 值 | 解析规则 |
|----|----------|
| `"dark"` / `"light"` | 内置主题 |
| `"dracula"` | 先在 `~/.pi/agent/themes/dracula.json` 中查找，如果未找到则在内置主题中查找 |
| `"./local-theme.json"` | 相对于 settings.json 所在目录的路径 |
| `"~/my-themes/custom.json"` | 展开为用户主目录 |
| `"/absolute/path/theme.json"` | 绝对路径 |

## 8.9 本章小结

本章我们全面解析了 Pi 的技能系统及相关扩展机制：

- **Skill 是什么：** 遵循 Agent Skills 开放标准（[agentskills.io](https://agentskills.io)）的自包含能力包，以 `SKILL.md` 为载体，通过 YAML frontmatter 定义元数据、Markdown 正文描述"何时做、怎么做"。核心特征是**渐进式披露**——启动时只加载名称和摘要，完整内容按需注入，精确控制上下文消耗。
- **Skill 与 Extension 的区别：** Skill 解决"知识/流程注入"，Extension 解决"能力/工具注入"。Skill 用 Markdown 编写（低门槛）、可跨平台复用；Extension 用 TypeScript 编写（高门槛）、绑定 Pi 专有 API。
- **加载位置与优先级：** Pi 从 8 类位置发现和加载 Skill（全局目录、项目目录、settings.json 数组、Pi Package、CLI 参数），按"越具体越优先"的原则覆盖同名 Skill。`~/.agents/skills/` 作为 agentskills.io 标准兼容的备选位置，允许在不同 Agent 工具间共享 Skill。
- **目录结构：** 每个 Skill 目录必须包含 `SKILL.md`，可选包含 `scripts/`（辅助脚本）和 `references/`（按需加载的参考文档），实现**分层渐进式披露**。
- **SKILL.md 格式：** 必填字段 `name` 和 `description`，可选字段 `license`、`compatibility`、`allowed-tools`（实验性）、`disable-model-invocation`。正文推荐 Setup/Usage 两段式结构，核心原则是"把自己放到 Agent 的角度，写清楚每一步操作和每一个验证"。
- **三个完整示例：** 部署 Skill（`deploy`，生产环境部署完整流程）、数据库迁移 Skill（`db-migration`，TypeORM 迁移的安全执行）、代码审查 Skill（`pr-review`，5 个安全维度 + 风格 + 逻辑三轮审查）。每个示例都包含完整的 `SKILL.md` 内容和配套的 `scripts/` / `references/` 文件。
- **Skill 的调用方式：** `/skill:name` 命令（手动唤起）、自动匹配加载（Agent 根据 description 自行判断）、`enableSkillCommands` 配置（控制斜杠命令的注册）。`disable-model-invocation: true` 确保高风险 Skill 只能手动唤起。
- **Prompt Templates：** 轻量级的参数化提示文本，通过 `{{参数}}` 占位符和 `{{#if}}` 条件渲染支持动态内容。与 Skill 的核心区别：Prompt Template 直接作为用户消息发送（而不注入系统提示词），由用户（而非 Agent 自我判断）触发。
- **Themes 主题系统：** 内置 `dark` 和 `light` 主题，支持自定义 JSON 主题文件（定义 20+ 颜色字段和 6 个 UI 样式字段）。支持热重载（改文件即刻生效），通过 CLI 参数、settings.json、`/theme` 命令或 `Ctrl+T` 快捷键快速切换。

下一章：[第九章：Extensions扩展开发](https://znlgis.github.io/ai/pi/08-Skills技能系统/09-Extensions扩展开发/) 将深入 Pi 的 **Extensions 扩展系统**——学习如何编写 TypeScript 扩展来注册自定义工具、监听生命周期事件、构建自定义 TUI 组件，真正将 Pi 改造成你专属的编码 Agent。

{% endraw %}
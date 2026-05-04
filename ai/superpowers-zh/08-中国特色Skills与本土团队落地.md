# 第八章：中国特色 Skills 与本土团队落地

## 8.1 为什么需要中国特色 Skills

英文上游 superpowers 解决的是通用 AI 编程工作流问题，但中文团队还有一些额外痛点：

- 代码审查要兼顾专业性和沟通文化。
- Git 平台可能是 Gitee、Coding、极狐 GitLab、CNB，而不是 GitHub。
- Commit Message 需要中文可读，同时兼容 Conventional Commits 工具链。
- 中文技术文档需要处理中英混排、标点、术语和机翻味。
- 国内团队常用企业微信、钉钉、禅道、TAPD、Coding 等协作系统。

superpowers-zh 新增的中国特色 Skills 正是为这些场景设计。

## 8.2 chinese-code-review：中文代码审查

这个 Skill 的核心原则是：用「建议」代替「命令」，用「提问」代替「否定」，但绝不因为面子放过 Bug。

推荐使用优先级标记：

- **[必须修复]**：安全漏洞、数据丢失、并发错误、逻辑错误。
- **[建议修改]**：性能问题、可维护性问题、缺少校验。
- **[仅供参考]**：命名、风格、替代方案。
- **[问题]**：不确定作者意图，需要解释。

示例：

```text
[必须修复] 并发安全问题

这里的 map 会在多个 goroutine 中同时读写，可能触发 panic。
建议加 sync.RWMutex，或改用 sync.Map。可以用 -race 跑测试复现。
```

这种表达既清楚说明严重性，又给出原因和建议。

## 8.3 中文审查中的表达平衡

需要避免两个极端：

### 过度客气

```text
不知道我理解得对不对，这里好像可能有一点点问题……
```

这种写法会让作者不知道是否必须修。

### 过度强硬

```text
这里写错了，必须改。
```

这种写法虽然直接，但容易引发防御心理。

推荐写法：

```text
[建议修改] 这里可能存在空值风险。
如果 user.Profile 为 nil，第 42 行会 panic。建议在进入分支前做空值判断，或在查询层保证 Profile 必填。
```

## 8.4 chinese-git-workflow：国内 Git 平台适配

该 Skill 对比了 Gitee、Coding.net、极狐 GitLab、CNB 和 GitHub，并给出不同团队规模适用的工作流。

### 主干开发

适合 2-8 人小团队、自动化测试完善、迭代快：

- main 始终可发布。
- 功能分支短命，1-2 天内合回。
- 用 Feature Flag 隐藏未完成功能。

### Git Flow

适合中大团队、固定发布节奏、需要多版本维护：

- main 代表生产环境。
- develop 代表开发主线。
- release 分支用于发布稳定。
- hotfix 从 main 拉出。

### 国内常用简化流程

适合多数中小团队：

- main 受保护，对应生产。
- dev 对应测试环境，自动部署。
- 功能分支从 dev 拉出，合回 dev。
- dev 测试通过后合并 main 发布。

## 8.5 分支命名规范

推荐：

```text
feat/user-login
feat/TAPD-12345-order-refund
fix/payment-callback
hotfix/v2.0.1
release/v2.1.0
dev/zhangsan/feat-login
```

规则：

1. 使用小写英文和短横线。
2. 前缀表示类型：`feat/`、`fix/`、`hotfix/`、`release/`。
3. 如有任务编号，放入分支名。
4. 名称能看出目的即可，不要过长。

## 8.6 chinese-commit-conventions：中文提交规范

该 Skill 基于 Conventional Commits 1.0.0，保留英文 type，scope 和 description 使用中文。

格式：

```text
<type>(<scope>): <subject>

<body>

<footer>
```

示例：

```text
feat(用户模块): 添加手机号一键登录功能

- 接入运营商一键登录 SDK
- 支持移动、联通、电信三网
- 登录失败自动降级到短信验证码

Closes #128
```

常用类型：

| type | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 |
| `style` | 格式，不影响逻辑 |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试 |
| `chore` | 工具、依赖、杂项 |
| `ci` | CI/CD |
| `revert` | 回滚 |

## 8.7 Commit Message 的落地工具

团队可以用 commitlint + husky 强制规范：

```bash
npm install -D @commitlint/cli @commitlint/config-conventional husky
```

关键配置思路：

- 允许中文 subject。
- 放宽 header 长度，因为中文宽度不同。
- 关闭 `subject-case`。
- 保留 type 枚举。
- body 用中文说明背景、方案和影响范围。

规范要靠工具，而不是靠每个人自觉。

## 8.8 chinese-documentation：中文技术文档规范

这个 Skill 解决中文技术文档最常见的问题：

- 中英文之间没有空格。
- 中文和数字之间没有空格。
- 全角半角标点混用。
- 技术术语过度翻译。
- 句子有机翻味。
- 一大段文字缺少结构。

核心规则：

```text
使用 Git 管理代码，配合 Jenkins 实现持续集成。
本次更新包含 3 个功能和 12 个 Bug 修复。
文件大小不超过 5 MB，CPU 使用率低于 80%。
```

中文语境使用全角标点，代码、命令和纯英文内容使用半角标点。

## 8.9 术语翻译原则

保留英文：

- 专有名词：React、Kubernetes、Redis、MySQL。
- 行业缩写：API、SDK、CLI、ORM、CI/CD。
- 命令和代码：`npm install`、`git commit`。
- 协议和标准：HTTP、JSON、REST。
- 没有公认中文翻译的术语：middleware、debounce、throttle。

翻译中文：

- 有公认翻译的概念：数据库、服务器、浏览器。
- 描述性短语：版本控制、负载均衡。
- 标题和章节名尽量中文，必要时保留英文术语。

首次出现可写中英对照：

```text
本系统使用消息队列（Message Queue）实现异步通信。
```

## 8.10 中文文档结构建议

好的中文技术文档应结构化：

```markdown
# 标题

## 背景

说明为什么需要这篇文档。

## 快速开始

给出最短可运行路径。

## 核心概念

解释读者必须理解的模型。

## 操作步骤

按步骤说明如何使用。

## 常见问题

列出错误、原因和解决方式。

## 检查清单

提供发布或交付前自查项。
```

不要用长段落堆叠所有信息。能用列表、表格、步骤和代码块表达的内容，应优先结构化。

## 8.11 团队落地顺序

推荐按以下顺序落地：

1. **文档规范先行。** 统一中英混排、标题、表格、API 文档格式。
2. **提交规范工具化。** 配置 commitlint、husky 或 PR 检查。
3. **代码审查分级。** 在团队约定中明确 [必须修复] 等标签。
4. **Git 流程标准化。** 根据平台选择 main/dev、Git Flow 或主干开发。
5. **AI 指令固化。** 在项目自定义指令中要求 AI 遵循这些 Skills。

## 8.12 本章小结

中国特色 Skills 不是把英文规则翻译成中文，而是把中文团队真实协作环境纳入 AI 编程流程。它们能让 superpowers-zh 从个人效率工具变成团队工程规范的一部分。

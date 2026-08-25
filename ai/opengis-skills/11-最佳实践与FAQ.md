---
layout: default
title: 第十一章：最佳实践与 FAQ
---

# 第十一章：最佳实践与 FAQ

本章汇集了使用 **opengis-skills** 过程中积累的全部最佳实践和常见问题解答。无论你是刚刚完成前几章的学习、已经把技能库集成到日常工作中，还是正在考虑如何让团队更规范地使用技能库，本章都能提供从"会用"到"用好"再到"持续优化"的完整行动指南。

> **阅读建议**：如果你是技能使用者，重点关注 11.1（加载策略）、11.2（项目集成）和 11.4（FAQ）；如果你是技能维护者或团队技术负责人，额外关注 11.3（版本管理）和 11.7（安全与隐私）。11.6 的 Token 优化技巧对所有人都有参考价值。

---

## 11.1 技能加载策略

技能加载策略决定了你在 AI 工具中能否以最小的成本获得最大的信息密度。一个糟糕的加载策略可能导致上下文过载、AI 注意力涣散、Token 浪费甚至生成质量下降；而一个好的策略则让你精准命中所需知识，让 AI 工具成为真正懂 GIS 的编码伙伴。

### 11.1.1 Token 预算管理

Token 是 AI 工具的核心资源，理解 opengis-skills 的 Token 消耗结构是制定高效加载策略的前提。

**技能文件的 Token 规模分级**

opengis-skills 的 67 个技能文件按规模和复杂度可分为三个等级：

| 等级 | 文件规模 | Token 估算 | 典型示例 | 加载建议 |
|------|----------|-----------|----------|----------|
| **小型** | 100-300 行 | 约 1.5K-4K tokens | cad/tongwen、ai/pi、3d/cesiumjs-api | 几乎无负担，可放心加载 |
| **中型** | 300-800 行 | 约 4K-12K tokens | gis/arcpy、cad/zwcad-lisp、ai/dify、csharp/arcgis-pro-sdk | 最常见的技能规模，1-2 个同时加载安全 |
| **大型** | 800-1500+ 行 | 约 12K-25K+ tokens | gis/gdal-api、gis/opengis-all、ai/opencode | 内容详实，建议单独加载或只加载需要的部分 |
| **L1 索引** | ~700 行 | 约 10K tokens | SKILL.md（根索引） | 标签搜索和浏览用，不建议长期占用上下文 |
| **L2 索引** | 50-150 行 | 约 0.8K-2.5K tokens | gis/SKILL.md、cad/SKILL.md、ai/SKILL.md | 理想的"导航层"，优先加载 |

**Token 消耗的典型场景分析**

以一个常见的 GIS 开发任务为例——"用 GDAL 的 Python API 将一批 GeoTIFF 重投影到 EPSG:3857 并转换为 COG 格式"：

*场景 A：不加载技能，直接提问*
- 输入 tokens：约 2K（任务描述 + 上下文）
- 输出 tokens：约 3K（AI 凭记忆生成代码）
- **风险**：AI 可能使用过时的 API、不存在的参数名、错误的变形方法——debug 过程会消耗更多 Token

*场景 B：加载 gdal-api 技能后提问*
- 技能 tokens：约 18K（一次性加载）
- 任务 tokens：约 2K
- 输出 tokens：约 4K（精准的、参数正确的代码）
- 总输入 tokens：约 20K
- **效果**：首次生成代码即大概率可用，减少 2-3 轮纠错对话

*场景 C：最优方案——标签搜索定位 + 精简加载*
- 先加载 L2 索引（gis/SKILL.md，约 1.5K tokens）浏览子技能概览
- 确认目标为 gdal-api 后，只加载 gdal-api 技能
- 总输入 tokens：约 19.5K
- **效果**：与场景 B 一致，但避免了盲目加载整库技能

**推荐的每会话 Token 预算分配**

| 预算项 | 推荐占比 | 说明 |
|--------|----------|------|
| 技能文件 | 40%-60% | 1-2 个 L3 技能 + 1 个 L2 索引 |
| 项目上下文 | 20%-30% | 当前文件/相关代码/项目结构说明 |
| 对话历史 | 10%-20% | 之前几轮问答的累积 |
| 系统指令 | 5%-10% | 工具本身的系统提示词 |

> **核心原则**：**每次加载 1-2 个 L3 技能 + 1 个 L2 索引**。不要一次性加载所有技能——这不仅浪费 Token，还会稀释 AI 对核心信息的注意力。AI 模型在处理大型上下文时存在"中间信息遗忘"现象（Lost in the Middle），过多技能文件堆叠在一起反而会降低关键信息的检索准确率。

### 11.1.2 加载顺序

经过大量实践验证，以下加载流程能兼顾效率和准确性：

```
标准加载流程（四步法）：

第 1 步：不确定方向时 → @SKILL.md（L1 根索引）
         ├─ 浏览三级分类概览
         ├─ 使用标签搜索（#gis #python #conversion 等）
         └─ 确认目标大类（gis / cad / csharp / ai / iot / 3d）

第 2 步：确定大类后 → @category/SKILL.md（L2 分类索引）
         ├─ 浏览该大类的子技能列表（每个带 1-2 句概要）
         ├─ 对比不同子技能的适用场景
         └─ 确定 1-2 个目标 L3 技能

第 3 步：精确加载 → @category/tool/SKILL.md（L3 技能）
         ├─ 阅读"快速开始"或"常用命令"部分
         ├─ 在 AI 对话中执行具体任务
         └─ 如遇到未覆盖的子问题，考虑横向加载相关技能

第 4 步：必要时横向扩展 → 加载相关 L3 技能
         ├─ 例如使用 gdal 处理矢量时发现坐标系问题 → 加载 gis/proj
         ├─ 例如使用 arcpy 时发现需要调用 arcgis-pro-sdk → 加载 csharp/arcgis-pro-sdk
         └─ 注意：第 4 步通常不需要，仅在技能引用链明确建议时才执行
```

**流程详解：每一步背后的设计逻辑**

**第 1 步——L1 根索引（@SKILL.md）**

根索引是技能库的"总目"，包含三级分类结构、标签索引和能力矩阵。这一步的价值在于：当你的问题足够模糊时（"我有个空间数据，不知道用什么工具处理"），标签系统能帮你快速收敛可能性空间。

根索引的标签系统覆盖了以下维度：
- **数据格式**：#vector #raster #pointCloud #cad #3dtiles
- **操作类型**：#conversion #analysis #visualization #processing
- **工具链**：#gdal #arcpy #qgis #cesium #autocad
- **语言**：#python #csharp #lisp #javascript

举例：你有一批 LAS 点云文件需要转成 Cesium 3D Tiles。在根索引中搜索 `#pointCloud #3dtiles` 即可定位到 gis/pdal 和 3d/cesiumjs-api 两个技能——没有这两个标签，你可能需要翻找 67 个技能文件。

**第 2 步——L2 分类索引（@category/SKILL.md）**

L2 索引的价值在于"对比"。同一个分类下往往有多个功能重叠或互补的技能：

| 分类 | 功能重叠示例 | 如何选择 |
|------|-------------|----------|
| gis/ | gdal vs arcpy vs qgis 都能做格式转换 | gdal 适合批量脚本，arcpy 适合 ArcGIS 生态，qgis 适合可视化和交互式处理 |
| cad/ | autocad-lisp vs zwcad-lisp vs gstarcad-lisp | 取决于你/用户的 CAD 品牌，完全功能对等但 API 不同 |
| ai/ | opencode vs pi vs oh-my-openagent | opencode 全功能，pi 极简隔离，oh-my-openagent 并行编排 |

不加载 L2 索引就直接翻找 67 个文件，相当于在图书馆不查书目系统就一本一本翻——效率极低。

**第 3 步——L3 技能**

这是"执行层"。到这个阶段，你已经明确知道需要哪个工具的哪个功能。L3 技能的结构设计支持快速定位：

- **元数据区**（前 20 行）：名称、版本、标签、适用场景——确认是否找对了
- **快速开始区**（50-150 行）：最常用的命令/API——80% 的需求在这里得到满足
- **详细参考区**（后续内容）：参数详解、进阶用法、常见问题——按需查阅

**第 4 步——横向扩展**

这一步遵循"最小化原则"：只在技能内部明确引用另一个技能时才加载。例如，gdal-api 技能在"坐标系处理"部分提到"如需了解 PROJ 坐标系字符串的详细语法，参见 gis/proj"，此时才有必要加载 proj 技能。

> **为什么不要预先加载所有可能相关的技能？** 因为"可能相关"的范围太大——一个 GDAL 任务可能在元数据阶段需要 exiftool（others/exiftool），在可视化阶段需要 mapbox-gl-js（3d 技能），在部署阶段需要 docker（others/docker）。如果预先全部加载，上下文将被无关信息淹没。正确做法是：遇到问题时再按需加载。

### 11.1.3 会话中动态切换

AI 工具的上下文管理机制决定了你需要了解如何在同一个会话中灵活切换不同的技能。

**会话中的技能加载机制**

大多数 AI 工具（Claude Code、Cursor、Roo Code 等）将技能文件的内容作为上下文的一部分注入对话中。这意味着：

1. **同一会话可以多次加载不同技能**——当你先加载 gdal-api 完成文件转换，然后加载 cesiumjs-api 做可视化时，两个技能的内容都会保留在上下文中（直到超出上下文窗口限制）。

2. **已加载的技能内容持续有效**——如果你在第 3 轮对话中加载了 gdal-api，第 10 轮对话中不需要重新加载，AI 仍然"记得"这个技能的内容（只要还在上下文窗口内）。

3. **上下文窗口有上限**——不同模型的上下文窗口从 32K 到 200K tokens 不等。当累积的对话历史 + 技能文件超出窗口上限时，最早的内容会被截断。

**会话生命周期管理策略**

| 阶段 | 行动 | 说明 |
|------|------|------|
| **任务开始** | 加载 L2 索引 + 1 个 L3 技能 | 精确、轻量 |
| **任务进行中** | 如有需要，加载第 2 个 L3 技能 | 横向扩展 |
| **子任务切换** | 不卸载已有技能，直接加载新技能 | 如果上下文充足 |
| **上下文接近上限** | 总结当前进展，开启新会话 | 承接关键信息 |
| **任务完成** | 获取最终结果后关闭会话 | 不要让无关上下文累积 |

**跨会话衔接的技巧**

当上下文达到上限需要开启新会话时，用以下方式高效"交接"：

```
新会话的第一条消息模板：

"我正在开发 [项目名]，当前进度：
1. [已完成的关键步骤和代码文件路径]
2. [当前卡在哪个问题上]
3. [之前加载过的技能：gis/gdal-api, gis/proj]
请先加载 @gis/gdal-api/SKILL.md 和 @gis/proj/SKILL.md，然后帮助我解决 [具体问题]。"
```

这样做的效果：
- 新会话立即获得关键背景（几行文字 vs 几千行自动总结）
- 指定要加载的技能，跳过定位阶段
- AI 不需要从零猜测上下文，直接进入问题解决模式

**多会话并行的场景**

在某些情况下，同时开启 2 个会话可能更高效：

| 场景 | 会话 1 | 会话 2 |
|------|--------|--------|
| 大型重构 | 加载 opencode + superpowers-zh，负责整体架构重构 | 加载 gis/gdal-api，负责数据处理模块 |
| 全栈开发 | 加载 cesiumjs-api + mapbox-gl-js，负责前端可视化 | 加载 gis/gdal-api + gis/postgis，负责后端服务 |
| 文档翻译 + 开发 | 加载 docutranslate，负责翻译技术文档 | 加载对应领域的开发技能，负责编码 |

### 11.1.4 技能缓存

不同 AI 工具对技能文件的缓存机制不同，理解这些差异有助于制定跨工具一致的加载策略。

**各工具的缓存行为**

| 工具 | 自动加载/缓存机制 | 跨会话保留 | 说明 |
|------|------------------|-----------|------|
| **Claude Code** | 支持 `skills` 配置项，指定目录后自动发现和加载 | 否（每次 `/clear` 后清空） | tools 级别的全局配置，加载后对当前会话持续有效 |
| **Cursor** | `.cursorrules` 文件中引用技能路径 | 否（需要在新对话中重新 `.cursorrules` 生效） | 通过 Rules 机制注入，非技能原生支持 |
| **Roo Code / Cline** | `.clinerules` 或自定义指令中引用 | 否（每个任务重置上下文） | 依赖工具配置系统 |
| **VS Code Copilot Chat** | `#file:` 语法手动引用 | 否 | 最简单的加载方式：`#file:path/to/SKILL.md` |
| **OpenCode** | 支持本地 skills 目录配置 | 否（新会话需重新加载） | 与 opengis-skills 原生集成良好 |
| **终端直接对话** | 无自动缓存，每次手动 `@path` 或粘贴内容 | 否 | 最基础的加载方式 |

**最大化缓存效益的实践**

1. **利用 Claude Code 的 skills 配置**（推荐方案）：

```json
// .claude/settings.json 或项目级 claude 配置
{
  "skills": {
    "paths": [
      ".skills/opengis-skills/gis",
      ".skills/opengis-skills/cad",
      ".skills/opengis-skills/csharp"
    ]
  }
}
```

配置后，Claude Code 会自动扫描这些目录下的 `SKILL.md` 文件，在需要时智能加载——无需每次手动指定路径。

2. **利用 `.cursorrules` 注入常用技能路径**：

```markdown
# .cursorrules （Cursor Rules 文件示例）
在 GIS 相关任务中，优先参考以下技能文件：
- @.skills/opengis-skills/gis/gdal-api/SKILL.md
- @.skills/opengis-skills/gis/proj/SKILL.md
- @.skills/opengis-skills/gis/geopandas/SKILL.md
```

这不是自动缓存，但能引导 AI 工具主动询问是否加载这些技能。

3. **利用 OpenCode 的 Agent 配置**（见第四章）：

为特定 Agent 角色绑定固定的技能集合，例如定义一个 `gis-expert` Agent，其 system prompt 中包含常驻的 gis 技能引用。

> **核心结论**：截至 2025 年 7 月，主流 AI 工具**均不支持**跨会话技能缓存。每次新会话都需要重新加载。因此，优化单次会话的技能加载策略（11.1.1-11.1.3）比期待跨会话缓存更务实。

---

## 11.2 项目集成策略

将 opengis-skills 集成到实际项目中，不仅关乎个人效率，更关乎团队协作的一致性和可维护性。

### 11.2.1 Git Submodule 推荐

**为什么推荐 Git Submodule？**

| 方案 | 优点 | 缺点 |
|------|------|------|
| **手动下载 ZIP** | 简单直接 | 无法追踪版本、更新需重新下载替换、团队间版本不统一 |
| **Clone 到本地固定路径** | 全局一份、所有项目共享 | 不同项目可能依赖不同版本、跨机器需要重新 clone |
| **npm/pip 包管理** | 版本管理规范 | opengis-skills 不是代码包、引入不必要的依赖管理工具 |
| **Git Submodule** ✅ | 版本锁定、团队一致、更新可控、与项目代码同仓库管理 | 多了一个 git 概念需要学习、部分 GUI 工具支持不完善 |

Git Submodule 是最适合**知识型资产**的版本管理方式——它既不是代码库需要编译构建，也不像零散文件需要手动管理版本。

**完整集成步骤**

```bash
# === 步骤 1：将 opengis-skills 添加为 submodule ===
cd your-gis-project/
git submodule add https://github.com/znlgis/opengis-skills.git .skills/opengis-skills

# 执行后会生成或更新 .gitmodules 文件，内容如下：
# [submodule ".skills/opengis-skills"]
#     path = .skills/opengis-skills
#     url = https://github.com/znlgis/opengis-skills.git

git commit -m "feat: 添加 opengis-skills 作为 submodule (.skills/opengis-skills)"


# === 步骤 2：团队成员首次克隆 ===
git clone --recurse-submodules <your-repo-url>
# 如果忘了 --recurse-submodules：
git submodule update --init --recursive


# === 步骤 3：更新到上游最新版本（需要时） ===
cd .skills/opengis-skills/
git fetch origin
git checkout main     # 或查看 releases 切换到指定 tag
git pull origin main
cd ../..
git add .skills/opengis-skills
git commit -m "chore: 更新 opengis-skills submodule 到最新版本"


# === 步骤 4：查看当前 submodule 状态 ===
git submodule status
# 输出示例： a1b2c3d .skills/opengis-skills (v1.2.0)
```

**Submodule 的常见操作速查**

| 操作 | 命令 |
|------|------|
| 添加 submodule | `git submodule add <url> <path>` |
| 克隆含 submodule 的仓库 | `git clone --recurse-submodules <url>` |
| 初始化已有 submodule | `git submodule update --init --recursive` |
| 更新 submodule 到最新 | `git submodule update --remote <path>` |
| 查看 submodule 当前 commit | `git submodule status` |
| 删除 submodule | `git submodule deinit <path>` + `git rm <path>` + 清理 `.git/modules/` |
| 切换 submodule 到指定 tag | `cd <path> && git checkout <tag> && cd - && git add <path>` |

**CI/CD 中的 Submodule 处理**

在 GitHub Actions 或其他 CI 环境中，确保 checkout 步骤包含 submodule：

```yaml
# GitHub Actions 示例
- uses: actions/checkout@v4
  with:
    submodules: recursive
```

> **注意**：submodule 默认指向特定 commit，不是分支。这意味着即使上游更新了 main 分支，你的 submodule 仍然指向旧的 commit——除非你主动执行 `git submodule update --remote`。这是一种**有意为之的安全机制**：你不会因为上游更新而意外引入变化。

### 11.2.2 Fork 定制

对于有定制化需求的团队，Fork 是最灵活的方案。

**Fork 定制的典型场景**

| 场景 | Fork 策略 |
|------|-----------|
| **添加团队专属技能** | Fork → 在 fork 的根目录下新建自定义技能 → 更新 L1/L2 索引 |
| **修改现有技能内容** | Fork → 直接修改 SKILL.md → 记录修改原因（在 commit message 中） |
| **添加私有数据/示例** | Fork → 在对应技能目录下新建 reference/ 子文件 |
| **修复上游 Bug** | Fork → 修复 → 提 PR 给上游（如果具有通用性） |
| **保持定制内容的私密性** | 团队内私有技能放在 submodule 外部（见 11.2.3） |

**Fork 后的同步策略**

```
         上游仓库 (znlgis/opengis-skills)
              │
              │  Fork
              ▼
         团队 Fork (your-team/opengis-skills)
              │
              │  git submodule add
              ▼
         项目仓库 (your-project)
           .skills/opengis-skills/   ← 指向团队 Fork
```

**保持与上游同步**：

```bash
# 一次性设置 upstream 远程
cd .skills/opengis-skills/
git remote add upstream https://github.com/znlgis/opengis-skills.git

# 定期同步（建议每月或每次 release 后执行）
git fetch upstream
git checkout main
git merge upstream/main   # 或 git rebase upstream/main

# 解决冲突后（如果有）
# 冲突通常发生在：你和上游修改了同一个技能文件
# 解决策略：优先保留上游的结构性更新，再合并你的定制内容

# 推送到团队 Fork
git push origin main

# 回到项目仓库，更新 submodule 引用
cd ../..
git add .skills/opengis-skills
git commit -m "chore: 同步上游 opengis-skills 更新"
```

**Fork 定制的最佳实践**

1. **明确的修改边界**：在定制内容前后添加清晰的注释标记，便于合并时识别
2. **独立的 commit 历史**：每个定制修改作为一个独立的 commit，commit message 前缀用 `custom:` 标识
3. **最小化上游冲突**：能通过新增 reference/ 子文件实现的定制，不要修改主 SKILL.md
4. **定期同步**：不要积攒太多 upstream 变更后一次性合并——冲突量会指数级增长

### 11.2.3 目录结构建议

**推荐的项目目录结构**

```
your-gis-project/
│
├── .skills/                          # 所有技能文件（git submodule 在此）
│   └── opengis-skills/               # git submodule ← 上游仓库
│       ├── SKILL.md                  # L1 根索引
│       ├── gis/                      # GIS 技能分类
│       ├── cad/                      # CAD 技能分类
│       ├── csharp/                   # C# 技能分类
│       ├── ai/                       # AI 技能分类
│       ├── iot/                      # IoT 技能分类
│       └── 3d/                       # 3D 技能分类
│
├── project-skills/                   # 本项目/团队专属技能（不在 submodule 内）
│   ├── my-gis-pipeline/              # 团队自定义：GIS 数据处理流水线
│   │   └── SKILL.md                  # 描述团队标准的 GDAL + PostGIS 工作流
│   │
│   ├── my-cad-template/              # 团队自定义：CAD 模板和图层规范
│   │   └── SKILL.md                  # 描述团队 CAD 图层命名、线型、标注规范
│   │
│   ├── my-deploy-scripts/            # 团队自定义：部署和运维脚本
│   │   └── SKILL.md                  # 描述 Docker 部署、CI/CD 配置的团队约定
│   │
│   └── project-conventions/          # 团队自定义：编码规范
│       └── SKILL.md                  # 描述团队 Python/C# 编码规范、GIS 数据目录约定
│
├── .gitmodules                       # submodule 配置文件
├── AGENTS.md                         # AI Agent 全局指令（引用所有技能路径）
├── CLAUDE.md                         # Claude Code 配置（同上）
├── .cursorrules                      # Cursor 规则（同上）
│
├── src/                              # 项目源代码
├── data/                             # GIS 数据（通常 .gitignore）
├── docs/                             # 项目文档
└── README.md
```

**AGENTS.md / CLAUDE.md 的配置示例**

```markdown
# AGENTS.md — 本项目 AI 编码代理配置

## 技能库路径
本项目使用以下技能库来辅助 AI 编码：

### 上游技能库（团队共享，不可修改）
- GIS: @.skills/opengis-skills/gis/SKILL.md
- CAD: @.skills/opengis-skills/cad/SKILL.md
- C#: @.skills/opengis-skills/csharp/SKILL.md
- AI: @.skills/opengis-skills/ai/SKILL.md
- 3D: @.skills/opengis-skills/3d/SKILL.md

### 本项目专属技能（仅本项目，可修改）
- GIS 数据处理流水线: @project-skills/my-gis-pipeline/SKILL.md
- CAD 模板规范: @project-skills/my-cad-template/SKILL.md
- 编码规范: @project-skills/project-conventions/SKILL.md

## 技能加载策略
- GIS 数据处理任务：优先加载 gis/gdal-api + project-skills/my-gis-pipeline
- CAD 二次开发任务：优先加载 cad/对应的 CAD 品牌 + project-skills/my-cad-template
- 前端可视化任务：优先加载 3d/cesiumjs-api 或 3d/mapbox-gl-js
- 后端数据处理：优先加载 gis/gdal-api + gis/postgis

## 注意事项
- 不要修改 .skills/opengis-skills/ 下的文件（submodule 内容）
- 团队专属技能放在 project-skills/ 目录下
- 技能更新通过 git submodule update --remote 执行
```

**project-skills/ 目录的设计原则**

1. **独立于上游仓库**：这个目录由项目团队自行维护，不受上游 opengis-skills 更新的影响
2. **遵循相同规范**：团队专属技能也遵循 SKILL.md 编写规范（第三章），保持一致性
3. **按需创建**：只为真正重复使用的知识创建专属技能——一次性需求直接写在对话中
4. **清晰的命名**：技能目录名能一眼看出用途，不需要加载就能判断是否需要

**project-skills/ 下的 SKILL.md 模板**

```markdown
---
name: my-gis-pipeline
description: 本团队 GIS 数据处理流水线规范——GDAL + PostGIS 标准工作流
version: 1.0.0
tags: [internal, gis, pipeline, gdal, postgis]
created: 2025-07-30
---

# 团队 GIS 数据处理流水线

## 数据接收标准
[定义从外部接收的空间数据格式、坐标系、属性字段要求]

## 标准处理流程
1. 格式标准化（统一转为 GeoPackage）
2. 坐标系统一（全部转为 EPSG:4526）
3. 拓扑检查和修复
4. 入库到 PostGIS

## 使用的工具和版本
- GDAL: 3.8+
- PostGIS: 3.4+
- 脚本语言: Python 3.11+

## 代码示例
[团队的标准处理脚本模板]
```

---

## 11.3 版本管理

opengis-skills 是一个活跃维护的开源项目。作为使用者，你需要理解它的版本管理机制，在"获取最新知识"和"保持工作流稳定"之间找到平衡。

### 11.3.1 上游版本追踪

**追踪上游更新的官方渠道**

| 渠道 | 用途 | 如何配置 |
|------|------|----------|
| **GitHub Releases** | 版本发布说明、重大变更公告 | Watch → Custom → Releases |
| **GitHub CHANGELOG** | 详细的逐版本变更清单 | 查阅仓库根目录 CHANGELOG.md |
| **GitHub Discussions** | 社区讨论、使用问题 | Watch → Custom → Discussions |
| **GitHub Issues** | 已知问题和功能请求 | Watch → Custom → Issues |
| **提交历史** | 每次提交的微观变更 | `git log` 或 GitHub 网页查看 |

**推荐的通知策略**

```
最小通知策略（适合个人开发者）:
  Watch → Custom → Releases only
  仅在发布新版本时收到通知

适中通知策略（适合团队负责人）:
  Watch → Custom → Releases + Discussions
  关注版本更新和社区动态

主动追踪策略（适合维护者）:
  Watch → All Activity
  + 定期 git log --oneline upstream/main..main
```

**上游更新后的决策流程**

收到上游更新通知后，按以下流程决策是否更新：

```
收到 Release 通知
    │
    ├─ 阅读 Release Notes
    │   ├─ 是否涉及你正在使用的技能？
    │   │   ├─ 否 → 可以跳过此版本（但建议不跳过超过 3 个版本）
    │   │   └─ 是 → 继续
    │   │
    │   ├─ 是否包含 Breaking Changes？
    │   │   ├─ 否（新增技能/改进文档/修正错误）→ 建议更新
    │   │   └─ 是（更改了技能结构/重命名文件/删除了技能）→ 谨慎评估
    │   │       ├─ 影响你的项目吗？
    │   │       │   ├─ 否 → 可以更新
    │   │       │   └─ 是 → 先在测试分支验证后再更新
    │   │
    │   └─ 执行更新并验证
    │
    └─ 定期检查（建议每月 1 次）
```

### 11.3.2 技能版本信息

每个技能文件的头部 YAML 元数据块包含版本相关信息，理解这些字段有助于追踪技能的变更历史。

**技能元数据中的版本相关字段**

```yaml
---
name: gdal-api               # 技能名称（不可变标识符）
version: 2.1.0               # 语义化版本号
description: ...             # 技能描述
tags: [gis, gdal, ...]       # 标签
created: 2024-06-15          # 创建日期
updated: 2025-07-20          # 最后更新日期（重要追踪字段）
upstream:                    # 上游参考
  name: GDAL
  version: "3.9"
  docs: https://gdal.org
---
```

**如何使用版本信息**

1. **`updated` 字段**：告诉你这个技能最后修改的时间。如果你 fork 了仓库并做了定制修改，这个字段是你判断"上游版本是否比我的 fork 更新"的关键指标。

2. **`upstream.version` 字段**：告诉你这个技能所参考的上游工具版本。例如 `upstream.version: "3.9"` 表示技能中的 API 示例基于 GDAL 3.9 编写。如果你使用的是 GDAL 3.4，部分 API 可能不适用。

3. **`version` 字段**：技能自身的语义化版本。遵循 SemVer：
   - **Major（主版本号）**：技能结构重大变更（如重命名章节、重组内容）
   - **Minor（次版本号）**：新增内容（新增 API 示例、新增子章节）
   - **Patch（修订号）**：错误修正（修正参数名、更新链接、修复拼写）

**Fork 后的版本追踪建议**

在你的团队 Fork 中，维护一个 `UPSTREAM_SYNC.md` 文件来追踪同步状态：

```markdown
# 上游同步状态

最后同步的上游 commit: a1b2c3d (2025-07-25)
最后同步的上游 tag: v1.3.0
已应用的定制修改: 3 个（见 custom/ 分支）

## 定制修改清单
- custom-001: 添加了团队 GDAL 脚本模板 (gis/gdal-api/reference/team-template.py)
- custom-002: 修改了 PostGIS 表命名规范 (gis/postgis/SKILL.md, 第 120-150 行)
- custom-003: 新增了公司内部坐标系定义 (gis/proj/SKILL.md, 第 80 行后)

## 待合并的上游变更
- 当前上游 HEAD: x9y8z7w (2025-08-01)
- 落后上游的 commit 数: 5
- 待评估变更: 见 git log a1b2c3d..upstream/main --oneline
```

### 11.3.3 向后兼容

技能文件作为知识载体，其"向后兼容"问题与软件库的 API 兼容问题类似：你需要确保上游的更新不会意外破坏你已经建立的 AI 编码工作流。

**技能更新可能引入的"不兼容"变化**

| 变化类型 | 影响 | 示例 |
|----------|------|------|
| **API 示例更新** | AI 可能生成新版本的代码，与团队现有代码风格不一致 | GDAL 3.9 的 `gdal.Warp()` 新增参数，AI 学习后可能在你的 GDAL 3.4 环境中建议不存在的新参数 |
| **文件重命名/重组** | 已有的 `@path` 引用失效 | 技能从 `gis/gdal-api/SKILL.md` 移动到 `gis/gdal/SKILL.md` |
| **章节重构** | 已记忆的"在第 X 章"位置失效 | 常用命令从"第三章"移动到"第二章" |
| **术语变更** | 团队内部文档引用的术语过时 | "shapefile" 章节重命名为 "矢量文件" |
| **标签更改** | 标签搜索定位失败 | `#gdal` 拆分为 `#gdal-vector` 和 `#gdal-raster` |
| **技能删除/合并** | 依赖该技能的引用链断裂 | 两个独立技能合并为一个 |

**五层防御策略**

| 层级 | 措施 | 适用场景 |
|------|------|---------|
| **第 1 层：固定版本** | 使用 Git Submodule 指向特定 commit/tag（而非 branch） | 生产环境项目 |
| **第 2 层：分阶段更新** | 先在开发/测试分支更新，验证后再合并到主分支 | 有 CI/CD 的项目 |
| **第 3 层：本地 Diff** | 更新 submodule 前先查看 diff：`git diff <old-commit> <new-commit> -- .skills/opengis-skills/` | 所有项目 |
| **第 4 层：独立测试** | 用一个简短的测试任务验证新技能版本是否产生预期正确的代码 | 使用了定制 Prompt 的项目 |
| **第 5 层：完整 Fork** | Fork 仓库并自主维护，只在评估后手动合并上游变更 | 对技能内容有严格版本要求的团队 |

**更新前后的验证清单**

```
□ 阅读上游 Release Notes 和 CHANGELOG
□ 查看 git diff 了解具体文件变更
□ 确认你使用的技能文件（L3）是否被修改
□ 确认你的 AGENTS.md / CLAUDE.md 中的技能路径是否仍然有效
□ 在一个新会话中加载新版本技能，验证是否正常加载
□ 用 1-2 个典型任务测试新版本技能的 AI 生成质量
□ 确认是否有 Breaking Change 影响你的定制修改
□ 更新 submodule commit 引用并提交到项目仓库
```

> **核心建议**：对于生产环境项目，**不要追求"始终最新"**。在技能版本满足需求且 AI 生成质量稳定的情况下，每 3-6 个月更新一次即可。你需要的是稳定可靠的 AI 编码伙伴，不是最新的技能文件版本号。

---

## 11.4 常见问题（FAQ）

以下 20+ 个问题来自 opengis-skills 用户社区、GitHub Issues 和实际使用中反馈的高频问题。

| # | 问题 | 答案 |
|---|------|------|
| 1 | **如何知道该加载哪个技能？** | 最可靠的方式是两步定位法。第一步：加载根索引 `@SKILL.md`，使用标签搜索功能定位大类。例如你的问题是"把 GeoJSON 转成 Shapefile"，在根索引中搜索 `#conversion #vector` 即可定位到 `gis/gdal` 和 `gis/ogr2ogr`。第二步：加载 L2 索引确认具体技能，然后加载 L3 技能执行任务。如果标签搜索不生效（部分工具不支持），直接在提示词中描述你的需求，让 AI 推荐应该加载哪个技能。 |
| 2 | **多个技能同时加载会冲突吗？** | 不会冲突。opengis-skills 的每个技能文件是独立的知识单元，设计上遵循"无副作用"原则——技能之间不存在互相依赖或覆盖关系。你可以安全地同时加载 2-3 个 L3 技能（例如同时加载 `gis/gdal-api` 和 `gis/proj`，一个做格式转换一个做坐标系处理）。唯一的限制是 Token 预算（见 11.1.1），建议同时加载的技能不超过 3 个。 |
| 3 | **技能内容过时了怎么办？** | 有三种解决路径，按推荐优先级排列：（1）向 [znlgis/opengis-skills](https://github.com/znlgis/opengis-skills) 提交 Issue，详细说明哪个技能的哪个部分需要更新（附上官方文档链接作为证据），维护者通常会在一周内响应；（2）如果急需使用，可以 Fork 仓库后手动修改 SKILL.md，同时在 Issue 中附上你的修改供维护者参考；（3）短期方案：在 AI 对话中明确告知"请使用 GDAL 3.9 版本的 API"（如果技能基于 3.8 但你用的是 3.9），AI 会在技能知识和你的要求之间取平衡。 |
| 4 | **为什么有些技能文件超过 1000 行？** | 大型技能文件（如 `gis/gdal-api` 约 1500 行、`ai/opencode` 约 1200 行、`gis/opengis-all` 约 900 行）之所以庞大，是因为它们覆盖的工具本身功能极其丰富。但请注意：**核心使用部分通常在前 500 行**（元数据 + 快速入门 + 常用命令/API），后面的内容按难度递增排列（进阶用法、参数详解、边界情况、性能优化）。实际使用中 80% 的任务在前 500 行内就能找到答案。此外，部分大型技能的详细参数参考放在 `reference/` 子目录中（如果技能有这个子目录），不需要一次性全部加载，按需查阅即可。 |
| 5 | **技能适用于哪些 AI 工具？** | opengis-skills 设计为工具无关的**纯文本知识文件**。任何支持 `@文件路径` 语法或能将文件内容注入上下文的 AI 编程工具都可以使用。明确验证过的工具包括：**Claude Code**（原生 skills 支持）、**Cursor**（`.cursorrules` + 手动引用）、**Cline / Roo Code**（`.clinerules` + `@file`）、**VS Code Copilot Chat**（`#file:` 语法）、**OpenCode**（原生 skills 目录配置）、**Cody**（`@file` 命令）、**Continue**（`@docs` 添加本地文档）、**DeepSeek Chat**（手动粘贴或通过工具桥接）。详见第四章的完整集成指南。 |
| 6 | **如何在不联网的环境使用？** | 完全支持离线使用。步骤：（1）在联网环境中提前 `git clone https://github.com/znlgis/opengis-skills.git` 到本地路径（例如 `D:\skills\opengis-skills` 或 `~/.skills/opengis-skills`）；（2）将整个目录拷贝到离线环境的相同路径，或通过 U 盘/内网传输；（3）在 AI 工具中使用本地绝对路径引用，例如 `@D:/skills/opengis-skills/gis/gdal-api/SKILL.md`。注意：技能文件是静态文本，不涉及任何网络请求——一旦文件在本地，加载和使用完全离线。 |
| 7 | **技能可以用中文提问吗？** | 完全可以，而且这是设计意图。opengis-skills 的技能文件正文以中文撰写（YAML 元数据中的 `description` 字段按 Anthropic 规范使用英文），面向中文 GIS 开发者。你可以在提示词中使用中文描述需求，AI 会根据技能文件中的中文知识生成中文回复和中文注释的代码。例如："请参考 @gis/gdal-api/SKILL.md，帮我写一个用 GDAL 重投影 GeoTIFF 的 Python 脚本"——完全自然流畅。 |
| 8 | **每次打开 AI 工具都要重新加载技能吗？** | 是的。截至目前，主流 AI 工具的上下文不会跨会话保留——每次新对话都是一个全新的上下文环境，需要重新加载技能文件。这是 AI 工具当前的技术限制，不是 opengis-skills 的设计问题。你可以通过以下方式降低重复加载的摩擦：（1）使用支持全局技能配置的工具（如 Claude Code 的 `skills` 配置项、OpenCode 的 skills 目录配置），让工具自动发现和加载；（2）在 `.cursorrules` / `CLAUDE.md` 中预定义常用技能路径，让 AI 在新会话中主动建议加载；（3）保存常用任务的"启动模板"——在笔记工具中保存一段包含技能路径和任务描述的文字，新会话中直接粘贴。 |
| 9 | **上游变更会影响我的 fork 吗？** | 不会自动影响。Git 的 Fork 机制保证你的 fork 是独立的——上游仓库（znlgis/opengis-skills）的任何变更都不会自动推送到你的 fork。只有在你主动执行以下操作时，上游变更才会进入你的 fork：（1）在 fork 中 `git fetch upstream && git merge upstream/main`；（2）通过 GitHub 网页点击 "Sync fork" 按钮；（3）如果你的项目使用 submodule 指向团队 fork，上游变更需要经过"上游 → 团队 fork → 项目 submodule"两跳才会影响你的项目。这给了你充分的评估和测试窗口。 |
| 10 | **能否在多个项目中共享同一份技能？** | 可以，有两种方式：（1）**中心化方案**——将 opengis-skills clone 到固定路径（如 `~/.skills/opengis-skills`），所有项目的 AI 工具配置都指向这个路径。优点是节省磁盘空间、一次更新全局生效。缺点是所有项目耦合到同一版本，无法针对特定项目锁定版本。（2）**分布式方案**——每个项目通过 Git Submodule 引用自己的副本。优点是版本独立、CI/CD 可复现。缺点是磁盘空间占用稍多（约 5MB 每副本）、需要逐项目更新。**推荐**：个人开发用中心化方案，团队/生产项目用分布式方案。 |
| 11 | **什么情况下应该自己编写技能？** | 以下场景值得投入时间编写团队专属技能：（1）使用一个开源 GIS 工具/库，但它的知识尚未被 opengis-skills 覆盖（例如你使用 WhiteboxTools 进行栅格分析，但仓库中没有此技能）；（2）团队有多步骤的标准工作流（例如"接收测量数据 → 格式校验 → 坐标系转换 → 入库 PostGIS → 生成报告"），每次让 AI 从头理解这个流程效率太低；（3）团队有严格的编码规范、命名约定、目录结构约定，需要在 AI 编码时始终遵循；（4）涉及内部私有系统（如公司内部 API、自研 GIS 引擎），外部技能库不可能覆盖。编写规范参见[第三章：SKILL.md 编写规范](https://znlgis.github.io/ai/opengis-skills/03-SKILL.md编写规范/)。 |
| 12 | **技能和提示词模板有什么区别？** | 这是两个不同层级的概念。**提示词模板**是零散的文本片段——你可能有一个"帮我写 GDAL 重投影脚本"的提示词模板，每次复制粘贴到 AI 对话框中。提示词模板的问题是：非结构化、无元数据、不能被 AI 工具自动发现、不能与其他模板组合。**技能文件**（SKILL.md）是结构化知识文件——包含 YAML 元数据（名称、版本、标签、适用场景）、三层索引可被搜索和浏览、能被 AI 工具自动发现和加载、可以组合使用（你加载 gdal + proj 两个技能，AI 自动整合两者的知识）。简单说：提示词模板是"手写便签"，技能文件是"图书馆目录 + 专著"；前者适合一次性小任务，后者适合可复用的系统工程。 |
| 13 | **为什么技能文件使用英文 description？** | 技能文件的 YAML 元数据中 `description` 字段使用英文，正文使用中文，这是遵循 **Anthropic Skills 规范**的设计决策。Anthropic 的规范要求 `description` 使用 `"Use when..."` 格式的英文描述，因为 AI 工具在"发现和匹配技能"这一阶段使用英文匹配算法。例如当用户用英文问 "How to convert GeoJSON to Shapefile?"，AI 工具会匹配到 description 中包含 "Use when converting vector GIS data formats" 的技能。如果 description 是中文，跨语言匹配的准确性会降低。正文使用中文则是因为目标用户是中文开发者，阅读效率远高于英文。**这是"功能层用英文保证工具兼容，内容层用中文服务用户"的务实选择。** |
| 14 | **Token 消耗怎么样？实际成本多少？** | 以 Claude 3.5 Sonnet 为例做一个实际成本测算。加载 1 个中型 L3 技能（约 8K tokens）+ 1 个 L2 索引（约 1.5K tokens）+ 200 行项目代码上下文（约 3K tokens）+ 1 轮问答（输出约 2K tokens），总计约 14.5K tokens。按 Claude 3.5 Sonnet 的 API 定价（输入 $3/MTok，输出 $15/MTok），单次问答成本约 **$0.05**。对比没有技能的情况：AI 可能生成错误代码 → 你需要 2-3 轮纠错对话 → 实际消耗可能达到 40K+ tokens（约 $0.15），而且浪费了你的时间。结论：**技能带来的 Token 开销远低于它帮你节省的纠错 Token。** |
| 15 | **如何贡献新技能？** | 详细的贡献流程见[第十二章：贡献指南与社区](https://znlgis.github.io/ai/opengis-skills/12-贡献指南与社区/)。简要流程：（1）Fork 仓库；（2）按[第三章](https://znlgis.github.io/ai/opengis-skills/03-SKILL.md编写规范/)的规范编写 SKILL.md，放入合适的大类目录（如果在 gis/cad/csharp/ai/iot/3d 之外，放入 `others/`）；（3）更新该大类的 L2 索引（添加你的技能到子技能列表）；（4）更新 L1 根索引（添加你的技能到全局索引）；（5）自检：确认 YAML 元数据完整、标签准确、description 使用英文 "Use when..." 格式；（6）提交 PR 到上游仓库。贡献前建议先开 Discussion 或 Issue 与维护者沟通，避免重复劳动。 |
| 16 | **如果 AI 工具不支持 @文件语法怎么办？** | 并非所有 AI 工具都支持 `@path/to/file` 这种文件引用语法。以下是三种替代方案：（1）**手动复制粘贴**——用文本编辑器打开 SKILL.md，全选复制内容，在 AI 对话的开头粘贴，并加一句"以下是我要参考的知识文件，请基于此回答后续问题"。（2）**利用工具的配置注入**——Cursor 支持 `.cursorrules`，在其中写 `请参考以下技能文件的内容：[粘贴技能内容]`；Claude Code 支持 `CLAUDE.md`，同上；GitHub Copilot 支持 `.github/copilot-instructions.md`。（3）**使用支持此功能的工具**——如果经常使用技能库，建议换用支持 `@文件` 语法或原生 skills 的工具（Claude Code、Cursor、Roo Code 等都支持），省去大量手动粘贴的麻烦。 |
| 17 | **技能会替代官方文档吗？** | 不会，也无意替代。opengis-skills 的定位是**官方文档的 AI 友好摘要和实战指南**——它把官方文档中分散在几十个页面里的"99% 常用场景"浓缩到一个文件中，让 AI 能以最低的 Token 成本获取最相关的知识。但这不意味着你可以完全抛弃官方文档：（1）技能可能落后于工具的版本更新（特别是新发布的 API）；（2）技能覆盖的是"常用"场景，不覆盖边缘情况和冷门功能；（3）深度理解一个工具的原理仍需要阅读官方文档。**最佳实践**：用技能文件获得 AI 的高质量代码生成，遇到复杂问题时回到官方文档进行深度查阅。 |
| 18 | **多个团队成员的 fork 如何保持同步？** | 推荐两级同步架构。**第一级：组织级内部 fork**——在团队的 GitHub Organization 中维护一个统一的内部 fork（如 `your-org/opengis-skills-internal`），由指定维护者负责从上游（znlgis/opengis-skills）定期合并更新。**第二级：项目级别 submodule**——每个项目通过 submodule 引用组织 fork。这样做的优势：（1）对上游变更的评估只需一人完成（维护者），而非所有成员各自评估；（2）组织 fork 中可以包含团队的全部定制内容（专属技能、修订后的上游技能），所有项目受益；（3）成员无需关注上游更新，只需 `git submodule update` 即可获取团队审核过的稳定版本。如果团队规模小（< 5 人），所有成员直接指向组织 fork 的 main 分支即可。 |
| 19 | **对于大型项目，如何组织技能加载策略？** | 大型 GIS 项目通常涉及多个技术栈（数据处理 + 后端服务 + 前端可视化 + 部署运维），一次性加载所有相关技能必然超出 Token 预算。推荐**分阶段加载策略**：按项目的开发阶段，逐个加载对应技能。示例如下——**阶段 1（架构设计）**：加载 `ai/superpowers-zh`（头脑风暴方法论），设计系统架构和模块划分，此时不需要加载具体的工具技能。**阶段 2（数据处理）**：加载 `gis/gdal-api` + `gis/postgis`，完成 ETL 脚本开发和数据库设计。**阶段 3（后端服务）**：加载 `gis/geoserver` 或 `csharp/arcgis-pro-sdk`（取决于技术选型），实现 API 服务。**阶段 4（前端可视化）**：加载 `3d/cesiumjs-api` 或 `3d/mapbox-gl-js`，实现地图可视化。**阶段 5（部署）**：加载 `others/docker`，编写 Dockerfile 和部署脚本。每个阶段使用独立的 AI 会话，上下文保持专注，Token 消耗可控。 |
| 20 | **opengis-skills 和 superpowers-zh 有什么区别？** | 两者定位不同、互相补充。**opengis-skills** 提供**领域知识**（Domain Knowledge）——它告诉 AI "GIS 是什么、GDAL 怎么用、CAD 二次开发怎么做"。它是"知识层"的资产。**superpowers-zh** 提供**编程方法论**（Programming Methodology）——它告诉 AI "怎么进行 TDD、怎么系统化调试、怎么做代码审查"。它是"方法论层"的资产。在实际使用中，两者结合效果最佳：superpowers-zh 管理编程流程（需求分析 → 设计 → TDD 红绿循环 → 代码审查），opengis-skills 在每个步骤中提供专业领域的知识支撑（写测试时用 `gis/gdal-api` 确保 API 调用正确，审查时用 `gis/geopandas` 检查最佳实践）。详见第八章中 superpowers-zh 的详细说明。 |

**更多常见问题（持续补充）**

| # | 问题 | 答案 |
|---|------|------|
| 21 | **技能加载失败（文件找不到）怎么办？** | 这是最常见的技术问题。排查步骤：（1）确认文件路径正确——区分大小写（Linux/macOS 上 `SKILL.md` 和 `skill.md` 是不同的文件）；（2）确认文件确实存在——在终端中 `ls` 或 `dir` 该路径；（3）确认 AI 工具有文件读取权限——检查工具的权限配置（如 Claude Code 的 `allowedTools`、VS Code 的工作区信任设置）；（4）尝试使用绝对路径代替相对路径；（5）如果使用 submodule，确认 submodule 已初始化（`git submodule update --init`）。 |
| 22 | **AI 生成的代码不准确怎么办？** | 代码不准确有三种常见原因。（1）**技能没加载对**——你可能加载的是 arcpy 技能但在写 GDAL 代码，检查当前会话中加载的技能是否匹配你的任务。（2）**技能版本与工具版本不匹配**——技能基于 GDAL 3.8 编写，但你的环境是 GDAL 3.4，部分 API 不兼容。解决方案：在提示词中明确指定版本"请生成兼容 GDAL 3.4 的代码"。（3）**技能内容与官方文档有偏差**——技能可能未及时更新到最新 API。解决方案：在 AI 回答后手动对照官方文档验证关键 API 调用。如果发现持续不准确，向仓库提交 Issue。 |
| 23 | **标签搜索不生效怎么办？** | 标签搜索依赖 AI 工具对 YAML front-matter 中 `tags` 字段的解析能力。如果搜索不生效：（1）尝试在提示词中直接列出标签关键词，如"我需要处理 #raster #conversion 相关的任务，该加载哪个技能？"（2）使用中文关键词搜索技能正文内容，如"搜索 gdal 栅格格式转换"；（3）如果工具完全不支持标签解析，改用"标签思维"但不依赖工具实现——在 L2 索引中手动浏览子技能列表，根据概要描述判断。 |
| 24 | **上下文过长导致截断怎么办？** | 这是多轮长对话的常见问题。症状：AI 开始"忘记"早期加载的技能内容，生成的代码突然偏离技能指导。解决方案：（1）**立即操作**——在提示词中重新指定要参考的技能文件路径和关键章节；（2）**预防措施**——控制每会话的技能加载数量（不超过 2 个 L3 技能），完成一个子任务后主动开启新会话（参考 11.1.3 的跨会话衔接技巧）；（3）**工具特性**——了解你使用的 AI 工具的上下文窗口大小（Claude 3.5 Sonnet: 200K，GPT-4: 128K，Gemini 1.5 Pro: 1M），在接近上限前主动总结和切换。 |
| 25 | **技能文件中的代码示例可以直接复制使用吗？** | 技能文件中的代码示例是**教学性质的参考代码**，展示了 API 的正确调用方式和参数组合。它们的定位是"告诉你这样写是对的"，而不是"给你一个开箱即用的完整程序"。使用建议：（1）在 AI 对话中，让 AI 基于技能示例生成适配你具体数据的代码（修改文件路径、参数值、错误处理）；（2）如果你手动复制，务必替换示例中的占位符（如 `input.tif`、`output.shp`、`your_connection_string`）并添加文件路径检查和异常处理；（3）验证代码在你当前环境的工具版本下可以运行。 |

---

## 11.5 排障指南

本节是遇到具体问题时的快速诊断手册。每个问题按"症状 → 根因 → 解决方案"的结构呈现。

### 问题 1：AI 没有读取技能文件

**症状**：加载了技能文件但 AI 似乎"无视"了其中的知识，仍然生成不符合技能指导的代码。

**根因分析**（按可能性排序）：

1. **工具限制了文件读取**：部分 AI 工具默认不启用文件读取功能（例如某些 VS Code Copilot 配置）
2. **路径格式错误**：Windows 上使用了 `/` 而非反斜杠、使用了相对路径而工具的工作目录不一致
3. **文件编码问题**：技能文件编码不是 UTF-8，导致部分内容无法正确解析
4. **上下文截断**：技能文件太长，加载后被后续对话挤出上下文窗口
5. **工具不理解技能格式**：部分工具只读取文本内容，不解析 YAML 元数据，可能忽略了关键部分

**解决方案清单**：

```
□ 确认文件存在且路径正确
  → 在终端中执行: Test-Path -LiteralPath ".skills/opengis-skills/gis/gdal-api/SKILL.md"
  → 或: ls -la .skills/opengis-skills/gis/gdal-api/SKILL.md

□ 确认 AI 工具有文件读取权限
  → Claude Code: 检查 settings.json 中的 allowedTools
  → Cursor: 检查工作区是否受信任
  → VS Code Copilot: 确认工作区文件可被扩展访问

□ 测试简化加载
  → 不用 @路径 语法，改为直接复制技能文件的前 100 行内容粘贴到对话框
  → 如果粘贴后 AI 能正常使用 → 问题在工具的 @文件 机制
  → 如果粘贴后 AI 仍无视 → 问题在提示词表述

□ 检查加载表述
  → 错误的表述: "看看这个文件"（太模糊，AI 不确定你要它参考什么）
  → 正确的表述: "请参考 @gis/gdal-api/SKILL.md 中的 GDAL Warp 章节，帮我写一个重投影脚本"
  → 明确指定"参考哪个文件的哪个部分做什么事"

□ 检查文件编码
  → 在支持编码显示的编辑器中打开 SKILL.md
  → 确认编码为 UTF-8 (with BOM 或无 BOM 均可，但不能是 GBK/ANSI)
```

### 问题 2：AI 生成的代码不对

**症状**：AI 参考了技能文件，但生成的代码存在 API 调用错误、参数名错误或版本不兼容。

**根因分析**（按可能性排序）：

1. **技能覆盖的工具版本与你实际环境不一致**（最常见）
2. **加载了错误的技能**（例如加载了 arcpy 但在写 GDAL 代码）
3. **AI 综合了技能知识和自身训练数据，但训练数据更旧**
4. **技能文件存在知识错误**（概率低但不能排除）

**逐层排查流程**：

```
第 1 层：确认技能与任务匹配
  □ AI 生成的是 gdal 代码 → 你是否加载了 gis/gdal-api 技能？
  □ AI 生成的是 arcpy 代码 → 你是否加载了 gis/arcpy 技能？
  □ 如果不匹配 → 重新加载正确技能

第 2 层：确认版本兼容性
  □ 查看技能文件头部 upstream.version 字段
    → 例如 upstream.version: "3.8" 表示技能基于 GDAL 3.8 编写
  □ 检查你本地的工具版本
    → gdalinfo --version
    → python -c "from osgeo import gdal; print(gdal.__version__)"
  □ 如果版本不一致：
    → 小版本差异（3.7 vs 3.8）：通常兼容，告知 AI 你的版本即可
    → 大版本差异（2.x vs 3.x）：技能可能不适用，需要查找对应版本的资源

第 3 层：验证关键 API 调用
  □ 检查 AI 生成的代码中是否有明显不存在的函数/参数名
  □ 对照官方文档快速验证（对关键 API 调用执行第 3 层即可）
  □ 如果发现持续错误 → 向 opengis-skills 提交 Issue

第 4 层：检查是否有竞态/训练数据干扰
  □ 如果技能的 API 示例是正确的，但 AI 仍然生成旧版 API
  □ 在提示词中强调: "请严格使用技能文件中的 API，不要使用你记忆中的旧版 API"
  □ 增加约束: "如果你的记忆与技能文件冲突，以技能文件为准"
```

### 问题 3：标签搜索不生效

**症状**：在提示词中使用 `#gis`、`#gdal` 等标签搜索，AI 没有正确匹配到对应技能。

**根因分析**：

- 标签搜索依赖 AI 工具对 SKILL.md 文件中 YAML front-matter 的 `tags:` 字段的解析能力
- 并非所有工具都实现了标签解析——部分工具只能做全文文本匹配
- 即使支持标签解析，匹配算法可能对中文上下文中的英文标签不敏感

**替代方案**：

| 方案 | 操作 | 优缺点 |
|------|------|--------|
| **显式关键词搜索** | 在提示词中用中文描述需求 + 英文关键词双保险："我需要将 GeoTIFF 转为 COG（Cloud Optimized GeoTIFF），涉及 gdal 栅格转换" | 兼容所有工具，准确率中等 |
| **L2 索引人工浏览** | 加载 L2 分类索引（如 `gis/SKILL.md`），阅读子技能列表，手动确认 | 准确率最高，多花费约 1.5K tokens |
| **加载 L1 根索引** | 加载根 `SKILL.md`，浏览完整的三级分类 | 准确率最高，Token 开销最大（约 10K） |
| **让 AI 推荐** | 直接描述需求，让 AI 推荐应该加载哪个技能："我有一个 [需求]，opengis-skills 中哪个技能文件最适合？" | 省力，依赖 AI 的训练知识 |

### 问题 4：上下文过长导致截断

**症状**：对话进行到一定轮次后，AI 开始"遗忘"早期信息——之前加载的技能不再被引用，生成的代码突然质量下降。

**根因分析**：

上下文截断是 AI 工具的底层机制决定的，表现为两种形式：
- **硬截断**：超过上下文窗口上限，最旧的内容被直接丢弃
- **软截断**（Attention Decay / Lost in the Middle）：虽然内容仍在窗口内，但 AI 模型对中间部分信息的注意力衰减，越靠中间的文本越容易被"忽略"

**识别软截断的早期信号**：

| 信号 | 说明 |
|------|------|
| AI 开始询问已经回答过的问题 | 对话早期的信息正在丢失 |
| AI 生成的代码突然抛开技能文件的规范 | 技能内容可能在注意力衰减区 |
| AI 开始使用通用知识而非技能中的专业知识 | 训练数据覆盖了技能内容 |
| 回复质量波动——时好时坏 | 上下文不同部分的利用率不均 |

**应对策略**：

```
策略 A：主动上下文管理（预防）
  1. 每完成一个子任务，评估当前 Token 消耗
     → Claude Code 中可以使用 /context 命令查看
  2. 在 Token 消耗达到窗口上限的 60%-70% 时，主动开启新会话
  3. 新会话的第一条消息中包含"摘要 + 当前任务 + 所需技能"

策略 B：强制重新聚焦（救急）
  1. 在提示词开头声明: "注意：请忽略之前的对话中任何与以下技能文件冲突的内容"
  2. 重新加载技能文件（如果工具支持同会话重新加载）
  3. 将关键信息（技能文件中最重要的 20-30 行）直接粘贴到当前消息中

策略 C：分拆会话架构（大型项目）
  1. 按功能模块分配独立的 AI 会话
     → 会话 1: 数据处理逻辑（加载 gis/gdal-api）
     → 会话 2: 数据库设计（加载 gis/postgis）
     → 会话 3: 前端可视化（加载 3d/cesiumjs-api）
  2. 每个会话的上下文保持专注和精简
  3. 会话之间通过"输出结果文件"传递进展
```

### 问题 5：Git Submodule 常见问题

**症状与解决方案**：

| 症状 | 原因 | 解决 |
|------|------|------|
| `git clone` 后 `.skills/opengis-skills/` 是空目录 | 没有使用 `--recurse-submodules` | 执行 `git submodule update --init --recursive` |
| `git status` 显示 submodule 有修改 | submodule 内的 HEAD 与项目记录的 commit 不一致 | 进入 submodule 目录执行 `git checkout` 到目标 commit；或如果是有意更新，在项目根执行 `git add .skills/opengis-skills` |
| submodule 更新后项目引用未变 | 更新了 submodule 但未在项目中记录新的引用 | 在项目根执行 `git add .skills/opengis-skills && git commit -m "更新 submodule"` |
| `git submodule update` 报错 | submodule 的远程 URL 可能已变更或不可达 | 检查 `.gitmodules` 中的 URL 是否正确；执行 `git submodule sync` 同步 URL 配置 |
| 切换分支后 submodule 行为异常 | 不同分支可能记录不同的 submodule commit | 切换分支后执行 `git submodule update --recursive` |
| submodule 内部 `git pull` 失败 | submodule 处于 detached HEAD 状态 | 进入 submodule 后 `git checkout main`（或目标分支），然后 `git pull` |

---

## 11.6 Token 优化的 10 个技巧

经过社区反复实践和验证，以下 10 个技巧按照从"见效最快"到"收益递减"的顺序排列。前 5 个技巧能覆盖 90% 的 Token 优化需求。

### 技巧 1：优先加载 L2 分类索引（而非 L1 根索引）

**原理**：L1 根索引（`SKILL.md`）约 700 行 / 10K tokens，包含全部 67 个技能的清单。L2 分类索引（如 `gis/SKILL.md`）约 80-150 行 / 1K-2.5K tokens，只包含该分类下的子技能。如果你已经知道任务属于哪个大类（例如明确是 GIS 问题），直接跳过 L1，加载 L2 索引即可——节省约 8K tokens。

**具体操作**：

```
不是: 每次都 @SKILL.md 从头浏览
而是:
  - GIS 问题 → 直接 @gis/SKILL.md
  - CAD 问题 → 直接 @cad/SKILL.md
  - AI 工具问题 → 直接 @ai/SKILL.md
  - 不确定大类时才加载 @SKILL.md

节省: 每次约 8K tokens (约 $0.02)
年化（按每天 10 次会话计算）: 约 80K tokens/天 ≈ $0.20/天 ≈ $73/年
```

### 技巧 2：只加载本次任务相关的 1-2 个 L3 技能

**原理**：每个 L3 技能 4K-25K tokens。一次任务通常只需要 1 个核心技能（直接用到的工具）± 1 个辅助技能（互补知识）。加载 3 个以上的技能几乎不会提升生成质量，因为 AI 的注意力会分散——它需要从三个不同的知识源中综合信息，反而容易混淆。

**判断"是否需要辅助技能"的简单测试**：
- 当前技能文件中明确提到了另一个技能名（如"详细参考 gis/proj"）→ 加载
- 你直觉上觉得"可能需要"但不确定 → 不加载，等遇到具体问题时再加载
- 所有技能都"可能有用"→ 不加载，这是 FOMO 心理而非实际需求

### 技巧 3：利用工具的小模型分流

**原理**：部分 AI 编码工具（如 OpenCode）支持双模型架构——`small_model` 处理简单任务（文件读取、路径解析、简单问答），`large_model` 处理复杂任务（代码生成、架构设计）。加载技能文件属于"理解文本结构"的中等复杂度任务，可以分流到小模型处理，释放大模型的 Token 预算。

**OpenCode 配置示例**：

```json
{
  "small_model": {
    "provider": "deepseek",
    "model": "deepseek-v4-flash"
  },
  "large_model": {
    "provider": "deepseek",
    "model": "deepseek-v4-pro"
  }
}
```

在这种配置下，加载和解析技能文件可以走 small_model（成本低），代码生成走 large_model（质量高）。如果你的工具不支持双模型，技巧 1 和 2 仍然适用。

### 技巧 4：任务完成后开启新会话，不要累积无关上下文

**原理**：这是一个被严重低估的 Token 优化手段。许多用户在同一会话中串联处理多个不相关任务——先做 GDAL 重投影，然后切换到 CesiumJS 可视化，再切换到 PostgreSQL 数据库设计。三次任务完成后，上下文中仍然保留着前两次的对话和技能文件（可能已经超出上下文窗口上限的 50%）。当进入第四个任务时，AI 的注意力已经被大量无关信息稀释。

**最佳实践**：

```
会话生命周期模型：
  一个会话 = 一个子任务（1-4 小时工作量）
  
  子任务完成标志：
  □ 核心代码已生成并验证
  □ 关键测试已通过
  □ 输出文件已保存
  □ 无遗留待解决问题
  □ → 关闭会话，开启新会话进行下一个子任务
```

**跨会话衔接模板**（复述自 11.1.3）：

```
新会话第一条消息：

"承接上一个会话的成果。我已完成 [前一任务]，代码保存在 [文件路径]。
新任务是 [新任务描述]。
请先加载 @分类/技能/SKILL.md，然后帮我 [具体请求]。"
```

### 技巧 5：大技能（如 gdal-api）只加载需要的子部分

**原理**：大型技能文件（如 `gis/gdal-api` 约 1500 行 / 20K tokens）的结构通常遵循"金字塔"设计——前 500 行是核心内容（快速开始 + 常用 API），后面 1000 行是进阶内容（详细参数 + 边缘情况 + 性能调优）。如果你需要的只是最常用的 3-5 个 API，前 500 行已经足够。

**具体操作方式**（取决于工具）：

| 工具 | 操作 |
|------|------|
| Claude Code | 先加载完整技能，在对话中指明"请只参考 SKILL.md 的前 500 行（常用 API 部分）" |
| Cursor | 使用 `@file:start-end` 语法（如果支持），或手动指定章节名 |
| 其他工具 | 手动复制前 500 行内容到对话框，加说明"以下内容来自 gdal-api 技能的核心部分" |

**适用此技巧的大技能**：`gis/gdal-api`（~1500 行）、`ai/opencode`（~1200 行）、`gis/opengis-all`（~900 行）、`csharp/arcgis-pro-sdk`（~800 行）。

### 技巧 6：将技能设置为工具的全局配置而非每次对话都加载

**原理**：每次对话开始时手动加载技能文件，相当于每次都要重新描述"你是谁"——费时费力。利用工具提供的全局配置机制（如 Claude Code 的 skills 设置、Cursor 的 .cursorrules、OpenCode 的 skills 目录），让工具在新会话中自动加载或提示加载常用技能。

**配置示例汇总**：

| 工具 | 配置方式 | 效果 |
|------|----------|------|
| Claude Code | `.claude/settings.json` 中配置 `skills.paths` | 自动发现，按需加载 |
| Cursor | `.cursorrules` 中写入技能路径引用 | 新对话自动注入规则 |
| Roo Code | `.clinerules` 或自定义指令 | 每个任务自动注入 |
| OpenCode | `opencode.json` 中配置 `skills` 目录 | 原生支持 |
| Continue | `config.json` 中配置 `@docs` | 将技能库作为一个文档源添加 |

**注意**：全局配置不等于全局加载所有技能——全局配置是指"告诉工具技能库在磁盘的哪个位置"，工具会智能地按需加载。不要把所有技能路径都写入全局配置让工具全部加载——这违背了技巧 2 的原则。

### 技巧 7：使用 reference/ 子目录的文件代替全量主文件

**原理**：部分大型技能在目录下包含了 `reference/` 子目录，其中按主题拆分了更小的参考文件。例如 `gis/gdal-api/reference/` 下可能有 `warp-reference.md`、`translate-reference.md`、`ogr-reference.md` 等，每个文件只覆盖一个特定主题。如果你只需要 GDAL Warp 的详细参数，加载 `warp-reference.md`（可能只有 200 行 / 3K tokens）比加载完整的 gdal-api（1500 行 / 20K tokens）节省 85%。

**使用方式**：

```
不是: @gis/gdal-api/SKILL.md （全部 1500 行）
而是: @gis/gdal-api/reference/warp-reference.md （仅 Warp 的 200 行）

前提: 你已经在 L2 索引或之前的会话中了解 gdal-api 的概貌和常用命令
误区: 如果没有概貌知识直接跳到 reference/，可能缺乏上下文
建议: 首次接触某工具时先加载主 SKILL.md（或至少前 500 行），后续任务用 reference/
```

### 技巧 8：对于简单问题，直接提问而不加载技能

**原理**：技能的 Token 开销（4K-20K）有一个"盈亏平衡点"——只有当任务足够复杂，技能帮助减少的纠错轮数能抵消加载成本时，加载技能才是划算的。对于简单问题（如"GDAL 的 gdalinfo 命令怎么用？"），AI 模型训练数据中几乎肯定包含正确答案——直接提问即可。

**"简单问题"判断标准**：
- 涉及的是行业内最知名的工具的基础命令（gdalinfo、ogrinfo、git status）
- 答案可以在官方文档的第一段/第一个示例中找到
- 不涉及多个工具的组合使用
- 不涉及特定版本的 API 变更

**反面示例——值得加载技能的场景**：
- 需要生成一个包含错误处理、进度回调、多波段处理的完整 GDAL Python 脚本
- 不确定 arcpy 和 GDAL 在某个场景下应该选哪个
- 需要了解 qgis 的 Python 插件开发完整流程（非简单导出）

### 技巧 9：复用同一会话加载不同技能（而非开启多个并行会话）

**原理**：这是一个需要权衡的策略。如果上下文窗口充裕（例如使用 200K 窗口的模型），在同一个会话中串行处理多个相关的子任务比开启多个并行会话更省 Token——因为同一个会话中的系统指令、项目背景、L2 索引只需要加载一次。但也要警惕技巧 4 的警告：只有在子任务之间存在强关联时才复用会话。

**适用和不适用的场景**：

| 场景 | 策略 | 理由 |
|------|------|------|
| 先做 GDAL 格式转换，再用同一批文件做 PostGIS 入库 | 同会话 | 两个任务共享"数据文件路径"这个核心上下文 |
| 先做 GDAL 转换，再做 CesiumJS 可视化（不相关的数据和项目） | 分会话 | 两个任务几乎不共享上下文 |
| 修复一个 Bug，涉及 gdal-api 和 proj 两个技能 | 同会话 | Bug 是连接两个技能的纽带 |
| 三个不相关的独立小任务 | 分会话 | 累积上下文对 AI 注意力是负担而非帮助 |

### 技巧 10：利用工具的上下文压缩/摘要功能

**原理**：当会话进行到一定阶段，上下文接近窗口上限时，部分 AI 工具提供了上下文压缩功能——自动将早期的详细对话摘要为简短的关键信息，释放 Token 空间给后续对话。如果你的工具支持此功能（Claude Code、Continue 等），可以主动触发压缩而非手动总结和重新开新会话。

**手动触发压缩的实际操作**：

```
可在提示词中主动请求：

"请将我们当前的对话进展摘要为 5 条关键信息，每条不超过 30 字。
摘要完成后，我将继续提出新问题，你可以忽略摘要之前的详细对话。"
```

虽然这会临时消耗一些 Token（生成摘要），但后续对话节省的 Token（不需要再传输所有的早期对话）远超摘要成本——特别是当早期对话中包含大量无用的调试过程和错误尝试时。

**10 个技巧的优先级总结**

| 优先级 | 技巧 # | 技巧名称 | 节省效果 | 实施难度 |
|--------|--------|----------|----------|----------|
| ★★★★★ | 2 | 只加载 1-2 个 L3 技能 | 每次节省 10K-30K tokens | 极低（习惯调整） |
| ★★★★★ | 4 | 任务完成后开新会话 | 持续累积节省 | 极低（习惯调整） |
| ★★★★☆ | 1 | 优先加载 L2 而非 L1 | 每次节省约 8K tokens | 极低（习惯调整） |
| ★★★★☆ | 8 | 简单问题不加载技能 | 每次节省 4K-20K tokens | 低（需要判断经验） |
| ★★★☆☆ | 5 | 大技能只加载子部分 | 每次节省 5K-15K tokens | 低（了解技能结构） |
| ★★★☆☆ | 6 | 工具全局配置 | 长期累积节省 | 中（需要配置时间） |
| ★★★☆☆ | 9 | 复用会话 | 场景依赖 | 中（需要判断经验） |
| ★★☆☆☆ | 3 | 小模型分流 | 成本而非 Token 节省 | 高（工具需支持） |
| ★★☆☆☆ | 7 | reference/ 子目录 | 每次节省 5K-17K tokens | 低（有条件限制） |
| ★☆☆☆☆ | 10 | 上下文压缩 | 场景依赖 | 低（手动操作） |

---

## 11.7 安全与隐私

opengis-skills 的知识文本性质决定了它的安全模型与可执行代码截然不同，但这不意味着安全考量可以忽略。本节从"技能本身的安全性"和"使用技能时的隐私考量"两个维度展开。

### 11.7.1 技能本身的安全属性

**技能不包含可执行代码**

opengis-skills 仓库中的每一个 SKILL.md 文件都是**纯文本**——Markdown 格式的知识文档。文件中的代码示例（Python、C#、JavaScript、Shell 等）是**教学性质的静态文本片段**，不会被自动解析、编译或执行。它们的作用是告诉 AI "这个 API 的正确调用方式是什么"，而不是在你的电脑上运行任何程序。

这意味着：
- 加载技能文件**不涉及代码执行**——没有 `eval()`、没有脚本解释器、没有进程启动
- 技能文件不像 npm 包或 Python 包那样有"供应链攻击"风险
- 技能文件本身不会读取、修改或删除你磁盘上的任何文件

**技能不发起网络请求**

技能文件加载和使用的全流程：

```
磁盘读取（本地文件系统）
    → AI 工具解析 Markdown（本地处理）
    → 注入上下文（内存操作）
    → AI 模型推理（发生在远端 API 服务器，但发送的是你选择的技能内容）
```

在整个流程中，opengis-skills 本身没有任何一步主动发起网络请求。技能文件中可能包含指向外部资源的 URL（如官方文档链接、GitHub 仓库地址），但这些是**供人类阅读的参考链接**，不会自动被工具访问。

**技能内容的可审计性**

由于技能文件是纯文本 Markdown，任何人都可以：
- 用任何文本编辑器打开审阅（零门槛）
- 用 `git diff` 查看每次变更（完整历史追溯）
- 用 `grep` 搜索特定内容（快速审计）

这提供了最大程度的透明度——你不需要信任任何二进制文件或混淆代码，每个字节的内容都是可读的。

### 11.7.2 使用技能时的隐私考量

**技能文件内容会上传到 AI API 服务器**

这是使用技能库时唯一需要认真对待的隐私问题：当你使用基于云端的 AI 工具（如 Claude.ai、ChatGPT、Gemini、DeepSeek Chat 等）时，加载到对话中的技能文件内容会被发送到对应服务商的 API 服务器，作为推理请求的一部分。

| 工具类型 | 数据传输范围 | 隐私影响 |
|----------|-------------|----------|
| **云端 AI 工具**（Claude.ai、ChatGPT 网页版） | 技能文件内容 + 你的代码 + 对话全部内容 | 中等——数据在服务商服务器上处理，取决于服务商的隐私政策 |
| **API 调用**（Claude API、GPT API） | 技能文件内容 + 你的代码 + 对话全部内容 | 中等——数据经过 API 传输，取决于 API 提供商的隐私政策 |
| **本地 AI 工具**（Ollama + 本地模型、LM Studio） | 全部在本地处理 | 极低——数据不出本机 |
| **混合模式**（本地工具 + 云端模型） | 工具传输你选择的上下文到云端 | 中等——取决于你加载了什么 |

**关键判断：技能文件本身不包含敏感数据**

opengis-skills 仓库中的所有内容都是**公开知识**——GDAL 的 API 使用方法、ArcGIS Pro SDK 的编程模型、CesiumJS 的配置示例。这些信息本就属于公开的技术文档范畴，不包含：
- 你的项目源代码
- 你的空间数据内容
- 你的数据库连接信息
- 你的 API 密钥/密码
- 你的客户数据

因此，**加载技能文件本身的隐私风险极低**。你需要关注的是：在加载了技能文件的同一对话中，你还传入了什么其他信息（项目代码、数据样本、服务器配置等）。

### 11.7.3 团队私有技能的安全管理

根据 11.2.3 的建议，团队专属技能（如项目特定的工作流规范、内部 API 文档、编码规范）应放在 `project-skills/` 目录中，不与上游 opengis-skills 仓库混在一起。这些私有技能需要额外的安全考量：

**不要将私有技能提交到公开仓库**

```
正确做法:
  project-skills/    ← 在 .gitignore 中排除，或不推送到公开仓库
  │                    (如果它们包含敏感信息)
  ├── internal-api/SKILL.md      ← 包含公司内部 API 的详细文档
  └── deployment/SKILL.md         ← 包含服务器配置模板

错误做法:
  .skills/opengis-skills/gis/project-specific/SKILL.md  ← 混入上游目录
  │ 这个目录是 submodule，内容会被推送到上游仓库！
```

**私有技能的访问控制**

| 场景 | 方案 |
|------|------|
| 团队内部共享私有技能 | 放在团队私有 Git 仓库中（如 GitLab 私有仓库），通过 submodule 或指定路径引用 |
| 个人私有技能 | 放在本地固定路径（如 `~/.skills/private/`），不纳入任何 Git 仓库 |
| 包含敏感信息的私有技能 | 使用 AI 工具时，避免在加载这些技能的同一会话中同时处理不相关的外部任务 |

**AI 工具对话日志的隐私**

许多 AI 工具会将对话历史保存在本地日志文件中（如 Claude Code 的 `~/.claude/history/`、Cursor 的会话记录）。这些日志中**包含了加载的技能文件内容**。如果你在对话中处理了敏感信息（私有代码、内部数据），请注意：

1. 清理工具的对话历史（如果工具有清除功能）
2. 不在共享机器上使用 AI 工具处理敏感任务
3. 了解你使用的工具将对话数据存储在哪里

### 11.7.4 安全检查清单

在实际使用 opengis-skills 之前，建议过一遍这个清单：

```
□ 技能来源
  □ 技能文件来自官方仓库（znlgis/opengis-skills）或可信的 fork
  □ 如果是团队内部 fork，了解谁有 push 权限
  □ 定期 git pull / submodule update 以确保获得安全更新

□ 使用环境
  □ 了解你使用的 AI 工具的隐私政策（特别是数据留存策略）
  □ 如果处理高度敏感的项目，优先使用本地模型 + 本地工具
  □ 使用的 API 服务商（Anthropic/OpenAI/DeepSeek 等）的隐私条款已阅读

□ 敏感信息隔离
  □ 加载技能文件（公开知识）和讨论敏感项目内容的对话分开
  □ 在讨论内部私有代码时，不加载包含敏感信息的上文
  □ 私有技能的 SKILL.md 不包含实际的密码/密钥/连接字符串

□ 团队管理
  □ 私有技能存放在独立的目录或私有仓库
  □ 团队成员了解哪些信息不应在 AI 对话中暴露
  □ 定期审查团队 fork 中的定制修改，确保没有意外混入敏感信息
```

---

## 本章小结

本章从"会用"到"用好"再到"安全使用"三个层次，系统性地梳理了 opengis-skills 的最佳实践和常见问题解答。

**第一层：会用（11.1 技能加载策略）**
- 掌握 Token 预算管理的核心原则：**每次加载 1-2 个 L3 技能 + 1 个 L2 索引**
- 遵循四步加载流程：L1 根索引（不确定时）→ L2 分类索引 → L3 技能 → 按需横向扩展
- 理解会话生命周期管理：新会话衔接技巧和多会话并行场景

**第二层：用好（11.2 项目集成策略 & 11.3 版本管理）**
- **Git Submodule** 是项目集成的推荐方案——版本锁定、团队一致、更新可控
- Fork 定制用于团队专属需求，但要制定清晰的同步策略
- 合理的目录结构（`.skills/` + `project-skills/`）分离上游公开知识和团队私有知识
- 版本管理的关键是**平衡稳定与更新**：生产环境锁定版本，主动追踪上游变更

**第三层：安全使用（11.7 安全与隐私）**
- 技能文件是纯文本知识，不包含可执行代码，不发起网络请求
- 使用云端 AI 工具时，技能内容会传输到服务商服务器——但技能本身是公开知识
- 团队私有技能需要额外的安全措施：隔离存放、访问控制、定期审查

**速查索引**：

| 你的需求 | 直接跳转到 |
|----------|-----------|
| 技能加载太多，Token 不够用 | 11.1.1 Token 预算管理 → 11.6 Token 优化技巧 |
| 不知道该加载哪个技能 | 11.1.2 加载顺序（四步法） |
| 多个项目想共享技能 | 11.2.1 Git Submodule → FAQ #10 |
| 想添加团队自己的技能 | 11.2.2 Fork 定制 → 11.2.3 目录结构 |
| 上游更新了要不要升级 | 11.3.1 上游版本追踪 |
| 遇到具体问题了 | 11.4 FAQ + 11.5 排障指南 |
| 关心安全和隐私 | 11.7 安全与隐私 |

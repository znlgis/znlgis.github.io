# 代码架构优化 + Bug 修复 设计文档

**日期**: 2025-08-04
**范围**: 代码架构优化 + Bug 修复（不做 UX 新功能）
**约束**: 不引入新工具链、不新增依赖、不改变视觉效果

---

## 一、CSS/JS 拆分与整理

### 现状

`_layouts/default.html` 971 行，其中内联 `<style>` ~400 行（含 Rouge 高亮样式），内联 `<script>` ~300 行（侧边栏交互、搜索、响应式）。

### 目标

将内联 CSS/JS 抽离为独立文件，搬运过程中整理归类、去重、去死代码，保持渲染效果不变。

### 变更清单

| 操作 | 文件 | 详情 |
|------|------|------|
| 新建 | `assets/css/main.css` | 提取所有内联 `<style>` 内容，整理归类（布局 → 侧边栏 → 内容区 → 代码高亮 → 响应式），去重、去无意义的注释/死代码 |
| 新建 | `assets/js/main.js` | 提取侧边栏折叠/展开、搜索触发、响应式汉堡菜单等 JS 逻辑，保持功能不变 |
| 保留 | `_layouts/default.html` 中少量 inline JS | 搜索相关的小段初始化逻辑（如 search.json 的 fetch 和事件绑定），保留在页面底部，避免 JSON 变量在文件间传递增加复杂度 |
| 修改 | `_layouts/default.html` | `<style>...</style>` 替换为 `<link rel="stylesheet" href="/assets/css/main.css">`；`<script>...</script>` 替换为 `<script src="/assets/js/main.js"></script>`；清理空标签 |
| 修改 | `_layouts/post.html` | 如存在且引用 default 布局则自动继承；如有独特的 CSS/JS 一并检查 |

### 不做

- 不引入 CSS 预处理器、BEM 命名、PostCSS 等新工具链
- 不改变任何渲染效果

### 验证方式

浏览器对比搬运前后页面：侧边栏折叠/展开、搜索输入/结果展示、代码高亮、移动端汉堡菜单均无差异。

---

## 二、首页动态化

### 现状

`index.md` 是手动维护的教程列表页面，列出了所有教程分类和链接，需与 `_data/navigation.yml` 手动同步。

### 目标

首页改为 Jekyll Liquid 模板，从 `_data/navigation.yml` 自动渲染目录结构，一处维护、两处生效。

### 变更清单

| 操作 | 文件 | 详情 |
|------|------|------|
| 重命名 | `index.md` → `index.html` | 改为 HTML 布局文件，使用 Liquid 模板语法 |
| 新增 | `index.html` 中的 Liquid 逻辑 | 递归遍历 `site.data.navigation` 树形结构：一级节点渲染为大标题，二级节点渲染为分类标题 + 链接列表，三级节点渲染为子链接 |
| 样式 | `assets/css/main.css` | 如需少量新增样式（如首页列表缩进），追加至 main.css；命名做前缀区分避免冲突 |
| 删除 | `index.md` 中的手动列表 | 原来手写的数百行教程链接全部移除 |

### 不做

- 不新增首页特有的视觉风格系统

### 验证方式

渲染后首页与当前视觉一致，所有链接可点击且指向正确；新增教程条目到 `navigation.yml` 后首页自动出现。

---

## 三、搜索索引瘦身

### 现状

`search.json` 包含所有文档的标题 + 正文内容（截断到 500 字符），对于数百个教程章节、总文件大小可能达数百 KB 到 1MB+。

### 目标

减小体积 50-70%，只保留标题和摘要。

### 变更清单

| 操作 | 文件 | 详情 |
|------|------|------|
| 修改 | `search.json` | `excerpt` 字段的取值逻辑：当前为文档正文 content 前 500 字符 → 改为 `page.description`（front matter 中的 description 字段；若无则 fallback 到 `page.excerpt` 即 Jekyll 默认摘要） |
| 适配 | `assets/js/main.js` | 搜索匹配逻辑不变（标题 + excerpt 双字段匹配），仅数据源变瘦 |
| 前置检查 | `_config.yml` | 确认 `jekyll-feed` 的 excerpt 截断长度是否符合预期；如需要可调整 |

### 不做

- 不改搜索算法
- 不拆分为多个 JSON 文件
- 不移除搜索功能

### 验证方式

构建后对比 `search.json` 文件大小变化；浏览器中搜索已有关键词，确认结果合理性。

---

## 四、Bug 修复

| 问题 | 位置 | 修复 |
|------|------|------|
| 学习路线链接错误 | `about.md` | `https://znlgis.github.io/about/gis/basic/` → `/gis/basic/`；所有同类绝对路径前缀错误一并修复 |
| `.gitignore` 缺少 Python 缓存排除 | `.gitignore` | 添加 `__pycache__/` |
| 标题锚点 aria-hidden 不当 | `_layouts/default.html` | 移除标题锚点链接上的 `aria-hidden="true"` 属性（锚点应对辅助技术可见） |
| 缺少 favicon 引用 | `_layouts/default.html` | 添加 `<link rel="icon" href="/assets/logo.png">` |
| Rouge 高亮样式冗余（附属于 CSS 拆分） | `assets/css/main.css` | 提取时检查，去除 Rouge 默认样式中未被使用的 token class 定义 |

---

## 五、不做清单（明确排除）

- 暗色模式
- 搜索分片/索引引擎替换
- Google Fonts 替换（需用户另行决策）
- 不蒜子统计移除/替换（需用户另行决策）
- JSON-LD / 结构化数据
- 缓存策略优化
- 移动端 UI 重新设计
- 新增任何 npm/Node 依赖

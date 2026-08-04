# 代码架构优化 + Bug 修复 实施方案

> **目标代理:** 使用 `deep-worker` 逐任务执行。步骤使用 checkbox (`- [ ]`) 跟踪进度。

**目标:** 拆分内联 CSS/JS、动态化首页、瘦身搜索索引、修复 Bug

**架构:** 纯静态站点，Jekyll + Liquid 模板渲染，CSS/JS 无构建工具

**技术栈:** Jekyll 4.x + Liquid + GitHub Pages + Rouge + vanilla JS

## 全局约束

- 不引入新工具链或依赖
- 不改变渲染效果
- 不新增 UX 功能（无暗色模式等）
- 搜索路径在 JS 中硬编码为 `/search.json`（替代 Liquid `relative_url`）
- 首页保持现有视觉风格（卡片入口 + 分类列表）

---

### 任务 1: 提取内联 CSS 到 `assets/css/main.css`

**文件:**
- 新建: `assets/css/main.css`
- 修改: `_layouts/default.html`

**产生:** CSS 文件供后续任务引用

- [ ] **步骤 1: 创建 `assets/css/main.css`**

从 `_layouts/default.html` 第 17-582 行提取整个 `<style>...</style>` 块的内容（不含 `<style>` 标签本身）。在文件顶部添加简短注释说明文件来源。保持所有规则不变，去重：检查 Rouge 高亮样式（342-403 行）中是否有重复定义的 token class（`.highlight .k` 与 `.highlight .kd`/`.highlight .kn`/`.highlight .kr` 等独立 token 不冲突，保留全部）。

<details>
<summary>CSS 分类组织（在文件中用注释分隔）</summary>

```css
/* ===== 变量与全局重置 ===== */
:root { ... }
* { ... }
body { ... }
.skip-link { ... }

/* ===== 布局 ===== */
.page-wrapper { ... }
.content-wrapper { ... }
.content-inner { ... }
header { ... }
nav { ... }
main { ... }
footer { ... }
.busuanzi-stats { ... }

/* ===== 侧边栏 ===== */
.sidebar { ... }
.sidebar-header { ... }

/* ===== 目录树 ===== */
.dir-tree { ... }

/* ===== 搜索 ===== */
.search-container { ... }

/* ===== 回到顶部 ===== */
.back-to-top { ... }

/* ===== 面包屑 ===== */
.breadcrumb { ... }

/* ===== 响应式表格 ===== */
.table-wrapper { ... }

/* ===== 标题锚点 ===== */
.heading-anchor { ... }

/* ===== 内容排版 ===== */
a { ... }
h1-h6 { ... }
p { ... }
ul, ol { ... }
li { ... }
code { ... }
pre { ... }
.highlight { ... }
blockquote { ... }
table, th, td { ... }
img { ... }
.post-meta { ... }
.post-list { ... }
.category-section { ... }

/* ===== Rouge 代码高亮 (GitHub 风格) ===== */
.highlight .hll { ... }
/* ... 所有 token class ... */

/* ===== 响应式 ===== */
@media (max-width: 900px) { ... }
@media (max-width: 600px) { ... }
```
</details>

- [ ] **步骤 2: 修改 `_layouts/default.html`**

替换第 17-582 行的 `<style>...</style>` 为：
```html
    <link rel="stylesheet" href="{{ '/assets/css/main.css' | relative_url }}">
```
插入位置：`</style>` 标签原来所在位置（第 582 行之后）。

- [ ] **步骤 3: 验证**

本地运行 `bundle exec jekyll serve` 检查页面渲染：侧边栏、目录树、代码高亮、搜索框、移动端汉堡菜单均无差异。

- [ ] **步骤 4: 提交**

```bash
git add assets/css/main.css _layouts/default.html
git commit -m "refactor: extract inline CSS to assets/css/main.css"
```

---

### 任务 2: 提取内联 JS 到 `assets/js/main.js`

**文件:**
- 新建: `assets/js/main.js`
- 修改: `_layouts/default.html`

**接口:**
- 消耗: 任务 1 产生的 `<link>` 标签（无直接依赖，但需在同一 `default.html` 中操作）
- 产生: `main.js` 暴露以下功能供浏览器直接使用：
  - 搜索：监听 `#searchInput` 输入/聚焦/键盘事件，动态加载 `/search.json`，渲染 `#searchResults`
  - 侧边栏：切换 `#sidebar`/`#sidebarOverlay` 显示，Escape 关闭
  - 目录树：折叠/展开 `.js-tree-toggle` → `.tree-children`
  - 回到顶部：`#backToTop` 滚动显示 + 平滑滚动
  - 表格包装：`main table` → `.table-wrapper`
  - 标题锚点：`main h2,h3,h4` 追加 `#` 锚点链接
  - 当前页高亮：匹配 `window.location.pathname` 与 `.dir-tree a.tree-item`

- [ ] **步骤 1: 创建 `assets/js/main.js`**

合并 `_layouts/default.html` 中两段 `<script>`：
- 第 662-870 行：搜索功能（IIFE）
- 第 871-969 行：侧边栏/UI 功能（DOMContentLoaded）

关键修改：搜索脚本中的第 705 行
```javascript
xhr.open('GET', '{{ "/search.json" | relative_url }}', true);
```
替换为：
```javascript
xhr.open('GET', '/search.json', true);
```

将所有 `var` 声明保持原样（避免改变作用域行为）。添加文件顶部注释说明来源。

- [ ] **步骤 2: 修改 `_layouts/default.html`**

删除第 662-870 行（第一个 `<script>` 块）和第 871-969 行（第二个 `<script>` 块），替换为：
```html
    <script src="{{ '/assets/js/main.js' | relative_url }}"></script>
```

- [ ] **步骤 3: 验证**

浏览器中验证：侧边栏折叠/展开、搜索输入 → 结果下拉、键盘上下选择 + Enter 跳转、Escape 关闭搜索结果、移动端汉堡菜单切换、Escape 关闭侧边栏、回到顶部按钮、标题锚点生成、目录树当前页高亮。全部功能正常。

- [ ] **步骤 4: 提交**

```bash
git add assets/js/main.js _layouts/default.html
git commit -m "refactor: extract inline JS to assets/js/main.js"
```

---

### 任务 3: 修复 default.html 中的 Bug

**文件:**
- 修改: `_layouts/default.html`

- [ ] **步骤 1: 修复标题锚点 aria-hidden**

在 `assets/js/main.js` 中（原 default.html 第 938 行）：
```javascript
anchor.setAttribute('aria-hidden', 'true');
```
修改为：
```javascript
anchor.setAttribute('aria-hidden', 'false');
```
锚点链接应对辅助技术可见。

- [ ] **步骤 2: 添加 favicon 引用**

在 `_layouts/default.html` 的 `<head>` 中（第 8 行 `{% seo title=false %}` 之后）添加：
```html
    <link rel="icon" href="{{ '/assets/logo.png' | relative_url }}">
```

- [ ] **步骤 3: 提交**

```bash
git add assets/js/main.js _layouts/default.html
git commit -m "fix: aria-hidden on heading anchors, add favicon"
```

---

### 任务 4: 添加 `__pycache__/` 到 `.gitignore`

**文件:**
- 修改: `.gitignore`

- [ ] **步骤 1: 编辑 `.gitignore`**

在文件末尾（第 87 行之后）追加：
```
# Python
__pycache__/
```

- [ ] **步骤 2: 验证**

```bash
git status
```
确认 `__pycache__/` 不再显示为 untracked。

- [ ] **步骤 3: 提交**

```bash
git add .gitignore
git commit -m "fix: add __pycache__/ to .gitignore"
```

---

### 任务 5: 首页动态化（index.md → index.html）

**文件:**
- 删除: `index.md`
- 新建: `index.html`

**接口:**
- 消耗: `_data/navigation.yml`（site.data.navigation），结构为 `[{title, icon, children: [{title, icon, url}]}]`
- 消耗: `assets/css/main.css`（已有 `.category-section` 样式）
- 产生: 首页 HTML，包含卡片入口区（静态） + 分类列表区（Liquid 动态生成）

- [ ] **步骤 1: 创建 `index.html`**

新建文件，内容如下：

```html
---
layout: default
title: 首页
---

<h1>znlgis 博客</h1>

<p>GIS &middot; CAD &middot; C# &middot; 3D &middot; AI 开发与技术分享</p>

<hr>

<h2>快速开始</h2>

<p>无论你是 GIS 初学者还是资深开发者，这里都有适合你的教程。选择感兴趣的方向开始学习：</p>

<!-- 卡片锚点映射（对应下方 navigation.yml 遍历顺序）：
     GIS教程=section-1, CAD开发=section-4, C#开发=section-6,
     AI系列=section-7, IoT物联网=section-8, 3D开发=section-5 -->
<div class="home-card-grid">
  <div class="home-card">
    <h3> GIS 开发</h3>
    <p>GDAL &middot; GeoServer &middot; PostGIS &middot; QGIS &middot; OpenLayers &middot; Cesium</p>
    <a href="#section-1">浏览教程</a>
  </div>
  <div class="home-card">
    <h3> CAD 开发</h3>
    <p>FreeCAD &middot; OCCT &middot; KiCad &middot; OpenSCAD &middot; CadQuery &middot; Xbim</p>
    <a href="#section-4">浏览教程</a>
  </div>
  <div class="home-card">
    <h3> C# 开发</h3>
    <p>Admin.NET &middot; Furion &middot; NPOI &middot; ReoGrid &middot; SqlSugar</p>
    <a href="#section-6">浏览教程</a>
  </div>
  <div class="home-card">
    <h3> AI 应用</h3>
    <p>Dify &middot; OpenClaw &middot; hermes-agent &middot; OpenCode</p>
    <a href="#section-7">浏览教程</a>
  </div>
  <div class="home-card">
    <h3> IoT 物联网</h3>
    <p>Raspberry Pi Pico &middot; MicroPython &middot; 传感器</p>
    <a href="#section-8">浏览教程</a>
  </div>
  <div class="home-card">
    <h3> 3D 开发</h3>
    <p>SuperSplat &middot; Ara3D-SDK &middot; 高斯泼溅 &middot; BIM</p>
    <a href="#section-5">浏览教程</a>
  </div>
</div>

---

{%- for section in site.data.navigation -%}
<h2 id="section-{{ forloop.index }}">{{ section.icon }} {{ section.title }}</h2>
<div class="category-section">
  <ul class="home-link-list">
  {%- for item in section.children -%}
    <li><a href="{{ item.url | relative_url }}">{{ item.icon }} {{ item.title }}</a></li>
  {%- endfor -%}
  </ul>
</div>
{%- endfor -%}
```

> **注意:** 卡片样式需要添加到 `assets/css/main.css`。见下方步骤 2。

- [ ] **步骤 2: 追加首页卡片样式到 `assets/css/main.css`**

在 `assets/css/main.css` 末尾追加：

```css
/* 首页卡片网格 */
.home-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    margin: 2rem 0;
}
.home-card {
    border: 1px solid #e1e4e8;
    border-radius: 8px;
    padding: 1.2rem;
    background: #f8f9fa;
}
.home-card h3 {
    margin: 0 0 0.5rem;
}
.home-card p {
    font-size: 0.85rem;
    color: #666;
    margin: 0 0 0.8rem;
}
.home-card a {
    font-size: 0.85rem;
}
.home-link-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.4rem 1rem;
}
.home-link-list li {
    margin: 0;
}
.home-link-list a {
    display: block;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    transition: background 0.15s;
}
.home-link-list a:hover {
    background: rgba(0,0,0,0.04);
    text-decoration: none;
}
```

- [ ] **步骤 3: 验证**

构建站点，检查首页：
- 卡片网格渲染正确，链接指向正确锚点
- 分类列表自动从 `navigation.yml` 生成，所有链接可点击
- 移动端响应式正常
- 新增一个测试条目到 `navigation.yml` 的任意 section，确认首页自动出现

- [ ] **步骤 4: 提交**

```bash
git rm index.md
git add index.html assets/css/main.css
git commit -m "refactor: dynamic homepage from navigation.yml"
```

---

### 任务 6: 搜索索引瘦身

**文件:**
- 修改: `search.json`

**接口:**
- 消耗: `page.description`（front matter）+ `site.description`（fallback）
- 产生: JSON 数组，每个条目含 `title`, `url`, `content`（改为 description）, `description`

- [ ] **步骤 1: 修改 `search.json`**

**Documents 循环（第 13 行）：**
```liquid
"content": {{ doc.content | strip_html | normalize_whitespace | truncate: 500 | jsonify }},
```
替换为：
```liquid
"content": {{ doc.description | default: site.description | truncate: 500 | jsonify }},
```

**Pages 循环（第 25 行）：**
```liquid
"content": {{ page.content | strip_html | normalize_whitespace | truncate: 500 | jsonify }},
```
替换为：
```liquid
"content": {{ page.description | default: site.description | truncate: 500 | jsonify }},
```

> **说明:** 原来截取正文 500 字符，改为截取 front matter 中的 `description` 字段；若文档未设置 description，则 fallback 到 `site.description`（站点描述）。`description` 字段（第 14/26 行）本身已有 `doc.description | default: site.description` 逻辑，保持不变。

- [ ] **步骤 2: 验证**

构建站点，检查 `_site/search.json` 文件大小对比。浏览器中搜索已知关键词（如 "GDAL"、"GeoServer"），确认搜索结果正常。

- [ ] **步骤 3: 提交**

```bash
git add search.json
git commit -m "perf: use description instead of full content in search index"
```

---

### 任务 7: 修复 about.md 中的链接

**文件:**
- 修改: `about.md`

- [ ] **步骤 1: 修复所有学习路线链接**

使用全局替换，将 `about.md` 中所有 `https://znlgis.github.io/about/` 前缀替换为空。具体替换：

| 行号 | 旧链接前缀 | 新链接 |
|------|-----------|--------|
| 84 | `https://znlgis.github.io/about/gis/basic/` | `/gis/basic/` |
| 85 | `https://znlgis.github.io/about/gis/tutorial/qgis/` | `/gis/tutorial/qgis/` |
| 86 | `https://znlgis.github.io/about/gis/tutorial/gdal/` | `/gis/tutorial/gdal/` |
| 87 | `https://znlgis.github.io/about/gis/tutorial/postgis/` | `/gis/tutorial/postgis/` |
| 88 | `https://znlgis.github.io/about/gis/tutorial/geoserver/` | `/gis/tutorial/geoserver/` |
| 89 | `https://znlgis.github.io/about/gis/tutorial/openlayers/` | `/gis/tutorial/openlayers/` |
| 92 | `https://znlgis.github.io/about/gis/tutorial/NetTopologySuite/` | `/gis/tutorial/NetTopologySuite/` |
| 93 | `https://znlgis.github.io/about/gis/tutorial/gdal/` | `/gis/tutorial/gdal/` |
| 94 | `https://znlgis.github.io/about/gis/tutorial/SharpMap/` | `/gis/tutorial/SharpMap/` |
| 94 | `https://znlgis.github.io/about/gis/tutorial/Mapsui/` | `/gis/tutorial/Mapsui/` |
| 95 | `https://znlgis.github.io/about/gis/tutorial/opengis-utils-for-net/` | `/gis/tutorial/opengis-utils-for-net/` |
| 98 | `https://znlgis.github.io/about/cad/FreeCAD/` | `/cad/FreeCAD/` |
| 99 | `https://znlgis.github.io/about/cad/occt/` | `/cad/occt/` |
| 100 | `https://znlgis.github.io/about/cad/cadquery/` | `/cad/cadquery/` |
| 101 | `https://znlgis.github.io/about/cad/KiCad/` | `/cad/KiCad/` |
| 101 | `https://znlgis.github.io/about/cad/Xbim/` | `/cad/Xbim/` |
| 104 | `https://znlgis.github.io/about/ai/dify/` | `/ai/dify/` |
| 105 | `https://znlgis.github.io/about/ai/openclaw/` | `/ai/openclaw/` |
| 106 | `https://znlgis.github.io/about/ai/superpowers-zh/` | `/ai/superpowers-zh/` |

最简方式：执行全局替换 `https://znlgis.github.io/about/` → `/`（`about.md` 中所有实例）。

- [ ] **步骤 2: 验证**

构建站点，点击 about 页学习路线中的每个链接，确认跳转到正确页面。

- [ ] **步骤 3: 提交**

```bash
git add about.md
git commit -m "fix: broken learning path links in about.md"
```

---

### 任务 8: 端到端验证

- [ ] **步骤 1: 本地构建**

```bash
bundle exec jekyll build
```
确认构建无错误。

- [ ] **步骤 2: 检查关键页面**

1. 首页 → 卡片布局 + 分类列表动态渲染
2. 任意教程页 → CSS 样式正常，代码高亮正常，侧边栏正常，搜索正常
3. About 页 → 学习路线链接正确
4. 404 页 → 正常显示
5. 移动端（浏览器 DevTools 模拟 375px 宽度）→ 汉堡菜单、侧边栏覆盖正常

- [ ] **步骤 3: 检查关键功能**

- 侧边栏目录树折叠/展开
- 搜索输入 → 结果显示
- 键盘导航搜索（上下键 + Enter）
- 回到顶部按钮
- 面包屑导航
- 当前页在目录树中高亮
- 表格在窄屏下横向滚动

- [ ] **步骤 4: 最终提交**

```bash
git status
git log --oneline -10
```
确认所有更改已提交且提交历史干净。

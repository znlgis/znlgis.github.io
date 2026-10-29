# 编写约定

本仓库是 Jekyll 静态站点，所有教程都是仓库里的 Markdown 文件。UI 的样式与交互由
`_layouts/`、`_includes/`、`assets/css/main.css`、`assets/js/main.js` 统一提供，
**内容文件只负责结构，不负责样式**。

新增教程时按下面的约定写，CI 会检查（见文末）。违反约定的提交会被拦下。

---

## 一、章节页（非 index.md 的教程文件）

### 1. Front matter

```yaml
---
layout: default
title: 第01章 - OpenLayers 概述与入门
---
```

`title` 会用于 `<title>`、面包屑末端和浏览器标签，必须写。

### 2. 开头写 H1，且只写一个

正文第一行是 `# 标题`，与 front matter 的 `title` 保持一致。

### 3. Footer 导航：用 `.chapter-nav` 组件，不要手写内联样式

每章末尾放一个章节导航，**HTML 固定写成这样**（放在最后一个 `---` 分隔线之后）：

```html
---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/系列目录/第01章-xxx/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/系列目录/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/系列目录/第03章-xxx/" class="chapter-nav__next">下一章 →</a>
</div>
```

- 第一个 `__prev`、最后一个 `__next`、中间的 `__dir` 指向系列目录。
- 首章没有上一章时，省略 `__prev` 那个 `<a>`；末章同理省略 `__next`。
- **不要**写 `style="..."`、不要用 `<span>` 占位、不要用 `**上一章**: [标题](url)` 这类手写形式。
  这些写法曾经存在，已在统一改造中清理，加回来会造成风格回退。

### 4. 章节链接一律用完整域名

正文与导航里的站内链接写成 `https://znlgis.github.io/...`（便于第三方转载时可用），
不要写成 `/xxx/` 相对路径。CI 会校验这些链接确实指向存在的页面。

---

## 二、系列索引页（目录下的 index.md）

```markdown
---
layout: default
title: OpenLayers 教程目录
---

# OpenLayers 教程目录

一句话简介。

## 教程目录

- [第01章 - OpenLayers 概述与入门](https://znlgis.github.io/gis/tutorial/openlayers/第01章-OpenLayers概述与入门/)
- [第02章 - 环境搭建与快速开始](https://znlgis.github.io/gis/tutorial/openlayers/第02章-环境搭建与快速开始/)

---

共 18 章
```

索引页的章节清单用**平铺的无序列表**，每项一个绝对链接即可，
样式（带序号的卡片网格）由 `.is-index` 作用域的 CSS 提供，不需要你写 class。

栏目级索引页（如 `gis/index.md`、`cad/index.md`）允许使用表格列出系列总览，
表格同样由全局样式接管。

---

## 三、不要做的事

| 不要 | 为什么 |
|---|---|
| 在正文里写 `<style>` 或 `style="..."` | 样式集中在 `main.css`，内联样式会与主题（含深色模式）冲突 |
| 在正文里写 `<script>` | 交互集中在 `main.js` |
| 手写 `<div style="display:flex...">` 导航条 | 用 `.chapter-nav` 组件 |
| 写死颜色值（`#fff`、`rgba(...)`） | 用 `var(--token)`，深色模式才跟得上 |
| 用相对路径写站内链接 | 第三方转载会失效 |
| 在标题里塞 HTML | 标题会进面包屑与目录，HTML 会原样显示 |

---

## 四、接入侧边栏

新系列要出现在左侧目录树，需在 `_data/navigation.yml` 对应栏目下加一条：

```yaml
    - title: OpenLayers
      icon: 📁
      url: /gis/tutorial/openlayers/
```

顶层栏目有稳定的 `id`（如 `gis`、`cad`），首页卡片的锚点由它派生，**不要改动已有 `id`**。

---

## 五、本地校验

```bash
node scripts/check-style-consistency.js   # 新增/修改内容的风格不变量
node scripts/check-internal-links.js      # 站内链接是否都指向存在的页面
```

两者都会在 CI 的 `Jekyll Build & Verify` 里执行，任何一项失败都会让 PR 变红。

## 六、批量新增系列

一次性加一整个系列（十几到几十章）时，用脚手架生成骨架，避免逐个手写出错：

```bash
node scripts/new-tutorial.js --dir gis/tutorial/openlayers --title "OpenLayers" --chapters 18
```

脚本会建好 `index.md`、各章 `front matter + H1 + 章节导航` 骨架，并把系列登记到 `_data/navigation.yml`。
之后往每章里填正文即可。

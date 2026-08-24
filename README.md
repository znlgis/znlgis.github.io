# znlgis 博客

GIS 开发与技术分享博客，涵盖 GIS、CAD、C#、3D、AI 等领域，共 **80 个教程系列、1198+ 篇文章**。

在线访问：[https://znlgis.github.io](https://znlgis.github.io)

## 📚 内容概览

| 分类 | 系列数 | 文章数 | 代表教程 |
|------|--------|--------|----------|
| 🌍 GIS 教程 | 19 | 230+ | GDAL · GeoServer · PostGIS · QGIS · OpenLayers · CesiumJS |
| 📖 GIS 基础 | 4 | — | 数据格式 · 地图服务 · 开发环境 · 开发技巧 |
| 📐 CAD 开发 | 19 | 278 | FreeCAD · OCCT · KiCad · OpenSCAD · CadQuery · Xbim |
| 🧊 3D 开发 | 5 | 66 | SuperSplat · Ara3D-SDK · Photo-Sphere-Viewer · Elements |
| 💻 C# 开发 | 8 | 135 | Admin.NET · Furion · NPOI · ReoGrid · SqlSugar |
| 🤖 AI 系列 | 11 | 141 | Dify · OpenClaw · DeepSeek Harness · OpenCode · OpenGIS-Skills |
| 🔌 IoT 物联网 | 1 | 27 | KE3036-Keyes-Pico (Raspberry Pi Pico) |
| 📖 源码解读 | 2 | 43 | Clipper2 · Clipper1 |
| 📦 其他教程 | 6 | 94 | acme.sh · BillionMail · Go 语言 · RobotGo |
| 🎯 项目演示 | 4 | 33 | Vue3+OpenLayers · Vue3 地图大屏 · AI 智慧水务 |

## ✨ 博客特性

- 🌓 **深色/浅色模式** — 一键切换，支持跟随系统偏好
- 🔍 **客户端即时搜索** — 无需服务端，支持模糊匹配与键盘导航
- 📑 **侧边栏目录树** — 分类折叠展开，当前页面自动高亮
- 📖 **文章目录同步** — 滚动时自动高亮当前章节（IntersectionObserver）
- 📋 **代码块复制** — 一键复制，支持 Rouge 语法高亮（GitHub 风格）
- 📱 **响应式布局** — 桌面侧边栏 + 移动端抽屉导航
- ♿ **无障碍** — skip-link、ARIA 标签、键盘导航、prefers-reduced-motion 适配
- 🔗 **SEO 优化** — jekyll-seo-tag · jekyll-sitemap · jekyll-feed

## 🔗 链接

- **QQ群**: `289280914`
- **B站**: [znlgis的空间](https://space.bilibili.com/161342702)
- **博客园**: [znlgis](https://www.cnblogs.com/znlgis)
- **GitHub**: [znlgis](https://github.com/znlgis)
- **Gitee**: [znlgis](https://gitee.com/znlgis)

## 🛠️ 技术栈

- [Jekyll](https://jekyllrb.com/) — 静态网站生成器
- [GitHub Pages](https://pages.github.com/) — 托管服务
- [Rouge](https://github.com/rouge-ruby/rouge) — 代码语法高亮
- [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC) — 中文字体
- [不蒜子](https://busuanzi.ibruce.info/) — 访客统计

### Jekyll 插件

- `jekyll-feed` — RSS 订阅
- `jekyll-seo-tag` — SEO 元标签
- `jekyll-sitemap` — 站点地图

## 🚧 本地开发

### 环境要求

- Ruby 2.7+
- Bundler

### 启动步骤

```bash
# 安装依赖
bundle install

# 本地预览（默认 http://127.0.0.1:4000）
bundle exec jekyll serve

# 仅构建校验（不启动服务器）
bundle exec jekyll build
```

### 目录结构

```
├── _config.yml          # 站点配置
├── _data/navigation.yml # 侧边栏导航树
├── _layouts/            # 页面布局模板
├── _includes/           # 可复用组件（侧边栏等）
├── assets/
│   ├── css/main.css     # 主样式（含暗黑模式）
│   ├── js/main.js       # 主脚本（搜索/TOC/主题切换）
│   └── logo.png         # 站点图标
├── gis/                 # GIS 教程与基础
├── cad/                 # CAD 开发教程
├── csharp/              # C# 开发教程
├── 3d/                  # 3D 开发教程
├── ai/                  # AI 系列教程
├── iot/                 # IoT 物联网
├── sci/                 # 源码解读
├── others/              # 其他教程
├── demos/               # 项目演示
├── index.html           # 首页
├── about.md             # 关于页
├── 404.md               # 404 页面
└── search.json          # 搜索索引数据
```

## 🔗 关于内部链接

`.md` 文件中的内部链接使用完整的 `https://znlgis.github.io/...` URL，而非相对路径（如 `/gis/tutorial/gdal/`）。原因是当文章被第三方网站转载、引用或在 GitHub/Gitee 等平台浏览时，相对路径无法正确解析，读者会遇到 404。使用完整 URL 可以确保无论在哪个平台引用，链接都能直接跳转到对应页面。

## 📄 许可证

[MIT License](LICENSE)

# 快速开始指南

这是一个快速参考指南，帮助您开始使用本博客。

## 🚀 5分钟快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/znlgis/znlgis.github.io.git
cd znlgis.github.io
```

### 2. 安装依赖

```bash
# 安装 Bundler（如果还没有）
gem install bundler

# 安装 Jekyll 和插件
bundle install
```

### 3. 启动本地服务器

```bash
bundle exec jekyll serve --livereload
```

### 4. 访问网站

打开浏览器访问: [http://localhost:4000](http://localhost:4000)

## ✍️ 创建新文章

### 最简单的方式

1. 在相应目录创建 `.md` 文件
2. 写入内容，第一行必须是 H1 标题（`#`）
3. 保存文件

示例 `gis/tutorial/my-article.md`:

```markdown
# 我的 GIS 教程

这是文章内容...

## 第一节

内容...
```

### 带 Front Matter 的方式

```markdown
---
layout: post
title: 我的 GIS 教程
category: gis-tutorial
tags: [GIS, 教程]
---

# 我的 GIS 教程

这是文章内容...
```

## 📁 目录结构参考

```
内容目录/
├── gis/
│   ├── tutorial/        # GIS 教程
│   └── basic/           # GIS 基础
├── csharp/              # C# 开发
├── ai/                  # AI 系列
├── demos/               # 项目演示
└── others/              # 其他教程
```

## 🎨 Markdown 技巧

### 代码高亮

````markdown
```python
def hello():
    print("Hello, World!")
```
````

### 表格

```markdown
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 值1 | 值2 | 值3 |
```

### 图片

```markdown
![图片描述](img/example.png)
```

### 提示框（需要 CSS 类）

```html
<div class="note">
这是一个提示框
</div>

<div class="warning">
这是一个警告框
</div>

<div class="tip">
这是一个技巧提示框
</div>
```

## 🔧 常用命令

```bash
# 构建网站
bundle exec jekyll build

# 启动服务器
bundle exec jekyll serve

# 启动服务器并自动重载
bundle exec jekyll serve --livereload

# 包含草稿
bundle exec jekyll serve --drafts

# 清理生成的文件
bundle exec jekyll clean

# 更新依赖
bundle update
```

## 📝 Git 工作流

### 创建新内容

```bash
# 1. 创建或编辑文件
vim gis/tutorial/my-new-article.md

# 2. 添加到 Git
git add .

# 3. 提交更改
git commit -m "添加新文章：我的新教程"

# 4. 推送到 GitHub
git push origin main
```

### 查看更改

```bash
# 查看状态
git status

# 查看差异
git diff

# 查看历史
git log --oneline
```

## 🎯 内容类别映射

文章会根据所在目录自动分配类别（在 `_config.yml` 中配置）：

| 目录路径 | 自动类别 |
|---------|---------|
| `gis/tutorial/` | gis-tutorial |
| `gis/basic/` | gis-basic |
| `csharp/` | csharp |
| `ai/` | ai |
| `demos/` | demos |
| `others/` | others |

## 🌟 特色功能

### 自动功能

- ✅ 自动提取页面标题（从第一个 H1）
- ✅ 自动生成目录（3个以上标题时）
- ✅ 自动添加面包屑导航
- ✅ 代码块复制按钮
- ✅ 返回顶部按钮
- ✅ 外部链接自动在新标签打开

### SEO 优化

- ✅ 自动生成 sitemap.xml
- ✅ 自动生成 robots.txt
- ✅ RSS/Atom feed
- ✅ SEO 元标签

## 📚 更多文档

- [README.md](README.md) - 完整的项目文档
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南
- [FRONT_MATTER.md](FRONT_MATTER.md) - Front Matter 详细说明

## 🆘 常见问题

### Jekyll 构建失败？

1. 检查 Ruby 版本: `ruby --version` (需要 >= 2.7)
2. 重新安装依赖: `bundle install`
3. 清理缓存: `bundle exec jekyll clean`

### 页面没有显示？

1. 确保文件是 `.md` 格式
2. 确保第一行是 H1 标题（`#`）
3. 检查文件编码是 UTF-8

### 样式不正确？

1. 检查浏览器控制台错误
2. 清除浏览器缓存
3. 重启 Jekyll 服务器

### 图片不显示？

1. 检查图片路径是否正确
2. 使用相对路径：`img/example.png`
3. 确保图片文件存在

## 💡 小技巧

1. **使用 LiveReload**: 添加 `--livereload` 参数，保存文件自动刷新浏览器
2. **草稿功能**: 在 `_drafts/` 目录中写草稿，用 `--drafts` 参数预览
3. **环境变量**: 设置 `JEKYLL_ENV=production` 启用生产模式优化
4. **增量构建**: 使用 `--incremental` 加快重新构建速度
5. **查看配置**: 运行 `bundle exec jekyll doctor` 检查配置问题

## 📞 获取帮助

- 加入 QQ 群: `289280914`
- 查看 [Jekyll 官方文档](https://jekyllrb.com/docs/)
- 在 [GitHub Issues](https://github.com/znlgis/znlgis.github.io/issues) 提问
- 观看 [B站视频教程](https://space.bilibili.com/161342702)

---

**祝您使用愉快！** 🎉

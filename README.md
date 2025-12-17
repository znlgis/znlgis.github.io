# znlgis 博客

一个极简风格的 GitHub Pages 个人博客，分享 GIS 开发与技术内容。

## 🔗 链接

- **网站**: [https://znlgis.github.io](https://znlgis.github.io)
- **QQ群**: `289280914`
- **B站**: [znlgis的空间](https://space.bilibili.com/161342702)
- **博客园**: [znlgis](https://www.cnblogs.com/znlgis)
- **GitHub**: [znlgis](https://github.com/znlgis)
- **Gitee**: [znlgis](https://gitee.com/znlgis)

## 🛠️ 技术栈

- [Jekyll](https://jekyllrb.com/) ~4.3.0 - 静态网站生成器
- [GitHub Pages](https://pages.github.com/) - 托管服务
- [kramdown](https://kramdown.gettalong.org/) - Markdown 解析器
- [Rouge](https://github.com/rouge-ruby/rouge) - 语法高亮

## 📁 目录结构

```
.
├── _config.yml           # Jekyll 配置文件
├── _layouts/             # 布局模板
│   ├── default.html      # 默认布局
│   └── post.html         # 文章布局
├── assets/               # 静态资源
│   ├── css/              # 样式文件
│   ├── js/               # JavaScript 文件
│   └── images/           # 图片资源
├── ai/                   # AI 系列教程
├── csharp/               # C# 开发教程
├── demos/                # 项目演示
├── gis/                  # GIS 教程
│   ├── basic/            # GIS 基础
│   └── tutorial/         # GIS 教程
├── others/               # 其他教程
├── index.md              # 首页
├── about.md              # 关于页面
└── 404.md                # 404 页面
```

## 🚀 本地开发

### 环境要求

- Ruby >= 2.7.0
- RubyGems
- GCC 和 Make

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/znlgis/znlgis.github.io.git
cd znlgis.github.io
```

2. **安装依赖**

```bash
# 安装 Bundler
gem install bundler

# 安装 Jekyll 和其他依赖
bundle install
```

3. **启动本地服务器**

```bash
bundle exec jekyll serve
```

或者使用实时重载：

```bash
bundle exec jekyll serve --livereload
```

4. **访问网站**

打开浏览器访问 [http://localhost:4000](http://localhost:4000)

### 常用命令

```bash
# 构建网站
bundle exec jekyll build

# 启动服务器（带草稿）
bundle exec jekyll serve --drafts

# 清理生成的文件
bundle exec jekyll clean

# 更新依赖
bundle update
```

## ✍️ 内容编写

### 创建新文章

在相应的目录下创建 Markdown 文件，文件名使用有意义的名称。

#### 可选的 Front Matter

Jekyll 插件会自动从第一个标题提取页面标题，因此 front matter 是可选的。但如果需要自定义，可以添加：

```yaml
---
layout: default
title: 自定义标题
date: 2024-01-01
category: gis-tutorial
tags: [GIS, GeoServer]
---
```

### Markdown 语法

支持标准 Markdown 语法以及 GFM（GitHub Flavored Markdown）扩展：

- 表格
- 任务列表
- 删除线
- 代码高亮

示例：

````markdown
# 一级标题

## 二级标题

这是一段文字，包含**粗体**和*斜体*。

### 代码块

```python
def hello_world():
    print("Hello, World!")
```

### 表格

| 列1 | 列2 |
|-----|-----|
| 值1 | 值2 |
````

## 📝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📄 许可证

本项目采用 Apache License 2.0 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 感谢所有贡献者
- 感谢开源社区

## 📮 联系方式

- **QQ群**: `289280914`
- **B站**: [znlgis的空间](https://space.bilibili.com/161342702)
- **博客园**: [znlgis](https://www.cnblogs.com/znlgis)
- **GitHub**: [znlgis](https://github.com/znlgis)

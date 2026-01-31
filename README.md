# znlgis 博客

一个极简风格的 GitHub Pages 个人博客，分享 GIS 开发与技术内容。

## 🔗 链接

- **QQ群**: `289280914`
- **B站**: [znlgis的空间](https://space.bilibili.com/161342702)
- **博客园**: [znlgis](https://www.cnblogs.com/znlgis)
- **GitHub**: [znlgis](https://github.com/znlgis)
- **Gitee**: [znlgis](https://gitee.com/znlgis)

## 🛠️ 技术栈

- [Jekyll](https://jekyllrb.com/) - 静态网站生成器
- [Jekyll Theme Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) - 主题
- [GitHub Pages](https://pages.github.com/) - 托管服务

## ⚙️ GitHub Pages 配置

由于本博客使用 `jekyll-theme-chirpy` 主题（该主题不在 GitHub Pages 默认支持列表中），需要按以下步骤配置：

1. 进入仓库 **Settings** → **Pages**
2. 在 **Build and deployment** 部分，将 **Source** 改为 **GitHub Actions**
3. 保存后，GitHub 将使用自定义工作流 (`.github/workflows/pages-deploy.yml`) 构建和部署网站

> ⚠️ 如果使用默认的 "Deploy from a branch" 选项，会出现 `The jekyll-theme-chirpy theme could not be found` 错误。

# 更新日志

本文档记录项目的主要更新和变更。

## [2024-12-17] - 博客系统全面优化

### 新增功能

#### 核心配置
- ✅ 添加 `Gemfile` 进行 Jekyll 依赖管理
- ✅ 增强 `_config.yml` 配置，添加多个实用插件
- ✅ 配置 Jekyll 插件生态系统
  - jekyll-feed (RSS/Atom)
  - jekyll-seo-tag (SEO 优化)
  - jekyll-sitemap (站点地图)
  - jekyll-optional-front-matter (可选 Front Matter)
  - jekyll-titles-from-headings (自动提取标题)
  - jekyll-relative-links (相对链接转换)

#### 布局和样式
- ✅ 优化 `default.html` 布局
  - 集成 SEO 标签
  - 添加面包屑导航
  - 响应式设计改进
- ✅ 增强 `post.html` 布局
  - 显示发布日期
  - 显示文章分类
  - 显示文章标签
  - 显示作者信息
- ✅ 创建 `assets/css/custom.css` 自定义样式
  - 改进的代码块样式
  - 优化的表格样式
  - 图片居中和阴影
  - 提示框样式（note, warning, tip）
  - 标签样式
  - 打印友好样式

#### 交互功能
- ✅ 创建 `assets/js/main.js` 交互脚本
  - 返回顶部按钮（滚动时自动显示）
  - 代码块复制功能（一键复制）
  - 外部链接新标签打开（安全性增强）
  - 自动生成目录（3个以上标题时）

#### SEO 和性能
- ✅ 添加 `robots.txt` 文件
- ✅ 自动生成 `sitemap.xml`
- ✅ 添加 RSS/Atom feed
- ✅ SEO 元标签优化
- ✅ 社交媒体卡片支持

#### CI/CD
- ✅ 创建 `.github/workflows/jekyll.yml`
  - 自动构建 Jekyll 站点
  - 自动部署到 GitHub Pages
  - Ruby 版本固定（3.2.0）
  - 依赖缓存优化

#### 文档
- ✅ 更新 `README.md` - 完整的项目文档
- ✅ 创建 `CONTRIBUTING.md` - 贡献指南
- ✅ 创建 `FRONT_MATTER.md` - Front Matter 使用说明
- ✅ 创建 `QUICK_START.md` - 快速入门指南
- ✅ 创建 `CHANGELOG.md` - 更新日志
- ✅ 更新 `about.md` - 关于页面增强

#### 内容示例
- ✅ 创建 `_posts/2024-01-01-welcome.md` 示例文章
- ✅ 创建 `404.md` 自定义 404 页面

### 改进

#### 配置优化
- 📝 设置语言为 zh-CN
- 📝 设置时区为 Asia/Shanghai
- 📝 配置 Kramdown 使用 GFM (GitHub Flavored Markdown)
- 📝 为不同目录配置自动类别
- 📝 优化排除文件列表

#### 用户体验
- 📝 添加面包屑导航显示当前位置
- 📝 代码块添加复制按钮
- 📝 滚动时显示返回顶部按钮
- 📝 自动生成文章目录
- 📝 外部链接自动在新标签打开

#### 开发体验
- 📝 Front Matter 变为可选
- 📝 自动从 H1 标题提取页面标题
- 📝 相对链接自动转换
- 📝 完善的文档和示例

### 修复

- 🐛 移除 _config.yml 中的占位符 email
- 🐛 JavaScript URL 解析添加错误处理
- 🐛 TOC 生成阈值改为可配置
- 🐛 打印样式隐藏复制按钮
- 🐛 robots.txt 优化，允许图片索引
- 🐛 GitHub Actions 固定 Ruby 版本

### 安全性

- 🔒 CodeQL 安全扫描通过
- 🔒 外部链接添加 rel="noopener noreferrer"
- 🔒 JavaScript 错误处理增强

### 兼容性

#### 完全向后兼容
- ✅ 所有现有 Markdown 文件无需修改
- ✅ Front Matter 是完全可选的
- ✅ 自动提取标题功能
- ✅ 相对链接自动转换

#### 浏览器支持
- ✅ 现代浏览器（Chrome, Firefox, Safari, Edge）
- ✅ 移动浏览器优化
- ✅ 响应式设计

### 技术栈

```yaml
核心:
  - Jekyll: 4.3.0
  - Ruby: 3.2.0
  - Kramdown: GFM
  - Rouge: 语法高亮

插件:
  - jekyll-feed: RSS/Atom
  - jekyll-seo-tag: SEO
  - jekyll-sitemap: 站点地图
  - jekyll-optional-front-matter: 可选 Front Matter
  - jekyll-titles-from-headings: 自动标题
  - jekyll-relative-links: 链接转换

部署:
  - GitHub Pages
  - GitHub Actions
```

### 文件变更统计

```
新增文件:
- Gemfile
- .github/workflows/jekyll.yml
- assets/css/custom.css
- assets/js/main.js
- robots.txt
- 404.md
- CONTRIBUTING.md
- FRONT_MATTER.md
- QUICK_START.md
- CHANGELOG.md
- _posts/2024-01-01-welcome.md

修改文件:
- _config.yml
- _layouts/default.html
- _layouts/post.html
- README.md
- about.md
- .gitignore (已存在 Jekyll 相关规则)

目录结构:
+ assets/
  + css/
  + js/
  + images/
+ _posts/
+ .github/
  + workflows/
```

### 下一步计划

#### 功能增强
- [ ] 添加搜索功能
- [ ] 添加评论系统
- [ ] 添加文章归档页面
- [ ] 添加标签云
- [ ] 添加分类页面

#### 内容丰富
- [ ] 添加更多示例文章
- [ ] 完善各系列教程
- [ ] 添加图片和图表

#### 性能优化
- [ ] 图片懒加载
- [ ] CSS/JS 压缩
- [ ] 静态资源 CDN

### 迁移指南

如果您是从旧版本升级，请按照以下步骤操作：

1. **备份现有文件**
   ```bash
   git checkout -b backup-$(date +%Y%m%d)
   git push origin backup-$(date +%Y%m%d)
   ```

2. **拉取更新**
   ```bash
   git pull origin main
   ```

3. **安装依赖**
   ```bash
   bundle install
   ```

4. **本地测试**
   ```bash
   bundle exec jekyll serve --livereload
   ```

5. **验证功能**
   - 检查页面是否正常显示
   - 测试面包屑导航
   - 测试代码复制功能
   - 测试返回顶部按钮
   - 检查移动端响应

6. **部署**
   - 推送到 main 分支
   - GitHub Actions 自动构建和部署

### 已知问题

目前没有已知问题。

如果您发现任何问题，请：
1. 查看 [Issues](https://github.com/znlgis/znlgis.github.io/issues)
2. 提交新的 Issue
3. 加入 QQ 群 `289280914` 讨论

### 致谢

感谢所有贡献者和社区成员的支持！

### 更多信息

- [快速入门指南](QUICK_START.md)
- [贡献指南](CONTRIBUTING.md)
- [Front Matter 说明](FRONT_MATTER.md)
- [完整文档](README.md)

---

**更新时间**: 2024-12-17  
**版本**: 2.0.0  
**维护者**: znlgis

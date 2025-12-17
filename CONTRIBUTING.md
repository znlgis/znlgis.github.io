# 贡献指南

感谢您考虑为 znlgis 博客做出贡献！

## 如何贡献

### 报告问题

如果您发现了问题或有改进建议，请：

1. 检查 [Issues](https://github.com/znlgis/znlgis.github.io/issues) 中是否已有相同问题
2. 如果没有，创建一个新的 Issue
3. 提供详细的描述和复现步骤

### 提交内容

#### 文章格式规范

1. **文件命名**
   - 使用有意义的中文或英文名称
   - 如果是系列文章，使用编号前缀，如：`01-概述与入门.md`
   - 避免使用特殊字符

2. **Markdown 格式**
   - 使用标准 Markdown 语法
   - 代码块要指定语言以启用语法高亮
   - 图片放在相应目录的 `img/` 子目录下

3. **Front Matter（可选）**
   
   虽然 Jekyll 插件会自动提取标题，但您也可以手动添加 front matter：

   ```yaml
   ---
   layout: default
   title: 文章标题
   date: 2024-01-01
   category: gis-tutorial
   tags: [GIS, 教程]
   description: 文章简短描述
   ---
   ```

4. **内容结构**
   - 使用清晰的标题层级（H1, H2, H3...）
   - 第一个标题应该是 H1（`#`）
   - 包含目录（可选）
   - 代码示例应该完整且可运行

#### 代码示例格式

```markdown
### 示例标题

```python
# 完整的代码示例
def example_function():
    """函数说明"""
    return "Hello, World!"

# 调用示例
result = example_function()
print(result)
\```
```

### Pull Request 流程

1. **Fork 仓库**
   
   点击右上角的 Fork 按钮

2. **克隆您的 Fork**
   
   ```bash
   git clone https://github.com/YOUR_USERNAME/znlgis.github.io.git
   cd znlgis.github.io
   ```

3. **创建分支**
   
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **进行更改**
   
   - 添加或修改文件
   - 在本地测试：`bundle exec jekyll serve`
   - 确保链接正常工作

5. **提交更改**
   
   ```bash
   git add .
   git commit -m "描述您的更改"
   ```

6. **推送到 GitHub**
   
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   
   - 访问您的 Fork 页面
   - 点击 "New Pull Request"
   - 填写 PR 描述
   - 提交 PR

### Pull Request 检查清单

在提交 PR 之前，请确保：

- [ ] 代码/内容格式正确
- [ ] 在本地测试过（`bundle exec jekyll serve`）
- [ ] 所有链接都能正常工作
- [ ] 图片路径正确
- [ ] 代码块指定了语言
- [ ] 没有拼写错误
- [ ] 提交信息清晰明了

## 目录组织规范

### GIS 教程
- **路径**: `gis/tutorial/`
- **子目录**: 按具体技术或工具分类
- **示例**: `gis/tutorial/geoserver/01-概述与入门.md`

### GIS 基础
- **路径**: `gis/basic/`
- **子目录**: 按主题分类（data, services, env, dev）
- **示例**: `gis/basic/data/Shapefile代码示例.md`

### C# 开发
- **路径**: `csharp/`
- **子目录**: 按框架或库分类
- **示例**: `csharp/Admin.NET/第一章-概述.md`

### AI 系列
- **路径**: `ai/`
- **子目录**: 按平台或工具分类
- **示例**: `ai/dify/01-平台简介.md`

### 项目演示
- **路径**: `demos/`
- **子目录**: 按项目分类
- **示例**: `demos/vue3+openlayers/环境搭建.md`

### 其他教程
- **路径**: `others/`
- **子目录**: 按工具或平台分类
- **示例**: `others/chili3d/01-概述与入门.md`

## 样式指南

### 中文写作规范

1. **标点符号**
   - 使用中文标点符号（，。？！）
   - 英文、数字与中文之间要有空格
   - 示例：`GIS 开发`，而不是 `GIS开发`

2. **专有名词**
   - 保持专有名词的正确大小写
   - 示例：`GeoServer`、`PostgreSQL`、`JavaScript`

3. **代码和命令**
   - 使用反引号包裹：`git commit`
   - 代码块使用三个反引号

### 图片使用

1. 图片放在相应目录的 `img/` 子目录下
2. 使用相对路径引用：`![描述](img/example.png)`
3. 图片文件名使用英文
4. 添加有意义的 alt 文本

## 代码审查标准

您的贡献将被审查，我们关注：

- **正确性**: 内容是否准确
- **清晰度**: 是否易于理解
- **完整性**: 示例是否完整可运行
- **格式**: 是否符合规范
- **价值**: 是否对读者有价值

## 行为准则

- 尊重所有贡献者
- 接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

## 问题？

如果您有任何问题，请：

1. 查看 [README.md](README.md)
2. 在 [Issues](https://github.com/znlgis/znlgis.github.io/issues) 中搜索
3. 加入 QQ 群：`289280914`
4. 在 B站 留言：[znlgis的空间](https://space.bilibili.com/161342702)

感谢您的贡献！🎉

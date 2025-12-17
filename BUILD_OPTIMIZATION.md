# Jekyll 构建优化说明

## 问题分析

### 症状
Jekyll 构建日志在渲染过程中被截断，显示大量调试信息：
- 日志级别为 `debug`，产生大量输出
- 190+ markdown 文件需要处理
- 日志可能超过 GitHub Actions 的输出限制

### 根本原因
1. **详细日志记录**: GitHub Pages 使用 debug 级别日志构建，产生详细的渲染信息
2. **文件数量多**: 仓库包含 190 个 markdown 文件，每个文件都会生成多行日志
3. **日志截断**: GitHub Actions 日志输出可能达到大小限制而被截断

## 解决方案

### 1. 配置优化

在 `_config.yml` 中添加以下配置：

```yaml
# 构建优化
incremental: true  # 启用增量构建，加快后续构建速度
quiet: true        # 减少日志输出（GitHub Pages 可能会覆盖）

# Kramdown 配置
kramdown:
  input: GFM                    # 使用 GitHub Flavored Markdown
  syntax_highlighter: rouge     # 使用 Rouge 语法高亮
  syntax_highlighter_opts:
    block:
      line_numbers: false       # 禁用行号以减少处理时间

# 性能优化
# Note: safe mode is enabled by default on GitHub Pages (disables custom plugins)
# For local development with custom plugins, use: safe: false
# safe: false      # Uncomment and set to false for local development with custom plugins
profile: false     # 禁用性能分析
lsi: false         # 禁用相关文章索引（耗时操作）
```

### 2. 排除不必要的文件

```yaml
exclude:
  - README.md
  - LICENSE
  - .gitignore
  - gis/basic/pom
  - vendor
  - .bundle
  - Gemfile
  - Gemfile.lock
  - node_modules
  - package.json
  - package-lock.json
```

### 3. 关键优化项说明

| 配置项 | 作用 | 效果 |
|--------|------|------|
| `incremental: true` | 启用增量构建 | 只重新构建更改的文件 |
| `quiet: true` | 减少日志输出 | 降低日志大小（GitHub Pages 可能覆盖）|
| `lsi: false` | 禁用潜在语义索引 | 加快构建速度 |
| `profile: false` | 禁用性能分析 | 减少额外开销 |
| 扩展 `exclude` 列表 | 跳过不需要的文件 | 减少处理文件数 |

**注意:** `safe: true` 在 GitHub Pages 上默认启用，无需显式配置。本地开发时可能需要设置为 `false` 以使用自定义插件。

## 预期效果

1. **构建速度提升**: 增量构建可以显著加快重复构建速度
2. **日志大小减少**: quiet 模式会减少输出信息
3. **资源使用优化**: 禁用不必要的功能减少内存和 CPU 使用

## 注意事项

### GitHub Pages vs 本地构建

某些配置在 GitHub Pages 和本地构建中表现不同：

| 配置项 | 本地构建 | GitHub Pages |
|--------|---------|-------------|
| `quiet: true` | ✅ 有效 | ⚠️ 可能被覆盖 |
| `incremental: true` | ✅ 有效 | ✅ 有效 |
| `safe: true` | ✅ 有效 | ℹ️ 默认启用 |
| Kramdown 配置 | ✅ 完全控制 | ✅ 大部分有效 |
| `lsi: false` | ✅ 有效 | ✅ 有效 |

### 其他注意事项

1. **首次构建**: 增量构建在首次构建时不会有速度提升
2. **日志级别**: GitHub Pages 的日志级别由平台控制，用户无法直接修改
3. **插件限制**: GitHub Pages 只支持[有限的插件列表](https://pages.github.com/versions/)

## 验证方法

1. 提交更改到仓库
2. 观察 GitHub Actions 构建日志
3. 检查构建时间是否缩短
4. 确认网站能够正常生成和访问

## 进一步优化建议

如果问题持续存在，可以考虑：

1. **分页**: 如果有大量文章列表，考虑添加分页
2. **目录结构**: 优化目录结构，减少深度嵌套
3. **缓存**: 利用 GitHub Actions 的缓存机制
4. **自定义工作流**: 如果需要更多控制，可以使用自定义 GitHub Actions 工作流替代默认的 GitHub Pages 构建

## 相关链接

- [Jekyll Configuration](https://jekyllrb.com/docs/configuration/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Jekyll Build Performance](https://jekyllrb.com/docs/configuration/incremental-regeneration/)

# Front Matter 使用指南

本文档说明如何在博客文章中使用 YAML Front Matter。

## 什么是 Front Matter？

Front Matter 是文件开头的 YAML 格式元数据，用于为页面提供额外信息。它位于两行 `---` 之间。

## Front Matter 是可选的

由于配置了 `jekyll-optional-front-matter` 和 `jekyll-titles-from-headings` 插件，**Front Matter 是完全可选的**。

如果不提供 Front Matter，Jekyll 会：
- 自动从文件的第一个 H1 标题（`#`）提取页面标题
- 使用默认的 `default` 布局
- 根据文件路径自动分配类别

## 基本示例

### 最简单的方式（无 Front Matter）

```markdown
# 我的文章标题

这是文章内容...
```

Jekyll 会自动：
- 使用 "我的文章标题" 作为页面标题
- 应用默认布局

### 带有 Front Matter

```yaml
---
layout: default
title: 我的文章标题
---

# 我的文章标题

这是文章内容...
```

### 完整的 Front Matter 示例

```yaml
---
layout: post
title: GeoServer 入门教程
date: 2024-01-15
author: znlgis
category: gis-tutorial
tags: [GIS, GeoServer, 教程]
description: 这是一篇关于 GeoServer 的入门教程
---

# GeoServer 入门教程

文章内容...
```

## Front Matter 字段说明

### layout（布局）
- **类型**: 字符串
- **可选值**: `default`, `post`
- **默认值**: `default`
- **说明**: 指定页面使用的布局模板

```yaml
layout: post  # 使用 post 布局，显示更多元信息
```

### title（标题）
- **类型**: 字符串
- **默认值**: 从第一个 H1 标题提取
- **说明**: 页面标题，显示在浏览器标签和页面顶部

```yaml
title: GeoServer 完全指南
```

### date（日期）
- **类型**: 日期 (YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS)
- **可选**: 是
- **说明**: 文章发布日期

```yaml
date: 2024-01-15
# 或带时间
date: 2024-01-15 14:30:00
```

### author（作者）
- **类型**: 字符串
- **可选**: 是
- **默认值**: 从 `_config.yml` 继承
- **说明**: 文章作者

```yaml
author: znlgis
```

### category（类别）
- **类型**: 字符串
- **可选**: 是
- **说明**: 文章类别，用于组织内容

```yaml
category: gis-tutorial
```

**预定义的类别**:
- `gis-tutorial` - GIS 教程
- `gis-basic` - GIS 基础
- `csharp` - C# 开发
- `ai` - AI 系列
- `demos` - 项目演示
- `others` - 其他教程

### tags（标签）
- **类型**: 数组
- **可选**: 是
- **说明**: 文章标签，支持多个

```yaml
tags: [GIS, GeoServer, WMS, WFS]
# 或使用列表格式
tags:
  - GIS
  - GeoServer
  - 教程
```

### description（描述）
- **类型**: 字符串
- **可选**: 是
- **说明**: 页面描述，用于 SEO

```yaml
description: 详细介绍 GeoServer 的安装、配置和使用方法
```

### permalink（固定链接）
- **类型**: 字符串
- **可选**: 是
- **说明**: 自定义页面 URL

```yaml
permalink: /gis/geoserver-tutorial/
```

## 不同类型内容的推荐 Front Matter

### 教程文章

```yaml
---
layout: post
title: GeoServer 安装与配置
category: gis-tutorial
tags: [GIS, GeoServer, 安装]
---
```

### 基础知识文档

```yaml
---
layout: default
title: Shapefile 格式详解
category: gis-basic
---
```

### 项目演示

```yaml
---
layout: default
title: Vue3+OpenLayers 项目搭建
category: demos
tags: [Vue3, OpenLayers, 前端]
---
```

## 特殊页面

### 关于页面

```yaml
---
layout: default
title: 关于
permalink: /about/
---
```

### 404 页面

```yaml
---
layout: default
title: 页面未找到
permalink: /404.html
---
```

## 最佳实践

1. **保持简单**: 如果不需要特殊配置，不添加 Front Matter 也完全可以
2. **一致性**: 在同一系列教程中使用相同的类别和标签
3. **有意义的标题**: 标题应该清晰描述内容
4. **合理的标签**: 不要使用过多标签（3-5个最佳）
5. **日期格式**: 统一使用 `YYYY-MM-DD` 格式

## 示例对比

### 简单方式（推荐用于大多数情况）

```markdown
# GeoServer 概述与入门

## 什么是 GeoServer

GeoServer 是一个开源的地理信息服务器...
```

### 完整方式（需要更多控制时）

```yaml
---
layout: post
title: GeoServer 概述与入门
date: 2024-01-15
category: gis-tutorial
tags: [GIS, GeoServer, 入门]
description: GeoServer 是一个开源的地理信息服务器
---

# GeoServer 概述与入门

## 什么是 GeoServer

GeoServer 是一个开源的地理信息服务器...
```

## 常见问题

### Q: 必须使用 Front Matter 吗？
A: 不必须。配置了自动提取标题的插件，可以直接写 Markdown。

### Q: 如何选择 layout？
A: 
- 普通文档使用 `default`
- 需要显示日期、作者等信息的文章使用 `post`

### Q: 如何自动设置类别？
A: 将文件放在对应的目录下，`_config.yml` 中已配置自动类别映射。

### Q: 标签有什么用？
A: 标签用于内容分类和检索，方便读者找到相关内容。

### Q: Front Matter 影响性能吗？
A: 不影响。Jekyll 在构建时处理，对网站性能无影响。

## 更多信息

- [Jekyll Front Matter 官方文档](https://jekyllrb.com/docs/front-matter/)
- [YAML 语法指南](https://yaml.org/)

source "https://rubygems.org"

# Jekyll 版本
gem "jekyll", "~> 4.3.0"

# GitHub Pages 相关插件
gem "github-pages", group: :jekyll_plugins

# Jekyll 插件
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"           # RSS/Atom feed
  gem "jekyll-seo-tag", "~> 2.8"         # SEO 标签
  gem "jekyll-sitemap", "~> 1.4"         # 网站地图
  gem "jekyll-optional-front-matter"      # 可选的 front matter
  gem "jekyll-titles-from-headings"       # 从标题提取标题
  gem "jekyll-relative-links"             # 相对链接转换
end

# Windows 和 JRuby 支持
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# 性能优化
gem "wdm", "~> 0.1", :platforms => [:mingw, :x64_mingw, :mswin]

# HTTP 服务器
gem "webrick", "~> 1.8"

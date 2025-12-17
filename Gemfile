source "https://rubygems.org"

# GitHub Pages gem - 管理所有 GitHub Pages 依赖
gem "github-pages"

# Jekyll 插件（已包含在 github-pages gem 中，但可以显式声明）
group :jekyll_plugins do
  gem "jekyll-feed"
  gem "jekyll-seo-tag"
  gem "jekyll-sitemap"
end

# Windows 平台支持
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

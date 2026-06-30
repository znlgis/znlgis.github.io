source "https://rubygems.org"

ruby ">= 3.1"

# GitHub Pages gem - 管理所有 GitHub Pages 依赖
gem "github-pages"

# 开发与测试工具
group :development, :test do
  gem "html-proofer", "~> 5.0"
end

# Windows 平台支持
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# Required for `jekyll serve` on Ruby 3.0+
gem "webrick", "~> 1.8"

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

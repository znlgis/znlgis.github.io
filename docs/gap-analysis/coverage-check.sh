#!/bin/bash
# 用法：在仓库根目录执行  bash docs/gap-analysis/coverage-check.sh
# 作用：对 patterns.txt 中每个关键词统计 gis/tutorial 内的命中文件数与系列名，以及全仓库命中的顶层目录。
set -u
cd "$(dirname "$0")/../.." || exit 1

while IFS= read -r p; do
  [ -z "$p" ] && continue
  total=$(grep -riE --include='*.md' -l "$p" gis/tutorial 2>/dev/null | wc -l)
  series=$(grep -riE --include='*.md' -l "$p" gis/tutorial 2>/dev/null | sed -E 's#gis/tutorial/([^/]+)/.*#\1#' | sort -u | tr '\n' ',')
  alldirs=$(grep -riE --include='*.md' -l "$p" . 2>/dev/null | grep -v '^./docs' | sed -E 's#^./##; s#/.*##' | sort -u | tr '\n' ',')
  printf '%s\t%s\t%s\t%s\n' "$p" "$total" "$series" "$alldirs"
done < docs/gap-analysis/patterns.txt

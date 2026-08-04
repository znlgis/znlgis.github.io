#!/usr/bin/env python3
"""将 .md 文件中的内部链接替换为完整的 https://znlgis.github.io/... URL。

用法:
    python fix_cnblogs_links.py              # dry-run 预览所有修改
    python fix_cnblogs_links.py --apply      # 实际执行替换
    python fix_cnblogs_links.py --file path  # 只处理指定文件（dry-run）
"""

import re
import sys
from pathlib import Path
from collections import OrderedDict

BASE_URL = "https://znlgis.github.io"
ROOT_DIR = Path(__file__).resolve().parent

# 跳过的目录名（这些目录下的文件不处理）
SKIP_DIR_NAMES = {'.git', '.github', '_data', '_includes', '_layouts'}

# 不需处理的链接前缀
SKIP_PREFIXES = ('http://', 'https://', 'mailto:', 'javascript:')

# Markdown 链接正则：[text](target) — ] 和 ( 之间不能有空格
MD_LINK_RE = re.compile(r'\[([^\]]*)\]\(([^)]*)\)')

# HTML <a> href 属性正则 — 捕获 href 值
HTML_HREF_RE = re.compile(
    r'<a\b[^>]*?\bhref\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def resolve_path(link_target: str, current_parts: tuple) -> str:
    """
    根据当前文件目录解析链接目标为项目内相对路径（不含前导 /）。

    参数:
        link_target: 链接目标原始字符串
        current_parts: 当前文件所在目录的路径部分元组（相对于项目根，不含文件名）
                      例如文件 gis/tutorial/gdal/index.md 对应 ('gis', 'tutorial', 'gdal')
    """
    # 提取锚点（#fragment）
    fragment = ''
    if '#' in link_target:
        idx = link_target.index('#')
        fragment = link_target[idx:]
        link_target = link_target[:idx]

    # 去掉 .md 扩展名
    if link_target.endswith('.md'):
        link_target = link_target[:-3]

    # 规则 a: 绝对路径（以 / 开头）
    if link_target.startswith('/'):
        resolved_parts = [p for p in link_target.split('/') if p]

    # 规则 b: 目录级相对路径（以 ../ 或 ./ 开头）
    elif link_target.startswith('../'):
        parts = list(current_parts)
        for seg in link_target.split('/'):
            if seg == '..':
                if parts:
                    parts.pop()
            elif seg == '.' or seg == '':
                pass
            else:
                parts.append(seg)
        resolved_parts = parts

    elif link_target.startswith('./'):
        parts = list(current_parts)
        remaining = link_target[2:]
        if remaining:
            for seg in remaining.split('/'):
                if seg:
                    parts.append(seg)
        resolved_parts = parts

    # 规则 c: 同级相对路径（不以 /、../、./、http 开头）
    elif link_target == '..':
        # 独立 `..` → 上移一层目录
        parts = list(current_parts)
        if parts:
            parts.pop()
        resolved_parts = parts

    else:
        parts = list(current_parts) if current_parts else []
        for seg in link_target.split('/'):
            if seg:
                parts.append(seg)
        resolved_parts = parts

    # index 特殊处理: 如果最终路径以 index 结尾，去掉它
    if resolved_parts and resolved_parts[-1] == 'index':
        resolved_parts = resolved_parts[:-1]

    # 拼接路径
    if not resolved_parts:
        return '/' + fragment

    result = '/' + '/'.join(resolved_parts) + '/'
    return result + fragment


def build_full_url(resolved_path: str) -> str:
    """将解析后的路径转为完整 URL。"""
    # resolved_path 已经以 / 开头
    if resolved_path == '/':
        return BASE_URL + '/'
    return BASE_URL + resolved_path


# 围栏代码块检测：``` 或 ~~~ 开头，可选语言标识
FENCED_CODE_RE = re.compile(r'^(```|~~~)(\w*)\s*$', re.MULTILINE)


def find_code_ranges(content: str):
    """返回围栏代码块在 content 中的起止位置列表 [(start, end), ...]。
    每个范围覆盖包括围栏行在内的完整代码块。"""
    ranges = []
    starts = []
    for m in FENCED_CODE_RE.finditer(content):
        lang = m.group(2)  # 语言标识（可能为空）
        if lang:
            # 有语言标识 → 必然是开始标记
            starts.append(m.start())
        else:
            # 无语言标识 → 闭合待定块，或开始新块
            if starts:
                ranges.append((starts.pop(), m.end()))
            else:
                starts.append(m.start())
    # 未闭合的代码块：从开始标记到文件末尾
    for s in starts:
        ranges.append((s, len(content)))
    return ranges


def is_inside_code(pos: int, code_ranges: list) -> bool:
    """判断给定位置是否在某个代码块范围内。"""
    for start, end in code_ranges:
        if start <= pos < end:
            return True
    return False


def find_links(content: str):
    """
    扫描内容中的所有内部链接。

    返回: [(start, end, link_target), ...]
        start/end 是链接目标文本在 content 中的起止位置（用于替换）
    """
    links = []
    code_ranges = find_code_ranges(content)

    # Markdown 链接
    for m in MD_LINK_RE.finditer(content):
        if is_inside_code(m.start(), code_ranges):
            continue
        target_start = m.start(2)
        target_end = m.end(2)
        link_target = m.group(2)
        links.append((target_start, target_end, link_target))

    # HTML href 链接
    for m in HTML_HREF_RE.finditer(content):
        if is_inside_code(m.start(), code_ranges):
            continue
        target_start = m.start(1)
        target_end = m.end(1)
        link_target = m.group(1)
        links.append((target_start, target_end, link_target))

    return links


def should_skip_link(target: str) -> bool:
    """判断链接是否应跳过（外部链接、纯锚点等）。"""
    if not target.strip():
        return True
    if target.startswith(SKIP_PREFIXES):
        return True
    # 纯锚点（以 # 开头但前面没有路径）
    if target.startswith('#'):
        return True
    # 已经是我们站点完整 URL 的，不变
    if target.startswith(BASE_URL):
        return True
    return False


def should_skip_file(file_path: Path) -> bool:
    """判断文件是否应跳过。"""
    if file_path.suffix.lower() != '.md':
        return True
    rel = file_path.relative_to(ROOT_DIR)
    parts = set(rel.parts)
    if parts & SKIP_DIR_NAMES:
        return True
    # assets 目录下的非 .md 文件由 suffix 检查已过滤，这里再确认
    if 'assets' in parts:
        return True
    return False


def process_file(file_path: Path, dry_run: bool = True):
    """
    处理单个 .md 文件。

    返回: [(file_rel, line_num, old_target, new_target), ...]
    """
    changes = []

    try:
        content = file_path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError):
        return changes

    original_content = content
    rel_path = file_path.relative_to(ROOT_DIR)
    # 文件所在目录相对于项目根的各部分。
    # 关键: Jekyll permalink: pretty 会将非 index.md 的文件名变成一层虚拟目录。
    # 例如 sci/Clipper2/第05章.md 的 Jekyll URL 是 /sci/Clipper2/第05章/，
    # 浏览器中 ../ 从 /第05章/ 向上到 /Clipper2/，而不是 /sci/。
    # 因此对于非 index.md，要把文件名作为额外一层目录。
    if rel_path.stem == 'index':
        current_parts = tuple(p for p in rel_path.parent.parts if p != '.')
    else:
        current_parts = tuple(p for p in rel_path.parent.parts if p != '.') + (rel_path.stem,)

    all_links = find_links(content)

    # 收集所有需要替换的操作
    replace_ops = []
    for start, end, link_target in all_links:
        if should_skip_link(link_target):
            continue

        new_path = resolve_path(link_target, current_parts)
        new_url = build_full_url(new_path)

        if new_url == link_target:
            continue

        line_num = content[:start].count('\n') + 1

        changes.append({
            'file': str(rel_path),
            'line': line_num,
            'old': link_target,
            'new': new_url,
            'start': start,
            'end': end,
        })
        replace_ops.append((start, end, new_url))

    if changes and not dry_run:
        # 按原始顺序应用替换（从前往后，位置需要调整）
        replace_ops.sort(key=lambda x: x[0])
        new_content = original_content
        offset = 0
        for start, end, new_url in replace_ops:
            new_content = (
                new_content[:start + offset]
                + new_url
                + new_content[end + offset:]
            )
            offset += len(new_url) - (end - start)
        file_path.write_text(new_content, encoding='utf-8')

    return changes


def print_changes(file_changes: dict):
    """打印所有变更信息。"""
    total_files = len(file_changes)
    total_links = sum(len(v) for v in file_changes.values())

    if total_files == 0:
        print("\n  没有需要修改的链接。")
        return

    print(f"\n  将修改 {total_files} 个文件，共 {total_links} 个链接：\n")
    for fname, changes in sorted(file_changes.items()):
        print(f"  {fname}")
        for c in changes:
            old_display = c['old'] if len(c['old']) <= 55 else c['old'][:52] + '...'
            new_display = c['new'] if len(c['new']) <= 70 else c['new'][:67] + '...'
            print(f"    行 {c['line']:>4d}: {old_display}")
            print(f"            -> {new_display}")
        print()

    print(f"  {'─' * 56}")
    print(f"  文件数: {total_files}  |  链接数: {total_links}")
    print(f"  {'─' * 56}")


def main():
    dry_run = '--apply' not in sys.argv
    single_file = None

    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--file' and i + 1 < len(sys.argv):
            single_file = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    mode_label = "DRY-RUN" if dry_run else "APPLY"
    print(f"\n{'=' * 60}")
    print(f"  fix_cnblogs_links.py — {mode_label} 模式")
    print(f"{'=' * 60}")

    if single_file:
        file_path = (ROOT_DIR / single_file).resolve()
        if not file_path.exists():
            print(f"\n  错误: 文件不存在 — {single_file}")
            sys.exit(1)
        if file_path.suffix.lower() != '.md':
            print(f"\n  错误: 不是 .md 文件 — {single_file}")
            sys.exit(1)

        changes_list = process_file(file_path, dry_run=True)
        changes = {str(file_path.relative_to(ROOT_DIR)): changes_list} if changes_list else {}
        print(f"\n  文件: {single_file}")
        print_changes(changes)

    else:
        # 收集所有 .md 文件
        md_files = [f for f in sorted(ROOT_DIR.rglob('*.md')) if not should_skip_file(f)]

        all_changes = OrderedDict()
        for md_file in md_files:
            changes = process_file(md_file, dry_run=dry_run)
            if changes:
                all_changes[str(md_file.relative_to(ROOT_DIR))] = changes

        if not dry_run:
            print(f"\n  已扫描 {len(md_files)} 个 .md 文件")
        else:
            print(f"\n  扫描 {len(md_files)} 个 .md 文件...")

        print_changes(all_changes)

    if dry_run:
        print("\n  提示: 使用 --apply 参数实际执行修改\n")
    else:
        print("\n  修改已全部应用。\n")


if __name__ == '__main__':
    main()

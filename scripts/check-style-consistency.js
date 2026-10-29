#!/usr/bin/env node
/**
 * 内容风格一致性检查（零依赖，Node >= 14）
 *
 * 本项目把样式集中在 _layouts / _includes / assets，内容文件只负责结构。
 * 统一改造后形成的约定见 CONTRIBUTING.md，这里把它变成可执行的检查，
 * 让新加教程不会悄悄退回旧写法。
 *
 * 检查项：
 *   1. 章节页必须有且仅有一个 .chapter-nav，且 __prev/__dir/__next 结构正确
 *   2. 不得残留旧式手写导航（display:flex 的 div、**上一章**: [..](..) 等）
 *   3. 不得在正文里写 <style> / <script> / style="..."（代码围栏内的示例除外）
 *   4. 站内链接必须写成 https://znlgis.github.io/... 绝对形式
 *   5. front matter 必须有 layout 与 title；正文必须有且仅有一个 H1
 *   6. 代码围栏必须成对闭合
 *
 * 用法：node scripts/check-style-consistency.js    （有问题时退出码为 1）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', '_site', 'node_modules', 'vendor', '.bundle', '.idea', '.github']);
const SKIP_TOP = new Set(['_layouts', '_includes', 'scripts', 'docs']);
// 说明类文档不适用内容页规则
const DOC_FILES = new Set(['README.md', 'CONTRIBUTING.md', 'LICENSE.md']);

// 读取 _config.yml 的 exclude，被排除的文件不参与构建，不检查
function loadExcludes() {
  const cfg = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
  const out = [];
  let inBlock = false;
  for (const line of cfg.split(/\r?\n/)) {
    if (/^exclude:\s*$/.test(line)) { inBlock = true; continue; }
    if (inBlock) {
      const m = line.match(/^\s+-\s+(.+?)\s*$/);
      if (m) out.push(m[1]);
      else if (line.trim() !== '' && !/^\s/.test(line)) inBlock = false;
    }
  }
  return out;
}
const EXCLUDES = loadExcludes();
const isExcluded = rel => EXCLUDES.some(e => rel === e || rel.startsWith(e + '/'));

const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function collect(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (dir === ROOT && SKIP_TOP.has(e.name)) continue;
      collect(full, acc);
    } else if (e.name.endsWith('.md')) {
      const r = rel(full);
      if (!isExcluded(r) && !DOC_FILES.has(r)) acc.push({ file: full, rel: r });
    }
  }
  return acc;
}

// 把正文按 fenced code 切成「正文段」和「代码段」，代码段内的 HTML/链接不参与检查
function splitFences(text) {
  const out = [];
  const lines = text.split(/(?<=\n)/);
  let inFence = false, marker = '', buf = '';
  for (const line of lines) {
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (m) {
      const ch = m[1][0];
      if (!inFence) {
        if (buf) out.push({ code: false, text: buf });
        inFence = true; marker = ch; buf = line; continue;
      } else if (ch === marker) {
        buf += line; out.push({ code: true, text: buf }); buf = '';
        inFence = false; marker = ''; continue;
      }
    }
    buf += line;
  }
  if (buf) out.push({ code: inFence, text: buf });
  return out;
}

const problems = [];
const add = (rel, msg) => problems.push(rel + ': ' + msg);

const files = collect(ROOT, []);

for (const { file, rel: r } of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');

  // ---- front matter ----
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const isStandalone = r === '404.md' || r === 'about.md';
  if (!fm) {
    add(r, '缺少 front matter');
  } else {
    if (!/^layout:\s*\S+/m.test(fm[1])) add(r, 'front matter 缺少 layout');
    if (!/^title:\s*\S+/m.test(fm[1])) add(r, 'front matter 缺少 title');
  }

  // ---- 代码围栏成对 ----
  const fenceOpeners = (body.match(/^\s*`{3,}/gm) || []).length + (body.match(/^\s*~{3,}/gm) || []).length;
  const fenceSegs = splitFences(body);
  if (fenceSegs.length && fenceSegs[fenceSegs.length - 1].code) add(r, '代码围栏未闭合');

  const segs = splitFences(body);
  const prose = segs.filter(s => !s.code).map(s => s.text).join('');
  // 行内代码里的 `<style>` / `<script>` 是文档说明，不是真实标签
  const proseNoInlineCode = prose.replace(/`[^`\n]*`/g, '');

  // ---- H1 ----
  const h1 = prose.match(/^#\s+\S/gm) || [];
  if (!isStandalone && h1.length !== 1) {
    add(r, '正文应有且仅有一个 H1，实际 ' + h1.length + ' 个');
  }

  // ---- 内联样式 / 脚本 ----
  if (/<style[\s>]/i.test(proseNoInlineCode)) add(r, '正文含 <style>，样式应放进 assets/css/main.css');
  if (/<script[\s>]/i.test(proseNoInlineCode)) add(r, '正文含 <script>，交互应放进 assets/js/main.js');
  const inlineStyle = proseNoInlineCode.match(/\sstyle="/g) || [];
  if (inlineStyle.length) add(r, '正文含 ' + inlineStyle.length + ' 处内联 style="..."，应改用 class + CSS');

  // ---- 旧式手写导航 ----
  if (/<div[^>]*style="[^"]*display:\s*flex[^"]*"[^>]*>[\s\S]{0,700}?(上一章|下一章|目录)[\s\S]{0,700}?<\/div>/.test(prose)) {
    add(r, '残留旧式内联导航 <div style="display:flex">，应改用 .chapter-nav');
  }
  if (/^\*\*上一章\*\*\s*[:：]/m.test(prose) || /^\*\*返回目录\*\*/m.test(prose)) {
    add(r, '残留 **上一章** 形式的旧导航，应改用 .chapter-nav');
  }
  if (/^\[[^\]]*上一章[^\]]*\]\([^)]+\)\s*\|\s*\[/m.test(prose)) {
    add(r, '残留 [上一章](..) | [下一章](..) 形式的旧导航，应改用 .chapter-nav');
  }

  // ---- 章节页的 .chapter-nav ----
  const isIndexPage = r === 'index.md' || r.endsWith('/index.md');
  const dir = path.posix.dirname(r);
  const hasSiblingIndex = fs.existsSync(path.join(ROOT, dir === '.' ? 'index.md' : dir + '/index.md'));
  const isChapter = !isIndexPage && !isStandalone && r !== 'index.md' && hasSiblingIndex;

  if (isChapter) {
    const navs = prose.match(/class="chapter-nav"/g) || [];
    if (navs.length === 0) {
      add(r, '章节页缺少 .chapter-nav 尾部导航（写法见 CONTRIBUTING.md）');
    } else if (navs.length > 1) {
      add(r, '.chapter-nav 出现 ' + navs.length + ' 次，只应有一个');
    } else {
      const block = prose.match(/<div class="chapter-nav">[\s\S]*?<\/div>/);
      if (!block) {
        add(r, '.chapter-nav 结构不完整');
      } else {
        const bare = (block[0].match(/<a\s/g) || []).length;
        const mods = (block[0].match(/class="chapter-nav__(prev|dir|next)"/g) || []).length;
        if (bare !== mods) add(r, '.chapter-nav 里有 <a> 缺少 chapter-nav__prev/dir/next 类');
        const order = (block[0].match(/chapter-nav__(prev|dir|next)/g) || []).map(s => s.replace('chapter-nav__', ''));
        if (order.filter(x => x === 'dir').length !== 1) add(r, '.chapter-nav 里 __dir 必须正好一个（指向系列目录）');
        const idx = order.map(x => ['prev', 'dir', 'next'].indexOf(x));
        const sorted = idx.slice().sort((a, b) => a - b);
        if (idx.join() !== sorted.join()) add(r, '.chapter-nav 顺序应为 prev → dir → next，实际 ' + order.join(' → '));
      }
    }
  }

  // ---- 站内链接必须是绝对形式 ----
  const relLinks = [];
  for (const m of prose.matchAll(/\]\((\/[^)\s]+)\)/g)) relLinks.push(m[1]);
  for (const m of prose.matchAll(/(?:href|src)="(\/[^"]*)"/g)) relLinks.push(m[1]);
  if (relLinks.length) {
    add(r, '站内链接应写成 https://znlgis.github.io/... 绝对形式，发现 ' + relLinks.length + ' 处相对链接，如 ' + relLinks[0]);
  }
}

// ---- 输出 ----
if (problems.length === 0) {
  console.log('内容风格检查通过：' + files.length + ' 个 Markdown 文件');
  process.exit(0);
}
const byFile = new Map();
for (const p of problems) {
  const i = p.indexOf(': ');
  const f = p.slice(0, i), msg = p.slice(i + 2);
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(msg);
}
console.error('内容风格检查失败：' + byFile.size + ' 个文件，' + problems.length + ' 处问题\n');
let shown = 0;
for (const [f, msgs] of byFile.entries()) {
  if (shown++ >= 40) break;
  console.error('  ' + f);
  for (const m of msgs) console.error('    - ' + m);
}
if (byFile.size > 40) console.error('\n  ... 还有 ' + (byFile.size - 40) + ' 个文件未显示');
process.exit(1);

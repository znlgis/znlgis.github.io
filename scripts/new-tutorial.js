#!/usr/bin/env node
/**
 * 教程骨架生成器（零依赖，Node >= 14）
 *
 * 新建一整个教程系列时，手写十几到几十个文件很容易漏 front matter、漏章节导航、
 * 或者把链接写成相对路径。本脚本按 CONTRIBUTING.md 的约定生成骨架，
 * 生成结果保证通过 scripts/check-style-consistency.js。
 *
 * 用法：
 *   node scripts/new-tutorial.mjs --dir gis/tutorial/openlayers --title "OpenLayers" --chapters 18
 *   node scripts/new-tutorial.mjs --dir cad/Foo --title "Foo" --chapters 3 --titles 概述,快速开始,进阶
 *
 * 参数：
 *   --dir       教程目录（相对仓库根），必填
 *   --title     系列名称，必填
 *   --chapters  章节数，必填（给了 --titles 时可省略）
 *   --titles    逗号分隔的章节名，给了就按它生成，忽略 --chapters
 *   --nav       同时把系列登记进 _data/navigation.yml 的栏目下，值为栏目 id（如 gis）
 *   --force     目录已存在时允许覆盖 index.md
 *   --dry-run   只打印将创建的文件，不写盘
 *
 * 生成的每个章节页都会带：
 *   - front matter（layout / title）
 *   - 一个 H1
 *   - 结尾的 --- 分隔线与 .chapter-nav（prev → dir → next）
 * 生成的 index.md 是平铺的章节清单，样式由 .is-index 作用域接管。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://znlgis.github.io';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.dir || !args.title) {
  console.error('用法：node scripts/new-tutorial.mjs --dir <目录> --title <系列名> --chapters <章数>');
  process.exit(1);
}

const dirRel = String(args.dir).replace(/^\/+|\/+$/g, '');
const seriesTitle = String(args.title);
const dryRun = args['dry-run'] === true;
const force = args.force === true;

let chapterTitles;
if (args.titles) {
  chapterTitles = String(args.titles).split(',').map(s => s.trim()).filter(Boolean);
} else {
  const n = parseInt(args.chapters, 10);
  if (!Number.isFinite(n) || n <= 0) {
    console.error('请用 --chapters 指定章节数，或用 --titles 给出章节名');
    process.exit(1);
  }
  // 默认标题只给编号，占位用的「待补充」写在 slug 里
  chapterTitles = Array.from({ length: n }, (_, i) => '第' + String(i + 1).padStart(2, '0') + '章-待补充');
}

// 文件名：第NN章-标题；标题里的空格与标点替换为连字符，保持 URL 友好
function slug(title, index) {
  const num = String(index + 1).padStart(2, '0');
  // 剥掉标题里已带的「第NN章」前缀，避免生成「第01章-第01章」
  let base = title.replace(/^第\d+章[-：:\s]*/, '').trim();
  if (!base) base = '待补充';
  const safe = base.replace(/[\s/\\:*?"<>|，。、；：（）()]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return '第' + num + '章-' + safe;
}

const dirAbs = path.join(ROOT, dirRel);
const exists = fs.existsSync(dirAbs);
const indexAbs = path.join(dirAbs, 'index.md');
if (exists && fs.existsSync(indexAbs) && !force) {
  console.error('目录里已有 index.md：' + path.relative(ROOT, indexAbs));
  console.error('要继续请加 --force（会覆盖 index.md），或换一个 --dir');
  process.exit(1);
}

const chapters = chapterTitles.map((t, i) => {
  const name = slug(t, i);
  return {
    name,
    title: t.startsWith('第') ? t.replace(/-待补充$/, '章 待补充') : ('第' + String(i + 1).padStart(2, '0') + '章 ' + t),
    url: HOST + '/' + dirRel + '/' + name + '/',
  };
});
const dirUrl = HOST + '/' + dirRel + '/';

function chapterFile(idx) {
  const c = chapters[idx];
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const navLines = [];
  if (prev) navLines.push('  <a href="' + prev.url + '" class="chapter-nav__prev">← 上一章</a>');
  navLines.push('  <a href="' + dirUrl + '" class="chapter-nav__dir">目录</a>');
  if (next) navLines.push('  <a href="' + next.url + '" class="chapter-nav__next">下一章 →</a>');

  return [
    '---',
    'layout: default',
    'title: ' + c.title,
    '---',
    '',
    '# ' + c.title,
    '',
    '> 本节正文待补充。',
    '',
    '---',
    '',
    '<div class="chapter-nav">',
    ...navLines,
    '</div>',
    '',
  ].join('\n');
}

function indexFile() {
  return [
    '---',
    'layout: default',
    'title: ' + seriesTitle + ' 教程目录',
    '---',
    '',
    '# ' + seriesTitle + ' 教程目录',
    '',
    '一句话介绍这个系列。',
    '',
    '## 教程目录',
    '',
    ...chapters.map(c => '- [' + c.title + '](' + c.url + ')'),
    '',
    '---',
    '',
    '共 ' + chapters.length + ' 章',
    '',
  ].join('\n');
}

// ---- navigation.yml 登记 ----
function registerNav(sectionId) {
  const navPath = path.join(ROOT, '_data/navigation.yml');
  const text = fs.readFileSync(navPath, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const url = '/' + dirRel + '/';
  if (text.includes('url: ' + url)) {
    console.log('navigation.yml 里已有 ' + url + '，跳过登记');
    return false;
  }
  const lines = text.split(/\r?\n/);
  // 找到指定栏目 block：顶层 '- title:' 后面紧跟 '  id: <sectionId>'
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('- title:') !== 0) continue;
    var inBlock = false;
    for (let k = i + 1; k < Math.min(i + 4, lines.length); k++) {
      if (lines[k].trim() === 'id: ' + sectionId) { inBlock = true; break; }
    }
    if (inBlock) { startIdx = i; break; }
  }
  if (startIdx === -1) {
    console.warn('未找到栏目 id=' + sectionId + '，未改动 navigation.yml');
    return false;
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].indexOf('- title:') === 0) { endIdx = i; break; }
  }
  // 插到该栏目最后一个子项之后
  let insertAt = endIdx;
  while (insertAt > startIdx && lines[insertAt - 1].trim() === '') insertAt--;
  const entry = ['    - title: ' + seriesTitle, '      icon: 📁', '      url: ' + url];
  lines.splice(insertAt, 0, ...entry);
  fs.writeFileSync(navPath, lines.join(eol));
  console.log('已登记到 _data/navigation.yml 的 ' + sectionId + ' 栏目');
  return true;
}

// ---- 写盘 ----
const files = [
  { p: path.join(dirAbs, 'index.md'), c: indexFile() },
  ...chapters.map((c, i) => ({ p: path.join(dirAbs, c.name + '.md'), c: chapterFile(i) })),
];

if (dryRun) {
  console.log('将创建 ' + files.length + ' 个文件（dry-run，未写盘）：');
  files.forEach(f => console.log('  ' + path.relative(ROOT, f.p)));
  if (args.nav) console.log('并登记到 navigation.yml 栏目 ' + args.nav);
  process.exit(0);
}

for (const f of files) {
  fs.mkdirSync(path.dirname(f.p), { recursive: true });
  fs.writeFileSync(f.p, f.c);
}
console.log('已生成 ' + files.length + ' 个文件：' + dirRel);
files.slice(0, 4).forEach(f => console.log('  ' + path.relative(ROOT, f.p)));
if (files.length > 4) console.log('  ... 共 ' + files.length + ' 个');

if (args.nav) registerNav(String(args.nav));

console.log('\n下一步：');
console.log('  1. 填每章正文');
console.log('  2. node scripts/check-style-consistency.js  # 应通过');
console.log('  3. node scripts/check-internal-links.js     # 应通过');

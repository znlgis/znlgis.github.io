#!/usr/bin/env node
/**
 * 站内链接完整性检查（零依赖，Node >= 14）
 *
 * 站点约定：正文内链写作完整域名 https://znlgis.github.io/...（便于第三方转载），
 * 因此这里按域名前缀识别站内链接，并映射回源文件目录逐一校验：
 *   - /x/y/       -> x/y/index.md（pretty permalink 的页面目录）
 *   - /x/y.html   -> x/y.md 或磁盘上的 x/y.html（含 front matter 的 permalink）
 *   - 其它路径     -> 磁盘上须存在同名文件（如 /assets/...）
 *   - 路径大小写须与磁盘一致（GitHub Pages 运行于大小写敏感的 Linux）
 *
 * 按渲染语义扫描：fenced 代码块与行内代码中的 URL 视为示例文本，不参与检查；
 * 锚点（#fragment）有效性由 CI 的 htmlproofer 校验，此脚本不检查。
 *
 * 用法：node scripts/check-internal-links.js    （有断链时退出码为 1）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://znlgis.github.io';
const SKIP_DIRS = new Set(['.git', '_site', 'node_modules', 'vendor', '.bundle', '.idea']);

// 与 _config.yml 的 exclude 保持一致：被排除的文件不参与构建，视为不存在
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
function isExcluded(rel) {
  return EXCLUDES.some(e => rel === e || rel.startsWith(e + '/'));
}

function frontMatterPermalink(file) {
  const text = fs.readFileSync(file, 'utf8');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^permalink:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

// 小写路径 -> 真实路径（用于存在性与大小写校验）
const published = new Map();
const record = p => published.set(p.toLowerCase(), p);

(function indexSite(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (isExcluded(rel)) continue;
    if (e.isDirectory()) {
      if (fs.existsSync(path.join(full, 'index.md')) || fs.existsSync(path.join(full, 'index.html'))) {
        record(rel + '/');
        record(rel);
      }
      indexSite(full);
    } else if (e.name.endsWith('.md')) {
      if (e.name === 'index.md') continue; // 目录页已随所在目录登记
      const permalink = frontMatterPermalink(full);
      if (permalink) {
        record(permalink.replace(/^\//, ''));
      } else {
        record(rel.replace(/\.md$/, '') + '/');
      }
    } else {
      record(rel);
    }
  }
})(ROOT);
// 插件生成、源码中不存在的产物
record('feed.xml');
record('sitemap.xml');

function exists(p) {
  const cands = [p];
  if (!p.endsWith('/')) {
    cands.push(p + '/');
    cands.push(p.replace(/\.html$/, '') + '/');
  }
  for (const c of cands) {
    const key = c.replace(/^\//, '');
    const hit = published.get(key.toLowerCase());
    if (hit !== undefined) return { ok: true, exact: hit === key, real: hit };
  }
  return { ok: false };
}

// 掩掉代码块与行内代码，保留换行以维持行号
function maskCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/~~~[\s\S]*?~~~/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/``[\s\S]*?``/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, m => m.replace(/[^\n]/g, ' '));
}

const mdLinkRe = /\]\(\s*([^)\s]+)/g;
const htmlAttrRe = /(?:href|src)=["']([^"']+)["']/g;

const broken = [];
const caseIssues = [];
const files = [];

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (isExcluded(rel)) continue;
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.md') || e.name.endsWith('.html')) files.push(full);
  }
})(ROOT);

let siteLinks = 0;
for (const file of files) {
  const rel = '/' + path.relative(ROOT, file).split(path.sep).join('/');
  const raw = fs.readFileSync(file, 'utf8');
  const text = file.endsWith('.md') ? maskCode(raw) : raw;
  const found = [];
  let m;
  while ((m = mdLinkRe.exec(text)) !== null) found.push({ url: m[1], idx: m.index });
  while ((m = htmlAttrRe.exec(text)) !== null) found.push({ url: m[1], idx: m.index });

  for (const { url, idx } of found) {
    if (!url.startsWith(HOST)) continue;
    if (/[{}]/.test(url)) continue; // Liquid 模板拼接的链接，跳过
    let p = url.slice(HOST.length).split('#')[0].split('?')[0];
    if (p === '' || p === '/') continue;
    try { p = decodeURIComponent(p); } catch (e) { /* 保留原样 */ }
    siteLinks++;
    const line = text.slice(0, idx).split('\n').length;
    const r = exists(p);
    if (!r.ok) broken.push(`${rel}:${line}  -> ${url}`);
    else if (!r.exact) caseIssues.push(`${rel}:${line}  -> ${url}  （磁盘实际路径：${r.real}）`);
  }
}

console.log(`扫描 ${files.length} 个文件，站内链接 ${siteLinks} 条`);
console.log(`断链：${broken.length} 条`);
for (const b of broken) console.log('  ✗ ' + b);
console.log(`大小写不一致：${caseIssues.length} 条`);
for (const c of caseIssues) console.log('  ! ' + c);

if (broken.length || caseIssues.length) process.exit(1);
console.log('全部通过');

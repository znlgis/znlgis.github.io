---
layout: default
title: 第06章 - 内容数据模型与双语JSON
---

# 第06章 - 内容数据模型与双语JSON

## 6.1 内容为什么分成两半：摘要与详情

20 关的内容全是 JSON，但被刻意切成两半：`levels/<id>.json` 是**摘要**，`details/<id>.level.json` 是**详情**。

| | 摘要 `levels/<id>.json` | 详情 `details/<id>.level.json` |
|---|---|---|
| 谁需要 | 大厅、星图、推荐逻辑 | 进入关卡之后 |
| 典型字段 | `title` / `emoji` / `band` / `thread` / `tools` / `difficulty` / `unlock` | `levelScript` / `tools` / `evidencePlan` / `solutions` / `negativeSamples` / `variants` / `feedback` |
| 体积 | 一关约 0.5–1 KB | 一关约 5–15 KB（含 2 解 + 3 负例 + 2 变体） |
| 加载方式 | 静态 import，随内容包一起进首屏 | 动态 import，按关切 chunk |

不切一半的代价很直接：星图要渲染 20 张卡片，如果每张卡片都连带把该关的全部脚本、黄金解、负例、反馈都拉进来，首屏就等于下载全部内容。切一半之后，「看」和「玩」变成两次加载——星图只读摘要，点进某一关才下载那一关的详情。

摘要的加载路径住在 `summaries.ts`，注释与类型都在解释同一件事：

```ts
// packages/content/src/summaries.ts（节选）
/**
 * 摘要表：只静态加载已发布关卡，随 SHIPPED_LEVEL_IDS 增补。
 * 运行时不跑 zod（构建期由 content:check 校验），否则 zod 会进首屏。
 *
 * 键类型是 ShippedLevelId 而不是 string：少登记一关 typecheck 就报，
 * 不用等到运行时才由下面的 throw 兜底。
 */
const RAW: Record<ShippedLevelId, unknown> = {
  'k-structure-pattern-path': kPatternPath,
  'k-data-tally': kDataTally,
  // …共 20 条
};

export const LEVEL_SUMMARIES: readonly LevelSummary[] = SHIPPED_LEVEL_IDS.map((id) => {
  const summary = RAW[id] as LevelSummary | undefined;
  if (!summary) throw new Error('缺少关卡摘要：' + id);
  if (summary.id !== id) throw new Error('关卡摘要 id 不一致：' + id);
  return summary;
});
```

`RAW` 的值类型是 `unknown` 而不是 `LevelSummary`。这是刻意的：运行时如果直接把它断言成 `LevelSummary`，就等于「相信 JSON 是对的」，而 zod 真正的判断要到构建期才发生。用 `unknown` + 显式 `as LevelSummary | undefined` 至少让类型系统承认「这里没验证过」，并且逼出一个非空分支来处理「缺内容」。

摘要 id 被查两次：一次在 `LEVEL_SUMMARIES` 构造时（少一处就抛），一次在 `content:check`（与详情逐项比对）。前者是运行时兜底，后者是构建期门禁。

## 6.2 详情的懒加载：一个 Record 与两条自检

详情走 `loadLevel()`，结构是「`Record<ShippedLevelId, () => Promise<unknown>>` + 动态 import」：

```ts
// packages/content/src/loadLevel.ts（节选）
/**
 * 详情走动态 import：Vite 会把每个 <id>.level.json 切成独立 chunk。
 * 运行时不做 zod 校验（构建期 content:check 负责）；只做 id 一致性断言。
 */
const LOADERS: Record<ShippedLevelId, () => Promise<unknown>> = {
  'k-structure-pattern-path': () => import('./details/k-structure-pattern-path.level.json'),
  'k-data-tally': () => import('./details/k-data-tally.level.json'),
  // …共 20 条
};

export async function loadLevel(
  id: ShippedLevelId,
  _locale: Locale = 'zh-CN',
): Promise<LevelDetail | null> {
  const summary = getLevelSummary(id);
  if (!summary) return null;
  const loader = LOADERS[id];
  if (!loader) return null;
  const raw = (await loader()) as { default?: unknown } | unknown;
  const detail = (raw && typeof raw === 'object' && 'default' in raw ? raw.default : raw) as LevelDetail | null;
  // 动态 import 正常不会给 null；真给了也要报清楚的错，而不是 TypeError: cannot read 'id' of null。
  if (!detail) throw new Error('关卡详情为空：' + id);
  if (detail.id !== id) throw new Error('关卡详情 id 不一致：' + id);
  return detail;
}
```

四个细节都来自踩过的坑：

- **返回值允许 `null`，但只对「未发布 / 未知 id」**：`getLevelSummary` 查不到就直接 `null`，调用方回星图，不白屏。这是内容缺失的正常路径，不是异常。
- **`detail` 为 null 要抛清楚的错**：动态 import JSON 正常不会给 null，但万一构建配置错位，`TypeError: Cannot read properties of null (reading 'id')` 会把人引向错误方向。
- **`detail.id !== id` 抛错**：防止「文件名与内容 id 错位」这种只在构建配置被改坏时出现的错误。真正的形状校验在 `content:check`，这里只做 id 自检。
- **`_locale` 参数以下划线开头**：它目前不影响返回值，签名保留是为了将来真改成「英文补丁单独 chunk」时外壳不用改调用；TS 的 `noUnusedParameters` 与 eslint 的 `argsIgnorePattern: '^_'` 都不会因此报错。

Vite 会为每个 `details/*.level.json` 切一个 chunk，文件名由 `apps/site/vite.config.ts` 的 `chunkFileNames` 命名为 `content-<id>-<hash>.js`（第 5 章已看过那段正则）。于是浏览器网络面板里能直接看出「刚玩的那一关内容有多大」。

## 6.3 zod schema：构建期唯一的形状闸门

`packages/content/src/schema.ts` 是全部内容类型的单一来源，用 zod 4 写成。它的第一原则是 **`.strict()`：未知字段直接报错，而不是被静默剥掉**：

```ts
// packages/content/src/schema.ts（节选）
/**
 * strict()：未知字段直接报错而不是被静默剥掉——内容 JSON 里写错字段名
 * （例如 "thinking_target"）时，静默剥掉会变成"字段没生效但校验通过"。
 */
export const LevelSummarySchema = z.object({
  id: z.enum(LEVEL_IDS),
  title: z.string().min(1).max(24),
  titleEn: z.string().min(1).max(48).optional(),
  emoji: z.string().min(1).max(8),
  color: hexColor.optional(),
  band: z.enum(BANDS),
  thread: z.enum(THREADS),
  template: z.enum(TEMPLATE_IDS),
  tools: z.array(z.enum(TOOL_IDS)).min(1),
  estimatedMinutes: z.number().int().min(3).max(15),
  thinkingTarget: z.string().min(1).max(40),
  thinkingTargetEn: z.string().min(1).max(120).optional(),
  difficulty: z.object({
    structure: z.number().int().min(1).max(5),
    representation: z.number().int().min(1).max(5),
    constraint: z.number().int().min(1).max(5),
    transfer: z.number().int().min(1).max(5),
  }).strict(),
  unlock: z.object({ after: z.array(z.enum(LEVEL_IDS)).default([]) }).strict().optional(),
}).strict();
```

这些上限不是随手写的：`title` ≤ 24 字、`thinkingTarget` ≤ 40 字来自 `docs/02 §7.2` 的摘要字段表，`estimatedMinutes` 3–15、难度四轴 1–5 同理。schema 与文档同数是硬要求，否则超长文案会一路混到星图卡片上，靠 CSS 截断来兜底。

详情 schema 则把「一关必须交代清楚什么」直接写成了类型约束：

```ts
// packages/content/src/schema.ts（节选）
export const LevelDetailSchema = z.object({
  id: z.enum(LEVEL_IDS),
  title: z.string().min(1).max(24),
  // …中英六字段
  tools: z.array(ToolSpecSchema).min(1),
  requiredToolArtifacts: z.array(z.string().min(1)).min(1),
  levelScript: z.unknown(),
  evidencePlan: z.array(EvidenceCheckpointSchema).min(2),
  solutions: z.array(LevelSolutionSchema).min(2),
  negativeSamples: z.array(NegativeSampleSchema).min(3),
  variants: z.array(LevelVariantSchema).min(2),
  feedback: z.record(z.string(), FeedbackCopySchema),
  badges: z.array(z.enum(BADGE_IDS)).default([]),
  manualAudit: z.object({
    reviewed: z.boolean(),
    reviewer: z.string().min(1),
    reviewedAt: z.string().min(1),
    notesKey: z.string().optional(),
  }).strict().optional(),
}).strict();
```

四个 `.min()` 是反刷题审计的直接体现：证据计划至少 2 个阶段（A8）、黄金解至少 2 条（A3）、负例至少 3 条（A4）、变体至少 2 个（A6）。`levelScript` 的类型是 `z.unknown()`——脚本形状由模板决定，通用 schema 管不了，交给下一步的 `verifier.parseScript()`。

工具规格用 `z.discriminatedUnion('kind', …)` 按六件工具分别声明配置：

```ts
export const ToolSpecSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pattern'),
    ...ToolSpecBase,
    config: z.object({
      tokens: z.array(z.string().min(1)).min(2).max(4),
      maxPeriod: z.number().int().min(2).max(6).default(4),
      cells: z.array(z.number().int().min(0)).optional(),
    }),
  }),
  // …rule / construct / knob / probe / counter 各一支
]);
```

判别式联合体让「内容里声明了 `kind: 'pattern'`」与「配置字段必须是 pattern 的那几个」绑死：少写一个 `tokens`，或者往 construct 配置里塞 knob 的 `sumTo`，都会在构建期报错。

## 6.4 三个出口：为什么 @mmf/content 的主入口刻意不导出 zod

`@mmf/content` 有三个入口，用途截然不同：

```ts
// packages/content/src/index.ts（全文）
/**
 * 外壳侧入口：常量 / 摘要 + 动态详情加载。
 * 刻意不导出 zod schema：zod 是真实副作用，只要主入口引用它就会进首屏。
 * 需要构建期校验的地方走 '@mmf/content/full'。
 */
export * from './ids';
export type { LevelDetail, LevelSummary, ToolSpec } from './schema';
export { LEVEL_SUMMARIES, getLevelSummary, levelSummaries, ensureSummaries } from './summaries';
export { loadLevel } from './loadLevel';
export { localizedDetail, localizedSummary } from './localize';
export type { LocalizedDetail, LocalizedSummary } from './localize';
```

关键在第 6 行：`export type { LevelDetail, … } from './schema'` 是**类型导出**，编译后被完全擦除，不会让 `schema.ts` 里的 `import { z } from 'zod'` 进入 bundle。如果写成 `export { LevelSummarySchema } from './schema'`，一句导出就会把整个 zod 钉在首屏 chunk 里——即使调用方只用类型也救不回来，因为打包器只认模块图，不认「谁真的用了」。

三个入口的分工：

| 入口 | 导出 | 谁用 | 是否含 zod |
|---|---|---|---|
| `@mmf/content` | 常量、摘要、`loadLevel`、`localize`、类型 | `apps/site` 外壳 | 否 |
| `@mmf/content/ids` | 只有常量与 id 联合类型 | progress / evidence / toolkit 等只缺常量的包 | 否 |
| `@mmf/content/full` | schema、20 份详情、摘要 | Node CLI（`content:check`、`audit:levels`）与单测 | 是 |

`full.ts` 的样子很直白：20 个 `import … from './details/…level.json'` 加一张 `LEVEL_DETAILS: Record<ShippedLevelId, LevelDetail>`。只有在 Node 里跑的内容体检与审计才需要「一次拿到全部详情」，浏览器永远不需要。

这条纪律有 eslint 兜底，不是靠自觉：

```js
// eslint.config.js（节选）
{
  files: ['apps/site/src/**/*.{ts,vue}'],
  rules: {
    'no-restricted-imports': ['error', { paths: [
      { name: '@mmf/content/full', message: '外壳不许直接引入完整内容：用 loadLevel()。' },
      { name: 'phaser', message: '外壳不许直接 import Phaser：它只属于关卡 chunk。' },
    ]}],
  },
},
```

为什么用 lint 而不是等体积门禁：一句 `import '@mmf/content/full'` 就能让懒加载全部作废，而体积检查要到打包之后才跑——那时候已经浪费了一轮构建；lint 在保存文件时就报。

同一份 eslint 里还有一条相关的「纯逻辑层禁令」（第 7 章展开）：`packages/toolkit/src/**` 与 `**/*.logic.ts` 禁止 `Math.random`、`Date.now`、`phaser`、`vue`，保证判定与工具逻辑能在 Node 单测里直接跑。

## 6.5 双语：内联英文字段，而不是补丁目录

早期方案打算把英文放成 `i18n/en/<id>.level.json` 单独的补丁 chunk。落地时改了：**每份 JSON 里直接带英文字段**，`localize.ts` 按 locale 取值、缺失回退中文。详情里是六个 `*En` 字段：`titleEn` / `thinkingTargetEn` / `introEn` / `promptEn` / `doneEn` / `retryEn`。

```ts
// packages/content/src/localize.ts（节选）
export function localizedDetail(detail: LevelDetail, locale: Locale): LocalizedDetail {
  if (locale === 'en') {
    return {
      title: detail.titleEn ?? detail.title,
      thinkingTarget: detail.thinkingTargetEn ?? detail.thinkingTarget,
      intro: detail.introEn ?? detail.intro,
      prompt: detail.promptEn ?? detail.prompt,
      done: detail.doneEn ?? detail.done,
      retry: detail.retryEn ?? detail.retry,
    };
  }
  return { title: detail.title, thinkingTarget: detail.thinkingTarget, intro: detail.intro,
    prompt: detail.prompt, done: detail.done, retry: detail.retry };
}
```

理由有三条，都是工程判断而不是偏好：

1. **20 关详情本来就是一关一个 chunk**，再拆英文补丁只是多一次请求；
2. **省下的体积不够抵消代价**：一关英文文案约 1–2 KB，相比 5–15 KB 的详情 chunk 不值得多一层加载时序；
3. **多一层加载就多一种「英文半截」**：主内容到了、补丁没到，界面会短暂出现中英混排。

改成内联字段后，切语言变成纯字段选择：不发请求、不等异步、不可能半截。代价是详情 JSON 里中英双份文案，靠 `content:check` 守住齐全与质量——它要求 20 关的六个英文字段全部存在、**零中文残留**，并拦截 CJK 全角标点：

```ts
// scripts/content-check.ts（节选）
/** 玩家可见的英文文案字段：这些字段必须存在且零中文残留。 */
const EN_FIELDS = ['titleEn', 'thinkingTargetEn', 'introEn', 'promptEn', 'doneEn', 'retryEn'] as const;

for (const field of EN_FIELDS) {
  const value = data[field];
  if (!value) { fail(id + ' 缺少英文文案 ' + field); continue; }
  if (CJK.test(value)) fail(id + ' 英文文案 ' + field + ' 含中文：' + value);
}
for (const text of EN_FIELDS.map((field) => data[field]).filter((v): v is string => Boolean(v))) {
  // 只拦 CJK 全角标点；弯引号 “” 与 en dash – 是合法英文排版，不算错。
  if (/[，。；：！？（）【】]/.test(text)) fail(id + ' 英文文案含全角标点：' + text);
}
```

摘要侧同理，只是字段更少（`titleEn` / `thinkingTargetEn`）。所以「英文漏翻」在这套体系里不是运行时的偶发问题，而是构建期错误——`pnpm content:check` 会红。

还有一条现实缺口必须说清：**模板与工具面板里仍有以中文句子当 key 的文案**。`@mmf/i18n` 的处理是加一张「中文源串 → 英文」兜底表 `zh-source.ts`，正式 `en.ts` 的 key 优先，查不到再去兜底表，再查不到回退中文（宁可中文也不白屏）。内容体检对这类 key 目前记警告而不是错误，等 i18n 收口后再升级。

## 6.6 content:check：构建期唯一的内容质量门

`pnpm content:check` 跑的是 `scripts/content-check.ts`，一个只用 Node 与 tsx 的 CLI。它的定位写在文件头：

```ts
// scripts/content-check.ts（节选）
/**
 * 内容体检：构建期唯一的"内容质量门"。
 * 这里只做**通用**检查——不写死某关的解法数值，避免内容一改脚本就红。
 * 语义检查（解/负例/变体可解性）在 audit-levels.ts，两者共用 templates 的 verifier。
 */
```

「不写死某关的解法数值」是它敢进 `pnpm verify` 的原因：它检查的是**结构与规则**，不是「第 3 关第 5 格应该是 B」。写死答案的检查会在内容迭代时天天误报，最后被人关掉。

它做的事按顺序分七组：

| 检查组 | 具体检查 |
|---|---|
| schema | 摘要 / 详情各跑一次 `LevelSummarySchema` / `LevelDetailSchema` |
| 摘要—详情一致性 | id、template、band、thread、title、titleEn、工具集合逐项比对 |
| 双语 | 六个英文字段齐全、零中文、无全角标点 |
| 脚本 | `verifier.parseScript(data.levelScript)` 必须通过 |
| 产物 | `requiredToolArtifacts` 每一项都要有工具声明能产出 |
| 解 / 负例 / 变体 | 黄金解必须通过；负例必须失败且失败类等于声明值；变体补丁必须可解析 |
| 反馈与证据 | 可达失败类都有反馈条目；证据计划 ≥2 阶段且检查点 id 唯一；`manualAudit.reviewed` 必须为真 |

其中两类检查值得单独看代码。

第一类，**负例必须触发声明的失败类**。这比「负例不通过」严格得多：

```ts
for (const negative of data.negativeSamples) {
  if (negativeIds.has(negative.id)) fail(id + ' 负例 id 重复：' + negative.id);
  negativeIds.add(negative.id);
  const verdict = verifier.validateArtifact(data, baseVariant, negative.artifact);
  if (verdict.passed) fail(id + ' 负例居然通过：' + negative.id);
  else if (verdict.failure?.class !== negative.expectFailure) {
    fail(id + ' 负例失败类不符：' + negative.id + ' 期望 ' + negative.expectFailure + '，实际 ' + verdict.failure?.class);
  }
}
```

如果只检查「不通过」，一个因为缺证据而不通过的负例也能混过去，反刷题审计 A4 就形同虚设。要求失败类吻合，等于要求「这条负例确实在测它声称在测的规则」。

第二类，**反馈必须覆盖可达失败类**。模板导出 `FAILURE_CLASSES`，`reachableFailureClasses()` 给出本关实际可能触发的集合，内容必须为每一条准备好人话文案：

```ts
// ---- 反馈覆盖 ----
const reachable = verifier.reachableFailureClasses(data);
const feedbackKeys = new Set(Object.keys(data.feedback));
for (const failure of reachable) {
  if (!feedbackKeys.has(failure)) fail(id + ' 缺少失败类反馈：' + failure);
}
```

另外还有一条面向 5–18 岁的文案禁词规则，分两级：`失败/惩罚/笨蛋/输了/淘汰/粗心/扣分/排名/倒数` 是硬禁（出现即阻断），`必须/聪明/笨` 是软禁（只警告）。分级的原因是「所有站点必须连起来」这种句子在描述规则时是正常表达，一刀切会让门禁失去可信度；而伤害性评价零容忍。

CLI 还有一个 `--require-all` 开关，对应内容矩阵的完整度：

```ts
const missingTarget = LEVEL_IDS.filter((id) => !shipped.has(id));
console.log('目标矩阵：' + (LEVEL_IDS.length - missingTarget.length) + '/' + LEVEL_IDS.length + ' 已发布；其余 ' + missingTarget.length + ' 关在后续里程碑' + (requireAll ? '（已要求全量）' : '') + '。');
if (requireAll && missingTarget.length > 0) {
  fail('目标矩阵缺 ' + missingTarget.length + ' 关：' + missingTarget.join('、'));
}
```

默认只校验 `SHIPPED_LEVEL_IDS`（已上线的那批），加 `--require-all` 时 20 关必须全部有内容。里程碑期间内容只写了一半，这条开关让「还没写完」不算失败，但发布前必须能过全量。

## 6.7 内容文件的真实形状

把两份 JSON 放在一起看，能看清「摘要管看、详情管玩」的分工。摘要只有 26 行：

```json
{
  "id": "k-structure-pattern-path",
  "title": "模式修补匠",
  "emoji": "🧱",
  "color": "#b07d2b",
  "band": "k",
  "thread": "structure",
  "template": "pattern",
  "tools": ["pattern", "construct"],
  "estimatedMinutes": 5,
  "thinkingTarget": "先找出重复单元，再用它预测下一块",
  "difficulty": { "structure": 1, "representation": 2, "constraint": 1, "transfer": 2 },
  "unlock": { "after": [] },
  "titleEn": "Pattern Tinkerer",
  "thinkingTargetEn": "Find the repeating unit and repair the broken path."
}
```

详情（`details/k-structure-pattern-path.level.json`，329 行）在同样身份字段之外，多了六块「可玩、可验」的内容（下面只节选前两块）：

```json
{
  "levelScript": {
    "scenario": {
      "kind": "path",
      "length": 12,
      "visible": ["A","B","B","A","B","B",null,null,null,"A","B","B"],
      "startIndex": 0
    },
    "pattern": { "allowedPeriods": [2,3,4], "allowedTransforms": ["none","mirror","shift"], "ambiguous": false }
  },
  "solutions": [
    { "id": "s-cycle-abb", "artifact": { "patternRule": { "tokens": ["A","B","B"], "period": 3, "transform": "none" },
      "repair": [{ "index": 6, "token": "A" }, { "index": 7, "token": "B" }, { "index": 8, "token": "B" }] } },
    { "id": "s-cycle-bba-shift", "artifact": { "patternRule": { "tokens": ["B","B","A"], "period": 3, "transform": "shift" } } }
  ]
}
```

- `levelScript`：模板专属脚本，形状由模板 schema 管（这里是 `patternScriptSchema`：`length` 3–24、`visible` 3–24 项、`startIndex` 0–12）；
- `solutions`：黄金解，每条都是一个完整产物，验证器逐条跑通才算数——上面两条正是「ABB 循环」与「BBA 平移一位」两种读法；
- `negativeSamples`：必须失败的产物 + 期望失败类；
- `variants`：结构化补丁，不许是「换数字」；
- `feedback`：失败类 → `messageKey` / `hintKey` / `focus`（聚焦到画布哪个区域）；
- `evidencePlan`：证据检查点，`require` 写的是「世界里应该发生什么」（如 `construct/place >= 1`），不是命令句。

此外还有 `badges`（本关可能授予的徽章 id）与 `manualAudit`（人工复核记录：谁、哪天、走查笔记 key）。后者是 A5/A10 人工项的凭证，`content:check` 会强制它 `reviewed: true` 且 `reviewedAt` 是 ISO 日期——「这关被人看过」不能只活在口头。

## 6.8 小结

- 内容分两半是体积与加载时序的选择：摘要静态进首屏，详情按关懒加载（`content-<id>-<hash>.js`）。
- 摘要与详情的 `Record` 键类型都是 `ShippedLevelId`：少登记一关就 typecheck 报错；运行时只做 id 自检，形状校验全在构建期。
- `loadLevel()` 对未发布 id 返回 `null`（回星图），对空详情与 id 错位抛明确错误。
- zod 4 的 `.strict()` 让字段名写错立刻暴露；`.min()` 把 A3/A4/A6/A8 的数量底线写进类型。
- `@mmf/content` 主入口只导出类型而不导出 schema，是 zod 不进首屏的关键；`full.ts` 只给 Node CLI 与单测，eslint 禁止外壳引用。
- 双语用内联的六个 `*En` 字段而不是补丁目录：省一次请求、消灭半截状态；齐全与质量由 `content:check` 强制。
- `content:check` 只做通用检查（schema、一致性、可解性、反馈覆盖、禁词、矩阵完整度），不写死任何一关的答案数值。
- 内容里「解 / 负例 / 变体 / 证据计划 / 人工复核」五件套齐全，才允许进 `content` 目录。

下一章看这些内容声明的东西，怎么在界面上变成六件可操作、可校验、防点选的工具。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/MathMindForge/第05章-Vue应用外壳与路由/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/MathMindForge/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/MathMindForge/第07章-六件思维工具与工具台/" class="chapter-nav__next">下一章 →</a>
</div>

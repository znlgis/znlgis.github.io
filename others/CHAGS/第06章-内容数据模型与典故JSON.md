---
layout: default
title: 第06章 - 内容数据模型与典故JSON
---

# 第06章 - 内容数据模型与典故JSON

## 6.1 一条内容由什么组成

「换内容 = 换 JSON」是这个项目的核心承诺。为了让这条承诺在 53 个条目上仍然成立，内容被拆成**三层**：

| 层 | 文件 | 谁读它 | 什么时候加载 |
|---|---|---|---|
| 摘要 | `packages/content/src/entries/<id>.json` | 大厅、图鉴、复习页头、注册表单测 | 首屏（静态 import） |
| 详情 | `packages/content/src/entries/<id>.game.json` | 游戏包、复习题 | 进游戏时按条目动态 import |
| 英文补丁 | `packages/content/src/i18n/en/<id>.json` 与 `<id>.game.json` | 切英文时 | 摘要补丁在切语言时加载、详情补丁随条目加载 |

当前一共 **53 条**内容：十七部典故 + 三十六计 36 计。每一条都恰好有 2 幕故事、3 道复习题（含 1 道迁移题）、1–3 段玩法脚本 —— 这三条不是倡议，是 schema 里写死的。

## 6.2 摘要：EntrySummarySchema

摘要只装「渲染卡片需要的那一小部分」，字段分四组：

| 组 | 字段 |
|---|---|
| 标识与分组 | `id`（只允许小写字母 / 数字 / 连字符）、`group`（必须登记在 `GROUPS` 里）、`kind`（`history` / `myth` / `legend` / `fable` / `strategy`） |
| 展示 | `title`、`pinyin`、`dynasty`、`era`、`yearApprox`（公元前为负数）、`ageRange`、`moral`（≤90 字）、`keywords`（2–6 个） |
| 出处 | `source.book` / `source.chapter?` / `source.quote` |
| 分组专属 | `stratagem: { number, set }?`、`transfer?`、`thinkingTag?` |

schema 里两条 `refine` 值得单独抄出来：

```ts
export const EntrySummarySchema = z
  .object(summaryFields)
  .refine((v) => (v.group === 'stratagem') === (v.stratagem !== undefined), {
    message: '三十六计必须写 stratagem（序号 / 套），典故组不许写',
    path: ['stratagem'],
  })
  .refine((v) => v.stratagem === undefined || v.stratagem.set === Math.ceil(v.stratagem.number / 6), {
    message: 'stratagem.set 与序号对不上：第 n 套 = 序号 6(n−1)+1 … 6n',
    path: ['stratagem', 'set'],
  });
```

第一条是**双向**的：典故组写了 `stratagem` 也报错。这样「三十六计被悄悄归到典故里」或「典故抄了一条计策字段」都会在构建期炸出来。第二条把「第几套」与「第几计」的算术关系固化下来，免得出现「第 7 计标成胜战计」。

一条真实的战略摘要（`entries/mantian-guohai.json`，逐字）：

```json
{
  "id": "mantian-guohai",
  "group": "stratagem",
  "kind": "strategy",
  "title": "瞒天过海",
  "pinyin": "Mán tiān guò hǎi",
  "dynasty": "唐",
  "era": "唐朝初期 · 约一千四百年前",
  "yearApprox": 645,
  "source": {
    "book": "《三十六计·胜战计》",
    "chapter": "瞒天过海",
    "quote": "备周则意怠，常见则不疑。阴在阳之内，不在阳之对。"
  },
  "moral": "把大事藏在最平常的样子里：越显眼的东西，越要看着不起眼。",
  "keywords": ["平常的样子", "藏", "渡海"],
  "ageRange": [7, 10],
  "stratagem": { "number": 1, "set": 1 },
  "thinkingTag": "不露声色",
  "transfer": "准备一个惊喜时，先别急着说，悄悄把每一步做好。"
}
```

三个「孩子视角」的设计都在这份 JSON 里：`era` 写「唐朝初期 · 约一千四百年前」而不是「贞观十九年」；`moral` 是孩子能听懂的一句话；`transfer` 是「今天可以怎么用」。`content:check` 会强制三十六计必须有 `thinkingTag` 与 `transfer`（`transfer` 至少 12 字）。

## 6.3 详情：EntryDetailSchema

```ts
const detailFields = {
  figures: z.array(z.string().min(1)).min(1),
  // ★ 恰好两幕：drawBeat 契约目前只会画两幅图
  story: z.array(StoryBeatSchema).length(2),
  keyMoment: KeyMomentSchema,
  misconceptions: z.array(z.string().min(1)).min(1),
  // 每条内容固定 3 道（含 1 道 transfer）
  quiz: z.array(QuizQuestionSchema).length(3),
  game: z.object({
    template: z.enum(TEMPLATE_IDS),
    stages: z.array(GameStageSchema).min(1).max(3),
  }),
};
```

四个子结构：

```ts
export const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['recall', 'transfer']).default('recall'),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  answer: z.number().int().min(0),
  explanation: z.string().min(1),
});

export const StoryBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().max(90),      // 屏幕上一句话，上限按英文给
  narration: z.string().min(1),  // 配音文本，可以更长
});

export const KeyMomentSchema = z.object({
  beatId: z.string().min(1),
  question: z.string().min(1),
  options: z.array(KeyMomentOptionSchema).min(2).max(4),
  reveal: z.string().min(1),
});

export const GameStageSchema = z.object({
  template: z.enum(TEMPLATE_IDS),
  levelScript: z.unknown(),      // 各模板自己的 schema 在 templates 包里
});
```

几条硬约束及其理由：

| 约束 | 理由 |
|---|---|
| `story` 恰好 2 幕 | `drawBeat` 只会画两幅（`index: 0 | 1`），允许 2–6 幕时第 3 幕会**静默复用**第 2 幕插图 |
| `quiz` 恰好 3 道 | 复习页固定 3 题，不会出现「有的 2 题有的 3 题」导致体验不一致 |
| 至少 1 道 `kind: 'transfer'` | 迁移题才是「真的记住了」的证据，全是记忆题等于考背诵 |
| `keyMoment.options` 恰好 1 个 `isCanonical` | 关键抉择必须有唯一正解，否则没有「揭晓」可谈 |
| `keyMoment.beatId` 必须存在于 `story` | 揭晓语挂在哪一幕上，不能指向不存在的幕 |
| `story` 的 beat id 不重复 | 事件里的 `beat:enter:s1` 要靠它做唯一定位 |
| `stages` 1–3 段 | 一条内容可以拆成「撑天 + 化身」两段，但不会变成十段 |

## 6.4 分组：三层结构的唯一事实来源

`packages/content/src/groups.ts` 只有 60 行左右，却是大厅、图鉴、内容体检三处的共同输入：

```ts
export interface GameGroup {
  id: string;
  /** 排在前面的组先显示 */
  order: number;
  /**
   * 组内怎么排序：
   * - year：按 yearApprox —— 典故用（历史长卷从上古走到明清）
   * - index：按内容数组里的登记顺序 —— 三十六计用（按计策序号排，年代反而会打乱）
   */
  orderBy: 'year' | 'index';
}

/** 三十六计一共六套（胜战 / 敌战 / 攻战 / 混战 / 并战 / 败战），套名是界面文案，见 i18n */
export const STRATAGEM_SETS = 6;

export const GROUPS = [
  { id: 'allusion', order: 10, orderBy: 'year' },
  { id: 'stratagem', order: 20, orderBy: 'index' },
] as const satisfies readonly GameGroup[];
```

加一个新分组只要三步（注释里写得很清楚）：

1. 在 `GROUPS` 里加一行（`id` / `order` / `orderBy`）；
2. 在 `packages/i18n/src/messages.ts` 补 `group.<id>.title` / `.note` / `.empty` —— 少写一个就**编译报错**；
3. 把内容加进来并写明 `"group": "<id>"`。schema **刻意不给默认值**：忘了写就在构建期报错，免得三十六计的游戏被悄悄归到「典故」里。

`groupBy()` 还有一个容易被忽略的行为：**空组也会返回**。一个组暂时没有内容时，它必须在大厅里占一个位置显示成「敬请期待」—— 否则「分组」就只是数据结构里的一行，用户看不到。

## 6.5 TEMPLATE_IDS：26 个模板的唯一事实源

```ts
export const TEMPLATE_IDS = [
  // 典故
  'substitution', 'tap', 'place', 'aim', 'sort', 'trace', 'wait', 'beacon',
  'mark', 'split', 'burrow', 'butcher',
  // 三十六计 第一~四辑
  'ruse', 'siege', 'borrow', 'stillness', 'window',
  'show', 'twoline', 'read', 'matchup',
  'probe', 'lure', 'chase',
  'swap', 'chain',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];
```

26 个 id 的分工：

- **24 个共享场景模板**：`packages/templates` 里有对应的 `./<id>` 场景子路径，多个游戏复用（如 `tap` 被盘古 / 精卫 / 夸父 / 愚公共用）；
- **2 个游戏专属场景**：`beacon`（烽火戏诸侯）与 `butcher`（庖丁解牛）—— 场景实现在 game 包里，但数据登记在模板层，这样内容体检能用对应的 schema 校验关卡脚本；
- 开局 `story` 与典故卡 `reward` 是**所有游戏共用**的场景，不算模板 id；盘古的 `chaos` 连模板 id 都没有，是纯专属场景。

这份列表以前只写在 game-kit 的联合类型里，而 templates 的注册表是 `Record<string, ZodType>` —— 三者之间没有任何编译期约束。现在：内容 schema 用 `z.enum(TEMPLATE_IDS)`，templates 注册表用 `Record<TemplateId, ZodType>`，写错或漏登记都是 `pnpm typecheck` 错误；9 个「预留但从未实现」的 id（`match` / `order` / `drag` / `board` / `timing` / `react` / `branch` / `build` / `grow`）已经删除。

## 6.6 三层加载：首屏只买摘要

三层的入口在 `packages/content/package.json` 的 `exports` 里已经分好：

```json
"exports": {
  ".": "./src/index.ts",
  "./full": "./src/entries/detail.ts"
}
```

**`@chags/content`（默认入口）只导出摘要侧**，而且刻意**不导出 schema.ts 的运行时对象**：

```ts
// ★ 这里刻意不导出 schema.ts 的运行时对象（EntrySummarySchema 等）：
// z.object(...) 是真实副作用，只要这个入口引用 schema.ts，zod 就会跟着进首屏
// （实测 24.7 KB gzip / 首屏的 29%）。需要 zod 的地方走 '@chags/content/full'。
export * from './locale';
export * from './groups';
export * from './localize';
export * from './i18n';
export * from './entries';
export * from './split';
export { stageScript } from './stage';
export { loadEntry } from './loadEntry';
```

摘要数组本身用「结构窄化」而不是运行时 parse：

```ts
type RawSummary = Omit<EntrySummary, 'group' | 'kind' | 'ageRange'> & {
  group: string; kind: string; ageRange: number[];
};
const summaryOf = (raw: RawSummary): EntrySummary => raw as EntrySummary;

export const entrySummaries: EntrySummary[] = [summaryOf(raw), summaryOf(rawPangu), /* …53 条 */];
```

漏字段、类型不对在 `pnpm typecheck` 就红；枚举值与取值范围由构建期 `pnpm content:check` 的 zod 校验兜底。两层校验各管一段，运行时一次 parse 都不做。

进游戏时走的则是 `loadEntry()`：

```ts
export async function loadEntry(id: string, locale: Locale): Promise<ContentEntry | undefined> {
  const summary = entrySummaries.find((entry) => entry.id === id);
  if (summary === undefined) return undefined;

  const { loadDetail, loadDetailPatch } = await import('./entries/loaders');
  const detail = await loadDetail(id);
  let content: ContentEntry = { ...summary, ...detail };
  if (locale === DEFAULT_LOCALE) return content;

  const summaryPatch = patchFor(locale, id);
  if (summaryPatch !== undefined) content = mergeLocalized(content, summaryPatch);
  const detailPatch = await loadDetailPatch(id);
  if (detailPatch !== undefined) content = mergeLocalized(content, detailPatch);
  return content;
}
```

`entries/loaders.ts` 是整个仓库唯一使用 `import.meta.glob` 的地方：

```ts
const DETAIL = import.meta.glob<{ default: EntryDetail }>('./*.game.json');
const EN_DETAIL = import.meta.glob<{ default: unknown }>('../i18n/en/*.game.json');

export async function loadDetail(id: string): Promise<EntryDetail> {
  const loader = DETAIL['./' + id + '.game.json'];
  if (loader === undefined) throw new Error('找不到内容详情：' + id);
  return (await loader()).default;
}
```

效果：打开一局只下自己那 **1–2 KB** 内容；以前 `loadEntry` 只有一次 `import('./entries/detail')`，Vite 把 53 条中文详情 + 53 条英文详情补丁打进同一个 chunk（**83.4 KB gzip**），打开任何一局都要把全部内容下下来。

## 6.7 英文补丁：合并、校验、漏翻三件套

英文不是「把 JSON 写成双语大杂烩」，而是**结构镜像的补丁**：

```ts
export function mergeLocalized<T>(base: T, patch: Json): T {
  if (patch === undefined) return base;
  if (Array.isArray(base) && Array.isArray(patch)) {
    return base.map((item, index) =>
      index < patch.length ? mergeLocalized(item, patch[index]) : item,
    ) as unknown as T;
  }
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      out[key] = key in out ? mergeLocalized(out[key], value) : value;
    }
    return out as T;
  }
  return patch as T;
}
```

- **对象递归合并、数组按下标逐个合并** —— 所以英文补丁必须与原文等长，翻译不能「增删一条故事」；
- `validatePatch()` 检查「字段必须存在、数组必须等长」，`content:check` 对 53 条 × 全语言跑一遍；
- `findCjk()` 找出合并后仍含中日韩字符的字段路径 —— **判据只有这一份**，内容体检与 `localize.test.ts` 共用（以前 26 个游戏测试各抄一份，一共 28 份，改规则要改 28 处）。

补丁的**加载时机**也是分层的：摘要补丁收在 `i18n/en.ts`，53 份约 9 KB gzip，只在切英文时 `ensurePatches()`；详情补丁由 `loadEntry()` 随条目加载。中文用户永远不为它们付首屏成本。

一个曾经的真实 bug 记在这里当路标：`entries/detail.ts` 的 `localizedEntry()` 一开始只合了详情那一份补丁，结果英文卡面与顶栏露出中文 —— 而 `content:check`（自己把两半拼起来查）与双语巡检（只截图、不认字）都拦不住。现在两份补丁都合，并且 `localize.test.ts` 直接对「运行时取到的英文完整条目」扫中文。

## 6.8 内容体检：content:check 的八类检查

`pnpm content:check` 跑的是 `packages/templates/src/cli/check-content.ts`，它把「内容写对了吗」拆成八类可判定的问题：

| # | 检查 | 失败示例 |
|---|---|---|
| 1 | 每段关卡脚本符合其模板 schema（`templateSchemas[stage.template].safeParse`） | `aim 脚本 targets.3.r: 必须是正数` |
| 2 | `keyMoment.beatId` 在 `story` 里 | `keyMoment.beatId 不在 story 中` |
| 3 | 至少一道 `transfer` 题 | `缺少 transfer（迁移）题` |
| 4 | id 与标题唯一 | `标题重复："女娲补天" 同时属于 nuwa 与 nuwa-2` |
| 5 | 分组必须登记过 | `xx 的分组没有登记："stratagem2"` |
| 6 | 三十六计的登记顺序 == 计策序号；`thinkingTag` 与 `transfer` 必填 | `三十六计的登记顺序必须与计策序号一致` |
| 7 | 每条的摘要 / 详情英文补丁都存在，结构对得上（`validatePatch`） | `caochong-elephant 摘要译文 story[0].text: 数组长度不一致` |
| 8 | 合并译文后重新过 schema 与模板 schema，且不得残留中文（`findCjk`） | `第 12 计 的 en 版里还有中文，漏翻字段：source.quote` |

第 8 条里最不起眼的一步是「合并之后，每一段关卡脚本还要重新过一遍模板 schema」：`game.stages[].levelScript` 在内容 schema 里是 `unknown`，如果只查内容 schema，英文译文把 `unit` 写成 `"baskets"` 就能绕过所有检查，直到玩家打开游戏才报错。

跑一次的输出长这样（节选）：

```
校验 53 个内容条目…

· 曹冲称象 (caochong-elephant)
  · 信史 / 2 幕故事 / 3 道复习题 / 3 段玩法：substitution → place → tap
…
分组：
  · allusion（17 个）
  · stratagem（36 个）
三十六计：36 计
  · 第 1 计（第 1 套）瞒天过海｜不露声色
…
内容校验通过 ✅
```

## 6.9 从 JSON 到卡片：一次数据流动

把本章的零件串起来，一条内容的完整旅程是：

```
entries/<id>.json            → entrySummaries（首屏）→ HallView / AlbumView 渲染卡片
entries/<id>.game.json       → loaders（按条目 chunk）→ loadEntry() 合并
i18n/en/<id>.json            → ensurePatches（切英文时）→ mergeLocalized 覆盖摘要
i18n/en/<id>.game.json       → 随条目加载 → mergeLocalized 覆盖详情
                              ↓
                       ContentEntry（已翻译）
                              ↓  createGameContext
              ctx.content —— 游戏只读，且不知道语言的存在
                              ↓  stageScript(ctx.content, 'tap') + asLevel
                        模板的强类型关卡脚本
```

两个「唯一事实来源」在终点汇合：**内容侧**决定「有哪些条目、属于哪组、第几计」，**注册表侧**决定「哪条能点开」。两边对不上时 `registry.test.ts` 会当场报错（第 13 章）。

## 6.10 小结

- 内容分三层：摘要进首屏、详情按条目懒加载、英文补丁再分两半按需加载；这套拆分把首屏的内容成本从 65.4 KB 压到几乎没有；
- 摘要与详情各有自己的 schema，且都用「结构窄化 + 构建期 zod」替代「运行时 parse」；
- 分组表是合集结构的唯一事实来源，空组也要在大厅占位；
- 26 个模板 id 写在内容层，是契约、注册表、内容三处共同的类型来源；
- 内容体检把「写错内容」变成构建期错误：模板脚本、迁移题、唯一性、序号、双语完整性、漏翻，八类问题各有判据。

下一章进入玩法层：模板库如何用二十四个场景支撑五十三个条目。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/CHAGS/第05章-Vue应用外壳详解/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/CHAGS/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/CHAGS/第07章-玩法模板库详解/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

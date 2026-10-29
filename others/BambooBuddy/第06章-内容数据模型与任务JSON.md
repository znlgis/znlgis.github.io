---
layout: default
title: 第06章 - 内容数据模型与任务JSON
---

# 第06章 - 内容数据模型与任务JSON

## 6.1 为什么把一条内容拆成两半

十条日常任务，每条内容被切成两个文件：`tasks/<id>.json`（摘要，481 字节量级）和 `details/<id>.game.json`（详情，含关卡脚本与三句语音文案）。拆的依据不是「好不好看」，而是**谁在什么时候读它**：

| 读的人 | 需要什么 | 时机 |
|---|---|---|
| 小屋、任务页、装扮页、日记页 | 标题、emoji、时段、收益、习惯、日记行、提示 | 首屏，同步 |
| 玩法宿主 `PlayView` | 上面全部 + `intro` / `done` / `retry` / `levelScript` | 孩子点开某一关那一刻，异步 |
| 家长页 | 摘要里的 `habit` 与今日记录 | 首屏之后 |

摘要必须同步可用，因为首屏没有「加载中」这种状态——小屋一出现就要有五维条和两个推荐入口。详情可以异步，因为进入玩法本来就有一次页面切换，孩子在等 200 毫秒和等 20 毫秒之间没有感知差别。

拆开之后首屏省掉的不是 10 份 JSON 的体积（那加起来不到 12 KB），而是**一条更贵的依赖**：zod。`@bamboo/content` 的主入口宁可只导出常量与摘要，也不导出 `schema.ts` 里的运行时对象：

```ts
// packages/content/src/index.ts
/**
 * ★ 这里**刻意不导出** schema.ts 的运行时对象：zod 的 z.object(...) 是真实副作用，
 * 只要主入口引用它，zod 就会跟着进首屏（CHAGS 实测 24.7 KB gzip / 首屏的 29%）。
 * 需要 zod 的地方走 '@bamboo/content/full'（Node CLI 与测试）。
 */
export * from './ids';
export type { TaskDetail, TaskDetailExtra, TaskSummary } from './schema';
export type { DetailPatch, SummaryPatch } from './localize';
export { TASKS, getTaskSummary, taskSummaries, ensureSummaries, allTaskIds } from './tasks';
export { loadTask } from './loadTask';
```

注意第二行：`export type`。类型在编译后消失，运行时不会留下任何 `import 'zod'`；真正需要 `TaskSummarySchema` 的只有 `@bamboo/content/full`（Node CLI 与单测）和 `packages/templates/src/cli/check-content.ts`。三份入口对应三种读者：

| 入口 | 内容 | 读者 |
|---|---|---|
| `@bamboo/content` | 常量 + 十条摘要 + `loadTask()` | 外壳（首屏） |
| `@bamboo/content/ids` | 只有常量，不含 JSON 也不含 zod | `packages/progress` 的纯逻辑、单测 |
| `@bamboo/content/full` | 中英两份完整内容 + schema | `content:check`、单测 |

`package.json` 的 `exports` 把这三条路径锁死，外壳侧的 eslint 规则再把 `/full` 这条封掉（第 2 章、第 5 章都提过）。

把账算一遍就更清楚了。本次构建的产物里，首屏 `index-<hash>.js` 是 137,128 字节（另加 CSS 与两个 `modulepreload` 共享 chunk）、共享的 `common-<hash>.js` 是 96,763 字节、英文补丁 `en-<hash>.js` 是 8,985 字节，而十个详情 chunk（`content-<id>-<hash>.js`）在 209–720 字节之间。zod 4.6.7 如果被主入口带进来，按 CHAGS 的实测是 24.7 KB gzip —— 那会是一笔超过首屏三分之一的单点支出，而它换来的东西（在浏览器里校验十条已经在构建期校验过的 JSON）一次都不会失败。

拆两半还有第二个好处：`content:check` 变成了唯一的内容门禁。因为详情不在首屏路径上，它就可以「贵」一点 —— 递归校验关卡脚本、递归找残留中文、要求每个模板都被真实内容用到。这些检查放在浏览器里是负担，放在 CI 里是资产。

## 6.2 ids.ts：所有 id 只在这里定义一次

`packages/content/src/ids.ts` 是整个内容层的底座，57 行，不 import 任何东西：

```ts
export const LOCALES = ['zh-CN', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-CN';

/** 十个日常主题：id 同时是内容 id、存档键、游戏包导出名 —— 只在这里定义一次 */
export const TASK_IDS = [
  'brush', 'wash', 'feed', 'dress', 'bath',
  'sleep', 'tidy', 'sport', 'emotion', 'learn',
] as const;
export type TaskId = (typeof TASK_IDS)[number];

export const TEMPLATE_IDS = [
  'scrub', 'feed', 'dress', 'order', 'tidy', 'rhythm', 'pick', 'learn',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const STAT_KEYS = ['fullness', 'energy', 'clean', 'mood', 'health'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const TIME_SLOTS = ['morning', 'noon', 'evening'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];
```

「只在这里定义一次」是硬要求，不是风格问题。`brush` 这个字符串同时出现在七个地方：内容 JSON 的 `id`、`TASK_IDS`、`registry` 的键、`games/daily/package.json` 的 `exports` 子路径、游戏入口的 `manifest.id`、存档里的 `save.tasks.brush`、e2e 的 `[data-testid="task-card-brush"]`。前四处有工具串联（`Record<TaskId, ...>` 少一个就编译失败），后三处靠约定，所以 `content:check` 会逐条核对 `taskDetails.length === TASK_IDS.length` 且每个 id 都出现过。

`LOCALES` 与 `DEFAULT_LOCALE` 也是「只定义一次」的：`packages/game-kit` 的 `GameContext.locale`、`packages/i18n` 的取词器、外壳的 `stores/locale` 都从这里再导出，而不是各写一遍 `'zh-CN' | 'en'`。这样做还有一个副作用：将来加第三种语言时，编译器会把所有需要补分支的地方列出来，而不是等到线上发现某处仍在写死两种。

`ids.ts` 还带了两份时段名，因为它同时被内容和界面需要：

```ts
export const SLOT_LABELS: Record<TimeSlot, string> = { morning: '早上', noon: '中午', evening: '晚上' };
export const SLOT_LABELS_EN: Record<TimeSlot, string> = { morning: 'Morning', noon: 'Noon', evening: 'Evening' };
```

中文时段名给内容侧与调试输出用；界面上的时段标题走 `@bamboo/i18n` 的 `time.*` 键（第 12 章），所以英文界面里不会漏出「早上」。

typecheck 能挡住这七处里的三处：`registry` 是 `Record<TaskId, GameLoader>`，少一行就报属性缺失；`TASKS` 在模块加载时自检 `task.id !== id`；`templateSchemas` 用 `satisfies Record<TemplateId, ZodType>` 要求模板键齐全。剩下四处（`package.json` 的 `exports` 子路径、`manifest.id`、存档键、testid）没有编译期关联，靠 `content:check` 与 e2e 兜底。这也解释了为什么一个十条内容的游戏愿意写 167 个单测加五套 e2e：**同一个字符串出现在七个地方，就必须有工具替人数。**

## 6.3 tasks/<id>.json：一条摘要的 15 个字段

`packages/content/src/tasks/brush.json` 是最典型的一条（481 字节）：

```json
{
  "id": "brush",
  "title": "刷牙",
  "emoji": "🪥",
  "color": "#e9b7a7",
  "timeSlots": ["morning", "evening"],
  "template": "scrub",
  "durationHintSec": 45,
  "ageRange": [4, 8],
  "unlockLevel": 1,
  "stats": { "clean": 16, "mood": 5 },
  "reward": { "shoots": 2, "xp": 12 },
  "habit": "早晚都要刷牙",
  "diary": "今天帮竹竹刷了牙，牙齿亮晶晶。",
  "tip": "上面、下面、里面，都要刷到哦"
}
```

字段与约束逐条（来自 `TaskSummarySchema`，`packages/content/src/schema.ts`）：

| 字段 | 类型 / 约束 | 谁在用 |
|---|---|---|
| `id` | `z.enum(TASK_IDS)` | 路由、registry、存档键 |
| `title` | 字符串 1–24 字 | 任务卡、游戏内顶栏、页面标题 |
| `emoji` | 字符串 1–8（按码点，容纳组合 emoji） | 卡片图标、日记行、贴纸册 |
| `color` | `/^#[0-9a-fA-F]{6}$/` | 任务卡装饰色（不承担语义） |
| `timeSlots` | `TIME_SLOTS` 数组，1–3 个 | 时段推荐、任务页分组 |
| `template` | `z.enum(TEMPLATE_IDS)` | 选哪个模板场景、`content:check` 选哪份 schema |
| `durationHintSec` | 整数 20–120 | 卡片上「约 45 秒」 |
| `ageRange` | 元组 `[3..9, 3..9]`，内容用 `[4, 8]` | manifest、家长页可读性说明 |
| `unlockLevel` | 整数 1–4，默认 1 | 任务页锁定态、小屋深链校验 |
| `stats` | `partialRecord(STAT_KEYS, 1..30)` | 完成后五维增量（只增不减） |
| `reward.shoots` | 整数 1–5 | 竹笋奖励 |
| `reward.xp` | 整数 5–30 | 成长值 |
| `habit` | 1–80 字 | 家长页「这周练到了什么」 |
| `diary` | 1–160 字 | 日记页一行、语音连读 |
| `tip` | 1–100 字 | 卡住 12 秒后的温柔提示 |

有两条注释比约束本身更有信息量：

- `durationHintSec` 的注释写「单局目标时长：30–90 秒（儿童注意力）」，而 schema 实际允许 20–120。**注释是设计目标，schema 是护栏**——留出宽一点的边界，是为了让「给 4 岁做的 25 秒版本」和「给 8 岁做的 100 秒版本」都不必改 schema。当前十条内容落在 40–70 秒之间。
- `stats` 的注释写「只增不减，纯正向」。schema 只校验 `min(1)`——它没法表达「不许出现负数」，这条靠约定和 code review；`stats` 的键也是可选的，一条任务可以只加 `clean` 不加 `mood`。

为什么是这三个上限：`title` 24 字对应任务卡上一行 `truncate` 的宽度，再长就会被裁成「帮竹竹…」；`emoji` 上限 8 个码点，是因为组合 emoji（带肤色或 ZWJ 序列）在 UTF-16 里会超过 2 个 `length`，用码点计比用字符计更稳；`color` 只做卡片装饰，从不承担语义 —— 色盲友好这条约束在小屋与玩法里都反复出现（第 7 章的整理模板、第 11 章的装扮页）。

一份摘要会被六个界面消费，这也是它字段偏多的原因：任务页要 `emoji` / `title` / `durationHintSec` / `habit`，小屋要 `timeSlots` 与 `unlockLevel` 做推荐与深链校验，日记页要 `diary`，小屋的「小愿望」要 `tip` 对应的提示键，玩法宿主把 `template` 与 `ageRange` 抄进 `manifest`，家长页要 `habit` 统计本周练到的习惯。**没有一个是「顺便放进来」的**；反过来，任何只被玩法用到的字段（`intro` / `done` / `retry` / `levelScript`）都被推到了详情那一半。

再看两条不同类型的：

```json
// packages/content/src/tasks/feed.json（13 行起，节选）
"timeSlots": ["morning", "noon", "evening"],
"template": "feed",
"durationHintSec": 70,
"stats": { "fullness": 22, "health": 6, "mood": 4 },
"reward": { "shoots": 3, "xp": 14 },
"habit": "不挑食，每样都尝一点",
"diary": "给竹竹喂了蔬菜和水果，它吃得很开心。",
"tip": "把食物拖到竹竹嘴边"
```

`feed` 是三个时段都能玩的一条，收益也最高（竹笋 3、成长 14）；`learn` 只在 `morning` / `noon` 出现，收益是竹笋 2、成长 13。这些数字不是随手填的：`content:check` 会临时段覆盖（每个时段至少 2 个任务）和状态覆盖（五个维度都有任务能加），而收益的量级要保证「一天玩三件小事」大约能攒下 6–8 根竹笋——刚好够在装扮页买一件便宜的衣服。

## 6.4 details/<id>.game.json：三句语音 + 一段关卡脚本

详情文件在前四个字段上所有模板都一样：

```json
{
  "intro": "来帮竹竹刷牙吧！",
  "done": "牙齿亮晶晶，竹竹笑啦！",
  "retry": "慢慢刷，再试一次。",
  "levelScript": { "room": "bathroom", "tool": "brush", "rubs": 2, "spots": [], "finish": {} }
}
```

- `intro`：进关时念的一句（≤120 字），孩子不用读；
- `done`：完成卡上的夸奖（≤120 字），同时也是 TTS 念的内容；
- `retry`：做错时的温柔提示（≤100 字），全仓库没有一句「失败」「错了」；
- `levelScript`：`z.unknown()`。**摘要 schema 故意不校验它**——它的形状由所选模板决定，校验器在 `packages/templates/src/schemas.ts`。

八个模板的关卡脚本字段差异（全部来自各 `*.logic.ts` 的 zod schema）：

| 模板 | 字段 | 约束 | 当前使用 |
|---|---|---|---|
| `scrub` | `room` / `tool` / `spots[]` / `rubs` / `finish?` | spots 4–12，rubs 1–5，finish.taps 1–12 | brush、wash、bath |
| `feed` | `room` / `foods[]` / `needKinds[]` | foods 4–8（bites 1–3），needKinds 1–4 | feed |
| `dress` | `room` / `items[]` | items 3–5，每件含 `slot` 与 `color` | dress |
| `order` | `room` / `steps[]` | steps 3–5，每步 `icon` 来自 7 个枚举 | sleep |
| `tidy` | `room` / `bins[]` / `items[]` | bins 2–4，items 4–10 | tidy |
| `rhythm` | `room` / `bpm` / `jumps` / `zone` | bpm 60–120，jumps 5–15，zone 0.15–0.5 | sport |
| `pick` | `room` / `rounds[]` | rounds 2–3，options 恰好 3 个 | emotion |
| `learn` | `room` / `rounds[]` | rounds 2–4，options 2–4，answer 为下标 | learn |

所有坐标都是 **0–1 的相对值**，由 `packages/templates/src/common.ts` 里的 `normalized` 校验：

```ts
/** 关卡脚本里的相对坐标一律 0–1（相对模板给定的交互区域），换美术不用改内容 */
export const normalized = z.number().min(0).max(1);
export const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色必须是 #rrggbb');
```

这条约定把「内容」和「像素」彻底分开：刷牙的 6 个细菌点是 0.24 / 0.38 这样的坐标，模板把它们映射到 `SCRUB_LAYOUT.stage`（250, 760, 260×220）这个矩形里。换一套美术只需要改 `layout.ts`，十条内容一个字节都不用动。

真实的两份脚本，看形状差异：

```json
// packages/content/src/details/brush.game.json（节选）
"levelScript": {
  "room": "bathroom",
  "tool": "brush",
  "rubs": 2,
  "spots": [
    { "id": "g1", "x": 0.24, "y": 0.38, "size": 0.9, "kind": "germ" },
    { "id": "g2", "x": 0.5,  "y": 0.32, "size": 1.1, "kind": "germ" }
  ],
  "finish": { "kind": "rinse", "taps": 5 }
}
```

```json
// packages/content/src/details/emotion.game.json（节选）
"levelScript": {
  "room": "bedroom",
  "rounds": [
    {
      "target": "sad",
      "question": "竹竹现在是什么心情呢？",
      "options": ["happy", "sad", "angry"],
      "comfort": "hug"
    }
  ]
}
```

三个模板共用一条内容的例子是 `scrub`：brush（`tool: brush`、6 个 `germ`、`finish: rinse 5 `）、wash（`tool: hands`、6 个 `foam`、`rinse 6`）、bath（`tool: sponge`、8 个 `dirt`、`wipe 5`）。内容只换数据，场景一份，所以刷牙是牙齿近景、洗手是水池、洗澡是浴缸——由 `tool` 决定，不由模板决定（第 7 章）。

`room` 字段在所有模板里都有，枚举是八个值：`bathroom`、`bedroom`、`kitchen`、`playroom`、`yard`、`closet`、`classroom`、`sink`。它决定背景怎么画（`drawRoom` 里每个值一套墙面色、地板色与陈设），但不决定玩法：洗手用 `sink`，洗澡用 `bathroom`，刷牙也是 `bathroom` 但配镜面近景。同一个房间可以被多条内容复用，这也是一个 `scrub` 模板能撑起三条任务的原因之一。

## 6.5 zod 落在哪、什么时候跑

内容层有两个 schema 文件，职责不同：

| 文件 | 导出 | 校验对象 | 运行时机 |
|---|---|---|---|
| `packages/content/src/schema.ts` | `TaskSummarySchema` / `TaskDetailSchema` / `hexColor` | 摘要与详情的公共形状 | 构建期（`content:check`、单测） |
| `packages/templates/src/schemas.ts` | `templateSchemas` | 各模板的 `levelScript` | 构建期（同上） |

第二个文件只有 26 行，但它是「模板契约」的锚点：

```ts
import type { ZodType } from 'zod';
import type { TemplateId } from '@bamboo/content/ids';

/**
 * 用 Record<TemplateId, ZodType> 约束：契约里多一个模板而这里没登记，
 * typecheck 当场报；内容里写错模板则 content:check 拦下。
 */
export const templateSchemas = {
  scrub: scrubLevelSchema,
  feed: feedLevelSchema,
  dress: dressLevelSchema,
  order: orderLevelSchema,
  tidy: tidyLevelSchema,
  rhythm: rhythmLevelSchema,
  pick: pickLevelSchema,
  learn: learnLevelSchema,
} satisfies Record<TemplateId, ZodType>;
```

`satisfies` 而不是 `: Record<...>` 是关键：它同时要求「键齐全」并保留每个值的具体类型，所以 `templateSchemas.scrub` 仍然是 `ZodObject<...>` 而不是 `ZodType`，下游 `safeParse(...).data` 的类型不会退化成 `unknown`。

三个「不跑 zod」的位置同样重要：

- **运行时的 `packages/content/src/tasks.ts` 不跑**。摘要直接 `RAW[id] as TaskSummary`，只核一条 `task.id !== id` 就抛错。跑 schema 会把 zod 拖进首屏，而内容在构建期已经被校验过了。
- **运行时的游戏包不跑**。`games/daily/src/games/*.ts` 里全是 `ctx.task.levelScript as ScrubLevel` 这样的断言，注释写得很直白：「已校验的数据不该在每个游戏 chunk 里再跑一遍 zod」。
- **`packages/content/src/full.ts` 跑，但只在 Node 里**。它用 `TaskDetailSchema.safeParse` 逐条校验中英两份内容，失败时把第一条 issue 拼进错误信息。

这套分工的边界很清楚：**构建期可以慢、可以严格，运行期只能快、只能宽容。** `TaskDetailSchema` 的 `safeParse` 只出现在 `full.ts` 里，而 `full.ts` 被 eslint 挡在外壳之外；浏览器里唯一的校验是 `task.id !== id` 这一行。代价是：如果有人在 CI 之外改了 `details/*.json` 又没跑 `content:check`，坏数据会一直到运行时才暴露成一次场景绘制异常 —— 所以 `pnpm verify` 把 `content:check` 放在靠前的位置，而不是只在发布前跑。

## 6.6 loadTask()：两张表、一次 merge、两条兜底

详情加载只有 54 行，核心是两张 `Record<TaskId, () => Promise<...>>` 表：

```ts
// packages/content/src/loadTask.ts
const ZH_LOADERS: Record<TaskId, () => Promise<TaskDetailExtra>> = {
  brush: () => import('./details/brush.game.json').then((m) => m.default as TaskDetailExtra),
  wash: () => import('./details/wash.game.json').then((m) => m.default as TaskDetailExtra),
  // …共十条，一条一行
};

export async function loadTask(
  id: TaskId,
  locale: Locale = DEFAULT_LOCALE,
): Promise<TaskDetail | null> {
  const summary = getTaskSummary(id, locale);
  if (!summary) return null;
  const extra = await ZH_LOADERS[id]();
  if (locale !== 'en') return mergeTaskDetail(summary, extra, undefined);
  try {
    const patch = await EN_LOADERS[id]();
    return mergeTaskDetail(summary, extra, patch);
  } catch {
    // 英文详情缺失时不阻塞游戏：用中文关卡继续（content:check 会在构建期拦住这种漏翻）
    return mergeTaskDetail(summary, extra, undefined);
  }
}
```

四条设计：

1. **`import('./details/brush.game.json')` 是静态可分析的**。Vite 因此能把每个 JSON 切成独立 chunk，命名规则在 `apps/site/vite.config.ts` 里按 `content-<id>-<hash>.js` 输出，体积报告能一眼看出哪个关卡变大了。
2. **中文详情永远是底座**。英文是补丁（`DetailPatch`），不是第二份完整内容——补丁只带 `intro` / `done` / `retry` / `levelScript`，结构字段（`id`、收益、时段）不会有两份互相漂移的拷贝。
3. **合并有兜底**。`mergeTaskDetail` 对每个字段都是 `patch.intro ?? extra.intro`，少一个字段也不该把整局游戏弄崩：

```ts
export function mergeTaskDetail(
  summary: TaskSummary,
  extra: TaskDetailExtra,
  patch: DetailPatch | undefined,
): TaskDetail {
  if (patch === undefined) return { ...summary, ...extra };
  return {
    ...summary,
    intro: patch.intro ?? extra.intro,
    done: patch.done ?? extra.done,
    retry: patch.retry ?? extra.retry,
    levelScript: patch.levelScript ?? extra.levelScript,
  };
}
```

4. **摘要缺失返回 `null` 而不是抛错**。`createGameContext` 拿到 `null` 才抛「找不到玩法内容」，错误只在这一处产生，而它会被 `PlayView` 捕获成一句人话加两个出口（第 4 章）。

`TaskDetailExtra` 的类型也很有意思：`Omit<TaskDetail, keyof TaskSummary>`。它把「详情里不属于摘要的那一半」写成了类型运算，所以以后给摘要加字段时，两张加载表里的 JSON 不需要补任何东西——`Omit` 自动把新字段归到摘要那边。

## 6.7 content:check：构建期的内容门禁

`pnpm content:check` 跑的是 `tsx packages/templates/src/cli/check-content.ts`，193 行，输出是一份人读的报告加一份错误清单。它不是「schema 的二次运行」，而是 schema **管不到**的那部分：

| 类别 | 检查项 | 失败示例 |
|---|---|---|
| 结构 | 每个任务的 `levelScript` 过对应模板 schema | 「brush（zh-CN）/ scrub 脚本 spots.0.x：...」 |
| 语义 | feed 的 `needKinds` 必须有对应食物 | 「均衡目标里有 veg，但没有任何这种食物」 |
| 语义 | tidy 的每个玩具类别必须有箱子、箱子类别不能重复 | 「玩具 ball1（ball）没有对应的箱子」 |
| 语义 | pick 每轮的 `options` 必须包含 `target`、不能重复 | 「第 2 轮的选项里没有正确答案 angry」 |
| 语义 | dress 的 `slot` 不能重复（一件衣服不能有两个位置） | 「同一件衣服被安排了两个位置」 |
| 语义 | order 的 `steps.id` 不能重复 | 「睡前步骤 id 重复」 |
| 文案 | 中文禁用词：失败、惩罚、笨蛋、输了、淘汰 | 「刷牙的提示文案出现「失败」」 |
| 文案 | 英文禁用词：fail、stupid、loser、punish | 同上 |
| 完整性 | 任务数量 == `TASK_IDS.length`，英文数量 == 中文数量 | 「任务数量不对：期望 10，实际 9」 |
| 完整性 | 每个 `TASK_IDS` 都有内容、每个 `template` 都在 `TEMPLATE_IDS` 里 | 「缺少任务内容：learn」 |
| 双语 | 英文标题不能与中文相同（疑似漏翻） | 「brush 的英文标题与中文相同」 |
| 双语 | 英文内容里不能残留中文（`findCjk` 递归） | 「英文内容里还有中文：levelScript.rounds.0.question」 |
| 覆盖 | 每个时段至少 2 个任务 | 「morning 时段只有 1 个任务」 |
| 覆盖 | 8 个模板都必须被真实内容用到 | 「模板 pick 没有被任何任务使用」 |
| 唯一 | 中文标题唯一、英文标题唯一 | 「中文标题重复：刷牙」 |

「模板都必须被用到」这条守的是一个很容易烂掉的地方：模板是通用能力，一旦某条内容改了模板，旧模板就变成死代码。检查器要求「要么用起来，要么从契约里删掉」，于是 `TEMPLATE_IDS` 的八个值必然对应八条真实内容。

`findCjk` 是漏翻的守卫，实现只有十几行，但对英文内容的 `levelScript` 同样递归——这正是最容易被漏掉的地方（关卡脚本里的 `question`、`label` 是文案，不是数据）：

```ts
export function findCjk(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    return /[\u4e00-\u9fff]/.test(value) ? [path || '(root)'] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findCjk(item, path + '[' + index + ']'));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      findCjk(item, path === '' ? key : path + '.' + key),
    );
  }
  return [];
}
```

报告的正常输出长这样（节选结构，不是逐字全文）：

```text
· 🪥 刷牙 (brush)
  · scrub / 早晚 / 45 秒 / clean+16 mood+5 / 竹笋+2 成长+12
  · 习惯：早晚都要刷牙｜语音：来帮竹竹刷牙吧！

时间段覆盖：
  · morning：4 个（刷牙、洗手、吃饭、学习）
  · noon：5 个（…）
  · evening：6 个（…）

内容校验通过 ✅
```

任何一条失败都会 `process.exit(1)`，所以它可以直接放进 `pnpm verify` 的某个阶段（第 3 章、第 14 章）。

报告里还有一类「不算错误但值得看一眼」的行：每个任务的模板 / 时段 / 时长 / 状态增量 / 收益都打在一行上，英文部分只列翻译通过的任务标题。这份输出是给人读的，所以它同时是「内容体检报告」与「发布前的最后一眼」—— 某条任务突然只剩一个时段、某个模板再没人用、某条英文标题和中文一模一样，都会在这一屏里显形。

## 6.8 英文目录：一个补丁文件 + 二十个小 JSON

`packages/content/src/i18n/en/` 的结构刻意做得很碎：

| 文件 | 条数 | 内容 |
|---|---|---|
| `summaries.ts` | 1 | 把 10 个摘要补丁聚成 `EN_SUMMARY_PATCHES` |
| `<id>.json` × 10 | 10 | 摘要补丁：`title` / `habit` / `diary` / `tip` |
| `<id>.game.json` × 10 | 10 | 详情补丁：`intro` / `done` / `retry` / `levelScript` |

摘要补丁一个只有四行：

```json
{
  "title": "Brush Teeth",
  "habit": "Brush your teeth morning and night",
  "diary": "I helped Bamboo brush his teeth — they are shiny!",
  "tip": "Brush the top, the bottom and the inside too."
}
```

`SummaryPatch` 的类型就是 `Partial<Pick<TaskSummary, 'title' | 'habit' | 'diary' | 'tip'>>`：只翻「人读的」字段，结构字段（id / emoji / 时段 / 收益）不重复维护。这不是省事，是防漂移——两份 `timeSlots` 迟早会不一致，而结构字段本来就不需要翻译。

二十个小文件被 `packages/content/src/i18n/en/summaries.ts` 聚成一份：

```ts
import bath from './bath.json';
// …十条

/** 英文摘要补丁集中成一个小 chunk：切语言时只下载这一份（约 4 KB） */
export const EN_SUMMARY_PATCHES: Record<TaskId, SummaryPatch> = {
  brush, wash, feed, dress, bath, sleep, tidy, sport, emotion, learn,
};
```

打包结果里这份就是 `en-<hash>.js`，实测 6,260 字节。中文用户永远不下载它——`ensureSummaries('zh-CN')` 直接 `Promise.resolve()`；`ensureSummaries('en')` 才动态 `import('./i18n/en/summaries')`，并且用 `enLoading ??=` 做 single-flight、失败时置空缓存以便重试：

```ts
export function ensureSummaries(locale: Locale): Promise<void> {
  if (locale !== 'en' || enSummaries !== null) return Promise.resolve();
  enLoading ??= import('./i18n/en/summaries')
    .then((module) => {
      enSummaries = module.EN_SUMMARY_PATCHES;
      const localized = TASKS.map((task) => localizeSummary(task, enSummaries?.[task.id]));
      cache.en = localized;
      maps.en = new Map(localized.map((task) => [task.id, task]));
    })
    .catch(() => {
      // 英文补丁加载失败（离线/资源被清）时回落到中文，比空白页好
      enLoading = null;
    });
  return enLoading;
}
```

注意 `cache` 与 `maps` 两张表都是按语言缓存的：`cache` 给列表页（`taskSummaries(locale)`），`maps` 给按 id 取（`getTaskSummary(id, locale)`）。中文的两张表在模块加载时就建好，所以首屏一次 `Map` 查找都没有额外成本。

英文详情补丁则是整份关卡脚本的镜像——每一句 `question`、`label` 都要翻，`content:check` 的 `findCjk` 会逐字段确认。这也是为什么 `detail` 的英文补丁比摘要补丁大得多（1,000 字节 vs 170 字节）。

英文详情的加载表也值得看一眼：`EN_LOADERS` 与 `ZH_LOADERS` 是两张并排的 `Record<TaskId, () => Promise<...>>`，十条一眼能对出「哪个文件对应哪个任务」。它们刻意没有合并成一张表，因为两者返回的类型不同（`TaskDetailExtra` vs `DetailPatch`），合并会让 `loadTask` 里多一次类型断言 —— 而那张表是十个任务里唯一需要人手维护的「登记点」，宁可让它难写错一点、好读一点。

双语的三层在这一章只出现了两层半：摘要补丁与详情补丁是「内容」，界面文案在 `@bamboo/i18n`（第 12 章），第三层是语音 —— `platform.audio.speak(text, locale)` 按语言挑嗓音，而 `text` 正是这里合并出来 `intro` / `done` / `retry` 或日记行。所以一份漏翻的英文详情不会只影响眼睛：它会用中文嗓音念英文，或者用英文嗓音念中文。`content:check` 的「英文标题不得与中文相同」「英文内容零中文残留」两条，本质上是在守语音通道。

还有一处边界要记住：**内容层只管那十条任务**。第 17 章的三款隐藏小游戏没有 `tasks/*.json`、没有 `details/*.game.json`，`content:check` 也不检查它们——它们的「内容」是种子与常量，写在 `games/arcade/src/*.logic.ts` 里。这不是漏掉了统一，而是有意的划分：内容 JSON 的价值在于「换一条任务不写代码」，而三款街机的关卡是程序生成的，没有可运营的内容可换。

到这里，内容层的三个问题都答完了：一条内容长什么样、它在什么时机被读、它怎么被守住。下一章进入这些内容真正被消费的地方——八个玩法模板，看同一份 `levelScript` 如何变成可玩的交互。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/BambooBuddy/第05章-Vue应用外壳详解/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/第07章-玩法模板库详解/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

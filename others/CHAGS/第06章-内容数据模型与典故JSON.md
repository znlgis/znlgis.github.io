---
layout: default
title: 第06章 - 内容数据模型与典故JSON
---

# 第06章 - 内容数据模型与典故JSON

## 6.1 为什么内容必须与代码分离

CHAGS 的产品承诺里有一条：合集要能长到 30–100 个典故，且**新增典故 = 加一个包 + 一份 JSON**。要做到这一点，典故的一切（故事、寓意、复习题、关卡参数）都必须以数据形式存在，代码只负责解释数据。

`packages/content` 就是这个数据层，它由四部分组成：

```
packages/content/src/
├─ schema.ts            # AllusionSchema（zod）：一切内容的形状与约束
├─ allusions/*.json     # 十二份典故内容（中文为基准语言）
├─ allusions/index.ts   # 构建期 zod 解析 + 查询函数（getAllusion / stageScript ...）
├─ i18n/en/*.json       # 英文翻译补丁（结构镜像，只写需要翻译的字段）
├─ i18n/index.ts        # patchFor(locale, id)
├─ locale.ts            # LOCALES / DEFAULT_LOCALE / speechLang
└─ localize.ts          # mergeLocalized / validatePatch
```

关键理念：**校验在构建期，而不是运行时**。`allusions/index.ts` 在被 import 的瞬间就用 zod 解析全部十二份 JSON，内容里任何一个字段写错，开发服务器会立刻报错，而不是等孩子点开才发现。

## 6.2 AllusionSchema 逐字段

```ts
export const AllusionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id 只能是小写字母、数字与连字符'),
    /** 信史 / 神话 / 传说：典故馆要分开呈现（神话落在时间轴最左端） */
    kind: z.enum(['history', 'myth', 'legend']).default('history'),
    title: z.string().min(1),
    pinyin: z.string().min(1),
    dynasty: z.string().min(1),
    era: z.string().min(1),
    /** 用于历史长卷排序，公元前为负数 */
    yearApprox: z.number().int(),
    figures: z.array(z.string().min(1)).min(1),
    source: SourceSchema,
    /** 一句话寓意，孩子能听懂 */
    moral: z.string().min(1).max(90),
    keywords: z.array(z.string().min(1)).min(2).max(6),
    ageRange: z.tuple([z.number().int(), z.number().int()]),
    story: z.array(StoryBeatSchema).min(2).max(6),
    keyMoment: KeyMomentSchema,
    misconceptions: z.array(z.string().min(1)).min(1),
    quiz: z.array(QuizQuestionSchema).min(2),
    game: z.object({
      /** 主玩法模板，用于缩略图与筛选 */
      template: z.string().min(1),
      /** 实际参与编排的各段脚本，按顺序执行 */
      stages: z.array(GameStageSchema).min(1).max(3),
    }),
  })
  // ... 五条 refine 规则见 6.3
```

每个字段的用途与约束：

| 字段 | 约束 | 用途 |
|---|---|---|
| `id` | 小写字母 / 数字 / 连字符 | 三处对账的关键字：内容、注册表、游戏包 |
| `kind` | `history` / `myth` / `legend`，默认 history | 典故馆徽章；神话的 `yearApprox` 为负数，排在最前 |
| `title` / `pinyin` / `figures` | 非空 | 大厅卡片、典故卡 |
| `dynasty` / `era` | 非空 | 卡片上的朝代信息 |
| `yearApprox` | 整数，公元前为负 | 排序；将来历史长卷的横轴 |
| `source` | `{ book, chapter?, quote }` | 典故卡的出处与原文引用 |
| `moral` | ≤ 90 字 | 一句话寓意，孩子能听懂 |
| `keywords` | 2–6 个 | 卡片标签、复习关联 |
| `ageRange` | 二元组 | 大厅展示 |
| `story` | 2–6 幕 | 分幕绘本的正文与旁白 |
| `keyMoment` | 见 6.5 | 教学核心的数据锚点 |
| `misconceptions` | ≥ 1 条 | 常见误解（用于生成干扰项、复习材料） |
| `quiz` | ≥ 2 题，含 ≥ 1 道 transfer | 复习测验 |
| `game.template` | 主模板 id | 缩略图与筛选（如 `grow`、`substitution`） |
| `game.stages` | 1–3 段，`{ template, levelScript }` | 实际编排；`levelScript` 的形状由模板 schema 校验 |

## 6.3 五条「物理不可绕过」的内容规则

schema 末尾的五条 `refine` 是整个数据模型里最值得学习的部分 —— 它们把**教学与质量要求写成了数据结构不可违反的约束**：

```ts
.refine((v) => v.quiz.every((q) => q.answer < q.options.length), {
  message: 'quiz 的 answer 下标越界',
  path: ['quiz'],
})
.refine((v) => v.keyMoment.options.filter((o) => o.isCanonical).length === 1, {
  message: 'keyMoment 必须恰好有一个 isCanonical 选项',
  path: ['keyMoment'],
})
.refine((v) => v.story.some((b) => b.id === v.keyMoment.beatId), {
  message: 'keyMoment.beatId 必须存在于 story 中',
  path: ['keyMoment', 'beatId'],
})
.refine((v) => new Set(v.story.map((b) => b.id)).size === v.story.length, {
  message: 'story 的 beat id 不能重复',
  path: ['story'],
})
.refine((v) => v.quiz.some((q) => q.kind === 'transfer'), {
  message: '至少需要一道 transfer（迁移）题，否则无法验证“真的记住了”',
  path: ['quiz'],
});
```

逐条对应一个真实风险：

1. **选项下标越界** → 答题时点「第二项」却指向不存在的选项；
2. **标准答案必须唯一** → 关键抉择题恰好一个 `isCanonical: true`，多了少了都说明内容设计没想清楚；
3. **关键抉择必须长在故事上** → `keyMoment.beatId` 必须命中某一幕，避免内容重组后悬挂；
4. **幕 id 不能重复** → 事件里的 `beat:enter:<id>` 依赖唯一性；
5. **必须有一道迁移题** → 记忆题（`recall`）只能证明「记得」，迁移题（`transfer`）才验证「理解」。两者在 schema 里是显式区分的：

```ts
export const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['recall', 'transfer']).default('recall'),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  answer: z.number().int().min(0),
  explanation: z.string().min(1),
});
```

## 6.4 故事：每一幕都是「一屏一句话」

```ts
export const StoryBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** 屏幕上的一句话。中日文卡得紧，英文天然更长，所以上限按英文给 */
  text: z.string().max(90),
  narration: z.string().min(1),   // 旁白可以更长，TTS 会完整读出来
  illustration: z.string().min(1).default('none'),
});
```

`text` 的 90 字符上限是**为英文留的**：中文一句话十几个字，英文翻译可能三十个字母起步。这条限制直接塑造了叙事的写法 —— 每屏只说一件事，剩下的放进 `narration` 由语音讲。

`illustration: 'none'` 是阶段 0 的占位：美术全部由游戏包用几何图形绘制（`drawBeat` 回调）。将来换成真图片时，把文件放进 `games/<id>/public` 并改这个字段即可，`content:check` 会提示确认资源就位。

## 6.5 keyMoment：数据保留、渲染放弃

```ts
export const KeyMomentSchema = z.object({
  beatId: z.string().min(1),
  question: z.string().min(1),
  options: z.array(KeyMomentOptionSchema).min(2).max(4),
  reveal: z.string().min(1),
});
```

这里有一个重要的产品历史，写进教程值得单独说明：第一版曹冲称象把关键抉择渲染成了「三选一的文字选择题」，被判定「太死板、文字太多、说教」。重做后，**关键抉择改由交互本身承载**（玩家自己撞见秤被压垮、自己做代换），`keyMoment` 数据则转为提供两样东西：

- `reveal` —— 完成关键动作时屏幕上那句揭晓语（例如盘古的「盘古倒下了，可他的眼睛成了日月，血液成了江河 —— 世界是他留下的。」）；
- `options` 与 `misconceptions` —— 复习测验与干扰项的素材。

也就是说，这个字段仍然在「教学核心」的位置上，只是不再等于一张选择题卡片。数据模型服务于教学，而不是反过来。

## 6.6 game.stages：一个典故可以由多段玩法拼成

```ts
export const GameStageSchema = z.object({
  template: z.string().min(1),
  levelScript: z.unknown(),
});
```

`levelScript` 在内容 schema 里是 `unknown`，它的真实形状由**模板层的 schema** 校验（`packages/templates/src/schemas.ts` 的 `templateSchemas` 注册表，第 7 章）。这样做的好处是内容 schema 不需要知道所有模板；代价是要求 `content:check` 做两遍校验 —— 第一遍对着注册表校验每段脚本，第二遍在合并译文后再校验一次（第 11 章）。

当前十二个典故的编排分布：

```
caochong-elephant  substitution
pangu              tap → place
houyi              aim
nuwa               place
jingwei            tap
kuafu              tap（hold 模式）
yugong             tap（带三条里程碑）
shennong           sort（带 probe 先尝后分）
dayu               tap（堵）→ trace（疏）
taigong            wait
fenghuo            beacon（专属场景，数据登记在模板层）
qiren              place
```

## 6.7 完整示例：盘古开天辟地的内容 JSON

以 `packages/content/src/allusions/pangu.json` 为例，看数据与玩法如何对应（此处为节选，斜体为注释）：

```jsonc
{
  "id": "pangu",
  "title": "盘古开天辟地",
  "pinyin": "pán gǔ kāi tiān pì dì",
  "kind": "myth",
  "dynasty": "上古",
  "era": "上古·神话",
  "yearApprox": -9999,                       // 历史长卷的最左端
  "figures": ["盘古"],
  "source": {
    "book": "《三五历纪》",
    "chapter": "三国·吴 徐整 整理",
    "quote": "天地混沌如鸡子，盘古生其中。万八千岁，天地开辟，阳清为天，阴浊为地。"
  },
  "moral": "他把自己，变成了整个世界。",
  "keywords": ["混沌", "分开", "化身"],
  "ageRange": [7, 10],

  "story": [                                  // 两幕，每屏一句话
    { "id": "s1", "title": "还没有天地",
      "text": "很久很久以前，天和地还没有分开。",
      "narration": "很久很久以前，天和地还没有分开。",
      "illustration": "none" },
    { "id": "s2", "title": "一个大鸡蛋",
      "text": "宇宙像一个鸡蛋，盘古睡在里面。",
      "narration": "宇宙像一个鸡蛋，盘古就睡在里面。",
      "illustration": "none" }
  ],

  "keyMoment": {                              // 关键抉择（数据层）
    "beatId": "s2",
    "question": "盘古倒下了，可这个世界是从哪里来的？",
    "options": [
      { "id": "nothing", "text": "什么都没有了", "isCanonical": false, "hint": "" },
      { "id": "body", "text": "他的身体变成了天地万物", "isCanonical": true, "hint": "" },
      { "id": "wake", "text": "他又醒过来了", "isCanonical": false, "hint": "" }
    ],
    "reveal": "盘古倒下了，可他的眼睛成了日月，血液成了江河 —— 世界是他留下的。"
  },

  "misconceptions": ["盘古倒下就什么都没有了", "天地本来就在那里"],
  "quiz": [
    { "id": "q1", "kind": "recall",   /* 左眼右眼变成什么 */ },
    { "id": "q2", "kind": "recall",   /* 撑了多久 */ },
    { "id": "q3", "kind": "transfer", /* 哪个也是「变成了别的东西」：毛毛虫变蝴蝶 */ }
  ],

  "game": {
    "template": "tap",                        // 主模板（展示用）
    "stages": [
      { "template": "tap", "levelScript": {
          "mode": "tap",
          "targetValue": 18000,               // 撑天目标：一万八千年
          "stepValue": 600,                   // 每次点击 +600 → 30 次点满
          "unit": "年",
          "resistance": 0.35,                 // 后半程视觉上更吃力
          "hint": "点一点，把天撑高",
          "milestones": []
      } },
      { "template": "place", "levelScript": {
          "slots": [                          // 世界上的六个空槽
            { "id": "sun",  "x": 170, "y": 300, "kind": "sun",  "radius": 62 },
            { "id": "moon", "x": 580, "y": 300, "kind": "moon", "radius": 62 },
            /* stars / wind / river / grass ... */
          ],
          "orbs": [                           // 底部托盘里的六团光
            { "id": "leftEye",  "slotId": "sun",   "x": 105, "y": 1226, "kind": "eye",
              "speak": "左眼变成了太阳" },
            { "id": "rightEye", "slotId": "moon",  "x": 215, "y": 1226, "kind": "eye",
              "speak": "右眼变成了月亮" }
            /* hair / breath / blood / skin ... */
          ]
      } }
    ]
  }
}
```

几个值得注意的数据细节：

- `targetValue / stepValue = 18000 / 600 = 30` 次点满。tap 模板的 schema 强制**整除**（「否则永远点不满」），单测里还有一条断言直接验证「正好 30 次」；
- `slots` 与 `orbs` 通过 `slotId` 建立映射，校验要求**数量一致、槽位 id 不重复、一个槽位只能有一个光球**；
- 每个 orb 带一句 `speak`（「左眼变成了太阳」）—— 归位时用**语音**说出原文，用听不用看；
- 方位有语义：日月星辰的 `y < 640`（上半屏），江河草木在下方。单测里直接断言了这个分区。

## 6.8 构建期解析与查询函数

`allusions/index.ts` 在模块加载时就完成解析：

```ts
export const allusions: AllusionContent[] = [
  AllusionSchema.parse(raw),          // 曹冲称象
  AllusionSchema.parse(rawPangu),
  AllusionSchema.parse(rawHouyi),
  /* ... 共 12 个 */
];
```

导出的查询函数是外壳与游戏包共用的数据入口：

| 函数 | 用途 |
|---|---|
| `stageScript(content, template)` | 取某典故某个模板的阶段脚本；缺失时**早失败**（「别等玩到一半才发现」） |
| `localizedAllusion(content, locale)` | 应用翻译补丁（中文基准直接返回） |
| `getAllusion(id, locale)` | 按 id 取某个典故（游戏宿主用） |
| `allusionsFor(locale)` | 取全部典故（大厅/图鉴用） |
| `allusionsByYear(locale)` | 按年代排序（大厅当前用 `yearApprox` 排序） |

```ts
/** 取某个典故里指定模板的阶段脚本；缺了就早失败，别等玩到一半才发现 */
export function stageScript(content: AllusionContent, template: string): unknown {
  const stage = content.game.stages.find((s) => s.template === template);
  if (!stage) {
    throw new Error('典故 ' + content.id + ' 缺少 ' + template + ' 阶段脚本');
  }
  return stage.levelScript;
}
```

游戏包里的 `logic.ts` 就是「取脚本 + zod 解析」两行：

```ts
// games/pangu/src/logic.ts —— 纯逻辑：不碰 Phaser，可以直接单测
export function tapLevel(content: AllusionContent): TapLevel {
  return TapLevelSchema.parse(stageScript(content, 'tap'));
}
export function placeLevel(content: AllusionContent): PlaceLevel {
  return PlaceLevelSchema.parse(stageScript(content, 'place'));
}
```

## 6.9 新增一份内容的步骤（概览）

完整流程在实战章（第 12 章）用一个新典故走一遍，这里先给检查清单：

1. 新建 `packages/content/src/allusions/<id>.json`，`id` 与文件名一致（小写、连字符）；
2. 在 `allusions/index.ts` 加 `import` 与一行 `AllusionSchema.parse(raw)`；
3. 新建英文补丁 `packages/content/src/i18n/en/<id>.json`（结构镜像，只写需要翻译的字段），并在 `i18n/index.ts` 的 `patches.en` 注册；
4. 运行 `pnpm content:check`：校验内容 schema、模板关卡脚本、译文完整性与“漏翻字段”；
5. 写游戏包、注册注册表（第 12 章详述）。

## 6.10 内容设计的经验条目

从十二份内容里可以总结出几条可直接复用的经验：

- **故事短**：两个幕起步，最多六个；每屏一句话。孩子是来「做」的，不是来读的；
- **`text` 按英文长度设限**：中文看着很短的一句话，翻成英文可能超限；schema 的上限按英文设，逼着内容写得更精简；
- **`misconceptions` 是真实素材**：写内容时先想清楚「孩子会怎么想错」，疑难点才立得住；
- **迁移题比记忆题值钱**：`transfer` 题问的是「哪个和它是同一类」，答对了才算理解（盘古的迁移题是「毛毛虫变蝴蝶」）；
- **年代可以夸张但要有据**：神话用 `yearApprox: -9999` 落在最左端，是产品决策而非历史考据；但 `source.quote` 必须是真引用 —— 儿童教育产品的信任建立在这一条上。

## 6.11 小结

- 内容是 JSON + zod schema，构建期解析、构建期校验，十二份典故一次全过才算通过；
- 五条 refine 规则把教学要求（唯一标准答案、迁移题、抉择挂在故事上）变成了数据约束；
- `game.stages` 支持一个典故由多段模板拼成，脚本形状由模板层校验；
- 双语采用「中文基准 + 翻译补丁」结构，避免把 JSON 写成双语大杂烩（细节见第 11 章）。

下一章进入「让第 30 个典故变便宜」的关键设计：玩法模板库。

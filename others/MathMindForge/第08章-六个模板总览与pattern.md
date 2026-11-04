---
layout: default
title: 第08章 - 六个模板总览与pattern
---

# 第08章 - 六个模板总览与pattern

## 8.1 模板是引擎原语：一张表看清六个模板

模板决定「画布长什么样、工具有哪些、判定怎么做」，内容 JSON 决定「这一关的具体参数」。这条边界的硬要求是**数据完备**：同一个模板要能承载编辑器生成的新关卡，不需要为每关写新代码。

| 模板 | 画布 | 典型工具 | 判定核心 | 主线 |
|---|---|---|---|---|
| `pattern` | 序列带（Phaser） | pattern + construct | 规则补全 + 换表征迁移门 | 结构 |
| `rule` | 网格地图（Phaser） | rule + counter | 程序执行 + 变体泛化 | 算法 |
| `construct` | 无（纯工具台） | construct +（按关）counter | 约束满足 + 多解 + 不可能证书 | 结构 / 算法 / 建模 |
| `simulate` | 无（指标表） | knob + probe | 预算内指标 + 换种子稳健 | 建模 |
| `experiment` | 无（数据面板） | probe +（按关）knob / construct / rule | 大样本胜率 / 模型 + 证据充分 | 数据 / 算法 |
| `argue` | 无（棋盘由工具渲染） | counter + probe + 论证板 | 证书可检验 + 边界解释 | 边界 |

「画布」一列只有两格是 Phaser：`pattern` 与 `rule`。这条不是文档口径，而是单测钉住的——`games/forge/src/forge.test.ts` 用 `const canvasTemplates = new Set(['pattern', 'rule'])` 逐关比对 `manifest.hasCanvas`，模板形态一改就红。

模板入口的形状因此分成两类。有画布的两个模板真正创建/销毁 Phaser 实例：

```ts
// packages/templates/src/pattern/index.ts（节选）
export function definePatternLevel(manifest: LevelManifest): LevelModule {
  let game: { destroy(removeCanvas: boolean): void; loop: { sleep(): void; wake(): void } } | null = null;

  return {
    manifest,
    createRuntime: (detail, opts) => createPatternRuntime(detail, opts),
    async mount(ctx, runtime) {
      if (!ctx.canvasHost) return;
      game = createPhaserGame(ctx.canvasHost, {
        designSize: manifest.designSize,
        scenes: [createPatternScene(ctx, runtime)],
      });
    },
    async unmount() { game?.destroy(true); game = null; },
    pause() { game?.loop.sleep(); },
    resume() { game?.loop.wake(); },
  };
}
```

无画布的四个模板把 `mount` / `unmount` / `pause` / `resume` 一律写成空实现，并逐条注释说明「为什么可以空」：`simulate/index.ts` 里的原话是「交互全在 ToolDock（KnobTool + MetricsTool）里，宿主把工具区拉满宽度即可，所以 mount 故意什么都不挂，只保留 LevelModule 的形状」。

六个模板共用一套契约（第 4 章讲过 `LevelModule`），但实现路径分两条：

| | 自管运行时 | 走共享适配器 |
|---|---|---|
| 谁 | `pattern`（判定带大量 pattern 专属状态与预览） | `rule`、`construct`、`simulate`、`experiment`、`argue` |
| 写法 | 自己实现 `dispatch` / `snapshot` / `subscribe` | 只写 `RuntimeAdapter`，由 `createRuntimeWithAdapter` 包壳 |
| 换表征门 | 在模板 runtime 的 `submit` 里手接 | 共享运行时统一处理（`transferVariants` 可选） |

共享适配器的接口把「模板要写什么」压到了九个方法：

```ts
// packages/templates/src/shared/runtime.ts（节选）
export interface RuntimeAdapter<S> {
  initialState(detail: LevelDetail, now: number): S;
  /** 只处理工具动作；run/submit/reset 由共享运行时统一处理 */
  apply(state: S, action: LevelAction): AdapterResult<S>;
  artifact(state: S): unknown | null;
  checkpoints(state: S, ctx: TemplateCheckpointContext): Record<string, boolean>;
  toolState(state: S): Partial<ToolStateMap>;
  validate(detail: LevelDetail, variant: RuntimeVariant, artifact: unknown): Verdict;
  actionsFor(detail: LevelDetail, variant: RuntimeVariant, artifact: unknown): LevelAction[];
  // …artifactSummaries / 可选的 argumentState / transferVariants / transferFailureClass
}
```

「只处理工具动作；run/submit/reset 由共享运行时统一处理」这句话很重要：三个宿主动作的判定顺序（无产物 → 缺证据 / 有产物先结构校验 → 再缺证据 → 最后迁移门）只写一遍，走适配器的五个模板不会各写一套；`pattern` 因为要多维护一份「预览」状态而自管运行时，但 `submit` 里的判定顺序与共享路径同语义（第 8.4 节）。

六个模板的失败类也集中在各自 `logic.ts` 的 `FAILURE_CLASSES` 常量里，内容必须为可达失败类提供反馈（第 6 章的 `content:check` 会查）。

## 8.2 pattern 模板：schema 只有两个对象

`pattern` 模板最薄，脚本 schema 只有两个对象：

```ts
// packages/templates/src/pattern/schema.ts（全文）
import { z } from 'zod';

export const patternScriptSchema = z.object({
  scenario: z.object({
    kind: z.literal('path'),
    length: z.number().int().min(3).max(24),
    visible: z.array(z.string().min(1).nullable()).min(3).max(24),
    startIndex: z.number().int().min(0).max(12).default(0),
    symbols: z.record(z.string(), z.string()).optional(),
  }),
  pattern: z.object({
    allowedPeriods: z.array(z.number().int().min(2).max(6)).min(1),
    allowedTransforms: z.array(z.enum(['none', 'mirror', 'rotate', 'shift', 'reflect'])).min(1),
    ambiguous: z.boolean().default(false),
  }),
});
export type PatternScript = z.infer<typeof patternScriptSchema>;

export const patternArtifactSchema = z.object({
  patternRule: z.object({
    tokens: z.array(z.string().min(1)).min(2).max(6),
    period: z.number().int().min(2).max(6),
    transform: z.enum(['none', 'mirror', 'rotate', 'shift', 'reflect']),
  }),
  repair: z.array(z.object({ index: z.number().int().min(0), token: z.string().min(1) })),
});
```

- `scenario.visible` 用 `null` 表示缺口，**缺口位置就是玩法本身**（12 格里有 3 个 null）；
- `allowedPeriods` 与 `allowedTransforms` 是「这一关允许的规律空间」，玩家声明超出范围的规则会被 `validateRule` 判 `pattern-rule-invalid`；
- `ambiguous` 是本关是否接受多种读法（对称墙那关同时接受「重复」与「镜像」两种规则）；
- `scenario.symbols` 是可选字段——它就是**换表征迁移门**的入口，第 8.6 节展开。

产物 schema（`patternArtifactSchema`）不属于内容，而是给测试与审计用的：`solutions` / `negativeSamples` 里的 `artifact` 必须能被它描述。

## 8.3 logic：三分支判定，每种失败都有名字

`packages/templates/src/pattern/logic.ts` 里的 `validateArtifact` 是 pattern 的判定核心。它按「产物里有什么」分成三条路径：

```ts
// packages/templates/src/pattern/logic.ts（节选）
export function validateArtifact(
  script: PatternScript,
  variant: PatternVariant,
  artifact: unknown,
): Verdict {
  const applied = applyVariant(script, variant);
  const symbols = symbolsOf(variant);
  const relabeled = Object.keys(symbols).length > 0;
  const world = toWorld(applied, symbols);
  const artifacts = summarizeArtifact(artifact);
  const candidate = artifact as { patternRule?: { tokens?: unknown }; repair?: unknown } | null | undefined;
  const hasRule = Boolean(candidate?.patternRule && Array.isArray(candidate.patternRule.tokens));
  const hasRepair = Array.isArray(candidate?.repair);
  // 既没声明规律、也没补块：这是"空产物"，要报明确的结构失败类（A1b），不能走缺证据分支。
  if (!hasRule && !hasRepair) {
    return {
      passed: false,
      stamps: [],
      failure: { class: 'pattern-rule-invalid', variantId: variant.id, causes: [] },
      missingEvidence: [],
      artifacts,
    };
  }
  // …
}
```

三条路径对应三种玩家行为：

| 产物状态 | 走哪条判定 | 典型失败类 |
|---|---|---|
| 没有规律也没有补块 | 直接判空产物 | `pattern-rule-invalid` |
| 有规律（`patternRule`） | `validatePattern(world, artifact)` | `pattern-cycle-wrong` / `pattern-repair-incomplete` / `pattern-mismatch` |
| 只有补块 | `validateRepairOnly(script, repair)` | `pattern-repair-incomplete` / `pattern-mismatch` / `pattern-cycle-wrong` |

第二条路径是主判定，实现在纯逻辑包 `@mmf/toolkit/pattern` 里，四步顺序固定：

```ts
// packages/toolkit/src/pattern/index.ts（节选）
export function validatePattern(world: PatternWorld, artifact: unknown): PatternValidation {
  // 1) 规则是否合法（tokens 2–6、period 与 tokens 等长且在 allowedPeriods 内、transform 合法）
  const ruleError = validateRule(world, rule);
  if (ruleError) return { passed: false, failureClass: ruleError };
  // 2) 规则必须在每一个可见格上成立
  for (let i = 0; i < world.length; i += 1) {
    const visible = world.visible[i];
    if (visible === null || visible === undefined) continue;
    if (tokenAt(rule, i) !== visible) return { passed: false, failureClass: 'pattern-cycle-wrong', conflictIndex: i };
  }
  // 3) 缺口必须全部补上
  if (missing.length > 0) return { passed: false, failureClass: 'pattern-repair-incomplete', missingIndices: missing };
  // 4) 补的块必须与规则一致
  if (mismatch.length > 0) return { passed: false, failureClass: 'pattern-mismatch', mismatchIndices: mismatch };
  return { passed: true };
}
```

第 2 步返回的是 `conflictIndex`——**第一个冲突格的位置**，它会被翻成 `FailureCause` 的 `{kind: 'cell', ref: '5'}`，画布据此把那一格画成裂纹。这就是「可观察后果」的实现方式：失败不是一个布尔值，而是「从哪一格开始断的」。

「规律在某一格应该是什么」由 `tokenAt` 算，五种变换各有公式：

```ts
// packages/toolkit/src/pattern/index.ts（节选）
/** 规则在第 index 位应该生成的 token。index 从 0 开始。 */
export function tokenAt(rule: PatternRule, index: number): string {
  const period = rule.period > 0 ? rule.period : rule.tokens.length;
  if (rule.transform === 'reflect') {
    const cycle = period * 2;
    const position = ((index % cycle) + cycle) % cycle;
    return rule.tokens[position < period ? position : cycle - 1 - position] ?? '';
  }
  const i = ((index % period) + period) % period;
  switch (rule.transform) {
    case 'mirror': return rule.tokens[(period - 1 - i) % period] ?? '';
    case 'rotate': return rule.tokens[(i + 1) % period] ?? '';
    case 'shift':  return rule.tokens[(i + period - 1) % period] ?? '';
    case 'none':
    default:       return rule.tokens[i] ?? '';
  }
}
```

`reflect` 与其他四种不在一个量级上：`none/mirror/rotate/shift` 都是「周期内平移」，`reflect` 是**周期翻倍后的往返**——它让 `ABC` 读成 `ABCCBA`，正是「对称补墙」那关需要的读法。负数取模的 `((x % n) + n) % n` 不是洁癖：`shift` 会算出 `i + period - 1`，不这么写会得到负下标。

第三条路径「只填不声明」值得单独说，因为它是一个真实的学习路径，而不是宽松判定：

```ts
/**
 * 「只填不声明」：没有 patternRule 时，用可见格推出的候选规律检验补的块。
 * 判据和带规律的判法同源：填法必须能被本关允许的某条规律完整解释，
 * 所以它不是放宽判定，而是允许玩家把「声明」省掉。
 */
export function validateRepairOnly(script: PatternScript, repair: unknown): { … } {
  const world = toWorld(script);
  // 1) 缺口必须补齐
  if (missing.length > 0) return { passed: false, failureClass: 'pattern-repair-incomplete', missingIndices: missing };
  // 2) 补法必须能被某条「从可见格推出来」的候选规律解释
  for (const rule of candidateRules(script)) {
    if ([...repairs].every(([index, token]) => tokenAt(rule, index) === token)) return { passed: true, rule };
  }
  // 3) 连候选规律都没有：按「规则和带子对不上」报，别退化成空判定
  return { passed: false, failureClass: 'pattern-cycle-wrong' };
}
```

注意「候选规律只由可见格推出」：`candidateRules` 遍历 `allowedPeriods`，用带子前 `period` 个**可见**格组成候选，再用 `explainsVisible` 过滤掉与任何可见格冲突的候选。这条约束保证了「只填不声明」不会变成「随便填都能过」——填法仍然要符合一条能解释整条带子的规律。

## 8.4 runtime：四个工具动作 + 三个宿主动作

`createPatternRuntime` 是少数自管运行时的模板（不走共享适配器）。它处理的动作可以分成两栏：

| 动作 | 状态影响 | 证据相位 |
|---|---|---|
| `pattern/inspect` | 记录被点过的格、相位转 `observing` | `observe` |
| `pattern/setCycle` | 写入 `rule`、`committed = false`、清掉旧预览 | `hypothesize` |
| `pattern/preview` | 生成 `preview`（预测格），不参与判定 | `observe` |
| `pattern/commit` | `committed = true`、`checkpoints.hypothesis = true` | `hypothesize` |
| `construct/place` | 在缺口写块、刷新 `fill` / `repair` 检查点 | `construct` |
| `construct/remove` | 删块、刷新检查点 | `construct` |
| `run` / `submit` / `reset` | 宿主动作：判定、出 Verdict、重置 | `run` / `result` |

两个动作的细节值得抄下来。第一，**`pattern/commit` 会先做一次规则合法性校验，失败不写状态**：

```ts
case 'pattern/commit': {
  if (!state.rule) return fail('先拼出一个重复单元。');
  const error = validateRule(world, state.rule);
  if (error) {
    emit({ phase: 'hypothesize', tool: 'pattern', action: action.type, outcome: 'fail', failureClass: error });
    notify();
    return fail('这条规律不在这一关允许的范围里。');
  }
  state.committed = true;
  // 提交后画布要让位给「哪块放错了」的即时提示，预览 ghost 先收起。
  state.preview = undefined;
  state.checkpoints.hypothesis = true;
  // …usage + emit + notify
}
```

第二，**`pattern/preview` 与「已提交」的关系很微妙**：预览的规则与已提交规则一致时不能打掉 `committed`，否则玩家「先点用这条规律、再点预览一下」会把提交状态弄丢，之后的 run/submit 全部失败：

```ts
case 'pattern/preview': {
  // rule 来自 action.payload 的 cycle/transform（省略这三行）
  const sameAsCommitted = state.committed && state.rule
    && patternRuleKey(state.rule) === patternRuleKey(rule);
  state.rule = rule;
  // 预览不是提交：只有预览的规则与已提交的规则不一致时，才让旧提交失效。
  if (!sameAsCommitted) state.committed = false;
  state.previewSeq += 1;
  state.preview = buildPreview(script, state.rule, opts.now(), state.previewSeq);
}
```

`preview` 的全部意义是「看得见」：它被写进快照的 `toolState.pattern.preview`，画布据此把预测格画成半透明 ghost。为了让它「连点也能重跑」，`buildPreview` 带一个单调递增的 `seq`，并带 `ruleKey`——周期或变换一改，旧预览立刻作废。`ruleKey` 的定义只有一行，但注释说明了为什么 `tokens` 顺序与变换都要算进去：

```ts
/** 规则指纹：tokens 顺序与变换都要算进去，否则换变换后旧预览会被误认成同一条规则。 */
export function patternRuleKey(rule: Pick<PatternRule, 'tokens' | 'transform'>): string {
  return rule.tokens.join('') + ':' + rule.transform;
}
```

`toolState.pattern` 的类型有一处刻意的「越界」：`game-kit` 的公共 `PatternToolState` 不含 `preview`（公共类型不该为一个模板扩字段），模板侧用结构化子类型 `PatternToolStateView = PatternToolState & { preview?: PatternPreview }` 在读取时窄化回来。

`submit` 的判定顺序与共享运行时一致：先看有没有产物 → 没有就报「还差一个可以提交的结构」或缺失证据；有产物先跑结构校验（真实错误优先于缺步骤提示）；结构通过但证据检查点没走完，返回「缺失证据」；最后才是迁移门。

## 8.5 scene：渲染一条带子，只在签名变化时重画

`pattern/scene.ts` 是这个模板唯一碰 Phaser 的文件（736 行）。它做四件事：画带子、处理指针、画 ghost/裂纹、把通过状态画成「小人走过去」。

布局是纯常量，住在 `layout.ts` 里，不 import Phaser——e2e 或后续真实指针测试可以安全引用。两样东西：`DESIGN = { width: 900, height: 560 }`（横向工坊台，手机竖屏时画布在上、工具台在下）与 `PATH_LAYOUT`（`startX: 70`、`y: 320`、`cellW: 56`、`cellH: 76`、`gap: 8`、`headerH: 84`）。

渲染入口只做一件事：**先比签名，没变就返回**。`render(snapshot)` 的头三行是 `const signature = this.signatureOf(snapshot); if (signature === this.lastSignature) return; this.lastSignature = signature;`，之后才 `killTweensOf` 清空容器并逐格重画。签名把「会影响画面的一切」拼成一个字符串，包括相位、revision、观察过的格、规则、补块、最近一次运行结果、失败原因，以及预览：

```ts
private signatureOf(snapshot: RunSnapshot): string {
  const pattern = patternStateOf(snapshot);
  const preview = this.activePreview(pattern);
  return [
    snapshot.phase,
    String(snapshot.revision),
    (pattern?.inspected ?? []).join(','),
    pattern?.cycle?.join('') ?? '',
    pattern?.committed ? 'committed' : 'open',
    pieces.map((piece) => `${piece.x}:${piece.shape}`).join(','),
    snapshot.lastRun?.id ?? '',
    causes.map((cause) => `${cause.kind}:${cause.ref}`).join(';'),
    // 预览也要进 signature：ghost 与「连点重新跑一遍」都靠它触发重绘。
    preview ? preview.ruleKey + '@' + preview.seq : '',
  ].join('|');
}
```

为什么需要这么细的签名：工具面板每点一次都派发一个动作，画布每收到一次 `notify` 就会调用 `render`。没有签名比对，「点一下候选规律」会连带来一次整条带子的重画（含十几次文本对象创建）；有了签名，只有真正影响画面的变化才重画。

画面上的三类「可观察后果」：

| 玩家做了什么 | 画布怎么表现 | 数据来源 |
|---|---|---|
| 点了一格 | 该格出现观察环 | `snapshot.toolState.pattern.inspected` |
| 补错了一块 | 裂纹/红圈，但**不写进 verdict** | `mismatchedPlacements(committedRule, pieces)` |
| 点「预览一下」 | 空格上出现半透明 ghost，冲突格标出不一致 | `pattern.preview` + `sameTokenShape` |

第二行有一条重要纪律：**已提交规律下放错的块只做即时提示，不能写进判定**。玩家先放错再改是允许的学习过程，画布若因此报错，就变成了「边填边判」，把探索杀死了。真正判定只在 `submit` 时发生。

`mismatchedPlacements` 用「形状族」比较而不是字符串相等：`construct` 传进来的 shape 可能是 token（`A`），也可能是调色板的形状名（`round`），两者等价。实现就是 `sameTokenShape(a, b) => shapeFamily(a) === shapeFamily(b)`，注释写明「放错提示按族比较，避免把 A 与 round 之间换个说法就误报」。

## 8.6 换表征迁移门：scenario.symbols 是真门，不是装饰

pattern 有一道其他模板没有的门：**同一抽象规律换个表示之后仍然成立**。

内容侧的表达方式是给变体加 `scenario.symbols`：

```json
{
  "id": "v-relabel-shapes",
  "axis": "representation",
  "patch": {
    "scenario": { "symbols": { "A": "round", "B": "square" } }
  }
}
```

运行时不需要区分「哪些变体是迁移门」——`transferVariants()` 的判据就是「带 symbols 的变体」：

```ts
/**
 * 迁移门：内容里所有带 `scenario.symbols` 的变体都是换表征变体，逐条要过。
 * 返回空数组表示这一关没有迁移门（template verifier 的可选约定）。
 */
export function transferVariants(detail: LevelDetail): PatternVariant[] {
  const variants = Array.isArray(detail.variants) ? detail.variants : [];
  return variants
    .filter((variant) => Object.keys(symbolsOf(variant)).length > 0)
    .map((variant) => ({ id: variant.id, axis: variant.axis, patch: { ...variant.patch } }));
}
```

判定时，带子与产物**都**要按映射翻译一遍再比较。翻译器只做字符串替换，映射里没有的 token 原样保留：

```ts
/** 把带子上的 token 按映射改名；映射里没有的 token 原样保留，不静默丢信息。 */
export function relabelVisible(visible: readonly (string | null)[], symbols: PatternSymbolMap): (string | null)[] {
  if (Object.keys(symbols).length === 0) return [...visible];
  return visible.map((token) => (
    token === null || token === undefined ? null : (symbols[token] ?? token)
  ));
}
```

与之配套的 `relabelArtifact` 对产物做同一件事：把 `patternRule.tokens` 与 `repair[].token` 逐个替换——玩家提交时用原始字母，迁移门里再换算比对。

真正的门在 `validateArtifact` 里：**只补块、不声明规律**的产物在迁移门直接失败，且失败类固定为 `pattern-transfer-failed`：

```ts
// 迁移门只认「随映射走」的产物：只填不声明的 repair-only 是把答案抄在旧表征上（空壳），
// 换个表示以后没有规律可翻译，必须报 pattern-transfer-failed，而不是悄悄当成通过。
if (relabeled && !hasRule) {
  return {
    passed: false,
    stamps: [],
    failure: {
      class: 'pattern-transfer-failed',
      variantId: variant.id,
      causes: [{ kind: 'variant', ref: variant.id, messageKey: 'level.pattern.transfer.message' }],
    },
    missingEvidence: [],
    artifacts,
  };
}
```

这条规则解释了一个设计取舍：为什么允许「只填不声明」通过母本？因为它是一个真实的学习阶梯（孩子先看出怎么填，才说得出规律）。但它过不了迁移门——换个表示以后，没有规律就没有可翻译的东西，只能算把答案抄在旧表征上。

提交时，runtime 逐条跑迁移变体，第一条失败即门失败，并把结果写进 `Verdict.variantResults`（完成面板的「变体通行证」就是读它）：

```ts
/** 逐条跑换表征变体；和 shared/runtime 的 transferCheck 同语义：第一条失败即门失败。 */
function transferCheck(artifact: unknown): { passed: boolean; results: { id: string; passed: boolean }[]; failure?: Verdict } {
  const results: { id: string; passed: boolean }[] = [];
  for (const variant of gateVariants) {
    const verdict = validateArtifact(script, variant, artifact);
    results.push({ id: variant.id, passed: verdict.passed });
    if (!verdict.passed) return { passed: false, results, failure: verdict };
  }
  return { passed: true, results };
}
```

通过的关卡会多一枚 `transfer` 印章——四枚思想印章（`constraint` / `simple` / `transfer` / `argument`）里最能说明「抽象可以搬运」的一枚：不只是约束满足，换个表示仍然成立。

## 8.7 两个真实关卡：基础路径与对称补墙

pattern 只有两关，但恰好覆盖了「基础」与「进阶」两端，且都不是给代码写的，而是**给内容写的**——两关的关卡模块各 15 行，只声明 manifest：

```ts
// games/forge/src/levels/k-structure-pattern-path.ts（全文，省略 import）
const manifest: LevelManifest = {
  id: 'k-structure-pattern-path',
  band: 'k',
  thread: 'structure',
  template: 'pattern',
  designSize: DESIGN,
  estimatedMinutes: 5,
  hasCanvas: true,
};

export default definePatternLevel(manifest);
```

`g13-structure-symmetry` 与它逐字段只差 `id` / `band` / `estimatedMinutes`。两关的差异全在 JSON 里：

| | `k-structure-pattern-path` 模式修补匠 | `g13-structure-symmetry` 对称补墙 |
|---|---|---|
| 学段 / 时长 | K / 5 分钟 | G1–3 / 6 分钟 |
| 带子 | 12 格，缺口在第 6–8 格 | 6 格，缺口在第 3–5 格 |
| 可见序列 | `ABBABB???ABB` | `ABC???` |
| 允许周期 | 2 / 3 / 4 | 3 / 6 |
| 允许变换 | `none` / `mirror` / `shift` | `none` / `reflect` |
| 黄金解 | ABB 循环 + BBA 平移（两种读法） | 重复 `ABC` 与镜像 `ABCCBA`（两种读法） |
| 迁移门 | `A→round/B→square`、`A→red/B→blue` | `A/B/C → round/square/triangle`、`→ red/blue/green` |

两关的共通结构是「两个有效解 + 若干负例 + 两个迁移变体」：模式修补匠是 3 条负例，对称墙是 4 条，负例分别覆盖不同失败类。对称墙那关有一条 `n-repeat`：`expectFailure` 写 `pattern-mismatch`，`patternRule` 是 `{tokens:["A","B","C"], period:3, transform:"none"}`，而 `repair` 补的是第 3–5 格的 `C B A`。按 `none` 变换，第 3 格该是 A 而不是 C，所以判 `pattern-mismatch`——它测的是「规则与补块不一致」这条路径，而不是「补错格子」。

对称墙的`reflect` 读法值得算一遍：规则 `tokens: [A,B,C]`、`period: 3`、`transform: 'reflect'`，`tokenAt` 里 `cycle = 6`：

| index | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| `position` | 0 | 1 | 2 | 3 | 4 | 5 |
| 取 `tokens[position < 3 ? position : 6-1-position]` | A | B | C | C | B | A |

所以「ABC???」按镜像补成 `C B A`，与黄金解 `s-mirror-cba` 的 `repair` 完全一致。这也说明了为什么 content 里两个解的 `repair` 不同却都通过：`ambiguous` 字段只声明在 `patternScriptSchema` 里，当前判定逻辑并不读它——两种解各自在自己的规则下自洽，就都算对；真正限制读法的是 `allowedPeriods` / `allowedTransforms` 这两个「规则空间」字段（`none` 与 `reflect` 才算，`rotate` 不在名单里）。

对称墙的反馈表还展示了「失败类 → 人话」的写法：`pattern-mismatch` 的 `messageKey` 是「补的块和你的对称规则不一致。」，`hintKey` 是「按镜像规则，第 4 格应该和第 3 格一样。」，`focus` 是 `repair`。

`focus` 是给画布的指令：`repair` / `conflict-cell` / `missing-cells` / `strip` / `variant` / `pattern-card`，告诉界面「这条提示该聚焦到哪里」。于是同一套失败类在不同关卡可以有完全不同的提示语，代码不用改。

## 8.8 小结

- 六个模板 = 两种形态（Phaser 画布 / 纯工具台）× 两条实现路径（自管运行时 / 共享适配器）；`hasCanvas` 只有 pattern 与 rule 为真，并由 `forge.test.ts` 钉住。
- 模板只决定「怎么判定」，内容决定「判定什么」：两关 pattern 的模块各 15 行，差异全在 JSON。
- `patternScriptSchema` 只有 `scenario` 与 `pattern` 两个对象；`visible` 里的 `null` 就是缺口，`symbols` 是迁移门开关。
- 判定三分支：空产物 / 有规律 / 只补块；四步顺序是「规则合法 → 与可见格一致 → 缺口补齐 → 补块与规则一致」，每种失败都有独立失败类与定位索引。
- `tokenAt` 支持 `none/mirror/rotate/shift/reflect` 五种变换，`reflect` 是周期翻倍的往返，对称墙靠它读成 `ABCCBA`。
- runtime 的 `preview` 只是「看得见的预测」：不进判定、改规则即作废、连点靠 `seq` 重跑；`committed` 不能被「预览同一条规则」误打掉。
- 场景渲染先比 signature 再重画；放错块只画裂纹不进 verdict，判定只在 `submit` 发生。
- 换表征门是真门：带 `scenario.symbols` 的变体逐条要过，只补块不声明规律会落 `pattern-transfer-failed`，通过多一枚 `transfer` 印章。

下一章拆 `rule` 模板：程序块、执行轨迹与「同一程序要在变体地图上照样成立」。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/MathMindForge/第07章-六件思维工具与工具台/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/MathMindForge/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/MathMindForge/第09章-rule模板-程序化规则/" class="chapter-nav__next">下一章 →</a>
</div>

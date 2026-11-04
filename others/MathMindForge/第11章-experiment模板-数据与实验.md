---
layout: default
title: 第11章 - experiment模板-数据与实验
---

# 第11章 - experiment模板-数据与实验

experiment 是「先采样、再下结论」的模板。它和 construct 的分工很清楚：construct 判定的是「你摆出来的东西对不对」，experiment 判定的是「你的结论有没有数据支撑」。这两个模板都会拒绝空答案，但拒绝的理由不同——construct 说「构造不满足约束」，experiment 说「你还没采样」。

实验模板在首发 20 关里占 5 关，是仅次于 construct 的第二大模板：

| 关卡 | 学段/主线 | mode | 工具 | 判定核心 |
|---|---|---|---|---|
| `k-data-tally` | K / 数据 | `tally` | probe | 20 个图形按 4 类统计，结论说「最多/最少」 |
| `g13-data-weather` | G1–3 / 数据 | `tally` | probe | 14 天天气按 4 类统计，偏好结论 |
| `g79-data-sampling` | G7–9 / 数据 | `sampling` | probe | 从红蓝总体抽样，样本比例 + Wilson 区间要兜住真值 |
| `g1012-data-inference` | G10–12 / 数据 | `inference` | probe | 两组比例比较，方向与「是否跨 0」要对 |
| `g1012-modeling-winrate` | G10–12 / 建模 | `duel` | knob + probe | 1000 局对局胜率 ≥ 55%、区间下界 ≥ 50%、B 种子 ≥ 52% |

一个容易踩的坑：`packages/templates/src/experiment/schema.ts` 里的 `discriminatedUnion` **只登记了 tally 与 duel 两种 mode**。sampling 与 inference 是后来加进来的，它们的 schema 分别住在 `sampling.ts` 与 `inference.ts`，由 `experimentVerifier` 在分派层补上：

```ts
// packages/templates/src/experiment/verifier.ts
function modeOf(detail: LevelDetail): 'tally' | 'duel' | 'sampling' | 'inference' {
  const script = detail.levelScript as { mode?: string } | null;
  if (script?.mode === 'sampling') return 'sampling';
  if (script?.mode === 'inference') return 'inference';
  return 'tally';
}

export const experimentVerifier = {
  parseScript(input: unknown): unknown {
    const script = input as { mode?: string } | null;
    if (script?.mode === 'sampling') return samplingScriptSchema.parse(input);
    if (script?.mode === 'inference') return inferenceScriptSchema.parse(input);
    return experiment.parseScript(input);
  },
  // ...
};
```

所以读 experiment 的代码不能只看 `schema.ts`：真正的模式清单在 `verifier.ts` 的分派里。这种「主 schema + 后加模式」的演化痕迹在四个模板里都出现过，第 9 章的 rule 也有类似的死失败类残留。

## 11.1 probe 工具：采样、统计与三类可校验结论

experiment 关没有画布，一切交互都来自 `probe`（探针）与 `knob`（旋钮）两个工具。探针的动作在契约里定义得很窄（`packages/game-kit/src/runtime.ts`）：

```ts
'probe/sample': { n?: number };
'probe/clear': Record<string, never>;
'probe/focus': { id: string };
'probe/claim': { claim: ClaimInput };
'probe/tally': { counts: Record<string, number> };
```

其中 `ClaimInput` 是这套模板的核心契约——玩家的结论必须写成三种可校验形状之一：

```ts
export type ClaimInput =
  | { kind: 'count-compare'; category: string; direction: 'most' | 'least'; tiedWith?: string[]; n: number }
  | { kind: 'stat'; statistic: 'mean' | 'proportion'; value: number; n: number; ci?: [number, number] }
  | { kind: 'difference'; delta: number; ci: [number, number]; n: number };
```

三种形状正好覆盖三类实验：

1. **`count-compare`**：分类计数关用。「哪个类别最多/最少」这种结论不是一句自由文本，而是「方向 + 类别 + 并列清单 + 样本量」四个字段。判定器可以逐字段核对。
2. **`stat`**：比例估计关用。结论是「统计量 + 数值 + 样本量 + 区间」，胜率关和抽样关都用它。
3. **`difference`**：两组比较关用。结论是「差值 + 差值区间 + 总样本量」，推断关用它。

把结论强行结构化，是为了让「结论与数据是否一致」变成可判定的问题。如果结论是一句自然语言，判定器只能做关键词匹配，那和刷题没有区别。

## 11.2 tally：整筐倒出来、数字框、合并答案

分类计数关（`k-data-tally` 与 `g13-data-weather`）的脚本非常薄，只有三样东西：每批采样量、类别定义、以及一整筐待分类的数据。

```json
{
  "mode": "tally",
  "batchSize": 5,
  "categories": [
    { "id": "circle", "label": "圆", "token": "●", "count": 6 },
    { "id": "square", "label": "方", "token": "■", "count": 5 },
    { "id": "triangle", "label": "三角", "token": "▲", "count": 6 },
    { "id": "star", "label": "星", "token": "★", "count": 3 }
  ],
  "items": ["circle", "square", "triangle", "star", "circle", "..." ]
}
```

注意 `categories[].count` 和 `items` 是两份数据，它们必须一致。`scriptIssues` 会逐类校验：

```ts
// packages/templates/src/experiment/logic.ts
const truth = truthCounts(script);
for (const category of script.categories) {
  if ((truth[category.id] ?? 0) !== category.count) {
    issues.push('类别数量与 items 不符：' + category.id + ' 声明 ' + category.count
      + '，实际 ' + (truth[category.id] ?? 0));
  }
}
```

这个「同一事实写两遍、再交叉校验」的做法在内容里很常见：`categories[].count` 是给人读的规格，`items` 是给运行时用的数据源，`scriptIssues` 保证两者不会悄悄漂移。

交互简化后，玩家不需要真的点 20 次「抓一把」。`TallyTool` 上有一个「全部倒出来」按钮：

```ts
/** 一次点击把整筐倒出来：复用 probe/sample 的 payload.n（运行时按剩余量切片）。 */
async function dumpAll(): Promise<void> {
  await dispatch({ type: 'probe/sample', payload: { n: remaining.value } });
}
```

运行时按剩余量切片，所以 `n` 传大了也不会重复采：

```ts
case 'probe/sample': {
  if (state.collected.length >= script.items.length) {
    return { state, error: '这一筐已经采完了，去看统计条。' };
  }
  const requested = action.payload.n;
  const take = typeof requested === 'number' && Number.isFinite(requested)
    ? Math.max(1, Math.floor(requested))
    : script.batchSize;
  const next = script.items.slice(state.collected.length, state.collected.length + take);
  // ...
}
```

采完之后，统计条是四个数字框（不是柱子）。一次 `probe/tally` 要把整份 counts 一次提交，运行时只认整份：

```ts
/** 数字框：blur / Enter 时把整份统计条一次 dispatch（运行时只认整份 counts）。 */
async function commitTally(): Promise<void> {
  if (busy.value || !collectionComplete.value) return;
  if (Object.keys(drafts.value).length === 0) return;
  const counts: Record<string, number> = {};
  for (const item of categories.value) {
    counts[item.id] = clampCount(drafts.value[item.id], recorded.value[item.id] ?? 0);
  }
  const ok = await dispatch({ type: 'probe/tally', payload: { counts } });
  if (ok) drafts.value = {};
}
```

最后是「合并答案」：一个 chip 同时给出「最多/最少 + 某个类别」，点一次写结论。这里最容易被忽略的是 `tiedWith`——K 关里圆和三角都是 6 个，说「最多是圆」必须把三角列进并列清单：

```ts
/** 合并答案：一个 chip 同时给出「最多/最少 + 类别」，点一次就写结论。 */
async function answer(direction: 'most' | 'least', categoryId: string): Promise<void> {
  if (!categoryId) return;
  const claim: ClaimInput = {
    kind: 'count-compare',
    category: categoryId,
    direction,
    tiedWith: tiedWithFor(categoryId),
    n: collected.value.length,
  };
  await dispatch({ type: 'probe/claim', payload: { claim } });
}
```

判定侧对并列的处理是严格的（`packages/templates/src/experiment/tally.ts`）：

```ts
/**
 * 结论必须和数据对得上：
 * - 方向 most / least 的类别要在对应极值集合里；
 * - 并列时 tiedWith 要把另外几个极值类别都列出来（多列、漏列都算错）；
 * - n 要正好等于采集总数。
 */
export function claimMatches(counts: TallyCounts, claim: ClaimInput | undefined, total: number): boolean
```

「多列、漏列都算错」这一条是有代价的：玩家可能觉得「我选了最多的那个，为什么还错」。但并列本身就是数据的一部分——如果允许漏列，玩家只要随便点一个极值类就过，`count-compare` 就退化成了单项选择。

失败类一共四条，全部是「还没准备好就下结论」的不同变体：

| 失败类 | 触发 |
|---|---|
| `probe-not-collected` | 完全没有采集数据 |
| `probe-sample-small` | 采了但没采完整筐 |
| `probe-tally-wrong` | 统计条与真实数量不一致 |
| `probe-claim-mismatch` | 结论与数据对不上（含并列漏列） |

## 11.3 duel：1000 局、Wilson 区间与三条目标线

`g1012-modeling-winrate`（胜率实验室）是实验模板里最重的一关，也是唯一同时用 knob 与 probe 的实验关。它玩的是「资源分配 + 用大样本判断策略是否真的更好」。

模型是完全确定性的（`packages/templates/src/experiment/duel.ts` 文件头写得很清楚）：

```ts
/**
 * duel（10 回合对撞实验）的纯逻辑：
 * - 每局按固定系数把 attack/defense/economy 摊成攻守分，双方同时出手；
 * - 噪声只来自注入的种子（mulberry32），同一 (seed, 局号, 回合, 位置) 结果唯一；
 * - 1000 局后给胜率与 Wilson 95% 区间。
 * 不 import Phaser/Vue/DOM，不调用 Math.random / Date.now。
 */
```

一局打 10 回合，双方每回合按经济成长算攻守分，各自乘一个噪声系数；噪声不是 `Math.random()`，而是「种子 + 回合 + 位置」喂给 `mulberry32` 得到的确定值：

```ts
/** 噪声：同一种子下每局每回合四个位置各取一次，映射到 [noiseLow, noiseHigh]。 */
function noise(base: number, round: number, side: number, coefficients: DuelCoefficients): number {
  const random = mulberry32(base + round * 131 + side)();
  return coefficients.noiseLow + random * (coefficients.noiseHigh - coefficients.noiseLow);
}
```

`simulateDuel` 跑 `n` 局，返回胜率与区间：

```ts
/** 跑 n 局，返回胜率与 Wilson 95% 区间；完全确定性。 */
export function simulateDuel(
  script: DuelScript,
  params: DuelParams,
  seed: number,
  n: number,
): DuelResult
```

关卡脚本给了一把很具体的尺子：

```json
{
  "mode": "duel",
  "rounds": 10,
  "resources": 100,
  "step": 5,
  "matches": 1000,
  "seeds": [101, 202],
  "seedIndex": 0,
  "targets": { "winRate": 0.55, "winRateLow": 0.5, "baselineB": 0.52 }
}
```

三条目标线各有分工：`winRate: 0.55` 是「A 种子胜率至少 55%」，`winRateLow: 0.5` 是「Wilson 95% 区间下界至少站住 50%」，`baselineB: 0.52` 是「换成 B 种子（202）以后仍要 ≥ 52%」。前两条防「点估计碰巧高一点」，第三条防「只对一个种子过拟合」。

边界情况被钉得很死。`paramsValid` 要求三个旋钮都用完资源、且都是 `step` 的倍数：

```ts
/** 参数必须正好用完资源点、且每个值都是 step 的整数倍。 */
export function paramsValid(script: DuelScript, params: DuelParams | undefined): boolean {
  if (!params) return false;
  for (const value of [params.attack, params.defense, params.economy]) {
    if (!Number.isInteger(value) || value < 0 || value % script.step !== 0) return false;
  }
  return paramsSum(params) === script.resources;
}
```

局数也有上限。`MAX_MATCHES = 5000` 写在一个地方，schema、运行时、校验器共用同一个常量：

```ts
// packages/templates/src/experiment/duel.ts
const rawN = input.dataset?.n;
const datasetN = typeof rawN === 'number' && Number.isInteger(rawN) ? rawN : 0;
if (datasetN <= 0) { /* exp-not-run */ }
if (datasetN > MAX_MATCHES) { /* exp-not-run：采样局数超出这一关的上限 */ }
if (datasetN < script.matches) { /* exp-sample-small */ }
```

这条上限是审查轮补的：旧实现只挡 `n <= 0`，传 `1e9` 进来会把页面跑死。判定器拿到任何产物都不直接信，而是按同一个种子和参数重新 `simulateDuel` 一遍：

```ts
const result = simulateDuel(script, input.params, input.seed, datasetN);
// ...
const target = input.checkClaim ? script.targets.winRate : script.targets.baselineB;
if (result.winRate < target) {
  return { passed: false, failureClass: 'exp-below-baseline', /* ... */ };
}
if (input.checkClaim && result.ci[0] < script.targets.winRateLow) {
  return { passed: false, failureClass: 'exp-below-baseline', /* ... */ };
}
```

结论还要落在重算出的区间里：

```ts
const tolerance = 0.01;
const inInterval = claim.value >= result.ci[0] - tolerance && claim.value <= result.ci[1] + tolerance;
if (!inInterval || Math.abs(claim.value - result.winRate) > 0.05) {
  return { passed: false, failureClass: 'exp-claim-beyond-ci', /* ... */ };
}
```

「目标线」在这里是四个常量：55%、50%（区间下界）、52%（B 种子）、1000（局数）。界面上它们必须上屏——`KnobTool` 的注释写着「目标线必须上屏：这三条决定『多高才算过』，winrate 关尤其不能藏」。

## 11.4 种子与迁移门：为什么这条关有、抽样关没有

experiment 是六个模板里**唯一在运行时保留迁移门**的模板之一（另一个是 pattern）。它的迁移门只对 duel 生效：

```ts
/**
 * 迁移门：tally 只换外观（不做 transfer）；duel 换到 B 种子再验一次胜率基线。
 */
export function transferVariants(detail: LevelDetail): RuntimeVariant[] {
  const script = parseScript(detail.levelScript);
  if (script.mode !== 'duel') return [];
  if (script.seeds.length < 2) return [];
  return [{ id: 'v-seed-b', axis: 'transfer', patch: { seedIndex: 1 } }];
}
```

对应地，duel 的校验在迁移变体下只查胜率基线、不查结论（`checkClaim: !isTransfer`），因为玩家写的那条结论是针对 A 种子的：

```ts
const isTransfer = variant.axis === 'transfer';
const check = checkDuelArtifact(script, {
  params: asParams(raw.params),
  dataset: raw.dataset,
  claim: raw.claim,
  seed,
  checkClaim: !isTransfer,
});
```

失败类在迁移场景下会被改写成 `exp-overfit-seed`：

```ts
if (isTransfer && failureClass === 'exp-below-baseline') failureClass = 'exp-overfit-seed';
```

这条门为什么是真的？因为它改变的是**数据源**：换种子 = 换一批对手抽取序列与噪声，参数不动、结论不放宽。一个只对种子 101 有效的策略会在种子 202 上掉下 52%，门就拒绝。这是「换条件重跑」的迁移门，不是「把同一个结果再判一遍」的恒真门。

反过来，tally / sampling / inference 三关的 `transferVariants` 一律返回空数组：

```ts
transferVariants(detail: LevelDetail) {
  return isSampling(detail) || isInference(detail) ? [] : experiment.transferVariants(detail);
}
```

原因和 rule 删旋转门一样：这三关的变体是「换标签、换符号、换样本量」的表征变体，判定逻辑不变。抽样关的内容里写着 `v-symbols`（换红球标签）与 `v-label`（换成红珠子），它们的作用是让玩家在换皮后仍然认得出同一个统计问题，而不是迁移证据。

## 11.5 sampling：区间必须兜住真值

抽样关（`g79-data-sampling`）给定一个红蓝总体（红 60 / 蓝 40，共 100）与固定批次，要求玩家抽两批以上、用样本比例估计总体：

```json
{
  "mode": "sampling",
  "population": { "red": 60, "blue": 40, "label": "红球" },
  "batchSizes": [20],
  "minSample": 40,
  "tolerance": 0.12,
  "minBatches": 2
}
```

抽样本身用 `mulberry32(seed)` 驱动 Fisher-Yates，只抽前 `size` 个（无放回），同一个种子结果一致：

```ts
export function drawSample(script: SamplingScript, n: number, seed: number): SamplingSample {
  const total = script.population.red + script.population.blue;
  const size = Math.max(1, Math.min(total, Math.trunc(n)));
  const rng = mulberry32(seed);
  const pool: boolean[] = [];
  for (let i = 0; i < total; i += 1) pool.push(i < script.population.red);
  // Fisher-Yates 只抽前 size 个
  for (let i = 0; i < size; i += 1) {
    const j = i + Math.floor(rng() * (total - i));
    // swap ...
  }
  // ...
  const interval = wilsonInterval(red, size);
  return { n: size, red, proportion, ci: [interval.low, interval.high], trueProportion: trueProportion(script) };
}
```

判定要过五关，顺序本身说明了「先有样本、再谈结论」：

1. 有样本（`sampling-no-sample`）；
2. 样本量 ≥ `minSample`（`sampling-too-small`）；
3. 结论存在且是 `stat`（`sampling-no-claim`）；
4. 结论里的 n 与比例和样本对得上（`sampling-claim-mismatch`）；
5. 批次数 ≥ `minBatches`（`sampling-too-few-batches`）。

最后两条是「够不够准」：

```ts
const trueValue = trueProportion(script);
if (Math.abs(claim.value - trueValue) > script.tolerance) {
  return { passed: false, failures: ['sampling-far'], metrics };
}
if (claim.ci[0] > trueValue || claim.ci[1] < trueValue) {
  return { passed: false, failures: ['sampling-ci-miss'], metrics };
}
```

`sampling-far` 是点估计偏差超过容差（0.12），`sampling-ci-miss` 是区间没兜住真值。后者是抽样关最核心的一课：**点估计可以偏，但你要把不确定性也报出来**。区间由 UI 侧的 `wilsonInterval` 计算，再随 `probe/claim` 一起提交；判定器拿区间和真值比，不看样本本身。

Wilson 区间的实现放在 toolkit（`packages/toolkit/src/shared/stats.ts`），注释写明了为什么不用正态近似：

```ts
/** Wilson 95% 区间；小样本与 0/1 边界都比正态近似稳。 */
export function wilsonInterval(successes: number, n: number, z = 1.96): Interval {
  if (n <= 0) return { low: 0, high: 1 };
  const p = Math.min(1, Math.max(0, successes / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}
```

抽样关的脚本里 `tolerance: 0.12` 与 `minSample: 40` 是一组配套的数：40 个样本在 p=0.6 时 Wilson 区间半宽约 0.15，把容差设成 0.12 意味着「点估计必须相当接近真值」，同时区间还要能兜住——两个条件一起，逼玩家真的抽够两批并取合计比例。

## 11.6 inference：两组比较、区间重叠与「差异不明确」

推断关（`g1012-data-inference`）把两组固定样本摆出来，让玩家判断「A 组是不是真的更高」：

```json
{
  "mode": "inference",
  "groups": {
    "a": { "label": "A 组", "n": 50, "successes": 35 },
    "b": { "label": "B 组", "n": 50, "successes": 15 }
  },
  "minN": 30,
  "overlapTolerance": 0.02,
  "claimOptions": ["a-higher", "b-higher", "no-clear"]
}
```

真值判定用两组 Wilson 区间是否重叠：

```ts
export function inferenceStats(script: InferenceScript): InferenceStats {
  const a = statsOf(script.groups.a);
  const b = statsOf(script.groups.b);
  const overlap = a.ci[0] <= b.ci[1] + script.overlapTolerance && b.ci[0] <= a.ci[1] + script.overlapTolerance;
  a.overlaps = overlap;
  b.overlaps = overlap;
  let truthfulClaim: InferenceStats['truthfulClaim'] = 'no-clear';
  if (!overlap) truthfulClaim = a.proportion > b.proportion ? 'a-higher' : 'b-higher';
  return { a, b, truthfulClaim };
}
```

A 组 70%、B 组 30%，区间不重叠，真值是 `a-higher`。玩家要在三个选项里选一个，结论以 `difference` 形式提交：差值 + 差值区间 + 总样本量。

判定只认三件事：样本量达标、方向与真值一致、以及「方向明确时差值的区间下界要大于 0」：

```ts
const claimDirection = raw.claim.delta > 0 ? 'a-higher' : raw.claim.delta < 0 ? 'b-higher' : 'no-clear';
if (claimDirection !== truth.truthfulClaim) {
  return { passed: false, failures: ['inference-claim-wrong'], metrics };
}
// ...
if (truth.truthfulClaim !== 'no-clear' && raw.claim.ci[0] <= 0) {
  return { passed: false, failures: ['inference-ci-includes-zero'], metrics };
}
```

最后这一条是这一关的教学点：**方向明确时，差值区间不能跨 0**。如果玩家说「A 更高」但给出的区间是 `[-0.05, 0.45]`，那他的区间实际上承认了「差异可能为零」，结论与证据自相矛盾。`inference-ci-includes-zero` 就是为这种情况准备的失败类。

## 11.7 证据充分性：三种关卡的「没采样就写结论」分别长什么样

experiment 的失败类里，「没采样就写结论」占了很大比重，但三种关卡的实现位置不同：

| 关卡 | 运行时拦截 | 判定器失败类 | UI 侧保护 |
|---|---|---|---|
| tally | `probe/tally` 在未采完时返回错误 | `probe-not-collected`、`probe-sample-small` | 统计条与答案在整筐倒出前禁用 |
| duel | `probe/claim` 在无样本时返回错误 | `exp-not-run`、`exp-sample-small` | 结论按钮在无数据时禁用 |
| sampling | — | `sampling-no-sample`、`sampling-too-small` | 结论按钮在样本不足时禁用 |

三处一起兜底，是因为任何一处都能被绕过：运行时能挡直接派发的非法动作，判定器能挡伪造的产物，UI 只负责让玩家「看得见能不能提交」。任何一层缺失，都会出现「按钮能点、点完报错」或者「不采样也能提交」的漏洞。

还有一个反复出现的口径：**产物里的数字只当摘要，判定永远从原始输入重算**。

- tally：`claimMatches(truth, claim, total)` 里的 `truth` 由 `items` 重算，不看 `dataset.counts`；
- duel：`checkDuelArtifact` 用 `simulateDuel` 重跑，不看产物里的 `wins` / `winRate`；
- sampling：真值由 `population` 直接算，不看样本；
- inference：区间由 `inferenceStats` 重算，不看产物里的 `ci`。

这是四个模板共同的防御姿态。实验关尤其不能信产物：玩家自己填的胜率若能过关，「跑 1000 局」就变成了装饰。

## 11.8 本章要点

- experiment 有四个真实 mode（tally / duel / sampling / inference），但主 schema 只登记前两个；完整清单要看 `experimentVerifier` 的分派。
- 结论必须写成三种可校验形状之一（`count-compare` / `stat` / `difference`），自由文本无法判定「结论与数据是否一致」。
- tally 关的并列必须列全（`tiedWith` 多列漏列都算错），否则 `count-compare` 会退化成单项选择。
- duel 关用确定性 `mulberry32` 噪声，1000 局跑出胜率与 Wilson 区间；三条目标线（55% / 50% 下界 / 52%B 种子）必须上屏。
- 迁移门只对 duel 生效：换 B 种子重跑，失败判 `exp-overfit-seed`；其余三关的变体是表征轴，不做迁移。
- sampling 关的 `sampling-ci-miss` 与 inference 关的 `inference-ci-includes-zero` 是同一个教学点：结论要带上不确定性，区间不能自相矛盾；「没采样就写结论」则由运行时、判定器、UI 三层共同拦截。

实验模板想教的能力，说到底是「把话说得能被数据检验」：结论要有样本量，要有区间，要能被同一份数据复算出来。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/MathMindForge/第10章-construct模板-构造与优化/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/MathMindForge/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/MathMindForge/第12章-simulate与argue模板/" class="chapter-nav__next">下一章 →</a>
</div>

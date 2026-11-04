---
layout: default
title: 第10章 - construct模板-构造与优化
---

# 第10章 - construct模板-构造与优化

construct 是「约束满足」类模板：玩家不是选一个答案，而是摆出一个同时满足若干约束的构造；判定器不关心你怎么摆，只看最终状态是否满足全部约束。它在首发的 20 关里占 **6 关**，是六个模板中用量最大的一个。

| 关卡 | 学段/主线 | mode | 工具 | 核心约束 |
|---|---|---|---|---|
| `k-modeling-share` | K / 建模 | `distribution` | construct | 4 个盘子分 8 饼干 + 4 苹果，每盘同样多 |
| `g13-modeling-pack` | G1–3 / 建模 | `distribution` | construct | 3 个盒子分 3 类各 3 件，数量相同且至少 2 类 |
| `g46-algorithm-payment` | G4–6 / 算法 | `payment` | construct + counter | 恰好付清、枚数最少，并给出贪心失效的反例 |
| `g79-structure-network` | G7–9 / 结构 | `network` | construct | 连通、成本 ≤ 9、边数 ≤ 5、关键站点接入 ≥ 3 条 |
| `g79-algorithm-schedule` | G7–9 / 算法 | `schedule` | construct | 全部课次排入、老师/班级/教室不冲突、偏好分达标 |
| `g1012-algorithm-frontier` | G10–12 / 算法 | `frontier` | construct | 给边赋权，让贪心路径严格贵于最优路径 |

「不可能证书」在这套实现里是**设计预留而非现状**：`docs/01` §模板表把它列为 construct 的认知目标之一，`docs/03` §5.6 也规划过 `g46-structure-tiling` 的第三阶段（给出不变量证书），但首发 6 个 construct 关没有用到它。schema 里确实留了一个 `placement` 占位 mode，注释写着「M1 未发布，只保证 schema 可用」。真正落地「证明某事不可能」的是 argue 模板（第 12 章）。

## 10.1 一个模板，六种 mode：分派层长什么样

construct 的脚本是一个按 mode 区分的联合类型（`packages/templates/src/construct/schema.ts`）：

```ts
export const constructScriptSchema = z.discriminatedUnion('mode', [
  paymentScriptSchema,
  placementScriptSchema,
  distributionScriptSchema,
  networkScriptSchema,
  scheduleScriptSchema,
  frontierScriptSchema,
]);
```

六个 mode 里 `placement` 是占位，实际跑的是另外五个。运行时不靠「猜」，而是先从 `levelScript.mode` 读出模式再分派（`packages/templates/src/construct/verifier.ts`）：

```ts
function modeOf(detail: LevelDetail): 'payment' | 'distribution' | 'network' | 'schedule' | 'frontier' {
  const script = detail.levelScript as { mode?: string } | null;
  if (script?.mode === 'distribution') return 'distribution';
  if (script?.mode === 'network') return 'network';
  if (script?.mode === 'schedule') return 'schedule';
  if (script?.mode === 'frontier') return 'frontier';
  return 'payment';
}
```

然后 `createConstructRuntime` 分派到五个各自的适配器：

```ts
export function createConstructRuntime(detail: LevelDetail, opts: RuntimeOptions): LevelRuntime {
  const mode = modeOf(detail);
  if (mode === 'distribution') return distribution.createDistributionRuntime(detail, opts);
  if (mode === 'network') return createNetworkRuntime(detail, opts);
  if (mode === 'schedule') return createScheduleRuntime(detail, opts);
  if (mode === 'frontier') return createFrontierRuntime(detail, opts);
  return createPaymentRuntime(detail, opts);
}
```

这种「一个模板 id、多个 mode、按字段分派」的写法，和 pattern/rule 的「一个模板一套逻辑」不同：六个 construct 关的判定逻辑、产物形状、失败类**完全不同**，唯一共享的是契约（`LevelRuntime` / `Verdict` / `RuntimeAdapter`）和交互骨架（`construct/place` 与 `construct/remove` 两个动作）。

一个副作用值得注意：`constructVerifier` 只实现了 `parseScript / validateArtifact / actionsFor / applyVariant / reachableFailureClasses` 五个方法，**没有实现 `transferVariants`**。所以这六关在运行时和 `audit:levels` 的 A6 里都没有真正的迁移门，内容里的两个变体只要求「补丁可被 `applyVariant` 解析」。这是有意为之：六关的变体全是 `representation` 轴（换标签、换单位、换预算数字），判定逻辑不变，做了也是恒真门——和第 9 章 rule 删掉旋转门是同一条理由。

## 10.2 payment：最少枚数支付的判定与贪心反例

`g46-algorithm-payment` 是唯一用满两个工具的 construct 关：construct 摆硬币，counter 反过来构造贪心算法的反例。它的脚本很短：

```json
{
  "mode": "payment",
  "denominations": [1, 3, 4],
  "target": 6,
  "maxCoins": 6,
  "counter": {
    "targetRange": [1, 20],
    "minTargetGap": 4,
    "denominationPool": [1, 3, 4, 5],
    "premises": ["greedy-optimal", "no-1-coin", "target-residue"]
  },
  "representation": { "kind": "coins", "unit": "元" }
}
```

主任务的最优解是 3+3=2 枚，而贪心会给出 4+1+1=3 枚。这个差距不是巧合，是这一关的设计核心：**面额 `[1,3,4]` 是让贪心失效的经典人造价**。支付判定要同时管三件事：

1. 面额都在允许集合里（`coin-not-allowed`）；
2. 总额严格等于目标（多了 `construct-overpay`，少了 `construct-not-optimal`）；
3. 枚数等于最优枚数（多于最优 `construct-not-optimal`，少于最优说明答案本身有矛盾，同样拒绝）。

最优枚数不是写死的，而是每次现算。`packages/templates/src/construct/engine.ts` 用完全背包求最少枚数，贪心则按「每次拿不超过余额的最大面额」模拟：

```ts
/** 贪心：每次拿不超过余额的最大面额。付不清返回 null。 */
export function greedyCoins(denominations: readonly number[], target: number): CoinPlan | null
/** 最优：完全背包，dp[value] = 凑出 value 的最少枚数；不可达返回 null。 */
export function optimalCoins(denominations: readonly number[], target: number): CoinPlan | null
```

两者在同一个实例上跑一遍，就得到反例判定：

```ts
export function evaluateCounterexample(instance: CounterInstance, mainTarget?: number): CounterEvaluation {
  const greedy = greedyCoins(instance.denominations, instance.target);
  const optimal = optimalCoins(instance.denominations, instance.target);
  const greedyCount = greedy ? greedy.count : null;
  const optimalCount = optimal ? optimal.count : null;
  const surplus = greedyCount !== null && optimalCount !== null ? greedyCount - optimalCount : 0;
  return {
    // ...
    surplus,
    isCounterexample: surplus > 0,
    targetGap: mainTarget === undefined ? null : Math.abs(instance.target - mainTarget),
  };
}
```

counter 面板给玩家三个失效前提选项，但判定器只接受一个正确答案（`premiseIsCorrect`）：

```ts
/**
 * 失效前提判定：反例推翻的命题固定是"贪心总是最优"。
 * no-1-coin / target-residue 是给反例面板的干扰项，M1 不接受它们作为解释。
 */
export function premiseIsCorrect(premiseId: string, evaluation: CounterEvaluation): boolean {
  return evaluation.isCounterexample && premiseId === 'greedy-optimal';
}
```

「没有 1 元面额」「目标除不尽」都是**看起来合理但可被检验为假**的干扰项——干扰项必须能被同一个反例证伪，否则就成了猜谜。

counter 的失败类有六个，来自 `packages/templates/src/construct/logic.ts` 的 `counterFailure`，顺序本身表达校验优先级：

```ts
/**
 * 顺序有意义：
 * 1) 没填反例 → counter-not-tested（还没开始做反例）；
 * 2) 复用了主任务参数 → counter-reused-main（即使贪心确实更差，也不接受）；
 * 3) 目标离主任务太近（< minTargetGap）→ 同样按"和主任务太像"拒绝；
 * 4) 贪心并不差 / 数字对不上 → counter-invalid；
 * 5) 前提不对 → counter-wrong-premise。
 */
```

第 2、3 条是这一关最容易被忽视的设计：**复用主任务的例子不算反例**，哪怕它真的让贪心失手。主任务 `6 / [1,3,4]` 的贪心是 3 枚、最优 2 枚，本来就是个反例；如果允许直接复用它，玩家只要把题目抄一遍就能通关。`minTargetGap: 4` 保证「目标必须离开主任务足够远」，`targetRange: [1, 20]` 则把构造空间限制在可枚举的范围内。

## 10.3 counter 面板：编辑即自动测，选前提即提交

反例面板（`packages/toolkit-ui/src/CounterTool.vue`）在交互简化轮里被压成两步：改目标/面额 → 点一条前提。

改数字时不是「先填好再按测试」，而是每次改动都自动重测。组件里的 `commitEdit` 就是这件事：

```ts
/** 编辑即自动测：玩家不用再点一次"测试贪心"。 */
async function autoTest(): Promise<void> {
  const result = await props.runtime.dispatch({ type: 'counter/test', payload: {} });
  if (!result.ok) error.value = result.message ? props.t.t(result.message) : null;
}

async function commitEdit(): Promise<boolean> {
  if (!(await dispatchEdit())) return false;
  await autoTest();
  return true;
}
```

同时，面板上有实时读数「贪心 N 枚 / 最优 M 枚 / 差 +1」，这份读数在组件内自己算了一遍（`greedyCount` / `optimalCount`），不等运行时返回。玩家改一个数字，屏幕立刻告诉他这个例子是否让贪心失手。

前提就是最终答案。`selectPremise` 直接派发 `counter/annotate`：

```ts
async function choosePremise(id: string): Promise<void> {
  if (busy.value || !lastTest.value?.passed) return;
  premise.value = id;
  // ...
  const result = await props.runtime.dispatch({ type: 'counter/annotate', payload: { premiseId: id } });
  // ...
}
```

运行时这边，`annotateCounter` 直接把 `committed` 置真：

```ts
// 指出失效前提就是最终作答：不需要再点提交反例（编辑即自动测，选前提即提交）。
const next: CounterDraft = { ...draft, premiseId, committed: true };
```

配套地，产物里不再写「测没测过」这类状态。`createAdapter` 的 `artifactOf` 只留可重算的判定输入：

```ts
// 产物只留可重算的判定输入：测没测过、提没提交由运行时状态负责，
// 不再写进 artifact（编辑即自动测，选择前提即最终作答）。
counterexample: counter ? {
  target: counter.target,
  denominations: [...counter.denominations],
  greedyCoins: evaluation?.greedy ? evaluation.greedy.count : undefined,
  optimalCoins: evaluation?.optimalCount ?? undefined,
  isCounterexample: evaluation?.isCounterexample ?? false,
  failedPremise: counter.premiseId,
} : null,
```

注意 `greedyCoins` / `optimalCoins` / `isCounterexample` 这三个值写在产物里，但判定器**不信任它们**：`counterFailure` 会自己重算一遍，只有在玩家声明了这几个数时才拿来对比（`greedy-mismatch` / `optimal-mismatch`）。产物字段是给人看的摘要，判定永远从原始输入重算——这是这套模板里反复出现的口径。

## 10.4 distribution：计数矩阵、一键照分与「不信任自报总数」

分配关（`k-modeling-share`、`g13-modeling-pack`）的产物是一个计数矩阵：

```ts
export const distributionArtifactSchema = z.object({
  distribution: z.object({
    containers: z.array(z.object({
      id: z.string(),
      counts: z.record(z.string(), z.number().int().min(0)),
      total: z.number().int().min(0),
    })),
    totals: z.record(z.string(), z.number().int().min(0)),
  }),
});
```

判定器不信任产物里的 `total` 和 `totals`，而是按关卡登记的物品重新数一遍（`packages/templates/src/construct/distribution.ts`）：

```ts
// 容器里的件数按"本关登记的物品"重新数，不信任产物自报的 total：
// 否则多写一个未登记物品就能把 minKinds 凑够，或把 total 写小绕过容量上限。
```

这条防御直接对应一个可绕过的漏洞：如果相信自报的 `total`，玩家（或一次畸形提交）只要多写一个未登记物品键，就能把 `minKinds` 凑够。同理，多出来的物品键、超过 `maxPerContainer` 的件数、没分完的库存，都必须被拒绝。

失败类一共五条，覆盖五个不同的出错方向：

| 失败类 | 触发 |
|---|---|
| `distribution-empty` | 一件都没放 |
| `distribution-overflow` | 某个容器超过 `maxPerContainer` |
| `distribution-missing-kind` | 某容器里的物品种类少于 `minKinds` |
| `distribution-shortage` | 某种物品没分完（数量不等于总量） |
| `distribution-unequal` | `equalCounts` 打开时，各容器件数不等 |

两关的差别全在脚本里：K 关是 4 个盘子分 8 块饼干 + 4 个苹果，`minKinds: 0`、`maxPerContainer: 4`；G1–3 关是 3 个盒子分积木/球/书各 3 件，`minKinds: 2`。一关只考「每份一样多」，另一关叠加「每份至少两类」。

交互简化轮的 Tier 1 给分配关加了一个按钮：**「其余容器照这样分」**。它的实现完全在 UI 侧，运行时和 schema 一行没改（`packages/toolkit-ui/src/DistributeTool.vue`）：

```ts
/**
 * 其余容器照第一个容器分：UI 侧循环 dispatch（不改 runtime/schema）。
 * 先把其余容器清空，再按第一容器的搭配逐件放进去，保证不会触发"这种物品已经分完了"。
 */
async function copyFirstToRest(): Promise<void> {
  if (busy.value) return;
  if (copyBlockedReason.value) {
    error.value = copyBlockedReason.value;
    return;
  }
  busy.value = true;
  // 先清空其余容器，再按第一容器逐件复制
  // ...
}
```

按钮旁边会预告「每个容器各放：2 饼干 + 1 苹果」，并且有自己的阻塞原因（`copyBlockedReason`）——第一容器还没配好、或剩余库存不够复制时按钮是禁用的，而不是点了才报错。

为什么不能更激进地做成「一次点击循环数量」？`docs/12` 给过结论：产物是 4×2 的计数矩阵，且 G1–3 关有 `minKinds: 2`，单值循环会直接产出必败解。收益算下来是 13 击 → 5 击（K 关）与 10 击 → 5 击（G1–3 关）。

## 10.5 network：连通、预算、边数与「关键接入」的语义修正

路网关 `g79-structure-network` 给定 5 个站点（学校/公园/医院/市场/车站，其中学校与医院是关键站点）与 7 条候选边，要求选一组边：

```json
{
  "mode": "network",
  "nodes": [
    { "id": "A", "label": "学校", "key": true },
    { "id": "C", "label": "医院", "key": true }
  ],
  "edges": [
    { "id": "ab", "a": "A", "b": "B", "cost": 2 },
    { "id": "bd", "a": "B", "b": "D", "cost": 1 }
  ],
  "budget": 9,
  "maxEdges": 5,
  "minKeyEdges": 3
}
```

判定顺序固定：空选 → 边数超限 → 不连通 → 超预算 → 关键接入不足。连通性用并查集算连通块数，只要不是 1 块就拒绝：

```ts
export function connectedComponents(script: NetworkScript, ids: string[]): string[][] {
  const parent = new Map<string, string>();
  for (const node of script.nodes) parent.set(node.id, node.id);
  // find / union ...
  const groups = new Map<string, string[]>();
  for (const node of script.nodes) {
    const rootId = find(node.id);
    const list = groups.get(rootId) ?? [];
    list.push(node.id);
    groups.set(rootId, list);
  }
  return [...groups.values()];
}
```

`minKeyEdges` 是这一关最值得写的字段，因为它**改过一次语义**。旧实现按「端点是关键站点」累加：一条两端都关键的边算 2 条。这样在连通图上几乎必然满足，门就退化成恒真。现在的口径是「选中的边里，至少有一端是关键站点的边数」：

```ts
/**
 * minKeyEdges 的口径是「至少有几条候选边的一端是关键站点」（与工具文案一致）：
 * 同一条边即使两端都是关键站点也只算 1 条。旧实现按端点累加，会把一条
 * 两端都关键的边算成 2，和"边数"的说法对不上。
 */
export function selectedEdges(script: NetworkScript, artifact: unknown): NetworkSelection {
  // ...
  if (aKey || bKey) keyEdges += 1;
  // ...
}
```

语义改真之后立刻长出了一条新负例：`[ab, bc, bd, de]` 这组边连通、成本 7 不超预算，旧口径会 PASS，新口径判 `network-key`。这是「把恒真门改真」的标准收益——门本身没变多，但开始能拒绝东西了。

## 10.6 schedule 与 frontier：冲突检测与「让贪心走弯路」

**课表关** `g79-algorithm-schedule` 是 3 个时段 × 4 门课（数学/物理/化学/生物），`maxPerSlot: 2`、`softBonus: 1`、`targetBonus: 2`。冲突有三类，都发生在同一时段内（`packages/templates/src/construct/schedule.ts`）：

```ts
const a = lessons.get(ids[i] as string);
const b = lessons.get(ids[j] as string);
if (!a || !b) continue;
if (a.teacher === b.teacher) conflicts.push({ kind: 'teacher', slot, a: a.id, b: b.id });
if (a.className === b.className) conflicts.push({ kind: 'class', slot, a: a.id, b: b.id });
if (a.room === b.room) conflicts.push({ kind: 'room', slot, a: a.id, b: b.id });
```

除了硬冲突，还有软约束：每门课可以带一个 `preferredSlot`，排进偏好时段得 `softBonus` 分，总分不到 `targetBonus` 就判 `schedule-bonus`。这条设计把「有解就行」变成「有解且偏好达标」，在 4 门课 3 个时段的规模下，玩家必须真的权衡。

**算法边界关** `g1012-algorithm-frontier` 则反过来：拓扑固定（起点 S、终到 T，中间 A/B 两站，四条边组成两条路径），玩家给每条边赋权（每条边有 `min`/`max`/`default`），目标是让**贪心的总代价严格大于最优路径**。

```ts
/** 贪心：每到一站选当前最便宜的出边，不回头。 */
export function greedyWalk(script: FrontierScript, costs: Record<string, number>): FrontierResult['greedy']
/** 最优：固定小图，枚举所有简单路径取最小。 */
export function optimalWalk(script: FrontierScript, costs: Record<string, number>): FrontierResult['optimal']
```

`evaluateFrontier` 把两者一比：只有当贪心真的走到终点、且代价严格大于最优时，才算反例。

```ts
export function evaluateFrontier(script: FrontierScript, costs: Record<string, number>): FrontierResult {
  const greedy = greedyWalk(script, costs);
  const optimal = optimalWalk(script, costs);
  return {
    greedy,
    optimal,
    counterexample: greedy.reached && Number.isFinite(optimal.cost) && greedy.cost > optimal.cost,
  };
}
```

这一关的默认值曾经离答案只差一步：把 `bt` 从 9 改成 1 就通关，等于送分。Tier 1 重设了四条边的默认值，并把交互压到「图上改一条边 + 完成」= 2 击。改完之后，玩家要自己找到「让第一步选错、第二步就贵」的那组权值。

## 10.7 实时约束灯：同一套算法为什么要写两遍

`network`、`schedule`、`frontier` 三关都是无画布的，判定却依赖图/网格这类结构。如果玩家只有提交后才看到「还有站点没连上」，那这条信息就白给了。Tier 1 的解法是在工具面板里画 SVG 图并挂**实时约束灯**：

```ts
// packages/toolkit-ui/src/NetworkTool.vue
/** 实时约束灯：连通块 / 成本 / 关键站点 / 边数。 */
const stats = computed(() => {
  // ... 并查集 / 成本累加 / 关键边计数
  const components = new Set(ids.map((id) => find(id))).size;
  const totalKeyStations = nodes.value.filter((node) => node.key).length;
  return { components, cost, keyEdges, keyStations: keyStations.size, totalKeyStations, count: selected.value.size };
});
```

灯面上写的是「连通块 1/1 · 成本 6/9 · 接入 2/3 条」这类可核对的数，不是「还差一点」。课表关同理，冲突格直接红框（`conflicts` computed + `cellClass`），偏好分实时累加；边界关实时显示「贪心 10 / 最优 3 / 差 +7」。

这里有一个刻意的重复：**同一套算法在 `templates` 和 `toolkit-ui` 里各写了一份**。

```ts
/** 贪心：每到一站选当前最便宜的出边（与运行时 frontier.ts 同口径）。 */
const greedy = computed(() => { /* ... */ });

/** 最优：固定小图，枚举全部简单路径取最小（与运行时同口径）。 */
const optimal = computed(() => { /* ... */ });
```

原因是依赖方向：`packages/toolkit-ui/package.json` 只依赖 `@mmf/game-kit`、`@mmf/toolkit`、`@mmf/i18n` 与 `vue`，**不依赖 `@mmf/templates`**——工具组件不应该把模板包（连同 zod schema 与验证器）拉进首屏。于是 UI 侧只能自己算，靠注释和单测保证「与运行时同口径」。

这份重复的代价是口径漂移风险，收益是可观察性。`docs/12` 把这件事量化过：construct 6 关声明的 31 条失败反馈里，改造前只有 **9 条（29%）** 能在界面上到达玩家（`g79-structure-network` 的 6 条与 `g1012-algorithm-frontier` 的 4 条全部不可达，答错只会看到「先完成工具步骤」）；文档的估算结论是「只改 `shared/runtime.ts` 一笔提交顺序，可达数可提到约 17/31」。判定可观察性是这一轮的主线：约束灯让玩家在提交前就能自己发现错在哪。

## 10.8 本章要点

- construct 是「约束满足」模板：判定只看最终状态是否满足全部约束，不看构造顺序。
- 一个模板 id 下按 `mode` 分派五个真实子模式（payment / distribution / network / schedule / frontier），共享契约与两个摆放动作，判定逻辑各写一套。
- payment 用 DP 求最优、贪心做对照，反例必须离开主任务参数（`minTargetGap`），否则抄题目就能过关。
- distribution 按登记物品重算件数，不信任产物自报的 `total`——这是防绕过的关键一行。
- network 的 `minKeyEdges` 从「数端点」改成「关键站点接入的唯一边数」，恒真门被改成了能拒绝新负例的真门。
- schedule 与 frontier 分别考「硬冲突 + 偏好」和「让贪心走弯路」，后者的默认值被重设，避免送分。
- 无画布三关靠 SVG + 实时约束灯把判定变成可观察的；代价是同一套算法在 `toolkit-ui` 里再写一份。
- 「不可能证书」是 construct 的设计预留（`placement` 占位 mode 与 `g46-structure-tiling` 计划），首发 6 关未实现，真正的「证明不可能」在 argue 模板里。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/MathMindForge/第09章-rule模板-程序化规则/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/MathMindForge/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/MathMindForge/第11章-experiment模板-数据与实验/" class="chapter-nav__next">下一章 →</a>
</div>

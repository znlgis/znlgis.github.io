---
layout: default
title: 第12章 - simulate与argue模板
---

# 第12章 - simulate与argue模板

这一章讲最后两个模板。它们看起来毫不相干——simulate 让玩家调参数、跑模拟、看指标；argue 让玩家写下「为什么不可能」并接受检查——但两者共享同一个设计问题：**怎么让「你的结论」变成可检验的对象**。simulate 的结论是一组指标（覆盖率、等待、预算），argue 的结论是一份论证证书（主张、依据、证据、范围）。

两个模板在首发 20 关里共占 5 关：

| 关卡 | 学段/主线 | 模板 | mode | 工具 | 核心任务 |
|---|---|---|---|---|---|
| `g79-modeling-dispatch` | G7–9 / 建模 | simulate | `dispatch` | knob + probe | 调车辆/服务队/班次/路线，两个需求日都达标 |
| `g46-modeling-queue` | G4–6 / 建模 | simulate | `queue` | knob + probe | 调服务台/服务时长/营业时长，平均等待与预算双达标 |
| `g46-structure-tiling` | G4–6 / 结构 | argue | `tiling` | construct + probe | 8×8 去两个同色角，指出「不可能铺满」的依据 |
| `g46-data-invariant` | G4–6 / 数据 | argue | `tiling` | construct + probe | 7×7 去两角，三条不变量都能用 |
| `g1012-structure-invariant` | G10–12 / 结构 | argue | `tiling` | construct + probe | 5×5 去两角，用不变量证明不可能 |

## 12.1 simulate：参数 → 模拟 → 指标，三层都是纯函数

simulate 的骨架是一句可以背下来的话：**参数动、模拟跑、指标算**。三层全部是纯函数，不读时钟、不用随机，所以同一个参数向量必然得到同一组指标。

第四轮之后，「模拟跑」这一步不再需要玩家点按钮：**参数一改就自动运行**，指标立刻上屏。玩家只做一件事——把数字旋钮调到目标区间。归零 / 重来之后，面板会重新自动跑一次。

最底层是引擎（`packages/templates/src/simulate/engine.ts`），文件头写着它的边界：

```ts
/**
 * 调度模拟的纯函数层（docs/06 §2.4）。不碰 Phaser/Vue/DOM，也不读时间与随机源：
 * 同一组 params 必然得到同一组指标，所以可以在单测里逐项对账。
 */
```

覆盖率、等待、成本三个指标各是一个公式；等待的主体由参数决定，种子日只加一个偏移：

```ts
export function coverageOf(script: SimulateScript, params: SimParams, seed: SimSeed): number {
  const demand = totalDemand(seed);
  if (demand <= 0) return 1;
  const route = findRoute(script, params.route);
  const factor = route ? route.factor : 1;
  const effective = capacityOf(script, params) * factor;
  return Math.min(demand, effective) / demand;
}

export function waitOf(script: SimulateScript, params: SimParams, seed: SimSeed): number {
  const offset = script.formula.seedWaitOffset[seed.id] ?? 0;
  return Math.max(script.formula.minWait, baseWaitOf(script, params) + offset);
}
```

`baseWaitOf` 的公式是「30 − 4×车辆 − 2×服务队 + 班次增量 + 路线增量」，成本则是「车辆×25 + 服务队×10 + 班次×0.2」，常量全部写在关卡 JSON 的 `formula` 里。g79 的脚本（节选）把站点、两个种子日的需求与目标写在一起：

```json
{
  "mode": "dispatch",
  "stations": ["东门", "南门", "西门", "北门", "中环", "公园"],
  "seeds": [
    { "id": "A", "demand": [3, 2, 4, 3, 2, 4] },
    { "id": "B", "demand": [2, 4, 3, 2, 4, 3] }
  ],
  "targets": {
    "A": { "coverageMin": 0.9, "waitMax": 18 },
    "B": { "coverageMin": 0.85, "waitMax": 20 }
  }
}
```

两个种子日的总需求都是 18，但分布不同：A 日集中在中环与公园，B 日平均分布。**结构不变、分布变**，这就是「换种子稳健」在数据层的全部含义——而它直接写进了运行语义：

```ts
/** 一次运行同时算两个种子日——knob/run 的语义就是「同一天的两份需求都跑一遍」。 */
export function runSimulation(script: SimulateScript, params: SimParams): SimSeedMetrics[] {
  return script.seeds.map((seed) => runSeed(script, params, seed));
}
```

玩家改完参数（自动触发的）一次运行，拿到的是 A、B 两行指标，判定按两行分别检查。失败类的归属规则是：**第一个种子日不达标算「这一个种子日不达标」；第二个种子日不达标算「过拟合一个种子」**。

```ts
const checks = targetChecks(script, runs);
for (const [index, check] of checks.entries()) {
  const run = runs[index];
  const seed = script.seeds[index];
  // 第一个种子日不达标 → 覆盖率/等待；后面的种子日不达标 → 过拟合一个种子。
  const overfit = index > 0;
  if (!check.coverageOk) {
    const failureClass: SimFailureClass = overfit ? 'sim-overfit-seed' : 'sim-coverage';
    // ...
  }
  if (!check.waitOk) {
    const failureClass: SimFailureClass = overfit ? 'sim-overfit-seed' : 'sim-wait';
    // ...
  }
}
```

这条规则比它看起来重要：两个种子日共用失败类时，玩家不知道自己错在「基本方案不行」还是「只对某一天好」。分开之后，反馈能直接指向「换一天需求后第 2 辆车不够用了」。稳健性在这里不是一道额外的门，而是运行本身的一部分——`sim-overfit-seed` 不需要「换种子再跑一次」，一次运行就跑了两个。

## 12.3 不会变的道具：artifact 只证明「跑过」，指标永远重算

simulate 的产物（`SimulateArtifact`）包含参数和两个种子日的运行记录。自动判题的谓词也挂在「有没有运行产物」上，而不是「有没有点过运行」：

```ts
// 自动判题口径：只要「最近一次运行 + 参数没变」就有产物，说明答案填完了（对错交给 validate）。
// 注意不能写成 state.lastRun !== null：改参数但还没重跑的中间态必须算未完成。
answerComplete: (state) => artifactOf(state) !== null,
```

注释里那条「不能写成 `state.lastRun !== null`」是这一轮的真实踩坑：改完参数、新运行还没算出来的一瞬间，如果只看 `lastRun` 就非空，宿主会拿旧指标去判，玩家会看到「刚改完就报错」。用「参数与运行记录对得上」构成的 `artifactOf` 才不会误判（第 20 章）。

判定器不信任记录里的数字：

```ts
/**
 * 指标一律从 params 重算；runs 只用来证明「两个种子日都跑过」，
 * 里面的数字写成什么都不影响判定。
 */
export function validateArtifact(input: ScriptSource, variant: SimVariant, artifact: unknown): Verdict
```

具体做法是三步：

1. **参数先过关卡允许范围**。`normalizeParams` 检查每个旋钮都是整数、在区间内、且落在步长上：

```ts
/** 产物里的参数也要过一遍关卡允许范围：写死一组越界数字不能算跑过。 */
export function normalizeParams(script: SimulateScript, params: SimParams): SimParams | null {
  if (!fitsRange(params.vehicles, script.params.vehicles)) return null;
  if (!fitsRange(params.teams, script.params.teams)) return null;
  if (!Number.isInteger(params.shift) || !script.params.shifts.includes(params.shift)) return null;
  if (!script.routes.some((route) => route.id === params.route)) return null;
  return params;
}
```

2. **运行记录要覆盖全部种子日**。少一个种子日就判 `sim-overfit-seed`：

```ts
const missingSeeds = script.seeds
  .filter((seed) => !recordedSeeds.has(seed.id))
  .map((seed) => seed.id);
if (missingSeeds.length > 0) {
  return reject('sim-overfit-seed', [{ kind: 'sample', ref: missingSeeds.join(','), /* ... */ }], artifacts, {});
}
```

3. **指标全部重算**。`runSimulation(script, params)` 重新跑一遍，再逐项对目标：

```ts
const runs = runSimulation(script, params);
const cost = costOf(script, params);
const metrics = metricsOf(script, runs, cost);
if (!withinBudget(script, cost)) { /* sim-budget */ }
```

这套「产物只证明跑过、指标全部重算」的做法，和 experiment 里「胜率必须用同一个种子重算」是同一条原则。差别在于 simulate 的模拟量很小（两个种子日、一个公式），重算成本可以忽略；experiment 的 duel 要跑 1000 局，所以它选择了另一条路——把局数上限压死在 `MAX_MATCHES`，避免重算被拖垮。

## 12.4 queue：另一套模型，同一套骨架

排队关（`g46-modeling-queue`）和调度关共用一个模板，却几乎没有共享代码——这是 simulate 的「多 mode」面。排队模型是**离散事件模拟**：15 位顾客按固定到达时间进店，若干服务台并行接待。它同样是「改一个旋钮就自动运行」，所以 20 关交互预算里排队关的 target 是 **1**（填完 `serviceTime` 就够）。

```ts
/** 每个服务台记下一次空闲时间；到达时取最早空闲，等待 = max(0, free - arrival)。 */
export function runQueue(script: QueueScript, params: QueueParams): QueueRun {
  const free: number[] = Array.from({ length: params.servers }, () => 0);
  const arrivals = [...script.arrivals].sort((a, b) => a - b);
  // ...
  for (const arrival of arrivals) {
    let earliest = 0;
    for (let i = 1; i < free.length; i += 1) {
      if (free[i] < free[earliest]) earliest = i;
    }
    const start = Math.max(arrival, free[earliest]);
    const finish = start + params.serviceTime;
    free[earliest] = finish;
    waitTotal += start - arrival;
    // ...
  }
  // ...
}
```

排队关的判定有四个指标入口，失败类各管一个：

```ts
export function evaluateQueue(script: QueueScript, params: QueueParams): QueueEvaluation {
  const run = runQueue(script, params);
  const failures: string[] = [];
  if (run.served < script.arrivals.length) failures.push('queue-unserved');
  if (run.avgWait > script.targets.avgWaitMax + 1e-9) failures.push('queue-wait');
  if (run.overtime > script.targets.overtimeMax) failures.push('queue-overtime');
  if (run.cost > script.cost.budget + 1e-9) failures.push('queue-budget');
  return { run, failures };
}
```

但 `reachableFailureClasses` 只报四类中的四类——`queue-unserved` 被移出了可达清单。原因写在 `simulate/verifier.ts` 的注释里：

```ts
// queue-unserved 在当前排队模型里不可达：服务台永远接客、没有接待上限，
// 所以 runQueue 的 served 恒等于到达人数。把它留在"可达类"里会让 A4 的
// "每个可达类都要有负例"变成假要求（内容只能写一个永远触发不了的负例）。
// 若以后给排队加"打烊后不再接待"或"队列上限"，先改 runQueue，再把类加回来。
```

这是「删死失败类」的又一个例子：结构上不可达的失败类，留着只会让审计要求一个永远写不出来的负例。第 9 章 rule 删 `rule-not-general`、第 10 章 network 改 `minKeyEdges` 语义，都出自同一个判断标准——**失败类必须对应一条真实的拒绝路径**。

## 12.5 argue：一份论证证书的四个要素

先说去卡片化对 argue 的影响：三关原本各有一块「多米诺沙盒」（`DominoTool`）与一块「不变量探测面板」（`InvariantProbeTool`），让玩家先铺几块骨牌、点点看哪些不变量成立，再回到论证板写证书。第五轮把这两块面板**从关卡里删掉了**——`AnswerDock` 的映射表对 argue 不返回任何面板，宿主只渲染 `ArgumentBoard`。论证板内部仍然自动采样 counts，所以证据链与证书内容没有变，变的只是「玩家不再需要先做一轮沙盒实验才能作答」。

argue 的产物是一份结构化证书，形状在 `packages/templates/src/argue/schema.ts` 里：

```ts
export const argueArtifactSchema = z.object({
  counts: z.object({
    black: z.number().int().min(0),
    white: z.number().int().min(0),
    cells: z.number().int().min(0),
  }),
  argument: z.object({
    claim: z.string().min(1),
    warrant: z.string().min(1),
    scope: z.string().min(1),
    evidence: z.object({
      black: z.number().int().min(0).optional(),
      white: z.number().int().min(0).optional(),
      cells: z.number().int().min(0).optional(),
    }),
  }),
});
```

四个字段就是「论证证书四要素」：

| 要素 | 字段 | 在 argue 里的取值 | 谁来填 |
|---|---|---|---|
| 主张 Claim | `claim` | `impossible` / `possible` | 运行时由棋盘不变量推出 |
| 依据 Warrant | `warrant` | `coloring` / `parity` / `area` | **玩家点选**（唯一的真输入） |
| 证据 Evidence | `evidence` | 黑/白/总格数 | 运行时按依据自动挂上 |
| 范围 Scope | `scope` | `domino-tiling` | 运行时从脚本取第一个范围 |

这个分工是交互简化轮的结果。改造前四个要素是 6 个入口的表单，其中「主张」只有两个选项（题干已经写了答案）、「范围」只有一个选项、两个按钮（挂证据、提交论证）纯属仪式——真正的判断只有「依据选哪一个」。`docs/12` 的 P0-5 把这件事逐项核实过，结论是：

```text
主张 下拉               0 信息量（validator 写死 claim !== 'impossible' 就失败）
依据 下拉               唯一真判断
范围 下拉               0 信息量（只有 1 个选项）
"把证据挂到论证上"按钮   0 信息量（只是把 counts 抄进 argument）
"提交论证"按钮          0 信息量（与宿主「完成」重复）
attempt 检查点          0 信息量（validateArtifact 从不读骨牌）
```

改造后只留「依据」一个输入，其余三格由依据推出来。运行时的 `toArgument` 就是这条推导：

```ts
function toArgument(state: ArgueState): ArgumentSnapshot {
  const warrant = state.argument.warrant;
  const claim = warrant ? boardClaim(state.script) : undefined;
  return {
    // 主张与范围由依据推出来：界面上看到的「不可能铺满 → 1×2 多米诺铺满」不是下拉选项，是结论。
    claim,
    warrant,
    scope: warrant ? state.script.scopes[0] : undefined,
    evidence: state.argument.evidence,
    committed: isCommitted(state),
  };
}
```

`committed` 也是派生状态，不再是玩家点出来的布尔量：

```ts
/** 论证是派生状态：有依据 + 有证据 + 有棋盘计数，就已经是一份提交过的证书。 */
function isCommitted(state: ArgueState): boolean {
  return Boolean(state.argument.warrant && state.argument.evidence && state.counts);
}
```

保留 `argue/commit` 动作只是为了 autoplay 与审计能走旧路径，它是幂等的：论证齐了返回成功，没齐只报缺什么。同一段注释也说明了 `answerComplete` 为什么能和 `artifact` 共用判定：

```ts
// 自动判题口径：依据一选，证据/主张/范围都由运行时派生，证书当场成立 → 该判了。
// 这里只回答「填完了没有」，依据选错（例如偶数格棋盘上选奇偶）仍由 validate 判错。
answerComplete(state) {
  return artifactOf(state) !== null;
}
```

## 12.6 判定：一条依据「能不能下结论」是可计算的

argue 的核心数学事实只有一句话：**每块 1×2 多米诺骨牌盖住一黑一白（染色）或两格（奇偶 / 面积）**。所以一张棋盘能否被骨牌铺满，可以由两条计数不变量排除：

```ts
/**
 * 一条依据到底能不能排除这张棋盘的铺满？
 *
 * 每块 1×2 骨牌都盖住「一黑一白」（染色）或「2 格」（奇偶、面积是同一个量）：
 * - coloring 成立 ⇔ 黑白格数量不等（相等就排除不了，例如 8×8 去两个异色角）；
 * - parity / area 成立 ⇔ 总格数是奇数（偶数就排除不了，例如 8×8 去两个同色角只有 62 格）。
 *
 * 判定器与界面解释共用这一条口径，避免出现「界面说能排除、判定说不能」的两套标准。
 */
export function warrantDecides(warrant: string, counts: BoardCounts): boolean {
  if (warrant === 'coloring') return counts.black !== counts.white;
  if (warrant === 'parity' || warrant === 'area') return counts.cells % 2 === 1;
  return false;
}
```

三关的棋盘是精心选的（数字来自关卡 JSON，实测重算）：

| 关卡 | 棋盘 | 去掉的角 | 总格 | 黑 / 白 | coloring | parity / area |
|---|---|---|---|---|---|---|
| `g46-structure-tiling` | 8×8 | (0,0) 与 (7,7)（同色） | 62 | 30 / 32 | 成立 | 不成立（62 是偶数） |
| `g46-data-invariant` | 7×7 | (0,0) 与 (6,6)（同色） | 47 | 23 / 24 | 成立 | 成立（47 是奇数） |
| `g1012-structure-invariant` | 5×5 | (0,0) 与 (4,4)（同色） | 23 | 11 / 12 | 成立 | 成立（23 是奇数） |

第一关是这次改造的重点：8×8 去两个**同色**角得到 62 格（偶数）、黑 30 白 32——只有 coloring 能排除，parity 与 area 都不行。这直接对应两条负例：

```json
{ "id": "n-parity-even", "expectFailure": "argue-invariant-false" }
{ "id": "n-area-even", "expectFailure": "argue-invariant-false" }
```

改造前 8×8 去的是**异色**角：仍是 62 格，但黑 31 白 31，黑白相等——coloring 反而排不掉。棋盘一换，「依据」第一次成了真选择：选错依据会被判 `argue-invariant-false` 并给出「黑白格数量相等时，染色法不能直接排除铺满」这类解释。

后两关（7×7、5×5）是奇数格棋盘，coloring 与 parity / area 同时成立，所以它们各有三条黄金解（`s-coloring` / `s-parity` / `s-area`）。这不是判定宽松，而是**数学上确实有三条独立成立的依据**；多解成立的条件是每条都真。

证据链的校验同样在判定器里：选了 coloring，就必须挂上当前棋盘的 black/white，且 `warrantDecides('coloring', actual)` 为真；选了 parity 或 area，就必须挂 `cells` 且总格数是奇数：

```ts
if (argument.warrant === 'coloring') {
  const evidence = argument.evidence ?? {};
  if (evidence.black !== actual.black || evidence.white !== actual.white) {
    return failure('argue-invariant-false', '染色证据没有挂上当前图形的黑白格数量。');
  }
  if (!warrantDecides('coloring', actual)) {
    return failure('argue-invariant-false', '黑白格数量相等时，染色法不能直接排除铺满。');
  }
} else if (argument.warrant === 'parity' || argument.warrant === 'area') {
  // 奇偶与面积是同一个量：每块 1×2 骨牌都盖住 2 格，所以只由总格数的奇偶决定。
  // 以前 area 一律判「检验不了」，但它在奇数格棋盘上和奇偶一样成立——那不是思维陷阱，是命名陷阱。
  const evidence = argument.evidence ?? {};
  if (evidence.cells !== actual.cells) {
    return failure('argue-invariant-false', '奇偶证据的格子数不对。');
  }
  if (!warrantDecides(argument.warrant, actual)) {
    return failure('argue-invariant-false', '格子数是偶数，奇偶法不能直接排除。');
  }
}
```

注释里那句「那不是思维陷阱，是命名陷阱」值得单独说：早期实现把 `area` 一律判「检验不了」，因为它被当成另一条数学依据；但在 1×2 骨牌问题里，面积（总格数）与奇偶是同一个量，凡是奇数格棋盘上面积法就成立。删掉这条假限制之后，多解数从 1 涨到 3——**判定器的区分度是靠数学事实挣来的，不是靠人为限制制造的**。

五个失败类各对应一种「证书不成立」：

| 失败类 | 触发 |
|---|---|
| `argue-evidence-missing` | 证书缺计数或主张/依据/范围 |
| `argue-claim-unsupported` | 主张不在这关选项里（含选了 `possible`） |
| `argue-invariant-false` | 统计数字与图形不符，或依据不足以排除 |
| `argue-warrant-unsupported` | 依据不在这关选项里 |
| `argue-scope-wrong` | 范围不在这关选项里（例如写成 `all-tilings`） |

## 12.7 论证板：一行组装，点一条依据就补齐四个要素

界面组件 `packages/toolkit-ui/src/ArgumentBoard.vue` 把证书压成一行：

```vue
<!-- 一行组装：依据是唯一的输入，其余三格是运行时时推出来的结论 -->
<div data-testid="argue-row" aria-live="polite" class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold">
  <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="依据">
    <button v-for="item in script.warrants ?? []" :key="item" ... @click="pick(item)">
      {{ WARRANT_LABELS[item] ?? item }}
    </button>
  </div>
  <span aria-hidden="true" class="text-ink-soft">→</span>
  <span data-testid="argue-counts" ...>{{ counts ? '黑 ' + black + ' / 白 ' + white : '黑白各几格？' }}</span>
  <span aria-hidden="true" class="text-ink-soft">→</span>
  <span data-testid="argue-claim" ...>{{ claim ? CLAIM_LABELS[claim] ?? claim : '结论？' }}</span>
  <span aria-hidden="true" class="text-ink-soft">→</span>
  <span data-testid="argue-scope" ...>{{ scope ? SCOPE_LABELS[scope] ?? scope : '适用范围？' }}</span>
</div>
```

点一条依据时，组件先数格、再写依据——一次点击完成两件事：

```ts
async function pick(next: string): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    // 一次点击 = 一次输入：先把黑白格真的数出来（观察证据），再写一条依据。
    const sampled = await props.runtime.dispatch({ type: 'probe/sample', payload: {} });
    if (!sampled.ok) { /* ... */ return; }
    const result = await props.runtime.dispatch({ type: 'argue/setWarrant', payload: { warrant: next } });
    if (!result.ok) error.value = result.message ? props.t.t(result.message) : null;
  } finally {
    busy.value = false;
  }
}
```

点完立刻有反馈，不等提交。`decisive` 用和判定器完全相同的口径算「这条依据能不能排除」：

```ts
/**
 * 这条依据在这张棋盘上到底能不能下结论。
 * 判定仍以运行时的 validateArtifact 为准，这里只把同一条数学事实翻成人话：
 * 点一下就看到"能排除 / 排除不了"，不必先点完成再碰运气。
 */
const decisive = computed<boolean | null>(() => {
  const w = warrant.value;
  const c = cells.value;
  const b = black.value;
  const wt = white.value;
  if (!w || c === null || b === null || wt === null) return null;
  if (w === 'coloring') return b !== wt;
  if (w === 'parity' || w === 'area') return c % 2 === 1;
  return null;
});
```

配套的解释文案直接把数学事实说出来：「黑 11 ≠ 白 12：每块 1×2 骨牌都盖住一黑一白，所以永远铺不满」，或者「总格 62 是偶数，每块骨牌盖 2 格，排除不了铺满，换一条依据」。玩家第一次点错依据就能理解为什么错，而不是等到「完成」被拒绝。

交互次数先由 10 击降到 3 击（`docs/12` 的 `3 关 10→3`），第五轮删掉沙盒面板后进一步降到 **1 击**：三关的交互预算 target 都是 1，e2e 里就是 `page.getByTestId('argue-warrant-coloring').click()` 一次。但真正的作答仍然只有一次：选依据。这叫**输入面收窄，判断力不变**——把 6 个零信息量入口压成 1 个真判断，才是这一轮改造的实质。

沙盒面板删除后留在代码里的痕迹也值得记一笔：`DominoTool.vue` 与 `InvariantProbeTool.vue` 已从 `packages/toolkit-ui/src/` 删除，`toolkit-ui` 的入口只剩 11 块作答面板 + `ArgumentBoard`；内容 JSON 里 argue 三关的 `tools` 仍登记着 `construct` 与 `probe`（星图、日志、报告的工具标签读它），但 `AnswerDock` 对这两种规格返回 `null`，所以不会重建面板。

## 12.8 迁移门删除的教训：恒真的门没有判别力

argue 早期也有一道迁移门：把棋盘旋转 90°/180°，让同一份论证在转过的棋盘上再验一次。它在第三轮被删掉，理由和 rule 的旋转门完全相同——**旋转保持棋盘的染色结构，计数不变，门恒真**。

代码里把这件事说得很直白（`packages/templates/src/argue/logic.ts` 末尾）：

```ts
/*
 * 迁移门：**故意不做**（2026-11 收口，见 docs/12 §11）。
 *
 * 论证证书的内容是黑白计数，而任何保持棋盘染色的旋转都不改变计数——校验器重算计数后
 * 必然仍相等，所以这类旋转在这个模板里恒真，是一道同义反复的门。
 * 换棋盘几何或换变体类型才可能有判别力，但那是内容设计决策，不是判定层能凭空补的。
 * 因此 argue 不发 transfer 印章；真正的迁移门由 pattern 的换表征（符号/颜色重标）承担。
 */
```

工程上还留了一处「半删」的痕迹：`validateArtifact` 里仍然写着 `if (variant.id !== 'base') stamps.push('transfer')`，但适配器不再提供 `transferVariants`，共享运行时不会调用它；`argueVerifier` 也没有 `transferVariants` 字段。也就是说 `transfer` 印章在 argue 里永远不会真的发出去——它是一行死代码，留着只是为了让 `Verifier` 的形状与其它模板一致。

`engine.ts` 里还有一段专门解释「为什么旋转不能进迁移门」的注释，值得一读：

```ts
/**
 * 旋转会不会把棋盘的棋盘染色翻转（黑白计数互换）。
 *
 * 90°/270° 把 (x,y) 送到 (height-1-y, x) 一类的位置，新坐标和的奇偶差 = height-1（或 width-1）减偶数，
 * 所以偶数边棋盘转 90° 会整体变色。迁移门如果拿这种变体去校验黑白计数证书，
 * 失败的不是论证不够一般，而是坐标系换了颜色——那类变体不能进迁移门（详见 logic.ts 的 transferVariants）。
 */
export function rotationFlipsColoring(script: ArgueScript, quarter: 1 | 2 | 3): boolean
```

连偶数边棋盘旋转会把黑白互换这件事都算过一遍，结论仍然是「不能当门」。这一段代码后来成了删除的依据：**先证明门恒真，再删门**，而不是因为「反正没人用」就删。

把三个模板的迁移门放在一起看，结论很清楚：

| 模板 | 迁移门 | 判别力 |
|---|---|---|
| pattern | 换表征（`scenario.symbols` 接进判定） | 真门：只填不声明的空壳会在换表征时失败 |
| rule | 旋转变体 | 已删：刚体旋转恒真 |
| argue | 旋转棋盘 | 已删：染色计数旋转不变，恒真 |
| simulate | 无 | 双种子日已经内建在运行里，不需要额外门 |
| experiment | duel 换 B 种子 | 真门：换数据源重跑，参数不放宽 |
| construct | 无 | 变体全是表征轴，做了也是恒真门 |

一门模板的迁移门只有两种合法形态：**换数据源重跑**（experiment 的 B 种子、simulate 的双种子日），或者**换表征后规律仍要成立**（pattern 的符号重标）。旋转、镜像、平移这类保持判定结构的变换，都只能证明程序不崩，不能证明结论够一般。

## 12.9 本章要点

- simulate 的三层（参数 → 模拟 → 指标）全是纯函数，不读时钟不用随机，所以同一组参数必然得到同一组指标、可以逐项对账；第四轮之后参数一改就自动运行，`answerComplete` 看「最近一次运行与参数对得上」。
- 「换种子稳健」不是额外的门，而是运行本身的一部分：一次 `knob/run` 同时算两个种子日，第二日不达标判 `sim-overfit-seed`。
- simulate 的产物只证明「跑过」，指标全部从参数重算；写死一组越界参数会被 `normalizeParams` 拒绝。
- queue 与 dispatch 共用模板但各写一套模型；`queue-unserved` 因结构上不可达被移出可达失败类清单。
- argue 的证书四要素是 Claim / Warrant / Evidence / Scope，但真正由玩家填的只有 Warrant；其余三个由依据推导。多米诺沙盒与不变量探测面板已在第五轮删除，关卡只剩论证板，1 击完成。
- argue 的判定是可计算的：coloring 看黑白是否不等、parity/area 看总格数是否奇数；8×8 去同色角让 coloring 成为唯一可行依据，`area` 不再是假选项。
- 迁移门的唯一价值是判别力。rule 与 argue 的旋转门都被证明恒真后删除，真正的迁移门只剩 pattern 的换表征与 experiment 的换种子。

两个模板最终指向同一件事：把「我觉得」变成「可检查」。simulate 用指标对账，argue 用证书对账；一个靠重算，一个靠推导。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/MathMindForge/第11章-experiment模板-数据与实验/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/MathMindForge/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/MathMindForge/第13章-画布系统与双视图/" class="chapter-nav__next">下一章 →</a>
</div>

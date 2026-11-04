---
layout: default
title: 第09章 - rule模板-程序化规则
---

# 第09章 - rule模板-程序化规则

rule 是六个模板里唯一「产物本身就是一段可执行程序」的模板。pattern 让玩家声明一条规律，construct 让玩家摆出一个满足约束的构造，rule 则要求玩家交出一串积木，由执行器真正走一遍地图。这一章按数据模型、执行器、判定层、运行时、画布输入、变体门六个环节拆开讲，全部对照 `packages/templates/src/rule/` 的真实实现。

rule 在首发的 20 关里占 2 关：K 学段的 `k-algorithm-train`（规则小火车）与 G1–3 学段的 `g13-algorithm-route`（规则工程师·路线）。两关都是算法主线，都用 `rule` 工具（规则卡），都有 Phaser 画布。

| 项 | `k-algorithm-train` | `g13-algorithm-route` |
|---|---|---|
| 网格 | 5×5 | 5×5 |
| 起点 | (0,0)，面朝东 | (0,0)，面朝东 |
| 终点 | (4,0) | (0,4) |
| 星星 | 1 颗 (2,0) | 3 颗 (2,0)、(4,2)、(2,4) |
| 墙 | 无 | 8 格 |
| 程序格上限 | 10 | 20 |
| 执行步数上限 | 20 | 120 |
| 定位 | 顺序指令入门 | 顺序 + 重复 + 收星 |

两关的差异不在机制而在规模：K 关是一条直线，玩家放 5 块积木就能完成；G1–3 关要求玩家绕开墙、收齐三颗星再回到终点，手拼展开解是 17 块，压缩成重复解是 12 个顶层块。

## 9.1 程序的数据模型：ProgramBlock 与 RuleScript

rule 的产物是 `ProgramBlock[]`，顶层的块序列就代表程序的执行顺序。块的定义在契约包 `@mmf/game-kit` 里，模板包只做校验与窄化：

```ts
// packages/game-kit/src/runtime.ts
export interface ProgramBlock {
  id: string;
  op: 'forward' | 'left' | 'right' | 'collect' | 'repeat' | 'if-wall';
  n?: number;
  children?: ProgramBlock[];
}
```

六个原语分成两组：前四个是叶子动作（前进、左转、右转、收集），后两个是容器（`repeat` 重复 n 次、`if-wall` 前方是墙才执行子块）。容器让程序可以嵌套，因此程序天然是一棵树而不是一个数组；`children` 是递归字段。

模板侧用 zod 把这棵树连同上限一起钉死（`packages/templates/src/rule/schema.ts`）：

```ts
export const MAX_REPEAT = 20;
export const MAX_NESTING = 4;

export const programBlockSchema: z.ZodType<ProgramNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(24),
    op: z.enum(BLOCK_OPS),
    n: z.number().int().min(1).max(MAX_REPEAT).optional(),
    children: z.array(programBlockSchema).max(8).optional(),
  }),
);

export const programSchema = z.array(programBlockSchema).max(64);
```

三个上限各有防守对象：`MAX_REPEAT = 20` 挡住「靠一个重复 1000 次把执行器拖死」的写法；`MAX_NESTING = 4` 挡住深层嵌套；`children` 最多 8 个、顶层最多 64 块。这些是结构上限，和关卡自己的 `maxBlocks`（程序格预算）不是一个东西——前者防实现被拖垮，后者是关卡的设计约束。

地图脚本 `RuleScript` 则记录环境：

```ts
export const ruleScriptSchema = z.object({
  grid: z.object({
    width: z.number().int().min(3).max(12),
    height: z.number().int().min(3).max(12),
    start: z.object({ x: coord, y: coord, dir: z.enum(DIRECTIONS) }),
    goal: cellSchema,
  }),
  walls: z.array(cellSchema).max(64),
  stars: z.array(cellSchema).max(12),
  maxBlocks: z.number().int().min(1).max(64),
  maxSteps: z.number().int().min(4).max(400),
});
```

坐标是格点，**y 轴向上**：`east = x+`、`north = y+`。这个约定在 schema 文件头写得很明确，因为 Phaser 的屏幕坐标 y 轴向下，场景层必须做一次翻转（`screen row = height - 1 - y`），两套坐标一旦混用，画布上画出来的轨迹就会上下颠倒。

墙与出界是同一个判定口径，`engine.ts` 里写死了这一点：

```ts
/** 墙包含网格边界：越界等同于撞墙。 */
export function isBlocked(script: RuleScript, cell: Cell): boolean {
  if (cell.x < 0 || cell.y < 0 || cell.x >= script.grid.width || cell.y >= script.grid.height) {
    return true;
  }
  return script.walls.some((wall) => sameCell(wall, cell));
}
```

所以失败类里没有单独的「越界」——越界就是 `rule-wall`。这一点和设计文档早期版本里的 `rule-out-of-bounds` 不同：实现只保留一个撞墙失败类，`FAILURE_CLASSES` 一共四条。

## 9.2 执行器：一个不写状态、不读时钟的纯函数

`executeProgram` 是 rule 模板的心脏。它接收地图脚本和程序，返回一份完整轨迹 `RuleTrace`：走的步数、走过的格子、按顺序收进篮子的星星、结束位置与朝向、是否到达终点、失败步与失败类、以及供画布回放的逐原语日志。

```ts
// packages/templates/src/rule/engine.ts
export function executeProgram(script: RuleScript, program: readonly ProgramBlock[]): RuleTrace
```

它的四条执行语义值得逐条读：

**第一，先扣预算再执行。** 每个原语执行前先调用 `advance()`，步数达到 `maxSteps` 就直接判 `rule-loop`。这意味着「步数预算用完」本身就是绕圈的证据：程序可能并没有真的循环，只是走得太久，但对玩家来说两者是同一种失败——程序停不下来。

```ts
function advance(): boolean {
  if (steps >= script.maxSteps) {
    fail('rule-loop', steps + 1);
    return false;
  }
  steps += 1;
  return true;
}
```

**第二，容器块不计步。** `repeat` 和 `if-wall` 本身不调用 `advance()`，只有它们展开出来的叶子动作计步。这样「12 个顶层块、17 步」是正常读数：两个数字量的不是同一件事。

**第三，收齐星星且站在终点就立即停。** `settle()` 在每个叶子动作之后被调用：

```ts
function settle(): void {
  if (collectedKeys.size === starKeys.size && pos.x === goal.x && pos.y === goal.y) {
    reachedGoal = true;
    stopped = true;
  }
}
```

提前停有两个好处：一是后面多放的块不会再把成功的程序拖成撞墙，玩家不必精确裁剪；二是「成功」的判据统一落到 `reachedGoal` 一个布尔量上，验证器不用复算。

**第四，收集是显式动作。** `collect` 只在脚下有星星时才真正入篮，重复收集同一颗星不会重复计数；没有星星时收集动作照样消耗一步。这条设计让「路过星星」和「收下星星」成为两件事——玩家必须显式表达意图，画布点格画路线时也正是靠这一点自动补 `collect`。

`if-wall` 的语义是「条件成立才执行子块，否则什么也不做」，而不是「撞墙了再处理」。它不计步、不产生日志，只在 `blocked(aheadOf(pos, dir))` 为真时执行子块。对玩家来说这是唯一的条件原语，也是写「通用程序」时唯一能表达分支的工具。

日志 `log` 里每一步都记了 `index / op / blockId / from / to / dir`，撞墙步额外带 `blocked: true`，收集步额外带 `collected`。画布重绘轨迹、验证器给失败焦点、证据包记录产物都用这份日志，不需要各算一遍。

## 9.3 判定层：程序跑一遍，四类失败各自可定位

`validateArtifact`（`packages/templates/src/rule/logic.ts`）不信任任何预先算好的轨迹，它自己把程序重新跑一遍：

```ts
export function validateArtifact(source: ScriptSource, variant: RuleVariant, artifact: unknown): Verdict {
  const script = applyVariant(source, variant);
  const program = readProgram(artifact);
  const artifacts = summarizeProgram(program);

  if (program.length === 0) {
    return fail(variant, 'rule-empty', [
      { kind: 'constraint', ref: 'program', messageKey: 'level.rule.empty.message' },
    ], artifacts);
  }

  const trace = executeProgram(script, program);
  // ... 撞墙 / 绕圈直接取自 trace.failureClass，漏星与未到终点在这里复算
}
```

四个失败类的分工是：

| 失败类 | 触发条件 | 定位信息 | 反馈文案（i18n key） |
|---|---|---|---|
| `rule-empty` | 产物为空程序 | 约束项 `program` | `level.rule.empty.message` |
| `rule-wall` | 前进时前方越界或撞墙 | 失败步号（`causes[0].ref` 是步数） | `level.rule.wall.message` |
| `rule-loop` | 步数预算耗尽、嵌套超限 | 停在的步号 | `level.rule.loop.message` |
| `rule-missed-item` | 没到终点，或到终点但漏星 | 漏星坐标或终点坐标 | `level.rule.missedItem.message` |

注意 `rule-missed-item` 是个复合类：它同时收「停在半路」和「到了终点但少星星」两种情况，原因列表最多两条——一条列漏掉的星，一条指向终点。界面按 `causes` 逐条渲染，玩家看到的是「还差哪颗星」而不是一句笼统的失败。

判定通过后发两枚印章：`constraint` 恒定发，`simple` 在顶层块数 `<= 14` 时发。要注意 `simple` 量的是顶层块数而不是展开后的格数：

```ts
const stamps: Verdict['stamps'] = ['constraint'];
if (program.length <= 14) stamps.push('simple');
return {
  passed: true,
  stamps,
  missingEvidence: [],
  artifacts,
  metrics: { steps: trace.steps, blocks: program.length, collected: trace.collected.length },
};
```

g13 的 12 块重复解能拿 `simple`，而 17 块展开解拿不到；画布点格画路线得到的是 17 块展开版，同样拿不到。这不是 bug，是设计：简洁印章奖励的是「把路线折叠成重复」这个认知动作，不是「走通」这个结果。

判定层还提供一个调试入口 `traceProgram(source, program)`，测试和场景都用它拿完整轨迹。`summarizeProgram` 则把程序压成一条产物摘要（`kind: 'program'`），摘要里同时写顶层块数和总格数：

```ts
summary: program.length + ' 块程序 / ' + countBlocks(program) + ' 个格子'
```

展开解显示「17 块程序 / 17 个格子」，压缩解显示「12 块程序 / 18 个格子」——玩家第一次看到这两个数字时往往会问「为什么 12 块的格子反而更多」，答案就在容器的子块也被计数。

## 9.4 运行时：状态、动作与「提交」的合并

rule 的运行时不是从零写的，它套在共享适配器 `createRuntimeWithAdapter` 上（`packages/templates/src/shared/runtime.ts`），自己只负责一份 `RuleState` 和四个工具动作：

```ts
// packages/templates/src/rule/runtime.ts
export interface RuleState {
  program: ProgramBlock[];
  selectedId?: string;
  committed: boolean;
  lastTrace?: TraceSummary;
}
```

四个动作是 `rule/place`、`rule/remove`、`rule/move`、`rule/commit`。放置时先做两块校验：块本身要过 `programBlockSchema`，放进去之后总格数不能超过脚本的 `maxBlocks`。

```ts
case 'rule/place': {
  const block = normalizeBlock(action.payload.block);
  if (!block) return { state, error: '这一块还不完整：先拼好再放进去。' };
  const at = clampIndex(action.payload.at, state.program.length);
  const next = [...state.program.slice(0, at), block, ...state.program.slice(at)];
  if (countBlocks(next) > script.maxBlocks) {
    return { state, error: '程序格子到上限了：先用重复把路线缩短。' };
  }
  return {
    state: withProgram(next, block.id),
    evidence: { phase: 'construct', tool: 'rule', action: action.type },
  };
}
```

这里有个实现细节：超上限时返回的是错误而不是截断，程序保持原样。这让「格子到上限」变成一条可读的提示，而不是悄悄吃掉玩家刚放的那一块。

交互简化轮做的最重要的一件事，是删掉「提交程序」按钮，让程序拼好就是答案。适配器的 `artifact()` 只要求程序非空，不再检查 `committed`：

```ts
// 程序拼好就是答案（docs/12 T1-rule）：「提交程序」按钮已删，宿主「完成」一次性校验，
// 所以产物不再要求 committed —— 有程序就交给验证器判定。
artifact(state: RuleState): unknown | null {
  if (state.program.length === 0) return null;
  return { program: state.program };
}
```

检查点也随之退化成事实记录。原来 `build` 要求提交过、`run` 要求点过运行，现在两者都只看「程序里有没有块」：

```ts
checkpoints(state: RuleState, ctx) {
  return {
    build: state.program.length > 0,
    run: state.program.length > 0 || ctx.runs > 0,
  };
}
```

```ts
// packages/templates/src/rule/index.ts
export function defineRuleLevel(manifest: LevelManifest): LevelModule {
  let game: { destroy(removeCanvas: boolean): void; loop: { sleep(): void; wake(): void } } | null = null;

  return {
    manifest,
    createRuntime(detail, opts) { return createRuleRuntime(detail, opts); },
    async mount(ctx, runtime) {
      if (!ctx.canvasHost) return;
      game = createPhaserGame(ctx.canvasHost, {
        designSize: manifest.designSize,
        scenes: [createRuleScene(ctx, runtime)],
      });
    },
    async unmount() {
      game?.destroy(true);
      game = null;
    },
    pause() { game?.loop.sleep(); },
    resume() { game?.loop.wake(); },
  };
}
```

销毁时调用 `destroy(true)`，第二个参数表示连 canvas 一起移除。重进关卡不会留下旧场景，也就不会出现两个画布叠在一起、点击落到旧场景上的经典事故。

`规则卡`（`packages/toolkit-ui/src/RuleTool.vue`）提供六个积木按钮：前进、左转、右转、收集、重复前进×2、遇墙右转。程序列表按行展示，选中一行后可以删除、上移、下移。面板顶部固定显示「程序格 n/maxBlocks（重复里的块也算）」，把预算可视化。

```vue
<div class="flex flex-wrap items-center justify-between gap-2">
  <p class="text-xs font-semibold text-ink-soft">
    程序格 {{ blockTotal }}/{{ maxBlocks }}（重复里的块也算）
  </p>
  <span class="text-xs font-semibold text-ink-soft">拼好程序后直接点下面的「完成」</span>
</div>
```

这里两个细节值得注意：一是 `blockTotal` 用递归的 `countBlocks` 算，面板和验证器用的是同一套口径；二是按钮文案直接告诉玩家「拼好就直接点完成」，把原来三步仪式（提交程序 → 试一下 → 完成）压成了一步。

## 9.5 第二条输入路径：在画布上点格画路线

交互简化轮的第三轮给 rule 加了第二个输入口：**点同一行或同一列的格子，把这条直线编译成程序块**。右侧积木按钮全部保留，两条路径产出同一个 `program`。

编译函数 `planRouteClick` 在 `packages/templates/src/rule/logic.ts`，签名是纯函数：

```ts
export function planRouteClick(
  script: RuleScript,
  program: readonly ProgramBlock[],
  target: Cell,
  options: { idPrefix?: string } = {},
): RouteClickResult
```

它先用当前程序跑一遍执行器，拿到「现在站在哪、朝哪边」，再把目标格编译成三部分：一个可选的转向、若干 `forward`、路过的星星自动追加的 `collect`。

```ts
const trace = executeProgram(script, program);
const from: Cell = { x: trace.end.x, y: trace.end.y };
const facing = trace.end.dir;
if (target.x === from.x && target.y === from.y) return { ok: false, reason: 'same-cell' };

let dir: Direction;
if (target.x === from.x) dir = target.y > from.y ? 'north' : 'south';
else if (target.y === from.y) dir = target.x > from.x ? 'east' : 'west';
else return { ok: false, reason: 'not-straight' };

const delta = (CLOCKWISE.indexOf(dir) - CLOCKWISE.indexOf(facing) + 4) % 4;
if (delta === 2) return { ok: false, reason: 'behind' };
const turn: 'left' | 'right' | null = delta === 0 ? null : delta === 1 ? 'right' : 'left';
```

点击合法性一共五种否决：点自己（`same-cell`）、斜对角（`not-straight`）、正后方（`behind`）、中间隔墙或出界（`blocked`）、编译后超过程序格预算（`budget`）。每一条都对应画布上不同的反馈，而不是统一的「操作无效」。

正后方为什么不接？注释写了理由：一次点击要产生 1–2 类有意义的动作，倒车会塞 3 块（转 180°、前进、再转回来），把「点一下」变成「点一下塞三块」，和手拼没有区别。这条否决是设计取舍，不是能力缺失。

编译产物有一个硬约束：**永远是展开版**，不生成 `repeat` / `if-wall`。

```ts
// 产物永远是展开版：不生成 repeat / if-wall，简洁印章仍归手拼压缩版。
```

场景层（`packages/templates/src/rule/scene.ts`）负责把点击翻译成动作。悬停时用和点击同一份 `planRouteClick` 结果画预览，因此「预览说会发生什么」和「点了之后真的发生什么」不可能不一致：

```ts
private handlePointerDown(pointer: Phaser.Input.Pointer): void {
  const cell = this.cellAt(pointer.worldX, pointer.worldY);
  if (!cell || this.dispatching) return;
  this.clickSeq += 1;
  const planned = this.planAt(cell, 'c' + this.clickSeq);
  if (!planned || !planned.result.ok) {
    // 点车头/不可达：不发动作，只闪一下红环 + 叉（不弹模态）。
    this.flashReject(cell);
    return;
  }
  // ...
}
```

一次点击会连发多个 `rule/place`，所以场景里有一个 `dispatching` 闸门，派发期间忽略新点击，避免 `at` 下标打架。坐标换算在 `cellAt` 和 `centerOf` 两个函数里，屏幕行 = `height - 1 - y`，和引擎的 y 轴向上约定对齐。

带来的效果可以用单测里的两个数字概括：

| 关卡 | 手拼路径 | 画布画路线 |
|---|---|---|
| `k-algorithm-train` | 5 块 + 完成 = 6 击 | 1 次点格 + 完成 = 2 击 |
| `g13-algorithm-route` | 12 块 + 完成 = 13 击 | 5 次点格 + 完成 = 6 击 |

测试里固定了这条对照（`packages/templates/src/rule/logic.test.ts`）：画路线得到的程序有 17 块、没有 `repeat` / `if-wall`、拿不到 `simple` 印章；手拼的 12 块重复解拿得到。交互次数降下来了，认知目标没有被自动化掉——这是这一轮交互改造愿意做的交易。

## 9.6 变体与迁移门：一个恒真门是怎么被删掉的

rule 的早期版本让同一段程序在 2–3 张未见地图上跑通才算过关，地图变体是 90°/180° 旋转。设计文档 `docs/03` §4.3 至今还写着「迁移门：2 张变体地图也成功（同一程序，不修改）」。

这个门在实现层被证明是恒真的。旋转是刚体变换：整张地图（起点朝向、墙、星星、终点）一起转，程序里全是相对方向（左转、右转、前进），母本通过则旋转后必然通过。`packages/templates/src/rule/logic.ts` 的文件头注释把结论写在了最前面：

```ts
/**
 * rule 模板的失败类。
 * 迁移门（旋转变体）已按 docs/12 T2-3 删掉：旋转是刚体变换，程序通过母本必然通过，
 * 那个门恒真、rule-not-general 永不可达。这里不再保留死失败类。
 */
```

于是 `FAILURE_CLASSES` 只剩四条，`rule-not-general` 被删除；适配器不再实现 `transferVariants` / `transferFailureClass`，共享运行时因此不会做迁移校验、也不会自动补 `transfer` 印章。测试里有一条专门钉住这件事：

```ts
it('exposes no transfer gate: the rotation gate was provably tautological', () => {
  const adapter = createRuleAdapter(detail) as unknown as Record<string, unknown>;
  expect(adapter.transferVariants).toBeUndefined();
  expect(adapter.transferFailureClass).toBeUndefined();
});
```

但变体数据本身没有删。两关的内容 JSON 里仍然登记着 `v-rotate-90` / `v-rotate-180` 两个 `structure` 轴变体，它们仍然要过 `content:check` 的变体校验，也要过 `audit:levels` 的 A6：补丁必须能被 `applyVariant` 解析。A6 的口径是「补丁可解析」，而不是「这个门有判别力」：

```ts
// scripts/audit-levels.ts
// ---- A6 变体：补丁可解析；迁移变体由 verifier 逐条验证 ----
if (detail.variants.length < 2) fail(id + ' A6：变体少于 2 个');
for (const variant of detail.variants) {
  try { verifier.applyVariant(detail, variant); } catch (cause) {
    fail(id + ' A6：变体补丁不可解析 ' + variant.id);
  }
}
```

删除之后留下的痕迹很能说明工程里「删干净」有多难：

- `applyVariant` 与 `rotateScript` 还在，变体补丁仍可被审计和测试调用，只是不再当迁移证据；
- 测试里保留了一条「执行器在旋转地图上仍然正确」的性质测试，注释明确写着「executor property, not a gate」；
- i18n 表里 `level.rule.transfer.message` / `.hint` 两条文案还在（`packages/i18n/src/messages.ts`），但已经没有失败类会发这个 key——它们是不可达的死文案。

这条教训在第 12 章讲 argue 时会再出现一次：一个门的价值不在于「有」，而在于它能不能拒绝点什么。恒真的门等于没有门，还会占用玩家的操作次数和失败类名额。

## 9.7 程序格、执行步与失败步：三套计数怎么对齐

rule 关里同时存在三套计数，读代码和设计关卡时最容易混：

1. **程序格**（`countBlocks`）：顶层块 + 所有容器的子块，受脚本 `maxBlocks` 约束，面板显示「n/20」；
2. **执行步**（`trace.steps`）：执行过的原语动作数，受脚本 `maxSteps` 约束，用完判 `rule-loop`；
3. **失败步**（`trace.failureStep`）：撞墙或绕圈停下的那一步，1 起，作为失败原因里的 `ref` 回传给界面。

g13 的 12 块重复解正好把三套计数同时展示出来：程序格 18、执行步 17、没有失败步。展开解则是程序格 17、执行步 17。两个解都能通关，`simple` 印章却只发给顶层块少的那个——因为 `simple` 量的是「你把重复用出来了吗」，不是「你走了多少步」。

失败步的语义还有一处不对称值得知道：撞墙时 `causes[0].kind` 是 `'cell'`，`ref` 却是步号字符串（测试断言 `ref === '5'`）；漏星时 `kind` 也是 `'cell'`，`ref` 才是坐标（例如 `'2,0'`）。前者是历史遗留的字段复用，界面按 `messageKey` 渲染，不受影响；但如果要写新的消费者，别假设 `kind === 'cell'` 就一定拿到坐标。

```ts
if (trace.failureClass) {
  const wall = trace.failureClass === 'rule-wall';
  return fail(variant, trace.failureClass, [{
    kind: wall ? 'cell' : 'step',
    ref: String(trace.failureStep ?? trace.steps),
    messageKey: wall ? 'level.rule.wall.message' : 'level.rule.loop.message',
  }], artifacts);
}
```

这一段里 `wall ? 'cell' : 'step'` 的写法说明作者意识到了两类失败的不同定位方式，只是 `ref` 还共用了一个字符串字段。

## 9.8 本章要点

- rule 的产物是 `ProgramBlock[]`，一棵带容器的树；结构上限（`MAX_REPEAT` / `MAX_NESTING` / 64 块）与关卡预算（`maxBlocks`）是两回事。
- `executeProgram` 是纯函数：先扣预算再执行、容器不计步、收齐且到终点立即停、收集必须显式。
- 判定只认执行结果，四类失败各有定位信息；`simple` 印章量顶层块数，奖励的是折叠成重复的认知动作。
- 交互简化后「程序拼好就是答案」，没有提交按钮，检查点退化成事实记录。
- 画布点格是第二条输入路径，编译产物永远是展开版；`simple` 仍然只给手拼压缩解。
- 旋转变体门是恒真的，已删除；变体数据还在做内容校验，但不再当迁移证据。真正的迁移门只剩 pattern 的换表征那一处。

rule 关想教的东西，其实不是「写对一段 17 块的程序」，而是「用重复把 17 块压成 12 块」这个动作。程序只是它留下的证据。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/MathMindForge/第08章-六个模板总览与pattern/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/MathMindForge/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/MathMindForge/第10章-construct模板-构造与优化/" class="chapter-nav__next">下一章 →</a>
</div>

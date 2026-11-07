---
layout: default
title: 第05章 - Vue应用外壳与路由
---

# 第05章 - Vue应用外壳与路由

## 5.1 外壳的全貌：从 main.ts 到一条数据流

`apps/site` 是《数思工坊》唯一的产品入口：一个 Vue 3 + Pinia 的单页应用，外面套一层 hash 路由，里面挂 Phaser 画布与作答面板。它的职责边界很窄——**不实现任何玩法与判定**，只负责把「用户点到了哪一关」翻译成「加载哪个关卡模块、装配哪个运行时、把快照交给哪块界面」。

先看整个应用的启动文件，18 行，没有一个多余的初始化：

```ts
// apps/site/src/main.ts（全文）
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { initDebug } from './shell/debug';
import { useProgress } from './stores/progress';
import { useSettings } from './stores/settings';

const app = createApp(App);
app.use(createPinia());

// 子组件的 onMounted 先于 App 的 onMounted 执行：深链直达时，
// 语言偏好和调试桥必须在 mount 之前就位，否则首帧按默认中文渲染、e2e 早期读不到桥。
initDebug();
useSettings().init();
void useProgress().init();

app.mount('#app');
```

三行初始化都是「mount 之前必须完成」的东西：调试桥（`window.__mmf`）、界面语言偏好、存档读取。原因写在注释里：Vue 的 `onMounted` 是自底向上的，子视图先于 `App.vue` 挂载，如果等 `App` 挂载再去初始化，直接打开分享链接（深链）时首帧会按默认中文渲染，e2e 也会在桥就位之前读到 `undefined`。

`apps/site/src` 一共 30 个文件（含测试与样式），按职责分五层：

| 位置 | 文件 | 职责 |
|---|---|---|
| 入口 | `main.ts` / `App.vue` | 建应用、装 Pinia、顶部导航、路由渲染 |
| 路由 | `router.ts` / `shell/routePath.ts` | hash 解析（纯逻辑在 routePath，window 状态在 router） |
| 关卡登记 | `registry.ts` | `ShippedLevelId → () => import(...)` |
| 宿主外壳 | `shell/*.ts` | platform / progress / locale / i18n / seed / debug / createLevelContext / lifecycle |
| 状态与视图 | `stores/*.ts` / `views/*.vue` / `components/*.vue` | Pinia 两份状态、六个页面、三个共用组件 |

一条玩一关的完整数据流，起点和终点都在 `hash`：

```text
hashchange → parseRoute() → route ref → App.vue 的 v-if 分支
  → WorkshopView → registry[levelId]()（level-<id>.js）
  → loadLevel(levelId)（content-<id>.js）→ createRuntime(detail, opts)
  → createLevelContext(...) → mount(ctx, runtime) → AnswerDock 订阅快照 → 自动判题
```

这条链上没有任何一环走「全局单例 + 隐式初始化」：语言、存档、平台能力都从 `shell/` 下的显式单例取，关卡与内容都从 `registry` / `loadLevel` 显式加载。写新功能的默认姿势是往这条链上挂，而不是新开一条。

## 5.2 hash 路由：把纯逻辑从 window 里拆出来

六个路由（`Route['name']`）就是全部导航面：

| hash | 页面 | 说明 |
|---|---|---|
| `#/` | 工坊大厅（HomeView） | 推荐关、六件工具墙、档案柜入口 |
| `#/forge` | 思维星图（ForgeView） | 5 学段 × 4 主线，卡片列出 20 关 |
| `#/play/<levelId>` | 关卡宿主（WorkshopView） | 全屏；画布 + 作答面板（pattern / rule 只有画布） |
| `#/journal` | 思维日志（JournalView） | 最近 120 条日志 + 最近 80 条证据轨迹 |
| `#/badges` | 徽章墙（BadgesView） | 已得/未得、进度环、条件回看 |
| `#/report` | 成人报告（ReportView） | 长按 3 秒解锁；打印、证据包导入导出 |

选 hash 而不是 History API，是为了静态托管与离线分发：hash 永远不发给服务器，所以把 `dist` 丢进任意子目录、甚至用 `file://` 直接打开 `index.html` 都能跑（构建里的 `base: './'` 与 CSP 里的 `file:` 来源也是为这件事配套的）。

实现被刻意拆成两半。浏览器侧只有 23 行：

```ts
// apps/site/src/router.ts（全文）
import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Route } from './shell/routePath';
import { parseRoute } from './shell/routePath';

export type { Route } from './shell/routePath';
export { asLevelId, parseRoute } from './shell/routePath';

const route: Ref<Route> = ref(parseRoute(window.location.hash));

window.addEventListener('hashchange', () => {
  route.value = parseRoute(window.location.hash);
});

export function useRoute(): Ref<Route> {
  return route;
}

export function navigate(path: string): void {
  const next = path.startsWith('#') ? path : '#' + path;
  if (window.location.hash === next) return;
  window.location.hash = next;
}
```

解析与守卫全在 `shell/routePath.ts`，不碰 `window`、不 import Vue，所以能在 Node 环境直接单测：

```ts
// apps/site/src/shell/routePath.ts（节选）
export interface Route {
  name: 'home' | 'forge' | 'play' | 'journal' | 'badges' | 'report';
  levelId?: ShippedLevelId;
}

const SHIPPED = new Set<string>(SHIPPED_LEVEL_IDS);

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** 只把已发布 id 解析成 player 路由；未发布/不存在的一律回星图（docs/02 §10.1） */
export function asLevelId(value: string | undefined): ShippedLevelId | null {
  if (!value) return null;
  const decoded = safeDecode(value);
  return decoded !== null && SHIPPED.has(decoded) ? (decoded as ShippedLevelId) : null;
}

export function parseRoute(hash: string): Route {
  // `?` 之后是调试参数（autoplay/instant），不参与路由判定
  const clean = hash.split('?')[0] ?? hash;
  const parts = clean.replace(/^#\/?/, '').split('/').filter(Boolean);
  const head = parts[0];
  if (head === 'play') {
    const levelId = asLevelId(parts[1]);
    return levelId ? { name: 'play', levelId } : { name: 'forge' };
  }
  // …forge / journal / badges / report 各一行
  return { name: 'home' };
}
```

三个守卫值得单独说：

- **未发布 id 回星图**，不回空白页：旧分享链接指向一关已下架时，玩家看到的是能继续玩的星图，而不是 404 风格的空屏。
- **畸形百分号编码不抛异常**：`#/play/%E0%A4%A` 会让 `decodeURIComponent` 抛 `URIError`，而 `hashchange` 回调里一旦抛异常，后续路由就再也不更新，整页等于卡死。`safeDecode` 把坏编码当成「未发布 id」处理。
- **`?` 之后不算路由**：`#/play/k-structure-pattern-path?autoplay=1&instant=1` 的 query 只给调试桥读，解析时要先切掉。

这些行为不是靠人肉记忆的：`shell/routePath.test.ts` 用 7 组断言钉住它们，包含「合法编码要能解出来」（`encodeURIComponent(FIRST)`）与「大小写不匹配按未命中处理」（`#/Forge` 回大厅）。

## 5.3 registry：Record<ShippedLevelId, LevelLoader> 与动态 import 分块

路由只决定「要玩哪一关」，真正把关卡代码拉进来的是 `registry.ts`：

```ts
// apps/site/src/registry.ts（节选）
import type { LevelModule, ShippedLevelId } from '@mmf/game-kit';

export type LevelLoader = () => Promise<{ default: LevelModule }>;

/** 只登记已发布关卡；Record 少一条 typecheck 就报 */
export const registry: Record<ShippedLevelId, LevelLoader> = {
  'k-structure-pattern-path': () => import('@mmf/game-forge/k-structure-pattern-path'),
  'k-data-tally': () => import('@mmf/game-forge/k-data-tally'),
  // …共 20 条，与 SHIPPED_LEVEL_IDS 一一对应
};
```

这张表有两个刻意设计。

第一，**用 `Record` 而不是数组或 `Map`**。`ShippedLevelId` 是从 `SHIPPED_LEVEL_IDS` 推导出来的联合类型，`Record<ShippedLevelId, …>` 要求每一个 id 都有条目：内容侧新发布一关而外壳忘了登记，`pnpm typecheck` 立刻报缺键，不用等到运行时白屏。反过来把某关从 `SHIPPED_LEVEL_IDS` 摘掉时，这里的多余条目同样会报错，不会留下「文件在但路由打不开」的半截状态。

第二，**每个值是`() => import(...)` 而不是直接 import**。`@mmf/game-forge` 的包级出口是空的：

```ts
// games/forge/src/index.ts（节选注释）
 * 这里刻意不 re-export 任何关卡模块：一句 export * from './levels/...'
 * 就会让所有关卡（连同 Phaser 画布场景）进入同一个 chunk。
export {};
```

20 关在 `games/forge/package.json` 里各自是一条子路径导出（`./k-structure-pattern-path` → `./src/levels/k-structure-pattern-path.ts`），于是 `import('@mmf/game-forge/k-…')` 在打包时被切成 20 个独立 chunk。命名由 `apps/site/vite.config.ts` 的 `chunkFileNames` 控制，它按两个正则重写文件名：

```ts
// apps/site/vite.config.ts（节选）
chunkFileNames(chunk) {
  const id = chunk.facadeModuleId ?? '';
  const level = /[\\/]games[\\/]forge[\\/]src[\\/]levels[\\/]([^\\/]+)\.ts$/.exec(id);
  if (level) return 'assets/level-' + level[1] + '-[hash].js';
  const detail = /[\\/]content[\\/]src[\\/]details[\\/]([^\\/]+)\.level\.json$/.exec(id);
  if (detail) return 'assets/content-' + detail[1] + '-[hash].js';
  if (chunk.name.includes('phaser')) return 'assets/vendor-phaser-[hash].js';
  return 'assets/[name]-[hash].js';
}
```

于是产物里能直接看出「这一关的代码有多重」：`level-<id>-*.js`、`content-<id>-*.js`、`vendor-phaser-*.js`。但首屏只需要大厅与星图——这也是首屏 JS+CSS 能压到 69.2 KB gzip 的原因。

一致性由两处守着：`Record` 的键类型（typecheck 阶段），以及 `games/forge/src/forge.test.ts` 里对 `package.json` 子路径与 `SHIPPED_LEVEL_IDS` 的集合比对（单测阶段）。两边都过了，才可能出现「表里有、chunk 里没有」以外的错误。

## 5.4 六个视图：大厅、星图、关卡宿主与三个档案页

`App.vue` 用一个 `v-if` 链把路由映射到视图。大厅与星图是静态 import，关卡宿主与三个档案页用 `defineAsyncComponent` 按需加载（`WorkshopView` / `JournalView` / `BadgesView` / `ReportView` 各一行 `() => import(...)`）。`play` 路由上还有两处细节：`:key="route.levelId"` 让换关时组件强制重建，而不是复用同一个实例去 `watch` 参数；进入 `play` 时顶部导航整条隐藏（`v-if="route.name !== 'play'"`），把空间全部让给画布与作答面板。

| 视图 | 它到底画什么 | 关键实现 |
|---|---|---|
| HomeView | 工坊大厅：推荐关、六件工具墙、档案柜三个入口 | `recommendedLevelId(progress.save)` |
| ForgeView | 思维星图：按学段横带或按主线纵列两种视角 | `bandGroups` / `threadLevels` 两个纯函数 |
| WorkshopView | 关卡宿主：画布 + 作答面板 + 自动判题 + 成功遮罩（730 行，全项目最重的组件） | `registry` + `loadLevel` + `runtime` + `answerComplete` |
| JournalView | 思维日志：最近 120 条日志、最近 80 条轨迹 | `buildTrail` / `localizeTrail` |
| BadgesView | 徽章墙：进度环 + 已得/未得 | `evaluateBadges` 按证据重算 |
| ReportView | 成人报告：长按解锁、打印/PDF、证据包导入导出 | `buildReport` / `toReportPack` |

星图的视角切换只改「怎么分组」，不改「有哪些关卡」——这是 `progression.ts` 的设计：

```ts
// apps/site/src/views/ForgeView.vue（节选）
const view = ref<'band' | 'thread'>('band');

const sections = computed<StarSection[]>(() => {
  if (view.value === 'thread') {
    return THREADS.map((thread) => {
      const levels = threadLevels(progress.save, locale.value, thread);
      return {
        key: thread, emoji: THREAD_EMOJI[thread], label: t('thread.' + thread), levels,
        completedCount: levels.filter((node) => node.completed).length,
      };
    }).filter((section) => section.levels.length > 0);
  }
  return bandGroups(progress.save, locale.value).map((group) => ({
    key: group.band, emoji: BAND_EMOJI[group.band], label: t('band.' + group.band),
    levels: group.levels, completedCount: group.completedCount,
  })).filter((section) => section.levels.length > 0);
});
```

两个分支都调 `localizedSummary` 取中英字段，所以切语言时星图不需要重新请求内容。

`progression.ts` 里还有一条当前被「内容没写依赖」稀释掉的规则：`unlock.after` 非空时，前置关全部通关才解锁；20 关的 `unlock.after` 目前全是空数组，所以星图不做硬锁定，只按登记顺序推荐。代码里保留判断而不是删掉，是为了将来内容补上依赖时星图不用改。

成人页的门是 `components/AdultGate.vue`：一个 3 秒长按按钮，`pointerdown` 起表、`pointerup` / `pointerleave` / `pointercancel` 取消，键盘用户用空格与回车：

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
const emit = defineEmits<{ unlock: [] }>();
const holding = ref(false);
let timer: number | null = null;

function start(): void {
  if (holding.value) return;
  holding.value = true;
  clearTimer();
  timer = window.setTimeout(() => {
    timer = null;
    holding.value = false;
    emit('unlock');
  }, 3000);
}
onBeforeUnmount(clearTimer);
</script>
```

这不是防破解（前端没有真正的权限），而是防误触：报告页有打印按钮与导入入口，给 5 岁孩子随手点进去会毁掉「这是给大人的东西」这个约定。`onBeforeUnmount(clearTimer)` 也不能省：长按中切走页面，计时器还在跑，3 秒后会对已卸载的组件发事件。

### 5.4.1 关卡宿主的三个状态与两处时序

`WorkshopView` 是全项目最重的组件，因为它一个人管着「一关从加载到过关」的全部界面状态。第四、第五轮交互简化之后，它少了一整块（工具卡），却多了两段时序（自动判题、自动进下一关）。下面这张表是按状态读它的最短路径：

| 状态 | 触发条件 | 界面上是什么 |
|---|---|---|
| 加载中 | `loading === true` | 全屏 `level.loading`，`role="status"` |
| 失败横幅 | `failureCopy` 非空（最近一次判定失败） | 顶部红条 `failure-banner`，`role="alert"`，钉在作答区上方不随滚动消失 |
| 作答中 | 默认 | 画布（有 `hasCanvas` 时）+ 作答区：`pattern` / `rule` 什么都不渲染，其余模板渲染 `AnswerDock` |
| 成功遮罩 | `completed && !saveFailed` | `level-success`（`role="dialog"`，`aria-modal`），文案「答对啦！进入下一关…」/「…回星图…」，**没有按钮** |
| 存档失败面板 | `completed && saveFailed` | `completion-panel`（红色警告 + 两个按钮），**不自动跳关** |

**第一处时序：自动判题。** 宿主只订阅一份快照，判题决策读两个量：工具的累计使用数（证明玩家动过手）与 `snapshot.answerComplete`（模板宣布答案填满）。两者同时成立后起一个 500ms 的防抖计时器；期间玩家再动手就清掉重来，只判最后一次。判定仍然是那条老路——`dispatch({ type: 'submit' })` → `validate` → `Verdict`；`autoJudgedUsage` 记住判定时的工具使用数，避免同一份答案被反复判。

```ts
// apps/site/src/views/WorkshopView.vue（节选）
const AUTO_JUDGE_DELAY_MS = 500;
const AUTO_NEXT_DELAY_MS = 900;

// 快照订阅里（autoplayRunning 期间整段跳过）：
if (usage > 0 && usage > autoJudgedUsage && snapshot.answerComplete) scheduleAutoJudge(usage);
```

**第二处时序：成功后自动推进。** `submit()` 拿到 `verdict.passed` 后走 `completeNow()`：先 `progress.completeLevel` 写盘，再 `refreshBadges`，写盘成功才发 `level:complete`，然后 `scheduleAdvance()` 等 0.9 秒跳下一关（末关回星图）。`?instant=1` 时这个等待压到 120ms，e2e 用它提速——但**写盘顺序不能压**，事件必须晚于写盘。

**为什么删掉按钮反而要更多代码？** 因为「点了按钮」本来是一个显式信号，删掉它之后宿主必须自己从快照里推断「这一下算不算做完」。所以要三个细节兜住：`usage > 0`（挂载那一刻不算）、`usage > autoJudgedUsage`（判过不重判）、`answerComplete`（模板说了才算填满）。少任何一个都会出现「还没开始就被判错」或「填完了没反应」。

**失败提示为什么不属于作答面板？** 它被移出了可滚动容器、钉在作答区顶部（`failure-banner`），并只在「最近一次判定」期间存在：玩家一动工具，`verdictUsageAt` 与当前工具使用数对不上，旧提示立刻消失。这条修的是早期「改完答案横幅还粘着旧文案」的误导。

## 5.5 Pinia 的两份状态：存档快照与偏好

外壳只有两个 store，切得很干净。

`stores/progress.ts` 管存档与证据。它的核心选择是 **`shallowRef` 而不是 `reactive`**：

```ts
// apps/site/src/stores/progress.ts（节选）
export const useProgress = defineStore('progress', () => {
  // 存档与证据是整棵替换的快照，不能放进深层 reactive（docs/02 §19-10）：
  // 每次 sync 都会换新对象，shallowRef 就足够触发视图更新。
  const save = shallowRef<SaveData | null>(null);
  const ready = shallowRef(false);
  const evidence = shallowRef<EvidenceEvent[]>([]);
  const initError = shallowRef<string | null>(null);
  let inflight: Promise<void> | null = null;

  function sync(): void {
    const snapshot = progressManager.snapshot();
    save.value = snapshot;
    setDebugSave(snapshot);
  }

  function init(): Promise<void> {
    inflight ??= (async () => { /* 读档；失败记 initError 并从空档开始 */ })();
    return inflight;
  }
  // completeLevel / recordEvidence / loadEvidence / refreshBadges / completedBefore / clear …
});
```

三个要点：`shallowRef` 让「整棵替换」的语义和 Vue 的更新触发对齐；`inflight ??=` 让同时发起的多次 `init()` 只真正读一次盘（`main.ts` 与视图的 `onMounted` 都会调它）；读档失败不抛给调用方，而是记进 `initError` 并从空档继续——`WorkshopView` 的错误层会把这句话显示成「存档读取失败，本次进度可能没有保存」。

`stores/settings.ts` 管静音与语言，全部经 `platform.preferences` 落 `localStorage`，外壳不直接碰 `localStorage`：

```ts
// apps/site/src/stores/settings.ts（节选）
async function setLocalePreference(next: Locale): Promise<void> {
  if (next === locale.value) return;
  try {
    // 补丁没就位就切状态，会出现"界面英文、卡片中文"；失败保持当前语言（回落中文）。
    await ensureMessages(next);
  } catch (cause) {
    console.warn('[mmf] 语言补丁加载失败，保持当前语言', cause);
    return;
  }
  platform.preferences.set('locale', next);
  setLocale(next);
}
```

`init()` 则相反：同步地把 `muted` 应用到 `platform.audio`、把本地偏好里的语言交给 `setLocale`——启动时不能等，否则首帧语言是错的。

语言的「双轨」值得说明：`shell/locale.ts` 里是一个 Vue `ref`，负责让模板重渲染；`@mmf/i18n` 里还有一份模块级 `currentLocale`，决定 `createTranslator()` 不传参时的默认表。`setLocale` 一次改两处，否则会出现「面板是英文、日志页还是中文」：

```ts
// apps/site/src/shell/locale.ts（全文）
export const locale = ref<Locale>('zh-CN');

export function setLocale(next: Locale): void {
  locale.value = next;
  setTranslatorLocale(next);
}
```

`shell/useI18n.ts` 再把它包装成组件可用的 `t`：预建中英两个 translator，调用时按当前 `locale` 选表。注意关卡里的语言是另一条线——`WorkshopView` 给 `createRuntime` 传的是写死的 `'zh-CN'`，因为关卡内容（含工具面板文案）目前只有中文，界面语言与内容语言在 v0.9 之前是分开的。

## 5.6 调试桥：window.__mmf 与 autoplay 的三道闸

e2e 不读 DOM 结构猜进度，而是读一个全局对象 `window.__mmf`。它只在两种环境存在：开发模式，或 `navigator.webdriver === true`（自动化浏览器）：

```ts
// apps/site/src/shell/debug.ts（节选）
const MAX_DEBUG_EVENTS = 400;

export interface MmfDebugBridge {
  events: string[];
  save: SaveData | null;
  snapshot: RunSnapshot | null;
  lastError?: string;
  attemptSubmit?: () => Promise<void>;
}

/** 调试桥只在 DEV / webdriver 暴露；生产分享链接拿不到它（docs/02 §10.5） */
export function debugAllowed(): boolean {
  if (import.meta.env.DEV) return true;
  return typeof navigator !== 'undefined' && navigator.webdriver === true;
}
```

事件是扁平字符串，形如 `level:ready:<levelId>`、`level:complete:<levelId>`、`level:retry:<failureClass>`、`evidence:observe`、`journal:add`。这样断言不依赖 payload 类型，e2e 里就是 `waitForEvent('level:complete:<id>')` 一行。数组有 400 条上限，超出从头裁掉——调试会话可能开很久，无上限会一直吃内存。

`autoplay` / `instant` 两个调试参数走同一道闸，`readDebugOptions()` 在生产构建里直接返回 `undefined`：

```ts
// apps/site/src/shell/createLevelContext.ts（节选）
export function readDebugOptions(): DebugOptions | undefined {
  if (!(import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver === true))) {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const queryAt = hash.indexOf('?');
  if (queryAt >= 0) {
    // 把 hash 内 ? 之后的调试参数并进 params（hash 路由下 location.search 读不到它们）
    for (const [key, value] of new URLSearchParams(hash.slice(queryAt + 1))) {
      if (!params.has(key)) params.set(key, value);
    }
  }
  const autoplay = params.get('autoplay') === '1';
  const instant = params.get('instant') === '1';
  if (!autoplay && !instant) return undefined;
  // …返回 { autoplay?, instant? }
}
```

之所以要同时兼容 `location.search` 与 hash 里的 query，是因为本项目用 hash 路由：`/#/play/<id>?autoplay=1` 的 `?` 在 hash 内部，浏览器不会把它放进 `location.search`。两处都读，e2e 才能用同一种 URL 写法。开了 `autoplay` 之后，宿主在挂载完成后直接让运行时自己跑黄金解：

```ts
// apps/site/src/views/WorkshopView.vue（节选）
if (debugOptions?.autoplay) {
  const result = await runtimeRef.autoplay();
  await flushEvidence();
  finalSnapshot.value = result.snapshot;
  liveSnapshot.value = result.snapshot;
  verdictUsageAt.value = usageTotal(result.snapshot);
  setDebugSnapshot(result.snapshot);
  if (result.verdict?.passed) await completeNow(result.verdict.stamps, result.snapshot.variantId);
}
```


`autoplay()` 不是「直接改状态通关」：它内部把黄金解翻译成一串真实动作逐条 `dispatch`（例如 `pattern/setCycle` → `construct/place` → `submit`），走的是和玩家完全相同的判定路径。这条纪律让「e2e 绿灯」有意义——如果自动通关绕过校验，测试就只是在测它自己。三道闸合起来的效果：生产分享链接既拿不到 `window.__mmf`，也读不到 `autoplay`，所以「把链接发给别人、他打开就自动通关」不可能发生。

调试桥还有一位常被忽略的同居者：种子。"同一份档案重进同一关，看到的随机内容必须一样"，做法是把「关卡 + 档案」哈希成一个整数种子（`shell/seed.ts`）：

```ts
// apps/site/src/shell/seed.ts（全文）
/**
 * 关卡种子：同一档案进同一关应得到同一序列（docs/02 §10.3 的 seedFor）。
 * 用 FNV-1a 而不是 Math.random：重进关卡内容不漂移，问题也可复现。
 */
export function seedFor(levelId: string, profileId: string): number {
  const input = levelId + '|' + profileId;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1_000_000_000;
}
```

调用点在 `WorkshopView.start()` 里，作为 `RuntimeOptions.seed` 传给 `createRuntime`：`seed: seedFor(props.levelId, progress.save?.profile.id ?? 'local-default')`——档案缺失时退到 `'local-default'`，保证首启也有稳定序列。

为什么不用 `Math.random()`：随机关卡内容一旦每次不同，「玩家报告说第三关的图不对」就无法复现；e2e 也会变成碰运气。种子的三个性质由 `shell/seed.test.ts` 钉住：同输入同输出、不同输入不同输出（同一关换档案也算不同）、结果一定是非负安全整数（`% 1_000_000_000` 保证能安全注入运行时的 `mulberry32`）。种子只决定「内容怎么生成」，不决定「判定是否通过」——所有关卡都必须有多条互不相同的有效解，随机只影响生成，不能影响唯一正确答案，这是反刷题审计 A3 的口径。

## 5.7 卸载纪律：teardown 的六件事与一个不能异步的钩子

`WorkshopView` 是唯一持有「活资源」的视图：一条 `runtime` 订阅、两个 `platform.lifecycle` 回调、可能存在的 Phaser 画布与 rAF 循环、一个证据缓冲队列、一个自动退出计时器。所以它有全项目最严格的卸载纪律：

```ts
// apps/site/src/views/WorkshopView.vue（节选）
async function teardown(): Promise<void> {
  clearExitTimer();
  offPause?.();
  offResume?.();
  offPause = null;
  offResume = null;
  unsubscribe?.();
  unsubscribe = null;
  registerSubmit(null);
  setDebugSnapshot(null);
  const active = module.value;
  module.value = null;
  runtime.value = null;
  liveSnapshot.value = null;
  if (active) {
    try {
      await active.unmount();
    } catch (cause) {
      recordDebugError('关卡卸载失败：' + String(cause));
    }
  }
  safeRemove(canvasHost.value);
  safeRemove(host.value);
}
```

拆开看是六件事：

1. **清计时器**（`clearAutoJudge()` 与 `clearAdvanceTimer()`）——否则离开后那 500 ms 的自动判题与 0.9 s 的自动跳关还会触发，把玩家从别的页面重新拽进这一关；
2. **解订阅**（`unsubscribe`）——运行时还会 `notify`，闭包持有已卸载组件的 `ref`；
3. **解除前后台监听**（`offPause` / `offResume`）——页面切走再回来会 `resume()` 一个已经不存在的 `game`；
4. **注销提交函数**（`registerSubmit(null)`）——调试桥是全局对象，留着闭包等于把整个已卸载的 runtime 钉在内存里；
5. **先置空状态再 `await unmount()`**——`module`/`runtime` 置空后，卸载期间到达的快照回调不会写进新状态；
6. **`safeRemove` 清 DOM**——`shell/lifecycle.ts` 全文只有三行：`if (node) node.innerHTML = ''`。三行函数的价值在「null 安全 + 幂等」：画布容器只在 `manifest.hasCanvas` 时才渲染，无画布关卡的 `canvasHost` 就是 `null`；重复调用也不报错。卸载路径上最怕「一半元素不存在就抛异常」，导致后面几行清理全部跳过。另一个容易写错的点：`onBeforeUnmount` 刻意**不写成 async**：

```ts
onBeforeUnmount(() => {
  // 不写成 async：Vue 不会等异步钩子，等 await 期间新页面可能已经挂载同一关卡的模块单例，
  // 那时再 unmount 会把新画布销毁。同步拆干净，证据落盘单独发起。
  disposed = true;
  platform.audio.stopSpeech();
  void teardown();
  void flushEvidence();
});
```

Vue 不 `await` 生命周期钩子，所以「async 钩子」只是把工作排进微任务，页面切换照常继续。真正要同步做的是 `disposed = true`（拦住 `start()` 里后续的异步步骤）与同步断开所有订阅；`unmount()` 与证据落盘各自 `void` 发起即可。`start()` 里也有一处配套的补丁：加载期间玩家已经离开时，`mount` 可能晚于卸载创建了 canvas，所以 `disposed` 检查之后要再调一次 `teardown()`。

证据队列同样有纪律：每 2 秒批量落盘，提交与退出前强制 `flushEvidence()`（否则「失败 → 修正」只留下后半段）；队列上限 400 条、连续失败重试 3 次后丢弃并记一条调试错误。这些数字写在文件顶部，和 `MAX_EVIDENCE_QUEUE` / `MAX_EVIDENCE_RETRY` 两个常量一一对应。

## 5.8 小结

- 外壳只有一条数据流：hash → `parseRoute` → 视图 → `registry` 加载关卡 → `loadLevel` 加载内容 → `createRuntime` → `mount` → `AnswerDock` 订阅快照 → 停手 500ms 自动判题 → 成功遮罩 0.9s → 自动进下一关。
- 路由逻辑与 window 分离：`shell/routePath.ts` 可在 Node 单测，三个守卫（未发布 id 回星图、坏编码不抛异常、query 不参与路由）各有断言。
- `registry.ts` 用 `Record<ShippedLevelId, LevelLoader>` 把「内容发布」与「代码登记」绑成编译期错误，用子路径动态 import 把关卡与 Phaser 切成独立 chunk。
- 六个视图职责单一：大厅、星图、关卡宿主、日志、徽章、报告；关卡宿主之外的视图都不碰运行时。
- 两份 Pinia 状态：存档用 `shallowRef` 整棵替换，偏好走 `platform.preferences`；语言是 `ref` 与 i18n 模块级 locale 的双轨，必须一起改。
- 调试桥 `window.__mmf` 与 `autoplay` 只在 DEV / webdriver 存在，生产分享链接拿不到；`autoplay()` 内部仍逐条 `dispatch`；种子用 FNV-1a 从「关卡 + 档案」算出，重进关卡不漂移。
- 卸载是同步的六件事：计时器、订阅、生命周期回调、调试桥回调、状态置空、DOM 清理；`onBeforeUnmount` 不能 async。

下一章进入外壳背后真正的内容层：20 关的摘要与详情为什么分成两半、zod 为什么只在构建期跑、双语为什么写成内联字段。

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/MathMindForge/第04章-核心契约-动作驱动运行时/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/MathMindForge/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/MathMindForge/第06章-内容数据模型与双语JSON/" class="chapter-nav__next">下一章 →</a>
</div>

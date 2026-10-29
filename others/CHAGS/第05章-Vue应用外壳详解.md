---
layout: default
title: 第05章 - Vue应用外壳详解
---

# 第05章 - Vue应用外壳详解

## 5.1 外壳的职责边界

外壳（`apps/site`）是整个应用里唯一「产品代码」：它负责游戏馆、图鉴、到期复习、家长页、游戏宿主、路由、状态与语言切换；而游戏内部的一切（故事、玩法、音效）它都不知道。这条边界带来的好处是双向的：外壳可以独立演化为小程序壳、桌面壳、安卓壳（第 14 章），游戏则可以独立开发与测试。

外壳源码一共二十多个文件（5 个视图、4 个 store、5 个 shell 文件、复习状态机、路由、注册表与入口），本章按「启动 → 路由 → 注册表 → 宿主 → 状态 → 视图」的顺序逐个讲清。

## 5.2 启动链路

```ts
// apps/site/src/main.ts
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).use(createPinia()).mount('#app');
```

`App.vue` 是全壳唯一的「顶层组件」，它做四件事：**路由级懒加载、音频解锁、长按进家长页、原生返回键**。

```ts
// apps/site/src/App.vue（节选）
// 首屏只留大厅；游戏 / 图鉴 / 复习 / 家长页都按路由懒加载。
// 孩子第一次打开只需要"选一个游戏"，其余页面等真的点进去再下。
const PlayView = defineAsyncComponent(() => import('./views/PlayView.vue'));
const ReviewView = defineAsyncComponent(() => import('./views/ReviewView.vue'));
const AlbumView = defineAsyncComponent(() => import('./views/AlbumView.vue'));
const ParentView = defineAsyncComponent(() => import('./views/ParentView.vue'));

onMounted(() => {
  settings.init();
  void progress.init();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  // 只在原生壳里生效；浏览器里是空操作
  installBackButtonHandler(route);
});
```

四个细节：

1. **路由级懒加载是 2026-10-18 才补的**：在此之前，家长页、图鉴、复习、游戏的代码都在首屏里。拆开之后首屏原始字节从 165.6 KB 降到 142.7 KB，gzip 53.8 KB —— 「首屏只留大厅」这条产品规则同时是体积规则。
2. **音频解锁挂在第一次 `pointerdown` 上且 `{ once: true }`**。iOS Safari 与微信要求音频必须由用户手势触发解锁，外壳统一做一次，之后游戏内才能自由播音与 TTS。
3. **`installedBackButtonHandler(route)` 只在原生壳里有实际行为**，浏览器里 `nativeApp()` 返回 `null`，直接跳过。
4. **家长页入口是「长按标题 3 秒」**（`startParentHold` / `cancelParentHold`），导航里没有这个按钮 —— 孩子不会误入，家长又找得到。同一个 3 秒长按语义在家长页的「清除本机存档」上再出现一次。

模板部分是「顶栏 + 主内容区」的纵向布局，顶栏在游戏路由与家长页隐藏：

```html
<header v-if="route.name !== 'play' && route.name !== 'parent'" class="...">
  <!-- 左：标题按钮（点击回大厅，长按 3 秒进家长页） -->
  <!-- 右：游戏馆 / 我的图鉴 / 声音 / 切换语言 -->
</header>
<main class="min-h-0 flex-1 bg-[#fdf3dc]"
      :class="route.name === 'play' ? 'overflow-hidden' : 'overflow-y-auto'">
```

两个刻意的设计：

- **进入游戏后隐藏顶栏**：游戏是全屏 Canvas，不给小朋友多余的可点区域；游戏内的返回与静音由 `PlayView` 自己画在左上 / 右上角。
- **`<PlayView>` / `<ReviewView>` 的 `key` 带上 locale**：切语言即重挂，避免出现半中半英的场景。

顶栏按钮尺寸与配色也有讲究：按钮用 `min-h-14`（56 px，2026-10-18 从 48 px 提到 56 px），选中态用深红 `#b03a31` —— 亮红配纸色的对比度只有 3.42:1，深红是 5.44:1，达到 WCAG AA。

## 5.3 hash 路由：33 行解决五个视图

外壳没有引入 vue-router。五个视图（hall / play / album / review / parent）用一份 33 行的 hash 路由足够：

```ts
// apps/site/src/router.ts
export interface Route {
  name: 'hall' | 'play' | 'album' | 'review' | 'parent';
  /** 内容 id：play 是玩哪一部，review 是复习哪一部（两者共用同一个 id 空间） */
  entryId?: string;
}

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const id = parts[1];
  if (parts[0] === 'play' && id) return { name: 'play', entryId: decodeURIComponent(id) };
  if (parts[0] === 'review' && id) return { name: 'review', entryId: decodeURIComponent(id) };
  if (parts[0] === 'album') return { name: 'album' };
  // 家长页：长按标题 3 秒进入（孩子点不到），与孩子的主线完全分开
  if (parts[0] === 'parent') return { name: 'parent' };
  return { name: 'hall' };
}
```

为什么是 hash 路由而不是 history 路由：

- 纯静态托管（GitHub Pages、Cloudflare Pages、对象存储）不需要任何服务端 rewrite 规则；
- Tauri 与 Capacitor 的 `file://` / 本地协议下 hash 一定可用；
- 自动化测试可以直接 `page.goto('/#/play/pangu')` 直达任意状态。

`review` 与 `play` 共用同一个内容 id 空间，这一点让「图鉴 → 复习 → 回到这一部再玩一次」这条动线不需要任何额外的映射表。

## 5.4 注册表：新增条目只加一行

```ts
// apps/site/src/registry.ts —— 外壳里唯一认识所有游戏的文件
export const registry: Record<string, () => Promise<{ default: GameModule }>> = {
  'caochong-elephant': () => import('@chags/game-caochong-elephant'),
  pangu: () => import('@chags/game-pangu'),
  houyi: () => import('@chags/game-houyi'),
  // …十七部典故…
  // 三十六计 · 第一辑（胜战计 1–6）
  'mantian-guohai': () => import('@chags/game-mantian-guohai'),
  'weiwei-jiuzhao': () => import('@chags/game-weiwei-jiuzhao'),
  // …一直排到第六辑…
  'zou-weishang': () => import('@chags/game-zou-weishang'),
};
```

注册表现在是 **53 条**，注释按「典故 / 六辑」分组。三条约束：

- **值是动态 import 函数**，Vite 会为每个游戏切出独立 chunk（Phaser 是它们共享的 chunk），外壳首屏永远不会加载游戏代码；
- **键必须与内容 JSON 的 `id` 一致**。这个一致性由 `apps/site/src/registry.test.ts` 强制：注册表、内容目录、懒加载函数三方对比，少一个、多一个、写错一个都会让 `pnpm test` 失败 —— 曾经的教训是「条目 id 抄在四个地方，新增第 8 个时全绿，用户点进去才 404」；
- 新增条目时除了这里，还要在 `apps/site/package.json` 的 dependencies 里加 `"@chags/game-<id>": "workspace:*"`，否则 `import` 解析不到。

## 5.5 PlayView：整个外壳唯一认识 Phaser 的地方

`PlayView.vue` 是宿主组件，227 行，是「Vue × Phaser 集成」的参考实现，也是这一年修 bug 修得最多的文件：

```ts
const props = defineProps<{ entryId: string }>();
const host = ref<HTMLDivElement | null>(null);
/** ★ 必须用 shallowRef：ref 会深度代理整个 Phaser 对象图 */
const mod = shallowRef<GameModule | null>(null);
const error = ref<string | null>(null);      // 给玩家看的：一句人话 + 两个出口
const loading = ref(false);
const leaving = ref(false);                  // 退出确认：误触不会中断这一局
let disposed = false;
/** 正在原地重开：典故卡上的按钮连点两下会进来两次，不挡住就会挂出两个 Phaser 实例 */
let restarting = false;

async function start(): Promise<void> {
  if (disposed || loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    // 先等读档完成：深链直接进游戏（或 autoplay 秒通关）时，
    // 一次写入早于读档完成就会被旧快照盖掉 —— 星星"白拿了"
    await progress.init();
    const load = registry[props.entryId];
    if (!load) { error.value = i18n.t('play.notFound') + props.entryId; return; }
    const loaded = (await load()).default;
    if (disposed || !host.value) return;
    mod.value = loaded;
    await loaded.mount(await createGameContext(loaded.manifest, host.value, i18n.locale, {
      onExit: (reason) => {
        // 「再来一次」：原地重开，不回大厅
        if (reason === 'replay') { void restart(); return; }
        navigate('/');
      },
      onEvent: handleEvent,
    }, progress.hasCard(props.entryId)));   // 二周目才允许「跳过故事」
    // 切后台要真的暂停：游戏循环睡着才不烧电，顺带把没念完的旁白停掉
    offPause = platform.lifecycle.onPause(() => { mod.value?.pause(); platform.audio.stopSpeech(); });
    offResume = platform.lifecycle.onResume(() => { mod.value?.resume(); });
  } catch (cause) { /* …详见下文… */ }
}
```

这段代码里的六条纪律，每一条都对应一类真实故障：

| 纪律 | 不遵守的后果 |
|---|---|
| `shallowRef` 持有 `GameModule` | Vue 深度代理 Phaser 对象图，轻则卡顿，重则抛错 |
| `await progress.init()` 后才挂载 | 深链秒通关时写入被旧快照盖掉，星星白拿 |
| `await unmount()`（内部 `game.destroy(true)`）+ `stopSpeech()` | canvas 与 RAF 循环残留、回大厅后旁白还在念 |
| `disposed` 标记 | 慢网下组件已卸载、`import` 才返回，挂到已销毁的容器上 |
| `restarting` 幂等锁 | 连点「再来一次」会挂出两个 Phaser 实例（两块 canvas 叠着） |
| 错误不上屏技术细节 | 玩家看到 zod 报错原文；现在只显示一句人话，细节进 `window.__chags.lastError` |

`handleEvent` 同时处理两件事，且**分开两个口径**：

```ts
function reviewGrade(result: GameEventMap['level:complete']): Stars {
  // 有答对率（记对错的模板）就用答对率；纯动手的模板 total=0，退回用星星
  return result.total > 0 ? gradeFromScore(result.correct, result.total) : result.stars;
}

function handleEvent(type, payload): void {
  if (type === 'level:complete') {
    const result = payload as GameEventMap['level:complete'];
    void progress.recordCompletion(props.entryId, result.stars, reviewGrade(result));
    playtime.addRound();
  }
}
```

星星是「这一局玩得怎么样」（只增不减），评级是「记得牢不牢」（决定下次什么时候复习）。上一版这里写的是 `recordCompletion(id, stars, stars)` —— 拿星星顶替评级，是当时的临时状态；2026-10-16 复习上线后已按上面的口径改掉（第 10 章）。

模板部分是「游戏容器 + 两个角上的工具条 + 三个覆盖层」：

- 左上角返回键（`data-testid="play-leave"`）→ 弹出「现在回去吗？/ 再玩一会」确认层；
- 右上角声音键（`play-sound`）→ 静音切换（三处同一状态）；
- 载入失败层：一句人话 + 「再试一次」（`play-retry`，可重复点击）与「回游戏馆」（`play-back`）。

计时器也挂在这里：`setInterval(() => playtime.addSeconds(30), 30_000)` —— 休息提醒只统计「玩游戏的时间」，大厅与图鉴的时间不算。

## 5.6 GameContext 的组装与调试桥

`shell/createGameContext.ts` 从 2026-10-18 起是**异步**的（`await loadEntry(...)`），并且是调试开关的唯一解析点：

```ts
/**
 * 调试开关只在两种情况下生效：开发服务器，或自动化浏览器（Playwright 会置 webdriver）。
 * 生产环境的普通孩子拿不到 ?autoplay=1 —— 否则一个分享链接就能绕过"故事必须听完"，
 * 并且自动通关还会把星星记进存档。
 */
function debugAllowed(): boolean {
  if (import.meta.env.DEV) return true;
  return typeof navigator !== 'undefined' && navigator.webdriver === true;
}

export async function createGameContext(
  manifest: GameManifest, container: HTMLElement, locale: Locale,
  hooks: GameHostHooks, completedBefore: boolean,
): Promise<GameContext> {
  // 关键：交给游戏的是**已经翻译好**的内容，游戏本身不需要知道语言的存在
  const content = await loadEntry(manifest.id, locale);
  if (!content) throw new Error('找不到游戏内容：' + manifest.id);

  return {
    container, manifest, content,
    services: platform,
    locale,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    debug: readDebugOptions(),
    completedBefore,
    emit(type, payload) {
      platform.telemetry.track(type, payload);
      recordDebugEvent(type, detailOf(type, payload));
      hooks.onEvent(type, payload);
    },
    requestExit(reason) { hooks.onExit(reason); },
  };
}
```

每次 `emit` 走三个出口：本地遥测缓冲、调试桥（`window.__chags.events`）、宿主回调。`detailOf` 会把事件里最关键的细节拼进调试桥条目（`scene:enter:story`、`choice:made:carve`、`story:ready:b2`），端到端测试就是靠这些字符串做断言。

调试桥本体只有二十来行，生产环境也开着 —— 它只记录事件类型与节点名，不采集任何个人信息：

```ts
export function recordDebugEvent(type: string, detail?: string): void {
  const w = window;
  if (!w.__chags) w.__chags = { events: [], last: null };
  const entry = detail ? type + ':' + detail : type;
  w.__chags.events.push(entry);
  w.__chags.last = entry;
}
```

## 5.7 状态：Pinia 的四个 store

| store | 文件 | 管什么 |
|---|---|---|
| `progress` | `stores/progress.ts` | 存档快照、收集数、星星、复习到期判断、写盘失败的可见性 |
| `settings` | `stores/settings.ts` | 全局静音（localStorage 记忆） |
| `playtime` | `stores/playtime.ts` | 当天玩耍秒数、局数、20 分钟休息提醒 |
| `locale` | `stores/locale.ts` | 当前语言、取词器、切换语言 |

### progress：不只是「存档的门面」

```ts
export const useProgress = defineStore('progress', () => {
  const save = ref<SaveData>(progressManager.snapshot());
  const ready = ref(false);
  const unsaved = ref(false);          // 写盘失败（配额满 / 无痕模式）：界面要提示
  const initError = ref<string | null>(null);
  let inflight: Promise<void> | null = null;

  /** 读档：多次调用共享同一次（single-flight） */
  function init(): Promise<void> {
    inflight ??= (async () => {
      try { save.value = await progressManager.init(); }
      catch (cause) { initError.value = String(cause); }
      finally { ready.value = true; }
    })();
    return inflight;
  }

  /** 所有写盘都走这里：失败要可见，不能让"进度没存上"静默消失 */
  async function persist(action: () => Promise<unknown>): Promise<void> {
    try { await action(); unsaved.value = false; }
    catch (cause) { unsaved.value = true; console.warn('[chags] 存档写入失败', cause); }
    finally { save.value = progressManager.snapshot(); }
  }
  // …collected / starsFor / hasCard / reviewOf / reviewDue / recordCompletion / recordReview / clear
});
```

三个「曾经踩过」的点都在代码里写明了：`init()` 的 single-flight（深链秒通关会写入被旧快照盖掉）、`persist()` 的失败可见（写失败以前是静默的，星星白拿）、`loadEntry` 之前先 `await progress.init()`（第 10 章细讲）。

### settings / playtime

```ts
const MUTED_KEY = 'chags.muted';
export const useSettings = defineStore('settings', () => {
  const muted = ref(false);
  function setMuted(next: boolean): void {
    muted.value = next;
    platform.audio.setMuted(next);          // 同时停掉正在念的旁白
    try { window.localStorage.setItem(MUTED_KEY, next ? '1' : '0'); } catch { /* 隐私模式 */ }
  }
  return { muted, init, setMuted, toggle };
});
```

```ts
export const REST_AFTER_SECONDS = 20 * 60;   // 连续玩到 20 分钟提醒休息一次

export const usePlaytime = defineStore('playtime', () => {
  const record = ref<DayRecord>(read());     // { date, seconds, rounds, reminded }
  const restDue = computed(
    () => !record.value.reminded && record.value.seconds >= REST_AFTER_SECONDS,
  );
  function addSeconds(amount: number): void { /* 每 30 秒由 PlayView 上报 */ }
  function addRound(): void { /* 每通关一局 +1，家长页"本周玩了几个"用 */ }
  function dismissRest(): void { /* 点过"知道啦"：今天不再提醒 */ }
  return { seconds, rounds, restDue, addSeconds, addRound, dismissRest, REST_AFTER_SECONDS };
});
```

两个 store 的共同点是**只存最小必要信息**：静音只存一个布尔，玩耍时长只存「今天几秒、几局、提醒过没有」。跨天自动归零，字段缺了也不炸 —— 无痕模式下写不进去时，本次会话仍然生效。

### locale：切语言要先加载补丁

```ts
async function setLocale(next: Locale): Promise<void> {
  await ensurePatches(next);   // 英文摘要补丁约 9 KB gzip，只在切英文时加载
  apply(next);
}
function toggle(): void { void setLocale(locale.value === 'en' ? 'zh-CN' : 'en'); }
```

`?lang=` 优先于上次选择，上次选择优先于默认中文；`document.documentElement.lang` 同步让无障碍工具知道当前语言。

## 5.8 五个视图

### 游戏馆（HallView，203 行）

- **按分组分区渲染**：`gameGroups(locale)` 来自内容层，视图本身不认识「典故」或「三十六计」；空组显示「敬请期待」而不是消失；
- 卡片上有定性徽章（五种配色）、「第 n 计」与套名、拼音、年代、年龄、寓意、关键词、星级；
- **整张卡可点**（`data-testid="card-<id>"`）—— 以前只有底部「开始玩」有反应，而孩子看到一张大卡的第一反应就是点卡片本身；
- 顶部「已收集 N / 53」，`data-testid="collected-count"`；
- 四条**按状态出现**的横条：存档异常提示、20 分钟休息提醒、「继续上次」、到期复习横幅（`hall-review`，只在真的到期时出现，「去复习」直达第一部）。

### 我的图鉴（AlbumView，105 行）

只显示 `hasCard(id)` 的卡，按分组分卷（空卷不显示），顶部一句「有 n 个典故该复习了」。每张卡上：

- 「第 n 计 · 套名」、思维标签、拼音与年代、寓意；
- 三十六计多一行「今天可以怎么用」（`transfer`）；
- 出处书名；**文言原文默认折叠在 `<details>` 里** —— 7–10 岁读不懂「之乎者也」，先看寓意与迁移句就够了；
- 右下角「复习」按钮（`review-start-<id>`），到期时左侧多一枚「该复习了」徽章。

### 到期复习（ReviewView，177 行）

纯 DOM，不加载 Phaser（三道题不值得再下一遍 220 KB 的引擎）。一屏一题：进度「第 n / 3 题」、题干、选项（`<button>`，键盘可达）、作答后的对错与解释（`aria-live="polite"`）、「下一题」；答完最后一题写 `recordReview`，结果页两行：「答对 n / 3 题」与「n 天后再来复习」，两个出口是「再玩一次」与「回图鉴」。

2026-10-20 补了一处细节：答完之后把「下一题」`scrollIntoView` 滚进视野 —— 选项被 disabled 后看起来仍可点，而真正的出口在列表下方、小屏上经常已经在屏幕外。

### 家长页（ParentView，117 行）

四件事：安全边界三条（不联网 / 无广告内购 / 存档只在本机）、这周玩过哪些典故（按最后游玩时间倒序，最多 6 个）、声音开关与**长按 3 秒清除本机存档**、版本号。入口是长按标题 3 秒，页内再没有别的入口 —— 孩子不会误入。

### 游戏宿主（PlayView）

见 5.5。五个视图合计不到 700 行，这正是双栈分工的价值：UI 密集的部分用声明式模板，游戏部分完全隔离。

## 5.9 其余 shell 文件

| 文件 | 内容 |
|---|---|
| `shell/platform.ts` | `export const platform = createWebPlatform();` —— 平台服务单例 |
| `shell/progress.ts` | `export const progressManager = new ProgressManager(platform.storage, () => platform.now());` |
| `shell/backButton.ts` | 安卓实体返回键：非大厅 → 回大厅；大厅 → 退出应用。`installBackButtonHandler(route, bridge = nativeApp(), goHome = navigate)` 三个参数都可注入，因此有 5 条单测 |
| `style.css` | 根节点 `overflow: hidden`；`touch-action: manipulation` 防双击缩放；`user-select: none`；`env(safe-area-inset-*)` 让开刘海与手势条；`prefers-reduced-motion` 减少动效 |
| `index.html` | `viewport-fit=cover`、`theme-color`、描述与标题；2026-10-18 起**不再设 `user-scalable=no`**（违反 WCAG 1.4.4），改为放开缩放、画布自己 `touch-action: none` |

返回键的实现在第 9 章的运行环境探测之上，逻辑很简单但很必要：

```ts
export function installBackButtonHandler(
  route: Ref<Route>, bridge = nativeApp(), goHome = navigate,
): void {
  if (!bridge) return;                       // 浏览器里是空操作
  bridge.addListener('backButton', () => {
    if (route.value.name !== 'hall') { goHome('/'); return; }
    void bridge.exitApp();
  });
}
```

不处理的话，孩子在游戏里误按返回键会直接把应用关掉。把它写成可注入的三个参数，是为了让「游戏里按返回键不该退出应用」这条纪律能被单测守住 —— 原生壳本身在浏览器里测不到。

## 5.10 小结

- 外壳的组成：启动（App.vue 的四件全局事务）、路由（33 行 hash、五个视图）、注册表（53 行、一行一个条目）、宿主（PlayView 的六条纪律）、状态（四个 Pinia store）、五个视图；
- 语言切换的优先级、切语言重挂游戏、英文补丁懒加载是双语体验的三个关键实现点；
- 音效解锁、返回键、安全区、静音、休息提醒这些「外壳级」问题统一在外壳解决，游戏侧完全无感；
- 错误处理遵循一条原则：**给玩家一句人话，给开发与自动化完整细节**；
- 「点了没反应」这一类问题在外壳侧修了两处：大厅整卡可点、复习页「下一题」自动滚入视野。

下一章进入数据侧：内容模型与条目 JSON —— 「换内容 = 换 JSON」这条产品承诺的底层实现。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/CHAGS/第04章-核心契约与游戏生命周期/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/CHAGS/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/CHAGS/第06章-内容数据模型与典故JSON/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

---
layout: default
title: 第05章 - Vue应用外壳详解
---

# 第05章 - Vue应用外壳详解

## 5.1 外壳的职责边界

外壳（`apps/site`）是整个应用里唯一「产品代码」：它负责大厅、图鉴、游戏宿主、路由、状态与语言切换；而游戏内部的一切（故事、玩法、音效）它都不知道。这条边界带来的好处是双向的：外壳可以独立演化为小程序壳、桌面壳、安卓壳（第 14 章），游戏则可以独立开发与测试。

外壳包里的文件一共二十来个，本章按「启动 → 路由 → 注册表 → 宿主 → 状态 → 视图」的顺序逐个讲清。

## 5.2 启动链路

```ts
// apps/site/src/main.ts
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).use(createPinia()).mount('#app');
```

`App.vue` 的 `<script setup>` 部分定义了外壳的三个全局行为：

```ts
const route = useRoute();
const progress = useProgress();
const i18n = useLocale();

/** iOS / 微信：音频必须由用户手势解锁 */
function unlockAudio(): void {
  void platform.audio.unlock();
}

onMounted(() => {
  void progress.init();                                   // 读 IndexedDB 存档
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  // 只在原生壳里生效；浏览器里是空操作
  installBackButtonHandler(route);
});
```

三个细节：

1. **音频解锁挂在第一次 `pointerdown` 上且 `{ once: true }`**。iOS Safari 与微信要求音频必须由用户手势触发解锁，外壳统一做一次，之后游戏内才能自由播音与 TTS；
2. **`progress.init()` 在挂载时读取存档**，大厅的星星与图鉴依赖它；
3. **返回键处理只在原生壳里有实际行为**，浏览器里 `nativeApp()` 返回 `null`，直接跳过。

模板部分是一个两行结构的纵向布局：顶栏 + 主内容区。

```html
<div class="flex h-full flex-col bg-[#3a2f26]">
  <header v-if="route.name !== 'play'" class="...">
    <!-- 左：应用标题（窄屏隐藏副标题）；右：三个导航按钮 -->
  </header>
  <main :class="route.name === 'play' ? 'overflow-hidden' : 'overflow-y-auto'">
    <PlayView v-if="route.name === 'play'" :key="route.gameId + ':' + i18n.locale" :game-id="route.gameId ?? ''" />
    <AlbumView v-else-if="route.name === 'album'" />
    <HallView v-else />
  </main>
</div>
```

两个刻意的设计：

- **进入游戏后隐藏顶栏**（`v-if="route.name !== 'play'"`）：游戏是全屏 Canvas，不给小朋友多余的可点区域；
- **`PlayView` 的 `key` 带上 locale**：切换语言即重挂游戏（重建 Phaser 实例），避免出现半中半英的场景。

顶栏按钮尺寸与配色也有讲究：按钮用 `min-h-12`（48 物理像素左右的可点高度）、选中态用深红 `#b03a31` 而不是亮红 —— 亮红配纸色的对比度只有 3.42:1，深红是 5.44:1，达到 WCAG AA（这些数字来自一次全仓库无障碍审查，第 16 章有完整清单）。

## 5.3 hash 路由：20 行解决三个视图

外壳没有引入 vue-router。三个视图（hall / album / play）用一个 30 行的 hash 路由足够了：

```ts
// apps/site/src/router.ts
import { ref } from 'vue';
import type { Ref } from 'vue';

export interface Route {
  name: 'hall' | 'play' | 'album';
  gameId?: string;
}

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'play' && parts[1]) {
    return { name: 'play', gameId: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'album') return { name: 'album' };
  return { name: 'hall' };
}

const route: Ref<Route> = ref(parse(window.location.hash));

window.addEventListener('hashchange', () => {
  route.value = parse(window.location.hash);
});

export function useRoute(): Ref<Route> {
  return route;
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith('#') ? path : '#' + path;
}
```

为什么是 hash 路由而不是 history 路由：

- 纯静态托管（GitHub Pages、Cloudflare Pages、对象存储）不需要任何服务端 rewrite 规则；
- Tauri 与 Capacitor 的 `file://` / 本地协议下 hash 一定可用；
- 自动化测试可以直接 `page.goto('/#/play/pangu')` 直达任意状态。

技术方案里给这条决策留了翻案条件：**路由超过 5 条或需要嵌套路由时再引入 vue-router**。当前的 `?autoplay=1&lang=en` 等调试参数走 query string，与 hash 互不干扰。

## 5.4 注册表：新增典故只加一行

```ts
// apps/site/src/registry.ts —— 外壳里唯一认识所有游戏的文件
export const registry: Record<string, () => Promise<{ default: GameModule }>> = {
  'caochong-elephant': () => import('@chags/game-caochong-elephant'),
  pangu: () => import('@chags/game-pangu'),
  houyi: () => import('@chags/game-houyi'),
  nuwa: () => import('@chags/game-nuwa'),
  jingwei: () => import('@chags/game-jingwei'),
  kuafu: () => import('@chags/game-kuafu'),
  yugong: () => import('@chags/game-yugong'),
  shennong: () => import('@chags/game-shennong'),
  qiren: () => import('@chags/game-qiren'),
  fenghuo: () => import('@chags/game-fenghuo'),
  taigong: () => import('@chags/game-taigong'),
  dayu: () => import('@chags/game-dayu'),
};
```

- **值是动态 import 函数**，Vite 会为每个游戏切出独立 chunk（Phaser 是它们共享的 chunk），外壳首屏永远不会加载游戏代码；
- **键必须与内容 JSON 的 `id` 一致**。这个一致性由 `apps/site/src/registry.test.ts` 强制：注册表、内容目录、懒加载函数三方对比，少一个、多一个、写错一个都会让 `pnpm test` 失败 —— 曾经的教训是「典故 id 抄在四个地方，新增第 8 个时全绿，用户点进去才 404」；
- 新增典故时除了这里，还需要在 `apps/site/package.json` 的 dependencies 里加 `"@chags/game-<id>": "workspace:*"`。

## 5.5 PlayView：整个外壳唯一认识 Phaser 的地方

`PlayView.vue` 是宿主组件，全文不到 90 行，是「Vue × Phaser 集成」的参考实现：

```ts
const props = defineProps<{ gameId: string }>();
const host = ref<HTMLDivElement | null>(null);
/** ★ 必须用 shallowRef：ref 会深度代理整个 Phaser 对象图 */
const mod = shallowRef<GameModule | null>(null);
const error = ref<string | null>(null);
let disposed = false;

function handleEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
  if (type === 'level:complete') {
    const result = payload as GameEventMap['level:complete'];
    void progress.recordCompletion(props.gameId, result.stars, result.stars);
  }
}

onMounted(async () => {
  const load = registry[props.gameId];
  if (!load) {
    error.value = i18n.t('play.notFound') + props.gameId;
    return;
  }
  try {
    const loaded = (await load()).default;
    if (disposed || !host.value) return;
    mod.value = loaded;
    await loaded.mount(
      createGameContext(loaded.manifest, host.value, i18n.locale, {
        onExit: () => navigate('/'),
        onEvent: handleEvent,
      }),
    );
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    error.value = i18n.t('play.loadFailed');
    // 详情只留给开发与自动化：e2e 靠它定位问题，玩家不需要看到
    console.error('[chags] 游戏载入失败：' + props.gameId, cause);
    window.__chags = window.__chags ?? { events: [], last: null };
    window.__chags.lastError = detail;
  }
});

onBeforeUnmount(async () => {
  disposed = true;
  await mod.value?.unmount();
  mod.value = null;
});
```

这段代码里有四条纪律，每一条都对应一类真实故障：

| 纪律 | 不遵守的后果 |
|---|---|
| `shallowRef` 持有 `GameModule` | Vue 深度代理 Phaser 对象图，轻则卡顿，重则抛错 |
| `await unmount()`（内部 `game.destroy(true)`） | canvas 与 RAF 循环残留，回到大厅后仍在后台跑 |
| `disposed` 标记 | 慢网下组件已卸载、`import` 才返回，挂到已销毁的容器上 |
| 错误不上屏技术细节 | 玩家看到 `[{"origin": "string", "code": "too_big" ...}]` 这类 zod 报错原文 |

模板部分：游戏容器铺满，出错时显示一句人话 + 「回典故馆」按钮：

```html
<div class="relative h-full w-full bg-[#3a2f26]">
  <div ref="host" class="game-host h-full w-full" />
  <div v-if="error" class="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#3a2f26]/95 px-8 text-center">
    <p class="text-lg text-[#fdf3dc]">{% raw %}{{ error }}{% endraw %}</p>
    <button type="button" class="rounded-full bg-[#b03a31] px-10 py-3 text-lg text-[#fdf3dc] active:scale-95" @click="navigate('/')">
      {% raw %}{{ i18n.t('play.backToHall') }}{% endraw %}
    </button>
  </div>
</div>
```

注意 `level:complete → recordCompletion(gameId, stars, stars)` 这行：第二个 `stars` 同时被当作复习评级 `grade` 使用，这是**当前的临时状态** —— 复习测验（`createQuizScene`）还没有接上生产入口，所以没有答对率可用；这一点在第 10 章和第 16 章都会说明。它不影响星星与图鉴，只是复习间隔的推算暂时以星星代替。

## 5.6 GameContext 的组装与调试桥

`shell/createGameContext.ts` 负责把契约实例化出来（第 4 章给过接口，这里是实现要点）：

```ts
/** ?autoplay=1&seed=xxx —— 无头直达的调试开关 */
export function readDebugOptions(): DebugOptions | undefined {
  const params = new URLSearchParams(window.location.search);
  const autoplay = params.get('autoplay') === '1';
  const seed = params.get('seed');
  if (!autoplay && !seed) return undefined;
  const options: DebugOptions = {};
  if (autoplay) options.autoplay = true;
  if (seed !== null && seed.length > 0) options.seed = seed;
  return options;
}

export function createGameContext(manifest, container, locale, hooks): GameContext {
  // 关键：交给游戏的是**已经翻译好**的内容，游戏本身不需要知道语言的存在
  const content = getAllusion(manifest.id, locale);
  if (!content) throw new Error('找不到典故内容：' + manifest.id);

  return {
    container, manifest, content,
    services: platform,
    locale,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    debug: readDebugOptions(),
    emit(type, payload) {
      platform.telemetry.track(type, payload);
      recordDebugEvent(type, detailOf(type, payload));
      hooks.onEvent(type, payload);
    },
    requestExit() { hooks.onExit(); },
  };
}
```

每次 `emit` 走三个出口：本地遥测缓冲、调试桥（`window.__chags.events`）、宿主回调。`detailOf` 会把事件里最关键的细节拼进调试桥条目（如 `scene:enter:story`、`choice:made:carve`、`beat:enter:milestone:zhisou`），端到端测试就是靠这些字符串做断言。

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

## 5.7 状态：Pinia 的两个 store

### locale store：语言选择

```ts
const STORAGE_KEY = 'chags.locale';

/** 优先级：URL 的 ?lang= > 上次选择 > 默认中文 */
function initialLocale(): Locale {
  const fromUrl = localeFromSearch(window.location.search);
  if (fromUrl) return fromUrl;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  return DEFAULT_LOCALE;
}

export const useLocale = defineStore('locale', () => {
  const locale = ref<Locale>(initialLocale());
  const t = computed(() => createTranslator(locale.value));

  function apply(next: Locale): void {
    locale.value = next;
    document.documentElement.lang = next;
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* 隐私模式 */ }
  }
  apply(locale.value);

  function toggle(): void {
    apply(locale.value === 'en' ? 'zh-CN' : 'en');
  }

  return { locale, t, setLocale: apply, toggle };
});
```

`?lang=` 优先让分享链接与自动化测试能直接指定语言；`document.documentElement.lang` 同步让无障碍工具知道当前语言；隐私模式下 localStorage 写入失败也不影响本次会话。

### progress store：存档的门面

```ts
export const useProgress = defineStore('progress', () => {
  const save = ref<SaveData>(progressManager.snapshot());
  const ready = ref(false);

  async function init(): Promise<void> {
    save.value = await progressManager.init();
    ready.value = true;
  }

  const collected = computed(
    () => Object.values(save.value.allusions).filter((a) => a.completions > 0).length,
  );
  function starsFor(allusionId: string): number {
    return save.value.allusions[allusionId]?.stars ?? 0;
  }
  function hasCard(allusionId: string): boolean {
    return (save.value.allusions[allusionId]?.completions ?? 0) > 0;
  }
  async function recordCompletion(allusionId, stars, grade): Promise<void> {
    await progressManager.recordCompletion(allusionId, stars, grade);
    save.value = progressManager.snapshot();
  }

  return { save, ready, init, collected, starsFor, hasCard, recordCompletion };
});
```

store 只是 `ProgressManager` 的 Vue 投影：真正的读写、迁移、复习调度都在 `packages/progress`（第 10 章），Pinia 负责把快照变成响应式数据给视图用。

## 5.8 三个视图

### 典故馆（HallView）

按 `yearApprox` 排序（神话为负数，排最前），每张卡片包含：

- 定性徽章：神话紫色 / 传说金色 / 信史青色三套配色；
- 拼音、朝代（`era`）、适用年龄；
- 一句话寓意（`moral`）；
- 关键词标签；
- 星级（已收集显示实星，否则空心）；
- 「开始玩」按钮，`data-testid="start-<id>"`（端到端测试的稳定锚点）。

页面顶部是「已收集 N / 12 个典故」，`data-testid="collected-count"` —— 端到端里有「通关 → 计数变 1 → 刷新后仍是 1」的断言。

### 我的图鉴（AlbumView)

只显示 `hasCard(id)` 的典故卡：标题、星级、拼音、寓意、出处书名与原文引用。图鉴是与「典故卡」形成收集闭环的地方：玩过的主体是图鉴里多出来的那张卡。

### 游戏宿主（PlayView）

见 5.5。三个视图合计不到 250 行，这正是双栈分工的价值：UI 密集的部分用声明式模板，游戏部分完全隔离。

## 5.9 其余 shell 文件

| 文件 | 内容 |
|---|---|
| `shell/platform.ts` | `export const platform = createWebPlatform();` —— 平台服务单例 |
| `shell/progress.ts` | `export const progressManager = new ProgressManager(platform.storage, () => platform.now());` |
| `shell/backButton.ts` | 安卓实体返回键：在游戏/图鉴里 → 回典故馆；已在典故馆 → 退出应用 |
| `style.css` | 根节点 `overflow: hidden`（由应用自己管滚动）；`touch-action: manipulation` 防双击缩放；`user-select: none`；`env(safe-area-inset-*)` 让开刘海与手势条 |
| `index.html` | `viewport-fit=cover`、`theme-color`、描述与标题 |

返回键的实现在第 9 章的运行环境探测之上，逻辑很简单但很必要：

```ts
export function installBackButtonHandler(route: Ref<Route>): void {
  const app = nativeApp();
  if (!app) return;
  app.addListener('backButton', () => {
    if (route.value.name !== 'hall') {
      navigate('/');
      return;
    }
    void app.exitApp();
  });
}
```

不处理的话，孩子在游戏里误按返回键会直接把应用关掉。

## 5.10 小结

- 外壳的组成：启动（App.vue 的三件全局事务）、路由（20 行 hash）、注册表（一行一典故）、宿主（PlayView 的四条纪律）、状态（两个 Pinia store）、三个视图；
- 语言切换的优先级与「切语言重挂游戏」是双语体验的两个关键实现点；
- 音效解锁、返回键、安全区适配这些「外壳级」问题统一在外壳解决，游戏侧完全无感；
- 错误处理遵循一条原则：**给玩家一句人话，给开发与自动化完整细节**。

下一章进入数据侧：内容模型与典故 JSON —— 「换典故 = 换内容」这条产品承诺的底层实现。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/others/CHAGS/第04章-核心契约与游戏生命周期/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/others/CHAGS/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/others/CHAGS/第06章-内容数据模型与典故JSON/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

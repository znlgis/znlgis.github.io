---
layout: default
title: 第05章 - Vue应用外壳详解
---

# 第05章 - Vue应用外壳详解

## 5.1 外壳的边界

`apps/site` 是整个仓库里唯一的产品界面代码，也是唯一「知道 Phaser 存在、但只在少数几处提起它」的包：`registry.ts` 与 `arcade/registry.ts` 两张动态 import 表、`views/PlayView.vue` 与 `views/ArcadePlayView.vue` 两个宿主组件、`shell/createGameContext.ts` 与 `shell/createArcadeContext.ts` 里的上下文组装（后者第 4 章已拆过）。除此之外的三十来个文件——八个视图、三个 store、七个 shell 工具、六个 logic 纯函数、两个 SVG 组件——完全不认识游戏引擎。

目录速查：

| 文件（相对 `apps/site/src/`） | 内容 | 行数 |
|---|---|---|
| `main.ts` | 启动链：调试桥 → 语言 chunk → 挂载 | 25 |
| `App.vue` | 顶栏 / 主滚动区 / 底栏，家长页长按入口 | 223 |
| `router.ts` | hash 路由，8 条 | 71 |
| `registry.ts` / `arcade/registry.ts` | 任务 id / 小游戏 id → 动态 import | 22 / 13 |
| `arcade/catalog.ts` | 三款小游戏的展示元数据（emoji / 底色 / 文案键） | 43 |
| `views/` | Home 379 / Tasks 146 / Play 323 / Dress 186 / Diary 176 / Parent 178 / Arcade 135 / ArcadePlay 246 | — |
| `stores/` | progress 253 / settings 47 / locale 37 | — |
| `shell/` | platform、progress、debug、createGameContext、createArcadeContext、useI18n、backButton | 7–89 |
| `logic/` | locale、labels、taskGroups、diary、dressGroups、pandaLook | 22–76 |
| `components/` | PandaBuddy（SVG 熊猫）、RoomScene（SVG 小屋） | 312 / 146 |

三条边界不靠自觉，靠工具守住：

1. **内容边界**：`eslint.config.js` 对 `apps/site/src/**/*.{ts,vue}` 打开了 `no-restricted-imports`，直接禁掉 `@bamboo/content/full`，报错文案就是「外壳不许直接引入完整内容：用 @bamboo/content 的 loadTask()（动态 import）」。有人为了省事把十个关卡脚本同步 import 进来，lint 当场失败，首屏体积不会悄悄涨上去（第 6 章）。
2. **存档边界**：界面不拼 `SaveData`，只调 `useProgress()` 暴露的方法；真正的读写、迁移、衰减在 `packages/progress` 的 `ProgressManager` 里（第 10 章）。
3. **平台边界**：存储、音频、生命周期、遥测统一走 `shell/platform.ts` 导出的 `platform` 单例，界面与玩法都不许绕过它去碰 `localStorage` 或 `fetch`（第 9 章）。

这条边界带来的直接好处是：外壳可以原封不动地塞进 Tauri 的 WebView2 和 Capacitor 的安卓 WebView（第 15 章），因为除了 `shell/backButton.ts` 里那一次 `nativeApp()` 探测，它没有任何宿主假设。

## 5.2 启动链：25 行里的四个决定

`main.ts` 很短，但每一个 `await` 都有代价与理由：

```ts
// apps/site/src/main.ts
initDebugBridge();

const initial = initialLocale();
void Promise.all([ensureSummaries(initial.locale), ensureMessages(initial.locale)]).finally(() => {
  if (initial.fromUrl) persistLocale(initial.locale);
  applyLocaleDocument(initial.locale);
  createApp(App).use(createPinia()).mount('#app');
});
```

四个决定：

- **调试桥先于挂载**。`initDebugBridge()` 在 `createApp` 之前跑，因为 e2e 可能一打开页面就读 `window.__bamboo.save`，不等用户点任何东西；它只有事件名和存档快照，不含个人信息，生产环境同样开着。
- **英文内容补丁先就位再挂载**。`ensureSummaries`（摘要补丁）与 `ensureMessages`（界面文案）并行等待，然后才 `mount`。否则英文用户会先看到一屏中文标题再「跳」成英文；中文用户因为 `ensureSummaries` 对 `zh-CN` 直接 `Promise.resolve()`，一个字节都不多下载。
- **`finally` 而不是 `then`**。任何一份 chunk 加载失败（离线、资源被清）也要能把应用挂起来——补丁缺失时 `ensureSummaries` 内部会置空缓存并回落中文，界面不会白屏。
- **`fromUrl` 才写 localStorage**。`?lang=en` 是分享链接语义：只有 URL 明确指定时才把选择记下来，免得自动化测试跑完把测试机的默认语言改掉。

`App.vue` 的 `<script setup>` 只做四件事：

```ts
const PlayView = defineAsyncComponent(() => import('./views/PlayView.vue'));
const ParentView = defineAsyncComponent(() => import('./views/ParentView.vue'));
const DiaryView = defineAsyncComponent(() => import('./views/DiaryView.vue'));
const ArcadeView = defineAsyncComponent(() => import('./views/ArcadeView.vue'));
const ArcadePlayView = defineAsyncComponent(() => import('./views/ArcadePlayView.vue'));

const isFullScreen = computed(
  () =>
    route.value.name === 'player' ||
    route.value.name === 'parent' ||
    route.value.name === 'arcadePlay',
);

// 路由切换把主滚动区拉回顶部：从滚到一半的小屋点「任务」，
// 新页面若保持旧 scrollTop，会直接停在半张卡片上
watch(
  () => route.value.name + ':' + (route.value.taskId ?? ''),
  () => {
    void nextTick(() => {
      mainRef.value?.scrollTo({ top: 0 });
    });
  },
);
```

- **五个页面懒加载**：`PlayView` 与 `ArcadePlayView` 是 Phaser 的入口，必须等孩子真的点开才下载；`ParentView`、`DiaryView`、`ArcadeView` 懒加载则是给首屏腾体积——绝大多数会话不会先进家长页，日记一天看一次，游戏厅更要先解锁。日记页那一次是 2026-10-20 加彩蛋时补的：入口与触发逻辑让首屏涨到 60.0 KB，把日记页改成路由懒加载后回到 58.9 KB。
- **`isFullScreen` 同时干掉顶栏与底栏**：游戏与小游戏是全屏 Canvas，家长页是一份长文档，三者都不该有「小屋 / 任务 / 装扮」三个大按钮在旁边晃。
- **`PlayView` 的 key 是 `taskId + ':' + locale`**：切语言即重挂游戏、换任务即重建 Phaser 实例，避免出现半中半英的场景或两个 canvas 叠加。

`onMounted` 里挂的东西也值得逐条列：

| 动作 | 为什么放在挂载时 |
|---|---|
| `settings.init()` | 读回上次的静音选择并同步给 `platform.audio` |
| `installBackButtonHandler(route)` | 安卓实体返回键：先回小屋，再按才退出（浏览器里是空操作） |
| `progress.init()` | 一次性读 IndexedDB 存档，小屋的星星与阶段依赖它 |
| `pointerdown` 上的一次性音频解锁 | iOS / 微信要求音频由用户手势解锁，只解一次，用 `{ once: true }` |
| `platform.lifecycle.onResume()` → `progress.refresh()` | 应用可能在平板上挂了一整夜，回前台补一次跨天衰减 |

`onBeforeUnmount` 把定时器、事件监听、生命周期订阅逐一撤掉。这一层没有 `onUnmounted` 兜底——单页应用里 `App.vue` 不会卸载，写在这里是为了 HMR 时不叠监听。

## 5.3 hash 路由表：71 行，没有 vue-router

`router.ts` 只有两个导出：`useRoute()` 返回一个 `Ref<Route>`，`navigate(path)` 改 `window.location.hash`。路由表是 `if` 串联：

```ts
// apps/site/src/router.ts
export function parseRoute(hash: string): Route {
  // 调试参数也允许挂在 hash 里（'#/play/brush?autoplay=1'）：路由只看 '?' 之前的部分
  const clean = hash.split('?')[0] ?? hash;
  const parts = clean.replace(/^#\/?/, '').split('/').filter(Boolean);
  const head = parts[0];
  if (head === 'play') {
    const taskId = asTaskId(parts[1]);
    // 未知玩法 id 直接回小屋：不给孩子一个空白页
    return taskId ? { name: 'player', taskId } : { name: 'home' };
  }
  // 隐藏小游戏：未知 id 回游戏厅（不给孩子一个空白页）
  if (head === 'arcade') {
    const arcadeId = asArcadeGameId(parts[1]);
    return arcadeId ? { name: 'arcadePlay', arcadeId } : { name: 'arcade' };
  }
  if (head === 'tasks') return { name: 'tasks' };
  if (head === 'dress') return { name: 'dress' };
  if (head === 'diary') return { name: 'diary' };
  // 家长页：长按标题 3 秒进入（孩子点不到），与孩子的主线完全分开
  if (head === 'parent') return { name: 'parent' };
  return { name: 'home' };
}
```

八条路由：

| hash | `Route.name` | 视图 | 说明 |
|---|---|---|---|
| `#/` | `home` | `HomeView` | 小屋，默认入口 |
| `#/tasks` | `tasks` | `TasksView` | 推荐 + 全部玩法 |
| `#/play/<id>` | `player` | `PlayView` | 带 `taskId`，id 必须在 `TASK_IDS` 里 |
| `#/dress` | `dress` | `DressView` | 衣服 / 小窝两个 tab |
| `#/diary` | `diary` | `DiaryView` | 竹竹的一天 + 贴纸册 + 最近七天 |
| `#/parent` | `parent` | `ParentView` | 家长页，长按 3 秒进入 |
| `#/arcade` | `arcade` | `ArcadeView` | 竹林游戏厅；未解锁回小屋 |
| `#/arcade/<id>` | `arcadePlay` | `ArcadePlayView` | 带 `arcadeId`，只认 `popstar` / `bounce` / `tetris` |

三个细节决定了这套路由能不能撑住真实使用：

- **`?query` 先切掉**。分享链接 `#/play/brush?autoplay=1` 比 `?autoplay=1#/play/brush` 干净，两种都要能跑；不切的话 `brush?autoplay=1` 会被当成一个任务 id，`asTaskId` 校验不过，直接掉回小屋——这种「分享链接打不开」的 bug 只在家长之间传链接时才暴露。
- **`asTaskId` 用 `TASK_IDS` 做白名单**：`(TASK_IDS as readonly string[]).includes(decoded)` 之后才 `as TaskId`。这行断言是整个外壳唯一允许的 id 收窄，因为 `registry` 用 `Record<TaskId, GameLoader>` 挡住漏登记，路由这边只需挡住脏输入。
- **为什么是 hash 而不是 history**：静态托管（GitHub Pages、对象存储）不需要任何 rewrite 规则；Tauri 与 Capacitor 的本地协议下 hash 一定可用；自动化测试可以直接 `page.goto('/#/play/brush')` 直达。翻案条件是「路由需要嵌套或需要参数校验之外的守卫」——现在 8 条，全部平级，仍然不值得引入路由库（两条彩蛋路由的守卫写在视图挂载时，见 17.12）。

## 5.4 三个 Pinia store

### progress：存档的唯一门面

`stores/progress.ts` 是外壳里最长的一个文件（253 行），它的三条纪律写在文件头的注释里，也真的落实在代码里：

```ts
const save = ref<SaveData>(progressManager.snapshot());
const ready = ref(false);
/** 写盘失败（配额满 / 无痕模式）：界面据此提示「这次可能没存上」 */
const unsaved = ref(false);
const initError = ref<string | null>(null);
let inflight: Promise<void> | null = null;

function init(): Promise<void> {
  inflight ??= (async () => {
    try {
      save.value = await progressManager.init();
    } catch (cause) {
      initError.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      ready.value = true;
      syncSave();
    }
  })();
  return inflight;
}
```

- **读档 single-flight**：`inflight ??=` 让并发的 `init()` 共用同一个 Promise。深链直达玩法时，`PlayView` 会先 `await progress.init()` 再挂游戏；否则「秒通关」的写入可能早于读档完成，被旧快照盖掉——这是 CHAGS 那一代留下的真实故障。
- **所有写操作走 `run()`**：成功清 `unsaved`、失败置位并只 `console.warn`，`finally` 里 `syncSave()` 把新快照同时交给界面与 `window.__bamboo.save`。写盘失败不打断当前这一局的反馈——孩子刚喂完竹竹，不该看到红色错误框。
- **快照每次都是新对象**：`progressManager.snapshot()` 返回新对象，`save.value = snapshot` 触发重渲染，调试桥也换成新对象，e2e 读到的永远是当前值。

派生数据全部是 `computed`，视图层不自己算：

| 计算属性 / 方法 | 来源 | 用途 |
|---|---|---|
| `pet` | `save.value.pet` | 五维状态、竹笋、碎片、装扮、贴纸 |
| `stage` / `nextStage` / `xpToNext` | `stageForXp` / `nextStageForXp` / `xpToNextStage` | 小屋的阶段徽章与「还差多少」 |
| `todayRecord` / `weekSummary` | `todayRecord()` / `weekSummary()`（注入 `platform.now()`） | 日记页、家长页 |
| `todaySeconds` / `restDue` | `REST_SECONDS = 20 * 60` + `restDismissed` | 20 分钟休息提醒，一天只出现一次 |
| `careAvailable` | `careAvailable(pet.careDays, action, dayKey(now))` | 摸头 / 抱抱 / 击掌每天各一次 |
| `starsFor` / `streakFor` / `hasSticker` / `completedToday` / `completedBefore` | `save.tasks` 与 `pet.stickers` | 任务卡上的星、连续天数、贴纸、今日已完成 |
| `owns` / `equippedId` / `roomId` | `findItem` + `ownsItem` / `pet.equipped` / `pet.room` | 装扮页的按钮三态 |
| `arcadeUnlocked` / `arcadeUnlimited` / `arcadePlayed` | `arcadeStatus(save, now)` | 小门出不出、是否无限畅玩、今天玩过哪几款 |
| `arcadeAvailable(id)` / `arcadeBest(id)` | `arcadeAvailable()` / `save.arcade[id].best` | 游戏厅卡片三态与最好成绩 |

`completeBefore` 这个名字值得单独说一句：玩法里用它决定要不要说「又做到啦」。`completeTask` 之前先取 `getTaskSummary(taskId)`，摘要缺失时返回 `null` 而不是抛错——内容被删掉一半的中间态不该让孩子看到崩溃页。

### settings：声音开关

```ts
/** 键与取值都固定：e2e 会直接读 localStorage 断言（'1' 静音 / '0' 有声音） */
const MUTED_KEY = 'bamboo.muted';

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false; // 隐私模式里 localStorage 可能直接抛错：读不到就按「有声音」处理
  }
}
```

`setMuted()` 做三件事：改状态、`platform.audio.setMuted(next)`、静音时立刻 `stopSpeech()`（正在念的旁白不能继续）。写 localStorage 用 `try/catch` 包住，写不进去也照样本次会话生效。键值约定成 `'1' / '0'` 是给测试用的：`e2e/parent.spec.ts` 直接断言 localStorage，不必去猜 UI 状态。

### locale：切语言是一个 await

```ts
async function set(next: Locale): Promise<void> {
  if (next === current.value) return;
  await Promise.all([ensureSummaries(next), ensureMessages(next)]);
  current.value = next;
  persistLocale(next);
  applyLocaleDocument(next);
}
```

先等两份 chunk 到位，再换 `current`——否则会出现「界面英文、任务标题中文」的半截状态。`persistLocale` 写 `bamboo.locale`，`applyLocaleDocument` 同步 `document.documentElement.lang` 与 `document.title`（屏幕阅读器靠前者判断朗读语音）。语言优先级在 `logic/locale.ts`：

1. URL 的 `?lang=`（`window.location.search` 与 hash 里的 query 都认）；
2. 上次选择（localStorage 的 `bamboo.locale`）；
3. 中文。

## 5.5 小屋：一间用 SVG 画出来的房间

首屏只有小屋。它要在不加载任何位图的前提下回答三个问题：竹竹现在怎么样、我能为它做点什么、今天玩什么。

### RoomScene：五个槽位决定一间房

`components/RoomScene.vue` 是一个 `viewBox="0 0 400 280"`、`preserveAspectRatio="xMidYMax slice"` 的 SVG，接一个 `room?: Partial<Record<RoomSlot, string>>`。五个槽位（`wallpaper` / `bed` / `shelf` / `toyCorner` / `rug`）先被折成五个布尔量：

```ts
const forestWall = computed(() => props.room.wallpaper === 'room-wall-forest');
const flowerRug = computed(() => props.room.rug === 'room-rug-flower');
const hasBed = computed(() => props.room.bed === 'room-bed-cloud');
const hasShelf = computed(() => props.room.shelf === 'room-shelf');
const hasToy = computed(() => props.room.toyCorner === 'room-toy');
```

五个槽位与装扮页的「小窝」tab 是同一套数据：目录里 7 件小窝物件分布在墙纸 / 床 / 书架 / 玩具角 / 地毯这五个槽位上，存档里 `pet.room` 只记「每个槽位现在用的是哪一件」。所以小屋背景不需要任何额外状态——换一张墙纸就是改 `pet.room.wallpaper`，返回小屋立刻生效。槽位里没有物件时对应的 `<g>` 直接不出现，房间不会出现「空框」这种中间态。

然后每个布尔量决定一组 `<g v-if>` 是否出现：竹林墙纸是四根竹子加叶子，云朵床是三个 `ellipse` 加一条毯子，玩具角是一颗球、两块积木、一只小熊（五个圆拼出来），书架是六个 `rect`，盆栽是 `path` + 两片叶子。**换一张墙纸不应该多下载一张图**——这是小窝系统能便宜地做到 7 件物件的原因，也让离线包与截图比对标定都稳定。

### PandaBuddy：同一只竹竹

`components/PandaBuddy.vue` 是 `viewBox="0 0 260 300"` 的 SVG，接三个 prop：`mood`、`stageScale`（成长阶段 0.82–1.08 的体型）、`equipped`（五个装扮槽位）。它的表情不是「哪项最低就报错」，而是只挑**最需要被照顾的那一项**给一个温柔表情：

```ts
// apps/site/src/logic/pandaLook.ts
export function moodFromStats(stats: Stats): PandaMood {
  if (stats.energy < 40) return 'sleepy';
  if (stats.fullness < 40) return 'hungry';
  if (stats.clean < 40) return 'dirty';
  if (stats.mood < 40) return 'sad';
  return 'happy';
}
```

优先级是精力 → 饱腹 → 清洁 → 心情：困了先睡，饿了先吃，脏了先洗，最后才是情绪。孩子一次只需要读懂一种情绪，四项同时低的叠加脸是没有意义的。`faceFor(mood)` 再把表情折成四个开关（`eyes` / `mouth` / `tear` / `dirt`）+ `sleepy`，模板里就是四组 `v-if`。

装扮颜色与帽子形态也由 id 前缀决定，不查目录：

```ts
export const PANDA_COLORS = {
  white: '#fbf7ef',
  black: '#3b3a37',
  ink: '#4a3b2f',
  blush: '#f2b8ae',
  gold: '#e3b85a',
  bamboo: '#7aa05c',
  eyeShine: '#ffffff',
} as const;
```

`clothingColor(id)` 按前缀挑低饱和色，`hatKind(id)` 返回 `'bamboo' | 'straw' | 'crown' | null`，三种帽子的画法完全不同（竹叶帽是两片斜椭圆，草帽是宽椭圆加帽箍，皇冠是五点 `polygon`）。这份配色与 `packages/phaser-kit` 的 `THEME` 必须一致——小屋里的竹竹和玩法里的竹竹是同一只，色差会被孩子一眼看出来。

三段 CSS 动画负责「活着」：呼吸 4.8 秒（纵向 1.028 倍）、眨眼 5.4 秒里眨两下（93.5%–96% 时 `scaleY(0.08)`）、打瞌睡的小 z 3.2 秒上下浮动 4px。`@media (prefers-reduced-motion: reduce)` 下三段全部 `animation: none`，转场也归零。

### HomeView 的一屏

| 区块 | 数据 | 关键点 |
|---|---|---|
| 小屋卡 | `RoomScene` + `PandaBuddy` + 阶段 / 竹笋 / 碎片 / 下一阶段 | 高度 `h-64 sm:h-72`，熊猫绝对定位在下沿 |
| 存档异常提示 | `unsaved \|\| initError !== null` | `role="status"`，两种文案分开 |
| 休息提醒 | `restDue` | `REST_SECONDS = 1200`，点过即 `dismissRest()` |
| 五维状态 | `STAT_KEYS` + `STAT_COLORS` | 低于 40 只加一朵 🌱，不报警不倒数 |
| 亲昵 | `CARE_ACTIONS` 三个按钮 + 喂竹笋 | 不可用时置灰并写「今天已经做过啦」 |
| 小愿望 | `statHints(pet.stats)` 取第一条 | 点一下直接进对应玩法 |
| 今日推荐 | `recommendedTasks(dayKey, slot, tasks, 2)` | 只放两个入口，避免挑花眼 |
| 竹林小门 | `progress.arcadeUnlocked` / `arcadeUnlimited` | 未解锁时 DOM 里没有；彩蛋当天显示「∞ 无限畅玩」 |
| 连点竹竹 7 次 | `onPandaTap()` + `SECRET_TAPS` / `SECRET_WINDOW_MS` | 触发竹林小路：小门直接打开、三款畅玩（17.4） |

五维状态条的颜色也不是随便挑的：

```ts
export const STAT_COLORS: Record<StatKey, string> = {
  fullness: '#e0b978',   // 麦色
  energy: '#b9b2d6',     // 薰衣草
  clean: '#9ec9d8',      // 水蓝
  mood: '#f0b7ad',       // 腮红
  health: '#a8c68a',     // 竹绿
};
```

没有一项是刺眼的警戒红。状态条本身带 `role="progressbar"`、`aria-valuenow`、`aria-valuemin/max`，读屏用户能听到数值；`aria-hidden` 只标在装饰性 emoji 上。

## 5.6 TasksView：推荐四个，全部十个

任务页是外壳里唯一「列表可能变长」的页面，所以它对数据源的要求也最高：`taskSummaries(locale)` 在切语言时会被 `ensureSummaries` 换成一份新数组，页面自然重渲染，不需要 watch、不需要手动刷新。

任务页分两段。上面 `recommendedTasks(dayKey(now), currentSlot(now), tasks, 4)` 给四张卡——推荐是确定性的（日期 + 时段做种子，第 10 章），同一天进来多少次都是同一批，孩子不会因为刷新一次就找不到刚才想做的那件事。下面按早 / 中 / 晚分组列出全部十个：

```ts
// apps/site/src/logic/taskGroups.ts
export function groupTasksBySlot(tasks: readonly TaskSummary[]): TaskSlotGroup[] {
  const groups: TaskSlotGroup[] = TIME_SLOTS.map((slot) => ({ slot, tasks: [] }));
  for (const task of tasks) {
    const slot = task.timeSlots[0] ?? 'morning';   // 只进第一个时段
    const group = groups.find((candidate) => candidate.slot === slot);
    if (group) group.tasks.push(task);
  }
  return groups.filter((group) => group.tasks.length > 0);
}
```

「只进第一个时段」是刻意的：按「包含的每个时段都列一次」，洗手会在三组里各出现一遍，孩子会以为是三个不同的玩法；卡片总数也必须仍然是十张。空组直接不渲染。

每张任务卡的所有状态都来自 store：

```ts
/** 星星只显示 0–3，空星用 ☆ —— 三颗星是成绩，一颗也是「做到啦」 */
function starText(taskId: TaskId): string {
  const stars = progress.starsFor(taskId);
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}
```

卡片上的徽章依次是：星星（`text-gold`、`tracking-widest`）、连续天数 🔥（`streakFor > 0` 才出现）、贴纸 🏅（`hasSticker`）、今日已完成 ✅（`completedToday`）。未解锁时按钮换成灰底并 `disabled`，旁边写「再长大一点就能玩啦 · 需要阶段 N」。当前十条内容的 `unlockLevel` 都是 1，这条路径暂时不会触发，但保留着——成长系统一加解锁就会用到。

`data-testid` 的分布有一条硬规矩：`task-card-<id>` / `task-stars-<id>` / `task-start-<id>` / `task-done-<id>` / `task-locked-<id>` 只出现在「全部玩法」里，推荐区用 `tasks-today-<id>`。**同一个 task id 在页面上只能有一个同名 testid**，否则 e2e 的 `getByTestId` 会变成「取第一个」，断言跟着变含糊。

## 5.7 DressView / DiaryView / ParentView

### 装扮页

两个 tab（`clothes` / `room`），目录按部位分组：衣服是帽子 / 围兜 / 衣服 / 书包 / 鞋，小窝是墙纸 / 床 / 书架 / 玩具角 / 地毯。分组函数只做一件事——把 `CLOTHING_SLOTS` 或 `ROOM_SLOTS` 映射成 `itemsForSlot(slot)`，空组过滤掉：

```ts
// apps/site/src/logic/dressGroups.ts
return CLOTHING_SLOTS.map((slot) => ({
  slot,
  title: tr(CLOTHING_SLOT_KEYS[slot]),
  items: itemsForSlot(slot),
})).filter((group) => group.items.length > 0);
```

页面顶部是「试穿预览」：`RoomScene` 打底 + 穿好装的 `PandaBuddy`，换什么立刻看得见；下面一行是余额（🎋 竹笋 / 🧩 碎片）与阶段名，孩子自己就能判断「还差多少」。按钮三态由 `actionLabel()` 决定：没拥有 → 「解锁」；拥有且正穿着 → 「脱下 / 已穿着」；拥有未穿 → 「换上」。解锁失败要说人话，`unlockMessage(reason, item)` 分三种：`level` → 「竹竹还没长大」、`noShoots` → 「竹笋不够」、`noFragments` → 「碎片不够」。结果用一个 2.6 秒的 toast 显示，`role="status"`，`onBeforeUnmount` 清定时器。

### 日记页

今天做过的事被串成「竹竹的一天」：`todayRecord.completed` 逐个 `getTaskSummary(id, locale)`，拿摘要里的 `diary` 一行一件，配一个 emoji。右上角语音按钮把今天所有日记行 `join(' ')` 后交给 `platform.audio.speak(text, locale)`，用返回的 `handle.done` 把按钮文字切回「听一听」：

```ts
function playDiary(): void {
  if (settings.muted) return;                    // 静音时不做事，而不是灰掉按钮
  const lines = todayLines.value.map((task) => task.diary);
  if (lines.length === 0) return;
  const handle = platform.audio.speak(lines.join(' '), locale.current);
  speaking.value = true;
  void handle.done.then(() => { speaking.value = false; });
}
```

为什么不把按钮 `disabled`：孩子会一直点一个看不懂原因的禁用按钮。静音时保持可按、只是不发声，是这个产品反复用到的处理方式。

贴纸册永远十格（`stickerRows(pet, taskSummaries(locale))`），得到的亮起来，没得到的是灰度剪影 + 名字写「还没得到」——孩子能看见「还有几张」。每格带 `data-owned="true|false"`，e2e 直接按属性断言，不必看图。最近七天来自 `weekSummary`，`dayKind(date, today)` 把第一列折成「今天 / 昨天 / MM/DD」。

彩蛋在日记里占一行：`todayRecord.arcade` 是今天玩过的 id 数组，经 `arcadeInfo(id)` 换成当前语言的名字，渲染成「🎮 今天还和竹竹玩了：消灭星星、弹一弹」。列表为空时整行不出现——没有彩蛋的日子，日记里没有任何痕迹。

### 家长页

`#/parent` 只回答家长最关心的四件事：

1. **安全边界**三条固定文案（不联网 / 无广告内购 / 存档只在本机）；
2. **这周完成了几件小事**：`weekCompletedCount(save, now)`，以及去重后的习惯列表——遍历 `weekSummary` 的 `completed`，取摘要里的 `habit`，用 `Set` 去重并保持首次出现顺序；
3. **声音开关**（直接调 `settings.toggle()`）与**清除本机存档**（长按 3 秒）；
4. **版本号**：`import sitePkg from '../../package.json'`，`version` 缺省 `'0.0.0'`。Vite 会把 JSON 内联进 chunk，不额外请求。

第 5 条是 10-20 加的：**今天玩了几局小游戏**（`todayRecord.arcade.length`，文案「今天和竹竹玩了 {n} 局小游戏（每款每天一次）」）。它只报数量，不带成绩与排行——家长需要知道的是「今天玩了多久、玩了什么」，不是「排第几」。

## 5.8 shell 与 logic 里的小工具

| 文件（相对 `apps/site/src/`） | 一句话 |
|---|---|
| `shell/platform.ts` | `export const platform = createWebPlatform();`——存档 / 音频 / 生命周期 / 遥测的唯一出口（7 行） |
| `shell/progress.ts` | `new ProgressManager(platform.storage, () => platform.now())`，并在启动即把空档挂到 `window.__bamboo.save` |
| `shell/useI18n.ts` | 组件取词入口：每次调用都读当前语言，模板渲染因此订阅语言状态 |
| `shell/debug.ts` | `{ events, save, lastError? }` 三字段观测窗口，`MAX_EVENTS = 600` |
| `shell/backButton.ts` | 安卓返回键桥，接口可注入，因此能单测（`arcadePlay` 先回游戏厅） |
| `shell/createArcadeContext.ts` | 小游戏的上下文：与 `createGameContext` 同一套平台出口与调试开关，但没有任务内容 |
| `logic/locale.ts` | 语言优先级、`persistLocale`、`applyLocaleDocument` |
| `logic/labels.ts` | id → 文案键映射表，`Record<联合类型, MessageKey>` 把漏一条变成编译错误 |
| `logic/pandaLook.ts` | 状态 → 表情、装扮 id → 颜色与帽子形态 |
| `logic/taskGroups.ts` / `logic/diary.ts` / `logic/dressGroups.ts` | 三个纯函数，全部可单测 |

`shell/progress.ts` 全文值得抄一遍，因为它只有十几行却承担了「启动即观测」：

```ts
export const progressManager = new ProgressManager(platform.storage, () => platform.now());

// 启动即把空档挂到 window.__bamboo.save：e2e 不需要等界面点出任何东西
initDebugBridge(platform.now());
setDebugSave(progressManager.snapshot());
```

调试桥的形状是四个文件之间约定死的：

```ts
export interface BambooDebugBridge {
  /** 事件序列：'session:start' / 'scene:enter:<scene>' / 'task:complete:<id>' … */
  events: string[];
  /** 最新存档快照（每次存档变化都换成一个**新对象**） */
  save: SaveData;
  /** 最近一次载入失败的技术详情 */
  lastError?: string;
}
```

注释里写着「不要往上面加字段（加之前先叫上 QA 一起改）」——因为 `e2e/shared.ts` 的每个断言都建立在这三个字段上。事件超过 600 条时 `shift()` 掉最旧的，长会话不会吃内存。

`shell/backButton.ts` 是「为了能单测而抽接口」的样板：

```ts
export interface BackBridge {
  addListener(event: 'backButton', callback: () => void): void;
  exitApp(): Promise<void>;
}

export function installBackButtonHandler(
  route: Ref<Route>,
  bridge: BackBridge | null = nativeApp(),
  goHome: NavigateTo = navigate,
): void {
  if (bridge === null) return;   // 浏览器里没有原生桥：直接返回，不报错
  bridge.addListener('backButton', () => {
    if (route.value.name !== 'home') { goHome('/'); return; }
    void bridge.exitApp();
  });
}
```

两个可选参数（`bridge` 与 `goHome`）让测试不必在 Node 里伪造 `window`，`backButton.test.ts` 直接注入假实现断言「在玩法页按返回 → 回小屋」「在小屋按返回 → exitApp」。以前这条路径 0 覆盖，直到真机上误按返回键把游戏关掉才发现。

`logic/labels.ts` 值得单独说一句：它把「动态拼 `'hint.' + id`」换成六张 `Record` 表（`STAT_LABEL_KEYS`、`CARE_LABELS`、`TASK_HINT_KEYS`、`SLOT_LABEL_KEYS`、`CLOTHING_SLOT_KEYS`、`ROOM_SLOT_KEYS`）。动态拼在运行时能跑，但键名写错没有 typecheck 兜底；换成 `Record<TaskId, MessageKey>` 之后，漏一条、写错一个键都是编译错误。

## 5.9 家长锁：两处长按，两种理由

家长页入口是**长按标题 3 秒**。实现只有三个函数加一个标记：

```ts
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdFired = false;

function startParentHold(): void {
  if (holdTimer !== null) return;
  holdFired = false;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    holdFired = true;
    navigate('/parent');
  }, 3000);
}

/** 长按结束后浏览器还会补一次 click：那一次不能再把小屋盖过去 */
function onTitleClick(): void {
  if (holdFired) { holdFired = false; return; }
  navigate('/');
}
```

四个 `pointer` 事件（`pointerdown` 开始、`pointerup` / `pointerleave` / `pointercancel` 取消）覆盖了手指滑出按钮与系统打断两种中止。`holdFired` 挡住长按之后紧跟的那次 `click`——不挡的话，家长刚好不容易进了家长页，又被同一次手势送回小屋。

家长页的「清除本机存档」是第二处长按，做法不同：按住时有可见进度，每 80ms 更新一次百分比，到 100% 才真的清：

```ts
const HOLD_MS = 3000;
ticker = setInterval(() => {
  const pct = Math.min(100, ((platform.now() - startedAt) / HOLD_MS) * 100);
  holdProgress.value = pct;
  if (pct >= 100) { clearInterval(ticker); void finishClear(); }
}, 80);
```

按钮上有一条必须照做的注释：

> 宽度必须固定（`min-w-64`）：文案会在「清除本机存档（长按 3 秒）」和「继续按住…」之间变化，如果按钮跟着缩，按住时指针会落到按钮外触发 `pointerleave`，长按永远到不了 3 秒。

这是真机上才会出现的 bug：桌面测试分辨率下两句文案都放得下，手机上短的那句让按钮缩了一圈，长按就在最后一秒失败。

可访问性上还有几条贯穿全站的约定：

| 约定 | 落点 |
|---|---|
| 可点高度 `min-h-12`（48px）以上，底部三入口 `min-h-14`，游戏内按钮 `min-h-14 min-w-14` | 全站按钮 |
| 每个只有图标或 emoji 的按钮都带 `aria-label` | `nav-lang` / `nav-sound` / `play-leave` / `play-sound` |
| 装饰性 emoji 一律 `aria-hidden="true"` | 全站 |
| 动态反馈用 `role="status"` | 存档提示、toast、日记贴纸说明 |
| `prefers-reduced-motion` 下停掉 DOM 动画，游戏内相机淡入由 `ctx.reducedMotion` 单独处理 | `style.css` + `BaseScene.fadeIn` |

到这一章为止，外壳的所有零件都摆出来了：怎么启动、怎么路由、状态存在哪、六个页面与两个游戏宿主各管什么。日常页面读的每一份数据都来自 `@bamboo/content`——下一章把那份内容拆开，看一份 481 字节的任务 JSON 里到底有什么。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/BambooBuddy/第04章-核心契约与游戏生命周期/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/第06章-内容数据模型与任务JSON/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

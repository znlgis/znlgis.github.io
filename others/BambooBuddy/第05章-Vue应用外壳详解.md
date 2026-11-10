---
layout: default
title: 第05章 - Vue应用外壳详解
---

# 第05章 - Vue应用外壳详解

## 5.1 外壳的边界

`apps/site` 是整个仓库里唯一的产品界面代码，也是唯一「知道 Phaser 存在、但只在少数几处提起它」的包：`registry.ts` 与 `arcade/registry.ts` 两张动态 import 表、`views/PlayView.vue` 与 `views/ArcadePlayView.vue` 两个宿主组件、`shell/createGameContext.ts` 与 `shell/createArcadeContext.ts` 里的上下文组装（后者第 4 章已拆过）。除此之外的三十来个文件——八个视图、三个 store、九个 shell 工具、八个 logic 纯函数、五个组件（两个 SVG + 三个懒加载小块）——完全不认识游戏引擎。

目录速查：

| 文件（相对 `apps/site/src/`） | 内容 | 行数 |
|---|---|---|
| `main.ts` | 启动链：调试桥 → 语言 chunk → 挂载 | 41 |
| `App.vue` | 顶栏 / 主滚动区 / 底栏，家长页长按入口 | 289 |
| `router.ts` | hash 路由，8 条 + 家长页令牌 | 136 |
| `registry.ts` / `arcade/registry.ts` | 任务 id / 小游戏 id → 动态 import | 22 / 13 |
| `arcade/catalog.ts` | 三款小游戏的展示元数据（emoji / 底色 / 文案键） | 50 |
| `views/` | Home 411 / Tasks 163 / Play 393 / Dress 222 / Diary 207 / Parent 300 / Arcade 154 / ArcadePlay 336 | — |
| `stores/` | progress 354 / settings 47 / locale 43 | — |
| `shell/` | platform、progress、debug、createGameContext、createArcadeContext、useI18n、backButton、playClock、modal | 7–93 |
| `logic/` | locale、labels、taskGroups、diary、dressGroups、pandaLook、labels-dress、parentSuggest | 22–76 |
| `components/` | PandaBuddy（SVG 熊猫）、RoomScene（SVG 小屋）、AdultGate、HomeExtras、SecretEgg | 53–312 |

三条边界不靠自觉，靠工具守住：

1. **内容边界**：`eslint.config.js` 对 `apps/site/src/**/*.{ts,vue}` 打开了 `no-restricted-imports`，直接禁掉 `@bamboo/content/full`，报错文案就是「外壳不许直接引入完整内容：用 @bamboo/content 的 loadTask()（动态 import）」。有人为了省事把十个关卡脚本同步 import 进来，lint 当场失败，首屏体积不会悄悄涨上去（第 6 章）。
2. **存档边界**：界面不拼 `SaveData`，只调 `useProgress()` 暴露的方法；真正的读写、迁移、衰减在 `packages/progress` 的 `ProgressManager` 里（第 10 章）。
3. **平台边界**：存储、音频、生命周期、遥测统一走 `shell/platform.ts` 导出的 `platform` 单例，界面与玩法都不许绕过它去碰 `localStorage` 或 `fetch`（第 9 章）。

这条边界带来的直接好处是：外壳可以原封不动地塞进 Tauri 的 WebView2 和 Capacitor 的安卓 WebView（第 15 章），因为除了 `shell/backButton.ts` 里那一次 `nativeApp()` 探测，它没有任何宿主假设。

## 5.2 启动链：41 行里的五个决定

`main.ts` 很短，但每一个 `await` 都有代价与理由：

```ts
// apps/site/src/main.ts
initDebugBridge();

const initial = initialLocale();
void (async () => {
  let locale: Locale = initial.locale;
  try {
    const messagesReady = await ensureMessages(initial.locale);
    await ensureSummaries(initial.locale);
    if (initial.locale === 'en' && !messagesReady) locale = 'zh-CN';
  } catch {
    // 加载异常不该挡住启动：回落到中文，界面照常可用
    locale = 'zh-CN';
  } finally {
    if (initial.fromUrl) persistLocale(locale);
    applyLocaleDocument(locale);
    createApp(App).use(createPinia()).mount('#app');
  }
})();
```

五个决定：

- **调试桥先于挂载**。`initDebugBridge()` 在 `createApp` 之前跑，因为 e2e 可能一打开页面就读 `window.__bamboo.save`，不等用户点任何东西；它只有事件名和存档快照，不含个人信息，生产环境同样开着。
- **英文内容补丁先就位再挂载**。`ensureMessages`（界面文案）先落地，再等 `ensureSummaries`（摘要补丁），然后才 `mount`。否则英文用户会先看到一屏中文标题再「跳」成英文；中文用户因为两个 `ensure*` 对 `zh-CN` 都直接返回已完成，一个字节都不多下载。两步之所以改成串行，是因为要拿 `ensureMessages` 的返回值判断英文是否真的生效；`ensureSummaries` 现在也返回「英文摘要是否已就位」，不用再把失败当成功。
- **英文加载失败不能假装成功**。`ensureMessages` 返回 false（英文 chunk 加载失败）或整段加载抛错时，`locale` 回落到 `zh-CN`，`<html lang>` 与 localStorage 都只记真正生效的语言——以前这里失败也算成功，于是出现「`lang="en"` + 中文界面 + 下次打开还是假英文」，没有任何入口能发现。
- **`finally` 而不是 `then`**。无论加载成功与否都要 `mount`——任何一份 chunk 加载失败（离线、资源被清）也要能把应用挂起来；补丁缺失时 `ensureSummaries` 内部会置空缓存并回落中文，界面不会白屏。白屏是比「语言没切过去」严重得多的事故。
- **`fromUrl` 才写 localStorage**。`?lang=en` 是分享链接语义：只有 URL 明确指定时才把选择记下来，免得自动化测试跑完把测试机的默认语言改掉；而且写进去的是最终生效的 `locale`，不是 URL 里那个——回落到中文时不会再存一个「en」。

`App.vue` 的 `<script setup>` 先声明懒加载视图与全屏判定，再挂家长页长按与成人门：

```ts
/** 懒加载视图统一入口：先等「只被懒加载页面用到的中文文案」就位，再加载视图本身 */
function lazyView(loader: () => Promise<{ default: Component }>): ReturnType<typeof defineAsyncComponent> {
  return defineAsyncComponent(async () => {
    const [, view] = await Promise.all([ensureSurfaceMessages(), loader()]);
    return view.default;
  });
}

// 任务页也按路由懒加载：它静态进首屏时约 1.5 KB gzip，而首屏只剩 0.6 KB 余量
const TasksView = defineAsyncComponent(() => import('./views/TasksView.vue'));
// 成人门只在长按标题 3 秒后弹出，绝大多数会话用不到
const AdultGate = lazyView(() => import('./components/AdultGate.vue'));
const PlayView = lazyView(() => import('./views/PlayView.vue'));
const ParentView = lazyView(() => import('./views/ParentView.vue'));
const DiaryView = lazyView(() => import('./views/DiaryView.vue'));
// 装扮页也是「点开才看」：它不在首屏可视区，挪出首屏预算（首屏 gzip 已贴着 60 KB 上限）
const DressView = lazyView(() => import('./views/DressView.vue'));
const ArcadeView = lazyView(() => import('./views/ArcadeView.vue'));
const ArcadePlayView = lazyView(() => import('./views/ArcadePlayView.vue'));

const isFullScreen = computed(
  () =>
    route.value.name === 'player' ||
    route.value.name === 'parent' ||
    route.value.name === 'arcadePlay',
);

// 路由切换把主滚动区拉回顶部：从滚到一半的小屋点「任务」，
// 新页面若保持旧 scrollTop，会直接停在半张卡片上
let previousRouteName = route.value.name;
watch(
  () => route.value.name + ':' + (route.value.taskId ?? ''),
  () => {
    // 离开家长页就吊销令牌：浏览器后退键再回来时没有令牌，回落小屋
    if (previousRouteName === 'parent' && route.value.name !== 'parent') {
      revokeParentUnlock();
    }
    previousRouteName = route.value.name;
    void nextTick(() => {
      mainRef.value?.scrollTo({ top: 0 });
    });
  },
);
```

- **七个视图懒加载，外加一扇成人门**：`PlayView` 与 `ArcadePlayView` 是 Phaser 的入口，必须等孩子真的点开才下载；`ParentView`、`DiaryView`、`DressView`、`ArcadeView` 懒加载则是给首屏腾体积——绝大多数会话不会先进家长页，日记一天看一次，装扮页也不在首屏可视区，游戏厅更要先解锁。日记页那一次是 2026-10-20 加彩蛋时补的：入口与触发逻辑让首屏涨到 60.0 KB，把日记页改成路由懒加载后降回去；2026-11 的审查又把装扮页也挪走——它一度把首屏推到 60.4 KB、超过 60 KB 预算。这一轮再拆三块：任务页（静态进首屏约 1.5 KB gzip，而首屏只剩 0.6 KB 余量）、彩蛋浮层 1.4 KB、小屋扩展块 1.5 KB；同时把「只被懒加载页面用到的中文文案」拆成独立的 `messages-surface` chunk（8.5 KB / 3.7 KB gzip），`lazyView()` 保证文案先于首帧，`AdultGate` 也只在长按标题后才下载。首屏因此稳定在 59.7 KB gzip / 169.8 KB 原始。
- **`isFullScreen` 同时干掉顶栏与底栏**：游戏与小游戏是全屏 Canvas，家长页是一份长文档，三者都不该有「小屋 / 任务 / 装扮」三个大按钮在旁边晃。
- **`PlayView` 的 key 是 `taskId + ':' + locale`**：切语言即重挂游戏、换任务即重建 Phaser 实例，避免出现半中半英的场景或两个 canvas 叠加。

`onMounted` 里挂的东西也值得逐条列：

| 动作 | 为什么放在挂载时 |
|---|---|
| `settings.init()` | 读回上次的静音选择并同步给 `platform.audio` |
| `void ensureSurfaceMessages()` | 小屋首帧之后预热懒加载文案：孩子点「任务」时通常已经就位，不额外等一次网络 |
| `installBackButtonHandler(route)` | 安卓实体返回键：先回小屋，再按才退出（浏览器里是空操作） |
| `progress.init()` | 一次性读 IndexedDB 存档，小屋的星星与阶段依赖它 |
| `pointerdown` 上的一次性音频解锁 | iOS / 微信要求音频由用户手势解锁，只解一次，用 `{ once: true }` |
| `platform.lifecycle.onResume()` → `progress.refresh()` | 应用可能在平板上挂了一整夜，回前台补一次跨天衰减 |

`onBeforeUnmount` 把定时器、事件监听、生命周期订阅逐一撤掉。这一层没有 `onUnmounted` 兜底——单页应用里 `App.vue` 不会卸载，写在这里是为了 HMR 时不叠监听。

## 5.3 hash 路由表：136 行，没有 vue-router

`router.ts` 的对外接口很小：`useRoute()` 返回一个 `Ref<Route>`，`navigate(path)` 改 `window.location.hash`，再加上家长页令牌的 `grantParentUnlock()` / `revokeParentUnlock()`。路由表是 `if` 串联：

```ts
// apps/site/src/router.ts
/** 畸形百分号序列（'#/play/%E0%A4%A'）会让 decodeURIComponent 抛 URIError：解不开就当没有这个 id */
function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

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
  // 家长页：长按标题 3 秒进入（孩子点不到）；没有一次性令牌（后退键 / 直接输地址）一律回小屋
  if (head === 'parent') return isParentUnlocked() ? { name: 'parent' } : { name: 'home' };
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
| `#/parent` | `parent` | `ParentView` | 家长页，长按 3 秒 + 两位数加法 + 会话内一次性令牌 |
| `#/arcade` | `arcade` | `ArcadeView` | 竹林游戏厅；未解锁回小屋 |
| `#/arcade/<id>` | `arcadePlay` | `ArcadePlayView` | 带 `arcadeId`，只认 `popstar` / `bounce` / `tetris` |

五个细节决定了这套路由能不能撑住真实使用：

- **`?query` 先切掉**。分享链接 `#/play/brush?autoplay=1` 比 `?autoplay=1#/play/brush` 干净，两种都要能跑；不切的话 `brush?autoplay=1` 会被当成一个任务 id，`asTaskId` 校验不过，直接掉回小屋——这种「分享链接打不开」的 bug 只在家长之间传链接时才暴露。
- **解 id 之前先 `safeDecode()`**：`decodeURIComponent` 遇到畸形百分号序列（`#/play/%E0%A4%A`）会抛 `URIError`，而 `hashchange` 回调里抛异常会直接中断路由更新——孩子看到的是一屏白。`safeDecode` 解不开就返回 `null`，`asTaskId` / `asArcadeGameId` 当作「没有这个 id」处理，回落小屋或游戏厅，不白屏也不崩。
- **`asTaskId` 用 `TASK_IDS` 做白名单**：`(TASK_IDS as readonly string[]).includes(decoded)` 之后才 `as TaskId`。这行断言是整个外壳唯一允许的 id 收窄，因为 `registry` 用 `Record<TaskId, GameLoader>` 挡住漏登记，路由这边只需挡住脏输入。
- **`#/parent` 要令牌，不是只要地址**：家长页的承诺是「孩子点不到」，可它本身是个可书写的 hash。`parseRoute` 解析到 parent 时校验 `PARENT_UNLOCK_KEY`（`sessionStorage`，有效期 30 分钟），没有令牌就返回小屋。令牌只在成人门答对时由 `grantParentUnlock()` 写入，且 `App.vue` 的路由 watch 在离开家长页时立刻 `revokeParentUnlock()`——后退键、直接输地址都进不去（5.9 展开）。
- **为什么是 hash 而不是 history**：静态托管（GitHub Pages、对象存储）不需要任何 rewrite 规则；Tauri 与 Capacitor 的本地协议下 hash 一定可用；自动化测试可以直接 `page.goto('/#/play/brush')` 直达。翻案条件是「路由需要嵌套或需要参数校验之外的守卫」——现在 8 条，全部平级，仍然不值得引入路由库（两条彩蛋路由的守卫写在视图挂载时，见 17.12）。

## 5.4 三个 Pinia store

### progress：存档的唯一门面

`stores/progress.ts` 是外壳里最长的一个文件（354 行），它的三条纪律写在文件头的注释里，也真的落实在代码里：

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
      // 读档失败先按空档用；但不缓存失败：manager 允许重试（超时/被占用多是瞬时的）
      inflight = null;
      initError.value = cause instanceof Error ? cause.message : String(cause);
      console.warn('[bamboo] 读档失败，先按空档用', cause);
    } finally {
      ready.value = true;
      syncSave();
    }
  })();
  return inflight;
}
```

- **读档 single-flight**：`inflight ??=` 让并发的 `init()` 共用同一个 Promise。深链直达玩法时，`PlayView` 会先 `await progress.init()` 再挂游戏；否则「秒通关」的写入可能早于读档完成，被旧快照盖掉——这是 CHAGS 那一代留下的真实故障。读档失败不再被吞成空档：`initError` 记下原因，小屋页用 `role="status"` 提示 `save.initFailed`，而 `ProgressManager` 会继续让写操作失败，原档留在 IndexedDB 里不动（未来版本的存档同样如此，不静默覆盖）。失败后 `inflight` 归零而不是缓存一个永远 reject 的 Promise——超时、被别的标签页占用这类失败多是瞬时的，切回前台或下一次操作还能重试一次。这里要分清两层：`ProgressManager.load()` 自己不 catch，`store.load()` 只要 reject 就一路抛到外壳；而 Web 平台的 IndexedDB 读取异常在平台层已经降级为空档（第 9 章 9.4），所以真正会让它 reject 的是内存 store、以及将来接 IPC / 云存档的实现。
- **所有写操作走 `run()`，且 `run()` 先 `await init()`**：成功清 `unsaved`、失败置位并只 `console.warn`，`finally` 里 `syncSave()` 把新快照同时交给界面与 `window.__bamboo.save`。先 `init()` 是因为 App 挂载时只是 `void progress.init()`，界面在 IndexedDB 读档完成前就能点；这时直接写会以 `emptySave` 为底算出新档并落盘，把真正的旧档覆盖掉——界面看不出异常，下次刷新才发现进度没了。`init()` 是 single-flight 的，已经读完时这里只是等一个已 resolve 的 Promise；manager 侧另有 `writtenBeforeLoad` 兜底：读档期间若已经发生过写入（家长清档、没等 init 就调的写方法），以内存为准，绝不拿读出来的旧快照回写。写盘失败不打断当前这一局的反馈——孩子刚喂完竹竹，不该看到红色错误框。
- **快照每次都是新对象**：`progressManager.snapshot()` 返回新对象，`save.value = snapshot` 触发重渲染，调试桥也换成新对象，e2e 读到的永远是当前值。

派生数据的时钟也换了：`todayRecord` / `weekSummary` / `restDue` / `careAvailable` 之前都在 computed 里调 `platform.now()`，而它不是响应式的——平板插着电挂一夜，第二天打开还是「晚上好」、昨天的完成勾与推荐批次。现在 store 里有一个 `useNow()`：每分钟一次 `setInterval` 加一次 `platform.lifecycle.onResume`，把 `now.value` 推一格，派生数据自己过期；`onScopeDispose` 里清掉定时器与订阅。视图里凡是要读「现在」的地方都用 `progress.now`，只有长按进度条这类必须逐帧准确的场景继续用 `platform.now()`。

派生数据全部是 `computed`，视图层不自己算：

| 计算属性 / 方法 | 来源 | 用途 |
|---|---|---|
| `pet` | `save.value.pet` | 五维状态、竹笋、碎片、装扮、贴纸 |
| `stage` / `nextStage` / `xpToNext` | `stageForXp` / `nextStageForXp` / `xpToNextStage` | 小屋的阶段徽章与「还差多少」 |
| `now` | 每分钟一次 tick + `platform.lifecycle.onResume` | 时间派生的唯一时钟源：跨天、问候语、今日推荐都靠它自己过期 |
| `todayRecord` / `weekSummary` | `todayRecord()` / `weekSummary()`（注入响应式 `now`） | 日记页、家长页 |
| `todaySeconds` / `restDue` / `restWrapDue` | `REST_SECONDS = 20 * 60`、`REST_WRAP_SECONDS = 30 * 60` + `restDismissed` / `restWrapDismissed` | 20 分钟休息提醒与 30 分钟「玩够啦」收尾卡，各自一天一次 |
| `careAvailable` | `careAvailable(pet.careDays, action, dayKey(now))` | 摸头 / 抱抱 / 击掌每天各一次 |
| `starsFor` / `streakFor` / `hasSticker` / `completedToday` / `completionsFor` / `completedBefore` | `save.tasks` 与 `pet.stickers` | 任务卡上的星、连续天数、贴纸、今日已完成、累计做到过几次 |
| `totalCompletions` / `milestones` / `nextMilestone` | `milestonesFor` / `nextMilestoneFor`（1 / 5 / 10 / 20 / 30 / 50） | 小屋与家长页的累计里程碑，跨任务、跨天 |
| `harvestToday` | `isHarvestDay(dayKey(now))`（每周六） | 丰收日提示：竹笋 ×2，确定性日历判断 |
| `birdFeeds` / `BIRD_FEED_COST` | `save.pet.birdFeeds` / `BIRD_FEED_COST = 1` | 竹笋小卖部「请小鸟」的次数与单价 |
| `owns` / `equippedId` / `roomId` | `findItem` + `ownsItem` / `pet.equipped` / `pet.room` | 装扮页的按钮三态 |
| `arcadeStatus` / `arcadeUnlocked` / `arcadeUnlimited` | `arcadeStatus(save, now)`（`dailyLimit` / `remainingPlays` / `unlimited`） | 小门出不出、是否无限畅玩、今天还剩几局 |
| `arcadeAvailable(id)` / `arcadeBest(id)` / `arcadeLevel(id)` | `arcadeAvailable()` / `save.arcade[id].best` / `arcadeLevelFor(plays)` | 游戏厅卡片的可玩性、最好成绩与 Lv.N |

`completedBefore(taskId)` 这个名字值得单独说一句：玩法里用它决定要不要说「又做到啦」（判据是 `completions > 0 || lastCompletedDay !== null`）。`completeTask(taskId, stars, mistakes)` 还多带一个失误数——manager 用它和 `tasks[].lastMistakes` 比较，算出「比上次少错几次」，完成卡只在真的少错时才夸一句。`completeTask` 之前先取 `getTaskSummary(taskId)`，摘要缺失时返回 `null` 而不是抛错——内容被删掉一半的中间态不该让孩子看到崩溃页。

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
  // 英文文案 chunk 加载失败时**不要**切过去：否则界面英文状态 + 中文文案 + 把 en
  // 写进 localStorage，下次启动仍是「假英文」，用户也没有入口能发现
  const messagesReady = await ensureMessages(next);
  await ensureSummaries(next);
  if (!messagesReady) {
    console.warn('[bamboo] 英文文案加载失败，继续使用中文');
    return;
  }
  current.value = next;
  persistLocale(next);
  applyLocaleDocument(next);
}
```

先等两份 chunk 到位，再换 `current`——否则会出现「界面英文、任务标题中文」的半截状态；`ensureMessages` 返回 `false` 时直接不切，保持中文且不写 localStorage。`persistLocale` 写 `bamboo.locale`，`applyLocaleDocument` 同步 `document.documentElement.lang` 与 `document.title`（屏幕阅读器靠前者判断朗读语音）。语言优先级在 `logic/locale.ts`：

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
| 小屋卡 | `RoomScene` + `PandaBuddy` + 阶段 / 竹笋 / 碎片 / 下一阶段 / 每日份量 | 高度 `h-64 sm:h-72`，熊猫绝对定位在下沿 |
| 每日份量 | `DAILY_TASK_TARGET = 4` + `doneToday` | 一句话说清「今天 4 件小事，已完成 n 件」 |
| 存档异常提示 | `unsaved \|\| initError !== null` | `role="status"`，两种文案分开 |
| 休息提醒 | `restDue` | `REST_SECONDS = 1200`，点过即 `dismissRest()` |
| 30 分钟收尾卡 | `restWrapDue` | 「玩够啦」一张卡，当天一次，不锁功能也不惩罚 |
| 五维状态 | `STAT_KEYS` + `STAT_COLORS` | 低于 40 只加一朵 🌱，不报警不倒数 |
| 亲昵 | `CARE_ACTIONS` 三个按钮 + 喂竹笋 | 不可用时置灰并写「今天已经做过啦」 |
| 小愿望 | `statHints(pet.stats)` 取第一条 | 点一下直接进对应玩法 |
| 今日推荐 | `recommendedTasks(dayKey, slot, tasks, 2)` | 只放两个入口，避免挑花眼 |
| 里程碑 / 丰收日 / 请小鸟 | `HomeExtras`（懒加载，1.5 KB / 0.8 KB gzip） | 只给动画与计数：请小鸟花 1 根竹笋，不给任何数值增益 |
| 竹林小门 | `progress.arcadeUnlocked` / `arcadeUnlimited` | 未解锁时 DOM 里没有；彩蛋当天显示「∞ 无限畅玩」 |
| 连点竹竹 7 次 | `onPandaTap()` + `SECRET_TAPS` / `SECRET_WINDOW_MS` | 触发竹林小路：小门直接打开、三款畅玩（17.4） |

彩蛋浮层（`components/SecretEgg.vue`）是一次真正的模态：`role="dialog"` + `aria-modal` + `aria-labelledby`，打开时由 `shell/modal.ts` 的 `useModal` 把焦点交给主按钮，`Escape` 能关、关掉后焦点回到竹竹身上；它本身是从首屏拆出来的懒加载组件（1.4 KB / 0.7 KB gzip），绝大多数会话根本不会下载。竹竹本身也从 `div` 换成了 `button`——键盘与读屏也能「摸摸头」，连点 7 次的彩蛋照旧。

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

页面顶部先给一句「今日份量」：`DAILY_TASK_TARGET = 4` 加上 `doneToday`（今天完成了几件不同的小事），让孩子知道今天大概做几件就够了，而不是把十张卡都当成待办。任务页分两段。上面 `recommendedTasks(dayKey(now), currentSlot(now), tasks, 4)` 给四张卡——推荐是确定性的（日期 + 时段做种子，第 10 章），同一天进来多少次都是同一批，孩子不会因为刷新一次就找不到刚才想做的那件事。下面按早 / 中 / 晚分组列出全部十个：

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

卡片上的徽章依次是：星星（`text-gold`、`tracking-widest`）、累计完成次数（`completionsFor > 0` 才出现）、连续天数 🔥（`streakFor > 0` 才出现）、贴纸 🏅（`hasSticker`）、今日已完成 ✅（`completedToday`）。已完成过的任务，按钮文案从「开始」换成「再玩一次」——勾选态与累计次数让孩子看见「我做到过几次」，而不是只有一次性的星星。未解锁时按钮换成灰底并 `disabled`，旁边写「再长大一点就能玩啦 · 需要阶段 N」。当前十条内容的 `unlockLevel` 都是 1，这条路径暂时不会触发，但保留着——成长系统一加解锁就会用到。

`data-testid` 的分布有一条硬规矩：`task-card-<id>` / `task-stars-<id>` / `task-completions-<id>` / `task-start-<id>` / `task-done-<id>` / `task-locked-<id>` 只出现在「全部玩法」里，推荐区用 `tasks-today-<id>`，页首份量用 `tasks-daily-limit`。**同一个 task id 在页面上只能有一个同名 testid**，否则 e2e 的 `getByTestId` 会变成「取第一个」，断言跟着变含糊。

## 5.7 DressView / DiaryView / ParentView

### 装扮页

两个 tab（`clothes` / `room`），目录按部位分组：衣服是帽子 / 围兜 / 衣服 / 书包 / 鞋，小窝是墙纸 / 床 / 书架 / 玩具角 / 地毯。分组函数只做一件事——把 `CLOTHING_SLOTS` 或 `ROOM_SLOTS` 映射成 `itemsForSlot(slot)`，空组过滤掉。槽位名映射单独放在 `logic/labels-dress.ts`（24 行）：装扮页是路由懒加载的，这张表只该跟装扮 chunk 一起下载，不该占小屋首屏的 60 KB 预算；两个 tab 也补了 `role="tablist"` / `role="tab"` / `aria-selected` / `role="tabpanel"`，读屏能听出「两个标签页里的哪一个、当前选中哪个」：

```ts
// apps/site/src/logic/dressGroups.ts
return CLOTHING_SLOTS.map((slot) => ({
  slot,
  title: tr(CLOTHING_SLOT_KEYS[slot]),
  items: itemsForSlot(slot),
})).filter((group) => group.items.length > 0);
```

页面顶部是「试穿预览」：`RoomScene` 打底 + 穿好装的 `PandaBuddy`，换什么立刻看得见；下面一行是余额（🎋 竹笋 / 🧩 碎片）与阶段名，孩子自己就能判断「还差多少」。按钮三态由 `actionLabel()` 决定：没拥有 → 「解锁」；拥有且正穿着 → 「脱下 / 已穿着」；拥有未穿 → 「换上」。解锁失败要说人话，`unlockMessage(reason, item)` 分四种：`owned` → 「已经是你的啦」（连点的第二次会走到这里）、`level` → 「竹竹还没长大」、`noShoots` → 「竹笋不够」、`noFragments` → 「碎片不够」。结果用一个 2.6 秒的 toast 显示，`role="status"`，`onBeforeUnmount` 清定时器；同一次解锁用 `pendingIds` 挡住连点。

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

`#/parent` 回答家长最关心的几件事：

1. **安全边界四条固定文案**（不联网 / 无广告内购 / 存档只在本机 / 适龄标注「4–8 岁」），下面一段 `<details>` 是零收集隐私说明：收什么、不收什么、怎么清；
2. **今天的份量与屏幕时间**：`todayMinutes` / `weekMinutes`（`todaySeconds` 与 `weekSummary` 的秒数除以 60）、`todayDone`（今天完成了几件不同的小事）、`progress.totalCompletions`（累计里程碑口径，只增不减，不展示「连续 / 断签」）；
3. **这周完成了几件小事**：`weekCompletedCount(save, now)`，以及去重后的习惯列表——遍历 `weekSummary` 的 `completed`，取摘要里的 `habit`，用 `Set` 去重并保持首次出现顺序；今天玩过隐藏小游戏时再补一行局数（`todayRecord.arcadePlays`），只报数量，不带成绩与排行；
4. **今天可以一起做的一件事**：`logic/parentSuggest.ts` 的 `suggestForToday()` 从今天玩过的任务反推一句现实里的亲子动作，10 条双语、纯函数、无随机；没玩过时回落 `parent.suggest.none`，卡片不消失；
5. **声音开关**（直接调 `settings.toggle()`，带 `aria-pressed`）与**清除本机存档**。清档是破坏性操作，现在要先过与进家长页同一道成人门，再长按 3 秒：长按到 100% 之后要检查 `progress.unsaved`——写盘失败不能显示「已清除」，否则刷新后旧档又回来，失败时用 `role="alert"` 显示 `save.unsaved`；「离开按钮」改用坐标判断（容差 24px），因为触屏上 `pointerleave` 受指针隐式捕获影响并不可靠，按住时滑出去也会把档清掉；
6. **版本号**：`import sitePkg from '../../package.json'`，`version` 缺省 `'0.0.0'`。Vite 会把 JSON 内联进 chunk，不额外请求。

## 5.8 shell 与 logic 里的小工具

| 文件（相对 `apps/site/src/`） | 一句话 |
|---|---|
| `shell/platform.ts` | `export const platform = createWebPlatform();`——存档 / 音频 / 生命周期 / 遥测的唯一出口（8 行） |
| `shell/progress.ts` | `new ProgressManager(platform.storage, () => platform.now())`，并在启动即把空档挂到 `window.__bamboo.save` |
| `shell/useI18n.ts` | 组件取词入口：每次调用都读当前语言，模板渲染因此订阅语言状态 |
| `shell/debug.ts` | `{ events, save, lastError? }` 三字段观测窗口，`MAX_EVENTS = 600` |
| `shell/backButton.ts` | 安卓返回键桥，接口可注入，因此能单测（`arcadePlay` 先回游戏厅） |
| `shell/createGameContext.ts` | 任务上下文：读档、`loadTask()` 选套（第六个参数是 `variantIndex`）、平台出口与调试开关（93 行） |
| `shell/createArcadeContext.ts` | 小游戏的上下文：与 `createGameContext` 同一套平台出口与调试开关，但没有任务内容 |
| `shell/playClock.ts` | 玩耍计时：30 秒采样、5 分钟合并落盘、只在前台计时 |
| `shell/modal.ts` | `useModal(root, close)`：焦点移入、Esc 关闭、关闭后焦点还原（47 行） |
| `logic/locale.ts` | 语言优先级、`persistLocale`、`applyLocaleDocument` |
| `logic/labels.ts` | 首屏用的 id → 文案键映射表，`Record<联合类型, MessageKey>` 把漏一条变成编译错误 |
| `logic/labels-dress.ts` | 装扮槽位名映射，只跟懒加载的装扮页一起下载 |
| `logic/parentSuggest.ts` | 今天玩过的任务 → 一句亲子建议（10 条双语、无随机） |
| `logic/pandaLook.ts` | 状态 → 表情、装扮 id → 颜色与帽子形态 |
| `logic/taskGroups.ts` / `logic/diary.ts` / `logic/dressGroups.ts` | 三个纯函数，全部可单测 |

`shell/playClock.ts` 是这次审查新加的（66 行）。玩耍时长原来由 `PlayView` 每 30 秒 `progress.addSeconds(30)` 直接落一次 IndexedDB，20 分钟就是 40 次整档序列化与写入。现在秒数先累加在内存里，每 5 分钟合并落一次盘，切后台与卸载时再各补一次；tick 只在 `document.visibilityState !== 'hidden'` 时累加，后台标签页被节流的时间不算游戏时间。写档失败时这批秒数会放回去，等下一次 flush 再补。

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

`logic/labels.ts` 值得单独说一句：它把「动态拼 `'hint.' + id`」换成四张 `Record` 键表（`STAT_LABEL_KEYS`、`CARE_LABELS`、`TASK_HINT_KEYS`、`SLOT_LABEL_KEYS`），两份装扮槽位表则拆到 `logic/labels-dress.ts`。动态拼在运行时能跑，但键名写错没有 typecheck 兜底；换成 `Record<TaskId, MessageKey>` 之后，漏一条、写错一个键都是编译错误。两张装扮表分出去是同一个体积纪律的另一面：首屏用的表和懒加载页用的表不该绑在一起下载。

## 5.9 家长锁：两处成人门，一次长按

家长页入口是**长按标题 3 秒**，但长按只负责「叫出题目」：真正的门是一道两位数加法，答对才发令牌、跳转。实现只有四个函数加一个标记：

```ts
let holdTimer: ReturnType<typeof setTimeout> | null = null;
/** 长按真正生效的时刻：只用来吃掉紧随其后的那一次 click */
let holdFiredAt = 0;
/** 长按后浏览器补的 click 通常在同一帧/下一帧内；给足余量但别吃掉下一次正常点击 */
const HOLD_CLICK_WINDOW_MS = 800;

function randomGateQuestion(): string {
  // 两位数加法：4–8 岁孩子普遍算不出来，成年人不费力；不依赖任何资源
  const a = 12 + Math.floor(Math.random() * 78);
  const b = 11 + Math.floor(Math.random() * 78);
  gateAnswer.value = a + b;
  return a + ' + ' + b + ' = ?';
}

function startParentHold(): void {
  if (holdTimer !== null || gateOpen.value) return;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    holdFiredAt = platform.now();
    gateQuestion.value = randomGateQuestion();
    gateOpen.value = true;   // 只开题，不发令牌
  }, 3000);
}

function onGatePass(): void {
  gateOpen.value = false;
  // 家长页要一次性令牌：没有它，#/parent 直接输地址或浏览器后退都进不去
  grantParentUnlock(platform.now());
  navigate('/parent');
}

/** 长按结束后浏览器还会补一次 click：那一次不能再把小屋盖过去 */
function onTitleClick(): void {
  if (holdFiredAt !== 0 && platform.now() - holdFiredAt < HOLD_CLICK_WINDOW_MS) {
    holdFiredAt = 0;
    return;
  }
  holdFiredAt = 0;
  navigate('/');
}
```

四个 `pointer` 事件（`pointerdown` 开始、`pointerup` / `pointerleave` / `pointercancel` 取消）覆盖了手指滑出按钮与系统打断两种中止；键盘侧 `keydown.enter` 开始、`keyup` 取消——按住 Enter 3 秒同样能开题，但只按一下会立刻取消，不会凭空弹出成人门。`holdFiredAt` 加一个 800ms 窗口挡住长按之后紧跟的那次 `click`——不挡的话，家长刚答完题进了家长页，又被同一次手势送回小屋；用时间戳而不是布尔标记，是因为布尔标记一旦漏掉一次 `click` 就会污染下一次正常点击。

成人门是独立组件 `components/AdultGate.vue`（116 行）：题目是 `a + b`（`a` 取 12–89、`b` 取 11–88），输入框 `type="text"` + `inputmode="numeric"`，Enter 或「确定」提交；连错 3 次（`MAX_TRIES = 3`）锁 30 秒（`LOCK_MS = 30_000`），锁住期间输入框与按钮都禁用并显示剩余秒数。它是模态，`useModal` 负责焦点移入、Esc 取消与关闭后焦点还原。家里两处入口共用同一个组件：`App.vue` 在长按标题后弹它，`ParentView.vue` 在长按清档前弹它。

长按与答题只是入口的一半。家长页那一屏有「清除本机存档」，而 `#/parent` 本身是个可书写的 hash：答题进来之后按浏览器后退、或者直接把地址发给别人，都能回到这一页。所以进入家长页还需要一个**一次性的会话令牌**：`PARENT_UNLOCK_KEY = 'bamboo.parentUnlock'` 存在 `sessionStorage`，有效期 30 分钟，`parseRoute` 解析到 parent 时校验它；`App.vue` 的路由 watch 在「离开家长页」时立刻 `revokeParentUnlock()`，后退键再回来时令牌已吊销，回落小屋。令牌只存时间戳，不含任何用户信息，关掉标签页自然失效。

家长页的「清除本机存档」是第二处成人门，流程比入口多一步：按下按钮先弹同一道两位数加法，答对后才进入长按；按住时有可见进度，每 80ms 更新一次百分比，到 100% 才真的清：

```ts
const HOLD_MS = 3000;
ticker = setInterval(() => {
  const pct = Math.min(100, ((platform.now() - startedAt) / HOLD_MS) * 100);
  holdProgress.value = pct;
  if (pct >= 100) { clearInterval(ticker); ticker = null; void finishClear(); }
}, 80);
```

按钮上有一条必须照做的注释：

> 宽度必须固定（`min-w-64`）：文案会在「清除本机存档（长按 3 秒）」和「继续按住…」之间变化，如果按钮跟着缩，按住时指针会落到按钮外触发 `pointerleave`，长按永远到不了 3 秒。

这是真机上才会出现的 bug：桌面测试分辨率下两句文案都放得下，手机上短的那句让按钮缩了一圈，长按就在最后一秒失败。清档失败时按钮不变成「已清除」，页面用 `role="alert"` 明说「这次没存上」，家长才知道要再来一次。

可访问性上还有几条贯穿全站的约定：

| 约定 | 落点 |
|---|---|
| 可点高度 `min-h-12`（48px）以上，底部三入口 `min-h-14`，游戏内按钮 `min-h-14 min-w-14` | 全站按钮 |
| 每个只有图标或 emoji 的按钮都带 `aria-label` | `nav-lang` / `nav-sound` / `play-leave` / `play-sound` |
| 装饰性 emoji 一律 `aria-hidden="true"` | 全站 |
| 动态反馈用 `role="status"`，阻断性提示用 `role="alert"` | 存档提示、toast、日记贴纸说明、家长页清档失败 |
| 模态浮层 `role="dialog"` + `aria-modal` + Esc 关闭，关闭后焦点还原 | 统一走 `shell/modal.ts` 的 `useModal`：小屋彩蛋、成人门、玩法退出 / 小门 / 错误三个浮层、小游戏宿主的退出与错误浮层 |
| tab 语义 `role="tablist"` / `role="tab"` / `aria-selected` / `role="tabpanel"` | 装扮页衣服 / 小窝两个 tab |
| 只有图标的状态按钮补 `aria-pressed` | 顶栏静音按钮（`nav-sound`）、玩法页静音按钮、日记朗读按钮 |
| `prefers-reduced-motion` 下停掉 DOM 动画，游戏内相机淡入由 `ctx.reducedMotion` 单独处理 | `style.css` + `BaseScene.fadeIn` |

到这一章为止，外壳的所有零件都摆出来了：怎么启动、怎么路由、状态存在哪、八个视图与两个游戏宿主各管什么。日常页面读的每一份数据都来自 `@bamboo/content`——下一章把那份内容拆开，看一份 509 字节的任务 JSON 里到底有什么。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/others/BambooBuddy/第04章-核心契约与游戏生命周期/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/第06章-内容数据模型与任务JSON/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

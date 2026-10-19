---
layout: default
title: 第08章 - Phaser渲染工具箱
---

# 第08章 - Phaser渲染工具箱

## 8.1 为什么是 Phaser，又为什么要裁剪

十个玩法都跑在 Phaser 4.2.1 上。选它的理由不复杂：场景生命周期、补间、输入系统、缩放策略这四件事如果自己写，第一个玩法就要多出两三百行，而且每一件都比想象中难做对（尤其是「手指离开元素之后还继续跟随」和「画布随窗口变化重算坐标」）。`packages/phaser-kit` 把这些能力包成一套面向本项目的工具箱，游戏包只依赖它，不直接写 Phaser 的底层调用。

但完整版 Phaser 打出来是一个大得离谱的 chunk：`vendor-phaser` 命令行输出 1341.9 KiB 原始 / 347.3 KiB gzip。而本项目实际用到的只有：

- `Scene` / `Scenes` / `Game` / `Scale` / `Cameras`
- `GameObjects` 里的 `Container` / `Graphics` / `Text` / `Zone` / `Rectangle`
- `Input` / `Tweens` / `Time` / `Math` / `Geom` / `Structs` / `Utils` / `Display` / `Events`

physics、tilemaps、sound、animations、particles、loader(image)、shader、mesh、renderTexture 这些系统一个都没用到——声音由自研的 WebAudio 层负责（第 9 章），所有美术都是 `Graphics` 画出来的，没有一个位图要加载。于是 `scripts/build-phaser-trim.mjs` 把 Phaser 按这份清单重新打包，结果约 859.7 KiB 原始 / 221.4 KiB gzip，**gzip 减少 36%**；本次构建产物里那份 `apps/site/dist/assets/vendor-phaser-zPpKQHLK.js` 是 876,874 字节，`.version` 里记录的 gzip 是 227,189 字节。

这笔账值得算，是因为十个玩法共用同一份 Phaser：首屏虽然不加载它（点开一个玩法才下载），但孩子每换一个玩法、每次清缓存回来都要重新下。少 36% 对移动网络与安卓 WebView 是实打实的差别。

本次构建的 41 个文件把这条边界显示得很清楚：首屏只有 `index-<hash>.js` 149,841 字节 + `index-<hash>.css` 20,592 字节（gzip 合计 56.8 KB，与 `check-size.mjs` 的口径一致）；`common-<hash>.js` 111,340 字节是进玩法前才拉起的共享 chunk；十个玩法的入口 chunk 在 342–8,189 字节之间（刷牙 / 洗手 / 洗澡只有 342–344 字节，场景代码在共享的 `scrub-<hash>.js` 里）；`vendor-phaser-<hash>.js` 876,874 字节（gzip 227,189）只在 `PlayView` 被拉起的那一刻才进入下载队列。也就是说，**一个不玩任何任务的孩子，永远不会为游戏引擎付流量。**

## 8.2 裁剪的原理、清单与风险

裁剪不是删代码，是「换一个入口重新打包」。`packages/phaser-kit/vendor-src/entry.cjs` 按 Phaser 的内部模块路径逐个 `require`，`packages/phaser-kit/vendor-src/gameobjects-trim.cjs` 把 `GameObjects` 收窄到实际用到的五类，然后由 webpack 5 打成一个 ESM bundle：

```js
// scripts/build-phaser-trim.mjs（webpack 配置节选）
plugins: [
  new webpack.DefinePlugin({
    // 与 Phaser 自带 config/webpack.dist.config.js 同一套开关语义（typeof X 必须被替换成布尔值）
    'typeof CANVAS_RENDERER': JSON.stringify(true),
    'typeof WEBGL_RENDERER': JSON.stringify(true),
    'typeof WEBGL_DEBUG': JSON.stringify(false),
    'typeof FEATURE_SOUND': JSON.stringify(false),
    'typeof EXPERIMENTAL': JSON.stringify(false),
  }),
],
optimization: { minimize: true, splitChunks: false, runtimeChunk: false },
```

五个开关里 `FEATURE_SOUND = false` 是最划算的一个——它让 `entry.cjs` 里这一段被静态消除：

```js
// packages/phaser-kit/vendor-src/entry.cjs
// FEATURE_SOUND=false 由构建脚本的 DefinePlugin 注入：这一支会被静态消除，声音系统不参与打包。
if (typeof FEATURE_SOUND) {
  Phaser.Sound = require('phaser-src/sound');
}
```

注意注释里的警告：**直接用 esbuild/vite 打包这个文件会得到错误结果**。未定义时 `typeof FEATURE_SOUND` 是 `'undefined'`，字符串为真，声音系统会悄悄回来，体积白涨。所以裁剪版必须由这个脚本生成，不能顺手改 `apps/site/vite.config.ts` 去打包 `vendor-src`。

脚本的其余部分都在处理「这件事很容易做错，所以要能自证」：

| 机制 | 作用 |
|---|---|
| `RECIPE = 'b-tier-v1'` | 配方版本；改 DefinePlugin 开关或 webpack 关键选项时 +1，强制重建 |
| `entryHash` | `sha256(RECIPE + phaser 版本 + entry.cjs + gameobjects-trim.cjs)` 的前 16 位 |
| `.version` | 记录 phaser 版本 / 配方 / 指纹 / 产物大小与 gzip，命中即跳过重建 |
| 体积防呆 | gzip 不在 180–260 KiB 之间直接抛错，并提示「完整 Phaser 约 347 KiB gzip」 |
| 产物横幅 | 标明「由脚本生成，请勿手改」与 MIT 许可位置 |
| 许可抽取 | 把 webpack/terser 抽出的 `LICENSE.txt` 一起复制；缺失时警告「发布前确认一次」 |

风险都在明面上，`packages/phaser-kit/vendor/README.md` 写成一节：

> ⚠️ 与 entry.cjs 一样：这是 Phaser 内部路径，不是公开 API，升级 phaser 需复核 + 重跑 `pnpm phaser:trim`。
> 合并前跑全量 `pnpm e2e`——裁剪掉的对象如果在某个游戏里被用到，只会在运行时炸，TS 类型查不出来。

「TS 类型查不出来」这句是关键：`import Phaser from 'phaser'` 的类型永远指向完整包，所以裁剪清单里少一个对象，类型检查仍然是绿的，只有真的跑到那一行才会 `undefined is not a function`。这就是为什么重建后的验收流程被写死成三步：`pnpm build && pnpm size`，加上全量 `pnpm e2e`。回退方案也留好了：删掉 `apps/site/vite.config.ts` 里的 alias，或临时用 `PHASER_FULL=1` 走完整包。

alias 本身只有一行：

```ts
const phaserTrim = fileURLToPath(
  new URL('../../packages/phaser-kit/vendor/phaser-trim.esm.js', import.meta.url),
);

resolve: { alias: [{ find: /^phaser$/, replacement: phaserTrim }] },
```

用 `/^phaser$/` 精确匹配，是因为仓库里还有 `phaser-kit/vendor-src` 这类路径不该被替换；类型仍然解析到 `node_modules/phaser`，所以 `vue-tsc` 完全不受影响。

## 8.3 主题与调色板

`packages/phaser-kit/src/theme.ts` 是一个纯常量文件（69 行），它把「颜色」这件事从每个模板里抽出来。数值版给 `Graphics` 用，字符串版给 `Text` 与样式用：

```ts
export const THEME = {
  outline: 0x4a3b2f,      // 描边用深棕而不是纯黑
  ink: 0x4a3b2f,
  inkSoft: 0x7b6a5a,
  paper: 0xfaf3e7,
  card: 0xfffdf8,
  bamboo: 0x7aa05c,
  bambooDeep: 0x55793f,
  bambooLight: 0xa8c68a,
  cream: 0xf7ead6,
  wood: 0xd3a97c,
  woodDeep: 0xa97e50,
  blush: 0xf2b8ae,
  pink: 0xe8a79e,
  sky: 0xdfeff0,
  water: 0x9fd0d6,
  waterDeep: 0x6fb2ba,
  sun: 0xf5cf7a,
  gold: 0xf2c14e,
  goldDeep: 0xb9822a,
  warmRed: 0xe07a6a,
  warmRedDeep: 0xb9523f,
  mint: 0xcfe6d4,
  lavender: 0xd9d2ea,
  white: 0xffffff,
  pandaWhite: 0xfbf7ef,
  pandaBlack: 0x3b3a37,
  grey: 0xb8b2a8,
  shadow: 0x4a3b2f,
} as const;
```

两条约定值得记住：**描边用 0x4a3b2f 而不是 0x000000**（注释：「圆润卡通的关键是柔和的边，不是漫画的墨线」），**每一组强调色都有 Deep / Light 变体**（`bamboo`/`bambooDeep`/`bambooLight`、`gold`/`goldDeep`、`warmRed`/`warmRedDeep`），因为按钮厚底、阴影、暗面都要在同色系里取第二、第三个值。

字体栈有一条容易忽略的理由：

```ts
/* 拉丁字体在前：英文的弯引号（’）在 CJK 字体里是全身宽，看起来像多了一个空格；
   中文字形这些拉丁字体没有，会自动回落到后面的中文字体，所以中英都不受影响。 */
export const FONT_STACK =
  '"Segoe UI","Helvetica Neue",Arial,"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';

export function textStyle(size: number, color: string = CSS.ink, bold = false) {
  return { fontFamily: FONT_STACK, fontSize: size + 'px', color, fontStyle: bold ? 'bold' : 'normal' };
}
```

这是一条只有双语产品才会遇到的坑：英文文案里 `don’t` 的弯引号如果交给中文字体渲染，宽度会变成全角，看起来像 `don’ t`。把拉丁字体放在最前面，中文字符再回落到后面的中文字体，两边都正常。

`textStyle(size, color, bold)` 是唯一的文字样式入口，所有 `this.add.text(...)` 都经过它，所以「换字体、改默认色」是一次改动。模板里再叠 `wordWrap` 与 `lineSpacing` 处理长句——英文文案普遍比中文长 30% 以上，换行策略必须显式给宽，否则 `Next: Turn off light` 这类短句会溢出药丸卡。

## 8.4 卡通绘制原语

`packages/phaser-kit/src/cartoon.ts`（316 行）是整套美术的地基，一共十来个小函数，全部只依赖 `Graphics`：

| 函数 | 作用 |
|---|---|
| `roundRect(g, x, y, w, h, radius, fill, outline, outlineWidth, alpha)` | 圆角矩形，「有底有边」的默认值 `OUTLINE_WIDTH = 6` |
| `circle` / `ellipse` | 带默认描边的圆与椭圆 |
| `groundShadow(g, cx, cy, w, h, alpha = 0.14)` | 物体底下的柔和阴影，圆润卡通的「落地感」 |
| `wavyBand(g, x, y, w, h, color, alpha, amplitude, waves, segments)` | 用折线逼近的波浪（水面、被子边缘），不依赖曲线 API |
| `shade(color, factor)` | 颜色加深 / 变浅，做按钮厚底与亮暗面 |
| `squash(scene, target, base, strength)` | 挤压回弹，给拖放「有重量」的手感 |
| `popIn(scene, target, delay)` | `alpha 0 → 1` 的 240ms 出场 |
| `sparkleAt(scene, x, y, color, count)` | 星光扩散，替代「答对了」这类文字 |
| `tapRipple(scene, x, y, radius, color)` | 「点这里」的扩散涟漪，替代提示文字 |
| `drawHand` / `createHand` | 卡通小手（会上下浮动），表示「可以拖我 / 点这里」 |
| `starPath` / `heartPath` / `cloud` | 五角星、爱心、云朵 |

两个函数的实现细节决定了整个视觉风格：

```ts
export function roundRect(g, x, y, w, h, radius, fill, outline = THEME.outline, outlineWidth = OUTLINE_WIDTH, alpha = 1): void {
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (outline !== null && outlineWidth > 0) {
    g.lineStyle(outlineWidth, outline, 1);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
}

/** 颜色加深/变浅：做按钮厚底与物体亮暗面 */
export function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}
```

「先填充再描边」是固定顺序，而且描边永远在内侧对齐——`fillRoundedRect` 与 `strokeRoundedRect` 用同一个矩形，视觉上就是一圈等宽的边。`shade` 用乘法而不是加法，所以 `shade(THEME.warmRed, 0.72)` 得到的是一个更暗的同色相，任意颜色都能安全地做「厚底」而不需要为每个颜色准备第二个常量。

三个动效函数构成一套反馈层次：`popIn` 用于「东西出现了」（按钮、道具、完成卡），`sparkleAt` 用于「你做对了」（清掉一个点、放对一个玩具、答对一题），`tapRipple` 与 `createHand` 用于「还不知道该点什么」（开局的小手、卡住时的涟漪）。三条线分别对应「出现 / 成功 / 引导」，都不需要孩子读一个字的提示。

`sparkleAt` 与 `tapRipple` 是两条「不用文字也能反馈」的路子：前者在答对时炸出一圈星星（8 个，延迟 `i * 36ms`，560ms 内扩散到 120px 并淡出），后者在需要引导时画两圈不断扩散的涟漪。4–8 岁的孩子不一定会读提示文字，但一定看得懂星光与涟漪。

## 8.5 竹竹与道具：零位图

`packages/phaser-kit/src/panda.ts` 与 `packages/phaser-kit/src/props.ts` 是两个大文件（13 KB / 25 KB），它们把「所有会出现在屏幕上的东西」都画成了几何图形。竹竹的入口是：

```ts
/**
 * 竹竹本体：圆脸、短手短脚、背小书包、围兜可换。
 * 原点取身体中心，正上方是头 —— 模板按「脚踩地面」的位置换算即可。
 */
export function drawPanda(g, x, y, s = 1, opts: PandaOptions = {}): void
```

`PandaOptions` 有三个开关：`mood`（九种：happy / neutral / sleepy / hungry / dirty / fresh / sad / angry / excited）、`accessories`（五个槽位）、`blush` / `wave` / `hearts`（打脸、举手挥、头顶冒爱心）。`mood` 只影响眉眼与嘴：困了是两道弯线，饿了是张嘴 + 红舌，生气了是横线嘴 + 眼球偏移，难过了下垂嘴 + 一滴眼泪，`excited` 额外多一张咧开的红嘴。

配件颜色按 id 前缀取，这一步是刻意的：

```ts
/** 与 @bamboo/progress 的装扮 id 对齐；颜色表在这里，是为了渲染层不依赖存档层 */
function accessoryColor(id: string | undefined, fallback: number): number {
  if (!id) return fallback;
  if (id.startsWith('hat-bamboo') || id.startsWith('bib-bamboo') || id.startsWith('backpack-leaf')) return THEME.bamboo;
  if (id.startsWith('hat-straw')) return THEME.sun;
  if (id.startsWith('hat-crown')) return THEME.gold;
  if (id.startsWith('bib-star')) return THEME.sun;
  if (id.startsWith('bib-flower')) return THEME.pink;
  if (id.startsWith('outfit-pjs')) return THEME.lavender;
  if (id.startsWith('outfit-rain')) return THEME.gold;
  if (id.startsWith('backpack-red') || id.startsWith('shoes-red')) return THEME.warmRed;
  if (id.startsWith('shoes-green')) return THEME.bamboo;
  return fallback;
}
```

渲染层不 import 存档层（`@bamboo/progress`），否则「装扮目录 + 解锁规则 + 迁移逻辑」会跟着进每一个游戏 chunk。代价是颜色表要跟装扮目录的 id 对齐——这份对齐由 `apps/site/src/logic/pandaLook.ts` 在小屋那侧再写一遍（同样的前缀规则），两处都改才算改完。

`packages/phaser-kit/src/props.ts` 的 30 多个函数分三类：

| 类别 | 函数 | 说明 |
|---|---|---|
| 房间背景 | `drawRoom(g, theme, w, h)` | 八种主题：墙面色 / 地板色 / 墙裙 / 瓷砖 / 窗 / 月亮与星星 / 书架 / 黑板 / 衣柜 / 竹子 |
| 家具与器物 | `drawWindow` / `drawRug` / `drawShelf` / `drawBed` / `drawTable` / `drawPlate` / `drawSink` / `drawTub` / `drawLamp` / `drawCurtain` / `drawBlanket` / `drawBambooStalk` / `drawMoon` / `drawCloudPill` | 每个都是几行到几十行 `Graphics` 调用 |
| 玩法道具 | `drawFood`（六类）/ `drawClothing`（五类）/ `drawToy`（四类）/ `drawBin` / `drawOrderIcon`（七种）/ `drawEmotionFace`（五种）/ `drawShape`（五种）/ `drawToothbrush` / `drawSponge` / `drawTowel` / `drawBubbles` / `drawWaterStream` / `drawTooth` | 内容里的枚举值在这里各有一笔画法 |

零位图带来的三个好处都很实在：包体积里没有图片资源（`dist` 里唯一的非 JS/CSS 文件是 `index.html`）、离线与弱网下不会出现「先白块后出图」、截图比对的基准在任何设备上都一致。

## 8.6 BaseScene：儿童向交互基线

`BaseScene`（332 行）是八个场景的共同父类，它把「所有玩法都必须做到的事」写死成一处：

```ts
export abstract class BaseScene extends Phaser.Scene {
  protected readonly ctx: GameContext;
  protected readonly session: SessionState;

  protected constructor(key: string, ctx: GameContext) {
    super(key);
    this.ctx = ctx;
    this.session = { mistakes: 0, correct: 0, total: 0, startedAt: ctx.services.now() };
  }

  protected get W(): number { return this.ctx.manifest.designSize.width; }
  protected get H(): number { return this.ctx.manifest.designSize.height; }
  protected get autoplay(): boolean { return this.ctx.debug?.autoplay === true; }
  protected get instant(): boolean { return this.ctx.debug?.instant === true; }
  protected get reducedMotion(): boolean { return this.ctx.reducedMotion; }
}
```

三个 `get` 直接映射到契约上的三个开关：`autoplay` 让自动化跑真实处理函数，`instant` 跳过过场与语音，`reducedMotion` 尊重系统的「减少动态效果」。`this.session` 记录 mistakes / correct / total / startedAt，`noteCorrect()` 与 `noteMistake(step)` 是唯一两个写入口，后者还会替场景发一次事件：

```ts
protected noteMistake(step: string): void {
  noteMistake(this.session);
  this.ctx.emit('task:retry', { taskId: this.ctx.manifest.id, step });
  this.sfx('retry');
}
```

按钮和完成卡片是两个信息密度最高的方法。`addButton` 的默认尺寸是 380×112——远大于 44px 的最小可点高度，而且它还画了一层「厚底」来暗示可按下：

```ts
protected addButton(x, y, label, onClick, opts: ButtonOptions = {}): Phaser.GameObjects.Container {
  const w = opts.width ?? 380;
  const h = opts.height ?? 112;
  const color = opts.color ?? THEME.warmRed;
  const container = this.add.container(x, y);

  const lip = this.add.graphics();
  roundRect(lip, -w / 2, -h / 2 + 8, w, h, h / 2, shade(color, 0.72), THEME.outline, 5);
  const face = this.add.graphics();
  roundRect(face, -w / 2, -h / 2, w, h, h / 2, color, THEME.outline, 5);

  container.on('pointerdown', () => {
    if (opts.disabled) return;
    this.sfx('tap');
    this.tweens.add({ targets: [face, text], y: 8, duration: 60, yoyo: true });
    onClick();
  });
  return container;
}
```

厚底是「同一个圆角矩形往下偏 8px、颜色 `shade(color, 0.72)`」；按下时把面板与文字一起向下移 8px，正好贴到厚底上。不需要额外状态、不需要九宫格图，两行代码换来一个明确的按压反馈。

`finishTask()` 是**一局的唯一收尾**，所有模板都调它，所以不存在「某个模板忘了发事件或忘了奖励」：

```ts
protected finishTask(opts: CompletionOptions = {}): void {
  if (this.completionShown) return;          // 只做一次
  this.completionShown = true;
  const stars = opts.stars ?? starsForSession(this.session);
  const durationMs = this.ctx.services.now() - this.session.startedAt;
  this.ctx.emit('task:complete', {
    taskId: this.ctx.manifest.id, stars,
    mistakes: this.session.mistakes, correct: this.session.correct,
    total: Math.max(this.session.total, 1), durationMs,
  });
  this.sfx('complete');
  if (!this.reducedMotion) this.cameras.main.flash(260, 255, 250, 220);
  this.showCompletionOverlay(stars, opts.praise ?? this.ctx.task.done);
  if (this.autoplay) {
    this.time.delayedCall(opts.autoExitMs ?? 450, () => this.exit('complete'));
  }
}
```

`starsForSession()` 把 mistakes 折成星数：0–1 次失误 3 星、2–3 次 2 星、更多则 1 星。注意它**不是**「全对才 3 星」——孩子第一次点歪不该只拿一颗星。完成卡片是一张 600×720 的圆角卡：中间一只 `excited` + `hearts` 的竹竹、三颗半径 44 的星星（未点亮用 `paperDeep` 底 + `grey` 边）、一句夸奖、以及两个出口（「再玩一次」= `exit('replay')`、「收下」= `exit('complete')`）。两个按钮的坐标必须与 `@bamboo/templates/layout` 的 `COMPLETE_LAYOUT` 保持一致，因为 **e2e 要点它们**——完成卡片是 Phaser 内绘的，没有 DOM testid，只能靠坐标。

音效键在契约里一共十二个（`tap` / `correct` / `retry` / `pop` / `bubble` / `water` / `chew` / `jump` / `sleep` / `unlock` / `complete` / `sparkle`），场景只写「发生了什么」而不是「播哪个音」，具体波形由平台层合成（第 9 章）；需要音高变化的场合则走 `audio.tone(freq, durationMs)`，例如节奏模板里 `registerTap` 算出的 `440 + streak * 45`。`reducedMotion` 是另一个贯穿基类的能力：它同时关掉相机淡入（`fadeIn`）、完成时的白闪（`cameras.main.flash`）与各种补间——系统开了「减少动态效果」的设备上，一局游戏仍然完整可玩，只是不再晃。

场景侧还有四个小工具：`tapAnywhere()`（整屏一个大 `Zone`，配 `isTapArmed(now, lastAdvanceAt)` 的 350ms 连点锁）、`showHint()`（一个自适应宽度的药丸气泡，默认停留 2.6 秒）、`say(text, hintMs, hintY)`（念一句 + 屏幕上给同一句，听不见的孩子也能读）、`tr(key)`（缓存一份取词器）。最后 `onShutdownCleanup(fn)` 把清理注册到场景的 `shutdown` 事件上，每个场景都靠它撤掉自己的输入监听与定时器。

## 8.7 实例化与缩放

Phaser 实例由 `createPhaserGame()` 创建，参数几乎全部来自契约：

```ts
export function createPhaserGame(ctx: GameContext, opts: CreateGameOptions): Phaser.Game {
  const { width, height } = ctx.manifest.designSize;
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: ctx.container,
    width,
    height,
    backgroundColor: THEME.ink,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    scene: opts.scenes,
  });
}
```

四个参数各有理由：`parent: ctx.container` 让 Vue 决定画布挂在哪个 DOM 节点上；`width/height` 是逻辑分辨率（`DESIGN = { width: 750, height: 1334 }`，竖屏）；`Scale.FIT` + `CENTER_BOTH` 让同一份布局在 375×812、430×932 与桌面窗口里等比铺满并居中，模板因此可以一直用 0–750 / 0–1334 的绝对坐标；`audio: { noAudio: true }` 明确关掉 Phaser 的音频系统——声音由 `ctx.services.audio` 负责（第 9 章），这也是裁剪能省掉 Sound 模块的前提。

缩放导致的一个直接后果是**逻辑像素与 CSS 像素不是 1:1**。设计尺寸 750 宽铺到 375 宽的屏幕上是一半，所以「88×88 逻辑像素」正好等于 44 CSS px——正好踩在可点区域的下限上。`packages/templates/src/layout.ts` 因此把上限单独列出来：

```ts
export const UI = {
  headerH: 140,
  hintY: 260,
  buttonH: 112,
  /** 可点区域下限（88 逻辑像素 ≈ 44 CSS px 的两倍） */
  minTap: 96,
} as const;
```

约定是 96 而不是 88：模板一律按「比下限宽一点」做，因为手指落在边缘时的实际命中会比视觉小一圈。八个模板里的判定半径（130、150）也遵循同一思路。

`Scale.FIT` 还有一个附带好处：它在不同手机上的表现是「等比缩放 + 上下留黑边或背景色」，而不是拉伸。设计里所有圆形（细菌、星星、心形、按钮）在任何屏幕上都不会变成椭圆，这对儿童产品的视觉稳定性很重要。容器侧的分工也很清楚——`apps/site/src/style.css` 只写 `touch-action: none` 与 `overflow: hidden`，画布尺寸完全交给 `ScaleManager`，Vue 不参与游戏内的布局计算。

## 8.8 拖拽与命中测试：不用 setInteractive 的 hitArea

`packages/phaser-kit/src/drag.ts` 只有 90 行，却省掉了后面无数个诡异 bug：

```ts
/**
 * 不依赖 GameObject 的命中区域，而是「按下时抓住最近的、在半径内的目标」。
 *
 * 原因（CHAGS 实测踩坑）：Container 的 setInteractive(hitArea) 在 Phaser 4 里的
 * 局部坐标约定与直觉不符，会出现「点在 A 上却抓到 80 像素外的 B」。
 * 自己算距离既确定，又对小朋友更友好 —— 手指粗、点不准也能抓住。
 */
```

接口本身很小：`add({ obj, radius, enabled?, onGrab?, onDrop? })` / `remove(obj)` / `destroy()`。控制器监听整个场景的 `pointerdown` / `pointermove` / `pointerup` / `pointerupoutside`，按下时在全部目标里挑「距离指针最近且在 `radius` 内」的那个（`enabled?.()` 为假则跳过，用于「已经放好的不能再拖」），移动时按抓取偏移跟随，松手时回调 `onDrop`。`pointerupoutside` 是必须的：手指滑出画布再松开，只监听 `pointerup` 会让对象永远粘在指针上。

模板里的取数习惯是「判定半径 > 视觉大小」：

| 模板 | 抓取半径 | 判定半径 |
|---|---|---|
| scrub | 130（工具） | 内容点的 `0.11 * size`（0–1 空间） |
| feed | 100（食物） | 嘴边 150 |
| dress | 92（衣服） | 部位 130（约定下限 120） |
| tidy | 86（玩具本身约 70） | 箱子 130 |

`springBack(scene, obj, x, y)` 是松手时的统一动作：先 `killTweensOf(obj)`（避免上一次回弹的补间还在和这一次抢位置），再用 `Back.easeOut` 在 240ms 内弹回原位。放对了则走另一条路——把对象 `remove` 出控制器、补到目标位置并淡出，孩子立刻知道「这件不用再拖了」。

不是所有点击都走 `createDragController`。order、pick、learn 三个模板是「点选」，它们自己算矩形或圆：

```ts
// pick.ts：安慰按钮的命中（不使用 Phaser 的容器命中区）
Math.abs(pointer.x - COMFORT.cx) <= COMFORT.w / 2 &&
Math.abs(pointer.y - COMFORT.cy) <= COMFORT.h / 2
```

这是同一个决定的两面：**命中判定自己算，规则就写在眼前，测试也能照抄同一组数字。**

## 8.9 与外壳的分工边界

渲染层与外壳之间只有一条通道：`GameContext`。模板里能做的三件事是「画、判定、发事件」，不能做的两件事是「读写存档」与「直接联网」：

- 声音走 `ctx.services.audio.play(key)` 与 `.speak(text, locale)`，存档走外壳的 `task:complete` 事件回调，二者都不在 `phaser-kit` 里；
- `packages/phaser-kit` 的依赖只有 `phaser`、`@bamboo/game-kit`（类型）与 `@bamboo/i18n`（取词器），没有 `@bamboo/progress`、没有 `@bamboo/platform`。渲染层在依赖图里是一个叶子。

这条边界的收益在依赖图与产物里都能验证：`phaser-kit` 的三个依赖里两个是 types-only（`@bamboo/game-kit` 的 `GameContext`、`Phaser` 的类型）或者纯函数（`@bamboo/i18n` 的取词器），所以它不可能把 IndexedDB 封装、存档迁移、平台探测这些代码拖进游戏 chunk。产物那边就是 `assets/vendor-phaser` 与十个 `game-<id>` chunk 里没有一行存档逻辑——这是裁剪之外的第二层「体积纪律」。

`packages/phaser-kit/src/session.ts` 是这个边界上一个有意思的例外，它被刻意做成「重复实现」：

```ts
/** 与 progress 的 starsFor 同一口径（模板包不 import 存档层，避免把迁移逻辑带进游戏 chunk） */
export function starsForSession(session: SessionState): Stars {
  if (session.mistakes <= 1) return 3;
  if (session.mistakes <= 3) return 2;
  return 1;
}
```

星数规则在存档层里也有一份（`packages/progress` 的 `starsFor`），但因为模板包不能 import 存档层，这里重写了一遍，并用注释锁住「同一口径」。这是一个**用少量重复换清晰依赖方向**的取舍：如果哪天两边算法不一致，表现是「完成卡片显示 3 星，任务页显示 2 星」——很容易发现，但也要记得两处一起改。

`packages/phaser-kit/src/tapGuard.ts` 与 `packages/templates/src/layout.ts` 是这条边界的另外两个注脚：前者把「连点保护」的 350ms 做成一个纯函数常量，后者把所有需要被 e2e 复用的坐标做成不 import Phaser 的纯常量。三者的共同点是**把「逻辑」从「渲染」里择出来**——这也是整个工具箱唯一的设计原则。

下一章离开画面，去看那几个模板一直在调用、却完全不属于 Phaser 的东西：`ctx.services` 背后的平台适配层与音频实现。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/others/BambooBuddy/第07章-玩法模板库详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/第09章-平台适配层与音频实现/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

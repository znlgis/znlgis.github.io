---
layout: default
title: 第08章 - Phaser渲染工具箱
---

# 第08章 - Phaser渲染工具箱

## 8.1 phaser-kit 的职责边界

`packages/phaser-kit` 是模板与游戏包脚下的「地基」：它封装引擎启动、基础场景能力、主题配色、卡通绘制原语与拖拽控制器。它**不含任何具体玩法**（那是 templates 的事），也不认识任何典故（那是 games 的事）。

```
packages/phaser-kit/src/
├─ createGame.ts    # Phaser.Game 启动器（29 行）
├─ baseScene.ts     # BaseScene：按钮 / 提示 / 小手 / 翻译 / 音频捷径
├─ theme.ts         # 配色、字体栈、文字样式（含对比度依据）
├─ cartoon.ts       # 圆润卡通绘制原语（厚描边、落地阴影、星光……）
├─ drag.ts          # 按距离判定的拖拽控制器 + springBack
└─ index.ts         # 统一导出
```

## 8.2 createPhaserGame：29 行的启动器

```ts
export function createPhaserGame(ctx: GameContext, opts: CreateGameOptions): Phaser.Game {
  const { width, height } = ctx.manifest.designSize;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: ctx.container,
    width,
    height,
    backgroundColor: THEME.ink,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { noAudio: true },
    scene: opts.scenes,
  });
}
```

每个决定的依据：

| 配置 | 依据 |
|---|---|
| `type: Phaser.AUTO` | 有 WebGL 用 WebGL，没有回退 Canvas —— 旧安卓机的兼容底线 |
| `width/height` 取 manifest 的 `designSize` | 全部坐标都在 750×1334 的逻辑分辨率里，缩放交给 ScaleManager |
| `Scale.FIT` + `CENTER_BOTH` | 任意屏幕一次性适配；e2e 的坐标换算就是这套缩放的逆运算（第 13 章） |
| `audio: { noAudio: true }` | 引擎音频关闭：音效与 TTS 统一走 `PlatformServices.audio`，便于换平台、静音与 iOS 解锁 |
| 注释里的 destroy 约定 | 游戏包必须在 unmount 时 `game.destroy(true)`，否则残留 canvas 与 RAF 循环 |

## 8.3 BaseScene：全部场景的公共父类

所有模板场景与游戏专属场景都 `extends BaseScene`。它提供的 protected API 一览：

| API | 作用 |
|---|---|
| `W` / `H` | 逻辑分辨率宽高（读 manifest） |
| `autoplay` | 当前是否无头自动模式 |
| `drawBackdrop(label?)` | 天空底色 + 150px 深色标题条 + 居中标题 |
| `addButton(x, y, label, onClick, opts?)` | 卡通按钮（默认 520×136） |
| `addBody(x, y, content, size?, color?, wrapWidth?)` | 正文文字（默认换行宽度 `W - 160`） |
| `showHint(message, durationMs?, y?)` | 卡住时出现的提示气泡（底部其它元素之上，`depth 950`） |
| `tapToContinue(onDone, handAt?)` | 全屏点击继续 + 小手（故事页用它替代「下一幕」按钮） |
| `sfx(key)` / `speak(text)` | 音效与语音的快捷方法（内部走 ctx.services.audio） |
| `tr(key)` | 界面文案取词（典故文字不走这里，走 `ctx.content`） |
| `fadeIn()` | 场景淡入，尊重 `reducedMotion` |
| `onShutdownCleanup(fn)` | 场景销毁时清资源（拖拽控制器等） |

几个关键实现的取法与理由：

### 按钮：可点区域、按压反馈与文字换行

```ts
protected addButton(x, y, label, onClick, opts: ButtonOptions = {}) {
  const w = opts.width ?? 520;
  const h = opts.height ?? 136;
  const color = opts.color ?? THEME.red;
  const container = this.add.container(x, y);

  const lip = this.add.graphics();
  roundRect(lip, -w / 2, -h / 2 + 9, w, h, h / 2, shade(color, 0.72), THEME.outline, 5);
  const face = this.add.graphics();
  roundRect(face, -w / 2, -h / 2, w, h, h / 2, color, THEME.outline, 5);

  const text = this.add.text(0, -2, label, {
    ...textStyle(opts.fontSize ?? 44, opts.textColor ?? CSS.card, true),
    align: 'center',
    // 默认开 wordWrap：长选项曾经直接溢出按钮
    wordWrap: opts.wrap === false ? undefined : { width: w - 64, useAdvancedWrap: true },
  }).setOrigin(0.5);

  container.add([lip, face, text]);
  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    Phaser.Geom.Rectangle.Contains,
  );
  container.on('pointerdown', () => {
    if (opts.disabled) return;
    this.sfx('tap');
    this.tweens.add({ targets: [face, text], y: 9, duration: 60, yoyo: true });
    onClick();
  });
  return container;
}
```

- 默认 520×136 远超「可点击区域 ≥ 88×88 逻辑像素」的儿童交互规范；
- 厚底（`lip`，颜色加深 0.72）+ 亮面（`face`）+ 描边是三段式，按下时亮面下沉 9px —— 触屏没有 hover，反馈必须发生在按下瞬间；
- `wordWrap` 默认开启是修 bug 修出来的：长选项文字不换行会溢出按钮。

### tapToContinue：小手代替「下一步」

```ts
protected tapToContinue(onDone: () => void, handAt?: { x?: number; y?: number }): void {
  const hand = createHand(this, handAt?.x ?? this.W / 2, handAt?.y ?? this.H - 150, 1.15);
  const zone = this.add.zone(this.W / 2, this.H / 2, this.W, this.H).setInteractive({ useHandCursor: true });
  let done = false;
  const finish = () => { /* 去重 + 清理 */ };
  zone.once('destroy', () => { done = true; });
  // 连点保护：孩子连点两下时，第二下会落在**下一幕刚建好的**点击区上
  const armedAt = this.ctx.services.now() + 350;
  zone.on('pointerdown', () => {
    if (this.ctx.services.now() < armedAt) return;
    this.sfx('tap');
    finish();
  });
  if (this.autoplay) this.time.delayedCall(120, finish);
}
```

350ms 输入锁的来源是一次真实故障：孩子连点两下，第二下落在下一幕刚建好的 Region 上，一屏故事被整段跳过。锁很短，正常阅读完全感觉不到。

### 提示气泡：只在卡住时出现

`showHint` 是一个圆角药丸 + 居中文字，自动弹出、自动淡出、出现时有 `popIn` 动画；换行宽度是 `W - 180`（570px）—— 这个数字也来自修复：提示语里有长句（「想明白了就不怕 —— 天是积起来的气……」），窄了会把句号挤成孤零零的第三行。提示语要求「文字尽量短」，24 字以内（schema 对模板 hint 字段有 `max(24)` 约束）。

## 8.4 theme：配色、字体与对比度

```ts
/** 圆润卡通配色：厚描边 + 暖亮色，比纯黑描边更柔和 */
export const THEME = {
  outline: 0x3a2f26, ink: 0x3a2f26, inkSoft: 0x6b5a49,
  paper: 0xfdf3dc, paperDeep: 0xf0e0bd, card: 0xfffaf0,
  red: 0xe0554a, redDeep: 0xb03a31,
  teal: 0x3d8f86, tealDeep: 0x2c6b64,
  gold: 0xf2b134, goldDeep: 0xc98a1c,
  sky: 0xc6e8f5, skyDeep: 0x9fd4ea,
  water: 0x59abda, waterDeep: 0x3283b3,
  sand: 0xf3e0b0, sandDeep: 0xdfc78d,
  wood: 0xc98a4b, woodDeep: 0x96612b,
  stone: 0xaeaaa2, stoneDeep: 0x827d75,
  elephant: 0xb6b1a8, elephantDeep: 0x918c84,
  leaf: 0x74b96c,
} as const;
```

`CSS` 里另有一份字符串色值（给 Phaser 文字用），并且**深色版本是有意为之的**：

```ts
export const CSS = {
  ink: '#3a2f26', inkSoft: '#6b5a49', paper: '#fdf3dc', card: '#fffaf0',
  red: '#e0554a', teal: '#3d8f86', gold: '#c98a1c', white: '#ffffff',
  /**
   * 深色版本，用于浅底上的文字与图标。
   * 原始色放在浅底上对比度不够：红/纸 3.42:1、青/纸 3.48:1、金/卡 2.83:1，
   * 都过不了 WCAG AA。下面这三个分别是 5.44 / 5.61 / 5.42。
   */
  redDeep: '#b03a31', tealDeep: '#2c6b64', goldDeep: '#8a5f10',
} as const;
```

对比度不是美学问题：一次全仓审查发现「整局最高潮的数字」（曹冲称象的读数）红字压水面只有 **1.48:1**，几乎看不见；答案为 2.92:1，界面主按钮 3.42:1…… 这些都在第 16 章有完整清单。修法就是「换深色变体 + 垫底色」：读数垫卡片底后达到 12.5:1。

字体栈选 Noto Sans SC 并为各平台准备回退：

```ts
export const FONT_STACK =
  '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';

export function textStyle(size: number, color: string = CSS.ink, bold = false) {
  return { fontFamily: FONT_STACK, fontSize: size + 'px', color, fontStyle: bold ? 'bold' : 'normal' };
}
```

儿童向的字号下限是 28 设计像素（约 16 CSS px @ 375 宽手机）—— 曾经典故原文与出处只有 13.8 CSS px，已全部上调。

## 8.5 cartoon：圆润卡通的绘制原语

阶段 0 的美术策略是**零图片资源，全部用几何图形绘制**。`cartoon.ts` 把这些绘制收敛成一套原语，保证所有典故观感统一：

| 原语 | 作用 |
|---|---|
| `roundRect(g, x, y, w, h, radius, fill, stroke?, lineWidth?)` | 厚描边圆角矩形（radius 支持四角对象，如船底更圆） |
| `circle(g, x, y, r, fill, stroke?, lineWidth?)` | 厚描边圆 |
| `shade(color, factor)` | 颜色加深/提亮（同色系阴影面，如 `shade(THEME.wood, 1.22)`） |
| `groundShadow(g, cx, cy, w, h, alpha)` | 落地椭圆阴影 —— 角色「站在地上」的关键 |
| `popIn(scene, obj, delay?)` | 弹出式出现动画（Back.easeOut） |
| `springBack(scene, obj, x, y)` | 松手弹回原位（先杀掉旧补间，避免与拖拽抢位置） |
| `squash(scene, obj, scale, duration)` | 挤压回弹（石头落船、大象上船的重量感） |
| `sparkleAt(scene, x, y, color, count)` | 星光爆点（成功反馈的固定语言） |
| `wavyBand(g, x, y, w, h, color, alpha, amplitude, step)` | 波浪水面（曹冲的江面由两层叠加画成） |
| `createHand(scene, x, y, scale)` | 引导用的小手（会轻轻点动） |

使用示例（大象的耳朵）：

```ts
circle(g, cx + 92 * s, cy - 12 * s, 58 * s, body, THEME.outline, stroke);   // 头
circle(g, cx + 58 * s, cy - 30 * s, 44 * s, dark, THEME.outline, stroke);   // 耳朵
```

所有角色都遵循同一种画法约定：`fillStyle` 填色 + `lineStyle(粗描边)` 描边，描边颜色统一 `THEME.outline`（暖黑 0x3a2f26），不纯黑 —— 这是「柔和」观感的来源。美术到位后，替换的是**游戏包里的 `art.ts`**，模板与工具箱一行不改。

## 8.6 drag：按距离判定的拖拽控制器

Phaser 4 里 `Container.setInteractive(hitArea)` 的局部坐标约定与直觉不符，实测出现过「点在 A 上却抓到了 80 像素外的 B」——按钮那种「点在正中心」的场景察觉不到，拖拽一上来就暴露。工具箱的做法是完全不依赖命中区域，**按下时抓住半径内最近的目标**：

```ts
export function createDragController(scene: Phaser.Scene): DragController {
  const targets: GrabTarget[] = [];
  let active: { target: GrabTarget; dx: number; dy: number } | null = null;

  const onDown = (pointer: Phaser.Input.Pointer): void => {
    if (active) return;
    let best: GrabTarget | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (target.enabled && !target.enabled()) continue;
      const dist = Math.hypot(pointer.x - target.obj.x, pointer.y - target.obj.y);
      if (dist <= target.radius && dist < bestDist) { best = target; bestDist = dist; }
    }
    if (!best) return;
    active = { target: best, dx: pointer.x - best.obj.x, dy: pointer.y - best.obj.y };
    best.onGrab?.(best.obj);
  };

  const onMove = (pointer) => { if (active) active.target.obj.setPosition(pointer.x - active.dx, pointer.y - active.dy); };
  const onUp = () => { /* 松手 → onDrop */ };

  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);

  return { add, remove, destroy };
}
```

```ts
export interface GrabTarget {
  obj: Phaser.GameObjects.Container;
  /** 抓取半径：小朋友手指粗，判定必须宽松 */
  radius: number;
  /** 什么时候可以被抓（例如"大象上船后就不能再拖"） */
  enabled?: () => boolean;
  onGrab?: (obj) => void;
  onDrop?: (obj) => void;
}
```

设计要点：

- **抓取半径普遍给得很大**（光球 92、石头 `radius * 3`），「手指粗、点不准也能抓住」；
- `enabled` 让「现在能不能拖」成为每个目标自己的事（大象在 `stage !== 'load'` 时不可拖）；
- 拖动偏移 `dx/dy` 以**按下点**为基准，物体不会跳到手指中心；
- 场景 `shutdown` 时调 `drag.destroy()` 摘掉监听（模板里通过 `onShutdownCleanup` 统一做）。

## 8.7 深度（depth）约定与重画策略

没有全局的 depth 枚举，但各场景遵循同一种分层习惯（以曹冲的等价代换场景为例）：

| 层 | depth | 内容 |
|---|---|---|
| 背景 | 1–2 | 天空、水面、水带、沙滩、云 |
| 世界静态 | 10 | 船（含水面半透明覆盖层） |
| 可交互物 | 20–30 | 大象、石堆、秤、船上货物 |
| 拖拽中 | 70–90 | 被抓起的目标临时提到最上 |
| 特效与读白 | 700–950 | 箭头、十字、提示气泡、星光 |

两条策略在模板里反复出现：

1. **静态世界一次画、状态变化时重画**（如船身吃水与刻痕）；
2. **需要持续动画的部分用逐帧 `drawStage(g, metrics)`**（水位、鸟飞、太阳跑）—— 不维护 Sprite 列表，避免状态与画面不同步。

## 8.8 reducedMotion 与无障碍

- `fadeIn()` 在 `ctx.reducedMotion`（系统 `prefers-reduced-motion`）开启时直接跳过；
- 场景切换、压平/挤压等大幅动效在 UI 层都有对应的克制；模板里所有「理解性动画」（水痕移动、太阳变暖）保留，因为它们承载信息；
- 关键信息不靠颜色单独传达：对/错同时有图形与音效；女娲的配对判定靠形状不靠颜色（色弱友好）。

## 8.9 小结

- phaser-kit 把「引擎怎么起、按钮怎么画、声音怎么发、拖拽怎么判」收敛成一套小原语，让模板与游戏只关心内容本身；
- 对比度、点击区域、输入锁、字体栈这些儿童向约束都落在工具箱一层，全仓共享；
- 拖拽控制器的教训（Phaser 4 hitArea 坐标问题）与输入锁的教训（连点跳页）说明：**工具箱层是修一次、全仓受益的地方**。

下一章进入平台层：存档、音频与运行环境适配 —— 讲清楚「游戏不碰环境」这条铁律背后的实现。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/others/CHAGS/第07章-玩法模板库详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/others/CHAGS/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/others/CHAGS/第09章-平台适配层与音频实现/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

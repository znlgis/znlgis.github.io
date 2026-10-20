---
layout: default
title: 第08章 - Phaser渲染工具箱
---

# 第08章 - Phaser渲染工具箱

## 8.1 phaser-kit 的职责边界

`packages/phaser-kit` 是模板与游戏包脚下的「地基」：封装引擎启动、基础场景能力、主题配色、卡通绘制原语与拖拽控制器。它**不含任何具体玩法**（那是 templates 的事），也不认识任何典故（那是 games 的事）。2026-10-20 的「输入可靠性」大修之后，它的职责里又多了三件与「点得中不中」直接相关的东西：命中区约定、手势守卫、连点护盾。

```
packages/phaser-kit/src/
├─ createGame.ts    # Phaser.Game 启动器 + 触点数配置
├─ baseScene.ts     # BaseScene：按钮 / 提示 / 小手 / 翻译 / 音频捷径 / tapAck
├─ hitArea.ts       # Container 命中区约定：从 (0,0) 起算 + TOUCH_PAD
├─ gesture.ts       # 手势守卫：一次连续手势只认一根手指
├─ tapGuard.ts      # 「点哪都行」点击区的连点护盾（350ms）
├─ theme.ts         # 配色、字体栈、文字样式（含对比度依据）
├─ cartoon.ts       # 圆润卡通绘制原语（厚描边、落地阴影、涟漪、星光……）
├─ drag.ts          # 按距离判定的拖拽控制器 + springBack
└─ index.ts         # 统一导出
```

三个单测（`hitArea` / `gesture` / `tapGuard`）与实现同目录：约定的「墓碑」和代码放在一起，谁把 `-w/2` 写回去，`pnpm test` 就会响。

## 8.2 createPhaserGame：启动器与触点数

`packages/phaser-kit/src/createGame.ts` 的启动函数：

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
    /**
     * ★ 必须开多点触控：Phaser 默认 input.activePointers = 1（鼠标 + 1 个触点），
     * 一根手指还按在屏幕上（扶屏、连点、长按、拖到一半）时，第二根手指的 touchstart
     * 会找不到空闲指针而被**整条丢弃**（InputManager.onTouchStart 里 break，
     * changed 数组为空，任何插件都收不到）—— 孩子看到的就是"点几次都没反应，
     * 有时候突然又有反应"，取决于此刻是不是还按着另一根手指。
     * 3 个触点 = 两只拇指 + 一只扶屏的手；再多没有收益（Phaser 上限 10）。
     */
    input: { activePointers: 3 },
    scene: opts.scenes,
  });
}
```

| 配置 | 依据 |
|---|---|
| `type: Phaser.AUTO` | 有 WebGL 用 WebGL，没有回退 Canvas —— 旧安卓机的兼容底线 |
| `width/height` 取 manifest 的 `designSize` | 全部坐标都在 750×1334 的逻辑分辨率里，缩放交给 ScaleManager |
| `Scale.FIT` + `CENTER_BOTH` | 任意屏幕一次性适配；e2e 的坐标换算就是这套缩放的逆运算（第 13 章） |
| `audio: { noAudio: true }` | 引擎音频关闭：音效与 TTS 统一走 `PlatformServices.audio`（第 9 章） |
| `input: { activePointers: 3 }` | 默认 1 时第二根手指的 `touchstart` 不存在，见 8.5 |

## 8.3 BaseScene：全部场景的公共父类

| API | 作用 |
|---|---|
| `W` / `H` / `autoplay` / `storyInstant` | 逻辑分辨率宽高；无头自动模式；`?story=instant` 跳过「听完才能继续」 |
| `addButton(x, y, label, onClick, opts?)` | 卡通按钮（默认 520×136），命中区走 `containerHitArea` |
| `showHint(message, durationMs?, y?)` | 卡住时出现的提示气泡（`depth 950`） |
| `tapToContinue(onDone, handAt?)` | 全屏点击继续 + 小手（故事页以此替代「下一幕」按钮） |
| `tapAck(x?, y?)` | 「我收到了」：一声短音 + 一圈涟漪，**不推进任何状态**（8.6） |
| `completeLevel(opts)` | 收尾序列（音效 → 闪屏 → 金光 → finalize → 揭晓语 → 转场），同一局只执行一次 |
| `sfx(key)` / `speak(text)` / `tr(key, params?)` | 音效、语音、界面取词（典故文字走 `ctx.content`） |

### 按钮：可点区域、按压反馈与文字换行

`packages/phaser-kit/src/baseScene.ts`（节选，按钮本体在 `container.add` 之前）：

```ts
container.add([lip, face, text]);
container.setSize(w, h);
// 命中区从 (0,0) 起算（见 hitArea.ts）：写成 (-w/2,-h/2,w,h) 会让可点区整体左上
// 偏移半个按钮，只有左上四分之一能点中 —— 典故卡/故事页/配对模板的按钮都中过这一枪。
// 外圈再给 TOUCH_PAD：孩子手指落点散，点偏一点也算数。
container.setInteractive({
  hitArea: containerHitArea(w, h),
  hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  useHandCursor: true,
});
container.on('pointerdown', () => {
  if (opts.disabled) return;
  this.sfx('tap');
  this.tweens.add({ targets: [face, text], y: 9, duration: 60, yoyo: true });
  onClick();
});
```

- 按钮本体是三段式：厚底 `lip`（同色加深 0.72、向下让出 9px）+ 亮面 `face` + 5px 描边。触屏没有 hover，反馈必须发生在按下瞬间；
- 默认 520×136 远超「可点击区域 ≥ 88×88 逻辑像素」的儿童交互硬规矩；`wordWrap` 默认开启是修 bug 修出来的（长选项不换行会溢出按钮）；
- `useHandCursor` 是这次顺带补的：桌面端与 WebView2 里没有手型光标，家长会以为按钮不可点。

### tapToContinue：小手代替「下一步」

`tapToContinue` 铺一张全屏 Zone，第一下有效点击时先记 `lastAdvanceAt` 再回调（下一幕的点击区可能就在 `onDone()` 里同步建好）：

```ts
zone.on('pointerdown', () => {
  if (!isTapArmed(this.ctx.services.now(), this.lastAdvanceAt)) return;
  this.sfx('tap');
  finish();
});
```

输入锁来自一次真实故障：孩子连点两下，第二下落在下一幕刚建好的点击区上，一屏故事被整段跳过。但「从建区起算」会把「刚听完就点」那一下正常点击一起吞掉 —— e2e 里复现过：听完了却进不了玩法。所以锁的起点是 `lastAdvanceAt`（上一次真的翻页的时刻），纯逻辑抽到 `tapGuard.ts`：`TAP_LOCK_MS = 350`、`tapArmedAt(lastAdvanceAt)`、`isTapArmed(now, lastAdvanceAt)`，单测钉死「刚翻页 349ms 内不认、350ms 后认」。

### 提示气泡：只在卡住时出现

`showHint` 是圆角药丸 + 居中文字，出现时 `popIn`、到点自动淡出；换行宽度 `W - 180`（570px）—— 这个数字也来自修复：提示语里有长句（「想明白了就不怕 —— 天是积起来的气……」），窄了会把句号挤成孤零零的第三行。提示语要求 24 字以内（schema 对 hint 有 `max(24)` 约束）。

## 8.4 命中区：必须从 (0,0) 起算

这是本章唯一一个「旧结论已作废」的地方。上一版教程写过「Phaser 4 的 `setInteractive(hitArea)` 局部坐标约定与直觉不符，所以别用命中区、自己算距离」—— 现象是真的，结论是错的。约定是确定的，只是它不是直觉里的那一个。

### 旧写法：可点区只有按钮的左上四分之一

`addButton` 曾经这么写：

```ts
container.setSize(w, h);
container.setInteractive(
  new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
  Phaser.Geom.Rectangle.Contains,
);
```

看着是「以中心为原点」。但 Phaser 的命中测试分两步（`InputManager.hitTest` → `pointWithinHitArea`）：先把指针换算成对象的**局部坐标**（容器中心 = 0,0），再**加上 `displayOrigin`** —— Container 的 `displayOrigin` 恒为 `width/2, height/2`，最后才拿这份「左上角原点」的坐标去和 `hitArea` 做包含判断。于是按钮在这份坐标里占 `[0, w] × [0, h]`，而 `Rectangle(-w/2, -h/2, w, h)` 只覆盖 `[-w/2, w/2]`，相交只剩**左上四分之一**；偏偏 `Rectangle.Contains` 两端都是闭区间（`>=`），正中心恰好压在右下角上 —— **点正中心偶尔能中，点右侧/下方一定没反应**。这就是用户说的「点几次都没反应，有时候突然又有反应，比较随机」。

扫描实测（Phaser 4.2.1，真实场景 `?card=hold` 停在典故卡上，探「再来一次」按钮：中心 207,1190、288×104）：

| 点哪儿 | 视觉上 | 修前 | 修后 |
|---|---|---|---|
| 正中心 (207,1190) | 按钮上 | 有反应（压线，靠运气） | 有反应 |
| 中心右侧 (260,1190) | 按钮上 | **没反应** | 有反应 |
| 中心下方 (207,1220) | 按钮上 | **没反应** | 有反应 |
| 按钮外 40px | 按钮外 | 没反应 | 没反应（`TOUCH_PAD=12` 之外） |

### 修法：把这层约定收进一个函数

`packages/phaser-kit/src/hitArea.ts`（节选，`containerHitArea` 的 JSDoc 里有上面那三步推导）：

```ts
/** 命中区矩形（结构上就是 Phaser.Geom.Rectangle；这里的类型不 import Phaser，好让纯数学单测跑在 node 里） */
export interface HitAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 手指不必点得像素级准：命中区在**视觉按钮外圈**再多给这么多。
 *
 * 孩子的手指落点比大人散得多（尤其单手竖握手机时，拇指落点经常偏一点）。
 * 12px 在 750×1334 的设计分辨率上是按钮高度的 1/10 左右：
 * 手抖也能点中，又不会把相邻按钮的判定粘在一起（典故卡两个按钮之间还有 24px 空隙）。
 */
export const TOUCH_PAD = 12;

export function containerHitArea(w: number, h: number, pad: number = TOUCH_PAD): HitAreaRect {
  return { x: -pad, y: -pad, width: w + pad * 2, height: h + pad * 2 };
}
```

几个数字要说得清：

- `pad = 0` 时矩形正好是 `(0, 0, w, h)`，与按钮视觉完全重合；默认 `pad = 12` 时是 `(-12, -12, w + 24, h + 24)`，四周各外扩 12px。**它仍然以 (0,0) 为基准**，只是往外长了一圈 ——「从 (0,0) 起算」和「给手指留余量」是两件事，不是两套坐标。
- `TOUCH_PAD = 12` 在 750×1334 上约等于按钮高度的 1/10。再大就会把并排按钮粘在一起：典故卡两按钮中心相距 336、各宽 288，视觉空隙 48，两侧各外扩 12 后还剩 24。
- 宽度下限不是 `TOUCH_PAD` 决定的。「可点击区域 ≥ 88×88 逻辑像素」是儿童交互规范，而 `addButton` 默认 520×136、典故卡按钮 288×104 —— 都远超下限。这次修的是**可点区偏移**，不是按钮太小。

### 为什么按钮不再自己算距离

上一版教程建议「别用命中区，按下时抓最近的那个」。对拖拽（8.8）这个做法是对的，对**按钮**是错的：两按钮之间的 48px 空隙里「最近中心的一侧」会被判中 —— 点在两个按钮之间却触发了其中一个，比没反应更难解释；距离法还拿不到 `useHandCursor`、表达不了遮挡，得自己维护「哪些东西现在可点」。所以按钮回到 `setInteractive` + 正确命中区；拖拽继续用距离，因为那里「抓住最近的东西」本来就是产品语义。

### 守住这个约定

`packages/phaser-kit/src/hitArea.test.ts` 用两步换算（把指针坐标加上 `w/2`、`h/2`）复刻 Phaser 的命中测试，其中这一条就是那块墓碑：

```ts
it('旧的"直觉写法" (-w/2,-h/2,w,h) 点正中心是命中的，但点中心右侧/下方全部落空', () => {
  const legacy = { x: -w / 2, y: -h / 2, width: w, height: h };
  // 闭区间边界：正中心刚好压线，所以"偶尔点得中"
  expect(containsAt(legacy, 0, 0, w, h)).toBe(true);
  // 但按钮右半、下半完全点不动
  expect(containsAt(legacy, w / 4, 0, w, h)).toBe(false);
  expect(containsAt(legacy, 0, h / 4, w, h)).toBe(false);
  expect(containsAt(legacy, -w / 4, -h / 4, w, h)).toBe(true); // 只有左上四分之一能用
});
```

同文件另有 4 条钉住「中心 / 四边中点 / 四角都能点中」与「外圈不会无限外扩」。e2e 则故意**不点按钮中心**：`e2e/input.spec.ts` 的典故卡用例点 `REWARD_AGAIN.x + w * 0.42` / `y + h * 0.42`（视觉右下方），旧代码在这里百分之百没反应。影响面：典故卡的「再来一次 / 收下」（每局结束都出现）、故事页的「跳过故事」、配对模板的底部按钮。

## 8.5 多点触控：默认只有一个触点

命中区修好之后，还剩另一半「随机」：一根手指按着时，第二根手指的事件**根本不存在**。`createGame.ts` 原本没有 `input` 配置，Phaser 用默认值 `activePointers: 1` —— 只建「鼠标 + 1 个触点」两个指针对象；`InputManager.onTouchStart` 在 `pointers[1..]` 里找**空闲**指针，找不到就跳过这次 `touchstart`，这一下不会进入任何插件，连 `pointerdown` 都不会发。孩子扶屏、连点、长按、拖到一半没抬干净时，另一根手指点按钮**一个字都不会发生**；手一抬再点就好了。

修法是 `input: { activePointers: 3 }`（8.2）。但只加配置会带来反效果 —— **有状态的连续手势**必须自己挑一根手指，否则第二根会把你正在画的线接走、或在你还按着时替你「松手」。于是同一轮新增了 `packages/phaser-kit/src/gesture.ts`：

```ts
export function createGestureGuard(): GestureGuard {
  let activeId: number | null = null;
  return {
    begin(pointer: Phaser.Input.Pointer): boolean {
      if (activeId !== null) return false;
      activeId = pointer.id;
      return true;
    },
    isActive(pointer: Phaser.Input.Pointer): boolean {
      return activeId !== null && pointer.id === activeId;
    },
    end(pointer: Phaser.Input.Pointer): void {
      if (activeId === pointer.id) activeId = null;
    },
    reset(): void {
      activeId = null;
    },
  };
}
```

它只看 `pointer.id`（Phaser 的指针槽位号：0 = 鼠标，1.. = 触点），四行用法固定：down 时 `begin`、move/up 时 `isActive`、up 里 `end`。单点操作（点按钮、连点推进）**不需要**它：那类交互本来就应该「哪根手指都算」。改造清单（全部已落地）：

| 位置 | 多点触控下的问题 | 修法 |
|---|---|---|
| `tap.ts` 长按模式 | 任意一根手指抬起就算松手（两根拇指交替按会断） | `holdPointers` 集合，全部抬起才松手 |
| `chase.ts` 按住奔跑 | 同上 | 记住 `holdPointerId`，只认按下那根 |
| `drag.ts` 抓着东西（5 个模板共用） | 另一根手指抬起会把手里那件放下 / 中途松手 | 抓住时记 `pointerId`，move/up 只认它 |
| `swap` / `borrow` / `trace` / `aim` / `twoline` | 第二根手指把线/卡/旗接走，或替你放下、替你放箭 | 统一用 `createGestureGuard()` |

e2e 用 CDP 派发真实双指事件（先按住空白处，再用第二根手指点「再来一次」）：`activePointers: 1` 时必红、`3` 时必绿 —— 全仓唯一一条必须用 CDP 的用例。

## 8.6 tapAck：把「静默窗口」变成「收到了」

命中区和多点触控修好之后，还剩一类「点了没反应」：模板里 `if (busy || phase !== 'x') return;` 这类守卫**本身是对的**（演出没完不该推进），但一声不吭让孩子分不清「点错了」和「卡住了」。`BaseScene.tapAck` 给最轻的回应 —— 一声短音 + 一圈快速散开的金色涟漪，**不推进任何状态**：

```ts
protected tapAck(x = this.W / 2, y = this.H / 2): void {
  this.sfx('tap');
  const ring = this.add.graphics().setDepth(960);
  ring.lineStyle(7, THEME.gold, 0.9);
  ring.strokeCircle(0, 0, 22);
  ring.setPosition(x, y);
  this.tweens.add({
    targets: ring,
    scale: 2.1,
    alpha: 0,
    duration: 380,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  });
}
```

它接在四处最长的静默窗口上：

| 场景 | 窗口多长 | 接在哪 |
|---|---|---|
| `mark`（刻舟求剑） | 刻完一笔到出结果约 7.6 秒，捞空 9.4 秒 | `busy` 或非 `carve` 阶段；点空没刻到任何一个面也给一声 |
| `siege`（围魏救赵 / 釜底抽薪 / 关门捉贼 / 上屋抽梯） | 抽柴 900ms / 回防 620ms，每抽一根都会遇到 | `busy` 期间；正面 70ms 连点冷却里也只吞「多余的重复」 |
| `matchup`（李代桃僵 / 远交近攻） | 开赛后 7.5 秒 | `phase === 'racing'` |
| `tap`（盘古 / 愚公 / 精卫等） | 里程碑暂停期间 | `paused` 分支（以前是完全静默） |

配套还改了两处「亮着却无效」：`matchup` 的「重新编排」跑马途中以前可见、点下去有「嗒」一声却不做事，现在 `syncButtons` 把它在 `racing` 阶段收起；`story.nag()` 的 1.6 秒节流以前把 `sfx('tap')` 也一起吞了，现在只节流气泡。故事页是每次玩的第一个交互面（53 个游戏 × 2 幕）。账上还留着 `substitution` 的 500ms、`trace` 每段 1.5 秒 `busy`、`butcher` 推不到 80px、`split` 偏离绳带 190px —— 都是各模板自己的判定窗口，本次只给共享的 `tapAck` 兜底。

## 8.7 theme 与 cartoon：一致的观感从哪来

`theme.ts` 里有两份颜色：`THEME` 是给 Graphics 用的数字色（暖黑 `0x3a2f26` 描边、纸色底、红/青/金各带一个 `Deep` 变体），`CSS` 是给 Phaser 文字用的字符串色。**深色变体是有意为之的**：`CSS` 里的 `redDeep` / `tealDeep` / `goldDeep`（`#b03a31` / `#2c6b64` / `#8a5f10`）就是为此加的 —— 源码注释写得很清楚：红/纸 3.42:1、青/纸 3.48:1、金/卡 2.83:1 都过不了 WCAG AA，这三个分别是 5.44 / 5.61 / 5.42。

对比度不是美学问题：一次全仓审查发现曹冲称象的读数红字压水面只有 **1.48:1**，几乎看不见；答案 2.92:1、主按钮 3.42:1。修法是「换深色变体 + 垫底色」，读数垫卡片底后达到 12.5:1；完整清单在第 16 章。字体栈选 Noto Sans SC 并为各平台准备回退，`textStyle` 是唯一入口；儿童向字号下限 28 设计像素（约 16 CSS px @ 375 宽手机）。

美术策略是**零图片资源，全部几何绘制**，`cartoon.ts` 把绘制收敛成一套原语：

| 原语 | 作用 |
|---|---|
| `roundRect` / `circle` | 厚描边圆角矩形 / 圆（描边默认 `THEME.outline`、宽 6；radius 支持四角对象，如船底更圆） |
| `shade(color, factor)` | 同色系加深 / 提亮，做「厚度」与亮暗面 |
| `groundShadow` / `popIn` / `squash` | 落地阴影 / 淡入出场 / 挤压回弹（石头落船、大象上船的重量感） |
| `sparkleAt` | 星光爆点（成功反馈的固定语言） |
| `tapRipple` / `bounceArrow` | 指示「点这里」的连续涟漪 / 指示「往下拖」的浮动箭头 |
| `wavyBand` | 波浪水面（曹冲的江面由两层叠加画成） |
| `drawHand` / `createHand` | 引导用的小手（会轻轻点动） |

`tapRipple` 与 `bounceArrow` 是之后补进来的两个：前者让「不知道该点哪里」不必靠提示文字，后者专用于拖拽类模板。所有原语共用一套约定：`fillStyle` 填色 + `lineStyle` 粗描边，描边统一暖黑，不纯黑。美术到位后，替换的是**游戏包里的 `art.ts`**，模板与工具箱一行不改。

绘制分层也有约定：背景 1–2、世界静态 10、可交互物 20–30、拖拽中 70–90、特效与提示 700–960（`tapAck` 的涟漪在 960，高于提示气泡的 950）；持续动画用逐帧 `drawStage(g, metrics)`，不维护 Sprite 列表。`fadeIn()` 在 `ctx.reducedMotion` 开启时直接跳过，但「理解性动画」（水痕移动、太阳变暖）保留 —— 它们承载信息。

## 8.8 drag：按距离判定的拖拽控制器

`packages/phaser-kit/src/drag.ts` 不依赖 GameObject 的命中区域，而是「按下时抓住半径内最近的目标」（节选 `onDown`）：

```ts
const onDown = (pointer: Phaser.Input.Pointer): void => {
  if (active) return;
  let best: GrabTarget | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (target.enabled && !target.enabled()) continue;
    const dist = Math.hypot(pointer.x - target.obj.x, pointer.y - target.obj.y);
    if (dist <= target.radius && dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  }
  if (!best) return;
  active = {
    target: best,
    dx: pointer.x - best.obj.x,
    dy: pointer.y - best.obj.y,
    pointerId: pointer.id,
  };
  best.onGrab?.(best.obj);
};
```

`GrabTarget` 把「能不能抓」与「抓到 / 放下」交给调用方：`obj` / `radius` / `enabled?: () => boolean` / `onGrab?` / `onDrop?`；`onMove` / `onUp` 都带 `pointer.id !== active.pointerId` 的守卫（8.5）。设计要点：抓取半径普遍给得很大（光球 92、石头 `radius * 3`）；`enabled` 让「现在能不能拖」成为目标自己的事（大象在 `stage !== 'load'` 时不可拖）；拖动偏移 `dx/dy` 以**按下点**为基准，物体不会跳到手指中心；场景 `shutdown` 时 `drag.destroy()` 摘监听（模板统一走 `onShutdownCleanup`）。

模块头注释里那句「局部坐标约定与直觉不符」说的就是 8.4 那个 bug —— **同一件事的另一处症状**：拖拽的语义本来就是「抓最近的那个东西」，距离判定不是绕开 bug，而是更贴合交互；按钮的语义是「点在矩形里」，所以它必须回到命中区。

## 8.9 小结

- phaser-kit 把「引擎怎么起、按钮怎么画、点不中怎么办」收敛成小原语，模板与游戏只关心内容；
- **命中区必须按左上角原点给 `(0,0,w,h)`**：Phaser 的命中测试会再加一次 `displayOrigin`，写成 `(-w/2,-h/2,w,h)` 会让可点区整体偏移半个按钮，只剩左上四分之一能点中；
- `TOUCH_PAD = 12` 是「不用点得像素级准」的余量，不是补救按钮太小 —— 它必须小到不会把并排按钮粘在一起；开了多点触控就必须自己挑手指（`createGestureGuard` 与 `pointerId`）；`tapAck` 管「点中了但没反应」，`tapGuard` 管「反应过头（连点跳页）」。三件事合起来才叫输入可靠。

下一章进入平台层：存档、音频与运行环境适配 —— 讲清楚「游戏不碰环境」这条铁律背后的实现，以及静音、家长页、休息提醒是怎么接到同一个状态上的。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/others/CHAGS/第07章-玩法模板库详解/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/others/CHAGS/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/others/CHAGS/第09章-平台适配层与音频实现/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

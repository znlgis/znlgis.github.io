---
layout: default
title: 第01章 - BambooBuddy项目概述与设计理念
---

# 第01章 - BambooBuddy项目概述与设计理念

## 1.1 什么是 BambooBuddy

BambooBuddy（《熊猫宝宝的一天》，英文名 **Bamboo Buddy**，副标题 **A Panda's Day**）是一个面向 4–8 岁儿童的轻量日常生活养成游戏。孩子照顾一只叫「竹竹 / Bamboo」的卡通大熊猫，在刷牙、洗手、吃饭、穿衣、洗澡、睡觉、整理、运动、情绪、学习这十件小事里，一件一件地帮它做好。竹竹因此开心、长大，孩子因此愿意在家里模仿同一件事。

它不是课程软件，也不是数值养成手游。产品的核心指标只有一句：**孩子今天愿意把某个好习惯真的做一遍**。这句话直接决定了后面所有的技术取舍——没有失败、没有倒计时、没有体力、没有广告、没有账号，进度只存在本机。

名字这件事在代码里也有痕迹：中文界面里它叫「竹竹」，英文界面里叫「Bamboo」，但存档里的 `pet.name` 只有一份；界面标题是 `app.title` / `app.subtitle` 两个文案键，中英各一份值。角色名不做「可改名」功能——对 4–8 岁的孩子来说，一个稳定的名字比自定义更亲切，也省掉了一整类输入法与敏感词问题。

源码在 [https://github.com/znlgis/BambooBuddy](https://github.com/znlgis/BambooBuddy)，采用 MIT 许可协议；线上试玩在 [https://znlgis.github.io/bamboobuddy/](https://znlgis.github.io/bamboobuddy/)，手机浏览器打开即玩，构建产物用相对路径，可以直接放在任意子目录下。

### 核心循环的六个步骤

设计与实现之间最容易脱节的地方是「循环」。BambooBuddy 把循环写死成六步，每一步都有一个明确的代码落点，任何一个落点缺位都会让循环断掉：

1. 打开小屋，看到竹竹与五维状态（饱腹 / 精力 / 清洁 / 心情 / 健康）；
2. 按现实时间段推荐 4 件今日小事（早上 / 中午 / 晚上）；
3. 进入 30–90 秒的小游戏；
4. 完成后得到竹笋、星星、装扮碎片，偶尔得到一张贴纸；
5. 用竹笋与碎片解锁衣服和小窝物件，也可以把竹笋喂给竹竹；
6. 竹竹积累成长值，经历四个成长阶段，第四个阶段是「竹竹的小屋」与旅行日记。

| 步骤 | 玩家看到什么 | 代码落点 |
|---|---|---|
| 1 | 小屋、竹竹、五条状态条 | `apps/site/src/views/HomeView.vue`、`apps/site/src/components/RoomScene.vue`、`apps/site/src/components/PandaBuddy.vue`、`packages/progress/src/stats.ts` |
| 2 | 「今天想做的四件小事」 | `packages/progress/src/daily.ts`（日期 + 时段做种子） |
| 3 | 一个玩法全屏 | `apps/site/src/registry.ts` → `games/daily/src/games/<id>.ts` → `packages/templates/<id>.ts` |
| 4 | 竹笋 +n、碎片 +n、贴纸 | `packages/progress/src/rewards.ts`、`apps/site/src/views/PlayView.vue` 的 `finishTask()` |
| 5 | 装扮页与小窝 | `packages/progress/src/catalog.ts`、`apps/site/src/views/DressView.vue`、`packages/progress/src/manager.ts` 的 `feed()` |
| 6 | 阶段名与下一阶段进度 | `packages/progress/src/growth.ts`（0 / 60 / 160 / 300 成长值） |

六步之外还有一条不给孩子的线：**家长页**。它从标题的长按进入，展示最近七天的记录、本周练习过的习惯、声音开关与清档入口。这条线故意做得「不好点」——孩子不该在玩到一半时误入一个满是数字的表格，而家长需要能确认「今天到底做没做」。

这里有一个刻意的产品判断：**奖励不是终点，习惯才是**。所以第 4 步的奖励永远为正——重复玩同一天的任务只把奖励减半，最低仍有 1 根竹笋与 3 点成长值（`rewards.ts` 的 `completionReward()`）；第 6 步的成长线也不设失败，只设时间。

## 1.2 与 CHAGS 的关系：沿用什么，差异什么

BambooBuddy 的技术选型明确参考了同一位作者的另一个项目 CHAGS（历史典故游戏）。项目 README 第 7 节把两者的异同写成了清单，这里把它展开成可对照的表格：

| 维度 | CHAGS | BambooBuddy | 为什么改 |
|---|---|---|---|
| 内容单位 | 一个典故 | 一件日常小事 | 养成游戏的主题是「每天重复」，不是「读完一个故事」 |
| 玩法骨架 | 12 部典故，各有一个专属动词 | 8 个模板撑起 10 个任务 | 日常习惯的交互原语更少，`scrub` 一个模板就覆盖刷牙 / 洗手 / 洗澡 |
| 叙事 | 分幕绘本，听完故事再动手 | 语音与操作同时开始 | 4–8 岁的日常模仿需要即时反馈，等不起一段旁白 |
| 记忆机制 | 五层记忆 + 间隔重复复习 | 不做到期复习 | 核心指标是行为，不是知识；复习队列会让孩子觉得「又要考试」 |
| 进度表达 | 星星 + 典故卡 + 图鉴 | 五维状态 + 成长四阶段 + 装扮 + 贴纸 + 亲密度 | 养成游戏要让「照顾」有连续感 |
| 外壳页面 | 大厅 / 图鉴 / 游戏页 | 小屋 / 任务 / 装扮 / 日记 / 家长页 / 游戏页 | 家长页是儿童产品必须有的安全边界 |
| 双语 | 界面、内容、语音三层 | 同样三层，且英文是懒加载 chunk | 中文用户不该为英文付首屏体积 |
| 打包 | Tauri 2 + Capacitor 8 | 同一套 | 一份 `apps/site/dist` 喂两个壳，游戏代码零改动 |

**沿用的部分**（也是这个仓库最值钱的部分）：Phaser 4 + Vue 3.5 双栈、pnpm workspace 多包、内容 JSON + zod、`GameModule / GameContext` 契约、逻辑与渲染分离、`autoplay` / `instant` 调试开关、体积门禁、无后端、本地优先、儿童安全规范。

**主动不做的部分**，README 列得很干脆，值得在这里重复一遍，因为它保护的是「循环能不能跑通」：到期复习与间隔重复、账号 / 云存档 / 排行榜 / 多人 / 内购 / 广告 / CMS / PWA、抽卡与限定皮肤。装扮全部由游戏内奖励解锁——没有付费点，就没有「不买就落后」的焦虑。

一句话总结两者的关系：**CHAGS 证明「内容与代码分离 + 模板库」能撑起十几个小游戏；BambooBuddy 检验同一套结构在「日常重复」题材上是否依然成立。**

## 1.3 十个任务与八个模板

十个任务的全部身份信息都来自 `packages/content/src/tasks/<id>.json`。下面这张表的时段、时长、收益、奖励都是 JSON 里的真实取值，不是策划文案里的估计：

| 任务 | id | 模板 | 时段 | 单局 | 状态收益 | 奖励 |
|---|---|---|---|---|---|---|
| 刷牙 | `brush` | scrub | 早 / 晚 | 45 秒 | 清洁 +16、心情 +5 | 竹笋 2 / 成长 12 |
| 洗手 | `wash` | scrub | 早 / 中 / 晚 | 40 秒 | 清洁 +12、健康 +4 | 竹笋 2 / 成长 10 |
| 吃饭 | `feed` | feed | 早 / 中 / 晚 | 70 秒 | 饱腹 +22、健康 +6、心情 +4 | 竹笋 3 / 成长 14 |
| 穿衣 | `dress` | dress | 早 | 55 秒 | 心情 +9、健康 +3 | 竹笋 2 / 成长 12 |
| 洗澡 | `bath` | scrub | 晚 | 70 秒 | 清洁 +24、心情 +6 | 竹笋 3 / 成长 14 |
| 睡觉 | `sleep` | order | 晚 | 50 秒 | 精力 +26、健康 +6 | 竹笋 3 / 成长 14 |
| 整理 | `tidy` | tidy | 中 / 晚 | 60 秒 | 心情 +10、清洁 +5 | 竹笋 2 / 成长 12 |
| 运动 | `sport` | rhythm | 早 / 中 | 55 秒 | 健康 +12、心情 +7、精力 +5 | 竹笋 3 / 成长 13 |
| 情绪 | `emotion` | pick | 早 / 中 / 晚 | 45 秒 | 心情 +15、健康 +3 | 竹笋 2 / 成长 12 |
| 学习 | `learn` | learn | 早 / 中 | 50 秒 | 心情 +9、健康 +4 | 竹笋 2 / 成长 13 |

「单局 30–90 秒」不是口号：`packages/content/src/schema.ts` 里 `durationHintSec` 被约束在 20–120，十条内容都落在 40–70 秒；时段覆盖由 `content:check` 强制——早、中、晚每个时段至少要有 2 个任务可选，否则报错。

八个模板是交互原语的集合，模板只提供「怎么玩」，关卡 JSON 决定「这一局画什么、目标是什么」：

| 模板 | 交互原语 | 判定要点（`*.logic.ts`） | 用于 |
|---|---|---|---|
| `scrub` | 按住工具在目标区来回刷，刷干净后冲水 / 擦干 | 最近点位 + 半径命中、每点蹭够 `rubs` 次、`finishTaps` 次收尾 | 刷牙、洗手、洗澡 |
| `feed` | 把食物拖到竹竹嘴边，一口一口吃完 | 每口递减、总口数、`needKinds` 的类别均衡 | 吃饭 |
| `dress` | 把衣物拖到身上正确的部位 | 槽位匹配、全部穿上 | 穿衣 |
| `order` | 按顺序完成睡前步骤 | 当前步骤 id，点错不清进度 | 睡觉 |
| `tidy` | 按类别把玩具拖进对应的箱子 | 类别匹配、全部归位 | 整理 |
| `rhythm` | 竹竿开合，窗口内点按 | 墙钟三角波、`zone`、220ms 连点门 | 运动 |
| `pick` | 认出情绪，再做安慰动作 | 目标情绪、轮次推进 | 情绪 |
| `learn` | 颜色 / 形状 / 数字点选 | 答案下标、可无限重试 | 学习 |

同一个模板被三条内容复用时，差异全部由关卡数据承担，而不是复制三份代码。以 `scrub` 为例，场景只根据关卡里的 `tool` 与 `room` 选一套画法：

```ts
// packages/templates/src/scrub.ts（节选）
function pickVariant(level: ScrubLevel): Variant {
  if (level.tool === 'hands') return 'wash';
  return 'bath';
}
```

刷牙是「牙刷 + 牙齿区」，洗手是「双手 + 手部区」，洗澡是「海绵 + 身体区」——三份 JSON 的 `spots` 坐标、`rubs` 次数、`finishTaps` 都不同，但判定函数只有一份，单测也只测一份。这就是「8 个模板撑 10 个任务」的真实含义：**复用发生在交互原语层，差异化发生在数据层。**

模板 id 的唯一事实来源是 `packages/content/src/ids.ts` 的 `TEMPLATE_IDS`，`packages/templates/src/schemas.ts` 用 `satisfies Record<TemplateId, ZodType>` 约束——新增一个模板却忘了登记 schema，`pnpm typecheck` 当场报错；内容里写错模板名，则 `pnpm content:check` 在构建前拦下。

### 三款隐藏小游戏

十条任务之外还有一枚彩蛋：当天完成 **4 件不同**的小事后，小屋墙上会出现一扇小竹门，门后是「竹林游戏厅」——三款按 4–8 岁重做的街机小游戏，每天每款一次；另有隐藏触发「竹林小路」：在小屋里**连续点竹竹 7 次（5 秒内）**，当天小门直接打开、三款无限畅玩。

| 游戏 | 保留的核心乐趣 | 低龄化改造 | 不失败的处理 |
|---|---|---|---|
| 消灭星星 | 一按爆一片、下落补星、连消音调升高 | 8×10、4 色 + 花纹双通道 | 没有可消组时剩下的星星飞回天上并计入收集 |
| 弹一弹 | 瞄准 → 弹射 → 反弹 → 方块一串碎 | 任意位置拖拽瞄准、虚线 + 反弹点预测 | 每 6 发下沉一格；贴底时「开出小花」飞走，本轮算完成 |
| 俄罗斯方块 | 拼、消行、越堆越高 | 8×14、四个大按钮 + 2 个预览、不做 hold | 堆到顶变「彩虹」，清掉最下 4 行继续玩 |

它不在那十条任务里，也不复用 8 个模板：三款是实时街机（自己的帧循环、反弹物理、消行与 AI），硬套「内容 JSON + 模板 + 星星」会把模板层撑坏，还会把任务概念漏进彩蛋系统。所以它另起一套契约（`packages/game-kit/src/arcade.ts`）与一个独立的包（`games/arcade`），不发竹笋 / 成长值 / 贴纸、不写 `task:complete`，因此不污染任务经济、连续天数与家长页统计。规则的单测（75 条）同样跑在 Node 里。完整实现见第 17 章。

## 1.4 儿童向设计原则如何落进代码

写进 code review 的规范如果只停在文档里，三个月后就会消失。BambooBuddy 的做法是让每条原则都有一个能指认的代码位置：

| 原则 | 代码证据 |
|---|---|
| 无失败惩罚、无 0 星 | `rewards.ts` 的 `starsFor()`：失误 ≤1 给 3 颗、≤3 给 2 颗、其余 1 颗，**没有 0 颗** |
| 无倒计时、无扣命 | 契约里没有任何计时器字段；`task:retry` 只是观测事件，不改状态 |
| 可点区域 ≥88×88 逻辑像素 | `packages/templates/src/layout.ts` 的 `UI.minTap = 96`；`BaseScene.addButton` 默认高度 112 |
| 不靠颜色单独传达信息 | `packages/templates/src/tidy.ts` 的注释与实现：玩具颜色与箱子故意错开，逼孩子看形状 |
| 静音立即停语音 | `apps/site/src/stores/settings.ts` 的 `setMuted(true)` 会调用 `platform.audio.stopSpeech()` |
| 家长锁 | `apps/site/src/App.vue` 长按标题 3000ms 才进家长页，孩子点不到 |
| 20 分钟休息提醒 | `apps/site/src/stores/progress.ts` 的 `REST_SECONDS = 20 * 60`，一天只提醒一次 |
| 尊重减少动效 | `GameContext.reducedMotion` 来自 `matchMedia('(prefers-reduced-motion: reduce)')`，场景据此关掉闪光与补间 |
| 文案里不出现失败词汇 | `packages/templates/src/cli/check-content.ts` 对中英文各有一组禁词：失败 / 惩罚 / 笨蛋 / 输了 / 淘汰，以及 fail / stupid / loser / punish |
| 语音不阻塞操作 | 场景先 `speak(intro)` 再立即可交互；同一句话同时上屏（`BaseScene.say()`），听不见的孩子也能读 |

星星口径值得单独看一眼，因为它是「不惩罚」最容易被破坏的地方：

```ts
// packages/progress/src/rewards.ts
/**
 * 星星是"这一局玩得怎么样"的正向反馈，不是评分羞辱：
 * 几乎不失误 3 颗，偶尔重来 2 颗，重来很多次 1 颗 —— **没有 0 颗**。
 */
export function starsFor(mistakes: number): Stars {
  if (mistakes <= 1) return 3;
  if (mistakes <= 3) return 2;
  return 1;
}
```

家长锁的实现同样只有十几行，但三个细节缺一不可：按下开始计时、抬起 / 离开 / 取消都要清掉计时器、长按触发后浏览器补的那一次 `click` 不能把小屋又盖回去：

```ts
// apps/site/src/App.vue（节选）
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
  if (holdFired) {
    holdFired = false;
    return;
  }
  navigate('/');
}
```

还有一个常被忽略的点：**孩子看得见的失败提示，往往是从存档写入失败开始的**。所以 `apps/site/src/stores/progress.ts` 把写盘失败显式建模成 `unsaved` 状态，小屋顶部会出现一句「这次可能没存上」，而不是静默丢进度。

## 1.5 技术选型速览

| 决策项 | 选型 | 一句话理由 |
|---|---|---|
| 游戏引擎 | Phaser 4.2.1（裁剪版 vendor） | 纯代码、可 diff、可单测；只在玩法 chunk 里出现 |
| 应用外壳 | Vue 3.5.44 SFC + Pinia 4 + Tailwind 4 | 小屋 / 任务 / 装扮 / 日记是 UI 密集型，改一页只动一个文件 |
| 语言 | TypeScript ~5.9.3（strict） | 与 vue-tsc 3.3 兼容（TS 7 会崩，见第 2 章） |
| 构建 | Vite 8.3.4 + pnpm 11.22 workspace | 每个玩法自动独立 chunk，Phaser 单独成 chunk |
| 内容 | JSON + zod 4，构建期校验 | 换一条任务 = 换内容；中英各一份补丁 |
| 存储 | IndexedDB（本地优先）+ 可替换接口 | 无后端、无账号，儿童隐私最安全 |
| 音频 | WebAudio 合成 + 浏览器 TTS | 零音频文件先把「听」通道跑通 |
| 测试 | Vitest 5 + vue-tsc + Playwright 1.64 + 内容校验 + 体积门禁 | 一条 `pnpm verify` 定义「完成」 |
| 打包 | Tauri 2（EXE）+ Capacitor 8（APK） | 同一份 `apps/site/dist` 喂两个壳 |
| 后端 | 完全不做 | 纯静态站点；家长报告只读本机存档 |

引擎这一行值得多解释一句：`vite.config.ts` 里有一条 `resolve.alias`，把裸 `phaser` 导入替换成 `packages/phaser-kit/vendor/phaser-trim.esm.js`。这不是「用了另一个引擎」，而是把完整包里对十个日常玩法毫无用处的 physics / tilemaps / sound / animations 裁掉；TypeScript 的类型仍然解析到 npm 的 phaser 包，所以 `typecheck` 与自动补全完全不受影响。裁剪的细节与风险在第 8 章。

选型表里最不像「决策」的一项其实是零美术资源：所有角色、房间、食物、衣服、玩具都是 Phaser Graphics 与 SVG 几何绘制，音效由 WebAudio 振荡器合成，旁白交给浏览器 TTS。代价是观感朴素，收益是首屏的非代码资源为 0 KB、没有版权风险、每一笔改动都能 diff。将来换成真实美术时，游戏代码不需要动——角色绘制集中在 `packages/phaser-kit/src/panda.ts` 与外壳的 `PandaBuddy.vue`，音频只换 `platform` 的 `AudioBus` 实现。

三条架构铁律与 CHAGS 完全一致，后面的章节会反复回到它们：

1. **逻辑与渲染分离**：规则写在 `*.logic.ts` 与 `packages/progress`，不 import Phaser，可以脱离浏览器单测；ESLint 还禁止这两处使用 `Math.random` 与 `Date.now`。
2. **游戏不得自己碰环境**：存档、音频、生命周期一律通过注入的 `PlatformServices`；游戏代码里出现 `localStorage` 就是 bug。
3. **每个玩法必须能被无头直达**：`#/play/<id>?autoplay=1` 自动通关、`?instant=1` 跳过过场，否则端到端测试与 AI 协作都无从谈起。

## 1.6 仓库结构总览

```text
BambooBuddy/
├─ apps/
│  ├─ site/                 # Vue 3.5 外壳：小屋 / 任务 / 装扮 / 日记 / 家长页 / 玩法宿主 / 小游戏宿主
│  ├─ desktop/              # Tauri 2 桌面壳（便携 exe）
│  └─ mobile/               # Capacitor 8 安卓壳（apk，android 工程已入库）
├─ packages/
│  ├─ game-kit/             # 契约：GameModule / GameContext / ArcadeModule / 事件 / SaveData（无 Phaser）
│  ├─ content/              # 10 条摘要 JSON + 10 份详情 JSON + loadTask() 动态加载
│  ├─ i18n/                 # 界面文案表（键是联合类型，写错编译期报）
│  ├─ progress/             # 纯 TS：推荐、状态、奖励、成长、连续天数、亲密度、存档迁移
│  ├─ platform/             # Web 实现：IndexedDB / 合成音效 / TTS / 生命周期 / telemetry
│  ├─ phaser-kit/           # 主题、绘制、竹竹、拖拽、BaseScene、Phaser 裁剪版
│  └─ templates/            # 8 个模板：*.logic.ts（判定）+ *.ts（场景）+ 关卡 schema
├─ games/daily/             # 10 个玩法入口（一个任务 = 一个动态 import 的子路径）
├─ games/arcade/            # 3 款隐藏小游戏：popstar / bounce / tetris（逻辑 + 场景 + 入口）
├─ e2e/                     # Playwright：冒烟、真实操作、家长页、双语、彩蛋、生产产物
├─ scripts/                 # verify / 体积门禁 / 图标 / APK / keystore / 打包体检
└─ docs/                    # 技术方案、隐藏小游戏方案、打包与分发
```

内容被刻意拆成两半：`packages/content/src/tasks/<id>.json` 是摘要（标题、emoji、颜色、时段、模板、收益、奖励、习惯、日记一行、提示），小屋 / 任务 / 装扮 / 日记四个页面只读它；`packages/content/src/details/<id>.game.json` 是详情（intro / done / retry 语音文案 + 关卡脚本），只有进入那个玩法时才由 `loadTask()` 动态 import。这条拆分是首屏能压在 58.9 KB 的直接原因，也是 ESLint 要禁止外壳 import `@bamboo/content/full` 的原因。

依赖方向是这个结构的关键：`game-kit` 与 `content` 不 import Phaser，所以外壳可以安全地直接引用它们；Phaser 只出现在 `games/*`、`packages/templates` 与 `packages/phaser-kit` 里；外壳甚至连 `@bamboo/templates` 都不在依赖列表里（第 2 章会给出完整的包依赖图）。这条边界带来的直接结果是：**首屏永远不会下载那 876 KB 的引擎**。

## 1.7 当前验收与产物现状

以下数字都是 2026-10-20 在本机实测的基线，也是后续章节反复引用的对照值：

| 项目 | 实测值 |
|---|---|
| 单元测试 | 167 个（Vitest，Node 环境；9 个测试文件，其中 75 个属于隐藏小游戏） |
| 端到端 | 29 passed / 2 skipped / 0 failed（共 31 条，Playwright，Pixel 5 模拟） |
| 生产产物懒加载 | `pnpm e2e:dist` 2 passed（首屏不下载任何重 chunk） |
| `pnpm verify` | 七阶段全绿：typecheck / lint / test / content:check / pack:check / build / size |
| dist 体积 | 53 个文件 / 1,313,452 B（约 1.28 MB） |
| 首屏 JS + CSS | gzip 58.9 KB（原始 172.5 KB，预算 60 KB） |
| Phaser 裁剪版 | 876,874 B（gzip 220.6 KB），只在第一次进玩法 / 小游戏时下载 |
| Windows 便携 exe | 3.27 MB（Tauri 2，系统 WebView2） |
| 安卓 apk | 4.69 MB（Capacitor 8，debug 签名） |
| 非代码资源 | 0（全部几何绘制 + WebAudio 合成） |

验收这条线有一条不成文的规矩：**数字要能被复现**。所以第 14 章会把这里的每一项都对应到具体的脚本与断言——167 个单测来自哪些 `*.test.ts`、31 条端到端分别覆盖什么、体积的 58.9 KB 是怎么算出来的（首屏 = `index.html` 实际引用含 `modulepreload` + 内联脚本，不是「所有 js 加起来」）。没有对应的断言，数字就只是上一次跑出来的巧合。

两个跳过项不是失败：`preview.spec.ts` 是生产产物用例，只在 `pnpm e2e:dist`（端口 5191）下运行，在开发配置（端口 5190）里按设计跳过。

打包与发布同样有实测记录：GitHub Actions 的 Release 工作流在推 `v*` tag 时构建两个平台并挂到 Release，也可以手动 Run workflow 只出产物。产物都是「一份站点 + 一个壳」——Tauri 走系统 WebView2，Capacitor 走内置本地服务 `https://localhost`，所以 ES module、IndexedDB、WebGL 全部按浏览器标准工作，游戏代码不知道自己在哪个壳里跑。

体积这一项值得单独强调，因为它决定了很多写法。首屏 58.9 KB 意味着：不能为了省事把 zod 拖进外壳（`@bamboo/content` 主入口刻意不导出 schema 的运行时对象），不能让英文文案静态进主包，也不能让任何一句 `import '@bamboo/content/full'` 混进 `apps/site/src`——ESLint 直接禁止最后这条。

## 1.8 本教程的章节安排

全书 17 章，按「先跑起来、再拆结构、最后做交付」的顺序组织：

- **第 1–3 章（认识与跑起来）**：项目概述与设计理念、技术栈与工程结构、环境准备与快速开始；
- **第 4–8 章（架构主干）**：核心契约与游戏生命周期、Vue 应用外壳、内容数据模型与任务 JSON、玩法模板库、Phaser 渲染工具箱；
- **第 9–12 章（能力层）**：平台适配层与音频、进度系统与日常任务、亲密互动 / 装扮 / 日记 / 家长页、中英双语；
- **第 13–17 章（实战与交付）**：开发一个新的日常任务、测试体系与质量门禁、构建打包与分发、踩坑记录与常见问题、隐藏小游戏与竹林小路。

章节之间尽量低耦合：想改玩法可以直接读第 7 章，想加内容直接读第 6 章与第 13 章。但第 4 章的契约是所有后续内容的地基，建议不要跳过。

## 1.9 阅读本章之后应该记住的三件事

1. **产品定位是技术约束的来源**：无失败、无倒计时、零外部资源、本地存档，不是「顺手做的好事」，而是「一个任务一个小游戏」这个形态能成立的前提；
2. **模板库复用交互原语，不复用关卡**：8 个模板撑 10 个任务，靠的是 `*.logic.ts` 与关卡 JSON 的分工；
3. **验收是一串可复现的数字**：167 个单测、31 条端到端、58.9 KB 首屏、1.28 MB 产物，每一项背后都有一个脚本，而不是一次人工检查。

下一章把视角拉近一层：这套东西到底由哪些包组成、版本为什么锁在这些数字上、Vite 配置里那几条 `chunkFileNames` 规则各自解决什么问题。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <span></span>
  <a href="https://znlgis.github.io/others/BambooBuddy/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/others/BambooBuddy/第02章-技术栈与工程结构/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->
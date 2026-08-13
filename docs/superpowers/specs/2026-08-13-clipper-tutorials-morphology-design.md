# Clipper1/Clipper2 教程形态学内容优化设计

- 日期：2026-08-13
- 状态：已获用户批准（方案 B：就地优化，不动目录结构）
- 依据仓库：https://github.com/znlgis/Clipper1 、https://github.com/AngusJohnson/Clipper2

## 背景与目标

站点在 `cad/`（使用教程）与 `sci/`（源码解读）下各有 Clipper1、Clipper2 两个系列。现有教程对形态学（膨胀/腐蚀/开运算/闭运算）覆盖零散且存在错误。本任务依据两个 GitHub 仓库的最新状态，优化完善形态学相关内容，修正错误，保持各系列既有文风与目录结构。

## 核心正确性事实（全篇统一的数学基础）

1. **腐蚀 ≠ 闵可夫斯基差**。闵可夫斯基差 `A ⊖ B = A ⊕ (−B)` 用于碰撞检测；形态学腐蚀定义为 `A ⊖ B = {x : x + B ⊆ A}`，实现走补集法：`A ⊖ B = (Aᶜ ⊕ Bʳ)ᶜ`，其中 Bʳ 为 B 关于原点的反射，Aᶜ 为 A 在足够大包围盒内的补集。B 关于原点对称时 Bʳ = B。
2. **偏移即特殊形态学**。`JoinType.Round` 偏移对应圆盘结构元素，`JoinType.Square` 对应方形结构元素；Clipper2 的 `InflatePaths`/`DeflatePaths` 是偏移的简化 API。
3. 形态学组合：开运算 = 先腐蚀后膨胀；闭运算 = 先膨胀后腐蚀；形态学梯度 = 膨胀 − 腐蚀（布尔差集）。
4. Clipper1（ClipperLib）**没有** `MinkowskiSum` API——该方法是 Clipper2 的静态方法；Clipper1 教程中出现 `Clipper.MinkowskiSum(...)` 属于错误示例。

## 已知错误清单（必须修复）

| 位置 | 问题 |
|---|---|
| sci/Clipper2 第18章 18.6.3 | Erode 用 `MinkowskiDiff` 实现，数学上错误；且实现残缺（注释"需要更复杂的处理"） |
| sci/Clipper1 第19章 19.4.2 | 使用 `Clipper.MinkowskiSum(circle, shape, true)`，Clipper1 无此 API |
| cad/Clipper2 第05章 5.3.7 | 标题为 C# 版但代码为 C++（`std::vector`、`const auto&`、`std::cout`） |
| 各系列 | 形态学内容零散，未形成"膨胀/腐蚀/开/闭/梯度"完整框架 |

## 各文件改动明细

### cad/Clipper1（教程，6 章）

- **第04章-多边形偏移操作.md**：新增形态学小节（编号顺延插入）：膨胀/腐蚀（正负偏移）、开运算、闭运算、形态学梯度（差集）、结构元素选择（jtRound=圆盘、jtSquare=方形）、应用（小图斑剔除、窄桥断开、凹口填充、地图综合）。
- **第06章-实际应用案例与最佳实践.md**：应用案例处轻量交叉引用形态学小节。
- **第01章-Clipper1概述与安装.md**：补充 GitHub 仓库 znlgis/Clipper1 信息（SourceForge 镜像、含 Documentation 与 Clipper2 beta 目录）。

### cad/Clipper2（教程，6 章）

- **第04章-多边形偏移操作.md**：新增形态学小节（InflatePaths/DeflatePaths + SimplifyPaths 迭代；可引用官方 README 兔子收缩示例）。
- **第05章-矩形裁剪与闵可夫斯基操作.md**：修复 5.3.7 C++/C# 混用（统一为 C#）；将"形态学膨胀"扩充为完整小节：膨胀 = MinkowskiSum；腐蚀 = 补集法（附完整可运行 C# 实现，含取补集辅助函数）；开/闭运算；任意结构元素。
- **第01章-Clipper2概述与安装.md**：补充官方 README 的三角剖分 bug 警告（一句话）。

### sci/Clipper1（源码解读，20 章）

- **第17章-ClipperOffset详解.md**：新增小节：JoinType ↔ 结构元素对应关系（源码角度）。
- **第19章-辅助函数与工具.md**：修复 19.4.2 错误 API（改为手动闵可夫斯基和实现说明，或明确标注为 Clipper2 特性）；加入补集法腐蚀辅助函数示例。
- **第20章-实际应用与最佳实践.md**：20.4.2 "先膨胀后收缩"标注为闭运算并扩充；新增形态学应用小节（开闭运算、梯度、地图综合）。

### sci/Clipper2（源码解读，20 章）

- **第16章-ClipperOffset偏移类详解.md**：新增小节：JoinType ↔ 结构元素 + InflatePaths/DeflatePaths 简化 API 说明。
- **第18章-Minkowski和与差.md**：修复 18.6.3 错误 Erode；18.6.3 扩充为完整形态学小节（补集法腐蚀完整实现、开闭运算、梯度、结构元素对称性简化）。
- **第20章-实际应用与最佳实践.md**：20.6.5 处交叉引用形态学小节。

### 不改动

- 不新增/删除章节文件，不动各系列 index.md 与 _data/navigation.yml 的目录结构。
- 不改动与形态学无关的章节内容。

## 写作规范

- 匹配各系列现有文风：cad 教程 = 概念 + 代码 + 练习/小结；sci 解读 = 源码逐行 + 算法分析 + 注意事项。
- 新增代码全部为可运行 C#：sci/Clipper1 用 ClipperLib API；其余用 Clipper2Lib。
- 形态学小节统一结构：数学定义 → Clipper 实现 → 完整示例 → 应用场景 → 注意事项（自交、路径方向、缩放因子、结构元素选择）。
- 实现前核对 Clipper2 仓库 CSharp 源码中 `InflatePaths`、`MinkowskiSum`、`MinkowskiDiff`、`PointInPolygon` 等当前签名，保证教程与现仓库一致。

## 验证

1. 新增 C# 示例逐一与仓库源码核对 API 签名。
2. grep 检查无残留错误写法（用 MinkowskiDiff 实现腐蚀）。
3. Jekyll 构建（`bundle exec jekyll build`）无错误；markdown 语法检查通过。
4. 章节内小节编号连续，无重复/缺号。

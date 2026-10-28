---
layout: default
title: 历史典故游戏（CHAGS）教程目录
---

# CHAGS 历史典故游戏使用与开发教程目录

本教程结合开源仓库 [znlgis/CHAGS](https://github.com/znlgis/CHAGS)，剖析这款「一个典故一个小游戏」的历史典故游戏合集的技术实现。教程从项目定位与技术选型出发，系统讲解五层架构（外壳 / 游戏包 / 契约 / 模板 / 平台），逐步深入到核心契约、Vue 应用外壳、内容数据模型、玩法模板库、Phaser 渲染工具箱、平台适配层、进度存档与复习调度、中英双语实现，再通过「从零开发一个新典故」的完整实战与测试、打包、分发流程融会贯通，最后以适龄设计规范、踩坑记录与常见问题收尾。每章内容详尽，配有大量 TypeScript 代码示例，适合对 Phaser / Vue 游戏开发、教育类产品与工程化实践感兴趣的读者。

> 🎮 **在线试玩**：[历史典故游戏](https://znlgis.github.io/chags/) —— 53 个小游戏（17 个典故 + 三十六计全 36 计），手机 / 平板浏览器打开即玩，无需安装，中英文一键切换。

## 合集现状（2026-10-28）

| 项目 | 现状 |
|---|---|
| 游戏数 | **53** = 17 个典故 + 三十六计 1–36 计 |
| 分组 | **2 组**：典故 `allusion`（按年代排）、三十六计 `stratagem`（按计策序号排） |
| 玩法模板 | 24 个可玩场景工厂 + 每个游戏共用的 `story` / `reward` 场景，模板 id 共 **26** 个（唯一定义在 `packages/content/src/schema.ts` 的 `TEMPLATE_IDS`） |
| 进度与复习 | 本机存档（IndexedDB）+ **到期复习**：1 / 3 / 7 / 21 / 60 天间隔，评级不动星星 |
| 质量门禁 | 单测 1229 项；端到端约 98 条（其中 31 条带 `@real` 标签的真实指针 / 适龄体验用例进发版门禁）；`pnpm verify` 六步门禁 + 七项体积预算 |
| 体积 | 首屏 54.1 KB gzip / 146.1 KB 原始；点开一局的全部新增流量 ≈226 KB gzip |

## 章节

- [第01章：CHAGS项目概述与设计理念](https://znlgis.github.io/others/CHAGS/第01章-CHAGS项目概述与设计理念/)
- [第02章：技术栈与工程结构](https://znlgis.github.io/others/CHAGS/第02章-技术栈与工程结构/)
- [第03章：环境准备与快速开始](https://znlgis.github.io/others/CHAGS/第03章-环境准备与快速开始/)
- [第04章：核心契约与游戏生命周期](https://znlgis.github.io/others/CHAGS/第04章-核心契约与游戏生命周期/)
- [第05章：Vue应用外壳详解](https://znlgis.github.io/others/CHAGS/第05章-Vue应用外壳详解/)
- [第06章：内容数据模型与典故JSON](https://znlgis.github.io/others/CHAGS/第06章-内容数据模型与典故JSON/)
- [第07章：玩法模板库详解](https://znlgis.github.io/others/CHAGS/第07章-玩法模板库详解/)
- [第08章：Phaser渲染工具箱](https://znlgis.github.io/others/CHAGS/第08章-Phaser渲染工具箱/)
- [第09章：平台适配层与音频实现](https://znlgis.github.io/others/CHAGS/第09章-平台适配层与音频实现/)
- [第10章：进度存档与复习调度](https://znlgis.github.io/others/CHAGS/第10章-进度存档与复习调度/)
- [第11章：中英双语实现](https://znlgis.github.io/others/CHAGS/第11章-中英双语实现/)
- [第12章：实战：开发一个新的典故](https://znlgis.github.io/others/CHAGS/第12章-实战-开发一个新的典故/)
- [第13章：测试体系与质量门禁](https://znlgis.github.io/others/CHAGS/第13章-测试体系与质量门禁/)
- [第14章：构建、打包与分发](https://znlgis.github.io/others/CHAGS/第14章-构建、打包与分发/)
- [第15章：适龄设计规范与实现](https://znlgis.github.io/others/CHAGS/第15章-适龄设计规范与实现/)
- [第16章：踩坑记录与常见问题](https://znlgis.github.io/others/CHAGS/第16章-踩坑记录与常见问题/)

---

共 16 章

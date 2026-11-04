---
layout: default
title: 数思工坊（Math Mind Forge）教程目录
---

# 数思工坊（Math Mind Forge）教程目录

本教程结合开源仓库 [znlgis/mathmindforge](https://github.com/znlgis/mathmindforge)（MIT 许可），剖析《数思工坊》这款面向 5–18 岁的「数学思维工具使用场」的完整实现。它不是刷题应用：玩家要调用模式卡、规则卡、构造块、参数旋钮、数据采集器、反例探测器六件工具，构造出满足约束的结构、规则、模型或论证才能通关；通关不靠「答对题」，靠工具产物、约束满足与证据链。

教程从项目定位与技术选型出发，讲清动作驱动运行时、Vue 应用外壳、内容数据模型、六个关卡模板、Phaser 画布与无画布工具台（ToolDock）双视图、证据画像、思维日志与家长报告、存档与双语，再以「从零开发一个新关卡」的完整实战贯通，最后以测试门禁、构建发布与踩坑记录收尾。每章配有取自仓库的真实 TypeScript / Vue 代码，适合对教育类产品、Phaser / Vue 游戏开发与前端工程化感兴趣的读者。

> 🎮 **在线试玩**：[数思工坊 Math Mind Forge](https://znlgis.github.io/mathmindforge/) —— 20 关 / 6 个模板 / 6 件工具全部可玩，手机 / 平板浏览器打开即玩，无需安装，中英文一键切换，进度只存本机。

## 项目现状（v1.0.0-rc.1，2026-11）

| 项目 | 现状 |
|---|---|
| 关卡 | **20 关**全部可玩，覆盖 K–高中 5 个学段 × 结构 / 算法 / 建模 / 数据 4 条主线 |
| 模板 | **6** 个：pattern / rule / construct / simulate / experiment / argue |
| 工具 | **6** 件：pattern / rule / construct / knob / probe / counter（另有 argue 模板的论证板） |
| 叙事层 | 证据 → 四维画像 → 9 枚徽章 → 思维日志 / 轨迹 → 家长 / 教师报告，已闭环 |
| 质量门禁 | 单测 **369** 条（25 个文件）；e2e **90** 条（6 个文件）；`pnpm verify` 一条命令跑完 typecheck / lint / test / content:check / audit:levels / pack:check / build / size |
| 体积 | 首屏 JS+CSS **69.5 KB** gzip；dist 共 61 个文件 / 1518.9 KB；Phaser chunk 220.3 KB gzip |
| 技术栈 | Vue 3.5.44 + Pinia 4.0.3 + Vite 8.3.4 + TypeScript 5.9.3（strict）+ Phaser 4.2.1（裁剪版）+ Vitest 5 + Playwright 1.64 + pnpm 11.22 workspace |

## 教程目录

- [第01章 - 数思工坊项目概述与设计理念](https://znlgis.github.io/others/MathMindForge/第01章-数思工坊项目概述与设计理念/)
- [第02章 - 技术栈与工程结构](https://znlgis.github.io/others/MathMindForge/第02章-技术栈与工程结构/)
- [第03章 - 环境准备与快速开始](https://znlgis.github.io/others/MathMindForge/第03章-环境准备与快速开始/)
- [第04章 - 核心契约-动作驱动运行时](https://znlgis.github.io/others/MathMindForge/第04章-核心契约-动作驱动运行时/)
- [第05章 - Vue应用外壳与路由](https://znlgis.github.io/others/MathMindForge/第05章-Vue应用外壳与路由/)
- [第06章 - 内容数据模型与双语JSON](https://znlgis.github.io/others/MathMindForge/第06章-内容数据模型与双语JSON/)
- [第07章 - 六件思维工具与工具台](https://znlgis.github.io/others/MathMindForge/第07章-六件思维工具与工具台/)
- [第08章 - 六个模板总览与pattern](https://znlgis.github.io/others/MathMindForge/第08章-六个模板总览与pattern/)
- [第09章 - rule模板-程序化规则](https://znlgis.github.io/others/MathMindForge/第09章-rule模板-程序化规则/)
- [第10章 - construct模板-构造与优化](https://znlgis.github.io/others/MathMindForge/第10章-construct模板-构造与优化/)
- [第11章 - experiment模板-数据与实验](https://znlgis.github.io/others/MathMindForge/第11章-experiment模板-数据与实验/)
- [第12章 - simulate与argue模板](https://znlgis.github.io/others/MathMindForge/第12章-simulate与argue模板/)
- [第13章 - 画布系统与双视图](https://znlgis.github.io/others/MathMindForge/第13章-画布系统与双视图/)
- [第14章 - 证据画像与徽章](https://znlgis.github.io/others/MathMindForge/第14章-证据画像与徽章/)
- [第15章 - 思维日志-轨迹与家长报告](https://znlgis.github.io/others/MathMindForge/第15章-思维日志-轨迹与家长报告/)
- [第16章 - 存档-进度与报告导入导出](https://znlgis.github.io/others/MathMindForge/第16章-存档-进度与报告导入导出/)
- [第17章 - 实战-从零开发一个新关卡](https://znlgis.github.io/others/MathMindForge/第17章-实战-从零开发一个新关卡/)
- [第18章 - 测试体系与质量门禁](https://znlgis.github.io/others/MathMindForge/第18章-测试体系与质量门禁/)
- [第19章 - 构建打包与发布](https://znlgis.github.io/others/MathMindForge/第19章-构建打包与发布/)
- [第20章 - 踩坑记录与常见问题](https://znlgis.github.io/others/MathMindForge/第20章-踩坑记录与常见问题/)

---

共 20 章

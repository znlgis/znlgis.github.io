---
layout: default
title: 第01章：SuperSplat项目全景与学习路线
---

# 第01章：SuperSplat 项目全景与学习路线

## 1. SuperSplat 是什么

SuperSplat（仓库名 `playcanvas/supersplat`，正式名称 **SuperSplat Editor**）是由 [PlayCanvas](https://playcanvas.com/) 团队开发并维护的一款**免费、开源、运行于浏览器**的 3D 高斯泼溅（3D Gaussian Splatting，简称 3DGS）编辑器。它用于对高斯泼溅模型进行**检查（inspect）、编辑（edit）、优化（optimize）和发布（publish）**。

与传统三维软件不同，SuperSplat 完全基于 Web 技术构建，无需下载安装，打开浏览器即可使用。官方在线版本地址为：

- 编辑器：<https://superspl.at/editor>
- 用户手册：<https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/>

它采用 **MIT 许可证**，源码完全公开，任何人都可以阅读、修改、二次开发并部署自己的版本。这使它既是一款实用工具，也是学习 3DGS 工程实现与 WebGL/WebGPU 渲染的优秀范本。

> 一句话定位：SuperSplat 是“3D 高斯泼溅领域的 Photoshop + 发布平台”，但它是开源的、跑在浏览器里的，并且代码结构清晰、值得逐行研究。

## 2. 为什么要学习 SuperSplat

3D 高斯泼溅是 2023 年由 Inria 提出的辐射场（Radiance Field）新型表达方法（论文《3D Gaussian Splatting for Real-Time Radiance Field Rendering》），相比 NeRF，它具备**实时渲染、训练快、画质高**的优势，迅速成为三维重建、数字孪生、文物数字化、虚拟现实、电商展示等领域的热点技术。

然而 3DGS 训练（如 COLMAP + gaussian-splatting / Postshot / Nerfstudio）产出的原始 `.ply` 文件往往存在以下问题：

- 包含大量背景噪点、漂浮物（floaters）；
- 文件体积巨大（动辄数百 MB 到数 GB），不利于 Web 传输；
- 坐标系、朝向、比例不规范，难以直接集成到应用中；
- 缺乏裁剪、清理、动画、发布等后期处理能力。

SuperSplat 正是为了解决“训练之后、上线之前”这一关键环节而生。学习它可以让你：

1. **掌握 3DGS 后期处理全流程**：从加载、清理、裁剪、变换到优化压缩与发布；
2. **理解高斯泼溅的数据结构**：PLY 属性、球谐系数、压缩格式等；
3. **学习现代 Web 3D 工程**：基于 PlayCanvas 引擎、TypeScript、事件驱动架构、Rollup 构建的真实项目；
4. **具备二次开发能力**：为团队定制专属的高斯泼溅工具链或在线产品。

## 3. 核心功能总览

根据官方文档与源码，SuperSplat 当前主要功能可归纳为以下几类：

| 功能类别 | 说明 |
|----------|------|
| 模型加载 | 支持拖拽或打开 `.ply`、压缩 `.ply`、`.splat`、`.sog`/`.json` 等高斯泼溅格式，以及 PLY 序列动画 |
| 视图浏览 | 轨道相机、飞行模式、视图立方体（View Cube）、对焦、相机姿态保存 |
| 选择工具 | 矩形、套索、多边形、画笔、球体、洪水填充（Flood）、滴管（Eyedropper）等多种选区方式 |
| 数据编辑 | 隐藏/显示、删除、反选、按属性筛选（位置、不透明度、球谐、缩放）、直方图筛选 |
| 变换操作 | 平移、旋转、缩放高斯点或整个模型，支持 Gizmo 与数值面板 |
| 颜色调整 | 亮度、对比度、饱和度、色调、黑白点、球谐光照编辑 |
| 场景管理 | 多模型管理、合并、模型列表、包围盒尺寸显示 |
| 相机动画 | 关键帧时间轴、相机姿态动画、平滑插值、动画导出 |
| 导出发布 | 导出多种格式、压缩优化、导出图片/视频、一键发布到 PlayCanvas 平台获得在线可分享链接 |
| 国际化 | 基于 i18next 的多语言支持（含简体中文） |
| 渐进式应用 | 提供 PWA 与 Service Worker，可离线使用 |

## 4. 技术栈与依赖

从 `package.json` 可以看到 SuperSplat 的关键技术选型：

- **语言**：TypeScript（`typescript`），全量类型化；
- **渲染引擎**：[PlayCanvas](https://github.com/playcanvas/engine)（`playcanvas`），负责 WebGL/WebGPU 渲染、高斯泼溅排序与绘制；
- **UI 组件库**：`@playcanvas/pcui`（PlayCanvas 的 UI 框架），构建面板、按钮、滑块等；
- **数据处理**：`@playcanvas/splat-transform`，提供高斯泼溅格式读写、转换、压缩（WebP/SOG 等）能力；
- **构建工具**：[Rollup](https://rollupjs.org/)（`rollup`）+ 多个插件（typescript、node-resolve、scss、terser、json、image 等）；
- **样式**：SCSS（`sass`、`rollup-plugin-scss`）；
- **国际化**：`i18next` 系列（`i18next`、`i18next-browser-languagedetector`、`i18next-http-backend`）；
- **媒体编码**：`mediabunny`（用于视频导出）；
- **代码规范**：ESLint（`@playcanvas/eslint-config`、`@typescript-eslint`）；
- **运行环境**：Node.js ≥ 20.19.0（开发构建），浏览器需支持 WebGL2/WebGPU。

`package.json` 中的关键脚本：

```json
{
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c -w",
    "serve": "serve dist -C",
    "develop": "cross-env BUILD_TYPE=debug concurrently --kill-others \"npm run watch\" \"npm run serve\"",
    "lint": "eslint src"
  }
}
```

## 5. 源码目录结构鸟瞰

仓库的核心代码位于 `src/` 目录下，按职责组织（部分关键文件）：

```text
src/
├── main.ts                  # 应用入口：创建引擎、注册各模块事件、初始化 UI
├── editor.ts                # 编辑器核心事件注册（选择、隐藏、删除、重置等）
├── events.ts                # 事件总线（继承 PlayCanvas EventHandler，扩展 function/invoke）
├── scene.ts                 # 场景：管理所有 Element（高斯模型、相机、网格等）
├── scene-config.ts          # 场景配置（背景、相机、网格、色调等默认值）
├── element.ts               # 场景元素基类与类型枚举
├── splat.ts                 # 高斯模型元素（封装 PlayCanvas GSplat）
├── splat-state.ts           # 每个高斯点的状态位（selected / hidden / deleted）
├── splat-serialize.ts       # 序列化/导出：PLY、压缩 PLY、splat、CSV、SOG 等
├── sh-utils.ts              # 球谐（Spherical Harmonics）系数工具
├── edit-ops.ts              # 可撤销编辑操作（选择/隐藏/删除/变换/添加）
├── edit-history.ts          # 撤销/重做历史栈
├── camera.ts                # 相机控制（轨道、飞行、对焦、过渡动画）
├── camera-poses.ts          # 相机姿态（关键帧）管理
├── timeline.ts              # 时间轴与动画播放
├── publish.ts               # 发布到 PlayCanvas 平台
├── file-handler.ts          # 文件打开/保存/导入导出对话框
├── render.ts                # 离屏渲染、图片/视频导出
├── tools/                   # 各类交互工具（见下）
│   ├── tool-manager.ts      #   工具管理器（激活/切换工具）
│   ├── box-selection.ts     #   3D 包围盒选择
│   ├── rect-selection.ts    #   矩形框选
│   ├── lasso-selection.ts   #   套索选择
│   ├── polygon-selection.ts #   多边形选择
│   ├── brush-selection.ts   #   画笔选择
│   ├── sphere-selection.ts  #   球体选择
│   ├── flood-selection.ts   #   洪水填充选择
│   ├── eyedropper-selection.ts # 滴管选择
│   ├── move/rotate/scale-tool.ts # 变换工具
│   └── measure-tool.ts      #   测量工具
└── ui/                      # 界面层（PCUI 构建）
    ├── editor.ts            #   主界面骨架
    ├── menu.ts              #   顶部菜单
    ├── bottom-toolbar.ts    #   底部工具栏
    ├── right-toolbar.ts     #   右侧工具栏
    ├── scene-panel.ts       #   场景面板
    ├── data-panel.ts        #   数据/直方图面板
    ├── view-panel.ts        #   视图设置面板
    ├── color-panel.ts       #   颜色调整面板
    ├── timeline-panel.ts    #   时间轴面板
    ├── export-popup.ts      #   导出弹窗
    ├── publish-settings-dialog.ts # 发布设置
    └── localization.ts      #   国际化初始化
```

此外还有：

- `static/`：静态资源，包含 `static/locales/*.json` 多语言文件；
- `src/shaders/`：自定义着色器；
- `src/io/`、`src/data-processor/`：底层 IO 与数据处理；
- `rollup.config.mjs`：构建配置。

我们将在第 09、10 章对这些模块做深入剖析。

## 6. 与生态中其他工具的关系

学习 SuperSplat 时，理解它在整个高斯泼溅工具链中的位置非常重要：

- **上游（生产 3DGS）**：COLMAP、Inria gaussian-splatting、Postshot、Nerfstudio、Luma、Polycam 等负责从照片/视频重建出 `.ply` 高斯模型；
- **SuperSplat（后期处理）**：清理、裁剪、变换、优化、压缩、动画、发布；
- **下游（消费 3DGS）**：
  - PlayCanvas Engine / Editor（在 Web 应用、游戏中渲染）；
  - [SuperSplat Viewer](https://github.com/playcanvas/supersplat-viewer)（轻量查看器）；
  - 三维引擎/查看器：Three.js（`@mkkellogg/gaussian-splats-3d`）、Babylon.js、Unity/Unreal 插件等；
  - 直接通过 `<model-viewer>` 或 iframe 嵌入网页。

SuperSplat 与 `@playcanvas/splat-transform`（命令行/库）互补：前者是可视化交互工具，后者是可脚本化的批处理工具，两者共享底层数据处理逻辑。

## 7. 学习路线建议

本教程按照“先用后改”的顺序组织，建议学习路径如下：

1. **打基础（第 02 章）**：理解 3D 高斯泼溅的数学原理与 PLY 数据格式，知道每个属性代表什么；
2. **会使用（第 03–08 章）**：
   - 第 03 章：加载模型、视图操作、相机控制；
   - 第 04 章：用各种选择工具选中高斯点并编辑（隐藏、删除、筛选）；
   - 第 05 章：变换、裁剪与多模型场景管理；
   - 第 06 章：颜色与球谐外观调整；
   - 第 07 章：相机动画与时间轴；
   - 第 08 章：导出格式、压缩与发布上线。
3. **懂原理、能改造（第 09–10 章）**：
   - 第 09 章：搭建本地开发环境，理解事件系统、场景、构建流程；
   - 第 10 章：动手二次开发——新增工具、自定义编辑操作、对接 iframe API、增加语言、集成到自有产品。

### 不同读者的侧重

- **三维重建/内容创作者**：重点掌握第 03–08 章的使用技巧；
- **Web 前端/3D 开发者**：在掌握使用的基础上，深入第 09–10 章的源码与二次开发；
- **产品/团队负责人**：关注第 01、08、10 章，理解它能解决什么问题、如何私有化部署与定制。

## 8. 推荐资料

- 官方仓库：<https://github.com/playcanvas/supersplat>（README、源码、Issues、Release Notes）
- 官方用户手册：<https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/>
- 在线编辑器：<https://superspl.at/editor>
- PlayCanvas 引擎文档：<https://developer.playcanvas.com/>
- splat-transform 工具：<https://github.com/playcanvas/splat-transform>
- SuperSplat Viewer：<https://github.com/playcanvas/supersplat-viewer>
- 3DGS 原始论文：Kerbl et al., *3D Gaussian Splatting for Real-Time Radiance Field Rendering*, SIGGRAPH 2023
- 官方 Blog 与论坛：<https://blog.playcanvas.com> / <https://forum.playcanvas.com>

## 9. 本章小结

本章我们建立了对 SuperSplat 的整体认识：它是 PlayCanvas 出品、运行在浏览器中的开源 3D 高斯泼溅编辑器，定位于 3DGS 的“后期处理与发布”环节；技术上基于 TypeScript + PlayCanvas 引擎 + PCUI + Rollup，采用事件驱动架构；功能覆盖加载、选择、编辑、变换、调色、动画、导出与发布。我们还梳理了它在工具链中的位置、源码目录结构与一条循序渐进的学习路线。

下一章我们将深入 3D 高斯泼溅的数学原理与 PLY 数据格式，为后续所有操作打下坚实的理论基础。

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/3d/supersplat/第01章-SuperSplat项目全景与学习路线/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/3d/supersplat/第01章-SuperSplat项目全景与学习路线/第02章-3D高斯泼溅原理与PLY数据格式/" style="text-decoration: none;">下一章 →</a>
</div>

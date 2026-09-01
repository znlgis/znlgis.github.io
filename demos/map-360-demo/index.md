---
layout: default
title: map-360-demo 全景地图联动演示项目
---

# map-360-demo 全景地图联动演示项目

本教程全面讲解 **map-360-demo** —— 一个基于 Vue 3 + Vite + TypeScript 的纯前端演示项目，实现 360° 全景图与真实地图（Leaflet）的双向联动。项目基于 Photo Sphere Viewer v5，支持多场景切换、标记管理（添加/编辑/删除/搜索）、场景间跳转与数据导入导出。

**项目地址：** [https://github.com/znlgis/map-360-demo](https://github.com/znlgis/map-360-demo)

## 教程目录

- [第01章 项目概述与功能特性](https://znlgis.github.io/demos/map-360-demo/第01章-项目概述与功能特性/)
- [第02章 环境搭建与快速开始](https://znlgis.github.io/demos/map-360-demo/第02章-环境搭建与快速开始/)
- [第03章 项目结构解析](https://znlgis.github.io/demos/map-360-demo/第03章-项目结构解析/)
- [第04章 核心组件 PsvContainer 详解](https://znlgis.github.io/demos/map-360-demo/第04章-核心组件PsvContainer详解/)
- [第05章 全景与地图双向联动机制](https://znlgis.github.io/demos/map-360-demo/第05章-全景与地图双向联动机制/)
- [第06章 标记管理功能详解](https://znlgis.github.io/demos/map-360-demo/第06章-标记管理功能详解/)
- [第07章 状态管理与数据持久化](https://znlgis.github.io/demos/map-360-demo/第07章-状态管理与数据持久化/)
- [第08章 坐标换算算法详解](https://znlgis.github.io/demos/map-360-demo/第08章-坐标换算算法详解/)
- [第09章 样式与交互细节](https://znlgis.github.io/demos/map-360-demo/第09章-样式与交互细节/)
- [第10章 构建配置与部署](https://znlgis.github.io/demos/map-360-demo/第10章-构建配置与部署/)
- [第11章 二次开发指南](https://znlgis.github.io/demos/map-360-demo/第11章-二次开发指南/)

## 技术栈速览

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5 | UI 框架 |
| Vite | 8.x | 构建工具 |
| TypeScript | 6.0 | 类型系统 |
| @photo-sphere-viewer/core | 5.15 | 全景查看器 |
| @photo-sphere-viewer/markers-plugin | 5.15 | 全景标记 |
| @photo-sphere-viewer/plan-plugin | 5.15 | 嵌入地图 |
| leaflet | 1.9 | 地图渲染 |

## 核心亮点

- **360° 全景浏览**：拖拽旋转、缩放、全屏
- **多场景切换**：全景与地图同步更新
- **地图联动**：标记热点双向联动，点地图热点全景自动旋转
- **标记管理**：添加/编辑/删除/搜索/导入导出
- **场景跳转**：信息标记与跳转标记两种类型
- **数据持久化**：localStorage 自动保存，刷新不丢失

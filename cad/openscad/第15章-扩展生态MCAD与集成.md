---
layout: default
title: 第15章：扩展生态、MCAD 与外部集成
---

# 第15章：扩展生态、MCAD 与外部集成

## 1. OpenSCAD 生态定位

OpenSCAD 的生态不是传统插件市场，而是由脚本库、模型库、生成器、在线编辑器、命令行自动化和第三方包装器组成。它的文本模型让外部工具很容易生成、修改和导出模型。

## 2. MCAD 库

官方 README 在子模块说明中提到 MCAD library。MCAD 提供若干机械常用模块，例如齿轮、螺丝、轴承、材料和形状工具。学习 MCAD 的价值在于：

- 了解标准件如何参数化。
- 学习库文件组织方式。
- 避免重复实现复杂机械公式。
- 作为老牌 OpenSCAD 库理解生态历史。

使用时仍需检查尺寸、标准、许可证和维护状态。

## 3. BOSL/BOSL2 等社区库

社区库通常提供更丰富的几何工具、路径扫掠、倒角、标准件、阵列和数学函数。引入前应评估：

- 是否支持你的 OpenSCAD 版本。
- API 是否稳定。
- 文档是否完善。
- 性能是否可接受。
- 许可证是否允许你的用途。
- 团队是否愿意接受该依赖。

## 4. 与 Python 集成

常见模式是 Python 生成 `.scad` 文件或命令行调用 OpenSCAD：

```python
import subprocess
from pathlib import Path

model = Path("generated.scad")
model.write_text("cube([20,10,5]);\n", encoding="utf-8")
subprocess.run(["openscad", "-o", "generated.stl", str(model)], check=True)
```

适合批量生成规格、读取 CSV/JSON 参数、自动排版文字、连接 Web 服务或生产配置文件。

## 5. 与 CAD/网格工具协同

OpenSCAD 可与以下工具配合：

- FreeCAD：进一步检查、转换或组合 CAD 数据。
- Blender：渲染、展示、动画或网格后处理。
- MeshLab/Netfabb：网格检查和修复。
- Cura/PrusaSlicer/OrcaSlicer：3D 打印切片。
- Inkscape/LibreCAD/QCAD：二维轮廓编辑。
- GitHub Actions：自动导出模型和预览图。

协同时要特别注意单位和格式损失。STL 只是三角网格，不保留参数化历史。

## 6. 在线与 WebAssembly

官方仓库支持 WebAssembly 构建，生态中也有 OpenSCAD playground 类在线工具。Web 集成可以让用户在浏览器中修改参数并生成模型。但要注意：

- 浏览器性能和内存限制。
- 字体、文件系统和导入路径差异。
- 安全沙箱限制。
- 与桌面版本的功能差异。
- 大模型渲染时间对用户体验的影响。

## 7. 模型发布

发布 OpenSCAD 模型时建议提供：

- `.scad` 源文件。
- 参数说明。
- 最低 OpenSCAD 版本。
- 许可证。
- 示例导出图片。
- 关键 STL/3MF 发布件。
- 打印设置建议。
- 已知限制和装配说明。

如果模型面向非程序用户，可准备一个参数表或自定义器说明。

## 8. 与版本控制结合

OpenSCAD 很适合 Git：

- 每个功能模块一个文件。
- 参数变更可 diff。
- PR 可审查公式和尺寸。
- CI 可验证导出。
- Release 可附带生成的 STL。

需要避免把大量临时导出、切片缓存和机器私有配置提交到仓库。

## 9. 生成式设计边界

OpenSCAD 可以做生成式几何，但不等于优化器。若需要拓扑优化、约束求解、有限元反馈或复杂曲面，通常应由外部工具计算结果，再用 OpenSCAD 参数化表达可制造部分。

## 10. 集成检查清单

- 第三方库许可证是否明确？
- 外部生成器是否输出稳定、可读的 `.scad`？
- CI 中 OpenSCAD 版本是否固定？
- 导入导出单位是否一致？
- 发布文件是否区分源代码和生成产物？
- 非程序用户是否有足够说明修改参数？

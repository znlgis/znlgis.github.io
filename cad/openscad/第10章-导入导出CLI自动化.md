---
layout: default
title: 第10章：导入导出、命令行与自动化
---

# 第10章：导入导出、命令行与自动化

## 1. 支持的常见格式

OpenSCAD 官方 README 提到可读取和创建 STL、OFF，并使用 DXF 作为二维轮廓交换格式；当前版本还支持更多格式，如 3MF、AMF、SVG、PNG 等，具体以所安装版本的帮助输出为准。

常见用途：

- STL：3D 打印最常见三角网格格式。
- 3MF：现代 3D 打印格式，可携带更多元数据。
- OFF：几何网格交换和测试。
- DXF/SVG：二维轮廓、激光切割、投影输出。
- PNG：文档预览图、CI 快照、网页展示。

## 2. import 导入

```scad
import("part.stl");
linear_extrude(3) import("profile.dxf");
```

导入模型常用于增加外部零件参考、组合扫描件、加工现有网格或使用外部二维轮廓。需要注意：

- STL 没有单位信息，比例必须确认。
- 外部网格可能非流形，布尔运算容易失败。
- DXF/SVG 轮廓必须清理闭合。
- 导入文件路径相对当前 `.scad` 文件或工作目录，自动化时应固定路径。

## 3. 导出 STL

图形界面中通常先 F6 渲染，再导出 STL。命令行：

```bash
openscad -o exports/part.stl src/main.scad
```

建议导出前检查控制台警告。对 3D 打印件，还应在切片软件中检查模型尺寸、法线、非流形和支撑。

## 4. 使用 -D 覆盖参数

```bash
openscad -D 'part="base"' -D 'wall=2.4' -o base.stl main.scad
```

`-D` 是批量生成的核心。注意字符串需要引号，shell 中可能要嵌套转义。建议在 CI 中把命令写得明确，不依赖交互环境。

## 5. 生成多规格产品

```bash
openscad -D 'variant="small"' -o exports/small.stl product.scad
openscad -D 'variant="medium"' -o exports/medium.stl product.scad
openscad -D 'variant="large"' -o exports/large.stl product.scad
```

`.scad` 中：

```scad
variant = "small";
size = variant == "small" ? [60,40,20] :
       variant == "medium" ? [80,50,25] : [100,60,30];
```

## 6. 导出图片

命令行可生成预览图，用于文档或回归比较：

```bash
openscad -o preview.png --imgsize=1200,800 --viewall --autocenter model.scad
```

图片导出适合博客教程、README 之外的文档页面、发布说明和模型库索引。要得到稳定图片，应固定相机、尺寸、颜色和 OpenSCAD 版本。

## 7. 自动化构建建议

可使用 Makefile：

```make
OPENSCAD=openscad
SRC=src/main.scad

exports/base.stl: $(SRC)
$(OPENSCAD) -D 'part="base"' -o $@ $(SRC)

exports/cover.stl: $(SRC)
$(OPENSCAD) -D 'part="cover"' -o $@ $(SRC)
```

自动化流程应包含：

- 清理旧导出。
- 生成 STL/3MF。
- 生成 PNG 预览。
- 检查文件是否非空。
- 可选：运行网格检查工具。
- 可选：上传构建产物。

## 8. CI 中使用 OpenSCAD

CI 可用于保证模型至少能渲染导出：

1. 安装 OpenSCAD。
2. 运行命令行导出关键模型。
3. 保存 STL 和 PNG 作为构建产物。
4. 对生成文件大小、数量和日志进行检查。
5. 对参数矩阵运行多规格导出。

OpenSCAD 官方仓库自身包含 GitHub Actions、CircleCI、本地 CI 说明和大量测试，说明命令行与自动化是项目的重要组成部分。

## 9. 路径与依赖管理

自动化最常见的问题是路径不一致。建议：

- 所有导出命令从项目根目录运行。
- `.scad` 内使用相对自身清晰的路径。
- 第三方库固定版本。
- 不依赖用户本机字体，除非已在 CI 安装。
- 导出目录由脚本创建，不手工维护。

## 10. 导入导出检查清单

- 命令行版本是否与本地 GUI 版本一致？
- `-D` 参数是否正确转义？
- 导入文件单位是否明确？
- 导出 STL 是否经过 F6 或等价命令完整渲染？
- 图片导出相机是否固定？
- CI 是否能复现本地结果？
- 大型二进制导出是否需要 Git LFS 或构建产物管理？

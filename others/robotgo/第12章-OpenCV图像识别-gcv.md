---
layout: default
title: 第12章 - OpenCV 图像识别（gcv）
---

# 第12章 - OpenCV 图像识别（gcv）

第 8 章的位图查找是“精确匹配”，要求目标在屏幕上与模板图几乎一模一样。但现实中目标元素常常存在缩放、抗锯齿、轻微颜色差异、半透明叠加等情况，精确匹配会失败。这时就需要更强大的图像识别——基于 OpenCV 的模板匹配与特征匹配，由 RobotGo 配套子库 **gcv**（[vcaesar/gcv](https://github.com/vcaesar/gcv)）提供。本章讲解如何用 gcv 在屏幕中稳健地查找图像。

## 12.1 gcv 是什么

gcv 是基于 OpenCV（通过 GoCV 绑定）实现的计算机视觉工具库，与 RobotGo 协同工作。它提供了比位图查找更鲁棒的图像查找能力：

- **模板匹配（Template Matching）**：在大图中滑动小图，计算相似度，找到最匹配的位置，并给出匹配度分数。
- **特征匹配（SIFT 等）**：基于关键点特征匹配，对缩放、旋转有一定容忍度。
- **混合查找**：结合模板匹配与特征匹配，兼顾速度与鲁棒性。

相比位图查找，gcv 的优势是“容错”：即使目标不是像素级一致，也能找到，并告诉你“有多像”。

## 12.2 安装依赖

使用 gcv 需要先正确安装 OpenCV 与 GoCV，这是本章最大的门槛。GoCV 官方文档提供了各平台的安装方式，核心是装好 OpenCV 库后再获取 gcv：

```go
import (
    "github.com/vcaesar/gcv"
)
```

> 提示：OpenCV 的安装相对复杂（尤其在 Windows 上）。请参考 [GoCV](https://github.com/hybridgroup/gocv) 与 [gcv](https://github.com/vcaesar/gcv) 仓库的安装说明完成环境配置。如果你只需要精确匹配，没有缩放/容错需求，用第 8 章的位图查找即可，无需引入 OpenCV。

## 12.3 基于文件的查找：FindImgFile

最简单的入门方式是直接对两个图片文件做查找：在大图 `name` 中查找小图 `name1`：

```go
name := "test.png"       // 大图（通常是整屏截图）
name1 := "test_001.png"  // 小图（要找的模板）

// 先截图保存
robotgo.SaveCapture(name1, 10, 10, 30, 30) // 截取一小块作为模板
robotgo.SaveCapture(name)                  // 截取整屏作为大图

// 在大图中查找小图
fmt.Println(gcv.FindImgFile(name1, name))
fmt.Println(gcv.FindAllImgFile(name1, name))
```

`FindImgFile` 返回最佳匹配结果，`FindAllImgFile` 返回所有匹配结果。

## 12.4 基于内存图像的查找：FindImg / FindAllImg

更高效的做法是直接用内存中的 `image.Image`（来自 `CaptureImg`），避免反复读写磁盘：

```go
img, _ := robotgo.CaptureImg()              // 大图：整屏
img1, _ := robotgo.CaptureImg(10, 10, 30, 30) // 小图：模板

// 查找单个
res1 := gcv.FindImg(img1, img)
fmt.Println("find:", res1)

// 查找所有
res := gcv.FindAllImg(img1, img)
fmt.Println(res[0].TopLeft.Y, res[0].Rects.TopLeft.X, res)
```

## 12.5 解析查找结果

gcv 的查找结果包含匹配区域的位置信息。常见做法是取结果的左上角坐标，移动鼠标过去并点击：

```go
res := gcv.FindAllImg(img1, img)
if len(res) > 0 {
    x, y := res[0].TopLeft.X, res[0].TopLeft.Y
    robotgo.Move(x, y)
    robotgo.MilliSleep(100)
    robotgo.Click()
}
```

结果结构中通常还包含匹配区域的矩形（`Rects`）和匹配度信息，可用于设置“匹配阈值”，过滤掉相似度过低的误匹配。

## 12.6 模板匹配与特征匹配结合：Find / FindAll

gcv 还提供了把模板匹配与特征匹配（SIFT）结合的综合查找函数 `Find` / `FindAll`，在复杂场景下匹配更稳：

```go
// 综合查找所有（模板 + SIFT）
res := gcv.FindAll(img1, img)
fmt.Println("find all:", res)

// 综合查找单个
res1 := gcv.Find(img1, img)
fmt.Println("find:", res1)
```

此外还有直接返回坐标的便捷封装，例如 `FindX`：

```go
img2, _, _ := robotgo.DecodeImg("test_001.png")
x, y := gcv.FindX(img2, img)
fmt.Println(x, y)
```

## 12.7 完整示例

下面是官方 OpenCV 示例的整理版，完整演示了文件查找、内存查找、解析结果并点击：

```go
package main

import (
    "fmt"
    "math/rand"

    "github.com/go-vgo/robotgo"
    "github.com/vcaesar/bitmap"
    "github.com/vcaesar/gcv"
)

func main() {
    opencv()
}

func opencv() {
    name := "test.png"
    name1 := "test_001.png"
    robotgo.SaveCapture(name1, 10, 10, 30, 30)
    robotgo.SaveCapture(name)

    // 基于文件查找
    fmt.Print("gcv find image: ")
    fmt.Println(gcv.FindImgFile(name1, name))
    fmt.Println(gcv.FindAllImgFile(name1, name))

    // 也可用位图查找对比
    bit := bitmap.Open(name1)
    defer robotgo.FreeBitmap(bit)
    fmt.Print("find bitmap: ")
    fmt.Println(bitmap.Find(bit))

    // 基于内存图像查找
    img, _ := robotgo.CaptureImg()
    img1, _ := robotgo.CaptureImg(10, 10, 30, 30)

    fmt.Print("gcv find image: ")
    fmt.Println(gcv.FindImg(img1, img))

    res := gcv.FindAllImg(img1, img)
    fmt.Println(res[0].TopLeft.Y, res[0].Rects.TopLeft.X, res)
    x, y := res[0].TopLeft.X, res[0].TopLeft.Y
    robotgo.Move(x, y-rand.Intn(5)) // 加一点随机偏移，更像真人
    robotgo.MilliSleep(100)
    robotgo.Click()

    // 综合查找
    res = gcv.FindAll(img1, img)
    fmt.Println("find all:", res)
    res1 := gcv.Find(img1, img)
    fmt.Println("find:", res1)

    // 从文件解码后查找
    img2, _, _ := robotgo.DecodeImg("test_001.png")
    x, y = gcv.FindX(img2, img)
    fmt.Println(x, y)
}
```

## 12.8 位图查找 vs OpenCV 查找：如何选择

| 维度 | bitmap 位图查找 | gcv OpenCV 查找 |
| --- | --- | --- |
| 匹配方式 | 精确像素匹配 | 模板匹配 + 特征匹配 |
| 容错能力 | 弱（要求像素一致） | 强（容忍缩放/差异） |
| 匹配度分数 | 无 | 有（可设阈值） |
| 依赖 | libpng | OpenCV / GoCV（较重） |
| 安装难度 | 低 | 高 |
| 速度 | 快 | 相对慢 |

选择建议：

- 目标外观固定、环境稳定 → 用 **位图查找**，轻量快速。
- 目标存在缩放、抗锯齿、半透明、主题差异 → 用 **gcv**，鲁棒但需要承担 OpenCV 的安装成本。

## 12.9 实战技巧与注意事项

1. **设置匹配阈值**：利用结果中的匹配度分数过滤误匹配，只接受高于某阈值的结果，避免“找错地方乱点”。
2. **内存查找优先**：能用 `CaptureImg` + `FindImg` 就别反复读写文件，性能更好。
3. **加随机偏移**：点击坐标加一点随机抖动（如示例中的 `rand.Intn`），在某些反自动化场景下更像真人操作。
4. **缩小搜索区域**：先用 `CaptureImg(x, y, w, h)` 截取目标可能出现的局部区域作为大图，能显著加速匹配。
5. **权衡是否引入 OpenCV**：OpenCV 安装与体积成本不小，确认确有容错需求再引入，否则位图查找更划算。

## 12.10 小结

本章我们学习了基于 gcv 子库的 OpenCV 图像识别：它通过模板匹配与特征匹配提供了比位图查找更鲁棒的图像定位能力。我们掌握了基于文件（`FindImgFile`）和基于内存（`FindImg` / `FindAllImg` / `Find` / `FindAll` / `FindX`）的多种查找方式、结果解析与点击，并对比了位图查找与 OpenCV 查找的取舍。下一章我们将探讨 RobotGo 的跨平台开发与新兴的 Cgo-free 构建方式。

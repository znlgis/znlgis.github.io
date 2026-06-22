---
layout: default
title: 第08章 - Bitmap 位图与图像查找
---

# 第08章 - Bitmap 位图与图像查找

“在屏幕上找到某张小图并定位它的坐标”，是桌面自动化中极其实用的能力：找到按钮、找到图标、找到游戏中的某个元素，然后移动鼠标点击它。RobotGo 通过配套的 `bitmap` 子库（[vcaesar/bitmap](https://github.com/vcaesar/bitmap)）提供了基于位图的查找能力。本章讲解位图的打开、保存、查找与定位。

## 8.1 为什么需要位图查找

第 6 章我们用“像素颜色”来识别界面状态，但单个像素信息量太小、容易误判。位图查找则是用“一整张小图”作为特征，在更大的截图（或整个屏幕）中寻找它出现的位置。相比硬编码坐标，它的最大优势是**位置无关**：哪怕目标元素移动了位置，只要外观不变，就能被找到。

位图查找属于“精确匹配”——要求目标在屏幕上的外观与模板图基本一致（同样的缩放、同样的颜色）。如果需要更鲁棒的、容忍缩放和细微差异的匹配，则要用第 12 章的 OpenCV 方案。

## 8.2 引入 bitmap 子库

位图查找的核心函数在 `bitmap` 子库中，需要单独导入：

```go
import (
    "github.com/go-vgo/robotgo"
    "github.com/vcaesar/bitmap"
)
```

并在 Linux 上确保已安装 libpng 开发库（见第 2 章），因为位图功能依赖它。

## 8.3 获取位图

位图可以来自截图，也可以从文件打开。

### 8.3.1 从截图获取

```go
bit := robotgo.CaptureScreen(10, 20, 30, 40)
defer robotgo.FreeBitmap(bit) // C 位图需释放
```

### 8.3.2 从文件打开

```go
bit := bitmap.Open("template.png")
defer robotgo.FreeBitmap(bit)
```

### 8.3.3 从 image.Image 转换

如果你手上是 `image.Image`，可以先转成位图：

```go
img, _ := robotgo.CaptureImg()
bit := robotgo.ToCBitmap(robotgo.ImgToBitmap(img))
```

## 8.4 保存位图

```go
bit := robotgo.CaptureScreen(10, 20, 30, 40)
defer robotgo.FreeBitmap(bit)

bitmap.Save(bit, "test.png")
```

也可以借助前一章的转换函数把位图转为 `image.Image` 再用 `robotgo.Save` 保存。

## 8.5 查找位图：Find 与 FindAll

`bitmap` 子库的核心是查找函数。

### 8.5.1 Find：查找第一个匹配位置

`bitmap.Find` 在屏幕（或指定的大图）中查找给定的小位图，返回它左上角的坐标：

```go
bit := bitmap.Open("button.png")
defer robotgo.FreeBitmap(bit)

fx, fy := bitmap.Find(bit)
fmt.Println("找到位置:", fx, fy)

if fx >= 0 && fy >= 0 {
    robotgo.Move(fx, fy)
    robotgo.Click()
}
```

如果没找到，返回的坐标通常为 -1（请以实际返回值判断，对负值做“未找到”处理）。

### 8.5.2 FindAll：查找所有匹配位置

当目标图在屏幕上出现多次时，用 `FindAll` 获取所有匹配位置：

```go
bit := bitmap.Open("icon.png")
defer robotgo.FreeBitmap(bit)

arr := bitmap.FindAll(bit)
fmt.Println("所有匹配位置:", arr)
```

## 8.6 完整示例

下面是官方位图示例的整理版，演示从截图获取位图、保存、转换与查找：

```go
package main

import (
    "fmt"

    "github.com/go-vgo/robotgo"
    "github.com/vcaesar/bitmap"
)

func main() {
    // 截取屏幕的一小块作为位图
    bit := robotgo.CaptureScreen(10, 20, 30, 40)
    defer robotgo.FreeBitmap(bit) // 释放 C 位图

    fmt.Println("位图:", bit)

    // 转为 image.Image 并保存
    img := robotgo.ToImage(bit)
    robotgo.Save(img, "test_1.png")

    // image -> Bitmap -> CBitmap，然后查找
    bit2 := robotgo.ToCBitmap(robotgo.ImgToBitmap(img))
    fx, fy := bitmap.Find(bit2)
    fmt.Println("FindBitmap:", fx, fy)
    robotgo.Move(fx, fy)

    // 查找所有匹配
    arr := bitmap.FindAll(bit2)
    fmt.Println("FindAll:", arr)

    // 直接用截图位图查找
    fx, fy = bitmap.Find(bit)
    fmt.Println("FindBitmap:", fx, fy)

    bitmap.Save(bit, "test.png")
}
```

## 8.7 典型工作流：截取模板 → 查找 → 点击

位图查找在实践中通常遵循这样一个工作流：

1. **准备模板图**：先手动截取目标元素（按钮、图标）的小图，保存为 PNG，作为模板。
2. **运行时查找**：脚本运行时打开模板图，在当前屏幕中 `Find` 它的位置。
3. **执行操作**：找到后移动鼠标到该坐标并点击。

```go
func clickByImage(template string) bool {
    bit := bitmap.Open(template)
    defer robotgo.FreeBitmap(bit)

    fx, fy := bitmap.Find(bit)
    if fx < 0 || fy < 0 {
        return false // 没找到
    }
    robotgo.Move(fx, fy)
    robotgo.MilliSleep(100)
    robotgo.Click()
    return true
}
```

配合轮询，可以实现“等待某个按钮出现再点击”的健壮逻辑：

```go
func waitAndClick(template string, timeoutMs int) bool {
    elapsed := 0
    for elapsed < timeoutMs {
        if clickByImage(template) {
            return true
        }
        robotgo.MilliSleep(300)
        elapsed += 300
    }
    return false
}
```

## 8.8 位图查找 vs 像素颜色 vs OpenCV

RobotGo 生态里有三种“看屏幕找东西”的层次，适用场景各不相同：

| 方法 | 所在库 | 特点 | 适用场景 |
| --- | --- | --- | --- |
| 像素颜色 `GetPixelColor` | robotgo 主库 | 最轻量，只看单点颜色 | 判断简单的开关/状态 |
| 位图查找 `bitmap.Find` | bitmap 子库 | 精确匹配整张小图 | 外观固定的按钮/图标定位 |
| OpenCV 匹配 `gcv` | gcv 子库 | 模板匹配 + 特征匹配，容错强 | 有缩放/细微差异的复杂识别 |

选择原则：能用像素就用像素（最快），需要定位元素用位图查找，遇到位图查找不稳定（缩放、抗锯齿、半透明等）再升级到 OpenCV。

## 8.9 实战技巧与注意事项

1. **模板要“干净”**：截取模板图时尽量只包含目标元素本身，避免包含会变化的背景，否则匹配率会下降。
2. **保持环境一致**：位图查找是精确匹配，模板图必须与运行环境的分辨率、缩放、主题保持一致。换了缩放比例往往就匹配不到了。
3. **判断未找到**：始终检查返回坐标是否为负，不要拿着 -1 去 `Move`。
4. **释放内存**：所有 `CaptureScreen` / `bitmap.Open` / `ToCBitmap` 得到的 C 位图都要 `FreeBitmap`。
5. **性能考量**：`FindAll` 比 `Find` 慢；在大屏上全屏查找也较慢。尽量缩小查找范围（先截取目标可能出现的区域）。
6. **优先 PNG 模板**：用无损的 PNG 作为模板图，避免 JPEG 压缩引入的像素差异影响匹配。

## 8.10 小结

本章我们学习了基于 `bitmap` 子库的位图查找：如何从截图或文件获取位图、保存位图，以及用 `Find` / `FindAll` 在屏幕上定位目标小图的位置。我们梳理了“截模板→查找→点击”的典型工作流，并对比了像素颜色、位图查找、OpenCV 三种识别方式的取舍。下一章我们回到主库，讲解更基础但同样重要的剪贴板操作。

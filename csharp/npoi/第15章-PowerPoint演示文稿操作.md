# 第十五章：PowerPoint演示文稿操作

## 15.1 NPOI PowerPoint概述

### 15.1.1 支持的格式

| 格式 | 扩展名 | 说明 | NPOI类 |
|------|--------|------|--------|
| PowerPoint 2007+ | .pptx | OpenXML格式 | XMLSlideShow |
| PowerPoint 97-2003 | .ppt | 二进制格式 | HSLFSlideShow（有限支持） |

### 15.1.2 基本命名空间

```csharp
using NPOI.XSLF.UserModel;
using NPOI.SL.UserModel;
using System.IO;
```

## 15.2 创建演示文稿

### 15.2.1 创建新演示文稿

```csharp
using NPOI.XSLF.UserModel;

// 创建新的演示文稿
XMLSlideShow ppt = new XMLSlideShow();

// 创建幻灯片
XSLFSlide slide = ppt.CreateSlide();

// 保存演示文稿
using (FileStream fs = new FileStream("presentation.pptx", FileMode.Create))
{
    ppt.Write(fs);
}
```

### 15.2.2 打开现有演示文稿

```csharp
// 打开现有演示文稿
using (FileStream fs = new FileStream("existing.pptx", FileMode.Open, FileAccess.Read))
{
    XMLSlideShow ppt = new XMLSlideShow(fs);
    
    // 获取所有幻灯片
    var slides = ppt.GetSlides();
    Console.WriteLine($"共有 {slides.Count} 张幻灯片");
}
```

## 15.3 幻灯片操作

### 15.3.1 创建和管理幻灯片

```csharp
XMLSlideShow ppt = new XMLSlideShow();

// 创建多张幻灯片
XSLFSlide slide1 = ppt.CreateSlide();
XSLFSlide slide2 = ppt.CreateSlide();
XSLFSlide slide3 = ppt.CreateSlide();

// 获取所有幻灯片
var slides = ppt.GetSlides();

// 获取特定幻灯片
XSLFSlide firstSlide = slides[0];

// 删除幻灯片
ppt.RemoveSlide(2);  // 删除第3张幻灯片

// 获取幻灯片数量
int count = slides.Count;
```

### 15.3.2 使用幻灯片布局

```csharp
// 获取幻灯片母版
var slideMasters = ppt.GetSlideMasters();
if (slideMasters.Count > 0)
{
    XSLFSlideMaster master = slideMasters[0];
    
    // 获取布局
    var layouts = master.GetSlideLayouts();
    foreach (var layout in layouts)
    {
        Console.WriteLine($"布局: {layout.GetName()}");
    }
    
    // 使用特定布局创建幻灯片
    XSLFSlideLayout titleLayout = master.GetLayout(SlideLayout.TITLE);
    if (titleLayout != null)
    {
        XSLFSlide slide = ppt.CreateSlide(titleLayout);
    }
}
```

## 15.4 添加内容

### 15.4.1 添加文本框

```csharp
/// <summary>
/// 在幻灯片上添加文本框
/// </summary>
public static void AddTextBox(XSLFSlide slide, string text, 
    double x, double y, double width, double height)
{
    XSLFTextBox textBox = slide.CreateTextBox();
    
    // 设置位置和大小（单位：像素）
    textBox.SetAnchor(new System.Drawing.RectangleF(
        (float)x, (float)y, (float)width, (float)height));
    
    // 添加文本
    XSLFTextParagraph paragraph = textBox.AddNewTextParagraph();
    XSLFTextRun run = paragraph.AddNewTextRun();
    run.SetText(text);
    run.SetFontSize(24);
    run.SetFontFamily("微软雅黑");
}
```

### 15.4.2 添加标题

```csharp
/// <summary>
/// 创建标题幻灯片
/// </summary>
public static void CreateTitleSlide(XMLSlideShow ppt, string title, string subtitle)
{
    XSLFSlide slide = ppt.CreateSlide();
    
    // 主标题
    XSLFTextBox titleBox = slide.CreateTextBox();
    titleBox.SetAnchor(new System.Drawing.RectangleF(50, 150, 620, 80));
    XSLFTextParagraph titlePara = titleBox.AddNewTextParagraph();
    titlePara.SetTextAlign(TextAlign.CENTER);
    XSLFTextRun titleRun = titlePara.AddNewTextRun();
    titleRun.SetText(title);
    titleRun.SetFontSize(44);
    titleRun.SetBold(true);
    titleRun.SetFontFamily("微软雅黑");
    
    // 副标题
    XSLFTextBox subtitleBox = slide.CreateTextBox();
    subtitleBox.SetAnchor(new System.Drawing.RectangleF(50, 250, 620, 50));
    XSLFTextParagraph subtitlePara = subtitleBox.AddNewTextParagraph();
    subtitlePara.SetTextAlign(TextAlign.CENTER);
    XSLFTextRun subtitleRun = subtitlePara.AddNewTextRun();
    subtitleRun.SetText(subtitle);
    subtitleRun.SetFontSize(24);
    subtitleRun.SetFontFamily("微软雅黑");
    subtitleRun.SetFontColor(System.Drawing.Color.Gray);
}
```

### 15.4.3 添加列表

```csharp
/// <summary>
/// 创建内容幻灯片（带列表）
/// </summary>
public static void CreateContentSlide(XMLSlideShow ppt, string title, string[] items)
{
    XSLFSlide slide = ppt.CreateSlide();
    
    // 标题
    XSLFTextBox titleBox = slide.CreateTextBox();
    titleBox.SetAnchor(new System.Drawing.RectangleF(50, 30, 620, 50));
    XSLFTextParagraph titlePara = titleBox.AddNewTextParagraph();
    XSLFTextRun titleRun = titlePara.AddNewTextRun();
    titleRun.SetText(title);
    titleRun.SetFontSize(32);
    titleRun.SetBold(true);
    titleRun.SetFontFamily("微软雅黑");
    
    // 内容列表
    XSLFTextBox contentBox = slide.CreateTextBox();
    contentBox.SetAnchor(new System.Drawing.RectangleF(50, 100, 620, 350));
    
    foreach (string item in items)
    {
        XSLFTextParagraph para = contentBox.AddNewTextParagraph();
        para.SetIndentLevel(0);
        para.SetBullet(true);
        
        XSLFTextRun run = para.AddNewTextRun();
        run.SetText(item);
        run.SetFontSize(20);
        run.SetFontFamily("微软雅黑");
    }
}
```

## 15.5 插入图片

### 15.5.1 添加图片

```csharp
/// <summary>
/// 在幻灯片上添加图片
/// </summary>
public static void AddImage(XMLSlideShow ppt, XSLFSlide slide, string imagePath,
    double x, double y, double width, double height)
{
    // 读取图片数据
    byte[] imageData = File.ReadAllBytes(imagePath);
    
    // 确定图片类型
    string extension = Path.GetExtension(imagePath).ToLower();
    PictureType pictureType = extension switch
    {
        ".png" => PictureType.PNG,
        ".jpg" or ".jpeg" => PictureType.JPEG,
        ".gif" => PictureType.GIF,
        _ => PictureType.PNG
    };
    
    // 添加图片数据到演示文稿
    XSLFPictureData pictureData = ppt.AddPicture(imageData, pictureType);
    
    // 在幻灯片上创建图片形状
    XSLFPictureShape picture = slide.CreatePicture(pictureData);
    picture.SetAnchor(new System.Drawing.RectangleF(
        (float)x, (float)y, (float)width, (float)height));
}
```

## 15.6 添加表格

### 15.6.1 创建表格

```csharp
/// <summary>
/// 在幻灯片上添加表格
/// </summary>
public static void AddTable(XSLFSlide slide, string[,] data,
    double x, double y, double width, double height)
{
    int rows = data.GetLength(0);
    int cols = data.GetLength(1);
    
    XSLFTable table = slide.CreateTable(rows, cols);
    table.SetAnchor(new System.Drawing.RectangleF(
        (float)x, (float)y, (float)width, (float)height));
    
    // 设置列宽
    double colWidth = width / cols;
    for (int i = 0; i < cols; i++)
    {
        table.SetColumnWidth(i, colWidth);
    }
    
    // 填充数据
    for (int r = 0; r < rows; r++)
    {
        XSLFTableRow row = table.GetRows()[r];
        for (int c = 0; c < cols; c++)
        {
            XSLFTableCell cell = row.GetCells()[c];
            cell.SetText(data[r, c]);
            
            // 表头样式
            if (r == 0)
            {
                cell.SetFillColor(System.Drawing.Color.FromArgb(68, 114, 196));
                foreach (var para in cell.GetTextParagraphs())
                {
                    foreach (var run in para.GetTextRuns())
                    {
                        run.SetBold(true);
                        run.SetFontColor(System.Drawing.Color.White);
                    }
                }
            }
        }
    }
}
```

## 15.7 综合示例

### 15.7.1 创建完整演示文稿

```csharp
public class PresentationExample
{
    public static void CreatePresentation()
    {
        XMLSlideShow ppt = new XMLSlideShow();
        
        // 幻灯片1：标题页
        CreateTitleSlide(ppt, "NPOI技术分享", "使用.NET操作Office文档");
        
        // 幻灯片2：目录
        CreateContentSlide(ppt, "目录", new[]
        {
            "NPOI简介",
            "Excel操作",
            "Word操作",
            "PowerPoint操作",
            "最佳实践"
        });
        
        // 幻灯片3：简介
        CreateContentSlide(ppt, "NPOI简介", new[]
        {
            "Apache POI的.NET移植版本",
            "支持Excel、Word、PowerPoint",
            "无需安装Microsoft Office",
            "开源免费，Apache 2.0协议",
            "支持.NET Framework和.NET Core"
        });
        
        // 幻灯片4：表格数据
        XSLFSlide tableSlide = ppt.CreateSlide();
        
        // 添加标题
        XSLFTextBox titleBox = tableSlide.CreateTextBox();
        titleBox.SetAnchor(new System.Drawing.RectangleF(50, 30, 620, 50));
        var titlePara = titleBox.AddNewTextParagraph();
        var titleRun = titlePara.AddNewTextRun();
        titleRun.SetText("支持的文件格式");
        titleRun.SetFontSize(32);
        titleRun.SetBold(true);
        
        // 添加表格
        string[,] tableData = {
            { "格式", "扩展名", "NPOI类" },
            { "Excel 2007+", ".xlsx", "XSSFWorkbook" },
            { "Excel 97-2003", ".xls", "HSSFWorkbook" },
            { "Word 2007+", ".docx", "XWPFDocument" },
            { "PowerPoint 2007+", ".pptx", "XMLSlideShow" }
        };
        AddTable(tableSlide, tableData, 50, 100, 620, 300);
        
        // 幻灯片5：结束页
        CreateTitleSlide(ppt, "谢谢！", "欢迎交流讨论");
        
        // 保存
        using (FileStream fs = new FileStream("NPOI技术分享.pptx", FileMode.Create))
        {
            ppt.Write(fs);
        }
        
        Console.WriteLine("演示文稿创建成功！");
    }
    
    private static void CreateTitleSlide(XMLSlideShow ppt, string title, string subtitle)
    {
        XSLFSlide slide = ppt.CreateSlide();
        
        XSLFTextBox titleBox = slide.CreateTextBox();
        titleBox.SetAnchor(new System.Drawing.RectangleF(50, 150, 620, 80));
        var titlePara = titleBox.AddNewTextParagraph();
        titlePara.SetTextAlign(TextAlign.CENTER);
        var titleRun = titlePara.AddNewTextRun();
        titleRun.SetText(title);
        titleRun.SetFontSize(44);
        titleRun.SetBold(true);
        
        XSLFTextBox subtitleBox = slide.CreateTextBox();
        subtitleBox.SetAnchor(new System.Drawing.RectangleF(50, 250, 620, 50));
        var subtitlePara = subtitleBox.AddNewTextParagraph();
        subtitlePara.SetTextAlign(TextAlign.CENTER);
        var subtitleRun = subtitlePara.AddNewTextRun();
        subtitleRun.SetText(subtitle);
        subtitleRun.SetFontSize(24);
    }
    
    private static void CreateContentSlide(XMLSlideShow ppt, string title, string[] items)
    {
        XSLFSlide slide = ppt.CreateSlide();
        
        XSLFTextBox titleBox = slide.CreateTextBox();
        titleBox.SetAnchor(new System.Drawing.RectangleF(50, 30, 620, 50));
        var titlePara = titleBox.AddNewTextParagraph();
        var titleRun = titlePara.AddNewTextRun();
        titleRun.SetText(title);
        titleRun.SetFontSize(32);
        titleRun.SetBold(true);
        
        XSLFTextBox contentBox = slide.CreateTextBox();
        contentBox.SetAnchor(new System.Drawing.RectangleF(50, 100, 620, 350));
        
        foreach (string item in items)
        {
            var para = contentBox.AddNewTextParagraph();
            var run = para.AddNewTextRun();
            run.SetText("• " + item);
            run.SetFontSize(20);
        }
    }
    
    private static void AddTable(XSLFSlide slide, string[,] data,
        double x, double y, double width, double height)
    {
        int rows = data.GetLength(0);
        int cols = data.GetLength(1);
        
        XSLFTable table = slide.CreateTable(rows, cols);
        table.SetAnchor(new System.Drawing.RectangleF(
            (float)x, (float)y, (float)width, (float)height));
        
        for (int r = 0; r < rows; r++)
        {
            var row = table.GetRows()[r];
            for (int c = 0; c < cols; c++)
            {
                var cell = row.GetCells()[c];
                cell.SetText(data[r, c]);
                
                if (r == 0)
                {
                    cell.SetFillColor(System.Drawing.Color.FromArgb(68, 114, 196));
                }
            }
        }
    }
}
```

## 15.8 本章小结

本章介绍了NPOI中PowerPoint演示文稿的操作。通过本章学习，你应该掌握：

- 演示文稿的创建和打开
- 幻灯片的创建和管理
- 文本框和列表的添加
- 图片的插入
- 表格的创建
- 创建完整演示文稿的方法

PowerPoint操作在NPOI中功能相对有限，但基本的演示文稿创建需求都可以满足。

---

> **下一章预告**：第十六章将介绍大文件处理与性能优化。

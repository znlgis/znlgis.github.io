# 第十三章：Word图片与多媒体

## 13.1 插入图片

### 13.1.1 从文件插入图片

```csharp
using NPOI.XWPF.UserModel;
using System.IO;

/// <summary>
/// 从文件插入图片到段落
/// </summary>
public static void InsertImageFromFile(XWPFDocument doc, string imagePath, 
    int widthEmu, int heightEmu)
{
    // 创建段落
    XWPFParagraph para = doc.CreateParagraph();
    para.Alignment = ParagraphAlignment.CENTER;
    XWPFRun run = para.CreateRun();
    
    // 读取图片文件
    using FileStream fs = new FileStream(imagePath, FileMode.Open, FileAccess.Read);
    
    // 确定图片类型
    string extension = Path.GetExtension(imagePath).ToLower();
    PictureType pictureType = extension switch
    {
        ".png" => PictureType.PNG,
        ".jpg" or ".jpeg" => PictureType.JPEG,
        ".gif" => PictureType.GIF,
        ".bmp" => PictureType.BMP,
        ".tiff" or ".tif" => PictureType.TIFF,
        _ => PictureType.PNG
    };
    
    // 添加图片
    run.AddPicture(fs, (int)pictureType, Path.GetFileName(imagePath), widthEmu, heightEmu);
}

// EMU（English Metric Units）转换
// 1英寸 = 914400 EMU
// 1厘米 = 360000 EMU
// 1像素 ≈ 9525 EMU（96 DPI）

/// <summary>
/// 像素转EMU
/// </summary>
public static int PixelToEmu(int pixels)
{
    return pixels * 9525;
}

/// <summary>
/// 厘米转EMU
/// </summary>
public static int CmToEmu(double cm)
{
    return (int)(cm * 360000);
}

/// <summary>
/// 英寸转EMU
/// </summary>
public static int InchToEmu(double inch)
{
    return (int)(inch * 914400);
}
```

### 13.1.2 从字节数组插入图片

```csharp
/// <summary>
/// 从字节数组插入图片
/// </summary>
public static void InsertImageFromBytes(XWPFDocument doc, byte[] imageBytes,
    PictureType pictureType, string fileName, int widthEmu, int heightEmu)
{
    XWPFParagraph para = doc.CreateParagraph();
    XWPFRun run = para.CreateRun();
    
    using MemoryStream ms = new MemoryStream(imageBytes);
    run.AddPicture(ms, (int)pictureType, fileName, widthEmu, heightEmu);
}

/// <summary>
/// 从Base64字符串插入图片
/// </summary>
public static void InsertImageFromBase64(XWPFDocument doc, string base64Image,
    PictureType pictureType, string fileName, int widthEmu, int heightEmu)
{
    // 处理可能的data URI前缀
    if (base64Image.Contains(","))
    {
        base64Image = base64Image.Substring(base64Image.IndexOf(",") + 1);
    }
    
    byte[] imageBytes = Convert.FromBase64String(base64Image);
    InsertImageFromBytes(doc, imageBytes, pictureType, fileName, widthEmu, heightEmu);
}
```

### 13.1.3 在表格单元格中插入图片

```csharp
/// <summary>
/// 在表格单元格中插入图片
/// </summary>
public static void InsertImageInCell(XWPFTableCell cell, string imagePath,
    int widthEmu, int heightEmu)
{
    // 获取或创建段落
    XWPFParagraph para = cell.Paragraphs.Count > 0 
        ? cell.Paragraphs[0] 
        : cell.AddParagraph();
    
    para.Alignment = ParagraphAlignment.CENTER;
    XWPFRun run = para.CreateRun();
    
    using FileStream fs = new FileStream(imagePath, FileMode.Open, FileAccess.Read);
    
    string extension = Path.GetExtension(imagePath).ToLower();
    PictureType pictureType = extension switch
    {
        ".png" => PictureType.PNG,
        ".jpg" or ".jpeg" => PictureType.JPEG,
        _ => PictureType.PNG
    };
    
    run.AddPicture(fs, (int)pictureType, Path.GetFileName(imagePath), widthEmu, heightEmu);
}
```

## 13.2 图片尺寸处理

### 13.2.1 自动计算尺寸

```csharp
using System.Drawing;

/// <summary>
/// 获取图片原始尺寸并按比例缩放
/// </summary>
public static (int width, int height) GetScaledImageSize(string imagePath, int maxWidthEmu)
{
    using var image = Image.FromFile(imagePath);
    
    int originalWidthEmu = PixelToEmu(image.Width);
    int originalHeightEmu = PixelToEmu(image.Height);
    
    if (originalWidthEmu <= maxWidthEmu)
    {
        return (originalWidthEmu, originalHeightEmu);
    }
    
    double ratio = (double)maxWidthEmu / originalWidthEmu;
    int scaledWidthEmu = maxWidthEmu;
    int scaledHeightEmu = (int)(originalHeightEmu * ratio);
    
    return (scaledWidthEmu, scaledHeightEmu);
}

/// <summary>
/// 插入自适应大小的图片
/// </summary>
public static void InsertAutoSizedImage(XWPFDocument doc, string imagePath, double maxWidthCm = 15)
{
    int maxWidthEmu = CmToEmu(maxWidthCm);
    var (width, height) = GetScaledImageSize(imagePath, maxWidthEmu);
    
    InsertImageFromFile(doc, imagePath, width, height);
}
```

### 13.2.2 固定宽度保持比例

```csharp
/// <summary>
/// 按固定宽度等比例插入图片
/// </summary>
public static void InsertImageWithFixedWidth(XWPFDocument doc, string imagePath, double widthCm)
{
    using var image = Image.FromFile(imagePath);
    
    double ratio = (double)image.Height / image.Width;
    int widthEmu = CmToEmu(widthCm);
    int heightEmu = (int)(widthEmu * ratio);
    
    InsertImageFromFile(doc, imagePath, widthEmu, heightEmu);
}
```

## 13.3 图片位置

### 13.3.1 图片居中

```csharp
/// <summary>
/// 插入居中图片
/// </summary>
public static void InsertCenteredImage(XWPFDocument doc, string imagePath,
    int widthEmu, int heightEmu)
{
    XWPFParagraph para = doc.CreateParagraph();
    para.Alignment = ParagraphAlignment.CENTER;
    
    XWPFRun run = para.CreateRun();
    
    using FileStream fs = new FileStream(imagePath, FileMode.Open, FileAccess.Read);
    PictureType pictureType = GetPictureType(imagePath);
    
    run.AddPicture(fs, (int)pictureType, Path.GetFileName(imagePath), widthEmu, heightEmu);
}

private static PictureType GetPictureType(string imagePath)
{
    string ext = Path.GetExtension(imagePath).ToLower();
    return ext switch
    {
        ".png" => PictureType.PNG,
        ".jpg" or ".jpeg" => PictureType.JPEG,
        ".gif" => PictureType.GIF,
        ".bmp" => PictureType.BMP,
        _ => PictureType.PNG
    };
}
```

### 13.3.2 图片说明文字

```csharp
/// <summary>
/// 插入带说明的图片
/// </summary>
public static void InsertImageWithCaption(XWPFDocument doc, string imagePath,
    int widthEmu, int heightEmu, string caption)
{
    // 插入图片
    XWPFParagraph imagePara = doc.CreateParagraph();
    imagePara.Alignment = ParagraphAlignment.CENTER;
    XWPFRun imageRun = imagePara.CreateRun();
    
    using (FileStream fs = new FileStream(imagePath, FileMode.Open, FileAccess.Read))
    {
        PictureType pictureType = GetPictureType(imagePath);
        imageRun.AddPicture(fs, (int)pictureType, Path.GetFileName(imagePath), widthEmu, heightEmu);
    }
    
    // 插入说明文字
    XWPFParagraph captionPara = doc.CreateParagraph();
    captionPara.Alignment = ParagraphAlignment.CENTER;
    XWPFRun captionRun = captionPara.CreateRun();
    captionRun.SetText(caption);
    captionRun.FontSize = 10;
    captionRun.SetColor("666666");
    captionRun.IsItalic = true;
}
```

## 13.4 图片辅助类

```csharp
/// <summary>
/// Word图片辅助类
/// </summary>
public static class WordImageHelper
{
    /// <summary>
    /// 像素转EMU
    /// </summary>
    public static int PixelToEmu(int pixels) => pixels * 9525;
    
    /// <summary>
    /// 厘米转EMU
    /// </summary>
    public static int CmToEmu(double cm) => (int)(cm * 360000);
    
    /// <summary>
    /// 英寸转EMU
    /// </summary>
    public static int InchToEmu(double inch) => (int)(inch * 914400);
    
    /// <summary>
    /// 获取图片类型
    /// </summary>
    public static PictureType GetPictureType(string imagePath)
    {
        string ext = Path.GetExtension(imagePath).ToLower();
        return ext switch
        {
            ".png" => PictureType.PNG,
            ".jpg" or ".jpeg" => PictureType.JPEG,
            ".gif" => PictureType.GIF,
            ".bmp" => PictureType.BMP,
            ".tiff" or ".tif" => PictureType.TIFF,
            ".emf" => PictureType.EMF,
            ".wmf" => PictureType.WMF,
            _ => PictureType.PNG
        };
    }
    
    /// <summary>
    /// 插入图片（简化方法）
    /// </summary>
    public static void InsertImage(XWPFDocument doc, string imagePath,
        double widthCm, double heightCm, ParagraphAlignment alignment = ParagraphAlignment.CENTER)
    {
        XWPFParagraph para = doc.CreateParagraph();
        para.Alignment = alignment;
        XWPFRun run = para.CreateRun();
        
        int widthEmu = CmToEmu(widthCm);
        int heightEmu = CmToEmu(heightCm);
        
        using FileStream fs = new FileStream(imagePath, FileMode.Open, FileAccess.Read);
        run.AddPicture(fs, (int)GetPictureType(imagePath), 
            Path.GetFileName(imagePath), widthEmu, heightEmu);
    }
    
    /// <summary>
    /// 插入图片保持原始比例
    /// </summary>
    public static void InsertImageKeepRatio(XWPFDocument doc, string imagePath,
        double maxWidthCm = 15, ParagraphAlignment alignment = ParagraphAlignment.CENTER)
    {
        using var image = Image.FromFile(imagePath);
        
        double ratio = (double)image.Height / image.Width;
        double widthCm = image.Width / 37.8;  // 大约的厘米值
        
        if (widthCm > maxWidthCm)
        {
            widthCm = maxWidthCm;
        }
        
        double heightCm = widthCm * ratio;
        
        InsertImage(doc, imagePath, widthCm, heightCm, alignment);
    }
    
    /// <summary>
    /// 在Run中插入图片
    /// </summary>
    public static void InsertImageInRun(XWPFRun run, string imagePath,
        double widthCm, double heightCm)
    {
        int widthEmu = CmToEmu(widthCm);
        int heightEmu = CmToEmu(heightCm);
        
        using FileStream fs = new FileStream(imagePath, FileMode.Open, FileAccess.Read);
        run.AddPicture(fs, (int)GetPictureType(imagePath),
            Path.GetFileName(imagePath), widthEmu, heightEmu);
    }
}
```

## 13.5 综合示例

### 13.5.1 创建图文混排文档

```csharp
public class ImageDocumentExample
{
    public static void CreateImageDocument()
    {
        XWPFDocument doc = new XWPFDocument();
        
        // 标题
        XWPFParagraph titlePara = doc.CreateParagraph();
        titlePara.Alignment = ParagraphAlignment.CENTER;
        XWPFRun titleRun = titlePara.CreateRun();
        titleRun.SetText("产品介绍");
        titleRun.IsBold = true;
        titleRun.FontSize = 22;
        
        doc.CreateParagraph();  // 空行
        
        // 产品图片（如果有）
        string imagePath = "product.jpg";
        if (File.Exists(imagePath))
        {
            WordImageHelper.InsertImageKeepRatio(doc, imagePath, 12);
            
            // 图片说明
            XWPFParagraph captionPara = doc.CreateParagraph();
            captionPara.Alignment = ParagraphAlignment.CENTER;
            XWPFRun captionRun = captionPara.CreateRun();
            captionRun.SetText("图1：产品外观");
            captionRun.FontSize = 10;
            captionRun.IsItalic = true;
            captionRun.SetColor("666666");
        }
        
        doc.CreateParagraph();
        
        // 产品说明文字
        XWPFParagraph descPara = doc.CreateParagraph();
        descPara.IndentationFirstLine = 420;
        XWPFRun descRun = descPara.CreateRun();
        descRun.SetText("这是一款高品质的产品，具有优秀的性能和美观的外观设计。" +
                       "采用先进的技术和优质的材料，为用户提供卓越的使用体验。");
        descRun.FontSize = 12;
        
        // 保存
        using (FileStream fs = new FileStream("图文文档.docx", FileMode.Create))
        {
            doc.Write(fs);
        }
        
        Console.WriteLine("图文文档创建成功！");
    }
}
```

## 13.6 本章小结

本章详细介绍了NPOI中Word图片的操作。通过本章学习，你应该掌握：

- 从文件、字节数组、Base64插入图片
- 在表格单元格中插入图片
- 图片尺寸的计算和转换（EMU单位）
- 图片的定位和对齐
- 图片说明文字的添加
- 图片辅助类的封装

图片是文档中重要的视觉元素，掌握图片操作可以创建更加丰富的Word文档。

---

> **下一章预告**：第十四章将介绍Word页眉页脚与页面设置。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第12章-Word表格操作" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第14章-Word页眉页脚与页面设置" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

---
layout: default
title: 第十三章：Word图片与多媒体
---

# 第十三章：Word图片与多媒体

## 13.1 插入图片

Word 文档里的图片不是"放在段落里的一张图"，而是一个引用：真正的图像字节存在文档包的媒体目录（`word/media/`）里，正文中是一个 drawing 元素，指向该媒体文件并记录显示尺寸与位置。

NPOI 把这两步合在了一起。调用 `run.AddPicture` 时，它把图像字节写入媒体部分，并在当前 Run 里插入指向它的 drawing 元素。理解这层机制，就能解释两个常见现象：同一张图片插入两次会在包里存两份（除非自己去重）；图片的显示尺寸与文件的实际像素无关，完全由传入的 EMU 值决定。

这一节讲三种来源（文件、字节数组、Base64）和一种特殊位置（表格单元格）。四段代码的骨架相同，差别只在"字节从哪来"。

### 13.1.1 从文件插入图片

这个方法是本章的基础版本，按顺序做四件事：建段落并居中、建 Run、打开文件流、调用 `AddPicture`。

`AddPicture` 的四个参数依次是：图像流、`PictureType` 的整型值、文件名（写入文档包时作为媒体文件名）、宽高（EMU）。第三个参数看起来无关紧要，实际上决定了包内媒体文件的扩展名，影响 Word 打开时能否正确识别格式。示例传 `Path.GetFileName(imagePath)`，保留了原扩展名，这是正确的做法。

`PictureType` 的强制转换 `(int)pictureType` 是必须的，因为方法签名要求整型。NPOI 的 `PictureType` 枚举值直接对应 OOXML 里的图像类型编号。

**EMU 是本章最重要的概念。** EMU（English Metric Units）是 OOXML 的通用长度单位，定义为一英寸的 914400 分之一。三个换算关系要记住：1 英寸 = 914400 EMU，1 厘米 = 360000 EMU，96 DPI 下 1 像素 = 9525 EMU。后一个数值是 914400 除以 96 得到的，所以它只在 96 DPI 的假设下成立。

示例末尾三个换算方法把像素、厘米、英寸统一到 EMU。单位混用是图片尺寸出错的头号原因：把像素当 EMU 传进去，图片会小到几乎看不见（相差 9525 倍）；把 EMU 当像素传，会大到让 Word 拒绝显示。

文件流用 `using` 包住是必要的。`AddPicture` 会在调用期间读取流内容并写入文档，调用返回后流即可关闭。反过来，如果在 `using` 块之外复用这个流，或者延迟到写文档时才关闭，就会读到已释放的流而抛异常。

还有一处值得注意：文件以 `FileAccess.Read` 打开且没有指定共享模式。如果同一张图正在被其他程序（比如预览工具）读写，打开会失败并抛 `IOException`。批量插入图片时，加上 `FileShare.Read` 能减少这类偶发失败。

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

字节数组版本适用于图片不在磁盘上的场景：来自数据库的 BLOB、从网络下载的响应体、内存里生成的图表、用户上传后暂存的内容。

实现上只是把 `FileStream` 换成 `MemoryStream`，其余完全一致。`MemoryStream` 不需要 `using` 释放也无所谓（它不持有句柄），但示例仍然用 `using` 包住，属于好习惯。

调用方需要注意的是**图片类型必须显式告知**。从文件插入时可以靠扩展名推断，字节数组没有扩展名，只能由调用方传入 `PictureType`。传错类型的后果不是抛异常，而是文档包里媒体文件的类型标记与实际内容不符，Word 打开时可能显示"无法显示此图片"。

Base64 版本在上面再包一层：先剥掉 data URI 前缀，再解码。

`if (base64Image.Contains(","))` 这段处理的是 `data:image/png;base64,iVBORw0...` 这种格式。从 HTML、前端接口拿到的 Base64 图片通常带这个前缀，直接 `Convert.FromBase64String` 会抛 `FormatException`。示例用逗号作为分隔符，简单有效，但有一个边界情况：如果 Base64 内容本身包含逗号（标准 Base64 字符集里没有逗号，所以安全）。

真正的坑在别处：Base64 字符串常带换行。有些序列化器会每 76 个字符插一个换行，`Convert.FromBase64String` 遇到换行会失败。稳妥做法是先 `Replace("\r", "").Replace("\n", "")` 再解码。

解码后的字节数组可能很大。一张 2MB 的图片解码后仍是 2MB，插入文档后包体积也增加 2MB。批量插入图片时，包体积增长是最容易被忽略的上限——Word 对单个文档没有硬性大小限制，但打开和编辑体验会随体积明显下降。

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

单元格里的图片在结构上是"单元格内某个段落中的 Run"，不是单元格的属性。所以插入图片的本质是：找到或创建单元格里的段落，再在段落里建 Run 插图。

示例处理了"段落可能不存在"的情况：`cell.Paragraphs.Count > 0 ? cell.Paragraphs[0] : cell.AddParagraph()`。单元格在创建时通常自带一个空段落，但经过某些操作（比如先 `SetText` 再清空）之后段落结构可能变化，判空比假设更稳。

选用第一个段落而不是新建段落，是有意为之：图片应当与单元格里的其他内容在同一段（或者占据已有段落的起始位置），新建段落会让图片另起一行，单元格高度被撑大。

单元格里插图的常见需求是"产品图 + 名称"两行，实现方式是插完图之后在当前段落加换行（`run.AddBreak()`），或者再建一个段落写文字。前者图片与文字在同一段内，后者分成两段，对垂直对齐的控制不同。

图片宽度要按单元格宽度来算。单元格宽度是 twip（示例 12.1.4 里用 `SetWidth("2000")` 设置），EMU 与 twip 的换算关系是 1 twip = 635 EMU（1440 twip 等于 914400 EMU）。按 `2000 twip = 1270000 EMU` 计算，图片宽度小于这个值才能放进单元格。算错会怎样？图片会撑开单元格，整张表跟着变形，而不是被裁剪。

这个方法不支持百分比宽度。想做成"图片宽度等于单元格宽度的一定比例"，只能先算出单元格宽度的 EMU，再乘以比例传给 `AddPicture`。

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

图片尺寸在 Word 里有两个互相独立的量：像素尺寸（文件本身的宽高）和显示尺寸（EMU）。插入时不指定显示尺寸，Word 会按文件里的 DPI 元数据换算一个默认值；指定了就以指定的为准。

NPOI 的 `AddPicture` 必须显式传宽高，所以"怎么算这个宽高"成了绕不开的问题。两种策略：按最大宽度等比缩放，或者按固定宽度等比缩放。两者的共同目标是保持宽高比，避免图片被拉伸变形。

### 13.2.1 自动计算尺寸

`GetScaledImageSize` 的逻辑是：读原图像素尺寸，换算成 EMU，如果不超过最大宽度就原样返回，超过就按比例缩小。

`Image.FromFile` 来自 `System.Drawing`，只用于读取尺寸，不参与文档生成。这里有一个平台限制必须说清楚：从 .NET 6 起，`System.Drawing.Common` 只支持 Windows，在 Linux 或容器里调用 `Image.FromFile` 会抛 `PlatformNotSupportedException`。服务端生成文档时如果跑在 Linux 容器里，这段代码会直接失败。

替代方案有两个。一是用跨平台的图像库读取尺寸，只读头部信息即可，不必解码整张图；二是插入时不读原图尺寸，改用固定宽度加"按原始比例"的方式，让 Word 自己算高度——但那需要图片本身带有正确的 DPI 元数据，且 NPOI 的 `AddPicture` 签名要求给高度，绕不开。

示例的换算默认了 96 DPI。一张 3000 像素宽的高清照片按 96 DPI 计算，宽度是 31 英寸，远超页面宽度，必然被缩放；而它在 Word 里插入时按原始 DPI 可能只有 10 英寸。这解释了为什么"同样像素的图片插入后大小不同"——差异来自文件里的 DPI 元数据，而 `PixelToEmu` 硬编码了 96。

`InsertAutoSizedImage` 把默认最大宽度设成 15 厘米，接近 A4 纸正文宽度。这个默认值是合理的起点，但不同版式的页面正文宽度不同，应当从页面设置里算，或者在调用处传入。

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

这个方法反过来：先定显示宽度，再按原图宽高比算高度。

`ratio = (double)image.Height / image.Width` 得到高宽比（不是宽高比），然后 `heightEmu = widthEmu * ratio`。这里要求 `ratio` 是浮点数——两个 `int` 相除会做整数除法，215/300 得到 0，高度变成 0，图片不可见。示例里 `(double)` 强制转换就是为这个。

固定宽度的使用场景是版式统一：技术文档里的截图宽度一致、产品清单里的产品图宽度一致，看起来整齐。代价是竖图和横图的高度差异很大，需要人工检查页面是否被撑爆。

比例计算之外还有一个细节：`widthCm` 是显示宽度，不是像素宽度。示例里传 12 表示 12 厘米，不是 12 像素。方法名 `InsertImageWithFixedWidth` 没有在参数名上体现单位，调用时看方法签名容易误传，参数名带单位（`widthCm`）是更好的习惯。

如果原图本身很小（比如 100 像素宽的图标），按固定 12 厘米插入会被放大，像素化明显。稳妥做法是加一个上限判断：原图宽度小于目标宽度时不放大。13.4 节的 `InsertImageKeepRatio` 做了这个判断（`if (widthCm > maxWidthCm) widthCm = maxWidthCm;`），可以对照着看。

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

图片默认是行内（inline）元素，跟着段落文字走，受段落对齐方式控制。这与"浮动图片"（可以自由拖到任意位置、文字环绕）是两种定位模式。

NPOI 对行内图片的支持成熟，对浮动图片的支持要弱得多——需要手工构造 drawing 里的定位属性。本章所有示例都是行内图片，这也是生成文档时更常用、更可靠的方式：排版结果可预测，不会因为文字增减导致图片漂移。

行内图片的位置控制只有一条：通过段落对齐控制水平位置，通过段落间距和前后内容控制垂直位置。

### 13.3.1 图片居中

居中的实现就是设置段落对齐 `para.Alignment = ParagraphAlignment.CENTER`，图片作为段落里唯一的 Run，自然居中。

这个方法与 13.1.1 几乎相同，唯一的差别是图片类型推断被抽成了 `GetPictureType` 私有方法。这种重构是对的——类型推断的逻辑在好几处重复，抽出来之后新增格式只改一处。

评估图片位置时容易忽略的一点：图片居中不等于图片所在行居中。如果段落里还有其他文字（比如图片后跟了一句说明），居中作用的是整行内容，图片会偏。图片居中应当保证段落里只有图片，说明文字另起一段。

左右留白不足时，居中的效果会不明显。图片宽度接近正文宽度时，居中后左右各剩几个像素的边距，视觉上和左对齐差不多。这种情况下应当先缩小图片，而不是继续调对齐。

居中的判定方法是看 Word 里段落标记的位置：居中段落的标记在行末靠右，左对齐的在行首。排查"设置了居中但没生效"时，先确认设置的是图片所在段落，而不是上一个段落。

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

示例用两段实现图片加说明：第一段放图片，第二段放说明文字。说明文字设成 10 号、灰色 `666666`、斜体、居中。

这个组合是技术文档里图注的常见样式：比正文小一号，颜色弱化，与正文区分开但不抢视觉。斜体在中文里效果有限（中文字体大多没有真正的斜体，Word 会做倾斜变换），英文图注用斜体更自然。

两段结构的排版效果是图在上、注在下，段间距决定两者的距离。示例没有设置段前段后间距，默认间距可能偏大，图注与图片之间出现明显空隙。要贴紧，可以给图注段落设 `SpacingBefore` 为较小的值，或者给图片段落设 `SpacingAfter` 为 0。

图注的编号与交叉引用是另一个层面的事。示例里的 "图1：产品外观" 是手工编号，加一张图就要改后面所有编号。Word 的题注（Caption）机制能自动编号并支持正文交叉引用，但 NPOI 对域（field）的支持有限，实现方式是用 `fldSimple` 之类的域代码手工构造，复杂度明显高于手写编号。

图注宽度通常不需要限制，因为它跟图片宽度无关，只跟页面宽度有关。图注过长时应当换行而不是缩小字号，否则与正文的字号对比失衡。

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

辅助类把前面散落的方法收成一组静态方法，分成三类：单位换算、类型推断、插入封装。

单位换算三个方法是一行表达式，没有讨论价值，但它们出现的频率很高，抽出来能避免到处写 `9525`、`360000` 这类魔数。

类型推断 `GetPictureType` 在之前的示例里已经出现过两次，这里变成了公开方法，并且补上了 EMF、WMF 两种矢量格式。EMF（增强型图元文件）和 WMF（Windows 图元文件）是 Office 生态里常见的矢量格式，插入后缩放不失真，报表里的图表导出常这两类格式。默认分支返回 PNG，对无法识别的扩展名是一种容错，但也会掩盖问题——传错扩展名时图片以 PNG 类型写入，Word 打开才发现不显示，错误点离原因很远。

`InsertImage` 是"给定厘米尺寸直接插入"的简化入口，把段落创建、对齐、Run 创建、单位换算、类型推断、流打开全部包住，调用方只关心路径和尺寸。这种封装适合调用点多、参数简单的场景。

`InsertImageKeepRatio` 里出现了一个经验换算：`image.Width / 37.8` 把像素换算成厘米。1 厘米 = 37.8 像素是按 96 DPI 推出来的（96 / 2.54 ≈ 37.8），与 `PixelToEmu` 里的 9525 是同一个假设。两处都硬编码了这个假设，改 DPI 时容易只改一处——更好的做法是统一走 `PixelToEmu` 再换算到厘米。

这个方法还做了"不放大"的判断：原图宽度小于最大宽度时保持原尺寸，超过才缩到最大宽度。这个细节比 13.2.2 的固定宽度版本更完善，也是实际项目里更常用的策略。

`InsertImageInRun` 把插图能力暴露到 Run 级别，允许调用方自己控制段落和 Run 的创建。用于"图片和文字在同一段"的场景，比如行内图标、表情符号。使用时要自己保证 Run 属于一个已经加入文档的段落，否则插进去的图片不会出现在文档里。

整个辅助类有一个共同局限：全部是同步 IO、每次调用都新开文件流。批量处理上千张图片时，可以考虑复用流或改用字节数组版本，避免频繁打开文件。

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

示例把辅助类用到一份产品介绍文档上：标题、产品图、图注、说明文字、保存。

这段代码的重点不在 API 调用，而在于演示了一个完整的"图文文档"如何在代码里组织。生成这类文档的难点通常是排版细节，而不是接口调用。

### 13.5.1 创建图文混排文档

逐段看这份文档的构成。

标题段用 22 号加粗居中，随后 `doc.CreateParagraph()` 插入空行。空行的作用是与图片拉开距离，但用空段落做间距不是最佳实践——更好的方式是给标题段落设置 `SpacingAfter`，这样调整距离不用增删段落。

产品图片那段有一个 `if (File.Exists(imagePath))` 判断。这是生成文档时必须养成的习惯：图片素材可能缺失，直接插入会抛 `FileNotFoundException`，整个文档生成失败。加了判断之后，即使图片不在，文档仍能生成，图注部分也一并跳过，不会出现"有图注没图"的尴尬。

`InsertImageKeepRatio(doc, imagePath, 12)` 的 12 是最大宽度 12 厘米，换算成 EMU 约 4320000。这个宽度在 A4 竖版正文里留有余量，是安全的默认值。

图注段落重复了 13.3.2 里的格式设置：10 号、斜体、灰色、居中。这段代码在示例里是内联写的，实际项目中应当抽成 `AddCaption(doc, text)` 方法——图注样式在整份文档里必须一致，内联写容易出现某张图的图注字号不同。

说明文字用 `IndentationFirstLine = 420` 做首行缩进两个字符，字号 12。两段文字通过字符串拼接（`+`）合并在一个 Run 里，这会让整段使用同一格式。如果要对其中某句加粗，需要用多个 Run，做法参照第十一章的富文本段落。

保存用 `FileStream` 加 `FileMode.Create`，路径是相对路径。示例最后一行的 `Console.WriteLine` 只表示"没有抛异常"，不表示文档内容正确——生成结果的验证还是要靠人打开检查。

整段代码缺少异常处理和资源释放。`XWPFDocument` 是 `IDisposable`，正确写法是 `using var doc = new XWPFDocument();`，否则中途抛异常时文档对象不会被释放。批量生成时，这类小问题会累积成句柄泄露。

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

本章的难点集中在两处：单位换算和跨平台图像读取。前者靠三个换算常数（914400、360000、9525）解决，后者在 Linux 部署时需要特别注意 `System.Drawing` 的限制。

三条实践建议。第一，图片尺寸统一走辅助类换算，不要在业务代码里散落魔数。第二，插入前判断文件是否存在，批量生成时缺图是常态。第三，生成的文档一定用 Word 打开检查图片是否显示、比例是否正确——这两个问题自动化测试覆盖不到。

---

> **下一章预告**：第十四章将介绍Word页眉页脚与页面设置。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/csharp/npoi/第12章-Word表格操作/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第14章-Word页眉页脚与页面设置/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

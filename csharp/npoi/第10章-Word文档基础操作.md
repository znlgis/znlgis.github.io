---
layout: default
title: 第十章：Word文档基础操作
---

# 第十章：Word文档基础操作

## 10.1 NPOI Word概述

### 10.1.1 支持的Word格式

NPOI支持两种Word文档格式：

| 格式 | 扩展名 | 说明 | NPOI类 |
|------|--------|------|--------|
| Word 2007+ | .docx | OpenXML格式 | XWPFDocument |
| Word 97-2003 | .doc | 二进制格式 | HWPFDocument（有限支持） |

**推荐使用XWPF**：功能更完整，支持更好。

### 10.1.2 基本命名空间

```csharp
using NPOI.XWPF.UserModel;
using NPOI.OpenXmlFormats.Wordprocessing;
using System.IO;
```

### 10.1.3 Word文档结构

```
XWPFDocument（文档）
├── XWPFParagraph（段落）
│   └── XWPFRun（文本运行/格式块）
├── XWPFTable（表格）
│   ├── XWPFTableRow（行）
│   │   └── XWPFTableCell（单元格）
│   │       └── XWPFParagraph
├── XWPFHeader（页眉）
├── XWPFFooter（页脚）
└── XWPFPictureData（图片数据）
```

## 10.2 文档基本操作

### 10.2.1 创建新文档

```csharp
using NPOI.XWPF.UserModel;
using System.IO;

// 创建新文档
XWPFDocument doc = new XWPFDocument();

// 添加内容
XWPFParagraph para = doc.CreateParagraph();
XWPFRun run = para.CreateRun();
run.SetText("Hello, NPOI Word!");

// 保存文档
using (FileStream fs = new FileStream("document.docx", FileMode.Create))
{
    doc.Write(fs);
}
```

### 10.2.2 打开现有文档

```csharp
// 方式一：从文件路径打开
using (FileStream fs = new FileStream("document.docx", FileMode.Open, FileAccess.Read))
{
    XWPFDocument doc = new XWPFDocument(fs);
    // 进行操作...
}

// 方式二：从内存流打开
byte[] fileBytes = File.ReadAllBytes("document.docx");
using (MemoryStream ms = new MemoryStream(fileBytes))
{
    XWPFDocument doc = new XWPFDocument(ms);
    // 进行操作...
}
```

### 10.2.3 保存文档

```csharp
// 保存到文件
using (FileStream fs = new FileStream("output.docx", FileMode.Create))
{
    doc.Write(fs);
}

// 保存到内存流
using (MemoryStream ms = new MemoryStream())
{
    doc.Write(ms);
    byte[] docBytes = ms.ToArray();
    // 可用于HTTP响应等
}

// 注意：Write方法不会自动关闭流，需要手动处理
```

### 10.2.4 文档属性设置

```csharp
// 获取文档属性
var properties = doc.GetProperties();

// 核心属性
var coreProps = properties.CoreProperties;
coreProps.Title = "文档标题";
coreProps.Creator = "作者";
coreProps.Subject = "主题";
coreProps.Description = "描述";
coreProps.Keywords = "关键词1, 关键词2";
coreProps.Category = "类别";

// 扩展属性
var extProps = properties.ExtendedProperties;
extProps.Application = "NPOI";
extProps.Company = "公司名称";
```

## 10.3 段落操作

### 10.3.1 创建段落

```csharp
// 创建段落
XWPFParagraph para = doc.CreateParagraph();

// 在指定位置插入段落
// XWPFParagraph insertedPara = doc.InsertNewParagraph(cursor);

// 获取所有段落
IList<XWPFParagraph> paragraphs = doc.Paragraphs;

// 遍历段落
foreach (XWPFParagraph p in paragraphs)
{
    Console.WriteLine(p.Text);
}
```

### 10.3.2 段落对齐方式

```csharp
XWPFParagraph para = doc.CreateParagraph();

// 设置对齐方式
para.Alignment = ParagraphAlignment.LEFT;      // 左对齐
para.Alignment = ParagraphAlignment.CENTER;    // 居中
para.Alignment = ParagraphAlignment.RIGHT;     // 右对齐
para.Alignment = ParagraphAlignment.BOTH;      // 两端对齐
para.Alignment = ParagraphAlignment.DISTRIBUTE; // 分散对齐
```

### 10.3.3 段落缩进

```csharp
XWPFParagraph para = doc.CreateParagraph();

// 首行缩进（单位：twip，1英寸=1440 twip）
para.IndentationFirstLine = 720;  // 0.5英寸

// 左缩进
para.IndentationLeft = 720;

// 右缩进
para.IndentationRight = 720;

// 悬挂缩进
para.IndentationHanging = 720;
```

### 10.3.4 段落间距

```csharp
XWPFParagraph para = doc.CreateParagraph();

// 段前间距（单位：磅的20倍）
para.SpacingBefore = 200;  // 10磅

// 段后间距
para.SpacingAfter = 200;

// 行间距
para.SpacingBetween = 1.5;  // 1.5倍行距

// 行间距类型
para.SpacingLineRule = LineSpacingRule.AUTO;      // 自动
para.SpacingLineRule = LineSpacingRule.EXACT;     // 固定值
para.SpacingLineRule = LineSpacingRule.ATLEAST;   // 最小值
```

### 10.3.5 段落边框和底纹

```csharp
XWPFParagraph para = doc.CreateParagraph();

// 设置边框
para.SetBorderBottom(Borders.Single, 4, 0, "000000");  // 下边框
para.SetBorderTop(Borders.Single, 4, 0, "000000");     // 上边框
para.SetBorderLeft(Borders.Single, 4, 0, "000000");    // 左边框
para.SetBorderRight(Borders.Single, 4, 0, "000000");   // 右边框

// 边框样式
// Borders.Single - 单线
// Borders.Double - 双线
// Borders.Dashed - 虚线
// Borders.Dotted - 点线
// Borders.None   - 无边框
```

## 10.4 文本运行（Run）操作

### 10.4.1 创建和设置文本

```csharp
XWPFParagraph para = doc.CreateParagraph();

// 创建文本运行
XWPFRun run = para.CreateRun();

// 设置文本
run.SetText("这是一段文本");

// 追加文本（在同一Run中）
run.AppendText("，这是追加的文本");

// 添加换行
run.AddBreak();

// 添加分页符
run.AddBreak(BreakType.PAGE);

// 添加制表符
run.AddTab();
```

### 10.4.2 字体设置

```csharp
XWPFRun run = para.CreateRun();
run.SetText("格式化文本");

// 字体名称
run.SetFontFamily("微软雅黑", FontCharRange.None);

// 字号（磅）
run.FontSize = 14;

// 加粗
run.IsBold = true;

// 斜体
run.IsItalic = true;

// 下划线
run.Underline = UnderlinePatterns.Single;
run.Underline = UnderlinePatterns.Double;
run.Underline = UnderlinePatterns.Dash;
run.Underline = UnderlinePatterns.DotDash;
run.Underline = UnderlinePatterns.Wave;

// 删除线
run.IsStrikeThrough = true;

// 双删除线
run.IsDoubleStrikeThrough = true;

// 上标/下标
run.Subscript = VerticalAlign.SUPERSCRIPT;  // 上标
run.Subscript = VerticalAlign.SUBSCRIPT;    // 下标
run.Subscript = VerticalAlign.BASELINE;     // 正常
```

### 10.4.3 字体颜色

```csharp
XWPFRun run = para.CreateRun();
run.SetText("彩色文本");

// 设置颜色（十六进制RGB）
run.SetColor("FF0000");  // 红色
run.SetColor("00FF00");  // 绿色
run.SetColor("0000FF");  // 蓝色

// 高亮颜色
run.SetTextHighlightColor("yellow");
```

### 10.4.4 文本效果

```csharp
XWPFRun run = para.CreateRun();
run.SetText("效果文本");

// 小型大写字母
run.IsSmallCaps = true;

// 全部大写
run.IsCapitalized = true;

// 隐藏文本
run.IsVanish = true;

// 阴影效果
run.IsShadowed = true;

// 浮雕效果
run.IsEmbossed = true;

// 阴文效果
run.IsImprinted = true;
```

## 10.5 读取文档内容

### 10.5.1 读取文本

```csharp
using (FileStream fs = new FileStream("document.docx", FileMode.Open, FileAccess.Read))
{
    XWPFDocument doc = new XWPFDocument(fs);
    
    // 方式一：获取全部文本
    string allText = "";
    foreach (XWPFParagraph para in doc.Paragraphs)
    {
        allText += para.Text + Environment.NewLine;
    }
    
    // 方式二：逐段落逐Run读取
    foreach (XWPFParagraph para in doc.Paragraphs)
    {
        foreach (XWPFRun run in para.Runs)
        {
            string text = run.Text;
            bool isBold = run.IsBold;
            int fontSize = run.FontSize;
            Console.WriteLine($"文本: {text}, 加粗: {isBold}, 字号: {fontSize}");
        }
    }
}
```

### 10.5.2 读取表格

```csharp
foreach (XWPFTable table in doc.Tables)
{
    foreach (XWPFTableRow row in table.Rows)
    {
        foreach (XWPFTableCell cell in row.GetTableCells())
        {
            string cellText = cell.GetText();
            Console.Write($"{cellText}\t");
        }
        Console.WriteLine();
    }
}
```

### 10.5.3 提取所有文本

```csharp
/// <summary>
/// 提取Word文档的所有文本
/// </summary>
public static string ExtractAllText(XWPFDocument doc)
{
    StringBuilder sb = new StringBuilder();
    
    // 提取段落文本
    foreach (XWPFParagraph para in doc.Paragraphs)
    {
        sb.AppendLine(para.Text);
    }
    
    // 提取表格文本
    foreach (XWPFTable table in doc.Tables)
    {
        foreach (XWPFTableRow row in table.Rows)
        {
            foreach (XWPFTableCell cell in row.GetTableCells())
            {
                foreach (XWPFParagraph para in cell.Paragraphs)
                {
                    sb.AppendLine(para.Text);
                }
            }
        }
    }
    
    return sb.ToString();
}
```

## 10.6 文档结构操作

### 10.6.1 获取文档元素

```csharp
// 获取所有段落
IList<XWPFParagraph> paragraphs = doc.Paragraphs;

// 获取所有表格
IList<XWPFTable> tables = doc.Tables;

// 获取所有图片
IList<XWPFPictureData> pictures = doc.AllPictures;

// 获取页眉
IList<XWPFHeader> headers = doc.HeaderList;

// 获取页脚
IList<XWPFFooter> footers = doc.FooterList;

// 获取文档体元素（段落和表格的混合列表）
IList<IBodyElement> bodyElements = doc.BodyElements;
foreach (IBodyElement element in bodyElements)
{
    if (element is XWPFParagraph para)
    {
        Console.WriteLine($"段落: {para.Text}");
    }
    else if (element is XWPFTable table)
    {
        Console.WriteLine($"表格: {table.Rows.Count}行");
    }
}
```

### 10.6.2 删除元素

```csharp
// 删除段落（通过位置）
doc.RemoveBodyElement(0);

// 删除表格
XWPFTable table = doc.Tables[0];
doc.RemoveBodyElement(doc.GetPosOfTable(table));

// 清空文档
while (doc.BodyElements.Count > 0)
{
    doc.RemoveBodyElement(0);
}
```

## 10.7 文档辅助类

```csharp
/// <summary>
/// Word文档辅助类
/// </summary>
public static class WordDocumentHelper
{
    /// <summary>
    /// 创建新文档
    /// </summary>
    public static XWPFDocument CreateDocument()
    {
        return new XWPFDocument();
    }
    
    /// <summary>
    /// 从文件打开文档
    /// </summary>
    public static XWPFDocument OpenDocument(string filePath)
    {
        using FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        return new XWPFDocument(fs);
    }
    
    /// <summary>
    /// 保存文档到文件
    /// </summary>
    public static void SaveDocument(XWPFDocument doc, string filePath)
    {
        using FileStream fs = new FileStream(filePath, FileMode.Create);
        doc.Write(fs);
    }
    
    /// <summary>
    /// 保存文档到字节数组
    /// </summary>
    public static byte[] SaveToBytes(XWPFDocument doc)
    {
        using MemoryStream ms = new MemoryStream();
        doc.Write(ms);
        return ms.ToArray();
    }
    
    /// <summary>
    /// 添加标题段落
    /// </summary>
    public static XWPFParagraph AddTitle(XWPFDocument doc, string text, int level = 1)
    {
        XWPFParagraph para = doc.CreateParagraph();
        para.Alignment = ParagraphAlignment.CENTER;
        
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.IsBold = true;
        run.FontSize = level switch
        {
            1 => 22,
            2 => 18,
            3 => 14,
            _ => 12
        };
        run.SetFontFamily("黑体", FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 添加正文段落
    /// </summary>
    public static XWPFParagraph AddParagraph(XWPFDocument doc, string text,
        int fontSize = 12, string fontFamily = "宋体",
        ParagraphAlignment alignment = ParagraphAlignment.LEFT,
        int firstLineIndent = 0)
    {
        XWPFParagraph para = doc.CreateParagraph();
        para.Alignment = alignment;
        
        if (firstLineIndent > 0)
        {
            para.IndentationFirstLine = firstLineIndent;
        }
        
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.FontSize = fontSize;
        run.SetFontFamily(fontFamily, FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 添加格式化文本到段落
    /// </summary>
    public static XWPFRun AddFormattedText(XWPFParagraph para, string text,
        bool bold = false, bool italic = false, string color = null,
        int? fontSize = null, string fontFamily = null,
        UnderlinePatterns underline = UnderlinePatterns.None)
    {
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.IsBold = bold;
        run.IsItalic = italic;
        
        if (!string.IsNullOrEmpty(color))
            run.SetColor(color);
        
        if (fontSize.HasValue)
            run.FontSize = fontSize.Value;
        
        if (!string.IsNullOrEmpty(fontFamily))
            run.SetFontFamily(fontFamily, FontCharRange.None);
        
        if (underline != UnderlinePatterns.None)
            run.Underline = underline;
        
        return run;
    }
    
    /// <summary>
    /// 添加分页符
    /// </summary>
    public static void AddPageBreak(XWPFDocument doc)
    {
        XWPFParagraph para = doc.CreateParagraph();
        XWPFRun run = para.CreateRun();
        run.AddBreak(BreakType.PAGE);
    }
    
    /// <summary>
    /// 查找并替换文本
    /// </summary>
    public static void FindAndReplace(XWPFDocument doc, string findText, string replaceText)
    {
        // 替换段落中的文本
        foreach (XWPFParagraph para in doc.Paragraphs)
        {
            ReplaceInParagraph(para, findText, replaceText);
        }
        
        // 替换表格中的文本
        foreach (XWPFTable table in doc.Tables)
        {
            foreach (XWPFTableRow row in table.Rows)
            {
                foreach (XWPFTableCell cell in row.GetTableCells())
                {
                    foreach (XWPFParagraph para in cell.Paragraphs)
                    {
                        ReplaceInParagraph(para, findText, replaceText);
                    }
                }
            }
        }
    }
    
    private static void ReplaceInParagraph(XWPFParagraph para, string findText, string replaceText)
    {
        string text = para.Text;
        if (text.Contains(findText))
        {
            foreach (XWPFRun run in para.Runs)
            {
                string runText = run.Text;
                if (runText != null && runText.Contains(findText))
                {
                    run.SetText(runText.Replace(findText, replaceText), 0);
                }
            }
        }
    }
}
```

## 10.8 综合示例

### 10.8.1 创建简单文档

```csharp
public class SimpleDocumentExample
{
    public static void CreateDocument()
    {
        XWPFDocument doc = new XWPFDocument();
        
        // 标题
        XWPFParagraph titlePara = doc.CreateParagraph();
        titlePara.Alignment = ParagraphAlignment.CENTER;
        XWPFRun titleRun = titlePara.CreateRun();
        titleRun.SetText("NPOI Word文档示例");
        titleRun.IsBold = true;
        titleRun.FontSize = 22;
        titleRun.SetFontFamily("黑体", FontCharRange.None);
        
        // 空行
        doc.CreateParagraph();
        
        // 一级标题
        XWPFParagraph h1Para = doc.CreateParagraph();
        XWPFRun h1Run = h1Para.CreateRun();
        h1Run.SetText("1. 简介");
        h1Run.IsBold = true;
        h1Run.FontSize = 16;
        
        // 正文段落
        XWPFParagraph bodyPara1 = doc.CreateParagraph();
        bodyPara1.IndentationFirstLine = 420;  // 首行缩进2字符
        XWPFRun bodyRun1 = bodyPara1.CreateRun();
        bodyRun1.SetText("NPOI是一个强大的.NET库，用于读取和写入Microsoft Office文件。" +
                        "本文档演示了如何使用NPOI创建Word文档。");
        bodyRun1.FontSize = 12;
        bodyRun1.SetFontFamily("宋体", FontCharRange.None);
        
        // 二级标题
        XWPFParagraph h2Para = doc.CreateParagraph();
        XWPFRun h2Run = h2Para.CreateRun();
        h2Run.SetText("1.1 特点");
        h2Run.IsBold = true;
        h2Run.FontSize = 14;
        
        // 列表项
        string[] features = {
            "无需安装Office",
            "跨平台支持",
            "开源免费",
            "功能丰富"
        };
        
        foreach (string feature in features)
        {
            XWPFParagraph listPara = doc.CreateParagraph();
            listPara.IndentationLeft = 420;
            XWPFRun listRun = listPara.CreateRun();
            listRun.SetText("• " + feature);
            listRun.FontSize = 12;
            listRun.SetFontFamily("宋体", FontCharRange.None);
        }
        
        // 带格式的段落
        XWPFParagraph formatPara = doc.CreateParagraph();
        formatPara.IndentationFirstLine = 420;
        
        XWPFRun normalRun = formatPara.CreateRun();
        normalRun.SetText("这是");
        normalRun.FontSize = 12;
        
        XWPFRun boldRun = formatPara.CreateRun();
        boldRun.SetText("加粗");
        boldRun.IsBold = true;
        boldRun.FontSize = 12;
        
        XWPFRun normalRun2 = formatPara.CreateRun();
        normalRun2.SetText("和");
        normalRun2.FontSize = 12;
        
        XWPFRun italicRun = formatPara.CreateRun();
        italicRun.SetText("斜体");
        italicRun.IsItalic = true;
        italicRun.FontSize = 12;
        
        XWPFRun normalRun3 = formatPara.CreateRun();
        normalRun3.SetText("以及");
        normalRun3.FontSize = 12;
        
        XWPFRun colorRun = formatPara.CreateRun();
        colorRun.SetText("彩色");
        colorRun.SetColor("FF0000");
        colorRun.FontSize = 12;
        
        XWPFRun normalRun4 = formatPara.CreateRun();
        normalRun4.SetText("文本的示例。");
        normalRun4.FontSize = 12;
        
        // 保存文档
        using (FileStream fs = new FileStream("简单文档.docx", FileMode.Create))
        {
            doc.Write(fs);
        }
        
        Console.WriteLine("文档创建成功！");
    }
}
```

### 10.8.2 读取和修改文档

```csharp
public class ModifyDocumentExample
{
    public static void ModifyDocument(string inputPath, string outputPath)
    {
        // 打开文档
        XWPFDocument doc;
        using (FileStream fs = new FileStream(inputPath, FileMode.Open, FileAccess.Read))
        {
            doc = new XWPFDocument(fs);
        }
        
        // 读取并显示内容
        Console.WriteLine("原文档内容：");
        foreach (XWPFParagraph para in doc.Paragraphs)
        {
            Console.WriteLine(para.Text);
        }
        
        // 修改第一个段落
        if (doc.Paragraphs.Count > 0)
        {
            XWPFParagraph firstPara = doc.Paragraphs[0];
            if (firstPara.Runs.Count > 0)
            {
                firstPara.Runs[0].SetText("修改后的标题", 0);
                firstPara.Runs[0].SetColor("0000FF");
            }
        }
        
        // 添加新段落
        XWPFParagraph newPara = doc.CreateParagraph();
        XWPFRun newRun = newPara.CreateRun();
        newRun.SetText("这是新添加的段落。");
        newRun.FontSize = 12;
        
        // 查找替换
        WordDocumentHelper.FindAndReplace(doc, "NPOI", "Apache POI .NET版本");
        
        // 保存修改后的文档
        using (FileStream fs = new FileStream(outputPath, FileMode.Create))
        {
            doc.Write(fs);
        }
        
        Console.WriteLine("\n文档修改完成！");
    }
}
```

## 10.9 本章小结

本章详细介绍了NPOI中Word文档的基础操作。通过本章学习，你应该掌握：

- NPOI支持的Word格式和基本结构
- 文档的创建、打开和保存
- 文档属性的设置
- 段落的创建和格式设置（对齐、缩进、间距）
- 文本运行的创建和字体格式设置
- 文档内容的读取和修改
- 文档结构操作
- 基本的文档辅助类封装

这些基础操作是后续进行复杂Word文档处理的基础。

---

> **下一章预告**：第十一章将介绍Word段落与文本样式的高级设置，包括标题样式、编号列表、项目符号等。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/csharp/npoi/第10章-Word文档基础操作/第09章-Excel高级功能-合并单元格与冻结窗格/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/第10章-Word文档基础操作/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第10章-Word文档基础操作/第11章-Word段落与文本样式/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

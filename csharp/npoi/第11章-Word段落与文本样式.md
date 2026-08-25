---
layout: default
title: 第十一章：Word段落与文本样式
---

# 第十一章：Word段落与文本样式

## 11.1 段落样式深入

### 11.1.1 标题样式

```csharp
using NPOI.XWPF.UserModel;

/// <summary>
/// 创建标题段落
/// </summary>
public static XWPFParagraph CreateHeading(XWPFDocument doc, string text, int level)
{
    XWPFParagraph para = doc.CreateParagraph();
    
    // 设置段落样式
    switch (level)
    {
        case 1:
            para.Style = "Heading1";
            break;
        case 2:
            para.Style = "Heading2";
            break;
        case 3:
            para.Style = "Heading3";
            break;
    }
    
    XWPFRun run = para.CreateRun();
    run.SetText(text);
    
    // 根据级别设置字体
    run.IsBold = true;
    run.FontSize = level switch
    {
        1 => 22,
        2 => 18,
        3 => 14,
        _ => 12
    };
    
    run.SetFontFamily(level == 1 ? "黑体" : "微软雅黑", FontCharRange.None);
    
    return para;
}
```

### 11.1.2 段落编号和项目符号

```csharp
/// <summary>
/// 创建编号列表
/// </summary>
public static void CreateNumberedList(XWPFDocument doc, string[] items)
{
    // 获取或创建编号
    XWPFNumbering numbering = doc.CreateNumbering();
    
    string abstractNumId = numbering.AddAbstractNum();
    string numId = numbering.AddNum(abstractNumId);
    
    for (int i = 0; i < items.Length; i++)
    {
        XWPFParagraph para = doc.CreateParagraph();
        para.SetNumID(numId);
        
        XWPFRun run = para.CreateRun();
        run.SetText(items[i]);
        run.FontSize = 12;
    }
}

/// <summary>
/// 创建项目符号列表
/// </summary>
public static void CreateBulletList(XWPFDocument doc, string[] items)
{
    foreach (string item in items)
    {
        XWPFParagraph para = doc.CreateParagraph();
        para.IndentationLeft = 420;  // 左缩进
        
        XWPFRun run = para.CreateRun();
        run.SetText("• " + item);
        run.FontSize = 12;
        run.SetFontFamily("宋体", FontCharRange.None);
    }
}

/// <summary>
/// 创建自定义符号列表
/// </summary>
public static void CreateCustomBulletList(XWPFDocument doc, string[] items, string bullet = "◆")
{
    foreach (string item in items)
    {
        XWPFParagraph para = doc.CreateParagraph();
        para.IndentationLeft = 420;
        para.IndentationHanging = 210;  // 悬挂缩进
        
        XWPFRun bulletRun = para.CreateRun();
        bulletRun.SetText(bullet + " ");
        bulletRun.SetColor("0066CC");
        
        XWPFRun textRun = para.CreateRun();
        textRun.SetText(item);
        textRun.FontSize = 12;
    }
}
```

### 11.1.3 段落边框和底纹

```csharp
/// <summary>
/// 创建带边框的段落
/// </summary>
public static XWPFParagraph CreateBorderedParagraph(XWPFDocument doc, string text)
{
    XWPFParagraph para = doc.CreateParagraph();
    
    // 设置四边边框
    para.SetBorderTop(Borders.Single, 6, 0, "000000");
    para.SetBorderBottom(Borders.Single, 6, 0, "000000");
    para.SetBorderLeft(Borders.Single, 6, 0, "000000");
    para.SetBorderRight(Borders.Single, 6, 0, "000000");
    
    XWPFRun run = para.CreateRun();
    run.SetText(text);
    
    return para;
}

/// <summary>
/// 创建带底纹的段落
/// </summary>
public static XWPFParagraph CreateShadedParagraph(XWPFDocument doc, string text, string color = "EEEEEE")
{
    XWPFParagraph para = doc.CreateParagraph();
    
    // 通过CT直接设置底纹
    var ctp = para.GetCTP();
    var pPr = ctp.AddNewPPr();
    var shd = pPr.AddNewShd();
    shd.fill = color;
    shd.val = ST_Shd.clear;
    
    XWPFRun run = para.CreateRun();
    run.SetText(text);
    
    return para;
}
```

## 11.2 文本样式高级设置

### 11.2.1 字符间距

```csharp
/// <summary>
/// 设置字符间距
/// </summary>
public static void SetCharacterSpacing(XWPFRun run, int spacing)
{
    var ctr = run.GetCTR();
    var rPr = ctr.AddNewRPr();
    var spacing_ = rPr.AddNewSpacing();
    spacing_.val = spacing.ToString();  // 单位：twip的1/20
}
```

### 11.2.2 文本效果

```csharp
/// <summary>
/// 创建带效果的文本
/// </summary>
public static XWPFRun CreateEffectText(XWPFParagraph para, string text, TextEffect effect)
{
    XWPFRun run = para.CreateRun();
    run.SetText(text);
    
    switch (effect)
    {
        case TextEffect.Bold:
            run.IsBold = true;
            break;
        case TextEffect.Italic:
            run.IsItalic = true;
            break;
        case TextEffect.Underline:
            run.Underline = UnderlinePatterns.Single;
            break;
        case TextEffect.Strike:
            run.IsStrikeThrough = true;
            break;
        case TextEffect.Shadow:
            run.IsShadowed = true;
            break;
        case TextEffect.Emboss:
            run.IsEmbossed = true;
            break;
        case TextEffect.SmallCaps:
            run.IsSmallCaps = true;
            break;
    }
    
    return run;
}

public enum TextEffect
{
    Bold, Italic, Underline, Strike, Shadow, Emboss, SmallCaps
}
```

### 11.2.3 上下标

```csharp
/// <summary>
/// 创建带上下标的文本
/// </summary>
public static void CreateSubscriptSuperscriptText(XWPFDocument doc)
{
    XWPFParagraph para = doc.CreateParagraph();
    
    // 示例：H₂O
    XWPFRun run1 = para.CreateRun();
    run1.SetText("H");
    run1.FontSize = 12;
    
    XWPFRun run2 = para.CreateRun();
    run2.SetText("2");
    run2.FontSize = 10;
    run2.Subscript = VerticalAlign.SUBSCRIPT;  // 下标
    
    XWPFRun run3 = para.CreateRun();
    run3.SetText("O");
    run3.FontSize = 12;
    
    // 示例：x²
    XWPFParagraph para2 = doc.CreateParagraph();
    
    XWPFRun run4 = para2.CreateRun();
    run4.SetText("x");
    run4.FontSize = 12;
    
    XWPFRun run5 = para2.CreateRun();
    run5.SetText("2");
    run5.FontSize = 10;
    run5.Subscript = VerticalAlign.SUPERSCRIPT;  // 上标
}
```

## 11.3 文本查找与替换

### 11.3.1 简单文本替换

```csharp
/// <summary>
/// 查找并替换文本
/// </summary>
public static void FindAndReplace(XWPFDocument doc, Dictionary<string, string> replacements)
{
    // 替换段落中的文本
    foreach (XWPFParagraph para in doc.Paragraphs)
    {
        ReplaceParagraphText(para, replacements);
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
                    ReplaceParagraphText(para, replacements);
                }
            }
        }
    }
    
    // 替换页眉中的文本
    foreach (XWPFHeader header in doc.HeaderList)
    {
        foreach (XWPFParagraph para in header.Paragraphs)
        {
            ReplaceParagraphText(para, replacements);
        }
    }
    
    // 替换页脚中的文本
    foreach (XWPFFooter footer in doc.FooterList)
    {
        foreach (XWPFParagraph para in footer.Paragraphs)
        {
            ReplaceParagraphText(para, replacements);
        }
    }
}

private static void ReplaceParagraphText(XWPFParagraph para, Dictionary<string, string> replacements)
{
    string fullText = para.Text;
    
    foreach (var replacement in replacements)
    {
        if (fullText.Contains(replacement.Key))
        {
            // 遍历所有Run进行替换
            foreach (XWPFRun run in para.Runs)
            {
                string runText = run.Text;
                if (!string.IsNullOrEmpty(runText) && runText.Contains(replacement.Key))
                {
                    run.SetText(runText.Replace(replacement.Key, replacement.Value), 0);
                }
            }
        }
    }
}
```

### 11.3.2 带格式的替换

```csharp
/// <summary>
/// 替换文本并保留格式
/// </summary>
public static void ReplaceTextWithFormat(XWPFDocument doc, string findText, 
    string replaceText, bool bold = false, string color = null)
{
    foreach (XWPFParagraph para in doc.Paragraphs)
    {
        for (int i = 0; i < para.Runs.Count; i++)
        {
            XWPFRun run = para.Runs[i];
            string text = run.Text;
            
            if (!string.IsNullOrEmpty(text) && text.Contains(findText))
            {
                // 保存原格式
                int fontSize = run.FontSize;
                string fontFamily = run.FontFamily;
                bool wasBold = run.IsBold;
                bool wasItalic = run.IsItalic;
                
                // 替换文本
                run.SetText(text.Replace(findText, replaceText), 0);
                
                // 应用新格式或保留原格式
                run.IsBold = bold || wasBold;
                if (!string.IsNullOrEmpty(color))
                {
                    run.SetColor(color);
                }
            }
        }
    }
}
```

## 11.4 富文本处理

### 11.4.1 创建富文本段落

```csharp
/// <summary>
/// 创建富文本段落（混合格式）
/// </summary>
public static void CreateRichTextParagraph(XWPFDocument doc)
{
    XWPFParagraph para = doc.CreateParagraph();
    para.IndentationFirstLine = 420;
    
    // 普通文本
    AddRun(para, "这是一段包含", false, false, "000000", 12);
    
    // 加粗文本
    AddRun(para, "加粗", true, false, "000000", 12);
    
    AddRun(para, "、", false, false, "000000", 12);
    
    // 斜体文本
    AddRun(para, "斜体", false, true, "000000", 12);
    
    AddRun(para, "、", false, false, "000000", 12);
    
    // 彩色文本
    AddRun(para, "红色", false, false, "FF0000", 12);
    
    AddRun(para, "、", false, false, "000000", 12);
    
    // 下划线文本
    XWPFRun underlineRun = para.CreateRun();
    underlineRun.SetText("下划线");
    underlineRun.FontSize = 12;
    underlineRun.Underline = UnderlinePatterns.Single;
    
    AddRun(para, "等多种格式的富文本。", false, false, "000000", 12);
}

private static XWPFRun AddRun(XWPFParagraph para, string text, 
    bool bold, bool italic, string color, int fontSize)
{
    XWPFRun run = para.CreateRun();
    run.SetText(text);
    run.IsBold = bold;
    run.IsItalic = italic;
    run.SetColor(color);
    run.FontSize = fontSize;
    return run;
}
```

### 11.4.2 HTML到Word转换（简化版）

```csharp
/// <summary>
/// 简单HTML到Word转换
/// </summary>
public static void HtmlToWord(XWPFDocument doc, string html)
{
    // 简单的HTML解析（仅支持基本标签）
    XWPFParagraph para = null;
    
    // 移除HTML标签，提取文本
    string plainText = System.Text.RegularExpressions.Regex.Replace(html, "<[^>]*>", "");
    
    // 解析简单标签
    if (html.Contains("<b>") || html.Contains("<strong>"))
    {
        para = doc.CreateParagraph();
        XWPFRun run = para.CreateRun();
        run.SetText(plainText);
        run.IsBold = true;
    }
    else if (html.Contains("<i>") || html.Contains("<em>"))
    {
        para = doc.CreateParagraph();
        XWPFRun run = para.CreateRun();
        run.SetText(plainText);
        run.IsItalic = true;
    }
    else
    {
        para = doc.CreateParagraph();
        XWPFRun run = para.CreateRun();
        run.SetText(plainText);
    }
}
```

## 11.5 样式模板

### 11.5.1 创建样式模板类

```csharp
/// <summary>
/// Word文档样式模板
/// </summary>
public class WordStyleTemplate
{
    private readonly XWPFDocument _doc;
    
    public WordStyleTemplate(XWPFDocument doc)
    {
        _doc = doc;
    }
    
    /// <summary>
    /// 创建一级标题
    /// </summary>
    public XWPFParagraph CreateH1(string text)
    {
        XWPFParagraph para = _doc.CreateParagraph();
        para.Alignment = ParagraphAlignment.CENTER;
        para.SpacingAfter = 200;
        
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.IsBold = true;
        run.FontSize = 22;
        run.SetFontFamily("黑体", FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 创建二级标题
    /// </summary>
    public XWPFParagraph CreateH2(string text)
    {
        XWPFParagraph para = _doc.CreateParagraph();
        para.SpacingBefore = 200;
        para.SpacingAfter = 100;
        
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.IsBold = true;
        run.FontSize = 16;
        run.SetFontFamily("微软雅黑", FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 创建三级标题
    /// </summary>
    public XWPFParagraph CreateH3(string text)
    {
        XWPFParagraph para = _doc.CreateParagraph();
        para.SpacingBefore = 150;
        para.SpacingAfter = 50;
        
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.IsBold = true;
        run.FontSize = 14;
        run.SetFontFamily("微软雅黑", FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 创建正文段落
    /// </summary>
    public XWPFParagraph CreateBody(string text, bool firstLineIndent = true)
    {
        XWPFParagraph para = _doc.CreateParagraph();
        para.Alignment = ParagraphAlignment.BOTH;
        
        if (firstLineIndent)
        {
            para.IndentationFirstLine = 420;  // 首行缩进2字符
        }
        
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.FontSize = 12;
        run.SetFontFamily("宋体", FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 创建引用块
    /// </summary>
    public XWPFParagraph CreateQuote(string text)
    {
        XWPFParagraph para = _doc.CreateParagraph();
        para.IndentationLeft = 420;
        para.IndentationRight = 420;
        
        para.SetBorderLeft(Borders.Single, 12, 0, "CCCCCC");
        
        XWPFRun run = para.CreateRun();
        run.SetText(text);
        run.FontSize = 11;
        run.IsItalic = true;
        run.SetColor("666666");
        run.SetFontFamily("楷体", FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 创建代码块
    /// </summary>
    public XWPFParagraph CreateCodeBlock(string code)
    {
        XWPFParagraph para = _doc.CreateParagraph();
        
        para.SetBorderTop(Borders.Single, 4, 0, "CCCCCC");
        para.SetBorderBottom(Borders.Single, 4, 0, "CCCCCC");
        para.SetBorderLeft(Borders.Single, 4, 0, "CCCCCC");
        para.SetBorderRight(Borders.Single, 4, 0, "CCCCCC");
        
        XWPFRun run = para.CreateRun();
        run.SetText(code);
        run.FontSize = 10;
        run.SetFontFamily("Consolas", FontCharRange.None);
        
        return para;
    }
    
    /// <summary>
    /// 创建注释/提示
    /// </summary>
    public XWPFParagraph CreateNote(string text, string noteType = "提示")
    {
        XWPFParagraph para = _doc.CreateParagraph();
        para.IndentationLeft = 210;
        
        XWPFRun labelRun = para.CreateRun();
        labelRun.SetText($"【{noteType}】");
        labelRun.IsBold = true;
        labelRun.SetColor(noteType == "警告" ? "FF6600" : "0066CC");
        labelRun.FontSize = 11;
        
        XWPFRun textRun = para.CreateRun();
        textRun.SetText(text);
        textRun.FontSize = 11;
        
        return para;
    }
    
    /// <summary>
    /// 添加分页符
    /// </summary>
    public void AddPageBreak()
    {
        XWPFParagraph para = _doc.CreateParagraph();
        XWPFRun run = para.CreateRun();
        run.AddBreak(BreakType.PAGE);
    }
    
    /// <summary>
    /// 添加空行
    /// </summary>
    public void AddEmptyLine(int count = 1)
    {
        for (int i = 0; i < count; i++)
        {
            _doc.CreateParagraph();
        }
    }
}
```

## 11.6 综合示例

### 11.6.1 创建技术文档

```csharp
public class TechnicalDocumentExample
{
    public static void CreateDocument()
    {
        XWPFDocument doc = new XWPFDocument();
        var template = new WordStyleTemplate(doc);
        
        // 文档标题
        template.CreateH1("NPOI技术文档");
        template.AddEmptyLine();
        
        // 第一章
        template.CreateH2("1. 概述");
        template.CreateBody("NPOI是一个.NET库，允许开发者读取和写入Microsoft Office文件，包括Excel、Word和PowerPoint。" +
                           "它是Apache POI的.NET移植版本，完全开源且免费使用。");
        template.CreateBody("NPOI的主要优势包括：无需安装Office、跨平台支持、高性能等特点。");
        
        template.AddEmptyLine();
        
        // 第二章
        template.CreateH2("2. 安装配置");
        
        template.CreateH3("2.1 NuGet安装");
        template.CreateBody("通过NuGet包管理器安装NPOI非常简单，只需执行以下命令：", false);
        template.CreateCodeBlock("dotnet add package NPOI");
        
        template.CreateH3("2.2 命名空间导入");
        template.CreateBody("使用NPOI需要导入相应的命名空间：", false);
        template.CreateCodeBlock("using NPOI.XWPF.UserModel;\nusing NPOI.SS.UserModel;");
        
        template.AddEmptyLine();
        
        // 第三章
        template.CreateH2("3. 基本使用");
        template.CreateBody("以下是NPOI的基本使用方法和示例代码。在实际项目中，你可以根据需要进行扩展和定制。");
        
        template.CreateNote("NPOI支持.NET Framework 4.0及以上版本，以及.NET Core和.NET 5+。");
        template.CreateNote("在服务器环境下使用时，请注意内存管理和资源释放。", "警告");
        
        template.AddEmptyLine();
        
        // 引用
        template.CreateQuote("NPOI是处理Office文档的最佳选择之一，它提供了完整的API来操作Excel、Word和PowerPoint文件。");
        
        // 保存
        using (FileStream fs = new FileStream("技术文档.docx", FileMode.Create))
        {
            doc.Write(fs);
        }
        
        Console.WriteLine("技术文档创建成功！");
    }
}
```

## 11.7 本章小结

本章详细介绍了NPOI中Word段落与文本样式的高级设置。通过本章学习，你应该掌握：

- 标题样式的创建和使用
- 编号列表和项目符号的创建
- 段落边框和底纹的设置
- 文本效果和字符间距
- 上下标的使用
- 文本查找与替换
- 富文本段落的创建
- 样式模板类的封装

这些高级样式功能可以帮助你创建格式丰富、专业美观的Word文档。

---

> **下一章预告**：第十二章将介绍Word表格操作，包括表格的创建、样式设置和复杂表格的处理。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/csharp/npoi/第10章-Word文档基础操作/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第12章-Word表格操作/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

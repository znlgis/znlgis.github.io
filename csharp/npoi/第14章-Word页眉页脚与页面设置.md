---
layout: default
title: 第十四章：Word页眉页脚与页面设置
---

# 第十四章：Word页眉页脚与页面设置

## 14.1 页面设置

### 14.1.1 页面大小

```csharp
using NPOI.XWPF.UserModel;
using NPOI.OpenXmlFormats.Wordprocessing;

XWPFDocument doc = new XWPFDocument();

// 获取或创建文档属性
CT_SectPr sectPr = doc.Document.body.sectPr;
if (sectPr == null)
{
    sectPr = doc.Document.body.AddNewSectPr();
}

// 设置页面大小
CT_PageSz pageSize = sectPr.AddNewPgSz();

// A4纸：宽21cm，高29.7cm（单位：twip，1英寸=1440twip，1cm≈567twip）
pageSize.w = 11906;  // 21cm
pageSize.h = 16838;  // 29.7cm

// 常用纸张大小（单位：twip）
// A4: 11906 x 16838
// A3: 16838 x 23811
// Letter: 12240 x 15840
// Legal: 12240 x 20160

// 设置页面方向
pageSize.orient = ST_PageOrientation.portrait;  // 纵向
// pageSize.orient = ST_PageOrientation.landscape;  // 横向
```

### 14.1.2 页边距

```csharp
// 设置页边距
CT_PageMar pageMar = sectPr.AddNewPgMar();

// 单位：twip（1英寸=1440twip，1cm≈567twip）
pageMar.top = "1440";      // 上边距1英寸
pageMar.bottom = "1440";   // 下边距1英寸
pageMar.left = 1800;       // 左边距1.25英寸
pageMar.right = 1800;      // 右边距1.25英寸
pageMar.header = 720;      // 页眉距离
pageMar.footer = 720;      // 页脚距离
pageMar.gutter = 0;        // 装订线
```

### 14.1.3 页面设置辅助类

```csharp
/// <summary>
/// 页面设置辅助类
/// </summary>
public static class PageSetupHelper
{
    // 单位转换
    public static ulong CmToTwip(double cm) => (ulong)(cm * 567);
    public static ulong InchToTwip(double inch) => (ulong)(inch * 1440);
    
    /// <summary>
    /// 设置A4纸纵向
    /// </summary>
    public static void SetA4Portrait(XWPFDocument doc)
    {
        SetPageSize(doc, 21, 29.7, false);
    }
    
    /// <summary>
    /// 设置A4纸横向
    /// </summary>
    public static void SetA4Landscape(XWPFDocument doc)
    {
        SetPageSize(doc, 29.7, 21, true);
    }
    
    /// <summary>
    /// 设置页面大小（厘米）
    /// </summary>
    public static void SetPageSize(XWPFDocument doc, double widthCm, double heightCm, 
        bool landscape = false)
    {
        CT_SectPr sectPr = GetOrCreateSectPr(doc);
        CT_PageSz pageSize = sectPr.pgSz ?? sectPr.AddNewPgSz();
        
        pageSize.w = CmToTwip(widthCm);
        pageSize.h = CmToTwip(heightCm);
        pageSize.orient = landscape ? ST_PageOrientation.landscape : ST_PageOrientation.portrait;
    }
    
    /// <summary>
    /// 设置页边距（厘米）
    /// </summary>
    public static void SetPageMargins(XWPFDocument doc, double top, double bottom,
        double left, double right)
    {
        CT_SectPr sectPr = GetOrCreateSectPr(doc);
        CT_PageMar pageMar = sectPr.pgMar ?? sectPr.AddNewPgMar();
        
        pageMar.top = CmToTwip(top).ToString();
        pageMar.bottom = CmToTwip(bottom).ToString();
        pageMar.left = CmToTwip(left);
        pageMar.right = CmToTwip(right);
    }
    
    /// <summary>
    /// 设置常规边距（2.54cm上下，3.18cm左右）
    /// </summary>
    public static void SetNormalMargins(XWPFDocument doc)
    {
        SetPageMargins(doc, 2.54, 2.54, 3.18, 3.18);
    }
    
    /// <summary>
    /// 设置窄边距（1.27cm）
    /// </summary>
    public static void SetNarrowMargins(XWPFDocument doc)
    {
        SetPageMargins(doc, 1.27, 1.27, 1.27, 1.27);
    }
    
    /// <summary>
    /// 设置适中边距
    /// </summary>
    public static void SetModerateMargins(XWPFDocument doc)
    {
        SetPageMargins(doc, 2.54, 2.54, 1.91, 1.91);
    }
    
    private static CT_SectPr GetOrCreateSectPr(XWPFDocument doc)
    {
        if (doc.Document.body.sectPr == null)
        {
            doc.Document.body.AddNewSectPr();
        }
        return doc.Document.body.sectPr;
    }
}
```

## 14.2 页眉设置

### 14.2.1 创建页眉

```csharp
/// <summary>
/// 创建简单页眉
/// </summary>
public static void CreateSimpleHeader(XWPFDocument doc, string headerText)
{
    // 创建页眉
    XWPFHeader header = doc.CreateHeader(HeaderFooterType.DEFAULT);
    
    // 创建段落
    XWPFParagraph para = header.CreateParagraph();
    para.Alignment = ParagraphAlignment.CENTER;
    
    // 添加文本
    XWPFRun run = para.CreateRun();
    run.SetText(headerText);
    run.FontSize = 10;
    run.SetColor("666666");
}

/// <summary>
/// 创建带样式的页眉
/// </summary>
public static void CreateStyledHeader(XWPFDocument doc, string leftText, 
    string centerText, string rightText)
{
    XWPFHeader header = doc.CreateHeader(HeaderFooterType.DEFAULT);
    
    // 使用制表符实现左中右布局
    XWPFParagraph para = header.CreateParagraph();
    
    // 设置制表位
    var ctp = para.GetCTP();
    var pPr = ctp.AddNewPPr();
    var tabs = pPr.AddNewTabs();
    
    // 中间制表位
    var centerTab = tabs.AddNewTab();
    centerTab.val = ST_TabJc.center;
    centerTab.pos = "4680";  // 页面中间
    
    // 右边制表位
    var rightTab = tabs.AddNewTab();
    rightTab.val = ST_TabJc.right;
    rightTab.pos = "9360";  // 页面右边
    
    // 左边文本
    XWPFRun leftRun = para.CreateRun();
    leftRun.SetText(leftText);
    leftRun.FontSize = 9;
    
    // 制表符（到中间）
    para.CreateRun().AddTab();
    
    // 中间文本
    XWPFRun centerRun = para.CreateRun();
    centerRun.SetText(centerText);
    centerRun.FontSize = 9;
    centerRun.IsBold = true;
    
    // 制表符（到右边）
    para.CreateRun().AddTab();
    
    // 右边文本
    XWPFRun rightRun = para.CreateRun();
    rightRun.SetText(rightText);
    rightRun.FontSize = 9;
}
```

### 14.2.2 首页不同页眉

```csharp
/// <summary>
/// 创建首页不同的页眉
/// </summary>
public static void CreateDifferentFirstPageHeader(XWPFDocument doc,
    string firstPageHeader, string defaultHeader)
{
    // 设置首页不同
    CT_SectPr sectPr = doc.Document.body.sectPr ?? doc.Document.body.AddNewSectPr();
    sectPr.AddNewTitlePg();  // 启用首页不同
    
    // 首页页眉
    XWPFHeader firstHeader = doc.CreateHeader(HeaderFooterType.FIRST);
    XWPFParagraph firstPara = firstHeader.CreateParagraph();
    firstPara.Alignment = ParagraphAlignment.CENTER;
    XWPFRun firstRun = firstPara.CreateRun();
    firstRun.SetText(firstPageHeader);
    firstRun.FontSize = 10;
    
    // 默认页眉（第2页开始）
    XWPFHeader defaultHeaderObj = doc.CreateHeader(HeaderFooterType.DEFAULT);
    XWPFParagraph defaultPara = defaultHeaderObj.CreateParagraph();
    defaultPara.Alignment = ParagraphAlignment.CENTER;
    XWPFRun defaultRun = defaultPara.CreateRun();
    defaultRun.SetText(defaultHeader);
    defaultRun.FontSize = 10;
}
```

### 14.2.3 奇偶页不同页眉

```csharp
/// <summary>
/// 创建奇偶页不同的页眉
/// </summary>
public static void CreateOddEvenHeaders(XWPFDocument doc,
    string oddHeader, string evenHeader)
{
    // 设置奇偶页不同
    CT_Settings settings = doc.Document.settings ?? doc.Document.AddNewSettings();
    settings.AddNewEvenAndOddHeaders();
    
    // 奇数页页眉
    XWPFHeader oddHeaderObj = doc.CreateHeader(HeaderFooterType.DEFAULT);
    XWPFParagraph oddPara = oddHeaderObj.CreateParagraph();
    oddPara.Alignment = ParagraphAlignment.RIGHT;
    XWPFRun oddRun = oddPara.CreateRun();
    oddRun.SetText(oddHeader);
    
    // 偶数页页眉
    XWPFHeader evenHeaderObj = doc.CreateHeader(HeaderFooterType.EVEN);
    XWPFParagraph evenPara = evenHeaderObj.CreateParagraph();
    evenPara.Alignment = ParagraphAlignment.LEFT;
    XWPFRun evenRun = evenPara.CreateRun();
    evenRun.SetText(evenHeader);
}
```

## 14.3 页脚设置

### 14.3.1 创建页脚

```csharp
/// <summary>
/// 创建简单页脚
/// </summary>
public static void CreateSimpleFooter(XWPFDocument doc, string footerText)
{
    XWPFFooter footer = doc.CreateFooter(HeaderFooterType.DEFAULT);
    
    XWPFParagraph para = footer.CreateParagraph();
    para.Alignment = ParagraphAlignment.CENTER;
    
    XWPFRun run = para.CreateRun();
    run.SetText(footerText);
    run.FontSize = 9;
    run.SetColor("666666");
}
```

### 14.3.2 添加页码

```csharp
/// <summary>
/// 创建带页码的页脚
/// </summary>
public static void CreateFooterWithPageNumber(XWPFDocument doc)
{
    XWPFFooter footer = doc.CreateFooter(HeaderFooterType.DEFAULT);
    
    XWPFParagraph para = footer.CreateParagraph();
    para.Alignment = ParagraphAlignment.CENTER;
    
    // "第 X 页 / 共 Y 页" 格式
    XWPFRun run1 = para.CreateRun();
    run1.SetText("第 ");
    run1.FontSize = 9;
    
    // 当前页码
    var ctp = para.GetCTP();
    var fldSimple1 = ctp.AddNewFldSimple();
    fldSimple1.instr = "PAGE";
    
    XWPFRun run2 = para.CreateRun();
    run2.SetText(" 页 / 共 ");
    run2.FontSize = 9;
    
    // 总页数
    var fldSimple2 = ctp.AddNewFldSimple();
    fldSimple2.instr = "NUMPAGES";
    
    XWPFRun run3 = para.CreateRun();
    run3.SetText(" 页");
    run3.FontSize = 9;
}

/// <summary>
/// 创建简单页码页脚（仅数字）
/// </summary>
public static void CreateSimplePageNumberFooter(XWPFDocument doc)
{
    XWPFFooter footer = doc.CreateFooter(HeaderFooterType.DEFAULT);
    
    XWPFParagraph para = footer.CreateParagraph();
    para.Alignment = ParagraphAlignment.CENTER;
    
    // 添加页码字段
    var ctp = para.GetCTP();
    var fldSimple = ctp.AddNewFldSimple();
    fldSimple.instr = "PAGE";
}
```

### 14.3.3 带版权信息的页脚

```csharp
/// <summary>
/// 创建带版权信息的页脚
/// </summary>
public static void CreateCopyrightFooter(XWPFDocument doc, string companyName)
{
    XWPFFooter footer = doc.CreateFooter(HeaderFooterType.DEFAULT);
    
    // 第一行：页码
    XWPFParagraph pageNumPara = footer.CreateParagraph();
    pageNumPara.Alignment = ParagraphAlignment.CENTER;
    
    var ctp1 = pageNumPara.GetCTP();
    var fldSimple1 = ctp1.AddNewFldSimple();
    fldSimple1.instr = "PAGE";
    
    // 第二行：版权信息
    XWPFParagraph copyrightPara = footer.CreateParagraph();
    copyrightPara.Alignment = ParagraphAlignment.CENTER;
    
    XWPFRun copyrightRun = copyrightPara.CreateRun();
    copyrightRun.SetText($"© {DateTime.Now.Year} {companyName} 版权所有");
    copyrightRun.FontSize = 8;
    copyrightRun.SetColor("999999");
}
```

## 14.4 分节与不同页面设置

### 14.4.1 插入分节符

```csharp
/// <summary>
/// 插入分节符
/// </summary>
public static void InsertSectionBreak(XWPFDocument doc, ST_SectionMark breakType)
{
    XWPFParagraph para = doc.CreateParagraph();
    var ctp = para.GetCTP();
    var pPr = ctp.AddNewPPr();
    var sectPr = pPr.AddNewSectPr();
    var type = sectPr.AddNewType();
    type.val = breakType;
    
    // 分节符类型：
    // ST_SectionMark.nextPage - 下一页
    // ST_SectionMark.continuous - 连续
    // ST_SectionMark.evenPage - 偶数页
    // ST_SectionMark.oddPage - 奇数页
}

/// <summary>
/// 插入下一页分节符
/// </summary>
public static void InsertNextPageSection(XWPFDocument doc)
{
    InsertSectionBreak(doc, ST_SectionMark.nextPage);
}
```

### 14.4.2 不同节的页面设置

```csharp
/// <summary>
/// 为特定节设置不同的页面方向
/// </summary>
public static void SetSectionLandscape(XWPFParagraph para)
{
    var ctp = para.GetCTP();
    var pPr = ctp.pPr ?? ctp.AddNewPPr();
    var sectPr = pPr.sectPr ?? pPr.AddNewSectPr();
    
    // 设置横向
    var pgSz = sectPr.AddNewPgSz();
    pgSz.orient = ST_PageOrientation.landscape;
    pgSz.w = 16838;  // A4横向宽度
    pgSz.h = 11906;  // A4横向高度
}
```

## 14.5 综合示例

### 14.5.1 创建完整格式的文档

```csharp
public class CompleteDocumentExample
{
    public static void CreateDocument()
    {
        XWPFDocument doc = new XWPFDocument();
        
        // 1. 页面设置
        PageSetupHelper.SetA4Portrait(doc);
        PageSetupHelper.SetNormalMargins(doc);
        
        // 2. 设置首页不同
        CT_SectPr sectPr = doc.Document.body.sectPr ?? doc.Document.body.AddNewSectPr();
        sectPr.AddNewTitlePg();
        
        // 3. 创建首页页眉（空白或特殊）
        XWPFHeader firstHeader = doc.CreateHeader(HeaderFooterType.FIRST);
        XWPFParagraph firstHeaderPara = firstHeader.CreateParagraph();
        // 首页页眉为空
        
        // 4. 创建默认页眉
        XWPFHeader header = doc.CreateHeader(HeaderFooterType.DEFAULT);
        XWPFParagraph headerPara = header.CreateParagraph();
        headerPara.Alignment = ParagraphAlignment.CENTER;
        XWPFRun headerRun = headerPara.CreateRun();
        headerRun.SetText("NPOI技术文档");
        headerRun.FontSize = 10;
        headerRun.SetColor("666666");
        
        // 添加页眉下划线
        headerPara.SetBorderBottom(Borders.Single, 4, 0, "CCCCCC");
        
        // 5. 创建首页页脚
        XWPFFooter firstFooter = doc.CreateFooter(HeaderFooterType.FIRST);
        XWPFParagraph firstFooterPara = firstFooter.CreateParagraph();
        firstFooterPara.Alignment = ParagraphAlignment.CENTER;
        XWPFRun firstFooterRun = firstFooterPara.CreateRun();
        firstFooterRun.SetText($"© {DateTime.Now.Year} 版权所有");
        firstFooterRun.FontSize = 9;
        firstFooterRun.SetColor("999999");
        
        // 6. 创建默认页脚（带页码）
        XWPFFooter footer = doc.CreateFooter(HeaderFooterType.DEFAULT);
        XWPFParagraph footerPara = footer.CreateParagraph();
        footerPara.Alignment = ParagraphAlignment.CENTER;
        
        // 上划线
        footerPara.SetBorderTop(Borders.Single, 4, 0, "CCCCCC");
        
        XWPFRun footerRun1 = footerPara.CreateRun();
        footerRun1.SetText("第 ");
        footerRun1.FontSize = 9;
        
        var ctp = footerPara.GetCTP();
        var fldPage = ctp.AddNewFldSimple();
        fldPage.instr = "PAGE";
        
        XWPFRun footerRun2 = footerPara.CreateRun();
        footerRun2.SetText(" 页 / 共 ");
        footerRun2.FontSize = 9;
        
        var fldTotal = ctp.AddNewFldSimple();
        fldTotal.instr = "NUMPAGES";
        
        XWPFRun footerRun3 = footerPara.CreateRun();
        footerRun3.SetText(" 页");
        footerRun3.FontSize = 9;
        
        // 7. 添加内容
        // 首页内容
        XWPFParagraph titlePara = doc.CreateParagraph();
        titlePara.Alignment = ParagraphAlignment.CENTER;
        titlePara.SpacingBefore = 5000;
        XWPFRun titleRun = titlePara.CreateRun();
        titleRun.SetText("NPOI技术文档");
        titleRun.IsBold = true;
        titleRun.FontSize = 28;
        
        XWPFParagraph subtitlePara = doc.CreateParagraph();
        subtitlePara.Alignment = ParagraphAlignment.CENTER;
        subtitlePara.SpacingBefore = 500;
        XWPFRun subtitleRun = subtitlePara.CreateRun();
        subtitleRun.SetText("版本 1.0");
        subtitleRun.FontSize = 14;
        subtitleRun.SetColor("666666");
        
        XWPFParagraph datePara = doc.CreateParagraph();
        datePara.Alignment = ParagraphAlignment.CENTER;
        datePara.SpacingBefore = 2000;
        XWPFRun dateRun = datePara.CreateRun();
        dateRun.SetText(DateTime.Now.ToString("yyyy年MM月dd日"));
        dateRun.FontSize = 12;
        
        // 分页
        XWPFParagraph breakPara = doc.CreateParagraph();
        XWPFRun breakRun = breakPara.CreateRun();
        breakRun.AddBreak(BreakType.PAGE);
        
        // 正文内容
        XWPFParagraph contentTitle = doc.CreateParagraph();
        XWPFRun contentTitleRun = contentTitle.CreateRun();
        contentTitleRun.SetText("第一章 概述");
        contentTitleRun.IsBold = true;
        contentTitleRun.FontSize = 16;
        
        XWPFParagraph contentPara = doc.CreateParagraph();
        contentPara.IndentationFirstLine = 420;
        XWPFRun contentRun = contentPara.CreateRun();
        contentRun.SetText("NPOI是一个强大的.NET库，用于读取和写入Microsoft Office文件。" +
                          "本文档详细介绍了NPOI的各项功能和使用方法。");
        contentRun.FontSize = 12;
        
        // 保存
        using (FileStream fs = new FileStream("完整文档.docx", FileMode.Create))
        {
            doc.Write(fs);
        }
        
        Console.WriteLine("完整文档创建成功！");
    }
}
```

## 14.6 本章小结

本章详细介绍了NPOI中Word页眉页脚和页面设置。通过本章学习，你应该掌握：

- 页面大小和方向的设置
- 页边距的设置
- 页眉的创建和样式设置
- 首页不同、奇偶页不同的页眉
- 页脚和页码的添加
- 分节符的使用
- 综合应用这些功能创建专业文档

页眉页脚和页面设置是创建正式文档的重要组成部分。

---

> **下一章预告**：第十五章将介绍PowerPoint演示文稿操作。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第13章-Word图片与多媒体" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第15章-PowerPoint演示文稿操作" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

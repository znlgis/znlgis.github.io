---
layout: default
title: 第十四章：Word页眉页脚与页面设置
---

# 第十四章：Word页眉页脚与页面设置

## 14.1 页面设置

页面设置在 Word 的文档模型里叫"节属性"（section properties，简称 sectPr）。一个文档可以只有一个节，也可以按分节符切成多个节，每个节有自己的纸张大小、方向、页边距和页眉页脚。

这条规则解释了很多现象：为什么改了页面设置只影响某几页（那几页属于另一个节）？为什么插入分节符之后页眉突然变了（新节的页眉设置是从上一节继承来的）？

NPOI 里页面设置的入口是 `doc.Document.body.sectPr`。文档级的节属性挂在 body 上，段落级的节属性挂在段落的 pPr 里（14.4 节会用到）。两者是同一套 XML 结构，只是挂载位置不同。

长度单位统一是 twip：1 英寸 = 1440 twip，1 厘米约等于 567 twip。示例的代码里换算都按 567 算，误差在可接受范围内（精确值 566.93）。

### 14.1.1 页面大小

设置纸张大小的步骤是：取文档级 sectPr → 添加 pgSz（页面尺寸节点）→ 设宽、高、方向。

示例先判断 `sectPr == null`，为空时创建。这个判断是必要的：新建的 `XWPFDocument` 不一定带完整节属性，直接访问子节点会抛空引用。

四个常用纸张尺寸记一下：

| 纸张 | 宽（twip） | 高（twip） | 约合 |
|------|-----------|-----------|------|
| A4 | 11906 | 16838 | 21 × 29.7 cm |
| A3 | 16838 | 23811 | 29.7 × 42 cm |
| Letter | 12240 | 15840 | 8.5 × 11 英寸 |
| Legal | 12240 | 20160 | 8.5 × 14 英寸 |

示例里 `pageSize.w` 和 `pageSize.h` 是直接赋整数，没有走辅助类的换算方法。这种直接赋值适合已知固定尺寸的纸张，如果是自定义尺寸（比如票据打印的连续纸），就要用厘米换算成 twip。

**方向与宽高的关系是最容易搞错的地方。** `orient` 只是告诉 Word"这是横向页面"，它不会自动交换宽高。A4 横向必须写 `w = 16838`、`h = 11906`，也就是宽大于高。如果只改 `orient` 不改宽高，文档会变成"横向标记 + 纵向尺寸"，Word 打开时按纵向渲染，看起来设置完全没生效。

示例注释里 `portrait` 是纵向、`landscape` 是横向，注意别反了。portrait 这个词来自肖像画（竖着挂），landscape 来自风景画（横着挂），这样记不会混。

设置页面大小还有一个时机问题：如果文档已经插入了分节符，修改 body 级的 sectPr 只影响最后一节。其他节的尺寸在各自的 sectPr 里，要逐个改。

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

页边距配置在 `pgMar` 节点下，共六个属性。

- `top`、`bottom`：上下边距，正文与纸张上下的距离；
- `left`、`right`：左右边距；
- `header`、`footer`：页眉页脚与纸张边缘的距离，不是与正文的距离；
- `gutter`：装订线，额外增加在左边（或按设置的内侧）的留白。

示例里 `top` 和 `bottom` 赋值时加了引号，`left` 和 `right` 没有。这不是示例笔误，而是 OOXML 属性的类型差异：有些属性在生成的强类型包装里是字符串表示，有些是数值类型（示例里 `left` 用整数、辅助类里又用 `ToString()` 赋值，两种写法在不同版本下都可能出现）。实际写代码时按编辑器提示的类型来，不要照抄引号。

页边距的取值要成对考虑。上下边距大、左右边距小，是学术论文的常见版式；四边都小（1.27 厘米），适合内容密集的表格文档；常规边距（上下 2.54、左右 3.18 厘米）是 Word 的默认值。

一个实际约束：页边距不能小于打印机的最小不可打印边距。设置成 0 时，Word 显示正常，但打印机会裁掉边缘内容。桌面打印机通常有 5 毫米左右的安全区，屏幕文档则没有这个限制。

页眉页脚距离与页边距的配合也需要注意。页眉距离大于上边距时，页眉会压到正文区里；页脚距离大于下边距时同理。常见配置是上边距 2.54 厘米、页眉距离 1.5 厘米，两者之间有约 1 厘米的余量。

装订线只在需要装订的文档里设。它加在左侧边距之外，文档可打印区域相应变小。文档生成时如果需要双面打印装订，还要配合"镜像页边距"（奇偶页左右边距互换），这部分 NPOI 支持有限，通常靠模板文件预设。

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

辅助类把页面设置收成六个方法，并按 Word 的预设边距做了快捷入口：常规、窄、适中。

先看两个换算方法。`CmToTwip` 和 `InchToTwip` 返回 `ulong`，这个返回类型是由 OOXML 属性的类型决定——有些属性以无符号整数表达。调用处再 `ToString()` 或直接赋值，取决于目标属性是字符串还是数值。这是 NPOI 里比较别扭的地方，写代码时的做法是：先按辅助类的返回类型写，编译报错再调整，不要凭记忆猜。

`SetPageSize` 有一个值得讨论的语义问题：接收的宽高是厘米，且 `landscape` 参数为真时不自动交换宽高。调用方必须自己传对顺序——`SetA4Landscape` 里传的是 `29.7, 21`，先宽后高。这个设计把"方向"与"尺寸"分开，看起来重复，但符合 OOXML 的实际存储方式：`orient` 和 `w`/`h` 是两个独立属性，工具层不做自动纠正反而更透明。

`GetOrCreateSectPr` 是私有辅助，被每个设置有方法调用。这种"取已有的或新建"的写法，在 NPOI 里是常态：直接 `AddNewPgSz()` 会重复添加节点，导致 XML 结构非法，Word 打开时报错或忽略设置。

默认边距的三个预设与 Word 界面的预设名称对应：

| 预设 | 上下 | 左右 |
|------|------|------|
| 常规 | 2.54 | 3.18 |
| 窄 | 1.27 | 1.27 |
| 适中 | 2.54 | 1.91 |

预设函数的价值是调用方不用记数字。但要注意，这些预设是 Word 的默认值，与具体单位的国标文档要求可能不同（中文公文有专门的版式规范），生成正式公文时应当按规范单独设置。

辅助类缺少对页眉页脚距离的设置。示例里 `header` 和 `footer` 属性在 14.1.2 里直接设过，辅助类没有封装。实际项目里通常会补两个方法。

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

页眉是每页顶部重复出现的内容，常见形式是文档标题加章节名、公司名加日期、章节名加页码。

Word 的页眉有三个"位置"：默认页眉、首页页眉、偶数页页眉。三者的关系是：

- 默认页眉作用于所有页，除非启用了首页不同或奇偶页不同；
- 首页页眉只在启用 `titlePg`（首页不同）后生效，作用于每节的第一页；
- 偶数页页眉只在启用 `evenAndOddHeaders`（奇偶页不同）后生效，作用于偶数页。

这个继承关系是排查页眉问题的关键：设置了首页页眉但第一页没变化，先检查 `titlePg` 有没有开；设置了偶数页页眉但偶数页没变化，先检查 `evenAndOddHeaders` 有没有开。

`CreateHeader(HeaderFooterType.DEFAULT)` 会创建页眉部件并返回对象。**同类型页眉重复创建的行为要小心**：多次调用可能产生多个页眉引用，文档里出现重复页眉或其中一个不生效。正确做法是先检查 `doc.HeaderList` 里是否已有对应类型，有就复用。

### 14.2.1 创建页眉

两个方法演示了页眉的简单版与布局版。

简单版：建页眉 → 建段落 → 居中 → 加文本 Run，设 10 号灰色。这个组合是页眉的常用样式：比正文小一号、颜色变浅，让读者知道它是辅助信息。

布局版处理的是"左中右三段文字"的需求：左侧放文档名，中间放章节名，右侧放日期。在 Word 里实现这个布局的标准做法是**制表位**——在段落的 pPr 里定义几个 tab 位置，然后用制表符把文字"推"到指定位置。

示例定义了两个制表位：

- 居中制表位在 `4680` twip，约 3.25 英寸，是 A4 页面正文宽度的一半；
- 右对齐制表位在 `9360` twip，约 6.5 英寸，接近正文右边界。

这两个位置是按 A4 加常规边距算出来的（正文宽度约 6.5 英寸）。换纸张或换边距后位置要重算，否则右侧文字会跑到页外或提前换行。

制表符的插入方式值得注意：`para.CreateRun().AddTab()` 创建一个只含制表符的 Run。制表符是字符级的，必须放在 Run 里，不能直接加到段落上。

对比另一个更常见的方案：用表格做页眉的三段布局（一行三列表格，单元格分别左中右对齐），再隐藏表格边框。这种方案的优点是位置精确、不受制表位影响，缺点是文档结构里多一个表格，某些文档检查工具会提示。制表位方案结构更干净，但位置计算要自己维护。

示例里的文本 Run 都是 9 号字，中间那段加粗。这是常见的主次区分：章节名比文档名和日期更重要。

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

首页不同（`titlePg`）的价值在于封面页通常不需要页眉——封面只有标题和版本信息，加上页眉会显得杂乱。

实现分两步：先在节属性上添加 `titlePg` 节点启用开关，再分别创建 FIRST 与 DEFAULT 两种页眉。

顺序不能反。先创建 FIRST 页眉再启用 `titlePg`，在部分 Word 版本里首页页眉不会立即生效，需要在 Word 里打开页眉编辑状态才会应用。先开开关再建页眉，兼容性更好。

示例里 FIRST 页眉居中显示传入的文本，DEFAULT 页眉同样居中。这段代码只是演示结构，实际项目中首页页眉通常设为空白——创建了页眉对象但不加内容，表示"首页有页眉区域但不显示内容"，这样才能保证封面没有页眉文字。

一个需要理解的细节：`titlePg` 是按节生效的。文档有多个节时，每个节都要单独启用。只在第一节启用，后面的节仍然每页都有页眉。

首页页脚也是同样的机制。示例在 14.5 的综合示例里同时用了首页页脚（版权信息）和默认页脚（页码），逻辑一致。

排查"首页页眉没生效"的顺序：检查 `titlePg` 节点是否存在 → 检查 FIRST 页眉是否创建在正确的节 → 检查首页是不是本节的第一页。第三条最容易被忽略：如果首页是上一节的内容，在 Word 的视图里看起来是"第一页"，但实际属于另一个节。

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

奇偶页不同适用于双面打印的文档：奇数页（正面）与偶数页（背面）的页眉分别放在外侧，方便读者翻页时定位。

启用方式与首页不同不一样：开关不在节属性里，而在文档设置（`settings.xml`）里。示例通过 `doc.Document.settings` 取设置节点，再 `AddNewEvenAndOddHeaders()`。

这个差别不是设计随性，而是 OOXML 的规定：`evenAndOddHeaders` 是文档级设置，作用于整个文档；`titlePg` 是节级设置，作用于单个节。

启用之后，DEFAULT 页眉变成"奇数页页眉"，EVEN 页眉才是偶数页的。示例里奇数页右对齐、偶数页左对齐，这是双面装订的常规做法。

奇偶页不同的配置在三个层面要一致：

- 文档设置里启用 `evenAndOddHeaders`；
- 奇数页用 DEFAULT、偶数页用 EVEN 创建页眉；
- 页边距如果也做镜像，左右边距要按奇偶互换。

第三条 NPOI 支持有限，通常靠模板预设。示例只做了前两条。

一个常见误解是"奇偶页不同就是每两页交替"。实际是按页面在文档中的物理顺序编号，与内容分节无关。插入分节符后，节的起始页会重新计算页码（如果设置了重新编号），但奇偶判断仍按绝对页序。

排查顺序：先确认 `evenAndOddHeaders` 节点已写入 → 再确认 EVEN 页眉存在 → 最后确认偶数页确实显示的是 EVEN 页眉。在 Word 里切换视图到"打印布局"并翻到偶数页，是最直接的验证方式。

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

页脚与页眉的机制完全相同，只是位置在页面底部。创建方式、类型枚举、继承规则都一样。

页脚最常用的内容是页码。页码不是普通文本，而是**域**（field）：文档打开或打印时由 Word 动态计算并填充。NPOI 里通过 `fldSimple` 节点写入域代码。

这一节的三段代码分别处理：纯文字页脚、带页码的页脚、带版权信息的多行页脚。

### 14.3.1 创建页脚

结构与创建页眉一致：`doc.CreateFooter(HeaderFooterType.DEFAULT)` → 建段落 → 居中 → 加文本。

样式上页脚通常比页眉更小：示例用 9 号字、灰色。正文 12 号、页眉 10 号、页脚 9 号，是技术文档常见的字号阶梯。

页脚文本的内容选择上，常见的有三类：页码、版权信息、文档标识（编号、密级、版本）。密级标识放在页脚是公文和涉密文档的规范要求。

与页眉一样，重复创建同类型页脚会产生多个引用。判断方法是检查 `doc.FooterList` 里是否已有对应类型。

页脚也支持首页不同和奇偶页不同，与页眉共用 `titlePg` 和 `evenAndOddHeaders` 开关——这两个开关同时控制页眉和页脚，不是分开的。

一个排版细节：页脚区域的高度由页脚距离（`pgMar.footer`）和页脚内容高度共同决定。页脚内容超过一行时，会自动向下扩展，可能挤压正文区域。多行页脚（比如 14.3.3 的页码加版权）要预留足够的下边距。

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

页码的实现是本节的难点，因为它不是三个字"第 X 页"的静态文本，而是"文字 + 域 + 文字 + 域 + 文字"的组合。

示例的目标格式是"第 X 页 / 共 Y 页"：

1. Run 写"第 "；
2. 在段落的 XML 上添加 `fldSimple`，`instr` 为 `PAGE`；
3. Run 写" 页 / 共 "；
4. 再加一个 `fldSimple`，`instr` 为 `NUMPAGES`；
5. Run 写" 页"。

两个域代码的含义：

- `PAGE`：当前页码，由 Word 在渲染时计算；
- `NUMPAGES`：文档总页数，同样在渲染时计算。它反映的是"Word 自己排版后有多少页"，与 NPOI 生成时预估的页数无关。

这里有一个必须了解的行为：**域在文档刚生成时可能显示为占位或空**。NPOI 写入的只是域代码，没有计算结果。Word 打开时会自动更新域，但某些查看器（在线预览、LibreOffice 的部分版本）不会主动更新，显示为空白或"错误！未定义书签"。

解决办法有两个：一是用 Word 打开一次再保存，域会被计算并缓存；二是在文档设置里打开"打印前更新域"（`updateFields`）。NPOI 对后者的支持需要通过设置节点手工添加，示例没有涉及。

`AddNewFldSimple()` 是加在段落上的，不是加在 Run 上。这是域与普通文本的结构差异：域是段落级的内容元素，与 Run 平级。加在 Run 上会得到非法结构。

示例里 `fldSimple1.instr = "PAGE"` 只设了指令，没有设域结果。完整的域通常还包含一个用于显示缓存结果的 Run。省略它不影响 Word 打开后更新，但会影响不支持更新的查看器。

第二个方法 `CreateSimplePageNumberFooter` 只放一个 PAGE 域，是最简形式，适合页码单独居中的版式。

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

这个例子把页脚做成两行：第一行页码居中，第二行版权信息居中。

两行用两个段落实现。页脚区域可以放多个段落，高度自动扩展。这里要注意下边距是否够用——两行 9 号字加行距大约需要 0.5 厘米，加上页脚距离，下边距至少要留 1 厘米以上。

版权文本用 `$"© {DateTime.Now.Year} {companyName} 版权所有"` 拼接，年份取运行时年份。这种写法适合"生成时即固定"的文档，但如果文档要长期存档、跨年再次打开，年份就停在生成那年了。对需要动态更新的场景，年份也应当用域（`DATE` 域配合格式），示例没有这么做。

© 符号在源码里是 Unicode 字符，字符串里直接写没问题。但要注意源文件编码——如果构建环境的编码不是 UTF-8，© 可能变成乱码。稳妥写法是用 `\u00A9` 转义。

字号 8 号、颜色 `999999` 是版权信息的常用弱化样式。8 号已经接近可读下限，打印出来会比较淡，正式文档里用 9 号更合适。

这段代码没有设置段落的段前段后间距，两行之间会有一个默认行距的空隙。想要紧凑，可以给第一段设 `SpacingAfter = 0`。

页脚内容同样是"每节独立"的。多节文档要在每个节里都设置，或者依赖节的"链接到前一节"继承机制。NPOI 里继承是默认行为——新建的节如果不单独创建页脚，会沿用上一节。

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

分节是 Word 排版里最容易被忽视、又最能解决实际问题的一个机制。它把文档切成若干段，每段可以有自己的纸张、方向、页边距、页眉页脚和页码规则。

典型场景：一份报告封面用 A4 纵向、中间一张宽表用 A4 横向、附录又回到纵向；或者正文从第 1 页开始编号、目录用罗马数字编号。这些都需要分节。

NPOI 对分节的支持是"能插入分节符、能给分节符设属性"，但没有更高层的封装。理解 XML 结构是绕不过去的。

### 14.4.1 插入分节符

分节符在 OOXML 里不是独立的元素，而是挂在**段落**上的 `sectPr`。也就是说，分节符是一个空段落，这个段落携带了"此处分节"的属性。

示例的步骤体现了这点：先建一个空段落，取它的 CTP 节点，加 pPr，再在 pPr 里加 sectPr，最后设分节类型。

四种分节类型：

| 类型 | 行为 |
|------|------|
| nextPage | 从下一页开始新节，最常用 |
| continuous | 在同一页内开始新节，用于改变栏数等 |
| evenPage | 从下一个偶数页开始 |
| oddPage | 从下一个奇数页开始 |

`continuous` 的实际用途比看起来窄：它不能改变纸张大小或方向（同一页内没法变），主要用于改变分栏、页边距这类属性。想横向排版一页宽表，必须用 `nextPage`。

新节会继承上一节的属性。插入分节符之后如果想改新节的纸张，需要拿到新节的 sectPr——它在哪个段落上？就在分节符之后第一个"带 sectPr 的段落"上，或者文档末尾的 body 级 sectPr。

一个结构性的坑：**最后一个节的属性在 body.sectPr 上，不在任何段落上**。所以"给最后一节设横向"要改 body 的 sectPr，而不是找段落。反过来，"给中间某节设属性"要改它结束处的那个段落上的 sectPr。

`InsertNextPageSection` 是对常用类型的封装，实际项目里通常还会封装 `InsertContinuousSection`。分节符段落的高度建议设为 0 或者字体设小，否则会在页面上留下一条空行。

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

这个方法接收一个段落，给这个段落上的 sectPr 设置横向属性。

三个关键点。

第一，`para.GetCTP()` 只对"分节符段落"有意义。普通段落上设置 sectPr 不会报错，但那个 sectPr 表示"从此段落开始新节"，语义上会把文档结构改乱。正确用法是：先插入分节符，拿到分节符段落，再设置属性。

第二，`pPr.sectPr ?? pPr.AddNewSectPr()` 这个写法与前面"取或建"的模式一致。分节符段落通常已经有 sectPr（插入时就建了），这里是取到已有的那个。

第三，`sectPr.AddNewPgSz()` 是新建页面尺寸节点。如果该节已经有 pgSz（从上一节继承或之前设置过），再新建会产生两个 pgSz 节点，XML 非法。稳妥写法是 `sectPr.pgSz ?? sectPr.AddNewPgSz()`，与页面设置辅助类保持一致。

宽高必须按横向写：`w = 16838`、`h = 11906`。只设 `orient` 不交换宽高，结果就是前面 14.1.1 说的"横向标记、纵向尺寸"。

改完横向之后还要考虑页边距。原来的上下边距变成横向页面的左右边距后，可能不符合视觉预期。横向节的边距通常要单独设置一遍。

验证分节是否生效的可靠方法是在 Word 里打开"显示编辑标记"，分节符会显示成双虚线加"分节符(下一页)"字样。如果看不到，说明分节符没插进文档，或者插进了表格单元格里（表格内的分节符行为很特殊，应当避免）。

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

这个示例把页面设置、页眉页脚、分页、正文排版拼成一份完整的文档，结构接近真实的报告模板。

读这类综合示例的方法是按"文档从哪来→每页长什么样→内容怎么排"三层拆解：

- 第一层是文档对象和节属性（页面大小、边距）；
- 第二层是页眉页脚（首页一套、其他页一套）；
- 第三层是正文内容的段落序列。

三层之间是独立的，任何一层出问题都只影响它自己。这种分离也正是代码组织应当追求的结构。

### 14.5.1 创建完整格式的文档

逐段拆解这份示例，按顺序看每个部分的作用与隐患。

**1. 页面设置**：`SetA4Portrait` 加 `SetNormalMargins`，两行完成纸张和边距。这是辅助类存在的意义——如果每次都手写 pgSz 和 pgMar，重复代码会淹没有效逻辑。

**2. 首页不同**：取 body 的 sectPr，加 `titlePg`。这一步在创建页眉之前，顺序正确。

**3. 首页页眉**：创建了 FIRST 页眉对象和一个空段落，但不加内容。这表示"首页有页眉区域但无内容"，是实现"封面无页眉"的标准做法。如果连页眉对象都不创建，Word 会沿用默认页眉，封面就会出现页眉文字。

**4. 默认页眉**：居中显示"NPOI技术文档"，10 号灰色，并在段落底部加了一条 `CCCCCC` 的 0.5 磅细线。页眉下划线是正式文档的常见装饰，用段落下边框实现比画一条水平线更简单。

**5. 首页页脚**：居中放版权信息。注意这里没有放页码——封面通常不编页码，这是合理的排版决策。

**6. 默认页脚**：段落顶部加细线，内容是"第 X 页 / 共 Y 页"，域代码与 14.3.2 相同。

**7. 正文**：标题段用 `SpacingBefore = 5000` 把标题压到页面中部（5000 twip 约 3.5 英寸），模拟封面效果。这种"用空间距定位"的做法在生成封面时很常见，简单有效，但页面尺寸变化时需要调整数值。

副标题和日期用较小的 `SpacingBefore`（500 和 2000）递进排列，形成封面的垂直节奏。

**分页**用 `breakRun.AddBreak(BreakType.PAGE)`，与分节符不同：分页只是换页，不改变节属性。如果封面和正文需要不同的页面设置（比如封面没有页眉页脚），就该用分节符而不是分页符。

**正文**只有一个小节标题和一段说明文字，演示了 16 号加粗标题、12 号首行缩进正文的组合。

整段代码有几个可以改进的地方。文档对象没有用 `using` 包裹，异常时会泄露资源；保存路径是相对路径；`DateTime.Now.ToString("yyyy年MM月dd日")` 用的是当前日期，生成历史文档时应当允许传入日期参数。

还有一处值得注意：没有设置 `titlePg` 之外的页码起始值。正文从封面之后的第 2 页开始编号，如果希望正文从"第 1 页"开始，需要新开一节并设置页码起始值——这又回到了分节与页码规则的配合。

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

本章的内容有一个共同特点：都由 OOXML 的节属性驱动，都是"结构正确才会显示正确"。设置不生效时，先别怀疑 API，先检查三件事——节属性节点是否存在、是否挂在正确的位置、开关（titlePg、evenAndOddHeaders）是否已启用。

实践建议：生成带页眉页脚的重要文档后，一定用 Word 打开并翻几页检查，重点看封面、偶数页、分节后的第一页。这三处是页眉页脚最容易出问题的地方，也是自动化测试最难覆盖的地方。

---

> **下一章预告**：第十五章将介绍PowerPoint演示文稿操作。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/csharp/npoi/第13章-Word图片与多媒体/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第15章-PowerPoint演示文稿操作/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

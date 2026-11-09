---
layout: default
title: 第十一章：Word段落与文本样式
---

# 第十一章：Word段落与文本样式

## 11.1 段落样式深入

Word 文档的排版单位是段落，不是行。一个段落承载对齐方式、缩进、行距、边框、底纹和编号，段落里的文本由若干 Run 组成，Run 才是字体、字号、颜色、加粗这些字符格式的载体。理解这层结构，才不会被"为什么设置加粗后整段都变了"这类问题卡住。

本节从三件事入手：用内置样式表达层级、用编号系统生成列表、用段落属性画边框和底纹。这三类是技术文档排版中用得最多的能力。

### 11.1.1 标题样式

示例里的 `CreateHeading` 分两步设置标题：先给段落挂样式名，再逐项设置字体格式。

`para.Style = "Heading1"` 挂的是文档模板里的内置样式。这样做的好处是标题会进入 Word 的导航窗格和自动生成的目录——目录域读取的正是这些内置样式。如果只设置了字号加粗而不挂样式，看起来像标题，但导航窗格里没有，目录也生成不出来。

风格名依赖文档模板。NPOI 新建的 `XWPFDocument` 自带一套默认样式，中文环境里常见的"标题 1"在英文模板里是 `Heading1`。名字写错时 NPOI 不会报错，段落只是拿到一个不存在的样式引用，渲染回退成正文。判断方式是生成文件后用 Word 打开，看导航窗格是否列出标题。

后面的 `FontSize` 与 `SetFontFamily` 属于显式覆盖。示例里的中文字体用 `FontCharRange.None`，意思是"不限定字符范围"，整段统一字体。如果只给中文字符指定范围，英文和数字会落到默认字体上，同一行出现两种字形，看起来很不整齐。

字号单位是磅（point），22 对应"二号"到"小二"之间，18、14 递减。标题的字号、加粗、字体三项写在样式之外，是为了不依赖模板里样式的具体定义——换一个模板，样式名还在，但字号可能不同，显式设置能保证输出一致。

要注意 `run.SetText(text)` 与 `style` 的先后顺序无关，但一个段落里通常只放一个 Run 做标题。放多个 Run 而其中某个漏设格式，就会出现标题里某个字不粗的情况。

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

这段代码里藏着两种完全不同的列表实现方式，理解它们的差别比记住 API 更重要。

**编号列表**走的是 Word 的编号系统。`doc.CreateNumbering()` 拿到文档级的编号容器，`AddAbstractNum()` 定义一个抽象编号（决定符号形态：阿拉伯数字、字母、罗马数字），`AddNum()` 基于抽象编号创建一个具体的编号实例，最后用 `para.SetNumID(numId)` 把段落挂到这个编号上。这样生成的列表是"活的"：在 Word 里回车会自动续号，插入一项后面的序号自动调整。

**项目符号列表**走的是手工路径。示例用 `run.SetText("• " + item)` 直接拼一个圆点字符，再设置左缩进 420。它不进入编号系统，所以不会自动续号，也不能通过"更改列表级别"调整符号样式。好处是实现简单、不需要理解编号机制，坏处是复制粘贴和后续编辑时表现不像真正的列表。

两种方式怎么选：正式交付的文档用编号系统，临时生成的清单用手工符号。技术文档的章节列表、步骤说明属于前者。

`IndentationLeft = 420` 与 `IndentationHanging = 210` 都是以 twip（1/20 磅）为单位的缩进。420 约等于 0.74 厘米，接近两个中文字符的宽度。悬挂缩进的意思是首行比其他行少缩进，形成"符号在左边、文字对齐"的效果，这是列表排版的常见形式。

手工方案里把符号和文字放在两个 Run 里，是为了让符号单独设置颜色。示例里符号用蓝色 `0066CC`，正文保持默认。这个细节说明 Run 的划分依据是"格式是否相同"，而不是语义。

编号列表的嵌套没有在示例里展开。实现方式是为不同级别创建不同的抽象编号，段落上除了 numId 还要设置列表级别（`para.SetNumILvl`）。级别设错时所有项都显示同一层的编号，看起来像没生效。

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

边框和底纹在技术文档里常用于突出提示块、代码段、注意事项。示例给了两条实现路径。

**边框**通过 `SetBorderTop` 等四个方法设置，参数依次是线型、线宽、间距、颜色。线型用 `Borders.Single` 表示单实线，线宽单位是 1/8 磅，6 表示 0.75 磅，颜色用不带井号的十六进制字符串。四边分别调用是为了单独控制，也可以只设左边框做引用块样式。

**底纹**没有对应的强类型方法，示例通过 `para.GetCTP()` 拿到底层 XML 节点（CT_P），依次添加 `pPr`（段落属性）和 `shd`（底纹），再设置填充色与图案类型。这是 NPOI 里一个反复出现的模式：高层 API 覆盖不到的属性，就下沉到 OOXML 的 CT 层直接写。

下沉到 CT 层有两个需要注意的地方。一是命名空间。`AddNewPPr()`、`AddNewShd()` 这类方法来自 NPOI 生成的强类型 XML 包装，需要引入 `NPOI.OpenXmlFormats.Wordprocessing`，否则 `ST_Shd` 这类枚举找不到。二是顺序。OOXML 的 `pPr` 子元素有规定的出现顺序，手工追加的元素如果位置不对，Word 打开时可能提示"内容有问题"，或者静默忽略该属性。

底纹的 `fill` 是背景色，`val` 是图案类型。示例用 `ST_Shd.clear` 表示纯色填充。如果设成其他图案（比如百分比网点），`fill` 表示图案前景色，还需要配合 `color` 指定背景色。

一个实用建议：把边框和底纹封装成"提示块"与"警告块"两个方法，颜色和线型写在方法里，业务代码只传文本。这样样式调整只改一处，不用在每个调用点改颜色值。

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

段落级格式决定整体排版，字符级格式决定文本本身的样子。这一节的三个主题——字符间距、文本效果、上下标——都属于字符级，作用对象是 Run 而不是段落。

一个共同的坑：字符属性必须设在 Run 上。设在段落上不会生效，也不报错。新建 Run 后立刻设置属性、再 `SetText`，是最不容易出错的做法。

### 11.2.1 字符间距

示例通过 `run.GetCTR()` 拿到 Run 的底层节点，添加 `rPr`（字符属性）和 `spacing`，再赋值。这又是下沉到 CT 层的写法，因为 NPOI 的高层 API 没有暴露字符间距。

间距值的单位是点的 1/20。正数拉开字距，负数收紧字距。技术文档里这个能力主要用在两处：标题字距拉开显得舒展；表格里的长数字或代码标识符收紧，避免换行。

使用时有三个注意点：

- **只对大写标题用正值**。正文拉开字距会降低阅读速度，中文尤其明显；
- **负值要谨慎**。超过字宽的一半会重叠，不同字体下重叠程度不同，在 A 机器上刚好，B 机器上就叠在一起；
- **CT 层修改要在 Run 有文本之前完成，或者修改后再设置文本**。如果先设文本再改 CT 节点，某些版本下会出现属性节点顺序错乱。

排查字符间距不生效时，先确认改的是不是当前 Run。段落里有多个 Run 时，很容易只改到第一个，看起来像"只有第一个字有间距"。

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

这个方法是把常见的字符效果封装成枚举，调用方传 `TextEffect`，内部 switch 到对应的属性。六种效果分别对应：

| 枚举值 | NPOI 属性 | 效果 |
|--------|-----------|------|
| Bold | `IsBold` | 加粗 |
| Italic | `IsItalic` | 斜体 |
| Underline | `Underline` | 下划线，用 `UnderlinePatterns` 指定线型 |
| Strike | `IsStrikeThrough` | 删除线 |
| Shadow | `IsShadowed` | 阴影 |
| Emboss | `IsEmbossed` | 浮雕 |
| SmallCaps | `IsSmallCaps` | 小型大写字母 |

下划线用枚举而不是布尔值，因为 Word 支持十几种线型（单线、双线、波浪线等）。默认的单实线是 `UnderlinePatterns.Single`。

阴影、浮雕、小型大写这些效果在中文字体下表现不稳定。阴影和浮雕依赖字体本身有对应的字形轮廓，中文字体通常没有，Word 会用模拟方式渲染，打印出来可能与屏幕不一致。正式文档里建议只用加粗、斜体、下划线、删除线这四种基础效果。

封装成方法的价值在于统一。项目里如果每个模块各自写 `run.IsBold = true`，后面想统一改"强调用红色加粗"就要全局搜索。走统一入口，改一处即可。

一个容易误解的点：`IsSmallCaps` 不会把输入的小写字母转换掉，它只是告诉 Word 用小号大写字母显示。文本内容仍是原来的大小写，复制出来也是原文。

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

上下标的实现方式是把一段文本拆成多个 Run，单独设置其中某个 Run 的垂直对齐。

示例生成 H₂O：三个 Run 分别是 H、2、O，中间的 2 设置 `VerticalAlign.SUBSCRIPT`。同理 x² 用 `VerticalAlign.SUPERSCRIPT`。

这种拆 Run 的做法有一个必须接受的后果：文本在逻辑上被切碎了。如果后续要做查找替换，"H2O"这个词在文档里已经不存在，只有 H、2、O 三段。查找功能会找不到它。

还有一个细节：示例里下标 Run 的字号改成 10，正文字号是 12。Word 本身会自动缩小上下标，显式设置字号是为了让效果更明显，也可能是为了抵消某些渲染差异。两者叠加时以下标字号为准。

写化学式、数学公式时，Run 的拆分顺序必须与实际显示顺序一致。常见错误是先创建所有文本 Run 再回头设置属性，结果 `para.CreateRun()` 的返回值被覆盖，最后只有最后一个 Run 拿到属性。

如果需要整段都是同一个公式，更省事的做法是用 Word 的公式对象（OMML），NPOI 支持直接写入公式 XML。文本方式适合简单的上下标，复杂公式走 OMML 更合适。

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

查找替换是文档模板化最常用的能力：一份模板里预留若干占位符，生成时批量替换成实际数据。NPOI 没有提供 `Range.Find` 那样的高层 API，只能遍历段落和 Run 自己实现。

遍历范围要覆盖四类容器：正文段落、表格单元格内的段落、页眉段落、页脚段落。漏掉任何一类，就会出现"正文替换了，页眉的日期还是旧的"这种问题。

### 11.3.1 简单文本替换

示例的 `FindAndReplace` 先分门别类遍历，再统一交给 `ReplaceParagraphText` 处理。这个分层是对的：遍历逻辑和替换逻辑分开，新增容器类型时只改遍历部分。

`ReplaceParagraphText` 里有两个关键判断：

- `string fullText = para.Text;` 取整段文本做判断。段落文本是所有 Run 拼接的结果，用它判断"是否包含目标字符串"成本低；
- 真正的替换在 Run 级别执行。`run.Text` 只包含当前 Run 的文本，所以替换必须落在包含目标串的那个 Run 上。

这里有一个 NPOI 的结构性限制：**占位符如果跨 Run 被拆开，这个方案替换不了**。比如 "{Name}" 的 "{Na" 在一个 Run 里，"me}" 在下一个 Run 里——Word 在编辑过程中经常这样拆分 Run（拼写检查、格式变化、输入法切换都会触发）。这时 `runText.Contains(占位符)` 对每个 Run 都是 false，整段判断却为 true，结果就是"检测到要替换但什么都没换"。

处理跨 Run 的通用做法是：在段落级别找到完整目标串的位置，然后重建段落里的 Run。具体步骤是按 `para.Text` 算出匹配区间，遍历 Run 累加长度定位区间覆盖了哪几个 Run，把受影响的 Run 内容截断/合并，再插入替换后的文本。实现量不小，但这是模板替换必须跨过的一道坎。

`run.SetText(newText, 0)` 的第二个参数是位置索引。传 0 表示从第一个字符开始覆盖，等价于整体替换。如果传其他值，需要注意语义是"替换指定位置的文本"还是"插入"，不同版本行为有差异，统一传 0 最稳。

替换顺序也有讲究。如果替换字典里 "{A}" 的值包含 "{B}"，先替换 A 会导致新插入的 "{B}" 也被后续替换。要么按长度降序处理，要么先把所有占位符替换成不会冲突的临时标记，再统一还原。

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

示例的 `ReplaceTextWithFormat` 在替换的同时修改格式：新文本可以选择加粗、改颜色，同时保留原来的字号、字体、粗体、斜体状态。

逻辑上分三步：备份原格式 → 替换文本 → 应用新格式或合并原格式。其中 `run.IsBold = bold || wasBold;` 用的是"或"语义：只要原来加粗或要求加粗，结果就加粗。这种合并策略适合"高亮关键词"的场景，不需要关心原文本是否已经加粗。

代码里备份了 `fontSize` 和 `fontFamily` 两个变量，但后续没有用到——这是示例代码的冗余。实际项目里如果要在替换时保留格式，正确的做法是不动这两个属性：`SetText` 只改文本内容，Run 的字符属性（`rPr`）保持不变，字体字号会自动延续。换句话说，格式天然是保留的，不需要手工拷贝。

真正需要手工处理的场景是"替换后要清除原格式"。示例没有提供这个能力，实现方式是替换文本后显式重置 `FontSize`、`SetFontFamily`、`IsBold`、`IsItalic` 等属性，或者更彻底地删除 Run 的 `rPr` 节点。

颜色参数用 `string color = null` 表示"不改颜色"，调用方只在需要标红时传值。这种可选参数风格比重载多个方法简洁，但要注意传空字符串和传 null 的语义区别：空字符串会走到 `!string.IsNullOrEmpty` 的判断里被跳过，与 null 效果相同。

带格式替换的典型用例是审核标记：把模板里的 "{待确认}" 替换成实际内容，同时标红加粗，提示人工复核。这类标记最终交付前还要清除，所以替换逻辑最好支持"清除标记"的反向操作。

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

所谓富文本段落，指同一段落里混用多种字符格式：一部分加粗、一部分斜体、一部分彩色。实现方式就是拆 Run——每个 Run 承载一种格式的连续文本。

这里没有"给部分文字加格式"的 API，只有"新建一个 Run 并设置格式"。所以写富文本代码时，脑子里要有一个"把文字切成片段"的过程：先想清楚哪几段文字格式不同，再逐段创建 Run。

### 11.4.1 创建富文本段落

示例的 `CreateRichTextParagraph` 演示了分段建 Run 的完整流程，`AddRun` 把重复的四行设置封装成一个方法。

逐段看这个段落的结构：

- 首行缩进 `IndentationFirstLine = 420` 通过段落属性设置，作用范围是整段，只需要设一次；
- "这是一段包含"用默认格式，"加粗"用 `IsBold`，"斜体"用 `IsItalic`，"红色"用 `SetColor`，"下划线"直接创建 Run 设置 `Underline`；
- 标点符号单独作为 Run 出现。这不是必须的——标点可以跟在上一段文字的 Run 里。示例单独拆出来，可能是为了让每个格式片段的边界更清晰。

`AddRun` 的封装顺序值得注意：先 `CreateRun`，再 `SetText`，最后设置格式。这个顺序能保证格式作用在正确的 Run 上。如果反过来先设置格式再 `SetText`，在部分版本下 `SetText` 会重置某些属性。

一个实际经验：富文本段落里 Run 的数量直接等于格式切换次数加一。格式片段过多（比如逐字变色）会让文档体积增加、编辑变慢。几十个 Run 没有问题，上千个就要考虑换实现方式。

颜色参数用 `"FF0000"` 这种不带井号的写法。带井号会被当成字面文本写进属性，导致颜色不生效且不报错，是 NPOI 里最常见的错误之一。

最后输出的段落是"看起来富"还是"真的富"，判断标准是选中文字时 Word 的格式栏是否显示对应状态。如果只是颜色不同但格式栏显示正文，说明格式设在了不对的层级。

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

这一节的标题里已经写明"简化版"，理解它的简化程度比使用它更重要。

示例的做法是：用正则去掉全部 HTML 标签得到纯文本，再根据原文里是否出现 `<b>`、`<i>` 等标签，决定整段的粗体或斜体。这意味着：

- **不解析嵌套**。`<b><i>text</i></b>` 只会命中加粗分支，斜体丢失；
- **不支持行内混排**。一段里既有加粗又有普通文字时，整段都会被加粗或者都不加；
- **不支持段落结构**。`<p>`、`<br>`、列表都被压成一段文本；
- **会误删内容**。正则 `<[^>]*>` 对 `<` 和 `>` 之外的字符不敏感，但会把 `a < b` 这类数学表达里的尖括号当标签删掉；
- **不转义 HTML 实体**。`&amp;`、`&lt;` 原样保留在文档里。

它适合的场景只有一个：从富文本编辑器拿到一段纯文本加简单强调的 HTML，且能接受格式损失。

要真正做 HTML 到 Word 的转换，路线是解析 HTML 成节点树（可以用 AngleSharp 之类的库），再按节点类型映射到 NPOI 的段落和 Run：块级元素生成段落，行内元素生成 Run 并按标签设置格式，列表映射到编号系统。工作量在节点映射上，不在解析上。

无论用哪种方案，输入 HTML 的内容安全都要单独处理。转换器不会过滤 `<img>`、链接、脚本相关内容，如果 HTML 来自用户输入，转换结果可能包含不该出现在文档里的内容。

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

到这一节，前面零散的格式设置开始收拢成一个类。技术文档的排版规则其实很固定：标题几号字、正文什么字体、引用块怎么缩进、代码块什么底纹。把这些规则写进一个模板类，业务代码只调用 `CreateH1`、`CreateBody`，输出就会自然统一。

这种做法在报表、合同、技术手册这类"格式优先"的文档生成里尤其有价值：格式调整只改模板类一处，几十个生成入口同时生效。

### 11.5.1 创建样式模板类

`WordStyleTemplate` 把文档实例作为构造参数持有，每个方法内部创建段落并设置格式。逐个方法看它固化了哪些排版规则。

**CreateH1**：居中对齐、段后 200 间距、22 号加粗黑体。居中与段后间距是标题的常见排版，20 磅左右的段后距让标题与正文之间有呼吸感。

**CreateH2 / CreateH3**：段前段后间距逐级减小，字号 16 与 14。段前距大于段后距，是为了让标题靠近它要说明的内容，视觉上形成"标题属于下一段"的分组关系。

**CreateBody**：两端对齐、首行缩进 420、宋体 12 号。两端对齐让段落左右边缘整齐，中文排版常用。`firstLineIndent` 参数允许关闭缩进，用于图片说明、表格前后这类不需要缩进的段落。

**CreateQuote**：左右各缩进 420、左边框 12 号灰色、楷体 11 号斜体。左边框做引用标记是通用做法，楷体在中文字体里适合做引文。

**CreateCodeBlock**：四边 4 号灰色边框、Consolas 10 号。代码块用等宽字体是必须的，否则缩进和列对齐会乱。四边框把代码与正文明确隔开。

**CreateNote**：用【提示】或【警告】做前缀标签，标签本身加粗变色，正文正常。`noteType` 参数决定标签颜色与文字，这是把"语义"映射到"视觉"的典型写法。

**AddPageBreak** 与 **AddEmptyLine**：一个插入分页符，一个插入空段落。分页符用 `run.AddBreak(BreakType.PAGE)`，空行用创建空段落实现——注意空段落和 `AddBreak` 不是一回事，前者是排版元素，后者是硬分页。

这套模板有两个可以改进的地方。一是配色与字号硬编码在方法里，换一套视觉规范要改多处，可以抽成静态字段或配置对象；二是没有处理"样式已存在"的情况——如果文档基于某个模板文件创建，同名的内置样式可能已定义，这时显式设置格式会覆盖模板样式，反而让文档风格不统一。

实际项目里通常两种方式并存：结构用内置样式（保证导航和目录可用），局部视觉用模板类覆盖（保证跨模板一致）。

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

这一节把模板类用到一份技术文档上，展示调用顺序：先标题，再一级小节，正文、代码块、提示、引用依次排列，最后保存。

读这段示例时，重点不是记住调用顺序，而是体会"文档结构"如何在代码里体现：每个 `CreateH2` 对应一个章节，每个 `CreateBody` 对应一段说明，`CreateCodeBlock` 对应代码清单。代码结构与最终文档结构一一对应。

### 11.6.1 创建技术文档

示例的文档分成三章，每章用小节组织。几个细节值得注意。

`template.AddEmptyLine()` 在章节之间插入空行。它不是必需的——标题的段前距已经提供了间距——但额外的空行让章节分隔更明显。代价是空段落会进入文档结构，用 Word 的"显示编辑标记"能看到一串 ¶。对格式要求严格的文档，用段前距代替空行更规范。

`CreateBody` 的两个调用演示了参数用法：正常段落用默认缩进，代码块前的引导语传 `false` 关闭首行缩进。引导语紧接代码块，缩进会让它与代码块的对齐关系变乱。

`CreateCodeBlock("dotnet add package NPOI")` 直接传单行字符串，第二个代码块用 `\n` 拼接多行。代码块内部换行依赖文本里的换行符，Run 会按换行符渲染成多行。对较长的代码，更稳的做法是传入已经按行拼接好的字符串，避免在调用处写超长的字符串字面量。

`CreateNote` 的两次调用一次是提示、一次是警告，标签颜色与文字随类型变化。这是模板类里唯一的"语义参数"，其余方法都是位置参数。

最后保存到 `FileStream`，用 `FileMode.Create` 覆盖同名文件。生成文档的路径最好来自配置，不要硬编码在当前目录——服务端程序的工作目录往往与预期不同，文件会写到意料之外的位置。

一份完整的生成器还应当处理异常路径：`XWPFDocument` 实现了 `IDisposable`，创建后如果中途抛异常而没有释放，文件句柄会泄露。用 `using` 包住文档对象的生命周期，是比依赖 GC 更可靠的做法。

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
        
        template.CreateNote("NPOI 支持 .NET Framework 4.7.2 及以上版本，以及 .NET Core / .NET 5+。");
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

本章涉及的能力可以按层级归类：段落级（样式、编号、边框底纹）、字符级（间距、效果、上下标）、结构级（富文本拆分、查找替换、模板封装）。写生成代码时先确定要动的是哪一层，再找对应 API，能少走很多弯路。

一个收尾建议：把样式模板类当作项目资产维护，而不是每个生成任务临时写一遍。文档格式的统一性来自"所有出口都走同一个模板"，而不是来自每个人的细心。

---

> **下一章预告**：第十二章将介绍Word表格操作，包括表格的创建、样式设置和复杂表格的处理。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/csharp/npoi/第10章-Word文档基础操作/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第12章-Word表格操作/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

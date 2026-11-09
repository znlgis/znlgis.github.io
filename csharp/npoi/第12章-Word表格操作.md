---
layout: default
title: 第十二章：Word表格操作
---

# 第十二章：Word表格操作

## 12.1 表格基础

Word 表格由三层结构组成：表格（XWPFTable）→ 行（XWPFTableRow）→ 单元格（XWPFTableCell），单元格内部又是一个个小段落。这层嵌套决定了操作表格的方式：想改单元格里的文字格式，拿到的是段落和 Run；想改表格边框，操作的是表格本身；想调行高，操作的是行。

单位是最容易出错的地方。Word 内部的长度单位是 twip（1/20 磅，1440 twip 等于 1 英寸），页边距、表格宽度、行高、列宽、缩进几乎都用这个单位。代码里看到 `9000`、`500` 这类数字时，先换算成实际尺寸再判断是否合理，比反复试错快得多。

本节讲四件事：建表、遍历、行的增删、单元格的读写。这四项是后面所有样式和合并操作的基础。

### 12.1.1 创建表格

`doc.CreateTable(5, 4)` 一次建出 5 行 4 列的空表。这个 API 有两个特点要记住。

第一，它创建的是标准网格表格，单元格宽度由内容自动分配。要固定列宽，必须在建表后逐个设置，或者设置表格的整体宽度配合列宽。

第二，新表格会插在文档末尾，并且表格后面通常要补一个空段落，否则后续再添加段落时，新段落会被并入表格的最后一个单元格里。这是 NPOI 使用中最常见的结构性问题，表现是"我明明加了段落，打开文档却看不到"。

`table.Width = 9000` 设置整体宽度，9000 twip 约 6.25 英寸，接近 A4 纸去掉左右页边距后的正文宽度（A4 宽 8.27 英寸，左右各 1.25 英寸边距时正文约 5.77 英寸）。表格宽度设得比正文宽，Word 会压缩列或者溢出到页面外，打印时被裁掉。

宽度和列宽是两个层次：整体宽度决定表格占多宽，列宽决定各行内部怎么分。两个都设时以列宽之和为准，整体过小会导致单元格内容换行严重。

```csharp
using NPOI.XWPF.UserModel;

XWPFDocument doc = new XWPFDocument();

// 创建表格（指定行数和列数）
XWPFTable table = doc.CreateTable(5, 4);  // 5行4列

// 设置表格宽度（整体宽度，单位：twip，1英寸=1440twip）
table.Width = 9000;  // 约6.25英寸
```

### 12.1.2 获取和遍历表格

`doc.Tables` 返回文档里所有表格的列表，顺序与文档中出现顺序一致。遍历三层结构是读取表格数据的标准做法。

`row.GetTableCells()` 与 `table.Rows` 的区别值得说明。前者返回当前行实际存在的单元格，后者返回行对象列表。看起来差不多，但在处理合并单元格时差别很大：被水平合并的单元格在 OOXML 里仍然是独立的 tc 元素，只是标记了 continue，所以遍历到的单元格数量可能比视觉上的列数多。

`cell.GetText()` 返回单元格内全部段落的文本拼接结果，段与段之间的换行在返回值里体现为连接而不是换行符。如果单元格里有多段文字，用这个方法拿到的是一整串，需要保留段落结构时应当遍历 `cell.Paragraphs`。

表格数据导出的常见写法是转成二维数组或 DataTable。转的时候注意表头行：第一行通常是列名，数据从第二行开始。直接用第一行数据当表头，是因为很多模板表格确实这么设计，先确认结构再决定跳过几行。

遍历时如果同时要修改表格（删行、合并），不能一边遍历一边改。集合在修改后可能失效，稳妥做法是先收集要操作的行号，遍历结束后统一处理。

```csharp
// 获取文档中的所有表格
IList<XWPFTable> tables = doc.Tables;

// 遍历表格
foreach (XWPFTable tbl in tables)
{
    foreach (XWPFTableRow row in tbl.Rows)
    {
        foreach (XWPFTableCell cell in row.GetTableCells())
        {
            Console.Write(cell.GetText() + "\t");
        }
        Console.WriteLine();
    }
}
```

### 12.1.3 表格行操作

六个方法覆盖了行的增删改查，逐个说清语义与坑。

`table.GetRow(0)` 按索引取行，索引从 0 开始。索引越界时返回 null 还是抛异常，取决于版本，取到之后判空是必要的习惯。

`table.CreateRow()` 在末尾追加一行，新行的单元格数量由表格的定义决定。它不复制上一行的格式，追加出来的行是"裸"的，样式要重新设。

`table.InsertNewTableRow(2)` 在索引 2 的位置插入，原来的第 3 行变成第 4 行。插入后同样需要补单元格，否则这一行是空的，Word 打开时可能表现异常。

`table.RemoveRow(0)` 按索引删除。注意删除后后续行的索引整体前移，循环里删除时要从后往前删，或者删完立刻调整索引。

`row.Height = 500` 设置行高，单位 twip，500 约 0.35 英寸。这个值是"最小高度"还是"固定高度"取决于另外的行属性设置，默认情况下 Word 会按内容撑开行高。想要固定行高，还需要设置行的 `HeightRule` 之类的属性（示例未展开）。

`row.SetCantSplitRow(true)` 阻止行跨页拆分。长文档里的表头行特别需要这个设置，否则表格跨页时一行会被切成两半，表格看起来被拦腰截断。配合"标题行重复"（把首行标记为重复表头）一起用，跨页表格的可读性会好很多。

```csharp
// 获取表格行
XWPFTableRow row = table.GetRow(0);  // 获取第一行

// 获取所有行
IList<XWPFTableRow> rows = table.Rows;

// 添加新行
XWPFTableRow newRow = table.CreateRow();

// 在指定位置插入行
XWPFTableRow insertedRow = table.InsertNewTableRow(2);  // 在第3行位置插入

// 删除行
table.RemoveRow(0);  // 删除第一行

// 设置行高
row.Height = 500;  // 单位：twip

// 设置行不允许跨页
row.SetCantSplitRow(true);
```

### 12.1.4 表格单元格操作

单元格是表格里真正承载内容的容器，七个方法各自解决一个问题。

取单元格用 `row.GetCell(0)`，取整行用 `row.GetTableCells()`。`AddNewTableCell()` 在行尾追加一个单元格——这个方法在补行结构时很关键，因为插入的行默认没有单元格。

`cell.SetText("内容")` 是最省事但也最"粗暴"的写入方式：它清空单元格原有内容，新建一个段落写入文本。原有格式、对齐、段落结构都会丢失。设置内容后再调 `SetVerticalAlignment`、`SetColor` 是可以的，但要在 `SetText` 之后再设段落对齐，否则段落被重建、对齐设置丢失。

`cell.GetText()` 与 `SetText` 对称，读取全部文本。

`cell.SetWidth("2000")` 设置单元格宽度，参数是字符串形式的 twip 数值。这里用字符串而不是 int，是 NPOI 沿用了 OOXML 属性为字符串表达的设计。传数字会编译失败，传 `"2000"` 才对。

`cell.SetVerticalAlignment(...)` 设置垂直对齐，枚举值是 TOP、CENTER、BOTTOM、BOTH。垂直对齐作用于单元格，水平对齐作用于单元格里的段落——这是两个不同层级，代码里经常只设了垂直对齐，发现文字仍然靠左，就是因为水平对齐要另外设段落属性。

```csharp
// 获取单元格
XWPFTableCell cell = row.GetCell(0);  // 获取第一个单元格

// 获取所有单元格
IList<XWPFTableCell> cells = row.GetTableCells();

// 添加新单元格
XWPFTableCell newCell = row.AddNewTableCell();

// 设置单元格文本
cell.SetText("内容");

// 获取单元格文本
string text = cell.GetText();

// 设置单元格宽度
cell.SetWidth("2000");  // 单位：twip

// 设置单元格垂直对齐
cell.SetVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
```

## 12.2 表格样式

表格默认带一套浅色边框，多数场景需要自己改：正式报表用细黑线，三线表只保留顶线、底线和表头下框线，数据表用斑马纹提高可读性。样式设置分三类：边框（表格级）、背景色（单元格级）、对齐（段落级与单元格级混合）。

### 12.2.1 表格边框

`SetTableBorders` 调用了六个方法：四条外边加内部横线、内部竖线。参数统一是四个：线型、线宽、间距、颜色。

线宽单位是 1/8 磅，4 表示 0.5 磅，是正文表格的常用粗细。间距一般填 0，表示线与内容之间不留空。颜色用不带井号的十六进制字符串，这一点和 HTML 的习惯不同，写成 `"#000000"` 会得到错误结果。

线型枚举实用价值最高的是四个：SINGLE 单实线、DOUBLE 双线、DASHED 虚线、NIL 无边框。`NIL` 常用来做三线表——把内部横竖线设为 NIL，只保留顶线和底线，视觉上更清爽。

三线表的实现方式：先全部设成 NIL，再单独设置顶线、底线和表头行的下边框。最后一项在表格级别没有直接方法，需要在表头行的每个单元格上设下边框。这是表格样式的常见需求，值得单独封装。

边框设置属于"整表"操作，会覆盖单元格级已有的边框设置。如果在某些单元格上设过特殊边框，又调用整表设置，特殊边框会被冲掉。顺序上应当先整表后局部。

还有一个容易忽略的点：表格嵌套时，对内层表格调用边框设置不会影响外层。但外层单元格的边框与内层表格的边框在视觉上会重叠，看起来像粗线，需要调细其中一层。

```csharp
/// <summary>
/// 设置表格边框
/// </summary>
public static void SetTableBorders(XWPFTable table)
{
    // 设置表格整体边框
    table.SetTopBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
    table.SetBottomBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
    table.SetLeftBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
    table.SetRightBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
    table.SetInsideHBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
    table.SetInsideVBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
}

// 边框类型
// XWPFBorderType.SINGLE - 单线
// XWPFBorderType.DOUBLE - 双线
// XWPFBorderType.DOTTED - 点线
// XWPFBorderType.DASHED - 虚线
// XWPFBorderType.THICK - 粗线
// XWPFBorderType.NIL - 无边框
```

### 12.2.2 单元格背景色

`cell.SetColor("CCCCCC")` 一行设置背景色。颜色同样是不带井号的十六进制。

示例里 `SetHeaderStyle` 展示了完整的表头处理：背景色加深蓝 `4472C4`，文字改白色并加粗，段落居中。三步缺一不可——只改背景不改文字颜色，深底黑字看不清；只改颜色不改加粗，表头与数据区的区分度不够。

这里有一个执行顺序的细节：`cell.SetColor` 可以在任何时候调用，但遍历 `cell.Paragraphs` 设置对齐与字体，必须在单元格已有内容之后。对空单元格遍历段落，拿到的可能是默认的一个空段落，设置之后 `SetText` 会重建段落，之前的设置丢失。

示例代码里先 `SetColor` 再遍历段落，是对的。如果顺序反过来，先遍历段落设样式、再 `SetText` 写内容，表头会变成白底黑字——样式全部丢失，但不会报错。

背景色与"底纹"在 OOXML 里是同一个属性，设置的是纯色填充。要使用图案底纹（网点、斜线）需要走 CT 层，日常报表用纯色足够。

```csharp
/// <summary>
/// 设置单元格背景色
/// </summary>
public static void SetCellColor(XWPFTableCell cell, string color)
{
    cell.SetColor(color);  // 十六进制颜色，如 "CCCCCC"
}

/// <summary>
/// 设置表头行样式
/// </summary>
public static void SetHeaderStyle(XWPFTableRow headerRow, string bgColor = "4472C4")
{
    foreach (XWPFTableCell cell in headerRow.GetTableCells())
    {
        cell.SetColor(bgColor);
        
        // 设置文本样式
        foreach (XWPFParagraph para in cell.Paragraphs)
        {
            para.Alignment = ParagraphAlignment.CENTER;
            foreach (XWPFRun run in para.Runs)
            {
                run.IsBold = true;
                run.SetColor("FFFFFF");
            }
        }
    }
}
```

### 12.2.3 单元格文本对齐

示例把对齐拆成两个方向、两个层级：

- 垂直方向：`cell.SetVerticalAlignment(vertical)`，作用于单元格，控制内容在单元格高度内的位置；
- 水平方向：`para.Alignment = horizontal`，作用于段落，控制文字在单元格宽度内的位置。

这个拆分不是 NPOI 的设计缺陷，而是 Word 的文档模型如此：垂直是单元格属性，水平是段落属性。理解这点之后，"为什么我设了居中文字还是靠左"就有了固定答案——检查是不是只设了垂直对齐。

枚举值方面，垂直对齐的上端、居中、底端分别对应 TOP、CENTER、BOTTOM。水平对齐用 `ParagraphAlignment`，常用 LEFT、CENTER、RIGHT、BOTH（两端对齐）。

数字列的排版还有一个技巧：数值列右对齐，表头也跟着右对齐，视觉上数字的个位能对齐成一条线，比居中更容易比较大小。示例里的表格辅助类没有做这个区分，全部居中，适合短文本，不适合数字。

两端对齐在单元格里通常不是好选择。单元格宽度固定、内容短，两端对齐会拉开字距，中文尤其明显。正文用两端对齐，单元格用左对齐或居中。

```csharp
/// <summary>
/// 设置单元格内容对齐方式
/// </summary>
public static void SetCellAlignment(XWPFTableCell cell, 
    ParagraphAlignment horizontal, XWPFTableCell.XWPFVertAlign vertical)
{
    // 垂直对齐
    cell.SetVerticalAlignment(vertical);
    
    // 水平对齐（通过段落设置）
    foreach (XWPFParagraph para in cell.Paragraphs)
    {
        para.Alignment = horizontal;
    }
}

// 垂直对齐方式
// XWPFVertAlign.TOP - 顶部对齐
// XWPFVertAlign.CENTER - 居中
// XWPFVertAlign.BOTTOM - 底部对齐
// XWPFVertAlign.BOTH - 两端对齐
```

## 12.3 合并单元格

Word 的合并单元格与 Excel 的实现思路完全不同。Excel 里有明确的合并区域对象，NPOI 在 Word 里没有——只能改每个单元格的 OOXML 属性，用 hMerge 和 vMerge 标记"我是合并起点"或"我并入前一个单元格"。

这套机制的直接后果是：合并后单元格本身还在，数量没变，只是显示上被合并了。所以遍历时仍会遍历到被合并的单元格，读取时要判断是否为空。

示例里的实现统一走 `GetCTTc()` 拿底层节点，再 `AddNewTcPr()` 加属性、`AddNewHMerge()` 加标记。这是本章第二次出现"高层 API 不够用就下沉到 CT 层"的写法。

### 12.3.1 水平合并

`MergeCellsHorizontally(table, row, fromCol, toCol)` 把某一行的连续单元格合并。

循环里的两个分支是核心：起始单元格标 `ST_Merge.restart`，后续单元格标 `ST_Merge.@continue`。`@continue` 里的 `@` 是 C# 的转义标识符前缀，因为 `continue` 是关键字。写代码时漏掉 `@` 会编译报错，是这类示例代码的常见笔误点。

三个实践问题：

**内容放哪**。合并后的显示内容取自起始单元格，后续单元格的内容不会消失但也不显示。示例在合并前只给起始单元格设了文字，这是对的。如果后续单元格也有文字，合并后那些文字会"消失"，实际仍存在于文件里，复制粘贴或脚本读取时还会出现。稳妥做法是合并前把后续单元格内容清空。

**合并后列数**。单元格对象数量不变，所以后续代码按索引取单元格时行为不变。这既是便利也是陷阱——看起来合并了，实际结构没变，某些布局计算会出错。

**重复调用**。示例用 `AddNewTcPr()` 添加属性节点，每个单元格第一次调用没问题，再调用一次就会产生重复的 tcPr 节点，文件结构非法。需要对同一表格多次设置属性时，先取已有 tcPr 再追加子元素，而不是每次都新建。

`ST_Merge` 枚举来自 `NPOI.OpenXmlFormats.Wordprocessing` 命名空间，漏引会报找不到类型。

```csharp
/// <summary>
/// 水平合并单元格
/// </summary>
public static void MergeCellsHorizontally(XWPFTable table, int row, int fromCol, int toCol)
{
    XWPFTableRow tableRow = table.GetRow(row);
    
    for (int i = fromCol; i <= toCol; i++)
    {
        XWPFTableCell cell = tableRow.GetCell(i);
        var ctTc = cell.GetCTTc();
        var tcPr = ctTc.AddNewTcPr();
        
        if (i == fromCol)
        {
            // 第一个单元格设置为合并起始
            tcPr.AddNewHMerge().val = ST_Merge.restart;
        }
        else
        {
            // 后续单元格设置为继续合并
            tcPr.AddNewHMerge().val = ST_Merge.@continue;
        }
    }
}
```

### 12.3.2 垂直合并

垂直合并与水平合并的结构完全对称：`AddNewVMerge()` 代替 `AddNewHMerge()`，restart 与 continue 的含义相同。

方向上有一个差别：垂直合并按列遍历，取的是 `table.GetRow(i).GetCell(col)`。行索引变化，列索引固定。

实践中最容易出错的是表头合并。一个"分组表头"通常是：第一行跨三列合并成一个组名，第二行是三个子列名。实现顺序是先做水平合并（第一行），再做垂直合并（第一列跨两行），两个方向交叉的地方不能重复处理。示例 12.5.2 就是这个场景。

垂直合并的另一个用途是序号列。表格里想给某个分类只显示一次名称、下面几行留空，可以不用合并，直接把后续单元格文字设为空——视觉效果相近，结构更简单，导出数据时也不会因为合并单元格读到空字符串而困惑。

选择合并还是留空，标准是看是否需要边框。合并后中间的横线消失，留空则横线还在。报表里"分类名跨多行"通常希望横线消失，那就合并；"每行都有独立记录只是名称重复"通常希望横线保留，那就留空。

```csharp
/// <summary>
/// 垂直合并单元格
/// </summary>
public static void MergeCellsVertically(XWPFTable table, int col, int fromRow, int toRow)
{
    for (int i = fromRow; i <= toRow; i++)
    {
        XWPFTableRow row = table.GetRow(i);
        XWPFTableCell cell = row.GetCell(col);
        var ctTc = cell.GetCTTc();
        var tcPr = ctTc.AddNewTcPr();
        
        if (i == fromRow)
        {
            // 第一个单元格设置为合并起始
            tcPr.AddNewVMerge().val = ST_Merge.restart;
        }
        else
        {
            // 后续单元格设置为继续合并
            tcPr.AddNewVMerge().val = ST_Merge.@continue;
        }
    }
}
```

### 12.3.3 合并区域

`MergeCells` 先逐行做水平合并，再逐列做垂直合并，合成一个矩形区域。

执行顺序不能颠倒。如果先垂直合并再水平合并，水平合并时取到的单元格是"已经垂直合并过的"，隐式属性叠加可能导致标记冲突；先水平后垂直，是示例选择并且更稳妥的顺序。

这个实现有一个已知缺陷：交叉点会被重复标记。步骤一在所有行上把 `fromCol` 到 `toCol` 标成水平合并，步骤二又在所有列上把 `fromRow` 到 `toRow` 标成垂直合并，于是区域内部的每个单元格同时带 hMerge 和 vMerge 标记。Word 对这种组合有一定容错，但严格来说只有左上角单元格应该同时是 restart。

如果生成的文档打开时提示"内容有问题"，合并区域的实现是重点排查对象。稳妥的实现在设置前先检查已有属性，避免重复添加同级节点。

另一个限制是合并区域不能含有已存在的另一种合并。比如目标区域里某行已经做过分组，再套一个大区域合并会得到混乱的显示。合并操作应当安排在内容填充之前，把结构一次性搭好，再去填数据。

```csharp
/// <summary>
/// 合并单元格区域
/// </summary>
public static void MergeCells(XWPFTable table, int fromRow, int toRow, int fromCol, int toCol)
{
    // 先水平合并
    for (int row = fromRow; row <= toRow; row++)
    {
        MergeCellsHorizontally(table, row, fromCol, toCol);
    }
    
    // 再垂直合并
    for (int col = fromCol; col <= toCol; col++)
    {
        MergeCellsVertically(table, col, fromRow, toRow);
    }
}
```

## 12.4 表格辅助类

这一节的辅助类把前面散落的操作串成四个可复用的方法：建带表头的表、填充数据、设列宽、设斑马纹。

辅助类的价值在于把"表格长什么样"与"表格里放什么数据"分开。生成报表的代码只关心数据，样式规则集中在一个类里，换配色、调列宽都只改一处。这类封装在报表项目里几乎必然会出现，早封装比晚封装省事。

逐段看这个类的设计。

**CreateTableWithHeader**：`doc.CreateTable(dataRowCount + 1, headers.Length)` 一次建出"表头加数据行"的完整结构，比先建表再逐行添加省事，也避免了行数与列数不一致。随后设边框、遍历表头单元格设背景色、居中、加粗白字。这里有个复用点：表头样式在 `SetHeaderStyle` 里也有类似实现，两处代码重复，更好的做法是抽一个 `StyleHeaderRow(row)` 方法让两处都调用它。

**FillTableData** 接收二维 `object[,]` 数组，支持任意类型，内部用 `ToString()` 转成文本。两个边界处理值得注意：行不存在时创建行，单元格不存在时补单元格。这两句让方法能同时用于"预先建好结构的表"和"动态增长的表"。限制也明显：`object[,]` 是矩形数组，每行列数必须一致，数据参差不齐时就得换成嵌套列表并调整签名。

**SetColumnWidths** 遍历所有行设置同一列的宽度。Word 里没有表格级的列宽概念，列宽本质上是单元格宽度，所以必须逐行设。这也是文档越大、改列宽越慢的原因。

**SetAlternatingRowColors** 按行号奇偶交替着色。示例用 `(i - startRow) % 2 == 0` 判断，从表头下一行开始算第一行；如果写成 `i % 2`，表头行数的奇偶会影响斑马纹的起始色，换一种表头结构就错位了。

**SetTableBorders** 是 private 的重复实现，与 12.2 节的公开方法功能相同。示例里这样写可以接受，真实项目中应当合并成一处。

```csharp
/// <summary>
/// Word表格辅助类
/// </summary>
public static class WordTableHelper
{
    /// <summary>
    /// 创建带表头的表格
    /// </summary>
    public static XWPFTable CreateTableWithHeader(XWPFDocument doc, 
        string[] headers, int dataRowCount)
    {
        XWPFTable table = doc.CreateTable(dataRowCount + 1, headers.Length);
        
        // 设置表格边框
        SetTableBorders(table);
        
        // 设置表头
        XWPFTableRow headerRow = table.GetRow(0);
        for (int i = 0; i < headers.Length; i++)
        {
            XWPFTableCell cell = headerRow.GetCell(i);
            cell.SetText(headers[i]);
            cell.SetColor("4472C4");
            cell.SetVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
            
            foreach (XWPFParagraph para in cell.Paragraphs)
            {
                para.Alignment = ParagraphAlignment.CENTER;
                foreach (XWPFRun run in para.Runs)
                {
                    run.IsBold = true;
                    run.SetColor("FFFFFF");
                }
            }
        }
        
        return table;
    }
    
    /// <summary>
    /// 填充表格数据
    /// </summary>
    public static void FillTableData(XWPFTable table, object[,] data, int startRow = 1)
    {
        int rows = data.GetLength(0);
        int cols = data.GetLength(1);
        
        for (int i = 0; i < rows; i++)
        {
            XWPFTableRow row = table.GetRow(startRow + i);
            if (row == null)
            {
                row = table.CreateRow();
            }
            
            for (int j = 0; j < cols; j++)
            {
                XWPFTableCell cell = row.GetCell(j);
                if (cell == null)
                {
                    cell = row.AddNewTableCell();
                }
                
                object value = data[i, j];
                cell.SetText(value?.ToString() ?? "");
            }
        }
    }
    
    /// <summary>
    /// 设置列宽
    /// </summary>
    public static void SetColumnWidths(XWPFTable table, int[] widths)
    {
        foreach (XWPFTableRow row in table.Rows)
        {
            for (int i = 0; i < widths.Length && i < row.GetTableCells().Count; i++)
            {
                XWPFTableCell cell = row.GetCell(i);
                cell.SetWidth(widths[i].ToString());
            }
        }
    }
    
    /// <summary>
    /// 设置交替行颜色
    /// </summary>
    public static void SetAlternatingRowColors(XWPFTable table, 
        string evenColor = "F2F2F2", string oddColor = "FFFFFF", int startRow = 1)
    {
        for (int i = startRow; i < table.Rows.Count; i++)
        {
            XWPFTableRow row = table.GetRow(i);
            string color = (i - startRow) % 2 == 0 ? evenColor : oddColor;
            
            foreach (XWPFTableCell cell in row.GetTableCells())
            {
                cell.SetColor(color);
            }
        }
    }
    
    private static void SetTableBorders(XWPFTable table)
    {
        table.SetTopBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetBottomBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetLeftBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetRightBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetInsideHBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetInsideVBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
    }
}
```

## 12.5 复杂表格示例

两个示例分别对应报表里最常见的两种结构：规整的数据表，和带分组表头的复杂表。前者的难点在样式与列宽，后者的难点在合并。

读这两段代码时，建议对照前面的辅助类看：哪些是辅助类提供的能力，哪些是示例现场实现的。示例 12.5.2 里的合并方法就与 12.3 节重复了，这是示例代码的一个问题，也提示了项目里应当把合并逻辑收进辅助类。

### 12.5.1 创建成绩单表格

这个示例完整走了一遍数据表生成流程：标题 → 空行 → 建表 → 填数据 → 设列宽 → 设斑马纹 → 保存。

标题段落用居中加 18 号加粗，符合一般文档习惯。`doc.CreateParagraph()` 单独一行做空行，这在 NPOI 里是插入空段的写法。

列宽配置 `{ 1000, 1200, 1000, 1000, 1000, 1000, 1200 }` 总和 8400 twip，约 5.8 英寸。而表格创建时没有显式设置整体宽度，此时列宽之和就决定了表格总宽。如果总和超过正文宽度，Word 会压缩列或者让表格溢出，所以配列宽时要先算一遍总宽。

数据用 `object[,]` 混装字符串与数字。`FillTableData` 内部统一 `ToString()`，所以 `265` 和 `88.3` 在文档里都是文本，不能参与 Word 里的求和公式。需要保留数字类型时，应当在填充后对特定单元格重新设置数值（`cell.Paragraphs[0].Runs[0]` 之类），或者改用专门的数值写入方式。

表格宽度与列宽的配合关系容易被忽略：列宽设置得大于页面可用宽度时，Word 不会报错，只是显示时压缩。在 A4 竖版上，正文宽度大约 8300 到 9000 twip 之间（取决于页边距），示例的 8400 正好在这个范围内。

保存路径 `"成绩表.docx"` 是相对路径，按进程当前工作目录解析。服务端程序里当前目录与预期不同是常事，路径应当从配置读，或者用 `AppContext.BaseDirectory` 拼绝对路径。

```csharp
public class ScoreTableExample
{
    public static void CreateScoreTable()
    {
        XWPFDocument doc = new XWPFDocument();
        
        // 添加标题
        XWPFParagraph titlePara = doc.CreateParagraph();
        titlePara.Alignment = ParagraphAlignment.CENTER;
        XWPFRun titleRun = titlePara.CreateRun();
        titleRun.SetText("学生成绩表");
        titleRun.IsBold = true;
        titleRun.FontSize = 18;
        
        doc.CreateParagraph();  // 空行
        
        // 创建表格
        string[] headers = { "学号", "姓名", "语文", "数学", "英语", "总分", "平均分" };
        XWPFTable table = WordTableHelper.CreateTableWithHeader(doc, headers, 5);
        
        // 填充数据
        object[,] data = {
            { "001", "张三", 85, 92, 88, 265, 88.3 },
            { "002", "李四", 78, 88, 92, 258, 86.0 },
            { "003", "王五", 92, 75, 85, 252, 84.0 },
            { "004", "赵六", 88, 95, 90, 273, 91.0 },
            { "005", "钱七", 75, 82, 78, 235, 78.3 }
        };
        
        WordTableHelper.FillTableData(table, data);
        
        // 设置列宽
        int[] widths = { 1000, 1200, 1000, 1000, 1000, 1000, 1200 };
        WordTableHelper.SetColumnWidths(table, widths);
        
        // 设置交替行颜色
        WordTableHelper.SetAlternatingRowColors(table);
        
        // 保存
        using (FileStream fs = new FileStream("成绩表.docx", FileMode.Create))
        {
            doc.Write(fs);
        }
        
        Console.WriteLine("成绩表创建成功！");
    }
}
```

### 12.5.2 创建复杂表头表格

这个示例演示分组表头：第一行"季度销售额"跨三列，第二行是 Q1、Q2、Q3；前两列（姓名、部门）跨两行。

合并顺序是：先水平合并第一行的第 3 到第 5 列，再垂直合并第 1、2 列跨前两行。合并之后才填充数据，顺序正确——合并会改变单元格的显示结构，先填数据再合并，被覆盖的内容会丢失。

观察代码里几个具体细节：

- 第一行第 3 列填了"季度销售额"再合并，其余两格留空。合并后只显示起始格内容，所以只需设这一格；
- 第二行前两格设成空字符串而不是不设。设空字符串是明确写入一个空段落，与完全不设置的效果在渲染上相近，但结构上更可控；
- 合并后第一列、第二列的第 1 行与第 2 行是同一块，因此第一行设的"姓名"会在两行范围内居中显示，第二行的空字符串不显示。

数据填充从第 3 行开始（`i + 2`），跳过两行表头。这里用 `table.GetRow(i + 2)` 直接取行，没有判空——建表时指定了 6 行，数据只有 4 行，正好够用。如果数据行数超过表行数，越界会抛异常，示例在这个点上没有做防御。

表头样式循环作用于前两行全部单元格。被合并的单元格也在遍历范围内，给它们设置背景色不会影响显示（显示取自起始格），但如果起始格漏设就会露出白块。所以"遍历整行设置"比"只设起始格"更稳。

示例末尾把两个合并方法私有复制了一份，与 12.3 节的公开版本重复。实践中应当直接调用公共实现，否则两处逻辑一旦不同步，就会出现"同一份文档里合并效果不一致"的怪问题。

```csharp
public class ComplexTableExample
{
    public static void CreateComplexTable()
    {
        XWPFDocument doc = new XWPFDocument();
        
        // 创建6行5列的表格
        XWPFTable table = doc.CreateTable(6, 5);
        
        // 设置边框
        table.SetTopBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetBottomBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetLeftBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetRightBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetInsideHBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.SetInsideVBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        
        // 第一行：合并第3-5列
        table.GetRow(0).GetCell(0).SetText("姓名");
        table.GetRow(0).GetCell(1).SetText("部门");
        table.GetRow(0).GetCell(2).SetText("季度销售额");
        MergeCellsHorizontally(table, 0, 2, 4);
        
        // 第二行：季度细分
        table.GetRow(1).GetCell(0).SetText("");
        table.GetRow(1).GetCell(1).SetText("");
        table.GetRow(1).GetCell(2).SetText("Q1");
        table.GetRow(1).GetCell(3).SetText("Q2");
        table.GetRow(1).GetCell(4).SetText("Q3");
        
        // 合并第1、2行的第1列
        MergeCellsVertically(table, 0, 0, 1);
        // 合并第1、2行的第2列
        MergeCellsVertically(table, 1, 0, 1);
        
        // 填充数据
        string[,] data = {
            { "张三", "销售部", "100", "120", "150" },
            { "李四", "销售部", "90", "110", "130" },
            { "王五", "市场部", "80", "95", "120" },
            { "赵六", "市场部", "85", "100", "115" }
        };
        
        for (int i = 0; i < 4; i++)
        {
            XWPFTableRow row = table.GetRow(i + 2);
            for (int j = 0; j < 5; j++)
            {
                row.GetCell(j).SetText(data[i, j]);
            }
        }
        
        // 设置表头样式
        for (int i = 0; i < 2; i++)
        {
            foreach (XWPFTableCell cell in table.GetRow(i).GetTableCells())
            {
                cell.SetColor("4472C4");
                cell.SetVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
                foreach (XWPFParagraph para in cell.Paragraphs)
                {
                    para.Alignment = ParagraphAlignment.CENTER;
                    foreach (XWPFRun run in para.Runs)
                    {
                        run.IsBold = true;
                        run.SetColor("FFFFFF");
                    }
                }
            }
        }
        
        // 保存
        using (FileStream fs = new FileStream("复杂表格.docx", FileMode.Create))
        {
            doc.Write(fs);
        }
        
        Console.WriteLine("复杂表格创建成功！");
    }
    
    private static void MergeCellsHorizontally(XWPFTable table, int row, int fromCol, int toCol)
    {
        XWPFTableRow tableRow = table.GetRow(row);
        for (int i = fromCol; i <= toCol; i++)
        {
            XWPFTableCell cell = tableRow.GetCell(i);
            var ctTc = cell.GetCTTc();
            var tcPr = ctTc.AddNewTcPr();
            tcPr.AddNewHMerge().val = i == fromCol ? ST_Merge.restart : ST_Merge.@continue;
        }
    }
    
    private static void MergeCellsVertically(XWPFTable table, int col, int fromRow, int toRow)
    {
        for (int i = fromRow; i <= toRow; i++)
        {
            XWPFTableCell cell = table.GetRow(i).GetCell(col);
            var ctTc = cell.GetCTTc();
            var tcPr = ctTc.AddNewTcPr();
            tcPr.AddNewVMerge().val = i == fromRow ? ST_Merge.restart : ST_Merge.@continue;
        }
    }
}
```

## 12.6 本章小结

本章详细介绍了NPOI中Word表格的操作。通过本章学习，你应该掌握：

- 表格的创建和基本操作
- 行和单元格的操作
- 表格边框和样式设置
- 单元格背景色和对齐方式
- 水平和垂直合并单元格
- 表格辅助类的封装
- 复杂表格的创建

表格是Word文档中展示数据的重要方式，掌握表格操作可以创建专业的报表和文档。

本章的能力可以按难度分三级：建表和单元格读写是基础，样式与列宽是排版，合并单元格是结构。三级里最容易出问题的是合并，因为它改的是 OOXML 属性而不是可视对象，出错时不报错、只表现为显示异常。

两条收尾建议。第一，把表格辅助类当作资产维护，不要每次生成报表都重写一遍样式代码。第二，生成后一定用 Word 打开检查一遍，重点看合并区域、跨页表头和列宽是否溢出——这三处是自动化测试覆盖不到的地方。

---

> **下一章预告**：第十三章将介绍Word图片与多媒体操作，包括图片的插入、调整和定位。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/csharp/npoi/第11章-Word段落与文本样式/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第13章-Word图片与多媒体/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

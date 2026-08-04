---
layout: default
title: 第十二章：Word表格操作
---

# 第十二章：Word表格操作

## 12.1 表格基础

### 12.1.1 创建表格

```csharp
using NPOI.XWPF.UserModel;

XWPFDocument doc = new XWPFDocument();

// 创建表格（指定行数和列数）
XWPFTable table = doc.CreateTable(5, 4);  // 5行4列

// 设置表格宽度（整体宽度，单位：twip，1英寸=1440twip）
table.Width = 9000;  // 约6.25英寸
```

### 12.1.2 获取和遍历表格

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

### 12.2.1 表格边框

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

### 12.3.1 水平合并

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

### 12.5.1 创建成绩单表格

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

---

> **下一章预告**：第十三章将介绍Word图片与多媒体操作，包括图片的插入、调整和定位。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/csharp/npoi/第12章-Word表格操作/第11章-Word段落与文本样式/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/第12章-Word表格操作/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第12章-Word表格操作/第13章-Word图片与多媒体/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

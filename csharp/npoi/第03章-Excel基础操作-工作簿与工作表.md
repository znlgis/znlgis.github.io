---
layout: default
title: 第三章：Excel基础操作-工作簿与工作表
---

# 第三章：Excel基础操作-工作簿与工作表

## 3.1 工作簿（Workbook）操作

### 3.1.1 创建新工作簿

```csharp
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;
using NPOI.HSSF.UserModel;

// 创建 .xlsx 格式工作簿（Excel 2007+）
IWorkbook xlsxWorkbook = new XSSFWorkbook();

// 创建 .xls 格式工作簿（Excel 97-2003）
IWorkbook xlsWorkbook = new HSSFWorkbook();
```

### 3.1.2 打开现有工作簿

```csharp
// 方式一：通过文件流打开 .xlsx 文件
using (FileStream fs = new FileStream("example.xlsx", FileMode.Open, FileAccess.Read))
{
    IWorkbook workbook = new XSSFWorkbook(fs);
    // 进行操作...
}

// 方式二：通过文件流打开 .xls 文件
using (FileStream fs = new FileStream("example.xls", FileMode.Open, FileAccess.Read))
{
    IWorkbook workbook = new HSSFWorkbook(fs);
    // 进行操作...
}

// 方式三：自动识别格式
public static IWorkbook OpenWorkbook(string filePath)
{
    string extension = Path.GetExtension(filePath).ToLower();
    using FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read);
    
    return extension switch
    {
        ".xlsx" => new XSSFWorkbook(fs),
        ".xls" => new HSSFWorkbook(fs),
        _ => throw new NotSupportedException($"不支持的文件格式：{extension}")
    };
}
```

### 3.1.3 保存工作簿

```csharp
IWorkbook workbook = new XSSFWorkbook();
// ... 进行操作 ...

// 方式一：保存到新文件
using (FileStream fs = new FileStream("output.xlsx", FileMode.Create))
{
    workbook.Write(fs);
}

// 方式二：保存到内存流（适用于Web下载）
using (MemoryStream ms = new MemoryStream())
{
    workbook.Write(ms);
    byte[] bytes = ms.ToArray();
    // 可以用于HTTP响应返回
}

// 方式三：覆盖保存（注意：需要先读取完整内容）
public void SaveAndOverwrite(string filePath, Action<IWorkbook> operation)
{
    IWorkbook workbook;
    
    // 先读取
    using (FileStream fsRead = new FileStream(filePath, FileMode.Open, FileAccess.Read))
    {
        workbook = new XSSFWorkbook(fsRead);
    }
    
    // 执行操作
    operation(workbook);
    
    // 再写入
    using (FileStream fsWrite = new FileStream(filePath, FileMode.Create))
    {
        workbook.Write(fsWrite);
    }
}
```

### 3.1.4 工作簿属性设置

```csharp
// 对于 XSSFWorkbook，可以设置文档属性
XSSFWorkbook workbook = new XSSFWorkbook();

// 获取核心属性
var coreProperties = workbook.GetProperties().CoreProperties;
coreProperties.Title = "销售报表";
coreProperties.Creator = "张三";
coreProperties.Subject = "2024年度销售数据";
coreProperties.Description = "这是一份年度销售数据汇总报表";
coreProperties.Keywords = "销售,报表,2024";
coreProperties.Category = "财务报表";

// 设置自定义属性
var customProperties = workbook.GetProperties().CustomProperties;
customProperties.AddProperty("部门", "销售部");
customProperties.AddProperty("审核人", "李四");
```

### 3.1.5 工作簿格式转换

```csharp
/// <summary>
/// 将 .xls 转换为 .xlsx 格式
/// </summary>
public static void ConvertXlsToXlsx(string xlsPath, string xlsxPath)
{
    // 读取 .xls 文件
    using FileStream fsRead = new FileStream(xlsPath, FileMode.Open, FileAccess.Read);
    HSSFWorkbook xlsWorkbook = new HSSFWorkbook(fsRead);
    
    // 创建新的 .xlsx 工作簿
    XSSFWorkbook xlsxWorkbook = new XSSFWorkbook();
    
    // 复制每个工作表
    for (int i = 0; i < xlsWorkbook.NumberOfSheets; i++)
    {
        ISheet sourceSheet = xlsWorkbook.GetSheetAt(i);
        ISheet targetSheet = xlsxWorkbook.CreateSheet(sourceSheet.SheetName);
        
        CopySheet(sourceSheet, targetSheet, xlsxWorkbook);
    }
    
    // 保存
    using FileStream fsWrite = new FileStream(xlsxPath, FileMode.Create);
    xlsxWorkbook.Write(fsWrite);
}

/// <summary>
/// 复制工作表内容
/// </summary>
private static void CopySheet(ISheet source, ISheet target, IWorkbook targetWorkbook)
{
    for (int i = source.FirstRowNum; i <= source.LastRowNum; i++)
    {
        IRow sourceRow = source.GetRow(i);
        if (sourceRow == null) continue;
        
        IRow targetRow = target.CreateRow(i);
        targetRow.Height = sourceRow.Height;
        
        for (int j = sourceRow.FirstCellNum; j < sourceRow.LastCellNum; j++)
        {
            ICell sourceCell = sourceRow.GetCell(j);
            if (sourceCell == null) continue;
            
            ICell targetCell = targetRow.CreateCell(j);
            CopyCell(sourceCell, targetCell, targetWorkbook);
        }
    }
    
    // 复制列宽
    for (int i = 0; i < source.GetRow(source.FirstRowNum)?.LastCellNum; i++)
    {
        target.SetColumnWidth(i, source.GetColumnWidth(i));
    }
}

/// <summary>
/// 复制单元格
/// </summary>
private static void CopyCell(ICell source, ICell target, IWorkbook targetWorkbook)
{
    switch (source.CellType)
    {
        case CellType.String:
            target.SetCellValue(source.StringCellValue);
            break;
        case CellType.Numeric:
            target.SetCellValue(source.NumericCellValue);
            break;
        case CellType.Boolean:
            target.SetCellValue(source.BooleanCellValue);
            break;
        case CellType.Formula:
            target.SetCellFormula(source.CellFormula);
            break;
    }
}
```

## 3.2 工作表（Sheet）操作

### 3.2.1 创建工作表

```csharp
IWorkbook workbook = new XSSFWorkbook();

// 创建默认名称的工作表
ISheet sheet1 = workbook.CreateSheet();  // 默认名称 "Sheet0"

// 创建指定名称的工作表
ISheet sheet2 = workbook.CreateSheet("销售数据");
ISheet sheet3 = workbook.CreateSheet("库存数据");
ISheet sheet4 = workbook.CreateSheet("员工信息");

// 注意：工作表名称限制
// - 最大31个字符
// - 不能包含 : \ / ? * [ ] 等特殊字符
// - 不能以单引号开头或结尾
// - 不能为空
```

### 3.2.2 获取工作表

```csharp
// 通过索引获取
ISheet sheet = workbook.GetSheetAt(0);

// 通过名称获取
ISheet sheet2 = workbook.GetSheet("销售数据");

// 获取活动工作表（当前选中的工作表）
ISheet activeSheet = workbook.GetSheetAt(workbook.ActiveSheetIndex);

// 获取工作表数量
int sheetCount = workbook.NumberOfSheets;

// 获取工作表索引
int index = workbook.GetSheetIndex("销售数据");

// 遍历所有工作表
for (int i = 0; i < workbook.NumberOfSheets; i++)
{
    ISheet s = workbook.GetSheetAt(i);
    Console.WriteLine($"工作表{i}: {s.SheetName}");
}
```

### 3.2.3 工作表重命名与排序

```csharp
// 重命名工作表
workbook.SetSheetName(0, "新名称");

// 移动工作表位置（设置工作表顺序）
workbook.SetSheetOrder("销售数据", 0);  // 移到第一位

// 设置活动工作表
workbook.SetActiveSheet(1);

// 选中某个工作表
ISheet sheet = workbook.GetSheetAt(0);
sheet.IsSelected = true;
```

### 3.2.4 删除工作表

```csharp
// 通过索引删除
workbook.RemoveSheetAt(0);

// 通过名称删除（需要先获取索引）
int indexToRemove = workbook.GetSheetIndex("临时数据");
if (indexToRemove >= 0)
{
    workbook.RemoveSheetAt(indexToRemove);
}

// 安全删除方法
public static void SafeRemoveSheet(IWorkbook workbook, string sheetName)
{
    int index = workbook.GetSheetIndex(sheetName);
    if (index >= 0 && workbook.NumberOfSheets > 1)  // 至少保留一个工作表
    {
        workbook.RemoveSheetAt(index);
    }
}
```

### 3.2.5 复制工作表

```csharp
// 克隆工作表（在同一工作簿内）
ISheet sourceSheet = workbook.GetSheetAt(0);
ISheet clonedSheet = workbook.CloneSheet(0);
workbook.SetSheetName(workbook.GetSheetIndex(clonedSheet), "复制的工作表");

// 跨工作簿复制工作表
public static void CopySheetToAnotherWorkbook(
    IWorkbook sourceWorkbook, int sourceSheetIndex,
    IWorkbook targetWorkbook, string targetSheetName)
{
    ISheet sourceSheet = sourceWorkbook.GetSheetAt(sourceSheetIndex);
    ISheet targetSheet = targetWorkbook.CreateSheet(targetSheetName);
    
    // 复制行和单元格
    for (int i = sourceSheet.FirstRowNum; i <= sourceSheet.LastRowNum; i++)
    {
        IRow sourceRow = sourceSheet.GetRow(i);
        if (sourceRow == null) continue;
        
        IRow targetRow = targetSheet.CreateRow(i);
        
        for (int j = sourceRow.FirstCellNum; j < sourceRow.LastCellNum; j++)
        {
            ICell sourceCell = sourceRow.GetCell(j);
            if (sourceCell == null) continue;
            
            ICell targetCell = targetRow.CreateCell(j);
            CopyCellValue(sourceCell, targetCell);
        }
    }
}

private static void CopyCellValue(ICell source, ICell target)
{
    switch (source.CellType)
    {
        case CellType.Blank:
            target.SetCellType(CellType.Blank);
            break;
        case CellType.Boolean:
            target.SetCellValue(source.BooleanCellValue);
            break;
        case CellType.Numeric:
            target.SetCellValue(source.NumericCellValue);
            break;
        case CellType.String:
            target.SetCellValue(source.StringCellValue);
            break;
        case CellType.Formula:
            target.SetCellFormula(source.CellFormula);
            break;
        case CellType.Error:
            target.SetCellErrorValue(source.ErrorCellValue);
            break;
    }
}
```

### 3.2.6 工作表隐藏与显示

```csharp
// 隐藏工作表
workbook.SetSheetHidden(1, SheetState.Hidden);

// 深度隐藏（用户无法通过Excel界面取消隐藏）
workbook.SetSheetHidden(1, SheetState.VeryHidden);

// 显示工作表
workbook.SetSheetHidden(1, SheetState.Visible);

// 检查工作表是否隐藏
bool isHidden = workbook.IsSheetHidden(1);
bool isVeryHidden = workbook.IsSheetVeryHidden(1);
```

## 3.3 行（Row）操作

### 3.3.1 创建和获取行

```csharp
ISheet sheet = workbook.CreateSheet("数据");

// 创建行（索引从0开始）
IRow row0 = sheet.CreateRow(0);  // 第1行
IRow row1 = sheet.CreateRow(1);  // 第2行

// 获取已存在的行
IRow existingRow = sheet.GetRow(0);  // 如果不存在返回null

// 获取或创建行
IRow row = sheet.GetRow(5) ?? sheet.CreateRow(5);

// 批量创建行
for (int i = 0; i < 100; i++)
{
    IRow newRow = sheet.CreateRow(i);
}
```

### 3.3.2 行属性设置

```csharp
IRow row = sheet.CreateRow(0);

// 设置行高（以点为单位，1点 = 1/72英寸）
row.Height = 400;  // 约13.3点

// 设置行高（以点为单位）
row.HeightInPoints = 20f;

// 使用默认行高
row.Height = -1;

// 设置行样式（影响该行所有单元格的默认样式）
ICellStyle rowStyle = workbook.CreateCellStyle();
rowStyle.FillForegroundColor = IndexedColors.LightBlue.Index;
rowStyle.FillPattern = FillPattern.SolidForeground;
row.RowStyle = rowStyle;

// 隐藏行
row.ZeroHeight = true;  // 隐藏
row.ZeroHeight = false; // 显示

// 检查行是否为空
bool isEmpty = row.FirstCellNum < 0;
```

### 3.3.3 行信息查询

```csharp
// 获取工作表中的行数信息
int firstRowNum = sheet.FirstRowNum;  // 第一个非空行索引
int lastRowNum = sheet.LastRowNum;    // 最后一个非空行索引
int physicalRows = sheet.PhysicalNumberOfRows;  // 物理行数（非空行数）

// 获取行中的单元格信息
short firstCellNum = row.FirstCellNum;  // 第一个单元格索引
short lastCellNum = row.LastCellNum;    // 最后一个单元格索引+1
int physicalCells = row.PhysicalNumberOfCells;  // 物理单元格数

// 遍历行
foreach (ICell cell in row)
{
    Console.WriteLine(cell.ToString());
}
```

### 3.3.4 插入和删除行

```csharp
// 插入行（需要先移动下面的行）
public static void InsertRow(ISheet sheet, int rowIndex)
{
    // 将rowIndex及以下的行向下移动一行
    if (rowIndex <= sheet.LastRowNum)
    {
        sheet.ShiftRows(rowIndex, sheet.LastRowNum, 1);
    }
    // 创建新行
    sheet.CreateRow(rowIndex);
}

// 删除行
public static void DeleteRow(ISheet sheet, int rowIndex)
{
    IRow row = sheet.GetRow(rowIndex);
    if (row != null)
    {
        sheet.RemoveRow(row);
        // 将下面的行向上移动
        if (rowIndex < sheet.LastRowNum)
        {
            sheet.ShiftRows(rowIndex + 1, sheet.LastRowNum, -1);
        }
    }
}

// 批量删除行
public static void DeleteRows(ISheet sheet, int startRow, int count)
{
    for (int i = 0; i < count; i++)
    {
        IRow row = sheet.GetRow(startRow);
        if (row != null)
        {
            sheet.RemoveRow(row);
        }
    }
    
    // 移动剩余行
    if (startRow + count <= sheet.LastRowNum)
    {
        sheet.ShiftRows(startRow + count, sheet.LastRowNum, -count);
    }
}
```

## 3.4 列操作

### 3.4.1 列宽设置

```csharp
// 设置列宽（单位为1/256字符宽度）
sheet.SetColumnWidth(0, 20 * 256);  // 20个字符宽度

// 自动调整列宽
sheet.AutoSizeColumn(0);

// 自动调整列宽（考虑合并单元格）
sheet.AutoSizeColumn(0, true);

// 批量设置列宽
for (int i = 0; i < 10; i++)
{
    sheet.SetColumnWidth(i, 15 * 256);
}

// 设置默认列宽
sheet.DefaultColumnWidth = 15;

// 获取列宽
int width = sheet.GetColumnWidth(0);
```

### 3.4.2 列隐藏与显示

```csharp
// 隐藏列
sheet.SetColumnHidden(0, true);

// 显示列
sheet.SetColumnHidden(0, false);

// 检查列是否隐藏
bool isHidden = sheet.IsColumnHidden(0);

// 批量隐藏列
for (int i = 5; i < 10; i++)
{
    sheet.SetColumnHidden(i, true);
}
```

### 3.4.3 列样式设置

```csharp
// 设置列的默认样式
ICellStyle columnStyle = workbook.CreateCellStyle();
columnStyle.Alignment = HorizontalAlignment.Center;
sheet.SetDefaultColumnStyle(0, columnStyle);

// 设置整列格式（需要遍历所有行）
public static void SetColumnStyle(ISheet sheet, int columnIndex, ICellStyle style)
{
    for (int i = sheet.FirstRowNum; i <= sheet.LastRowNum; i++)
    {
        IRow row = sheet.GetRow(i);
        if (row == null) continue;
        
        ICell cell = row.GetCell(columnIndex);
        if (cell != null)
        {
            cell.CellStyle = style;
        }
    }
}
```

## 3.5 视图设置

### 3.5.1 冻结窗格

```csharp
// 冻结首行
sheet.CreateFreezePane(0, 1);

// 冻结首列
sheet.CreateFreezePane(1, 0);

// 冻结首行和首列
sheet.CreateFreezePane(1, 1);

// 冻结前2行和前3列
sheet.CreateFreezePane(3, 2);

// 带滚动位置的冻结
// 参数：冻结列数, 冻结行数, 右侧首列位置, 下方首行位置
sheet.CreateFreezePane(2, 3, 2, 3);
```

### 3.5.2 拆分窗格

```csharp
// 水平拆分（在2000twip处拆分）
sheet.CreateSplitPane(0, 2000, 0, 1, PanePosition.LowerLeft);

// 垂直拆分
sheet.CreateSplitPane(2000, 0, 1, 0, PanePosition.UpperRight);

// 同时水平和垂直拆分
sheet.CreateSplitPane(2000, 2000, 1, 1, PanePosition.LowerRight);
```

### 3.5.3 显示设置

```csharp
// 显示/隐藏网格线
sheet.DisplayGridlines = false;

// 显示/隐藏行列标题
sheet.DisplayRowColHeadings = false;

// 设置缩放比例（百分比）
sheet.SetZoom(150);  // 150%

// 打印设置
IPrintSetup printSetup = sheet.PrintSetup;
printSetup.Landscape = true;  // 横向打印
printSetup.FitWidth = 1;      // 适合1页宽
printSetup.FitHeight = 0;     // 高度不限
printSetup.PaperSize = (short)PaperSize.A4;

// 设置打印区域
workbook.SetPrintArea(0, 0, 10, 0, 20);  // Sheet索引, 起始列, 结束列, 起始行, 结束行

// 设置重复打印行（表头）
sheet.RepeatingRows = new CellRangeAddress(0, 0, 0, 10);  // 第1行
```

## 3.6 综合示例

### 3.6.1 创建带多个工作表的报表

```csharp
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;
using System;
using System.IO;

public class MultiSheetReportExample
{
    public static void CreateSalesReport()
    {
        IWorkbook workbook = new XSSFWorkbook();
        
        // 创建汇总表
        CreateSummarySheet(workbook);
        
        // 创建各月份明细表
        string[] months = { "一月", "二月", "三月" };
        foreach (var month in months)
        {
            CreateMonthDetailSheet(workbook, month);
        }
        
        // 设置第一个工作表为活动工作表
        workbook.SetActiveSheet(0);
        
        // 保存文件
        using (FileStream fs = new FileStream("销售报表.xlsx", FileMode.Create))
        {
            workbook.Write(fs);
        }
        
        Console.WriteLine("报表创建成功！");
    }
    
    private static void CreateSummarySheet(IWorkbook workbook)
    {
        ISheet sheet = workbook.CreateSheet("汇总");
        
        // 创建表头样式
        ICellStyle headerStyle = workbook.CreateCellStyle();
        IFont font = workbook.CreateFont();
        font.IsBold = true;
        font.FontHeightInPoints = 14;
        headerStyle.SetFont(font);
        headerStyle.Alignment = HorizontalAlignment.Center;
        headerStyle.FillForegroundColor = IndexedColors.LightBlue.Index;
        headerStyle.FillPattern = FillPattern.SolidForeground;
        
        // 创建表头
        IRow headerRow = sheet.CreateRow(0);
        string[] headers = { "月份", "销售额", "成本", "利润", "增长率" };
        for (int i = 0; i < headers.Length; i++)
        {
            ICell cell = headerRow.CreateCell(i);
            cell.SetCellValue(headers[i]);
            cell.CellStyle = headerStyle;
        }
        
        // 创建数据
        object[][] data = {
            new object[] { "一月", 100000, 60000, 40000, "10%" },
            new object[] { "二月", 120000, 70000, 50000, "25%" },
            new object[] { "三月", 150000, 85000, 65000, "30%" }
        };
        
        for (int i = 0; i < data.Length; i++)
        {
            IRow row = sheet.CreateRow(i + 1);
            for (int j = 0; j < data[i].Length; j++)
            {
                ICell cell = row.CreateCell(j);
                if (data[i][j] is int num)
                    cell.SetCellValue(num);
                else
                    cell.SetCellValue(data[i][j].ToString());
            }
        }
        
        // 自动调整列宽
        for (int i = 0; i < headers.Length; i++)
        {
            sheet.AutoSizeColumn(i);
        }
        
        // 冻结首行
        sheet.CreateFreezePane(0, 1);
    }
    
    private static void CreateMonthDetailSheet(IWorkbook workbook, string month)
    {
        ISheet sheet = workbook.CreateSheet($"{month}明细");
        
        // 创建表头
        IRow headerRow = sheet.CreateRow(0);
        headerRow.CreateCell(0).SetCellValue("日期");
        headerRow.CreateCell(1).SetCellValue("产品");
        headerRow.CreateCell(2).SetCellValue("数量");
        headerRow.CreateCell(3).SetCellValue("金额");
        
        // 创建示例数据
        Random rand = new Random();
        for (int i = 1; i <= 10; i++)
        {
            IRow row = sheet.CreateRow(i);
            row.CreateCell(0).SetCellValue($"{month}{i}日");
            row.CreateCell(1).SetCellValue($"产品{rand.Next(1, 5)}");
            row.CreateCell(2).SetCellValue(rand.Next(1, 100));
            row.CreateCell(3).SetCellValue(rand.Next(100, 10000));
        }
        
        // 设置列宽
        sheet.SetColumnWidth(0, 15 * 256);
        sheet.SetColumnWidth(1, 15 * 256);
        sheet.SetColumnWidth(2, 10 * 256);
        sheet.SetColumnWidth(3, 15 * 256);
    }
}
```

### 3.6.2 工作表管理器类

```csharp
using NPOI.SS.UserModel;
using System;
using System.Collections.Generic;
using System.Linq;

/// <summary>
/// 工作表管理器
/// </summary>
public class SheetManager
{
    private readonly IWorkbook _workbook;
    
    public SheetManager(IWorkbook workbook)
    {
        _workbook = workbook ?? throw new ArgumentNullException(nameof(workbook));
    }
    
    /// <summary>
    /// 获取所有工作表名称
    /// </summary>
    public List<string> GetAllSheetNames()
    {
        var names = new List<string>();
        for (int i = 0; i < _workbook.NumberOfSheets; i++)
        {
            names.Add(_workbook.GetSheetName(i));
        }
        return names;
    }
    
    /// <summary>
    /// 检查工作表是否存在
    /// </summary>
    public bool SheetExists(string sheetName)
    {
        return _workbook.GetSheetIndex(sheetName) >= 0;
    }
    
    /// <summary>
    /// 获取或创建工作表
    /// </summary>
    public ISheet GetOrCreateSheet(string sheetName)
    {
        ISheet sheet = _workbook.GetSheet(sheetName);
        return sheet ?? _workbook.CreateSheet(sheetName);
    }
    
    /// <summary>
    /// 安全重命名工作表
    /// </summary>
    public bool RenameSheet(string oldName, string newName)
    {
        int index = _workbook.GetSheetIndex(oldName);
        if (index < 0) return false;
        
        if (SheetExists(newName)) return false;
        
        _workbook.SetSheetName(index, newName);
        return true;
    }
    
    /// <summary>
    /// 复制工作表
    /// </summary>
    public ISheet CopySheet(string sourceName, string targetName)
    {
        int sourceIndex = _workbook.GetSheetIndex(sourceName);
        if (sourceIndex < 0)
            throw new ArgumentException($"工作表 '{sourceName}' 不存在");
        
        if (SheetExists(targetName))
            throw new ArgumentException($"工作表 '{targetName}' 已存在");
        
        ISheet cloned = _workbook.CloneSheet(sourceIndex);
        _workbook.SetSheetName(_workbook.GetSheetIndex(cloned), targetName);
        return cloned;
    }
    
    /// <summary>
    /// 删除所有空工作表
    /// </summary>
    public int RemoveEmptySheets()
    {
        int removedCount = 0;
        var emptyIndexes = new List<int>();
        
        for (int i = 0; i < _workbook.NumberOfSheets; i++)
        {
            ISheet sheet = _workbook.GetSheetAt(i);
            if (IsSheetEmpty(sheet))
            {
                emptyIndexes.Add(i);
            }
        }
        
        // 从后向前删除，避免索引变化问题
        for (int i = emptyIndexes.Count - 1; i >= 0; i--)
        {
            if (_workbook.NumberOfSheets > 1)  // 保留至少一个工作表
            {
                _workbook.RemoveSheetAt(emptyIndexes[i]);
                removedCount++;
            }
        }
        
        return removedCount;
    }
    
    /// <summary>
    /// 检查工作表是否为空
    /// </summary>
    private bool IsSheetEmpty(ISheet sheet)
    {
        return sheet.PhysicalNumberOfRows == 0;
    }
    
    /// <summary>
    /// 获取工作表统计信息
    /// </summary>
    public Dictionary<string, SheetStatistics> GetStatistics()
    {
        var stats = new Dictionary<string, SheetStatistics>();
        
        for (int i = 0; i < _workbook.NumberOfSheets; i++)
        {
            ISheet sheet = _workbook.GetSheetAt(i);
            stats[sheet.SheetName] = new SheetStatistics
            {
                RowCount = sheet.LastRowNum - sheet.FirstRowNum + 1,
                PhysicalRowCount = sheet.PhysicalNumberOfRows,
                FirstRowIndex = sheet.FirstRowNum,
                LastRowIndex = sheet.LastRowNum,
                IsHidden = _workbook.IsSheetHidden(i) || _workbook.IsSheetVeryHidden(i)
            };
        }
        
        return stats;
    }
}

public class SheetStatistics
{
    public int RowCount { get; set; }
    public int PhysicalRowCount { get; set; }
    public int FirstRowIndex { get; set; }
    public int LastRowIndex { get; set; }
    public bool IsHidden { get; set; }
}
```

## 3.7 本章小结

本章详细介绍了NPOI中工作簿和工作表的基础操作。通过本章学习，你应该掌握：

- 工作簿的创建、打开、保存和格式转换
- 工作表的创建、获取、重命名、复制和删除
- 行的创建、属性设置、插入和删除
- 列的宽度设置、隐藏和样式设置
- 视图设置如冻结窗格、拆分窗格等
- 打印设置的基本配置

这些基础操作是后续进行复杂Excel处理的基础。在下一章中，我们将学习单元格的详细操作和数据类型处理。

---

> **下一章预告**：第四章将介绍Excel单元格操作与数据类型，包括各种数据类型的读写、单元格引用和单元格区域操作。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第02章-环境搭建与项目配置" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第04章-Excel单元格操作与数据类型" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

---
layout: default
title: 第四章：Excel单元格操作与数据类型
---

# 第四章：Excel单元格操作与数据类型

## 4.1 单元格基础操作

### 4.1.1 创建和获取单元格

```csharp
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;

IWorkbook workbook = new XSSFWorkbook();
ISheet sheet = workbook.CreateSheet("数据");
IRow row = sheet.CreateRow(0);

// 创建单元格（索引从0开始）
ICell cell0 = row.CreateCell(0);  // A列
ICell cell1 = row.CreateCell(1);  // B列
ICell cell2 = row.CreateCell(2);  // C列

// 获取已存在的单元格
ICell existingCell = row.GetCell(0);  // 如果不存在返回null

// 获取单元格，不存在时返回空白单元格
ICell cell = row.GetCell(0, MissingCellPolicy.CREATE_NULL_AS_BLANK);

// 获取或创建单元格
ICell cellOrNew = row.GetCell(5) ?? row.CreateCell(5);
```

### 4.1.2 MissingCellPolicy策略

```csharp
// 获取单元格时的策略
row.GetCell(0, MissingCellPolicy.RETURN_NULL_AND_BLANK);   // 默认，返回null或空白单元格
row.GetCell(0, MissingCellPolicy.RETURN_BLANK_AS_NULL);    // 空白单元格也返回null
row.GetCell(0, MissingCellPolicy.CREATE_NULL_AS_BLANK);    // 不存在时创建空白单元格
```

### 4.1.3 单元格地址与引用

```csharp
using NPOI.SS.Util;

// 单元格地址对象
CellAddress address = new CellAddress(0, 0);  // A1
Console.WriteLine(address.FormatAsString());  // 输出: A1

// 行列索引转换为单元格地址
string cellRef = CellReference.ConvertNumToColString(0);  // 输出: A
CellReference reference = new CellReference(0, 0);  // A1
Console.WriteLine(reference.FormatAsString());

// 从字符串解析单元格地址
CellReference parsed = new CellReference("B5");
int row = parsed.Row;        // 4 (0-based)
int col = parsed.Col;        // 1 (0-based)
string colStr = parsed.CellRefParts[1];  // B

// 获取单元格的地址信息
ICell cell = row.GetCell(0);
int rowIndex = cell.RowIndex;
int colIndex = cell.ColumnIndex;
CellAddress cellAddress = cell.Address;
```

## 4.2 数据类型处理

### 4.2.1 单元格类型枚举

```csharp
// NPOI支持的单元格类型
public enum CellType
{
    Unknown = -1,   // 未知类型
    Numeric = 0,    // 数值（包括日期）
    String = 1,     // 字符串
    Formula = 2,    // 公式
    Blank = 3,      // 空白
    Boolean = 4,    // 布尔值
    Error = 5       // 错误
}
```

### 4.2.2 字符串类型

```csharp
// 设置字符串值
cell.SetCellValue("Hello World");

// 读取字符串值
string value = cell.StringCellValue;

// 设置富文本字符串
IWorkbook workbook = new XSSFWorkbook();
ICreationHelper helper = workbook.GetCreationHelper();
IRichTextString richText = helper.CreateRichTextString("加粗和普通文本");

IFont boldFont = workbook.CreateFont();
boldFont.IsBold = true;
richText.ApplyFont(0, 2, boldFont);  // 对"加粗"应用粗体

cell.SetCellValue(richText);

// 读取富文本
IRichTextString rtValue = cell.RichStringCellValue;
string plainText = rtValue.String;
```

### 4.2.3 数值类型

```csharp
// 设置整数
cell.SetCellValue(100);

// 设置小数
cell.SetCellValue(3.14159);

// 设置长整数
cell.SetCellValue(9999999999L);

// 设置货币值（需要配合数字格式）
cell.SetCellValue(1234.56);
ICellStyle currencyStyle = workbook.CreateCellStyle();
IDataFormat format = workbook.CreateDataFormat();
currencyStyle.DataFormat = format.GetFormat("¥#,##0.00");
cell.CellStyle = currencyStyle;

// 读取数值
double numValue = cell.NumericCellValue;

// 安全读取数值
public static double? GetNumericValue(ICell cell)
{
    if (cell == null) return null;
    
    return cell.CellType switch
    {
        CellType.Numeric => cell.NumericCellValue,
        CellType.String when double.TryParse(cell.StringCellValue, out double v) => v,
        CellType.Formula when cell.CachedFormulaResultType == CellType.Numeric 
            => cell.NumericCellValue,
        _ => null
    };
}
```

### 4.2.4 日期时间类型

```csharp
// 设置日期
cell.SetCellValue(DateTime.Now);

// 设置日期格式
ICellStyle dateStyle = workbook.CreateCellStyle();
IDataFormat dateFormat = workbook.CreateDataFormat();
dateStyle.DataFormat = dateFormat.GetFormat("yyyy-MM-dd");
cell.CellStyle = dateStyle;

// 设置日期时间格式
ICellStyle dateTimeStyle = workbook.CreateCellStyle();
dateTimeStyle.DataFormat = dateFormat.GetFormat("yyyy-MM-dd HH:mm:ss");
cell.CellStyle = dateTimeStyle;

// 判断单元格是否为日期
bool isDate = DateUtil.IsCellDateFormatted(cell);

// 读取日期值
DateTime? dateValue = cell.DateCellValue;

// 安全读取日期
public static DateTime? GetDateValue(ICell cell)
{
    if (cell == null) return null;
    
    if (cell.CellType == CellType.Numeric)
    {
        if (DateUtil.IsCellDateFormatted(cell))
        {
            return cell.DateCellValue;
        }
        // 尝试将数值转换为日期
        return DateUtil.GetJavaDate(cell.NumericCellValue);
    }
    
    if (cell.CellType == CellType.String)
    {
        if (DateTime.TryParse(cell.StringCellValue, out DateTime date))
        {
            return date;
        }
    }
    
    return null;
}

// 常用日期格式
var dateFormats = new Dictionary<string, string>
{
    { "年月日", "yyyy-MM-dd" },
    { "年月日时分秒", "yyyy-MM-dd HH:mm:ss" },
    { "中文日期", "yyyy年MM月dd日" },
    { "短日期", "yyyy/M/d" },
    { "仅时间", "HH:mm:ss" },
    { "年月", "yyyy-MM" }
};
```

### 4.2.5 布尔类型

```csharp
// 设置布尔值
cell.SetCellValue(true);
cell.SetCellValue(false);

// 读取布尔值
bool boolValue = cell.BooleanCellValue;

// 安全读取布尔值
public static bool? GetBooleanValue(ICell cell)
{
    if (cell == null) return null;
    
    return cell.CellType switch
    {
        CellType.Boolean => cell.BooleanCellValue,
        CellType.String => bool.TryParse(cell.StringCellValue, out bool v) ? v : null,
        CellType.Numeric => cell.NumericCellValue != 0,
        _ => null
    };
}
```

### 4.2.6 错误类型

```csharp
// 设置错误值
cell.SetCellErrorValue(FormulaError.DIV0.Code);     // #DIV/0!
cell.SetCellErrorValue(FormulaError.NA.Code);       // #N/A
cell.SetCellErrorValue(FormulaError.NAME.Code);     // #NAME?
cell.SetCellErrorValue(FormulaError.NULL.Code);     // #NULL!
cell.SetCellErrorValue(FormulaError.NUM.Code);      // #NUM!
cell.SetCellErrorValue(FormulaError.REF.Code);      // #REF!
cell.SetCellErrorValue(FormulaError.VALUE.Code);    // #VALUE!

// 读取错误值
byte errorCode = cell.ErrorCellValue;
FormulaError error = FormulaError.ForInt(errorCode);
```

## 4.3 通用单元格值处理

### 4.3.1 获取任意类型单元格值

```csharp
/// <summary>
/// 通用单元格值读取器
/// </summary>
public static class CellValueReader
{
    /// <summary>
    /// 获取单元格的字符串表示
    /// </summary>
    public static string GetStringValue(ICell cell)
    {
        if (cell == null) return string.Empty;
        
        return cell.CellType switch
        {
            CellType.String => cell.StringCellValue ?? string.Empty,
            CellType.Numeric => DateUtil.IsCellDateFormatted(cell)
                ? cell.DateCellValue?.ToString("yyyy-MM-dd HH:mm:ss") ?? string.Empty
                : cell.NumericCellValue.ToString(),
            CellType.Boolean => cell.BooleanCellValue.ToString(),
            CellType.Formula => GetFormulaCellValue(cell),
            CellType.Error => FormulaError.ForInt(cell.ErrorCellValue).String,
            CellType.Blank => string.Empty,
            _ => string.Empty
        };
    }
    
    private static string GetFormulaCellValue(ICell cell)
    {
        try
        {
            return cell.CachedFormulaResultType switch
            {
                CellType.String => cell.StringCellValue,
                CellType.Numeric => DateUtil.IsCellDateFormatted(cell)
                    ? cell.DateCellValue?.ToString("yyyy-MM-dd HH:mm:ss") ?? ""
                    : cell.NumericCellValue.ToString(),
                CellType.Boolean => cell.BooleanCellValue.ToString(),
                CellType.Error => FormulaError.ForInt(cell.ErrorCellValue).String,
                _ => cell.CellFormula
            };
        }
        catch
        {
            return cell.CellFormula;
        }
    }
    
    /// <summary>
    /// 获取单元格值为指定类型
    /// </summary>
    public static T GetValue<T>(ICell cell, T defaultValue = default)
    {
        if (cell == null) return defaultValue;
        
        Type targetType = typeof(T);
        object value = GetRawValue(cell);
        
        if (value == null) return defaultValue;
        
        try
        {
            if (targetType == typeof(string))
            {
                return (T)(object)value.ToString();
            }
            
            if (targetType == typeof(DateTime) || targetType == typeof(DateTime?))
            {
                if (value is DateTime dt) return (T)(object)dt;
                if (value is double d && DateUtil.IsValidExcelDate(d))
                {
                    return (T)(object)DateUtil.GetJavaDate(d);
                }
                if (DateTime.TryParse(value.ToString(), out DateTime parsed))
                {
                    return (T)(object)parsed;
                }
            }
            
            return (T)Convert.ChangeType(value, 
                Nullable.GetUnderlyingType(targetType) ?? targetType);
        }
        catch
        {
            return defaultValue;
        }
    }
    
    private static object GetRawValue(ICell cell)
    {
        return cell.CellType switch
        {
            CellType.String => cell.StringCellValue,
            CellType.Numeric => cell.NumericCellValue,
            CellType.Boolean => cell.BooleanCellValue,
            CellType.Formula => GetFormulaRawValue(cell),
            _ => null
        };
    }
    
    private static object GetFormulaRawValue(ICell cell)
    {
        return cell.CachedFormulaResultType switch
        {
            CellType.String => cell.StringCellValue,
            CellType.Numeric => cell.NumericCellValue,
            CellType.Boolean => cell.BooleanCellValue,
            _ => null
        };
    }
}
```

### 4.3.2 设置任意类型单元格值

```csharp
/// <summary>
/// 通用单元格值设置器
/// </summary>
public static class CellValueWriter
{
    /// <summary>
    /// 设置单元格值（自动识别类型）
    /// </summary>
    public static void SetValue(ICell cell, object value, IWorkbook workbook = null)
    {
        if (value == null)
        {
            cell.SetCellType(CellType.Blank);
            return;
        }
        
        switch (value)
        {
            case string s:
                cell.SetCellValue(s);
                break;
                
            case int i:
                cell.SetCellValue(i);
                break;
                
            case long l:
                cell.SetCellValue(l);
                break;
                
            case float f:
                cell.SetCellValue(f);
                break;
                
            case double d:
                cell.SetCellValue(d);
                break;
                
            case decimal dec:
                cell.SetCellValue(Convert.ToDouble(dec));
                break;
                
            case DateTime dt:
                cell.SetCellValue(dt);
                if (workbook != null)
                {
                    SetDateFormat(cell, workbook, "yyyy-MM-dd");
                }
                break;
                
            case DateTimeOffset dto:
                cell.SetCellValue(dto.DateTime);
                if (workbook != null)
                {
                    SetDateFormat(cell, workbook, "yyyy-MM-dd HH:mm:ss");
                }
                break;
                
            case bool b:
                cell.SetCellValue(b);
                break;
                
            case byte[] bytes:
                // 图片数据需要特殊处理
                cell.SetCellValue($"[Binary:{bytes.Length} bytes]");
                break;
                
            default:
                cell.SetCellValue(value.ToString());
                break;
        }
    }
    
    private static void SetDateFormat(ICell cell, IWorkbook workbook, string format)
    {
        ICellStyle style = workbook.CreateCellStyle();
        IDataFormat dataFormat = workbook.CreateDataFormat();
        style.DataFormat = dataFormat.GetFormat(format);
        cell.CellStyle = style;
    }
}
```

## 4.4 单元格区域操作

### 4.4.1 单元格区域定义

```csharp
using NPOI.SS.Util;

// 创建单元格区域（A1:D10）
CellRangeAddress range = new CellRangeAddress(0, 9, 0, 3);
// 参数：起始行, 结束行, 起始列, 结束列

// 从字符串创建
CellRangeAddress range2 = CellRangeAddress.ValueOf("A1:D10");

// 获取区域信息
int firstRow = range.FirstRow;
int lastRow = range.LastRow;
int firstCol = range.FirstColumn;
int lastCol = range.LastColumn;

// 格式化为字符串
string rangeStr = range.FormatAsString();  // "A1:D10"

// 判断单元格是否在区域内
bool isInRange = range.IsInRange(5, 2);  // 行索引5, 列索引2
```

### 4.4.2 遍历单元格区域

```csharp
/// <summary>
/// 遍历单元格区域
/// </summary>
public static void IterateRange(ISheet sheet, CellRangeAddress range, 
    Action<ICell> action)
{
    for (int rowIdx = range.FirstRow; rowIdx <= range.LastRow; rowIdx++)
    {
        IRow row = sheet.GetRow(rowIdx);
        if (row == null) continue;
        
        for (int colIdx = range.FirstColumn; colIdx <= range.LastColumn; colIdx++)
        {
            ICell cell = row.GetCell(colIdx);
            if (cell != null)
            {
                action(cell);
            }
        }
    }
}

/// <summary>
/// 遍历区域并收集值
/// </summary>
public static List<List<object>> GetRangeValues(ISheet sheet, CellRangeAddress range)
{
    var result = new List<List<object>>();
    
    for (int rowIdx = range.FirstRow; rowIdx <= range.LastRow; rowIdx++)
    {
        var rowValues = new List<object>();
        IRow row = sheet.GetRow(rowIdx);
        
        for (int colIdx = range.FirstColumn; colIdx <= range.LastColumn; colIdx++)
        {
            ICell cell = row?.GetCell(colIdx);
            rowValues.Add(CellValueReader.GetStringValue(cell));
        }
        
        result.Add(rowValues);
    }
    
    return result;
}

// 使用示例
var range = CellRangeAddress.ValueOf("A1:C10");
var values = GetRangeValues(sheet, range);
```

### 4.4.3 批量设置区域值

```csharp
/// <summary>
/// 批量设置区域值
/// </summary>
public static void SetRangeValues(ISheet sheet, int startRow, int startCol, 
    object[,] values, IWorkbook workbook)
{
    int rows = values.GetLength(0);
    int cols = values.GetLength(1);
    
    for (int i = 0; i < rows; i++)
    {
        IRow row = sheet.GetRow(startRow + i) ?? sheet.CreateRow(startRow + i);
        
        for (int j = 0; j < cols; j++)
        {
            ICell cell = row.GetCell(startCol + j) ?? row.CreateCell(startCol + j);
            CellValueWriter.SetValue(cell, values[i, j], workbook);
        }
    }
}

// 使用示例
object[,] data = new object[,]
{
    { "姓名", "年龄", "部门" },
    { "张三", 28, "技术部" },
    { "李四", 32, "市场部" },
    { "王五", 25, "人事部" }
};

SetRangeValues(sheet, 0, 0, data, workbook);
```

## 4.5 特殊单元格处理

### 4.5.1 超链接

```csharp
// 创建Web超链接
ICell cell = row.CreateCell(0);
cell.SetCellValue("访问百度");

ICreationHelper helper = workbook.GetCreationHelper();
IHyperlink link = helper.CreateHyperlink(HyperlinkType.Url);
link.Address = "https://www.baidu.com";
cell.Hyperlink = link;

// 设置超链接样式
ICellStyle linkStyle = workbook.CreateCellStyle();
IFont linkFont = workbook.CreateFont();
linkFont.Color = IndexedColors.Blue.Index;
linkFont.Underline = FontUnderlineType.Single;
linkStyle.SetFont(linkFont);
cell.CellStyle = linkStyle;

// 创建文件超链接
IHyperlink fileLink = helper.CreateHyperlink(HyperlinkType.File);
fileLink.Address = "C:\\Documents\\report.pdf";
cell.Hyperlink = fileLink;

// 创建邮件超链接
IHyperlink emailLink = helper.CreateHyperlink(HyperlinkType.Email);
emailLink.Address = "mailto:example@email.com";
cell.Hyperlink = emailLink;

// 创建工作表内部链接
IHyperlink docLink = helper.CreateHyperlink(HyperlinkType.Document);
docLink.Address = "'Sheet2'!A1";  // 链接到Sheet2的A1单元格
cell.Hyperlink = docLink;
```

### 4.5.2 注释/批注

```csharp
// 创建绘图对象
IDrawing drawing = sheet.CreateDrawingPatriarch();

// 创建注释锚点
IClientAnchor anchor = drawing.CreateAnchor(0, 0, 0, 0, 2, 1, 4, 4);
// 参数：dx1, dy1, dx2, dy2, col1, row1, col2, row2

// 创建注释
IComment comment = drawing.CreateCellComment(anchor);
comment.String = new XSSFRichTextString("这是一条注释");
comment.Author = "张三";

// 将注释附加到单元格
ICell cell = row.GetCell(0) ?? row.CreateCell(0);
cell.CellComment = comment;

// 读取注释
IComment existingComment = cell.CellComment;
if (existingComment != null)
{
    string commentText = existingComment.String.String;
    string author = existingComment.Author;
}

// 删除注释
cell.RemoveCellComment();
```

### 4.5.3 数据有效性（下拉列表）

```csharp
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;

// 创建数据有效性帮助类
IDataValidationHelper validationHelper = sheet.GetDataValidationHelper();

// 创建下拉列表选项
string[] options = { "选项A", "选项B", "选项C", "选项D" };
IDataValidationConstraint constraint = validationHelper
    .CreateExplicitListConstraint(options);

// 指定应用范围（A2:A100）
CellRangeAddressList addressList = new CellRangeAddressList(1, 99, 0, 0);

// 创建数据有效性
IDataValidation validation = validationHelper
    .CreateValidation(constraint, addressList);

// 设置错误提示
validation.ShowErrorBox = true;
validation.CreateErrorBox("输入错误", "请从下拉列表中选择");

// 设置输入提示
validation.ShowPromptBox = true;
validation.CreatePromptBox("提示", "请选择一个选项");

// 应用数据有效性
sheet.AddValidationData(validation);

// 创建数值范围验证
IDataValidationConstraint numConstraint = validationHelper
    .CreateNumericConstraint(
        ValidationType.INTEGER,
        OperatorType.BETWEEN,
        "1", "100");

CellRangeAddressList numAddressList = new CellRangeAddressList(1, 99, 1, 1);
IDataValidation numValidation = validationHelper
    .CreateValidation(numConstraint, numAddressList);
numValidation.ShowErrorBox = true;
numValidation.CreateErrorBox("数值错误", "请输入1-100之间的整数");
sheet.AddValidationData(numValidation);

// 创建日期范围验证
IDataValidationConstraint dateConstraint = validationHelper
    .CreateDateConstraint(
        OperatorType.BETWEEN,
        "2024-01-01", "2024-12-31",
        "yyyy-MM-dd");

CellRangeAddressList dateAddressList = new CellRangeAddressList(1, 99, 2, 2);
IDataValidation dateValidation = validationHelper
    .CreateValidation(dateConstraint, dateAddressList);
sheet.AddValidationData(dateValidation);
```

## 4.6 单元格复制与移动

### 4.6.1 复制单元格

```csharp
/// <summary>
/// 复制单元格（包括值、样式、公式）
/// </summary>
public static void CopyCell(ICell sourceCell, ICell targetCell, 
    IWorkbook targetWorkbook, bool copyStyle = true)
{
    if (sourceCell == null) return;
    
    // 复制单元格类型和值
    switch (sourceCell.CellType)
    {
        case CellType.Blank:
            targetCell.SetCellType(CellType.Blank);
            break;
        case CellType.Boolean:
            targetCell.SetCellValue(sourceCell.BooleanCellValue);
            break;
        case CellType.Numeric:
            targetCell.SetCellValue(sourceCell.NumericCellValue);
            break;
        case CellType.String:
            targetCell.SetCellValue(sourceCell.StringCellValue);
            break;
        case CellType.Formula:
            targetCell.SetCellFormula(sourceCell.CellFormula);
            break;
        case CellType.Error:
            targetCell.SetCellErrorValue(sourceCell.ErrorCellValue);
            break;
    }
    
    // 复制样式
    if (copyStyle && sourceCell.CellStyle != null)
    {
        ICellStyle newStyle = targetWorkbook.CreateCellStyle();
        newStyle.CloneStyleFrom(sourceCell.CellStyle);
        targetCell.CellStyle = newStyle;
    }
    
    // 复制超链接
    if (sourceCell.Hyperlink != null)
    {
        ICreationHelper helper = targetWorkbook.GetCreationHelper();
        IHyperlink newLink = helper.CreateHyperlink(sourceCell.Hyperlink.Type);
        newLink.Address = sourceCell.Hyperlink.Address;
        targetCell.Hyperlink = newLink;
    }
    
    // 复制注释
    if (sourceCell.CellComment != null)
    {
        // 注释复制需要创建新的绘图对象
        // 这里简化处理，只复制文本
        ISheet targetSheet = targetCell.Sheet;
        IDrawing drawing = targetSheet.CreateDrawingPatriarch();
        IClientAnchor anchor = drawing.CreateAnchor(
            0, 0, 0, 0,
            targetCell.ColumnIndex, targetCell.RowIndex,
            targetCell.ColumnIndex + 2, targetCell.RowIndex + 2);
        IComment comment = drawing.CreateCellComment(anchor);
        comment.String = new XSSFRichTextString(sourceCell.CellComment.String.String);
        comment.Author = sourceCell.CellComment.Author;
        targetCell.CellComment = comment;
    }
}

/// <summary>
/// 复制单元格区域
/// </summary>
public static void CopyRange(ISheet sourceSheet, CellRangeAddress sourceRange,
    ISheet targetSheet, int targetStartRow, int targetStartCol,
    IWorkbook targetWorkbook)
{
    for (int rowOffset = 0; rowOffset <= sourceRange.LastRow - sourceRange.FirstRow; rowOffset++)
    {
        IRow sourceRow = sourceSheet.GetRow(sourceRange.FirstRow + rowOffset);
        if (sourceRow == null) continue;
        
        IRow targetRow = targetSheet.GetRow(targetStartRow + rowOffset) 
            ?? targetSheet.CreateRow(targetStartRow + rowOffset);
        
        for (int colOffset = 0; colOffset <= sourceRange.LastColumn - sourceRange.FirstColumn; colOffset++)
        {
            ICell sourceCell = sourceRow.GetCell(sourceRange.FirstColumn + colOffset);
            if (sourceCell == null) continue;
            
            ICell targetCell = targetRow.CreateCell(targetStartCol + colOffset);
            CopyCell(sourceCell, targetCell, targetWorkbook, true);
        }
    }
}
```

### 4.6.2 移动单元格

```csharp
/// <summary>
/// 移动单元格
/// </summary>
public static void MoveCell(ICell sourceCell, IRow targetRow, int targetColIndex,
    IWorkbook workbook)
{
    ICell targetCell = targetRow.CreateCell(targetColIndex);
    CopyCell(sourceCell, targetCell, workbook);
    
    // 清空源单元格
    sourceCell.SetCellType(CellType.Blank);
    sourceCell.CellStyle = null;
    if (sourceCell.Hyperlink != null)
    {
        sourceCell.Hyperlink = null;
    }
    if (sourceCell.CellComment != null)
    {
        sourceCell.RemoveCellComment();
    }
}

/// <summary>
/// 移动行
/// </summary>
public static void MoveRow(ISheet sheet, int sourceRowIndex, int targetRowIndex)
{
    if (sourceRowIndex == targetRowIndex) return;
    
    // 使用ShiftRows移动行
    if (targetRowIndex > sourceRowIndex)
    {
        // 向下移动
        sheet.ShiftRows(sourceRowIndex, sourceRowIndex, 
            targetRowIndex - sourceRowIndex);
    }
    else
    {
        // 向上移动
        sheet.ShiftRows(sourceRowIndex, sourceRowIndex, 
            targetRowIndex - sourceRowIndex);
    }
}
```

## 4.7 数据类型转换工具类

```csharp
/// <summary>
/// Excel数据类型转换工具
/// </summary>
public static class ExcelDataConverter
{
    /// <summary>
    /// 将DataTable转换为Excel
    /// </summary>
    public static IWorkbook DataTableToExcel(DataTable dt, bool includeHeader = true)
    {
        IWorkbook workbook = new XSSFWorkbook();
        ISheet sheet = workbook.CreateSheet(dt.TableName ?? "Sheet1");
        
        int rowIndex = 0;
        
        // 创建表头
        if (includeHeader)
        {
            IRow headerRow = sheet.CreateRow(rowIndex++);
            ICellStyle headerStyle = CreateHeaderStyle(workbook);
            
            for (int i = 0; i < dt.Columns.Count; i++)
            {
                ICell cell = headerRow.CreateCell(i);
                cell.SetCellValue(dt.Columns[i].ColumnName);
                cell.CellStyle = headerStyle;
            }
        }
        
        // 创建数据行
        foreach (DataRow dr in dt.Rows)
        {
            IRow row = sheet.CreateRow(rowIndex++);
            for (int i = 0; i < dt.Columns.Count; i++)
            {
                ICell cell = row.CreateCell(i);
                object value = dr[i];
                CellValueWriter.SetValue(cell, value == DBNull.Value ? null : value, workbook);
            }
        }
        
        // 自动调整列宽
        for (int i = 0; i < dt.Columns.Count; i++)
        {
            sheet.AutoSizeColumn(i);
        }
        
        return workbook;
    }
    
    /// <summary>
    /// 将Excel转换为DataTable
    /// </summary>
    public static DataTable ExcelToDataTable(ISheet sheet, bool hasHeader = true)
    {
        DataTable dt = new DataTable(sheet.SheetName);
        
        if (sheet.PhysicalNumberOfRows == 0) return dt;
        
        IRow firstRow = sheet.GetRow(sheet.FirstRowNum);
        int columnCount = firstRow.LastCellNum;
        
        // 创建列
        if (hasHeader)
        {
            for (int i = 0; i < columnCount; i++)
            {
                ICell cell = firstRow.GetCell(i);
                string columnName = CellValueReader.GetStringValue(cell);
                if (string.IsNullOrEmpty(columnName))
                {
                    columnName = $"Column{i}";
                }
                dt.Columns.Add(columnName);
            }
        }
        else
        {
            for (int i = 0; i < columnCount; i++)
            {
                dt.Columns.Add($"Column{i}");
            }
        }
        
        // 创建行数据
        int startRow = hasHeader ? sheet.FirstRowNum + 1 : sheet.FirstRowNum;
        for (int rowIdx = startRow; rowIdx <= sheet.LastRowNum; rowIdx++)
        {
            IRow row = sheet.GetRow(rowIdx);
            if (row == null) continue;
            
            DataRow dr = dt.NewRow();
            bool hasData = false;
            
            for (int colIdx = 0; colIdx < columnCount; colIdx++)
            {
                ICell cell = row.GetCell(colIdx);
                string value = CellValueReader.GetStringValue(cell);
                dr[colIdx] = value;
                if (!string.IsNullOrEmpty(value)) hasData = true;
            }
            
            if (hasData) dt.Rows.Add(dr);
        }
        
        return dt;
    }
    
    /// <summary>
    /// 将集合转换为Excel
    /// </summary>
    public static IWorkbook ListToExcel<T>(IEnumerable<T> list, 
        string sheetName = "Sheet1") where T : class
    {
        IWorkbook workbook = new XSSFWorkbook();
        ISheet sheet = workbook.CreateSheet(sheetName);
        
        var properties = typeof(T).GetProperties();
        
        // 创建表头
        IRow headerRow = sheet.CreateRow(0);
        ICellStyle headerStyle = CreateHeaderStyle(workbook);
        
        for (int i = 0; i < properties.Length; i++)
        {
            ICell cell = headerRow.CreateCell(i);
            // 使用DisplayName特性或属性名
            string displayName = properties[i]
                .GetCustomAttributes(typeof(System.ComponentModel.DisplayNameAttribute), false)
                .FirstOrDefault() is System.ComponentModel.DisplayNameAttribute attr
                ? attr.DisplayName
                : properties[i].Name;
            cell.SetCellValue(displayName);
            cell.CellStyle = headerStyle;
        }
        
        // 创建数据行
        int rowIndex = 1;
        foreach (var item in list)
        {
            IRow row = sheet.CreateRow(rowIndex++);
            for (int i = 0; i < properties.Length; i++)
            {
                ICell cell = row.CreateCell(i);
                object value = properties[i].GetValue(item);
                CellValueWriter.SetValue(cell, value, workbook);
            }
        }
        
        // 自动调整列宽
        for (int i = 0; i < properties.Length; i++)
        {
            sheet.AutoSizeColumn(i);
        }
        
        return workbook;
    }
    
    /// <summary>
    /// 将Excel转换为集合
    /// </summary>
    public static List<T> ExcelToList<T>(ISheet sheet, bool hasHeader = true) 
        where T : class, new()
    {
        var list = new List<T>();
        var properties = typeof(T).GetProperties();
        
        if (sheet.PhysicalNumberOfRows == 0) return list;
        
        // 建立列名到属性的映射
        var columnMap = new Dictionary<int, PropertyInfo>();
        IRow firstRow = sheet.GetRow(sheet.FirstRowNum);
        
        if (hasHeader)
        {
            for (int i = 0; i < firstRow.LastCellNum; i++)
            {
                string columnName = CellValueReader.GetStringValue(firstRow.GetCell(i));
                var prop = properties.FirstOrDefault(p => 
                    p.Name.Equals(columnName, StringComparison.OrdinalIgnoreCase) ||
                    (p.GetCustomAttributes(typeof(System.ComponentModel.DisplayNameAttribute), false)
                        .FirstOrDefault() is System.ComponentModel.DisplayNameAttribute attr &&
                        attr.DisplayName.Equals(columnName, StringComparison.OrdinalIgnoreCase)));
                
                if (prop != null)
                {
                    columnMap[i] = prop;
                }
            }
        }
        else
        {
            for (int i = 0; i < Math.Min(firstRow.LastCellNum, properties.Length); i++)
            {
                columnMap[i] = properties[i];
            }
        }
        
        // 读取数据
        int startRow = hasHeader ? sheet.FirstRowNum + 1 : sheet.FirstRowNum;
        for (int rowIdx = startRow; rowIdx <= sheet.LastRowNum; rowIdx++)
        {
            IRow row = sheet.GetRow(rowIdx);
            if (row == null) continue;
            
            T item = new T();
            bool hasData = false;
            
            foreach (var kvp in columnMap)
            {
                ICell cell = row.GetCell(kvp.Key);
                if (cell == null) continue;
                
                try
                {
                    object value = ConvertCellValue(cell, kvp.Value.PropertyType);
                    if (value != null)
                    {
                        kvp.Value.SetValue(item, value);
                        hasData = true;
                    }
                }
                catch
                {
                    // 忽略转换错误
                }
            }
            
            if (hasData) list.Add(item);
        }
        
        return list;
    }
    
    private static object ConvertCellValue(ICell cell, Type targetType)
    {
        if (cell == null || cell.CellType == CellType.Blank) return null;
        
        Type underlyingType = Nullable.GetUnderlyingType(targetType) ?? targetType;
        
        if (underlyingType == typeof(string))
        {
            return CellValueReader.GetStringValue(cell);
        }
        
        if (underlyingType == typeof(DateTime))
        {
            if (cell.CellType == CellType.Numeric && DateUtil.IsCellDateFormatted(cell))
            {
                return cell.DateCellValue;
            }
            if (DateTime.TryParse(CellValueReader.GetStringValue(cell), out DateTime dt))
            {
                return dt;
            }
            return null;
        }
        
        if (underlyingType == typeof(bool))
        {
            if (cell.CellType == CellType.Boolean) return cell.BooleanCellValue;
            string strValue = CellValueReader.GetStringValue(cell).ToLower();
            return strValue == "true" || strValue == "1" || strValue == "是";
        }
        
        // 数值类型
        double numValue = 0;
        if (cell.CellType == CellType.Numeric)
        {
            numValue = cell.NumericCellValue;
        }
        else if (!double.TryParse(CellValueReader.GetStringValue(cell), out numValue))
        {
            return null;
        }
        
        return Convert.ChangeType(numValue, underlyingType);
    }
    
    private static ICellStyle CreateHeaderStyle(IWorkbook workbook)
    {
        ICellStyle style = workbook.CreateCellStyle();
        IFont font = workbook.CreateFont();
        font.IsBold = true;
        style.SetFont(font);
        style.FillForegroundColor = IndexedColors.Grey25Percent.Index;
        style.FillPattern = FillPattern.SolidForeground;
        style.Alignment = HorizontalAlignment.Center;
        style.BorderBottom = BorderStyle.Thin;
        style.BorderTop = BorderStyle.Thin;
        style.BorderLeft = BorderStyle.Thin;
        style.BorderRight = BorderStyle.Thin;
        return style;
    }
}
```

## 4.8 本章小结

本章详细介绍了NPOI中单元格的操作和各种数据类型的处理。通过本章学习，你应该掌握：

- 单元格的创建、获取和地址引用
- 各种数据类型（字符串、数值、日期、布尔、公式、错误）的读写
- 通用单元格值处理工具的封装
- 单元格区域的操作和批量数据处理
- 特殊单元格功能（超链接、注释、数据验证）
- 单元格的复制和移动
- DataTable和集合与Excel的相互转换

这些单元格操作是Excel处理的核心，掌握后可以处理大部分Excel数据操作需求。

---

> **下一章预告**：第五章将介绍Excel样式与格式化，包括字体、边框、背景色、对齐方式和数字格式等详细设置。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/csharp/npoi/第04章-Excel单元格操作与数据类型/第03章-Excel基础操作-工作簿与工作表/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/第04章-Excel单元格操作与数据类型/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第04章-Excel单元格操作与数据类型/第05章-Excel样式与格式化/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

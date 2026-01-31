# 第六章：Excel公式与函数

## 6.1 公式基础

### 6.1.1 公式的基本概念

在Excel中，公式是以等号（=）开头的表达式，用于执行计算、处理数据或返回信息。NPOI完全支持Excel公式的读写操作。

```csharp
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;

IWorkbook workbook = new XSSFWorkbook();
ISheet sheet = workbook.CreateSheet("公式示例");

// 创建数据
IRow row1 = sheet.CreateRow(0);
row1.CreateCell(0).SetCellValue(10);
row1.CreateCell(1).SetCellValue(20);
row1.CreateCell(2).SetCellValue(30);

// 创建公式单元格
IRow row2 = sheet.CreateRow(1);
ICell formulaCell = row2.CreateCell(0);
formulaCell.SetCellFormula("SUM(A1:C1)");  // 不需要等号
```

### 6.1.2 设置和读取公式

```csharp
// 设置公式
cell.SetCellFormula("SUM(A1:A10)");

// 读取公式
if (cell.CellType == CellType.Formula)
{
    string formula = cell.CellFormula;
    Console.WriteLine($"公式: {formula}");
    
    // 获取公式的缓存结果类型
    CellType resultType = cell.CachedFormulaResultType;
    
    // 根据结果类型获取值
    switch (resultType)
    {
        case CellType.Numeric:
            double numResult = cell.NumericCellValue;
            break;
        case CellType.String:
            string strResult = cell.StringCellValue;
            break;
        case CellType.Boolean:
            bool boolResult = cell.BooleanCellValue;
            break;
        case CellType.Error:
            byte errorCode = cell.ErrorCellValue;
            break;
    }
}
```

### 6.1.3 公式求值

```csharp
// 创建公式求值器
IFormulaEvaluator evaluator = workbook.GetCreationHelper().CreateFormulaEvaluator();

// 求值单个单元格
CellValue cellValue = evaluator.Evaluate(cell);
Console.WriteLine($"计算结果: {cellValue.NumberValue}");

// 求值并更新单元格
evaluator.EvaluateFormulaCell(cell);

// 求值所有公式单元格
evaluator.EvaluateAll();

// 清除缓存（当数据改变后重新计算）
evaluator.ClearAllCachedResultValues();
```

## 6.2 单元格引用

### 6.2.1 相对引用

```csharp
// 相对引用 - 复制公式时会自动调整
cell.SetCellFormula("A1+B1");      // A1和B1会随位置变化
cell.SetCellFormula("SUM(A1:A10)"); // 范围引用
```

### 6.2.2 绝对引用

```csharp
// 绝对引用 - 使用$符号固定行或列
cell.SetCellFormula("$A$1+B1");     // A1固定，B1相对
cell.SetCellFormula("$A1+B$1");     // A列固定，1行固定
cell.SetCellFormula("$A$1:$A$10");  // 完全固定的范围
```

### 6.2.3 混合引用

```csharp
// 混合引用示例
cell.SetCellFormula("$A1");   // 列固定，行相对
cell.SetCellFormula("A$1");   // 行固定，列相对
```

### 6.2.4 跨工作表引用

```csharp
// 引用其他工作表
cell.SetCellFormula("Sheet2!A1");              // 简单引用
cell.SetCellFormula("Sheet2!A1:B10");          // 范围引用
cell.SetCellFormula("'带空格的表名'!A1");       // 带空格的表名需要单引号
cell.SetCellFormula("SUM(Sheet2!A1:A100)");    // 在函数中引用

// 跨多个工作表引用
cell.SetCellFormula("SUM(Sheet1:Sheet3!A1)");  // Sheet1到Sheet3的A1单元格之和
```

### 6.2.5 命名范围

```csharp
// 创建命名范围
IName namedRange = workbook.CreateName();
namedRange.NameName = "SalesData";
namedRange.RefersToFormula = "Sheet1!$A$1:$D$100";

// 使用命名范围
cell.SetCellFormula("SUM(SalesData)");
cell.SetCellFormula("AVERAGE(SalesData)");

// 获取命名范围
IName existingName = workbook.GetName("SalesData");
string formula = existingName.RefersToFormula;

// 获取所有命名范围
var allNames = workbook.GetAllNames();
foreach (IName name in allNames)
{
    Console.WriteLine($"{name.NameName}: {name.RefersToFormula}");
}
```

## 6.3 常用函数

### 6.3.1 数学函数

```csharp
// 求和
cell.SetCellFormula("SUM(A1:A10)");

// 平均值
cell.SetCellFormula("AVERAGE(A1:A10)");

// 最大值/最小值
cell.SetCellFormula("MAX(A1:A10)");
cell.SetCellFormula("MIN(A1:A10)");

// 计数
cell.SetCellFormula("COUNT(A1:A10)");      // 数值计数
cell.SetCellFormula("COUNTA(A1:A10)");     // 非空计数
cell.SetCellFormula("COUNTBLANK(A1:A10)"); // 空白计数

// 四舍五入
cell.SetCellFormula("ROUND(A1, 2)");       // 保留2位小数
cell.SetCellFormula("ROUNDUP(A1, 0)");     // 向上取整
cell.SetCellFormula("ROUNDDOWN(A1, 0)");   // 向下取整

// 取整
cell.SetCellFormula("INT(A1)");            // 取整数部分
cell.SetCellFormula("TRUNC(A1, 2)");       // 截断到指定小数位

// 绝对值
cell.SetCellFormula("ABS(A1)");

// 幂运算
cell.SetCellFormula("POWER(A1, 2)");       // A1的平方
cell.SetCellFormula("SQRT(A1)");           // 平方根

// 求积
cell.SetCellFormula("PRODUCT(A1:A10)");

// 条件求和
cell.SetCellFormula("SUMIF(A1:A10, \">0\")");
cell.SetCellFormula("SUMIFS(C1:C10, A1:A10, \">0\", B1:B10, \"<100\")");
```

### 6.3.2 文本函数

```csharp
// 字符串连接
cell.SetCellFormula("CONCATENATE(A1, \" \", B1)");
cell.SetCellFormula("A1&\" \"&B1");  // 使用&连接

// 截取字符串
cell.SetCellFormula("LEFT(A1, 3)");    // 左边3个字符
cell.SetCellFormula("RIGHT(A1, 3)");   // 右边3个字符
cell.SetCellFormula("MID(A1, 2, 3)");  // 从第2个字符开始取3个

// 字符串长度
cell.SetCellFormula("LEN(A1)");

// 大小写转换
cell.SetCellFormula("UPPER(A1)");     // 转大写
cell.SetCellFormula("LOWER(A1)");     // 转小写
cell.SetCellFormula("PROPER(A1)");    // 首字母大写

// 去除空格
cell.SetCellFormula("TRIM(A1)");

// 查找和替换
cell.SetCellFormula("FIND(\"abc\", A1)");           // 区分大小写
cell.SetCellFormula("SEARCH(\"abc\", A1)");         // 不区分大小写
cell.SetCellFormula("SUBSTITUTE(A1, \"old\", \"new\")");  // 替换文本
cell.SetCellFormula("REPLACE(A1, 1, 3, \"NEW\")");  // 替换指定位置

// 数值与文本转换
cell.SetCellFormula("TEXT(A1, \"0.00\")");         // 数字转文本
cell.SetCellFormula("VALUE(A1)");                   // 文本转数字
```

### 6.3.3 日期时间函数

```csharp
// 当前日期和时间
cell.SetCellFormula("TODAY()");
cell.SetCellFormula("NOW()");

// 日期组件
cell.SetCellFormula("YEAR(A1)");
cell.SetCellFormula("MONTH(A1)");
cell.SetCellFormula("DAY(A1)");
cell.SetCellFormula("WEEKDAY(A1)");    // 返回星期几（1-7）

// 时间组件
cell.SetCellFormula("HOUR(A1)");
cell.SetCellFormula("MINUTE(A1)");
cell.SetCellFormula("SECOND(A1)");

// 创建日期
cell.SetCellFormula("DATE(2024, 1, 15)");
cell.SetCellFormula("TIME(14, 30, 0)");

// 日期计算
cell.SetCellFormula("DATEDIF(A1, B1, \"D\")");  // 日期差（天）
cell.SetCellFormula("DATEDIF(A1, B1, \"M\")");  // 日期差（月）
cell.SetCellFormula("DATEDIF(A1, B1, \"Y\")");  // 日期差（年）

// 工作日计算
cell.SetCellFormula("WORKDAY(A1, 10)");         // 加10个工作日
cell.SetCellFormula("NETWORKDAYS(A1, B1)");     // 两日期间的工作日数

// 月末日期
cell.SetCellFormula("EOMONTH(A1, 0)");          // 当月最后一天
cell.SetCellFormula("EOMONTH(A1, 1)");          // 下月最后一天
```

### 6.3.4 逻辑函数

```csharp
// IF条件
cell.SetCellFormula("IF(A1>60, \"及格\", \"不及格\")");

// 嵌套IF
cell.SetCellFormula("IF(A1>=90, \"优秀\", IF(A1>=60, \"及格\", \"不及格\"))");

// 逻辑运算
cell.SetCellFormula("AND(A1>0, B1>0)");    // 与
cell.SetCellFormula("OR(A1>0, B1>0)");     // 或
cell.SetCellFormula("NOT(A1>0)");          // 非

// IFS（多条件）
cell.SetCellFormula("IFS(A1>=90, \"A\", A1>=80, \"B\", A1>=60, \"C\", TRUE, \"D\")");

// IFERROR错误处理
cell.SetCellFormula("IFERROR(A1/B1, 0)");

// IFNA（处理#N/A错误）
cell.SetCellFormula("IFNA(VLOOKUP(A1, B1:C10, 2, FALSE), \"未找到\")");

// SWITCH（类似switch语句）
cell.SetCellFormula("SWITCH(A1, 1, \"一\", 2, \"二\", 3, \"三\", \"其他\")");
```

### 6.3.5 查找与引用函数

```csharp
// VLOOKUP垂直查找
cell.SetCellFormula("VLOOKUP(A1, B1:D100, 2, FALSE)");  // 精确匹配
cell.SetCellFormula("VLOOKUP(A1, B1:D100, 3, TRUE)");   // 近似匹配

// HLOOKUP水平查找
cell.SetCellFormula("HLOOKUP(A1, B1:Z3, 2, FALSE)");

// INDEX和MATCH组合
cell.SetCellFormula("INDEX(B1:B100, MATCH(A1, A1:A100, 0))");

// INDEX（返回指定位置的值）
cell.SetCellFormula("INDEX(A1:C10, 3, 2)");  // 第3行第2列

// MATCH（查找位置）
cell.SetCellFormula("MATCH(A1, B1:B100, 0)");  // 精确匹配

// INDIRECT（间接引用）
cell.SetCellFormula("INDIRECT(\"A\"&B1)");    // 动态引用

// OFFSET（偏移引用）
cell.SetCellFormula("OFFSET(A1, 5, 2)");      // 从A1偏移5行2列
cell.SetCellFormula("SUM(OFFSET(A1, 0, 0, 10, 1))");  // 动态范围求和

// ROW和COLUMN
cell.SetCellFormula("ROW()");      // 当前行号
cell.SetCellFormula("COLUMN()");   // 当前列号

// ADDRESS（生成单元格地址）
cell.SetCellFormula("ADDRESS(1, 1)");  // 返回"$A$1"
```

### 6.3.6 统计函数

```csharp
// 条件计数
cell.SetCellFormula("COUNTIF(A1:A100, \">60\")");
cell.SetCellFormula("COUNTIFS(A1:A100, \">60\", B1:B100, \"通过\")");

// 排名
cell.SetCellFormula("RANK(A1, A1:A100, 0)");  // 降序排名
cell.SetCellFormula("RANK(A1, A1:A100, 1)");  // 升序排名

// 百分位数
cell.SetCellFormula("PERCENTILE(A1:A100, 0.9)");  // 90%分位数
cell.SetCellFormula("PERCENTRANK(A1:A100, A1)");  // 百分位排名

// 标准差和方差
cell.SetCellFormula("STDEV(A1:A100)");       // 样本标准差
cell.SetCellFormula("STDEVP(A1:A100)");      // 总体标准差
cell.SetCellFormula("VAR(A1:A100)");         // 样本方差
cell.SetCellFormula("VARP(A1:A100)");        // 总体方差

// 中位数
cell.SetCellFormula("MEDIAN(A1:A100)");

// 众数
cell.SetCellFormula("MODE(A1:A100)");

// LARGE和SMALL
cell.SetCellFormula("LARGE(A1:A100, 1)");   // 第1大的值
cell.SetCellFormula("SMALL(A1:A100, 1)");   // 第1小的值
```

## 6.4 数组公式

### 6.4.1 数组公式基础

```csharp
// 在NPOI中设置数组公式
ICell cell = row.CreateCell(0);
// NPOI 2.6+支持SetCellFormula设置数组公式
cell.SetCellFormula("SUM(A1:A10*B1:B10)");

// 对于XSSF，可以使用区域数组公式
XSSFSheet xssfSheet = (XSSFSheet)sheet;
CellRangeAddress range = new CellRangeAddress(0, 4, 3, 3);
xssfSheet.SetArrayFormula("A1:A5*B1:B5", range);
```

### 6.4.2 常用数组公式示例

```csharp
// 条件求和（等价于SUMPRODUCT）
cell.SetCellFormula("SUMPRODUCT((A1:A10>0)*(B1:B10))");

// 多条件计数
cell.SetCellFormula("SUMPRODUCT((A1:A10=\"是\")*(B1:B10>60)*1)");

// 去重计数
cell.SetCellFormula("SUMPRODUCT(1/COUNTIF(A1:A10,A1:A10))");

// 最大值对应的值
cell.SetCellFormula("INDEX(B1:B10,MATCH(MAX(A1:A10),A1:A10,0))");
```

## 6.5 公式辅助工具类

### 6.5.1 公式构建器

```csharp
/// <summary>
/// Excel公式构建器
/// </summary>
public class FormulaBuilder
{
    private readonly StringBuilder _formula = new();
    
    /// <summary>
    /// SUM求和
    /// </summary>
    public static string Sum(string range) => $"SUM({range})";
    
    /// <summary>
    /// AVERAGE平均值
    /// </summary>
    public static string Average(string range) => $"AVERAGE({range})";
    
    /// <summary>
    /// COUNT计数
    /// </summary>
    public static string Count(string range) => $"COUNT({range})";
    
    /// <summary>
    /// MAX最大值
    /// </summary>
    public static string Max(string range) => $"MAX({range})";
    
    /// <summary>
    /// MIN最小值
    /// </summary>
    public static string Min(string range) => $"MIN({range})";
    
    /// <summary>
    /// IF条件
    /// </summary>
    public static string If(string condition, string trueValue, string falseValue)
        => $"IF({condition}, {trueValue}, {falseValue})";
    
    /// <summary>
    /// VLOOKUP查找
    /// </summary>
    public static string VLookup(string lookupValue, string tableArray, 
        int colIndex, bool exactMatch = true)
        => $"VLOOKUP({lookupValue}, {tableArray}, {colIndex}, {(exactMatch ? "FALSE" : "TRUE")})";
    
    /// <summary>
    /// SUMIF条件求和
    /// </summary>
    public static string SumIf(string range, string criteria, string sumRange = null)
        => sumRange == null 
            ? $"SUMIF({range}, {criteria})" 
            : $"SUMIF({range}, {criteria}, {sumRange})";
    
    /// <summary>
    /// COUNTIF条件计数
    /// </summary>
    public static string CountIf(string range, string criteria)
        => $"COUNTIF({range}, {criteria})";
    
    /// <summary>
    /// ROUND四舍五入
    /// </summary>
    public static string Round(string number, int decimals)
        => $"ROUND({number}, {decimals})";
    
    /// <summary>
    /// IFERROR错误处理
    /// </summary>
    public static string IfError(string formula, string valueIfError)
        => $"IFERROR({formula}, {valueIfError})";
    
    /// <summary>
    /// 构建范围字符串
    /// </summary>
    public static string Range(string startCell, string endCell)
        => $"{startCell}:{endCell}";
    
    /// <summary>
    /// 构建范围字符串（使用行列索引）
    /// </summary>
    public static string Range(int startRow, int startCol, int endRow, int endCol)
    {
        string startCell = CellReference.ConvertNumToColString(startCol) + (startRow + 1);
        string endCell = CellReference.ConvertNumToColString(endCol) + (endRow + 1);
        return $"{startCell}:{endCell}";
    }
    
    /// <summary>
    /// 引用其他工作表
    /// </summary>
    public static string SheetRef(string sheetName, string cellOrRange)
    {
        if (sheetName.Contains(" ") || sheetName.Contains("'"))
        {
            sheetName = $"'{sheetName.Replace("'", "''")}'";
        }
        return $"{sheetName}!{cellOrRange}";
    }
    
    /// <summary>
    /// 转换为字符串值（添加引号）
    /// </summary>
    public static string Text(string value) => $"\"{value}\"";
}
```

### 6.5.2 公式验证与求值工具

```csharp
/// <summary>
/// 公式工具类
/// </summary>
public static class FormulaHelper
{
    /// <summary>
    /// 求值单个单元格公式
    /// </summary>
    public static object EvaluateCell(IWorkbook workbook, ICell cell)
    {
        if (cell == null) return null;
        if (cell.CellType != CellType.Formula) return GetCellValue(cell);
        
        IFormulaEvaluator evaluator = workbook.GetCreationHelper().CreateFormulaEvaluator();
        CellValue cellValue = evaluator.Evaluate(cell);
        
        return cellValue.CellType switch
        {
            CellType.Numeric => cellValue.NumberValue,
            CellType.String => cellValue.StringValue,
            CellType.Boolean => cellValue.BooleanValue,
            CellType.Error => FormulaError.ForInt(cellValue.ErrorValue).String,
            _ => null
        };
    }
    
    /// <summary>
    /// 更新所有公式
    /// </summary>
    public static void EvaluateAllFormulas(IWorkbook workbook)
    {
        IFormulaEvaluator evaluator = workbook.GetCreationHelper().CreateFormulaEvaluator();
        evaluator.EvaluateAll();
    }
    
    /// <summary>
    /// 将公式转换为值
    /// </summary>
    public static void ConvertFormulasToValues(ISheet sheet)
    {
        IFormulaEvaluator evaluator = sheet.Workbook.GetCreationHelper().CreateFormulaEvaluator();
        
        for (int i = sheet.FirstRowNum; i <= sheet.LastRowNum; i++)
        {
            IRow row = sheet.GetRow(i);
            if (row == null) continue;
            
            for (int j = row.FirstCellNum; j < row.LastCellNum; j++)
            {
                ICell cell = row.GetCell(j);
                if (cell == null || cell.CellType != CellType.Formula) continue;
                
                CellValue value = evaluator.Evaluate(cell);
                switch (value.CellType)
                {
                    case CellType.Numeric:
                        cell.SetCellValue(value.NumberValue);
                        break;
                    case CellType.String:
                        cell.SetCellValue(value.StringValue);
                        break;
                    case CellType.Boolean:
                        cell.SetCellValue(value.BooleanValue);
                        break;
                }
            }
        }
    }
    
    /// <summary>
    /// 获取工作表中的所有公式
    /// </summary>
    public static List<(string CellAddress, string Formula)> GetAllFormulas(ISheet sheet)
    {
        var formulas = new List<(string, string)>();
        
        for (int i = sheet.FirstRowNum; i <= sheet.LastRowNum; i++)
        {
            IRow row = sheet.GetRow(i);
            if (row == null) continue;
            
            for (int j = row.FirstCellNum; j < row.LastCellNum; j++)
            {
                ICell cell = row.GetCell(j);
                if (cell != null && cell.CellType == CellType.Formula)
                {
                    string address = new CellReference(i, j).FormatAsString();
                    formulas.Add((address, cell.CellFormula));
                }
            }
        }
        
        return formulas;
    }
    
    private static object GetCellValue(ICell cell)
    {
        return cell.CellType switch
        {
            CellType.Numeric => cell.NumericCellValue,
            CellType.String => cell.StringCellValue,
            CellType.Boolean => cell.BooleanCellValue,
            CellType.Blank => null,
            _ => null
        };
    }
}
```

## 6.6 综合示例

### 6.6.1 创建带公式的成绩单

```csharp
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;
using System;
using System.IO;

public class GradeSheetExample
{
    public static void CreateGradeSheet()
    {
        IWorkbook workbook = new XSSFWorkbook();
        ISheet sheet = workbook.CreateSheet("成绩单");
        
        // 表头
        IRow headerRow = sheet.CreateRow(0);
        string[] headers = { "学号", "姓名", "语文", "数学", "英语", "总分", "平均分", "排名", "等级" };
        for (int i = 0; i < headers.Length; i++)
        {
            headerRow.CreateCell(i).SetCellValue(headers[i]);
        }
        
        // 学生数据
        var students = new[]
        {
            ("S001", "张三", 85, 92, 78),
            ("S002", "李四", 92, 88, 95),
            ("S003", "王五", 78, 65, 82),
            ("S004", "赵六", 88, 95, 90),
            ("S005", "钱七", 72, 58, 68)
        };
        
        for (int i = 0; i < students.Length; i++)
        {
            int rowIndex = i + 1;
            IRow row = sheet.CreateRow(rowIndex);
            
            row.CreateCell(0).SetCellValue(students[i].Item1);  // 学号
            row.CreateCell(1).SetCellValue(students[i].Item2);  // 姓名
            row.CreateCell(2).SetCellValue(students[i].Item3);  // 语文
            row.CreateCell(3).SetCellValue(students[i].Item4);  // 数学
            row.CreateCell(4).SetCellValue(students[i].Item5);  // 英语
            
            // 总分公式
            row.CreateCell(5).SetCellFormula($"SUM(C{rowIndex + 1}:E{rowIndex + 1})");
            
            // 平均分公式
            row.CreateCell(6).SetCellFormula($"AVERAGE(C{rowIndex + 1}:E{rowIndex + 1})");
            
            // 排名公式
            row.CreateCell(7).SetCellFormula($"RANK(F{rowIndex + 1},$F$2:$F${students.Length + 1},0)");
            
            // 等级公式
            row.CreateCell(8).SetCellFormula(
                $"IF(G{rowIndex + 1}>=90,\"优秀\",IF(G{rowIndex + 1}>=80,\"良好\",IF(G{rowIndex + 1}>=60,\"及格\",\"不及格\")))");
        }
        
        // 汇总行
        int summaryRowIndex = students.Length + 2;
        IRow summaryRow = sheet.CreateRow(summaryRowIndex);
        summaryRow.CreateCell(1).SetCellValue("班级汇总");
        
        // 各科平均分
        summaryRow.CreateCell(2).SetCellFormula($"AVERAGE(C2:C{students.Length + 1})");
        summaryRow.CreateCell(3).SetCellFormula($"AVERAGE(D2:D{students.Length + 1})");
        summaryRow.CreateCell(4).SetCellFormula($"AVERAGE(E2:E{students.Length + 1})");
        
        // 总分和平均分
        summaryRow.CreateCell(5).SetCellFormula($"AVERAGE(F2:F{students.Length + 1})");
        summaryRow.CreateCell(6).SetCellFormula($"AVERAGE(G2:G{students.Length + 1})");
        
        // 统计行
        int statsRowIndex = summaryRowIndex + 1;
        IRow statsRow = sheet.CreateRow(statsRowIndex);
        statsRow.CreateCell(1).SetCellValue("统计信息");
        
        // 及格人数
        statsRow.CreateCell(2).SetCellFormula($"COUNTIF(C2:C{students.Length + 1},\">=60\")");
        statsRow.CreateCell(3).SetCellFormula($"COUNTIF(D2:D{students.Length + 1},\">=60\")");
        statsRow.CreateCell(4).SetCellFormula($"COUNTIF(E2:E{students.Length + 1},\">=60\")");
        
        // 最高分行
        int maxRowIndex = statsRowIndex + 1;
        IRow maxRow = sheet.CreateRow(maxRowIndex);
        maxRow.CreateCell(1).SetCellValue("最高分");
        maxRow.CreateCell(2).SetCellFormula($"MAX(C2:C{students.Length + 1})");
        maxRow.CreateCell(3).SetCellFormula($"MAX(D2:D{students.Length + 1})");
        maxRow.CreateCell(4).SetCellFormula($"MAX(E2:E{students.Length + 1})");
        maxRow.CreateCell(5).SetCellFormula($"MAX(F2:F{students.Length + 1})");
        
        // 最低分行
        int minRowIndex = maxRowIndex + 1;
        IRow minRow = sheet.CreateRow(minRowIndex);
        minRow.CreateCell(1).SetCellValue("最低分");
        minRow.CreateCell(2).SetCellFormula($"MIN(C2:C{students.Length + 1})");
        minRow.CreateCell(3).SetCellFormula($"MIN(D2:D{students.Length + 1})");
        minRow.CreateCell(4).SetCellFormula($"MIN(E2:E{students.Length + 1})");
        minRow.CreateCell(5).SetCellFormula($"MIN(F2:F{students.Length + 1})");
        
        // 计算所有公式
        IFormulaEvaluator evaluator = workbook.GetCreationHelper().CreateFormulaEvaluator();
        evaluator.EvaluateAll();
        
        // 自动调整列宽
        for (int i = 0; i < headers.Length; i++)
        {
            sheet.AutoSizeColumn(i);
        }
        
        // 保存
        using (FileStream fs = new FileStream("成绩单.xlsx", FileMode.Create))
        {
            workbook.Write(fs);
        }
        
        Console.WriteLine("成绩单创建成功！");
    }
}
```

### 6.6.2 创建销售分析报表

```csharp
public class SalesAnalysisExample
{
    public static void CreateSalesAnalysis()
    {
        IWorkbook workbook = new XSSFWorkbook();
        
        // 数据表
        ISheet dataSheet = workbook.CreateSheet("销售数据");
        CreateSalesData(dataSheet);
        
        // 分析表
        ISheet analysisSheet = workbook.CreateSheet("销售分析");
        CreateAnalysis(analysisSheet);
        
        // 计算公式
        IFormulaEvaluator evaluator = workbook.GetCreationHelper().CreateFormulaEvaluator();
        evaluator.EvaluateAll();
        
        // 保存
        using (FileStream fs = new FileStream("销售分析.xlsx", FileMode.Create))
        {
            workbook.Write(fs);
        }
    }
    
    private static void CreateSalesData(ISheet sheet)
    {
        // 表头
        IRow header = sheet.CreateRow(0);
        header.CreateCell(0).SetCellValue("日期");
        header.CreateCell(1).SetCellValue("产品");
        header.CreateCell(2).SetCellValue("地区");
        header.CreateCell(3).SetCellValue("销售员");
        header.CreateCell(4).SetCellValue("数量");
        header.CreateCell(5).SetCellValue("单价");
        header.CreateCell(6).SetCellValue("金额");
        
        // 示例数据
        var random = new Random();
        string[] products = { "产品A", "产品B", "产品C" };
        string[] regions = { "华东", "华北", "华南" };
        string[] salesmen = { "张三", "李四", "王五" };
        
        for (int i = 1; i <= 100; i++)
        {
            IRow row = sheet.CreateRow(i);
            row.CreateCell(0).SetCellValue(DateTime.Now.AddDays(-random.Next(30)));
            row.CreateCell(1).SetCellValue(products[random.Next(3)]);
            row.CreateCell(2).SetCellValue(regions[random.Next(3)]);
            row.CreateCell(3).SetCellValue(salesmen[random.Next(3)]);
            row.CreateCell(4).SetCellValue(random.Next(1, 50));
            row.CreateCell(5).SetCellValue(Math.Round(random.NextDouble() * 100 + 50, 2));
            row.CreateCell(6).SetCellFormula($"E{i + 1}*F{i + 1}");
        }
    }
    
    private static void CreateAnalysis(ISheet sheet)
    {
        int row = 0;
        
        // 总体统计
        sheet.CreateRow(row++).CreateCell(0).SetCellValue("销售总体统计");
        
        IRow totalRow = sheet.CreateRow(row++);
        totalRow.CreateCell(0).SetCellValue("总销售额");
        totalRow.CreateCell(1).SetCellFormula("SUM(销售数据!G:G)");
        
        IRow avgRow = sheet.CreateRow(row++);
        avgRow.CreateCell(0).SetCellValue("平均单价");
        avgRow.CreateCell(1).SetCellFormula("AVERAGE(销售数据!F2:F101)");
        
        IRow countRow = sheet.CreateRow(row++);
        countRow.CreateCell(0).SetCellValue("订单数量");
        countRow.CreateCell(1).SetCellFormula("COUNTA(销售数据!A2:A101)");
        
        row++;
        
        // 产品分析
        sheet.CreateRow(row++).CreateCell(0).SetCellValue("按产品统计");
        
        string[] products = { "产品A", "产品B", "产品C" };
        IRow prodHeader = sheet.CreateRow(row++);
        prodHeader.CreateCell(0).SetCellValue("产品");
        prodHeader.CreateCell(1).SetCellValue("销售额");
        prodHeader.CreateCell(2).SetCellValue("占比");
        
        int prodStartRow = row;
        foreach (var prod in products)
        {
            IRow prodRow = sheet.CreateRow(row++);
            prodRow.CreateCell(0).SetCellValue(prod);
            prodRow.CreateCell(1).SetCellFormula($"SUMIF(销售数据!B:B,\"{prod}\",销售数据!G:G)");
            prodRow.CreateCell(2).SetCellFormula($"B{row}/B2");
        }
        
        row++;
        
        // 地区分析
        sheet.CreateRow(row++).CreateCell(0).SetCellValue("按地区统计");
        
        string[] regions = { "华东", "华北", "华南" };
        IRow regHeader = sheet.CreateRow(row++);
        regHeader.CreateCell(0).SetCellValue("地区");
        regHeader.CreateCell(1).SetCellValue("销售额");
        regHeader.CreateCell(2).SetCellValue("订单数");
        
        foreach (var reg in regions)
        {
            IRow regRow = sheet.CreateRow(row++);
            regRow.CreateCell(0).SetCellValue(reg);
            regRow.CreateCell(1).SetCellFormula($"SUMIF(销售数据!C:C,\"{reg}\",销售数据!G:G)");
            regRow.CreateCell(2).SetCellFormula($"COUNTIF(销售数据!C:C,\"{reg}\")");
        }
    }
}
```

## 6.7 本章小结

本章详细介绍了NPOI中的公式与函数功能。通过本章学习，你应该掌握：

- 公式的基本概念和读写操作
- 各种单元格引用方式（相对、绝对、混合、跨表）
- 命名范围的创建和使用
- 常用函数类别（数学、文本、日期、逻辑、查找、统计）
- 数组公式的使用
- 公式求值器的使用
- 公式辅助工具类的封装

公式是Excel的核心功能之一，熟练使用公式可以让Excel文档具有强大的自动计算能力。

---

> **下一章预告**：第七章将介绍Excel数据验证与保护功能，包括数据有效性设置、单元格保护和工作表保护。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第05章-Excel样式与格式化" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第07章-Excel数据验证与保护" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

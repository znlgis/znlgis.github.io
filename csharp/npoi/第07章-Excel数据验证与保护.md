# 第七章：Excel数据验证与保护

## 7.1 数据验证基础

### 7.1.1 数据验证概述

数据验证是Excel中用于限制用户输入的功能，可以确保数据的准确性和一致性。NPOI支持创建各种类型的数据验证规则。

```csharp
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;

IWorkbook workbook = new XSSFWorkbook();
ISheet sheet = workbook.CreateSheet("数据验证");

// 获取数据验证帮助类
IDataValidationHelper validationHelper = sheet.GetDataValidationHelper();
```

### 7.1.2 验证类型

NPOI支持以下验证类型：

| 验证类型 | 说明 | 枚举值 |
|----------|------|--------|
| 任何值 | 不限制 | ValidationType.ANY |
| 整数 | 整数验证 | ValidationType.INTEGER |
| 小数 | 小数验证 | ValidationType.DECIMAL |
| 列表 | 下拉列表 | ValidationType.LIST |
| 日期 | 日期验证 | ValidationType.DATE |
| 时间 | 时间验证 | ValidationType.TIME |
| 文本长度 | 文本长度验证 | ValidationType.TEXT_LENGTH |
| 自定义 | 公式验证 | ValidationType.FORMULA |

## 7.2 下拉列表

### 7.2.1 显式列表（直接指定选项）

```csharp
// 创建显式列表约束
string[] options = { "是", "否", "未知" };
IDataValidationConstraint constraint = validationHelper.CreateExplicitListConstraint(options);

// 指定应用范围（A2:A100）
CellRangeAddressList addressList = new CellRangeAddressList(1, 99, 0, 0);

// 创建数据验证
IDataValidation validation = validationHelper.CreateValidation(constraint, addressList);

// 设置下拉箭头显示
validation.ShowDropDown = false;  // false表示显示下拉箭头

// 设置错误提示
validation.ShowErrorBox = true;
validation.CreateErrorBox("输入错误", "请从下拉列表中选择一个值");

// 设置输入提示
validation.ShowPromptBox = true;
validation.CreatePromptBox("提示", "请选择一个选项");

// 应用验证
sheet.AddValidationData(validation);
```

### 7.2.2 引用列表（从单元格区域获取选项）

```csharp
// 先在某个区域填入选项
ISheet optionSheet = workbook.CreateSheet("选项");
string[] departments = { "技术部", "市场部", "人事部", "财务部", "运营部" };
for (int i = 0; i < departments.Length; i++)
{
    optionSheet.CreateRow(i).CreateCell(0).SetCellValue(departments[i]);
}

// 创建引用列表约束
IDataValidationConstraint refConstraint = validationHelper.CreateFormulaListConstraint("选项!$A$1:$A$5");

CellRangeAddressList deptAddressList = new CellRangeAddressList(1, 99, 1, 1);
IDataValidation deptValidation = validationHelper.CreateValidation(refConstraint, deptAddressList);
deptValidation.ShowErrorBox = true;
deptValidation.CreateErrorBox("错误", "请选择有效的部门");

sheet.AddValidationData(deptValidation);
```

### 7.2.3 命名范围列表

```csharp
// 创建命名范围
IName namedRange = workbook.CreateName();
namedRange.NameName = "ProductList";
namedRange.RefersToFormula = "选项!$B$1:$B$10";

// 使用命名范围创建下拉列表
IDataValidationConstraint namedConstraint = validationHelper.CreateFormulaListConstraint("ProductList");

CellRangeAddressList prodAddressList = new CellRangeAddressList(1, 99, 2, 2);
IDataValidation prodValidation = validationHelper.CreateValidation(namedConstraint, prodAddressList);
sheet.AddValidationData(prodValidation);
```

## 7.3 数值验证

### 7.3.1 整数验证

```csharp
// 创建整数约束（1-100之间）
IDataValidationConstraint intConstraint = validationHelper.CreateIntegerConstraint(
    OperatorType.BETWEEN, "1", "100");

CellRangeAddressList intAddressList = new CellRangeAddressList(1, 99, 3, 3);
IDataValidation intValidation = validationHelper.CreateValidation(intConstraint, intAddressList);
intValidation.ShowErrorBox = true;
intValidation.CreateErrorBox("数值错误", "请输入1到100之间的整数");
intValidation.ShowPromptBox = true;
intValidation.CreatePromptBox("数量", "请输入1-100之间的整数");

sheet.AddValidationData(intValidation);
```

### 7.3.2 小数验证

```csharp
// 创建小数约束（大于0）
IDataValidationConstraint decConstraint = validationHelper.CreateDecimalConstraint(
    OperatorType.GREATER_THAN, "0", null);

CellRangeAddressList decAddressList = new CellRangeAddressList(1, 99, 4, 4);
IDataValidation decValidation = validationHelper.CreateValidation(decConstraint, decAddressList);
decValidation.ShowErrorBox = true;
decValidation.CreateErrorBox("错误", "金额必须大于0");

sheet.AddValidationData(decValidation);
```

### 7.3.3 比较运算符

```csharp
// 支持的运算符类型
OperatorType.BETWEEN;           // 介于
OperatorType.NOT_BETWEEN;       // 不介于
OperatorType.EQUAL;             // 等于
OperatorType.NOT_EQUAL;         // 不等于
OperatorType.GREATER_THAN;      // 大于
OperatorType.LESS_THAN;         // 小于
OperatorType.GREATER_OR_EQUAL;  // 大于或等于
OperatorType.LESS_OR_EQUAL;     // 小于或等于

// 示例：大于或等于某个单元格的值
IDataValidationConstraint dynamicConstraint = validationHelper.CreateIntegerConstraint(
    OperatorType.GREATER_OR_EQUAL, "$E$1", null);
```

## 7.4 日期时间验证

### 7.4.1 日期验证

```csharp
// 日期在指定范围内
IDataValidationConstraint dateConstraint = validationHelper.CreateDateConstraint(
    OperatorType.BETWEEN, "2024-01-01", "2024-12-31", "yyyy-MM-dd");

CellRangeAddressList dateAddressList = new CellRangeAddressList(1, 99, 5, 5);
IDataValidation dateValidation = validationHelper.CreateValidation(dateConstraint, dateAddressList);
dateValidation.ShowErrorBox = true;
dateValidation.CreateErrorBox("日期错误", "请输入2024年的日期");

sheet.AddValidationData(dateValidation);
```

### 7.4.2 时间验证

```csharp
// 时间在工作时间内（9:00-18:00）
IDataValidationConstraint timeConstraint = validationHelper.CreateTimeConstraint(
    OperatorType.BETWEEN, "09:00", "18:00");

CellRangeAddressList timeAddressList = new CellRangeAddressList(1, 99, 6, 6);
IDataValidation timeValidation = validationHelper.CreateValidation(timeConstraint, timeAddressList);
timeValidation.ShowErrorBox = true;
timeValidation.CreateErrorBox("时间错误", "请输入9:00到18:00之间的时间");

sheet.AddValidationData(timeValidation);
```

## 7.5 文本长度验证

```csharp
// 文本长度限制（5-20个字符）
IDataValidationConstraint textLengthConstraint = validationHelper.CreateTextLengthConstraint(
    OperatorType.BETWEEN, "5", "20");

CellRangeAddressList textAddressList = new CellRangeAddressList(1, 99, 7, 7);
IDataValidation textValidation = validationHelper.CreateValidation(textLengthConstraint, textAddressList);
textValidation.ShowErrorBox = true;
textValidation.CreateErrorBox("长度错误", "文本长度必须在5-20个字符之间");

sheet.AddValidationData(textValidation);
```

## 7.6 自定义公式验证

### 7.6.1 基本公式验证

```csharp
// 使用公式验证（检查是否为有效的邮箱格式简化版本）
IDataValidationConstraint formulaConstraint = validationHelper.CreateCustomConstraint(
    "AND(ISNUMBER(FIND(\"@\",A2)),ISNUMBER(FIND(\".\",A2)))");

CellRangeAddressList emailAddressList = new CellRangeAddressList(1, 99, 8, 8);
IDataValidation emailValidation = validationHelper.CreateValidation(formulaConstraint, emailAddressList);
emailValidation.ShowErrorBox = true;
emailValidation.CreateErrorBox("格式错误", "请输入有效的邮箱地址");

sheet.AddValidationData(emailValidation);
```

### 7.6.2 复杂公式验证示例

```csharp
// 验证身份证号（简化：18位数字或17位数字+X）
string idCardFormula = "OR(AND(LEN(J2)=18,ISNUMBER(VALUE(J2))),AND(LEN(J2)=18,ISNUMBER(VALUE(LEFT(J2,17))),RIGHT(J2,1)=\"X\"))";
IDataValidationConstraint idConstraint = validationHelper.CreateCustomConstraint(idCardFormula);

CellRangeAddressList idAddressList = new CellRangeAddressList(1, 99, 9, 9);
IDataValidation idValidation = validationHelper.CreateValidation(idConstraint, idAddressList);
idValidation.ShowErrorBox = true;
idValidation.CreateErrorBox("格式错误", "请输入18位身份证号");

sheet.AddValidationData(idValidation);

// 验证手机号（11位数字，以1开头）
string phoneFormula = "AND(LEN(K2)=11,LEFT(K2,1)=\"1\",ISNUMBER(VALUE(K2)))";
IDataValidationConstraint phoneConstraint = validationHelper.CreateCustomConstraint(phoneFormula);

CellRangeAddressList phoneAddressList = new CellRangeAddressList(1, 99, 10, 10);
IDataValidation phoneValidation = validationHelper.CreateValidation(phoneConstraint, phoneAddressList);
phoneValidation.ShowErrorBox = true;
phoneValidation.CreateErrorBox("格式错误", "请输入11位手机号码");

sheet.AddValidationData(phoneValidation);
```

## 7.7 验证设置选项

### 7.7.1 错误提示设置

```csharp
// 错误提示样式
validation.ErrorStyle = ErrorStyle.STOP;       // 停止：禁止输入无效数据
validation.ErrorStyle = ErrorStyle.WARNING;    // 警告：允许输入但显示警告
validation.ErrorStyle = ErrorStyle.INFO;       // 信息：仅显示信息提示

// 创建错误提示框
validation.ShowErrorBox = true;
validation.CreateErrorBox("错误标题", "错误详细信息");

// 或设置错误提示属性
validation.ErrorBoxTitle = "错误标题";
validation.ErrorBoxText = "错误详细信息";
```

### 7.7.2 输入提示设置

```csharp
// 输入提示
validation.ShowPromptBox = true;
validation.CreatePromptBox("输入提示标题", "请按照要求输入数据");

// 或设置输入提示属性
validation.PromptBoxTitle = "提示标题";
validation.PromptBoxText = "提示内容";
```

### 7.7.3 其他设置

```csharp
// 是否允许空值
validation.EmptyCellAllowed = true;

// 下拉列表是否显示下拉箭头（注意：false表示显示）
validation.ShowDropDown = false;

// 是否抑制下拉列表
validation.SuppressDropDownArrow = false;
```

## 7.8 工作表保护

### 7.8.1 保护工作表

```csharp
// 保护工作表（带密码）
sheet.ProtectSheet("password123");

// 对于XSSFSheet，可以设置更详细的保护选项
if (sheet is XSSFSheet xssfSheet)
{
    xssfSheet.LockAutoFilter(true);      // 锁定自动筛选
    xssfSheet.LockDeleteColumns(true);   // 锁定删除列
    xssfSheet.LockDeleteRows(true);      // 锁定删除行
    xssfSheet.LockFormatCells(true);     // 锁定格式化单元格
    xssfSheet.LockFormatColumns(true);   // 锁定格式化列
    xssfSheet.LockFormatRows(true);      // 锁定格式化行
    xssfSheet.LockInsertColumns(true);   // 锁定插入列
    xssfSheet.LockInsertRows(true);      // 锁定插入行
    xssfSheet.LockInsertHyperlinks(true);// 锁定插入超链接
    xssfSheet.LockPivotTables(true);     // 锁定数据透视表
    xssfSheet.LockSort(true);            // 锁定排序
    xssfSheet.LockObjects(true);         // 锁定对象
    xssfSheet.LockScenarios(true);       // 锁定方案
    xssfSheet.LockSelectLockedCells(false);  // 允许选择锁定的单元格
    xssfSheet.LockSelectUnlockedCells(false);// 允许选择未锁定的单元格
}
```

### 7.8.2 取消工作表保护

```csharp
// 取消保护（需要正确的密码）
// NPOI中直接调用ProtectSheet即可取消，某些版本可能需要密码
if (sheet is XSSFSheet xssfSheet)
{
    // 对于XSSF，可以通过设置空密码来取消保护
    xssfSheet.ProtectSheet(null);
}
```

## 7.9 单元格保护

### 7.9.1 锁定单元格

```csharp
// 默认情况下，所有单元格都是锁定的
// 要让锁定生效，需要保护工作表

// 创建锁定样式
ICellStyle lockedStyle = workbook.CreateCellStyle();
lockedStyle.IsLocked = true;

// 创建未锁定样式（允许编辑）
ICellStyle unlockedStyle = workbook.CreateCellStyle();
unlockedStyle.IsLocked = false;

// 应用样式
IRow row = sheet.CreateRow(0);

// 锁定单元格
ICell lockedCell = row.CreateCell(0);
lockedCell.SetCellValue("锁定的单元格");
lockedCell.CellStyle = lockedStyle;

// 未锁定单元格
ICell unlockedCell = row.CreateCell(1);
unlockedCell.SetCellValue("可编辑的单元格");
unlockedCell.CellStyle = unlockedStyle;

// 保护工作表使锁定生效
sheet.ProtectSheet("password");
```

### 7.9.2 隐藏公式

```csharp
// 隐藏公式（保护工作表后，公式栏不显示公式）
ICellStyle hiddenFormulaStyle = workbook.CreateCellStyle();
hiddenFormulaStyle.IsHidden = true;
hiddenFormulaStyle.IsLocked = true;

ICell formulaCell = row.CreateCell(2);
formulaCell.SetCellFormula("SUM(A1:A10)");
formulaCell.CellStyle = hiddenFormulaStyle;
```

## 7.10 工作簿保护

### 7.10.1 保护工作簿结构

```csharp
// 保护工作簿结构（防止添加、删除、重命名工作表）
if (workbook is XSSFWorkbook xssfWorkbook)
{
    xssfWorkbook.LockStructure();
    xssfWorkbook.LockWindows();  // 锁定窗口大小和位置
}
```

### 7.10.2 设置工作簿密码

```csharp
// 对于XSSF工作簿，可以设置打开密码
// 注意：这需要使用POIFSFileSystem，NPOI中的实现可能有限
```

## 7.11 数据验证辅助类

```csharp
/// <summary>
/// 数据验证辅助类
/// </summary>
public static class DataValidationHelper
{
    /// <summary>
    /// 添加下拉列表
    /// </summary>
    public static void AddDropdownList(ISheet sheet, int firstRow, int lastRow, 
        int column, string[] options, string title = null, string message = null)
    {
        IDataValidationHelper helper = sheet.GetDataValidationHelper();
        IDataValidationConstraint constraint = helper.CreateExplicitListConstraint(options);
        
        CellRangeAddressList addressList = new CellRangeAddressList(firstRow, lastRow, column, column);
        IDataValidation validation = helper.CreateValidation(constraint, addressList);
        
        validation.ShowErrorBox = true;
        validation.CreateErrorBox("选择错误", "请从下拉列表中选择有效值");
        
        if (!string.IsNullOrEmpty(title) || !string.IsNullOrEmpty(message))
        {
            validation.ShowPromptBox = true;
            validation.CreatePromptBox(title ?? "提示", message ?? "请选择一个选项");
        }
        
        sheet.AddValidationData(validation);
    }
    
    /// <summary>
    /// 添加数值范围验证
    /// </summary>
    public static void AddNumberValidation(ISheet sheet, int firstRow, int lastRow,
        int column, double? minValue, double? maxValue, bool isInteger = false,
        string errorTitle = null, string errorMessage = null)
    {
        IDataValidationHelper helper = sheet.GetDataValidationHelper();
        IDataValidationConstraint constraint;
        
        if (minValue.HasValue && maxValue.HasValue)
        {
            constraint = isInteger
                ? helper.CreateIntegerConstraint(OperatorType.BETWEEN, 
                    minValue.Value.ToString(), maxValue.Value.ToString())
                : helper.CreateDecimalConstraint(OperatorType.BETWEEN,
                    minValue.Value.ToString(), maxValue.Value.ToString());
        }
        else if (minValue.HasValue)
        {
            constraint = isInteger
                ? helper.CreateIntegerConstraint(OperatorType.GREATER_OR_EQUAL,
                    minValue.Value.ToString(), null)
                : helper.CreateDecimalConstraint(OperatorType.GREATER_OR_EQUAL,
                    minValue.Value.ToString(), null);
        }
        else if (maxValue.HasValue)
        {
            constraint = isInteger
                ? helper.CreateIntegerConstraint(OperatorType.LESS_OR_EQUAL,
                    maxValue.Value.ToString(), null)
                : helper.CreateDecimalConstraint(OperatorType.LESS_OR_EQUAL,
                    maxValue.Value.ToString(), null);
        }
        else
        {
            return;  // 没有限制
        }
        
        CellRangeAddressList addressList = new CellRangeAddressList(firstRow, lastRow, column, column);
        IDataValidation validation = helper.CreateValidation(constraint, addressList);
        
        validation.ShowErrorBox = true;
        validation.CreateErrorBox(
            errorTitle ?? "数值错误",
            errorMessage ?? $"请输入{(minValue.HasValue ? $"不小于{minValue}" : "")}{(minValue.HasValue && maxValue.HasValue ? "且" : "")}{(maxValue.HasValue ? $"不大于{maxValue}" : "")}的{(isInteger ? "整数" : "数值")}");
        
        sheet.AddValidationData(validation);
    }
    
    /// <summary>
    /// 添加日期范围验证
    /// </summary>
    public static void AddDateValidation(ISheet sheet, int firstRow, int lastRow,
        int column, DateTime? minDate, DateTime? maxDate,
        string errorTitle = null, string errorMessage = null)
    {
        IDataValidationHelper helper = sheet.GetDataValidationHelper();
        
        string minStr = minDate?.ToString("yyyy-MM-dd");
        string maxStr = maxDate?.ToString("yyyy-MM-dd");
        
        IDataValidationConstraint constraint;
        if (minStr != null && maxStr != null)
        {
            constraint = helper.CreateDateConstraint(OperatorType.BETWEEN, minStr, maxStr, "yyyy-MM-dd");
        }
        else if (minStr != null)
        {
            constraint = helper.CreateDateConstraint(OperatorType.GREATER_OR_EQUAL, minStr, null, "yyyy-MM-dd");
        }
        else if (maxStr != null)
        {
            constraint = helper.CreateDateConstraint(OperatorType.LESS_OR_EQUAL, maxStr, null, "yyyy-MM-dd");
        }
        else
        {
            return;
        }
        
        CellRangeAddressList addressList = new CellRangeAddressList(firstRow, lastRow, column, column);
        IDataValidation validation = helper.CreateValidation(constraint, addressList);
        
        validation.ShowErrorBox = true;
        validation.CreateErrorBox(
            errorTitle ?? "日期错误",
            errorMessage ?? "请输入有效的日期");
        
        sheet.AddValidationData(validation);
    }
    
    /// <summary>
    /// 添加文本长度验证
    /// </summary>
    public static void AddTextLengthValidation(ISheet sheet, int firstRow, int lastRow,
        int column, int? minLength, int? maxLength,
        string errorTitle = null, string errorMessage = null)
    {
        IDataValidationHelper helper = sheet.GetDataValidationHelper();
        IDataValidationConstraint constraint;
        
        if (minLength.HasValue && maxLength.HasValue)
        {
            constraint = helper.CreateTextLengthConstraint(OperatorType.BETWEEN,
                minLength.Value.ToString(), maxLength.Value.ToString());
        }
        else if (minLength.HasValue)
        {
            constraint = helper.CreateTextLengthConstraint(OperatorType.GREATER_OR_EQUAL,
                minLength.Value.ToString(), null);
        }
        else if (maxLength.HasValue)
        {
            constraint = helper.CreateTextLengthConstraint(OperatorType.LESS_OR_EQUAL,
                maxLength.Value.ToString(), null);
        }
        else
        {
            return;
        }
        
        CellRangeAddressList addressList = new CellRangeAddressList(firstRow, lastRow, column, column);
        IDataValidation validation = helper.CreateValidation(constraint, addressList);
        
        validation.ShowErrorBox = true;
        validation.CreateErrorBox(
            errorTitle ?? "长度错误",
            errorMessage ?? $"文本长度必须{(minLength.HasValue ? $"至少{minLength}个字符" : "")}{(minLength.HasValue && maxLength.HasValue ? "，" : "")}{(maxLength.HasValue ? $"最多{maxLength}个字符" : "")}");
        
        sheet.AddValidationData(validation);
    }
    
    /// <summary>
    /// 设置单元格为可编辑（取消锁定）
    /// </summary>
    public static void SetCellsEditable(ISheet sheet, CellRangeAddress range, IWorkbook workbook)
    {
        ICellStyle unlockedStyle = workbook.CreateCellStyle();
        unlockedStyle.IsLocked = false;
        
        for (int rowIdx = range.FirstRow; rowIdx <= range.LastRow; rowIdx++)
        {
            IRow row = sheet.GetRow(rowIdx) ?? sheet.CreateRow(rowIdx);
            for (int colIdx = range.FirstColumn; colIdx <= range.LastColumn; colIdx++)
            {
                ICell cell = row.GetCell(colIdx) ?? row.CreateCell(colIdx);
                
                // 保留原有样式但取消锁定
                if (cell.CellStyle != null)
                {
                    ICellStyle newStyle = workbook.CreateCellStyle();
                    newStyle.CloneStyleFrom(cell.CellStyle);
                    newStyle.IsLocked = false;
                    cell.CellStyle = newStyle;
                }
                else
                {
                    cell.CellStyle = unlockedStyle;
                }
            }
        }
    }
}
```

## 7.12 综合示例

### 7.12.1 创建数据录入模板

```csharp
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;
using System;
using System.IO;

public class DataEntryTemplateExample
{
    public static void CreateEmployeeEntryTemplate()
    {
        IWorkbook workbook = new XSSFWorkbook();
        ISheet sheet = workbook.CreateSheet("员工信息录入");
        
        // 创建表头
        IRow headerRow = sheet.CreateRow(0);
        string[] headers = { "姓名", "性别", "出生日期", "部门", "职位", "入职日期", "薪资", "手机号", "邮箱", "备注" };
        
        ICellStyle headerStyle = CreateHeaderStyle(workbook);
        for (int i = 0; i < headers.Length; i++)
        {
            ICell cell = headerRow.CreateCell(i);
            cell.SetCellValue(headers[i]);
            cell.CellStyle = headerStyle;
            sheet.SetColumnWidth(i, 15 * 256);
        }
        
        // 创建数据输入区域样式（未锁定）
        ICellStyle inputStyle = workbook.CreateCellStyle();
        inputStyle.IsLocked = false;
        inputStyle.FillForegroundColor = IndexedColors.LightYellow.Index;
        inputStyle.FillPattern = FillPattern.SolidForeground;
        
        // 预设数据行
        for (int i = 1; i <= 100; i++)
        {
            IRow row = sheet.CreateRow(i);
            for (int j = 0; j < headers.Length; j++)
            {
                ICell cell = row.CreateCell(j);
                cell.CellStyle = inputStyle;
            }
        }
        
        // 获取数据验证帮助器
        IDataValidationHelper helper = sheet.GetDataValidationHelper();
        
        // 1. 姓名：文本长度2-20
        DataValidationHelper.AddTextLengthValidation(sheet, 1, 100, 0, 2, 20, 
            "姓名格式错误", "姓名长度应为2-20个字符");
        
        // 2. 性别：下拉列表
        DataValidationHelper.AddDropdownList(sheet, 1, 100, 1, 
            new[] { "男", "女" }, "选择性别", "请选择员工性别");
        
        // 3. 出生日期：日期范围
        DataValidationHelper.AddDateValidation(sheet, 1, 100, 2,
            new DateTime(1960, 1, 1), DateTime.Now.AddYears(-18),
            "日期错误", "请输入有效的出生日期（员工需年满18岁）");
        
        // 4. 部门：下拉列表
        DataValidationHelper.AddDropdownList(sheet, 1, 100, 3,
            new[] { "技术部", "市场部", "人事部", "财务部", "运营部" },
            "选择部门", "请选择所属部门");
        
        // 5. 职位：下拉列表
        DataValidationHelper.AddDropdownList(sheet, 1, 100, 4,
            new[] { "经理", "主管", "高级工程师", "工程师", "助理" },
            "选择职位", "请选择职位级别");
        
        // 6. 入职日期：日期范围
        DataValidationHelper.AddDateValidation(sheet, 1, 100, 5,
            new DateTime(2000, 1, 1), DateTime.Now,
            "日期错误", "入职日期不能晚于今天");
        
        // 7. 薪资：数值范围
        DataValidationHelper.AddNumberValidation(sheet, 1, 100, 6,
            3000, 1000000, false, "薪资错误", "薪资范围应为3000-1000000");
        
        // 8. 手机号：自定义公式验证
        IDataValidationConstraint phoneConstraint = helper.CreateCustomConstraint(
            "AND(LEN(H2)=11,LEFT(H2,1)=\"1\")");
        CellRangeAddressList phoneRange = new CellRangeAddressList(1, 100, 7, 7);
        IDataValidation phoneValidation = helper.CreateValidation(phoneConstraint, phoneRange);
        phoneValidation.ShowErrorBox = true;
        phoneValidation.CreateErrorBox("格式错误", "请输入11位手机号码");
        sheet.AddValidationData(phoneValidation);
        
        // 9. 邮箱：自定义公式验证
        IDataValidationConstraint emailConstraint = helper.CreateCustomConstraint(
            "AND(ISNUMBER(FIND(\"@\",I2)),ISNUMBER(FIND(\".\",I2)))");
        CellRangeAddressList emailRange = new CellRangeAddressList(1, 100, 8, 8);
        IDataValidation emailValidation = helper.CreateValidation(emailConstraint, emailRange);
        emailValidation.ShowErrorBox = true;
        emailValidation.CreateErrorBox("格式错误", "请输入有效的邮箱地址");
        sheet.AddValidationData(emailValidation);
        
        // 10. 备注：文本长度限制
        DataValidationHelper.AddTextLengthValidation(sheet, 1, 100, 9, null, 500,
            "备注过长", "备注最多500个字符");
        
        // 冻结首行
        sheet.CreateFreezePane(0, 1);
        
        // 保护工作表
        sheet.ProtectSheet("admin123");
        
        // 保存
        using (FileStream fs = new FileStream("员工信息录入模板.xlsx", FileMode.Create))
        {
            workbook.Write(fs);
        }
        
        Console.WriteLine("数据录入模板创建成功！");
    }
    
    private static ICellStyle CreateHeaderStyle(IWorkbook workbook)
    {
        ICellStyle style = workbook.CreateCellStyle();
        IFont font = workbook.CreateFont();
        font.IsBold = true;
        font.FontHeightInPoints = 11;
        style.SetFont(font);
        style.Alignment = HorizontalAlignment.Center;
        style.VerticalAlignment = VerticalAlignment.Center;
        style.FillForegroundColor = IndexedColors.Grey25Percent.Index;
        style.FillPattern = FillPattern.SolidForeground;
        style.BorderBottom = BorderStyle.Thin;
        style.BorderTop = BorderStyle.Thin;
        style.BorderLeft = BorderStyle.Thin;
        style.BorderRight = BorderStyle.Thin;
        style.IsLocked = true;
        return style;
    }
}
```

## 7.13 本章小结

本章详细介绍了NPOI中的数据验证与保护功能。通过本章学习，你应该掌握：

- 数据验证的基本概念和类型
- 下拉列表的创建（显式列表、引用列表、命名范围）
- 数值验证（整数、小数、范围限制）
- 日期时间验证
- 文本长度验证
- 自定义公式验证
- 错误提示和输入提示的设置
- 工作表保护和取消保护
- 单元格锁定和公式隐藏
- 工作簿结构保护

数据验证和保护功能可以有效提高数据输入的准确性，防止误操作，是创建专业数据录入模板的重要手段。

---

> **下一章预告**：第八章将介绍Excel图表与图形功能，包括各种类型图表的创建、图片插入和形状绘制。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第06章-Excel公式与函数" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第08章-Excel图表与图形" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

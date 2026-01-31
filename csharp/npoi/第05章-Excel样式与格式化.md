# 第五章：Excel样式与格式化

## 5.1 样式基础概念

### 5.1.1 样式对象结构

在NPOI中，样式通过`ICellStyle`接口管理，包含以下主要组成部分：

```
ICellStyle
├── 字体 (IFont)
│   ├── 字体名称
│   ├── 字号
│   ├── 加粗/斜体/下划线
│   └── 颜色
├── 对齐方式
│   ├── 水平对齐
│   ├── 垂直对齐
│   └── 文本换行
├── 边框
│   ├── 边框样式
│   └── 边框颜色
├── 填充
│   ├── 前景色
│   ├── 背景色
│   └── 填充模式
└── 数据格式
    └── 数字/日期格式
```

### 5.1.2 创建和应用样式

```csharp
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;

IWorkbook workbook = new XSSFWorkbook();
ISheet sheet = workbook.CreateSheet("样式示例");

// 创建样式
ICellStyle style = workbook.CreateCellStyle();

// 应用样式到单元格
IRow row = sheet.CreateRow(0);
ICell cell = row.CreateCell(0);
cell.SetCellValue("带样式的文本");
cell.CellStyle = style;
```

### 5.1.3 样式复用的重要性

**重要提示**：NPOI中样式对象的数量是有限的（约4000个），应该复用样式而不是为每个单元格创建新样式。

```csharp
// 错误做法：为每个单元格创建新样式
for (int i = 0; i < 10000; i++)
{
    ICellStyle style = workbook.CreateCellStyle();  // 可能超出限制！
    cell.CellStyle = style;
}

// 正确做法：复用样式
ICellStyle sharedStyle = workbook.CreateCellStyle();
for (int i = 0; i < 10000; i++)
{
    cell.CellStyle = sharedStyle;  // 复用同一个样式
}
```

## 5.2 字体设置

### 5.2.1 基本字体属性

```csharp
IWorkbook workbook = new XSSFWorkbook();

// 创建字体
IFont font = workbook.CreateFont();

// 字体名称
font.FontName = "微软雅黑";
// 常用字体：宋体、黑体、楷体、Arial、Times New Roman

// 字号（以点为单位）
font.FontHeightInPoints = 12;
// 或使用 FontHeight（以 1/20 点为单位）
font.FontHeight = 240;  // 12点 = 240

// 加粗
font.IsBold = true;

// 斜体
font.IsItalic = true;

// 下划线
font.Underline = FontUnderlineType.Single;
// FontUnderlineType: None, Single, Double, SingleAccounting, DoubleAccounting

// 删除线
font.IsStrikeout = true;

// 上标/下标
font.TypeOffset = FontSuperScript.Super;  // 上标
font.TypeOffset = FontSuperScript.Sub;    // 下标
font.TypeOffset = FontSuperScript.None;   // 正常

// 创建样式并应用字体
ICellStyle style = workbook.CreateCellStyle();
style.SetFont(font);
```

### 5.2.2 字体颜色

```csharp
// 使用索引颜色（兼容性好）
font.Color = IndexedColors.Red.Index;
font.Color = IndexedColors.Blue.Index;
font.Color = IndexedColors.Green.Index;

// 常用索引颜色
var colors = new Dictionary<string, short>
{
    { "黑色", IndexedColors.Black.Index },
    { "白色", IndexedColors.White.Index },
    { "红色", IndexedColors.Red.Index },
    { "绿色", IndexedColors.Green.Index },
    { "蓝色", IndexedColors.Blue.Index },
    { "黄色", IndexedColors.Yellow.Index },
    { "橙色", IndexedColors.Orange.Index },
    { "紫色", IndexedColors.Violet.Index },
    { "灰色", IndexedColors.Grey50Percent.Index },
    { "深灰", IndexedColors.Grey80Percent.Index },
    { "浅灰", IndexedColors.Grey25Percent.Index }
};

// 使用自定义RGB颜色（仅XSSF支持）
XSSFFont xssfFont = (XSSFFont)workbook.CreateFont();
xssfFont.SetColor(new XSSFColor(new byte[] { 255, 128, 0 }));  // 橙色 RGB
```

### 5.2.3 字体工厂类

```csharp
/// <summary>
/// 字体工厂类
/// </summary>
public class FontFactory
{
    private readonly IWorkbook _workbook;
    private readonly Dictionary<string, IFont> _fontCache = new();
    
    public FontFactory(IWorkbook workbook)
    {
        _workbook = workbook;
    }
    
    /// <summary>
    /// 获取或创建字体
    /// </summary>
    public IFont GetFont(
        string fontName = "宋体",
        short fontSize = 11,
        bool isBold = false,
        bool isItalic = false,
        short color = 0,
        FontUnderlineType underline = FontUnderlineType.None)
    {
        string key = $"{fontName}_{fontSize}_{isBold}_{isItalic}_{color}_{underline}";
        
        if (!_fontCache.TryGetValue(key, out IFont font))
        {
            font = _workbook.CreateFont();
            font.FontName = fontName;
            font.FontHeightInPoints = fontSize;
            font.IsBold = isBold;
            font.IsItalic = isItalic;
            if (color > 0) font.Color = color;
            font.Underline = underline;
            
            _fontCache[key] = font;
        }
        
        return font;
    }
    
    /// <summary>
    /// 创建标题字体
    /// </summary>
    public IFont CreateTitleFont(short fontSize = 16)
    {
        return GetFont("微软雅黑", fontSize, true, false);
    }
    
    /// <summary>
    /// 创建正文字体
    /// </summary>
    public IFont CreateBodyFont()
    {
        return GetFont("宋体", 11, false, false);
    }
    
    /// <summary>
    /// 创建链接字体
    /// </summary>
    public IFont CreateLinkFont()
    {
        return GetFont("宋体", 11, false, false, 
            IndexedColors.Blue.Index, FontUnderlineType.Single);
    }
}
```

## 5.3 对齐方式

### 5.3.1 水平对齐

```csharp
ICellStyle style = workbook.CreateCellStyle();

// 水平对齐方式
style.Alignment = HorizontalAlignment.Left;      // 左对齐
style.Alignment = HorizontalAlignment.Center;    // 居中
style.Alignment = HorizontalAlignment.Right;     // 右对齐
style.Alignment = HorizontalAlignment.Justify;   // 两端对齐
style.Alignment = HorizontalAlignment.Fill;      // 填充
style.Alignment = HorizontalAlignment.General;   // 常规（默认）
style.Alignment = HorizontalAlignment.CenterSelection;  // 跨列居中
style.Alignment = HorizontalAlignment.Distributed;       // 分散对齐
```

### 5.3.2 垂直对齐

```csharp
// 垂直对齐方式
style.VerticalAlignment = VerticalAlignment.Top;       // 顶端对齐
style.VerticalAlignment = VerticalAlignment.Center;    // 居中
style.VerticalAlignment = VerticalAlignment.Bottom;    // 底端对齐
style.VerticalAlignment = VerticalAlignment.Justify;   // 两端对齐
style.VerticalAlignment = VerticalAlignment.Distributed; // 分散对齐
```

### 5.3.3 文本控制

```csharp
// 自动换行
style.WrapText = true;

// 文本旋转角度（-90 到 90 度）
style.Rotation = 45;  // 旋转45度

// 缩进级别
style.Indention = 2;  // 缩进2个字符

// 缩小字体填充
style.ShrinkToFit = true;
```

### 5.3.4 对齐方式示例

```csharp
public static void CreateAlignmentDemo(IWorkbook workbook)
{
    ISheet sheet = workbook.CreateSheet("对齐示例");
    
    // 设置列宽
    sheet.SetColumnWidth(0, 20 * 256);
    sheet.SetColumnWidth(1, 30 * 256);
    
    string[] alignments = { "左对齐", "居中", "右对齐", "两端对齐", "分散对齐" };
    HorizontalAlignment[] hAligns = {
        HorizontalAlignment.Left,
        HorizontalAlignment.Center,
        HorizontalAlignment.Right,
        HorizontalAlignment.Justify,
        HorizontalAlignment.Distributed
    };
    
    for (int i = 0; i < alignments.Length; i++)
    {
        IRow row = sheet.CreateRow(i);
        row.HeightInPoints = 30;
        
        // 标签
        ICell labelCell = row.CreateCell(0);
        labelCell.SetCellValue(alignments[i]);
        
        // 示例
        ICell demoCell = row.CreateCell(1);
        demoCell.SetCellValue("这是示例文本 This is sample text");
        
        ICellStyle style = workbook.CreateCellStyle();
        style.Alignment = hAligns[i];
        style.VerticalAlignment = VerticalAlignment.Center;
        style.WrapText = true;
        demoCell.CellStyle = style;
    }
}
```

## 5.4 边框设置

### 5.4.1 边框样式

```csharp
ICellStyle style = workbook.CreateCellStyle();

// 设置四边边框样式
style.BorderTop = BorderStyle.Thin;
style.BorderBottom = BorderStyle.Thin;
style.BorderLeft = BorderStyle.Thin;
style.BorderRight = BorderStyle.Thin;

// 边框样式枚举
public enum BorderStyle
{
    None,           // 无边框
    Thin,           // 细线
    Medium,         // 中等
    Dashed,         // 虚线
    Dotted,         // 点线
    Thick,          // 粗线
    Double,         // 双线
    Hair,           // 发丝线
    MediumDashed,   // 中等虚线
    DashDot,        // 点划线
    MediumDashDot,  // 中等点划线
    DashDotDot,     // 双点划线
    MediumDashDotDot, // 中等双点划线
    SlantedDashDot  // 斜点划线
}
```

### 5.4.2 边框颜色

```csharp
// 设置边框颜色
style.TopBorderColor = IndexedColors.Black.Index;
style.BottomBorderColor = IndexedColors.Black.Index;
style.LeftBorderColor = IndexedColors.Red.Index;
style.RightBorderColor = IndexedColors.Red.Index;

// XSSF支持自定义RGB颜色
XSSFCellStyle xssfStyle = (XSSFCellStyle)workbook.CreateCellStyle();
xssfStyle.SetBorderColor(BorderSide.TOP, 
    new XSSFColor(new byte[] { 0, 128, 0 }));  // 绿色
```

### 5.4.3 边框辅助方法

```csharp
/// <summary>
/// 边框设置辅助类
/// </summary>
public static class BorderHelper
{
    /// <summary>
    /// 设置所有边框
    /// </summary>
    public static void SetAllBorders(ICellStyle style, BorderStyle borderStyle, 
        short color = 0)
    {
        style.BorderTop = borderStyle;
        style.BorderBottom = borderStyle;
        style.BorderLeft = borderStyle;
        style.BorderRight = borderStyle;
        
        if (color > 0)
        {
            style.TopBorderColor = color;
            style.BottomBorderColor = color;
            style.LeftBorderColor = color;
            style.RightBorderColor = color;
        }
    }
    
    /// <summary>
    /// 为区域设置外边框
    /// </summary>
    public static void SetRegionBorder(ISheet sheet, CellRangeAddress region,
        BorderStyle borderStyle, short color, IWorkbook workbook)
    {
        // 上边框
        for (int col = region.FirstColumn; col <= region.LastColumn; col++)
        {
            IRow row = sheet.GetRow(region.FirstRow) ?? sheet.CreateRow(region.FirstRow);
            ICell cell = row.GetCell(col) ?? row.CreateCell(col);
            ICellStyle style = workbook.CreateCellStyle();
            if (cell.CellStyle != null) style.CloneStyleFrom(cell.CellStyle);
            style.BorderTop = borderStyle;
            style.TopBorderColor = color;
            cell.CellStyle = style;
        }
        
        // 下边框
        for (int col = region.FirstColumn; col <= region.LastColumn; col++)
        {
            IRow row = sheet.GetRow(region.LastRow) ?? sheet.CreateRow(region.LastRow);
            ICell cell = row.GetCell(col) ?? row.CreateCell(col);
            ICellStyle style = workbook.CreateCellStyle();
            if (cell.CellStyle != null) style.CloneStyleFrom(cell.CellStyle);
            style.BorderBottom = borderStyle;
            style.BottomBorderColor = color;
            cell.CellStyle = style;
        }
        
        // 左边框
        for (int r = region.FirstRow; r <= region.LastRow; r++)
        {
            IRow row = sheet.GetRow(r) ?? sheet.CreateRow(r);
            ICell cell = row.GetCell(region.FirstColumn) ?? 
                row.CreateCell(region.FirstColumn);
            ICellStyle style = workbook.CreateCellStyle();
            if (cell.CellStyle != null) style.CloneStyleFrom(cell.CellStyle);
            style.BorderLeft = borderStyle;
            style.LeftBorderColor = color;
            cell.CellStyle = style;
        }
        
        // 右边框
        for (int r = region.FirstRow; r <= region.LastRow; r++)
        {
            IRow row = sheet.GetRow(r) ?? sheet.CreateRow(r);
            ICell cell = row.GetCell(region.LastColumn) ?? 
                row.CreateCell(region.LastColumn);
            ICellStyle style = workbook.CreateCellStyle();
            if (cell.CellStyle != null) style.CloneStyleFrom(cell.CellStyle);
            style.BorderRight = borderStyle;
            style.RightBorderColor = color;
            cell.CellStyle = style;
        }
    }
}
```

## 5.5 填充与背景色

### 5.5.1 填充模式

```csharp
ICellStyle style = workbook.CreateCellStyle();

// 设置填充模式
style.FillPattern = FillPattern.SolidForeground;  // 纯色填充

// 填充模式枚举
public enum FillPattern
{
    NoFill,           // 无填充
    SolidForeground,  // 纯色填充
    FineDots,         // 细点
    AltBars,          // 交替条纹
    SparseDots,       // 稀疏点
    ThickHorizontalBands,  // 粗水平条纹
    ThickVerticalBands,    // 粗垂直条纹
    ThickBackwardDiagonals, // 粗反向对角线
    ThickForwardDiagonals,  // 粗正向对角线
    BigSpots,         // 大斑点
    Bricks,           // 砖块
    ThinHorizontalBands,   // 细水平条纹
    ThinVerticalBands,     // 细垂直条纹
    ThinBackwardDiagonals, // 细反向对角线
    ThinForwardDiagonals,  // 细正向对角线
    Squares,          // 方格
    Diamonds,         // 菱形
    LessDots,         // 较少点
    LeastDots         // 最少点
}
```

### 5.5.2 填充颜色

```csharp
// 使用索引颜色
style.FillForegroundColor = IndexedColors.LightBlue.Index;
style.FillPattern = FillPattern.SolidForeground;

// 设置前景色和背景色（用于图案填充）
style.FillForegroundColor = IndexedColors.Red.Index;
style.FillBackgroundColor = IndexedColors.Yellow.Index;
style.FillPattern = FillPattern.ThinHorizontalBands;

// XSSF支持自定义RGB颜色
XSSFCellStyle xssfStyle = (XSSFCellStyle)workbook.CreateCellStyle();
xssfStyle.FillPattern = FillPattern.SolidForeground;
xssfStyle.SetFillForegroundColor(new XSSFColor(new byte[] { 200, 230, 255 }));
```

### 5.5.3 常用颜色配色方案

```csharp
/// <summary>
/// 颜色配色方案
/// </summary>
public static class ColorSchemes
{
    // 表头颜色
    public static readonly short HeaderBlue = IndexedColors.LightBlue.Index;
    public static readonly short HeaderGreen = IndexedColors.LightGreen.Index;
    public static readonly short HeaderGrey = IndexedColors.Grey25Percent.Index;
    
    // 交替行颜色
    public static readonly short AlternateRow1 = IndexedColors.White.Index;
    public static readonly short AlternateRow2 = IndexedColors.Grey25Percent.Index;
    
    // 状态颜色
    public static readonly short Success = IndexedColors.LightGreen.Index;
    public static readonly short Warning = IndexedColors.LightYellow.Index;
    public static readonly short Error = IndexedColors.Rose.Index;
    
    // 自定义RGB颜色（XSSF）
    public static XSSFColor CreateColor(int r, int g, int b)
    {
        return new XSSFColor(new byte[] { (byte)r, (byte)g, (byte)b });
    }
    
    // 预定义RGB颜色
    public static readonly XSSFColor SoftBlue = CreateColor(173, 216, 230);
    public static readonly XSSFColor SoftGreen = CreateColor(144, 238, 144);
    public static readonly XSSFColor SoftYellow = CreateColor(255, 255, 224);
    public static readonly XSSFColor SoftPink = CreateColor(255, 182, 193);
}
```

## 5.6 数字格式

### 5.6.1 内置数字格式

```csharp
ICellStyle style = workbook.CreateCellStyle();
IDataFormat format = workbook.CreateDataFormat();

// 常用内置格式
style.DataFormat = format.GetFormat("General");     // 常规
style.DataFormat = format.GetFormat("0");           // 整数
style.DataFormat = format.GetFormat("0.00");        // 两位小数
style.DataFormat = format.GetFormat("#,##0");       // 千位分隔符
style.DataFormat = format.GetFormat("#,##0.00");    // 千位分隔符+两位小数
style.DataFormat = format.GetFormat("0%");          // 百分比整数
style.DataFormat = format.GetFormat("0.00%");       // 百分比两位小数
style.DataFormat = format.GetFormat("$#,##0.00");   // 美元
style.DataFormat = format.GetFormat("¥#,##0.00");   // 人民币
style.DataFormat = format.GetFormat("@");           // 文本
```

### 5.6.2 日期时间格式

```csharp
// 日期格式
style.DataFormat = format.GetFormat("yyyy-MM-dd");
style.DataFormat = format.GetFormat("yyyy/MM/dd");
style.DataFormat = format.GetFormat("yyyy年MM月dd日");
style.DataFormat = format.GetFormat("MM-dd");
style.DataFormat = format.GetFormat("yyyy-MM");

// 时间格式
style.DataFormat = format.GetFormat("HH:mm:ss");
style.DataFormat = format.GetFormat("HH:mm");
style.DataFormat = format.GetFormat("h:mm AM/PM");

// 日期时间格式
style.DataFormat = format.GetFormat("yyyy-MM-dd HH:mm:ss");
style.DataFormat = format.GetFormat("yyyy/MM/dd HH:mm");
```

### 5.6.3 自定义数字格式

```csharp
// 条件格式
// 正数显示绿色，负数显示红色（带括号），零显示横线
style.DataFormat = format.GetFormat("[绿色]#,##0.00;[红色](#,##0.00);-");

// 显示正负号
style.DataFormat = format.GetFormat("+#,##0.00;-#,##0.00;0");

// 四舍五入到千
style.DataFormat = format.GetFormat("#,##0,千元");

// 科学计数法
style.DataFormat = format.GetFormat("0.00E+00");

// 分数
style.DataFormat = format.GetFormat("# ?/?");

// 文本前缀
style.DataFormat = format.GetFormat("\"编号：\"@");

// 数字前补零
style.DataFormat = format.GetFormat("000000");  // 6位数字，不足补零

// 电话号码格式
style.DataFormat = format.GetFormat("000-0000-0000");
```

### 5.6.4 格式化辅助类

```csharp
/// <summary>
/// 数字格式辅助类
/// </summary>
public static class NumberFormatHelper
{
    private static readonly Dictionary<string, short> _formatCache = new();
    
    /// <summary>
    /// 获取格式代码
    /// </summary>
    public static short GetFormat(IWorkbook workbook, string formatString)
    {
        if (!_formatCache.TryGetValue(formatString, out short format))
        {
            IDataFormat dataFormat = workbook.CreateDataFormat();
            format = dataFormat.GetFormat(formatString);
            _formatCache[formatString] = format;
        }
        return format;
    }
    
    // 预定义格式
    public static short Integer(IWorkbook wb) => GetFormat(wb, "0");
    public static short Decimal2(IWorkbook wb) => GetFormat(wb, "0.00");
    public static short Thousands(IWorkbook wb) => GetFormat(wb, "#,##0");
    public static short ThousandsDecimal2(IWorkbook wb) => GetFormat(wb, "#,##0.00");
    public static short Percent(IWorkbook wb) => GetFormat(wb, "0%");
    public static short PercentDecimal2(IWorkbook wb) => GetFormat(wb, "0.00%");
    public static short Currency(IWorkbook wb) => GetFormat(wb, "¥#,##0.00");
    public static short DateOnly(IWorkbook wb) => GetFormat(wb, "yyyy-MM-dd");
    public static short DateTime(IWorkbook wb) => GetFormat(wb, "yyyy-MM-dd HH:mm:ss");
    public static short TimeOnly(IWorkbook wb) => GetFormat(wb, "HH:mm:ss");
    public static short Text(IWorkbook wb) => GetFormat(wb, "@");
}
```

## 5.7 样式管理器

### 5.7.1 完整的样式管理器实现

```csharp
/// <summary>
/// Excel样式管理器
/// </summary>
public class ExcelStyleManager
{
    private readonly IWorkbook _workbook;
    private readonly Dictionary<string, ICellStyle> _styleCache = new();
    private readonly Dictionary<string, IFont> _fontCache = new();
    
    public ExcelStyleManager(IWorkbook workbook)
    {
        _workbook = workbook;
    }
    
    #region 字体管理
    
    /// <summary>
    /// 获取或创建字体
    /// </summary>
    public IFont GetFont(string name = "宋体", short size = 11, 
        bool bold = false, bool italic = false, 
        short color = 0, FontUnderlineType underline = FontUnderlineType.None)
    {
        string key = $"F_{name}_{size}_{bold}_{italic}_{color}_{underline}";
        
        if (!_fontCache.TryGetValue(key, out IFont font))
        {
            font = _workbook.CreateFont();
            font.FontName = name;
            font.FontHeightInPoints = size;
            font.IsBold = bold;
            font.IsItalic = italic;
            if (color > 0) font.Color = color;
            font.Underline = underline;
            _fontCache[key] = font;
        }
        
        return font;
    }
    
    #endregion
    
    #region 预定义样式
    
    /// <summary>
    /// 表头样式
    /// </summary>
    public ICellStyle HeaderStyle
    {
        get
        {
            const string key = "Header";
            if (!_styleCache.TryGetValue(key, out ICellStyle style))
            {
                style = _workbook.CreateCellStyle();
                style.SetFont(GetFont("微软雅黑", 11, true));
                style.Alignment = HorizontalAlignment.Center;
                style.VerticalAlignment = VerticalAlignment.Center;
                style.FillForegroundColor = IndexedColors.Grey25Percent.Index;
                style.FillPattern = FillPattern.SolidForeground;
                BorderHelper.SetAllBorders(style, BorderStyle.Thin, 
                    IndexedColors.Black.Index);
                _styleCache[key] = style;
            }
            return style;
        }
    }
    
    /// <summary>
    /// 正文样式
    /// </summary>
    public ICellStyle BodyStyle
    {
        get
        {
            const string key = "Body";
            if (!_styleCache.TryGetValue(key, out ICellStyle style))
            {
                style = _workbook.CreateCellStyle();
                style.SetFont(GetFont("宋体", 11));
                style.VerticalAlignment = VerticalAlignment.Center;
                BorderHelper.SetAllBorders(style, BorderStyle.Thin, 
                    IndexedColors.Black.Index);
                _styleCache[key] = style;
            }
            return style;
        }
    }
    
    /// <summary>
    /// 标题样式
    /// </summary>
    public ICellStyle TitleStyle
    {
        get
        {
            const string key = "Title";
            if (!_styleCache.TryGetValue(key, out ICellStyle style))
            {
                style = _workbook.CreateCellStyle();
                style.SetFont(GetFont("微软雅黑", 16, true));
                style.Alignment = HorizontalAlignment.Center;
                style.VerticalAlignment = VerticalAlignment.Center;
                _styleCache[key] = style;
            }
            return style;
        }
    }
    
    /// <summary>
    /// 日期样式
    /// </summary>
    public ICellStyle DateStyle
    {
        get
        {
            const string key = "Date";
            if (!_styleCache.TryGetValue(key, out ICellStyle style))
            {
                style = _workbook.CreateCellStyle();
                style.CloneStyleFrom(BodyStyle);
                IDataFormat format = _workbook.CreateDataFormat();
                style.DataFormat = format.GetFormat("yyyy-MM-dd");
                _styleCache[key] = style;
            }
            return style;
        }
    }
    
    /// <summary>
    /// 金额样式
    /// </summary>
    public ICellStyle CurrencyStyle
    {
        get
        {
            const string key = "Currency";
            if (!_styleCache.TryGetValue(key, out ICellStyle style))
            {
                style = _workbook.CreateCellStyle();
                style.CloneStyleFrom(BodyStyle);
                style.Alignment = HorizontalAlignment.Right;
                IDataFormat format = _workbook.CreateDataFormat();
                style.DataFormat = format.GetFormat("¥#,##0.00");
                _styleCache[key] = style;
            }
            return style;
        }
    }
    
    /// <summary>
    /// 百分比样式
    /// </summary>
    public ICellStyle PercentStyle
    {
        get
        {
            const string key = "Percent";
            if (!_styleCache.TryGetValue(key, out ICellStyle style))
            {
                style = _workbook.CreateCellStyle();
                style.CloneStyleFrom(BodyStyle);
                style.Alignment = HorizontalAlignment.Right;
                IDataFormat format = _workbook.CreateDataFormat();
                style.DataFormat = format.GetFormat("0.00%");
                _styleCache[key] = style;
            }
            return style;
        }
    }
    
    /// <summary>
    /// 整数样式
    /// </summary>
    public ICellStyle IntegerStyle
    {
        get
        {
            const string key = "Integer";
            if (!_styleCache.TryGetValue(key, out ICellStyle style))
            {
                style = _workbook.CreateCellStyle();
                style.CloneStyleFrom(BodyStyle);
                style.Alignment = HorizontalAlignment.Right;
                IDataFormat format = _workbook.CreateDataFormat();
                style.DataFormat = format.GetFormat("#,##0");
                _styleCache[key] = style;
            }
            return style;
        }
    }
    
    #endregion
    
    #region 自定义样式构建器
    
    /// <summary>
    /// 创建自定义样式
    /// </summary>
    public StyleBuilder CreateStyle()
    {
        return new StyleBuilder(this, _workbook.CreateCellStyle());
    }
    
    /// <summary>
    /// 基于现有样式创建
    /// </summary>
    public StyleBuilder CreateStyleFrom(ICellStyle baseStyle)
    {
        ICellStyle newStyle = _workbook.CreateCellStyle();
        newStyle.CloneStyleFrom(baseStyle);
        return new StyleBuilder(this, newStyle);
    }
    
    #endregion
}

/// <summary>
/// 样式构建器（流式API）
/// </summary>
public class StyleBuilder
{
    private readonly ExcelStyleManager _manager;
    private readonly ICellStyle _style;
    
    internal StyleBuilder(ExcelStyleManager manager, ICellStyle style)
    {
        _manager = manager;
        _style = style;
    }
    
    public StyleBuilder Font(string name = "宋体", short size = 11, 
        bool bold = false, bool italic = false, short color = 0)
    {
        _style.SetFont(_manager.GetFont(name, size, bold, italic, color));
        return this;
    }
    
    public StyleBuilder HorizontalAlign(HorizontalAlignment align)
    {
        _style.Alignment = align;
        return this;
    }
    
    public StyleBuilder VerticalAlign(VerticalAlignment align)
    {
        _style.VerticalAlignment = align;
        return this;
    }
    
    public StyleBuilder Center()
    {
        _style.Alignment = HorizontalAlignment.Center;
        _style.VerticalAlignment = VerticalAlignment.Center;
        return this;
    }
    
    public StyleBuilder WrapText(bool wrap = true)
    {
        _style.WrapText = wrap;
        return this;
    }
    
    public StyleBuilder Border(BorderStyle borderStyle, short color = 0)
    {
        BorderHelper.SetAllBorders(_style, borderStyle, 
            color > 0 ? color : IndexedColors.Black.Index);
        return this;
    }
    
    public StyleBuilder Background(short color)
    {
        _style.FillForegroundColor = color;
        _style.FillPattern = FillPattern.SolidForeground;
        return this;
    }
    
    public StyleBuilder DataFormat(string format, IWorkbook workbook)
    {
        IDataFormat df = workbook.CreateDataFormat();
        _style.DataFormat = df.GetFormat(format);
        return this;
    }
    
    public ICellStyle Build()
    {
        return _style;
    }
}
```

## 5.8 条件格式

### 5.8.1 基于值的条件格式

```csharp
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;

public static void ApplyConditionalFormatting(ISheet sheet, IWorkbook workbook)
{
    ISheetConditionalFormatting cf = sheet.SheetConditionalFormatting;
    
    // 定义应用范围
    CellRangeAddress[] ranges = { CellRangeAddress.ValueOf("B2:B100") };
    
    // 创建条件规则：大于80显示绿色
    IConditionalFormattingRule rule1 = cf.CreateConditionalFormattingRule(
        ComparisonOperator.GreaterThan, "80", null);
    
    IPatternFormatting pf1 = rule1.CreatePatternFormatting();
    pf1.FillBackgroundColor = IndexedColors.LightGreen.Index;
    pf1.FillPattern = FillPattern.SolidForeground;
    
    // 创建条件规则：小于60显示红色
    IConditionalFormattingRule rule2 = cf.CreateConditionalFormattingRule(
        ComparisonOperator.LessThan, "60", null);
    
    IPatternFormatting pf2 = rule2.CreatePatternFormatting();
    pf2.FillBackgroundColor = IndexedColors.Rose.Index;
    pf2.FillPattern = FillPattern.SolidForeground;
    
    // 应用条件格式
    cf.AddConditionalFormatting(ranges, new[] { rule1, rule2 });
}
```

### 5.8.2 数据条

```csharp
public static void ApplyDataBar(ISheet sheet)
{
    XSSFSheetConditionalFormatting cf = 
        (XSSFSheetConditionalFormatting)sheet.SheetConditionalFormatting;
    
    CellRangeAddress[] ranges = { CellRangeAddress.ValueOf("C2:C100") };
    
    // 创建数据条规则
    XSSFConditionalFormattingRule rule = 
        (XSSFConditionalFormattingRule)cf.CreateConditionalFormattingRule(
            ComparisonOperator.Between, "0", "100");
    
    XSSFDataBarFormatting dataBar = (XSSFDataBarFormatting)rule.DataBarFormatting;
    if (dataBar != null)
    {
        dataBar.Color = new XSSFColor(new byte[] { 99, 190, 123 });  // 绿色
    }
    
    cf.AddConditionalFormatting(ranges, rule);
}
```

### 5.8.3 图标集

```csharp
public static void ApplyIconSet(XSSFSheet sheet)
{
    XSSFSheetConditionalFormatting cf = 
        (XSSFSheetConditionalFormatting)sheet.SheetConditionalFormatting;
    
    CellRangeAddress[] ranges = { CellRangeAddress.ValueOf("D2:D100") };
    
    // 这需要直接操作XML，NPOI对图标集的支持有限
    // 建议使用Excel模板预设图标集条件格式
}
```

## 5.9 综合示例

### 5.9.1 创建格式化报表

```csharp
using NPOI.SS.UserModel;
using NPOI.XSSF.UserModel;
using NPOI.SS.Util;
using System;
using System.IO;

public class FormattedReportExample
{
    public static void CreateSalesReport()
    {
        IWorkbook workbook = new XSSFWorkbook();
        var styleManager = new ExcelStyleManager(workbook);
        ISheet sheet = workbook.CreateSheet("销售报表");
        
        int rowIndex = 0;
        
        // 1. 创建报表标题
        IRow titleRow = sheet.CreateRow(rowIndex++);
        titleRow.HeightInPoints = 30;
        ICell titleCell = titleRow.CreateCell(0);
        titleCell.SetCellValue("2024年第一季度销售报表");
        titleCell.CellStyle = styleManager.TitleStyle;
        sheet.AddMergedRegion(new CellRangeAddress(0, 0, 0, 5));
        
        // 空行
        rowIndex++;
        
        // 2. 创建表头
        IRow headerRow = sheet.CreateRow(rowIndex++);
        headerRow.HeightInPoints = 25;
        string[] headers = { "序号", "产品名称", "销售数量", "单价", "销售额", "占比" };
        for (int i = 0; i < headers.Length; i++)
        {
            ICell cell = headerRow.CreateCell(i);
            cell.SetCellValue(headers[i]);
            cell.CellStyle = styleManager.HeaderStyle;
        }
        
        // 3. 创建数据行
        var salesData = new[]
        {
            new { Name = "产品A", Quantity = 1500, UnitPrice = 99.99m },
            new { Name = "产品B", Quantity = 2300, UnitPrice = 149.99m },
            new { Name = "产品C", Quantity = 800, UnitPrice = 299.99m },
            new { Name = "产品D", Quantity = 3200, UnitPrice = 49.99m },
            new { Name = "产品E", Quantity = 1100, UnitPrice = 199.99m }
        };
        
        decimal totalSales = salesData.Sum(x => x.Quantity * x.UnitPrice);
        
        for (int i = 0; i < salesData.Length; i++)
        {
            IRow row = sheet.CreateRow(rowIndex++);
            var data = salesData[i];
            decimal sales = data.Quantity * data.UnitPrice;
            
            // 序号
            row.CreateCell(0).SetCellValue(i + 1);
            row.GetCell(0).CellStyle = styleManager.BodyStyle;
            
            // 产品名称
            row.CreateCell(1).SetCellValue(data.Name);
            row.GetCell(1).CellStyle = styleManager.BodyStyle;
            
            // 销售数量
            row.CreateCell(2).SetCellValue(data.Quantity);
            row.GetCell(2).CellStyle = styleManager.IntegerStyle;
            
            // 单价
            row.CreateCell(3).SetCellValue((double)data.UnitPrice);
            row.GetCell(3).CellStyle = styleManager.CurrencyStyle;
            
            // 销售额
            row.CreateCell(4).SetCellValue((double)sales);
            row.GetCell(4).CellStyle = styleManager.CurrencyStyle;
            
            // 占比
            row.CreateCell(5).SetCellValue((double)(sales / totalSales));
            row.GetCell(5).CellStyle = styleManager.PercentStyle;
        }
        
        // 4. 创建汇总行
        IRow summaryRow = sheet.CreateRow(rowIndex++);
        ICell summaryLabel = summaryRow.CreateCell(0);
        summaryLabel.SetCellValue("合计");
        
        ICellStyle summaryStyle = styleManager.CreateStyleFrom(styleManager.BodyStyle)
            .Font("宋体", 11, true)
            .Background(IndexedColors.LightYellow.Index)
            .Build();
        
        summaryLabel.CellStyle = summaryStyle;
        sheet.AddMergedRegion(new CellRangeAddress(rowIndex - 1, rowIndex - 1, 0, 1));
        
        // 数量合计
        ICell sumQuantity = summaryRow.CreateCell(2);
        sumQuantity.SetCellFormula($"SUM(C4:C{rowIndex - 1})");
        ICellStyle summaryIntStyle = workbook.CreateCellStyle();
        summaryIntStyle.CloneStyleFrom(styleManager.IntegerStyle);
        summaryIntStyle.FillForegroundColor = IndexedColors.LightYellow.Index;
        summaryIntStyle.FillPattern = FillPattern.SolidForeground;
        IFont boldFont = workbook.CreateFont();
        boldFont.IsBold = true;
        summaryIntStyle.SetFont(boldFont);
        sumQuantity.CellStyle = summaryIntStyle;
        
        // 空单元格
        summaryRow.CreateCell(3).CellStyle = summaryStyle;
        
        // 销售额合计
        ICell sumSales = summaryRow.CreateCell(4);
        sumSales.SetCellFormula($"SUM(E4:E{rowIndex - 1})");
        ICellStyle summaryCurrencyStyle = workbook.CreateCellStyle();
        summaryCurrencyStyle.CloneStyleFrom(styleManager.CurrencyStyle);
        summaryCurrencyStyle.FillForegroundColor = IndexedColors.LightYellow.Index;
        summaryCurrencyStyle.FillPattern = FillPattern.SolidForeground;
        summaryCurrencyStyle.SetFont(boldFont);
        sumSales.CellStyle = summaryCurrencyStyle;
        
        // 占比合计
        ICell sumPercent = summaryRow.CreateCell(5);
        sumPercent.SetCellFormula($"SUM(F4:F{rowIndex - 1})");
        ICellStyle summaryPercentStyle = workbook.CreateCellStyle();
        summaryPercentStyle.CloneStyleFrom(styleManager.PercentStyle);
        summaryPercentStyle.FillForegroundColor = IndexedColors.LightYellow.Index;
        summaryPercentStyle.FillPattern = FillPattern.SolidForeground;
        summaryPercentStyle.SetFont(boldFont);
        sumPercent.CellStyle = summaryPercentStyle;
        
        // 5. 设置列宽
        sheet.SetColumnWidth(0, 8 * 256);   // 序号
        sheet.SetColumnWidth(1, 15 * 256);  // 产品名称
        sheet.SetColumnWidth(2, 12 * 256);  // 销售数量
        sheet.SetColumnWidth(3, 12 * 256);  // 单价
        sheet.SetColumnWidth(4, 15 * 256);  // 销售额
        sheet.SetColumnWidth(5, 10 * 256);  // 占比
        
        // 6. 冻结首行
        sheet.CreateFreezePane(0, 3);
        
        // 7. 保存文件
        using (FileStream fs = new FileStream("销售报表.xlsx", FileMode.Create))
        {
            workbook.Write(fs);
        }
        
        Console.WriteLine("格式化报表创建成功！");
    }
}
```

## 5.10 本章小结

本章详细介绍了NPOI中的样式和格式化功能。通过本章学习，你应该掌握：

- 样式对象的结构和复用机制
- 字体的各种属性设置（名称、大小、颜色、加粗、斜体等）
- 对齐方式（水平、垂直、文本换行、旋转）
- 边框设置（样式、颜色、区域边框）
- 填充和背景色设置
- 数字格式（内置格式、日期格式、自定义格式）
- 样式管理器的设计和使用
- 条件格式的基本应用

样式和格式化是创建专业Excel报表的关键，合理使用样式缓存可以提高性能并避免样式数量限制问题。

---

> **下一章预告**：第六章将介绍Excel公式与函数，包括公式的插入、引用、求值和常用函数的使用。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第04章-Excel单元格操作与数据类型" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第06章-Excel公式与函数" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

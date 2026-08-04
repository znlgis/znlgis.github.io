---
layout: default
title: 第八章：Excel图表与图形
---

# 第八章：Excel图表与图形

## 8.1 图表基础

### 8.1.1 NPOI图表支持概述

NPOI支持在Excel中创建各种类型的图表，主要通过XSSF（.xlsx格式）实现。支持的图表类型包括：

- 柱形图（Column Chart）
- 条形图（Bar Chart）
- 折线图（Line Chart）
- 饼图（Pie Chart）
- 散点图（Scatter Chart）
- 面积图（Area Chart）

### 8.1.2 创建图表的基本步骤

```csharp
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;
using NPOI.SS.UserModel.Charts;

// 1. 创建工作簿和工作表
XSSFWorkbook workbook = new XSSFWorkbook();
XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("图表示例");

// 2. 创建数据
// ... 填充数据 ...

// 3. 创建绘图对象
XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();

// 4. 定义图表位置
XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
    0, 0, 0, 0,    // dx1, dy1, dx2, dy2（偏移量）
    5, 1, 15, 15); // col1, row1, col2, row2（位置）

// 5. 创建图表
XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
```

## 8.2 柱形图

### 8.2.1 创建简单柱形图

```csharp
using NPOI.SS.UserModel;
using NPOI.SS.Util;
using NPOI.XSSF.UserModel;
using NPOI.XSSF.UserModel.Charts;
using NPOI.SS.UserModel.Charts;

public static void CreateColumnChart()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("柱形图");
    
    // 创建数据
    string[] categories = { "一月", "二月", "三月", "四月", "五月" };
    double[] values = { 1000, 1500, 1200, 1800, 2000 };
    
    // 填充数据
    IRow headerRow = sheet.CreateRow(0);
    headerRow.CreateCell(0).SetCellValue("月份");
    headerRow.CreateCell(1).SetCellValue("销售额");
    
    for (int i = 0; i < categories.Length; i++)
    {
        IRow row = sheet.CreateRow(i + 1);
        row.CreateCell(0).SetCellValue(categories[i]);
        row.CreateCell(1).SetCellValue(values[i]);
    }
    
    // 创建绘图对象
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    
    // 定义图表位置
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 3, 1, 12, 15);
    
    // 创建图表
    XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
    chart.SetTitle("月度销售额");
    
    // 创建图表数据
    IChartLegend legend = chart.GetOrCreateLegend();
    legend.Position = LegendPosition.Bottom;
    
    // 定义数据范围
    IChartDataSource<string> categorySource = DataSources.FromStringCellRange(
        sheet, new CellRangeAddress(1, 5, 0, 0));
    IChartDataSource<double> valueSource = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 5, 1, 1));
    
    // 创建柱形图数据
    IBarChartData<string, double> data = chart.ChartDataFactory.CreateBarChartData<string, double>();
    
    // 添加数据系列
    IBarChartSeries<string, double> series = data.AddSeries(categorySource, valueSource);
    series.SetTitle("销售额");
    
    // 创建图表轴
    IChartAxis bottomAxis = chart.ChartAxisFactory.CreateCategoryAxis(AxisPosition.Bottom);
    IValueAxis leftAxis = chart.ChartAxisFactory.CreateValueAxis(AxisPosition.Left);
    leftAxis.Crosses = AxisCrosses.AutoZero;
    
    // 绑定数据和轴
    chart.Plot(data, bottomAxis, leftAxis);
    
    // 保存
    using (FileStream fs = new FileStream("柱形图.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

### 8.2.2 创建多系列柱形图

```csharp
public static void CreateMultiSeriesColumnChart()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("多系列柱形图");
    
    // 创建数据
    string[] months = { "一月", "二月", "三月", "四月" };
    double[] product1Sales = { 1000, 1500, 1200, 1800 };
    double[] product2Sales = { 800, 1200, 1500, 1600 };
    double[] product3Sales = { 600, 900, 1100, 1400 };
    
    // 填充数据
    IRow headerRow = sheet.CreateRow(0);
    headerRow.CreateCell(0).SetCellValue("月份");
    headerRow.CreateCell(1).SetCellValue("产品A");
    headerRow.CreateCell(2).SetCellValue("产品B");
    headerRow.CreateCell(3).SetCellValue("产品C");
    
    for (int i = 0; i < months.Length; i++)
    {
        IRow row = sheet.CreateRow(i + 1);
        row.CreateCell(0).SetCellValue(months[i]);
        row.CreateCell(1).SetCellValue(product1Sales[i]);
        row.CreateCell(2).SetCellValue(product2Sales[i]);
        row.CreateCell(3).SetCellValue(product3Sales[i]);
    }
    
    // 创建图表
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 5, 1, 15, 15);
    XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
    chart.SetTitle("产品销售对比");
    
    // 图例
    IChartLegend legend = chart.GetOrCreateLegend();
    legend.Position = LegendPosition.Bottom;
    
    // 数据源
    IChartDataSource<string> categorySource = DataSources.FromStringCellRange(
        sheet, new CellRangeAddress(1, 4, 0, 0));
    IChartDataSource<double> value1Source = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 4, 1, 1));
    IChartDataSource<double> value2Source = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 4, 2, 2));
    IChartDataSource<double> value3Source = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 4, 3, 3));
    
    // 创建图表数据
    IBarChartData<string, double> data = chart.ChartDataFactory.CreateBarChartData<string, double>();
    
    // 添加多个系列
    data.AddSeries(categorySource, value1Source).SetTitle("产品A");
    data.AddSeries(categorySource, value2Source).SetTitle("产品B");
    data.AddSeries(categorySource, value3Source).SetTitle("产品C");
    
    // 创建轴
    IChartAxis bottomAxis = chart.ChartAxisFactory.CreateCategoryAxis(AxisPosition.Bottom);
    IValueAxis leftAxis = chart.ChartAxisFactory.CreateValueAxis(AxisPosition.Left);
    
    chart.Plot(data, bottomAxis, leftAxis);
    
    // 保存
    using (FileStream fs = new FileStream("多系列柱形图.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

## 8.3 折线图

### 8.3.1 创建折线图

```csharp
public static void CreateLineChart()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("折线图");
    
    // 创建数据
    string[] months = { "1月", "2月", "3月", "4月", "5月", "6月" };
    double[] sales = { 1000, 1200, 1100, 1500, 1400, 1800 };
    
    // 填充数据
    IRow headerRow = sheet.CreateRow(0);
    headerRow.CreateCell(0).SetCellValue("月份");
    headerRow.CreateCell(1).SetCellValue("销售额");
    
    for (int i = 0; i < months.Length; i++)
    {
        IRow row = sheet.CreateRow(i + 1);
        row.CreateCell(0).SetCellValue(months[i]);
        row.CreateCell(1).SetCellValue(sales[i]);
    }
    
    // 创建图表
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 3, 1, 13, 15);
    XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
    chart.SetTitle("销售趋势");
    
    // 图例
    IChartLegend legend = chart.GetOrCreateLegend();
    legend.Position = LegendPosition.Bottom;
    
    // 数据源
    IChartDataSource<string> categorySource = DataSources.FromStringCellRange(
        sheet, new CellRangeAddress(1, 6, 0, 0));
    IChartDataSource<double> valueSource = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 6, 1, 1));
    
    // 创建折线图数据
    ILineChartData<string, double> data = chart.ChartDataFactory.CreateLineChartData<string, double>();
    
    // 添加系列
    ILineChartSeries<string, double> series = data.AddSeries(categorySource, valueSource);
    series.SetTitle("销售额");
    
    // 创建轴
    IChartAxis bottomAxis = chart.ChartAxisFactory.CreateCategoryAxis(AxisPosition.Bottom);
    IValueAxis leftAxis = chart.ChartAxisFactory.CreateValueAxis(AxisPosition.Left);
    
    chart.Plot(data, bottomAxis, leftAxis);
    
    // 保存
    using (FileStream fs = new FileStream("折线图.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

## 8.4 饼图

### 8.4.1 创建饼图

```csharp
public static void CreatePieChart()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("饼图");
    
    // 创建数据
    string[] categories = { "产品A", "产品B", "产品C", "产品D", "产品E" };
    double[] values = { 30, 25, 20, 15, 10 };
    
    // 填充数据
    IRow headerRow = sheet.CreateRow(0);
    headerRow.CreateCell(0).SetCellValue("产品");
    headerRow.CreateCell(1).SetCellValue("占比");
    
    for (int i = 0; i < categories.Length; i++)
    {
        IRow row = sheet.CreateRow(i + 1);
        row.CreateCell(0).SetCellValue(categories[i]);
        row.CreateCell(1).SetCellValue(values[i]);
    }
    
    // 创建图表
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 3, 1, 12, 15);
    XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
    chart.SetTitle("产品销售占比");
    
    // 图例
    IChartLegend legend = chart.GetOrCreateLegend();
    legend.Position = LegendPosition.Right;
    
    // 数据源
    IChartDataSource<string> categorySource = DataSources.FromStringCellRange(
        sheet, new CellRangeAddress(1, 5, 0, 0));
    IChartDataSource<double> valueSource = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 5, 1, 1));
    
    // 创建饼图数据
    IPieChartData<string, double> data = chart.ChartDataFactory.CreatePieChartData<string, double>();
    
    // 添加系列
    data.AddSeries(categorySource, valueSource);
    
    // 绑定数据
    chart.Plot(data);
    
    // 保存
    using (FileStream fs = new FileStream("饼图.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

## 8.5 散点图

### 8.5.1 创建散点图

```csharp
public static void CreateScatterChart()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("散点图");
    
    // 创建数据
    double[] xValues = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
    double[] yValues = { 2.1, 3.8, 5.2, 6.9, 8.3, 10.1, 11.8, 14.2, 15.9, 17.5 };
    
    // 填充数据
    IRow headerRow = sheet.CreateRow(0);
    headerRow.CreateCell(0).SetCellValue("X值");
    headerRow.CreateCell(1).SetCellValue("Y值");
    
    for (int i = 0; i < xValues.Length; i++)
    {
        IRow row = sheet.CreateRow(i + 1);
        row.CreateCell(0).SetCellValue(xValues[i]);
        row.CreateCell(1).SetCellValue(yValues[i]);
    }
    
    // 创建图表
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 3, 1, 13, 15);
    XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
    chart.SetTitle("散点分布");
    
    // 图例
    IChartLegend legend = chart.GetOrCreateLegend();
    legend.Position = LegendPosition.Bottom;
    
    // 数据源
    IChartDataSource<double> xSource = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 10, 0, 0));
    IChartDataSource<double> ySource = DataSources.FromNumericCellRange(
        sheet, new CellRangeAddress(1, 10, 1, 1));
    
    // 创建散点图数据
    IScatterChartData<double, double> data = chart.ChartDataFactory.CreateScatterChartData<double, double>();
    
    // 添加系列
    IScatterChartSeries<double, double> series = data.AddSeries(xSource, ySource);
    series.SetTitle("数据点");
    
    // 创建轴
    IValueAxis bottomAxis = chart.ChartAxisFactory.CreateValueAxis(AxisPosition.Bottom);
    IValueAxis leftAxis = chart.ChartAxisFactory.CreateValueAxis(AxisPosition.Left);
    
    chart.Plot(data, bottomAxis, leftAxis);
    
    // 保存
    using (FileStream fs = new FileStream("散点图.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

## 8.6 插入图片

### 8.6.1 从文件插入图片

```csharp
public static void InsertImageFromFile()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    ISheet sheet = workbook.CreateSheet("图片示例");
    
    // 读取图片文件
    byte[] imageBytes = File.ReadAllBytes("logo.png");
    
    // 添加图片到工作簿
    int pictureIndex = workbook.AddPicture(imageBytes, PictureType.PNG);
    
    // 创建绘图对象
    IDrawing drawing = sheet.CreateDrawingPatriarch();
    
    // 创建锚点（定义图片位置和大小）
    IClientAnchor anchor = workbook.GetCreationHelper().CreateClientAnchor();
    anchor.Col1 = 1;  // 起始列
    anchor.Row1 = 1;  // 起始行
    anchor.Col2 = 5;  // 结束列
    anchor.Row2 = 10; // 结束行
    
    // 创建图片
    IPicture picture = drawing.CreatePicture(anchor, pictureIndex);
    
    // 可选：自适应大小
    // picture.Resize();  // 按原始大小
    // picture.Resize(0.5);  // 缩放50%
    
    // 保存
    using (FileStream fs = new FileStream("图片示例.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

### 8.6.2 从字节数组插入图片

```csharp
public static void InsertImageFromBytes(ISheet sheet, byte[] imageData, 
    PictureType pictureType, int col1, int row1, int col2, int row2)
{
    IWorkbook workbook = sheet.Workbook;
    
    // 添加图片数据
    int pictureIndex = workbook.AddPicture(imageData, pictureType);
    
    // 创建绘图对象
    IDrawing drawing = sheet.CreateDrawingPatriarch();
    
    // 创建锚点
    IClientAnchor anchor = workbook.GetCreationHelper().CreateClientAnchor();
    anchor.Col1 = col1;
    anchor.Row1 = row1;
    anchor.Col2 = col2;
    anchor.Row2 = row2;
    
    // 插入图片
    IPicture picture = drawing.CreatePicture(anchor, pictureIndex);
}
```

### 8.6.3 从Base64字符串插入图片

```csharp
public static void InsertImageFromBase64(ISheet sheet, string base64Image,
    int col, int row)
{
    // 移除可能的data URI前缀
    if (base64Image.Contains(","))
    {
        base64Image = base64Image.Substring(base64Image.IndexOf(",") + 1);
    }
    
    byte[] imageBytes = Convert.FromBase64String(base64Image);
    
    IWorkbook workbook = sheet.Workbook;
    int pictureIndex = workbook.AddPicture(imageBytes, PictureType.PNG);
    
    IDrawing drawing = sheet.CreateDrawingPatriarch();
    IClientAnchor anchor = workbook.GetCreationHelper().CreateClientAnchor();
    
    anchor.Col1 = col;
    anchor.Row1 = row;
    anchor.AnchorType = AnchorType.MoveAndResize;
    
    IPicture picture = drawing.CreatePicture(anchor, pictureIndex);
    picture.Resize();  // 保持原始大小
}
```

### 8.6.4 支持的图片格式

```csharp
// NPOI支持的图片类型
PictureType.EMF;      // Windows增强图元文件
PictureType.WMF;      // Windows图元文件
PictureType.PICT;     // Macintosh PICT
PictureType.JPEG;     // JPEG
PictureType.PNG;      // PNG
PictureType.DIB;      // 设备无关位图
PictureType.GIF;      // GIF
PictureType.TIFF;     // TIFF
PictureType.EPS;      // EPS
PictureType.BMP;      // BMP
PictureType.WPG;      // WPG
```

## 8.7 绘制形状

### 8.7.1 绘制矩形

```csharp
public static void DrawRectangle()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("形状");
    
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    
    // 创建锚点
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 1, 1, 5, 10);
    
    // 创建简单形状
    XSSFSimpleShape shape = drawing.CreateSimpleShape(anchor);
    shape.ShapeType = (int)ShapeTypes.Rect;  // 矩形
    
    // 设置线条样式
    shape.SetLineStyleColor(0, 0, 0);  // 黑色边框
    shape.LineWidth = 2;
    shape.LineStyle = LineStyle.Solid;
    
    // 设置填充颜色
    shape.SetFillColor(173, 216, 230);  // 浅蓝色
    
    // 添加文本
    shape.SetText("这是一个矩形");
    
    // 保存
    using (FileStream fs = new FileStream("形状.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

### 8.7.2 绘制椭圆

```csharp
public static void DrawOval()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("椭圆");
    
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 1, 1, 5, 8);
    
    XSSFSimpleShape oval = drawing.CreateSimpleShape(anchor);
    oval.ShapeType = (int)ShapeTypes.Ellipse;
    oval.SetFillColor(255, 200, 200);  // 浅粉色
    oval.SetLineStyleColor(255, 0, 0);  // 红色边框
    
    // 保存
    using (FileStream fs = new FileStream("椭圆.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

### 8.7.3 绘制线条

```csharp
public static void DrawLine()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("线条");
    
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    
    // 创建连接线
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 1, 1, 8, 8);
    
    XSSFSimpleShape line = drawing.CreateSimpleShape(anchor);
    line.ShapeType = (int)ShapeTypes.Line;
    line.SetLineStyleColor(0, 0, 255);  // 蓝色
    line.LineWidth = 3;
    
    // 保存
    using (FileStream fs = new FileStream("线条.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

### 8.7.4 绘制文本框

```csharp
public static void CreateTextBox()
{
    XSSFWorkbook workbook = new XSSFWorkbook();
    XSSFSheet sheet = (XSSFSheet)workbook.CreateSheet("文本框");
    
    XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
    XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
        0, 0, 0, 0, 1, 1, 6, 5);
    
    XSSFTextBox textBox = drawing.CreateTextbox(anchor);
    textBox.SetText("这是一个文本框\n可以包含多行文本");
    
    // 设置边框
    textBox.SetLineStyleColor(0, 0, 0);
    textBox.LineWidth = 1;
    
    // 设置填充
    textBox.SetFillColor(255, 255, 200);  // 浅黄色背景
    
    // 保存
    using (FileStream fs = new FileStream("文本框.xlsx", FileMode.Create))
    {
        workbook.Write(fs);
    }
}
```

## 8.8 图表辅助类

```csharp
/// <summary>
/// 图表辅助类
/// </summary>
public static class ChartHelper
{
    /// <summary>
    /// 创建柱形图
    /// </summary>
    public static void CreateBarChart(XSSFSheet sheet, string title,
        CellRangeAddress categoryRange, CellRangeAddress valueRange,
        int chartCol1, int chartRow1, int chartCol2, int chartRow2)
    {
        XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
        XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
            0, 0, 0, 0, chartCol1, chartRow1, chartCol2, chartRow2);
        
        XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
        chart.SetTitle(title);
        
        IChartLegend legend = chart.GetOrCreateLegend();
        legend.Position = LegendPosition.Bottom;
        
        IChartDataSource<string> categorySource = DataSources.FromStringCellRange(
            sheet, categoryRange);
        IChartDataSource<double> valueSource = DataSources.FromNumericCellRange(
            sheet, valueRange);
        
        IBarChartData<string, double> data = chart.ChartDataFactory.CreateBarChartData<string, double>();
        data.AddSeries(categorySource, valueSource).SetTitle(title);
        
        IChartAxis bottomAxis = chart.ChartAxisFactory.CreateCategoryAxis(AxisPosition.Bottom);
        IValueAxis leftAxis = chart.ChartAxisFactory.CreateValueAxis(AxisPosition.Left);
        
        chart.Plot(data, bottomAxis, leftAxis);
    }
    
    /// <summary>
    /// 创建折线图
    /// </summary>
    public static void CreateLineChart(XSSFSheet sheet, string title,
        CellRangeAddress categoryRange, List<(CellRangeAddress range, string name)> seriesData,
        int chartCol1, int chartRow1, int chartCol2, int chartRow2)
    {
        XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
        XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
            0, 0, 0, 0, chartCol1, chartRow1, chartCol2, chartRow2);
        
        XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
        chart.SetTitle(title);
        
        IChartLegend legend = chart.GetOrCreateLegend();
        legend.Position = LegendPosition.Bottom;
        
        IChartDataSource<string> categorySource = DataSources.FromStringCellRange(
            sheet, categoryRange);
        
        ILineChartData<string, double> data = chart.ChartDataFactory.CreateLineChartData<string, double>();
        
        foreach (var (range, name) in seriesData)
        {
            IChartDataSource<double> valueSource = DataSources.FromNumericCellRange(sheet, range);
            data.AddSeries(categorySource, valueSource).SetTitle(name);
        }
        
        IChartAxis bottomAxis = chart.ChartAxisFactory.CreateCategoryAxis(AxisPosition.Bottom);
        IValueAxis leftAxis = chart.ChartAxisFactory.CreateValueAxis(AxisPosition.Left);
        
        chart.Plot(data, bottomAxis, leftAxis);
    }
    
    /// <summary>
    /// 创建饼图
    /// </summary>
    public static void CreatePieChart(XSSFSheet sheet, string title,
        CellRangeAddress categoryRange, CellRangeAddress valueRange,
        int chartCol1, int chartRow1, int chartCol2, int chartRow2)
    {
        XSSFDrawing drawing = (XSSFDrawing)sheet.CreateDrawingPatriarch();
        XSSFClientAnchor anchor = (XSSFClientAnchor)drawing.CreateAnchor(
            0, 0, 0, 0, chartCol1, chartRow1, chartCol2, chartRow2);
        
        XSSFChart chart = (XSSFChart)drawing.CreateChart(anchor);
        chart.SetTitle(title);
        
        IChartLegend legend = chart.GetOrCreateLegend();
        legend.Position = LegendPosition.Right;
        
        IChartDataSource<string> categorySource = DataSources.FromStringCellRange(
            sheet, categoryRange);
        IChartDataSource<double> valueSource = DataSources.FromNumericCellRange(
            sheet, valueRange);
        
        IPieChartData<string, double> data = chart.ChartDataFactory.CreatePieChartData<string, double>();
        data.AddSeries(categorySource, valueSource);
        
        chart.Plot(data);
    }
    
    /// <summary>
    /// 插入图片
    /// </summary>
    public static void InsertImage(ISheet sheet, string imagePath,
        int col1, int row1, int col2, int row2)
    {
        byte[] imageBytes = File.ReadAllBytes(imagePath);
        
        PictureType pictureType = Path.GetExtension(imagePath).ToLower() switch
        {
            ".png" => PictureType.PNG,
            ".jpg" or ".jpeg" => PictureType.JPEG,
            ".gif" => PictureType.GIF,
            ".bmp" => PictureType.BMP,
            _ => PictureType.PNG
        };
        
        IWorkbook workbook = sheet.Workbook;
        int pictureIndex = workbook.AddPicture(imageBytes, pictureType);
        
        IDrawing drawing = sheet.CreateDrawingPatriarch();
        IClientAnchor anchor = workbook.GetCreationHelper().CreateClientAnchor();
        anchor.Col1 = col1;
        anchor.Row1 = row1;
        anchor.Col2 = col2;
        anchor.Row2 = row2;
        
        drawing.CreatePicture(anchor, pictureIndex);
    }
}
```

## 8.9 综合示例

### 8.9.1 创建带图表的销售报表

```csharp
public class SalesReportWithChartExample
{
    public static void CreateReport()
    {
        XSSFWorkbook workbook = new XSSFWorkbook();
        
        // 创建数据工作表
        XSSFSheet dataSheet = (XSSFSheet)workbook.CreateSheet("销售数据");
        CreateSalesData(dataSheet);
        
        // 创建图表工作表
        XSSFSheet chartSheet = (XSSFSheet)workbook.CreateSheet("销售分析图表");
        
        // 复制数据摘要
        CreateDataSummary(chartSheet, dataSheet);
        
        // 创建柱形图
        ChartHelper.CreateBarChart(chartSheet, "月度销售额",
            new CellRangeAddress(1, 12, 0, 0),  // 月份列
            new CellRangeAddress(1, 12, 1, 1),  // 销售额列
            5, 0, 15, 12);
        
        // 创建折线图
        ChartHelper.CreateLineChart(chartSheet, "销售趋势",
            new CellRangeAddress(1, 12, 0, 0),
            new List<(CellRangeAddress, string)>
            {
                (new CellRangeAddress(1, 12, 1, 1), "销售额"),
                (new CellRangeAddress(1, 12, 2, 2), "目标")
            },
            5, 13, 15, 25);
        
        // 创建饼图
        XSSFSheet pieSheet = (XSSFSheet)workbook.CreateSheet("产品占比");
        CreateProductData(pieSheet);
        ChartHelper.CreatePieChart(pieSheet, "产品销售占比",
            new CellRangeAddress(1, 5, 0, 0),
            new CellRangeAddress(1, 5, 1, 1),
            3, 0, 12, 12);
        
        // 保存
        using (FileStream fs = new FileStream("销售报表含图表.xlsx", FileMode.Create))
        {
            workbook.Write(fs);
        }
        
        Console.WriteLine("报表创建成功！");
    }
    
    private static void CreateSalesData(ISheet sheet)
    {
        string[] months = { "1月", "2月", "3月", "4月", "5月", "6月",
                           "7月", "8月", "9月", "10月", "11月", "12月" };
        double[] sales = { 150, 180, 200, 220, 195, 210,
                          230, 250, 280, 260, 290, 320 };
        double[] targets = { 160, 170, 190, 210, 200, 220,
                            240, 250, 270, 280, 300, 310 };
        
        IRow header = sheet.CreateRow(0);
        header.CreateCell(0).SetCellValue("月份");
        header.CreateCell(1).SetCellValue("销售额(万)");
        header.CreateCell(2).SetCellValue("目标(万)");
        header.CreateCell(3).SetCellValue("完成率");
        
        for (int i = 0; i < months.Length; i++)
        {
            IRow row = sheet.CreateRow(i + 1);
            row.CreateCell(0).SetCellValue(months[i]);
            row.CreateCell(1).SetCellValue(sales[i]);
            row.CreateCell(2).SetCellValue(targets[i]);
            row.CreateCell(3).SetCellFormula($"B{i + 2}/C{i + 2}");
        }
    }
    
    private static void CreateDataSummary(ISheet targetSheet, ISheet sourceSheet)
    {
        // 复制数据到图表工作表
        for (int i = 0; i <= 12; i++)
        {
            IRow sourceRow = sourceSheet.GetRow(i);
            IRow targetRow = targetSheet.CreateRow(i);
            
            for (int j = 0; j < 3; j++)
            {
                ICell sourceCell = sourceRow?.GetCell(j);
                ICell targetCell = targetRow.CreateCell(j);
                
                if (sourceCell != null)
                {
                    switch (sourceCell.CellType)
                    {
                        case CellType.String:
                            targetCell.SetCellValue(sourceCell.StringCellValue);
                            break;
                        case CellType.Numeric:
                            targetCell.SetCellValue(sourceCell.NumericCellValue);
                            break;
                    }
                }
            }
        }
    }
    
    private static void CreateProductData(ISheet sheet)
    {
        string[] products = { "产品A", "产品B", "产品C", "产品D", "产品E" };
        double[] values = { 35, 25, 20, 12, 8 };
        
        IRow header = sheet.CreateRow(0);
        header.CreateCell(0).SetCellValue("产品");
        header.CreateCell(1).SetCellValue("销售额占比(%)");
        
        for (int i = 0; i < products.Length; i++)
        {
            IRow row = sheet.CreateRow(i + 1);
            row.CreateCell(0).SetCellValue(products[i]);
            row.CreateCell(1).SetCellValue(values[i]);
        }
    }
}
```

## 8.10 本章小结

本章详细介绍了NPOI中图表和图形的创建。通过本章学习，你应该掌握：

- 图表的基本创建流程
- 柱形图、折线图、饼图、散点图的创建
- 多系列图表的创建
- 图片的插入（从文件、字节数组、Base64）
- 形状的绘制（矩形、椭圆、线条、文本框）
- 图表辅助类的封装

图表和图形功能可以让Excel报表更加直观和专业，是数据可视化的重要手段。

---

> **下一章预告**：第九章将介绍Excel高级功能，包括合并单元格、冻结窗格、筛选、排序等操作。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/csharp/npoi/第08章-Excel图表与图形/第07章-Excel数据验证与保护/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/npoi/第08章-Excel图表与图形/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/csharp/npoi/第08章-Excel图表与图形/第09章-Excel高级功能-合并单元格与冻结窗格/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

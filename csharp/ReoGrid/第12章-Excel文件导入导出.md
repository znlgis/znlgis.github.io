---
layout: default
title: 第十二章：Excel文件导入导出
---

# 第十二章：Excel文件导入导出

ReoGrid 通常不是孤立使用的：数据可能来自已有的 Excel 模板，做好的表格也要交给只装 Office 的人看。这一章讲文件的进出——把工作簿保存成 Excel 或 CSV，以及把外部文件读进控件。

导入导出看起来只是两个 API，实际要考虑的东西不少：格式版本、隐藏工作表、公式与样式的取舍、字符编码。这些都在选项对象里控制，默认值不一定符合业务预期，涉及交付的流程里应当显式配置。

## 12.1 导出Excel文件

导出入口在控件层：grid.Save 接收文件路径与格式枚举。示例分别演示 Excel 2007 与 CSV 两种格式，前者是带样式的完整工作簿，后者是纯文本的逗号分隔数据。

FileFormat.Excel2007 对应 .xlsx，也就是 Office 2007 之后的标准格式。更早的 .xls 二进制格式支持情况取决于版本，需要兼容旧版 Office 时先确认包内是否提供对应的写入实现。

工作表级导出用 sheet.ExportAsExcel，只输出当前这张表，不包含同工作簿的其他工作表。适合「只给客户一张对账单」这类场景，导出的文件名和路径由调用方决定。

```csharp
using unvell.ReoGrid.IO;

public class ExcelExport
{
    private ReoGridControl grid;
    
    // 导出为Excel 2007+格式
    public void ExportToExcel(string filepath)
    {
        grid.Save(filepath, FileFormat.Excel2007);
    }
    
    // 导出为CSV格式
    public void ExportToCSV(string filepath)
    {
        grid.Save(filepath, FileFormat.CSV);
    }
    
    // 导出特定工作表
    public void ExportWorksheet(Worksheet sheet, string filepath)
    {
        sheet.ExportAsExcel(filepath);
    }
}
```

CSV 导出只保留值，不保留样式、公式、合并与列宽。凡是靠显示格式表达的信息（货币符号、百分比、日期写法）都会丢失，导出前要么接受，要么改成 Excel 格式。

CSV 还有一个常被忽略的问题：分隔符与编码。逗号是默认分隔符，字段里本身含逗号时需要用引号包起来；中文内容要确认用 UTF-8 还是本地编码保存，否则对方打开是乱码。这些由导出选项控制（如果版本提供），没有选项时应在文档里注明编码约定。

导出路径要判空并处理异常。路径不存在、文件被 Excel 占用、没有写权限，都会抛异常。给用户一个明确的失败提示，比让程序直接崩掉更合适。

## 12.2 导入Excel文件

导入有三个入口，粒度不同。grid.Load 加载整个工作簿，会重建工作表集合；sheet.LoadExcel 把文件内容读进指定工作表；CSV 同样可以走控件的 Load 并指定格式。选哪个取决于数据要落在哪里。

grid.Load 属于工作簿级操作。加载后原来的工作表对象可能被替换，之前保存的 Worksheet 引用会失效，后续操作要重新从控件取当前工作表。这一点在「先建表再导入」的流程里最容易踩坑。

sheet.LoadExcel 适合「模板已有格式，只填数据」的场景：工作表的样式、列宽、公式都保留，只把文件里的值读进来。文件结构与目标表不一致时，数据可能错位，导入前先确认列顺序。

```csharp
public class ExcelImport
{
    private ReoGridControl grid;
    
    // 导入Excel文件
    public void ImportExcel(string filepath)
    {
        grid.Load(filepath);
    }
    
    // 导入到指定工作表
    public void ImportToWorksheet(Worksheet sheet, string filepath)
    {
        sheet.LoadExcel(filepath);
    }
    
    // 导入CSV文件
    public void ImportCSV(string filepath)
    {
        grid.Load(filepath, FileFormat.CSV);
    }
}
```

导入失败要区分文件问题与格式问题。文件被占用、路径错误属于前者，提示用户重试；版本不支持、文件损坏属于后者，提示格式不兼容。把两种情况混在一起报「导入失败」，用户无法判断该做什么。

大文件导入是耗时操作，会阻塞界面。示例是同步调用，实际项目应放到后台线程并显示进度，或者至少把光标切到等待状态，避免用户以为程序卡死而反复点击。

导入完成后检查关键位置的数据。表头行、合计行、日期列是问题高发区，抽查几格比逐个核对快得多。

## 12.3 导入导出选项

选项对象控制导出的取舍。示例用三个开关：是否包含隐藏工作表、是否包含公式、是否包含样式。三个开关各有代价，配置前想清楚接收方需要什么。

不包含公式时，导出的只是当前计算结果，对方看到的是死数字，无法追溯到计算过程；包含公式则文件更大，且公式引用的函数对方未必支持。对外交付通常给值，对内归档通常给公式。

不含样式时文件最小，但表头、边框、数字格式全部丢失，打开就是一张裸表。报表类导出应当保留样式，纯数据交换可以关掉。

```csharp
public class ImportExportOptions
{
    public void ExportWithOptions(ReoGridControl grid, string filepath)
    {
        var options = new ExcelFileFormatOptions
        {
            IncludeHiddenSheets = false,
            IncludeFormulas = true,
            IncludeStyles = true
        };
        
        grid.Save(filepath, FileFormat.Excel2007, options);
    }
}
```

隐藏工作表与公式之间有依赖关系。某张公式引用了隐藏表，导出时又不包含隐藏表，接收方打开会得到 #REF!。要裁掉隐藏表，先把引用它的公式转成值，或者一并导出。

选项对象的类名与字段名在不同版本间有差异。示例里的 ExcelFileFormatOptions 写法以当前版本为准，编译不通过时先查程序集里实际的选项类型，再对照字段含义调整。

## 12.4 本章小结

本章介绍了Excel和CSV文件的导入导出功能。

导出和导入各自记住几条：

- 导出：grid.Save 是工作簿级，sheet.ExportAsExcel 是工作表级，CSV 只带值不带格式；
- 导入：grid.Load 会重建工作表集合，sheet.LoadExcel 只填数据；
- 选项：公式、样式、隐藏表三个开关互相牵连，按接收方需求配置；
- 异常：路径、占用、权限、格式不兼容要分开提示。

文件格式的选择本质是「谁来打开」。对方用 Excel 看，就用 Excel 格式保住样式；对方用程序读，就用 CSV 减少解析负担。两种都想满足时，导出两份比在一个文件里塞各种特性更省事。

导入导出是数据进出的边界，也是最容易出安全问题的地方。文件路径不要直接取自用户输入，必要时限制在指定目录内；导入的文件大小要设上限，避免一次加载超大文件把内存吃满。

下一章讲打印与页面设置，输出从屏幕转到纸上。

### 📚 下一章预告

第十三章将学习打印与页面设置。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/csharp/ReoGrid/第11章-图表与可视化/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/ReoGrid/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/csharp/ReoGrid/第13章-打印与页面设置/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

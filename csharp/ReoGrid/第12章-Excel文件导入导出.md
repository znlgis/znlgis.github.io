# 第十二章：Excel文件导入导出

## 12.1 导出Excel文件

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

## 12.2 导入Excel文件

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

## 12.3 导入导出选项

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

## 12.4 本章小结

本章介绍了Excel和CSV文件的导入导出功能。

### 📚 下一章预告

第十三章将学习打印与页面设置。

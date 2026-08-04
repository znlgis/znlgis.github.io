---
layout: default
title: 第十八章：WPF平台集成
---

# 第十八章：WPF平台集成

## 18.1 WPF项目配置

### 18.1.1 安装WPF版本

```bash
# NuGet包管理器
Install-Package unvell.ReoGrid.WPF

# .NET CLI
dotnet add package unvell.ReoGrid.WPF
```

### 18.1.2 XAML配置

```xml
<Window x:Class="WpfApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:rg="clr-namespace:unvell.ReoGrid.WPF;assembly=unvell.ReoGrid.WPF"
        Title="ReoGrid WPF Demo" Height="600" Width="800">
    <Grid>
        <rg:WorksheetControl x:Name="worksheetControl"/>
    </Grid>
</Window>
```

## 18.2 WPF数据绑定

```csharp
using unvell.ReoGrid;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        InitializeWorksheet();
    }
    
    private void InitializeWorksheet()
    {
        var worksheet = worksheetControl.Worksheet;
        
        // 设置数据
        worksheet["A1"] = "姓名";
        worksheet["B1"] = "年龄";
        worksheet["C1"] = "部门";
        
        // 设置样式
        worksheet.SetRangeStyles("A1:C1", new WorksheetRangeStyle
        {
            Flag = PlainStyleFlag.FontBold | PlainStyleFlag.BackColor,
            Bold = true,
            BackColor = System.Windows.Media.Colors.LightBlue.ToGdiColor()
        });
    }
}
```

## 18.3 MVVM模式集成

```csharp
public class WorksheetViewModel : INotifyPropertyChanged
{
    private Worksheet worksheet;
    
    public Worksheet Worksheet
    {
        get => worksheet;
        set
        {
            worksheet = value;
            OnPropertyChanged(nameof(Worksheet));
        }
    }
    
    public ICommand LoadDataCommand { get; }
    public ICommand SaveDataCommand { get; }
    
    public WorksheetViewModel()
    {
        LoadDataCommand = new RelayCommand(LoadData);
        SaveDataCommand = new RelayCommand(SaveData);
    }
    
    private void LoadData()
    {
        // 加载数据逻辑
    }
    
    private void SaveData()
    {
        // 保存数据逻辑
    }
    
    public event PropertyChangedEventHandler PropertyChanged;
    protected void OnPropertyChanged(string propertyName)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
```

## 18.4 WPF样式和主题

```xml
<Window.Resources>
    <Style TargetType="{x:Type rg:WorksheetControl}">
        <Setter Property="Background" Value="White"/>
        <Setter Property="BorderBrush" Value="Gray"/>
        <Setter Property="BorderThickness" Value="1"/>
    </Style>
</Window.Resources>
```

## 18.5 本章小结

本章介绍了ReoGrid在WPF平台的集成方法。

### 📚 下一章预告

第十九章将学习高级应用与扩展。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="https://znlgis.github.io/csharp/ReoGrid/第18章-WPF平台集成/第17章-性能优化与最佳实践/" style="text-decoration: none;">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/ReoGrid/第18章-WPF平台集成/" style="text-decoration: none;">目录</a>
  <a href="https://znlgis.github.io/csharp/ReoGrid/第18章-WPF平台集成/第19章-高级应用与扩展/" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

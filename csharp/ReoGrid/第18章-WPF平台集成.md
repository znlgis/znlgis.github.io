---
layout: default
title: 第十八章：WPF平台集成
---

# 第十八章：WPF平台集成

ReoGrid 有两个平台的版本：WinForms 版和 WPF 版。两者的 API 大体一致，差异集中在宿主控件的装配方式上——WinForms 用拖控件或代码 new，WPF 用 XAML 声明，样式和资源走 WPF 体系。这一章讲 WPF 下的项目配置、数据初始化、MVVM 组织与样式设置。

前提要分清：WPF 版是独立的程序集，不能拿 WinForms 版的 DLL 直接在 WPF 窗口里用。项目里引用错包，会出现「类型存在但无法放入 XAML」这类看起来莫名其妙的错误。

## 18.1 WPF项目配置

### 18.1.1 安装WPF版本

示例给了两种安装方式，包管理器控制台与 .NET CLI，装的是 WPF 版的包。包名里带 WPF 字样，用来和 WinForms 版区分，版本号写成固定值便于团队统一环境。

安装完成后确认引用的是 WPF 程序集。可以在解决方案的资源管理器里展开引用，看程序集名称与路径；也可以编译后看输出目录里是否多了对应的 DLL。引用错版本在 XAML 阶段就会失败，错误信息通常不直接指向包名，先核对引用能省不少时间。

包版本要和项目目标框架匹配。老项目用 .NET Framework 4.x，新项目用 .NET 6 及以上，两边可用的包版本不同，升级框架时包也要跟着换。

```bash
# NuGet包管理器
Install-Package unvell.ReoGridWPF.dll -Version 3.3.0

# .NET CLI
dotnet add package unvell.ReoGridWPF.dll --version 3.3.0
```

安装完成后重启 Visual Studio 工具箱不一定出现控件。WPF 的第三方控件通常需要在 XAML 里手工声明命名空间，工具箱里有没有图标不影响使用。

团队协作时把包版本写进项目文件并提交，不要依赖某个人本地的 NuGet 缓存。换机器还原项目时，版本不一致会导致编译错误或运行期行为差异。

### 18.1.2 XAML配置

XAML 里用 xmlns 声明把 CLR 命名空间映射成前缀，示例映射成 rg，之后 rg:ReoGridControl 就是控件类型。assembly 部分写的是程序集名，必须和实际引用的程序集一致。

示例中 assembly 写的是 unvell.ReoGrid，而安装的包名是 unvell.ReoGridWPF，两者是否一致取决于包内程序集的实际名称。加载 XAML 报「找不到类型」时，第一件事就是核对 assembly 与引用程序集名，而不是怀疑控件本身。

控件放在 Grid 里会铺满整个可用区域，父容器的布局决定它的大小。需要固定尺寸或按行列分配空间时，在 Grid 里定义行列或给控件设置宽高。

```xml
<Window x:Class="WpfApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:rg="clr-namespace:unvell.ReoGrid;assembly=unvell.ReoGrid"
        Title="ReoGrid WPF Demo" Height="600" Width="800">
    <Grid>
        <rg:ReoGridControl x:Name="worksheetControl"/>
    </Grid>
</Window>
```

x:Name 给控件一个代码后台可访问的名字，相当于 WinForms 里的控件字段。后台代码通过这个名字拿到控件实例，再访问 CurrentWorksheet。

窗口的 x:Class 指向代码后台类，命名空间与类名必须和后台文件一致，否则编译报分部类找不到。这是 XAML 项目的基础约定，和 ReoGrid 无关，但换模板时容易出错。

## 18.2 WPF数据绑定

窗口构造时先调用 InitializeComponent，XAML 里的控件才会被创建，此时才能访问 worksheetControl。顺序反了会拿到 null，访问 CurrentWorksheet 直接空引用。

示例在初始化里写了三列表头并设置表头样式。样式对象的颜色用的是 System.Drawing.Color，而示例里的 LightBlue 来自 WPF 的 Colors，中间用 ToGdiColor 转换。这个扩展方法来自 ReoGrid 的 WPF 适配层，项目里没有该方法时，用 Color.FromArgb 手工构造即可。

表头样式通过 Flag 指定位掩码，和 WinForms 版完全一致。样式 API 在两个平台通用，这是同一套代码能跨平台复用的原因；差异只在颜色类型与宿主控件。

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
        var worksheet = worksheetControl.CurrentWorksheet;
        
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

WPF 的数据绑定以属性通知为基础，但表格控件的数据不通过绑定传递。ReoGrid 的 Worksheet 不是依赖属性，不能直接写 Binding，填充数据仍然要用 API 调用。

所以 WPF 下的「数据绑定」更多指把业务数据映射进表格：ViewModel 持有数据集合，命令触发后调用 Worksheet 的读写方法，把集合内容刷进单元格。表格与 ViewModel 之间是代码调用关系，不是绑定关系。

反过来，用户在表格里的修改需要同步回业务对象时，通过单元格事件把值写回集合。这条链路要自己搭，控件不提供双向绑定。

## 18.3 MVVM模式集成

示例的 ViewModel 实现 INotifyPropertyChanged，暴露 Worksheet 属性与两个命令。结构上是标准 MVVM，但要注意 Worksheet 属性变更时界面不会自动更新表格，控件不监听这个属性。

命令用 RelayCommand 包装，LoadData 与 SaveData 里通常调用服务层，再把结果刷进 Worksheet。命令的可执行状态、异常处理都按 MVVM 的常规做法处理。

把 Worksheet 暴露成公开属性有利有弊：方便 View 绑定，也让 View 直接依赖控件类型。更干净的做法是 ViewModel 只暴露数据与命令，表格的填充由 View 的代码后台或附加行为完成，ViewModel 保持对 UI 类型无依赖。

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

MVVM 场景下最容易出问题的是线程。命令在 UI 线程执行，直接刷表格没问题；如果用 async/await 或 Task 在后台加载数据，写单元格必须回到 UI 线程，否则会抛跨线程访问异常。

ViewModel 的生命周期比窗口长时（例如放在应用级容器里），要注意取消事件订阅。表格控件在窗口关闭时释放，ViewModel 若仍持有它的引用，下次打开新窗口可能操作到已释放的对象。

## 18.4 WPF样式和主题

WPF 样式用 Style 定义控件的外观属性，示例设置了背景、边框颜色和边框粗细。TargetType 指明作用于 ReoGridControl，样式写在 Window.Resources 里，作用域限于这个窗口。

能通过 WPF 样式设置的只有控件的依赖属性。表格内部的单元格、表头、网格线由 ReoGrid 自己的渲染器绘制，不参与 WPF 的样式系统；想改单元格外观，仍然要用 WorksheetRangeStyle。

把控件样式放在 App.xaml 的全局资源里，可以让所有窗口一致。局部要在某个窗口覆盖时，在该窗口的 Resources 里再定义一份，就近的优先级更高。

```xml
<Window.Resources>
    <Style TargetType="{x:Type rg:ReoGridControl}">
        <Setter Property="Background" Value="White"/>
        <Setter Property="BorderBrush" Value="Gray"/>
        <Setter Property="BorderThickness" Value="1"/>
    </Style>
</Window.Resources>
```

深色主题下要同时处理两套颜色：WPF 外壳的颜色由 Style 控制，表格内部的颜色由工作表样式控制。只改一边会得到「外框是深色、表格还是白底」的效果。

系统主题或高对比度模式变化时，WPF 会给出通知，可以在回调里切换样式。表格内部的配色需要自己重新应用一遍，控件不会自动适配。

## 18.5 本章小结

本章介绍了ReoGrid在WPF平台的集成方法。

WPF 下使用 ReoGrid 的要点：

- 引用 WPF 版程序集，XAML 里正确声明命名空间与程序集名；
- 控件由 XAML 创建，后台通过 x:Name 访问，初始化顺序不能反；
- 表格数据不通过 WPF 绑定传递，仍用 API 读写；
- 颜色类型在 WPF 与 GDI 之间需要转换；
- WPF Style 只作用于控件本身，单元格外观用工作表样式。

WinForms 与 WPF 的差异集中在宿主层，数据、样式、公式、导入导出这些 API 是一致的。写业务逻辑时不必为两个平台各写一套，把宿主相关的部分隔离出来，核心代码可以共用。

下一章进入扩展话题：插件、自定义渲染、数据源与多线程，这些是把这个控件接入更大系统时要处理的问题。

### 📚 下一章预告

第十九章将学习高级应用与扩展。

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/csharp/ReoGrid/第17章-性能优化与最佳实践/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/csharp/ReoGrid/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/csharp/ReoGrid/第19章-高级应用与扩展/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

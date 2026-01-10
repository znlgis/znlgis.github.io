# 第二章：DBTrans事务管理核心教程

## 2.1 事务机制基础

### 2.1.1 什么是事务

在AutoCAD二次开发中，事务（Transaction）是一个至关重要的概念。事务提供了一种安全可靠的方式来修改CAD数据库中的对象。可以将事务理解为一个"工作单元"，在这个工作单元中执行的所有操作要么全部成功，要么全部失败。

事务的核心特性包括：

**原子性（Atomicity）**

事务中的所有操作被视为一个不可分割的整体。如果事务中的任何一个操作失败，整个事务都会回滚，数据库恢复到事务开始之前的状态。这确保了数据的完整性。

**一致性（Consistency）**

事务完成后，数据库必须处于一致的状态。在CAD中，这意味着所有的图元引用、符号表记录等都必须是有效和一致的。

**隔离性（Isolation）**

在事务进行中，其他事务不能看到当前事务的中间状态。这在多线程或多进程环境下尤其重要。

**持久性（Durability）**

一旦事务提交，其结果就是永久性的，即使系统发生故障也不会丢失。

### 2.1.2 CAD原生事务的使用

在使用IFoxCAD之前，让我们先回顾一下CAD原生API中事务的使用方式：

```csharp
// CAD原生事务使用方式
public void NativeTransactionExample()
{
    Document doc = Application.DocumentManager.MdiActiveDocument;
    Database db = doc.Database;
    
    using (Transaction tr = db.TransactionManager.StartTransaction())
    {
        // 打开块表
        BlockTable bt = tr.GetObject(db.BlockTableId, OpenMode.ForRead) as BlockTable;
        
        // 打开模型空间
        BlockTableRecord btr = tr.GetObject(bt[BlockTableRecord.ModelSpace], 
            OpenMode.ForWrite) as BlockTableRecord;
        
        // 创建直线
        Line line = new Line(new Point3d(0, 0, 0), new Point3d(100, 100, 0));
        
        // 添加到模型空间
        btr.AppendEntity(line);
        tr.AddNewlyCreatedDBObject(line, true);
        
        // 提交事务
        tr.Commit();
    }
}
```

这种方式的问题在于：

1. **代码冗长**：每次操作都需要获取Document、Database、启动事务等一系列步骤
2. **重复性高**：打开块表、模型空间的代码在每个方法中都需要重复
3. **容易出错**：忘记Commit、忘记AddNewlyCreatedDBObject等常见错误
4. **可读性差**：业务逻辑被大量的样板代码所淹没

### 2.1.3 DBTrans的设计目标

DBTrans类的设计目标就是解决上述问题，它提供了：

1. **简洁的API**：一行代码创建事务，自动管理提交和释放
2. **封装常用对象**：Document、Database、Editor、符号表等直接作为属性访问
3. **减少错误**：默认自动提交，自动添加新创建的对象
4. **提高可读性**：让开发者专注于业务逻辑，而不是样板代码

使用DBTrans后，上面的代码可以简化为：

```csharp
// 使用DBTrans的方式
public void DBTransExample()
{
    using var tr = new DBTrans();
    var line = new Line(new Point3d(0, 0, 0), new Point3d(100, 100, 0));
    tr.CurrentSpace.AddEntity(line);
}
```

代码量大大减少，逻辑更加清晰。

## 2.2 DBTrans类详解

### 2.2.1 DBTrans的类结构

DBTrans是IFoxCAD中最核心的类，让我们来详细了解它的结构：

```csharp
public sealed class DBTrans : IDisposable
{
    // 静态属性
    public static DBTrans Top { get; }          // 获取顶层事务
    
    // 实例属性
    public Document? Document { get; }          // 文档对象
    public Editor? Editor { get; }              // 编辑器对象
    public Transaction Transaction { get; }     // 底层事务对象
    public Database Database { get; }           // 数据库对象
    
    // 符号表属性
    public SymbolTable<BlockTable, BlockTableRecord> BlockTable { get; }
    public SymbolTable<LayerTable, LayerTableRecord> LayerTable { get; }
    public SymbolTable<LinetypeTable, LinetypeTableRecord> LinetypeTable { get; }
    // ... 其他符号表
    
    // 特殊块表记录
    public BlockTableRecord CurrentSpace { get; }  // 当前空间
    public BlockTableRecord ModelSpace { get; }    // 模型空间
    public BlockTableRecord PaperSpace { get; }    // 图纸空间
    
    // 字典属性
    public DBDictionary NamedObjectsDict { get; }  // 命名对象字典
    public DBDictionary GroupDict { get; }         // 组字典
    public DBDictionary LayoutDict { get; }        // 布局字典
    // ... 其他字典
    
    // 方法
    public DBObject GetObject(ObjectId id, OpenMode openMode = OpenMode.ForRead, ...);
    public T? GetObject<T>(ObjectId id, OpenMode openMode = OpenMode.ForRead, ...) where T : DBObject;
    public void Task(Action action, bool handlingDBTextDeviation = true);
    public void Abort();
    public void Commit();
    public void Dispose();
}
```

### 2.2.2 构造函数详解

DBTrans提供了三个构造函数，分别用于不同的使用场景：

**构造函数1：基于文档的构造**

```csharp
public DBTrans(Document? doc = null, bool commit = true, bool docLock = false)
```

参数说明：
- `doc`：要操作的文档对象，默认为当前活动文档
- `commit`：事务结束时是否自动提交，默认为true
- `docLock`：是否锁定文档，默认为false

使用示例：

```csharp
// 操作当前文档，自动提交
using var tr1 = new DBTrans();

// 操作当前文档，手动控制提交
using var tr2 = new DBTrans(commit: false);
// ... 操作
tr2.Commit(); // 手动提交

// 操作指定文档，锁定文档
var targetDoc = Application.DocumentManager.GetDocument(someDatabase);
using var tr3 = new DBTrans(targetDoc, true, true);
```

**构造函数2：基于数据库的构造**

```csharp
public DBTrans(Database database, bool commit = true)
```

参数说明：
- `database`：要操作的数据库对象
- `commit`：事务结束时是否自动提交，默认为true

使用示例：

```csharp
// 操作外部数据库
Database extDb = new Database(false, true);
extDb.ReadDwgFile("C:\\drawing.dwg", FileOpenMode.OpenForReadAndWriteNoShare, true, null);

using var tr = new DBTrans(extDb);
// 操作数据库...
```

**构造函数3：基于文件的构造**

```csharp
public DBTrans(string fileName, bool commit = true,
    FileOpenMode fileOpenMode = FileOpenMode.OpenForReadAndWriteNoShare,
    string? password = null, bool activeOpen = false)
```

参数说明：
- `fileName`：要打开的DWG/DXF文件路径
- `commit`：事务结束时是否自动提交，默认为true
- `fileOpenMode`：文件打开模式
- `password`：文件密码（如果有的话）
- `activeOpen`：是否前台打开，默认为后台打开

使用示例：

```csharp
// 后台打开文件进行处理
using var tr1 = new DBTrans("C:\\drawing.dwg");
// 处理文件...

// 前台打开文件（需要CommandFlags.Session）
using var tr2 = new DBTrans("C:\\drawing.dwg", true, 
    FileOpenMode.OpenForReadAndWriteNoShare, null, true);
```

### 2.2.3 事务栈机制

DBTrans内部维护了一个静态的事务栈，用于管理嵌套事务：

```csharp
private static readonly Stack<DBTrans> _dBTrans = new();
```

**事务栈的工作原理**

当创建一个新的DBTrans实例时，它会被压入事务栈：

```csharp
_dBTrans.Push(this);
```

当DBTrans被释放时，它会从事务栈中弹出：

```csharp
_dBTrans.Pop();
```

**获取顶层事务**

可以通过静态属性`Top`获取当前的顶层事务：

```csharp
// 在某个方法中，假设已经有事务存在
public void SomeMethod()
{
    var topTrans = DBTrans.Top;
    // 使用顶层事务...
}
```

注意：如果事务栈为空，访问`Top`属性会抛出异常。在调用之前应确保已创建事务。

**获取指定数据库的顶层事务**

```csharp
public static DBTrans GetTop(Database? database = null)
```

这个方法可以获取指定数据库的顶层DBTrans事务，如果不指定数据库则使用当前工作数据库。

### 2.2.4 获取对象方法

DBTrans提供了两个获取对象的方法：

**非泛型版本**

```csharp
public DBObject GetObject(ObjectId id, 
    OpenMode openMode = OpenMode.ForRead,
    bool openErased = false, 
    bool openLockedLayer = false)
```

**泛型版本**

```csharp
public T? GetObject<T>(ObjectId id, 
    OpenMode openMode = OpenMode.ForRead,
    bool openErased = false, 
    bool openLockedLayer = false) where T : DBObject
```

参数说明：
- `id`：对象的ObjectId
- `openMode`：打开模式，ForRead（只读）、ForWrite（读写）、ForNotify（通知）
- `openErased`：是否打开已删除的对象
- `openLockedLayer`：是否打开锁定图层上的对象

使用示例：

```csharp
using var tr = new DBTrans();

// 获取一个直线对象（只读）
var line = tr.GetObject<Line>(lineId);

// 获取一个直线对象（读写）
var lineForEdit = tr.GetObject<Line>(lineId, OpenMode.ForWrite);
lineForEdit.Color = Color.FromColorIndex(ColorMethod.ByAci, 1);

// 获取已删除的对象
var erasedEnt = tr.GetObject<Entity>(erasedId, OpenMode.ForRead, true);
```

## 2.3 符号表操作

### 2.3.1 九大符号表概述

AutoCAD数据库中包含九个符号表，DBTrans为每个符号表都提供了对应的属性：

| 符号表 | DBTrans属性 | 说明 |
|--------|-------------|------|
| BlockTable | BlockTable | 块表，存储所有块定义 |
| LayerTable | LayerTable | 图层表，存储所有图层 |
| LinetypeTable | LinetypeTable | 线型表，存储所有线型 |
| TextStyleTable | TextStyleTable | 文字样式表 |
| DimStyleTable | DimStyleTable | 标注样式表 |
| RegAppTable | RegAppTable | 注册应用程序表 |
| UcsTable | UcsTable | 用户坐标系表 |
| ViewTable | ViewTable | 视图表 |
| ViewportTable | ViewportTable | 视口表 |

### 2.3.2 块表操作

块表是最常用的符号表，它存储了所有的块定义，包括模型空间和图纸空间。

**访问模型空间和图纸空间**

```csharp
using var tr = new DBTrans();

// 获取当前空间（模型空间或当前布局的图纸空间）
BlockTableRecord currentSpace = tr.CurrentSpace;

// 获取模型空间
BlockTableRecord modelSpace = tr.ModelSpace;

// 获取图纸空间
BlockTableRecord paperSpace = tr.PaperSpace;
```

**添加图元到空间**

```csharp
using var tr = new DBTrans();

// 创建图元
var line = new Line(Point3d.Origin, new Point3d(100, 100, 0));
var circle = new Circle(new Point3d(50, 50, 0), Vector3d.ZAxis, 25);

// 添加到当前空间
tr.CurrentSpace.AddEntity(line);
tr.CurrentSpace.AddEntity(circle);

// 或者批量添加
tr.CurrentSpace.AddEntity(new Entity[] { line, circle });
```

**创建块定义**

```csharp
using var tr = new DBTrans();

// 创建新的块定义
tr.BlockTable.Add("MyBlock", btr =>
{
    // 在块定义中添加图元
    var line = new Line(Point3d.Origin, new Point3d(10, 10, 0));
    var circle = new Circle(Point3d.Origin, Vector3d.ZAxis, 5);
    
    btr.AppendEntity(line);
    tr.Transaction.AddNewlyCreatedDBObject(line, true);
    btr.AppendEntity(circle);
    tr.Transaction.AddNewlyCreatedDBObject(circle, true);
});
```

**插入块参照**

```csharp
using var tr = new DBTrans();

// 获取块定义的ID
ObjectId blockId = tr.BlockTable["MyBlock"];

if (!blockId.IsNull)
{
    // 创建块参照
    var blockRef = new BlockReference(new Point3d(50, 50, 0), blockId);
    
    // 添加到当前空间
    tr.CurrentSpace.AddEntity(blockRef);
}
```

### 2.3.3 图层表操作

**创建图层**

```csharp
using var tr = new DBTrans();

// 创建新图层
tr.LayerTable.Add("MyLayer", layer =>
{
    layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 1); // 红色
    layer.LineWeight = LineWeight.LineWeight030;
    layer.Description = "我的图层";
});
```

**检查图层是否存在**

```csharp
using var tr = new DBTrans();

if (tr.LayerTable.Has("MyLayer"))
{
    tr.Editor?.WriteMessage("\n图层已存在！");
}
else
{
    tr.LayerTable.Add("MyLayer");
}
```

**修改图层属性**

```csharp
using var tr = new DBTrans();

tr.LayerTable.Change("MyLayer", layer =>
{
    layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 3); // 绿色
    layer.IsFrozen = false;
    layer.IsOff = false;
    layer.IsLocked = false;
});
```

**删除图层**

```csharp
using var tr = new DBTrans();

// 删除图层（注意：只能删除未使用且非系统图层）
tr.LayerTable.Remove("MyLayer");
```

### 2.3.4 其他符号表操作

**线型表操作**

```csharp
using var tr = new DBTrans();

// 加载线型（如果不存在）
if (!tr.LinetypeTable.Has("DASHED"))
{
    tr.Database.LoadLineTypeFile("DASHED", "acad.lin");
}

// 使用线型
var line = new Line(Point3d.Origin, new Point3d(100, 0, 0));
line.LinetypeId = tr.LinetypeTable["DASHED"];
tr.CurrentSpace.AddEntity(line);
```

**文字样式表操作**

```csharp
using var tr = new DBTrans();

// 创建文字样式
tr.TextStyleTable.Add("MyTextStyle", style =>
{
    style.FileName = "simhei.ttf"; // 使用黑体
    style.BigFontFileName = "";
    style.TextSize = 2.5;
});

// 使用文字样式创建文字
var text = new DBText();
text.TextString = "Hello IFoxCAD";
text.Position = new Point3d(0, 0, 0);
text.Height = 5;
text.TextStyleId = tr.TextStyleTable["MyTextStyle"];
tr.CurrentSpace.AddEntity(text);
```

**标注样式表操作**

```csharp
using var tr = new DBTrans();

// 创建标注样式
tr.DimStyleTable.Add("MyDimStyle", dimStyle =>
{
    dimStyle.Dimtxt = 2.5;      // 文字高度
    dimStyle.Dimasz = 2.5;      // 箭头大小
    dimStyle.Dimexe = 1.25;     // 尺寸界线超出量
    dimStyle.Dimexo = 0.625;    // 尺寸界线偏移量
});
```

## 2.4 字典操作

### 2.4.1 命名字典概述

除了符号表，AutoCAD数据库还包含多个命名字典用于存储各种非图形数据。DBTrans提供了以下字典属性：

| 字典 | DBTrans属性 | 说明 |
|------|-------------|------|
| 命名对象字典 | NamedObjectsDict | 根字典 |
| 组字典 | GroupDict | 存储组定义 |
| 布局字典 | LayoutDict | 存储布局 |
| 材质字典 | MaterialDict | 存储材质 |
| 多重引线样式字典 | MLeaderStyleDict | 存储多重引线样式 |
| 多线样式字典 | MLStyleDict | 存储多线样式 |
| 表格样式字典 | TableStyleDict | 存储表格样式 |
| 视觉样式字典 | VisualStyleDict | 存储视觉样式 |
| 打印设置字典 | PlotSettingsDict | 存储打印设置 |
| 颜色字典 | ColorDict | 存储命名颜色 |

### 2.4.2 组操作

组是将多个图元关联在一起的方式，通过GroupDict可以管理组。

```csharp
using var tr = new DBTrans();

// 创建一些图元
var line = new Line(Point3d.Origin, new Point3d(100, 0, 0));
var circle = new Circle(new Point3d(50, 0, 0), Vector3d.ZAxis, 10);

tr.CurrentSpace.AddEntity(line);
tr.CurrentSpace.AddEntity(circle);

// 创建组
using (tr.GroupDict.ForWrite())
{
    var group = new Group("我的组", true);
    tr.GroupDict.SetAt("MyGroup", group);
    tr.Transaction.AddNewlyCreatedDBObject(group, true);
    
    // 将图元添加到组
    group.Append(new ObjectId[] { line.ObjectId, circle.ObjectId });
}
```

### 2.4.3 自定义字典

可以在命名对象字典下创建自定义字典来存储应用程序数据。

```csharp
using var tr = new DBTrans();

// 获取或创建自定义字典
DBDictionary myDict;
if (tr.NamedObjectsDict.Contains("MyAppDict"))
{
    myDict = tr.GetObject<DBDictionary>(tr.NamedObjectsDict.GetAt("MyAppDict"));
}
else
{
    using (tr.NamedObjectsDict.ForWrite())
    {
        myDict = new DBDictionary();
        tr.NamedObjectsDict.SetAt("MyAppDict", myDict);
        tr.Transaction.AddNewlyCreatedDBObject(myDict, true);
    }
}

// 在自定义字典中存储数据
using (myDict.ForWrite())
{
    var xrec = new Xrecord();
    xrec.Data = new ResultBuffer(
        new TypedValue((int)DxfCode.Text, "Hello"),
        new TypedValue((int)DxfCode.Int32, 123)
    );
    myDict.SetAt("MyData", xrec);
    tr.Transaction.AddNewlyCreatedDBObject(xrec, true);
}
```

## 2.5 前台与后台任务处理

### 2.5.1 前台后台的区别

在CAD二次开发中，有两种操作模式：

**前台操作**

前台操作是在当前打开的文档中进行操作。用户可以看到操作的结果，操作受到文档锁的限制。

**后台操作**

后台操作是在没有打开的文档上进行操作，通常用于批量处理文件。用户看不到操作的过程，但处理速度更快。

### 2.5.2 Task方法的使用

DBTrans提供了Task方法来统一处理前台和后台任务的差异：

```csharp
public void Task(Action action, bool handlingDBTextDeviation = true)
```

参数说明：
- `action`：要执行的操作委托
- `handlingDBTextDeviation`：是否处理单行文字偏移问题，默认为true

使用示例：

```csharp
using var tr = new DBTrans("C:\\drawing.dwg");

tr.Task(() =>
{
    // 这里的代码在前台和后台都能正确执行
    // 自动处理单行文字偏移等问题
    
    foreach (var id in tr.ModelSpace)
    {
        var ent = tr.GetObject<Entity>(id);
        if (ent is DBText text)
        {
            // 处理文字...
        }
    }
});
```

### 2.5.3 文件批量处理示例

```csharp
[CommandMethod("BatchProcess", CommandFlags.Session)]
public void BatchProcess()
{
    var files = Directory.GetFiles("C:\\Drawings", "*.dwg");
    
    foreach (var file in files)
    {
        using var tr = new DBTrans(file);
        
        tr.Task(() =>
        {
            // 处理每个文件
            // 例如：统一修改图层颜色
            tr.LayerTable.Change("0", layer =>
            {
                layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 7);
            });
        });
        
        // 保存更改
        tr.Database.SaveAs(file, DwgVersion.Current);
    }
}
```

## 2.6 事务的提交与取消

### 2.6.1 自动提交

默认情况下，DBTrans在Dispose时会自动提交事务：

```csharp
using var tr = new DBTrans(); // commit参数默认为true

var line = new Line(Point3d.Origin, new Point3d(100, 100, 0));
tr.CurrentSpace.AddEntity(line);

// using块结束时自动提交
```

### 2.6.2 手动控制提交

可以通过构造函数参数禁用自动提交，然后手动控制：

```csharp
using var tr = new DBTrans(commit: false);

try
{
    var line = new Line(Point3d.Origin, new Point3d(100, 100, 0));
    tr.CurrentSpace.AddEntity(line);
    
    // 验证操作
    if (ValidateOperation())
    {
        tr.Commit(); // 手动提交
    }
    else
    {
        tr.Abort(); // 取消事务
    }
}
catch (Exception ex)
{
    tr.Abort(); // 发生异常时取消
    throw;
}
```

### 2.6.3 Commit和Abort方法

**Commit方法**

```csharp
public void Commit()
{
    _commit = true;
    Dispose();
}
```

调用Commit会设置提交标志并触发Dispose，事务中的更改会被保存。

**Abort方法**

```csharp
public void Abort()
{
    _commit = false;
    Dispose();
}
```

调用Abort会清除提交标志并触发Dispose，事务中的更改会被回滚。

## 2.7 最佳实践

### 2.7.1 事务的作用域

**原则1：尽量减少事务的作用域**

事务应该尽可能短，只包含必要的数据库操作：

```csharp
// 好的做法
public void GoodPractice()
{
    // 准备数据（不需要事务）
    var points = CalculatePoints();
    
    // 只在数据库操作时使用事务
    using var tr = new DBTrans();
    foreach (var pt in points)
    {
        var circle = new Circle(pt, Vector3d.ZAxis, 10);
        tr.CurrentSpace.AddEntity(circle);
    }
}

// 不好的做法
public void BadPractice()
{
    using var tr = new DBTrans();
    
    // 复杂的计算在事务中进行（不必要）
    var points = CalculateComplexPoints(); // 耗时操作
    
    foreach (var pt in points)
    {
        var circle = new Circle(pt, Vector3d.ZAxis, 10);
        tr.CurrentSpace.AddEntity(circle);
    }
}
```

**原则2：避免嵌套事务**

虽然DBTrans支持嵌套，但应尽量避免：

```csharp
// 不推荐的嵌套方式
using var tr1 = new DBTrans();
using var tr2 = new DBTrans(); // 嵌套事务

// 推荐的方式：复用同一个事务
using var tr = new DBTrans();
DoOperation1(tr);
DoOperation2(tr);
```

### 2.7.2 异常处理

**使用try-catch处理异常**

```csharp
[CommandMethod("SafeOperation")]
public void SafeOperation()
{
    try
    {
        using var tr = new DBTrans(commit: false);
        
        // 执行操作
        PerformDatabaseOperations(tr);
        
        // 操作成功则提交
        tr.Commit();
    }
    catch (System.Exception ex)
    {
        // 事务会自动回滚
        Application.ShowAlertDialog($"操作失败：{ex.Message}");
    }
}
```

### 2.7.3 文档锁处理

在需要跨文档操作或从外部事件触发操作时，需要锁定文档：

```csharp
// 使用docLock参数
using var tr = new DBTrans(doc, true, docLock: true);

// 或者手动锁定
using (doc.LockDocument())
using (var tr = new DBTrans(doc))
{
    // 操作...
}
```

### 2.7.4 性能优化

**批量添加图元**

```csharp
using var tr = new DBTrans();

// 好的做法：使用批量添加
var entities = CreateManyEntities();
tr.CurrentSpace.AddEntity(entities);

// 不推荐：循环中单个添加
foreach (var ent in entities)
{
    tr.CurrentSpace.AddEntity(ent);
}
```

**延迟打开写模式**

```csharp
using var tr = new DBTrans();

// 先读取，判断后再写
var layer = tr.LayerTable.GetRecord("MyLayer");
if (layer != null && layer.Color.ColorIndex != 1)
{
    using (layer.ForWrite()) // 需要修改时才打开写模式
    {
        layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 1);
    }
}
```

## 2.8 本章小结

本章我们深入学习了DBTrans事务管理类，这是IFoxCAD最核心的类：

1. **事务机制基础**：理解了事务的概念和CAD原生事务的使用方式
2. **DBTrans类详解**：学习了DBTrans的结构、构造函数、事务栈机制和获取对象方法
3. **符号表操作**：掌握了通过DBTrans操作九大符号表的方法
4. **字典操作**：学习了命名字典和自定义字典的使用
5. **前台后台任务**：理解了Task方法的作用和文件批量处理
6. **事务控制**：掌握了事务的提交、取消和手动控制
7. **最佳实践**：学习了事务使用的各种最佳实践

通过DBTrans，我们可以用简洁的代码完成复杂的数据库操作。下一章我们将深入学习SymbolTable类，进一步掌握符号表的高级操作技巧。

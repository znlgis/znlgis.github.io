# 第三章：SymbolTable符号表操作教程

## 3.1 符号表基础概念

### 3.1.1 什么是符号表

在AutoCAD数据库中，符号表（Symbol Table）是一种特殊的容器对象，用于存储和管理各种定义信息。每个符号表包含多个符号表记录（Symbol Table Record），每个记录代表一个具体的定义，如图层定义、块定义、线型定义等。

符号表的设计类似于数据库中的表和记录的关系：
- **符号表（Symbol Table）**：相当于数据库中的表
- **符号表记录（Symbol Table Record）**：相当于表中的记录
- **记录名称（Name）**：相当于记录的主键

AutoCAD数据库中共有九个符号表，它们在数据库创建时就自动存在，不能被删除或添加新的符号表。

### 3.1.2 九大符号表详解

**1. BlockTable（块表）**

块表是最重要的符号表，存储所有的块定义。每个BlockTableRecord代表一个块定义，包含组成该块的所有图元。特别的是，模型空间（ModelSpace）和图纸空间（PaperSpace）也是块表记录。

```
BlockTable
├── *Model_Space（模型空间）
├── *Paper_Space（默认图纸空间）
├── *Paper_Space0（布局1的图纸空间）
├── 自定义块1
├── 自定义块2
└── ...
```

**2. LayerTable（图层表）**

图层表存储所有的图层定义。每个LayerTableRecord代表一个图层，包含图层的名称、颜色、线型、线宽等属性。

```
LayerTable
├── 0（默认图层，不可删除）
├── Defpoints（标注定义点图层）
├── 自定义图层1
└── ...
```

**3. LinetypeTable（线型表）**

线型表存储所有的线型定义。每个LinetypeTableRecord代表一种线型模式。

```
LinetypeTable
├── Continuous（连续线，默认）
├── ByLayer（随层）
├── ByBlock（随块）
├── DASHED（虚线）
└── ...
```

**4. TextStyleTable（文字样式表）**

文字样式表存储所有的文字样式定义。每个TextStyleTableRecord定义了字体、高度、宽度因子等属性。

```
TextStyleTable
├── Standard（标准样式）
├── Annotative（注释性样式）
└── ...
```

**5. DimStyleTable（标注样式表）**

标注样式表存储所有的标注样式定义。每个DimStyleTableRecord定义了标注的各种参数。

```
DimStyleTable
├── Standard（标准样式）
├── Annotative（注释性样式）
└── ...
```

**6. RegAppTable（注册应用程序表）**

注册应用程序表存储所有注册的应用程序名称，用于扩展数据（XData）的管理。

```
RegAppTable
├── ACAD（AutoCAD）
├── 自定义应用程序名
└── ...
```

**7. UcsTable（用户坐标系表）**

用户坐标系表存储所有的用户坐标系定义。每个UcsTableRecord定义了一个坐标系的原点和轴方向。

**8. ViewTable（视图表）**

视图表存储所有命名视图的定义。每个ViewTableRecord保存了视图的位置、范围等信息。

**9. ViewportTable（视口表）**

视口表存储视口配置信息。每个ViewportTableRecord定义了一个视口的配置。

### 3.1.3 CAD原生符号表操作的问题

在使用CAD原生API操作符号表时，存在以下问题：

**问题1：符号表和记录是分离的**

在CAD的API中，符号表和符号表记录在类型上是独立的，没有直接的关联关系：

```csharp
// 原生API的问题：需要手动关联符号表和记录
BlockTable bt = tr.GetObject(db.BlockTableId, OpenMode.ForRead) as BlockTable;
ObjectId btrId = bt[BlockTableRecord.ModelSpace];
BlockTableRecord btr = tr.GetObject(btrId, OpenMode.ForWrite) as BlockTableRecord;
```

**问题2：类型不统一**

不同的符号表需要使用不同的类型，但操作方式类似：

```csharp
// 操作块表
BlockTable bt = tr.GetObject(db.BlockTableId, ...) as BlockTable;
BlockTableRecord btr = ...

// 操作图层表
LayerTable lt = tr.GetObject(db.LayerTableId, ...) as LayerTable;
LayerTableRecord ltr = ...

// 代码重复度高
```

**问题3：添加记录步骤繁琐**

每次添加符号表记录都需要多个步骤：

```csharp
// 1. 创建记录
var ltr = new LayerTableRecord();
ltr.Name = "MyLayer";

// 2. 打开符号表写模式
LayerTable lt = tr.GetObject(db.LayerTableId, OpenMode.ForWrite) as LayerTable;

// 3. 添加记录
ObjectId id = lt.Add(ltr);

// 4. 添加到事务
tr.AddNewlyCreatedDBObject(ltr, true);
```

## 3.2 IFoxCAD的SymbolTable类

### 3.2.1 SymbolTable类的设计理念

IFoxCAD的SymbolTable类解决了上述问题，它的设计理念是：

1. **统一接口**：使用泛型类统一处理所有符号表
2. **简化操作**：封装常用操作，减少样板代码
3. **类型安全**：利用泛型确保类型正确
4. **链式调用**：支持流畅的API设计

### 3.2.2 SymbolTable类的结构

```csharp
public class SymbolTable<TTable, TRecord> : IEnumerable<ObjectId> 
    where TTable : SymbolTable
    where TRecord : SymbolTableRecord, new()
{
    // 属性
    public TTable CurrentSymbolTable { get; }        // 当前符号表对象
    internal Database Database { get; }               // 数据库对象
    
    // 索引器
    public ObjectId this[string key] { get; }        // 通过名称获取记录ID
    
    // 判断方法
    public bool Has(string key);                      // 判断记录是否存在
    public bool Has(ObjectId objectId);               // 判断ID是否有效
    
    // 添加方法
    public ObjectId Add(TRecord record);              // 添加记录对象
    public ObjectId Add(string name, Action<TRecord>? action = null);  // 添加命名记录
    public ObjectId AddOrChange(string name, Action<TRecord> action);  // 添加或修改
    
    // 删除方法
    public void Remove(string name);                  // 按名称删除
    public void Remove(ObjectId id);                  // 按ID删除
    
    // 修改方法
    public void Change(string name, Action<TRecord> action);    // 按名称修改
    public void Change(ObjectId id, Action<TRecord> action);    // 按ID修改
    
    // 获取方法
    public TRecord? GetRecord(ObjectId id, ...);      // 获取记录对象
    public TRecord? GetRecord(string name, ...);      // 获取记录对象
    public IEnumerable<TRecord> GetRecords();         // 获取所有记录
    public IEnumerable<string> GetRecordNames();      // 获取所有记录名称
    
    // 遍历方法
    public void ForEach(Action<TRecord> task, ...);   // 遍历执行
}
```

### 3.2.3 通过DBTrans访问符号表

DBTrans为每个符号表都提供了对应的属性，返回泛型化的SymbolTable对象：

```csharp
using var tr = new DBTrans();

// 访问各种符号表
var blockTable = tr.BlockTable;           // SymbolTable<BlockTable, BlockTableRecord>
var layerTable = tr.LayerTable;           // SymbolTable<LayerTable, LayerTableRecord>
var linetypeTable = tr.LinetypeTable;     // SymbolTable<LinetypeTable, LinetypeTableRecord>
var textStyleTable = tr.TextStyleTable;   // SymbolTable<TextStyleTable, TextStyleTableRecord>
var dimStyleTable = tr.DimStyleTable;     // SymbolTable<DimStyleTable, DimStyleTableRecord>
var regAppTable = tr.RegAppTable;         // SymbolTable<RegAppTable, RegAppTableRecord>
var ucsTable = tr.UcsTable;               // SymbolTable<UcsTable, UcsTableRecord>
var viewTable = tr.ViewTable;             // SymbolTable<ViewTable, ViewTableRecord>
var viewportTable = tr.ViewportTable;     // SymbolTable<ViewportTable, ViewportTableRecord>
```

## 3.3 索引器与Has方法

### 3.3.1 索引器的使用

SymbolTable提供了索引器，可以通过名称获取符号表记录的ObjectId：

```csharp
using var tr = new DBTrans();

// 获取图层的ID
ObjectId layerId = tr.LayerTable["0"];  // 获取默认图层的ID

// 获取块定义的ID
ObjectId blockId = tr.BlockTable["MyBlock"];

// 如果不存在，返回ObjectId.Null
ObjectId notExistId = tr.LayerTable["NotExist"];
if (notExistId.IsNull)
{
    tr.Editor?.WriteMessage("\n记录不存在！");
}
```

索引器的实现很简单：

```csharp
public ObjectId this[string key] => Has(key) ? CurrentSymbolTable[key] : ObjectId.Null;
```

### 3.3.2 Has方法的使用

Has方法用于检查符号表记录是否存在：

```csharp
using var tr = new DBTrans();

// 检查图层是否存在
if (tr.LayerTable.Has("MyLayer"))
{
    tr.Editor?.WriteMessage("\n图层存在");
}

// 检查块定义是否存在
if (tr.BlockTable.Has("MyBlock"))
{
    tr.Editor?.WriteMessage("\n块定义存在");
}

// 也可以通过ID检查
ObjectId someId = GetSomeObjectId();
if (tr.LayerTable.Has(someId))
{
    tr.Editor?.WriteMessage("\n这个ID属于图层表");
}
```

Has方法的实现利用了底层符号表的Has方法：

```csharp
public bool Has(string key)
{
    return CurrentSymbolTable.Has(key);
}

public bool Has(ObjectId objectId)
{
    return CurrentSymbolTable.Has(objectId);
}
```

## 3.4 添加符号表记录

### 3.4.1 Add方法详解

SymbolTable提供了多种Add方法来添加符号表记录。

**方法1：添加已创建的记录对象**

```csharp
public ObjectId Add(TRecord record)
```

使用示例：

```csharp
using var tr = new DBTrans();

// 创建图层对象
var layer = new LayerTableRecord();
layer.Name = "MyLayer";
layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 1);

// 添加到图层表
ObjectId layerId = tr.LayerTable.Add(layer);
```

**方法2：使用名称和委托添加**

```csharp
public ObjectId Add(string name, Action<TRecord>? action = null)
```

这是最常用的方法，它会自动创建记录对象，设置名称，并执行配置委托：

```csharp
using var tr = new DBTrans();

// 简单添加（只指定名称）
tr.LayerTable.Add("Layer1");

// 添加并配置
tr.LayerTable.Add("Layer2", layer =>
{
    layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 2);
    layer.LineWeight = LineWeight.LineWeight050;
    layer.Description = "这是第二个图层";
});
```

如果记录已存在，Add方法会直接返回现有记录的ID，不会重复添加：

```csharp
using var tr = new DBTrans();

// 第一次添加
ObjectId id1 = tr.LayerTable.Add("MyLayer");

// 第二次添加（相同名称）
ObjectId id2 = tr.LayerTable.Add("MyLayer");

// id1 == id2，不会创建新记录
```

### 3.4.2 AddOrChange方法

AddOrChange方法会在记录不存在时添加，存在时修改：

```csharp
public ObjectId AddOrChange(string name, Action<TRecord> action)
```

使用示例：

```csharp
using var tr = new DBTrans();

// 确保图层存在并设置属性
// 如果不存在则创建，如果存在则修改
tr.LayerTable.AddOrChange("MyLayer", layer =>
{
    layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 3);
    layer.IsOff = false;
    layer.IsFrozen = false;
});
```

### 3.4.3 块表的特殊处理

块表的添加有一些特殊之处，因为我们通常需要在块定义中添加图元：

```csharp
using var tr = new DBTrans();

// 创建块定义
tr.BlockTable.Add("MyBlock", btr =>
{
    // 创建块内的图元
    var line = new Line(Point3d.Origin, new Point3d(10, 10, 0));
    var circle = new Circle(Point3d.Origin, Vector3d.ZAxis, 5);
    
    // 添加图元到块定义
    btr.AppendEntity(line);
    tr.Transaction.AddNewlyCreatedDBObject(line, true);
    
    btr.AppendEntity(circle);
    tr.Transaction.AddNewlyCreatedDBObject(circle, true);
    
    // 可以添加属性定义
    var attDef = new AttributeDefinition();
    attDef.Position = new Point3d(0, -5, 0);
    attDef.Tag = "NAME";
    attDef.Prompt = "输入名称";
    attDef.TextString = "默认值";
    attDef.Height = 2.5;
    
    btr.AppendEntity(attDef);
    tr.Transaction.AddNewlyCreatedDBObject(attDef, true);
});
```

**添加图元到模型空间**

对于将图元添加到模型空间，IFoxCAD提供了更简便的扩展方法：

```csharp
using var tr = new DBTrans();

// 使用扩展方法添加图元
var line = new Line(Point3d.Origin, new Point3d(100, 100, 0));
tr.CurrentSpace.AddEntity(line);  // 扩展方法，自动处理事务
```

## 3.5 删除符号表记录

### 3.5.1 Remove方法

SymbolTable提供了Remove方法来删除符号表记录：

```csharp
using var tr = new DBTrans();

// 按名称删除
tr.LayerTable.Remove("MyLayer");

// 按ID删除
ObjectId layerId = tr.LayerTable["SomeLayer"];
tr.LayerTable.Remove(layerId);
```

### 3.5.2 图层删除的特殊处理

图层的删除有特殊的限制：
1. 不能删除图层"0"和"Defpoints"
2. 不能删除正在使用的图层（有图元在该图层上）
3. 不能删除当前图层

SymbolTable的Remove方法对图层表做了特殊处理：

```csharp
if (CurrentSymbolTable is LayerTable lt)
{
    // 检查是否为系统图层
    if (SymbolUtilityServices.IsLayerZeroName(name) ||
        SymbolUtilityServices.IsLayerDefpointsName(name))
        return;
    
    // 生成使用数据
    lt.GenerateUsageData();
    
    // 检查是否被使用
    if (GetRecord(name) is not LayerTableRecord { IsUsed: false } ltr)
        return;
    
    using (ltr.ForWrite())
    {
        ltr.Erase();
    }
    return;
}
```

### 3.5.3 安全删除实践

在删除符号表记录之前，建议先检查是否可以删除：

```csharp
using var tr = new DBTrans();

// 安全删除图层
string layerName = "MyLayer";

// 检查是否存在
if (!tr.LayerTable.Has(layerName))
{
    tr.Editor?.WriteMessage("\n图层不存在！");
    return;
}

// 获取图层记录
var layer = tr.LayerTable.GetRecord(layerName);
if (layer == null) return;

// 检查是否为系统图层
if (SymbolUtilityServices.IsLayerZeroName(layerName) ||
    SymbolUtilityServices.IsLayerDefpointsName(layerName))
{
    tr.Editor?.WriteMessage("\n不能删除系统图层！");
    return;
}

// 尝试删除
try
{
    tr.LayerTable.Remove(layerName);
    tr.Editor?.WriteMessage($"\n图层 {layerName} 已删除！");
}
catch (Exception ex)
{
    tr.Editor?.WriteMessage($"\n删除失败：{ex.Message}");
}
```

## 3.6 修改符号表记录

### 3.6.1 Change方法

SymbolTable提供了Change方法来修改符号表记录：

```csharp
using var tr = new DBTrans();

// 按名称修改
tr.LayerTable.Change("MyLayer", layer =>
{
    layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 5);
    layer.LineWeight = LineWeight.LineWeight100;
});

// 按ID修改
ObjectId layerId = tr.LayerTable["MyLayer"];
tr.LayerTable.Change(layerId, layer =>
{
    layer.IsOff = true;
});
```

Change方法会自动处理写模式的打开和关闭：

```csharp
public void Change(string name, Action<TRecord> action)
{
    var record = GetRecord(name);
    if (record is null) return;
    using (record.ForWrite())  // 自动打开写模式
        action.Invoke(record);  // 执行修改
    // 自动关闭写模式
}
```

### 3.6.2 批量修改

可以使用ForEach方法进行批量修改：

```csharp
using var tr = new DBTrans();

// 将所有图层颜色改为白色
tr.LayerTable.ForEach(layer =>
{
    using (layer.ForWrite())
    {
        layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 7);
    }
});

// 冻结所有以"Temp"开头的图层
tr.LayerTable.ForEach(layer =>
{
    if (layer.Name.StartsWith("Temp"))
    {
        using (layer.ForWrite())
        {
            layer.IsFrozen = true;
        }
    }
});
```

### 3.6.3 条件修改

可以结合LINQ进行条件修改：

```csharp
using var tr = new DBTrans();

// 获取所有红色图层并改为蓝色
var redLayers = tr.LayerTable.GetRecords()
    .Where(l => l.Color.ColorIndex == 1);

foreach (var layer in redLayers)
{
    using (layer.ForWrite())
    {
        layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 5);
    }
}
```

## 3.7 获取符号表记录

### 3.7.1 GetRecord方法

GetRecord方法用于获取符号表记录对象：

```csharp
using var tr = new DBTrans();

// 按名称获取
LayerTableRecord? layer = tr.LayerTable.GetRecord("MyLayer");
if (layer != null)
{
    tr.Editor?.WriteMessage($"\n图层颜色：{layer.Color}");
}

// 按ID获取
ObjectId layerId = tr.LayerTable["MyLayer"];
LayerTableRecord? layer2 = tr.LayerTable.GetRecord(layerId);

// 以写模式获取
LayerTableRecord? layerForWrite = tr.LayerTable.GetRecord(
    "MyLayer", 
    OpenMode.ForWrite);
layerForWrite?.SetColor(Color.FromRgb(255, 0, 0));
```

### 3.7.2 GetRecords方法

GetRecords方法返回所有符号表记录：

```csharp
using var tr = new DBTrans();

// 获取所有图层
foreach (var layer in tr.LayerTable.GetRecords())
{
    tr.Editor?.WriteMessage($"\n图层：{layer.Name}, 颜色：{layer.Color.ColorIndex}");
}

// 使用LINQ筛选
var frozenLayers = tr.LayerTable.GetRecords()
    .Where(l => l.IsFrozen)
    .Select(l => l.Name);

tr.Editor?.WriteMessage($"\n冻结的图层：{string.Join(", ", frozenLayers)}");
```

### 3.7.3 GetRecordNames方法

GetRecordNames方法返回所有记录的名称：

```csharp
using var tr = new DBTrans();

// 获取所有图层名称
var layerNames = tr.LayerTable.GetRecordNames();
tr.Editor?.WriteMessage($"\n图层列表：{string.Join(", ", layerNames)}");

// 使用过滤器获取满足条件的名称
var tempLayerNames = tr.LayerTable.GetRecordNames(
    layer => layer.Name.StartsWith("Temp"));
```

### 3.7.4 从其他文件获取记录

SymbolTable提供了从其他文件复制符号表记录的方法：

```csharp
using var tr = new DBTrans();

// 从外部文件复制块定义
ObjectId blockId = tr.BlockTable.GetRecordFrom(
    t => t.BlockTable,              // 选择块表
    "C:\\Templates\\blocks.dwg",    // 源文件
    "MyBlock",                      // 记录名称
    true);                          // 是否覆盖

// 从外部文件复制图层
ObjectId layerId = tr.LayerTable.GetRecordFrom(
    t => t.LayerTable,
    "C:\\Templates\\layers.dwg",
    "StandardLayer",
    false);  // 不覆盖已存在的
```

## 3.8 遍历符号表

### 3.8.1 使用foreach遍历

SymbolTable实现了IEnumerable<ObjectId>接口，可以直接使用foreach遍历：

```csharp
using var tr = new DBTrans();

// 遍历所有图层ID
foreach (ObjectId id in tr.LayerTable)
{
    var layer = tr.LayerTable.GetRecord(id);
    if (layer != null)
    {
        tr.Editor?.WriteMessage($"\n{layer.Name}");
    }
}
```

### 3.8.2 使用ForEach方法

ForEach方法提供了更方便的遍历方式：

**基本用法**

```csharp
using var tr = new DBTrans();

tr.LayerTable.ForEach(layer =>
{
    tr.Editor?.WriteMessage($"\n图层：{layer.Name}");
});
```

**支持中断的遍历**

```csharp
using var tr = new DBTrans();

// 查找第一个红色图层
string? foundLayer = null;
tr.LayerTable.ForEach((layer, state) =>
{
    if (layer.Color.ColorIndex == 1)
    {
        foundLayer = layer.Name;
        state.Break();  // 中断遍历
    }
});

if (foundLayer != null)
{
    tr.Editor?.WriteMessage($"\n找到红色图层：{foundLayer}");
}
```

**带索引的遍历**

```csharp
using var tr = new DBTrans();

tr.LayerTable.ForEach((layer, state, index) =>
{
    tr.Editor?.WriteMessage($"\n{index}: {layer.Name}");
});
```

**控制打开模式**

```csharp
using var tr = new DBTrans();

// 以写模式遍历
tr.LayerTable.ForEach(layer =>
{
    layer.Description = $"更新于 {DateTime.Now}";
}, OpenMode.ForWrite);
```

### 3.8.3 LINQ查询

结合LINQ可以进行更复杂的查询：

```csharp
using var tr = new DBTrans();

// 统计各颜色图层数量
var colorStats = tr.LayerTable.GetRecords()
    .GroupBy(l => l.Color.ColorIndex)
    .Select(g => new { Color = g.Key, Count = g.Count() });

foreach (var stat in colorStats)
{
    tr.Editor?.WriteMessage($"\n颜色 {stat.Color}：{stat.Count} 个图层");
}

// 查找未使用的图层
tr.LayerTable.CurrentSymbolTable.GenerateUsageData();
var unusedLayers = tr.LayerTable.GetRecords()
    .Where(l => !l.IsUsed && !l.Name.Equals("0"))
    .Select(l => l.Name);

tr.Editor?.WriteMessage($"\n未使用的图层：{string.Join(", ", unusedLayers)}");
```

## 3.9 实际应用案例

### 3.9.1 图层管理器

```csharp
public class LayerManager
{
    /// <summary>
    /// 创建标准图层集
    /// </summary>
    public static void CreateStandardLayers()
    {
        using var tr = new DBTrans();
        
        // 定义标准图层
        var standardLayers = new[]
        {
            ("墙体", 1, LineWeight.LineWeight030),
            ("门窗", 2, LineWeight.LineWeight018),
            ("标注", 3, LineWeight.LineWeight009),
            ("文字", 4, LineWeight.LineWeight009),
            ("辅助线", 8, LineWeight.LineWeight000)
        };
        
        foreach (var (name, color, weight) in standardLayers)
        {
            tr.LayerTable.Add(name, layer =>
            {
                layer.Color = Color.FromColorIndex(ColorMethod.ByAci, (short)color);
                layer.LineWeight = weight;
            });
        }
        
        tr.Editor?.WriteMessage("\n标准图层创建完成！");
    }
    
    /// <summary>
    /// 清理未使用的图层
    /// </summary>
    public static void CleanupUnusedLayers()
    {
        using var tr = new DBTrans();
        
        // 生成使用数据
        tr.LayerTable.CurrentSymbolTable.GenerateUsageData();
        
        // 获取未使用的图层
        var unusedLayers = tr.LayerTable.GetRecords()
            .Where(l => !l.IsUsed && 
                       !SymbolUtilityServices.IsLayerZeroName(l.Name) &&
                       !SymbolUtilityServices.IsLayerDefpointsName(l.Name))
            .Select(l => l.Name)
            .ToList();
        
        // 删除未使用的图层
        foreach (var name in unusedLayers)
        {
            tr.LayerTable.Remove(name);
        }
        
        tr.Editor?.WriteMessage($"\n已删除 {unusedLayers.Count} 个未使用的图层");
    }
    
    /// <summary>
    /// 导出图层设置
    /// </summary>
    public static void ExportLayerSettings(string filePath)
    {
        using var tr = new DBTrans();
        
        var settings = tr.LayerTable.GetRecords()
            .Select(l => new
            {
                Name = l.Name,
                Color = l.Color.ColorIndex,
                LineWeight = l.LineWeight.ToString(),
                IsOff = l.IsOff,
                IsFrozen = l.IsFrozen
            })
            .ToList();
        
        // 导出为JSON（需要引用System.Text.Json）
        var json = System.Text.Json.JsonSerializer.Serialize(settings);
        System.IO.File.WriteAllText(filePath, json);
        
        tr.Editor?.WriteMessage($"\n图层设置已导出到：{filePath}");
    }
}
```

### 3.9.2 块库管理器

```csharp
public class BlockLibraryManager
{
    /// <summary>
    /// 从外部文件导入块
    /// </summary>
    public static ObjectId ImportBlock(string sourceFile, string blockName)
    {
        using var tr = new DBTrans();
        
        // 检查块是否已存在
        if (tr.BlockTable.Has(blockName))
        {
            tr.Editor?.WriteMessage($"\n块 {blockName} 已存在，使用现有块");
            return tr.BlockTable[blockName];
        }
        
        // 从文件导入
        return tr.BlockTable.GetRecordFrom(
            t => t.BlockTable,
            sourceFile,
            blockName,
            false);
    }
    
    /// <summary>
    /// 列出所有用户定义的块
    /// </summary>
    public static void ListUserBlocks()
    {
        using var tr = new DBTrans();
        
        var userBlocks = tr.BlockTable.GetRecords()
            .Where(btr => !btr.IsAnonymous && 
                         !btr.IsLayout &&
                         !btr.Name.StartsWith("*"))
            .Select(btr => new
            {
                Name = btr.Name,
                EntityCount = btr.Cast<ObjectId>().Count(),
                HasAttributes = btr.HasAttributeDefinitions
            });
        
        tr.Editor?.WriteMessage("\n用户定义的块：");
        foreach (var block in userBlocks)
        {
            tr.Editor?.WriteMessage(
                $"\n  {block.Name}: {block.EntityCount} 个图元" +
                (block.HasAttributes ? " (含属性)" : ""));
        }
    }
    
    /// <summary>
    /// 清理未使用的块
    /// </summary>
    public static void PurgeUnusedBlocks()
    {
        using var tr = new DBTrans();
        
        // 收集块参照计数
        var blockRefCounts = new Dictionary<string, int>();
        
        // 遍历模型空间
        foreach (ObjectId id in tr.ModelSpace)
        {
            var ent = tr.GetObject<Entity>(id);
            if (ent is BlockReference br)
            {
                var btr = tr.BlockTable.GetRecord(br.BlockTableRecord);
                if (btr != null)
                {
                    if (!blockRefCounts.ContainsKey(btr.Name))
                        blockRefCounts[btr.Name] = 0;
                    blockRefCounts[btr.Name]++;
                }
            }
        }
        
        // 删除未使用的块
        var unusedBlocks = tr.BlockTable.GetRecords()
            .Where(btr => !btr.IsAnonymous && 
                         !btr.IsLayout &&
                         !btr.Name.StartsWith("*") &&
                         !blockRefCounts.ContainsKey(btr.Name))
            .Select(btr => btr.Name)
            .ToList();
        
        foreach (var name in unusedBlocks)
        {
            tr.BlockTable.Remove(name);
        }
        
        tr.Editor?.WriteMessage($"\n已清理 {unusedBlocks.Count} 个未使用的块");
    }
}
```

### 3.9.3 线型和样式管理

```csharp
public class StyleManager
{
    /// <summary>
    /// 确保必需的线型已加载
    /// </summary>
    public static void EnsureLinetypes()
    {
        using var tr = new DBTrans();
        
        var requiredLinetypes = new[] { "DASHED", "CENTER", "HIDDEN", "PHANTOM" };
        
        foreach (var ltName in requiredLinetypes)
        {
            if (!tr.LinetypeTable.Has(ltName))
            {
                try
                {
                    tr.Database.LoadLineTypeFile(ltName, "acad.lin");
                    tr.Editor?.WriteMessage($"\n已加载线型：{ltName}");
                }
                catch
                {
                    tr.Editor?.WriteMessage($"\n无法加载线型：{ltName}");
                }
            }
        }
    }
    
    /// <summary>
    /// 创建标准文字样式
    /// </summary>
    public static void CreateStandardTextStyles()
    {
        using var tr = new DBTrans();
        
        // 创建中文文字样式
        tr.TextStyleTable.Add("中文", style =>
        {
            style.FileName = "simhei.ttf";
            style.BigFontFileName = "";
            style.TextSize = 0;  // 可变高度
            style.XScale = 0.8;
        });
        
        // 创建英文文字样式
        tr.TextStyleTable.Add("English", style =>
        {
            style.FileName = "romans.shx";
            style.BigFontFileName = "";
            style.TextSize = 0;
            style.XScale = 1.0;
        });
        
        // 创建注释性文字样式
        tr.TextStyleTable.Add("Annotative", style =>
        {
            style.FileName = "simhei.ttf";
            style.Annotative = AnnotativeStates.True;
        });
        
        tr.Editor?.WriteMessage("\n标准文字样式创建完成！");
    }
}
```

## 3.10 本章小结

本章我们深入学习了IFoxCAD的SymbolTable类：

1. **符号表基础**：理解了符号表的概念和CAD中的九大符号表
2. **SymbolTable类设计**：学习了类的结构和通过DBTrans访问符号表的方式
3. **索引器与Has方法**：掌握了判断记录存在和获取记录ID的方法
4. **添加记录**：学习了Add和AddOrChange方法的使用
5. **删除记录**：理解了Remove方法及图层删除的特殊处理
6. **修改记录**：掌握了Change方法和批量修改技巧
7. **获取记录**：学习了GetRecord和GetRecords方法
8. **遍历符号表**：掌握了多种遍历方式
9. **实际应用**：通过图层管理器、块库管理器等案例巩固所学知识

SymbolTable类极大简化了符号表的操作，使我们能够用更少的代码完成更多的工作。下一章我们将学习选择集过滤器，这是CAD二次开发中的另一个重要主题。

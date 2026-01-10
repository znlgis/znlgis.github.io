# 第八章：IFoxCAD开发实战案例教程

## 8.1 项目概述

本章将通过多个完整的实战案例，综合运用前面所学的IFoxCAD知识，展示如何开发实用的CAD插件功能。

## 8.2 案例一：图框生成器

### 8.2.1 需求分析

开发一个图框生成器，实现以下功能：
1. 支持A4、A3、A2、A1、A0多种图幅
2. 自动创建图框边界、标题栏
3. 支持填写图纸信息
4. 生成到指定位置

### 8.2.2 完整实现

```csharp
public class DrawingFrameGenerator
{
    // 图幅尺寸定义
    private static readonly Dictionary<string, (double Width, double Height)> PaperSizes = new()
    {
        { "A4", (297, 210) },
        { "A3", (420, 297) },
        { "A2", (594, 420) },
        { "A1", (841, 594) },
        { "A0", (1189, 841) }
    };
    
    // 边框参数
    private const double OuterMargin = 5;
    private const double InnerMargin = 25;
    private const double TitleBarHeight = 40;
    private const double TitleBarWidth = 180;
    
    [CommandMethod("CreateFrame")]
    public void CreateDrawingFrame()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        // 选择图幅
        var options = new PromptKeywordOptions("\n选择图幅 [A4/A3/A2/A1/A0]：");
        options.Keywords.Add("A4");
        options.Keywords.Add("A3");
        options.Keywords.Add("A2");
        options.Keywords.Add("A1");
        options.Keywords.Add("A0");
        options.Keywords.Default = "A4";
        options.AllowNone = true;
        
        var kwResult = ed?.GetKeywords(options);
        if (kwResult?.Status != PromptStatus.OK && kwResult?.Status != PromptStatus.None)
            return;
        
        string paperSize = kwResult?.Status == PromptStatus.None ? "A4" : kwResult?.StringResult ?? "A4";
        
        // 获取插入点
        var ptResult = ed?.GetPoint("\n指定插入点：");
        if (ptResult?.Status != PromptStatus.OK) return;
        Point3d insertPoint = ptResult.Value;
        
        // 获取图纸信息
        var titleResult = ed?.GetString("\n输入图纸名称：");
        string title = titleResult?.Status == PromptStatus.OK ? titleResult.StringResult : "未命名";
        
        var numberResult = ed?.GetString("\n输入图号：");
        string number = numberResult?.Status == PromptStatus.OK ? numberResult.StringResult : "";
        
        // 创建图框
        CreateFrame(tr, insertPoint, paperSize, title, number);
        
        ed?.WriteMessage($"\n已创建 {paperSize} 图框");
    }
    
    private void CreateFrame(DBTrans tr, Point3d insertPoint, string paperSize, 
        string title, string number)
    {
        var (width, height) = PaperSizes[paperSize];
        
        // 确保图框图层存在
        if (!tr.LayerTable.Has("图框"))
        {
            tr.LayerTable.Add("图框", layer =>
            {
                layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 7);
            });
        }
        
        // 创建外边框
        var outerFrame = new Polyline();
        outerFrame.AddVertexAt(0, new Point2d(insertPoint.X, insertPoint.Y), 0, 0, 0);
        outerFrame.AddVertexAt(1, new Point2d(insertPoint.X + width, insertPoint.Y), 0, 0, 0);
        outerFrame.AddVertexAt(2, new Point2d(insertPoint.X + width, insertPoint.Y + height), 0, 0, 0);
        outerFrame.AddVertexAt(3, new Point2d(insertPoint.X, insertPoint.Y + height), 0, 0, 0);
        outerFrame.Closed = true;
        outerFrame.Layer = "图框";
        outerFrame.LineWeight = LineWeight.LineWeight070;
        tr.CurrentSpace.AddEntity(outerFrame);
        
        // 创建内边框
        double innerLeft = insertPoint.X + InnerMargin;
        double innerBottom = insertPoint.Y + OuterMargin;
        double innerRight = insertPoint.X + width - OuterMargin;
        double innerTop = insertPoint.Y + height - OuterMargin;
        
        var innerFrame = new Polyline();
        innerFrame.AddVertexAt(0, new Point2d(innerLeft, innerBottom), 0, 0, 0);
        innerFrame.AddVertexAt(1, new Point2d(innerRight, innerBottom), 0, 0, 0);
        innerFrame.AddVertexAt(2, new Point2d(innerRight, innerTop), 0, 0, 0);
        innerFrame.AddVertexAt(3, new Point2d(innerLeft, innerTop), 0, 0, 0);
        innerFrame.Closed = true;
        innerFrame.Layer = "图框";
        innerFrame.LineWeight = LineWeight.LineWeight030;
        tr.CurrentSpace.AddEntity(innerFrame);
        
        // 创建标题栏
        CreateTitleBar(tr, insertPoint, width, height, title, number);
    }
    
    private void CreateTitleBar(DBTrans tr, Point3d insertPoint, double width, double height,
        string title, string number)
    {
        double titleBarLeft = insertPoint.X + width - OuterMargin - TitleBarWidth;
        double titleBarBottom = insertPoint.Y + OuterMargin;
        double titleBarRight = insertPoint.X + width - OuterMargin;
        double titleBarTop = insertPoint.Y + OuterMargin + TitleBarHeight;
        
        // 标题栏边框
        var titleBarFrame = new Polyline();
        titleBarFrame.AddVertexAt(0, new Point2d(titleBarLeft, titleBarBottom), 0, 0, 0);
        titleBarFrame.AddVertexAt(1, new Point2d(titleBarRight, titleBarBottom), 0, 0, 0);
        titleBarFrame.AddVertexAt(2, new Point2d(titleBarRight, titleBarTop), 0, 0, 0);
        titleBarFrame.AddVertexAt(3, new Point2d(titleBarLeft, titleBarTop), 0, 0, 0);
        titleBarFrame.Closed = true;
        titleBarFrame.Layer = "图框";
        tr.CurrentSpace.AddEntity(titleBarFrame);
        
        // 分隔线
        double midHeight = titleBarBottom + TitleBarHeight / 2;
        var divLine = new Line(
            new Point3d(titleBarLeft, midHeight, 0),
            new Point3d(titleBarRight, midHeight, 0));
        divLine.Layer = "图框";
        tr.CurrentSpace.AddEntity(divLine);
        
        // 垂直分隔
        double col1 = titleBarLeft + 60;
        var vLine = new Line(
            new Point3d(col1, titleBarBottom, 0),
            new Point3d(col1, titleBarTop, 0));
        vLine.Layer = "图框";
        tr.CurrentSpace.AddEntity(vLine);
        
        // 添加文字
        // 图名标签
        var labelTitle = new DBText();
        labelTitle.Position = new Point3d(titleBarLeft + 5, midHeight + 5, 0);
        labelTitle.TextString = "图名";
        labelTitle.Height = 3;
        labelTitle.Layer = "图框";
        tr.CurrentSpace.AddEntity(labelTitle);
        
        // 图名内容
        var contentTitle = new DBText();
        contentTitle.Position = new Point3d(col1 + 5, midHeight + 10, 0);
        contentTitle.TextString = title;
        contentTitle.Height = 5;
        contentTitle.Layer = "图框";
        tr.CurrentSpace.AddEntity(contentTitle);
        
        // 图号标签
        var labelNumber = new DBText();
        labelNumber.Position = new Point3d(titleBarLeft + 5, titleBarBottom + 5, 0);
        labelNumber.TextString = "图号";
        labelNumber.Height = 3;
        labelNumber.Layer = "图框";
        tr.CurrentSpace.AddEntity(labelNumber);
        
        // 图号内容
        var contentNumber = new DBText();
        contentNumber.Position = new Point3d(col1 + 5, titleBarBottom + 10, 0);
        contentNumber.TextString = number;
        contentNumber.Height = 5;
        contentNumber.Layer = "图框";
        tr.CurrentSpace.AddEntity(contentNumber);
    }
}
```

## 8.3 案例二：图元统计工具

### 8.3.1 需求分析

开发一个图元统计工具，实现以下功能：
1. 统计当前图纸中各类型图元的数量
2. 按图层分类统计
3. 统计曲线的总长度
4. 统计闭合区域的面积
5. 输出详细的统计报告

### 8.3.2 完整实现

```csharp
public class EntityStatisticsTool
{
    [CommandMethod("EntityStats")]
    public void CollectStatistics()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        // 收集统计数据
        var stats = new StatisticsData();
        
        // 遍历模型空间
        foreach (ObjectId id in tr.ModelSpace)
        {
            var ent = tr.GetObject<Entity>(id);
            if (ent == null) continue;
            
            // 按类型统计
            string typeName = ent.GetType().Name;
            if (!stats.TypeCounts.ContainsKey(typeName))
                stats.TypeCounts[typeName] = 0;
            stats.TypeCounts[typeName]++;
            
            // 按图层统计
            string layer = ent.Layer;
            if (!stats.LayerCounts.ContainsKey(layer))
                stats.LayerCounts[layer] = 0;
            stats.LayerCounts[layer]++;
            
            // 统计曲线长度
            if (ent is Curve curve)
            {
                try
                {
                    stats.TotalLength += curve.GetLength();
                }
                catch { }
            }
            
            // 统计闭合区域面积
            if (ent is Polyline pline && pline.Closed)
            {
                stats.ClosedAreaCount++;
                stats.TotalArea += Math.Abs(pline.Area);
            }
            else if (ent is Circle circle)
            {
                stats.ClosedAreaCount++;
                stats.TotalArea += Math.PI * circle.Radius * circle.Radius;
            }
            
            stats.TotalCount++;
        }
        
        // 输出报告
        OutputReport(ed, stats);
    }
    
    private void OutputReport(Editor? ed, StatisticsData stats)
    {
        ed?.WriteMessage("\n");
        ed?.WriteMessage("\n╔══════════════════════════════════════════╗");
        ed?.WriteMessage("\n║           图元统计报告                   ║");
        ed?.WriteMessage("\n╠══════════════════════════════════════════╣");
        
        ed?.WriteMessage($"\n║ 图元总数：{stats.TotalCount,-30}║");
        ed?.WriteMessage($"\n║ 曲线总长度：{stats.TotalLength,-27:F2}║");
        ed?.WriteMessage($"\n║ 闭合区域数：{stats.ClosedAreaCount,-27}║");
        ed?.WriteMessage($"\n║ 总面积：{stats.TotalArea,-31:F2}║");
        
        ed?.WriteMessage("\n╠══════════════════════════════════════════╣");
        ed?.WriteMessage("\n║ 按类型统计                               ║");
        ed?.WriteMessage("\n╠──────────────────────────────────────────╣");
        
        foreach (var kvp in stats.TypeCounts.OrderByDescending(x => x.Value))
        {
            ed?.WriteMessage($"\n║ {kvp.Key,-20}{kvp.Value,20} ║");
        }
        
        ed?.WriteMessage("\n╠══════════════════════════════════════════╣");
        ed?.WriteMessage("\n║ 按图层统计                               ║");
        ed?.WriteMessage("\n╠──────────────────────────────────────────╣");
        
        foreach (var kvp in stats.LayerCounts.OrderByDescending(x => x.Value))
        {
            ed?.WriteMessage($"\n║ {kvp.Key,-20}{kvp.Value,20} ║");
        }
        
        ed?.WriteMessage("\n╚══════════════════════════════════════════╝");
    }
    
    private class StatisticsData
    {
        public int TotalCount { get; set; }
        public double TotalLength { get; set; }
        public int ClosedAreaCount { get; set; }
        public double TotalArea { get; set; }
        public Dictionary<string, int> TypeCounts { get; } = new();
        public Dictionary<string, int> LayerCounts { get; } = new();
    }
}
```

## 8.4 案例三：批量图层管理

### 8.4.1 需求分析

开发一个批量图层管理工具，实现以下功能：
1. 批量创建图层
2. 批量修改图层属性
3. 合并图层
4. 清理未使用图层
5. 导出/导入图层配置

### 8.4.2 完整实现

```csharp
public class LayerManagementTool
{
    // 预定义的图层配置
    private static readonly LayerConfig[] StandardLayers = new[]
    {
        new LayerConfig("墙体", 1, "Continuous", LineWeight.LineWeight030),
        new LayerConfig("门窗", 2, "Continuous", LineWeight.LineWeight018),
        new LayerConfig("家具", 3, "Continuous", LineWeight.LineWeight013),
        new LayerConfig("标注", 4, "Continuous", LineWeight.LineWeight009),
        new LayerConfig("文字", 5, "Continuous", LineWeight.LineWeight009),
        new LayerConfig("辅助线", 8, "DASHED", LineWeight.LineWeight000),
        new LayerConfig("中心线", 1, "CENTER", LineWeight.LineWeight000),
        new LayerConfig("设备", 6, "Continuous", LineWeight.LineWeight018)
    };
    
    [CommandMethod("CreateStdLayers")]
    public void CreateStandardLayers()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        int created = 0;
        foreach (var config in StandardLayers)
        {
            if (!tr.LayerTable.Has(config.Name))
            {
                // 确保线型存在
                EnsureLinetype(tr, config.Linetype);
                
                tr.LayerTable.Add(config.Name, layer =>
                {
                    layer.Color = Color.FromColorIndex(ColorMethod.ByAci, config.Color);
                    layer.LinetypeObjectId = tr.LinetypeTable[config.Linetype];
                    layer.LineWeight = config.LineWeight;
                });
                created++;
            }
        }
        
        ed?.WriteMessage($"\n创建了 {created} 个标准图层");
    }
    
    [CommandMethod("MergeLayers")]
    public void MergeLayers()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        // 获取源图层
        var sourceResult = ed?.GetString("\n输入源图层名：");
        if (sourceResult?.Status != PromptStatus.OK) return;
        string sourceLayer = sourceResult.StringResult;
        
        if (!tr.LayerTable.Has(sourceLayer))
        {
            ed?.WriteMessage($"\n图层 {sourceLayer} 不存在！");
            return;
        }
        
        // 获取目标图层
        var targetResult = ed?.GetString("\n输入目标图层名：");
        if (targetResult?.Status != PromptStatus.OK) return;
        string targetLayer = targetResult.StringResult;
        
        // 确保目标图层存在
        if (!tr.LayerTable.Has(targetLayer))
        {
            tr.LayerTable.Add(targetLayer);
        }
        
        // 移动图元
        var filter = OpFilter.Build(e => e.Dxf(8) == sourceLayer);
        var result = ed?.SelectAll(filter);
        
        int count = 0;
        if (result?.Status == PromptStatus.OK)
        {
            foreach (SelectedObject obj in result.Value)
            {
                if (obj == null) continue;
                
                var ent = tr.GetObject<Entity>(obj.ObjectId, OpenMode.ForWrite);
                if (ent != null)
                {
                    ent.Layer = targetLayer;
                    count++;
                }
            }
        }
        
        // 删除源图层
        tr.LayerTable.Remove(sourceLayer);
        
        ed?.WriteMessage($"\n已将 {count} 个图元从 {sourceLayer} 移动到 {targetLayer}");
        ed?.WriteMessage($"\n图层 {sourceLayer} 已删除");
    }
    
    [CommandMethod("CleanUnusedLayers")]
    public void CleanUnusedLayers()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        // 生成使用数据
        tr.LayerTable.CurrentSymbolTable.GenerateUsageData();
        
        // 查找未使用的图层
        var unusedLayers = tr.LayerTable.GetRecords()
            .Where(l => !l.IsUsed &&
                       !SymbolUtilityServices.IsLayerZeroName(l.Name) &&
                       !SymbolUtilityServices.IsLayerDefpointsName(l.Name))
            .Select(l => l.Name)
            .ToList();
        
        if (unusedLayers.Count == 0)
        {
            ed?.WriteMessage("\n没有找到未使用的图层");
            return;
        }
        
        ed?.WriteMessage($"\n找到 {unusedLayers.Count} 个未使用的图层：");
        foreach (var name in unusedLayers)
        {
            ed?.WriteMessage($"\n  - {name}");
        }
        
        var confirmResult = ed?.GetString("\n是否删除这些图层？[是(Y)/否(N)] <N>：");
        if (confirmResult?.StringResult.ToUpper() != "Y") return;
        
        // 删除图层
        foreach (var name in unusedLayers)
        {
            tr.LayerTable.Remove(name);
        }
        
        ed?.WriteMessage($"\n已删除 {unusedLayers.Count} 个图层");
    }
    
    [CommandMethod("ExportLayerConfig")]
    public void ExportLayerConfiguration()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        // 收集图层配置
        var configs = tr.LayerTable.GetRecords()
            .Select(l => new
            {
                Name = l.Name,
                Color = l.Color.ColorIndex,
                Linetype = l.LinetypeObjectId.IsNull ? "Continuous" : 
                    tr.LinetypeTable.GetRecord(l.LinetypeObjectId)?.Name ?? "Continuous",
                LineWeight = l.LineWeight.ToString(),
                IsOff = l.IsOff,
                IsFrozen = l.IsFrozen
            })
            .ToList();
        
        // 导出为JSON
        string json = System.Text.Json.JsonSerializer.Serialize(configs, 
            new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        
        // 获取保存路径
        var dialog = new System.Windows.Forms.SaveFileDialog
        {
            Filter = "JSON文件|*.json",
            DefaultExt = "json",
            FileName = "layer_config.json"
        };
        
        if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
        {
            System.IO.File.WriteAllText(dialog.FileName, json);
            ed?.WriteMessage($"\n图层配置已导出到：{dialog.FileName}");
        }
    }
    
    private void EnsureLinetype(DBTrans tr, string linetypeName)
    {
        if (!tr.LinetypeTable.Has(linetypeName))
        {
            try
            {
                tr.Database.LoadLineTypeFile(linetypeName, "acad.lin");
            }
            catch { }
        }
    }
    
    private record LayerConfig(string Name, short Color, string Linetype, LineWeight LineWeight);
}
```

## 8.5 案例四：设备标注工具

### 8.5.1 需求分析

开发一个设备标注工具，实现以下功能：
1. 创建设备符号块
2. 插入设备并填写信息
3. 生成设备表
4. 更新设备编号

### 8.5.2 完整实现

```csharp
public class EquipmentLabelTool
{
    private const string BlockName = "设备标注";
    private const string AppName = "EquipmentData";
    
    [CommandMethod("CreateEquipBlock")]
    public void CreateEquipmentBlock()
    {
        using var tr = new DBTrans();
        
        if (tr.BlockTable.Has(BlockName))
        {
            tr.Editor?.WriteMessage("\n设备标注块已存在");
            return;
        }
        
        tr.BlockTable.Add(BlockName, btr =>
        {
            // 创建符号
            var circle = new Circle(Point3d.Origin, Vector3d.ZAxis, 10);
            btr.AppendEntity(circle);
            tr.Transaction.AddNewlyCreatedDBObject(circle, true);
            
            var line1 = new Line(new Point3d(-7, -7, 0), new Point3d(7, 7, 0));
            btr.AppendEntity(line1);
            tr.Transaction.AddNewlyCreatedDBObject(line1, true);
            
            var line2 = new Line(new Point3d(-7, 7, 0), new Point3d(7, -7, 0));
            btr.AppendEntity(line2);
            tr.Transaction.AddNewlyCreatedDBObject(line2, true);
            
            // 创建属性
            var attName = new AttributeDefinition();
            attName.Position = new Point3d(0, 15, 0);
            attName.Tag = "NAME";
            attName.Prompt = "设备名称";
            attName.TextString = "";
            attName.Height = 5;
            attName.HorizontalMode = TextHorizontalMode.TextCenter;
            attName.AlignmentPoint = new Point3d(0, 15, 0);
            btr.AppendEntity(attName);
            tr.Transaction.AddNewlyCreatedDBObject(attName, true);
            
            var attCode = new AttributeDefinition();
            attCode.Position = new Point3d(0, 0, 0);
            attCode.Tag = "CODE";
            attCode.Prompt = "设备编号";
            attCode.TextString = "";
            attCode.Height = 4;
            attCode.HorizontalMode = TextHorizontalMode.TextCenter;
            attCode.VerticalMode = TextVerticalMode.TextVerticalMid;
            attCode.AlignmentPoint = new Point3d(0, 0, 0);
            btr.AppendEntity(attCode);
            tr.Transaction.AddNewlyCreatedDBObject(attCode, true);
        });
        
        // 注册应用程序
        if (!tr.RegAppTable.Has(AppName))
        {
            tr.RegAppTable.Add(AppName);
        }
        
        tr.Editor?.WriteMessage("\n设备标注块创建完成");
    }
    
    [CommandMethod("InsertEquip")]
    public void InsertEquipment()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        // 确保块存在
        if (!tr.BlockTable.Has(BlockName))
        {
            ed?.WriteMessage("\n请先运行 CreateEquipBlock 命令创建块定义");
            return;
        }
        
        // 获取插入点
        var ptResult = ed?.GetPoint("\n指定设备位置：");
        if (ptResult?.Status != PromptStatus.OK) return;
        
        // 获取设备信息
        var nameResult = ed?.GetString("\n输入设备名称：");
        string name = nameResult?.Status == PromptStatus.OK ? nameResult.StringResult : "";
        
        var codeResult = ed?.GetString("\n输入设备编号：");
        string code = codeResult?.Status == PromptStatus.OK ? codeResult.StringResult : "";
        
        // 创建块参照
        ObjectId blockId = tr.BlockTable[BlockName];
        var blockRef = new BlockReference(ptResult.Value, blockId);
        ObjectId blockRefId = tr.CurrentSpace.AddEntity(blockRef);
        
        // 添加属性
        var btr = tr.BlockTable.GetRecord(blockId);
        if (btr != null)
        {
            foreach (ObjectId id in btr)
            {
                var attDef = tr.GetObject<AttributeDefinition>(id);
                if (attDef != null && !attDef.Constant)
                {
                    var attRef = new AttributeReference();
                    attRef.SetAttributeFromBlock(attDef, blockRef.BlockTransform);
                    
                    if (attDef.Tag == "NAME")
                        attRef.TextString = name;
                    else if (attDef.Tag == "CODE")
                        attRef.TextString = code;
                    
                    using (blockRef.ForWrite())
                    {
                        blockRef.AttributeCollection.AppendAttribute(attRef);
                    }
                    tr.Transaction.AddNewlyCreatedDBObject(attRef, true);
                }
            }
        }
        
        // 添加扩展数据
        var xdata = new XDataList(AppName);
        xdata.Add(DxfCode.ExtendedDataAsciiString, "EquipmentType");
        xdata.Add(DxfCode.ExtendedDataAsciiString, name);
        xdata.Add(DxfCode.ExtendedDataAsciiString, "EquipmentCode");
        xdata.Add(DxfCode.ExtendedDataAsciiString, code);
        
        using (blockRef.ForWrite())
        {
            blockRef.XData = xdata.ToResultBuffer();
        }
        
        ed?.WriteMessage($"\n已插入设备：{name} ({code})");
    }
    
    [CommandMethod("GenerateEquipTable")]
    public void GenerateEquipmentTable()
    {
        using var tr = new DBTrans();
        var ed = tr.Editor;
        
        // 选择所有设备
        var filter = OpFilter.Build(e => 
            e.Dxf(0) == "INSERT" & e.Dxf(2) == BlockName);
        var result = ed?.SelectAll(filter);
        
        if (result?.Status != PromptStatus.OK || result.Value.Count == 0)
        {
            ed?.WriteMessage("\n未找到设备标注");
            return;
        }
        
        // 收集设备信息
        var equipments = new List<(string Name, string Code, Point3d Position)>();
        
        foreach (SelectedObject obj in result.Value)
        {
            if (obj == null) continue;
            
            var blockRef = tr.GetObject<BlockReference>(obj.ObjectId);
            if (blockRef == null) continue;
            
            string name = "", code = "";
            foreach (ObjectId attId in blockRef.AttributeCollection)
            {
                var attRef = tr.GetObject<AttributeReference>(attId);
                if (attRef != null)
                {
                    if (attRef.Tag == "NAME") name = attRef.TextString;
                    else if (attRef.Tag == "CODE") code = attRef.TextString;
                }
            }
            
            equipments.Add((name, code, blockRef.Position));
        }
        
        // 获取表格位置
        var tableResult = ed?.GetPoint("\n指定设备表位置：");
        if (tableResult?.Status != PromptStatus.OK) return;
        
        // 创建表格
        CreateEquipmentTable(tr, tableResult.Value, equipments);
        
        ed?.WriteMessage($"\n已生成包含 {equipments.Count} 个设备的设备表");
    }
    
    private void CreateEquipmentTable(DBTrans tr, Point3d position,
        List<(string Name, string Code, Point3d Position)> equipments)
    {
        double rowHeight = 8;
        double colWidth1 = 30;  // 序号列
        double colWidth2 = 60;  // 名称列
        double colWidth3 = 40;  // 编号列
        double totalWidth = colWidth1 + colWidth2 + colWidth3;
        
        // 表头
        double y = position.Y;
        
        // 标题
        var title = new DBText();
        title.Position = new Point3d(position.X + totalWidth / 2, y + 5, 0);
        title.TextString = "设备表";
        title.Height = 6;
        title.HorizontalMode = TextHorizontalMode.TextCenter;
        title.AlignmentPoint = new Point3d(position.X + totalWidth / 2, y + 5, 0);
        tr.CurrentSpace.AddEntity(title);
        
        y -= rowHeight;
        
        // 表头行
        DrawTableRow(tr, position.X, y, 
            new[] { ("序号", colWidth1), ("设备名称", colWidth2), ("设备编号", colWidth3) },
            rowHeight, true);
        
        // 数据行
        int index = 1;
        foreach (var equip in equipments.OrderBy(e => e.Code))
        {
            y -= rowHeight;
            DrawTableRow(tr, position.X, y,
                new[] { (index.ToString(), colWidth1), (equip.Name, colWidth2), (equip.Code, colWidth3) },
                rowHeight, false);
            index++;
        }
    }
    
    private void DrawTableRow(DBTrans tr, double x, double y,
        (string Text, double Width)[] cells, double height, bool isHeader)
    {
        double currentX = x;
        
        foreach (var (text, width) in cells)
        {
            // 绘制单元格边框
            var rect = new Polyline();
            rect.AddVertexAt(0, new Point2d(currentX, y), 0, 0, 0);
            rect.AddVertexAt(1, new Point2d(currentX + width, y), 0, 0, 0);
            rect.AddVertexAt(2, new Point2d(currentX + width, y + height), 0, 0, 0);
            rect.AddVertexAt(3, new Point2d(currentX, y + height), 0, 0, 0);
            rect.Closed = true;
            tr.CurrentSpace.AddEntity(rect);
            
            // 添加文字
            var cellText = new DBText();
            cellText.Position = new Point3d(currentX + width / 2, y + height / 2, 0);
            cellText.TextString = text;
            cellText.Height = isHeader ? 4 : 3;
            cellText.HorizontalMode = TextHorizontalMode.TextCenter;
            cellText.VerticalMode = TextVerticalMode.TextVerticalMid;
            cellText.AlignmentPoint = new Point3d(currentX + width / 2, y + height / 2, 0);
            tr.CurrentSpace.AddEntity(cellText);
            
            currentX += width;
        }
    }
}
```

## 8.6 案例五：批量文件处理

### 8.6.1 需求分析

开发一个批量文件处理工具，实现以下功能：
1. 批量打开DWG文件
2. 执行统一操作（如修改图层、清理等）
3. 保存并生成处理报告

### 8.6.2 完整实现

```csharp
public class BatchProcessor
{
    [CommandMethod("BatchProcess", CommandFlags.Session)]
    public void BatchProcessFiles()
    {
        // 选择文件夹
        var folderDialog = new System.Windows.Forms.FolderBrowserDialog
        {
            Description = "选择要处理的DWG文件所在文件夹"
        };
        
        if (folderDialog.ShowDialog() != System.Windows.Forms.DialogResult.OK)
            return;
        
        string folder = folderDialog.SelectedPath;
        string[] files = System.IO.Directory.GetFiles(folder, "*.dwg");
        
        if (files.Length == 0)
        {
            System.Windows.Forms.MessageBox.Show("未找到DWG文件！");
            return;
        }
        
        // 处理报告
        var report = new System.Text.StringBuilder();
        report.AppendLine("批量处理报告");
        report.AppendLine($"处理时间：{DateTime.Now}");
        report.AppendLine($"处理文件夹：{folder}");
        report.AppendLine($"文件数量：{files.Length}");
        report.AppendLine(new string('-', 50));
        
        int success = 0, failed = 0;
        
        foreach (string file in files)
        {
            string fileName = System.IO.Path.GetFileName(file);
            
            try
            {
                ProcessSingleFile(file);
                report.AppendLine($"[成功] {fileName}");
                success++;
            }
            catch (Exception ex)
            {
                report.AppendLine($"[失败] {fileName}: {ex.Message}");
                failed++;
            }
        }
        
        report.AppendLine(new string('-', 50));
        report.AppendLine($"处理完成：成功 {success}，失败 {failed}");
        
        // 保存报告
        string reportPath = System.IO.Path.Combine(folder, $"处理报告_{DateTime.Now:yyyyMMdd_HHmmss}.txt");
        System.IO.File.WriteAllText(reportPath, report.ToString());
        
        System.Windows.Forms.MessageBox.Show(
            $"处理完成！\n成功：{success}\n失败：{failed}\n报告已保存到：{reportPath}");
    }
    
    private void ProcessSingleFile(string filePath)
    {
        using var tr = new DBTrans(filePath);
        
        tr.Task(() =>
        {
            // 操作1：统一图层颜色
            tr.LayerTable.ForEach(layer =>
            {
                if (layer.Name.StartsWith("Temp"))
                {
                    using (layer.ForWrite())
                    {
                        layer.Color = Color.FromColorIndex(ColorMethod.ByAci, 8);
                    }
                }
            });
            
            // 操作2：清理未使用的图层
            tr.LayerTable.CurrentSymbolTable.GenerateUsageData();
            var unusedLayers = tr.LayerTable.GetRecords()
                .Where(l => !l.IsUsed && 
                           !SymbolUtilityServices.IsLayerZeroName(l.Name) &&
                           !SymbolUtilityServices.IsLayerDefpointsName(l.Name))
                .Select(l => l.Name)
                .ToList();
            
            foreach (var name in unusedLayers)
            {
                tr.LayerTable.Remove(name);
            }
            
            // 操作3：更新文档属性
            var summaryInfo = tr.Database.SummaryInfo;
            var builder = new DatabaseSummaryInfoBuilder(summaryInfo);
            builder.Comments = $"批量处理于 {DateTime.Now}";
            tr.Database.SummaryInfo = builder.ToDatabaseSummaryInfo();
        });
        
        // 保存文件
        tr.Database.SaveAs(filePath, DwgVersion.Current);
    }
}
```

## 8.7 本章小结

本章通过五个完整的实战案例，综合运用了IFoxCAD的各项技术：

1. **图框生成器**：展示了如何创建复杂的图形结构，包括多段线、文字和图层管理
2. **图元统计工具**：展示了如何遍历和分析图元，收集统计信息
3. **批量图层管理**：展示了图层的创建、合并、清理和配置导出
4. **设备标注工具**：展示了块的创建、属性操作、扩展数据和表格生成
5. **批量文件处理**：展示了如何使用Session命令标记进行文件批量处理

通过这些案例的学习，读者应该能够：
- 理解如何将IFoxCAD的各项功能组合使用
- 掌握开发完整CAD插件功能的方法
- 学会处理实际开发中的常见需求

希望这些案例能够帮助读者在实际项目中更好地应用IFoxCAD进行CAD二次开发。

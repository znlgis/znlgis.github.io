---
layout: default
title: 第06章：IFC模型读取解析与STEPXMLZip序列化
---

# 第06章：IFC 模型读取、解析与 STEP/XML/Zip 序列化

本章聚焦于 Xbim 的 IO 层——它如何把磁盘上的 `.ifc` / `.ifcXML` / `.ifcZIP` 字节流转换成内存中的 `IPersistEntity` 图，以及反过来。

## 1. IO 层在 Xbim.Essentials 中的位置

```
Xbim.IO                  通用 IO 抽象、PersistEntityCursor
Xbim.IO.Step21           STEP21 词法/语法分析、写入器
Xbim.IO.Xml              ifcXML 读写
Xbim.IO.MemoryModel      MemoryModel 实现
Xbim.IO.Esent            EsentModel 实现（Windows）
Xbim.IO.TableStore       辅助：把 IFC 实体导出为表格（Excel/CSV）
```

`IfcStore` 在打开文件时只是按格式调用对应模块；理解每个模块的工作原理，能让你在排错和性能调优时游刃有余。

## 2. 自动检测格式

`IfcStore.Open` 通过文件扩展名 + 文件头双重检测：

| 扩展名 | 头部签名 | 处理器 |
| --- | --- | --- |
| `.ifc` | `ISO-10303-21;` | `Xbim.IO.Step21` |
| `.ifcxml` / `.xml` | `<?xml ...?>` 或 `<ifcXML>` | `Xbim.IO.Xml` |
| `.ifczip` / `.zip` | `PK\x03\x04` | 解压后递归处理内层 .ifc / .ifcxml |
| `.xbim` | Xbim 私有 Esent 文件 | `Xbim.IO.Esent` |

## 3. STEP21 解析器

STEP21 是 Xbim 默认且最重要的解析器，位于 `Xbim.IO.Step21` 程序集中。它由两部分组成：

### 3.1 词法/语法分析

Xbim 历史上使用 **GPPG/GPLEX**（C# 版本的 yacc/lex）从 `Xbim.IO.Step21/Parser/Step21Parser.y` 自动生成解析器。它处理 STEP21 的核心语法：

```
ENTITY_DEF   := '#' INTEGER '=' KEYWORD '(' PARAMETER_LIST ')' ';'
PARAMETER    := '$' | '*' | INTEGER | FLOAT | STRING | ENUM | LIST | REFERENCE
LIST         := '(' PARAMETER (',' PARAMETER)* ')'
REFERENCE    := '#' INTEGER
```

整个解析过程是**单遍流式**的：

1. 遇到 `#42 = IFCWALL(...)`：
   - 用 KEYWORD 在元数据里查到 `ExpressType`；
   - 实例化对应类型，分配 EntityLabel = 42；
   - 把参数按 EntityAttributeOrder 反序列化到属性。
2. 遇到 `#7` 形式的引用，先在 label→entity 映射里查；如果还没解析到，记录为"未解决"延迟到末尾再补回。
3. HEADER 段单独解析为 `IStepFileHeader`（含 `FileDescription`、`FileName`、`FileSchema`）。

### 3.2 优雅地处理常见"脏数据"

真实 IFC 文件常见问题：

- 字符串内含 `\X2\xxxx\X0\` 或 `\X4\xxxxxxxx\X0\` 形式的 UTF-16/UTF-32 转义；
- 字符串内含 `''`（双单引号）转义成单引号；
- 数字过长（30+ 位有效数字）；
- KEYWORD 大小写混杂；

Xbim 解析器在 `Step21IfcReader` 中针对这些都有处理（`ResolveString`、`ParseNumber`），保证主流软件导出的 IFC 文件都能稳定解析。

### 3.3 流式 vs 全量读取

`Xbim.IO.Step21.Step21Parser` 接受 `Stream` 或 `TextReader`，并按行/按 token 推进，不会把整个文件读入内存。对于 1GB 模型仍然能保持平稳的内存增长。

### 3.4 写入器

`Part21Writer`（在 `Xbim.IO/Step21/Part21FileWriter.cs`）做反向工作：

1. 遍历 `IModel.Instances`；
2. 对每个实体读 `ExpressType.Properties`，按 EntityAttributeOrder 写参数；
3. 字符串自动转义成 STEP21 形式；
4. 处理 SELECT / 派生 / OPTIONAL / DERIVE 标记。

它的实现是数据驱动的（依赖 `Xbim.Common` 元数据），所以新增 schema（IFC4x3）时**不需要修改 IO 层**，这是 Xbim 设计上的一个亮点。

## 4. ifcXML 解析与生成

`Xbim.IO.Xml` 实现 buildingSMART 的 ifcXML 4 schema。原理类似：

- 读取时通过 `XmlReader` 递增解析；
- 元素名 → ExpressType；
- 子元素 → 属性；
- `xmlns:ifc="..."` 命名空间处理；
- 引用：`<IfcWall ref="i1234"/>` 或 `<IfcWall id="i1234">...</IfcWall>`。

写入器使用 `XmlWriter` 输出，可以选择 `XmlSchemaVersion.Ifc4Add2`、`Ifc2x3`、`Ifc4x3` 等。

注意：

- ifcXML 体积通常是 `.ifc` 的 5–8 倍；
- 解析速度比 STEP21 慢；
- 仅在与 XML 工具链集成时建议使用。

## 5. ifcZIP

ZIP 仅是包装，Xbim 直接调用 `System.IO.Compression.ZipArchive`：

1. 找到第一个 `.ifc` 或 `.ifcxml` 条目；
2. 取出 stream 喂给 STEP21 / XML 解析器；
3. 写入时反向：先写 .ifc 到临时文件再压缩。

## 6. Esent 二进制 (`.xbim`)

Esent 后端把每一个实体序列化为二进制 blob 存到 ESE 数据库：

- 实体表：`(EntityLabel int, TypeId int, Data blob)`；
- 类型索引：按 ExpressType 建立的 secondary index，让 `OfType<T>()` 可以 O(log n) 拉取。

`.xbim` 文件相比 `.ifc`：

- 加载几十 MB 模型几乎是瞬时的（按需 Activate）；
- 体积小约 20–50%（二进制压缩）；
- 但只有 Xbim 自己能读。

实务做法：第一次打开 `.ifc` → 自动落 `.xbim` → 后续重复打开就快了。

## 7. 打开模式与并发

`XbimDBAccess`（IFC4 仍叫这个名字）：

| 值 | 行为 |
| --- | --- |
| `Read` | 默认，只读，可以多个进程同时打开同一 .xbim |
| `ReadWrite` | 单写者 + 多读者（Esent），需要事务才能写 |
| `Exclusive` | 独占（重写整个 .xbim） |

## 8. 进度回调

`ReportProgressDelegate(int percent, object userState)` 在以下阶段会被触发：

- HEADER 解析；
- 实体反序列化（每 N 个实体回调一次）；
- 引用解析；
- Esent 持久化；
- 写出 `.ifc` / `.ifcxml` 时按字节进度。

## 9. 错误处理

`Xbim.IO.IfcFileReadException` / `XbimException` 是顶层异常。常见错误：

| 异常 | 原因 |
| --- | --- |
| `XbimException("Could not determine schema version")` | HEADER 缺 FILE_SCHEMA 行或写法非法 |
| `XbimException("Entity #42 of type IfcXXX is not declared in IFC schema 4")` | 文件声明 IFC4 但用了 IFC2x3 实体；多见于错误的 schema 升级 |
| `Xbim.Step21Exception` | 词法/语法错误（括号不匹配、字符串未闭合等） |
| `IfcFileReadException` | 引用不到对应 EntityLabel |

Xbim 默认对**未识别的实体类型**采取宽松策略：用日志警告 + 跳过，不会让整个文件爆掉。可以通过 `IModel.Tag` 上的设置或 `XbimServices` 调整严格度。

## 10. 性能与内存优化

处理超大型 IFC 文件时常用的技巧：

1. **使用 EsentModel + 大于阈值时自动落地**：`IfcStore.Open(path, ifcDatabaseSizeThreshHold: 50)` 会让 ≥50MB 的文件直接落 Esent。
2. **在循环外开启实体缓存**：`using (model.BeginEntityCaching()) { ... }`，减少 Esent 反复反序列化。
3. **批量查询前开启反向缓存**：`using (model.BeginInverseCaching()) { ... }`。
4. **按类型遍历**：`OfType<IIfcWall>(activate: true)` 比"先取所有再 filter"快得多。
5. **避免在事务外修改属性**：会抛 `Xbim.Common.Exceptions.XbimReadOnlyException`。
6. **写文件时关闭无用进度回调**：减少线程切换。

## 11. 自定义 IO 扩展

如果想接入新的存储后端（数据库 / 云对象存储），Xbim 设计允许：

- 实现 `IModel`、`IEntityCollection`、`IEntityFactory<TFactory>`；
- 注入到 `XbimServices`；
- `IfcStore.ModelProviderFactory.UseModelProvider(myProvider)`。

社区有人基于此实现过 SQLite、PostgreSQL、CosmosDB 等后端，可作为参考。

## 12. 实战：解析超大 IFC 的最佳实践模板

```csharp
public static IfcStore OpenLarge(string path)
{
    var cred = new XbimEditorCredentials
    {
        ApplicationFullName       = "Robust Loader",
        ApplicationIdentifier     = "RL",
        ApplicationDevelopersName = "Demo",
        ApplicationVersion        = "1",
        EditorsFamilyName         = "—",
        EditorsGivenName          = "—",
    };
    // 50MB 以上自动落 Esent
    var model = IfcStore.Open(path, cred,
        ifcDatabaseSizeThreshHold: 50,
        progDelegate: (p, m) => Console.Write($"\rLoading {p,3}% {m}      "),
        accessMode: XbimDBAccess.ReadWrite);

    return model;
}

public static void IterateAllProducts(IfcStore model)
{
    using (model.BeginEntityCaching())
    using (model.BeginInverseCaching())
    {
        foreach (var product in model.Instances.OfType<IIfcProduct>())
        {
            // …
        }
    }
}
```

## 13. 小结

- IFC 三种主流序列化（STEP21、ifcXML、ifcZIP）在 Xbim 中由独立模块处理，自动按扩展名/文件头分发；
- STEP21 解析是 GPPG 生成的状态机，单遍流式；写入端则通过 ExpressType 反射数据驱动；
- Esent 的 `.xbim` 二进制是 Xbim 私有缓存格式，能极大加速重复打开；
- 处理大型模型时，**EsentModel + 实体/反向缓存**是必备技巧。

下一章我们将进入更"应用化"的话题：怎样用 LINQ 与 Xbim 提供的查询 API 高效地"问"模型问题。

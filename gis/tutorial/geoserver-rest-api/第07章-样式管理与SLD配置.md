---
layout: default
title: 第07章：样式管理与SLD配置
---

# 第07章：样式管理与SLD配置

图层解决的是"数据在哪、能不能被访问"，样式解决的是"数据画成什么样"。GeoServer 把样式当作独立资源：它有自己的名字和工作空间归属，可以脱离图层单独上传、下载、替换，图层只是通过一个样式引用指向它。样式内容用 OGC 的 SLD（Styled Layer Descriptor）描述，本质是一段 XML，规定了按哪些规则、把几何画成什么符号。

这一章讲三件事：SLD 文档的基本结构，样式资源的 REST 端点怎么用，样式怎么挂到图层上。GeoServer 另外支持 CSS、YSLD 等写法，但它们最终都会转成 SLD 来解释，理解 SLD 的结构对排查渲染问题有直接帮助。

## 7.1 样式概述

SLD 是一份符号化规则说明书。文档从 StyledLayerDescriptor 开始，往下是 NamedLayer，再往下是 UserStyle；UserStyle 里的 FeatureTypeStyle 才是真正的规则集合，每条 Rule 描述一组要素在什么条件下、用哪个 Symbolizer 画出来。PointSymbolizer 画点、LineSymbolizer 画线、PolygonSymbolizer 画面、TextSymbolizer 写字；一个 Rule 里可以同时出现多个 Symbolizer，按出现顺序叠加。

有两个版本常被混用。SLD 1.0.0 的样式参数写作 CssParameter，GeoServer 默认上传的也多是 1.0.0；SLD 1.1.0 改成了 SvgParameter，命名空间也换成 OGC 的新地址。从网上抄来的片段里两种写法混着用，是"样式上传成功但参数不生效"最常见的原因之一。

GeoServer 使用 SLD（Styled Layer Descriptor）标准定义地图样式。

样式还分层级。全局样式放在 GeoServer 的 styles 目录下，所有工作空间都能引用；工作空间样式只属于该工作空间，名字可能和全局样式重名。引用时如果不带前缀，服务端按当前上下文解析，跨工作空间调用就容易指错对象。多租户部署里，建议把每个租户的样式都建在自己工作空间下。

## 7.2 StyleService 核心功能

样式端点挂在 /rest/styles 下。GET /rest/styles.json 返回所有样式，同样带包装层：顶层是 styles 对象，里面的 style 数组才是条目；每个条目一般只有名字和链接，取内容要走单个样式端点。GET /rest/styles/{style}.sld 取回 SLD 正文，GET /rest/styles/{style}.json 取元数据。

创建样式通常分两步：先用 POST /rest/styles 建一个空样式，再用 PUT /rest/styles/{style} 把 SLD 正文写进去；也有的封装把两步合并成一个方法。失败点因此可能落在不同阶段，CreateStyleAsync 抛异常时，先确认是"样式没建成"还是"样式建成了但内容没写进去"——后者会留下一个空样式，拿它当默认样式，图层能显示，符号却全是默认值。

样式名要符合 GeoServer 的命名规则，一般以字母开头，只含字母、数字、下划线、连字符和点。工作空间级的样式在引用时带工作空间前缀，否则可能落到全局样式上。

```csharp
// 获取所有样式
var styles = await styleService.GetStylesAsync();

// 创建新样式
var sldContent = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<StyledLayerDescriptor version=""1.0.0"">
  <NamedLayer>
    <Name>cities</Name>
    <UserStyle>
      <Title>City Style</Title>
      <FeatureTypeStyle>
        <Rule>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name=""fill"">#FF0000</CssParameter></Fill>
              </Mark>
              <Size>6</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>";

await styleService.CreateStyleAsync("city_style", sldContent);
```

把这段 SLD 拆开看。最外层的 StyledLayerDescriptor 声明版本 1.0.0；NamedLayer 的 Name 在独立样式里不参与图层匹配，真正生效的是 UserStyle 下的 FeatureTypeStyle，写成图层名只是为了可读。Rule 没有写 Filter，表示匹配全部要素；需要按属性区分颜色时，就在 Rule 里加 Filter 表达式。

PointSymbolizer 决定点怎么画。Graphic 里可以放 Mark（几何符号）、ExternalGraphic（图片图标）或 Text。Mark 指定 WellKnownName 为 circle，可选值还有 square、triangle、star、cross 等；Fill 里的 CssParameter name="fill" 是填充色，十六进制写法最直观；Size 是符号的像素尺寸，单位是像素而不是地图单位，地图缩放时大小不变。

另外两个常用参数是 Stroke（描边）和 Opacity（透明度）。点符号没有描边时，深色底图上容易糊成一团，加一圈对比色描边能明显改善可读性。颜色值也可以写表达式，分类渲染和按比例尺变化的需求都靠它实现。

## 7.3 样式应用

样式挂到图层靠图层表示里的 defaultStyle 引用，也可以用 additionalStyles 配若干备选样式，供 WMS 的 STYLES 参数按名切换。更新写法仍是"先 GET 完整图层、改引用、再 PUT"，和上一章保持一致。

引用样式时注意作用域：全局样式直接写名字；工作空间级样式要带工作空间前缀。前缀的写法在不同版本的 REST 表示里可能是 workspace:style 或 workspace::style，以服务端返回的 href 为准。名字写错时，图层更新请求可能仍然返回成功，渲染却回退到默认样式，所以更新后要实际请求一次地图确认效果。

样式替换后不要忽略缓存。WMS 的 GetMap 响应会被 GeoWebCache 或浏览器缓存住，改了 SLD 却看不到变化时，先清缓存或加时间戳参数再试。

```csharp
// 为图层设置默认样式
var layer = await layerService.GetLayerAsync("cities");
layer.DefaultStyle = new StyleReference { Name = "city_style" };
await layerService.UpdateLayerAsync("cities", layer);
```

这段代码演示的是最小闭环：取出图层、把 DefaultStyle 指向新建的样式、整体提交。真实的发布脚本还应当处理样式已被其他图层使用的情况——替换一个公共样式的含义是"所有引用它的图层一起改"，想只改一个图层，就为它单独复制一份样式再引用。

如果图层名带工作空间前缀，GetLayerAsync 的参数要写成 workspace:layer；只传裸图层名在单工作空间里可能碰巧成功，多工作空间实例上就会返回 404 或命中错误对象。

## 7.4 本章小结

样式本质上是能进版本库的文本。生产项目里把 SLD 按图层命名存进代码仓库，跟发布脚本一起下发，比在管理页面里改更可控：改样式走代码评审，出了问题能回滚。GeoServer 的样式也可以借助资源端点以文件形式上传，资源管理在后面的章节会展开。

排查渲染问题的顺序可以固定下来：确认样式存在且内容非空，确认图层引用指向它，单独请求样式端点把 SLD 取回来检查，最后才怀疑数据。SLD 语法错误通常在上传阶段就被服务端拒绝，返回 4xx 或 5xx 并带 XML 解析信息；参数名写错、Filter 表达式类型不匹配这类问题不会报错，只会让符号看起来没生效，需要靠对比实验定位。

常用检查点：CssParameter 与 SvgParameter 不要混用；Rule 的顺序会影响叠加结果；Filter 里的属性名区分大小写；颜色值带 # 前缀；Size 和描边宽度是像素单位。记下这几条，大部分样式问题能自己解决。

学习了样式管理和 SLD 配置基础。

下一章讲图层组。图层组把多个图层合成一个对外发布单元，组本身不产生新数据，只是在 WMS 请求里按顺序组织图层和样式，理解了这一章的样式引用，读图层组的样式配置会顺很多。

---

**相关资源**：
- [SLD 规范](https://www.ogc.org/standards/sld)
- [GeoServer 样式文档](https://docs.geoserver.org/latest/en/user/styling/)

<!-- NAVIGATION -->

---

<div class="chapter-nav">
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第06章-要素类型与图层管理/" class="chapter-nav__prev">← 上一章</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/" class="chapter-nav__dir">目录</a>
  <a href="https://znlgis.github.io/gis/tutorial/geoserver-rest-api/第08章-图层组管理API/" class="chapter-nav__next">下一章 →</a>
</div>

<!-- /NAVIGATION -->

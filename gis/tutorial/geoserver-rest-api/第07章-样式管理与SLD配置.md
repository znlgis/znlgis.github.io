# 第07章：样式管理与SLD配置

## 7.1 样式概述

GeoServer 使用 SLD（Styled Layer Descriptor）标准定义地图样式。

## 7.2 StyleService 核心功能

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

## 7.3 样式应用

```csharp
// 为图层设置默认样式
var layer = await layerService.GetLayerAsync("cities");
layer.DefaultStyle = new StyleReference { Name = "city_style" };
await layerService.UpdateLayerAsync("cities", layer);
```

## 7.4 本章小结

学习了样式管理和 SLD 配置基础。

---

**相关资源**：
- [SLD 规范](https://www.ogc.org/standards/sld)
- [GeoServer 样式文档](https://docs.geoserver.org/latest/en/user/styling/)

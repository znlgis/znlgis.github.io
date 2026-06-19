---
layout: default
title: 第5章 地图样式与SLD
---

# 第5章 地图样式与SLD

## 5.1 SLD标准介绍

### 5.1.1 什么是SLD

Styled Layer Descriptor（SLD）是OGC制定的地图样式描述标准，用于定义如何渲染地理数据。SLD使用XML语法描述地图的视觉呈现方式，包括颜色、符号、线型、填充等。

**SLD的核心价值：**
- **标准化**：作为OGC标准，SLD在不同GIS软件间具有互操作性
- **灵活性**：可以定义复杂的样式规则，包括条件渲染
- **分离关注点**：将数据和样式分离，便于管理和重用

### 5.1.2 SLD文档结构

一个典型的SLD文档结构如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  
  <NamedLayer>
    <Name>图层名称</Name>
    <UserStyle>
      <Name>样式名称</Name>
      <Title>样式标题</Title>
      <FeatureTypeStyle>
        <Rule>
          <Name>规则名称</Name>
          <Title>规则标题</Title>
          <!-- 过滤条件 -->
          <ogc:Filter>...</ogc:Filter>
          <!-- 比例尺条件 -->
          <MinScaleDenominator>1000</MinScaleDenominator>
          <MaxScaleDenominator>100000</MaxScaleDenominator>
          <!-- 符号化器 -->
          <PointSymbolizer>...</PointSymbolizer>
          <LineSymbolizer>...</LineSymbolizer>
          <PolygonSymbolizer>...</PolygonSymbolizer>
          <TextSymbolizer>...</TextSymbolizer>
          <RasterSymbolizer>...</RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
```

### 5.1.3 SLD核心元素

**NamedLayer vs UserLayer：**
- NamedLayer：引用GeoServer中已发布的图层
- UserLayer：使用内联数据或外部数据源

**FeatureTypeStyle：**
- 定义要素类型的样式
- 可以包含多个Rule
- 多个FeatureTypeStyle会依次渲染

**Rule：**
- 定义一条样式规则
- 可以包含过滤条件
- 可以包含比例尺范围
- 可以包含一个或多个符号化器

### 5.1.4 GeoServer样式管理

**创建新样式：**

1. 进入"数据" > "样式"
2. 点击"添加新样式"
3. 填写样式信息：
   - 名称：样式的唯一标识符
   - 工作区：样式所属工作区（可选）
   - 格式：SLD、CSS、YSLD等
4. 在编辑器中输入样式代码
5. 点击"验证"检查语法
6. 点击"提交"保存

**关联样式到图层：**

1. 进入图层编辑页面
2. 在"发布"标签页找到"WMS设置"
3. 设置"默认样式"
4. 在"附加样式"中添加可选样式

## 5.2 点要素样式设计

### 5.2.1 基本点样式

使用简单的圆形符号：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer>
    <Name>points</Name>
    <UserStyle>
      <Title>Simple Point</Title>
      <FeatureTypeStyle>
        <Rule>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#FF0000</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#000000</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>10</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
```

### 5.2.2 预定义符号

GeoServer支持以下预定义符号（WellKnownName）：

| 符号 | 说明 |
|------|------|
| circle | 圆形 |
| square | 正方形 |
| triangle | 三角形 |
| star | 五角星 |
| cross | 十字 |
| x | X形 |
| diamond | 菱形 |
| arrow | 箭头 |

### 5.2.3 使用图标

使用外部图像文件作为点符号：

```xml
<PointSymbolizer>
  <Graphic>
    <ExternalGraphic>
      <OnlineResource xlink:type="simple" 
        xlink:href="http://localhost:8080/geoserver/styles/icons/hospital.png"/>
      <Format>image/png</Format>
    </ExternalGraphic>
    <Size>24</Size>
  </Graphic>
</PointSymbolizer>
```

**使用相对路径：**

```xml
<ExternalGraphic>
  <OnlineResource xlink:type="simple" 
    xlink:href="icons/hospital.png"/>
  <Format>image/png</Format>
</ExternalGraphic>
```

图标文件应放在GeoServer数据目录的styles文件夹下。

### 5.2.4 点符号分类

根据属性值使用不同的符号：

```xml
<FeatureTypeStyle>
  <!-- 医院 -->
  <Rule>
    <Name>Hospital</Name>
    <ogc:Filter>
      <ogc:PropertyIsEqualTo>
        <ogc:PropertyName>type</ogc:PropertyName>
        <ogc:Literal>hospital</ogc:Literal>
      </ogc:PropertyIsEqualTo>
    </ogc:Filter>
    <PointSymbolizer>
      <Graphic>
        <ExternalGraphic>
          <OnlineResource xlink:type="simple" xlink:href="icons/hospital.png"/>
          <Format>image/png</Format>
        </ExternalGraphic>
        <Size>20</Size>
      </Graphic>
    </PointSymbolizer>
  </Rule>
  
  <!-- 学校 -->
  <Rule>
    <Name>School</Name>
    <ogc:Filter>
      <ogc:PropertyIsEqualTo>
        <ogc:PropertyName>type</ogc:PropertyName>
        <ogc:Literal>school</ogc:Literal>
      </ogc:PropertyIsEqualTo>
    </ogc:Filter>
    <PointSymbolizer>
      <Graphic>
        <ExternalGraphic>
          <OnlineResource xlink:type="simple" xlink:href="icons/school.png"/>
          <Format>image/png</Format>
        </ExternalGraphic>
        <Size>20</Size>
      </Graphic>
    </PointSymbolizer>
  </Rule>
</FeatureTypeStyle>
```

### 5.2.5 点大小分级

根据数值属性设置符号大小：

```xml
<PointSymbolizer>
  <Graphic>
    <Mark>
      <WellKnownName>circle</WellKnownName>
      <Fill>
        <CssParameter name="fill">#3366FF</CssParameter>
      </Fill>
    </Mark>
    <Size>
      <ogc:Mul>
        <ogc:Div>
          <ogc:PropertyName>population</ogc:PropertyName>
          <ogc:Literal>100000</ogc:Literal>
        </ogc:Div>
        <ogc:Literal>5</ogc:Literal>
      </ogc:Mul>
    </Size>
  </Graphic>
</PointSymbolizer>
```

## 5.3 线要素样式设计

### 5.3.1 基本线样式

简单的实线样式：

```xml
<LineSymbolizer>
  <Stroke>
    <CssParameter name="stroke">#FF0000</CssParameter>
    <CssParameter name="stroke-width">2</CssParameter>
    <CssParameter name="stroke-linecap">round</CssParameter>
    <CssParameter name="stroke-linejoin">round</CssParameter>
  </Stroke>
</LineSymbolizer>
```

**线条属性说明：**

| 属性 | 说明 | 可选值 |
|------|------|--------|
| stroke | 线条颜色 | 十六进制颜色值 |
| stroke-width | 线条宽度 | 像素值 |
| stroke-opacity | 透明度 | 0-1 |
| stroke-linecap | 线端样式 | butt, round, square |
| stroke-linejoin | 连接样式 | miter, round, bevel |
| stroke-dasharray | 虚线模式 | 如 "5 2" |
| stroke-dashoffset | 虚线偏移 | 像素值 |

### 5.3.2 虚线和点线

```xml
<!-- 虚线 -->
<LineSymbolizer>
  <Stroke>
    <CssParameter name="stroke">#333333</CssParameter>
    <CssParameter name="stroke-width">2</CssParameter>
    <CssParameter name="stroke-dasharray">10 5</CssParameter>
  </Stroke>
</LineSymbolizer>

<!-- 点线 -->
<LineSymbolizer>
  <Stroke>
    <CssParameter name="stroke">#333333</CssParameter>
    <CssParameter name="stroke-width">2</CssParameter>
    <CssParameter name="stroke-dasharray">2 5</CssParameter>
    <CssParameter name="stroke-linecap">round</CssParameter>
  </Stroke>
</LineSymbolizer>

<!-- 点划线 -->
<LineSymbolizer>
  <Stroke>
    <CssParameter name="stroke">#333333</CssParameter>
    <CssParameter name="stroke-width">2</CssParameter>
    <CssParameter name="stroke-dasharray">10 5 2 5</CssParameter>
  </Stroke>
</LineSymbolizer>
```

### 5.3.3 双线（套壳线）

通过多个符号化器实现套壳线效果：

```xml
<FeatureTypeStyle>
  <Rule>
    <!-- 底层宽线（外边框） -->
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#000000</CssParameter>
        <CssParameter name="stroke-width">5</CssParameter>
        <CssParameter name="stroke-linecap">round</CssParameter>
      </Stroke>
    </LineSymbolizer>
    <!-- 顶层窄线（内部填充） -->
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#FFFF00</CssParameter>
        <CssParameter name="stroke-width">3</CssParameter>
        <CssParameter name="stroke-linecap">round</CssParameter>
      </Stroke>
    </LineSymbolizer>
  </Rule>
</FeatureTypeStyle>
```

### 5.3.4 道路样式分类

根据道路等级显示不同样式：

```xml
<FeatureTypeStyle>
  <!-- 高速公路 -->
  <Rule>
    <Name>Highway</Name>
    <ogc:Filter>
      <ogc:PropertyIsEqualTo>
        <ogc:PropertyName>road_class</ogc:PropertyName>
        <ogc:Literal>highway</ogc:Literal>
      </ogc:PropertyIsEqualTo>
    </ogc:Filter>
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#E34234</CssParameter>
        <CssParameter name="stroke-width">6</CssParameter>
      </Stroke>
    </LineSymbolizer>
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#FF6B5B</CssParameter>
        <CssParameter name="stroke-width">4</CssParameter>
      </Stroke>
    </LineSymbolizer>
  </Rule>
  
  <!-- 主干道 -->
  <Rule>
    <Name>Primary</Name>
    <ogc:Filter>
      <ogc:PropertyIsEqualTo>
        <ogc:PropertyName>road_class</ogc:PropertyName>
        <ogc:Literal>primary</ogc:Literal>
      </ogc:PropertyIsEqualTo>
    </ogc:Filter>
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#FFA500</CssParameter>
        <CssParameter name="stroke-width">4</CssParameter>
      </Stroke>
    </LineSymbolizer>
  </Rule>
  
  <!-- 次要道路 -->
  <Rule>
    <Name>Secondary</Name>
    <ogc:Filter>
      <ogc:PropertyIsEqualTo>
        <ogc:PropertyName>road_class</ogc:PropertyName>
        <ogc:Literal>secondary</ogc:Literal>
      </ogc:PropertyIsEqualTo>
    </ogc:Filter>
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#FFD700</CssParameter>
        <CssParameter name="stroke-width">2</CssParameter>
      </Stroke>
    </LineSymbolizer>
  </Rule>
</FeatureTypeStyle>
```

### 5.3.5 线上符号

在线上重复显示符号：

```xml
<LineSymbolizer>
  <Stroke>
    <GraphicStroke>
      <Graphic>
        <Mark>
          <WellKnownName>circle</WellKnownName>
          <Fill>
            <CssParameter name="fill">#000000</CssParameter>
          </Fill>
        </Mark>
        <Size>6</Size>
      </Graphic>
    </GraphicStroke>
    <CssParameter name="stroke-dasharray">12 12</CssParameter>
  </Stroke>
</LineSymbolizer>
```

## 5.4 面要素样式设计

### 5.4.1 基本面样式

简单的填充和边框：

```xml
<PolygonSymbolizer>
  <Fill>
    <CssParameter name="fill">#00FF00</CssParameter>
    <CssParameter name="fill-opacity">0.5</CssParameter>
  </Fill>
  <Stroke>
    <CssParameter name="stroke">#000000</CssParameter>
    <CssParameter name="stroke-width">1</CssParameter>
  </Stroke>
</PolygonSymbolizer>
```

### 5.4.2 图案填充

使用图案进行填充：

```xml
<PolygonSymbolizer>
  <Fill>
    <GraphicFill>
      <Graphic>
        <Mark>
          <WellKnownName>shape://slash</WellKnownName>
          <Stroke>
            <CssParameter name="stroke">#000000</CssParameter>
            <CssParameter name="stroke-width">1</CssParameter>
          </Stroke>
        </Mark>
        <Size>8</Size>
      </Graphic>
    </GraphicFill>
  </Fill>
  <Stroke>
    <CssParameter name="stroke">#000000</CssParameter>
    <CssParameter name="stroke-width">1</CssParameter>
  </Stroke>
</PolygonSymbolizer>
```

**预定义填充图案：**
- shape://slash：斜线
- shape://backslash：反斜线
- shape://vertline：竖线
- shape://horline：横线
- shape://plus：加号
- shape://times：乘号

### 5.4.3 分级色彩

根据数值属性进行颜色分级：

```xml
<FeatureTypeStyle>
  <!-- 第一级 -->
  <Rule>
    <Name>Low</Name>
    <ogc:Filter>
      <ogc:PropertyIsLessThan>
        <ogc:PropertyName>population</ogc:PropertyName>
        <ogc:Literal>100000</ogc:Literal>
      </ogc:PropertyIsLessThan>
    </ogc:Filter>
    <PolygonSymbolizer>
      <Fill>
        <CssParameter name="fill">#FFFFB2</CssParameter>
      </Fill>
    </PolygonSymbolizer>
  </Rule>
  
  <!-- 第二级 -->
  <Rule>
    <Name>Medium</Name>
    <ogc:Filter>
      <ogc:And>
        <ogc:PropertyIsGreaterThanOrEqualTo>
          <ogc:PropertyName>population</ogc:PropertyName>
          <ogc:Literal>100000</ogc:Literal>
        </ogc:PropertyIsGreaterThanOrEqualTo>
        <ogc:PropertyIsLessThan>
          <ogc:PropertyName>population</ogc:PropertyName>
          <ogc:Literal>500000</ogc:Literal>
        </ogc:PropertyIsLessThan>
      </ogc:And>
    </ogc:Filter>
    <PolygonSymbolizer>
      <Fill>
        <CssParameter name="fill">#FECC5C</CssParameter>
      </Fill>
    </PolygonSymbolizer>
  </Rule>
  
  <!-- 第三级 -->
  <Rule>
    <Name>High</Name>
    <ogc:Filter>
      <ogc:PropertyIsGreaterThanOrEqualTo>
        <ogc:PropertyName>population</ogc:PropertyName>
        <ogc:Literal>500000</ogc:Literal>
      </ogc:PropertyIsGreaterThanOrEqualTo>
    </ogc:Filter>
    <PolygonSymbolizer>
      <Fill>
        <CssParameter name="fill">#FD8D3C</CssParameter>
      </Fill>
    </PolygonSymbolizer>
  </Rule>
</FeatureTypeStyle>
```

### 5.4.4 颜色插值

使用函数进行连续颜色渐变：

```xml
<PolygonSymbolizer>
  <Fill>
    <CssParameter name="fill">
      <ogc:Function name="Interpolate">
        <ogc:PropertyName>population</ogc:PropertyName>
        <ogc:Literal>0</ogc:Literal>
        <ogc:Literal>#FFFFB2</ogc:Literal>
        <ogc:Literal>500000</ogc:Literal>
        <ogc:Literal>#FD8D3C</ogc:Literal>
        <ogc:Literal>1000000</ogc:Literal>
        <ogc:Literal>#BD0026</ogc:Literal>
        <ogc:Literal>color</ogc:Literal>
      </ogc:Function>
    </CssParameter>
  </Fill>
</PolygonSymbolizer>
```

## 5.5 文本标注与注记

### 5.5.1 基本文本标注

```xml
<TextSymbolizer>
  <Label>
    <ogc:PropertyName>name</ogc:PropertyName>
  </Label>
  <Font>
    <CssParameter name="font-family">Arial</CssParameter>
    <CssParameter name="font-size">12</CssParameter>
    <CssParameter name="font-style">normal</CssParameter>
    <CssParameter name="font-weight">bold</CssParameter>
  </Font>
  <Fill>
    <CssParameter name="fill">#000000</CssParameter>
  </Fill>
</TextSymbolizer>
```

### 5.5.2 文字描边（Halo）

添加白色描边使文字在复杂背景上更清晰：

```xml
<TextSymbolizer>
  <Label>
    <ogc:PropertyName>name</ogc:PropertyName>
  </Label>
  <Font>
    <CssParameter name="font-family">Arial</CssParameter>
    <CssParameter name="font-size">14</CssParameter>
  </Font>
  <Halo>
    <Radius>2</Radius>
    <Fill>
      <CssParameter name="fill">#FFFFFF</CssParameter>
    </Fill>
  </Halo>
  <Fill>
    <CssParameter name="fill">#333333</CssParameter>
  </Fill>
</TextSymbolizer>
```

### 5.5.3 标注位置控制

**点要素标注位置：**

```xml
<TextSymbolizer>
  <Label>
    <ogc:PropertyName>name</ogc:PropertyName>
  </Label>
  <LabelPlacement>
    <PointPlacement>
      <AnchorPoint>
        <AnchorPointX>0.5</AnchorPointX>
        <AnchorPointY>0</AnchorPointY>
      </AnchorPoint>
      <Displacement>
        <DisplacementX>0</DisplacementX>
        <DisplacementY>10</DisplacementY>
      </Displacement>
      <Rotation>0</Rotation>
    </PointPlacement>
  </LabelPlacement>
  <Font>
    <CssParameter name="font-family">Arial</CssParameter>
    <CssParameter name="font-size">12</CssParameter>
  </Font>
  <Fill>
    <CssParameter name="fill">#000000</CssParameter>
  </Fill>
</TextSymbolizer>
```

**线要素标注位置：**

```xml
<TextSymbolizer>
  <Label>
    <ogc:PropertyName>name</ogc:PropertyName>
  </Label>
  <LabelPlacement>
    <LinePlacement>
      <PerpendicularOffset>5</PerpendicularOffset>
    </LinePlacement>
  </LabelPlacement>
  <Font>
    <CssParameter name="font-family">Arial</CssParameter>
    <CssParameter name="font-size">10</CssParameter>
  </Font>
  <Fill>
    <CssParameter name="fill">#333333</CssParameter>
  </Fill>
  <VendorOption name="followLine">true</VendorOption>
  <VendorOption name="maxAngleDelta">30</VendorOption>
</TextSymbolizer>
```

### 5.5.4 标注冲突处理

GeoServer提供了丰富的标注冲突处理选项：

```xml
<TextSymbolizer>
  <Label>
    <ogc:PropertyName>name</ogc:PropertyName>
  </Label>
  <Font>
    <CssParameter name="font-family">Arial</CssParameter>
    <CssParameter name="font-size">12</CssParameter>
  </Font>
  <!-- 允许重叠 -->
  <VendorOption name="conflictResolution">false</VendorOption>
  <!-- 允许部分标注显示在地图外 -->
  <VendorOption name="partials">true</VendorOption>
  <!-- 标注优先级 -->
  <Priority>
    <ogc:PropertyName>population</ogc:PropertyName>
  </Priority>
  <!-- 标注间距 -->
  <VendorOption name="spaceAround">10</VendorOption>
  <!-- 多边形标注重复 -->
  <VendorOption name="repeat">200</VendorOption>
</TextSymbolizer>
```

### 5.5.5 中文字体配置

在Linux服务器上使用中文字体：

1. 安装中文字体：
```bash
# Ubuntu/Debian
sudo apt install fonts-wqy-microhei fonts-wqy-zenhei

# CentOS/RHEL
sudo yum install wqy-microhei-fonts wqy-zenhei-fonts
```

2. 在SLD中使用中文字体：
```xml
<Font>
  <CssParameter name="font-family">WenQuanYi Micro Hei</CssParameter>
  <CssParameter name="font-size">12</CssParameter>
</Font>
```

3. 重启GeoServer使字体生效

## 5.6 复杂样式与规则

### 5.6.1 比例尺依赖样式

根据地图比例尺显示不同样式：

```xml
<FeatureTypeStyle>
  <!-- 小比例尺（大范围） -->
  <Rule>
    <Name>Small Scale</Name>
    <MinScaleDenominator>100000</MinScaleDenominator>
    <PointSymbolizer>
      <Graphic>
        <Mark>
          <WellKnownName>circle</WellKnownName>
          <Fill>
            <CssParameter name="fill">#FF0000</CssParameter>
          </Fill>
        </Mark>
        <Size>5</Size>
      </Graphic>
    </PointSymbolizer>
  </Rule>
  
  <!-- 大比例尺（小范围） -->
  <Rule>
    <Name>Large Scale</Name>
    <MaxScaleDenominator>100000</MaxScaleDenominator>
    <PointSymbolizer>
      <Graphic>
        <Mark>
          <WellKnownName>circle</WellKnownName>
          <Fill>
            <CssParameter name="fill">#FF0000</CssParameter>
          </Fill>
        </Mark>
        <Size>15</Size>
      </Graphic>
    </PointSymbolizer>
    <TextSymbolizer>
      <Label>
        <ogc:PropertyName>name</ogc:PropertyName>
      </Label>
      <Font>
        <CssParameter name="font-family">Arial</CssParameter>
        <CssParameter name="font-size">12</CssParameter>
      </Font>
    </TextSymbolizer>
  </Rule>
</FeatureTypeStyle>
```

### 5.6.2 ElseFilter

使用ElseFilter处理未匹配的要素：

```xml
<FeatureTypeStyle>
  <Rule>
    <Name>Highway</Name>
    <ogc:Filter>
      <ogc:PropertyIsEqualTo>
        <ogc:PropertyName>type</ogc:PropertyName>
        <ogc:Literal>highway</ogc:Literal>
      </ogc:PropertyIsEqualTo>
    </ogc:Filter>
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#FF0000</CssParameter>
        <CssParameter name="stroke-width">4</CssParameter>
      </Stroke>
    </LineSymbolizer>
  </Rule>
  
  <!-- 其他所有道路 -->
  <Rule>
    <Name>Other Roads</Name>
    <ElseFilter/>
    <LineSymbolizer>
      <Stroke>
        <CssParameter name="stroke">#999999</CssParameter>
        <CssParameter name="stroke-width">1</CssParameter>
      </Stroke>
    </LineSymbolizer>
  </Rule>
</FeatureTypeStyle>
```

### 5.6.3 渲染顺序控制

使用多个FeatureTypeStyle控制渲染顺序：

```xml
<UserStyle>
  <!-- 第一层：填充 -->
  <FeatureTypeStyle>
    <Rule>
      <PolygonSymbolizer>
        <Fill>
          <CssParameter name="fill">#AAFFAA</CssParameter>
        </Fill>
      </PolygonSymbolizer>
    </Rule>
  </FeatureTypeStyle>
  
  <!-- 第二层：边框 -->
  <FeatureTypeStyle>
    <Rule>
      <PolygonSymbolizer>
        <Stroke>
          <CssParameter name="stroke">#006600</CssParameter>
          <CssParameter name="stroke-width">2</CssParameter>
        </Stroke>
      </PolygonSymbolizer>
    </Rule>
  </FeatureTypeStyle>
  
  <!-- 第三层：标注 -->
  <FeatureTypeStyle>
    <Rule>
      <TextSymbolizer>
        <Label>
          <ogc:PropertyName>name</ogc:PropertyName>
        </Label>
      </TextSymbolizer>
    </Rule>
  </FeatureTypeStyle>
</UserStyle>
```

## 5.7 CSS样式扩展

### 5.7.1 CSS样式简介

GeoServer支持CSS样式语言，提供了更简洁的样式定义方式：

```css
/* 点样式 */
* {
  mark: symbol(circle);
  mark-size: 10;
  :mark {
    fill: #FF0000;
    stroke: #000000;
  }
}

/* 线样式 */
* {
  stroke: #0000FF;
  stroke-width: 2;
}

/* 面样式 */
* {
  fill: #00FF00;
  fill-opacity: 0.5;
  stroke: #000000;
}
```

### 5.7.2 CSS属性选择器

```css
/* 属性等于 */
[type = 'highway'] {
  stroke: #FF0000;
  stroke-width: 4;
}

/* 属性大于 */
[population > 1000000] {
  fill: #FF0000;
}

/* 属性模糊匹配 */
[name like '%Beijing%'] {
  mark-size: 20;
}

/* 多条件 */
[type = 'primary'][lanes > 2] {
  stroke-width: 4;
}
```

### 5.7.3 CSS比例尺条件

```css
/* 在指定比例尺范围内 */
[@scale < 100000] {
  mark-size: 15;
  label: [name];
}

[@scale >= 100000] {
  mark-size: 5;
}
```

### 5.7.4 CSS标注

```css
* {
  label: [name];
  font-family: "Arial";
  font-size: 12;
  font-fill: #333333;
  halo-color: white;
  halo-radius: 2;
  label-offset: 0 10;
}

/* 线沿线标注 */
[type = 'road'] {
  label: [name];
  label-follow-line: true;
  label-max-angle-delta: 30;
}
```

### 5.7.5 CSS vs SLD

| 方面 | CSS | SLD |
|------|-----|-----|
| 语法复杂度 | 简洁 | 冗长 |
| 学习曲线 | 较低 | 较高 |
| 功能完整性 | 略有限制 | 完整 |
| 互操作性 | GeoServer特有 | OGC标准 |
| 性能 | 运行时转换为SLD | 直接使用 |

建议：对于简单样式使用CSS，对于复杂样式或需要互操作性的场景使用SLD。

## 本章小结

本章详细介绍了GeoServer的地图样式系统：

1. **SLD基础**：理解SLD的结构和核心元素
2. **点样式**：学会使用符号和图标渲染点要素
3. **线样式**：掌握线条样式、虚线和套壳线的设计
4. **面样式**：学会填充、图案和分级色彩的应用
5. **文本标注**：掌握标注的字体、位置和冲突处理
6. **高级样式**：理解比例尺依赖和渲染顺序控制
7. **CSS样式**：了解CSS样式扩展的使用方法

良好的地图样式设计是制作专业地图的关键。通过灵活运用SLD和CSS，可以创建美观且信息丰富的地图可视化效果。

在下一章中，我们将学习GeoServer的安全管理，包括用户认证、访问控制和数据安全。

## 思考与练习

1. 创建一个SLD样式，使用不同颜色渲染不同类型的道路。
2. 设计一个分级色彩地图，根据人口数量显示不同颜色。
3. 为点要素添加图标，并实现比例尺依赖的符号大小。
4. 创建带有文字描边的标注样式。
5. 将一个SLD样式转换为等效的CSS样式。
6. 设计一个完整的地图样式，包含道路、建筑和标注。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第04章-OGC标准服务" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第06章-安全管理与访问控制" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

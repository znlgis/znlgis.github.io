# 第五章：BIM轻量化与CAD解析

## 5.1 BIM功能概述

Astral3D提供了强大的BIM（Building Information Modeling，建筑信息模型）支持能力，能够将复杂的建筑模型轻量化处理后在Web端流畅展示，是数字孪生和智慧建筑应用的理想选择。

### 5.1.1 BIM支持能力

| 功能 | 描述 | 支持格式 |
|-----|------|---------|
| 模型导入 | 导入原生BIM文件 | RVT, IFC, RFA |
| 轻量化处理 | 自动减面和优化 | 所有BIM格式 |
| 属性提取 | 提取构件属性信息 | IFC |
| 层级保留 | 保持楼层/系统层级 | IFC, RVT |
| 类别过滤 | 按构件类别显示/隐藏 | IFC |
| 测量标注 | 距离、面积、体积测量 | 所有格式 |
| 剖切显示 | 楼层剖切、系统剖切 | 所有格式 |

### 5.1.2 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         BIM处理流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ BIM文件 │ ─→ │ 解析器  │ ─→ │ 轻量化  │ ─→ │ 渲染器  │     │
│  │RVT/IFC │    │Parser  │    │Optimizer│    │Renderer │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│       │              │              │              │           │
│       ▼              ▼              ▼              ▼           │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │原始数据 │    │结构数据 │    │优化网格 │    │显示结果 │     │
│  │~GB级    │    │树形结构 │    │~MB级    │    │60FPS   │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5.2 IFC文件处理

IFC（Industry Foundation Classes）是国际通用的BIM数据交换标准，Astral3D提供了完整的IFC解析和展示能力。

### 5.2.1 IFC文件导入

**基础导入：**

```typescript
import { IFCLoader } from '@astral3d/engine';

const ifcLoader = new IFCLoader();

// 导入IFC文件
const model = await ifcLoader.load('building.ifc', {
  // 基础选项
  lightweight: true,      // 启用轻量化
  extractProperties: true, // 提取属性
  
  // 进度回调
  onProgress: (progress) => {
    console.log(`解析进度: ${(progress * 100).toFixed(1)}%`);
  }
});

viewer.scene.add(model);
```

**高级配置：**

```typescript
interface IFCLoadOptions {
  // 轻量化选项
  lightweight: boolean;         // 启用轻量化
  simplifyRatio: number;        // 简化比例 (0-1)
  mergeGeometries: boolean;     // 合并几何体
  
  // 数据提取
  extractProperties: boolean;   // 提取构件属性
  extractRelations: boolean;    // 提取关系数据
  extractMaterials: boolean;    // 提取材质信息
  
  // 结构保留
  preserveHierarchy: boolean;   // 保留层级结构
  groupByStorey: boolean;       // 按楼层分组
  groupBySystem: boolean;       // 按系统分组
  
  // 过滤选项
  includeTypes: string[];       // 包含的IFC类型
  excludeTypes: string[];       // 排除的IFC类型
  
  // LOD选项
  generateLOD: boolean;         // 生成LOD
  lodDistances: number[];       // LOD切换距离
  
  // 坐标选项
  coordinateSystem: 'local' | 'project'; // 坐标系统
  applyMatrix: boolean;         // 应用变换矩阵
}
```

### 5.2.2 IFC属性访问

```typescript
// 获取构件属性
const properties = ifcLoader.getProperties(expressId);
console.log('构件属性:', properties);

// 属性结构示例
{
  expressID: 12345,
  type: 'IfcWall',
  name: '基本墙:200mm混凝土',
  description: '',
  properties: {
    // 标识数据
    GlobalId: '2O2Fr$t4X7Zf8NOew3FNr5',
    Name: '基本墙:200mm混凝土',
    ObjectType: '基本墙:200mm混凝土',
    
    // 数量数据
    NetVolume: 15.6,      // 净体积
    NetArea: 78.0,        // 净面积
    Length: 10.0,         // 长度
    Height: 3.0,          // 高度
    Width: 0.2,           // 宽度
    
    // 材质数据
    Material: '混凝土',
    
    // 分类数据
    IsExternal: true,     // 是否外墙
    LoadBearing: true,    // 是否承重
    FireRating: '2小时'    // 防火等级
  },
  
  // 空间关系
  containedIn: 'IfcBuildingStorey#345',  // 所属楼层
  referencedBy: ['IfcRelVoidsElement#456'], // 被引用
  isDecomposedBy: []  // 分解关系
}
```

### 5.2.3 IFC空间查询

```typescript
// 按类型查询
const walls = ifcLoader.getElementsByType('IfcWall');
const doors = ifcLoader.getElementsByType('IfcDoor');
const windows = ifcLoader.getElementsByType('IfcWindow');

// 按楼层查询
const floor1Elements = ifcLoader.getElementsByStorey('一层');
const floor2Elements = ifcLoader.getElementsByStorey('二层');

// 按属性查询
const externalWalls = ifcLoader.getElementsByProperty({
  type: 'IfcWall',
  properties: {
    IsExternal: true
  }
});

// 空间包含查询
const roomElements = ifcLoader.getElementsInSpace('房间A');
```

### 5.2.4 IFC可视化控制

```typescript
// 按类型显示/隐藏
ifcLoader.setTypeVisibility('IfcWall', true);
ifcLoader.setTypeVisibility('IfcSlab', false);
ifcLoader.setTypeVisibility('IfcColumn', true);

// 按楼层显示/隐藏
ifcLoader.setStoreyVisibility('地下室', false);
ifcLoader.setStoreyVisibility('一层', true);
ifcLoader.setStoreyVisibility('二层', true);

// 高亮特定构件
ifcLoader.highlightElement(expressId, 0xff0000);

// 透明化显示
ifcLoader.setElementOpacity(expressId, 0.3);

// 隔离显示
ifcLoader.isolateElements([expressId1, expressId2]);

// 恢复显示
ifcLoader.showAllElements();
```

## 5.3 Revit文件处理

Revit（RVT）是Autodesk公司的专业BIM软件，Astral3D支持Revit文件的导入和轻量化显示。

### 5.3.1 Revit导入配置

```typescript
import { RevitLoader } from '@astral3d/engine';

const revitLoader = new RevitLoader();

// Revit导入选项
interface RevitLoadOptions {
  // 转换设置
  convertToGltf: boolean;       // 转换为glTF
  exportViews: string[];        // 导出的视图
  exportPhases: string[];       // 导出的阶段
  
  // 轻量化
  lightweight: boolean;
  detailLevel: 'coarse' | 'medium' | 'fine';
  
  // 数据提取
  extractParameters: boolean;   // 提取参数
  extractFamilies: boolean;     // 提取族信息
  extractSchedules: boolean;    // 提取明细表
  
  // 材质
  exportMaterials: boolean;     // 导出材质
  materialMapping: object;      // 材质映射表
}

// 导入示例
const model = await revitLoader.load('project.rvt', {
  lightweight: true,
  detailLevel: 'medium',
  extractParameters: true
});
```

### 5.3.2 Revit数据结构

```typescript
// Revit项目结构
interface RevitProject {
  // 项目信息
  projectInfo: {
    name: string;
    number: string;
    client: string;
    address: string;
    status: string;
  };
  
  // 等级（楼层）
  levels: {
    id: number;
    name: string;
    elevation: number;
    elements: number[];
  }[];
  
  // 视图
  views: {
    id: number;
    name: string;
    type: string;
    elements: number[];
  }[];
  
  // 族
  families: {
    id: number;
    name: string;
    category: string;
    instances: number[];
  }[];
  
  // 元素
  elements: Map<number, RevitElement>;
}

interface RevitElement {
  id: number;
  category: string;
  family: string;
  type: string;
  level: string;
  parameters: Map<string, any>;
  geometry: THREE.BufferGeometry;
}
```

### 5.3.3 Revit参数访问

```typescript
// 获取元素参数
const element = revitLoader.getElementById(12345);
const params = element.parameters;

// 常用参数示例
const length = params.get('长度');
const area = params.get('面积');
const volume = params.get('体积');
const mark = params.get('标记');
const comments = params.get('注释');

// 类型参数
const typeParams = revitLoader.getTypeParameters(element.typeId);
const material = typeParams.get('材质');
const manufacturer = typeParams.get('制造商');

// 按参数查询
const largeWalls = revitLoader.getElementsByParameter({
  category: '墙',
  parameter: '面积',
  operator: '>',
  value: 50
});
```

## 5.4 CAD文件解析

Astral3D支持AutoCAD的DWG和DXF格式文件的解析和预览，可以将2D图纸转换为3D可视化或直接进行2D预览。

### 5.4.1 支持的CAD格式

| 格式 | 版本支持 | 功能 |
|-----|---------|------|
| DWG | 2004-2024 | 完整解析 |
| DXF | R12-2024 | 完整解析 |
| DGN | V7/V8 | 部分支持 |

### 5.4.2 CAD导入配置

```typescript
import { CADLoader } from '@astral3d/engine';

const cadLoader = new CADLoader();

// CAD导入选项
interface CADLoadOptions {
  // 显示模式
  mode: '2d' | '3d';            // 显示模式
  
  // 图层设置
  importLayers: boolean;         // 导入图层
  visibleLayers: string[];       // 可见图层
  hiddenLayers: string[];        // 隐藏图层
  layerColors: boolean;          // 使用图层颜色
  
  // 实体设置
  importBlocks: boolean;         // 导入块
  expandBlocks: boolean;         // 展开块
  importDimensions: boolean;     // 导入尺寸标注
  importText: boolean;           // 导入文字
  importHatch: boolean;          // 导入填充
  
  // 3D转换
  convertTo3D: boolean;          // 转换为3D
  extrudeHeight: number;         // 拉伸高度
  extrudeByLayer: boolean;       // 按图层拉伸
  layerHeights: object;          // 图层高度映射
  
  // 单位设置
  sourceUnit: string;            // 源单位
  targetUnit: string;            // 目标单位
  scale: number;                 // 缩放比例
}
```

### 5.4.3 DWG文件处理

```typescript
// 导入DWG文件
const dwgModel = await cadLoader.load('floorplan.dwg', {
  mode: '2d',
  importLayers: true,
  importDimensions: true,
  importText: true
});

// 获取图层列表
const layers = cadLoader.getLayers();
console.log('图层列表:', layers);
// ['0', '墙体', '门窗', '家具', '标注', '文字']

// 按图层显示/隐藏
cadLoader.setLayerVisibility('家具', false);
cadLoader.setLayerVisibility('标注', true);

// 获取图层颜色
const wallColor = cadLoader.getLayerColor('墙体');
// { r: 255, g: 0, b: 0 }

// 设置图层颜色
cadLoader.setLayerColor('墙体', { r: 0, g: 100, b: 200 });
```

### 5.4.4 DXF文件处理

```typescript
// 解析DXF文件
const dxfData = await cadLoader.parseDXF('drawing.dxf');

// DXF数据结构
interface DXFData {
  header: {
    version: string;
    units: string;
    extMin: [number, number, number];
    extMax: [number, number, number];
  };
  
  tables: {
    layers: DXFLayer[];
    lineTypes: DXFLineType[];
    styles: DXFStyle[];
    blocks: DXFBlock[];
  };
  
  entities: DXFEntity[];
}

interface DXFEntity {
  type: string;  // LINE, CIRCLE, ARC, POLYLINE, TEXT, DIMENSION, etc.
  layer: string;
  color: number;
  lineType: string;
  data: object;  // 根据类型不同
}

// 遍历实体
dxfData.entities.forEach(entity => {
  switch (entity.type) {
    case 'LINE':
      console.log('直线:', entity.data.start, '->', entity.data.end);
      break;
    case 'CIRCLE':
      console.log('圆:', entity.data.center, 'R=', entity.data.radius);
      break;
    case 'TEXT':
      console.log('文字:', entity.data.text, '@', entity.data.position);
      break;
  }
});
```

### 5.4.5 2D到3D转换

```typescript
// 将2D CAD图转换为3D模型
const model3D = await cadLoader.convertTo3D('floorplan.dwg', {
  // 墙体拉伸
  walls: {
    layer: '墙体',
    height: 3.0,
    thickness: 0.24
  },
  
  // 门窗开洞
  openings: {
    doors: {
      layer: '门',
      height: 2.1,
      sillHeight: 0
    },
    windows: {
      layer: '窗',
      height: 1.5,
      sillHeight: 0.9
    }
  },
  
  // 楼板
  floor: {
    layer: '楼板',
    thickness: 0.15
  },
  
  // 家具
  furniture: {
    layer: '家具',
    height: 0.75  // 默认高度
  }
});

viewer.scene.add(model3D);
```

## 5.5 轻量化处理

### 5.5.1 轻量化算法

```typescript
// 网格简化
interface SimplifyOptions {
  ratio: number;           // 简化比例 (0-1)
  preserveEdges: boolean;  // 保留边缘
  preserveUV: boolean;     // 保留UV坐标
  errorTolerance: number;  // 误差容限
}

// 简化函数
function simplifyMesh(geometry, options) {
  const modifier = new SimplifyModifier();
  const simplified = modifier.modify(geometry, options.ratio);
  return simplified;
}

// 几何体合并
function mergeGeometries(meshes) {
  const geometries = meshes.map(m => m.geometry);
  const merged = BufferGeometryUtils.mergeGeometries(geometries);
  return new THREE.Mesh(merged, meshes[0].material);
}

// 实例化优化
function instanceOptimize(meshes) {
  // 按几何体和材质分组
  const groups = groupBySimilar(meshes);
  
  // 创建实例化网格
  return groups.map(group => {
    return new THREE.InstancedMesh(
      group.geometry,
      group.material,
      group.count
    );
  });
}
```

### 5.5.2 LOD系统

```typescript
// LOD配置
interface LODConfig {
  levels: {
    distance: number;    // 切换距离
    ratio: number;       // 简化比例
  }[];
}

// 生成LOD
function generateLOD(mesh, config) {
  const lod = new THREE.LOD();
  
  config.levels.forEach(level => {
    const simplified = simplifyMesh(mesh.geometry, {
      ratio: level.ratio
    });
    const lodMesh = new THREE.Mesh(simplified, mesh.material);
    lod.addLevel(lodMesh, level.distance);
  });
  
  return lod;
}

// 使用示例
const lodConfig = {
  levels: [
    { distance: 0, ratio: 1.0 },      // 近距离：原始
    { distance: 50, ratio: 0.5 },     // 中距离：50%
    { distance: 100, ratio: 0.2 },    // 远距离：20%
    { distance: 200, ratio: 0.05 }    // 超远：5%
  ]
};

scene.traverse(obj => {
  if (obj instanceof THREE.Mesh && obj.geometry.attributes.position.count > 10000) {
    const lod = generateLOD(obj, lodConfig);
    obj.parent.add(lod);
    obj.parent.remove(obj);
  }
});
```

### 5.5.3 纹理压缩

```typescript
// 纹理优化选项
interface TextureOptimizeOptions {
  maxSize: number;         // 最大尺寸
  format: 'jpg' | 'png' | 'webp' | 'basis';
  quality: number;         // 质量 (0-1)
  generateMipmaps: boolean;
  compression: 'none' | 'dxt' | 'etc' | 'pvrtc' | 'astc';
}

// 优化纹理
async function optimizeTextures(scene, options) {
  const textures = new Set();
  
  // 收集所有纹理
  scene.traverse(obj => {
    if (obj.material) {
      const materials = Array.isArray(obj.material) 
        ? obj.material 
        : [obj.material];
      
      materials.forEach(mat => {
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']
          .forEach(key => {
            if (mat[key]) textures.add(mat[key]);
          });
      });
    }
  });
  
  // 处理每个纹理
  for (const texture of textures) {
    await processTexture(texture, options);
  }
}
```

## 5.6 剖切与分析

### 5.6.1 剖切面

```typescript
// 创建剖切面
class ClippingPlane {
  plane: THREE.Plane;
  helper: THREE.PlaneHelper;
  
  constructor(normal, constant) {
    this.plane = new THREE.Plane(normal, constant);
    this.helper = new THREE.PlaneHelper(this.plane, 100, 0xff0000);
  }
  
  // 应用到渲染器
  apply(renderer) {
    renderer.clippingPlanes = [this.plane];
    renderer.localClippingEnabled = true;
  }
  
  // 设置位置
  setPosition(value) {
    this.plane.constant = -value;
  }
  
  // 动画移动
  async animate(from, to, duration) {
    return new Promise(resolve => {
      const start = Date.now();
      const animate = () => {
        const t = (Date.now() - start) / duration;
        if (t >= 1) {
          this.setPosition(to);
          resolve();
        } else {
          this.setPosition(from + (to - from) * t);
          requestAnimationFrame(animate);
        }
      };
      animate();
    });
  }
}

// 楼层剖切
const floorClip = new ClippingPlane(
  new THREE.Vector3(0, -1, 0),  // 向下的法向量
  -3.0  // 剖切高度3米
);
floorClip.apply(viewer.renderer);

// 剖切动画（楼层漫游）
await floorClip.animate(0, 15, 5000);  // 从0到15米，5秒
```

### 5.6.2 测量工具

```typescript
// 距离测量
function measureDistance(point1, point2) {
  return point1.distanceTo(point2);
}

// 面积测量
function measureArea(points) {
  // 使用Shoelace公式
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

// 体积测量
function measureVolume(mesh) {
  const geometry = mesh.geometry;
  let volume = 0;
  
  const position = geometry.attributes.position;
  const indices = geometry.index;
  
  for (let i = 0; i < indices.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, indices.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(position, indices.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(position, indices.getX(i + 2));
    
    volume += signedVolumeOfTriangle(a, b, c);
  }
  
  return Math.abs(volume);
}

function signedVolumeOfTriangle(p1, p2, p3) {
  return p1.dot(p2.cross(p3)) / 6.0;
}
```

### 5.6.3 碰撞检测

```typescript
// 射线检测
function raycast(origin, direction, objects) {
  const raycaster = new THREE.Raycaster(origin, direction);
  const intersects = raycaster.intersectObjects(objects, true);
  return intersects;
}

// 包围盒碰撞
function boxCollision(object1, object2) {
  const box1 = new THREE.Box3().setFromObject(object1);
  const box2 = new THREE.Box3().setFromObject(object2);
  return box1.intersectsBox(box2);
}

// 空间查询
function queryInBox(box, objects) {
  return objects.filter(obj => {
    const objBox = new THREE.Box3().setFromObject(obj);
    return box.intersectsBox(objBox);
  });
}

// 管线碰撞检测
function checkPipeCollision(pipes) {
  const collisions = [];
  
  for (let i = 0; i < pipes.length; i++) {
    for (let j = i + 1; j < pipes.length; j++) {
      if (boxCollision(pipes[i], pipes[j])) {
        // 精细检测
        const intersects = meshIntersect(pipes[i], pipes[j]);
        if (intersects.length > 0) {
          collisions.push({
            pipe1: pipes[i],
            pipe2: pipes[j],
            points: intersects
          });
        }
      }
    }
  }
  
  return collisions;
}
```

## 5.7 属性面板集成

### 5.7.1 属性显示组件

```vue
<template>
  <div class="property-panel">
    <div class="header">
      <h3>{{ element.name }}</h3>
      <span class="type">{{ element.type }}</span>
    </div>
    
    <div class="section">
      <h4>基本信息</h4>
      <PropertyItem label="ID" :value="element.id" />
      <PropertyItem label="类别" :value="element.category" />
      <PropertyItem label="所属楼层" :value="element.level" />
    </div>
    
    <div class="section">
      <h4>几何信息</h4>
      <PropertyItem label="长度" :value="formatLength(element.length)" />
      <PropertyItem label="面积" :value="formatArea(element.area)" />
      <PropertyItem label="体积" :value="formatVolume(element.volume)" />
    </div>
    
    <div class="section" v-if="element.properties">
      <h4>自定义属性</h4>
      <PropertyItem 
        v-for="(value, key) in element.properties"
        :key="key"
        :label="key"
        :value="value"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  element: Object
});

const formatLength = (value) => `${value.toFixed(2)} m`;
const formatArea = (value) => `${value.toFixed(2)} m²`;
const formatVolume = (value) => `${value.toFixed(2)} m³`;
</script>
```

### 5.7.2 属性编辑

```typescript
// 属性编辑管理器
class PropertyEditor {
  element: any;
  
  // 设置编辑目标
  setTarget(element) {
    this.element = element;
  }
  
  // 更新属性
  updateProperty(key, value) {
    this.element.properties[key] = value;
    this.element.needsUpdate = true;
    
    // 触发更新事件
    dispatchSignal('propertyChanged', {
      element: this.element,
      key,
      value
    });
  }
  
  // 批量更新
  updateProperties(props) {
    Object.entries(props).forEach(([key, value]) => {
      this.element.properties[key] = value;
    });
    this.element.needsUpdate = true;
  }
  
  // 重置属性
  resetProperty(key) {
    delete this.element.properties[key];
  }
}
```

## 5.8 本章小结

本章详细介绍了Astral3D的BIM轻量化和CAD解析功能，主要内容包括：

1. **BIM功能概述**：支持能力、技术架构和处理流程
2. **IFC文件处理**：导入配置、属性访问、空间查询、可视化控制
3. **Revit文件处理**：导入配置、数据结构、参数访问
4. **CAD文件解析**：DWG/DXF支持、图层管理、2D到3D转换
5. **轻量化处理**：简化算法、LOD系统、纹理压缩
6. **剖切与分析**：剖切面、测量工具、碰撞检测
7. **属性面板**：属性显示和编辑功能

通过本章的学习，读者应该能够使用Astral3D处理BIM和CAD文件，构建专业的建筑可视化应用。

---

**下一章预告**：第六章将介绍Astral3D的粒子系统和天气系统，包括粒子效果创建、天气模拟、环境特效等功能的使用方法。

<!-- NAVIGATION -->

---

<div style="display: flex; justify-content: space-between; margin: 20px 0;">
  <a href="第04章-场景编辑与模型管理" style="text-decoration: none;">← 上一章</a>
  <a href="./" style="text-decoration: none;">目录</a>
  <a href="第06章-粒子系统与天气系统" style="text-decoration: none;">下一章 →</a>
</div>

<!-- /NAVIGATION -->

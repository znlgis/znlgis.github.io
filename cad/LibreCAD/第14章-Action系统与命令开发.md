---
layout: default
title: Action系统与命令开发
---

# 第十四章 Action系统与命令开发

## 14.1 Action系统概述

### 14.1.1 Action的概念

在LibreCAD中，Action是封装用户交互操作的核心机制。每当用户执行一个命令（如画线、移动、复制），都会创建一个对应的Action对象来处理整个交互过程。

**Action的作用**：
- 管理命令的状态机
- 处理用户输入（鼠标、键盘、命令行）
- 调用核心库完成实际操作
- 提供视觉反馈（预览、提示）

### 14.1.2 Action生命周期

```
┌──────────┐
│  创建    │ 用户选择命令，Action对象被创建
└────┬─────┘
     ↓
┌──────────┐
│  初始化  │ init() - 设置初始状态，显示提示
└────┬─────┘
     ↓
┌──────────┐
│  事件    │ ← 鼠标点击、移动、键盘输入
│  处理    │ → 状态转换、操作执行
└────┬─────┘
     ↓ (可能多次循环)
┌──────────┐
│  挂起    │ suspend() - 被其他Action打断
│  恢复    │ resume() - 恢复执行
└────┬─────┘
     ↓
┌──────────┐
│  结束    │ finish() - 清理资源，恢复默认
└──────────┘
```

### 14.1.3 Action类层次

```
RS_ActionInterface              # 基类
├── RS_ActionDrawLine          # 画线
├── RS_ActionDrawCircle        # 画圆
├── RS_ActionModifyMove        # 移动
├── RS_ActionModifyRotate      # 旋转
├── RS_ActionDefault           # 默认选择动作
└── RS_ActionSelect...         # 选择类动作
```

## 14.2 RS_ActionInterface详解

### 14.2.1 类定义

```cpp
class RS_ActionInterface : public QObject {
    Q_OBJECT

public:
    // 构造函数
    RS_ActionInterface(const char* name,
                      RS_EntityContainer& container,
                      RS_GraphicView& graphicView);
    virtual ~RS_ActionInterface();
    
    // ===== 生命周期方法 =====
    
    // 初始化（状态设为status，默认为0）
    virtual void init(int status = 0);
    
    // 结束Action
    virtual void finish(bool updateTB = true);
    
    // 挂起（被其他Action打断时调用）
    virtual void suspend();
    
    // 恢复执行
    virtual void resume();
    
    // ===== 事件处理方法 =====
    
    // 鼠标事件
    virtual void mouseReleaseEvent(QMouseEvent* e);
    virtual void mouseMoveEvent(QMouseEvent* e);
    virtual void mousePressEvent(QMouseEvent* e);
    
    // 键盘事件
    virtual void keyPressEvent(QKeyEvent* e);
    virtual void keyReleaseEvent(QKeyEvent* e);
    
    // 坐标输入事件（命令行输入坐标）
    virtual void coordinateEvent(RS_CoordinateEvent* e);
    
    // 命令输入事件（命令行输入命令/选项）
    virtual void commandEvent(RS_CommandEvent* e);
    
    // ===== 状态管理 =====
    
    int getStatus() const { return status; }
    void setStatus(int s);
    
    // ===== 提示信息 =====
    
    // 更新鼠标按钮提示
    virtual void updateMouseButtonHints();
    
    // 更新工具栏
    virtual void updateToolBar();
    
    // 显示命令提示
    virtual void showOptions();
    virtual void hideOptions();
    
    // ===== 触发器 =====
    
    // 选择变化时调用
    virtual void selectionChanged();
    
    // ===== 辅助方法 =====
    
    // 获取名称
    QString getName() const { return name; }
    
    // 检查是否已完成
    bool isFinished() const { return finished; }
    
protected:
    // 名称
    QString name;
    
    // 关联的容器和视图
    RS_EntityContainer* container;
    RS_GraphicView* graphicView;
    RS_Document* document;
    
    // 状态
    int status;
    bool finished;
    
    // 捕捉相关
    RS_Snapper* snapper;
    
    // 预览实体
    RS_EntityContainer* preview;
    
    // 辅助方法
    RS_Vector snapPoint(QMouseEvent* e);
    void deletePreview();
    void drawPreview();
};
```

### 14.2.2 关键方法详解

**init() - 初始化**
```cpp
void RS_ActionInterface::init(int status) {
    this->status = status;
    finished = false;
    
    // 更新UI
    updateMouseButtonHints();
    updateToolBar();
    
    // 子类可以重写添加自定义初始化
}
```

**finish() - 结束**
```cpp
void RS_ActionInterface::finish(bool updateTB) {
    finished = true;
    
    // 清理预览
    deletePreview();
    
    // 更新UI
    if (updateTB) {
        updateToolBar();
    }
    
    // 通知图形视图
    graphicView->setCurrentAction(nullptr);
}
```

## 14.3 开发自定义Action

### 14.3.1 创建Action类

创建一个简单的画星形Action：

```cpp
// rs_actiondrawstar.h
#ifndef RS_ACTIONDRAWSTAR_H
#define RS_ACTIONDRAWSTAR_H

#include "rs_actioninterface.h"
#include "rs_vector.h"

class RS_ActionDrawStar : public RS_ActionInterface {
    Q_OBJECT

public:
    // 状态枚举
    enum Status {
        SetCenter,       // 等待中心点
        SetOuterRadius,  // 等待外半径
        SetInnerRadius   // 等待内半径
    };
    
    RS_ActionDrawStar(RS_EntityContainer& container,
                     RS_GraphicView& graphicView);
    ~RS_ActionDrawStar() override;
    
    void init(int status = 0) override;
    void trigger();
    
    void mouseMoveEvent(QMouseEvent* e) override;
    void mouseReleaseEvent(QMouseEvent* e) override;
    void coordinateEvent(RS_CoordinateEvent* e) override;
    void commandEvent(RS_CommandEvent* e) override;
    
    void updateMouseButtonHints() override;
    
    // 设置参数
    void setPoints(int p) { points = p; }
    int getPoints() const { return points; }

private:
    RS_Vector center;      // 中心点
    double outerRadius;    // 外半径
    double innerRadius;    // 内半径
    int points;            // 星形角数
    
    void drawStar(RS_Vector center, double outer, double inner);
};

#endif
```

### 14.3.2 实现Action

```cpp
// rs_actiondrawstar.cpp
#include "rs_actiondrawstar.h"
#include "rs_graphic.h"
#include "rs_graphicview.h"
#include "rs_dialogfactory.h"
#include "rs_line.h"
#include "rs_polyline.h"
#include "rs_math.h"

RS_ActionDrawStar::RS_ActionDrawStar(RS_EntityContainer& container,
                                     RS_GraphicView& graphicView)
    : RS_ActionInterface("Draw Star", container, graphicView)
    , outerRadius(0.0)
    , innerRadius(0.0)
    , points(5)  // 默认5角星
{
}

RS_ActionDrawStar::~RS_ActionDrawStar() = default;

void RS_ActionDrawStar::init(int status) {
    RS_ActionInterface::init(status);
    
    // 重置数据
    if (status == SetCenter) {
        center = RS_Vector(false);
        outerRadius = 0.0;
        innerRadius = 0.0;
    }
}

void RS_ActionDrawStar::trigger() {
    // 检查参数有效性
    if (!center.valid || outerRadius <= 0.0 || innerRadius <= 0.0) {
        return;
    }
    
    // 创建星形
    drawStar(center, outerRadius, innerRadius);
    
    // 重置，准备绘制下一个
    center = RS_Vector(false);
    outerRadius = 0.0;
    innerRadius = 0.0;
    setStatus(SetCenter);
    
    // 更新视图
    graphicView->redraw(RS2::RedrawDrawing);
}

void RS_ActionDrawStar::drawStar(RS_Vector c, double outer, double inner) {
    if (!document) return;
    
    // 开始撤销记录
    document->startUndoCycle();
    
    // 创建折线
    RS_Polyline* polyline = new RS_Polyline(container);
    polyline->setLayer(document->getActiveLayer());
    polyline->setPen(RS_Pen());
    
    // 计算顶点
    double angleStep = M_PI / points;
    RS_Vector firstPoint;
    
    for (int i = 0; i < points * 2; i++) {
        double angle = i * angleStep - M_PI / 2;  // 从顶部开始
        double radius = (i % 2 == 0) ? outer : inner;
        
        RS_Vector vertex = c + RS_Vector(angle) * radius;
        
        if (i == 0) {
            firstPoint = vertex;
            polyline->addVertex(vertex);
        } else {
            polyline->addVertex(vertex);
        }
    }
    
    // 闭合折线
    polyline->setClosed(true);
    
    // 添加到容器
    container->addEntity(polyline);
    
    // 添加到撤销记录
    document->addUndoable(polyline);
    document->endUndoCycle();
}

void RS_ActionDrawStar::mouseMoveEvent(QMouseEvent* e) {
    RS_Vector mouse = snapPoint(e);
    
    // 删除旧预览
    deletePreview();
    
    switch (getStatus()) {
        case SetCenter:
            // 无预览
            break;
            
        case SetOuterRadius:
            if (center.valid) {
                // 预览外圆
                RS_Circle* circle = new RS_Circle(preview,
                    RS_CircleData(center, center.distanceTo(mouse)));
                preview->addEntity(circle);
            }
            break;
            
        case SetInnerRadius:
            if (center.valid && outerRadius > 0.0) {
                // 预览星形轮廓
                double inner = center.distanceTo(mouse);
                if (inner < outerRadius) {
                    // 创建预览星形
                    double angleStep = M_PI / points;
                    RS_Vector prev;
                    for (int i = 0; i <= points * 2; i++) {
                        double angle = i * angleStep - M_PI / 2;
                        double r = (i % 2 == 0) ? outerRadius : inner;
                        RS_Vector current = center + RS_Vector(angle) * r;
                        
                        if (i > 0) {
                            RS_Line* line = new RS_Line(preview,
                                RS_LineData(prev, current));
                            preview->addEntity(line);
                        }
                        prev = current;
                    }
                }
            }
            break;
    }
    
    drawPreview();
}

void RS_ActionDrawStar::mouseReleaseEvent(QMouseEvent* e) {
    if (e->button() == Qt::LeftButton) {
        RS_Vector mouse = snapPoint(e);
        
        switch (getStatus()) {
            case SetCenter:
                center = mouse;
                setStatus(SetOuterRadius);
                break;
                
            case SetOuterRadius:
                outerRadius = center.distanceTo(mouse);
                if (outerRadius > RS_TOLERANCE) {
                    setStatus(SetInnerRadius);
                }
                break;
                
            case SetInnerRadius:
                innerRadius = center.distanceTo(mouse);
                if (innerRadius > RS_TOLERANCE && innerRadius < outerRadius) {
                    trigger();
                }
                break;
        }
    } else if (e->button() == Qt::RightButton) {
        // 右键返回上一状态或取消
        if (getStatus() > SetCenter) {
            setStatus(getStatus() - 1);
        } else {
            finish();
        }
    }
}

void RS_ActionDrawStar::coordinateEvent(RS_CoordinateEvent* e) {
    RS_Vector pos = e->getCoordinate();
    
    switch (getStatus()) {
        case SetCenter:
            center = pos;
            setStatus(SetOuterRadius);
            break;
            
        case SetOuterRadius:
            outerRadius = center.distanceTo(pos);
            if (outerRadius > RS_TOLERANCE) {
                setStatus(SetInnerRadius);
            }
            break;
            
        case SetInnerRadius:
            innerRadius = center.distanceTo(pos);
            if (innerRadius > RS_TOLERANCE && innerRadius < outerRadius) {
                trigger();
            }
            break;
    }
}

void RS_ActionDrawStar::commandEvent(RS_CommandEvent* e) {
    QString cmd = e->getCommand().toLower();
    
    // 处理选项
    if (checkCommand("points", cmd)) {
        // 处理角数选项
        // 这里可以添加解析逻辑
        e->accept();
    }
}

void RS_ActionDrawStar::updateMouseButtonHints() {
    switch (getStatus()) {
        case SetCenter:
            RS_DIALOGFACTORY->updateMouseWidget(
                tr("指定星形中心点"),
                tr("取消"));
            break;
            
        case SetOuterRadius:
            RS_DIALOGFACTORY->updateMouseWidget(
                tr("指定外半径"),
                tr("返回"));
            break;
            
        case SetInnerRadius:
            RS_DIALOGFACTORY->updateMouseWidget(
                tr("指定内半径"),
                tr("返回"));
            break;
    }
}
```

### 14.3.3 注册Action

在命令系统中注册新Action：

```cpp
// 在rs_commands.cpp或适当位置

// 添加动作类型枚举（如果需要）
namespace RS2 {
    enum ActionType {
        // ... 现有类型
        ActionDrawStar,
    };
}

// 注册命令
RS_Commands::addCommand("star", RS2::ActionDrawStar);
RS_Commands::addAlias("st", "star");

// 在QC_ApplicationWindow中创建Action
void QC_ApplicationWindow::slotDrawStar() {
    RS_ActionDrawStar* action = new RS_ActionDrawStar(
        *document, *graphicView);
    graphicView->setCurrentAction(action);
}
```

## 14.4 事件处理详解

### 14.4.1 鼠标事件

```cpp
// 鼠标按下
void MyAction::mousePressEvent(QMouseEvent* e) {
    if (e->button() == Qt::LeftButton) {
        // 左键按下处理
    } else if (e->button() == Qt::MiddleButton) {
        // 中键按下 - 通常用于平移
    } else if (e->button() == Qt::RightButton) {
        // 右键按下
    }
}

// 鼠标释放
void MyAction::mouseReleaseEvent(QMouseEvent* e) {
    if (e->button() == Qt::LeftButton) {
        RS_Vector point = snapPoint(e);
        // 处理点击
    } else if (e->button() == Qt::RightButton) {
        // 右键 - 通常取消或返回
        finish();
    }
}

// 鼠标移动
void MyAction::mouseMoveEvent(QMouseEvent* e) {
    RS_Vector mouse = snapPoint(e);
    
    // 更新预览
    deletePreview();
    // 创建预览实体...
    drawPreview();
}
```

### 14.4.2 键盘事件

```cpp
void MyAction::keyPressEvent(QKeyEvent* e) {
    switch (e->key()) {
        case Qt::Key_Escape:
            // 取消操作
            finish();
            e->accept();
            break;
            
        case Qt::Key_Return:
        case Qt::Key_Enter:
            // 确认/完成
            if (canFinish()) {
                trigger();
            }
            e->accept();
            break;
            
        case Qt::Key_Space:
            // 重复上一个操作
            repeatLastPoint();
            e->accept();
            break;
            
        default:
            // 传递给父类处理
            RS_ActionInterface::keyPressEvent(e);
            break;
    }
}
```

### 14.4.3 命令行事件

```cpp
void MyAction::coordinateEvent(RS_CoordinateEvent* e) {
    // 用户在命令行输入了坐标
    RS_Vector pos = e->getCoordinate();
    
    // 根据当前状态处理坐标
    switch (getStatus()) {
        case SetPoint1:
            point1 = pos;
            setStatus(SetPoint2);
            break;
        case SetPoint2:
            point2 = pos;
            trigger();
            break;
    }
}

void MyAction::commandEvent(RS_CommandEvent* e) {
    QString cmd = e->getCommand().toLower();
    
    // 检查是否是选项命令
    if (checkCommand("undo", cmd) || cmd == "u") {
        undo();
        e->accept();
    } else if (checkCommand("close", cmd) || cmd == "c") {
        close();
        e->accept();
    } else {
        // 尝试解析为数字
        bool ok;
        double value = RS_Math::eval(cmd, &ok);
        if (ok) {
            handleNumericInput(value);
            e->accept();
        }
    }
}
```

## 14.5 预览系统

### 14.5.1 预览实体管理

```cpp
class RS_ActionInterface {
protected:
    // 预览容器
    RS_EntityContainer* preview;
    
    // 删除所有预览实体
    void deletePreview() {
        if (preview) {
            preview->clear();
        }
        if (graphicView) {
            graphicView->redraw(RS2::RedrawOverlay);
        }
    }
    
    // 绘制预览
    void drawPreview() {
        if (graphicView) {
            graphicView->redraw(RS2::RedrawOverlay);
        }
    }
};
```

### 14.5.2 预览示例

```cpp
void RS_ActionDrawLine::mouseMoveEvent(QMouseEvent* e) {
    RS_Vector mouse = snapPoint(e);
    
    deletePreview();
    
    if (getStatus() == SetEndPoint && startPoint.valid) {
        // 创建预览线
        RS_Line* previewLine = new RS_Line(
            preview,
            RS_LineData(startPoint, mouse)
        );
        preview->addEntity(previewLine);
    }
    
    drawPreview();
}
```

## 14.6 状态机设计

### 14.6.1 状态定义

```cpp
class RS_ActionDrawRectangle : public RS_ActionInterface {
public:
    // 清晰的状态枚举
    enum Status {
        SetCorner1 = 0,  // 第一角点
        SetCorner2,       // 对角点
        SetWidth,         // 宽度（可选）
        SetHeight         // 高度（可选）
    };
    
    // 模式枚举
    enum Mode {
        TwoCorners,       // 两角点模式
        CenterSize,       // 中心+尺寸模式
        WidthHeight       // 宽高模式
    };
};
```

### 14.6.2 状态转换

```cpp
void RS_ActionDrawRectangle::mouseReleaseEvent(QMouseEvent* e) {
    if (e->button() != Qt::LeftButton) {
        // 右键返回或取消
        if (getStatus() > SetCorner1) {
            init(getStatus() - 1);  // 返回上一状态
        } else {
            finish();
        }
        return;
    }
    
    RS_Vector mouse = snapPoint(e);
    
    switch (getStatus()) {
        case SetCorner1:
            corner1 = mouse;
            setStatus(SetCorner2);
            break;
            
        case SetCorner2:
            corner2 = mouse;
            trigger();  // 创建矩形
            init(SetCorner1);  // 准备下一个
            break;
    }
}
```

## 14.7 与核心库交互

### 14.7.1 创建实体

```cpp
void MyAction::createEntity() {
    // 确保有文档
    if (!document) return;
    
    // 开始撤销周期
    document->startUndoCycle();
    
    // 创建实体
    RS_Line* line = new RS_Line(container,
        RS_LineData(point1, point2));
    
    // 设置属性
    line->setLayer(document->getActiveLayer());
    line->setPen(document->getActivePen());
    
    // 添加到容器
    container->addEntity(line);
    
    // 添加到撤销系统
    document->addUndoable(line);
    
    // 结束撤销周期
    document->endUndoCycle();
}
```

### 14.7.2 修改实体

```cpp
void MyAction::modifyEntity(RS_Entity* entity) {
    if (!document || !entity) return;
    
    document->startUndoCycle();
    
    // 保存原始状态（用于撤销）
    RS_Entity* clone = entity->clone();
    
    // 执行修改
    entity->move(offset);
    
    // 添加到撤销系统
    document->addUndoable(entity);
    
    document->endUndoCycle();
    
    // 更新视图
    graphicView->redraw(RS2::RedrawDrawing);
}
```

## 14.8 撤销/重做支持

### 14.8.1 撤销周期

```cpp
// 正确的撤销支持模式
void MyAction::trigger() {
    document->startUndoCycle();
    
    // 执行所有相关操作
    RS_Entity* e1 = createEntity1();
    RS_Entity* e2 = createEntity2();
    
    document->addUndoable(e1);
    document->addUndoable(e2);
    
    document->endUndoCycle();
    // 现在 Ctrl+Z 会一次性撤销所有操作
}
```

### 14.8.2 撤销数据类

```cpp
class RS_Undoable {
public:
    virtual ~RS_Undoable() = default;
    
    // 标记为已删除（撤销时恢复）
    void setUndoState(bool undone) { this->undone = undone; }
    bool isUndone() const { return undone; }
    
private:
    bool undone = false;
};
```

## 14.9 实战：完整Action开发

### 14.9.1 需求分析

开发一个绘制等边三角形的Action：
- 用户指定中心点
- 用户指定外接圆半径
- 可选指定旋转角度

### 14.9.2 完整代码

```cpp
// rs_actiondrawtriangle.h
#ifndef RS_ACTIONDRAWTRIANGLE_H
#define RS_ACTIONDRAWTRIANGLE_H

#include "rs_actioninterface.h"

class RS_ActionDrawTriangle : public RS_ActionInterface {
    Q_OBJECT

public:
    enum Status {
        SetCenter,
        SetRadius
    };

    RS_ActionDrawTriangle(RS_EntityContainer& container,
                         RS_GraphicView& graphicView);
    ~RS_ActionDrawTriangle() override;

    void init(int status = 0) override;
    void trigger();
    
    void mouseMoveEvent(QMouseEvent* e) override;
    void mouseReleaseEvent(QMouseEvent* e) override;
    void coordinateEvent(RS_CoordinateEvent* e) override;
    void commandEvent(RS_CommandEvent* e) override;
    void updateMouseButtonHints() override;

private:
    RS_Vector center;
    double radius;
    double rotation;  // 旋转角度
    
    void createTriangle();
    void drawTrianglePreview(const RS_Vector& c, double r);
};

#endif

// rs_actiondrawtriangle.cpp
#include "rs_actiondrawtriangle.h"
#include "rs_graphic.h"
#include "rs_graphicview.h"
#include "rs_dialogfactory.h"
#include "rs_line.h"
#include "rs_polyline.h"

RS_ActionDrawTriangle::RS_ActionDrawTriangle(
    RS_EntityContainer& container,
    RS_GraphicView& graphicView)
    : RS_ActionInterface("Draw Triangle", container, graphicView)
    , radius(0.0)
    , rotation(0.0)  // 默认顶点朝上
{
}

RS_ActionDrawTriangle::~RS_ActionDrawTriangle() = default;

void RS_ActionDrawTriangle::init(int status) {
    RS_ActionInterface::init(status);
    
    if (status == SetCenter) {
        center = RS_Vector(false);
        radius = 0.0;
    }
}

void RS_ActionDrawTriangle::trigger() {
    if (!center.valid || radius <= 0.0) return;
    
    createTriangle();
    
    center = RS_Vector(false);
    radius = 0.0;
    setStatus(SetCenter);
    
    graphicView->redraw(RS2::RedrawDrawing);
}

void RS_ActionDrawTriangle::createTriangle() {
    if (!document) return;
    
    document->startUndoCycle();
    
    // 创建闭合折线
    RS_Polyline* triangle = new RS_Polyline(container);
    triangle->setLayer(document->getActiveLayer());
    triangle->setPen(document->getActivePen());
    
    // 计算三个顶点（等边三角形）
    for (int i = 0; i < 3; i++) {
        double angle = rotation + i * (2.0 * M_PI / 3.0);
        RS_Vector vertex = center + RS_Vector(angle) * radius;
        triangle->addVertex(vertex);
    }
    
    triangle->setClosed(true);
    
    container->addEntity(triangle);
    document->addUndoable(triangle);
    document->endUndoCycle();
}

void RS_ActionDrawTriangle::mouseMoveEvent(QMouseEvent* e) {
    RS_Vector mouse = snapPoint(e);
    
    deletePreview();
    
    switch (getStatus()) {
        case SetCenter:
            // 无预览
            break;
            
        case SetRadius:
            if (center.valid) {
                drawTrianglePreview(center, center.distanceTo(mouse));
            }
            break;
    }
    
    drawPreview();
}

void RS_ActionDrawTriangle::drawTrianglePreview(
    const RS_Vector& c, double r) {
    if (r <= 0.0) return;
    
    RS_Vector prev;
    RS_Vector first;
    
    for (int i = 0; i <= 3; i++) {
        double angle = rotation + (i % 3) * (2.0 * M_PI / 3.0);
        RS_Vector vertex = c + RS_Vector(angle) * r;
        
        if (i == 0) {
            first = vertex;
        }
        
        if (i > 0) {
            RS_Line* line = new RS_Line(preview,
                RS_LineData(prev, vertex));
            preview->addEntity(line);
        }
        
        prev = vertex;
    }
}

void RS_ActionDrawTriangle::mouseReleaseEvent(QMouseEvent* e) {
    if (e->button() == Qt::LeftButton) {
        RS_Vector mouse = snapPoint(e);
        
        switch (getStatus()) {
            case SetCenter:
                center = mouse;
                setStatus(SetRadius);
                break;
                
            case SetRadius:
                radius = center.distanceTo(mouse);
                if (radius > RS_TOLERANCE) {
                    trigger();
                }
                break;
        }
    } else if (e->button() == Qt::RightButton) {
        if (getStatus() > SetCenter) {
            init(getStatus() - 1);
        } else {
            finish();
        }
    }
}

void RS_ActionDrawTriangle::coordinateEvent(RS_CoordinateEvent* e) {
    RS_Vector pos = e->getCoordinate();
    
    switch (getStatus()) {
        case SetCenter:
            center = pos;
            setStatus(SetRadius);
            break;
            
        case SetRadius:
            radius = center.distanceTo(pos);
            if (radius > RS_TOLERANCE) {
                trigger();
            }
            break;
    }
}

void RS_ActionDrawTriangle::commandEvent(RS_CommandEvent* e) {
    QString cmd = e->getCommand().toLower();
    
    // 处理旋转角度选项
    bool ok;
    double angle = RS_Math::eval(cmd, &ok);
    if (ok) {
        rotation = RS_Math::deg2rad(angle);
        e->accept();
    }
}

void RS_ActionDrawTriangle::updateMouseButtonHints() {
    switch (getStatus()) {
        case SetCenter:
            RS_DIALOGFACTORY->updateMouseWidget(
                tr("指定三角形中心"),
                tr("取消"));
            break;
            
        case SetRadius:
            RS_DIALOGFACTORY->updateMouseWidget(
                tr("指定外接圆半径"),
                tr("返回"));
            break;
    }
}
```

## 14.10 本章小结

本章详细介绍了LibreCAD的Action系统：

1. **Action概述**：概念、生命周期、类层次
2. **RS_ActionInterface**：核心方法、状态管理
3. **开发自定义Action**：创建类、实现、注册
4. **事件处理**：鼠标、键盘、命令行事件
5. **预览系统**：预览实体管理
6. **状态机设计**：状态定义、转换
7. **核心库交互**：创建实体、修改实体
8. **撤销/重做支持**：撤销周期
9. **完整实战**：等边三角形Action

掌握Action系统是开发LibreCAD自定义命令的关键。

---

[上一章：实体系统详解](第13章-实体系统详解) | [下一章：插件系统与开发实战](第15章-插件系统与开发实战)

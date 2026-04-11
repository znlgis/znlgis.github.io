---
layout: default
title: "第5章：LED 模块与数字输出控制"
---

# 第5章：LED 模块与数字输出控制

> 本章介绍 LED 模块、激光模块、交通灯模块的工作原理与编程控制方法。

---

## 5.1 LED 模块原理

### 5.1.1 基本结构

LED（Light Emitting Diode）发光二极管是最基本的输出设备。Keyes LED 模块包含：

- LED 发光管
- 限流电阻
- 驱动电路（三极管）

### 5.1.2 驱动电路分析

```
        VCC
         │
        [R3 电流限流]
         │
        LED+
         │
        LED-
         │
    NPN 集电极
         │
    NPN 发射极 ─── GND
         │
    NPN 基极 ─── [R1 限流] ─── S (GPIO)
```

**工作原理**：
1. GPIO 输出高电平 → 三极管导通 → LED 点亮
2. GPIO 输出低电平 → 三极管截止 → LED 熄灭

### 5.1.3 为什么用三极管

直接用 GPIO 驱动 LED 存在问题：
- Pico GPIO 最大输出电流仅 12mA
- LED 正常工作需要 10-20mA
- 直接驱动可能导致 LED 较暗或 GPIO 损坏

三极管作为电子开关，可以用小电流控制大电流。

---

## 5.2 LED 控制代码

### 5.2.1 点亮 LED

```python
'''
实验：点亮 LED
接线：LED 模块 S 端连接 GP0
'''
from machine import Pin

# 配置 GP0 为输出模式
led = Pin(0, Pin.OUT)

# 点亮 LED
led.value(1)  # 输出高电平
```

### 5.2.2 LED 闪烁

```python
'''
实验：LED 闪烁
'''
from machine import Pin
import time

led = Pin(0, Pin.OUT)

while True:
    led.value(1)    # 点亮
    time.sleep(1)   # 等待 1 秒
    led.value(0)    # 熄灭
    time.sleep(1)   # 等待 1 秒
```

### 5.2.3 使用 toggle() 方法

```python
from machine import Pin
import time

led = Pin(0, Pin.OUT)

while True:
    led.toggle()    # 切换状态
    time.sleep(0.5)
```

---

## 5.3 交通灯模块

### 5.3.1 模块介绍

交通灯模块集成了红、黄、绿三色 LED，模拟真实交通灯。

接口定义：
- R：红灯控制
- Y：黄灯控制
- G：绿灯控制
- GND：公共地

### 5.3.2 接线方式

```
交通灯模块    →    Pico
    R        →    GP14
    Y        →    GP13
    G        →    GP12
   GND       →    GND
   VCC       →    3.3V
```

### 5.3.3 交通灯控制代码

```python
'''
实验：模拟交通灯
'''
import machine
import time

# 定义三色 LED 引脚
led_red = machine.Pin(14, machine.Pin.OUT)
led_yellow = machine.Pin(13, machine.Pin.OUT)
led_green = machine.Pin(12, machine.Pin.OUT)

def all_off():
    """熄灭所有灯"""
    led_red.value(0)
    led_yellow.value(0)
    led_green.value(0)

def traffic_cycle():
    """交通灯循环"""
    # 绿灯亮 5 秒
    all_off()
    led_green.value(1)
    time.sleep(5)
    
    # 黄灯闪烁 3 次
    led_green.value(0)
    for i in range(3):
        led_yellow.value(1)
        time.sleep(0.5)
        led_yellow.value(0)
        time.sleep(0.5)
    
    # 红灯亮 5 秒
    led_red.value(1)
    time.sleep(5)
    led_red.value(0)

# 主循环
while True:
    traffic_cycle()
```

### 5.3.4 进阶：行人过街灯

```python
'''
实验：带行人按钮的交通灯
'''
from machine import Pin
import time

# 车行灯
car_red = Pin(14, Pin.OUT)
car_yellow = Pin(13, Pin.OUT)
car_green = Pin(12, Pin.OUT)

# 行人灯
ped_red = Pin(2, Pin.OUT)
ped_green = Pin(3, Pin.OUT)

# 行人按钮
button = Pin(15, Pin.IN, Pin.PULL_UP)

def pedestrian_crossing():
    """行人过街流程"""
    # 车辆黄灯闪烁
    car_green.value(0)
    for _ in range(3):
        car_yellow.toggle()
        time.sleep(0.5)
    car_yellow.value(0)
    
    # 车辆红灯，行人绿灯
    car_red.value(1)
    ped_red.value(0)
    ped_green.value(1)
    time.sleep(10)  # 行人过街 10 秒
    
    # 行人绿灯闪烁警告
    for _ in range(5):
        ped_green.toggle()
        time.sleep(0.5)
    
    # 恢复车辆通行
    ped_green.value(0)
    ped_red.value(1)
    car_red.value(0)
    car_green.value(1)

# 初始状态
car_green.value(1)
ped_red.value(1)

while True:
    if button.value() == 0:  # 按钮按下
        time.sleep(0.05)     # 防抖
        if button.value() == 0:
            pedestrian_crossing()
    time.sleep(0.1)
```

---

## 5.4 激光模块

### 5.4.1 模块特点

激光模块发射高度聚焦的红色激光束：

- 单色性好：波长约 650nm（红色）
- 方向性强：光束发散角小
- 亮度高：可见距离远

**⚠️ 安全警告**：激光可能损伤视网膜，切勿对眼睛照射！

### 5.4.2 工作原理

激光模块电路与 LED 模块类似，通过三极管驱动激光管：

```python
'''
实验：激光模块控制
接线：激光模块 S 端连接 GP2
'''
from machine import Pin
import time

laser = Pin(2, Pin.OUT)

while True:
    laser.value(1)
    time.sleep(2)
    laser.value(0)
    time.sleep(2)
```

### 5.4.3 激光报警器

```python
'''
实验：激光报警器（激光被遮挡时报警）
激光发射器 → GP2
光敏接收器 → GP26 (ADC)
蜂鸣器    → GP20
'''
from machine import Pin, ADC
import time

laser = Pin(2, Pin.OUT)
light_sensor = ADC(26)
buzzer = Pin(20, Pin.OUT)

# 激光常亮
laser.value(1)

# 获取环境基准值
baseline = light_sensor.read_u16()
threshold = baseline * 0.5  # 阈值为基准的 50%

while True:
    current = light_sensor.read_u16()
    
    if current < threshold:
        # 激光被遮挡，触发报警
        buzzer.value(1)
        print(f"警报！光强下降：{current}")
    else:
        buzzer.value(0)
    
    time.sleep(0.1)
```

---

## 5.5 PWM 调光

### 5.5.1 什么是 PWM

PWM（Pulse Width Modulation）脉冲宽度调制，通过改变高电平占空比来模拟模拟信号。

```
占空比 100%: ████████████████
占空比  75%: ████████████░░░░
占空比  50%: ████████░░░░░░░░
占空比  25%: ████░░░░░░░░░░░░
占空比   0%: ░░░░░░░░░░░░░░░░
```

### 5.5.2 PWM 控制 LED 亮度

```python
'''
实验：PWM 控制 LED 亮度
'''
from machine import Pin, PWM
import time

# 创建 PWM 对象
led_pwm = PWM(Pin(0))

# 设置频率 (1000 Hz)
led_pwm.freq(1000)

# 渐亮渐暗
while True:
    # 渐亮
    for duty in range(0, 65536, 1000):
        led_pwm.duty_u16(duty)
        time.sleep(0.02)
    
    # 渐暗
    for duty in range(65535, 0, -1000):
        led_pwm.duty_u16(duty)
        time.sleep(0.02)
```

### 5.5.3 呼吸灯效果

```python
'''
实验：呼吸灯（正弦波变化）
'''
from machine import Pin, PWM
import time
import math

led = PWM(Pin(0))
led.freq(1000)

while True:
    for i in range(360):
        # 使用正弦函数实现平滑过渡
        brightness = int((math.sin(math.radians(i)) + 1) / 2 * 65535)
        led.duty_u16(brightness)
        time.sleep(0.01)
```

---

## 5.6 多 LED 控制

### 5.6.1 流水灯效果

```python
'''
实验：流水灯
LED 连接：GP0, GP1, GP2, GP3, GP4
'''
from machine import Pin
import time

# 定义 LED 引脚列表
led_pins = [0, 1, 2, 3, 4]
leds = [Pin(p, Pin.OUT) for p in led_pins]

def all_off():
    for led in leds:
        led.value(0)

while True:
    # 正向流水
    for led in leds:
        all_off()
        led.value(1)
        time.sleep(0.2)
    
    # 反向流水
    for led in reversed(leds):
        all_off()
        led.value(1)
        time.sleep(0.2)
```

### 5.6.2 二进制计数器

```python
'''
实验：4 位二进制计数器
'''
from machine import Pin
import time

leds = [Pin(i, Pin.OUT) for i in range(4)]

def display_binary(num):
    """显示二进制数"""
    for i in range(4):
        leds[i].value((num >> i) & 1)

count = 0
while True:
    display_binary(count)
    count = (count + 1) % 16  # 0-15 循环
    time.sleep(0.5)
```

---

## 5.7 代码封装

### 5.7.1 LED 类封装

```python
class LED:
    """LED 控制类"""
    
    def __init__(self, pin_num, pwm=False):
        self.pin_num = pin_num
        self.pwm_mode = pwm
        
        if pwm:
            self.pwm = PWM(Pin(pin_num))
            self.pwm.freq(1000)
            self.brightness = 0
        else:
            self.pin = Pin(pin_num, Pin.OUT)
    
    def on(self):
        if self.pwm_mode:
            self.pwm.duty_u16(65535)
        else:
            self.pin.value(1)
    
    def off(self):
        if self.pwm_mode:
            self.pwm.duty_u16(0)
        else:
            self.pin.value(0)
    
    def toggle(self):
        if not self.pwm_mode:
            self.pin.toggle()
    
    def set_brightness(self, percent):
        """设置亮度百分比 (0-100)"""
        if self.pwm_mode:
            duty = int(percent / 100 * 65535)
            self.pwm.duty_u16(duty)
            self.brightness = percent
    
    def fade_to(self, target_percent, duration=1.0):
        """渐变到目标亮度"""
        if not self.pwm_mode:
            return
        
        steps = 50
        current = self.brightness
        step_size = (target_percent - current) / steps
        step_delay = duration / steps
        
        for _ in range(steps):
            current += step_size
            self.set_brightness(int(current))
            time.sleep(step_delay)

# 使用示例
led = LED(0, pwm=True)
led.set_brightness(50)
led.fade_to(100, duration=2)
```

---

## 5.8 本章小结

本章介绍了数字输出控制的基础知识：

1. LED 模块通过三极管驱动，GPIO 高电平点亮
2. 交通灯模块是三个独立 LED 的组合
3. 激光模块需注意安全使用
4. PWM 可实现 LED 亮度调节和呼吸灯效果
5. 通过类封装可以简化多 LED 控制

下一章将学习按键与触摸传感器的使用。

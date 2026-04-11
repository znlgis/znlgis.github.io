---
layout: default
title: "第22章：LCD 显示模块"
---

# 第22章：LCD 显示模块

> 本章介绍 LCD1602 I2C 显示屏和 128×32 OLED 的驱动方法。

---

## 22.1 LCD1602 I2C 模块

### 22.1.1 模块介绍

LCD1602 I2C 模块包含：
- 16×2 字符液晶屏
- PCF8574 I2C 扩展芯片
- 背光控制
- 对比度电位器

### 22.1.2 I2C 地址

常见地址：
- PCF8574: 0x27
- PCF8574A: 0x3F

### 22.1.3 驱动库

```python
'''
LCD1602 I2C 驱动
'''
from machine import I2C, Pin
import time

class LCD1602_I2C:
    # 指令
    LCD_CLEARDISPLAY = 0x01
    LCD_RETURNHOME = 0x02
    LCD_ENTRYMODESET = 0x04
    LCD_DISPLAYCONTROL = 0x08
    LCD_FUNCTIONSET = 0x20
    LCD_SETDDRAMADDR = 0x80
    
    # 标志位
    LCD_DISPLAYON = 0x04
    LCD_DISPLAYOFF = 0x00
    LCD_CURSORON = 0x02
    LCD_CURSOROFF = 0x00
    LCD_BLINKON = 0x01
    LCD_BLINKOFF = 0x00
    
    # 背光
    LCD_BACKLIGHT = 0x08
    LCD_NOBACKLIGHT = 0x00
    
    # Enable 位
    En = 0x04
    Rw = 0x02
    Rs = 0x01
    
    def __init__(self, i2c, addr=0x27, cols=16, rows=2):
        self.i2c = i2c
        self.addr = addr
        self.cols = cols
        self.rows = rows
        self.backlight_state = self.LCD_BACKLIGHT
        self._init_display()
    
    def _write_byte(self, data):
        self.i2c.writeto(self.addr, bytes([data | self.backlight_state]))
    
    def _pulse_enable(self, data):
        self._write_byte(data | self.En)
        time.sleep_us(1)
        self._write_byte(data & ~self.En)
        time.sleep_us(50)
    
    def _send_nibble(self, data):
        self._write_byte(data)
        self._pulse_enable(data)
    
    def _send_byte(self, data, mode=0):
        high = (data & 0xF0) | mode
        low = ((data << 4) & 0xF0) | mode
        self._send_nibble(high)
        self._send_nibble(low)
    
    def _init_display(self):
        time.sleep_ms(50)
        
        # 初始化序列
        for _ in range(3):
            self._send_nibble(0x30)
            time.sleep_ms(5)
        
        self._send_nibble(0x20)
        
        # 4位模式，2行，5x8字体
        self._send_byte(0x28)
        # 显示开，光标关，闪烁关
        self._send_byte(0x0C)
        # 清屏
        self.clear()
        # 输入模式
        self._send_byte(0x06)
    
    def clear(self):
        self._send_byte(self.LCD_CLEARDISPLAY)
        time.sleep_ms(2)
    
    def home(self):
        self._send_byte(self.LCD_RETURNHOME)
        time.sleep_ms(2)
    
    def set_cursor(self, col, row):
        offsets = [0x00, 0x40]
        self._send_byte(self.LCD_SETDDRAMADDR | (col + offsets[row]))
    
    def print(self, text):
        for char in text:
            self._send_byte(ord(char), self.Rs)
    
    def backlight(self, on=True):
        self.backlight_state = self.LCD_BACKLIGHT if on else self.LCD_NOBACKLIGHT
        self._write_byte(0)

# 使用示例
i2c = I2C(0, sda=Pin(20), scl=Pin(21), freq=400000)
lcd = LCD1602_I2C(i2c, addr=0x27)

lcd.clear()
lcd.set_cursor(0, 0)
lcd.print("Hello World!")
lcd.set_cursor(0, 1)
lcd.print("Raspberry Pico")
```

### 22.1.4 传感器数据显示

```python
'''
实验：LCD 显示传感器数据
'''
from machine import ADC

temp_sensor = ADC(4)

def read_temperature():
    raw = temp_sensor.read_u16()
    voltage = raw * 3.3 / 65535
    return 27 - (voltage - 0.706) / 0.001721

lcd.clear()

while True:
    temp = read_temperature()
    
    lcd.set_cursor(0, 0)
    lcd.print(f"Temperature:")
    lcd.set_cursor(0, 1)
    lcd.print(f"{temp:.1f} C       ")
    
    time.sleep(1)
```

---

## 22.2 128×32 OLED 显示屏

### 22.2.1 模块介绍

128×32 OLED 模块特点：
- I2C 接口
- SSD1306 驱动芯片
- 自发光，无需背光
- 广视角

### 22.2.2 I2C 地址

默认地址：0x3C

### 22.2.3 SSD1306 驱动

```python
'''
SSD1306 OLED 驱动
'''
from machine import I2C, Pin
import framebuf

class SSD1306_I2C:
    def __init__(self, width, height, i2c, addr=0x3C):
        self.width = width
        self.height = height
        self.i2c = i2c
        self.addr = addr
        self.buffer = bytearray(width * height // 8)
        self.fb = framebuf.FrameBuffer(self.buffer, width, height, framebuf.MONO_VLSB)
        self._init_display()
    
    def _write_cmd(self, cmd):
        self.i2c.writeto(self.addr, bytes([0x00, cmd]))
    
    def _init_display(self):
        cmds = [
            0xAE,       # 关闭显示
            0xD5, 0x80, # 设置时钟
            0xA8, self.height - 1,  # 设置 MUX
            0xD3, 0x00, # 设置偏移
            0x40,       # 起始行
            0x8D, 0x14, # 启用电荷泵
            0x20, 0x00, # 水平寻址模式
            0xA1,       # 段重映射
            0xC8,       # COM 扫描方向
            0xDA, 0x02, # COM 配置
            0x81, 0x8F, # 对比度
            0xD9, 0xF1, # 预充电周期
            0xDB, 0x40, # VCOMH
            0xA4,       # 使用 RAM
            0xA6,       # 正常显示
            0xAF,       # 开启显示
        ]
        for cmd in cmds:
            self._write_cmd(cmd)
    
    def show(self):
        self._write_cmd(0x21)
        self._write_cmd(0)
        self._write_cmd(self.width - 1)
        self._write_cmd(0x22)
        self._write_cmd(0)
        self._write_cmd(self.height // 8 - 1)
        self.i2c.writeto(self.addr, bytes([0x40]) + self.buffer)
    
    def fill(self, color):
        self.fb.fill(color)
    
    def pixel(self, x, y, color):
        self.fb.pixel(x, y, color)
    
    def text(self, string, x, y, color=1):
        self.fb.text(string, x, y, color)
    
    def rect(self, x, y, w, h, color):
        self.fb.rect(x, y, w, h, color)
    
    def fill_rect(self, x, y, w, h, color):
        self.fb.fill_rect(x, y, w, h, color)
    
    def line(self, x1, y1, x2, y2, color):
        self.fb.line(x1, y1, x2, y2, color)

# 使用
i2c = I2C(0, sda=Pin(20), scl=Pin(21))
oled = SSD1306_I2C(128, 32, i2c)

oled.fill(0)
oled.text("Pico OLED", 0, 0)
oled.text("128 x 32", 0, 12)
oled.show()
```

### 22.2.4 图形绘制

```python
'''
实验：OLED 图形绘制
'''
# 绘制各种图形
oled.fill(0)

# 矩形
oled.rect(0, 0, 30, 15, 1)

# 填充矩形
oled.fill_rect(35, 0, 30, 15, 1)

# 线条
oled.line(0, 20, 127, 20, 1)

# 文字
oled.text("Graphics", 70, 5)

oled.show()
```

### 22.2.5 实时数据显示

```python
'''
实验：OLED 多传感器显示
'''
import time
from machine import ADC

temp_adc = ADC(4)
light_adc = ADC(26)

def draw_dashboard():
    oled.fill(0)
    
    # 标题
    oled.text("Dashboard", 30, 0)
    oled.line(0, 10, 127, 10, 1)
    
    # 温度
    raw = temp_adc.read_u16()
    voltage = raw * 3.3 / 65535
    temp = 27 - (voltage - 0.706) / 0.001721
    oled.text(f"Temp: {temp:.1f}C", 0, 15)
    
    # 光照
    light = light_adc.read_u16()
    light_pct = 100 - (light / 65535 * 100)
    oled.text(f"Light: {light_pct:.0f}%", 0, 25)
    
    oled.show()

while True:
    draw_dashboard()
    time.sleep(0.5)
```

---

## 22.3 自定义字符

### 22.3.1 LCD1602 自定义字符

```python
'''
实验：LCD 自定义字符
'''
# 自定义心形字符
heart = [
    0b00000,
    0b01010,
    0b11111,
    0b11111,
    0b01110,
    0b00100,
    0b00000,
    0b00000
]

def create_char(lcd, location, pattern):
    """创建自定义字符"""
    lcd._send_byte(0x40 | (location << 3))
    for row in pattern:
        lcd._send_byte(row, lcd.Rs)

# 创建字符（位置 0-7）
create_char(lcd, 0, heart)

# 显示自定义字符
lcd.clear()
lcd.print("I ")
lcd._send_byte(0, lcd.Rs)  # 显示位置 0 的字符
lcd.print(" Pico")
```

---

## 22.4 本章小结

本章介绍了 LCD 显示模块：

1. **LCD1602 I2C**：
   - PCF8574 扩展芯片
   - 字符显示
   - 自定义字符

2. **SSD1306 OLED**：
   - 128×32 分辨率
   - FrameBuffer 绘图
   - 图形和文字

下一章将学习舵机与电机控制。

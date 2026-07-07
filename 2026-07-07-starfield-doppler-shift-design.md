# 星空粒子蓝移/红移效果 — 设计文档

**日期**: 2026-07-07
**状态**: 设计确认

---

## 概述

在 Three.js 中实现太空飞行场景，星空粒子根据相对摄像机的运动方向呈现蓝移（靠近）和红移（远离）的颜色偏移效果。以物理原理为参考，视觉表现为优先。

## 技术选型

- **引擎**: Three.js (Web)
- **渲染方式**: 自定义 ShaderMaterial，顶点着色器逐粒子计算
- **粒子规模**: 10k ~ 100k

## 架构

```
┌─────────────────────────────────────────────────┐
│                  Three.js Scene                   │
│                                                   │
│  ┌─────────────┐    ┌──────────────────────────┐ │
│  │   Camera     │    │   ParticleSystem         │ │
│  │  (向前飞行)   │    │   ShaderMaterial         │ │
│  │             │    │                          │ │
│  │  velocity ──┼────┤ uniform: uCameraVelocity  │ │
│  │  position  ─┼────┤ uniform: uCameraPosition  │ │
│  └─────────────┘    │                          │ │
│                      │ per-particle:            │ │
│                      │  position, velocity,     │ │
│                      │  baseColor, size         │ │
│                      └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `StarfieldSystem` | 粒子 BufferGeometry + ShaderMaterial 管理，粒子初始化与回收 |
| `FlightController` | 摄像机飞行控制（自动巡航/鼠标/键盘），提供速度与位置 |
| Shader uniforms | `uCameraVelocity`, `uCameraPosition`, `uMaxShiftSpeed`, `uShiftIntensity` |

## 颜色偏移算法

### 径向速度计算（Vertex Shader）

```
v_radial = dot(-uCameraVelocity, normalize(particlePos - uCameraPosition))
```

- v_radial < 0：相机飞向粒子 → 蓝移
- v_radial > 0：相机远离粒子 → 红移
- v_radial ≈ 0：粒子在侧面 → 颜色不变

### 色温映射（视觉优先）

shiftFactor = clamp(v_radial / maxShiftSpeed, -1, 1)，经 smoothstep 平滑后映射到 RGB：

| shiftFactor | 色温 | RGB | 说明 |
|-------------|------|-----|------|
| -1.0 | 冰蓝 | (0.6, 0.7, 1.0) | 强烈蓝移 |
| -0.5 | 淡蓝 | (0.8, 0.85, 1.0) | 轻微蓝移 |
| 0.0 | 暖白 | (1.0, 0.95, 0.9) | 静止星光 |
| +0.5 | 淡橙 | (1.0, 0.8, 0.6) | 轻微红移 |
| +1.0 | 深红 | (1.0, 0.4, 0.3) | 强烈红移 |

### 附加效果

- 蓝移端亮度略微提升（模拟能量增强）
- 红移端亮度略微降低（模拟能量减弱）
- smoothstep 过渡使中间静止色区域更宽

## 星空粒子系统

### 空间分布

- 粒子以摄像机为中心，球形分布
- 多层球壳嵌套（近/中/远），不同密度和亮度
- 半径约 200 单位

### BufferGeometry 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `position` | vec3 | 粒子世界坐标 |
| `baseColor` | vec3 | 静止时的星光颜色 |
| `size` | float | 粒子基础大小 |

### 粒子回收

- 每帧检查粒子是否在摄像机后方超过阈值
- 回收粒子在摄像机前方远处重新生成

### 可调参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `particleCount` | 30000 | 总粒子数 |
| `sphereRadius` | 200 | 分布球壳半径 |
| `maxShiftSpeed` | 50 | 达到满偏移所需速度 |
| `colorShiftIntensity` | 1.0 | 效果强度 |

## 摄像机飞行控制

### 控制模式

| 模式 | 操作 | 说明 |
|------|------|------|
| 自动巡航 | 无 | 恒定速度向前，默认模式 |
| 鼠标控制 | 移动=方向, 滚轮=速度 | 适合交互演示 |
| 键盘控制 | WASD+QE, 空格加速 | 精确控制 |

### 速度设计

- `cruiseSpeed`：基准巡航速度
- `maxSpeed`：满偏移速度
- 速度范围 0 ~ maxSpeed

## Fragment Shader 细节

- 粒子渲染为圆形光点（径向渐变，中心白→边缘透明）
- 叠加光晕（glow），增强体积感

## 文件结构

```
starfield-demo/
├── index.html
├── src/
│   ├── main.js
│   ├── StarfieldSystem.js
│   ├── FlightController.js
│   └── shaders/
│       ├── star.vert
│       └── star.frag
└── style.css
```

## 边界处理

- 粒子总数恒定，回收逻辑保证无泄漏
- 速度 clamp 防止颜色溢出
- 帧率下降时优先降粒子数
- 初始帧即完整显示星空

---

## Spec 自检

- [x] 无占位符/TODO
- [x] 各部分一致无矛盾
- [x] 范围适合单次实现
- [x] 无歧义表述

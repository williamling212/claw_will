---
title: 火箭回收制导算法：原理与可视化
---

# 火箭回收制导算法：原理与可视化

> SpaceX Falcon 9 着陆腿展开、发动机点火、精准降落——这背后的制导算法是什么？本文从一个简化的二维模型出发，推导多项式制导的核心公式，并提供可交互的动画演示。

<ClientOnly>
  <RocketCanvas />
</ClientOnly>

---

## 模型简化

为了便于理解与可视化，将三维问题简化为**二维平面**内的控制问题：

- **状态量**：位置 (x, y)、速度 (vx, vy)、姿态角 θ（相对竖直的倾斜角）、角速度 ω
- **控制量**：推力大小 F（有最小 / 最大节流限制）+ 矢量喷管偏转方向
- **目标**：从任意初始状态出发，以接近零的速度落在 x = 0 处

本演示忽略质量变化（无燃料消耗）、空气阻力与弹性腿缓冲。

---

## 运动方程

质心平动（牛顿第二定律）：

```
ax = Fx / m =  F · sin(θ) / m
ay = Fy / m =  F · cos(θ) / m  −  g
```

绕质心转动（姿态动力学）：

```
θ̈ = τ / I
```

其中 τ 是矢量喷管产生的力矩，I 是转动惯量。
在演示中，姿态控制通过 PD 控制器实现，令 θ 跟踪制导算法计算出的期望推力方向。

---

## Plan B：多项式制导

### 核心思想

给定**飞行时间 Tf**，用**三次多项式**拟合从当前状态到着陆点的轨迹，解析地确定每一时刻所需推力。

对 x 轴和 y 轴分别建立边值问题：

```
p(t) = p₀ + v₀·t + c₂·t² + c₃·t³

边界条件（四个，唯一确定 c₂, c₃）：
  p(0)  = p₀        （初始位置）
  ṗ(0)  = v₀        （初始速度）
  p(Tf) = 0         （落在着陆点）
  ṗ(Tf) = v_land    （软着陆速度，≈ −1 m/s）
```

### 系数解析解

代入边界条件，直接求解：

```
c₃ = [ 2(p₀ − pf) + (v₀ + vf)·Tf ] / Tf³

c₂ = [ vf − v₀ − 3·c₃·Tf² ] / (2·Tf)
```

### 反解推力

轨迹确定后，对多项式求二阶导数得到所需加速度，再补偿重力得到推力：

```
水平方向：ax(t) = Fx/m  =  2c₂ˣ + 6c₃ˣ·t
竖向方向（注意补偿重力）：
  Fy/m = (2c₂ʸ + 6c₃ʸ·t) + g

推力大小：|F|/m = √( ax² + (Fy/m)² )
推力方向：α(t) = atan2( ax,  Fy/m )   （与竖直方向夹角）
```

### 最优飞行时间 Tf

这是算法的关键——Tf 不是固定值，而是通过**二分搜索**找到满足推力约束的最小值：

```
找最小 Tf，使得：
  max_{t ∈ [0,Tf]}  |F(t)|/m  ≤  F_max
```

- **Tf 过短**：所需推力超过发动机上限，不可行
- **Tf 过长**：浪费燃料，且轨迹末段可能穿入地面
- **最优 Tf**：恰好在约束边界上的最小可行值

拖动演示中的「最大推力加速度」滑块，观察 Tf 如何随约束变化，以及推力曲线图（左下角）的形态变化。

### 为什么规划轨迹（青虚线）与实际轨迹（白实线）有偏差？

演示中，多项式制导在出发时**一次性计算**整条轨迹（开环）。当火箭实际姿态与计划推力方向存在偏差时（姿态调整需要时间），实际轨迹会偏离规划轨迹。这正是真实制导系统需要**闭环修正**的原因。

### 多项式制导的局限

1. **开环**：不根据实际偏差重新规划
2. **无最小推力约束**：发动机有最低节流限制，多项式解无法保证 |F| ≥ F_min
3. **次优燃料消耗**：非燃料最优轨迹

这些问题直接导向了 G-FOLD 算法。

---

## Plan C：G-FOLD（接口预留）

**G-FOLD**（Fuel-Optimal Large Diversion Guidance）由 JPL 的 Açıkmeşe 与 Ploen 于 2007 年提出，是目前最成熟的行星着陆燃料最优制导算法。

### 为什么原始问题是非凸的？

加入最小推力约束后，可行域变为非凸集合：

```
F_min ≤ ‖F(t)‖ ≤ F_max
```

`‖F‖ ≤ F_max` 定义一个凸集（球），但 `‖F‖ ≥ F_min` 定义的是球的**补集**——非凸。

### 无损凸化（Lossless Convexification）

G-FOLD 的核心贡献：引入松弛变量 σ(t)，将约束改写为：

```
‖F(t)‖ ≤ σ(t)
F_min ≤ σ(t) ≤ T_max
目标：最小化 ∫σ(t) dt
```

**关键定理**：松弛问题的最优解必然满足 σ*(t) = ‖F*(t)‖。
即松弛**无损**——两个问题的最优解完全等价。

松弛后的问题是**二阶锥规划（SOCP）**，属于凸优化，可在机载计算机上以约 0.1–1 秒的速度求解。

### 代码接口

Plan C 的接口已在 `docs/.vitepress/theme/rocket/planC.js` 中预留，与 Plan B 保持相同的调用签名，待集成 SOCP 求解器后可直接替换。

```js
// planC.js 中的存根
export function gfoldGuidance(state, Fmin_m, Fmax_m, g) {
  // TODO: 实现 SOCP 求解器
  throw new Error('G-FOLD not yet implemented')
}
```

---

## SpaceX 工程现实

Falcon 9 的着陆燃烧实际分为三个阶段：

| 阶段 | 目的 | 特点 |
|------|------|------|
| Boostback burn | 折返至发射场上方 | 惯性制导，大推力短时燃烧 |
| Entry burn | 减速进入稠密大气 | 三台发动机，热防护 |
| Landing burn | 精准软着陆 | 单台发动机，制导精度要求最高 |

**传感器融合**：GPS（绝对位置）+ IMU（加速度 / 姿态）+ 雷达高度计（近地精确高度）+ 光学导引（最终对准）。

实际制导算法为 PEG（Powered Explicit Guidance，Apollo 时代算法的现代变体）与 G-FOLD 思想的工程融合，具体实现为 SpaceX 保密内容。

---

## 参考文献

1. Açıkmeşe, B. & Ploen, S. (2007). *Convex Programming Approach to Powered Descent Guidance*. AIAA GNC Conference, AIAA-2007-6558.
2. Blackmore, L., Açıkmeşe, B. & Scharf, D. P. (2010). *Minimum-Landing-Error Powered-Descent Guidance for Mars Landing Using Convex Optimization*. JGCD 33(4).
3. Szmuk, M. & Açıkmeşe, B. (2018). *Successive Convexification for 6-DOF Mars Rocket Powered Landing*. AIAA SciTech.

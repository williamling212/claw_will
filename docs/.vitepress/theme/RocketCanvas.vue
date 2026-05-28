<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { buildPlan, evalPlan, findOptimalTf, samplePlan } from './rocket/planB.js'

// Parameters (user-controlled)
const params = reactive({
  initH:    600,
  initX:    300,
  initVx:   -20,
  initVy:   -30,
  initTilt:  0.2,
  maxAccel:  15,
  gravity:   9.8,
})

// Sim state
const canvas      = ref(null)
const isRunning   = ref(false)
const isFinished  = ref(false)
const failMsg     = ref('')
const simTf       = ref(0)

let plan       = null
let plannedPts = []
let state      = null
let simTime    = 0
let actualPath = []
let animId     = null
let lastTs     = 0

const DT = 0.05

function reset() {
  stop()
  const s0 = { x: params.initX, y: params.initH, vx: params.initVx, vy: params.initVy }
  const Tf  = findOptimalTf(s0, params.maxAccel, params.gravity)
  simTf.value  = Tf
  plan         = buildPlan(s0, Tf, params.gravity)
  plannedPts   = samplePlan(plan, 200)
  state        = { ...s0, theta: params.initTilt, omega: 0 }
  simTime      = 0
  actualPath   = [{ x: s0.x, y: s0.y }]
  isFinished.value = false
  failMsg.value    = ''
  draw()
}

function step() {
  if (!state || isFinished.value) return
  const s = state
  const g = params.gravity
  if (simTime >= plan.Tf) { finish(false); return }

  const ref_ = evalPlan(plan, simTime)

  // Attitude PD: track required thrust direction
  const thetaErr = ref_.angle - s.theta
  const alpha    = Math.max(-3, Math.min(3, 8 * thetaErr - 4 * s.omega))

  const F  = ref_.F_m
  const ax =  F * Math.sin(s.theta)
  const ay =  F * Math.cos(s.theta) - g

  s.x     += s.vx    * DT
  s.y     += s.vy    * DT
  s.vx    += ax      * DT
  s.vy    += ay      * DT
  s.theta += s.omega * DT
  s.omega += alpha   * DT
  simTime += DT

  actualPath.push({ x: s.x, y: s.y })

  if (s.y <= 0) {
    s.y = 0
    const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy)
    if (spd > 5)              finish(true, '撞击速度过快 ' + spd.toFixed(1) + ' m/s')
    else if (Math.abs(s.x) > 25) finish(true, '偏离着陆台 ' + s.x.toFixed(0) + ' m')
    else                      finish(false)
  }
}

function finish(failed, msg) {
  isFinished.value = true
  failMsg.value    = failed ? msg : ''
  stop(); draw()
}

function animate(ts) {
  if (!isRunning.value) return
  const elapsed = ts - lastTs
  if (elapsed >= 16) {
    const steps = Math.ceil(elapsed / (DT * 1000))
    for (let i = 0; i < steps && !isFinished.value; i++) step()
    draw()
    lastTs = ts
  }
  if (!isFinished.value) animId = requestAnimationFrame(animate)
}

function play() {
  if (isFinished.value) reset()
  isRunning.value = true
  lastTs = performance.now()
  animId = requestAnimationFrame(animate)
}

function stop() {
  isRunning.value = false
  if (animId) { cancelAnimationFrame(animId); animId = null }
}

function draw() {
  if (!canvas.value || !state) return
  const cv  = canvas.value
  const ctx = cv.getContext('2d')
  const W   = cv.width
  const H   = cv.height

  const hSpan = Math.max(1200, Math.abs(params.initX) * 3)
  const vSpan = Math.max(700,  params.initH * 1.35)
  const scl   = Math.min((W - 40) / hSpan, (H - 50) / vSpan)
  const gndY  = H - 38

  function wtc(wx, wy) {
    return { cx: W / 2 + wx * scl, cy: gndY - wy * scl }
  }

  // Background
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 0.5
  const gs = 100
  for (let gx = Math.floor(-hSpan / 2 / gs) * gs; gx <= hSpan / 2; gx += gs) {
    const { cx } = wtc(gx, 0)
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
  }
  for (let gy = 0; gy <= vSpan; gy += gs) {
    const { cy } = wtc(0, gy)
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()
  }

  // Ground
  ctx.strokeStyle = '#3a3a3a'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, gndY); ctx.lineTo(W, gndY); ctx.stroke()

  // Landing pad
  const padW = 50 * scl
  const { cx: px } = wtc(0, 0)
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(px - padW / 2, gndY); ctx.lineTo(px + padW / 2, gndY); ctx.stroke()
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(px - 7, gndY - 9); ctx.lineTo(px, gndY); ctx.lineTo(px + 7, gndY - 9)
  ctx.stroke()

  // Planned trajectory (dashed cyan)
  if (plannedPts.length > 1) {
    ctx.strokeStyle = 'rgba(0,212,255,0.45)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 7])
    ctx.beginPath()
    plannedPts.forEach((p, i) => {
      const { cx, cy } = wtc(p.x, p.y)
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Actual trajectory (solid white)
  if (actualPath.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    actualPath.forEach((p, i) => {
      const { cx, cy } = wtc(p.x, p.y)
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
    })
    ctx.stroke()
  }

  // Rocket
  const { cx: rx, cy: ry } = wtc(state.x, state.y)
  const rW = 9, rH = 34
  ctx.save()
  ctx.translate(rx, ry)
  ctx.rotate(state.theta)
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1.5
  ctx.strokeRect(-rW / 2, -rH, rW, rH)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-rW / 2 - 4, 0); ctx.lineTo(0, 9); ctx.lineTo(rW / 2 + 4, 0)
  ctx.stroke()

  // Engine exhaust
  const ref_ = evalPlan(plan, Math.min(simTime, plan.Tf))
  if (!isFinished.value && ref_.F_m > 0.5) {
    const len = Math.min(55, ref_.F_m * 2.2)
    ctx.strokeStyle = 'rgba(255,210,140,0.9)'
    ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, 9 + len); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,180,80,0.45)'
    ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(-2, 9); ctx.lineTo(-7, 9 + len * 0.72); ctx.stroke()
    ctx.beginPath(); ctx.moveTo( 2, 9); ctx.lineTo( 7, 9 + len * 0.72); ctx.stroke()
  }
  ctx.restore()

  // Thrust profile mini-chart (bottom-left)
  const cX = 16, cY = H - 10, cW = 190, cH = 58
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(cX, cY - cH, cW, cH)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 0.5
  ctx.strokeRect(cX, cY - cH, cW, cH)

  const fMax   = params.maxAccel
  const fmaxCy = cY - cH + 8
  ctx.strokeStyle = 'rgba(255,80,80,0.5)'
  ctx.lineWidth = 0.5
  ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(cX, fmaxCy); ctx.lineTo(cX + cW, fmaxCy); ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = 'rgba(0,212,255,0.7)'
  ctx.lineWidth = 1
  ctx.beginPath()
  plannedPts.forEach((p, i) => {
    const px_ = cX + (i / (plannedPts.length - 1)) * cW
    const py_ = cY - Math.min(cH - 4, (p.F_m / (fMax * 1.4)) * (cH - 10))
    i === 0 ? ctx.moveTo(px_, py_) : ctx.lineTo(px_, py_)
  })
  ctx.stroke()

  const tFrac = Math.min(simTime / plan.Tf, 1)
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cX + tFrac * cW, cY - cH)
  ctx.lineTo(cX + tFrac * cW, cY)
  ctx.stroke()

  ctx.font = '10px monospace'
  ctx.fillStyle = '#444'
  ctx.textAlign = 'left'
  ctx.fillText('THRUST  F/m (m/s²)', cX + 2, cY - cH - 3)
  ctx.fillStyle = '#ff5050'
  ctx.fillText('F_max=' + fMax, cX + cW - 58, fmaxCy - 3)

  // Telemetry (top-right)
  ctx.font = '12px "JetBrains Mono", "Fira Code", monospace'
  ctx.fillStyle = '#00e87a'
  ctx.textAlign = 'right'
  const tx = W - 14
  let ty = 22
  const lh = 17
  const spd  = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
  const tRem = Math.max(0, plan.Tf - simTime)
  ctx.fillText('ALT  ' + Math.max(0, state.y).toFixed(0).padStart(6) + ' m', tx, ty); ty += lh
  ctx.fillText('SPD  ' + spd.toFixed(1).padStart(7) + ' m/s', tx, ty); ty += lh
  ctx.fillText('HRZ  ' + state.x.toFixed(0).padStart(6) + ' m', tx, ty); ty += lh
  ctx.fillText('ATT  ' + (state.theta * 180 / Math.PI).toFixed(1).padStart(6) + '°', tx, ty); ty += lh
  ctx.fillText('T-   ' + tRem.toFixed(1).padStart(7) + ' s', tx, ty); ty += lh
  ctx.fillStyle = '#00d4ff'
  ctx.fillText('Tf   ' + plan.Tf.toFixed(1).padStart(7) + ' s', tx, ty)

  // Status overlay
  if (isFinished.value) {
    ctx.textAlign = 'center'
    if (failMsg.value) {
      ctx.fillStyle = 'rgba(255,60,60,0.9)'
      ctx.font = 'bold 15px monospace'
      ctx.fillText('▲ LANDING FAILED', W / 2, H / 2 - 10)
      ctx.font = '12px monospace'
      ctx.fillText(failMsg.value, W / 2, H / 2 + 12)
    } else {
      ctx.fillStyle = 'rgba(0,232,122,0.9)'
      ctx.font = 'bold 15px monospace'
      ctx.fillText('✓ LANDING NOMINAL', W / 2, H / 2 - 10)
    }
  }
}

onMounted(() => { reset(); draw() })
onUnmounted(() => stop())
watch(params, () => { if (!isRunning.value) reset() }, { deep: true })
</script>

<template>
  <div class="rl-wrap">
    <canvas ref="canvas" width="800" height="480" class="rl-canvas" />
    <div class="rl-controls">
      <div class="rl-btns">
        <button v-if="!isRunning" class="btn-run"   @click="play">&#9654; &#36816;&#34892;</button>
        <button v-else             class="btn-pause" @click="stop">&#9646;&#9646; &#26242;&#20241;</button>
        <button                    class="btn-reset" @click="reset">&#8635; &#37325;&#32622;</button>
        <span class="algo-tag">Plan B &middot; &#22810;&#39033;&#24335;&#21046;&#23548;</span>
      </div>
      <div class="rl-sliders">
        <label>&#21021;&#22987;&#39640;&#24230;<span>{{ params.initH }} m</span>
          <input type="range" v-model.number="params.initH"    min="200" max="1500" step="50" /></label>
        <label>&#27700;&#24179;&#20559;&#31227;<span>{{ params.initX }} m</span>
          <input type="range" v-model.number="params.initX"    min="-600" max="600" step="25" /></label>
        <label>&#21021;&#22987;&#26800;&#21521;&#36895;&#24230;<span>{{ params.initVx }} m/s</span>
          <input type="range" v-model.number="params.initVx"   min="-80" max="80" step="5" /></label>
        <label>&#21021;&#22987;&#31435;&#21521;&#36895;&#24230;<span>{{ params.initVy }} m/s</span>
          <input type="range" v-model.number="params.initVy"   min="-100" max="0" step="5" /></label>
        <label>&#21021;&#22987;&#20542;&#26012;&#35282;<span>{{ (params.initTilt * 180 / Math.PI).toFixed(0) }}&deg;</span>
          <input type="range" v-model.number="params.initTilt" min="-0.5" max="0.5" step="0.05" /></label>
        <label>&#26368;&#22823;&#25512;&#21147;&#21152;&#36895;&#24230;<span>{{ params.maxAccel }} m/s&sup2;</span>
          <input type="range" v-model.number="params.maxAccel" min="10" max="40" step="1" /></label>
        <label>&#37325;&#21147;&#21152;&#36895;&#24230;<span>{{ params.gravity }} m/s&sup2;</span>
          <input type="range" v-model.number="params.gravity"  min="1.6" max="24.8" step="0.2" /></label>
      </div>
      <div class="rl-info">
        <span>&#26368;&#20248;&#39069;&#39154;&#26102;&#38388; <em>T<sub>f</sub></em> = <strong>{{ simTf.toFixed(1) }} s</strong></span>
        <span class="legend">&#38738;&#34382;&#32447; = &#35268;&#21010;&#36335;&#24452;&nbsp;|&nbsp;&#30333;&#23454;&#32447; = &#23454;&#38469;&#36335;&#24452;</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rl-wrap {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  background: #0a0a0a;
  border: 1px solid #1e1e1e;
  border-radius: 6px;
  padding: 14px;
  margin: 28px 0;
}
.rl-canvas { width: 100%; height: auto; display: block; border-radius: 3px; }
.rl-controls { margin-top: 12px; }
.rl-btns { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
button {
  padding: 5px 14px;
  border: 1px solid #444;
  background: transparent;
  color: #ccc;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  border-radius: 3px;
  transition: border-color 0.15s, color 0.15s;
}
.btn-run   { border-color: #00d4ff; color: #00d4ff; }
.btn-pause { border-color: #ffa040; color: #ffa040; }
button:hover { border-color: #e0e0e0; color: #e0e0e0; }
.algo-tag { font-size: 11px; color: #444; margin-left: 6px; }
.rl-sliders { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 24px; }
label { display: flex; flex-direction: column; font-size: 11px; color: #666; gap: 3px; }
label span { color: #00e87a; font-size: 11px; }
input[type="range"] { width: 100%; accent-color: #00d4ff; cursor: pointer; }
.rl-info { margin-top: 10px; font-size: 12px; color: #888; }
.rl-info strong { color: #00d4ff; }
.rl-info em { font-style: normal; }
.legend { margin-left: 20px; color: #444; }
</style>

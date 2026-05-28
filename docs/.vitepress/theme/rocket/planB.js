/**
 * Plan B: Polynomial Guidance
 *
 * Fits cubic polynomial trajectories for both horizontal and vertical axes
 * connecting the initial state to the landing target.
 *
 * Given flight time Tf, position polynomial:
 *   p(t) = p0 + v0*t + c2*t^2 + c3*t^3
 * BC: p(Tf)=pf, p'(Tf)=vf — solved analytically.
 *
 * Required thrust = second derivative of polynomial + gravity compensation.
 * Optimal Tf found by binary search: min Tf s.t. max thrust <= Fmax.
 */

function polyCoeffs(p0, v0, pf, vf, Tf) {
  const T = Tf
  const c3 = (2 * (p0 - pf) + (v0 + vf) * T) / (T * T * T)
  const c2 = (vf - v0 - 3 * c3 * T * T) / (2 * T)
  return { c2, c3 }
}

export function buildPlan(state, Tf, g = 9.8) {
  const { x, y, vx, vy } = state
  const xC = polyCoeffs(x, vx, 0, 0, Tf)
  const yC = polyCoeffs(y, vy, 0, -1, Tf)  // soft-land at vy = -1 m/s
  return { xC, yC, x0: x, y0: y, vx0: vx, vy0: vy, Tf, g }
}

export function evalPlan(plan, t) {
  const { xC, yC, x0, y0, vx0, vy0, g } = plan
  const tau = Math.min(Math.max(t, 0), plan.Tf)

  const x  = x0  + vx0 * tau + xC.c2 * tau * tau + xC.c3 * tau * tau * tau
  const y  = y0  + vy0 * tau + yC.c2 * tau * tau + yC.c3 * tau * tau * tau
  const vx = vx0 + 2 * xC.c2 * tau + 3 * xC.c3 * tau * tau
  const vy = vy0 + 2 * yC.c2 * tau + 3 * yC.c3 * tau * tau

  const ax       = 2 * xC.c2 + 6 * xC.c3 * tau       // Fx/m (net)
  const ay_poly  = 2 * yC.c2 + 6 * yC.c3 * tau       // d^2y/dt^2

  // Required thrust: Fy/m = ay_poly + g  (EOM: Fy/m - g = ay_poly)
  const Fx_m = ax
  const Fy_m = ay_poly + g
  const F_m  = Math.sqrt(Fx_m * Fx_m + Fy_m * Fy_m)
  const angle = Math.atan2(Fx_m, Fy_m)  // thrust direction from vertical

  return { x, y, vx, vy, Fx_m, Fy_m, F_m, angle }
}

function peakThrust(plan, N = 80) {
  let max = 0
  for (let i = 0; i <= N; i++) {
    const f = evalPlan(plan, (i / N) * plan.Tf).F_m
    if (f > max) max = f
  }
  return max
}

export function findOptimalTf(state, Fmax_m, g, tMin = 5, tMax = 300) {
  if (peakThrust(buildPlan(state, tMax, g)) > Fmax_m) return tMax

  let lo = tMin, hi = tMax
  for (let i = 0; i < 52; i++) {
    const mid = (lo + hi) / 2
    if (peakThrust(buildPlan(state, mid, g)) <= Fmax_m) hi = mid
    else lo = mid
  }
  return hi
}

export function samplePlan(plan, N = 200) {
  return Array.from({ length: N + 1 }, (_, i) => evalPlan(plan, (i / N) * plan.Tf))
}

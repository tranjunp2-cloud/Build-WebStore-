// Toán vector / quaternion tối giản (không phụ thuộc three.js) – quaternion dạng [x, y, z, w]
export type V3 = [number, number, number];
export type Q = [number, number, number, number];

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.sqrt(dot(a, a));
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const qIdentity = (): Q => [0, 0, 0, 1];
export function qMul(a: Q, b: Q): Q {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}
export const qX = (a: number): Q => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
export const qY = (a: number): Q => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
export const qZ = (a: number): Q => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
/** Ry * Rx * Rz (áp dụng Z trước, rồi X, rồi Y) */
export const qYXZ = (y: number, x: number, z: number): Q => qMul(qMul(qY(y), qX(x)), qZ(z));
export const qConj = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]];
export function qRotate(q: Q, v: V3): V3 {
  const u: V3 = [q[0], q[1], q[2]], s = q[3];
  const t = mul(cross(u, v), 2);
  return add(add(v, mul(t, s)), cross(u, t));
}
/** quaternion xoay ngắn nhất từ vector đơn vị a sang b */
export function qFromUnit(a: V3, b: V3): Q {
  const d = dot(a, b);
  if (d < -0.999999) {
    let ax = cross([1, 0, 0], a);
    if (len(ax) < 1e-6) ax = cross([0, 0, 1], a);
    ax = norm(ax);
    return [ax[0], ax[1], ax[2], 0];
  }
  const c = cross(a, b), q: Q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

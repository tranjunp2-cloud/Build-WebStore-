// Trạng thái hoạt hình của một mascot: lò xo giảm chấn tới hạn, nhìn quanh, chớp mắt, IK tay.
// Không phụ thuộc three.js -> dùng được với R3F, three thuần, hay test trong Node.
import { ArmSpec, Expression, SceneDef } from './scenes';
import { Q, V3, add, clamp, dot, len, mul, norm, qConj, qFromUnit, qRotate, qYXZ, sub } from './math';

export interface Spring { x: number; v: number }
const sp = (x: number): Spring => ({ x, v: 0 });
/** lò xo giảm chấn tới hạn (lời giải chính xác) – mượt, không rung, ổn định với mọi dt */
export function springTo(s: Spring, target: number, dt: number, w: number) {
  const x = s.x - target, v = s.v, e = Math.exp(-w * dt), q = v + w * x;
  s.x = target + (x + q * dt) * e;
  s.v = (v - w * q * dt) * e;
}

export const RIG = {
  shoulder: [0.7, -0.36, 0.02] as V3, // vị trí vai trong hệ toạ độ Body (tay phải; tay trái đảo dấu x)
  L1: 0.5, L2: 0.5,
  neck: [0, 0.2, 0] as V3, headCenter: [0, 0.8, 0] as V3
};
const DOWN: V3 = [0, -1, 0];

export const armAngle = (s?: ArmSpec) => (s === undefined ? 12 : typeof s === 'number' ? s : s.a);
export const armFwd = (s?: ArmSpec) => (s && typeof s === 'object' && s.fwd !== undefined ? s.fwd : 0.35);
const armFlag = (s: ArmSpec | undefined, k: 'sway' | 'wave') => !!(s && typeof s === 'object' && s[k]);

export interface ArmPose {
  /** quaternion cục bộ của node Shoulder_X */ shoulder: Q;
  /** quaternion cục bộ của node Elbow_X */ elbow: Q;
  /** vị trí bàn tay trong hệ toạ độ thế giới của model */ hand: V3;
}
export interface Pose {
  /** dịch chuyển y của node gốc WebStoreBot */ bob: number;
  /** quaternion cục bộ node Body */ body: Q;
  /** quaternion cục bộ node Head */ head: Q;
  L: ArmPose; R: ArmPose;
  expr: Expression; blink: number;
  /** lệch mắt trên màn hình (đơn vị UV) */ eye: [number, number];
  /** yaw của thân, dùng cho thị sai đạo cụ */ bodyYaw: number;
  t: number;
}

function solveArm(dir: number, angDeg: number, fwd: number, wave: number) {
  const { L1, L2 } = RIG, S: V3 = [dir * RIG.shoulder[0], RIG.shoulder[1], RIG.shoulder[2]];
  const a = (angDeg * Math.PI) / 180;
  const d = norm([dir * Math.sin(a), -Math.cos(a), fwd]);
  let H = add(S, mul(d, (L1 + L2) * 0.93));
  const v = sub(H, S), dist = clamp(len(v), 0.3, L1 + L2 - 0.02), u = norm(v);
  H = add(S, mul(u, dist));
  const a1 = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - a1 * a1));
  const pole: V3 = [dir * 0.5, -0.8, -0.35];
  let p = sub(pole, mul(u, dot(pole, u)));
  p = len(p) < 0.05 ? [0, 0, -1] : norm(p);
  const E = add(S, add(mul(u, a1), mul(p, h)));
  if (wave) { // vẫy bằng cẳng tay quanh khuỷu
    const fa = sub(H, E), c = Math.cos(wave * dir), s = Math.sin(wave * dir);
    H = add(E, [fa[0] * c - fa[1] * s, fa[0] * s + fa[1] * c, fa[2]]);
  }
  return { S, E, H };
}

export interface StateOptions { random?: boolean; rng?: () => number }

export class MascotState {
  def: SceneDef; expr: Expression; t = 0;
  hyaw: Spring; hpitch: Spring; byaw: Spring; hroll = 0;
  aL: Spring; aR: Spring; fL: Spring; fR: Spring; wL: Spring; wR: Spring;
  private gY = 0; private gP = 0; private gNext: number; private bNext: number; private bStart = -9;
  private rng: () => number;
  constructor(def: SceneDef, opts: StateOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    const random = opts.random !== false;
    this.def = def; this.expr = def.expr;
    const look = def.look ?? [0, 0];
    this.hyaw = sp(look[0]); this.hpitch = sp(look[1]); this.byaw = sp(look[0] * 0.45);
    this.aL = sp(armAngle(def.armL)); this.aR = sp(armAngle(def.armR));
    this.fL = sp(armFwd(def.armL)); this.fR = sp(armFwd(def.armR));
    this.wL = sp(armFlag(def.armL, 'wave') ? 1 : 0); this.wR = sp(armFlag(def.armR, 'wave') ? 1 : 0);
    this.gNext = random ? 1 + this.rng() * 2 : 1e9;
    this.bNext = random ? 0.8 + this.rng() * 3 : 1e9;
  }
  /** đổi scene: tư thế chuyển mượt nhờ lò xo, chớp mắt để che lúc đổi biểu cảm */
  setDef(def: SceneDef) { this.def = def; this.expr = def.expr; this.bStart = this.t; }
  /** đặt hướng nhìn tức thì (ảnh tĩnh) */
  setLook(yaw: number, pitch = 0, turnBody = false) {
    this.hyaw = sp(yaw); this.hpitch = sp(pitch); this.byaw = sp(turnBody ? yaw : yaw * 0.45);
  }
  step(dt: number, follow?: { yaw: number; pitch: number } | null) {
    this.t += dt;
    const d = this.def, look = d.look ?? [0, 0], r = this.rng;
    let ty: number, tp: number;
    if (follow) { ty = look[0] * 0.35 + follow.yaw; tp = look[1] * 0.35 + follow.pitch; }
    else {
      if (this.t > this.gNext) {
        const z = r() < 0.3;
        this.gY = z ? 0 : (r() - 0.5) * 0.55; this.gP = z ? 0 : (r() - 0.4) * 0.16;
        this.gNext = this.t + 1.6 + r() * 3.2;
      }
      ty = look[0] + this.gY; tp = look[1] + this.gP;
    }
    springTo(this.hyaw, ty, dt, 9); springTo(this.hpitch, tp, dt, 9);
    springTo(this.byaw, this.hyaw.x * 0.45, dt, 3.2);
    this.hroll = clamp(-this.hyaw.v * 0.07, -0.16, 0.16) + Math.sin(this.t * 0.9) * 0.025;
    const sw = Math.sin(this.t * 2.4) * 6;
    springTo(this.aL, armAngle(d.armL) + (armFlag(d.armL, 'sway') ? sw : 0), dt, 7);
    springTo(this.aR, armAngle(d.armR) + (armFlag(d.armR, 'sway') ? -sw : 0), dt, 7);
    springTo(this.fL, armFwd(d.armL), dt, 6); springTo(this.fR, armFwd(d.armR), dt, 6);
    springTo(this.wL, armFlag(d.armL, 'wave') ? 1 : 0, dt, 6); springTo(this.wR, armFlag(d.armR, 'wave') ? 1 : 0, dt, 6);
    if (this.t > this.bNext) { this.bStart = this.t; this.bNext = this.t + (r() < 0.15 ? 0.32 : 2.2 + r() * 3.4); }
  }
  blink() { const d = this.t - this.bStart; return d >= 0 && d < 0.2 ? 1 - Math.sin((Math.PI * d) / 0.2) : 1; }

  pose(avatar = false): Pose {
    const t = this.t;
    const bob = avatar ? Math.sin(t * 1.7) * 0.03 : Math.sin(t * 2.0) * 0.065 + Math.sin(t * 0.73 + 1) * 0.02;
    const roll = Math.sin(t * 1.1) * 0.03 - this.byaw.v * 0.05;
    const body = qYXZ(this.byaw.x, this.hpitch.x * 0.15, roll);
    const head = qYXZ(this.hyaw.x - this.byaw.x, this.hpitch.x * 0.85, this.hroll);
    const arm = (dir: number, a: Spring, f: Spring, w: Spring): ArmPose => {
      const wave = w.x > 0.01 ? Math.sin(t * 7.5) * 0.55 * w.x : 0;
      const { S, E, H } = solveArm(dir, a.x, f.x, wave);
      const shoulder = qFromUnit(DOWN, norm(sub(E, S)));
      const elbow = qFromUnit(DOWN, norm(qRotate(qConj(shoulder), sub(H, E))));
      const hand = add([0, bob, 0], qRotate(body, H));
      return { shoulder, elbow, hand };
    };
    return {
      bob, body, head,
      L: arm(-1, this.aL, this.fL, this.wL), R: arm(1, this.aR, this.fR, this.wR),
      expr: this.expr, blink: this.blink(),
      eye: [clamp((this.hyaw.x - this.byaw.x) * 0.05, -0.04, 0.04), clamp(this.hpitch.x * 0.07, -0.04, 0.04)],
      bodyYaw: this.byaw.x, t
    };
  }
}

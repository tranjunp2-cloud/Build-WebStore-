// Đạo cụ minh hoạ (vẽ 2D thành texture, hiển thị như tấm billboard trong cảnh 3D).
// Khung vẽ: gốc (0,0) ở giữa, nội dung nằm trong khoảng ±90 đơn vị.
import { PropName } from './scenes';
import { C, Ctx, PXR, TAU, circle, g2, heartPath, lg, lift, line, poly, rg, rr, sh, starPath, text } from './draw2d';

export const PROP_EXTENT = 180; // kích thước khung sprite (đơn vị logic)

export const PROPS: Record<PropName, (ctx: Ctx) => void> = {
  chart(ctx) {
    lift(ctx, () => { rr(ctx, -44, -34, 88, 70, 12); ctx.fillStyle = '#fff'; ctx.fill(); });
    rr(ctx, -44, -34, 88, 70, 12); ctx.strokeStyle = C.shade; ctx.lineWidth = 2; ctx.stroke();
    ([[-34, C.red], [-26, C.yellow], [-18, C.green]] as [number, string][]).forEach((d) => circle(ctx, d[0], -25, 2.6, d[1]));
    [[-30, 18], [-12, 30], [6, 42]].forEach((b) => {
      const h = b[1] * 0.92; rr(ctx, b[0], 28 - h, 14, h, 4); ctx.fillStyle = g2(ctx, 0, 28 - h, 0, 28, C.tealL, C.teal); ctx.fill();
    });
    ctx.save(); sh(ctx, 'rgba(255,159,67,.6)', 8, 0);
    ctx.beginPath(); ctx.moveTo(-34, 6); ctx.lineTo(-12, -6); ctx.lineTo(8, -1); ctx.lineTo(32, -20);
    ctx.strokeStyle = C.orange; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    circle(ctx, 32, -20, 5.5, '#fff', C.orange, 3); ctx.restore();
  },
  box(ctx) {
    lift(ctx, () => poly(ctx, [[-30, -6], [0, -20], [30, -6], [30, 30], [0, 44], [-30, 30]], C.kraft), 12, 7);
    poly(ctx, [[-30, -6], [0, 8], [0, 44], [-30, 30]], g2(ctx, -30, 0, 0, 40, '#e9b772', '#d39a52'));
    poly(ctx, [[0, 8], [30, -6], [30, 30], [0, 44]], g2(ctx, 0, 0, 30, 40, '#c78f45', '#a8742f'));
    poly(ctx, [[-30, -6], [0, -20], [30, -6], [0, 8]], g2(ctx, -30, -20, 30, 8, '#f6d9a4', '#eec585'));
    poly(ctx, [[-5, -17.7], [0, -20], [5, -17.7], [5, 41.7], [0, 44], [-5, 41.7]], g2(ctx, 0, -20, 0, 44, C.tealL, C.teal));
    ctx.fillStyle = 'rgba(255,255,255,.8)'; rr(ctx, -24, 12, 14, 10, 2); ctx.fill();
  },
  cart(ctx) {
    lift(ctx, () => poly(ctx, [[-22, -14], [40, -14], [31, 10], [-14, 10]], C.teal), 10, 6);
    ctx.beginPath(); ctx.moveTo(-44, -30); ctx.lineTo(-30, -30); ctx.lineTo(-17, 18); ctx.lineTo(30, 18);
    ctx.strokeStyle = C.navy; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    poly(ctx, [[-24, -16], [40, -16], [31, 8], [-16, 8]], g2(ctx, 0, -16, 0, 8, '#27cfe6', C.tealD), C.navy, 3.5);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    [-8, 8, 24].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x - 3, 6); ctx.stroke(); });
    poly(ctx, [[-4, -34], [14, -26], [14, -16], [-4, -16]], C.kraft);
    circle(ctx, -10, 30, 7.5, C.navyD); circle(ctx, -10, 30, 3, C.shade);
    circle(ctx, 22, 30, 7.5, C.navyD); circle(ctx, 22, 30, 3, C.shade);
  },
  card(ctx) {
    lift(ctx, () => { rr(ctx, -40, -26, 80, 52, 9); ctx.fillStyle = C.navy; ctx.fill(); }, 12, 6);
    rr(ctx, -40, -26, 80, 52, 9); ctx.fillStyle = lg(ctx, -40, -26, 40, 26, [[0, '#2fd3e6'], [0.5, C.teal], [1, C.navy]]); ctx.fill();
    ctx.save(); rr(ctx, -40, -26, 80, 52, 9); ctx.clip();
    poly(ctx, [[-10, -30], [24, -30], [-12, 30], [-46, 30]], 'rgba(255,255,255,.14)');
    ctx.restore();
    ctx.fillStyle = 'rgba(4,12,24,.45)'; ctx.fillRect(-40, -14, 80, 10);
    rr(ctx, -31, 4, 17, 13, 3); ctx.fillStyle = g2(ctx, -31, 4, -14, 17, '#ffe08a', '#e0a21c'); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; rr(ctx, -6, 10, 34, 4, 2); ctx.fill();
  },
  bell(ctx) {
    ctx.translate(0, -4);
    const p = () => {
      ctx.beginPath(); ctx.moveTo(-28, 22); ctx.quadraticCurveTo(-28, -6, -19, -15);
      ctx.quadraticCurveTo(0, -38, 19, -15); ctx.quadraticCurveTo(28, -6, 28, 22); ctx.closePath();
    };
    lift(ctx, () => { p(); ctx.fillStyle = C.yellow; ctx.fill(); }, 10, 6);
    p(); ctx.fillStyle = lg(ctx, -28, -20, 28, 22, [[0, '#ffe38a'], [0.55, '#ffc233'], [1, '#e89c00']]); ctx.fill();
    ctx.beginPath(); ctx.arc(-9, -6, 14, Math.PI * 1.05, Math.PI * 1.45); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    rr(ctx, -32, 19, 64, 9, 4.5); ctx.fillStyle = '#e89c00'; ctx.fill();
    circle(ctx, 0, 34, 6.5, C.navy);
    circle(ctx, 20, -26, 8, C.red, '#fff', 2.5);
  },
  gear(ctx) {
    lift(ctx, () => circle(ctx, 0, 0, 34, C.navy), 10, 5);
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i * TAU) / 8);
      poly(ctx, [[-8, -26], [8, -26], [6, -37], [-6, -37]], g2(ctx, 0, -37, 0, -26, C.navyL, C.navy)); ctx.restore();
    }
    circle(ctx, 0, 0, 29, lg(ctx, -20, -26, 22, 26, [[0, C.navyL], [1, C.navyD]]));
    circle(ctx, 0, 0, 20, lg(ctx, -18, -18, 18, 18, [[0, '#4fe0f2'], [1, C.tealD]]));
    circle(ctx, 0, 0, 9, '#fff'); circle(ctx, 0, 0, 5, 'rgba(0,181,207,.35)');
  },
  magnifier(ctx) {
    lift(ctx, () => line(ctx, 10, 10, 34, 34, C.navyD, 11), 8, 5);
    line(ctx, 10, 10, 34, 34, C.navyD, 11); line(ctx, 14, 14, 30, 30, C.navyL, 3);
    circle(ctx, -6, -6, 23, rg(ctx, -6, -6, 26, [[0, 'rgba(255,255,255,.55)'], [1, 'rgba(140,236,246,.35)']], -12, -12));
    circle(ctx, -6, -6, 23, null, lg(ctx, -28, -28, 18, 18, [[0, C.navyL], [1, C.navyD]]), 7);
    ctx.beginPath(); ctx.arc(-6, -6, 14, Math.PI * 1.1, Math.PI * 1.5); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
  },
  truck(ctx) {
    lift(ctx, () => { rr(ctx, -44, -24, 50, 40, 6); ctx.fillStyle = C.teal; ctx.fill(); }, 10, 6);
    rr(ctx, -44, -24, 50, 40, 6); ctx.fillStyle = g2(ctx, 0, -24, 0, 16, '#27cfe6', C.tealD); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; rr(ctx, -34, -14, 30, 6, 3); ctx.fill();
    poly(ctx, [[8, -12], [27, -12], [42, 2], [42, 16], [8, 16]], g2(ctx, 0, -12, 0, 16, C.navyL, C.navyD));
    poly(ctx, [[14, -8], [25, -8], [34, 3], [14, 3]], C.tealL);
    [[-24, 20], [26, 20]].forEach((w) => { circle(ctx, w[0], w[1], 10, C.navyD); circle(ctx, w[0], w[1], 4.5, C.shade); });
    ctx.fillStyle = 'rgba(255,255,255,.75)'; rr(ctx, -64, -8, 14, 3.5, 2); ctx.fill(); rr(ctx, -58, 3, 18, 3.5, 2); ctx.fill();
  },
  chat(ctx) {
    lift(ctx, () => { rr(ctx, -40, -30, 80, 52, 16); ctx.fillStyle = '#fff'; ctx.fill(); poly(ctx, [[-18, 18], [-28, 38], [2, 18]], '#fff'); }, 12, 6);
    rr(ctx, -40, -30, 80, 52, 16); ctx.fillStyle = '#fff'; ctx.fill();
    poly(ctx, [[-18, 18], [-28, 38], [2, 18]], '#fff');
  },
  tag(ctx) {
    ctx.rotate(-0.3);
    lift(ctx, () => poly(ctx, [[-32, -24], [14, -24], [40, 0], [14, 24], [-32, 24]], C.orange), 10, 6);
    poly(ctx, [[-32, -24], [14, -24], [40, 0], [14, 24], [-32, 24]], g2(ctx, -32, -24, 40, 24, '#ffbd6e', '#ff8a24'), '#ff8a24', 2);
    circle(ctx, -20, 0, 5.5, '#fff'); text(ctx, '%', 8, 1, 26, '#fff');
  },
  warning(ctx) {
    lift(ctx, () => poly(ctx, [[0, -36], [40, 30], [-40, 30]], C.yellow, C.yellow, 8), 10, 6);
    poly(ctx, [[0, -36], [40, 30], [-40, 30]], g2(ctx, 0, -36, 0, 30, '#ffe08a', '#ffb300'), '#ffb300', 8);
    rr(ctx, -4.5, -12, 9, 26, 4.5); ctx.fillStyle = C.navyD; ctx.fill(); circle(ctx, 0, 22, 5, C.navyD);
  },
  check(ctx) {
    lift(ctx, () => circle(ctx, 0, 0, 35, C.green), 14, 6, 0.3);
    circle(ctx, 0, 0, 35, lg(ctx, -24, -28, 24, 30, [[0, '#5ff0b6'], [1, '#12a874']]));
    circle(ctx, 0, 0, 35, null, 'rgba(255,255,255,.4)', 3);
    ctx.beginPath(); ctx.moveTo(-15, 2); ctx.lineTo(-4, 14); ctx.lineTo(17, -11);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  },
  lock(ctx) {
    ctx.beginPath(); ctx.arc(0, -12, 17, Math.PI, 0); ctx.strokeStyle = g2(ctx, -17, -30, 17, -10, '#d8e2ee', '#8795a6'); ctx.lineWidth = 9; ctx.lineCap = 'butt'; ctx.stroke();
    lift(ctx, () => { rr(ctx, -28, -12, 56, 44, 10); ctx.fillStyle = C.navy; ctx.fill(); }, 10, 6);
    rr(ctx, -28, -12, 56, 44, 10); ctx.fillStyle = lg(ctx, -28, -12, 28, 32, [[0, C.navyL], [1, C.navyD]]); ctx.fill();
    ctx.save(); sh(ctx, C.glow, 8, 0); circle(ctx, 0, 7, 6.5, C.glow); rr(ctx, -2.5, 9, 5, 12, 2.5); ctx.fillStyle = C.glow; ctx.fill(); ctx.restore();
  },
  shield(ctx) {
    const p = () => { ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(33, -25); ctx.quadraticCurveTo(33, 19, 0, 40); ctx.quadraticCurveTo(-33, 19, -33, -25); ctx.closePath(); };
    lift(ctx, () => { p(); ctx.fillStyle = C.navy; ctx.fill(); }, 12, 6);
    p(); ctx.fillStyle = lg(ctx, -30, -30, 30, 38, [[0, '#27cfe6'], [1, C.navy]]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-3, 11); ctx.lineTo(14, -10);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  },
  star(ctx) {
    lift(ctx, () => { starPath(ctx, 0, 0, 35, 16); ctx.fillStyle = C.yellow; ctx.fill(); }, 10, 5);
    starPath(ctx, 0, 0, 35, 16); ctx.fillStyle = lg(ctx, -20, -30, 20, 30, [[0, '#ffe58f'], [1, '#ffb300']]); ctx.fill();
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-6, -6, 12, Math.PI * 1.1, Math.PI * 1.5); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
  },
  heart(ctx) {
    lift(ctx, () => { heartPath(ctx, 0, 0, 24); ctx.fillStyle = C.red; ctx.fill(); }, 10, 5);
    heartPath(ctx, 0, 0, 24); ctx.fillStyle = lg(ctx, -20, -20, 20, 24, [[0, '#ff8a98'], [1, '#e8344a']]); ctx.fill();
    ctx.beginPath(); ctx.arc(-9, -9, 8, Math.PI * 1.1, Math.PI * 1.6); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
  },
  megaphone(ctx) {
    lift(ctx, () => poly(ctx, [[-32, -11], [10, -30], [10, 30], [-32, 11]], C.orange), 8, 5);
    poly(ctx, [[-32, -11], [10, -30], [10, 30], [-32, 11]], lg(ctx, -32, -30, 10, 30, [[0, '#ffbd6e'], [1, '#ff8a24']]));
    rr(ctx, -44, -13, 18, 26, 6); ctx.fillStyle = g2(ctx, 0, -13, 0, 13, C.navyL, C.navyD); ctx.fill();
    rr(ctx, 6, -32, 10, 64, 5); ctx.fillStyle = g2(ctx, 6, 0, 16, 0, C.navyL, C.navyD); ctx.fill();
  },
  users(ctx) {
    ([[-26, 10, 0, 0.85], [26, 10, 0, 0.85], [0, 0, 1, 1]] as number[][]).forEach((u) => {
      ctx.save(); ctx.translate(u[0], u[1]); ctx.scale(u[3], u[3]);
      lift(ctx, () => circle(ctx, 0, -15, 13, '#fff'), 8, 4, 0.2);
      circle(ctx, 0, -15, 13, g2(ctx, 0, -28, 0, -2, '#ffffff', '#dcebf6'));
      ctx.beginPath(); ctx.arc(0, 28, 24, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = g2(ctx, 0, 4, 0, 28, u[2] ? '#27cfe6' : C.navyL, u[2] ? C.tealD : C.navyD); ctx.fill();
      ctx.restore();
    });
  },
  clipboard(ctx) {
    lift(ctx, () => { rr(ctx, -30, -36, 60, 74, 9); ctx.fillStyle = C.navy; ctx.fill(); }, 10, 6);
    rr(ctx, -30, -36, 60, 74, 9); ctx.fillStyle = g2(ctx, 0, -36, 0, 38, C.navyL, C.navyD); ctx.fill();
    rr(ctx, -23, -26, 46, 58, 5); ctx.fillStyle = '#fff'; ctx.fill();
    rr(ctx, -13, -42, 26, 13, 6); ctx.fillStyle = g2(ctx, 0, -42, 0, -29, '#d8e2ee', '#8795a6'); ctx.fill();
    for (let i = 0; i < 3; i++) { circle(ctx, -12, -10 + i * 17, 4.5, C.green); ctx.fillStyle = C.shade; rr(ctx, -3, -12.5 + i * 17, 24, 5, 2.5); ctx.fill(); }
  },
  cloud(ctx) {
    const p = () => { ctx.beginPath(); ctx.arc(-16, 8, 17, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(0, -8, 22, Math.PI, 0); ctx.arc(22, 8, 15, Math.PI * 1.5, Math.PI * 0.5); ctx.closePath(); };
    lift(ctx, () => { p(); ctx.fillStyle = '#fff'; ctx.fill(); }, 10, 6);
    p(); ctx.fillStyle = g2(ctx, 0, -30, 0, 25, '#ffffff', '#dbe9f5'); ctx.fill();
  },
  cloudOff(ctx) {
    PROPS.cloud(ctx);
    ctx.save(); sh(ctx, 'rgba(255,93,108,.5)', 8, 0); line(ctx, -32, -28, 34, 32, C.red, 8); ctx.restore();
  },
  dollar(ctx) {
    lift(ctx, () => circle(ctx, 0, 0, 34, C.yellow), 10, 6);
    circle(ctx, 0, 0, 34, lg(ctx, -24, -28, 24, 30, [[0, '#ffe58f'], [1, '#f0a400']]), '#e6a100', 4);
    circle(ctx, 0, 0, 26, null, 'rgba(255,255,255,.6)', 2.5);
    text(ctx, '$', 0, 2, 36, '#b57600');
  },
  spinner(ctx) { circle(ctx, 0, 0, 29, null, '#dbe9f5', 10); },
  n404(ctx) {
    ctx.save(); sh(ctx, 'rgba(15,42,107,.25)', 8, 5);
    text(ctx, '404', 0, 0, 56, g2(ctx, 0, -28, 0, 28, C.navyL, C.navyD), '900'); ctx.restore();
  },
  question(ctx) {
    ctx.save(); sh(ctx, 'rgba(0,181,207,.35)', 10, 5);
    text(ctx, '?', 0, 0, 76, g2(ctx, 0, -34, 0, 34, '#27cfe6', C.tealD), '900'); ctx.restore();
  },
  wrench(ctx) {
    ctx.rotate(-0.8);
    lift(ctx, () => line(ctx, 0, -4, 0, 40, C.gray, 12), 8, 5);
    line(ctx, 0, -4, 0, 40, '#8795a6', 12); line(ctx, -2, -4, -2, 40, 'rgba(255,255,255,.55)', 3.5);
    ctx.beginPath(); ctx.arc(0, -22, 15, -Math.PI / 2 + 0.55, -Math.PI / 2 - 0.55 + TAU);
    ctx.strokeStyle = g2(ctx, -15, -37, 15, -7, '#d8e2ee', '#8795a6'); ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
  }
};

/** Biến đổi theo thời gian áp lên tấm sprite (không vẽ lại texture) */
export interface PropAnim { r?: number; s?: number; sx?: number; dx?: number }
export const PROP_ANIM: Partial<Record<PropName, (t: number) => PropAnim>> = {
  bell: (t) => ({ r: Math.sin(t * 7) * 0.2 }),
  gear: (t) => ({ r: t * 1.2 }),
  truck: (t) => ({ dx: Math.sin(t * 3) * 3 }),
  warning: (t) => ({ s: 1 + Math.sin(t * 6) * 0.04 }),
  check: (t) => ({ s: 1 + Math.sin(t * 4) * 0.05 }),
  star: (t) => ({ r: Math.sin(t * 2) * 0.15 }),
  heart: (t) => ({ s: 1 + Math.abs(Math.sin(t * 4)) * 0.12 }),
  dollar: (t) => ({ sx: Math.cos(t * 2.5) * 0.15 + 0.85 }),
  question: (t) => ({ r: Math.sin(t * 3) * 0.12 }),
  wrench: (t) => ({ r: Math.sin(t * 5) * 0.15 })
};

/** Phần chuyển động bên trong đạo cụ: texture được vẽ lại ~30 fps */
export const PROP_LIVE: Partial<Record<PropName, (ctx: Ctx, t: number) => void>> = {
  chat(ctx, t) {
    for (let i = 0; i < 3; i++) circle(ctx, -17 + i * 17, -5 - Math.max(0, Math.sin(t * 6 - i)) * 6, 5.5, i === 1 ? C.teal : '#22c3dc');
  },
  megaphone(ctx, t) {
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6 - i); ctx.beginPath(); ctx.arc(16, 0, 20 + i * 13, -0.7, 0.7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  },
  spinner(ctx, t) {
    ctx.beginPath(); ctx.arc(0, 0, 29, t * 5, t * 5 + Math.PI * 1.1); ctx.strokeStyle = C.teal; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
  }
};

/** Vẽ một đạo cụ vào canvas vuông (độ phân giải tuỳ ý) */
export function paintPropCanvas(canvas: HTMLCanvasElement | OffscreenCanvas, name: PropName, t = 0, base?: CanvasImageSource) {
  const n = canvas.width, q = n / PROP_EXTENT;
  const x = canvas.getContext('2d') as Ctx;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, n, n);
  if (base) x.drawImage(base, 0, 0, n, n);
  x.setTransform(q, 0, 0, q, n / 2, n / 2);
  if (!base) { const o = PXR.v; PXR.v = q; try { PROPS[name](x); } finally { PXR.v = o; } }
  const live = PROP_LIVE[name];
  if (live) live(x, t);
}

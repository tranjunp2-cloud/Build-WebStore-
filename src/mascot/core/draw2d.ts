// Tiện ích vẽ Canvas 2D dùng cho texture mặt, đạo cụ và logo
export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;
export const FONT = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
export const C = {
  navy: '#1d3f94', navyD: '#0f2a6b', navyL: '#4a78e6',
  teal: '#00b5cf', tealL: '#8cecf6', tealD: '#0891ad',
  white: '#f6fafd', shade: '#d3e1ee', glow: '#62f2ff',
  orange: '#ff9f43', red: '#ff5d6c', green: '#2ecc8f', yellow: '#ffc233',
  kraft: '#e8b36a', gray: '#9aa7b5', text: '#0f2347'
};
/** pixel thật / đơn vị logic – để bóng đổ (shadowBlur) đúng kích thước khi vẽ ở độ phân giải khác */
export const PXR = { v: 1 };

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function lg(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s) => g.addColorStop(s[0], s[1]));
  return g;
}
export function rg(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][], fx?: number, fy?: number) {
  const g = ctx.createRadialGradient(fx ?? x, fy ?? y, 0, x, y, r);
  stops.forEach((s) => g.addColorStop(s[0], s[1]));
  return g;
}
export const g2 = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, a: string, b: string) => lg(ctx, x0, y0, x1, y1, [[0, a], [1, b]]);
export function sh(ctx: Ctx, color: string, blur: number, oy: number) {
  ctx.shadowColor = color; ctx.shadowBlur = blur * PXR.v; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy * PXR.v;
}
type Paint = string | CanvasGradient | null | undefined;
export function circle(ctx: Ctx, x: number, y: number, r: number, fill?: Paint, stroke?: Paint, lw?: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
export function poly(ctx: Ctx, pts: [number, number][], fill?: Paint, stroke?: Paint, lw?: number) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.lineJoin = 'round'; ctx.stroke(); }
}
export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: Paint, lw: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color as string; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}
export function heartPath(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}
export function starPath(ctx: Ctx, x: number, y: number, R: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    if (i) ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); else ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}
export function text(ctx: Ctx, str: string, x: number, y: number, size: number, color: Paint, weight = '800') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color as string; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}
export function lift(ctx: Ctx, fn: () => void, blur = 12, oy = 6, alpha = 0.28) {
  ctx.save(); sh(ctx, `rgba(15,42,107,${alpha})`, blur, oy); fn(); ctx.restore();
}

/* ---------------- Logo Web Store ---------------- */
function logoPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(72, 15); ctx.lineTo(740, 15); ctx.quadraticCurveTo(807, 15, 807, 72);
  ctx.lineTo(807, 236); ctx.quadraticCurveTo(807, 264, 787, 283);
  ctx.lineTo(374, 698); ctx.quadraticCurveTo(352, 720, 320, 720);
  ctx.lineTo(72, 720); ctx.quadraticCurveTo(22, 720, 22, 670);
  ctx.lineTo(22, 65); ctx.quadraticCurveTo(22, 15, 72, 15); ctx.closePath();
}
export function drawLogo(ctx: Ctx, cx: number, cy: number, size: number, opts: { stroke?: number; shadow?: boolean } = {}) {
  const s = size / 830;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-432, -374);
  if (opts.shadow !== false) { ctx.save(); ctx.translate(38, 36); logoPath(ctx); ctx.fillStyle = 'rgba(0,181,207,.26)'; ctx.fill(); ctx.restore(); }
  logoPath(ctx); ctx.fillStyle = lg(ctx, 22, 15, 700, 720, [[0, '#12c6df'], [1, '#00a8c5']]); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = opts.stroke || 24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(250, 232, 98, 0, 1.05, true); ctx.stroke();
  ctx.beginPath(); ctx.arc(250, 236, 38, 0, TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(252, 238); ctx.lineTo(450, 338); ctx.lineTo(392, 398); ctx.lineTo(472, 510);
  ctx.lineTo(446, 534); ctx.lineTo(360, 420); ctx.lineTo(300, 462); ctx.lineTo(280, 452); ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

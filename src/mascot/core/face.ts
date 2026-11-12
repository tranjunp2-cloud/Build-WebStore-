// Vẽ biểu cảm lên màn hình robot (texture). Toạ độ gốc: khung màn hình 118..282 x 64..186.
import { Expression } from './scenes';
import { C, Ctx, FONT, TAU, circle, heartPath, line, rr } from './draw2d';

/** biểu cảm có chuyển động liên tục -> cần cập nhật texture mỗi khung (~30 fps) */
export const ANIMATED_EXPR: Partial<Record<Expression, true>> = { think: true, sleepy: true, love: true, typing: true, speaking: true, listening: true };

export function paintFace(ctx: Ctx, expr: Expression, t: number, bl: number) {
  const lx = 166, rx = 234, ey = 120;
  ctx.strokeStyle = C.glow; ctx.fillStyle = C.glow;
  ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const eye = (x: number, y: number, rx_: number, ry: number) => {
    const r = Math.max(1.5, ry * bl);
    ctx.beginPath(); ctx.ellipse(x, y, rx_, r, 0, 0, TAU); ctx.fillStyle = C.glow; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.ellipse(x - rx_ * 0.28, y - r * 0.38, rx_ * 0.3, r * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.glow;
  };
  const happyEye = (x: number) => { ctx.beginPath(); ctx.arc(x, ey + 8, 14, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); };
  const smile = (y: number, r: number) => { ctx.beginPath(); ctx.arc(200, y, r, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); };
  const blush = () => {
    ctx.fillStyle = 'rgba(255,110,170,.45)';
    [[140, 150], [260, 150]].forEach((p) => { ctx.beginPath(); ctx.ellipse(p[0], p[1], 14, 7.5, 0, 0, TAU); ctx.fill(); });
    ctx.fillStyle = C.glow;
  };
  switch (expr) {
    case 'happy': happyEye(lx); happyEye(rx); smile(146, 20); blush(); break;
    case 'wink': eye(lx, ey, 10, 15); happyEye(rx); smile(146, 19); blush(); break;
    case 'wow': eye(lx, ey, 11, 17); eye(rx, ey, 11, 17); ctx.beginPath(); ctx.ellipse(200, 159, 8, 11, 0, 0, TAU); ctx.stroke(); break;
    case 'sad':
      eye(lx, ey + 4, 10, 13); eye(rx, ey + 4, 10, 13);
      line(ctx, 150, ey - 14, 182, ey - 22, C.glow, 6); line(ctx, 250, ey - 14, 218, ey - 22, C.glow, 6);
      ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(200, 178, 17, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); break;
    case 'think':
      eye(lx + 5, ey - 5, 10, 15); eye(rx + 5, ey - 5, 10, 15);
      line(ctx, 188, 154, 214, 150, C.glow, 8);
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 4 - i)); circle(ctx, 240 + i * 12, 90, 3.4, C.glow); }
      ctx.globalAlpha = 1; break;
    case 'sleepy':
      line(ctx, 154, ey + 4, 180, ey + 4, C.glow, 8); line(ctx, 220, ey + 4, 246, ey + 4, C.glow, 8);
      ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(200, 156, 7, 5.5, 0, 0, TAU); ctx.stroke();
      ctx.font = `800 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('z', 258, 98 - Math.sin(t * 3) * 3); break;
    case 'love':
      [lx, rx].forEach((x) => { heartPath(ctx, x, ey, 13 + Math.abs(Math.sin(t * 4)) * 2.5); ctx.fill(); });
      smile(146, 17); blush(); break;
    case 'focus':
      [lx, rx].forEach((x) => { rr(ctx, x - 12, ey - 4 * bl, 24, 10 * bl + 1, 5); ctx.fill(); });
      smile(151, 12); break;
    case 'error':
      [lx, rx].forEach((x) => { line(ctx, x - 9, ey - 9, x + 9, ey + 9, C.glow, 8); line(ctx, x + 9, ey - 9, x - 9, ey + 9, C.glow, 8); });
      ctx.beginPath(); ctx.moveTo(182, 160); ctx.bezierCurveTo(190, 150, 200, 168, 210, 156); ctx.lineTo(218, 158); ctx.stroke(); break;
    case 'typing':
      eye(lx, ey - 8, 9, 10); eye(rx, ey - 8, 9, 10);
      for (let i = 0; i < 3; i++) circle(ctx, 182 + i * 18, 156 - Math.max(0, Math.sin(t * 8 - i * 0.9)) * 9, 5.8, C.glow);
      break;
    case 'speaking': {
      eye(lx, ey - 4, 10, 15); eye(rx, ey - 4, 10, 15);
      const h = 6 + (0.5 + 0.5 * Math.sin(t * 14)) * 17; rr(ctx, 184, 152 - h / 2, 32, h, Math.min(h / 2, 10)); ctx.fill(); break;
    }
    case 'listening':
      eye(lx, ey - 6, 9.5, 14); eye(rx, ey - 6, 9.5, 14);
      for (let i = 0; i < 5; i++) { const bh = 6 + (0.5 + 0.5 * Math.sin(t * 6 + i * 1.3)) * 18; rr(ctx, 172 + i * 12, 152 - bh / 2, 7, bh, 3.5); ctx.fill(); }
      break;
    case 'blank': break;
    default: eye(lx, ey, 10, 15); eye(rx, ey, 10, 15); smile(144, 19);
  }
}

/**
 * Paints the face texture into a W x 0.75W canvas: transparent background, glow baked in with
 * shadowBlur (the look of the reference demo). Upload it premultiplied (texture.premultiplyAlpha):
 * an emissive map ignores alpha, so un-premultiplied glow pixels read as full-strength cyan and the
 * soft edges turn into hard, stair-stepped blobs.
 */
export function paintFaceCanvas(canvas: HTMLCanvasElement | OffscreenCanvas, expr: Expression, t: number, blink: number) {
  const W = canvas.width, H = canvas.height;
  const x = canvas.getContext('2d') as Ctx;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
  x.setTransform(W / 164, 0, 0, H / 122, (-118 * W) / 164, (-64 * H) / 122);
  x.shadowColor = 'rgba(98,242,255,.9)'; x.shadowBlur = (11 * W) / 164; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
  paintFace(x, expr, t, blink);
  x.shadowBlur = 0;
}

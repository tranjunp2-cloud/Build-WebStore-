// Theo dõi con trỏ toàn cục (một listener cho mọi mascot) để robot nhìn theo
import { clamp } from './math';

const P = { x: 0, y: 0, t: -1e9, bound: false };
function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function bind() {
  if (P.bound || typeof window === 'undefined') return;
  P.bound = true;
  window.addEventListener('pointermove', (e) => { P.x = e.clientX; P.y = e.clientY; P.t = now(); }, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!(e as MouseEvent).relatedTarget) P.t = -1e9; });
}

/** Trả về hướng nhìn mục tiêu cho một phần tử, hoặc null nếu con trỏ đứng yên > 3 giây */
export function followTarget(el: Element | null, headAt = 0.32): { yaw: number; pitch: number } | null {
  bind();
  if (!el || now() - P.t > 3000) return null;
  const r = el.getBoundingClientRect();
  const dx = P.x - (r.left + r.width / 2), dy = P.y - (r.top + r.height * headAt);
  return { yaw: clamp(dx / 520, -1, 1) * 0.6, pitch: clamp(dy / 520, -1, 1) * 0.38 };
}

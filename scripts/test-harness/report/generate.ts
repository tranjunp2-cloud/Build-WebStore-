/**
 * HTML gallery report generator — Phase 04.
 *
 * Reads `.harness-out/combined-report.json` (output of `harness:merge`) and
 * emits `.harness-out/report.html`: a single-file, self-contained HTML page
 * with inline CSS + vanilla JS. PM opens it locally or via CI artifact and
 * eyeballs all fixtures in <5 minutes.
 *
 * Why single file: portable (works over file://, share via Lark, upload as
 * GH artifact). Screenshots stay as relative paths in `screenshots/` so the
 * file size stays small (~50KB HTML + lazy-loaded images).
 *
 * Exit codes:
 *   0 — wrote report.html
 *   2 — combined-report.json missing (run harness:merge first)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const HARNESS_OUT = path.resolve(process.cwd(), '.harness-out')
const COMBINED_PATH = path.resolve(HARNESS_OUT, 'combined-report.json')
const REPORT_PATH = path.resolve(HARNESS_OUT, 'report.html')

type CombinedFixture = {
  fixtureId: string
  category: string
  variant: string
  structural: {
    overallStatus: 'pass' | 'fail' | 'warn' | 'unknown'
    failedGuards: string[]
  }
  visual: {
    hasHole: boolean
    worstRatio: number
    perProject: Array<{
      project: string
      hasHole: boolean
      largestRegionRatio: number
      screenshotPath: string
    }>
  }
}

type CombinedReport = {
  schemaVersion: 1
  generatedAt: string
  summary: {
    totalFixtures: number
    structuralFail: number
    visualHole: number
    bothPass: number
  }
  fixtures: CombinedFixture[]
}

function loadReport(): CombinedReport {
  if (!fs.existsSync(COMBINED_PATH)) {
    console.error(
      `[report] combined-report.json not found at ${COMBINED_PATH} — run \`npm run harness:merge\` first`,
    )
    process.exit(2)
  }
  return JSON.parse(fs.readFileSync(COMBINED_PATH, 'utf8')) as CombinedReport
}

/** Compute the row's effective status for filtering + badge rendering. */
function fixtureStatus(f: CombinedFixture): 'pass' | 'fail' | 'warn' | 'hole' {
  if (f.visual.hasHole) return 'hole'
  if (f.structural.overallStatus === 'fail') return 'fail'
  if (f.structural.overallStatus === 'warn') return 'warn'
  return 'pass'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function categories(fixtures: CombinedFixture[]): string[] {
  const set = new Set<string>()
  for (const f of fixtures) set.add(f.category)
  return Array.from(set).sort()
}

function findDesktopShot(f: CombinedFixture): string | null {
  const desktop = f.visual.perProject.find((p) => /desktop/i.test(p.project))
  return desktop?.screenshotPath ?? null
}

function findMobileShot(f: CombinedFixture): string | null {
  const mobile = f.visual.perProject.find((p) => /mobile/i.test(p.project))
  return mobile?.screenshotPath ?? null
}

function renderFixtureCard(f: CombinedFixture): string {
  const status = fixtureStatus(f)
  const desktopShot = findDesktopShot(f)
  const mobileShot = findMobileShot(f)
  const failedGuardsLine = f.structural.failedGuards.length
    ? `<div class="guards">guards: ${f.structural.failedGuards.map((g) => escapeHtml(g)).join(', ')}</div>`
    : ''
  const ratioLine = f.visual.worstRatio > 0
    ? `<div class="ratio">hole ratio: ${(f.visual.worstRatio * 100).toFixed(0)}%</div>`
    : ''

  // Use relative path from .harness-out/ (where report.html lives).
  // screenshotPath was stored relative to repo root, so we strip the leading
  // ".harness-out/" so the <img src> resolves alongside report.html.
  const desktopRel = desktopShot ? desktopShot.replace(/^\.harness-out\//, '') : null
  const mobileRel = mobileShot ? mobileShot.replace(/^\.harness-out\//, '') : null

  const thumb = desktopRel
    ? `<img class="thumb" src="${escapeHtml(desktopRel)}" alt="${escapeHtml(f.fixtureId)}" loading="lazy" />`
    : `<div class="thumb placeholder">no screenshot — render not run</div>`

  const dataAttrs = [
    `data-status="${status}"`,
    `data-cat="${escapeHtml(f.category)}"`,
    `data-id="${escapeHtml(f.fixtureId)}"`,
    desktopRel ? `data-desktop="${escapeHtml(desktopRel)}"` : '',
    mobileRel ? `data-mobile="${escapeHtml(mobileRel)}"` : '',
    `data-guards="${escapeHtml(f.structural.failedGuards.join(', '))}"`,
  ].filter(Boolean).join(' ')

  return `<figure class="fixture" ${dataAttrs}>
  ${thumb}
  <figcaption>
    <div class="caption-line">
      <span class="id">${escapeHtml(f.fixtureId)}</span>
      <span class="badge ${status}">${status.toUpperCase()}</span>
    </div>
    <div class="meta">${escapeHtml(f.category)} · ${escapeHtml(f.variant)}</div>
    ${failedGuardsLine}
    ${ratioLine}
  </figcaption>
</figure>`
}

function renderReport(report: CombinedReport): string {
  const cats = categories(report.fixtures)
  const cards = report.fixtures.map(renderFixtureCard).join('\n')

  // Recount summary using the same status logic as the cards so the
  // header numbers match what the user actually sees in the grid.
  const counts = { pass: 0, warn: 0, fail: 0, hole: 0 }
  for (const f of report.fixtures) {
    counts[fixtureStatus(f)]++
  }

  const catChips = cats
    .map((c) => `<button class="chip" data-filter-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>AI Gen Harness Report — ${escapeHtml(report.generatedAt)}</title>
<style>
  :root {
    --bg: #0a0a0a;
    --fg: #f5f5f5;
    --muted: #a3a3a3;
    --card-bg: #171717;
    --border: #262626;
    --pass: #10b981;
    --warn: #f59e0b;
    --fail: #ef4444;
    --hole: #b91c1c;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); }
  header { padding: 24px 32px; border-bottom: 1px solid var(--border); }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .timestamp { color: var(--muted); font-size: 12px; }
  .summary { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
  .summary-card { padding: 12px 18px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; min-width: 110px; }
  .summary-card .num { font-size: 28px; font-weight: 700; }
  .summary-card .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-card.pass .num { color: var(--pass); }
  .summary-card.warn .num { color: var(--warn); }
  .summary-card.fail .num { color: var(--fail); }
  .summary-card.hole .num { color: var(--hole); }
  nav.filters { padding: 16px 32px; border-bottom: 1px solid var(--border); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .filter-group { display: flex; gap: 6px; align-items: center; }
  .filter-group + .filter-group { padding-left: 12px; border-left: 1px solid var(--border); }
  .group-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .chip { background: var(--card-bg); border: 1px solid var(--border); color: var(--fg); padding: 5px 12px; border-radius: 999px; font-size: 12px; cursor: pointer; }
  .chip:hover { border-color: #404040; }
  .chip.active { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  main { padding: 24px 32px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
  .fixture { margin: 0; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.1s, border-color 0.1s; }
  .fixture:hover { transform: translateY(-2px); border-color: #404040; }
  .fixture[data-status="pass"] { border-left: 3px solid var(--pass); }
  .fixture[data-status="warn"] { border-left: 3px solid var(--warn); }
  .fixture[data-status="fail"] { border-left: 3px solid var(--fail); }
  .fixture[data-status="hole"] { border-left: 3px solid var(--hole); }
  .thumb { width: 100%; aspect-ratio: 4/5; object-fit: cover; object-position: top; background: #050505; display: block; }
  .thumb.placeholder { display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 12px; padding: 40px 20px; text-align: center; aspect-ratio: 4/5; }
  figcaption { padding: 12px 14px 14px; }
  .caption-line { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; word-break: break-all; line-height: 1.3; }
  .badge { font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 4px; flex-shrink: 0; }
  .badge.pass { background: var(--pass); color: #052e1f; }
  .badge.warn { background: var(--warn); color: #422006; }
  .badge.fail { background: var(--fail); color: #450a0a; }
  .badge.hole { background: var(--hole); color: #fee2e2; }
  .meta { color: var(--muted); font-size: 11px; margin-top: 6px; }
  .guards, .ratio { color: #fca5a5; font-size: 11px; margin-top: 4px; }
  .hidden { display: none !important; }

  /* modal */
  #modal { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: none; z-index: 100; overflow-y: auto; padding: 32px 16px 80px; }
  #modal.open { display: block; }
  #modal .close { position: fixed; top: 16px; right: 24px; background: var(--card-bg); border: 1px solid var(--border); color: var(--fg); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 20px; z-index: 101; }
  #modal .modal-content { max-width: 1500px; margin: 0 auto; }
  #modal h2 { font-family: ui-monospace, monospace; font-size: 14px; word-break: break-all; margin: 0 0 4px; }
  #modal .modal-meta { color: var(--muted); font-size: 12px; margin-bottom: 8px; }
  #modal .guards { color: #fca5a5; font-size: 12px; margin-bottom: 16px; }
  /* Stack shots vertically — each takes full modal width so screenshots
   * render at native pixel ratio for the desktop project, no shrinking. */
  #modal .shots { display: flex; flex-direction: column; gap: 24px; align-items: stretch; }
  #modal .shot { width: 100%; }
  #modal .shot-header { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 12px; background: var(--card-bg); border: 1px solid var(--border); border-bottom: none; border-radius: 6px 6px 0 0; }
  #modal .shot-header label { color: var(--fg); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  #modal .shot-header a { color: var(--muted); font-size: 11px; text-decoration: none; }
  #modal .shot-header a:hover { color: var(--fg); text-decoration: underline; }
  #modal .shot-frame { background: #050505; border: 1px solid var(--border); border-radius: 0 0 6px 6px; overflow: auto; max-height: 80vh; }
  #modal .shot-frame img { display: block; width: 100%; height: auto; }
  #modal .empty-shot { padding: 60px 40px; background: var(--card-bg); border: 1px dashed var(--border); border-top: none; border-radius: 0 0 6px 6px; color: var(--muted); text-align: center; }
</style>
</head>
<body>
<header>
  <h1>AI Gen Test Harness — Report</h1>
  <div class="timestamp">${escapeHtml(report.generatedAt)}</div>
  <div class="summary">
    <div class="summary-card"><div class="num">${report.summary.totalFixtures}</div><div class="label">Total fixtures</div></div>
    <div class="summary-card pass"><div class="num">${counts.pass}</div><div class="label">Pass</div></div>
    <div class="summary-card warn"><div class="num">${counts.warn}</div><div class="label">Warn</div></div>
    <div class="summary-card fail"><div class="num">${counts.fail}</div><div class="label">Structural fail</div></div>
    <div class="summary-card hole"><div class="num">${counts.hole}</div><div class="label">Visual hole</div></div>
  </div>
</header>
<nav class="filters">
  <div class="filter-group">
    <span class="group-label">status</span>
    <button class="chip active" data-filter-status="all">all</button>
    <button class="chip" data-filter-status="fail">fail</button>
    <button class="chip" data-filter-status="hole">hole</button>
    <button class="chip" data-filter-status="warn">warn</button>
    <button class="chip" data-filter-status="pass">pass</button>
  </div>
  <div class="filter-group">
    <span class="group-label">category</span>
    <button class="chip active" data-filter-cat="all">all</button>
    ${catChips}
  </div>
</nav>
<main>
  <div class="grid">
${cards}
  </div>
</main>
<div id="modal" role="dialog" aria-modal="true">
  <button class="close" aria-label="close">&times;</button>
  <div class="modal-content">
    <h2 id="modal-id"></h2>
    <div class="modal-meta" id="modal-meta"></div>
    <div class="guards" id="modal-guards"></div>
    <div class="shots">
      <div class="shot">
        <div class="shot-header">
          <label>desktop · 1440×900 viewport · full-page</label>
          <a id="modal-desktop-link" href="#" target="_blank" rel="noopener">open original ↗</a>
        </div>
        <div class="shot-frame" id="modal-desktop"></div>
      </div>
      <div class="shot">
        <div class="shot-header">
          <label>mobile · 375×812 viewport · full-page</label>
          <a id="modal-mobile-link" href="#" target="_blank" rel="noopener">open original ↗</a>
        </div>
        <div class="shot-frame" id="modal-mobile"></div>
      </div>
    </div>
  </div>
</div>
<script>
(function () {
  var state = { status: 'all', cat: 'all' };
  var grid = document.querySelector('.grid');
  var fixtures = Array.prototype.slice.call(grid.querySelectorAll('.fixture'));

  function applyFilters() {
    fixtures.forEach(function (el) {
      var matchStatus = state.status === 'all' || el.getAttribute('data-status') === state.status;
      var matchCat = state.cat === 'all' || el.getAttribute('data-cat') === state.cat;
      el.classList.toggle('hidden', !(matchStatus && matchCat));
    });
  }

  function bindChips(attr, key) {
    var chips = document.querySelectorAll('[' + attr + ']');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.remove('active'); });
        c.classList.add('active');
        state[key] = c.getAttribute(attr);
        applyFilters();
      });
    });
  }

  bindChips('data-filter-status', 'status');
  bindChips('data-filter-cat', 'cat');

  // Modal
  var modal = document.getElementById('modal');
  var modalId = document.getElementById('modal-id');
  var modalMeta = document.getElementById('modal-meta');
  var modalGuards = document.getElementById('modal-guards');
  var modalDesktop = document.getElementById('modal-desktop');
  var modalMobile = document.getElementById('modal-mobile');
  var modalDesktopLink = document.getElementById('modal-desktop-link');
  var modalMobileLink = document.getElementById('modal-mobile-link');

  function openModal(el) {
    modalId.textContent = el.getAttribute('data-id') || '';
    modalMeta.textContent = (el.getAttribute('data-cat') || '') + ' · ' + (el.getAttribute('data-status') || '');
    var guards = el.getAttribute('data-guards') || '';
    modalGuards.textContent = guards ? 'failed guards: ' + guards : '';
    var d = el.getAttribute('data-desktop');
    var m = el.getAttribute('data-mobile');
    if (d) {
      modalDesktop.innerHTML = '<img src="' + d + '" alt="desktop" />';
      modalDesktopLink.href = d;
      modalDesktopLink.style.display = '';
    } else {
      modalDesktop.innerHTML = '<div class="empty-shot">no desktop screenshot — render not run</div>';
      modalDesktopLink.style.display = 'none';
    }
    if (m) {
      modalMobile.innerHTML = '<img src="' + m + '" alt="mobile" />';
      modalMobileLink.href = m;
      modalMobileLink.style.display = '';
    } else {
      modalMobile.innerHTML = '<div class="empty-shot">no mobile screenshot — render not run</div>';
      modalMobileLink.style.display = 'none';
    }
    modal.scrollTop = 0;
    modal.classList.add('open');
  }

  function closeModal() { modal.classList.remove('open'); }

  fixtures.forEach(function (el) {
    el.addEventListener('click', function () { openModal(el); });
  });
  document.querySelector('#modal .close').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
})();
</script>
</body>
</html>`
}

function main() {
  const report = loadReport()
  const html = renderReport(report)
  fs.mkdirSync(HARNESS_OUT, { recursive: true })
  fs.writeFileSync(REPORT_PATH, html, 'utf8')
  const sizeKb = (fs.statSync(REPORT_PATH).size / 1024).toFixed(1)
  console.log(
    `[report] ${report.fixtures.length} fixtures: ${report.summary.bothPass} pass, ` +
      `${report.summary.structuralFail} structural-fail, ${report.summary.visualHole} visual-hole`,
  )
  console.log(`[report] wrote ${REPORT_PATH} (${sizeKb} KB)`)
}

main()

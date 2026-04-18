/**
 * Rubric HTML dashboard — reads rubric-report.json, writes rubric-report.html.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RubricReport, FixtureScore, DimensionScore } from './rubric.schema'

const MODULE_DIR = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(MODULE_DIR, '../../..')
const REPORT_JSON = path.resolve(REPO_ROOT, '.harness-out/rubric-report.json')
const REPORT_HTML = path.resolve(REPO_ROOT, '.harness-out/rubric-report.html')

function statusColor(status: 'pass' | 'warn' | 'fail'): string {
    return status === 'pass' ? '#059669' : status === 'warn' ? '#d97706' : '#dc2626'
}

function dimBar(d: DimensionScore): string {
    const pct = d.score * 10
    const color = d.score >= 7 ? '#059669' : d.score >= 5 ? '#d97706' : '#dc2626'
    return `
    <div class="dim-row">
      <div class="dim-label">${d.name} <span class="dim-weight">w${d.weight}</span></div>
      <div class="dim-bar-track"><div class="dim-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="dim-score">${d.score.toFixed(1)}</div>
    </div>`
}

function fixtureCard(f: FixtureScore): string {
    const criteriaDetail = f.dimensions
        .map(
            (d) => `
      <details class="crit-dim">
        <summary>${d.name} — ${d.score.toFixed(1)}/10 (w${d.weight})</summary>
        <ul class="crit-list">
          ${d.criteria
              .map(
                  (c) =>
                      `<li class="crit-${c.status}">
              <span class="crit-status">${c.status === 'pass' ? '✓' : c.status === 'partial' ? '◐' : '✗'}</span>
              <span class="crit-label">${c.label}</span>
              <span class="crit-points">${c.points}/${c.maxPoints}</span>
              ${c.reason ? `<div class="crit-reason">${c.reason}</div>` : ''}
            </li>`,
              )
              .join('')}
        </ul>
      </details>`,
        )
        .join('')

    return `
    <article class="card" data-category="${f.category}" data-status="${f.status}">
      <header class="card-head">
        <div>
          <h3><a href="/test-harness/${f.fixtureId}" target="_blank">${f.fixtureId}</a></h3>
          <span class="tag cat-tag">${f.category}</span>
          <span class="tag status-tag" style="background:${statusColor(f.status)}">${f.status.toUpperCase()}</span>
        </div>
        <div class="score-big">${f.weighted.toFixed(1)}<span class="score-sub">/10</span></div>
      </header>
      <div class="dims">${f.dimensions.map(dimBar).join('')}</div>
      <div class="crit-drill">${criteriaDetail}</div>
    </article>`
}

export function generateHtml(): void {
    const raw = fs.readFileSync(REPORT_JSON, 'utf8')
    const report = JSON.parse(raw) as RubricReport

    const { total, pass, warn, fail, avgWeighted, perDimensionAvg } = report.summary
    const fixtures = [...report.fixtures].sort((a, b) => b.weighted - a.weighted)
    const categories = Array.from(new Set(fixtures.map((f) => f.category))).sort()

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Template Quality Rubric — Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 24px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .subtitle { color: #9ca3af; font-size: 14px; margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #171717; padding: 16px; border-radius: 8px; border: 1px solid #262626; }
  .stat-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; }
  .stat-value { font-size: 32px; font-weight: 700; margin-top: 4px; }
  .stat-value.pass { color: #10b981; }
  .stat-value.warn { color: #f59e0b; }
  .stat-value.fail { color: #ef4444; }
  .dim-avg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
  .dim-avg-item { background: #171717; padding: 10px 14px; border-radius: 6px; border: 1px solid #262626; font-size: 13px; }
  .dim-avg-item strong { display: block; color: #d1d5db; font-size: 18px; margin-top: 2px; }
  .filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
  .filter-btn { background: #171717; border: 1px solid #262626; color: #e5e5e5; padding: 6px 12px; border-radius: 6px; cursor: pointer; font: inherit; }
  .filter-btn.active { background: #7c3aed; border-color: #7c3aed; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
  .card { background: #171717; border: 1px solid #262626; border-radius: 10px; padding: 16px; }
  .card-head { display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; }
  .card-head h3 { font-size: 14px; font-family: ui-monospace, Menlo, monospace; margin-bottom: 6px; }
  .card-head h3 a { color: #60a5fa; text-decoration: none; }
  .card-head h3 a:hover { text-decoration: underline; }
  .tag { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 3px; background: #262626; color: #d1d5db; margin-right: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .tag.status-tag { color: #fff; font-weight: 600; }
  .score-big { font-size: 32px; font-weight: 700; color: #fff; }
  .score-sub { font-size: 14px; color: #9ca3af; }
  .dims { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .dim-row { display: grid; grid-template-columns: 140px 1fr 40px; gap: 10px; align-items: center; font-size: 12px; }
  .dim-label { color: #d1d5db; font-size: 11px; }
  .dim-weight { color: #6b7280; font-size: 10px; margin-left: 4px; }
  .dim-bar-track { background: #262626; height: 6px; border-radius: 3px; overflow: hidden; }
  .dim-bar-fill { height: 100%; transition: width 0.3s; }
  .dim-score { text-align: right; color: #9ca3af; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
  .crit-drill { margin-top: 8px; border-top: 1px solid #262626; padding-top: 8px; }
  .crit-dim { margin-bottom: 4px; }
  .crit-dim summary { cursor: pointer; color: #9ca3af; font-size: 12px; padding: 4px 0; }
  .crit-dim summary:hover { color: #e5e5e5; }
  .crit-list { list-style: none; padding-left: 14px; font-size: 12px; }
  .crit-list li { padding: 3px 0; display: grid; grid-template-columns: 20px 1fr 40px; gap: 6px; align-items: baseline; }
  .crit-list li.crit-pass .crit-status { color: #10b981; }
  .crit-list li.crit-partial .crit-status { color: #f59e0b; }
  .crit-list li.crit-fail .crit-status { color: #ef4444; }
  .crit-label { color: #d1d5db; }
  .crit-points { color: #6b7280; text-align: right; font-family: ui-monospace, Menlo, monospace; }
  .crit-reason { grid-column: 2 / 4; color: #6b7280; font-size: 11px; padding-top: 2px; font-style: italic; }
</style>
</head>
<body>

<h1>Template Quality Rubric — Report</h1>
<div class="subtitle">${report.rubric.name} · ${report.generatedAt}</div>

<div class="stats">
  <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${total}</div></div>
  <div class="stat"><div class="stat-label">Pass ≥7</div><div class="stat-value pass">${pass}</div></div>
  <div class="stat"><div class="stat-label">Warn 5-6.9</div><div class="stat-value warn">${warn}</div></div>
  <div class="stat"><div class="stat-label">Fail &lt;5</div><div class="stat-value fail">${fail}</div></div>
  <div class="stat"><div class="stat-label">Avg Weighted</div><div class="stat-value">${avgWeighted.toFixed(1)}</div></div>
</div>

<h2 style="font-size:16px;margin-bottom:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Dimension Averages</h2>
<div class="dim-avg">
${Object.entries(perDimensionAvg)
    .map(
        ([id, avg]) =>
            `<div class="dim-avg-item">${id}<strong>${avg.toFixed(1)}/10</strong></div>`,
    )
    .join('')}
</div>

<div class="filters">
  <span style="color:#9ca3af;">Filter:</span>
  <button class="filter-btn active" data-filter="all">All ${total}</button>
  <button class="filter-btn" data-filter="pass">Pass ${pass}</button>
  <button class="filter-btn" data-filter="warn">Warn ${warn}</button>
  <button class="filter-btn" data-filter="fail">Fail ${fail}</button>
  <span style="margin-left:16px;color:#6b7280">|</span>
  ${categories.map((c) => `<button class="filter-btn" data-filter-cat="${c}">${c}</button>`).join('')}
</div>

<div class="cards">
${fixtures.map(fixtureCard).join('')}
</div>

<script>
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const status = btn.dataset.filter;
    const cat = btn.dataset.filterCat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.card').forEach(card => {
      let show = true;
      if (status && status !== 'all') show = card.dataset.status === status;
      if (cat) show = card.dataset.category === cat;
      card.style.display = show ? '' : 'none';
    });
  });
});
</script>
</body>
</html>`

    fs.writeFileSync(REPORT_HTML, html)
    console.log(`[rubric-html] wrote ${REPORT_HTML} (${(html.length / 1024).toFixed(1)} KB)`)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('report-html.ts')) {
    generateHtml()
}

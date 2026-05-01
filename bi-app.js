/* ============================================================
   AudioBI — Application Logic  (Enhanced Edition)
   ============================================================ */
'use strict';

const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES    = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "audiocpd-data.json";

let tokenClient  = null;
let accessToken  = null;
let driveFileId  = null;
let driveReady   = false;

let data           = [];
let currentView    = 'overview';
let editIndex      = null;
let deleteIndex    = null;
let sortCol        = null;
let sortAsc        = true;
let chartInstances = {};

// ── PERIOD HELPERS ──────────────────────────────────────────
// Normalise legacy free-text periods to "Period N" if they match patterns
function normalisePeriod(raw) {
  if (!raw) return raw;
  // Already "Period N"
  if (/^Period \d+$/i.test(String(raw).trim())) return String(raw).trim();
  // Pure number 1-12
  if (/^\d{1,2}$/.test(String(raw).trim())) {
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 12) return `Period ${n}`;
  }
  return String(raw).trim();
}

function periodSortKey(p) {
  const m = String(p).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

// ── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadLocal();
  populateFilters();
  render();
  loadTheme();
  initGoogleApi();
});

// ── LOCAL STORAGE ────────────────────────────────────────────
function loadLocal() {
  try {
    const raw = localStorage.getItem('audiocpd_bi_data');
    data = raw ? JSON.parse(raw) : sampleData();
    data = data.map(r => ({ ...r, period: normalisePeriod(r.period) }));
  } catch { data = sampleData(); }
}
function saveLocal() { localStorage.setItem('audiocpd_bi_data', JSON.stringify(data)); }

function sampleData() {
  return [
    { name:'Sarah Mitchell', period:'Period 1', totalSales:42000, haRevenue:36000, nonHaRevenue:3500, waxRevenue:2500, haRefunds:1200, aov:1800, revenuePerClinic:6000, binauralRate:68, ifcTakeUp:55, hce:28, hceToSale:18, waxRemovals:22, hhc:45, hhcToHce:28 },
    { name:'James Carter',   period:'Period 1', totalSales:38500, haRevenue:32000, nonHaRevenue:3200, waxRevenue:3300, haRefunds:800,  aov:1600, revenuePerClinic:5500, binauralRate:72, ifcTakeUp:48, hce:30, hceToSale:19, waxRemovals:30, hhc:50, hhcToHce:30 },
    { name:'Priya Sharma',   period:'Period 1', totalSales:51000, haRevenue:44000, nonHaRevenue:4200, waxRevenue:2800, haRefunds:900,  aov:2100, revenuePerClinic:7300, binauralRate:80, ifcTakeUp:62, hce:32, hceToSale:24, waxRemovals:25, hhc:48, hhcToHce:32 },
    { name:'Sarah Mitchell', period:'Period 2', totalSales:45000, haRevenue:39000, nonHaRevenue:3000, waxRevenue:3000, haRefunds:1100, aov:1900, revenuePerClinic:6400, binauralRate:70, ifcTakeUp:58, hce:30, hceToSale:22, waxRemovals:27, hhc:46, hhcToHce:30 },
    { name:'James Carter',   period:'Period 2', totalSales:40000, haRevenue:34000, nonHaRevenue:3400, waxRevenue:2600, haRefunds:750,  aov:1700, revenuePerClinic:5700, binauralRate:75, ifcTakeUp:50, hce:31, hceToSale:21, waxRemovals:24, hhc:52, hhcToHce:31 },
    { name:'Priya Sharma',   period:'Period 2', totalSales:54000, haRevenue:47000, nonHaRevenue:4000, waxRevenue:3000, haRefunds:850,  aov:2200, revenuePerClinic:7700, binauralRate:82, ifcTakeUp:65, hce:34, hceToSale:26, waxRemovals:28, hhc:50, hhcToHce:34 },
  ];
}

// ── COMPUTED METRICS ─────────────────────────────────────────
function compute(r) {
  const hceToSalePct = r.hce > 0 ? (r.hceToSale / r.hce) * 100 : 0;
  const waxToHhcPct  = r.hhc > 0 ? (r.waxRemovals / r.hhc) * 100 : 0;
  const hhcToHcePct  = r.hhc > 0 ? (r.hhcToHce / r.hhc) * 100 : 0;
  const netRevenue   = r.totalSales - (r.haRefunds || 0);
  return { ...r, hceToSalePct, waxToHhcPct, hhcToHcePct, netRevenue };
}
function computedData() { return data.map(compute); }

// ── FILTERS ──────────────────────────────────────────────────
function populateFilters() {
  const periods    = [...new Set(data.map(r => r.period))].sort((a,b) => periodSortKey(a) - periodSortKey(b));
  const performers = [...new Set(data.map(r => r.name))].sort();

  const pf = document.getElementById('period-filter');
  const nf = document.getElementById('performer-filter');
  const sv = pf.value, nv = nf.value;

  pf.innerHTML = '<option value="all">All Periods</option>' +
    periods.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  nf.innerHTML = '<option value="all">All Audiologists</option>' +
    performers.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');

  if (sv) pf.value = sv;
  if (nv) nf.value = nv;
}

function filteredData() {
  const period    = document.getElementById('period-filter').value;
  const performer = document.getElementById('performer-filter').value;
  return computedData().filter(r =>
    (period    === 'all' || r.period === period) &&
    (performer === 'all' || r.name   === performer)
  );
}

// ── VIEW ROUTING ─────────────────────────────────────────────
function setView(v) {
  currentView = v;
  document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-view="${v}"]`);
  if (btn) btn.classList.add('active');

  const titles = { overview:'Overview', insights:'Performance Insights', charts:'Charts & Analytics', rankings:'Rankings', conversions:'Conversion Funnels', table:'Data Table' };
  document.getElementById('page-title').textContent = titles[v] || v;

  destroyCharts();
  render();
}

function render() {
  populateFilters();
  const el = document.getElementById('main-content');
  const d  = filteredData();
  const views = { overview, insights, charts, rankings, conversions, table };
  el.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'view';
  el.appendChild(view);
  if (views[currentView]) views[currentView](view, d);
}

// ── OVERVIEW VIEW ────────────────────────────────────────────
function overview(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }

  const totals = aggregate(d);

  const kpis = [
    { label:'Net Revenue',          val: fmt.gbp(totals.netRevenue),         color:'var(--cyan)',   sub:`${d.length} records` },
    { label:'Total Sales',          val: fmt.gbp(totals.totalSales),         color:'var(--violet)', sub:'Gross' },
    { label:'HA Revenue',           val: fmt.gbp(totals.haRevenue),          color:'var(--cyan)',   sub:'Hearing aids' },
    { label:'Non-HA Revenue',       val: fmt.gbp(totals.nonHaRevenue),       color:'var(--green)',  sub:'Other services' },
    { label:'Wax Removal Rev.',     val: fmt.gbp(totals.waxRevenue),         color:'var(--amber)',  sub:'Wax services' },
    { label:'HA Refunds',           val: fmt.gbp(totals.haRefunds),          color:'var(--rose)',   sub:'Deducted' },
    { label:'Avg AOV',              val: fmt.gbp(avg(d,'aov')),              color:'var(--violet)', sub:'Per sale' },
    { label:'£ / Clinic',           val: fmt.gbp(avg(d,'revenuePerClinic')), color:'var(--cyan)',   sub:'Avg per clinic' },
    { label:'Binaural Rate',        val: fmt.pct(avg(d,'binauralRate')),     color:'var(--green)',  sub:'Avg' },
    { label:'IFC Take-Up',          val: fmt.pct(avg(d,'ifcTakeUp')),        color:'var(--violet)', sub:'Avg' },
    { label:"HCE's",                val: fmt.num(totals.hce),                color:'var(--cyan)',   sub:'Hearing Care Examinations' },
    { label:'HCE → Sale %',         val: fmt.pct(avg(d,'hceToSalePct')),    color:'var(--green)',  sub:'Avg conversion' },
    { label:'Wax Removals',         val: fmt.num(totals.waxRemovals),        color:'var(--amber)',  sub:'Total' },
    { label:'Wax → HHC %',          val: fmt.pct(avg(d,'waxToHhcPct')),     color:'var(--amber)',  sub:'Avg' },
    { label:"HHC's",                val: fmt.num(totals.hhc),                color:'var(--violet)', sub:'Health checks' },
    { label:'HHC → HCE %',          val: fmt.pct(avg(d,'hhcToHcePct')),     color:'var(--green)',  sub:'Avg' },
  ];

  const grid = document.createElement('div');
  grid.className = 'kpi-grid';
  kpis.forEach(k => {
    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.style.setProperty('--kpi-color', k.color);
    card.innerHTML = `<div class="kpi-label">${k.label}</div><div class="kpi-value accent">${k.val}</div><div class="kpi-sub">${k.sub}</div>`;
    grid.appendChild(card);
  });
  el.appendChild(grid);

  el.appendChild(sectionHeader('Revenue Trend by Period'));
  const chartRow = document.createElement('div');
  chartRow.className = 'chart-grid';
  chartRow.innerHTML = `
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">Net Revenue by Period</span></div>
      <div class="chart-body"><canvas id="ov-rev-period"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">Revenue by Audiologist</span></div>
      <div class="chart-body"><canvas id="ov-rev-performer"></canvas></div>
    </div>
  `;
  el.appendChild(chartRow);
  requestAnimationFrame(() => {
    buildChart('ov-rev-period',    periodChart(d));
    buildChart('ov-rev-performer', performerRevenueChart(d));
  });
}

// ── INSIGHTS VIEW ────────────────────────────────────────────
function insights(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }

  // ─ Build per-person aggregates ─
  const names = [...new Set(d.map(r => r.name))];
  const byPerson = {};
  names.forEach(n => {
    const rows = d.filter(r => r.name === n);
    byPerson[n] = {
      netRevenue:     rows.reduce((s,r) => s + r.netRevenue, 0),
      avgAov:         avg(rows, 'aov'),
      avgBinaural:    avg(rows, 'binauralRate'),
      avgIfc:         avg(rows, 'ifcTakeUp'),
      avgHceConv:     avg(rows, 'hceToSalePct'),
      avgHhcConv:     avg(rows, 'hhcToHcePct'),
      avgWaxConv:     avg(rows, 'waxToHhcPct'),
      avgRevClinic:   avg(rows, 'revenuePerClinic'),
      totalHce:       rows.reduce((s,r) => s + r.hce, 0),
      totalRefunds:   rows.reduce((s,r) => s + (r.haRefunds||0), 0),
      periods:        rows.length,
    };
  });

  // Team-level benchmarks
  const teamRevAvg    = avg(d, 'netRevenue');
  const teamBinaural  = avg(d, 'binauralRate');
  const teamIfc       = avg(d, 'ifcTakeUp');
  const teamHceConv   = avg(d, 'hceToSalePct');
  const maxRev        = Math.max(...names.map(n => byPerson[n].netRevenue));

  // ─ Overall composite score ─
  function compositeScore(n) {
    const p = byPerson[n];
    const revScore  = maxRev > 0 ? (p.netRevenue / maxRev) * 100 : 0;
    const binScore  = Math.min(p.avgBinaural, 100);
    const ifcScore  = Math.min(p.avgIfc, 100);
    const convScore = Math.min(p.avgHceConv, 100);
    return (revScore * 0.35 + binScore * 0.2 + ifcScore * 0.2 + convScore * 0.25);
  }

  const scored = names.map(n => ({ name: n, score: compositeScore(n) }))
    .sort((a,b) => b.score - a.score);
  const maxScore = scored[0]?.score || 100;

  // ─ Score colour ─
  function scoreColour(s) {
    if (s >= 80) return 'good';
    if (s >= 60) return 'warn';
    return 'bad';
  }
  function rankClass(i) {
    return i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  }

  // ─ Build improvement tips ─
  const tips = [];
  names.forEach(n => {
    const p = byPerson[n];
    if (p.avgBinaural < teamBinaural - 5)
      tips.push({ icon:'🎧', color:'cyan', name: n, title:`${n}: Binaural Rate Below Average`, desc:`Binaural rate of ${fmt.pct(p.avgBinaural)} vs team avg ${fmt.pct(teamBinaural)}. Focus on fitting bilateral recommendations and patient education on bilateral benefit.` });
    if (p.avgIfc < teamIfc - 5)
      tips.push({ icon:'📋', color:'violet', name: n, title:`${n}: IFC Take-Up Opportunity`, desc:`IFC take-up of ${fmt.pct(p.avgIfc)} vs team avg ${fmt.pct(teamIfc)}. Review finance presentation at the point of recommendation.` });
    if (p.avgHceConv < teamHceConv - 5)
      tips.push({ icon:'🔄', color:'amber', name: n, title:`${n}: HCE → Sale Conversion Weak`, desc:`Converting ${fmt.pct(p.avgHceConv)} of HCEs to sales vs team avg ${fmt.pct(teamHceConv)}. Consider needs-assessment and demonstration technique review.` });
    if (p.totalRefunds > 0 && (p.totalRefunds / p.netRevenue) > 0.05)
      tips.push({ icon:'⚠️', color:'rose', name: n, title:`${n}: Elevated Refund Rate`, desc:`Refunds represent ${fmt.pct((p.totalRefunds / (p.netRevenue + p.totalRefunds)) * 100)} of gross revenue. Review fitting quality and follow-up process.` });
  });

  if (!tips.length)
    tips.push({ icon:'✅', color:'green', name: 'All', title:'Team Performance on Track', desc:'No major underperformance flags across the current selection. Maintain momentum and continue monitoring conversion rates.' });

  // ─ RENDER ─
  el.appendChild(sectionHeader('Performance Intelligence', `${names.length} Audiologists`));

  const grid = document.createElement('div');
  grid.className = 'insights-grid';

  // Card 1: Composite Leaderboard
  const c1 = document.createElement('div');
  c1.className = 'insight-card';
  c1.innerHTML = `
    <div class="insight-header">
      <div class="insight-icon cyan">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
      </div>
      <div class="insight-header-text">
        <div class="insight-card-title">Overall Performer Ranking</div>
        <div class="insight-card-sub">Weighted composite: Revenue 35% · Binaural 20% · IFC 20% · HCE Conv 25%</div>
      </div>
    </div>
    <div class="insight-body">
      <div class="perf-list">
        ${scored.map((s, i) => {
          const col = scoreColour(s.score);
          return `
            <div class="perf-row">
              <div class="perf-row-top">
                <span class="perf-name"><span class="leader-rank ${rankClass(i)}" style="display:inline;margin-right:0.5rem;">#${i+1}</span>${esc(s.name)}</span>
                <span class="perf-score ${col}">${s.score.toFixed(1)}<span style="font-size:0.65rem;opacity:0.7">/100</span></span>
              </div>
              <div class="perf-bar-track">
                <div class="perf-bar-fill ${col}" style="width:${(s.score/maxScore)*100}%"></div>
              </div>
              <div class="perf-meta">${fmt.gbp(byPerson[s.name].netRevenue)} net revenue · ${fmt.pct(byPerson[s.name].avgBinaural)} binaural · ${fmt.pct(byPerson[s.name].avgHceConv)} HCE conv</div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
  grid.appendChild(c1);

  // Card 2: Revenue breakdown
  const c2 = document.createElement('div');
  c2.className = 'insight-card';
  const revRanked = names.map(n => ({ name:n, val:byPerson[n].netRevenue })).sort((a,b) => b.val - a.val);
  c2.innerHTML = `
    <div class="insight-header">
      <div class="insight-icon violet">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div class="insight-header-text">
        <div class="insight-card-title">Net Revenue by Audiologist</div>
        <div class="insight-card-sub">Total revenue minus HA refunds</div>
      </div>
    </div>
    <div class="insight-body">
      <div class="perf-list">
        ${revRanked.map((r,i) => `
          <div class="perf-row">
            <div class="perf-row-top">
              <span class="perf-name">${esc(r.name)}</span>
              <span class="perf-score great">${fmt.gbp(r.val)}</span>
            </div>
            <div class="perf-bar-track">
              <div class="perf-bar-fill violet" style="width:${(r.val/maxRev)*100}%"></div>
            </div>
            <div class="perf-meta">AOV ${fmt.gbp(byPerson[r.name].avgAov)} · £/Clinic ${fmt.gbp(byPerson[r.name].avgRevClinic)}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
  grid.appendChild(c2);

  // Card 3: Conversion Rates
  const c3 = document.createElement('div');
  c3.className = 'insight-card';
  c3.innerHTML = `
    <div class="insight-header">
      <div class="insight-icon green">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="insight-header-text">
        <div class="insight-card-title">HCE → Sale Conversion</div>
        <div class="insight-card-sub">Team avg: ${fmt.pct(teamHceConv)} — Target: 70%</div>
      </div>
    </div>
    <div class="insight-body">
      <div class="perf-list">
        ${names.map(n => {
          const val = byPerson[n].avgHceConv;
          const col = val >= 70 ? 'green' : val >= 55 ? 'amber' : 'rose';
          return `
            <div class="perf-row">
              <div class="perf-row-top">
                <span class="perf-name">${esc(n)}</span>
                <span class="perf-score ${col}">${fmt.pct(val)}</span>
              </div>
              <div class="perf-bar-track">
                <div class="perf-bar-fill ${col}" style="width:${Math.min(val,100)}%"></div>
              </div>
              <div class="perf-meta">${byPerson[n].totalHce} HCEs total</div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
  grid.appendChild(c3);

  // Card 4: Binaural & IFC rates
  const c4 = document.createElement('div');
  c4.className = 'insight-card';
  c4.innerHTML = `
    <div class="insight-header">
      <div class="insight-icon amber">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="insight-header-text">
        <div class="insight-card-title">Binaural Rate & IFC Take-Up</div>
        <div class="insight-card-sub">Team binaural avg: ${fmt.pct(teamBinaural)} · IFC avg: ${fmt.pct(teamIfc)}</div>
      </div>
    </div>
    <div class="insight-body">
      <div class="perf-list">
        ${names.map(n => {
          const bin = byPerson[n].avgBinaural;
          const ifc = byPerson[n].avgIfc;
          const binCol = bin >= 75 ? 'green' : bin >= 60 ? 'amber' : 'rose';
          const ifcCol = ifc >= 60 ? 'green' : ifc >= 45 ? 'amber' : 'rose';
          return `
            <div class="perf-row">
              <div class="perf-row-top">
                <span class="perf-name">${esc(n)}</span>
                <span style="display:flex;gap:0.5rem;">
                  <span class="perf-score ${binCol}" title="Binaural">${fmt.pct(bin)}</span>
                  <span style="color:var(--text-dim);font-size:0.7rem;align-self:center">IFC</span>
                  <span class="perf-score ${ifcCol}">${fmt.pct(ifc)}</span>
                </span>
              </div>
              <div class="perf-bar-track">
                <div class="perf-bar-fill ${binCol}" style="width:${Math.min(bin,100)}%"></div>
              </div>
              <div class="perf-meta">Binaural: ${fmt.pct(bin)} · IFC: ${fmt.pct(ifc)}</div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
  grid.appendChild(c4);

  el.appendChild(grid);

  // ─ Improvement Tips ─
  el.appendChild(sectionHeader('Improvement Opportunities', `${tips.length} flag${tips.length !== 1 ? 's' : ''}`));
  const tipContainer = document.createElement('div');
  tipContainer.className = 'insight-card insight-card--full';
  tipContainer.innerHTML = `
    <div class="insight-header">
      <div class="insight-icon rose">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="insight-header-text">
        <div class="insight-card-title">Coaching & Action Points</div>
        <div class="insight-card-sub">Auto-generated from current data selection — update records to refresh flags</div>
      </div>
    </div>
    <div class="insight-body">
      <div class="tip-list">
        ${tips.map(t => `
          <div class="tip-item">
            <div class="tip-icon" style="background:rgba(0,212,255,0.08)">${t.icon}</div>
            <div class="tip-text">
              <div class="tip-title">${esc(t.title)}</div>
              <div class="tip-desc">${esc(t.desc)}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  `;
  el.appendChild(tipContainer);

  // ─ Detailed comparison table ─
  el.appendChild(sectionHeader('Full Metric Comparison'));
  const tableCard = document.createElement('div');
  tableCard.className = 'card';
  tableCard.innerHTML = `
    <div class="table-wrap">
      <table class="leader-table">
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>Audiologist</th>
            <th>Net Revenue</th>
            <th>AOV</th>
            <th>£/Clinic</th>
            <th>Binaural %</th>
            <th>IFC %</th>
            <th>HCE Conv %</th>
            <th>HHC→HCE %</th>
            <th>Refunds</th>
          </tr>
        </thead>
        <tbody>
          ${scored.map((s, i) => {
            const p = byPerson[s.name];
            const tag = i === 0 ? '<span class="leader-tag top">Top</span>' : i === scored.length-1 ? '<span class="leader-tag bottom">Bottom</span>' : '<span class="leader-tag mid">Mid</span>';
            return `
              <tr>
                <td><span class="leader-rank ${rankClass(i)}">#${i+1}</span></td>
                <td class="leader-name">${esc(s.name)}${tag}</td>
                <td class="leader-val">${fmt.gbp(p.netRevenue)}</td>
                <td class="leader-val">${fmt.gbp(p.avgAov)}</td>
                <td class="leader-val">${fmt.gbp(p.avgRevClinic)}</td>
                <td><span class="badge badge-${p.avgBinaural>=75?'green':p.avgBinaural>=60?'amber':'rose'}">${fmt.pct(p.avgBinaural)}</span></td>
                <td><span class="badge badge-${p.avgIfc>=60?'green':p.avgIfc>=45?'amber':'rose'}">${fmt.pct(p.avgIfc)}</span></td>
                <td><span class="badge badge-${p.avgHceConv>=70?'green':p.avgHceConv>=55?'amber':'rose'}">${fmt.pct(p.avgHceConv)}</span></td>
                <td><span class="badge badge-${p.avgHhcConv>=65?'green':p.avgHhcConv>=50?'amber':'rose'}">${fmt.pct(p.avgHhcConv)}</span></td>
                <td class="mono" style="color:var(--rose)">${fmt.gbp(p.totalRefunds)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  el.appendChild(tableCard);
}

// ── CHARTS VIEW ──────────────────────────────────────────────
function charts(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }

  const grid = document.createElement('div');
  grid.className = 'chart-grid';
  grid.innerHTML = `
    <div class="chart-card">
      <div class="chart-header">
        <span class="chart-title">Net Revenue by Audiologist</span>
        <div class="chart-type-btns">
          <button class="chart-type-btn active" onclick="switchChart('ch-revenue','bar',this)">Bar</button>
          <button class="chart-type-btn" onclick="switchChart('ch-revenue','line',this)">Line</button>
        </div>
      </div>
      <div class="chart-body"><canvas id="ch-revenue"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">HCE (Hearing Care Exam) → Sale Conversion</span></div>
      <div class="chart-body"><canvas id="ch-hce-conv"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">HHC → HCE Conversion</span></div>
      <div class="chart-body"><canvas id="ch-hhc-conv"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">Revenue Split (avg per record)</span></div>
      <div class="chart-body"><canvas id="ch-split"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">Binaural Rate & IFC Take-Up (%)</span></div>
      <div class="chart-body"><canvas id="ch-rates"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">Wax Removals vs HHC's</span></div>
      <div class="chart-body"><canvas id="ch-wax"></canvas></div>
    </div>
  `;
  el.appendChild(grid);
  requestAnimationFrame(() => {
    buildChart('ch-revenue',  performerRevenueChart(d));
    buildChart('ch-hce-conv', conversionBarChart(d, 'hce', 'hceToSale', 'HCE to Sale', '#00d4ff'));
    buildChart('ch-hhc-conv', conversionBarChart(d, 'hhc', 'hhcToHce', 'HHC to HCE', '#a855f7'));
    buildChart('ch-split',    revenueSplitChart(d));
    buildChart('ch-rates',    ratesChart(d));
    buildChart('ch-wax',      waxChart(d));
  });
}

// ── RANKINGS VIEW ────────────────────────────────────────────
function rankings(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }

  el.appendChild(sectionHeader('Audiologist Rankings'));

  const grid = document.createElement('div');
  grid.className = 'rankings-grid';

  const rankConfigs = [
    { title:'Top Revenue',            key:'netRevenue',   fmt: fmt.gbp, label:'Net Revenue' },
    { title:'Top AOV',                key:'aov',          fmt: fmt.gbp, label:'Avg Order Value' },
    { title:'Best HCE → Sale %',      key:'hceToSalePct', fmt: fmt.pct, label:'Conversion Rate' },
    { title:'Best HHC → HCE %',       key:'hhcToHcePct',  fmt: fmt.pct, label:'Progression Rate' },
    { title:'Top Binaural Rate',       key:'binauralRate', fmt: fmt.pct, label:'Binaural %' },
    { title:'Best Wax → HHC %',       key:'waxToHhcPct',  fmt: fmt.pct, label:'Wax to HHC %' },
  ];

  rankConfigs.forEach(cfg => {
    const byPerformer = {};
    d.forEach(r => {
      if (!byPerformer[r.name]) byPerformer[r.name] = [];
      byPerformer[r.name].push(r[cfg.key] || 0);
    });
    const ranked = Object.entries(byPerformer)
      .map(([name, vals]) => ({ name, val: vals.reduce((a,b)=>a+b,0)/vals.length }))
      .sort((a,b) => b.val - a.val).slice(0,5);
    const max = ranked[0]?.val || 1;

    const card = document.createElement('div');
    card.className = 'rank-card';
    card.innerHTML = `
      <div class="rank-header">
        <span class="rank-title">${cfg.title}</span>
        <span class="section-pill">${cfg.label}</span>
      </div>
      <div class="rank-list">
        ${ranked.map((r, i) => `
          <div class="rank-row">
            <div class="rank-num ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">#${i+1}</div>
            <div><div class="rank-name">${esc(r.name)}</div></div>
            <div class="rank-val">${cfg.fmt(r.val)}</div>
            <div class="rank-bar-wrap"><div class="rank-bar" style="width:${(r.val/max)*100}%"></div></div>
          </div>`).join('')}
      </div>
    `;
    grid.appendChild(card);
  });
  el.appendChild(grid);

  el.appendChild(sectionHeader('Period Rankings'));
  const pgrid = document.createElement('div');
  pgrid.className = 'rankings-grid';

  const periodRankConfigs = [
    { title:'Best Period — Revenue',       key:'netRevenue',   fmt: fmt.gbp },
    { title:'Best Period — HCE → Sale %',  key:'hceToSalePct', fmt: fmt.pct },
  ];
  periodRankConfigs.forEach(cfg => {
    const byPeriod = {};
    d.forEach(r => {
      if (!byPeriod[r.period]) byPeriod[r.period] = [];
      byPeriod[r.period].push(r[cfg.key] || 0);
    });
    const ranked = Object.entries(byPeriod)
      .map(([period, vals]) => ({ name: period, val: vals.reduce((a,b)=>a+b,0) }))
      .sort((a,b) => b.val - a.val).slice(0,5);
    const max = ranked[0]?.val || 1;

    const card = document.createElement('div');
    card.className = 'rank-card';
    card.innerHTML = `
      <div class="rank-header"><span class="rank-title">${cfg.title}</span></div>
      <div class="rank-list">
        ${ranked.map((r, i) => `
          <div class="rank-row">
            <div class="rank-num ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">#${i+1}</div>
            <div><div class="rank-name">${esc(r.name)}</div></div>
            <div class="rank-val">${cfg.fmt(r.val)}</div>
            <div class="rank-bar-wrap"><div class="rank-bar" style="width:${(r.val/max)*100}%"></div></div>
          </div>`).join('')}
      </div>
    `;
    pgrid.appendChild(card);
  });
  el.appendChild(pgrid);
}

// ── CONVERSIONS VIEW ─────────────────────────────────────────
function conversions(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }

  el.appendChild(sectionHeader('Conversion Funnels by Audiologist'));

  const byPerformer = {};
  d.forEach(r => {
    if (!byPerformer[r.name]) byPerformer[r.name] = [];
    byPerformer[r.name].push(r);
  });

  const grid = document.createElement('div');
  grid.className = 'funnel-grid';

  Object.entries(byPerformer).forEach(([name, records]) => {
    const avgHhc       = avg(records,'hhc');
    const avgHce       = avg(records,'hce');
    const avgSales     = avg(records,'hceToSale');
    const avgWax       = avg(records,'waxRemovals');
    const hhcToHcePct  = avgHhc > 0 ? (avgHce / avgHhc) * 100 : 0;
    const hceToSalePct = avgHce > 0 ? (avgSales / avgHce) * 100 : 0;
    const waxToHhcPct  = avgHhc > 0 ? (avgWax  / avgHhc) * 100 : 0;
    const baseMax = Math.max(avgHhc, avgWax, 1);

    const card = document.createElement('div');
    card.className = 'funnel-card';
    card.innerHTML = `
      <div class="funnel-title">${esc(name)}</div>
      <div class="funnel-steps">
        <div class="funnel-step">
          <span class="funnel-step-label">HHC's</span>
          <div class="funnel-step-bar-wrap"><div class="funnel-step-bar" style="width:100%;background:var(--violet)"></div></div>
          <span class="funnel-step-val">${fmt.num(avgHhc)}</span>
        </div>
        <div class="funnel-step">
          <span class="funnel-step-label">Wax Rem.</span>
          <div class="funnel-step-bar-wrap"><div class="funnel-step-bar" style="width:${Math.min((avgWax/baseMax)*100,100)}%;background:var(--amber)"></div></div>
          <span class="funnel-step-val">${fmt.num(avgWax)}</span>
        </div>
        <div class="funnel-step">
          <span class="funnel-step-label">→ HCE</span>
          <div class="funnel-step-bar-wrap"><div class="funnel-step-bar" style="width:${Math.min(hhcToHcePct,100)}%;background:var(--cyan)"></div></div>
          <span class="funnel-step-val">${fmt.pct(hhcToHcePct)}</span>
        </div>
        <div class="funnel-step">
          <span class="funnel-step-label">HCE's</span>
          <div class="funnel-step-bar-wrap"><div class="funnel-step-bar" style="width:${Math.min((avgHce/baseMax)*100,100)}%;background:var(--cyan)"></div></div>
          <span class="funnel-step-val">${fmt.num(avgHce)}</span>
        </div>
        <div class="funnel-step">
          <span class="funnel-step-label">→ Sale</span>
          <div class="funnel-step-bar-wrap"><div class="funnel-step-bar" style="width:${Math.min(hceToSalePct,100)}%;background:var(--green)"></div></div>
          <span class="funnel-step-val">${fmt.pct(hceToSalePct)}</span>
        </div>
        <div class="funnel-step">
          <span class="funnel-step-label">Sales</span>
          <div class="funnel-step-bar-wrap"><div class="funnel-step-bar" style="width:${Math.min((avgSales/baseMax)*100,100)}%;background:var(--green)"></div></div>
          <span class="funnel-step-val">${fmt.num(avgSales)}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
  el.appendChild(grid);

  el.appendChild(sectionHeader('Conversion Rate Comparison'));
  const chartRow = document.createElement('div');
  chartRow.className = 'chart-grid';
  chartRow.innerHTML = `
    <div class="chart-card" style="grid-column:1/-1">
      <div class="chart-header"><span class="chart-title">HCE→Sale % vs HHC→HCE % by Audiologist</span></div>
      <div class="chart-body"><canvas id="cv-compare"></canvas></div>
    </div>
  `;
  el.appendChild(chartRow);
  requestAnimationFrame(() => buildChart('cv-compare', conversionCompareChart(d)));
}

// ── TABLE VIEW ───────────────────────────────────────────────
function table(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }

  const cols = [
    { key:'name',             label:'Audiologist',   type:'str' },
    { key:'period',           label:'Period',        type:'str' },
    { key:'totalSales',       label:'Total Sales',   type:'gbp' },
    { key:'haRevenue',        label:'HA Revenue',    type:'gbp' },
    { key:'nonHaRevenue',     label:'Non-HA Rev.',   type:'gbp' },
    { key:'waxRevenue',       label:'Wax Rev.',      type:'gbp' },
    { key:'haRefunds',        label:'Refunds',       type:'gbp' },
    { key:'netRevenue',       label:'Net Revenue',   type:'gbp' },
    { key:'aov',              label:'AOV',           type:'gbp' },
    { key:'revenuePerClinic', label:'£/Clinic',      type:'gbp' },
    { key:'binauralRate',     label:'Binaural %',    type:'pct' },
    { key:'ifcTakeUp',        label:'IFC %',         type:'pct' },
    { key:'hce',              label:"HCE's",         type:'num' },
    { key:'hceToSale',        label:'HCE→Sale',      type:'num' },
    { key:'hceToSalePct',     label:'HCE→Sale %',   type:'pct' },
    { key:'waxRemovals',      label:'Wax Rem.',      type:'num' },
    { key:'hhc',              label:"HHC's",         type:'num' },
    { key:'hhcToHce',         label:'HHC→HCE',      type:'num' },
    { key:'hhcToHcePct',      label:'HHC→HCE %',    type:'pct' },
    { key:'waxToHhcPct',      label:'Wax→HHC %',    type:'pct' },
  ];

  let sorted = [...d];
  if (sortCol) {
    sorted.sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
  }

  const wrap = document.createElement('div');
  wrap.className = 'card';
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';

  const fmtCell = (row, col) => {
    const v = row[col.key];
    if (v == null) return '—';
    if (col.type === 'gbp') return fmt.gbp(v);
    if (col.type === 'pct') return `<span class="badge badge-${v>=60?'green':v>=40?'amber':'rose'}">${fmt.pct(v)}</span>`;
    if (col.type === 'num') return fmt.num(v);
    return esc(v);
  };

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          ${cols.map(c => `<th class="${sortCol===c.key?'sorted':''}" onclick="tableSort('${c.key}')">${c.label}${sortCol===c.key?(sortAsc?' ↑':' ↓'):''}</th>`).join('')}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(row => {
          const realIndex = data.findIndex(r =>
            r.name === row.name && r.period === row.period && r.totalSales === row.totalSales
          );
          return `
            <tr>
              ${cols.map(c => `<td class="${['gbp','num','pct'].includes(c.type)?'mono':''}">${fmtCell(row,c)}</td>`).join('')}
              <td>
                <div class="td-actions">
                  <button class="td-btn" onclick="openEditModal(${realIndex})">Edit</button>
                  <button class="td-btn del" onclick="openDeleteModal(${realIndex})">Delete</button>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  wrap.appendChild(tableWrap);
  el.appendChild(wrap);
}

function tableSort(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  render();
}

// ── CHART BUILDERS ───────────────────────────────────────────
function buildChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
  chartInstances[id] = new Chart(canvas, config);
}
function destroyCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch{} });
  chartInstances = {};
}
function switchChart(id, type, btn) {
  const c = chartInstances[id];
  if (!c) return;
  c.config.type = type;
  c.update();
  btn.closest('.chart-type-btns').querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

const COLORS = ['#00d4ff','#a855f7','#10b981','#f59e0b','#f43f5e','#6366f1','#ec4899','#14b8a6'];

function chartDefaults() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    gridColor:  dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    textColor:  dark ? '#8a9dc0' : '#64748b',
    fontFamily: "'Space Mono', monospace",
  };
}

function baseChartOptions(extra = {}) {
  const { gridColor, textColor, fontFamily } = chartDefaults();
  return {
    responsive: true, maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: textColor, font: { family: fontFamily, size: 11 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: '#0d1422', borderColor: 'rgba(0,212,255,0.3)', borderWidth: 1,
        titleColor: '#e2eaf8', bodyColor: '#8a9dc0',
        titleFont: { family: fontFamily, size: 11 }, bodyFont: { family: fontFamily, size: 11 },
        ...extra.tooltip
      }
    },
    scales: {
      x: { ticks: { color: textColor, font: { family: fontFamily, size: 10 } }, grid: { color: gridColor } },
      y: { ticks: { color: textColor, font: { family: fontFamily, size: 10 } }, grid: { color: gridColor } },
      ...extra.scales
    },
    ...extra
  };
}

function periodChart(d) {
  const periods = [...new Set(d.map(r => r.period))].sort((a,b) => periodSortKey(a) - periodSortKey(b));
  const sums = periods.map(p => d.filter(r => r.period===p).reduce((s,r)=>s+r.netRevenue,0));
  return {
    type:'bar',
    data: { labels: periods, datasets: [{ label:'Net Revenue', data: sums, backgroundColor:'rgba(0,212,255,0.7)', borderColor:'#00d4ff', borderWidth:1, borderRadius:4 }] },
    options: { ...baseChartOptions(), plugins: { ...baseChartOptions().plugins, tooltip: { ...baseChartOptions().plugins.tooltip, callbacks: { label: ctx => '£' + ctx.parsed.y.toLocaleString() } } } }
  };
}

function performerRevenueChart(d) {
  const names = [...new Set(d.map(r => r.name))];
  const periods = [...new Set(d.map(r => r.period))].sort((a,b) => periodSortKey(a) - periodSortKey(b));
  const datasets = names.map((name, i) => ({
    label: name,
    data: periods.map(p => {
      const rows = d.filter(r => r.name===name && r.period===p);
      return rows.length ? rows.reduce((s,r)=>s+r.netRevenue,0) : null;
    }),
    backgroundColor: COLORS[i % COLORS.length] + '99',
    borderColor: COLORS[i % COLORS.length],
    borderWidth: 2, borderRadius: 4, tension: 0.35, fill: false,
  }));
  return { type:'bar', data: { labels: periods, datasets }, options: baseChartOptions() };
}

function conversionBarChart(d, fromKey, toKey, label, color) {
  const names = [...new Set(d.map(r => r.name))];
  const fromData = names.map(n => avg(d.filter(r=>r.name===n), fromKey));
  const toData   = names.map(n => avg(d.filter(r=>r.name===n), toKey));
  return {
    type:'bar',
    data: { labels: names, datasets: [
      { label: fromKey.toUpperCase()+"'s", data: fromData, backgroundColor: color+'55', borderColor: color, borderWidth:1, borderRadius:4 },
      { label: label, data: toData, backgroundColor: color+'99', borderColor: color, borderWidth:1, borderRadius:4 }
    ]},
    options: baseChartOptions()
  };
}

function revenueSplitChart(d) {
  const { textColor } = chartDefaults();
  return {
    type:'doughnut',
    data: {
      labels: ['HA Revenue','Non-HA Revenue','Wax Revenue'],
      datasets: [{ data: [avg(d,'haRevenue'), avg(d,'nonHaRevenue'), avg(d,'waxRevenue')],
        backgroundColor: ['rgba(0,212,255,0.75)','rgba(168,85,247,0.75)','rgba(245,158,11,0.75)'],
        borderColor: ['#00d4ff','#a855f7','#f59e0b'], borderWidth: 1 }]
    },
    options: { responsive:true, maintainAspectRatio:true,
      plugins: {
        legend: { labels: { color: textColor, font: { family:"'Space Mono',monospace", size:11 }, boxWidth:12 } },
        tooltip: { backgroundColor:'#0d1422', borderColor:'rgba(0,212,255,0.3)', borderWidth:1, titleColor:'#e2eaf8', bodyColor:'#8a9dc0', callbacks: { label: ctx => '£' + ctx.parsed.toLocaleString() } }
      }
    }
  };
}

function ratesChart(d) {
  const names = [...new Set(d.map(r => r.name))];
  return {
    type:'bar', data: { labels: names, datasets: [
      { label:'Binaural Rate %', data: names.map(n=>avg(d.filter(r=>r.name===n),'binauralRate')), backgroundColor:'rgba(16,185,129,0.7)', borderColor:'#10b981', borderWidth:1, borderRadius:4 },
      { label:'IFC Take-Up %',   data: names.map(n=>avg(d.filter(r=>r.name===n),'ifcTakeUp')),   backgroundColor:'rgba(168,85,247,0.7)', borderColor:'#a855f7', borderWidth:1, borderRadius:4 }
    ]},
    options: { ...baseChartOptions(), scales: { ...baseChartOptions().scales, y: { ...baseChartOptions().scales.y, max:100 } } }
  };
}

function waxChart(d) {
  const names = [...new Set(d.map(r => r.name))];
  return {
    type:'bar', data: { labels: names, datasets: [
      { label:'Wax Removals', data: names.map(n=>avg(d.filter(r=>r.name===n),'waxRemovals')), backgroundColor:'rgba(245,158,11,0.7)', borderColor:'#f59e0b', borderWidth:1, borderRadius:4 },
      { label:"HHC's",        data: names.map(n=>avg(d.filter(r=>r.name===n),'hhc')),         backgroundColor:'rgba(0,212,255,0.5)',   borderColor:'#00d4ff', borderWidth:1, borderRadius:4 }
    ]},
    options: baseChartOptions()
  };
}

function conversionCompareChart(d) {
  const names = [...new Set(d.map(r => r.name))];
  return {
    type:'bar', data: { labels: names, datasets: [
      { label:'HCE→Sale %', data: names.map(n=>avg(d.filter(r=>r.name===n),'hceToSalePct')), backgroundColor:'rgba(16,185,129,0.7)',  borderColor:'#10b981', borderWidth:1, borderRadius:4 },
      { label:'HHC→HCE %',  data: names.map(n=>avg(d.filter(r=>r.name===n),'hhcToHcePct')), backgroundColor:'rgba(0,212,255,0.7)',   borderColor:'#00d4ff', borderWidth:1, borderRadius:4 },
      { label:'Wax→HHC %',  data: names.map(n=>avg(d.filter(r=>r.name===n),'waxToHhcPct')), backgroundColor:'rgba(168,85,247,0.7)', borderColor:'#a855f7', borderWidth:1, borderRadius:4 }
    ]},
    options: { ...baseChartOptions(), scales: { ...baseChartOptions().scales, y: { ...baseChartOptions().scales.y, max:100 } } }
  };
}

// ── RECORD MODAL ─────────────────────────────────────────────
function openAddModal() {
  editIndex = null;
  document.getElementById('record-modal-title').textContent = 'Add Record';
  clearModalFields();
  document.getElementById('record-modal-overlay').classList.remove('hidden');
}

function openEditModal(i) {
  editIndex = i;
  document.getElementById('record-modal-title').textContent = 'Edit Record';
  const r = data[i];
  setField('m-name',             r.name             || '');
  // Set the period select — match "Period N" → "N" for the select value
  const periodNum = String(r.period || '').replace(/^Period\s*/i,'').trim();
  setField('m-period', periodNum || '');
  setField('m-totalSales',       r.totalSales       || '');
  setField('m-haRevenue',        r.haRevenue        || '');
  setField('m-nonHaRevenue',     r.nonHaRevenue     || '');
  setField('m-waxRevenue',       r.waxRevenue       || '');
  setField('m-haRefunds',        r.haRefunds        || '');
  setField('m-aov',              r.aov              || '');
  setField('m-revenuePerClinic', r.revenuePerClinic || '');
  setField('m-binauralRate',     r.binauralRate     || '');
  setField('m-ifcTakeUp',        r.ifcTakeUp        || '');
  setField('m-hce',              r.hce              || '');
  setField('m-hceToSale',        r.hceToSale        || '');
  setField('m-waxRemovals',      r.waxRemovals      || '');
  setField('m-hhc',              r.hhc              || '');
  setField('m-hhcToHce',         r.hhcToHce         || '');
  document.getElementById('record-modal-overlay').classList.remove('hidden');
}

function clearModalFields() {
  ['m-name','m-totalSales','m-haRevenue','m-nonHaRevenue','m-waxRevenue',
   'm-haRefunds','m-aov','m-revenuePerClinic','m-binauralRate','m-ifcTakeUp',
   'm-hce','m-hceToSale','m-waxRemovals','m-hhc','m-hhcToHce'].forEach(id => setField(id,''));
  setField('m-period', '');
}

function closeRecordModal(e) {
  if (e && e.target !== document.getElementById('record-modal-overlay')) return;
  document.getElementById('record-modal-overlay').classList.add('hidden');
}

function saveRecord() {
  const name = gv('m-name');
  if (!name) { showToast('Audiologist name is required', 'error'); return; }
  const periodRaw = gv('m-period');
  if (!periodRaw) { showToast('Please select a period', 'error'); return; }
  const period = `Period ${periodRaw}`;

  const record = {
    name, period,
    totalSales:       gn('m-totalSales'),
    haRevenue:        gn('m-haRevenue'),
    nonHaRevenue:     gn('m-nonHaRevenue'),
    waxRevenue:       gn('m-waxRevenue'),
    haRefunds:        gn('m-haRefunds'),
    aov:              gn('m-aov'),
    revenuePerClinic: gn('m-revenuePerClinic'),
    binauralRate:     gn('m-binauralRate'),
    ifcTakeUp:        gn('m-ifcTakeUp'),
    hce:              gn('m-hce'),
    hceToSale:        gn('m-hceToSale'),
    waxRemovals:      gn('m-waxRemovals'),
    hhc:              gn('m-hhc'),
    hhcToHce:         gn('m-hhcToHce'),
  };

  if (editIndex !== null) data[editIndex] = record;
  else data.push(record);

  saveLocal();
  populateFilters();
  destroyCharts();
  render();
  document.getElementById('record-modal-overlay').classList.add('hidden');
  showToast(editIndex !== null ? 'Record updated' : 'Record added', 'success');
  setSyncStatus('local');
}

// ── DELETE MODAL ─────────────────────────────────────────────
function openDeleteModal(i) {
  deleteIndex = i;
  document.getElementById('delete-modal-overlay').classList.remove('hidden');
}
function closeDeleteModal(e) {
  if (e && e.target !== document.getElementById('delete-modal-overlay')) return;
  document.getElementById('delete-modal-overlay').classList.add('hidden');
}
function confirmDelete() {
  data.splice(deleteIndex, 1);
  saveLocal();
  populateFilters();
  destroyCharts();
  render();
  closeDeleteModal();
  showToast('Record deleted', 'info');
  setSyncStatus('local');
}

// ── GOOGLE DRIVE ─────────────────────────────────────────────
function initGoogleApi() {
  const check = setInterval(() => {
    if (window.gapi && window.google?.accounts?.oauth2) {
      clearInterval(check);
      gapi.load('client', async () => {
        await gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] });
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: async (resp) => {
            if (resp.error) { showToast('Drive auth failed: ' + resp.error, 'error'); return; }
            accessToken = resp.access_token;
            driveReady = true;
            setDriveUI(true);
            showToast('Connected to Google Drive', 'success');
            await driveLoad();
          }
        });
        driveReady = false;
      });
    }
  }, 200);
}

function driveLogin() {
  if (!tokenClient) { showToast('Google API still loading, please wait…', 'info'); return; }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function ensureFileId() {
  const res = await gapi.client.drive.files.list({ q:`name='${FILE_NAME}' and trashed=false`, fields:'files(id)' });
  if (res.result.files.length) {
    driveFileId = res.result.files[0].id;
  } else {
    const created = await gapi.client.drive.files.create({ resource:{ name: FILE_NAME, mimeType:'application/json' }, fields:'id' });
    driveFileId = created.result.id;
    await uploadToDrive([]);
  }
}

async function driveLoad() {
  if (!accessToken) { showToast('Connect to Drive first', 'error'); return; }
  setSyncStatus('saving');
  try {
    await ensureFileId();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, { headers:{ Authorization:'Bearer '+accessToken } });
    const loaded = await res.json();
    if (Array.isArray(loaded) && loaded.length > 0) {
      data = loaded.map(r => ({ ...r, period: normalisePeriod(r.period) }));
      saveLocal(); populateFilters(); destroyCharts(); render();
      showToast(`Loaded ${data.length} records from Drive`, 'success');
    } else { showToast('Drive file is empty — local data kept', 'info'); }
    setSyncStatus('synced');
  } catch (e) { showToast('Failed to load from Drive: ' + e.message, 'error'); setSyncStatus('local'); }
}

async function driveSave() {
  if (!accessToken) { showToast('Connect to Drive first', 'error'); return; }
  setSyncStatus('saving');
  try {
    await ensureFileId();
    await uploadToDrive(data);
    showToast(`Saved ${data.length} records to Drive`, 'success');
    setSyncStatus('synced');
  } catch (e) { showToast('Failed to save: ' + e.message, 'error'); setSyncStatus('local'); }
}

async function uploadToDrive(payload) {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
    method:'PATCH', headers:{ Authorization:'Bearer '+accessToken, 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
}

function setDriveUI(connected) {
  document.getElementById('drive-dot').classList.toggle('connected', connected);
  document.getElementById('drive-status-text').textContent = connected ? 'Connected' : 'Not connected';
  document.getElementById('loginBtnLabel').textContent = connected ? 'Reconnect' : 'Connect Drive';
  document.getElementById('loadBtn').style.display = connected ? '' : 'none';
  document.getElementById('saveBtn').style.display = connected ? '' : 'none';
}

function setSyncStatus(state) {
  const dot   = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  if (!dot) return;
  dot.className = 'sync-dot';
  if (state === 'synced')      { dot.classList.add('synced'); label.textContent = 'Synced'; }
  else if (state === 'saving') { dot.classList.add('saving'); label.textContent = 'Syncing…'; }
  else                         { label.textContent = 'Local'; }
}

// ── SIDEBAR & THEME ──────────────────────────────────────────
let sidebarCollapsed = false;
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.querySelector('.main-wrapper');
  if (window.innerWidth <= 900) { sidebar.classList.toggle('mobile-open'); }
  else {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
    wrapper.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  }
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('audiocpd_bi_theme', next);
  destroyCharts(); render();
}
function loadTheme() {
  const saved = localStorage.getItem('audiocpd_bi_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── UI HELPERS ───────────────────────────────────────────────
function sectionHeader(title, pill) {
  const h = document.createElement('div');
  h.className = 'section-header';
  h.innerHTML = `<div class="section-title">${title}</div>${pill?`<span class="section-pill">${pill}</span>`:''}`;
  return h;
}

function emptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
    <h3>No data</h3>
    <p>Add your first record or adjust your filters to see data here.</p>
    <button class="empty-cta" onclick="openAddModal()">Add Record</button>
  `;
  return el;
}

// ── DATA HELPERS ─────────────────────────────────────────────
function aggregate(d) {
  const keys = ['totalSales','haRevenue','nonHaRevenue','waxRevenue','haRefunds','netRevenue','hce','hceToSale','waxRemovals','hhc','hhcToHce'];
  const sums = {};
  keys.forEach(k => sums[k] = d.reduce((s,r) => s+(r[k]||0), 0));
  return sums;
}
function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s,r) => s+(r[key]||0), 0) / arr.length;
}

// ── FORMATTERS ───────────────────────────────────────────────
const fmt = {
  gbp: v => '£' + (v||0).toLocaleString('en-GB', { minimumFractionDigits:0, maximumFractionDigits:0 }),
  pct: v => (v||0).toFixed(1) + '%',
  num: v => Math.round(v||0).toLocaleString(),
};

// ── DOM HELPERS ──────────────────────────────────────────────
function gv(id) { return (document.getElementById(id)?.value || '').trim(); }
function gn(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
function setField(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

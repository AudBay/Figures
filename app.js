/* ============================================================
   Raees BI — Application Logic
   - Periods 1-12 (numeric), Quarter/Half groupings
   - Rankings: SUM revenue, AVG percentages
   - Total Sales as #1 priority ranking
   - Refunds in rankings
   - waxToHhc editable field
   - HCE = Hearing Care Examination
   - Icon-only theme toggle
   - Particle network background
   ============================================================ */

'use strict';

const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES    = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "audiocpd-data.json";

let tokenClient  = null;
let accessToken  = null;
let driveFileId  = null;

let data        = [];
let currentView = 'overview';
let editIndex   = null;
let deleteIndex = null;
let sortCol     = null;
let sortAsc     = true;
let chartInstances = {};

const ALL_PERIODS = Array.from({length:12}, (_,i) => String(i+1));
function periodLabel(p) { return `Period ${p}`; }

function periodsInGroup(g) {
  if (g === 'all') return ALL_PERIODS;
  if (g === 'Q1')  return ['1','2','3'];
  if (g === 'Q2')  return ['4','5','6'];
  if (g === 'Q3')  return ['7','8','9'];
  if (g === 'Q4')  return ['10','11','12'];
  if (g === 'H1')  return ['1','2','3','4','5','6'];
  if (g === 'H2')  return ['7','8','9','10','11','12'];
  return [g];
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadLocal();
  buildPeriodFilter();
  populatePerformerFilter();
  render();
  loadTheme();
  initParticles();
  initGoogleApi();
});

// ── STORAGE ──────────────────────────────────────────────────
function loadLocal() {
  try { data = JSON.parse(localStorage.getItem('raees_bi_data')) || sampleData(); }
  catch { data = sampleData(); }
}
function saveLocal() { localStorage.setItem('raees_bi_data', JSON.stringify(data)); }

function sampleData() {
  return [
    { name:'Sarah Mitchell', period:'1', totalSales:42000, haRevenue:36000, nonHaRevenue:3500, waxRevenue:2500, haRefunds:1200, aov:1800, revenuePerClinic:6000, binauralRate:68, ifcTakeUp:55, hce:28, hceToSale:18, waxRemovals:22, waxToHhc:18, hhc:45, hhcToHce:28 },
    { name:'James Carter',   period:'1', totalSales:38500, haRevenue:32000, nonHaRevenue:3200, waxRevenue:3300, haRefunds:800,  aov:1600, revenuePerClinic:5500, binauralRate:72, ifcTakeUp:48, hce:30, hceToSale:19, waxRemovals:30, waxToHhc:25, hhc:50, hhcToHce:30 },
    { name:'Priya Sharma',   period:'1', totalSales:51000, haRevenue:44000, nonHaRevenue:4200, waxRevenue:2800, haRefunds:900,  aov:2100, revenuePerClinic:7300, binauralRate:80, ifcTakeUp:62, hce:32, hceToSale:24, waxRemovals:25, waxToHhc:20, hhc:48, hhcToHce:32 },
    { name:'Sarah Mitchell', period:'2', totalSales:45000, haRevenue:39000, nonHaRevenue:3000, waxRevenue:3000, haRefunds:1100, aov:1900, revenuePerClinic:6400, binauralRate:70, ifcTakeUp:58, hce:30, hceToSale:22, waxRemovals:27, waxToHhc:22, hhc:46, hhcToHce:30 },
    { name:'James Carter',   period:'2', totalSales:40000, haRevenue:34000, nonHaRevenue:3400, waxRevenue:2600, haRefunds:750,  aov:1700, revenuePerClinic:5700, binauralRate:75, ifcTakeUp:50, hce:31, hceToSale:21, waxRemovals:24, waxToHhc:20, hhc:52, hhcToHce:31 },
    { name:'Priya Sharma',   period:'2', totalSales:54000, haRevenue:47000, nonHaRevenue:4000, waxRevenue:3000, haRefunds:850,  aov:2200, revenuePerClinic:7700, binauralRate:82, ifcTakeUp:65, hce:34, hceToSale:26, waxRemovals:28, waxToHhc:23, hhc:50, hhcToHce:34 },
    { name:'Sarah Mitchell', period:'3', totalSales:47000, haRevenue:41000, nonHaRevenue:3200, waxRevenue:2800, haRefunds:1000, aov:1950, revenuePerClinic:6700, binauralRate:71, ifcTakeUp:60, hce:31, hceToSale:23, waxRemovals:28, waxToHhc:24, hhc:47, hhcToHce:31 },
    { name:'James Carter',   period:'3', totalSales:41500, haRevenue:35000, nonHaRevenue:3600, waxRevenue:2900, haRefunds:820,  aov:1750, revenuePerClinic:5900, binauralRate:74, ifcTakeUp:52, hce:32, hceToSale:22, waxRemovals:26, waxToHhc:21, hhc:53, hhcToHce:32 },
    { name:'Priya Sharma',   period:'3', totalSales:56000, haRevenue:49000, nonHaRevenue:4100, waxRevenue:2900, haRefunds:880,  aov:2250, revenuePerClinic:8000, binauralRate:83, ifcTakeUp:66, hce:35, hceToSale:27, waxRemovals:29, waxToHhc:24, hhc:51, hhcToHce:35 },
  ];
}

// ── COMPUTE ───────────────────────────────────────────────────
function compute(r) {
  const waxToHhcCount = r.waxToHhc != null ? r.waxToHhc : (r.waxRemovals || 0);
  return {
    ...r,
    hceToSalePct: r.hce  > 0 ? (r.hceToSale / r.hce) * 100 : 0,
    waxToHhcPct:  r.hhc  > 0 ? (waxToHhcCount / r.hhc) * 100 : 0,
    hhcToHcePct:  r.hhc  > 0 ? (r.hhcToHce   / r.hhc) * 100 : 0,
    netRevenue:   (r.totalSales||0) - (r.haRefunds||0),
    waxToHhc:     waxToHhcCount,
  };
}
function computedData() { return data.map(compute); }

// ── FILTERS ───────────────────────────────────────────────────
function buildPeriodFilter() {
  document.getElementById('period-filter').innerHTML = `
    <optgroup label="All"><option value="all">All Periods</option></optgroup>
    <optgroup label="Half Year">
      <option value="H1">H1 — Periods 1–6</option>
      <option value="H2">H2 — Periods 7–12</option>
    </optgroup>
    <optgroup label="Quarter">
      <option value="Q1">Q1 — Periods 1–3</option>
      <option value="Q2">Q2 — Periods 4–6</option>
      <option value="Q3">Q3 — Periods 7–9</option>
      <option value="Q4">Q4 — Periods 10–12</option>
    </optgroup>
    <optgroup label="Individual Period">
      ${ALL_PERIODS.map(p=>`<option value="${p}">${periodLabel(p)}</option>`).join('')}
    </optgroup>`;
}

function populatePerformerFilter() {
  const performers = [...new Set(data.map(r=>r.name))].sort();
  const nf = document.getElementById('performer-filter');
  const cur = nf.value;
  nf.innerHTML = '<option value="all">All Performers</option>' +
    performers.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  if (cur && cur !== 'all') nf.value = cur;
}

function filteredData() {
  const group     = document.getElementById('period-filter').value;
  const performer = document.getElementById('performer-filter').value;
  const periods   = periodsInGroup(group);
  return computedData().filter(r =>
    periods.includes(String(r.period)) &&
    (performer === 'all' || r.name === performer)
  );
}

// ── ROUTING ───────────────────────────────────────────────────
function setView(v) {
  currentView = v;
  document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-view="${v}"]`);
  if (btn) btn.classList.add('active');
  const titles = { overview:'Overview', charts:'Charts & Analytics', rankings:'Rankings', conversions:'Conversion Funnels', table:'Data Table' };
  document.getElementById('page-title').textContent = titles[v] || v;
  destroyCharts();
  render();
}

function render() {
  populatePerformerFilter();
  const el = document.getElementById('main-content');
  const d  = filteredData();
  el.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'view';
  el.appendChild(view);
  ({ overview, charts, rankings, conversions, table })[currentView]?.(view, d);
}

// ── OVERVIEW ──────────────────────────────────────────────────
function overview(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }
  const T = aggregate(d);
  const kpis = [
    { label:'Total Sales',      val:fmt.gbp(T.totalSales),        color:'var(--cyan)',   sub:'Gross revenue',     featured:true },
    { label:'Net Revenue',      val:fmt.gbp(T.netRevenue),        color:'var(--violet)', sub:'After refunds' },
    { label:'HA Revenue',       val:fmt.gbp(T.haRevenue),         color:'var(--cyan)',   sub:'Hearing aids' },
    { label:'Non-HA Revenue',   val:fmt.gbp(T.nonHaRevenue),      color:'var(--green)',  sub:'Other services' },
    { label:'Wax Removal Rev.', val:fmt.gbp(T.waxRevenue),        color:'var(--amber)',  sub:'Wax services' },
    { label:'HA Refunds',       val:fmt.gbp(T.haRefunds),         color:'var(--rose)',   sub:'Deducted' },
    { label:'Avg AOV',          val:fmt.gbp(avg(d,'aov')),        color:'var(--violet)', sub:'Per sale' },
    { label:'£ / Clinic',       val:fmt.gbp(avg(d,'revenuePerClinic')), color:'var(--cyan)', sub:'Avg per clinic' },
    { label:'Binaural Rate',    val:fmt.pct(avg(d,'binauralRate')),color:'var(--green)', sub:'Average' },
    { label:'IFC Take-Up',      val:fmt.pct(avg(d,'ifcTakeUp')),  color:'var(--violet)', sub:'Average' },
    { label:"HCE's",            val:fmt.num(T.hce),               color:'var(--cyan)',   sub:'Hearing Care Exams' },
    { label:'HCE → Sale %',     val:fmt.pct(avg(d,'hceToSalePct')), color:'var(--green)', sub:'Avg conversion' },
    { label:'Wax Removals',     val:fmt.num(T.waxRemovals),       color:'var(--amber)',  sub:'Total' },
    { label:'Wax → HHC %',      val:fmt.pct(avg(d,'waxToHhcPct')), color:'var(--amber)', sub:'Average' },
    { label:"HHC's",            val:fmt.num(T.hhc),               color:'var(--violet)', sub:'Health checks' },
    { label:'HHC → HCE %',      val:fmt.pct(avg(d,'hhcToHcePct')), color:'var(--green)', sub:'Average' },
  ];
  const grid = document.createElement('div');
  grid.className = 'kpi-grid';
  kpis.forEach((k, i) => {
    const c = document.createElement('div');
    c.className = 'kpi-card' + (k.featured ? ' kpi-featured' : '');
    c.style.setProperty('--kpi-color', k.color);
    c.style.animationDelay = `${i*40}ms`;
    c.innerHTML = `<div class="kpi-label">${k.label}</div><div class="kpi-value accent">${k.val}</div><div class="kpi-sub">${k.sub}</div>${k.featured?'<div class="kpi-pulse"></div>':''}`;
    grid.appendChild(c);
  });
  el.appendChild(grid);
  el.appendChild(sectionHeader('Revenue Trend by Period'));
  const cr = document.createElement('div');
  cr.className = 'chart-grid';
  cr.innerHTML = `
    <div class="chart-card"><div class="chart-header"><span class="chart-title">Total Sales by Period</span></div><div class="chart-body"><canvas id="ov-sales-period"></canvas></div></div>
    <div class="chart-card"><div class="chart-header"><span class="chart-title">Total Sales by Performer</span></div><div class="chart-body"><canvas id="ov-sales-performer"></canvas></div></div>`;
  el.appendChild(cr);
  requestAnimationFrame(() => {
    buildChart('ov-sales-period',    salesByPeriodChart(d));
    buildChart('ov-sales-performer', performerSalesChart(d));
  });
}

// ── CHARTS ────────────────────────────────────────────────────
function charts(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }
  const grid = document.createElement('div');
  grid.className = 'chart-grid';
  grid.innerHTML = `
    <div class="chart-card">
      <div class="chart-header"><span class="chart-title">Total Sales by Performer</span>
        <div class="chart-type-btns">
          <button class="chart-type-btn active" onclick="switchChart('ch-rev','bar',this)">Bar</button>
          <button class="chart-type-btn" onclick="switchChart('ch-rev','line',this)">Line</button>
        </div>
      </div><div class="chart-body"><canvas id="ch-rev"></canvas></div>
    </div>
    <div class="chart-card"><div class="chart-header"><span class="chart-title">Refunds by Performer</span></div><div class="chart-body"><canvas id="ch-refunds"></canvas></div></div>
    <div class="chart-card"><div class="chart-header"><span class="chart-title">HCE → Sale Conversion</span></div><div class="chart-body"><canvas id="ch-hce-conv"></canvas></div></div>
    <div class="chart-card"><div class="chart-header"><span class="chart-title">HHC → HCE Conversion</span></div><div class="chart-body"><canvas id="ch-hhc-conv"></canvas></div></div>
    <div class="chart-card"><div class="chart-header"><span class="chart-title">Revenue Split (avg per record)</span></div><div class="chart-body"><canvas id="ch-split"></canvas></div></div>
    <div class="chart-card"><div class="chart-header"><span class="chart-title">Binaural Rate & IFC Take-Up (%)</span></div><div class="chart-body"><canvas id="ch-rates"></canvas></div></div>
    <div class="chart-card"><div class="chart-header"><span class="chart-title">Wax Removals vs HHC's</span></div><div class="chart-body"><canvas id="ch-wax"></canvas></div></div>`;
  el.appendChild(grid);
  requestAnimationFrame(() => {
    buildChart('ch-rev',      performerSalesChart(d));
    buildChart('ch-refunds',  refundsChart(d));
    buildChart('ch-hce-conv', conversionBarChart(d,'hce','hceToSale','HCE→Sale','#00d4ff'));
    buildChart('ch-hhc-conv', conversionBarChart(d,'hhc','hhcToHce', 'HHC→HCE', '#a855f7'));
    buildChart('ch-split',    revenueSplitChart(d));
    buildChart('ch-rates',    ratesChart(d));
    buildChart('ch-wax',      waxChart(d));
  });
}

// ── RANKINGS ──────────────────────────────────────────────────
function rankings(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }

  // Aggregate per performer
  const byPerformer = {};
  d.forEach(r => { if(!byPerformer[r.name]) byPerformer[r.name]=[]; byPerformer[r.name].push(r); });
  const SUM_KEYS = ['totalSales','netRevenue','haRevenue','haRefunds','hce','hceToSale','waxRemovals','waxToHhc','hhc'];
  const AVG_KEYS = ['hceToSalePct','hhcToHcePct','waxToHhcPct','binauralRate','aov'];
  const perfAgg = Object.entries(byPerformer).map(([name,rows]) => {
    const a = { name };
    SUM_KEYS.forEach(k => a[k] = rows.reduce((s,r)=>s+(r[k]||0),0));
    AVG_KEYS.forEach(k => a[k] = rows.reduce((s,r)=>s+(r[k]||0),0)/rows.length);
    return a;
  });

  // Aggregate per period
  const byPeriod = {};
  d.forEach(r => { const p=String(r.period); if(!byPeriod[p]) byPeriod[p]=[]; byPeriod[p].push(r); });
  const periodAgg = Object.entries(byPeriod).map(([period,rows]) => {
    const a = { name: periodLabel(period) };
    SUM_KEYS.forEach(k => a[k] = rows.reduce((s,r)=>s+(r[k]||0),0));
    // For period HCE->Sale %, use AVERAGE (not sum) — correct metric for a period
    AVG_KEYS.forEach(k => a[k] = rows.reduce((s,r)=>s+(r[k]||0),0)/rows.length);
    return a;
  });

  // ── PRIORITY #1: Total Sales (featured hero card) ──
  const heroDiv = document.createElement('div');
  heroDiv.innerHTML = `<div class="rank-section-label">⭐ Priority Ranking</div>`;
  el.appendChild(heroDiv);
  const heroGrid = document.createElement('div');
  heroGrid.className = 'rankings-grid rankings-featured';
  heroGrid.appendChild(buildRankCard(perfAgg,'totalSales',fmt.gbp,'🏆 Total Sales Leaderboard','Primary KPI — Summed',true));
  el.appendChild(heroGrid);

  // ── PERFORMER RANKINGS ──
  el.appendChild(sectionHeader('Performer Rankings'));
  const pg = document.createElement('div');
  pg.className = 'rankings-grid';
  [
    { title:'Net Revenue',       key:'netRevenue',    fmt:fmt.gbp, label:'After Refunds — Summed' },
    { title:'HA Revenue',        key:'haRevenue',     fmt:fmt.gbp, label:'Hearing Aid Rev — Summed' },
    { title:'Refunds',           key:'haRefunds',     fmt:fmt.gbp, label:'Lower is better',  invert:true },
    { title:'Best HCE→Sale %',   key:'hceToSalePct',  fmt:fmt.pct, label:'Avg Conversion Rate' },
    { title:'Best HHC→HCE %',    key:'hhcToHcePct',   fmt:fmt.pct, label:'Avg Progression Rate' },
    { title:'Top Binaural Rate', key:'binauralRate',  fmt:fmt.pct, label:'Average %' },
    { title:'Best Wax→HHC %',    key:'waxToHhcPct',  fmt:fmt.pct, label:'Average %' },
    { title:'Top AOV',           key:'aov',           fmt:fmt.gbp, label:'Avg Order Value' },
  ].forEach(cfg => pg.appendChild(buildRankCard(perfAgg, cfg.key, cfg.fmt, cfg.title, cfg.label, false, cfg.invert)));
  el.appendChild(pg);

  // ── PERIOD RANKINGS ──
  el.appendChild(sectionHeader('Period Rankings'));
  const prg = document.createElement('div');
  prg.className = 'rankings-grid';
  [
    { title:'Best Period — Total Sales',  key:'totalSales',   fmt:fmt.gbp, label:'Summed across performers' },
    { title:'Best Period — Net Revenue',  key:'netRevenue',   fmt:fmt.gbp, label:'Summed across performers' },
    { title:'Best Period — HCE→Sale %',   key:'hceToSalePct', fmt:fmt.pct, label:'Averaged across performers' },
    { title:'Best Period — HHC→HCE %',    key:'hhcToHcePct',  fmt:fmt.pct, label:'Averaged across performers' },
    { title:'Highest Refunds Period',     key:'haRefunds',    fmt:fmt.gbp, label:'Watch closely', invert:true },
  ].forEach(cfg => prg.appendChild(buildRankCard(periodAgg, cfg.key, cfg.fmt, cfg.title, cfg.label, false, cfg.invert)));
  el.appendChild(prg);
}

function buildRankCard(aggData, key, fmtFn, title, label, featured=false, invert=false) {
  const sorted = [...aggData].sort((a,b) => invert ? (a[key]||0)-(b[key]||0) : (b[key]||0)-(a[key]||0)).slice(0,5);
  const max = Math.max(...sorted.map(r=>r[key]||0), 1);
  const medals = ['🥇','🥈','🥉'];
  const card = document.createElement('div');
  card.className = 'rank-card' + (featured ? ' rank-card--featured' : '');
  card.innerHTML = `
    <div class="rank-header">
      <span class="rank-title">${title}</span>
      <span class="section-pill">${label}</span>
    </div>
    <div class="rank-list">
      ${sorted.map((r,i)=>`
        <div class="rank-row rank-row--anim" style="animation-delay:${i*70}ms">
          <div class="rank-num ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i<3?medals[i]:`#${i+1}`}</div>
          <div class="rank-name-col"><div class="rank-name">${esc(r.name)}</div></div>
          <div class="rank-val ${invert&&i===0?'rank-val--warn':''}">${fmtFn(r[key]||0)}</div>
          <div class="rank-bar-wrap"><div class="rank-bar" style="width:${((r[key]||0)/max)*100}%;${invert?'background:var(--rose)':''}"></div></div>
        </div>`).join('')}
    </div>`;
  return card;
}

// ── CONVERSIONS ───────────────────────────────────────────────
function conversions(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }
  el.appendChild(sectionHeader('Conversion Funnels by Performer'));
  const byP = {};
  d.forEach(r=>{ if(!byP[r.name]) byP[r.name]=[]; byP[r.name].push(r); });
  const grid = document.createElement('div');
  grid.className = 'funnel-grid';
  Object.entries(byP).forEach(([name,rows])=>{
    const aHhc=avg(rows,'hhc'), aHce=avg(rows,'hce'), aSale=avg(rows,'hceToSale'), aWax=avg(rows,'waxRemovals');
    const hhcPct = aHhc>0?(aHce/aHhc)*100:0;
    const hcePct = aHce>0?(aSale/aHce)*100:0;
    const waxPct = aHhc>0?(aWax/aHhc)*100:0;
    const mx = Math.max(aHhc,aWax,1);
    const card = document.createElement('div');
    card.className = 'funnel-card';
    card.innerHTML = `
      <div class="funnel-title">${esc(name)}</div>
      <div class="funnel-steps">
        ${fStep("HHC's",    100,               aHhc,  'var(--violet)')}
        ${fStep('Wax Rem.', (aWax/mx)*100,     aWax,  'var(--amber)')}
        ${fStep('→HCE',     Math.min(hhcPct,100), fmt.pct(hhcPct), 'var(--cyan)', true)}
        ${fStep("HCE's",    (aHce/mx)*100,     aHce,  'var(--cyan)')}
        ${fStep('→ Sale',   Math.min(hcePct,100), fmt.pct(hcePct),'var(--green)',true)}
        ${fStep('Sales',    (aSale/mx)*100,    aSale, 'var(--green)')}
      </div>`;
    grid.appendChild(card);
  });
  el.appendChild(grid);
  el.appendChild(sectionHeader('Conversion Rate Comparison'));
  const cr = document.createElement('div');
  cr.className = 'chart-grid';
  cr.innerHTML = `<div class="chart-card" style="grid-column:1/-1"><div class="chart-header"><span class="chart-title">HCE→Sale % vs HHC→HCE % vs Wax→HHC %</span></div><div class="chart-body"><canvas id="cv-compare"></canvas></div></div>`;
  el.appendChild(cr);
  requestAnimationFrame(()=>buildChart('cv-compare',conversionCompareChart(d)));
}
function fStep(label,w,val,color,isPct=false){
  const display = isPct ? val : fmt.num(val);
  return `<div class="funnel-step"><span class="funnel-step-label">${label}</span><div class="funnel-step-bar-wrap"><div class="funnel-step-bar" style="width:${Math.min(w||0,100)}%;background:${color}"></div></div><span class="funnel-step-val">${display}</span></div>`;
}

// ── TABLE ─────────────────────────────────────────────────────
function table(el, d) {
  if (!d.length) { el.appendChild(emptyState()); return; }
  const cols = [
    {key:'name',label:'Audiologist',type:'str'},{key:'period',label:'Period',type:'period'},
    {key:'totalSales',label:'Total Sales',type:'gbp'},{key:'haRevenue',label:'HA Revenue',type:'gbp'},
    {key:'nonHaRevenue',label:'Non-HA Rev.',type:'gbp'},{key:'waxRevenue',label:'Wax Rev.',type:'gbp'},
    {key:'haRefunds',label:'Refunds',type:'gbp'},{key:'netRevenue',label:'Net Revenue',type:'gbp'},
    {key:'aov',label:'AOV',type:'gbp'},{key:'revenuePerClinic',label:'£/Clinic',type:'gbp'},
    {key:'binauralRate',label:'Binaural %',type:'pct'},{key:'ifcTakeUp',label:'IFC %',type:'pct'},
    {key:'hce',label:"HCE's",type:'num'},{key:'hceToSale',label:'HCE→Sale',type:'num'},
    {key:'hceToSalePct',label:'HCE→Sale %',type:'pct'},
    {key:'waxRemovals',label:'Wax Rem.',type:'num'},{key:'waxToHhc',label:'Wax→HHC',type:'num'},
    {key:'waxToHhcPct',label:'Wax→HHC %',type:'pct'},
    {key:'hhc',label:"HHC's",type:'num'},{key:'hhcToHce',label:'HHC→HCE',type:'num'},
    {key:'hhcToHcePct',label:'HHC→HCE %',type:'pct'},
  ];
  let sorted = [...d];
  if (sortCol) sorted.sort((a,b) => typeof a[sortCol]==='string' ? (sortAsc?a[sortCol].localeCompare(b[sortCol]):b[sortCol].localeCompare(a[sortCol])) : (sortAsc?(a[sortCol]||0)-(b[sortCol]||0):(b[sortCol]||0)-(a[sortCol]||0)));
  const fmtCell=(row,col)=>{
    const v=row[col.key];
    if(col.type==='period') return `<span class="badge badge-cyan">${periodLabel(v)}</span>`;
    if(v==null||v==='') return '—';
    if(col.type==='gbp') return fmt.gbp(v);
    if(col.type==='pct') return `<span class="badge badge-${v>=60?'green':v>=40?'amber':'rose'}">${fmt.pct(v)}</span>`;
    if(col.type==='num') return fmt.num(v);
    return esc(v);
  };
  const wrap=document.createElement('div'); wrap.className='card';
  const tw=document.createElement('div'); tw.className='table-wrap';
  tw.innerHTML=`<table><thead><tr>${cols.map(c=>`<th class="${sortCol===c.key?'sorted':''}" onclick="tableSort('${c.key}')">${c.label}${sortCol===c.key?(sortAsc?' ↑':' ↓'):''}</th>`).join('')}<th>Actions</th></tr></thead><tbody>
    ${sorted.map(row=>{
      const ri=data.findIndex(r=>r.name===row.name&&String(r.period)===String(row.period)&&r.totalSales===row.totalSales&&r.haRevenue===row.haRevenue);
      return `<tr>${cols.map(c=>`<td class="${['gbp','num','pct'].includes(c.type)?'mono':''}">${fmtCell(row,c)}</td>`).join('')}<td><div class="td-actions">
        <button class="td-btn" onclick="openEditModal(${ri})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
        <button class="td-btn del" onclick="openDeleteModal(${ri})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Delete</button>
      </div></td></tr>`;
    }).join('')}</tbody></table>`;
  wrap.appendChild(tw); el.appendChild(wrap);
}
function tableSort(col) { sortCol===col ? sortAsc=!sortAsc : (sortCol=col,sortAsc=true); render(); }

// ── CHARTS ────────────────────────────────────────────────────
function buildChart(id,config){
  const c=document.getElementById(id); if(!c) return;
  if(chartInstances[id]){chartInstances[id].destroy();delete chartInstances[id];}
  chartInstances[id]=new Chart(c,config);
}
function destroyCharts(){Object.values(chartInstances).forEach(c=>{try{c.destroy();}catch{}});chartInstances={};}
function switchChart(id,type,btn){
  const c=chartInstances[id]; if(!c) return;
  c.config.type=type; c.update();
  btn.closest('.chart-type-btns').querySelectorAll('.chart-type-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

const COLORS=['#00d4ff','#a855f7','#10b981','#f59e0b','#f43f5e','#6366f1','#ec4899','#14b8a6'];

function chartDefaults(){
  const dark=document.documentElement.getAttribute('data-theme')!=='light';
  return { gridColor:dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)', textColor:dark?'#8a9dc0':'#64748b',
    tooltipBg:dark?'#0d1422':'#ffffff', tooltipBorder:dark?'rgba(0,212,255,0.3)':'rgba(99,102,241,0.3)', fontFamily:"'Space Mono',monospace" };
}

function baseOpts(extra={}){
  const {gridColor,textColor,tooltipBg,tooltipBorder,fontFamily}=chartDefaults();
  return { responsive:true, maintainAspectRatio:true, animation:{duration:700,easing:'easeOutQuart'},
    plugins:{ legend:{labels:{color:textColor,font:{family:fontFamily,size:11},boxWidth:12,padding:16}},
      tooltip:{backgroundColor:tooltipBg,borderColor:tooltipBorder,borderWidth:1,titleColor:textColor,bodyColor:textColor,padding:10,titleFont:{family:fontFamily,size:11},bodyFont:{family:fontFamily,size:11},...(extra.tooltip||{})} },
    scales:{ x:{ticks:{color:textColor,font:{family:fontFamily,size:10}},grid:{color:gridColor}}, y:{ticks:{color:textColor,font:{family:fontFamily,size:10}},grid:{color:gridColor}} , ...(extra.scales||{}) },
    ...Object.fromEntries(Object.entries(extra).filter(([k])=>!['tooltip','scales'].includes(k))) };
}

function salesByPeriodChart(d){
  const ps=[...new Set(d.map(r=>String(r.period)))].sort((a,b)=>+a-+b);
  return {type:'bar',data:{labels:ps.map(periodLabel),datasets:[{label:'Total Sales',data:ps.map(p=>d.filter(r=>String(r.period)===p).reduce((s,r)=>s+r.totalSales,0)),backgroundColor:'rgba(0,212,255,0.6)',borderColor:'#00d4ff',borderWidth:1,borderRadius:6}]},options:baseOpts({plugins:{...baseOpts().plugins,tooltip:{callbacks:{label:ctx=>'£'+ctx.parsed.y.toLocaleString()}}}})};
}
function performerSalesChart(d){
  const names=[...new Set(d.map(r=>r.name))];
  const periods=[...new Set(d.map(r=>String(r.period)))].sort((a,b)=>+a-+b);
  const ds=names.map((n,i)=>({label:n,data:periods.map(p=>{const rows=d.filter(r=>r.name===n&&String(r.period)===p);return rows.length?rows.reduce((s,r)=>s+r.totalSales,0):null;}),backgroundColor:COLORS[i%COLORS.length]+'99',borderColor:COLORS[i%COLORS.length],borderWidth:2,borderRadius:4,tension:0.35,fill:false}));
  return {type:'bar',data:{labels:periods.map(periodLabel),datasets:ds},options:baseOpts()};
}
function conversionBarChart(d,fk,tk,label,color){
  const names=[...new Set(d.map(r=>r.name))];
  return {type:'bar',data:{labels:names,datasets:[{label:fk.toUpperCase()+"'s",data:names.map(n=>avg(d.filter(r=>r.name===n),fk)),backgroundColor:color+'44',borderColor:color,borderWidth:1,borderRadius:4},{label,data:names.map(n=>avg(d.filter(r=>r.name===n),tk)),backgroundColor:color+'99',borderColor:color,borderWidth:1,borderRadius:4}]},options:baseOpts()};
}
function revenueSplitChart(d){
  const {textColor,tooltipBg,tooltipBorder}=chartDefaults();
  return {type:'doughnut',data:{labels:['HA Revenue','Non-HA Revenue','Wax Revenue'],datasets:[{data:[avg(d,'haRevenue'),avg(d,'nonHaRevenue'),avg(d,'waxRevenue')],backgroundColor:['rgba(0,212,255,0.75)','rgba(168,85,247,0.75)','rgba(245,158,11,0.75)'],borderColor:['#00d4ff','#a855f7','#f59e0b'],borderWidth:2,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:true,animation:{duration:700,easing:'easeOutQuart'},plugins:{legend:{labels:{color:textColor,font:{family:"'Space Mono',monospace",size:11},boxWidth:12}},tooltip:{backgroundColor:tooltipBg,borderColor:tooltipBorder,borderWidth:1,callbacks:{label:ctx=>'£'+ctx.parsed.toLocaleString()}}}}};
}
function ratesChart(d){
  const names=[...new Set(d.map(r=>r.name))];
  return {type:'bar',data:{labels:names,datasets:[{label:'Binaural Rate %',data:names.map(n=>avg(d.filter(r=>r.name===n),'binauralRate')),backgroundColor:'rgba(16,185,129,0.7)',borderColor:'#10b981',borderWidth:1,borderRadius:4},{label:'IFC Take-Up %',data:names.map(n=>avg(d.filter(r=>r.name===n),'ifcTakeUp')),backgroundColor:'rgba(168,85,247,0.7)',borderColor:'#a855f7',borderWidth:1,borderRadius:4}]},options:{...baseOpts(),scales:{...baseOpts().scales,y:{...baseOpts().scales.y,max:100}}}};
}
function waxChart(d){
  const names=[...new Set(d.map(r=>r.name))];
  return {type:'bar',data:{labels:names,datasets:[{label:'Wax Removals',data:names.map(n=>avg(d.filter(r=>r.name===n),'waxRemovals')),backgroundColor:'rgba(245,158,11,0.7)',borderColor:'#f59e0b',borderWidth:1,borderRadius:4},{label:"HHC's",data:names.map(n=>avg(d.filter(r=>r.name===n),'hhc')),backgroundColor:'rgba(0,212,255,0.5)',borderColor:'#00d4ff',borderWidth:1,borderRadius:4}]},options:baseOpts()};
}
function refundsChart(d){
  const names=[...new Set(d.map(r=>r.name))];
  return {type:'bar',data:{labels:names,datasets:[{label:'HA Refunds (£)',data:names.map(n=>d.filter(r=>r.name===n).reduce((s,r)=>s+(r.haRefunds||0),0)),backgroundColor:'rgba(244,63,94,0.65)',borderColor:'#f43f5e',borderWidth:1,borderRadius:4}]},options:baseOpts({plugins:{...baseOpts().plugins,tooltip:{callbacks:{label:ctx=>'£'+ctx.parsed.y.toLocaleString()}}}})};
}
function conversionCompareChart(d){
  const names=[...new Set(d.map(r=>r.name))];
  return {type:'bar',data:{labels:names,datasets:[{label:'HCE→Sale %',data:names.map(n=>avg(d.filter(r=>r.name===n),'hceToSalePct')),backgroundColor:'rgba(16,185,129,0.7)',borderColor:'#10b981',borderWidth:1,borderRadius:4},{label:'HHC→HCE %',data:names.map(n=>avg(d.filter(r=>r.name===n),'hhcToHcePct')),backgroundColor:'rgba(0,212,255,0.7)',borderColor:'#00d4ff',borderWidth:1,borderRadius:4},{label:'Wax→HHC %',data:names.map(n=>avg(d.filter(r=>r.name===n),'waxToHhcPct')),backgroundColor:'rgba(168,85,247,0.7)',borderColor:'#a855f7',borderWidth:1,borderRadius:4}]},options:{...baseOpts(),scales:{...baseOpts().scales,y:{...baseOpts().scales.y,max:100}}}};
}

// ── RECORD MODAL ──────────────────────────────────────────────
function openAddModal(){editIndex=null;document.getElementById('record-modal-title').textContent='Add Record';clearModalFields();document.getElementById('record-modal-overlay').classList.remove('hidden');}
function openEditModal(i){
  if(i<0||i>=data.length){showToast('Record not found','error');return;}
  editIndex=i;
  document.getElementById('record-modal-title').textContent='Edit Record';
  const r=data[i];
  const fields={name:r.name,period:String(r.period),totalSales:r.totalSales,haRevenue:r.haRevenue,nonHaRevenue:r.nonHaRevenue,waxRevenue:r.waxRevenue,haRefunds:r.haRefunds,aov:r.aov,revenuePerClinic:r.revenuePerClinic,binauralRate:r.binauralRate,ifcTakeUp:r.ifcTakeUp,hce:r.hce,hceToSale:r.hceToSale,waxRemovals:r.waxRemovals,waxToHhc:r.waxToHhc,hhc:r.hhc,hhcToHce:r.hhcToHce};
  Object.entries(fields).forEach(([k,v])=>setField('m-'+k,v||''));
  document.getElementById('record-modal-overlay').classList.remove('hidden');
}
function clearModalFields(){['name','period','totalSales','haRevenue','nonHaRevenue','waxRevenue','haRefunds','aov','revenuePerClinic','binauralRate','ifcTakeUp','hce','hceToSale','waxRemovals','waxToHhc','hhc','hhcToHce'].forEach(k=>setField('m-'+k,''));}
function closeRecordModal(e){if(e&&e.target!==document.getElementById('record-modal-overlay'))return;document.getElementById('record-modal-overlay').classList.add('hidden');}
function saveRecord(){
  const name=gv('m-name'); if(!name){showToast('Audiologist name is required','error');return;}
  const period=gv('m-period'); if(!period){showToast('Please select a period','error');return;}
  const r={name,period,totalSales:gn('m-totalSales'),haRevenue:gn('m-haRevenue'),nonHaRevenue:gn('m-nonHaRevenue'),waxRevenue:gn('m-waxRevenue'),haRefunds:gn('m-haRefunds'),aov:gn('m-aov'),revenuePerClinic:gn('m-revenuePerClinic'),binauralRate:gn('m-binauralRate'),ifcTakeUp:gn('m-ifcTakeUp'),hce:gn('m-hce'),hceToSale:gn('m-hceToSale'),waxRemovals:gn('m-waxRemovals'),waxToHhc:gn('m-waxToHhc'),hhc:gn('m-hhc'),hhcToHce:gn('m-hhcToHce')};
  if(editIndex!==null)data[editIndex]=r; else data.push(r);
  saveLocal();populatePerformerFilter();destroyCharts();render();
  document.getElementById('record-modal-overlay').classList.add('hidden');
  showToast(editIndex!==null?'Record updated ✓':'Record added ✓','success');setSyncStatus('local');
}

// ── DELETE MODAL ──────────────────────────────────────────────
function openDeleteModal(i){deleteIndex=i;document.getElementById('delete-modal-overlay').classList.remove('hidden');}
function closeDeleteModal(e){if(e&&e.target!==document.getElementById('delete-modal-overlay'))return;document.getElementById('delete-modal-overlay').classList.add('hidden');}
function confirmDelete(){data.splice(deleteIndex,1);saveLocal();populatePerformerFilter();destroyCharts();render();document.getElementById('delete-modal-overlay').classList.add('hidden');showToast('Record deleted','info');setSyncStatus('local');}

// ── GOOGLE DRIVE ──────────────────────────────────────────────
function initGoogleApi(){
  const check=setInterval(()=>{
    if(window.gapi&&window.google?.accounts?.oauth2){
      clearInterval(check);
      gapi.load('client',async()=>{
        await gapi.client.init({discoveryDocs:['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']});
        tokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPES,callback:async resp=>{
          if(resp.error){showToast('Drive auth failed: '+resp.error,'error');return;}
          accessToken=resp.access_token;setDriveUI(true);showToast('Connected to Google Drive ✓','success');await driveLoad();
        }});
      });
    }
  },200);
}
function driveLogin(){if(!tokenClient){showToast('Google API loading…','info');return;}tokenClient.requestAccessToken({prompt:'consent'});}
async function ensureFileId(){
  const res=await gapi.client.drive.files.list({q:`name='${FILE_NAME}' and trashed=false`,fields:'files(id)'});
  if(res.result.files.length){driveFileId=res.result.files[0].id;}
  else{const c=await gapi.client.drive.files.create({resource:{name:FILE_NAME,mimeType:'application/json'},fields:'id'});driveFileId=c.result.id;await uploadToDrive([]);}
}
async function driveLoad(){
  if(!accessToken){showToast('Connect to Drive first','error');return;}setSyncStatus('saving');
  try{await ensureFileId();const res=await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,{headers:{Authorization:'Bearer '+accessToken}});const loaded=await res.json();
    if(Array.isArray(loaded)&&loaded.length>0){data=loaded;saveLocal();populatePerformerFilter();destroyCharts();render();showToast(`Loaded ${data.length} records from Drive ✓`,'success');}
    else{showToast('Drive file empty — local data kept','info');}setSyncStatus('synced');
  }catch(e){showToast('Load failed: '+e.message,'error');setSyncStatus('local');}
}
async function driveSave(){
  if(!accessToken){showToast('Connect to Drive first','error');return;}setSyncStatus('saving');
  try{await ensureFileId();await uploadToDrive(data);showToast(`Saved ${data.length} records to Drive ✓`,'success');setSyncStatus('synced');}
  catch(e){showToast('Save failed: '+e.message,'error');setSyncStatus('local');}
}
async function uploadToDrive(payload){
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,{method:'PATCH',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
function setDriveUI(connected){
  document.getElementById('drive-dot').classList.toggle('connected',connected);
  document.getElementById('drive-status-text').textContent=connected?'Connected':'Not connected';
  document.getElementById('loginBtnLabel').textContent=connected?'Reconnect':'Connect Drive';
  document.getElementById('loadBtn').style.display=connected?'':'none';
  document.getElementById('saveBtn').style.display=connected?'':'none';
}
function setSyncStatus(state){
  const dot=document.getElementById('sync-dot'),label=document.getElementById('sync-label');
  if(!dot)return; dot.className='sync-dot';
  if(state==='synced'){dot.classList.add('synced');label.textContent='Synced';}
  else if(state==='saving'){dot.classList.add('saving');label.textContent='Syncing…';}
  else{label.textContent='Local';}
}

// ── SIDEBAR ───────────────────────────────────────────────────
let sidebarCollapsed=false;
function toggleSidebar(){
  const s=document.getElementById('sidebar'),w=document.querySelector('.main-wrapper');
  if(window.innerWidth<=900){s.classList.toggle('mobile-open');}
  else{sidebarCollapsed=!sidebarCollapsed;s.classList.toggle('collapsed',sidebarCollapsed);w.classList.toggle('sidebar-collapsed',sidebarCollapsed);}
}

// ── THEME ─────────────────────────────────────────────────────
function toggleTheme(){
  const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('raees_bi_theme',next);
  destroyCharts();render();
}
function loadTheme(){
  const saved=localStorage.getItem('raees_bi_theme');
  if(saved)document.documentElement.setAttribute('data-theme',saved);
}

// ── PARTICLES ─────────────────────────────────────────────────
function initParticles(){
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.3;';
  document.body.prepend(canvas);
  const ctx=canvas.getContext('2d');
  let W,H;
  const resize=()=>{W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;};
  resize(); window.addEventListener('resize',resize);
  const pts=Array.from({length:55},()=>({x:Math.random()*1920,y:Math.random()*1080,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28,r:Math.random()*1.4+.5,a:Math.random()*.45+.1}));
  const isDark=()=>document.documentElement.getAttribute('data-theme')!=='light';
  (function draw(){
    ctx.clearRect(0,0,W,H);
    const col=isDark()?'0,212,255':'99,102,241';
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=W; if(p.x>W)p.x=0;
      if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${col},${p.a})`; ctx.fill();
    });
    pts.forEach((a,i)=>pts.slice(i+1).forEach(b=>{
      const dx=a.x-b.x,dy=a.y-b.y,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<110){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(${col},${.1*(1-dist/110)})`;ctx.lineWidth=.5;ctx.stroke();}
    }));
    requestAnimationFrame(draw);
  })();
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg,type='info'){
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`toast ${type} show`;
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),3500);
}

// ── HELPERS ───────────────────────────────────────────────────
function sectionHeader(title,pill){
  const h=document.createElement('div');h.className='section-header';
  h.innerHTML=`<div class="section-title">${title}</div>${pill?`<span class="section-pill">${pill}</span>`:''}`;return h;
}
function emptyState(){
  const el=document.createElement('div');el.className='empty-state';
  el.innerHTML=`<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg><h3>No data</h3><p>Add your first record or adjust your filters.</p><button class="empty-cta" onclick="openAddModal()">Add Record</button>`;
  return el;
}
function aggregate(d){
  const keys=['totalSales','haRevenue','nonHaRevenue','waxRevenue','haRefunds','netRevenue','hce','hceToSale','waxRemovals','waxToHhc','hhc','hhcToHce'];
  const s={};keys.forEach(k=>s[k]=d.reduce((a,r)=>a+(r[k]||0),0));return s;
}
function avg(arr,key){if(!arr.length)return 0;return arr.reduce((s,r)=>s+(r[key]||0),0)/arr.length;}
const fmt={
  gbp:v=>'£'+(v||0).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0}),
  pct:v=>(v||0).toFixed(1)+'%',
  num:v=>Math.round(v||0).toLocaleString(),
};
function gv(id){return(document.getElementById(id)?.value||'').trim();}
function gn(id){return parseFloat(document.getElementById(id)?.value)||0;}
function setField(id,v){const el=document.getElementById(id);if(el)el.value=v;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

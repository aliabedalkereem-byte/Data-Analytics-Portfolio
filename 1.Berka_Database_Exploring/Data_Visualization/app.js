/* ==========================================================================
   app.js  -  The LOGIC

   The whole idea:      the big table(data)  ->  a question (filter)  ->  an answer (card)

   Use Ctrl+F with the section numbers below to jump.
     1. SETTINGS         names, colours, labels you may want to edit
     2. SMALL TOOLS      number formats, months, hover box
     3. THE TABLE        ACCOUNTS (one row per account) + how numbers are calculated
     4. FILTERS          what is selected right now, and which accounts pass
     5. DRAWING TOOLS    bars, donut, loan bar, line chart (they only draw)
     6. OVERVIEW CARDS   one block per card:  accounts -> numbers -> named part
     7. ACCOUNT CARDS    same idea for the Single account page
     8. START-UP         connect the buttons and draw the first screen

   The data lives in data.js (ACCOUNTS, REGIONS) and balances.js (BALANCES).
   ========================================================================== */



/* ==========================================================================
   1. SETTINGS
   ========================================================================== */
const CONFIG = {
  currency: 'Kč',

  /* donut slice colours, dark to light */
  palette: ['#111111', '#3a3a3a', '#6b6b6b', '#9d9d9d', '#cfcfcf'],

  ageGroups:  ['16-24', '25-34', '35-44', '45-59', '60+'],
  orderTypes: ['Utility', 'Other', 'Loan', 'Insurance', 'Leasing'],

  /* loan status codes: label and colour in the loans bar */
  loanStatus: [
    { code: 'A', label: 'Finished, paid OK', color: '#6b6b6b' },
    { code: 'B', label: 'Finished, unpaid',  color: '#b3402f' },
    { code: 'C', label: 'Running, OK',       color: '#cfcfcf' },
    { code: 'D', label: 'Running, in debt',  color: '#c9a227' },
  ],
  activeLoanCodes: ['C', 'D'],                 /* "active now" = loans with these statuses */

  /* an account "has" an income source when its column is above zero */
  incomeSources: [
    { key: 'deposit', label: 'Deposits', column: 'depAvg'  },   /* Deposit_Monthly_Average */
    { key: 'salary',  label: 'Salary',   column: 'salary'  },   /* Base_Salary             */
    { key: 'pension', label: 'Pension',  column: 'pension' },   /* Pension                 */
  ],
};



/* ==========================================================================
   2. SMALL TOOLS
   ========================================================================== */
const $ = (selector, root = document) => root.querySelector(selector);          /* $('#fees-total') = the part named fees-total */
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function el(html) {                                                              /* one page element from HTML text */
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

/* numbers */
const fmt = n => Math.round(n).toLocaleString('en-US');                          /* 12345 -> "12,345"      */
const kc  = n => `${fmt(n)} ${CONFIG.currency}`;                                 /* 12345 -> "12,345 Kč"   */
const pc  = (part, whole, digits = 1) => `${(whole ? (part / whole) * 100 : 0).toFixed(digits)}%`;   /* (1,4) -> "25.0%" */
const cap = text => text.replace(/\b\w/g, c => c.toUpperCase());                 /* "south bohemia" -> "South Bohemia" */

/* months (the chart uses numbers like 199503 = March 1995) */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthIndex = ym => Math.floor(ym / 100) * 12 + (ym % 100) - 1;
const monthLabel = ym => `${MONTH_NAMES[(ym % 100) - 1]} ${Math.floor(ym / 100)}`;

/* hover box (the small black box that follows the mouse) */
const tipEl = $('#tip');
function tipHTML(title, rows) {                                                  /* rows = [['Accounts','661'], ...] */
  return `<div class="t-title">${title}</div>` + rows.map(r => `<div class="t-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}
function showTip(event, html) {
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = event.clientX + 14, y = event.clientY - h - 12;
  if (x + w > innerWidth - 8) x = event.clientX - w - 14;
  if (y < 8) y = event.clientY + 18;
  tipEl.style.transform = `translate(${x}px, ${y}px)`;
}
const hideTip = () => { tipEl.hidden = true; };
function bindTip(node, html) {
  node.addEventListener('mousemove', e => showTip(e, html));
  node.addEventListener('mouseleave', hideTip);
}



/* ==========================================================================
   3. THE TABLE
   ACCOUNTS is ONE big table, one row per account (4,500 rows).
   Every number on the Overview is calculated from some rows of it.
   ========================================================================== */

/* 3.1  extra columns, calculated once for every row */
ACCOUNTS.forEach(r => {
  r.hasLoan        = r.loan !== null;
  r.loanActive     = r.hasLoan && CONFIG.activeLoanCodes.includes(r.loan.status);
  r.incomeMonthly  = r.pension + r.salary + r.depAvg;          /* what comes in per month */
  r.outflowMonthly = r.transfers + r.withdrawals;              /* what goes out per month */
});

/* 3.2  the calculations (each takes "rows" and gives back a number) */
const countWhere = (rows, test) => rows.reduce((n, r) => n + (test(r) ? 1 : 0), 0);        /* how many pass a test  */
const sumOf      = (rows, get)  => rows.reduce((total, r) => total + get(r), 0);
const averageOf  = (rows, get)  => rows.length ? sumOf(rows, get) / rows.length : 0;

function countBy(rows, get) {                                  /* how many per value: { 1993: 1139, 1994: 439, ... } */
  const counts = {};
  rows.forEach(r => { const k = get(r); counts[k] = (counts[k] || 0) + 1; });
  return counts;
}
function yearRange(rows) {                                     /* { min: 1993, max: 1997 }, null if no rows */
  if (!rows.length) return null;
  let min = Infinity, max = -Infinity;
  rows.forEach(r => { if (r.year < min) min = r.year; if (r.year > max) max = r.year; });
  return { min, max };
}
const growthPercent = (now, before) => before ? ((now - before) / before) * 100 : null;     /* YoY % */
const perThousand   = (accounts, population) => population ? (accounts / population) * 1000 : 0;
const regionInfo    = name => REGIONS.find(g => g.name === name);

/* 3.3  fixed lists: made once from the FULL table so charts never reorder while you filter */
const LISTS = {
  years:   Object.keys(countBy(ACCOUNTS, r => r.year)).map(Number).sort((a, b) => a - b),
  fees:    Object.keys(countBy(ACCOUNTS, r => r.fee)).map(Number).sort((a, b) => a - b),
  regions: (() => {
    const perRegion = countBy(ACCOUNTS, r => r.region);        /* biggest region first */
    return REGIONS.map(g => g.name).sort((a, b) => (perRegion[b] || 0) - (perRegion[a] || 0));
  })(),
};



/* ==========================================================================
   4. FILTERS
   activeFilters keeps the selected values of each aspect, e.g.
       { region: ['prague', 'south Moravia'], age: ['25-34'] }
   Rule:  inside one aspect = OR   (Prague OR South Moravia)
          between aspects   = AND  (...AND age 25-34)
   Click = select only that item.   Ctrl+click (Cmd on Mac) = add / remove one more.
   ========================================================================== */

/* what each aspect means: "does this account (r) match this value (v)?" */
const incomeColumn = key => CONFIG.incomeSources.find(s => s.key === key).column;
const incomeLabel  = key => CONFIG.incomeSources.find(s => s.key === key).label;

const FILTERS = {
  year:       { label: 'Year',        test: (r, v) => r.year === v },
  region:     { label: 'Region',      test: (r, v) => r.region === v,           show: v => cap(v) },
  gender:     { label: 'Gender',      test: (r, v) => r.gender === v },
  age:        { label: 'Age',         test: (r, v) => r.ageGroup === v },
  fee:        { label: 'Fee',         test: (r, v) => r.fee === v,              show: v => `${v} ${CONFIG.currency}` },
  orderType:  { label: 'Order',       test: (r, v) => r.orders[v] > 0 },
  loanStatus: { label: 'Loan status', test: (r, v) => r.hasLoan && r.loan.status === v },
  income:     { label: 'Income',      test: (r, v) => r[incomeColumn(v)] > 0,   show: incomeLabel },
};

const activeFilters = {};                                      /* nothing selected at the start */
const isSelected = (key, value) => (activeFilters[key] || []).includes(value);

/* the accounts that pass the filters.
   skipKey = ignore ONE aspect: a chart ignores its own, so it keeps all its categories
   (the chosen ones are highlighted instead of the others disappearing). */
function rowsFor(skipKey) {
  const active = Object.entries(activeFilters).filter(([key]) => key !== skipKey);
  return ACCOUNTS.filter(r => active.every(([key, values]) => values.some(v => FILTERS[key].test(r, v))));
}

/* a click on an item of a chart:  pick('region', name) tells the chart what to do */
const pick = (key, value) => ({ selected: isSelected(key, value), onClick: event => toggleFilter(key, value, event) });

function toggleFilter(key, value, event) {
  const current = activeFilters[key] || [];
  const addMore = event && (event.ctrlKey || event.metaKey || event.shiftKey);

  if (addMore) {                                               /* Ctrl+click: add or remove this one */
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    if (next.length) activeFilters[key] = next; else delete activeFilters[key];
  } else if (current.length === 1 && current[0] === value) {   /* click the only selected one: clear */
    delete activeFilters[key];
  } else {                                                     /* plain click: this one only */
    activeFilters[key] = [value];
  }
  renderOverview();
}

function clearFilters(key) {                                   /* one aspect, or everything */
  if (key) delete activeFilters[key]; else Object.keys(activeFilters).forEach(k => delete activeFilters[k]);
  renderOverview();
}

/* chips under the title:   Region: Prague, South Moravia ✕    Age: 25-34 ✕    Clear all */
function renderFilterBar() {
  const chips = Object.entries(activeFilters).map(([key, values]) => {
    const f = FILTERS[key], shown = values.map(v => f.show ? f.show(v) : v).join(', ');
    return `<span class="fchip">${f.label}: <b>${shown}</b><button data-key="${key}" aria-label="Remove filter">✕</button></span>`;
  });
  const bar = $('#filter-bar');
  bar.innerHTML = chips.join('') + (chips.length ? '<button class="fclear" id="filter-clear">Clear all</button>' : '');
  bar.querySelectorAll('.fchip button').forEach(b => b.addEventListener('click', () => clearFilters(b.dataset.key)));
  if (chips.length) $('#filter-clear').addEventListener('click', () => clearFilters());

  $('#page-sub').textContent = chips.length ? 'Filtered accounts · Ctrl+click to add more' : 'All accounts · click to filter, Ctrl+click to select several';
}



/* ==========================================================================
   5. DRAWING TOOLS
   Each tool receives a place on the page (root) and a list of items.
   An item can have:  label, value, tip (hover text), selected, onClick.
   ========================================================================== */

/* gives one drawn element its hover text, its click and its "selected" look */
function wireItem(node, item) {
  if (item.tip) bindTip(node, item.tip);
  if (item.onClick) { node.classList.add('is-clickable'); node.addEventListener('click', item.onClick); }
  if (item.selected) node.classList.add('is-selected');
}
const markSelection = (root, items) => root.classList.toggle('has-selection', items.some(i => i.selected));   /* CSS fades the others */

/* vertical bars: items = [{ label, value, ... }] */
function drawVerticalBars(root, items) {
  const max = (Math.max(...items.map(i => i.value)) * 1.08) || 1;
  const chart = el('<div class="vchart"></div>');
  items.forEach(i => {
    const col = el(`<div class="vcol"><span class="vval">${fmt(i.value)}</span><div class="vbar" style="height:${(i.value / max) * 100}%"></div></div>`);
    wireItem(col, i);
    chart.appendChild(col);
  });
  const labels = el('<div class="vlabels"></div>');
  items.forEach(i => labels.appendChild(el(`<span>${i.label}</span>`)));
  root.replaceChildren(chart, labels);
  markSelection(root, items);
}

/* horizontal bars: items = [{ label, value, right1, right2, ... }];  compact = small version (Single account page) */
function drawHorizontalBars(root, items, compact = false) {
  const max = Math.max(...items.map(i => i.value), 0);
  root.replaceChildren(...items.map(i => {
    const width = max ? (i.value / max) * 100 : 0;
    const bar = `<div class="htrack"><div class="hfill" style="width:${width}%"></div></div>`;
    const row = compact
      ? el(`<div class="hrow compact"><span class="hrow-label">${i.label}</span>${bar}<b>${i.right1}</b></div>`)
      : el(`<div class="hrow"><span class="hrow-label">${i.label}</span>${bar}<b>${i.right1}</b><em>${i.right2}</em></div>`);
    wireItem(row, i);
    return row;
  }));
  markSelection(root, items);
}

/* the legend used by the donut and the loan bar */
function drawLegend(items, whole) {
  const legend = el('<div class="legend"></div>');
  items.forEach(i => {
    const row = el(`<div class="legend-row" style="--c:${i.color}"><i></i><span>${i.label}</span><b>${fmt(i.value)}</b><em>${pc(i.value, whole)}</em></div>`);
    wireItem(row, { onClick: i.onClick, selected: i.selected });
    legend.appendChild(row);
  });
  return legend;
}

/* donut + legend: items = [{ label, value, color, ... }]; centerText/centerSub = text in the ring;
   whole = what the percentages are taken from (default: the sum of the items) */
function drawDonut(root, items, centerText, centerSub, whole) {
  const sum = items.reduce((a, i) => a + i.value, 0);
  let offset = 0;

  const ring = el(`<svg class="donut" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#edf2ef" stroke-width="14"></circle>
      <text x="50" y="${centerSub ? 50 : 54}" class="d-main">${centerText}</text>
      ${centerSub ? `<text x="50" y="61" class="d-sub">${centerSub}</text>` : ''}
    </svg>`);

  items.forEach(i => {
    const p = sum ? (i.value / sum) * 100 : 0;
    const arc = el(`<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="38" fill="none" stroke="${i.color}" stroke-width="14" pathLength="100" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"></circle></svg>`).firstChild;
    offset += p;
    wireItem(arc, i);
    ring.insertBefore(arc, ring.querySelector('text'));
  });

  root.replaceChildren(ring, drawLegend(items, whole || sum));
  markSelection(root, items);
}

/* loan bar: one coloured bar split by status + legend */
function drawSegmentBar(root, items, whole) {
  const bar = el('<div class="sbar"></div>');
  items.forEach(i => {
    const seg = el(`<span style="width:${whole ? (i.value / whole) * 100 : 0}%;background:${i.color}"></span>`);
    wireItem(seg, i);
    bar.appendChild(seg);
  });
  root.replaceChildren(bar, drawLegend(items, whole));
  markSelection(root, items);
}

/* line chart of one account: series = { months: [199503, ...], moneyIn: [...], moneyOut: [...] }
   colours come from style.css (--c-in, --c-out, --c-net) */
function niceTicks(min, max, count = 5) {                      /* round numbers for the side axis */
  const range = (max - min) || 1, raw = range / (count - 1), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks;
}
const shortK = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(Math.abs(v) % 1000 ? 1 : 0).replace(/\.0$/, '') + 'K' : String(v);

function drawLineChart(root, series) {
  const colors = { in: cssVar('--c-in'), out: cssVar('--c-out'), net: cssVar('--c-net') };
  const { months, moneyIn, moneyOut } = series;
  const net = moneyIn.map((v, i) => v - moneyOut[i]);

  const size = root.getBoundingClientRect();
  const W = Math.max(380, Math.round(size.width) || 800);
  const H = Math.max(150, Math.round(size.height) - 30 || 280);
  const m = { l: 54, r: 14, t: 12, b: 28 }, pw = W - m.l - m.r, ph = H - m.t - m.b;

  /* scales: month -> x position, money -> y position */
  const ticks = niceTicks(Math.min(...moneyIn, ...moneyOut, ...net, 0), Math.max(...moneyIn, ...moneyOut, ...net, 0));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const first = monthIndex(months[0]), last = monthIndex(months[months.length - 1]), span = (last - first) || 1;
  const X = ym => m.l + ((monthIndex(ym) - first) / span) * pw;
  const Y = v => m.t + (1 - (v - y0) / ((y1 - y0) || 1)) * ph;

  const line = (values, color, width) =>
    `<polyline fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" points="${values.map((v, i) => X(months[i]).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}"/>`;

  let grid = ticks.map(t => `<line class="grid-l" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${m.l - 8}" y="${Y(t) + 3.5}" text-anchor="end">${shortK(t)}</text>`).join('');
  const n = 6;
  for (let k = 0; k <= n; k++) {
    const idx = Math.round(first + (span * k) / n), ym = Math.floor(idx / 12) * 100 + (idx % 12) + 1;
    grid += `<text class="ax" x="${m.l + (pw * k) / n}" y="${H - 8}" text-anchor="${k === 0 ? 'start' : k === n ? 'end' : 'middle'}">${monthLabel(ym)}</text>`;
  }

  root.innerHTML = `<div class="lchart"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Money in, money out and net balance per month">
      ${grid}
      ${line(moneyOut, colors.out, 2.2)}${line(moneyIn, colors.in, 2.2)}${line(net, colors.net, 2.8)}
      <line class="guide" id="lc-guide" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0" style="display:none"/>
      <rect id="lc-hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/>
    </svg></div>
    <div class="chart-legend">
      <span style="--c:${colors.in}">Money in</span><span style="--c:${colors.out}">Money out</span><span style="--c:${colors.net}">Net balance</span>
    </div>`;

  /* hover: a vertical guide and the numbers of the nearest month */
  const hit = $('#lc-hit'), guide = $('#lc-guide'), svg = $('.lchart svg');
  hit.addEventListener('mousemove', e => {
    const box = svg.getBoundingClientRect(), vx = ((e.clientX - box.left) / box.width) * W;
    let best = 0, bestDist = Infinity;
    months.forEach((ym, i) => { const d = Math.abs(X(ym) - vx); if (d < bestDist) { bestDist = d; best = i; } });
    guide.setAttribute('x1', X(months[best])); guide.setAttribute('x2', X(months[best]));
    guide.style.display = '';
    showTip(e, tipHTML(monthLabel(months[best]), [['Money in', kc(moneyIn[best])], ['Money out', kc(moneyOut[best])], ['Net', kc(net[best])]]));
  });
  hit.addEventListener('mouseleave', () => { guide.style.display = 'none'; hideTip(); });
}



/* ==========================================================================
   6. OVERVIEW CARDS
   For every card:  1) take the accounts that pass the filters  (rowsFor)
                    2) calculate the numbers from them          (section 3)
                    3) call a part of the page by its name and put the value in it
   ========================================================================== */

function renderOverview() {
  hideTip();
  renderFilterBar();

  const all = rowsFor(null);                                   /* accounts passing EVERY filter */

  renderKpis(all);
  renderYears(rowsFor('year'));                                /* a chart uses all filters EXCEPT its own */
  renderRegions(rowsFor('region'));
  renderGenderAge(rowsFor('gender'), rowsFor('age'));
  renderFees(rowsFor('fee'), all);
  renderServices(rowsFor('orderType'), rowsFor('loanStatus'));
  renderMoney(rowsFor('income'), all);
}


/* ---------- top cards: accounts, orders, loans ---------- */
function renderKpis(rows) {
  const total = rows.length;

  const range = yearRange(rows);                               /* "opened between X and Y" (or one year, or nothing) */
  $('#kpi-total').textContent = fmt(total);
  $('#kpi-total-sub').textContent =
    !range ? 'no accounts' :
    range.min === range.max ? `opened in ${range.min}` :
    `opened between ${range.min} and ${range.max}`;

  const withOrders = countWhere(rows, r => r.hasOrder);        /* accounts that have standing orders */
  $('#kpi-orders').textContent     = fmt(withOrders);
  $('#kpi-orders-sub').textContent = `${pc(withOrders, total)} of accounts`;

  const withLoans = countWhere(rows, r => r.hasLoan);          /* accounts with a loan; running now = status C or D */
  const running   = countWhere(rows, r => r.loanActive);
  $('#kpi-loans').textContent   = fmt(withLoans);
  $('#kpi-loans-sub').innerHTML = `${pc(withLoans, total)} of accounts · <em>${fmt(running)} active now</em>`;
}


/* ---------- accounts by year opened: count, share, YoY growth ---------- */
function renderYears(rows) {
  const total  = rows.length;
  const counts = countBy(rows, r => r.year);
  $('#avg-year').textContent = `Avg ${fmt(total / LISTS.years.length)} per year`;

  drawVerticalBars($('#chart-years'), LISTS.years.map((year, k) => {
    const count  = counts[year] || 0;
    const before = k ? (counts[LISTS.years[k - 1]] || 0) : 0;
    const growth = k ? growthPercent(count, before) : null;
    const growthText = growth === null ? '-' : `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
    return {
      label: year, value: count, ...pick('year', year),
      tip: tipHTML(String(year), [['Accounts', fmt(count)], ['Share of all', pc(count, total)], ['YoY growth', growthText]]),
    };
  }));
}


/* ---------- accounts by region: count, share, accounts per 1,000 people ---------- */
function renderRegions(rows) {
  const total  = rows.length;
  const counts = countBy(rows, r => r.region);

  drawHorizontalBars($('#chart-regions'), LISTS.regions.map(name => {
    const count = counts[name] || 0;
    const per1000 = perThousand(count, regionInfo(name).population);
    return {
      label: cap(name), value: count, right1: fmt(count), right2: pc(count, total), ...pick('region', name),
      tip: tipHTML(cap(name), [['Accounts', fmt(count)], ['Share of all', pc(count, total)], ['Per 1,000 people', per1000.toFixed(2)]]),
    };
  }));
}

/* the full regions table (popup). It compares ALL regions, so filters do not change it. */
function renderRegionTable() {
  const counts = countBy(ACCOUNTS, r => r.region);
  const columns = [
    { title: 'Region',          get: g => cap(g.name),                                      bar: false },
    { title: 'Accounts',        get: g => counts[g.name] || 0,                              bar: true },
    { title: 'Per 1,000',       get: g => perThousand(counts[g.name] || 0, g.population),   bar: true, show: v => v.toFixed(2) },
    { title: 'Population',      get: g => g.population,                                     bar: true },
    { title: 'Districts',       get: g => g.districts,                                      bar: true },
    { title: 'Avg salary',      get: g => g.avgSalary,                                      bar: true, show: kc },
    { title: 'Entrepr. /1,000', get: g => g.entrepreneurs,                                  bar: true },
    { title: 'Urban ratio %',   get: g => g.urbanRatio,                                     bar: true, show: v => v.toFixed(1) },
    { title: 'Crimes 1995',     get: g => g.crimes95,                                       bar: true },
    { title: 'Crimes 1996',     get: g => g.crimes96,                                       bar: true },
    { title: 'Unemp. 1995 %',   get: g => g.unemployment95,                                 bar: true, show: v => v.toFixed(1) },
    { title: 'Unemp. 1996 %',   get: g => g.unemployment96,                                 bar: true, show: v => v.toFixed(1) },
  ];
  const highest = columns.map(c => c.bar ? Math.max(...REGIONS.map(c.get)) : 0);   /* bar length = value / highest in its column */

  let html = '<tr>' + columns.map(c => `<th>${c.title}</th>`).join('') + '</tr>';
  REGIONS.forEach(g => {
    html += '<tr>' + columns.map((c, k) => {
      const v = c.get(g), text = c.show ? c.show(v) : (c.bar ? fmt(v) : v);
      if (!c.bar) return `<td>${text}</td>`;
      const width = highest[k] ? (v / highest[k]) * 100 : 0;
      return `<td class="has-bar" style="--w:${width.toFixed(1)}%">${text}</td>`;
    }).join('') + '</tr>';
  });
  $('#regions-table').innerHTML = html;
}


/* ---------- gender and age ---------- */
function renderGenderAge(rowsForGender, rowsForAge) {
  const tipFor = (title, count, total) => tipHTML(title, [['Accounts', fmt(count)], ['Share', pc(count, total)]]);
  const palette = CONFIG.palette;

  const genders = countBy(rowsForGender, r => r.gender);
  drawDonut($('#donut-gender'), ['Male', 'Female'].map((g, k) => ({
    label: g, value: genders[g] || 0, color: palette[k === 0 ? 0 : 3], ...pick('gender', g),
    tip: tipFor(g, genders[g] || 0, rowsForGender.length),
  })), fmt(rowsForGender.length), 'accounts');

  const ages = countBy(rowsForAge, r => r.ageGroup);
  drawDonut($('#donut-age'), CONFIG.ageGroups.map((g, k) => ({
    label: g, value: ages[g] || 0, color: palette[k], ...pick('age', g),
    tip: tipFor(`Age ${g}`, ages[g] || 0, rowsForAge.length),
  })), fmt(rowsForAge.length), 'accounts');
}


/* ---------- fees: monthly total + accounts per fee ---------- */
function renderFees(rowsForFee, rowsAll) {
  $('#fees-total').textContent = kc(sumOf(rowsAll, r => r.fee));          /* sum of every account's monthly fee */

  const counts = countBy(rowsForFee, r => r.fee);
  const mostCommon = Math.max(...LISTS.fees.map(f => counts[f] || 0));
  const lines = LISTS.fees.map(fee => {
    const n = counts[fee] || 0;
    const classes = [n === mostCommon && n > 0 ? 'is-top' : '', 'is-clickable', isSelected('fee', fee) ? 'is-selected' : ''].join(' ');
    return `<tr class="${classes}" data-fee="${fee}"><td>${fee} ${CONFIG.currency}</td><td>${fmt(n)}</td><td>${pc(n, rowsForFee.length)}</td></tr>`;
  });
  const table = $('#fees-table');
  table.innerHTML = '<table class="tbl"><tr><th>Monthly fee</th><th>Accounts</th><th>Share</th></tr>' + lines.join('') + '</table>';
  table.classList.toggle('has-selection', 'fee' in activeFilters);
  table.querySelectorAll('tr[data-fee]').forEach(tr => tr.addEventListener('click', e => toggleFilter('fee', Number(tr.dataset.fee), e)));
}


/* ---------- services: standing orders by type, loans by status ---------- */
function renderServices(rowsForOrder, rowsForLoan) {
  /* orders: only accounts that HAVE an order are counted; each type = accounts whose amount is above zero */
  const haveOrder = rowsForOrder.filter(r => r.hasOrder);
  drawHorizontalBars($('#chart-orders'), CONFIG.orderTypes.map(type => {
    const n = countWhere(haveOrder, r => r.orders[type] > 0);
    return {
      label: type, value: n, right1: fmt(n), right2: pc(n, haveOrder.length), ...pick('orderType', type),
      tip: tipHTML(`${type} orders`, [['Accounts', fmt(n)], ['Share of accounts with orders', pc(n, haveOrder.length)]]),
    };
  }));

  /* loans: only accounts that HAVE a loan are counted; each status = accounts with that status */
  const haveLoan = rowsForLoan.filter(r => r.hasLoan);
  $('#loan-title').textContent = `${fmt(haveLoan.length)} loans by status`;
  drawSegmentBar($('#loan-bar'), CONFIG.loanStatus.map(s => {
    const n = countWhere(haveLoan, r => r.loan.status === s.code);
    return {
      label: `${s.code}: ${s.label}`, value: n, color: s.color, ...pick('loanStatus', s.code),
      tip: tipHTML(`${s.code} · ${s.label}`, [['Loans', fmt(n)], ['Share of loans', pc(n, haveLoan.length)]]),
    };
  }), haveLoan.length);
}


/* ---------- money: income sources + average monthly income / spending ---------- */
function renderMoney(rowsForIncome, rowsAll) {
  /* how many accounts have each source (column above zero) */
  drawDonut($('#donut-income'), CONFIG.incomeSources.map((s, k) => {
    const n = countWhere(rowsForIncome, r => r[s.column] > 0);
    return {
      label: s.label, value: n, color: CONFIG.palette[[0, 2, 4][k]], ...pick('income', s.key),
      tip: tipHTML(s.label, [['Accounts', fmt(n)], ['Of accounts', pc(n, rowsForIncome.length)]]),
    };
  }), fmt(rowsForIncome.length), 'accounts', rowsForIncome.length);

  /* the average, over the accounts, of each account's monthly income and monthly outflow */
  $('#avg-income').textContent = kc(averageOf(rowsAll, r => r.incomeMonthly));
  $('#avg-spend').textContent  = kc(averageOf(rowsAll, r => r.outflowMonthly));
}



/* ==========================================================================
   7. ACCOUNT CARDS  (Single account page)
   Same big table, but the "filter" is just ONE account.
   Only the money-in / money-out chart needs the second table (BALANCES),
   so balances.js is loaded the first time it is needed.
   ========================================================================== */
let accountIndex = 0;                                          /* which row of ACCOUNTS is shown */
const currentAccount = () => ACCOUNTS[accountIndex];

function renderAccount() {
  const a = currentAccount();

  $('#acc-input').value = a.id;
  $('#acc-sub').textContent = `Account ${a.id} · ${accountIndex + 1} of ${fmt(ACCOUNTS.length)}`;
  $('#acc-hint').hidden = true;

  renderAccountIncome(a);
  renderAccountOutflow(a);
  renderAccountOwner(a);
  renderAccountChart(a);
  renderAccountDetails(a);
  renderAccountOrders(a);
  renderAccountLoan(a);
}

/* small builders used by the cards */
const detailRows = rows => rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('');
const orNone = (value, text) => value > 0 ? text : '<span class="none">None</span>';      /* 0 -> grey "None" */

function flowCell(icon, label, value, note) {                  /* one cell of the Income / Outflow cards */
  return `<div class="flow-cell"><span class="flow-ico"><svg class="ico"><use href="#${icon}"/></svg></span>
    <div><span class="flow-label">${label}</span><b class="flow-value">${value}</b><small>${note}</small></div></div>`;
}
function infoRow(cells) {                                      /* one line of Income Details: one or two "label ... value" cells */
  return `<div class="info-row">${cells.map(([label, value]) =>
    `<div class="info-cell"><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
}

/* ---------- where the money comes from ---------- */
function renderAccountIncome(a) {
  $('#acc-income').innerHTML =
    flowCell('i-coin', 'Salary',          orNone(a.salary,  kc(a.salary)),  'per month') +
    flowCell('i-bars', 'Average deposit', orNone(a.depAvg,  kc(a.depAvg)),  'monthly average') +
    flowCell('i-user', 'Pension',         orNone(a.pension, kc(a.pension)), 'per month');
}

/* ---------- where the money goes ---------- */
function renderAccountOutflow(a) {
  $('#acc-outflow').innerHTML =
    flowCell('i-swap', 'Transfers',   orNone(a.transfers,   kc(a.transfers)),   'monthly average') +
    flowCell('i-out',  'Withdrawals', orNone(a.withdrawals, kc(a.withdrawals)), 'monthly average');
}

/* ---------- owner ---------- */
function renderAccountOwner(a) {
  $('#acc-owner').innerHTML = detailRows([
    ['Age', a.age], ['Gender', a.gender], ['Region', cap(a.region)],
    ['Account opened', a.year], ['Fee, per month', kc(a.fee)],
  ]);
}

/* ---------- money in / out / net per month (needs BALANCES) ---------- */
let balancesLoading = null;
function loadBalances() {
  if (typeof BALANCES !== 'undefined') return Promise.resolve();
  if (!balancesLoading) {
    balancesLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'balances.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('could not load balances.js'));
      document.head.appendChild(script);
    });
  }
  return balancesLoading;
}

function renderAccountChart(a) {
  const box = $('#acc-chart');
  const message = text => { box.innerHTML = `<p class="chart-note">${text}</p>`; };

  if (typeof BALANCES === 'undefined') {                       /* not loaded yet: load, then draw again */
    message('Loading monthly data…');
    loadBalances()
      .then(() => { if (currentAccount().id === a.id) renderAccountChart(a); })
      .catch(() => message('Monthly data could not be loaded (balances.js).'));
    return;
  }
  const months = BALANCES[a.id];                               /* [[yyyymm, in, out], ...] of this account */
  if (!months) { message('No monthly data for this account.'); return; }

  drawLineChart(box, {
    months:   months.map(m => m[0]),
    moneyIn:  months.map(m => m[1]),
    moneyOut: months.map(m => m[2]),
  });
}

/* ---------- income details: peak salary and the deposit facts ---------- */
function renderAccountDetails(a) {
  const mostFrequent = a.depModeCount > 1 && a.depMode > 0
    ? `${kc(a.depMode)} <span class="times">×${a.depModeCount}</span>`
    : '<span class="none">None</span>';

  $('#acc-details').innerHTML =
    infoRow([['Peak salary (with bonus)', orNone(a.peakSalary, kc(a.peakSalary))]]) +
    infoRow([['Total deposited', kc(a.depTotal)]]) +
    infoRow([['Deposits', fmt(a.depCount)], ['Active months', fmt(a.depMonths)]]) +
    infoRow([['Smallest', kc(a.depMin)], ['Largest', kc(a.depMax)]]) +
    infoRow([['Most frequent amount', mostFrequent]]);
}

/* ---------- standing orders ---------- */
function renderAccountOrders(a) {
  const total = Object.values(a.orders).reduce((x, y) => x + y, 0);
  $('#acc-orders-title').textContent = `Orders, total ${kc(total)}`;
  drawHorizontalBars($('#acc-orders'), CONFIG.orderTypes.map(type => ({
    label: type, value: a.orders[type], right1: kc(a.orders[type]),
  })), true);
}

/* ---------- loan ---------- */
function renderAccountLoan(a) {
  const L = a.loan;
  const statusName = code => { const s = CONFIG.loanStatus.find(x => x.code === code); return s ? `${s.code}, ${s.label.toLowerCase()}` : code; };
  $('#acc-loan').innerHTML = L
    ? detailRows([['Has a loan', 'Yes'], ['Status', statusName(L.status)], ['Loan amount', kc(L.amount)], ['Monthly payment', kc(L.pay)], ['Duration', `${L.months} months`]])
    : detailRows([['Has a loan', 'No'], ['Status', 'none'], ['Loan amount', kc(0)], ['Monthly payment', kc(0)], ['Duration', 'none']]);
}

/* the account picker: previous / next / random / type a number */
function goToAccount(index) {
  accountIndex = (index + ACCOUNTS.length) % ACCOUNTS.length;
  renderAccount();
}



/* ==========================================================================
   8. START-UP
   ========================================================================== */
function showPage(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('is-active', b.dataset.page === name));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('is-active', p.id === `page-${name}`));
  hideTip();
  if (name === 'account') renderAccount();                     /* draw now: the chart needs the page visible to measure itself */
}

/* buttons */
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));

const regionsDialog = $('#regions-dialog');
$('#btn-regions').addEventListener('click', () => regionsDialog.showModal());
$('#regions-close').addEventListener('click', () => regionsDialog.close());
regionsDialog.addEventListener('click', e => { if (e.target === regionsDialog) regionsDialog.close(); });     /* click outside = close */

$('#acc-prev').addEventListener('click', () => goToAccount(accountIndex - 1));
$('#acc-next').addEventListener('click', () => goToAccount(accountIndex + 1));
$('#acc-random').addEventListener('click', () => goToAccount(Math.floor(Math.random() * ACCOUNTS.length)));
$('#acc-input').addEventListener('change', e => {
  const found = ACCOUNTS.findIndex(r => r.id === Number(e.target.value));
  if (found >= 0) { goToAccount(found); return; }
  const hint = $('#acc-hint');
  hint.hidden = false;
  hint.textContent = `There is no account ${e.target.value}. Account numbers go from ${ACCOUNTS[0].id} to ${ACCOUNTS[ACCOUNTS.length - 1].id}.`;
});

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if ($('#page-account').classList.contains('is-active')) renderAccount(); }, 120);
});

/* first screen */
renderRegionTable();
renderOverview();
setTimeout(() => loadBalances().catch(() => {}), 800);         /* fetch the monthly data quietly, so page 2 opens instantly */

'use strict';

/* ================= Utilities ================= */
const STORAGE_KEY = 'budgetplanner.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const numFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const fmt = (n) => rupiahFmt.format(Math.round(n || 0)).replace(/ /g, ' ');
const fmtCompact = (n) => compactFmt.format(n || 0);
const parseMoney = (s) => Number(String(s || '').replace(/[^\d]/g, '')) || 0;

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const ICON = {
  check: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  alert: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v7M12 17.5v.5"/></svg>',
};

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const monthOf = (iso) => iso.slice(0, 7);
const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const shiftMonth = (ym, delta) => { const d = parseISO(ym + '-01'); d.setMonth(d.getMonth() + delta); return toISO(d).slice(0, 7); };
const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const monthShort = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`; };
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const dateLabel = (iso) => {
  const t = todayISO();
  if (iso === t) return 'Hari ini';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === toISO(y)) return 'Kemarin';
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

/* ================= State ================= */
const DEFAULT_CATEGORIES = [
  ['food', 'expense', '🍜', 'Makan & Minum'],
  ['transport', 'expense', '🚗', 'Transportasi'],
  ['shopping', 'expense', '🛍️', 'Belanja'],
  ['bills', 'expense', '💡', 'Tagihan & Utilitas'],
  ['housing', 'expense', '🏠', 'Tempat Tinggal'],
  ['health', 'expense', '💊', 'Kesehatan'],
  ['fun', 'expense', '🎬', 'Hiburan'],
  ['education', 'expense', '📚', 'Pendidikan'],
  ['family', 'expense', '🤝', 'Keluarga & Sosial'],
  ['savings', 'expense', '💰', 'Tabungan & Investasi'],
  ['other-exp', 'expense', '📦', 'Lainnya'],
  ['salary', 'income', '💼', 'Gaji'],
  ['bonus', 'income', '🎁', 'Bonus'],
  ['business', 'income', '🧑‍💻', 'Usaha / Freelance'],
  ['invest-inc', 'income', '📈', 'Hasil Investasi'],
  ['other-inc', 'income', '➕', 'Lainnya'],
].map(([id, type, icon, name]) => ({ id, type, icon, name, builtin: true }));

const DEFAULT_SOURCES = ['Tunai', 'Rekening Bank', 'E-Wallet'];

function defaults() {
  return {
    version: 1,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    sources: [...DEFAULT_SOURCES],
    budgets: {},
    goals: [],
    settings: { theme: 'auto', installDismissed: false, sheet: null },
  };
}

function normalize(data) {
  const base = defaults();
  if (!data || typeof data !== 'object') return base;
  const out = {
    version: 1,
    transactions: Array.isArray(data.transactions)
      ? data.transactions.filter((t) => t && t.id && t.date && Number.isFinite(Number(t.amount)) && Number(t.amount) !== 0)
      : [],
    categories: Array.isArray(data.categories) && data.categories.length ? data.categories : base.categories,
    sources: Array.isArray(data.sources) ? data.sources.filter(Boolean) : base.sources,
    budgets: data.budgets && typeof data.budgets === 'object' ? data.budgets : {},
    goals: Array.isArray(data.goals) ? data.goals : [],
    settings: { ...base.settings, ...(data.settings || {}) },
  };
  out.transactions.forEach((t) => { t.amount = Number(t.amount); t.type = t.type === 'income' ? 'income' : 'expense'; });
  if (!(out.settings.sheet && out.settings.sheet.url)) {
    out.settings.sheet = null;
    // Local mode relies on these fallback categories.
    for (const id of ['other-exp', 'other-inc', 'savings']) {
      if (!out.categories.some((c) => c.id === id)) out.categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === id) });
    }
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* storage unavailable or corrupt */ }
  return defaults();
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('⚠️ Gagal menyimpan data di perangkat ini'); }
}

let state = load();
const ui = { view: 'home', month: monthOf(todayISO()), txFilter: 'all', source: '', search: '' };

const catById = (id) => state.categories.find((c) => c.id === id)
  || { id, icon: id ? iconFor(id) : '❔', name: id || 'Tanpa kategori', type: 'expense' };
const catsOf = (type) => state.categories.filter((c) => c.type === type);

const ICONS = [
  [/gaji/i, '💼'], [/bonus/i, '🎁'], [/bisnis|usaha|freelance/i, '🧑‍💻'], [/investasi|dividen/i, '📈'],
  [/makan|belanja harian|groceries/i, '🍜'], [/tagihan|listrik|air|internet|pulsa/i, '💡'],
  [/transport|bensin|parkir|tol/i, '🚗'], [/pendidikan|sekolah|kursus/i, '📚'], [/keluarga/i, '👨‍👩‍👧'],
  [/hiburan|rekreasi|liburan/i, '🎬'], [/belanja online|shopee|tokopedia/i, '🛒'], [/belanja/i, '🛍️'],
  [/tabungan/i, '💰'], [/cicilan|utang|hutang|kredit|paylater/i, '💳'], [/kopi|coffee/i, '☕'],
  [/rokok/i, '🚬'], [/game/i, '🎮'], [/perawatan|salon|skincare/i, '💆'], [/kesehatan|obat|dokter/i, '💊'],
  [/rumah|kos|sewa/i, '🏠'], [/sosial|donasi|zakat|sedekah/i, '🤝'], [/lain/i, '📦'],
];
function iconFor(name) {
  const hit = ICONS.find(([re]) => re.test(name));
  return hit ? hit[1] : '🏷️';
}

const sheetMode = () => !!(state.settings.sheet && state.settings.sheet.url);
const pendingTx = () => state.transactions.filter((t) => t.pending);
function sourcesList() {
  const set = new Set(state.sources);
  state.transactions.forEach((t) => { if (t.source) set.add(t.source); });
  return [...set];
}
// Category used when a savings deposit/withdrawal is also recorded as a transaction.
function savingsCategory(out) {
  if (!sheetMode()) return out ? 'other-inc' : 'savings';
  const list = catsOf(out ? 'income' : 'expense');
  const hit = list.find((c) => (out ? /lain/i : /tabungan|investasi/i).test(c.name));
  return (hit || list[0] || { id: out ? 'Pemasukan Lainnya' : 'Tabungan & Investasi' }).id;
}

/* ================= Google Sheet sync ================= */
const sync = { busy: false, error: '', lastTry: 0 };

class NetworkError extends Error {}

async function sheetApi(payload) {
  const { url, token } = state.settings.sheet || {};
  if (!url) throw new Error('Belum terhubung ke Google Sheet.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      // text/plain keeps this a "simple" request, which Apps Script accepts without a CORS preflight.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, ...payload }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
  } catch (e) {
    // When the device is online, a failed request usually means Google answered with a login page
    // (no CORS headers), i.e. the deployment is not open to "Siapa saja".
    throw new NetworkError(navigator.onLine === false
      ? 'Tidak ada koneksi internet.'
      : 'Tidak bisa menghubungi Web App. Pastikan URL berakhiran /exec dan di deployment "Yang memiliki akses" = "Siapa saja".');
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text().catch(() => '');
  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new Error(explainBadResponse(text, res.status)); }
  if (!data || !data.ok) throw new Error((data && data.error) || 'Gagal menghubungi Google Sheet.');
  applySheetData(data);
  return data;
}

// Google returns an HTML page instead of JSON when the deployment is misconfigured; say which case it is.
function explainBadResponse(text, status) {
  const fix = 'Lalu di Apps Script: Terapkan › Kelola deployment › ✏️ Edit › Versi: Versi baru › Terapkan.';
  if (/function not found|tidak ditemukan|doPost|doGet/i.test(text)) {
    return 'Web App belum berisi kode Budget Planner. Tempel seluruh isi Code.gs, klik Simpan. ' + fix;
  }
  if (/authoriz|otorisasi|izin/i.test(text)) {
    return 'Skrip belum diberi izin. Di editor Apps Script pilih fungsi doGet, klik Jalankan, lalu izinkan aksesnya. ' + fix;
  }
  if (/accounts\.google\.com|ServiceLogin|sign in|login|masuk/i.test(text)) {
    return 'Google meminta login. Di deployment, "Jalankan sebagai" harus "Saya" dan "Yang memiliki akses" harus "Siapa saja". ' + fix;
  }
  const plain = new DOMParser().parseFromString(text, 'text/html').body.textContent || '';
  const err = plain.match(/\b(?:TypeError|ReferenceError|SyntaxError|Exception)\b[^\n]{0,160}/);
  if (err) return 'Apps Script error: ' + err[0].replace(/\s+/g, ' ').trim();
  if (status === 404) return 'URL Web App tidak ditemukan (404). Salin ulang "URL aplikasi web" dari Terapkan › Kelola deployment.';
  return 'Respons tidak valid (bukan dari Budget Planner). Pastikan yang ditempel adalah "URL aplikasi web" berakhiran /exec. ' + fix;
}

function applySheetData(data) {
  const fromSheet = (data.transactions || []).map((t) => ({
    id: 'r' + t.row, row: t.row, date: t.date, type: t.type, category: t.category,
    note: t.note || '', amount: Number(t.amount), source: t.source || '',
  }));
  const cats = [];
  const add = (name, type) => {
    if (name && !cats.some((c) => c.id === name && c.type === type)) cats.push({ id: name, name, type, icon: iconFor(name) });
  };
  (data.incomeCategories || []).forEach((n) => add(n, 'income'));
  (data.expenseCategories || []).forEach((n) => add(n, 'expense'));
  fromSheet.forEach((t) => { if (!cats.some((c) => c.id === t.category)) add(t.category, t.type); });
  state.categories = cats;
  state.sources = [...new Set([...(data.sources || []), ...fromSheet.map((t) => t.source).filter(Boolean)])];
  state.transactions = fromSheet.concat(pendingTx());
  state.settings.sheet.lastSync = Date.now();
  sync.error = '';
  save();
}

const txPayload = (t) => ({ date: t.date, type: t.type, category: t.category, note: t.note || '', amount: t.amount, source: t.source || '' });

// Send queued transactions, then pull the latest data from the Sheet.
async function syncNow({ quiet = false } = {}) {
  if (!sheetMode() || sync.busy) return;
  sync.busy = true;
  sync.lastTry = Date.now();
  renderSyncState();
  try {
    let pulled = false;
    for (const t of pendingTx()) {
      await sheetApi({ action: 'add', tx: txPayload(t) });
      // applySheetData kept all pending items; drop the one just sent.
      state.transactions = state.transactions.filter((x) => x.id !== t.id);
      save();
      pulled = true;
    }
    if (!pulled) await sheetApi({ action: 'read' });
    if (!quiet) toast('Tersinkron dengan Google Sheet');
  } catch (e) {
    sync.error = e.message;
    if (!quiet || !(e instanceof NetworkError)) toast('⚠️ ' + e.message);
  } finally {
    sync.busy = false;
    render();
  }
}

function renderSyncState() {
  const btn = $('#syncBtn');
  btn.hidden = !sheetMode();
  btn.classList.toggle('spinning', sync.busy);
  btn.classList.toggle('has-error', !!sync.error && !sync.busy);
  const n = pendingTx().length;
  btn.dataset.badge = n ? String(n) : '';
  btn.title = sync.busy ? 'Menyinkronkan…' : sync.error ? 'Gagal sinkron: ' + sync.error : 'Sinkron dengan Google Sheet';
}

function timeAgo(ts) {
  if (!ts) return 'belum pernah';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return dateLabel(toISO(new Date(ts)));
}

/* ================= Calculations ================= */
const txInMonth = (ym) => state.transactions.filter((t) => monthOf(t.date) === ym);
function totals(list) {
  let income = 0, expense = 0;
  for (const t of list) t.type === 'income' ? (income += t.amount) : (expense += t.amount);
  return { income, expense, net: income - expense };
}
function expenseByCategory(ym) {
  const map = new Map();
  for (const t of txInMonth(ym)) if (t.type === 'expense') map.set(t.category, (map.get(t.category) || 0) + t.amount);
  return map;
}
function budgetStatus(spent, limit) {
  const pct = limit > 0 ? spent / limit : 0;
  if (pct > 1) return { cls: 'critical', label: 'Melebihi', icon: ICON.x, pct };
  if (pct >= 0.8) return { cls: 'warning', label: 'Hampir habis', icon: ICON.alert, pct };
  return { cls: 'good', label: 'Aman', icon: ICON.check, pct };
}
const sortTx = (a, b) => (b.date.localeCompare(a.date)) || ((b.createdAt || b.row || 0) - (a.createdAt || a.row || 0));

/* ================= Rendering ================= */
const VIEW_TITLES = { home: 'Beranda', tx: 'Transaksi', budget: 'Budget', goals: 'Tabungan', more: 'Lainnya' };

function render() {
  const [my, mm] = ui.month.split('-').map(Number);
  $('#monthLabel').innerHTML = `<span class="m-long">${MONTHS[mm - 1]}</span><span class="m-short">${MONTHS_SHORT[mm - 1]}</span> ${my}`;
  $('#viewTitle').textContent = VIEW_TITLES[ui.view];
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== ui.view; });
  $$('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.goto === ui.view));
  $('.month-switch').style.visibility = ui.view === 'more' ? 'hidden' : '';
  $('#fab').hidden = !['home', 'tx'].includes(ui.view);
  renderSyncState();
  ({ home: renderHome, tx: renderTx, budget: renderBudget, goals: renderGoals, more: renderMore })[ui.view]();
}

function txItemHTML(t) {
  const c = catById(t.category);
  const sign = t.type === 'income' ? '+' : '−';
  const sub = [t.note || dateLabel(t.date), t.source].filter(Boolean).join(' · ');
  return `<button class="tx-item${t.pending ? ' pending' : ''}" data-edit-tx="${esc(t.id)}">
    <span class="tx-ico">${esc(c.icon)}</span>
    <span class="tx-main"><div class="tx-cat">${esc(c.name)}${t.pending ? ' <span class="pending-tag" title="Belum terkirim ke Google Sheet">⏳ antri</span>' : ''}</div><div class="tx-note">${esc(sub)}</div></span>
    <span class="tx-amt ${t.type === 'income' ? 'pos' : 'neg'}">${sign}${fmt(t.amount)}</span>
  </button>`;
}

const emptyHTML = (icon, text) => `<div class="empty"><span class="big">${icon}</span>${text}</div>`;

function renderHome() {
  const all = totals(state.transactions);
  const m = totals(txInMonth(ui.month));
  $('#totalBalance').textContent = fmt(all.net);
  $('#totalBalance').classList.toggle('neg', all.net < 0);
  $('#monthIncome').textContent = fmt(m.income);
  $('#monthExpense').textContent = fmt(m.expense);
  const sisa = m.net;
  $('#heroSub').textContent = state.transactions.length
    ? `${sisa >= 0 ? 'Sisa' : 'Defisit'} ${monthName(ui.month)}: ${fmt(Math.abs(sisa))}`
    : 'Mulai dengan menekan tombol + untuk mencatat transaksi.';

  // Budget alerts
  const spent = expenseByCategory(ui.month);
  const over = [], near = [];
  for (const [cid, limit] of Object.entries(state.budgets)) {
    if (!(limit > 0)) continue;
    const s = budgetStatus(spent.get(cid) || 0, limit);
    if (s.cls === 'critical') over.push(catById(cid).name);
    else if (s.cls === 'warning') near.push(catById(cid).name);
  }
  const alerts = [];
  if (over.length) alerts.push(`<div class="alert"><span class="status critical"><i class="dot"></i>${ICON.x} Melebihi</span><div>Budget terlampaui: <strong>${esc(over.join(', '))}</strong></div></div>`);
  if (near.length) alerts.push(`<div class="alert" style="border-left-color:var(--warning);background:var(--surface)"><span class="status warning"><i class="dot"></i>${ICON.alert} Hampir</span><div>Hampir habis: <strong>${esc(near.join(', '))}</strong></div></div>`);
  $('#budgetAlert').innerHTML = alerts.join('');
  $('#budgetAlert').style.display = alerts.length ? 'flex' : 'none';
  $('#budgetAlert').style.flexDirection = 'column';
  $('#budgetAlert').style.gap = '8px';

  renderTrend();
  renderBreakdown(spent, m.expense);
  renderSourceBreakdown();

  const recent = txInMonth(ui.month).sort(sortTx).slice(0, 5);
  $('#recentTx').innerHTML = recent.length
    ? `<div class="tx-list">${recent.map(txItemHTML).join('')}</div>`
    : emptyHTML('🧾', `Belum ada transaksi di ${monthName(ui.month)}.`);

  $('#installBanner').hidden = !(deferredInstall && !state.settings.installDismissed);
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function barPath(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function trendData() {
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(ui.month, -i));
  return months.map((ym) => ({ ym, ...totals(txInMonth(ym)) }));
}

function renderTrend() {
  const wrap = $('#trendChart');
  const data = trendData();
  const W = Math.max(280, Math.round(wrap.clientWidth || 320));
  const H = 200;
  const pad = { l: 44, r: 4, t: 10, b: 26 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.income, d.expense)), 0));
  const ticks = 4;
  const y = (v) => pad.t + ih - (v / max) * ih;
  const gw = iw / data.length;
  const bw = Math.max(6, Math.min(20, (gw - 16) / 2));
  const gap = 2;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Grafik pemasukan dan pengeluaran 6 bulan terakhir">`;
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const yy = Math.round(y(v)) + 0.5;
    svg += `<line class="${i === 0 ? 'axis-line' : 'grid-line'}" x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text class="tick" x="${pad.l - 8}" y="${yy + 4}" text-anchor="end">${i === 0 ? '0' : esc(fmtCompact(v))}</text>`;
  }
  data.forEach((d, i) => {
    const cx = pad.l + gw * i + gw / 2;
    const x1 = cx - bw - gap / 2, x2 = cx + gap / 2;
    const base = pad.t + ih;
    svg += `<g class="group" data-i="${i}">`;
    svg += `<path class="bar-in" d="${barPath(x1, y(d.income), bw, base - y(d.income), 4)}"/>`;
    svg += `<path class="bar-out" d="${barPath(x2, y(d.expense), bw, base - y(d.expense), 4)}"/>`;
    svg += `</g>`;
    svg += `<text class="tick${d.ym === ui.month ? ' current' : ''}" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(monthShort(d.ym))}</text>`;
    svg += `<rect class="hit" data-i="${i}" x="${pad.l + gw * i}" y="${pad.t}" width="${gw}" height="${ih + pad.b}"/>`;
  });
  svg += '</svg>';
  wrap.innerHTML = svg;

  const tip = $('#tooltip');
  const show = (i, evt) => {
    const d = data[i];
    wrap.classList.add('hovering');
    $$('.group', wrap).forEach((g) => g.classList.toggle('hot', g.dataset.i === String(i)));
    tip.innerHTML = `<div class="tt-title">${esc(monthName(d.ym))}</div>
      <div class="tt-row"><span><i class="swatch s1"></i>Pemasukan</span><b>${fmt(d.income)}</b></div>
      <div class="tt-row"><span><i class="swatch s2"></i>Pengeluaran</span><b>${fmt(d.expense)}</b></div>
      <div class="tt-row"><span>Selisih</span><b>${d.net < 0 ? '−' : ''}${fmt(Math.abs(d.net))}</b></div>`;
    tip.hidden = false;
    const rect = evt.target.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    let top = rect.top - th - 8;
    if (top < 8) top = rect.bottom + 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };
  const hide = () => { wrap.classList.remove('hovering'); tip.hidden = true; };
  $$('.hit', wrap).forEach((r) => {
    r.addEventListener('pointerenter', (e) => show(+r.dataset.i, e));
    r.addEventListener('click', (e) => { e.stopPropagation(); show(+r.dataset.i, e); });
  });
  wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  hideTooltip = hide;

  $('#trendTable').innerHTML = `<table class="data-table"><thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Selisih</th></tr></thead><tbody>${
    data.map((d) => `<tr><td>${esc(monthShort(d.ym))}</td><td>${fmt(d.income)}</td><td>${fmt(d.expense)}</td><td>${d.net < 0 ? '−' : ''}${fmt(Math.abs(d.net))}</td></tr>`).join('')
  }</tbody></table>`;
}
let hideTooltip = () => {};

function renderBreakdown(spent, totalExpense) {
  const rows = [...spent.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    $('#categoryBreakdown').innerHTML = emptyHTML('📊', 'Belum ada pengeluaran bulan ini.');
    return;
  }
  const max = rows[0][1];
  $('#categoryBreakdown').innerHTML = rows.map(([cid, amt]) => {
    const c = catById(cid);
    const pct = totalExpense ? Math.round((amt / totalExpense) * 100) : 0;
    return `<div class="cat-row" title="${esc(c.name)}: ${esc(fmt(amt))} (${pct}%)">
      <span class="cat-ico">${esc(c.icon)}</span>
      <span class="cat-name">${esc(c.name)}</span>
      <span class="cat-amt">${fmt(amt)}<small>${pct}%</small></span>
      <span class="cat-bar" aria-hidden="true"><i style="width:${Math.max(2, (amt / max) * 100)}%"></i></span>
    </div>`;
  }).join('');
}

function renderSourceBreakdown() {
  const map = new Map();
  for (const t of txInMonth(ui.month)) {
    if (t.type !== 'expense') continue;
    const k = t.source || 'Tanpa sumber';
    map.set(k, (map.get(k) || 0) + t.amount);
  }
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  $('#sourceCard').hidden = !rows.length;
  if (!rows.length) return;
  const total = rows.reduce((s, r) => s + r[1], 0);
  const max = rows[0][1];
  $('#sourceBreakdown').innerHTML = rows.map(([name, amt]) => {
    const pct = total ? Math.round((amt / total) * 100) : 0;
    return `<div class="cat-row" title="${esc(name)}: ${esc(fmt(amt))} (${pct}%)">
      <span class="cat-ico">${/paylater|kredit/i.test(name) ? '💳' : /tunai|cash/i.test(name) ? '💵' : '🏦'}</span>
      <span class="cat-name">${esc(name)}</span>
      <span class="cat-amt">${fmt(amt)}<small>${pct}%</small></span>
      <span class="cat-bar" aria-hidden="true"><i style="width:${Math.max(2, (amt / max) * 100)}%"></i></span>
    </div>`;
  }).join('');
}

function renderTx() {
  $$('.chip[data-filter]').forEach((c) => c.classList.toggle('active', c.dataset.filter === ui.txFilter));
  const monthTx = txInMonth(ui.month);
  const m = totals(monthTx);
  $('#txSummary').innerHTML = `
    <div><small>Pemasukan</small><b class="pos">${fmt(m.income)}</b></div>
    <div><small>Pengeluaran</small><b class="neg">${fmt(m.expense)}</b></div>
    <div><small>Selisih</small><b>${m.net < 0 ? '−' : ''}${fmt(Math.abs(m.net))}</b></div>`;

  const srcSel = $('#txSource');
  const sources = sourcesList();
  if (ui.source && !sources.includes(ui.source)) ui.source = '';
  srcSel.innerHTML = '<option value="">Semua sumber dana</option>' + sources.map((s) => `<option>${esc(s)}</option>`).join('');
  srcSel.value = ui.source;
  srcSel.hidden = !sources.length;

  const q = ui.search.trim().toLowerCase();
  const list = monthTx
    .filter((t) => ui.txFilter === 'all' || t.type === ui.txFilter)
    .filter((t) => !ui.source || t.source === ui.source)
    .filter((t) => !q || (t.note || '').toLowerCase().includes(q) || catById(t.category).name.toLowerCase().includes(q))
    .sort(sortTx);

  if (!list.length) {
    $('#txList').innerHTML = emptyHTML('🔍', monthTx.length ? 'Tidak ada transaksi yang cocok.' : `Belum ada transaksi di ${monthName(ui.month)}.<br>Tekan tombol + untuk menambah.`);
    return;
  }
  const groups = new Map();
  for (const t of list) { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); }
  $('#txList').innerHTML = [...groups.entries()].map(([date, items]) => {
    const g = totals(items);
    return `<div class="tx-group">
      <div class="tx-date"><span>${esc(dateLabel(date))}</span><span>${g.net < 0 ? '−' : '+'}${fmt(Math.abs(g.net))}</span></div>
      <div class="tx-list">${items.map(txItemHTML).join('')}</div>
    </div>`;
  }).join('');
}

function renderBudget() {
  const spent = expenseByCategory(ui.month);
  const entries = catsOf('expense').filter((c) => state.budgets[c.id] > 0);
  const totalLimit = entries.reduce((s, c) => s + state.budgets[c.id], 0);
  const totalSpentBudgeted = entries.reduce((s, c) => s + (spent.get(c.id) || 0), 0);
  const totalSpentAll = [...spent.values()].reduce((a, b) => a + b, 0);

  if (!entries.length) {
    $('#budgetTotal').innerHTML = `<h2>Belum ada budget</h2><p class="muted">Tentukan batas pengeluaran bulanan per kategori supaya pengeluaranmu terkendali.</p>
      <button class="btn btn-primary" data-action="edit-budgets" style="margin-top:8px">Atur budget sekarang</button>`;
    $('#budgetList').innerHTML = '';
    return;
  }

  const st = budgetStatus(totalSpentBudgeted, totalLimit);
  const remain = totalLimit - totalSpentBudgeted;
  const isCurrent = ui.month === monthOf(todayISO());
  const daysLeft = isCurrent ? daysInMonth(ui.month) - new Date().getDate() + 1 : 0;
  $('#budgetTotal').innerHTML = `
    <div class="b-head"><div class="hero-label">Total budget ${esc(monthName(ui.month))}</div>
      <span class="status ${st.cls}"><i class="dot"></i>${st.icon} ${st.label}</span></div>
    <div class="hero-value" style="font-size:24px">${fmt(totalSpentBudgeted)} <span class="muted" style="font-size:15px;font-weight:500">/ ${fmt(totalLimit)}</span></div>
    <div class="progress ${st.cls}"><i style="width:${Math.min(100, st.pct * 100)}%"></i></div>
    <div class="b-meta"><span>${remain >= 0 ? 'Sisa ' + fmt(remain) : 'Lebih ' + fmt(-remain)}</span>
      <span>${isCurrent && remain > 0 && daysLeft > 0 ? 'sekitar ' + fmt(remain / daysLeft) + '/hari' : ''}</span></div>
    ${totalSpentAll > totalSpentBudgeted ? `<p class="muted" style="margin-bottom:0">+ ${fmt(totalSpentAll - totalSpentBudgeted)} pengeluaran di kategori tanpa budget.</p>` : ''}`;

  $('#budgetList').innerHTML = entries
    .map((c) => ({ c, limit: state.budgets[c.id], used: spent.get(c.id) || 0 }))
    .sort((a, b) => (b.used / b.limit) - (a.used / a.limit))
    .map(({ c, limit, used }) => {
      const s = budgetStatus(used, limit);
      const left = limit - used;
      return `<div class="card budget-item">
        <div class="b-head">
          <div class="b-title"><span>${esc(c.icon)}</span><span>${esc(c.name)}</span></div>
          <span class="status ${s.cls}"><i class="dot"></i>${s.icon} ${s.label}</span>
        </div>
        <div class="progress ${s.cls}"><i style="width:${Math.min(100, s.pct * 100)}%"></i></div>
        <div class="b-meta"><span>${fmt(used)} / ${fmt(limit)} (${Math.round(s.pct * 100)}%)</span>
          <span>${left >= 0 ? 'Sisa ' + fmt(left) : 'Lebih ' + fmt(-left)}</span></div>
      </div>`;
    }).join('');
}

function renderGoals() {
  const goals = state.goals;
  const totalSaved = goals.reduce((s, g) => s + (g.saved || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.target || 0), 0);
  $('#goalsTotal').innerHTML = goals.length
    ? `<div class="hero-label">Total tabungan terkumpul</div>
       <div class="hero-value" style="font-size:24px">${fmt(totalSaved)}</div>
       <div class="progress"><i style="width:${totalTarget ? Math.min(100, (totalSaved / totalTarget) * 100) : 0}%"></i></div>
       <div class="b-meta"><span>dari ${fmt(totalTarget)}</span><span>${goals.length} target</span></div>`
    : `<h2>Belum ada target tabungan</h2><p class="muted">Buat target seperti dana darurat, liburan, atau DP rumah, lalu catat setoranmu.</p>`;

  $('#goalList').innerHTML = goals.map((g) => {
    const pct = g.target ? g.saved / g.target : 0;
    const done = pct >= 1;
    let hint = '';
    if (done) hint = '🎉 Target tercapai!';
    else if (g.deadline) {
      const now = new Date();
      const dl = parseISO(g.deadline);
      const months = (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth());
      const rest = g.target - g.saved;
      if (dl < parseISO(todayISO())) hint = `⏰ Tenggat ${esc(dateLabel(g.deadline))} sudah lewat · kurang ${fmt(rest)}`;
      else hint = `Tenggat ${esc(dateLabel(g.deadline))} · perlu sekitar ${fmt(rest / Math.max(1, months))}/bulan`;
    } else hint = `Kurang ${fmt(g.target - g.saved)}`;
    return `<div class="card goal-item">
      <div class="b-head">
        <div class="b-title"><span>🐷</span><span>${esc(g.name)}</span></div>
        ${done ? `<span class="status good"><i class="dot"></i>${ICON.check} Tercapai</span>` : `<span class="tag">${Math.round(pct * 100)}%</span>`}
      </div>
      <div class="progress ${done ? 'good' : ''}"><i style="width:${Math.min(100, pct * 100)}%"></i></div>
      <div class="b-meta"><span>${fmt(g.saved)} / ${fmt(g.target)}</span></div>
      <div class="goal-hint">${hint}</div>
      <div class="goal-actions">
        <button class="btn btn-small btn-primary" data-deposit="${esc(g.id)}">+ Setor / Tarik</button>
        <button class="btn btn-small" data-edit-goal="${esc(g.id)}">Ubah</button>
      </div>
    </div>`;
  }).join('');
}

function renderMore() {
  $('#themeSelect').value = state.settings.theme;
  const counts = new Map();
  state.transactions.forEach((t) => counts.set(t.category, (counts.get(t.category) || 0) + 1));
  const locked = sheetMode();
  const group = (type, title) => `<div class="cat-group-title">${title}</div>` + catsOf(type).map((c) => `
    <div class="cat-setting">
      <button ${locked ? 'disabled' : `data-edit-cat="${esc(c.id)}"`}><span class="cat-ico">${esc(c.icon)}</span><span class="cat-name">${esc(c.name)}</span></button>
      <span class="tag">${counts.get(c.id) || 0} transaksi</span>
    </div>`).join('');
  $('#categoryList').innerHTML = (locked ? '<p class="muted" style="margin-top:0">Kategori & sumber dana diambil dari sheet <strong>Dropdown</strong>. Ubah di Google Sheet, lalu sinkron.</p>' : '')
    + group('expense', 'Pengeluaran') + group('income', 'Pemasukan');
  $('[data-action="new-category"]').hidden = locked;
  $('#dataNote').textContent = locked
    ? 'Transaksi tersimpan di Google Sheet. Budget dan target tabungan tersimpan di HP ini saja, jadi tetap buat cadangan sesekali.'
    : 'Data tersimpan di perangkat ini saja (di browser). Rutin buat cadangan supaya tidak hilang, dan pakai file cadangan untuk memindahkan data ke HP lain.';
  $('#installBtn').hidden = !deferredInstall;
  renderSheetCard();
}

function renderSheetCard() {
  const connected = sheetMode();
  $('#sheetConnect').hidden = connected;
  $('#sheetStatus').hidden = !connected;
  if (!connected) return;
  const n = state.transactions.filter((t) => !t.pending).length;
  const pending = pendingTx().length;
  $('#sheetInfo').innerHTML = `
    <div class="b-head"><strong>✅ Terhubung ke Google Sheet</strong></div>
    <div class="muted">${n} transaksi · sinkron terakhir ${esc(timeAgo(state.settings.sheet.lastSync))}</div>
    ${pending ? `<div class="muted">⏳ ${pending} transaksi menunggu dikirim ke Sheet</div>` : ''}
    ${sync.error ? `<div class="form-error">⚠️ ${esc(sync.error)}</div>` : ''}`;
}

// Accept what people typically paste and turn it into the Web App /exec URL, or say what's wrong.
function normalizeSheetUrl(raw) {
  const u = String(raw || '').trim();
  const where = 'Di Apps Script buka Terapkan › Kelola deployment, lalu salin "URL aplikasi web" (berakhiran /exec).';
  if (!u) return { error: 'Isi URL Web App. ' + where };
  if (/^http:\/\/localhost[:/]/.test(u)) return { url: u };
  // A bare deployment ID (AKfycb…) is enough to build the URL.
  if (/^AKfy[\w-]{20,}$/.test(u)) return { url: `https://script.google.com/macros/s/${u}/exec` };
  if (/docs\.google\.com\/spreadsheets/.test(u)) return { error: 'Itu URL Google Sheet, bukan URL Web App. ' + where };
  if (/script\.google\.com\/(home|d\/)/.test(u) || /\/edit(\b|$)/.test(u)) return { error: 'Itu URL editor Apps Script, bukan URL Web App. ' + where };
  const m = u.match(/^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+|macros)\/(?:u\/\d+\/)?s\/([\w-]+)\/(exec|dev)\b/);
  if (!m) return { error: 'URL tidak dikenali. ' + where };
  if (m[2] === 'dev') return { error: 'Itu URL uji (berakhiran /dev) yang hanya bisa dipakai di browser pemilik. ' + where };
  // Drop account selectors like /u/1/ that force a Google login page.
  return { url: `https://script.google.com/macros/s/${m[1]}/exec` };
}

async function connectSheet(e) {
  e.preventDefault();
  const f = e.target;
  const token = f.token.value.trim();
  const err = $('#sheetError');
  err.textContent = '';
  const parsed = normalizeSheetUrl(f.url.value);
  if (parsed.error) { err.textContent = parsed.error; return; }
  const url = parsed.url;
  f.url.value = url;
  if (!token) { err.textContent = 'Isi kode rahasia (TOKEN) yang kamu tulis di Apps Script.'; return; }
  const local = state.transactions.length;
  if (local && !(await ask(`${local} transaksi yang ada di HP ini akan diganti dengan data dari Google Sheet. Buat cadangan dulu kalau perlu. Lanjut?`, { ok: 'Lanjut' }))) return;

  const backup = JSON.stringify(state);
  state.settings.sheet = { url, token, lastSync: 0 };
  state.transactions = [];
  const ok = await withBusy(f, () => sheetApi({ action: 'read' }));
  if (!ok) {
    state = normalize(JSON.parse(backup));
    save();
    return;
  }
  // Budgets keyed by the old local category ids no longer match Sheet categories.
  state.budgets = Object.fromEntries(Object.entries(state.budgets).filter(([id]) => state.categories.some((c) => c.id === id)));
  save();
  f.reset();
  toast(`Terhubung · ${state.transactions.length} transaksi dimuat`);
  render();
}

async function disconnectSheet() {
  const pending = pendingTx().length;
  const msg = pending
    ? `Masih ada ${pending} transaksi yang belum terkirim ke Sheet dan akan tetap tersimpan di HP saja. Putuskan sambungan?`
    : 'Putuskan sambungan ke Google Sheet? Data terakhir tetap tersimpan di HP ini, tapi tidak akan tersinkron lagi.';
  if (!(await ask(msg, { ok: 'Putuskan', danger: true }))) return;
  state.settings.sheet = null;
  state.transactions.forEach((t) => { delete t.pending; delete t.row; });
  state = normalize(state);
  save();
  toast('Sambungan diputus');
  render();
}

/* ================= Money inputs ================= */
function formatMoneyInput(el) {
  const n = parseMoney(el.value);
  el.value = n ? numFmt.format(n) : '';
}
document.addEventListener('input', (e) => {
  if (e.target.classList && e.target.classList.contains('money')) formatMoneyInput(e.target);
});
const setMoney = (el, n) => { el.value = n ? numFmt.format(n) : ''; };

/* ================= Dialogs ================= */
// In-app replacement for window.confirm(), so every message uses the app font and styling.
function ask(message, { ok = 'Ya', danger = false } = {}) {
  const d = $('#askDialog');
  $('#askMessage').textContent = message;
  const okBtn = $('#askOk');
  okBtn.textContent = ok;
  okBtn.className = 'btn ' + (danger ? 'btn-danger-solid' : 'btn-primary');
  return new Promise((resolve) => {
    const done = (v) => { d.removeEventListener('close', onClose); d.onclick = null; if (d.open) d.close(); resolve(v); };
    const onClose = () => done(false);
    d.addEventListener('close', onClose);
    d.onclick = (e) => {
      const b = e.target.closest('[data-ask]');
      if (b) done(b.dataset.ask === 'yes');
      else if (e.target === d) done(false);
    };
    openDialog(d);
    okBtn.focus();
  });
}

function openDialog(d) {
  hideTooltip();
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
function closeDialog(d) { if (d.open) d.close(); }
$$('dialog').forEach((d) => {
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-close]')) closeDialog(d);
  });
});

// Transaction dialog
let editingTx = null;
// Pre-select the source used most recently, since most entries come from the same account.
function lastSource() {
  const t = [...state.transactions].sort(sortTx).find((x) => x.source);
  return t ? t.source : '';
}
function fillCategorySelect(type, selected) {
  const sel = $('#txForm').category;
  sel.innerHTML = catsOf(type).map((c) => `<option value="${esc(c.id)}">${esc(c.icon)} ${esc(c.name)}</option>`).join('');
  if (selected && catsOf(type).some((c) => c.id === selected)) sel.value = selected;
}
function openTx(tx) {
  editingTx = tx || null;
  const f = $('#txForm');
  f.reset();
  $('#txError').textContent = '';
  const type = tx ? tx.type : 'expense';
  f.type.value = type;
  fillCategorySelect(type, tx && tx.category);
  setMoney(f.amount, tx ? tx.amount : 0);
  const cur = monthOf(todayISO());
  f.date.value = tx ? tx.date : (ui.month === cur ? todayISO() : ui.month + '-01');
  f.note.value = tx ? tx.note || '' : '';
  const sources = sourcesList();
  f.source.innerHTML = '<option value="">—</option>' + sources.map((x) => `<option>${esc(x)}</option>`).join('');
  f.source.value = tx ? tx.source || '' : (ui.source || lastSource() || sources[0] || '');
  $('#txDialogTitle').textContent = tx ? 'Ubah transaksi' : 'Tambah transaksi';
  $('#txDelete').hidden = !tx;
  openDialog($('#txDialog'));
  if (!tx) setTimeout(() => f.amount.focus(), 50);
}
$$('#txForm input[name="type"]').forEach((r) => r.addEventListener('change', () => fillCategorySelect(r.value)));
$('#txForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const amount = parseMoney(f.amount.value);
  if (!amount) { $('#txError').textContent = 'Masukkan nominal lebih dari 0.'; return; }
  if (!f.date.value) { $('#txError').textContent = 'Pilih tanggal.'; return; }
  if (!f.category.value) { $('#txError').textContent = 'Pilih kategori.'; return; }
  const data = { type: f.type.value, amount, category: f.category.value, date: f.date.value, note: f.note.value.trim(), source: f.source.value };
  const wasEdit = !!editingTx;

  if (sheetMode() && editingTx && !editingTx.pending) {
    // Existing Sheet row: change it in the Sheet first, local copy follows from the response.
    const ok = await withBusy(f, () => sheetApi({ action: 'update', row: editingTx.row, orig: txPayload(editingTx), tx: data }));
    if (!ok) return;
  } else if (editingTx) {
    Object.assign(editingTx, data);
    save();
  } else {
    state.transactions.push({ id: uid(), createdAt: Date.now(), ...data, pending: sheetMode() || undefined });
    save();
  }
  closeDialog($('#txDialog'));
  toast(wasEdit ? 'Transaksi diperbarui' : 'Transaksi tersimpan');
  if (monthOf(data.date) !== ui.month) ui.month = monthOf(data.date);
  render();
  if (sheetMode() && pendingTx().length) syncNow({ quiet: true });
});
$('#txDelete').addEventListener('click', async () => {
  if (!editingTx || !(await ask('Hapus transaksi ini?', { ok: 'Hapus', danger: true }))) return;
  if (sheetMode() && !editingTx.pending) {
    const ok = await withBusy($('#txForm'), () => sheetApi({ action: 'delete', row: editingTx.row, orig: txPayload(editingTx) }));
    if (!ok) return;
  } else {
    state.transactions = state.transactions.filter((t) => t !== editingTx);
    save();
  }
  closeDialog($('#txDialog'));
  toast('Transaksi dihapus');
  render();
});

// Disable a form's buttons while a Sheet request runs; show errors inside the form.
async function withBusy(form, fn) {
  const buttons = $$('button', form);
  const errEl = $('.form-error', form);
  buttons.forEach((b) => { b.disabled = true; });
  const submit = $('button[type=submit]', form);
  const label = submit.textContent;
  submit.textContent = 'Menyimpan ke Sheet…';
  errEl.textContent = '';
  try {
    await fn();
    return true;
  } catch (err) {
    errEl.textContent = err instanceof NetworkError && navigator.onLine === false
      ? 'Tidak ada koneksi internet. Mengubah/menghapus data di Sheet butuh internet.'
      : err.message;
    return false;
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
    submit.textContent = label;
  }
}

// Budget dialog
function openBudgets() {
  $('#budgetFields').innerHTML = catsOf('expense').map((c) => `
    <label class="budget-field">
      <span class="b-title"><span>${esc(c.icon)}</span><span>${esc(c.name)}</span></span>
      <span class="money-wrap"><span>Rp</span><input class="input money" inputmode="numeric" data-budget="${esc(c.id)}" placeholder="—" value="${state.budgets[c.id] ? numFmt.format(state.budgets[c.id]) : ''}"></span>
    </label>`).join('');
  openDialog($('#budgetDialog'));
}
$('#budgetForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const budgets = {};
  $$('[data-budget]', e.target).forEach((i) => { const v = parseMoney(i.value); if (v > 0) budgets[i.dataset.budget] = v; });
  state.budgets = budgets;
  save();
  closeDialog($('#budgetDialog'));
  toast('Budget disimpan');
  render();
});

// Goal dialog
let editingGoal = null;
function openGoal(goal) {
  editingGoal = goal || null;
  const f = $('#goalForm');
  f.reset();
  $('#goalError').textContent = '';
  f.name.value = goal ? goal.name : '';
  setMoney(f.target, goal ? goal.target : 0);
  setMoney(f.saved, goal ? goal.saved : 0);
  f.deadline.value = goal ? goal.deadline || '' : '';
  $('#goalDialogTitle').textContent = goal ? 'Ubah target' : 'Target baru';
  $('#goalDelete').hidden = !goal;
  openDialog($('#goalDialog'));
}
$('#goalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const target = parseMoney(f.target.value);
  if (!name) { $('#goalError').textContent = 'Isi nama target.'; return; }
  if (!target) { $('#goalError').textContent = 'Masukkan target nominal lebih dari 0.'; return; }
  const data = { name, target, saved: parseMoney(f.saved.value), deadline: f.deadline.value || '' };
  if (editingGoal) Object.assign(editingGoal, data);
  else state.goals.push({ id: uid(), createdAt: Date.now(), ...data });
  save();
  closeDialog($('#goalDialog'));
  toast('Target disimpan');
  render();
});
$('#goalDelete').addEventListener('click', async () => {
  if (!editingGoal || !(await ask(`Hapus target "${editingGoal.name}"?`, { ok: 'Hapus', danger: true }))) return;
  state.goals = state.goals.filter((g) => g !== editingGoal);
  save();
  closeDialog($('#goalDialog'));
  toast('Target dihapus');
  render();
});

// Deposit dialog
let depositGoal = null;
function updateDepositLabel() {
  const out = $('#depositForm').kind.value === 'out';
  $('#depositRecordLabel').textContent = out
    ? 'Catat juga sebagai pemasukan (menambah saldo)'
    : `Catat juga sebagai pengeluaran "${catById(savingsCategory(false)).name}" (mengurangi saldo)`;
}
function openDeposit(goal) {
  depositGoal = goal;
  const f = $('#depositForm');
  f.reset();
  $('#depositError').textContent = '';
  f.date.value = todayISO();
  $('#depositTitle').textContent = goal.name;
  updateDepositLabel();
  openDialog($('#depositDialog'));
  setTimeout(() => f.amount.focus(), 50);
}
$$('#depositForm input[name="kind"]').forEach((r) => r.addEventListener('change', updateDepositLabel));
$('#depositForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const amount = parseMoney(f.amount.value);
  const out = f.kind.value === 'out';
  if (!amount) { $('#depositError').textContent = 'Masukkan nominal lebih dari 0.'; return; }
  if (out && amount > depositGoal.saved) { $('#depositError').textContent = `Maksimal ${fmt(depositGoal.saved)}.`; return; }
  depositGoal.saved = (depositGoal.saved || 0) + (out ? -amount : amount);
  if (f.record.checked) {
    state.transactions.push({
      id: uid(), createdAt: Date.now(), amount, date: f.date.value || todayISO(),
      type: out ? 'income' : 'expense',
      category: savingsCategory(out),
      note: `${out ? 'Tarik dari' : 'Setor ke'} ${depositGoal.name}`,
      source: lastSource(),
      pending: sheetMode() || undefined,
    });
  }
  save();
  closeDialog($('#depositDialog'));
  toast(out ? 'Penarikan dicatat' : 'Setoran dicatat');
  render();
  if (sheetMode() && pendingTx().length) syncNow({ quiet: true });
});

// Category dialog
let editingCat = null;
function openCategory(cat) {
  editingCat = cat || null;
  const f = $('#catForm');
  f.reset();
  $('#catError').textContent = '';
  f.type.value = cat ? cat.type : 'expense';
  $$('input[name="type"]', f).forEach((r) => { r.disabled = !!cat; });
  f.icon.value = cat ? cat.icon : '';
  f.name.value = cat ? cat.name : '';
  $('#catDialogTitle').textContent = cat ? 'Ubah kategori' : 'Kategori baru';
  const protectedIds = ['other-exp', 'other-inc', 'savings'];
  $('#catDelete').hidden = !cat || protectedIds.includes(cat.id);
  openDialog($('#catDialog'));
}
$('#catForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  if (!name) { $('#catError').textContent = 'Isi nama kategori.'; return; }
  const icon = f.icon.value.trim() || '🏷️';
  if (editingCat) Object.assign(editingCat, { name, icon });
  else state.categories.push({ id: 'c-' + uid(), type: f.type.value, icon, name });
  save();
  closeDialog($('#catDialog'));
  toast('Kategori disimpan');
  render();
});
$('#catDelete').addEventListener('click', async () => {
  const c = editingCat;
  if (!c) return;
  const fallback = c.type === 'income' ? 'other-inc' : 'other-exp';
  const used = state.transactions.filter((t) => t.category === c.id).length;
  const msg = used ? `Hapus kategori "${c.name}"? ${used} transaksi akan dipindah ke "Lainnya".` : `Hapus kategori "${c.name}"?`;
  if (!(await ask(msg, { ok: 'Hapus', danger: true }))) return;
  state.transactions.forEach((t) => { if (t.category === c.id) t.category = fallback; });
  delete state.budgets[c.id];
  state.categories = state.categories.filter((x) => x !== c);
  save();
  closeDialog($('#catDialog'));
  toast('Kategori dihapus');
  render();
});

/* ================= Import / export ================= */
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  // Never put the Sheet URL/secret into a file that may get shared.
  const copy = { ...state, settings: { ...state.settings, sheet: null } };
  download(`budgetplanner-cadangan-${todayISO()}.json`, JSON.stringify(copy, null, 2), 'application/json');
  toast('File cadangan diunduh');
}
function exportCSV() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan', 'Sumber Dana']];
  [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
    rows.push([t.date, t.type === 'income' ? 'Pemasukan' : 'Pengeluaran', catById(t.category).name, t.amount, t.note || '', t.source || '']);
  });
  download(`budgetplanner-transaksi-${todayISO()}.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV diunduh');
}
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.transactions)) throw new Error('format');
    if (sheetMode()) {
      // Transactions live in the Sheet; only restore what the app keeps locally.
      if (!(await ask('Terhubung ke Google Sheet: hanya budget, target tabungan, dan tema yang dipulihkan. Transaksi tetap dari Sheet. Lanjut?', { ok: 'Pulihkan' }))) return;
      const restored = normalize(data);
      state.budgets = restored.budgets;
      state.goals = restored.goals;
      state.settings.theme = restored.settings.theme;
    } else {
      if (!(await ask(`Pulihkan ${data.transactions.length} transaksi dari cadangan? Data saat ini akan diganti.`, { ok: 'Pulihkan' }))) return;
      state = normalize({ ...data, settings: { ...(data.settings || {}), sheet: null } });
    }
    save();
    applyTheme();
    toast('Data berhasil dipulihkan');
    render();
  } catch (err) {
    toast('⚠️ File cadangan tidak valid');
  }
});

/* ================= Theme ================= */
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  requestAnimationFrame(() => {
    $('#themeColor').setAttribute('content', getComputedStyle(document.body).backgroundColor);
  });
}
$('#themeSelect').addEventListener('change', (e) => {
  state.settings.theme = e.target.value;
  save();
  applyTheme();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ================= Toast ================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================= Install (PWA) ================= */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  render();
});
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Aplikasi terpasang 🎉'); render(); });
async function promptInstall() {
  if (!deferredInstall) { toast('Gunakan menu browser, lalu pilih "Tambahkan ke layar utama"'); return; }
  deferredInstall.prompt();
  await deferredInstall.userChoice.catch(() => {});
  deferredInstall = null;
  render();
}

/* ================= Global events ================= */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-goto],[data-action],[data-edit-tx],[data-edit-goal],[data-deposit],[data-edit-cat],[data-filter]');
  if (!el) { hideTooltip(); return; }
  if (el.dataset.goto) { ui.view = el.dataset.goto; window.scrollTo(0, 0); render(); return; }
  if (el.dataset.editTx) { openTx(state.transactions.find((t) => t.id === el.dataset.editTx)); return; }
  if (el.dataset.editGoal) { openGoal(state.goals.find((g) => g.id === el.dataset.editGoal)); return; }
  if (el.dataset.deposit) { openDeposit(state.goals.find((g) => g.id === el.dataset.deposit)); return; }
  if (el.dataset.editCat) { openCategory(state.categories.find((c) => c.id === el.dataset.editCat)); return; }
  if (el.dataset.filter) { ui.txFilter = el.dataset.filter; render(); return; }
  switch (el.dataset.action) {
    case 'edit-budgets': openBudgets(); break;
    case 'new-goal': openGoal(); break;
    case 'new-category': openCategory(); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'install': promptInstall(); break;
    case 'sync': syncNow(); break;
    case 'disconnect-sheet': disconnectSheet(); break;
    case 'dismiss-install': state.settings.installDismissed = true; save(); render(); break;
    case 'reset': resetAll(); break;
  }
});
async function resetAll() {
  const ok = await ask(sheetMode()
    ? 'Hapus semua data di HP ini dan putuskan dari Google Sheet? Isi Google Sheet TIDAK ikut terhapus.'
    : 'Hapus SEMUA data (transaksi, budget, tabungan, kategori)? Tindakan ini tidak bisa dibatalkan.', { ok: 'Hapus semua', danger: true });
  if (!ok) return;
  state = defaults(); save(); applyTheme(); toast('Semua data dihapus'); render();
}
$('#fab').addEventListener('click', () => openTx());
$('#sheetConnect').addEventListener('submit', connectSheet);
$('#syncBtn').addEventListener('click', () => syncNow());
// Pull fresh data whenever the app comes back to the foreground or the connection returns.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - sync.lastTry > 30000) syncNow({ quiet: true });
});
window.addEventListener('online', () => syncNow({ quiet: true }));
$('#prevMonth').addEventListener('click', () => { ui.month = shiftMonth(ui.month, -1); render(); });
$('#nextMonth').addEventListener('click', () => { ui.month = shiftMonth(ui.month, 1); render(); });
$('#monthLabel').addEventListener('click', () => { ui.month = monthOf(todayISO()); render(); });
$('#txSearch').addEventListener('input', (e) => { ui.search = e.target.value; renderTx(); });
$('#txSource').addEventListener('change', (e) => { ui.source = e.target.value; renderTx(); });
window.addEventListener('scroll', () => hideTooltip(), { passive: true });

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (ui.view === 'home') renderTrend(); }, 120);
});

// Keep data in sync if the app is open in two tabs.
window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { state = load(); applyTheme(); render(); } });

/* ================= Boot ================= */
applyTheme();
render();
syncNow({ quiet: true });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

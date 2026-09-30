/**
 * Budget Planner — penghubung Google Sheet (sinkron 2 arah).
 *
 * Cara pasang (lihat README untuk versi bergambar):
 *  1. Buka Google Sheet kamu → Ekstensi → Apps Script.
 *  2. Hapus isi Code.gs bawaan, tempel seluruh file ini.
 *  3. Ganti TOKEN di bawah dengan kode rahasia buatanmu sendiri (min. 12 karakter).
 *  4. Simpan → Terapkan (Deploy) → Deployment baru → jenis "Aplikasi web":
 *       - Jalankan sebagai: Saya
 *       - Yang memiliki akses: Siapa saja
 *  5. Salin URL aplikasi web (berakhiran /exec), lalu tempel di aplikasi
 *     Budget Planner → Lainnya → Sinkron Google Sheet, bersama kode rahasianya.
 *
 * Sheet tetap privat: hanya yang tahu URL + kode rahasia yang bisa membaca/menulis.
 */

const TOKEN = 'GANTI-DENGAN-KODE-RAHASIA-KAMU';

const SHEET_TX = 'Data Transaksi';
const SHEET_DROPDOWN = 'Dropdown';
// Kolom di sheet "Data Transaksi" (1 = A).
const COL = { date: 1, type: 2, category: 3, note: 4, amount: 5, source: 6, month: 7, year: 8 };
const NUM_COLS = 8;
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function doGet() {
  return json_({ ok: true, message: 'Budget Planner connector aktif. Tempel URL ini di aplikasi.' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Permintaan tidak valid.' });
  }
  return json_(handle_(req));
}

function handle_(req) {
  try {
    if (!TOKEN || TOKEN.indexOf('GANTI') === 0 || TOKEN.length < 12) {
      throw new Error('TOKEN di Apps Script belum diganti (minimal 12 karakter).');
    }
    if (String(req.token || '') !== TOKEN) throw new Error('Kode rahasia salah.');

    const action = req.action || 'read';
    if (action !== 'read') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        if (action === 'add') addTx_(req.tx);
        else if (action === 'update') updateTx_(req.row, req.orig, req.tx);
        else if (action === 'delete') deleteTx_(req.row, req.orig);
        else throw new Error('Aksi tidak dikenal: ' + action);
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
    }
    const data = readAll_();
    data.ok = true;
    return data;
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/* ---------- Baca ---------- */

function readAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const values = txSheet_().getDataRange().getValues();
  const transactions = [];
  for (let i = 1; i < values.length; i++) {
    const tx = rowToTx_(values[i], tz);
    if (tx) {
      tx.row = i + 1;
      transactions.push(tx);
    }
  }
  return Object.assign({ transactions: transactions }, readLists_());
}

function readLists_() {
  const out = { incomeCategories: [], expenseCategories: [], sources: [] };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DROPDOWN);
  if (!sh) return out;
  const values = sh.getDataRange().getValues();
  const col = function (c) {
    const list = [];
    for (let i = 1; i < values.length; i++) {
      const v = String(values[i][c] == null ? '' : values[i][c]).trim();
      if (/^catatan/i.test(v)) break;
      if (v && list.indexOf(v) === -1) list.push(v);
    }
    return list;
  };
  const income = col(0);
  const expense = col(1);
  // Kolom F ("Semua Kategori") bisa berisi kategori pengeluaran tambahan.
  col(5).forEach(function (name) {
    if (income.indexOf(name) === -1 && expense.indexOf(name) === -1) expense.push(name);
  });
  out.incomeCategories = income;
  out.expenseCategories = expense;
  out.sources = col(2);
  return out;
}

function rowToTx_(r, tz) {
  const date = toIso_(r[COL.date - 1], tz);
  const type = normType_(r[COL.type - 1]);
  const amount = toNumber_(r[COL.amount - 1]);
  if (!date || !type || !amount) return null;
  return {
    date: date,
    type: type,
    category: String(r[COL.category - 1] == null ? '' : r[COL.category - 1]).trim(),
    note: String(r[COL.note - 1] == null ? '' : r[COL.note - 1]).trim(),
    amount: amount,
    source: String(r[COL.source - 1] == null ? '' : r[COL.source - 1]).trim(),
  };
}

/* ---------- Tulis ---------- */

function addTx_(tx) {
  tx = validate_(tx);
  const sh = txSheet_();
  const target = lastDataRow_(sh) + 1;
  if (target > 2) {
    const prev = sh.getRange(target - 1, 1, 1, NUM_COLS);
    const dest = sh.getRange(target, 1, 1, NUM_COLS);
    prev.copyTo(dest, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    prev.copyTo(dest, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }
  writeRow_(sh, target, tx);
}

function updateTx_(row, orig, tx) {
  tx = validate_(tx);
  const sh = txSheet_();
  writeRow_(sh, locate_(sh, row, orig), tx);
}

function deleteTx_(row, orig) {
  const sh = txSheet_();
  sh.deleteRow(locate_(sh, row, orig));
}

function writeRow_(sh, row, tx) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const date = Utilities.parseDate(tx.date, tz, 'yyyy-MM-dd');
  sh.getRange(row, 1, 1, 6).setValues([[
    date,
    tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    tx.category,
    tx.note,
    tx.amount,
    tx.source,
  ]]);
  // Kolom Bulan & Tahun: ikuti rumus baris sebelumnya jika ada, kalau tidak isi nilainya.
  const m = Number(tx.date.slice(5, 7));
  const computed = [m + '. ' + MONTHS[m - 1], Number(tx.date.slice(0, 4))];
  const cols = [COL.month, COL.year];
  for (let i = 0; i < cols.length; i++) {
    const cell = sh.getRange(row, cols[i]);
    if (cell.getFormulaR1C1()) continue;
    const prevFormula = row > 2 ? sh.getRange(row - 1, cols[i]).getFormulaR1C1() : '';
    if (prevFormula) cell.setFormulaR1C1(prevFormula);
    else cell.setValue(computed[i]);
  }
}

// Cari baris yang dimaksud; pastikan isinya masih sama dengan yang dilihat aplikasi.
function locate_(sh, row, orig) {
  if (!orig) throw new Error('Data transaksi asli tidak dikirim.');
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const values = sh.getDataRange().getValues();
  const same = function (i) {
    const t = rowToTx_(values[i], tz);
    return !!t && t.date === orig.date && t.type === orig.type && t.category === String(orig.category || '') &&
      t.note === String(orig.note || '') && t.amount === Number(orig.amount) && t.source === String(orig.source || '');
  };
  const idx = Number(row) - 1;
  if (idx >= 1 && idx < values.length && same(idx)) return idx + 1;
  for (let i = 1; i < values.length; i++) if (same(i)) return i + 1;
  throw new Error('Transaksi ini sudah berubah atau terhapus di Sheet. Sinkron ulang lalu coba lagi.');
}

function validate_(tx) {
  if (!tx) throw new Error('Data transaksi kosong.');
  const out = {
    date: String(tx.date || ''),
    type: tx.type === 'income' ? 'income' : tx.type === 'expense' ? 'expense' : '',
    category: String(tx.category || '').trim().slice(0, 100),
    note: String(tx.note || '').trim().slice(0, 200),
    amount: Number(tx.amount),
    source: String(tx.source || '').trim().slice(0, 60),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error('Tanggal tidak valid.');
  if (!out.type) throw new Error('Jenis transaksi tidak valid.');
  if (!out.category) throw new Error('Kategori wajib diisi.');
  if (!isFinite(out.amount) || out.amount <= 0) throw new Error('Nominal harus lebih dari 0.');
  // Cegah teks diperlakukan sebagai rumus oleh Sheets.
  ['category', 'note', 'source'].forEach(function (k) {
    if (/^[=+\-@]/.test(out[k])) out[k] = "'" + out[k];
  });
  return out;
}

/* ---------- Bantuan ---------- */

function txSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TX);
  if (!sh) throw new Error('Sheet "' + SHEET_TX + '" tidak ditemukan.');
  return sh;
}

function lastDataRow_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return 1;
  const col = sh.getRange(1, COL.date, last, 1).getValues();
  for (let i = col.length - 1; i >= 1; i--) {
    if (col[i][0] !== '' && col[i][0] != null) return i + 1;
  }
  return 1;
}

function toIso_(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // dd/mm/yyyy
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return '';
}

function toNumber_(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v);
  const neg = /^\s*-/.test(s);
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return 0;
  return (neg ? -1 : 1) * Number(digits);
}

function normType_(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (s === 'pemasukan') return 'income';
  if (s === 'pengeluaran') return 'expense';
  return '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

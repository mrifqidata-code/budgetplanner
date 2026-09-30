# 💰 Budget Planner

Aplikasi pencatat keuangan pribadi yang bisa dibuka dan **dipasang di HP** (Progressive Web App). Tampilan bahasa Indonesia, mata uang Rupiah, dan tetap jalan **tanpa internet** setelah dibuka sekali.

## Fitur

- **Catat transaksi**: pemasukan & pengeluaran dengan kategori, tanggal, dan catatan. Bisa diubah/dihapus, dicari, dan difilter.
- **Budget per kategori**: batas pengeluaran bulanan per kategori dengan status *Aman / Hampir habis / Melebihi*, plus peringatan di beranda.
- **Grafik & ringkasan**: saldo total, pemasukan/pengeluaran bulan ini, tren 6 bulan, dan rincian pengeluaran per kategori.
- **Target tabungan**: buat target (mis. dana darurat), catat setoran/penarikan, lihat progres dan berapa yang perlu ditabung per bulan.
- **Kategori sendiri**: tambah, ubah, atau hapus kategori.
- **Cadangan data**: ekspor ke JSON (bisa dipulihkan) dan CSV (bisa dibuka di Excel/Google Sheets).
- **Tema terang/gelap**, otomatis mengikuti HP.

## Cara online-kan di GitHub Pages

1. Buka repo ini di GitHub → **Settings** → **Pages**.
2. Di *Build and deployment*, pilih **Source: Deploy from a branch**.
3. Pilih branch yang berisi aplikasi ini (mis. `main`) dan folder **`/ (root)`**, lalu **Save**.
4. Tunggu 1–2 menit. Aplikasi bisa dibuka di `https://<username>.github.io/budgetplanner/`.

## Cara pasang di HP

- **Android (Chrome)**: buka alamat di atas → menu ⋮ → **Instal aplikasi** / **Tambahkan ke layar utama**.
- **iPhone (Safari)**: buka alamat di atas → tombol **Bagikan** → **Tambahkan ke Layar Utama**.

## Tentang data

Semua data disimpan **di perangkat kamu sendiri** (localStorage browser), tidak dikirim ke server mana pun. Artinya:

- Data di HP dan di laptop **tidak otomatis sinkron**. Pindahkan dengan *Lainnya → Cadangkan data*, lalu *Pulihkan dari cadangan* di perangkat lain.
- Menghapus data browser/aplikasi akan menghapus data. **Rutin buat cadangan.**

## Struktur

```
index.html            halaman utama
css/style.css         tampilan (termasuk mode gelap)
js/app.js             logika aplikasi
sw.js                 service worker (mode offline)
manifest.webmanifest  info aplikasi untuk dipasang di HP
icons/                ikon aplikasi
```

Tidak butuh build tool. Untuk mencoba di komputer: `python3 -m http.server` lalu buka `http://localhost:8000`.

> Setiap kali mengubah file aplikasi, naikkan versi `CACHE` di `sw.js` (mis. `budgetplanner-v2`) supaya HP mengambil versi terbaru.

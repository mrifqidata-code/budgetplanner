# 💰 Budget Planner

Aplikasi pencatat keuangan pribadi yang bisa dibuka dan **dipasang di HP** (Progressive Web App). Tampilan bahasa Indonesia, mata uang Rupiah, dan tetap jalan **tanpa internet** setelah dibuka sekali.

## Fitur

- **Catat transaksi**: pemasukan & pengeluaran dengan kategori, tanggal, dan catatan. Bisa diubah/dihapus, dicari, dan difilter.
- **Budget per kategori**: batas pengeluaran bulanan per kategori dengan status *Aman / Hampir habis / Melebihi*, plus peringatan di beranda.
- **Grafik & ringkasan**: saldo total, pemasukan/pengeluaran bulan ini, tren 6 bulan, dan rincian pengeluaran per kategori.
- **Target tabungan**: buat target (mis. dana darurat), catat setoran/penarikan, lihat progres dan berapa yang perlu ditabung per bulan.
- **Kategori sendiri**: tambah, ubah, atau hapus kategori.
- **Cadangan data**: ekspor ke JSON (bisa dipulihkan) dan CSV (bisa dibuka di Excel/Google Sheets).
- **Tema terang/gelap**, otomatis mengikuti HP. Seluruh tampilan memakai font **Poppins**.
- **Sinkron 2 arah dengan Google Sheet** (opsional), termasuk **Sumber Dana** (BCA, PayLater, dll.) dan ringkasan per sumber dana.

## Cara online-kan di GitHub Pages

1. Buka repo ini di GitHub → **Settings** → **Pages**.
2. Di *Build and deployment*, pilih **Source: Deploy from a branch**.
3. Pilih branch yang berisi aplikasi ini (mis. `main`) dan folder **`/ (root)`**, lalu **Save**.
4. Tunggu 1–2 menit. Aplikasi bisa dibuka di `https://<username>.github.io/budgetplanner/`.

## Cara pasang di HP

- **Android (Chrome)**: buka alamat di atas → menu ⋮ → **Instal aplikasi** / **Tambahkan ke layar utama**.
- **iPhone (Safari)**: buka alamat di atas → tombol **Bagikan** → **Tambahkan ke Layar Utama**.

## Sinkron dengan Google Sheet

Aplikasi bisa tersambung 2 arah ke Google Sheet. Data diambil dari sheet **Data Transaksi**, dan transaksi yang dicatat di HP langsung masuk ke Sheet sebagai baris baru. Kategori dan sumber dana diambil dari sheet **Dropdown**.

Format yang didukung (baris 1 = judul kolom):

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Tanggal | Jenis (`Pemasukan`/`Pengeluaran`) | Kategori | Deskripsi/Catatan | Jumlah (Rp) | Sumber Dana | Bulan (`9. September`) | Tahun |

Sheet **Dropdown**: kolom A = kategori pemasukan, B = kategori pengeluaran, C = sumber dana, F = semua kategori.

### Langkah pemasangan (sekali saja, ±5 menit, sebaiknya dari laptop)

1. Buka Google Sheet kamu → menu **Ekstensi → Apps Script**.
2. Hapus isi file `Code.gs` yang muncul, lalu tempel seluruh isi [`apps-script/Code.gs`](apps-script/Code.gs) dari repo ini.
3. Di baris `const TOKEN = 'GANTI-DENGAN-KODE-RAHASIA-KAMU';`, ganti dengan kode rahasia buatanmu sendiri (minimal 12 karakter, mis. `kopi-pagi-2026-xyz`). **Jangan bagikan kode ini.**
4. Klik 💾 **Simpan**.
5. Klik **Terapkan (Deploy) → Deployment baru**. Pada ikon ⚙️ pilih **Aplikasi web**, lalu isi:
   - *Jalankan sebagai*: **Saya**
   - *Yang memiliki akses*: **Siapa saja**
6. Klik **Terapkan**, lalu izinkan akses. Kalau muncul peringatan "Google belum memverifikasi aplikasi ini", pilih *Lanjutan → Buka (tidak aman)*. Itu wajar karena skripnya milikmu sendiri.
7. Salin **URL aplikasi web** (berakhiran `/exec`).
8. Di aplikasi Budget Planner: **Lainnya → Sinkron Google Sheet**, lalu tempel URL dan kode rahasia, kemudian tekan **Hubungkan**.

Setelah terhubung:
- Aplikasi mengambil data terbaru setiap dibuka. Kamu juga bisa menekan tombol ⟳ di atas.
- Transaksi yang dicatat saat **offline** masuk antrian (⏳) dan otomatis terkirim saat online kembali.
- Mengubah atau menghapus transaksi dari aplikasi langsung mengubah baris di Sheet (butuh internet). Jika baris itu sudah diubah di Sheet sejak sinkron terakhir, aplikasi menolak dan meminta sinkron ulang, supaya tidak salah hapus.
- Budget dan target tabungan tetap disimpan di HP (tidak ditulis ke Sheet).

**Keamanan:** Sheet tetap privat. Hanya yang tahu URL **dan** kode rahasia yang bisa membaca atau menulis data. Keduanya hanya disimpan di HP kamu dan tidak ikut ke file cadangan. Jangan menaruh data transaksi di repo ini, karena repo-nya publik.

> Kalau nanti `Code.gs` diperbarui: tempel versi baru, lalu **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan**. URL-nya tetap sama.

## Tentang data

Tanpa Google Sheet, semua data disimpan **di perangkat kamu sendiri** (localStorage browser), tidak dikirim ke server mana pun. Artinya:

- Data di HP dan di laptop **tidak otomatis sinkron**. Pindahkan dengan *Lainnya → Cadangkan data*, lalu *Pulihkan dari cadangan* di perangkat lain. Atau gunakan sinkron Google Sheet di atas.
- Menghapus data browser/aplikasi akan menghapus data. **Rutin buat cadangan.**

## Struktur

```
index.html            halaman utama
css/style.css         tampilan (termasuk mode gelap)
js/app.js             logika aplikasi
sw.js                 service worker (mode offline)
apps-script/Code.gs   skrip penghubung Google Sheet (ditempel di Apps Script)
manifest.webmanifest  info aplikasi untuk dipasang di HP
icons/                ikon aplikasi
fonts/                font Poppins (lisensi SIL OFL, lihat fonts/OFL.txt)
```

Tidak butuh build tool. Untuk mencoba di komputer: `python3 -m http.server` lalu buka `http://localhost:8000`.

> Setiap kali mengubah file aplikasi, naikkan versi `CACHE` di `sw.js` (mis. `budgetplanner-v2`) supaya HP mengambil versi terbaru.

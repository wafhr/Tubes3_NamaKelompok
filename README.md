# Tubes3_NamaKelompok

## Deskripsi Program

Judol Detector adalah Chromium browser extension untuk mendeteksi konten judi online pada halaman web. Extension ini membaca daftar keyword dari `public/keywords/keyword.txt`, menjalankan algoritma pattern matching, lalu menyiapkan hasil deteksi untuk ditampilkan pada halaman dan popup extension.

## Algoritma

### Knuth-Morris-Pratt (KMP)

KMP digunakan untuk melakukan exact string matching terhadap setiap keyword. Algoritma ini membangun LPS table (Longest Proper Prefix which is also Suffix) dari pattern, lalu memakai tabel tersebut untuk menggeser pattern saat terjadi mismatch tanpa mengulang pemeriksaan karakter dari awal. Implementasi KMP dibuat from scratch dan menghitung jumlah perbandingan karakter selama preprocessing dan pencarian.

### Boyer-Moore (BM)

Boyer-Moore digunakan sebagai algoritma exact string matching alternatif. Algoritma ini membandingkan pattern dari kanan ke kiri dan menggunakan last occurrence table untuk menentukan pergeseran pattern saat terjadi mismatch. Implementasi BM dibuat from scratch dan menghitung jumlah perbandingan karakter selama proses pencarian.

## Requirements

- Node.js
- npm
- Google Chrome atau browser Chromium-based lainnya

## Instalasi

Install dependency project:

```bash
npm install
```

## Build

Build extension ke folder `dist/`:

```bash
npm run build
```

## Cara Load Extension di Chrome

1. Buka `chrome://extensions/`.
2. Aktifkan **Developer mode**.
3. Klik **Load unpacked**.
4. Pilih folder `dist/`.
5. Extension siap digunakan pada halaman web.

## Author

| Nama | NIM |
| --- | --- |
| Wafiq Hibban Robbany | 13524016 |
| Fayyaz Akmal Lauda | 13524076 |
| Syaqina Octavia Rizha | 13524088 |

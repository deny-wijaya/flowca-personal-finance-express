# PRD: Express Personal Finance (Backend API)

| | |
|---|---|
| **Produk** | Express Personal Finance, backend REST API untuk `next-personal-finance` |
| **Status** | Draft |
| **Pemilik** | Deny Wijaya |
| **Dibuat** | 2026-11-14 |
| **Versi** | 1.0 |
| **Repo** | `express-personal-finance` (Node 24+, Express 5, TypeScript) |
| **Frontend** | `next-personal-finance`, lihat `docs/PRD.md` di repo itu |

---

## 1. Ringkasan

Express Personal Finance adalah backend REST API yang menyimpan dan mengolah data transaksi keuangan pribadi. Konsumennya adalah server Next.js di `next-personal-finance`: Server Component dan Server Action di sana memanggil API ini lewat `API_BASE_URL=http://localhost:4000/api/v1`. Browser tidak memanggil API ini secara langsung.

Project ini punya dua tujuan sekaligus. Tujuan pertama adalah menyediakan API sesuai kontrak di PRD frontend bagian 8.4. Tujuan kedua adalah menjadi bahan belajar backend Express, sehingga pekerjaan dibagi per fase dan setiap fase punya topik belajar yang jelas (lihat bagian 10).

**Fakta singkat**

- **Konsumen API:** server Next.js `next-personal-finance` di port 3200.
- **Base URL lokal:** `http://localhost:4000/api/v1`.
- **Status sekarang:** boilerplate Fase 0 selesai. CRUD transaksi berjalan dengan data in-memory, 19 test lolos, dan frontend sudah terhubung (`DATA_SOURCE=api`).

---

## 2. Tujuan

### 2.1 Tujuan produk

1. Frontend bisa membaca, membuat, mengubah, dan menghapus transaksi lewat API tanpa mengubah kode UI.
2. Data tersimpan permanen di database dan hanya bisa diakses oleh pemiliknya.
3. Setiap error punya format JSON yang sama, sehingga frontend cukup punya satu cara untuk menanganinya.

### 2.2 Tujuan belajar

1. Memahami alur request di Express: middleware, router, controller, dan error handler.
2. Memahami clean architecture di backend: kenapa use case tidak boleh tahu Express atau database.
3. Bisa menambah database (PostgreSQL), migration, autentikasi JWT, dan test tanpa merusak struktur.
4. Bisa men-deploy API dan membaca log-nya saat ada masalah.

### 2.3 Bukan tujuan

- Microservice, message queue, atau GraphQL. Satu service REST sudah cukup untuk skala aplikasi pribadi.
- Integrasi rekening bank atau e-wallet.
- Admin panel.

---

## 3. Konsumen dan Alur Integrasi

```
Browser ──► Next.js server (port 3200) ──HTTP──► Express API (port 4000) ──► Database
            Server Component / Action             /api/v1/*                   (Fase 1)
```

- Next memanggil API dari server, jadi `API_BASE_URL` dan token tidak pernah sampai ke browser.
- Karena pemanggilnya server, CORS sebenarnya belum dibutuhkan. CORS tetap dipasang dengan allowlist `CORS_ORIGINS` untuk berjaga-jaga kalau nanti ada client browser atau mobile.
- Header `X-Request-Id` dikembalikan di setiap response. Kalau Next mengirim header yang sama, log frontend dan backend bisa dicocokkan per request.

---

## 4. Kebutuhan Fungsional

Kolom **Status** menunjukkan apa yang sudah ada di boilerplate.

### Epic A: Transaksi (P0)

| ID | Endpoint | Dipakai di frontend | Status |
|---|---|---|---|
| A1 | `GET /transactions` | Menu **Transaksi** kartu **Transaksi bulan ini**, dan menu **Dashboard** saat halaman dibuka | Selesai |
| A2 | `POST /transactions` | Form **Tambah transaksi** di menu **Transaksi**, saat tombol simpan ditekan | Selesai |
| A3 | `PATCH /transactions/:id` | Aksi **Ubah** di daftar transaksi (frontend belum ada) | Selesai di API |
| A4 | `DELETE /transactions/:id` | Aksi **Hapus** di daftar transaksi (frontend belum ada) | Selesai di API |
| A5 | Pagination dan pencarian `q` di `GET /transactions` | Filter di menu **Transaksi** | Belum (Fase 3) |

**Kriteria penerimaan A1-A4**

- [x] Nominal harus bilangan bulat lebih dari 0 dan maksimal Rp 1.000.000.000.000.
- [x] Kategori harus sesuai jenis. Pengeluaran: Makan & Minum, Transportasi, Tagihan, Belanja, Hiburan, Kesehatan, Lainnya. Pemasukan: Gaji, Bonus, Freelance, Investasi, Lainnya.
- [x] Tanggal transaksi tidak boleh di masa depan. Catatan opsional, maksimal 200 karakter.
- [x] `PATCH` menggabungkan data lama dengan perubahan, lalu memvalidasi hasil akhirnya. Contohnya, mengubah jenis menjadi `income` tanpa mengganti kategori `Transportasi` akan ditolak.
- [x] `GET` mengurutkan transaksi dari `occurred_at` terbaru dan mendukung filter `from`, `to`, `type`.
- [x] `PATCH` dan `DELETE` untuk id yang tidak ada membalas `404 NOT_FOUND`.

### Epic B: Ringkasan (P1)

- **B1. `GET /summary/monthly?month=2026-11`** mengembalikan total pemasukan, total pengeluaran, arus kas bersih, dan pengeluaran per kategori. Saat ini frontend menghitungnya sendiri dari daftar transaksi. Memindahkannya ke backend membuat hitungan bisa dilakukan oleh database (`GROUP BY`) dan tetap cepat walaupun data bertambah. Status: Belum (Fase 3).

### Epic C: Autentikasi (P1)

- **C1. `POST /auth/register`** dengan `{ email, password }`. Password disimpan sebagai hash argon2 atau bcrypt.
- **C2. `POST /auth/login`** mengembalikan `{ access_token, expires_in }` sesuai PRD frontend.
- **C3.** Semua endpoint `/transactions` wajib header `Authorization: Bearer <token>`. Tanpa token yang valid, API membalas `401 UNAUTHORIZED`.
- **C4.** Setiap transaksi punya `user_id`. Pengguna hanya bisa melihat dan mengubah transaksinya sendiri. Mengakses transaksi milik orang lain membalas `404`, bukan `403`, supaya keberadaan data orang lain tidak bocor.
- **C5.** Endpoint login dibatasi 5 percobaan per menit per IP (rate limit).

Status: Belum (Fase 2).

### Epic D: Fase 2 produk (P2)

Anggaran per kategori, dompet, kategori kustom, dan export CSV mengikuti Epic D di PRD frontend. Endpoint-nya dirancang setelah Fase 3 selesai.

---

## 5. Kontrak API

### 5.1 Aturan umum

- Base URL: `http://localhost:4000/api/v1`. Prefix diatur lewat `API_PREFIX`.
- Body request dan response memakai JSON dengan nama field `snake_case`.
- Tanggal memakai ISO 8601 dengan offset, contohnya `2026-11-14T08:00:00+07:00`. Response selalu dalam UTC (`2026-11-14T01:00:00.000Z`).
- Nominal dalam Rupiah, bilangan bulat tanpa desimal.

**Response sukses**

```json
{ "data": { } }
```

**Response error**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nominal harus bilangan bulat lebih dari 0",
    "details": { "fieldErrors": { "amount": ["Nominal harus bilangan bulat lebih dari 0"] } }
  }
}
```

Pesan error 4xx ditulis dalam bahasa Indonesia karena frontend menampilkannya langsung ke pengguna. Pesan error 5xx selalu generik ("Terjadi kesalahan di server") supaya detail internal tidak bocor, dan detail aslinya hanya ditulis ke log.

### 5.2 Daftar kode error

| Status | `code` | Kapan terjadi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bentuk request salah (field kurang, tipe salah) atau melanggar aturan bisnis |
| 400 | `INVALID_JSON` | Body bukan JSON yang valid |
| 401 | `UNAUTHORIZED` | Token tidak ada atau tidak valid (Fase 2) |
| 404 | `NOT_FOUND` | Data dengan id tersebut tidak ada |
| 404 | `ROUTE_NOT_FOUND` | Endpoint tidak ada |
| 413 | `PAYLOAD_TOO_LARGE` | Body lebih dari 100 KB |
| 422 | `DOMAIN_ERROR` | Aturan bisnis lain yang bukan validasi field |
| 429 | `TOO_MANY_REQUESTS` | Melewati rate limit (Fase 2) |
| 500 | `INTERNAL_ERROR` | Error yang tidak terduga |

### 5.3 Endpoint

| Method | Path | Query / Body | Response `data` |
|---|---|---|---|
| `GET` | `/health` (tanpa prefix) | - | `{ status, uptime_seconds }` |
| `GET` | `/transactions` | `from`, `to` (ISO 8601), `type` (`income` / `expense`), semua opsional | `TransactionDto[]` |
| `POST` | `/transactions` | `{ type, amount, category, note?, occurred_at }` | `TransactionDto`, status `201` |
| `PATCH` | `/transactions/:id` | Minimal satu field dari body `POST` | `TransactionDto` |
| `DELETE` | `/transactions/:id` | - | Kosong, status `204` |

**`TransactionDto`**

```json
{
  "id": "trx_44004a5d-3f88-4dc2-9fc4-7a28153ee761",
  "type": "expense",
  "amount": 64000,
  "category": "Transportasi",
  "note": "Gojek ke kantor",
  "occurred_at": "2026-11-06T02:00:00.000Z",
  "created_at": "2026-11-06T02:00:00.000Z",
  "updated_at": "2026-11-06T02:00:00.000Z"
}
```

Field `created_at` dan `updated_at` belum dipakai frontend. Schema zod di frontend mengabaikan field tambahan, jadi kedua field ini aman ditambahkan.

---

## 6. Arsitektur

### 6.1 Layer

Kode dikelompokkan per fitur (module), lalu tiap module dibagi menjadi 4 layer, sama seperti di frontend. Arah dependency hanya boleh ke dalam, dan ESLint (`no-restricted-imports` di `eslint.config.js`) membuat `npm run lint` gagal kalau aturan ini dilanggar.

```
presentation  ──►  application  ──►  domain  ◄──  infrastructure
(route,            (use case)        (entity,      (repository
 controller,                          aturan,       in-memory / Postgres)
 schema zod)                          interface)
            ▲                                            │
            └──────────── di/container.ts ◄──────────────┘
                     (merakit semua object konkret)
```

| Layer | Folder | Boleh import | Isi sekarang |
|---|---|---|---|
| Domain | `modules/<fitur>/domain`, `shared/domain` | tidak ada (TypeScript murni) | Entity `Transaction`, `assertValidTransaction`, interface `TransactionRepository`, `DomainError` |
| Application | `modules/<fitur>/application` | domain | `ListTransactions`, `CreateTransaction`, `UpdateTransaction`, `DeleteTransaction`, `Clock` |
| Infrastructure | `modules/<fitur>/infrastructure` | domain | `InMemoryTransactionRepository` |
| Presentation | `modules/<fitur>/presentation`, `shared/http` | application, domain | Router, controller, schema zod, mapper DTO, middleware error |
| Composition root | `di/container.ts`, `app.ts`, `main.ts` | semua | Merakit dependency, memasang middleware, menjalankan server |

### 6.2 Alur satu request

Contoh `POST /api/v1/transactions` saat pengguna menekan tombol simpan di form **Tambah transaksi**:

1. `pino-http` memberi request id dan mencatat log.
2. `helmet` memasang security header, `cors` mengecek origin, `express.json()` membaca body.
3. Router di `transaction.routes.ts` memanggil `controller.create`.
4. Controller memvalidasi bentuk body dengan zod (`createTransactionBodySchema`), lalu mengubah `occurred_at` menjadi `Date`.
5. Use case `CreateTransaction` memanggil aturan domain `assertValidTransaction`, lalu `repository.create`.
6. Controller mengubah entity menjadi DTO `snake_case` dan membalas `201 { data }`.
7. Kalau ada error di langkah mana pun, Express 5 meneruskannya ke `errorHandler`, yang mengubahnya menjadi format error di bagian 5.1.

### 6.3 Keputusan teknis

| Bagian | Pilihan | Alasan |
|---|---|---|
| Runtime | Node 24+ menjalankan `.ts` langsung (type stripping) | Tidak perlu `ts-node` atau `tsx` di development. Konsekuensinya, `enum`, `namespace`, dan parameter property di constructor tidak boleh dipakai (`erasableSyntaxOnly`) |
| Framework | Express 5 | Error dari handler `async` otomatis diteruskan ke error handler, jadi tidak perlu `try/catch` atau library `express-async-errors` |
| Validasi | Zod 4 | Sama dengan frontend, dan bisa menghasilkan pesan error per field |
| Logging | Pino + pino-http | Log JSON terstruktur dan cepat. Header `authorization`, `cookie`, dan field `password` di-redact |
| Security | Helmet, CORS allowlist, batas body 100 KB | Default aman yang murah |
| Test | Vitest + Supertest | Unit test untuk domain dan use case, test HTTP untuk route tanpa membuka port |
| Build | `tsc` ke folder `dist` | Production menjalankan JavaScript hasil build |

---

## 7. Kebutuhan Non-Fungsional

- **Performa:** `GET /transactions` untuk 1 bulan data (di bawah 300 baris) merespons di bawah 200 ms di server lokal.
- **Keamanan:** semua input divalidasi dua kali (bentuk oleh zod, aturan bisnis oleh domain). Password tidak pernah ditulis ke log. Token disimpan oleh frontend di cookie `httpOnly`.
- **Observability:** setiap request tercatat dengan method, URL, status, durasi, dan request id.
- **Graceful shutdown:** saat menerima `SIGINT` atau `SIGTERM`, server berhenti menerima koneksi baru dan menyelesaikan request yang sedang berjalan, dengan batas 10 detik.
- **Kualitas:** `npm run typecheck`, `npm run lint`, `npm test`, dan `npm run build` wajib lolos sebelum merge. Setiap use case dan setiap endpoint punya test.

---

## 8. Konfigurasi Env

Env dibaca dan divalidasi hanya di `src/config/env.ts`. Konfigurasi yang salah menghentikan server saat start dengan pesan yang jelas.

| Variabel | Default | Keterangan |
|---|---|---|
| `NODE_ENV` | `development` | `development` menyalakan log berwarna (pino-pretty) |
| `PORT` | `4000` | Harus sama dengan port di `API_BASE_URL` frontend |
| `API_PREFIX` | `/api/v1` | Harus sama dengan path di `API_BASE_URL` frontend |
| `CORS_ORIGINS` | `http://localhost:3200` | Daftar origin dipisah koma |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `DATABASE_URL` | - | Ditambahkan di Fase 1 |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | - | Ditambahkan di Fase 2 |

---

## 9. Ruang Lingkup MVP

**Termasuk:** Epic A (transaksi), Epic C (autentikasi), database PostgreSQL, deploy.

**Tidak termasuk:** Epic D, multi-mata uang, upload file, notifikasi.

---

## 10. Roadmap Belajar

Setiap fase menghasilkan fitur yang berguna untuk frontend dan sekaligus satu topik backend yang dipelajari. Mulai Fase 1, kamu yang menulis kodenya, dan aku berperan sebagai mentor: menjelaskan konsep, memberi petunjuk ketika kamu buntu, dan me-review hasilnya.

| Fase | Periode | Yang dibangun | Yang dipelajari | Status |
|---|---|---|---|---|
| 0. Boilerplate | 14 Nov 2026 | Struktur clean architecture, CRUD transaksi in-memory, error handler, logging, test | Middleware, router, alur request, dependency injection | Selesai |
| 1. Database | 16-22 Nov 2026 | `PostgresTransactionRepository`, migration tabel `transactions`, Docker Compose untuk Postgres | SQL dasar, migration, ORM atau query builder, index | Belum |
| 2. Autentikasi | 23 Nov - 6 Des 2026 | Register, login, middleware auth, `user_id` di transaksi, rate limit login | Hash password, JWT, middleware dengan `req` yang membawa user, otorisasi per data | Belum |
| 3. Query lanjutan | 7-13 Des 2026 | Pagination, pencarian `q`, `GET /summary/monthly` | Agregasi SQL (`SUM`, `GROUP BY`), pagination cursor vs offset | Belum |
| 4. Production | 14-24 Des 2026 | Dockerfile, deploy, OpenAPI docs, monitoring error | Build image, env production, membaca log, dokumentasi API | Belum |

**Definisi selesai setiap fase**

1. Semua test lolos, termasuk test baru untuk fitur di fase itu.
2. Frontend tetap berjalan tanpa perubahan kode, kecuali fase yang memang menambah fitur di frontend.
3. Kamu bisa menjelaskan dengan kata-katamu sendiri alur request dari route sampai database untuk fitur di fase itu.

**Latihan pertama sebelum Fase 1 (pemanasan)**

Tambahkan endpoint `GET /transactions/:id` yang membalas satu transaksi atau `404 NOT_FOUND`. Use case-nya bernama `GetTransaction`. Petunjuk: lihat cara `DeleteTransaction` mengecek data dengan `findById`, lalu tulis test di `transaction.routes.test.ts` sebelum menulis kodenya.

---

## 11. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kontrak API berubah tanpa memberi tahu frontend | Halaman frontend error dengan kode `INVALID_RESPONSE` | Kontrak di bagian 5 menjadi acuan. Setiap perubahan dicatat di PRD ini dan PRD frontend |
| Data in-memory hilang saat server restart | Data uji hilang | Hanya untuk Fase 0. Fase 1 menambah PostgreSQL |
| Zona waktu: transaksi jam 00.00-07.00 WIB tersimpan di tanggal UTC sebelumnya | Ringkasan bulanan bisa salah di tanggal 1 | Simpan selalu dalam UTC. Hitungan per bulan memakai zona `Asia/Jakarta` (lihat pertanyaan terbuka 1) |
| Node type stripping masih baru | Beberapa syntax TypeScript tidak didukung | `erasableSyntaxOnly` di `tsconfig.json` membuat error muncul saat typecheck, bukan saat runtime |

---

## 12. Pertanyaan Terbuka

1. Apakah perhitungan per bulan memakai zona waktu `Asia/Jakarta` tetap, atau mengikuti zona waktu yang dikirim frontend?
2. ~~Untuk Fase 1, mau memakai Prisma atau Drizzle?~~ **Diputuskan 15 Nov 2026: Drizzle** (drizzle-orm + drizzle-kit, driver `pg`), karena query-nya dekat dengan SQL sehingga sekalian belajar SQL.
3. Kategori tetap disimpan sebagai teks, atau dibuat tabel `categories` sejak Fase 1 supaya kategori kustom (Epic D) lebih mudah?
4. Target deploy: VPS (belajar lebih banyak soal server) atau platform seperti Railway atau Fly.io (lebih cepat)?

# Kontrak API express-personal-finance

File ini satu-satunya sumber kebenaran untuk kontrak API antara `express-personal-finance` (backend) dan `next-personal-finance` (frontend). PRD kedua proyek hanya merujuk ke file ini dan tidak menyalin isinya.

**Cara mengubah kontrak:** ubah file ini lebih dulu, baru ubah kode. Di sisi backend, kontrak ini dijaga oleh schema zod di `src/modules/*/presentation/*.schemas.ts` dan test HTTP. Di sisi frontend, kontrak ini dijaga oleh schema di `next-personal-finance/src/modules/*/infrastructure/*-dto.ts`, yang menolak response yang tidak cocok dengan error `INVALID_RESPONSE`.

## 1. Aturan umum

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

**Pagination (wajib untuk setiap endpoint yang mengembalikan daftar)**

Tidak ada endpoint yang mengembalikan seluruh isi tabel sekaligus. Setiap endpoint daftar memakai cursor pagination dengan aturan yang sama:

- Query `limit` menentukan jumlah item per halaman. Bawaannya `20`, minimal `1`, maksimal `100`.
- Query `cursor` diisi dengan `next_cursor` dari response sebelumnya untuk mengambil halaman berikutnya. Halaman pertama dikirim tanpa `cursor`.
- Response membawa objek `page` di samping `data`. Kalau `next_cursor` bernilai `null`, berarti tidak ada halaman berikutnya.
- Isi `cursor` tidak boleh dibaca atau dibuat sendiri oleh frontend. Cukup kirim ulang apa adanya.
- Saat filter berubah (misalnya pengguna mengetik kata pencarian baru), frontend mulai lagi dari halaman pertama tanpa `cursor`.
- `limit` di luar batas atau `cursor` yang rusak dibalas `400 VALIDATION_ERROR` dengan pesan di `details.fieldErrors.limit` atau `details.fieldErrors.cursor`.

```json
{
  "data": [ ],
  "page": { "limit": 20, "next_cursor": "eyJvIjoiMjAyNi0xMS0wNlQwMjowMDowMC4wMDBaIiwiaSI6InRyeF8uLi4ifQ" }
}
```

Kita memakai cursor, bukan offset (`page=2`), karena data transaksi terus bertambah. Dengan offset, transaksi baru yang masuk saat pengguna sedang menggulir daftar membuat item bergeser, sehingga ada item yang muncul dua kali atau terlewat. Response tidak membawa jumlah total item, karena menghitung total butuh query `COUNT` tambahan di setiap halaman. Jumlah transaksi per periode diambil dari `GET /summary` (lihat 4.5).

## 2. Daftar kode error

| Status | `code` | Kapan terjadi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bentuk request salah (field kurang, tipe salah) atau melanggar aturan bisnis |
| 400 | `INVALID_JSON` | Body bukan JSON yang valid |
| 401 | `INVALID_CREDENTIALS` | Login dengan email yang tidak terdaftar atau password yang salah (Fase 2) |
| 401 | `UNAUTHORIZED` | Token tidak ada atau tidak valid (Fase 2) |
| 404 | `NOT_FOUND` | Data dengan id tersebut tidak ada |
| 404 | `ROUTE_NOT_FOUND` | Endpoint tidak ada |
| 409 | `EMAIL_ALREADY_REGISTERED` | Register dengan email yang sudah dipakai akun lain (Fase 2) |
| 409 | `ACCOUNT_ALREADY_EXISTS` | Membuat akun dengan nama yang sudah dipakai akun lain milik pengguna yang sama (lihat 4.8) |
| 409 | `CATEGORY_ALREADY_EXISTS` | Membuat kategori dengan nama yang sudah ada untuk jenis yang sama (lihat 4.6) |
| 413 | `PAYLOAD_TOO_LARGE` | Body lebih dari 100 KB |
| 422 | `DOMAIN_ERROR` | Aturan bisnis lain yang bukan validasi field |
| 429 | `TOO_MANY_REQUESTS` | Melewati rate limit (Fase 2) |
| 500 | `INTERNAL_ERROR` | Error yang tidak terduga |

## 3. Daftar endpoint

| Method | Path | Login | Query / Body | Response `data` |
|---|---|---|---|---|
| `GET` | `/health` (tanpa prefix) | Tidak | - | `{ status, uptime_seconds }` |
| `GET` | `/transactions` | Wajib | `from`, `to`, `type`, `category_id`, `account_id`, `q`, `limit`, `cursor`, semua opsional (lihat 4.4) | `TransactionDto[]` dengan `page` |
| `GET` | `/summary` | Wajib | `from`, `to` wajib (lihat 4.5) | `SummaryDto` |
| `GET` | `/transactions/:id` | Wajib | - | `TransactionDto` |
| `POST` | `/transactions` | Wajib | `{ type, amount, category_id, account_id, note?, occurred_at }` (lihat 4.7 dan 4.9) | `TransactionDto`, status `201` |
| `PATCH` | `/transactions/:id` | Wajib | Minimal satu field dari body `POST` | `TransactionDto` |
| `DELETE` | `/transactions/:id` | Wajib | - | Kosong, status `204` |
| `GET` | `/accounts` | Wajib | `limit`, `cursor`, semua opsional (lihat 4.8) | `AccountDto[]` dengan `page` |
| `POST` | `/accounts` | Wajib | `{ name, kind, opening_balance }` (lihat 4.8) | `AccountDto`, status `201` |
| `GET` | `/categories` | Wajib | `type`, `limit`, `cursor`, semua opsional (lihat 4.6) | `CategoryDto[]` dengan `page` |
| `POST` | `/categories` | Wajib | `{ name, type }` (lihat 4.6) | `CategoryDto`, status `201` |
| `POST` | `/auth/register` | Tidak | `{ name, email, password }` | `UserDto`, status `201` (lihat 4.1) |
| `POST` | `/auth/login` | Tidak | `{ email, password }` | `{ access_token, expires_in }` (lihat 4.2) |
| `GET` | `/auth/me` | Wajib | - | `UserDto` (lihat 4.3) |

**Endpoint yang wajib login** harus membawa header `Authorization: Bearer <access_token>`, dengan token dari `POST /auth/login`. Kalau header tidak ada, token-nya rusak, tanda tangannya tidak cocok, atau sudah kedaluwarsa, API membalas `401 UNAUTHORIZED`:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Sesi kamu sudah habis. Silakan masuk lagi." } }
```

Kalau header `Authorization` tidak ada sama sekali, `message` berisi "Kamu perlu masuk dulu." Frontend cukup memeriksa `code`, bukan isi `message`.

Frontend sebaiknya menghapus token yang tersimpan dan mengarahkan pengguna ke layar Login setiap kali menerima `401 UNAUTHORIZED`.

**Transaksi bersifat per pengguna.** Setiap transaksi dimiliki oleh pengguna yang membuatnya (pemilik token saat `POST /transactions`). `GET /transactions` hanya mengembalikan transaksi milik pemilik token. Membuka, mengubah, atau menghapus transaksi milik pengguna lain dibalas `404 NOT_FOUND`, sama persis dengan transaksi yang memang tidak ada, supaya keberadaan data pengguna lain tidak bocor. `TransactionDto` tidak membawa id pemiliknya.

### `TransactionDto`

```json
{
  "id": "trx_44004a5d-3f88-4dc2-9fc4-7a28153ee761",
  "type": "expense",
  "amount": 64000,
  "category_id": "cat_expense_transportasi",
  "category": "Transportasi",
  "account_id": "acc_5d0f7c2e-8a41-4b6e-9c3d-2f1e0a9b8c7d",
  "account": "BCA",
  "note": "Gojek ke kantor",
  "occurred_at": "2026-11-06T02:00:00.000Z",
  "created_at": "2026-11-06T02:00:00.000Z",
  "updated_at": "2026-11-06T02:00:00.000Z"
}
```

`account_id` dan `account` (nama akun) bernilai `null` untuk transaksi lama yang dicatat sebelum fitur akun ada. Frontend menampilkannya sebagai "Tanpa akun".

`category_id` adalah id kategori yang disimpan di transaksi. `category` adalah nama kategori itu saat response dibuat, supaya frontend bisa langsung menampilkannya tanpa request tambahan ke `GET /categories`.

Field `created_at` dan `updated_at` belum dipakai frontend. Schema zod di frontend mengabaikan field tambahan, jadi kedua field ini aman ditambahkan.

## 4. Detail endpoint

### 4.1 Register (`POST /auth/register`)

Dipanggil oleh `registerAction` di frontend saat pengguna menekan tombol **Daftar** di layar Daftar (`/register`). Field `confirm` (ulangi password) dan `terms` (persetujuan) hanya diperiksa di frontend dan tidak dikirim ke API.

**Request**

```json
{ "name": "Rani Putri", "email": "rani@email.com", "password": "rahasia123" }
```

**Aturan validasi** (dicek ulang oleh backend, sama dengan `password-policy.ts` di frontend)

| Field | Aturan |
|---|---|
| `name` | Wajib, setelah di-trim minimal 1 dan maksimal 100 karakter |
| `email` | Wajib, format email valid, maksimal 254 karakter. Disimpan dalam huruf kecil setelah di-trim, jadi `Rani@Email.com` dan `rani@email.com` dianggap email yang sama |
| `password` | Wajib, minimal 8 dan maksimal 72 karakter, mengandung huruf dan angka, dan tidak mengandung kata "flowca" |

**Sukses: `201`**

```json
{
  "data": {
    "id": "usr_6b1c2f0e-3a51-4d0c-9a8e-1f2b3c4d5e6f",
    "name": "Rani Putri",
    "email": "rani@email.com",
    "created_at": "2026-11-21T03:00:00.000Z"
  }
}
```

Response tidak membawa `access_token`. Setelah daftar, frontend mengarahkan pengguna ke layar Login, dan token baru diberikan oleh `POST /auth/login`. Field `password` dan `password_hash` tidak pernah dikirim di response mana pun.

**Gagal validasi: `400 VALIDATION_ERROR`**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password harus mengandung huruf dan angka",
    "details": { "fieldErrors": { "password": ["Password harus mengandung huruf dan angka"] } }
  }
}
```

Kalau yang salah adalah bentuk request (field kosong atau format email salah), `message` berisi `"Data request tidak valid"` dan semua field yang salah ada di `details.fieldErrors` sekaligus. Kalau yang dilanggar aturan password, `message` berisi pesan aturan itu. Frontend cukup membaca `details.fieldErrors` untuk menampilkan pesan di bawah setiap field.

**Email sudah terdaftar: `409 EMAIL_ALREADY_REGISTERED`**

```json
{
  "error": {
    "code": "EMAIL_ALREADY_REGISTERED",
    "message": "Email sudah terdaftar. Silakan masuk.",
    "details": { "fieldErrors": { "email": ["Email sudah terdaftar. Silakan masuk."] } }
  }
}
```

`details.fieldErrors.email` disertakan supaya frontend bisa menampilkan pesan di bawah field email dengan cara yang sama seperti error validasi.

### 4.2 Login (`POST /auth/login`)

Dipanggil oleh `signInWithPasswordAction` di frontend saat pengguna menekan tombol **Masuk** di layar Login (`/login`).

**Request**

```json
{ "email": "rani@email.com", "password": "rahasia123" }
```

Email dinormalisasi sama seperti register (di-trim dan diubah ke huruf kecil), jadi `Rani@Email.com` bisa dipakai untuk login. Password tidak diperiksa aturannya di sini, hanya dicocokkan dengan hash yang tersimpan.

**Sukses: `200`**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfNmIxYy4uLiIsImlhdCI6MTc2Mzc4NjAwMCwiZXhwIjoxNzYzODcyNDAwfQ.signature",
    "expires_in": 86400
  }
}
```

- `access_token` adalah JWT bertanda tangan HS256. Isinya hanya `sub` (id user, contohnya `usr_6b1c...`), `iat` (waktu dibuat), dan `exp` (waktu kedaluwarsa). Email dan nama tidak dimasukkan, karena isi JWT bisa dibaca siapa pun yang memegang token.
- `expires_in` adalah masa berlaku token dalam detik. Nilainya diatur lewat env `JWT_EXPIRES_IN` (bawaannya 86400, atau 1 hari). Belum ada refresh token, jadi setelah kedaluwarsa pengguna harus login lagi.
- Frontend menyimpan token di cookie `httpOnly` dan mengirimnya di header `Authorization: Bearer <token>` untuk endpoint yang butuh login.

**Gagal validasi: `400 VALIDATION_ERROR`**

Kalau `email` atau `password` kosong, atau format email salah. Bentuknya sama dengan bagian 4.1.

**Email atau password salah: `401 INVALID_CREDENTIALS`**

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email atau password salah."
  }
}
```

Pesan dan waktu respons sengaja dibuat sama untuk email yang tidak terdaftar dan password yang salah, supaya penyerang tidak bisa mengetahui email mana yang terdaftar (user enumeration). Karena itu response ini tidak membawa `details.fieldErrors`.

**Terlalu banyak percobaan gagal: `429 TOO_MANY_REQUESTS`**

Login yang gagal (400 atau 401) dibatasi **5 kali per menit per alamat IP pengguna**. Login yang berhasil tidak dihitung. Percobaan berikutnya di menit yang sama dibalas:

```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Terlalu banyak percobaan masuk. Coba lagi dalam 1 menit."
  }
}
```

Response ini juga membawa header `Retry-After` (jumlah detik sampai jatah percobaan dipulihkan) dan header `RateLimit`/`RateLimit-Policy` standar.

**IP pengguna dikirim lewat `X-Forwarded-For`.** Request login ke API dikirim oleh server Next, bukan langsung oleh browser, jadi alamat IP yang dilihat API adalah IP server Next. Supaya batasnya berlaku per pengguna, frontend wajib meneruskan IP browser di header `X-Forwarded-For`. API hanya mempercayai header ini dari alamat yang diizinkan di env `TRUST_PROXY` (bawaannya `loopback`, yaitu server di mesin yang sama). Dari alamat lain, header ini diabaikan supaya tidak bisa dipalsukan.

### 4.3 Profil pengguna yang sedang login (`GET /auth/me`)

Dipakai frontend untuk menampilkan nama dan email di kartu profil, dan untuk memastikan token di cookie masih berlaku. Wajib membawa header `Authorization: Bearer <access_token>`.

**Sukses: `200`**

```json
{
  "data": {
    "id": "usr_6b1c2f0e-3a51-4d0c-9a8e-1f2b3c4d5e6f",
    "name": "Rani Putri",
    "email": "rani@email.com",
    "created_at": "2026-11-21T03:00:00.000Z"
  }
}
```

Bentuknya sama dengan `UserDto` di bagian 4.1.

**Gagal: `401 UNAUTHORIZED`**

Kalau token tidak ada atau tidak valid, sama seperti endpoint lain yang wajib login (lihat bagian 3). Juga dibalas `401` kalau token-nya valid tapi akun pemiliknya sudah tidak ada.

### 4.4 Daftar transaksi (`GET /transactions`)

Dipanggil saat pengguna membuka menu **Transaksi** (daftar transaksi bulan yang dipilih) dan menu **Dashboard** (kartu transaksi terakhir). Hanya mengembalikan transaksi milik pemilik token.

**Query** (semuanya opsional)

| Query | Aturan |
|---|---|
| `from`, `to` | ISO 8601 dengan offset. Batas waktu `occurred_at`, keduanya inklusif |
| `type` | `income` atau `expense` |
| `category_id` | Id kategori, misalnya `cat_expense_transportasi` |
| `account_id` | Id akun, misalnya `acc_5d0f7c2e-8a41-4b6e-9c3d-2f1e0a9b8c7d` |
| `q` | Kata pencarian, 1-100 karakter setelah di-trim. Mencari di `note` dan nama kategori tanpa membedakan huruf besar dan kecil. `q=gojek` cocok dengan catatan "Gojek ke kantor" |
| `limit`, `cursor` | Lihat aturan pagination di bagian 1 |

Urutannya selalu dari `occurred_at` terbaru. Kalau dua transaksi punya `occurred_at` yang sama, yang `id`-nya lebih besar ditaruh lebih dulu, supaya urutan antarhalaman tetap stabil.

**Sukses: `200`**

```json
{
  "data": [
    {
      "id": "trx_44004a5d-3f88-4dc2-9fc4-7a28153ee761",
      "type": "expense",
      "amount": 64000,
      "category_id": "cat_expense_transportasi",
      "category": "Transportasi",
      "account_id": "acc_5d0f7c2e-8a41-4b6e-9c3d-2f1e0a9b8c7d",
      "account": "BCA",
      "note": "Gojek ke kantor",
      "occurred_at": "2026-11-06T02:00:00.000Z",
      "created_at": "2026-11-06T02:00:00.000Z",
      "updated_at": "2026-11-06T02:00:00.000Z"
    }
  ],
  "page": { "limit": 20, "next_cursor": null }
}
```

### 4.5 Ringkasan periode (`GET /summary`)

Dipanggil saat pengguna membuka menu **Dashboard** (kartu pemasukan, pengeluaran, arus kas, dan pengeluaran per kategori) dan menu **Transaksi** (jumlah transaksi bulan ini). Hitungannya dilakukan oleh database dengan `SUM` dan `GROUP BY`, jadi tidak perlu mengambil semua transaksi ke frontend. Hanya menghitung transaksi milik pemilik token.

**Query**

| Query | Aturan |
|---|---|
| `from`, `to` | Wajib, ISO 8601 dengan offset, keduanya inklusif. Untuk satu bulan November 2026 di WIB: `from=2026-11-01T00:00:00+07:00` dan `to=2026-11-30T23:59:59.999+07:00` |

Batas bulan dikirim oleh frontend lengkap dengan offset zona waktunya, sama seperti `GET /transactions`. Dengan begitu backend tidak perlu menebak zona waktu pengguna.

**Sukses: `200`**

```json
{
  "data": {
    "total_income": 12500000,
    "total_expense": 3264000,
    "net_cashflow": 9236000,
    "transaction_count": 8,
    "income_count": 2,
    "expense_count": 6,
    "expense_by_category": [
      { "category_id": "cat_expense_tagihan", "category": "Tagihan", "amount": 1850000 },
      { "category_id": "cat_expense_makanan", "category": "Makanan", "amount": 1350000 },
      { "category_id": "cat_expense_transportasi", "category": "Transportasi", "amount": 64000 }
    ]
  }
}
```

`net_cashflow` adalah `total_income - total_expense` dan bisa negatif. `income_count` dan `expense_count` adalah jumlah transaksi per jenis, yang ditampilkan sebagai "N transaksi" di kartu Masuk dan Keluar menu Dashboard. `expense_by_category` diurutkan dari nominal terbesar (kalau nominalnya sama, urut nama kategori A-Z) dan hanya berisi kategori yang punya pengeluaran di periode itu. Kalau tidak ada transaksi, semua angka bernilai `0` dan `expense_by_category` berupa array kosong.

**Gagal validasi: `400 VALIDATION_ERROR`**

Kalau `from` atau `to` tidak dikirim, formatnya salah, atau `from` lebih besar dari `to`.

### 4.6 Kategori (`GET /categories` dan `POST /categories`)

Kategori disimpan di tabel `categories`. Ada dua macam kategori:

- **Kategori bawaan** (`is_default: true`) dipakai semua pengguna dan tidak bisa diubah. Id-nya tetap, jadi frontend boleh memakainya langsung, misalnya untuk anggaran bawaan atau tebakan kategori di Catat cepat.
- **Kategori kustom** (`is_default: false`) dibuat pengguna lewat chip **+ Kategori baru** di form Tambah transaksi. Kategori ini hanya terlihat dan bisa dipakai oleh pembuatnya.

Setiap kategori punya satu jenis (`income` atau `expense`). Kategori kustom "Kos" yang dibuat untuk pengeluaran tidak muncul di pilihan pemasukan. Mengganti nama dan menghapus kategori belum tersedia.

**Kategori bawaan**

| `type` | `id` dan `name` |
|---|---|
| `expense` | `cat_expense_makanan` Makanan, `cat_expense_transportasi` Transportasi, `cat_expense_belanja` Belanja, `cat_expense_tagihan` Tagihan, `cat_expense_hiburan` Hiburan, `cat_expense_kesehatan` Kesehatan, `cat_expense_pendidikan` Pendidikan, `cat_expense_lainnya` Lainnya |
| `income` | `cat_income_gaji` Gaji, `cat_income_freelance` Freelance, `cat_income_bonus` Bonus, `cat_income_hadiah` Hadiah, `cat_income_investasi` Investasi, `cat_income_lainnya` Lainnya |

### `CategoryDto`

```json
{ "id": "cat_9f1c2a7e-0b3d-4c5e-8f6a-1b2c3d4e5f60", "name": "Kos", "type": "expense", "is_default": false }
```

**`GET /categories`**

Dipanggil saat form **Tambah transaksi** dibuka (chip kategori sesuai jenis yang dipilih), dan saat menu **Transaksi** dibuka (pilihan filter Kategori). Mengembalikan kategori bawaan ditambah kategori kustom milik pemilik token.

| Query | Aturan |
|---|---|
| `type` | Opsional, `income` atau `expense`. Tanpa `type`, kedua jenis dikembalikan |
| `limit`, `cursor` | Lihat aturan pagination di bagian 1. Frontend memakai `limit=100` dan mengikuti `next_cursor` kalau ada |

Urutannya: kategori bawaan dalam urutan tabel di atas, lalu kategori kustom dari yang paling lama dibuat.

```json
{
  "data": [
    { "id": "cat_expense_makanan", "name": "Makanan", "type": "expense", "is_default": true },
    { "id": "cat_9f1c2a7e-0b3d-4c5e-8f6a-1b2c3d4e5f60", "name": "Kos", "type": "expense", "is_default": false }
  ],
  "page": { "limit": 100, "next_cursor": null }
}
```

**`POST /categories`**

Dipanggil saat pengguna mengetik nama di chip **+ Kategori baru** pada form Tambah transaksi lalu menekan Enter. `type` diambil dari jenis yang sedang dipilih di form.

```json
{ "name": "Kos", "type": "expense" }
```

| Field | Aturan |
|---|---|
| `name` | Wajib, 1-30 karakter setelah di-trim. Spasi berlebih di tengah dirapikan menjadi satu spasi |
| `type` | Wajib, `income` atau `expense` |

Sukses dibalas `201` dengan `CategoryDto`. Kalau nama yang sama sudah ada untuk jenis yang sama, baik kategori bawaan maupun kategori kustom milik pengguna itu, API membalas `409`. Perbandingannya tidak membedakan huruf besar dan kecil, jadi "kos" sama dengan "Kos".

```json
{
  "error": {
    "code": "CATEGORY_ALREADY_EXISTS",
    "message": "Kategori Kos sudah ada",
    "details": { "fieldErrors": { "name": ["Kategori Kos sudah ada"] } }
  }
}
```

### 4.7 Kategori di transaksi (`POST` dan `PATCH /transactions`)

Body transaksi menyimpan kategori lewat `category_id`, bukan nama kategori. Contoh body `POST /transactions` dari form Tambah transaksi:

```json
{
  "type": "expense",
  "amount": 1500000,
  "category_id": "cat_9f1c2a7e-0b3d-4c5e-8f6a-1b2c3d4e5f60",
  "note": "Bayar kos Desember",
  "occurred_at": "2026-11-24T09:00:00+07:00"
}
```

`category_id` ditolak dengan `400 VALIDATION_ERROR` di `details.fieldErrors.category_id` pada dua kasus:

- Kategori tidak ada, atau kategori kustom milik pengguna lain: "Kategori tidak ditemukan". Pesannya sama untuk kedua kasus, supaya keberadaan kategori pengguna lain tidak bocor.
- Jenis kategori tidak cocok dengan jenis transaksi, misalnya `cat_income_gaji` untuk pengeluaran: "Kategori Gaji tidak bisa dipakai untuk pengeluaran".

Pada `PATCH`, aturan ini dicek terhadap gabungan data lama dan perubahan. Mengubah `type` menjadi `income` tanpa mengganti `category_id` pengeluaran akan ditolak.

### 4.8 Akun (`GET /accounts` dan `POST /accounts`)

Akun adalah tempat uang disimpan, misalnya Tunai, BCA, atau GoPay. Setiap akun milik satu pengguna dan hanya terlihat oleh pemiliknya. Mengubah dan menghapus akun belum tersedia.

### `AccountDto`

```json
{
  "id": "acc_5d0f7c2e-8a41-4b6e-9c3d-2f1e0a9b8c7d",
  "name": "BCA",
  "kind": "bank",
  "opening_balance": 2000000,
  "balance": 13000000,
  "created_at": "2026-11-24T03:00:00.000Z"
}
```

| Field | Arti |
|---|---|
| `kind` | `cash` (tunai), `bank` (rekening bank), `ewallet` (dompet digital), atau `credit` (kartu kredit) |
| `opening_balance` | Saldo saat akun mulai dicatat di aplikasi, diisi pengguna saat membuat akun. Tidak berubah oleh transaksi |
| `balance` | Saldo saat ini, dihitung ulang setiap request: `opening_balance` + semua pemasukan − semua pengeluaran di akun itu, tanpa batas tanggal. Tidak disimpan di database, supaya selalu cocok dengan daftar transaksi |

Kedua saldo boleh negatif, misalnya tagihan kartu kredit.

**`GET /accounts`**

Dipanggil saat pengguna membuka menu **Dashboard** (kartu Total saldo), menu **Akun** (daftar akun), form **Tambah transaksi** (pilihan Akun), dan menu **Transaksi** (kolom dan filter Akun). Mengembalikan akun milik pemilik token, urut dari yang paling lama dibuat, dengan standar pagination di bagian 1. Frontend memakai `limit=100` dan mengikuti `next_cursor` kalau ada.

**`POST /accounts`**

Dipanggil dari form tambah akun di menu **Akun**, dan dari langkah terakhir onboarding ("Uangmu ada di mana?") untuk setiap akun yang dipilih. Pada onboarding, isian "Total uang saat ini" dipakai sebagai `opening_balance` akun pertama yang dipilih, dan akun lainnya dibuat dengan `opening_balance` 0.

```json
{ "name": "BCA", "kind": "bank", "opening_balance": 2000000 }
```

| Field | Aturan |
|---|---|
| `name` | Wajib, 1-40 karakter setelah di-trim. Spasi berlebih di tengah dirapikan menjadi satu spasi |
| `kind` | Wajib, salah satu dari `cash`, `bank`, `ewallet`, `credit` |
| `opening_balance` | Wajib, bilangan bulat Rupiah, boleh 0 atau negatif, nilai mutlaknya maksimal Rp 1.000.000.000.000 |

Sukses dibalas `201` dengan `AccountDto` (saat baru dibuat, `balance` sama dengan `opening_balance`). Nama akun harus unik per pengguna tanpa membedakan huruf besar dan kecil. Nama yang sudah dipakai dibalas `409`:

```json
{
  "error": {
    "code": "ACCOUNT_ALREADY_EXISTS",
    "message": "Akun BCA sudah ada",
    "details": { "fieldErrors": { "name": ["Akun BCA sudah ada"] } }
  }
}
```

### 4.9 Akun di transaksi (`POST` dan `PATCH /transactions`)

`account_id` wajib dikirim di body `POST /transactions` dan boleh diubah lewat `PATCH`. Pemasukan menambah saldo akun itu, dan pengeluaran mengurangi saldonya.

Akun yang tidak ada atau milik pengguna lain ditolak dengan `400 VALIDATION_ERROR` di `details.fieldErrors.account_id` dengan pesan "Akun tidak ditemukan". Pesannya sama untuk kedua kasus, supaya keberadaan akun pengguna lain tidak bocor.

Transaksi lama yang belum punya akun tetap bisa dibaca. Kalau transaksi lama itu diubah lewat `PATCH` tanpa mengirim `account_id`, akunnya tetap kosong.

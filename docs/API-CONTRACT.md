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
| 413 | `PAYLOAD_TOO_LARGE` | Body lebih dari 100 KB |
| 422 | `DOMAIN_ERROR` | Aturan bisnis lain yang bukan validasi field |
| 429 | `TOO_MANY_REQUESTS` | Melewati rate limit (Fase 2) |
| 500 | `INTERNAL_ERROR` | Error yang tidak terduga |

## 3. Daftar endpoint

| Method | Path | Login | Query / Body | Response `data` |
|---|---|---|---|---|
| `GET` | `/health` (tanpa prefix) | Tidak | - | `{ status, uptime_seconds }` |
| `GET` | `/transactions` | Wajib | `from`, `to` (ISO 8601), `type` (`income` / `expense`), semua opsional | `TransactionDto[]` |
| `GET` | `/transactions/:id` | Wajib | - | `TransactionDto` |
| `POST` | `/transactions` | Wajib | `{ type, amount, category, note?, occurred_at }` | `TransactionDto`, status `201` |
| `PATCH` | `/transactions/:id` | Wajib | Minimal satu field dari body `POST` | `TransactionDto` |
| `DELETE` | `/transactions/:id` | Wajib | - | Kosong, status `204` |
| `POST` | `/auth/register` | Tidak | `{ name, email, password }` | `UserDto`, status `201` (lihat 4.1) |
| `POST` | `/auth/login` | Tidak | `{ email, password }` | `{ access_token, expires_in }` (lihat 4.2) |
| `GET` | `/auth/me` | Wajib | - | `UserDto` (lihat 4.3) |

**Endpoint yang wajib login** harus membawa header `Authorization: Bearer <access_token>`, dengan token dari `POST /auth/login`. Kalau header tidak ada, token-nya rusak, tanda tangannya tidak cocok, atau sudah kedaluwarsa, API membalas `401 UNAUTHORIZED`:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Sesi kamu sudah habis. Silakan masuk lagi." } }
```

Kalau header `Authorization` tidak ada sama sekali, `message` berisi "Kamu perlu masuk dulu." Frontend cukup memeriksa `code`, bukan isi `message`.

Frontend sebaiknya menghapus token yang tersimpan dan mengarahkan pengguna ke layar Login setiap kali menerima `401 UNAUTHORIZED`. Untuk saat ini semua pengguna yang login masih melihat transaksi yang sama; pemisahan transaksi per pengguna (`user_id`) menyusul di Fase 2.

### `TransactionDto`

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

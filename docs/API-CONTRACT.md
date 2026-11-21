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
| 401 | `UNAUTHORIZED` | Token tidak ada atau tidak valid (Fase 2) |
| 404 | `NOT_FOUND` | Data dengan id tersebut tidak ada |
| 404 | `ROUTE_NOT_FOUND` | Endpoint tidak ada |
| 409 | `EMAIL_ALREADY_REGISTERED` | Register dengan email yang sudah dipakai akun lain (Fase 2) |
| 413 | `PAYLOAD_TOO_LARGE` | Body lebih dari 100 KB |
| 422 | `DOMAIN_ERROR` | Aturan bisnis lain yang bukan validasi field |
| 429 | `TOO_MANY_REQUESTS` | Melewati rate limit (Fase 2) |
| 500 | `INTERNAL_ERROR` | Error yang tidak terduga |

## 3. Daftar endpoint

| Method | Path | Query / Body | Response `data` |
|---|---|---|---|
| `GET` | `/health` (tanpa prefix) | - | `{ status, uptime_seconds }` |
| `GET` | `/transactions` | `from`, `to` (ISO 8601), `type` (`income` / `expense`), semua opsional | `TransactionDto[]` |
| `GET` | `/transactions/:id` | - | `TransactionDto` |
| `POST` | `/transactions` | `{ type, amount, category, note?, occurred_at }` | `TransactionDto`, status `201` |
| `PATCH` | `/transactions/:id` | Minimal satu field dari body `POST` | `TransactionDto` |
| `DELETE` | `/transactions/:id` | - | Kosong, status `204` |
| `POST` | `/auth/register` | `{ name, email, password }` | `UserDto`, status `201` (Fase 2, lihat 4.1) |
| `POST` | `/auth/login` | `{ email, password }` | `{ access_token, expires_in }` (Fase 2, detail belum dirancang) |

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

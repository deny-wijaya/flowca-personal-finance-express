# Express Personal Finance

Backend REST API untuk [`next-personal-finance`](../next-personal-finance). Scope, kontrak API, dan roadmap belajar ada di [`docs/PRD.md`](docs/PRD.md).

## Menjalankan

Butuh Node 24 atau lebih baru.

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:4000/api/v1, auto-restart saat file berubah
```

Lalu di `next-personal-finance/.env.local`, isi `DATA_SOURCE=api` dan `API_BASE_URL=http://localhost:4000/api/v1`. Setelah itu menu **Dashboard** dan **Transaksi** di frontend membaca data dari API ini.

Coba langsung dengan curl:

```bash
curl localhost:4000/health
curl "localhost:4000/api/v1/transactions?type=expense"
curl -X POST localhost:4000/api/v1/transactions \
  -H 'content-type: application/json' \
  -d '{"type":"expense","amount":64000,"category":"Transportasi","note":"Gojek ke kantor","occurred_at":"2026-11-14T08:00:00+07:00"}'
```

## Script

| Script | Fungsi |
|---|---|
| `npm run dev` | Menjalankan `src/main.ts` langsung dengan Node (tanpa build) dan restart otomatis |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Menjalankan hasil build, dipakai di production |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm run lint` | ESLint, termasuk aturan arah dependency antar layer |
| `npm test` | Vitest (unit test dan test HTTP dengan supertest) |

## Struktur folder

```
src/
├── main.ts                 # Entry point: baca env, rakit dependency, listen di PORT
├── app.ts                  # createApp(): middleware + routes, tanpa listen (dipakai test)
├── config/env.ts           # Satu-satunya file yang membaca process.env
├── di/container.ts         # Composition root: repository -> use case -> controller
├── shared/
│   ├── domain/errors.ts    # DomainError, ValidationError, NotFoundError
│   ├── http/               # HttpError, parseRequest (zod), middleware 404 dan error handler
│   └── logger/             # Pino
└── modules/
    └── transaction/
        ├── domain/         # Entity, aturan bisnis, interface repository
        ├── application/    # Use case: List, Create, Update, Delete
        ├── infrastructure/ # Implementasi repository (in-memory, nanti Postgres)
        └── presentation/   # Router, controller, schema request/response
```

## Menambah fitur baru

Urutannya dari dalam ke luar: domain, lalu application, lalu infrastructure, lalu presentation, lalu daftarkan di `di/container.ts` dan `app.ts`. Tulis test di setiap layer. Contoh latihan pertama ada di PRD bagian 10.

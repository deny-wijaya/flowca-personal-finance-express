<div align="center">

<img src="docs/assets/koko.svg" width="96" alt="Koko, the Flowca mascot" />

# Flowca API

**The REST API behind [Flowca](https://github.com/deny-wijaya/flowca-personal-finance-next), a personal finance tracker.**<br/>
Built with Express 5, PostgreSQL, and Drizzle, organized with clean architecture.

[![CI](https://github.com/deny-wijaya/flowca-personal-finance-express/actions/workflows/ci.yml/badge.svg)](https://github.com/deny-wijaya/flowca-personal-finance-express/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-24+-5BC8D6?logo=nodedotjs&logoColor=1F1B2D)
![Express](https://img.shields.io/badge/Express-5-1F1B2D?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=1F1B2D)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-tested-FF9EC7?logo=vitest&logoColor=1F1B2D)

</div>

<br/>

> This is also a learning project for backend development with Express. The roadmap lives in [`docs/PRD.md`](docs/PRD.md), section 10.

## What it does

The Flowca frontend (Next.js) calls this API from its server to read and write transactions. The **Home** and **Transactions** screens in the frontend read their data from here once the frontend runs with `DATA_SOURCE=api`.

| Method | Endpoint | What it does |
|---|---|---|
| `GET` | `/health` | Health check (no prefix) |
| `GET` | `/api/v1/transactions` | List transactions, filtered by `from`, `to` (ISO 8601), and `type` (`income` / `expense`) |
| `GET` | `/api/v1/transactions/:id` | Get one transaction |
| `POST` | `/api/v1/transactions` | Create a transaction, responds with `201` |
| `PATCH` | `/api/v1/transactions/:id` | Update at least one field |
| `DELETE` | `/api/v1/transactions/:id` | Delete a transaction, responds with `204` |
| `POST` | `/api/v1/auth/register` | Create an account, responds with `201` (password hashed with argon2) |
| `POST` | `/api/v1/auth/login` | Exchange email and password for a JWT access token |

Every response uses the same envelope, and JSON fields are `snake_case`. Amounts are whole Rupiah, and dates are ISO 8601 (responses are always in UTC).

<table>
<tr><th>Success</th><th>Error</th></tr>
<tr>
<td>

```json
{
  "data": {
    "id": "trx_44004a5d-3f88-...",
    "type": "expense",
    "amount": 64000,
    "category": "Transportasi",
    "note": "Gojek ke kantor",
    "occurred_at": "2026-11-06T02:00:00.000Z",
    "created_at": "2026-11-06T02:00:00.000Z",
    "updated_at": "2026-11-06T02:00:00.000Z"
  }
}
```

</td>
<td>

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nominal harus bilangan bulat lebih dari 0",
    "details": {
      "fieldErrors": {
        "amount": ["Nominal harus bilangan bulat lebih dari 0"]
      }
    }
  }
}
```

</td>
</tr>
</table>

4xx messages are in Indonesian because the frontend shows them to users as is. 5xx messages are always generic, and the real cause only goes to the logs.

<details>
<summary><b>Error codes</b></summary>
<br/>

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | The request has the wrong shape or breaks a business rule |
| 400 | `INVALID_JSON` | The body isn't valid JSON |
| 404 | `NOT_FOUND` | No record with that id |
| 404 | `ROUTE_NOT_FOUND` | The endpoint doesn't exist |
| 413 | `PAYLOAD_TOO_LARGE` | The body is larger than 100 KB |
| 422 | `DOMAIN_ERROR` | Any other business rule violation |
| 500 | `INTERNAL_ERROR` | Anything unexpected |

</details>

## Architecture

The code is organized by feature. Each module in `src/modules/<feature>/` has four layers, and dependencies only point inward.

```mermaid
flowchart LR
  subgraph "modules/[feature]"
    presentation["presentation<br/>routes · controller · schemas"]
    application["application<br/>use cases"]
    domain["domain<br/>entities · rules · ports"]
    infrastructure["infrastructure<br/>Drizzle table · repositories"]
  end
  di["di/container.ts"]
  app["app.ts"]

  app --> presentation
  presentation --> application
  application --> domain
  infrastructure -. implements .-> domain
  di --> presentation
  di --> application
  di --> infrastructure
```

| Layer | Responsibility |
|---|---|
| `domain` | Entities, business rules, and the `TransactionRepository` interface. Plain TypeScript, no framework. |
| `application` | Use cases such as `ListTransactions` and `CreateTransaction`. Depends only on the domain. |
| `infrastructure` | Drizzle table schema plus the Postgres and in-memory repositories. |
| `presentation` | Express router, a thin controller, and zod schemas that map requests and responses. |

### One request, start to finish

This is what happens when someone presses save on the **Add transaction** form in the frontend:

```mermaid
sequenceDiagram
  autonumber
  participant FE as Next.js server
  participant MW as Middleware
  participant C as Controller
  participant UC as CreateTransaction
  participant R as PostgresTransactionRepository
  participant DB as PostgreSQL

  FE->>MW: POST /api/v1/transactions
  Note over MW: pino-http request id, helmet,<br/>CORS, express.json (100 KB)
  MW->>C: create(req, res)
  C->>C: Validate body with zod
  C->>UC: execute(input)
  UC->>UC: assertValidTransaction (domain rule)
  UC->>R: create(transaction)
  R->>DB: INSERT INTO transactions
  DB-->>R: row
  R-->>UC: Transaction
  UC-->>C: Transaction
  C-->>FE: 201 { data: TransactionDto }
```

If anything throws along the way, Express 5 passes the error to `errorHandler`, which turns it into the error envelope above. That's why controllers have no try/catch.

### Locked architecture

The architecture rules are checked automatically, so a future change can't break them without someone noticing.

| Guard | What it checks |
|---|---|
| [ESLint](eslint.config.js) | Import direction between layers, `process.env` only in `config/env.ts` |
| [Architecture test](src/architecture.test.ts) | Folder structure, presentation file names, module boundaries, circular dependencies, where `express`, `drizzle-orm`, and `pg` may be used, `.ts` import extensions, no try/catch in controllers |
| [Pre-push hook](.githooks/pre-push) | Typecheck, lint, and tests before every `git push` |
| [CI](.github/workflows/ci.yml) | All of the above plus the build, a migration drift check, and repository tests against a real Postgres |

The full contract is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech stack

| Area | Choice |
|---|---|
| Runtime | Node.js 24+, running `.ts` files directly through type stripping (no `ts-node` or `tsx`) |
| Framework | Express 5 |
| Database | PostgreSQL 18 with Drizzle ORM and drizzle-kit migrations |
| Validation | zod 4 for env, request bodies, and query strings |
| Logging | Pino and pino-http, with `authorization`, `cookie`, and `password` redacted |
| Security | Helmet, a CORS allowlist, and a 100 KB body limit |
| Testing | Vitest for unit tests, Supertest for HTTP tests without opening a port |

## Getting started

You need Node.js 24 or later and Docker.

```bash
git clone https://github.com/deny-wijaya/flowca-personal-finance-express.git
cd flowca-personal-finance-express
npm install
cp .env.example .env
docker compose up -d --wait   # Postgres 18 on localhost:5433
npm run db:migrate            # create the transactions table
npm run db:seed               # add 8 sample transactions for this month
npm run dev                   # http://localhost:4000/api/v1, restarts on file changes
```

Postgres runs on port 5433 instead of 5432, so it doesn't clash with a Postgres installed through Homebrew.

Try it with curl:

```bash
curl localhost:4000/health
curl "localhost:4000/api/v1/transactions?type=expense"
curl -X POST localhost:4000/api/v1/transactions \
  -H 'content-type: application/json' \
  -d '{"type":"expense","amount":64000,"category":"Transportasi","note":"Gojek ke kantor","occurred_at":"2026-11-14T08:00:00+07:00"}'
```

To connect the frontend, set `DATA_SOURCE=api` and `API_BASE_URL=http://localhost:4000/api/v1` in the frontend's `.env.local`.

<details>
<summary><b>Running the Postgres repository tests</b></summary>
<br/>

`npm run test:db` runs against a separate `personal_finance_test` database, because every test clears the table. Create it once:

```bash
docker compose exec postgres createdb -U finance personal_finance_test
DATABASE_URL=postgres://finance:finance@localhost:5433/personal_finance_test npm run db:migrate
```

</details>

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Runs `src/main.ts` directly with Node and restarts on changes |
| `npm run build` / `npm start` | Compiles to `dist/` and runs the build in production |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint, including the layer boundary rules |
| `npm test` | Unit tests, HTTP tests, and the architecture test (no database needed) |
| `npm run test:db` | Repository tests against `personal_finance_test` |
| `npm run verify` | Typecheck, lint, test, and build in one go; must pass before every commit |
| `npm run db:generate` | Creates a new migration in `drizzle/` from changes to `*.table.ts` |
| `npm run db:migrate` | Applies pending migrations to `DATABASE_URL` |
| `npm run db:check` | Fails if the `*.table.ts` schema and the migrations in `drizzle/` don't match |
| `npm run db:studio` | Opens a web UI to browse the tables |
| `npm run db:seed` | Inserts sample transactions (safe to run more than once) |

## Project structure

<details>
<summary><b>Show the full tree</b></summary>

```
src/
├── main.ts                 # Entry point: load env, build dependencies, listen on PORT
├── app.ts                  # createApp(): middleware and routes, no listen() (used by tests)
├── config/env.ts           # The only file that reads process.env
├── di/container.ts         # Composition root: repository -> use case -> controller
├── scripts/seed.ts         # Inserts sample data
├── shared/
│   ├── domain/errors.ts    # DomainError, ValidationError, NotFoundError
│   ├── database/           # createDatabase(): pg pool and Drizzle
│   ├── http/               # HttpError, parseRequest (zod), 404 and error handler middleware
│   └── logger/             # Pino
├── modules/
│   └── transaction/
│       ├── domain/         # Entity, business rules, repository interface
│       ├── application/    # Use cases: List, Get, Create, Update, Delete
│       ├── infrastructure/ # Drizzle table, Postgres and in-memory repositories
│       └── presentation/   # Router, controller, request and response schemas
└── architecture.test.ts    # Architecture lock
drizzle/                    # SQL migrations generated by drizzle-kit
docs/                       # PRD and the architecture contract
```

</details>

## Docs

The docs below are written in Indonesian.

- [`docs/PRD.md`](docs/PRD.md) covers scope and the learning roadmap.
- [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md) is the API contract shared with the frontend.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) covers the architecture rules and how to add a new feature.

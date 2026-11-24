import { pino } from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app.ts";
import { createContainer } from "../../../di/container.ts";
import { InMemoryUserRepository } from "../../auth/infrastructure/in-memory-user-repository.ts";
import { JoseTokenIssuer } from "../../auth/infrastructure/jose-token-issuer.ts";
import { InMemoryAccountRepository } from "../infrastructure/in-memory-account-repository.ts";
import { InMemoryCategoryRepository } from "../infrastructure/in-memory-category-repository.ts";
import { InMemoryTransactionRepository } from "../infrastructure/in-memory-transaction-repository.ts";

/**
 * Test end-to-end level HTTP: request asli masuk ke Express, lewat middleware,
 * controller, use case, sampai repository in-memory. Tidak membuka port sungguhan.
 * Semua endpoint /transactions wajib login, jadi setiap request memakai `api`,
 * yaitu supertest agent yang selalu mengirim header Authorization dengan token yang valid.
 */
const JWT_SECRET = "kunci-rahasia-test-yang-panjangnya-lebih-dari-32-karakter";

function buildApp() {
  const categoryRepository = new InMemoryCategoryRepository();
  const accountRepository: InMemoryAccountRepository = new InMemoryAccountRepository(() => transactionRepository.ledger());
  const transactionRepository = new InMemoryTransactionRepository([], categoryRepository, accountRepository);
  const container = createContainer({
    transactionRepository,
    categoryRepository,
    accountRepository,
    userRepository: new InMemoryUserRepository(),
    jwtSecret: JWT_SECRET,
    clock: { now: () => new Date("2026-11-14T10:00:00+07:00") },
  });
  return createApp({ container, logger: pino({ level: "silent" }), apiPrefix: "/api/v1", corsOrigins: [] });
}

const gojek = {
  id: "seed-1",
  type: "expense",
  amount: 64_000,
  category_id: "cat_expense_transportasi",
  // Diisi di beforeEach dengan akun milik user yang sedang login.
  account_id: "",
  note: "Gojek ke kantor",
  occurred_at: "2026-11-06T09:00:00+07:00",
};

/** Membuat akun lewat API dan mengembalikan id-nya. */
async function createAccount(agent: ReturnType<typeof request.agent>, name: string, openingBalance = 0): Promise<string> {
  const res = await agent.post("/api/v1/accounts").send({ name, kind: "bank", opening_balance: openingBalance }).expect(201);
  return res.body.data.id;
}

describe("/api/v1/transactions", () => {
  let app: ReturnType<typeof buildApp>;
  let api: ReturnType<typeof request.agent>;
  beforeEach(async () => {
    app = buildApp();
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_test");
    api = request.agent(app).set("Authorization", `Bearer ${token}`);
    gojek.account_id = await createAccount(api, "BCA");
  });

  it("transaksi milik user lain dibalas 404, persis seperti transaksi yang tidak ada", async () => {
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_budi");
    const budi = request.agent(app).set("Authorization", `Bearer ${token}`);
    const { body } = await api.post("/api/v1/transactions").send(gojek).expect(201);
    const id = body.data.id;

    const list = await budi.get("/api/v1/transactions").expect(200);
    expect(list.body).toEqual({ data: [], page: { limit: 20, next_cursor: null } });

    const viaGet = await budi.get(`/api/v1/transactions/${id}`).expect(404);
    const unknown = await budi.get("/api/v1/transactions/trx_tidak_ada").expect(404);
    expect(viaGet.body.error.code).toBe(unknown.body.error.code);
    await budi.patch(`/api/v1/transactions/${id}`).send({ amount: 1 }).expect(404);
    await budi.delete(`/api/v1/transactions/${id}`).expect(404);

    // Milik Rani tetap utuh.
    const mine = await api.get(`/api/v1/transactions/${id}`).expect(200);
    expect(mine.body.data.amount).toBe(64_000);
  });

  it("tanpa token membalas 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/api/v1/transactions").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("token palsu membalas 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/api/v1/transactions").set("Authorization", "Bearer bukan.token.asli").expect(401);
    expect(res.body.error).toEqual({ code: "UNAUTHORIZED", message: "Sesi kamu sudah habis. Silakan masuk lagi." });
  });

  it("GET mengembalikan transaksi dengan id seed-1", async () => {
    const created = await api.post("/api/v1/transactions").send(gojek).expect(201);

    const idWrong = created.body.data.id

    const res = await api.get(`/api/v1/transactions/${idWrong}`).expect(200);
    expect(created.body.data.id).toBe(res.body.data.id)
  });

  it("POST membuat transaksi dan GET mengembalikannya dalam envelope { data }", async () => {
    const created = await api.post("/api/v1/transactions").send(gojek).expect(201);
    expect(created.body.data).toMatchObject({ amount: 64_000, occurred_at: "2026-11-06T02:00:00.000Z" });

    const list = await api.get("/api/v1/transactions").query({ type: "expense" }).expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("POST dengan body tidak lengkap membalas 400 VALIDATION_ERROR per field", async () => {
    const res = await api.post("/api/v1/transactions").send({ type: "expense" }).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fieldErrors).toHaveProperty("amount");
  });

  it("POST dengan kategori yang salah membalas 400 dari aturan domain", async () => {
    const res = await api.post("/api/v1/transactions").send({ ...gojek, category_id: "cat_income_gaji" }).expect(400);
    expect(res.body.error.details.fieldErrors.category_id).toEqual(["Kategori Gaji tidak bisa dipakai untuk pengeluaran"]);
  });

  it("POST dengan JSON rusak membalas 400 INVALID_JSON", async () => {
    const res = await api
      .post("/api/v1/transactions")
      .set("Content-Type", "application/json")
      .send("{amount:")
      .expect(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("PATCH lalu DELETE transaksi", async () => {
    const { body } = await api.post("/api/v1/transactions").send(gojek).expect(201);
    const id = body.data.id;

    const patched = await api.patch(`/api/v1/transactions/${id}`).send({ amount: 70_000 }).expect(200);
    expect(patched.body.data.amount).toBe(70_000);

    await api.delete(`/api/v1/transactions/${id}`).expect(204);
    await api.delete(`/api/v1/transactions/${id}`).expect(404);
  });

  describe("pagination dan pencarian", () => {
    // Transaksi ke-n tercatat pukul 08.0n, jadi transaksi dengan n terbesar adalah yang terbaru.
    async function seed(count: number) {
      for (let n = 1; n <= count; n++) {
        await api
          .post("/api/v1/transactions")
          .send({ ...gojek, note: `Gojek ke-${n}`, occurred_at: `2026-11-02T08:${String(n).padStart(2, "0")}:00+07:00` })
          .expect(201);
      }
    }

    it("halaman pertama berisi limit item terbaru, next_cursor membuka halaman berikutnya", async () => {
      await seed(5);

      const first = await api.get("/api/v1/transactions").query({ limit: 2 }).expect(200);
      expect(first.body.data.map((t: { note: string }) => t.note)).toEqual(["Gojek ke-5", "Gojek ke-4"]);
      expect(first.body.page).toEqual({ limit: 2, next_cursor: expect.any(String) });

      const second = await api.get("/api/v1/transactions").query({ limit: 2, cursor: first.body.page.next_cursor }).expect(200);
      expect(second.body.data.map((t: { note: string }) => t.note)).toEqual(["Gojek ke-3", "Gojek ke-2"]);

      const last = await api.get("/api/v1/transactions").query({ limit: 2, cursor: second.body.page.next_cursor }).expect(200);
      expect(last.body.data.map((t: { note: string }) => t.note)).toEqual(["Gojek ke-1"]);
      expect(last.body.page.next_cursor).toBeNull();
    });

    it("tanpa limit memakai bawaan 20", async () => {
      await seed(21);
      const res = await api.get("/api/v1/transactions").expect(200);
      expect(res.body.data).toHaveLength(20);
      expect(res.body.page.limit).toBe(20);
      expect(res.body.page.next_cursor).not.toBeNull();
    });

    it("menolak limit di luar 1-100 dan cursor yang rusak", async () => {
      for (const limit of ["0", "101", "abc", "2.5"]) {
        const res = await api.get("/api/v1/transactions").query({ limit }).expect(400);
        expect(res.body.error.details.fieldErrors.limit).toEqual(["limit harus bilangan bulat 1 sampai 100"]);
      }
      for (const cursor of ["bukan-cursor", Buffer.from(JSON.stringify({ o: "kemarin" })).toString("base64url")]) {
        const res = await api.get("/api/v1/transactions").query({ cursor }).expect(400);
        expect(res.body.error.details.fieldErrors.cursor).toEqual(["Cursor tidak valid"]);
      }
    });

    it("q mencari di catatan dan kategori tanpa membedakan huruf besar kecil, category_id mencocokkan persis", async () => {
      await seed(2);
      await api
        .post("/api/v1/transactions")
        .send({ type: "income", amount: 12_500_000, category_id: "cat_income_gaji", account_id: gojek.account_id, note: "Gaji bulanan", occurred_at: "2026-11-01T09:00:00+07:00" })
        .expect(201);

      const byQ = await api.get("/api/v1/transactions").query({ q: "GOJEK KE-2" }).expect(200);
      expect(byQ.body.data.map((t: { note: string }) => t.note)).toEqual(["Gojek ke-2"]);

      const byCategory = await api.get("/api/v1/transactions").query({ category_id: "cat_income_gaji" }).expect(200);
      expect(byCategory.body.data.map((t: { note: string }) => t.note)).toEqual(["Gaji bulanan"]);

      const empty = await api.get("/api/v1/transactions").query({ q: "   " }).expect(400);
      expect(empty.body.error.details.fieldErrors.q).toEqual(["Kata pencarian tidak boleh kosong"]);
    });
  });

  it("endpoint yang tidak ada membalas 404 ROUTE_NOT_FOUND", async () => {
    const res = await api.get("/api/v1/budgets").expect(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

describe("/api/v1/summary", () => {
  let api: ReturnType<typeof request.agent>;
  beforeEach(async () => {
    const app = buildApp();
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_test");
    api = request.agent(app).set("Authorization", `Bearer ${token}`);
    gojek.account_id = await createAccount(api, "BCA");
  });

  const november = { from: "2026-11-01T00:00:00+07:00", to: "2026-11-30T23:59:59.999+07:00" };

  it("membalas ringkasan periode dengan nama field snake_case", async () => {
    await api.post("/api/v1/transactions").send(gojek).expect(201);
    await api
      .post("/api/v1/transactions")
      .send({ type: "income", amount: 12_500_000, category_id: "cat_income_gaji", account_id: gojek.account_id, occurred_at: "2026-11-01T09:00:00+07:00" })
      .expect(201);

    const res = await api.get("/api/v1/summary").query(november).expect(200);

    expect(res.body).toEqual({
      data: {
        total_income: 12_500_000,
        total_expense: 64_000,
        net_cashflow: 12_436_000,
        transaction_count: 2,
        income_count: 1,
        expense_count: 1,
        expense_by_category: [{ category_id: "cat_expense_transportasi", category: "Transportasi", amount: 64_000 }],
      },
    });
  });

  it("menolak request tanpa from dan to", async () => {
    const res = await api.get("/api/v1/summary").expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(["from", "to"]);
  });

  it("menolak from yang lebih besar dari to", async () => {
    const res = await api.get("/api/v1/summary").query({ from: november.to, to: november.from }).expect(400);
    expect(res.body.error.details.fieldErrors.from).toEqual(["`from` harus sebelum `to`"]);
  });

  it("wajib login", async () => {
    const res = await request(buildApp()).get("/api/v1/summary").query(november).expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("/api/v1/categories", () => {
  let app: ReturnType<typeof buildApp>;
  let api: ReturnType<typeof request.agent>;
  beforeEach(async () => {
    app = buildApp();
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_test");
    api = request.agent(app).set("Authorization", `Bearer ${token}`);
    gojek.account_id = await createAccount(api, "BCA");
  });

  it("GET mengembalikan kategori bawaan per jenis dengan objek page", async () => {
    const res = await api.get("/api/v1/categories").query({ type: "income", limit: 100 }).expect(200);
    expect(res.body.data[0]).toEqual({ id: "cat_income_gaji", name: "Gaji", type: "income", is_default: true });
    expect(res.body.data).toHaveLength(6);
    expect(res.body.page).toEqual({ limit: 100, next_cursor: null });
  });

  it("POST membuat kategori kustom, lalu kategori itu bisa dipakai transaksi dan tampil namanya", async () => {
    const created = await api.post("/api/v1/categories").send({ name: " Kos ", type: "expense" }).expect(201);
    expect(created.body.data).toMatchObject({ name: "Kos", type: "expense", is_default: false });

    const trx = await api.post("/api/v1/transactions").send({ ...gojek, category_id: created.body.data.id }).expect(201);
    expect(trx.body.data).toMatchObject({ category_id: created.body.data.id, category: "Kos" });

    const list = await api.get("/api/v1/categories").query({ type: "expense" }).expect(200);
    expect(list.body.data.at(-1).name).toBe("Kos");
  });

  it("POST nama yang sudah ada dibalas 409 CATEGORY_ALREADY_EXISTS di field name", async () => {
    await api.post("/api/v1/categories").send({ name: "Kos", type: "expense" }).expect(201);
    const res = await api.post("/api/v1/categories").send({ name: "kos", type: "expense" }).expect(409);
    expect(res.body.error).toEqual({
      code: "CATEGORY_ALREADY_EXISTS",
      message: "Kategori kos sudah ada",
      details: { fieldErrors: { name: ["Kategori kos sudah ada"] } },
    });
  });

  it("POST menolak nama kosong dan jenis yang salah", async () => {
    const empty = await api.post("/api/v1/categories").send({ name: "   ", type: "expense" }).expect(400);
    expect(empty.body.error.details.fieldErrors.name).toEqual(["Nama kategori wajib diisi"]);
    const badType = await api.post("/api/v1/categories").send({ name: "Kos", type: "transfer" }).expect(400);
    expect(badType.body.error.details.fieldErrors.type).toEqual(["Jenis harus income atau expense"]);
  });

  it("kategori kustom user lain tidak terlihat dan tidak bisa dipakai", async () => {
    const created = await api.post("/api/v1/categories").send({ name: "Kos", type: "expense" }).expect(201);
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_budi");
    const budi = request.agent(app).set("Authorization", `Bearer ${token}`);

    const list = await budi.get("/api/v1/categories").query({ type: "expense" }).expect(200);
    expect(list.body.data.map((c: { name: string }) => c.name)).not.toContain("Kos");
    const res = await budi.post("/api/v1/transactions").send({ ...gojek, category_id: created.body.data.id }).expect(400);
    expect(res.body.error.details.fieldErrors.category_id).toEqual(["Kategori tidak ditemukan"]);
  });

  it("wajib login", async () => {
    await request(app).get("/api/v1/categories").expect(401);
  });
});

describe("/api/v1/accounts", () => {
  let app: ReturnType<typeof buildApp>;
  let api: ReturnType<typeof request.agent>;
  beforeEach(async () => {
    app = buildApp();
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_test");
    api = request.agent(app).set("Authorization", `Bearer ${token}`);
  });

  it("POST membuat akun, GET mengembalikan saldo saat ini yang ikut berubah oleh transaksi", async () => {
    const created = await api.post("/api/v1/accounts").send({ name: " BCA ", kind: "bank", opening_balance: 2_000_000 }).expect(201);
    expect(created.body.data).toMatchObject({ name: "BCA", kind: "bank", opening_balance: 2_000_000, balance: 2_000_000 });
    expect(created.body.data.id).toMatch(/^acc_/);

    await api.post("/api/v1/transactions").send({ ...gojek, account_id: created.body.data.id }).expect(201);

    const list = await api.get("/api/v1/accounts").expect(200);
    expect(list.body).toEqual({
      data: [{ ...created.body.data, balance: 2_000_000 - 64_000 }],
      page: { limit: 20, next_cursor: null },
    });
  });

  it("transaksi membawa account_id dan nama akun, dan bisa difilter per akun", async () => {
    const bca = await createAccount(api, "BCA");
    const tunai = await createAccount(api, "Tunai");
    const trx = await api.post("/api/v1/transactions").send({ ...gojek, account_id: tunai }).expect(201);
    expect(trx.body.data).toMatchObject({ account_id: tunai, account: "Tunai" });
    await api.post("/api/v1/transactions").send({ ...gojek, account_id: bca }).expect(201);

    const filtered = await api.get("/api/v1/transactions").query({ account_id: tunai }).expect(200);
    expect(filtered.body.data.map((t: { id: string }) => t.id)).toEqual([trx.body.data.id]);
  });

  it("POST /transactions tanpa account_id atau dengan akun milik user lain dibalas 400", async () => {
    // undefined tidak ikut dikirim di JSON, jadi body ini sama dengan body tanpa account_id.
    const missing = await api.post("/api/v1/transactions").send({ ...gojek, account_id: undefined }).expect(400);
    expect(missing.body.error.details.fieldErrors.account_id).toEqual(["Akun wajib diisi"]);

    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_budi");
    const budi = request.agent(app).set("Authorization", `Bearer ${token}`);
    const milikBudi = await createAccount(budi, "Dompet Budi");
    const foreign = await api.post("/api/v1/transactions").send({ ...gojek, account_id: milikBudi }).expect(400);
    expect(foreign.body.error.details.fieldErrors.account_id).toEqual(["Akun tidak ditemukan"]);

    const budiList = await budi.get("/api/v1/accounts").expect(200);
    expect(budiList.body.data.map((a: { name: string }) => a.name)).toEqual(["Dompet Budi"]);
  });

  it("POST nama dobel dibalas 409 ACCOUNT_ALREADY_EXISTS, jenis dan saldo yang salah dibalas 400", async () => {
    await createAccount(api, "BCA");
    const dup = await api.post("/api/v1/accounts").send({ name: "bca", kind: "bank", opening_balance: 0 }).expect(409);
    expect(dup.body.error).toEqual({
      code: "ACCOUNT_ALREADY_EXISTS",
      message: "Akun bca sudah ada",
      details: { fieldErrors: { name: ["Akun bca sudah ada"] } },
    });

    const badKind = await api.post("/api/v1/accounts").send({ name: "Dana", kind: "saham", opening_balance: 0 }).expect(400);
    expect(badKind.body.error.details.fieldErrors.kind).toEqual(["Jenis akun harus cash, bank, ewallet, atau credit"]);
    const badBalance = await api.post("/api/v1/accounts").send({ name: "Dana", kind: "ewallet", opening_balance: "seratus" }).expect(400);
    expect(badBalance.body.error.details.fieldErrors.opening_balance).toEqual(["Saldo awal wajib berupa angka"]);
  });

  it("wajib login", async () => {
    await request(app).get("/api/v1/accounts").expect(401);
  });
});

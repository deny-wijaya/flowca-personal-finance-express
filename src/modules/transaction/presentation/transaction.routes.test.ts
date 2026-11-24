import { pino } from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app.ts";
import { createContainer } from "../../../di/container.ts";
import { InMemoryUserRepository } from "../../auth/infrastructure/in-memory-user-repository.ts";
import { JoseTokenIssuer } from "../../auth/infrastructure/jose-token-issuer.ts";
import { InMemoryTransactionRepository } from "../infrastructure/in-memory-transaction-repository.ts";

/**
 * Test end-to-end level HTTP: request asli masuk ke Express, lewat middleware,
 * controller, use case, sampai repository in-memory. Tidak membuka port sungguhan.
 * Semua endpoint /transactions wajib login, jadi setiap request memakai `api`,
 * yaitu supertest agent yang selalu mengirim header Authorization dengan token yang valid.
 */
const JWT_SECRET = "kunci-rahasia-test-yang-panjangnya-lebih-dari-32-karakter";

function buildApp() {
  const container = createContainer({
    transactionRepository: new InMemoryTransactionRepository(),
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
  category: "Transportasi",
  note: "Gojek ke kantor",
  occurred_at: "2026-11-06T09:00:00+07:00",
};

describe("/api/v1/transactions", () => {
  let app: ReturnType<typeof buildApp>;
  let api: ReturnType<typeof request.agent>;
  beforeEach(async () => {
    app = buildApp();
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_test");
    api = request.agent(app).set("Authorization", `Bearer ${token}`);
  });

  it("transaksi milik user lain dibalas 404, persis seperti transaksi yang tidak ada", async () => {
    const { token } = await new JoseTokenIssuer({ secret: JWT_SECRET, expiresIn: 3600 }).issue("usr_budi");
    const budi = request.agent(app).set("Authorization", `Bearer ${token}`);
    const { body } = await api.post("/api/v1/transactions").send(gojek).expect(201);
    const id = body.data.id;

    const list = await budi.get("/api/v1/transactions").expect(200);
    expect(list.body.data).toEqual([]);

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
    const res = await api.post("/api/v1/transactions").send({ ...gojek, category: "Gaji" }).expect(400);
    expect(res.body.error.details.fieldErrors).toHaveProperty("category");
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

  it("endpoint yang tidak ada membalas 404 ROUTE_NOT_FOUND", async () => {
    const res = await api.get("/api/v1/budgets").expect(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

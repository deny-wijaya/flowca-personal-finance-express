import { pino } from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app.ts";
import { createContainer } from "../../../di/container.ts";
import { InMemoryTransactionRepository } from "../infrastructure/in-memory-transaction-repository.ts";

/**
 * Test end-to-end level HTTP: request asli masuk ke Express, lewat middleware,
 * controller, use case, sampai repository in-memory. Tidak membuka port sungguhan.
 */
function buildApp() {
  const container = createContainer({
    transactionRepository: new InMemoryTransactionRepository(),
    clock: { now: () => new Date("2026-11-14T10:00:00+07:00") },
  });
  return createApp({ container, logger: pino({ level: "silent" }), apiPrefix: "/api/v1", corsOrigins: [] });
}

const gojek = {
  type: "expense",
  amount: 64_000,
  category: "Transportasi",
  note: "Gojek ke kantor",
  occurred_at: "2026-11-06T09:00:00+07:00",
};

describe("/api/v1/transactions", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    app = buildApp();
  });

  it("POST membuat transaksi dan GET mengembalikannya dalam envelope { data }", async () => {
    const created = await request(app).post("/api/v1/transactions").send(gojek).expect(201);
    expect(created.body.data).toMatchObject({ amount: 64_000, occurred_at: "2026-11-06T02:00:00.000Z" });

    const list = await request(app).get("/api/v1/transactions").query({ type: "expense" }).expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("POST dengan body tidak lengkap membalas 400 VALIDATION_ERROR per field", async () => {
    const res = await request(app).post("/api/v1/transactions").send({ type: "expense" }).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fieldErrors).toHaveProperty("amount");
  });

  it("POST dengan kategori yang salah membalas 400 dari aturan domain", async () => {
    const res = await request(app).post("/api/v1/transactions").send({ ...gojek, category: "Gaji" }).expect(400);
    expect(res.body.error.details.fieldErrors).toHaveProperty("category");
  });

  it("POST dengan JSON rusak membalas 400 INVALID_JSON", async () => {
    const res = await request(app)
      .post("/api/v1/transactions")
      .set("Content-Type", "application/json")
      .send("{amount:")
      .expect(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("PATCH lalu DELETE transaksi", async () => {
    const { body } = await request(app).post("/api/v1/transactions").send(gojek).expect(201);
    const id = body.data.id;

    const patched = await request(app).patch(`/api/v1/transactions/${id}`).send({ amount: 70_000 }).expect(200);
    expect(patched.body.data.amount).toBe(70_000);

    await request(app).delete(`/api/v1/transactions/${id}`).expect(204);
    await request(app).delete(`/api/v1/transactions/${id}`).expect(404);
  });

  it("endpoint yang tidak ada membalas 404 ROUTE_NOT_FOUND", async () => {
    const res = await request(app).get("/api/v1/budgets").expect(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

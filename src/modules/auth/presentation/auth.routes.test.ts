import { pino } from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app.ts";
import { createContainer } from "../../../di/container.ts";
import { InMemoryTransactionRepository } from "../../transaction/infrastructure/in-memory-transaction-repository.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";

/**
 * Test HTTP untuk register dan login sesuai docs/API-CONTRACT.md bagian 4.1 dan 4.2.
 * Hasher yang dipakai argon2 asli (bawaan container), repository-nya in-memory.
 */
function buildApp() {
  const container = createContainer({
    transactionRepository: new InMemoryTransactionRepository(),
    userRepository: new InMemoryUserRepository(),
    jwtSecret: "kunci-rahasia-test-yang-panjangnya-lebih-dari-32-karakter",
  });
  return createApp({ container, logger: pino({ level: "silent" }), apiPrefix: "/api/v1", corsOrigins: [] });
}

const rani = { name: "Rani Putri", email: "rani@email.com", password: "rahasia123" };

describe("POST /api/v1/auth/register", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    app = buildApp();
  });

  it("201 dengan UserDto, tanpa password maupun password_hash", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(rani).expect(201);

    expect(res.body.data).toEqual({
      id: expect.stringMatching(/^usr_/),
      name: "Rani Putri",
      email: "rani@email.com",
      created_at: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain("rahasia123");
    expect(JSON.stringify(res.body)).not.toContain("argon2");
  });

  it("email disimpan dalam huruf kecil", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...rani, email: "  Rani@Email.COM " })
      .expect(201);
    expect(res.body.data.email).toBe("rani@email.com");
  });

  it("409 EMAIL_ALREADY_REGISTERED dengan pesan di field email", async () => {
    await request(app).post("/api/v1/auth/register").send(rani).expect(201);
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...rani, email: "RANI@email.com" })
      .expect(409);

    expect(res.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(res.body.error.details.fieldErrors.email).toEqual(["Email sudah terdaftar. Silakan masuk."]);
  });

  it("400 VALIDATION_ERROR per field kalau body kosong", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({}).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["email", "name", "password"]);
  });

  it("400 untuk format email yang salah", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...rani, email: "rani-email.com" })
      .expect(400);
    expect(res.body.error.details.fieldErrors).toHaveProperty("email");
  });

  it("400 dari aturan domain kalau password tidak mengandung angka", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...rani, password: "rahasiasekali" })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fieldErrors.password).toEqual(["Password harus mengandung huruf dan angka"]);
  });
});

describe("POST /api/v1/auth/login", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(async () => {
    app = buildApp();
    await request(app).post("/api/v1/auth/register").send(rani).expect(201);
  });

  it("200 dengan access_token JWT dan expires_in", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "Rani@Email.com", password: "rahasia123" })
      .expect(200);

    expect(res.body.data.expires_in).toBe(86_400);
    // JWT terdiri dari tiga bagian yang dipisah titik: header.payload.signature
    expect(res.body.data.access_token.split(".")).toHaveLength(3);
  });

  it("password salah dan email tidak terdaftar membalas 401 yang sama persis", async () => {
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "rani@email.com", password: "salah123" })
      .expect(401);
    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "budi@email.com", password: "rahasia123" })
      .expect(401);

    expect(wrongPassword.body).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Email atau password salah." },
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("400 VALIDATION_ERROR kalau email atau password kosong", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "", password: "" }).expect(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["email", "password"]);
  });
});

describe("GET /api/v1/auth/me", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    app = buildApp();
  });

  it("200 dengan UserDto milik pemilik token", async () => {
    await request(app).post("/api/v1/auth/register").send(rani).expect(201);
    const login = await request(app).post("/api/v1/auth/login").send(rani).expect(200);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.access_token}`)
      .expect(200);

    expect(res.body.data).toMatchObject({ name: "Rani Putri", email: "rani@email.com" });
    expect(res.body.data).not.toHaveProperty("password_hash");
  });

  it("401 UNAUTHORIZED tanpa header Authorization", async () => {
    const res = await request(app).get("/api/v1/auth/me").expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("401 UNAUTHORIZED kalau header bukan format Bearer", async () => {
    await request(app).get("/api/v1/auth/me").set("Authorization", "Basic cmFuaTpyYWhhc2lh").expect(401);
  });
});

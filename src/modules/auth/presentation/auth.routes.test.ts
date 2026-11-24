import { pino } from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../app.ts";
import { createContainer } from "../../../di/container.ts";
import { InMemoryBudgetRepository } from "../../transaction/infrastructure/in-memory-budget-repository.ts";
import { InMemoryAccountRepository } from "../../transaction/infrastructure/in-memory-account-repository.ts";
import { InMemoryCategoryRepository } from "../../transaction/infrastructure/in-memory-category-repository.ts";
import { InMemoryTransactionRepository } from "../../transaction/infrastructure/in-memory-transaction-repository.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";

/**
 * Test HTTP untuk register dan login sesuai docs/API-CONTRACT.md bagian 4.1 dan 4.2.
 * Hasher yang dipakai argon2 asli (bawaan container), repository-nya in-memory.
 */
function buildApp() {
  const container = createContainer({
    transactionRepository: new InMemoryTransactionRepository(),
    categoryRepository: new InMemoryCategoryRepository(),
    accountRepository: new InMemoryAccountRepository(),
    budgetRepository: new InMemoryBudgetRepository(),
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

describe("Rate limit POST /api/v1/auth/login", () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(async () => {
    app = buildApp();
    await request(app).post("/api/v1/auth/register").send(rani).expect(201);
  });

  const wrong = { email: "rani@email.com", password: "salah1234" };
  // supertest terhubung dari 127.0.0.1 (loopback, dipercaya), jadi X-Forwarded-For dipakai sebagai IP user.
  const fromIp = (ip: string) => request(app).post("/api/v1/auth/login").set("X-Forwarded-For", ip);

  it("5 login gagal dari IP yang sama lolos, yang ke-6 dibalas 429 dengan Retry-After", async () => {
    for (let i = 0; i < 5; i++) await fromIp("203.0.113.10").send(wrong).expect(401);

    const res = await fromIp("203.0.113.10").send(wrong).expect(429);
    expect(res.body.error).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Terlalu banyak percobaan masuk. Coba lagi dalam 1 menit.",
    });
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);

    // Password benar pun ditolak selama masih dalam jendela 1 menit.
    await fromIp("203.0.113.10").send(rani).expect(429);
  });

  it("IP lain tidak ikut terkunci", async () => {
    for (let i = 0; i < 5; i++) await fromIp("203.0.113.10").send(wrong).expect(401);
    await fromIp("203.0.113.10").send(wrong).expect(429);

    await fromIp("198.51.100.20").send(rani).expect(200);
  });

  it("login yang berhasil tidak dihitung", async () => {
    for (let i = 0; i < 6; i++) await fromIp("203.0.113.10").send(rani).expect(200);
    await fromIp("203.0.113.10").send(wrong).expect(401);
  });
});

describe("X-Forwarded-For dari alamat yang tidak dipercaya", () => {
  it("diabaikan, jadi mengganti IP palsu di setiap request tidak memberi jatah percobaan baru", async () => {
    // trustProxy diisi IP lain, sehingga supertest (127.0.0.1) bukan proxy yang dipercaya.
    const container = createContainer({
      transactionRepository: new InMemoryTransactionRepository(),
      categoryRepository: new InMemoryCategoryRepository(),
      accountRepository: new InMemoryAccountRepository(),
      budgetRepository: new InMemoryBudgetRepository(),
      userRepository: new InMemoryUserRepository(),
      jwtSecret: "kunci-rahasia-test-yang-panjangnya-lebih-dari-32-karakter",
    });
    const app = createApp({
      container,
      logger: pino({ level: "silent" }),
      apiPrefix: "/api/v1",
      corsOrigins: [],
      trustProxy: "10.0.0.1",
    });
    const wrong = { email: "rani@email.com", password: "salah1234" };

    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", `198.51.100.${i}`).send(wrong).expect(401);
    }
    await request(app).post("/api/v1/auth/login").set("X-Forwarded-For", "198.51.100.99").send(wrong).expect(429);
  });
});

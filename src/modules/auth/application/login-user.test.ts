import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PasswordHasher } from "../domain/password-hasher.ts";
import type { TokenIssuer } from "../domain/token-issuer.ts";
import { InvalidCredentialsError } from "../domain/user.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";
import { LoginUser } from "./login-user.ts";
import { RegisterUser } from "./register-user.ts";

const fakeHasher: PasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  verify: async (hash, password) => hash === `hashed:${password}`,
};

const fakeTokens: TokenIssuer = {
  issue: async (userId) => ({ token: `token-untuk-${userId}`, expiresIn: 86_400 }),
};

describe("LoginUser", () => {
  let login: LoginUser;
  let raniId: string;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const rani = await new RegisterUser(users, fakeHasher).execute({
      name: "Rani Putri",
      email: "rani@email.com",
      password: "rahasia123",
    });
    raniId = rani.id;
    login = new LoginUser(users, fakeHasher, fakeTokens);
  });

  it("email dan password benar mengembalikan token untuk user itu", async () => {
    const result = await login.execute({ email: "rani@email.com", password: "rahasia123" });
    expect(result).toEqual({ token: `token-untuk-${raniId}`, expiresIn: 86_400 });
  });

  it("email dinormalisasi, jadi huruf besar tetap bisa login", async () => {
    await expect(login.execute({ email: " Rani@Email.COM ", password: "rahasia123" })).resolves.toBeDefined();
  });

  it("password salah ditolak dengan InvalidCredentialsError", async () => {
    await expect(login.execute({ email: "rani@email.com", password: "salah123" })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it("email tidak terdaftar ditolak dengan error yang sama, dan tetap menjalankan verify", async () => {
    const verify = vi.spyOn(fakeHasher, "verify");
    await expect(login.execute({ email: "budi@email.com", password: "rahasia123" })).rejects.toThrow(
      InvalidCredentialsError,
    );
    expect(verify).toHaveBeenCalledOnce();
    verify.mockRestore();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../../../shared/domain/errors.ts";
import type { PasswordHasher } from "../domain/password-hasher.ts";
import { EmailAlreadyRegisteredError } from "../domain/user.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";
import { RegisterUser } from "./register-user.ts";

/** Hasher palsu yang cepat dan mudah dibaca. Hasher argon2 asli dites terpisah di infrastructure. */
const fakeHasher: PasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  verify: async (hash, password) => hash === `hashed:${password}`,
};

describe("RegisterUser", () => {
  let users: InMemoryUserRepository;
  let register: RegisterUser;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    register = new RegisterUser(users, fakeHasher);
  });

  const rani = { name: "Rani Putri", email: "rani@email.com", password: "rahasia123" };

  it("menyimpan user dengan password yang sudah di-hash, bukan password asli", async () => {
    const user = await register.execute(rani);
    expect(user.id).toMatch(/^usr_/);
    expect(user.passwordHash).toBe("hashed:rahasia123");
    expect(user.passwordHash).not.toBe(rani.password);
  });

  it("menormalisasi email dan merapikan nama", async () => {
    const user = await register.execute({ ...rani, name: "  Rani Putri ", email: " Rani@Email.COM " });
    expect(user.email).toBe("rani@email.com");
    expect(user.name).toBe("Rani Putri");
  });

  it("menolak email yang sudah terdaftar walaupun huruf besarnya berbeda", async () => {
    await register.execute(rani);
    await expect(register.execute({ ...rani, email: "RANI@email.com" })).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it.each([
    ["kurang dari 8 karakter", "rah123"],
    ["tanpa angka", "rahasiasekali"],
    ["tanpa huruf", "12345678"],
    ["mengandung flowca", "Flowca2026"],
    ["lebih dari 72 karakter", `a1${"x".repeat(71)}`],
  ])("menolak password %s", async (_label, password) => {
    await expect(register.execute({ ...rani, password })).rejects.toThrow(ValidationError);
  });
});

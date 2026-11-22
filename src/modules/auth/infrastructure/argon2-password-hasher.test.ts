import { describe, expect, it } from "vitest";
import { Argon2PasswordHasher } from "./argon2-password-hasher.ts";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  it("hash berbentuk argon2id dan tidak berisi password asli", async () => {
    const hash = await hasher.hash("rahasia123");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("rahasia123");
  });

  it("password yang sama menghasilkan hash berbeda karena salt acak", async () => {
    expect(await hasher.hash("rahasia123")).not.toBe(await hasher.hash("rahasia123"));
  });

  it("verify hanya menerima password yang benar", async () => {
    const hash = await hasher.hash("rahasia123");
    expect(await hasher.verify(hash, "rahasia123")).toBe(true);
    expect(await hasher.verify(hash, "rahasia124")).toBe(false);
  });
});

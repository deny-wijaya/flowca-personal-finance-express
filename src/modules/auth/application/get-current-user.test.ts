import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../../../shared/domain/errors.ts";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository.ts";
import { GetCurrentUser } from "./get-current-user.ts";

describe("GetCurrentUser", () => {
  it("mengembalikan user berdasarkan id dari token", async () => {
    const users = new InMemoryUserRepository();
    const rani = await users.create({ name: "Rani Putri", email: "rani@email.com", passwordHash: "hash" });
    expect(await new GetCurrentUser(users).execute(rani.id)).toEqual(rani);
  });

  it("melempar UnauthorizedError kalau akun pemilik token sudah tidak ada", async () => {
    await expect(new GetCurrentUser(new InMemoryUserRepository()).execute("usr_hilang")).rejects.toThrow(UnauthorizedError);
  });
});

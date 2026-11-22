import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../../../shared/domain/errors.ts";
import { JoseTokenIssuer } from "./jose-token-issuer.ts";
import { JoseTokenVerifier } from "./jose-token-verifier.ts";

const secret = "kunci-rahasia-test-yang-panjangnya-lebih-dari-32-karakter";
const key = new TextEncoder().encode(secret);

describe("JoseTokenVerifier", () => {
  const issuer = new JoseTokenIssuer({ secret, expiresIn: 86_400 });
  const verifier = new JoseTokenVerifier({ secret });

  it("token dari JoseTokenIssuer menghasilkan userId pemiliknya", async () => {
    const { token } = await issuer.issue("usr_1");
    expect(await verifier.verify(token)).toEqual({ userId: "usr_1" });
  });

  it("menolak token yang ditandatangani dengan secret lain", async () => {
    const { token } = await new JoseTokenIssuer({ secret: `${secret}-lain`, expiresIn: 60 }).issue("usr_1");
    await expect(verifier.verify(token)).rejects.toThrow(UnauthorizedError);
  });

  it("menolak token yang isinya diubah (sub diganti user lain)", async () => {
    const { token } = await issuer.issue("usr_1");
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "usr_2", iat: 1, exp: 9_999_999_999 })).toString("base64url");
    await expect(verifier.verify(`${header}.${forgedPayload}.${signature}`)).rejects.toThrow(UnauthorizedError);
  });

  it("menolak token yang sudah kedaluwarsa", async () => {
    const expired = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("usr_1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(key);
    await expect(verifier.verify(expired)).rejects.toThrow(UnauthorizedError);
  });

  it("menolak teks yang bukan JWT", async () => {
    await expect(verifier.verify("bukan-token")).rejects.toThrow(UnauthorizedError);
  });
});

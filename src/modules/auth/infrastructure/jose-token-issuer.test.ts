import { decodeJwt, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { JoseTokenIssuer } from "./jose-token-issuer.ts";

const secret = "kunci-rahasia-test-yang-panjangnya-lebih-dari-32-karakter";

describe("JoseTokenIssuer", () => {
  const issuer = new JoseTokenIssuer({ secret, expiresIn: 86_400 });

  it("membuat JWT HS256 berisi sub, iat, dan exp 1 hari", async () => {
    const { token, expiresIn } = await issuer.issue("usr_1");
    const claims = decodeJwt(token);

    expect(expiresIn).toBe(86_400);
    expect(claims.sub).toBe("usr_1");
    expect(claims.exp! - claims.iat!).toBe(86_400);
    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "sub"]);
  });

  it("tanda tangannya hanya valid dengan secret yang sama", async () => {
    const { token } = await issuer.issue("usr_1");
    await expect(jwtVerify(token, new TextEncoder().encode(secret))).resolves.toBeDefined();
    await expect(jwtVerify(token, new TextEncoder().encode(`${secret}-lain`))).rejects.toThrow();
  });
});

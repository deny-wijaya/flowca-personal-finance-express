/** Hasil pemeriksaan token yang valid: siapa pemiliknya. */
export type AuthContext = {
  userId: string;
};

/**
 * Port untuk memeriksa access token. Pasangan dari TokenIssuer.
 * Melempar UnauthorizedError kalau token rusak, tanda tangannya tidak cocok, atau sudah kedaluwarsa.
 */
export interface TokenVerifier {
  verify(token: string): Promise<AuthContext>;
}

/** Token yang diberikan ke frontend setelah login berhasil. */
export type AccessToken = {
  token: string;
  /** Masa berlaku dalam detik, sama dengan `expires_in` di response. */
  expiresIn: number;
};

/**
 * Port untuk membuat access token. Use case tidak tahu bahwa token-nya JWT;
 * implementasi dengan library `jose` ada di infrastructure.
 */
export interface TokenIssuer {
  issue(userId: string): Promise<AccessToken>;
}

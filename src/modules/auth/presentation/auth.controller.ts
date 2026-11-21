import type { RequestHandler } from "express";
import { parseRequest } from "../../../shared/http/validate.ts";
import type { RegisterUser } from "../application/register-user.ts";
import { registerBodySchema, toUserDto } from "./auth.schemas.ts";

export type AuthUseCases = {
  registerUser: RegisterUser;
};

/**
 * Controller tipis: validasi bentuk request, panggil use case, bentuk response.
 * Error (400 password lemah, 409 email terdaftar) dilempar oleh use case dan diubah
 * menjadi JSON oleh errorHandler, jadi tidak ada try/catch di sini.
 */
export function createAuthController(useCases: AuthUseCases) {
  const register: RequestHandler = async (req, res) => {
    const body = parseRequest(registerBodySchema, req.body);
    const user = await useCases.registerUser.execute(body);
    res.status(201).json({ data: toUserDto(user) });
  };

  return { register };
}

export type AuthController = ReturnType<typeof createAuthController>;

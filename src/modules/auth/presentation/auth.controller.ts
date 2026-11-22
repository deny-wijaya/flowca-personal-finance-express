import type { RequestHandler } from "express";
import { parseRequest } from "../../../shared/http/validate.ts";
import type { LoginUser } from "../application/login-user.ts";
import type { RegisterUser } from "../application/register-user.ts";
import { loginBodySchema, registerBodySchema, toAccessTokenDto, toUserDto } from "./auth.schemas.ts";

export type AuthUseCases = {
  registerUser: RegisterUser;
  loginUser: LoginUser;
};

/**
 * Controller tipis: validasi bentuk request, panggil use case, bentuk response.
 * Error (400 password lemah, 409 email terdaftar, 401 login gagal) dilempar oleh use case dan diubah
 * menjadi JSON oleh errorHandler, jadi tidak ada try/catch di sini.
 */
export function createAuthController(useCases: AuthUseCases) {
  const register: RequestHandler = async (req, res) => {
    const body = parseRequest(registerBodySchema, req.body);
    const user = await useCases.registerUser.execute(body);
    res.status(201).json({ data: toUserDto(user) });
  };

  const login: RequestHandler = async (req, res) => {
    const body = parseRequest(loginBodySchema, req.body);
    const accessToken = await useCases.loginUser.execute(body);
    res.json({ data: toAccessTokenDto(accessToken) });
  };

  return { register, login };
}

export type AuthController = ReturnType<typeof createAuthController>;

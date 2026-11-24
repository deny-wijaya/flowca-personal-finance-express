import type { RequestHandler } from "express";
import { authOf } from "../../../shared/http/middlewares/require-auth.ts";
import { parseRequest } from "../../../shared/http/validate.ts";
import type { GetCurrentUser } from "../application/get-current-user.ts";
import type { LoginUser } from "../application/login-user.ts";
import type { RegisterUser } from "../application/register-user.ts";
import type { UpdateProfile } from "../application/update-profile.ts";
import { loginBodySchema, registerBodySchema, toAccessTokenDto, toUserDto, updateProfileBodySchema } from "./auth.schemas.ts";

export type AuthUseCases = {
  registerUser: RegisterUser;
  loginUser: LoginUser;
  getCurrentUser: GetCurrentUser;
  updateProfile: UpdateProfile;
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

  /** Route ini dipasangi requireAuth, jadi `req.auth` sudah berisi id user dari token. */
  const me: RequestHandler = async (req, res) => {
    const user = await useCases.getCurrentUser.execute(authOf(req).userId);
    res.json({ data: toUserDto(user) });
  };

  /** PATCH /auth/me: mengganti nama dari onboarding. Dipasangi requireAuth seperti GET /me. */
  const updateMe: RequestHandler = async (req, res) => {
    const body = parseRequest(updateProfileBodySchema, req.body);
    const user = await useCases.updateProfile.execute(authOf(req).userId, body);
    res.json({ data: toUserDto(user) });
  };

  return { register, login, me, updateMe };
}

export type AuthController = ReturnType<typeof createAuthController>;

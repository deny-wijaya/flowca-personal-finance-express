import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Aturan clean architecture: arah dependency hanya boleh ke dalam.
 * presentation -> application -> domain. Infrastructure mengimplementasikan interface di domain.
 * Kalau ada import yang melanggar, `npm run lint` gagal.
 */
const forbid = (patterns, message) => ["error", { patterns: patterns.map((group) => ({ group, message })) }];

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/modules/*/domain/**", "src/shared/domain/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": forbid(
        [["**/application/**", "**/infrastructure/**", "**/presentation/**", "**/di/**", "**/config/**", "express", "zod", "pino*"]],
        "Domain harus murni: tidak boleh import layer luar, framework, atau library validasi.",
      ),
    },
  },
  {
    files: ["src/modules/*/application/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": forbid(
        [["**/infrastructure/**", "**/presentation/**", "**/di/**", "**/config/**", "express"]],
        "Application hanya boleh bergantung pada domain (lewat interface repository).",
      ),
    },
  },
  {
    files: ["src/modules/*/infrastructure/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": forbid(
        [["**/presentation/**", "**/di/**", "express"]],
        "Infrastructure tidak boleh bergantung pada presentation, Express, atau composition root.",
      ),
    },
  },
  {
    files: ["src/modules/*/presentation/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": forbid(
        [["**/infrastructure/**", "**/config/**"]],
        "Controller tidak boleh memanggil repository atau membaca env langsung. Pakai use case yang di-inject dari container.",
      ),
    },
  },
]);

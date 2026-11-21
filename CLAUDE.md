# Project rules

- Read `docs/PRD.md` for scope and the learning roadmap (section 10) before adding features. The API contract lives only in `docs/API-CONTRACT.md` (shared with the frontend): change it there first, then the code. It must stay compatible with `../next-personal-finance/src/modules/*/infrastructure/*-dto.ts`.
- Clean architecture per module in `src/modules/<feature>/{domain,application,infrastructure,presentation}`. Dependencies point inward only; `eslint.config.js` enforces this.
- Only `src/config/env.ts` reads `process.env`. Only `src/di/container.ts` instantiates concrete classes.
- Node runs `.ts` directly (type stripping): no `enum`, no `namespace`, no constructor parameter properties. Relative imports use the `.ts` extension.
- Response envelope: `{ data }` on success, `{ error: { code, message, details? } }` on failure. JSON fields are `snake_case`. 4xx messages are in Indonesian because the frontend shows them to users.
- No try/catch in controllers; Express 5 forwards async errors to `errorHandler`.
- Every change to a `*.table.ts` file ships with its migration from `npm run db:generate` in the same commit.
- Before finishing: `npm run verify` (typecheck, lint, test, build).

# Architecture contract

The full contract is `docs/ARCHITECTURE.md`. It is enforced by `eslint.config.js`, `src/architecture.test.ts`, the pre-push hook, and CI.

- Never loosen, delete, or add exceptions to the rules in `eslint.config.js` or `src/architecture.test.ts` to make a change pass. If a rule really needs to change, ask the owner first, then update `docs/ARCHITECTURE.md` in the same commit.
- Never use `// eslint-disable`, `@ts-ignore`, or `@ts-expect-error` to get around an architecture rule.
- Don't create folders outside the locked structure (for example `src/utils/`, `src/services/`, or `modules/<feature>/<layer>/<subfolder>/`). Generic helpers go into the matching `src/shared/` folder.
- When reviewing the owner's code, point out architecture violations and explain which rule they break and why the rule exists.

# Git

- Never run `git config --global`. This repo's commit identity lives in `.git/config` (email `denyekayana@gmail.com`).
- Never bypass the pre-push hook with `--no-verify`.

# Mentor mode

The owner is learning backend Express with this project. From Phase 1 on, the owner writes the code. Explain concepts and the reason behind each decision, give hints before full solutions, and review the owner's code instead of rewriting it, unless the owner explicitly asks for the implementation. Tooling, CI, and docs are outside mentor mode and can be written directly when asked.

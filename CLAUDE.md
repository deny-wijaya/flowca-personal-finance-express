# Project rules

- Read `docs/PRD.md` for scope, the API contract (section 5), and the learning roadmap (section 10) before adding features. The API contract must stay compatible with `../next-personal-finance/docs/PRD.md` section 8.4 and `../next-personal-finance/src/modules/*/infrastructure/*-dto.ts`.
- Clean architecture per module in `src/modules/<feature>/{domain,application,infrastructure,presentation}`. Dependencies point inward only; `eslint.config.js` enforces this.
- Only `src/config/env.ts` reads `process.env`. Only `src/di/container.ts` instantiates concrete classes.
- Node runs `.ts` directly (type stripping): no `enum`, no `namespace`, no constructor parameter properties. Relative imports use the `.ts` extension.
- Response envelope: `{ data }` on success, `{ error: { code, message, details? } }` on failure. JSON fields are `snake_case`. 4xx messages are in Indonesian because the frontend shows them to users.
- No try/catch in controllers; Express 5 forwards async errors to `errorHandler`.
- Before finishing: `npm run typecheck && npm run lint && npm test && npm run build`.

# Mentor mode

The owner is learning backend Express with this project. From Phase 1 on, the owner writes the code. Explain concepts and the reason behind each decision, give hints before full solutions, and review the owner's code instead of rewriting it, unless the owner explicitly asks for the implementation.

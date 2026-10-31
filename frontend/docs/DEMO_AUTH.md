# Authentication Architecture

TEST_EMS uses production-grade server-side authentication implemented in Phase 2b (Step 3 & Step 6a).

## Architecture

- **Backend Session Management:** Server-side sessions in MySQL (`user_sessions`), with session token hashed (SHA-256) at rest.
- **Password Security:** Hashed with bcrypt (salt rounds = 12).
- **Cookie Security:** `ems_session` cookie issued with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production.
- **CSRF Protection:** State-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) require the `X-CSRF-Token` header, cryptographically derived from the session secret and token. The CSRF token is held strictly in browser memory (JS variable / React state) and never stored in `localStorage` or `sessionStorage`.
- **First Login Policy:** Admin account bootstrapped with `must_change_password = true`, requiring immediate forced password change before accessing telemetry.
- **Route Protection:** Frontend routes are gated behind `RequireAuth` connecting to `GET /api/auth/me`. Both REAL and DEMO telemetry modes require authentication.

# DEMO authentication (client-side only)

This project includes a **demo sign-in** for local UI walkthroughs. It is **not**
production authentication.

## What it does

- Gates React Router navigation behind an in-memory session.
- Supports a demo Change Password flow that updates memory for the current SPA
  lifetime only.
- Redirects unauthenticated users to `/login`.

## What it does not do

- Does not authenticate against the backend or database.
- Does not issue tokens or JWTs.
- Does not store passwords or tokens in `localStorage` / `sessionStorage`.
- Does not protect API data. Anyone can still call the backend directly.
- A full page reload resets the session and restores the configured env password.

## Configuration

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Set `VITE_DEMO_USERNAME` and `VITE_DEMO_PASSWORD`.
3. Restart Vite (`npm run dev`).

If either variable is missing, the login page shows a setup message and will
not silently fall back to another password.

### Vite env exposure

Values prefixed with `VITE_` are compiled into the browser bundle. Treat them as
**public demo configuration**, never as secrets.

## Future production requirements

When real auth is added, implement at least:

- Server-side authentication
- Argon2id or bcrypt password hashing
- Server-side sessions
- Secure HttpOnly cookies
- CSRF protection where applicable
- Login rate limiting
- Password-change API
- Authorization checks on backend endpoints

Protected React routes alone must never be treated as securing backend data.

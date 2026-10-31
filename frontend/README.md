# TEST_EMS Frontend

React application for the TEST_EMS industrial energy dashboard.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
npm test
npm run typecheck
```

## Authentication

Server-side session authentication with HttpOnly cookies, CSRF tokens, and rate limiting.

1. Start backend server at `http://127.0.0.1:3001`.
2. Start frontend dev server (`npm run dev`).
3. Open `http://localhost:5173/login`.
4. Sign in with backend admin credentials. Initial admin login requires a forced password change before accessing telemetry.

## Source map

- `src/api` — typed API client with CSRF protection and null safety
- `src/pages` — route screens (`OverviewPage`, `LoadDetailPage`, `LoginPage`, etc.)
- `src/components/layout` — shell, sidebar, and header with measurement time and DataSource toggle
- `src/components/auth` — authentication gate and forced change-password dialog
- `src/components/ui` — design system
- `src/context` — `AuthContext` (real sessions), `DataSourceContext` (REAL vs DEMO), `AlarmStore`
- `src/mock` — canonical DEMO data series (strictly isolated from REAL mode)
- `src/types` — shared TypeScript types

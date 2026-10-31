# TEST_EMS Frontend

Phase 0 React application for the TEST_EMS industrial energy dashboard.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
npm test
npm run typecheck
```

## Demo sign-in

Client-side navigation gate only — **not** production auth.

1. Copy `.env.example` to `.env.local` and set `VITE_DEMO_USERNAME` / `VITE_DEMO_PASSWORD`.
2. Restart Vite.
3. Open `/login`.

`VITE_*` values are embedded in the browser bundle and are **not secrets**.
See [docs/DEMO_AUTH.md](docs/DEMO_AUTH.md).

## Source map

- `src/pages` — route screens (includes `LoginPage`)
- `src/components/layout` — shell
- `src/components/auth` — demo login gate / change-password UI
- `src/components/ui` — design system
- `src/context` — AlarmStore + DemoAuthStore (in-memory)
- `src/mock` — **DEMO DATA only**
- `src/types` — shared TypeScript types

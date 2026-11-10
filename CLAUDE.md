# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

This is a monorepo with three independently deployed apps, each with its own `package.json`, `node_modules`, and `.env`:

- `api/` — Express + TypeScript backend, Prisma/PostgreSQL, JWT + session auth, Stripe payments.
- `client/` — Public-facing React 19 + Vite app (marketing, onboarding, dashboard, tracking features).
- `admin/` — Separate React 18 + Vite admin panel for content/user/subscription management.

There is no shared npm workspace — each app is installed and run independently. Root `package.json` only has convenience scripts that shell into the subfolders.

## Commands

Run from the repo root unless noted otherwise.

```bash
npm run install-all     # install root + api + client (does not install admin)
npm run dev              # concurrently runs api (npm run server) + client (npm run client)
npm run build             # builds client only (cd client && npm run build)
npm run start              # starts api production server
```

### `api/`
```bash
npm run dev            # tsx watch src/server.ts
npm run build           # tsc -> dist/
npm run typecheck        # tsc --noEmit
npm run lint / lint:fix
npm test                # jest
npm test -- <pattern>    # run a single test file/suite
npm run test:watch
npm run migrate          # prisma migrate dev
npm run generate          # prisma generate (run after schema.prisma changes)
npm run studio            # prisma studio
npm run seed / seed:mock / seed:full
```

### `client/`
```bash
npm run dev
npm run build            # tsc -b && vite build (type-checks first)
npm run build:netlify     # vite build only, skips tsc
npm run type-check
npm run lint / lint:fix
npm run test              # vitest
npm run test:watch
npm run format / format:check   # prettier
```

### `admin/`
```bash
npm run dev
npm run build             # vite build only (no type-check)
npm run build:check        # tsc -b && vite build
npm run lint
```

Both `client` and `admin` run Vitest (`npm test`); component tests opt into jsdom with a `// @vitest-environment jsdom` first line. `client`/`admin` builds differ in whether they type-check — use `type-check`/`build:check` explicitly when you need to verify types without a full asset build.

## Architecture

### API (`api/`)

- `src/server.ts` connects the DB then starts listening; `src/app.ts` is the single place where all middleware and ~40 route modules are wired up — check it first when adding a new resource or debugging why a route isn't reachable.
- Auth is dual-mode: JWT access/refresh tokens (`middleware/authenticate.ts`, `routes/authRoute.ts`) for the SPAs, plus `express-session` + Passport (Google OAuth) backed by `PrismaSessionStore` for session-based/OAuth flows. Both run in the same app.
- Route → controller → service → Prisma layering; `src/validators/` holds `express-validator`/zod schemas applied via `middleware/validateRequest.ts`. `src/routes/` is organized one file per resource (diet plans, exercise plans, sleep, water, meditation, fasting, medications, challenges, referrals, coupons, blogs, etc.) — mirrors `prisma/schema.prisma` models closely.
- `prisma/schema.prisma` is the source of truth for the data model (~45 models). Run `npm run generate` after pulling schema changes, and `npm run migrate` to apply new migrations locally.
- Stripe webhook route (`/api/payments/webhook`) is mounted before `express.json()` with `express.raw()` because Stripe needs the raw body for signature verification — don't move it below the JSON body parser.
- Uploaded files are served statically from `/uploads`; upload handling lives in `middleware/upload.ts`.

### Client (`client/`) and Admin (`admin/`)

- Both are Vite + React + TypeScript + Tailwind + Zustand, with near-identical `src/` layout: `components/`, `pages/`, `services/`, `store/`, `lib/`, `config/`, `hooks/`, `types/`. `admin` is on React 18/Vite `^6`/Tailwind `^3`; `client` is on React 19. Treat them as siblings, not a shared package — a fix in one does not automatically apply to the other.
- `lib/axios.ts` in each app is the single Axios instance all requests go through. It holds the access token in memory only (`setAccessToken`/`getAccessToken`) and attaches it as a bearer token; on a 401 (except for a `PUBLIC_ROUTES` allowlist and the refresh endpoint itself) transparently calls `/auth/refresh-token`, retries the original request once, and hard-redirects to `/login` if refresh fails. New API calls should go through this instance rather than raw `axios` or `fetch`.
- `services/crudService.ts` provides a generic `CrudService<T>` class (getAll/getById/create/update/delete + customGet/customPost) — prefer extending/instantiating this for new resource services instead of hand-writing CRUD calls.
- API base URL resolution (`config/index.ts`): `VITE_API_URL` env var, falling back to same-origin `/api` in production builds and `http://localhost:3000/api` in dev. Both frontends assume the API is mounted under `/api`.
- Client routing (`client/src/App.tsx`) uses `react-router-dom` with route-level lazy loading (`lazy()` + `Suspense`) for every page except a few loaded eagerly for the auth flow. Route protection is handled by `components/routes/ProtectedRoutes.tsx` + `contexts/AuthContext`, not by per-page checks.
- Auth state: `client` uses `contexts/AuthContext`; `admin` uses `store/useAuthStore.ts` + `store/useUserStore.ts`. The access token is never persisted: after a reload it is re-obtained from the httpOnly refresh-token cookie (hence `withCredentials: true` on the axios instance).

## Deployment

Production uses PM2 via `ecosystem.config.cjs` to run three processes (`lifeline-api` from `api/dist/server.js`, `lifeline-client` from `client/dist`, `lifeline-admin` from `admin/dist`) behind NGINX/CloudPanel. A Docker setup also exists (`docker-compose.yml`, `DOCKER_README.md`). Vite bakes `VITE_*` env vars into the build at build time, so changing them requires a rebuild, not just a restart.

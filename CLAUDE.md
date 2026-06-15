# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install dependencies

# Start local dev (requires Docker)
docker-compose up -d  # start Postgres + Neon WS proxy
pnpm run dev          # start SvelteKit dev server

pnpm run build        # production build
pnpm run preview      # preview production build

pnpm run lint         # prettier check + eslint
pnpm run format       # prettier write
pnpm run check        # svelte-check (type checking)

pnpm run test         # run all tests (unit + e2e)
pnpm run test:unit    # vitest (watch mode)
pnpm run test:e2e     # playwright

pnpm run clear-tables # drop and recreate all postgres tables

# Regenerate TypeScript types from lexicon schemas
./node_modules/.bin/lex gen-server ./src/lib/lexicon ./lexicons/*
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon/Postgres connection string. Locally: `postgresql://postgres:postgres@localhost:5432/postgres` |
| `PUBLIC_OAUTH_REDIRECT_URL` | Public URL for ATProto OAuth callback (omit for local dev) |
| `PORT` | Dev server port (used when `PUBLIC_OAUTH_REDIRECT_URL` is not set) |

## Development workflow (test-first)

For any new feature or **major flow change** (routing/auth changes, sync behavior, the create→invite→accept flow), write or update the **e2e tests first**:

1. Update/add the Playwright e2e tests in `e2e/` to describe the new expected behavior **before** touching app code.
2. Run `pnpm run test:e2e` and confirm the test fails **for the expected reason** (asserting the new behavior that doesn't exist yet) — not because of a typo, selector, or setup error. Read the failure to verify it's the right one.
3. Only then implement the feature, and re-run until the previously-failing test passes.

This matters here because flow changes have non-obvious ripple effects — e.g. the OAuth callback runs `syncLocals()` on login, so a test that expects a "stale cache" state must delete records *after* login, not before. The failing-test step surfaces these before they become wasted implementation effort.

## Architecture

### Dual-layer data model (PDS + local Postgres cache)

The app's most important architectural concept: **ATProto PDSes are the source of truth; Postgres is only a local cache for query performance.**

- Guild records (`dev.jakestout.atguilds.guild`) are stored on the **guild leader's PDS**
- GuildMemberClaim records (`dev.jakestout.atguilds.guildMemberClaim`) are stored on **each member's own PDS**
- The local Postgres DB (`guild`, `guild_member`, `guild_invite` tables) caches these records so the app can query them without hitting remote PDSes on every request
- `guildService.syncLocals()` (called via `GET /sync`, and on every OAuth login in `oauth/callback`) fetches records from all relevant PDSes and reconciles them into the local cache. Reconciliation is **two-way**: it inserts missing guilds/members AND deletes stale rows — guilds the user no longer leads on their PDS, and `guild_member` rows whose `guildMemberClaim` was removed from the member's PDS (see bi-directional validity below).

### Bi-directional membership validity

A user is a valid guild member only if **both** are true:
1. The guild record's `members` array on the leader's PDS contains the user's DID
2. The user's PDS has a `guildMemberClaim` record pointing to that guild's AT-URI

This prevents unilateral membership: inviting someone adds them to the guild record, but they must accept (which creates their own claim) for the membership to be valid. `syncLocals()` enforces this on sync — if a member deletes their claim, the next sync prunes their cached `guild_member` row. To limit the blast radius of transient PDS-fetch failures, pruning is scoped to guilds whose leader record was successfully fetched during that sync.

### Request lifecycle (`hooks.server.ts`)

On every request, `hooks.server.ts` initializes and injects into `event.locals`:
- `db` — Kysely database instance (also runs Kysely migrations on startup)
- `oauthClient` — `NodeOAuthClient` from `@atproto/oauth-client-node`
- `session` — `{ did: string }` from the `sid` cookie, or `undefined`
- `resolver` — bidirectional DID↔handle resolver (`src/lib/server/id-resolver.ts`)

### Server-side modules (`src/lib/server/`)

| File | Purpose |
|---|---|
| `db.ts` | Kysely schema types, all DB migrations (numbered `001`–`004`), `createDb`, `migrateToLatest` |
| `guildService.ts` | All guild business logic: create, invite, accept, remove member, delete, sync |
| `agent.ts` | `getAgent()` — restores ATProto OAuth session into an `Agent` instance |
| `oauthClient.server.ts` | Constructs `NodeOAuthClient`; handles localhost vs. production client ID |
| `storage.ts` | `SessionStore` and `StateStore` implementations backed by Postgres |
| `id-resolver.ts` | DID resolution and PDS endpoint lookup |
| `atproto/clients.ts` | Factories for **unauthenticated** ATProto clients: `createPublicAppviewClient()` (public Bluesky AppView) and `createPdsClient(endpoint)`. Keeps client setup out of `guildService`/routes |
| `atproto/profiles.ts` | `resolveDisplayNames(dids, { agent })` — batched display-name lookup; uses the authed agent when present, else the public AppView so logged-out viewers still get names |

### Local Postgres setup (dev)

The app uses Neon's serverless driver (`@neondatabase/serverless`) which communicates over WebSockets. Locally this requires two Docker services:
- `postgres` on port 5432 — the actual database
- `pg_proxy` on port 5433 — Neon's WebSocket proxy (used when `VERCEL_ENV` is not set)

### Lexicons

Custom ATProto lexicons live in `lexicons/`. TypeScript types are generated into `src/lib/lexicon/` via `@atproto/lex-cli`. The generated types include `validateRecord` and `isRecord` helpers used throughout `guildService.ts` to validate PDS data before using it.

### Routing & access model

Most pages are **public** (viewable logged-out); only the personal dashboard and write actions require a session.

| Route | Auth | Purpose |
|---|---|---|
| `/` | public | Browse — paginated list of all guilds (`BROWSE_PAGE_SIZE`, 10/page; `?page=N`) |
| `/guild/at/[atIdentity]/dev.jakestout.atguilds.guild/[rkey]` | public | Guild detail (read-only when logged-out; leader controls + pending invites are leader-only). Route reflects the AT-URI structure |
| `/my-guilds` | session (redirects to `/login`) | Personal dashboard: guilds led/joined, invites, create form, "Sync with PDS" button |
| `/login` | public | OAuth login form; OAuth callback lands on `/my-guilds` |

The navbar (`Header.svelte`, fed by `+layout.server.ts`) shows **Browse** always and **My Guilds** + logout when logged in.

### Gotcha: empty `in`/`not in` arrays

Kysely compiles `.where(col, 'in', [])` to `in ()`, which Postgres rejects (`syntax error near ")"`). Guard array-based `in`/`not in` clauses against empty input (early-return `[]`, or conditionally append the clause) — `syncLocals` and the `getExisting*` helpers do this.

## ATProto API reference

There is no official `llms.txt` for ATProto, and external docs (atproto.com) lag behind the actual SDK. **Ground ATProto questions in the installed packages under `node_modules/@atproto/`, pinned to the versions this repo uses** — they are the source of truth for the API surface here. Each package ships a `README.md`, `CHANGELOG.md`, source in `src/`, and `.d.ts` types in `dist/`.

Packages in use (see `package.json` for exact versions):

| Package | Used for |
|---|---|
| `@atproto/api` | `Agent`, XRPC calls, record CRUD. Also ships `README.md` + `OAUTH.md` |
| `@atproto/oauth-client-node` | `NodeOAuthClient` (see `oauthClient.server.ts`, package `README.md`) |
| `@atproto/identity` | DID↔handle resolution, PDS lookup (`id-resolver.ts`) |
| `@atproto/lexicon` | Runtime lexicon validation |
| `@atproto/lex-cli` | `lex gen-server` type codegen (see Commands) |
| `@atproto/xrpc` / `xrpc-server` | XRPC client/server primitives |

When unsure how an ATProto call behaves, read that package's `.d.ts`/`src` and `CHANGELOG.md` before reaching for the web. For protocol concepts not tied to a specific call (identity, repos, federation), atproto.com/specs is fine.

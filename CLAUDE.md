# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Full-stack English-learning app: a React/Vite frontend (`frontend/`) and an Express/TypeScript API (`backend/`). Each package has its own `package.json` and `node_modules`. The root `package.json` only orchestrates them, using `concurrently`.

## Project memory (`docs/`)

`docs/` records what has been changed in this repo and what is still open. Read it before starting work and keep it current. **After every change**, update `docs/changelog.md` and the item's status in `docs/backlog.md`, and refresh the "Hazırkı vəziyyət" section of `docs/README.md`. Backlog IDs are stable; the user refers to items by number. These docs are written in Azerbaijani.

@docs/README.md

## Commands

```bash
npm run install:all          # install root, frontend, and backend deps
./start.sh                   # start mongod on :27018 (data in ~/mongodb_data), then npm run dev
./stop.sh                    # stop that mongod
npm run dev                  # backend (:7001) + frontend (:5173) together
npm run dev:backend          # ts-node-dev --respawn --transpile-only src/server.ts
npm run dev:frontend         # vite

cd backend && npm test             # Vitest, all backend tests (~3s)
cd backend && npx vitest run tests/dictionaryService.test.ts   # one file
cd backend && npx vitest run -t "pagination"                  # tests whose name matches
cd backend && npm run type-check   # tsc on src + tests (dev server and Vitest skip type checking)
cd backend && npm run build        # tsc -> backend/dist
cd frontend && npm run build       # tsc && vite build
```

- Backend tests live in `backend/tests/`; the frontend has no tests. Run `npm test` and `npm run type-check` after backend changes. The health endpoint (`/api/health`) reports whether storage is `mongodb` or `in-memory`.
- Linting is currently broken. Root `biome.json` uses the Biome 1.x config format (`organizeImports`), but Biome 2.4 is installed, so `npx biome check` exits with a configuration error. `frontend`'s `npm run lint` calls ESLint, but no ESLint config file exists.
- `README.md` (Azerbaijani) was rewritten from the code on 2026-10-02. Keep it in sync when features, env vars, ports, or endpoints change.

## Configuration

`backend/.env` is loaded by `import 'dotenv/config'`, which must stay the first import in `server.ts` because `logger.ts` and `upload.ts` read env at import time. It supports `MONGODB_URI`, `PORT` (default 7001), `FRONTEND_URL` (extra CORS origin), `LOG_LEVEL`, `NODE_ENV`, and `UPLOAD_DIR` (default `backend/uploads`). `NODE_ENV=production` switches pino from pretty output to raw JSON and hides error messages in 500 responses. If you use `start.sh`, `MONGODB_URI` must point at port 27018. The frontend reads `VITE_API_ORIGIN` (default `http://localhost:7001`).

## Architecture

### Backend layering (`backend/src`)
`routes/` → `services/` → `models/`. Routes are thin:
- Request bodies are validated with `validate(zodSchema)` from `middleware/validate.ts`, using schemas in `schemas/index.ts`. The middleware replaces `req.body` with the parsed, trimmed data. On failure it returns 400 with `details[]`.
- Services throw domain errors (`DuplicateWordError`, `WordNotFoundError`), and routes map them to 409/404.
- Every response has the shape `{ success, ... , error? }`. These shapes are typed in `types/index.ts`.

`app.ts` exports `createApp()`, which builds the Express app without listening: helmet, CORS, rate limits (200 requests per 15 minutes on `/api`, plus a stricter 30 per 15 minutes on `/api/ai`), static `/uploads` (served from `uploadPath`), routes, the health check, and the error/404 handlers. `server.ts` loads env, calls `connectDB()`, listens, and handles graceful shutdown.

### Dual storage: MongoDB or in-memory
If `MONGODB_URI` is missing or the connection fails, the server keeps running. Every `dictionaryService` method branches on `mongoose.connection.readyState === 1`, using either the `Word` model or a module-level `memoryDictionary` array. **Any change to dictionary behavior must be made in both branches.**

Word IDs are UUID strings (`_id: String`, with toJSON mapping `_id` to `id`), not ObjectIds. The in-memory branch uses incrementing numeric-string IDs.

### Spaced repetition
Fields: `status` (`learning`/`known`), `nextReviewDate`, `reviewIntervalDays`. When a word is marked known, its interval starts at 7 days and is multiplied by 4 on each later "known" answer, capped at 30. Marking a word unknown resets it to `learning`. `GET /api/dictionary/words/learnings` returns learning words plus known words whose review date has passed. A compound index on `{status, nextReviewDate}` backs that query.

### AI integration (bring-your-own-key)
There are no server-side AI keys. The user's provider, key, and model are stored in browser storage (the token in `sessionStorage`, the rest in `localStorage`, via `frontend/src/context/AppContext.tsx`). They are sent in each request body, as `apiToken` for generate-text and `aiToken` for the other endpoints. The pino logger redacts these fields, so keep any new secret fields in `REDACT_PATHS` (`utils/logger.ts`).

- `services/aiService.ts` handles the provider plumbing: a `switch` over `openai | grok | gemini | deepseek | mistral`, key normalization and validation, and alias maps that redirect outdated model names to defaults. Grok, DeepSeek, and Mistral use the OpenAI SDK with a custom `baseURL`. Gemini uses `@google/generative-ai`.
- `services/aiContentService.ts` handles prompts and features: reading-text generation (word-count and token targets per level in `LEVEL_GENERATION_CONFIG`), translation, IPA pronunciation, and example sentences. Translation prompts are enriched by a two-layer "RAG": (1) translations the user already saved for that word in MongoDB, then (2) definitions from `api.dictionaryapi.dev`.
- **Adding a provider or model touches several places that must stay in sync:** `AI_PROVIDERS` in `backend/src/schemas/index.ts`, `AIServiceConfig` and the switch in `aiService.ts`, `AIProvider` in `backend/src/types` and `frontend/src/types`, and `DEFAULT_MODELS` in `frontend/src/services/api.ts`. The proficiency levels are duplicated the same way.

### Image uploads
`POST /api/dictionary/upload-image` goes through the `uploadImage` middleware (`middleware/upload.ts`), which saves the file to `uploadPath` and returns `/uploads/<file>`. The middleware:
- allows only JPEG/PNG/WebP/GIF (no SVG);
- takes the file extension from the MIME type, never from the original filename;
- checks the file's magic bytes after writing and deletes files that don't match;
- maps multer errors to 400/413 instead of letting them reach the global 500 handler.

`addWordSchema` accepts only `imageUrl` values of the form `/uploads/<file>`. Deleting a word also deletes its local image. On the frontend, `resolveAssetUrl` prefixes relative paths with `API_ORIGIN`.

### Frontend (`frontend/src`)
React 18, react-router (`/`, `/dictionary`, `/learnings`), and Tailwind. Global state is one `useReducer` context (`AppContext`) whose reducer also writes to browser storage. All HTTP calls go through `services/api.ts`: an axios instance with a 30s timeout and an interceptor that turns every error into an `ApiError` with a user-facing message. In `catch` blocks, show `getErrorMessage(error, fallback)` (also in `services/api.ts`) instead of a hard-coded message, so the server's reason (invalid key, duplicate word, server down) reaches the user. Never put error text into a state that can be saved as data (see `translationError` in `WordDefinitionModal`). Frontend and backend types are separate copies, not a shared package.

### Tests (`backend/tests`)
- **Tools:** Vitest 3 + supertest. Vitest 5 needs `@types/node` 22+, which the project does not use yet.
- **Setup:** `tests/setup.ts` silences logs, unsets `MONGODB_URI`, and points `UPLOAD_DIR` at a temporary directory. Tests never touch the real database or `backend/uploads`.
- **MongoDB:** `tests/helpers/mongo.ts` starts mongodb-memory-server (Node 20.19+), using the system `mongod` when one is installed. `dictionaryService.test.ts` runs the same suite against both storage modes with `describe.each`; keep that when changing dictionary behavior.
- **Isolation:** AI SDKs (`openai`, `@google/generative-ai`), `AIService`, `aiContentService`, and `fetch` are mocked with `vi.mock`/`vi.stubGlobal`, so tests make no network calls. Use `createApp()` per test when rate-limit counters must start fresh.
- **Known bugs:** they are pinned with `it.fails(...)`, and the test name includes the backlog ID (e.g. `(#4)`). When you fix one, the test starts failing as "unexpectedly passed"; remove `.fails` then.

## Conventions

- **Backend tests are mandatory (user requirement).** Every backend function, route, or middleware you add or change gets tests in `backend/tests/` in the same change. This applies to private helpers too, tested through the exported function that uses them. The tests cover:
  - the success path, error paths, and edge cases;
  - for `dictionaryService`, both storage modes;
  - for routes, supertest checks of 2xx, validation 400, domain 404/409, and 500.

  For a bug fix, write the failing test first; if an `it.fails` test exists for it, remove `.fails`. Do not report backend work as done until `npm test` and `npm run type-check` pass, and list the added tests in the changelog entry.
- Code comments are often written in Azerbaijani. Match the language of the comments around your edit.
- Backend logging uses `logger` (pino) with a context object first: `logger.info({ word, provider }, 'msg')`. Do not use `console.*`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `perf:`, ...). Keep code, tests, and docs in separate commits, with one exception: a bug fix ships in the same commit as its tests (including an `it.fails` → `it` change), so that every commit passes `npm test`.

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

cd backend && npm run type-check   # tsc --noEmit (dev server skips type checking)
cd backend && npm run build        # tsc -> backend/dist
cd frontend && npm run build       # tsc && vite build
```

- There is no test framework and there are no tests. To verify a change, type-check both packages and exercise the API directly, for example `curl localhost:7001/api/health`. The health response reports whether storage is `mongodb` or `in-memory`.
- Linting is currently broken. Root `biome.json` uses the Biome 1.x config format (`organizeImports`), but Biome 2.4 is installed, so `npx biome check` exits with a configuration error. `frontend`'s `npm run lint` calls ESLint, but no ESLint config file exists.
- `README.md` (Azerbaijani) was rewritten from the code on 2026-10-02. Keep it in sync when features, env vars, ports, or endpoints change.

## Configuration

`backend/.env` is loaded by dotenv. It supports `MONGODB_URI`, `PORT` (default 7001), `FRONTEND_URL` (extra CORS origin), `LOG_LEVEL`, and `NODE_ENV`. `NODE_ENV=production` switches pino from pretty output to raw JSON and hides error messages in 500 responses. If you use `start.sh`, `MONGODB_URI` must point at port 27018. The frontend reads `VITE_API_ORIGIN` (default `http://localhost:7001`).

## Architecture

### Backend layering (`backend/src`)
`routes/` → `services/` → `models/`. Routes are thin:
- Request bodies are validated with `validate(zodSchema)` from `middleware/validate.ts`, using schemas in `schemas/index.ts`. The middleware replaces `req.body` with the parsed, trimmed data. On failure it returns 400 with `details[]`.
- Services throw domain errors (`DuplicateWordError`, `WordNotFoundError`), and routes map them to 409/404.
- Every response has the shape `{ success, ... , error? }`. These shapes are typed in `types/index.ts`.

`server.ts` sets up helmet, CORS, rate limits (200 requests per 15 minutes on `/api`, plus a stricter 30 per 15 minutes on `/api/ai`), static `/uploads`, the health check, and graceful shutdown.

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
`POST /api/dictionary/upload-image` (multer, images only, 5MB limit) saves files to `backend/uploads/` and returns `/uploads/<file>`. Deleting a word also deletes its local image. On the frontend, `resolveAssetUrl` prefixes relative paths with `API_ORIGIN`.

### Frontend (`frontend/src`)
React 18, react-router (`/`, `/dictionary`, `/learnings`), and Tailwind. Global state is one `useReducer` context (`AppContext`) whose reducer also writes to browser storage. All HTTP calls go through `services/api.ts`: an axios instance with a 30s timeout and an interceptor that turns every error into an `ApiError` with a user-facing message. Frontend and backend types are separate copies, not a shared package.

## Conventions

- Code comments are often written in Azerbaijani. Match the language of the comments around your edit.
- Backend logging uses `logger` (pino) with a context object first: `logger.info({ word, provider }, 'msg')`. Do not use `console.*`.
- Commits follow Conventional Commits (`feat:`, `perf:`, ...).

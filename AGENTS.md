CLAUDE.md

## Cursor Cloud specific instructions

Standard install/build/test/run commands live in `CLAUDE.md` and root `package.json` scripts — use those. The notes below only cover non-obvious, environment-specific gotchas for running the stack in the Cloud VM.

### Services and how to start them

- MongoDB (required): installed via apt (persisted in the VM snapshot) but not auto-started. Start it before the backend: `mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017` (run it in a background tmux session). Verify with `mongosh --quiet --eval 'db.runCommand({ping:1})'`.
- Backend: `npm run backend:dev` (nodemon, port 3080).
- Frontend: `npm run frontend:dev` (Vite HMR, port 3090; proxies `/api` to 3080). Open the app at `http://localhost:3090`.
- Meilisearch, Redis, and the RAG API are optional and not installed. Keep `SEARCH=false` in `.env`; the `[mongoMeili] ... fetch failed` warnings at startup are harmless when Meilisearch is not running.

### Non-obvious gotchas

- The backend serves the built client and will crash on startup with `ENOENT ... client/dist/index.html` if the client has not been built. After a fresh install (or when `client/dist` is missing), run `npm run build:client` (or `npm run frontend`) once before `npm run backend:dev`. `npm install` alone is not enough. `frontend:dev` (Vite) is only for HMR and does not create `client/dist`.
- The shared packages must be built before running the backend: `npm run build:packages` (builds `data-provider`, `data-schemas`, `packages/api`, `packages/client`). The update script does not build; do this manually after dependency changes.
- `.env` and `librechat.yaml` are gitignored. Copy `.env.example` -> `.env` (the default `CREDS_KEY`/`JWT_SECRET` values work for local dev). Registration is enabled by default, so you can create a user at `/register`.
- No AI provider key is required just to validate the environment: define an OpenAI-compatible endpoint under `endpoints.custom` in `librechat.yaml` (a local mock server works). For real model responses, add a provider key (e.g. `OPENAI_API_KEY`) to `.env`.

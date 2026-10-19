# MindMesh server

Independent Node.js + Express starter backend for MindMesh. It lives separately from the existing `mindmesh` application.

## Run

```bash
cd server
npm install
copy .env.example .env
npm start
```

The API and browser client are served from `http://localhost:3000` by default. Use `npm run check` for the syntax check used by this starter.

## Supabase/PostgreSQL foundation (optional)

The reproducible migrations at `../supabase/migrations/001_initial_schema.sql` and `../supabase/migrations/002_avatar_personalization.sql` create the managed data foundation for profiles, user preferences, avatar preferences, personalized avatar names/voice settings, conversations, messages, thoughts, missions, mission completions, achievements, user achievements, and activity history. They include foreign keys, ownership indexes, timestamp triggers, and Row Level Security (RLS) policies.

### Exact setup

1. Create a Supabase project and leave Supabase Auth enabled. The migration expects the built-in `auth.users` table.
2. In the Supabase Dashboard, open **SQL Editor** and run both migrations in order: `supabase/migrations/001_initial_schema.sql`, then `supabase/migrations/002_avatar_personalization.sql`. The migrations can also be applied with `supabase db push` after linking a local Supabase CLI project.
3. In **Project Settings > API**, copy the project URL, the public **anon/publishable** key, and the **service_role** key into a local `server/.env`:

   ```dotenv
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your-public-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   ```

   The app delivers only `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the browser through `/api/config`. `SUPABASE_SERVICE_ROLE_KEY` is used only by the server. The server loads a local `.env` file when present; a process manager's environment variables still take precedence. For a PowerShell process without a `.env`, export the values before starting Node:

   ```powershell
   $env:SUPABASE_URL = 'https://your-project-ref.supabase.co'
   $env:SUPABASE_ANON_KEY = 'your-public-anon-key'
   $env:SUPABASE_SERVICE_ROLE_KEY = 'your-server-only-service-role-key'
   npm start
   ```

   The service-role key bypasses RLS and must stay on the server. Never add it to `mindmesh`, browser JavaScript, a public environment variable, or source control.
4. Enable email/password sign-in in **Authentication > Providers** and set the production URL and allowed redirect URLs in **Authentication > URL Configuration**. The app supports email confirmation; users must verify their address first when confirmation is enabled.
5. On Render, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` under the service's **Environment** settings, then redeploy. Restart locally after editing `.env`. Confirm `/api/config` returns `supabaseServerConfigured: true` and `/api/health` reports `"supabaseConfigured": true`. These flags only confirm configuration presence, not remote connectivity.
6. Call the authenticated endpoints with a real Supabase access token in an `Authorization: Bearer ...` header:

   ```bash
   curl.exe http://localhost:3000/api/auth/me ^
     -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"

   curl.exe http://localhost:3000/api/profile ^
     -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"

   curl.exe -X PUT http://localhost:3000/api/profile ^
     -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" ^
     -H "Content-Type: application/json" ^
     -d "{\"displayName\":\"Alex\",\"bio\":\"Learning in public.\"}"
   ```

   The `^` line continuations are for Windows `cmd.exe`; remove them when entering a single line in another shell.

The server uses Node.js 18+'s built-in `fetch`, so no Supabase SDK dependency is required. `server/supabase.js` is disabled unless both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured. When enabled, it verifies the caller's access token with Supabase Auth before reading or writing that user's profile. The service-role credential is never included in a response.

## API

- `GET /api/config` — returns browser-safe Supabase URL/anon-key settings and whether server-side account storage is configured.
- `GET /api/health` — service status and the active mode.
- `GET /api/avatars` — the six built-in avatar profiles.
- `GET /api/avatar-personalizations`, `PUT /api/avatar-personalizations` — reads/saves the six user's custom avatar names and voice settings. Supabase mode requires a bearer token; guest mode uses a bounded local JSON fallback and is labeled `local-demo`.
- `GET /api/missions` — the current mission board.
- `POST /api/missions/:missionId/complete` — completes or reopens a mission for a local demo user.
- `GET /api/auth/me` — verifies a real Supabase Bearer token and returns the authenticated user when Supabase is configured.
- `GET /api/profile` — returns the authenticated user's profile when Supabase is configured.
- `PUT /api/profile` — updates `username`, `displayName`, `bio`, and/or `avatarUrl` for the authenticated user when Supabase is configured.
- `GET /api/preferences`, `PUT /api/preferences` — reads or updates the authenticated user's theme and accessibility-related account preferences when Supabase is configured.
- `GET /api/conversations/:avatarId` — restores the signed-in user's latest private conversation for that avatar.
- `POST /api/conversations/reply` — accepts `{ avatarId, message, activity, history }` and returns a contextual reply plus language feedback notes.
- `POST /api/interviews/coach` — accepts `{ role, companyType, scenario, answer }` and returns feedback, score, strengths, improvements, and a next question.
- `POST /api/thoughts` — accepts `{ userId, text }` for local demo storage, or `{ text }` with an authenticated bearer token when Supabase is configured.
- `GET /api/thoughts/:userId` — returns local demo thoughts, or the authenticated user's Supabase thoughts when managed storage is configured.

Example conversation request:

```json
{
  "avatarId": "mentor",
  "message": "I keep postponing my interview practice.",
  "activity": "interview preparation",
  "history": []
}
```

## Optional AI provider

Without configuration, conversation and interview coaching use deterministic **local demo intelligence** and identify that mode in every response. To use an OpenAI-compatible chat-completions provider, set both `AI_API_KEY` and `AI_BASE_URL` in `.env`; `AI_MODEL` is optional. The API key is used only on the server and is never returned to clients. If a configured provider is unavailable, the server returns the local demo response and says so.

`AI_BASE_URL` may be a full `/chat/completions` endpoint, an API version root such as `https://api.openai.com/v1`, or a provider root. The server adds the standard path when needed.

## Notes

- CORS is dependency-free and defaults to `*` without credentials; set `CORS_ORIGIN` to a comma-separated allowlist for a deployed client.
- JSON request bodies are limited to 100 KB and input fields are validated and length-limited.
- Security headers are set without adding Helmet.
- Thoughts are held in a bounded local JSON store at `server/data/mindmesh-data.json` for the existing demo route. Set `MINDMESH_DATA_FILE` to point to a managed volume in deployment; use the optional Supabase foundation for authenticated managed data.
- The optional provider is not enabled unless both provider variables are present; this starter does not claim external AI or auth is live by default.
- When Supabase is configured, thought reads and writes require a real bearer token and ignore client-supplied ownership claims. Without Supabase, the routes remain clearly marked `local-demo` and use the bounded JSON fallback.
- The authenticated Supabase routes return `503` with `code: "SUPABASE_NOT_CONFIGURED"` when either Supabase variable is missing. With configuration present, a missing or invalid access token returns `401`; the server does not silently fall back to local or fake authentication.
- This repository does not contain Supabase credentials or a real access token. The client sign-in/register flow, session refresh, server verification, account-backed chat persistence, and per-avatar conversation restore are implemented; account use becomes available after setting up the Supabase project and environment values above.

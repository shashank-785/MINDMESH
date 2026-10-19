# MindMesh

MindMesh is a browser app backed by a Node.js/Express API. The Express server
serves both the client in `mindmesh/` and API routes from the same origin.

## Deploy to Render

1. In Render, choose **New > Blueprint** and connect this GitHub repository.
2. Render reads `render.yaml` and creates the `mindmesh` web service.
3. Wait for the first deploy, then open the service URL and check
   `/api/health`.

The Blueprint uses Render's free instance plan to avoid unexpected charges.
Free services can sleep while idle, so the first request after a quiet period
may take longer. The local JSON demo store is ephemeral on Render; use the
optional Supabase integration for managed persistence.

AI coaching and Supabase authentication/storage are optional and disabled
unless configured. Add their server-only values under the service's
**Environment** settings in Render. Never put private keys in `mindmesh/`,
commit them to GitHub, or use a `VITE_*`/browser variable:

- `AI_API_KEY` for general-purpose, context-aware assistant replies. The
  default provider is OpenAI (`gpt-4o-mini`); optionally set `AI_BASE_URL` and
  `AI_MODEL` for another OpenAI-compatible service. Without a key, the app
  uses clearly labeled local demo replies; it is not a general AI model.
  Provider usage may incur charges. When enabled, recent chat messages are
  sent to that provider to maintain conversation context.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

For Supabase setup, see [server/README.md](server/README.md). Use a Supabase
service-role key only as a Render secret.

## Conversations and voice

Each avatar has a separate chat history, saved in the current browser and kept
separate for each guest or signed-in account. The app sends only the selected
avatar's recent conversation context to the server. Spoken input uses the
browser's speech-recognition service: allow microphone access and use a
supported browser such as Chrome or Edge. When recognition ends, the transcript
stays in the message box so it can be reviewed or edited; tap Send to get a
reply. If microphone access is blocked, allow it in the browser's site settings
and reload. Audio recordings are not uploaded or stored by this app.

## Run locally

Requires Node.js 18 or newer.

```powershell
cd server
npm install
npm start
```

Open `http://localhost:3000`. Run `npm run check` and `npm run smoke` from
`server/` to verify the backend.
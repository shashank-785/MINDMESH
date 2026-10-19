# MindMesh client

The client is served by the Express server at `http://localhost:3000/`.

## Optional Supabase sign-in

1. Create a Supabase project, enable email/password authentication, and apply both SQL migrations in `../supabase/migrations/`.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the server environment. The API automatically sends the public URL and anon key to the browser through `/api/config`; do not put the service-role key in `config.js`.
3. Start the backend locally with:

```powershell
$env:SUPABASE_URL = 'https://your-project-ref.supabase.co'
$env:SUPABASE_ANON_KEY = 'your-public-anon-key'
$env:SUPABASE_SERVICE_ROLE_KEY = 'your-server-only-service-role-key'
Set-Location server
npm start
```

Never put the service-role key in this folder or in browser code. Without this
configuration, MindMesh keeps guest data local and clearly labels Supabase as
unconfigured rather than pretending that authentication is live.

Signed-in conversations are stored per avatar in Supabase and restored when
the same account is opened in another browser or device. Guest conversations
remain in browser storage.

## Optional live AI

Configure `AI_API_KEY`, `AI_BASE_URL`, and optionally `AI_MODEL` in the server
process environment. The browser never receives these values.

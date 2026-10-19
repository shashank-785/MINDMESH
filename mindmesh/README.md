# MindMesh client

The client is served by the Express server at `http://localhost:3000/`.

## Optional Supabase sign-in

1. Apply `../supabase/migrations/001_initial_schema.sql` to your Supabase project.
2. Put the public project URL and anon key in `config.js`:

```js
window.MINDMESH_SUPABASE = {
  url: 'https://your-project-ref.supabase.co',
  anonKey: 'your-public-anon-key',
};
```

3. Export the server-only values before starting the backend:

```powershell
$env:SUPABASE_URL = 'https://your-project-ref.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'your-server-only-service-role-key'
```

Never put the service-role key in this folder or in browser code. Without this
configuration, MindMesh keeps guest data local and clearly labels Supabase as
unconfigured rather than pretending that authentication is live.

## Optional live AI

Configure `AI_API_KEY`, `AI_BASE_URL`, and optionally `AI_MODEL` in the server
process environment. The browser never receives these values.

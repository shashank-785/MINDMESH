'use strict';

const { createSupabaseAdapter } = require('./supabase');
const baseUrl = process.env.MINDMESH_BASE_URL || 'http://localhost:3000';

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const clientConfig = await request('/api/config');
  if (typeof clientConfig.supabaseServerConfigured !== 'boolean') throw new Error('public configuration response shape failed');
  if (Object.keys(clientConfig).some((key) => !['supabase', 'supabaseServerConfigured'].includes(key))
      || (clientConfig.supabase && Object.keys(clientConfig.supabase).some((key) => !['url', 'anonKey'].includes(key)))) {
    throw new Error('server-only configuration leaked through /api/config');
  }

  const health = await request('/api/health');
  if (health.status !== 'ok') throw new Error('health check did not return ok');
  const conversationAuth = await fetch(`${baseUrl}/api/conversations/rex`);
  const conversationAuthBody = await conversationAuth.json();
  if (health.supabaseConfigured ? conversationAuth.status !== 401 : conversationAuth.status !== 503) {
    throw new Error('conversation restore endpoint did not enforce authentication/configuration');
  }
  if (health.supabaseConfigured && conversationAuthBody.code !== 'AUTH_REQUIRED') throw new Error('conversation restore did not explain the missing auth token');
  if (!health.supabaseConfigured && conversationAuthBody.code !== 'SUPABASE_NOT_CONFIGURED') throw new Error('conversation restore did not explain missing Supabase configuration');

  const requestedUrls = [];
  const adapter = createSupabaseAdapter({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-server-key' },
    fetchImplementation: async (url) => {
      requestedUrls.push(new URL(url));
      const payload = url.pathname.endsWith('/conversations')
        ? [{ id: 'conversation-uuid', avatar_id: 'rex' }]
        : [{ role: 'user', content: 'Hello again', created_at: '2026-01-01T00:00:00.000Z' }];
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload };
    },
  });
  const storedConversation = await adapter.getLatestConversation('user-uuid', 'rex');
  if (storedConversation?.conversation?.id !== 'conversation-uuid' || storedConversation.messages?.length !== 1) {
    throw new Error('Supabase conversation restore adapter failed');
  }
  if (requestedUrls.length !== 2
      || requestedUrls[0].searchParams.get('user_id') !== 'eq.user-uuid'
      || requestedUrls[1].searchParams.get('conversation_id') !== 'eq.conversation-uuid') {
    throw new Error('conversation restore adapter did not scope conversation ownership');
  }

  const avatars = await request('/api/avatars');
  if (!Array.isArray(avatars.avatars) || avatars.avatars.length !== 6 || avatars.avatars.some((avatar) => !avatar.defaultName || !avatar.image)) throw new Error('avatar catalog check failed');
  const personalization = await request('/api/avatar-personalizations?userId=smoke-user');
  if (!Array.isArray(personalization.personalizations) || personalization.personalizations.length !== 6) throw new Error('avatar personalization read failed');
  const renamed = personalization.personalizations.map((item) => item.avatarId === 'rex' ? { ...item, displayName: 'Rocky' } : item);
  const savedPersonalization = await request('/api/avatar-personalizations', { method: 'PUT', body: JSON.stringify({ userId: 'smoke-user', personalizations: renamed }) });
  if (savedPersonalization.personalizations.find((item) => item.avatarId === 'rex')?.displayName !== 'Rocky') throw new Error('avatar personalization write failed');
  const missions = await request('/api/missions');
  if (!Array.isArray(missions.missions) || missions.missions.length < 1) throw new Error('mission board check failed');
  const conversation = await request('/api/conversations/reply', {
    method: 'POST',
    body: JSON.stringify({ avatarId: 'mentor', message: 'I am agree with this plan', activity: 'daily conversation', history: [] }),
  });
  if (!conversation.reply || !Array.isArray(conversation.languageFeedback)) throw new Error('conversation check failed');
  const followupText = 'I am stuck while studying for exams.';
  const followup = await request('/api/conversations/reply', {
    method: 'POST',
    body: JSON.stringify({
      avatarId: 'mentor',
      message: followupText,
      activity: 'daily conversation',
      history: [
        { role: 'user', content: 'I keep circling the same question.' },
        { role: 'assistant', content: conversation.reply },
        { role: 'user', content: followupText },
      ],
    }),
  });
  if (!followup.reply || followup.reply === conversation.reply) throw new Error('conversation follow-up did not respond with fresh context');
  const friendReply = await request('/api/conversations/reply', {
    method: 'POST',
    body: JSON.stringify({ avatarId: 'bestFriend', message: followupText, activity: 'daily conversation', history: [{ role: 'user', content: followupText }] }),
  });
  if (!friendReply.reply || friendReply.reply === followup.reply) throw new Error('avatar conversation styles are not distinct');
  const avatarReplies = [followup.reply, friendReply.reply];
  for (const avatarId of ['challenger', 'entertainer', 'calm', 'strategist']) {
    const response = await request('/api/conversations/reply', {
      method: 'POST',
      body: JSON.stringify({ avatarId, message: followupText, activity: 'daily conversation', history: [{ role: 'user', content: followupText }] }),
    });
    avatarReplies.push(response.reply);
  }
  if (new Set(avatarReplies).size !== 6) throw new Error('all six avatars must have distinct local conversation replies');
  const interview = await request('/api/interviews/coach', {
    method: 'POST',
    body: JSON.stringify({ role: 'frontend developer', companyType: 'software', scenario: 'Placement interview', answer: 'I built a campus app and improved the result by 20 percent.' }),
  });
  if (!Number.isFinite(Number(interview.score)) || !interview.feedback) throw new Error('interview check failed');
  const thought = await request('/api/thoughts', { method: 'POST', body: JSON.stringify({ userId: 'smoke-user', text: 'Smoke test thought.' }) });
  if (!thought.thought?.id) throw new Error('thought write check failed');
  const thoughts = await request('/api/thoughts/smoke-user');
  if (!thoughts.thoughts.some((item) => item.id === thought.thought.id)) throw new Error('thought read check failed');
  console.log(`MindMesh API smoke passed (${health.mode}; Supabase configured: ${health.supabaseConfigured})`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

'use strict';

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
  const health = await request('/api/health');
  if (health.status !== 'ok') throw new Error('health check did not return ok');
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

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { SupabaseError, createSupabaseAdapter, isConfigured: isSupabaseConfigured } = require('./supabase');

loadDotEnv(path.join(__dirname, '.env'));

const app = express();
const PORT = parsePort(process.env.PORT, 3000);
const JSON_LIMIT = '100kb';
const MAX_HISTORY_ITEMS = 20;
const MAX_THOUGHTS_PER_USER = 100;
const MAX_TOTAL_THOUGHTS = 5000;
const DATA_FILE = process.env.MINDMESH_DATA_FILE || path.join(__dirname, 'data', 'mindmesh-data.json');
const AVATAR_PERSONALIZATIONS_FILE = process.env.MINDMESH_AVATAR_FILE || path.join(__dirname, 'data', 'avatar-personalizations.json');

app.disable('x-powered-by');

const AVATARS = [
  {
    id: 'rex', defaultName: 'REX', image: 'assets/avatars/rex.jpg',
     name: 'REX',
     role: 'Challenger',
    personality: 'Bold, direct, and motivating; pushes for honest action.',
    voice: 'Energetic, concise, and respectfully provocative.',
    style: 'Turns uncertainty into a small, measurable challenge.',
    strengths: ['accountability', 'decisiveness', 'momentum'],
  },
  {
    id: 'mia', defaultName: 'MIA', image: 'assets/avatars/mia.jpg',
     name: 'MIA',
     role: 'Best Friend',
    personality: 'Warm, loyal, and encouraging without being dismissive.',
    voice: 'Casual, empathetic, and reassuring.',
    style: 'Listens first, then offers practical support in a familiar tone.',
    strengths: ['empathy', 'encouragement', 'perspective'],
  },
  {
    id: 'arden', defaultName: 'ARDEN', image: 'assets/avatars/sofia.jpg',
     name: 'ARDEN',
     role: 'Mentor',
    personality: 'Patient, thoughtful, and focused on long-term growth.',
    voice: 'Clear, reflective, and educational.',
    style: 'Explains the reasoning behind a useful next step.',
    strengths: ['teaching', 'reflection', 'skill-building'],
  },
  {
    id: 'zoe', defaultName: 'ZOE', image: 'assets/avatars/jordan.jpg',
     name: 'ZOE',
     role: 'Entertainer',
    personality: 'Playful, optimistic, and skilled at making practice feel lighter.',
    voice: 'Lively, expressive, and imaginative.',
    style: 'Uses creative prompts and light humor to keep energy moving.',
    strengths: ['creativity', 'energy', 'engagement'],
  },
  {
    id: 'elian', defaultName: 'ELIAN', image: 'assets/avatars/nia.jpg',
     name: 'ELIAN',
     role: 'Calm Companion',
    personality: 'Grounded, gentle, and attentive to emotional bandwidth.',
    voice: 'Unhurried, soothing, and non-judgmental.',
    style: 'Breaks pressure into quiet, manageable moments.',
    strengths: ['grounding', 'patience', 'emotional awareness'],
  },
  {
    id: 'vera', defaultName: 'VERA', image: 'assets/avatars/maya.jpg',
     name: 'VERA',
     role: 'Strategist',
    personality: 'Analytical, organized, and focused on useful trade-offs.',
    voice: 'Structured, precise, and practical.',
    style: 'Maps options, constraints, and the highest-leverage move.',
    strengths: ['planning', 'prioritization', 'problem-solving'],
  },
];

const AVATAR_BY_ID = new Map(AVATARS.map((avatar) => [avatar.id, avatar]));
const AVATAR_ALIASES = new Map([
  ['challenger', 'rex'], ['bestfriend', 'mia'], ['bestFriend', 'mia'], ['mentor', 'arden'],
  ['entertainer', 'zoe'], ['calm', 'elian'], ['calmcompanion', 'elian'], ['strategist', 'vera'],
]);
const MISSIONS = [
  { id: 'name-the-signal', title: 'Name the signal', description: 'Write one honest sentence about what is taking up space today.', tag: 'Reflect', points: 10 },
  { id: 'ask-a-better-question', title: 'Ask a better question', description: 'Send one follow-up in SpeakSpace that starts with why, how, or what if.', tag: 'Connect', points: 15 },
  { id: 'try-the-smallest-step', title: 'Try the smallest step', description: 'Choose one action that lowers uncertainty, then do it before the day ends.', tag: 'Experiment', points: 20 },
  { id: 'meet-a-new-lens', title: 'Meet a new lens', description: 'Open the council and notice which perspective changes the shape of your thought.', tag: 'Explore', points: 15 },
];
const thoughtsByUser = loadThoughts();
let totalThoughts = [...thoughtsByUser.values()].reduce((count, items) => count + items.length, 0);
const missionCompletionsByUser = new Map();
const avatarPersonalizations = loadAvatarPersonalizations();

// Security and browser-access headers are intentionally kept dependency-free.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
   res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
   res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self' https: http://localhost:3000 http://localhost:4173; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use((req, res, next) => {
  const requestOrigin = req.get('Origin');
  const configuredOrigins = String(process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowsAnyOrigin = configuredOrigins.includes('*');
  const originAllowed = requestOrigin && (allowsAnyOrigin || configuredOrigins.includes(requestOrigin));

  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', allowsAnyOrigin ? '*' : requestOrigin);
    if (!allowsAnyOrigin) res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

app.use(express.json({ limit: JSON_LIMIT, strict: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mindmesh-server',
    mode: hasProviderConfig() ? 'openai-compatible' : 'local-demo',
    supabaseConfigured: isSupabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/avatars', (req, res) => {
  res.json({ avatars: AVATARS.map((avatar) => ({ ...avatar, image: `/${avatar.image}` })) });
});

app.get('/api/avatar-personalizations', async (req, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { adapter, user } = await authenticateSupabaseRequest(req);
      const items = await adapter.listAvatarPersonalizations(user.id);
      return res.json({ personalizations: normalizeAvatarPersonalizations(items), mode: 'supabase' });
    }
    const userId = validateUserId(req.query.userId || 'guest');
    return res.json({ personalizations: getLocalAvatarPersonalizations(userId), mode: 'local-demo' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
});

app.put('/api/avatar-personalizations', async (req, res, next) => {
  try {
    const items = validateAvatarPersonalizations(req.body?.personalizations);
    if (isSupabaseConfigured()) {
      const { adapter, user } = await authenticateSupabaseRequest(req);
      const saved = await adapter.upsertAvatarPersonalizations(user.id, items);
      return res.json({ personalizations: normalizeAvatarPersonalizations(saved), mode: 'supabase' });
    }
    const userId = validateUserId(req.body?.userId || 'guest');
    avatarPersonalizations.set(userId, items);
    persistAvatarPersonalizations();
    return res.json({ personalizations: getLocalAvatarPersonalizations(userId), mode: 'local-demo' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
});

app.get('/api/missions', (req, res) => {
  const userId = String(req.query.userId || '').trim();
  const completed = missionCompletionsByUser.get(userId) || new Set();
  res.json({ missions: MISSIONS.map((mission) => ({ ...mission, completed: completed.has(mission.id) })), mode: 'local-demo' });
});

app.post('/api/missions/:missionId/complete', (req, res, next) => {
  try {
    const mission = MISSIONS.find((item) => item.id === req.params.missionId);
    if (!mission) throw badRequest('Unknown mission.');
    const userId = validateUserId(req.body?.userId);
    const completed = Boolean(req.body?.completed);
    let userMissions = missionCompletionsByUser.get(userId);
    if (!userMissions) { userMissions = new Set(); missionCompletionsByUser.set(userId, userMissions); }
    if (completed) userMissions.add(mission.id); else userMissions.delete(mission.id);
    return res.json({ mission: { ...mission, completed: userMissions.has(mission.id) }, mode: 'local-demo' });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    const { user } = await authenticateSupabaseRequest(req);
    return res.json({ user, mode: 'supabase' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
});

app.get('/api/profile', async (req, res, next) => {
  try {
    const { adapter, user } = await authenticateSupabaseRequest(req);
    const profile = await adapter.getProfile(user.id);
    return res.json({ profile, userId: user.id, mode: 'supabase' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
});

app.put('/api/profile', async (req, res, next) => {
  try {
    const { adapter, user } = await authenticateSupabaseRequest(req);
    const profile = validateProfileInput(req.body);
    const savedProfile = await adapter.upsertProfile(user.id, profile);
    return res.json({ profile: savedProfile, userId: user.id, mode: 'supabase' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
});

app.get('/api/preferences', async (req, res, next) => {
  try {
    const { adapter, user } = await authenticateSupabaseRequest(req);
    const preferences = await adapter.getPreferences(user.id);
    return res.json({ preferences, userId: user.id, mode: 'supabase' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
});

app.put('/api/preferences', async (req, res, next) => {
  try {
    const { adapter, user } = await authenticateSupabaseRequest(req);
    const preferences = validatePreferencesInput(req.body);
    const savedPreferences = await adapter.upsertPreferences(user.id, preferences);
    return res.json({ preferences: savedPreferences, userId: user.id, mode: 'supabase' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
});

app.post('/api/conversations/reply', async (req, res, next) => {
  try {
    const input = validateConversationInput(req.body);
    const baseAvatar = AVATAR_BY_ID.get(input.avatarId);
    const avatar = await resolveAvatarForRequest(req, input, baseAvatar);
    const localResult = createLocalConversationReply(avatar, input);
     const providerPrompt = createConversationPrompt(avatar, input);
     const providerResult = await tryProviderReply(providerPrompt, localResult);
     const conversationId = await persistConversationTurn(req, input, avatar, providerResult.reply);

     return res.json({
       avatar: avatar.id,
       reply: providerResult.reply,
      languageFeedback: providerResult.languageFeedback,
       mode: providerResult.mode,
       ...(conversationId ? { conversationId } : {}),
       ...(providerResult.notice ? { notice: providerResult.notice } : {}),
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/interviews/coach', async (req, res, next) => {
  try {
    const input = validateInterviewInput(req.body);
    const localResult = createLocalInterviewFeedback(input);
    const providerPrompt = createInterviewPrompt(input);
    const providerResult = await tryProviderInterview(providerPrompt, localResult);

    return res.json({
      feedback: providerResult.feedback,
      score: providerResult.score,
      nextQuestion: providerResult.nextQuestion,
      strengths: providerResult.strengths,
      improvements: providerResult.improvements,
      mode: providerResult.mode,
      ...(providerResult.notice ? { notice: providerResult.notice } : {}),
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/thoughts', (req, res, next) => {
  try {
    if (isSupabaseConfigured()) return saveSupabaseThought(req, res, next);
    const { userId, text } = validateThoughtInput(req.body);
    const thought = {
      id: crypto.randomUUID(),
      userId,
      text,
      createdAt: new Date().toISOString(),
    };

    let userThoughts = thoughtsByUser.get(userId);
    if (!userThoughts) {
      // Keep the demo store bounded even when clients send many unique IDs.
      if (thoughtsByUser.size >= 1000) {
        const oldestUserId = thoughtsByUser.keys().next().value;
        const removed = thoughtsByUser.get(oldestUserId) || [];
        totalThoughts -= removed.length;
        thoughtsByUser.delete(oldestUserId);
      }
      userThoughts = [];
      thoughtsByUser.set(userId, userThoughts);
    }

    userThoughts.push(thought);
    totalThoughts += 1;
    while (userThoughts.length > MAX_THOUGHTS_PER_USER) {
      userThoughts.shift();
      totalThoughts -= 1;
    }
    while (totalThoughts > MAX_TOTAL_THOUGHTS) {
      const oldestEntry = thoughtsByUser.entries().next().value;
      if (!oldestEntry) break;
      const [oldestId, oldestThoughts] = oldestEntry;
      if (oldestThoughts.length > 0) {
        oldestThoughts.shift();
        totalThoughts -= 1;
      }
      if (oldestThoughts.length === 0) thoughtsByUser.delete(oldestId);
    }
    persistThoughts();

    return res.status(201).json({ thought, mode: 'local-demo' });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/thoughts/:userId', (req, res, next) => {
  try {
    if (isSupabaseConfigured()) return getSupabaseThoughts(req, res, next);
    const userId = validateUserId(req.params.userId);
    const thoughts = thoughtsByUser.get(userId) || [];
    return res.json({ userId, thoughts: [...thoughts], mode: 'local-demo' });
  } catch (error) {
    return next(error);
  }
});

// Serve the browser client from the same origin so the frontend can use the API
// without a separate development server or cross-origin credentials.
app.use(express.static(path.join(__dirname, '..', 'mindmesh'), { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: `Request body exceeds the ${JSON_LIMIT} limit.` });
  }

  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error(error.message);
  return res.status(status).json({
    error: status >= 500 && error.code !== 'SUPABASE_NOT_CONFIGURED' ? 'Internal server error.' : error.message,
    ...(error.code ? { code: error.code } : {}),
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`MindMesh server listening on port ${PORT} (${hasProviderConfig() ? 'openai-compatible' : 'local-demo'} mode)`);
  });
}

function parsePort(value, fallback) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}

function loadDotEnv(filePath) {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    source.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const separator = trimmed.indexOf('=');
      if (separator <= 0) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(`Could not read ${filePath}: ${error.message}`);
  }
}

function hasProviderConfig() {
  return Boolean(String(process.env.AI_API_KEY || '').trim() && providerBaseUrl());
}

function providerBaseUrl() {
  return String(process.env.AI_BASE_URL || 'https://api.openai.com/v1').trim();
}

async function authenticateSupabaseRequest(req) {
  const adapter = createSupabaseAdapter();
  if (!adapter) throw supabaseNotConfiguredError();

  const accessToken = getBearerToken(req);
  const user = await adapter.getAuthenticatedUser(accessToken);
  return { adapter, user };
}

function getBearerToken(req) {
  const header = String(req.get('Authorization') || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1].trim()) {
    const error = new Error('Authorization must include a Supabase Bearer access token.');
    error.statusCode = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  return match[1].trim();
}

function supabaseNotConfiguredError() {
  const error = new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env to use this endpoint.');
  error.statusCode = 503;
  error.code = 'SUPABASE_NOT_CONFIGURED';
  return error;
}

function normalizeSupabaseRouteError(error) {
  if (!(error instanceof SupabaseError)) return error;

  const normalized = new Error(
    error.statusCode === 401 || error.statusCode === 403
      ? 'Authentication failed.'
      : error.statusCode === 504
        ? 'Supabase did not respond in time.'
        : 'Supabase is unavailable or rejected the request.',
  );
  normalized.statusCode = error.statusCode;
  normalized.code = error.code;
  return normalized;
}

function validateProfileInput(body) {
  assertObject(body, 'Request body must be an object.');
  const profile = {};

  if (Object.prototype.hasOwnProperty.call(body, 'username')) {
    profile.username = body.username === null ? null : requireString(body.username, 'username', 2, 40);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'displayName')) {
    profile.display_name = body.displayName === null ? null : requireString(body.displayName, 'displayName', 1, 120);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
    profile.bio = body.bio === null ? null : requireString(body.bio, 'bio', 1, 2000);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'avatarUrl')) {
    profile.avatar_url = body.avatarUrl === null ? null : requireString(body.avatarUrl, 'avatarUrl', 1, 2000);
  }

  if (Object.keys(profile).length === 0) {
    throw badRequest('Provide at least one profile field: username, displayName, bio, or avatarUrl.');
  }
  return profile;
}

function validatePreferencesInput(body) {
  assertObject(body, 'Request body must be an object.');
  const preferences = {};
  if (Object.prototype.hasOwnProperty.call(body, 'theme')) {
    const theme = requireString(body.theme, 'theme', 1, 10);
    if (!['system', 'light', 'dark'].includes(theme)) throw badRequest('theme must be system, light, or dark.');
    preferences.theme = theme;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'language')) preferences.language = requireString(body.language, 'language', 2, 20);
  if (Object.prototype.hasOwnProperty.call(body, 'timezone')) preferences.timezone = requireString(body.timezone, 'timezone', 1, 80);
  if (Object.prototype.hasOwnProperty.call(body, 'notificationsEnabled')) preferences.notifications_enabled = Boolean(body.notificationsEnabled);
  if (Object.prototype.hasOwnProperty.call(body, 'soundEnabled')) preferences.sound_enabled = Boolean(body.soundEnabled);
  if (!Object.keys(preferences).length) throw badRequest('Provide at least one preference field.');
  return preferences;
}

async function saveSupabaseThought(req, res, next) {
  try {
    const { adapter, user } = await authenticateSupabaseRequest(req);
    const text = requireString(req.body?.text, 'text', 1, 2000);
    const thought = await adapter.createThought(user.id, text);
    return res.status(201).json({ thought, mode: 'supabase' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
}

async function getSupabaseThoughts(req, res, next) {
  try {
    const { adapter, user } = await authenticateSupabaseRequest(req);
    const requestedUserId = validateUserId(req.params.userId);
    if (requestedUserId !== user.id) {
      const error = new Error('You may only access your own thoughts.');
      error.statusCode = 403;
      throw error;
    }
    const thoughts = await adapter.listThoughts(user.id);
    return res.json({ userId: user.id, thoughts, mode: 'supabase' });
  } catch (error) {
    return next(normalizeSupabaseRouteError(error));
  }
}

async function persistConversationTurn(req, input, avatar, reply) {
  if (!isSupabaseConfigured() || !getBearerTokenIfPresent(req)) return null;
  const { adapter, user } = await authenticateSupabaseRequest(req);
  let conversation = input.conversationId ? await adapter.getConversation(user.id, input.conversationId) : null;
  if (!conversation) {
    conversation = await adapter.createConversation(user.id, avatar.id, `${avatar.name} · ${input.activity}`);
  }
  if (!conversation?.id) throw new SupabaseError('Supabase did not return a conversation.', 502, { code: 'CONVERSATION_CREATE_FAILED' });
  await adapter.addMessage(conversation.id, 'user', input.message);
  await adapter.addMessage(conversation.id, 'assistant', reply);
  return conversation.id;
}

async function resolveAvatarForRequest(req, input, avatar) {
  if (isSupabaseConfigured() && getBearerTokenIfPresent(req)) {
    const { adapter, user } = await authenticateSupabaseRequest(req);
    const items = await adapter.listAvatarPersonalizations(user.id);
    const saved = normalizeAvatarPersonalizations(items).find((item) => item.avatarId === avatar.id);
    return saved ? { ...avatar, name: saved.displayName } : avatar;
  }
  const saved = getLocalAvatarPersonalizations(input.userId || 'guest').find((item) => item.avatarId === avatar.id);
  return saved ? { ...avatar, name: saved.displayName } : avatar;
}

function getBearerTokenIfPresent(req) {
  const header = String(req.get('Authorization') || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match && match[1].trim() ? match[1].trim() : null;
}

function validateConversationInput(body) {
  assertObject(body, 'Request body must be an object.');
  const requestedAvatarId = requireString(body.avatarId, 'avatarId', 1, 40);
  const avatarId = canonicalAvatarId(requestedAvatarId);
  if (!AVATAR_BY_ID.has(avatarId)) throw badRequest('avatarId must identify one of the available avatars.');
  const message = requireString(body.message, 'message', 1, 4000);
  const activity = optionalString(body.activity, 'activity', 0, 200) || 'general conversation';
  const history = validateHistory(body.history);
  const conversationId = body.conversationId === undefined || body.conversationId === null ? '' : requireUuid(body.conversationId, 'conversationId');
  const userId = body.userId === undefined || body.userId === null ? '' : validateUserId(body.userId);
  return { avatarId, message, activity, history, conversationId, userId };
}

function requireUuid(value, field) {
  const normalized = requireString(value, field, 1, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) throw badRequest(`${field} must be a UUID.`);
  return normalized;
}

function validateHistory(history) {
  if (history === undefined || history === null) return [];
  if (!Array.isArray(history)) throw badRequest('history must be an array when provided.');
  return history.slice(-MAX_HISTORY_ITEMS).map((item, index) => {
    assertObject(item, `history[${index}] must be an object.`);
    const role = requireString(item.role, `history[${index}].role`, 1, 20);
    if (!['user', 'assistant', 'system'].includes(role)) {
      throw badRequest(`history[${index}].role must be user, assistant, or system.`);
    }
    return { role, content: requireString(item.content, `history[${index}].content`, 1, 4000) };
  });
}

function validateInterviewInput(body) {
  assertObject(body, 'Request body must be an object.');
  return {
    role: requireString(body.role, 'role', 1, 120),
    companyType: requireString(body.companyType, 'companyType', 1, 120),
    scenario: requireString(body.scenario, 'scenario', 1, 2000),
    answer: requireString(body.answer, 'answer', 1, 4000),
  };
}

function validateThoughtInput(body) {
  assertObject(body, 'Request body must be an object.');
  return {
    userId: validateUserId(body.userId),
    text: requireString(body.text, 'text', 1, 2000),
  };
}

function validateUserId(value) {
  const userId = requireString(value, 'userId', 1, 80);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@+-]*$/.test(userId)) {
    throw badRequest('userId may contain letters, numbers, dots, underscores, colons, @, plus, and hyphens.');
  }
  return userId;
}

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest(message);
}

function requireString(value, field, minLength, maxLength) {
  if (typeof value !== 'string') throw badRequest(`${field} must be a string.`);
  const normalized = value.trim();
  if (normalized.length < minLength) throw badRequest(`${field} is required.`);
  if (normalized.length > maxLength) throw badRequest(`${field} must be ${maxLength} characters or fewer.`);
  return normalized;
}

function optionalString(value, field, minLength, maxLength) {
  if (value === undefined || value === null) return '';
  return requireString(value, field, minLength, maxLength);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createLocalConversationReply(avatar, input) {
  const message = String(input.message || '').trim();
  const lower = message.toLowerCase();
  const previousTurns = Array.isArray(input.history) ? input.history.slice(0, -1).filter((turn) => turn.role === 'user').length : 0;
  const turn = previousTurns % 2;
  const topic = conversationTopic(lower);
  const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(message);
  const isThanks = /\b(thank you|thanks|appreciate it)\b/i.test(lower);
  const isCelebrating = /\b(i did it|i finished|i passed|i got the job|i got accepted|i am proud|i'm proud|it worked|that helped)\b/i.test(lower);
  const isUpset = /\b(anxious|anxiety|afraid|scared|sad|stressed|overwhelmed|lonely|upset|worried|nervous|exhausted|frustrated)\b/i.test(lower);
  const isStuck = /\b(stuck|can't|cannot|don't know|do not know|keep failing|keep making|confused|lost|struggling)\b/i.test(lower);
  const isChoosing = /\b(should i|which one|choose between|can't decide|cannot decide|decision|option)\b/i.test(lower);
  const category =
    isGreeting ? 'greeting' :
    isThanks ? 'gratitude' :
    isCelebrating ? 'celebration' :
    isUpset ? 'emotion' :
    isChoosing ? 'decision' :
    isStuck ? 'stuck' :
    /\b(what|why|how|when|where|which)\b/.test(lower) || /\?.*$/.test(message) ? 'question' :
    topic ? 'topic' :
    'default';

  const templates = {
    greeting: {
      rex: ['Hey. What do you want to make real progress on today?', 'Back again. What is the real question that keeps showing up?', 'Let’s cut the fluff: what are you trying to solve?', 'You are here for a reason. What is worth dealing with right now?'],
      mia: ['Hey, I’m glad you came in. What feels heavy, honest, or exciting right now?', 'Hi again. What feels most useful to unpack without any pressure?', 'We can keep it simple: what feels real for you right now?', 'Tell me the part that feels most difficult or most alive.'],
      arden: ['Hello. What would you like to understand more clearly today?', 'Welcome back. What would a useful next step look like?', 'Let’s start with the goal and the constraint. What matters most?', 'What do you want to get clearer on before you act?'],
      zoe: ['Hey! What are we turning from messy to interesting?', 'Nice to see you. What is the spark worth exploring?', 'Pick one thought and let’s make it move. What is the angle?', 'What would feel fun, useful, and just a little bold to tackle?'],
      elian: ['Hi. We can take this gently. What feels important enough to look at?', 'Welcome back. Where do you want to begin, without pressure?', 'You do not have to fix the whole thing at once. What feels manageable?', 'What is the smallest part you feel okay to explore?'],
      vera: ['Hello. What decision, plan, or pattern do you want to sharpen?', 'Welcome back. What question is worth answering clearly?', 'Let’s be precise: what are you trying to improve or decide?', 'What is the main signal, the key constraint, and the decision at hand?']
    },
    gratitude: {
      rex: ['Good. Let’s turn that into action before the energy fades.', 'Anytime. What is the next move you want to make?', 'Nice. Now put that clarity to work. What is next?'],
      mia: ['You’re welcome. I’m glad that helped. What feels useful now?', 'Anytime. Want to talk through one more step together?', 'Good. What would make this feel easier to carry forward?'],
      arden: ['You’re welcome. What would a stronger next move look like?', 'Glad it helped. Is there another angle worth exploring?', 'Anytime. What would you like to improve next?'],
      zoe: ['You’re welcome. We can keep the momentum going with one fun step.', 'Always. What is the next creative move?', 'Good. What is the next little win we can chase?'],
      elian: ['You’re welcome. Let’s pause for a breath before the next step.', 'Anytime. We can keep the pressure low and still move forward.', 'Glad it helped. What feels supportive and manageable next?'],
      vera: ['You’re welcome. What decision is most worth making next?', 'Anytime. Let’s move from reflection to the next useful action.', 'Glad it helped. What is the best next question to answer?']
    },
    celebration: {
      rex: ['That is a real win. What made it possible?', 'Good. Now use that pattern again. What is the next target?', 'You earned that. What do you want to carry forward from it?'],
      mia: ['That sounds really good. What part feels best to hold onto?', 'You deserve that moment. What helped most?', 'I’m happy for you. What is the next tiny celebration we can build?'],
      arden: ['That is meaningful progress. What did the process teach you?', 'Well done. Which skill or habit helped most?', 'That is a strong result. What information would you keep for the next challenge?'],
      zoe: ['Yes! That deserves a small victory lap. What part felt best?', 'That is the kind of result that makes momentum feel real. What is next?', 'You nailed it. What do you want to do with that energy?'],
      elian: ['That sounds like a moment worth noticing. What feels different now?', 'That is a good sign. What helped you get there?', 'You should feel proud of that. What small win do you want to keep?'],
      vera: ['That is a useful signal. What pattern or decision created it?', 'That is promising. What should you repeat next time?', 'Strong. What is the most valuable lesson to keep?']
    },
    emotion: {
      rex: ['That sounds heavy. What is the main pressure point?', 'You do not need to carry this alone. What part feels biggest?', 'Let’s shrink it down. What is the single thing that feels most draining?'],
      mia: ['I hear how much that is weighing on you. What feels hardest to hold right now?', 'That sounds exhausting. What part of it feels most manageable to unpack?', 'You do not have to fix it all tonight. What would help the load feel lighter?'],
      arden: ['Let’s take that apart carefully. What is the main source of pressure, and what is the effect on you?', 'What feels most important to understand before deciding what to do next?', 'Let’s separate the emotion from the actual issue. What is the problem, and what is the reaction to it?'],
      zoe: ['That sounds intense. Can we make it smaller for a second and look at one tiny step?', 'Let’s make it lighter. What is the least dramatic version of this problem?', 'A little humor and a smaller frame might help. What is the next tiny move?'],
      elian: ['You do not have to solve it all tonight. What part feels safe to put down for a moment?', 'Name the feeling without rushing to fix it. What feels heaviest?', 'Pause for a breath. What feels okay to notice without forcing a solution?'],
      vera: ['Let’s separate the feeling from the facts. What is the actual issue, and what is the reaction to it?', 'What is the smallest lever that could reduce the pressure?', 'We can work from the signal, not the panic. What is the real constraint?']
    },
    decision: {
      rex: ['Let’s be clear: what outcome matters most to you?', 'Pick the option that moves you nearer to what you want, not just what feels safe.', 'What would you be proud to choose, even if the result were imperfect?'],
      mia: ['Which choice feels kinder to the version of you who has to live with it?', 'What matters most, and what are you trying to protect?', 'Let’s keep it honest: what matters most, and what can you let go of?'],
      arden: ['Define the criteria first. What makes one option meaningfully better than the other?', 'What trade-off are you willing to accept, and which one is not worth it?', 'Which decision reduces more uncertainty, and which one only feels more comfortable?'],
      zoe: ['If you picked each option for one week, which would teach you more?', 'Which choice makes you feel more alive, more curious, or more ready?', 'Let’s turn it into a quick experiment: which option gives you the best story to learn from?'],
      elian: ['What would feel a little more peaceful or honest?', 'Which option makes room for your energy instead of draining it?', 'If you took the pressure off the outcome, which option feels better?'],
      vera: ['Name the criteria, score the options, and choose the one with the strongest evidence.', 'What is the main constraint? Which option handles it best?', 'Which decision produces the most clarity in the shortest time?']
    },
    stuck: {
      rex: ['Stop circling. What is one move you have not tried yet?', 'Choose the smallest action that would make the problem feel more obvious.', 'Let’s make the next step practical: what can you do in the next ten minutes?'],
      mia: ['That loop is exhausting. What part of it feels least impossible right now?', 'Let’s shrink it down. What is the easiest piece to act on?', 'We can make this feel lighter. What would a kinder first step look like?'],
      arden: ['Where is the momentum breaking? What happens right before you stop?', 'What assumption could you test in a small, low-risk way?', 'Let’s identify the bottleneck before we fix the whole system.'],
      zoe: ['Try the opposite of your usual instinct for a moment. What changes?', 'Let’s turn this into a tiny experiment instead of a giant problem.', 'What is the playful version of the next move?'],
      elian: ['You are not failing; you are stuck in a loop. What feels gentle enough to start with?', 'What part of this can you hold gently without trying to solve it all?', 'Pause and look for the least heavy next step.'],
      vera: ['Break it into goal, constraint, and decision. Which is the actual blocker?', 'What would reduce uncertainty the fastest?', 'Let’s isolate the bottleneck and solve that first.']
    },
    question: {
      rex: ['Good question. What do you already know, and what still needs proof?', 'Let’s work from evidence, not instinct. What would make this clearer?', 'This is worth answering, but first: what matters most in the answer?'],
      mia: ['I like that question. What would feel most honest and helpful to know?', 'Good thinking. What feels like the real answer you need?', 'That is a useful question. What would make the answer feel true?'],
      arden: ['A strong question usually reveals the real issue. What is your best version of it?', 'Let’s unpack it. Which detail would make the answer less vague?', 'Good. What does a more useful answer require you to know?'],
      zoe: ['That is a fun question. What angle makes it more interesting?', 'Let’s make it sharper. What would the twist be?', 'Now we are getting somewhere. What would make this answer feel alive?'],
      elian: ['That is a thoughtful question. What part feels important to hold gently?', 'Good question. What would feel calm and honest to answer?', 'I like that. What would make the response clear without pressure?'],
      vera: ['This deserves a clear answer. What are the key facts, assumptions, and trade-offs?', 'What would make the answer useful rather than impressive?', 'Let’s frame it properly: what is the question really asking?']
    },
    topic: {
      rex: [`Quick reality check on ${topic}: what outcome are you aiming for?`, `Let’s make progress on ${topic}. What is one concrete move you can make today?`, `You have a real signal here. What is the most useful next step for ${topic}?`],
      mia: [`I’m with you on ${topic}. What would feel most helpful right now?`, `We can work through ${topic} together. Where should we start?`, `Let’s make ${topic} feel lighter. What part feels most important to unpack?`],
      arden: [`Let’s clarify what you know and what is still uncertain about ${topic}. Which piece matters most?`, `What would progress on ${topic} look like in a way you could actually notice?`, `Let’s structure this: what is the goal, the constraint, and the missing fact for ${topic}?`],
      zoe: [`Let’s turn ${topic} into a small experiment. What could you try once, just to see what happens?`, `What is one interesting angle on ${topic} you have not explored yet?`, `This could get more interesting if we changed the frame. What if we tried a different angle on ${topic}?`],
      elian: [`No rush with ${topic}. What feels manageable to look at first?`, `We can take ${topic} one piece at a time. Which piece feels okay to start with?`, `Let’s keep ${topic} gentle and concrete. What feels the least heavy to explore first?`],
      vera: [`For ${topic}, name the goal, the main constraint, and the next decision. Which is still unclear?`, `What is the next decision about ${topic} that would reduce the most uncertainty?`, `Let’s get precise: what is the real problem behind the noise around ${topic}?`]
    },
    default: {
      rex: ['Let’s get to the heart of it. What result are you actually trying to create?', 'The useful move is usually smaller than the big feeling. What is the first step?', 'You have a signal here. What is the real problem behind the noise?'],
      mia: ['I’m with you. What would feel most helpful right now?', 'We can take this at your pace. What part feels most important to talk through?', 'Tell me the part that feels most real, and we can work from there.'],
      arden: ['Let’s clarify the situation before jumping to a solution. What matters most?', 'What do you know for sure, and what is still uncertain?', 'What would a good next step look like in plain language?'],
      zoe: ['Let’s find a fresher angle. What could you test this week?', 'What is the interesting version of this problem?', 'We can make this less heavy and more useful. What is one smart move?'],
      elian: ['No need to solve it all. What feels manageable to look at first?', 'I’m listening. What would make this feel a little lighter?', 'Take your time. What part do you want to give more room to?'],
      vera: ['Let’s define the goal, the constraint, and the next decision. Which one matters most?', 'What is the smallest useful move that reduces uncertainty?', 'The clearer the problem, the easier the answer. What is the real issue?']
    }
  };

  const list = templates[category]?.[avatar.id] || templates[category]?.vera || templates.default.vera;
  const seeded = `${avatar.id}:${lower}:${turn}:${category}:${previousTurns}`;
  const reply = list[Math.abs(seeded.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % list.length];

  return {
    reply,
    languageFeedback: createLanguageFeedback(message),
    mode: 'local-demo',
    notice: 'Local demo intelligence is active.',
  };
}

function conversationTopic(message) {
  const topics = [
    [/\bexams?\b/, 'your exams'],
    [/\binterviews?\b/, 'the interview'],
    [/\bprojects?\b/, 'your project'],
    [/\bpresentations?\b/, 'the presentation'],
    [/\b(?:job|career|work)\b/, 'work'],
    [/\b(?:family|parents|siblings)\b/, 'your family'],
    [/\b(?:friend|friends|friendship)\b/, 'the friendship'],
    [/\b(?:relationship|partner|breakup)\b/, 'the relationship'],
    [/\b(?:money|finances|budget)\b/, 'money'],
    [/\b(?:health|sleep|energy)\b/, 'your wellbeing'],
    [/\b(?:coding|programming|software)\b/, 'the coding problem'],
    [/\b(?:bug|error|code)\b/, 'the coding problem'],
    [/\b(?:resume|cv|cover letter)\b/, 'your application'],
    [/\b(?:essay|writing|email|message)\b/, 'the writing'],
    [/\b(?:assignment|homework|study|studying|exam prep)\b/, 'your studies'],
    [/\b(?:plan|planning|schedule|organize)\b/, 'the plan'],
    [/\b(?:deadline|due date)\b/, 'the deadline'],
    [/\b(?:decision|choice|option)\b/, 'the decision'],
  ];
  return topics.find(([pattern]) => pattern.test(message))?.[1] || '';
}

function createLanguageFeedback(message) {
  const notes = [];
  const patterns = [
    [/\bi am agree\b/i, 'Use “I agree” instead of “I am agree”.'],
    [/\bdiscuss about\b/i, '“Discuss” already includes the meaning of “about”.'],
    [/\bmore better\b/i, 'Use “better”; it is already the comparative form.'],
    [/\bhe go\b/i, 'Use “he goes” in the present tense.'],
    [/\bshe have\b/i, 'Use “she has” with she in the present tense.'],
  ];
  patterns.forEach(([regex, suggestion]) => {
    const match = message.match(regex);
    if (match) notes.push({ category: 'grammar', note: `Watch the phrase “${match[0]}”.`, suggestion });
  });
  if (/\s{2,}/.test(message)) {
    notes.push({ category: 'clarity', note: 'There is extra spacing in the message.', suggestion: 'Use a single space between words.' });
  }
  if (/\bi\b/.test(message)) {
    notes.push({ category: 'capitalization', note: 'The first-person pronoun appears as lowercase “i”.', suggestion: 'Capitalize it as “I”.' });
  }
  if (message.length > 160 && !/[.!?]$/.test(message.trim())) {
    notes.push({ category: 'structure', note: 'This is a longer thought without closing punctuation.', suggestion: 'Consider splitting it into shorter sentences.' });
  }
  return notes.slice(0, 3);
}

function createConversationPrompt(avatar, input) {
  return {
    system: [
      `You are the MindMesh ${avatar.name} avatar.`,
      `Personality: ${avatar.personality}`,
      `Voice: ${avatar.voice}`,
      `Style: ${avatar.style}`,
      'You are a capable general-purpose assistant as well as a supportive conversation partner. Help with questions, explanations, writing, planning, brainstorming, and practical tasks; do not limit yourself to emotional coaching.',
      'Talk naturally and respond to what this person actually said and how they seem to feel.',
      'Use the conversation history to continue the thread; do not repeat your earlier wording or simply echo their message.',
      'If they ask for help or ask a direct question, help directly and answer before asking anything back. If they are venting, listen without rushing to fix it.',
      'Keep this avatar’s perspective and voice distinct, but never let style get in the way of a useful answer.',
      'Do not force a question into every reply. Never claim to be human or to have feelings or experiences.',
      'Keep the reply warm, specific, and concise; do not invent details.',
      'Return only JSON with this shape: {"reply":"string","languageFeedback":[{"category":"string","note":"string","suggestion":"string"}]}.',
      'Language feedback should be kind, specific, and limited to three notes.',
    ].join(' '),
    user: JSON.stringify({ activity: input.activity, message: input.message, history: input.history }),
  };
}

function createInterviewPrompt(input) {
  return {
    system: [
      'You are a practical interview coach.',
      'Evaluate the answer for structure, relevance, ownership, and measurable impact.',
      'Return only JSON with this shape: {"feedback":"string","score":0,"nextQuestion":"string","strengths":["string"],"improvements":["string"]}.',
      'The score must be an integer from 0 to 100. Keep feedback actionable and concise.',
    ].join(' '),
    user: JSON.stringify(input),
  };
}

async function tryProviderReply(prompt, fallback) {
  if (!hasProviderConfig()) return fallback;
  try {
    const result = await requestProvider(prompt, 500);
    return normalizeConversationProviderResult(result, fallback);
  } catch (error) {
    console.error('AI conversation provider failed.', error instanceof Error ? error.message : 'Unknown provider error.');
    return { ...fallback, notice: 'The AI provider is unavailable. Local demo replies are active; check the server configuration and logs.' };
  }
}

async function tryProviderInterview(prompt, fallback) {
  if (!hasProviderConfig()) return fallback;
  try {
    const result = await requestProvider(prompt, 450);
    return normalizeInterviewProviderResult(result, fallback);
  } catch (error) {
    console.error('AI interview provider failed.', error instanceof Error ? error.message : 'Unknown provider error.');
    return { ...fallback, notice: 'The AI provider is unavailable. Local demo feedback is active; check the server configuration and logs.' };
  }
}

async function requestProvider(prompt, maxTokens) {
  const endpoint = providerEndpoint(providerBaseUrl());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(process.env.AI_API_KEY).trim()}`,
      },
      body: JSON.stringify({
        model: String(process.env.AI_MODEL || 'gpt-4o-mini').trim(),
        temperature: 0.7,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider request failed with status ${response.status}.`);
    const payload = await response.json();
    const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
      ? payload.choices[0].message.content
      : '';
    if (typeof content !== 'string' || !content.trim()) throw new Error('Provider response did not contain message content.');
    return parseProviderJson(content);
  } finally {
    clearTimeout(timeout);
  }
}

function providerEndpoint(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v\d+(?:\.\d+)?$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function parseProviderJson(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : content.trim();
  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new Error('Provider response was not valid JSON.');
  }
}

function normalizeConversationProviderResult(result, fallback) {
  if (!result || typeof result !== 'object') return fallback;
  const reply = typeof result.reply === 'string' ? clip(result.reply.trim(), 4000) : '';
  if (!reply) return fallback;
  const feedback = Array.isArray(result.languageFeedback)
    ? result.languageFeedback
      .filter((item) => item && typeof item === 'object')
      .slice(0, 3)
      .map((item) => ({
        category: clip(String(item.category || 'language'), 40),
        note: clip(String(item.note || 'Language note.'), 300),
        suggestion: clip(String(item.suggestion || 'Keep the wording specific.'), 300),
      }))
    : fallback.languageFeedback;
  return { reply, languageFeedback: feedback.length ? feedback : fallback.languageFeedback, mode: 'openai-compatible' };
}

function normalizeInterviewProviderResult(result, fallback) {
  if (!result || typeof result !== 'object') return fallback;
  const feedback = typeof result.feedback === 'string' ? clip(result.feedback.trim(), 2000) : '';
  const nextQuestion = typeof result.nextQuestion === 'string' ? clip(result.nextQuestion.trim(), 500) : '';
  if (!feedback || !nextQuestion) return fallback;
  const scoreNumber = Number(result.score);
  const score = Number.isFinite(scoreNumber) ? Math.max(0, Math.min(100, Math.round(scoreNumber))) : fallback.score;
  const strengths = cleanStringList(result.strengths, fallback.strengths);
  const improvements = cleanStringList(result.improvements, fallback.improvements);
  return { feedback, score, nextQuestion, strengths, improvements, mode: 'openai-compatible' };
}

function cleanStringList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((item) => typeof item === 'string' && item.trim()).slice(0, 4).map((item) => clip(item.trim(), 300));
  return cleaned.length ? cleaned : fallback;
}

function createLocalInterviewFeedback(input) {
  const answer = input.answer;
  const lowerAnswer = answer.toLowerCase();
  const hasAction = /\b(led|built|created|improved|launched|organized|resolved|designed|implemented|delivered|managed)\b/.test(lowerAnswer);
  const hasResult = /\b(result|impact|increased|decreased|saved|grew|reduced|percent|%|metric|outcome)\b/.test(lowerAnswer);
  const hasContext = /\b(when|because|challenge|problem|situation|context|goal)\b/.test(lowerAnswer);
  let score = 50;
  if (answer.length >= 120) score += 10;
  if (answer.length < 60) score -= 10;
  if (hasAction) score += 14;
  if (hasResult) score += 16;
  if (hasContext) score += 7;
  score = Math.max(0, Math.min(100, score));

  const strengths = [];
  if (hasAction) strengths.push('You describe an action you took rather than only the background.');
  if (hasContext) strengths.push('You provide some context for the interviewer.');
  if (answer.length >= 120) strengths.push('The answer has enough detail to develop a clear story.');
  if (strengths.length === 0) strengths.push('You have a direct starting point that can be shaped into a stronger example.');

  const improvements = [];
  if (!hasResult) improvements.push('Add a measurable result or clear outcome.');
  if (!hasAction) improvements.push('Make your personal contribution explicit with action verbs.');
  if (!hasContext) improvements.push('Briefly establish the situation, challenge, or goal first.');
  if (improvements.length === 0) improvements.push('Tighten the story and connect the result to the role.');

  const nextQuestion = hasResult
    ? `For the ${input.role} role, what trade-off did you consider before choosing that approach?`
    : `For the ${input.role} role, what specific metric or outcome would you use to prove this approach worked?`;

  return {
    feedback: `This ${input.companyType} interview answer is a ${score >= 75 ? 'solid' : 'promising'} start. Use a concise situation-task-action-result structure and make your impact easier to verify.`,
    score,
    nextQuestion,
    strengths,
    improvements,
    mode: 'local-demo',
    notice: 'Local demo intelligence is active.',
  };
}

function clip(value, maxLength) {
  const text = String(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function canonicalAvatarId(value) {
  const normalized = String(value || '').trim();
  return AVATAR_ALIASES.get(normalized) || AVATAR_ALIASES.get(normalized.toLowerCase()) || normalized;
}

function validateAvatarPersonalizations(value) {
  if (!Array.isArray(value)) throw badRequest('personalizations must be an array.');
  const seen = new Set();
  return value.map((item, index) => {
    assertObject(item, `personalizations[${index}] must be an object.`);
    const avatarId = canonicalAvatarId(requireString(item.avatarId || item.id, `personalizations[${index}].avatarId`, 1, 40));
    if (!AVATAR_BY_ID.has(avatarId)) throw badRequest(`Unknown avatar ID: ${avatarId}.`);
    if (seen.has(avatarId)) throw badRequest(`Duplicate avatar ID: ${avatarId}.`);
    seen.add(avatarId);
    const avatar = AVATAR_BY_ID.get(avatarId);
    return {
      avatarId,
      displayName: requireString(item.displayName || item.name || avatar.defaultName, `personalizations[${index}].displayName`, 1, 40),
      role: avatar.role,
      image: avatar.image,
      voiceEnabled: item.voiceEnabled !== false,
      voiceMode: ['push-to-talk', 'listening'].includes(item.voiceMode) ? item.voiceMode : 'push-to-talk',
    };
  });
}

function defaultAvatarPersonalizations() {
  return AVATARS.map((avatar) => ({
    avatarId: avatar.id,
    displayName: avatar.defaultName,
    role: avatar.role,
    image: avatar.image,
    voiceEnabled: true,
    voiceMode: 'push-to-talk',
  }));
}

function getLocalAvatarPersonalizations(userId) {
  return avatarPersonalizations.get(userId) || defaultAvatarPersonalizations();
}

function normalizeAvatarPersonalizations(items) {
  const byId = new Map((Array.isArray(items) ? items : []).map((item) => [canonicalAvatarId(item.avatar_id || item.avatarId), item]));
  return AVATARS.map((avatar) => {
    const item = byId.get(avatar.id) || {};
    return {
      avatarId: avatar.id,
      displayName: item.display_name || item.displayName || avatar.defaultName,
      role: avatar.role,
      image: avatar.image,
      voiceEnabled: item.voice_enabled !== false && item.voiceEnabled !== false,
      voiceMode: item.voice_mode || item.voiceMode || 'push-to-talk',
      updatedAt: item.updated_at || item.updatedAt || null,
    };
  });
}

function loadAvatarPersonalizations() {
  try {
    const parsed = JSON.parse(fs.readFileSync(AVATAR_PERSONALIZATIONS_FILE, 'utf8'));
    return new Map(Object.entries(parsed || {}).filter(([, items]) => Array.isArray(items)));
  } catch (error) {
    return new Map();
  }
}

function persistAvatarPersonalizations() {
  try {
    fs.mkdirSync(path.dirname(AVATAR_PERSONALIZATIONS_FILE), { recursive: true });
    const temporary = `${AVATAR_PERSONALIZATIONS_FILE}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(Object.fromEntries(avatarPersonalizations.entries()), null, 2), 'utf8');
    fs.renameSync(temporary, AVATAR_PERSONALIZATIONS_FILE);
  } catch (error) {
    console.error(`Could not persist avatar personalizations: ${error.message}`);
  }
}

function loadThoughts() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return new Map();
    return new Map(Object.entries(parsed).filter(([, items]) => Array.isArray(items)).map(([userId, items]) => [userId, items.slice(-MAX_THOUGHTS_PER_USER)]));
  } catch (error) {
    return new Map();
  }
}

function persistThoughts() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const payload = Object.fromEntries(thoughtsByUser.entries());
    const temporary = `${DATA_FILE}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(temporary, DATA_FILE);
  } catch (error) {
    console.error(`Could not persist thoughts: ${error.message}`);
  }
}

module.exports = { app, AVATARS };

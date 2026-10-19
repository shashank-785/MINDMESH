'use strict';

/**
 * Small, optional Supabase adapter for server-only operations.
 *
 * The adapter is deliberately disabled unless both configuration values are
 * present. The service-role key is only read in this server module and is
 * never returned to a caller.
 */

const DEFAULT_TIMEOUT_MS = 8000;

class SupabaseError extends Error {
  constructor(message, statusCode = 502, options = {}) {
    super(message);
    this.name = 'SupabaseError';
    this.statusCode = statusCode;
    this.code = options.code || 'SUPABASE_REQUEST_FAILED';
    this.cause = options.cause;
  }
}

function readConfiguration(env = process.env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  } catch (error) {
    return null;
  }

  return { url, serviceRoleKey };
}

function isConfigured(env = process.env) {
  return Boolean(readConfiguration(env));
}

function createSupabaseAdapter(options = {}) {
  const configuration = readConfiguration(options.env || process.env);
  if (!configuration) return null;

  const fetchImplementation = options.fetchImplementation || globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new SupabaseError('This Node.js runtime does not provide fetch.', 500, { code: 'FETCH_UNAVAILABLE' });
  }

  return new SupabaseAdapter({
    ...configuration,
    fetchImplementation,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
  });
}

class SupabaseAdapter {
  constructor({ url, serviceRoleKey, fetchImplementation, timeoutMs }) {
    this.url = url;
    this.serviceRoleKey = serviceRoleKey;
    this.fetchImplementation = fetchImplementation;
    this.timeoutMs = timeoutMs;
  }

  async getAuthenticatedUser(accessToken) {
    const token = normalizeAccessToken(accessToken);
    if (!token) {
      throw new SupabaseError('A Supabase access token is required.', 401, { code: 'AUTH_REQUIRED' });
    }

    const payload = await this.request('/auth/v1/user', { authorization: token });
    if (!payload || typeof payload.id !== 'string' || !payload.id) {
      throw new SupabaseError('Supabase authentication did not return a user.', 502, { code: 'AUTH_RESPONSE_INVALID' });
    }
    return payload;
  }

  async getProfile(userId) {
    const rows = await this.request('/rest/v1/profiles', {
      query: {
        select: 'id,username,display_name,bio,avatar_url,created_at,updated_at',
        id: `eq.${userId}`,
        limit: '1',
      },
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async upsertProfile(userId, profile) {
    const rows = await this.request('/rest/v1/profiles', {
      method: 'POST',
      query: { on_conflict: 'id' },
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: [{ id: userId, ...profile }],
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async createThought(userId, text) {
    const rows = await this.request('/rest/v1/thoughts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: [{ user_id: userId, text }],
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async listThoughts(userId) {
    const rows = await this.request('/rest/v1/thoughts', {
      query: { select: 'id,user_id,text,created_at,updated_at', user_id: `eq.${userId}`, order: 'created_at.desc', limit: '100' },
    });
    return Array.isArray(rows) ? rows : [];
  }

  async getPreferences(userId) {
    const rows = await this.request('/rest/v1/user_preferences', {
      query: { select: 'user_id,theme,language,timezone,notifications_enabled,sound_enabled,created_at,updated_at', user_id: `eq.${userId}`, limit: '1' },
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async upsertPreferences(userId, preferences) {
    const rows = await this.request('/rest/v1/user_preferences', {
      method: 'POST',
      query: { on_conflict: 'user_id' },
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: [{ user_id: userId, ...preferences }],
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async getConversation(userId, conversationId) {
    const rows = await this.request('/rest/v1/conversations', {
      query: { select: 'id,user_id,avatar_id,title', id: `eq.${conversationId}`, user_id: `eq.${userId}`, limit: '1' },
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async getLatestConversation(userId, avatarId) {
    const rows = await this.request('/rest/v1/conversations', {
      query: {
        select: 'id,user_id,avatar_id,title,created_at',
        user_id: `eq.${userId}`,
        avatar_id: `eq.${avatarId}`,
        archived_at: 'is.null',
        order: 'created_at.desc',
        limit: '1',
      },
    });
    const conversation = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!conversation) return null;

    const messages = await this.request('/rest/v1/messages', {
      query: {
        select: 'role,content,created_at',
        conversation_id: `eq.${conversation.id}`,
        order: 'created_at.asc',
        limit: '60',
      },
    });
    return { conversation, messages: Array.isArray(messages) ? messages : [] };
  }

  async createConversation(userId, avatarId, title) {
    const rows = await this.request('/rest/v1/conversations', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: [{ user_id: userId, avatar_id: avatarId, title }],
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async addMessage(conversationId, role, content) {
    const rows = await this.request('/rest/v1/messages', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: [{ conversation_id: conversationId, role, content }],
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async listAvatarPersonalizations(userId) {
    return this.request('/rest/v1/avatar_personalizations', {
      query: { select: 'avatar_id,display_name,role,image_key,voice_enabled,voice_mode,updated_at', user_id: `eq.${userId}`, order: 'avatar_id.asc' },
    });
  }

  async upsertAvatarPersonalizations(userId, items) {
    return this.request('/rest/v1/avatar_personalizations', {
      method: 'POST',
      query: { on_conflict: 'user_id,avatar_id' },
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: items.map((item) => ({
        user_id: userId,
        avatar_id: item.avatarId,
        display_name: item.displayName,
        role: item.role,
        image_key: item.image,
        voice_enabled: item.voiceEnabled,
        voice_mode: item.voiceMode,
      })),
    });
  }

  async request(resourcePath, options = {}) {
    const url = new URL(resourcePath, `${this.url}/`);
    Object.entries(options.query || {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = {
      Accept: 'application/json',
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${options.authorization || this.serviceRoleKey}`,
      ...options.headers,
    };

    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      const response = await this.fetchImplementation(url, {
        method: options.method || 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const statusCode = response.status === 401 || response.status === 403 ? response.status : 502;
        throw new SupabaseError(`Supabase request failed with status ${response.status}.`, statusCode, {
          code: response.status === 401 || response.status === 403 ? 'AUTH_FAILED' : 'SUPABASE_REQUEST_FAILED',
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof SupabaseError) throw error;
      if (error && error.name === 'AbortError') {
        throw new SupabaseError('Supabase request timed out.', 504, { code: 'SUPABASE_TIMEOUT', cause: error });
      }
      throw new SupabaseError('Supabase request could not be completed.', 502, {
        code: 'SUPABASE_UNAVAILABLE',
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeAccessToken(value) {
  const token = String(value || '').trim();
  return token || null;
}

async function readResponsePayload(response) {
  const contentType = String(response.headers && response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }
  return null;
}

module.exports = {
  SupabaseError,
  createSupabaseAdapter,
  isConfigured,
  readConfiguration,
};

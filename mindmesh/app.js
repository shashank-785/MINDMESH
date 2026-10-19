const personas = {
  challenger: {
    id: 'rex', name: 'REX', defaultName: 'REX', shortName: 'REX', role: 'Challenger', voice: 'bright', style: 'Direct', activity: 'Daily talk', image: 'assets/avatars/rex.jpg', description: 'Confident, witty, and kind enough to make the hard question useful.',
    intro: 'Good morning, Alex. What’s taking up space in your mind today?',
    replies: ['Let’s stay with that loop for a moment. What question is underneath the questions?', 'I hear a strong idea trying to get past a polite hesitation. What would you say if you had to be completely honest?']
  },
  bestFriend: {
    id: 'mia', name: 'MIA', defaultName: 'MIA', shortName: 'MIA', role: 'Best Friend', voice: 'warm', style: 'Casual', activity: 'Unfiltered thoughts', image: 'assets/avatars/mia.jpg', description: 'Warm, casual, and always ready to help you put the pressure down.',
    intro: 'Hey Alex. Come as you are — what’s been taking up space in your head?',
    replies: ['Okay, let’s untangle this together. Which part feels the most annoying right now?', 'You don’t have to solve the whole thing tonight. What is one small thing we can make lighter?']
  },
  mentor: {
    id: 'arden', name: 'ARDEN', defaultName: 'ARDEN', shortName: 'ARDEN', role: 'Mentor', voice: 'measured', style: 'Formal', activity: 'Interview practice', image: 'assets/avatars/sofia.jpg', description: 'Mature, clear, and thoughtful about turning experience into direction.',
    intro: 'Welcome back, Alex. What would you like to understand more clearly today?',
    replies: ['A useful professional frame is context, action, result. How would your story sound in that shape?', 'That is a thoughtful goal. What would meaningful progress look like by the end of this week?']
  },
  entertainer: {
    id: 'zoe', name: 'ZOE', defaultName: 'ZOE', shortName: 'ZOE', role: 'Entertainer', voice: 'playful', style: 'Energetic', activity: 'Creative sparks', image: 'assets/avatars/jordan.jpg', description: 'Energetic, playful, and excellent at finding the surprising angle.',
    intro: 'Welcome to the good part, Alex. What are we making more interesting today?',
    replies: ['Lightning round: what is the tiniest brave move you could make in the next ten minutes?', 'Let’s make this less like a problem and more like a scene. What changes in the next beat?']
  },
  calm: {
    id: 'elian', name: 'ELIAN', defaultName: 'ELIAN', shortName: 'ELIAN', role: 'Calm Companion', voice: 'soft', style: 'Gentle', activity: 'Journaling', image: 'assets/avatars/nia.jpg', description: 'Gentle, grounded, and patient with the parts of a thought that need time.',
    intro: 'Take a breath, Alex. There is no rush here. What feels present for you?',
    replies: ['Let’s give that feeling a little room without asking it to become an answer yet.', 'Notice what your body already knows about this. Which part softens when you name it?']
  },
  strategist: {
    id: 'vera', name: 'VERA', defaultName: 'VERA', shortName: 'VERA', role: 'Strategist', voice: 'precise', style: 'Analytical', activity: 'Thought mapping', image: 'assets/avatars/maya.jpg', description: 'Sharp, analytical, and focused on the smallest useful next experiment.',
    intro: 'Let’s look at the signal, Alex. Which decision or pattern should we map first?',
    replies: ['Separate the assumption from the fact underneath it. What evidence would change your mind?', 'Name the smallest next experiment. What would you learn from it, even if it fails?']
  }
};

const activityPersonas = { overview: 'rex', speakspace: 'mia', interview: 'arden', galaxy: 'vera', council: 'zoe', journal: 'elian', quests: 'rex' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const storage = {
  get(key, fallback = null) { try { return localStorage.getItem(key) ?? fallback; } catch (error) { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (error) { /* Private browsing can disable storage. */ } },
  remove(key) { try { localStorage.removeItem(key); } catch (error) { /* Private browsing can disable storage. */ } }
};
const mediaDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const appState = {
  theme: storage.get('mindmesh-theme', 'system'),
  offlineOnly: storage.get('mindmesh-offline-only') === 'true',
  authMode: 'signin',
  authUser: null,
  authToken: storage.get('mindmesh-auth-token'),
  avatarPersonalizations: {},
  voiceActivation: false,
  voiceMode: 'push-to-talk',
  apiMode: 'unknown',
  connection: 'loading',
};

function resolvedTheme(theme = appState.theme) {
  return theme === 'system' ? Boolean(mediaDark?.matches) : theme === 'dark';
}

function setTheme(theme, { persist = true, sync = true } = {}) {
  const selected = ['system', 'light', 'dark'].includes(theme) ? theme : 'system';
  appState.theme = selected;
  if (persist) storage.set('mindmesh-theme', selected);
  const isDark = resolvedTheme(selected);
  document.body.classList.toggle('dark-mode', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  const themeColor = $('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', isDark ? '#0b1018' : '#f8f7f3');
  const toggle = $('#dark-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Use light mode' : 'Use dark mode');
    toggle.textContent = isDark ? '☀' : '☾';
  }
  const select = $('#theme-select');
  if (select && select.value !== selected) select.value = selected;
  if (persist && sync && appState.authUser && appState.authToken) syncThemePreference(selected);
}

function setAccessibilityPreference(name, enabled) {
  document.body.classList.toggle(`a11y-${name}`, enabled);
  let preferences = {};
  try { preferences = JSON.parse(storage.get('mindmesh-accessibility', '{}') || '{}'); } catch (error) { preferences = {}; }
  preferences[name] = enabled;
  storage.set('mindmesh-accessibility', JSON.stringify(preferences));
}

function loadAccessibilityPreferences() {
  let preferences = {};
  try { preferences = JSON.parse(storage.get('mindmesh-accessibility', '{}') || '{}'); } catch (error) { preferences = {}; }
  ['reduce-motion', 'larger-text', 'high-contrast'].forEach(name => {
    const enabled = Boolean(preferences[name]);
    setAccessibilityPreference(name, enabled);
    const input = $(`#${name}`);
    if (input) input.checked = enabled;
  });
}

setTheme(appState.theme, { persist: false });
loadAccessibilityPreferences();
if (mediaDark?.addEventListener) mediaDark.addEventListener('change', () => { if (appState.theme === 'system') setTheme('system', { persist: false }); });
$('#dark-toggle').addEventListener('click', () => setTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark'));
$('#voice-activation-toggle').addEventListener('click', startVoiceActivation);
let activePersonaId = 'challenger';
let recognition;
let interviewRecognition;
let voiceActivationRecognition;
let activeScenario = 'Placement interview';
let targetRole = 'student role';
let targetCompany = 'software';
let interviewStartedAt;
let interviewTimer;
let conversationOwnerId = currentUserId();
const initialConversationStore = loadConversationStore(conversationOwnerId);
let conversationHistories = initialConversationStore.histories;
let conversationIds = initialConversationStore.conversationIds;
const pendingConversationCounts = new Map();
let activeUtterance = null;
let activeSpeechStage = null;
const defaultMissions = [
  { id: 'name-the-signal', title: 'Name the signal', description: 'Write one honest sentence about what is taking up space today.', tag: 'Reflect', points: 10 },
  { id: 'ask-a-better-question', title: 'Ask a better question', description: 'Send one follow-up in SpeakSpace that starts with why, how, or what if.', tag: 'Connect', points: 15 },
  { id: 'try-the-smallest-step', title: 'Try the smallest step', description: 'Choose one action that lowers uncertainty, then do it before the day ends.', tag: 'Experiment', points: 20 },
  { id: 'meet-a-new-lens', title: 'Meet a new lens', description: 'Open the council and notice which perspective changes the shape of your thought.', tag: 'Explore', points: 15 },
];
let missions = [];
let missionSource = 'local';

function setSystemStatus(message, state = 'ready') {
  const status = $('#app-status');
  const label = $('#app-status-label');
  if (!status || !label) return;
  status.hidden = false;
  status.dataset.state = state;
  label.textContent = message;
  const syncStatus = $('#sync-status');
  if (syncStatus) syncStatus.textContent = message;
}

function setAuthStatus(message, state = 'info') {
  const status = $('#auth-status');
  if (!status) return;
  status.dataset.state = state;
  status.textContent = message;
}

function localGuestId() {
  let id = storage.get('mindmesh-guest-id');
  if (!id) {
    id = `guest-${Math.random().toString(36).slice(2, 10)}`;
    storage.set('mindmesh-guest-id', id);
  }
  return id;
}

function currentUserId() { return appState.authUser?.id || localGuestId(); }

function loadConversationStore(ownerId) {
  try {
    const saved = JSON.parse(storage.get(`mindmesh-conversations-v1:${ownerId}`, '{}') || '{}');
    const histories = {};
    const conversationIds = {};
    Object.keys(personas).forEach(personaId => {
      const turns = saved.histories?.[personaId];
      histories[personaId] = Array.isArray(turns)
        ? turns.filter(turn => turn && ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string')
          .slice(-60).map(turn => ({ role: turn.role, content: turn.content.slice(0, 4000), time: typeof turn.time === 'string' ? turn.time : '' }))
        : [];
      const id = saved.conversationIds?.[personaId];
      if (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) conversationIds[personaId] = id;
    });
    return { histories, conversationIds };
  } catch (error) {
    return { histories: {}, conversationIds: {} };
  }
}

function saveConversationStore(ownerId = conversationOwnerId, histories = conversationHistories, ids = conversationIds) {
  storage.set(`mindmesh-conversations-v1:${ownerId}`, JSON.stringify({
    histories,
    conversationIds: ids,
  }));
}

function switchConversationOwner() {
  const nextOwnerId = currentUserId();
  if (nextOwnerId === conversationOwnerId) return;
  conversationOwnerId = nextOwnerId;
  const store = loadConversationStore(conversationOwnerId);
  conversationHistories = store.histories;
  conversationIds = store.conversationIds;
  renderConversation();
}

function updateProfileSurface() {
  const user = appState.authUser;
  $('#profile-name').textContent = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest Explorer';
  $('#profile-detail').textContent = user ? 'Signed in · private progress' : 'Guest mode · local progress';
  const initials = (user?.user_metadata?.display_name || user?.email || 'AK').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'AK';
  $$('.profile-avatar, .top-avatar, .user-avatar').forEach(element => { if (!element.closest('.message')) element.textContent = initials; });
  const guestButton = $('#continue-guest');
  if (guestButton) guestButton.innerHTML = user ? 'Sign out and use guest mode <span>→</span>' : 'Continue as guest <span>→</span>';
}

const portraitMarkup = () => `
  <span class="portrait-shoulders"></span>
  <span class="portrait-neck"></span>
  <span class="portrait-body"><i class="portrait-collar left"></i><i class="portrait-collar right"></i></span>
  <span class="portrait-head">
    <i class="portrait-ear left"></i><i class="portrait-ear right"></i><i class="portrait-hair"></i>
    <i class="portrait-brow left"></i><i class="portrait-brow right"></i>
    <i class="portrait-eye left"><b></b></i><i class="portrait-eye right"><b></b></i>
    <i class="portrait-cheek left"></i><i class="portrait-cheek right"></i><i class="portrait-nose"></i><i class="portrait-mouth"></i>
  </span>
  <span class="portrait-hand"></span>`;

function personaFromId(value) {
  if (personas[value]) return value;
  const normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  return Object.keys(personas).find(id => id.toLowerCase() === normalized || personas[id].id.toLowerCase() === normalized || personas[id].role.toLowerCase().replace(/[^a-z]/g, '') === normalized) || 'challenger';
}

function personaEntries() { return Object.values(personas); }

function defaultPersonalizations() {
  return Object.fromEntries(personaEntries().map(persona => [persona.id, {
    avatarId: persona.id,
    displayName: persona.defaultName || persona.name,
    role: persona.role,
    image: persona.image,
    voiceEnabled: true,
    voiceMode: 'push-to-talk',
  }]));
}

function normalizePersonalizations(items) {
  const defaults = defaultPersonalizations();
  (Array.isArray(items) ? items : []).forEach(item => {
    const key = personaEntries().find(persona => persona.id === item.avatarId)?.id;
    if (!key) return;
    defaults[key] = { ...defaults[key], ...item, avatarId: key, displayName: String(item.displayName || defaults[key].displayName).trim() };
  });
  return defaults;
}

function applyPersonalizations(items) {
  appState.avatarPersonalizations = normalizePersonalizations(items);
  personaEntries().forEach(persona => {
    const saved = appState.avatarPersonalizations[persona.id];
    persona.name = saved.displayName;
    persona.shortName = saved.displayName;
    persona.voiceEnabled = saved.voiceEnabled !== false;
    persona.voiceMode = saved.voiceMode || 'push-to-talk';
  });
  const active = activePersona();
  if (active) {
    updatePersonaCopy(active);
    setAvatarState(avatarStage, 'idle', `${active.shortName} is ready`, 'Choose a thought, then speak or type');
  }
  renderAvatarPersonalizationForms();
}

function personalizationPayload() { return Object.values(appState.avatarPersonalizations); }

function personalizationUserId() { return currentUserId(); }

async function loadAvatarPersonalizations() {
  const local = storage.get('mindmesh-avatar-personalizations');
  if (local) {
    try { applyPersonalizations(JSON.parse(local)); } catch (error) { applyPersonalizations([]); }
  } else applyPersonalizations([]);
  const data = await apiRequest(`/api/avatar-personalizations?userId=${encodeURIComponent(personalizationUserId())}`, { method: 'GET' });
  if (data?.personalizations) {
    applyPersonalizations(data.personalizations);
    storage.set('mindmesh-avatar-personalizations', JSON.stringify(personalizationPayload()));
    if (data.mode === 'supabase') storage.set('mindmesh-avatar-onboarding-complete', 'true');
  }
  renderAvatarPersonalizationForms();
  if (storage.get('mindmesh-avatar-onboarding-complete') !== 'true') openAvatarOnboarding();
}

function validatePersonalizationForms(root) {
  const values = {};
  const seen = new Map();
  let invalid = '';
  $$('.avatar-name-input', root).forEach(input => {
    const avatarId = input.dataset.avatarId;
    const name = input.value.trim();
    if (!name) invalid = 'Every avatar needs a name.';
    if (name.length > 40) invalid = 'Names must be 40 characters or fewer.';
    const voiceToggle = $('.avatar-voice-enabled', input.closest('.avatar-name-card'));
    const voiceMode = $('.avatar-voice-mode', input.closest('.avatar-name-card'));
    values[avatarId] = { ...appState.avatarPersonalizations[avatarId], avatarId, displayName: name, voiceEnabled: voiceToggle ? voiceToggle.checked : true, voiceMode: voiceMode?.value || 'push-to-talk' };
    const normalized = name.toLowerCase();
    if (normalized) seen.set(normalized, (seen.get(normalized) || 0) + 1);
  });
  const duplicate = [...seen.entries()].find(([, count]) => count > 1);
  if (duplicate && !window.confirm(`The name “${duplicate[0]}” is used more than once. Keep duplicate names?`)) invalid = 'Choose unique names or confirm that duplicate names are intentional.';
  return { values, invalid };
}

function renderAvatarPersonalizationForms() {
  const containers = [$('#onboarding-avatars'), $('#avatar-settings-list')].filter(Boolean);
  containers.forEach(container => {
    container.innerHTML = personaEntries().map(persona => {
      const saved = appState.avatarPersonalizations[persona.id] || {};
      const label = saved.displayName || persona.defaultName || persona.name;
      return `<article class="avatar-name-card"><div class="portrait portrait--mini portrait--${persona.id}" data-persona="${persona.id}"></div><div class="avatar-name-copy"><strong>${escapeHtml(persona.role)}</strong><small>${escapeHtml(persona.description)}</small><label>Name<input class="avatar-name-input" data-avatar-id="${persona.id}" maxlength="40" value="${escapeHtml(label)}" aria-label="Name for ${escapeHtml(persona.role)}"></label><div class="avatar-voice-row"><label><input class="avatar-voice-enabled" type="checkbox" ${saved.voiceEnabled !== false ? 'checked' : ''}> Voice</label><select class="avatar-voice-mode" aria-label="Voice activation mode for ${escapeHtml(persona.role)}"><option value="push-to-talk" ${saved.voiceMode !== 'listening' ? 'selected' : ''}>Push to talk</option><option value="listening" ${saved.voiceMode === 'listening' ? 'selected' : ''}>Listening mode</option></select></div><button type="button" class="reset-avatar-name" data-reset-avatar="${persona.id}">Reset to ${escapeHtml(persona.defaultName)}</button></div></article>`;
    }).join('');
    hydratePortraits();
    $$('.reset-avatar-name', container).forEach(button => button.addEventListener('click', () => {
      const input = $(`.avatar-name-input[data-avatar-id="${button.dataset.resetAvatar}"]`, container);
      const persona = personaEntries().find(item => item.id === button.dataset.resetAvatar);
      if (input && persona) input.value = persona.defaultName;
    }));
  });
}

function openAvatarOnboarding() {
  const modal = $('#avatar-onboarding');
  if (!modal) return;
  renderAvatarPersonalizationForms();
  modal.hidden = false;
  document.body.classList.add('modal-open');
}

async function saveAvatarPersonalizations(root, statusElement) {
  const { values, invalid } = validatePersonalizationForms(root);
  if (invalid) { statusElement.textContent = invalid; statusElement.dataset.state = 'error'; return false; }
  const button = root === $('#onboarding-avatars') ? $('#save-onboarding') : $('#save-avatar-settings');
  if (button) button.disabled = true;
  statusElement.textContent = 'Saving your circle…';
  const result = await apiRequest('/api/avatar-personalizations', jsonOptions({ userId: personalizationUserId(), personalizations: Object.values(values) }));
  if (!result?.personalizations) {
    applyPersonalizations(Object.values(values));
    storage.set('mindmesh-avatar-personalizations', JSON.stringify(personalizationPayload()));
    statusElement.textContent = 'Saved on this device. Add Supabase to sync across devices.';
    statusElement.dataset.state = 'demo';
  } else {
    applyPersonalizations(result.personalizations);
    storage.set('mindmesh-avatar-personalizations', JSON.stringify(personalizationPayload()));
    statusElement.textContent = result.mode === 'supabase' ? 'Saved to your private account.' : 'Saved to the local demo store.';
    statusElement.dataset.state = result.mode === 'supabase' ? 'success' : 'demo';
  }
  storage.set('mindmesh-avatar-onboarding-complete', 'true');
  if (button) button.disabled = false;
  return true;
}

function paintPortrait(element, personaId) {
  if (!element) return;
  const id = personaFromId(personaId);
  const persona = personas[id];
  const cssName = id === 'bestFriend' ? 'best-friend' : id;
  [...element.classList].filter(name => name.startsWith('portrait--') && !['portrait--large', 'portrait--small', 'portrait--mini', 'portrait--tiny', 'portrait--hero', 'portrait--council'].includes(name)).forEach(name => element.classList.remove(name));
  element.classList.add(`portrait--${cssName}`);
  element.dataset.persona = id;
  if (!element.children.length) element.innerHTML = portraitMarkup();
  let image = element.querySelector('.portrait-image');
  if (persona?.image) {
    if (!image) {
      image = document.createElement('img');
      image.className = 'portrait-image';
      image.addEventListener('error', () => { image.hidden = true; element.classList.remove('uses-photo'); });
      element.appendChild(image);
    }
    image.hidden = false;
    image.src = persona.image;
    image.alt = `${persona.name} portrait`;
    element.classList.add('uses-photo');
  } else if (image) {
    image.hidden = true;
    element.classList.remove('uses-photo');
  }
}

function hydratePortraits() {
  $$('.portrait').forEach(element => {
    const id = personaFromId(element.dataset.persona || [...element.classList].find(name => name.startsWith('portrait--') && !['portrait--large', 'portrait--small', 'portrait--mini', 'portrait--tiny', 'portrait--hero', 'portrait--council'].includes(name))?.replace('portrait--', ''));
    paintPortrait(element, id);
  });
}

function activePersona() { return personas[activePersonaId]; }

function setAvatarState(stage, state, label, detail) {
  if (!stage) return;
  stage.dataset.state = state;
  const statusLabel = $('.avatar-status strong', stage);
  const statusDetail = $('.avatar-status small', stage);
  const stateLabel = $('.state-note span:last-child', stage);
  if (statusLabel && label) statusLabel.textContent = label;
  if (statusDetail && detail) statusDetail.textContent = detail;
  if (stateLabel) stateLabel.textContent = state;
}

const avatarStage = $('#avatar-stage');
const interviewAvatar = $('#interview-avatar');

function updatePersonaCopy(persona) {
  if (!persona) return;
  $('#active-persona-name').textContent = persona.name;
  $('#active-persona-role').textContent = persona.role;
  $('#active-persona-description').textContent = persona.description;
  $('#active-persona-style').textContent = persona.style;
  $('#active-persona-activity').textContent = persona.activity;
  $('#voice-chip').textContent = `Voice · ${typeof persona.voice === 'string' ? persona.voice : persona.voice?.label || 'natural'}`;
  $('#conversation-persona-label').textContent = persona.shortName.toUpperCase();
  $('#message-input').setAttribute('aria-label', `Message ${persona.name}`);
  $('#typing-label').textContent = `${persona.shortName} is thinking…`;
  $('#speak-persona').textContent = `Hear ${persona.shortName}'s introduction ↗`;
}

function setActivePersona(personaId, { manual = false } = {}) {
  const id = personaFromId(personaId);
  if (id !== activePersonaId) {
    if (recognition) {
      const activeRecognition = recognition;
      recognition = null;
      activeRecognition.abort();
      const button = $('#mic-btn');
      button.classList.remove('listening');
      button.textContent = 'voice';
      button.setAttribute('aria-label', 'Start voice message');
      $('#message-input').placeholder = 'Share what’s on your mind…';
    }
    if ('speechSynthesis' in window) {
      if (activeSpeechStage) setAvatarState(activeSpeechStage, 'idle', `${activePersona().shortName} is ready`, 'Your turn — keep the thought moving');
      activeUtterance = null;
      activeSpeechStage = null;
      window.speechSynthesis.cancel();
    }
  }
  activePersonaId = id;
  const persona = activePersona();
  if (manual) $('#auto-match').checked = false;
  $$('.persona-option').forEach(option => {
    const selected = personaFromId(option.dataset.persona) === id;
    option.classList.toggle('active', selected);
    option.setAttribute('aria-pressed', String(selected));
  });
  paintPortrait($('#main-portrait'), id);
  paintPortrait($('#active-portrait'), id);
  updatePersonaCopy(persona);
  renderConversation();
  setAvatarState(avatarStage, 'idle', `${persona.shortName} is ready`, 'Choose a thought, then speak or type');
}

function setTab(tab) {
  const labels = { overview: 'Overview', speakspace: 'SpeakSpace', interview: 'Interview Lab', galaxy: 'Thought Galaxy', council: 'AI Council', journal: 'Thought Journal', quests: 'Quests' };
  const embeddedTargets = { speakspace: '#speakspace', galaxy: '#galaxy', council: '#council', journal: '#thought-input' };
  const embeddedTab = Boolean(embeddedTargets[tab]);
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.tab === tab));
  $('#page-label').textContent = labels[tab] || 'Overview';
  $('#overview').style.display = tab === 'overview' || embeddedTab ? 'block' : 'none';
  $('#quests-view').hidden = tab !== 'quests';
  $$('.interview-view').forEach(view => { view.style.display = view.dataset.view === tab ? 'block' : 'none'; });
  if ($('#auto-match').checked && activityPersonas[tab]) setActivePersona(activityPersonas[tab]);
  if (tab === 'interview') {
     setAvatarState(interviewAvatar, 'idle', `${personas.mentor.name} is ready`, 'Warm, focused, honest feedback');
     startInterviewTimer();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (embeddedTab) window.setTimeout(() => $(embeddedTargets[tab])?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  if (tab === 'quests') renderMissions();
}

$$('[data-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
$$('.persona-option').forEach(option => option.addEventListener('click', () => setActivePersona(option.dataset.persona, { manual: true })));

function speakText(text, stage = avatarStage, persona = activePersona()) {
  if (!('speechSynthesis' in window)) {
    setAvatarState(stage, 'idle', `${persona.shortName} is ready`, 'Your turn — keep the thought moving');
    setSystemStatus('This browser cannot play spoken replies. The response is available in the chat.', 'demo');
    return;
  }
  if (activeSpeechStage) setAvatarState(activeSpeechStage, 'idle', `${activePersona().shortName} is ready`, 'Your turn — keep the thought moving');
  window.speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(text);
  activeUtterance = voice;
  activeSpeechStage = stage;
  const voiceStyle = {
    rex: { rate: 1.02, pitch: 0.9 },
    mia: { rate: 1, pitch: 1.12 },
    arden: { rate: 0.94, pitch: 0.96 },
    zoe: { rate: 1.08, pitch: 1.17 },
    elian: { rate: 0.88, pitch: 0.82 },
    vera: { rate: 0.98, pitch: 1.02 },
  }[persona.id] || { rate: 0.96, pitch: 1 };
  voice.lang = navigator.language || 'en-IN';
  voice.rate = voiceStyle.rate;
  voice.pitch = voiceStyle.pitch;
  const availableVoices = window.speechSynthesis.getVoices();
  const preferredVoice = availableVoices.find(item => /en[-_]IN/i.test(item.lang)) || availableVoices.find(item => /^en/i.test(item.lang));
  if (preferredVoice) voice.voice = preferredVoice;
  voice.onstart = () => {
    if (activeUtterance === voice) setAvatarState(stage, 'speaking', `${persona.shortName} is speaking`, 'Listen to the reply');
  };
  voice.onend = () => {
    if (activeUtterance !== voice) return;
    activeUtterance = null;
    activeSpeechStage = null;
    setAvatarState(stage, 'idle', `${persona.shortName} is ready`, 'Your turn — keep the thought moving');
  };
  voice.onerror = () => {
    if (activeUtterance !== voice) return;
    activeUtterance = null;
    activeSpeechStage = null;
    setAvatarState(stage, 'idle', `${persona.shortName} is ready`, 'The reply is available in the chat');
    setSystemStatus('Spoken reply could not play. The response is available in the chat.', 'demo');
  };
  try {
    window.speechSynthesis.speak(voice);
  } catch (error) {
    activeUtterance = null;
    activeSpeechStage = null;
    setAvatarState(stage, 'idle', `${persona.shortName} is ready`, 'The reply is available in the chat');
    setSystemStatus('Spoken reply could not play. The response is available in the chat.', 'demo');
  }
}

function normalizeVoiceName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function matchVoiceAvatar(transcript) {
  const normalized = normalizeVoiceName(transcript);
  const matches = personaEntries().filter(persona => {
    const name = normalizeVoiceName(persona.name);
    return name && (normalized.startsWith(name) || normalized.includes(`hey${name}`) || normalized.includes(`ok${name}`));
  });
  return matches;
}

function updateVoiceActivationButton() {
  const button = $('#voice-activation-toggle');
  if (!button) return;
  button.classList.toggle('listening', Boolean(voiceActivationRecognition));
  button.setAttribute('aria-pressed', String(Boolean(voiceActivationRecognition)));
  button.setAttribute('aria-label', voiceActivationRecognition ? 'Stop voice activation' : 'Enable voice activation');
  button.textContent = voiceActivationRecognition ? '●' : '◉';
}

function stopVoiceActivation() {
  if (voiceActivationRecognition) voiceActivationRecognition.stop();
  voiceActivationRecognition = null;
  updateVoiceActivationButton();
  setSystemStatus('Voice activation is off · push to talk remains available', 'ready');
}

function startVoiceActivation() {
  if (voiceActivationRecognition) { stopVoiceActivation(); return; }
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    setSystemStatus('Voice activation is not supported in this browser', 'error');
    return;
  }
  if (!personaEntries().some(persona => persona.voiceEnabled !== false)) {
    setSystemStatus('Enable voice for at least one avatar in Settings first', 'error');
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceActivationRecognition = new Recognition();
  voiceActivationRecognition.lang = 'en-IN';
  voiceActivationRecognition.continuous = true;
  voiceActivationRecognition.interimResults = false;
  voiceActivationRecognition.onresult = event => {
    const transcript = [...event.results].slice(-1).map(result => result[0].transcript.trim()).join(' ');
    const matches = matchVoiceAvatar(transcript);
    if (matches.length > 1) {
      setSystemStatus(`Which ${matches[0].name} do you mean? Say the role, or choose manually.`, 'demo');
      return;
    }
    if (matches.length === 1) {
      const persona = matches[0];
      setActivePersona(persona.id);
      setAvatarState(avatarStage, 'listening', `${persona.name} is listening`, 'Voice activation heard their name');
      const command = transcript.replace(new RegExp(`^(hey|ok)?\\s*${persona.name}[:,]?\\s*`, 'i'), '').trim();
      if (command) { $('#message-input').value = command; $('#composer').requestSubmit(); }
      else speakText(`Hey, it’s ${persona.name}. I’m here.`, avatarStage, persona);
    }
  };
  voiceActivationRecognition.onerror = event => { if (event.error !== 'no-speech') setSystemStatus(`Voice activation paused: ${event.error}`, 'error'); };
  voiceActivationRecognition.onend = () => { if (voiceActivationRecognition) { try { voiceActivationRecognition.start(); } catch (error) {} } };
  try {
    voiceActivationRecognition.start();
    updateVoiceActivationButton();
    setSystemStatus('Voice activation on · say a saved avatar name', 'ready');
  } catch (error) {
    voiceActivationRecognition = null;
    setSystemStatus('Microphone permission is required for voice activation', 'error');
  }
}

function nowLabel(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(kind, text, speaker = activePersona(), time = '') {
  const conversation = $('#conversation');
  const message = document.createElement('div');
  message.className = `message ${kind}`;
  const body = document.createElement('div');
  const meta = document.createElement('span');
  meta.className = 'message-meta';
  meta.innerHTML = `${kind === 'user' ? 'YOU' : escapeHtml(speaker.shortName).toUpperCase()} <time>${escapeHtml(nowLabel(time))}</time>`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  body.append(meta, paragraph);
  if (kind === 'user') {
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = 'AK';
    message.append(body, avatar);
  } else {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar portrait portrait--tiny';
    paintPortrait(avatar, speaker.id);
    message.append(avatar, body);
  }
  conversation.appendChild(message);
  conversation.scrollTop = conversation.scrollHeight;
}

function renderConversation() {
  const conversation = $('#conversation');
  const typing = $('#typing');
  if (!conversation || !typing) return;
  conversation.replaceChildren();
  const history = conversationHistories[activePersonaId] || [];
  if (history.length) {
    history.forEach(turn => addMessage(turn.role === 'user' ? 'user' : 'ai', turn.content, activePersona(), turn.time));
  } else {
    addMessage('ai', activePersona().intro, activePersona());
  }
  conversation.appendChild(typing);
  const waiting = Boolean(pendingConversationCounts.get(`${conversationOwnerId}:${activePersonaId}`));
  typing.hidden = !waiting;
  $('#message-input').disabled = waiting;
  $('#mic-btn').disabled = waiting;
  $('#composer button[type="submit"]').disabled = waiting;
}

function saveConversationTurn(ownerId, histories, ids, personaId, role, content) {
  const history = histories[personaId] || (histories[personaId] = []);
  history.push({ role, content, time: new Date().toISOString() });
  if (history.length > 60) history.splice(0, history.length - 60);
  saveConversationStore(ownerId, histories, ids);
}

function findLanguageNotes(text) {
  const notes = [];
  const patterns = [
    { regex: /\bi am agree\b/i, correction: 'I agree', reason: 'Use “agree” as a verb, not “am agree”.' },
    { regex: /\bdiscuss about\b/i, correction: 'discuss', reason: '“Discuss” already includes the meaning of “about”.' },
    { regex: /\bmore better\b/i, correction: 'better', reason: '“Better” is already the comparative form.' },
    { regex: /\bhe go\b/i, correction: 'he goes', reason: 'Add -es for third-person singular in the present tense.' },
    { regex: /\bshe have\b/i, correction: 'she has', reason: 'Use “has” with he, she, and it.' },
    { regex: /(^|[.!?]\s+)i\b/, correction: 'I', reason: 'The pronoun “I” is always capitalized.' }
  ];
  patterns.forEach(item => { const match = text.match(item.regex); if (match) notes.push({ original: match[0].trim(), correction: item.correction, reason: item.reason }); });
  if (text.length > 170 && !/[.!?]$/.test(text.trim())) notes.push({ original: 'long sentence', correction: 'Pause and split this into two sentences', reason: 'Short pauses make your ideas easier to follow.' });
  return notes;
}

function addLanguageFeedback(text) {
  const notes = findLanguageNotes(text);
  if (!notes.length) return;
  const feedback = document.createElement('div');
  feedback.className = 'language-feedback';
  feedback.innerHTML = `<strong>Language lens · ${notes.length} gentle note${notes.length > 1 ? 's' : ''}</strong>${notes.map(note => `<span class="correction">“${escapeHtml(note.original)}” → “${escapeHtml(note.correction)}” · ${escapeHtml(note.reason)}</span>`).join('')}`;
  $('#conversation').appendChild(feedback);
  $('#conversation').scrollTop = $('#conversation').scrollHeight;
}

async function apiRequest(path, options = {}) {
  if (appState.offlineOnly) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 7000);
  try {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (appState.authToken && !headers.Authorization) headers.Authorization = `Bearer ${appState.authToken}`;
    const response = await fetch(path, { ...options, signal: controller.signal, headers });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? await response.json() : await response.text();
  } catch (error) {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function jsonOptions(body, method = 'POST') { return { method, body: JSON.stringify(body) }; }

async function syncThemePreference(theme) {
  const result = await apiRequest('/api/preferences', jsonOptions({ theme }));
  if (result?.preferences) setSystemStatus('Theme preference synced to your account', 'ready');
}

function responseText(data, fields = ['reply', 'message', 'text', 'content']) {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  for (const field of fields) if (typeof data[field] === 'string' && data[field].trim()) return data[field].trim();
  return '';
}

function localReply(text, persona, history) {
  const lower = text.toLowerCase();
  const turn = history.slice(0, -1).filter(item => item.role === 'user').length % 2;
  if (/\b(thank you|thanks|appreciate it)\b/.test(lower)) return turn ? 'Anytime. We can leave it there, or keep going if something else is on your mind.' : 'You’re welcome. I’m glad it helped. What would feel useful from here?';
  if (/\b(anxious|afraid|scared|sad|stressed|overwhelmed|lonely|upset|worried|nervous|exhausted|frustrated)\b/.test(lower)) {
    return turn ? 'I hear how much this is weighing on you. Would it help more to talk it through, or find one small next step?' : 'That sounds like a lot to carry. What part feels heaviest right now?';
  }
  if (/\b(i did it|i finished|i passed|i got the job|i got accepted|i am proud|it worked|that helped)\b/.test(lower)) return turn ? 'You earned that moment. What would you like to take forward from it?' : 'That sounds like a real win. What do you think made the difference?';
  if (/\b(should i|which one|choose between|can.t decide|cannot decide|decision)\b/.test(lower)) return turn ? 'We can compare the trade-offs. What would you most regret giving up?' : 'Let’s make the choice smaller: what matters most to you in the outcome?';
  if (/\b(stuck|can.t|cannot|don.t know|do not know|keep failing|confused|lost)\b/.test(lower)) return turn ? 'Let’s try a different angle. Which part is actually within your control today?' : 'Getting caught in the same loop can be tiring. What have you already tried, even if it didn’t work?';
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lower.trim())) return turn ? 'Hi again. Where would you like to pick things up?' : 'Hey, good to see you. What’s on your mind today?';
  if (text.trim().endsWith('?')) return turn ? 'Let’s work through it together. Which detail would make the answer clearer?' : 'A useful place to start is with what you already know and what still feels uncertain. What have you considered so far?';
  if (turn) return 'We don’t have to solve it all at once. Where would you like to start?';
  return persona.role === 'Calm Companion'
    ? 'There is no rush to have it all figured out. What feels manageable to look at first?'
    : 'I’m listening. What feels most important for me to understand about this?';
}

function speechErrorMessage(error) {
  const messages = {
    'not-allowed': 'Allow microphone access for this site in your browser, then try again.',
    'service-not-allowed': 'Voice recognition is blocked by the browser. Check microphone and speech permissions.',
    'audio-capture': 'No microphone was found. Connect or enable a microphone and try again.',
    'no-speech': 'I didn’t catch any speech. Check your microphone and try again.',
    network: 'Voice recognition needs an internet connection. Check your connection and try again.',
    'language-not-supported': 'Voice recognition does not support the selected language on this device.',
  };
  return messages[error] || `Voice recognition failed${error ? ` (${error})` : ''}. Check your microphone and try again.`;
}

$('#composer').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('#message-input');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const personaId = activePersonaId;
  const persona = activePersona();
  const requestOwnerId = conversationOwnerId;
  const histories = conversationHistories;
  const ids = conversationIds;
  const history = histories[personaId] || (histories[personaId] = []);
  const requestKey = `${requestOwnerId}:${personaId}`;
  addMessage('user', text);
  addLanguageFeedback(text);
  input.value = '';
  saveConversationTurn(requestOwnerId, histories, ids, personaId, 'user', text);
  pendingConversationCounts.set(requestKey, (pendingConversationCounts.get(requestKey) || 0) + 1);
  input.disabled = true;
  $('#mic-btn').disabled = true;
  $('#composer button[type="submit"]').disabled = true;
  setAvatarState(avatarStage, 'thinking', `${persona.shortName} is thinking`, 'Finding the thread underneath your words');
  $('#typing').hidden = false;
  try {
    const result = await apiRequest('/api/conversations/reply', {
      ...jsonOptions({
        message: text,
        avatarId: persona.id,
        userId: requestOwnerId,
        activity: 'daily conversation',
        conversationId: ids[personaId],
        history: history.slice(-20).map(({ role, content }) => ({ role, content })),
      }),
      timeout: 18000,
    });
    if (result?.conversationId) ids[personaId] = result.conversationId;
    const reply = responseText(result) || localReply(text, persona, history);
    saveConversationTurn(requestOwnerId, histories, ids, personaId, 'assistant', reply);
    if (conversationOwnerId !== requestOwnerId || activePersonaId !== personaId) return;
    if (!result || result.mode === 'local-demo') setSystemStatus(result?.notice || 'Local demo intelligence · no live AI provider is active', 'demo');
    else setSystemStatus('Live conversation provider connected', 'ready');
    addMessage('ai', reply, persona);
    speakText(reply, avatarStage, persona);
  } finally {
    const remaining = (pendingConversationCounts.get(requestKey) || 1) - 1;
    if (remaining > 0) pendingConversationCounts.set(requestKey, remaining);
    else pendingConversationCounts.delete(requestKey);
    if (conversationOwnerId === requestOwnerId && activePersonaId === personaId) {
      $('#typing').hidden = !pendingConversationCounts.get(requestKey);
      input.disabled = Boolean(pendingConversationCounts.get(requestKey));
      $('#mic-btn').disabled = Boolean(pendingConversationCounts.get(requestKey));
      $('#composer button[type="submit"]').disabled = Boolean(pendingConversationCounts.get(requestKey));
      if (activeSpeechStage !== avatarStage) setAvatarState(avatarStage, 'idle', `${persona.shortName} is ready`, 'Your turn — keep the thought moving');
    }
  }
});

$('#mic-btn').addEventListener('click', event => {
  const button = event.currentTarget;
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    setSystemStatus('Voice input is not supported in this browser. Try Chrome or Edge, or type your message.', 'error');
    return;
  }
  if (recognition) {
    setSystemStatus('Finishing your recording…', 'ready');
    recognition.stop();
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const activeRecognition = new Recognition();
  let recognitionFailed = false;
  recognition = activeRecognition;
  activeRecognition.lang = navigator.language || 'en-IN';
  activeRecognition.interimResults = true;
  activeRecognition.onresult = eventResult => {
    $('#message-input').value = [...eventResult.results].map(result => result[0].transcript).join('');
  };
  activeRecognition.onerror = eventError => {
    if (recognition !== activeRecognition) return;
    recognitionFailed = true;
    setSystemStatus(speechErrorMessage(eventError.error), 'error');
  };
  activeRecognition.onend = () => {
    if (recognition !== activeRecognition) return;
    recognition = null;
    button.classList.remove('listening');
    button.textContent = 'voice';
    button.setAttribute('aria-label', 'Start voice message');
    $('#message-input').placeholder = 'Share what’s on your mind…';
    const transcript = $('#message-input').value.trim();
    if (!recognitionFailed && transcript) {
      setAvatarState(avatarStage, 'thinking', `${activePersona().shortName} is thinking`, 'Sending your voice message');
      setSystemStatus('Voice captured · getting a response…', 'ready');
      $('#composer').requestSubmit();
    } else if (!recognitionFailed) {
      setSystemStatus('No speech was captured. Check your microphone and try again.', 'error');
      setAvatarState(avatarStage, 'idle', `${activePersona().shortName} is ready`, 'No voice was captured');
    } else {
      setAvatarState(avatarStage, 'idle', `${activePersona().shortName} is ready`, 'Check microphone permissions and try again');
    }
  };
  button.classList.add('listening');
  button.textContent = 'stop';
  button.setAttribute('aria-label', 'Stop recording and send');
  $('#message-input').placeholder = 'Listening… speak your thought';
  setAvatarState(avatarStage, 'listening', `${activePersona().shortName} is listening`, 'Speak naturally, then stop to send');
  try {
    activeRecognition.start();
  } catch (error) {
    recognition = null;
    button.classList.remove('listening');
    button.textContent = 'voice';
    button.setAttribute('aria-label', 'Start voice message');
    $('#message-input').placeholder = 'Share what’s on your mind…';
    setSystemStatus(`Could not start voice input: ${error instanceof Error ? error.message : 'check microphone permissions.'}`, 'error');
    setAvatarState(avatarStage, 'idle', `${activePersona().shortName} is ready`, 'Check microphone permissions and try again');
  }
});

$$('.suggestions button').forEach(button => button.addEventListener('click', () => { $('#message-input').value = button.textContent; $('#message-input').focus(); }));
$('#speak-persona').addEventListener('click', () => speakText(activePersona().intro, avatarStage, activePersona()));

const mockInterviewPrompts = {
  'Placement interview': { default: 'Tell me about yourself and one problem you are excited to solve.', software: 'Walk me through a project where you made a difficult technical trade-off.', analyst: 'Tell me about a time you used data to make a recommendation.', marketing: 'How would you make a new student product memorable in its first month?' },
  'Group discussion': { default: 'Some colleges should make attendance optional. What is your position, and why?', software: 'Should generative AI be allowed in every software engineering classroom?', analyst: 'Is a fast decision better than a perfect decision in business?', marketing: 'Do brands have a responsibility to take a position on social issues?' },
  'College introduction': { default: 'You have 30 seconds: introduce yourself to a new classmate.' },
  'Presentation pitch': { default: 'Pitch one idea that could make student life more creative or connected.', software: 'Pitch a product feature that would make a campus app genuinely useful.', analyst: 'Present one insight you would share with a leadership team.', marketing: 'Pitch a campaign for a product you genuinely believe students need.' }
};

function updateInterviewContext() {
  const base = mockInterviewPrompts[activeScenario] || mockInterviewPrompts['Placement interview'];
  $('#interview-prompt').textContent = base[targetCompany] || base.default;
  $('.question-top .eyebrow').textContent = `QUESTION 01 · ${activeScenario.toUpperCase()}`;
   $('#interview-coach-name').textContent = `${personas.mentor.name} · Mentor`;
  $('#interview-coach-detail').textContent = targetRole ? `Mature · formal · ${targetRole} practice` : 'Mature · formal · focused';
    setAvatarState(interviewAvatar, 'idle', `${personas.mentor.name} is ready`, `Ready for your ${targetRole} practice`);
}

$('#interview-setup').addEventListener('submit', event => { event.preventDefault(); targetRole = $('#target-role').value.trim() || 'student role'; targetCompany = $('#target-company').value; updateInterviewContext(); });
$$('.scenario-card').forEach(card => card.addEventListener('click', () => {
  activeScenario = card.dataset.scenario;
  $$('.scenario-card').forEach(item => item.classList.toggle('active', item === card));
  updateInterviewContext();
  $('#interview-feedback').innerHTML = '<span>●</span><div><strong>Your coach will reflect here</strong><p>Complete one answer to unlock a focused fluency note.</p></div>';
  $('#interview-score').textContent = '—';
}));

function localInterviewFeedback(answer) {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const score = Math.min(98, 62 + Math.min(24, Math.round(words / 3)) + (answer.includes('.') ? 8 : 0));
  return { score, title: 'Good foundation — make the result more specific.', message: `You used ${words} words. Try adding one concrete example and finish with what changed because of your action.` };
}

$('#interview-composer').addEventListener('submit', async event => {
  event.preventDefault();
  const answer = $('#interview-input').value.trim();
  if (!answer) { $('#interview-input').focus(); return; }
   setAvatarState(interviewAvatar, 'thinking', `${personas.mentor.name} is thinking`, 'Looking for clarity, confidence, and a strong structure');
  $('#interview-feedback').innerHTML = '<span class="feedback-spin">●</span><div><strong>Listening for your strongest signal…</strong><p>One moment while your coach shapes a useful reflection.</p></div>';
   const result = await apiRequest('/api/interviews/coach', { ...jsonOptions({ answer, scenario: activeScenario, role: targetRole, companyType: targetCompany }), timeout: 18000 });
   if (!result || result.mode === 'local-demo') setSystemStatus(result?.notice || 'Local demo intelligence · no live AI provider is active', 'demo');
   else setSystemStatus('Live interview provider connected', 'ready');
  const fallback = localInterviewFeedback(answer);
  const score = Number(result?.score || result?.rating || fallback.score);
  const title = responseText(result, ['title', 'headline']) || fallback.title;
  const message = responseText(result, ['feedback', 'advice', 'message', 'text']) || fallback.message;
  $('#interview-score').textContent = `${Math.min(100, score)}%`;
  $('#interview-feedback').innerHTML = `<span>●</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  setAvatarState(interviewAvatar, 'idle', `${personas.mentor.name} is ready`, 'Pick another scenario or try the answer again');
  speakText(`${title}. ${message}`, interviewAvatar, personas.mentor);
});

$('#interview-mic').addEventListener('click', event => {
  const button = event.currentTarget;
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    setSystemStatus('Voice input is not supported in this browser. Try Chrome or Edge, or type your answer.', 'error');
    return;
  }
  if (interviewRecognition) {
    setSystemStatus('Finishing your answer…', 'ready');
    interviewRecognition.stop();
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const activeRecognition = new Recognition();
  let recognitionFailed = false;
  interviewRecognition = activeRecognition;
  activeRecognition.lang = navigator.language || 'en-IN';
  activeRecognition.interimResults = true;
  activeRecognition.onresult = eventResult => {
    $('#interview-input').value = [...eventResult.results].map(result => result[0].transcript).join('');
  };
  activeRecognition.onerror = eventError => {
    if (interviewRecognition !== activeRecognition) return;
    recognitionFailed = true;
    setSystemStatus(speechErrorMessage(eventError.error), 'error');
  };
  activeRecognition.onend = () => {
    if (interviewRecognition !== activeRecognition) return;
    interviewRecognition = null;
    button.classList.remove('listening');
    button.textContent = 'Speak answer';
    button.setAttribute('aria-label', 'Record interview answer');
    const answer = $('#interview-input').value.trim();
    if (!recognitionFailed && answer) {
      setSystemStatus('Voice captured · getting your coach’s feedback…', 'ready');
      $('#interview-composer').requestSubmit();
    } else if (!recognitionFailed) {
      setSystemStatus('No speech was captured. Check your microphone and try again.', 'error');
      setAvatarState(interviewAvatar, 'idle', `${personas.mentor.name} is ready`, 'No voice was captured');
    } else {
      setAvatarState(interviewAvatar, 'idle', `${personas.mentor.name} is ready`, 'Check microphone permissions and try again');
    }
  };
  button.classList.add('listening');
  button.textContent = 'Stop listening';
  button.setAttribute('aria-label', 'Stop recording and get feedback');
  setAvatarState(interviewAvatar, 'listening', `${personas.mentor.name} is listening`, 'Speak naturally, then stop to get feedback');
  try {
    activeRecognition.start();
  } catch (error) {
    interviewRecognition = null;
    button.classList.remove('listening');
    button.textContent = 'Speak answer';
    button.setAttribute('aria-label', 'Record interview answer');
    setSystemStatus(`Could not start voice input: ${error instanceof Error ? error.message : 'check microphone permissions.'}`, 'error');
    setAvatarState(interviewAvatar, 'idle', `${personas.mentor.name} is ready`, 'Check microphone permissions and try again');
  }
});

function startInterviewTimer() {
  if (interviewTimer) return;
  interviewStartedAt = Date.now();
  interviewTimer = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - interviewStartedAt) / 1000);
    $('#question-timer').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  }, 1000);
}

const thoughtInput = $('#thought-input');
const localThought = localStorage.getItem('mindmesh-thought');
if (localThought) { thoughtInput.value = localThought; $('#char-count').textContent = `${localThought.length} / 180`; }
thoughtInput.addEventListener('input', event => { $('#char-count').textContent = `${event.target.value.length} / 180`; });
$('#save-thought').addEventListener('click', async () => {
  const text = thoughtInput.value.trim();
  const note = $('#saved-note');
  if (!text) { note.textContent = 'Write a thought before saving.'; note.style.color = 'var(--coral-dark)'; thoughtInput.focus(); return; }
  localStorage.setItem('mindmesh-thought', text);
    const result = await apiRequest('/api/thoughts', jsonOptions({ userId: currentUserId(), text }));
   note.style.color = result ? '#4e8479' : 'var(--coral-dark)';
   note.textContent = result ? (result.mode === 'local-demo' ? 'Saved to local demo store · synced just now' : 'Saved to your constellation · synced just now') : 'Saved locally · ready to sync when you reconnect';
   setSystemStatus(result ? 'Thought saved · local demo store' : 'Thought saved locally · ready to sync when you reconnect', result ? 'demo' : 'offline');
  $('#save-thought').innerHTML = 'Saved <span>✓</span>';
});

$$('.node').forEach(node => node.addEventListener('click', () => { if (node.dataset.node) { $('#message-input').value = `Tell me more about ${node.dataset.node.toLowerCase()}.`; $('#message-input').focus(); } }));

 async function loadRemoteThought() {
    const data = await apiRequest(`/api/thoughts/${encodeURIComponent(currentUserId())}`, { method: 'GET' });
  const items = Array.isArray(data) ? data : data?.thoughts || data?.items || (data?.thought ? [data] : []);
  const latest = items[items.length - 1];
  const text = typeof latest === 'string' ? latest : latest?.thought || latest?.text;
  if (text && !thoughtInput.value) { thoughtInput.value = text; $('#char-count').textContent = `${text.length} / 180`; }
}

async function loadRemoteAvatars() {
  const data = await apiRequest('/api/avatars', { method: 'GET' });
  const items = Array.isArray(data) ? data : data?.avatars || data?.items || [];
  items.forEach(item => {
    const id = personaFromId(item.id || item.role || item.name);
    const saved = appState.avatarPersonalizations[item.id] || appState.avatarPersonalizations[personas[id]?.id];
    personas[id] = { ...personas[id], ...item, id: personas[id].id, shortName: saved?.displayName || item.shortName || personas[id].shortName, role: item.role || personas[id].role, name: saved?.displayName || item.name || personas[id].name, description: item.description || personas[id].description };
  });
  updatePersonaCopy(activePersona());
}

function getSupabaseClientConfig() {
  const config = window.MINDMESH_SUPABASE || window.__MINDMESH_SUPABASE__ || {};
  const url = String(config.url || config.supabaseUrl || '').trim().replace(/\/+$/, '');
  const anonKey = String(config.anonKey || config.publicAnonKey || '').trim();
  return url && anonKey ? { url, anonKey } : null;
}

function updateAuthSetupNotice() {
  const notice = $('#auth-setup-notice');
  if (!notice) return;
  const configured = Boolean(getSupabaseClientConfig());
  notice.hidden = configured;
  if (configured) notice.innerHTML = '<strong>Supabase client ready</strong><p>Your public client settings are available. Guest mode remains available if you prefer to keep this device local.</p>';
}

function setAuthMode(mode) {
  appState.authMode = mode === 'register' ? 'register' : 'signin';
  const register = appState.authMode === 'register';
  $('#auth-title').textContent = register ? 'Create room for your signal.' : 'Come back to your signal.';
  $('#auth-submit').innerHTML = `${register ? 'Create account' : 'Sign in'} <span>↗</span>`;
  $('#auth-password').autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-name-field').hidden = !register;
  $$('.auth-tab').forEach(tab => {
    const selected = tab.dataset.authMode === appState.authMode;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  setAuthStatus('');
}

function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  const firstField = $('input, select, button:not(.modal-close)', modal);
  firstField?.focus();
  if (id === 'auth-modal') updateAuthSetupNotice();
}

function closeModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.hidden = true;
  if (!$$('.modal-backdrop:not([hidden])').length) document.body.classList.remove('modal-open');
}

async function supabaseAuth(mode, email, password, displayName) {
  if (appState.offlineOnly) throw new Error('Offline-only mode is enabled. Turn it off in Settings to connect Supabase.');
  const config = getSupabaseClientConfig();
  if (!config) throw new Error('Supabase setup required: add the public client URL and anon key before signing in.');
  const endpoint = mode === 'register' ? `${config.url}/auth/v1/signup` : `${config.url}/auth/v1/token?grant_type=password`;
  const body = mode === 'register'
    ? { email, password, data: displayName ? { display_name: displayName } : undefined }
    : { email, password };
  const response = await fetch(endpoint, { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let payload = {};
  try { payload = await response.json(); } catch (error) { payload = {}; }
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Supabase could not complete that request.');
  return payload;
}

async function loadAuthenticatedUser() {
  if (!appState.authToken) { updateProfileSurface(); return; }
  const result = await apiRequest('/api/auth/me', { method: 'GET' });
  if (result?.user) {
    appState.authUser = result.user;
    switchConversationOwner();
    updateProfileSurface();
    setSystemStatus('Signed in · private profile connected', 'ready');
    loadAuthenticatedPreferences();
    loadAvatarPersonalizations();
    return;
  }
  const config = getSupabaseClientConfig();
  if (config && !appState.offlineOnly) {
    try {
      const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${appState.authToken}` } });
      if (response.ok) {
        appState.authUser = await response.json();
        switchConversationOwner();
        updateProfileSurface();
        setSystemStatus('Signed in · Supabase session active', 'ready');
        loadAuthenticatedPreferences();
        loadAvatarPersonalizations();
        return;
      }
    } catch (error) { /* Keep the guest surface available when Supabase is unreachable. */ }
  }
  appState.authToken = null;
  appState.authUser = null;
  storage.remove('mindmesh-auth-token');
  switchConversationOwner();
  updateProfileSurface();
}

async function loadAuthenticatedPreferences() {
  const data = await apiRequest('/api/preferences', { method: 'GET' });
  const theme = data?.preferences?.theme;
  if (theme && ['system', 'light', 'dark'].includes(theme)) setTheme(theme, { persist: true, sync: false });
}

$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const displayName = $('#auth-name').value.trim();
  if (!email || !password || (appState.authMode === 'register' && !displayName)) {
    setAuthStatus(appState.authMode === 'register' ? 'Add your name, email, and password to continue.' : 'Add your email and password to continue.', 'error');
    return;
  }
  const submit = $('#auth-submit');
  submit.disabled = true;
  submit.classList.add('is-loading');
  setAuthStatus('Connecting to Supabase…', 'loading');
  try {
    const session = await supabaseAuth(appState.authMode, email, password, displayName);
    if (!session.access_token) {
      setAuthStatus('Account created. Check your email if confirmation is enabled, then sign in.', 'success');
      if (appState.authMode === 'register') setAuthMode('signin');
      return;
    }
    appState.authToken = session.access_token;
    appState.authUser = session.user || null;
    storage.set('mindmesh-auth-token', session.access_token);
    switchConversationOwner();
    updateProfileSurface();
    setAuthStatus('You are signed in. Your private room is ready.', 'success');
    setSystemStatus('Signed in · Supabase session active', 'ready');
    loadAvatarPersonalizations();
    window.setTimeout(() => closeModal('auth-modal'), 700);
  } catch (error) {
    setAuthStatus(error.message || 'Could not connect. Guest mode is still available.', 'error');
  } finally {
    submit.disabled = false;
    submit.classList.remove('is-loading');
  }
});

function signOutToGuest() {
  appState.authToken = null;
  appState.authUser = null;
  storage.remove('mindmesh-auth-token');
  switchConversationOwner();
  updateProfileSurface();
  setAuthStatus('You are using guest mode. Progress stays on this browser.', 'success');
  setSystemStatus('Guest mode · local progress', 'offline');
}

$$('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
$$('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
$('#profile-trigger').addEventListener('click', () => { openModal('auth-modal'); if (appState.authUser) setAuthStatus(`Signed in as ${appState.authUser.email || 'your account'}.`, 'success'); });
$('#top-auth-trigger').addEventListener('click', () => openModal('auth-modal'));
$('#continue-guest').addEventListener('click', () => { signOutToGuest(); closeModal('auth-modal'); });

$('#settings-trigger').addEventListener('click', () => openModal('settings-modal'));
$('#theme-select').addEventListener('change', event => setTheme(event.target.value));
[['reduce-motion', 'reduce-motion'], ['larger-text', 'larger-text'], ['high-contrast', 'high-contrast']].forEach(([id, name]) => $(`#${id}`).addEventListener('change', event => setAccessibilityPreference(name, event.target.checked)));
$('#offline-only').checked = appState.offlineOnly;
$('#offline-only').addEventListener('change', event => {
  appState.offlineOnly = event.target.checked;
  storage.set('mindmesh-offline-only', String(appState.offlineOnly));
  setSystemStatus(appState.offlineOnly ? 'Offline-only mode · local progress' : 'Online checks enabled · local data remains available', appState.offlineOnly ? 'offline' : 'ready');
  $('#settings-note').textContent = appState.offlineOnly ? 'Network calls are paused until you turn this off.' : 'Network calls are available when the studio is reachable.';
});
$('#clear-local-data').addEventListener('click', () => {
  storage.remove('mindmesh-thought');
  storage.remove('mindmesh-missions');
  storage.remove('mindmesh-guest-id');
  $('#thought-input').value = '';
  $('#char-count').textContent = '0 / 180';
  $('#saved-note').textContent = 'Guest thought and quest data cleared from this device.';
  missions = defaultMissions.map(mission => ({ ...mission, completed: false }));
  renderMissions();
  $('#settings-note').textContent = 'Guest data cleared. Your appearance preferences remain.';
});
$('#save-onboarding').addEventListener('click', async () => {
  const status = $('#onboarding-status');
  const saved = await saveAvatarPersonalizations($('#onboarding-avatars'), status);
  if (saved) {
    $('#avatar-onboarding').hidden = true;
    document.body.classList.remove('modal-open');
    setSystemStatus('Your human circle is ready', 'ready');
  }
});
$('#save-avatar-settings').addEventListener('click', async () => {
  await saveAvatarPersonalizations($('#avatar-settings-list'), $('#avatar-settings-status'));
});
$('#status-dismiss').addEventListener('click', () => { $('#app-status').hidden = true; });
$('#notification-trigger').addEventListener('click', () => setSystemStatus('No new notifications · local changes are saved', 'ready'));
$('#search-trigger').addEventListener('click', () => { setSystemStatus('Use the sidebar to move between your rooms', 'ready'); $('.nav-item')?.focus(); });

function missionListFromStorage() {
  let saved = [];
  try { saved = JSON.parse(storage.get('mindmesh-missions', '[]') || '[]'); } catch (error) { saved = []; }
  const savedById = new Map(Array.isArray(saved) ? saved.map(item => [item.id, item]) : []);
  return defaultMissions.map(mission => ({ ...mission, ...(savedById.get(mission.id) || {}), completed: Boolean(savedById.get(mission.id)?.completed) }));
}

function persistMissions() { storage.set('mindmesh-missions', JSON.stringify(missions)); }

function normaliseMissions(data) {
  const remote = Array.isArray(data) ? data : data?.missions || data?.items || data?.quests;
  if (!Array.isArray(remote) || !remote.length) return null;
  const localById = new Map(missionListFromStorage().map(mission => [mission.id, mission]));
  return remote.map((mission, index) => {
    const id = String(mission.id || mission.slug || `remote-${index + 1}`);
    const local = localById.get(id);
    return { id, title: String(mission.title || mission.name || `Mission ${index + 1}`), description: String(mission.description || mission.prompt || 'A small experiment for your next signal.'), tag: String(mission.tag || mission.category || 'Explore'), points: Number(mission.points || mission.reward || 10), completed: Boolean(mission.completed ?? mission.isCompleted ?? local?.completed) };
  });
}

function renderMissions() {
  const list = $('#mission-list');
  if (!list) return;
  const empty = $('#mission-empty');
  const hasMissions = missions.length > 0;
  empty.hidden = hasMissions;
  list.innerHTML = hasMissions ? missions.map(mission => `<article class="mission-card ${mission.completed ? 'is-complete' : ''}" data-mission="${escapeHtml(mission.id)}"><div class="mission-marker">${mission.completed ? '✓' : '✦'}</div><div class="mission-copy"><span class="mission-tag">${escapeHtml(mission.tag)} · ${mission.points} pts</span><h2>${escapeHtml(mission.title)}</h2><p>${escapeHtml(mission.description)}</p></div><button class="mission-toggle" type="button" data-mission-toggle="${escapeHtml(mission.id)}" aria-pressed="${String(mission.completed)}">${mission.completed ? 'Completed' : 'Complete'} <span>${mission.completed ? '✓' : '→'}</span></button></article>`).join('') : '';
  const completed = missions.filter(mission => mission.completed).length;
  $('#quest-progress-label').textContent = `${completed} of ${missions.length} complete`;
  $('#quest-progress-bar').style.width = missions.length ? `${Math.round(completed / missions.length * 100)}%` : '0%';
  $('#quest-stat-count').textContent = String(missions.length).padStart(2, '0');
  $('#quest-stat-progress').style.width = missions.length ? `${Math.round(completed / missions.length * 100)}%` : '0%';
  $$('[data-mission-toggle]', list).forEach(button => button.addEventListener('click', () => toggleMission(button.dataset.missionToggle)));
}

async function syncMissionCompletion(mission) {
  if (appState.offlineOnly) return false;
  const payload = { completed: mission.completed, userId: currentUserId() };
  const endpoints = [`/api/missions/${encodeURIComponent(mission.id)}/complete`, `/api/missions/${encodeURIComponent(mission.id)}/completion`];
  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint, jsonOptions(payload));
    if (result) return true;
  }
  return false;
}

async function toggleMission(id) {
  const mission = missions.find(item => item.id === id);
  if (!mission) return;
  mission.completed = !mission.completed;
  mission.completedAt = mission.completed ? new Date().toISOString() : null;
  persistMissions();
  renderMissions();
  $('#quest-sync-status').textContent = 'Saving locally…';
  const synced = await syncMissionCompletion(mission);
  missionSource = synced ? 'remote' : 'local';
  $('#quest-sync-status').textContent = synced ? 'Saved to your missions · synced just now' : (appState.offlineOnly ? 'Saved locally · offline-only mode' : 'Saved locally · mission API unavailable');
}

async function loadMissions() {
  missions = missionListFromStorage();
  missionSource = 'local';
  renderMissions();
  $('#quest-sync-status').textContent = appState.offlineOnly ? 'Local quest board · offline-only mode' : 'Loading mission sync…';
  const data = await apiRequest('/api/missions', { method: 'GET' });
  const remote = normaliseMissions(data);
  if (remote) {
    missions = remote;
    missionSource = 'remote';
    persistMissions();
    renderMissions();
    $('#quest-sync-status').textContent = 'Mission board synced just now';
  } else {
    $('#quest-sync-status').textContent = appState.offlineOnly || !navigator.onLine ? 'Saved locally · offline fallback' : 'Saved locally · mission API unavailable';
  }
}

$('#refresh-quests').addEventListener('click', async () => {
  $('#refresh-quests').disabled = true;
  $('#quest-sync-status').textContent = 'Refreshing mission board…';
  await loadMissions();
  $('#refresh-quests').disabled = false;
});

async function loadHealth() {
  if (appState.offlineOnly) {
    appState.connection = 'offline';
    appState.apiMode = 'offline-only';
    setSystemStatus('Offline-only mode · local demo intelligence', 'offline');
    $('#council-mode').textContent = 'OFFLINE';
    return;
  }
  const data = await apiRequest('/api/health', { method: 'GET', timeout: 4000 });
  if (!data) {
    appState.connection = 'offline';
    appState.apiMode = 'offline';
    setSystemStatus('Offline · local progress is available', 'offline');
    $('#council-mode').textContent = 'OFFLINE';
    return;
  }
  appState.connection = 'online';
  appState.apiMode = data.mode || 'local-demo';
  if (data.mode === 'local-demo') {
    setSystemStatus('Connected · local demo intelligence (AI provider not configured)', 'demo');
    $('#council-mode').textContent = 'LOCAL DEMO';
  } else {
    setSystemStatus('Connected · optional AI provider enabled', 'ready');
    $('#council-mode').textContent = 'PROVIDER READY';
  }
  updateAuthSetupNotice();
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }

hydratePortraits();
setActivePersona('challenger');
updateInterviewContext();
updateProfileSurface();
updateAuthSetupNotice();
loadRemoteThought();
loadRemoteAvatars();
loadHealth();
loadAuthenticatedUser();
loadMissions();
loadAvatarPersonalizations();

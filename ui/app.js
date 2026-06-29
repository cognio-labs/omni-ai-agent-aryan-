
const state = {
  currentConversationId: null,
  currentAgentId: null,
  agents: [],
  conversations: [],
  isStreaming: false,
  abortController: null,
  pendingFiles: [],
  speechRecognition: null,
  agentPanelOpen: false,
  sidebarOpen: window.innerWidth > 920,
  theme: localStorage.getItem('omniclient-theme') || 'light',
  searchEnabled: false,
  thinkingEnabled: true,
  memoryEnabled: true,
};

const $ = (id) => document.getElementById(id);
const agentModes = ['General', 'Developer', 'Designer', 'Marketing', 'SEO', 'Research', 'Finance', 'Support', 'Automation', 'Legal', 'HR'];
const searchSteps = ['Searching Web...', 'Reading Documentation...', 'Analyzing Sources...', 'Summarizing...', 'Generating Answer...'];
const thinkingSteps = ['Searching...', 'Reading files...', 'Using memory...', 'Reasoning...', 'Generating response...'];

window.addEventListener('DOMContentLoaded', init);

async function init() {
  applyTheme(state.theme);
  configureMarkdown();
  if (window.mermaid) mermaid.initialize({ startOnLoad: false, theme: state.theme === 'dark' ? 'dark' : 'default' });
  await loadAgents();
  await loadConversations();
  setupEventListeners();
  renderAgentChips();
  showWelcomeScreen();
  setSidebar(state.sidebarOpen);
  refreshIcons();
}

function setupEventListeners() {
  $('sidebar-toggle')?.addEventListener('click', () => setSidebar(!state.sidebarOpen));
  $('mobile-sidebar-toggle')?.addEventListener('click', () => setSidebar(true));
  $('new-chat-btn')?.addEventListener('click', () => startNewChat());
  $('send-btn')?.addEventListener('click', () => state.isStreaming ? cancelStreaming() : sendMessage());
  $('message-input')?.addEventListener('keydown', handleComposerKeydown);
  $('message-input')?.addEventListener('input', autoResizeTextarea);
  $('file-upload-btn')?.addEventListener('click', () => $('file-input')?.click());
  $('file-input')?.addEventListener('change', handleFileSelection);
  $('voice-btn')?.addEventListener('click', toggleVoiceInput);
  $('theme-toggle-btn')?.addEventListener('click', toggleTheme);
  $('settings-theme-toggle')?.addEventListener('click', toggleTheme);
  $('agent-panel-btn')?.addEventListener('click', toggleAgentPanel);
  $('composer-agent-btn')?.addEventListener('click', toggleAgentPanel);
  $('close-panel-btn')?.addEventListener('click', closeAgentPanel);
  $('conv-search')?.addEventListener('input', (e) => renderConversationList(e.target.value));
  $('agent-select')?.addEventListener('change', (e) => selectAgent(Number(e.target.value)));
  $('temp-slider')?.addEventListener('input', (e) => $('temp-value').textContent = Number(e.target.value).toFixed(1));
  $('save-agent-settings-btn')?.addEventListener('click', saveAgentSettings);
  $('deploy-guide-btn')?.addEventListener('click', generateDeployGuide);
  $('load-memory-btn')?.addEventListener('click', loadMemoryPanel);
  $('add-memory-btn')?.addEventListener('click', addMemoryEntry);
  $('export-btn')?.addEventListener('click', exportConversation);
  $('share-btn')?.addEventListener('click', shareConversation);
  $('rename-btn')?.addEventListener('click', renameConversation);
  $('settings-btn')?.addEventListener('click', () => openModal('settings-modal'));
  $('new-agent-btn')?.addEventListener('click', openNewAgentModal);
  $('open-command-btn')?.addEventListener('click', openCommandPalette);
  $('command-input')?.addEventListener('input', renderCommandResults);
  $('composer-search-btn')?.addEventListener('click', () => toggleFeature('search'));
  $('search-toggle-btn')?.addEventListener('click', () => toggleFeature('search'));
  $('composer-thinking-btn')?.addEventListener('click', () => toggleFeature('thinking'));
  $('thinking-toggle-btn')?.addEventListener('click', () => toggleFeature('thinking'));
  $('memory-toggle-btn')?.addEventListener('click', () => toggleFeature('memory'));
  $('thinking-collapse-btn')?.addEventListener('click', () => $('thinking-strip')?.classList.toggle('collapsed'));
  $('close-settings-btn')?.addEventListener('click', () => closeModal('settings-modal'));
  $('close-settings-btn-2')?.addEventListener('click', () => closeModal('settings-modal'));
  $('save-settings-btn')?.addEventListener('click', saveSettings);
  $('reset-memory-btn')?.addEventListener('click', resetMemory);
  $('close-db-modal-btn')?.addEventListener('click', () => closeModal('db-modal'));
  $('run-query-btn')?.addEventListener('click', runDbQuery);
  $('export-csv-btn')?.addEventListener('click', exportQueryCSV);
  $('db-shortcut-btn')?.addEventListener('click', () => { closeModal('settings-modal'); openModal('db-modal'); });
  $('close-agent-modal-btn')?.addEventListener('click', () => closeModal('new-agent-modal'));
  $('wizard-next-btn')?.addEventListener('click', wizardNext);
  $('wizard-back-btn')?.addEventListener('click', wizardBack);
  document.querySelectorAll('.suggestion-card').forEach((card) => card.addEventListener('click', () => startNewChat(null, card.dataset.prompt || '')));
  document.querySelectorAll('.cap-chip').forEach((chip) => chip.addEventListener('click', () => chip.classList.toggle('selected')));
  document.querySelectorAll('.settings-tab').forEach((tab) => tab.addEventListener('click', () => activateSettingsTab(tab.dataset.tab)));
  document.addEventListener('keydown', handleGlobalKeys);
  document.addEventListener('click', closeOnOverlayClick);
  setupDropZone();
}

function refreshIcons() { if (window.lucide) lucide.createIcons(); }
function setSidebar(open) { state.sidebarOpen = open; $('sidebar')?.classList.toggle('collapsed', !open); }
function applyTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  state.theme = normalized;
  document.documentElement.dataset.theme = normalized;
  localStorage.setItem('omniclient-theme', normalized);
  const btn = $('theme-toggle-btn');
  if (btn) btn.innerHTML = `<i data-lucide="${normalized === 'dark' ? 'sun' : 'moon'}"></i>`;
  if (window.mermaid) mermaid.initialize({ startOnLoad: false, theme: normalized === 'dark' ? 'dark' : 'default' });
  refreshIcons();
}
function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); }
function configureMarkdown() { if (window.marked) marked.setOptions({ gfm: true, breaks: true, mangle: false, headerIds: false }); }

async function loadConversations() {
  try {
    const res = await fetch('/api/conversations');
    state.conversations = await res.json();
    renderConversationList($('conv-search')?.value || '');
  } catch { showToast('Failed to load conversations', 'error'); }
}

function renderConversationList(filter = '') {
  const term = filter.toLowerCase();
  const conversations = state.conversations.filter((c) => (c.title || '').toLowerCase().includes(term));
  renderConversationBucket('pinned-list', conversations.filter((c) => c.pinned), 'No pinned chats yet.');
  renderConversationBucket('conversations-list', conversations.filter((c) => !c.pinned), 'Start a new conversation.');
}

function renderConversationBucket(id, conversations, emptyText) {
  const list = $(id);
  if (!list) return;
  if (!conversations.length) {
    list.innerHTML = `<div class="sidebar-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  list.innerHTML = conversations.map(convHtml).join('');
  list.querySelectorAll('.conversation-item').forEach((item) => item.addEventListener('click', (e) => {
    if (e.target.closest('.conv-actions')) return;
    loadConversation(Number(item.dataset.id));
  }));
  list.querySelectorAll('.conv-pin-btn').forEach((btn) => btn.addEventListener('click', togglePinConversation));
  list.querySelectorAll('.conv-delete-btn').forEach((btn) => btn.addEventListener('click', deleteConversation));
  refreshIcons();
}

function convHtml(c) {
  return `<div class="conversation-item ${c.id === state.currentConversationId ? 'active' : ''}" data-id="${c.id}">
    <i data-lucide="message-square"></i><span class="conv-title">${escapeHtml(c.title || 'New Conversation')}</span>
    <span class="conv-actions">
      <button class="conv-action-btn conv-pin-btn" data-id="${c.id}" title="${c.pinned ? 'Unpin' : 'Pin'}" aria-label="${c.pinned ? 'Unpin' : 'Pin'}"><i data-lucide="${c.pinned ? 'pin-off' : 'pin'}"></i></button>
      <button class="conv-action-btn conv-delete-btn danger" data-id="${c.id}" title="Delete" aria-label="Delete"><i data-lucide="trash-2"></i></button>
    </span>
  </div>`;
}

async function togglePinConversation(e) {
  e.stopPropagation();
  const id = Number(e.currentTarget.dataset.id);
  const conv = state.conversations.find((c) => c.id === id);
  await fetch(`/api/conversations/${id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ pinned: !conv?.pinned }) });
  await loadConversations();
}

async function deleteConversation(e) {
  e.stopPropagation();
  const id = Number(e.currentTarget.dataset.id);
  if (!confirm('Delete this conversation?')) return;
  await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
  if (state.currentConversationId === id) { state.currentConversationId = null; showWelcomeScreen(); }
  await loadConversations();
  showToast('Conversation deleted', 'success');
}

async function loadConversation(id) {
  state.currentConversationId = id;
  try {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    $('chat-title').textContent = data.title || 'Conversation';
    $('welcome-screen').classList.add('hidden');
    $('messages-container').classList.remove('hidden');
    $('messages-container').innerHTML = '';
    for (const msg of data.messages || []) appendMessage(msg.role, msg.content, msg.id, msg.bookmarked);
    await loadConversations();
    if (state.agentPanelOpen) loadMemoryPanel();
    scrollToBottom(true);
  } catch { showToast('Failed to load conversation', 'error'); }
}

function startNewChat(_event = null, prefillMessage = '') {
  state.currentConversationId = null;
  $('chat-title').textContent = 'New Conversation';
  $('messages-container').innerHTML = '';
  if (prefillMessage) {
    $('welcome-screen').classList.add('hidden');
    $('messages-container').classList.remove('hidden');
  } else {
    $('welcome-screen').classList.remove('hidden');
    $('messages-container').classList.add('hidden');
  }
  renderConversationList($('conv-search')?.value || '');
  $('message-input').value = prefillMessage;
  autoResizeTextarea();
  $('message-input').focus();
  if (window.innerWidth <= 920) setSidebar(false);
}

function showWelcomeScreen() {
  $('welcome-screen').classList.remove('hidden');
  $('messages-container').classList.add('hidden');
  $('chat-title').textContent = 'New Conversation';
}

async function loadAgents() {
  try {
    const res = await fetch('/api/agents');
    const data = await res.json();
    state.agents = Array.isArray(data) ? data : (data.agents || []);
  } catch { state.agents = [{ id: 1, name: 'OmniClient', description: 'General AI Assistant' }]; }
  if (!state.currentAgentId && state.agents.length) state.currentAgentId = (state.agents.find((a) => /omniclient/i.test(a.name || '')) || state.agents[0]).id;
  renderAgentSelector();
  renderAgentChips();
}

function renderAgentSelector() {
  const select = $('agent-select');
  if (!select) return;
  select.innerHTML = state.agents.map((a) => `<option value="${a.id}">${escapeHtml(a.name || 'Agent')}</option>`).join('');
  if (state.currentAgentId) select.value = String(state.currentAgentId);
  updateAgentCaptions();
}

function renderAgentChips() {
  const row = $('agent-chip-row');
  if (!row) return;
  row.innerHTML = agentModes.map((mode, index) => `<button class="agent-chip ${index === 0 ? 'active' : ''}" type="button" data-mode="${mode}"><i data-lucide="${agentIcon(mode)}"></i>${mode}</button>`).join('');
  row.querySelectorAll('.agent-chip').forEach((chip) => chip.addEventListener('click', () => {
    row.querySelectorAll('.agent-chip').forEach((el) => el.classList.remove('active'));
    chip.classList.add('active');
    showToast(`${chip.dataset.mode} agent mode selected`, 'info');
  }));
  refreshIcons();
}

function agentIcon(mode) {
  return ({ Developer: 'code-2', Research: 'book-open-search', Designer: 'pen-tool', Marketing: 'megaphone', Automation: 'workflow', Finance: 'chart-no-axes-combined', SEO: 'search-check', Support: 'headphones', Legal: 'scale', HR: 'contact-round' })[mode] || 'sparkles';
}
function selectAgent(id) { state.currentAgentId = id; updateAgentCaptions(); if (state.agentPanelOpen) updateAgentPanel(); }
function getCurrentAgent() { return state.agents.find((a) => a.id === state.currentAgentId) || state.agents[0]; }
function updateAgentCaptions() {
  const agent = getCurrentAgent();
  if (!agent) return;
  $('composer-agent-label').textContent = agent.name || 'Agent';
  $('model-caption').textContent = `${agent.name || 'Agent'}${agent.model ? ` - ${agent.model}` : ' - adaptive routing'}`;
}
function handleComposerKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

async function sendMessage() {
  const input = $('message-input');
  const message = input.value.trim();
  if (!message || state.isStreaming) return;
  input.value = '';
  autoResizeTextarea();
  $('welcome-screen').classList.add('hidden');
  $('messages-container').classList.remove('hidden');
  appendMessage('user', message);
  setStreamingUi(true);
  renderThinkingSteps(state.searchEnabled ? searchSteps : thinkingSteps);
  const skeletonId = showSkeleton();
  state.abortController = new AbortController();
  let assistantEl = null;
  let rawContent = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      signal: state.abortController.signal,
      body: JSON.stringify({ message, conversation_id: state.currentConversationId, agent_id: state.currentAgentId }),
    });
    removeElement(skeletonId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    if (!res.body) throw new Error('Streaming is not available in this browser.');
    assistantEl = appendMessage('assistant', '', null, false, true);
    const contentEl = assistantEl.querySelector('.message-content');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const eventText of events) {
        const payload = parseSsePayload(eventText);
        if (!payload) continue;
        if (payload.type === 'meta') state.currentConversationId = payload.conversation_id;
        if (payload.type === 'token') {
          rawContent += cleanDisplayContent(payload.content || '');
          renderMessageContent(contentEl, rawContent);
          scrollToBottom();
        }
      }
    }
    if (!rawContent.trim()) {
      assistantEl?.remove();
      appendMessage('assistant', '**No response returned.** Please check the active model and API configuration.');
    } else {
      assistantEl.classList.remove('streaming');
      assistantEl.querySelector('.stream-cursor')?.remove();
      await enhanceMarkdown(assistantEl);
    }
    await loadConversations();
  } catch (error) {
    removeElement(skeletonId);
    if (assistantEl && !rawContent.trim()) assistantEl.remove();
    const msg = error.name === 'AbortError' ? 'Generation cancelled.' : `**Connection error:** ${error.message}`;
    appendMessage('assistant', msg);
    showToast(error.name === 'AbortError' ? 'Generation cancelled' : error.message, error.name === 'AbortError' ? 'warning' : 'error');
  } finally {
    setStreamingUi(false);
    state.abortController = null;
    state.pendingFiles = [];
    renderFilePreview();
    scrollToBottom();
  }
}

function parseSsePayload(eventText) {
  const data = eventText.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
  if (!data || data === '[DONE]') return null;
  try { return JSON.parse(data); } catch { return null; }
}

function setStreamingUi(isStreaming) {
  state.isStreaming = isStreaming;
  $('send-btn').classList.toggle('is-generating', isStreaming);
  $('send-btn').innerHTML = `<i data-lucide="${isStreaming ? 'square' : 'send'}"></i>`;
  $('thinking-strip').classList.toggle('hidden', !isStreaming || !state.thinkingEnabled);
  refreshIcons();
}
function cancelStreaming() { state.abortController?.abort(); }
function renderThinkingSteps(steps) { $('thinking-steps').innerHTML = steps.map((step) => `<div class="thinking-step"><span></span>${escapeHtml(step)}</div>`).join(''); }
function showSkeleton() {
  const id = `skeleton-${Date.now()}`;
  const el = document.createElement('div');
  el.id = id;
  el.className = 'skeleton-message';
  el.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div>';
  $('messages-container').appendChild(el);
  scrollToBottom(true);
  return id;
}
function removeElement(id) { const el = $(id); if (el) el.remove(); }

function appendMessage(role, content, msgId = null, bookmarked = false, streaming = false) {
  const wrapper = document.createElement('article');
  wrapper.className = `message-wrapper ${role}${streaming ? ' streaming' : ''}`;
  if (msgId) wrapper.dataset.msgId = msgId;
  const isUser = role === 'user';
  wrapper.innerHTML = `<div class="message-meta"><span class="message-role"><i data-lucide="${isUser ? 'user' : 'sparkles'}"></i>${isUser ? 'You' : 'OmniClient'}</span><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><div class="message-bubble ${isUser ? 'user' : 'assistant'}"><div class="message-content"></div>${streaming ? '<span class="stream-cursor"></span>' : ''}</div><div class="message-actions">${!isUser ? '<button class="msg-action-btn regen-btn" type="button"><i data-lucide="rotate-ccw"></i>Regenerate</button>' : ''}${msgId ? `<button class="msg-action-btn bookmark-btn ${bookmarked ? 'bookmarked' : ''}" data-id="${msgId}" type="button"><i data-lucide="bookmark"></i>${bookmarked ? 'Bookmarked' : 'Bookmark'}</button><button class="msg-action-btn delete-msg-btn" data-id="${msgId}" type="button"><i data-lucide="trash-2"></i>Delete</button>` : ''}<button class="msg-action-btn copy-msg-btn" type="button"><i data-lucide="copy"></i>Copy</button></div>`;
  $('messages-container').appendChild(wrapper);
  renderMessageContent(wrapper.querySelector('.message-content'), cleanDisplayContent(content || ''));
  bindMessageActions(wrapper);
  refreshIcons();
  scrollToBottom();
  return wrapper;
}

function renderMessageContent(el, content) {
  if (!el) return;
  el.innerHTML = renderMarkdown(content || '');
  enhanceMarkdown(el.parentElement || el);
}

function renderMarkdown(text) {
  if (!text) return '';
  const blocks = [];
  let source = text.replace(/```mermaid\n([\s\S]*?)```/gi, (_, graph) => {
    const token = `@@BLOCK_${blocks.length}@@`;
    blocks.push(`<div class="mermaid">${escapeHtml(graph.trim())}</div>`);
    return token;
  });
  source = source.replace(/```([\w#+.-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const language = (lang || 'text').trim() || 'text';
    const token = `@@BLOCK_${blocks.length}@@`;
    blocks.push(`<div class="code-block-wrapper"><div class="code-block-header"><span>${escapeHtml(language)}</span><span class="code-actions"><button class="code-copy-btn" data-code="${encodeURIComponent(code.trim())}" type="button">Copy</button><button class="code-download-btn" data-lang="${escapeHtml(language)}" data-code="${encodeURIComponent(code.trim())}" type="button">Download</button></span></div><pre class="language-${escapeHtml(language)}"><code class="language-${escapeHtml(language)}">${escapeHtml(code.trim())}</code></pre></div>`);
    return token;
  });
  let html = window.marked ? marked.parse(source) : fallbackMarkdown(source);
  blocks.forEach((block, index) => { html = html.replace(`@@BLOCK_${index}@@`, block); });
  return html;
}

async function enhanceMarkdown(scope) {
  if (!scope) return;
  if (window.Prism) Prism.highlightAllUnder(scope);
  scope.querySelectorAll('.code-copy-btn').forEach((btn) => btn.onclick = () => {
    navigator.clipboard.writeText(decodeURIComponent(btn.dataset.code || ''));
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = 'Copy', 1400);
  });
  scope.querySelectorAll('.code-download-btn').forEach((btn) => btn.onclick = () => {
    const lang = (btn.dataset.lang || 'txt').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'txt';
    const extension = ({ javascript: 'js', typescript: 'ts', python: 'py', bash: 'sh', json: 'json', yaml: 'yml', sql: 'sql' })[lang] || 'txt';
    const blob = new Blob([decodeURIComponent(btn.dataset.code || '')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omniclient-code.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  });
  if (window.renderMathInElement) {
    try { renderMathInElement(scope, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] }); } catch {}
  }
  if (window.mermaid) {
    try { await mermaid.run({ nodes: scope.querySelectorAll('.mermaid') }); } catch {}
  }
}

function fallbackMarkdown(text) { return escapeHtml(text).split(/\n{2,}/).map((part) => `<p>${part.replace(/\n/g, '<br>')}</p>`).join(''); }

function bindMessageActions(wrapper) {
  wrapper.querySelector('.copy-msg-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(wrapper.querySelector('.message-content')?.innerText || '');
    showToast('Copied to clipboard', 'success');
  });
  wrapper.querySelector('.regen-btn')?.addEventListener('click', async () => {
    const prev = wrapper.previousElementSibling?.querySelector('.message-content')?.innerText;
    if (prev) { wrapper.remove(); $('message-input').value = prev; await sendMessage(); }
  });
  wrapper.querySelector('.bookmark-btn')?.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    const res = await fetch(`/api/messages/${id}/bookmark`, { method: 'PATCH' });
    const data = await res.json();
    e.currentTarget.classList.toggle('bookmarked', Boolean(data.bookmarked));
    e.currentTarget.innerHTML = `<i data-lucide="bookmark"></i>${data.bookmarked ? 'Bookmarked' : 'Bookmark'}`;
    refreshIcons();
  });
  wrapper.querySelector('.delete-msg-btn')?.addEventListener('click', async (e) => {
    if (!confirm('Delete this message?')) return;
    await fetch(`/api/messages/${e.currentTarget.dataset.id}`, { method: 'DELETE' });
    wrapper.remove();
  });
}

function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  state.pendingFiles = files.map((file) => ({ name: file.name, size: file.size, type: file.type || 'unknown' }));
  const summary = state.pendingFiles.map((file) => `${file.name} (${formatFileSize(file.size)})`).join(', ');
  const input = $('message-input');
  const note = `[Attached files: ${summary}]\n`;
  if (!input.value.includes(note)) input.value = note + input.value;
  renderFilePreview();
  autoResizeTextarea();
  showToast(`${files.length} file${files.length > 1 ? 's' : ''} attached`, 'success');
}
function renderFilePreview() {
  const row = $('file-preview-row');
  if (!row) return;
  row.classList.toggle('hidden', !state.pendingFiles.length);
  row.innerHTML = state.pendingFiles.map((file) => `<span class="file-chip"><i data-lucide="file"></i>${escapeHtml(file.name)}<small>${formatFileSize(file.size)}</small></span>`).join('');
  refreshIcons();
}
function formatFileSize(bytes) { if (!bytes) return '0 B'; const units = ['B','KB','MB','GB']; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`; }
function setupDropZone() {
  const shell = $('composer-shell');
  if (!shell) return;
  ['dragenter', 'dragover'].forEach((type) => shell.addEventListener(type, (e) => { e.preventDefault(); shell.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach((type) => shell.addEventListener(type, () => shell.classList.remove('drag-over')));
  shell.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files?.length) handleFileSelection({ target: { files: e.dataTransfer.files } }); });
  document.addEventListener('paste', (e) => { const files = Array.from(e.clipboardData?.files || []); if (files.length) handleFileSelection({ target: { files } }); });
}
function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return showToast('Voice input is not supported in this browser.', 'warning');
  if (state.speechRecognition) { state.speechRecognition.stop(); return; }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  state.speechRecognition = recognition;
  $('voice-btn')?.classList.add('recording');
  let base = $('message-input').value;
  recognition.onresult = (event) => {
    let text = '';
    for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0]?.transcript || '';
    $('message-input').value = `${base}${base ? ' ' : ''}${text}`;
    autoResizeTextarea();
  };
  recognition.onend = () => { state.speechRecognition = null; $('voice-btn')?.classList.remove('recording'); };
  recognition.start();
}
function toggleFeature(feature) {
  if (feature === 'search') state.searchEnabled = !state.searchEnabled;
  if (feature === 'thinking') state.thinkingEnabled = !state.thinkingEnabled;
  if (feature === 'memory') state.memoryEnabled = !state.memoryEnabled;
  syncFeatureButtons();
}
function syncFeatureButtons() {
  $('search-toggle-btn')?.classList.toggle('active', state.searchEnabled);
  $('composer-search-btn')?.classList.toggle('active', state.searchEnabled);
  $('thinking-toggle-btn')?.classList.toggle('active', state.thinkingEnabled);
  $('composer-thinking-btn')?.classList.toggle('active', state.thinkingEnabled);
  $('memory-toggle-btn')?.classList.toggle('active', state.memoryEnabled);
  $('search-toggle-btn')?.setAttribute('aria-pressed', String(state.searchEnabled));
  $('thinking-toggle-btn')?.setAttribute('aria-pressed', String(state.thinkingEnabled));
  $('memory-toggle-btn')?.setAttribute('aria-pressed', String(state.memoryEnabled));
}

function openCommandPalette() { $('command-overlay').classList.add('open'); $('command-input').value = ''; renderCommandResults(); setTimeout(() => $('command-input')?.focus(), 30); }
function closeCommandPalette() { $('command-overlay').classList.remove('open'); }
function renderCommandResults() {
  const q = ($('command-input')?.value || '').toLowerCase();
  const commands = [
    { icon: 'message-square', title: 'New Chat', action: () => startNewChat() },
    { icon: 'globe', title: 'Search Web', action: () => { if (!state.searchEnabled) toggleFeature('search'); $('message-input').focus(); } },
    { icon: 'database', title: 'Search Memory', action: () => { if (!state.memoryEnabled) toggleFeature('memory'); } },
    { icon: 'file-search', title: 'Search Files and PDFs', action: () => $('file-input').click() },
    { icon: 'github', title: 'Search GitHub', action: () => setPromptPrefix('GitHub: ') },
    { icon: 'youtube', title: 'Search YouTube', action: () => setPromptPrefix('YouTube: ') },
    { icon: 'book-open', title: 'Search Documentation', action: () => setPromptPrefix('Documentation: ') },
    ...state.conversations.map((c) => ({ icon: 'message-square', title: c.title || 'Conversation', action: () => loadConversation(c.id) })),
  ].filter((item) => item.title.toLowerCase().includes(q));
  $('command-status').textContent = q ? `Showing ${commands.length} result${commands.length === 1 ? '' : 's'}.` : 'Search chats, files, projects, memory, web, GitHub, YouTube, PDFs, and documentation.';
  $('command-results').innerHTML = commands.slice(0, 14).map((item, i) => `<div class="command-result" data-index="${i}"><i data-lucide="${item.icon}"></i><span>${escapeHtml(item.title)}</span></div>`).join('');
  $('command-results').querySelectorAll('.command-result').forEach((el) => el.addEventListener('click', () => { commands[Number(el.dataset.index)].action(); closeCommandPalette(); }));
  refreshIcons();
}
function setPromptPrefix(prefix) { $('message-input').value = prefix + $('message-input').value; $('message-input').focus(); }

function toggleAgentPanel() { state.agentPanelOpen = !state.agentPanelOpen; $('agent-panel').classList.toggle('open', state.agentPanelOpen); if (state.agentPanelOpen) updateAgentPanel(); }
function closeAgentPanel() { state.agentPanelOpen = false; $('agent-panel').classList.remove('open'); }
async function updateAgentPanel() {
  if (!state.currentAgentId) return;
  try {
    const res = await fetch(`/api/agents/${state.currentAgentId}`);
    const agent = await res.json();
    $('panel-agent-name').textContent = agent.name || 'Agent';
    $('panel-agent-model').textContent = agent.model || 'Adaptive model';
    $('panel-agent-avatar').textContent = (agent.name || 'O').charAt(0).toUpperCase();
    $('model-select').value = agent.model;
    $('temp-slider').value = agent.temperature ?? 0.7;
    $('temp-value').textContent = Number(agent.temperature ?? 0.7).toFixed(1);
    $('system-prompt-editor').value = agent.system_prompt || '';
    $('toggle-search').checked = Boolean(agent.enable_search);
    $('toggle-db').checked = Boolean(agent.enable_db_query);
    $('toggle-code').checked = Boolean(agent.enable_code_gen);
    if (state.currentConversationId) loadMemoryPanel();
  } catch {}
}
async function saveAgentSettings() {
  if (!state.currentAgentId) return;
  const payload = { model: $('model-select').value, temperature: Number($('temp-slider').value), system_prompt: $('system-prompt-editor').value, enable_search: $('toggle-search').checked, enable_db_query: $('toggle-db').checked, enable_code_gen: $('toggle-code').checked };
  const res = await fetch(`/api/agents/${state.currentAgentId}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
  showToast(res.ok ? 'Agent settings saved' : 'Failed to save agent settings', res.ok ? 'success' : 'error');
  await loadAgents();
}

async function loadMemoryPanel() {
  if (!state.currentConversationId) { $('memory-list').innerHTML = '<div class="sidebar-empty">Start a conversation to see memory.</div>'; return; }
  try {
    const res = await fetch(`/api/memory/${state.currentConversationId}`);
    const data = await res.json();
    renderMemoryList(data.memories || []);
  } catch { $('memory-list').innerHTML = '<div class="sidebar-empty">Failed to load memory.</div>'; }
}
function renderMemoryList(memories) {
  $('memory-list').innerHTML = memories.length ? memories.map((m) => `<div class="memory-item"><div class="memory-item-key">${escapeHtml(m.key)}</div><div class="memory-item-value">${escapeHtml(m.value)}</div><button class="memory-btn del" data-id="${m.id}" type="button"><i data-lucide="x"></i></button></div>`).join('') : '<div class="sidebar-empty">No memories stored yet.</div>';
  $('memory-list').querySelectorAll('.memory-btn.del').forEach((btn) => btn.addEventListener('click', async () => { await fetch(`/api/memory/entry/${btn.dataset.id}`, { method: 'DELETE' }); await loadMemoryPanel(); }));
  refreshIcons();
}
async function addMemoryEntry() {
  if (!state.currentConversationId) return showToast('Start a conversation first', 'warning');
  const key = prompt('Memory key');
  if (!key) return;
  const value = prompt('Memory value');
  if (!value) return;
  await fetch(`/api/memory/${state.currentConversationId}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ key, value, importance_score: 1.5 }) });
  await loadMemoryPanel();
}

async function generateDeployGuide() {
  const projectType = prompt('Project type, for example FastAPI, Next.js, or Django');
  if (!projectType) return;
  const res = await fetch('/api/deploy/guide', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ project_type: projectType, context: '' }) });
  const data = await res.json();
  if (!state.currentConversationId) startNewChat();
  appendMessage('assistant', data.guide || 'No guide returned.');
}

async function exportConversation() {
  if (!state.currentConversationId) return showToast('No active conversation', 'warning');
  const format = confirm('Export as Markdown? Cancel for JSON.') ? 'markdown' : 'json';
  const a = document.createElement('a');
  a.href = `/api/conversations/${state.currentConversationId}/export?fmt=${format}`;
  a.download = `conversation_${state.currentConversationId}.${format === 'markdown' ? 'md' : 'json'}`;
  a.click();
}
function shareConversation() { navigator.clipboard.writeText(location.href); showToast('Conversation link copied', 'success'); }
async function renameConversation() {
  if (!state.currentConversationId) return showToast('Start a conversation first', 'warning');
  const title = prompt('Conversation title', $('chat-title').textContent || 'New Conversation');
  if (!title) return;
  const res = await fetch(`/api/conversations/${state.currentConversationId}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title }) });
  if (res.ok) { $('chat-title').textContent = title; await loadConversations(); }
}

let wizardStep = 1;
function openNewAgentModal() { wizardStep = 1; updateWizard(); openModal('new-agent-modal'); }
function updateWizard() {
  for (let i = 1; i <= 3; i++) {
    $(`wizard-page-${i}`)?.classList.toggle('active', i === wizardStep);
    document.querySelector(`.wizard-step[data-step="${i}"]`)?.classList.toggle('active', i === wizardStep);
    document.querySelector(`.wizard-step[data-step="${i}"]`)?.classList.toggle('done', i < wizardStep);
  }
  $('wizard-back-btn').style.display = wizardStep === 1 ? 'none' : '';
  $('wizard-next-btn').textContent = wizardStep === 3 ? 'Create Agent' : 'Next';
}
async function wizardNext() {
  if (wizardStep < 3) { wizardStep += 1; updateWizard(); return; }
  const capabilities = Array.from(document.querySelectorAll('.cap-chip.selected')).map((chip) => chip.dataset.cap);
  const payload = { name: $('wizard-agent-name').value.trim(), description: $('wizard-agent-desc').value.trim(), purpose: $('wizard-agent-purpose').value.trim(), capabilities, tone: $('wizard-tone').value, model: $('wizard-model').value };
  if (!payload.name || !payload.purpose) return showToast('Agent name and purpose are required', 'warning');
  const res = await fetch('/api/agents', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
  if (!res.ok) return showToast('Failed to create agent', 'error');
  const agent = await res.json();
  closeModal('new-agent-modal');
  await loadAgents();
  selectAgent(agent.id);
  showToast('Agent created', 'success');
}
function wizardBack() { if (wizardStep > 1) { wizardStep -= 1; updateWizard(); } }

let lastQueryResults = null;
async function runDbQuery() {
  const sql = $('db-query-input').value.trim();
  if (!sql) return;
  const res = await fetch('/api/query-db', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sql }) });
  const data = await res.json();
  if (!res.ok) { $('db-results').innerHTML = `<div class="sidebar-empty">${escapeHtml(data.detail || 'Query failed')}</div>`; return; }
  lastQueryResults = data;
  $('db-row-count').textContent = `${data.row_count} rows`;
  $('export-csv-btn').classList.remove('hidden');
  if (!data.rows?.length) { $('db-results').innerHTML = '<div class="sidebar-empty">Query returned no rows.</div>'; return; }
  const head = `<tr>${data.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
  const rows = data.rows.map((row) => `<tr>${data.columns.map((c) => `<td>${escapeHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`).join('');
  $('db-results').innerHTML = `<table class="db-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
  $('query-explanation').textContent = `Read-only query executed: ${sql.slice(0, 140)}`;
}
function exportQueryCSV() {
  if (!lastQueryResults) return;
  const { columns, rows } = lastQueryResults;
  const csv = [columns.join(','), ...rows.map((row) => columns.map((c) => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = 'query-results.csv'; a.click(); URL.revokeObjectURL(url);
}

function openModal(id) { $(`${id}-overlay`)?.classList.add('open'); refreshIcons(); }
function closeModal(id) { $(`${id}-overlay`)?.classList.remove('open'); }
function closeOnOverlayClick(e) { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); if (e.target.id === 'command-overlay') closeCommandPalette(); }
function activateSettingsTab(tab) { document.querySelectorAll('.settings-tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab)); document.querySelectorAll('.settings-panel').forEach((el) => el.classList.toggle('active', el.dataset.panel === tab)); }
function saveSettings() { showToast('Settings saved locally where supported', 'success'); closeModal('settings-modal'); }
async function resetMemory() {
  if (!state.currentConversationId) return showToast('No active conversation', 'warning');
  if (!confirm('Reset all memories for this conversation?')) return;
  const res = await fetch(`/api/memory/${state.currentConversationId}`);
  const data = await res.json();
  for (const m of data.memories || []) await fetch(`/api/memory/entry/${m.id}`, { method: 'DELETE' });
  await loadMemoryPanel();
}

function handleGlobalKeys(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); }
  if (e.key === 'Escape') { closeCommandPalette(); document.querySelectorAll('.modal-overlay.open').forEach((el) => el.classList.remove('open')); }
  if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n' && document.activeElement === document.body) startNewChat();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle-2' : type === 'error' ? 'circle-alert' : type === 'warning' ? 'triangle-alert' : 'info'}"></i><span>${escapeHtml(message)}</span>`;
  $('toast-container').appendChild(toast);
  refreshIcons();
  setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 200); }, 3200);
}
function scrollToBottom(force = false) {
  const container = $('messages-container');
  if (!container) return;
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (!force && distance > 240) return;
  requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: force ? 'auto' : 'smooth' }));
}
function autoResizeTextarea() { const textarea = $('message-input'); if (!textarea) return; textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 190)}px`; }
function stripHtmlTags(text) { return String(text || '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
function cleanDisplayContent(text) { return stripHtmlTags(text).replace(/\[TOOL:[^\]]*\]/g, '').replace(/\[THINKING:[^\]]*\]/g, '').replace(/\n{3,}/g, '\n\n'); }
function escapeHtml(text) { return String(text ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }




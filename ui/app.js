/* ============================================================
   OmniClient AI — app.js
   Vanilla JavaScript SPA — no frameworks required
   ============================================================ */

// ── State ───────────────────────────────────────────────────
const state = {
  currentConversationId: null,
  currentAgentId: null,
  agents: [],
  conversations: [],
  isStreaming: false,
  agentPanelOpen: false,
  sidebarOpen: true,
};

// ── DOM references ──────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAgents();
  await loadConversations();
  setupEventListeners();
  showWelcomeScreen();
  autoResizeTextarea();
});

// ── Event Listeners ─────────────────────────────────────────
function setupEventListeners() {
  // Sidebar toggle
  $('sidebar-toggle').addEventListener('click', toggleSidebar);

  // New chat
  $('new-chat-btn').addEventListener('click', startNewChat);

  // Send message
  $('send-btn').addEventListener('click', sendMessage);
  $('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Agent panel
  $('agent-panel-btn').addEventListener('click', toggleAgentPanel);
  $('close-panel-btn').addEventListener('click', closeAgentPanel);

  // Conversation search
  $('conv-search').addEventListener('input', filterConversations);

  // Agent selector
  $('agent-select').addEventListener('change', (e) => {
    state.currentAgentId = e.target.value ? parseInt(e.target.value) : null;
    updateAgentPanel();
  });

  // Tool shortcuts
  document.querySelectorAll('.tool-shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix;
      const input = $('message-input');
      if (!input.value.startsWith(prefix)) {
        input.value = prefix + ' ' + input.value;
      }
      input.focus();
      btn.classList.toggle('active');
      setTimeout(() => btn.classList.remove('active'), 1000);
    });
  });

  // New agent wizard
  $('new-agent-btn').addEventListener('click', openNewAgentModal);

  // Settings
  $('settings-btn').addEventListener('click', openSettingsModal);

  // Export
  $('export-btn').addEventListener('click', exportConversation);

  // Agent panel controls
  $('temp-slider').addEventListener('input', (e) => {
    $('temp-value').textContent = parseFloat(e.target.value).toFixed(1);
  });

  $('save-agent-settings-btn').addEventListener('click', saveAgentSettings);
  $('deploy-guide-btn').addEventListener('click', generateDeployGuide);
  $('load-memory-btn').addEventListener('click', loadMemoryPanel);
  $('add-memory-btn').addEventListener('click', addMemoryEntry);

  // Welcome cards
  document.querySelectorAll('.welcome-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      startNewChat(null, prompt);
    });
  });

  // DB Query modal
  $('run-query-btn').addEventListener('click', runDbQuery);
  $('export-csv-btn').addEventListener('click', exportQueryCSV);
  $('close-db-modal-btn').addEventListener('click', () => closeModal('db-modal'));

  // Settings modal
  $('close-settings-btn').addEventListener('click', () => closeModal('settings-modal'));
  $('save-settings-btn').addEventListener('click', saveSettings);
  $('reset-memory-btn').addEventListener('click', resetMemory);

  // DB query shortcut
  $('db-shortcut-btn').addEventListener('click', () => {
    openModal('db-modal');
  });
}

// ── Sidebar ─────────────────────────────────────────────────
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  $('sidebar').classList.toggle('collapsed', !state.sidebarOpen);
}

// ── Conversations ────────────────────────────────────────────
async function loadConversations() {
  try {
    const res = await fetch('/api/conversations');
    state.conversations = await res.json();
    renderConversationList();
  } catch (e) {
    console.error('Failed to load conversations:', e);
  }
}

function renderConversationList(filter = '') {
  const list = $('conversations-list');
  const convs = state.conversations.filter(c =>
    c.title.toLowerCase().includes(filter.toLowerCase())
  );

  if (convs.length === 0) {
    list.innerHTML = '<div class="empty-state">No conversations yet.<br>Start a new chat!</div>';
    return;
  }

  const pinned = convs.filter(c => c.pinned);
  const regular = convs.filter(c => !c.pinned);
  let html = '';

  if (pinned.length > 0) {
    html += '<div class="sidebar-section-label">Pinned</div>';
    html += pinned.map(convHtml).join('');
    if (regular.length > 0) html += '<div class="sidebar-section-label">Recent</div>';
  }

  html += regular.map(convHtml).join('');
  list.innerHTML = html;

  // Add click listeners
  list.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.conv-actions')) return;
      loadConversation(parseInt(item.dataset.id));
    });
  });

  list.querySelectorAll('.conv-pin-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const conv = state.conversations.find(c => c.id === id);
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pinned: !conv.pinned})
      });
      await loadConversations();
    });
  });

  list.querySelectorAll('.conv-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (confirm('Delete this conversation?')) {
        await fetch(`/api/conversations/${id}`, {method: 'DELETE'});
        if (state.currentConversationId === id) {
          state.currentConversationId = null;
          showWelcomeScreen();
        }
        await loadConversations();
        showToast('Conversation deleted', 'success');
      }
    });
  });
}

function convHtml(c) {
  const isActive = c.id === state.currentConversationId;
  const pinIcon = c.pinned ? '📌' : '📍';
  return `
    <div class="conversation-item ${isActive ? 'active' : ''} ${c.pinned ? 'pinned' : ''}" data-id="${c.id}">
      <span class="conv-title">${escapeHtml(c.title)}</span>
      <span class="conv-actions">
        <button class="conv-action-btn conv-pin-btn" data-id="${c.id}" title="${c.pinned ? 'Unpin' : 'Pin'}">${pinIcon}</button>
        <button class="conv-action-btn conv-delete-btn" data-id="${c.id}" title="Delete">🗑️</button>
      </span>
    </div>`;
}

function filterConversations(e) {
  renderConversationList(e.target.value);
}

async function loadConversation(id) {
  state.currentConversationId = id;
  renderConversationList($('conv-search').value);

  try {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    $('chat-title').textContent = data.title;
    $('welcome-screen').classList.add('hidden');
    $('messages-container').classList.remove('hidden');

    const container = $('messages-container');
    container.innerHTML = '';
    data.messages.forEach(msg => appendMessage(msg.role, msg.content, msg.id, msg.bookmarked));
    scrollToBottom();

    if (state.agentPanelOpen) loadMemoryPanel();
  } catch (e) {
    showToast('Failed to load conversation', 'error');
  }
}

function startNewChat(e, prefillMessage = null) {
  state.currentConversationId = null;
  $('chat-title').textContent = 'New Conversation';
  $('welcome-screen').classList.add('hidden');
  $('messages-container').classList.remove('hidden');
  $('messages-container').innerHTML = '';
  renderConversationList($('conv-search').value);

  if (prefillMessage) {
    $('message-input').value = prefillMessage;
    $('message-input').focus();
  } else {
    $('message-input').focus();
  }
}

function showWelcomeScreen() {
  $('welcome-screen').classList.remove('hidden');
  $('messages-container').classList.add('hidden');
  $('chat-title').textContent = 'OmniClient AI';
}

// ── Agents ──────────────────────────────────────────────────
async function loadAgents() {
  try {
    const res = await fetch('/api/agents');
    state.agents = await res.json();
    renderAgentSelector();
  } catch (e) {
    console.error('Failed to load agents:', e);
  }
}

function renderAgentSelector() {
  const sel = $('agent-select');
  sel.innerHTML = state.agents.map(a =>
    `<option value="${a.id}" ${a.id === state.currentAgentId ? 'selected' : ''}>${a.name}</option>`
  ).join('');
  if (state.agents.length > 0 && !state.currentAgentId) {
    state.currentAgentId = state.agents[0].id;
  }
}

// ── Chat ────────────────────────────────────────────────────
async function sendMessage() {
  const input = $('message-input');
  const message = input.value.trim();
  if (!message || state.isStreaming) return;

  input.value = '';
  input.style.height = 'auto';
  $('send-btn').disabled = true;
  state.isStreaming = true;

  appendMessage('user', message);
  scrollToBottom();

  // Show typing indicator
  const typingId = showTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        message,
        conversation_id: state.currentConversationId,
        agent_id: state.currentAgentId,
      })
    });

    if (!res.ok) {
      const err = await res.json();
      removeTypingIndicator(typingId);
      appendMessage('assistant', `**Error**: ${err.detail || 'Unknown error'}`);
      state.isStreaming = false;
      $('send-btn').disabled = false;
      return;
    }

    removeTypingIndicator(typingId);
    const aiMsgEl = appendMessage('assistant', '');
    const bubbleEl = aiMsgEl.querySelector('.message-content');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let rawContent = '';
    let conversationIdReceived = false;

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;
        try {
          const payload = JSON.parse(dataStr);
          if (payload.type === 'meta') {
            if (!conversationIdReceived) {
              state.currentConversationId = payload.conversation_id;
              conversationIdReceived = true;
            }
          } else if (payload.type === 'token') {
            rawContent += payload.content;
            bubbleEl.innerHTML = renderMarkdown(rawContent);
            // Re-highlight code blocks
            Prism.highlightAllUnder(bubbleEl);
            wrapCodeBlocks(bubbleEl);
            scrollToBottom();
          } else if (payload.type === 'done') {
            break;
          }
        } catch (_) {}
      }
    }

    // Refresh conversations list to get updated title
    await loadConversations();
    renderConversationList($('conv-search').value);

  } catch (e) {
    removeTypingIndicator(typingId);
    appendMessage('assistant', `**Connection error**: ${e.message}`);
  }

  state.isStreaming = false;
  $('send-btn').disabled = false;
  scrollToBottom();
}

// ── Message rendering ────────────────────────────────────────
function appendMessage(role, content, msgId = null, bookmarked = false) {
  const container = $('messages-container');
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${role}`;
  if (msgId) wrapper.dataset.msgId = msgId;

  const isUser = role === 'user';
  const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';
  const avatarText = isUser ? '👤' : '✦';
  const bubbleClass = isUser ? 'user' : 'assistant';

  wrapper.innerHTML = `
    <div class="message-meta">
      ${!isUser ? `<div class="message-avatar ${avatarClass}">${avatarText}</div>` : ''}
      <span>${isUser ? 'You' : 'OmniClient'}</span>
      ${isUser ? `<div class="message-avatar ${avatarClass}">${avatarText}</div>` : ''}
    </div>
    <div class="message-bubble ${bubbleClass}">
      <div class="message-content">${content ? renderMarkdown(content) : ''}</div>
    </div>
    <div class="message-actions">
      ${!isUser ? `<button class="msg-action-btn regen-btn" title="Regenerate">↻ Regenerate</button>` : ''}
      ${msgId ? `<button class="msg-action-btn bookmark-btn ${bookmarked ? 'bookmarked' : ''}" data-id="${msgId}" title="Bookmark">
        ${bookmarked ? '🔖 Bookmarked' : '🔖 Bookmark'}
      </button>` : ''}
      ${msgId ? `<button class="msg-action-btn delete-msg-btn" data-id="${msgId}" title="Delete">🗑️</button>` : ''}
      <button class="msg-action-btn copy-msg-btn" title="Copy">📋 Copy</button>
    </div>`;

  container.appendChild(wrapper);

  // Highlight code
  if (content) {
    Prism.highlightAllUnder(wrapper);
    wrapCodeBlocks(wrapper.querySelector('.message-content'));
  }

  // Action listeners
  wrapper.querySelector('.copy-msg-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(content || '');
    showToast('Copied to clipboard', 'success');
  });

  wrapper.querySelector('.regen-btn')?.addEventListener('click', async () => {
    const prevUser = wrapper.previousElementSibling;
    if (prevUser) {
      const prevContent = prevUser.querySelector('.message-content')?.textContent;
      if (prevContent) {
        wrapper.remove();
        $('message-input').value = prevContent;
        await sendMessage();
      }
    }
  });

  wrapper.querySelector('.bookmark-btn')?.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    const res = await fetch(`/api/messages/${id}/bookmark`, {method: 'PATCH'});
    const data = await res.json();
    e.currentTarget.className = `msg-action-btn bookmark-btn ${data.bookmarked ? 'bookmarked' : ''}`;
    e.currentTarget.textContent = data.bookmarked ? '🔖 Bookmarked' : '🔖 Bookmark';
    showToast(data.bookmarked ? 'Message bookmarked' : 'Bookmark removed', 'success');
  });

  wrapper.querySelector('.delete-msg-btn')?.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    if (confirm('Delete this message?')) {
      await fetch(`/api/messages/${id}`, {method: 'DELETE'});
      wrapper.remove();
      showToast('Message deleted', 'success');
    }
  });

  return wrapper;
}

// ── Markdown renderer ────────────────────────────────────────
function renderMarkdown(text) {
  // Escape HTML first (except code blocks)
  let html = text;

  // Fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || 'text';
    const escaped = escapeHtml(code.trim());
    return `<div class="code-block-wrapper">
      <div class="code-block-header">
        <span>${language}</span>
        <button class="code-copy-btn" data-code="${encodeURIComponent(code.trim())}">Copy</button>
      </div>
      <pre class="language-${language}"><code class="language-${language}">${escaped}</code></pre>
    </div>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    if (!match.includes('<ul>')) return '<ul>' + match + '</ul>';
    return match;
  });

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr style="border-color:var(--color-border-light);margin:12px 0">');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#a5b4fc;text-decoration:underline">$1</a>');

  // Line breaks / paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<[huo])/g, '$1');
  html = html.replace(/(<\/[huo][l1-6]>)<\/p>/g, '$1');

  return html;
}

function wrapCodeBlocks(el) {
  if (!el) return;
  el.querySelectorAll('.code-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = decodeURIComponent(btn.dataset.code);
      navigator.clipboard.writeText(code);
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
  });
}

// ── Typing indicator ─────────────────────────────────────────
function showTypingIndicator() {
  const id = 'typing-' + Date.now();
  const container = $('messages-container');
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message-wrapper assistant';
  div.innerHTML = `
    <div class="message-meta">
      <div class="message-avatar ai-avatar">✦</div>
      <span>OmniClient</span>
    </div>
    <div class="message-bubble assistant">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = $(id);
  if (el) el.remove();
}

// ── Agent Panel ──────────────────────────────────────────────
function toggleAgentPanel() {
  state.agentPanelOpen = !state.agentPanelOpen;
  $('agent-panel').classList.toggle('open', state.agentPanelOpen);
  $('agent-panel-btn').classList.toggle('active', state.agentPanelOpen);
  if (state.agentPanelOpen) updateAgentPanel();
}

function closeAgentPanel() {
  state.agentPanelOpen = false;
  $('agent-panel').classList.remove('open');
  $('agent-panel-btn').classList.remove('active');
}

async function updateAgentPanel() {
  if (!state.currentAgentId || !state.agentPanelOpen) return;
  try {
    const res = await fetch(`/api/agents/${state.currentAgentId}`);
    const agent = await res.json();

    // Profile
    $('panel-agent-name').textContent = agent.name;
    $('panel-agent-model').textContent = agent.model;
    $('panel-agent-avatar').textContent = agent.name.charAt(0).toUpperCase();

    // Controls
    $('model-select').value = agent.model;
    $('temp-slider').value = agent.temperature;
    $('temp-value').textContent = agent.temperature.toFixed(1);
    $('system-prompt-editor').value = agent.system_prompt;

    // Tools
    $('toggle-search').checked = agent.enable_search;
    $('toggle-db').checked = agent.enable_db_query;
    $('toggle-code').checked = agent.enable_code_gen;

    // Load memories
    if (state.currentConversationId) {
      await loadMemoryPanel();
    }
  } catch (e) {
    console.error('Failed to update agent panel:', e);
  }
}

async function saveAgentSettings() {
  if (!state.currentAgentId) return;
  const payload = {
    model: $('model-select').value,
    temperature: parseFloat($('temp-slider').value),
    system_prompt: $('system-prompt-editor').value,
    enable_search: $('toggle-search').checked,
    enable_db_query: $('toggle-db').checked,
    enable_code_gen: $('toggle-code').checked,
  };
  try {
    const res = await fetch(`/api/agents/${state.currentAgentId}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showToast('Agent settings saved!', 'success');
    }
  } catch (e) {
    showToast('Failed to save settings', 'error');
  }
}

// ── Memory Panel ─────────────────────────────────────────────
async function loadMemoryPanel() {
  if (!state.currentConversationId) {
    $('memory-list').innerHTML = '<div class="empty-state">Start a conversation to see memories.</div>';
    return;
  }
  try {
    const res = await fetch(`/api/memory/${state.currentConversationId}`);
    const data = await res.json();
    renderMemoryList(data.memories);
  } catch (e) {
    $('memory-list').innerHTML = '<div class="empty-state">Failed to load memories.</div>';
  }
}

function renderMemoryList(memories) {
  const el = $('memory-list');
  if (!memories || memories.length === 0) {
    el.innerHTML = '<div class="empty-state">No memories stored yet.</div>';
    return;
  }
  el.innerHTML = memories.map(m => `
    <div class="memory-item" data-id="${m.id}">
      <div class="memory-item-key">${escapeHtml(m.key)}</div>
      <div class="memory-item-value">${escapeHtml(m.value)}</div>
      <div class="memory-item-actions">
        <button class="memory-btn del" data-id="${m.id}" title="Delete">✕</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.memory-btn.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await fetch(`/api/memory/entry/${id}`, {method: 'DELETE'});
      await loadMemoryPanel();
      showToast('Memory deleted', 'success');
    });
  });
}

async function addMemoryEntry() {
  if (!state.currentConversationId) {
    showToast('Start a conversation first', 'warning');
    return;
  }
  const key = prompt('Memory key (e.g., "User project"):');
  if (!key) return;
  const value = prompt('Memory value:');
  if (!value) return;

  await fetch(`/api/memory/${state.currentConversationId}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({key, value, importance_score: 1.5}),
  });
  await loadMemoryPanel();
  showToast('Memory added!', 'success');
}

// ── Deploy Guide ─────────────────────────────────────────────
async function generateDeployGuide() {
  const projectType = prompt('Project type (e.g., FastAPI, Flask, Streamlit, Next.js):');
  if (!projectType) return;
  showToast('Generating deployment guide...', 'info');
  try {
    const res = await fetch('/api/deploy/guide', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({project_type: projectType, context: ''}),
    });
    const data = await res.json();
    if (!state.currentConversationId) startNewChat();
    appendMessage('assistant', data.guide);
    scrollToBottom();
  } catch (e) {
    showToast('Failed to generate guide', 'error');
  }
}

// ── New Agent Wizard ─────────────────────────────────────────
let wizardStep = 1;
let wizardData = { capabilities: [] };

function openNewAgentModal() {
  wizardStep = 1;
  wizardData = { capabilities: [] };
  updateWizard();
  openModal('new-agent-modal');
}

function updateWizard() {
  for (let i = 1; i <= 3; i++) {
    const page = $(`wizard-page-${i}`);
    const step = document.querySelector(`.wizard-step[data-step="${i}"]`);
    page.classList.toggle('active', i === wizardStep);
    if (step) {
      step.classList.toggle('active', i === wizardStep);
      step.classList.toggle('done', i < wizardStep);
    }
  }
  $('wizard-back-btn').style.display = wizardStep === 1 ? 'none' : '';
  $('wizard-next-btn').textContent = wizardStep === 3 ? '✓ Create Agent' : 'Next →';
}

document.addEventListener('DOMContentLoaded', () => {
  // Capability chip selection
  document.querySelectorAll('.cap-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      const cap = chip.dataset.cap;
      if (chip.classList.contains('selected')) {
        wizardData.capabilities.push(cap);
      } else {
        wizardData.capabilities = wizardData.capabilities.filter(c => c !== cap);
      }
    });
  });

  $('wizard-next-btn').addEventListener('click', async () => {
    if (wizardStep === 1) {
      const name = $('wizard-agent-name').value.trim();
      const purpose = $('wizard-agent-purpose').value.trim();
      if (!name || !purpose) { showToast('Name and purpose are required', 'warning'); return; }
      wizardData.name = name;
      wizardData.purpose = purpose;
      wizardStep = 2;
      updateWizard();
    } else if (wizardStep === 2) {
      wizardStep = 3;
      updateWizard();
    } else if (wizardStep === 3) {
      wizardData.tone = $('wizard-tone').value;
      wizardData.model = $('wizard-model').value;
      wizardData.description = $('wizard-agent-desc').value;
      await createNewAgent();
    }
  });

  $('wizard-back-btn').addEventListener('click', () => {
    if (wizardStep > 1) { wizardStep--; updateWizard(); }
  });

  $('close-agent-modal-btn').addEventListener('click', () => closeModal('new-agent-modal'));
});

async function createNewAgent() {
  try {
    showToast('Creating agent...', 'info');
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: wizardData.name,
        description: wizardData.description || '',
        purpose: wizardData.purpose,
        capabilities: wizardData.capabilities,
        tone: wizardData.tone,
        model: wizardData.model || 'meta-llama/llama-3-8b-instruct:free',
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(`Error: ${err.detail}`, 'error');
      return;
    }

    const agent = await res.json();
    await loadAgents();
    state.currentAgentId = agent.id;
    $('agent-select').value = agent.id;
    closeModal('new-agent-modal');
    showToast(`Agent "${agent.name}" created!`, 'success');

    // Open the agent panel to show the new agent
    if (!state.agentPanelOpen) toggleAgentPanel();
    updateAgentPanel();
  } catch (e) {
    showToast('Failed to create agent: ' + e.message, 'error');
  }
}

// ── DB Query Modal ───────────────────────────────────────────
let lastQueryResults = null;

async function runDbQuery() {
  const sql = $('db-query-input').value.trim();
  if (!sql) return;

  try {
    const res = await fetch('/api/query-db', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sql}),
    });
    const data = await res.json();

    if (!res.ok) {
      $('db-results').innerHTML = `<div class="empty-state" style="color:var(--color-error)">${data.detail}</div>`;
      return;
    }

    lastQueryResults = data;
    $('db-row-count').textContent = `${data.row_count} rows`;
    $('export-csv-btn').classList.remove('hidden');

    if (data.rows.length === 0) {
      $('db-results').innerHTML = '<div class="empty-state">Query returned no results.</div>';
      return;
    }

    const thead = `<tr>${data.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
    const tbody = data.rows.map(row =>
      `<tr>${data.columns.map(c => `<td>${escapeHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`
    ).join('');

    $('db-results').innerHTML = `
      <div class="db-table-wrapper">
        <table class="db-table">
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;

    // Query explanation toggle
    $('query-explanation').textContent = `This query selects data using: ${sql.substring(0, 100)}...`;
  } catch (e) {
    $('db-results').innerHTML = `<div class="empty-state" style="color:var(--color-error)">Error: ${e.message}</div>`;
  }
}

function exportQueryCSV() {
  if (!lastQueryResults) return;
  const {columns, rows} = lastQueryResults;
  const csvRows = [columns.join(',')];
  rows.forEach(row => {
    csvRows.push(columns.map(c => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','));
  });
  const blob = new Blob([csvRows.join('\n')], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'query_results.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported as CSV!', 'success');
}

// ── Export Conversation ──────────────────────────────────────
async function exportConversation() {
  if (!state.currentConversationId) {
    showToast('No active conversation', 'warning');
    return;
  }
  const fmt = confirm('Export as Markdown?\n(Cancel for JSON)') ? 'markdown' : 'json';
  const ext = fmt === 'markdown' ? 'md' : 'json';
  const url = `/api/conversations/${state.currentConversationId}/export?fmt=${fmt}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversation_${state.currentConversationId}.${ext}`;
  a.click();
  showToast('Exported!', 'success');
}

// ── Settings Modal ────────────────────────────────────────────
function openSettingsModal() {
  // Pre-fill saved API key hint
  $('api-key-input').placeholder = 'sk-or-... (stored in .env on server)';
  openModal('settings-modal');
}

function saveSettings() {
  showToast('Settings are managed via the .env file on the server.', 'info');
  closeModal('settings-modal');
}

async function resetMemory() {
  if (!state.currentConversationId) {
    showToast('No active conversation', 'warning');
    return;
  }
  if (!confirm('Reset all memories for this conversation?')) return;
  try {
    const res = await fetch(`/api/memory/${state.currentConversationId}`);
    const data = await res.json();
    for (const m of data.memories) {
      await fetch(`/api/memory/entry/${m.id}`, {method: 'DELETE'});
    }
    await loadMemoryPanel();
    showToast('Memories reset!', 'success');
  } catch (e) {
    showToast('Failed to reset memories', 'error');
  }
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  $(`${id}-overlay`).classList.add('open');
}

function closeModal(id) {
  $(`${id}-overlay`).classList.remove('open');
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── Toasts ────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  const icons = {success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'};
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ── Utilities ─────────────────────────────────────────────────
function scrollToBottom() {
  const container = $('messages-container');
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

function escapeHtml(text) {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function autoResizeTextarea() {
  const textarea = $('message-input');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  });
}

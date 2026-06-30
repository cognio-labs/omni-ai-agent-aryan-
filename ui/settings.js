/**
 * settings.js — OmniClient Settings Manager
 * All 10 Settings tabs fully functional with localStorage persistence.
 * Depends on app.js globals: showToast, applyTheme, state,
 * renderConversationList, showWelcomeScreen, refreshIcons, openModal, closeModal
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'omniclient_settings';

  const DEFAULTS = {
    agentName: 'OmniClient',
    language: 'auto',
    responseStyle: 'balanced',
    theme: 'light',
    accentColor: '#5f5af6',
    fontSize: 15,
    model: 'gemini-pro',
    temperature: 0.7,
    rememberHistory: true,
    codeExecution: true,
    sandboxTimeout: 60,
    debugLogs: false,
    analytics: false,
    saveHistory: true,
    integrations: { slack: false, gmail: false, n8n: false, whatsapp: false },
    apiKeys: [],
  };

  let S = JSON.parse(JSON.stringify(DEFAULTS));

  /* ─── Persistence ─────────────────────────────────────── */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        S = Object.assign({}, DEFAULTS, parsed);
        S.integrations = Object.assign({}, DEFAULTS.integrations, parsed.integrations || {});
        S.apiKeys = Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [];
      }
      const savedTheme = localStorage.getItem('omniclient-theme');
      if (savedTheme && savedTheme !== 'undefined') S.theme = savedTheme;
    } catch (e) { console.warn('[OmniSettings] load error:', e); }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }
    catch (e) { console.warn('[OmniSettings] save error:', e); }
  }

  /* ─── Helpers ─────────────────────────────────────────── */
  const el  = (id) => document.getElementById(id);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const escH = (t) => String(t ?? '').replace(/[&<>"']/g, (m) =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]
  );

  function toast(msg, type) {
    type = type || 'success';
    if (typeof showToast === 'function') { showToast(msg, type); return; }
    const c = el('toast-container');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.textContent = msg;
    c.appendChild(d);
    setTimeout(function () { d.classList.add('leaving'); setTimeout(function () { d.remove(); }, 200); }, 2800);
  }

  /* ─── Apply settings ──────────────────────────────────── */
  function applyAll() {
    applyThemeVal(S.theme, false);
    applyAccent(S.accentColor);
    applyFontSizeVal(S.fontSize);
    window.OC_DEBUG = S.debugLogs;
  }

  function applyThemeVal(val, doSave) {
    S.theme = val;
    var resolved = val;
    if (val === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem('omniclient-theme', resolved);
    if (typeof state !== 'undefined') state.theme = resolved;
    if (doSave) saveSettings();
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
  }

  function applyAccent(color) {
    S.accentColor = color;
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-soft', hexToRgba(color, 0.15));
  }

  function applyFontSizeVal(px) {
    S.fontSize = Number(px);
    var styleEl = el('oc-font-size-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'oc-font-size-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = '.message-bubble { font-size: ' + px + 'px !important; }';
  }

  /* ─── Populate form ───────────────────────────────────── */
  function populateForm() {
    setVal('st-agent-name', S.agentName);
    setVal('st-language', S.language);
    qsa('input[name="st-response-style"]').forEach(function (r) {
      r.checked = r.value === S.responseStyle;
      var opt = r.closest('.radio-option');
      if (opt) opt.classList.toggle('selected', r.checked);
    });
    syncThemeBtns(S.theme);
    qsa('.swatch').forEach(function (sw) {
      sw.classList.toggle('active', sw.dataset.color === S.accentColor);
    });
    setVal('st-accent-custom', S.accentColor);
    setVal('st-font-size', S.fontSize);
    var fsv = el('st-font-size-val');
    if (fsv) fsv.textContent = S.fontSize;

    setVal('st-model', S.model);
    setVal('st-temperature', Math.round(S.temperature * 100));
    var tv = el('st-temp-val');
    if (tv) tv.textContent = S.temperature.toFixed(1);
    var cv = el('st-connection-status');
    if (cv) { cv.textContent = ''; cv.style.color = ''; }

    setChecked('st-remember-history', S.rememberHistory);
    setChecked('st-code-exec', S.codeExecution);
    setVal('st-timeout', S.sandboxTimeout);
    setChecked('st-debug-logs', S.debugLogs);
    setChecked('st-analytics', S.analytics);
    setChecked('st-save-history', S.saveHistory);

    renderIntegrationList();
    renderKeyList();
    if (typeof refreshIcons === 'function') refreshIcons();
  }

  function setVal(id, val) { var e = el(id); if (e) e.value = val; }
  function setChecked(id, val) { var e = el(id); if (e) e.checked = !!val; }
  function syncThemeBtns(val) {
    qsa('.theme-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.themeVal === val); });
  }

  /* ─── General Tab ─────────────────────────────────────── */
  function bindGeneral() {
    el('st-general-save') && el('st-general-save').addEventListener('click', function () {
      S.agentName = (el('st-agent-name') || {}).value || 'OmniClient';
      S.language   = (el('st-language')   || {}).value || 'auto';
      var checked  = document.querySelector('input[name="st-response-style"]:checked');
      S.responseStyle = checked ? checked.value : 'balanced';
      saveSettings();
      toast('General settings saved!', 'success');
    });

    qsa('input[name="st-response-style"]').forEach(function (r) {
      r.addEventListener('change', function () {
        qsa('input[name="st-response-style"]').forEach(function (x) {
          var opt = x.closest('.radio-option');
          if (opt) opt.classList.toggle('selected', x === r);
        });
      });
    });
  }

  /* ─── Appearance Tab ──────────────────────────────────── */
  function bindAppearance() {
    qsa('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyThemeVal(btn.dataset.themeVal, true);
        syncThemeBtns(S.theme);
        toast('Theme: ' + btn.dataset.themeVal, 'success');
      });
    });

    qsa('.swatch').forEach(function (sw) {
      sw.addEventListener('click', function () {
        applyAccent(sw.dataset.color);
        qsa('.swatch').forEach(function (s) { s.classList.remove('active'); });
        sw.classList.add('active');
        setVal('st-accent-custom', sw.dataset.color);
        saveSettings();
      });
    });

    var cp = el('st-accent-custom');
    if (cp) {
      cp.addEventListener('input', function () {
        applyAccent(cp.value);
        qsa('.swatch').forEach(function (s) { s.classList.remove('active'); });
        saveSettings();
      });
    }

    var fs = el('st-font-size');
    if (fs) {
      fs.addEventListener('input', function () {
        var px = fs.value;
        var fsv = el('st-font-size-val');
        if (fsv) fsv.textContent = px;
        applyFontSizeVal(px);
        saveSettings();
      });
    }
  }

  /* ─── Models Tab ──────────────────────────────────────── */
  function bindModels() {
    var modelEl = el('st-model');
    if (modelEl) {
      modelEl.addEventListener('change', function () {
        S.model = modelEl.value;
        saveSettings();
        toast('Model set to ' + S.model, 'success');
      });
    }

    var tempEl = el('st-temperature');
    if (tempEl) {
      tempEl.addEventListener('input', function () {
        var val = (parseInt(tempEl.value) / 100).toFixed(1);
        var tv = el('st-temp-val');
        if (tv) tv.textContent = val;
        S.temperature = parseFloat(val);
        saveSettings();
      });
    }

    var testBtn = el('st-test-connection');
    if (testBtn) {
      testBtn.addEventListener('click', async function () {
        testBtn.disabled = true;
        testBtn.textContent = 'Testing…';
        var statusEl = el('st-connection-status');
        if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }
        try {
          var res = await fetch('/api/agents');
          if (!res.ok) throw new Error('HTTP ' + res.status);
          if (statusEl) { statusEl.textContent = '✓ Connected'; statusEl.style.color = 'var(--success)'; }
          toast('Connection successful!', 'success');
        } catch (err) {
          if (statusEl) { statusEl.textContent = '✗ Failed'; statusEl.style.color = 'var(--danger)'; }
          toast('Connection failed: ' + err.message, 'error');
        } finally {
          testBtn.disabled = false;
          testBtn.textContent = 'Test connection';
        }
      });
    }
  }

  /* ─── Memory Tab ──────────────────────────────────────── */
  function bindMemory() {
    var h = el('st-remember-history');
    if (h) {
      h.addEventListener('change', function () {
        S.rememberHistory = h.checked;
        saveSettings();
        toast(S.rememberHistory ? 'History memory enabled' : 'Disabled', 'info');
      });
    }
    var c = el('st-clear-memory');
    if (c) {
      c.addEventListener('click', function () {
        if (!confirm('Clear all conversation memory? This cannot be undone.')) return;
        localStorage.removeItem('omniclient_conversations');
        if (typeof state !== 'undefined') {
          state.conversations = [];
          state.currentConversationId = null;
          if (typeof renderConversationList === 'function') renderConversationList();
          if (typeof showWelcomeScreen === 'function') showWelcomeScreen();
        }
        toast('Memory cleared', 'success');
      });
    }
  }

  /* ─── Sandbox Tab ─────────────────────────────────────── */
  function bindSandbox() {
    var ce = el('st-code-exec');
    if (ce) {
      ce.addEventListener('change', function () {
        S.codeExecution = ce.checked;
        saveSettings();
        toast(S.codeExecution ? 'Code execution enabled' : 'Disabled', 'info');
      });
    }
    var to = el('st-timeout');
    if (to) {
      to.addEventListener('change', function () {
        var v = Math.min(300, Math.max(5, parseInt(to.value) || 60));
        to.value = v;
        S.sandboxTimeout = v;
        saveSettings();
      });
    }
    var cb = el('st-clear-sandbox');
    if (cb) {
      cb.addEventListener('click', function () {
        if (!confirm('Clear sandbox cache?')) return;
        toast('Sandbox cache cleared', 'success');
      });
    }
  }

  /* ─── Integrations Tab ────────────────────────────────── */
  function renderIntegrationList() {
    document.querySelectorAll('.integration-item').forEach(function (item) {
      var key = item.dataset.integration;
      var connected = S.integrations[key] || false;
      var badge = item.querySelector('.status-badge');
      var btn   = item.querySelector('.connect-btn');
      if (badge) {
        badge.textContent = connected ? 'Connected' : 'Not connected';
        badge.classList.toggle('connected', connected);
      }
      if (btn) {
        btn.textContent = connected ? 'Disconnect' : 'Connect';
        btn.className = (connected ? 'st-danger-btn' : 'st-action-btn') + ' connect-btn';
      }
    });
  }

  function bindIntegrations() {
    var panel = document.querySelector('[data-panel="integrations"]');
    if (!panel) return;
    panel.addEventListener('click', function (e) {
      var btn = e.target.closest('.connect-btn');
      if (!btn) return;
      var key = btn.closest('.integration-item') && btn.closest('.integration-item').dataset.integration;
      if (!key) return;
      S.integrations[key] = !S.integrations[key];
      saveSettings();
      renderIntegrationList();
      var name = key.charAt(0).toUpperCase() + key.slice(1);
      toast(S.integrations[key] ? name + ' connected' : name + ' disconnected',
            S.integrations[key] ? 'success' : 'info');
    });
  }

  /* ─── API Keys Tab ────────────────────────────────────── */
  function renderKeyList() {
    var list = el('st-key-list');
    if (!list) return;
    if (!S.apiKeys.length) {
      list.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">No API keys saved yet.</p>';
      return;
    }
    list.innerHTML = S.apiKeys.map(function (k, i) {
      var masked = '••••' + String(k.value).slice(-4);
      return '<div class="key-item" data-index="' + i + '">' +
        '<span class="key-item-name">' + escH(k.name) + '</span>' +
        '<span class="key-item-value">' + masked + '</span>' +
        '<div class="key-item-actions">' +
          '<button class="st-action-btn key-copy-btn" data-index="' + i + '" type="button">Copy</button>' +
          '<button class="st-danger-btn key-del-btn" data-index="' + i + '" type="button">Delete</button>' +
        '</div></div>';
    }).join('');

    list.querySelectorAll('.key-copy-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var k = S.apiKeys[parseInt(btn.dataset.index)];
        if (!k) return;
        try {
          await navigator.clipboard.writeText(k.value);
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
          toast('"' + k.name + '" copied to clipboard', 'success');
        } catch { toast('Copy failed', 'error'); }
      });
    });

    list.querySelectorAll('.key-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.index);
        var k = S.apiKeys[idx];
        if (!k || !confirm('Delete key "' + k.name + '"?')) return;
        S.apiKeys.splice(idx, 1);
        saveSettings();
        renderKeyList();
        toast('API key deleted', 'info');
      });
    });
  }

  function bindApiKeys() {
    var addBtn = el('st-add-key');
    if (!addBtn) return;
    addBtn.addEventListener('click', function () {
      var nameEl = el('st-key-name');
      var valEl  = el('st-key-value');
      var name   = nameEl ? nameEl.value.trim() : '';
      var value  = valEl  ? valEl.value.trim()  : '';
      if (!name)  { toast('Enter a key name', 'warning'); return; }
      if (!value) { toast('Enter the API key value', 'warning'); return; }
      if (S.apiKeys.find(function (k) { return k.name === name; })) {
        toast('A key named "' + name + '" already exists', 'warning'); return;
      }
      S.apiKeys.push({ name: name, value: value });
      saveSettings();
      if (nameEl) nameEl.value = '';
      if (valEl)  valEl.value  = '';
      renderKeyList();
      toast('API key "' + name + '" saved', 'success');
    });
  }

  /* ─── Developer Tab ───────────────────────────────────── */
  function bindDeveloper() {
    var dbg = el('st-debug-logs');
    if (dbg) {
      dbg.addEventListener('change', function () {
        S.debugLogs = dbg.checked;
        window.OC_DEBUG = S.debugLogs;
        saveSettings();
        toast(S.debugLogs ? 'Debug logs ON (check console)' : 'Debug logs OFF', 'info');
      });
    }

    var viewBtn = el('st-view-prompt');
    if (viewBtn) {
      viewBtn.addEventListener('click', async function () {
        var drawer  = el('system-prompt-drawer');
        var content = el('system-prompt-content');
        if (!drawer) return;
        drawer.classList.remove('hidden');
        if (content) {
          content.textContent = 'Loading…';
          try {
            var res = await fetch('/api/agents');
            var agents = await res.json();
            content.textContent = (agents && agents[0] && agents[0].system_prompt)
              ? agents[0].system_prompt
              : '[System prompt not exposed via /api/agents.\nSee agent_engine.py → OMNICLIENT_SYSTEM_PROMPT]';
          } catch (err) {
            content.textContent = '[Error: ' + err.message + ']';
          }
        }
        if (typeof refreshIcons === 'function') refreshIcons();
      });
    }

    var closeDrawer = el('close-prompt-drawer');
    if (closeDrawer) {
      closeDrawer.addEventListener('click', function () {
        var drawer = el('system-prompt-drawer');
        if (drawer) drawer.classList.add('hidden');
      });
    }

    var expBtn = el('st-export-conv');
    if (expBtn) {
      expBtn.addEventListener('click', async function () {
        var convId = (typeof state !== 'undefined') ? state.currentConversationId : null;
        if (!convId) { toast('No active conversation to export', 'warning'); return; }
        try {
          var res  = await fetch('/api/conversations/' + convId);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url  = URL.createObjectURL(blob);
          var a    = document.createElement('a');
          a.href = url;
          a.download = 'omniclient_conv_' + convId + '.json';
          a.click();
          URL.revokeObjectURL(url);
          toast('Conversation exported as JSON', 'success');
        } catch (err) { toast('Export failed: ' + err.message, 'error'); }
      });
    }

    var devDb = el('dev-db-btn');
    if (devDb) {
      devDb.addEventListener('click', function () {
        if (typeof closeModal === 'function') closeModal('settings-modal');
        if (typeof openModal  === 'function') openModal('db-modal');
      });
    }
  }

  /* ─── Privacy Tab ─────────────────────────────────────── */
  function bindPrivacy() {
    var an = el('st-analytics');
    if (an) {
      an.addEventListener('change', function () {
        S.analytics = an.checked; saveSettings();
        toast(S.analytics ? 'Analytics enabled' : 'Analytics disabled', 'info');
      });
    }
    var sh = el('st-save-history');
    if (sh) {
      sh.addEventListener('change', function () {
        S.saveHistory = sh.checked; saveSettings();
        toast(S.saveHistory ? 'History saving enabled' : 'Disabled', 'info');
      });
    }
    var del = el('st-delete-all-data');
    if (del) {
      del.addEventListener('click', function () {
        if (!confirm('Delete ALL your data? Permanent, cannot be undone.')) return;
        if (!confirm('Final confirmation: clear all conversations, settings, and keys?')) return;
        localStorage.clear();
        S = JSON.parse(JSON.stringify(DEFAULTS));
        if (typeof state !== 'undefined') {
          state.conversations = [];
          state.currentConversationId = null;
          state.currentMode = 'General';
          if (typeof renderConversationList === 'function') renderConversationList();
          if (typeof showWelcomeScreen      === 'function') showWelcomeScreen();
        }
        toast('All data deleted. Reloading…', 'info');
        setTimeout(function () { location.reload(); }, 1800);
      });
    }
  }

  /* ─── Wire settings open ──────────────────────────────── */
  function watchSettingsOpen() {
    var btn = el('settings-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        setTimeout(populateForm, 40);
      });
    }
  }

  /* ─── Init ────────────────────────────────────────────── */
  function init() {
    loadSettings();
    applyAll();
    bindGeneral();
    bindAppearance();
    bindModels();
    bindMemory();
    bindSandbox();
    bindIntegrations();
    bindApiKeys();
    bindDeveloper();
    bindPrivacy();
    populateForm();
    watchSettingsOpen();
  }

  window.addEventListener('DOMContentLoaded', init);

  window.OmniSettings = {
    get:    function () { return JSON.parse(JSON.stringify(S)); },
    save:   saveSettings,
    reload: function () { loadSettings(); populateForm(); },
  };
})();

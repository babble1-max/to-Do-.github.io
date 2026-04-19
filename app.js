'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
let store = { daily: [], weekly: [], monthly: [], yearly: [] };
let currentTab   = 'daily';
let editingId    = null;
let reverseTarget = null;
let savedRange   = null;
let activeEditor = null;

const COLORS = [
  { name: '黒',     value: '#111111' },
  { name: '赤',     value: '#E53E3E' },
  { name: 'オレンジ', value: '#DD6B20' },
  { name: '黄',     value: '#D69E2E' },
  { name: '緑',     value: '#276749' },
  { name: '青',     value: '#2B6CB0' },
  { name: '水色',   value: '#2C7A7B' },
  { name: '紫',     value: '#6B46C1' },
  { name: 'ピンク', value: '#B83280' },
  { name: '茶',     value: '#744210' },
  { name: '薄灰',   value: '#718096' },
];

const PERIOD_LABEL = { daily: '今日', weekly: '今週', monthly: '今月', yearly: '今年' };
const SHORT = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  initColorPalettes('goal');
  initColorPalettes('action');
  renderAll();

  const savedFont = localStorage.getItem('todo-font') || 'gothic';
  applyFont(savedFont);

  // set data-period attrs
  document.querySelectorAll('.tab').forEach(btn => {
    const m = (btn.getAttribute('onclick') || '').match(/switchTab\('(\w+)'\)/);
    if (m) btn.dataset.period = m[1];
  });
});

// ─── Storage ─────────────────────────────────────────────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem('todo-store');
    if (raw) store = Object.assign({ daily: [], weekly: [], monthly: [], yearly: [] }, JSON.parse(raw));
  } catch (_) { /* ignore */ }
}

function saveToStorage() {
  localStorage.setItem('todo-store', JSON.stringify(store));
}

// ─── Font ─────────────────────────────────────────────────────────────────────
function setFont(type) {
  applyFont(type);
  localStorage.setItem('todo-font', type);
}

function applyFont(type) {
  document.body.classList.remove('font-gothic', 'font-mincho', 'font-cute');
  document.body.classList.add('font-' + type);
  document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-' + type);
  if (btn) btn.classList.add('active');
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(period) {
  currentTab = period;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + period);
  const secEl = document.getElementById(period);
  if (tabEl) tabEl.classList.add('active');
  if (secEl) secEl.classList.add('active');
  renderTodos(period);
}

function renderAll() {
  Object.keys(store).forEach(renderTodos);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderTodos(period) {
  const list = document.getElementById(period + '-list');
  if (!list) return;
  const items = store[period] || [];
  const short = SHORT[period];

  let html = '';

  // Progress bar
  if (items.length > 0) {
    const done = items.filter(i => i.completed).length;
    const pct  = Math.round((done / items.length) * 100);
    html += `
      <div class="progress-section">
        <div class="progress-label">
          <span>進捗</span>
          <span>${done} / ${items.length}（${pct}%）</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${short}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  if (items.length === 0) {
    const icons = { daily:'☀️', weekly:'📅', monthly:'🗓️', yearly:'🎯' };
    list.innerHTML = `<div class="empty-state">
      <div class="icon">${icons[period]}</div>
      <p>TODOがまだありません<br>右下の <strong>+</strong> ボタンで追加しましょう</p>
    </div>`;
    return;
  }

  html += items.map(item => {
    const reverseBtn = period === 'yearly'
      ? `<button class="btn-icon btn-reverse" onclick="openReversePlan('${esc(item.id)}')" title="逆算プラン">⬇️</button>`
      : '';
    return `
      <div class="todo-card ${period}${item.completed ? ' completed' : ''}" id="card-${esc(item.id)}">
        <div class="todo-checkbox${item.completed ? ' checked' : ''}"
             onclick="toggleComplete('${esc(item.id)}','${period}')">${item.completed ? '✓' : ''}</div>
        <div class="todo-content">
          <div class="micro-label">目的</div>
          <div class="todo-goal">${item.goalHtml || ''}</div>
          ${item.actionHtml ? `
            <div class="micro-label" style="margin-top:8px">どうする？</div>
            <div class="todo-action">${item.actionHtml}</div>
          ` : ''}
        </div>
        <div class="todo-actions">
          ${reverseBtn}
          <button class="btn-icon btn-delete" onclick="deleteTodo('${esc(item.id)}','${period}')" title="削除">🗑</button>
        </div>
      </div>`;
  }).join('');

  list.innerHTML = html;
}

function esc(str) {
  return String(str).replace(/'/g, "\\'");
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
function toggleComplete(id, period) {
  const item = (store[period] || []).find(i => i.id === id);
  if (item) { item.completed = !item.completed; saveToStorage(); renderTodos(period); }
}

function deleteTodo(id, period) {
  store[period] = (store[period] || []).filter(i => i.id !== id);
  saveToStorage();
  renderTodos(period);
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'TODO を追加';
  document.getElementById('goal-editor').innerHTML = '';
  document.getElementById('action-editor').innerHTML = '';
  document.getElementById('period-select').value = currentTab;
  document.getElementById('modal').classList.add('active');
  setTimeout(() => document.getElementById('goal-editor').focus(), 120);
}

function closeModal(e) { if (e.target === e.currentTarget) closeModalDirect(); }
function closeModalDirect() {
  document.getElementById('modal').classList.remove('active');
  editingId = null;
}

function saveTodo() {
  const goalHtml   = document.getElementById('goal-editor').innerHTML.trim();
  const actionHtml = document.getElementById('action-editor').innerHTML.trim();
  const period     = document.getElementById('period-select').value;

  const plain = stripTags(goalHtml);
  if (!plain) { alert('「目的」を入力してください'); return; }

  const item = {
    id:        editingId || Date.now().toString() + Math.random().toString(36).slice(2),
    goalHtml,
    actionHtml,
    completed: false,
    createdAt: new Date().toISOString(),
    period
  };

  if (editingId) {
    const idx = (store[period] || []).findIndex(i => i.id === editingId);
    if (idx >= 0) store[period][idx] = item; else store[period].push(item);
  } else {
    if (!store[period]) store[period] = [];
    store[period].push(item);
  }

  saveToStorage();
  renderTodos(period);
  closeModalDirect();
}

function stripTags(html) {
  const d = document.createElement('div'); d.innerHTML = html; return d.textContent.trim();
}

// ─── Reverse Plan Modal ───────────────────────────────────────────────────────
function openReversePlan(id) {
  const item = (store.yearly || []).find(i => i.id === id);
  if (!item) return;
  reverseTarget = item;

  document.getElementById('reverse-goal-text').textContent = '🎯 目標: ' + stripTags(item.goalHtml);
  ['monthly-breakdown','weekly-breakdown','daily-breakdown'].forEach(k => {
    document.getElementById(k).value = '';
  });
  document.getElementById('reverse-modal').classList.add('active');
}

function closeReverseModal(e) { if (e.target === e.currentTarget) closeReverseModalDirect(); }
function closeReverseModalDirect() {
  document.getElementById('reverse-modal').classList.remove('active');
  reverseTarget = null;
}

function applyReversePlan() {
  if (!reverseTarget) return;
  const goalText = stripTags(reverseTarget.goalHtml);

  const mapping = [
    { key: 'monthly-breakdown', period: 'monthly' },
    { key: 'weekly-breakdown',  period: 'weekly'  },
    { key: 'daily-breakdown',   period: 'daily'   },
  ];

  const added = [];
  mapping.forEach(({ key, period }) => {
    const val = document.getElementById(key).value.trim();
    if (!val) return;
    val.split('\n').filter(l => l.trim()).forEach(line => {
      if (!store[period]) store[period] = [];
      store[period].push({
        id:        Date.now().toString() + Math.random().toString(36).slice(2),
        goalHtml:  escapeHtml(line.trim()),
        actionHtml: `<span style="color:#718096">年間目標より逆算：${escapeHtml(goalText)}</span>`,
        completed: false,
        createdAt: new Date().toISOString(),
        period
      });
      if (!added.includes(PERIOD_LABEL[period])) added.push(PERIOD_LABEL[period]);
    });
  });

  saveToStorage();
  renderAll();
  closeReverseModalDirect();
  if (added.length) alert(added.join('・') + ' のTODOに追加しました！');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Color Palette (per-character coloring) ──────────────────────────────────
function initColorPalettes(name) {
  const palette = document.getElementById(name + '-colors');
  const editor  = document.getElementById(name + '-editor');
  if (!palette || !editor) return;

  // Label
  const lbl = document.createElement('span');
  lbl.className = 'palette-label';
  lbl.textContent = '文字色：';
  palette.appendChild(lbl);

  // Reset swatch
  const reset = document.createElement('div');
  reset.className = 'color-swatch reset';
  reset.title = '色をリセット';
  reset.addEventListener('mousedown', e => {
    e.preventDefault();
    restoreSelection(name);
    document.execCommand('removeFormat', false, null);
  });
  palette.appendChild(reset);

  // Color swatches
  COLORS.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.background = color.value;
    sw.title = color.name;
    sw.addEventListener('mousedown', e => {
      e.preventDefault();
      restoreSelection(name);
      document.execCommand('foreColor', false, color.value);
    });
    palette.appendChild(sw);
  });

  // Save selection on user interaction
  editor.addEventListener('mouseup', () => saveSelection(name));
  editor.addEventListener('keyup',   () => saveSelection(name));
  editor.addEventListener('focus',   () => { activeEditor = name; });
}

function saveSelection(name) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    savedRange   = sel.getRangeAt(0).cloneRange();
    activeEditor = name;
  }
}

function restoreSelection(name) {
  const editor = document.getElementById(name + '-editor');
  if (!editor) return;
  editor.focus();
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

// ─── Expose globals ───────────────────────────────────────────────────────────
window.setFont              = setFont;
window.switchTab            = switchTab;
window.openAddModal         = openAddModal;
window.closeModal           = closeModal;
window.closeModalDirect     = closeModalDirect;
window.saveTodo             = saveTodo;
window.toggleComplete       = toggleComplete;
window.deleteTodo           = deleteTodo;
window.openReversePlan      = openReversePlan;
window.closeReverseModal    = closeReverseModal;
window.closeReverseModalDirect = closeReverseModalDirect;
window.applyReversePlan     = applyReversePlan;

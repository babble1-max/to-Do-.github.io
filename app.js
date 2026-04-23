'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
let store = { daily: [], weekly: [], monthly: [], yearly: [] };
let currentTab    = 'daily';
let editingId     = null;
let reverseTarget = null;
let savedRange    = null;
let activeEditor  = null;
const collapsedGroups = new Set();

const TODAY     = new Date();
const CUR_YEAR  = TODAY.getFullYear();
const CUR_MONTH = TODAY.getMonth() + 1;
const CUR_DAY   = TODAY.getDate();
const CUR_WEEK  = Math.ceil(CUR_DAY / 7);

const COLORS = [
  { name: '黒',      value: '#111111' },
  { name: '赤',      value: '#E53E3E' },
  { name: 'オレンジ', value: '#DD6B20' },
  { name: '黄',      value: '#D69E2E' },
  { name: '緑',      value: '#276749' },
  { name: '青',      value: '#2B6CB0' },
  { name: '水色',    value: '#2C7A7B' },
  { name: '紫',      value: '#6B46C1' },
  { name: 'ピンク',  value: '#B83280' },
  { name: '茶',      value: '#744210' },
  { name: '薄灰',    value: '#718096' },
];

const PERIOD_LABEL = { daily: '今日', weekly: '今週', monthly: '今月', yearly: '今年' };
const SHORT = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  initColorPalettes('goal');
  initColorPalettes('action');
  initDateSelectors();
  renderAll();

  const savedFont = localStorage.getItem('todo-font') || 'gothic';
  applyFont(savedFont);

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
function setFont(type) { applyFont(type); localStorage.setItem('todo-font', type); }

function applyFont(type) {
  document.body.classList.remove('font-gothic', 'font-mincho', 'font-cute');
  document.body.classList.add('font-' + type);
  document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-' + type);
  if (btn) btn.classList.add('active');
}

// ─── Date Selectors Init ─────────────────────────────────────────────────────
function initDateSelectors() {
  const selYear = document.getElementById('sel-year');
  for (let y = CUR_YEAR - 1; y <= CUR_YEAR + 5; y++) {
    const o = new Option(y + '年', y, y === CUR_YEAR, y === CUR_YEAR);
    selYear.appendChild(o);
  }

  const selMonth = document.getElementById('sel-month');
  for (let m = 1; m <= 12; m++) {
    const o = new Option(m + '月', m, m === CUR_MONTH, m === CUR_MONTH);
    selMonth.appendChild(o);
  }

  const selWeek = document.getElementById('sel-week');
  for (let w = 1; w <= 5; w++) {
    const o = new Option('第' + w + '週', w, w === CUR_WEEK, w === CUR_WEEK);
    selWeek.appendChild(o);
  }

  const selDay = document.getElementById('sel-day');
  for (let d = 1; d <= 31; d++) {
    const o = new Option(d + '日', d, d === CUR_DAY, d === CUR_DAY);
    selDay.appendChild(o);
  }
}

// Show/hide date columns based on selected period
function onPeriodChange() {
  const period = document.getElementById('period-select').value;

  const visible = {
    yearly:  ['col-year'],
    monthly: ['col-year', 'col-month'],
    weekly:  ['col-year', 'col-month', 'col-week'],
    daily:   ['col-year', 'col-month', 'col-day'],
  }[period] || ['col-year'];

  ['col-year', 'col-month', 'col-week', 'col-day'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !visible.includes(id));
  });

  const dateLabels = {
    yearly:  '📅 何年用？',
    monthly: '📅 何年の何月用？',
    weekly:  '📅 何年の何月の第何週用？',
    daily:   '📅 何年の何月何日用？',
  };
  const lbl = document.getElementById('date-label');
  if (lbl) lbl.textContent = dateLabels[period] || '📅 いつ用？';
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

function renderAll() { Object.keys(store).forEach(renderTodos); }

// ─── Render ───────────────────────────────────────────────────────────────────
function renderTodos(period) {
  const list = document.getElementById(period + '-list');
  if (!list) return;
  const items = store[period] || [];
  const short = SHORT[period];

  if (items.length === 0) {
    const icons = { daily: '☀️', weekly: '📅', monthly: '🗓️', yearly: '🎯' };
    list.innerHTML = `<div class="empty-state">
      <div class="icon">${icons[period]}</div>
      <p>TODOがまだありません<br>右下の <strong>+</strong> ボタンで追加しましょう</p>
    </div>`;
    return;
  }

  const done = items.filter(i => i.completed).length;
  const pct  = Math.round((done / items.length) * 100);
  let html = `
    <div class="progress-section">
      <div class="progress-label">
        <span>進捗</span><span>${done} / ${items.length}（${pct}%）</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${short}" style="width:${pct}%"></div>
      </div>
    </div>`;

  const sorted = sortItems(items, period);

  if (period === 'yearly') {
    html += sorted.map(item => buildCard(item, period)).join('');
  } else if (period === 'monthly') {
    html += buildGrouped(sorted, period,
      i => String(i.year || 0),
      i => (i.year ? i.year + '年' : '年不明')
    );
  } else {
    // daily / weekly — group by year-month
    html += buildGrouped(sorted, period,
      i => `${i.year || 0}-${String(i.month || 0).padStart(2, '0')}`,
      i => (i.year && i.month ? `${i.year}年${i.month}月` : '日付不明')
    );
  }

  list.innerHTML = html;
}

function buildGrouped(items, period, keyFn, labelFn) {
  const groups = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, { label: labelFn(item), items: [] });
    groups.get(key).items.push(item);
  });

  let html = '';
  groups.forEach((group, key) => {
    const gid    = `grp-${period}-${key}`;
    const isOpen = !collapsedGroups.has(gid);
    html += `
      <div class="group-header${isOpen ? '' : ' collapsed'}" onclick="toggleGroup('${gid}')">
        <span class="group-arrow">▼</span>
        <span class="group-title">${group.label}</span>
        <span class="group-count">${group.items.length}件</span>
      </div>
      <div class="group-body${isOpen ? '' : ' collapsed'}" id="${gid}">
        <div class="todo-list">${group.items.map(i => buildCard(i, period)).join('')}</div>
      </div>`;
  });
  return html;
}

function buildCard(item, period) {
  const dateBadge  = buildDateBadge(item, period);
  const reverseBtn = period === 'yearly'
    ? `<button class="btn-icon btn-reverse" onclick="openReversePlan('${esc(item.id)}')" title="逆算プラン">⬇️</button>`
    : '';
  return `
    <div class="todo-card ${period}${item.completed ? ' completed' : ''}" id="card-${esc(item.id)}">
      <div class="todo-checkbox${item.completed ? ' checked' : ''}"
           onclick="toggleComplete('${esc(item.id)}','${period}')">${item.completed ? '✓' : ''}</div>
      <div class="todo-content">
        ${dateBadge}
        <div class="micro-label">目的</div>
        <div class="todo-goal">${item.goalHtml || ''}</div>
        ${item.actionHtml ? `
          <div class="micro-label" style="margin-top:8px">どうする？</div>
          <div class="todo-action">${item.actionHtml}</div>` : ''}
      </div>
      <div class="todo-actions">
        ${reverseBtn}
        <button class="btn-icon btn-delete" onclick="deleteTodo('${esc(item.id)}','${period}')" title="削除">🗑</button>
      </div>
    </div>`;
}

function buildDateBadge(item, period) {
  const short = SHORT[period];
  let text = '';
  if (period === 'yearly'  && item.year)                       text = `${item.year}年`;
  if (period === 'monthly' && item.year && item.month)         text = `${item.month}月`;
  if (period === 'weekly'  && item.year && item.month && item.week) text = `第${item.week}週`;
  if (period === 'daily'   && item.year && item.month && item.day)  text = `${item.month}月${item.day}日`;
  if (!text) return '';
  return `<div class="date-badge ${short}">${text}</div>`;
}

function sortItems(items, period) {
  return [...items].sort((a, b) => dateVal(a, period) - dateVal(b, period));
}

function dateVal(item, period) {
  const y = item.year  || 0;
  const m = item.month || 0;
  const d = item.day   || 0;
  const w = item.week  || 0;
  if (period === 'yearly')  return y;
  if (period === 'monthly') return y * 100 + m;
  if (period === 'weekly')  return y * 10000 + m * 100 + w;
  if (period === 'daily')   return y * 10000 + m * 100 + d;
  return 0;
}

function toggleGroup(gid) {
  const body   = document.getElementById(gid);
  const header = body?.previousElementSibling;
  if (!body) return;
  if (collapsedGroups.has(gid)) {
    collapsedGroups.delete(gid);
    body.classList.remove('collapsed');
    header?.classList.remove('collapsed');
  } else {
    collapsedGroups.add(gid);
    body.classList.add('collapsed');
    header?.classList.add('collapsed');
  }
}

function esc(str) { return String(str).replace(/'/g, "\\'"); }

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

// ─── Add Modal ────────────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'TODO を追加';
  document.getElementById('goal-editor').innerHTML   = '';
  document.getElementById('action-editor').innerHTML = '';

  const psel = document.getElementById('period-select');
  psel.value = currentTab;

  // Reset date selectors to today
  document.getElementById('sel-year').value  = CUR_YEAR;
  document.getElementById('sel-month').value = CUR_MONTH;
  document.getElementById('sel-week').value  = CUR_WEEK;
  document.getElementById('sel-day').value   = CUR_DAY;

  onPeriodChange();
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

  if (!stripTags(goalHtml)) { alert('「目的」を入力してください'); return; }

  const year  = parseInt(document.getElementById('sel-year').value)  || CUR_YEAR;
  const month = parseInt(document.getElementById('sel-month').value) || CUR_MONTH;
  const week  = parseInt(document.getElementById('sel-week').value)  || CUR_WEEK;
  const day   = parseInt(document.getElementById('sel-day').value)   || CUR_DAY;

  const item = {
    id:        editingId || Date.now().toString() + Math.random().toString(36).slice(2),
    goalHtml,
    actionHtml,
    completed: false,
    createdAt: new Date().toISOString(),
    period,
    year,
    month: ['monthly','weekly','daily'].includes(period) ? month : undefined,
    week:  period === 'weekly' ? week : undefined,
    day:   period === 'daily'  ? day  : undefined,
  };

  if (!store[period]) store[period] = [];
  if (editingId) {
    const idx = store[period].findIndex(i => i.id === editingId);
    if (idx >= 0) store[period][idx] = item; else store[period].push(item);
  } else {
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
  const baseYear = reverseTarget.year || CUR_YEAR;

  const mapping = [
    { key: 'monthly-breakdown', period: 'monthly',
      extra: () => ({ year: baseYear, month: CUR_MONTH }) },
    { key: 'weekly-breakdown',  period: 'weekly',
      extra: () => ({ year: baseYear, month: CUR_MONTH, week: CUR_WEEK }) },
    { key: 'daily-breakdown',   period: 'daily',
      extra: () => ({ year: baseYear, month: CUR_MONTH, day: CUR_DAY }) },
  ];

  const added = [];
  mapping.forEach(({ key, period, extra }) => {
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
        period,
        ...extra()
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

// ─── Color Palette ────────────────────────────────────────────────────────────
function initColorPalettes(name) {
  const palette = document.getElementById(name + '-colors');
  const editor  = document.getElementById(name + '-editor');
  if (!palette || !editor) return;

  const lbl = document.createElement('span');
  lbl.className = 'palette-label';
  lbl.textContent = '文字色：';
  palette.appendChild(lbl);

  const reset = document.createElement('div');
  reset.className = 'color-swatch reset';
  reset.title = '色をリセット';
  reset.addEventListener('mousedown', e => {
    e.preventDefault();
    restoreSelection(name);
    document.execCommand('removeFormat', false, null);
  });
  palette.appendChild(reset);

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
window.setFont                 = setFont;
window.switchTab               = switchTab;
window.onPeriodChange          = onPeriodChange;
window.openAddModal            = openAddModal;
window.closeModal              = closeModal;
window.closeModalDirect        = closeModalDirect;
window.saveTodo                = saveTodo;
window.toggleComplete          = toggleComplete;
window.deleteTodo              = deleteTodo;
window.toggleGroup             = toggleGroup;
window.openReversePlan         = openReversePlan;
window.closeReverseModal       = closeReverseModal;
window.closeReverseModalDirect = closeReverseModalDirect;
window.applyReversePlan        = applyReversePlan;

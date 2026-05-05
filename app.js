'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let store = { daily: [], weekly: [], monthly: [], yearly: [] };
let currentTab    = 'daily';
let editingId     = null;
let reverseTarget = null;
let savedRange    = null;
const collapsedGroups = new Set();

const TODAY     = new Date();
const CUR_YEAR  = TODAY.getFullYear();
const CUR_MONTH = TODAY.getMonth() + 1;
const CUR_DAY   = TODAY.getDate();
const CUR_WEEK  = Math.ceil(CUR_DAY / 7);

let calYear  = CUR_YEAR;
let calMonth = CUR_MONTH;

let reminderSettings = { enabled: false, time: '09:00' };
let reminderTimerId  = null;

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
const SHORT        = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadStore();
  loadReminderSettings();
  initColorPalettes('goal');
  initColorPalettes('action');
  initDateSelectors();
  initTargetSelectors();
  applyFont(localStorage.getItem('todo-font') || 'gothic');
  renderAll();
  updateBellBtn();
  updatePermissionStatus();
  if (reminderSettings.enabled) scheduleReminder();
  setInterval(checkPerTodoReminders, 60000);
});

// ─── localStorage ─────────────────────────────────────────────────────────────
function loadStore() {
  try {
    const raw = localStorage.getItem('todo-store');
    if (raw) store = Object.assign({ daily: [], weekly: [], monthly: [], yearly: [] }, JSON.parse(raw));
  } catch (_) {}
}

function saveStore() {
  localStorage.setItem('todo-store', JSON.stringify(store));
}

function loadReminderSettings() {
  try {
    const raw = localStorage.getItem('reminder-settings');
    if (raw) reminderSettings = JSON.parse(raw);
  } catch (_) {}
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

// ─── Date Selectors ───────────────────────────────────────────────────────────
function initDateSelectors() {
  const sy = document.getElementById('sel-year');
  for (let y = CUR_YEAR - 1; y <= CUR_YEAR + 5; y++)
    sy.appendChild(new Option(y + '年', y, y === CUR_YEAR, y === CUR_YEAR));

  const sm = document.getElementById('sel-month');
  for (let m = 1; m <= 12; m++)
    sm.appendChild(new Option(m + '月', m, m === CUR_MONTH, m === CUR_MONTH));

  const sw = document.getElementById('sel-week');
  for (let w = 1; w <= 5; w++)
    sw.appendChild(new Option('第' + w + '週', w, w === CUR_WEEK, w === CUR_WEEK));

  const sd = document.getElementById('sel-day');
  for (let d = 1; d <= 31; d++)
    sd.appendChild(new Option(d + '日', d, d === CUR_DAY, d === CUR_DAY));
}

function initTargetSelectors() {
  const stm = document.getElementById('sel-target-month');
  for (let m = 1; m <= 12; m++) stm.appendChild(new Option(m + '月', m));

  const stw = document.getElementById('sel-target-week');
  for (let w = 1; w <= 5; w++) stw.appendChild(new Option('第' + w + '週', w));
}

function onPeriodChange() {
  const period = document.getElementById('period-select').value;

  const showDate = {
    yearly:  ['col-year'],
    monthly: ['col-year', 'col-month'],
    weekly:  ['col-year', 'col-month', 'col-week'],
    daily:   ['col-year', 'col-month', 'col-day'],
  }[period] || ['col-year'];
  ['col-year','col-month','col-week','col-day'].forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', !showDate.includes(id));
  });

  const dateLabels = {
    yearly:  '📅 何年用？',
    monthly: '📅 何年の何月用？',
    weekly:  '📅 何年の何月の第何週用？',
    daily:   '📅 何年の何月何日用？',
  };
  const lbl = document.getElementById('date-label');
  if (lbl) lbl.textContent = dateLabels[period] || '📅 いつ用？';

  // 達成期限フィールド
  const tg  = document.getElementById('target-group');
  const tcm = document.getElementById('target-col-month');
  const tcw = document.getElementById('target-col-week');
  const tl  = document.getElementById('target-label');
  if (period === 'yearly') {
    tg.style.display = 'block';
    tcm.classList.remove('hidden'); tcw.classList.add('hidden');
    tl.textContent = '🏁 何月までに達成？（任意）';
  } else if (period === 'monthly') {
    tg.style.display = 'block';
    tcm.classList.add('hidden'); tcw.classList.remove('hidden');
    tl.textContent = '🏁 第何週までに達成？（任意）';
  } else {
    tg.style.display = 'none';
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(period) {
  currentTab = period;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + period)?.classList.add('active');
  document.getElementById(period)?.classList.add('active');
  if (period === 'calendar') renderCalendar();
  else renderTodos(period);
}

function renderAll() {
  ['daily','weekly','monthly','yearly'].forEach(renderTodos);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderTodos(period) {
  const list = document.getElementById(period + '-list');
  if (!list) return;
  const items = store[period] || [];
  const short = SHORT[period];

  if (items.length === 0) {
    const icons = { daily:'☀️', weekly:'📅', monthly:'🗓️', yearly:'🎯' };
    list.innerHTML = `<div class="empty-state">
      <div class="icon">${icons[period]}</div>
      <p>TODOがまだありません<br>右下の <strong>+</strong> ボタンで追加しましょう</p>
    </div>`;
    return;
  }

  const done = items.filter(i => i.completed).length;
  const pct  = Math.round((done / items.length) * 100);
  let html = `<div class="progress-section">
    <div class="progress-label"><span>進捗</span><span>${done} / ${items.length}（${pct}%）</span></div>
    <div class="progress-bar"><div class="progress-fill ${short}" style="width:${pct}%"></div></div>
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
    html += buildGrouped(sorted, period,
      i => `${i.year || 0}-${String(i.month || 0).padStart(2,'0')}`,
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
  const dateBadge   = buildDateBadge(item, period);
  const targetBadge = buildTargetBadge(item, period);
  const remIcon     = (item.reminder && item.reminder.enabled)
    ? `<span title="リマインダー: ${item.reminder.time}" style="font-size:12px">🔔</span>` : '';
  const canReverse  = period === 'yearly' || period === 'monthly';
  const reverseBtn  = canReverse
    ? `<button class="btn-icon btn-reverse" onclick="openReversePlan('${esc(item.id)}','${period}')" title="逆算">⬇️</button>`
    : '';
  return `
    <div class="todo-card ${period}${item.completed ? ' completed' : ''}" id="card-${esc(item.id)}">
      <div class="todo-checkbox${item.completed ? ' checked' : ''}"
           onclick="toggleComplete('${esc(item.id)}','${period}')">${item.completed ? '✓' : ''}</div>
      <div class="todo-content">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:4px">
          ${dateBadge}${targetBadge}${remIcon}
        </div>
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
  const s = SHORT[period];
  let text = '';
  if (period === 'yearly'  && item.year)                             text = `${item.year}年`;
  if (period === 'monthly' && item.year && item.month)               text = `${item.month}月`;
  if (period === 'weekly'  && item.year && item.month && item.week)  text = `第${item.week}週`;
  if (period === 'daily'   && item.year && item.month && item.day)   text = `${item.month}月${item.day}日`;
  return text ? `<div class="date-badge ${s}">${text}</div>` : '';
}

function buildTargetBadge(item, period) {
  if (period === 'yearly'  && item.targetMonth) return `<span class="target-badge">🏁 ${item.targetMonth}月までに</span>`;
  if (period === 'monthly' && item.targetWeek)  return `<span class="target-badge">🏁 第${item.targetWeek}週までに</span>`;
  return '';
}

function sortItems(items, period) {
  return [...items].sort((a, b) => dateVal(a, period) - dateVal(b, period));
}
function dateVal(item, period) {
  const y = item.year || 0, m = item.month || 0, d = item.day || 0, w = item.week || 0;
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
  if (item) { item.completed = !item.completed; saveStore(); renderTodos(period); }
}

function deleteTodo(id, period) {
  store[period] = (store[period] || []).filter(i => i.id !== id);
  saveStore();
  renderTodos(period);
}

// ─── Add Modal ────────────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'TODO を追加';
  document.getElementById('goal-editor').innerHTML   = '';
  document.getElementById('action-editor').innerHTML = '';

  const psel = document.getElementById('period-select');
  psel.value = (currentTab === 'calendar') ? 'daily' : currentTab;

  document.getElementById('sel-year').value  = CUR_YEAR;
  document.getElementById('sel-month').value = CUR_MONTH;
  document.getElementById('sel-week').value  = CUR_WEEK;
  document.getElementById('sel-day').value   = CUR_DAY;
  document.getElementById('sel-target-month').value = '';
  document.getElementById('sel-target-week').value  = '';

  const cbRem = document.getElementById('cb-reminder');
  cbRem.checked = false;
  updateToggleText(cbRem, 'toggle-text');
  document.getElementById('reminder-time-input').value = reminderSettings.time || '09:00';

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

  const rawTM = document.getElementById('sel-target-month').value;
  const rawTW = document.getElementById('sel-target-week').value;
  const targetMonth = rawTM ? parseInt(rawTM) : undefined;
  const targetWeek  = rawTW ? parseInt(rawTW) : undefined;

  const cbRem   = document.getElementById('cb-reminder');
  const remTime = document.getElementById('reminder-time-input').value;
  const reminder = cbRem.checked ? { enabled: true, time: remTime } : { enabled: false };

  const item = {
    id:          editingId || genId(),
    goalHtml, actionHtml,
    completed:   false,
    createdAt:   new Date().toISOString(),
    period,
    year,
    month:       ['monthly','weekly','daily'].includes(period) ? month : undefined,
    week:        period === 'weekly' ? week : undefined,
    day:         period === 'daily'  ? day  : undefined,
    targetMonth: period === 'yearly'  ? targetMonth : undefined,
    targetWeek:  period === 'monthly' ? targetWeek  : undefined,
    reminder,
  };

  if (!store[period]) store[period] = [];
  if (editingId) {
    const idx = store[period].findIndex(i => i.id === editingId);
    if (idx >= 0) store[period][idx] = item; else store[period].push(item);
  } else {
    store[period].push(item);
  }

  saveStore();
  renderTodos(period);
  if (currentTab === 'calendar') renderCalendar();
  closeModalDirect();
}

// ─── Reverse Plan ─────────────────────────────────────────────────────────────
function openReversePlan(id, period) {
  const item = (store[period] || []).find(i => i.id === id);
  if (!item) return;
  reverseTarget = { ...item, srcPeriod: period };

  document.getElementById('reverse-goal-text').textContent = '🎯 ' + stripTags(item.goalHtml);

  const isYearly  = period === 'yearly';
  const isMonthly = period === 'monthly';
  document.getElementById('reverse-months-section').style.display = isYearly  ? 'block' : 'none';
  document.getElementById('reverse-weeks-section').style.display  = isMonthly ? 'block' : 'none';

  document.querySelectorAll('.pgrid-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('daily-breakdown').value = '';
  document.getElementById('reverse-modal').classList.add('active');
}

function togglePgrid(btn) { btn.classList.toggle('selected'); }

function closeReverseModal(e) { if (e.target === e.currentTarget) closeReverseModalDirect(); }
function closeReverseModalDirect() {
  document.getElementById('reverse-modal').classList.remove('active');
  reverseTarget = null;
}

function applyReversePlan() {
  if (!reverseTarget) return;
  const { srcPeriod, year: srcYear, month: srcMonth, goalHtml } = reverseTarget;
  const goalText = stripTags(goalHtml);
  const baseYear = srcYear || CUR_YEAR;
  const added = [];

  // 年 → 月
  if (srcPeriod === 'yearly') {
    [...document.querySelectorAll('#month-grid .pgrid-btn.selected')]
      .map(b => parseInt(b.dataset.month))
      .forEach(m => {
        store.monthly.push({
          id: genId(), goalHtml,
          actionHtml: `<span style="color:#718096">年間目標より逆算：${esc2(goalText)}</span>`,
          completed: false, createdAt: new Date().toISOString(),
          period: 'monthly', year: baseYear, month: m, reminder: { enabled: false },
        });
        if (!added.includes('今月')) added.push('今月');
      });
  }

  // 月 → 週
  if (srcPeriod === 'monthly') {
    [...document.querySelectorAll('#week-grid .pgrid-btn.selected')]
      .map(b => parseInt(b.dataset.week))
      .forEach(w => {
        store.weekly.push({
          id: genId(), goalHtml,
          actionHtml: `<span style="color:#718096">月間目標より逆算：${esc2(goalText)}</span>`,
          completed: false, createdAt: new Date().toISOString(),
          period: 'weekly', year: baseYear, month: srcMonth || CUR_MONTH, week: w, reminder: { enabled: false },
        });
        if (!added.includes('今週')) added.push('今週');
      });
  }

  // テキスト入力 → 今日
  const dailyText = document.getElementById('daily-breakdown').value.trim();
  if (dailyText) {
    dailyText.split('\n').filter(l => l.trim()).forEach(line => {
      store.daily.push({
        id: genId(), goalHtml: esc2(line.trim()),
        actionHtml: `<span style="color:#718096">逆算：${esc2(goalText)}</span>`,
        completed: false, createdAt: new Date().toISOString(),
        period: 'daily', year: baseYear, month: srcMonth || CUR_MONTH, day: CUR_DAY, reminder: { enabled: false },
      });
      if (!added.includes('今日')) added.push('今日');
    });
  }

  if (!added.length) { alert('月・週を選択するか、アクションを入力してください'); return; }
  saveStore();
  renderAll();
  if (currentTab === 'calendar') renderCalendar();
  closeReverseModalDirect();
  alert(added.join('・') + ' のTODOに追加しました！');
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function renderCalendar() {
  const lbl = document.getElementById('cal-month-label');
  if (lbl) lbl.textContent = `${calYear}年${calMonth}月`;

  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const firstDay    = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const monthTodos  = getTodosForCalMonth(calYear, calMonth);

  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday  = (calYear === CUR_YEAR && calMonth === CUR_MONTH && d === CUR_DAY);
    const dayTodos = monthTodos.filter(t => todoOnDay(t, d, calYear, calMonth));
    const dots     = dayTodos.slice(0, 4).map(t => `<div class="cal-dot ${SHORT[t.period] || 'day'}"></div>`).join('');
    const more     = dayTodos.length > 4 ? `<span class="cal-more">+${dayTodos.length - 4}</span>` : '';
    html += `<div class="cal-day${isToday ? ' today' : ''}" onclick="openDayDetail(${calYear},${calMonth},${d})">
      <div class="cal-day-num${dayTodos.length ? ' has-todo' : ''}">${d}</div>
      <div class="cal-dots">${dots}${more}</div>
    </div>`;
  }
  grid.innerHTML = html;
}

function getTodosForCalMonth(year, month) {
  const result = [];
  (store.daily   || []).filter(t => t.year === year && t.month === month).forEach(t => result.push(t));
  (store.weekly  || []).filter(t => t.year === year && t.month === month).forEach(t => result.push(t));
  (store.monthly || []).filter(t => t.year === year && t.month === month).forEach(t => result.push(t));
  (store.yearly  || []).filter(t => t.year === year && (t.targetMonth || 1) === month).forEach(t => result.push(t));
  return result;
}

function todoOnDay(todo, day, year, month) {
  if (todo.period === 'daily')   return todo.year === year && todo.month === month && todo.day === day;
  if (todo.period === 'weekly')  return todo.year === year && todo.month === month && day === ((todo.week - 1) * 7 + 1);
  if (todo.period === 'monthly') return todo.year === year && todo.month === month && day === 1;
  if (todo.period === 'yearly')  return month === (todo.targetMonth || 1) && day === 1;
  return false;
}

function calPrev() {
  calMonth--;
  if (calMonth < 1) { calMonth = 12; calYear--; }
  renderCalendar();
}
function calNext() {
  calMonth++;
  if (calMonth > 12) { calMonth = 1; calYear++; }
  renderCalendar();
}

// ─── Day Detail ───────────────────────────────────────────────────────────────
function openDayDetail(year, month, day) {
  const todos = getTodosForCalMonth(year, month).filter(t => todoOnDay(t, day, year, month));
  if (!todos.length) return;

  document.getElementById('day-detail-title').textContent = `${year}年${month}月${day}日`;
  document.getElementById('day-detail-list').innerHTML = todos.map(t => {
    const s    = SHORT[t.period] || 'day';
    const lbl  = PERIOD_LABEL[t.period] || '';
    const gcal = buildGcalUrl(t, year, month, day);
    return `<div class="day-detail-item">
      <span class="period-chip ${s}">${lbl}</span>
      <div class="todo-goal" style="margin-top:4px">${t.goalHtml || ''}</div>
      ${t.actionHtml ? `<div class="todo-action">${t.actionHtml}</div>` : ''}
      <a href="${gcal}" target="_blank" rel="noopener" class="gcal-add-btn">📅 Googleカレンダーに追加</a>
    </div>`;
  }).join('');
  document.getElementById('day-detail-modal').classList.add('active');
}

function buildGcalUrl(item, year, month, day) {
  const title   = encodeURIComponent(stripTags(item.goalHtml || ''));
  const details = encodeURIComponent(stripTags(item.actionHtml || ''));
  const d1 = new Date(year, month - 1, day);
  const d2 = new Date(d1.getTime() + 86400000);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${fmt(d1)}/${fmt(d2)}`;
}

function closeDayDetail(e) { if (e.target === e.currentTarget) closeDayDetailDirect(); }
function closeDayDetailDirect() {
  document.getElementById('day-detail-modal').classList.remove('active');
}

// ─── Reminder Settings ────────────────────────────────────────────────────────
function openReminderSettings() {
  const toggle = document.getElementById('global-reminder-toggle');
  toggle.checked = reminderSettings.enabled;
  document.getElementById('global-reminder-text').textContent = reminderSettings.enabled ? 'オン' : 'オフ';
  document.getElementById('global-reminder-time').value = reminderSettings.time || '09:00';
  document.getElementById('reminder-detail').style.display = reminderSettings.enabled ? 'block' : 'none';
  updatePermissionStatus();
  document.getElementById('reminder-modal').classList.add('active');
}

function onGlobalReminderChange() {
  const on = document.getElementById('global-reminder-toggle').checked;
  document.getElementById('reminder-detail').style.display = on ? 'block' : 'none';
  document.getElementById('global-reminder-text').textContent = on ? 'オン' : 'オフ';
}

function closeReminderSettings(e) { if (e.target === e.currentTarget) closeReminderSettingsDirect(); }
function closeReminderSettingsDirect() {
  document.getElementById('reminder-modal').classList.remove('active');
}

function saveReminderSettings() {
  const enabled = document.getElementById('global-reminder-toggle').checked;
  const time    = document.getElementById('global-reminder-time').value;
  reminderSettings = { enabled, time };
  localStorage.setItem('reminder-settings', JSON.stringify(reminderSettings));
  if (enabled) scheduleReminder(); else cancelReminder();
  updateBellBtn();
  closeReminderSettingsDirect();
  alert(enabled ? `🔔 リマインダーを ${time} に設定しました！` : '🔕 リマインダーをオフにしました。');
}

function updateBellBtn() {
  document.getElementById('bell-btn')?.classList.toggle('active', !!reminderSettings.enabled);
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) { alert('このブラウザは通知未対応です。'); return; }
  await Notification.requestPermission();
  updatePermissionStatus();
}

function updatePermissionStatus() {
  const el = document.getElementById('permission-status');
  if (!el) return;
  if (!('Notification' in window)) { el.textContent = '❌ 通知未対応'; el.style.color = '#E53E3E'; return; }
  const p = Notification.permission;
  el.textContent = p === 'granted' ? '✅ 通知が許可されています' : p === 'denied' ? '❌ 通知が拒否されています' : '⚠️ まだ許可されていません';
  el.style.color  = p === 'granted' ? '#276749' : '#E53E3E';
}

function scheduleReminder() {
  cancelReminder();
  if (!reminderSettings.enabled || !reminderSettings.time) return;
  const [h, m] = reminderSettings.time.split(':').map(Number);
  const now    = new Date();
  let target   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  reminderTimerId = setTimeout(() => {
    fireReminder();
    reminderTimerId = setTimeout(scheduleReminder, 5000);
  }, target - now);
}

function cancelReminder() {
  if (reminderTimerId) { clearTimeout(reminderTimerId); reminderTimerId = null; }
}

function fireReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = (store.daily || []).filter(t =>
    t.year === CUR_YEAR && t.month === CUR_MONTH && t.day === CUR_DAY && !t.completed
  );
  const body = today.length === 0
    ? '今日のTODOはありません！お疲れ様です。'
    : today.slice(0, 3).map(t => '• ' + stripTags(t.goalHtml)).join('\n') +
      (today.length > 3 ? `\n他${today.length - 3}件` : '');
  new Notification(`📋 今日のTODO（${today.length}件）`, { body });
}

function checkPerTodoReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now   = new Date();
  const hhmm  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  Object.keys(store).forEach(period => {
    (store[period] || []).filter(item =>
      item.reminder?.enabled && !item.completed && item.reminder.time === hhmm
    ).forEach(item => {
      new Notification('📋 リマインダー', { body: stripTags(item.goalHtml) });
    });
  });
}

// ─── Color Palette ────────────────────────────────────────────────────────────
function initColorPalettes(name) {
  const palette = document.getElementById(name + '-colors');
  const editor  = document.getElementById(name + '-editor');
  if (!palette || !editor) return;

  const lbl = document.createElement('span');
  lbl.className = 'palette-label'; lbl.textContent = '文字色：';
  palette.appendChild(lbl);

  const reset = document.createElement('div');
  reset.className = 'color-swatch reset'; reset.title = '色をリセット';
  reset.addEventListener('mousedown', e => { e.preventDefault(); restoreSelection(name); document.execCommand('removeFormat', false, null); });
  palette.appendChild(reset);

  COLORS.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch'; sw.style.background = color.value; sw.title = color.name;
    sw.addEventListener('mousedown', e => { e.preventDefault(); restoreSelection(name); document.execCommand('foreColor', false, color.value); });
    palette.appendChild(sw);
  });

  editor.addEventListener('mouseup', () => saveSelection(name));
  editor.addEventListener('keyup',   () => saveSelection(name));
}

function saveSelection(name) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
}
function restoreSelection(name) {
  const editor = document.getElementById(name + '-editor');
  if (!editor) return;
  editor.focus();
  if (savedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripTags(html) {
  const d = document.createElement('div'); d.innerHTML = html; return d.textContent.trim();
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function esc(str) { return String(str).replace(/'/g, "\\'"); }
function esc2(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function updateToggleText(checkbox, cls) {
  const span = checkbox.closest('.toggle-label')?.querySelector('.' + cls);
  if (span) span.textContent = checkbox.checked ? 'オン' : 'オフ';
}

document.addEventListener('change', e => {
  if (e.target.id === 'cb-reminder') updateToggleText(e.target, 'toggle-text');
});

// ─── Expose globals ───────────────────────────────────────────────────────────
Object.assign(window, {
  setFont, switchTab, onPeriodChange,
  openAddModal, closeModal, closeModalDirect, saveTodo,
  toggleComplete, deleteTodo, toggleGroup,
  openReversePlan, togglePgrid, closeReverseModal, closeReverseModalDirect, applyReversePlan,
  calPrev, calNext, openDayDetail, closeDayDetail, closeDayDetailDirect,
  openReminderSettings, onGlobalReminderChange,
  closeReminderSettings, closeReminderSettingsDirect, saveReminderSettings,
  requestNotificationPermission,
});

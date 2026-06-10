// ─── PEATER LUXEFITS — app.js ────────────────────────────────────────────────

// ─── UTILITIES (declared first so init code below can use them) ───────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── STATE ───────────────────────────────────────────────────────────────────
const DEFAULT_PRODUCTS = [
  { id: 'blazers',     name: 'BLAZERS',      emoji: '🧥', price: 0, active: true },
  { id: 'waistcoats',  name: 'WAIST COATS',  emoji: '🥻', price: 0, active: true },
  { id: 'chiffontops', name: 'CHIFFON TOPS', emoji: '👗', price: 0, active: true },
  { id: 'sleeveless',  name: 'SLEEVELESS',   emoji: '👙', price: 0, active: true },
];

let products = load('pl_products', DEFAULT_PRODUCTS);
let cycles   = load('pl_cycles',   []);
let settings = load('pl_settings', { currency: 'K' });

// Ensure there is always at least one cycle
if (!cycles.length) {
  const boot = { id: Date.now(), startDate: todayStr(), restocks: {}, dailyLogs: {} };
  products.forEach(p => { boot.restocks[p.id] = { qty: 0, cost: 0 }; });
  cycles.push(boot);
  save('pl_cycles', cycles);
}

function currentCycle() { return cycles[cycles.length - 1]; }

// ─── FORMATTING ──────────────────────────────────────────────────────────────
function fmt(n) {
  return settings.currency + Math.round(n || 0).toLocaleString();
}

// ─── NOTIFICATION TOAST ──────────────────────────────────────────────────────
let _notifTimer = null;
function notify(msg, dur) {
  dur = dur || 2500;
  const el = document.getElementById('notif');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (_notifTimer) clearTimeout(_notifTimer);
  _notifTimer = setTimeout(() => el.classList.remove('show'), dur);
}

// ─── MODAL HELPERS ───────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── TAB SWITCHING ───────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'summary')  renderSummary();
  if (name === 'profit')   renderProfit();
  if (name === 'settings') renderSettings();
}

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function updateClock() {
  const d = new Date();
  const el = document.getElementById('clockBadge');
  if (el) el.textContent =
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}
updateClock();
setInterval(updateClock, 60000);

// ─── WEEK STRIP ──────────────────────────────────────────────────────────────
let selectedDate = todayStr();

function renderWeekStrip() {
  const strip  = document.getElementById('weekStrip');
  if (!strip) return;
  const today  = new Date();
  const days   = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  // Monday of current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  strip.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d  = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');

    const isToday   = ds === todayStr();
    const isSel     = ds === selectedDate;
    const log       = getDayLog(ds);
    const totalSold = Object.values(log).reduce((a, b) => a + b, 0);
    const totalRev  = calcDayRevenue(ds);

    const cell = document.createElement('div');
    cell.className = 'day-cell' +
      (isToday ? ' today' : '') +
      (isSel   ? ' selected' : '');
    cell.innerHTML =
      '<div class="dn">' + days[i] + '</div>' +
      '<div class="dd">' + d.getDate() + '</div>' +
      '<div class="ds">' + (totalSold > 0 ? totalSold + 'pc' : '\u00a0') + '</div>' +
      '<div class="dp">' + (totalRev  > 0 ? fmt(totalRev) : '') + '</div>';

    // Capture ds in closure
    (function(date) {
      cell.onclick = function() {
        selectedDate = date;
        renderWeekStrip();
        renderProductGrid();
      };
    })(ds);

    strip.appendChild(cell);
  }
}

function getDayLog(ds) {
  return currentCycle().dailyLogs[ds] || {};
}

function calcDayRevenue(ds) {
  const log = getDayLog(ds);
  var rev = 0;
  products.forEach(function(p) {
    if (log[p.id]) rev += log[p.id] * (p.price || 0);
  });
  return rev;
}

// ─── PRODUCT GRID ────────────────────────────────────────────────────────────
function renderProductGrid() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  const cyc = currentCycle();
  const log = getDayLog(selectedDate);
  grid.innerHTML = '';

  const activeProds = products.filter(function(p) { return p.active; });
  if (!activeProds.length) {
    grid.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon">📦</div>' +
      '<div class="empty-text">No active products. Add some in Settings.</div>' +
      '</div>';
    return;
  }

  activeProds.forEach(function(p) {
    const todaySold = log[p.id] || 0;
    const todayRev  = todaySold * (p.price || 0);
    const restock   = cyc.restocks[p.id] || { qty: 0, cost: 0 };
    const totalSold = getTotalSold(p.id);
    const remaining = Math.max(0, restock.qty - totalSold);

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML =
      '<div class="product-name">' + p.emoji + ' ' + p.name + '</div>' +
      '<div class="pc-row">' +
        '<span class="pc-label">Today Sold</span>' +
        '<span class="pc-val">' + todaySold + '<span class="pc-sub">pcs</span></span>' +
      '</div>' +
      '<div class="pc-row">' +
        '<span class="pc-label">Revenue</span>' +
        '<span class="pc-val" style="color:var(--green)">' + fmt(todayRev) + '</span>' +
      '</div>' +
      '<div style="border-top:1px solid var(--border);margin:6px 0"></div>' +
      '<div class="ps-cell">' +
        '<div><div class="ps-num">' + remaining + '</div><div class="ps-lbl">Remaining</div></div>' +
        '<div style="text-align:right"><div class="ps-num" style="color:var(--accent2)">' + totalSold + '</div><div class="ps-lbl">Sold Total</div></div>' +
      '</div>';

    (function(pid) {
      card.onclick = function() { openLogModal(pid); };
    })(p.id);

    grid.appendChild(card);
  });
}

function getTotalSold(pid) {
  var total = 0;
  var logs = currentCycle().dailyLogs;
  Object.keys(logs).forEach(function(ds) { total += logs[ds][pid] || 0; });
  return total;
}

// ─── LOG MODAL ───────────────────────────────────────────────────────────────
function openLogModal(pid) {
  const p       = products.find(function(x) { return x.id === pid; });
  if (!p) return;
  const log     = getDayLog(selectedDate);
  const cyc     = currentCycle();
  const restock = cyc.restocks[pid] || { qty: 0, cost: 0 };
  const prevQty = log[pid] || 0;
  const otherSold = getTotalSold(pid) - prevQty;
  const stockLeft = Math.max(0, restock.qty - otherSold);

  document.getElementById('logModalTitle').textContent = 'LOG ' + p.name;
  document.getElementById('logModalSub').textContent   = 'Date: ' + selectedDate;
  document.getElementById('logModalBody').innerHTML =
    '<div class="input-group">' +
      '<label class="input-label">Units Sold Today</label>' +
      '<input class="input-field" type="number" id="logQty" min="0" max="' + restock.qty + '" ' +
        'value="' + prevQty + '" placeholder="0" inputmode="numeric">' +
    '</div>' +
    '<div class="input-group">' +
      '<label class="input-label">Unit Price (' + settings.currency + ')</label>' +
      '<input class="input-field" type="number" id="logPrice" min="0" ' +
        'value="' + (p.price || 0) + '" placeholder="0" inputmode="decimal">' +
    '</div>' +
    '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;' +
      'padding:10px;margin-bottom:8px;font-size:11px;color:var(--muted)">' +
      'Restocked: <strong style="color:var(--text)">' + restock.qty + '</strong> · ' +
      'Other days: <strong style="color:var(--accent2)">' + otherSold + '</strong> · ' +
      'Available today: <strong style="color:var(--green)">' + stockLeft + '</strong>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-secondary" onclick="closeModal(\'logModal\')">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveLog(\'' + pid + '\')">Save</button>' +
    '</div>';

  openModal('logModal');
  // Auto-focus & select for fast entry
  setTimeout(function() {
    const f = document.getElementById('logQty');
    if (f) { f.focus(); f.select(); }
  }, 120);
}

function saveLog(pid) {
  const qtyEl   = document.getElementById('logQty');
  const priceEl = document.getElementById('logPrice');
  if (!qtyEl || !priceEl) return;

  const qty   = Math.max(0, parseInt(qtyEl.value)    || 0);
  const price = Math.max(0, parseFloat(priceEl.value) || 0);

  // Warn if overselling
  const cyc     = currentCycle();
  const restock = cyc.restocks[pid] || { qty: 0, cost: 0 };
  const prevQty = getDayLog(selectedDate)[pid] || 0;
  const otherSold = getTotalSold(pid) - prevQty;
  if (restock.qty > 0 && (qty + otherSold) > restock.qty) {
    if (!confirm('⚠️ Total sold (' + (qty + otherSold) + ') exceeds restocked stock (' + restock.qty + '). Save anyway?')) return;
  }

  if (!cyc.dailyLogs[selectedDate]) cyc.dailyLogs[selectedDate] = {};
  cyc.dailyLogs[selectedDate][pid] = qty;

  const p = products.find(function(x) { return x.id === pid; });
  if (p) { p.price = price; save('pl_products', products); }
  save('pl_cycles', cycles);

  closeModal('logModal');
  renderWeekStrip();
  renderProductGrid();
  notify('✅ ' + (p ? p.name : pid) + ': ' + qty + ' pcs @ ' + fmt(price));
}

// ─── SUMMARY TAB ─────────────────────────────────────────────────────────────
function renderSummary() {
  const el  = document.getElementById('summaryContent');
  if (!el) return;
  const cyc = currentCycle();

  // Use T00:00:00 to avoid UTC-offset day-drift
  const startD = new Date(cyc.startDate + 'T00:00:00');
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const dayNum = Math.floor((today - startD) / 86400000) + 1;

  var cycleRevenue = 0, cycleCost = 0, cycleSold = 0;
  products.filter(function(p) { return p.active; }).forEach(function(p) {
    const restock = cyc.restocks[p.id] || { qty: 0, cost: 0 };
    const sold    = getTotalSold(p.id);
    cycleRevenue += sold * (p.price || 0);
    cycleCost    += restock.qty * (restock.cost || 0);
    cycleSold    += sold;
  });
  const cycleProfit = cycleRevenue - cycleCost;

  var html =
    '<div class="summary-card">' +
      '<div class="summary-card-title">CYCLE ' + cycles.length +
        ' <span class="badge badge-active">ACTIVE</span></div>' +
      '<div class="stat-row"><span class="stat-label">Started</span><span class="stat-val">' + cyc.startDate + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">Day</span><span class="stat-val blue">' + dayNum + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">Days Logged</span><span class="stat-val">' + Object.keys(cyc.dailyLogs).length + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">Total Sold</span><span class="stat-val">' + cycleSold + ' pcs</span></div>' +
      '<div class="stat-row"><span class="stat-label">Revenue</span><span class="stat-val green">' + fmt(cycleRevenue) + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">Net Profit</span>' +
        '<span class="stat-val ' + (cycleProfit >= 0 ? 'green' : 'red') + '">' + fmt(cycleProfit) + '</span></div>' +
    '</div>';

  products.filter(function(p) { return p.active; }).forEach(function(p) {
    const restock   = cyc.restocks[p.id] || { qty: 0, cost: 0 };
    const totalSold = getTotalSold(p.id);
    const remaining = Math.max(0, restock.qty - totalSold);
    const revenue   = totalSold * (p.price || 0);
    const pct       = restock.qty > 0 ? Math.min(100, Math.round(totalSold / restock.qty * 100)) : 0;

    html +=
      '<div class="summary-card">' +
        '<div class="summary-card-title">' + p.emoji + ' ' + p.name + '</div>' +
        '<div class="stat-row"><span class="stat-label">Restocked</span><span class="stat-val">' + restock.qty + ' pcs</span></div>' +
        '<div class="stat-row"><span class="stat-label">Sold</span><span class="stat-val red">' + totalSold + ' pcs</span></div>' +
        '<div class="stat-row"><span class="stat-label">Remaining</span><span class="stat-val green">' + remaining + ' pcs</span></div>' +
        '<div class="stat-row"><span class="stat-label">Revenue</span><span class="stat-val gold">' + fmt(revenue) + '</span></div>' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div style="font-size:9px;color:var(--muted);margin-top:4px">' + pct + '% sold</div>' +
      '</div>';
  });

  html += '<button class="danger-btn" onclick="openRestockModal()">🔄 Start New Cycle</button>';
  el.innerHTML = html;
}

// ─── RESTOCK (NEW CYCLE) MODAL ───────────────────────────────────────────────
function openRestockModal() {
  var html = '';
  products.filter(function(p) { return p.active; }).forEach(function(p) {
    html +=
      '<div class="input-group">' +
        '<label class="input-label">' + p.emoji + ' ' + p.name + ' — Qty Restocked</label>' +
        '<input class="input-field" type="number" id="restock_' + p.id + '" min="0" value="0" placeholder="0" inputmode="numeric">' +
      '</div>' +
      '<div class="input-group">' +
        '<label class="input-label">' + p.emoji + ' ' + p.name + ' — Cost Per Unit (' + settings.currency + ')</label>' +
        '<input class="input-field" type="number" id="cost_' + p.id + '" min="0" value="' + (p.price || 0) + '" placeholder="0" inputmode="decimal">' +
      '</div>';
  });
  html +=
    '<div class="btn-row">' +
      '<button class="btn btn-secondary" onclick="closeModal(\'restockModal\')">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveRestock()">Start Cycle</button>' +
    '</div>';
  document.getElementById('restockModalBody').innerHTML = html;
  openModal('restockModal');
}

function saveRestock() {
  // Build new cycle
  const cycle = { id: Date.now(), startDate: todayStr(), restocks: {}, dailyLogs: {} };
  products.forEach(function(p) { cycle.restocks[p.id] = { qty: 0, cost: 0 }; });
  cycles.push(cycle);

  const cyc = currentCycle();
  products.filter(function(p) { return p.active; }).forEach(function(p) {
    const qEl = document.getElementById('restock_' + p.id);
    const cEl = document.getElementById('cost_'    + p.id);
    const qty  = Math.max(0, parseInt(qEl   ? qEl.value   : 0) || 0);
    const cost = Math.max(0, parseFloat(cEl ? cEl.value : 0) || 0);
    cyc.restocks[p.id] = { qty: qty, cost: cost };
    p.price = cost;
  });

  save('pl_cycles', cycles);
  save('pl_products', products);
  closeModal('restockModal');
  selectedDate = todayStr();
  renderWeekStrip();
  renderProductGrid();
  notify('🔄 New cycle started!');
}

// ─── PROFIT TAB ──────────────────────────────────────────────────────────────
function renderProfit() {
  const el  = document.getElementById('profitContent');
  if (!el) return;
  const cyc = currentCycle();

  var totalRevenue = 0, totalCost = 0;
  products.forEach(function(p) {
    const restock = cyc.restocks[p.id] || { qty: 0, cost: 0 };
    totalRevenue += getTotalSold(p.id) * (p.price || 0);
    totalCost    += restock.qty * (restock.cost || 0);
  });
  const profit = totalRevenue - totalCost;

  var html =
    '<div class="profit-hero">' +
      '<div class="profit-hero-label">Net Profit — Cycle ' + cycles.length + '</div>' +
      '<div class="profit-hero-val ' + (profit >= 0 ? 'positive' : 'negative') + '">' + fmt(profit) + '</div>' +
    '</div>' +
    '<div class="mini-grid">' +
      '<div class="mini-card">' +
        '<div class="mini-card-label">Revenue</div>' +
        '<div class="mini-card-val" style="color:var(--green)">' + fmt(totalRevenue) + '</div>' +
      '</div>' +
      '<div class="mini-card">' +
        '<div class="mini-card-label">Stock Cost</div>' +
        '<div class="mini-card-val" style="color:var(--accent2)">' + fmt(totalCost) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="summary-card"><div class="summary-card-title">PRODUCT BREAKDOWN</div>';

  products.filter(function(p) { return p.active; }).forEach(function(p) {
    const restock = cyc.restocks[p.id] || { qty: 0, cost: 0 };
    const rev     = getTotalSold(p.id) * (p.price || 0);
    const cost    = restock.qty * (restock.cost || 0);
    const pp      = rev - cost;
    html +=
      '<div class="stat-row">' +
        '<span class="stat-label">' + p.emoji + ' ' + p.name + '</span>' +
        '<span class="stat-val ' + (pp >= 0 ? 'green' : 'red') + '">' + fmt(pp) + '</span>' +
      '</div>';
  });
  html += '</div>';

  // Past cycles — use each cycle's own cost data, and current prices for revenue approximation
  if (cycles.length > 1) {
    html += '<div class="section-title" style="margin-top:16px;margin-bottom:10px">PAST CYCLES</div>';
    for (var i = cycles.length - 2; i >= 0; i--) {
      const c = cycles[i];
      var r = 0, co = 0;
      products.forEach(function(p) {
        const rs   = c.restocks[p.id] || { qty: 0, cost: 0 };
        var sold = 0;
        Object.keys(c.dailyLogs || {}).forEach(function(ds) {
          sold += (c.dailyLogs[ds][p.id] || 0);
        });
        // Use the cost recorded at restock time (accurate); use current price for revenue (best estimate)
        r  += sold * (p.price || 0);
        co += rs.qty * (rs.cost || 0);
      });
      const pr = r - co;
      html +=
        '<div class="past-cycle">' +
          '<div>' +
            '<div class="past-cycle-val">Cycle ' + (i + 1) + '</div>' +
            '<div class="past-cycle-label">' + c.startDate + '</div>' +
          '</div>' +
          '<div class="past-cycle-val" style="color:' + (pr >= 0 ? 'var(--green)' : 'var(--accent2)') + '">' + fmt(pr) + '</div>' +
        '</div>';
    }
  }

  el.innerHTML = html;
}

// ─── SETTINGS TAB ────────────────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  var html =
    '<div class="settings-section">' +
      '<div class="settings-title">GENERAL</div>' +
      '<div class="product-edit-card">' +
        '<div class="input-group">' +
          '<label class="input-label">Currency Symbol</label>' +
          '<input class="input-field" type="text" id="setCurrency" value="' + settings.currency + '" maxlength="3">' +
        '</div>' +
        '<div class="btn-row" style="margin-top:8px">' +
          '<button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="settings-section"><div class="settings-title">PRODUCTS</div>';

  products.forEach(function(p, i) {
    html +=
      '<div class="product-edit-card">' +
        '<div class="product-edit-name">' + p.emoji + ' ' + p.name + '</div>' +
        '<div class="toggle-row">' +
          '<span class="toggle-label">Active</span>' +
          '<div class="toggle ' + (p.active ? 'on' : '') + '" onclick="toggleProduct(' + i + ')"></div>' +
        '</div>' +
        '<div style="margin-top:8px">' +
          '<button class="btn btn-secondary" style="font-size:11px;padding:8px" onclick="openEditProduct(' + i + ')">✏️ Edit</button>' +
        '</div>' +
      '</div>';
  });

  html +=
    '</div>' +
    '<div class="settings-section">' +
      '<div class="settings-title">ADD PRODUCT</div>' +
      '<div class="product-edit-card">' +
        '<div class="input-group">' +
          '<label class="input-label">Product Name</label>' +
          '<input class="input-field" type="text" id="newProdName" placeholder="e.g. SKIRTS">' +
        '</div>' +
        '<div class="input-group">' +
          '<label class="input-label">Emoji</label>' +
          '<input class="input-field" type="text" id="newProdEmoji" placeholder="👗" maxlength="2">' +
        '</div>' +
        '<button class="btn btn-primary" onclick="addProduct()">Add Product</button>' +
      '</div>' +
    '</div>' +
    '<div class="settings-section">' +
      '<div class="settings-title">DANGER ZONE</div>' +
      '<button class="danger-btn" onclick="clearAllData()">🗑️ Clear All Data</button>' +
    '</div>';

  el.innerHTML = html;
}

function saveSettings() {
  const el = document.getElementById('setCurrency');
  settings.currency = (el ? el.value.trim() : '') || 'K';
  save('pl_settings', settings);
  renderWeekStrip();
  renderProductGrid();
  notify('✅ Settings saved');
}

function toggleProduct(i) {
  products[i].active = !products[i].active;
  save('pl_products', products);
  renderSettings();
  renderProductGrid();
}

function addProduct() {
  const nameEl  = document.getElementById('newProdName');
  const emojiEl = document.getElementById('newProdEmoji');
  const name    = nameEl  ? nameEl.value.trim().toUpperCase()  : '';
  const emoji   = emojiEl ? emojiEl.value.trim()               : '';
  if (!name) { notify('⚠️ Enter a product name'); return; }

  const id = name.toLowerCase().replace(/\s+/g, '');
  if (products.find(function(p) { return p.id === id; })) {
    notify('⚠️ Product already exists'); return;
  }

  products.push({ id: id, name: name, emoji: emoji || '📦', price: 0, active: true });
  // Add to every existing cycle so no cycle is missing this product key
  cycles.forEach(function(c) {
    if (!c.restocks[id]) c.restocks[id] = { qty: 0, cost: 0 };
  });
  save('pl_products', products);
  save('pl_cycles', cycles);
  renderSettings();
  renderProductGrid();
  notify('✅ ' + name + ' added');
}

function openEditProduct(i) {
  const p = products[i];
  if (!p) return;
  document.getElementById('productModalBody').innerHTML =
    '<div class="input-group">' +
      '<label class="input-label">Name</label>' +
      '<input class="input-field" type="text" id="editName" value="' + p.name + '">' +
    '</div>' +
    '<div class="input-group">' +
      '<label class="input-label">Emoji</label>' +
      '<input class="input-field" type="text" id="editEmoji" value="' + p.emoji + '" maxlength="2">' +
    '</div>' +
    '<div class="input-group">' +
      '<label class="input-label">Default Price (' + settings.currency + ')</label>' +
      '<input class="input-field" type="number" id="editPrice" value="' + (p.price || 0) + '" min="0" inputmode="decimal">' +
    '</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-secondary" onclick="closeModal(\'productModal\')">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveEditProduct(' + i + ')">Save</button>' +
    '</div>';
  openModal('productModal');
}

function saveEditProduct(i) {
  const nameEl  = document.getElementById('editName');
  const emojiEl = document.getElementById('editEmoji');
  const priceEl = document.getElementById('editPrice');
  if (!nameEl || !emojiEl || !priceEl) return;

  const newName = nameEl.value.trim().toUpperCase();
  if (newName) products[i].name  = newName;
  const newEmoji = emojiEl.value.trim();
  if (newEmoji) products[i].emoji = newEmoji;
  products[i].price = Math.max(0, parseFloat(priceEl.value) || 0);

  save('pl_products', products);
  closeModal('productModal');
  renderSettings();
  renderProductGrid();
  notify('✅ Product updated');
}

function clearAllData() {
  if (!confirm('Clear ALL data? This cannot be undone.')) return;
  localStorage.removeItem('pl_products');
  localStorage.removeItem('pl_cycles');
  localStorage.removeItem('pl_settings');
  location.reload();
}

// ─── INIT ────────────────────────────────────────────────────────────────────
renderWeekStrip();
renderProductGrid();

// Close modals on backdrop tap
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Close modals on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(function(m) {
      m.classList.remove('open');
    });
  }
});

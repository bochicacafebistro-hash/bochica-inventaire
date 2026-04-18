// ── Page Employés & Horaires ──────────────────────────
function renderEmployes() {
  const weekStart = getWeekStart();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">Employés & Horaires</h2>
      <button class="btn btn-primary" onclick="openEmployeeModal()">${icon("plus", 16)} ${t("emp_add")}</button>
    </div>
    ${employees.length === 0
      ? `<div class="empty"><div style="font-size:36px;margin-bottom:8px">👥</div>Aucun employé enregistré.</div>`
      : `<div class="card" style="margin-bottom:20px;overflow-x:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h3 style="font-size:15px">Horaire — Semaine du ${weekDays[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}</h3>
          <div style="display:flex;gap:6px">${SHIFT_TYPES.map(s => `<span style="background:${s.color};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${tShift(s.label)}</span>`).join("")}</div>
        </div>
        <div class="schedule-grid">
          <div></div>${DAYS_FR.map((d, i) => `<div class="sch-header">${d}<div style="font-size:10px;font-weight:400;color:var(--text3)">${weekDays[i].getDate()}</div></div>`).join("")}
          ${employees.map(emp => {
            const shifts = emp.shifts || {};
            return `<div class="sch-name">${emp.name || ""}</div>
            ${weekDays.map(day => {
              const dk = day.toISOString().slice(0, 10);
              const s = shifts[dk];
              return `<div class="sch-cell ${s ? "has-shift" : ""}" onclick="openShiftModal('${emp.id}','${dk}')">
                ${s
                  ? `<div class="shift-tag" style="background:${s.color || "var(--blue)"}">${tShift(s.label) || ""}
                      <span onclick="event.stopPropagation();removeShift('${emp.id}','${dk}')" style="cursor:pointer;opacity:.7;margin-left:4px">${icon("x", 18)}</span>
                    </div>`
                  : `<div style="font-size:10px;color:var(--text3);text-align:center;margin-top:6px">+</div>`}
              </div>`;
            }).join("")}`;
          }).join("")}
        </div>
      </div>
      <h3 style="font-size:15px;margin-bottom:12px">Équipe</h3>
      <div class="card-grid">
        ${employees.map(emp => `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:700;font-size:15px">👤 ${emp.name || ""}</div>
              ${emp.role ? `<div style="font-size:13px;color:var(--text3);margin-top:2px">${emp.role}</div>` : ""}
              ${emp.phone ? `<div style="font-size:13px;color:var(--text2);margin-top:4px">${icon("phone", 12)} ${emp.phone}</div>` : ""}
              ${emp.email ? `<div style="font-size:13px;color:var(--text2)">✉️ ${emp.email}</div>` : ""}
              ${emp.pin ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">🔑 PIN : ${emp.pin}</div>` : ""}
            </div>
            <div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('emp${emp.id}')">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-emp${emp.id}">
              <button onclick="openEmployeeModal('${emp.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
              <div class="sep"></div>
              <button style="color:var(--status-red)" onclick="askDelete('employees','${emp.id}','${esc(emp.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
            </div></div>
          </div>
        </div>`).join("")}
      </div>`}
  </div>`;
}

function getWeekStart() {
  const d = new Date(), day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); d.setHours(0, 0, 0, 0); return d;
}

async function removeShift(empId, dayKey) {
  const emp = employees.find(e => e.id === empId); if (!emp) return;
  const shifts = { ...emp.shifts || {} }; delete shifts[dayKey];
  await db.collection("employees").doc(empId).update({ shifts });
}

function openEmployeeModal(id) {
  const emp = id ? employees.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${emp ? "Modifier" : "Ajouter"} un employé</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <label>Nom<input id="e-name" value="${esc(emp?.name || "")}"/></label>
    <label>Poste / Rôle<input id="e-role" value="${esc(emp?.role || "")}" placeholder="ex: Serveur, Cuisinier..."/></label>
    <div class="form-row">
      <label>Téléphone<input id="e-phone" value="${esc(emp?.phone || "")}"/></label>
      <label>Courriel<input id="e-email" value="${esc(emp?.email || "")}"/></label>
    </div>
    <label>Code PIN employé<input id="e-pin" type="text" maxlength="4" value="${esc(emp?.pin || "")}" placeholder="4 chiffres (optionnel)"/>
      <span class="field-hint">Pour la connexion à l'application</span>
    </label>
    <label>${t("exp_table_notes")}<textarea id="e-notes" style="height:60px">${emp?.notes || ""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveEmployee('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveEmployee(id) {
  const name = document.getElementById("e-name").value.trim();
  if (!name) return alert("Entrez un nom.");
  const data = {
    name,
    role: document.getElementById("e-role").value,
    phone: document.getElementById("e-phone").value,
    email: document.getElementById("e-email").value,
    pin: document.getElementById("e-pin").value,
    notes: document.getElementById("e-notes").value
  };
  if (id) await db.collection("employees").doc(id).update(data);
  else { const nid = genId(); await db.collection("employees").doc(nid).set({ ...data, id: nid, shifts: {} }); }
  closeModal();
}

function openShiftModal(empId, dayKey) {
  showModal(`<div class="modal" style="max-width:320px">
    <div class="modal-header"><h3>🕐 Quart de travail</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Sélectionnez le type de quart :</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${SHIFT_TYPES.map(s => `<button onclick="assignShift('${empId}','${dayKey}','${s.label}','${s.color}')"
        style="background:${s.color};color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">${tShift(s.label)}</button>`).join("")}
    </div>
    <div class="modal-actions" style="margin-top:12px">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
    </div>
  </div>`);
}

async function assignShift(empId, dayKey, label, color) {
  const emp = employees.find(e => e.id === empId); if (!emp) return;
  const shifts = { ...emp.shifts || {}, [dayKey]: { label, color } };
  await db.collection("employees").doc(empId).update({ shifts });
  closeModal();
}

// ══════════════════════════════════════════════════════
// FRAIS FIXES AUTOMATIQUES
// ══════════════════════════════════════════════════════

async function autoApplyFixedExpenses() {
  if (!isAdmin) return;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const firstOfMonth = `${currentMonthKey}-01`;

  // Vérifier si déjà appliqué ce mois-ci
  const alreadyApplied = expenses.some(e =>
    e.isFixedAuto && e.date && e.date.startsWith(currentMonthKey)
  );
  if (alreadyApplied) return;

  // Copier tous les templates de frais fixes
  const templates = fixedExpenseTemplates;
  if (!templates.length) return;

  const batch = db.batch();
  templates.forEach(tpl => {
    const nid = genId();
    const ref = db.collection("expenses").doc(nid);
    batch.set(ref, {
      id: nid,
      supplier: t.supplier || "",
      description: t.supplier || t.description || "",
      amount: t.amount || 0,
      tps: t.tps || 0,
      tvq: t.tvq || 0,
      category: t.category || "",
      date: firstOfMonth,
      notes: t.notes || "",
      isFixedAuto: true
    });
  });
  await batch.commit();
}

// ══════════════════════════════════════════════════════
// DÉPENSES & REVENUS
// ══════════════════════════════════════════════════════

let selectedExpenseMonth = new Date().getMonth();
let selectedExpenseYear = new Date().getFullYear();

function getAllExpenseCats() {
  const defaults = EXPENSE_CATS.map(c => c.name);
  const customs = expenseCategories.map(c => c.name);
  return [...new Set([...defaults, ...customs])];
}

function getExpenseCatType(name) {
  const def = EXPENSE_CATS.find(c => c.name === name);
  if (def) return def.type;
  const custom = expenseCategories.find(c => c.name === name);
  return custom ? custom.type : "variable";
}

function renderDepenses() {
  const now = new Date();
  const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  const filteredExp = expenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + "T12:00:00");
    if (activeExpensePeriod === "semaine") {
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (activeExpensePeriod === "mois") {
      return d.getMonth() === selectedExpenseMonth && d.getFullYear() === selectedExpenseYear;
    }
    return d.getFullYear() === selectedExpenseYear;
  });

  const filteredRev = revenues.filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date + "T12:00:00");
    if (activeExpensePeriod === "semaine") {
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (activeExpensePeriod === "mois") {
      return d.getMonth() === selectedExpenseMonth && d.getFullYear() === selectedExpenseYear;
    }
    return d.getFullYear() === selectedExpenseYear;
  });

  const totalExp = filteredExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalTPS = filteredExp.reduce((s, e) => s + Number(e.tps || 0), 0);
  const totalTVQ = filteredExp.reduce((s, e) => s + Number(e.tvq || 0), 0);
  const totalRev = filteredRev.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExpWithTax = totalExp + totalTPS + totalTVQ;
  const profit = totalRev - totalExpWithTax;
  const isProfit = profit >= 0;

  const fixedExp = filteredExp.filter(e => getExpenseCatType(e.category) === "fixe");
  const varExp = filteredExp.filter(e => getExpenseCatType(e.category) === "variable");
  const totalFixed = fixedExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalVar = varExp.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Données pour graphiques — 6 derniers mois
  const last6 = Array.from({length: 6}, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: d.getMonth(), year: d.getFullYear(), label: MONTHS_FR[d.getMonth()].slice(0,3) };
  });
  const chartRevs = last6.map(m => revenues.filter(r => { const d = new Date(r.date); return d.getMonth()===m.month && d.getFullYear()===m.year; }).reduce((s,r)=>s+Number(r.amount||0),0));
  const chartExps = last6.map(m => expenses.filter(e => { const d = new Date(e.date); return d.getMonth()===m.month && d.getFullYear()===m.year; }).reduce((s,e)=>s+Number(e.amount||0)+Number(e.tps||0)+Number(e.tvq||0),0));
  const chartMax = Math.max(...chartRevs, ...chartExps, 1);

  // Données pour graphique camembert — dépenses par catégorie
  const catTotals = getAllExpenseCats().map(cat => ({
    cat,
    total: filteredExp.filter(e => e.category === cat).reduce((s,e)=>s+Number(e.amount||0),0)
  })).filter(c => c.total > 0);
  const pieTotal = catTotals.reduce((s,c)=>s+c.total,0);
  const pieColors = ["var(--blue)","var(--status-red)","var(--status-green)","var(--status-yellow)","var(--accent-soft)","#ec4899","#14b8a6","#f97316","var(--text3)"];

  // Month picker
  let monthPicker = "";
  if (activeExpensePeriod === "mois") {
    monthPicker = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button onclick="changeExpenseMonth(-1)" style="border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:4px 10px;cursor:pointer;color:var(--text)">${icon("chevron-left", 14)}</button>
      <select onchange="setExpenseMonthYear(this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px 10px;background:var(--surface);color:var(--text);font-size:14px">
        ${Array.from({length:12},(_,i)=>`<option value="${i}" ${i===selectedExpenseMonth?"selected":""}>${MONTHS_FR[i]}</option>`).join("")}
      </select>
      <select onchange="setExpenseYear(this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px 10px;background:var(--surface);color:var(--text);font-size:14px">
        ${[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=>`<option value="${y}" ${y===selectedExpenseYear?"selected":""}>${y}</option>`).join("")}
      </select>
      <button onclick="changeExpenseMonth(1)" style="border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:4px 10px;cursor:pointer;color:var(--text)">${icon("chevron-right", 14)}</button>
      <span style="font-size:13px;color:var(--text3)">${MONTHS_FR[selectedExpenseMonth]} ${selectedExpenseYear}</span>
    </div>`;
  }

  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">${t("exp_title")}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="openRevenueModal()">${icon("plus", 16)} Revenu</button>
        <button class="btn btn-primary" onclick="openExpenseModal()">${icon("plus", 16)} ${t("exp_add_expense")}</button>
        ${isAdmin ? `<button class="btn btn-secondary" onclick="openCustomReportModal()">${icon("file-spreadsheet", 14)} ${t("exp_report")}</button>` : ""}
        ${isAdmin ? `<button class="btn btn-secondary" onclick="openExpenseCatModal()">${icon("settings", 14)} ${t("exp_categories")}</button>` : ""}
        ${isAdmin ? `<button class="btn btn-secondary" onclick="openFixedTemplatesModal()">${icon("shield-check", 14)} ${t("exp_fixed_templates")}</button>` : ""}
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${["semaine","mois","année"].map(p => `<button class="sec-btn ${activeExpensePeriod===p?"active":""}" onclick="setExpensePeriod('${p}')">${({"semaine":t("exp_period_week"),"mois":t("exp_period_month"),"année":t("exp_period_year")})[p]||p}</button>`).join("")}
    </div>

    ${monthPicker}

    <!-- Stats -->
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:20px">
      <div class="stat-card" style="border-left:4px solid var(--status-green)">
        <div class="stat-num" style="color:var(--status-green)">${fmtMoney(totalRev)}</div>
        <div class="stat-label">${icon("wallet", 14)} ${t("exp_revenues")}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid var(--status-red)">
        <div class="stat-num" style="color:var(--status-red)">${fmtMoney(totalExp)}</div>
        <div class="stat-label">💸 ${t("exp_expenses_pre_tax")}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid var(--status-yellow)">
        <div class="stat-num" style="color:var(--status-yellow);font-size:20px">${fmtMoney(totalTPS+totalTVQ)}</div>
        <div class="stat-label">🧾 ${t("exp_taxes")}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid ${isProfit?"var(--status-green)":"var(--status-red)"}">
        <div class="stat-num" style="color:${isProfit?"var(--status-green)":"var(--status-red)"}">${fmtMoney(Math.abs(profit))}</div>
        <div class="stat-label">${isProfit?t("exp_profit"):t("exp_deficit")}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid var(--accent-soft)">
        <div class="stat-num" style="font-size:20px;color:var(--accent-soft)">${fmtMoney(totalFixed)}</div>
        <div class="stat-label">🔒 ${t("exp_fixed")}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid var(--text3)">
        <div class="stat-num" style="font-size:20px;color:var(--text3)">${fmtMoney(totalVar)}</div>
        <div class="stat-label">${icon("bar-chart", 14)} ${t("exp_variable")}</div>
      </div>
    </div>

    <!-- Graphiques Chart.js — pleine largeur, modernes -->
    <div class="charts-wrap">
      <!-- Combo bars + line : Revenus vs Dépenses + Profit (6 mois) -->
      <div class="card chart-card chart-card--wide">
        <div class="chart-card__header">
          <div class="chart-card__title">${icon("trending-up", 16)} ${t("chart_combo_title")}</div>
          <div class="chart-card__sub">${t("chart_combo_sub")}</div>
        </div>
        <div class="chart-canvas-wrap"><canvas id="chart-revenue-expense"></canvas></div>
      </div>

      <!-- Doughnut : Dépenses par catégorie -->
      <div class="card chart-card">
        <div class="chart-card__header">
          <div class="chart-card__title">${icon("pie-chart", 16)} ${t("chart_pie_title")}</div>
          <div class="chart-card__sub">${catTotals.length === 0 ? t("chart_pie_no_data") : `${catTotals.length} ${catTotals.length > 1 ? t("chart_categories_pl") : t("chart_categories")}`}</div>
        </div>
        ${catTotals.length === 0
          ? `<div class="empty" style="margin-top:20px">${icon("pie-chart", 48)}<br/>${t("chart_pie_no_data")}</div>`
          : `<div class="chart-canvas-wrap"><canvas id="chart-categories"></canvas></div>`}
      </div>
    </div>

    <!-- Données pour Chart.js (injectées via JSON pour éviter les soucis d'échappement) -->
    <script type="application/json" id="chart-data">${JSON.stringify({
      months: last6.map(m => m.label + " " + String(m.year).slice(-2)),
      revenues: chartRevs,
      expenses: chartExps,
      categories: catTotals.map(c => c.cat),
      categoryAmounts: catTotals.map(c => c.total),
      darkMode
    })}</script>

    <!-- Revenus -->
    ${filteredRev.length > 0 ? `
    <h3 style="font-size:15px;margin-bottom:10px">${icon("wallet", 14)} Revenus</h3>
    <div class="table-wrap overflow" style="margin-bottom:20px">
      <table><thead><tr><th>${t("exp_table_period")}</th><th>${t("exp_table_desc")}</th><th>${t("exp_table_amount")}</th><th>TPS</th><th>TVQ</th><th></th></tr></thead>
      <tbody>${filteredRev.map(r => `<tr>
        <td style="white-space:nowrap;font-size:12px;color:var(--text2)">${fmtRevenuePeriod(r) || r.date || ""}</td>
        <td><strong>${r.description||""}</strong></td>
        <td style="font-weight:700;color:var(--status-green)">${fmtMoney(r.amount)}</td>
        <td style="color:var(--text3)">${r.tps?fmtMoney(r.tps):"—"}</td>
        <td style="color:var(--text3)">${r.tvq?fmtMoney(r.tvq):"—"}</td>
        <td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('rev${r.id}')">${icon("more-vertical", 16)}</button>
          <div class="dropdown" id="drop-rev${r.id}">
            <button onclick="openRevenueModal('${r.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
            <div class="sep"></div>
            <button style="color:var(--status-red)" onclick="askDelete('revenues','${r.id}','${esc(r.description||"")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
          </div></div></td>
      </tr>`).join("")}</tbody></table>
    </div>` : ""}

    <!-- Dépenses -->
    <h3 style="font-size:15px;margin-bottom:10px">💸 Dépenses</h3>
    <div class="table-wrap overflow">
      <table><thead><tr><th>${t("exp_table_date")}</th><th>${t("exp_table_supplier")}</th><th>${t("exp_table_category")}</th><th>Type</th><th>Avant taxes</th><th>TPS</th><th>TVQ</th><th>Total</th><th></th></tr></thead>
      <tbody>${filteredExp.length === 0
        ? `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">${t("chart_pie_no_data")}.</td></tr>`
        : filteredExp.map(e => {
            const total = Number(e.amount||0) + Number(e.tps||0) + Number(e.tvq||0);
            const type = getExpenseCatType(e.category);
            return `<tr>
              <td>${e.date||""}${e.isFixedAuto?` <span style="font-size:10px;color:var(--accent-soft)">🔒auto</span>`:""}</td>
              <td><strong>${e.supplier||e.description||"—"}</strong></td>
              <td><span class="badge-pill blue">${e.category||""}</span></td>
              <td><span class="badge-pill ${type==="fixe"?"green":"yellow"}">${type==="fixe"?"🔒 Fixe":"📊 Variable"}</span></td>
              <td style="font-weight:700;color:var(--accent)">${fmtMoney(e.amount)}</td>
              <td style="color:var(--text3)">${e.tps?fmtMoney(e.tps):"—"}</td>
              <td style="color:var(--text3)">${e.tvq?fmtMoney(e.tvq):"—"}</td>
              <td style="font-weight:700">${fmtMoney(total)}</td>
              <td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('exp${e.id}')">${icon("more-vertical", 16)}</button>
                <div class="dropdown" id="drop-exp${e.id}">
                  <button onclick="openExpenseModal('${e.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
                  <div class="sep"></div>
                  <button style="color:var(--status-red)" onclick="askDelete('expenses','${e.id}','${esc(e.supplier||e.description||"")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
                </div></div></td>
            </tr>`;
          }).join("")}
      </tbody></table>
    </div>
  </div>`;
}

function changeExpenseMonth(dir) {
  selectedExpenseMonth += dir;
  if (selectedExpenseMonth < 0) { selectedExpenseMonth = 11; selectedExpenseYear--; }
  if (selectedExpenseMonth > 11) { selectedExpenseMonth = 0; selectedExpenseYear++; }
  renderPage();
}
function setExpenseMonthYear(val) { selectedExpenseMonth = Number(val); renderPage(); }
function setExpenseYear(val) { selectedExpenseYear = Number(val); renderPage(); }

// ── Modal Dépense ─────────────────────────────────────
function openExpenseModal(id) {
  const e = id ? expenses.find(x => x.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const cats = getAllExpenseCats();
  const currentCat = e?.category || cats[0];
  const currentType = e?.type || getExpenseCatType(currentCat);

  showModal(`<div class="modal">
    <div class="modal-header"><h3>${e ? t("exp_modal_edit") : t("exp_modal_add")}</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>

    <label>${t("exp_table_desc")}
      <input id="ex-desc" value="${esc(e?.description||"")}"/>
    </label>
    <label>${t("exp_field_supplier")}
      <input id="ex-sup" list="ex-sup-list" value="${esc(e?.supplier||"")}" placeholder="${t(`exp_field_supplier_ph`)}" autocomplete="off"/>
      <datalist id="ex-sup-list">
        ${suppliers.map(s => `<option value="${esc(s.name)}"></option>`).join("")}
      </datalist>
      <small class="field-hint">${icon("info", 11)} ${t("exp_field_supplier_hint")}</small>
    </label>

    <div class="form-row">
      <label>${t("exp_field_category")}
        <select id="ex-cat" onchange="updateExpenseType()">
          ${cats.map(c => `<option value="${c}" ${currentCat===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </label>
      <label>${t("exp_field_type")}
        <select id="ex-type">
          <option value="variable" ${currentType==="variable"?"selected":""}>${icon("bar-chart", 14)} ${t("exp_type_variable")}</option>
          <option value="fixe" ${currentType==="fixe"?"selected":""}>🔒 ${t("exp_type_fixed")}</option>
        </select>
      </label>
    </div>

    <label>${t("exp_table_date")}<input id="ex-date" type="date" value="${e?.date||today}"/></label>

    <label>${t("exp_field_amount_pre")}
      <input id="ex-amt" type="number" step="0.01" value="${e?.amount||""}" oninput="calcExpenseTaxes()"/>
    </label>

    <div class="form-row">
      <label>${t("exp_field_tps")}
        <input id="ex-tps" type="number" step="0.01" value="${e?.tps||""}"/>
      </label>
      <label>${t("exp_field_tvq")}
        <input id="ex-tvq" type="number" step="0.01" value="${e?.tvq||""}"/>
      </label>
    </div>
    <div id="ex-total-preview" style="font-size:13px;color:var(--text2);margin-bottom:10px;text-align:right"></div>

    <label>${t("exp_table_notes")}<textarea id="ex-notes" style="height:60px">${e?.notes||""}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveExpense('${id||""}')">${t("save")}</button>
    </div>
  </div>`);
  setTimeout(calcExpenseTaxes, 50);
}

function updateExpenseType() {
  const cat = document.getElementById("ex-cat")?.value;
  const type = getExpenseCatType(cat);
  const el = document.getElementById("ex-type");
  if (el) el.value = type;
}

function calcExpenseTaxes() {
  const amt = Number(document.getElementById("ex-amt")?.value) || 0;
  const tpsEl = document.getElementById("ex-tps");
  const tvqEl = document.getElementById("ex-tvq");
  const prev = document.getElementById("ex-total-preview");
  if (tpsEl && !tpsEl.dataset.manual) tpsEl.value = amt > 0 ? (amt * TPS_RATE).toFixed(2) : "";
  if (tvqEl && !tvqEl.dataset.manual) tvqEl.value = amt > 0 ? (amt * TVQ_RATE).toFixed(2) : "";
  const tps = Number(tpsEl?.value) || 0;
  const tvq = Number(tvqEl?.value) || 0;
  if (prev && amt > 0) prev.innerHTML = `${t("exp_total_with_tax")} : <strong>${fmtMoney(amt + tps + tvq)}</strong>`;
}
async function saveExpense(id) {
  const sup = document.getElementById("ex-sup").value.trim();
  const desc = document.getElementById("ex-desc").value.trim();
  const amt = Number(document.getElementById("ex-amt").value) || 0;
  if (!desc) return alert(t("err_enter_desc"));
  if (!amt) return alert(t("err_enter_amount"));

  // Auto-création du fournisseur si saisi mais non existant
  if (sup) {
    const existing = suppliers.find(s => (s.name || "").trim().toLowerCase() === sup.toLowerCase());
    if (!existing) {
      try {
        const sid = genId();
        await db.collection("suppliers").doc(sid).set({
          id: sid,
          name: sup,
          contact: "",
          email: "",
          notes: "Créé automatiquement depuis une dépense"
        });
        await addLog(sup, "Création fournisseur", "Auto-créé depuis modal dépense");
      } catch (err) {
        console.warn("Impossible de créer le fournisseur :", err);
      }
    }
  }

  const type = document.getElementById("ex-type").value;
  const data = {
    supplier: sup,
    description: desc,
    amount: amt,
    tps: Number(document.getElementById("ex-tps").value) || 0,
    tvq: Number(document.getElementById("ex-tvq").value) || 0,
    date: document.getElementById("ex-date").value,
    category: document.getElementById("ex-cat").value,
    type,
    notes: document.getElementById("ex-notes").value
  };
  if (id) await db.collection("expenses").doc(id).update(data);
  else { const nid = genId(); await db.collection("expenses").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// ── Modal Revenu ──────────────────────────────────────
function openRevenueModal(id) {
  const r = id ? revenues.find(x => x.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);
  // Compatibilité : si l'ancien champ "date" existe sans dateStart, le réutiliser
  const startDate = r?.dateStart || r?.date || today;
  const endDate = r?.dateEnd || "";
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${r ? t("rev_modal_edit") : t("rev_modal_add")}</h3><button class="close-btn" onclick="closeModal()" aria-label="${t(`close`)}">${icon("x", 18)}</button></div>
    <label>Description<input id="rv-desc" value="${esc(r?.description||"")}"/></label>

    <div class="form-row">
      <label>${t("rev_date_start")}
        <input id="rv-date-start" type="date" value="${startDate}" required/>
      </label>
      <label>${t("rev_date_end")} <span style="font-weight:400;color:var(--text3);font-size:11px">(optionnel)</span>
        <input id="rv-date-end" type="date" value="${endDate}" min="${startDate}"/>
      </label>
    </div>
    <small class="field-hint" style="margin-top:-6px;margin-bottom:10px;display:block">${icon("info", 11)} ${t("rev_date_end_hint")}</small>

    <label>${t("exp_field_amount")}
      <input id="rv-amt" type="number" step="0.01" value="${r?.amount||""}" oninput="calcRevenueTaxes()"/>
    </label>
    <div class="form-row">
      <label>${t("exp_field_tps_recv")}
        <input id="rv-tps" type="number" step="0.01" value="${r?.tps||""}"/>
      </label>
      <label>${t("exp_field_tvq_recv")}
        <input id="rv-tvq" type="number" step="0.01" value="${r?.tvq||""}"/>
      </label>
    </div>
    <div id="rv-total-preview" style="font-size:13px;color:var(--text2);margin-bottom:10px;text-align:right"></div>
    <label>${t("exp_table_notes")}<textarea id="rv-notes" style="height:60px">${r?.notes||""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveRevenue('${id||""}')">${t("save")}</button>
    </div>
  </div>`);
  setTimeout(calcRevenueTaxes, 50);
  // Synchroniser le min de dateEnd avec dateStart
  setTimeout(() => {
    const startEl = document.getElementById("rv-date-start");
    const endEl = document.getElementById("rv-date-end");
    if (startEl && endEl) {
      startEl.addEventListener("change", () => {
        endEl.min = startEl.value;
        if (endEl.value && endEl.value < startEl.value) endEl.value = startEl.value;
      });
    }
  }, 50);
}

function calcRevenueTaxes() {
  const amt = Number(document.getElementById("rv-amt")?.value) || 0;
  const tpsEl = document.getElementById("rv-tps");
  const tvqEl = document.getElementById("rv-tvq");
  const prev = document.getElementById("rv-total-preview");
  if (tpsEl) tpsEl.value = amt > 0 ? (amt * TPS_RATE).toFixed(2) : "";
  if (tvqEl) tvqEl.value = amt > 0 ? (amt * TVQ_RATE).toFixed(2) : "";
  const tps = Number(tpsEl?.value) || 0;
  const tvq = Number(tvqEl?.value) || 0;
  if (prev && amt > 0) prev.innerHTML = `${t("exp_total_with_tax")} : <strong>${fmtMoney(amt + tps + tvq)}</strong>`;
}

async function saveRevenue(id) {
  const desc = document.getElementById("rv-desc").value.trim();
  const amt = Number(document.getElementById("rv-amt").value) || 0;
  if (!desc) return alert(t("err_enter_desc"));
  if (!amt) return alert(t("err_enter_amount"));
  const dateStart = document.getElementById("rv-date-start").value;
  const dateEnd = document.getElementById("rv-date-end").value || null;
  if (!dateStart) return alert(t("err_enter_start_date"));
  if (dateEnd && dateEnd < dateStart) return alert(t("err_end_after_start"));
  const data = {
    description: desc,
    amount: amt,
    tps: Number(document.getElementById("rv-tps").value) || 0,
    tvq: Number(document.getElementById("rv-tvq").value) || 0,
    dateStart,
    dateEnd,
    date: dateStart, // Compatibilité : date = dateStart pour le tri/affichage existant
    notes: document.getElementById("rv-notes").value
  };
  if (id) await db.collection("revenues").doc(id).update(data);
  else { const nid = genId(); await db.collection("revenues").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// Helper : formater la plage de dates d'un revenu pour affichage
function fmtRevenuePeriod(r) {
  if (!r) return "";
  const start = r.dateStart || r.date;
  const end = r.dateEnd;
  if (!end || end === start) return start || "";
  // Plage : "10 nov - 16 nov 2026" si même année, sinon dates complètes
  try {
    const ds = new Date(start), de = new Date(end);
    const sameYear = ds.getFullYear() === de.getFullYear();
    const optShort = { day: "numeric", month: "short" };
    const optFull = { day: "numeric", month: "short", year: "numeric" };
    if (sameYear) {
      return `${ds.toLocaleDateString("fr-CA", optShort)} – ${de.toLocaleDateString("fr-CA", optFull)}`;
    }
    return `${ds.toLocaleDateString("fr-CA", optFull)} – ${de.toLocaleDateString("fr-CA", optFull)}`;
  } catch {
    return `${start} – ${end}`;
  }
}

// ── Modal Fournisseur rapide ──────────────────────────
function openQuickSupplier() {
  showModal(`<div class="modal" style="max-width:380px">
    <div class="modal-header"><h3>🏪 Nouveau fournisseur</h3><button class="close-btn" onclick="openExpenseModal()">${icon("x", 18)}</button></div>
    <label>Nom<input id="qs-name" placeholder="Nom du fournisseur"/></label>
    <label>Téléphone<input id="qs-phone"/></label>
    <label>Courriel<input id="qs-email"/></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="openExpenseModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveQuickSupplier()">Créer</button>
    </div>
  </div>`);
}

async function saveQuickSupplier() {
  const name = document.getElementById("qs-name").value.trim();
  if (!name) return alert("Entrez un nom.");
  const nid = genId();
  await db.collection("suppliers").doc(nid).set({ id: nid, name, contact: document.getElementById("qs-phone").value, email: document.getElementById("qs-email").value, notes: "" });
  closeModal();
  setTimeout(() => openExpenseModal(), 300);
}

// ── Modal Catégories de dépenses ──────────────────────
function openExpenseCatModal() {
  const customs = expenseCategories;
  showModal(`<div class="modal">
    <div class="modal-header"><h3>⚙️ Catégories de dépenses</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Catégories par défaut :</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
      ${EXPENSE_CATS.map(c => `<span class="badge-pill ${c.type==="fixe"?"green":"yellow"}">${c.name} · ${c.type}</span>`).join("")}
    </div>
    <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Catégories personnalisées :</p>
    <div id="custom-cats-list">
      ${customs.length === 0
        ? `<p style="color:var(--text3);font-size:13px">Aucune catégorie personnalisée.</p>`
        : customs.map(c => `<div class="cat-item">
            <span style="flex:1;font-size:13px">${c.name}</span>
            <span class="badge-pill ${c.type==="fixe"?"green":"yellow"}" style="margin-right:8px">${c.type}</span>
            <button class="btn-danger-sm" onclick="deleteExpenseCat('${c.id}')">🗑️</button>
          </div>`).join("")}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <input id="new-cat-name" placeholder="Nom de la catégorie" style="flex:2"/>
      <select id="new-cat-type" style="flex:1">
        <option value="variable">${icon("bar-chart", 14)} ${t("exp_type_variable")}</option>
        <option value="fixe">🔒 ${t("exp_type_fixed")}</option>
      </select>
      <button class="btn btn-primary" onclick="addExpenseCat()">Ajouter</button>
    </div>
  </div>`);
}

async function addExpenseCat() {
  const name = document.getElementById("new-cat-name").value.trim();
  const type = document.getElementById("new-cat-type").value;
  if (!name) return alert("Entrez un nom.");
  const nid = genId();
  await db.collection("expenseCategories").doc(nid).set({ id: nid, name, type });
  openExpenseCatModal();
}

async function deleteExpenseCat(id) {
  await db.collection("expenseCategories").doc(id).delete();
  openExpenseCatModal();
}

// ── Modal Frais fixes (templates) ─────────────────────
function openFixedTemplatesModal() {
  const templates = fixedExpenseTemplates;
  showModal(`<div class="modal">
    <div class="modal-header"><h3>🔒 Modèles de frais fixes</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Ces frais sont copiés automatiquement le 1er de chaque mois.</p>
    <div style="margin-bottom:12px">
      ${templates.length === 0
        ? `<p style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Aucun modèle de frais fixe.</p>`
        : templates.map(t => `<div class="cat-item" style="justify-content:space-between">
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px">${tpl.supplier||t.description||"—"}</div>
              <div style="font-size:11px;color:var(--text3)">${tpl.category||""} · ${fmtMoney(t.amount)}</div>
            </div>
            <button class="btn-danger-sm" onclick="deleteFixedTemplate('${tpl.id}')">🗑️</button>
          </div>`).join("")}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">+ Ajouter un modèle</div>
      <div class="form-row">
        <label>Fournisseur
          <select id="ft-sup">
            <option value="">— Aucun —</option>
            ${suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join("")}
          </select>
        </label>
        <label>${t("exp_field_category")}
          <select id="ft-cat">
            ${getAllExpenseCats().map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="form-row">
        <label>Montant ($)<input id="ft-amt" type="number" step="0.01" placeholder="0.00" oninput="calcFtTaxes()"/></label>
        <label>TPS<input id="ft-tps" type="number" step="0.01" placeholder="auto"/></label>
        <label>TVQ<input id="ft-tvq" type="number" step="0.01" placeholder="auto"/></label>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:4px" onclick="saveFixedTemplate()">Ajouter ce modèle</button>
    </div>
  </div>`);
}

function calcFtTaxes() {
  const amt = Number(document.getElementById("ft-amt")?.value) || 0;
  const tpsEl = document.getElementById("ft-tps");
  const tvqEl = document.getElementById("ft-tvq");
  if (tpsEl) tpsEl.value = amt > 0 ? (amt * TPS_RATE).toFixed(2) : "";
  if (tvqEl) tvqEl.value = amt > 0 ? (amt * TVQ_RATE).toFixed(2) : "";
}

async function saveFixedTemplate() {
  const amt = Number(document.getElementById("ft-amt").value) || 0;
  if (!amt) return alert(t("err_enter_amount"));
  const nid = genId();
  await db.collection("fixedExpenseTemplates").doc(nid).set({
    id: nid,
    supplier: document.getElementById("ft-sup").value,
    category: document.getElementById("ft-cat").value,
    amount: amt,
    tps: Number(document.getElementById("ft-tps").value) || 0,
    tvq: Number(document.getElementById("ft-tvq").value) || 0
  });
  openFixedTemplatesModal();
}

async function deleteFixedTemplate(id) {
  await db.collection("fixedExpenseTemplates").doc(id).delete();
  openFixedTemplatesModal();
}

// ── Page Menu ─────────────────────────────────────────
function renderMenu() {
  const cats = ["Toutes", ...MENU_CATS];
  const filtered = menuItems.filter(m => activeMenuCat === "Toutes" || m.category === activeMenuCat);
  const available = menuItems.filter(m => m.available !== false).length;
  return `<div class="page">
    <div class="toolbar">
      <div><h2 style="font-size:18px">${t("menu_title")}</h2>
      <p style="font-size:13px;color:var(--text3);margin-top:2px">${available} item${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}</p></div>
      <button class="btn btn-primary" onclick="openMenuModal()">${icon("plus", 16)} ${t("menu_add")}</button>
    </div>
    <div class="sec-tabs">${cats.map(c => `<button class="sec-btn ${activeMenuCat === c ? "active" : ""}" onclick="setMenuCat('${c}')">${c}</button>`).join("")}</div>
    ${filtered.length === 0
      ? `<div class="empty"><div style="margin-bottom:12px;color:var(--text3);display:flex;justify-content:center">${icon("utensils", 36)}</div>Aucun item dans cette catégorie.</div>`
      : `<div class="recipes-grid">${filtered.map(m => {
          const fc = computeRecipeFoodCost(m.recipe || []);
          const hasRec = Array.isArray(m.recipe) && m.recipe.length > 0;
          const margin = (m.price || 0) - fc;
          const marginPct = (m.price || 0) > 0 ? (margin / m.price) * 100 : 0;
          let cardClass = "recipe-card--no-recipe";
          if (hasRec && m.price > 0) {
            if (marginPct >= 70) cardClass = "recipe-card--good";
            else if (marginPct >= 50) cardClass = "recipe-card--ok";
            else cardClass = "recipe-card--bad";
          }
          if (m.available === false) cardClass += " recipe-card--unavailable";
          // Liste compacte des ingrédients (max 4 affichés)
          const ingList = (m.recipe || []).map(r => {
            const ing = ingredients.find(i => i.id === r.ingredientId);
            return ing ? `${r.qty} ${ing.unit} <strong>${esc(ing.name)}</strong>` : null;
          }).filter(Boolean);
          const visibleIng = ingList.slice(0, 4);
          const extraCount = ingList.length - visibleIng.length;

          return `<div class="recipe-card ${cardClass}">
            <div class="recipe-card__head">
              <div style="flex:1;min-width:0">
                <h3 class="recipe-card__name">${m.name || "?"}</h3>
                <div class="recipe-card__cat">
                  ${m.category || ""}
                  ${m.available === false ? ` · <span style="color:var(--status-yellow)">${t("menu_unavailable_short")}</span>` : ""}
                </div>
              </div>
              <div class="menu-wrap">
                <button class="dots-btn" onclick="toggleDrop('mn${m.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
                <div class="dropdown" id="drop-mn${m.id}">
                  <button onclick="openMenuModal('${m.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
                  <button onclick="toggleMenuAvailable('${m.id}',${m.available !== false});closeAllDrops()">${icon(m.available === false ? "check" : "x", 14)} ${m.available === false ? t("menu_available") : t("menu_unavailable")}</button>
                  <div class="sep"></div>
                  <button style="color:var(--status-red)" onclick="askDelete('menu','${m.id}','${esc(m.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
                </div>
              </div>
            </div>

            ${m.description ? `<div class="recipe-card__desc">${esc(m.description)}</div>` : ""}

            <div class="recipe-card__metrics">
              <div class="recipe-card__metric">
                <div class="recipe-card__metric-label">${t("menu_food_cost")}</div>
                <div class="recipe-card__metric-value" style="color:var(--text2)">${hasRec ? fmtMoney(fc) : "—"}</div>
              </div>
              <div class="recipe-card__metric">
                <div class="recipe-card__metric-label">${t("menu_price")}</div>
                <div class="recipe-card__metric-value">${m.price > 0 ? fmtMoney(m.price) : "—"}</div>
              </div>
              <div class="recipe-card__metric">
                <div class="recipe-card__metric-label">${t("menu_margin_label")}</div>
                <div class="recipe-card__margin-pct">${hasRec && m.price > 0 ? marginPct.toFixed(0) + "%" : "—"}</div>
              </div>
            </div>

            ${hasRec ? `
              <div class="recipe-card__ingredients">
                ${visibleIng.join(" · ")}${extraCount > 0 ? ` <span style="color:var(--text3)">+${extraCount}</span>` : ""}
              </div>
            ` : `
              <div class="recipe-card__no-recipe">
                ${icon("plus", 14)} ${t("menu_no_composition")}
              </div>
            `}
          </div>`;
        }).join("")}</div>`}
  </div>`;
}

async function toggleMenuAvailable(id, current) {
  await db.collection("menu").doc(id).update({ available: !current });
}

// ── Modal Item Menu (avec composition / recette) ──
let menuRecipeRows = []; // état temporaire pour la composition en cours d'édition

function openMenuModal(id) {
  const m = id ? menuItems.find(x => x.id === id) : null;
  // Initialiser la composition (recipe) depuis l'item ou vide
  menuRecipeRows = (m?.recipe && Array.isArray(m.recipe)) ? [...m.recipe] : [];

  showModal(`<div class="modal" style="max-width:580px">
    <div class="modal-header">
      <h3>${m ? t("menu_modal_edit") : t("menu_modal_add")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>${t("menu_field_name")}<input id="mn-name" value="${esc(m?.name || "")}"/></label>
    <label>${t("menu_field_desc")}<textarea id="mn-desc" style="height:60px">${m?.description || ""}</textarea></label>
    <div class="form-row">
      <label>${t("menu_field_price")}<input id="mn-price" type="number" step="0.01" value="${m?.price || ""}" oninput="updateRecipeSummary()"/></label>
      <label>${t("menu_field_category")}<select id="mn-cat">${MENU_CATS.map(c => `<option value="${c}" ${(m?.category || "Plats principaux") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    </div>

    <!-- ═══ COMPOSITION (recette) ═══ -->
    <div style="margin-top:14px">
      <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="icon-inline">${icon("utensils", 14)} ${t("menu_composition")}</span>
        <button type="button" class="btn-icon-only" onclick="addRecipeRow()" aria-label="${t("menu_add_ingredient")}" style="width:32px;height:32px">${icon("plus", 14)}</button>
      </label>
      <small class="field-hint" style="margin-bottom:8px;display:block">${t("menu_composition_hint")}</small>

      <div class="composition-box" id="composition-box">
        <div id="composition-rows"></div>
        <div id="composition-totals"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveMenuItem('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);

  // Render initial des lignes de composition
  renderCompositionRows();
}

// Génère le HTML des lignes de composition
function renderCompositionRows() {
  const container = document.getElementById("composition-rows");
  if (!container) return;

  if (ingredients.length === 0) {
    container.innerHTML = `<div class="composition-empty">${t("ing_no_ingredients")}</div>`;
    updateRecipeSummary();
    return;
  }

  if (menuRecipeRows.length === 0) {
    container.innerHTML = `<div class="composition-empty">${t("menu_no_ingredients")}</div>`;
    updateRecipeSummary();
    return;
  }

  container.innerHTML = menuRecipeRows.map((row, idx) => {
    const ing = ingredients.find(i => i.id === row.ingredientId);
    const cost = ing ? Number(ing.costPerUnit || 0) * Number(row.qty || 0) : 0;
    return `<div class="composition-row" data-idx="${idx}">
      <select onchange="updateRecipeRow(${idx}, 'ingredientId', this.value)" aria-label="${t("menu_select_ingredient")}">
        <option value="">${t("menu_select_ingredient")}</option>
        ${ingredients.map(i => `<option value="${i.id}" ${i.id === row.ingredientId ? "selected" : ""}>${esc(i.name)} (${fmtMoney(i.costPerUnit || 0)}/${i.unit || "—"})</option>`).join("")}
      </select>
      <input type="number" step="0.01" min="0" placeholder="${t("menu_quantity")}" value="${row.qty || ""}" oninput="updateRecipeRow(${idx}, 'qty', this.value)" aria-label="${t("menu_quantity")}"/>
      <span class="composition-cost">${fmtMoney(cost)}</span>
      <button type="button" class="composition-remove" onclick="removeRecipeRow(${idx})" aria-label="${t("delete")}">${icon("trash", 16)}</button>
    </div>`;
  }).join("");

  updateRecipeSummary();
}

function addRecipeRow() {
  menuRecipeRows.push({ ingredientId: "", qty: 1 });
  renderCompositionRows();
}

function updateRecipeRow(idx, field, value) {
  if (!menuRecipeRows[idx]) return;
  if (field === "qty") menuRecipeRows[idx][field] = Number(value) || 0;
  else menuRecipeRows[idx][field] = value;
  // Update juste la ligne et le sommaire (pas tout le rendu pour préserver focus)
  const row = document.querySelector(`.composition-row[data-idx="${idx}"]`);
  if (row && field === "ingredientId") {
    // Re-render complet pour mettre à jour le coût affiché
    renderCompositionRows();
  } else if (row) {
    const costSpan = row.querySelector(".composition-cost");
    const ing = ingredients.find(i => i.id === menuRecipeRows[idx].ingredientId);
    const cost = ing ? Number(ing.costPerUnit || 0) * Number(menuRecipeRows[idx].qty || 0) : 0;
    if (costSpan) costSpan.textContent = fmtMoney(cost);
    updateRecipeSummary();
  }
}

function removeRecipeRow(idx) {
  menuRecipeRows.splice(idx, 1);
  renderCompositionRows();
}

// Met à jour le résumé : food cost total + marge calculée
function updateRecipeSummary() {
  const totals = document.getElementById("composition-totals");
  if (!totals) return;

  const foodCost = computeRecipeFoodCost(menuRecipeRows);
  const priceEl = document.getElementById("mn-price");
  const price = priceEl ? Number(priceEl.value) || 0 : 0;
  const margin = price - foodCost;
  const marginPct = price > 0 ? (margin / price) * 100 : 0;

  let marginClass = "composition-margin--bad";
  if (marginPct >= 70) marginClass = "composition-margin--good";
  else if (marginPct >= 50) marginClass = "composition-margin--ok";

  totals.innerHTML = `
    <div class="composition-summary">
      <span class="composition-summary__label">${t("menu_food_cost_total")}</span>
      <span class="composition-summary__value">${fmtMoney(foodCost)}</span>
    </div>
    ${price > 0 && foodCost > 0 ? `
      <div class="composition-margin ${marginClass}">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${t("menu_calculated_margin")}</span>
        <span style="font-family:var(--font-heading);font-weight:700;font-size:16px;font-style:italic">${fmtMoney(margin)} (${marginPct.toFixed(1)}%)</span>
      </div>
    ` : ""}
  `;
}

// Calcule le food cost total d'une recette (array d'objets {ingredientId, qty})
function computeRecipeFoodCost(recipe) {
  if (!Array.isArray(recipe)) return 0;
  return recipe.reduce((total, row) => {
    const ing = ingredients.find(i => i.id === row.ingredientId);
    if (!ing) return total;
    return total + (Number(ing.costPerUnit || 0) * Number(row.qty || 0));
  }, 0);
}

async function saveMenuItem(id) {
  const name = document.getElementById("mn-name").value.trim();
  if (!name) return alert(t("err_enter_name"));
  // Filtrer les lignes vides (pas d'ingrédient sélectionné)
  const cleanRecipe = menuRecipeRows.filter(r => r.ingredientId && Number(r.qty) > 0);
  const data = {
    name,
    description: document.getElementById("mn-desc").value,
    price: Number(document.getElementById("mn-price").value) || 0,
    category: document.getElementById("mn-cat").value,
    available: true,
    recipe: cleanRecipe
  };
  if (id) await db.collection("menu").doc(id).update(data);
  else { const nid = genId(); await db.collection("menu").doc(nid).set({ ...data, id: nid }); }
  menuRecipeRows = []; // Reset
  closeModal();
}

// ── Page Fournisseurs ─────────────────────────────────
function renderFournisseurs() {
  const activeProducts = products.filter(p => !p.archived);
  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">${t("sup_title")}</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openSupplierModal()">${icon("plus", 16)} ${t("sup_add")}</button>` : ""}
    </div>
    ${suppliers.length === 0
      ? `<div class="empty"><div style="font-size:40px;margin-bottom:8px">🏪</div>Aucun fournisseur.</div>`
      : `<div class="supplier-grid">${suppliers.map(s => {
          const linked = activeProducts.filter(p => p.supplierId === s.id);
          return `<div class="supplier-card">
            <div style="display:flex;justify-content:space-between">
              <div>
                <div style="font-weight:700;font-size:16px">🏪 ${s.name || ""}</div>
                ${s.contact ? `<div style="color:var(--text2);font-size:13px;margin-top:4px">${icon("phone", 12)} ${s.contact}</div>` : ""}
                ${s.email ? `<div style="color:var(--text2);font-size:13px">✉️ ${s.email}</div>` : ""}
                ${s.notes ? `<div style="color:var(--text3);font-size:12px;margin-top:6px;font-style:italic">${s.notes}</div>` : ""}
              </div>
              ${isAdmin ? `<div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('sup${s.id}')">${icon("more-vertical", 16)}</button>
                <div class="dropdown" id="drop-sup${s.id}">
                  <button onclick="openSupplierModal('${s.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
                  <div class="sep"></div>
                  <button style="color:var(--status-red)" onclick="askDelete('suppliers','${s.id}','${esc(s.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
                </div></div>` : ""}
            </div>
            ${linked.length ? `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px;font-weight:600">PRODUITS LIÉS</div>
              ${linked.map(p => `<span class="tag">${p.name}</span>`).join("")}
            </div>` : ""}
          </div>`;
        }).join("")}</div>`}
  </div>`;
}

function openSupplierModal(id) {
  const s = id ? suppliers.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${s ? "Modifier" : "Ajouter"} un fournisseur</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <label>Nom<input id="s-name" value="${esc(s?.name || "")}"/></label>
    <label>Téléphone<input id="s-contact" value="${esc(s?.contact || "")}"/></label>
    <label>Courriel<input id="s-email" value="${esc(s?.email || "")}"/></label>
    <label>${t("exp_table_notes")}<textarea id="s-notes" style="height:70px">${s?.notes || ""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveSupplier('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveSupplier(id) {
  const name = document.getElementById("s-name").value.trim();
  if (!name) return alert("Entrez un nom.");
  const data = {
    name,
    contact: document.getElementById("s-contact").value,
    email: document.getElementById("s-email").value,
    notes: document.getElementById("s-notes").value
  };
  if (id) await db.collection("suppliers").doc(id).update({ ...data });
  else { const nid = genId(); await db.collection("suppliers").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// ═══════════════════════════════════════════════════════════════
// RAPPORT PERSONNALISÉ — Export Excel et PDF
// ═══════════════════════════════════════════════════════════════

function openCustomReportModal() {
  const today = new Date().toISOString().slice(0, 10);
  // Par défaut : début du mois courant → aujourd'hui
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const defaultStart = firstOfMonth.toISOString().slice(0, 10);

  showModal(`<div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h3>${icon("file-spreadsheet", 18)} ${t("report_title")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t(`close`)}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:16px;line-height:1.5">
      ${t("report_intro")}
    </p>

    <div class="form-row">
      <label>${t("rev_date_start")}
        <input id="rep-start" type="date" value="${defaultStart}"/>
      </label>
      <label>${t("report_date_end")}
        <input id="rep-end" type="date" value="${today}"/>
      </label>
    </div>

    <label style="margin-top:8px">${t("report_content")}</label>
    <div style="display:flex;flex-direction:column;gap:8px;background:var(--surface2);padding:12px 14px;border-radius:8px;margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;color:var(--text);margin:0;cursor:pointer">
        <input type="checkbox" id="rep-include-rev" checked style="width:auto;margin:0;cursor:pointer"/>
        ${icon("trending-up", 14)} ${t("report_include_rev")}
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;color:var(--text);margin:0;cursor:pointer">
        <input type="checkbox" id="rep-include-exp" checked style="width:auto;margin:0;cursor:pointer"/>
        ${icon("trending-down", 14)} ${t("report_include_exp")}
      </label>
    </div>

    <div id="rep-preview" style="background:var(--surface2);padding:10px 14px;border-radius:8px;font-size:13px;color:var(--text2);margin-bottom:14px"></div>

    <div class="modal-actions" style="flex-wrap:wrap;gap:8px">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-secondary" onclick="exportReport('pdf')">${icon("file-text", 14)} ${t("report_export_pdf")}</button>
      <button class="btn btn-primary" onclick="exportReport('xlsx')">${icon("file-spreadsheet", 14)} ${t("report_export_excel")}</button>
    </div>
  </div>`);
  // Mettre à jour le preview en live
  setTimeout(updateReportPreview, 50);
  ["rep-start", "rep-end", "rep-include-rev", "rep-include-exp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", updateReportPreview);
  });
}

function updateReportPreview() {
  const start = document.getElementById("rep-start")?.value;
  const end = document.getElementById("rep-end")?.value;
  const incRev = document.getElementById("rep-include-rev")?.checked;
  const incExp = document.getElementById("rep-include-exp")?.checked;
  const preview = document.getElementById("rep-preview");
  if (!preview) return;
  if (!start || !end) { preview.innerHTML = "Choisissez une période valide."; return; }
  if (start > end) { preview.innerHTML = `<span style="color:var(--status-red)">${icon("alert", 12)} La date de fin doit être après la date de début.</span>`; return; }

  const filteredRev = incRev ? revenues.filter(r => {
    const d = r.dateStart || r.date;
    return d && d >= start && d <= end;
  }) : [];
  const filteredExp = incExp ? expenses.filter(e => e.date && e.date >= start && e.date <= end) : [];

  const totalRev = filteredRev.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExp = filteredExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit = totalRev - totalExp;

  let html = `<strong>${t("report_preview")} :</strong> `;
  const parts = [];
  if (incRev) parts.push(`${filteredRev.length} revenu${filteredRev.length > 1 ? "s" : ""} (${fmtMoney(totalRev)})`);
  if (incExp) parts.push(`${filteredExp.length} dépense${filteredExp.length > 1 ? "s" : ""} (${fmtMoney(totalExp)})`);
  html += parts.join(" · ");
  if (incRev && incExp) {
    html += `<br/><strong>${profit >= 0 ? "Profit" : "Déficit"} : <span style="color:${profit >= 0 ? "var(--status-green)" : "var(--status-red)"}">${fmtMoney(Math.abs(profit))}</span></strong>`;
  }
  preview.innerHTML = html;
}

function getReportData() {
  const start = document.getElementById("rep-start").value;
  const end = document.getElementById("rep-end").value;
  const incRev = document.getElementById("rep-include-rev").checked;
  const incExp = document.getElementById("rep-include-exp").checked;
  if (!start || !end) { alert(t("report_choose_period")); return null; }
  if (start > end) { alert(t("err_end_after_start")); return null; }
  if (!incRev && !incExp) { alert(t("report_select_one")); return null; }

  const filteredRev = incRev ? revenues.filter(r => {
    const d = r.dateStart || r.date;
    return d && d >= start && d <= end;
  }).sort((a, b) => (a.dateStart || a.date || "").localeCompare(b.dateStart || b.date || "")) : [];

  const filteredExp = incExp ? expenses.filter(e => e.date && e.date >= start && e.date <= end)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "")) : [];

  return { start, end, incRev, incExp, filteredRev, filteredExp };
}

async function exportReport(format) {
  const data = getReportData();
  if (!data) return;
  const { start, end, incRev, incExp, filteredRev, filteredExp } = data;
  const periodLabel = start === end ? start : `${start}_au_${end}`;
  const filename = `bochica_rapport_${periodLabel}`;

  if (format === "xlsx") {
    if (typeof XLSX === "undefined") {
      alert(t("report_lib_excel_err"));
      return;
    }
    exportReportExcel(filteredRev, filteredExp, filename, start, end, incRev, incExp);
  } else if (format === "pdf") {
    if (typeof window.jspdf === "undefined") {
      alert(t("report_lib_pdf_err"));
      return;
    }
    exportReportPDF(filteredRev, filteredExp, filename, start, end, incRev, incExp);
  }
  closeModal();
}

function exportReportExcel(filteredRev, filteredExp, filename, start, end, incRev, incExp) {
  const wb = XLSX.utils.book_new();

  // Feuille 1 : Résumé
  const totalRev = filteredRev.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExp = filteredExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalRevTPS = filteredRev.reduce((s, r) => s + Number(r.tps || 0), 0);
  const totalRevTVQ = filteredRev.reduce((s, r) => s + Number(r.tvq || 0), 0);
  const totalExpTPS = filteredExp.reduce((s, e) => s + Number(e.tps || 0), 0);
  const totalExpTVQ = filteredExp.reduce((s, e) => s + Number(e.tvq || 0), 0);

  const summary = [
    ["BOCHICA — Rapport personnalisé"],
    [""],
    ["Période", `Du ${start} au ${end}`],
    ["Généré le", new Date().toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })],
    [""],
    ["RÉSUMÉ"],
  ];
  if (incRev) {
    summary.push(["Total revenus (avant taxes)", totalRev]);
    summary.push(["TPS perçue (5%)", totalRevTPS]);
    summary.push(["TVQ perçue (9.975%)", totalRevTVQ]);
    summary.push(["Total revenus avec taxes", totalRev + totalRevTPS + totalRevTVQ]);
    summary.push([""]);
  }
  if (incExp) {
    summary.push(["Total dépenses (avant taxes)", totalExp]);
    summary.push(["TPS payée (5%)", totalExpTPS]);
    summary.push(["TVQ payée (9.975%)", totalExpTVQ]);
    summary.push(["Total dépenses avec taxes", totalExp + totalExpTPS + totalExpTVQ]);
    summary.push([""]);
  }
  if (incRev && incExp) {
    const profit = totalRev - totalExp;
    summary.push([profit >= 0 ? "PROFIT (avant taxes)" : "DÉFICIT (avant taxes)", profit]);
  }
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum['!cols'] = [{ wch: 35 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Résumé");

  // Feuille 2 : Revenus
  if (incRev && filteredRev.length > 0) {
    const headers = [["Date début", "Date fin", "Description", "Montant", "TPS", "TVQ", "Total", "Notes"]];
    const rows = filteredRev.map(r => [
      r.dateStart || r.date || "",
      r.dateEnd || "",
      r.description || "",
      Number(r.amount || 0),
      Number(r.tps || 0),
      Number(r.tvq || 0),
      Number(r.amount || 0) + Number(r.tps || 0) + Number(r.tvq || 0),
      r.notes || ""
    ]);
    const wsRev = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
    wsRev['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsRev, "Revenus");
  }

  // Feuille 3 : Dépenses
  if (incExp && filteredExp.length > 0) {
    const headers = [["Date", "Description", "Fournisseur", "Catégorie", "Type", "Montant", "TPS", "TVQ", "Total", "Notes"]];
    const rows = filteredExp.map(e => [
      e.date || "",
      e.description || "",
      e.supplier || "",
      e.category || "",
      e.type || "",
      Number(e.amount || 0),
      Number(e.tps || 0),
      Number(e.tvq || 0),
      Number(e.amount || 0) + Number(e.tps || 0) + Number(e.tvq || 0),
      e.notes || ""
    ]);
    const wsExp = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
    wsExp['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsExp, "Dépenses");
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function exportReportPDF(filteredRev, filteredExp, filename, start, end, incRev, incExp) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // En-tête
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text("BOCHICA", 14, 18);
  // Tricolore
  doc.setFillColor(245, 166, 35); doc.rect(14, 22, 18, 1.5, "F");
  doc.setFillColor(74, 144, 226);  doc.rect(32, 22, 18, 1.5, "F");
  doc.setFillColor(231, 76, 60);   doc.rect(50, 22, 18, 1.5, "F");

  doc.setFontSize(14);
  doc.setFont(undefined, "normal");
  doc.text("Rapport personnalisé", 14, 32);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Période : du ${start} au ${end}`, 14, 38);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })}`, 14, 43);

  let y = 52;

  // Résumé
  const totalRev = filteredRev.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExp = filteredExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.setTextColor(0);
  doc.text("Résumé", 14, y);
  y += 5;

  const summaryRows = [];
  if (incRev) summaryRows.push(["Total revenus", `${totalRev.toFixed(2)} $`, `${filteredRev.length} entrée(s)`]);
  if (incExp) summaryRows.push(["Total dépenses", `${totalExp.toFixed(2)} $`, `${filteredExp.length} entrée(s)`]);
  if (incRev && incExp) {
    const profit = totalRev - totalExp;
    summaryRows.push([profit >= 0 ? "Profit" : "Déficit", `${Math.abs(profit).toFixed(2)} $`, profit >= 0 ? "positif" : "négatif"]);
  }
  doc.autoTable({
    startY: y,
    head: [["", "Montant", "Détail"]],
    body: summaryRows,
    theme: "striped",
    headStyles: { fillColor: [107, 26, 31], textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 }
  });
  y = doc.lastAutoTable.finalY + 10;

  // Revenus
  if (incRev && filteredRev.length > 0) {
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("Revenus", 14, y);
    y += 2;
    doc.autoTable({
      startY: y + 2,
      head: [["Période", "Description", "Montant", "TPS", "TVQ", "Total"]],
      body: filteredRev.map(r => [
        r.dateEnd && r.dateEnd !== r.dateStart ? `${r.dateStart || r.date}\nau ${r.dateEnd}` : (r.dateStart || r.date || ""),
        r.description || "",
        `${Number(r.amount || 0).toFixed(2)} $`,
        `${Number(r.tps || 0).toFixed(2)}`,
        `${Number(r.tvq || 0).toFixed(2)}`,
        `${(Number(r.amount || 0) + Number(r.tps || 0) + Number(r.tvq || 0)).toFixed(2)} $`
      ]),
      theme: "striped",
      headStyles: { fillColor: [39, 174, 96], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Dépenses
  if (incExp && filteredExp.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("Dépenses", 14, y);
    y += 2;
    doc.autoTable({
      startY: y + 2,
      head: [["Date", "Description", "Fournisseur", "Catégorie", "Montant", "Total"]],
      body: filteredExp.map(e => [
        e.date || "",
        e.description || "",
        e.supplier || "",
        e.category || "",
        `${Number(e.amount || 0).toFixed(2)} $`,
        `${(Number(e.amount || 0) + Number(e.tps || 0) + Number(e.tvq || 0)).toFixed(2)} $`
      ]),
      theme: "striped",
      headStyles: { fillColor: [192, 57, 43], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: 14, right: 14 }
    });
  }

  // Footer pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} / ${pageCount}`, 200, 290, { align: "right" });
    doc.text("Bochica — Restaurant Colombien · 430 Rue Saint-Vallier Ouest, Québec", 14, 290);
  }

  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// CHART.JS — Initialisation après le rendu de la page Dépenses
// ═══════════════════════════════════════════════════════════════

let _bochicaCharts = { rev: null, cat: null };

function initExpenseCharts() {
  if (typeof Chart === "undefined") return; // Chart.js pas encore chargé
  const dataEl = document.getElementById("chart-data");
  if (!dataEl) return;
  let data;
  try { data = JSON.parse(dataEl.textContent); } catch { return; }

  // Détruire les charts précédents (re-render)
  if (_bochicaCharts.rev) { _bochicaCharts.rev.destroy(); _bochicaCharts.rev = null; }
  if (_bochicaCharts.cat) { _bochicaCharts.cat.destroy(); _bochicaCharts.cat = null; }

  // Couleurs adaptées au mode (dark/light)
  const isDark = data.darkMode;
  const textColor = isDark ? "#c9c0b8" : "#5a4a45";
  const gridColor = isDark ? "rgba(250,246,240,.08)" : "rgba(26,16,16,.08)";
  const tooltipBg = isDark ? "#25201d" : "#ffffff";
  const tooltipText = isDark ? "#faf6f0" : "#1a1010";
  const tooltipBorder = isDark ? "rgba(250,246,240,.18)" : "rgba(26,16,16,.18)";

  // Couleurs Bochica
  const revColor = "#27ae60";
  const expColor = "#c0392b";
  const profitColor = isDark ? "#c44b51" : "#6b1a1f";

  // Profit par mois (revenus - dépenses)
  const profits = data.revenues.map((r, i) => r - data.expenses[i]);

  // ── 1. CHART REVENUS / DÉPENSES / PROFIT (combo bars + line) ──
  const ctx1 = document.getElementById("chart-revenue-expense");
  if (ctx1) {
    _bochicaCharts.rev = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: data.months,
        datasets: [
          {
            label: "Revenus",
            data: data.revenues,
            backgroundColor: revColor + "cc",
            borderColor: revColor,
            borderWidth: 1,
            borderRadius: 6,
            order: 2
          },
          {
            label: "Dépenses",
            data: data.expenses,
            backgroundColor: expColor + "cc",
            borderColor: expColor,
            borderWidth: 1,
            borderRadius: 6,
            order: 2
          },
          {
            label: "Profit",
            type: "line",
            data: profits,
            borderColor: profitColor,
            backgroundColor: profitColor + "33",
            borderWidth: 3,
            tension: 0.3,
            pointBackgroundColor: profitColor,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textColor,
              font: { size: 12, family: "Inter, sans-serif", weight: 500 },
              padding: 16,
              usePointStyle: true,
              pointStyle: "rectRounded"
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderColor: tooltipBorder,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 12 },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label} : ${ctx.parsed.y.toFixed(2)} $`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor, display: false },
            ticks: { color: textColor, font: { size: 11, family: "Inter, sans-serif" } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 11, family: "Inter, sans-serif" },
              callback: (v) => v.toLocaleString("fr-CA") + " $"
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  // ── 2. CHART CATÉGORIES (doughnut) ──
  const ctx2 = document.getElementById("chart-categories");
  if (ctx2 && data.categories.length > 0) {
    // Palette tricolore Colombie + extensions
    const palette = [
      "#6b1a1f", // bordeaux Bochica
      "#f5a623", // jaune Colombie
      "#4a90e2", // bleu Colombie
      "#e74c3c", // rouge Colombie
      "#27ae60", // vert
      "#8b5cf6", // violet
      "#ec4899", // rose
      "#14b8a6", // teal
      "#f97316", // orange
      "#64748b"  // gris
    ];
    _bochicaCharts.cat = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: data.categories,
        datasets: [{
          data: data.categoryAmounts,
          backgroundColor: data.categories.map((_, i) => palette[i % palette.length]),
          borderColor: isDark ? "#1c1815" : "#ffffff",
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: textColor,
              font: { size: 12, family: "Inter, sans-serif", weight: 500 },
              padding: 12,
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 10
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderColor: tooltipBorder,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 12 },
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return `${ctx.label} : ${ctx.parsed.toFixed(2)} $ (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// INGRÉDIENTS — Items transformés utilisés dans les recettes
// ═══════════════════════════════════════════════════════════════

let activeIngredientCat = "Toutes";

const INGREDIENT_CATEGORIES = ["base", "protein", "garnish", "sauce", "vegetable", "drink", "dessert", "other"];

function tIngCat(key) {
  const map = {
    base: t("ing_cat_base"),
    protein: t("ing_cat_protein"),
    garnish: t("ing_cat_garnish"),
    sauce: t("ing_cat_sauce"),
    vegetable: t("ing_cat_vegetable"),
    drink: t("ing_cat_drink"),
    dessert: t("ing_cat_dessert"),
    other: t("ing_cat_other"),
  };
  return map[key] || key;
}

function setIngredientCat(cat) {
  activeIngredientCat = cat;
  renderPage();
}

function renderIngredients() {
  const isMobile = window.innerWidth <= 640;
  const totalIngredients = ingredients.length;
  const avgCost = totalIngredients > 0
    ? ingredients.reduce((s, i) => s + Number(i.costPerUnit || 0), 0) / totalIngredients
    : 0;

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">${t("ing_title")}</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">${t("ing_subtitle")}</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openIngredientModal()">${icon("plus", 16)} ${t("ing_add")}</button>` : ""}
    </div>`;

  if (totalIngredients > 0) {
    h += `<div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-num" style="color:var(--accent)">${totalIngredients}</div>
        <div class="stat-label">${icon("tag", 14)} ${t("ing_title")}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:var(--text);font-size:20px">${fmtMoney(avgCost)}</div>
        <div class="stat-label">${icon("dollar-sign", 14)} ${t("ing_field_cost")}</div>
      </div>
    </div>`;
  }

  if (totalIngredients === 0) {
    h += `<div class="empty">
      <div style="margin-bottom:12px;color:var(--text3);display:flex;justify-content:center">${icon("utensils", 48)}</div>
      ${t("ing_no_ingredients")}
    </div>`;
    return h + `</div>`;
  }

  // Liste groupée par catégorie (ordre prédéfini)
  // Catégories ordonnées : Base, Protéine, Garniture, Sauce, Légume, Boisson, Dessert, Autre
  INGREDIENT_CATEGORIES.forEach(cat => {
    const items = ingredients.filter(i => i.category === cat)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (items.length === 0) return;

    h += `<section class="ing-section">
      <h3 class="ing-section__title">
        <span class="ing-section__title-icon">${icon("folder", 14)}</span>
        ${tIngCat(cat)}
        <span class="ing-section__count">${items.length}</span>
      </h3>`;

    if (isMobile) {
      // Mobile : liste compacte une ligne par item
      h += `<div class="ing-list-mobile">`;
      items.forEach(ing => {
        h += `<div class="ing-row-mobile">
          <div class="ing-row-mobile__main">
            <div class="ing-row-mobile__name">${esc(ing.name || "?")}</div>
            ${ing.notes ? `<div class="ing-row-mobile__notes">${esc(ing.notes)}</div>` : ""}
          </div>
          <div class="ing-row-mobile__price">
            ${fmtMoney(ing.costPerUnit || 0)}
            <small>/ ${esc(ing.unit || "—")}</small>
          </div>
          ${isAdmin ? `<div class="menu-wrap">
            <button class="dots-btn" onclick="toggleDrop('ing${ing.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-ing${ing.id}">
              <button onclick="openIngredientModal('${ing.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
              <div class="sep"></div>
              <button style="color:var(--status-red)" onclick="askDelete('ingredients','${ing.id}','${esc(ing.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
            </div>
          </div>` : ""}
        </div>`;
      });
      h += `</div>`;
    } else {
      // Desktop : tableau
      h += `<div class="table-wrap" style="margin-bottom:24px">
        <table>
          <thead><tr>
            <th>${t("ing_field_name")}</th>
            <th style="width:80px">${t("ing_field_unit")}</th>
            <th style="width:120px;text-align:right">${t("ing_field_cost")}</th>
            <th style="width:200px;color:var(--text3)">${t("ing_field_notes")}</th>
            ${isAdmin ? `<th style="width:50px"></th>` : ""}
          </tr></thead>
          <tbody>`;
      items.forEach(ing => {
        h += `<tr>
          <td><strong>${esc(ing.name || "?")}</strong></td>
          <td style="color:var(--text2)">${esc(ing.unit || "—")}</td>
          <td style="text-align:right;font-family:var(--font-heading);font-weight:700;font-style:italic;color:var(--accent)">${fmtMoney(ing.costPerUnit || 0)}</td>
          <td style="color:var(--text3);font-size:12px;font-style:italic">${esc(ing.notes || "")}</td>
          ${isAdmin ? `<td><div class="menu-wrap">
            <button class="dots-btn" onclick="toggleDrop('ing${ing.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-ing${ing.id}">
              <button onclick="openIngredientModal('${ing.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
              <div class="sep"></div>
              <button style="color:var(--status-red)" onclick="askDelete('ingredients','${ing.id}','${esc(ing.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
            </div>
          </div></td>` : ""}
        </tr>`;
      });
      h += `</tbody></table></div>`;
    }
    h += `</section>`;
  });

  return h + `</div>`;
}

// ── Modal Ingrédient (ajout / édition) ─────────────
function openIngredientModal(id) {
  const ing = id ? ingredients.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header">
      <h3>${ing ? t("ing_modal_edit") : t("ing_modal_add")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>${t("ing_field_name")}<input id="ing-name" value="${esc(ing?.name || "")}"/></label>

    <div class="form-row">
      <label>${t("ing_field_unit")}
        <input id="ing-unit" value="${esc(ing?.unit || "unité")}"/>
        <small class="field-hint">${t("ing_field_unit_hint")}</small>
      </label>
      <label>${t("ing_field_cost")}
        <input id="ing-cost" type="number" step="0.01" min="0" value="${ing?.costPerUnit || ""}"/>
      </label>
    </div>

    <label>${t("ing_field_category")}
      <select id="ing-cat">
        ${INGREDIENT_CATEGORIES.map(c => `<option value="${c}" ${(ing?.category || "other") === c ? "selected" : ""}>${tIngCat(c)}</option>`).join("")}
      </select>
    </label>

    <label>${t("ing_field_notes")}<textarea id="ing-notes" style="height:60px">${ing?.notes || ""}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveIngredient('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveIngredient(id) {
  const name = document.getElementById("ing-name").value.trim();
  if (!name) return alert(t("err_enter_name"));
  const cost = Number(document.getElementById("ing-cost").value) || 0;
  const data = {
    name,
    unit: document.getElementById("ing-unit").value.trim() || "unité",
    costPerUnit: cost,
    category: document.getElementById("ing-cat").value,
    notes: document.getElementById("ing-notes").value.trim()
  };
  if (id) await db.collection("ingredients").doc(id).update(data);
  else { const nid = genId(); await db.collection("ingredients").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// ═══════════════════════════════════════════════════════════════
// PAGE RECETTES — Livre de cuisine pour préparation des plats
// (Indépendante du menu, accessible aux admins ET employés)
// ═══════════════════════════════════════════════════════════════

const RECIPE_CATEGORIES = ["main", "starter", "dessert", "drink", "sauce", "base", "other"];

function tRecipeCat(cat) {
  const map = {
    main: t("rec_cat_main"),
    starter: t("rec_cat_starter"),
    dessert: t("rec_cat_dessert"),
    drink: t("rec_cat_drink"),
    sauce: t("rec_cat_sauce"),
    base: t("rec_cat_base"),
    other: t("rec_cat_other"),
  };
  return map[cat] || cat;
}

function setRecipeFilter(f) { recipeFilter = f; renderPage(); }

function renderRecettes() {
  // Filtrage par catégorie
  let filtered = recipeFilter === "all"
    ? recipes
    : recipes.filter(r => r.category === recipeFilter);

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">${t("rec_title")}</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">${t("rec_subtitle")}</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openRecipeModal()">${icon("plus", 16)} ${t("rec_add")}</button>` : ""}
    </div>`;

  // Filtres par catégorie (seulement si recettes existent)
  if (recipes.length > 0) {
    h += `<div class="section-tabs section-tabs--scroll" role="tablist" aria-label="${t("filter_by_category")}">
      <button class="sec-btn ${recipeFilter === "all" ? "active" : ""}" onclick="setRecipeFilter('all')">${t("rec_filter_all")}<span class="badge-count">${recipes.length}</span></button>
      ${RECIPE_CATEGORIES.map(cat => {
        const cnt = recipes.filter(r => r.category === cat).length;
        if (cnt === 0) return "";
        return `<button class="sec-btn ${recipeFilter === cat ? "active" : ""}" onclick="setRecipeFilter('${cat}')">${tRecipeCat(cat)}<span class="badge-count">${cnt}</span></button>`;
      }).join("")}
    </div>`;
  }

  if (filtered.length === 0) {
    h += `<div class="empty">
      <div style="margin-bottom:12px;color:var(--text3);display:flex;justify-content:center">${icon("file-text", 48)}</div>
      ${t("rec_no_recipes")}
    </div>`;
  } else {
    h += `<div class="recipes-grid">`;
    filtered.forEach(r => {
      const totalTime = (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0);
      const ingCount = (r.ingredients || "").trim().split(/\n/).filter(l => l.trim()).length;

      h += `<div class="recipe-book-card" onclick="openRecipeViewModal('${r.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openRecipeViewModal('${r.id}')}">
        <div class="recipe-book-card__head">
          <div style="flex:1;min-width:0">
            <h3 class="recipe-book-card__name">${esc(r.name || "?")}</h3>
            ${r.category ? `<div class="recipe-book-card__cat">${tRecipeCat(r.category)}</div>` : ""}
          </div>
          ${isAdmin ? `<div class="menu-wrap" onclick="event.stopPropagation()">
            <button class="dots-btn" onclick="toggleDrop('rec${r.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-rec${r.id}">
              <button onclick="openRecipeModal('${r.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
              <div class="sep"></div>
              <button style="color:var(--status-red)" onclick="askDelete('recipes','${r.id}','${esc(r.name || "")}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
            </div>
          </div>` : ""}
        </div>

        ${r.description ? `<div class="recipe-book-card__desc">${esc(r.description)}</div>` : ""}

        <div class="recipe-book-card__meta">
          ${totalTime > 0 ? `<span class="icon-inline">${icon("clock", 13)} ${totalTime} ${t("rec_minutes")}</span>` : ""}
          ${r.servings ? `<span class="icon-inline">${icon("users", 13)} ${r.servings} ${r.servings > 1 ? t("rec_servings_label_pl") : t("rec_servings_label")}</span>` : ""}
          ${ingCount > 0 ? `<span class="icon-inline">${icon("tag", 13)} ${ingCount} ${ingCount > 1 ? t("chart_categories_pl") : t("chart_categories")}</span>` : ""}
        </div>
      </div>`;
    });
    h += `</div>`;
  }

  return h + `</div>`;
}

// ── Modal Visualisation Recette (lecture seule, pour cuisinier) ──
function openRecipeViewModal(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  const totalTime = (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0);

  showModal(`<div class="modal" style="max-width:640px;padding:0">
    <div class="recipe-view__header">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1;min-width:0">
          <h2 class="recipe-view__title">${esc(r.name || "?")}</h2>
          ${r.description ? `<p class="recipe-view__desc">${esc(r.description)}</p>` : ""}
          ${r.category ? `<span class="recipe-view__cat">${tRecipeCat(r.category)}</span>` : ""}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn-icon-only" onclick="window.print()" aria-label="${t("rec_print")}" title="${t("rec_print")}">${icon("printer", 16)}</button>
          ${isAdmin ? `<button class="btn-icon-only" onclick="closeModal();openRecipeModal('${r.id}')" aria-label="${t("dropdown_edit")}" title="${t("dropdown_edit")}">${icon("pencil", 16)}</button>` : ""}
          <button class="btn-icon-only" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 16)}</button>
        </div>
      </div>

      <div class="recipe-view__meta">
        ${r.servings ? `<div class="recipe-view__meta-item">${icon("users", 18)}<div><div class="recipe-view__meta-label">${t("rec_field_servings")}</div><div class="recipe-view__meta-value">${r.servings}</div></div></div>` : ""}
        ${r.prepTime ? `<div class="recipe-view__meta-item">${icon("clock", 18)}<div><div class="recipe-view__meta-label">${t("rec_field_prep_time")}</div><div class="recipe-view__meta-value">${r.prepTime} ${t("rec_minutes")}</div></div></div>` : ""}
        ${r.cookTime ? `<div class="recipe-view__meta-item">${icon("utensils", 18)}<div><div class="recipe-view__meta-label">${t("rec_field_cook_time")}</div><div class="recipe-view__meta-value">${r.cookTime} ${t("rec_minutes")}</div></div></div>` : ""}
        ${totalTime > 0 ? `<div class="recipe-view__meta-item">${icon("trending-up", 18)}<div><div class="recipe-view__meta-label">${t("rec_total_time")}</div><div class="recipe-view__meta-value"><strong>${totalTime} ${t("rec_minutes")}</strong></div></div></div>` : ""}
      </div>
    </div>

    <div class="recipe-view__body">
      <section class="recipe-view__section">
        <h3 class="recipe-view__section-title">${icon("tag", 16)} ${t("rec_field_ingredients")}</h3>
        <div class="recipe-view__ingredients">
          ${r.ingredients ? r.ingredients.split(/\n/).filter(l => l.trim()).map(line =>
            `<div class="recipe-view__ing-line">• ${esc(line.trim())}</div>`
          ).join("") : `<div style="color:var(--text3);font-style:italic">${t("rec_no_ingredients")}</div>`}
        </div>
      </section>

      <section class="recipe-view__section">
        <h3 class="recipe-view__section-title">${icon("file-text", 16)} ${t("rec_field_steps")}</h3>
        <ol class="recipe-view__steps">
          ${r.steps ? r.steps.split(/\n/).filter(l => l.trim()).map(line =>
            `<li>${esc(line.trim())}</li>`
          ).join("") : `<div style="color:var(--text3);font-style:italic">${t("rec_no_steps")}</div>`}
        </ol>
      </section>

      ${r.tips ? `<section class="recipe-view__tips">
        <h3 class="recipe-view__section-title">${icon("lightbulb", 16)} ${t("rec_field_tips")}</h3>
        <p>${esc(r.tips)}</p>
      </section>` : ""}
    </div>
  </div>`);
}

// ── Modal Édition Recette (admin) ──
function openRecipeModal(id) {
  const r = id ? recipes.find(x => x.id === id) : null;
  showModal(`<div class="modal" style="max-width:640px">
    <div class="modal-header">
      <h3>${r ? t("rec_modal_edit") : t("rec_modal_add")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>${t("rec_field_name")}<input id="rec-name" value="${esc(r?.name || "")}"/></label>
    <label>${t("rec_field_desc")}<textarea id="rec-desc" style="height:50px">${esc(r?.description || "")}</textarea></label>

    <div class="form-row">
      <label>${t("rec_field_category")}
        <select id="rec-cat">
          ${RECIPE_CATEGORIES.map(c => `<option value="${c}" ${(r?.category || "main") === c ? "selected" : ""}>${tRecipeCat(c)}</option>`).join("")}
        </select>
      </label>
      <label>${t("rec_field_servings")}<input id="rec-servings" type="number" min="1" value="${r?.servings || 1}"/></label>
    </div>

    <div class="form-row">
      <label>${t("rec_field_prep_time")}<input id="rec-prep" type="number" min="0" value="${r?.prepTime || ""}"/></label>
      <label>${t("rec_field_cook_time")}<input id="rec-cook" type="number" min="0" value="${r?.cookTime || ""}"/></label>
    </div>

    <label>${t("rec_field_ingredients")}
      <textarea id="rec-ingredients" style="height:120px;font-family:var(--font-body)">${esc(r?.ingredients || "")}</textarea>
      <small class="field-hint">${t("rec_field_ingredients_hint")}</small>
    </label>

    <label>${t("rec_field_steps")}
      <textarea id="rec-steps" style="height:160px;font-family:var(--font-body)">${esc(r?.steps || "")}</textarea>
      <small class="field-hint">${t("rec_field_steps_hint")}</small>
    </label>

    <label>${t("rec_field_tips")}<textarea id="rec-tips" style="height:60px">${esc(r?.tips || "")}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveRecipe('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveRecipe(id) {
  const name = document.getElementById("rec-name").value.trim();
  if (!name) return alert(t("err_enter_name"));
  const data = {
    name,
    description: document.getElementById("rec-desc").value.trim(),
    category: document.getElementById("rec-cat").value,
    servings: Number(document.getElementById("rec-servings").value) || 1,
    prepTime: Number(document.getElementById("rec-prep").value) || 0,
    cookTime: Number(document.getElementById("rec-cook").value) || 0,
    ingredients: document.getElementById("rec-ingredients").value,
    steps: document.getElementById("rec-steps").value,
    tips: document.getElementById("rec-tips").value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (id) await db.collection("recipes").doc(id).update(data);
  else { const nid = genId(); await db.collection("recipes").doc(nid).set({ ...data, id: nid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
  closeModal();
}

// ═══════════════════════════════════════════════════════════════
// LEGACY : ancienne page Recettes (analyse rentabilité du menu)
// Renommée en renderMenuAnalysis - non utilisée pour l'instant
// ═══════════════════════════════════════════════════════════════

function renderMenuAnalysisLEGACY() {
  // Calcul pour chaque item du menu
  const enriched = menuItems.map(m => {
    const foodCost = computeRecipeFoodCost(m.recipe || []);
    const price = Number(m.price || 0);
    const margin = price - foodCost;
    const marginPct = price > 0 ? (margin / price) * 100 : 0;
    const hasRecipe = Array.isArray(m.recipe) && m.recipe.length > 0;
    return { ...m, foodCost, margin, marginPct, hasRecipe };
  });

  // Filtrage
  let filtered = enriched;
  if (recipesFilter === "with") filtered = enriched.filter(e => e.hasRecipe);
  else if (recipesFilter === "without") filtered = enriched.filter(e => !e.hasRecipe);

  // Tri
  if (recipesSort === "margin") {
    filtered.sort((a, b) => {
      // Items avec recette en premier, puis par marge décroissante
      if (a.hasRecipe !== b.hasRecipe) return a.hasRecipe ? -1 : 1;
      return b.marginPct - a.marginPct;
    });
  } else if (recipesSort === "price") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (recipesSort === "name") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  // Stats globales (sur items avec recette uniquement)
  const itemsWithRecipe = enriched.filter(e => e.hasRecipe);
  const totalItems = enriched.length;
  const itemsWithoutRecipe = totalItems - itemsWithRecipe.length;
  const avgMarginPct = itemsWithRecipe.length > 0
    ? itemsWithRecipe.reduce((s, e) => s + e.marginPct, 0) / itemsWithRecipe.length
    : 0;
  const avgFoodCost = itemsWithRecipe.length > 0
    ? itemsWithRecipe.reduce((s, e) => s + e.foodCost, 0) / itemsWithRecipe.length
    : 0;

  // Top 3 plus / moins rentables
  const topProfitable = [...itemsWithRecipe].sort((a, b) => b.marginPct - a.marginPct).slice(0, 3);
  const topExpensive = [...itemsWithRecipe].sort((a, b) => b.foodCost - a.foodCost).slice(0, 3);

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">${t("rec_title")}</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">${t("rec_subtitle")}</p>
      </div>
    </div>`;

  // Stats globales
  if (totalItems > 0) {
    h += `<div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-num" style="color:var(--accent)">${totalItems}</div>
        <div class="stat-label">${icon("utensils", 14)} ${t("rec_total_items")}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid var(--status-green)">
        <div class="stat-num" style="color:var(--status-green)">${itemsWithRecipe.length}</div>
        <div class="stat-label">${t("rec_filter_with_recipe")}</div>
      </div>
      ${itemsWithoutRecipe > 0 ? `
        <div class="stat-card" style="border-left:4px solid var(--status-yellow-vivid)">
          <div class="stat-num" style="color:var(--status-yellow)">${itemsWithoutRecipe}</div>
          <div class="stat-label">${t("rec_filter_without")}</div>
        </div>
      ` : ""}
      ${itemsWithRecipe.length > 0 ? `
        <div class="stat-card" style="border-left:4px solid var(--accent)">
          <div class="stat-num" style="color:var(--accent);font-size:20px">${avgMarginPct.toFixed(1)}%</div>
          <div class="stat-label">${t("rec_avg_margin")}</div>
        </div>
      ` : ""}
    </div>`;
  }

  // Top 3 plus rentables / plus chers (côte à côte)
  if (itemsWithRecipe.length >= 2) {
    h += `<div class="charts-wrap" style="margin-bottom:20px">
      <div class="card">
        <div class="chart-card__header">
          <div class="chart-card__title">${icon("trending-up", 16)} ${t("rec_top_profitable")}</div>
        </div>
        <ol style="padding-left:20px;margin-top:10px">${topProfitable.map(e => `
          <li style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-weight:600;flex:1;min-width:0;word-break:break-word">${e.name || ""}</span>
            <strong style="color:var(--status-green);font-family:var(--font-heading);font-style:italic">${e.marginPct.toFixed(1)}%</strong>
          </li>
        `).join("")}</ol>
      </div>
      <div class="card">
        <div class="chart-card__header">
          <div class="chart-card__title">${icon("trending-down", 16)} ${t("rec_top_expensive")}</div>
        </div>
        <ol style="padding-left:20px;margin-top:10px">${topExpensive.map(e => `
          <li style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-weight:600;flex:1;min-width:0;word-break:break-word">${e.name || ""}</span>
            <strong style="color:var(--status-red);font-family:var(--font-heading);font-style:italic">${fmtMoney(e.foodCost)}</strong>
          </li>
        `).join("")}</ol>
      </div>
    </div>`;
  }

  // Filtres
  h += `<div class="section-tabs section-tabs--scroll" style="margin-bottom:16px">
    <button class="sec-btn ${recipesFilter === "all" ? "active" : ""}" onclick="setRecipesFilter('all')">${t("rec_filter_all")} <span class="badge-count">${totalItems}</span></button>
    <button class="sec-btn ${recipesFilter === "with" ? "active" : ""}" onclick="setRecipesFilter('with')">${t("rec_filter_with_recipe")} <span class="badge-count">${itemsWithRecipe.length}</span></button>
    ${itemsWithoutRecipe > 0 ? `<button class="sec-btn ${recipesFilter === "without" ? "active" : ""}" onclick="setRecipesFilter('without')">${t("rec_filter_without")} <span class="badge-count">${itemsWithoutRecipe}</span></button>` : ""}
  </div>`;

  // Liste des recettes
  if (filtered.length === 0) {
    h += `<div class="empty">
      <div style="margin-bottom:12px;color:var(--text3);display:flex;justify-content:center">${icon("utensils", 48)}</div>
      ${t("rec_no_recipes")}
    </div>`;
  } else {
    h += `<div class="recipes-grid">`;
    filtered.forEach(e => {
      let cardClass = "recipe-card--no-recipe";
      if (e.hasRecipe) {
        if (e.marginPct >= 70) cardClass = "recipe-card--good";
        else if (e.marginPct >= 50) cardClass = "recipe-card--ok";
        else cardClass = "recipe-card--bad";
      }
      // Liste compacte des ingrédients (max 5 affichés)
      const ingList = (e.recipe || []).map(r => {
        const ing = ingredients.find(i => i.id === r.ingredientId);
        return ing ? `${r.qty} ${ing.unit} <strong>${ing.name}</strong>` : null;
      }).filter(Boolean);
      const visibleIng = ingList.slice(0, 4);
      const extraCount = ingList.length - visibleIng.length;

      h += `<div class="recipe-card ${cardClass}">
        <div class="recipe-card__head">
          <div style="flex:1;min-width:0">
            <h3 class="recipe-card__name">${e.name || "?"}</h3>
            <div class="recipe-card__cat">${e.category || ""}</div>
          </div>
          <button class="dots-btn" onclick="openMenuModal('${e.id}')" aria-label="${t("dropdown_edit")}" title="${t("dropdown_edit")}">${icon("pencil", 16)}</button>
        </div>

        ${e.hasRecipe ? `
          <div class="recipe-card__metrics">
            <div class="recipe-card__metric">
              <div class="recipe-card__metric-label">${t("rec_food_cost")}</div>
              <div class="recipe-card__metric-value" style="color:var(--text2)">${fmtMoney(e.foodCost)}</div>
            </div>
            <div class="recipe-card__metric">
              <div class="recipe-card__metric-label">${t("rec_selling_price")}</div>
              <div class="recipe-card__metric-value">${e.price > 0 ? fmtMoney(e.price) : "—"}</div>
            </div>
            <div class="recipe-card__metric">
              <div class="recipe-card__metric-label">${t("rec_margin")}</div>
              <div class="recipe-card__margin-pct">${e.price > 0 ? e.marginPct.toFixed(0) + "%" : "—"}</div>
            </div>
          </div>

          <div class="recipe-card__ingredients">
            ${visibleIng.join(" · ")}${extraCount > 0 ? ` <span style="color:var(--text3)">+${extraCount}</span>` : ""}
          </div>
        ` : `
          <div class="recipe-card__no-recipe">
            ${icon("plus", 14)} ${t("rec_no_composition")}
            <br/><small style="color:var(--text3);font-size:11px;margin-top:6px;display:inline-block">${t("rec_no_recipes").split(".")[1] || ""}</small>
          </div>
        `}
      </div>`;
    });
    h += `</div>`;
  }

  return h + `</div>`;
}

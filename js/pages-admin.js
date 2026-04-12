// ── Page Employés & Horaires ──────────────────────────
function renderEmployes() {
  const weekStart = getWeekStart();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">Employés & Horaires</h2>
      <button class="btn btn-primary" onclick="openEmployeeModal()">+ Employé</button>
    </div>
    ${employees.length === 0
      ? `<div class="empty"><div style="font-size:36px;margin-bottom:8px">👥</div>Aucun employé enregistré.</div>`
      : `<div class="card" style="margin-bottom:20px;overflow-x:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h3 style="font-size:15px">Horaire — Semaine du ${weekDays[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}</h3>
          <div style="display:flex;gap:6px">${SHIFT_TYPES.map(s => `<span style="background:${s.color};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${s.label}</span>`).join("")}</div>
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
                  ? `<div class="shift-tag" style="background:${s.color || "#3b82f6"}">${s.label || ""}
                      <span onclick="event.stopPropagation();removeShift('${emp.id}','${dk}')" style="cursor:pointer;opacity:.7;margin-left:4px">✕</span>
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
              ${emp.phone ? `<div style="font-size:13px;color:var(--text2);margin-top:4px">📞 ${emp.phone}</div>` : ""}
              ${emp.email ? `<div style="font-size:13px;color:var(--text2)">✉️ ${emp.email}</div>` : ""}
              ${emp.pin ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">🔑 PIN : ${emp.pin}</div>` : ""}
            </div>
            <div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('emp${emp.id}')">⋯</button>
            <div class="dropdown" id="drop-emp${emp.id}">
              <button onclick="openEmployeeModal('${emp.id}');closeAllDrops()">✏️ Modifier</button>
              <div class="sep"></div>
              <button style="color:#ef4444" onclick="askDelete('employees','${emp.id}','${esc(emp.name || "")}');closeAllDrops()">🗑️ Supprimer</button>
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
    <div class="modal-header"><h3>${emp ? "Modifier" : "Ajouter"} un employé</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <label>Nom<input id="e-name" value="${esc(emp?.name || "")}"/></label>
    <label>Poste / Rôle<input id="e-role" value="${esc(emp?.role || "")}" placeholder="ex: Serveur, Cuisinier..."/></label>
    <div class="form-row">
      <label>Téléphone<input id="e-phone" value="${esc(emp?.phone || "")}"/></label>
      <label>Courriel<input id="e-email" value="${esc(emp?.email || "")}"/></label>
    </div>
    <label>Code PIN employé<input id="e-pin" type="text" maxlength="4" value="${esc(emp?.pin || "")}" placeholder="4 chiffres (optionnel)"/>
      <span class="field-hint">Pour la connexion à l'application</span>
    </label>
    <label>Notes<textarea id="e-notes" style="height:60px">${emp?.notes || ""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveEmployee('${id || ""}')">Enregistrer</button>
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
    <div class="modal-header"><h3>🕐 Quart de travail</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Sélectionnez le type de quart :</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${SHIFT_TYPES.map(s => `<button onclick="assignShift('${empId}','${dayKey}','${s.label}','${s.color}')"
        style="background:${s.color};color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">${s.label}</button>`).join("")}
    </div>
    <div class="modal-actions" style="margin-top:12px">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
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
  templates.forEach(t => {
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
    if (activeExpensePeriod === "semaine") {
      const diff = (now - new Date(e.date)) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (activeExpensePeriod === "mois") {
      const d = new Date(e.date);
      return d.getMonth() === selectedExpenseMonth && d.getFullYear() === selectedExpenseYear;
    }
    return new Date(e.date).getFullYear() === selectedExpenseYear;
  });

  const filteredRev = revenues.filter(r => {
    if (activeExpensePeriod === "semaine") {
      const diff = (now - new Date(r.date)) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (activeExpensePeriod === "mois") {
      const d = new Date(r.date);
      return d.getMonth() === selectedExpenseMonth && d.getFullYear() === selectedExpenseYear;
    }
    return new Date(r.date).getFullYear() === selectedExpenseYear;
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
  const pieColors = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316","#64748b"];

  // Month picker
  let monthPicker = "";
  if (activeExpensePeriod === "mois") {
    monthPicker = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button onclick="changeExpenseMonth(-1)" style="border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:4px 10px;cursor:pointer;color:var(--text)">◀</button>
      <select onchange="setExpenseMonthYear(this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px 10px;background:var(--surface);color:var(--text);font-size:14px">
        ${Array.from({length:12},(_,i)=>`<option value="${i}" ${i===selectedExpenseMonth?"selected":""}>${MONTHS_FR[i]}</option>`).join("")}
      </select>
      <select onchange="setExpenseYear(this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px 10px;background:var(--surface);color:var(--text);font-size:14px">
        ${[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=>`<option value="${y}" ${y===selectedExpenseYear?"selected":""}>${y}</option>`).join("")}
      </select>
      <button onclick="changeExpenseMonth(1)" style="border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:4px 10px;cursor:pointer;color:var(--text)">▶</button>
      <span style="font-size:13px;color:var(--text3)">${MONTHS_FR[selectedExpenseMonth]} ${selectedExpenseYear}</span>
    </div>`;
  }

  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">Dépenses & Revenus</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="openRevenueModal()">+ Revenu</button>
        <button class="btn btn-primary" onclick="openExpenseModal()">+ Dépense</button>
        ${isAdmin ? `<button class="btn btn-secondary" onclick="openExpenseCatModal()">⚙️ Catégories</button>` : ""}
        ${isAdmin ? `<button class="btn btn-secondary" onclick="openFixedTemplatesModal()">🔒 Frais fixes</button>` : ""}
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${["semaine","mois","année"].map(p => `<button class="sec-btn ${activeExpensePeriod===p?"active":""}" onclick="setExpensePeriod('${p}')">${p.charAt(0).toUpperCase()+p.slice(1)}</button>`).join("")}
    </div>

    ${monthPicker}

    <!-- Stats -->
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:20px">
      <div class="stat-card" style="border-left:4px solid #22c55e">
        <div class="stat-num" style="color:#22c55e">${fmtMoney(totalRev)}</div>
        <div class="stat-label">💰 Revenus</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #ef4444">
        <div class="stat-num" style="color:#ef4444">${fmtMoney(totalExp)}</div>
        <div class="stat-label">💸 Dépenses (avant taxes)</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #f59e0b">
        <div class="stat-num" style="color:#f59e0b;font-size:20px">${fmtMoney(totalTPS+totalTVQ)}</div>
        <div class="stat-label">🧾 Taxes (TPS+TVQ)</div>
      </div>
      <div class="stat-card" style="border-left:4px solid ${isProfit?"#22c55e":"#ef4444"}">
        <div class="stat-num" style="color:${isProfit?"#22c55e":"#ef4444"}">${fmtMoney(Math.abs(profit))}</div>
        <div class="stat-label">${isProfit?"📈 Profit":"📉 Déficit"}</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #8b5cf6">
        <div class="stat-num" style="font-size:20px;color:#8b5cf6">${fmtMoney(totalFixed)}</div>
        <div class="stat-label">🔒 Frais fixes</div>
      </div>
      <div class="stat-card" style="border-left:4px solid #64748b">
        <div class="stat-num" style="font-size:20px;color:#64748b">${fmtMoney(totalVar)}</div>
        <div class="stat-label">📊 Frais variables</div>
      </div>
    </div>

    <!-- Graphiques -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;margin-bottom:24px">

      <!-- Barres : Revenus vs Dépenses -->
      <div class="card">
        <div style="font-weight:700;font-size:14px;margin-bottom:16px">📊 Revenus vs Dépenses — 6 derniers mois</div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:140px;padding-bottom:24px;position:relative">
          ${last6.map((m, i) => {
            const rev = chartRevs[i], exp = chartExps[i];
            const revH = Math.round((rev / chartMax) * 120);
            const expH = Math.round((exp / chartMax) * 120);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative">
              <div style="display:flex;align-items:flex-end;gap:2px;height:120px">
                <div title="${fmtMoney(rev)}" style="width:12px;height:${revH}px;background:#22c55e;border-radius:3px 3px 0 0;min-height:${rev>0?2:0}px"></div>
                <div title="${fmtMoney(exp)}" style="width:12px;height:${expH}px;background:#ef4444;border-radius:3px 3px 0 0;min-height:${exp>0?2:0}px"></div>
              </div>
              <div style="font-size:10px;color:var(--text3);position:absolute;bottom:0">${m.label}</div>
            </div>`;
          }).join("")}
        </div>
        <div style="display:flex;gap:16px;margin-top:4px">
          <span style="font-size:11px;color:#22c55e;font-weight:600">■ Revenus</span>
          <span style="font-size:11px;color:#ef4444;font-weight:600">■ Dépenses</span>
        </div>
      </div>

      <!-- Camembert : Dépenses par catégorie -->
      <div class="card">
        <div style="font-weight:700;font-size:14px;margin-bottom:16px">🥧 Dépenses par catégorie</div>
        ${catTotals.length === 0
          ? `<div style="text-align:center;color:var(--text3);padding:40px 0">Aucune dépense</div>`
          : `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <svg viewBox="0 0 100 100" style="width:120px;height:120px;flex-shrink:0">
              ${(() => {
                let offset = 0;
                return catTotals.map((c, i) => {
                  const pct = c.total / pieTotal;
                  const dash = pct * 100;
                  const gap = 100 - dash;
                  const rotate = offset * 3.6;
                  offset += pct * 100;
                  return `<circle cx="50" cy="50" r="15.915" fill="none" stroke="${pieColors[i%pieColors.length]}" stroke-width="30"
                    stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${25 - offset + pct*100}" transform="rotate(${rotate-90} 50 50)"/>`;
                }).join("");
              })()}
            </svg>
            <div style="flex:1;min-width:120px">
              ${catTotals.map((c, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <div style="width:10px;height:10px;border-radius:2px;background:${pieColors[i%pieColors.length]};flex-shrink:0"></div>
                <span style="font-size:11px;color:var(--text2);flex:1">${c.cat}</span>
                <span style="font-size:11px;font-weight:700;color:var(--text)">${fmtMoney(c.total)}</span>
              </div>`).join("")}
            </div>
          </div>`}
      </div>
    </div>

    <!-- Revenus -->
    ${filteredRev.length > 0 ? `
    <h3 style="font-size:15px;margin-bottom:10px">💰 Revenus</h3>
    <div class="table-wrap overflow" style="margin-bottom:20px">
      <table><thead><tr><th>Date</th><th>Description</th><th>Montant</th><th>TPS</th><th>TVQ</th><th></th></tr></thead>
      <tbody>${filteredRev.map(r => `<tr>
        <td>${r.date||""}</td>
        <td><strong>${r.description||""}</strong></td>
        <td style="font-weight:700;color:#22c55e">${fmtMoney(r.amount)}</td>
        <td style="color:var(--text3)">${r.tps?fmtMoney(r.tps):"—"}</td>
        <td style="color:var(--text3)">${r.tvq?fmtMoney(r.tvq):"—"}</td>
        <td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('rev${r.id}')">⋯</button>
          <div class="dropdown" id="drop-rev${r.id}">
            <button onclick="openRevenueModal('${r.id}');closeAllDrops()">✏️ Modifier</button>
            <div class="sep"></div>
            <button style="color:#ef4444" onclick="askDelete('revenues','${r.id}','${esc(r.description||"")}');closeAllDrops()">🗑️ Supprimer</button>
          </div></div></td>
      </tr>`).join("")}</tbody></table>
    </div>` : ""}

    <!-- Dépenses -->
    <h3 style="font-size:15px;margin-bottom:10px">💸 Dépenses</h3>
    <div class="table-wrap overflow">
      <table><thead><tr><th>Date</th><th>Fournisseur</th><th>Catégorie</th><th>Type</th><th>Avant taxes</th><th>TPS</th><th>TVQ</th><th>Total</th><th></th></tr></thead>
      <tbody>${filteredExp.length === 0
        ? `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">Aucune dépense pour cette période.</td></tr>`
        : filteredExp.map(e => {
            const total = Number(e.amount||0) + Number(e.tps||0) + Number(e.tvq||0);
            const type = getExpenseCatType(e.category);
            return `<tr>
              <td>${e.date||""}${e.isFixedAuto?` <span style="font-size:10px;color:#8b5cf6">🔒auto</span>`:""}</td>
              <td><strong>${e.supplier||e.description||"—"}</strong></td>
              <td><span class="badge-pill blue">${e.category||""}</span></td>
              <td><span class="badge-pill ${type==="fixe"?"green":"yellow"}">${type==="fixe"?"🔒 Fixe":"📊 Variable"}</span></td>
              <td style="font-weight:700;color:var(--accent)">${fmtMoney(e.amount)}</td>
              <td style="color:var(--text3)">${e.tps?fmtMoney(e.tps):"—"}</td>
              <td style="color:var(--text3)">${e.tvq?fmtMoney(e.tvq):"—"}</td>
              <td style="font-weight:700">${fmtMoney(total)}</td>
              <td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('exp${e.id}')">⋯</button>
                <div class="dropdown" id="drop-exp${e.id}">
                  <button onclick="openExpenseModal('${e.id}');closeAllDrops()">✏️ Modifier</button>
                  <div class="sep"></div>
                  <button style="color:#ef4444" onclick="askDelete('expenses','${e.id}','${esc(e.supplier||e.description||"")}');closeAllDrops()">🗑️ Supprimer</button>
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
    <div class="modal-header"><h3>${e ? "Modifier" : "Ajouter"} une dépense</h3><button class="close-btn" onclick="closeModal()">✕</button></div>

    <div class="form-row">
      <label>Fournisseur
        <select id="ex-sup">
          <option value="">— Aucun —</option>
          ${suppliers.map(s => `<option value="${s.name}" ${e?.supplier===s.name?"selected":""}>${s.name}</option>`).join("")}
        </select>
      </label>
      <label style="justify-content:flex-end;padding-top:18px">
        <button type="button" onclick="openQuickSupplier()" style="border:1px dashed var(--border);background:none;color:var(--accent);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:600">+ Nouveau fournisseur</button>
      </label>
    </div>

    <div class="form-row">
      <label>Catégorie
        <select id="ex-cat" onchange="updateExpenseType()">
          ${cats.map(c => `<option value="${c}" ${currentCat===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </label>
      <label>Type de frais
        <select id="ex-type">
          <option value="variable" ${currentType==="variable"?"selected":""}>📊 Variable</option>
          <option value="fixe" ${currentType==="fixe"?"selected":""}>🔒 Fixe</option>
        </select>
      </label>
    </div>

    <label>Date<input id="ex-date" type="date" value="${e?.date||today}"/></label>

    <label>Montant avant taxes ($)
      <input id="ex-amt" type="number" step="0.01" value="${e?.amount||""}" oninput="calcExpenseTaxes()"/>
    </label>

    <div class="form-row">
      <label>TPS (5%)
        <input id="ex-tps" type="number" step="0.01" value="${e?.tps||""}"/>
      </label>
      <label>TVQ (9.975%)
        <input id="ex-tvq" type="number" step="0.01" value="${e?.tvq||""}"/>
      </label>
    </div>
    <div id="ex-total-preview" style="font-size:13px;color:var(--text2);margin-bottom:10px;text-align:right"></div>

    <label>Notes<textarea id="ex-notes" style="height:60px">${e?.notes||""}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveExpense('${id||""}')">Enregistrer</button>
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
  if (prev && amt > 0) prev.innerHTML = `Total avec taxes : <strong>${fmtMoney(amt + tps + tvq)}</strong>`;
}

async function saveExpense(id) {
  const sup = document.getElementById("ex-sup").value;
  const amt = Number(document.getElementById("ex-amt").value) || 0;
  if (!amt) return alert("Entrez un montant.");
  const type = document.getElementById("ex-type").value;
  const data = {
    supplier: sup,
    description: sup,
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
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${r ? "Modifier" : "Ajouter"} un revenu</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <label>Description<input id="rv-desc" value="${esc(r?.description||"")}"/></label>
    <label>Date<input id="rv-date" type="date" value="${r?.date||today}"/></label>
    <label>Montant ($)
      <input id="rv-amt" type="number" step="0.01" value="${r?.amount||""}" oninput="calcRevenueTaxes()"/>
    </label>
    <div class="form-row">
      <label>TPS perçue (5%)
        <input id="rv-tps" type="number" step="0.01" value="${r?.tps||""}"/>
      </label>
      <label>TVQ perçue (9.975%)
        <input id="rv-tvq" type="number" step="0.01" value="${r?.tvq||""}"/>
      </label>
    </div>
    <div id="rv-total-preview" style="font-size:13px;color:var(--text2);margin-bottom:10px;text-align:right"></div>
    <label>Notes<textarea id="rv-notes" style="height:60px">${r?.notes||""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveRevenue('${id||""}')">Enregistrer</button>
    </div>
  </div>`);
  setTimeout(calcRevenueTaxes, 50);
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
  if (prev && amt > 0) prev.innerHTML = `Total avec taxes : <strong>${fmtMoney(amt + tps + tvq)}</strong>`;
}

async function saveRevenue(id) {
  const desc = document.getElementById("rv-desc").value.trim();
  const amt = Number(document.getElementById("rv-amt").value) || 0;
  if (!desc) return alert("Entrez une description.");
  if (!amt) return alert("Entrez un montant.");
  const data = {
    description: desc,
    amount: amt,
    tps: Number(document.getElementById("rv-tps").value) || 0,
    tvq: Number(document.getElementById("rv-tvq").value) || 0,
    date: document.getElementById("rv-date").value,
    notes: document.getElementById("rv-notes").value
  };
  if (id) await db.collection("revenues").doc(id).update(data);
  else { const nid = genId(); await db.collection("revenues").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// ── Modal Fournisseur rapide ──────────────────────────
function openQuickSupplier() {
  showModal(`<div class="modal" style="max-width:380px">
    <div class="modal-header"><h3>🏪 Nouveau fournisseur</h3><button class="close-btn" onclick="openExpenseModal()">✕</button></div>
    <label>Nom<input id="qs-name" placeholder="Nom du fournisseur"/></label>
    <label>Téléphone<input id="qs-phone"/></label>
    <label>Courriel<input id="qs-email"/></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="openExpenseModal()">Annuler</button>
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
    <div class="modal-header"><h3>⚙️ Catégories de dépenses</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
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
        <option value="variable">📊 Variable</option>
        <option value="fixe">🔒 Fixe</option>
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
    <div class="modal-header"><h3>🔒 Modèles de frais fixes</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Ces frais sont copiés automatiquement le 1er de chaque mois.</p>
    <div style="margin-bottom:12px">
      ${templates.length === 0
        ? `<p style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Aucun modèle de frais fixe.</p>`
        : templates.map(t => `<div class="cat-item" style="justify-content:space-between">
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px">${t.supplier||t.description||"—"}</div>
              <div style="font-size:11px;color:var(--text3)">${t.category||""} · ${fmtMoney(t.amount)}</div>
            </div>
            <button class="btn-danger-sm" onclick="deleteFixedTemplate('${t.id}')">🗑️</button>
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
        <label>Catégorie
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
  if (!amt) return alert("Entrez un montant.");
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
      <div><h2 style="font-size:18px">Menu</h2>
      <p style="font-size:13px;color:var(--text3);margin-top:2px">${available} item${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}</p></div>
      <button class="btn btn-primary" onclick="openMenuModal()">+ Item</button>
    </div>
    <div class="sec-tabs">${cats.map(c => `<button class="sec-btn ${activeMenuCat === c ? "active" : ""}" onclick="setMenuCat('${c}')">${c}</button>`).join("")}</div>
    ${filtered.length === 0
      ? `<div class="empty"><div style="font-size:36px;margin-bottom:8px">🍽️</div>Aucun item dans cette catégorie.</div>`
      : `<div class="card-grid">${filtered.map(m => `<div class="menu-item-card ${m.available === false ? "unavailable" : ""}">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-weight:700;font-size:15px">${m.name || ""}</span>
              ${m.available === false ? `<span class="badge-pill" style="background:#f1f5f9;border:1px solid var(--border);color:var(--text3);font-size:10px">Indisponible</span>` : ""}
            </div>
            ${m.description ? `<div style="font-size:12px;color:var(--text2);margin-bottom:6px">${m.description}</div>` : ""}
            <span class="badge-pill blue" style="font-size:11px">${m.category || ""}</span>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:12px">
            <div class="price-tag">${fmtMoney(m.price)}</div>
            <div class="menu-wrap" style="margin-top:6px"><button class="dots-btn" onclick="toggleDrop('mn${m.id}')">⋯</button>
            <div class="dropdown" id="drop-mn${m.id}">
              <button onclick="openMenuModal('${m.id}');closeAllDrops()">✏️ Modifier</button>
              <button onclick="toggleMenuAvailable('${m.id}',${m.available !== false});closeAllDrops()">${m.available === false ? "✅ Marquer disponible" : "⛔ Marquer indisponible"}</button>
              <div class="sep"></div>
              <button style="color:#ef4444" onclick="askDelete('menu','${m.id}','${esc(m.name || "")}');closeAllDrops()">🗑️ Supprimer</button>
            </div></div>
          </div>
        </div>`).join("")}</div>`}
  </div>`;
}

async function toggleMenuAvailable(id, current) {
  await db.collection("menu").doc(id).update({ available: !current });
}

function openMenuModal(id) {
  const m = id ? menuItems.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${m ? "Modifier" : "Ajouter"} un item au menu</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <label>Nom<input id="mn-name" value="${esc(m?.name || "")}"/></label>
    <label>Description<textarea id="mn-desc" style="height:70px">${m?.description || ""}</textarea></label>
    <div class="form-row">
      <label>Prix ($)<input id="mn-price" type="number" step="0.01" value="${m?.price || ""}"/></label>
      <label>Catégorie<select id="mn-cat">${MENU_CATS.map(c => `<option value="${c}" ${(m?.category || "Plats principaux") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveMenuItem('${id || ""}')">Enregistrer</button>
    </div>
  </div>`);
}

async function saveMenuItem(id) {
  const name = document.getElementById("mn-name").value.trim();
  if (!name) return alert("Entrez un nom.");
  const data = {
    name,
    description: document.getElementById("mn-desc").value,
    price: Number(document.getElementById("mn-price").value) || 0,
    category: document.getElementById("mn-cat").value,
    available: true
  };
  if (id) await db.collection("menu").doc(id).update(data);
  else { const nid = genId(); await db.collection("menu").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

// ── Page Fournisseurs ─────────────────────────────────
function renderFournisseurs() {
  const activeProducts = products.filter(p => !p.archived);
  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">Fournisseurs</h2>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openSupplierModal()">+ Fournisseur</button>` : ""}
    </div>
    ${suppliers.length === 0
      ? `<div class="empty"><div style="font-size:40px;margin-bottom:8px">🏪</div>Aucun fournisseur.</div>`
      : `<div class="supplier-grid">${suppliers.map(s => {
          const linked = activeProducts.filter(p => p.supplierId === s.id);
          return `<div class="supplier-card">
            <div style="display:flex;justify-content:space-between">
              <div>
                <div style="font-weight:700;font-size:16px">🏪 ${s.name || ""}</div>
                ${s.contact ? `<div style="color:var(--text2);font-size:13px;margin-top:4px">📞 ${s.contact}</div>` : ""}
                ${s.email ? `<div style="color:var(--text2);font-size:13px">✉️ ${s.email}</div>` : ""}
                ${s.notes ? `<div style="color:var(--text3);font-size:12px;margin-top:6px;font-style:italic">${s.notes}</div>` : ""}
              </div>
              ${isAdmin ? `<div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('sup${s.id}')">⋯</button>
                <div class="dropdown" id="drop-sup${s.id}">
                  <button onclick="openSupplierModal('${s.id}');closeAllDrops()">✏️ Modifier</button>
                  <div class="sep"></div>
                  <button style="color:#ef4444" onclick="askDelete('suppliers','${s.id}','${esc(s.name || "")}');closeAllDrops()">🗑️ Supprimer</button>
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
    <div class="modal-header"><h3>${s ? "Modifier" : "Ajouter"} un fournisseur</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <label>Nom<input id="s-name" value="${esc(s?.name || "")}"/></label>
    <label>Téléphone<input id="s-contact" value="${esc(s?.contact || "")}"/></label>
    <label>Courriel<input id="s-email" value="${esc(s?.email || "")}"/></label>
    <label>Notes<textarea id="s-notes" style="height:70px">${s?.notes || ""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveSupplier('${id || ""}')">Enregistrer</button>
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

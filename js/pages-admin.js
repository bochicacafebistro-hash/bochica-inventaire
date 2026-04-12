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

// ── Modal Employé ─────────────────────────────────────
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

// ── Modal Quart de travail ────────────────────────────
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

// ── Page Dépenses ─────────────────────────────────────
function renderDepenses() {
  const now = new Date();
  const filtered = expenses.filter(e => {
    const d = new Date(e.date);
    if (activeExpensePeriod === "semaine") { const diff = (now - d) / (1000 * 60 * 60 * 24); return diff <= 7; }
    if (activeExpensePeriod === "mois") { return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
    return d.getFullYear() === now.getFullYear();
  });
  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
  const bycat = EXPENSE_CATS.map(c => ({ cat: c, total: filtered.filter(e => e.category === c).reduce((s, e) => s + Number(e.amount || 0), 0) }));
  return `<div class="page">
    <div class="toolbar">
      <h2 style="font-size:18px">Dépenses</h2>
      <button class="btn btn-primary" onclick="openExpenseModal()">+ Dépense</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      ${["semaine", "mois", "année"].map(p => `<button class="sec-btn ${activeExpensePeriod === p ? "active" : ""}" onclick="setExpensePeriod('${p}')">${p.charAt(0).toUpperCase() + p.slice(1)}</button>`).join("")}
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num" style="color:var(--accent)">${fmtMoney(total)}</div><div class="stat-label">Total dépenses</div></div>
      ${bycat.filter(c => c.total > 0).map(c => `<div class="stat-card"><div class="stat-num" style="font-size:20px">${fmtMoney(c.total)}</div><div class="stat-label">${c.cat}</div></div>`).join("")}
    </div>
    <div class="table-wrap overflow"><table>
      <thead><tr><th>Date</th><th>Description</th><th>Catégorie</th><th>Fournisseur</th><th>Montant</th><th></th></tr></thead>
      <tbody>${filtered.length === 0
        ? `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Aucune dépense pour cette période.</td></tr>`
        : filtered.map(e => `<tr>
          <td>${e.date || ""}</td>
          <td><strong>${e.description || ""}</strong></td>
          <td><span class="badge-pill blue">${e.category || ""}</span></td>
          <td>${e.supplier || "—"}</td>
          <td style="font-weight:700;color:var(--accent)">${fmtMoney(e.amount)}</td>
          <td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('exp${e.id}')">⋯</button>
            <div class="dropdown" id="drop-exp${e.id}">
              <button onclick="openExpenseModal('${e.id}');closeAllDrops()">✏️ Modifier</button>
              <div class="sep"></div>
              <button style="color:#ef4444" onclick="askDelete('expenses','${e.id}','${esc(e.description || "")}');closeAllDrops()">🗑️ Supprimer</button>
            </div></div></td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </div>`;
}

// ── Modal Dépense ─────────────────────────────────────
function openExpenseModal(id) {
  const e = id ? expenses.find(x => x.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${e ? "Modifier" : "Ajouter"} une dépense</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <label>Description<input id="ex-desc" value="${esc(e?.description || "")}"/></label>
    <div class="form-row">
      <label>Montant ($)<input id="ex-amt" type="number" step="0.01" value="${e?.amount || ""}"/></label>
      <label>Date<input id="ex-date" type="date" value="${e?.date || today}"/></label>
    </div>
    <div class="form-row">
      <label>Catégorie<select id="ex-cat">${EXPENSE_CATS.map(c => `<option value="${c}" ${e?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>Fournisseur<input id="ex-sup" value="${esc(e?.supplier || "")}" placeholder="Optionnel"/></label>
    </div>
    <label>Notes<textarea id="ex-notes" style="height:60px">${e?.notes || ""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveExpense('${id || ""}')">Enregistrer</button>
    </div>
  </div>`);
}

async function saveExpense(id) {
  const desc = document.getElementById("ex-desc").value.trim();
  if (!desc) return alert("Entrez une description.");
  const data = {
    description: desc,
    amount: Number(document.getElementById("ex-amt").value) || 0,
    date: document.getElementById("ex-date").value,
    category: document.getElementById("ex-cat").value,
    supplier: document.getElementById("ex-sup").value,
    notes: document.getElementById("ex-notes").value
  };
  if (id) await db.collection("expenses").doc(id).update(data);
  else { const nid = genId(); await db.collection("expenses").doc(nid).set({ ...data, id: nid }); }
  closeModal();
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

// ── Modal Menu ────────────────────────────────────────
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

// ── Modal Fournisseur ─────────────────────────────────
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

// ── Page Rapport ──────────────────────────────────────
function renderRapport() {
  const activeProducts = products.filter(p => !p.archived);
  const toOrder = activeProducts.filter(p => ["red", "yellow"].includes(getStatus(p)))
    .sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);
  const redCnt = toOrder.filter(p => getStatus(p) === "red").length;
  const yelCnt = toOrder.filter(p => getStatus(p) === "yellow").length;

  let h = `<div class="page">
    <div class="toolbar">
      <div><h2 style="font-size:18px">Rapport de commande</h2>
      <p style="font-size:13px;color:var(--text3);margin-top:2px">Produits sous le minimum ou à moins de 20% du seuil</p></div>
      <button class="btn btn-secondary" onclick="printReport()">🖨️ Exporter</button>
    </div>`;

  if (!toOrder.length) {
    return h + `<div class="empty"><div style="font-size:48px;margin-bottom:8px">✅</div>Tous les produits sont en quantité suffisante !</div></div>`;
  }

  h += `<div class="summary-cards">
    <div class="summary-card" style="border-color:#ef4444"><div style="font-weight:700;font-size:22px;color:#ef4444">${redCnt}</div><div style="font-size:13px;color:#ef4444">⚠️ À commander immédiatement</div></div>
    <div class="summary-card" style="border-color:#eab308"><div style="font-weight:700;font-size:22px;color:#eab308">${yelCnt}</div><div style="font-size:13px;color:#eab308">🟡 Bientôt bas</div></div>
  </div>`;

  getAllSections().filter(s => s !== "Toutes").forEach(section => {
    const items = toOrder.filter(p => p.section === section);
    if (!items.length) return;
    h += `<h3 style="font-size:13px;color:var(--text2);border-bottom:2px solid var(--border);padding-bottom:6px;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">📁 ${section}</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:24px">`;
    items.forEach(p => { h += buildInvCard(p, false, true); });
    h += `</div>`;
  });
  return h + `</div>`;
}

function printReport() {
  const activeP = products.filter(p => !p.archived);
  const toOrder = activeP.filter(p => ["red", "yellow"].includes(getStatus(p)))
    .sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);
  const rows = toOrder.map(p => {
    const sup = suppliers.find(s => s.id === p.supplierId), st = getStatus(p), stock = getCurrentStock(p);
    return `<tr style="border-left:4px solid ${st === "red" ? "#ef4444" : "#eab308"}">
      <td>${p.name}</td><td>${p.section}</td><td>${stock}</td><td>${p.minimum || 0}</td>
      <td>${orderLabel(p)}${p.orderUnit === "boîte" ? ` (${(p.orderQty || 0) * (p.unitsPerBox || 1)} unités)` : ""}</td>
      <td>${sup ? sup.name : "—"}</td><td>${sup ? sup.contact || "—" : "—"}</td><td>${statusLabel(st)}</td>
    </tr>`;
  }).join("");
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>Rapport</title>
    <style>body{font-family:system-ui,sans-serif;padding:32px}table{width:100%;border-collapse:collapse;font-size:13px}th{padding:10px;background:#f1f5f9;text-align:left;font-size:11px;text-transform:uppercase}td{padding:10px;border-bottom:1px solid #e2e8f0}@media print{button{display:none}}</style>
    </head><body>
    <div style="font-size:26px;font-weight:900;letter-spacing:4px">BOCHICA</div>
    <div style="display:flex;height:3px;width:200px;margin:6px 0 14px"><div style="flex:1;background:#f5a623"></div><div style="flex:1;background:#4a90e2"></div><div style="flex:1;background:#e74c3c"></div></div>
    <h2>Rapport de commande</h2>
    <p style="color:#64748b;font-size:13px;margin-bottom:16px">${new Date().toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    <table><thead><tr><th>Produit</th><th>Section</th><th>Stock</th><th>Min</th><th>À commander</th><th>Fournisseur</th><th>Contact</th><th>Statut</th></tr></thead>
    <tbody>${rows}</tbody></table><br/>
    <button onclick="window.print()" style="background:#3b82f6;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer">🖨️ Imprimer</button>
    </body></html>`);
  win.document.close();
}

// ── Page Historique ───────────────────────────────────
function renderHistorique() {
  const filtered = logs.filter(l => logFilter === "" || l.productName?.toLowerCase().includes(logFilter.toLowerCase()));
  return `<div class="page">
    <div class="toolbar"><h2 style="font-size:18px">Historique</h2></div>
    <div style="margin-bottom:14px"><div class="search-box" style="max-width:320px"><span style="color:var(--text3)">🔍</span>
      <input type="text" placeholder="Filtrer par produit..." value="${logFilter}" oninput="setLogFilter(this.value)"/>
    </div></div>
    ${filtered.length === 0
      ? `<div class="empty"><div style="font-size:36px;margin-bottom:8px">📋</div>Aucune entrée.</div>`
      : `<div class="table-wrap"><div style="padding:4px 0">${filtered.map(l => `
        <div class="log-item" style="padding:10px 16px">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <div><span style="font-weight:700">${l.productName || "?"}</span> <span style="color:var(--text3);font-size:12px">(${l.role || ""})</span>
            <div style="color:var(--text2);font-size:13px;margin-top:2px">${l.action || ""} ${l.detail ? `— ${l.detail}` : ""}</div></div>
            <div style="font-size:11px;color:var(--text3);white-space:nowrap">${fmtDate(l.ts)}</div>
          </div>
        </div>`).join("")}</div></div>`}
  </div>`;
}

// ── Page Tâches ───────────────────────────────────────
function renderTaches() {
  const prioColor = { haute: "#ef4444", moyenne: "#f59e0b", basse: "#22c55e" };
  const pendingTasks = tasks.filter(t => t.status !== "Complété").length;
  return `<div class="page">
    <div class="toolbar">
      <div><h2 style="font-size:18px">Tâches</h2>
      <p style="font-size:13px;color:var(--text3);margin-top:2px">${pendingTasks} tâche${pendingTasks > 1 ? "s" : ""} en attente</p></div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openTaskModal()">+ Tâche</button>` : ""}
    </div>
    <div class="task-cols">
    ${TASK_COLS.map(col => {
      const items = tasks.filter(t => t.status === col);
      return `<div class="task-col">
        <div class="col-title">${col === "À faire" ? "📋" : col === "En cours" ? "🔄" : "✅"} ${col}
          <span style="background:var(--surface3);border-radius:10px;padding:1px 7px;font-size:11px">${items.length}</span>
        </div>
        ${items.map(t => `<div class="task-card" onclick="${isAdmin ? `openTaskModal('${t.id}')` : `cycleTaskStatus('${t.id}','${t.status}')`}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;display:flex;align-items:center">
                <span class="task-prio" style="background:${prioColor[t.priority] || "#94a3b8"}"></span>${t.title || ""}
              </div>
              ${t.description ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${t.description}</div>` : ""}
              <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
                ${t.assignedTo ? `<span style="font-size:11px;color:var(--text3)">👤 ${t.assignedTo}</span>` : ""}
                ${t.dueDate ? `<span style="font-size:11px;color:var(--text3)">📅 ${t.dueDate}</span>` : ""}
              </div>
            </div>
            ${isAdmin ? `<div class="menu-wrap" onclick="event.stopPropagation()">
              <button class="dots-btn" onclick="toggleDrop('tk${t.id}')">⋯</button>
              <div class="dropdown" id="drop-tk${t.id}">
                <button onclick="openTaskModal('${t.id}');closeAllDrops()">✏️ Modifier</button>
                <div class="sep"></div>
                <button style="color:#ef4444" onclick="askDelete('tasks','${t.id}','${esc(t.title || "")}');closeAllDrops()">🗑️ Supprimer</button>
              </div></div>` : ""}
          </div>
        </div>`).join("")}
        ${isAdmin ? `<button onclick="openTaskModal(null,'${col}')" style="width:100%;border:1px dashed var(--border);background:none;color:var(--text3);border-radius:8px;padding:8px;cursor:pointer;font-size:13px;margin-top:4px">+ Ajouter</button>` : ""}
      </div>`;
    }).join("")}
    </div>
  </div>`;
}

async function cycleTaskStatus(id, current) {
  const idx = TASK_COLS.indexOf(current);
  const next = TASK_COLS[(idx + 1) % TASK_COLS.length];
  await db.collection("tasks").doc(id).update({ status: next });
}

// ── Modal Tâche ───────────────────────────────────────
function openTaskModal(id, defaultCol) {
  const t = id ? tasks.find(x => x.id === id) : null;
  const empNames = employees.map(e => e.name || "").filter(Boolean);
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${t ? "Modifier" : "Ajouter"} une tâche</h3><button class="close-btn" onclick="closeModal()">✕</button></div>
    <label>Titre<input id="t-title" value="${esc(t?.title || "")}"/></label>
    <label>Description<textarea id="t-desc" style="height:80px">${t?.description || ""}</textarea></label>
    <div class="form-row">
      <label>Statut<select id="t-status">${TASK_COLS.map(c => `<option value="${c}" ${(t?.status || defaultCol || "À faire") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>Priorité<select id="t-prio">
        <option value="basse" ${t?.priority === "basse" ? "selected" : ""}>🟢 Basse</option>
        <option value="moyenne" ${(t?.priority || "moyenne") === "moyenne" ? "selected" : ""}>🟡 Moyenne</option>
        <option value="haute" ${t?.priority === "haute" ? "selected" : ""}>🔴 Haute</option>
      </select></label>
    </div>
    <div class="form-row">
      <label>Assignée à<select id="t-assign">
        <option value="">— Personne —</option>
        ${empNames.map(n => `<option value="${n}" ${t?.assignedTo === n ? "selected" : ""}>${n}</option>`).join("")}
      </select></label>
      <label>Date limite<input id="t-due" type="date" value="${t?.dueDate || ""}"/></label>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveTask('${id || ""}')">Enregistrer</button>
    </div>
  </div>`);
}

async function saveTask(id) {
  const title = document.getElementById("t-title").value.trim();
  if (!title) return alert("Entrez un titre.");
  const data = {
    title,
    description: document.getElementById("t-desc").value,
    status: document.getElementById("t-status").value,
    priority: document.getElementById("t-prio").value,
    assignedTo: document.getElementById("t-assign").value,
    dueDate: document.getElementById("t-due").value
  };
  if (id) await db.collection("tasks").doc(id).update(data);
  else { const nid = genId(); await db.collection("tasks").doc(nid).set({ ...data, id: nid }); }
  closeModal();
}

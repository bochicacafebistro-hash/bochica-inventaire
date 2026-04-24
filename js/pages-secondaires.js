// ── Page Rapport ──────────────────────────────────────
function renderRapport() {
  const activeProducts = products.filter(p => !p.archived);
  const toOrder = activeProducts.filter(p => ["red", "yellow"].includes(getStatus(p)))
    .sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);
  const redCnt = toOrder.filter(p => getStatus(p) === "red").length;
  const yelCnt = toOrder.filter(p => getStatus(p) === "yellow").length;

  let h = `<div class="page">
    <div class="toolbar">
      <div><h2 style="font-size:18px">${t("rapport_title")}</h2>
      <p style="font-size:13px;color:var(--text3);margin-top:2px">${t("rapport_subtitle")}</p></div>
      <button class="btn btn-secondary" onclick="printReport()">${icon("printer", 16)} ${t("export")}</button>
    </div>`;

  if (!toOrder.length) {
    return h + `<div class="empty"><div style="margin-bottom:12px;color:var(--status-green);display:flex;justify-content:center">${icon("check-circle", 48)}</div>${t("rapport_all_ok")}</div></div>`;
  }

  h += `<div class="summary-cards">
    <div class="summary-card" style="border-color:var(--status-red)"><div style="font-weight:700;font-size:22px;color:var(--status-red)">${redCnt}</div><div class="icon-inline" style="font-size:13px;color:var(--status-red)">${icon("alert", 14)} ${t("rapport_immediate")}</div></div>
    <div class="summary-card" style="border-color:var(--status-yellow)"><div style="font-weight:700;font-size:22px;color:var(--status-yellow)">${yelCnt}</div><div class="icon-inline" style="font-size:13px;color:var(--status-yellow)">${icon("clock", 14)} ${t("rapport_soon")}</div></div>
  </div>`;

  getAllSections().filter(s => s !== "Toutes").forEach(section => {
    const items = toOrder.filter(p => p.section === section);
    if (!items.length) return;
    h += `<h3 class="icon-inline" style="font-size:13px;color:var(--text2);border-bottom:2px solid var(--border);padding-bottom:6px;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">${icon("folder", 14)} ${section}</h3>
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
    return `<tr style="border-left:4px solid ${st === "red" ? "var(--status-red)" : "var(--status-yellow)"}">
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
    <div style="display:flex;height:3px;width:200px;margin:6px 0 14px"><div style="flex:1;background:#F7B32C"></div><div style="flex:1;background:#4a90e2"></div><div style="flex:1;background:#e74c3c"></div></div>
    <h2>Rapport de commande</h2>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px">${new Date().toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    <table><thead><tr><th>Produit</th><th>Section</th><th>Stock</th><th>Min</th><th>À commander</th><th>Fournisseur</th><th>Contact</th><th>${t("task_field_status")}</th></tr></thead>
    <tbody>${rows}</tbody></table><br/>
    <button onclick="window.print()" style="background:var(--blue);color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer">🖨️ Imprimer</button>
    </body></html>`);
  win.document.close();
}

// ── Page Historique ───────────────────────────────────
function renderHistorique() {
  const filtered = logs.filter(l => logFilter === "" || l.productName?.toLowerCase().includes(logFilter.toLowerCase()));
  return `<div class="page">
    <div class="toolbar"><h2 style="font-size:18px">${t("history_title")}</h2></div>
    <div style="margin-bottom:14px"><div class="search-box" style="max-width:320px"><span style="color:var(--text3);display:flex">${icon("search", 16)}</span>
      <input type="text" placeholder="${t(`history_filter`)}" value="${logFilter}" oninput="setLogFilter(this.value)"/>
    </div></div>
    ${filtered.length === 0
      ? `<div class="empty"><div style="margin-bottom:12px;color:var(--text3);display:flex;justify-content:center">${icon("history", 36)}</div>${t("history_empty")}</div>`
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
  const prioColor = { haute: "var(--status-red)", moyenne: "var(--status-yellow)", basse: "var(--status-green)" };
  const pendingTasks = tasks.filter(tk => tk.status !== "Complété").length;
  return `<div class="page">
    <div class="toolbar">
      <div><h2 style="font-size:18px">${t("tasks_title")}</h2>
      <p style="font-size:13px;color:var(--text3);margin-top:2px">${t("tasks_pending", { n: pendingTasks })}</p></div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openTaskModal()">${icon("plus", 16)} ${t("task_add")}</button>` : ""}
    </div>
    <div class="task-cols">
    ${TASK_COLS.map(col => {
      const items = tasks.filter(tk => tk.status === col);
      const colIcon = col === "À faire" ? "clipboard" : col === "En cours" ? "refresh" : "check-circle";
      return `<div class="task-col">
        <div class="col-title icon-inline">${icon(colIcon, 14)} ${tTaskStatus(col)}
          <span style="background:var(--surface3);border-radius:10px;padding:1px 7px;font-size:11px;margin-left:6px">${items.length}</span>
        </div>
        ${items.map(tk => `<div class="task-card" onclick="${isAdmin ? `openTaskModal('${tk.id}')` : `cycleTaskStatus('${tk.id}','${tk.status}')`}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;display:flex;align-items:center">
                <span class="task-prio" style="background:${prioColor[tk.priority] || "var(--text3)"}"></span>${tk.title || ""}
              </div>
              ${tk.description ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${tk.description}</div>` : ""}
              <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
                ${tk.assignedTo ? `<span class="icon-inline" style="font-size:11px;color:var(--text3)">${icon("user", 11)} ${tk.assignedTo}</span>` : ""}
                ${tk.dueDate ? `<span class="icon-inline" style="font-size:11px;color:var(--text3)">${icon("calendar", 11)} ${tk.dueDate}</span>` : ""}
              </div>
            </div>
            ${isAdmin ? `<div class="menu-wrap" onclick="event.stopPropagation()">
              <button class="dots-btn" onclick="toggleDrop('tk${tk.id}')" aria-label="${t(`actions`)}">${icon("more-vertical", 16)}</button>
              <div class="dropdown" id="drop-tk${tk.id}">
                <button onclick="openTaskModal('${tk.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
                <button onclick="duplicateItem('tasks','${tk.id}','title');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
                <div class="sep"></div>
                <button style="color:var(--status-red)" onclick="askDelete('tasks','${tk.id}','${esc(tk.title || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
              </div></div>` : ""}
          </div>
        </div>`).join("")}
        ${isAdmin ? `<button onclick="openTaskModal(null,'${col}')" style="width:100%;border:1px dashed var(--border);background:none;color:var(--text3);border-radius:8px;padding:8px;cursor:pointer;font-size:13px;margin-top:4px;display:inline-flex;align-items:center;justify-content:center;gap:6px">${icon("plus", 14)} ${t("add")}</button>` : ""}
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
  const tk = id ? tasks.find(x => x.id === id) : null;
  const empNames = employees.map(e => e.name || "").filter(Boolean);
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${tk ? t("task_modal_edit") : t("task_modal_add")}</h3><button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button></div>
    <label>${t("task_field_title")}<input id="t-title" value="${esc(tk?.title || "")}"/></label>
    <label>${t("task_field_desc")}<textarea id="t-desc" style="height:80px">${tk?.description || ""}</textarea></label>
    <div class="form-row">
      <label>${t("task_field_status")}<select id="t-status">${TASK_COLS.map(c => `<option value="${c}" ${(tk?.status || defaultCol || "À faire") === c ? "selected" : ""}>${tTaskStatus(c)}</option>`).join("")}</select></label>
      <label>${t("task_field_priority")}<select id="t-prio">
        <option value="basse" ${tk?.priority === "basse" ? "selected" : ""}>${t("task_prio_low")}</option>
        <option value="moyenne" ${(tk?.priority || "moyenne") === "moyenne" ? "selected" : ""}>${t("task_prio_med")}</option>
        <option value="haute" ${tk?.priority === "haute" ? "selected" : ""}>${t("task_prio_high")}</option>
      </select></label>
    </div>
    <div class="form-row">
      <label>${t("task_field_assign")}<select id="t-assign">
        <option value="">${t("task_no_assignee")}</option>
        ${empNames.map(n => `<option value="${n}" ${tk?.assignedTo === n ? "selected" : ""}>${n}</option>`).join("")}
      </select></label>
      <label>${t("task_field_due")}<input id="t-due" type="date" value="${tk?.dueDate || ""}"/></label>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveTask('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveTask(id) {
  const title = document.getElementById("t-title").value.trim();
  if (!title) return toast(t("task_enter_title"), "error");
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

// ── Page Inventaire ───────────────────────────────────
function renderInventaire() {
  const activeProducts = products.filter(p => !p.archived);
  const archivedProducts = products.filter(p => p.archived);
  const lowCount = activeProducts.filter(p => ["red", "yellow"].includes(getStatus(p))).length;
  const isMobile = window.innerWidth <= 640;
  const allSec = getAllSections();
  const displayProducts = showArchived ? archivedProducts : activeProducts;
  const filtered = displayProducts.filter(p =>
    (activeSection === "Toutes" || p.section === activeSection) &&
    (searchQuery === "" || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);
  const visibleSecs = (!isMobile || sectionsExpanded) ? allSec : allSec.slice(0, 4);
  const hasMore = isMobile && allSec.length > 4;

  let h = `<div class="page">`;
  if (isAdmin && archivedProducts.length > 0) {
    h += `<div class="archived-banner"><span>📦 ${archivedProducts.length} produit${archivedProducts.length > 1 ? "s" : ""} archivé${archivedProducts.length > 1 ? "s" : ""}</span>
      <button onclick="toggleShowArchived()" style="border:1px solid #eab308;background:none;color:#854d0e;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;font-weight:600">
        ${showArchived ? "Voir actifs" : "Voir archivés"}
      </button></div>`;
  }
  
  if (!showArchived) {
    h += `<div class="section-tabs ${sectionsExpanded ? "expanded" : ""}">`;
    visibleSecs.forEach(s => {
      const cnt = s === "Toutes" ? lowCount : activeProducts.filter(p => p.section === s && ["red", "yellow"].includes(getStatus(p))).length;
      h += `<button class="sec-btn ${s === activeSection ? "active" : ""}" onclick="setSection('${s}')">${s}${cnt > 0 ? `<span class="badge-count">${cnt}</span>` : ""}</button>`;
    });
    if (hasMore) h += `<button class="sec-toggle" onclick="toggleSections()">${sectionsExpanded ? "▲" : "▼"}</button>`;
    if (isAdmin) h += `<button class="sec-btn" onclick="openCategoryModal()" style="border-style:dashed;color:var(--text3)">⚙️</button>`;
    h += `</div>`;
  }
  h += `<div class="toolbar">
    <div class="search-box"><span style="color:var(--text3)">🔍</span><input type="text" placeholder="Rechercher..." value="${searchQuery}" oninput="setSearch(this.value)"/></div>
    ${isAdmin && !showArchived ? `<button class="btn btn-primary" onclick="openProductModal()">+ Produit</button>` : ""}
  </div>`;

  if (!filtered.length) {
    h += `<div class="empty"><div style="font-size:36px;margin-bottom:8px">${searchQuery ? "🔍" : "📭"}</div>${searchQuery ? "Aucun résultat" : showArchived ? "Aucun produit archivé" : "Aucun produit dans cette section."}</div>`;
  } else if (isMobile) {
    filtered.forEach(p => { h += buildInvCard(p, true, false); });
  } else {
    h += `<div class="table-wrap overflow"><table><thead><tr>
      ${isAdmin ? `<th style="width:30px"></th>` : ""}
      <th>Produit</th><th>Stock actuel</th><th>Mettre à jour</th><th>Minimum</th><th>Fournisseur</th><th>Statut</th><th>À commander</th>
      ${isAdmin ? `<th></th>` : ""}
    </tr></thead><tbody id="product-tbody">`;
    filtered.forEach(p => {
      const st = getStatus(p), stock = getCurrentStock(p);
      const sup = suppliers.find(s => s.id === p.supplierId);
      const borderColor = st === "red" ? "#ef4444" : st === "yellow" ? "#eab308" : "#22c55e";
      const nameColor = st === "red" ? "#991b1b" : st === "yellow" ? "#854d0e" : darkMode ? "#f1f5f9" : "#1e293b";
      h += `<tr data-id="${p.id}" style="border-left:3px solid ${borderColor}" ${isAdmin && !showArchived ? `draggable="true" ondragstart="dragStart(event,'${p.id}')" ondragover="dragOver(event,'${p.id}')" ondrop="dropOn(event,'${p.id}')" ondragleave="dragLeave(event)" ondragend="dragEnd(event)"` : ""}>
        ${isAdmin ? `<td style="padding:0 4px">${!showArchived ? `<span class="drag-handle">⠿</span>` : ""}</td>` : ""}
        <td><strong style="color:${nameColor}">${p.name}</strong>
          ${activeSection === "Toutes" ? `<div style="font-size:11px;color:var(--text3)">${p.section}</div>` : ""}
          ${p.note ? `<div style="font-size:11px;color:var(--text3);font-style:italic;margin-top:2px">📝 ${p.note}</div>` : ""}
        </td>
        <td><span style="font-weight:700;color:${borderColor}">${stock}</span></td>
        <td>${!showArchived ? `<input class="stock-input" type="number" placeholder="Qté restante" id="si_${p.id}" style="width:100px" onkeydown="if(event.key==='Enter')commitStock('${p.id}','si_${p.id}')" onblur="commitStock('${p.id}','si_${p.id}')"/>` : "—"}</td>
        <td style="text-align:center">${p.minimum || 0}</td>
        <td style="font-size:13px;color:var(--text2)">${sup ? sup.name : "—"}</td>
        <td><span class="badge-pill ${st}">${statusLabel(st)}</span></td>
        <td style="font-weight:600;color:var(--accent)">${orderLabel(p)}${p.orderUnit === "boîte" ? `<div style="font-size:11px;color:var(--text3)">${(p.orderQty || 0) * (p.unitsPerBox || 1)} unités</div>` : ""}</td>
        ${isAdmin ? `<td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('${p.id}')">⋯</button><div class="dropdown" id="drop-${p.id}">
          <button onclick="openProductModal('${p.id}');closeAllDrops()">✏️ Modifier</button>
          <button onclick="openNoteModal('${p.id}');closeAllDrops()">📝 Note</button>
          <button onclick="openMoveModal('${p.id}');closeAllDrops()">📁 Changer catégorie</button>
          <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${p.archived ? "📤 Restaurer" : "📦 Archiver"}</button>
          <div class="sep"></div>
          <button style="color:#ef4444" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">🗑️ Supprimer</button>
        </div></div></td>` : ""}
      </tr>`;
    });
    h += `</tbody></table></div>`;
  }
  return h + `</div>`;
}

function buildInvCard(p, showInput, showOrderBtn) {
  const st = getStatus(p), stock = getCurrentStock(p);
  const borderColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : "#27ae60";
  const nameColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : darkMode ? "#e8e8f4" : "#1a1a2e";
  const sup = p.supplierId ? suppliers.find(s => s.id === p.supplierId) : null;
  const stockColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : "#27ae60";
  const oq = p.orderQty || 0, upb = p.unitsPerBox || 1;
  const oLabel = p.orderUnit === "boîte" ? `${oq} boîte${oq > 1 ? "s" : ""}` : `${oq} unité${oq > 1 ? "s" : ""}`;
  const units = oq * (p.orderUnit === "boîte" ? upb : 1);
  const inputId = `si_m${p.id}`;
  return `<div class="inv-card" style="border:1px solid ${borderColor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:${p.note ? 4 : 12}px">
      <div style="flex:1">
        <div style="font-weight:700;font-size:15px;color:${nameColor}">${p.name}</div>
        ${showOrderBtn && sup ? `<div style="font-size:12px;color:var(--text2);margin-top:2px">🏪 ${sup.name}${sup.contact ? ` · ${sup.contact}` : ""}</div>` : ""}
        ${activeSection === "Toutes" && !showOrderBtn ? `<div style="font-size:11px;color:var(--text3)">${p.section}</div>` : ""}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
        <span class="badge-pill ${st}">${statusLabel(st)}</span>
        ${isAdmin && showInput ? `<div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('m${p.id}')">⋯</button><div class="dropdown" id="drop-m${p.id}">
          <button onclick="openProductModal('${p.id}');closeAllDrops()">✏️ Modifier</button>
          <button onclick="openNoteModal('${p.id}');closeAllDrops()">📝 Note</button>
          <button onclick="openMoveModal('${p.id}');closeAllDrops()">📁 Changer catégorie</button>
          <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${p.archived ? "📤 Restaurer" : "📦 Archiver"}</button>
          <div class="sep"></div>
          <button style="color:#ef4444" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">🗑️ Supprimer</button>
        </div></div>` : ""}
      </div>
    </div>
    ${p.note ? `<div class="note-badge" style="margin-bottom:10px">📝 ${p.note}</div>` : ""}
    <div class="inv-card-body">
      <div class="inv-card-block">
        <div class="inv-card-label">Stock actuel</div>
        <div class="inv-card-value" style="color:${stockColor}">${stock}</div>
        <div class="inv-card-sub">Min : ${p.minimum || 0} · Cmd : ${oLabel}</div>
      </div>
      ${showInput ? `<div class="inv-card-block" style="display:flex;flex-direction:column">
        <div class="inv-card-label">Mettre à jour</div>
        <input class="stock-input" type="number" placeholder="Qté restante" id="${inputId}" onkeydown="if(event.key==='Enter')commitStock('${p.id}','${inputId}')" onblur="commitStock('${p.id}','${inputId}')" style="width:100%;height:38px;font-size:15px;margin-top:6px"/>
      </div>` : ""}
      ${showOrderBtn ? `<div class="inv-card-block">
        <div class="inv-card-label">À commander</div>
        <div style="font-weight:700;font-size:15px;color:var(--accent);margin-top:4px">${oLabel}</div>
        ${p.orderUnit === "boîte" ? `<div style="font-size:11px;color:var(--text3)">${units} unités</div>` : ""}
      </div>` : ""}
    </div>
    function renderInventaire() {
  const activeProducts = products.filter(p => !p.archived);
  const archivedProducts = products.filter(p => p.archived);
  const lowCount = activeProducts.filter(p => ["red", "yellow"].includes(getStatus(p))).length;
  const isMobile = window.innerWidth <= 640;
  const allSec = getAllSections();
  const displayProducts = showArchived ? archivedProducts : activeProducts;
  const filtered = displayProducts.filter(p =>
    (activeSection === "Toutes" || p.section === activeSection) &&
    (searchQuery === "" || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);
  const visibleSecs = (!isMobile || sectionsExpanded) ? allSec : allSec.slice(0, 4);
  const hasMore = isMobile && allSec.length > 4;

  let h = `<div class="page">`;

  if (!isMobile) {
    const okCount = activeProducts.filter(p => getStatus(p) === "green").length;
    const redCount = activeProducts.filter(p => getStatus(p) === "red").length;
    h += `<div style="display:flex;gap:10px;margin-bottom:18px">
      <div style="flex:1;background:var(--surface);border:0.5px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:22px;font-weight:700;color:var(--accent)">${activeProducts.length}</div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Produits</div>
      </div>
      <div style="flex:1;background:#fff5f5;border:0.5px solid #ffd0d0;border-radius:10px;padding:14px 16px">
        <div style="font-size:22px;font-weight:700;color:#c0392b">${redCount}</div>
        <div style="font-size:10px;color:#c0392b;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">À commander</div>
      </div>
      <div style="flex:1;background:#f0faf4;border:0.5px solid #c8ecd4;border-radius:10px;padding:14px 16px">
        <div style="font-size:22px;font-weight:700;color:#27ae60">${okCount}</div>
        <div style="font-size:10px;color:#27ae60;opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">En stock</div>
      </div>
    </div>`;
  }

  if (isAdmin && archivedProducts.length > 0) {
    h += `<div class="archived-banner"><span>📦 ${archivedProducts.length} produit${archivedProducts.length > 1 ? "s" : ""} archivé${archivedProducts.length > 1 ? "s" : ""}</span>
      <button onclick="toggleShowArchived()" style="border:1px solid #eab308;background:none;color:#854d0e;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;font-weight:600">
        ${showArchived ? "Voir actifs" : "Voir archivés"}
      </button></div>`;
  }
  if (!showArchived) {
    h += `<div class="section-tabs ${sectionsExpanded ? "expanded" : ""}">`;
    visibleSecs.forEach(s => {
      const cnt = s === "Toutes" ? lowCount : activeProducts.filter(p => p.section === s && ["red", "yellow"].includes(getStatus(p))).length;
      h += `<button class="sec-btn ${s === activeSection ? "active" : ""}" onclick="setSection('${s}')">${s}${cnt > 0 ? `<span class="badge-count">${cnt}</span>` : ""}</button>`;
    });
    if (hasMore) h += `<button class="sec-toggle" onclick="toggleSections()">${sectionsExpanded ? "▲" : "▼"}</button>`;
    if (isAdmin) h += `<button class="sec-btn" onclick="openCategoryModal()" style="border-style:dashed;color:var(--text3)">⚙️</button>`;
    h += `</div>`;
  }
  h += `<div class="toolbar">
    <div class="search-box"><span style="color:var(--text3)">🔍</span><input type="text" placeholder="Rechercher..." value="${searchQuery}" oninput="setSearch(this.value)"/></div>
    ${isAdmin && !showArchived ? `<button class="btn btn-primary" onclick="openProductModal()">+ Produit</button>` : ""}
  </div>`;

  if (!filtered.length) {
    h += `<div class="empty"><div style="font-size:36px;margin-bottom:8px">${searchQuery ? "🔍" : "📭"}</div>${searchQuery ? "Aucun résultat" : showArchived ? "Aucun produit archivé" : "Aucun produit dans cette section."}</div>`;
  } else if (isMobile) {
    filtered.forEach(p => { h += buildInvCard(p, true, false); });
  } else {
    h += `<div class="table-wrap overflow"><table><thead><tr>
      ${isAdmin ? `<th style="width:30px"></th>` : ""}
      <th>Produit</th><th>Stock actuel</th><th>Mettre à jour</th><th>Minimum</th><th>Fournisseur</th><th>Statut</th><th>À commander</th>
      ${isAdmin ? `<th></th>` : ""}
    </tr></thead><tbody id="product-tbody">`;
    filtered.forEach(p => {
      const st = getStatus(p), stock = getCurrentStock(p);
      const sup = suppliers.find(s => s.id === p.supplierId);
      const borderColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : "#27ae60";
      const nameColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : darkMode ? "#e8e8f4" : "#1a1a2e";
      h += `<tr data-id="${p.id}" style="border-left:3px solid ${borderColor}" ${isAdmin && !showArchived ? `draggable="true" ondragstart="dragStart(event,'${p.id}')" ondragover="dragOver(event,'${p.id}')" ondrop="dropOn(event,'${p.id}')" ondragleave="dragLeave(event)" ondragend="dragEnd(event)"` : ""}>
        ${isAdmin ? `<td style="padding:0 4px">${!showArchived ? `<span class="drag-handle">⠿</span>` : ""}</td>` : ""}
        <td><strong style="color:${nameColor}">${p.name}</strong>
          ${activeSection === "Toutes" ? `<div style="font-size:11px;color:var(--text3)">${p.section}</div>` : ""}
          ${p.note ? `<div style="font-size:11px;color:var(--text3);font-style:italic;margin-top:2px">📝 ${p.note}</div>` : ""}
        </td>
        <td><span style="font-weight:700;color:${borderColor}">${stock}</span></td>
        <td>${!showArchived ? `<input class="stock-input" type="number" placeholder="Qté restante" id="si_${p.id}" style="width:100px" onkeydown="if(event.key==='Enter')commitStock('${p.id}','si_${p.id}')" onblur="commitStock('${p.id}','si_${p.id}')"/>` : "—"}</td>
        <td style="text-align:center">${p.minimum || 0}</td>
        <td style="font-size:13px;color:var(--text2)">${sup ? sup.name : "—"}</td>
        <td><span class="badge-pill ${st}">${statusLabel(st)}</span></td>
        <td style="font-weight:600;color:var(--accent)">${orderLabel(p)}${p.orderUnit === "boîte" ? `<div style="font-size:11px;color:var(--text3)">${(p.orderQty || 0) * (p.unitsPerBox || 1)} unités</div>` : ""}</td>
        ${isAdmin ? `<td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('${p.id}')">⋯</button><div class="dropdown" id="drop-${p.id}">
          <button onclick="openProductModal('${p.id}');closeAllDrops()">✏️ Modifier</button>
          <button onclick="openNoteModal('${p.id}');closeAllDrops()">📝 Note</button>
          <button onclick="openMoveModal('${p.id}');closeAllDrops()">📁 Changer catégorie</button>
          <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${p.archived ? "📤 Restaurer" : "📦 Archiver"}</button>
          <div class="sep"></div>
          <button style="color:#ef4444" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">🗑️ Supprimer</button>
        </div></div></td>` : ""}
      </tr>`;
    });
    h += `</tbody></table></div>`;
  }
  return h + `</div>`;
}

function buildInvCard(p, showInput, showOrderBtn) {
  const st = getStatus(p), stock = getCurrentStock(p);
  const borderColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : "#27ae60";
  const nameColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : darkMode ? "#e8e8f4" : "#1a1a2e";
  const stockColor = st === "red" ? "#c0392b" : st === "yellow" ? "#b8860b" : "#27ae60";
  const sup = p.supplierId ? suppliers.find(s => s.id === p.supplierId) : null;
  const oq = p.orderQty || 0, upb = p.unitsPerBox || 1;
  const oLabel = p.orderUnit === "boîte" ? `${oq} boîte${oq > 1 ? "s" : ""}` : `${oq} unité${oq > 1 ? "s" : ""}`;
  const units = oq * (p.orderUnit === "boîte" ? upb : 1);
  const inputId = `si_m${p.id}`;
  return `<div class="inv-card" style="border:0.5px solid ${borderColor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:${p.note ? 4 : 12}px">
      <div style="flex:1">
        <div style="font-weight:700;font-size:15px;color:${nameColor}">${p.name}</div>
        ${showOrderBtn && sup ? `<div style="font-size:12px;color:var(--text2);margin-top:2px">🏪 ${sup.name}${sup.contact ? ` · ${sup.contact}` : ""}</div>` : ""}
        ${activeSection === "Toutes" && !showOrderBtn ? `<div style="font-size:11px;color:var(--text3)">${p.section}</div>` : ""}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
        <span class="badge-pill ${st}">${statusLabel(st)}</span>
        ${isAdmin && showInput ? `<div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('m${p.id}')">⋯</button><div class="dropdown" id="drop-m${p.id}">
          <button onclick="openProductModal('${p.id}');closeAllDrops()">✏️ Modifier</button>
          <button onclick="openNoteModal('${p.id}');closeAllDrops()">📝 Note</button>
          <button onclick="openMoveModal('${p.id}');closeAllDrops()">📁 Changer catégorie</button>
          <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${p.archived ? "📤 Restaurer" : "📦 Archiver"}</button>
          <div class="sep"></div>
          <button style="color:#ef4444" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">🗑️ Supprimer</button>
        </div></div>` : ""}
      </div>
    </div>
    ${p.note ? `<div class="note-badge" style="margin-bottom:10px">📝 ${p.note}</div>` : ""}
    <div class="inv-card-body">
      <div class="inv-card-block">
        <div class="inv-card-label">Stock actuel</div>
        <div class="inv-card-value" style="color:${stockColor}">${stock}</div>
        <div class="inv-card-sub">Min : ${p.minimum || 0} · Cmd : ${oLabel}</div>
      </div>
      ${showInput ? `<div class="inv-card-block" style="display:flex;flex-direction:column">
        <div class="inv-card-label">Mettre à jour</div>
        <input class="stock-input" type="number" placeholder="Qté restante" id="${inputId}" onkeydown="if(event.key==='Enter')commitStock('${p.id}','${inputId}')" onblur="commitStock('${p.id}','${inputId}')" style="width:100%;height:38px;font-size:15px;margin-top:6px"/>
      </div>` : ""}
      ${showOrderBtn ? `<div class="inv-card-block">
        <div class="inv-card-label">À commander</div>
        <div style="font-weight:700;font-size:15px;color:var(--accent);margin-top:4px">${oLabel}</div>
        ${p.orderUnit === "boîte" ? `<div style="font-size:11px;color:var(--text3)">${units} unités</div>` : ""}
      </div>` : ""}
    </div>
    ${showOrderBtn ? `<button onclick="openReceiveModal('${p.id}')" style="width:100%;margin-top:12px;background:#27ae60;color:#fff;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">📦 Réceptionner la commande</button>` : ""}
  </div>`;
}

async function commitStock(id, inputId) {
  const input = document.getElementById(inputId); if (!input || input.value === "") return;
  const newStock = Number(input.value); const p = products.find(x => x.id === id); if (!p) return;
  const old = getCurrentStock(p);
  await db.collection("products").doc(id).update({ currentStock: newStock });
  await addLog(p.name, "Mise à jour stock", `${old} → ${newStock} unités`);
  input.value = "";
}

function dragStart(e, id) { dragSrcId = id; setTimeout(() => { const tr = document.querySelector(`tr[data-id="${id}"]`); if (tr) tr.classList.add("dragging"); }, 0); }
function dragOver(e, id) { e.preventDefault(); const tr = document.querySelector(`tr[data-id="${id}"]`); if (tr && id !== dragSrcId) tr.classList.add("drag-over"); }
function dragLeave() { document.querySelectorAll("tr.drag-over").forEach(r => r.classList.remove("drag-over")); }
function dragEnd() { document.querySelectorAll("tr.dragging,tr.drag-over").forEach(r => r.classList.remove("dragging", "drag-over")); }
async function dropOn(e, targetId) {
  e.preventDefault(); dragEnd();
  if (!dragSrcId || dragSrcId === targetId) return;
  const tbody = document.getElementById("product-tbody"); if (!tbody) return;
  const ids = [...tbody.querySelectorAll("tr[data-id]")].map(r => r.dataset.id);
  const si = ids.indexOf(dragSrcId), ti = ids.indexOf(targetId);
  if (si < 0 || ti < 0) return;
  ids.splice(si, 1); ids.splice(ti, 0, dragSrcId);
  const batch = db.batch();
  ids.forEach((id, i) => batch.update(db.collection("products").doc(id), { sortOrder: i }));
  await batch.commit();
  dragSrcId = null;
}
  </div>`;
}

// ── Stock ─────────────────────────────────────────────
async function commitStock(id, inputId) {
  const input = document.getElementById(inputId); if (!input || input.value === "") return;
  const newStock = Number(input.value); const p = products.find(x => x.id === id); if (!p) return;
  const old = getCurrentStock(p);
  await db.collection("products").doc(id).update({ currentStock: newStock });
  await addLog(p.name, "Mise à jour stock", `${old} → ${newStock} unités`);
  input.value = "";
}

// ── Drag & drop ───────────────────────────────────────
function dragStart(e, id) { dragSrcId = id; setTimeout(() => { const tr = document.querySelector(`tr[data-id="${id}"]`); if (tr) tr.classList.add("dragging"); }, 0); }
function dragOver(e, id) { e.preventDefault(); const tr = document.querySelector(`tr[data-id="${id}"]`); if (tr && id !== dragSrcId) tr.classList.add("drag-over"); }
function dragLeave() { document.querySelectorAll("tr.drag-over").forEach(r => r.classList.remove("drag-over")); }
function dragEnd() { document.querySelectorAll("tr.dragging,tr.drag-over").forEach(r => r.classList.remove("dragging", "drag-over")); }
async function dropOn(e, targetId) {
  e.preventDefault(); dragEnd();
  if (!dragSrcId || dragSrcId === targetId) return;
  const tbody = document.getElementById("product-tbody"); if (!tbody) return;
  const ids = [...tbody.querySelectorAll("tr[data-id]")].map(r => r.dataset.id);
  const si = ids.indexOf(dragSrcId), ti = ids.indexOf(targetId);
  if (si < 0 || ti < 0) return;
  ids.splice(si, 1); ids.splice(ti, 0, dragSrcId);
  const batch = db.batch();
  ids.forEach((id, i) => batch.update(db.collection("products").doc(id), { sortOrder: i }));
  await batch.commit();
  dragSrcId = null;
}

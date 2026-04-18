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
    const yellowCount = activeProducts.filter(p => getStatus(p) === "yellow").length;
    h += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
      <div style="background:var(--surface);border:0.5px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:22px;font-weight:700;color:var(--accent)">${activeProducts.length}</div>
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Produits</div>
      </div>
      <div style="background:var(--status-red-bg);border:0.5px solid var(--status-red-border);border-radius:10px;padding:14px 16px">
        <div style="font-size:22px;font-weight:700;color:var(--status-red)">${redCount}</div>
        <div style="font-size:10px;color:var(--status-red);opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">À commander</div>
      </div>
      <div style="background:var(--status-yellow-bg);border:0.5px solid var(--status-yellow-border);border-radius:10px;padding:14px 16px">
        <div style="font-size:22px;font-weight:700;color:var(--status-yellow)">${yellowCount}</div>
        <div style="font-size:10px;color:var(--status-yellow);opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Bientôt bas</div>
      </div>
      <div style="background:var(--status-green-bg);border:0.5px solid var(--status-green-border);border-radius:10px;padding:14px 16px">
        <div style="font-size:22px;font-weight:700;color:var(--status-green)">${okCount}</div>
        <div style="font-size:10px;color:var(--status-green);opacity:.7;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">En stock</div>
      </div>
    </div>`;
  }

  if (isAdmin && archivedProducts.length > 0) {
    h += `<div class="archived-banner"><span class="icon-inline">${icon("archive", 14)} ${archivedProducts.length} produit${archivedProducts.length > 1 ? "s" : ""} archivé${archivedProducts.length > 1 ? "s" : ""}</span>
      <button onclick="toggleShowArchived()" style="border:1px solid var(--status-yellow);background:none;color:var(--yellow-text);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;font-weight:600">
        ${showArchived ? "Voir actifs" : "Voir archivés"}
      </button></div>`;
  }

  if (!showArchived) {
    h += `<div class="section-tabs ${sectionsExpanded ? "expanded" : ""}">`;
    visibleSecs.forEach(s => {
      const cnt = s === "Toutes" ? lowCount : activeProducts.filter(p => p.section === s && ["red", "yellow"].includes(getStatus(p))).length;
      h += `<button class="sec-btn ${s === activeSection ? "active" : ""}" onclick="setSection('${s}')">${s}${cnt > 0 ? `<span class="badge-count">${cnt}</span>` : ""}</button>`;
    });
    if (hasMore) h += `<button class="sec-toggle" onclick="toggleSections()" aria-label="${sectionsExpanded ? "Réduire" : "Voir plus"}">${icon(sectionsExpanded ? "chevron-up" : "chevron-down", 14)}</button>`;
    if (isAdmin) h += `<button class="sec-btn" onclick="openCategoryModal()" aria-label="Gérer les catégories" style="border-style:dashed;color:var(--text3);display:inline-flex;align-items:center">${icon("settings", 14)}</button>`;
    h += `</div>`;
  }

  h += `<div class="toolbar">
    <div class="search-box"><span style="color:var(--text3);display:flex">${icon("search", 16)}</span><input type="text" placeholder="Rechercher..." value="${searchQuery}" oninput="setSearch(this.value)"/></div>
    ${isAdmin && !showArchived ? `<button class="btn btn-primary" onclick="openProductModal()">${icon("plus", 16)} Produit</button>` : ""}
  </div>`;

  if (!filtered.length) {
    h += `<div class="empty"><div style="margin-bottom:12px;color:var(--text3);display:flex;justify-content:center">${icon(searchQuery ? "search" : "package", 36)}</div>${searchQuery ? "Aucun résultat" : showArchived ? "Aucun produit archivé" : "Aucun produit dans cette section."}</div>`;
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
      const borderColor = st === "red" ? "var(--status-red)" : st === "yellow" ? "var(--status-yellow)" : "var(--status-green)";
      const nameColor = st === "red" ? "var(--status-red)" : st === "yellow" ? "var(--status-yellow)" : darkMode ? "var(--text)" : "var(--text)";
      h += `<tr data-id="${p.id}" style="border-left:3px solid ${borderColor}" ${isAdmin && !showArchived ? `draggable="true" ondragstart="dragStart(event,'${p.id}')" ondragover="dragOver(event,'${p.id}')" ondrop="dropOn(event,'${p.id}')" ondragleave="dragLeave(event)" ondragend="dragEnd(event)"` : ""}>
        ${isAdmin ? `<td style="padding:0 4px">${!showArchived ? `<span class="drag-handle" style="display:inline-flex;align-items:center">${icon("grip-vertical", 16)}</span>` : ""}</td>` : ""}
        <td><strong style="color:${nameColor}">${p.name}</strong>
          ${activeSection === "Toutes" ? `<div style="font-size:11px;color:var(--text3)">${p.section}</div>` : ""}
          ${p.note ? `<div class="icon-inline" style="font-size:11px;color:var(--text3);font-style:italic;margin-top:2px">${icon("file-text", 11)} ${p.note}</div>` : ""}
        </td>
        <td><span style="font-weight:700;color:${borderColor}">${stock}</span></td>
        <td>${!showArchived ? `<input class="stock-input" type="number" placeholder="Qté restante" id="si_${p.id}" style="width:100px" onkeydown="if(event.key==='Enter')commitStock('${p.id}','si_${p.id}')" onblur="commitStock('${p.id}','si_${p.id}')"/>` : "—"}</td>
        <td style="text-align:center">${p.minimum || 0}</td>
        <td style="font-size:13px;color:var(--text2)">${sup ? sup.name : "—"}</td>
        <td><span class="badge-pill ${st}">${statusLabel(st)}</span></td>
        <td style="font-weight:600;color:var(--accent)">${orderLabel(p)}${p.orderUnit === "boîte" ? `<div style="font-size:11px;color:var(--text3)">${(p.orderQty || 0) * (p.unitsPerBox || 1)} unités</div>` : ""}</td>
        ${isAdmin ? `<td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('${p.id}')" aria-label="Actions">${icon("more-vertical", 16)}</button><div class="dropdown" id="drop-${p.id}">
          <button onclick="openProductModal('${p.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
          <button onclick="openNoteModal('${p.id}');closeAllDrops()">${icon("file-text", 14)} Note</button>
          <button onclick="openMoveModal('${p.id}');closeAllDrops()">${icon("folder", 14)} Changer catégorie</button>
          <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${icon(p.archived ? "upload" : "archive", 14)} ${p.archived ? "Restaurer" : "Archiver"}</button>
          <div class="sep"></div>
          <button style="color:var(--status-red)" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
        </div></div></td>` : ""}
      </tr>`;
    });
    h += `</tbody></table></div>`;
  }
  return h + `</div>`;
}

function buildInvCard(p, showInput, showOrderBtn) {
  const st = getStatus(p), stock = getCurrentStock(p);
  const sup = p.supplierId ? suppliers.find(s => s.id === p.supplierId) : null;
  const oq = p.orderQty || 0, upb = p.unitsPerBox || 1;
  const oLabel = p.orderUnit === "boîte" ? `${oq} boîte${oq > 1 ? "s" : ""}` : `${oq} unité${oq > 1 ? "s" : ""}`;
  const units = oq * (p.orderUnit === "boîte" ? upb : 1);
  const inputId = `si_m${p.id}`;
  // Classes status pour border-left coloré + pastille
  const statusClass = `inv-card--${st}`; // inv-card--red / yellow / green

  return `<article class="inv-card-mobile ${statusClass}" data-id="${p.id}">
    <!-- ── EN-TÊTE : nom + statut + menu ── -->
    <header class="inv-card-mobile__head">
      <div class="inv-card-mobile__title">
        <h3 class="inv-card-mobile__name">${p.name}</h3>
        <div class="inv-card-mobile__meta">
          ${activeSection === "Toutes" && !showOrderBtn ? `<span>${p.section}</span>` : ""}
          ${activeSection === "Toutes" && !showOrderBtn ? `<span class="inv-card-mobile__sep">·</span>` : ""}
          <span>Min : <strong>${p.minimum || 0}</strong></span>
          ${oq > 0 ? `<span class="inv-card-mobile__sep">·</span><span>Cmd : <strong>${oLabel}</strong></span>` : ""}
          ${showOrderBtn && sup ? `<span class="inv-card-mobile__sep">·</span><span class="icon-inline">${icon("store", 11)} ${sup.name}</span>` : ""}
        </div>
      </div>
      ${isAdmin && showInput ? `
        <div class="menu-wrap">
          <button class="dots-btn" onclick="toggleDrop('m${p.id}')" aria-label="Actions">${icon("more-vertical", 18)}</button>
          <div class="dropdown" id="drop-m${p.id}">
            <button onclick="openProductModal('${p.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
            <button onclick="openNoteModal('${p.id}');closeAllDrops()">${icon("file-text", 14)} Note</button>
            <button onclick="openMoveModal('${p.id}');closeAllDrops()">${icon("folder", 14)} Changer catégorie</button>
            <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${icon(p.archived ? "upload" : "archive", 14)} ${p.archived ? "Restaurer" : "Archiver"}</button>
            <div class="sep"></div>
            <button style="color:var(--status-red)" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
          </div>
        </div>
      ` : ""}
    </header>

    ${p.note ? `<div class="inv-card-mobile__note icon-inline">${icon("file-text", 12)} ${p.note}</div>` : ""}

    <!-- ── STOCK GÉANT (très lisible) ── -->
    <div class="inv-card-mobile__stock">
      <div class="inv-card-mobile__stock-label">Stock actuel</div>
      <div class="inv-card-mobile__stock-value">${stock}</div>
      <span class="badge-pill ${st} inv-card-mobile__badge">${statusLabel(st)}</span>
    </div>

    ${showOrderBtn ? `
      <!-- ── À COMMANDER ── -->
      <div class="inv-card-mobile__order">
        <div class="inv-card-mobile__order-label">À commander</div>
        <div class="inv-card-mobile__order-value">${oLabel}</div>
        ${p.orderUnit === "boîte" ? `<div class="inv-card-mobile__order-sub">= ${units} unités</div>` : ""}
      </div>
      <button class="inv-card-mobile__cta inv-card-mobile__cta--success" onclick="openReceiveModal('${p.id}')">
        ${icon("package", 16)} Réceptionner la commande
      </button>
    ` : ""}

    ${showInput ? `
      <!-- ── MISE À JOUR DU STOCK (touch-friendly) ── -->
      <div class="inv-card-mobile__update">
        <label class="inv-card-mobile__update-label" for="${inputId}">Nouvelle quantité</label>
        <div class="inv-card-mobile__update-row">
          <input class="inv-card-mobile__input" type="number" inputmode="numeric" placeholder="Qté restante" id="${inputId}" onkeydown="if(event.key==='Enter')commitStock('${p.id}','${inputId}')" />
          <button class="inv-card-mobile__cta inv-card-mobile__cta--primary" onclick="commitStock('${p.id}','${inputId}')" aria-label="Sauvegarder le stock">
            ${icon("check", 18)}
          </button>
        </div>
      </div>
    ` : ""}
  </article>`;
}

async function commitStock(id, inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.value === "") return;
  const newStock = Number(input.value);
  const p = products.find(x => x.id === id);
  if (!p) return;
  const old = getCurrentStock(p);
  await db.collection("products").doc(id).update({ currentStock: newStock });
  await addLog(p.name, "Mise à jour stock", `${old} → ${newStock} unités`);
  input.value = "";
}

function dragStart(e, id) {
  dragSrcId = id;
  setTimeout(() => {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) tr.classList.add("dragging");
  }, 0);
}
function dragOver(e, id) {
  e.preventDefault();
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (tr && id !== dragSrcId) tr.classList.add("drag-over");
}
function dragLeave() {
  document.querySelectorAll("tr.drag-over").forEach(r => r.classList.remove("drag-over"));
}
function dragEnd() {
  document.querySelectorAll("tr.dragging,tr.drag-over").forEach(r => r.classList.remove("dragging", "drag-over"));
}
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

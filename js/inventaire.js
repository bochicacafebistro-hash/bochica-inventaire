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
  // Toujours afficher toutes les sections (scroll horizontal sur mobile)
  const visibleSecs = allSec;

  let h = `<div class="page">`;

  if (!isMobile) {
    const okCount = activeProducts.filter(p => getStatus(p) === "green").length;
    const redCount = activeProducts.filter(p => getStatus(p) === "red").length;
    const yellowCount = activeProducts.filter(p => getStatus(p) === "yellow").length;
    h += `<div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__value">${activeProducts.length}</div>
        <div class="stat-card__label">${t("stock_products")}</div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-card__value">${redCount}</div>
        <div class="stat-card__label">${t("stock_to_order")}</div>
      </div>
      <div class="stat-card stat-card--yellow">
        <div class="stat-card__value">${yellowCount}</div>
        <div class="stat-card__label">${t("stock_low")}</div>
      </div>
      <div class="stat-card stat-card--green">
        <div class="stat-card__value">${okCount}</div>
        <div class="stat-card__label">${t("stock_in_stock")}</div>
      </div>
    </div>`;
  }

  if (isAdmin && archivedProducts.length > 0) {
    h += `<div class="archived-banner"><span class="icon-inline">${icon("archive", 14)} ${t("archived_count", { n: archivedProducts.length })}</span>
      <button onclick="toggleShowArchived()" style="border:1px solid var(--status-yellow);background:none;color:var(--yellow-text);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;font-weight:600">
        ${showArchived ? t("view_active") : t("view_archived")}
      </button></div>`;
  }

  if (!showArchived) {
    const tabsClass = sectionsExpanded ? "section-tabs section-tabs--wrap" : "section-tabs section-tabs--scroll";
    h += `<div class="section-tabs-wrap">`;
    h += `<div class="${tabsClass}" role="tablist" aria-label="${t("filter_by_category")}">`;
    visibleSecs.forEach(s => {
      const cnt = s === "Toutes" ? lowCount : activeProducts.filter(p => p.section === s && ["red", "yellow"].includes(getStatus(p))).length;
      h += `<button class="sec-btn ${s === activeSection ? "active" : ""}" role="tab" aria-selected="${s === activeSection}" onclick="setSection('${esc(s)}')">${tSection(s)}${cnt > 0 ? `<span class="badge-count">${cnt}</span>` : ""}</button>`;
    });
    h += `</div>`;
    // Actions à droite : voir toutes / gérer
    h += `<div class="section-tabs-actions">
      <button class="sec-toggle" onclick="toggleSections()" aria-pressed="${sectionsExpanded}" aria-label="${sectionsExpanded ? "Réduire les catégories" : "Voir toutes les catégories"}" title="${sectionsExpanded ? "Réduire" : "Voir toutes"}">
        ${icon(sectionsExpanded ? "chevron-up" : "chevron-down", 16)}
      </button>
      ${isAdmin ? `<button class="sec-btn sec-btn--manage" onclick="openCategoryModal()" aria-label="${t("manage_categories")}" title="Gérer les catégories">${icon("settings", 14)}</button>` : ""}
    </div>`;
    h += `</div>`;
  }

  h += `<div class="toolbar">
    <div class="search-box"><span style="color:var(--text3);display:flex">${icon("search", 16)}</span><input type="text" id="inv-search" placeholder="${t("search")}" value="${searchQuery}" oninput="setSearch(this.value)"/></div>
    ${isAdmin && !showArchived ? `<button class="btn btn-primary" onclick="openProductModal()">${icon("plus", 16)} ${t("add_product")}</button>` : ""}
  </div>`;

  if (!filtered.length) {
    const emptyMsg = searchQuery ? t("no_results") : showArchived ? t("no_archived") : t("no_products_section");
    h += `<div class="empty"><div class="empty-state-icon">${icon(searchQuery ? "search" : "package", 36)}</div>${emptyMsg}</div>`;
  } else if (isMobile) {
    filtered.forEach(p => { h += buildInvCard(p, true, false); });
  } else {
    h += `<div class="table-wrap overflow"><table><thead><tr>
      ${isAdmin ? `<th style="width:30px"></th>` : ""}
      <th>${t("tbl_product")}</th><th>${t("stock_actual_full")}</th><th>${t("stock_new_qty")}</th><th>${t("tbl_minimum")}</th><th>${t("exp_table_supplier")}</th><th>${t("tbl_status")}</th><th>${t("rapport_to_order_label")}</th>
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
        <td>${!showArchived ? `<input class="stock-input" type="number" placeholder="${t(`qty_remaining_ph`)}" id="si_${p.id}" style="width:100px" onkeydown="if(event.key==='Enter')commitStock('${p.id}','si_${p.id}')" onblur="commitStock('${p.id}','si_${p.id}')"/>` : "—"}</td>
        <td class="text-center">${p.minimum || 0}</td>
        <td style="font-size:13px;color:var(--text2)">${sup ? sup.name : "—"}</td>
        <td><span class="badge-pill ${st}">${statusLabel(st)}</span></td>
        <td style="font-weight:600;color:var(--accent)">${orderLabel(p)}${p.orderUnit === "boîte" ? `<div style="font-size:11px;color:var(--text3)">${(p.orderQty || 0) * (p.unitsPerBox || 1)} ${t("unit_units")}</div>` : ""}</td>
        ${isAdmin ? `<td><div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('${p.id}')" aria-label="${t(`actions`)}">${icon("more-vertical", 16)}</button><div class="dropdown" id="drop-${p.id}">
          <button onclick="openProductModal('${p.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
          <button onclick="duplicateItem('products','${p.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
          <button onclick="openNoteModal('${p.id}');closeAllDrops()">${icon("file-text", 14)} ${t("dropdown_note")}</button>
          <button onclick="openMoveModal('${p.id}');closeAllDrops()">${icon("folder", 14)} ${t("dropdown_change_cat")}</button>
          <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${icon(p.archived ? "upload" : "archive", 14)} ${p.archived ? t("dropdown_restore") : t("dropdown_archive")}</button>
          <div class="sep"></div>
          <button class="text-danger" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
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
  const statusClass = `inv-card-mobile--${st}`; // border-left rouge/jaune/vert

  return `<article class="inv-card-mobile ${statusClass}" data-id="${p.id}">
    <!-- ── EN-TÊTE : nom + menu actions ── -->
    <header class="inv-card-mobile__head">
      <div class="inv-card-mobile__title">
        <h3 class="inv-card-mobile__name">${p.name}</h3>
        <div class="inv-card-mobile__meta">
          ${activeSection === "Toutes" && !showOrderBtn ? `<span>${p.section}</span><span class="inv-card-mobile__sep">·</span>` : ""}
          <span>${t("stock_min")} : <strong>${p.minimum || 0}</strong></span>
          ${oq > 0 ? `<span class="inv-card-mobile__sep">·</span><span>${t("stock_cmd")} : <strong>${oLabel}</strong></span>` : ""}
          ${showOrderBtn && sup ? `<span class="inv-card-mobile__sep">·</span><span class="icon-inline">${icon("store", 11)} ${sup.name}</span>` : ""}
        </div>
      </div>
      ${isAdmin && showInput ? `
        <div class="menu-wrap">
          <button class="dots-btn" onclick="toggleDrop('m${p.id}')" aria-label="${t(`actions`)}">${icon("more-vertical", 18)}</button>
          <div class="dropdown" id="drop-m${p.id}">
            <button onclick="openProductModal('${p.id}');closeAllDrops()">${icon("pencil", 14)} ${t("dropdown_edit")}</button>
            <button onclick="duplicateItem('products','${p.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
            <button onclick="openNoteModal('${p.id}');closeAllDrops()">${icon("file-text", 14)} ${t("dropdown_note")}</button>
            <button onclick="openMoveModal('${p.id}');closeAllDrops()">${icon("folder", 14)} ${t("dropdown_change_cat")}</button>
            <button onclick="doToggleArchive('${p.id}','${esc(p.name)}',${!!p.archived});closeAllDrops()">${icon(p.archived ? "upload" : "archive", 14)} ${p.archived ? t("dropdown_restore") : t("dropdown_archive")}</button>
            <div class="sep"></div>
            <button class="text-danger" onclick="askDelete('products','${p.id}','${esc(p.name)}');closeAllDrops()">${icon("trash", 14)} ${t("delete")}</button>
          </div>
        </div>
      ` : ""}
    </header>

    ${p.note ? `<div class="inv-card-mobile__note icon-inline">${icon("file-text", 12)} ${p.note}</div>` : ""}

    ${showInput ? `
      <!-- ── STOCK + NOUVELLE QTÉ : côte à côte (compact) ── -->
      <div class="inv-card-mobile__row">
        <div class="inv-card-mobile__stock">
          <div class="inv-card-mobile__stock-label">${t("stock_actual")}</div>
          <div class="inv-card-mobile__stock-value">${stock}</div>
        </div>
        <div class="inv-card-mobile__update">
          <label class="inv-card-mobile__update-label" for="${inputId}">${t("stock_new_qty")}</label>
          <div class="inv-card-mobile__update-row">
            <input class="inv-card-mobile__input" type="number" inputmode="numeric" placeholder="—" id="${inputId}" onkeydown="if(event.key==='Enter')commitStock('${p.id}','${inputId}')" />
            <button class="inv-card-mobile__cta-icon" onclick="commitStock('${p.id}','${inputId}')" aria-label="${t(`stock_save`)}">${icon("check", 18)}</button>
          </div>
        </div>
      </div>
    ` : `
      <!-- ── Mode "À commander" : Stock + À commander côte à côte ── -->
      <div class="inv-card-mobile__row">
        <div class="inv-card-mobile__stock">
          <div class="inv-card-mobile__stock-label">${t("stock_actual")}</div>
          <div class="inv-card-mobile__stock-value">${stock}</div>
        </div>
        <div class="inv-card-mobile__order">
          <div class="inv-card-mobile__order-label">${t("rapport_to_order_label")}</div>
          <div class="inv-card-mobile__order-value">${oLabel}</div>
          ${p.orderUnit === "boîte" ? `<div class="inv-card-mobile__order-sub">= ${units} ${t("rapport_units")}</div>` : ""}
        </div>
      </div>
    `}

    ${showOrderBtn ? `
      <button class="inv-card-mobile__cta inv-card-mobile__cta--success" onclick="openReceiveModal('${p.id}')">
        ${icon("package", 16)} Réceptionner la commande
      </button>
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

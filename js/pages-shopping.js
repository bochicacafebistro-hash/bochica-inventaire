// ═══════════════════════════════════════════════════════════════
// LISTE D'INGRÉDIENTS — Section commande / approvisionnement
// ───────────────────────────────────────────────────────────────
// Différente de la section Ingrédients (food cost) : ici c'est une
// liste de courses simple (nom + fournisseur + catégorie + notes),
// triable par fournisseur, par nom ou par recherche texte.
//
// Fournisseurs fixes : Costco, Viandex, Gordon
// Catégories : Protéine, Légume, Produit laitier, Épicerie, Autre
// Accès : Admin (global_admin) + Chef
// ═══════════════════════════════════════════════════════════════

const SHOPPING_SUPPLIERS = ["costco", "viandex", "gordon"];
const SHOPPING_CATEGORIES = ["proteine", "legume", "laitier", "epicerie", "autre"];

function tShoppingSupplier(s) {
  const map = { costco: "Costco", viandex: "Viandex", gordon: "Gordon" };
  return map[s] || s || "—";
}

function tShoppingCategory(c) {
  const map = {
    proteine: "Protéine",
    legume: "Légume",
    laitier: "Produit laitier",
    epicerie: "Épicerie",
    autre: "Autre"
  };
  return map[c] || c || "Autre";
}

// ─── Setters de filtre / tri ─────────────────────────
function setShoppingFilter(s) {
  shoppingFilterSupplier = s;
  renderPage();
}

function setShoppingSort(m) {
  shoppingSortMode = m;
  renderPage();
}

// Recherche : on re-render mais on restaure le focus pour ne pas
// perdre la frappe en cours (même pattern que la recherche inventaire).
function updateShoppingSearch(v) {
  shoppingSearchQuery = (v || "").toLowerCase();
  const activeId = document.activeElement?.id;
  renderPage();
  requestAnimationFrame(() => {
    if (activeId === "shopping-search") {
      const el = document.getElementById("shopping-search");
      if (el) {
        el.focus();
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
      }
    }
  });
}

// ─── Rendu principal ──────────────────────────────────
function renderShoppingList() {
  const isMobile = window.innerWidth <= 640;
  const writable = canWrite("shopping");

  // Comptes par fournisseur (avant filtre, pour les onglets)
  const counts = {
    all: shoppingList.length,
    costco: shoppingList.filter(i => i.supplier === "costco").length,
    viandex: shoppingList.filter(i => i.supplier === "viandex").length,
    gordon: shoppingList.filter(i => i.supplier === "gordon").length
  };

  // Filtrage
  const q = (shoppingSearchQuery || "").trim();
  let items = shoppingList.slice();
  if (shoppingFilterSupplier !== "all") {
    items = items.filter(i => i.supplier === shoppingFilterSupplier);
  }
  if (q) {
    items = items.filter(i =>
      (i.name || "").toLowerCase().includes(q) ||
      (i.notes || "").toLowerCase().includes(q)
    );
  }

  // Tri
  if (shoppingSortMode === "name") {
    items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else {
    // Tri par fournisseur (ordre fixe Costco→Viandex→Gordon), puis nom
    items.sort((a, b) => {
      const sa = SHOPPING_SUPPLIERS.indexOf(a.supplier);
      const sb = SHOPPING_SUPPLIERS.indexOf(b.supplier);
      if (sa !== sb) return sa - sb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">Liste d'ingrédients</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">Liste de courses organisée par fournisseur</p>
      </div>
      ${writable ? `<button class="btn btn-primary" onclick="openShoppingModal()">${icon("plus", 16)} Ajouter</button>` : ""}
    </div>`;

  // Empty state global (aucun item du tout)
  if (shoppingList.length === 0) {
    h += `<div class="empty">
      <div class="empty-state-icon">${icon("cart", 48)}</div>
      Aucun ingrédient dans la liste. ${writable ? "Cliquez sur « Ajouter » pour commencer." : ""}
    </div>`;
    return h + `</div>`;
  }

  // ═ Onglets fournisseurs ═════════════════════════════
  h += `<div class="shopping-tabs" role="tablist" aria-label="Filtrer par fournisseur">
    <button class="shopping-tab ${shoppingFilterSupplier === "all" ? "is-active" : ""}" onclick="setShoppingFilter('all')" role="tab" aria-selected="${shoppingFilterSupplier === "all"}">
      Tous <span class="shopping-tab-count">${counts.all}</span>
    </button>
    ${SHOPPING_SUPPLIERS.map(s => `<button class="shopping-tab shopping-tab--${s} ${shoppingFilterSupplier === s ? "is-active" : ""}" onclick="setShoppingFilter('${s}')" role="tab" aria-selected="${shoppingFilterSupplier === s}">
      ${tShoppingSupplier(s)} <span class="shopping-tab-count">${counts[s]}</span>
    </button>`).join("")}
  </div>`;

  // ═ Barre recherche + tri ═══════════════════════════
  h += `<div class="shopping-controls">
    <div class="shopping-search-wrap">
      <span class="shopping-search-icon">${icon("search", 16)}</span>
      <input id="shopping-search" type="text" placeholder="Rechercher par nom ou notes..." value="${esc(shoppingSearchQuery || "")}" oninput="updateShoppingSearch(this.value)" aria-label="Rechercher dans la liste"/>
      ${shoppingSearchQuery ? `<button class="shopping-search-clear" onclick="updateShoppingSearch('')" aria-label="Effacer la recherche" title="Effacer">${icon("x", 14)}</button>` : ""}
    </div>
    <div class="shopping-sort">
      <label class="shopping-sort__label">${icon("filter", 14)} Trier
        <select onchange="setShoppingSort(this.value)" aria-label="Mode de tri">
          <option value="supplier" ${shoppingSortMode === "supplier" ? "selected" : ""}>Par fournisseur</option>
          <option value="name" ${shoppingSortMode === "name" ? "selected" : ""}>Par nom (A→Z)</option>
        </select>
      </label>
    </div>
  </div>`;

  // Empty state filtré (rien trouvé après recherche/filtre)
  if (items.length === 0) {
    h += `<div class="empty" style="margin-top:16px">
      <div class="empty-state-icon">${icon("search", 36)}</div>
      Aucun résultat pour ces filtres.<br/>
      <span style="font-size:13px;color:var(--text3)">Essayez d'ajuster la recherche ou le fournisseur.</span>
    </div>`;
    return h + `</div>`;
  }

  // Affichage : si tri par fournisseur ET filtre = tous → groupé par fournisseur
  // Sinon → liste plate
  const groupBySupplier = shoppingSortMode === "supplier" && shoppingFilterSupplier === "all";

  if (groupBySupplier) {
    SHOPPING_SUPPLIERS.forEach(sup => {
      const supItems = items.filter(i => i.supplier === sup);
      if (supItems.length === 0) return;
      h += `<section class="shopping-section shopping-section--${sup}">
        <h3 class="shopping-section__title">
          <span class="shopping-section__title-icon">${icon("store", 14)}</span>
          ${tShoppingSupplier(sup)}
          <span class="shopping-section__count">${supItems.length}</span>
        </h3>`;
      h += renderShoppingItems(supItems, isMobile, writable, false);
      h += `</section>`;
    });
    // Items orphelins (fournisseur invalide / vide) — affichés en bas
    const orphans = items.filter(i => !SHOPPING_SUPPLIERS.includes(i.supplier));
    if (orphans.length > 0) {
      h += `<section class="shopping-section">
        <h3 class="shopping-section__title">
          <span class="shopping-section__title-icon">${icon("alert", 14)}</span>
          Sans fournisseur
          <span class="shopping-section__count">${orphans.length}</span>
        </h3>`;
      h += renderShoppingItems(orphans, isMobile, writable, false);
      h += `</section>`;
    }
  } else {
    h += renderShoppingItems(items, isMobile, writable, true);
  }

  return h + `</div>`;
}

// ─── Rendu d'une liste d'items (mobile vs desktop) ───
function renderShoppingItems(items, isMobile, writable, showSupplierCol) {
  if (isMobile) {
    let h = `<div class="shopping-list-mobile">`;
    items.forEach(it => {
      const sup = it.supplier || "autre";
      h += `<div class="shopping-row-mobile shopping-row--${sup}">
        <div class="shopping-row-mobile__main">
          <div class="shopping-row-mobile__name">${esc(it.name || "?")}</div>
          <div class="shopping-row-mobile__meta">
            <span class="shopping-pill shopping-pill--${sup}">${icon("store", 10)} ${tShoppingSupplier(it.supplier || "")}</span>
            <span class="shopping-cat-pill shopping-cat-pill--${it.category || "autre"}">${tShoppingCategory(it.category || "autre")}</span>
          </div>
          ${it.notes ? `<div class="shopping-row-mobile__notes">${esc(it.notes)}</div>` : ""}
        </div>
        ${writable ? `<div class="menu-wrap">
          <button class="dots-btn" onclick="toggleDrop('shop${it.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
          <div class="dropdown" id="drop-shop${it.id}">
            <button onclick="openShoppingModal('${it.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
            <button onclick="duplicateItem('shoppingList','${it.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
            <div class="sep"></div>
            <button class="text-danger" onclick="askDelete('shoppingList','${it.id}','${esc(it.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
          </div>
        </div>` : ""}
      </div>`;
    });
    h += `</div>`;
    return h;
  }
  // Desktop : tableau
  let h = `<div class="table-wrap shopping-table-wrap">
    <table class="shopping-table">
      <thead><tr>
        <th>Nom</th>
        ${showSupplierCol ? `<th style="width:140px">Fournisseur</th>` : ""}
        <th style="width:160px">Catégorie</th>
        <th style="color:var(--text3)">Notes</th>
        ${writable ? `<th style="width:50px"></th>` : ""}
      </tr></thead>
      <tbody>`;
  items.forEach(it => {
    const sup = it.supplier || "autre";
    h += `<tr class="shopping-tr shopping-tr--${sup}">
      <td><strong>${esc(it.name || "?")}</strong></td>
      ${showSupplierCol ? `<td><span class="shopping-pill shopping-pill--${sup}">${tShoppingSupplier(it.supplier || "")}</span></td>` : ""}
      <td><span class="shopping-cat-pill shopping-cat-pill--${it.category || "autre"}">${tShoppingCategory(it.category || "autre")}</span></td>
      <td style="color:var(--text3);font-size:12px;font-style:italic">${esc(it.notes || "")}</td>
      ${writable ? `<td><div class="menu-wrap">
        <button class="dots-btn" onclick="toggleDrop('shop${it.id}')" aria-label="${t("actions")}">${icon("more-vertical", 16)}</button>
        <div class="dropdown" id="drop-shop${it.id}">
          <button onclick="openShoppingModal('${it.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
          <button onclick="duplicateItem('shoppingList','${it.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
          <div class="sep"></div>
          <button class="text-danger" onclick="askDelete('shoppingList','${it.id}','${esc(it.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
        </div>
      </div></td>` : ""}
    </tr>`;
  });
  h += `</tbody></table></div>`;
  return h;
}

// ─── Modal ajout/édition ──────────────────────────────
function openShoppingModal(id) {
  const it = id ? shoppingList.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header">
      <h3>${it ? "Modifier l'ingrédient" : "Ajouter un ingrédient"}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <label>Nom <input id="shop-name" value="${esc(it?.name || "")}" placeholder="ex: Filet de poulet, Tomates italiennes..."/></label>

    <div class="form-row">
      <label>Fournisseur
        <select id="shop-supplier">
          ${SHOPPING_SUPPLIERS.map(s => `<option value="${s}" ${(it?.supplier || "costco") === s ? "selected" : ""}>${tShoppingSupplier(s)}</option>`).join("")}
        </select>
      </label>
      <label>Catégorie
        <select id="shop-category">
          ${SHOPPING_CATEGORIES.map(c => `<option value="${c}" ${(it?.category || "autre") === c ? "selected" : ""}>${tShoppingCategory(c)}</option>`).join("")}
        </select>
      </label>
    </div>

    <label>Notes <textarea id="shop-notes" style="height:80px" placeholder="Format, marque, code produit, fréquence de commande, etc.">${esc(it?.notes || "")}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveShoppingItem('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
  // Focus sur le nom à l'ouverture
  setTimeout(() => {
    const el = document.getElementById("shop-name");
    if (el) { el.focus(); if (typeof el.select === "function") el.select(); }
  }, 50);
}

async function saveShoppingItem(id) {
  const name = document.getElementById("shop-name").value.trim();
  if (!name) return toast("Veuillez saisir un nom.", "error");
  const supplier = document.getElementById("shop-supplier").value;
  const category = document.getElementById("shop-category").value;
  if (!SHOPPING_SUPPLIERS.includes(supplier)) {
    return toast("Fournisseur invalide.", "error");
  }
  const data = {
    name,
    supplier,
    category,
    notes: document.getElementById("shop-notes").value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    if (id) {
      await db.collection("shoppingList").doc(id).update(data);
      await addLog(name, "Liste ingrédients — modifié", `Fournisseur : ${tShoppingSupplier(supplier)}`);
      toast("Ingrédient modifié.", "success");
    } else {
      const nid = genId();
      await db.collection("shoppingList").doc(nid).set({
        ...data,
        id: nid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await addLog(name, "Liste ingrédients — ajouté", `Fournisseur : ${tShoppingSupplier(supplier)} · Catégorie : ${tShoppingCategory(category)}`);
      toast("Ingrédient ajouté.", "success");
    }
    closeModal();
  } catch (err) {
    console.error("saveShoppingItem:", err);
    toast("Erreur sauvegarde : " + (err.message || err), "error");
  }
}

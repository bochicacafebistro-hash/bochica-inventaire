// ── Modal Produit ─────────────────────────────────────
function openProductModal(id) {
  const p = id ? products.find(x => x.id === id) : null;
  const secs = getAllSections().filter(s => s !== "Toutes");
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${p ? t("prod_modal_edit") : t("prod_modal_add")}</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <label>${t("prod_field_name")}<input id="p-name" value="${esc(p?.name || "")}"/></label>
    <label>${t("prod_field_section")}<select id="p-section">${secs.map(s => `<option value="${s}" ${(p?.section || "Cuisine") === s ? "selected" : ""}>${tSection(s)}</option>`).join("")}</select></label>
    <div class="form-row">
      <label>${t("prod_field_stock")}<input id="p-stock" type="number" value="${p?.currentStock || 0}"/></label>
      <label>${t("prod_field_minimum")}<input id="p-minimum" type="number" value="${p?.minimum || 0}"/></label>
    </div>
    <label>${t("prod_field_order_unit")}<select id="p-orderunit" onchange="toggleBoxFields()">
      <option value="unité" ${(p?.orderUnit || "unité") === "unité" ? "selected" : ""}>${t("unit_unit_cap")}</option>
      <option value="boîte" ${p?.orderUnit === "boîte" ? "selected" : ""}>${t("unit_box_cap")}</option>
    </select></label>
    <div id="box-fields" style="display:${p?.orderUnit === "boîte" ? "block" : "none"}">
      <div class="form-row">
        <label>${t("prod_field_units_box")}<input id="p-upb" type="number" value="${p?.unitsPerBox || 1}"/></label>
        <label>${t("prod_field_qty_order")}<input id="p-oqty" type="number" value="${p?.orderQty || 0}"/></label>
      </div>
    </div>
    <div id="unit-fields" style="display:${p?.orderUnit === "boîte" ? "none" : "block"}">
      <label>${t("prod_field_qty_order")}<input id="p-oqty-u" type="number" value="${p?.orderQty || 0}"/></label>
    </div>
    <label>${t("prod_field_supplier")}<select id="p-sup">
      <option value="">${t("none")}</option>
      ${suppliers.map(s => `<option value="${s.id}" ${p?.supplierId === s.id ? "selected" : ""}>${s.name}</option>`).join("")}
    </select></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveProduct('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

function toggleBoxFields() {
  const isBox = document.getElementById("p-orderunit")?.value === "boîte";
  document.getElementById("box-fields").style.display = isBox ? "block" : "none";
  document.getElementById("unit-fields").style.display = isBox ? "none" : "block";
}

async function saveProduct(id) {
  const name = document.getElementById("p-name").value.trim();
  if (!name) return alert(t("err_enter_name"));
  const orderUnit = document.getElementById("p-orderunit").value;
  const isBox = orderUnit === "boîte";
  const orderQty = isBox ? Number(document.getElementById("p-oqty").value) : Number(document.getElementById("p-oqty-u").value);
  const data = {
    name, unit: "unité", orderUnit, orderQty,
    unitsPerBox: isBox ? Number(document.getElementById("p-upb").value) : 1,
    minimum: Number(document.getElementById("p-minimum").value),
    currentStock: Number(document.getElementById("p-stock").value),
    section: document.getElementById("p-section").value,
    supplierId: document.getElementById("p-sup").value
  };
  if (id) {
    const p = products.find(x => x.id === id);
    await db.collection("products").doc(id).set({ ...p, ...data, id });
    await addLog(name, "Modifié", "");
  } else {
    const nid = genId();
    await db.collection("products").doc(nid).set({ ...data, id: nid, sortOrder: products.length, archived: false });
    await addLog(name, "Ajouté", "");
  }
  closeModal();
}

// ── Modal Note ────────────────────────────────────────
function openNoteModal(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  showModal(`<div class="modal" style="max-width:400px">
    <div class="modal-header"><h3>📝 Note — ${p.name}</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <label>Note rapide<textarea id="note-text" style="height:100px;resize:vertical">${p.note || ""}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="clearNote('${id}')">Effacer</button>
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveNote('${id}')">${t("save")}</button>
    </div>
  </div>`);
}
async function saveNote(id) { const note = document.getElementById("note-text").value.trim(); await db.collection("products").doc(id).update({ note }); closeModal(); }
async function clearNote(id) { await db.collection("products").doc(id).update({ note: "" }); closeModal(); }

// ── Modal Changer catégorie ───────────────────────────
function openMoveModal(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  const secs = getAllSections().filter(s => s !== "Toutes");
  showModal(`<div class="modal" style="max-width:360px">
    <div class="modal-header"><h3>📁 Changer catégorie — ${p.name}</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <label>Catégorie<select id="move-sec">${secs.map(s => `<option value="${s}" ${s === p.section ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="confirmMove('${id}')">Déplacer</button>
    </div>
  </div>`);
}
async function confirmMove(id) { await db.collection("products").doc(id).update({ section: document.getElementById("move-sec").value }); closeModal(); }

// ── Modal Réception commande ──────────────────────────
function openReceiveModal(id) {
  const p = products.find(x => x.id === id); if (!p) return; receivingProduct = p;
  const isBox = p.orderUnit === "boîte"; const upb = p.unitsPerBox || 1; const dq = p.orderQty || 0; const stock = getCurrentStock(p);
  showModal(`<div class="modal" style="max-width:400px">
    <div class="modal-header"><h3>📦 Réception — ${p.name}</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--text2)">
      Stock actuel : <strong>${stock} unités</strong><br>
      Commande prévue : <strong>${orderLabel(p)}</strong>${isBox ? ` (${dq * upb} unités)` : ""}
    </div>
    <label>Quantité reçue
      <input id="recv-qty" type="number" value="${dq}" oninput="updateRecvPreview()" min="0"/>
      <span class="field-hint">${isBox ? `Nombre de boîtes (${upb} unités/boîte)` : "Nombre d'unités"}</span>
    </label>
    <div id="recv-preview" style="font-size:13px;color:var(--text2);min-height:20px;margin-bottom:8px"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="confirmReceive()">✅ Confirmer</button>
    </div>
  </div>`);
  setTimeout(updateRecvPreview, 50);
}

function updateRecvPreview() {
  const p = receivingProduct; if (!p) return;
  const qty = Number(document.getElementById("recv-qty")?.value) || 0;
  const isBox = p.orderUnit === "boîte"; const units = qty * (isBox ? (p.unitsPerBox || 1) : 1);
  const newStock = getCurrentStock(p) + units;
  const expected = (p.orderQty || 0) * (isBox ? (p.unitsPerBox || 1) : 1);
  const diff = units - expected;
  const el = document.getElementById("recv-preview");
  if (el) el.innerHTML = `Ajouter <strong>${units} unité${units !== 1 ? "s" : ""}</strong> → Nouveau stock : <strong>${newStock}</strong>
    ${diff < 0 ? `<br><span style="color:var(--status-red)">▼ ${Math.abs(diff)} unités de moins que prévu</span>` : diff > 0 ? `<br><span style="color:var(--status-green)">▲ ${diff} unités de plus que prévu</span>` : ""}`;
}

async function confirmReceive() {
  const p = receivingProduct; if (!p) return;
  const qty = Number(document.getElementById("recv-qty").value) || 0;
  const isBox = p.orderUnit === "boîte"; const units = qty * (isBox ? (p.unitsPerBox || 1) : 1);
  const old = getCurrentStock(p); const newStock = old + units;
  await db.collection("products").doc(p.id).update({ currentStock: newStock });
  await addLog(p.name, "Réception", `+${units} unités (${qty} ${p.orderUnit}${qty > 1 ? "s" : ""}) · ${old} → ${newStock}`);
  receivingProduct = null; closeModal();
}

// ── Modal Catégories ──────────────────────────────────
// Liste unifiée : toutes les catégories (par défaut + personnalisées)
// sont modifiables, supprimables et réordonnables.

function _currentCats() {
  // Retourne la liste courante (sans "Toutes"), en utilisant le fallback si besoin.
  return (allSections && allSections.length) ? allSections.slice() : [...DEFAULT_SECTIONS, ...customSections];
}

async function _saveCats(list) {
  // Écrit la liste unifiée dans Firestore (champ `all`), en préservant `custom` pour rétrocompat.
  await db.collection("settings").doc("sections").set({
    all: list,
    custom: customSections // préservé pour rétrocompat (anciens clients)
  }, { merge: true });
}

function openCategoryModal() {
  const cats = _currentCats();
  const renderCats = () => !cats.length
    ? `<p class="cat-empty">Aucune catégorie. Ajoutez-en une ci-dessous.</p>`
    : cats.map((s, i) => {
        const count = products.filter(p => !p.archived && p.section === s).length;
        const isDefault = DEFAULT_SECTIONS.includes(s);
        return `<div class="cat-item" data-idx="${i}">
          <div class="cat-item__reorder">
            <button class="cat-move-btn" onclick="moveCategory(${i},-1)" ${i === 0 ? "disabled" : ""} aria-label="Monter">${icon("chevron-up", 14)}</button>
            <button class="cat-move-btn" onclick="moveCategory(${i},1)" ${i === cats.length - 1 ? "disabled" : ""} aria-label="Descendre">${icon("chevron-down", 14)}</button>
          </div>
          <input class="cat-item__input" value="${esc(s)}" data-original="${esc(s)}" onblur="renameCategory(${i},this.value)" onkeydown="if(event.key==='Enter')this.blur()"/>
          <span class="cat-item__count" title="${count} produit${count > 1 ? "s" : ""} dans cette catégorie">${count}</span>
          ${isDefault ? `<span class="cat-item__badge" title="Catégorie par défaut">défaut</span>` : ""}
          <button class="btn-danger-sm" onclick="askDeleteCategory(${i},'${esc(s)}')" aria-label="Supprimer ${esc(s)}">${icon("trash", 14)}</button>
        </div>`;
      }).join("");
  showModal(`<div class="modal">
    <div class="modal-header">
      <h3>${icon("folder", 18)} Gérer les catégories</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p class="cat-help">Toutes les catégories de l'inventaire. Renommer met à jour les produits automatiquement. Supprimer déplace les produits vers « Autre ».</p>
    <div id="cat-list" class="cat-list">${renderCats()}</div>
    <div class="cat-add-row">
      <input id="cat-new" placeholder="Nouvelle catégorie..." onkeydown="if(event.key==='Enter')addCategory()"/>
      <button class="btn btn-primary" onclick="addCategory()">${icon("plus", 14)} Ajouter</button>
    </div>
  </div>`);
  // Focus sur l'input d'ajout pour ergonomie clavier
  setTimeout(() => { const el = document.getElementById("cat-new"); if (el) el.focus(); }, 50);
}

async function addCategory() {
  const input = document.getElementById("cat-new");
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  const cats = _currentCats();
  if (cats.some(c => c.toLowerCase() === name.toLowerCase())) {
    alert("Cette catégorie existe déjà.");
    return;
  }
  await _saveCats([...cats, name]);
  // Ne ferme pas la modale pour enchaîner les ajouts
  input.value = "";
  // Ré-ouverture pour voir la nouvelle catégorie
  openCategoryModal();
}

async function renameCategory(i, v) {
  const cats = _currentCats();
  const oldName = cats[i];
  const newName = (v || "").trim();
  if (!newName || newName === oldName) return;
  // Vérifier doublon
  if (cats.some((c, j) => j !== i && c.toLowerCase() === newName.toLowerCase())) {
    alert(`La catégorie "${newName}" existe déjà.`);
    // Remettre l'ancien nom dans l'input
    const inp = document.querySelector(`.cat-item[data-idx="${i}"] input`);
    if (inp) inp.value = oldName;
    return;
  }
  // Mettre à jour la liste
  const updated = [...cats];
  updated[i] = newName;
  // Batch : renommer la catégorie dans les produits qui l'utilisent
  const affected = products.filter(p => p.section === oldName);
  if (affected.length) {
    const batch = db.batch();
    affected.forEach(p => batch.update(db.collection("products").doc(p.id), { section: newName }));
    await batch.commit();
  }
  await _saveCats(updated);
  // Si la section active était celle renommée, suivre le renommage
  if (activeSection === oldName) activeSection = newName;
  await addLog("—", "Catégorie renommée", `${oldName} → ${newName} (${affected.length} produit${affected.length > 1 ? "s" : ""})`);
}

function askDeleteCategory(i, name) {
  const cats = _currentCats();
  const count = products.filter(p => p.section === name).length;
  const remaining = cats.filter((_, j) => j !== i);
  // Destination : "Autre" si présent, sinon première restante
  const fallback = remaining.includes("Autre") ? "Autre" : (remaining[0] || "Autre");
  if (remaining.length === 0) {
    alert("Impossible de supprimer la dernière catégorie. Ajoutez-en une autre d'abord.");
    return;
  }
  const msg = count > 0
    ? `Supprimer la catégorie "${name}" ?<br><br><strong>${count} produit${count > 1 ? "s" : ""}</strong> ${count > 1 ? "seront déplacés" : "sera déplacé"} vers "<strong>${fallback}</strong>".`
    : `Supprimer la catégorie "${name}" ?`;
  openConfirm("Supprimer la catégorie", msg, async () => {
    // Si "Autre" n'existe pas dans les restantes, on l'ajoute pour garantir une destination
    let newList = remaining.slice();
    if (!newList.includes(fallback)) newList = [...newList, fallback];
    // Déplacer les produits de cette catégorie vers fallback
    const affected = products.filter(p => p.section === name);
    if (affected.length) {
      const batch = db.batch();
      affected.forEach(p => batch.update(db.collection("products").doc(p.id), { section: fallback }));
      await batch.commit();
    }
    await _saveCats(newList);
    if (activeSection === name) activeSection = "Toutes";
    await addLog("—", "Catégorie supprimée", `${name} (${affected.length} produit${affected.length > 1 ? "s" : ""} → ${fallback})`);
    // Ré-ouvrir la modale pour refléter le changement
    setTimeout(() => openCategoryModal(), 100);
  }, true);
}

async function moveCategory(i, dir) {
  const cats = _currentCats();
  const j = i + dir;
  if (j < 0 || j >= cats.length) return;
  const updated = [...cats];
  [updated[i], updated[j]] = [updated[j], updated[i]];
  await _saveCats(updated);
  // Ré-ouvrir la modale pour refléter le nouvel ordre
  setTimeout(() => openCategoryModal(), 50);
}

// ── Suppression générique ─────────────────────────────
function askDelete(col, id, name) {
  openConfirm("🗑️ Supprimer", `Supprimer "${name}" définitivement ?`, () => db.collection(col).doc(id).delete(), true);
}

// ── Archive ───────────────────────────────────────────
function doToggleArchive(id, name, isArchived) {
  openConfirm(
    isArchived ? "📤 Restaurer" : "📦 Archiver",
    isArchived ? `Restaurer "${name}" ?` : `Archiver "${name}" ?`,
    async () => {
      await db.collection("products").doc(id).update({ archived: !isArchived });
      await addLog(name, isArchived ? "Restauré" : "Archivé", "");
      if (showArchived && isArchived) showArchived = false;
    }
  );
}

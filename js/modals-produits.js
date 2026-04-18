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
function openCategoryModal() {
  const renderCats = () => !customSections.length
    ? `<p style="color:var(--text3);font-size:13px;text-align:center;margin-bottom:12px">Aucune catégorie personnalisée</p>`
    : customSections.map((s, i) => `<div class="cat-item">
        <input value="${s}" onblur="renameCategory(${i},this.value)"/>
        <button class="btn-danger-sm" onclick="askDeleteCategory(${i},'${esc(s)}')">🗑️</button>
      </div>`).join("");
  showModal(`<div class="modal">
    <div class="modal-header"><h3>⚙️ Catégories</h3><button class="close-btn" onclick="closeModal()">${icon("x", 18)}</button></div>
    <div id="cat-list">${renderCats()}</div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <input id="cat-new" placeholder="Nouvelle catégorie..."/>
      <button class="btn btn-primary" onclick="addCategory()">Ajouter</button>
    </div>
  </div>`);
}

async function addCategory() {
  const name = document.getElementById("cat-new").value.trim();
  if (!name) return;
  if (DEFAULT_SECTIONS.includes(name) || customSections.includes(name)) return alert("Déjà existante.");
  await db.collection("settings").doc("sections").set({ custom: [...customSections, name] });
  closeModal();
}

async function renameCategory(i, v) {
  const t = v.trim(); if (!t || t === customSections[i]) return;
  const u = [...customSections]; u[i] = t;
  await db.collection("settings").doc("sections").set({ custom: u });
}

function askDeleteCategory(i, name) {
  openConfirm("🗑️ Supprimer catégorie", `Supprimer "${name}" ?`, async () => {
    await db.collection("settings").doc("sections").set({ custom: customSections.filter((_, j) => j !== i) });
  }, true);
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

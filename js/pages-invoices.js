// ═══════════════════════════════════════════════════════════════
// FACTURES — Module de facturation client (v3.33.0)
// ───────────────────────────────────────────────────────────────
// Permet à l'admin de créer des factures pour des clients (événements,
// services, locations…) avec lignes libres, taxes par défaut TPS/TVQ
// Québec (modifiables par facture), génération PDF style Bochica, et
// création automatique d'un revenu dans /revenues quand la facture
// est marquée « Payée ».
//
// Données : collection `invoices`, admin uniquement (règles Firestore).
// Lien avec /revenues : champ `paidRevenueId` stocke l'id du revenu
//   créé automatiquement (et permet sa suppression si on déchange « Payée »).
// ═══════════════════════════════════════════════════════════════

// ─ Constantes ──────────────────────────────────────────
// Taux Québec 2026 — modifiables par facture si besoin (ex. exonération)
const DEFAULT_TPS = 0.05;     // 5%
const DEFAULT_TVQ = 0.09975;  // 9.975%

const INVOICE_STATUS_LABELS = {
  brouillon: "Brouillon",
  envoyee:   "Envoyée",
  payee:     "Payée",
  annulee:   "Annulée"
};

// ═ Helpers ─────────────────────────────────────────────

// Numérotation auto : FAC-YYYY-NNN, incrément basé sur l'année courante
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const existingNums = invoices
    .filter(i => (i.invoiceNumber || "").startsWith(prefix))
    .map(i => parseInt((i.invoiceNumber || "").slice(prefix.length), 10))
    .filter(n => Number.isFinite(n));
  const next = (existingNums.length === 0 ? 0 : Math.max(...existingNums)) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// Calculs sur les lignes
function invoiceLineTotal(line) {
  const q = Number(line?.quantity) || 0;
  const p = Number(line?.unitPrice) || 0;
  return q * p;
}
function invoiceSubtotal(inv) {
  return (inv.lines || []).reduce((s, l) => s + invoiceLineTotal(l), 0);
}
function invoiceTaxes(inv) {
  const sub = invoiceSubtotal(inv);
  const tps = sub * (Number(inv.tpsRate) || 0);
  const tvq = sub * (Number(inv.tvqRate) || 0);
  return { sub, tps, tvq, total: sub + tps + tvq };
}

// Date au format YYYY-MM-DD pour les inputs date
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(iso, days) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Couleur de pill pour chaque statut
function invoiceStatusClass(status) {
  switch (status) {
    case "brouillon": return "is-draft";
    case "envoyee":   return "is-sent";
    case "payee":     return "is-paid";
    case "annulee":   return "is-cancelled";
    default:          return "is-draft";
  }
}

// ═ Liste des factures (page principale) ════════════════
function renderInvoices() {
  // KPIs
  const total = invoices.reduce((s, i) => s + invoiceTaxes(i).total, 0);
  const paid = invoices.filter(i => i.status === "payee").reduce((s, i) => s + invoiceTaxes(i).total, 0);
  const pending = invoices.filter(i => i.status === "envoyee").reduce((s, i) => s + invoiceTaxes(i).total, 0);
  const drafts = invoices.filter(i => i.status === "brouillon").length;

  // Filtrage
  let filtered = invoices.slice();
  if (invoicesFilterStatus !== "all") {
    filtered = filtered.filter(i => i.status === invoicesFilterStatus);
  }
  const q = (invoicesSearchQuery || "").trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(i =>
      (i.invoiceNumber || "").toLowerCase().includes(q) ||
      (i.clientName || "").toLowerCase().includes(q) ||
      (i.clientCompany || "").toLowerCase().includes(q) ||
      (i.clientEmail || "").toLowerCase().includes(q)
    );
  }

  // Compteurs par statut pour les onglets
  const countByStatus = invoices.reduce((acc, i) => {
    acc[i.status || "brouillon"] = (acc[i.status || "brouillon"] || 0) + 1;
    return acc;
  }, {});

  return `<div class="page page--wide">
    <div class="toolbar">
      <h2 class="page-title">${icon("receipt", 22)} Factures</h2>
      <button class="btn btn-primary" onclick="openInvoiceModal()">${icon("plus", 16)} Nouvelle facture</button>
    </div>

    ${invoices.length === 0 ? `
      <div class="empty">
        <div class="empty-state-icon">${icon("receipt", 36)}</div>
        Aucune facture pour l'instant. Crée ta première facture pour un client — taxes TPS/TVQ calculées automatiquement, PDF prêt à envoyer en quelques secondes.
        <div style="margin-top:16px">
          <button class="btn btn-primary btn-sm" onclick="openInvoiceModal()">${icon("plus", 14)} Créer une facture</button>
        </div>
      </div>
    ` : `
      <!-- KPIs -->
      <div class="invoice-kpis">
        <div class="invoice-kpi">
          <div class="invoice-kpi-label">Total facturé</div>
          <div class="invoice-kpi-value">${fmtMoney(total)}</div>
          <div class="invoice-kpi-sub">${invoices.length} facture${invoices.length > 1 ? "s" : ""}</div>
        </div>
        <div class="invoice-kpi is-paid">
          <div class="invoice-kpi-label">${icon("check", 12)} Encaissé</div>
          <div class="invoice-kpi-value">${fmtMoney(paid)}</div>
          <div class="invoice-kpi-sub">${countByStatus.payee || 0} payée${(countByStatus.payee || 0) > 1 ? "s" : ""}</div>
        </div>
        <div class="invoice-kpi is-pending">
          <div class="invoice-kpi-label">${icon("clock", 12)} En attente</div>
          <div class="invoice-kpi-value">${fmtMoney(pending)}</div>
          <div class="invoice-kpi-sub">${countByStatus.envoyee || 0} envoyée${(countByStatus.envoyee || 0) > 1 ? "s" : ""}</div>
        </div>
        <div class="invoice-kpi is-draft">
          <div class="invoice-kpi-label">${icon("file-text", 12)} Brouillons</div>
          <div class="invoice-kpi-value">${drafts}</div>
          <div class="invoice-kpi-sub">à compléter</div>
        </div>
      </div>

      <!-- Onglets statuts + recherche -->
      <div class="invoice-toolbar">
        <div class="invoice-tabs">
          ${["all", "brouillon", "envoyee", "payee", "annulee"].map(s => {
            const label = s === "all" ? "Toutes" : INVOICE_STATUS_LABELS[s];
            const count = s === "all" ? invoices.length : (countByStatus[s] || 0);
            const active = invoicesFilterStatus === s;
            return `<button class="invoice-tab ${active ? "is-active" : ""}" onclick="setInvoicesFilter('${s}')">
              ${esc(label)} <span class="invoice-tab-count">${count}</span>
            </button>`;
          }).join("")}
        </div>
        <div class="invoice-search">
          ${icon("search", 14)}
          <input type="search" placeholder="Recherche n°, client, entreprise…" value="${esc(invoicesSearchQuery)}" oninput="setInvoicesSearch(this.value)" aria-label="Recherche factures"/>
        </div>
      </div>

      <!-- Liste -->
      ${filtered.length === 0 ? `
        <div class="empty" style="margin-top:var(--sp-4)">
          ${icon("search", 24)}<br/>Aucune facture ne correspond.
        </div>
      ` : `
        <div class="invoice-list">
          ${filtered.map(inv => {
            const { total } = invoiceTaxes(inv);
            const statusCls = invoiceStatusClass(inv.status);
            const statusLabel = INVOICE_STATUS_LABELS[inv.status] || "Brouillon";
            const overdue = inv.status === "envoyee" && inv.dueDate && inv.dueDate < todayISO();
            return `<div class="invoice-card ${statusCls} ${overdue ? "is-overdue" : ""}">
              <div class="invoice-card-head">
                <div>
                  <div class="invoice-card-number">${esc(inv.invoiceNumber || "—")}</div>
                  <div class="invoice-card-client">${esc(inv.clientName || "Client sans nom")}${inv.clientCompany ? ` <span class="invoice-card-company">· ${esc(inv.clientCompany)}</span>` : ""}</div>
                </div>
                <div class="invoice-card-status">
                  <span class="invoice-status-pill ${statusCls}">${esc(statusLabel)}</span>
                  ${overdue ? `<span class="invoice-overdue-tag" title="Échéance dépassée">${icon("alert", 10)} En retard</span>` : ""}
                </div>
              </div>
              <div class="invoice-card-meta">
                <span>${icon("calendar", 12)} Émise le ${esc(inv.invoiceDate || "—")}</span>
                <span>${icon("clock", 12)} Échéance ${esc(inv.dueDate || "—")}</span>
                <span class="invoice-card-total">${fmtMoney(total)}</span>
              </div>
              <div class="invoice-card-actions">
                <button class="btn-secondary btn-sm" onclick="openInvoiceModal('${inv.id}')" title="Modifier">${icon("pencil", 12)} Modifier</button>
                <button class="btn-secondary btn-sm" onclick="generateInvoicePDF('${inv.id}')" title="Télécharger le PDF">${icon("download", 12)} PDF</button>
                <div class="menu-wrap">
                  <button class="dots-btn" onclick="toggleDrop('inv${inv.id}')" aria-label="Plus d'actions">${icon("more-vertical", 14)}</button>
                  <div class="dropdown" id="drop-inv${inv.id}">
                    <div class="dropdown-section-label">Changer le statut</div>
                    ${["brouillon", "envoyee", "payee", "annulee"].filter(s => s !== inv.status).map(s => `
                      <button onclick="changeInvoiceStatus('${inv.id}','${s}');closeAllDrops()">
                        ${icon(s === "payee" ? "check" : s === "envoyee" ? "download" : s === "annulee" ? "x" : "file-text", 12)} ${esc(INVOICE_STATUS_LABELS[s])}
                      </button>
                    `).join("")}
                    <hr/>
                    <button onclick="duplicateInvoice('${inv.id}');closeAllDrops()">${icon("copy", 12)} Dupliquer</button>
                    <button class="text-danger" onclick="askDeleteInvoice('${inv.id}','${esc(inv.invoiceNumber || "")}');closeAllDrops()">${icon("trash", 12)} Supprimer</button>
                  </div>
                </div>
              </div>
            </div>`;
          }).join("")}
        </div>
      `}
    `}
  </div>`;
}

// Filtre + recherche (re-render seulement la page courante)
function setInvoicesFilter(s) {
  invoicesFilterStatus = s;
  if (activePage === "factures") renderPage();
}
function setInvoicesSearch(v) {
  invoicesSearchQuery = v;
  if (activePage !== "factures") return;
  renderPage();
  // Restaure le focus + curseur après le re-render
  requestAnimationFrame(() => {
    const input = document.querySelector(".invoice-search input");
    if (input) {
      input.focus();
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (_) {}
    }
  });
}

// ═ Modal création/édition ══════════════════════════════
function openInvoiceModal(id) {
  const inv = id ? invoices.find(x => x.id === id) : null;
  const isEdit = !!inv;

  // Pré-remplissage / valeurs par défaut
  const number = inv?.invoiceNumber || generateInvoiceNumber();
  const invoiceDate = inv?.invoiceDate || todayISO();
  const dueDate = inv?.dueDate || addDaysISO(invoiceDate, 30);
  const tpsRate = (typeof inv?.tpsRate === "number") ? inv.tpsRate : DEFAULT_TPS;
  const tvqRate = (typeof inv?.tvqRate === "number") ? inv.tvqRate : DEFAULT_TVQ;
  const status = inv?.status || "brouillon";

  // Lignes : copies de travail en mémoire (modifiable sans toucher Firestore)
  _editingInvoiceLines = (inv?.lines || []).map(l => ({
    id: l.id || ("L" + Math.random().toString(36).slice(2, 9)),
    description: l.description || "",
    quantity: Number(l.quantity) || 1,
    unitPrice: Number(l.unitPrice) || 0
  }));
  if (_editingInvoiceLines.length === 0) {
    _editingInvoiceLines = [{ id: "L" + Math.random().toString(36).slice(2, 9), description: "", quantity: 1, unitPrice: 0 }];
  }

  showModal(`<div class="modal invoice-modal" style="max-width:780px">
    <div class="modal-header">
      <h3>${icon("receipt", 18)} ${isEdit ? "Modifier la facture" : "Nouvelle facture"} <span class="invoice-modal-num">${esc(number)}</span></h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <!-- Section Client -->
    <h4 class="invoice-modal-section">${icon("user", 14)} Client</h4>
    <div class="invoice-modal-grid-2">
      <label>Nom du client *
        <input id="inv-clientName" value="${esc(inv?.clientName || "")}" placeholder="Jean Tremblay" required/>
      </label>
      <label>Entreprise
        <input id="inv-clientCompany" value="${esc(inv?.clientCompany || "")}" placeholder="(optionnel)"/>
      </label>
      <label>Téléphone
        <input id="inv-clientPhone" value="${esc(inv?.clientPhone || "")}" placeholder="(514) 555-1234"/>
      </label>
      <label>Courriel
        <input id="inv-clientEmail" type="email" value="${esc(inv?.clientEmail || "")}" placeholder="client@exemple.com"/>
      </label>
      <label style="grid-column:1/-1">Adresse
        <input id="inv-clientAddress" value="${esc(inv?.clientAddress || "")}" placeholder="Rue, ville, code postal"/>
      </label>
    </div>

    <!-- Section Dates + statut -->
    <h4 class="invoice-modal-section">${icon("calendar", 14)} Dates & statut</h4>
    <div class="invoice-modal-grid-3">
      <label>Date d'émission
        <input id="inv-date" type="date" value="${esc(invoiceDate)}"/>
      </label>
      <label>Échéance
        <input id="inv-dueDate" type="date" value="${esc(dueDate)}"/>
      </label>
      <label>Statut
        <select id="inv-status">
          ${Object.keys(INVOICE_STATUS_LABELS).map(s => `<option value="${s}" ${s === status ? "selected" : ""}>${INVOICE_STATUS_LABELS[s]}</option>`).join("")}
        </select>
      </label>
    </div>

    <!-- Section Lignes -->
    <h4 class="invoice-modal-section">${icon("list", 14)} Lignes de facture
      <button class="btn-secondary btn-sm invoice-add-line" onclick="addInvoiceLine()">${icon("plus", 12)} Ajouter une ligne</button>
    </h4>
    <div id="inv-lines-container">
      ${renderInvoiceLines()}
    </div>

    <!-- Section Taxes (modifiables) -->
    <h4 class="invoice-modal-section">${icon("shield-check", 14)} Taxes
      <span class="invoice-modal-section-hint">Taux Québec par défaut — modifiables au besoin</span>
    </h4>
    <div class="invoice-modal-grid-2">
      <label>TPS (%)
        <input id="inv-tps" type="number" step="0.001" min="0" max="100" value="${(tpsRate * 100).toFixed(3).replace(/\.?0+$/, "")}" oninput="recalcInvoiceTotals()"/>
      </label>
      <label>TVQ (%)
        <input id="inv-tvq" type="number" step="0.001" min="0" max="100" value="${(tvqRate * 100).toFixed(3).replace(/\.?0+$/, "")}" oninput="recalcInvoiceTotals()"/>
      </label>
    </div>

    <!-- Totaux calculés en direct -->
    <div class="invoice-totals" id="inv-totals">
      ${renderInvoiceTotals(tpsRate, tvqRate)}
    </div>

    <!-- Notes -->
    <h4 class="invoice-modal-section">${icon("file-text", 14)} Notes (optionnel)</h4>
    <label class="sr-only" for="inv-notes">Notes</label>
    <textarea id="inv-notes" placeholder="Conditions de paiement, instructions, mentions légales…" rows="3">${esc(inv?.notes || "")}</textarea>

    <div class="modal-actions" style="margin-top:var(--sp-4)">
      ${isEdit ? `<button class="btn-cancel text-danger" onclick="askDeleteInvoice('${inv.id}','${esc(number)}')">${icon("trash", 14)} Supprimer</button>` : `<div></div>`}
      <div style="display:flex;gap:var(--sp-2)">
        <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
        <button class="btn btn-primary" onclick="saveInvoiceFromModal('${inv?.id || ""}', '${esc(number)}')">${icon("check", 14)} ${isEdit ? "Enregistrer" : "Créer la facture"}</button>
      </div>
    </div>
  </div>`);
}

// Rendu des lignes (re-rendu partiel quand on ajoute/supprime)
function renderInvoiceLines() {
  return `<div class="invoice-lines">
    <div class="invoice-lines-header">
      <div>Description</div>
      <div>Qté</div>
      <div>Prix unit. ($)</div>
      <div>Total</div>
      <div></div>
    </div>
    ${_editingInvoiceLines.map((line, idx) => `
      <div class="invoice-line" data-line-id="${line.id}">
        <input class="inv-line-desc" placeholder="Ex: Service traiteur — événement 25 personnes" value="${esc(line.description)}" oninput="updateInvoiceLine('${line.id}','description',this.value)"/>
        <input class="inv-line-qty" type="number" min="0" step="0.01" value="${line.quantity}" oninput="updateInvoiceLine('${line.id}','quantity',this.value)"/>
        <input class="inv-line-price" type="number" min="0" step="0.01" value="${line.unitPrice}" oninput="updateInvoiceLine('${line.id}','unitPrice',this.value)"/>
        <div class="inv-line-total">${fmtMoney(invoiceLineTotal(line))}</div>
        <button class="inv-line-remove" onclick="removeInvoiceLine('${line.id}')" title="Retirer cette ligne" ${_editingInvoiceLines.length === 1 ? "disabled" : ""}>${icon("trash", 12)}</button>
      </div>
    `).join("")}
  </div>`;
}

// Rendu des totaux
function renderInvoiceTotals(tpsRate, tvqRate) {
  const sub = _editingInvoiceLines.reduce((s, l) => s + invoiceLineTotal(l), 0);
  const tps = sub * (Number(tpsRate) || 0);
  const tvq = sub * (Number(tvqRate) || 0);
  const total = sub + tps + tvq;
  return `
    <div class="invoice-totals-row"><span>Sous-total</span><strong>${fmtMoney(sub)}</strong></div>
    <div class="invoice-totals-row"><span>TPS (${(tpsRate * 100).toFixed(3).replace(/\.?0+$/, "")}%)</span><strong>${fmtMoney(tps)}</strong></div>
    <div class="invoice-totals-row"><span>TVQ (${(tvqRate * 100).toFixed(3).replace(/\.?0+$/, "")}%)</span><strong>${fmtMoney(tvq)}</strong></div>
    <div class="invoice-totals-row invoice-totals-row--final"><span>TOTAL</span><strong>${fmtMoney(total)}</strong></div>
  `;
}

// Recalcul des totaux quand un input change (sans re-render des lignes)
function recalcInvoiceTotals() {
  const tpsRate = (Number(document.getElementById("inv-tps")?.value) || 0) / 100;
  const tvqRate = (Number(document.getElementById("inv-tvq")?.value) || 0) / 100;
  const el = document.getElementById("inv-totals");
  if (el) el.innerHTML = renderInvoiceTotals(tpsRate, tvqRate);
}

// Mise à jour d'un champ de ligne
function updateInvoiceLine(lineId, field, value) {
  const line = _editingInvoiceLines.find(l => l.id === lineId);
  if (!line) return;
  if (field === "description") line[field] = value;
  else line[field] = Number(value) || 0;
  // Recalcul du total de cette ligne + totaux globaux
  const lineRow = document.querySelector(`.invoice-line[data-line-id="${lineId}"]`);
  if (lineRow) {
    const totalCell = lineRow.querySelector(".inv-line-total");
    if (totalCell) totalCell.textContent = fmtMoney(invoiceLineTotal(line));
  }
  recalcInvoiceTotals();
}

function addInvoiceLine() {
  _editingInvoiceLines.push({
    id: "L" + Math.random().toString(36).slice(2, 9),
    description: "",
    quantity: 1,
    unitPrice: 0
  });
  const container = document.getElementById("inv-lines-container");
  if (container) container.innerHTML = renderInvoiceLines();
  recalcInvoiceTotals();
}

function removeInvoiceLine(lineId) {
  if (_editingInvoiceLines.length <= 1) return;
  _editingInvoiceLines = _editingInvoiceLines.filter(l => l.id !== lineId);
  const container = document.getElementById("inv-lines-container");
  if (container) container.innerHTML = renderInvoiceLines();
  recalcInvoiceTotals();
}

// ═ Save ════════════════════════════════════════════════
async function saveInvoiceFromModal(existingId, fallbackNumber) {
  const clientName = document.getElementById("inv-clientName").value.trim();
  if (!clientName) {
    toast("Le nom du client est obligatoire.", "warning");
    return;
  }
  // Au moins une ligne avec description ET prix > 0
  const validLines = _editingInvoiceLines.filter(l => l.description.trim() && (l.quantity > 0));
  if (validLines.length === 0) {
    toast("Ajoute au moins une ligne avec description et quantité.", "warning");
    return;
  }

  const tpsRate = (Number(document.getElementById("inv-tps").value) || 0) / 100;
  const tvqRate = (Number(document.getElementById("inv-tvq").value) || 0) / 100;
  const newStatus = document.getElementById("inv-status").value;

  const data = {
    invoiceNumber: fallbackNumber,
    clientName,
    clientCompany: document.getElementById("inv-clientCompany").value.trim(),
    clientPhone:   document.getElementById("inv-clientPhone").value.trim(),
    clientEmail:   document.getElementById("inv-clientEmail").value.trim(),
    clientAddress: document.getElementById("inv-clientAddress").value.trim(),
    invoiceDate:   document.getElementById("inv-date").value,
    dueDate:       document.getElementById("inv-dueDate").value,
    lines: _editingInvoiceLines.map(l => ({
      id: l.id,
      description: l.description.trim(),
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0
    })),
    tpsRate,
    tvqRate,
    notes: document.getElementById("inv-notes").value.trim(),
    status: newStatus,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (existingId) {
      // Si on change le statut vers/depuis "payee", il faut synchroniser le revenu lié
      const existing = invoices.find(x => x.id === existingId);
      const wasPaid = existing?.status === "payee";
      const willBePaid = newStatus === "payee";

      await db.collection("invoices").doc(existingId).update(data);

      if (!wasPaid && willBePaid) {
        await createRevenueForInvoice(existingId, data);
      } else if (wasPaid && !willBePaid) {
        await deleteRevenueForInvoice(existingId, existing?.paidRevenueId);
      }

      toast("Facture mise à jour.", "success", 2000);
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = (typeof userRole === "string") ? userRole : "global_admin";
      const ref = await db.collection("invoices").add(data);

      if (newStatus === "payee") {
        await createRevenueForInvoice(ref.id, data);
      }

      toast(`Facture ${fallbackNumber} créée.`, "success", 2500);
    }
    closeModal();
  } catch (err) {
    console.error("saveInvoice failed:", err);
    toast("Erreur sauvegarde : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═ Statuts ═════════════════════════════════════════════
async function changeInvoiceStatus(id, newStatus) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;
  const wasPaid = inv.status === "payee";
  const willBePaid = newStatus === "payee";

  try {
    await db.collection("invoices").doc(id).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...(willBePaid ? { paidAt: firebase.firestore.FieldValue.serverTimestamp() } : {}),
      ...(!willBePaid && wasPaid ? { paidAt: firebase.firestore.FieldValue.delete() } : {})
    });

    if (!wasPaid && willBePaid) {
      await createRevenueForInvoice(id, inv);
      toast(`Facture marquée payée — revenu ajouté à Dépenses & Revenus.`, "success", 3500);
    } else if (wasPaid && !willBePaid) {
      await deleteRevenueForInvoice(id, inv.paidRevenueId);
      toast(`Facture déclassée — revenu lié retiré.`, "success", 3000);
    } else {
      toast(`Statut mis à jour : ${INVOICE_STATUS_LABELS[newStatus]}.`, "success", 2000);
    }
  } catch (err) {
    console.error("changeInvoiceStatus failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═ Duplication ═════════════════════════════════════════
async function duplicateInvoice(id) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;
  try {
    const data = {
      ...inv,
      invoiceNumber: generateInvoiceNumber(),
      invoiceDate: todayISO(),
      dueDate: addDaysISO(todayISO(), 30),
      status: "brouillon",
      paidAt: firebase.firestore.FieldValue.delete(),
      paidRevenueId: firebase.firestore.FieldValue.delete(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    delete data.id;
    await db.collection("invoices").add(data);
    toast("Facture dupliquée en brouillon.", "success", 2500);
  } catch (err) {
    console.error("duplicateInvoice failed:", err);
    toast("Erreur duplication : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═ Suppression ═════════════════════════════════════════
function askDeleteInvoice(id, number) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;
  const warnRevenue = inv.status === "payee" && inv.paidRevenueId
    ? `<p style="color:#a23a36;margin-top:8px;font-size:13px">${icon("alert", 12)} Cette facture est marquée payée. Supprimer la facture supprime aussi le revenu lié dans Dépenses & Revenus.</p>`
    : "";
  showModal(`<div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3>${icon("alert", 18)} Supprimer cette facture ?</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p>Tu vas supprimer définitivement la facture <strong>${esc(number)}</strong>. Cette action est irréversible.</p>
    ${warnRevenue}
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn" style="background:#a23a36;color:#fff" onclick="confirmDeleteInvoice('${id}')">${icon("trash", 14)} Supprimer</button>
    </div>
  </div>`);
}

async function confirmDeleteInvoice(id) {
  const inv = invoices.find(x => x.id === id);
  try {
    if (inv?.status === "payee" && inv?.paidRevenueId) {
      await deleteRevenueForInvoice(id, inv.paidRevenueId);
    }
    await db.collection("invoices").doc(id).delete();
    closeModal();
    toast("Facture supprimée.", "success", 2000);
  } catch (err) {
    console.error("deleteInvoice failed:", err);
    toast("Erreur suppression : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═ Lien avec /revenues ═════════════════════════════════
// Quand une facture passe à « Payée », on crée automatiquement un doc
// dans /revenues avec montants ventilés (subtotal, TPS, TVQ) pour que
// la facturation se reflète dans le module Dépenses & Revenus + le
// dashboard sans double-saisie. L'id du revenu est stocké dans la
// facture (paidRevenueId) pour pouvoir le retrouver / supprimer ensuite.
async function createRevenueForInvoice(invoiceId, invData) {
  const t = invoiceTaxes(invData);
  try {
    const ref = await db.collection("revenues").add({
      description: `Facture ${invData.invoiceNumber} — ${invData.clientName}${invData.clientCompany ? " (" + invData.clientCompany + ")" : ""}`,
      amount: t.sub,
      tps: t.tps,
      tvq: t.tvq,
      date: invData.invoiceDate || todayISO(),
      notes: `Créé automatiquement depuis la facture ${invData.invoiceNumber}. Modifier la facture pour mettre à jour ce revenu.`,
      sourceInvoiceId: invoiceId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Stocke l'id du revenu dans la facture pour pouvoir le retrouver
    await db.collection("invoices").doc(invoiceId).update({ paidRevenueId: ref.id });
  } catch (err) {
    console.error("createRevenueForInvoice failed:", err);
    toast("Facture sauvée mais l'ajout du revenu a échoué : " + (err.message || err.code || err), "warning", 5000);
  }
}

async function deleteRevenueForInvoice(invoiceId, revenueId) {
  if (!revenueId) return;
  try {
    await db.collection("revenues").doc(revenueId).delete();
    await db.collection("invoices").doc(invoiceId).update({
      paidRevenueId: firebase.firestore.FieldValue.delete()
    });
  } catch (err) {
    // Pas grave si le revenu n'existe plus (peut avoir été supprimé manuellement)
    console.warn("deleteRevenueForInvoice:", err);
  }
}

// ═ Génération PDF (jsPDF) ══════════════════════════════
// Design fidèle au pattern Bochica (Soumissions) : en-tête tricolore,
// bloc client + bloc facture côte à côte, tableau lignes, totaux,
// notes, footer. Multi-pages auto si les lignes débordent.
async function generateInvoicePDF(id) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;
  if (typeof window.jspdf?.jsPDF !== "function") {
    toast("La bibliothèque PDF n'est pas chargée.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 × 792 pt
  const W = doc.internal.pageSize.getWidth();
  const M = 40; // marge

  // Couleurs Bochica
  const accent = [247, 179, 44];   // jaune
  const blue   = [74, 144, 226];
  const red    = [231, 76, 60];
  const text   = [14, 13, 12];
  const text2  = [110, 95, 80];

  let y = M;

  // ─ Helper : nouvelle page avec en-tête compact ─
  const newPage = () => {
    doc.addPage();
    y = M;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...text);
    doc.text("BOCHICA", M, y);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text2);
    doc.text(`Facture ${inv.invoiceNumber} · ${inv.clientName}`, W - M, y, { align: "right" });
    y += 6;
    doc.setDrawColor(...accent).setLineWidth(1.5).line(M, y, W - M, y);
    y += 18;
  };

  // ─ En-tête principal ─
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...text);
  doc.text("BOCHICA", W / 2, y, { align: "center" });
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text2);
  doc.text("Restaurant Colombien", W / 2, y, { align: "center" });
  y += 10;
  // Barre tricolore
  const barW = 80;
  const barY = y;
  doc.setFillColor(...accent).rect(W / 2 - barW * 1.5, barY, barW, 3, "F");
  doc.setFillColor(...blue).rect(W / 2 - barW * 0.5, barY, barW, 3, "F");
  doc.setFillColor(...red).rect(W / 2 + barW * 0.5, barY, barW, 3, "F");
  y += 22;

  // Titre Facture
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...text);
  doc.text("FACTURE", W / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...accent);
  doc.text(inv.invoiceNumber || "—", W / 2, y, { align: "center" });
  y += 22;

  // ─ Bloc Client + Bloc Facture (2 colonnes) ─
  const colW = (W - M * 2 - 16) / 2;
  const blockH = 90;
  // Bloc Client (gauche)
  doc.setFillColor(245, 241, 232).rect(M, y, colW, blockH, "F");
  doc.setDrawColor(200, 188, 165).setLineWidth(0.5).rect(M, y, colW, blockH);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...text2);
  doc.text("CLIENT", M + 10, y + 14);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...text);
  doc.text(inv.clientName || "—", M + 10, y + 30);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text);
  let cy = y + 44;
  if (inv.clientCompany) { doc.text(inv.clientCompany, M + 10, cy); cy += 11; }
  if (inv.clientAddress) { doc.text(inv.clientAddress, M + 10, cy, { maxWidth: colW - 20 }); cy += 11; }
  if (inv.clientPhone)   { doc.text(`Tél: ${inv.clientPhone}`, M + 10, cy); cy += 11; }
  if (inv.clientEmail)   { doc.text(`Courriel: ${inv.clientEmail}`, M + 10, cy); }

  // Bloc Facture (droite)
  const cx = M + colW + 16;
  doc.setFillColor(245, 241, 232).rect(cx, y, colW, blockH, "F");
  doc.setDrawColor(200, 188, 165).setLineWidth(0.5).rect(cx, y, colW, blockH);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...text2);
  doc.text("DÉTAILS", cx + 10, y + 14);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...text);
  doc.text(`Date d'émission : ${inv.invoiceDate || "—"}`, cx + 10, y + 32);
  doc.text(`Date d'échéance : ${inv.dueDate || "—"}`,   cx + 10, y + 48);
  doc.text(`Statut : ${INVOICE_STATUS_LABELS[inv.status] || "Brouillon"}`, cx + 10, y + 64);
  y += blockH + 20;

  // ─ Tableau des lignes ─
  const colDescW = W - M * 2 - 70 - 80 - 80;
  // Header
  doc.setFillColor(...text).rect(M, y, W - M * 2, 22, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255);
  doc.text("DESCRIPTION", M + 8, y + 14);
  doc.text("QTÉ",         M + 8 + colDescW, y + 14);
  doc.text("PRIX UNIT.",  M + 8 + colDescW + 70, y + 14);
  doc.text("TOTAL",       W - M - 8, y + 14, { align: "right" });
  y += 22;

  // Lignes
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...text);
  let zebra = false;
  for (const line of (inv.lines || [])) {
    const descLines = doc.splitTextToSize(line.description || "—", colDescW - 8);
    const rowH = Math.max(20, descLines.length * 12 + 8);
    if (y + rowH > 792 - M - 100) {
      newPage();
    }
    if (zebra) {
      doc.setFillColor(248, 244, 235).rect(M, y, W - M * 2, rowH, "F");
    }
    doc.text(descLines, M + 8, y + 13);
    doc.text(String(Number(line.quantity) || 0), M + 8 + colDescW, y + 13);
    doc.text(fmtMoney(Number(line.unitPrice) || 0), M + 8 + colDescW + 70, y + 13);
    doc.setFont("helvetica", "bold");
    doc.text(fmtMoney(invoiceLineTotal(line)), W - M - 8, y + 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += rowH;
    zebra = !zebra;
  }
  y += 14;

  // ─ Totaux ─
  if (y + 100 > 792 - M) newPage();
  const totW = 240;
  const totX = W - M - totW;
  const t2 = invoiceTaxes(inv);
  const totRows = [
    ["Sous-total", fmtMoney(t2.sub)],
    [`TPS (${(inv.tpsRate * 100).toFixed(3).replace(/\.?0+$/, "")}%)`, fmtMoney(t2.tps)],
    [`TVQ (${(inv.tvqRate * 100).toFixed(3).replace(/\.?0+$/, "")}%)`, fmtMoney(t2.tvq)]
  ];
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...text);
  for (const [label, val] of totRows) {
    doc.text(label, totX, y);
    doc.text(val, W - M, y, { align: "right" });
    doc.setDrawColor(220).line(totX, y + 3, W - M, y + 3);
    y += 16;
  }
  // Total final
  doc.setFillColor(...accent).rect(totX - 4, y - 2, totW + 4, 24, "F");
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...text);
  doc.text("TOTAL", totX, y + 14);
  doc.text(fmtMoney(t2.total), W - M, y + 14, { align: "right" });
  y += 32;

  // ─ Notes ─
  if (inv.notes) {
    if (y + 60 > 792 - M) newPage();
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...text2);
    doc.text("NOTES", M, y);
    y += 12;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text);
    const noteLines = doc.splitTextToSize(inv.notes, W - M * 2);
    doc.text(noteLines, M, y);
    y += noteLines.length * 11 + 10;
  }

  // ─ Footer (sur toutes les pages) ─
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...text2).setLineWidth(0.3).line(M, 792 - M - 30, W - M, 792 - M - 30);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...text2);
    doc.text("Bochica Café Bistro · Restaurant Colombien", M, 792 - M - 16);
    doc.text(`Merci de votre confiance — bochicacafebistro@gmail.com`, M, 792 - M - 6);
    if (totalPages > 1) {
      doc.text(`Page ${p} / ${totalPages}`, W - M, 792 - M - 6, { align: "right" });
    }
  }

  // ─ Téléchargement ─
  const safeClient = (inv.clientName || "client").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  doc.save(`Bochica_Facture_${inv.invoiceNumber}_${safeClient}.pdf`);
  toast("PDF téléchargé.", "success", 2000);
}

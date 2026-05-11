// ═══════════════════════════════════════════════════════════════
// SOUMISSIONS — Devis pour clients + génération PDF
// ───────────────────────────────────────────────────────────────
// Page admin pour créer des soumissions basées sur des forfaits
// éditables. Génère un PDF style Bochica (logo + tricolore + cartes
// forfait colorées) reproduisant fidèlement le visuel Menu_Forfaits.
//
// Collections Firestore :
//   - quotes         (soumissions, admin only)
//   - quoteTemplates (forfaits par défaut, admin write + chef read)
// ═══════════════════════════════════════════════════════════════

const QUOTE_STATUSES = ["brouillon", "envoyee", "acceptee", "refusee", "expiree"];
const QUOTE_VENUES = ["bochica", "client", "autre"];
const QUOTE_ACCENT_COLORS = ["yellow", "red", "blue", "green"];

function tQuoteStatus(s) {
  const map = {
    brouillon: "Brouillon",
    envoyee:   "Envoyée",
    acceptee:  "Acceptée",
    refusee:   "Refusée",
    expiree:   "Expirée"
  };
  return map[s] || s || "—";
}

function tQuoteVenue(v) {
  const map = {
    bochica: "Au restaurant Bochica",
    client:  "Chez le client",
    autre:   "Autre lieu"
  };
  return map[v] || v || "—";
}

function quoteAccentHex(c) {
  // Aligné sur le design system Bochica (palette tricolore Colombie + verts)
  const map = {
    yellow: "#F7B32C", // accent Bochica
    red:    "#e74c3c", // rouge Colombie
    blue:   "#4a90e2", // bleu Colombie
    green:  "#7dbf66"
  };
  return map[c] || map.yellow;
}

// ─── Seed des templates par défaut (1er chargement) ───
async function seedQuoteTemplates() {
  if (!isAdmin) return;
  try {
    // Garde-fou : vérifier que la collection est vraiment vide
    const check = await db.collection("quoteTemplates").limit(1).get();
    if (!check.empty) return;
    const batch = db.batch();
    DEFAULT_QUOTE_TEMPLATES.forEach(tpl => {
      const ref = db.collection("quoteTemplates").doc(tpl.id);
      batch.set(ref, { ...tpl, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    console.log("Forfaits par défaut initialisés (2 templates)");
  } catch (err) {
    console.warn("seedQuoteTemplates :", err);
  }
}

// ─── Numéro de soumission ─────────────────────────────
// Format YYYY-NNN — calculé à partir des soumissions existantes de l'année
function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const existing = quotes.filter(q => (q.quoteNumber || "").startsWith(prefix));
  let maxN = 0;
  existing.forEach(q => {
    const m = (q.quoteNumber || "").match(/-(\d+)$/);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10) || 0);
  });
  return `${prefix}${String(maxN + 1).padStart(3, "0")}`;
}

// ─── Calculs ──────────────────────────────────────────
// Retourne { subtotal, beerSubtotal, customSubtotal, preTaxTotal, tps, tvq, total, deposit, balance }
function computeQuoteTotal(quote) {
  const tpl = quote.packageSnapshot || quoteTemplates.find(t => t.id === quote.packageId) || {};
  const guests = Math.max(0, Number(quote.guestCount || 0));
  const pricePer = Number(tpl.pricePerPerson || 0);
  const subtotal = guests * pricePer;
  const beerPrice = Number(tpl.beerPrice || 0);
  const beerSubtotal = quote.beerAddon ? guests * beerPrice : 0;
  const customSubtotal = Array.isArray(quote.customLines)
    ? quote.customLines.reduce((s, l) => s + Number(l.amount || 0), 0)
    : 0;
  const preTaxTotal = subtotal + beerSubtotal + customSubtotal;
  const tps = preTaxTotal * TPS_RATE;
  const tvq = preTaxTotal * TVQ_RATE;
  const total = preTaxTotal + tps + tvq;
  const deposit = Math.max(0, Number(quote.depositAmount || 0));
  const balance = Math.max(0, total - (quote.depositPaid ? deposit : 0));
  return { subtotal, beerSubtotal, customSubtotal, preTaxTotal, tps, tvq, total, deposit, balance };
}

// ─── Setters de filtre ────────────────────────────────
function setQuotesFilter(s) {
  quotesFilterStatus = s;
  renderPage();
}

function updateQuotesSearch(v) {
  quotesSearchQuery = (v || "").toLowerCase();
  const activeId = document.activeElement?.id;
  renderPage();
  requestAnimationFrame(() => {
    if (activeId === "q-search") {
      const el = document.getElementById("q-search");
      if (el) {
        el.focus();
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
      }
    }
  });
}

// ─── Rendu principal : liste des soumissions ──────────
function renderQuotes() {
  const writable = canWrite("soumissions");

  // Compteurs par statut
  const counts = { all: quotes.length };
  QUOTE_STATUSES.forEach(s => {
    counts[s] = quotes.filter(q => q.status === s).length;
  });

  // Filtrage
  const q = (quotesSearchQuery || "").trim();
  let items = quotes.slice();
  if (quotesFilterStatus !== "all") {
    items = items.filter(it => it.status === quotesFilterStatus);
  }
  if (q) {
    items = items.filter(it =>
      (it.quoteNumber || "").toLowerCase().includes(q) ||
      (it.clientName || "").toLowerCase().includes(q) ||
      (it.clientCompany || "").toLowerCase().includes(q) ||
      (it.clientEmail || "").toLowerCase().includes(q) ||
      (it.clientPhone || "").toLowerCase().includes(q)
    );
  }

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">${icon("receipt", 18)} Soumissions</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">Devis clients avec génération PDF · forfaits éditables</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${writable ? `<button class="btn-cancel" onclick="openQuoteTemplatesModal()">${icon("settings", 14)} Gérer les forfaits</button>` : ""}
        ${writable ? `<button class="btn btn-primary" onclick="openQuoteModal()">${icon("plus", 16)} Nouvelle soumission</button>` : ""}
      </div>
    </div>`;

  if (quotes.length === 0) {
    h += `<div class="empty">
      <div class="empty-state-icon">${icon("receipt", 48)}</div>
      Aucune soumission enregistrée.<br/>
      ${writable ? "Cliquez sur « Nouvelle soumission » pour créer votre premier devis." : ""}
    </div>`;
    return h + `</div>`;
  }

  // Onglets statut
  h += `<div class="quote-tabs" role="tablist" aria-label="Filtrer par statut">
    <button class="quote-tab ${quotesFilterStatus === "all" ? "is-active" : ""}" onclick="setQuotesFilter('all')">
      Toutes <span class="quote-tab-count">${counts.all}</span>
    </button>
    ${QUOTE_STATUSES.map(s => `<button class="quote-tab quote-tab--${s} ${quotesFilterStatus === s ? "is-active" : ""}" onclick="setQuotesFilter('${s}')">
      ${tQuoteStatus(s)} <span class="quote-tab-count">${counts[s]}</span>
    </button>`).join("")}
  </div>`;

  // Recherche
  h += `<div class="quote-search-wrap">
    <span class="quote-search-icon">${icon("search", 16)}</span>
    <input id="q-search" type="text" placeholder="Rechercher (n° soumission, client, courriel...)" value="${esc(quotesSearchQuery || "")}" oninput="updateQuotesSearch(this.value)" aria-label="Rechercher une soumission"/>
    ${quotesSearchQuery ? `<button class="quote-search-clear" onclick="updateQuotesSearch('')" aria-label="Effacer">${icon("x", 14)}</button>` : ""}
  </div>`;

  if (items.length === 0) {
    h += `<div class="empty" style="margin-top:16px">
      <div class="empty-state-icon">${icon("search", 36)}</div>
      Aucun résultat pour ces filtres.
    </div></div>`;
    return h;
  }

  h += renderQuoteCards(items, writable);
  return h + `</div>`;
}

function renderQuoteCards(items, writable) {
  let h = `<div class="quote-list">`;
  items.forEach(qt => {
    const totals = computeQuoteTotal(qt);
    const status = qt.status || "brouillon";
    const tpl = qt.packageSnapshot || quoteTemplates.find(t => t.id === qt.packageId);
    const tplName = tpl ? `${tpl.label || ""} · ${tpl.name || ""}`.trim().replace(/^·\s*/, "") : "—";

    h += `<article class="quote-card quote-card--${status}">
      <div class="quote-card__head">
        <div class="quote-card__num-block">
          <span class="quote-card__num">${esc(qt.quoteNumber || "—")}</span>
          <span class="quote-status-pill quote-status-pill--${status}">${tQuoteStatus(status)}</span>
        </div>
        <div class="quote-card__total">${fmtMoney(totals.total)}</div>
      </div>
      <div class="quote-card__body">
        <div class="quote-card__client">
          <strong>${esc(qt.clientName || "Client sans nom")}</strong>
          ${qt.clientCompany ? `<span class="quote-card__company">${esc(qt.clientCompany)}</span>` : ""}
        </div>
        <div class="quote-card__meta">
          ${qt.eventDate ? `<span class="quote-card__meta-item">${icon("calendar", 12)} ${esc(qt.eventDate)}${qt.eventTime ? " · " + esc(qt.eventTime) : ""}</span>` : ""}
          ${qt.guestCount ? `<span class="quote-card__meta-item">${icon("users", 12)} ${esc(String(qt.guestCount))} pers.</span>` : ""}
          ${tplName !== "—" ? `<span class="quote-card__meta-item">${icon("utensils", 12)} ${esc(tplName)}</span>` : ""}
          ${qt.eventVenue ? `<span class="quote-card__meta-item">${icon("map-pin", 12)} ${esc(tQuoteVenue(qt.eventVenue))}</span>` : ""}
        </div>
        ${qt.validUntil ? `<div class="quote-card__validity">Valide jusqu'au ${esc(qt.validUntil)}</div>` : ""}
      </div>
      <div class="quote-card__actions">
        <button class="btn-icon-only" onclick="generateQuotePDF('${qt.id}')" aria-label="Générer le PDF" title="Générer le PDF">${icon("download", 14)}</button>
        ${writable ? `<div class="menu-wrap">
          <button class="dots-btn" onclick="toggleDrop('q${qt.id}')" aria-label="Actions">${icon("more-vertical", 16)}</button>
          <div class="dropdown" id="drop-q${qt.id}">
            <button onclick="openQuoteModal('${qt.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
            <button onclick="generateQuotePDF('${qt.id}');closeAllDrops()">${icon("download", 14)} Télécharger PDF</button>
            <button onclick="duplicateItem('quotes','${qt.id}','clientName');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
            <div class="sep"></div>
            <button onclick="changeQuoteStatus('${qt.id}','envoyee');closeAllDrops()">${icon("upload", 14)} Marquer envoyée</button>
            <button onclick="changeQuoteStatus('${qt.id}','acceptee');closeAllDrops()">${icon("check-circle", 14)} Marquer acceptée</button>
            <button onclick="changeQuoteStatus('${qt.id}','refusee');closeAllDrops()">${icon("x-circle", 14)} Marquer refusée</button>
            <div class="sep"></div>
            <button class="text-danger" onclick="askDelete('quotes','${qt.id}','${esc(qt.quoteNumber || "soumission")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
          </div>
        </div>` : ""}
      </div>
    </article>`;
  });
  h += `</div>`;
  return h;
}

// ─── Changement de statut rapide ──────────────────────
async function changeQuoteStatus(id, newStatus) {
  if (!QUOTE_STATUSES.includes(newStatus)) return;
  try {
    await db.collection("quotes").doc(id).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const q = quotes.find(x => x.id === id);
    await addLog(q?.quoteNumber || id, `Soumission — ${tQuoteStatus(newStatus)}`, q?.clientName || "");
    toast(`Statut mis à jour : ${tQuoteStatus(newStatus)}`, "success");
  } catch (err) {
    console.error("changeQuoteStatus:", err);
    toast("Erreur : " + (err.message || err), "error");
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL — Création / édition d'une soumission
// ═══════════════════════════════════════════════════════════════

function openQuoteModal(id) {
  const qt = id ? quotes.find(x => x.id === id) : null;
  // Si aucun template en base : message d'erreur
  if (!qt && quoteTemplates.length === 0) {
    toast("Aucun forfait disponible. Cliquez sur « Gérer les forfaits » pour en créer.", "warning");
    return;
  }

  const today = (typeof todayISO === "function" ? todayISO() : new Date().toISOString().slice(0, 10));
  const defaultValid = new Date();
  defaultValid.setDate(defaultValid.getDate() + 30);
  const defaultValidIso = defaultValid.toISOString().slice(0, 10);

  const defaultPackageId = qt?.packageId || quoteTemplates[0]?.id || "";
  const customLines = Array.isArray(qt?.customLines) ? qt.customLines.slice() : [];

  showModal(`<div class="modal modal-quote">
    <div class="modal-header">
      <h3>${qt ? `Modifier la soumission ${esc(qt.quoteNumber || "")}` : "Nouvelle soumission"}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <!-- Bloc CLIENT -->
    <h4 class="quote-modal-section">${icon("user", 14)} Client</h4>
    <label>Nom du client <input id="q-client-name" value="${esc(qt?.clientName || "")}" placeholder="ex: Marie Tremblay"/></label>
    <label>Entreprise (optionnel) <input id="q-client-company" value="${esc(qt?.clientCompany || "")}" placeholder="ex: Cabinet Dupont inc."/></label>
    <div class="form-row">
      <label>Téléphone <input id="q-client-phone" type="tel" value="${esc(qt?.clientPhone || "")}" placeholder="514-555-1234"/></label>
      <label>Courriel <input id="q-client-email" type="email" value="${esc(qt?.clientEmail || "")}" placeholder="client@exemple.ca"/></label>
    </div>

    <!-- Bloc ÉVÉNEMENT -->
    <h4 class="quote-modal-section">${icon("calendar", 14)} Événement</h4>
    <div class="form-row">
      <label>Date <input id="q-event-date" type="date" value="${esc(qt?.eventDate || "")}"/></label>
      <label>Heure (optionnel) <input id="q-event-time" type="time" value="${esc(qt?.eventTime || "")}"/></label>
    </div>
    <div class="form-row">
      <label>Lieu
        <select id="q-event-venue">
          ${QUOTE_VENUES.map(v => `<option value="${v}" ${(qt?.eventVenue || "bochica") === v ? "selected" : ""}>${tQuoteVenue(v)}</option>`).join("")}
        </select>
      </label>
      <label>Nombre de personnes <input id="q-guest-count" type="number" min="1" step="1" value="${esc(qt?.guestCount != null ? String(qt.guestCount) : "")}" placeholder="ex: 25"/></label>
    </div>
    <label>Adresse / précisions sur le lieu <input id="q-event-address" value="${esc(qt?.eventAddress || "")}" placeholder="ex: 123 rue Principale, Montréal"/></label>

    <!-- Bloc FORFAIT -->
    <h4 class="quote-modal-section">${icon("utensils", 14)} Forfait</h4>
    <div class="quote-package-choices">
      ${quoteTemplates.map(tpl => `<label class="quote-package-card quote-package-card--${tpl.accentColor || "yellow"}">
        <input type="radio" name="q-package" value="${esc(tpl.id)}" ${tpl.id === defaultPackageId ? "checked" : ""}/>
        <div class="quote-package-card__body">
          <div class="quote-package-card__label">${esc(tpl.label || "")}</div>
          <div class="quote-package-card__name">${esc(tpl.name || "")}</div>
          <div class="quote-package-card__price">${fmtMoney(tpl.pricePerPerson || 0)} / pers.</div>
          <div class="quote-package-card__details">
            <div><strong>Entrée :</strong> ${esc(tpl.entree || "—")}</div>
            <div><strong>Plat :</strong> ${esc(tpl.plat || "—")}</div>
            <div><strong>Boisson :</strong> ${esc(tpl.boisson || "—")}</div>
          </div>
        </div>
      </label>`).join("")}
    </div>
    <label class="quote-beer-toggle">
      <input type="checkbox" id="q-beer-addon" ${qt?.beerAddon ? "checked" : ""}/>
      <span>🍺 Ajout d'une bière par personne (+${fmtMoney(quoteTemplates[0]?.beerPrice || 7)} / pers.)</span>
    </label>

    <!-- Bloc LIGNES PERSONNALISÉES -->
    <h4 class="quote-modal-section">${icon("plus", 14)} Suppléments / rabais</h4>
    <div id="q-custom-lines">
      ${renderCustomLinesInputs(customLines)}
    </div>
    <button type="button" class="btn-cancel" onclick="addCustomLineInput()" style="margin-top:8px">
      ${icon("plus", 12)} Ajouter une ligne
    </button>

    <!-- Bloc PAIEMENT -->
    <h4 class="quote-modal-section">${icon("dollar-sign", 14)} Dépôt</h4>
    <div class="form-row">
      <label>Montant dépôt exigé ($) <input id="q-deposit" type="number" min="0" step="0.01" value="${esc(qt?.depositAmount != null ? String(qt.depositAmount) : "")}" placeholder="ex: 250.00"/></label>
      <div style="display:flex;flex-direction:column;justify-content:flex-end">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:8px 0">
          <input type="checkbox" id="q-deposit-paid" ${qt?.depositPaid ? "checked" : ""}/>
          <span>Dépôt déjà versé</span>
        </label>
      </div>
    </div>

    <!-- Bloc VALIDITÉ + NOTES -->
    <div class="form-row">
      <label>Valide jusqu'au <input id="q-valid-until" type="date" value="${esc(qt?.validUntil || defaultValidIso)}"/></label>
      <label>Statut
        <select id="q-status">
          ${QUOTE_STATUSES.map(s => `<option value="${s}" ${(qt?.status || "brouillon") === s ? "selected" : ""}>${tQuoteStatus(s)}</option>`).join("")}
        </select>
      </label>
    </div>

    <label>Notes / conditions <textarea id="q-notes" style="height:80px" placeholder="Allergies, demandes particulières, conditions de paiement, etc.">${esc(qt?.notes || "")}</textarea></label>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      ${qt ? `<button class="btn-cancel" onclick="generateQuotePDF('${qt.id}')">${icon("download", 14)} PDF</button>` : ""}
      <button class="btn btn-primary" onclick="saveQuote('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);

  setTimeout(() => {
    const el = document.getElementById("q-client-name");
    if (el) { el.focus(); if (typeof el.select === "function") el.select(); }
  }, 50);
}

// ─── Lignes personnalisées (ajout dynamique) ──────────
function renderCustomLinesInputs(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return `<div class="quote-custom-empty text-muted" style="font-size:12px">Aucun supplément. Cliquez sur « Ajouter une ligne » pour en créer.</div>`;
  }
  return lines.map((l, i) => `<div class="quote-custom-line" data-idx="${i}">
    <input type="text" class="quote-custom-desc" value="${esc(l.description || "")}" placeholder="ex: Décor spécial, Service après minuit, Rabais 10%..." />
    <input type="number" step="0.01" class="quote-custom-amount" value="${esc(l.amount != null ? String(l.amount) : "")}" placeholder="0.00" />
    <button type="button" class="btn-icon-only" onclick="removeCustomLineInput(${i})" aria-label="Retirer">${icon("trash", 14)}</button>
  </div>`).join("");
}

function readCustomLinesFromDOM() {
  const container = document.getElementById("q-custom-lines");
  if (!container) return [];
  const rows = container.querySelectorAll(".quote-custom-line");
  const lines = [];
  rows.forEach(row => {
    const desc = row.querySelector(".quote-custom-desc").value.trim();
    const amt = row.querySelector(".quote-custom-amount").value;
    if (desc || amt) lines.push({ description: desc, amount: Number(amt) || 0 });
  });
  return lines;
}

function addCustomLineInput() {
  const lines = readCustomLinesFromDOM();
  lines.push({ description: "", amount: 0 });
  document.getElementById("q-custom-lines").innerHTML = renderCustomLinesInputs(lines);
}

function removeCustomLineInput(idx) {
  const lines = readCustomLinesFromDOM();
  lines.splice(idx, 1);
  document.getElementById("q-custom-lines").innerHTML = renderCustomLinesInputs(lines);
}

// ─── Sauvegarde soumission ────────────────────────────
async function saveQuote(id) {
  const name = document.getElementById("q-client-name").value.trim();
  if (!name) return toast("Veuillez saisir le nom du client.", "error");
  const packageId = document.querySelector("input[name='q-package']:checked")?.value;
  if (!packageId) return toast("Veuillez sélectionner un forfait.", "error");
  const tpl = quoteTemplates.find(x => x.id === packageId);
  if (!tpl) return toast("Forfait introuvable.", "error");

  const guestCount = Math.max(0, Math.floor(Number(document.getElementById("q-guest-count").value) || 0));
  const depositAmount = Math.max(0, Number(document.getElementById("q-deposit").value) || 0);

  // Snapshot du forfait au moment du devis (pour ne pas casser les anciens
  // PDFs si on modifie un template par la suite)
  const packageSnapshot = {
    id: tpl.id,
    name: tpl.name,
    label: tpl.label,
    pricePerPerson: Number(tpl.pricePerPerson || 0),
    accentColor: tpl.accentColor || "yellow",
    entree: tpl.entree || "",
    plat: tpl.plat || "",
    boisson: tpl.boisson || "",
    beerPrice: Number(tpl.beerPrice || 0)
  };

  const data = {
    clientName: name,
    clientCompany: document.getElementById("q-client-company").value.trim(),
    clientPhone:   document.getElementById("q-client-phone").value.trim(),
    clientEmail:   document.getElementById("q-client-email").value.trim(),
    eventDate:    document.getElementById("q-event-date").value || "",
    eventTime:    document.getElementById("q-event-time").value || "",
    eventVenue:   document.getElementById("q-event-venue").value,
    eventAddress: document.getElementById("q-event-address").value.trim(),
    guestCount,
    packageId,
    packageSnapshot,
    beerAddon: document.getElementById("q-beer-addon").checked,
    customLines: readCustomLinesFromDOM(),
    depositAmount,
    depositPaid:    document.getElementById("q-deposit-paid").checked,
    validUntil: document.getElementById("q-valid-until").value || "",
    notes:      document.getElementById("q-notes").value.trim(),
    status:     document.getElementById("q-status").value,
    updatedAt:  firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (id) {
      await db.collection("quotes").doc(id).update(data);
      const q = quotes.find(x => x.id === id);
      await addLog(q?.quoteNumber || id, "Soumission — modifiée", `${name} · ${packageSnapshot.name}`);
      toast("Soumission modifiée.", "success");
    } else {
      const nid = genId();
      const quoteNumber = generateQuoteNumber();
      await db.collection("quotes").doc(nid).set({
        ...data,
        id: nid,
        quoteNumber,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: loggedInUser?.name || "Admin"
      });
      await addLog(quoteNumber, "Soumission — créée", `${name} · ${packageSnapshot.name}`);
      toast(`Soumission ${quoteNumber} créée.`, "success");
    }
    closeModal();
  } catch (err) {
    console.error("saveQuote:", err);
    toast("Erreur sauvegarde : " + (err.message || err), "error");
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL — Gestion des forfaits (templates)
// ═══════════════════════════════════════════════════════════════

function openQuoteTemplatesModal() {
  if (!canWrite("soumissions")) return;
  const sorted = [...quoteTemplates].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  showModal(`<div class="modal modal-quote-templates">
    <div class="modal-header">
      <h3>${icon("settings", 18)} Gérer les forfaits</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p class="text-muted" style="font-size:12px;margin-bottom:12px">Modifiez les prix et le contenu des forfaits. Les soumissions existantes conservent une copie figée du forfait au moment de leur création (pas d'impact rétroactif).</p>

    <div id="q-templates-list">
      ${sorted.length === 0
        ? `<div class="text-muted" style="font-size:13px;padding:12px">Aucun forfait. Cliquez sur « Ajouter un forfait » pour commencer.</div>`
        : sorted.map(tpl => renderTemplateEditor(tpl)).join("")}
    </div>

    <button type="button" class="btn-cancel" onclick="addNewTemplate()" style="margin-top:12px;width:100%">
      ${icon("plus", 14)} Ajouter un forfait
    </button>

    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal()">${icon("check", 14)} Terminé</button>
    </div>
  </div>`);
}

function renderTemplateEditor(tpl) {
  return `<div class="quote-tpl-editor quote-tpl-editor--${tpl.accentColor || "yellow"}" data-tpl-id="${esc(tpl.id)}">
    <div class="quote-tpl-editor__head">
      <input class="quote-tpl-label" data-field="label" value="${esc(tpl.label || "")}" placeholder="Forfait Un" aria-label="Étiquette"/>
      <input class="quote-tpl-name" data-field="name" value="${esc(tpl.name || "")}" placeholder="L'Essentiel" aria-label="Nom du forfait"/>
      <button class="btn-icon-only text-danger" onclick="deleteTemplate('${esc(tpl.id)}')" aria-label="Supprimer le forfait" title="Supprimer">${icon("trash", 14)}</button>
    </div>
    <div class="form-row" style="margin-top:8px">
      <label>Prix / personne ($)
        <input type="number" min="0" step="0.01" data-field="pricePerPerson" value="${esc(String(tpl.pricePerPerson || 0))}"/>
      </label>
      <label>Couleur d'accent
        <select data-field="accentColor">
          ${QUOTE_ACCENT_COLORS.map(c => `<option value="${c}" ${(tpl.accentColor || "yellow") === c ? "selected" : ""}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join("")}
        </select>
      </label>
    </div>
    <label>Entrée <input data-field="entree" value="${esc(tpl.entree || "")}" placeholder="ex: 1 empanada au bœuf ou au poulet par personne"/></label>
    <label>Plat principal <input data-field="plat" value="${esc(tpl.plat || "")}" placeholder="ex: Arepa classique ou végé"/></label>
    <label>Boisson <input data-field="boisson" value="${esc(tpl.boisson || "")}" placeholder="ex: Une boisson gazeuse colombienne ou autre"/></label>
    <label>Prix bière en sus ($) <input type="number" min="0" step="0.01" data-field="beerPrice" value="${esc(String(tpl.beerPrice || 0))}"/></label>
    <div style="display:flex;justify-content:flex-end;margin-top:8px">
      <button class="btn btn-primary btn-sm" onclick="saveTemplate('${esc(tpl.id)}')">${icon("save", 12)} Enregistrer ce forfait</button>
    </div>
  </div>`;
}

function addNewTemplate() {
  const nid = "tpl-" + genId();
  const tmpTpl = {
    id: nid,
    name: "",
    label: "Forfait",
    pricePerPerson: 0,
    accentColor: "yellow",
    entree: "",
    plat: "",
    boisson: "",
    beerPrice: 7,
    sortOrder: quoteTemplates.length
  };
  // Ajout direct en BD pour simplicité (le listener re-render via openQuoteTemplatesModal)
  db.collection("quoteTemplates").doc(nid).set({
    ...tmpTpl,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    toast("Nouveau forfait créé. Remplissez les champs et sauvegardez.", "info");
    setTimeout(() => openQuoteTemplatesModal(), 300);
  }).catch(err => {
    console.error("addNewTemplate:", err);
    toast("Erreur : " + (err.message || err), "error");
  });
}

async function saveTemplate(id) {
  const card = document.querySelector(`[data-tpl-id="${id}"]`);
  if (!card) return;
  const data = {};
  card.querySelectorAll("[data-field]").forEach(el => {
    const field = el.getAttribute("data-field");
    let v = el.value;
    if (["pricePerPerson", "beerPrice"].includes(field)) v = Math.max(0, Number(v) || 0);
    data[field] = v;
  });
  try {
    await db.collection("quoteTemplates").doc(id).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast(`Forfait « ${data.name || id} » sauvegardé.`, "success");
  } catch (err) {
    console.error("saveTemplate:", err);
    toast("Erreur : " + (err.message || err), "error");
  }
}

function deleteTemplate(id) {
  const tpl = quoteTemplates.find(t => t.id === id);
  const name = tpl?.name || id;
  // Avertir si des soumissions utilisent ce forfait
  const usedBy = quotes.filter(q => q.packageId === id).length;
  const warning = usedBy > 0
    ? ` ${usedBy} soumission(s) utilisent ce forfait — elles conserveront leur copie figée.`
    : "";
  if (!confirm(`Supprimer le forfait « ${name} » ?${warning}`)) return;
  db.collection("quoteTemplates").doc(id).delete().then(() => {
    toast(`Forfait « ${name} » supprimé.`, "success");
    setTimeout(() => openQuoteTemplatesModal(), 200);
  }).catch(err => {
    console.error("deleteTemplate:", err);
    toast("Erreur : " + (err.message || err), "error");
  });
}

// ═══════════════════════════════════════════════════════════════
// GÉNÉRATION PDF — Style Bochica (cf. Menu_Forfaits.pdf)
// ═══════════════════════════════════════════════════════════════
// On utilise jsPDF (chargé via CDN dans index.html). Format Letter
// portrait 8.5" × 11" = 215.9 × 279.4 mm. Couleurs alignées sur le
// design system Bochica (crème + tricolore + accent jaune).

function generateQuotePDF(quoteId) {
  const qt = quotes.find(x => x.id === quoteId);
  if (!qt) { toast("Soumission introuvable.", "error"); return; }
  if (typeof window.jspdf === "undefined") {
    toast("La bibliothèque PDF n'est pas chargée. Rechargez la page.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  // Dimensions Letter portrait (mm)
  const W = 215.9, H = 279.4;
  const M = 18;       // marge latérale
  const contentW = W - 2 * M;

  // ─── Palette (RGB) ───────────────────────────
  const COLOR_CREAM       = [253, 246, 231];  // fond
  const COLOR_TEXT        = [14, 13, 12];     // noir chaud
  const COLOR_TEXT_LIGHT  = [110, 95, 80];    // gris-brun
  const COLOR_ACCENT      = [247, 179, 44];   // jaune
  const COLOR_BLUE        = [74, 144, 226];   // bleu Colombie
  const COLOR_RED         = [231, 76, 60];    // rouge Colombie
  const COLOR_GREEN       = [125, 191, 102];

  const accentByColor = {
    yellow: COLOR_ACCENT,
    red:    COLOR_RED,
    blue:   COLOR_BLUE,
    green:  COLOR_GREEN
  };
  const cardFillByColor = {
    yellow: [254, 242, 212],
    red:    [252, 230, 226],
    blue:   [226, 238, 252],
    green:  [232, 244, 224]
  };

  // ─── Fond crème pleine page ────────────────
  doc.setFillColor(...COLOR_CREAM);
  doc.rect(0, 0, W, H, "F");

  // ═══ EN-TÊTE — Logo BOCHICA + tricolore ═══
  let y = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...COLOR_TEXT);
  doc.text("BOCHICA", W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text("Restaurant Colombien", W / 2, y, { align: "center" });

  // Tricolore (jaune / bleu / rouge) sous le sous-titre
  y += 3;
  const triW = 56;
  const triX0 = (W - triW) / 2;
  const triH = 1.4;
  doc.setFillColor(...COLOR_ACCENT);
  doc.rect(triX0, y, triW / 3, triH, "F");
  doc.setFillColor(...COLOR_BLUE);
  doc.rect(triX0 + triW / 3, y, triW / 3, triH, "F");
  doc.setFillColor(...COLOR_RED);
  doc.rect(triX0 + 2 * triW / 3, y, triW / 3, triH, "F");
  y += 12;

  // ═══ Titre SOUMISSION ═══
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...COLOR_TEXT);
  doc.text("Soumission", W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text(`N° ${qt.quoteNumber || "—"}`, W / 2, y, { align: "center" });
  y += 10;

  // ═══ Bloc CLIENT + ÉVÉNEMENT (2 colonnes) ═══
  const colW = (contentW - 6) / 2;

  // Helper : encadré info
  function infoBox(x, yStart, w, title, lines) {
    let yy = yStart;
    doc.setFillColor(...cardFillByColor.yellow);
    doc.roundedRect(x, yy, w, 4 + 4.5 * (lines.length + 1) + 2, 2, 2, "F");
    yy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(title.toUpperCase(), x + 4, yy);
    yy += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_TEXT);
    lines.forEach(line => {
      if (!line) return;
      doc.text(String(line), x + 4, yy);
      yy += 4.5;
    });
    return yy;
  }

  const clientLines = [
    qt.clientName || "—",
    qt.clientCompany || "",
    qt.clientPhone ? `Tél : ${qt.clientPhone}` : "",
    qt.clientEmail ? `Courriel : ${qt.clientEmail}` : ""
  ].filter(Boolean);

  const venueLabel = tQuoteVenue(qt.eventVenue || "bochica");
  const eventLines = [
    qt.eventDate ? `Date : ${qt.eventDate}${qt.eventTime ? " · " + qt.eventTime : ""}` : "",
    `Lieu : ${venueLabel}`,
    qt.eventAddress || "",
    qt.guestCount ? `Nombre de personnes : ${qt.guestCount}` : ""
  ].filter(Boolean);

  const yAfterClient = infoBox(M, y, colW, "Client", clientLines);
  const yAfterEvent  = infoBox(M + colW + 6, y, colW, "Événement", eventLines);
  y = Math.max(yAfterClient, yAfterEvent) + 8;

  // ═══ Carte FORFAIT choisi (style Menu_Forfaits.pdf) ═══
  const tpl = qt.packageSnapshot || quoteTemplates.find(t => t.id === qt.packageId) || {};
  const accent = accentByColor[tpl.accentColor || "yellow"];
  const cardFill = cardFillByColor[tpl.accentColor || "yellow"];

  const cardX = M;
  const cardY = y;
  const cardH = 60;

  doc.setFillColor(...cardFill);
  doc.roundedRect(cardX, cardY, contentW, cardH, 3, 3, "F");
  // Barre latérale colorée gauche
  doc.setFillColor(...accent);
  doc.roundedRect(cardX, cardY, 3, cardH, 1.5, 1.5, "F");
  doc.rect(cardX, cardY, 3, cardH, "F"); // assurer le rendu plein

  // Texte du forfait
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text((tpl.label || "FORFAIT").toUpperCase(), cardX + 9, cardY + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(tpl.name || "—", cardX + 9, cardY + 18);

  // Prix par personne — à droite
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_RED);
  doc.text(`${fmtMoney(tpl.pricePerPerson || 0).replace(" $", "")} $`, cardX + contentW - 6, cardY + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text("PAR PERSONNE", cardX + contentW - 6, cardY + 20, { align: "right" });

  // Séparateur pointillé
  doc.setDrawColor(...COLOR_TEXT_LIGHT);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(cardX + 9, cardY + 24, cardX + contentW - 6, cardY + 24);
  doc.setLineDashPattern([], 0);

  // 3 lignes : Entrée / Plat / Boisson (bullets bleus)
  const items = [
    ["ENTRÉE", tpl.entree],
    ["PLAT PRINCIPAL", tpl.plat],
    ["BOISSON", tpl.boisson]
  ];
  let itemY = cardY + 30;
  items.forEach(([label, content]) => {
    doc.setFillColor(...COLOR_BLUE);
    doc.circle(cardX + 11, itemY - 0.8, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_BLUE);
    doc.text(label, cardX + 15, itemY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(content || "—", cardX + 15, itemY + 4);
    itemY += 10;
  });
  y = cardY + cardH + 6;

  // ═══ Add-on bière (si activé) ═══
  if (qt.beerAddon) {
    const beerH = 11;
    doc.setFillColor(...COLOR_ACCENT);
    doc.roundedRect(M, y, contentW, beerH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(`🍺 Ajout d'une bière par personne`, M + 4, y + 7);
    doc.setTextColor(...COLOR_RED);
    doc.setFontSize(11);
    doc.text(`+ ${fmtMoney(tpl.beerPrice || 0).replace(" $", "")} $ / pers.`, M + contentW - 4, y + 7, { align: "right" });
    y += beerH + 4;
  }

  // ═══ Lignes personnalisées ═══
  if (Array.isArray(qt.customLines) && qt.customLines.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("Suppléments et ajustements", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    qt.customLines.forEach(line => {
      doc.setTextColor(...COLOR_TEXT);
      doc.text(line.description || "—", M, y + 4);
      const amt = Number(line.amount || 0);
      doc.setTextColor(amt < 0 ? COLOR_GREEN[0] : COLOR_TEXT[0], amt < 0 ? COLOR_GREEN[1] : COLOR_TEXT[1], amt < 0 ? COLOR_GREEN[2] : COLOR_TEXT[2]);
      doc.text(`${amt >= 0 ? "+" : ""}${fmtMoney(amt).replace(" $", "")} $`, M + contentW, y + 4, { align: "right" });
      y += 5;
    });
    y += 4;
  }

  // ═══ Totaux ═══
  const totals = computeQuoteTotal(qt);
  doc.setDrawColor(...COLOR_TEXT_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + contentW, y);
  y += 5;

  function totalLine(label, value, bold) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(bold ? COLOR_TEXT : COLOR_TEXT_LIGHT));
    doc.text(label, M + contentW * 0.55, y, { align: "right" });
    doc.setTextColor(...COLOR_TEXT);
    doc.text(value, M + contentW, y, { align: "right" });
    y += bold ? 7 : 5;
  }

  totalLine(`Forfait (${qt.guestCount || 0} × ${fmtMoney(tpl.pricePerPerson || 0)})`, fmtMoney(totals.subtotal));
  if (totals.beerSubtotal > 0) {
    totalLine(`Bière (${qt.guestCount || 0} × ${fmtMoney(tpl.beerPrice || 0)})`, fmtMoney(totals.beerSubtotal));
  }
  if (totals.customSubtotal !== 0) {
    totalLine("Suppléments", fmtMoney(totals.customSubtotal));
  }
  totalLine("Sous-total", fmtMoney(totals.preTaxTotal));
  totalLine(`TPS (${(TPS_RATE * 100).toFixed(0)} %)`, fmtMoney(totals.tps));
  totalLine(`TVQ (${(TVQ_RATE * 100).toFixed(3)} %)`, fmtMoney(totals.tvq));
  y += 1;
  totalLine("TOTAL", fmtMoney(totals.total), true);
  if (totals.deposit > 0) {
    totalLine(`Dépôt ${qt.depositPaid ? "(versé)" : "exigé"}`, fmtMoney(totals.deposit));
    totalLine("Solde à payer", fmtMoney(totals.balance), true);
  }
  y += 4;

  // ═══ Notes ═══
  if (qt.notes && qt.notes.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("Notes et conditions :", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    const split = doc.splitTextToSize(qt.notes, contentW);
    doc.text(split, M, y);
    y += split.length * 4 + 4;
  }

  // ═══ Validité (footer) ═══
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  const footerY = H - 16;
  if (qt.validUntil) {
    doc.text(`Soumission valide jusqu'au ${qt.validUntil}`, W / 2, footerY, { align: "center" });
  }
  doc.text("Les prix indiqués incluent les taxes applicables (TPS 5 % + TVQ 9,975 %).", W / 2, footerY + 5, { align: "center" });

  // Téléchargement
  const filename = `Bochica_Soumission_${qt.quoteNumber || "draft"}_${(qt.clientName || "client").replace(/[^a-z0-9]/gi, "_")}.pdf`;
  doc.save(filename);
  toast("PDF généré et téléchargé.", "success");
}

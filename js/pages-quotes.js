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

// Nettoie les apostrophes échappées par esc() — utilisé pour l'affichage PDF
// et les sauvegardes (esc() ajoute "\'" pour les onclick, ce qui pollue les valeurs)
function pdfStr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\\'/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

// Échappement HTML correct pour les attributs value/placeholder — contrairement
// à esc() qui utilise \\' (correct pour les onclick mais visible dans les inputs).
// Utilisé exclusivement pour les valeurs d'inputs dans les modales soumission/forfaits.
function attrEsc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── QR code (utilise qrcode-generator chargé via CDN) ─────────
// Dessine un QR vectoriel directement sur le PDF (chaque module = un petit
// rectangle noir). Pas de raster → rendu parfait à l'impression.
// Retourne true si succès, false si la lib n'est pas chargée.
function drawQRCode(doc, text, x, y, sizeMm) {
  if (typeof qrcode === "undefined") {
    console.warn("Lib qrcode-generator non chargée — QR code omis");
    return false;
  }
  try {
    // typeNumber 0 = auto (détermine la taille selon la quantité de données)
    // errorCorrectLevel 'M' = ~15 % de redondance (bon compromis taille/robustesse)
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const moduleCount = qr.getModuleCount();
    const dot = sizeMm / moduleCount;
    // Fond blanc (pour bien lire au-dessus du fond crème)
    doc.setFillColor(255, 255, 255);
    doc.rect(x - 1, y - 1, sizeMm + 2, sizeMm + 2, "F");
    // Modules noirs
    doc.setFillColor(14, 13, 12);
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.isDark(r, c)) {
          doc.rect(x + c * dot, y + r * dot, dot, dot, "F");
        }
      }
    }
    return true;
  } catch (err) {
    console.warn("Erreur génération QR :", err);
    return false;
  }
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

// ─── Normalisation rétrocompat ────────────────────────
// Retourne TOUJOURS un array d'options de forfait, peu importe le format
// du quote en BD (nouveau format `packageOptions[]` ou ancien format à plat
// avec packageId / packageSnapshot / beerAddon / customLines / depositAmount).
function getQuoteOptions(quote) {
  if (Array.isArray(quote?.packageOptions) && quote.packageOptions.length > 0) {
    return quote.packageOptions.map((opt, i) => ({
      id: opt.id || `opt-${i}`,
      packageId: opt.packageId,
      packageSnapshot: opt.packageSnapshot || null,
      beerAddon: !!opt.beerAddon,
      dessertAddon: !!opt.dessertAddon,
      customLines: Array.isArray(opt.customLines) ? opt.customLines : [],
      depositAmount: Math.max(0, Number(opt.depositAmount || 0)),
      depositPaid: !!opt.depositPaid
    }));
  }
  // Rétrocompat : ancienne soumission single-forfait
  if (quote?.packageId || quote?.packageSnapshot) {
    return [{
      id: "legacy",
      packageId: quote.packageId,
      packageSnapshot: quote.packageSnapshot || null,
      beerAddon: !!quote.beerAddon,
      dessertAddon: !!quote.dessertAddon,
      customLines: Array.isArray(quote.customLines) ? quote.customLines : [],
      depositAmount: Math.max(0, Number(quote.depositAmount || 0)),
      depositPaid: !!quote.depositPaid
    }];
  }
  return [];
}

// ─── Calculs ──────────────────────────────────────────
// Calcule les totaux pour UNE option (forfait + bière + custom + taxes + dépôt).
// guestCount est commun à toutes les options d'une soumission.
// Retourne { subtotal, beerSubtotal, customSubtotal, preTaxTotal, tps, tvq, total, deposit, balance }
function computeQuoteOptionTotal(opt, guestCount) {
  const tpl = opt.packageSnapshot || quoteTemplates.find(t => t.id === opt.packageId) || {};
  const guests = Math.max(0, Number(guestCount || 0));
  const pricePer = Number(tpl.pricePerPerson || 0);
  const subtotal = guests * pricePer;
  const beerPrice = Number(tpl.beerPrice || 0);
  const beerSubtotal = opt.beerAddon ? guests * beerPrice : 0;
  const dessertPrice = Number(tpl.dessertPrice || 0);
  const dessertSubtotal = opt.dessertAddon ? guests * dessertPrice : 0;
  const customSubtotal = Array.isArray(opt.customLines)
    ? opt.customLines.reduce((s, l) => s + Number(l.amount || 0), 0)
    : 0;
  const preTaxTotal = subtotal + beerSubtotal + dessertSubtotal + customSubtotal;
  const tps = preTaxTotal * TPS_RATE;
  const tvq = preTaxTotal * TVQ_RATE;
  const total = preTaxTotal + tps + tvq;
  const deposit = Math.max(0, Number(opt.depositAmount || 0));
  const balance = Math.max(0, total - (opt.depositPaid ? deposit : 0));
  return { subtotal, beerSubtotal, dessertSubtotal, customSubtotal, preTaxTotal, tps, tvq, total, deposit, balance };
}

// Rétrocompat : ancien helper. Retourne les totaux de la PREMIÈRE option
// (utilisé surtout dans la liste pour afficher un montant indicatif).
function computeQuoteTotal(quote) {
  const opts = getQuoteOptions(quote);
  if (opts.length === 0) {
    return { subtotal: 0, beerSubtotal: 0, dessertSubtotal: 0, customSubtotal: 0, preTaxTotal: 0, tps: 0, tvq: 0, total: 0, deposit: 0, balance: 0 };
  }
  return computeQuoteOptionTotal(opts[0], quote.guestCount);
}

// Retourne la fourchette de totaux pour une soumission multi-options.
// Utile pour la liste : « 595 $ – 750 $ » quand il y a plusieurs options.
function computeQuoteRange(quote) {
  const opts = getQuoteOptions(quote);
  if (opts.length === 0) return { min: 0, max: 0, count: 0 };
  const totals = opts.map(o => computeQuoteOptionTotal(o, quote.guestCount).total);
  return {
    min: Math.min(...totals),
    max: Math.max(...totals),
    count: opts.length
  };
}

// ═══════════════════════════════════════════════════════════════
// LOCATION DE SALLE — options de salle (date + heures + prix)
// ───────────────────────────────────────────────────────────────
// Une soumission peut proposer plusieurs options de location de salle
// (ex. lundi 200 $, mercredi 100 $, dimanche 1000 $). Le client en choisit
// une dans le PDF. Indépendant des forfaits (les deux sont combinables).
// Stocké dans quote.roomRentals[] = { id, date, startTime, endTime, description, price }.
// ═══════════════════════════════════════════════════════════════

// Lit les options de salle d'une soumission (toujours un array, jamais null).
function getQuoteRooms(quote) {
  if (!Array.isArray(quote?.roomRentals)) return [];
  return quote.roomRentals.map((r, i) => ({
    id: r.id || `room-${i}`,
    date: r.date || "",
    startTime: r.startTime || "",
    endTime: r.endTime || "",
    description: r.description || "",
    price: Math.max(0, Number(r.price || 0))
  }));
}

// Totaux d'une option de salle : le prix saisi est AVANT taxes (comme le forfait).
// Retourne { preTaxTotal, tps, tvq, total }.
function computeRoomTotal(room) {
  const preTaxTotal = Math.max(0, Number(room?.price || 0));
  const tps = preTaxTotal * TPS_RATE;
  const tvq = preTaxTotal * TVQ_RATE;
  return { preTaxTotal, tps, tvq, total: preTaxTotal + tps + tvq };
}

// Fourchette de totaux des options de salle (pour la liste : « 230 $ – 1150 $ »).
function computeRoomRange(quote) {
  const rooms = getQuoteRooms(quote);
  if (rooms.length === 0) return { min: 0, max: 0, count: 0 };
  const totals = rooms.map(r => computeRoomTotal(r).total);
  return { min: Math.min(...totals), max: Math.max(...totals), count: rooms.length };
}

// Libellé court d'une option de salle pour l'UI/PDF : « 23 juin · 18:00–23:00 ».
function roomSummaryLabel(room) {
  const parts = [];
  if (room.date) parts.push(fmtDateShort(room.date));
  const hrs = [room.startTime, room.endTime].filter(Boolean).join("–");
  if (hrs) parts.push(hrs);
  return parts.join(" · ");
}

// Date courte localisée tolérante (YYYY-MM-DD → « 23 juin 2026 »). Fallback : brut.
function fmtDateShort(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  } catch (_) { return iso; }
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
    h += renderEmptyState({
      kind: "soumissions",
      title: "Aucune soumission pour le moment",
      subtitle: "Crée des devis professionnels pour tes clients : forfait, suppléments, dépôt et taxes calculés automatiquement, exportés en PDF style Bochica.",
      cta: writable ? { label: "Créer une soumission", icon: "plus", onClick: "openQuoteModal()" } : null,
      hint: "PDF généré · numérotation auto"
    });
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
    const options = getQuoteOptions(qt);
    const range = computeQuoteRange(qt);
    const roomRange = computeRoomRange(qt);
    const status = qt.status || "brouillon";

    // Affichage du(des) forfait(s) : pill simple si 1, plusieurs pills si N
    let pkgMeta = "";
    if (options.length === 1) {
      const opt = options[0];
      const tpl = opt.packageSnapshot || quoteTemplates.find(t => t.id === opt.packageId);
      const tplName = tpl ? `${tpl.label || ""} · ${tpl.name || ""}`.trim().replace(/^·\s*/, "") : "—";
      if (tplName !== "—") {
        pkgMeta = `<span class="quote-card__meta-item">${icon("utensils", 12)} ${esc(tplName)}</span>`;
      }
    } else if (options.length > 1) {
      pkgMeta = `<span class="quote-card__meta-item quote-card__meta-item--multi">${icon("utensils", 12)} ${options.length} options de forfait</span>`;
    }

    // Pill location de salle (si présent)
    let roomMeta = "";
    if (roomRange.count === 1) {
      roomMeta = `<span class="quote-card__meta-item">${icon("map-pin", 12)} Location de salle</span>`;
    } else if (roomRange.count > 1) {
      roomMeta = `<span class="quote-card__meta-item quote-card__meta-item--multi">${icon("map-pin", 12)} ${roomRange.count} options de salle</span>`;
    }

    // Total affiché en titre : la fourchette des forfaits s'il y en a, sinon
    // celle des salles (soumission « location de salle seulement »).
    const headRange = options.length > 0 ? range : roomRange;
    let totalHtml;
    if (headRange.count <= 1 || headRange.min === headRange.max) {
      totalHtml = fmtMoney(headRange.max);
    } else {
      totalHtml = `<span class="quote-card__total-range">${fmtMoney(headRange.min)} – ${fmtMoney(headRange.max)}</span>`;
    }

    // Statut "Expirée" déduit automatiquement (date dépassée + pas encore
    // traitée) — n'écrit RIEN dans qt.status, purement visuel, comme le
    // badge "En retard" des factures (pages-invoices.js).
    const isPastDue = !!qt.validUntil && qt.validUntil < todayISO() && !["acceptee", "refusee", "expiree"].includes(status);

    h += `<article class="quote-card quote-card--${status} ${isPastDue ? "is-past-due" : ""}">
      <div class="quote-card__head">
        <div class="quote-card__num-block">
          <span class="quote-card__num">${esc(qt.quoteNumber || "—")}</span>
          <span class="quote-status-pill quote-status-pill--${status}">${tQuoteStatus(status)}</span>
          ${isPastDue ? `<span class="quote-expired-tag" title="Date de validité dépassée">${icon("alert", 10)} Expirée</span>` : ""}
        </div>
        <div class="quote-card__total">${totalHtml}</div>
      </div>
      <div class="quote-card__body">
        <div class="quote-card__client">
          <strong>${esc(pdfStr(qt.clientName) || "Client sans nom")}</strong>
          ${qt.clientCompany ? `<span class="quote-card__company">${esc(pdfStr(qt.clientCompany))}</span>` : ""}
        </div>
        <div class="quote-card__meta">
          ${qt.eventDate ? `<span class="quote-card__meta-item">${icon("calendar", 12)} ${esc(qt.eventDate)}${qt.eventTime ? " · " + esc(qt.eventTime) : ""}</span>` : ""}
          ${qt.guestCount ? `<span class="quote-card__meta-item">${icon("users", 12)} ${esc(String(qt.guestCount))} pers.</span>` : ""}
          ${pkgMeta}
          ${roomMeta}
          ${qt.eventVenue ? `<span class="quote-card__meta-item">${icon("map-pin", 12)} ${esc(tQuoteVenue(qt.eventVenue))}</span>` : ""}
        </div>
        ${qt.validUntil ? `<div class="quote-card__validity ${isPastDue ? "quote-card__validity--expired" : ""}">${isPastDue ? "Expirée depuis le" : "Valide jusqu'au"} ${esc(qt.validUntil)}</div>` : ""}
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

  const defaultValid = new Date();
  defaultValid.setDate(defaultValid.getDate() + 30);
  const defaultValidIso = defaultValid.toISOString().slice(0, 10);

  // Initialisation de l'état d'édition des options
  // - Si édition d'une soumission existante : charger ses options (avec rétrocompat)
  // - Si nouvelle soumission : initialiser avec 1 option vide pointant sur le 1er forfait dispo
  if (qt) {
    _editingQuoteOptions = getQuoteOptions(qt).map(o => ({ ...o }));
  } else {
    const firstTpl = quoteTemplates[0];
    _editingQuoteOptions = [{
      id: "opt-" + genId(),
      packageId: firstTpl?.id || "",
      packageSnapshot: null, // construit à la sauvegarde
      beerAddon: false,
      dessertAddon: false,
      customLines: [],
      depositAmount: 0,
      depositPaid: false,
      beerPriceOverride: firstTpl?.beerPrice ?? 7,
      dessertPriceOverride: firstTpl?.dessertPrice ?? 6
    }];
  }
  // Pour les options chargées d'une soumission existante, on hydrate les prix override
  // depuis le snapshot (qui contient le prix saisi à la création)
  _editingQuoteOptions.forEach(o => {
    if (o.beerPriceOverride == null) {
      const tpl = o.packageSnapshot || quoteTemplates.find(t => t.id === o.packageId);
      o.beerPriceOverride = o.packageSnapshot?.beerPrice ?? tpl?.beerPrice ?? 7;
    }
    if (o.dessertPriceOverride == null) {
      const tpl = o.packageSnapshot || quoteTemplates.find(t => t.id === o.packageId);
      o.dessertPriceOverride = o.packageSnapshot?.dessertPrice ?? tpl?.dessertPrice ?? 6;
    }
  });

  // Options de location de salle (vide pour une nouvelle soumission)
  _editingRoomRentals = qt ? getQuoteRooms(qt).map(r => ({ ...r })) : [];

  showModal(`<div class="modal modal-quote">
    <div class="modal-header">
      <h3>${qt ? `Modifier la soumission ${esc(qt.quoteNumber || "")}` : "Nouvelle soumission"}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>

    <!-- Bloc CLIENT -->
    <h4 class="quote-modal-section">${icon("user", 14)} Client</h4>
    <label>Nom du client <input id="q-client-name" value="${attrEsc(pdfStr(qt?.clientName))}" placeholder="ex: Marie Tremblay"/></label>
    <label>Entreprise (optionnel) <input id="q-client-company" value="${attrEsc(pdfStr(qt?.clientCompany))}" placeholder="ex: Cabinet Dupont inc."/></label>
    <div class="form-row">
      <label>Téléphone <input id="q-client-phone" type="tel" value="${attrEsc(pdfStr(qt?.clientPhone))}" placeholder="514-555-1234"/></label>
      <label>Courriel <input id="q-client-email" type="email" value="${attrEsc(pdfStr(qt?.clientEmail))}" placeholder="client@exemple.ca"/></label>
    </div>

    <!-- Bloc ÉVÉNEMENT -->
    <h4 class="quote-modal-section">${icon("calendar", 14)} Événement</h4>
    <div class="form-row">
      <label>Date <input id="q-event-date" type="date" value="${attrEsc(qt?.eventDate)}"/></label>
      <label>Heure (optionnel) <input id="q-event-time" type="time" value="${attrEsc(qt?.eventTime)}"/></label>
    </div>
    <div class="form-row">
      <label>Lieu
        <select id="q-event-venue">
          ${QUOTE_VENUES.map(v => `<option value="${v}" ${(qt?.eventVenue || "bochica") === v ? "selected" : ""}>${tQuoteVenue(v)}</option>`).join("")}
        </select>
      </label>
      <label>Nombre de personnes <input id="q-guest-count" type="number" min="1" step="1" value="${attrEsc(qt?.guestCount != null ? String(qt.guestCount) : "")}" placeholder="ex: 25" required/></label>
    </div>
    <label>Adresse / précisions sur le lieu <input id="q-event-address" value="${attrEsc(pdfStr(qt?.eventAddress))}" placeholder="ex: 123 rue Principale, Montréal"/></label>

    <!-- Bloc OPTIONS DE FORFAIT -->
    <h4 class="quote-modal-section">${icon("utensils", 14)} Options de forfait
      <span class="quote-modal-section__hint">— le client pourra choisir celle qui lui convient</span>
    </h4>
    <div id="q-options-container">
      ${renderQuoteOptionsForm()}
    </div>
    <button type="button" class="btn-cancel quote-add-option-btn" onclick="addQuoteOption()">
      ${icon("plus", 14)} Ajouter une option de forfait
    </button>

    <!-- Bloc LOCATION DE SALLE -->
    <h4 class="quote-modal-section">${icon("map-pin", 14)} Location de salle
      <span class="quote-modal-section__hint">— optionnel · le client pourra choisir la date qui lui convient</span>
    </h4>
    <div id="q-rooms-container">
      ${renderRoomRentalsForm()}
    </div>
    <button type="button" class="btn-cancel quote-add-option-btn" onclick="addRoomRental()">
      ${icon("plus", 14)} Ajouter une option de salle
    </button>

    <!-- Bloc VALIDITÉ + NOTES -->
    <h4 class="quote-modal-section">${icon("clock", 14)} Validité & notes</h4>
    <div class="form-row">
      <label>Valide jusqu'au <input id="q-valid-until" type="date" value="${attrEsc(qt?.validUntil || defaultValidIso)}"/></label>
      <label>Statut
        <select id="q-status">
          ${QUOTE_STATUSES.map(s => `<option value="${s}" ${(qt?.status || "brouillon") === s ? "selected" : ""}>${tQuoteStatus(s)}</option>`).join("")}
        </select>
      </label>
    </div>

    <label>Notes / conditions <textarea id="q-notes" style="height:80px" placeholder="Allergies, demandes particulières, conditions de paiement, etc.">${attrEsc(pdfStr(qt?.notes))}</textarea></label>

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

// ═══════════════════════════════════════════════════════════════
// GESTION DES OPTIONS DE FORFAIT (multi-options, dynamique)
// ═══════════════════════════════════════════════════════════════

// Rend tout le bloc d'options (un par un). Re-rendu intégralement à chaque
// ajout/retrait d'option ou de ligne custom — on re-lit la saisie DOM d'abord
// dans `syncEditingOptionsFromDOM()` pour ne pas perdre les valeurs en cours.
function renderQuoteOptionsForm() {
  if (!Array.isArray(_editingQuoteOptions) || _editingQuoteOptions.length === 0) {
    return `<div class="quote-custom-empty text-muted" style="font-size:13px;padding:14px">Aucune option de forfait. Cliquez sur « Ajouter une option » pour commencer.</div>`;
  }
  return _editingQuoteOptions.map((opt, idx) => renderQuoteOptionBlock(opt, idx)).join("");
}

// Lettre A, B, C... pour identifier visuellement chaque option
function optionLetter(idx) {
  return String.fromCharCode(65 + (idx % 26));
}

function renderQuoteOptionBlock(opt, idx) {
  const letter = optionLetter(idx);
  const optId = opt.id;
  const canRemove = _editingQuoteOptions.length > 1;
  return `<div class="quote-option-block" data-opt-id="${attrEsc(optId)}">
    <div class="quote-option-block__head">
      <span class="quote-option-block__badge">Option ${letter}</span>
      ${canRemove ? `<button type="button" class="btn-icon-only text-danger" onclick="removeQuoteOption('${esc(optId)}')" aria-label="Retirer cette option" title="Retirer">${icon("trash", 14)}</button>` : ""}
    </div>

    <div class="quote-package-choices">
      ${quoteTemplates.map(tpl => `<label class="quote-package-card quote-package-card--${tpl.accentColor || "yellow"}">
        <input type="radio" name="q-package-${attrEsc(optId)}" value="${attrEsc(tpl.id)}" data-beer-price="${attrEsc(String(tpl.beerPrice || 0))}" data-dessert-price="${attrEsc(String(tpl.dessertPrice || 0))}" onchange="onOptionPackageChange(this, '${esc(optId)}')" ${tpl.id === opt.packageId ? "checked" : ""}/>
        <div class="quote-package-card__body">
          <div class="quote-package-card__label">${attrEsc(pdfStr(tpl.label))}</div>
          <div class="quote-package-card__name">${attrEsc(pdfStr(tpl.name))}</div>
          <div class="quote-package-card__price">${fmtMoney(tpl.pricePerPerson || 0)} / pers.</div>
          <div class="quote-package-card__details">
            <div><strong>Entrée :</strong> ${attrEsc(pdfStr(tpl.entree) || "—")}</div>
            <div><strong>Plat :</strong> ${attrEsc(pdfStr(tpl.plat) || "—")}</div>
            <div><strong>Boisson :</strong> ${attrEsc(pdfStr(tpl.boisson) || "—")}</div>
          </div>
        </div>
      </label>`).join("")}
    </div>

    <div class="quote-beer-block">
      <label class="quote-beer-toggle">
        <input type="checkbox" class="q-beer-addon" ${opt.beerAddon ? "checked" : ""}/>
        <span>🍺 Remplacer la boisson par une bière (en supplément, par personne)</span>
      </label>
      <label class="quote-beer-price">
        <span class="quote-beer-price__label">Prix de la bière par personne ($)</span>
        <input class="q-beer-price" type="number" min="0" step="0.01" value="${attrEsc(String(opt.beerPriceOverride ?? 7))}" data-touched="${opt._beerTouched ? "true" : "false"}" oninput="this.dataset.touched='true'"/>
        <span class="quote-beer-price__hint">Modifiable pour offrir un rabais (ex. 5,00 $ au lieu de 7,00 $)</span>
      </label>
    </div>

    <div class="quote-beer-block">
      <label class="quote-beer-toggle">
        <input type="checkbox" class="q-dessert-addon" ${opt.dessertAddon ? "checked" : ""}/>
        <span>☕🍰 Ajouter café ou thé + dessert (en supplément, par personne)</span>
      </label>
      <label class="quote-beer-price">
        <span class="quote-beer-price__label">Prix café/thé + dessert par personne ($)</span>
        <input class="q-dessert-price" type="number" min="0" step="0.01" value="${attrEsc(String(opt.dessertPriceOverride ?? 6))}" data-touched="${opt._dessertTouched ? "true" : "false"}" oninput="this.dataset.touched='true'"/>
        <span class="quote-beer-price__hint">Modifiable par soumission (ex. 5,00 $ au lieu de 6,00 $)</span>
      </label>
    </div>

    <div class="quote-option-subsection">
      <div class="quote-option-subsection__label">${icon("plus", 12)} Suppléments / rabais (cette option)</div>
      <div class="q-custom-lines">
        ${renderCustomLinesInputs(opt.customLines, optId)}
      </div>
      <button type="button" class="btn-cancel btn-sm" onclick="addCustomLineInput('${esc(optId)}')" style="margin-top:6px">
        ${icon("plus", 12)} Ajouter une ligne
      </button>
    </div>

    <div class="quote-option-subsection">
      <div class="quote-option-subsection__label">${icon("dollar-sign", 12)} Dépôt (cette option)</div>
      <div class="form-row">
        <label>Montant exigé ($) <input type="number" class="q-deposit" min="0" step="0.01" value="${attrEsc(opt.depositAmount ? String(opt.depositAmount) : "")}" placeholder="ex: 250.00"/></label>
        <div style="display:flex;flex-direction:column;justify-content:flex-end">
          <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:8px 0">
            <input type="checkbox" class="q-deposit-paid" ${opt.depositPaid ? "checked" : ""}/>
            <span>Dépôt déjà versé</span>
          </label>
        </div>
      </div>
    </div>
  </div>`;
}

// Quand l'utilisateur coche un forfait dans une option, on met à jour le prix
// bière par défaut de CETTE option — sauf si l'utilisateur l'a déjà modifié.
function onOptionPackageChange(radioEl, optId) {
  const block = document.querySelector(`[data-opt-id="${optId}"]`);
  if (!block) return;
  const beerInput = block.querySelector(".q-beer-price");
  if (beerInput && beerInput.dataset.touched !== "true") {
    const newPrice = radioEl.getAttribute("data-beer-price");
    if (newPrice != null) beerInput.value = newPrice;
  }
  const dessertInput = block.querySelector(".q-dessert-price");
  if (dessertInput && dessertInput.dataset.touched !== "true") {
    const newDessert = radioEl.getAttribute("data-dessert-price");
    if (newDessert != null) dessertInput.value = newDessert;
  }
}

// Lit toutes les options depuis le DOM et met à jour `_editingQuoteOptions`.
// Appelé avant chaque re-render (ajout/retrait option ou ligne custom) pour
// préserver la saisie en cours.
function syncEditingOptionsFromDOM() {
  const container = document.getElementById("q-options-container");
  if (!container) return;
  const blocks = container.querySelectorAll(".quote-option-block");
  const newOpts = [];
  blocks.forEach(block => {
    const optId = block.getAttribute("data-opt-id");
    // Retrouver l'option dans le state pour préserver les champs non-DOM (ex: packageSnapshot)
    const stateOpt = _editingQuoteOptions.find(o => o.id === optId) || {};
    const checkedRadio = block.querySelector(`input[name="q-package-${optId}"]:checked`);
    const packageId = checkedRadio?.value || stateOpt.packageId || "";
    const beerAddon = block.querySelector(".q-beer-addon")?.checked || false;
    const beerPriceInput = block.querySelector(".q-beer-price");
    const beerPriceOverride = Math.max(0, Number(beerPriceInput?.value) || 0);
    const beerTouched = beerPriceInput?.dataset.touched === "true";
    const dessertAddon = block.querySelector(".q-dessert-addon")?.checked || false;
    const dessertPriceInput = block.querySelector(".q-dessert-price");
    const dessertPriceOverride = Math.max(0, Number(dessertPriceInput?.value) || 0);
    const dessertTouched = dessertPriceInput?.dataset.touched === "true";
    const depositAmount = Math.max(0, Number(block.querySelector(".q-deposit")?.value) || 0);
    const depositPaid = block.querySelector(".q-deposit-paid")?.checked || false;
    // Lignes custom
    const customLines = [];
    block.querySelectorAll(".quote-custom-line").forEach(row => {
      const desc = row.querySelector(".quote-custom-desc")?.value.trim() || "";
      const amt = row.querySelector(".quote-custom-amount")?.value || "";
      if (desc || amt) customLines.push({ description: desc, amount: Number(amt) || 0 });
    });
    newOpts.push({
      id: optId,
      packageId,
      packageSnapshot: stateOpt.packageSnapshot || null,
      beerAddon,
      beerPriceOverride,
      _beerTouched: beerTouched,
      dessertAddon,
      dessertPriceOverride,
      _dessertTouched: dessertTouched,
      customLines,
      depositAmount,
      depositPaid
    });
  });
  _editingQuoteOptions = newOpts;
}

function rerenderOptionsForm() {
  const container = document.getElementById("q-options-container");
  if (container) container.innerHTML = renderQuoteOptionsForm();
}

function addQuoteOption() {
  syncEditingOptionsFromDOM();
  if (quoteTemplates.length === 0) {
    toast("Aucun forfait disponible. Créez d'abord des forfaits.", "warning");
    return;
  }
  const firstTpl = quoteTemplates[0];
  _editingQuoteOptions.push({
    id: "opt-" + genId(),
    packageId: firstTpl.id,
    packageSnapshot: null,
    beerAddon: false,
    beerPriceOverride: firstTpl.beerPrice ?? 7,
    dessertAddon: false,
    dessertPriceOverride: firstTpl.dessertPrice ?? 6,
    customLines: [],
    depositAmount: 0,
    depositPaid: false
  });
  rerenderOptionsForm();
}

function removeQuoteOption(optId) {
  syncEditingOptionsFromDOM();
  syncEditingRoomsFromDOM();
  // On peut retirer le dernier forfait UNIQUEMENT s'il reste au moins une
  // option de salle (soumission « location de salle seulement »).
  if (_editingQuoteOptions.length <= 1 && _editingRoomRentals.length === 0) {
    toast("Gardez au moins un forfait, ou ajoutez une option de salle.", "warning");
    return;
  }
  _editingQuoteOptions = _editingQuoteOptions.filter(o => o.id !== optId);
  rerenderOptionsForm();
}

// ═══════════════════════════════════════════════════════════════
// GESTION DES OPTIONS DE LOCATION DE SALLE (multi-options, dynamique)
// ═══════════════════════════════════════════════════════════════

// Rend tout le bloc des options de salle. Re-rendu intégralement à chaque
// ajout/retrait — on relit la saisie DOM d'abord via syncEditingRoomsFromDOM().
function renderRoomRentalsForm() {
  if (!Array.isArray(_editingRoomRentals) || _editingRoomRentals.length === 0) {
    return `<div class="quote-custom-empty text-muted" style="font-size:13px;padding:14px">Aucune location de salle. Cliquez sur « Ajouter une option de salle » si l'événement inclut la location d'une salle.</div>`;
  }
  return _editingRoomRentals.map((room, idx) => renderRoomRentalRow(room, idx)).join("");
}

function renderRoomRentalRow(room, idx) {
  const roomId = room.id;
  const totals = computeRoomTotal(room);
  return `<div class="quote-room-block" data-room-id="${attrEsc(roomId)}">
    <div class="quote-room-block__head">
      <span class="quote-room-block__badge">Salle — option ${idx + 1}</span>
      <span class="quote-room-block__total">${fmtMoney(totals.total)} <span class="quote-room-block__total-hint">taxes incl.</span></span>
      <button type="button" class="btn-icon-only text-danger" onclick="removeRoomRental('${esc(roomId)}')" aria-label="Retirer cette option de salle" title="Retirer">${icon("trash", 14)}</button>
    </div>
    <div class="form-row">
      <label>Date <input type="date" class="q-room-date" value="${attrEsc(room.date)}"/></label>
      <label>Prix avant taxes ($) <input type="number" class="q-room-price" min="0" step="0.01" value="${attrEsc(room.price ? String(room.price) : "")}" placeholder="ex: 200.00" oninput="refreshRoomRowTotal('${esc(roomId)}')"/></label>
    </div>
    <div class="form-row">
      <label>Heure de début <input type="time" class="q-room-start" value="${attrEsc(room.startTime)}"/></label>
      <label>Heure de fin <input type="time" class="q-room-end" value="${attrEsc(room.endTime)}"/></label>
    </div>
    <label>Description (optionnel) <input type="text" class="q-room-desc" value="${attrEsc(pdfStr(room.description))}" placeholder="ex: Salle privée à l'étage, capacité 40 personnes"/></label>
  </div>`;
}

// Recalcule le total affiché d'une ligne de salle sans tout re-render (fluide à la saisie).
function refreshRoomRowTotal(roomId) {
  const block = document.querySelector(`[data-room-id="${roomId}"]`);
  if (!block) return;
  const price = Math.max(0, Number(block.querySelector(".q-room-price")?.value) || 0);
  const totals = computeRoomTotal({ price });
  const el = block.querySelector(".quote-room-block__total");
  if (el) el.innerHTML = `${fmtMoney(totals.total)} <span class="quote-room-block__total-hint">taxes incl.</span>`;
}

// Lit les options de salle depuis le DOM vers _editingRoomRentals (préserve la saisie).
function syncEditingRoomsFromDOM() {
  const container = document.getElementById("q-rooms-container");
  if (!container) return;
  const rows = container.querySelectorAll(".quote-room-block");
  const newRooms = [];
  rows.forEach(block => {
    const roomId = block.getAttribute("data-room-id");
    newRooms.push({
      id: roomId,
      date: block.querySelector(".q-room-date")?.value || "",
      startTime: block.querySelector(".q-room-start")?.value || "",
      endTime: block.querySelector(".q-room-end")?.value || "",
      description: block.querySelector(".q-room-desc")?.value.trim() || "",
      price: Math.max(0, Number(block.querySelector(".q-room-price")?.value) || 0)
    });
  });
  _editingRoomRentals = newRooms;
}

function rerenderRoomsForm() {
  const container = document.getElementById("q-rooms-container");
  if (container) container.innerHTML = renderRoomRentalsForm();
}

function addRoomRental() {
  syncEditingRoomsFromDOM();
  _editingRoomRentals.push({
    id: "room-" + genId(),
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    price: 0
  });
  rerenderRoomsForm();
}

function removeRoomRental(roomId) {
  syncEditingRoomsFromDOM();
  _editingRoomRentals = _editingRoomRentals.filter(r => r.id !== roomId);
  rerenderRoomsForm();
}

// ─── Lignes personnalisées (par option) ──────────────
// Chaque option a son propre conteneur de lignes custom. Le 2e paramètre
// `optId` est utilisé pour cibler le bon bloc d'option dans le DOM.
function renderCustomLinesInputs(lines, optId) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return `<div class="quote-custom-empty text-muted" style="font-size:12px">Aucun supplément pour cette option.</div>`;
  }
  return lines.map((l, i) => `<div class="quote-custom-line" data-idx="${i}">
    <input type="text" class="quote-custom-desc" value="${attrEsc(pdfStr(l.description))}" placeholder="ex: Décor spécial, Service après minuit, Rabais 10%..." />
    <input type="number" step="0.01" class="quote-custom-amount" value="${attrEsc(l.amount != null ? String(l.amount) : "")}" placeholder="0.00" />
    <button type="button" class="btn-icon-only" onclick="removeCustomLineInput('${esc(optId || "")}', ${i})" aria-label="Retirer">${icon("trash", 14)}</button>
  </div>`).join("");
}

function addCustomLineInput(optId) {
  syncEditingOptionsFromDOM();
  const opt = _editingQuoteOptions.find(o => o.id === optId);
  if (!opt) return;
  opt.customLines.push({ description: "", amount: 0 });
  rerenderOptionsForm();
}

function removeCustomLineInput(optId, idx) {
  syncEditingOptionsFromDOM();
  const opt = _editingQuoteOptions.find(o => o.id === optId);
  if (!opt) return;
  opt.customLines.splice(idx, 1);
  rerenderOptionsForm();
}

// ─── Sauvegarde soumission ────────────────────────────
async function saveQuote(id) {
  const name = pdfStr(document.getElementById("q-client-name").value.trim());
  if (!name) return toast("Veuillez saisir le nom du client.", "error");

  const guestCount = Math.max(0, Math.floor(Number(document.getElementById("q-guest-count").value) || 0));
  if (guestCount < 1) return toast("Veuillez saisir le nombre de personnes (minimum 1).", "error");

  // Synchroniser le state avec la dernière saisie DOM avant de construire le payload
  syncEditingOptionsFromDOM();
  syncEditingRoomsFromDOM();

  const hasForfaits = Array.isArray(_editingQuoteOptions) && _editingQuoteOptions.length > 0;
  const hasRooms = Array.isArray(_editingRoomRentals) && _editingRoomRentals.length > 0;
  if (!hasForfaits && !hasRooms) {
    return toast("Ajoutez au moins une option de forfait ou de location de salle.", "error");
  }

  // Construire les snapshots de chaque option (copie figée des forfaits + saisies)
  const packageOptions = [];
  for (const opt of _editingQuoteOptions) {
    if (!opt.packageId) {
      return toast("Chaque option doit avoir un forfait sélectionné.", "error");
    }
    const tpl = quoteTemplates.find(x => x.id === opt.packageId);
    if (!tpl) {
      return toast(`Forfait introuvable pour une option (${opt.packageId}).`, "error");
    }
    const beerPrice = Math.max(0, Number(opt.beerPriceOverride) || 0);
    const dessertPrice = Math.max(0, Number(opt.dessertPriceOverride) || 0);
    const packageSnapshot = {
      id: tpl.id,
      name: pdfStr(tpl.name),
      label: pdfStr(tpl.label),
      pricePerPerson: Number(tpl.pricePerPerson || 0),
      accentColor: tpl.accentColor || "yellow",
      entree: pdfStr(tpl.entree || ""),
      plat:   pdfStr(tpl.plat || ""),
      boisson:pdfStr(tpl.boisson || ""),
      beerPrice,
      dessertPrice
    };
    const customLines = (opt.customLines || []).map(l => ({
      description: pdfStr(l.description || ""),
      amount: Number(l.amount || 0)
    }));
    packageOptions.push({
      id: opt.id,
      packageId: opt.packageId,
      packageSnapshot,
      beerAddon: !!opt.beerAddon,
      dessertAddon: !!opt.dessertAddon,
      customLines,
      depositAmount: Math.max(0, Number(opt.depositAmount) || 0),
      depositPaid: !!opt.depositPaid
    });
  }

  // Options de location de salle (nettoyées). Une option sans prix ni date ni
  // description est ignorée (ligne ajoutée puis laissée vide).
  const roomRentals = _editingRoomRentals
    .map(r => ({
      id: r.id || ("room-" + genId()),
      date: r.date || "",
      startTime: r.startTime || "",
      endTime: r.endTime || "",
      description: pdfStr(r.description || ""),
      price: Math.max(0, Number(r.price) || 0)
    }))
    .filter(r => r.price > 0 || r.date || r.description);

  // Champs legacy (rétrocompat) : reflètent la 1re option de forfait si elle
  // existe, sinon valeurs neutres (cas « location de salle seulement »).
  const first = packageOptions[0] || null;

  const data = {
    clientName: name,
    clientCompany: pdfStr(document.getElementById("q-client-company").value.trim()),
    clientPhone:   pdfStr(document.getElementById("q-client-phone").value.trim()),
    clientEmail:   pdfStr(document.getElementById("q-client-email").value.trim()),
    eventDate:    document.getElementById("q-event-date").value || "",
    eventTime:    document.getElementById("q-event-time").value || "",
    eventVenue:   document.getElementById("q-event-venue").value,
    eventAddress: pdfStr(document.getElementById("q-event-address").value.trim()),
    guestCount,
    packageOptions,
    roomRentals,
    // Champs legacy : on les écrit aussi avec la première option, pour que les
    // anciennes vues qui lisent encore qt.packageId / packageSnapshot / etc.
    // affichent quelque chose de cohérent. Le nouveau code préfère
    // `packageOptions[]` via `getQuoteOptions()`.
    packageId: first ? first.packageId : null,
    packageSnapshot: first ? first.packageSnapshot : null,
    beerAddon: first ? first.beerAddon : false,
    dessertAddon: first ? first.dessertAddon : false,
    customLines: first ? first.customLines : [],
    depositAmount: first ? first.depositAmount : 0,
    depositPaid: first ? first.depositPaid : false,
    validUntil: document.getElementById("q-valid-until").value || "",
    notes:      pdfStr(document.getElementById("q-notes").value.trim()),
    status:     document.getElementById("q-status").value,
    updatedAt:  firebase.firestore.FieldValue.serverTimestamp()
  };

  // Libellé descriptif pour les logs : « Essentiel + Gourmand », « Location de salle », etc.
  const labelParts = packageOptions.map(o => o.packageSnapshot.name);
  if (roomRentals.length > 0) labelParts.push(`Location de salle (${roomRentals.length})`);
  const optsLabel = labelParts.join(" + ") || "—";

  try {
    if (id) {
      await db.collection("quotes").doc(id).update(data);
      const q = quotes.find(x => x.id === id);
      await addLog(q?.quoteNumber || id, "Soumission — modifiée", `${name} · ${optsLabel}`);
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
      await addLog(quoteNumber, "Soumission — créée", `${name} · ${optsLabel}`);
      toast(`Soumission ${quoteNumber} créée${packageOptions.length > 1 ? ` (${packageOptions.length} options)` : ""}.`, "success");
    }
    _editingQuoteOptions = [];
    _editingRoomRentals = [];
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
  return `<div class="quote-tpl-editor quote-tpl-editor--${tpl.accentColor || "yellow"}" data-tpl-id="${attrEsc(tpl.id)}">
    <div class="quote-tpl-editor__head">
      <input class="quote-tpl-label" data-field="label" value="${attrEsc(pdfStr(tpl.label))}" placeholder="Forfait Un" aria-label="Étiquette"/>
      <input class="quote-tpl-name" data-field="name" value="${attrEsc(pdfStr(tpl.name))}" placeholder="L'Essentiel" aria-label="Nom du forfait"/>
      <button class="btn-icon-only text-danger" onclick="deleteTemplate('${esc(tpl.id)}')" aria-label="Supprimer le forfait" title="Supprimer">${icon("trash", 14)}</button>
    </div>
    <div class="form-row" style="margin-top:8px">
      <label>Prix / personne ($)
        <input type="number" min="0" step="0.01" data-field="pricePerPerson" value="${attrEsc(String(tpl.pricePerPerson || 0))}"/>
      </label>
      <label>Couleur d'accent
        <select data-field="accentColor">
          ${QUOTE_ACCENT_COLORS.map(c => `<option value="${c}" ${(tpl.accentColor || "yellow") === c ? "selected" : ""}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join("")}
        </select>
      </label>
    </div>
    <label>Entrée <input data-field="entree" value="${attrEsc(pdfStr(tpl.entree))}" placeholder="ex: 1 empanada au bœuf ou au poulet par personne"/></label>
    <label>Plat principal <input data-field="plat" value="${attrEsc(pdfStr(tpl.plat))}" placeholder="ex: Arepa classique ou végé"/></label>
    <label>Boisson <input data-field="boisson" value="${attrEsc(pdfStr(tpl.boisson))}" placeholder="ex: Une boisson gazeuse colombienne ou autre"/></label>
    <label>Prix par défaut bière de substitution ($) <input type="number" min="0" step="0.01" data-field="beerPrice" value="${attrEsc(String(tpl.beerPrice || 0))}"/></label>
    <p class="text-muted" style="font-size:11px;margin:4px 0 0">Prix appliqué quand la boisson est remplacée par une bière. Modifiable par soumission pour offrir un rabais.</p>
    <label>Prix par défaut café/thé + dessert ($) <input type="number" min="0" step="0.01" data-field="dessertPrice" value="${attrEsc(String(tpl.dessertPrice || 0))}"/></label>
    <p class="text-muted" style="font-size:11px;margin:4px 0 0">Supplément par personne pour ajouter un café ou thé et un dessert. Modifiable par soumission.</p>
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
    dessertPrice: 6,
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
    if (["pricePerPerson", "beerPrice", "dessertPrice"].includes(field)) {
      v = Math.max(0, Number(v) || 0);
    } else {
      // Nettoyer les apostrophes échappées \' héritées de esc()
      v = pdfStr(v);
    }
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
  const FOOTER_RESERVE = 60; // mm réservés en bas pour le QR + mentions

  // ─── Palette (RGB) ───────────────────────────
  const COLOR_CREAM       = [253, 246, 231];
  const COLOR_TEXT        = [14, 13, 12];
  const COLOR_TEXT_LIGHT  = [110, 95, 80];
  const COLOR_ACCENT      = [247, 179, 44];
  const COLOR_BLUE        = [74, 144, 226];
  const COLOR_RED         = [231, 76, 60];
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

  // ─── Helpers de mise en page multi-pages ────────────
  // y : position verticale courante (mise à jour par chaque bloc)
  // currentPage : pour afficher « Page N » et savoir si on est en première page
  let y = 0;
  let currentPage = 1;

  function paintBackground() {
    doc.setFillColor(...COLOR_CREAM);
    doc.rect(0, 0, W, H, "F");
  }

  function drawTricolore(cy) {
    const triW = 56;
    const triX0 = (W - triW) / 2;
    const triH = 1.4;
    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(triX0, cy, triW / 3, triH, "F");
    doc.setFillColor(...COLOR_BLUE);
    doc.rect(triX0 + triW / 3, cy, triW / 3, triH, "F");
    doc.setFillColor(...COLOR_RED);
    doc.rect(triX0 + 2 * triW / 3, cy, triW / 3, triH, "F");
  }

  // En-tête complet (1ère page) : logo BOCHICA + sous-titre + tricolore + titre
  function drawFullHeader() {
    y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("BOCHICA", W / 2, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text("Restaurant Colombien", W / 2, y, { align: "center" });
    y += 3;
    drawTricolore(y);
    y += 12;
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
  }

  // En-tête compact pour les pages suivantes (réf. soumission + client)
  function drawCompactHeader() {
    y = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("BOCHICA", M, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(`Soumission ${qt.quoteNumber || ""} · ${pdfStr(qt.clientName) || ""}`, W - M, y, { align: "right" });
    y += 3;
    doc.setDrawColor(...COLOR_ACCENT);
    doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);
    y += 8;
  }

  // Passe à une nouvelle page et redessine fond + en-tête compact
  function newPage() {
    doc.addPage();
    currentPage++;
    paintBackground();
    drawCompactHeader();
  }

  // Garantit qu'il reste au moins `needed` mm dispo sur la page courante,
  // sinon passe à une nouvelle page. À appeler avant chaque bloc d'option.
  function ensureSpace(needed) {
    if (y + needed > H - FOOTER_RESERVE) {
      newPage();
    }
  }

  // ═══════════════════════════════════════════
  // PAGE 1 — En-tête + Client/Événement + Intro
  // ═══════════════════════════════════════════
  paintBackground();
  drawFullHeader();

  // Bloc CLIENT + ÉVÉNEMENT (2 colonnes)
  const colW = (contentW - 6) / 2;

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
    pdfStr(qt.clientName) || "—",
    pdfStr(qt.clientCompany),
    qt.clientPhone ? `Tel : ${pdfStr(qt.clientPhone)}` : "",
    qt.clientEmail ? `Courriel : ${pdfStr(qt.clientEmail)}` : ""
  ].filter(Boolean);

  const venueLabel = tQuoteVenue(qt.eventVenue || "bochica");
  const eventLines = [
    qt.eventDate ? `Date : ${qt.eventDate}${qt.eventTime ? " · " + qt.eventTime : ""}` : "",
    `Lieu : ${venueLabel}`,
    pdfStr(qt.eventAddress),
    qt.guestCount ? `Nombre de personnes : ${qt.guestCount}` : ""
  ].filter(Boolean);

  const yAfterClient = infoBox(M, y, colW, "Client", clientLines);
  const yAfterEvent  = infoBox(M + colW + 6, y, colW, "Événement", eventLines);
  y = Math.max(yAfterClient, yAfterEvent) + 8;

  // ═══════════════════════════════════════════
  // OPTIONS DE FORFAIT
  // ═══════════════════════════════════════════
  const options = getQuoteOptions(qt);
  const multi = options.length > 1;

  // Bandeau d'intro : invitation à choisir une option (si plusieurs)
  if (multi) {
    const bannerH = 16;
    ensureSpace(bannerH + 6);
    doc.setFillColor(...COLOR_ACCENT);
    doc.roundedRect(M, y, contentW, bannerH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(`${options.length} options proposées — choisissez celle qui vous convient`, W / 2, y + 7, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("Cochez l'option retenue dans la case en bas de chaque carte et retournez la soumission signée.", W / 2, y + 12, { align: "center" });
    y += bannerH + 6;
  }

  // ─── Rendu d'UNE option (carte forfait + bière + custom + totaux) ────
  // Retourne true si tout a tenu sur la page courante, false si on a basculé.
  function renderOption(opt, idx) {
    const tpl = opt.packageSnapshot || quoteTemplates.find(t => t.id === opt.packageId) || {};
    const accent = accentByColor[tpl.accentColor || "yellow"];
    const cardFill = cardFillByColor[tpl.accentColor || "yellow"];
    const totals = computeQuoteOptionTotal(opt, qt.guestCount);

    // Estimer la hauteur totale pour décider si on passe à une nouvelle page.
    // Base = carte forfait (60mm) + marge (6mm) + section totaux (~46mm).
    // Le badge « OPTION » (8mm) et la case à cocher (12mm) ne sont dessinés
    // QUE en multi-options → ne les réserver que dans ce cas (sinon une
    // soumission à une seule option déborde inutilement sur une 2e page).
    let estHeight = 60 + 6 + 46;
    if (multi) estHeight += 8 + 12;
    if (opt.beerAddon) estHeight += 18;
    if (opt.dessertAddon) estHeight += 18;
    if (Array.isArray(opt.customLines) && opt.customLines.length > 0) {
      estHeight += 6 + opt.customLines.length * 5 + 4;
    }
    if (opt.depositAmount > 0) estHeight += 10;

    ensureSpace(estHeight);

    // Badge « OPTION A » au-dessus de la carte
    if (multi) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...accent);
      doc.text(`OPTION ${optionLetter(idx)}`, M, y);
      // Trait coloré à droite du badge
      doc.setDrawColor(...accent);
      doc.setLineWidth(1.2);
      const badgeTextW = doc.getTextWidth(`OPTION ${optionLetter(idx)}`);
      doc.line(M + badgeTextW + 4, y - 1, W - M, y - 1);
      y += 5;
    }

    // Carte forfait (style Menu_Forfaits.pdf)
    const cardX = M;
    const cardY = y;
    const cardH = 60;

    doc.setFillColor(...cardFill);
    doc.roundedRect(cardX, cardY, contentW, cardH, 3, 3, "F");
    // Barre latérale colorée gauche
    doc.setFillColor(...accent);
    doc.roundedRect(cardX, cardY, 3, cardH, 1.5, 1.5, "F");
    doc.rect(cardX, cardY, 3, cardH, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(pdfStr(tpl.label || "FORFAIT").toUpperCase(), cardX + 9, cardY + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(pdfStr(tpl.name) || "—", cardX + 9, cardY + 18);

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

    // 3 lignes : Entrée / Plat / Boisson
    const items = [
      ["ENTRÉE", pdfStr(tpl.entree)],
      ["PLAT PRINCIPAL", pdfStr(tpl.plat)],
      ["BOISSON", pdfStr(tpl.boisson)]
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

    // Substitution bière (si activée pour cette option)
    if (opt.beerAddon) {
      const beerH = 14;
      doc.setFillColor(...COLOR_ACCENT);
      doc.roundedRect(M, y, contentW, beerH, 2, 2, "F");
      doc.setFillColor(...COLOR_TEXT);
      doc.circle(M + 6, y + 7, 1.8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(`Boisson remplacée par une bière`, M + 11, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(`(supplément par personne)`, M + 11, y + 10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLOR_RED);
      doc.setFontSize(12);
      doc.text(`+ ${fmtMoney(tpl.beerPrice || 0).replace(" $", "")} $ / pers.`, M + contentW - 4, y + 8.5, { align: "right" });
      y += beerH + 4;
    }

    // Ajout café/thé + dessert (si activé pour cette option)
    if (opt.dessertAddon) {
      const dessertH = 14;
      doc.setFillColor(...COLOR_ACCENT);
      doc.roundedRect(M, y, contentW, dessertH, 2, 2, "F");
      doc.setFillColor(...COLOR_TEXT);
      doc.circle(M + 6, y + 7, 1.8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(`Café ou thé + dessert`, M + 11, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(`(supplément par personne)`, M + 11, y + 10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLOR_RED);
      doc.setFontSize(12);
      doc.text(`+ ${fmtMoney(tpl.dessertPrice || 0).replace(" $", "")} $ / pers.`, M + contentW - 4, y + 8.5, { align: "right" });
      y += dessertH + 4;
    }

    // Lignes personnalisées pour cette option
    if (Array.isArray(opt.customLines) && opt.customLines.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_TEXT);
      doc.text("Suppléments et ajustements", M, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      opt.customLines.forEach(line => {
        doc.setTextColor(...COLOR_TEXT);
        doc.text(pdfStr(line.description) || "—", M, y + 4);
        const amt = Number(line.amount || 0);
        doc.setTextColor(amt < 0 ? COLOR_GREEN[0] : COLOR_TEXT[0], amt < 0 ? COLOR_GREEN[1] : COLOR_TEXT[1], amt < 0 ? COLOR_GREEN[2] : COLOR_TEXT[2]);
        doc.text(`${amt >= 0 ? "+" : ""}${fmtMoney(amt).replace(" $", "")} $`, M + contentW, y + 4, { align: "right" });
        y += 5;
      });
      y += 4;
    }

    // Totaux pour cette option
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
      totalLine(`Bière en remplacement (${qt.guestCount || 0} × ${fmtMoney(tpl.beerPrice || 0)})`, fmtMoney(totals.beerSubtotal));
    }
    if (totals.dessertSubtotal > 0) {
      totalLine(`Café/thé + dessert (${qt.guestCount || 0} × ${fmtMoney(tpl.dessertPrice || 0)})`, fmtMoney(totals.dessertSubtotal));
    }
    if (totals.customSubtotal !== 0) {
      totalLine("Suppléments", fmtMoney(totals.customSubtotal));
    }
    totalLine("Sous-total", fmtMoney(totals.preTaxTotal));
    totalLine(`TPS (${(TPS_RATE * 100).toFixed(0)} %)`, fmtMoney(totals.tps));
    totalLine(`TVQ (${(TVQ_RATE * 100).toFixed(3)} %)`, fmtMoney(totals.tvq));
    y += 1;
    totalLine(multi ? `TOTAL — OPTION ${optionLetter(idx)}` : "TOTAL", fmtMoney(totals.total), true);
    if (totals.deposit > 0) {
      totalLine(`Dépôt ${opt.depositPaid ? "(versé)" : "exigé"}`, fmtMoney(totals.deposit));
      totalLine("Solde à payer", fmtMoney(totals.balance), true);
    }
    y += 4;

    // Case à cocher « Je choisis cette option » (seulement si multi-options)
    if (multi) {
      const cbY = y;
      const cbSize = 6;
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.8);
      doc.setFillColor(255, 255, 255);
      doc.rect(M, cbY, cbSize, cbSize, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(`Je choisis l'OPTION ${optionLetter(idx)} — ${pdfStr(tpl.name) || ""}`, M + cbSize + 4, cbY + 4.5);
      y += cbSize + 8;
    } else {
      y += 4;
    }
  }

  // Boucler sur chaque option
  options.forEach((opt, idx) => renderOption(opt, idx));

  // ═══════════════════════════════════════════
  // LOCATION DE SALLE (options choisissables, indépendantes des forfaits)
  // ═══════════════════════════════════════════
  const rooms = getQuoteRooms(qt);
  if (rooms.length > 0) {
    const roomsMulti = rooms.length > 1;

    // En-tête de section (bandeau bleu)
    const headH = roomsMulti ? 16 : 11;
    ensureSpace(headH + 30);
    doc.setFillColor(...COLOR_BLUE);
    doc.roundedRect(M, y, contentW, headH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("LOCATION DE SALLE", W / 2, y + 7, { align: "center" });
    if (roomsMulti) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text("Choisissez la date qui vous convient — cochez l'option retenue.", W / 2, y + 12, { align: "center" });
    }
    y += headH + 6;

    rooms.forEach((room, idx) => {
      const rt = computeRoomTotal(room);
      const hrs = [room.startTime, room.endTime].filter(Boolean).join(" – ");
      const dateLabel = room.date ? fmtDateShort(room.date) : "Date à confirmer";

      // Découpe de la description (max 2 lignes)
      let descLines = [];
      if (room.description) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        descLines = doc.splitTextToSize(pdfStr(room.description), contentW - 18).slice(0, 2);
      }
      const cardH = Math.max(20, (hrs ? 22 : 16) + (descLines.length ? descLines.length * 4 + 4 : 2));

      // Hauteur totale estimée (carte + taxes + total + checkbox)
      let estH = cardH + 6 + 3 * 5 + 8 + 6;
      if (roomsMulti) estH += 5 + 12;
      ensureSpace(estH);

      // Badge « OPTION N » au-dessus de la carte (si multi)
      if (roomsMulti) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...COLOR_BLUE);
        doc.text(`OPTION ${idx + 1}`, M, y);
        doc.setDrawColor(...COLOR_BLUE);
        doc.setLineWidth(1.2);
        const bw = doc.getTextWidth(`OPTION ${idx + 1}`);
        doc.line(M + bw + 4, y - 1, W - M, y - 1);
        y += 5;
      }

      // Carte salle (fond bleu pâle + barre latérale bleue)
      const cardY = y;
      doc.setFillColor(...cardFillByColor.blue);
      doc.roundedRect(M, cardY, contentW, cardH, 3, 3, "F");
      doc.setFillColor(...COLOR_BLUE);
      doc.roundedRect(M, cardY, 3, cardH, 1.5, 1.5, "F");
      doc.rect(M, cardY, 3, cardH, "F");

      // Libellé + date + heures (à gauche)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_TEXT_LIGHT);
      doc.text("DATE DE LOCATION", M + 9, cardY + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(dateLabel, M + 9, cardY + 14);
      if (hrs) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_TEXT_LIGHT);
        doc.text(hrs, M + 9, cardY + 20);
      }

      // Prix (à droite)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.setTextColor(...COLOR_RED);
      doc.text(`${fmtMoney(rt.total).replace(" $", "")} $`, M + contentW - 6, cardY + 13, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT_LIGHT);
      doc.text("TAXES INCLUSES", M + contentW - 6, cardY + 18, { align: "right" });

      // Description (à gauche, sous les heures)
      if (descLines.length) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...COLOR_TEXT);
        let dY = cardY + (hrs ? 26 : 20);
        descLines.forEach(line => { doc.text(line, M + 9, dY); dY += 4; });
      }
      y = cardY + cardH + 6;

      // Détail des taxes (aligné à droite, comme les forfaits)
      doc.setDrawColor(...COLOR_TEXT_LIGHT);
      doc.setLineWidth(0.3);
      doc.line(M, y, M + contentW, y);
      y += 5;
      function roomTotalLine(label, value, bold) {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(bold ? 12 : 10);
        doc.setTextColor(...(bold ? COLOR_TEXT : COLOR_TEXT_LIGHT));
        doc.text(label, M + contentW * 0.55, y, { align: "right" });
        doc.setTextColor(...COLOR_TEXT);
        doc.text(value, M + contentW, y, { align: "right" });
        y += bold ? 7 : 5;
      }
      roomTotalLine("Sous-total (location)", fmtMoney(rt.preTaxTotal));
      roomTotalLine(`TPS (${(TPS_RATE * 100).toFixed(0)} %)`, fmtMoney(rt.tps));
      roomTotalLine(`TVQ (${(TVQ_RATE * 100).toFixed(3)} %)`, fmtMoney(rt.tvq));
      y += 1;
      roomTotalLine(roomsMulti ? `TOTAL — OPTION ${idx + 1}` : "TOTAL LOCATION", fmtMoney(rt.total), true);
      y += 4;

      // Case à cocher (si plusieurs options de salle)
      if (roomsMulti) {
        const cbY = y;
        const cbSize = 6;
        doc.setDrawColor(...COLOR_BLUE);
        doc.setLineWidth(0.8);
        doc.setFillColor(255, 255, 255);
        doc.rect(M, cbY, cbSize, cbSize, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_TEXT);
        doc.text(`Je choisis la salle du ${dateLabel}`, M + cbSize + 4, cbY + 4.5);
        y += cbSize + 8;
      } else {
        y += 4;
      }
    });
  }

  // ═══════════════════════════════════════════
  // NOTES (après toutes les options)
  // ═══════════════════════════════════════════
  if (qt.notes && qt.notes.trim()) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("Notes et conditions :", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    const split = doc.splitTextToSize(pdfStr(qt.notes), contentW);
    // Si les notes ne tiennent pas, passer à la page suivante
    if (y + split.length * 4 > H - FOOTER_RESERVE) newPage();
    doc.text(split, M, y);
    y += split.length * 4 + 4;
  }

  // ═══════════════════════════════════════════
  // FOOTER (QR code + mentions légales) — sur la DERNIÈRE page seulement
  // ═══════════════════════════════════════════
  // Si on est trop bas pour caser le footer, ajouter une page dédiée
  if (y > H - FOOTER_RESERVE - 5) newPage();

  // Bloc QR code
  const qrSize = 26;
  const qrY = H - 56;
  const qrX = M;
  const menuUrl = "https://bochicacafebistro.ca/";
  const qrDrawn = drawQRCode(doc, menuUrl, qrX, qrY, qrSize);

  const textX = qrX + qrSize + 8;
  let textY = qrY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT);
  doc.text("Consultez notre menu en ligne", textX, textY);
  textY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text(qrDrawn ? "Scannez ce code QR avec votre téléphone" : "Visitez notre site web", textX, textY);
  textY += 4;
  doc.text("ou visitez :", textX, textY);
  textY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_ACCENT);
  doc.textWithLink(menuUrl, textX, textY, { url: menuUrl });
  textY += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text("Découvrez tous nos plats colombiens authentiques.", textX, textY);

  doc.setDrawColor(...COLOR_TEXT_LIGHT);
  doc.setLineWidth(0.2);
  doc.line(M, H - 24, W - M, H - 24);

  const footerY = H - 19;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_RED);
  doc.text("Le service (pourboire) n'est pas inclus dans les montants ci-dessus.", W / 2, footerY, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text("Les montants ci-dessus incluent les taxes applicables (TPS 5 % + TVQ 9,975 %).", W / 2, footerY + 5, { align: "center" });
  if (qt.validUntil) {
    doc.text(`Soumission valide jusqu'au ${qt.validUntil}.`, W / 2, footerY + 10, { align: "center" });
  }

  // Numérotation de pages en bas (toutes les pages)
  const totalPages = doc.internal.getNumberOfPages();
  if (totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT_LIGHT);
      doc.text(`Page ${p} / ${totalPages}`, W - M, H - 4, { align: "right" });
    }
  }

  // Téléchargement
  const cleanClient = pdfStr(qt.clientName || "client").replace(/[^a-z0-9]/gi, "_");
  const filename = `Bochica_Soumission_${qt.quoteNumber || "draft"}_${cleanClient}.pdf`;
  doc.save(filename);
  toast(`PDF généré et téléchargé${options.length > 1 ? ` (${options.length} options)` : ""}.`, "success");
}
